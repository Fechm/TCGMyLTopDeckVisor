import { test } from "node:test";
import assert from "node:assert/strict";
import { mesa, poner, oros, hacer, elegir, sinRespuesta, accionesLegales, aplicar, zonaDe, id, N } from "./ayuda-duelo.mjs";
import { costeDe } from "../web/duelo/motor.js";
import { disponibles } from "../web/duelo/efectos.js";

const jugar = (uid, extra = {}) => ({ tipo: "jugar", uid, ...extra });
const habilidad = (uid, nombre, h = 0) => ({ tipo: "habilidad", uid, def: id(nombre), h });
const nombreDe = (e, nombre) => (v) => v !== null && N.carta(e, v).nombre === nombre;
const puedeUsar = (e, uid) => accionesLegales(e).some((a) => a.tipo === "habilidad" && a.uid === uid);

function atacar(e, uid) {
  e = aplicar(e, { tipo: "batalla" });
  return aplicar(e, { tipo: "atacar", uid });
}

function alDano(e) {
  e = aplicar(e, { tipo: "finAtaque" });
  e = aplicar(e, { tipo: "finBloqueo" });
  e = aplicar(e, { tipo: "pasar" });
  return aplicar(e, { tipo: "pasar" });
}

function rivalAtaca(e, uid) {
  e.activo = 1;
  e.fase = "vigilia";
  return alDano(atacar(e, uid));
}

test("Draig Ifang: al entrar en juego puedes Robar una carta", () => {
  let e = mesa();
  oros(e, 0, 3);
  const ifang = poner(e, 0, "mano", "Draig Ifang");
  e = hacer(e, jugar(ifang), true);
  assert.equal(e.jugadores[0].mano.length, 1);
});

test("Draig Ifang: si es Destruido y solo controlabas Dragones, buscas un Oro y lo pones en tu Oro Pagado", () => {
  let e = mesa();
  oros(e, 0, 3);
  const ifang = poner(e, 0, "defensa", "Draig Ifang");
  const gente = poner(e, 0, "mano", "Gente Reptil");
  e = hacer(e, jugar(gente), ifang, null, true);
  e = elegir(e, nombreDe(e, "Drácula"));
  assert.equal(zonaDe(e, ifang), "cementerio");
  assert.equal(e.jugadores[0].pagado.length, 4);
  assert.equal(e.jugadores[0].castillo.length, 29);
});

test("Draig Ifang: si controlabas un Aliado que no es Dragón no busca el Oro", () => {
  let e = mesa();
  oros(e, 0, 3);
  const ifang = poner(e, 0, "defensa", "Draig Ifang");
  poner(e, 0, "defensa", "Sir Persival");
  const gente = poner(e, 0, "mano", "Gente Reptil");
  e = hacer(e, jugar(gente), ifang, null);
  assert.equal(zonaDe(e, ifang), "cementerio");
  assert.equal(e.pendiente, null);
  assert.equal(e.jugadores[0].pagado.length, 3);
});

test("Draig Wych: tiene Furia y al entrar pone la primera carta de tu Castillo en tu Oro Pagado como Oro sin habilidad", () => {
  let e = mesa();
  oros(e, 0, 1);
  const wych = poner(e, 0, "mano", "Draig Wych");
  const tope = e.jugadores[0].castillo[0];
  e = sinRespuesta(aplicar(e, jugar(wych)));
  assert.equal(N.tiene(e, wych, "Furia"), true);
  assert.equal(zonaDe(e, tope), "pagado");
  assert.equal(N.carta(e, tope).tipo, "Oro");
  assert.equal(N.carta(e, tope).sinHabilidad, true);
  assert.equal(e.jugadores[0].pagado.length, 2);
});

test("Duque Glauru: tiene Furia e Imbloqueable", () => {
  const e = mesa();
  const g = poner(e, 0, "defensa", "Duque Glauru");
  assert.equal(N.tiene(e, g, "Furia"), true);
  assert.equal(N.tiene(e, g, "Imbloqueable"), true);
});

test("Duque Glauru: desde la mano, pagando un Oro, busca un Aliado de coste 3 o más, hasta dos veces por turno", () => {
  let e = mesa();
  oros(e, 0, 3);
  const g = poner(e, 0, "mano", "Duque Glauru");
  const d1 = poner(e, 0, "castillo", "Draco Conjurador");
  const d2 = poner(e, 0, "castillo", "Draco Conjurador");
  const v = poner(e, 0, "castillo", "Valefor");
  e = aplicar(e, habilidad(g, "Duque Glauru"));
  assert.deepEqual(e.pendiente.opciones.map((o) => o.valor).filter((x) => x !== null).map((x) => N.carta(e, x).nombre), ["Draco Conjurador"]);
  e = elegir(e, nombreDe(e, "Draco Conjurador"));
  e = hacer(e, habilidad(g, "Duque Glauru"), nombreDe(e, "Draco Conjurador"));
  assert.equal(zonaDe(e, d1), "mano");
  assert.equal(zonaDe(e, d2), "mano");
  assert.equal(zonaDe(e, v), "castillo");
  assert.equal(zonaDe(e, g), "mano");
  assert.equal(e.jugadores[0].pagado.length, 2);
  assert.equal(puedeUsar(e, g), false);
});

