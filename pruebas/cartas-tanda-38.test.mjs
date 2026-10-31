import { test } from "node:test";
import assert from "node:assert/strict";
import { mesa, poner, oros, hacer, elegir, sinRespuesta, accionesLegales, aplicar, zonaDe, id, N } from "./ayuda-duelo.mjs";
import { costeDe } from "../web/duelo/motor.js";
import { armaCabe, disponibles } from "../web/duelo/efectos.js";

const jugar = (uid, extra = {}) => ({ tipo: "jugar", uid, ...extra });
const habilidad = (uid, nombre, h = 0) => ({ tipo: "habilidad", uid, def: id(nombre), h });
const puedeUsar = (e, uid) => accionesLegales(e).some((a) => a.tipo === "habilidad" && a.uid === uid);
const con = (e, ...preds) => preds.reduce((s, p) => elegir(s, p), e);
const atacables = (e) => accionesLegales(e).filter((a) => a.tipo === "atacar").map((a) => a.uid);

function resolverTodo(e) {
  for (let i = 0; i < 40 && e.pendiente; i++) e = aplicar(e, { tipo: "elegir", i: e.pendiente.opciones.length - 1 });
  return e;
}

function alTope(e, j, nombre) {
  const uid = poner(e, j, "castillo", nombre);
  N.sacar(e, uid);
  e.jugadores[j].castillo.unshift(uid);
  return uid;
}

function pasarTurno(e) {
  return resolverTodo(aplicar(e, { tipo: "terminar" }));
}

function aGuerra(e, atacante) {
  e = aplicar(e, { tipo: "batalla" });
  e = aplicar(e, { tipo: "atacar", uid: atacante });
  if (e.pendiente) e = elegir(e, false);
  e = aplicar(e, { tipo: "finAtaque" });
  return aplicar(e, { tipo: "finBloqueo" });
}

function hastaDano(e) {
  const antes = e.registro.length;
  for (let i = 0; i < 30 && e.registro.length === antes && !e.pendiente; i++) {
    const l = accionesLegales(e);
    e = aplicar(e, l.find((x) => ["finBloqueo", "pasar", "noResponder"].includes(x.tipo)) ?? l[0]);
  }
  return e;
}

test("Daiksuke: al entrar busca un Arma o Tótem para tu Cementerio y luego sube una carta que no sea Talismán", () => {
  let e = mesa();
  oros(e, 0, 1);
  const d = poner(e, 0, "mano", "Daiksuke");
  const p = poner(e, 0, "castillo", "Pedrenyal");
  const ww = poner(e, 0, "cementerio", "White Worm");
  e = sinRespuesta(aplicar(e, jugar(d)));
  e = con(e, p, "Subir una carta que no sea Talismán de tu Cementerio a tu mano", ww);
  assert.equal(zonaDe(e, p), "cementerio");
  assert.equal(zonaDe(e, ww), "mano");
});

test("Daiksuke: al entrar puede Robar una carta en vez de subir", () => {
  let e = mesa();
  oros(e, 0, 1);
  const d = poner(e, 0, "mano", "Daiksuke");
  e = sinRespuesta(aplicar(e, jugar(d)));
  e = elegir(e, "Robar una carta");
  assert.equal(e.jugadores[0].mano.length, 1);
});

test("Daiksuke: puesto en tu Cementerio durante el turno oponente se juega por un Oro menos", () => {
  let e = mesa();
  e.activo = 1;
  oros(e, 0, 1);
  oros(e, 1, 1);
  const d = poner(e, 0, "defensa", "Daiksuke");
  const lucy = poner(e, 1, "mano", "Regresa Lucy");
  e = sinRespuesta(aplicar(e, jugar(lucy)));
  e = elegir(e, d);
  assert.equal(e.pendiente.jugador, 0);
  e = elegir(e, true);
  e = elegir(e, "Robar una carta");
  assert.equal(zonaDe(e, d), "defensa");
  assert.equal(e.jugadores[0].reserva.length, 0);
  assert.equal(e.jugadores[0].jugadas.Aliado, 1);
});

test("Daiksuke: en tu propio turno no se vuelve a jugar desde el Cementerio", () => {
  let e = mesa();
  oros(e, 0, 2);
  const d = poner(e, 0, "defensa", "Daiksuke");
  const lucy = poner(e, 0, "mano", "Regresa Lucy");
  e = sinRespuesta(aplicar(e, jugar(lucy)));
  e = elegir(e, d);
  assert.equal(e.pendiente, null);
  assert.equal(zonaDe(e, d), "cementerio");
});

