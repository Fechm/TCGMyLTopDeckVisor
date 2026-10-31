import { test } from "node:test";
import assert from "node:assert/strict";
import { mesa, poner, oros, hacer, elegir, accionesLegales, aplicar, sinRespuesta, pasarHasta, zonaDe, id, N } from "./ayuda-duelo.mjs";
import { costeDe } from "../web/duelo/motor.js";
import { resolver, OPS } from "../web/duelo/efectos.js";
import { mov } from "../web/duelo/formato.js";

const jugar = (uid, extra = {}) => ({ tipo: "jugar", uid, ...extra });
const habilidad = (uid, nombre, h = 0) => ({ tipo: "habilidad", uid, def: id(nombre), h });
const nombreDe = (e, nombre) => (v) => v !== null && N.carta(e, v).nombre === nombre;
const puedeJugar = (e, uid) => accionesLegales(e).some((a) => a.tipo === "jugar" && a.uid === uid);
const usable = (e, uid) => accionesLegales(e).some((a) => a.tipo === "habilidad" && a.uid === uid);

function enCastillo(e, j, nombre, i) {
  const u = poner(e, j, "castillo", nombre);
  const c = e.jugadores[j].castillo;
  c.splice(c.indexOf(u), 1);
  c.splice(i, 0, u);
  return u;
}

function anularConDorado(e, uid) {
  e = aplicar(e, jugar(uid));
  const dorado = e.jugadores[1].mano.find((u) => N.carta(e, u).nombre === "Dragón Dorado");
  e = aplicar(e, { tipo: "responder", uid: dorado });
  for (let i = 0; i < 20 && (e.pila.length || e.pendiente); i++) {
    const l = accionesLegales(e);
    e = e.pendiente ? aplicar(e, { tipo: "elegir", i: 0 }) : aplicar(e, l.find((a) => ["noResponder", "pasar"].includes(a.tipo)) ?? l[0]);
  }
  return e;
}

function azi(e, j) {
  const u = poner(e, j, "reserva", "Drácula");
  e.conv[u] = { tipo: "Oro", como: "azi" };
  return u;
}

test("Tanin: tiene Exhumar y puede jugarse desde el Cementerio", () => {
  const e = mesa();
  oros(e, 0, 3);
  const t = poner(e, 0, "cementerio", "Tanin");
  assert.ok(accionesLegales(e).some((a) => a.tipo === "jugar" && a.uid === t && a.desde === "cementerio"));
});

test("Tanin: no puedes controlar más de una copia", () => {
  const e = mesa();
  oros(e, 0, 3);
  poner(e, 0, "defensa", "Tanin");
  const t = poner(e, 0, "mano", "Tanin");
  assert.equal(puedeJugar(e, t), false);
});

test("Tanin: al entrar Baraja y/o Destierra tantas cartas de los Cementerios como Oros controles más que tu oponente", () => {
  let e = mesa();
  oros(e, 0, 4);
  oros(e, 1, 1);
  const t = poner(e, 0, "mano", "Tanin");
  const c = [0, 0, 1, 1].map((j) => poner(e, j, "cementerio", "Valefor"));
  e = hacer(e, jugar(t), c[0], c[1], null, c[2]);
  assert.deepEqual(c.map((u) => zonaDe(e, u)), ["castillo", "castillo", "destierro", "cementerio"]);
});

test("Tanin: puede jugarse Botando dos cartas para reducir su coste en dos", () => {
  let e = mesa();
  oros(e, 0, 1);
  const t = poner(e, 0, "mano", "Tanin");
  const jugadas = accionesLegales(e).filter((a) => a.tipo === "jugar" && a.uid === t);
  assert.deepEqual(jugadas, [{ tipo: "jugar", uid: t, alternativo: true }]);
  e = aplicar(e, jugadas[0]);
  while (e.pendiente) e = elegir(e, null);
  assert.equal(zonaDe(e, t), "defensa");
  assert.equal(e.jugadores[0].castillo.length, 28);
});

test("Tanin: reduce su coste en uno por cada carta que Botes, hasta un mínimo de 0", { todo: "coste alternativo variable: Botar X cartas para reducir el coste en X, hasta 0" }, () => {});

test("Tormenta Feroz: tiene Furia", () => {
  const e = mesa();
  const t = poner(e, 0, "defensa", "Tormenta Feroz");
  assert.equal(N.tiene(e, t, "Furia"), true);
});

test("Tormenta Feroz: cuando un Oro entra en juego puedes subirla de tu Cementerio a tu mano", () => {
  let e = mesa();
  const t = poner(e, 0, "cementerio", "Tormenta Feroz");
  const o = poner(e, 0, "mano", "Drácula");
  e = hacer(e, { tipo: "oro", uid: o }, true);
  assert.equal(zonaDe(e, t), "mano");
});

