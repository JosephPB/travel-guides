const { VITE_SUPABASE_URL:url, VITE_SUPABASE_PUBLISHABLE_KEY:key }=process.env;
if(!/^https:\/\/[a-z0-9-]+\.supabase\.co\/?$/.test(url||'') || !key?.startsWith('sb_publishable_')) {
 console.error('Deployment needs VITE_SUPABASE_URL and a VITE_SUPABASE_PUBLISHABLE_KEY (sb_publishable_…). Never use a secret/service-role key.');process.exit(1);
}
console.log('Frontend configuration format checked; publishable key only.');
