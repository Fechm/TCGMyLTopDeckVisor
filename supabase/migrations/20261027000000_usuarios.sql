create extension if not exists pgcrypto with schema extensions;

create schema if not exists privado;
revoke all on schema privado from public;

create table privado.usuarios (
  id uuid primary key default gen_random_uuid(),
  usuario text not null check (usuario ~ '^[A-Za-z0-9_.-]{3,24}$'),
  hash_clave text not null,
  hash_codigo text not null,
  pregunta1 text not null check (length(pregunta1) between 5 and 120),
  hash_respuesta1 text not null,
  pregunta2 text not null check (length(pregunta2) between 5 and 120),
  hash_respuesta2 text not null,
  creado timestamptz not null default now()
);
create unique index usuarios_usuario_unico on privado.usuarios (lower(usuario));

create table privado.sesiones (
  token_hash bytea primary key,
  usuario_id uuid not null references privado.usuarios (id) on delete cascade,
  creada timestamptz not null default now(),
  ultimo_uso timestamptz not null default now()
);
create index sesiones_usuario on privado.sesiones (usuario_id);

create table privado.colecciones (
  usuario_id uuid not null references privado.usuarios (id) on delete cascade,
  carta_id text not null check (length(carta_id) between 1 and 40),
  cantidad smallint not null check (cantidad between 1 and 999),
  foil smallint not null default 0 check (foil between 0 and cantidad),
  actualizado timestamptz not null default now(),
  primary key (usuario_id, carta_id)
);

create table privado.enlaces (
  usuario_id uuid primary key references privado.usuarios (id) on delete cascade,
  enlace text not null unique,
  creado timestamptz not null default now()
);

create table privado.intentos (
  llave text primary key,
  fallos integer not null default 0,
  desde timestamptz not null default now()
);

alter table privado.usuarios enable row level security;
alter table privado.sesiones enable row level security;
alter table privado.colecciones enable row level security;
alter table privado.enlaces enable row level security;
alter table privado.intentos enable row level security;

create function privado.token() returns text
language sql volatile set search_path = '' as $f$
  select translate(encode(extensions.gen_random_bytes(32), 'base64'), '+/=', '-_')
$f$;

create function privado.hash_token(p text) returns bytea
language sql immutable set search_path = '' as $f$
  select extensions.digest(coalesce(p, ''), 'sha256')
$f$;

create function privado.normalizar(p text) returns text
language sql immutable set search_path = '' as $f$
  select regexp_replace(
    translate(lower(btrim(coalesce(p, ''))), 'áéíóúüàèìòùâêîôûäëïöñ', 'aeiouuaeiouaeiouaeion'),
    '\s+', ' ', 'g')
$f$;

create function privado.limpiar_codigo(p text) returns text
language sql immutable set search_path = '' as $f$
  select regexp_replace(upper(coalesce(p, '')), '[^A-Z0-9]', '', 'g')
$f$;

create function privado.codigo() returns text
language plpgsql volatile set search_path = '' as $f$
declare
  b bytea := extensions.gen_random_bytes(16);
  alfabeto text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  s text := '';
begin
  for i in 0..15 loop
    s := s || substr(alfabeto, get_byte(b, i) % 32 + 1, 1);
    if i in (3, 7, 11) then s := s || '-'; end if;
  end loop;
  return s;
end
$f$;

create function privado.hash(p text) returns text
language sql volatile set search_path = '' as $f$
  select extensions.crypt(p, extensions.gen_salt('bf', 10))
$f$;

create function privado.coincide(p text, hash text) returns boolean
language sql volatile set search_path = '' as $f$
  select hash is not null and hash = extensions.crypt(coalesce(p, ''), hash)
$f$;

create function privado.llave_ip() returns text
language sql stable set search_path = '' as $f$
  select encode(extensions.digest(coalesce(
    nullif(current_setting('request.headers', true), '')::json ->> 'cf-connecting-ip',
    btrim(split_part(nullif(current_setting('request.headers', true), '')::json ->> 'x-forwarded-for', ',', 1)),
    'sin-ip'), 'sha256'), 'hex')