test("Tormenta Feroz: cuando ataca puedes subir un Oro de tu Cementerio a tu mano", () => {
  let e = mesa();
  const t = poner(e, 0, "defensa", "Tormenta Feroz");
  const o = poner(e, 0, "cementerio", "Drácula");
  e = aplicar(e, { tipo: "batalla" });
  e = hacer(e, { tipo: "atacar", uid: t }, true);
  assert.equal(zonaDe(e, o), "mano");
});

test("Trentren Vilu: al entrar puede Barajar las demás cartas en juego que no sean Oro", () => {
  let e = mesa();
  oros(e, 0, 3);
  const r = oros(e, 1, 1)[0];
  const tren = poner(e, 0, "mano", "Trentren Vilu");
  const mio = poner(e, 0, "defensa", "Valefor");
  const suyo = poner(e, 1, "defensa", "Guardia Real");
  e = hacer(e, jugar(tren), true);
  assert.equal(zonaDe(e, mio), "castillo");
  assert.equal(zonaDe(e, suyo), "castillo");
  assert.equal(zonaDe(e, tren), "defensa");
  assert.equal(zonaDe(e, r), "reserva");
});

test("Trentren Vilu: una vez en tu turno paga un Oro y Bota cuatro para jugar gratis un Aliado de coste 4 o menos", () => {
  let e = mesa();
  oros(e, 0, 1);
  const tren = poner(e, 0, "defensa", "Trentren Vilu");
  const v = poner(e, 0, "mano", "Valefor");
  e = aplicar(e, habilidad(tren, "Trentren Vilu"));
  assert.equal(zonaDe(e, v), "defensa");
  assert.equal(e.jugadores[0].castillo.length, 26);
  assert.equal(e.jugadores[0].cementerio.length, 4);
  assert.equal(e.jugadores[0].reserva.length, 0);
  assert.equal(usable(e, tren), false);
});

test("Trentren Vilu: no puede ser jugado sin pagar su coste", () => {
  let e = mesa();
  oros(e, 0, 1);
  const tren = poner(e, 0, "defensa", "Trentren Vilu");
  const otro = poner(e, 0, "mano", "Trentren Vilu");
  e = aplicar(e, habilidad(tren, "Trentren Vilu"));
  while (e.pendiente) e = elegir(e, otro);
  assert.equal(zonaDe(e, otro), "mano");
});

test("Valac: reduce su coste por cada Oro Azi que controles, hasta un mínimo de 1", () => {
  const e = mesa();
  const v = poner(e, 0, "mano", "Valac");
  assert.equal(costeDe(e, 0, v).pagar, 4);
  azi(e, 0);
  azi(e, 0);
  assert.equal(costeDe(e, 0, v).pagar, 2);
  for (let i = 0; i < 3; i++) azi(e, 0);
  assert.equal(costeDe(e, 0, v).pagar, 1);
});

test("Valac: al entrar Destruye tantas cartas oponentes de coste 2 o menos como Oros pagados más uno", () => {
  let e = mesa();
  for (let i = 0; i < 3; i++) azi(e, 0);
  oros(e, 0, 1);
  const v = poner(e, 0, "mano", "Valac");
  const r = [1, 2, 3].map(() => poner(e, 1, "defensa", "Valefor"));
  const p = poner(e, 1, "defensa", "Sir Persival");
  e = hacer(e, jugar(v), r[0], r[1]);
  assert.equal(e.pendiente, null);
  assert.deepEqual(r.map((u) => zonaDe(e, u)), ["cementerio", "cementerio", "defensa"]);
  assert.equal(zonaDe(e, p), "defensa");
  assert.equal(N.tiene(e, v, "Furia"), true);
});

test("Ventisca: tus Aliados Dragón ganan 1 de Fuerza y Furia", () => {
  const e = mesa();
  poner(e, 0, "defensa", "Ventisca");
  const t = poner(e, 0, "defensa", "Tanin");
  const r = poner(e, 1, "defensa", "Tanin");
  assert.equal(N.fuerza(e, t), 4);
  assert.equal(N.tiene(e, t, "Furia"), true);
  assert.equal(N.fuerza(e, r), 3);
  assert.equal(N.tiene(e, r, "Furia"), false);
});

test("Ventisca: los Aliados que no son Dragón no ganan Fuerza", () => {
  const e = mesa();
  poner(e, 0, "defensa", "Ventisca");
  const g = poner(e, 0, "defensa", "Guardia Real");
  assert.equal(N.fuerza(e, g), 3);
  assert.equal(N.tiene(e, g, "Furia"), false);
});

test("Ventisca: con Aliados de otra raza, tus Dragones igual tienen Furia", () => {
  const e = mesa();
  poner(e, 0, "defensa", "Ventisca");
  poner(e, 0, "defensa", "Guardia Real");
  const t = poner(e, 0, "defensa", "Tanin");
  assert.equal(N.tiene(e, t, "Furia"), true);
});

