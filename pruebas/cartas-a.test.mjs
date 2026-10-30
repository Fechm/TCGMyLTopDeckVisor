import { test } from "node:test";
import assert from "node:assert/strict";
import { mesa, poner, oros, hacer, elegir, sinRespuesta, accionesLegales, aplicar, zonaDe, id, CATALOGO, N } from "./ayuda-duelo.mjs";

const jugar = (uid, extra = {}) => ({ tipo: "jugar", uid, ...extra });
const habilidad = (uid, nombre, h = 0) => ({ tipo: "habilidad", uid, def: id(nombre), h });
const noNulo = (v) => v !== null;

function avanzarHasta(e, pred) {
  for (let i = 0; i < 300 && !pred(e) && e.ganador === null; i++) {
    if (e.pendiente) e = aplicar(e, { tipo: "elegir", i: e.pendiente.opciones.length - 1 });
    else {
      const l = accionesLegales(e);
      const a = l.find((x) => ["terminar", "pasar", "noResponder", "finAtaque", "finBloqueo"].includes(x.tipo)) ?? l[0];
      e = aplicar(e, a);
    }
  }
  return e;
}

function atacarSinBloqueo(e, uid) {
  e = aplicar(e, { tipo: "batalla" });
  e = aplicar(e, { tipo: "atacar", uid });
  e = aplicar(e, { tipo: "finAtaque" });
  e = aplicar(e, { tipo: "finBloqueo" });
  e = aplicar(e, { tipo: "pasar" });
  return aplicar(e, { tipo: "pasar" });
}

function castilloConTope(e, j, nombres) {
  e.jugadores[j].castillo = [];
  const uids = nombres.map((n) => poner(e, j, "castillo", n));
  for (let i = 0; i < 12; i++) poner(e, j, "castillo", "Drácula");
  return uids;
}

test("Jabberwocky: sin Aliados de coste 1 o menos su coste baja en un Oro", () => {
  let e = mesa();
  oros(e, 0, 1);
  const jab = poner(e, 0, "mano", "Jabberwocky");
  assert.ok(accionesLegales(e).some((a) => a.tipo === "jugar" && a.uid === jab));
  e = sinRespuesta(hacer(e, jugar(jab)));
  assert.equal(zonaDe(e, jab), "defensa");
  assert.equal(e.jugadores[0].reserva.length, 0);
});

test("Jabberwocky: con un Aliado de coste 1 o menos controlado paga su coste completo", () => {
  let e = mesa();
  oros(e, 0, 1);
  poner(e, 0, "defensa", "Valefor");
  const jab = poner(e, 0, "mano", "Jabberwocky");
  assert.ok(!accionesLegales(e).some((a) => a.tipo === "jugar" && a.uid === jab));
  oros(e, 0, 1);
  assert.ok(accionesLegales(e).some((a) => a.tipo === "jugar" && a.uid === jab));
  e = sinRespuesta(hacer(e, jugar(jab)));
  assert.equal(e.jugadores[0].reserva.length, 0);
  assert.equal(zonaDe(e, jab), "defensa");
});

test("Jabberwocky: al atacar convierte el tope del Castillo oponente en un Oro sin habilidad en tu Oro Pagado", () => {
  let e = mesa();
  const jab = poner(e, 0, "defensa", "Jabberwocky");
  const tope = e.jugadores[1].castillo[0];
  e = aplicar(e, { tipo: "batalla" });
  e = aplicar(e, { tipo: "atacar", uid: jab });
  assert.ok(e.jugadores[0].pagado.includes(tope));
  assert.equal(N.carta(e, tope).tipo, "Oro");
  assert.equal(N.carta(e, tope).sinHabilidad, true);
  assert.equal(e.jugadores[1].castillo.length, 29);
});

test("Jabberwocky: no se puede Anular", () => {
  let e = mesa();
  oros(e, 0, 2);
  oros(e, 1, 1);
  const jab = poner(e, 0, "mano", "Jabberwocky");
  const dorado = poner(e, 1, "mano", "Dragón Dorado");
  e = aplicar(e, jugar(jab));
  assert.ok(!accionesLegales(e).some((a) => a.tipo === "responder" && a.uid === dorado));
  assert.equal(zonaDe(e, jab), "defensa");
});

test("Mecha-Daikaiju: es Indestructible e Indesterrable", () => {
  const e = mesa();
  const m = poner(e, 0, "defensa", "Mecha-Daikaiju");
  assert.ok(N.tiene(e, m, "Indestructible"));
  assert.ok(N.tiene(e, m, "Indesterrable"));
});

test("Mecha-Daikaiju: al entrar roba hasta tres cartas", () => {
  let e = mesa();
  oros(e, 0, 3);
  const m = poner(e, 0, "mano", "Mecha-Daikaiju");
  e = sinRespuesta(aplicar(e, jugar(m)));
  assert.deepEqual(e.pendiente.opciones.map((o) => o.valor), [0, 1, 2, 3]);
  e = elegir(e, 3);
  assert.equal(e.jugadores[0].mano.length, 3);
  assert.equal(e.jugadores[0].castillo.length, 27);
});

