import { test } from "node:test";
import assert from "node:assert/strict";
import { mesa, poner, oros, hacer, elegir, accionesLegales, aplicar, zonaDe, id, N } from "./ayuda-duelo.mjs";
import { costeDe } from "../web/duelo/motor.js";
import { resolver, cumple, OPS } from "../web/duelo/efectos.js";
import { TRANSCRITAS } from "../web/duelo/cartas.js";

const jugar = (uid, extra = {}) => ({ tipo: "jugar", uid, ...extra });
const habilidad = (uid, nombre, h = 0) => ({ tipo: "habilidad", uid, def: id(nombre), h });
const nombreDe = (e, nombre) => (v) => v !== null && N.carta(e, v).nombre === nombre;
const usable = (e, uid, h = 0) => accionesLegales(e).some((a) => a.tipo === "habilidad" && a.uid === uid && a.h === h);

test("Revólver Webley: el portador gana 2 de Fuerza y Furia, y tiene Exhumar", () => {
  const e = mesa();
  const g = poner(e, 0, "defensa", "Guardia Real");
  const r = poner(e, 0, "arma", "Revólver Webley", { portador: g });
  assert.equal(N.fuerza(e, g), 5);
  assert.equal(N.tiene(e, g, "Furia"), true);
  assert.equal(N.tiene(e, r, "Exhumar"), true);
});

test("Revólver Webley: al entrar juegas una carta de tu mano reduciendo su coste en un Oro", () => {
  let e = mesa();
  oros(e, 0, 3);
  const v = poner(e, 0, "defensa", "Valefor");
  const r = poner(e, 0, "mano", "Revólver Webley");
  const g = poner(e, 0, "mano", "Guardia Real");
  e = hacer(e, jugar(r, { portador: v }), true);
  assert.equal(zonaDe(e, g), "defensa");
  assert.equal(e.jugadores[0].reserva.length, 0);
  assert.equal(e.jugadores[0].pagado.length, 3);
});

test("Revólver Webley: también puede jugar una carta de tu Cementerio con el coste reducido", () => {
  let e = mesa();
  oros(e, 0, 2);
  const v = poner(e, 0, "defensa", "Valefor");
  const r = poner(e, 0, "mano", "Revólver Webley");
  const x = poner(e, 0, "cementerio", "Valefor");
  e = hacer(e, jugar(r, { portador: v }), true);
  assert.equal(zonaDe(e, x), "defensa");
  assert.equal(e.jugadores[0].pagado.length, 2);
});

test("Revólver Webley: el portador no puede ser afectado por efectos oponentes hasta tu próximo turno", () => {
  let e = mesa();
  oros(e, 0, 2);
  const v = poner(e, 0, "defensa", "Valefor");
  const r = poner(e, 0, "mano", "Revólver Webley");
  e = aplicar(e, jugar(r, { portador: v }));
  const danza = poner(e, 1, "mano", "Danza del Cuchillo");
  const ctx = (fuente, ctrl) => ({ ctrl, fuente, def: e.instancias[fuente], vars: {} });
  assert.equal(cumple(e, ctx(danza, 1), v, {}, "destruir"), false);
  assert.equal(cumple(e, ctx(r, 0), v, {}, "destruir"), true);
  e.turno += 1;
  e.activo = 0;
  N.expirar(e, "inicio");
  assert.equal(cumple(e, ctx(danza, 1), v, {}, "destruir"), true);
});

test("Rifle Winchester: el portador gana 2 de Fuerza e Indestructible", () => {
  const e = mesa();
  const g = poner(e, 0, "defensa", "Guardia Real");
  poner(e, 0, "arma", "Rifle Winchester", { portador: g });
  assert.equal(N.fuerza(e, g), 5);
  assert.equal(N.tiene(e, g, "Indestructible"), true);
});

test("Rifle Winchester: al entrar busca un Aliado en tu Castillo y lo pone en tu mano", () => {
  let e = mesa();
  oros(e, 0, 1);
  const g = poner(e, 0, "defensa", "Guardia Real");
  const v = poner(e, 0, "castillo", "Valefor");
  const r = poner(e, 0, "mano", "Rifle Winchester");
  e = hacer(e, jugar(r, { portador: g }), v);
  assert.equal(zonaDe(e, v), "mano");
});

test("Rifle Winchester: cuando el portador ataca busca otro Aliado", () => {
  let e = mesa();
  oros(e, 0, 1);
  const g = poner(e, 0, "defensa", "Guardia Real");
  const v1 = poner(e, 0, "castillo", "Valefor");
  const v2 = poner(e, 0, "castillo", "Guardia Real");
  const r = poner(e, 0, "mano", "Rifle Winchester");
  e = hacer(e, jugar(r, { portador: g }), v1);
  e = aplicar(e, { tipo: "batalla" });
  e = hacer(e, { tipo: "atacar", uid: g }, v2);
  assert.equal(zonaDe(e, v2), "mano");
});

test("Rifle Winchester: cuando sale del juego tu oponente Bota tres cartas", () => {
  let e = mesa();
  const g = poner(e, 0, "defensa", "Guardia Real");
  const r = poner(e, 0, "arma", "Rifle Winchester", { portador: g });
  N.mover(e, r, "cementerio");
  resolver(e);
  assert.equal(e.jugadores[1].cementerio.length, 3);
});

test("Rifle Winchester: si sale junto con su portador tu oponente también Bota tres", () => {
  let e = mesa();
  oros(e, 0, 1);
  const g = poner(e, 0, "defensa", "Guardia Real");
  poner(e, 0, "castillo", "Valefor");
  const r = poner(e, 0, "mano", "Rifle Winchester");
  e = hacer(e, jugar(r, { portador: g }), null);
  N.mover(e, g, "cementerio");
  resolver(e);
  assert.equal(zonaDe(e, r), "cementerio");
  assert.equal(e.jugadores[1].cementerio.length, 3);
});

