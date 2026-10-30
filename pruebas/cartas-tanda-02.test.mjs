import { test } from "node:test";
import assert from "node:assert/strict";
import { mesa, poner, oros, hacer, elegir, sinRespuesta, accionesLegales, aplicar, zonaDe, id, N } from "./ayuda-duelo.mjs";
import { costeDe } from "../web/duelo/motor.js";
import { impuestoSinPagar } from "../web/duelo/efectos.js";

const jugar = (uid, extra = {}) => ({ tipo: "jugar", uid, ...extra });
const habilidad = (uid, nombre, h = 0) => ({ tipo: "habilidad", uid, def: id(nombre), h });
const nombreDe = (e, nombre) => (v) => v !== null && N.carta(e, v).nombre === nombre;

function resolverTodo(e) {
  for (let i = 0; i < 40 && e.pendiente; i++) e = aplicar(e, { tipo: "elegir", i: e.pendiente.opciones.length - 1 });
  return e;
}

function opcionesDe(e) {
  return e.pendiente.opciones.map((o) => o.valor);
}

test("Ileana: tiene Indestructible", () => {
  const e = mesa();
  const ileana = poner(e, 0, "defensa", "Ileana");
  assert.equal(N.tiene(e, ileana, "Indestructible"), true);
});

test("Ileana: en la Guerra de Talismanes el oponente Bota una carta por cada Aliado de tu Línea de Defensa, una vez por turno", () => {
  let e = mesa();
  const ileana = poner(e, 0, "defensa", "Ileana");
  poner(e, 0, "defensa", "Valefor");
  poner(e, 0, "defensa", "Valefor");
  e.fase = "talismanes";
  e.prioridad = 0;
  e.pases = 0;
  e = aplicar(e, habilidad(ileana, "Ileana"));
  assert.equal(e.jugadores[1].castillo.length, 27);
  assert.equal(e.jugadores[1].cementerio.length, 3);
  e.prioridad = 0;
  assert.equal(accionesLegales(e).some((a) => a.tipo === "habilidad" && a.uid === ileana), false);
});

test("Ileana: su habilidad de Guerra no se puede usar en la Vigilia", () => {
  const e = mesa();
  const ileana = poner(e, 0, "defensa", "Ileana");
  assert.equal(accionesLegales(e).some((a) => a.tipo === "habilidad" && a.uid === ileana), false);
});

test("Ileana: en tu Fase Final puedes Desterrar hasta dos cartas de los Cementerios", () => {
  let e = mesa();
  poner(e, 0, "defensa", "Ileana");
  const a = poner(e, 0, "cementerio", "Valefor");
  const b = poner(e, 1, "cementerio", "Valefor");
  const c = poner(e, 1, "cementerio", "Valefor");
  e = aplicar(e, { tipo: "terminar" });
  e = elegir(e, true);
  e = elegir(e, a);
  e = elegir(e, b);
  assert.equal(zonaDe(e, a), "destierro");
  assert.equal(zonaDe(e, b), "destierro");
  assert.equal(zonaDe(e, c), "cementerio");
});

test("Keshalyi: al jugar un Talismán roba una carta, baraja una de tu mano y el oponente Bota tres", () => {
  let e = mesa();
  poner(e, 0, "defensa", "Keshalyi");
  oros(e, 0, 1);
  const manada = poner(e, 0, "mano", "Llamar a la Manada");
  const x = poner(e, 0, "mano", "Valefor");
  e = hacer(e, jugar(manada), x);
  assert.equal(zonaDe(e, x), "castillo");
  assert.equal(e.jugadores[1].castillo.length, 27);
  assert.equal(e.jugadores[1].cementerio.length, 3);
  assert.equal(e.jugadores[0].mano.length, 4);
});