test("Duvel: tiene Exhumar y Descartando una carta Destruye una carta que no sea Oro", () => {
  let e = mesa();
  const duvel = poner(e, 0, "defensa", "Duvel");
  const x = poner(e, 0, "mano", "Valefor");
  const p = poner(e, 1, "defensa", "Sir Persival");
  assert.equal(N.tiene(e, duvel, "Exhumar"), true);
  e = hacer(e, habilidad(duvel, "Duvel"), "Destruir una carta que no sea Oro", p);
  assert.equal(zonaDe(e, x), "cementerio");
  assert.equal(zonaDe(e, p), "cementerio");
  assert.equal(puedeUsar(e, duvel) && accionesLegales(e).some((a) => a.uid === duvel && a.h === 0), false);
});

test("Duvel: Descartando una carta puedes buscar un Aliado en tu Castillo", () => {
  let e = mesa();
  const duvel = poner(e, 0, "defensa", "Duvel");
  poner(e, 0, "mano", "Valefor");
  const d = poner(e, 0, "castillo", "Draco Conjurador");
  e = hacer(e, habilidad(duvel, "Duvel"), "Buscar un Aliado en tu Castillo", d);
  assert.equal(zonaDe(e, d), "mano");
});

test("Duvel: una vez por turno un Aliado gana Furia y 1 de Fuerza por el turno", () => {
  let e = mesa();
  const duvel = poner(e, 0, "defensa", "Duvel");
  e = aplicar(e, habilidad(duvel, "Duvel", 1));
  assert.equal(N.fuerza(e, duvel), 5);
  assert.equal(N.tiene(e, duvel, "Furia"), true);
  assert.equal(accionesLegales(e).some((a) => a.uid === duvel && a.h === 1), false);
  N.expirar(e, "finTurno");
  e.turno += 1;
  N.expirar(e, "finTurno");
  assert.equal(N.fuerza(e, duvel), 4);
});

test("Fenrir: tiene Furia, al entrar Roba dos y Destierra dos cartas de distinto nombre del Castillo oponente", () => {
  let e = mesa();
  oros(e, 0, 2);
  const f = poner(e, 0, "mano", "Fenrir, Tenebris Desencadenado");
  const v = poner(e, 1, "castillo", "Valefor");
  e = aplicar(e, jugar(f));
  e = elegir(e, nombreDe(e, "Drácula"));
  assert.deepEqual(e.pendiente.opciones.map((o) => o.valor).filter((x) => x !== null).map((x) => N.carta(e, x).nombre), ["Valefor"]);
  e = elegir(e, v);
  assert.equal(N.tiene(e, f, "Furia"), true);
  assert.equal(e.jugadores[0].mano.length, 2);
  assert.equal(e.jugadores[1].destierro.length, 2);
  assert.equal(zonaDe(e, v), "destierro");
});

test("Fenrir: el ataque de tus Aliados de coste 2 o menos no puede ser cancelado", { todo: "efecto: el ataque de ciertos Aliados no puede ser cancelado" }, () => {
  const e = mesa();
  poner(e, 0, "defensa", "Fenrir, Tenebris Desencadenado");
  const v = poner(e, 0, "defensa", "Valefor");
  assert.equal(N.tiene(e, v, "AtaqueNoCancelable"), true);
});

test("Gente Reptil: tiene Exhumar y Furia; jugada desde el Cementerio Destruye hasta dos cartas que no sean Oro", () => {
  let e = mesa();
  oros(e, 0, 3);
  const g = poner(e, 0, "cementerio", "Gente Reptil");
  const a = poner(e, 1, "defensa", "Sir Persival");
  const b = poner(e, 1, "defensa", "Sir Persival");
  const c = poner(e, 1, "defensa", "Sir Persival");
  e = hacer(e, jugar(g, { desde: "cementerio" }), a, b);
  assert.equal(N.tiene(e, g, "Furia"), true);
  assert.equal(zonaDe(e, g), "defensa");
  assert.deepEqual([a, b, c].map((u) => zonaDe(e, u)), ["cementerio", "cementerio", "defensa"]);
});

test("Gran Dragón: tiene Furia y al entrar Baraja hasta dos cartas cuyos costes sumen 3 o menos", () => {
  let e = mesa();
  oros(e, 0, 2);
  const g = poner(e, 0, "mano", "Gran Dragón");
  const v1 = poner(e, 1, "defensa", "Valefor");
  const v2 = poner(e, 1, "defensa", "Valefor");
  const p = poner(e, 1, "defensa", "Sir Persival");
  e = aplicar(e, jugar(g));
  e = elegir(e, v1);
  assert.equal(e.pendiente.opciones.some((o) => o.valor === p), false);
  e = elegir(e, v2);
  assert.equal(N.tiene(e, g, "Furia"), true);
  assert.equal(zonaDe(e, v1), "castillo");
  assert.equal(zonaDe(e, v2), "castillo");
  assert.equal(zonaDe(e, p), "defensa");
});

test("Gran Dragón: al atacar también Baraja hasta dos cartas cuyos costes sumen 3 o menos", () => {
  let e = mesa();
  const g = poner(e, 0, "defensa", "Gran Dragón");
  const p = poner(e, 1, "defensa", "Sir Persival");
  e = atacar(e, g);
  e = elegir(e, p);
  assert.equal(zonaDe(e, p), "castillo");
});

test("Gran Dragón: una vez por turno pone un Oro de tu mano o Cementerio en tu Oro Pagado", () => {
  let e = mesa();
  const g = poner(e, 0, "defensa", "Gran Dragón");
  const o = poner(e, 0, "cementerio", "Drácula");
  e = aplicar(e, habilidad(g, "Gran Dragón"));
  assert.equal(zonaDe(e, o), "pagado");
  assert.equal(puedeUsar(e, g), false);
});

