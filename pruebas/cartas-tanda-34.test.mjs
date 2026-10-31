import { test } from "node:test";
import assert from "node:assert/strict";
import { mesa, poner, oros, hacer, elegir, accionesLegales, aplicar, zonaDe, id, N } from "./ayuda-duelo.mjs";
import { costeDe } from "../web/duelo/motor.js";
import { disponibles } from "../web/duelo/efectos.js";

const habilidad = (uid, nombre, h = 0) => ({ tipo: "habilidad", uid, def: id(nombre), h });
const nombreDe = (e, nombre) => (v) => v !== null && N.carta(e, v).nombre === nombre;
const nombresOpciones = (e) => e.pendiente.opciones.filter((o) => o.valor !== null).map((o) => N.carta(e, o.valor).nombre).sort();
const usable = (e, uid, h = 0) => accionesLegales(e).some((a) => a.tipo === "habilidad" && a.uid === uid && a.h === h);

function jugarCarta(e, nombre, extra = {}) {
  const uid = poner(e, 0, "mano", nombre);
  oros(e, 0, costeDe(e, 0, uid).pagar);
  return [aplicar(e, { tipo: "jugar", uid, ...extra }), uid];
}

function armar(e, j, aliado, arma) {
  const a = poner(e, j, "defensa", aliado);
  const w = poner(e, j, "arma", arma, { portador: a });
  return [a, w];
}

function alTope(e, j, ...nombres) {
  const us = nombres.map((n) => poner(e, j, "castillo", n));
  e.jugadores[j].castillo = [...us, ...e.jugadores[j].castillo.filter((u) => !us.includes(u))];
  return us;
}

function lucy(e, objetivo) {
  const t = poner(e, 0, "mano", "Regresa Lucy");
  oros(e, 0, 1);
  return hacer(e, { tipo: "jugar", uid: t }, objetivo);
}

test("Molotok: puedes jugar Armas en la Guerra de Talismanes", () => {
  const e = mesa();
  poner(e, 0, "defensa", "Molotok");
  const arma = poner(e, 0, "mano", "Pedrenyal");
  oros(e, 0, 1);
  e.fase = "talismanes";
  e.prioridad = 0;
  e.pases = 0;
  assert.equal(accionesLegales(e).some((a) => a.tipo === "jugar" && a.uid === arma), true);
});

test("Molotok: sin él no se juegan Armas en la Guerra de Talismanes", () => {
  const e = mesa();
  poner(e, 0, "defensa", "Valefor");
  const arma = poner(e, 0, "mano", "Pedrenyal");
  oros(e, 0, 1);
  e.fase = "talismanes";
  e.prioridad = 0;
  e.pases = 0;
  assert.equal(accionesLegales(e).some((a) => a.tipo === "jugar" && a.uid === arma), false);
});

test("Molotok: puedes jugarlo al comienzo del bloqueo", { todo: "momento: jugar un Aliado al comienzo del bloqueo" }, () => {});
test("Molotok: puedes jugar Aliados en la Guerra de Talismanes", { todo: "momento: jugar Aliados en la Guerra de Talismanes" }, () => {});
test("Molotok: Desterrar un Arma para prevenir que un Aliado sea afectado por un efecto oponente", { todo: "respuesta: prevenir que una carta propia sea afectada por un efecto oponente" }, () => {});

test("Mycroft Holmes: al entrar busca un Aliado Holmes y convierte la primera carta de un Castillo en un Aliado de Fuerza 2", () => {
  let e = mesa();
  const sherlock = poner(e, 0, "castillo", "Sherlock Holmes");
  poner(e, 0, "castillo", "Valefor");
  const tope = e.jugadores[1].castillo[0];
  let m;
  [e, m] = jugarCarta(e, "Mycroft Holmes");
  assert.deepEqual(nombresOpciones(e), ["Sherlock Holmes"]);
  e = elegir(e, nombreDe(e, "Sherlock Holmes"));
  e = elegir(e, "Castillo oponente");
  assert.equal(zonaDe(e, sherlock), "mano");
  assert.equal(zonaDe(e, m), "defensa");
  assert.equal(e.jugadores[0].defensa.includes(tope), true);
  assert.equal(N.carta(e, tope).tipo, "Aliado");
  assert.equal(N.fuerza(e, tope), 2);
  assert.equal(N.activa(e, tope), false);
});

test("Nefertiti de Corazones: tiene Imbloqueable", () => {
  const e = mesa();
  const n = poner(e, 0, "defensa", "Nefertiti de Corazones");
  assert.equal(N.tiene(e, n, "Imbloqueable"), true);
});

