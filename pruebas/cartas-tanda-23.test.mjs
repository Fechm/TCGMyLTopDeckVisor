import { test } from "node:test";
import assert from "node:assert/strict";
import { mesa, poner, oros, hacer, elegir, sinRespuesta, accionesLegales, aplicar, zonaDe, id, N } from "./ayuda-duelo.mjs";
import { resolver } from "../web/duelo/efectos.js";

const jugar = (uid, extra = {}) => ({ tipo: "jugar", uid, ...extra });
const oro = (uid) => ({ tipo: "oro", uid });
const habilidad = (uid, nombre, h = 0) => ({ tipo: "habilidad", uid, def: id(nombre), h });
const puedeUsar = (e, uid, nombre, h = 0) => accionesLegales(e).some((a) => a.tipo === "habilidad" && a.uid === uid && a.def === id(nombre) && a.h === h);
const puedeJugarOro = (e, uid) => accionesLegales(e).some((a) => a.tipo === "oro" && a.uid === uid);
const nombreDe = (e, nombre) => (v) => v !== null && N.carta(e, v).nombre === nombre;
const deJugador = (j) => (v) => v !== null && N.dueno(v) === j;

function disparar(e, evento, datos) {
  N.disparar(e, evento, datos);
  resolver(e);
  return e;
}

function alTope(e, j, uid) {
  const c = e.jugadores[j].castillo;
  c.splice(c.indexOf(uid), 1);
  c.unshift(uid);
}

let nFicticia = 0;
function ficticia(e, j, zona, datos = {}) {
  const idf = `ficticia23-${nFicticia++}`;
  e.catalogo = {
    ...e.catalogo,
    [idf]: { id: idf, nombre: idf, tipo: "Aliado", coste: 1, fuerza: 2, razas: [], sinHabilidad: false, oroInicial: false, texto: "", ...datos },
  };
  const uid = `${j}-g${nFicticia}`;
  e.instancias[uid] = idf;
  e.jugadores[j][zona].push(uid);
  return uid;
}

test("Salmón del Saber: es Oro Inicial", () => {
  const e = mesa();
  assert.equal(N.carta(e, poner(e, 0, "reserva", "Salmón del Saber")).oroInicial, true);
});

test("Salmón del Saber: al comienzo de tu Vigilia Roba hasta tener dos cartas en tu mano", () => {
  let e = mesa();
  poner(e, 0, "reserva", "Salmón del Saber");
  e = disparar(e, "comienzoVigilia", { j: 0 });
  assert.equal(e.jugadores[0].mano.length, 2);
  e = disparar(e, "comienzoVigilia", { j: 1 });
  assert.equal(e.jugadores[0].mano.length, 2);
  poner(e, 0, "mano", "Valefor");
  e = disparar(e, "comienzoVigilia", { j: 0 });
  assert.equal(e.jugadores[0].mano.length, 3);
});

test("Salmón del Saber: no puede salir del juego por efectos de Talismanes", { todo: "protección: no puede salir del juego por efectos de Talismanes" }, () => {
  assert.fail();
});

test("Salmón del Saber: al comienzo del juego Roba una carta si tienes menos de ocho en la mano", { todo: "evento: al comienzo del juego" }, () => {
  assert.fail();
});

test("Sarcófago: al entrar en juego Roba una carta", () => {
  let e = mesa();
  const s = poner(e, 0, "mano", "Sarcófago");
  e = aplicar(e, oro(s));
  assert.equal(zonaDe(e, s), "reserva");
  assert.equal(e.jugadores[0].mano.length, 1);
});

test("Sarcófago: una vez por turno Descarta una carta para Barajar hasta tres cartas de los Cementerios y subir un Aliado de coste 2 o menos", () => {
  let e = mesa();
  const s = poner(e, 0, "reserva", "Sarcófago");
  const d = poner(e, 0, "mano", "Drácula");
  const v = poner(e, 0, "cementerio", "Valefor");
  const caro = poner(e, 0, "cementerio", "Balaur");
  const r = poner(e, 1, "cementerio", "Valefor");
  e = aplicar(e, habilidad(s, "Sarcófago"));
  assert.equal(zonaDe(e, d), "cementerio");
  e = elegir(e, r);
  e = elegir(e, null);
  assert.deepEqual(e.pendiente.opciones.map((o) => o.valor), [v, null]);
  e = elegir(e, v);
  assert.equal(zonaDe(e, r), "castillo");
  assert.equal(zonaDe(e, v), "mano");
  assert.equal(zonaDe(e, caro), "cementerio");
  assert.equal(puedeUsar(e, s, "Sarcófago"), false);
});

test("Sarcófago: sin cartas en la mano no se puede usar", () => {
  const e = mesa();
  const s = poner(e, 0, "reserva", "Sarcófago");
  assert.equal(puedeUsar(e, s, "Sarcófago"), false);
});

test("Sarcófago: el oponente no puede Desterrar Aliados con Exhumar de tu Cementerio", { todo: "protección: el oponente no puede Desterrar Aliados con Exhumar de tu Cementerio" }, () => {
  assert.fail();
});