test("Keshalyi: solo se dispara hasta dos veces por turno", () => {
  let e = mesa();
  poner(e, 0, "defensa", "Keshalyi");
  oros(e, 0, 3);
  const manadas = [1, 2, 3].map(() => poner(e, 0, "mano", "Llamar a la Manada"));
  for (const m of manadas) {
    e = sinRespuesta(aplicar(e, jugar(m)));
    if (e.pendiente) e = elegir(e, nombreDe(e, "Drácula"));
  }
  assert.equal(e.pendiente, null);
  assert.equal(e.jugadores[1].castillo.length, 24);
});

test("Keshalyi: no se dispara al jugar un Aliado", () => {
  let e = mesa();
  poner(e, 0, "defensa", "Keshalyi");
  oros(e, 0, 1);
  const v = poner(e, 0, "mano", "Valefor");
  e = sinRespuesta(aplicar(e, jugar(v)));
  assert.equal(e.pendiente, null);
  assert.equal(e.jugadores[1].castillo.length, 30);
});

test("Keshalyi: en la Fase Final, si jugaste otro Aliado, puedes Desterrar hasta tres cartas del Cementerio", () => {
  let e = mesa();
  poner(e, 0, "defensa", "Keshalyi");
  oros(e, 0, 1);
  const v = poner(e, 0, "mano", "Valefor");
  const c = [0, 0, 1, 1].map((j) => poner(e, j, "cementerio", "Valefor"));
  e = sinRespuesta(aplicar(e, jugar(v)));
  e = aplicar(e, { tipo: "terminar" });
  e = elegir(e, true);
  for (const u of c.slice(0, 3)) e = elegir(e, u);
  assert.deepEqual(c.map((u) => zonaDe(e, u)), ["destierro", "destierro", "destierro", "cementerio"]);
});

test("Keshalyi: no cuenta como otro Aliado ella misma ni sin haber jugado Aliados", () => {
  let e = mesa();
  const k = poner(e, 0, "mano", "Keshalyi");
  oros(e, 0, 2);
  poner(e, 0, "cementerio", "Valefor");
  e = sinRespuesta(aplicar(e, jugar(k)));
  e = aplicar(e, { tipo: "terminar" });
  assert.equal(e.pendiente, null);
  assert.equal(e.jugadores[0].cementerio.length, 1);
});

test("Keshalyi: los Aliados oponentes pierden 1 de Fuerza y los tuyos no", () => {
  const e = mesa();
  poner(e, 0, "defensa", "Keshalyi");
  const propio = poner(e, 0, "defensa", "Valefor");
  const rival = poner(e, 1, "defensa", "Valefor");
  assert.equal(N.fuerza(e, propio), 3);
  assert.equal(N.fuerza(e, rival), 2);
});

test("Legua Muerta: su coste baja un Oro por cada Oro con habilidad, con mínimo 1", () => {
  const e = mesa();
  const legua = poner(e, 0, "mano", "Legua Muerta");
  assert.equal(costeDe(e, 0, legua).pagar, 7);
  for (let i = 0; i < 4; i++) poner(e, 0, "reserva", "Onsen");
  assert.equal(costeDe(e, 0, legua).pagar, 3);
  for (let i = 0; i < 4; i++) poner(e, 0, "reserva", "Onsen");
  assert.equal(costeDe(e, 0, legua).pagar, 1);
});

test("Legua Muerta: los Oros sin habilidad no reducen su coste", () => {
  const e = mesa();
  const legua = poner(e, 0, "mano", "Legua Muerta");
  oros(e, 0, 5);
  poner(e, 0, "reserva", "Onsen");
  assert.equal(costeDe(e, 0, legua).pagar, 6);
});

test("Legua Muerta: baraja todos los Aliados y el oponente Bota una carta por cada Aliado oponente barajado", () => {
  let e = mesa();
  oros(e, 0, 7);
  const legua = poner(e, 0, "mano", "Legua Muerta");
  const mio = poner(e, 0, "defensa", "Valefor");
  const r1 = poner(e, 1, "defensa", "Valefor");
  const r2 = poner(e, 1, "ataque", "Valefor");
  e = sinRespuesta(aplicar(e, jugar(legua)));
  for (const u of [mio, r1, r2]) assert.equal(zonaDe(e, u), "castillo");
  assert.equal(e.jugadores[1].castillo.length, 30);
  assert.equal(e.jugadores[1].cementerio.length, 2);
  assert.equal(e.jugadores[0].castillo.length, 31);
  assert.equal(e.jugadores[0].cementerio.length, 1);
});

