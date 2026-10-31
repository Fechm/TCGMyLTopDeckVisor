import { test } from "node:test";
import assert from "node:assert/strict";
import { mesa, poner, oros, hacer, elegir, sinRespuesta, accionesLegales, aplicar, zonaDe, id, N } from "./ayuda-duelo.mjs";
import { costeDe } from "../web/duelo/motor.js";
import { disponibles } from "../web/duelo/efectos.js";

const jugar = (uid, extra = {}) => ({ tipo: "jugar", uid, ...extra });
const habilidad = (uid, nombre, h = 0) => ({ tipo: "habilidad", uid, def: id(nombre), h });
const puedeJugar = (e, uid) => accionesLegales(e).some((a) => a.tipo === "jugar" && a.uid === uid);
const puedeUsar = (e, uid) => accionesLegales(e).some((a) => a.tipo === "habilidad" && a.uid === uid);
const puedeResponder = (e, uid) => accionesLegales(e).some((a) => a.tipo === "responder" && a.uid === uid);
const nombreDe = (e, nombre) => (v) => v !== null && N.carta(e, v).nombre === nombre;

function alTope(e, j, uid) {
  const c = e.jugadores[j].castillo;
  c.splice(c.indexOf(uid), 1);
  c.unshift(uid);
}

test("Exorcismo de Carmen Marín: Destierra un Cementerio", () => {
  let e = mesa();
  oros(e, 0, 2);
  const ex = poner(e, 0, "mano", "Exorcismo de Carmen Marín");
  const c1 = poner(e, 1, "cementerio", "Valefor");
  const c2 = poner(e, 1, "cementerio", "Drácula");
  e = hacer(e, jugar(ex), "Desterrar un Cementerio", "Desterrar el Cementerio oponente");
  assert.equal(zonaDe(e, c1), "destierro");
  assert.equal(zonaDe(e, c2), "destierro");
  assert.equal(e.jugadores[1].cementerio.length, 0);
});

test("Exorcismo de Carmen Marín: una carta pierde su habilidad y no puede atacar ni bloquear por el resto del juego", () => {
  let e = mesa();
  oros(e, 0, 2);
  const ex = poner(e, 0, "mano", "Exorcismo de Carmen Marín");
  const v = poner(e, 1, "defensa", "Valefor");
  e = hacer(e, jugar(ex), "Una carta pierde su habilidad y no puede atacar ni bloquear", v);
  assert.equal(N.activa(e, v), false);
  assert.equal(e.efectos.some((f) => f.tipo === "noAtacarBloquear" && f.uid === v && f.fin.mientras), true);
});

test("Exorcismo de Carmen Marín: Botando dos cartas elige ambos efectos", () => {
  let e = mesa();
  oros(e, 0, 2);
  const ex = poner(e, 0, "mano", "Exorcismo de Carmen Marín");
  const v = poner(e, 1, "defensa", "Valefor");
  const c1 = poner(e, 1, "cementerio", "Valefor");
  e = hacer(e, jugar(ex), "Botar dos cartas para elegir ambos efectos", "Desterrar el Cementerio oponente", v);
  assert.equal(e.jugadores[0].castillo.length, 28);
  assert.equal(zonaDe(e, c1), "destierro");
  assert.equal(N.activa(e, v), false);
});

test("Exorcismo de Carmen Marín: Descartando una carta elige ambos efectos", () => {
  let e = mesa();
  oros(e, 0, 2);
  const ex = poner(e, 0, "mano", "Exorcismo de Carmen Marín");
  const x = poner(e, 0, "mano", "Llamar a la Manada");
  const v = poner(e, 1, "defensa", "Valefor");
  e = hacer(e, jugar(ex), "Descartar una carta para elegir ambos efectos", "Desterrar tu Cementerio", v);
  assert.equal(zonaDe(e, x), "destierro");
  assert.equal(N.activa(e, v), false);
});

test("Exorcismo de Carmen Marín: las cartas en los Destierros pierden su habilidad durante este y los siguientes tres turnos", () => {
  let e = mesa();
  oros(e, 0, 2);
  const ex = poner(e, 0, "mano", "Exorcismo de Carmen Marín");
  const c1 = poner(e, 1, "cementerio", "Valefor");
  const propia = poner(e, 0, "destierro", "Expulsion");
  const t = e.turno;
  assert.equal(N.activa(e, propia), true);
  e = hacer(e, jugar(ex), "Desterrar un Cementerio", "Desterrar el Cementerio oponente");
  assert.equal(N.activa(e, c1), false);
  assert.equal(N.activa(e, propia), false);
  e.turno = t + 2;
  N.expirar(e, "finTurno");
  e.turno = t + 3;
  assert.equal(N.activa(e, propia), false);
  N.expirar(e, "finTurno");
  assert.equal(N.activa(e, propia), true);
});

test("Expulsar del Eden: Baraja una carta oponente de coste 2 o menos", () => {
  let e = mesa();
  oros(e, 0, 1);
  const ex = poner(e, 0, "mano", "Expulsar del Eden");
  const v = poner(e, 1, "defensa", "Valefor");
  poner(e, 1, "defensa", "Bokrug");
  e = hacer(e, jugar(ex));
  assert.equal(zonaDe(e, v), "castillo");
  assert.equal(zonaDe(e, ex), "cementerio");
});

