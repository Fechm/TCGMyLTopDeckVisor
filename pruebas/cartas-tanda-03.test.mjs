import { test } from "node:test";
import assert from "node:assert/strict";
import { mesa, poner, oros, hacer, elegir, sinRespuesta, accionesLegales, aplicar, zonaDe, id, N, CATALOGO } from "./ayuda-duelo.mjs";
import { resolver } from "../web/duelo/efectos.js";

const arriba = (e, j, nombre) => {
  const uid = poner(e, j, "castillo", nombre);
  const castillo = e.jugadores[j].castillo;
  castillo.splice(castillo.indexOf(uid), 1);
  castillo.unshift(uid);
  return uid;
};

const rechazar = (e) => {
  while (e.pendiente) {
    const ops = e.pendiente.opciones;
    const i = ops.findIndex((o) => o.valor === false);
    e = aplicar(e, { tipo: "elegir", i: i >= 0 ? i : ops.length - 1 });
  }
  return e;
};

const hab = (uid, nombre, h) => ({ tipo: "habilidad", uid, def: id(nombre), h });
const puedeJugar = (e, uid) => accionesLegales(e).some((a) => a.tipo === "jugar" && a.uid === uid);
const puedeHab = (e, uid, nombre, h) => accionesLegales(e).some((a) => a.tipo === "habilidad" && a.uid === uid && a.def === id(nombre) && a.h === h);

function ejecutar(e, ctx, pasos) {
  e.cola.push(N.nuevoFrame(pasos, ctx));
  resolver(e);
  return e;
}

const efectoDe = (e, fuente, uid, a = "desterrar") => ejecutar(e, { ctrl: 0, fuente, def: id("Pricolici"), vars: { x: [uid] } }, [{ op: "mover", var: "x", a }]);

function combate(e, ...uids) {
  e = aplicar(e, { tipo: "batalla" });
  for (const u of uids) e = aplicar(e, { tipo: "atacar", uid: u });
  e = aplicar(e, { tipo: "finAtaque" });
  e = aplicar(e, { tipo: "finBloqueo" });
  e = aplicar(e, { tipo: "pasar" });
  return aplicar(e, { tipo: "pasar" });
}

test("Perugia: al entrar, ambos jugadores solo pueden jugar una carta de cada tipo durante este turno y el siguiente", () => {
  let e = mesa();
  oros(e, 0, 10);
  const p1 = poner(e, 0, "mano", "Perugia");
  const p2 = poner(e, 0, "mano", "Perugia");
  const a1 = poner(e, 0, "mano", "Pricolici");
  const a2 = poner(e, 0, "mano", "Urias");
  e = sinRespuesta(hacer(e, { tipo: "jugar", uid: p1 }));
  assert.equal(zonaDe(e, p1), "apoyo");
  assert.ok(e.efectos.some((f) => f.tipo === "unaPorTipo" && f.j === undefined && f.fin.finTurno === e.turno + 1));
  assert.equal(puedeJugar(e, p2), false);
  assert.equal(puedeJugar(e, a1), true);
  e = rechazar(sinRespuesta(hacer(e, { tipo: "jugar", uid: a1 })));
  assert.equal(zonaDe(e, a1), "defensa");
  assert.equal(puedeJugar(e, a2), false);
});

test("Perugia: el límite por tipo alcanza también al oponente en el turno siguiente", () => {
  let e = mesa();
  oros(e, 0, 3);
  const p1 = poner(e, 0, "mano", "Perugia");
  e = sinRespuesta(hacer(e, { tipo: "jugar", uid: p1 }));
  const u1 = poner(e, 1, "mano", "Urias");
  const u2 = poner(e, 1, "mano", "Pricolici");
  oros(e, 1, 6);
  e = aplicar(e, { tipo: "terminar" });
  e = rechazar(e);
  assert.equal(e.activo, 1);
  e = sinRespuesta(hacer(e, { tipo: "jugar", uid: u1 }));
  assert.equal(puedeJugar(e, u2), false);
});