$f$;

create function privado.espera(p_llave text, p_max integer, p_ventana interval) returns integer
language plpgsql stable set search_path = '' as $f$
declare
  r privado.intentos;
begin
  select * into r from privado.intentos where llave = p_llave;
  if not found or r.desde < now() - p_ventana or r.fallos < p_max then
    return 0;
  end if;
  return greatest(1, ceil(extract(epoch from (r.desde + p_ventana - now())))::integer);
end
$f$;

create function privado.fallo(p_llave text, p_ventana interval) returns void
language sql set search_path = '' as $f$
  insert into privado.intentos as i (llave, fallos, desde) values (p_llave, 1, now())
  on conflict (llave) do update set
    fallos = case when i.desde < now() - p_ventana then 1 else i.fallos + 1 end,
    desde = case when i.desde < now() - p_ventana then now() else i.desde end;
$f$;

create function privado.exito(p_llave text) returns void
language sql set search_path = '' as $f$
  delete from privado.intentos where llave = p_llave;
$f$;

create function privado.nueva_sesion(p_usuario uuid) returns text
language plpgsql set search_path = '' as $f$
declare
  t text := privado.token();
begin
  insert into privado.sesiones (token_hash, usuario_id) values (privado.hash_token(t), p_usuario);
  delete from privado.sesiones where ultimo_uso < now() - interval '30 days';
  delete from privado.intentos where desde < now() - interval '1 day';
  return t;
end
$f$;

create function privado.usuario_de(p_token text) returns uuid
language plpgsql set search_path = '' as $f$
declare
  u uuid;
begin
  update privado.sesiones set ultimo_uso = now()
  where token_hash = privado.hash_token(p_token) and ultimo_uso > now() - interval '30 days'
  returning usuario_id into u;
  if u is null then
    raise exception 'sesion_invalida' using errcode = '28000';
  end if;
  return u;
end
$f$;

create function privado.cartas_de(p_usuario uuid) returns jsonb
language sql stable set search_path = '' as $f$
  select coalesce(jsonb_agg(jsonb_build_object(
    'id', k.carta_id,
    'cantidad', k.cantidad,
    'foil', k.foil,
    'actualizado', k.actualizado,
    'nombre', c.nombre,
    'edicion', e.nombre,
    'tipo', c.tipo,
    'raza', case when c.tipo = 'Aliado' then array_to_string(array_remove(c.razas, 'Sin raza'), '/') else '' end,
    'coste', c.coste,
    'fuerza', c.fuerza,
    'legal', case when l.estado is null then null else jsonb_build_object('estado', l.estado, 'limite', l.limite) end
  ) order by c.nombre, k.carta_id), '[]'::jsonb)
  from privado.colecciones k
  left join public.cartas c on c.id = k.carta_id
  left join public.ediciones e on e.id = c.edicion_id
  left join public.legalidad l on l.id = k.carta_id
  where k.usuario_id = p_usuario
$f$;

create function privado.error(p_error text, p_espera integer default null) returns jsonb
language sql immutable set search_path = '' as $f$
  select jsonb_strip_nulls(jsonb_build_object('ok', false, 'error', p_error, 'espera', p_espera))
$f$;

revoke all on all functions in schema privado from public;

create function public.registrar(
  p_usuario text, p_clave text,
  p_pregunta1 text, p_respuesta1 text,
  p_pregunta2 text, p_respuesta2 text
) returns jsonb
language plpgsql security definer set search_path = '' as $f$
declare
  llave text := 'registrar:' || privado.llave_ip();
  espera integer := privado.espera(llave, 10, interval '1 hour');
  u uuid;
  c text;