test("Sable Corto: reduce su coste en un Oro si controlas Armas", () => {
  const e = mesa();
  const s = poner(e, 0, "mano", "Sable Corto");
  const g = poner(e, 0, "defensa", "Guardia Real");
  assert.equal(costeDe(e, 0, s).pagar, 2);
  poner(e, 0, "arma", "Pedrenyal", { portador: g });
  assert.equal(costeDe(e, 0, s).pagar, 1);
});

test("Sable Corto: el portador gana 1 de Fuerza e Indesterrable", () => {
  const e = mesa();
  const g = poner(e, 0, "defensa", "Guardia Real");
  poner(e, 0, "arma", "Sable Corto", { portador: g });
  assert.equal(N.fuerza(e, g), 4);
  assert.equal(N.tiene(e, g, "Indesterrable"), true);
});

test("Sable Corto: en tu Vigilia, una vez por turno, el oponente pone en su Cementerio tantas cartas del tope como Fuerza de tu Aliado", () => {
  let e = mesa();
  const g = poner(e, 0, "defensa", "Guardia Real");
  const s = poner(e, 0, "arma", "Sable Corto", { portador: g });
  e = aplicar(e, habilidad(s, "Sable Corto"));
  assert.equal(e.jugadores[1].cementerio.length, 4);
  assert.equal(e.jugadores[1].castillo.length, 26);
  assert.equal(usable(e, s), false);
});

test("Spada Da Lato: el portador gana 1 de Fuerza y al entrar puedes Robar tantas cartas como su Fuerza", () => {
  let e = mesa();
  oros(e, 0, 2);
  const g = poner(e, 0, "defensa", "Guardia Real");
  const s = poner(e, 0, "mano", "Spada Da Lato");
  e = hacer(e, jugar(s, { portador: g }), true);
  assert.equal(N.fuerza(e, g), 4);
  assert.equal(e.jugadores[0].mano.length, 4);
});

test("Trampa Dulce: el portador gana 2 de Fuerza e Indestructible", () => {
  const e = mesa();
  const g = poner(e, 0, "defensa", "Guardia Real");
  poner(e, 0, "arma", "Trampa Dulce", { portador: g });
  assert.equal(N.fuerza(e, g), 5);
  assert.equal(N.tiene(e, g, "Indestructible"), true);
});

test("Trampa Dulce: cuando el portador sale del juego puedes cambiarla de portador", () => {
  let e = mesa();
  oros(e, 0, 1);
  const g = poner(e, 0, "defensa", "Guardia Real");
  const v = poner(e, 0, "defensa", "Valefor");
  const t = poner(e, 0, "mano", "Trampa Dulce");
  e = aplicar(e, jugar(t, { portador: g }));
  N.mover(e, g, "cementerio");
  resolver(e);
  e = elegir(e, true);
  assert.equal(N.portadorDe(e, t), v);
  assert.equal(N.fuerza(e, v), 5);
});

test("Trampa Dulce: hasta dos veces por turno, pagar un Oro para Anular un Talismán", () => {
  let e = mesa();
  const g = poner(e, 1, "defensa", "Guardia Real");
  const t = poner(e, 1, "arma", "Trampa Dulce", { portador: g });
  oros(e, 1, 3);
  oros(e, 0, 6);
  const responde = (s) => accionesLegales(s).find((a) => a.tipo === "responder" && a.uid === t);
  const d1 = poner(e, 0, "mano", "Danza del Cuchillo");
  e = aplicar(e, jugar(d1));
  e = aplicar(e, responde(e));
  assert.equal(zonaDe(e, d1), "cementerio");
  assert.equal(zonaDe(e, g), "defensa");
  assert.equal(e.jugadores[1].pagado.length, 1);
  const d2 = poner(e, 0, "mano", "Danza del Cuchillo");
  e = aplicar(e, jugar(d2));
  e = aplicar(e, responde(e));
  assert.equal(zonaDe(e, d2), "cementerio");
  const d3 = poner(e, 0, "mano", "Danza del Cuchillo");
  e = aplicar(e, jugar(d3));
  assert.equal(responde(e), undefined);
});

test("Trampa Dulce: no Anula cartas que no son Talismán", () => {
  let e = mesa();
  const g = poner(e, 1, "defensa", "Guardia Real");
  const t = poner(e, 1, "arma", "Trampa Dulce", { portador: g });
  oros(e, 1, 1);
  oros(e, 0, 1);
  const v = poner(e, 0, "mano", "Valefor");
  e = aplicar(e, jugar(v));
  assert.equal(accionesLegales(e).some((a) => a.tipo === "responder" && a.uid === t), false);
});

test("Trompeta del Apocalipsis: tiene Exhumar y el portador pierde su Fuerza y su habilidad", () => {
  let e = mesa();
  oros(e, 0, 1);
  const v = poner(e, 0, "defensa", "Valefor");
  const t = poner(e, 0, "mano", "Trompeta del Apocalipsis");
  e = aplicar(e, jugar(t, { portador: v }));
  assert.equal(N.tiene(e, t, "Exhumar"), true);
  assert.equal(N.fuerza(e, v), 0);
  assert.equal(N.activa(e, v), false);
  assert.equal(N.tiene(e, v, "Furia"), false);
});

test("Trompeta del Apocalipsis: al salir del juego el portador recupera su Fuerza y su habilidad", () => {
  let e = mesa();
  oros(e, 0, 1);
  const v = poner(e, 0, "defensa", "Valefor");
  const t = poner(e, 0, "mano", "Trompeta del Apocalipsis");
  e = aplicar(e, jugar(t, { portador: v }));
  N.mover(e, t, "cementerio");
  resolver(e);
  assert.equal(N.fuerza(e, v), 3);
  assert.equal(N.activa(e, v), true);
});