test("Sarcófago Impío: mira cuatro cartas del fondo de tu Castillo, una a tu mano y otra a tu Cementerio", () => {
  let e = mesa();
  const a = poner(e, 0, "castillo", "Valefor");
  const b = poner(e, 0, "castillo", "Balaur");
  const s = poner(e, 0, "mano", "Sarcófago Impío");
  e = hacer(e, oro(s), a, b);
  assert.equal(zonaDe(e, a), "mano");
  assert.equal(zonaDe(e, b), "cementerio");
  assert.equal(e.jugadores[0].castillo.length, 30);
});

test("Sarcófago Impío: una vez por turno un Aliado gana Indestructible, Indesterrable o No puede ser Barajado hasta tu próximo turno", () => {
  let e = mesa();
  const s = poner(e, 0, "reserva", "Sarcófago Impío");
  const v = poner(e, 0, "defensa", "Valefor");
  e = hacer(e, habilidad(s, "Sarcófago Impío"), "Indesterrable");
  assert.equal(N.tiene(e, v, "Indesterrable"), true);
  assert.equal(N.tiene(e, v, "Indestructible"), false);
  assert.equal(puedeUsar(e, s, "Sarcófago Impío"), false);
  N.expirar(e, "finTurno");
  assert.equal(N.tiene(e, v, "Indesterrable"), true);
});

test("Sarcófago Impío: la opción No puede ser Barajado da la clave NoBarajable", () => {
  let e = mesa();
  const s = poner(e, 0, "reserva", "Sarcófago Impío");
  const v = poner(e, 1, "defensa", "Valefor");
  e = hacer(e, habilidad(s, "Sarcófago Impío"), "No puede ser Barajado");
  assert.equal(N.tiene(e, v, "NoBarajable"), true);
});

test("Sarcófago Impío: los Aliados oponentes pierden 1 de Fuerza", () => {
  const e = mesa();
  poner(e, 0, "reserva", "Sarcófago Impío");
  const propio = poner(e, 0, "defensa", "Valefor");
  const rival = poner(e, 1, "defensa", "Valefor");
  assert.equal(N.fuerza(e, propio), 3);
  assert.equal(N.fuerza(e, rival), 2);
});

test("Snagov: al entrar hasta dos Aliados ganan 2 de Fuerza permanentemente", () => {
  let e = mesa();
  const a = poner(e, 0, "defensa", "Valefor");
  const b = poner(e, 1, "defensa", "Valefor");
  const c = poner(e, 1, "defensa", "Valefor");
  const s = poner(e, 0, "mano", "Snagov");
  e = hacer(e, oro(s), a, b);
  N.expirar(e, "finTurno");
  N.expirar(e, "inicio");
  assert.equal(N.fuerza(e, a), 5);
  assert.equal(N.fuerza(e, b), 5);
  assert.equal(N.fuerza(e, c), 3);
});

test("Snagov: una vez por turno, pagando un Oro, una carta pierde su habilidad por el turno", () => {
  let e = mesa();
  const s = poner(e, 0, "reserva", "Snagov");
  oros(e, 0, 1);
  const onsen = poner(e, 1, "reserva", "Onsen");
  e = hacer(e, habilidad(s, "Snagov"), onsen);
  assert.equal(N.activa(e, onsen), false);
  assert.equal(e.jugadores[0].reserva.length, 1);
  assert.equal(puedeUsar(e, s, "Snagov"), false);
  N.expirar(e, "finTurno");
  assert.equal(N.activa(e, onsen), true);
});

test("Snagov: en tu Fase Final, sin Oros en Reserva, sube un Aliado de tu Cementerio a tu mano", () => {
  let e = mesa();
  poner(e, 0, "pagado", "Snagov");
  const v = poner(e, 0, "cementerio", "Valefor");
  e = disparar(e, "faseFinal", { j: 0 });
  assert.equal(zonaDe(e, v), "mano");
});

test("Snagov: con Oros en Reserva no sube Aliados en la Fase Final", () => {
  let e = mesa();
  poner(e, 0, "reserva", "Snagov");
  const v = poner(e, 0, "cementerio", "Valefor");
  e = disparar(e, "faseFinal", { j: 0 });
  assert.equal(zonaDe(e, v), "cementerio");
});

test("Tablas del Juramento: cuando el oponente juega por segunda vez en el turno una carta sin pagar su coste, puedes ponerla desde tu mano en tu Oro Pagado", () => {
  let e = mesa();
  const t = poner(e, 0, "mano", "Tablas del Juramento");
  const x = poner(e, 1, "defensa", "Valefor");
  const y = poner(e, 1, "defensa", "Valefor");
  e = disparar(e, "juega", { uid: x, j: 1, tipo: "Aliado", pagado: true });
  e = disparar(e, "juega", { uid: x, j: 1, tipo: "Aliado", pagado: false });
  assert.equal(e.pendiente, null);
  e = disparar(e, "juega", { uid: y, j: 1, tipo: "Aliado", pagado: false });
  e = elegir(e, true);
  assert.equal(zonaDe(e, t), "pagado");
  assert.equal(N.ubicar(e, t).j, 0);
});

