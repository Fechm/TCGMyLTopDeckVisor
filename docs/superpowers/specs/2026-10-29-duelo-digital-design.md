# Modo Duelo: MyL digital contra una IA local

Aprobado por Felipe el 2026-10-29. Esta spec es el punto de partida de una sesión nueva; no hace falta el historial anterior.

## Objetivo

Jugar una partida completa de Mitos y Leyendas, formato Imperio Racial, **toda en digital** dentro de la app (`web/`), Felipe contra una IA que corre en el navegador. Sin llamadas a Claude ni a ningún servidor durante la partida: costo cero por jugar.

## Alcance de la versión 1

- Dos mazos fijos, los de Felipe:
  - **Dragón** (lo juega Felipe): `datos/meta/mazo-felipe.json`.
  - **Caballero** (lo juega la IA): `datos/meta/mazo-basico-caballero.json`.
  - `datos/` está en `.gitignore`; las listas están solo en este equipo. Las dos listas también van al final de este documento.
- Unas 70 cartas distintas en total. Solo esas tienen que funcionar.
- Bot de etapa 1: heurísticas simples (jugar lo más fuerte que pueda pagar, atacar si conviene, bloquear para no perder). Las etapas 2 (búsqueda Monte Carlo con determinización) y 3 (red entrenada por self-play y exportada a ONNX, que la app ya sabe correr con onnxruntime-web) quedan para después.
- Fuera de alcance: multijugador en línea, otros mazos, mazo de soporte, reconocimiento por cámara durante el duelo.

## Reglas

Fuente de verdad: `reglas/dar.txt` (DAR de Imperio, abril 2026). Lo mínimo que el motor necesita:

- Zonas: Castillo (mazo), Mano, Reserva de Oro, Oro Pagado, Línea de Defensa, Línea de Ataque, Línea de Apoyo, Cementerio, Destierro.
- Inicio (§4.2-4.3): cada jugador pone un Oro sin habilidad o con «Oro Inicial» en su Reserva y roba 8. Mulligan: cambiar la mano robando una carta menos; una vez por partida, mostrando una mano con 0 o 1 Oro, se cambia sin perder cartas.
- Fases del turno (desde la línea ~250 del DAR): Agrupación (los Oros Pagados vuelven a la Reserva), Vigilia (se puede poner un Oro de la mano en la Reserva; jugar cartas y habilidades), Guerra de Talismanes, Asignación de bloqueadores, Guerra de Talismanes, Resolución del combate, Fase Final. Quien comienza se salta la Agrupación del primer turno y no roba en su primer turno.
- El daño al Castillo bota cartas del tope del Castillo al Cementerio. Pierde quien no tiene cartas en el Castillo cuando debe robar o botar.
- Armas: cada Aliado porta una salvo que algo diga lo contrario (Patrulla Nocturna, Vieja Snaphance).
- Costes: las reducciones dejan el coste en 1 como mínimo salvo que la carta diga otra cosa.

Cuando una regla no esté clara, leer el DAR y la sección §7 (habilidades, duración, legalidad) antes de inventar.

## Arquitectura

Todo en JavaScript, sin dependencias nuevas, en módulos ES que corran igual en el navegador y en Node:

- `web/duelo/motor.js`: estado inmutable de la partida y función `aplicar(estado, accion) → estado`. Genera las acciones legales (`accionesLegales(estado)`). Determinista dada una semilla de azar.
- `web/duelo/cartas.js`: las 70 cartas como **datos** en un formato pequeño de efectos (disparador + condición + efecto). Ejemplo: `{ id, nombre, tipo, coste, fuerza, raza, efectos: [{ cuando: "entra", hacer: [{ robar: 2 }] }] }`. Las habilidades raras que no quepan en el formato se escriben como funciones, marcadas como tales.
- `web/duelo/bot.js`: elige una acción a partir de `accionesLegales`.
- `web/duelo.html`: la mesa. Mano abajo, mesa al medio, mesa del rival arriba, registro de jugadas, botones de fase. Usa el tema grimorio (`web/tema.css`), las imágenes de `img/220|400|hd/<id>.webp` y el foil de `foil.js`. Entra a la barra inferior como cuarta pestaña «Duelo» (también exige sesión, como el resto).
- `scripts/duelo-autojuego.mjs`: en Node, hace jugar al bot contra sí mismo N partidas y resume ganadores, duración y errores. Es la prueba principal y no gasta tokens.

Textos y datos de las cartas: tabla `cartas` en Supabase (lectura pública con la publishable key que ya está en `web/index.html`), por id.

## Pruebas

