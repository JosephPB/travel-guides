begin;
-- Both members can maintain shared café facts, including seeded cafés.
drop policy place_edit on public.places;
create policy place_edit on public.places for update to authenticated
using ((select public.is_member())) with check ((select public.is_member()));
-- Preserve old observation text while removing its retired label.
alter table public.observations drop constraint observations_category_check;
update public.observations set category='observation' where category='cool';
alter table public.observations add constraint observations_category_check check(category in ('observation','edgy','dangerous','unnecessary'));

create table public.place_photos (
 id uuid primary key default gen_random_uuid(),
 place_id uuid not null references public.places(id) on delete restrict,
 author_id uuid not null references auth.users(id),
 storage_path text not null unique,
 created_at timestamptz not null default now(),
 check (split_part(storage_path,'/',1)=author_id::text and split_part(storage_path,'/',2)=place_id::text and storage_path ~ '^[^/]+/[^/]+/[a-zA-Z0-9-]+\.(jpg|png|webp)$')
);
create index place_photos_place on public.place_photos(place_id);
alter table public.place_photos enable row level security;
revoke all on public.place_photos from public,anon,authenticated;
grant select,insert,delete on public.place_photos to authenticated;
create policy photo_read on public.place_photos for select to authenticated using ((select public.is_member()));
create policy photo_add on public.place_photos for insert to authenticated with check (
 (select public.is_member()) and author_id=(select auth.uid()) and exists (
 select 1 from storage.objects o where o.bucket_id='guide-photos' and o.name=storage_path
 ));
create policy photo_delete on public.place_photos for delete to authenticated using ((select public.is_member()) and author_id=(select auth.uid()));

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('guide-photos','guide-photos',false,6291456,array['image/jpeg','image/png','image/webp'])
on conflict(id) do update set public=false,file_size_limit=6291456,allowed_mime_types=excluded.allowed_mime_types;
create policy guide_photo_read on storage.objects for select to authenticated
using (bucket_id='guide-photos' and (select public.is_member()));
create policy guide_photo_upload on storage.objects for insert to authenticated
with check (bucket_id='guide-photos' and (select public.is_member())
 and split_part(name,'/',1)=(select auth.uid())::text
 and exists(select 1 from public.places where id::text=split_part(storage.objects.name,'/',2))
 and name ~ '^[^/]+/[^/]+/[a-zA-Z0-9-]+\.(jpg|png|webp)$');
create policy guide_photo_delete on storage.objects for delete to authenticated
using (bucket_id='guide-photos' and (select public.is_member()) and split_part(name,'/',1)=(select auth.uid())::text);
-- No UPDATE policy: uploads use unique paths and cannot overwrite another photo.
commit;