test("Nefertiti de Corazones: Baraja una carta de coste 3 o menos y hasta tres cartas de los Cementerios, una vez en tu turno", () => {
  let e = mesa();
  const n = poner(e, 0, "defensa", "Nefertiti de Corazones");
  const v = poner(e, 1, "defensa", "Valefor");
  const c = [0, 0, 1, 1].map((j) => poner(e, j, "cementerio", "Valefor"));
  e = hacer(e, habilidad(n, "Nefertiti de Corazones"), v, "Barajar", c[0], c[1], c[2]);
  assert.equal(zonaDe(e, v), "castillo");
  assert.deepEqual(c.map((u) => zonaDe(e, u)), ["castillo", "castillo", "castillo", "cementerio"]);
  assert.equal(usable(e, n), false);
});

test("Nefertiti de Corazones: Destruir una carta y, cuando el oponente pone cartas en su Cementerio, Desterrar hasta dos de ahí", () => {
  let e = mesa();
  const n = poner(e, 0, "defensa", "Nefertiti de Corazones");
  const v = poner(e, 1, "defensa", "Valefor");
  const otra = poner(e, 1, "cementerio", "Jabberwocky");
  e = hacer(e, habilidad(n, "Nefertiti de Corazones"), v, "Destruir");
  assert.equal(zonaDe(e, v), "cementerio");
  e = elegir(e, v);
  e = elegir(e, otra);
  assert.equal(zonaDe(e, v), "destierro");
  assert.equal(zonaDe(e, otra), "destierro");
});

test("Nefertiti de Corazones: su disparada solo ocurre dos veces por turno y no por tu propio Cementerio", async () => {
  const { resolver } = await import("../web/duelo/efectos.js");
  const e = mesa();
  poner(e, 0, "defensa", "Nefertiti de Corazones");
  const propia = poner(e, 0, "cementerio", "Valefor");
  N.disparar(e, "alCementerio", { uid: propia, j: 0 });
  assert.equal(e.cola.length, 0);
  const r = [1, 2, 3].map(() => poner(e, 1, "cementerio", "Valefor"));
  for (const u of r) N.disparar(e, "alCementerio", { uid: u, j: 1 });
  assert.equal(e.cola.length, 2);
  resolver(e);
  assert.notEqual(e.pendiente, null);
});

test("Nemo: al entrar busca un Arma en tu Castillo o Cementerio", () => {
  let e = mesa();
  const arma = poner(e, 0, "cementerio", "Pedrenyal");
  [e] = jugarCarta(e, "Nemo");
  e = elegir(e, arma);
  assert.equal(zonaDe(e, arma), "mano");
});

test("Nemo: cuando una carta sale del juego, mostrando un Arma la pones en juego como Aliado de Fuerza 2 sin habilidad", () => {
  let e = mesa();
  poner(e, 0, "defensa", "Nemo");
  poner(e, 0, "mano", "Pedrenyal");
  const v = poner(e, 1, "defensa", "Jabberwocky");
  e = lucy(e, v);
  e = elegir(e, true);
  assert.equal(e.jugadores[0].defensa.includes(v), true);
  assert.equal(N.fuerza(e, v), 2);
  assert.equal(N.activa(e, v), false);
});

test("Nemo: sin Arma en mano ni Cementerio no se dispara", () => {
  let e = mesa();
  poner(e, 0, "defensa", "Nemo");
  const v = poner(e, 1, "defensa", "Jabberwocky");
  e = lucy(e, v);
  assert.equal(e.pendiente, null);
  assert.equal(zonaDe(e, v), "cementerio");
});

test("Nu-Galahad: tiene Imbloqueable", () => {
  const e = mesa();
  const g = poner(e, 0, "defensa", "Nu-Galahad");
  assert.equal(N.tiene(e, g, "Imbloqueable"), true);
});

test("Nu-Galahad: si controlas Armas cuesta un Oro menos y puede jugarse desde el Cementerio", () => {
  const e = mesa();
  const g = poner(e, 0, "cementerio", "Nu-Galahad");
  assert.equal(costeDe(e, 0, g).pagar, 2);
  oros(e, 0, 1);
  assert.equal(accionesLegales(e).some((a) => a.tipo === "jugar" && a.uid === g), false);
  armar(e, 0, "Valefor", "Pedrenyal");
  assert.equal(costeDe(e, 0, g).pagar, 1);
  assert.equal(accionesLegales(e).some((a) => a.tipo === "jugar" && a.uid === g && a.desde === "cementerio"), true);
});

test("Nu-Galahad: si jugaste Armas en tu anterior turno cuesta un Oro menos", () => {
  const e = mesa();
  const g = poner(e, 0, "mano", "Nu-Galahad");
  e.usos["armasJugadas|0"] = e.turno - 2;
  assert.equal(costeDe(e, 0, g).pagar, 1);
});