test("Expulsar del Eden: el próximo Aliado del oponente entra sin habilidad hasta el comienzo de su próximo turno", () => {
  let e = mesa();
  oros(e, 0, 1);
  const ex = poner(e, 0, "mano", "Expulsar del Eden");
  poner(e, 1, "defensa", "Valefor");
  e = hacer(e, jugar(ex));
  e = aplicar(e, { tipo: "terminar" });
  assert.equal(e.activo, 1);
  oros(e, 1, 6);
  const draco = poner(e, 1, "mano", "Draco Conjurador");
  const draco2 = poner(e, 1, "mano", "Draco Conjurador");
  e = sinRespuesta(aplicar(e, jugar(draco)));
  assert.equal(zonaDe(e, draco), "defensa");
  assert.equal(e.pendiente, null);
  assert.equal(N.activa(e, draco), false);
  assert.equal(e.efectos.some((f) => f.tipo === "pierdeHabilidad" && f.uid === draco && f.fin.inicioDe === 1), true);
  e = sinRespuesta(aplicar(e, jugar(draco2)));
  assert.equal(e.pendiente?.opciones[0].texto, "Draco Conjurador");
});

test("Expulsar el Mal: Anula una carta con Exhumar, la Destierra y si tenía coste 3 o más Destierras una carta de tu mano", () => {
  let e = mesa();
  oros(e, 0, 3);
  oros(e, 1, 1);
  const bok = poner(e, 0, "cementerio", "Bokrug");
  const em = poner(e, 1, "mano", "Expulsar el Mal");
  const x = poner(e, 1, "mano", "Valefor");
  e = aplicar(e, jugar(bok, { desde: "cementerio" }));
  assert.equal(puedeResponder(e, em), true);
  e = sinRespuesta(aplicar(e, { tipo: "responder", uid: em }));
  assert.equal(zonaDe(e, bok), "destierro");
  assert.equal(zonaDe(e, x), "destierro");
  assert.equal(zonaDe(e, em), "cementerio");
});

test("Expulsar el Mal: no Anula una carta sin Exhumar", () => {
  let e = mesa();
  oros(e, 0, 1);
  oros(e, 1, 1);
  const v = poner(e, 0, "mano", "Valefor");
  const em = poner(e, 1, "mano", "Expulsar el Mal");
  e = aplicar(e, jugar(v));
  e = sinRespuesta(aplicar(e, { tipo: "responder", uid: em }));
  assert.equal(zonaDe(e, v), "defensa");
});

test("Expulsar el Mal: solo puede jugarse en respuesta a una carta con Exhumar", { todo: "respuesta: Anular solo cartas que tengan una clave dada (Exhumar)" }, () => {});

test("Expulsion: en respuesta, la carta oponente entra en juego sin habilidad por el turno", () => {
  let e = mesa();
  oros(e, 0, 3);
  oros(e, 1, 1);
  const draco = poner(e, 0, "mano", "Draco Conjurador");
  const exp = poner(e, 1, "mano", "Expulsion");
  e = aplicar(e, jugar(draco));
  assert.equal(puedeResponder(e, exp), true);
  e = sinRespuesta(aplicar(e, { tipo: "responder", uid: exp }));
  assert.equal(zonaDe(e, draco), "defensa");
  assert.equal(e.pendiente, null);
  assert.equal(N.activa(e, draco), false);
  assert.equal(e.efectos.some((f) => f.tipo === "pierdeHabilidad" && f.uid === draco && f.fin.finTurno === e.turno), true);
});

test("Expulsion: si es un Talismán se resuelve sin efecto", () => {
  let e = mesa();
  oros(e, 0, 1);
  oros(e, 1, 1);
  const ll = poner(e, 0, "mano", "Llamar a la Manada");
  const exp = poner(e, 1, "mano", "Expulsion");
  e = aplicar(e, jugar(ll));
  e = sinRespuesta(aplicar(e, { tipo: "responder", uid: exp }));
  assert.equal(zonaDe(e, ll), "cementerio");
  assert.equal(e.jugadores[0].mano.length, 0);
});

test("Expulsion: Desterrándola de tu Cementerio una carta pierde su habilidad por el turno", () => {
  let e = mesa();
  const exp = poner(e, 0, "cementerio", "Expulsion");
  const v = poner(e, 1, "defensa", "Valefor");
  assert.equal(puedeUsar(e, exp), true);
  e = hacer(e, habilidad(exp, "Expulsion"));
  assert.equal(zonaDe(e, exp), "destierro");
  assert.equal(N.activa(e, v), false);
  assert.equal(e.efectos.some((f) => f.tipo === "pierdeHabilidad" && f.uid === v && f.fin.finTurno === e.turno), true);
});