test("Daisuke Tokugawa: Indestructible y no puede perder su habilidad", () => {
  const e = mesa();
  const d = poner(e, 0, "defensa", "Daisuke Tokugawa");
  assert.equal(N.tiene(e, d, "Indestructible"), true);
  assert.equal(N.tiene(e, d, "NoPierdeHabilidad"), true);
});

test("Daisuke Tokugawa: al entrar Destruye una carta de coste 2 o menos", () => {
  let e = mesa();
  oros(e, 0, 1);
  const d = poner(e, 0, "mano", "Daisuke Tokugawa");
  const ww = poner(e, 1, "defensa", "White Worm");
  e = sinRespuesta(aplicar(e, jugar(d)));
  e = con(e, "Destruir una carta de coste 2 o menos", ww);
  assert.equal(zonaDe(e, ww), "cementerio");
});

test("Daisuke Tokugawa: al entrar puede buscar una carta que no sea Talismán", () => {
  let e = mesa();
  oros(e, 0, 1);
  const d = poner(e, 0, "mano", "Daisuke Tokugawa");
  const isla = poner(e, 0, "castillo", "Isla de Poveglia");
  e = sinRespuesta(aplicar(e, jugar(d)));
  e = con(e, "Buscar una carta que no sea Talismán", isla);
  assert.equal(zonaDe(e, isla), "mano");
});

test("Daisuke Tokugawa: no se puede atacar con más de un Aliado", () => {
  let e = mesa();
  poner(e, 0, "defensa", "Daisuke Tokugawa");
  const ww = poner(e, 0, "defensa", "White Worm");
  poner(e, 0, "defensa", "El Dracul");
  e = aplicar(e, { tipo: "batalla" });
  assert.equal(atacables(e).length, 3);
  e = aplicar(e, { tipo: "atacar", uid: ww });
  assert.deepEqual(atacables(e), []);
});

test("Daisuke Tokugawa: puedes jugarlo al comienzo del Bloqueo", { todo: "momento: jugar un Aliado al comienzo del Bloqueo" }, () => {});

test("Elias: Indestructible, no puede atacar en tu turno pero sí bloquear", () => {
  let e = mesa();
  const elias = poner(e, 0, "defensa", "Elias");
  assert.equal(N.tiene(e, elias, "Indestructible"), true);
  e = pasarTurno(pasarTurno(e));
  assert.equal(e.activo, 0);
  assert.equal(accionesLegales(e).some((a) => a.tipo === "batalla"), false);
  e = pasarTurno(e);
  const ww = poner(e, 1, "defensa", "White Worm");
  e = aplicar(e, { tipo: "batalla" });
  e = aplicar(e, { tipo: "atacar", uid: ww });
  e = aplicar(e, { tipo: "finAtaque" });
  assert.ok(accionesLegales(e).some((a) => a.tipo === "bloquear" && a.uid === elias));
});

test("Elias: puede bloquear hasta dos Aliados", { todo: "restricción: un Aliado puede bloquear a varios atacantes" }, () => {});
test("Elias: no recibes daño de Aliados bloqueados por él", { todo: "efecto: no recibes daño de combate de los Aliados bloqueados por un Aliado" }, () => {});
test("Elias: cuando bloquee Roba una carta por cada Aliado bloqueado", { todo: "disparo: al bloquear" }, () => {});

test("Elijah: al entrar puedes Robar una carta y un Aliado gana 2 de Fuerza", () => {
  let e = mesa();
  oros(e, 0, 1);
  const el = poner(e, 0, "mano", "Elijah");
  const ww = poner(e, 0, "defensa", "White Worm");
  e = sinRespuesta(aplicar(e, jugar(el)));
  e = con(e, true, ww);
  assert.equal(e.jugadores[0].mano.length, 1);
  assert.equal(N.fuerza(e, ww), 6);
  assert.equal(N.tiene(e, el, "Indestructible"), true);
});

test("Elijah: tu oponente debe atacar cada turno si puede", () => {
  const e = mesa();
  poner(e, 0, "defensa", "Elijah");
  poner(e, 1, "defensa", "White Worm");
  e.activo = 1;
  const l = accionesLegales(e);
  assert.ok(l.some((a) => a.tipo === "batalla"));
  assert.equal(l.some((a) => a.tipo === "terminar"), false);
});

test("Elijah: puedes jugarlo al comienzo del Bloqueo", { todo: "momento: jugar un Aliado al comienzo del Bloqueo" }, () => {});
test("Elijah: puede bloquear Aliados Imbloqueables", { todo: "bloqueo: permitir bloquear Aliados Imbloqueables" }, () => {});