test("Tablas del Juramento: también funciona desde el Cementerio y no por tus propias jugadas", () => {
  let e = mesa();
  const t = poner(e, 0, "cementerio", "Tablas del Juramento");
  const x = poner(e, 0, "defensa", "Valefor");
  e = disparar(e, "juega", { uid: x, j: 0, tipo: "Aliado", pagado: false });
  e = disparar(e, "juega", { uid: x, j: 0, tipo: "Aliado", pagado: false });
  assert.equal(e.pendiente, null);
  const y = poner(e, 1, "defensa", "Valefor");
  e = disparar(e, "juega", { uid: y, j: 1, tipo: "Aliado", pagado: false });
  e = disparar(e, "juega", { uid: y, j: 1, tipo: "Aliado", pagado: false });
  e = elegir(e, true);
  assert.equal(zonaDe(e, t), "pagado");
});

test("Tablas del Juramento: no se puede reducir costes ni jugar cartas sin pagar su coste más de una vez por turno", { todo: "restricción: reducir costes o jugar cartas sin pagar su coste solo una vez por turno" }, () => {
  assert.fail();
});

test("Tamales: es Oro Inicial y en tu Fase Final puedes Barajar hasta tres cartas de los Cementerios", () => {
  let e = mesa();
  const t = poner(e, 0, "reserva", "Tamales");
  assert.equal(N.carta(e, t).oroInicial, true);
  const a = poner(e, 0, "cementerio", "Valefor");
  const b = poner(e, 1, "cementerio", "Valefor");
  const c = poner(e, 1, "cementerio", "Valefor");
  e = disparar(e, "faseFinal", { j: 0 });
  e = elegir(e, a);
  e = elegir(e, b);
  e = elegir(e, null);
  assert.equal(zonaDe(e, a), "castillo");
  assert.equal(zonaDe(e, b), "castillo");
  assert.equal(zonaDe(e, c), "cementerio");
});

test("Tamales: no puede ser afectado por Aliados", { todo: "protección: no puede ser afectado por Aliados" }, () => {
  assert.fail();
});

test("Tamales: el oponente no puede usar habilidades de Oros y cartas de coste 2 o más si controla otra copia", { todo: "restricción: el oponente no puede usar habilidades de Oros y de cartas de coste 2 o más de las que controle otra copia" }, () => {
  assert.fail();
});

test("Terminal P-12: es Oro Inicial", () => {
  const e = mesa();
  assert.equal(N.carta(e, poner(e, 0, "reserva", "Terminal P-12")).oroInicial, true);
});

test("Terminal P-12: tus cartas no pierden su habilidad por efectos oponentes", { todo: "protección: tus cartas no pueden perder su habilidad por efectos oponentes" }, () => {
  assert.fail();
});

test("Terminal P-12: el oponente no puede mirar tu mano ni tu Castillo", { todo: "protección: el oponente no puede mirar tu mano ni tu Castillo" }, () => {
  assert.fail();
});

test("Terminal P-12: cada jugador busca hasta dos cartas y usa hasta dos habilidades de cartas fuera del juego por turno", { todo: "restricción: máximo de búsquedas y de habilidades de cartas fuera del juego por turno" }, () => {
  assert.fail();
});

test("Tesoro de Bandido: al entrar busca un Bandido en tu Castillo y lo pone en tu mano", () => {
  let e = mesa();
  const b = ficticia(e, 0, "castillo", { razas: ["Bandido"] });
  const t = poner(e, 0, "mano", "Tesoro de Bandido");
  e = hacer(e, oro(t), b);
  assert.equal(zonaDe(e, b), "mano");
});

test("Tesoro de Bandido: en tu Vigilia, si no pusiste Oros este turno, pones un Oro del Cementerio oponente en tu Reserva", () => {
  let e = mesa();
  const t = poner(e, 0, "reserva", "Tesoro de Bandido");
  const o = poner(e, 1, "cementerio", "Drácula");
  e = aplicar(e, habilidad(t, "Tesoro de Bandido"));
  assert.equal(zonaDe(e, o), "reserva");
  assert.equal(N.ubicar(e, o).j, 0);
  poner(e, 1, "cementerio", "Drácula");
  assert.equal(puedeUsar(e, t, "Tesoro de Bandido"), false);
});

test("Tesoro de Bandido: el turno en que entra no puede usar su habilidad de Vigilia", () => {
  let e = mesa();
  const t = poner(e, 0, "mano", "Tesoro de Bandido");
  poner(e, 1, "cementerio", "Drácula");
  e = resolverTodo(aplicar(e, oro(t)));
  assert.equal(puedeUsar(e, t, "Tesoro de Bandido"), false);
});

test("Tesoro de Bandido: tus Aliados Bandido ganan 1 de Fuerza", () => {
  const e = mesa();
  poner(e, 0, "reserva", "Tesoro de Bandido");
  const b = ficticia(e, 0, "defensa", { razas: ["Bandido"] });
  const v = poner(e, 0, "defensa", "Valefor");
  const rb = ficticia(e, 1, "defensa", { razas: ["Bandido"] });
  assert.equal(N.fuerza(e, b), 3);
  assert.equal(N.fuerza(e, v), 3);
  assert.equal(N.fuerza(e, rb), 2);
});

function resolverTodo(e) {
  for (let i = 0; i < 40 && e.pendiente; i++) e = aplicar(e, { tipo: "elegir", i: e.pendiente.opciones.length - 1 });
  return e;
}

