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
  description text not null,
  severity text not null check (severity in ('critical', 'high', 'medium', 'low')),
  status text not null default 'open' check (status in ('open', 'in-progress', 'fixed')),
  lat double precision not null,
  lng double precision not null,
  geom geometry(point, 4326) generated always as (st_setsrid(st_makepoint(lng, lat), 4326)) stored,
  constituency_id text references constituencies(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

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