test("Endimion: una vez por turno un Aliado Héroe gana 1 de Fuerza por cada Oro en el Oro Pagado oponente", () => {
  let e = mesa();
  const en = poner(e, 0, "defensa", "Endimion");
  const kai = poner(e, 0, "defensa", "Kai Piloto Prodigio");
  const ww = poner(e, 0, "defensa", "White Worm");
  for (let i = 0; i < 3; i++) poner(e, 1, "pagado", "Drácula");
  e = aplicar(e, habilidad(en, "Endimion"));
  assert.equal(e.pendiente.opciones.some((o) => o.valor === ww), false);
  e = elegir(e, kai);
  assert.equal(N.fuerza(e, kai), 5);
  assert.equal(puedeUsar(e, en), false);
});

test("Endimion: no puedes controlar más copias de esta carta", { todo: "restricción: Única para cartas que no son Oro" }, () => {});
test("Endimion: si controlas dos o más Aliados, en el turno oponente poner Oros cuesta un Oro adicional", { todo: "efecto: poner Oros en juego cuesta un Oro adicional al oponente" }, () => {});

test("Enoc: si no controlas más de un Aliado reduce su coste en un Oro", () => {
  const e = mesa();
  const enoc = poner(e, 0, "mano", "Enoc");
  assert.equal(costeDe(e, 0, enoc).pagar, 2);
  poner(e, 0, "defensa", "White Worm");
  assert.equal(costeDe(e, 0, enoc).pagar, 2);
  poner(e, 0, "defensa", "El Dracul");
  assert.equal(costeDe(e, 0, enoc).pagar, 3);
});

test("Enoc: al entrar Destruye todas las cartas en juego que no sean Oro y tus Héroes son Indestructibles", () => {
  let e = mesa();
  oros(e, 0, 3);
  const enoc = poner(e, 0, "mano", "Enoc");
  const dai = poner(e, 0, "defensa", "Daiksuke");
  const ww = poner(e, 1, "defensa", "White Worm");
  const templo = poner(e, 1, "apoyo", "Templo Gótico");
  e = sinRespuesta(aplicar(e, jugar(enoc)));
  assert.equal(zonaDe(e, ww), "cementerio");
  assert.equal(zonaDe(e, templo), "cementerio");
  assert.equal(zonaDe(e, dai), "defensa");
  assert.equal(zonaDe(e, enoc), "defensa");
  assert.equal(e.jugadores[0].pagado.length, 2);
  assert.equal(N.tiene(e, dai, "Indestructible"), true);
});

test("Enoc: una vez por turno Roba dos cartas y un Aliado hace doble daño de combate", () => {
  let e = mesa();
  const enoc = poner(e, 0, "defensa", "Enoc");
  const ww = poner(e, 0, "defensa", "White Worm");
  e = hacer(e, habilidad(enoc, "Enoc"), ww);
  assert.equal(e.jugadores[0].mano.length, 2);
  assert.equal(N.fuerza(e, ww), 4);
  assert.equal(N.tiene(e, ww, "Indestructible"), false);
  e = hastaDano(aGuerra(e, ww));
  assert.equal(e.jugadores[1].castillo.length, 22);
});

test("General Washington: en tu Vigilia juega un Aliado de tu Cementerio por un Oro menos", () => {
  let e = mesa();
  oros(e, 0, 1);
  const gw = poner(e, 0, "defensa", "General Washington");
  const ww = poner(e, 0, "cementerio", "White Worm");
  assert.equal(N.tiene(e, gw, "Indestructible"), true);
  e = aplicar(e, habilidad(gw, "General Washington"));
  assert.equal(zonaDe(e, ww), "defensa");
  assert.equal(e.jugadores[0].reserva.length, 0);
  assert.equal(puedeUsar(e, gw), false);
});

test("General Washington: juega un Arma de tu mano por un Oro menos (mínimo 1)", () => {
  let e = mesa();
  oros(e, 0, 1);
  const gw = poner(e, 0, "defensa", "General Washington");
  const p = poner(e, 0, "mano", "Pedrenyal");
  e = aplicar(e, habilidad(gw, "General Washington"));
  assert.equal(zonaDe(e, p), "arma");
  assert.equal(N.portadorDe(e, p), gw);
  assert.equal(e.jugadores[0].reserva.length, 0);
});

test("General Washington: no puede jugar otro General Washington", () => {
  const e = mesa();
  oros(e, 0, 2);
  const gw = poner(e, 0, "defensa", "General Washington");
  poner(e, 0, "cementerio", "General Washington");
  assert.equal(puedeUsar(e, gw), false);
});

test("General Washington: Baraja una carta de tu mano para Anular una carta de coste 2 o menos", { todo: "respuesta: Anular con una habilidad activada de una carta en juego" }, () => {});