test("Nu-Galahad: al entrar Baraja hasta dos Armas de tu Destierro y Roba dos cartas", () => {
  let e = mesa();
  const a = poner(e, 0, "destierro", "Pedrenyal");
  const b = poner(e, 0, "destierro", "Hacha Danesa");
  [e] = jugarCarta(e, "Nu-Galahad");
  e = elegir(e, a);
  e = elegir(e, b);
  assert.equal(zonaDe(e, a), "castillo");
  assert.equal(zonaDe(e, b), "castillo");
  assert.equal(e.jugadores[0].mano.length, 2);
});

test("Nu-Galahad: al salir del juego Baraja Armas del Destierro y Roba dos cartas", () => {
  let e = mesa();
  const g = poner(e, 0, "defensa", "Nu-Galahad");
  e = lucy(e, g);
  assert.equal(zonaDe(e, g), "cementerio");
  assert.equal(e.jugadores[0].mano.length, 2);
});

test("Nu-Galahad: tus Armas no pueden ser canceladas", { todo: "protección: tus Armas no pueden ser Anuladas ni canceladas" }, () => {});

test("Nu-Galahad Prime: al entrar busca un Arma o un Caballero en tu Castillo", () => {
  let e = mesa();
  poner(e, 0, "castillo", "Valefor");
  const arma = poner(e, 0, "castillo", "Pedrenyal");
  poner(e, 0, "castillo", "Patrulla Nocturna");
  [e] = jugarCarta(e, "Nu-Galahad Prime");
  assert.deepEqual(nombresOpciones(e), ["Patrulla Nocturna", "Pedrenyal"]);
  e = elegir(e, arma);
  assert.equal(zonaDe(e, arma), "mano");
});

test("Nu-Galahad Prime: convierte Armas que controles en Aliados de Fuerza 3 con Furia e Imbloqueable", () => {
  let e = mesa();
  const [p, arma] = armar(e, 0, "Nu-Galahad Prime", "Pedrenyal");
  e = hacer(e, habilidad(p, "Nu-Galahad Prime"), arma);
  assert.equal(zonaDe(e, arma), "defensa");
  assert.equal(N.carta(e, arma).tipo, "Aliado");
  assert.equal(N.fuerza(e, arma), 3);
  assert.equal(N.tiene(e, arma, "Furia"), true);
  assert.equal(N.tiene(e, arma, "Imbloqueable"), true);
  assert.equal(N.fuerza(e, p), 3);
});

test("Nu-Galahad Prime: la conversión dura solo el turno y ocurre al comienzo de la Batalla", { todo: "disparo: al comienzo de la Batalla Mitológica; conversión que se revierte al final del turno" }, () => {});

test("Nu-Galahad el Bastion: porta hasta tres cartas de un Cementerio como Armas sin habilidad", () => {
  let e = mesa();
  const b = poner(e, 0, "defensa", "Nu-Galahad el Bastion");
  const c = [1, 2].map(() => poner(e, 1, "cementerio", "Valefor"));
  e = hacer(e, habilidad(b, "Nu-Galahad el Bastion"), "Cementerio oponente", c[0], c[1]);
  assert.deepEqual(e.armas[b], c);
  assert.equal(N.carta(e, c[0]).tipo, "Arma");
  assert.equal(N.fuerza(e, b), 5);
  assert.equal(usable(e, b), false);
});

test("Nu-Galahad el Bastion: mira tantas cartas como Armas controles y juega un Aliado de Fuerza 4 o menos sin pagar", () => {
  let e = mesa();
  const [b] = armar(e, 0, "Nu-Galahad el Bastion", "Pedrenyal");
  const [v] = alTope(e, 0, "Valefor");
  e = hacer(e, habilidad(b, "Nu-Galahad el Bastion", 1), v);
  assert.equal(zonaDe(e, v), "defensa");
  assert.equal(e.jugadores[0].reserva.length, 0);
});

test("Nu-Galahad el Bastion: no juega Aliados de Fuerza mayor que 4", () => {
  let e = mesa();
  const [b] = armar(e, 0, "Nu-Galahad el Bastion", "Pedrenyal");
  const [g] = alTope(e, 0, "Gusano Rojo");
  e = aplicar(e, habilidad(b, "Nu-Galahad el Bastion", 1));
  assert.equal(e.pendiente, null);
  assert.equal(zonaDe(e, g), "castillo");
});

test("Nu-Galahad el Bastion: tus Aliados portan al menos dos Armas", () => {
  const e = mesa();
  poner(e, 0, "defensa", "Nu-Galahad el Bastion");
  const [v] = armar(e, 0, "Valefor", "Pedrenyal");
  const otra = poner(e, 0, "mano", "Hacha Danesa");
  oros(e, 0, 1);
  assert.equal(accionesLegales(e).some((a) => a.tipo === "jugar" && a.uid === otra && a.portador === v), true);
});

test("Nu-Galahad el Bastion: tus Aliados no tienen límite de Armas", { todo: "continua: tus Aliados no tienen límite de Armas" }, () => {});

