import { test } from "node:test";
import assert from "node:assert/strict";
import { mesa, poner, oros, hacer, elegir, sinRespuesta, accionesLegales, aplicar, zonaDe, id, N } from "./ayuda-duelo.mjs";
import { costeDe } from "../web/duelo/motor.js";
import { disponibles, cumple } from "../web/duelo/efectos.js";

const jugar = (uid, extra = {}) => ({ tipo: "jugar", uid, ...extra });
const habilidad = (uid, nombre, h = 0) => ({ tipo: "habilidad", uid, def: id(nombre), h });
const puedeUsar = (e, uid) => accionesLegales(e).some((a) => a.tipo === "habilidad" && a.uid === uid);
const valores = (e) => e.pendiente.opciones.map((o) => o.valor);
const ctxDe = (e, uid, j) => ({ ctrl: j, fuente: uid, def: e.instancias[uid], costeFuente: N.carta(e, uid).coste ?? 0, vars: {} });

function oroAbismo(e, j) {
  const u = poner(e, j, "pagado", "Azi del Abismo");
  e.conv[u] = { tipo: "Oro", sinHabilidad: false, como: id("Azi del Abismo") };
  return u;
}

function atacar(e, ...uids) {
  e = aplicar(e, { tipo: "batalla" });
  for (const u of uids) e = aplicar(e, { tipo: "atacar", uid: u });
  return e;
}

function combate(e, ...uids) {
  e = atacar(e, ...uids);
  e = aplicar(e, { tipo: "finAtaque" });
  e = aplicar(e, { tipo: "finBloqueo" });
  e = aplicar(e, { tipo: "pasar" });
  return aplicar(e, { tipo: "pasar" });
}

test("Aku Aku: tiene Furia", () => {
  const e = mesa();
  const aku = poner(e, 0, "defensa", "Aku Aku");
  assert.equal(N.tiene(e, aku, "Furia"), true);
});

test("Aku Aku: al entrar puedes jugar un Aliado de tu Cementerio reduciendo su coste en un Oro", () => {
  let e = mesa();
  oros(e, 0, 3);
  const aku = poner(e, 0, "mano", "Aku Aku");
  const bok = poner(e, 0, "cementerio", "Bokrug");
  e = sinRespuesta(aplicar(e, jugar(aku)));
  e = elegir(e, true);
  assert.equal(zonaDe(e, bok), "defensa");
  assert.equal(e.jugadores[0].reserva.length, 0);
  assert.equal(e.jugadores[0].pagado.length, 3);
});

test("Aku Aku: la reducción no baja de un Oro", () => {
  let e = mesa();
  oros(e, 0, 1);
  const aku = poner(e, 0, "mano", "Aku Aku");
  poner(e, 0, "cementerio", "Valefor");
  e = sinRespuesta(aplicar(e, jugar(aku)));
  assert.equal(e.pendiente, null);
});

test("Aku Aku: cuando hace daño de combate Destierra de los Cementerios tantas cartas como Fuerza tenga un Aliado", () => {
  let e = mesa();
  const aku = poner(e, 0, "defensa", "Aku Aku");
  poner(e, 0, "cementerio", "Valefor");
  poner(e, 0, "cementerio", "Valefor");
  e = combate(e, aku);
  for (let i = 0; i < 3; i++) e = elegir(e, valores(e)[0]);
  const enCem = e.jugadores[0].cementerio.length + e.jugadores[1].cementerio.length;
  const desterradas = e.jugadores[0].destierro.length + e.jugadores[1].destierro.length;
  assert.equal(desterradas, 3);
  assert.equal(enCem, 2);
});

test("Amaru: tiene Indestructible", () => {
  const e = mesa();
  const amaru = poner(e, 0, "defensa", "Amaru");
  assert.equal(N.tiene(e, amaru, "Indestructible"), true);
});

test("Amaru: reduce su coste en un Oro por cada Oro que controles, hasta un mínimo de 2", () => {
  const e = mesa();
  const amaru = poner(e, 0, "mano", "Amaru");
  assert.equal(costeDe(e, 0, amaru).pagar, 5);
  oros(e, 0, 2);
  assert.equal(costeDe(e, 0, amaru).pagar, 3);
  oros(e, 0, 4);
  assert.equal(costeDe(e, 0, amaru).pagar, 2);
});

test("Amaru: tus Aliados de coste 3 o más Barajan hasta tres cartas de tu Cementerio una vez por turno cada uno", () => {
  let e = mesa();
  const amaru = poner(e, 0, "defensa", "Amaru");
  const bok = poner(e, 0, "defensa", "Bokrug");
  poner(e, 0, "defensa", "Valefor");
  const c = [1, 2, 3, 4].map(() => poner(e, 0, "cementerio", "Valefor"));
  e = hacer(e, habilidad(amaru, "Amaru"), bok, c[0], c[1], c[2]);
  assert.deepEqual(c.map((u) => zonaDe(e, u)), ["castillo", "castillo", "castillo", "cementerio"]);
  assert.equal(puedeUsar(e, amaru), true);
  e = hacer(e, habilidad(amaru, "Amaru"), c[3]);
  assert.equal(zonaDe(e, c[3]), "castillo");
  assert.equal(puedeUsar(e, amaru), false);
});

