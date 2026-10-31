import { test } from "node:test";
import assert from "node:assert/strict";
import { mesa, poner, oros, elegir, sinRespuesta, accionesLegales, aplicar, zonaDe, id, N } from "./ayuda-duelo.mjs";
import { resolver, armaCabe, OPS } from "../web/duelo/efectos.js";

const jugar = (uid, extra = {}) => ({ tipo: "jugar", uid, ...extra });
const habilidad = (uid, nombre, h = 0) => ({ tipo: "habilidad", uid, def: id(nombre), h });
const nombreDe = (e, nombre) => (v) => v !== null && N.carta(e, v).nombre === nombre;
const texto = (inicio) => (v, o) => (o.texto ?? "").startsWith(inicio);
const puedeUsar = (e, uid, h) => accionesLegales(e).some((a) => a.tipo === "habilidad" && a.uid === uid && (h === undefined || a.h === h));
const generados = (e, j) => (e.jugadores[j].generados ?? []).reduce((s, g) => s + g.n, 0);
const puedeTerminar = (e) => accionesLegales(e).some((a) => a.tipo === "terminar");

function alTope(e, j, nombre) {
  const uid = poner(e, j, "castillo", nombre);
  N.sacar(e, uid);
  e.jugadores[j].castillo.unshift(uid);
  return uid;
}

function con(e, nombre, extra) {
  const k = id(nombre);
  e.catalogo = { ...e.catalogo, [k]: { ...e.catalogo[k], ...extra } };
  return e;
}

function turnoRival(e) {
  e.turno += 1;
  e.activo = 1;
  return e;
}

test("Grisgrís: es Oro Inicial y al comienzo de la Vigilia oponente Destierra hasta una carta de los Cementerios por cada Aliado que atacó en tu turno", () => {
  let e = mesa();
  const g = poner(e, 0, "reserva", "Grisgrís");
  assert.equal(N.carta(e, g).oroInicial, true);
  const a = poner(e, 0, "defensa", "Valefor");
  const b = poner(e, 0, "defensa", "Valefor");
  const c = [0, 1, 1].map((j) => poner(e, j, "cementerio", "Valefor"));
  e = aplicar(e, { tipo: "batalla" });
  e = aplicar(e, { tipo: "atacar", uid: a });
  e = aplicar(e, { tipo: "atacar", uid: b });
  e = turnoRival(e);
  N.disparar(e, "comienzoVigilia", { j: 1 });
  resolver(e);
  e = elegir(e, true);
  e = elegir(e, c[0]);
  e = elegir(e, c[1]);
  assert.deepEqual(c.map((u) => zonaDe(e, u)), ["destierro", "destierro", "cementerio"]);
  assert.equal(e.pendiente, null);
});

test("Grisgrís: si ningún Aliado atacó en tu turno no Destierra nada", () => {
  const e = mesa();
  poner(e, 0, "reserva", "Grisgrís");
  poner(e, 1, "cementerio", "Valefor");
  turnoRival(e);
  N.disparar(e, "comienzoVigilia", { j: 1 });
  resolver(e);
  assert.equal(e.pendiente, null);
});

test("Grisgrís: en la Vigilia oponente solo se pueden jugar dos Talismanes y usar dos habilidades", { todo: "efecto: máximo de Talismanes jugados y habilidades usadas durante una Vigilia" }, () => {});

test("Guitarra Morisca: Destruyéndola reduce a 0 el daño que fueras a recibir este turno", () => {
  let e = mesa();
  const g = poner(e, 0, "reserva", "Guitarra Morisca");
  e = aplicar(e, habilidad(g, "Guitarra Morisca", 0));
  assert.equal(zonaDe(e, g), "cementerio");
  e.activo = 1;
  const at = poner(e, 1, "ataque", "Valefor");
  e.atacantes = [at];
  e.bloqueos = {};
  OPS.flujo(e, { paso: "dano" });
  assert.equal(e.jugadores[0].castillo.length, 30);
});

test("Guitarra Morisca: Desterrándola de tu Cementerio Barajas hasta tres cartas de tu Cementerio", () => {
  let e = mesa();
  const g = poner(e, 0, "cementerio", "Guitarra Morisca");
  const c = [1, 2, 3, 4].map(() => poner(e, 0, "cementerio", "Valefor"));
  e = aplicar(e, habilidad(g, "Guitarra Morisca", 1));
  e = elegir(e, c[0]);
  e = elegir(e, c[1]);
  e = elegir(e, c[2]);
  assert.equal(zonaDe(e, g), "destierro");
  assert.deepEqual(c.map((u) => zonaDe(e, u)), ["castillo", "castillo", "castillo", "cementerio"]);
});