test("Trompeta del Apocalipsis: en la Fase Final el oponente pone una carta de un Cementerio como Aliado sin habilidad de Fuerza 3 y tú Botas", () => {
  let e = mesa();
  const v = poner(e, 0, "defensa", "Valefor");
  poner(e, 0, "arma", "Trompeta del Apocalipsis", { portador: v });
  const g = poner(e, 1, "cementerio", "Guardia Real");
  e = aplicar(e, { tipo: "terminar" });
  assert.equal(e.pendiente.jugador, 1);
  e = elegir(e, g);
  assert.equal(zonaDe(e, g), "defensa");
  assert.equal(N.ubicar(e, g).j, 1);
  assert.equal(N.carta(e, g).tipo, "Aliado");
  assert.equal(N.carta(e, g).sinHabilidad, true);
  assert.equal(N.fuerza(e, g), 3);
  assert.equal(e.jugadores[0].cementerio.length, 3);
});

test("Yelmo Vendel: el portador gana 2 de Fuerza e Indestructible", () => {
  const e = mesa();
  const g = poner(e, 0, "defensa", "Guardia Real");
  poner(e, 0, "arma", "Yelmo Vendel", { portador: g });
  assert.equal(N.fuerza(e, g), 5);
  assert.equal(N.tiene(e, g, "Indestructible"), true);
});

test("Yelmo Vendel: en tu Vigilia busca en un Castillo dos cartas con distinto nombre y las Destierra", () => {
  let e = mesa();
  const g = poner(e, 0, "defensa", "Guardia Real");
  const y = poner(e, 0, "arma", "Yelmo Vendel", { portador: g });
  const v = poner(e, 1, "castillo", "Valefor");
  e = hacer(e, habilidad(y, "Yelmo Vendel"), "Castillo oponente", v);
  assert.equal(opcionesSinValefor(e), true);
  e = elegir(e, nombreDe(e, "Drácula"));
  assert.equal(zonaDe(e, v), "destierro");
  assert.equal(e.jugadores[1].destierro.length, 2);
  assert.equal(usable(e, y), false);
});

function opcionesSinValefor(e) {
  return e.pendiente.opciones.every((o) => o.valor === null || N.carta(e, o.valor).nombre !== "Valefor");
}

test("Yelmo Vendel: en tu Fase Final Baraja y/o Destierra hasta tres cartas de los Cementerios y Roba una", () => {
  let e = mesa();
  const g = poner(e, 0, "defensa", "Guardia Real");
  poner(e, 0, "arma", "Yelmo Vendel", { portador: g });
  const a = poner(e, 1, "cementerio", "Valefor");
  const b = poner(e, 1, "cementerio", "Valefor");
  const c = poner(e, 1, "cementerio", "Valefor");
  e = aplicar(e, { tipo: "terminar" });
  e = elegir(e, a);
  e = elegir(e, null);
  e = elegir(e, b);
  e = elegir(e, c);
  assert.equal(zonaDe(e, a), "castillo");
  assert.equal(zonaDe(e, b), "destierro");
  assert.equal(zonaDe(e, c), "destierro");
  assert.equal(e.jugadores[0].mano.length, 2);
});

test("Yelmo de Mambrino: el portador gana 1 de Fuerza e Indesterrable", () => {
  const e = mesa();
  const g = poner(e, 0, "defensa", "Guardia Real");
  poner(e, 0, "arma", "Yelmo de Mambrino", { portador: g });
  assert.equal(N.fuerza(e, g), 4);
  assert.equal(N.tiene(e, g, "Indesterrable"), true);
});

test("Yelmo de Mambrino: al entrar o jugar Aliados roba y convierte la primera carta de un Castillo en Aliado, hasta dos veces por turno", () => {
  let e = mesa();
  oros(e, 0, 3);
  const g = poner(e, 0, "defensa", "Guardia Real");
  const y = poner(e, 0, "mano", "Yelmo de Mambrino");
  const v1 = poner(e, 0, "mano", "Valefor");
  const v2 = poner(e, 0, "mano", "Valefor");
  const tope = e.jugadores[1].castillo[0];
  e = hacer(e, jugar(y, { portador: g }), "Castillo oponente");
  assert.equal(N.ubicar(e, tope).j, 0);
  assert.equal(N.carta(e, tope).tipo, "Aliado");
  assert.equal(N.carta(e, tope).sinHabilidad, true);
  assert.equal(N.fuerza(e, tope), 2);
  assert.equal(e.jugadores[0].mano.length, 3);
  e = hacer(e, jugar(v1), "tu Castillo");
  assert.equal(e.jugadores[0].defensa.length, 4);
  e = aplicar(e, jugar(v2));
  assert.equal(e.pendiente, null);
  assert.equal(e.jugadores[0].defensa.length, 5);
});

test("Ahu Tongariki: no puede ser Anulado y al entrar Roba dos cartas", () => {
  let e = mesa();
  oros(e, 0, 1);
  const a = poner(e, 0, "mano", "Ahu Tongariki");
  assert.equal(N.carta(e, a).claves.includes("NoAnulable"), true);
  e = hacer(e, jugar(a), "Robar dos cartas");
  assert.equal(e.jugadores[0].mano.length, 2);
});

test("Ahu Tongariki: al entrar puede Barajar una carta de coste 2 o menos", () => {
  let e = mesa();
  oros(e, 0, 1);
  const a = poner(e, 0, "mano", "Ahu Tongariki");
  const r = poner(e, 1, "defensa", "Valefor");
  e = hacer(e, jugar(a), "Barajar una carta de coste 2 o menos", r);
  assert.equal(zonaDe(e, r), "castillo");
});

