import { test } from "node:test";
import assert from "node:assert/strict";
import { mesa, poner, oros, hacer, elegir, sinRespuesta, accionesLegales, aplicar, zonaDe, id, N } from "./ayuda-duelo.mjs";
import { resolver, OPS, disponibles } from "../web/duelo/efectos.js";

const jugar = (uid, extra = {}) => ({ tipo: "jugar", uid, ...extra });
const habilidad = (uid, nombre, h = 0) => ({ tipo: "habilidad", uid, def: id(nombre), h });
const nombreDe = (e, nombre) => (v) => v !== null && N.carta(e, v).nombre === nombre;
const texto = (inicio) => (v, o) => (o.texto ?? "").startsWith(inicio);
const puedeJugar = (e, uid) => accionesLegales(e).some((a) => a.tipo === "jugar" && a.uid === uid);
const puedeUsar = (e, uid) => accionesLegales(e).some((a) => a.tipo === "habilidad" && a.uid === uid);
const opcionesDe = (e) => e.pendiente.opciones.map((o) => o.valor);

function disparar(e, evento, datos) {
  N.disparar(e, evento, datos);
  resolver(e);
  return e;
}

let nFicticia = 0;
function ficticia(e, j, zona, datos = {}) {
  const idf = `ficticia-${nFicticia++}`;
  e.catalogo = {
    ...e.catalogo,
    [idf]: { id: idf, nombre: idf, tipo: "Aliado", coste: 1, fuerza: 2, razas: [], sinHabilidad: false, oroInicial: false, texto: "", ...datos },
  };
  const uid = `${j}-f${nFicticia}`;
  e.instancias[uid] = idf;
  e.jugadores[j][zona].push(uid);
  return uid;
}

function ajena(e, j, zona, nombre) {
  const uid = poner(e, N.rival(j), zona, nombre);
  N.sacar(e, uid);
  e.jugadores[j][zona].push(uid);
  return uid;
}

function semillaDado(par) {
  for (let s = 1; ; s++) {
    const x = { azar: s };
    const d = Math.floor(N.azar(x) * 6) + 1;
    if ((d % 2 === 0) === par) return s;
  }
}

test("Juicio de Vigilantes: Baraja hasta una carta que no sea Oro, busca una carta y tus Aliados ganan 2 de Fuerza permanentemente", () => {
  let e = mesa();
  oros(e, 0, 2);
  const v = poner(e, 0, "defensa", "Valefor");
  const rv = poner(e, 1, "defensa", "Valefor");
  const t = ficticia(e, 1, "apoyo", { tipo: "Tótem", coste: 2 });
  const juicio = poner(e, 0, "mano", "Juicio de Vigilantes");
  e = hacer(e, jugar(juicio), t, nombreDe(e, "Drácula"));
  assert.equal(zonaDe(e, t), "castillo");
  assert.equal(e.jugadores[0].mano.length, 1);
  assert.equal(N.fuerza(e, v), 5);
  assert.equal(N.fuerza(e, rv), 3);
  N.expirar(e, "finTurno");
  e.turno += 2;
  N.expirar(e, "finTurno");
  N.expirar(e, "inicio");
  assert.equal(N.fuerza(e, v), 5);
});

test("Juicio de Vigilantes: si es Anulado genera un Oro por el turno", () => {
  let e = mesa();
  const juicio = poner(e, 0, "cementerio", "Juicio de Vigilantes");
  e = disparar(e, "anulada", { uid: juicio, j: 0, tipo: "Talismán" });
  assert.deepEqual(e.jugadores[0].generados, [{ n: 1, tipos: null }]);
  assert.equal(disponibles(e, 0, "Aliado"), 1);
});

test("Juicio de Vigilantes: hasta tu próximo turno al oponente le cuesta un Oro adicional afectar a tus Aliados", () => {
  let e = mesa();
  oros(e, 0, 2);
  const v = poner(e, 0, "defensa", "Valefor");
  const t = ficticia(e, 0, "apoyo", { tipo: "Tótem", coste: 2 });
  const fuenteRival = poner(e, 1, "mano", "Mala Flecha");
  const juicio = poner(e, 0, "mano", "Juicio de Vigilantes");
  e = hacer(e, jugar(juicio), null, nombreDe(e, "Drácula"));
  const ctxRival = { ctrl: 1, fuente: fuenteRival };
  assert.equal(N.proteccionContra(e, v, ctxRival).cuesta, 1);
  assert.equal(N.proteccionContra(e, t, ctxRival).cuesta, 0);
  assert.equal(N.proteccionContra(e, v, { ctrl: 0, fuente: juicio }).cuesta, 0);
  e.turno += 1;
  e.activo = 1;
  N.expirar(e, "inicio");
  assert.equal(N.proteccionContra(e, v, ctxRival).cuesta, 1);
  e.turno += 1;
  e.activo = 0;
  N.expirar(e, "inicio");
  assert.equal(N.proteccionContra(e, v, ctxRival).cuesta, 0);
});

test("Julio Verne: no puede ser Anulado", () => {
  const e = mesa();
  const jv = poner(e, 0, "mano", "Julio Verne");
  assert.equal(N.carta(e, jv).claves.includes("NoAnulable"), true);
});

test("Julio Verne: sube tus Aliados a la mano y al comienzo de tu próximo turno los juega sin pagar y ganan 1 de Fuerza permanentemente", () => {
  let e = mesa();
  oros(e, 0, 3);
  const v1 = poner(e, 0, "defensa", "Valefor");
  const v2 = poner(e, 0, "defensa", "Valefor");
  const jv = poner(e, 0, "mano", "Julio Verne");
  e = hacer(e, jugar(jv), v1, v2);
  assert.equal(zonaDe(e, v1), "mano");
  assert.equal(zonaDe(e, v2), "mano");
  assert.equal(zonaDe(e, jv), "cementerio");
  e = disparar(e, "comienzoTurno", { j: 1 });
  assert.equal(zonaDe(e, v1), "mano");
  e = disparar(e, "comienzoTurno", { j: 0 });
  assert.equal(zonaDe(e, v1), "defensa");
  assert.equal(zonaDe(e, v2), "defensa");
  assert.equal(N.fuerza(e, v1), 4);
  assert.equal(N.fuerza(e, v2), 4);
  assert.equal(e.jugadores[0].reserva.length, 0);
  assert.equal(e.efectos.some((f) => f.tipo === "jugarAlComienzo"), false);
});