test("Falso Profeta: si muestra un Aliado lo pone en tu Cementerio, el oponente Bota dos y puedes repetir hasta Robar una carta que no sea Aliado", () => {
  let e = mesa();
  oros(e, 0, 1);
  const fp = poner(e, 0, "mano", "Falso Profeta");
  const v = poner(e, 0, "castillo", "Valefor");
  alTope(e, 0, v);
  e = hacer(e, jugar(fp));
  assert.equal(zonaDe(e, v), "cementerio");
  assert.equal(e.jugadores[1].castillo.length, 28);
  assert.equal(e.pendiente.opciones[0].texto, "Repetir el efecto");
  e = elegir(e, true);
  assert.equal(e.jugadores[0].mano.length, 1);
  assert.equal(N.carta(e, e.jugadores[0].mano[0]).tipo, "Oro");
  assert.equal(e.pendiente, null);
});

test("Falso Profeta: si no muestra un Aliado lo pone en tu mano", () => {
  let e = mesa();
  oros(e, 0, 1);
  const fp = poner(e, 0, "mano", "Falso Profeta");
  e = hacer(e, jugar(fp));
  assert.equal(e.jugadores[0].mano.length, 1);
  assert.equal(e.jugadores[1].castillo.length, 30);
});

test("Fantasma del Puente: Baraja y/o Destierra hasta cuatro cartas de los Cementerios y Roba dos cartas", () => {
  let e = mesa();
  oros(e, 0, 1);
  const fp = poner(e, 0, "mano", "Fantasma del Puente");
  const a = poner(e, 1, "cementerio", "Valefor");
  const b = poner(e, 1, "cementerio", "Valefor");
  const c = poner(e, 0, "cementerio", "Bokrug");
  const d = poner(e, 0, "cementerio", "Bokrug");
  e = hacer(e, jugar(fp), a, b, null, c, d);
  assert.deepEqual([a, b, c, d].map((u) => zonaDe(e, u)), ["castillo", "castillo", "destierro", "destierro"]);
  assert.equal(e.jugadores[0].mano.length, 2);
});

test("Fantasma del Puente: en tu Vigilia puedes Barajarlo de tu Cementerio en tu Castillo", () => {
  let e = mesa();
  const fp = poner(e, 0, "cementerio", "Fantasma del Puente");
  e = hacer(e, habilidad(fp, "Fantasma del Puente"));
  assert.equal(zonaDe(e, fp), "castillo");
});

test("Fantasma del Puente: si es Botado por daño detiene el Bote y se Destierra", { todo: "reacción: al ser Botada por daño detiene el Bote y se Destierra" }, () => {});

test("Fantasmas del Palacio: Baraja una carta de coste 3 o menos", () => {
  let e = mesa();
  oros(e, 0, 1);
  const fp = poner(e, 0, "mano", "Fantasmas del Palacio");
  const v = poner(e, 1, "defensa", "Valefor");
  e = hacer(e, jugar(fp), "Barajar una carta de coste 3 o menos", v);
  assert.equal(zonaDe(e, v), "castillo");
});

test("Fantasmas del Palacio: pagando un Oro adicional Baraja una carta de cualquier coste", () => {
  let e = mesa();
  oros(e, 0, 2);
  const fp = poner(e, 0, "mano", "Fantasmas del Palacio");
  const m = poner(e, 1, "defensa", "Dragón de Magma");
  e = hacer(e, jugar(fp), "Pagar un Oro: Barajar una carta de cualquier coste", m);
  assert.equal(zonaDe(e, m), "castillo");
  assert.equal(e.jugadores[0].reserva.length, 0);
});

test("Fantasmas del Palacio: desde tu Cementerio, pagando el coste de un Aliado de tu Cementerio entra en juego como una copia de ese Aliado", () => {
  let e = mesa();
  oros(e, 0, 3);
  const fp = poner(e, 0, "cementerio", "Fantasmas del Palacio");
  poner(e, 0, "cementerio", "Draco Conjurador");
  assert.equal(puedeUsar(e, fp), true);
  e = hacer(e, habilidad(fp, "Fantasmas del Palacio"));
  assert.equal(zonaDe(e, fp), "defensa");
  assert.equal(N.carta(e, fp).tipo, "Aliado");
  assert.equal(N.fuerza(e, fp), 2);
  assert.equal(e.jugadores[0].reserva.length, 0);
  assert.equal(e.pendiente?.opciones[0].texto, "Draco Conjurador");
});

test("Fantasmas del Palacio: no puede copiar un Aliado cuyo coste no puedes pagar", () => {
  const e = mesa();
  oros(e, 0, 2);
  const fp = poner(e, 0, "cementerio", "Fantasmas del Palacio");
  poner(e, 0, "cementerio", "Draco Conjurador");
  assert.equal(puedeUsar(e, fp), false);
});

test("Favor de la Corte: sube una carta oponente en juego que no sea Oro a la mano de su dueño", () => {
  let e = mesa();
  oros(e, 0, 2);
  const f = poner(e, 0, "mano", "Favor de la Corte");
  const v = poner(e, 1, "defensa", "Valefor");
  const o = poner(e, 1, "reserva", "Drácula");
  e = hacer(e, jugar(f));
  assert.equal(zonaDe(e, v), "mano");
  assert.equal(N.ubicar(e, v).j, 1);
  assert.equal(zonaDe(e, o), "reserva");
});