test("Legua Muerta: sin Aliados oponentes el oponente no Bota", () => {
  let e = mesa();
  oros(e, 0, 7);
  const legua = poner(e, 0, "mano", "Legua Muerta");
  poner(e, 0, "defensa", "Valefor");
  e = sinRespuesta(aplicar(e, jugar(legua)));
  assert.equal(e.jugadores[1].cementerio.length, 0);
});

test("Leon Indiferente: cuesta un Oro adicional solo si controlas Aliados", () => {
  const e = mesa();
  const leon = poner(e, 0, "mano", "Leon Indiferente");
  assert.equal(costeDe(e, 0, leon).pagar, 0);
  poner(e, 0, "defensa", "Valefor");
  assert.equal(costeDe(e, 0, leon).pagar, 1);
});

test("Leon Indiferente: convierte dos cartas del tope de un Castillo en Aliados de Fuerza 2 sin habilidad bajo tu control que no salen ni cambian de controlador", () => {
  let e = mesa();
  const leon = poner(e, 0, "mano", "Leon Indiferente");
  const [t1, t2, t3] = e.jugadores[1].castillo;
  e = hacer(e, jugar(leon), "Castillo oponente");
  for (const u of [t1, t2]) {
    assert.equal(zonaDe(e, u), "defensa");
    assert.equal(N.ubicar(e, u).j, 0);
    assert.equal(N.carta(e, u).tipo, "Aliado");
    assert.equal(N.carta(e, u).sinHabilidad, true);
    assert.equal(N.fuerza(e, u), 2);
    assert.equal(N.puedeSalir(e, u), false);
    assert.equal(N.puedeTomar(e, u, 1), false);
  }
  assert.equal(zonaDe(e, t3), "castillo");
  assert.equal(e.jugadores[1].castillo.length, 28);
});

test("Leon Indiferente: también puede usarse sobre tu propio Castillo", () => {
  let e = mesa();
  const leon = poner(e, 0, "mano", "Leon Indiferente");
  const [t1, t2] = e.jugadores[0].castillo;
  e = hacer(e, jugar(leon), "tu Castillo");
  assert.equal(zonaDe(e, t1), "defensa");
  assert.equal(zonaDe(e, t2), "defensa");
});

test("Leon Indiferente: si pagaste Oros para jugarlo Robas dos cartas, y si no pagaste, no", () => {
  let e = mesa();
  const leon = poner(e, 0, "mano", "Leon Indiferente");
  e = hacer(e, jugar(leon), "tu Castillo");
  assert.equal(e.jugadores[0].mano.length, 0);

  e = mesa();
  oros(e, 0, 1);
  poner(e, 0, "defensa", "Valefor");
  const leon2 = poner(e, 0, "mano", "Leon Indiferente");
  e = hacer(e, jugar(leon2), "Castillo oponente");
  assert.equal(e.jugadores[0].mano.length, 2);
  assert.equal(e.jugadores[0].pagado.length, 1);
});

test("Lobos de los Cárpatos: entra con Furia y limita a tres las cartas barajadas de los Cementerios por turno", () => {
  let e = mesa();
  const lobos = poner(e, 0, "defensa", "Lobos de los Cárpatos");
  const onsen = poner(e, 0, "reserva", "Onsen");
  const c = Array.from({ length: 5 }, () => poner(e, 0, "cementerio", "Valefor"));
  assert.equal(N.tiene(e, lobos, "Furia"), true);
  e = hacer(e, habilidad(onsen, "Onsen"), ...c, "Barajar");
  assert.equal(c.filter((u) => zonaDe(e, u) === "castillo").length, 3);
  assert.equal(c.filter((u) => zonaDe(e, u) === "cementerio").length, 2);
});