test("Hervidero de Sangre: al entrar desde tu mano intercambia su control con un Oro oponente", () => {
  let e = mesa();
  const h = poner(e, 0, "mano", "Hervidero de Sangre");
  const o = poner(e, 1, "reserva", "Drácula");
  e = aplicar(e, { tipo: "oro", uid: h });
  e = elegir(e, true);
  assert.equal(N.controlador(e, h), 1);
  assert.equal(N.controlador(e, o), 0);
  assert.ok(e.jugadores[0].reserva.includes(o));
  assert.ok(e.jugadores[1].reserva.includes(h));
});

test("Hervidero de Sangre: es Única y no se juega otra copia si ya controlas una", () => {
  const e = mesa();
  poner(e, 0, "reserva", "Hervidero de Sangre");
  const otra = poner(e, 0, "mano", "Hervidero de Sangre");
  assert.equal(accionesLegales(e).some((a) => a.tipo === "oro" && a.uid === otra), false);
});

test("Hidromiel: al entrar Baraja hasta tres cartas de un Cementerio y Roba dos cartas", () => {
  let e = mesa();
  const h = poner(e, 0, "mano", "Hidromiel");
  const c = [1, 2, 3, 4].map(() => poner(e, 1, "cementerio", "Valefor"));
  const mia = poner(e, 0, "cementerio", "Valefor");
  e = aplicar(e, { tipo: "oro", uid: h });
  e = elegir(e, texto("Cementerio oponente"));
  e = elegir(e, c[0]);
  e = elegir(e, c[1]);
  e = elegir(e, c[2]);
  assert.deepEqual(c.map((u) => zonaDe(e, u)), ["castillo", "castillo", "castillo", "cementerio"]);
  assert.equal(zonaDe(e, mia), "cementerio");
  assert.equal(e.jugadores[0].mano.length, 2);
});

test("Hostias Consagradas: es Oro Inicial y no puede perder su habilidad", () => {
  const e = mesa();
  const h = poner(e, 0, "reserva", "Hostias Consagradas");
  assert.equal(N.carta(e, h).oroInicial, true);
  N.agregarEfecto(e, { tipo: "pierdeHabilidad", uid: h }, 1);
  assert.equal(N.activa(e, h), true);
});

test("Hostias Consagradas: al jugar una tercera carta del mismo tipo en el turno se Baraja una carta de la mano", () => {
  let e = mesa();
  poner(e, 0, "reserva", "Hostias Consagradas");
  oros(e, 0, 3);
  const m = [1, 2, 3].map(() => poner(e, 0, "mano", "Llamar a la Manada"));
  e = sinRespuesta(aplicar(e, jugar(m[0])));
  e = sinRespuesta(aplicar(e, jugar(m[1])));
  assert.equal(e.pendiente, null);
  assert.equal(e.jugadores[0].castillo.length, 24);
  e = aplicar(e, jugar(m[2]));
  assert.equal(e.pendiente.jugador, 0);
  e = elegir(e, (v) => v !== null);
  e = sinRespuesta(e);
  assert.equal(e.jugadores[0].castillo.length, 22);
  assert.equal(e.jugadores[0].mano.length, 8);
});

test("Hostias Consagradas: si controlas un Sacerdote los Aliados oponentes deben atacar si pueden", () => {
  const e = con(mesa(), "Guardia Real", { razas: ["Sacerdote"] });
  poner(e, 0, "reserva", "Hostias Consagradas");
  poner(e, 1, "defensa", "Valefor");
  turnoRival(e);
  assert.equal(puedeTerminar(e), true);
  poner(e, 0, "defensa", "Guardia Real");
  assert.equal(puedeTerminar(e), false);
});

test("Huevos de Oro: pagando un Oro convierte la carta del tope de un Castillo en un Oro sin habilidad en tu Oro Pagado, una vez por partida", () => {
  let e = mesa();
  oros(e, 0, 1);
  const h = poner(e, 0, "reserva", "Huevos de Oro");
  assert.equal(N.carta(e, h).oroInicial, true);
  const tope = alTope(e, 1, "Valefor");
  e = aplicar(e, habilidad(h, "Huevos de Oro"));
  e = elegir(e, texto("Castillo oponente"));
  assert.equal(zonaDe(e, tope), "pagado");
  assert.equal(N.controlador(e, tope), 0);
  assert.equal(N.carta(e, tope).tipo, "Oro");
  assert.equal(N.carta(e, tope).sinHabilidad, true);
  e.turno += 2;
  oros(e, 0, 2);
  assert.equal(puedeUsar(e, h), false);
});