test("Fin de Travesia: Baraja las cartas convertidas que no sean Oros en el Castillo de su dueño", () => {
  let e = mesa();
  oros(e, 0, 2);
  const f = poner(e, 0, "mano", "Fin de Travesia");
  const v = poner(e, 1, "defensa", "Valefor");
  N.sacar(e, v);
  e.jugadores[0].pagado.push(v);
  e.conv[v] = { tipo: "Oro", sinHabilidad: true };
  const d = poner(e, 0, "defensa", "Drácula");
  e.conv[d] = { tipo: "Aliado", fuerza: 2, sinHabilidad: true };
  const libre = poner(e, 1, "defensa", "Valefor");
  e = hacer(e, jugar(f));
  assert.equal(e.jugadores[1].castillo.includes(v), true);
  assert.equal(e.conv[v], undefined);
  assert.equal(zonaDe(e, d), "defensa");
  assert.equal(zonaDe(e, libre), "defensa");
});

test("Fin de Travesia: si atacaste en tu turno anterior no puede ser Anulado", () => {
  let e = mesa();
  oros(e, 0, 2);
  oros(e, 1, 3);
  const f = poner(e, 0, "mano", "Fin de Travesia");
  const g = poner(e, 1, "mano", "Gran Diluvio");
  e.jugadores[0].atacoTurnoAnterior = true;
  e = aplicar(e, jugar(f));
  assert.equal(puedeResponder(e, g), false);
});

test("Fin de Travesia: si no atacaste en tu turno anterior puede ser Anulado", () => {
  let e = mesa();
  oros(e, 0, 2);
  oros(e, 1, 3);
  const f = poner(e, 0, "mano", "Fin de Travesia");
  const g = poner(e, 1, "mano", "Gran Diluvio");
  e = aplicar(e, jugar(f));
  assert.equal(puedeResponder(e, g), true);
});

test("Fin de Travesia: no puede ser prevenido", { todo: "clave condicional: el Talismán no puede ser prevenido" }, () => {});

test("Fision Nuclear: al jugarla se Destierra", () => {
  let e = mesa();
  oros(e, 0, 1);
  const f = poner(e, 0, "mano", "Fision Nuclear");
  e = hacer(e, jugar(f));
  assert.equal(zonaDe(e, f), "destierro");
});

test("Fision Nuclear: hasta tu próximo turno no puedes ser afectado por efectos oponentes", { todo: "protección: el jugador es inmune a efectos oponentes y afectar sus cartas cuesta Desterrar una carta de la mano (no Oros)" }, () => {});

test("Fision Nuclear: en la próxima Fase Final oponente Baraja una carta de coste 2 o menos", () => {
  let e = mesa();
  oros(e, 0, 1);
  const f = poner(e, 0, "mano", "Fision Nuclear");
  const v = poner(e, 1, "defensa", "Valefor");
  e = hacer(e, jugar(f));
  assert.equal(e.efectos.some((x) => x.tipo === "diferido" && x.cuando === "faseFinalRival"), true);
  e = aplicar(e, { tipo: "terminar" });
  assert.equal(e.activo, 1);
  assert.equal(zonaDe(e, v), "defensa");
  for (let i = 0; i < 10 && !e.pendiente; i++) e = aplicar(e, { tipo: "terminar" });
  assert.equal(e.pendiente.jugador, 0);
  e = elegir(e, "Barajar una carta de coste 2 o menos");
  e = elegir(e, v);
  assert.equal(zonaDe(e, v), "castillo");
  assert.equal(e.efectos.some((x) => x.tipo === "diferido"), false);
});

test("Fision Nuclear: en la próxima Fase Final oponente puede Robar dos cartas", () => {
  let e = mesa();
  oros(e, 0, 1);
  const f = poner(e, 0, "mano", "Fision Nuclear");
  e = hacer(e, jugar(f));
  e = aplicar(e, { tipo: "terminar" });
  const mano = e.jugadores[0].mano.length;
  for (let i = 0; i < 10 && !e.pendiente; i++) e = aplicar(e, { tipo: "terminar" });
  e = elegir(e, "Robar dos cartas");
  assert.equal(e.jugadores[0].mano.length, mano + 2);
});

test("Flecha Ácida: Destruye un Aliado oponente de Fuerza 2 o menos y Roba una carta", () => {
  let e = mesa();
  oros(e, 0, 2);
  const f = poner(e, 0, "mano", "Flecha Ácida");
  const g = poner(e, 1, "defensa", "Sir Galahad");
  const v = poner(e, 1, "defensa", "Valefor");
  e = hacer(e, jugar(f));
  assert.equal(zonaDe(e, g), "cementerio");
  assert.equal(zonaDe(e, v), "defensa");
  assert.equal(e.jugadores[0].mano.length, 1);
});

