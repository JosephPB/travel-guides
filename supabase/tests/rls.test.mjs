import test from 'node:test';
import assert from 'node:assert/strict';
import { PGlite } from '@electric-sql/pglite';
import { readFileSync } from 'node:fs';
// Execute the actual migrations in PostgreSQL (WASM). Only Supabase Auth is stubbed.
const A='11111111-1111-4111-8111-111111111111',B='22222222-2222-4222-8222-222222222222',X='33333333-3333-4333-8333-333333333333';
let db;
test.before(async()=>{
 db=new PGlite();await db.exec(`create role anon nologin; create role authenticated nologin; create schema auth; create table auth.users(id uuid primary key); create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$; grant usage on schema auth,public to anon,authenticated; grant execute on function auth.uid() to anon,authenticated; insert into auth.users values('${A}'),('${B}'),('${X}');`);
 await db.exec(readFileSync('supabase/migrations/001_shared_guide.sql','utf8'));
 await db.exec(readFileSync('supabase/migrations/002_beirut_cafes.sql','utf8'));
 await db.exec(`insert into public.members(user_id,slot) values('${A}',1),('${B}',2);`);
});
test.after(async()=>await db.close());
const as=async(id)=>{await db.exec('reset role');await db.query("select set_config('request.jwt.claim.sub',$1,false)",[id||'']);await db.exec(id?'set role authenticated':'set role anon');};
const q=(sql,args=[])=>db.query(sql,args);
const blocked=async(sql,args=[])=>assert.rejects(q(sql,args));
let pid,rid,bid,oid,rec;
test('RLS is enabled on every exposed application table',async()=>{
 const {rows}=await q("select relname,relrowsecurity from pg_class where relnamespace='public'::regnamespace and relkind='r'");assert.equal(rows.length,7);assert.ok(rows.every(r=>r.relrowsecurity));
});
test('anonymous visitors cannot read any private table or invoke the save RPC',async()=>{
 await as(null);for(const table of ['members','profiles','cities','places','reviews','recommendations','observations'])await blocked(`select * from public.${table}`);
 await blocked("select public.save_report(gen_random_uuid(),'','',0,'[]')");
});
test('an authenticated nonmember has no rows and cannot self-enrol or insert a place',async()=>{
 await as(X);for(const table of ['members','profiles','cities','places','reviews','recommendations','observations'])assert.equal((await q(`select * from public.${table}`)).rows.length,0);
 await blocked('insert into public.members(user_id,slot) values($1,1)',[X]);
 await blocked("insert into public.places(slug,city_id,category,name,maps_url,added_by) values('bad','beirut','coffee','Bad','https://www.google.com/maps/?q=Beirut',$1)",[X]);
});
test('members share seeded places; member A can create their own place and report',async()=>{
 await as(A);assert.equal((await q('select * from public.places')).rows.length,18);assert.equal((await q('select * from public.profiles')).rows.length,2);
 pid=(await q("insert into public.places(slug,city_id,category,name,maps_url,added_by) values('test','beirut','coffee','Test','https://www.google.com/maps/?q=Test',$1) returning id",[A])).rows[0].id;
 rid=(await q("select public.save_report($1,'A thoughts','A order',9,'[{\"category\":\"cool\",\"note\":\"A observation\"}]') id",[pid])).rows[0].id;
 oid=(await q('select id from public.observations where review_id=$1',[rid])).rows[0].id;
 rec=(await q("insert into public.recommendations(place_id,author_id,personal_note) values($1,$2,'A note') returning id",[pid,A])).rows[0].id;
});
test('B reads A’s work and writes a separate report, but cannot modify A’s content',async()=>{
 await as(B);assert.equal((await q('select thoughts from public.reviews where id=$1',[rid])).rows[0].thoughts,'A thoughts');assert.equal((await q('select * from public.places where id=$1',[pid])).rows.length,1);
 assert.equal((await q("update public.reviews set thoughts='hacked' where id=$1 returning id",[rid])).rows.length,0);
 assert.equal((await q('delete from public.reviews where id=$1 returning id',[rid])).rows.length,0);
 assert.equal((await q("update public.observations set note='hacked' where id=$1 returning id",[oid])).rows.length,0);
 assert.equal((await q('delete from public.observations where id=$1 returning id',[oid])).rows.length,0);
 assert.equal((await q("update public.recommendations set personal_note='hacked' where id=$1 returning id",[rec])).rows.length,0);
 assert.equal((await q('delete from public.recommendations where id=$1 returning id',[rec])).rows.length,0);
 assert.equal((await q("update public.places set name='hacked' where id=$1 returning id",[pid])).rows.length,0);
 assert.equal((await q('delete from public.places where id=$1 returning id',[pid])).rows.length,0);
 await blocked("insert into public.observations(review_id,category,note) values($1,'cool','hacked')",[rid]);
 await blocked("insert into public.reviews(place_id,author_id) values($1,$2)",[pid,A]);
 await blocked("insert into public.recommendations(place_id,author_id) values($1,$2)",[pid,A]);
 bid=(await q("select public.save_report($1,'B thoughts','B order',5,'[]') id",[pid])).rows[0].id;
 assert.equal((await q('select * from public.reviews where place_id=$1',[pid])).rows.length,2);
});
test('identity columns cannot be changed and seeded places cannot be edited by a member',async()=>{
 await as(A);await blocked('update public.reviews set author_id=$1 where id=$2',[B,rid]);await blocked('update public.reviews set place_id=$1 where id=$2',[pid,rid]);await blocked('update public.observations set review_id=$1 where id=$2',[bid,oid]);await blocked('update public.places set added_by=$1 where id=$2',[B,pid]);
 assert.equal((await q("update public.places set name='bad' where added_by is null returning id")).rows.length,0);
 await blocked('insert into public.members(user_id,slot) values($1,1)',[X]);
 assert.equal((await q("update public.profiles set display_name='bad' where id=$1 returning id",[B])).rows.length,0);
 assert.equal((await q("update public.profiles set display_name='Owner' where id=$1 returning id",[A])).rows.length,1);
});
test('own edits work, score bounds hold and invalid observations roll back the whole save',async()=>{
 await as(A);await q("select public.save_report($1,'Edited','Coffee',0,'[{\"category\":\"edgy\",\"note\":\"Updated\"}]')",[pid]);
 for(const score of [-1,10])await blocked("select public.save_report($1,'invalid','', $2,'[]')",[pid,score]);
 await blocked("select public.save_report($1,'rollback me','',1,'[{\"category\":\"invalid\"}]')",[pid]);
 assert.equal((await q('select thoughts from public.reviews where id=$1',[rid])).rows[0].thoughts,'Edited');
 assert.equal((await q('select note from public.observations where review_id=$1',[rid])).rows[0].note,'Updated');
 assert.equal((await q("update public.recommendations set personal_note='Edited note' where id=$1 returning id",[rec])).rows.length,1);
});
test('deleting a place cannot cascade-delete the other member’s report; own report deletion cascades only its observations',async()=>{
 await as(A);await q('delete from public.recommendations where id=$1',[rec]);await q('delete from public.reviews where id=$1',[rid]);assert.equal((await q('select * from public.observations where review_id=$1',[rid])).rows.length,0);
 await blocked('delete from public.places where id=$1',[pid]);
 await as(B);assert.equal((await q('select * from public.reviews where id=$1',[bid])).rows.length,1);await q('delete from public.reviews where id=$1',[bid]);
 await as(A);assert.equal((await q('delete from public.places where id=$1 returning id',[pid])).rows.length,1);
});
test('removing a member revokes their data access immediately; allowlist is capped at two slots',async()=>{
 await db.exec('reset role');await blocked('insert into public.members(user_id,slot) values($1,3)',[X]);await q('delete from public.members where user_id=$1',[A]);
 await as(A);assert.equal((await q('select * from public.places')).rows.length,0);assert.equal((await q('select * from public.reviews')).rows.length,0);
 await blocked("select public.save_report(gen_random_uuid(),'','',0,'[]')");
});