test("Lobos de los Cárpatos: sin el límite se barajan las cinco cartas", () => {
  let e = mesa();
  const onsen = poner(e, 0, "reserva", "Onsen");
  const c = Array.from({ length: 5 }, () => poner(e, 0, "cementerio", "Valefor"));
  e = hacer(e, habilidad(onsen, "Onsen"), ...c, "Barajar");
  assert.equal(c.filter((u) => zonaDe(e, u) === "castillo").length, 5);
});

test("Lobos de los Cárpatos: al entrar puedes Descartar una carta para Robar dos y ganar 1 de Fuerza permanentemente", () => {
  let e = mesa();
  oros(e, 0, 1);
  const lobos = poner(e, 0, "mano", "Lobos de los Cárpatos");
  const x = poner(e, 0, "mano", "Valefor");
  e = hacer(e, jugar(lobos), true, "Descartar una carta de tu mano");
  assert.equal(zonaDe(e, x), "cementerio");
  assert.equal(e.jugadores[0].mano.length, 2);
  assert.equal(N.fuerza(e, lobos), 3);
});

test("Lobos de los Cárpatos: al entrar puedes Destruir una carta que controles para Robar dos", () => {
  let e = mesa();
  oros(e, 0, 1);
  const lobos = poner(e, 0, "mano", "Lobos de los Cárpatos");
  poner(e, 0, "mano", "Valefor");
  e = aplicar(e, jugar(lobos));
  e = elegir(e, true);
  e = elegir(e, "Destruir una carta que controles");
  const pagado = e.jugadores[0].pagado[0];
  e = elegir(e, pagado);
  assert.equal(zonaDe(e, pagado), "cementerio");
  assert.equal(e.jugadores[0].mano.length, 3);
  assert.equal(N.fuerza(e, lobos), 3);
});

test("Lobos de los Cárpatos: si decides no pagar el costo no roba ni gana Fuerza", () => {
  let e = mesa();
  oros(e, 0, 1);
  const lobos = poner(e, 0, "mano", "Lobos de los Cárpatos");
  poner(e, 0, "mano", "Valefor");
  e = hacer(e, jugar(lobos), false);
  assert.equal(e.jugadores[0].mano.length, 1);
  assert.equal(N.fuerza(e, lobos), 2);
});

test("Los Szgany: tiene Furia y, al atacar, el Aliado elegido debe bloquear al atacante elegido", () => {
  let e = mesa();
  const s = poner(e, 0, "defensa", "Los Szgany");
  poner(e, 1, "defensa", "Valefor");
  const elegido = poner(e, 1, "defensa", "Valefor");
  assert.equal(N.tiene(e, s, "Furia"), true);
  e = aplicar(e, { tipo: "batalla" });
  e = hacer(e, { tipo: "atacar", uid: s }, elegido);
  e = aplicar(e, { tipo: "finAtaque" });
  const legales = accionesLegales(e);
  assert.deepEqual(legales, [{ tipo: "bloquear", uid: elegido, atacante: s }]);
});

test("Los Szgany: sin Aliados oponentes el ataque sigue su curso normal", () => {
  let e = mesa();
  const s = poner(e, 0, "defensa", "Los Szgany");
  e = aplicar(e, { tipo: "batalla" });
  e = aplicar(e, { tipo: "atacar", uid: s });
  e = aplicar(e, { tipo: "finAtaque" });
  assert.ok(accionesLegales(e).some((a) => a.tipo === "finBloqueo"));
});

test("Los Szgany: cuando otro de tus Aliados sale del juego puedes hacer que el oponente Bote tres cartas", () => {
  let e = mesa();
  poner(e, 0, "defensa", "Los Szgany");
  const victima = poner(e, 0, "defensa", "Valefor");
  oros(e, 0, 1);
  const lucy = poner(e, 0, "mano", "Regresa Lucy");
  e = hacer(e, jugar(lucy), victima, true);
  assert.equal(zonaDe(e, victima), "cementerio");
  assert.equal(e.jugadores[1].castillo.length, 27);
});