test("Tesoro de la Marquesa: una vez en tu turno Destruye un Oro de tu Reserva para poner en tu Reserva el primer Oro del tope de tu Castillo", () => {
  let e = mesa();
  const m = poner(e, 0, "reserva", "Tesoro de la Marquesa");
  const x = poner(e, 0, "reserva", "Drácula");
  const v = poner(e, 0, "castillo", "Valefor");
  alTope(e, 0, v);
  const primerOro = e.jugadores[0].castillo[1];
  e = hacer(e, habilidad(m, "Tesoro de la Marquesa"), x, false);
  assert.equal(zonaDe(e, x), "cementerio");
  assert.equal(zonaDe(e, primerOro), "reserva");
  assert.equal(zonaDe(e, v), "castillo");
  assert.equal(puedeUsar(e, m, "Tesoro de la Marquesa"), false);
});

test("Tesoro de la Marquesa: una vez por turno, cuando una carta es puesta en un Cementerio, puedes Desterrarla", () => {
  let e = mesa();
  poner(e, 0, "reserva", "Tesoro de la Marquesa");
  const a = poner(e, 1, "defensa", "Valefor");
  const b = poner(e, 1, "defensa", "Valefor");
  N.mover(e, a, "cementerio");
  resolver(e);
  e = elegir(e, true);
  assert.equal(zonaDe(e, a), "destierro");
  N.mover(e, b, "cementerio");
  resolver(e);
  assert.equal(e.pendiente, null);
  assert.equal(zonaDe(e, b), "cementerio");
});

test("Tesoro de los Cesares: mira tantas cartas del tope como Oros controles y pone dos en tu mano", () => {
  let e = mesa();
  oros(e, 0, 2);
  const [a, b, c] = e.jugadores[0].castillo;
  const t = poner(e, 0, "mano", "Tesoro de los Cesares");
  e = hacer(e, oro(t), a, c);
  assert.equal(zonaDe(e, a), "mano");
  assert.equal(zonaDe(e, c), "mano");
  assert.equal(zonaDe(e, b), "castillo");
});

test("Tesoro de los Cesares: es Única", () => {
  const e = mesa();
  poner(e, 0, "reserva", "Tesoro de los Cesares");
  const otro = poner(e, 0, "mano", "Tesoro de los Cesares");
  assert.equal(puedeJugarOro(e, otro), false);
});

test("Tesoro de los Cesares: una vez por turno Baraja una carta de tu mano para nombrar una carta", () => {
  let e = mesa();
  const t = poner(e, 0, "reserva", "Tesoro de los Cesares");
  const d = poner(e, 0, "mano", "Drácula");
  const objetivo = poner(e, 1, "mano", "Balaur");
  e = hacer(e, habilidad(t, "Tesoro de los Cesares"), objetivo);
  assert.equal(zonaDe(e, d), "castillo");
  assert.ok(e.efectos.some((f) => f.tipo === "costeExtraNombre" && f.nombre === "Balaur"));
  assert.equal(puedeUsar(e, t, "Tesoro de los Cesares"), false);
});

test("Tesoro de los Cesares: la carta nombrada cuesta un Oro adicional el próximo turno", { todo: "efecto: una carta nombrada cuesta Oros adicionales durante un período" }, () => {
  assert.fail();
});

test("Tesoro del Santiaguillo: al entrar busca un Aliado en un Castillo y lo pone en el Cementerio de su dueño", () => {
  let e = mesa();
  const v = poner(e, 1, "castillo", "Valefor");
  const t = poner(e, 0, "mano", "Tesoro del Santiaguillo");
  e = hacer(e, oro(t), v);
  assert.equal(zonaDe(e, v), "cementerio");
  assert.equal(N.ubicar(e, v).j, 1);
});

test("Tesoro del Santiaguillo: al ser Destruido puede convertirse en un Aliado de Fuerza 1 con Furia que al atacar Destierra una carta de un Castillo", () => {
  let e = mesa();
  const t = poner(e, 0, "reserva", "Tesoro del Santiaguillo");
  N.mover(e, t, "cementerio");
  resolver(e);
  e = elegir(e, true);
  assert.equal(zonaDe(e, t), "defensa");
  assert.equal(N.carta(e, t).tipo, "Aliado");
  assert.equal(N.fuerza(e, t), 1);
  assert.equal(N.tiene(e, t, "Furia"), true);
  e = disparar(e, "ataca", { uid: t, j: 0 });
  e = elegir(e, deJugador(1));
  assert.equal(e.jugadores[1].destierro.length, 1);
  assert.equal(e.jugadores[1].castillo.length, 29);
});

test("Tesoro del Santiaguillo: como Aliado, al ser Destruido no vuelve a convertirse", () => {
  let e = mesa();
  const t = poner(e, 0, "reserva", "Tesoro del Santiaguillo");
  N.mover(e, t, "cementerio");
  resolver(e);
  e = elegir(e, true);
  N.mover(e, t, "cementerio");
  resolver(e);
  assert.equal(e.pendiente, null);
  assert.equal(zonaDe(e, t), "cementerio");
});

test("Trapelacucha: al entrar Roba una carta", () => {
  let e = mesa();
  const t = poner(e, 0, "mano", "Trapelacucha");
  e = hacer(e, oro(t), "Robar una carta");
  assert.equal(e.jugadores[0].mano.length, 1);
});