test("Wyrm de la Plaga: al entrar con siete o más Oros el oponente Bota una carta por cada Oro en juego", () => {
  let e = mesa();
  oros(e, 0, 7);
  oros(e, 1, 2);
  const w = poner(e, 0, "mano", "Wyrm de la Plaga");
  e = aplicar(e, jugar(w));
  assert.equal(e.jugadores[1].castillo.length, 21);
  assert.equal(N.tiene(e, w, "Furia"), true);
});

test("Wyrm de la Plaga: con menos de siete Oros no hace Botar al entrar", () => {
  let e = mesa();
  oros(e, 0, 6);
  const w = poner(e, 0, "mano", "Wyrm de la Plaga");
  e = aplicar(e, jugar(w));
  assert.equal(e.jugadores[1].castillo.length, 30);
});

test("Wyrm de la Plaga: cuando un Oro entra en juego bajo tu control el oponente Bota dos cartas", () => {
  let e = mesa();
  poner(e, 0, "defensa", "Wyrm de la Plaga");
  const o = poner(e, 0, "mano", "Drácula");
  e = aplicar(e, { tipo: "oro", uid: o });
  assert.equal(e.jugadores[1].castillo.length, 28);
  N.disparar(e, "entra", { uid: poner(e, 0, "reserva", "Drácula"), j: 0 });
  N.disparar(e, "entra", { uid: poner(e, 1, "reserva", "Drácula"), j: 1 });
  resolver(e);
  assert.equal(e.jugadores[1].castillo.length, 26);
});

test("Wyrm de la Plaga: es Única", () => {
  const e = mesa();
  oros(e, 0, 3);
  poner(e, 0, "defensa", "Wyrm de la Plaga");
  const w = poner(e, 0, "mano", "Wyrm de la Plaga");
  assert.equal(puedeJugar(e, w), false);
});

test("Zmaj Depredador: al entrar Destruye todas las cartas de coste 2 o menos y Roba una carta", () => {
  let e = mesa();
  oros(e, 0, 3);
  const ro = oros(e, 1, 1)[0];
  const z = poner(e, 0, "mano", "Zmaj Depredador");
  const mio = poner(e, 0, "defensa", "Valefor");
  const g = poner(e, 1, "defensa", "Guardia Real");
  const p = poner(e, 1, "defensa", "Sir Persival");
  const m = poner(e, 1, "defensa", "Mecha-Daikaiju");
  e = aplicar(e, jugar(z));
  assert.equal(zonaDe(e, mio), "cementerio");
  assert.equal(zonaDe(e, g), "cementerio");
  assert.equal(zonaDe(e, p), "defensa");
  assert.equal(zonaDe(e, m), "defensa");
  assert.equal(zonaDe(e, ro), "reserva");
  assert.equal(e.jugadores[0].mano.length, 1);
  assert.equal(N.tiene(e, z, "Furia"), true);
});

test("Zmaj Depredador: la primera carta que juegue tu oponente cada turno cuesta un Oro adicional", () => {
  const e = mesa();
  const v = poner(e, 1, "mano", "Valefor");
  const k = poner(e, 1, "mano", "Abducción del Cabo");
  const mia = poner(e, 0, "mano", "Valefor");
  poner(e, 0, "defensa", "Zmaj Depredador");
  assert.equal(costeDe(e, 1, v).pagar, 2);
  assert.equal(costeDe(e, 1, k).pagar, 2);
  assert.equal(costeDe(e, 0, mia).pagar, 1);
  e.jugadores[1].jugadas.Talismán = 1;
  assert.equal(costeDe(e, 1, v).pagar, 1);
});

test("Zmaj Moonshadow: una vez por turno cada jugador Bota tres, puedes poner un Aliado de un Cementerio sin habilidad y Robas dos", () => {
  let e = mesa();
  const z = poner(e, 0, "defensa", "Zmaj Moonshadow");
  const v = poner(e, 1, "cementerio", "Valefor");
  e = hacer(e, habilidad(z, "Zmaj Moonshadow"), v);
  assert.equal(e.jugadores[0].castillo.length, 25);
  assert.equal(e.jugadores[1].castillo.length, 27);
  assert.equal(zonaDe(e, v), "defensa");
  assert.equal(N.ubicar(e, v).j, 0);
  assert.equal(N.carta(e, v).sinHabilidad, true);
  assert.equal(e.jugadores[0].mano.length, 2);
  assert.equal(usable(e, z), false);
  assert.equal(N.tiene(e, z, "Furia"), true);
});

test("Zmaj Moonshadow: tus Aliados no pueden ser Barajados por efectos", () => {
  let e = mesa();
  oros(e, 0, 3);
  const z = poner(e, 0, "defensa", "Zmaj Moonshadow");
  const v = poner(e, 0, "defensa", "Valefor");
  const g = poner(e, 1, "defensa", "Guardia Real");
  const tren = poner(e, 0, "mano", "Trentren Vilu");
  e = hacer(e, jugar(tren), true);
  assert.equal(zonaDe(e, z), "defensa");
  assert.equal(zonaDe(e, v), "defensa");
  assert.equal(zonaDe(e, g), "castillo");
});