test("Gran Dragón: gana Fuerza igual a los Oros en tu Oro Pagado", () => {
  const e = mesa();
  const g = poner(e, 0, "defensa", "Gran Dragón");
  assert.equal(N.fuerza(e, g), 3);
  poner(e, 0, "pagado", "Drácula");
  poner(e, 0, "pagado", "Drácula");
  poner(e, 1, "pagado", "Drácula");
  assert.equal(N.fuerza(e, g), 5);
});

test("Gusano Blanco: tiene Exhumar y pone un Oro de un Cementerio en tu Reserva; cada Oro que entra hace Botar tres, hasta tres veces por turno", () => {
  let e = mesa();
  oros(e, 0, 2);
  const g = poner(e, 0, "defensa", "Gusano Blanco");
  const enMano = poner(e, 0, "mano", "Drácula");
  const delRival = poner(e, 1, "cementerio", "Drácula");
  const w1 = poner(e, 0, "mano", "Draig Wych");
  const w2 = poner(e, 0, "mano", "Draig Wych");
  assert.equal(N.tiene(e, g, "Exhumar"), true);
  e = aplicar(e, { tipo: "oro", uid: enMano });
  assert.equal(e.jugadores[1].castillo.length, 27);
  e = hacer(e, habilidad(g, "Gusano Blanco"), delRival);
  assert.equal(zonaDe(e, delRival), "reserva");
  assert.equal(N.controlador(e, delRival), 0);
  assert.equal(e.jugadores[1].castillo.length, 24);
  e = sinRespuesta(aplicar(e, jugar(w1)));
  assert.equal(e.jugadores[1].castillo.length, 21);
  e = sinRespuesta(aplicar(e, jugar(w2)));
  assert.equal(e.jugadores[1].castillo.length, 21);
  assert.equal(puedeUsar(e, g), false);
});

test("Jabberwocky Desatado: Desterrando un Aliado que controlas genera tantos Oros como su coste", () => {
  let e = mesa();
  const j = poner(e, 0, "defensa", "Jabberwocky Desatado");
  const d = poner(e, 0, "defensa", "Draco Conjurador");
  assert.equal(N.tiene(e, j, "Exhumar"), true);
  e = hacer(e, habilidad(j, "Jabberwocky Desatado"), d);
  assert.equal(zonaDe(e, d), "destierro");
  assert.equal(disponibles(e, 0), 3);
  assert.equal(puedeUsar(e, j) && accionesLegales(e).some((a) => a.uid === j && a.h === 0), false);
});

test("Jabberwocky Desatado: una vez en tu turno Roba tres y Descarta una", () => {
  let e = mesa();
  const j = poner(e, 0, "defensa", "Jabberwocky Desatado");
  e = aplicar(e, habilidad(j, "Jabberwocky Desatado", 1));
  e = elegir(e, "Robar tres y Descartar una");
  e = elegir(e, (v) => v !== null);
  assert.equal(e.jugadores[0].mano.length, 2);
  assert.equal(e.jugadores[0].cementerio.length, 1);
});

test("Jabberwocky Desatado: o busca un Aliado en tu Castillo", () => {
  let e = mesa();
  const j = poner(e, 0, "defensa", "Jabberwocky Desatado");
  const d = poner(e, 0, "castillo", "Draco Conjurador");
  e = hacer(e, habilidad(j, "Jabberwocky Desatado", 1), "Buscar un Aliado en tu Castillo", d);
  assert.equal(zonaDe(e, d), "mano");
});

test("Jaculus: al entrar busca un Aliado Dragón de coste 3 o más y lo juega reduciendo su coste en un Oro", () => {
  let e = mesa();
  oros(e, 0, 3);
  const jac = poner(e, 0, "mano", "Jaculus");
  const d = poner(e, 0, "castillo", "Draco Conjurador");
  poner(e, 0, "castillo", "Sir Persival");
  e = aplicar(e, jugar(jac));
  e = elegir(e, true);
  assert.deepEqual(e.pendiente.opciones.map((o) => o.valor).filter((x) => x !== null).map((x) => N.carta(e, x).nombre), ["Draco Conjurador"]);
  e = elegir(e, d);
  assert.equal(zonaDe(e, d), "defensa");
  assert.equal(e.jugadores[0].pagado.length, 3);
});

test("Jaculus: Desterrándolo Destruye una carta de coste 1 o menos", () => {
  let e = mesa();
  const jac = poner(e, 0, "defensa", "Jaculus");
  const v = poner(e, 1, "defensa", "Valefor");
  poner(e, 1, "defensa", "Sir Persival");
  e = aplicar(e, habilidad(jac, "Jaculus"));
  assert.equal(zonaDe(e, jac), "destierro");
  assert.equal(zonaDe(e, v), "cementerio");
});

test("Jaculus: Desterrándolo puede Anular una carta de coste 1 o menos", () => {
  let e = mesa();
  const jac = poner(e, 0, "defensa", "Jaculus");
  e.activo = 1;
  oros(e, 1, 1);
  const v = poner(e, 1, "mano", "Valefor");
  e = aplicar(e, jugar(v));
  const r = accionesLegales(e).find((a) => a.tipo === "responder" && a.uid === jac);
  assert.ok(r);
  e = sinRespuesta(aplicar(e, r));
  assert.equal(zonaDe(e, jac), "destierro");
  assert.equal(zonaDe(e, v), "cementerio");
});