test("Heracles: al entrar hasta dos Héroes ganan 2 de Fuerza", () => {
  let e = mesa();
  oros(e, 0, 3);
  const h = poner(e, 0, "mano", "Heracles");
  const kai = poner(e, 0, "defensa", "Kai Piloto Prodigio");
  const dai = poner(e, 0, "defensa", "Daiksuke");
  poner(e, 0, "defensa", "White Worm");
  e = sinRespuesta(aplicar(e, jugar(h)));
  e = con(e, kai, dai);
  assert.equal(N.fuerza(e, kai), 4);
  assert.equal(N.fuerza(e, dai), 5);
});

test("Heracles: los Héroes que controles hacen doble daño de combate", () => {
  let e = mesa();
  poner(e, 0, "defensa", "Heracles");
  const kai = poner(e, 0, "defensa", "Kai Piloto Prodigio");
  e = hastaDano(aGuerra(e, kai));
  assert.equal(e.jugadores[1].castillo.length, 26);
});

test("Heracles: los no Héroes no hacen doble daño", () => {
  let e = mesa();
  poner(e, 0, "defensa", "Heracles");
  const ww = poner(e, 0, "defensa", "White Worm");
  e = hastaDano(aGuerra(e, ww));
  assert.equal(e.jugadores[1].castillo.length, 26);
});

test("Heracles: sólo puedes controlar una copia", { todo: "restricción: Única para cartas que no son Oro" }, () => {});
test("Heracles: Talismanes y habilidades oponentes que hagan objetivo a tus Héroes cuestan un Oro adicional", { todo: "efecto: afectar a tus Aliados de una raza cuesta un Oro adicional al oponente" }, () => {});

test("Hipolito Villegas: al entrar puedes Destruir hasta dos cartas de coste 2", () => {
  let e = mesa();
  oros(e, 0, 3);
  const h = poner(e, 0, "mano", "Hipolito Villegas");
  const ww = poner(e, 1, "defensa", "White Worm");
  const gr = poner(e, 1, "defensa", "Guardia Real");
  const dr = poner(e, 1, "defensa", "El Dracul");
  e = sinRespuesta(aplicar(e, jugar(h)));
  e = con(e, true, ww, gr);
  assert.equal(zonaDe(e, ww), "cementerio");
  assert.equal(zonaDe(e, gr), "cementerio");
  assert.equal(zonaDe(e, dr), "defensa");
  assert.equal(N.tiene(e, h, "Indestructible"), true);
});

test("Hipolito Villegas: cuando atacas con un solo Aliado puedes Destruir hasta dos cartas de coste 2", () => {
  let e = mesa();
  const h = poner(e, 0, "defensa", "Hipolito Villegas");
  poner(e, 0, "defensa", "El Dracul");
  const ww = poner(e, 1, "defensa", "White Worm");
  e = aplicar(e, { tipo: "batalla" });
  e = aplicar(e, { tipo: "atacar", uid: h });
  e = hacer(e, { tipo: "elegir", i: 0 }, ww);
  assert.equal(zonaDe(e, ww), "cementerio");
  assert.deepEqual(atacables(e), []);
});

test("Hipolito Villegas: puedes jugarlo al comienzo del Bloqueo reduciendo su coste", { todo: "momento: jugar un Aliado al comienzo del Bloqueo" }, () => {});

test("Hombre Invisible: Imbloqueable y una vez por turno un Aliado gana 2 de Fuerza", () => {
  let e = mesa();
  const hi = poner(e, 0, "defensa", "Hombre Invisible");
  assert.equal(N.tiene(e, hi, "Imbloqueable"), true);
  e = aplicar(e, habilidad(hi, "Hombre Invisible"));
  assert.equal(N.fuerza(e, hi), 4);
  assert.equal(puedeUsar(e, hi), false);
});

test("Hombre Invisible: al atacar solo puede agruparse para que el oponente Bote su Fuerza y atacar con otro", () => {
  let e = mesa();
  const hi = poner(e, 0, "defensa", "Hombre Invisible");
  const ww = poner(e, 0, "defensa", "White Worm");
  e = aplicar(e, { tipo: "batalla" });
  e = aplicar(e, { tipo: "atacar", uid: hi });
  e = elegir(e, true);
  assert.equal(e.jugadores[1].cementerio.length, 2);
  assert.equal(zonaDe(e, hi), "defensa");
  assert.deepEqual(atacables(e), [ww]);
});

test("Huaso Bueras: al atacar solo elige un coste y Baraja todas las cartas oponentes de ese coste", () => {
  let e = mesa();
  const hb = poner(e, 0, "defensa", "Huaso Bueras");
  const ww = poner(e, 1, "defensa", "White Worm");
  const gr = poner(e, 1, "defensa", "Guardia Real");
  const dr = poner(e, 1, "defensa", "El Dracul");
  assert.equal(N.tiene(e, hb, "Furia"), true);
  e = aplicar(e, { tipo: "batalla" });
  e = aplicar(e, { tipo: "atacar", uid: hb });
  e = hacer(e, { tipo: "elegir", i: 0 }, "Coste 2");
  assert.equal(zonaDe(e, ww), "castillo");
  assert.equal(zonaDe(e, gr), "castillo");
  assert.equal(zonaDe(e, dr), "defensa");
});