test("Zmeoaica: al entrar puedes mostrar un Aliado de coste 3 de tu mano para Robar dos cartas", () => {
  let e = mesa();
  oros(e, 0, 2);
  const z = poner(e, 0, "mano", "Zmeoaica");
  const p = poner(e, 0, "mano", "Sir Persival");
  e = hacer(e, jugar(z), true);
  assert.equal(zonaDe(e, p), "mano");
  assert.equal(e.jugadores[0].mano.length, 3);
});

test("Zmeoaica: sin Aliados de coste 3 en la mano no roba", () => {
  let e = mesa();
  oros(e, 0, 2);
  const z = poner(e, 0, "mano", "Zmeoaica");
  poner(e, 0, "mano", "Valefor");
  e = aplicar(e, jugar(z));
  assert.equal(e.pendiente, null);
  assert.equal(e.jugadores[0].mano.length, 1);
});

test("Zmeoaica: no puedes controlar más de una copia", () => {
  const e = mesa();
  oros(e, 0, 2);
  poner(e, 0, "defensa", "Zmeoaica");
  const z = poner(e, 0, "mano", "Zmeoaica");
  assert.equal(puedeJugar(e, z), false);
});

test("Zmeoaica: tus Aliados de coste 3 o más reducen su coste en un Oro", () => {
  const e = mesa();
  const p = poner(e, 0, "mano", "Sir Persival");
  const g = poner(e, 0, "mano", "Guardia Real");
  const r = poner(e, 1, "mano", "Sir Persival");
  poner(e, 0, "defensa", "Zmeoaica");
  assert.equal(costeDe(e, 0, p).pagar, 2);
  assert.equal(costeDe(e, 0, g).pagar, 2);
  assert.equal(costeDe(e, 1, r).pagar, 3);
});

test("Zmeoaica: tus Aliados de coste 3 o más no pueden ser Desterrados", () => {
  const e = mesa();
  poner(e, 0, "defensa", "Zmeoaica");
  const p = poner(e, 0, "defensa", "Sir Persival");
  const g = poner(e, 0, "defensa", "Guardia Real");
  const r = poner(e, 1, "defensa", "Sir Persival");
  e.cola.unshift(N.nuevoFrame([mov("desterrar")], { ctrl: 1, vars: { x: [p, g, r] } }));
  resolver(e);
  assert.equal(zonaDe(e, p), "defensa");
  assert.equal(zonaDe(e, g), "destierro");
  assert.equal(zonaDe(e, r), "destierro");
});

test("Zmeu Abismal: al entrar puedes convertir un Oro en un Oro sin habilidad y ganar su control", () => {
  let e = mesa();
  oros(e, 0, 5);
  const onsen = poner(e, 1, "reserva", "Onsen");
  const z = poner(e, 0, "mano", "Zmeu Abismal");
  e = hacer(e, jugar(z), true, onsen);
  assert.equal(zonaDe(e, onsen), "reserva");
  assert.equal(N.ubicar(e, onsen).j, 0);
  assert.equal(N.carta(e, onsen).sinHabilidad, true);
  assert.equal(N.tiene(e, z, "Furia"), true);
});

test("Zmeu Abismal: cuando ataca, hasta una carta que no sea Oro pierde su habilidad y es Destruida", () => {
  let e = mesa();
  const z = poner(e, 0, "defensa", "Zmeu Abismal");
  const m = poner(e, 1, "defensa", "Mecha-Daikaiju");
  e = aplicar(e, { tipo: "batalla" });
  e = hacer(e, { tipo: "atacar", uid: z }, m);
  assert.equal(zonaDe(e, m), "cementerio");
});

test("Zmeu Abismal: sólo puede ser puesto en juego si se pagó su coste impreso", () => {
  const e = mesa();
  const z = poner(e, 0, "cementerio", "Zmeu Abismal");
  OPS.entrar(e, { uid: z, datos: { pagado: false } }, { ctx: { ctrl: 0, vars: {} } });
  assert.equal(zonaDe(e, z), "cementerio");
});

test("A Traves del Espejo: tu Aliado gana la habilidad de un Aliado de coste 2 o menos de tu Cementerio y, con Exhumar o Furia, Furia o Imbloqueable", () => {
  let e = mesa();
  oros(e, 0, 2);
  const t = poner(e, 0, "defensa", "Tanin");
  poner(e, 0, "cementerio", "Ventisca");
  const espejo = poner(e, 0, "mano", "A Traves del Espejo");
  e = hacer(e, jugar(espejo), "Gana Imbloqueable");
  assert.equal(N.fuerza(e, t), 4);
  assert.equal(N.tiene(e, t, "Furia"), true);
  assert.equal(N.tiene(e, t, "Imbloqueable"), true);
  assert.equal(zonaDe(e, espejo), "destierro");
});