test("Trapelacucha: o sube hasta dos cartas que no sean Talismán de tu Cementerio a tu mano", () => {
  let e = mesa();
  const a = poner(e, 0, "cementerio", "Valefor");
  const b = poner(e, 0, "cementerio", "Balaur");
  const tal = poner(e, 0, "cementerio", "Llamar a la Manada");
  const t = poner(e, 0, "mano", "Trapelacucha");
  e = aplicar(e, oro(t));
  e = elegir(e, (v, o) => o.texto.startsWith("Subir"));
  assert.equal(e.pendiente.opciones.some((o) => o.valor === tal), false);
  e = elegir(e, a);
  e = elegir(e, b);
  assert.equal(zonaDe(e, a), "mano");
  assert.equal(zonaDe(e, b), "mano");
  assert.equal(zonaDe(e, tal), "cementerio");
});

test("Trapelacucha: en tu Vigilia Baraja y/o Destierra hasta dos cartas de los Cementerios, una vez por turno entre Vigilia y Fase Final", () => {
  let e = mesa();
  const t = poner(e, 0, "reserva", "Trapelacucha");
  const a = poner(e, 1, "cementerio", "Valefor");
  const b = poner(e, 1, "cementerio", "Valefor");
  e = hacer(e, habilidad(t, "Trapelacucha"), a, null, b);
  assert.equal(zonaDe(e, a), "castillo");
  assert.equal(zonaDe(e, b), "destierro");
  assert.equal(puedeUsar(e, t, "Trapelacucha"), false);
  poner(e, 1, "cementerio", "Valefor");
  e = disparar(e, "faseFinal", { j: 0 });
  assert.equal(e.pendiente, null);
});

test("Trapelacucha: si no se usó en la Vigilia, puede usarse en la Fase Final", () => {
  let e = mesa();
  poner(e, 0, "reserva", "Trapelacucha");
  const a = poner(e, 1, "cementerio", "Valefor");
  e = disparar(e, "faseFinal", { j: 0 });
  e = elegir(e, true);
  e = elegir(e, null);
  e = elegir(e, a);
  assert.equal(zonaDe(e, a), "destierro");
});

test("Trofeo de Cazador: al entrar busca un Oro en tu Castillo y lo pone en tu mano", () => {
  let e = mesa();
  const t = poner(e, 0, "mano", "Trofeo de Cazador");
  e = hacer(e, oro(t), nombreDe(e, "Drácula"));
  assert.equal(e.jugadores[0].mano.length, 1);
  assert.equal(e.jugadores[0].castillo.length, 29);
});

test("Trofeo de Cazador: o muestra tu mano y limita al oponente a un Talismán en esta Vigilia", { todo: "restricción: el oponente solo puede jugar un Talismán durante esta Vigilia" }, () => {
  assert.fail();
});

test("Trofeo de Cazador: Desterrarlo convierte una carta en una del mismo tipo sin habilidad", () => {
  let e = mesa();
  const t = poner(e, 0, "reserva", "Trofeo de Cazador");
  const v = poner(e, 1, "defensa", "Valefor");
  const onsen = poner(e, 1, "reserva", "Onsen");
  e = hacer(e, habilidad(t, "Trofeo de Cazador"), v);
  assert.equal(zonaDe(e, t), "destierro");
  assert.equal(N.activa(e, onsen), true);
  assert.equal(N.carta(e, v).tipo, "Aliado");
  assert.equal(N.carta(e, v).sinHabilidad, true);
  assert.equal(N.fuerza(e, v), 3);
});

test("Trono Divino: al comienzo de tu Vigilia, con dos o más Armas y/o Tótem, mira la primera carta y elige mano o Cementerio", () => {
  let e = mesa();
  poner(e, 0, "reserva", "Trono Divino");
  ficticia(e, 0, "apoyo", { tipo: "Tótem" });
  ficticia(e, 0, "apoyo", { tipo: "Tótem" });
  const [tope] = e.jugadores[0].castillo;
  e = disparar(e, "comienzoVigilia", { j: 0 });
  e = elegir(e, true);
  e = elegir(e, "A tu Cementerio");
  assert.equal(zonaDe(e, tope), "cementerio");
});

test("Trono Divino: con menos de dos Armas y/o Tótem no se dispara", () => {
  let e = mesa();
  poner(e, 0, "reserva", "Trono Divino");
  const a = poner(e, 0, "defensa", "Valefor");
  poner(e, 0, "arma", "Pedrenyal", { portador: a });
  e = disparar(e, "comienzoVigilia", { j: 0 });
  assert.equal(e.pendiente, null);
});

test("Trono Divino: la primera Arma o Tótem de coste 2 o más que juegues en tu turno no puede ser Anulada", { todo: "protección: la primera carta de ciertos tipos y coste mínimo jugada en el turno no puede ser Anulada" }, () => {
  assert.fail();
});

test("Trono del Cielo: mira tres cartas del tope, una a tu mano y otra al fondo de tu Castillo", () => {
  let e = mesa();
  const [a, b] = e.jugadores[0].castillo;
  const t = poner(e, 0, "mano", "Trono del Cielo");
  e = hacer(e, oro(t), a, b);
  assert.equal(zonaDe(e, a), "mano");
  assert.equal(e.jugadores[0].castillo.at(-1), b);
});

test("Trono del Cielo: es Única", () => {
  const e = mesa();
  poner(e, 0, "reserva", "Trono del Cielo");
  assert.equal(puedeJugarOro(e, poner(e, 0, "mano", "Trono del Cielo")), false);
});

