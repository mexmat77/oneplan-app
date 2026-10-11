-- Справочник географии Турции с полигонами: il → ilçe → mahalle/köy (09.10.2026).
-- Источник: OpenStreetMap (ODbL) — границы admin_level 4/6/8; махалле без границы в OSM получают расчётную зону
-- (ячейка Вороного по центру внутри ilçe), exact=false. Геометрия — GeoJSON (упрощённая, ~25 м), читается анонимно.
create table if not exists public.geo_il (
  k text primary key,
  name text not null,
  bbox jsonb,
  geom jsonb
);
create table if not exists public.geo_ilce (
  k text primary key,
  il text not null references public.geo_il(k) on delete cascade,
  name text not null,
  bbox jsonb,
  geom jsonb
);
create index if not exists geo_ilce_il_idx on public.geo_ilce(il);
create table if not exists public.geo_mahalle (
  k text primary key,
  il text not null references public.geo_il(k) on delete cascade,
  ilce text not null references public.geo_ilce(k) on delete cascade,
  name text not null,
  kind text not null default 'mahalle' check (kind in ('mahalle', 'koy')),
  exact boolean not null default false,
  c jsonb,
  bbox jsonb,
  geom jsonb
);
create index if not exists geo_mahalle_ilce_idx on public.geo_mahalle(ilce);
create index if not exists geo_mahalle_il_idx on public.geo_mahalle(il);
alter table public.geo_il enable row level security;
alter table public.geo_ilce enable row level security;
alter table public.geo_mahalle enable row level security;
drop policy if exists "geo_il read" on public.geo_il;
drop policy if exists "geo_ilce read" on public.geo_ilce;
drop policy if exists "geo_mahalle read" on public.geo_mahalle;
create policy "geo_il read" on public.geo_il for select using (true);
create policy "geo_ilce read" on public.geo_ilce for select using (true);
create policy "geo_mahalle read" on public.geo_mahalle for select using (true);