test("Julio Verne: solo se juega pagando su coste", () => {
  const e = mesa();
  oros(e, 0, 3);
  const jv = poner(e, 0, "mano", "Julio Verne");
  OPS.jugarGratis(e, { var: "x" }, { pasos: [], i: 0, ctx: { ctrl: 0, vars: { x: [jv] } } });
  assert.equal(zonaDe(e, jv), "mano");
  assert.equal(e.jugadores[0].reserva.length, 3);
  assert.equal(puedeJugar(e, jv), true);
});

test("Jurado Descontento: cada jugador Baraja los Aliados y Tótems ajenos que controla y Destierra dos del tope por cada uno", () => {
  let e = mesa();
  oros(e, 0, 1);
  const mia = poner(e, 0, "defensa", "Valefor");
  const prestada = ajena(e, 0, "defensa", "Valefor");
  const jd = poner(e, 0, "mano", "Jurado Descontento");
  e = hacer(e, jugar(jd), texto("Cada jugador"));
  assert.equal(zonaDe(e, mia), "defensa");
  assert.equal(zonaDe(e, prestada), "castillo");
  assert.equal(e.jugadores[1].castillo.length, 31);
  assert.equal(e.jugadores[0].destierro.length, 2);
  assert.equal(e.jugadores[1].destierro.length, 0);
});

test("Jurado Descontento: Destierra un Tótem de coste 3 o menos", () => {
  let e = mesa();
  oros(e, 0, 1);
  const t = ficticia(e, 1, "apoyo", { tipo: "Tótem", coste: 3 });
  ficticia(e, 1, "apoyo", { tipo: "Tótem", coste: 4 });
  const jd = poner(e, 0, "mano", "Jurado Descontento");
  e = hacer(e, jugar(jd), texto("Desterrar"));
  assert.equal(zonaDe(e, t), "destierro");
  assert.equal(e.jugadores[1].apoyo.length, 1);
});

test("Jurado Descontento: Anula un Tótem de coste 3 o menos", () => {
  let e = mesa();
  oros(e, 0, 3);
  oros(e, 1, 1);
  const t = ficticia(e, 0, "mano", { tipo: "Tótem", coste: 3 });
  const jd = poner(e, 1, "mano", "Jurado Descontento");
  e = aplicar(e, jugar(t));
  e = aplicar(e, { tipo: "responder", uid: jd });
  assert.equal(zonaDe(e, t), "cementerio");
  assert.equal(zonaDe(e, jd), "cementerio");
});

test("Jurado Descontento: no Anula Tótems de coste 4 o más", () => {
  let e = mesa();
  oros(e, 0, 4);
  oros(e, 1, 1);
  const t = ficticia(e, 0, "mano", { tipo: "Tótem", coste: 4 });
  poner(e, 1, "mano", "Jurado Descontento");
  e = aplicar(e, jugar(t));
  assert.equal(zonaDe(e, t), "apoyo");
});

test("Juramento: juega pagando su coste un Aliado de coste 2 o menos de un Cementerio bajo tu control", () => {
  let e = mesa();
  oros(e, 0, 3);
  const v = poner(e, 1, "cementerio", "Valefor");
  ficticia(e, 1, "cementerio", { coste: 3 });
  const jr = poner(e, 0, "mano", "Juramento");
  e = hacer(e, jugar(jr));
  assert.equal(zonaDe(e, v), "defensa");
  assert.equal(N.controlador(e, v), 0);
  assert.equal(e.jugadores[0].reserva.length, 0);
});

test("Juramento: sin Oros para pagar el Aliado no lo juega", () => {
  let e = mesa();
  oros(e, 0, 2);
  const v = poner(e, 0, "cementerio", "Valefor");
  const jr = poner(e, 0, "mano", "Juramento");
  e = hacer(e, jugar(jr));
  assert.equal(zonaDe(e, v), "cementerio");
});

test("Juramento: Desterrándolo del Cementerio y pagando un Oro busca hasta dos cartas de distinto nombre en el Castillo oponente y las Destierra", () => {
  let e = mesa();
  oros(e, 0, 1);
  const jr = poner(e, 0, "cementerio", "Juramento");
  poner(e, 1, "castillo", "Valefor");
  e = hacer(e, habilidad(jr, "Juramento"), nombreDe(e, "Drácula"));
  assert.equal(opcionesDe(e).some(nombreDe(e, "Drácula")), false);
  e = elegir(e, nombreDe(e, "Valefor"));
  assert.equal(zonaDe(e, jr), "destierro");
  assert.deepEqual(e.jugadores[1].destierro.map((u) => N.carta(e, u).nombre).sort(), ["Drácula", "Valefor"]);
  assert.equal(e.jugadores[0].reserva.length, 0);
});

test("Kaiju de Luz: Baraja cartas de la mano, Roba esa cantidad más una y el oponente Bota una por cada tipo distinto mostrado", () => {
  let e = mesa();
  oros(e, 0, 1);
  const v = poner(e, 0, "mano", "Valefor");
  const onsen = poner(e, 0, "mano", "Onsen");
  const manada = poner(e, 0, "mano", "Llamar a la Manada");
  const kaiju = poner(e, 0, "mano", "Kaiju de Luz");
  e = hacer(e, jugar(kaiju), v, null);
  assert.equal(zonaDe(e, v), "castillo");
  assert.equal(e.jugadores[0].mano.length, 4);
  e = elegir(e, onsen);
  e = elegir(e, manada);
  e = elegir(e, nombreDe(e, "Drácula"));
  e = elegir(e, null);
  assert.equal(e.jugadores[1].cementerio.length, 2);
  assert.equal(e.jugadores[1].castillo.length, 28);
});