test("Apofis del Caos: tiene Furia", () => {
  const e = mesa();
  const apofis = poner(e, 0, "defensa", "Apofis del Caos");
  assert.equal(N.tiene(e, apofis, "Furia"), true);
});

test("Apofis del Caos: cuando ataca una carta y sus copias pierden su habilidad y no pueden bloquear", () => {
  let e = mesa();
  const apofis = poner(e, 0, "defensa", "Apofis del Caos");
  const v1 = poner(e, 1, "defensa", "Valefor");
  const v2 = poner(e, 1, "defensa", "Valefor");
  const otro = poner(e, 1, "defensa", "Bokrug");
  e = atacar(e, apofis);
  e = elegir(e, v1);
  assert.equal(N.activa(e, v1), false);
  assert.equal(N.activa(e, v2), false);
  assert.equal(N.activa(e, otro), true);
  e = aplicar(e, { tipo: "finAtaque" });
  const bloqueos = accionesLegales(e).filter((a) => a.tipo === "bloquear").map((a) => a.uid);
  assert.deepEqual(bloqueos, [otro]);
});

test("Apofis del Caos: Botando tres cartas reduce su coste en dos Oros", () => {
  let e = mesa();
  oros(e, 0, 2);
  const apofis = poner(e, 0, "mano", "Apofis del Caos");
  assert.equal(accionesLegales(e).some((a) => a.tipo === "jugar" && a.uid === apofis && !a.alternativo), false);
  e = sinRespuesta(aplicar(e, jugar(apofis, { alternativo: true })));
  assert.equal(zonaDe(e, apofis), "defensa");
  assert.equal(e.jugadores[0].castillo.length, 27);
  assert.equal(e.jugadores[0].cementerio.length, 3);
  assert.equal(e.jugadores[0].reserva.length, 1);
});

test("Azi Dahaka: tiene Furia y Exhumar, tus Aliados ganan 1 de Fuerza y no pierden su habilidad, y los Oros oponentes no tienen habilidad", () => {
  const e = mesa();
  const azi = poner(e, 0, "defensa", "Azi Dahaka");
  const v = poner(e, 0, "defensa", "Valefor");
  const r = poner(e, 1, "defensa", "Valefor");
  const onsen = poner(e, 1, "reserva", "Onsen");
  assert.equal(N.tiene(e, azi, "Furia"), true);
  assert.equal(N.tiene(e, azi, "Exhumar"), true);
  assert.equal(N.fuerza(e, v), 4);
  assert.equal(N.fuerza(e, r), 3);
  N.agregarEfecto(e, { tipo: "pierdeHabilidad", uid: v }, 1);
  assert.equal(N.activa(e, v), true);
  assert.equal(N.activa(e, onsen), false);
});

test("Azi Dahaka: en tu Vigilia Destruye una carta que no sea Oro y Roba dos cartas", () => {
  let e = mesa();
  const azi = poner(e, 0, "defensa", "Azi Dahaka");
  const r = poner(e, 1, "defensa", "Valefor");
  e = hacer(e, habilidad(azi, "Azi Dahaka"), "Destruir una carta que no sea Oro", r);
  assert.equal(zonaDe(e, r), "cementerio");
  assert.equal(e.jugadores[0].mano.length, 2);
  assert.equal(puedeUsar(e, azi), false);
});

test("Azi Dahaka: o busca una carta en tu Castillo y la pone en tu mano, y Roba dos cartas", () => {
  let e = mesa();
  const azi = poner(e, 0, "defensa", "Azi Dahaka");
  const b = poner(e, 0, "castillo", "Bokrug");
  e = hacer(e, habilidad(azi, "Azi Dahaka"), "Buscar una carta en tu Castillo", b);
  assert.equal(zonaDe(e, b), "mano");
  assert.equal(e.jugadores[0].mano.length, 3);
});

test("Azi Raoioita: tiene Furia y reduce su coste en un Oro si controlas Dragones", () => {
  const e = mesa();
  const azi = poner(e, 0, "mano", "Azi Raoioita");
  assert.equal(N.tiene(e, azi, "Furia"), true);
  poner(e, 0, "defensa", "Sir Galahad");
  assert.equal(costeDe(e, 0, azi).pagar, 3);
  poner(e, 0, "defensa", "Dragón de Magma");
  assert.equal(costeDe(e, 0, azi).pagar, 2);
});

