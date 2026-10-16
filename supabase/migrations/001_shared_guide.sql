begin;

create table public.members (
  user_id uuid primary key references auth.users(id) on delete cascade,
  slot smallint not null unique check (slot in (1,2)),
  created_at timestamptz not null default now()
);
alter table public.members enable row level security;

-- Owned by the migration role; no user-controlled SQL or search path.
create function public.is_member() returns boolean language sql stable security definer
set search_path = '' as $$
  select exists(select 1 from public.members where user_id = (select auth.uid()));
$$;
revoke all on function public.is_member() from public;
grant execute on function public.is_member() to authenticated;

create table public.profiles (
 id uuid primary key references auth.users(id) on delete cascade,
 display_name text not null check (length(display_name) between 1 and 60)
);
create table public.cities (
 id text primary key check (id in ('beirut','bristol')),
 name text not null
);
create table public.places (
 id uuid primary key default gen_random_uuid(),
 slug text not null unique,
 city_id text not null references public.cities(id),
 category text not null check (category in ('coffee','restaurants','museums','attractions')),
 name text not null check (length(name) between 1 and 150),
 neighbourhood text not null default '' check (length(neighbourhood)<=150),
 description text not null default '' check (length(description)<=4000),
 maps_url text not null check (maps_url ~ '^https://(www\.)?google\.com/maps[/?]'),
 image_url text check (image_url is null or image_url ~ '^https://'),
 image_credit text,
 source_url text check (source_url is null or source_url ~ '^https://'),
 source_name text,
 verification_url text check (verification_url is null or verification_url ~ '^https://'),
 verification_note text,
 checked_at date,
 added_by uuid references auth.users(id),
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now()
);
create table public.recommendations (
 id uuid primary key default gen_random_uuid(),
 place_id uuid not null references public.places(id) on delete restrict,
 author_id uuid not null references auth.users(id),
 recipient_id uuid references auth.users(id),
 personal_note text not null default '' check (length(personal_note)<=4000),
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 unique(place_id,author_id)
);
create table public.reviews (
 id uuid primary key default gen_random_uuid(),
 place_id uuid not null references public.places(id) on delete restrict,
 author_id uuid not null references auth.users(id),
 thoughts text not null default '' check (length(thoughts)<=8000),
 ordered text not null default '' check (length(ordered)<=1000),
 triangle_sides integer not null default 0 check (triangle_sides between 0 and 9),
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 unique(place_id,author_id)
);
create table public.observations (
 id uuid primary key default gen_random_uuid(),
 review_id uuid not null references public.reviews(id) on delete cascade,
 category text not null check (category in ('cool','edgy','dangerous','unnecessary')),
 note text not null default '' check (length(note)<=2000),
 created_at timestamptz not null default now()
);
create index places_city_category on public.places(city_id,category);
create index places_added_by on public.places(added_by);
create index reviews_author on public.reviews(author_id);
create index recommendations_author on public.recommendations(author_id);
create index observations_review on public.observations(review_id);

create function public.touch_updated_at() returns trigger language plpgsql set search_path = '' as $$
begin new.updated_at=now(); return new; end;
$$;
create trigger touch_place before update on public.places for each row execute function public.touch_updated_at();
create trigger touch_review before update on public.reviews for each row execute function public.touch_updated_at();
create trigger touch_recommendation before update on public.recommendations for each row execute function public.touch_updated_at();

alter table public.profiles enable row level security;
alter table public.cities enable row level security;
alter table public.places enable row level security;
alter table public.recommendations enable row level security;
alter table public.reviews enable row level security;
alter table public.observations enable row level security;

-- No table privileges for anonymous visitors. Allowlist changes are admin-only.
revoke all on public.members,public.profiles,public.cities,public.places,public.recommendations,public.reviews,public.observations from public,anon,authenticated;
grant select on public.members,public.profiles,public.cities,public.places,public.recommendations,public.reviews,public.observations to authenticated;
grant update(display_name) on public.profiles to authenticated;
grant insert,delete on public.places,public.recommendations,public.reviews,public.observations to authenticated;
-- Column grants keep identity, timestamps and provenance immutable for client updates.
grant update(name,neighbourhood,description,maps_url,category) on public.places to authenticated;
grant update(personal_note,recipient_id) on public.recommendations to authenticated;
grant update(thoughts,ordered,triangle_sides) on public.reviews to authenticated;
grant update(category,note) on public.observations to authenticated;