test("Huevos de Oro: no se pueden generar ni agrupar Oros por efectos más de una vez por turno", { todo: "efecto: generar o agrupar Oros por efectos solo una vez por turno" }, () => {});

test("Incensario Serafico: cuando el oponente pone su segundo Oro del turno puedes ponerlo desde tu mano en tu Oro Pagado", () => {
  let e = mesa();
  const inc = poner(e, 0, "mano", "Incensario Serafico");
  const o = poner(e, 1, "mano", "Drácula");
  turnoRival(e);
  e.jugadores[1].orosPuestos = 1;
  e = aplicar(e, { tipo: "oro", uid: o });
  assert.equal(e.pendiente.jugador, 0);
  e = elegir(e, true);
  assert.equal(zonaDe(e, inc), "pagado");
  assert.ok(e.jugadores[0].pagado.includes(inc));
});

test("Incensario Serafico: no se pone si es el primer Oro que pone el oponente", () => {
  let e = mesa();
  poner(e, 0, "cementerio", "Incensario Serafico");
  const o = poner(e, 1, "mano", "Drácula");
  turnoRival(e);
  e = aplicar(e, { tipo: "oro", uid: o });
  assert.equal(e.pendiente, null);
});

test("Incensario Serafico: una vez por turno pagas un Oro para Robar dos cartas", () => {
  let e = mesa();
  oros(e, 0, 2);
  const inc = poner(e, 0, "reserva", "Incensario Serafico");
  e = aplicar(e, habilidad(inc, "Incensario Serafico"));
  assert.equal(e.jugadores[0].mano.length, 2);
  assert.equal(puedeUsar(e, inc), false);
});

test("Infernum Vox: en tu Vigilia, si no pusiste Oros, se pone de tu mano en tu Reserva y Roba una carta al entrar", () => {
  let e = mesa();
  const iv = poner(e, 0, "mano", "Infernum Vox");
  e = aplicar(e, habilidad(iv, "Infernum Vox", 0));
  assert.equal(zonaDe(e, iv), "reserva");
  assert.equal(e.jugadores[0].mano.length, 1);
});

test("Infernum Vox: no se pone desde la mano si ya pusiste un Oro este turno", () => {
  const e = mesa();
  const iv = poner(e, 0, "mano", "Infernum Vox");
  e.jugadores[0].orosPuestos = 1;
  assert.equal(puedeUsar(e, iv), false);
});

test("Infernum Vox: los Aliados oponentes pierden 1 de Fuerza", () => {
  const e = mesa();
  poner(e, 0, "reserva", "Infernum Vox");
  const mio = poner(e, 0, "defensa", "Valefor");
  const suyo = poner(e, 1, "defensa", "Valefor");
  assert.equal(N.fuerza(e, mio), 3);
  assert.equal(N.fuerza(e, suyo), 2);
});

test("Infernum Vox: una vez por turno mira seis cartas del tope de un Castillo y devuelve las elegidas al fondo", () => {
  let e = mesa();
  const iv = poner(e, 0, "reserva", "Infernum Vox");
  const tope = alTope(e, 1, "Valefor");
  e = aplicar(e, habilidad(iv, "Infernum Vox", 1));
  e = elegir(e, texto("Castillo oponente"));
  e = elegir(e, tope);
  e = elegir(e, null);
  assert.equal(e.jugadores[1].castillo.at(-1), tope);
  assert.equal(e.jugadores[1].castillo.length, 31);
  assert.equal(puedeUsar(e, iv, 1), false);
});

test("Insignia del Guerrero: al entrar muestra hasta un Aliado y un Arma de coste 2 o menos, los pone en tu mano y Baraja el resto", () => {
  let e = mesa();
  const ins = poner(e, 0, "mano", "Insignia del Guerrero");
  const arma = alTope(e, 0, "Pedrenyal");
  const aliado = alTope(e, 0, "Valefor");
  const caro = alTope(e, 0, "Balaur");
  e = aplicar(e, { tipo: "oro", uid: ins });
  e = elegir(e, true);
  assert.equal(zonaDe(e, aliado), "mano");
  assert.equal(zonaDe(e, arma), "mano");
  assert.equal(zonaDe(e, caro), "castillo");
  assert.equal(e.jugadores[0].castillo.length, 31);
});

test("Insignia del Guerrero: en Batalla Mitológica se Destierra para prevenir un efecto que afecte Aliados", { todo: "respuesta: Desterrar un Oro para prevenir un efecto que afecte Aliados" }, () => {});