test("Huaso Bueras: no puede ser afectado por Talismanes", { todo: "protección: no puede ser afectado por Talismanes" }, () => {});
test("Huaso Bueras: no se pueden jugar cartas del coste elegido hasta tu próximo turno", { todo: "efecto: no se pueden jugar cartas de un coste nombrado durante un período" }, () => {});

test("Husares de la Muerte: al entrar busca un Aliado en tu Castillo", () => {
  let e = mesa();
  oros(e, 0, 2);
  const hu = poner(e, 0, "mano", "Husares de la Muerte");
  const ww = poner(e, 0, "castillo", "White Worm");
  e = sinRespuesta(aplicar(e, jugar(hu)));
  e = elegir(e, ww);
  assert.equal(zonaDe(e, ww), "mano");
});

test("Husares de la Muerte: tus Héroes no salen del juego en la Batalla", () => {
  let e = mesa();
  e.activo = 1;
  poner(e, 0, "defensa", "Husares de la Muerte");
  const dai = poner(e, 0, "defensa", "Daiksuke");
  const ww = poner(e, 1, "defensa", "White Worm");
  assert.equal(N.tiene(e, dai, "NoSale"), false);
  e = aplicar(e, { tipo: "batalla" });
  e = aplicar(e, { tipo: "atacar", uid: ww });
  e = aplicar(e, { tipo: "finAtaque" });
  e = aplicar(e, { tipo: "bloquear", uid: dai, atacante: ww });
  e = hastaDano(aplicar(e, { tipo: "finBloqueo" }));
  assert.equal(zonaDe(e, dai), "defensa");
});

test("Husares de la Muerte: puedes jugar tus Aliados al comienzo del Bloqueo", { todo: "momento: jugar un Aliado al comienzo del Bloqueo" }, () => {});
test("Husares de la Muerte: tus Aliados no pueden ser Anulados", { todo: "protección: tus Aliados no pueden ser Anulados" }, () => {});

test("Ignacio de la Carrera: si busca un Carrera genera un Oro para jugar Aliados", () => {
  let e = mesa();
  oros(e, 0, 1);
  const ig = poner(e, 0, "mano", "Ignacio de la Carrera");
  const luis = poner(e, 0, "castillo", "Luis Carrera");
  e = sinRespuesta(aplicar(e, jugar(ig)));
  e = elegir(e, luis);
  assert.equal(zonaDe(e, luis), "mano");
  assert.equal(disponibles(e, 0, "Aliado"), 1);
  assert.equal(disponibles(e, 0, "Talismán"), 0);
  assert.equal(N.tiene(e, ig, "Indestructible"), true);
});

test("Ignacio de la Carrera: si busca otro Aliado no genera Oro", () => {
  let e = mesa();
  oros(e, 0, 1);
  const ig = poner(e, 0, "mano", "Ignacio de la Carrera");
  const ww = poner(e, 0, "castillo", "White Worm");
  e = sinRespuesta(aplicar(e, jugar(ig)));
  e = elegir(e, ww);
  assert.equal(disponibles(e, 0, "Aliado"), 0);
});

test("Ignacio de la Carrera: el Oro generado solo sirve para Aliados de coste 2 o más", { todo: "generar: Oro generado restringido a cartas de coste mínimo" }, () => {});

test("Jafet: al entrar puedes Desterrar hasta cinco cartas de los Cementerios y Robar tres", () => {
  let e = mesa();
  oros(e, 0, 3);
  const jf = poner(e, 0, "mano", "Jafet");
  const a = poner(e, 0, "cementerio", "White Worm");
  const b = poner(e, 1, "cementerio", "White Worm");
  const c = poner(e, 1, "cementerio", "El Dracul");
  e = sinRespuesta(aplicar(e, jugar(jf)));
  e = con(e, true, a, b, null, "Desterrar");
  assert.equal(zonaDe(e, a), "destierro");
  assert.equal(zonaDe(e, b), "destierro");
  assert.equal(zonaDe(e, c), "cementerio");
  assert.equal(e.jugadores[0].mano.length, 3);
});