test("Otto Lidenbrock: mostrando un Arma convierte una carta de coste 3 o menos en un Aliado de Fuerza 2 bajo tu control", () => {
  let e = mesa();
  const o = poner(e, 0, "defensa", "Otto Lidenbrock");
  poner(e, 0, "mano", "Pedrenyal");
  const v = poner(e, 1, "defensa", "Jabberwocky");
  e = aplicar(e, habilidad(o, "Otto Lidenbrock"));
  assert.equal(e.jugadores[0].defensa.includes(v), true);
  assert.equal(N.fuerza(e, v), 2);
  assert.equal(N.activa(e, v), false);
  assert.equal(usable(e, o), false);
});

test("Otto Lidenbrock: convierte una carta de un Cementerio aunque cueste más de 3", () => {
  let e = mesa();
  const o = poner(e, 0, "defensa", "Otto Lidenbrock");
  poner(e, 0, "cementerio", "Pedrenyal");
  const g = poner(e, 1, "cementerio", "Gusano Rojo");
  const caro = poner(e, 1, "defensa", "Gusano Rojo");
  e = aplicar(e, habilidad(o, "Otto Lidenbrock"));
  assert.equal(e.pendiente.opciones.some((x) => x.valor === caro), false);
  e = elegir(e, g);
  assert.equal(e.jugadores[0].defensa.includes(g), true);
  assert.equal(N.fuerza(e, g), 2);
});

test("Otto Lidenbrock: sin Arma en mano ni Cementerio no se puede usar", () => {
  const e = mesa();
  const o = poner(e, 0, "defensa", "Otto Lidenbrock");
  poner(e, 1, "defensa", "Jabberwocky");
  assert.equal(usable(e, o), false);
});

test("Otto Lidenbrock: su habilidad no puede ser cancelada", { todo: "efecto: habilidad que no puede ser cancelada ni prevenida" }, () => {});
test("Otto Lidenbrock: tus Aliados no tienen límite de Armas", { todo: "continua: tus Aliados no tienen límite de Armas" }, () => {});

test("Padre de la Patria: genera un Oro para jugar Armas o Aliados, una vez en tu turno", () => {
  let e = mesa();
  const p = poner(e, 0, "defensa", "Padre de la Patria");
  e = aplicar(e, habilidad(p, "Padre de la Patria"));
  assert.equal(disponibles(e, 0, "Arma"), 1);
  assert.equal(disponibles(e, 0, "Aliado"), 1);
  assert.equal(disponibles(e, 0, "Talismán"), 0);
  assert.equal(usable(e, p), false);
});

test("Padre de la Patria: al entrar sube un Arma que controles y juega gratis un Arma de igual o menor coste", () => {
  let e = mesa();
  const [v, pedrenyal] = armar(e, 0, "Valefor", "Pedrenyal");
  const hacha = poner(e, 0, "mano", "Hacha Danesa");
  poner(e, 0, "mano", "Zweihander Brutal");
  [e] = jugarCarta(e, "Padre de la Patria");
  e = elegir(e, true);
  assert.deepEqual(nombresOpciones(e), ["Hacha Danesa", "Pedrenyal"]);
  e = elegir(e, hacha);
  e = elegir(e, v);
  assert.equal(zonaDe(e, pedrenyal), "mano");
  assert.deepEqual(e.armas[v], [hacha]);
});

test("Padre de la Patria: el Oro generado sirve solo para Aliados Caballero", { todo: "generar: Oro restringido por raza y coste mínimo" }, () => {});

test("Paladin David: tiene Indestructible y tus Aliados ganan Imbloqueable", () => {
  const e = mesa();
  const d = poner(e, 0, "defensa", "Paladin David");
  const propio = poner(e, 0, "defensa", "Valefor");
  const rival = poner(e, 1, "defensa", "Valefor");
  assert.equal(N.tiene(e, d, "Indestructible"), true);
  assert.equal(N.tiene(e, propio, "Imbloqueable"), true);
  assert.equal(N.tiene(e, rival, "Imbloqueable"), false);
});

test("Paladin David: una vez por turno busca un Aliado, Arma u Oro en tu Castillo", () => {
  let e = mesa();
  const d = poner(e, 0, "defensa", "Paladin David");
  const arma = poner(e, 0, "castillo", "Pedrenyal");
  poner(e, 0, "castillo", "Llamar a la Manada");
  e = aplicar(e, habilidad(d, "Paladin David"));
  assert.deepEqual(nombresOpciones(e), ["Drácula", "Pedrenyal"]);
  e = elegir(e, arma);
  assert.equal(zonaDe(e, arma), "mano");
  assert.equal(usable(e, d), false);
});