test("Ahu Tongariki: los Aliados de coste 1 o menos pierden 1 de Fuerza y tus Aliados son Indestructibles", () => {
  const e = mesa();
  poner(e, 0, "apoyo", "Ahu Tongariki");
  const v = poner(e, 0, "defensa", "Valefor");
  const g = poner(e, 0, "defensa", "Guardia Real");
  const r = poner(e, 1, "defensa", "Valefor");
  assert.equal(N.fuerza(e, v), 2);
  assert.equal(N.fuerza(e, r), 2);
  assert.equal(N.fuerza(e, g), 3);
  assert.equal(N.tiene(e, g, "Indestructible"), true);
  assert.equal(N.tiene(e, r, "Indestructible"), false);
});

test("Ahu Tongariki: los Aliados de coste 1 o menos pierden Furia", () => {
  const e = mesa();
  poner(e, 0, "apoyo", "Ahu Tongariki");
  const v = poner(e, 1, "defensa", "Valefor");
  const b = poner(e, 1, "defensa", "Balaur");
  assert.equal(N.tiene(e, v, "Furia"), false);
  assert.equal(N.tiene(e, b, "Furia"), true);
});

test("Altar de Muertos: al entrar Baraja la mitad de los Aliados de cada jugador redondeada hacia arriba", () => {
  let e = mesa();
  oros(e, 0, 2);
  const al = poner(e, 0, "mano", "Altar de Muertos");
  const m = [1, 2, 3].map(() => poner(e, 0, "defensa", "Valefor"));
  const r = poner(e, 1, "defensa", "Valefor");
  e = hacer(e, jugar(al), "Barajar la mitad de los Aliados de cada jugador", m[0], m[1]);
  assert.deepEqual(m.map((u) => zonaDe(e, u)), ["castillo", "castillo", "defensa"]);
  assert.equal(zonaDe(e, r), "castillo");
});

test("Altar de Muertos: al entrar puede Barajar una carta de coste 3 o menos", () => {
  let e = mesa();
  oros(e, 0, 2);
  const al = poner(e, 0, "mano", "Altar de Muertos");
  const r = poner(e, 1, "defensa", "Balaur");
  const g = poner(e, 1, "defensa", "Guardia Real");
  e = hacer(e, jugar(al), "Barajar una carta de coste 3 o menos", g);
  assert.equal(zonaDe(e, g), "castillo");
  assert.equal(zonaDe(e, r), "defensa");
});

test("Altar de Muertos: una vez en tu turno, por cada Tótem el oponente Bota dos o Destierra una, y con dos Tótem o menos Robas una", () => {
  let e = mesa();
  const al = poner(e, 0, "apoyo", "Altar de Muertos");
  poner(e, 0, "apoyo", "Ahu Tongariki");
  e = hacer(e, habilidad(al, "Altar de Muertos"), "Tu oponente Bota dos cartas", "Desterrar una carta del tope del Castillo oponente");
  assert.equal(e.jugadores[1].cementerio.length, 2);
  assert.equal(e.jugadores[1].destierro.length, 1);
  assert.equal(e.jugadores[0].mano.length, 1);
  assert.equal(usable(e, al), false);
});

test("Altar de Muertos: con tres Tótem no Roba", () => {
  let e = mesa();
  const al = poner(e, 0, "apoyo", "Altar de Muertos");
  poner(e, 0, "apoyo", "Ahu Tongariki");
  poner(e, 0, "apoyo", "Ahu Tongariki");
  e = hacer(e, habilidad(al, "Altar de Muertos"), "Tu oponente Bota dos cartas", "Tu oponente Bota dos cartas", "Tu oponente Bota dos cartas");
  assert.equal(e.jugadores[1].cementerio.length, 6);
  assert.equal(e.jugadores[0].mano.length, 0);
});

test("Altar del Juramento: al entrar hasta dos Aliados ganan 2 de Fuerza permanentemente", () => {
  let e = mesa();
  oros(e, 0, 1);
  const al = poner(e, 0, "mano", "Altar del Juramento");
  const v = poner(e, 0, "defensa", "Valefor");
  const g = poner(e, 0, "defensa", "Guardia Real");
  e = hacer(e, jugar(al), v, g, "Ganan 2 de Fuerza");
  N.expirar(e, "finTurno");
  e.turno += 2;
  N.expirar(e, "finTurno");
  assert.equal(N.fuerza(e, v), 5);
  assert.equal(N.fuerza(e, g), 5);
});

test("Altar del Juramento: al entrar hasta dos Aliados pueden perder 2 de Fuerza", () => {
  let e = mesa();
  oros(e, 0, 1);
  const al = poner(e, 0, "mano", "Altar del Juramento");
  const r = poner(e, 1, "defensa", "Valefor");
  e = hacer(e, jugar(al), r, "Pierden 2 de Fuerza");
  assert.equal(N.fuerza(e, r), 1);
});

test("Altar del Juramento: Desterrándolo sube dos cartas al azar de tu Cementerio a tu mano", () => {
  let e = mesa();
  const al = poner(e, 0, "apoyo", "Altar del Juramento");
  const c = [1, 2, 3].map(() => poner(e, 0, "cementerio", "Valefor"));
  e = aplicar(e, habilidad(al, "Altar del Juramento"));
  assert.equal(zonaDe(e, al), "destierro");
  assert.equal(e.jugadores[0].mano.length, 2);
  assert.equal(c.filter((u) => zonaDe(e, u) === "cementerio").length, 1);
});