test("Mecha-Daikaiju: una vez en tu turno busca un Oro en tu Castillo, lo pone en tu Oro Pagado y encarece las disparadas oponentes", () => {
  let e = mesa();
  const m = poner(e, 0, "defensa", "Mecha-Daikaiju");
  assert.ok(accionesLegales(e).some((a) => a.tipo === "habilidad" && a.uid === m));
  e = hacer(e, habilidad(m, "Mecha-Daikaiju"), noNulo);
  assert.equal(e.jugadores[0].pagado.length, 1);
  assert.equal(N.carta(e, e.jugadores[0].pagado[0]).tipo, "Oro");
  assert.equal(e.jugadores[0].castillo.length, 29);
  assert.ok(e.efectos.some((f) => f.tipo === "disparadasCuestan" && f.j === 1));
  assert.ok(!accionesLegales(e).some((a) => a.tipo === "habilidad" && a.uid === m));
});

test("Mecha-Daikaiju: tus Aliados ganan 1 de Fuerza y Furia, los oponentes no", () => {
  const e = mesa();
  const m = poner(e, 0, "defensa", "Mecha-Daikaiju");
  const propio = poner(e, 0, "defensa", "Sir Persival");
  const ajeno = poner(e, 1, "defensa", "Sir Persival");
  assert.equal(N.fuerza(e, m), 6);
  assert.equal(N.fuerza(e, propio), 3);
  assert.ok(N.tiene(e, propio, "Furia"));
  assert.equal(N.fuerza(e, ajeno), 2);
  assert.ok(!N.tiene(e, ajeno, "Furia"));
});

test("Mecha-Daikaiju: es Indesterrable frente a Carcosa", () => {
  let e = mesa();
  oros(e, 0, 2);
  const m = poner(e, 1, "defensa", "Mecha-Daikaiju");
  const rv = poner(e, 1, "defensa", "Valefor");
  const carcosa = poner(e, 0, "mano", "Carcosa");
  e = sinRespuesta(hacer(e, jugar(carcosa), 0));
  const valores = e.pendiente.opciones.map((o) => o.valor);
  assert.ok(valores.includes(rv));
  assert.ok(!valores.includes(m));
});

test("Daikaiju Furioso: al entrar el oponente no puede atacar en su siguiente turno y tú robas dos cartas", () => {
  let e = mesa();
  oros(e, 0, 3);
  poner(e, 1, "defensa", "Sir Persival");
  const d = poner(e, 0, "mano", "Daikaiju Furioso");
  e = sinRespuesta(hacer(e, jugar(d)));
  assert.equal(e.jugadores[0].mano.length, 2);
  assert.ok(e.efectos.some((f) => f.tipo === "noAtacar" && f.j === 1));
  e = aplicar(e, { tipo: "terminar" });
  assert.equal(e.activo, 1);
  assert.equal(e.fase, "vigilia");
  assert.ok(!accionesLegales(e).some((a) => a.tipo === "batalla"));
});

test("Daikaiju Furioso: el oponente solo puede jugar una carta de cada tipo en su siguiente turno", () => {
  let e = mesa();
  oros(e, 0, 3);
  oros(e, 1, 6);
  const d = poner(e, 0, "mano", "Daikaiju Furioso");
  const v = poner(e, 1, "mano", "Valefor");
  const dr = poner(e, 1, "mano", "El Dracul");
  const carcosa = poner(e, 1, "mano", "Carcosa");
  e = sinRespuesta(hacer(e, jugar(d)));
  e = aplicar(e, { tipo: "terminar" });
  assert.ok(accionesLegales(e).some((a) => a.tipo === "jugar" && a.uid === v));
  e = sinRespuesta(aplicar(e, jugar(v)));
  const legales = accionesLegales(e);
  assert.ok(!legales.some((a) => a.tipo === "jugar" && a.uid === dr));
  assert.ok(legales.some((a) => a.tipo === "jugar" && a.uid === carcosa));
});

test("Daikaiju Furioso: desde tu Cementerio paga un Oro para convertirse en un Oro sin habilidad en tu Oro Pagado", () => {
  let e = mesa();
  oros(e, 0, 1);
  const d = poner(e, 0, "cementerio", "Daikaiju Furioso");
  assert.ok(accionesLegales(e).some((a) => a.tipo === "habilidad" && a.uid === d));
  e = aplicar(e, habilidad(d, "Daikaiju Furioso"));
  assert.equal(zonaDe(e, d), "pagado");
  assert.equal(N.carta(e, d).tipo, "Oro");
  assert.equal(N.carta(e, d).sinHabilidad, true);
  assert.equal(e.jugadores[0].pagado.length, 2);
  assert.equal(e.jugadores[0].reserva.length, 0);
});

test("Daikaiju Furioso: sin un Oro en la Reserva no puede usar su habilidad desde el Cementerio", () => {
  const e = mesa();
  const d = poner(e, 0, "cementerio", "Daikaiju Furioso");
  assert.ok(!accionesLegales(e).some((a) => a.tipo === "habilidad" && a.uid === d));
});