test("Jaculus: no puede Anular cartas de coste 2 o más ni usar el Anular fuera de respuesta", () => {
  let e = mesa();
  const jac = poner(e, 0, "defensa", "Jaculus");
  assert.equal(accionesLegales(e).some((a) => a.tipo === "habilidad" && a.uid === jac && a.h === 1), false);
  e.activo = 1;
  oros(e, 1, 2);
  const d = poner(e, 1, "mano", "Gran Dragón");
  e = aplicar(e, jugar(d));
  assert.equal(accionesLegales(e).some((a) => a.tipo === "responder" && a.uid === jac), false);
});

test("Jormundgander: tiene Furia y al entrar Roba una carta", () => {
  let e = mesa();
  oros(e, 0, 1);
  const j = poner(e, 0, "mano", "Jormundgander");
  e = sinRespuesta(aplicar(e, jugar(j)));
  assert.equal(N.tiene(e, j, "Furia"), true);
  assert.equal(e.jugadores[0].mano.length, 1);
});

test("Jormundgander: cuando hace daño puedes convertirlo en un Oro en tu Oro Pagado", () => {
  let e = mesa();
  const j = poner(e, 0, "defensa", "Jormundgander");
  e = alDano(atacar(e, j));
  e = elegir(e, true);
  assert.equal(zonaDe(e, j), "pagado");
  assert.equal(N.carta(e, j).tipo, "Oro");
  assert.equal(N.ubicar(e, j).j, 0);
});

test("Jormundgander: siendo Oro, al pagarlo para jugar un Aliado vuelve a ser Aliado en tu Línea de Defensa", () => {
  let e = mesa();
  const j = poner(e, 0, "reserva", "Jormundgander");
  e.conv[j] = { tipo: "Oro", como: id("Jormundgander"), sinHabilidad: false, desde: 0 };
  const v = poner(e, 0, "mano", "Valefor");
  e = sinRespuesta(aplicar(e, jugar(v)));
  assert.equal(zonaDe(e, j), "defensa");
  assert.equal(N.carta(e, j).tipo, "Aliado");
  assert.equal(zonaDe(e, v), "defensa");
});

test("Jormundgander: siendo Oro, pagarlo para un Talismán no lo convierte", () => {
  let e = mesa();
  const j = poner(e, 0, "reserva", "Jormundgander");
  e.conv[j] = { tipo: "Oro", como: id("Jormundgander"), sinHabilidad: false, desde: 0 };
  const m = poner(e, 0, "mano", "Llamar a la Manada");
  e = sinRespuesta(aplicar(e, jugar(m)));
  assert.equal(zonaDe(e, j), "pagado");
  assert.equal(N.carta(e, j).tipo, "Oro");
});

test("La Última Bestia: si no la jugaste desde tu mano genera un Oro para jugar Aliados", () => {
  let e = mesa();
  oros(e, 0, 2);
  const b = poner(e, 0, "cementerio", "La Última Bestia");
  assert.equal(N.tiene(e, b, "Exhumar"), true);
  e = sinRespuesta(aplicar(e, jugar(b, { desde: "cementerio" })));
  assert.equal(zonaDe(e, b), "defensa");
  assert.deepEqual(e.jugadores[0].generados, [{ n: 1, tipos: ["Aliado"] }]);
});

test("La Última Bestia: jugada desde la mano no genera Oro", () => {
  let e = mesa();
  oros(e, 0, 2);
  const b = poner(e, 0, "mano", "La Última Bestia");
  e = sinRespuesta(aplicar(e, jugar(b)));
  assert.deepEqual(e.jugadores[0].generados ?? [], []);
});

test("La Última Bestia: pagando un Oro juega un Aliado de tu Cementerio reduciendo su coste en un Oro", () => {
  let e = mesa();
  oros(e, 0, 3);
  const b = poner(e, 0, "defensa", "La Última Bestia");
  const d = poner(e, 0, "cementerio", "Draco Conjurador");
  e = aplicar(e, habilidad(b, "La Última Bestia"));
  assert.equal(zonaDe(e, d), "defensa");
  assert.equal(e.jugadores[0].pagado.length, 3);
  assert.equal(puedeUsar(e, b), false);
});

test("La Última Bestia: el coste reducido tiene un mínimo de 1", () => {
  let e = mesa();
  oros(e, 0, 2);
  const b = poner(e, 0, "defensa", "La Última Bestia");
  const v = poner(e, 0, "cementerio", "Valefor");
  e = aplicar(e, habilidad(b, "La Última Bestia"));
  assert.equal(zonaDe(e, v), "defensa");
  assert.equal(e.jugadores[0].pagado.length, 2);
});

test("La Última Bestia: pagando un Oro puede Anular una carta, y eso gasta su uso del turno", () => {
  let e = mesa();
  oros(e, 0, 3);
  const b = poner(e, 0, "defensa", "La Última Bestia");
  poner(e, 0, "cementerio", "Draco Conjurador");
  e.activo = 1;
  oros(e, 1, 1);
  const v = poner(e, 1, "mano", "Valefor");
  e = aplicar(e, jugar(v));
  const r = accionesLegales(e).find((a) => a.tipo === "responder" && a.uid === b);
  assert.ok(r);
  e = sinRespuesta(aplicar(e, r));
  assert.equal(zonaDe(e, v), "cementerio");
  assert.equal(e.jugadores[0].pagado.length, 1);
  e.activo = 0;
  e.fase = "vigilia";
  assert.equal(puedeUsar(e, b), false);
});