test("Antartica: tus Aliados ganan 2 de Fuerza y las cartas del Cementerio oponente pierden su habilidad", () => {
  const e = mesa();
  poner(e, 0, "apoyo", "Antartica");
  const v = poner(e, 0, "defensa", "Valefor");
  const r = poner(e, 1, "defensa", "Valefor");
  const cr = poner(e, 1, "cementerio", "Valefor");
  const cm = poner(e, 0, "cementerio", "Valefor");
  assert.equal(N.fuerza(e, v), 5);
  assert.equal(N.fuerza(e, r), 3);
  assert.equal(N.activa(e, cr), false);
  assert.equal(N.activa(e, cm), true);
});

test("Antartica: si atacaste en tu turno anterior genera un Oro para Aliados y al usarlo Robas una carta", () => {
  let e = mesa();
  const an = poner(e, 0, "apoyo", "Antartica");
  const v = poner(e, 0, "mano", "Valefor");
  assert.equal(usable(e, an), false);
  e.jugadores[0].atacoTurnoAnterior = true;
  e = aplicar(e, habilidad(an, "Antartica"));
  assert.equal(usable(e, an), false);
  e = aplicar(e, jugar(v));
  assert.equal(zonaDe(e, v), "defensa");
  assert.equal(e.jugadores[0].mano.length, 1);
  assert.equal(e.jugadores[0].generados.length, 0);
});

test("Arco del Triunfo: tus Aliados ganan 1 de Fuerza y su daño de combate va al Destierro", () => {
  const e = mesa();
  poner(e, 0, "apoyo", "Arco del Triunfo");
  const v = poner(e, 0, "defensa", "Valefor");
  const r = poner(e, 1, "defensa", "Valefor");
  assert.equal(N.fuerza(e, v), 4);
  assert.equal(N.tiene(e, v, "DanoAlDestierro"), true);
  assert.equal(N.tiene(e, r, "DanoAlDestierro"), false);
});

test("Arco del Triunfo: al entrar muestra hasta un Aliado o Tótem de coste 2 y lo pone en tu mano", () => {
  let e = mesa();
  oros(e, 0, 3);
  const a = poner(e, 0, "mano", "Arco del Triunfo");
  poner(e, 0, "castillo", "Valefor");
  const g = poner(e, 0, "castillo", "Guardia Real");
  e = hacer(e, jugar(a), "Ponerlo en tu mano");
  assert.equal(zonaDe(e, g), "mano");
});

test("Arco del Triunfo: al salir del juego puede poner en juego el Aliado mostrado", () => {
  let e = mesa();
  const a = poner(e, 0, "apoyo", "Arco del Triunfo");
  const g = poner(e, 0, "castillo", "Guardia Real");
  N.mover(e, a, "cementerio");
  resolver(e);
  e = elegir(e, "Ponerlo en juego");
  assert.equal(zonaDe(e, g), "defensa");
});

test("Bayou St. John: al entrar Roba dos cartas", () => {
  let e = mesa();
  oros(e, 0, 1);
  const b = poner(e, 0, "mano", "Bayou St. John");
  e = aplicar(e, jugar(b));
  assert.equal(e.jugadores[0].mano.length, 2);
});

test("Bayou St. John: Descartando una carta hasta dos Aliados de coste 2 o menos ganan 1 de Fuerza y Furia", () => {
  let e = mesa();
  const b = poner(e, 0, "apoyo", "Bayou St. John");
  const g = poner(e, 0, "defensa", "Guardia Real");
  const x = poner(e, 0, "mano", "Drácula");
  e = hacer(e, habilidad(b, "Bayou St. John"), "Descartar una carta de tu mano", g);
  assert.equal(zonaDe(e, x), "cementerio");
  assert.equal(N.fuerza(e, g), 4);
  assert.equal(N.tiene(e, g, "Furia"), true);
  assert.equal(usable(e, b), false);
});

test("Bayou St. John: en tu Fase Final Destierra hasta tres cartas del Cementerio oponente", () => {
  let e = mesa();
  poner(e, 0, "apoyo", "Bayou St. John");
  const c = [1, 2, 3, 4].map(() => poner(e, 1, "cementerio", "Valefor"));
  e = hacer(e, { tipo: "terminar" }, c[0], c[1], c[2]);
  assert.deepEqual(c.map((u) => zonaDe(e, u)), ["destierro", "destierro", "destierro", "cementerio"]);
});

test("Bayou St. John: si ya lo usó en la Vigilia no se dispara en la Fase Final", () => {
  let e = mesa();
  const b = poner(e, 0, "apoyo", "Bayou St. John");
  poner(e, 1, "cementerio", "Valefor");
  e.usos[`bayou|${b}`] = e.turno;
  e = aplicar(e, { tipo: "terminar" });
  assert.equal(e.jugadores[1].cementerio.length, 1);
});

test("Bistritz: al entrar Roba hasta tres cartas", () => {
  let e = mesa();
  oros(e, 0, 2);
  const b = poner(e, 0, "mano", "Bistritz");
  e = hacer(e, jugar(b), 3);
  assert.equal(e.jugadores[0].mano.length, 3);
});

test("Bistritz: convierte la primera carta de un Castillo en un Aliado con Furia de Fuerza 4, una vez por turno", () => {
  let e = mesa();
  const b = poner(e, 0, "apoyo", "Bistritz");
  const tope = e.jugadores[1].castillo[0];
  e = hacer(e, habilidad(b, "Bistritz"), "Castillo oponente");
  assert.equal(zonaDe(e, tope), "defensa");
  assert.equal(N.ubicar(e, tope).j, 0);
  assert.equal(N.fuerza(e, tope), 4);
  assert.equal(N.tiene(e, tope, "Furia"), true);
  assert.equal(usable(e, b), false);
});

test("Bistritz: los Aliados oponentes pierden 1 de Fuerza", () => {
  const e = mesa();
  poner(e, 0, "apoyo", "Bistritz");
  const v = poner(e, 0, "defensa", "Valefor");
  const r = poner(e, 1, "defensa", "Valefor");
  assert.equal(N.fuerza(e, v), 3);
  assert.equal(N.fuerza(e, r), 2);
});

