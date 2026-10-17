import test from 'node:test';
import assert from 'node:assert/strict';
import {PGlite} from '@electric-sql/pglite';
import {readFileSync} from 'node:fs';
const A='11111111-1111-4111-8111-111111111111',B='22222222-2222-4222-8222-222222222222',X='33333333-3333-4333-8333-333333333333';
let db,place,path;
const q=(sql,args=[])=>db.query(sql,args);
const as=async(id)=>{await db.exec('reset role');await q("select set_config('request.jwt.claim.sub',$1,false)",[id||'']);await db.exec(id?'set role authenticated':'set role anon');};
test.before(async()=>{
 db=new PGlite();await db.exec(`create role anon;create role authenticated;create schema auth;create table auth.users(id uuid primary key);create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;grant usage on schema auth,public to authenticated,anon;insert into auth.users values('${A}'),('${B}'),('${X}');
 create schema storage;create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);create table storage.objects(id uuid default gen_random_uuid(),bucket_id text,name text);alter table storage.objects enable row level security;grant usage on schema storage to authenticated,anon;grant select,insert,update,delete on storage.objects to authenticated,anon;`);
 for(const f of ['001_shared_guide.sql','002_beirut_cafes.sql','003_shared_photos.sql','004_cafe_photos_and_oak.sql','005_riwaq_photo.sql'])await db.exec(readFileSync('supabase/migrations/'+f,'utf8'));
 await db.exec(`insert into public.members(user_id,slot) values('${A}',1),('${B}',2)`);
 place=(await q('select id from public.places limit 1')).rows[0].id;path=`${A}/${place}/test.jpg`;
});
test.after(async()=>await db.close());
test('both members can edit seeded café facts; identity stays immutable',async()=>{
 for(const id of [A,B]){await as(id);assert.equal((await q("update public.places set name='Shared cafe',neighbourhood='Forn el Chebbak',description='Both see this',maps_url='https://www.google.com/maps/?q=cafe' where id=$1 returning id",[place])).rows.length,1);await assert.rejects(q('update public.places set added_by=$1 where id=$2',[id,place]));}
 await as(X);assert.equal((await q("update public.places set name='No' where id=$1 returning id",[place])).rows.length,0);
});
test('private storage accepts own uploads only, requires a real place and blocks nonmembers',async()=>{
 await as(A);await q("insert into storage.objects(bucket_id,name) values('guide-photos',$1)",[path]);
 await assert.rejects(q("insert into storage.objects(bucket_id,name) values('guide-photos',$1)",[`${B}/${place}/fake.jpg`]));
 await assert.rejects(q("insert into storage.objects(bucket_id,name) values('guide-photos',$1)",[`${A}/${X}/fake.jpg`]));
 await assert.rejects(q("insert into storage.objects(bucket_id,name) values('guide-photos',$1)",[`${A}/${place}/fake.svg`]));
 await as(X);assert.equal((await q('select * from storage.objects')).rows.length,0);await assert.rejects(q("insert into storage.objects(bucket_id,name) values('guide-photos',$1)",[`${X}/${place}/fake.jpg`]));
 await as(null);assert.equal((await q('select * from storage.objects')).rows.length,0);await assert.rejects(q('select * from public.place_photos'));
});
test('photo metadata and objects are shared for reading, but only uploader can remove them',async()=>{
 await as(A);await q('insert into public.place_photos(place_id,author_id,storage_path) values($1,$2,$3)',[place,A,path]);
 await assert.rejects(q('insert into public.place_photos(place_id,author_id,storage_path) values($1,$2,$3)',[place,B,`${B}/${place}/spoof.jpg`]));
 await as(B);assert.equal((await q('select * from public.place_photos')).rows.length,1);assert.equal((await q('select * from storage.objects')).rows.length,1);
 assert.equal((await q('delete from storage.objects returning name')).rows.length,0);assert.equal((await q('delete from public.place_photos returning id')).rows.length,0);
 assert.equal((await q("update storage.objects set name='overwrite' returning name")).rows.length,0);
 await as(A);assert.equal((await q('delete from storage.objects returning name')).rows.length,1);assert.equal((await q('delete from public.place_photos returning id')).rows.length,1);
});
test('new observations use neutral label and retired cool value is rejected',async()=>{
 await as(A);await q(`select public.save_report($1,'','',3,'[{"category":"observation","note":"Kept"}]')`,[place]);
 await assert.rejects(q(`select public.save_report($1,'','',3,'[{"category":"cool","note":"No"}]')`,[place]));
});

test('photo bucket is private and limits images to 6 MB; added café is seeded',async()=>{
 await db.exec('reset role');const bucket=(await q("select * from storage.buckets where id='guide-photos'")).rows[0];
 assert.equal(bucket.public,false);assert.equal(Number(bucket.file_size_limit),6291456);assert.deepEqual(bucket.allowed_mime_types,['image/jpeg','image/png','image/webp']);
 assert.equal((await q("select name from public.places where neighbourhood='Forn el Chebbak' and slug='oak-coffee-shop'")).rows.length,1);
});