test("Kultrung: es Única y pagándolo genera dos Oros por el turno", () => {
  let e = mesa();
  const k = poner(e, 0, "reserva", "Kultrung");
  assert.ok(N.carta(e, k).claves.includes("UnaCopia"));
  e = aplicar(e, habilidad(k, "Kultrung"));
  assert.equal(zonaDe(e, k), "pagado");
  assert.equal(generados(e, 0), 2);
});

test("Kultrung: los Oros generados solo sirven para jugar cartas de coste 4 o más", { todo: "generar: Oro generado restringido a cartas de coste mínimo" }, () => {});

test("Kultrung: si el daño oponente lo pone en tu Cementerio puedes subirlo a tu mano", () => {
  let e = mesa();
  const k = alTope(e, 0, "Kultrung");
  turnoRival(e);
  N.quitarDelCastillo(e, 0, 1, "cementerio", false, true);
  resolver(e);
  assert.equal(e.pendiente.jugador, 0);
  e = elegir(e, true);
  assert.equal(zonaDe(e, k), "mano");
});

test("Kultrung: si lo pones en tu Cementerio en tu turno no se sube a la mano", () => {
  const e = mesa();
  const k = poner(e, 0, "reserva", "Kultrung");
  N.mover(e, k, "cementerio");
  resolver(e);
  assert.equal(e.pendiente, null);
  assert.equal(zonaDe(e, k), "cementerio");
});

test("La Estrella Solitaria: una vez por turno pagas un Oro para buscar una carta que no sea Talismán", () => {
  let e = mesa();
  oros(e, 0, 2);
  const es = poner(e, 0, "reserva", "La Estrella Solitaria");
  const v = poner(e, 0, "castillo", "Valefor");
  poner(e, 0, "castillo", "Llamar a la Manada");
  e = aplicar(e, habilidad(es, "La Estrella Solitaria"));
  assert.equal(e.pendiente.opciones.some((o) => o.valor && N.carta(e, o.valor).tipo === "Talismán"), false);
  e = elegir(e, v);
  assert.equal(zonaDe(e, v), "mano");
  assert.equal(puedeUsar(e, es), false);
});

test("La Estrella Solitaria: tus Aliados no pueden perder su habilidad", () => {
  const e = mesa();
  poner(e, 0, "reserva", "La Estrella Solitaria");
  const mio = poner(e, 0, "defensa", "Valefor");
  const suyo = poner(e, 1, "defensa", "Valefor");
  N.agregarEfecto(e, { tipo: "pierdeHabilidad", uid: mio }, 1);
  N.agregarEfecto(e, { tipo: "pierdeHabilidad", uid: suyo }, 0);
  assert.equal(N.activa(e, mio), true);
  assert.equal(N.activa(e, suyo), false);
});

test("La Estrella Solitaria: tus demás Oros no pueden ser afectados por Talismanes oponentes", { todo: "efecto: no puede ser afectado por Talismanes oponentes" }, () => {});

test("La Isla del Doctor Moreau: al entrar genera un Oro", () => {
  let e = mesa();
  const m = poner(e, 0, "mano", "La Isla del Doctor Moreau");
  e = aplicar(e, { tipo: "oro", uid: m });
  assert.equal(generados(e, 0), 1);
});

test("La Isla del Doctor Moreau: el Oro generado solo sirve para jugar cartas de coste 4 o más", { todo: "generar: Oro generado restringido a cartas de coste mínimo" }, () => {});

test("La Isla del Doctor Moreau: una vez por turno pagas un Oro para Barajar hasta dos cartas de los Cementerios y Robar una", () => {
  let e = mesa();
  oros(e, 0, 2);
  const m = poner(e, 0, "reserva", "La Isla del Doctor Moreau");
  const c = [0, 1, 1].map((j) => poner(e, j, "cementerio", "Valefor"));
  e = aplicar(e, habilidad(m, "La Isla del Doctor Moreau"));
  e = elegir(e, c[0]);
  e = elegir(e, c[1]);
  assert.deepEqual(c.map((u) => zonaDe(e, u)), ["castillo", "castillo", "cementerio"]);
  assert.equal(e.jugadores[0].mano.length, 1);
  assert.equal(puedeUsar(e, m), false);
});

test("La Isla del Tesoro: al pagarla para jugar un Aliado Destierras hasta tantas cartas del Cementerio oponente como su coste", () => {
  let e = mesa();
  const t = poner(e, 0, "reserva", "La Isla del Tesoro");
  oros(e, 0, 1);
  const g = poner(e, 0, "mano", "Guardia Real");
  const c = [1, 2, 3].map(() => poner(e, 1, "cementerio", "Valefor"));
  e = aplicar(e, jugar(g));
  assert.ok(e.jugadores[0].pagado.includes(t));
  e = elegir(e, true);
  e = elegir(e, c[0]);
  e = elegir(e, c[1]);
  e = sinRespuesta(e);
  assert.deepEqual(c.map((u) => zonaDe(e, u)), ["destierro", "destierro", "cementerio"]);
  assert.equal(zonaDe(e, g), "defensa");
});

