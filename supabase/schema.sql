create extension if not exists postgis;
create extension if not exists pgcrypto;

create table if not exists constituencies (
  id text primary key,
  name text not null,
  mla_name text not null,
  party text not null,
  zone text,
  wards text[] default '{}',
  boundary geometry(multipolygon, 4326)
);

create table if not exists reports (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  location_text text,
  description text not null,
  reporter_name text default 'Anonymous',
  severity text not null check (severity in ('critical', 'high', 'medium', 'low')),
  status text not null default 'open' check (status in ('open', 'in-progress', 'fixed')),
  lat double precision not null,
  lng double precision not null,
  geom geometry(point, 4326) generated always as (st_setsrid(st_makepoint(lng, lat), 4326)) stored,
  ward_id text,
  constituency_id text references constituencies(id),
  photo_urls text[] default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null fdefault now()
);

alter table reports add column if not exists ward_id text;

create index if not exists reports_geom_idx on reports using gist (geom);
create index if not exists constituencies_boundary_idx on constituencies using gist (boundary);

create or replace function assign_constituency_for_report()
returns trigger
language plpgsql
as $$
begin
  select c.id
  into new.constituency_id
  from constituencies c
  where c.boundary is not null
    and st_contains(c.boundary, new.geom)
  limit 1;

  return new;
end;
$$;

drop trigger if exists set_report_constituency on reports;

create trigger set_report_constituency
before insert or update of lat, lng
on reports
for each row
execute function assign_constituency_for_report();

alter table constituencies enable row level security;
alter table reports enable row level security;

drop policy if exists "public can read constituencies" on constituencies;
create policy "public can read constituencies"
on constituencies for select
using (true);

drop policy if exists "public can read reports" on reports;
create policy "public can read reports"
on reports for select
using (true);

drop policy if exists "public can insert reports" on reports;
create policy "public can insert reports"
on reports for insert
with check (true);

insert into storage.buckets (id, name, public)
values ('report-photos', 'report-photos', true)
on conflict (id) do nothing;

drop policy if exists "public can read report photos" on storage.objects;
create policy "public can read report photos"
on storage.objects for select
using (bucket_id = 'report-photos');

drop policy if exists "public can upload report photos" on storage.objects;
create policy "public can upload report photos"
on storage.objects for insert
with check (bucket_id = 'report-photos');