test("Jafet: desde tu mano, Desterrándolo y pagando dos Oros, hasta dos Aliados no pueden salir del juego", () => {
  let e = mesa();
  oros(e, 0, 2);
  const jf = poner(e, 0, "mano", "Jafet");
  const ww = poner(e, 0, "defensa", "White Worm");
  const dr = poner(e, 0, "defensa", "El Dracul");
  e = hacer(e, habilidad(jf, "Jafet"), ww, dr);
  assert.equal(zonaDe(e, jf), "destierro");
  assert.equal(e.jugadores[0].reserva.length, 0);
  assert.equal(N.puedeSalir(e, ww), false);
  assert.equal(N.puedeSalir(e, dr), false);
});

test("Javiera Carrera: una vez por turno un Aliado duplica su Fuerza", () => {
  let e = mesa();
  const jv = poner(e, 0, "defensa", "Javiera Carrera");
  const ww = poner(e, 0, "defensa", "White Worm");
  e = hacer(e, habilidad(jv, "Javiera Carrera"), ww);
  assert.equal(N.fuerza(e, ww), 8);
  assert.equal(N.puedeSalir(e, ww), true);
  assert.equal(puedeUsar(e, jv), true);
  assert.equal(accionesLegales(e).some((a) => a.tipo === "habilidad" && a.uid === jv && a.h === 0), false);
});

test("Javiera Carrera: si es un Carrera triplica su Fuerza y no puede salir del juego", () => {
  let e = mesa();
  const jv = poner(e, 0, "defensa", "Javiera Carrera");
  const luis = poner(e, 0, "defensa", "Luis Carrera");
  e = hacer(e, habilidad(jv, "Javiera Carrera"), luis);
  assert.equal(N.fuerza(e, luis), 6);
  assert.equal(N.puedeSalir(e, luis), false);
});

test("Javiera Carrera: una vez en tu Vigilia Destierra hasta tres cartas de un Cementerio y Roba una", () => {
  let e = mesa();
  const jv = poner(e, 0, "defensa", "Javiera Carrera");
  const c = [1, 2, 3, 4].map(() => poner(e, 1, "cementerio", "White Worm"));
  e = hacer(e, habilidad(jv, "Javiera Carrera", 1), "Cementerio oponente", c[0], c[1], c[2]);
  assert.deepEqual(c.map((u) => zonaDe(e, u)), ["destierro", "destierro", "destierro", "cementerio"]);
  assert.equal(e.jugadores[0].mano.length, 1);
});

test("Jim Hawkins: no puede ser Anulado y al entrar muestra cartas hasta un Oro y lo pone en tu mano", () => {
  let e = mesa();
  oros(e, 0, 1);
  const jim = poner(e, 0, "mano", "Jim Hawkins");
  const ww = alTope(e, 0, "White Worm");
  assert.ok(N.carta(e, jim).claves.includes("NoAnulable"));
  e = sinRespuesta(aplicar(e, jugar(jim)));
  assert.equal(e.jugadores[0].mano.length, 1);
  assert.equal(N.carta(e, e.jugadores[0].mano[0]).tipo, "Oro");
  assert.equal(zonaDe(e, ww), "castillo");
});

test("Jim Hawkins: en tu turno cancelar la habilidad de tus Héroes cuesta un Oro adicional", { todo: "efecto: cancelar habilidades de tus Aliados de una raza cuesta un Oro adicional al oponente" }, () => {});

test("Jose Miguel Carrera: cuando otro Aliado tuyo sale del juego Roba una carta, una vez por turno", () => {
  let e = mesa();
  oros(e, 0, 2);
  const jm = poner(e, 0, "defensa", "Jose Miguel Carrera");
  const ww = poner(e, 0, "defensa", "White Worm");
  const dr = poner(e, 0, "defensa", "El Dracul");
  const l1 = poner(e, 0, "mano", "Regresa Lucy");
  const l2 = poner(e, 0, "mano", "Regresa Lucy");
  assert.equal(N.tiene(e, jm, "Furia"), true);
  e = sinRespuesta(aplicar(e, jugar(l1)));
  e = elegir(e, ww);
  assert.equal(e.jugadores[0].mano.length, 2);
  e = sinRespuesta(aplicar(e, jugar(l2)));
  e = elegir(e, dr);
  assert.equal(zonaDe(e, dr), "cementerio");
  assert.equal(e.jugadores[0].mano.length, 1);
});

test("Jose Miguel Carrera: al atacar solo nombra un coste que encarece las habilidades oponentes", { todo: "efecto: usar habilidades de Aliados de un coste nombrado cuesta un Oro adicional al oponente" }, () => {});