test("Campus de Muerte: no puede ser Anulado y reduce su coste si no controlas más de un Aliado", () => {
  const e = mesa();
  const c = poner(e, 0, "mano", "Campus de Muerte");
  assert.equal(N.carta(e, c).claves.includes("NoAnulable"), true);
  poner(e, 0, "defensa", "Valefor");
  assert.equal(costeDe(e, 0, c).pagar, 1);
  poner(e, 0, "defensa", "Valefor");
  assert.equal(costeDe(e, 0, c).pagar, 2);
});

test("Campus de Muerte: los Aliados pierden 1 de Fuerza por cada otro Aliado de su controlador", () => {
  const e = mesa();
  poner(e, 0, "apoyo", "Campus de Muerte");
  const m = [1, 2, 3].map(() => poner(e, 0, "defensa", "Valefor"));
  const r = poner(e, 1, "defensa", "Valefor");
  assert.equal(N.fuerza(e, m[0]), 1);
  assert.equal(N.fuerza(e, r), 3);
});

test("Campus de Muerte: una vez en tu turno busca un Arma o Tótem en tu Castillo", () => {
  let e = mesa();
  const c = poner(e, 0, "apoyo", "Campus de Muerte");
  const p = poner(e, 0, "castillo", "Pedrenyal");
  e = hacer(e, habilidad(c, "Campus de Muerte"), p);
  assert.equal(zonaDe(e, p), "mano");
  assert.equal(usable(e, c), false);
});

test("Capilla de los Susurros: tiene Exhumar y tus Aliados ganan 1 de Fuerza", () => {
  const e = mesa();
  const c = poner(e, 0, "apoyo", "Capilla de los Susurros");
  const v = poner(e, 0, "defensa", "Valefor");
  assert.equal(N.tiene(e, c, "Exhumar"), true);
  assert.equal(N.fuerza(e, v), 4);
});

test("Capilla de los Susurros: los Aliados oponentes declarados atacantes pierden 1 de Fuerza", () => {
  let e = mesa();
  poner(e, 0, "apoyo", "Capilla de los Susurros");
  const r = poner(e, 1, "defensa", "Valefor");
  e.activo = 1;
  e = aplicar(e, { tipo: "batalla" });
  e = aplicar(e, { tipo: "atacar", uid: r });
  assert.equal(N.fuerza(e, r), 2);
});

test("Casa Colorada: al entrar puede Desterrar una carta de coste 2 o más", () => {
  let e = mesa();
  oros(e, 0, 2);
  const c = poner(e, 0, "mano", "Casa Colorada");
  const g = poner(e, 1, "defensa", "Guardia Real");
  e = hacer(e, jugar(c), true, g, "Desterrar");
  assert.equal(zonaDe(e, g), "destierro");
});

test("Casa Colorada: al comienzo de la Fase Final oponente Baraja hasta tres cartas de los Cementerios y Roba una", () => {
  let e = mesa();
  poner(e, 0, "apoyo", "Casa Colorada");
  const x = poner(e, 1, "cementerio", "Valefor");
  e.activo = 1;
  e = hacer(e, { tipo: "terminar" }, true, x, "Barajar");
  assert.equal(zonaDe(e, x), "castillo");
  assert.equal(e.jugadores[0].mano.length, 1);
});

test("Casa Colorada: en tu Vigilia puede Desterrar hasta tres cartas de los Cementerios y Robar una", () => {
  let e = mesa();
  poner(e, 0, "apoyo", "Casa Colorada");
  const x = poner(e, 1, "cementerio", "Valefor");
  e.activo = 1;
  e = hacer(e, { tipo: "terminar" }, false, true, x, "Desterrar");
  assert.equal(e.activo, 0);
  assert.equal(zonaDe(e, x), "destierro");
  assert.equal(e.jugadores[0].mano.length, 1);
});

test("Casa de Opio: no puede ser Anulado y una vez en tu turno, si el oponente juega una carta, genera un Oro para Aliados o Armas", () => {
  const e = mesa();
  const c = poner(e, 0, "apoyo", "Casa de Opio");
  assert.equal(N.carta(e, c).claves.includes("NoAnulable"), true);
  N.disparar(e, "juega", { uid: "1-x", j: 1, tipo: "Talismán" });
  resolver(e);
  assert.deepEqual(e.jugadores[0].generados, [{ n: 1, tipos: ["Aliado", "Arma"] }]);
  N.disparar(e, "juega", { uid: "1-x", j: 1, tipo: "Talismán" });
  resolver(e);
  assert.equal(e.jugadores[0].generados.length, 1);
});

test("Casa de Opio: en el turno oponente no genera Oro", () => {
  const e = mesa();
  poner(e, 0, "apoyo", "Casa de Opio");
  e.activo = 1;
  N.disparar(e, "juega", { uid: "1-x", j: 1, tipo: "Aliado" });
  resolver(e);
  assert.equal((e.jugadores[0].generados ?? []).length, 0);
});

test("Casa de Opio: se juega al comienzo de cualquier Fase y en el turno oponente cuesta un Oro menos", () => {
  let e = mesa();
  oros(e, 0, 1);
  const c = poner(e, 0, "mano", "Casa de Opio");
  assert.equal(costeDe(e, 0, c).pagar, 2);
  e.activo = 1;
  assert.equal(costeDe(e, 0, c).pagar, 1);
  e = aplicar(e, { tipo: "terminar" });
  assert.equal(e.fase, "momento");
  e = aplicar(e, { tipo: "pasarMomento" });
  e = aplicar(e, jugar(c));
  assert.equal(zonaDe(e, c), "apoyo");
  assert.equal(e.jugadores[0].pagado.length, 1);
});

