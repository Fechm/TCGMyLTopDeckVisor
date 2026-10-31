import { test } from "node:test";
import assert from "node:assert/strict";
import { mesa, poner, oros, aplicar, accionesLegales, sinRespuesta, zonaDe, id, N } from "./ayuda-duelo.mjs";
import { OPS, cumple, disponibles } from "../web/duelo/efectos.js";

function con(e, nombre, extra) {
  const k = id(nombre);
  e.catalogo = { ...e.catalogo, [k]: { ...e.catalogo[k], ...extra } };
  return e;
}

function resolverTodo(e) {
  for (let i = 0; i < 20 && (e.pendiente || (e.pila.length && !e.pila.at(-1).cerrada)); i++) {
    e = e.pendiente ? aplicar(e, { tipo: "elegir", i: 0 }) : aplicar(e, { tipo: "noResponder" });
  }
  return e;
}

const ctxDe = (e, uid, j = 0) => ({ ctrl: j, fuente: uid, def: e.instancias[uid], costeFuente: N.carta(e, uid).coste ?? 0, vars: {} });

test("mecánica: proteccion inmune según el tipo de la fuente oponente", () => {
  const e = con(mesa(), "Sir Galahad", { continuas: [{ proteccion: { por: "Talismán" }, a: "propia" }] });
  const galahad = poner(e, 1, "defensa", "Sir Galahad");
  const danza = poner(e, 0, "mano", "Danza del Cuchillo");
  const balaur = poner(e, 0, "defensa", "Balaur");
  assert.equal(cumple(e, ctxDe(e, danza), galahad, {}, "destruir"), false);
  assert.equal(cumple(e, ctxDe(e, balaur), galahad, {}, "destruir"), true);
  assert.equal(cumple(e, ctxDe(e, galahad, 1), galahad, {}, "destruir"), true);
});

test("mecánica: proteccion con coste hace pagar Oros al oponente que la afecta", () => {
  let e = con(mesa(), "Sir Galahad", { continuas: [{ proteccion: { cuesta: 1 }, a: "propia" }] });
  const galahad = poner(e, 1, "defensa", "Sir Galahad");
  const danza = poner(e, 0, "mano", "Danza del Cuchillo");
  oros(e, 0, 2);
  assert.equal(cumple(e, ctxDe(e, danza), galahad, {}, "destruir"), true);
  e.jugadores[0].reserva = [];
  assert.equal(cumple(e, ctxDe(e, danza), galahad, {}, "destruir"), false);
  oros(e, 0, 3);
  e = resolverTodo(aplicar(e, { tipo: "jugar", uid: danza }));
  assert.equal(zonaDe(e, galahad), "cementerio");
  assert.equal(e.jugadores[0].reserva.length, 0);
});

test("mecánica: NoConvertible impide convertir la carta", () => {
  const e = con(mesa(), "Balaur", { claves: ["NoConvertible", "Indestructible"] });
  const balaur = poner(e, 1, "defensa", "Balaur");
  OPS.convertir(e, { var: "x", en: "Oro", a: "reserva" }, { ctx: { ctrl: 0, vars: { x: [balaur] } } });
  assert.equal(zonaDe(e, balaur), "defensa");
});

test("mecánica: Anular con la habilidad activada de una carta en juego", () => {
  let e = con(mesa(), "Sir Galahad", { activadas: [{ texto: "Anular un Aliado", respuesta: { anula: { tipo: "Aliado" } }, oros: 1, momento: "cualquiera" }] });
  const galahad = poner(e, 1, "defensa", "Sir Galahad");
  oros(e, 1, 1);
  oros(e, 0, 3);
  const balaur = poner(e, 0, "mano", "Balaur");
  e = aplicar(e, { tipo: "jugar", uid: balaur });
  const r = accionesLegales(e).find((a) => a.tipo === "responder" && a.uid === galahad);
  assert.deepEqual(r, { tipo: "responder", uid: galahad, def: id("Sir Galahad"), h: 0 });
  e = resolverTodo(aplicar(e, r));
  assert.equal(zonaDe(e, balaur), "cementerio");
  assert.equal(e.jugadores[1].pagado.length, 1);
});