test("Daikaiju Furioso: los Oros oponentes pierden su habilidad", () => {
  const e = mesa();
  const oro = poner(e, 1, "reserva", "Tetramorfo");
  const propio = poner(e, 0, "reserva", "Tetramorfo");
  assert.ok(N.activa(e, oro));
  poner(e, 0, "defensa", "Daikaiju Furioso");
  assert.ok(!N.activa(e, oro));
  assert.ok(N.activa(e, propio));
});

test("Padre Dagón: no se puede Anular", () => {
  let e = mesa();
  oros(e, 0, 4);
  oros(e, 1, 1);
  const dagon = poner(e, 0, "mano", "Padre Dagón");
  const dorado = poner(e, 1, "mano", "Dragón Dorado");
  e = aplicar(e, jugar(dagon));
  assert.ok(!accionesLegales(e).some((a) => a.tipo === "responder" && a.uid === dorado));
  assert.equal(zonaDe(e, dagon), "defensa");
});

test("Padre Dagón: una vez por turno una carta oponente que no es Oro pierde su habilidad y es Destruida", () => {
  let e = mesa();
  const dagon = poner(e, 0, "defensa", "Padre Dagón");
  const rv = poner(e, 1, "defensa", "Valefor");
  e = aplicar(e, habilidad(dagon, "Padre Dagón"));
  assert.equal(zonaDe(e, rv), "cementerio");
  assert.ok(!accionesLegales(e).some((a) => a.tipo === "habilidad" && a.uid === dagon));
});

test("Padre Dagón: un Aliado Indestructible pierde su habilidad y por eso es Destruido", () => {
  let e = mesa();
  const dagon = poner(e, 0, "defensa", "Padre Dagón");
  const balaur = poner(e, 1, "defensa", "Balaur");
  e = aplicar(e, habilidad(dagon, "Padre Dagón"));
  assert.equal(zonaDe(e, balaur), "cementerio");
});

test("Padre Dagón: no puede elegir Oros y sin otra carta oponente no se activa", () => {
  const e = mesa();
  const dagon = poner(e, 0, "defensa", "Padre Dagón");
  poner(e, 1, "reserva", "Drácula");
  assert.ok(!accionesLegales(e).some((a) => a.tipo === "habilidad" && a.uid === dagon));
});

test("Padre Dagón: el oponente solo puede poner en juego tres cartas por turno que no sean Oro", () => {
  let e = mesa();
  poner(e, 0, "defensa", "Padre Dagón");
  oros(e, 1, 12);
  const nombres = ["Valefor", "Jabberwocky", "Balaur", "Mecha-Daikaiju"];
  const uids = nombres.map((n) => poner(e, 1, "mano", n));
  e = aplicar(e, { tipo: "terminar" });
  assert.equal(e.activo, 1);
  for (const u of uids.slice(0, 3)) {
    assert.ok(accionesLegales(e).some((a) => a.tipo === "jugar" && a.uid === u));
    e = sinRespuesta(aplicar(e, jugar(u)));
    if (e.pendiente) e = elegir(e, (v) => v === false || v === null || v === 0);
  }
  assert.ok(!accionesLegales(e).some((a) => a.tipo === "jugar" && a.uid === uids[3]));
});

test("Balaur: tiene Furia, Indestructible y hace daño de combate al Destierro", () => {
  const e = mesa();
  const b = poner(e, 0, "defensa", "Balaur");
  assert.ok(N.tiene(e, b, "Furia"));
  assert.ok(N.tiene(e, b, "Indestructible"));
  assert.ok(N.tiene(e, b, "DanoAlDestierro"));
});

test("Balaur: al entrar pone un Oro de tu mano en tu Oro Pagado", () => {
  let e = mesa();
  oros(e, 0, 3);
  const b = poner(e, 0, "mano", "Balaur");
  const oro = poner(e, 0, "mano", "Drácula");
  e = sinRespuesta(hacer(e, jugar(b)));
  assert.ok(e.jugadores[0].pagado.includes(oro));
  assert.equal(e.jugadores[0].pagado.length, 4);
});

test("Balaur: al atacar pone un Oro de tu Cementerio en tu Oro Pagado", () => {
  let e = mesa();
  const b = poner(e, 0, "defensa", "Balaur");
  const oro = poner(e, 0, "cementerio", "Drácula");
  e = aplicar(e, { tipo: "batalla" });
  e = aplicar(e, { tipo: "atacar", uid: b });
  assert.ok(e.jugadores[0].pagado.includes(oro));
});

test("Balaur: al salir del juego pone un Oro de tu mano en tu Oro Pagado", () => {
  let e = mesa();
  oros(e, 0, 2);
  const b = poner(e, 0, "defensa", "Balaur");
  const oro = poner(e, 0, "mano", "Drácula");
  const carcosa = poner(e, 0, "mano", "Carcosa");
  e = sinRespuesta(hacer(e, jugar(carcosa), 0, b));
  assert.equal(zonaDe(e, b), "destierro");
  assert.ok(e.jugadores[0].pagado.includes(oro));
});