test("Trono del Cielo: cuenta como dos Oros si el oponente generó o puso en juego más de un Oro en su turno anterior", { todo: "pago: un Oro cuenta como dos Oros bajo una condición" }, () => {
  assert.fail();
});

test("Trono del Dragón: al entrar Baraja dos cartas de tu mano y Roba tres", () => {
  let e = mesa();
  const [x, y, z] = [1, 2, 3].map(() => poner(e, 0, "mano", "Valefor"));
  const t = poner(e, 0, "mano", "Trono del Dragón");
  e = hacer(e, oro(t), x, y);
  assert.equal(zonaDe(e, x), "castillo");
  assert.equal(zonaDe(e, y), "castillo");
  assert.equal(zonaDe(e, z), "mano");
  assert.equal(e.jugadores[0].mano.length, 4);
});

test("Trono del Dragón: con tres o más Aliados de la misma Raza tus Aliados ganan 1 de Fuerza", () => {
  const e = mesa();
  poner(e, 0, "reserva", "Trono del Dragón");
  const a = poner(e, 0, "defensa", "Valefor");
  const g = poner(e, 0, "defensa", "Guardia Real");
  poner(e, 0, "defensa", "Valefor");
  assert.equal(N.fuerza(e, a), 3);
  poner(e, 0, "defensa", "Valefor");
  assert.equal(N.fuerza(e, a), 4);
  assert.equal(N.fuerza(e, g), 4);
});

test("Trono del Dragón: tus Aliados no pueden ser afectados por habilidades de cartas fuera del juego mientras atacan", { todo: "protección: tus Aliados atacantes no pueden ser afectados por habilidades de cartas fuera del juego" }, () => {
  assert.fail();
});

test("Trono del Rey Eterno: mira tantas cartas del tope como Oros controles y pone una en tu mano", () => {
  let e = mesa();
  oros(e, 0, 1);
  const [a, b, c] = e.jugadores[0].castillo;
  const t = poner(e, 0, "mano", "Trono del Rey Eterno");
  e = aplicar(e, oro(t));
  assert.deepEqual(e.pendiente.opciones.map((o) => o.valor), [a, b]);
  e = elegir(e, b);
  assert.equal(zonaDe(e, b), "mano");
  assert.equal(zonaDe(e, c), "castillo");
});

test("Trono del Rey Eterno: cada jugador pone en juego por turno hasta tantas cartas de cada tipo como Oros controle", { todo: "restricción: cada jugador pone en juego por turno hasta tantas cartas de cada tipo como Oros controle" }, () => {
  assert.fail();
});

test("Tukuturi: al entrar los demás Oros pierden su habilidad hasta tu próximo turno", () => {
  let e = mesa();
  const mio = poner(e, 0, "reserva", "Onsen");
  const suyo = poner(e, 1, "reserva", "Onsen");
  const t = poner(e, 0, "mano", "Tukuturi");
  e = aplicar(e, oro(t));
  assert.equal(N.activa(e, mio), false);
  assert.equal(N.activa(e, suyo), false);
  assert.equal(N.activa(e, t), true);
  N.expirar(e, "finTurno");
  assert.equal(N.activa(e, suyo), false);
  e.activo = 0;
  e.turno += 2;
  N.expirar(e, "inicio");
  assert.equal(N.activa(e, suyo), true);
});

test("Tukuturi: cuando el oponente pone cartas en su mano por un Oro, se convierte en Oro sin habilidad, los Oros pierden su habilidad y Robas dos", { todo: "evento: cuando un jugador pone cartas en su mano por un efecto" }, () => {
  assert.fail();
});

test("Udjat: una vez por turno dos Aliados pierden 1 de Fuerza por el turno", () => {
  let e = mesa();
  const u = poner(e, 0, "reserva", "Udjat");
  const a = poner(e, 1, "defensa", "Valefor");
  const b = poner(e, 1, "defensa", "Valefor");
  const c = poner(e, 0, "defensa", "Valefor");
  e = hacer(e, habilidad(u, "Udjat"), 0, a, b, "Pierden 1");
  assert.equal(N.fuerza(e, a), 2);
  assert.equal(N.fuerza(e, b), 2);
  assert.equal(N.fuerza(e, c), 3);
  assert.equal(puedeUsar(e, u, "Udjat"), false);
  N.expirar(e, "finTurno");
  assert.equal(N.fuerza(e, a), 3);
});

test("Udjat: o Baraja una carta de tu mano para Robar una carta", () => {
  let e = mesa();
  const u = poner(e, 0, "reserva", "Udjat");
  const m = poner(e, 0, "mano", "Balaur");
  e = hacer(e, habilidad(u, "Udjat"), 1);
  assert.equal(zonaDe(e, m), "castillo");
  assert.equal(e.jugadores[0].mano.length, 1);
});

test("Udjat: en tu Fase Final Destierra una carta de tu Cementerio para Desterrar hasta dos del Cementerio oponente", () => {
  let e = mesa();
  poner(e, 0, "reserva", "Udjat");
  const mia = poner(e, 0, "cementerio", "Valefor");
  const r = [1, 2, 3].map(() => poner(e, 1, "cementerio", "Valefor"));
  e = disparar(e, "faseFinal", { j: 0 });
  e = elegir(e, true);
  e = elegir(e, r[0]);
  e = elegir(e, r[1]);
  assert.equal(zonaDe(e, mia), "destierro");
  assert.deepEqual(r.map((x) => zonaDe(e, x)), ["destierro", "destierro", "cementerio"]);
});