test("mecánica: noAnulables protege cartas propias y noAnulableSi evalúa una condición", () => {
  let e = con(mesa(), "Sir Galahad", { continuas: [{ noAnulables: { tipoCarta: "Aliado" } }] });
  poner(e, 0, "defensa", "Sir Galahad");
  oros(e, 0, 3);
  oros(e, 1, 5);
  poner(e, 1, "mano", "Dragón Dorado");
  const balaur = poner(e, 0, "mano", "Balaur");
  e = aplicar(e, { tipo: "jugar", uid: balaur });
  assert.equal(accionesLegales(e).some((a) => a.tipo === "responder"), false);
  let f = con(mesa(), "Balaur", { noAnulableSi: "siempre", fns: { ...mesa().catalogo[id("Balaur")].fns, siempre: () => true } });
  oros(f, 0, 3);
  oros(f, 1, 5);
  poner(f, 1, "mano", "Dragón Dorado");
  const otro = poner(f, 0, "mano", "Balaur");
  f = aplicar(f, { tipo: "jugar", uid: otro });
  assert.equal(accionesLegales(f).some((a) => a.tipo === "responder"), false);
});

test("mecánica: impuesto por efecto e impuestoRival solo encarecen al oponente", () => {
  const e = mesa();
  oros(e, 0, 3);
  const balaur = poner(e, 0, "mano", "Balaur");
  N.agregarEfecto(e, { tipo: "impuesto", j: 0, tipoCarta: "Aliado", n: 1, fin: "turno" }, 1);
  assert.equal(accionesLegales(e).some((a) => a.tipo === "jugar" && a.uid === balaur), false);
  const f = con(mesa(), "Sir Galahad", { continuas: [{ impuestoRival: { tipoCarta: "Aliado", n: 1 } }] });
  oros(f, 0, 3);
  oros(f, 1, 3);
  poner(f, 1, "defensa", "Sir Galahad");
  const b2 = poner(f, 0, "mano", "Balaur");
  assert.equal(accionesLegales(f).some((a) => a.tipo === "jugar" && a.uid === b2), false);
  f.activo = 1;
  const b3 = poner(f, 1, "mano", "Balaur");
  assert.equal(accionesLegales(f).some((a) => a.tipo === "jugar" && a.uid === b3), true);
});

test("mecánica: impuestoHabilidad por efecto", () => {
  const e = mesa();
  const balaur = poner(e, 0, "defensa", "Balaur");
  N.agregarEfecto(e, { tipo: "impuestoHabilidad", j: 0, n: 1, fin: "turno" }, 1);
  assert.equal(N.impuestoHabilidad(e, 0, balaur, "activada"), 1);
  assert.equal(N.impuestoHabilidad(e, 1, balaur, "activada"), 0);
});

test("mecánica: gana clave con tipoObjetivo y conArma, y pierde clave", () => {
  const e = con(mesa(), "Sir Galahad", {
    continuas: [
      { gana: "Indesterrable", tipoObjetivo: "Oro", a: "tusAliados" },
      { gana: "Imbloqueable", a: "tusAliados", conArma: true },
      { pierde: "Indestructible", a: "aliadosRival" },
    ],
  });
  poner(e, 0, "apoyo", "Sir Galahad");
  const [oro] = oros(e, 0, 1);
  const armado = poner(e, 0, "defensa", "Balaur");
  const desnudo = poner(e, 0, "defensa", "Balaur");
  poner(e, 0, "arma", "Espada Vikinga", { portador: armado });
  const rival = poner(e, 1, "defensa", "Balaur");
  assert.equal(N.tiene(e, oro, "Indesterrable"), true);
  assert.equal(N.tiene(e, armado, "Imbloqueable"), true);
  assert.equal(N.tiene(e, desnudo, "Imbloqueable"), false);
  assert.equal(N.tiene(e, rival, "Indestructible"), false);
});

test("mecánica: noPierden protege la habilidad con filtro", () => {
  const e = con(mesa(), "Sir Galahad", { continuas: [{ noPierden: true, a: "tusAliados", raza: "Dragón" }] });
  poner(e, 0, "apoyo", "Sir Galahad");
  const balaur = poner(e, 0, "defensa", "Balaur");
  N.agregarEfecto(e, { tipo: "pierdeHabilidad", uid: balaur, fin: "turno" }, 1);
  assert.equal(N.activa(e, balaur), true);
});