test("Juan Jose Carrera: al entrar un Aliado gana 3 de Fuerza y su daño va al Destierro", () => {
  let e = mesa();
  oros(e, 0, 1);
  const jj = poner(e, 0, "mano", "Juan Jose Carrera");
  const ww = poner(e, 0, "defensa", "White Worm");
  e = sinRespuesta(aplicar(e, jugar(jj)));
  e = elegir(e, ww);
  assert.equal(N.fuerza(e, ww), 7);
  assert.equal(N.tiene(e, ww, "DanoAlDestierro"), true);
  assert.equal(N.tiene(e, jj, "Indestructible"), true);
  assert.ok(N.carta(e, jj).claves.includes("NoAnulable"));
});

test("Juan Jose Carrera: al atacar con un solo Aliado lo potencia y su daño va al Destierro", () => {
  let e = mesa();
  const jj = poner(e, 0, "defensa", "Juan Jose Carrera");
  e = aplicar(e, { tipo: "batalla" });
  e = aplicar(e, { tipo: "atacar", uid: jj });
  e = elegir(e, true);
  e = aplicar(e, { tipo: "finAtaque" });
  e = hastaDano(aplicar(e, { tipo: "finBloqueo" }));
  assert.equal(e.jugadores[1].destierro.length, 4);
  assert.equal(e.jugadores[1].castillo.length, 26);
});

test("Juan Jose Carrera: puedes jugarlo al comienzo del Bloqueo", { todo: "momento: jugar un Aliado al comienzo del Bloqueo" }, () => {});

test("Justo Estay: al entrar puedes poner un Oro de tu mano en tu Oro Pagado", () => {
  let e = mesa();
  oros(e, 0, 1);
  const je = poner(e, 0, "mano", "Justo Estay");
  const o = poner(e, 0, "mano", "Drácula");
  e = sinRespuesta(aplicar(e, jugar(je)));
  e = elegir(e, true);
  assert.equal(zonaDe(e, o), "pagado");
  assert.equal(N.tiene(e, je, "Indestructible"), true);
});

test("Justo Estay: al atacar solo puedes Barajar una carta de tu mano para buscar un Aliado", () => {
  let e = mesa();
  const je = poner(e, 0, "defensa", "Justo Estay");
  const dr = poner(e, 0, "mano", "El Dracul");
  const ww = poner(e, 0, "castillo", "White Worm");
  e = aplicar(e, { tipo: "batalla" });
  e = aplicar(e, { tipo: "atacar", uid: je });
  e = hacer(e, { tipo: "elegir", i: 0 }, ww);
  assert.equal(zonaDe(e, dr), "castillo");
  assert.equal(zonaDe(e, ww), "mano");
});

test("Kai Pendragon: no puede ser declarado atacante", () => {
  let e = mesa();
  const kp = poner(e, 0, "defensa", "Kai Pendragon");
  e = pasarTurno(pasarTurno(e));
  assert.equal(e.activo, 0);
  assert.equal(accionesLegales(e).some((a) => a.tipo === "batalla"), false);
  assert.equal(zonaDe(e, kp), "defensa");
});

test("Kai Pendragon: desde la mano paga un Oro para cancelar una habilidad y juégalo sin pagar su coste", { todo: "respuesta: cancelar una habilidad" }, () => {});
test("Kai Pendragon: usar habilidades de cartas fuera del juego cuesta un Oro adicional al oponente", { todo: "efecto: usar habilidades de cartas fuera del juego cuesta un Oro adicional al oponente" }, () => {});

test("Kai Piloto Prodigio: en tu Vigilia un Aliado gana 1 de Fuerza, Furia y hace doble daño", () => {
  let e = mesa();
  const kai = poner(e, 0, "defensa", "Kai Piloto Prodigio");
  const dc = poner(e, 0, "defensa", "Draco Conjurador");
  e.jugadores[0].nuevos.push(dc);
  assert.equal(N.tiene(e, kai, "Indestructible"), true);
  e = hacer(e, habilidad(kai, "Kai Piloto Prodigio"), dc);
  assert.equal(N.fuerza(e, dc), 3);
  assert.equal(N.tiene(e, dc, "Furia"), true);
  assert.equal(puedeUsar(e, kai), false);
  e = hastaDano(aGuerra(e, dc));
  assert.equal(e.jugadores[1].castillo.length, 24);
});

test("Lady Mina Harker: al entrar busca una carta en tu Castillo", () => {
  let e = mesa();
  oros(e, 0, 2);
  const lm = poner(e, 0, "mano", "Lady Mina Harker");
  const p = poner(e, 0, "castillo", "Pedrenyal");
  e = sinRespuesta(aplicar(e, jugar(lm)));
  e = elegir(e, p);
  assert.equal(zonaDe(e, p), "mano");
});