test("La Isla del Tesoro: con ocho o más cartas en el Destierro oponente tus demás cartas no pueden perder su habilidad", { todo: "efecto: no pueden perder su habilidad bajo una condición (continua aliadosNoPierden con si)" }, () => {});

test("La Ouija: al entrar pone la última carta de tu Castillo en tu mano", () => {
  let e = mesa();
  const o = poner(e, 0, "mano", "La Ouija");
  const fondo = poner(e, 0, "castillo", "Valefor");
  e = aplicar(e, { tipo: "oro", uid: o });
  e = elegir(e, texto("La última"));
  assert.equal(zonaDe(e, fondo), "mano");
});

test("La Ouija: una vez por turno juega una carta de tu Cementerio pagando su coste", () => {
  let e = mesa();
  oros(e, 0, 2);
  const o = poner(e, 0, "reserva", "La Ouija");
  const v = poner(e, 0, "cementerio", "Valefor");
  e = aplicar(e, habilidad(o, "La Ouija"));
  assert.equal(zonaDe(e, v), "defensa");
  assert.equal(e.jugadores[0].reserva.length, 2);
  assert.equal(puedeUsar(e, o), false);
});

test("La Ouija: juega un Talismán del tope de tu Castillo", () => {
  let e = mesa();
  oros(e, 0, 1);
  const o = poner(e, 0, "reserva", "La Ouija");
  const m = alTope(e, 0, "Llamar a la Manada");
  e = aplicar(e, habilidad(o, "La Ouija"));
  assert.equal(zonaDe(e, m), "cementerio");
  assert.equal(e.jugadores[0].mano.length, 3);
  assert.equal(e.jugadores[0].pagado.length, 1);
});

test("Laboratorio Maldito: en tu Vigilia pagándolo buscas un Aliado en tu Castillo", () => {
  let e = mesa();
  const lab = poner(e, 0, "reserva", "Laboratorio Maldito");
  const v = poner(e, 0, "castillo", "Valefor");
  e = aplicar(e, habilidad(lab, "Laboratorio Maldito", 0));
  e = elegir(e, v);
  assert.equal(zonaDe(e, v), "mano");
  assert.equal(zonaDe(e, lab), "pagado");
});

test("Laboratorio Maldito: una vez por turno un Aliado de tu Cementerio gana Exhumar por el turno", () => {
  let e = mesa();
  oros(e, 0, 1);
  const lab = poner(e, 0, "reserva", "Laboratorio Maldito");
  const v = poner(e, 0, "cementerio", "Valefor");
  e = aplicar(e, habilidad(lab, "Laboratorio Maldito", 1));
  assert.equal(N.tiene(e, v, "Exhumar"), true);
  assert.ok(accionesLegales(e).some((a) => a.tipo === "jugar" && a.uid === v && a.desde === "cementerio"));
  assert.equal(puedeUsar(e, lab, 1), false);
});

test("Lagrima de Dragón: es Oro Inicial, Indesterrable, no pierde su habilidad y las cartas no cambian de controlador", () => {
  const e = mesa();
  const l = poner(e, 0, "reserva", "Lagrima de Dragón");
  assert.equal(N.carta(e, l).oroInicial, true);
  assert.equal(N.tiene(e, l, "Indesterrable"), true);
  N.agregarEfecto(e, { tipo: "pierdeHabilidad", uid: l }, 1);
  assert.equal(N.activa(e, l), true);
  const suyo = poner(e, 1, "defensa", "Valefor");
  assert.equal(N.puedeTomar(e, suyo, 0), false);
});

test("Lagrima de Dragón: cuando un Aliado oponente es Destruido en la asignación de daño puedes Robar una carta", () => {
  let e = mesa();
  poner(e, 0, "reserva", "Lagrima de Dragón");
  const at = poner(e, 0, "ataque", "Guardia Real");
  const bl = poner(e, 1, "defensa", "El Dracul");
  e.fase = "danando";
  e.atacantes = [at];
  e.bloqueos = { [bl]: at };
  OPS.flujo(e, { paso: "dano" });
  resolver(e);
  assert.equal(zonaDe(e, bl), "cementerio");
  e = elegir(e, true);
  assert.equal(e.jugadores[0].mano.length, 1);
});