test("mecánica: continuas desde el Cementerio y zonaSinHabilidad", () => {
  const e = con(mesa(), "Sir Galahad", { continuas: [{ zona: "cementerio", fuerza: 2, a: "tusAliados" }] });
  const balaur = poner(e, 0, "defensa", "Balaur");
  const base = N.fuerza(e, balaur);
  poner(e, 0, "cementerio", "Sir Galahad");
  assert.equal(N.fuerza(e, balaur), base + 2);
  N.agregarEfecto(e, { tipo: "zonaSinHabilidad", zona: "cementerio", fin: "turno" }, 1);
  assert.equal(N.fuerza(e, balaur), base);
});

test("mecánica: silenciaDisparos impide disparar a los Aliados oponentes", () => {
  let e = con(mesa(), "Sir Galahad", { continuas: [{ silenciaDisparos: { rival: true, tipoCarta: "Aliado" } }] });
  poner(e, 1, "apoyo", "Sir Galahad");
  oros(e, 0, 3);
  const mecha = poner(e, 0, "mano", "Mecha-Daikaiju");
  e = resolverTodo(aplicar(e, { tipo: "jugar", uid: mecha }));
  assert.equal(zonaDe(e, mecha), "defensa");
  assert.equal(e.jugadores[0].mano.length, 0);
});

test("mecánica: un Aliado con momento comienzoBloqueo entra al comienzo del Bloqueo", () => {
  let e = con(mesa(), "Sir Galahad", { momentos: ["comienzoBloqueo"] });
  oros(e, 1, 5);
  const galahad = poner(e, 1, "mano", "Sir Galahad");
  const balaur = poner(e, 0, "defensa", "Balaur");
  e = aplicar(e, { tipo: "batalla" });
  e = aplicar(e, { tipo: "atacar", uid: balaur });
  e = aplicar(e, { tipo: "finAtaque" });
  assert.equal(e.fase, "momento");
  e = aplicar(e, { tipo: "pasarMomento" });
  e = resolverTodo(aplicar(e, { tipo: "jugar", uid: galahad }));
  assert.equal(zonaDe(e, galahad), "defensa");
  e = aplicar(e, { tipo: "pasarMomento" });
  e = aplicar(e, { tipo: "pasarMomento" });
  assert.equal(e.fase, "bloqueo");
  assert.ok(accionesLegales(e).some((a) => a.tipo === "bloquear" && a.uid === galahad));
});

test("mecánica: Oro generado restringido por coste mínimo y raza", () => {
  const e = mesa();
  OPS.generar(e, { n: 1, tipos: ["Aliado"], costeMin: 3, raza: "Dragón" }, { ctx: { ctrl: 0, vars: {} } });
  assert.equal(disponibles(e, 0, { tipo: "Aliado", coste: 2, razas: ["Dragón"] }), 0);
  assert.equal(disponibles(e, 0, { tipo: "Aliado", coste: 3, razas: ["Caballero"] }), 0);
  assert.equal(disponibles(e, 0, { tipo: "Aliado", coste: 3, razas: ["Dragón"] }), 1);
});

test("mecánica: un Arma dispara su salida cuando cae junto con su portador", () => {
  let e = con(mesa(), "Espada Vikinga", { disparadas: [{ cuando: ["sale"], hacer: [{ op: "robar", n: 2, quien: "yo" }] }] });
  const balaur = poner(e, 0, "defensa", "Sir Galahad");
  const espada = poner(e, 0, "arma", "Espada Vikinga", { portador: balaur });
  N.mover(e, balaur, "cementerio");
  e = resolverTodo(aplicar(e, accionesLegales(e).find((a) => a.tipo === "terminar")));
  assert.equal(zonaDe(e, espada), "cementerio");
  assert.ok(e.jugadores[0].mano.length >= 2);
});