test("La Hora del Diablo: busca dos cartas en cada Castillo para el Cementerio de su dueño, Roba una y se Destierra", () => {
  let e = mesa();
  oros(e, 0, 1);
  const v = poner(e, 0, "castillo", "Valefor");
  const hora = poner(e, 0, "mano", "La Hora del Diablo");
  e = hacer(e, jugar(hora), v, nombreDe(e, "Drácula"), nombreDe(e, "Drácula"), nombreDe(e, "Drácula"));
  assert.equal(zonaDe(e, v), "cementerio");
  assert.equal(e.jugadores[0].cementerio.length, 2);
  assert.equal(e.jugadores[1].cementerio.length, 2);
  assert.equal(e.jugadores[0].mano.length, 1);
  assert.equal(zonaDe(e, hora), "destierro");
  assert.equal(e.pendiente, null);
});

test("La Hora del Diablo: pagando tres Oros y Barajando tres copias de tu Destierro Destierra hasta tres cartas oponentes de distinto tipo", () => {
  let e = mesa();
  oros(e, 0, 4);
  const copias = [1, 2, 3].map(() => poner(e, 0, "destierro", "La Hora del Diablo"));
  const v = poner(e, 1, "defensa", "Valefor");
  const otro = ficticia(e, 1, "defensa", { coste: 2 });
  const t = ficticia(e, 1, "apoyo", { tipo: "Tótem", coste: 2 });
  const o = poner(e, 1, "reserva", "Drácula");
  const hora = poner(e, 0, "mano", "La Hora del Diablo");
  const d = nombreDe(e, "Drácula");
  e = hacer(e, jugar(hora), d, d, d, d, true, v);
  assert.equal(opcionesDe(e).includes(otro), false);
  e = elegir(e, t);
  e = elegir(e, o);
  for (const u of [v, t, o]) assert.equal(zonaDe(e, u), "destierro");
  assert.equal(zonaDe(e, otro), "defensa");
  for (const u of copias) assert.equal(zonaDe(e, u), "castillo");
  assert.equal(e.jugadores[0].reserva.length, 0);
});

test("La Ira de Dios: el oponente Destierra una carta de su mano y la Ira se Baraja en tu Castillo al resolverse", () => {
  let e = mesa();
  oros(e, 0, 1);
  poner(e, 1, "mano", "Valefor");
  const onsen = poner(e, 1, "mano", "Onsen");
  const ira = poner(e, 0, "mano", "La Ira de Dios");
  e = aplicar(e, jugar(ira));
  assert.equal(e.pendiente.jugador, 1);
  e = elegir(e, onsen);
  assert.equal(zonaDe(e, onsen), "destierro");
  assert.equal(zonaDe(e, ira), "castillo");
  assert.equal(e.jugadores[0].castillo.length, 31);
});

test("La Ira de Dios: si llega al Cementerio por otra vía no se Baraja", () => {
  const e = mesa();
  const ira = poner(e, 0, "mano", "La Ira de Dios");
  N.mover(e, ira, "cementerio");
  resolver(e);
  assert.equal(zonaDe(e, ira), "cementerio");
});

test("La Ira de Dios: redirige un efecto a otro objetivo válido del mismo controlador", { todo: "respuesta: redirigir un efecto a otro objetivo válido" }, () => {});

test("La Ira de Dios: al Botarla puedes Desterrarla para subir un Aliado de tu Cementerio a tu mano", () => {
  let e = mesa();
  const v = poner(e, 0, "cementerio", "Valefor");
  const ira = poner(e, 0, "castillo", "La Ira de Dios");
  N.sacar(e, ira);
  e.jugadores[0].castillo.unshift(ira);
  N.quitarDelCastillo(e, 0, 1, "cementerio");
  resolver(e);
  e = elegir(e, true);
  assert.equal(zonaDe(e, ira), "destierro");
  assert.equal(zonaDe(e, v), "mano");
});

test("La Ira de Dios: si sale del Castillo por daño no se dispara", () => {
  const e = mesa();
  poner(e, 0, "cementerio", "Valefor");
  const ira = poner(e, 0, "castillo", "La Ira de Dios");
  N.sacar(e, ira);
  e.jugadores[0].castillo.unshift(ira);
  N.quitarDelCastillo(e, 0, 1, "cementerio", false, true);
  resolver(e);
  assert.equal(e.pendiente, null);
  assert.equal(zonaDe(e, ira), "cementerio");
});

test("La Sentencia de los Dioses: se resuelve y va al Cementerio", () => {
  let e = mesa();
  oros(e, 0, 1);
  const s = poner(e, 0, "mano", "La Sentencia de los Dioses");
  e = sinRespuesta(aplicar(e, jugar(s)));
  assert.equal(zonaDe(e, s), "cementerio");
  assert.equal(e.pendiente, null);
});

test("La Sentencia de los Dioses: se puede jugar al comienzo de la Vigilia oponente sin perder la Vigilia normal", () => {
  let e = mesa();
  oros(e, 0, 2);
  const s = poner(e, 0, "mano", "La Sentencia de los Dioses");
  assert.equal(puedeJugar(e, s), true);
  e = aplicar(e, { tipo: "terminar" });
  for (let i = 0; i < 60 && e.fase !== "momento"; i++) {
    const l = accionesLegales(e);
    e = aplicar(e, l.find((x) => ["terminar", "pasarMomento", "noResponder", "pasar"].includes(x.tipo)) ?? l[0]);
  }
  assert.equal(e.fase, "momento");
  assert.equal(e.activo, 1);
  let ofrecida = false;
  for (let i = 0; i < 3 && e.fase === "momento" && !ofrecida; i++) {
    ofrecida = puedeJugar(e, s);
    if (!ofrecida) e = aplicar(e, { tipo: "pasarMomento" });
  }
  assert.equal(ofrecida, true);
});

function sentenciada() {
  let e = mesa();
  oros(e, 0, 1);
  const s = poner(e, 0, "mano", "La Sentencia de los Dioses");
  e = sinRespuesta(aplicar(e, jugar(s)));
  return e;
}

