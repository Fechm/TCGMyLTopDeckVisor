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
- **Etapa 2 (2026-10-29): lista.** El motor quedó en tres módulos: `web/duelo/nucleo.js` (zonas, Fuerza, palabras clave, quién conserva su habilidad, continuas, efectos con duración, disparo de habilidades), `web/duelo/efectos.js` (intérprete de pasos con elecciones pendientes en `e.pendiente`, que se responden con `{ tipo: "elegir", i }`) y `web/duelo/motor.js` (flujo del turno, pila con ventana de respuesta para Anular, habilidades activadas, combate). `web/duelo/cartas.js` tiene las 60 cartas distintas como datos (disparadas, activadas, continuas, `portador` para armas, `respuesta` para Anular), con funciones solo donde el formato no alcanza (`fns`). Hay 219 pruebas (`node --test pruebas/*.test.mjs`): las 18 del motor y una o más por carta, en `pruebas/cartas-{a,b,c}.test.mjs`. El autojuego da 500/500 con ganador, sin errores ni bucles (Dragón 285 y Caballero 215, ~22 turnos, ~165 s). Simplificaciones vigentes: los objetivos se eligen al resolver y no al jugar; «ordena el resto» no se modela; Padre Dagón elige una sola carta oponente y su prevención no está; Regresa Lucy solo tiene el modo Destruir; no están cancelar habilidades (Huitzilin, Signo Amarillo), el impuesto de Abadía por mirar, el cambio de portador de Pedrenyal, el coste extra de Zweihander en ataque, la repetición de Llamada Sombría ni la condición «Aliado Anulado» de Biblioteca; «Baraja y/o Destierra» se resuelve todo de una forma; Valefor convertido en Oro Azi vuelve a la Defensa en tu próximo turno; Templo Gótico baraja una vez por turno, en la Vigilia o en la Fase Final; las habilidades no abren ventana de respuesta (solo las cartas jugadas).
- **Etapa 3 (2026-10-29): lista.** `web/duelo/bot.js` exporta `elegirAccion(estado)`. Usa reglas para el mulligan (se queda con 2 a 5 Oros), el ataque (ataca si ningún bloqueador iguala la Fuerza, si es Imbloqueable o Indestructible, o con todo si el daño es letal), el bloqueo (mata y sobrevive, cambia uno por uno si conviene, bloquea a pérdida solo ante daño letal), Anular (solo Talismanes, Tótems o cartas de coste 2 o más; la respuesta más barata) y el descarte. Para jugar cartas, usar habilidades y resolver elecciones simula cada opción y compara una evaluación del estado (Castillo, Fuerza en juego, Oros, Tótems, mano). 12 pruebas en `pruebas/duelo-bot.test.mjs` (231 en total). Autojuego: `node scripts/duelo-autojuego.mjs [n] [heuristico|azar] [heuristico|azar]`. Contra el bot al azar gana 40/40 con Dragón y 32/40 con Caballero. Bot contra bot: 500/500 con ganador, 0 errores y 0 bucles; Dragón gana 417 y Caballero 83; ~9 turnos por partida y ~3 s por partida en Node (~25 ms por decisión).
- **Ajuste del bot (2026-10-29).** El bot simula el combate hasta el fin del turno, con los bloqueos que haría el rival, para elegir atacantes (agrega de a uno o ataca con todo) y bloqueos. Cuando lo obligan a atacar, elige el atacante que menos pierde. Valora tener Oro para una carta de Anular. Las elecciones solo se simulan a un nivel, así que una decisión toma ~23 ms en promedio y como máximo ~0,4 s. Con `configurar({ simAtaque, simBloqueo, pesos })` se activa o desactiva cada parte. Medido contra el bot anterior con las mismas semillas: con Dragón sube de ~83 % a 55/60; con Caballero queda igual (11/60 contra 10/60). Un término de «amenaza» (daño que puede recibir el próximo turno) bajó a Caballero a 6/60 y quedó con peso 0. El techo de Caballero es el emparejamiento y no las decisiones: Dragón acelera Oro, convierte cartas rivales en Oro propio y Cráneo de Cristal obliga a Caballero a atacar con Aliados más chicos. Bot contra bot: 500/500 con ganador, 0 errores; Dragón gana 431 y Caballero 69. Para que la IA con Caballero compita en serio contra Felipe habrá que pasar a búsqueda Monte Carlo (etapa 5) o revisar el mazo.
- **Etapa 4 (2026-10-30): lista.** `web/duelo.html` es la mesa, para teléfono: marcador con Castillos, fase y turno; mesa de la IA arriba (mano en reverso, Oros, Tótems y líneas), registro de jugadas al medio, tu mesa abajo y tu mano fija sobre la barra con los botones de fase. Las cartas que tienen jugadas brillan; al tocarlas se abre la carta grande con sus acciones (jugar, equipar a un Aliado, poner como Oro, usar habilidad, atacar, bloquear, descartar). Las elecciones de las habilidades y la ventana para Anular se abren en una hoja inferior. Las cartas convertidas llevan etiqueta. La IA (Caballero, `bot.js`) juega sola con una pausa de 0,55 s por acción. La partida se guarda en `localStorage` y se retoma al volver. Exige sesión, como el resto, y entró a la barra inferior como cuarta pestaña «Duelo» (`tema.css` pasa a cuatro columnas). Imágenes locales: `miniaturas/<id>.jpg` y `cartas/<id>.jpg`; no usa `foil.js`. Probada en el navegador a 375 px con una partida completa jugada por la interfaz (11 turnos, sin errores).
- **Mesa como tapete (2026-10-30).** La mesa se rehízo a pantalla completa con las zonas reglamentarias espejadas. De la orilla al centro van: mano, Castillo/Cementerio/Destierro como mazos con contador, Reserva de Oro y Oro Pagado (los pagados, girados), Línea de Apoyo, Línea de Defensa y Línea de Ataque. Cada zona va rotulada y tiene color propio. Cada carta es un elemento persistente que se anima al cambiar de zona (técnica FLIP con la Web Animations API): se ve robar del Castillo a la mano, jugar de la mano a la mesa, pasar a la Línea de Ataque y ser destruida hacia el Cementerio. Las cartas que pasan de un mazo a otro (daño, Destierro) vuelan como fantasmas, y el Castillo muestra «−N» y tiembla al recibir daño. La carta que se está jugando aparece grande al centro, la mano va en abanico, el último movimiento de la IA se anuncia al centro y el registro completo está en un botón. Se respeta `prefers-reduced-motion`. Probada a 375 px con una partida completa jugada por la interfaz, sin errores.
- **Elecciones y habilidades legibles (2026-10-30).** Cuando una habilidad deja elegir cartas de ambos lados, la hoja las separa en «De la IA» y «Tuyas», agrupadas por zona. `cartas-base.js` ahora trae el texto oficial (`texto`), que la ficha de cada carta muestra completo. Cada habilidad activada tiene un `texto` propio en `cartas.js`, que aparece en su botón en vez de «Usar habilidad 1/2». White Worm quedó revisada contra el texto oficial, con 4 pruebas más: la conversión solo se usa en tu turno; la de los Cementerios también se usa en el turno rival; no se puede convertir a sí mismo; no toma Aliados protegidos por Hacha Danesa (pero sí el Hacha), y no toma nada con Abu Simbel en juego. 237 pruebas.