test("Lagrima de Dragón: el oponente debe atacar si puede", () => {
  const e = mesa();
  poner(e, 0, "reserva", "Lagrima de Dragón");
  poner(e, 1, "defensa", "Valefor");
  turnoRival(e);
  assert.equal(puedeTerminar(e), false);
});

test("Lagrima de Dragón: su controlador también debe atacar y ambos deben bloquear si pueden", { todo: "efecto: todos los jugadores deben atacar y bloquear si pueden" }, () => {});

test("Las Aventuras de Alicia en el Pais de las Maravillas: en tu Vigilia, si no controlas más Oros, pagas un Oro para ponerla desde tu mano en tu Oro Pagado", () => {
  let e = mesa();
  oros(e, 0, 1);
  oros(e, 1, 1);
  const a = poner(e, 0, "mano", "Las Aventuras de Alicia en el Pais de las Maravillas");
  e = aplicar(e, habilidad(a, "Las Aventuras de Alicia en el Pais de las Maravillas", 0));
  assert.equal(zonaDe(e, a), "pagado");
  assert.equal(e.jugadores[0].pagado.length, 2);
});

test("Las Aventuras de Alicia en el Pais de las Maravillas: no se pone desde la mano si controlas más Oros que tu oponente", () => {
  const e = mesa();
  oros(e, 0, 2);
  oros(e, 1, 1);
  const a = poner(e, 0, "mano", "Las Aventuras de Alicia en el Pais de las Maravillas");
  assert.equal(puedeUsar(e, a), false);
});

test("Las Aventuras de Alicia en el Pais de las Maravillas: pagando un Oro Robas tres y Barajas dos de tu mano, una vez por turno", () => {
  let e = mesa();
  const a = poner(e, 0, "reserva", "Las Aventuras de Alicia en el Pais de las Maravillas");
  oros(e, 0, 1);
  e = aplicar(e, habilidad(a, "Las Aventuras de Alicia en el Pais de las Maravillas", 1));
  e = elegir(e, texto("Robar tres"));
  const [x, y] = e.jugadores[0].mano;
  e = elegir(e, x);
  e = elegir(e, y);
  assert.equal(e.jugadores[0].mano.length, 1);
  assert.equal(e.jugadores[0].castillo.length, 29);
  assert.equal(puedeUsar(e, a), false);
});

test("Las Aventuras de Alicia en el Pais de las Maravillas: pagando un Oro juega un Arma reduciendo su coste en uno", () => {
  let e = mesa();
  const a = poner(e, 0, "reserva", "Las Aventuras de Alicia en el Pais de las Maravillas");
  const guardia = poner(e, 0, "defensa", "Guardia Real");
  const arma = poner(e, 0, "mano", "Pedrenyal");
  e = aplicar(e, habilidad(a, "Las Aventuras de Alicia en el Pais de las Maravillas", 1));
  e = elegir(e, texto("Jugar un Arma"));
  assert.deepEqual(e.armas[guardia], [arma]);
  assert.equal(N.fuerza(e, guardia), 5);
  assert.equal(e.jugadores[0].reserva.length, 0);
});

test("Las Aventuras de Sherlock Holmes: al entrar busca otra copia en tu Castillo", () => {
  let e = mesa();
  const s = poner(e, 0, "mano", "Las Aventuras de Sherlock Holmes");
  const copia = poner(e, 0, "castillo", "Las Aventuras de Sherlock Holmes");
  e = aplicar(e, { tipo: "oro", uid: s });
  e = elegir(e, copia);
  assert.equal(zonaDe(e, copia), "mano");
});

test("Las Aventuras de Sherlock Holmes: tus Aliados ganan Fuerza por otras copias en tu Oro Pagado y los oponentes pierden por copias en tu Reserva", () => {
  const e = mesa();
  poner(e, 0, "reserva", "Las Aventuras de Sherlock Holmes");
  poner(e, 0, "pagado", "Las Aventuras de Sherlock Holmes");
  const mio = poner(e, 0, "defensa", "Valefor");
  const suyo = poner(e, 1, "defensa", "Valefor");
  assert.equal(N.fuerza(e, mio), 4);
  assert.equal(N.fuerza(e, suyo), 1);
});

test("Legión de Honor: en tu Reserva tus Aliados ganan 1 de Fuerza y pagándola mueve un Oro oponente a su Oro Pagado", () => {
  let e = mesa();
  const l = poner(e, 0, "reserva", "Legión de Honor");
  const mio = poner(e, 0, "defensa", "Valefor");
  const [o] = oros(e, 1, 1);
  assert.equal(N.fuerza(e, mio), 4);
  e = aplicar(e, habilidad(l, "Legión de Honor"));
  assert.equal(zonaDe(e, o), "pagado");
  assert.equal(zonaDe(e, l), "pagado");
  assert.equal(N.fuerza(e, mio), 3);
});