test("La Sentencia de los Dioses: hasta tu próximo turno no se juegan cartas reduciendo su coste ni sin pagarlo", () => {
  const e = sentenciada();
  for (const j of [0, 1]) {
    assert.equal(e.efectos.some((f) => f.tipo === "noReducir" && f.j === undefined && f.fin.inicioDe === 0), true);
    const v = poner(e, j, "mano", "Valefor");
    OPS.jugarGratis(e, { var: "x" }, { pasos: [], i: 0, ctx: { ctrl: j, vars: { x: [v] } } });
    assert.equal(zonaDe(e, v), "mano");
  }
});

test("La Sentencia de los Dioses: hasta tu próximo turno no se pueden generar Oros", () => {
  const e = sentenciada();
  for (const j of [0, 1]) OPS.generar(e, { n: 1 }, { ctx: { ctrl: j, vars: {} } });
  assert.equal(disponibles(e, 0, "Aliado"), 0);
  assert.equal(disponibles(e, 1, "Aliado"), 0);
});

test("La Sentencia de los Dioses: utilizar habilidades fuera del juego cuesta un Oro adicional", () => {
  const e = sentenciada();
  const fuera = poner(e, 1, "cementerio", "Lujuria");
  const dentro = poner(e, 1, "defensa", "Valefor");
  assert.equal(N.impuestoHabilidad(e, 1, fuera, "activada"), 1);
  assert.equal(N.impuestoHabilidad(e, 0, fuera, "activada"), 1);
  assert.equal(N.impuestoHabilidad(e, 1, dentro, "activada"), 0);
});

test("Legion Celestial: sin las Razas no tiene efecto", () => {
  let e = mesa();
  oros(e, 0, 1);
  poner(e, 0, "defensa", "Valefor");
  const l = poner(e, 0, "mano", "Legion Celestial");
  e = aplicar(e, jugar(l));
  assert.equal(e.pendiente, null);
  assert.equal(zonaDe(e, l), "cementerio");
});

test("Legion Celestial: con un Eterno genera un Oro para jugar Tótem", () => {
  let e = mesa();
  oros(e, 0, 1);
  ficticia(e, 0, "defensa", { razas: ["Eterno"] });
  const l = poner(e, 0, "mano", "Legion Celestial");
  e = hacer(e, jugar(l), texto("Eterno"));
  assert.deepEqual(e.jugadores[0].generados, [{ n: 1, tipos: ["Tótem"] }]);
});

test("Legion Celestial: con un Faerie hasta dos Aliados pierden 3 de Fuerza", () => {
  let e = mesa();
  oros(e, 0, 1);
  ficticia(e, 0, "defensa", { razas: ["Faerie"] });
  const v = poner(e, 1, "defensa", "Valefor");
  const l = poner(e, 0, "mano", "Legion Celestial");
  e = hacer(e, jugar(l), texto("Faerie"), v, null);
  assert.equal(N.fuerza(e, v), 0);
});

test("Legion Celestial: con un Sacerdote Baraja y/o Destierra hasta seis cartas de los Cementerios", () => {
  let e = mesa();
  oros(e, 0, 1);
  ficticia(e, 0, "defensa", { razas: ["Sacerdote"] });
  const c = [0, 1, 1].map((j) => poner(e, j, "cementerio", "Valefor"));
  const l = poner(e, 0, "mano", "Legion Celestial");
  e = hacer(e, jugar(l), texto("Sacerdote"), c[0], c[1], null, c[2]);
  assert.deepEqual(c.map((u) => zonaDe(e, u)), ["castillo", "castillo", "destierro"]);
});

test("Legion Demoniaca: con una Bestia tus Aliados ganan Furia e Indestructible por el turno", () => {
  let e = mesa();
  oros(e, 0, 1);
  const b = ficticia(e, 0, "defensa", { razas: ["Bestia"] });
  const rv = ficticia(e, 1, "defensa");
  const l = poner(e, 0, "mano", "Legion Demoniaca");
  e = hacer(e, jugar(l), texto("Bestia"));
  assert.equal(N.tiene(e, b, "Furia"), true);
  assert.equal(N.tiene(e, b, "Indestructible"), true);
  assert.equal(N.tiene(e, rv, "Indestructible"), false);
});

test("Legion Demoniaca: con un Dragón genera un Oro para jugar Aliados", () => {
  let e = mesa();
  oros(e, 0, 1);
  poner(e, 0, "defensa", "Valefor");
  const l = poner(e, 0, "mano", "Legion Demoniaca");
  e = hacer(e, jugar(l), texto("Dragón"));
  assert.deepEqual(e.jugadores[0].generados, [{ n: 1, tipos: ["Aliado"], costeMin: 3 }]);
});

test("Legion Demoniaca: el Oro generado solo sirve para Aliados de coste 3 o más", () => {
  let e = mesa();
  oros(e, 0, 1);
  poner(e, 0, "defensa", "Valefor");
  const l = poner(e, 0, "mano", "Legion Demoniaca");
  e = hacer(e, jugar(l), texto("Dragón"));
  assert.equal(disponibles(e, 0, { tipo: "Aliado", coste: 2, razas: [] }), 0);
  assert.equal(disponibles(e, 0, { tipo: "Aliado", coste: 3, razas: [] }), 1);
  assert.equal(disponibles(e, 0, { tipo: "Tótem", coste: 3, razas: [] }), 0);
});

test("Legion Demoniaca: con una Sombra busca tres cartas de distinto nombre en el Castillo oponente y las Destierra", () => {
  let e = mesa();
  oros(e, 0, 1);
  ficticia(e, 0, "defensa", { razas: ["Sombra"] });
  poner(e, 1, "castillo", "Valefor");
  poner(e, 1, "castillo", "Onsen");
  const l = poner(e, 0, "mano", "Legion Demoniaca");
  e = hacer(e, jugar(l), texto("Sombra"), nombreDe(e, "Drácula"), nombreDe(e, "Valefor"), nombreDe(e, "Onsen"));
  assert.deepEqual(e.jugadores[1].destierro.map((u) => N.carta(e, u).nombre).sort(), ["Drácula", "Onsen", "Valefor"]);
});