test("Paladin David: en la Fase Final Baraja y/o Destierra hasta dos cartas de los Cementerios", () => {
  let e = mesa();
  poner(e, 0, "defensa", "Paladin David");
  const [a, b, c] = [0, 1, 1].map((j) => poner(e, j, "cementerio", "Valefor"));
  e = aplicar(e, { tipo: "terminar" });
  e = elegir(e, a);
  e = elegir(e, null);
  e = elegir(e, b);
  assert.equal(zonaDe(e, a), "castillo");
  assert.equal(zonaDe(e, b), "destierro");
  assert.equal(zonaDe(e, c), "cementerio");
});

test("Paladin David: tus Aliados que porten Armas hacen daño de combate al Destierro", { todo: "continua: ganar una clave solo los Aliados que portan Armas" }, () => {});

test("Paladin de la Esperanza: busca hasta dos Aliados Paladín o Armas para tu mano o Cementerio y Roba por cada Arma al Cementerio", () => {
  let e = mesa();
  const frumos = poner(e, 0, "castillo", "Frumos el Paladín");
  const arma = poner(e, 0, "castillo", "Pedrenyal");
  poner(e, 0, "castillo", "Valefor");
  [e] = jugarCarta(e, "Paladin de la Esperanza");
  e = elegir(e, true);
  assert.deepEqual(nombresOpciones(e), ["Frumos el Paladín", "Pedrenyal"]);
  e = elegir(e, frumos);
  e = elegir(e, arma);
  e = elegir(e, arma);
  e = elegir(e, null);
  assert.equal(zonaDe(e, frumos), "mano");
  assert.equal(zonaDe(e, arma), "cementerio");
  assert.equal(e.jugadores[0].mano.length, 2);
});

test("Paladín Arthur Holmwood: al entrar una carta al azar de la mano oponente no se puede jugar hasta tu próximo turno", () => {
  let e = mesa();
  poner(e, 1, "mano", "Jabberwocky");
  [e] = jugarCarta(e, "Paladín Arthur Holmwood");
  assert.equal(e.efectos.some((f) => f.tipo === "noJugarNombre" && f.j === 1 && f.nombre === "Jabberwocky"), true);
});

test("Paladín Arthur Holmwood: en juego, cuando una de tus Armas es Destruida puedes subirla a tu mano", () => {
  let e = mesa();
  poner(e, 0, "defensa", "Paladín Arthur Holmwood");
  const [, arma] = armar(e, 0, "Valefor", "Pedrenyal");
  e = lucy(e, arma);
  e = elegir(e, true);
  assert.equal(zonaDe(e, arma), "mano");
});

test("Paladín Arthur Holmwood: también funciona desde tu Cementerio", () => {
  let e = mesa();
  poner(e, 0, "cementerio", "Paladín Arthur Holmwood");
  const [, arma] = armar(e, 0, "Valefor", "Pedrenyal");
  e = lucy(e, arma);
  e = elegir(e, true);
  assert.equal(zonaDe(e, arma), "mano");
});

test("Paladín Arthur Holmwood: no se dispara por Armas del oponente", () => {
  let e = mesa();
  poner(e, 0, "defensa", "Paladín Arthur Holmwood");
  const [, arma] = armar(e, 1, "Valefor", "Pedrenyal");
  e = lucy(e, arma);
  assert.equal(e.pendiente, null);
  assert.equal(zonaDe(e, arma), "cementerio");
});

test("Paladín Harker: tiene Furia e Imbloqueable", () => {
  const e = mesa();
  const h = poner(e, 0, "defensa", "Paladín Harker");
  assert.equal(N.tiene(e, h, "Furia"), true);
  assert.equal(N.tiene(e, h, "Imbloqueable"), true);
});

test("Paladín Harker: al entrar nombra una carta por cada Arma que controlas y no pueden jugarse hasta tu próximo turno", () => {
  let e = mesa();
  armar(e, 0, "Valefor", "Pedrenyal");
  const j = poner(e, 1, "mano", "Jabberwocky");
  [e] = jugarCarta(e, "Paladín Harker");
  e = elegir(e, j);
  assert.equal(e.pendiente, null);
  assert.equal(e.efectos.filter((f) => f.tipo === "noJugarNombre" && f.nombre === "Jabberwocky").length, 2);
});

test("Paladín Harker: sin Armas no nombra cartas", () => {
  let e = mesa();
  poner(e, 1, "mano", "Jabberwocky");
  [e] = jugarCarta(e, "Paladín Harker");
  assert.equal(e.pendiente, null);
  assert.equal(e.efectos.some((f) => f.tipo === "noJugarNombre"), false);
});

