// Only uses the public frontend key. Prints no key, token or private rows.
const url=process.env.VITE_SUPABASE_URL,key=process.env.VITE_SUPABASE_PUBLISHABLE_KEY;
if(!url||!key?.startsWith('sb_publishable_'))throw new Error('Provide the project URL and publishable key in the environment.');
const headers={apikey:key};
const auth=await fetch(`${url}/auth/v1/settings`,{headers});
console.log(`Auth settings endpoint: HTTP ${auth.status}`);
if(!auth.ok)process.exitCode=1;
for(const table of ['members','profiles','cities','places','reviews','recommendations','observations','place_photos']){
 const response=await fetch(`${url}/rest/v1/${table}?select=*&limit=1`,{headers});
 const payload=await response.json();
 const denied=(response.status===401||response.status===403)&&payload.code==='42501';
 console.log(`${table}: ${denied?'anonymous access denied':Array.isArray(payload)&&payload.length===0?'no anonymous rows (check grants)':'NOT VERIFIED'} (HTTP ${response.status}${payload.code?', '+payload.code:''})`);
 if(!denied)process.exitCode=1;
}