test("Los Szgany: solo se dispara una vez por turno", () => {
  let e = mesa();
  poner(e, 0, "defensa", "Los Szgany");
  const v1 = poner(e, 0, "defensa", "Valefor");
  const v2 = poner(e, 0, "defensa", "Valefor");
  oros(e, 0, 2);
  const lucy1 = poner(e, 0, "mano", "Regresa Lucy");
  const lucy2 = poner(e, 0, "mano", "Regresa Lucy");
  e = hacer(e, jugar(lucy1), v1, true);
  e = hacer(e, jugar(lucy2), v2);
  assert.equal(e.pendiente, null);
  assert.equal(e.jugadores[1].castillo.length, 27);
});

test("Los Szgany: también se dispara cuando ella misma sale del juego", () => {
  let e = mesa();
  const s = poner(e, 0, "defensa", "Los Szgany");
  oros(e, 0, 1);
  const lucy = poner(e, 0, "mano", "Regresa Lucy");
  e = hacer(e, jugar(lucy), s, true);
  assert.equal(zonaDe(e, s), "cementerio");
  assert.equal(e.jugadores[1].castillo.length, 27);
});

test("Los Szgany: no se dispara cuando sale un Aliado oponente", () => {
  let e = mesa();
  poner(e, 0, "defensa", "Los Szgany");
  const victima = poner(e, 1, "defensa", "Valefor");
  oros(e, 0, 1);
  const lucy = poner(e, 0, "mano", "Regresa Lucy");
  e = hacer(e, jugar(lucy), victima);
  assert.equal(e.pendiente, null);
  assert.equal(e.jugadores[1].castillo.length, 30);
});

test("Manu Tara: cuando una carta tuya llega al Cementerio, una vez por turno, puedes Barajarla en tu Castillo", () => {
  let e = mesa();
  oros(e, 0, 1);
  poner(e, 0, "reserva", "Manu Tara");
  const victima = poner(e, 0, "defensa", "Valefor");
  const lucy = poner(e, 0, "mano", "Regresa Lucy");
  e = hacer(e, jugar(lucy), victima, true);
  assert.equal(zonaDe(e, victima), "castillo");
  assert.equal(zonaDe(e, lucy), "cementerio");
  assert.equal(e.pendiente, null);
});

test("Manu Tara: puedes decidir no Barajar la carta", () => {
  let e = mesa();
  oros(e, 0, 1);
  poner(e, 0, "reserva", "Manu Tara");
  const victima = poner(e, 0, "defensa", "Valefor");
  const lucy = poner(e, 0, "mano", "Regresa Lucy");
  e = hacer(e, jugar(lucy), victima, false);
  assert.equal(zonaDe(e, victima), "cementerio");
});

test("Manu Tara: no actúa sobre cartas que llegan al Cementerio del oponente", () => {
  let e = mesa();
  oros(e, 0, 1);
  poner(e, 0, "reserva", "Manu Tara");
  const victima = poner(e, 1, "defensa", "Valefor");
  const lucy = poner(e, 0, "mano", "Regresa Lucy");
  e = hacer(e, jugar(lucy), victima);
  assert.equal(zonaDe(e, victima), "cementerio");
});

test("Manu Tara: si está en tu Reserva y controlas Aliados de coste 1 o más, los demás Oros en juego pierden su habilidad", () => {
  const e = mesa();
  poner(e, 0, "reserva", "Manu Tara");
  poner(e, 0, "defensa", "Valefor");
  const propio = poner(e, 0, "reserva", "Onsen");
  const ajeno = poner(e, 1, "reserva", "Onsen");
  assert.equal(N.activa(e, propio), false);
  assert.equal(N.activa(e, ajeno), false);
});

test("Manu Tara: sin Aliados de coste 1 o más los demás Oros conservan su habilidad", () => {
  const e = mesa();
  poner(e, 0, "reserva", "Manu Tara");
  const otro = poner(e, 0, "reserva", "Onsen");
  assert.equal(N.activa(e, otro), true);
});

