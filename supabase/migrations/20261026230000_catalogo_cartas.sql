create extension if not exists vector with schema extensions;

create table public.ediciones (
  id integer primary key,
  nombre text not null,
  bloque text not null
);

create table public.cartas (
  id text primary key,
  nombre text not null,
  nombre_clave text not null,
  edicion_id integer references public.ediciones (id),
  bloque text not null,
  tipo text not null,
  coste smallint,
  fuerza smallint,
  razas text[] not null default '{}',
  rareza text,
  numero integer,
  habilidad text,
  imagen text,
  temporadas integer[] not null default '{}',
  actualizado timestamptz not null default now()
);

create index cartas_nombre_clave_idx on public.cartas (nombre_clave);

create table public.huellas (
  carta_id text primary key references public.cartas (id) on delete cascade,
  vector extensions.halfvec(2560) not null
);

create index huellas_vector_idx on public.huellas using hnsw (vector extensions.halfvec_cosine_ops);

create table public.banlist (
  nombre_clave text primary key,
  nombre text not null,
  limite smallint not null check (limite between 0 and 3),
  actualizado timestamptz not null default now()
);

create table public.temporada_vigente (
  bloque text primary key,
  temporada integer not null,
  nombre text
);

create view public.legalidad with (security_invoker = on) as
select
  c.id,
  c.nombre_clave,
  case
    when c.bloque <> 'IMP' then 'otro_formato'
    when b.limite = 0 then 'prohibida'
    when tv.temporada = any (c.temporadas) then 'vigente'
    when exists (
      select 1 from public.cartas r
      where r.nombre_clave = c.nombre_clave and tv.temporada = any (r.temporadas)
    ) then 'legal_por_reimpresion'
    else 'rotada'
  end as estado,
  b.limite
from public.cartas c
left join public.banlist b on b.nombre_clave = c.nombre_clave
left join public.temporada_vigente tv on tv.bloque = 'IMP';

create function public.buscar_cartas(consulta extensions.halfvec(2560), cantidad integer default 12)
returns table (id text, nombre text, edicion text, tipo text, similitud real, estado text, limite smallint)
language sql
stable
security invoker
set search_path = public, extensions
as $$
  select c.id, c.nombre, e.nombre, c.tipo, (1 - (h.vector <=> consulta))::real, l.estado, l.limite
  from (
    select carta_id, vector from public.huellas
    order by vector <=> consulta
    limit least(greatest(cantidad, 1), 50)
  ) h
  join public.cartas c on c.id = h.carta_id
  left join public.ediciones e on e.id = c.edicion_id
  join public.legalidad l on l.id = c.id
  order by h.vector <=> consulta;
$$;

alter table public.ediciones enable row level security;
alter table public.cartas enable row level security;
alter table public.huellas enable row level security;
alter table public.banlist enable row level security;
alter table public.temporada_vigente enable row level security;

create policy "lectura publica" on public.ediciones for select to anon, authenticated using (true);
create policy "lectura publica" on public.cartas for select to anon, authenticated using (true);
create policy "lectura publica" on public.huellas for select to anon, authenticated using (true);
create policy "lectura publica" on public.banlist for select to anon, authenticated using (true);
create policy "lectura publica" on public.temporada_vigente for select to anon, authenticated using (true);