begin
  if espera > 0 then return privado.error('bloqueado', espera); end if;
  if coalesce(p_usuario, '') !~ '^[A-Za-z0-9_.-]{3,24}$' then return privado.error('usuario_invalido'); end if;
  if length(coalesce(p_clave, '')) < 8 or octet_length(p_clave) > 72 then return privado.error('clave_invalida'); end if;
  if length(btrim(coalesce(p_pregunta1, ''))) not between 5 and 120
     or length(btrim(coalesce(p_pregunta2, ''))) not between 5 and 120 then
    return privado.error('pregunta_invalida');
  end if;
  if lower(btrim(p_pregunta1)) = lower(btrim(p_pregunta2)) then return privado.error('preguntas_iguales'); end if;
  if length(privado.normalizar(p_respuesta1)) < 2 or length(privado.normalizar(p_respuesta2)) < 2 then
    return privado.error('respuesta_invalida');
  end if;
  if exists (select 1 from privado.usuarios where lower(usuario) = lower(p_usuario)) then
    return privado.error('usuario_ocupado');
  end if;
  c := privado.codigo();
  insert into privado.usuarios (usuario, hash_clave, hash_codigo, pregunta1, hash_respuesta1, pregunta2, hash_respuesta2)
  values (p_usuario, privado.hash(p_clave), privado.hash(privado.limpiar_codigo(c)),
          btrim(p_pregunta1), privado.hash(privado.normalizar(p_respuesta1)),
          btrim(p_pregunta2), privado.hash(privado.normalizar(p_respuesta2)))
  returning id into u;
  perform privado.fallo(llave, interval '1 hour');
  return jsonb_build_object('ok', true, 'token', privado.nueva_sesion(u), 'codigo', c, 'usuario', p_usuario);
exception when unique_violation then
  return privado.error('usuario_ocupado');
end
$f$;

create function public.entrar(p_usuario text, p_clave text) returns jsonb
language plpgsql security definer set search_path = '' as $f$
declare
  llave text := 'entrar:' || lower(coalesce(p_usuario, ''));
  espera integer := privado.espera(llave, 5, interval '15 minutes');
  r privado.usuarios;
begin
  if espera > 0 then return privado.error('bloqueado', espera); end if;
  select * into r from privado.usuarios where lower(usuario) = lower(coalesce(p_usuario, ''));
  if not found then
    perform privado.hash(coalesce(p_clave, ''));
    perform privado.fallo(llave, interval '15 minutes');
    return privado.error('credenciales');
  end if;
  if not privado.coincide(p_clave, r.hash_clave) then
    perform privado.fallo(llave, interval '15 minutes');
    return privado.error('credenciales');
  end if;
  perform privado.exito(llave);
  return jsonb_build_object('ok', true, 'token', privado.nueva_sesion(r.id), 'usuario', r.usuario);
end
$f$;

create function public.salir(p_token text) returns void
language sql security definer set search_path = '' as $f$
  delete from privado.sesiones where token_hash = privado.hash_token(p_token);
$f$;

create function public.preguntas_recuperacion(p_usuario text) returns jsonb
language plpgsql security definer set search_path = '' as $f$
declare
  r privado.usuarios;
  genericas text[] := array[
    '¿Cómo se llamaba tu primera mascota?',
    '¿En qué ciudad naciste?',
    '¿Cuál fue tu primera carta de MyL?',
    '¿Cómo se llamaba tu colegio?',
    '¿Cuál es tu raza favorita?'];
  h integer;
  i integer;
begin
  select * into r from privado.usuarios where lower(usuario) = lower(coalesce(p_usuario, ''));
  if found then
    return jsonb_build_object('pregunta1', r.pregunta1, 'pregunta2', r.pregunta2);
  end if;
  h := hashtext(lower(coalesce(p_usuario, ''))) & 2147483647;
  i := h % 5;
  return jsonb_build_object('pregunta1', genericas[i + 1], 'pregunta2', genericas[(i + 1 + (h / 5) % 4) % 5 + 1]);
end
$f$;

create function public.recuperar_con_codigo(p_usuario text, p_codigo text, p_clave_nueva text) returns jsonb
language plpgsql security definer set search_path = '' as $f$
declare
  llave text := 'recuperar:' || lower(coalesce(p_usuario, ''));
  espera integer := privado.espera(llave, 3, interval '1 hour');
  r privado.usuarios;
  c text;