test("Azi Raoioita: una vez por turno genera un Oro para Aliados y Destruye hasta una carta de coste 2 o menos", () => {
  let e = mesa();
  const azi = poner(e, 0, "defensa", "Azi Raoioita");
  const r = poner(e, 1, "defensa", "Valefor");
  poner(e, 1, "defensa", "Bokrug");
  e = hacer(e, habilidad(azi, "Azi Raoioita"), r);
  assert.equal(zonaDe(e, r), "cementerio");
  assert.equal(disponibles(e, 0, "Aliado"), 1);
  assert.equal(disponibles(e, 0, "Talismán"), 0);
  assert.equal(puedeUsar(e, azi), false);
});

test("Azi Raoioita: desde tu Cementerio, al comienzo del turno un Oro o carta de coste 2 o menos pierde su habilidad por el turno", () => {
  let e = mesa();
  poner(e, 0, "cementerio", "Azi Raoioita");
  const onsen = poner(e, 1, "reserva", "Onsen");
  poner(e, 1, "defensa", "Valefor");
  e = aplicar(e, { tipo: "terminar" });
  e = elegir(e, onsen);
  assert.equal(e.activo, 1);
  assert.equal(N.activa(e, onsen), false);
});

test("Azi Sruvara: al entrar busca un Aliado Azi y convierte una carta de coste 1 o menos en un Oro en tu Oro Pagado", () => {
  let e = mesa();
  oros(e, 0, 1);
  const azi = poner(e, 0, "mano", "Azi Sruvara");
  const dahaka = poner(e, 0, "castillo", "Azi Dahaka");
  poner(e, 0, "castillo", "Valefor");
  const r = poner(e, 1, "defensa", "Valefor");
  e = sinRespuesta(aplicar(e, jugar(azi)));
  assert.equal(valores(e).some((u) => u && N.carta(e, u).nombre === "Valefor"), false);
  e = elegir(e, dahaka);
  e = elegir(e, r);
  assert.equal(zonaDe(e, dahaka), "mano");
  assert.equal(zonaDe(e, r), "pagado");
  assert.equal(N.ubicar(e, r).j, 0);
  assert.equal(N.carta(e, r).tipo, "Oro");
});

test("Azi Sruvara: Dagon cuenta como Aliado Azi al buscar", () => {
  let e = mesa();
  oros(e, 0, 1);
  const azi = poner(e, 0, "mano", "Azi Sruvara");
  const dagon = poner(e, 0, "castillo", "Dagon");
  e = sinRespuesta(aplicar(e, jugar(azi)));
  assert.equal(valores(e).includes(dagon), true);
});

test("Azi Sruvara: el Oro convertido cobra un Oro adicional por cancelar habilidades de tus Aliados de coste 4 o más", { todo: "mecánica: cancelar habilidades cuesta Oros adicionales (habilidad otorgada a un Oro convertido)" }, () => {});

test("Azi del Abismo: tus Aliados ganan 1 de Fuerza", () => {
  const e = mesa();
  poner(e, 0, "defensa", "Azi del Abismo");
  const v = poner(e, 0, "defensa", "Valefor");
  const r = poner(e, 1, "defensa", "Valefor");
  assert.equal(N.fuerza(e, v), 4);
  assert.equal(N.fuerza(e, r), 3);
});

test("Azi del Abismo: Descartando una carta se convierte hasta tu próximo turno en un Oro en tu Oro Pagado", () => {
  let e = mesa();
  const azi = poner(e, 0, "defensa", "Azi del Abismo");
  const v = poner(e, 0, "defensa", "Valefor");
  const d = poner(e, 0, "mano", "Bokrug");
  e = aplicar(e, habilidad(azi, "Azi del Abismo"));
  assert.equal(zonaDe(e, d), "cementerio");
  assert.equal(zonaDe(e, azi), "pagado");
  assert.equal(N.carta(e, azi).tipo, "Oro");
  assert.equal(N.fuerza(e, v), 3);
  assert.equal(puedeUsar(e, azi), false);
});

test("Azi del Abismo: solo los demás Aliados ganan Fuerza", () => {
  const e = mesa();
  const azi = poner(e, 0, "defensa", "Azi del Abismo");
  assert.equal(N.fuerza(e, azi), 3);
});

test("Azi del Abismo: como Oro reduce el daño recibido por tu Castillo en 1 por cada Oro Azi", () => {
  let e = mesa();
  const ct = poner(e, 0, "defensa", "Come Tiempo");
  oroAbismo(e, 1);
  e = combate(e, ct);
  assert.equal(e.jugadores[1].castillo.length, 30 - 6);
});

test("Azi del Abismo: con dos Oros Azi cada uno reduce el daño en 2", () => {
  let e = mesa();
  const ct = poner(e, 0, "defensa", "Come Tiempo");
  oroAbismo(e, 1);
  oroAbismo(e, 1);
  e = combate(e, ct);
  assert.equal(e.jugadores[1].castillo.length, 30 - 3);
});