test("Flecha Ácida: sin Aliados oponentes de Fuerza 2 o menos no se puede jugar", () => {
  const e = mesa();
  oros(e, 0, 2);
  const f = poner(e, 0, "mano", "Flecha Ácida");
  poner(e, 1, "defensa", "Valefor");
  assert.equal(puedeJugar(e, f), false);
});

test("Forma Canina: se Destierra, Robas una y el oponente Bota una por cada carta de coste 1 o más en juego", () => {
  let e = mesa();
  oros(e, 0, 1);
  const f = poner(e, 0, "mano", "Forma Canina");
  poner(e, 1, "defensa", "Valefor");
  poner(e, 0, "defensa", "Bokrug");
  e = hacer(e, jugar(f));
  assert.equal(zonaDe(e, f), "destierro");
  assert.equal(e.jugadores[0].mano.length, 1);
  assert.equal(e.jugadores[1].castillo.length, 28);
});

test("Forma Canina: Desterrando dos cartas de tu Cementerio vuelve a tu mano", () => {
  let e = mesa();
  const f = poner(e, 0, "cementerio", "Forma Canina");
  const x = poner(e, 0, "cementerio", "Valefor");
  const y = poner(e, 0, "cementerio", "Valefor");
  e = hacer(e, habilidad(f, "Forma Canina"));
  assert.equal(zonaDe(e, f), "mano");
  assert.equal(zonaDe(e, x), "destierro");
  assert.equal(zonaDe(e, y), "destierro");
});

test("Forma de Ataque: Destierra del Castillo oponente tantas cartas como coste sumen tus cartas, Baraja o Destierra de los Cementerios y Roba tres", () => {
  let e = mesa();
  oros(e, 0, 3);
  const f = poner(e, 0, "mano", "Forma de Ataque");
  poner(e, 0, "defensa", "Bokrug");
  poner(e, 0, "defensa", "Valefor");
  const c = poner(e, 1, "cementerio", "Valefor");
  e = hacer(e, jugar(f), c);
  assert.equal(e.jugadores[1].destierro.length, 4);
  assert.equal(zonaDe(e, c), "castillo");
  assert.equal(e.jugadores[0].mano.length, 3);
});

test("Forma de Niebla: un Aliado de coste 2 o menos pierde su habilidad y su Fuerza y otro Aliado gana esa Fuerza", () => {
  let e = mesa();
  oros(e, 0, 1);
  const f = poner(e, 0, "mano", "Forma de Niebla");
  const v = poner(e, 1, "defensa", "Valefor");
  const b = poner(e, 0, "defensa", "Bokrug");
  e = hacer(e, jugar(f), b);
  assert.equal(N.fuerza(e, v), 0);
  assert.equal(N.activa(e, v), false);
  assert.equal(N.fuerza(e, b), 8);
  e.turno += 5;
  N.expirar(e, "finTurno");
  N.expirar(e, "inicio");
  assert.equal(N.fuerza(e, b), 8);
});

test("Forma de Niebla: Destruyendo una carta que controles se juega sin pagar su coste", () => {
  let e = mesa();
  const f = poner(e, 0, "mano", "Forma de Niebla");
  const g = poner(e, 0, "defensa", "Sir Galahad");
  const v0 = poner(e, 0, "defensa", "Valefor");
  const rv = poner(e, 1, "defensa", "Valefor");
  assert.equal(puedeJugar(e, f), false);
  assert.equal(puedeUsar(e, f), true);
  e = hacer(e, habilidad(f, "Forma de Niebla"), v0);
  e = sinRespuesta(e);
  e = elegir(e, g);
  assert.equal(zonaDe(e, v0), "cementerio");
  assert.equal(zonaDe(e, f), "cementerio");
  assert.equal(N.fuerza(e, rv), 0);
  assert.equal(N.fuerza(e, g), 5);
});

test("Fuego Purificador: no se juega como Talismán normal", () => {
  const e = mesa();
  oros(e, 0, 1);
  const f = poner(e, 0, "mano", "Fuego Purificador");
  assert.equal(puedeJugar(e, f), false);
});

test("Fuego Purificador: en respuesta a un efecto oponente sobre tu Oro, se juega gratis y previene que tu carta sea afectada", { todo: "respuesta: prevenir que una carta propia sea afectada por un efecto oponente" }, () => {});

test("Fuego del Desierto: Destruye un Aliado, Roba una carta y se convierte en un Oro sin habilidad en tu Oro Pagado", () => {
  let e = mesa();
  oros(e, 0, 2);
  const f = poner(e, 0, "mano", "Fuego del Desierto");
  const v = poner(e, 1, "defensa", "Valefor");
  e = hacer(e, jugar(f));
  assert.equal(zonaDe(e, v), "cementerio");
  assert.equal(e.jugadores[0].mano.length, 1);
  assert.equal(zonaDe(e, f), "pagado");
  assert.equal(N.carta(e, f).tipo, "Oro");
  assert.equal(N.carta(e, f).sinHabilidad, true);
});