create policy member_self on public.members for select to authenticated using(user_id=(select auth.uid()));
create policy profile_read on public.profiles for select to authenticated using((select public.is_member()));
create policy profile_edit on public.profiles for update to authenticated using((select public.is_member()) and id=(select auth.uid())) with check((select public.is_member()) and id=(select auth.uid()));
create policy city_read on public.cities for select to authenticated using((select public.is_member()));
create policy place_read on public.places for select to authenticated using((select public.is_member()));
create policy place_add on public.places for insert to authenticated with check((select public.is_member()) and added_by=(select auth.uid()));
create policy place_edit on public.places for update to authenticated using((select public.is_member()) and added_by=(select auth.uid())) with check((select public.is_member()) and added_by=(select auth.uid()));
create policy place_delete on public.places for delete to authenticated using((select public.is_member()) and added_by=(select auth.uid()));
create policy recommendation_read on public.recommendations for select to authenticated using((select public.is_member()));
create policy recommendation_add on public.recommendations for insert to authenticated with check((select public.is_member()) and author_id=(select auth.uid()) and (recipient_id is null or exists(select 1 from public.profiles where id=recipient_id)));
create policy recommendation_edit on public.recommendations for update to authenticated using((select public.is_member()) and author_id=(select auth.uid())) with check((select public.is_member()) and author_id=(select auth.uid()));
create policy recommendation_delete on public.recommendations for delete to authenticated using((select public.is_member()) and author_id=(select auth.uid()));
create policy review_read on public.reviews for select to authenticated using((select public.is_member()));
create policy review_add on public.reviews for insert to authenticated with check((select public.is_member()) and author_id=(select auth.uid()));
create policy review_edit on public.reviews for update to authenticated using((select public.is_member()) and author_id=(select auth.uid())) with check((select public.is_member()) and author_id=(select auth.uid()));
create policy review_delete on public.reviews for delete to authenticated using((select public.is_member()) and author_id=(select auth.uid()));
create policy observation_read on public.observations for select to authenticated using((select public.is_member()));
create policy observation_add on public.observations for insert to authenticated with check((select public.is_member()) and exists(select 1 from public.reviews r where r.id=review_id and r.author_id=(select auth.uid())));
create policy observation_edit on public.observations for update to authenticated using((select public.is_member()) and exists(select 1 from public.reviews r where r.id=review_id and r.author_id=(select auth.uid()))) with check((select public.is_member()) and exists(select 1 from public.reviews r where r.id=review_id and r.author_id=(select auth.uid())));
create policy observation_delete on public.observations for delete to authenticated using((select public.is_member()) and exists(select 1 from public.reviews r where r.id=review_id and r.author_id=(select auth.uid())));

-- Save the report and observations as one transaction. RLS still applies.
create function public.save_report(p_place_id uuid,p_thoughts text,p_ordered text,p_score integer,p_observations jsonb)
returns uuid language plpgsql security invoker set search_path = '' as $$
declare v_id uuid; item jsonb;
begin
 if not public.is_member() then raise exception 'Membership required' using errcode='42501'; end if;
 if jsonb_typeof(p_observations) is distinct from 'array' or jsonb_array_length(p_observations)>30 then raise exception 'Expected at most 30 observations'; end if;
 select id into v_id from public.reviews where place_id=p_place_id and author_id=auth.uid();
 if v_id is null then
  insert into public.reviews(place_id,author_id,thoughts,ordered,triangle_sides) values(p_place_id,auth.uid(),p_thoughts,p_ordered,p_score) returning id into v_id;
 else
  update public.reviews set thoughts=p_thoughts,ordered=p_ordered,triangle_sides=p_score where id=v_id;
 end if;
 delete from public.observations where review_id=v_id;
 for item in select value from jsonb_array_elements(p_observations) loop
  insert into public.observations(review_id,category,note) values(v_id,item->>'category',coalesce(item->>'note',''));
 end loop;
 return v_id;
end;
$$;
revoke all on function public.save_report(uuid,text,text,integer,jsonb) from public;
grant execute on function public.save_report(uuid,text,text,integer,jsonb) to authenticated;

-- Create a profile when the owner explicitly adds an allowed member.
create function public.create_member_profile() returns trigger language plpgsql security definer set search_path = '' as $$
begin
 insert into public.profiles(id,display_name) values(new.user_id,case when new.slot=1 then 'You' else 'Cara' end) on conflict(id) do nothing;
 return new;
end;
$$;
revoke all on function public.create_member_profile() from public;
create trigger member_profile after insert on public.members for each row execute function public.create_member_profile();
insert into public.cities(id,name) values('beirut','Beirut'),('bristol','Bristol');
commit;