test("Basilisco Chilote: desde tu mano, pagando un Oro y poniendo un Aliado de coste 3 o más en el tope de tu Castillo, se convierte en un Oro", () => {
  let e = mesa();
  oros(e, 0, 1);
  const bas = poner(e, 0, "mano", "Basilisco Chilote");
  const bok = poner(e, 0, "mano", "Bokrug");
  e = aplicar(e, habilidad(bas, "Basilisco Chilote", 0));
  assert.equal(e.jugadores[0].castillo[0], bok);
  assert.equal(zonaDe(e, bas), "pagado");
  assert.equal(N.carta(e, bas).tipo, "Oro");
  assert.equal(e.jugadores[0].reserva.length, 0);
});

test("Basilisco Chilote: sin otro Aliado de coste 3 o más en la mano no puede convertirse", () => {
  const e = mesa();
  oros(e, 0, 1);
  const bas = poner(e, 0, "mano", "Basilisco Chilote");
  poner(e, 0, "mano", "Valefor");
  assert.equal(puedeUsar(e, bas), false);
});

test("Basilisco Chilote: una vez por turno Baraja hasta dos cartas de tu Cementerio", () => {
  let e = mesa();
  const bas = poner(e, 0, "defensa", "Basilisco Chilote");
  const c = [1, 2, 3].map(() => poner(e, 0, "cementerio", "Valefor"));
  e = hacer(e, habilidad(bas, "Basilisco Chilote", 1), c[0], c[1]);
  assert.deepEqual(c.map((u) => zonaDe(e, u)), ["castillo", "castillo", "cementerio"]);
  assert.equal(puedeUsar(e, bas), false);
});

test("Bokrug: tiene Exhumar y reduce su coste por cada Aliado de coste 3 o más que controles, hasta un mínimo de 1", () => {
  const e = mesa();
  const bok = poner(e, 0, "mano", "Bokrug");
  assert.equal(N.tiene(e, poner(e, 0, "defensa", "Bokrug"), "Exhumar"), true);
  assert.equal(costeDe(e, 0, bok).pagar, 2);
  poner(e, 0, "defensa", "Valefor");
  assert.equal(costeDe(e, 0, bok).pagar, 2);
  poner(e, 0, "defensa", "Apofis del Caos");
  assert.equal(costeDe(e, 0, bok).pagar, 1);
  poner(e, 0, "defensa", "Apofis del Caos");
  assert.equal(costeDe(e, 0, bok).pagar, 1);
});

test("Bokrug: una vez por turno un Aliado gana Furia y hace Daño al Destierro por el turno", () => {
  let e = mesa();
  const bok = poner(e, 0, "defensa", "Bokrug");
  const s = poner(e, 0, "defensa", "Sir Galahad");
  e = hacer(e, habilidad(bok, "Bokrug"), s);
  assert.equal(N.tiene(e, s, "Furia"), true);
  assert.equal(N.tiene(e, s, "DanoAlDestierro"), true);
  assert.equal(puedeUsar(e, bok), false);
});

test("Caicai Vilu: no puedes controlar más de una copia", () => {
  const e = mesa();
  oros(e, 0, 3);
  poner(e, 0, "defensa", "Caicai Vilu");
  const otra = poner(e, 0, "mano", "Caicai Vilu");
  assert.equal(accionesLegales(e).some((a) => a.tipo === "jugar" && a.uid === otra), false);
});

test("Caicai Vilu: para jugar Talismanes el jugador Baraja una carta de su mano", () => {
  let e = mesa();
  oros(e, 0, 1);
  poner(e, 0, "defensa", "Caicai Vilu");
  const tablon = poner(e, 0, "mano", "Caminar el Tablón");
  const v = poner(e, 0, "mano", "Valefor");
  poner(e, 1, "mano", "Valefor");
  e = sinRespuesta(aplicar(e, jugar(tablon)));
  assert.equal(zonaDe(e, v), "castillo");
  assert.equal(e.jugadores[1].destierro.length, 1);
});

test("Caicai Vilu: Botando cuatro cartas y pagando un Oro se juega desde tu Cementerio", () => {
  let e = mesa();
  oros(e, 0, 1);
  const cai = poner(e, 0, "cementerio", "Caicai Vilu");
  const accion = accionesLegales(e).find((a) => a.tipo === "jugar" && a.uid === cai);
  assert.deepEqual(accion, { tipo: "jugar", uid: cai, desde: "cementerio" });
  e = sinRespuesta(aplicar(e, accion));
  assert.equal(zonaDe(e, cai), "defensa");
  assert.equal(e.jugadores[0].castillo.length, 26);
  assert.equal(e.jugadores[0].cementerio.length, 4);
  assert.equal(e.jugadores[0].reserva.length, 0);
});

test("Caicai Vilu: cuando es Destruido vuelve a tu mano", () => {
  let e = mesa();
  const azi = poner(e, 0, "defensa", "Azi Dahaka");
  const cai = poner(e, 0, "defensa", "Caicai Vilu");
  e = hacer(e, habilidad(azi, "Azi Dahaka"), "Destruir una carta que no sea Oro", cai);
  assert.equal(zonaDe(e, cai), "mano");
});