test("Fuerza Estelar: con Eterno Roba tres cartas y Descarta una", () => {
  let e = mesa();
  oros(e, 0, 1);
  const f = poner(e, 0, "mano", "Fuerza Estelar");
  const x = poner(e, 0, "mano", "Llamar a la Manada");
  poner(e, 0, "defensa", "Antu");
  e = hacer(e, jugar(f), "Eterno: Robar tres cartas y Descartar una", x);
  assert.equal(zonaDe(e, x), "cementerio");
  assert.equal(e.jugadores[0].mano.length, 3);
});

test("Fuerza Estelar: con Faerie Baraja Aliados cuyas Fuerzas sumen hasta 4", () => {
  let e = mesa();
  oros(e, 0, 1);
  const f = poner(e, 0, "mano", "Fuerza Estelar");
  const a = poner(e, 0, "defensa", "Arakiel");
  const v = poner(e, 1, "defensa", "Valefor");
  const g = poner(e, 1, "defensa", "Sir Galahad");
  e = hacer(e, jugar(f), "Faerie: Barajar Aliados cuyas Fuerzas sumen hasta 4", g);
  assert.equal(e.pendiente.opciones.some((o) => o.valor === v), false);
  e = elegir(e, a);
  assert.equal(zonaDe(e, g), "castillo");
  assert.equal(zonaDe(e, a), "castillo");
  assert.equal(zonaDe(e, v), "defensa");
});

test("Fuerza Estelar: con Sacerdote busca dos cartas de distinto nombre en cada Castillo y las Destierra", () => {
  let e = mesa();
  oros(e, 0, 1);
  const f = poner(e, 0, "mano", "Fuerza Estelar");
  poner(e, 0, "defensa", "Dorotea");
  poner(e, 0, "castillo", "Valefor");
  poner(e, 1, "castillo", "Valefor");
  e = hacer(e, jugar(f), "Sacerdote: Buscar dos cartas de distinto nombre en cada Castillo y Desterrarlas", "listo", nombreDe(e, "Drácula"));
  assert.equal(e.pendiente.opciones.some((o) => o.valor && N.carta(e, o.valor).nombre === "Drácula"), false);
  e = elegir(e, nombreDe(e, "Valefor"));
  e = elegir(e, nombreDe(e, "Valefor"));
  e = elegir(e, nombreDe(e, "Drácula"));
  assert.deepEqual(e.jugadores[0].destierro.map((u) => N.carta(e, u).nombre).sort(), ["Drácula", "Valefor"]);
  assert.deepEqual(e.jugadores[1].destierro.map((u) => N.carta(e, u).nombre).sort(), ["Drácula", "Valefor"]);
});

test("Fuerza Estelar: sin las Razas no hay efectos que elegir", () => {
  let e = mesa();
  oros(e, 0, 1);
  const f = poner(e, 0, "mano", "Fuerza Estelar");
  poner(e, 0, "defensa", "Valefor");
  e = hacer(e, jugar(f));
  assert.equal(e.pendiente, null);
  assert.equal(e.jugadores[0].mano.length, 0);
});

test("Furia Berserker: durante tu Vigilia cuesta un Oro adicional", () => {
  const e = mesa();
  const f = poner(e, 0, "mano", "Furia Berserker");
  assert.equal(costeDe(e, 0, f).pagar, 1);
  e.fase = "talismanes";
  e.prioridad = 0;
  assert.equal(costeDe(e, 0, f).pagar, 0);
});

test("Furia Berserker: Roba dos cartas y hasta dos Aliados que controles ganan 2 de Fuerza e Indestructible por el turno", () => {
  let e = mesa();
  oros(e, 0, 1);
  const f = poner(e, 0, "mano", "Furia Berserker");
  const v = poner(e, 0, "defensa", "Valefor");
  const g = poner(e, 0, "defensa", "Sir Galahad");
  e = hacer(e, jugar(f), v, g);
  assert.equal(e.jugadores[0].mano.length, 2);
  assert.equal(N.fuerza(e, v), 5);
  assert.equal(N.fuerza(e, g), 4);
  assert.equal(N.tiene(e, v, "Indestructible"), true);
  assert.equal(N.tiene(e, g, "Indestructible"), true);
});

test("Furia de Titán: si el Aliado está en tu Línea de Ataque no puede salir del juego y hace daño al Destierro hasta tu próximo turno", () => {
  let e = mesa();
  const f = poner(e, 0, "mano", "Furia de Titán");
  const v = poner(e, 0, "ataque", "Valefor");
  e = hacer(e, jugar(f));
  assert.equal(zonaDe(e, f), "destierro");
  assert.equal(N.puedeSalir(e, v), false);
  assert.equal(N.tiene(e, v, "DanoAlDestierro"), true);
  assert.equal(e.efectos.some((x) => x.tipo === "noSale" && x.uid === v && x.fin.inicioDe === 0), true);
});

test("Furia de Titán: si el Aliado no está atacando no gana la protección", () => {
  let e = mesa();
  const f = poner(e, 0, "mano", "Furia de Titán");
  const v = poner(e, 0, "defensa", "Valefor");
  e = hacer(e, jugar(f));
  assert.equal(N.puedeSalir(e, v), true);
  assert.equal(N.tiene(e, v, "DanoAlDestierro"), false);
});