test("Levantar Zombie: al jugarlo se Destierra", () => {
  let e = mesa();
  oros(e, 0, 1);
  const z = poner(e, 0, "mano", "Levantar Zombie");
  e = sinRespuesta(aplicar(e, jugar(z)));
  assert.equal(zonaDe(e, z), "destierro");
});

test("Levantar Zombie: Desterrándolo del Cementerio Baraja hasta tres cartas de los Cementerios", () => {
  let e = mesa();
  const z = poner(e, 0, "cementerio", "Levantar Zombie");
  const c = [0, 1, 1, 1].map((j) => poner(e, j, "cementerio", "Valefor"));
  e = hacer(e, habilidad(z, "Levantar Zombie"), c[0], c[1], c[2]);
  assert.equal(zonaDe(e, z), "destierro");
  assert.deepEqual(c.map((u) => zonaDe(e, u)), ["castillo", "castillo", "castillo", "cementerio"]);
});

test("Levantar Zombie: al recibir daño oponente el oponente Bota esa cantidad y pones en juego un Aliado de un Cementerio sin habilidad", () => {
  let e = mesa();
  oros(e, 0, 1);
  const z = poner(e, 0, "mano", "Levantar Zombie");
  e = sinRespuesta(aplicar(e, jugar(z)));
  assert.equal(zonaDe(e, z), "destierro");
  const v = poner(e, 1, "cementerio", "Valefor");
  N.quitarDelCastillo(e, 0, 1, "cementerio");
  resolver(e);
  assert.equal(e.pendiente, null);
  assert.equal(e.jugadores[1].cementerio.length, 1);
  N.quitarDelCastillo(e, 0, 2, "cementerio", false, true);
  resolver(e);
  assert.equal(e.jugadores[1].castillo.length, 28);
  assert.equal(zonaDe(e, v), "defensa");
  assert.equal(N.controlador(e, v), 0);
  assert.equal(N.activa(e, v), false);
  e.turno += 1;
  e.activo = 1;
  N.expirar(e, "inicio");
  e.turno += 1;
  e.activo = 0;
  N.expirar(e, "inicio");
  const antes = e.jugadores[1].castillo.length;
  N.quitarDelCastillo(e, 0, 1, "cementerio", false, true);
  resolver(e);
  assert.equal(e.jugadores[1].castillo.length, antes);
});

test("Libro de Enoc: al jugarlo Roba una carta", () => {
  let e = mesa();
  const l = poner(e, 0, "mano", "Libro de Enoc");
  e = sinRespuesta(aplicar(e, jugar(l)));
  assert.equal(e.jugadores[0].mano.length, 1);
});

test("Libro de Enoc: en tu Oro Pagado tus Aliados ganan 1 de Fuerza e Indestructible", () => {
  const e = mesa();
  const v = poner(e, 0, "defensa", "Valefor");
  const rv = poner(e, 1, "defensa", "Valefor");
  const l = poner(e, 0, "reserva", "Libro de Enoc");
  assert.equal(N.fuerza(e, v), 3);
  assert.equal(N.tiene(e, v, "Indestructible"), false);
  N.sacar(e, l);
  e.jugadores[0].pagado.push(l);
  assert.equal(N.fuerza(e, v), 4);
  assert.equal(N.tiene(e, v, "Indestructible"), true);
  assert.equal(N.fuerza(e, rv), 3);
  assert.equal(N.tiene(e, rv, "Indestructible"), false);
});

test("Libro de Enoc: en tu Reserva no se juegan cartas ni habilidades desde Cementerio o Destierro sin Barajar una carta de la mano", { todo: "restricción: jugar cartas o usar habilidades desde el Cementerio o Destierro exige Barajar una carta de la mano" }, () => {});

test("Linaje Maldito: con resultado par el oponente Destierra cuatro del tope y no puedes recibir daño de combate hasta tu próximo turno", () => {
  let e = mesa();
  oros(e, 0, 1);
  const l = poner(e, 0, "mano", "Linaje Maldito");
  e.azar = semillaDado(true);
  e = aplicar(e, jugar(l));
  assert.equal(e.jugadores[1].destierro.length, 4);
  assert.equal(e.efectos.some((f) => f.tipo === "prevenirDano" && f.j === 0 && !f.unaVez && f.fin.inicioDe === 0), true);
});

test("Linaje Maldito: con resultado impar hasta dos Aliados ganan 2 de Fuerza y Furia", () => {
  let e = mesa();
  oros(e, 0, 1);
  const a = ficticia(e, 0, "defensa");
  const b = ficticia(e, 0, "defensa");
  const l = poner(e, 0, "mano", "Linaje Maldito");
  e.azar = semillaDado(false);
  e = hacer(e, jugar(l), a, b);
  for (const u of [a, b]) {
    assert.equal(N.fuerza(e, u), 4);
    assert.equal(N.tiene(e, u, "Furia"), true);
  }
  assert.equal(e.jugadores[1].destierro.length, 0);
});

test("Linaje Maldito: con resultado par no recibes daño de combate de Aliados que entren después", () => {
  let e = mesa();
  oros(e, 0, 1);
  const l = poner(e, 0, "mano", "Linaje Maldito");
  e.azar = semillaDado(true);
  e = aplicar(e, jugar(l));
  e = aplicar(e, { tipo: "terminar" });
  for (let i = 0; i < 60 && !(e.activo === 1 && e.fase === "vigilia"); i++) {
    const lg = accionesLegales(e);
    e = aplicar(e, lg.find((x) => ["terminar", "pasarMomento", "noResponder", "pasar"].includes(x.tipo)) ?? lg[0]);
  }
  const rv = poner(e, 1, "defensa", "Valefor");
  const castillo = e.jugadores[0].castillo.length;
  e = aplicar(e, { tipo: "batalla" });
  e = aplicar(e, { tipo: "atacar", uid: rv });
  e = aplicar(e, { tipo: "finAtaque" });
  const antes = e.registro.length;
  for (let i = 0; i < 30 && e.registro.length === antes; i++) {
    const lg = accionesLegales(e);
    e = aplicar(e, lg.find((x) => ["finBloqueo", "pasar", "noResponder", "pasarMomento"].includes(x.tipo)) ?? lg[0]);
  }
  assert.equal(e.registro.length, antes + 1);
  assert.equal(e.jugadores[0].castillo.length, castillo);
});