test("Lady Mina Harker: al salir del juego busca una carta en tu Castillo", () => {
  let e = mesa();
  oros(e, 0, 1);
  const lm = poner(e, 0, "defensa", "Lady Mina Harker");
  const isla = poner(e, 0, "castillo", "Isla de Poveglia");
  const lucy = poner(e, 0, "mano", "Regresa Lucy");
  e = sinRespuesta(aplicar(e, jugar(lucy)));
  e = elegir(e, lm);
  e = elegir(e, isla);
  assert.equal(zonaDe(e, lm), "cementerio");
  assert.equal(zonaDe(e, isla), "mano");
});

test("Lady Mina Harker: al atacar solo nombra una carta que cuesta un Oro adicional", { todo: "efecto: una carta nombrada cuesta Oros adicionales durante un período" }, () => {});
test("Lady Mina Harker: tu oponente juega con su mano descubierta", { todo: "efecto: el oponente juega con la mano revelada" }, () => {});

test("Los Señalados: Furia, no puede portar Armas y es Imbloqueable el turno que entra", () => {
  let e = mesa();
  const ls = poner(e, 0, "mano", "Los Señalados");
  const p = poner(e, 0, "mano", "Pedrenyal");
  e = sinRespuesta(aplicar(e, jugar(ls)));
  assert.equal(N.tiene(e, ls, "Furia"), true);
  assert.equal(N.tiene(e, ls, "Imbloqueable"), true);
  assert.equal(armaCabe(e, ls, p), false);
  e = pasarTurno(e);
  assert.equal(N.tiene(e, ls, "Imbloqueable"), false);
});

test("Los Señalados: si hizo daño al Castillo oponente gana 1 de Fuerza permanentemente", () => {
  let e = mesa();
  const ls = poner(e, 0, "defensa", "Los Señalados");
  e = hastaDano(aGuerra(e, ls));
  assert.equal(e.activo, 1);
  assert.equal(N.fuerza(e, ls), 2);
});

test("Los Señalados: sin daño no gana Fuerza", () => {
  let e = mesa();
  const ls = poner(e, 0, "defensa", "Los Señalados");
  e = pasarTurno(e);
  assert.equal(N.fuerza(e, ls), 1);
});

test("Luis Carrera: al entrar un Aliado es Indestructible y Robas por cada Aliado y cada Carrera", () => {
  let e = mesa();
  oros(e, 0, 2);
  const luis = poner(e, 0, "mano", "Luis Carrera");
  poner(e, 0, "defensa", "Juan Jose Carrera");
  const ww = poner(e, 0, "defensa", "White Worm");
  e = sinRespuesta(aplicar(e, jugar(luis)));
  e = elegir(e, ww);
  assert.equal(N.tiene(e, ww, "Indestructible"), true);
  assert.equal(e.jugadores[0].mano.length, 5);
});

test("Luis Carrera: puedes jugarlo al comienzo del Bloqueo reduciendo su coste", { todo: "momento: jugar un Aliado al comienzo del Bloqueo" }, () => {});

test("Manuel Rodriguez: hace doble daño de combate al Destierro", () => {
  let e = mesa();
  const mr = poner(e, 0, "defensa", "Manuel Rodriguez");
  assert.equal(N.tiene(e, mr, "Furia"), true);
  e = hastaDano(aGuerra(e, mr));
  assert.equal(e.jugadores[1].destierro.length, 8);
});

test("Manuel Rodriguez: cuando ataca solo Roba una carta", () => {
  let e = mesa();
  const mr = poner(e, 0, "defensa", "Manuel Rodriguez");
  poner(e, 0, "defensa", "White Worm");
  e = aplicar(e, { tipo: "batalla" });
  e = aplicar(e, { tipo: "atacar", uid: mr });
  e = elegir(e, true);
  assert.equal(e.jugadores[0].mano.length, 1);
  assert.deepEqual(atacables(e), []);
});

test("Manuel Rodriguez: al comienzo del turno genera un Oro para Aliados", () => {
  let e = mesa();
  poner(e, 0, "defensa", "Manuel Rodriguez");
  e = aplicar(e, { tipo: "terminar" });
  assert.equal(e.activo, 1);
  e = elegir(e, "Generar un Oro para jugar Aliados");
  assert.equal(disponibles(e, 0, "Aliado"), 1);
});

test("Manuel Rodriguez: al comienzo del turno puede Barajar una carta de coste 3 o menos", () => {
  let e = mesa();
  poner(e, 0, "defensa", "Manuel Rodriguez");
  const ww = poner(e, 1, "defensa", "White Worm");
  e = aplicar(e, { tipo: "terminar" });
  e = con(e, "Barajar una carta de coste 3 o menos", ww);
  assert.equal(zonaDe(e, ww), "castillo");
});

test("Manuel Rodriguez: al atacar solo afectar a tus Aliados cuesta un Oro adicional al oponente", { todo: "efecto: afectar a tus Aliados cuesta un Oro adicional al oponente" }, () => {});
