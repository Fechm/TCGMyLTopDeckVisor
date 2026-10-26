# Usuarios propios y Top Deck compartido

Aprobado por Felipe el 2026-10-26.

## Objetivo

Cuentas sin Supabase Auth para guardar la colección en la nube, sincronizarla entre dispositivos y compartir el Top Deck con un enlace secreto de solo lectura.

## Decisiones

- Identidad: usuario + contraseña. Recuperación con código de un solo uso (se entrega al registrarse y se renueva al usarlo) o con 2 preguntas secretas.
- Compartir: enlace secreto revocable y regenerable; sin perfiles públicos.
- Alcance: colección en la nube. Carpetas y mazos quedan fuera.
- Sin datos personales: ni correo ni IP guardada (la IP solo se usa hasheada como llave de límite de intentos).

## Arquitectura

Todo en Postgres. Las tablas viven en el esquema `privado`, que PostgREST no expone y que tiene RLS sin políticas. El sitio solo llama funciones `SECURITY DEFINER` del esquema `public` con `search_path` vacío, ejecutables únicamente por `anon` y `authenticated`.

Tablas: `usuarios`, `sesiones`, `colecciones`, `enlaces`, `intentos`.

Funciones públicas: `registrar`, `entrar`, `salir`, `preguntas_recuperacion`, `recuperar_con_codigo`, `recuperar_con_preguntas`, `mi_coleccion`, `guardar_cartas`, `crear_enlace`, `revocar_enlace`, `ver_compartido`, `borrar_cuenta`.

## Seguridad

- Contraseñas de 8 a 72 caracteres con bcrypt costo 10 (pgcrypto).
- Tokens de sesión de 32 bytes aleatorios; se guarda solo su SHA-256. Vencen tras 30 días sin uso. Recuperar la cuenta cierra todas las sesiones.
- Los fallos de autenticación devuelven `{ok:false}` en vez de lanzar error, para que el contador de intentos no se pierda con el rollback.
- Límites: entrar 5 fallos por usuario cada 15 min; recuperar 3 por usuario por hora; registrar 10 por IP por hora.
- Usuario inexistente responde igual que contraseña incorrecta y gasta el mismo bcrypt; sus preguntas de recuperación son genéricas y estables.
- Respuestas secretas normalizadas (minúsculas, sin tildes ni espacios repetidos) y hasheadas con bcrypt.
- Cabeceras en Pages: `Referrer-Policy: no-referrer` para que el enlace compartido no se filtre, `X-Content-Type-Options` y `frame-ancestors 'none'`.

## Sitio

- `web/cuenta.js`, compartido por el escáner y el Top Deck: sesión, diálogo de entrar/crear/recuperar y sincronización.
- Sin cuenta todo sigue local. Al entrar, la colección local se fusiona con la de la nube tomando la mayor cantidad por carta.
- Con cuenta, los cambios se envían en lote unos segundos después; si falla, quedan en cola en `localStorage`.
- `topdeck.html?c=<enlace>` muestra el Top Deck de otra persona en solo lectura.

## Pruebas

Script contra Postgres 17 local (Docker en WSL) que aplica ambas migraciones y recorre registro, bloqueo por intentos, recuperación por código y por preguntas, colección, enlace y revocación, y verifica que `anon` no lee las tablas privadas. Después, prueba en el navegador contra producción con un usuario que se borra al final.