test("Balaur: el oponente paga un Oro adicional para jugar cartas de coste 0", () => {
  let e = mesa();
  poner(e, 0, "defensa", "Balaur");
  oros(e, 0, 1);
  const v = poner(e, 0, "mano", "Valefor");
  const dorado = poner(e, 1, "mano", "Dragón Dorado");
  e = aplicar(e, jugar(v));
  assert.ok(!accionesLegales(e).some((a) => a.tipo === "responder" && a.uid === dorado));
  let f = mesa();
  poner(f, 0, "defensa", "Balaur");
  oros(f, 0, 1);
  oros(f, 1, 1);
  const v2 = poner(f, 0, "mano", "Valefor");
  const dorado2 = poner(f, 1, "mano", "Dragón Dorado");
  f = aplicar(f, jugar(v2));
  assert.ok(accionesLegales(f).some((a) => a.tipo === "responder" && a.uid === dorado2));
  f = aplicar(f, { tipo: "responder", uid: dorado2 });
  assert.equal(f.jugadores[1].pagado.length, 1);
});

test("Balaur: su daño de combate va al Destierro del Castillo oponente", () => {
  let e = mesa();
  const b = poner(e, 0, "defensa", "Balaur");
  e = atacarSinBloqueo(e, b);
  assert.equal(e.jugadores[1].destierro.length, 5);
  assert.equal(e.jugadores[1].cementerio.length, 0);
  assert.equal(e.jugadores[1].castillo.length, 25);
});

test("White Worm: tiene Furia", () => {
  const e = mesa();
  assert.ok(N.tiene(e, poner(e, 0, "defensa", "White Worm"), "Furia"));
});

test("White Worm: convierte una carta que no es Oro en un Oro sin habilidad en tu Oro Pagado", () => {
  let e = mesa();
  const w = poner(e, 0, "defensa", "White Worm");
  const rv = poner(e, 1, "defensa", "Valefor");
  e = aplicar(e, habilidad(w, "White Worm"));
  assert.equal(zonaDe(e, rv), "pagado");
  assert.equal(N.controlador(e, rv), 0);
  assert.equal(N.carta(e, rv).tipo, "Oro");
  assert.equal(N.carta(e, rv).sinHabilidad, true);
  assert.equal(zonaDe(e, w), "defensa");
  assert.ok(!accionesLegales(e).some((a) => a.tipo === "habilidad" && a.uid === w && a.h === 0));
});

test("White Worm: si la carta convertida era de coste 3 o más Baraja un Oro que controlas", () => {
  let e = mesa();
  const w = poner(e, 0, "defensa", "White Worm");
  const rp = poner(e, 1, "defensa", "Sir Persival");
  const propio = poner(e, 0, "reserva", "Drácula");
  e = hacer(e, habilidad(w, "White Worm"), propio);
  assert.equal(zonaDe(e, rp), "pagado");
  assert.equal(zonaDe(e, propio), "castillo");
  assert.equal(e.jugadores[0].castillo.length, 31);
});

test("White Worm: si la carta convertida era de coste 2 o menos no Baraja ningún Oro", () => {
  let e = mesa();
  const w = poner(e, 0, "defensa", "White Worm");
  const propio = poner(e, 0, "reserva", "Drácula");
  const rv = poner(e, 1, "defensa", "Valefor");
  e = aplicar(e, habilidad(w, "White Worm"));
  assert.equal(zonaDe(e, rv), "pagado");
  assert.equal(zonaDe(e, propio), "reserva");
  assert.equal(e.pendiente, null);
});

test("White Worm: Destierra hasta tres cartas de los Cementerios y Roba una carta", () => {
  let e = mesa();
  const w = poner(e, 0, "defensa", "White Worm");
  const c = [poner(e, 0, "cementerio", "Drácula"), poner(e, 0, "cementerio", "Valefor"), poner(e, 1, "cementerio", "Drácula")];
  e = hacer(e, habilidad(w, "White Worm", 1), noNulo, noNulo, noNulo, "Desterrar");
  for (const u of c) assert.equal(zonaDe(e, u), "destierro");
  assert.equal(e.jugadores[0].mano.length, 1);
});

test("White Worm: puede Barajar solo parte de las cartas de los Cementerios", () => {
  let e = mesa();
  const w = poner(e, 0, "defensa", "White Worm");
  const a = poner(e, 0, "cementerio", "Valefor");
  const b = poner(e, 1, "cementerio", "El Dracul");
  e = hacer(e, habilidad(w, "White Worm", 1), a, null, "Barajar");
  assert.equal(zonaDe(e, a), "castillo");
  assert.equal(zonaDe(e, b), "cementerio");
  assert.equal(e.jugadores[0].mano.length, 1);
});

test("El Dracul: tiene Furia", () => {
  const e = mesa();
  assert.ok(N.tiene(e, poner(e, 0, "defensa", "El Dracul"), "Furia"));
});