test("Perugia: desterrada por un Aliado, pagando un Oro busca un Aliado en cada Castillo, los destierra y roba una carta", () => {
  let e = mesa();
  const [oro] = oros(e, 0, 1);
  const perugia = poner(e, 0, "apoyo", "Perugia");
  const aliado = poner(e, 0, "defensa", "Pricolici");
  const mio = poner(e, 0, "castillo", "Urias");
  const suyo = poner(e, 1, "castillo", "Valerious");
  e = efectoDe(e, aliado, perugia);
  assert.equal(zonaDe(e, perugia), "destierro");
  assert.ok(e.pendiente);
  e = elegir(e, true);
  e = elegir(e, mio);
  e = elegir(e, suyo);
  assert.equal(zonaDe(e, mio), "destierro");
  assert.equal(zonaDe(e, suyo), "destierro");
  assert.equal(e.jugadores[0].mano.length, 1);
  assert.deepEqual(e.jugadores[0].pagado, [oro]);
});

test("Perugia: desterrada por un Talismán no dispara su habilidad", () => {
  let e = mesa();
  oros(e, 0, 1);
  const perugia = poner(e, 0, "apoyo", "Perugia");
  const talisman = poner(e, 0, "mano", "Llamar a la Manada");
  e = efectoDe(e, talisman, perugia);
  assert.equal(zonaDe(e, perugia), "destierro");
  assert.equal(e.pendiente, null);
});

test("Perugia: destruida por un Aliado no dispara su habilidad porque no fue Desterrada", () => {
  let e = mesa();
  oros(e, 0, 1);
  const perugia = poner(e, 0, "apoyo", "Perugia");
  const aliado = poner(e, 0, "defensa", "Pricolici");
  e = efectoDe(e, aliado, perugia, "destruir");
  assert.equal(zonaDe(e, perugia), "cementerio");
  assert.equal(e.pendiente, null);
});

test("Perugia: sin un Oro para pagar no se ofrece buscar", () => {
  let e = mesa();
  const perugia = poner(e, 0, "apoyo", "Perugia");
  const aliado = poner(e, 0, "defensa", "Pricolici");
  e = efectoDe(e, aliado, perugia);
  assert.equal(e.pendiente, null);
});

test("Plaga de Ratas: al entrar puede buscar otra Plaga de Ratas en el Castillo y jugarla sin pagar su coste", () => {
  let e = mesa();
  oros(e, 0, 1);
  const plaga = poner(e, 0, "mano", "Plaga de Ratas");
  const otra = arriba(e, 0, "Plaga de Ratas");
  e = sinRespuesta(hacer(e, { tipo: "jugar", uid: plaga }));
  e = elegir(e, true);
  e = elegir(e, otra);
  e = rechazar(e);
  assert.equal(zonaDe(e, plaga), "defensa");
  assert.equal(zonaDe(e, otra), "defensa");
  assert.equal(e.jugadores[0].pagado.length, 1);
  assert.equal(e.jugadores[0].reserva.length, 0);
});

test("Plaga de Ratas: también puede buscar la Plaga de Ratas en el Cementerio", () => {
  let e = mesa();
  oros(e, 0, 1);
  const plaga = poner(e, 0, "mano", "Plaga de Ratas");
  const otra = poner(e, 0, "cementerio", "Plaga de Ratas");
  e = sinRespuesta(hacer(e, { tipo: "jugar", uid: plaga }));
  e = elegir(e, true);
  e = elegir(e, otra);
  e = rechazar(e);
  assert.equal(zonaDe(e, otra), "defensa");
});

test("Plaga de Ratas: puede negarse a buscar", () => {
  let e = mesa();
  oros(e, 0, 1);
  const plaga = poner(e, 0, "mano", "Plaga de Ratas");
  const otra = arriba(e, 0, "Plaga de Ratas");
  e = rechazar(sinRespuesta(hacer(e, { tipo: "jugar", uid: plaga })));
  assert.equal(zonaDe(e, otra), "castillo");
});