test("mecánica: reduceCoste, noReducir y Única para cartas que no son Oro", () => {
  const e = con(mesa(), "Sir Galahad", { continuas: [{ reduceCoste: { n: 1, tipoCarta: "Aliado", costeMin: 3 } }] });
  poner(e, 0, "apoyo", "Sir Galahad");
  oros(e, 0, 2);
  const balaur = poner(e, 0, "mano", "Balaur");
  const puede = (s) => accionesLegales(s).some((a) => a.tipo === "jugar" && a.uid === balaur);
  assert.equal(puede(e), true);
  N.agregarEfecto(e, { tipo: "noReducir", j: 0, fin: "turno" }, 1);
  assert.equal(puede(e), false);
  const f = con(mesa(), "Balaur", { claves: ["Unica"] });
  oros(f, 0, 5);
  poner(f, 0, "defensa", "Balaur");
  const otro = poner(f, 0, "mano", "Balaur");
  assert.equal(accionesLegales(f).some((a) => a.tipo === "jugar" && a.uid === otro), false);
});

test("mecánica: maxAtacantes y maxBloqueadores", () => {
  let e = mesa();
  const a1 = poner(e, 0, "defensa", "Balaur");
  const a2 = poner(e, 0, "defensa", "Balaur");
  poner(e, 1, "defensa", "Sir Galahad");
  poner(e, 1, "defensa", "Sir Galahad");
  N.agregarEfecto(e, { tipo: "maxAtacantes", j: 0, n: 1, fin: "turno" }, 1);
  N.agregarEfecto(e, { tipo: "maxBloqueadores", j: 1, n: 1, fin: "turno" }, 0);
  e = aplicar(e, { tipo: "batalla" });
  e = aplicar(e, { tipo: "atacar", uid: a1 });
  assert.equal(accionesLegales(e).some((a) => a.tipo === "atacar" && a.uid === a2), false);
  e = aplicar(e, { tipo: "finAtaque" });
  const b = accionesLegales(e).find((a) => a.tipo === "bloquear");
  e = aplicar(e, b);
  assert.equal(accionesLegales(e).some((a) => a.tipo === "bloquear"), false);
});

test("mecánica: bloquear Imbloqueables y evento bloquea", () => {
  let e = con(mesa(), "Sir Galahad", {
    claves: ["BloqueaImbloqueables"],
    disparadas: [{ cuando: ["bloquea"], quien: "propia", hacer: [{ op: "robar", n: 1, quien: "yo" }] }],
  });
  const balaur = poner(e, 0, "defensa", "Balaur");
  N.agregarEfecto(e, { tipo: "gana", uid: balaur, clave: "Imbloqueable", fin: "turno" }, 0);
  const galahad = poner(e, 1, "defensa", "Sir Galahad");
  e = aplicar(e, { tipo: "batalla" });
  e = aplicar(e, { tipo: "atacar", uid: balaur });
  e = aplicar(e, { tipo: "finAtaque" });
  const mano = e.jugadores[1].mano.length;
  e = aplicar(e, { tipo: "bloquear", uid: galahad, atacante: balaur });
  assert.equal(e.jugadores[1].mano.length, mano + 1);
});

test("mecánica: diferir pasos a la Fase Final", () => {
  let e = mesa();
  OPS.diferir(e, { cuando: "faseFinal", pasos: [{ op: "robar", n: 2, quien: "yo" }] }, { ctx: { ctrl: 0, fuente: null, vars: {} } });
  const mano = e.jugadores[0].mano.length;
  e = aplicar(e, { tipo: "terminar" });
  assert.ok(e.jugadores[0].mano.length >= mano + 2);
  assert.equal(e.efectos.some((f) => f.tipo === "diferido"), false);
});

test("mecánica: noGenerar, noSinPagar, talismanesAlDestierro e IndesterrableCementerio", () => {
  const e = mesa();
  N.agregarEfecto(e, { tipo: "noGenerar", j: 0, fin: "turno" }, 1);
  OPS.generar(e, { n: 1 }, { ctx: { ctrl: 0, vars: {} } });
  assert.equal(disponibles(e, 0, "Aliado"), 0);
  const f = con(mesa(), "Sir Galahad", { continuas: [{ talismanesAlDestierro: true }] });
  poner(f, 1, "apoyo", "Sir Galahad");
  const danza = poner(f, 0, "cementerio", "Danza del Cuchillo");
  f.jugadores[0].cementerio = [];
  OPS.finTalisman(f, { uid: danza });
  assert.equal(zonaDe(f, danza), "destierro");
  const g = con(mesa(), "Balaur", { claves: ["IndesterrableCementerio"] });
  const b = poner(g, 0, "cementerio", "Balaur");
  OPS.mover(g, { var: "x", a: "desterrar" }, { ctx: { ctrl: 1, vars: { x: [b] } } });
  assert.equal(zonaDe(g, b), "cementerio");
});