test("Monjas de Budapest: al entrar juega sin pagar un Tótem del Cementerio de coste 3", () => {
  let e = mesa();
  oros(e, 0, 4);
  const hoshi = poner(e, 0, "cementerio", "Fortaleza Hoshi");
  const abadia = poner(e, 0, "cementerio", "Abadía de Carfax");
  const monjas = poner(e, 0, "mano", "Monjas de Budapest");
  e = aplicar(e, jugar(monjas));
  e = elegir(e, hoshi);
  assert.equal(e.pendiente, null);
  assert.equal(zonaDe(e, hoshi), "apoyo");
  assert.equal(zonaDe(e, abadia), "cementerio");
});

test("Monjas de Budapest: el segundo Tótem debe respetar que los costes sumen 3 o menos", () => {
  let e = mesa();
  oros(e, 0, 4);
  const hoshi = poner(e, 0, "cementerio", "Fortaleza Hoshi");
  const abadia = poner(e, 0, "cementerio", "Abadía de Carfax");
  const poveglia = poner(e, 0, "cementerio", "Isla de Poveglia");
  const monjas = poner(e, 0, "mano", "Monjas de Budapest");
  e = aplicar(e, jugar(monjas));
  e = elegir(e, poveglia);
  const segundo = opcionesDe(e);
  assert.ok(segundo.includes(abadia));
  assert.equal(segundo.includes(hoshi), false);
});

test("Monjas de Budapest: puede jugar dos Tótems de coste total 3 o menos sin pagar", () => {
  let e = mesa();
  oros(e, 0, 4);
  const abadia = poner(e, 0, "cementerio", "Abadía de Carfax");
  const poveglia = poner(e, 0, "cementerio", "Isla de Poveglia");
  const monjas = poner(e, 0, "mano", "Monjas de Budapest");
  e = aplicar(e, jugar(monjas));
  e = elegir(e, poveglia);
  e = elegir(e, abadia);
  e = resolverTodo(e);
  assert.equal(zonaDe(e, poveglia), "apoyo");
  assert.equal(zonaDe(e, abadia), "apoyo");
  assert.equal(e.jugadores[0].reserva.length, 0);
});

test("Monjas de Budapest: en tu Vigilia, una vez por turno, Baraja y/o Destierra hasta tres cartas de los Cementerios", () => {
  let e = mesa();
  const monjas = poner(e, 0, "defensa", "Monjas de Budapest");
  const [a, b, c, d] = [0, 0, 1, 1].map((j) => poner(e, j, "cementerio", "Valefor"));
  e = hacer(e, habilidad(monjas, "Monjas de Budapest"), a, null, b, c);
  assert.equal(zonaDe(e, a), "castillo");
  assert.equal(zonaDe(e, b), "destierro");
  assert.equal(zonaDe(e, c), "destierro");
  assert.equal(zonaDe(e, d), "cementerio");
  assert.equal(accionesLegales(e).some((x) => x.tipo === "habilidad" && x.uid === monjas), false);
});

test("Monjas de Budapest: puede Desterrar solamente tres cartas", () => {
  let e = mesa();
  const monjas = poner(e, 0, "defensa", "Monjas de Budapest");
  const c = [0, 0, 1].map((j) => poner(e, j, "cementerio", "Valefor"));
  e = hacer(e, habilidad(monjas, "Monjas de Budapest"), null, ...c);
  for (const u of c) assert.equal(zonaDe(e, u), "destierro");
});

test("Monjes Ortodoxos: al entrar puedes generar un Oro para jugar Tótem por el turno", () => {
  let e = mesa();
  oros(e, 0, 2);
  const monjes = poner(e, 0, "mano", "Monjes Ortodoxos");
  e = hacer(e, jugar(monjes), true, "Generar un Oro para jugar Tótem por el turno");
  assert.deepEqual(e.jugadores[0].generados, [{ n: 1, tipos: ["Tótem"] }]);
});