test("Plaga de Ratas: destruida, baraja hasta dos cartas de los Cementerios", () => {
  let e = mesa();
  const plaga = poner(e, 0, "defensa", "Plaga de Ratas");
  const a = poner(e, 0, "cementerio", "Urias");
  const b = poner(e, 1, "cementerio", "Valerious");
  e = hacer(e, hab(plaga, "Plaga de Ratas", 0), "Barajar hasta dos cartas de los Cementerios", a, b);
  assert.equal(zonaDe(e, plaga), "cementerio");
  assert.equal(zonaDe(e, a), "castillo");
  assert.equal(zonaDe(e, b), "castillo");
});

test("Plaga de Ratas: destruida, un Aliado gana 1 de Fuerza permanentemente", () => {
  let e = mesa();
  const plaga = poner(e, 0, "defensa", "Plaga de Ratas");
  const otro = poner(e, 0, "defensa", "Pricolici");
  e = hacer(e, hab(plaga, "Plaga de Ratas", 0), "Un Aliado gana 1 de Fuerza permanentemente");
  assert.equal(zonaDe(e, plaga), "cementerio");
  assert.equal(N.fuerza(e, otro), 3);
  N.expirar(e, "finTurno");
  N.expirar(e, "inicio");
  assert.equal(N.fuerza(e, otro), 3);
});

test("Plaga Inmunda: al entrar pone bajo tu control hasta dos cartas de tu Cementerio como Aliados sin habilidad de Fuerza 1", () => {
  let e = mesa();
  oros(e, 0, 1);
  const plaga = poner(e, 0, "mano", "Plaga Inmunda");
  const a = poner(e, 0, "cementerio", "Zâna");
  const b = poner(e, 0, "cementerio", "Perugia");
  e = sinRespuesta(hacer(e, { tipo: "jugar", uid: plaga }));
  e = elegir(e, true);
  e = elegir(e, a);
  e = elegir(e, b);
  for (const u of [a, b]) {
    assert.equal(zonaDe(e, u), "defensa");
    assert.equal(N.carta(e, u).tipo, "Aliado");
    assert.equal(N.fuerza(e, u), 1);
    assert.equal(N.activa(e, u), false);
  }
});

test("Plaga Inmunda: puede negarse y las cartas se quedan en el Cementerio", () => {
  let e = mesa();
  oros(e, 0, 1);
  const plaga = poner(e, 0, "mano", "Plaga Inmunda");
  const a = poner(e, 0, "cementerio", "Zâna");
  e = rechazar(sinRespuesta(hacer(e, { tipo: "jugar", uid: plaga })));
  assert.equal(zonaDe(e, a), "cementerio");
});

test("Plaga Inmunda: por cada efecto oponente solo pueden salir del juego hasta dos Aliados que controles", () => {
  let e = mesa();
  poner(e, 0, "defensa", "Plaga Inmunda");
  const a = poner(e, 0, "defensa", "Pricolici");
  const b = poner(e, 0, "defensa", "Urias");
  const c = poner(e, 0, "defensa", "Valerious");
  const talisman = poner(e, 1, "mano", "Llamar a la Manada");
  e = ejecutar(e, { ctrl: 1, fuente: talisman, def: id("Llamar a la Manada"), vars: { x: [a, b, c] } }, [{ op: "mover", var: "x", a: "destruir" }]);
  const salieron = [a, b, c].filter((u) => zonaDe(e, u) === "cementerio").length;
  assert.equal(salieron, 2);
});

test("Poeta del Upir: al entrar baraja una carta de coste 2 o menos y, sin dos Tótems, no roba", () => {
  let e = mesa();
  oros(e, 0, 2);
  const poeta = poner(e, 0, "mano", "Poeta del Upir");
  const suya = poner(e, 1, "defensa", "Plaga de Ratas");
  e = sinRespuesta(hacer(e, { tipo: "jugar", uid: poeta }));
  e = elegir(e, suya);
  assert.equal(zonaDe(e, suya), "castillo");
  assert.equal(e.pendiente, null);
  assert.equal(e.jugadores[0].mano.length, 0);
});

