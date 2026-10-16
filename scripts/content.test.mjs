import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=p=>readFileSync(p,'utf8');
const cafes=JSON.parse(read('src/data/cafes.json'));
test('seed contains unique Beirut cafés, excludes requested and unresolved venues',()=>{
 assert.equal(cafes.length,18);
 for(const field of ['id','slug'])assert.equal(new Set(cafes.map(c=>c[field])).size,cafes.length);
 for(const c of cafes){assert.equal(c.city_id,'beirut');assert.equal(c.added_by,null);assert.doesNotMatch(c.name,/concierge|daraj|US Coffee|Edda|De Prague/i);}
});
test('each editorial entry carries dated operating evidence and safe source links',()=>{
 for(const c of cafes){
  assert.ok(c.description&&c.verification_note&&c.checked_at);
  for(const key of ['maps_url','source_url','verification_url'])assert.equal(new URL(c[key]).protocol,'https:');
  if(c.image_url){assert.equal(new URL(c.image_url).protocol,'https:');assert.ok(c.image_credit);}
 }
});
test('one-time setup matches the versioned migrations and all seed records',()=>{
 const schema=read('supabase/migrations/001_shared_guide.sql'),seed=read('supabase/migrations/002_beirut_cafes.sql'),setup=read('supabase/setup.sql');
 assert.ok(setup.includes(schema));assert.ok(setup.includes(seed));
 for(const c of cafes)assert.ok(seed.includes(c.id));
});
