\set ON_ERROR_STOP on
set role anon;

do $t$
declare
  r jsonb;
  token text;
  codigo text;
  enlace text;
  i integer;
begin
  r := public.registrar('prueba_1', 'clave-segura-1', '¿Cómo se llamaba tu perro?', 'Fído', '¿Ciudad favorita?', 'Chillán');
  assert (r ->> 'ok')::boolean, 'registro: ' || r::text;
  token := r ->> 'token';
  codigo := r ->> 'codigo';
  assert codigo ~ '^[A-Z2-9]{4}-[A-Z2-9]{4}-[A-Z2-9]{4}-[A-Z2-9]{4}$', 'formato del código: ' || codigo;

  assert public.registrar('PRUEBA_1', 'otra-clave-1', 'Pregunta uno', 'aa', 'Pregunta dos', 'bb') ->> 'error' = 'usuario_ocupado', 'usuario repetido sin distinguir mayúsculas';
  assert public.registrar('x', 'clave-segura-1', 'Pregunta uno', 'aa', 'Pregunta dos', 'bb') ->> 'error' = 'usuario_invalido', 'usuario corto';
  assert public.registrar('prueba_2', 'corta', 'Pregunta uno', 'aa', 'Pregunta dos', 'bb') ->> 'error' = 'clave_invalida', 'clave corta';
  assert public.registrar('prueba_2', 'clave-segura-2', 'Pregunta uno', 'aa', 'pregunta UNO', 'bb') ->> 'error' = 'preguntas_iguales', 'preguntas iguales';

  r := public.guardar_cartas(token, '[{"id":"178_091","cantidad":3,"foil":1},{"id":"160_382","cantidad":2},{"id":"160_382","cantidad":1,"foil":5}]');
  assert (r ->> 'distintas')::integer = 2, 'guardar: ' || r::text;
  r := public.mi_coleccion(token);
  assert r ->> 'usuario' = 'prueba_1', 'usuario en colección';
  assert jsonb_array_length(r -> 'cartas') = 2, 'dos cartas';
  assert (select (c ->> 'foil')::integer from jsonb_array_elements(r -> 'cartas') c where c ->> 'id' = '160_382') = 1, 'foil limitado a la cantidad y gana el último duplicado';
  perform public.guardar_cartas(token, '[{"id":"160_382","cantidad":0}]');
  assert jsonb_array_length(public.mi_coleccion(token) -> 'cartas') = 1, 'cantidad 0 borra';

  assert public.ver_compartido('inexistente') is null, 'enlace inexistente';
  enlace := public.crear_enlace(token) ->> 'enlace';
  assert length(enlace) = 43, 'largo del enlace: ' || enlace;
  r := public.ver_compartido(enlace);
  assert r ->> 'usuario' = 'prueba_1' and jsonb_array_length(r -> 'cartas') = 1, 'ver compartido: ' || r::text;
  assert not (r ? 'enlace'), 'lo compartido no expone el enlace';
  assert public.mi_coleccion(token) ->> 'enlace' = enlace, 'mi colección muestra el enlace';
  perform public.crear_enlace(token);
  assert public.ver_compartido(enlace) is null, 'regenerar invalida el enlace anterior';
  perform public.revocar_enlace(token);
  assert public.mi_coleccion(token) ->> 'enlace' is null, 'revocar';

  for i in 1..5 loop
    assert public.entrar('prueba_1', 'incorrecta') ->> 'error' = 'credenciales', 'fallo ' || i;
  end loop;
  r := public.entrar('prueba_1', 'clave-segura-1');
  assert r ->> 'error' = 'bloqueado' and (r ->> 'espera')::integer > 0, 'bloqueo tras 5 fallos: ' || r::text;
  assert public.entrar('no_existe', 'loquesea1') ->> 'error' = 'credenciales', 'usuario inexistente responde igual';

  r := public.preguntas_recuperacion('prueba_1');
  assert r ->> 'pregunta1' = '¿Cómo se llamaba tu perro?', 'preguntas reales';
  r := public.preguntas_recuperacion('no_existe');
  assert r ->> 'pregunta1' <> r ->> 'pregunta2', 'preguntas genéricas distintas';
  assert public.preguntas_recuperacion('no_existe') = r, 'preguntas genéricas estables';

  assert public.recuperar_con_preguntas('prueba_1', 'fido', 'otra', 'nueva-clave-1') ->> 'error' = 'credenciales', 'una respuesta mala';
  r := public.recuperar_con_preguntas('prueba_1', '  FÍDO ', 'chillan', 'nueva-clave-1');
  assert (r ->> 'ok')::boolean, 'recuperar con preguntas normalizadas: ' || r::text;
  assert r ->> 'codigo' <> codigo, 'código nuevo al recuperar';
  begin
    perform public.mi_coleccion(token);
    assert false, 'la sesión vieja debía morir';
  exception when sqlstate '28000' then null;
  end;
  token := r ->> 'token';
  assert public.entrar('prueba_1', 'nueva-clave-1') ->> 'ok' = 'true', 'el bloqueo se limpia al recuperar';

  assert public.recuperar_con_codigo('prueba_1', codigo, 'otra-clave-12') ->> 'error' = 'credenciales', 'el código viejo ya no sirve';
  codigo := r ->> 'codigo';
  r := public.recuperar_con_codigo('prueba_1', lower(replace(codigo, '-', '')), 'otra-clave-12');
  assert (r ->> 'ok')::boolean, 'recuperar con código sin guiones: ' || r::text;
  for i in 1..3 loop
    assert public.recuperar_con_codigo('prueba_1', 'AAAA-AAAA-AAAA-AAAA', 'otra-clave-13') ->> 'error' = 'credenciales', 'código malo ' || i;
  end loop;
  r := public.recuperar_con_preguntas('prueba_1', 'fido', 'chillan', 'otra-clave-13');
  assert r ->> 'error' = 'bloqueado', 'tras 3 fallos de recuperación se bloquea incluso con respuestas correctas: ' || r::text;

  token := public.entrar('prueba_1', 'otra-clave-12') ->> 'token';
  perform public.salir(token);
  begin
    perform public.mi_coleccion(token);
    assert false, 'salir debía cerrar la sesión';
  exception when sqlstate '28000' then null;
  end;

  token := public.entrar('prueba_1', 'otra-clave-12') ->> 'token';
  assert public.borrar_cuenta(token, 'mala') ->> 'error' = 'credenciales', 'borrar exige clave';
  assert (public.borrar_cuenta(token, 'otra-clave-12') ->> 'ok')::boolean, 'borrar cuenta';
  assert public.entrar('prueba_1', 'otra-clave-12') ->> 'error' = 'credenciales', 'cuenta borrada';

  for i in 1..9 loop
    assert (public.registrar('masivo_' || i, 'clave-segura-1', 'Pregunta uno', 'aa', 'Pregunta dos', 'bb') ->> 'ok')::boolean, 'registro masivo ' || i;
  end loop;
  assert public.registrar('masivo_10', 'clave-segura-1', 'Pregunta uno', 'aa', 'Pregunta dos', 'bb') ->> 'error' = 'bloqueado', 'límite de registros por IP';
end
$t$;

do $t$
begin
  begin
    perform 1 from privado.usuarios;
    assert false, 'anon no debe leer privado.usuarios';
  exception when insufficient_privilege then null;
  end;
  begin
    perform privado.token();
    assert false, 'anon no debe ejecutar funciones privadas';
  exception when insufficient_privilege then null;
  end;
end
$t$;

reset role;
select 'usuarios: todas las pruebas pasaron' as resultado;