test("El Dracul: al entrar puedes mostrar hasta un Oro y un Aliado, ponerlos en tu mano y Barajar el resto", () => {
  let e = mesa();
  oros(e, 0, 1);
  const [talisman, arma, aliado, oro] = castilloConTope(e, 0, ["Llamar a la Manada", "Espada Vikinga", "Valefor", "Drácula"]);
  const dracul = poner(e, 0, "mano", "El Dracul");
  e = sinRespuesta(hacer(e, jugar(dracul), true));
  assert.ok(e.jugadores[0].mano.includes(aliado));
  assert.ok(e.jugadores[0].mano.includes(oro));
  assert.equal(e.jugadores[0].mano.length, 2);
  assert.ok(e.jugadores[0].castillo.includes(talisman));
  assert.ok(e.jugadores[0].castillo.includes(arma));
  assert.equal(e.jugadores[0].castillo.length, 14);
});

test("El Dracul: puedes no mostrar cartas y el Castillo queda igual", () => {
  let e = mesa();
  oros(e, 0, 1);
  const dracul = poner(e, 0, "mano", "El Dracul");
  e = sinRespuesta(hacer(e, jugar(dracul), false));
  assert.equal(e.jugadores[0].mano.length, 0);
  assert.equal(e.jugadores[0].castillo.length, 30);
});

test("Valefor: tiene Furia y puede atacar el turno en que entra", () => {
  let e = mesa();
  oros(e, 0, 1);
  const v = poner(e, 0, "mano", "Valefor");
  e = sinRespuesta(hacer(e, jugar(v)));
  assert.ok(N.tiene(e, v, "Furia"));
  assert.ok(accionesLegales(e).some((a) => a.tipo === "batalla"));
  e = aplicar(e, { tipo: "batalla" });
  assert.ok(accionesLegales(e).some((a) => a.tipo === "atacar" && a.uid === v));
});

test("Valefor: al hacer daño puede convertirse en un Oro Azi en tu Oro Pagado", () => {
  let e = mesa();
  const v = poner(e, 0, "defensa", "Valefor");
  e = atacarSinBloqueo(e, v);
  assert.deepEqual(e.pendiente.opciones.map((o) => o.texto), ["Convertirse en Oro Azi", "Mirar cuatro cartas"]);
  e = elegir(e, 0);
  assert.equal(zonaDe(e, v), "pagado");
  assert.equal(N.carta(e, v).tipo, "Oro");
  assert.equal(e.jugadores[1].castillo.length, 27);
});

test("Valefor: el Oro Azi Baraja una carta de un Cementerio en tu Fase Final", () => {
  let e = mesa();
  const v = poner(e, 0, "defensa", "Valefor");
  e = elegir(atacarSinBloqueo(e, v), 0);
  assert.ok(e.pendiente);
  assert.equal(e.fase, "finalizando");
  const antes = e.jugadores[1].cementerio.length;
  const elegida = e.pendiente.opciones[0].valor;
  e = elegir(e, elegida);
  assert.equal(zonaDe(e, elegida), "castillo");
  assert.equal(e.jugadores[1].cementerio.length, antes - 1);
});

test("Valefor: vuelve a la Línea de Defensa al comienzo de tu próximo turno", () => {
  let e = mesa();
  const v = poner(e, 0, "defensa", "Valefor");
  e = elegir(atacarSinBloqueo(e, v), 0);
  e = avanzarHasta(e, (x) => x.turno >= 3 && x.fase === "vigilia" && !x.pendiente);
  assert.equal(zonaDe(e, v), "defensa");
  assert.equal(N.carta(e, v).tipo, "Aliado");
});

test("Valefor: al hacer daño puede mirar cuatro cartas, poner una en tu mano y otra en tu Cementerio", () => {
  let e = mesa();
  const v = poner(e, 0, "defensa", "Valefor");
  const t = castilloConTope(e, 0, ["Llamar a la Manada", "Espada Vikinga", "Carcosa", "Guillatún"]);
  e = atacarSinBloqueo(e, v);
  e = hacer(e, { tipo: "elegir", i: 1 }, t[1], t[2]);
  assert.equal(zonaDe(e, t[1]), "mano");
  assert.equal(zonaDe(e, t[2]), "cementerio");
  assert.equal(zonaDe(e, t[3]), "castillo");
});

test("Draco Conjurador: al entrar puedes buscar un Oro en tu Castillo y ponerlo en tu mano", () => {
  let e = mesa();
  oros(e, 0, 3);
  const d = poner(e, 0, "mano", "Draco Conjurador");
  e = sinRespuesta(hacer(e, jugar(d), true, noNulo));
  assert.equal(e.jugadores[0].mano.length, 1);
  assert.equal(N.carta(e, e.jugadores[0].mano[0]).tipo, "Oro");
  assert.equal(e.jugadores[0].castillo.length, 29);
});

test("Draco Conjurador: puedes no buscar y la mano queda vacía", () => {
  let e = mesa();
  oros(e, 0, 3);
  const d = poner(e, 0, "mano", "Draco Conjurador");
  e = sinRespuesta(hacer(e, jugar(d), false));
  assert.equal(e.jugadores[0].mano.length, 0);
  assert.equal(e.jugadores[0].castillo.length, 30);
});

test("Gusano Rojo: tiene Furia, Imbloqueable y hace daño al Destierro", () => {
  const e = mesa();
  const g = poner(e, 0, "defensa", "Gusano Rojo");
  assert.ok(N.tiene(e, g, "Furia"));
  assert.ok(N.tiene(e, g, "Imbloqueable"));
  assert.ok(N.tiene(e, g, "DanoAlDestierro"));
});