test("La Última Bestia: tras jugar un Aliado de tu Cementerio ya no puede Anular ese turno", () => {
  let e = mesa();
  oros(e, 0, 5);
  const b = poner(e, 0, "defensa", "La Última Bestia");
  poner(e, 0, "cementerio", "Valefor");
  e = aplicar(e, habilidad(b, "La Última Bestia"));
  e.activo = 1;
  oros(e, 1, 1);
  const v = poner(e, 1, "mano", "Valefor");
  e = aplicar(e, jugar(v));
  assert.equal(accionesLegales(e).some((a) => a.tipo === "responder" && a.uid === b), false);
});

test("Leviathan: al entrar Destierra hasta dos cartas que no sean Oro y Roba dos", () => {
  let e = mesa();
  oros(e, 0, 4);
  const l = poner(e, 0, "mano", "Leviathan");
  const a = poner(e, 1, "defensa", "Sir Persival");
  const b = poner(e, 1, "defensa", "Valefor");
  e = hacer(e, jugar(l), a, b);
  assert.equal(zonaDe(e, a), "destierro");
  assert.equal(zonaDe(e, b), "destierro");
  assert.equal(e.jugadores[0].mano.length, 2);
});

test("Leviathan: Destruyendo un Oro tuyo gana el control de un Oro oponente y lo Baraja en tu Fase Final", () => {
  let e = mesa();
  const l = poner(e, 0, "defensa", "Leviathan");
  const mio = poner(e, 0, "reserva", "Drácula");
  const suyo = poner(e, 1, "reserva", "Drácula");
  e = aplicar(e, habilidad(l, "Leviathan"));
  assert.equal(zonaDe(e, mio), "cementerio");
  assert.equal(N.controlador(e, suyo), 0);
  assert.equal(puedeUsar(e, l), false);
  e = aplicar(e, { tipo: "terminar" });
  assert.equal(zonaDe(e, suyo), "castillo");
  assert.equal(N.dueno(suyo), 1);
  assert.equal(e.jugadores[1].castillo.length, 31);
});

test("Leviathan: no recibes daño de combate", () => {
  let e = mesa();
  poner(e, 0, "defensa", "Leviathan");
  const p = poner(e, 1, "defensa", "Sir Persival");
  e = rivalAtaca(e, p);
  assert.equal(e.jugadores[0].castillo.length, 30);
  assert.equal(e.jugadores[0].cementerio.length, 0);

  let f = mesa();
  const q = poner(f, 1, "defensa", "Sir Persival");
  f = rivalAtaca(f, q);
  assert.equal(f.jugadores[0].castillo.length, 28);
});

test("Leviathan: no puede ser Barajado", () => {
  let e = mesa();
  oros(e, 0, 2);
  const l = poner(e, 1, "defensa", "Leviathan");
  const g = poner(e, 0, "mano", "Gran Dragón");
  e = sinRespuesta(aplicar(e, jugar(g)));
  assert.equal(e.pendiente?.opciones.some((o) => o.valor === l) ?? false, false);
  if (e.pendiente) e = elegir(e, null);
  const mortaja = poner(e, 0, "mano", "Mortaja");
  oros(e, 0, 3);
  e = sinRespuesta(aplicar(e, jugar(mortaja)));
  assert.equal(zonaDe(e, g), "castillo");
  assert.equal(zonaDe(e, l), "defensa");
});

test("Lluhay: cuando este u otro Aliado Dragón entra bajo tu control el oponente Bota tantas cartas como su Fuerza, hasta dos veces por turno", () => {
  let e = mesa();
  oros(e, 0, 4);
  const l = poner(e, 0, "mano", "Lluhay");
  const v1 = poner(e, 0, "mano", "Valefor");
  const v2 = poner(e, 0, "mano", "Valefor");
  const p = poner(e, 0, "mano", "Sir Persival");
  e = sinRespuesta(aplicar(e, jugar(l)));
  assert.equal(e.jugadores[1].castillo.length, 27);
  e = sinRespuesta(aplicar(e, jugar(v1)));
  assert.equal(e.jugadores[1].castillo.length, 24);
  e = sinRespuesta(aplicar(e, jugar(v2)));
  assert.equal(e.jugadores[1].castillo.length, 24);
  assert.equal(zonaDe(e, p), "mano");
});

test("Lluhay: no se dispara con Aliados que no son Dragón", () => {
  let e = mesa();
  oros(e, 0, 3);
  poner(e, 0, "defensa", "Lluhay");
  const p = poner(e, 0, "mano", "Sir Persival");
  e = sinRespuesta(aplicar(e, jugar(p)));
  assert.equal(e.jugadores[1].castillo.length, 30);
});

test("Lluhay: no puede ser afectado por Aliados", () => {
  let e = mesa();
  oros(e, 0, 3);
  const l = poner(e, 1, "defensa", "Lluhay");
  const p = poner(e, 1, "defensa", "Sir Persival");
  const g = poner(e, 0, "mano", "Gente Reptil");
  e = sinRespuesta(aplicar(e, jugar(g)));
  assert.equal(e.pendiente.opciones.some((o) => o.valor === l), false);
  assert.equal(e.pendiente.opciones.some((o) => o.valor === p), true);
});

test("Lord Ruthven: tiene Exhumar y al entrar puedes poner un Oro de tu mano en tu Oro Pagado", () => {
  let e = mesa();
  oros(e, 0, 2);
  const r = poner(e, 0, "mano", "Lord Ruthven");
  const o = poner(e, 0, "mano", "Drácula");
  e = hacer(e, jugar(r), true);
  assert.equal(N.tiene(e, r, "Exhumar"), true);
  assert.equal(zonaDe(e, o), "pagado");
  assert.equal(e.jugadores[0].pagado.length, 3);
});