test("Furia de Titán: si no ataca, el oponente no puede atacar con Aliados de mayor Fuerza", { todo: "efecto: el oponente no puede atacar con Aliados de mayor Fuerza que un Aliado dado" }, () => {});

test("Furia del Exilio: Destierra el Cementerio oponente, Bota tres por cada Oro y con menos de seis genera un Oro para Aliados", () => {
  let e = mesa();
  oros(e, 0, 2);
  const f = poner(e, 0, "mano", "Furia del Exilio");
  poner(e, 1, "cementerio", "Drácula");
  poner(e, 1, "cementerio", "Drácula");
  poner(e, 1, "cementerio", "Valefor");
  e = hacer(e, jugar(f));
  assert.equal(e.jugadores[1].destierro.length, 3);
  assert.equal(e.jugadores[1].castillo.length, 24);
  assert.equal(e.jugadores[1].cementerio.length, 6);
  assert.equal(disponibles(e, 0, "Aliado"), 1);
  assert.equal(disponibles(e, 0, "Talismán"), 0);
});

test("Furia del Exilio: con seis o más cartas Desterradas no genera Oro", () => {
  let e = mesa();
  oros(e, 0, 2);
  const f = poner(e, 0, "mano", "Furia del Exilio");
  for (let i = 0; i < 6; i++) poner(e, 1, "cementerio", "Valefor");
  e = hacer(e, jugar(f));
  assert.equal(e.jugadores[1].destierro.length, 6);
  assert.equal(e.jugadores[1].castillo.length, 30);
  assert.equal(disponibles(e, 0, "Aliado"), 0);
});

test("Garras de Balam: busca un Oro en tu Castillo, lo pone en tu Oro Pagado y Roba una carta", () => {
  let e = mesa();
  oros(e, 0, 2);
  const g = poner(e, 0, "mano", "Garras de Balam");
  e = hacer(e, jugar(g), nombreDe(e, "Drácula"));
  assert.equal(e.jugadores[0].pagado.length, 3);
  assert.equal(e.jugadores[0].castillo.length, 28);
  assert.equal(e.jugadores[0].mano.length, 1);
});

test("Garras de Balam: pagando dos Oros sube de tu Cementerio a tu mano", () => {
  let e = mesa();
  oros(e, 0, 2);
  const g = poner(e, 0, "cementerio", "Garras de Balam");
  e = hacer(e, habilidad(g, "Garras de Balam"));
  assert.equal(zonaDe(e, g), "mano");
  assert.equal(e.jugadores[0].reserva.length, 0);
});

test("Golpe Fulminante: Barajas una carta de tu mano, miras la mano oponente y Destierras un Talismán", () => {
  let e = mesa();
  oros(e, 0, 1);
  const v = poner(e, 0, "mano", "Valefor");
  const g = poner(e, 0, "mano", "Golpe Fulminante");
  assert.equal(puedeJugar(e, g), false);
  e = sinRespuesta(aplicar(e, jugar(v)));
  const x = poner(e, 0, "mano", "Llamar a la Manada");
  const t = poner(e, 1, "mano", "Llamar a la Manada");
  const rv = poner(e, 1, "mano", "Valefor");
  e = hacer(e, jugar(g));
  assert.equal(zonaDe(e, x), "castillo");
  assert.equal(zonaDe(e, t), "destierro");
  assert.equal(zonaDe(e, rv), "mano");
});

test("Golpe Fulminante: solo uno por turno", () => {
  const e = mesa();
  const g = poner(e, 0, "mano", "Golpe Fulminante");
  poner(e, 0, "mano", "Valefor");
  e.jugadores[0].jugadas.Aliado = 1;
  assert.equal(puedeJugar(e, g), true);
  e.jugadores[0].jugadas.nombres["Golpe Fulminante"] = 1;
  assert.equal(puedeJugar(e, g), false);
});

test("Golpe Solar: Descarta hasta dos, juega un Aliado de tu Cementerio reduciendo su coste y Baraja una carta oponente de coste 2 o menos", () => {
  let e = mesa();
  oros(e, 0, 2);
  const s = poner(e, 0, "mano", "Golpe Solar");
  const x1 = poner(e, 0, "mano", "Llamar a la Manada");
  const x2 = poner(e, 0, "mano", "Llamar a la Manada");
  const b = poner(e, 0, "cementerio", "Bokrug");
  const rv = poner(e, 1, "defensa", "Valefor");
  e = hacer(e, jugar(s), x1, x2, rv);
  assert.equal(zonaDe(e, x1), "cementerio");
  assert.equal(zonaDe(e, x2), "cementerio");
  assert.equal(zonaDe(e, b), "defensa");
  assert.equal(e.jugadores[0].reserva.length, 0);
  assert.equal(zonaDe(e, rv), "castillo");
  assert.equal(zonaDe(e, s), "destierro");
});

test("Golpe Solar: sin Descartar no alcanza a jugar un Aliado caro", () => {
  let e = mesa();
  oros(e, 0, 2);
  const s = poner(e, 0, "mano", "Golpe Solar");
  const b = poner(e, 0, "cementerio", "Bokrug");
  e = hacer(e, jugar(s));
  assert.equal(zonaDe(e, b), "cementerio");
});