test("Legión de Honor: sin Oros oponentes en Reserva no se puede usar", () => {
  const e = mesa();
  const l = poner(e, 0, "reserva", "Legión de Honor");
  assert.equal(puedeUsar(e, l), false);
});

test("Levisterio: al entrar Roba una y, si no tienes más de un Talismán, genera un Oro para Armas y Roba otra", () => {
  let e = mesa();
  const l = poner(e, 0, "mano", "Levisterio");
  e = aplicar(e, { tipo: "oro", uid: l });
  assert.equal(e.jugadores[0].mano.length, 2);
  assert.deepEqual(e.jugadores[0].generados, [{ n: 1, tipos: ["Arma"] }]);
});

test("Levisterio: con dos Talismanes en la mano solo Roba una carta", () => {
  let e = mesa();
  const l = poner(e, 0, "mano", "Levisterio");
  poner(e, 0, "mano", "Llamar a la Manada");
  poner(e, 0, "mano", "Llamar a la Manada");
  e = aplicar(e, { tipo: "oro", uid: l });
  assert.equal(e.jugadores[0].mano.length, 3);
  assert.equal(generados(e, 0), 0);
});

test("Levisterio: tus Aliados pueden portar un Arma adicional", () => {
  const e = mesa();
  const g = poner(e, 0, "defensa", "Guardia Real");
  poner(e, 0, "arma", "Pedrenyal", { portador: g });
  const otra = poner(e, 0, "mano", "Pedrenyal");
  assert.equal(armaCabe(e, g, otra), false);
  poner(e, 0, "reserva", "Levisterio");
  assert.equal(armaCabe(e, g, otra), true);
});

test("Libro de Revelaciones: es Única y al entrar pone en tu mano una de las tres primeras cartas de tu Castillo", () => {
  let e = mesa();
  const l = poner(e, 0, "mano", "Libro de Revelaciones");
  assert.ok(N.carta(e, l).claves.includes("UnaCopia"));
  const v = alTope(e, 0, "Valefor");
  e = aplicar(e, { tipo: "oro", uid: l });
  e = elegir(e, v);
  assert.equal(zonaDe(e, v), "mano");
  assert.equal(e.jugadores[0].castillo.length, 30);
});

test("Libro de Revelaciones: en tu Reserva no pierde su habilidad y los demás Oros no pueden ser convertidos", { todo: "efecto: no pierde su habilidad mientras esté en la Reserva; los Oros no pueden ser convertidos" }, () => {});

test("Libro de las Obras: al entrar Baraja hasta cuatro cartas de los Cementerios y Roba una", () => {
  let e = mesa();
  const l = poner(e, 0, "mano", "Libro de las Obras");
  const c = [0, 0, 1, 1, 1].map((j) => poner(e, j, "cementerio", "Valefor"));
  e = aplicar(e, { tipo: "oro", uid: l });
  for (const u of c.slice(0, 4)) e = elegir(e, u);
  assert.deepEqual(c.map((u) => zonaDe(e, u)), ["castillo", "castillo", "castillo", "castillo", "cementerio"]);
  assert.equal(e.jugadores[0].mano.length, 1);
});

test("Libro de las Obras: si el oponente controla dos Oros más, se convierte en Oro sin habilidad para subir un Oro del Oro Pagado a la mano de su dueño", () => {
  let e = mesa();
  const l = poner(e, 0, "reserva", "Libro de las Obras");
  oros(e, 1, 2);
  const o = poner(e, 1, "pagado", "Drácula");
  e = aplicar(e, habilidad(l, "Libro de las Obras"));
  assert.equal(zonaDe(e, o), "mano");
  assert.ok(e.jugadores[1].mano.includes(o));
  assert.equal(N.carta(e, l).sinHabilidad, true);
  assert.equal(zonaDe(e, l), "reserva");
});

test("Libro de las Obras: sin dos Oros de diferencia no se puede usar", () => {
  const e = mesa();
  const l = poner(e, 0, "reserva", "Libro de las Obras");
  oros(e, 1, 1);
  poner(e, 1, "pagado", "Drácula");
  assert.equal(puedeUsar(e, l), false);
});