test("Monjes Ortodoxos: al entrar puedes usar la habilidad de entrada de un Tótem de coste 2 o menos", () => {
  let e = mesa();
  oros(e, 0, 2);
  const abadia = poner(e, 0, "apoyo", "Abadía de Carfax");
  const monjes = poner(e, 0, "mano", "Monjes Ortodoxos");
  e = hacer(e, jugar(monjes), true, "Usar la habilidad de entrada de un Tótem de coste 2 o menos");
  e = resolverTodo(e);
  assert.equal(zonaDe(e, abadia), "apoyo");
  assert.equal(e.jugadores[0].mano.length, 1);
  assert.equal(e.jugadores[0].castillo.length, 28);
});

test("Monjes Ortodoxos: sin Tótems de coste 2 o menos solo ofrece generar el Oro", () => {
  let e = mesa();
  oros(e, 0, 2);
  poner(e, 0, "apoyo", "Fortaleza Hoshi");
  const monjes = poner(e, 0, "mano", "Monjes Ortodoxos");
  e = aplicar(e, jugar(monjes));
  e = elegir(e, true);
  assert.deepEqual(opcionesDe(e), [1]);
  e = elegir(e, 1);
  assert.deepEqual(e.jugadores[0].generados, [{ n: 1, tipos: ["Tótem"] }]);
});

test("Monjes Ortodoxos: una vez por turno un Tótem de tu Cementerio gana Exhumar y robas dos cartas", () => {
  let e = mesa();
  const monjes = poner(e, 0, "defensa", "Monjes Ortodoxos");
  const abadia = poner(e, 0, "cementerio", "Abadía de Carfax");
  assert.equal(N.tiene(e, abadia, "Exhumar"), false);
  e = hacer(e, habilidad(monjes, "Monjes Ortodoxos", 0), abadia);
  assert.equal(N.tiene(e, abadia, "Exhumar"), true);
  assert.equal(e.jugadores[0].mano.length, 2);
  assert.equal(accionesLegales(e).some((x) => x.tipo === "habilidad" && x.uid === monjes), false);
});

test("Monjes Ortodoxos: el Tótem que gana Exhumar puede jugarse desde el Cementerio", () => {
  let e = mesa();
  oros(e, 0, 1);
  const monjes = poner(e, 0, "defensa", "Monjes Ortodoxos");
  const abadia = poner(e, 0, "cementerio", "Abadía de Carfax");
  e = hacer(e, habilidad(monjes, "Monjes Ortodoxos", 0), abadia);
  assert.ok(accionesLegales(e).some((a) => a.tipo === "jugar" && a.uid === abadia && a.desde === "cementerio"));
});

test("Moroi: al entrar puedes buscar un Aliado de coste 2 en tu Castillo y jugarlo sin pagar", () => {
  let e = mesa();
  oros(e, 0, 3);
  const moroi = poner(e, 0, "mano", "Moroi");
  const ileana = poner(e, 0, "castillo", "Ileana");
  const valefor = poner(e, 0, "castillo", "Valefor");
  e = hacer(e, jugar(moroi), true);
  const ofrecidas = opcionesDe(e);
  assert.ok(ofrecidas.includes(ileana));
  assert.equal(ofrecidas.includes(valefor), false);
  e = elegir(e, ileana);
  assert.equal(zonaDe(e, ileana), "defensa");
  assert.equal(e.jugadores[0].castillo.length, 31);
  assert.equal(e.jugadores[0].reserva.length, 0);
});

test("Moroi: puedes decidir no buscar el Aliado", () => {
  let e = mesa();
  oros(e, 0, 3);
  const moroi = poner(e, 0, "mano", "Moroi");
  const ileana = poner(e, 0, "castillo", "Ileana");
  e = hacer(e, jugar(moroi), false);
  assert.equal(zonaDe(e, ileana), "castillo");
});