test("A Traves del Espejo: sin Aliados con Exhumar o Furia solo gana la habilidad", () => {
  let e = mesa();
  oros(e, 0, 2);
  const p = poner(e, 0, "defensa", "Sir Persival");
  poner(e, 0, "cementerio", "Guardia Real");
  const espejo = poner(e, 0, "mano", "A Traves del Espejo");
  e = aplicar(e, jugar(espejo));
  assert.equal(e.pendiente, null);
  assert.deepEqual(e.ganadas[p], [id("Guardia Real")]);
  assert.equal(N.tiene(e, p, "AtacaAlEntrar"), true);
});

test("Abducción del Cabo: sube un Aliado oponente de coste 3 o menos, veta su nombre y genera un Oro para Armas o Tótems", () => {
  let e = mesa();
  oros(e, 0, 1);
  const v = poner(e, 1, "defensa", "Valefor");
  const a = poner(e, 0, "mano", "Abducción del Cabo");
  e = aplicar(e, jugar(a));
  assert.equal(zonaDe(e, v), "mano");
  assert.ok(e.efectos.some((f) => f.tipo === "noJugarNombre" && f.j === 1 && f.nombre === "Valefor"));
  assert.deepEqual(e.jugadores[0].generados, [{ n: 1, tipos: ["Arma", "Tótem"] }]);
});

test("Abducción del Cabo: no puede jugarse sin cartas oponentes de coste 3 o menos que no sean Oro", () => {
  const e = mesa();
  oros(e, 0, 1);
  oros(e, 1, 2);
  poner(e, 1, "defensa", "Valac");
  const a = poner(e, 0, "mano", "Abducción del Cabo");
  assert.equal(puedeJugar(e, a), false);
});

test("Abiku: busca una carta, Roba una y se convierte en un Oro sin habilidad en tu Oro Pagado", () => {
  let e = mesa();
  oros(e, 0, 2);
  const v = poner(e, 0, "castillo", "Valefor");
  const ab = poner(e, 0, "mano", "Abiku");
  e = hacer(e, jugar(ab), nombreDe(e, "Valefor"));
  assert.equal(zonaDe(e, v), "mano");
  assert.equal(e.jugadores[0].mano.length, 2);
  assert.equal(zonaDe(e, ab), "pagado");
  assert.equal(N.carta(e, ab).tipo, "Oro");
  assert.equal(N.carta(e, ab).sinHabilidad, true);
});

test("Abordaje: convierte una carta de un Cementerio en un Aliado Indestructible de Fuerza 0 en la Línea de Defensa oponente cuyos Aliados pierden 2", () => {
  let e = mesa();
  oros(e, 0, 1);
  const c = poner(e, 1, "cementerio", "Valefor");
  const g = poner(e, 1, "defensa", "Guardia Real");
  const p = poner(e, 0, "defensa", "Sir Persival");
  const ab = poner(e, 0, "mano", "Abordaje");
  e = aplicar(e, { tipo: "batalla" });
  assert.equal(e.fase, "momento");
  e = sinRespuesta(aplicar(e, jugar(ab)));
  assert.equal(zonaDe(e, c), "defensa");
  assert.equal(N.ubicar(e, c).j, 1);
  assert.equal(N.carta(e, c).tipo, "Aliado");
  assert.equal(N.fuerza(e, c), 0);
  assert.equal(N.tiene(e, c, "Indestructible"), true);
  assert.equal(N.fuerza(e, g), 1);
  assert.equal(N.fuerza(e, p), 2);
});

test("Abordaje: puede jugarse en la Vigilia y también al comienzo de cualquier Fase", () => {
  let e = mesa();
  oros(e, 0, 1);
  poner(e, 1, "cementerio", "Valefor");
  const ab = poner(e, 0, "mano", "Abordaje");
  assert.equal(puedeJugar(e, ab), true);
  e = aplicar(e, { tipo: "terminar" });
  assert.equal(e.fase, "momento");
  assert.equal(puedeJugar(e, ab), true);
});

test("Abrazo de Maipú: Baraja cartas de tu Cementerio, Roba tres y se Destierra", () => {
  let e = mesa();
  oros(e, 0, 3);
  const c = [1, 2].map(() => poner(e, 0, "cementerio", "Valefor"));
  const ab = poner(e, 0, "mano", "Abrazo de Maipú");
  e = hacer(e, jugar(ab), c[0], c[1]);
  assert.deepEqual(c.map((u) => zonaDe(e, u)), ["castillo", "castillo"]);
  assert.equal(e.jugadores[0].mano.length, 3);
  assert.equal(zonaDe(e, ab), "destierro");
});

test("Abrazo de Maipú: si es Anulado genera un Oro por el turno", { todo: "disparada: al ser Anulado" }, () => {});