test("Gusano Rojo: ningún Aliado puede bloquearlo", () => {
  let e = mesa();
  const g = poner(e, 0, "defensa", "Gusano Rojo");
  poner(e, 1, "defensa", "Sir Persival");
  e = aplicar(e, { tipo: "batalla" });
  e = aplicar(e, { tipo: "atacar", uid: g });
  e = aplicar(e, { tipo: "finAtaque" });
  assert.ok(!accionesLegales(e).some((a) => a.tipo === "bloquear"));
});

test("Gusano Rojo: su daño de combate de 10 va al Destierro", () => {
  let e = mesa();
  const g = poner(e, 0, "defensa", "Gusano Rojo");
  e = atacarSinBloqueo(e, g);
  assert.equal(e.jugadores[1].destierro.length, 10);
  assert.equal(e.jugadores[1].cementerio.length, 0);
});

test("Gusano Rojo: una vez por turno busca un Oro en un Castillo y lo pone en tu Oro Pagado", () => {
  let e = mesa();
  const g = poner(e, 0, "defensa", "Gusano Rojo");
  e = hacer(e, habilidad(g, "Gusano Rojo"), (v) => v !== null && N.dueno(v) === 1);
  assert.equal(e.jugadores[0].pagado.length, 1);
  assert.equal(N.dueno(e.jugadores[0].pagado[0]), 1);
  assert.equal(N.controlador(e, e.jugadores[0].pagado[0]), 0);
  assert.equal(e.jugadores[1].castillo.length, 29);
  assert.ok(!accionesLegales(e).some((a) => a.tipo === "habilidad" && a.uid === g));
});

test("Martillo Sacro: el portador gana 1 de Fuerza e Indestructible", () => {
  let e = mesa();
  oros(e, 0, 1);
  const v = poner(e, 0, "defensa", "Valefor");
  const m = poner(e, 0, "mano", "Martillo Sacro");
  e = sinRespuesta(hacer(e, jugar(m, { portador: v })));
  assert.deepEqual(e.armas[v], [m]);
  assert.equal(N.fuerza(e, v), 4);
  assert.ok(N.tiene(e, v, "Indestructible"));
});

test("Martillo Sacro: tiene Exhumar y se puede jugar desde el Cementerio", () => {
  const e = mesa();
  oros(e, 0, 1);
  const v = poner(e, 0, "defensa", "Valefor");
  const m = poner(e, 0, "cementerio", "Martillo Sacro");
  assert.ok(accionesLegales(e).some((a) => a.tipo === "jugar" && a.uid === m && a.portador === v && a.desde === "cementerio"));
});

test("Martillo Sacro: en tu Vigilia Destruye un Aliado oponente de coste 2 o menos", () => {
  let e = mesa();
  const v = poner(e, 0, "defensa", "Valefor");
  const m = poner(e, 0, "arma", "Martillo Sacro", { portador: v });
  const rv = poner(e, 1, "defensa", "Valefor");
  e = aplicar(e, habilidad(m, "Martillo Sacro"));
  assert.equal(zonaDe(e, rv), "cementerio");
  assert.ok(!accionesLegales(e).some((a) => a.tipo === "habilidad" && a.uid === m));
});

test("Martillo Sacro: si el Aliado tiene Exhumar lo Destierra en vez de Destruirlo", () => {
  let e = mesa();
  const v = poner(e, 0, "defensa", "Valefor");
  const m = poner(e, 0, "arma", "Martillo Sacro", { portador: v });
  const rv = poner(e, 1, "defensa", "Valefor");
  e.ganadas[rv] = [id("Efigie")];
  e = aplicar(e, habilidad(m, "Martillo Sacro"));
  assert.equal(zonaDe(e, rv), "destierro");
});

test("Martillo Sacro: no puede apuntar a un Aliado oponente de coste 3 o más", () => {
  const e = mesa();
  const v = poner(e, 0, "defensa", "Valefor");
  const m = poner(e, 0, "arma", "Martillo Sacro", { portador: v });
  poner(e, 1, "defensa", "Sir Persival");
  assert.ok(!accionesLegales(e).some((a) => a.tipo === "habilidad" && a.uid === m));
});

test("Espada Vikinga: el portador gana 2 de Fuerza", () => {
  const e = mesa();
  const v = poner(e, 0, "defensa", "Valefor");
  poner(e, 0, "arma", "Espada Vikinga", { portador: v });
  assert.equal(N.fuerza(e, v), 5);
});

test("Espada Vikinga: al entrar Robas dos cartas y Barajas una carta oponente de coste igual o menor a tus Aliados", () => {
  let e = mesa();
  oros(e, 0, 1);
  oros(e, 1, 1);
  const v = poner(e, 0, "defensa", "Valefor");
  const rv = poner(e, 1, "defensa", "Valefor");
  const rp = poner(e, 1, "defensa", "Sir Persival");
  const espada = poner(e, 0, "mano", "Espada Vikinga");
  e = sinRespuesta(aplicar(e, jugar(espada, { portador: v })));
  const valores = e.pendiente.opciones.map((o) => o.valor);
  assert.ok(valores.includes(rv));
  assert.ok(!valores.includes(rp));
  e = elegir(e, rv);
  assert.equal(zonaDe(e, rv), "castillo");
  assert.equal(zonaDe(e, rp), "defensa");
  assert.equal(e.jugadores[0].mano.length, 2);
});