begin
  if espera > 0 then return privado.error('bloqueado', espera); end if;
  if length(coalesce(p_clave_nueva, '')) < 8 or octet_length(p_clave_nueva) > 72 then return privado.error('clave_invalida'); end if;
  select * into r from privado.usuarios where lower(usuario) = lower(coalesce(p_usuario, ''));
  if not found then
    perform privado.hash(coalesce(p_codigo, ''));
    perform privado.fallo(llave, interval '1 hour');
    return privado.error('credenciales');
  end if;
  if not privado.coincide(privado.limpiar_codigo(p_codigo), r.hash_codigo) then
    perform privado.fallo(llave, interval '1 hour');
    return privado.error('credenciales');
  end if;
  c := privado.codigo();
  update privado.usuarios set hash_clave = privado.hash(p_clave_nueva), hash_codigo = privado.hash(privado.limpiar_codigo(c))
  where id = r.id;
  delete from privado.sesiones where usuario_id = r.id;
  perform privado.exito(llave);
  perform privado.exito('entrar:' || lower(r.usuario));
  return jsonb_build_object('ok', true, 'token', privado.nueva_sesion(r.id), 'codigo', c, 'usuario', r.usuario);
end
$f$;

create function public.recuperar_con_preguntas(p_usuario text, p_respuesta1 text, p_respuesta2 text, p_clave_nueva text) returns jsonb
language plpgsql security definer set search_path = '' as $f$
declare
  llave text := 'recuperar:' || lower(coalesce(p_usuario, ''));
  espera integer := privado.espera(llave, 3, interval '1 hour');
  r privado.usuarios;
  c text;
begin
  if espera > 0 then return privado.error('bloqueado', espera); end if;
  if length(coalesce(p_clave_nueva, '')) < 8 or octet_length(p_clave_nueva) > 72 then return privado.error('clave_invalida'); end if;
  select * into r from privado.usuarios where lower(usuario) = lower(coalesce(p_usuario, ''));
  if not found then
    perform privado.hash(coalesce(p_respuesta1, ''));
    perform privado.hash(coalesce(p_respuesta2, ''));
    perform privado.fallo(llave, interval '1 hour');
    return privado.error('credenciales');
  end if;
  if not (privado.coincide(privado.normalizar(p_respuesta1), r.hash_respuesta1)
          and privado.coincide(privado.normalizar(p_respuesta2), r.hash_respuesta2)) then
    perform privado.fallo(llave, interval '1 hour');
    return privado.error('credenciales');
  end if;
  c := privado.codigo();
  update privado.usuarios set hash_clave = privado.hash(p_clave_nueva), hash_codigo = privado.hash(privado.limpiar_codigo(c))
  where id = r.id;
  delete from privado.sesiones where usuario_id = r.id;
  perform privado.exito(llave);
  perform privado.exito('entrar:' || lower(r.usuario));
  return jsonb_build_object('ok', true, 'token', privado.nueva_sesion(r.id), 'codigo', c, 'usuario', r.usuario);
end
$f$;

create function public.mi_coleccion(p_token text) returns jsonb
language plpgsql security definer set search_path = '' as $f$
declare
  u uuid := privado.usuario_de(p_token);
begin
  return jsonb_build_object(
    'usuario', (select usuario from privado.usuarios where id = u),
    'enlace', (select enlace from privado.enlaces where usuario_id = u),
    'cartas', privado.cartas_de(u));
end
$f$;

create function public.guardar_cartas(p_token text, p_cartas jsonb) returns jsonb
language plpgsql security definer set search_path = '' as $f$
declare
  u uuid := privado.usuario_de(p_token);
  total integer;