test("Moroi: tiene Furia y sus Aliados ganan 1 de Fuerza e Imbloqueable, pero no los del oponente", () => {
  const e = mesa();
  const moroi = poner(e, 0, "defensa", "Moroi");
  const propio = poner(e, 0, "defensa", "Valefor");
  const rival = poner(e, 1, "defensa", "Valefor");
  assert.equal(N.tiene(e, moroi, "Furia"), true);
  assert.equal(N.fuerza(e, moroi), 5);
  assert.equal(N.fuerza(e, propio), 4);
  assert.equal(N.tiene(e, propio, "Imbloqueable"), true);
  assert.equal(N.fuerza(e, rival), 3);
  assert.equal(N.tiene(e, rival, "Imbloqueable"), false);
});

test("Mortaja: baraja todos los Aliados en juego", () => {
  let e = mesa();
  oros(e, 0, 3);
  const mortaja = poner(e, 0, "mano", "Mortaja");
  const a = poner(e, 0, "defensa", "Valefor");
  const b = poner(e, 1, "defensa", "Valefor");
  const c = poner(e, 1, "ataque", "Valefor");
  e = sinRespuesta(aplicar(e, jugar(mortaja)));
  for (const u of [a, b, c]) assert.equal(zonaDe(e, u), "castillo");
  assert.equal(zonaDe(e, mortaja), "cementerio");
});

test("Mortaja: desde la mano paga un Oro, va al fondo del Castillo y sube hasta dos cartas que no sean Talismán del Cementerio", () => {
  let e = mesa();
  oros(e, 0, 1);
  const mortaja = poner(e, 0, "mano", "Mortaja");
  const aliado = poner(e, 0, "cementerio", "Valefor");
  const oro = poner(e, 0, "cementerio", "Drácula");
  const talisman = poner(e, 0, "cementerio", "Llamar a la Manada");
  e = hacer(e, habilidad(mortaja, "Mortaja"), aliado, oro);
  assert.equal(e.jugadores[0].castillo.at(-1), mortaja);
  assert.equal(e.jugadores[0].pagado.length, 1);
  assert.equal(zonaDe(e, aliado), "mano");
  assert.equal(zonaDe(e, oro), "mano");
  assert.equal(zonaDe(e, talisman), "cementerio");
});

test("Mortaja: no puede usarse desde la mano sin un Oro para pagar", () => {
  const e = mesa();
  const mortaja = poner(e, 0, "mano", "Mortaja");
  assert.equal(accionesLegales(e).some((a) => a.tipo === "habilidad" && a.uid === mortaja), false);
});

test("No Más Magia: se Destierra al jugarla y desde entonces los Talismanes cuestan un Oro adicional", () => {
  let e = mesa();
  oros(e, 0, 4);
  const nmm = poner(e, 0, "mano", "No Más Magia");
  const otro = poner(e, 0, "mano", "Llamar a la Manada");
  assert.equal(costeDe(e, 0, otro).pagar, 1);
  e = sinRespuesta(aplicar(e, jugar(nmm)));
  assert.equal(zonaDe(e, nmm), "destierro");
  assert.equal(costeDe(e, 0, otro).pagar, 2);
  assert.equal(costeDe(e, 1, otro).pagar, 2);
});

test("No Más Magia: jugar cartas sin pagar su coste cuesta un Oro adicional", () => {
  let e = mesa();
  oros(e, 0, 4);
  const nmm = poner(e, 0, "mano", "No Más Magia");
  e = sinRespuesta(aplicar(e, jugar(nmm)));
  assert.equal(impuestoSinPagar(e, 0), 1);
  assert.equal(impuestoSinPagar(e, 1), 1);
  oros(e, 0, 5);
  const moroi = poner(e, 0, "mano", "Moroi");
  const ileana = poner(e, 0, "castillo", "Ileana");
  e = hacer(e, jugar(moroi), true, ileana);
  assert.equal(zonaDe(e, ileana), "defensa");
  assert.equal(e.jugadores[0].reserva.length, 1);
});

test("No Más Magia: solo puede jugarse desde la mano, no desde el Cementerio", () => {
  const e = mesa();
  oros(e, 0, 4);
  const nmm = poner(e, 0, "cementerio", "No Más Magia");
  assert.equal(accionesLegales(e).some((a) => a.tipo === "jugar" && a.uid === nmm), false);
});