test("Espada Vikinga: desde la mano no Anula cartas de coste distinto de 1 ni sin Oro", () => {
  let e = mesa();
  oros(e, 0, 3);
  oros(e, 1, 1);
  const draco = poner(e, 0, "mano", "Draco Conjurador");
  const espada = poner(e, 1, "mano", "Espada Vikinga");
  e = aplicar(e, jugar(draco));
  assert.ok(!accionesLegales(e).some((a) => a.tipo === "responder" && a.uid === espada));
  let f = mesa();
  oros(f, 0, 1);
  const v = poner(f, 0, "mano", "Valefor");
  const espada2 = poner(f, 1, "mano", "Espada Vikinga");
  f = aplicar(f, jugar(v));
  assert.ok(!accionesLegales(f).some((a) => a.tipo === "responder" && a.uid === espada2));
});

test("Carcosa: al entrar Destierra una carta que no sea Oro y Robas una carta", () => {
  let e = mesa();
  oros(e, 0, 2);
  const rv = poner(e, 1, "defensa", "Valefor");
  const carcosa = poner(e, 0, "mano", "Carcosa");
  e = sinRespuesta(hacer(e, jugar(carcosa), 0, rv));
  assert.equal(zonaDe(e, rv), "destierro");
  assert.equal(zonaDe(e, carcosa), "apoyo");
  assert.equal(e.jugadores[0].mano.length, 1);
});

test("Carcosa: al entrar puede Desterrar un Talismán de la mano oponente y Robas una carta", () => {
  let e = mesa();
  oros(e, 0, 2);
  const tal = poner(e, 1, "mano", "Llamar a la Manada");
  const otro = poner(e, 1, "mano", "Valefor");
  const carcosa = poner(e, 0, "mano", "Carcosa");
  e = sinRespuesta(hacer(e, jugar(carcosa), 1));
  assert.equal(zonaDe(e, tal), "destierro");
  assert.equal(zonaDe(e, otro), "mano");
  assert.equal(e.jugadores[0].mano.length, 1);
});

test("Carcosa: al comienzo del turno oponente su controlador elige entre Desterrar una carta o un Talismán y Roba", () => {
  let e = mesa();
  poner(e, 0, "apoyo", "Carcosa");
  poner(e, 1, "defensa", "Valefor");
  e = avanzarHasta(e, (x) => x.turno === 2 && x.pendiente);
  assert.equal(e.pendiente.jugador, 0);
  assert.deepEqual(e.pendiente.opciones.map((o) => o.texto), ["Desterrar una carta que no sea Oro", "Desterrar un Talismán de la mano oponente"]);
});

test("Carcosa: al comienzo de tu turno tu oponente Bota cuatro cartas", () => {
  let e = mesa();
  poner(e, 0, "apoyo", "Carcosa");
  e = avanzarHasta(e, (x) => x.turno >= 3 && x.fase === "vigilia" && !x.pendiente);
  assert.equal(e.turno, 3);
  assert.equal(e.jugadores[1].cementerio.length, 4);
  assert.equal(e.jugadores[1].castillo.length, 25);
});

test("Carcosa: cuando sale del juego tu oponente Bota cuatro cartas", () => {
  let e = mesa();
  oros(e, 0, 2);
  const carcosa = poner(e, 0, "mano", "Carcosa");
  e = sinRespuesta(hacer(e, jugar(carcosa), 0));
  assert.equal(zonaDe(e, carcosa), "destierro");
  assert.equal(e.jugadores[1].cementerio.length, 4);
  assert.equal(e.jugadores[1].castillo.length, 26);
  assert.equal(e.jugadores[0].mano.length, 1);
});

test("Templo Gótico: al entrar Baraja hasta dos cartas cuyos costes suman 4 o menos", () => {
  let e = mesa();
  oros(e, 0, 2);
  const mecha = poner(e, 0, "defensa", "Mecha-Daikaiju");
  const rv = poner(e, 1, "defensa", "Valefor");
  const rp = poner(e, 1, "defensa", "Sir Persival");
  const templo = poner(e, 0, "mano", "Templo Gótico");
  e = sinRespuesta(hacer(e, jugar(templo), 0, rp));
  const valores = e.pendiente.opciones.map((o) => o.valor);
  assert.ok(valores.includes(rv));
  assert.ok(!valores.includes(mecha));
  e = elegir(e, rv);
  assert.equal(zonaDe(e, rp), "castillo");
  assert.equal(zonaDe(e, rv), "castillo");
  assert.equal(zonaDe(e, mecha), "defensa");
});