test("Caos: tiene Furia y reduce su coste por cada Oro que controles más que tu oponente", () => {
  const e = mesa();
  const caos = poner(e, 0, "mano", "Caos");
  assert.equal(N.tiene(e, poner(e, 0, "defensa", "Caos"), "Furia"), true);
  oros(e, 1, 1);
  oros(e, 0, 1);
  assert.equal(costeDe(e, 0, caos).pagar, 3);
  oros(e, 0, 2);
  assert.equal(costeDe(e, 0, caos).pagar, 1);
});

test("Caos: un Oro gana la habilidad de convertirse en Aliado al pagarlo", { todo: "evento: cuando pagas un Oro (habilidad otorgada a un Oro que lo convierte en Aliado)" }, () => {});

test("Carmilla: tiene Exhumar y al entrar puede Destruir una carta de coste 3 o menos y Robar una carta", () => {
  let e = mesa();
  oros(e, 0, 2);
  const car = poner(e, 0, "mano", "Carmilla");
  const r = poner(e, 1, "defensa", "Bokrug");
  e = sinRespuesta(aplicar(e, jugar(car)));
  assert.equal(N.tiene(e, car, "Exhumar"), true);
  e = elegir(e, true);
  e = elegir(e, r);
  assert.equal(zonaDe(e, r), "cementerio");
  assert.equal(e.jugadores[0].mano.length, 1);
});

test("Carmilla: una vez en tu turno Destierra una copia de la carta nombrada de la mano o Castillo oponente", () => {
  let e = mesa();
  const car = poner(e, 0, "defensa", "Carmilla");
  const enMano = poner(e, 1, "mano", "Valefor");
  const enCastillo = poner(e, 1, "castillo", "Bokrug");
  e = hacer(e, habilidad(car, "Carmilla"), enCastillo);
  assert.equal(zonaDe(e, enCastillo), "destierro");
  assert.equal(zonaDe(e, enMano), "mano");
  assert.equal(puedeUsar(e, car), false);
});

test("Chashkel: tiene Exhumar y al entrar puede Botar tres cartas para Barajar una carta oponente de coste 2 o menos", () => {
  let e = mesa();
  oros(e, 0, 1);
  const ch = poner(e, 0, "mano", "Chashkel");
  const r = poner(e, 1, "defensa", "Valefor");
  e = sinRespuesta(aplicar(e, jugar(ch)));
  assert.equal(N.tiene(e, ch, "Exhumar"), true);
  e = elegir(e, true);
  assert.equal(zonaDe(e, r), "castillo");
  assert.equal(e.jugadores[0].castillo.length, 27);
  assert.equal(e.jugadores[0].cementerio.length, 3);
});

test("Chashkel: una vez en tu turno pone una carta de un Castillo en el Cementerio de su dueño", () => {
  let e = mesa();
  const ch = poner(e, 0, "defensa", "Chashkel");
  const b = poner(e, 1, "castillo", "Bokrug");
  e = hacer(e, habilidad(ch, "Chashkel"), "Castillo oponente", b);
  assert.equal(zonaDe(e, b), "cementerio");
  assert.equal(e.jugadores[1].cementerio.includes(b), true);
  assert.equal(puedeUsar(e, ch), false);
});

test("Chinivilu: hasta tres veces por turno paga un Oro para Robar dos cartas", () => {
  let e = mesa();
  const ch = poner(e, 0, "defensa", "Chinivilu");
  oros(e, 0, 4);
  for (let i = 0; i < 3; i++) e = hacer(e, habilidad(ch, "Chinivilu"), "Pagar un Oro");
  assert.equal(e.jugadores[0].mano.length, 6);
  assert.equal(e.jugadores[0].pagado.length, 3);
  assert.equal(puedeUsar(e, ch), false);
});

test("Chinivilu: también puede Destruir un Oro que controles para Robar dos cartas", () => {
  let e = mesa();
  const ch = poner(e, 0, "defensa", "Chinivilu");
  const [o] = oros(e, 0, 1);
  e = hacer(e, habilidad(ch, "Chinivilu"), "Destruir un Oro que controles");
  assert.equal(zonaDe(e, o), "cementerio");
  assert.equal(e.jugadores[0].mano.length, 2);
});

test("Chinivilu: cuando sale del juego puede buscar una copia en tu Castillo y jugarla sin pagar su coste", () => {
  let e = mesa();
  const azi = poner(e, 0, "defensa", "Azi Dahaka");
  const ch = poner(e, 0, "defensa", "Chinivilu");
  const copia = poner(e, 0, "castillo", "Chinivilu");
  e = hacer(e, habilidad(azi, "Azi Dahaka"), "Destruir una carta que no sea Oro", ch, true, copia);
  assert.equal(zonaDe(e, ch), "cementerio");
  assert.equal(zonaDe(e, copia), "defensa");
});