test("Linaje Maldito: con resultado impar no recibes daño directo hasta tu próximo turno", { todo: "efecto: un jugador no recibe daño directo durante un período" }, () => {});

test("Locura de Renfield: mira tres cartas del Castillo oponente y las pone en la mano de su dueño", () => {
  let e = mesa();
  oros(e, 0, 1);
  const l = poner(e, 0, "mano", "Locura de Renfield");
  e = hacer(e, jugar(l), "Castillo oponente", texto("A la mano"));
  assert.equal(e.jugadores[1].mano.length, 3);
  assert.equal(e.jugadores[1].castillo.length, 27);
});

test("Locura de Renfield: mira tres cartas de tu Castillo y las pone en tu Destierro", () => {
  let e = mesa();
  oros(e, 0, 1);
  const l = poner(e, 0, "mano", "Locura de Renfield");
  e = hacer(e, jugar(l), "tu Castillo", texto("Al Destierro"));
  assert.equal(e.jugadores[0].destierro.length, 3);
});

test("Locura de Renfield: si el oponente puso más de un Oro, pagando un Oro y Desterrándola del Cementerio Baraja un Oro oponente", () => {
  let e = mesa();
  oros(e, 0, 1);
  const l = poner(e, 0, "cementerio", "Locura de Renfield");
  const o = poner(e, 1, "reserva", "Drácula");
  assert.equal(puedeUsar(e, l), false);
  e.jugadores[1].orosPuestos = 2;
  e = hacer(e, habilidad(l, "Locura de Renfield"));
  assert.equal(zonaDe(e, o), "castillo");
  assert.equal(zonaDe(e, l), "destierro");
  assert.equal(e.jugadores[0].reserva.length, 0);
});

test("Locura de Renfield: la condición mira el último turno del oponente", { todo: "historial: Oros puestos en juego por el oponente en su último turno" }, () => {});

test("Los Descarnados: sube un Aliado oponente de coste 3 o menos a la mano de su dueño", () => {
  let e = mesa();
  oros(e, 0, 1);
  const v = poner(e, 1, "defensa", "Valefor");
  const d = poner(e, 0, "mano", "Los Descarnados");
  e = hacer(e, jugar(d));
  assert.equal(zonaDe(e, v), "mano");
  assert.equal(e.jugadores[1].mano.includes(v), true);
});

test("Los Descarnados: sin Aliados oponentes de coste 3 o menos no se puede jugar", () => {
  const e = mesa();
  oros(e, 0, 1);
  ficticia(e, 1, "defensa", { coste: 4 });
  const d = poner(e, 0, "mano", "Los Descarnados");
  assert.equal(puedeJugar(e, d), false);
});

test("Los Descarnados: desde tu mano puedes ponerla al fondo de tu Castillo para Robar una carta", () => {
  let e = mesa();
  const d = poner(e, 0, "mano", "Los Descarnados");
  e = aplicar(e, habilidad(d, "Los Descarnados"));
  assert.equal(e.jugadores[0].castillo.at(-1), d);
  assert.equal(e.jugadores[0].mano.length, 1);
  assert.equal(zonaDe(e, d), "castillo");
});

test("Los Olvidados: convierte una carta oponente de coste 2 o menos en Tótem y se convierte en un Tótem sin habilidad en tu Línea de Apoyo", () => {
  let e = mesa();
  oros(e, 0, 1);
  const v = poner(e, 1, "defensa", "Valefor");
  const lo = poner(e, 0, "mano", "Los Olvidados");
  e = hacer(e, jugar(lo));
  assert.equal(zonaDe(e, v), "apoyo");
  assert.equal(N.controlador(e, v), 1);
  assert.equal(N.carta(e, v).tipo, "Tótem");
  assert.equal(zonaDe(e, lo), "apoyo");
  assert.equal(N.controlador(e, lo), 0);
  assert.equal(N.carta(e, lo).tipo, "Tótem");
  assert.equal(N.carta(e, lo).sinHabilidad, true);
});

test("Los Olvidados: el Tótem convertido hace que Robes una carta al comienzo de la Vigilia de su controlador", () => {
  let e = mesa();
  oros(e, 0, 1);
  poner(e, 1, "defensa", "Valefor");
  const lo = poner(e, 0, "mano", "Los Olvidados");
  e = hacer(e, jugar(lo));
  e = disparar(e, "comienzoVigilia", { j: 0 });
  assert.equal(e.jugadores[0].mano.length, 0);
  assert.equal(e.jugadores[1].mano.length, 0);
  e = disparar(e, "comienzoVigilia", { j: 1 });
  assert.equal(e.jugadores[0].mano.length, 1);
  assert.equal(e.jugadores[1].mano.length, 0);
});

test("Los Pincheira: no puede ser Anulado", () => {
  const e = mesa();
  const p = poner(e, 0, "mano", "Los Pincheira");
  assert.equal(N.carta(e, p).claves.includes("NoAnulable"), true);
});

test("Los Pincheira: Destierra un Aliado de coste 1 o menos o Fuerza 2 o menos y Roba tantas cartas como su coste", () => {
  let e = mesa();
  oros(e, 0, 1);
  const debil = ficticia(e, 1, "defensa", { coste: 3, fuerza: 2 });
  const v = poner(e, 1, "defensa", "Valefor");
  const fuerte = ficticia(e, 1, "defensa", { coste: 3, fuerza: 4 });
  const p = poner(e, 0, "mano", "Los Pincheira");
  e = aplicar(e, jugar(p));
  assert.deepEqual(opcionesDe(e).sort(), [debil, v].sort());
  assert.equal(opcionesDe(e).includes(fuerte), false);
  e = elegir(e, debil);
  assert.equal(zonaDe(e, debil), "destierro");
  assert.equal(e.jugadores[0].mano.length, 3);
});