test("Poeta del Upir: con dos o más Tótems baraja una carta adicional y roba una carta", () => {
  let e = mesa();
  oros(e, 0, 2);
  poner(e, 0, "apoyo", "Perugia");
  poner(e, 0, "apoyo", "Perugia");
  const poeta = poner(e, 0, "mano", "Poeta del Upir");
  const a = poner(e, 1, "defensa", "Plaga de Ratas");
  const b = poner(e, 1, "defensa", "Plaga Inmunda");
  e = sinRespuesta(hacer(e, { tipo: "jugar", uid: poeta }));
  e = elegir(e, a);
  e = elegir(e, b);
  assert.equal(zonaDe(e, a), "castillo");
  assert.equal(zonaDe(e, b), "castillo");
  assert.equal(e.jugadores[0].mano.length, 1);
});

test("Poeta del Upir: en tu Vigilia puede desterrarse de la mano para subir un Tótem del Cementerio a la mano", () => {
  let e = mesa();
  const poeta = poner(e, 0, "mano", "Poeta del Upir");
  const totem = poner(e, 0, "cementerio", "Perugia");
  assert.equal(puedeHab(e, poeta, "Poeta del Upir", 0), true);
  e = hacer(e, hab(poeta, "Poeta del Upir", 0));
  assert.equal(zonaDe(e, poeta), "destierro");
  assert.equal(zonaDe(e, totem), "mano");
});

test("Poeta del Upir: también puede desterrarse desde el Cementerio", () => {
  let e = mesa();
  const poeta = poner(e, 0, "cementerio", "Poeta del Upir");
  const totem = poner(e, 0, "cementerio", "Perugia");
  assert.equal(puedeHab(e, poeta, "Poeta del Upir", 1), true);
  e = hacer(e, hab(poeta, "Poeta del Upir", 1));
  assert.equal(zonaDe(e, poeta), "destierro");
  assert.equal(zonaDe(e, totem), "mano");
});

test("Poeta del Upir: sin un Tótem en el Cementerio no ofrece la habilidad", () => {
  const e = mesa();
  const poeta = poner(e, 0, "mano", "Poeta del Upir");
  assert.equal(puedeHab(e, poeta, "Poeta del Upir", 0), false);
});

test("Pricolici: al entrar puede jugar un Aliado de tu Cementerio reduciendo su coste en un Oro", () => {
  let e = mesa();
  oros(e, 0, 3);
  const pricolici = poner(e, 0, "mano", "Pricolici");
  const urias = poner(e, 0, "cementerio", "Urias");
  e = sinRespuesta(hacer(e, { tipo: "jugar", uid: pricolici }));
  e = elegir(e, true);
  assert.equal(zonaDe(e, urias), "defensa");
  assert.equal(e.jugadores[0].pagado.length, 3);
  assert.equal(e.jugadores[0].reserva.length, 0);
});

test("Pricolici: el coste reducido no baja de 0", () => {
  let e = mesa();
  oros(e, 0, 2);
  const pricolici = poner(e, 0, "mano", "Pricolici");
  const plaga = poner(e, 0, "cementerio", "Plaga Inmunda");
  e = sinRespuesta(hacer(e, { tipo: "jugar", uid: pricolici }));
  e = elegir(e, true);
  e = rechazar(e);
  assert.equal(zonaDe(e, plaga), "defensa");
  assert.equal(e.jugadores[0].pagado.length, 2);
});

test("Pricolici: no ofrece jugar un Aliado cuyo coste reducido no puedes pagar", () => {
  let e = mesa();
  oros(e, 0, 2);
  const pricolici = poner(e, 0, "mano", "Pricolici");
  const valerious = poner(e, 0, "cementerio", "Valerious");
  e = sinRespuesta(hacer(e, { tipo: "jugar", uid: pricolici }));
  assert.equal(e.pendiente, null);
  assert.equal(zonaDe(e, valerious), "cementerio");
});