test("Llave del Abismo: cuando un Aliado con Furia entra bajo tu control el oponente Bota una carta", () => {
  let e = mesa();
  poner(e, 0, "reserva", "Llave del Abismo");
  oros(e, 0, 5);
  const b = poner(e, 0, "mano", "Balaur");
  const v = poner(e, 0, "mano", "Guardia Real");
  e = sinRespuesta(aplicar(e, jugar(b)));
  assert.equal(zonaDe(e, b), "defensa");
  assert.equal(e.jugadores[1].castillo.length, 29);
  e = sinRespuesta(aplicar(e, jugar(v)));
  assert.equal(e.jugadores[1].castillo.length, 29);
});

test("Llave del Abismo: tus Aliados ganan 1 de Fuerza e Indestructible", () => {
  const e = mesa();
  poner(e, 0, "reserva", "Llave del Abismo");
  const mio = poner(e, 0, "defensa", "Valefor");
  const suyo = poner(e, 1, "defensa", "Valefor");
  assert.equal(N.fuerza(e, mio), 4);
  assert.equal(N.tiene(e, mio, "Indestructible"), true);
  assert.equal(N.fuerza(e, suyo), 3);
  assert.equal(N.tiene(e, suyo, "Indestructible"), false);
});

test("Los Siete Sellos: es Oro Inicial y Única", () => {
  const e = mesa();
  const s = poner(e, 0, "reserva", "Los Siete Sellos");
  assert.equal(N.carta(e, s).oroInicial, true);
  assert.ok(N.carta(e, s).claves.includes("UnaCopia"));
});

test("Los Siete Sellos: hasta dos veces por turno, al resolverse uno de tus Talismanes Sello, el oponente Bota dos cartas", () => {
  let e = con(mesa(), "Primer Sello", { talisman: [], requiere: undefined, disparadas: [] });
  poner(e, 0, "reserva", "Los Siete Sellos");
  oros(e, 0, 3);
  const s = [1, 2, 3].map(() => poner(e, 0, "mano", "Primer Sello"));
  for (const u of s) e = sinRespuesta(aplicar(e, jugar(u)));
  assert.deepEqual(s.map((u) => zonaDe(e, u)), ["cementerio", "cementerio", "cementerio"]);
  assert.equal(e.jugadores[1].castillo.length, 26);
});

test("Los Siete Sellos: un Sello que llega al Cementerio sin resolverse no hace Botar", () => {
  const e = mesa();
  poner(e, 0, "reserva", "Los Siete Sellos");
  const s = poner(e, 0, "mano", "Primer Sello");
  N.mover(e, s, "cementerio");
  resolver(e);
  assert.equal(e.jugadores[1].castillo.length, 30);
});

test("Los Siete Sellos: no puede ser convertido y no pagas costes adicionales de cartas Sello", { todo: "efecto: no puede ser convertido; ignora costes adicionales de cartas de un subtipo" }, () => {});

test("Lycón: en tu Oro Pagado, con entre uno y tres Aliados atacando, las cartas del Cementerio oponente pierden su habilidad", () => {
  const e = mesa();
  poner(e, 0, "pagado", "Lycón");
  const cem = poner(e, 1, "cementerio", "Vision Heroica");
  assert.equal(N.activa(e, cem), true);
  poner(e, 0, "ataque", "Valefor");
  assert.equal(N.activa(e, cem), false);
  for (let i = 0; i < 3; i++) poner(e, 0, "ataque", "Valefor");
  assert.equal(N.activa(e, cem), true);
});

test("Lycón: las cartas de tu propio Cementerio también pierden su habilidad", { todo: "efecto: las cartas de ambos Cementerios pierden su habilidad" }, () => {});

test("Lycón: Desterrando dos cartas de tu Cementerio entra desde él como un Aliado sin habilidad de Fuerza 2", () => {
  let e = mesa();
  const l = poner(e, 0, "cementerio", "Lycón");
  const a = poner(e, 0, "cementerio", "Valefor");
  const b = poner(e, 0, "cementerio", "Valefor");
  e = aplicar(e, habilidad(l, "Lycón"));
  assert.equal(zonaDe(e, a), "destierro");
  assert.equal(zonaDe(e, b), "destierro");
  assert.equal(zonaDe(e, l), "defensa");
  assert.equal(N.carta(e, l).tipo, "Aliado");
  assert.equal(N.carta(e, l).sinHabilidad, true);
  assert.equal(N.fuerza(e, l), 2);
});

test("Lycón: sin dos cartas más en tu Cementerio no se puede usar", () => {
  const e = mesa();
  const l = poner(e, 0, "cementerio", "Lycón");
  poner(e, 0, "cementerio", "Valefor");
  assert.equal(puedeUsar(e, l), false);
});