test("Los Pincheira: se puede jugar al comienzo de cualquier Fase", () => {
  let e = mesa();
  oros(e, 1, 1);
  const p = poner(e, 1, "mano", "Los Pincheira");
  poner(e, 0, "defensa", "Valefor");
  e = aplicar(e, { tipo: "batalla" });
  assert.equal(e.fase, "momento");
  let ofrecida = false;
  for (let i = 0; i < 3 && e.fase === "momento" && !ofrecida; i++) {
    ofrecida = puedeJugar(e, p);
    if (!ofrecida) e = aplicar(e, { tipo: "pasarMomento" });
  }
  assert.equal(ofrecida, true);
});

test("Lucerna: si no tienes Oros en la mano busca un Oro y lo pone en tu Reserva", () => {
  let e = mesa();
  oros(e, 0, 1);
  const l = poner(e, 0, "mano", "Lucerna");
  poner(e, 0, "mano", "Valefor");
  e = hacer(e, jugar(l), nombreDe(e, "Drácula"));
  assert.equal(e.jugadores[0].reserva.length, 1);
  assert.equal(e.jugadores[0].castillo.length, 29);
});

test("Lucerna: si tienes un Oro en la mano no busca", () => {
  let e = mesa();
  oros(e, 0, 1);
  const l = poner(e, 0, "mano", "Lucerna");
  poner(e, 0, "mano", "Onsen");
  e = aplicar(e, jugar(l));
  assert.equal(e.pendiente, null);
  assert.equal(e.jugadores[0].reserva.length, 0);
});

test("Lucha Celestial: convierte hasta dos cartas que controles en Tótem Indesterrable", () => {
  let e = mesa();
  oros(e, 0, 2);
  const a = poner(e, 0, "defensa", "Valefor");
  const b = poner(e, 0, "defensa", "Valefor");
  const lc = poner(e, 0, "mano", "Lucha Celestial");
  e = hacer(e, jugar(lc), a, b);
  for (const u of [a, b]) {
    assert.equal(zonaDe(e, u), "apoyo");
    assert.equal(N.carta(e, u).tipo, "Tótem");
    assert.equal(N.tiene(e, u, "Indesterrable"), true);
    assert.equal(N.tiene(e, u, "Furia"), false);
  }
});

test("Lucha Celestial: el Tótem una vez por turno Baraja una carta de tu Cementerio por cada Tótem y el oponente Bota una", () => {
  let e = mesa();
  oros(e, 0, 2);
  const a = poner(e, 0, "defensa", "Valefor");
  const b = poner(e, 0, "defensa", "Valefor");
  const lc = poner(e, 0, "mano", "Lucha Celestial");
  e = hacer(e, jugar(lc), a, b);
  const c1 = poner(e, 0, "cementerio", "Onsen");
  const c2 = poner(e, 0, "cementerio", "Onsen");
  e = hacer(e, habilidad(a, "Lucha Celestial"), c1, c2);
  assert.equal(zonaDe(e, c1), "castillo");
  assert.equal(zonaDe(e, c2), "castillo");
  assert.equal(zonaDe(e, lc), "cementerio");
  assert.equal(e.jugadores[1].cementerio.length, 1);
  assert.equal(puedeUsar(e, a), false);
});

test("Lucha Celestial: en tu Cementerio con dos o más Tótem los Aliados pierden 1 de Fuerza", () => {
  const e = mesa();
  const v = poner(e, 0, "defensa", "Valefor");
  const rv = poner(e, 1, "defensa", "Valefor");
  poner(e, 0, "cementerio", "Lucha Celestial");
  ficticia(e, 0, "apoyo", { tipo: "Tótem", coste: 2 });
  assert.equal(N.fuerza(e, v), 3);
  ficticia(e, 0, "apoyo", { tipo: "Tótem", coste: 2 });
  assert.equal(N.fuerza(e, v), 2);
  assert.equal(N.fuerza(e, rv), 2);
});

test("Lucha de Saurios: tiene Exhumar y se Destierra al jugarla", () => {
  let e = mesa();
  oros(e, 0, 1);
  const s = poner(e, 0, "mano", "Lucha de Saurios");
  assert.equal(N.tiene(e, s, "Exhumar"), true);
  e = hacer(e, jugar(s), false);
  assert.equal(zonaDe(e, s), "destierro");
});

test("Lucha de Saurios: puedes buscar un Dinosaurio y Barajar una carta oponente de coste 2 o menos", () => {
  let e = mesa();
  oros(e, 0, 1);
  const dino = ficticia(e, 0, "castillo", { razas: ["Dinosaurio"] });
  const rv = poner(e, 1, "defensa", "Valefor");
  ficticia(e, 1, "defensa", { coste: 3 });
  const s = poner(e, 0, "mano", "Lucha de Saurios");
  e = hacer(e, jugar(s), true, dino);
  assert.equal(zonaDe(e, dino), "mano");
  assert.equal(zonaDe(e, rv), "castillo");
});

test("Lucha de Saurios: la primera carta con ese nombre que Bote el oponente se puede jugar sin pagar su coste", { todo: "efecto: la primera carta con un nombre que Bote el oponente este turno se puede jugar sin pagar su coste" }, () => {});

test("Lujuria: busca dos Aliados en tu Castillo y los pone en tu mano", () => {
  let e = mesa();
  oros(e, 0, 1);
  const v1 = poner(e, 0, "castillo", "Valefor");
  const v2 = poner(e, 0, "castillo", "Valefor");
  const l = poner(e, 0, "mano", "Lujuria");
  e = hacer(e, jugar(l), nombreDe(e, "Valefor"), nombreDe(e, "Valefor"));
  assert.equal(zonaDe(e, v1), "mano");
  assert.equal(zonaDe(e, v2), "mano");
});