for (const nombre of ["Un Viaje al Centro de la Tierra", "Viaje al Centro de la Tierra"]) {
  test(`${nombre}: una vez por turno, cuando una carta tuya que no es Talismán es Anulada, Destierras el tope de tu Castillo para subirla a tu mano`, () => {
    let e = mesa();
    poner(e, 0, "reserva", nombre);
    const v = poner(e, 0, "cementerio", "Valefor");
    const w = poner(e, 0, "cementerio", "Valefor");
    const tal = poner(e, 0, "cementerio", "Llamar a la Manada");
    e = disparar(e, "anulada", { uid: tal, j: 0, tipo: "Talismán" });
    assert.equal(e.pendiente, null);
    e = disparar(e, "anulada", { uid: v, j: 0, tipo: "Aliado" });
    e = elegir(e, true);
    assert.equal(zonaDe(e, v), "mano");
    assert.equal(e.jugadores[0].destierro.length, 1);
    e = disparar(e, "anulada", { uid: w, j: 0, tipo: "Aliado" });
    assert.equal(e.pendiente, null);
  });

  test(`${nombre}: no se dispara cuando Anulan cartas del oponente`, () => {
    let e = mesa();
    poner(e, 0, "reserva", nombre);
    const v = poner(e, 1, "cementerio", "Valefor");
    e = disparar(e, "anulada", { uid: v, j: 1, tipo: "Aliado" });
    assert.equal(e.pendiente, null);
  });

  test(`${nombre}: cuando lo pagas para jugar una carta de coste 2 o más, Robas una carta`, () => {
    let e = mesa();
    poner(e, 0, "reserva", nombre);
    oros(e, 0, 1);
    const g = poner(e, 0, "mano", "Guardia Real");
    e = sinRespuesta(aplicar(e, jugar(g)));
    assert.equal(zonaDe(e, g), "defensa");
    assert.equal(e.jugadores[0].mano.length, 1);
  });

  test(`${nombre}: no Roba si la carta cuesta menos de 2 o no lo pagaste`, () => {
    let e = mesa();
    oros(e, 0, 2);
    poner(e, 0, "reserva", nombre);
    const v = poner(e, 0, "mano", "Valefor");
    e = sinRespuesta(aplicar(e, jugar(v)));
    assert.equal(e.jugadores[0].mano.length, 0);
    const g = poner(e, 0, "mano", "Guardia Real");
    e = sinRespuesta(aplicar(e, jugar(g)));
    assert.equal(e.jugadores[0].mano.length, 1);
    let f = mesa();
    oros(f, 0, 2);
    poner(f, 0, "reserva", nombre);
    const g2 = poner(f, 0, "mano", "Guardia Real");
    f = sinRespuesta(aplicar(f, jugar(g2)));
    assert.equal(f.jugadores[0].mano.length, 0);
  });
}

test("Veinte Mil Leguas de Viaje Submarino: al entrar muestra cartas del tope hasta un Oro, lo pone en tu mano y Baraja el resto", () => {
  let e = mesa();
  const v = poner(e, 0, "castillo", "Valefor");
  alTope(e, 0, v);
  const oroSegundo = e.jugadores[0].castillo[1];
  const t = poner(e, 0, "mano", "Veinte Mil Leguas de Viaje Submarino");
  e = aplicar(e, oro(t));
  assert.equal(zonaDe(e, oroSegundo), "mano");
  assert.equal(zonaDe(e, v), "castillo");
  assert.equal(e.jugadores[0].mano.length, 1);
});

test("Veinte Mil Leguas de Viaje Submarino: al comienzo de la Vigilia Descartas una carta para subirlo de tu Cementerio a tu mano", () => {
  let e = mesa();
  const t = poner(e, 0, "cementerio", "Veinte Mil Leguas de Viaje Submarino");
  const d = poner(e, 0, "mano", "Valefor");
  e = disparar(e, "comienzoVigilia", { j: 1 });
  e = elegir(e, true);
  assert.equal(zonaDe(e, d), "cementerio");
  assert.equal(zonaDe(e, t), "mano");
});

test("Veinte Mil Leguas de Viaje Submarino: puede subir otro Oro de tu Cementerio", () => {
  let e = mesa();
  poner(e, 0, "cementerio", "Veinte Mil Leguas de Viaje Submarino");
  const otro = poner(e, 0, "cementerio", "Onsen");
  poner(e, 0, "mano", "Valefor");
  e = disparar(e, "comienzoVigilia", { j: 0 });
  e = elegir(e, true);
  e = elegir(e, otro);
  assert.equal(zonaDe(e, otro), "mano");
});

test("Veinte Mil Leguas de Viaje Submarino: sin cartas en la mano no se ofrece", () => {
  let e = mesa();
  poner(e, 0, "cementerio", "Veinte Mil Leguas de Viaje Submarino");
  e = disparar(e, "comienzoVigilia", { j: 0 });
  assert.equal(e.pendiente, null);
});