test("Come Tiempo: tiene Furia e Imbloqueable y reduce su coste por cada Oro, hasta un mínimo de 2", () => {
  const e = mesa();
  const ct = poner(e, 0, "mano", "Come Tiempo");
  const enJuego = poner(e, 0, "defensa", "Come Tiempo");
  assert.equal(N.tiene(e, enJuego, "Furia"), true);
  assert.equal(N.tiene(e, enJuego, "Imbloqueable"), true);
  assert.equal(costeDe(e, 0, ct).pagar, 7);
  oros(e, 0, 3);
  assert.equal(costeDe(e, 0, ct).pagar, 4);
  oros(e, 0, 5);
  assert.equal(costeDe(e, 0, ct).pagar, 2);
});

test("Come Tiempo: cuando sale del juego Robas dos cartas", () => {
  let e = mesa();
  const azi = poner(e, 0, "defensa", "Azi Dahaka");
  const ct = poner(e, 0, "defensa", "Come Tiempo");
  e = hacer(e, habilidad(azi, "Azi Dahaka"), "Destruir una carta que no sea Oro", ct);
  assert.equal(zonaDe(e, ct), "cementerio");
  assert.equal(e.jugadores[0].mano.length, 4);
});

test("Cristalino Amarillo: con cuatro o más Oros, en tu Vigilia Baraja hasta dos cartas de tu Cementerio y Roba dos", () => {
  let e = mesa();
  const cr = poner(e, 0, "defensa", "Cristalino Amarillo");
  const c = [1, 2, 3].map(() => poner(e, 0, "cementerio", "Valefor"));
  oros(e, 0, 3);
  assert.equal(puedeUsar(e, cr), false);
  oros(e, 0, 1);
  e = hacer(e, habilidad(cr, "Cristalino Amarillo"), c[0], c[1]);
  assert.deepEqual(c.map((u) => zonaDe(e, u)).filter((z) => z === "cementerio").length, 1);
  assert.equal(e.jugadores[0].mano.length, 2);
  assert.equal(puedeUsar(e, cr), false);
});

test("Cuchivilu: reduce su coste por cada Oro, hasta un mínimo de 1", () => {
  const e = mesa();
  const cu = poner(e, 0, "mano", "Cuchivilu");
  assert.equal(costeDe(e, 0, cu).pagar, 4);
  oros(e, 0, 2);
  assert.equal(costeDe(e, 0, cu).pagar, 2);
  oros(e, 0, 3);
  assert.equal(costeDe(e, 0, cu).pagar, 1);
});

test("Cuchivilu: al entrar Destruye una carta oponente de coste 2 o menos por cada Oro que pagues, hasta tres", () => {
  let e = mesa();
  oros(e, 0, 3);
  const cu = poner(e, 0, "mano", "Cuchivilu");
  const r = [1, 2, 3].map(() => poner(e, 1, "defensa", "Valefor"));
  e = sinRespuesta(aplicar(e, jugar(cu)));
  assert.equal(e.jugadores[0].reserva.length, 2);
  e = hacer(e, { tipo: "elegir", i: e.pendiente.opciones.findIndex((o) => o.texto === "Pagar 2 Oros") }, r[0], r[1]);
  assert.deepEqual(r.map((u) => zonaDe(e, u)), ["cementerio", "cementerio", "defensa"]);
  assert.equal(e.jugadores[0].reserva.length, 0);
});

test("Cuchivilu: puedes no pagar y no Destruye nada", () => {
  let e = mesa();
  oros(e, 0, 3);
  const cu = poner(e, 0, "mano", "Cuchivilu");
  const r = poner(e, 1, "defensa", "Valefor");
  e = sinRespuesta(aplicar(e, jugar(cu)));
  e = elegir(e, null);
  assert.equal(zonaDe(e, r), "defensa");
  assert.equal(e.jugadores[0].reserva.length, 2);
});

test("Culebron: reduce su coste por cada Oro, hasta un mínimo de 2", () => {
  const e = mesa();
  const cu = poner(e, 0, "mano", "Culebron");
  assert.equal(costeDe(e, 0, cu).pagar, 5);
  oros(e, 0, 6);
  assert.equal(costeDe(e, 0, cu).pagar, 2);
});

test("Culebron: al entrar tu oponente Descarta al azar una carta por cada Oro que pagues, hasta tres", () => {
  let e = mesa();
  oros(e, 0, 5);
  const cu = poner(e, 0, "mano", "Culebron");
  [1, 2, 3, 4].map(() => poner(e, 1, "mano", "Valefor"));
  e = sinRespuesta(aplicar(e, jugar(cu)));
  e = elegir(e, "Pagar 3 Oros");
  assert.equal(e.jugadores[1].mano.length, 1);
  assert.equal(e.jugadores[1].cementerio.length, 3);
  assert.equal(e.jugadores[0].reserva.length, 0);
});