test("Paladín Harker: genera un Oro para Armas y Destierra hasta una carta de coste 3 o menos", () => {
  let e = mesa();
  const h = poner(e, 0, "defensa", "Paladín Harker");
  const v = poner(e, 1, "defensa", "Valefor");
  e = hacer(e, habilidad(h, "Paladín Harker"), v);
  assert.equal(zonaDe(e, v), "destierro");
  assert.equal(disponibles(e, 0, "Arma"), 1);
  assert.equal(disponibles(e, 0, "Aliado"), 0);
});

test("Pipin el Breve: Imbloqueable y gana 1 de Fuerza por cada Arma en tu Cementerio", () => {
  const e = mesa();
  const p = poner(e, 0, "defensa", "Pipin el Breve");
  assert.equal(N.tiene(e, p, "Imbloqueable"), true);
  assert.equal(N.fuerza(e, p), 2);
  poner(e, 0, "cementerio", "Pedrenyal");
  poner(e, 0, "cementerio", "Hacha Danesa");
  poner(e, 1, "cementerio", "Pedrenyal");
  assert.equal(N.fuerza(e, p), 4);
});

test("Pipin el Breve: busca un Aliado Imbloqueable o Caballero que no sea Pipin, o un Arma de coste 2 o menos", () => {
  let e = mesa();
  for (const n of ["Pipin el Breve", "Valefor", "Patrulla Nocturna", "Zweihander Brutal", "Pedrenyal", "Gusano Rojo"]) poner(e, 0, "castillo", n);
  [e] = jugarCarta(e, "Pipin el Breve");
  e = elegir(e, true);
  assert.deepEqual(nombresOpciones(e), ["Gusano Rojo", "Patrulla Nocturna", "Pedrenyal"]);
  e = elegir(e, nombreDe(e, "Patrulla Nocturna"));
  assert.equal(e.jugadores[0].mano.some((u) => N.carta(e, u).nombre === "Patrulla Nocturna"), true);
});

test("Prendick: al entrar, si controlas Armas, tus Aliados ganan 2 de Fuerza por el turno", () => {
  let e = mesa();
  const [v] = armar(e, 0, "Valefor", "Pedrenyal");
  let p;
  [e, p] = jugarCarta(e, "Prendick");
  assert.equal(N.fuerza(e, v), 7);
  assert.equal(N.fuerza(e, p), 4);
});

test("Prendick: sin Armas tus Aliados no ganan Fuerza", () => {
  let e = mesa();
  const v = poner(e, 0, "defensa", "Valefor");
  [e] = jugarCarta(e, "Prendick");
  assert.equal(N.fuerza(e, v), 3);
});

test("Prendick: el oponente pone en su Cementerio tantas cartas de su Castillo como Fuerza tenga un Aliado que porte Armas", () => {
  let e = mesa();
  const p = poner(e, 0, "defensa", "Prendick");
  armar(e, 0, "Valefor", "Pedrenyal");
  e = aplicar(e, habilidad(p, "Prendick"));
  assert.equal(e.jugadores[1].castillo.length, 25);
  assert.equal(e.jugadores[1].cementerio.length, 5);
  assert.equal(usable(e, p), false);
});

test("Prendick: sin Aliados que porten Armas no se puede usar", () => {
  const e = mesa();
  const p = poner(e, 0, "defensa", "Prendick");
  assert.equal(usable(e, p), false);
});

test("Raguel: al entrar busca un Aliado en tu Castillo o Cementerio", () => {
  let e = mesa();
  const v = poner(e, 0, "cementerio", "Valefor");
  [e] = jugarCarta(e, "Raguel");
  e = elegir(e, true);
  e = elegir(e, v);
  assert.equal(zonaDe(e, v), "mano");
});

test("Raguel: los jugadores solo pueden poner un Oro en juego en su turno", { todo: "restricción: cada jugador pone como máximo un Oro en juego en su turno, también por efectos" }, () => {});
test("Raguel: los jugadores solo pueden jugar un Talismán por turno", { todo: "restricción: cada jugador juega como máximo un Talismán por turno" }, () => {});

test("Ramón Freire: al entrar Roba dos cartas", () => {
  let e = mesa();
  [e] = jugarCarta(e, "Ramón Freire");
  assert.equal(e.jugadores[0].mano.length, 2);
});

test("Ramón Freire: con un Aliado de coste 2 o más se Destierra desde la mano para generar un Oro para Armas, una vez por turno", () => {
  let e = mesa();
  poner(e, 0, "defensa", "Patrulla Nocturna");
  const r = poner(e, 0, "mano", "Ramón Freire");
  const r2 = poner(e, 0, "mano", "Ramón Freire");
  e = aplicar(e, habilidad(r, "Ramón Freire"));
  assert.equal(zonaDe(e, r), "destierro");
  assert.equal(disponibles(e, 0, "Arma"), 1);
  assert.equal(disponibles(e, 0, "Aliado"), 0);
  assert.equal(usable(e, r2), false);
});