test("Absorber Kaiju: reduce su coste en un Oro por cada Aliado en juego, hasta un mínimo de 1", () => {
  const e = mesa();
  const k = poner(e, 0, "mano", "Absorber Kaiju");
  assert.equal(costeDe(e, 0, k).pagar, 5);
  poner(e, 0, "defensa", "Valefor");
  poner(e, 1, "defensa", "Valefor");
  poner(e, 1, "defensa", "Valefor");
  assert.equal(costeDe(e, 0, k).pagar, 2);
  poner(e, 1, "defensa", "Valefor");
  poner(e, 1, "defensa", "Valefor");
  assert.equal(costeDe(e, 0, k).pagar, 1);
});

test("Absorber Kaiju: los Aliados en juego pierden su habilidad y son Barajados", () => {
  let e = mesa();
  oros(e, 0, 2);
  const a = [poner(e, 0, "defensa", "Valefor"), poner(e, 1, "defensa", "Guardia Real"), poner(e, 1, "defensa", "Mecha-Daikaiju")];
  const k = poner(e, 0, "mano", "Absorber Kaiju");
  e = aplicar(e, jugar(k));
  assert.deepEqual(a.map((u) => zonaDe(e, u)), ["castillo", "castillo", "castillo"]);
});

test("Absorber Kaiju: Anularlo cuesta un Oro adicional", () => {
  let e = mesa();
  oros(e, 0, 5);
  poner(e, 1, "mano", "Dragón Dorado");
  const k = poner(e, 0, "mano", "Absorber Kaiju");
  e = aplicar(e, jugar(k));
  assert.equal(accionesLegales(e).some((a) => a.tipo === "responder"), false);
  let f = mesa();
  oros(f, 0, 5);
  oros(f, 1, 1);
  poner(f, 1, "mano", "Dragón Dorado");
  const k2 = poner(f, 0, "mano", "Absorber Kaiju");
  f = aplicar(f, jugar(k2));
  assert.equal(accionesLegales(f).some((a) => a.tipo === "responder"), true);
});

test("Acabar la Esperanza: deja sin habilidad una carta de coste 3 o menos y sube hasta dos cartas de ese tipo del Castillo", () => {
  let e = mesa();
  oros(e, 0, 1);
  const p = poner(e, 1, "defensa", "Sir Persival");
  const v = [enCastillo(e, 0, "Valefor", 3), enCastillo(e, 0, "Valefor", 7), enCastillo(e, 0, "Valefor", 20)];
  const a = poner(e, 0, "mano", "Acabar la Esperanza");
  e = hacer(e, jugar(a), p);
  assert.equal(N.carta(e, p).sinHabilidad, true);
  assert.equal(N.carta(e, p).tipo, "Aliado");
  assert.deepEqual(v.map((u) => zonaDe(e, u)), ["mano", "mano", "castillo"]);
});

test("Acabar la Esperanza: tiene Exhumar", () => {
  const e = mesa();
  oros(e, 0, 1);
  poner(e, 1, "defensa", "Sir Persival");
  const a = poner(e, 0, "cementerio", "Acabar la Esperanza");
  assert.ok(accionesLegales(e).some((x) => x.tipo === "jugar" && x.uid === a && x.desde === "cementerio"));
});

test("Acabar la Esperanza: si es Anulado genera un Oro y Roba una carta", () => {
  let e = mesa();
  oros(e, 0, 1);
  poner(e, 1, "defensa", "Sir Persival");
  poner(e, 1, "mano", "Dragón Dorado");
  const a = poner(e, 0, "mano", "Acabar la Esperanza");
  e = anularConDorado(e, a);
  assert.equal(zonaDe(e, a), "cementerio");
  assert.equal(e.jugadores[0].mano.length, 1);
  assert.deepEqual(e.jugadores[0].generados, [{ n: 1, tipos: null }]);
});

test("Activar Tenshi Z: pone el primer Oro del Castillo en tu Oro Pagado y el primer Arma o Tótem en tu mano", () => {
  let e = mesa();
  oros(e, 0, 1);
  const tope = e.jugadores[0].castillo[0];
  const arma = enCastillo(e, 0, "Pedrenyal", 4);
  const t = poner(e, 0, "mano", "Activar Tenshi Z");
  e = aplicar(e, jugar(t));
  assert.equal(zonaDe(e, tope), "pagado");
  assert.equal(zonaDe(e, arma), "mano");
  assert.equal(e.jugadores[0].castillo.length, 29);
});

test("Activar Tenshi Z: puedes Desterrarla de tu Cementerio para que una carta pierda su habilidad por el turno", () => {
  let e = mesa();
  const t = poner(e, 0, "cementerio", "Activar Tenshi Z");
  const m = poner(e, 1, "defensa", "Mecha-Daikaiju");
  e = aplicar(e, habilidad(t, "Activar Tenshi Z"));
  assert.equal(zonaDe(e, t), "destierro");
  assert.equal(N.tiene(e, m, "Indestructible"), false);
});