test("Lord Ruthven: cuando hace daño también puede poner un Oro de tu mano en tu Oro Pagado", () => {
  let e = mesa();
  const r = poner(e, 0, "defensa", "Lord Ruthven");
  const o = poner(e, 0, "mano", "Drácula");
  e = alDano(atacar(e, r));
  e = elegir(e, true);
  assert.equal(zonaDe(e, o), "pagado");
});

test("Lord Ruthven: busca hasta tres cartas de distinto tipo en cada Castillo y las pone en el Destierro de su dueño", () => {
  let e = mesa();
  const r = poner(e, 0, "defensa", "Lord Ruthven");
  poner(e, 0, "castillo", "Valefor");
  poner(e, 0, "castillo", "Llamar a la Manada");
  e = aplicar(e, habilidad(r, "Lord Ruthven"));
  e = elegir(e, nombreDe(e, "Drácula"));
  assert.equal(e.pendiente.opciones.some((o) => o.valor !== null && N.carta(e, o.valor).tipo === "Oro"), false);
  e = elegir(e, nombreDe(e, "Valefor"));
  e = elegir(e, nombreDe(e, "Llamar a la Manada"));
  e = elegir(e, nombreDe(e, "Drácula"));
  e = elegir(e, "Destierro");
  assert.deepEqual(e.jugadores[0].destierro.map((u) => N.carta(e, u).nombre).sort(), ["Drácula", "Llamar a la Manada", "Valefor"]);
  assert.equal(e.jugadores[1].destierro.length, 1);
  assert.equal(e.jugadores[0].castillo.length, 29);
  assert.equal(puedeUsar(e, r), false);
});

test("Mordred: en tu Vigilia Destierra cartas del Cementerio oponente según tus Oros y un Aliado gana Furia y Fuerza por cada Aliado en el Destierro oponente", () => {
  let e = mesa();
  oros(e, 0, 2);
  const m = poner(e, 0, "defensa", "Mordred, el Traidor Tenebris");
  const c = [1, 2, 3].map(() => poner(e, 1, "cementerio", "Valefor"));
  poner(e, 1, "destierro", "Sir Persival");
  assert.equal(N.tiene(e, m, "Exhumar"), true);
  e = hacer(e, habilidad(m, "Mordred, el Traidor Tenebris"), c[0], c[1]);
  assert.deepEqual(c.map((u) => zonaDe(e, u)), ["destierro", "destierro", "cementerio"]);
  assert.equal(N.fuerza(e, m), 3);
  assert.equal(N.tiene(e, m, "Furia"), true);
  assert.equal(puedeUsar(e, m), false);
});

test("Mordred: su habilidad no se puede usar fuera de tu Vigilia", () => {
  const e = mesa();
  const m = poner(e, 0, "defensa", "Mordred, el Traidor Tenebris");
  e.fase = "talismanes";
  e.prioridad = 0;
  assert.equal(puedeUsar(e, m), false);
});

test("Nefandos: al entrar juega gratis un Aliado de coste 2 o menos de tu mano o Cementerio", () => {
  let e = mesa();
  oros(e, 0, 3);
  const n = poner(e, 0, "mano", "Nefandos");
  const v = poner(e, 0, "cementerio", "Valefor");
  poner(e, 0, "cementerio", "Draco Conjurador");
  e = hacer(e, jugar(n), true);
  assert.equal(zonaDe(e, v), "defensa");
  assert.equal(e.jugadores[0].reserva.length, 0);
  assert.equal(N.tiene(e, n, "Furia"), true);
  assert.equal(N.tiene(e, n, "Exhumar"), true);
});

test("Nefandos: tus demás Aliados no pueden ser Desterrados y hacen daño de combate al Destierro", () => {
  const e = mesa();
  const n = poner(e, 0, "defensa", "Nefandos");
  const v = poner(e, 0, "defensa", "Valefor");
  const r = poner(e, 1, "defensa", "Valefor");
  assert.equal(N.tiene(e, v, "Indesterrable"), true);
  assert.equal(N.tiene(e, v, "DanoAlDestierro"), true);
  assert.equal(N.tiene(e, r, "Indesterrable"), false);
  assert.equal(N.tiene(e, n, "Indesterrable"), false);
  assert.equal(N.tiene(e, n, "DanoAlDestierro"), false);
});

test("Nguruvilu: reduce su coste por cada Oro que controles y Aliado en tu Cementerio, hasta un mínimo de 3", () => {
  const e = mesa();
  const n = poner(e, 0, "mano", "Nguruvilu");
  assert.equal(costeDe(e, 0, n).pagar, 8);
  oros(e, 0, 2);
  poner(e, 0, "cementerio", "Valefor");
  assert.equal(costeDe(e, 0, n).pagar, 5);
  oros(e, 0, 4);
  assert.equal(costeDe(e, 0, n).pagar, 3);
});

test("Nguruvilu: tiene Furia, Imbloqueable y no puede ser Anulado; al entrar Roba una carta por cada Oro pagado", () => {
  let e = mesa();
  oros(e, 0, 3);
  poner(e, 0, "cementerio", "Valefor");
  poner(e, 0, "cementerio", "Valefor");
  const n = poner(e, 0, "mano", "Nguruvilu");
  e = sinRespuesta(aplicar(e, jugar(n)));
  assert.equal(zonaDe(e, n), "defensa");
  assert.equal(e.jugadores[0].pagado.length, 3);
  assert.equal(e.jugadores[0].mano.length, 3);
  for (const k of ["Furia", "Imbloqueable", "NoAnulable"]) assert.equal(N.tiene(e, n, k), true);
});