test("Dagon: tiene Furia y al entrar busca una carta Azi en tu Castillo", () => {
  let e = mesa();
  oros(e, 0, 1);
  const dagon = poner(e, 0, "mano", "Dagon");
  const azi = poner(e, 0, "castillo", "Azi del Abismo");
  const v = poner(e, 0, "castillo", "Valefor");
  e = sinRespuesta(aplicar(e, jugar(dagon)));
  assert.equal(N.tiene(e, dagon, "Furia"), true);
  assert.equal(valores(e).includes(v), false);
  e = elegir(e, azi);
  assert.equal(zonaDe(e, azi), "mano");
});

test("Dagon: gana 2 de Fuerza por cada Oro Azi que controles", () => {
  const e = mesa();
  const dagon = poner(e, 0, "defensa", "Dagon");
  oros(e, 0, 2);
  assert.equal(N.fuerza(e, dagon), 2);
  oroAbismo(e, 0);
  oroAbismo(e, 0);
  oroAbismo(e, 1);
  assert.equal(N.fuerza(e, dagon), 6);
});

test("Dagon: se considera Azi en todas las Zonas para las demás cartas", { todo: "clave: se considera de un subtipo (Azi) en todas las Zonas, visible para todas las cartas" }, () => {});

test("Daikaiju Renacido: tiene Furia e Imbloqueable y al hacer daño puede buscar un Aliado en tu Castillo", () => {
  let e = mesa();
  const dk = poner(e, 0, "defensa", "Daikaiju Renacido");
  const v = poner(e, 0, "castillo", "Valefor");
  assert.equal(N.tiene(e, dk, "Furia"), true);
  assert.equal(N.tiene(e, dk, "Imbloqueable"), true);
  e = combate(e, dk);
  e = hacer(e, { tipo: "elegir", i: 0 }, "Buscar un Aliado en tu Castillo", v);
  assert.equal(zonaDe(e, v), "mano");
});

test("Daikaiju Renacido: al hacer daño puede Barajar una carta de coste 2 o menos", () => {
  let e = mesa();
  const dk = poner(e, 0, "defensa", "Daikaiju Renacido");
  const r = poner(e, 1, "defensa", "Valefor");
  e = combate(e, dk);
  e = hacer(e, { tipo: "elegir", i: 0 }, "Barajar una carta de coste 2 o menos", r);
  assert.equal(zonaDe(e, r), "castillo");
});

test("Daikaiju Renacido: en tu Fase Final Baraja y/o Destierra hasta tres cartas de los Cementerios", () => {
  let e = mesa();
  poner(e, 0, "defensa", "Daikaiju Renacido");
  const c = [0, 1, 1, 1].map((j) => poner(e, j, "cementerio", "Valefor"));
  e = aplicar(e, { tipo: "terminar" });
  e = elegir(e, c[0]);
  e = elegir(e, null);
  e = elegir(e, c[1]);
  e = elegir(e, c[2]);
  assert.deepEqual(c.map((u) => zonaDe(e, u)), ["castillo", "destierro", "destierro", "cementerio"]);
});

test("Demonio Tenebris: tiene Exhumar e Indesterrable", () => {
  const e = mesa();
  const d = poner(e, 0, "defensa", "Demonio Tenebris");
  assert.equal(N.tiene(e, d, "Exhumar"), true);
  assert.equal(N.tiene(e, d, "Indesterrable"), true);
});

test("Demonio Tenebris: en tu Vigilia Destierra una carta, del tope de un Castillo tantas como coste de una carta que controles, y Roba hasta tres", () => {
  let e = mesa();
  const d = poner(e, 0, "defensa", "Demonio Tenebris");
  const bok = poner(e, 0, "defensa", "Bokrug");
  const r = poner(e, 1, "defensa", "Valefor");
  e = hacer(e, habilidad(d, "Demonio Tenebris"), r, bok, "Castillo oponente", 3);
  assert.equal(zonaDe(e, r), "destierro");
  assert.equal(e.jugadores[1].destierro.length, 4);
  assert.equal(e.jugadores[1].castillo.length, 27);
  assert.equal(e.jugadores[0].mano.length, 3);
  assert.equal(puedeUsar(e, d), false);
});

test("Demonio Tenebris: tus Aliados de coste 2 o más que entran ganan Furia y los de coste 1 no", () => {
  let e = mesa();
  poner(e, 0, "defensa", "Demonio Tenebris");
  oros(e, 0, 4);
  const bok = poner(e, 0, "mano", "Bokrug");
  const abismo = poner(e, 0, "mano", "Azi del Abismo");
  e = sinRespuesta(aplicar(e, jugar(bok)));
  e = sinRespuesta(aplicar(e, jugar(abismo)));
  assert.equal(N.tiene(e, bok, "Furia"), true);
  assert.equal(N.tiene(e, abismo, "Furia"), false);
  assert.equal(accionesLegales(e).find((a) => a.tipo === "batalla") !== undefined, true);
  e = aplicar(e, { tipo: "batalla" });
  const atacables = accionesLegales(e).filter((a) => a.tipo === "atacar").map((a) => a.uid);
  assert.equal(atacables.includes(bok), true);
  assert.equal(atacables.includes(abismo), false);
});