test("Pricolici: las cartas del Cementerio oponente pierden su habilidad y no pueden ser Barajadas", () => {
  let e = mesa();
  poner(e, 0, "defensa", "Pricolici");
  const suya = poner(e, 1, "cementerio", "Plaga de Ratas");
  const mia = poner(e, 0, "cementerio", "Plaga de Ratas");
  assert.equal(N.activa(e, suya), false);
  assert.equal(N.activa(e, mia), true);
  const aliado = poner(e, 0, "defensa", "Urias");
  e = efectoDe(e, aliado, suya, "barajar");
  assert.equal(zonaDe(e, suya), "cementerio");
  e = efectoDe(e, aliado, mia, "barajar");
  assert.equal(zonaDe(e, mia), "castillo");
});

test("Santa Diestra: puede Desterrarse para Anular una carta jugada sin pagar su coste", () => {
  let e = mesa();
  oros(e, 0, 3);
  const diestra = poner(e, 1, "reserva", "Santa Diestra");
  const moroi = poner(e, 0, "mano", "Moroi");
  const ileana = poner(e, 0, "castillo", "Ileana");
  e = sinRespuesta(aplicar(e, { tipo: "jugar", uid: moroi }));
  e = elegir(e, true);
  e = elegir(e, ileana);
  assert.equal(e.pendiente?.jugador, 1);
  e = elegir(e, true);
  assert.equal(zonaDe(e, diestra), "destierro");
  assert.equal(zonaDe(e, ileana), "cementerio");
  assert.equal(zonaDe(e, moroi), "defensa");
});

test("Santa Diestra: si no se usa, la carta jugada sin pagar entra normal", () => {
  let e = mesa();
  oros(e, 0, 3);
  const diestra = poner(e, 1, "reserva", "Santa Diestra");
  const moroi = poner(e, 0, "mano", "Moroi");
  const ileana = poner(e, 0, "castillo", "Ileana");
  e = sinRespuesta(aplicar(e, { tipo: "jugar", uid: moroi }));
  e = elegir(e, true);
  e = elegir(e, ileana);
  e = elegir(e, false);
  assert.equal(zonaDe(e, diestra), "reserva");
  assert.equal(zonaDe(e, ileana), "defensa");
});

test("Urias: tiene Furia", () => {
  const e = mesa();
  const urias = poner(e, 0, "defensa", "Urias");
  assert.ok(N.tiene(e, urias, "Furia"));
});

test("Urias: cuando él hace daño, baraja un Aliado propio y convierte una carta de coste 2 o menos y una del Cementerio en Aliados de Fuerza 2 sin habilidad", () => {
  let e = mesa();
  const urias = poner(e, 0, "defensa", "Urias");
  const sacrificio = poner(e, 0, "defensa", "Plaga de Ratas");
  const botin = poner(e, 1, "defensa", "Plaga Inmunda");
  const tumba = poner(e, 1, "cementerio", "Perugia");
  e = combate(e, urias);
  e = elegir(e, true);
  e = elegir(e, sacrificio);
  e = elegir(e, botin);
  e = elegir(e, tumba);
  assert.equal(zonaDe(e, sacrificio), "castillo");
  for (const u of [botin, tumba]) {
    assert.ok(e.jugadores[0].defensa.includes(u));
    assert.equal(N.carta(e, u).tipo, "Aliado");
    assert.equal(N.fuerza(e, u), 2);
    assert.equal(N.activa(e, u), false);
  }
});

test("Urias: también se dispara cuando otro de tus Aliados hace daño", () => {
  let e = mesa();
  poner(e, 0, "defensa", "Urias");
  const atacante = poner(e, 0, "defensa", "Pricolici");
  const tumba = poner(e, 1, "cementerio", "Perugia");
  e = combate(e, atacante);
  assert.ok(e.pendiente);
  e = elegir(e, true);
  e = elegir(e, atacante);
  e = elegir(e, tumba);
  assert.ok(e.jugadores[0].defensa.includes(tumba));
});

test("Urias: puede negarse y no se baraja ni convierte nada", () => {
  let e = mesa();
  const urias = poner(e, 0, "defensa", "Urias");
  const sacrificio = poner(e, 0, "defensa", "Plaga de Ratas");
  e = rechazar(combate(e, urias));
  assert.equal(zonaDe(e, sacrificio), "defensa");
});