test("Casa de Opio: también genera Oro cuando el oponente usa una habilidad", { todo: "evento: cuando un jugador usa una habilidad activada" }, () => {});

test("Castillo Drácula: al entrar Destierra hasta dos cartas cuyos costes sumen 3 o menos y Roba dos", () => {
  let e = mesa();
  oros(e, 0, 2);
  const c = poner(e, 0, "mano", "Castillo Drácula");
  const v = poner(e, 1, "defensa", "Valefor");
  const g = poner(e, 1, "defensa", "Guardia Real");
  const b = poner(e, 1, "defensa", "Balaur");
  e = hacer(e, jugar(c), v, g, "Desterrar");
  assert.equal(zonaDe(e, v), "destierro");
  assert.equal(zonaDe(e, g), "destierro");
  assert.equal(zonaDe(e, b), "defensa");
  assert.equal(e.jugadores[0].mano.length, 2);
});

test("Castillo Drácula: la segunda carta no puede superar la suma de coste 3", () => {
  let e = mesa();
  oros(e, 0, 2);
  const c = poner(e, 0, "mano", "Castillo Drácula");
  const g1 = poner(e, 1, "defensa", "Guardia Real");
  const g2 = poner(e, 1, "defensa", "Guardia Real");
  e = hacer(e, jugar(c), g1);
  assert.equal(e.pendiente.opciones.some((o) => o.valor === g2), false);
});

test("Castillo Drácula: pagando un Oro tu oponente Bota cinco cartas", () => {
  let e = mesa();
  oros(e, 0, 1);
  const c = poner(e, 0, "apoyo", "Castillo Drácula");
  e = hacer(e, habilidad(c, "Castillo Drácula"), "Tu oponente Bota cinco cartas");
  assert.equal(e.jugadores[1].cementerio.length, 5);
  assert.equal(e.jugadores[0].reserva.length, 0);
});

test("Castillo Drácula: pagando un Oro no recibes daño de combate hasta tu próximo turno", () => {
  let e = mesa();
  oros(e, 0, 1);
  const c = poner(e, 0, "apoyo", "Castillo Drácula");
  e = hacer(e, habilidad(c, "Castillo Drácula"), "No recibir daño de combate hasta tu próximo turno");
  const f = e.efectos.find((x) => x.tipo === "prevenirDano");
  assert.equal(f.j, 0);
  assert.deepEqual(f.fin, { inicioDe: 0, desde: e.turno });
});

test("Castillo Drácula: o tus cartas no pueden ser afectadas por efectos oponentes hasta tu próximo turno", () => {
  let e = mesa();
  oros(e, 0, 1);
  const c = poner(e, 0, "apoyo", "Castillo Drácula");
  const v = poner(e, 0, "defensa", "Valefor");
  const danza = poner(e, 1, "mano", "Danza del Cuchillo");
  e = hacer(e, habilidad(c, "Castillo Drácula"), "No ser afectado por efectos oponentes hasta tu próximo turno");
  const ctx = { ctrl: 1, fuente: danza, def: e.instancias[danza], vars: {} };
  assert.equal(cumple(e, ctx, v, {}, "destruir"), false);
  e.turno += 1;
  e.activo = 0;
  N.expirar(e, "inicio");
  assert.equal(cumple(e, ctx, v, {}, "destruir"), true);
});

test("Castillo de Karnstein: tiene Exhumar y al entrar Destierra hasta una carta que no sea Oro y Roba dos", () => {
  let e = mesa();
  oros(e, 0, 2);
  const k = poner(e, 0, "mano", "Castillo de Karnstein");
  const g = poner(e, 1, "defensa", "Guardia Real");
  assert.equal(N.tiene(e, k, "Exhumar"), true);
  e = hacer(e, jugar(k), g);
  assert.equal(zonaDe(e, g), "destierro");
  assert.equal(e.jugadores[0].mano.length, 2);
});

test("Castillo de Karnstein: se dispara cuando otro Tótem entra bajo tu control, una vez por turno", () => {
  let e = mesa();
  oros(e, 0, 2);
  poner(e, 0, "apoyo", "Castillo de Karnstein");
  const a1 = poner(e, 0, "mano", "Ahu Tongariki");
  const a2 = poner(e, 0, "mano", "Ahu Tongariki");
  const g = poner(e, 1, "defensa", "Guardia Real");
  e = hacer(e, jugar(a1), g, "Robar dos cartas");
  assert.equal(zonaDe(e, g), "destierro");
  assert.equal(e.jugadores[0].mano.length, 5);
  e = hacer(e, jugar(a2), "Robar dos cartas");
  assert.equal(e.pendiente, null);
  assert.equal(e.jugadores[0].mano.length, 6);
});

test("Castillo de Karnstein: Destruyéndolo Anula una carta jugada durante tu turno", () => {
  let e = mesa();
  const k = poner(e, 0, "apoyo", "Castillo de Karnstein");
  const v = poner(e, 0, "defensa", "Valefor");
  oros(e, 1, 2);
  const danza = poner(e, 1, "mano", "Danza del Cuchillo");
  e.prioridad = 1;
  e.fase = "talismanes";
  e = aplicar(e, jugar(danza));
  const r = accionesLegales(e).find((a) => a.tipo === "responder" && a.uid === k);
  assert.ok(r);
  e = aplicar(e, r);
  assert.equal(zonaDe(e, danza), "cementerio");
  assert.equal(zonaDe(e, k), "cementerio");
  assert.equal(zonaDe(e, v), "defensa");
});

test("Castillo de Karnstein: no Anula cartas jugadas en el turno oponente", () => {
  let e = mesa();
  const k = poner(e, 1, "apoyo", "Castillo de Karnstein");
  oros(e, 0, 1);
  const v = poner(e, 0, "mano", "Valefor");
  e = aplicar(e, jugar(v));
  assert.equal(accionesLegales(e).some((a) => a.tipo === "responder" && a.uid === k), false);
});