- Pruebas unitarias del motor con `node --test`: fases, pago de oro, combate, daño y derrota, y una prueba por cada carta con efecto.
- Autojuego: 500 partidas bot contra bot sin errores ni bucles, cada una con un ganador.
- Al final de cada etapa, una sola revisión visual en el navegador, tamaño teléfono.

## Cómo trabajar para gastar poco

- Usar una conversación nueva por etapa y partir leyendo esta spec, no historiales.
- Transcribir las cartas al formato en tandas de 10 a 15, idealmente con Sonnet. Opus solo para el diseño del motor y las reglas difíciles.
- Correr pruebas y autojuego en local y leer solo el resumen.
- Pocas capturas de pantalla.

## Convenciones del repo

- Rama `master`; commit y push a master están autorizados en este repo. Mensajes en inglés, `feat:`/`fix:`/`docs:`, cortos y con la línea `Co-Authored-By` que indique la sesión.
- Nada de comentarios dentro del código; las razones van en esta spec o en el plan.
- El sitio se publica solo en Cloudflare Pages al hacer push (salida `web/`).

## Listas de los mazos

**Dragón (50)**
- **Aliados:** 3 Jabberwocky, 2 Padre Dagon, 2 Balaur, 2 Daikaiju Furioso, 1 Mecha-Daikaiju, 2 El Dracul, 1 White Worm, 1 Valefor, 1 Draco Conjurador, 1 Gusano Rojo.
- **Armas:** 2 Martillo Sacro, 1 Espada Vikinga.
- **Tótems:** 2 Carcosa, 2 Templo Gótico, 1 Abadía de Carfax.
- **Talismanes:** Dragón Dorado, Ciempiés-SP, Visión Heróica, Malocchio, Caminar el Tablón, 2 Efigie, Guillatún, Cuervo Nocturno, Murciélagos del Caos, 2 Señal de la Bestia, Regresa Lucy.
- **Oros:** 1 Cráneo de Cristal (Oro Inicial), 1 Hem Hem Real, 2 Signo Amarillo, 2 Don de Amma, 2 Drácula, Aegishjalmur, Agua Sagrada, Tetramorfo, Huitzilin, Abu Simbel.

**Caballero (50)**
- **Aliados:** 3 Patrulla Nocturna, Sir Peter Hawkins, Guardia Real, Sir Galahad, Sir Persival, Jaques de Molay.
- **Armas:** 3 Zweihander Brutal, 3 Vieja Snaphance, 2 Pedrenyal, Hacha Danesa, Martillo Sacro.
- **Tótems:** 2 Isla de Poveglia, Templo Gótico, Carcosa, Fortaleza Hoshi.
- **Talismanes:** Llamada Sombría, Caminar el Tablón, Dragón Dorado, 2 Efigie, Toque Helado, Llamar a la Manada, Hija del Caos, Aaru, Murciélagos del Caos, 2 Gusano Vampiro, Señal de la Bestia.
- **Oros:** Biblioteca de Caballería (Oro Inicial), 3 Agua Sagrada, 2 Cráneo de Cristal, 2 Hem Hem Real, Tyet, Relicario de San Pancracio, Nocturlabio de Liull, Onsen, Was, Huitzilin.

## Etapas

1. Motor base (zonas, fases, oro, combate, derrota) con cartas sin habilidad, más pruebas y autojuego.
2. Las 70 cartas en el formato de efectos, en tandas, con una prueba por carta.
3. Bot de etapa 1 y autojuego de 500 partidas sin errores.
4. Mesa en `web/duelo.html` y pestaña «Duelo».
5. Después: bot Monte Carlo y, si hace falta, red por self-play.

## Estado

- **Etapa 1 (2026-10-29): lista.** `web/duelo/motor.js` + `web/duelo/cartas-base.js` (generado con `node scripts/duelo-cartas-base.mjs`, toma la edición IMP más reciente de cada nombre), 18 pruebas en `node --test pruebas/*.test.mjs` y `node scripts/duelo-autojuego.mjs 500` con bot al azar: 500/500 con ganador, 0 errores, 0 bucles, ~37 turnos por partida (Dragón 470, Caballero 30: sin habilidades las armas suman 0 y los aliados Caballero son más chicos). Reglas dudosas, resueltas así por ahora: (1) se pierde apenas el Castillo llega a 0 (DAR §2.1), no recién al intentar robar o botar; (2) las armas solo se juegan en aliados propios; (3) el pago toma Oros cualquiera de la Reserva (hasta que haya Oros con habilidad que importen); (4) el mulligan normal se permite mientras la mano tenga más de 1 carta; (5) la fuerza de las armas viene del texto de habilidad y queda en 0 hasta la etapa 2; (6) Tótems y Talismanes se pagan y no hacen nada; (7) quien empieza se sortea con la semilla, sin elegir.