test("Urias: no se dispara cuando el Aliado que hace daño es del oponente", () => {
  let e = mesa();
  poner(e, 0, "defensa", "Urias");
  const atacante = poner(e, 1, "defensa", "Pricolici");
  e = aplicar(e, { tipo: "terminar" });
  e = rechazar(e);
  assert.equal(e.activo, 1);
  e = combate(e, atacante);
  assert.equal(e.pendiente, null);
});

test("Valerious: al entrar pagando su coste baraja las cartas oponentes que no sean Oro", () => {
  let e = mesa();
  oros(e, 0, 3);
  const valerious = poner(e, 0, "mano", "Valerious");
  const aliado = poner(e, 1, "defensa", "Plaga de Ratas");
  const totem = poner(e, 1, "apoyo", "Perugia");
  const oro = poner(e, 1, "reserva", "Drácula");
  e = sinRespuesta(hacer(e, { tipo: "jugar", uid: valerious }));
  assert.equal(zonaDe(e, aliado), "castillo");
  assert.equal(zonaDe(e, totem), "castillo");
  assert.equal(zonaDe(e, oro), "reserva");
});

test("Valerious: si entra sin pagar su coste no baraja nada", () => {
  let e = mesa();
  const valerious = poner(e, 0, "mano", "Valerious");
  const aliado = poner(e, 1, "defensa", "Plaga de Ratas");
  e = ejecutar(e, { ctrl: 0, fuente: valerious, def: id("Valerious"), vars: { v: [valerious] } }, [{ op: "jugarGratis", var: "v" }]);
  assert.equal(zonaDe(e, valerious), "defensa");
  assert.equal(zonaDe(e, aliado), "defensa");
});

test("Valerious: cuando el oponente juega una carta, se destierra de la mano para marcar a un Aliado oponente", () => {
  let e = mesa();
  oros(e, 0, 3);
  const valerious = poner(e, 1, "mano", "Valerious");
  const aliado = poner(e, 0, "defensa", "Pricolici");
  const carta = poner(e, 0, "mano", "Plaga Inmunda");
  e = aplicar(e, { tipo: "jugar", uid: carta });
  assert.equal(e.pendiente.jugador, 1);
  e = elegir(e, true);
  assert.equal(zonaDe(e, valerious), "destierro");
  assert.ok(e.efectos.some((f) => f.tipo === "debeAtacar" && f.uid === aliado));
});

test("Valerious: también puede desterrarse estando en juego", () => {
  let e = mesa();
  oros(e, 0, 3);
  const valerious = poner(e, 1, "defensa", "Valerious");
  const aliado = poner(e, 0, "defensa", "Pricolici");
  const carta = poner(e, 0, "mano", "Plaga Inmunda");
  e = aplicar(e, { tipo: "jugar", uid: carta });
  e = elegir(e, true);
  assert.equal(zonaDe(e, valerious), "destierro");
  assert.ok(e.efectos.some((f) => f.tipo === "debeAtacar" && f.uid === aliado));
});

test("Valerious: sin Aliados oponentes no ofrece desterrarse", () => {
  let e = mesa();
  oros(e, 0, 3);
  const valerious = poner(e, 1, "mano", "Valerious");
  const carta = poner(e, 0, "mano", "Plaga Inmunda");
  e = aplicar(e, { tipo: "jugar", uid: carta });
  assert.notEqual(e.pendiente?.jugador, 1);
  e = rechazar(e);
  assert.equal(zonaDe(e, valerious), "mano");
});

test("Valerious: el Aliado oponente marcado debe atacar este turno si puede", () => {
  let e = mesa();
  oros(e, 0, 3);
  poner(e, 1, "mano", "Valerious");
  poner(e, 0, "defensa", "Pricolici");
  const carta = poner(e, 0, "mano", "Plaga Inmunda");
  e = aplicar(e, { tipo: "jugar", uid: carta });
  e = elegir(e, true);
  e = rechazar(sinRespuesta(e));
  assert.equal(accionesLegales(e).some((a) => a.tipo === "terminar"), false);
});