test("Templo Gótico: al entrar puede buscar dos cartas en tu Castillo y ponerlas en tu mano", () => {
  let e = mesa();
  oros(e, 0, 2);
  const [a, b] = castilloConTope(e, 0, ["Valefor", "Carcosa"]);
  const templo = poner(e, 0, "mano", "Templo Gótico");
  e = sinRespuesta(hacer(e, jugar(templo), 1, a, b));
  assert.equal(zonaDe(e, a), "mano");
  assert.equal(zonaDe(e, b), "mano");
  assert.equal(e.jugadores[0].mano.length, 2);
});

test("Templo Gótico: en tu Fase Final Baraja hasta tantas cartas de los Cementerios como Oros controles", () => {
  let e = mesa();
  oros(e, 0, 2);
  poner(e, 0, "apoyo", "Templo Gótico");
  const c = [poner(e, 0, "cementerio", "Valefor"), poner(e, 0, "cementerio", "El Dracul"), poner(e, 1, "cementerio", "Carcosa")];
  e = aplicar(e, { tipo: "terminar" });
  assert.ok(e.pendiente);
  e = elegir(elegir(e, noNulo), noNulo);
  assert.equal(e.pendiente, null);
  assert.equal(c.filter((u) => zonaDe(e, u) === "cementerio").length, 1);
});

test("Templo Gótico: en tu Vigilia Baraja hasta tantas cartas de los Cementerios como Oros controles", () => {
  let e = mesa();
  oros(e, 0, 2);
  poner(e, 0, "apoyo", "Templo Gótico");
  poner(e, 0, "cementerio", "Valefor");
  poner(e, 1, "cementerio", "Carcosa");
  e = avanzarHasta(e, (x) => x.turno >= 3 && (x.pendiente || x.fase === "vigilia"));
  assert.equal(e.turno, 3);
  assert.ok(e.pendiente);
});

test("Abadía de Carfax: los Aliados que controlas ganan 1 de Fuerza", () => {
  const e = mesa();
  poner(e, 0, "apoyo", "Abadía de Carfax");
  const propio = poner(e, 0, "defensa", "Valefor");
  const ajeno = poner(e, 1, "defensa", "Valefor");
  assert.equal(N.fuerza(e, propio), 4);
  assert.equal(N.fuerza(e, ajeno), 3);
});

test("Abadía de Carfax: al entrar Robas dos cartas y Desterras una carta de tu mano", () => {
  let e = mesa();
  oros(e, 0, 1);
  const abadia = poner(e, 0, "mano", "Abadía de Carfax");
  e = sinRespuesta(aplicar(e, jugar(abadia)));
  const elegida = e.pendiente.opciones[0].valor;
  e = hacer(e, { tipo: "elegir", i: 0 }, "Desterrar");
  assert.equal(zonaDe(e, elegida), "destierro");
  assert.equal(e.jugadores[0].mano.length, 1);
});

test("Abadía de Carfax: al entrar puede Barajar en vez de Desterrar una carta de tu mano", () => {
  let e = mesa();
  oros(e, 0, 1);
  const abadia = poner(e, 0, "mano", "Abadía de Carfax");
  e = sinRespuesta(aplicar(e, jugar(abadia)));
  const elegida = e.pendiente.opciones[0].valor;
  e = hacer(e, { tipo: "elegir", i: 0 }, "Barajar");
  assert.equal(zonaDe(e, elegida), "castillo");
  assert.equal(e.jugadores[0].mano.length, 1);
});

test("Abadía de Carfax: al salir del juego Robas dos cartas y Desterras una carta de tu mano", () => {
  let e = mesa();
  oros(e, 0, 2);
  const abadia = poner(e, 0, "apoyo", "Abadía de Carfax");
  const carcosa = poner(e, 0, "mano", "Carcosa");
  e = sinRespuesta(hacer(e, jugar(carcosa), 0, abadia));
  assert.equal(zonaDe(e, abadia), "destierro");
  const elegida = e.pendiente.opciones[0].valor;
  e = elegir(elegir(e, elegida), "Desterrar");
  assert.equal(zonaDe(e, elegida), "destierro");
});

test("Abadía de Carfax: no puede ser afectada por cartas de coste 1", () => {
  let e = mesa();
  oros(e, 0, 1);
  const v = poner(e, 0, "defensa", "Valefor");
  const rv = poner(e, 1, "defensa", "Valefor");
  const abadia = poner(e, 1, "apoyo", "Abadía de Carfax");
  oros(e, 1, 1);
  const espada = poner(e, 0, "mano", "Espada Vikinga");
  e = sinRespuesta(aplicar(e, jugar(espada, { portador: v })));
  const valores = e.pendiente.opciones.map((o) => o.valor);
  assert.ok(valores.includes(rv));
  assert.ok(!valores.includes(abadia));
});

test("Abadía de Carfax: sí puede ser afectada por cartas de coste distinto de 1", () => {
  let e = mesa();
  oros(e, 0, 2);
  const abadia = poner(e, 1, "apoyo", "Abadía de Carfax");
  const carcosa = poner(e, 0, "mano", "Carcosa");
  e = sinRespuesta(hacer(e, jugar(carcosa), 0));
  assert.ok(e.pendiente.opciones.map((o) => o.valor).includes(abadia));
});