test("Demonio Tenebris: tus Aliados de coste 2 o más no son afectados por Oros ni Tótems oponentes", () => {
  const e = mesa();
  poner(e, 0, "defensa", "Demonio Tenebris");
  const bok = poner(e, 0, "defensa", "Bokrug");
  const abismo = poner(e, 0, "defensa", "Azi del Abismo");
  const totem = poner(e, 1, "apoyo", "Carcosa");
  const oro = poner(e, 1, "reserva", "Cráneo de Cristal");
  const tal = poner(e, 1, "mano", "Dragón Dorado");
  assert.equal(cumple(e, ctxDe(e, totem, 1), bok, {}, "destruir"), false);
  assert.equal(cumple(e, ctxDe(e, oro, 1), bok, {}, "destruir"), false);
  assert.equal(cumple(e, ctxDe(e, tal, 1), bok, {}, "destruir"), true);
  assert.equal(cumple(e, ctxDe(e, totem, 1), abismo, {}, "destruir"), true);
  assert.equal(cumple(e, ctxDe(e, oro, 1), abismo, {}, "destruir"), true);
});

test("Dracu: tiene Furia, hace daño al Destierro y al entrar busca un Oro o Aliado que no sea Dracu en tu Castillo o Cementerio", () => {
  let e = mesa();
  oros(e, 0, 1);
  const dracu = poner(e, 0, "mano", "Dracu");
  const otro = poner(e, 0, "cementerio", "Dracu");
  const v = poner(e, 0, "cementerio", "Valefor");
  e = sinRespuesta(aplicar(e, jugar(dracu)));
  assert.equal(N.tiene(e, dracu, "Furia"), true);
  assert.equal(N.tiene(e, dracu, "DanoAlDestierro"), true);
  assert.equal(valores(e).includes(otro), false);
  e = elegir(e, v);
  assert.equal(zonaDe(e, v), "mano");
});

test("Dragones de la Reina: no se puede Anular y reduce su coste en dos si tienes tres o más Aliados en tu Cementerio", () => {
  const e = mesa();
  const dr = poner(e, 0, "mano", "Dragones de la Reina");
  assert.equal(N.carta(e, dr).claves.includes("NoAnulable"), true);
  assert.equal(costeDe(e, 0, dr).pagar, 4);
  [1, 2, 3].forEach(() => poner(e, 0, "cementerio", "Valefor"));
  assert.equal(costeDe(e, 0, dr).pagar, 2);
});

test("Dragones de la Reina: al entrar un Aliado gana Imbloqueable y tu oponente Bota una carta por cada Oro que controles", () => {
  let e = mesa();
  oros(e, 0, 4);
  const dr = poner(e, 0, "mano", "Dragones de la Reina");
  const v = poner(e, 0, "defensa", "Valefor");
  e = sinRespuesta(aplicar(e, jugar(dr)));
  e = elegir(e, v);
  assert.equal(N.tiene(e, v, "Imbloqueable"), true);
  assert.equal(e.jugadores[1].castillo.length, 26);
});

test("Dragones de la Reina: también al atacar", () => {
  let e = mesa();
  oros(e, 0, 2);
  const dr = poner(e, 0, "defensa", "Dragones de la Reina");
  e = atacar(e, dr);
  assert.equal(N.tiene(e, dr, "Imbloqueable"), true);
  assert.equal(e.jugadores[1].castillo.length, 28);
});

test("Dragón Nival: al entrar Destruye todos los Aliados en juego de Fuerza 2 o menos", () => {
  let e = mesa();
  oros(e, 0, 4);
  const nival = poner(e, 0, "mano", "Dragón Nival");
  const dagon = poner(e, 0, "defensa", "Dagon");
  const ch = poner(e, 1, "defensa", "Chashkel");
  const v = poner(e, 1, "defensa", "Valefor");
  e = sinRespuesta(aplicar(e, jugar(nival)));
  assert.equal(zonaDe(e, dagon), "cementerio");
  assert.equal(zonaDe(e, ch), "cementerio");
  assert.equal(zonaDe(e, v), "defensa");
  assert.equal(zonaDe(e, nival), "defensa");
});

test("Dragón de Magma: al entrar Destruye un Aliado oponente en juego", () => {
  let e = mesa();
  oros(e, 0, 4);
  const magma = poner(e, 0, "mano", "Dragón de Magma");
  const mio = poner(e, 0, "defensa", "Valefor");
  const r1 = poner(e, 1, "defensa", "Valefor");
  const r2 = poner(e, 1, "defensa", "Bokrug");
  e = sinRespuesta(aplicar(e, jugar(magma)));
  e = elegir(e, r2);
  assert.equal(zonaDe(e, r2), "cementerio");
  assert.equal(zonaDe(e, r1), "defensa");
  assert.equal(zonaDe(e, mio), "defensa");
});