test("Válva Apei: con dos o más Tótems convierte una carta de coste 2 o menos en un Tótem sin habilidad y gana su control", () => {
  let e = mesa();
  poner(e, 0, "apoyo", "Perugia");
  poner(e, 0, "apoyo", "Perugia");
  const apei = poner(e, 0, "defensa", "Válva Apei");
  const presa = poner(e, 1, "defensa", "Plaga de Ratas");
  e = hacer(e, hab(apei, "Válva Apei", 0));
  assert.ok(e.jugadores[0].apoyo.includes(presa));
  assert.equal(N.carta(e, presa).tipo, "Tótem");
  assert.equal(N.activa(e, presa), false);
  assert.equal(puedeHab(e, apei, "Válva Apei", 0), false);
});

test("Válva Apei: con un solo Tótem no puede usarse", () => {
  const e = mesa();
  poner(e, 0, "apoyo", "Perugia");
  const apei = poner(e, 0, "defensa", "Válva Apei");
  poner(e, 1, "defensa", "Plaga de Ratas");
  assert.equal(puedeHab(e, apei, "Válva Apei", 0), false);
});

test("Válva Apei: al salir del juego cada jugador recupera las cartas que no sean Oro de las que es dueño", () => {
  let e = mesa();
  const apei = poner(e, 0, "defensa", "Válva Apei");
  const robada = poner(e, 1, "defensa", "Plaga de Ratas");
  const oroRobado = poner(e, 1, "reserva", "Drácula");
  const mia = poner(e, 0, "defensa", "Urias");
  e.jugadores[1].defensa.splice(e.jugadores[1].defensa.indexOf(robada), 1);
  e.jugadores[0].defensa.push(robada);
  e.jugadores[1].reserva.splice(e.jugadores[1].reserva.indexOf(oroRobado), 1);
  e.jugadores[0].reserva.push(oroRobado);
  e = efectoDe(e, mia, apei, "destruir");
  assert.equal(zonaDe(e, apei), "cementerio");
  assert.ok(e.jugadores[1].defensa.includes(robada));
  assert.ok(e.jugadores[0].reserva.includes(oroRobado));
  assert.ok(e.jugadores[0].defensa.includes(mia));
});

test("Válva Bailor: es Indestructible", () => {
  let e = mesa();
  const bailor = poner(e, 0, "defensa", "Válva Bailor");
  const aliado = poner(e, 1, "defensa", "Urias");
  e = ejecutar(e, { ctrl: 1, fuente: aliado, def: id("Urias"), vars: { x: [bailor] } }, [{ op: "mover", var: "x", a: "destruir" }]);
  assert.equal(zonaDe(e, bailor), "defensa");
});

test("Válva Bailor: al entrar convierte hasta dos cartas de coste 2 o menos y/o de los Cementerios en Tótems sin habilidad en tu Línea de Apoyo", () => {
  let e = mesa();
  oros(e, 0, 3);
  const bailor = poner(e, 0, "mano", "Válva Bailor");
  const presa = poner(e, 1, "defensa", "Plaga de Ratas");
  const tumba = poner(e, 0, "cementerio", "Valerious");
  e = sinRespuesta(hacer(e, { tipo: "jugar", uid: bailor }));
  e = elegir(e, presa);
  e = elegir(e, tumba);
  for (const u of [presa, tumba]) {
    assert.ok(e.jugadores[0].apoyo.includes(u));
    assert.equal(N.carta(e, u).tipo, "Tótem");
    assert.equal(N.activa(e, u), false);
  }
});

test("Válva Bailor: no puede convertir una carta en juego de coste mayor a 2", () => {
  let e = mesa();
  oros(e, 0, 3);
  const bailor = poner(e, 0, "mano", "Válva Bailor");
  const cara = poner(e, 1, "defensa", "Valerious");
  e = sinRespuesta(hacer(e, { tipo: "jugar", uid: bailor }));
  assert.equal(e.pendiente.opciones.some((o) => o.valor === cara), false);
});