test("Noth-Yidik: al entrar Roba tres; tus Aliados ganan 2 de Fuerza e Imbloqueable", () => {
  let e = mesa();
  oros(e, 0, 3);
  const n = poner(e, 0, "mano", "Noth-Yidik");
  const v = poner(e, 0, "defensa", "Valefor");
  const r = poner(e, 1, "defensa", "Valefor");
  e = sinRespuesta(aplicar(e, jugar(n)));
  assert.equal(e.jugadores[0].mano.length, 3);
  assert.equal(N.fuerza(e, v), 5);
  assert.equal(N.tiene(e, v, "Imbloqueable"), true);
  assert.equal(N.fuerza(e, r), 3);
  assert.equal(N.tiene(e, n, "Furia"), true);
});

test("Noth-Yidik: en la Fase Final Destierra hasta cinco cartas de los Cementerios", () => {
  let e = mesa();
  poner(e, 0, "defensa", "Noth-Yidik");
  const a = poner(e, 0, "cementerio", "Valefor");
  const b = poner(e, 1, "cementerio", "Valefor");
  e = aplicar(e, { tipo: "terminar" });
  e = elegir(e, a);
  e = elegir(e, b);
  assert.equal(zonaDe(e, a), "destierro");
  assert.equal(zonaDe(e, b), "destierro");
});

test("Pihuchen: no puede perder su habilidad y reduce su coste por cada Oro que controles, hasta un mínimo de 2", () => {
  const e = mesa();
  const p = poner(e, 0, "mano", "Pihuchen");
  assert.equal(costeDe(e, 0, p).pagar, 4);
  oros(e, 0, 1);
  assert.equal(costeDe(e, 0, p).pagar, 3);
  oros(e, 0, 4);
  assert.equal(costeDe(e, 0, p).pagar, 2);
  const enJuego = poner(e, 0, "defensa", "Pihuchen");
  N.agregarEfecto(e, { tipo: "pierdeHabilidad", uid: enJuego }, 1);
  assert.equal(N.activa(e, enJuego), true);
});

test("Pihuchen: para poner en juego Aliados de coste 2 o menos se Destierran dos cartas del tope del Castillo", () => {
  let e = mesa();
  oros(e, 0, 4);
  poner(e, 0, "defensa", "Pihuchen");
  const v = poner(e, 0, "mano", "Valefor");
  const p = poner(e, 0, "mano", "Sir Persival");
  e = sinRespuesta(aplicar(e, jugar(v)));
  assert.equal(e.jugadores[0].destierro.length, 2);
  assert.equal(e.jugadores[0].castillo.length, 28);
  e = sinRespuesta(aplicar(e, jugar(p)));
  assert.equal(e.jugadores[0].destierro.length, 2);
});

test("Piruquina: tiene Furia y reduce su coste por cada Oro que controles, hasta un mínimo de 1", () => {
  const e = mesa();
  const p = poner(e, 0, "mano", "Piruquina");
  assert.equal(N.tiene(e, p, "Furia"), true);
  assert.equal(costeDe(e, 0, p).pagar, 6);
  oros(e, 0, 3);
  assert.equal(costeDe(e, 0, p).pagar, 3);
  oros(e, 0, 5);
  assert.equal(costeDe(e, 0, p).pagar, 1);
});

test("Piruquina: desde tu mano, pagando un Oro, se pone al fondo de tu Castillo", () => {
  let e = mesa();
  oros(e, 0, 1);
  const p = poner(e, 0, "mano", "Piruquina");
  e = aplicar(e, habilidad(p, "Piruquina"));
  assert.equal(e.jugadores[0].castillo.at(-1), p);
  assert.equal(e.jugadores[0].pagado.length, 1);
});

test("Piruquina: reduce a cero el próximo daño a tu Castillo", () => {
  let e = mesa();
  oros(e, 0, 1);
  const p = poner(e, 0, "mano", "Piruquina");
  e = aplicar(e, habilidad(p, "Piruquina"));
  const s = poner(e, 1, "defensa", "Sir Persival");
  e = rivalAtaca(e, s);
  assert.equal(e.jugadores[0].castillo.length, 31);
  assert.equal(e.efectos.some((f) => f.tipo === "prevenirDano"), false);
});

test("Quetzalcóatl: tiene Furia, Exhumar y no puede ser Anulado; al entrar sube hasta dos cartas de tu Cementerio a tu mano", () => {
  let e = mesa();
  oros(e, 0, 4);
  const q = poner(e, 0, "cementerio", "Quetzalcóatl, el Sol Tenebris");
  const a = poner(e, 0, "cementerio", "Valefor");
  const b = poner(e, 0, "cementerio", "Llamar a la Manada");
  e = hacer(e, jugar(q, { desde: "cementerio" }), true, a, b);
  assert.equal(zonaDe(e, a), "mano");
  assert.equal(zonaDe(e, b), "mano");
  for (const k of ["Furia", "Exhumar", "NoAnulable"]) assert.equal(N.tiene(e, q, k), true);
  N.agregarEfecto(e, { tipo: "pierdeHabilidad", uid: q }, 1);
  assert.equal(N.activa(e, q), true);
});

