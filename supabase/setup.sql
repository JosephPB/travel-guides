-- Run once in your NEW Supabase project SQL Editor.
-- Contains migrations 001 and 002. No personal emails, passwords or member IDs.

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

-- Public editorial data only. See docs/CAFE_SOURCES.md. No member IDs or personal notes.
begin;
insert into public.places(id,slug,city_id,category,name,neighbourhood,description,maps_url,image_url,source_url,source_name,image_credit,verification_url,verification_note,checked_at,added_by,created_at) values
('2ab27f2c-b01e-5aff-b224-0f99833834fb','backburner','beirut','coffee','Backburner','Saifi','Roasted beans, coffee and food in Saifi.','https://www.google.com/maps/search/?api=1&query=Backburner%20Saifi%20Beirut%20Lebanon','https://www.lebanontraveler.com/wp-content/uploads/2025/09/BackBurner-LT-e1757667914558.jpg','https://www.lebanontraveler.com/en/magazine/the-specialty-coffee-map-of-beirut/','Lebanon Traveler','Photo via Lebanon Traveler','https://www.beirut.com/en/780628/saifis-iconic-backburner-is-opening-in-tripoli/','August 2026 reporting describes the operating Saifi café and its expansion.','2026-10-16',null,'2026-10-16T00:00:00Z'),
('529d913c-c1e9-5810-9514-2b55ec892074','beyt','beirut','coffee','Beyt','Mar Mikhael','Coffee in a traditional house and garden.','https://www.google.com/maps/search/?api=1&query=Beyt%20Mar%20Mikhael%20Beirut%20Lebanon','https://www.lebanontraveler.com/wp-content/uploads/2025/09/Beyt-LT-e1757668041737.jpeg','https://www.lebanontraveler.com/en/magazine/the-specialty-coffee-map-of-beirut/','Lebanon Traveler','Photo via Lebanon Traveler','https://www.spottedbylocals.com/beirut/beyt-mar-mikhael/','Local guide updated July 2026; current menu also found.','2026-10-16',null,'2026-10-16T00:00:00Z'),
('9968104a-87cf-5f14-a8ce-ec7cba779cf7','bn-coffee-bar','beirut','coffee','BN Coffee Bar','Gemmayzeh','A small specialty bar with rotating beans.','https://www.google.com/maps/search/?api=1&query=BN%20Coffee%20Bar%20Gemmayzeh%20Beirut%20Lebanon',null,'https://www.lebanontraveler.com/en/magazine/the-specialty-coffee-map-of-beirut/','Lebanon Traveler',null,'https://eatoutmap.com/en/lebanon/beirut/bn-coffee-bar','Current Gouraud Street listing and July 2026 customer discussion. Badaro branch is not included.','2026-10-16',null,'2026-10-16T00:00:00Z'),
('f5e2e02c-0e2d-50ff-a52d-9f75e5f504b3','cafe-younes','beirut','coffee','Café Younes','Hamra','Specialty roasts in a restored Hamra house.','https://www.google.com/maps/search/?api=1&query=Caf%C3%A9%20Younes%20Hamra%20Beirut%20Lebanon','https://www.lebanontraveler.com/wp-content/uploads/2023/04/Cafe-Younes-2-FINAL.jpg','https://www.lebanontraveler.com/en/magazine/the-specialty-coffee-map-of-beirut/','Lebanon Traveler','Photo via Lebanon Traveler','https://cafeyounes.com/en-lb/pages/locations','Official site lists the current Baalbeck Street Hamra café.','2026-10-16',null,'2026-10-16T00:00:00Z'),
('b0611da1-5ac2-540a-8ce2-05056e64512b','caffeine-beirut','beirut','coffee','Caffeine Beirut','Mar Mikhael','Coffee drinks and light bites.','https://www.google.com/maps/search/?api=1&query=Caffeine%20Beirut%20Mar%20Mikhael%20Beirut%20Lebanon',null,'https://www.lebanontraveler.com/en/magazine/the-specialty-coffee-map-of-beirut/','Lebanon Traveler',null,'https://www.caffeineroaster.com/subelerimiz','Official franchise directory lists Beirut; current listing and recent review match Alexander Fleming Street.','2026-10-16',null,'2026-10-16T00:00:00Z'),
('d31404ff-fe26-5463-9c5e-0e33b6d2b402','cantina-sociale','beirut','coffee','Cantina Sociale','Achrafieh','Self-service café, restaurant and wine bar.','https://www.google.com/maps/search/?api=1&query=Cantina%20Sociale%20Achrafieh%20Beirut%20Lebanon','https://www.lebanontraveler.com/wp-content/uploads/2025/07/Cantina-Sociale-Lebanon-Traveler-2.jpg','https://www.lebanontraveler.com/en/magazine/the-specialty-coffee-map-of-beirut/','Lebanon Traveler','Photo via Lebanon Traveler','https://cantinabeirut.com/contact-us','Official contact page lists Cantina Sociale and operating hours.','2026-10-16',null,'2026-10-16T00:00:00Z'),
('a10df1e6-ed91-59e0-b1ae-f410030a7bdf','curl','beirut','coffee','Curl','Badaro','A bookshop with coffee and reading space.','https://www.google.com/maps/search/?api=1&query=Curl%20Badaro%20Beirut%20Lebanon',null,'https://www.lebanontraveler.com/en/magazine/the-specialty-coffee-map-of-beirut/','Lebanon Traveler',null,'https://www.spottedbylocals.com/beirut/curl-book-coffee-shop/','Local guide updated August 2026 and current operating listing.','2026-10-16',null,'2026-10-16T00:00:00Z'),
('b3bd7886-7d28-583b-967a-abefe1e9cc63','diell','beirut','coffee','Diell’','Hamra','Coffee and swing seats on Makdessi Street.','https://www.google.com/maps/search/?api=1&query=Diell%E2%80%99%20Hamra%20Beirut%20Lebanon',null,'https://www.lebanontraveler.com/en/magazine/the-specialty-coffee-map-of-beirut/','Lebanon Traveler',null,'https://restaurantguru.com/Diell-Beirut','Current operating listing includes a recent customer review; cross-checked with BAM.','2026-10-16',null,'2026-10-16T00:00:00Z'),
('178b1be4-646c-5e06-8690-630c553707a7','flat-white','beirut','coffee','Flat White','Mar Mikhael','Espresso and flat whites.','https://www.google.com/maps/search/?api=1&query=Flat%20White%20Mar%20Mikhael%20Beirut%20Lebanon','https://www.lebanontraveler.com/wp-content/uploads/2025/09/The-neighborhoods-happiest-place-e1757669274780.jpg','https://www.lebanontraveler.com/en/magazine/the-specialty-coffee-map-of-beirut/','Lebanon Traveler','Photo via Lebanon Traveler','https://www.spottedbylocals.com/beirut/flat-white/','Local guide updated August 2026 lists Pharoun Street.','2026-10-16',null,'2026-10-16T00:00:00Z'),
('16632471-51f4-5168-8280-0ddf2bd053e2','kalei','beirut','coffee','Kalei Coffee Co.','Mar Mikhael / Ras Beirut','Micro-roastery in heritage houses.','https://www.google.com/maps/search/?api=1&query=Kalei%20Coffee%20Co.%20Mar%20Mikhael%20/%20Ras%20Beirut%20Beirut%20Lebanon','https://www.lebanontraveler.com/wp-content/uploads/2025/07/Kalei-Lebanon-Traveler.jpg','https://www.lebanontraveler.com/en/magazine/the-specialty-coffee-map-of-beirut/','Lebanon Traveler','Photo via Lebanon Traveler','https://www.kaleicoffee.com/pages/locations','Official site lists both operating Beirut locations.','2026-10-16',null,'2026-10-16T00:00:00Z'),
('52d2771d-882a-51ba-8246-db830085804a','neighbourhood','beirut','coffee','Neighbourhood','Gemmayzeh','Coffee, tea and homemade cakes.','https://www.google.com/maps/search/?api=1&query=Neighbourhood%20Gemmayzeh%20Beirut%20Lebanon',null,'https://www.lebanontraveler.com/en/magazine/the-specialty-coffee-map-of-beirut/','Lebanon Traveler',null,'https://restaurantguru.com/Neighbourhood-Beirut','Current operating listing; corroborated by WorldCafeMap at Gouraud Street.','2026-10-16',null,'2026-10-16T00:00:00Z'),
('ed308526-81df-512a-a224-097dc82fda2e','riwaq','beirut','coffee','Riwaq','Mar Mikhael','Coffee, workspaces and music.','https://www.google.com/maps/search/?api=1&query=Riwaq%20Mar%20Mikhael%20Beirut%20Lebanon',null,'https://www.lebanontraveler.com/en/magazine/the-specialty-coffee-map-of-beirut/','Lebanon Traveler',null,'https://www.tripadvisor.co.uk/Restaurant_Review-g294005-d11680169-Reviews-Riwaq_Beirut-Beirut.html','Business-managed operating listing and June 2026 listing; September 2026 local recommendations.','2026-10-16',null,'2026-10-16T00:00:00Z'),
('0cec538d-2232-5784-a69e-a1489e1d1224','sip','beirut','coffee','Sip','Gemmayzeh','Specialty coffee with a leafy terrace.','https://www.google.com/maps/search/?api=1&query=Sip%20Gemmayzeh%20Beirut%20Lebanon','https://www.lebanontraveler.com/wp-content/uploads/2025/07/Sip-Lebanon-Traveler.jpg','https://www.lebanontraveler.com/en/magazine/the-specialty-coffee-map-of-beirut/','Lebanon Traveler','Photo via Lebanon Traveler','https://waradana.com/english/article/268817-top-coffee-shops-in-gemmayze-street','August 2026 reporting identifies the operating Gemmayzeh café. Other branches not verified.','2026-10-16',null,'2026-10-16T00:00:00Z'),
('5d4bea79-2189-502d-bbde-5e1c7c57694c','sole-insight','beirut','coffee','Sole Insight','Mar Mikhael','Coffee alongside art, literature and philosophy.','https://www.google.com/maps/search/?api=1&query=Sole%20Insight%20Mar%20Mikhael%20Beirut%20Lebanon',null,'https://www.lebanontraveler.com/en/magazine/the-specialty-coffee-map-of-beirut/','Lebanon Traveler',null,'https://restaurantguru.com/Sole-Insight-Beirut','Current operating listing and customer return visit; Vendome Stairs location.','2026-10-16',null,'2026-10-16T00:00:00Z'),
('5bb75dba-64d8-5b4b-a85a-86cb1526e087','sucasu','beirut','coffee','Sucasu','Downtown','A café, roastery and training space.','https://www.google.com/maps/search/?api=1&query=Sucasu%20Downtown%20Beirut%20Lebanon','https://www.lebanontraveler.com/wp-content/uploads/2025/09/Sucasu-LT-e1757669680318.jpg','https://www.lebanontraveler.com/en/magazine/the-specialty-coffee-map-of-beirut/','Lebanon Traveler','Photo via Lebanon Traveler','https://www.corner.inc/place/pLaHsWHmxyBY','Operating listing updated August 2026; recent customer discussions corroborate.','2026-10-16',null,'2026-10-16T00:00:00Z'),
('b5d73a43-1d8e-5131-ad7a-db9439105383','ginette','beirut','coffee','Ginette','Gemmayzeh','A café and concept store combining food, fashion and an art space.','https://www.google.com/maps/search/?api=1&query=Ginette%20Gemmayzeh%20Beirut%20Lebanon',null,'https://theculturetrip.com/middle-east/lebanon/articles/the-6-coolest-cafes-in-beirut','Culture Trip',null,'https://www.tripadvisor.com/Restaurant_Review-g294005-d3876767-Reviews-Ginette_Eatery-Beirut.html','January 2026 visit specifically identifies Gemmayzeh, alongside current business listing.','2026-10-16',null,'2026-10-16T00:00:00Z'),
('15d3b06f-ed11-5dec-8281-fab4d24e64c2','urbanista','beirut','coffee','Urbanista','Gemmayzeh','Coffee, food and seating for reading or working.','https://www.google.com/maps/search/?api=1&query=Urbanista%20Gemmayzeh%20Beirut%20Lebanon',null,'https://theculturetrip.com/middle-east/lebanon/articles/the-6-coolest-cafes-in-beirut','Culture Trip',null,'https://waradana.com/english/article/268795-discover-tranquil-cafes-in-gemmayzeh-beirut','August 2026 reporting identifies Gemmayzeh branch as operating; current listing corroborates.','2026-10-16',null,'2026-10-16T00:00:00Z'),
('6e419cae-6ad2-50aa-8f3c-335475d21d91','demo','beirut','coffee','Demo','Gemmayzeh','A small bar with music and drinks. Originally listed for daytime coffee; current listings describe evening service.','https://www.google.com/maps/search/?api=1&query=Demo%20Gemmayzeh%20Beirut%20Lebanon',null,'https://theculturetrip.com/middle-east/lebanon/articles/the-6-coolest-cafes-in-beirut','Culture Trip',null,'https://waradana.com/english/article/270710-top-nightlife-spots-on-gemmayze-street','September 2026 nightlife reporting and BAM list the venue as operating. Daytime coffee is not verified.','2026-10-16',null,'2026-10-16T00:00:00Z')
on conflict(id) do nothing;
commit;