test("Válva Bailor: los Tótems convertidos pasan a ser de coste 5", () => {
  let e = mesa();
  oros(e, 0, 3);
  const bailor = poner(e, 0, "mano", "Válva Bailor");
  const presa = poner(e, 1, "defensa", "Plaga de Ratas");
  e = sinRespuesta(hacer(e, { tipo: "jugar", uid: bailor }));
  e = elegir(e, presa);
  e = rechazar(e);
  assert.equal(N.carta(e, presa).coste, 5);
});

test("Zâna: los Aliados oponentes pierden 1 de Fuerza", () => {
  const e = mesa();
  poner(e, 0, "defensa", "Zâna");
  const mio = poner(e, 0, "defensa", "Pricolici");
  const suyo = poner(e, 1, "defensa", "Pricolici");
  assert.equal(N.fuerza(e, mio), 2);
  assert.equal(N.fuerza(e, suyo), 1);
});

test("Zâna: al entrar una carta de coste 1 o más, ambos roban una carta y barajan una de su mano, y barajas hasta dos de tu Cementerio", () => {
  let e = mesa();
  oros(e, 0, 2);
  poner(e, 0, "defensa", "Zâna");
  const jugada = poner(e, 0, "mano", "Pricolici");
  const mia = poner(e, 0, "mano", "Valerious");
  const suya = poner(e, 1, "mano", "Perugia");
  const tumba = poner(e, 0, "cementerio", "Urias");
  e = sinRespuesta(hacer(e, { tipo: "jugar", uid: jugada }));
  e = elegir(e, true);
  e = elegir(e, mia);
  e = elegir(e, suya);
  e = elegir(e, tumba);
  assert.equal(zonaDe(e, mia), "castillo");
  assert.equal(zonaDe(e, suya), "castillo");
  assert.equal(zonaDe(e, tumba), "castillo");
  assert.equal(e.jugadores[0].mano.length, 1);
  assert.equal(e.jugadores[1].mano.length, 1);
});

test("Zâna: también se dispara cuando entra ella misma", () => {
  let e = mesa();
  oros(e, 0, 1);
  const zana = poner(e, 0, "mano", "Zâna");
  e = sinRespuesta(hacer(e, { tipo: "jugar", uid: zana }));
  assert.ok(e.pendiente);
  assert.equal(e.pendiente.opciones[0].valor, true);
});

test("Zâna: no se dispara con cartas de coste 0 y solo una vez por turno", () => {
  let e = mesa();
  oros(e, 0, 4);
  poner(e, 0, "defensa", "Zâna");
  const oro = poner(e, 0, "mano", "Drácula");
  const u1 = poner(e, 0, "mano", "Urias");
  const u2 = poner(e, 0, "mano", "Valerious");
  e = hacer(e, { tipo: "oro", uid: oro });
  assert.equal(e.pendiente, null);
  e = sinRespuesta(hacer(e, { tipo: "jugar", uid: u1 }));
  assert.ok(e.pendiente);
  e = rechazar(e);
  e = rechazar(sinRespuesta(hacer(e, { tipo: "jugar", uid: u2 })));
  assert.equal(zonaDe(e, u2), "defensa");
  assert.equal(e.jugadores[0].mano.length, 0);
});

test("Zâna: se dispara con cartas de coste 1 o más del oponente", () => {
  let e = mesa();
  poner(e, 1, "defensa", "Zâna");
  oros(e, 0, 2);
  const jugada = poner(e, 0, "mano", "Urias");
  e = sinRespuesta(hacer(e, { tipo: "jugar", uid: jugada }));
  assert.ok(e.pendiente);
  assert.equal(e.pendiente.jugador, 1);
});

test("Plaga de Ratas: si es Indestructible no puede pagar el coste de destruirse", () => {
  const e = mesa();
  const plaga = poner(e, 0, "defensa", "Plaga de Ratas");
  poner(e, 0, "arma", "Pedrenyal", { portador: plaga });
  assert.ok(!accionesLegales(e).some((a) => a.tipo === "habilidad" && a.uid === plaga));
});