test("Cementerio General: al entrar Baraja hasta tantas cartas oponentes de coste 3 o menos como cartas Exhumar controles y Roba dos", () => {
  let e = mesa();
  oros(e, 0, 2);
  const c = poner(e, 0, "mano", "Cementerio General");
  poner(e, 0, "apoyo", "Capilla de los Susurros");
  const v = poner(e, 1, "defensa", "Valefor");
  const g = poner(e, 1, "defensa", "Guardia Real");
  const b = poner(e, 1, "defensa", "Balaur");
  e = hacer(e, jugar(c), v, g);
  assert.equal(zonaDe(e, v), "castillo");
  assert.equal(zonaDe(e, g), "castillo");
  assert.equal(zonaDe(e, b), "defensa");
  assert.equal(e.jugadores[0].mano.length, 2);
});

test("Cementerio General: las cartas de tu Cementerio no pueden ser Desterradas por efectos", () => {
  const e = mesa();
  poner(e, 0, "apoyo", "Cementerio General");
  const x = poner(e, 0, "cementerio", "Valefor");
  const y = poner(e, 1, "cementerio", "Valefor");
  OPS.mover(e, { var: "x", a: "desterrar" }, { ctx: { ctrl: 1, vars: { x: [x, y] } } });
  assert.equal(zonaDe(e, x), "cementerio");
  assert.equal(zonaDe(e, y), "destierro");
});

test("Cementerio General: las cartas de tu Cementerio no pueden perder su habilidad", { todo: "continua: las cartas de tu Cementerio no pierden su habilidad (noPierden no alcanza cartas fuera del juego)" }, () => {});

test("Cementerio General: tus Aliados con Exhumar ganan Furia", () => {
  const e = mesa();
  poner(e, 0, "apoyo", "Cementerio General");
  const b = poner(e, 0, "defensa", "Carmilla");
  const g = poner(e, 0, "defensa", "Guardia Real");
  const r = poner(e, 1, "defensa", "Carmilla");
  assert.equal(N.tiene(e, b, "Furia"), true);
  assert.equal(N.tiene(e, g, "Furia"), false);
  assert.equal(N.tiene(e, r, "Furia"), false);
});

test("Cementerio Maldito: una vez por turno Baraja o Destierra hasta cuatro cartas de los Cementerios", () => {
  let e = mesa();
  const c = poner(e, 0, "apoyo", "Cementerio Maldito");
  const x = poner(e, 1, "cementerio", "Valefor");
  const y = poner(e, 0, "cementerio", "Valefor");
  e = hacer(e, habilidad(c, "Cementerio Maldito"), x, y, "Desterrar");
  assert.equal(zonaDe(e, x), "destierro");
  assert.equal(zonaDe(e, y), "destierro");
  assert.equal(usable(e, c), false);
});

test("Cementerio Maldito: el tipo elegido de coste 1 o más gana Exhumar en tu Cementerio por el turno", () => {
  let e = mesa();
  oros(e, 0, 2);
  const c = poner(e, 0, "apoyo", "Cementerio Maldito");
  assert.equal(N.tiene(e, c, "Exhumar"), true);
  const g = poner(e, 0, "cementerio", "Guardia Real");
  const p = poner(e, 0, "cementerio", "Pedrenyal");
  e = hacer(e, habilidad(c, "Cementerio Maldito", 1), "Aliado");
  assert.equal(N.tiene(e, g, "Exhumar"), true);
  assert.equal(N.tiene(e, p, "Exhumar"), false);
  assert.ok(accionesLegales(e).some((a) => a.tipo === "jugar" && a.uid === g && a.desde === "cementerio"));
  assert.equal(usable(e, c, 1), false);
  N.expirar(e, "finTurno");
  e.turno += 1;
  N.expirar(e, "finTurno");
  assert.equal(N.tiene(e, g, "Exhumar"), false);
});

test("Cementerio de Kingstead: tiene Exhumar y al entrar una carta pierde su habilidad hasta tu próximo turno", () => {
  let e = mesa();
  oros(e, 0, 1);
  const k = poner(e, 0, "mano", "Cementerio de Kingstead");
  const r = poner(e, 1, "defensa", "Valefor");
  assert.equal(N.tiene(e, k, "Exhumar"), true);
  e = hacer(e, jugar(k), true, r);
  assert.equal(N.activa(e, r), false);
  assert.equal(N.tiene(e, r, "Furia"), false);
  e.turno += 1;
  e.activo = 0;
  N.expirar(e, "inicio");
  assert.equal(N.activa(e, r), true);
});

test("Cementerio de Kingstead: al comienzo de tu turno puedes Destruirlo para que tu oponente Bote tres cartas", () => {
  let e = mesa();
  const k = poner(e, 0, "apoyo", "Cementerio de Kingstead");
  e.activo = 1;
  e = hacer(e, { tipo: "terminar" }, true);
  assert.equal(e.activo, 0);
  assert.equal(zonaDe(e, k), "cementerio");
  assert.equal(e.jugadores[1].cementerio.length, 3);
});

test("Chestnut Hill: está transcrita y entra en juego como Tótem", () => {
  let e = mesa();
  oros(e, 0, 1);
  const c = poner(e, 0, "mano", "Chestnut Hill");
  assert.equal(TRANSCRITAS.has("Chestnut Hill"), true);
  e = aplicar(e, jugar(c));
  assert.equal(zonaDe(e, c), "apoyo");
});

test("Chestnut Hill: cuando una carta tuya fuera a salir del juego por un efecto oponente, lanza un dado para prevenirlo", { todo: "evento de reemplazo: cuando una carta fuera a salir del juego por un efecto oponente" }, () => {});