test("Quetzalcóatl: una vez por turno Baraja hasta seis cartas de los Cementerios y Roba dos", () => {
  let e = mesa();
  const q = poner(e, 0, "defensa", "Quetzalcóatl, el Sol Tenebris");
  const c = [0, 1].map((j) => poner(e, j, "cementerio", "Valefor"));
  e = hacer(e, habilidad(q, "Quetzalcóatl, el Sol Tenebris"), ...c);
  assert.deepEqual(c.map((u) => zonaDe(e, u)), ["castillo", "castillo"]);
  assert.equal(e.jugadores[0].mano.length, 2);
  assert.equal(puedeUsar(e, q), false);
});

test("Ryujin: tiene Exhumar y Furia; al atacar Destierra hasta dos cartas cuyos costes sumen 3 o menos", () => {
  let e = mesa();
  const r = poner(e, 0, "defensa", "Ryujin el Atormentador");
  const v1 = poner(e, 1, "defensa", "Valefor");
  const v2 = poner(e, 1, "defensa", "Valefor");
  const p = poner(e, 1, "defensa", "Sir Persival");
  e = atacar(e, r);
  e = elegir(e, v1);
  assert.equal(e.pendiente.opciones.some((o) => o.valor === p), false);
  e = elegir(e, v2);
  assert.equal(zonaDe(e, v1), "destierro");
  assert.equal(zonaDe(e, v2), "destierro");
  assert.equal(zonaDe(e, p), "defensa");
  assert.equal(N.tiene(e, r, "Exhumar"), true);
  assert.equal(N.tiene(e, r, "Furia"), true);
});

test("Ryujin: una vez por turno Baraja hasta tres cartas de tu Cementerio y Roba dos", () => {
  let e = mesa();
  const r = poner(e, 0, "defensa", "Ryujin el Atormentador");
  const c = [1, 2, 3, 4].map(() => poner(e, 0, "cementerio", "Valefor"));
  e = hacer(e, habilidad(r, "Ryujin el Atormentador"), c[0], c[1], c[2]);
  assert.equal(c.filter((u) => zonaDe(e, u) === "castillo").length, 3);
  assert.equal(e.jugadores[0].mano.length, 2);
  assert.equal(puedeUsar(e, r), false);
});

test("Ryujin: al jugarlo puedes Botar cuatro cartas para que cueste un Oro menos", () => {
  let e = mesa();
  const r = poner(e, 0, "mano", "Ryujin el Atormentador");
  oros(e, 0, 2);
  assert.deepEqual(accionesLegales(e).filter((a) => a.tipo === "jugar" && a.uid === r), [{ tipo: "jugar", uid: r, alternativo: true }]);
  e = sinRespuesta(aplicar(e, jugar(r, { alternativo: true })));
  assert.equal(zonaDe(e, r), "defensa");
  assert.equal(e.jugadores[0].castillo.length, 26);
  assert.equal(e.jugadores[0].cementerio.length, 4);
  assert.equal(e.jugadores[0].reserva.length, 0);
});

test("Serpiente Verde: Destruyéndola genera un Oro para jugar Aliados y, sin Aliados de coste 1 o menos, Baraja hasta cuatro cartas de los Cementerios", () => {
  let e = mesa();
  const s = poner(e, 0, "defensa", "Serpiente Verde");
  const c = [0, 1].map((j) => poner(e, j, "cementerio", "Valefor"));
  e = aplicar(e, habilidad(s, "Serpiente Verde"));
  e = elegir(e, true);
  e = elegir(e, c[0]);
  e = elegir(e, c[1]);
  e = elegir(e, null);
  assert.equal(zonaDe(e, s), "cementerio");
  assert.deepEqual(c.map((u) => zonaDe(e, u)), ["castillo", "castillo"]);
  assert.equal(disponibles(e, 0, { tipo: "Aliado", coste: 2 }), 0);
  assert.equal(disponibles(e, 0, { tipo: "Aliado", coste: 3 }), 1);
});

test("Serpiente Verde: si controlas un Aliado de coste 1 o menos no Baraja", () => {
  let e = mesa();
  const s = poner(e, 0, "defensa", "Serpiente Verde");
  poner(e, 0, "defensa", "Valefor");
  e = aplicar(e, habilidad(s, "Serpiente Verde"));
  assert.equal(e.pendiente, null);
  assert.equal(zonaDe(e, s), "cementerio");
});

test("Shaatan: reduce su coste en dos Oros si tienes tres o más Aliados en tu Cementerio", () => {
  const e = mesa();
  const s = poner(e, 0, "mano", "Shaatan");
  poner(e, 0, "cementerio", "Valefor");
  poner(e, 0, "cementerio", "Valefor");
  assert.equal(costeDe(e, 0, s).pagar, 5);
  poner(e, 0, "cementerio", "Valefor");
  assert.equal(costeDe(e, 0, s).pagar, 3);
});

test("Shaatan: una vez por turno tu oponente Bota una carta por cada Oro que controles", () => {
  let e = mesa();
  oros(e, 0, 3);
  const s = poner(e, 0, "defensa", "Shaatan");
  e = aplicar(e, habilidad(s, "Shaatan"));
  assert.equal(e.jugadores[1].castillo.length, 27);
  assert.equal(accionesLegales(e).some((a) => a.uid === s && a.h === 0), false);
});

test("Shaatan: Destruyendo una carta que controles lo subes de tu Cementerio a tu mano", () => {
  let e = mesa();
  const s = poner(e, 0, "cementerio", "Shaatan");
  const v = poner(e, 0, "defensa", "Valefor");
  e = aplicar(e, habilidad(s, "Shaatan", 1));
  assert.equal(zonaDe(e, v), "cementerio");
  assert.equal(zonaDe(e, s), "mano");
});