test("mecánica: maxHabilidades limita las habilidades activadas del turno", () => {
  const e = con(mesa(), "Sir Galahad", { activadas: [{ texto: "Robar", momento: "vigilia", hacer: [{ op: "robar", n: 1, quien: "yo" }] }] });
  poner(e, 0, "defensa", "Sir Galahad");
  assert.ok(accionesLegales(e).some((a) => a.tipo === "habilidad"));
  N.agregarEfecto(e, { tipo: "maxHabilidades", j: 0, n: 0, fin: "turno" }, 1);
  assert.equal(accionesLegales(e).some((a) => a.tipo === "habilidad"), false);
});

test("mecánica: habilidades activadas desde el Destierro y robar por efecto dispara roba", () => {
  let e = con(mesa(), "Sir Galahad", {
    activadas: [{ texto: "Robar", zona: "destierro", momento: "vigilia", hacer: [{ op: "robar", n: 1, quien: "yo" }] }],
  });
  e = con(e, "Balaur", { disparadas: [{ cuando: ["roba"], quien: "rival", hacer: [{ op: "robar", n: 1, quien: "yo" }] }] });
  const g = poner(e, 0, "destierro", "Sir Galahad");
  poner(e, 1, "defensa", "Balaur");
  oros(e, 0, 1);
  const accion = accionesLegales(e).find((a) => a.tipo === "habilidad" && a.uid === g);
  assert.ok(accion);
  const rival = e.jugadores[1].mano.length;
  e = resolverTodo(aplicar(e, accion));
  assert.equal(e.jugadores[1].mano.length, rival + 1);
});

test("mecánica: noAgrupa y sinLimiteMano", () => {
  let e = mesa();
  const [oro] = oros(e, 1, 1);
  e.jugadores[1].reserva = [];
  e.jugadores[1].pagado = [oro];
  N.agregarEfecto(e, { tipo: "noAgrupa", uid: oro, j: 1, fin: "juego" }, 0);
  e = aplicar(e, { tipo: "terminar" });
  assert.ok(e.jugadores[1].pagado.includes(oro));
  let f = mesa();
  for (let i = 0; i < 10; i++) poner(f, 0, "mano", "Balaur");
  N.agregarEfecto(f, { tipo: "sinLimiteMano", j: 0, fin: "turno" }, 0);
  f = aplicar(f, { tipo: "terminar" });
  assert.equal(f.activo, 1);
});

test("mecánica: maxVeces, grupo compartido y respuestas fuera de las habilidades normales", () => {
  let e = con(mesa(), "Sir Galahad", {
    activadas: [
      { texto: "Robar", momento: "vigilia", maxVeces: 2, grupo: "a", hacer: [{ op: "robar", n: 1, quien: "yo" }] },
      { texto: "Robar otra", momento: "vigilia", maxVeces: 2, grupo: "a", hacer: [{ op: "robar", n: 1, quien: "yo" }] },
      { texto: "Anular", respuesta: { anula: {} }, momento: "cualquiera" },
    ],
  });
  const g = poner(e, 0, "defensa", "Sir Galahad");
  const usar = (s) => accionesLegales(s).filter((a) => a.tipo === "habilidad" && a.uid === g);
  assert.deepEqual(usar(e).map((a) => a.h), [0, 1]);
  e = resolverTodo(aplicar(e, usar(e)[0]));
  e = resolverTodo(aplicar(e, usar(e)[1]));
  assert.equal(usar(e).length, 0);
});

test("mecánica: noPierden desde el Cementerio protege sin recursión", () => {
  const e = con(mesa(), "Sir Galahad", { continuas: [{ zona: "cementerio", noPierden: true, a: "tusAliados" }] });
  poner(e, 0, "cementerio", "Sir Galahad");
  const balaur = poner(e, 0, "defensa", "Balaur");
  N.agregarEfecto(e, { tipo: "pierdeHabilidad", uid: balaur, fin: "turno" }, 1);
  assert.equal(N.activa(e, balaur), true);
});