begin
  if jsonb_typeof(p_cartas) is distinct from 'array' or jsonb_array_length(p_cartas) > 500 then
    raise exception 'lote_invalido' using errcode = '22023';
  end if;
  with entrada as (
    select distinct on (e.v ->> 'id')
           e.v ->> 'id' as carta_id,
           least(greatest(coalesce((e.v ->> 'cantidad')::integer, 0), 0), 999) as cantidad,
           greatest(coalesce((e.v ->> 'foil')::integer, 0), 0) as foil
    from jsonb_array_elements(p_cartas) with ordinality as e(v, orden)
    where length(e.v ->> 'id') between 1 and 40
    order by e.v ->> 'id', e.orden desc
  ), borradas as (
    delete from privado.colecciones k using entrada x
    where k.usuario_id = u and k.carta_id = x.carta_id and x.cantidad = 0
    returning 1
  )
  insert into privado.colecciones (usuario_id, carta_id, cantidad, foil)
  select u, x.carta_id, x.cantidad, least(x.foil, x.cantidad) from entrada x where x.cantidad > 0
  on conflict (usuario_id, carta_id) do update
  set cantidad = excluded.cantidad, foil = excluded.foil, actualizado = now();
  select count(*) into total from privado.colecciones where usuario_id = u;
  if total > 20000 then
    raise exception 'coleccion_llena' using errcode = '54000';
  end if;
  return jsonb_build_object('ok', true, 'distintas', total);
end
$f$;

create function public.crear_enlace(p_token text) returns jsonb
language plpgsql security definer set search_path = '' as $f$
declare
  u uuid := privado.usuario_de(p_token);
  e text := privado.token();
begin
  insert into privado.enlaces (usuario_id, enlace) values (u, e)
  on conflict (usuario_id) do update set enlace = excluded.enlace, creado = now();
  return jsonb_build_object('ok', true, 'enlace', e);
end
$f$;

create function public.revocar_enlace(p_token text) returns jsonb
language plpgsql security definer set search_path = '' as $f$
declare
  u uuid := privado.usuario_de(p_token);
begin
  delete from privado.enlaces where usuario_id = u;
  return jsonb_build_object('ok', true);
end
$f$;

create function public.ver_compartido(p_enlace text) returns jsonb
language plpgsql security definer set search_path = '' as $f$
declare
  u uuid;
begin
  select usuario_id into u from privado.enlaces where enlace = coalesce(p_enlace, '') and length(p_enlace) >= 40;
  if u is null then return null; end if;
  return jsonb_build_object(
    'usuario', (select usuario from privado.usuarios where id = u),
    'cartas', privado.cartas_de(u));
end
$f$;

create function public.borrar_cuenta(p_token text, p_clave text) returns jsonb
language plpgsql security definer set search_path = '' as $f$
declare
  u uuid := privado.usuario_de(p_token);
  r privado.usuarios;
  llave text;
begin
  select * into r from privado.usuarios where id = u;
  llave := 'entrar:' || lower(r.usuario);
  if privado.espera(llave, 5, interval '15 minutes') > 0 then return privado.error('bloqueado'); end if;
  if not privado.coincide(p_clave, r.hash_clave) then
    perform privado.fallo(llave, interval '15 minutes');
    return privado.error('credenciales');
  end if;
  delete from privado.usuarios where id = u;
  return jsonb_build_object('ok', true);
end
$f$;

revoke all on function
  public.registrar(text, text, text, text, text, text),
  public.entrar(text, text),
  public.salir(text),
  public.preguntas_recuperacion(text),
  public.recuperar_con_codigo(text, text, text),
  public.recuperar_con_preguntas(text, text, text, text),
  public.mi_coleccion(text),
  public.guardar_cartas(text, jsonb),
  public.crear_enlace(text),
  public.revocar_enlace(text),
  public.ver_compartido(text),
  public.borrar_cuenta(text, text)
from public;

grant execute on function
  public.registrar(text, text, text, text, text, text),
  public.entrar(text, text),
  public.salir(text),
  public.preguntas_recuperacion(text),
  public.recuperar_con_codigo(text, text, text),
  public.recuperar_con_preguntas(text, text, text, text),
  public.mi_coleccion(text),
  public.guardar_cartas(text, jsonb),
  public.crear_enlace(text),
  public.revocar_enlace(text),
  public.ver_compartido(text),
  public.borrar_cuenta(text, text)
to anon, authenticated;