test("Gran Diluvio: tu oponente Descarta dos cartas de su mano", () => {
  let e = mesa();
  oros(e, 0, 3);
  const g = poner(e, 0, "mano", "Gran Diluvio");
  const m = [1, 2, 3].map(() => poner(e, 1, "mano", "Valefor"));
  e = hacer(e, jugar(g), "Tu oponente Descarta dos cartas de su mano", m[0], m[1]);
  assert.deepEqual(m.map((u) => zonaDe(e, u)), ["cementerio", "cementerio", "mano"]);
});

test("Gran Diluvio: cada jugador elige uno de sus Aliados y Baraja el resto", () => {
  let e = mesa();
  oros(e, 0, 3);
  const g = poner(e, 0, "mano", "Gran Diluvio");
  const v = poner(e, 0, "defensa", "Valefor");
  const ga = poner(e, 0, "defensa", "Sir Galahad");
  const rb = poner(e, 1, "defensa", "Bokrug");
  const rv = poner(e, 1, "defensa", "Valefor");
  e = hacer(e, jugar(g), "Cada jugador elige uno de sus Aliados y Baraja el resto", ga, rb);
  assert.deepEqual([v, ga, rb, rv].map((u) => zonaDe(e, u)), ["castillo", "defensa", "defensa", "castillo"]);
});

test("Gran Diluvio: en respuesta Anula una carta que no sea Aliado, la Destierra y Destierra tres del tope de un Castillo", () => {
  let e = mesa();
  oros(e, 0, 1);
  oros(e, 1, 3);
  const ll = poner(e, 0, "mano", "Llamar a la Manada");
  const g = poner(e, 1, "mano", "Gran Diluvio");
  e = aplicar(e, jugar(ll));
  assert.equal(puedeResponder(e, g), true);
  e = sinRespuesta(aplicar(e, { tipo: "responder", uid: g }));
  e = elegir(e, "Anular una carta que no sea Aliado, Desterrarla y Desterrar tres cartas del tope de un Castillo");
  e = elegir(e, "Castillo oponente");
  assert.equal(zonaDe(e, ll), "destierro");
  assert.equal(e.jugadores[0].destierro.length, 4);
  assert.equal(e.jugadores[0].mano.length, 0);
});

test("Gran Diluvio: en respuesta eligiendo otro efecto la carta se resuelve", () => {
  let e = mesa();
  oros(e, 0, 1);
  oros(e, 1, 3);
  const ll = poner(e, 0, "mano", "Llamar a la Manada");
  const g = poner(e, 1, "mano", "Gran Diluvio");
  e = aplicar(e, jugar(ll));
  e = sinRespuesta(aplicar(e, { tipo: "responder", uid: g }));
  assert.equal(e.pendiente.opciones.length, 3);
  e = elegir(e, "Tu oponente Descarta dos cartas de su mano");
  assert.equal(zonaDe(e, ll), "cementerio");
  assert.equal(e.jugadores[0].mano.length, 3);
});

test("Gran Diluvio: en respuesta a un Aliado no ofrece Anular", () => {
  let e = mesa();
  oros(e, 0, 1);
  oros(e, 1, 3);
  const v = poner(e, 0, "mano", "Valefor");
  const g = poner(e, 1, "mano", "Gran Diluvio");
  e = aplicar(e, jugar(v));
  e = sinRespuesta(aplicar(e, { tipo: "responder", uid: g }));
  assert.equal(e.pendiente.opciones.length, 2);
  e = elegir(e, "Tu oponente Descarta dos cartas de su mano");
  assert.equal(zonaDe(e, v), "defensa");
});

test("Gran Diluvio: Descartar hasta dos cartas reduce su coste", { todo: "coste alternativo: Descartar cartas al jugarla para reducir su coste" }, () => {});

test("Gran Escape: un Aliado tuyo de coste 1 o más gana Imbloqueable y hace daño al Destierro por el resto del juego", () => {
  let e = mesa();
  oros(e, 0, 1);
  const g = poner(e, 0, "mano", "Gran Escape");
  const v = poner(e, 0, "defensa", "Valefor");
  e = hacer(e, jugar(g));
  assert.equal(zonaDe(e, g), "destierro");
  assert.equal(N.tiene(e, v, "Imbloqueable"), true);
  assert.equal(N.tiene(e, v, "DanoAlDestierro"), true);
});

test("Gran Escape: el Aliado puede Destruir una carta de coste 2 o menos una vez por turno", () => {
  let e = mesa();
  oros(e, 0, 1);
  const g = poner(e, 0, "mano", "Gran Escape");
  const v = poner(e, 0, "defensa", "Valefor");
  const rv = poner(e, 1, "defensa", "Valefor");
  e = hacer(e, jugar(g));
  assert.equal(puedeUsar(e, v), true);
  e = hacer(e, habilidad(v, "Gran Escape"), rv);
  assert.equal(zonaDe(e, rv), "cementerio");
  assert.equal(puedeUsar(e, v), false);
});