test("Al Abordaje Muchachos: convierte cartas de tu Cementerio en Aliados de Fuerza 3 con Furia y en la Fase Final se Barajan y Robas tres", () => {
  let e = mesa();
  oros(e, 0, 2);
  oros(e, 1, 1);
  const c = [1, 2].map(() => poner(e, 0, "cementerio", "Valefor"));
  const t = poner(e, 0, "mano", "Al Abordaje Muchachos");
  e = hacer(e, jugar(t), c[0], c[1]);
  for (const u of c) {
    assert.equal(zonaDe(e, u), "defensa");
    assert.equal(N.carta(e, u).tipo, "Aliado");
    assert.equal(N.fuerza(e, u), 3);
    assert.equal(N.tiene(e, u, "Furia"), true);
  }
  e = aplicar(e, { tipo: "terminar" });
  assert.deepEqual(c.map((u) => zonaDe(e, u)), ["castillo", "castillo"]);
  assert.equal(e.jugadores[0].mano.length, 4);
});

test("Al Abordaje Muchachos: los Aliados no pueden salir del juego en Guerra de Talismanes", { todo: "efecto: no puede salir del juego durante la Guerra de Talismanes" }, () => {});

test("Amanecer Oscuro: elige dos, busca un Aliado en el Castillo oponente para su Destierro y Baraja una carta de coste 2 o menos", () => {
  let e = mesa();
  oros(e, 0, 1);
  const v = enCastillo(e, 1, "Valefor", 5);
  const g = poner(e, 1, "defensa", "Guardia Real");
  const a = poner(e, 0, "mano", "Amanecer Oscuro");
  e = hacer(e, jugar(a), 1, 2, "Castillo oponente", v, "Destierro");
  assert.equal(zonaDe(e, v), "destierro");
  assert.equal(N.ubicar(e, v).j, 1);
  assert.equal(zonaDe(e, g), "castillo");
  assert.equal(zonaDe(e, a), "destierro");
});

test("Amanecer Oscuro: prevenir el próximo daño que fueras a recibir", () => {
  let e = mesa();
  oros(e, 0, 1);
  const g = poner(e, 1, "defensa", "Guardia Real");
  const a = poner(e, 0, "mano", "Amanecer Oscuro");
  e = hacer(e, jugar(a), 0, 2);
  assert.equal(zonaDe(e, g), "castillo");
  assert.ok(e.efectos.some((f) => f.tipo === "prevenirDano" && f.j === 0 && f.unaVez));
  e = pasarHasta(aplicar(e, { tipo: "terminar" }), "vigilia");
  assert.equal(e.activo, 1);
  const atacante = poner(e, 1, "defensa", "Sir Persival");
  const castillo = e.jugadores[0].castillo.length;
  e = aplicar(e, { tipo: "batalla" });
  e = aplicar(e, { tipo: "atacar", uid: atacante });
  e = aplicar(e, { tipo: "finAtaque" });
  const antes = e.registro.length;
  for (let i = 0; i < 30 && e.registro.length === antes; i++) {
    const l = accionesLegales(e);
    e = aplicar(e, l.find((x) => ["finBloqueo", "pasar", "noResponder"].includes(x.tipo)) ?? l[0]);
  }
  assert.equal(e.jugadores[0].castillo.length, castillo);
  assert.equal(e.efectos.some((f) => f.tipo === "prevenirDano"), false);
});

test("Amarre de Bruja: ganas el control de un Aliado oponente de igual o menos Fuerza mientras tu Aliado esté en juego", () => {
  let e = mesa();
  oros(e, 0, 1);
  const t = poner(e, 0, "defensa", "Tanin");
  const g = poner(e, 1, "defensa", "Guardia Real");
  const a = poner(e, 0, "mano", "Amarre de Bruja");
  e = aplicar(e, jugar(a));
  assert.equal(N.ubicar(e, g).j, 0);
  assert.equal(zonaDe(e, a), "destierro");
  N.mover(e, t, "cementerio");
  resolver(e);
  assert.equal(N.ubicar(e, g).j, 1);
});

test("Amarre de Bruja: no puede jugarse si el Aliado oponente tiene más Fuerza", () => {
  const e = mesa();
  oros(e, 0, 1);
  poner(e, 0, "defensa", "Tanin");
  poner(e, 1, "defensa", "Mecha-Daikaiju");
  const a = poner(e, 0, "mano", "Amarre de Bruja");
  assert.equal(puedeJugar(e, a), false);
});

test("Amor de Dulcinea: previene que una carta salga del juego y Baraja una carta de coste 2 o menos", () => {
  let e = mesa();
  oros(e, 0, 1);
  const v = poner(e, 0, "defensa", "Valefor");
  const g = poner(e, 1, "defensa", "Guardia Real");
  const a = poner(e, 0, "mano", "Amor de Dulcinea");
  e = hacer(e, jugar(a), 0, 1, v, g);
  assert.equal(N.puedeSalir(e, v), false);
  assert.equal(zonaDe(e, g), "castillo");
});

