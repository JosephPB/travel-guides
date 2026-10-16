import { readFileSync, writeFileSync } from 'node:fs';
const cafes=JSON.parse(readFileSync('src/data/cafes.json','utf8'));
const columns=Object.keys(cafes[0]);
const quote=x=>x===null?'null':`'${String(x).replaceAll("'","''")}'`;
writeFileSync('supabase/migrations/002_beirut_cafes.sql', `-- Public editorial data only. See docs/CAFE_SOURCES.md. No member IDs or personal notes.\nbegin;\ninsert into public.places(${columns.join(',')}) values\n${cafes.map(c=>`(${columns.map(k=>quote(c[k])).join(',')})`).join(',\n')}\non conflict(id) do nothing;\ncommit;\n`);