test("Yelmo Jepresh: una vez por turno Descartas una carta para mostrar del tope hasta una del mismo tipo y ponerla en tu mano", () => {
  let e = mesa();
  const y = poner(e, 0, "reserva", "Yelmo Jepresh");
  const d = poner(e, 0, "mano", "Valefor");
  const v = poner(e, 0, "castillo", "Balaur");
  const c = e.jugadores[0].castillo;
  c.splice(c.indexOf(v), 1);
  c.splice(3, 0, v);
  e = aplicar(e, habilidad(y, "Yelmo Jepresh"));
  assert.equal(zonaDe(e, d), "cementerio");
  assert.equal(zonaDe(e, v), "mano");
  assert.equal(e.jugadores[0].mano.length, 1);
  assert.equal(puedeUsar(e, y, "Yelmo Jepresh"), false);
});

test("Yelmo Jepresh: Desterrarlo Baraja dos cartas de tu Cementerio y Roba dos cartas", () => {
  let e = mesa();
  const y = poner(e, 0, "reserva", "Yelmo Jepresh");
  const a = poner(e, 0, "cementerio", "Valefor");
  const b = poner(e, 0, "cementerio", "Valefor");
  e = aplicar(e, habilidad(y, "Yelmo Jepresh", 1));
  assert.equal(zonaDe(e, y), "destierro");
  assert.equal(zonaDe(e, a) === "castillo" || zonaDe(e, a) === "mano", true);
  assert.equal(zonaDe(e, b) === "castillo" || zonaDe(e, b) === "mano", true);
  assert.equal(e.jugadores[0].cementerio.length, 0);
  assert.equal(e.jugadores[0].mano.length, 2);
});

test("Zapatillas Rojas: al entrar nombra una carta de coste 3 o menos y Roba una carta", () => {
  let e = mesa();
  const objetivo = poner(e, 1, "mano", "Valefor");
  const t = poner(e, 0, "mano", "Zapatillas Rojas");
  e = aplicar(e, oro(t));
  assert.equal(e.pendiente.opciones.some((o) => o.valor !== null && N.carta(e, o.valor).coste > 3), false);
  e = elegir(e, objetivo);
  assert.equal(e.usos[`zapatillas|${t}`], "Valefor");
  assert.equal(e.jugadores[0].mano.length, 1);
});

test("Zapatillas Rojas: su habilidad no puede ser cancelada y las cartas nombradas cuestan un Oro para usar sus habilidades", { todo: "restricción: usar habilidades de cartas nombradas cuesta un Oro; protección: habilidad que no puede ser cancelada" }, () => {
  assert.fail();
});

test("Aho: tiene Exhumar y el portador gana 3 de Fuerza", () => {
  const e = mesa();
  const a = poner(e, 0, "defensa", "Valefor");
  const aho = poner(e, 0, "arma", "Aho", { portador: a });
  assert.equal(N.fuerza(e, a), 6);
  assert.equal(N.tiene(e, aho, "Exhumar"), true);
});

test("Aho: una vez por turno Destierra un Aliado o Tótem y cinco cartas del tope de un Castillo", () => {
  let e = mesa();
  const a = poner(e, 0, "defensa", "Valefor");
  const aho = poner(e, 0, "arma", "Aho", { portador: a });
  const r = poner(e, 1, "defensa", "Valefor");
  ficticia(e, 1, "apoyo", { tipo: "Tótem" });
  e = hacer(e, habilidad(aho, "Aho"), r, "Castillo oponente");
  assert.equal(zonaDe(e, r), "destierro");
  assert.equal(e.jugadores[1].destierro.length, 6);
  assert.equal(e.jugadores[1].castillo.length, 25);
  assert.equal(puedeUsar(e, aho, "Aho"), false);
});

test("Aho: cuando el portador sale del juego, puedes subirla a tu mano", () => {
  let e = mesa();
  oros(e, 0, 2);
  const a = poner(e, 0, "defensa", "Valefor");
  const aho = poner(e, 0, "mano", "Aho");
  e = sinRespuesta(aplicar(e, jugar(aho, { portador: a })));
  assert.equal(N.portadorDe(e, aho), a);
  N.mover(e, a, "cementerio");
  resolver(e);
  e = elegir(e, "Subirla a tu mano");
  assert.equal(zonaDe(e, aho), "mano");
});

test("Aho: cuando el portador sale del juego, puedes cambiarla de portador", () => {
  let e = mesa();
  oros(e, 0, 2);
  const a = poner(e, 0, "defensa", "Valefor");
  const b = poner(e, 0, "defensa", "Valefor");
  const aho = poner(e, 0, "mano", "Aho");
  e = sinRespuesta(aplicar(e, jugar(aho, { portador: a })));
  N.mover(e, a, "cementerio");
  resolver(e);
  e = elegir(e, "Cambiarla de portador");
  assert.equal(N.portadorDe(e, aho), b);
  assert.equal(N.fuerza(e, b), 6);
  N.mover(e, b, "cementerio");
  resolver(e);
  e = elegir(e, "Subirla a tu mano");
  assert.equal(zonaDe(e, aho), "mano");
});

test("Aho: el portador no puede ser afectado por Aliados oponentes", { todo: "protección: el portador no puede ser afectado por Aliados oponentes" }, () => {
  assert.fail();
});