test("Ramón Freire: en juego también puede Desterrarse para generar un Oro para Armas", () => {
  let e = mesa();
  poner(e, 0, "defensa", "Patrulla Nocturna");
  const r = poner(e, 0, "defensa", "Ramón Freire");
  e = aplicar(e, habilidad(r, "Ramón Freire", 1));
  assert.equal(zonaDe(e, r), "destierro");
  assert.equal(disponibles(e, 0, "Arma"), 1);
});

test("Ramón Freire: sin Aliados de coste 2 o más no se puede usar", () => {
  const e = mesa();
  poner(e, 0, "defensa", "Valefor");
  const r = poner(e, 0, "mano", "Ramón Freire");
  assert.equal(usable(e, r), false);
});

test("Regan Liberator: cuesta un Oro menos si tienes un Arma o Tótem en tu mano o Cementerio", () => {
  const e = mesa();
  const r = poner(e, 0, "mano", "Regan Liberator");
  assert.equal(costeDe(e, 0, r).pagar, 3);
  poner(e, 0, "cementerio", "Carcosa");
  assert.equal(costeDe(e, 0, r).pagar, 2);
});

test("Regan Liberator: al entrar gana el control de las cartas de las que eres dueño", () => {
  let e = mesa();
  const v = poner(e, 0, "defensa", "Valefor");
  N.sacar(e, v);
  e.jugadores[1].defensa.push(v);
  const ajena = poner(e, 1, "defensa", "Valefor");
  [e] = jugarCarta(e, "Regan Liberator");
  assert.equal(e.jugadores[0].defensa.includes(v), true);
  assert.equal(e.jugadores[1].defensa.includes(ajena), true);
});

test("Regan Liberator: tus Aliados son Imbloqueables y no pueden cambiar de controlador", () => {
  const e = mesa();
  poner(e, 0, "defensa", "Regan Liberator");
  const v = poner(e, 0, "defensa", "Valefor");
  const rival = poner(e, 1, "defensa", "Valefor");
  assert.equal(N.tiene(e, v, "Imbloqueable"), true);
  assert.equal(N.tiene(e, rival, "Imbloqueable"), false);
  assert.equal(N.puedeTomar(e, v, 1), false);
});

test("Remiel: Furia e Imbloqueable; al atacar el oponente Descarta y buscas un Aliado o Arma", () => {
  let e = mesa();
  const r = poner(e, 0, "defensa", "Remiel");
  const d = poner(e, 1, "mano", "Valefor");
  const arma = poner(e, 0, "castillo", "Pedrenyal");
  assert.equal(N.tiene(e, r, "Furia"), true);
  assert.equal(N.tiene(e, r, "Imbloqueable"), true);
  e = aplicar(e, { tipo: "batalla" });
  e = aplicar(e, { tipo: "atacar", uid: r });
  assert.equal(zonaDe(e, d), "cementerio");
  e = elegir(e, arma);
  assert.equal(zonaDe(e, arma), "mano");
});

test("Remiel: cuando cualquier carta sea Descartada, busca un Aliado o Arma", { todo: "evento: cuando una carta es Descartada" }, () => {});

test("Roderick Usher: Imbloqueable; al entrar sube un Aliado o Arma de tu Cementerio a tu mano", () => {
  let e = mesa();
  const arma = poner(e, 0, "cementerio", "Pedrenyal");
  let r;
  [e, r] = jugarCarta(e, "Roderick Usher");
  assert.equal(N.tiene(e, r, "Imbloqueable"), true);
  e = elegir(e, "Subir un Aliado o Arma de tu Cementerio a tu mano");
  assert.equal(zonaDe(e, arma), "mano");
});

test("Roderick Usher: al entrar puede cambiar de portador un Arma que controles", () => {
  let e = mesa();
  const [v, arma] = armar(e, 0, "Valefor", "Pedrenyal");
  let r;
  [e, r] = jugarCarta(e, "Roderick Usher");
  e = elegir(e, "Cambiar de portador un Arma que controles");
  assert.deepEqual(e.armas[r], [arma]);
  assert.equal(e.armas[v], undefined);
});

test("Roderick Usher: puedes jugar Armas en la Fase Final de cada jugador", { todo: "momento: jugar Armas en la Fase Final de cada jugador" }, () => {});

test("San Martin Libertadores: Imbloqueable; muestra cartas del tope hasta dos Armas y las pone en tu mano", () => {
  let e = mesa();
  const [v, a, , b] = alTope(e, 0, "Valefor", "Pedrenyal", "Valefor", "Hacha Danesa");
  let s;
  [e, s] = jugarCarta(e, "San Martin Libertadores");
  assert.equal(N.tiene(e, s, "Imbloqueable"), true);
  assert.equal(zonaDe(e, a), "mano");
  assert.equal(zonaDe(e, b), "mano");
  assert.equal(zonaDe(e, v), "castillo");
});