test("Amor de Dulcinea: si es Anulado Roba dos cartas", () => {
  let e = mesa();
  oros(e, 0, 1);
  poner(e, 1, "mano", "Dragón Dorado");
  const a = poner(e, 0, "mano", "Amor de Dulcinea");
  e = anularConDorado(e, a);
  assert.equal(zonaDe(e, a), "cementerio");
  assert.equal(e.jugadores[0].mano.length, 2);
});

test("Amor de Dulcinea: Desterrarla de la mano previene que el oponente gane el control de tu carta", { todo: "respuesta: desde la mano, prevenir que el oponente gane el control de una carta" }, () => {});

test("Aniquilar Titanes: no puede ser Anulado, Destruye una carta oponente de coste 2 o menos y se convierte en Oro en tu Oro Pagado", () => {
  let e = mesa();
  oros(e, 0, 1);
  const v = poner(e, 1, "defensa", "Valefor");
  const t = poner(e, 0, "mano", "Aniquilar Titanes");
  assert.ok(N.carta(e, t).claves.includes("NoAnulable"));
  e = hacer(e, jugar(t), 0);
  assert.equal(zonaDe(e, v), "cementerio");
  assert.equal(zonaDe(e, t), "pagado");
  assert.equal(N.carta(e, t).tipo, "Oro");
  assert.equal(N.carta(e, t).sinHabilidad, true);
});

test("Aniquilar Titanes: puede Barajar una carta sin habilidad que no sea Oro", () => {
  let e = mesa();
  oros(e, 0, 1);
  const p = poner(e, 1, "defensa", "Sir Persival");
  e.conv[p] = { tipo: "Aliado", sinHabilidad: true };
  const t = poner(e, 0, "mano", "Aniquilar Titanes");
  e = hacer(e, jugar(t), "Barajar una carta sin habilidad que no sea Oro");
  assert.equal(zonaDe(e, p), "castillo");
});

test("Aniquilar a la Bestia: hasta tres cartas de coste total 4 o menos pierden su habilidad y son Destruidas", () => {
  let e = mesa();
  oros(e, 0, 2);
  const m = poner(e, 1, "defensa", "Mecha-Daikaiju");
  const v = poner(e, 1, "defensa", "Valefor");
  const p = poner(e, 1, "defensa", "Sir Persival");
  const b = poner(e, 0, "mano", "Aniquilar a la Bestia");
  e = hacer(e, jugar(b), m, v);
  assert.equal(e.pendiente, null);
  assert.equal(zonaDe(e, m), "cementerio");
  assert.equal(zonaDe(e, v), "cementerio");
  assert.equal(zonaDe(e, p), "defensa");
});

test("Aniquilar a la Bestia: desde tu Cementerio los Aliados pierden 1 de Fuerza", () => {
  const e = mesa();
  poner(e, 0, "cementerio", "Aniquilar a la Bestia");
  const p = poner(e, 1, "defensa", "Sir Persival");
  const t = poner(e, 0, "defensa", "Tanin");
  assert.equal(N.fuerza(e, p), 1);
  assert.equal(N.fuerza(e, t), 2);
});

test("Aniquilar a la Bestia: para Desterrarla de tu Cementerio el oponente debe Barajar una carta de su mano", { todo: "restricción: el oponente paga un coste para Desterrar esta carta del Cementerio" }, () => {});

test("Aparición del Sanatorio: convierte un Aliado de coste 2 o menos de un Cementerio en un Tótem bajo tu control", () => {
  let e = mesa();
  oros(e, 0, 2);
  const v = poner(e, 1, "cementerio", "Valefor");
  const a = poner(e, 0, "mano", "Aparición del Sanatorio");
  e = aplicar(e, jugar(a));
  assert.equal(zonaDe(e, v), "apoyo");
  assert.equal(N.ubicar(e, v).j, 0);
  assert.equal(N.carta(e, v).tipo, "Tótem");
  assert.equal(zonaDe(e, a), "cementerio");
});

test("Aparición del Sanatorio: mientras el Tótem esté en juego y el Talismán en tu Cementerio, las cartas de coste 1 o menos no disparan sus habilidades", () => {
  let e = mesa();
  oros(e, 0, 2);
  const v = poner(e, 1, "cementerio", "Valefor");
  const a = poner(e, 0, "mano", "Aparición del Sanatorio");
  e = aplicar(e, jugar(a));
  const t = poner(e, 0, "cementerio", "Tormenta Feroz");
  N.disparar(e, "entra", { uid: poner(e, 0, "reserva", "Drácula"), j: 0 });
  resolver(e);
  assert.equal(e.pendiente, null);
  assert.equal(zonaDe(e, t), "cementerio");
  N.mover(e, v, "cementerio");
  N.disparar(e, "entra", { uid: poner(e, 0, "reserva", "Drácula"), j: 0 });
  resolver(e);
  assert.notEqual(e.pendiente, null);
});