test("Lujuria: Desterrándola del Cementerio Baraja hasta tres cartas de los Cementerios", () => {
  let e = mesa();
  const l = poner(e, 0, "cementerio", "Lujuria");
  const c = poner(e, 1, "cementerio", "Valefor");
  e = hacer(e, habilidad(l, "Lujuria"), c);
  assert.equal(zonaDe(e, l), "destierro");
  assert.equal(zonaDe(e, c), "castillo");
});

test("Lujuria: hasta tu próximo turno no tienes límite de mano", () => {
  let e = mesa();
  oros(e, 0, 1);
  poner(e, 0, "castillo", "Valefor");
  poner(e, 0, "castillo", "Valefor");
  const l = poner(e, 0, "mano", "Lujuria");
  e = hacer(e, jugar(l), nombreDe(e, "Valefor"), nombreDe(e, "Valefor"));
  assert.equal(e.efectos.some((f) => f.tipo === "sinLimiteMano" && f.j === 0 && f.fin.inicioDe === 0), true);
  for (let i = 0; i < 8; i++) poner(e, 0, "mano", "Onsen");
  const mano = e.jugadores[0].mano.length;
  e = aplicar(e, { tipo: "terminar" });
  assert.equal(e.activo, 1);
  assert.ok(e.jugadores[0].mano.length >= mano);
});

test("Lujuria: no puedes ser afectado por efectos oponentes este turno", { todo: "protección: el jugador no puede ser afectado por efectos oponentes" }, () => {});

test("Luz Desafiante: juega un Aliado de tu Cementerio reduciendo su coste en un Oro y Destierra Aliados de las Razas indicadas con costes que sumen hasta 3", () => {
  let e = mesa();
  oros(e, 0, 4);
  const h = ficticia(e, 0, "cementerio", { coste: 3, razas: ["Héroe"] });
  const v = poner(e, 1, "defensa", "Valefor");
  const bestia = ficticia(e, 1, "defensa", { coste: 2, razas: ["Bestia"] });
  const sombra = ficticia(e, 1, "defensa", { coste: 2, razas: ["Sombra"] });
  const luz = poner(e, 0, "mano", "Luz Desafiante");
  e = hacer(e, jugar(luz), v, bestia);
  assert.equal(zonaDe(e, h), "defensa");
  assert.equal(e.jugadores[0].reserva.length, 0);
  assert.equal(zonaDe(e, v), "destierro");
  assert.equal(zonaDe(e, bestia), "destierro");
  assert.equal(zonaDe(e, sombra), "defensa");
});

test("Luz Desafiante: un Tenshi reduce su coste en dos Oros", () => {
  let e = mesa();
  oros(e, 0, 3);
  const t = ficticia(e, 0, "cementerio", { coste: 3, razas: ["Tenshi"] });
  const luz = poner(e, 0, "mano", "Luz Desafiante");
  e = hacer(e, jugar(luz));
  assert.equal(zonaDe(e, t), "defensa");
  assert.equal(e.jugadores[0].reserva.length, 0);
});

test("Luz Desafiante: el coste reducido no baja de 1", () => {
  let e = mesa();
  oros(e, 0, 2);
  const v = poner(e, 0, "cementerio", "Valefor");
  const luz = poner(e, 0, "mano", "Luz Desafiante");
  e = hacer(e, jugar(luz));
  assert.equal(zonaDe(e, v), "cementerio");
});

test("Magia de Serpientes: tiene Exhumar", () => {
  const e = mesa();
  const m = poner(e, 0, "mano", "Magia de Serpientes");
  assert.equal(N.tiene(e, m, "Exhumar"), true);
});

test("Magia de Serpientes: convierte un Aliado de coste 2 o menos en un Aliado sin habilidad de Fuerza 0 y Destierra dos del tope de un Castillo", () => {
  let e = mesa();
  oros(e, 0, 2);
  const v = poner(e, 1, "defensa", "Valefor");
  const m = poner(e, 0, "mano", "Magia de Serpientes");
  e = hacer(e, jugar(m), "Castillo oponente");
  assert.equal(N.fuerza(e, v), 0);
  assert.equal(N.tiene(e, v, "Furia"), false);
  assert.equal(N.carta(e, v).tipo, "Aliado");
  assert.equal(N.controlador(e, v), 1);
  assert.equal(e.jugadores[1].destierro.length, 2);
});

test("Magia de Serpientes: Destruir una carta que controles reduce su coste en un Oro", { todo: "coste alternativo: Destruir o Descartar una carta para reducir el coste" }, () => {});

test("Mala Flecha: mira la mano oponente, Descarta una carta de coste 1 o menos y se Destierra", () => {
  let e = mesa();
  oros(e, 0, 1);
  const v = poner(e, 1, "mano", "Valefor");
  const caro = ficticia(e, 1, "mano", { coste: 3 });
  const mf = poner(e, 0, "mano", "Mala Flecha");
  e = sinRespuesta(aplicar(e, jugar(mf)));
  assert.equal(zonaDe(e, v), "cementerio");
  assert.equal(zonaDe(e, caro), "mano");
  assert.equal(zonaDe(e, mf), "destierro");
});

test("Mala Flecha: Anula una carta de coste 1 o menos", () => {
  let e = mesa();
  oros(e, 0, 1);
  oros(e, 1, 1);
  const v = poner(e, 0, "mano", "Valefor");
  const mf = poner(e, 1, "mano", "Mala Flecha");
  e = aplicar(e, jugar(v));
  e = aplicar(e, { tipo: "responder", uid: mf });
  assert.equal(zonaDe(e, v), "cementerio");
  assert.equal(zonaDe(e, mf), "destierro");
});

test("Maldicion en la Tormenta: requiere Barajar otra carta de tu mano", () => {
  let e = mesa();
  oros(e, 0, 1);
  const m = poner(e, 0, "mano", "Maldicion en la Tormenta");
  assert.equal(puedeJugar(e, m), false);
  const v = poner(e, 0, "mano", "Valefor");
  e = aplicar(e, jugar(m));
  assert.equal(zonaDe(e, v), "castillo");
  assert.equal(zonaDe(e, m), "cementerio");
});

test("Maldicion en la Tormenta: cancela una habilidad", { todo: "respuesta: cancelar una habilidad" }, () => {});