test("San Martin Libertadores: puede Desterrarse para Anular un Talismán o Tótem de coste 2 o menos", { todo: "respuesta: Anular con una habilidad activada de una carta en juego" }, () => {});

test("Sancho Panza: Furia; al entrar juega gratis un Aliado de coste 1 de tu Cementerio", () => {
  let e = mesa();
  const v = poner(e, 0, "cementerio", "Valefor");
  poner(e, 0, "cementerio", "Jabberwocky");
  let s;
  [e, s] = jugarCarta(e, "Sancho Panza");
  assert.equal(N.tiene(e, s, "Furia"), true);
  e = elegir(e, true);
  assert.equal(zonaDe(e, v), "defensa");
  assert.equal(e.jugadores[0].reserva.length, 0);
});

test("Sancho Panza: cuando sale del juego Roba dos cartas", () => {
  let e = mesa();
  const s = poner(e, 0, "defensa", "Sancho Panza");
  e = lucy(e, s);
  assert.equal(zonaDe(e, s), "cementerio");
  assert.equal(e.jugadores[0].mano.length, 2);
});

test("Sancho Panza: tú controlas el Bloqueo oponente", { todo: "bloqueo: un jugador decide los bloqueos del oponente" }, () => {});

test("Sherlock Holmes: convierte cartas que no sean Oro o del tope de un Castillo en Aliados de Fuerza 3, Roba dos y tus Aliados no salen", () => {
  let e = mesa();
  const v = poner(e, 1, "defensa", "Valefor");
  const tope = e.jugadores[1].castillo[0];
  let s;
  [e, s] = jugarCarta(e, "Sherlock Holmes");
  e = elegir(e, v);
  e = elegir(e, "Convertir la primera carta del Castillo oponente");
  assert.equal(e.jugadores[0].defensa.includes(v), true);
  assert.equal(N.fuerza(e, v), 3);
  assert.equal(N.activa(e, v), false);
  assert.equal(e.jugadores[0].defensa.includes(tope), true);
  assert.equal(N.fuerza(e, tope), 3);
  assert.equal(e.jugadores[0].mano.length, 2);
  assert.equal(N.puedeSalir(e, s), false);
  assert.equal(N.puedeSalir(e, v), false);
});

test("Sherlock Holmes: no se puede cancelar su habilidad", { todo: "efecto: habilidad que no puede ser cancelada ni prevenida" }, () => {});

test("Striker: Imbloqueable; sin Armas Destruye un Aliado de coste 2 o menos", () => {
  let e = mesa();
  const v = poner(e, 1, "defensa", "Valefor");
  let s;
  [e, s] = jugarCarta(e, "Striker");
  assert.equal(N.tiene(e, s, "Imbloqueable"), true);
  e = elegir(e, v);
  assert.equal(zonaDe(e, v), "cementerio");
});

test("Striker: con Armas puede Destruir una carta que no sea Oro o Robar dos", () => {
  let e = mesa();
  armar(e, 0, "Valefor", "Pedrenyal");
  const t = poner(e, 1, "apoyo", "Carcosa");
  [e] = jugarCarta(e, "Striker");
  e = elegir(e, "Destruir una carta que no sea Oro");
  e = elegir(e, t);
  assert.equal(zonaDe(e, t), "cementerio");
});

test("Striker: con Armas puede Robar dos cartas", () => {
  let e = mesa();
  armar(e, 0, "Valefor", "Pedrenyal");
  [e] = jugarCarta(e, "Striker");
  e = elegir(e, "Robar dos cartas");
  assert.equal(e.jugadores[0].mano.length, 2);
});

test("Taka No Me: muestra hasta un Arma y un Tótem, los pone en tu mano y Baraja el resto", () => {
  let e = mesa();
  const t = poner(e, 0, "defensa", "Taka No Me");
  const [v, a, c] = alTope(e, 0, "Valefor", "Pedrenyal", "Carcosa");
  e = aplicar(e, habilidad(t, "Taka No Me"));
  assert.equal(zonaDe(e, a), "mano");
  assert.equal(zonaDe(e, c), "mano");
  assert.equal(zonaDe(e, v), "castillo");
  assert.equal(usable(e, t), false);
});

test("Taka No Me: mira tres cartas de la mano oponente y elige una que no puede ser jugada hasta tu próximo turno", () => {
  let e = mesa();
  const t = poner(e, 0, "defensa", "Taka No Me");
  poner(e, 1, "mano", "Valefor");
  const j = poner(e, 1, "mano", "Jabberwocky");
  e = hacer(e, habilidad(t, "Taka No Me", 1), j);
  assert.equal(e.efectos.some((f) => f.tipo === "noJugarNombre" && f.j === 1 && f.nombre === "Jabberwocky"), true);
  assert.equal(usable(e, t, 1), false);
});
