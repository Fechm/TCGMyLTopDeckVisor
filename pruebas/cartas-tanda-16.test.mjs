import { test } from "node:test";
import assert from "node:assert/strict";
import { mesa, poner, oros, hacer, elegir, sinRespuesta, accionesLegales, aplicar, zonaDe, id, N } from "./ayuda-duelo.mjs";
import { resolver, OPS } from "../web/duelo/efectos.js";
import { costeDe } from "../web/duelo/motor.js";

const jugar = (uid, extra = {}) => ({ tipo: "jugar", uid, ...extra });
const habilidad = (uid, nombre, h = 0) => ({ tipo: "habilidad", uid, def: id(nombre), h });
const texto = (inicio) => (v, o) => (o.texto ?? "").startsWith(inicio);
const puedeJugar = (e, uid) => accionesLegales(e).some((a) => a.tipo === "jugar" && a.uid === uid);
const puedeUsar = (e, uid) => accionesLegales(e).some((a) => a.tipo === "habilidad" && a.uid === uid);
const textos = (e) => e.pendiente.opciones.map((o) => o.texto);
const puedeResponder = (e) => accionesLegales(e).some((a) => a.tipo === "responder");
const ctxRival = (e, uid) => ({ ctrl: 1, fuente: uid, def: e.instancias[uid], costeFuente: N.carta(e, uid).coste ?? 0, vars: {} });

function disparar(e, evento, datos) {
  N.disparar(e, evento, datos);
  resolver(e);
  return e;
}

let nFicticia = 0;
function ficticia(e, j, zona, datos = {}) {
  const idf = `ficticia16-${nFicticia++}`;
  e.catalogo = {
    ...e.catalogo,
    [idf]: { id: idf, nombre: idf, tipo: "Aliado", coste: 1, fuerza: 2, razas: [], sinHabilidad: false, oroInicial: false, texto: "", ...datos },
  };
  const uid = `${j}-g${nFicticia}`;
  e.instancias[uid] = idf;
  e.jugadores[j][zona].push(uid);
  return uid;
}

test("Remate Mortal: tus Aliados ganan 1 de Fuerza y los oponentes pierden 1, permanentemente", () => {
  let e = mesa();
  oros(e, 0, 1);
  const propio = poner(e, 0, "defensa", "Valefor");
  const rival = poner(e, 1, "defensa", "Valefor");
  const remate = poner(e, 0, "mano", "Remate Mortal");
  e = hacer(e, jugar(remate), texto("Tus Aliados"));
  assert.equal(N.fuerza(e, propio), 4);
  assert.equal(N.fuerza(e, rival), 2);
  e.turno += 3;
  N.expirar(e, "finTurno");
  N.expirar(e, "inicio");
  assert.equal(N.fuerza(e, propio), 4);
});

test("Remate Mortal: juega una carta de tu Cementerio reduciendo su coste en un Oro, mínimo 1", () => {
  let e = mesa();
  oros(e, 0, 2);
  const v = poner(e, 0, "cementerio", "Valefor");
  const remate = poner(e, 0, "mano", "Remate Mortal");
  e = hacer(e, jugar(remate), texto("Jugar una carta"), v);
  assert.equal(zonaDe(e, v), "defensa");
  assert.equal(e.jugadores[0].reserva.length, 0);
});

test("Remate Mortal: con Descanso Solar en tu Cementerio aplica ambos efectos sin elegir", () => {
  let e = mesa();
  oros(e, 0, 2);
  const propio = poner(e, 0, "defensa", "Valefor");
  const v = poner(e, 0, "cementerio", "Valefor");
  ficticia(e, 0, "destierro", { nombre: "Descanso Solar", tipo: "Talismán" });
  const remate = poner(e, 0, "mano", "Remate Mortal");
  e = hacer(e, jugar(remate), v);
  assert.equal(N.fuerza(e, propio), 4);
  assert.equal(zonaDe(e, v), "defensa");
});

test("Remate Mortal: con Descanso Solar no puede ser Anulado", () => {
  let e = mesa();
  oros(e, 0, 2);
  oros(e, 1, 5);
  poner(e, 1, "mano", "Ciempiés-SP");
  const remate = poner(e, 0, "mano", "Remate Mortal");
  assert.equal(puedeResponder(aplicar(e, jugar(remate))), true);
  ficticia(e, 0, "destierro", { nombre: "Descanso Solar", tipo: "Talismán" });
  e = aplicar(e, jugar(remate));
  assert.equal(puedeResponder(e), false);
});

test("Renace la Fe: sube un Aliado oponente a la mano de su dueño y hasta una carta de tu Cementerio a tu mano", () => {
  let e = mesa();
  oros(e, 0, 1);
  const rival = poner(e, 1, "defensa", "Valefor");
  const c = poner(e, 0, "cementerio", "Balaur");
  const renace = poner(e, 0, "mano", "Renace la Fe");
  e = hacer(e, jugar(renace), c);
  assert.equal(zonaDe(e, rival), "mano");
  assert.ok(e.jugadores[1].mano.includes(rival));
  assert.equal(zonaDe(e, c), "mano");
});

test("Renace la Fe: requiere un Aliado oponente", () => {
  const e = mesa();
  oros(e, 0, 1);
  const renace = poner(e, 0, "mano", "Renace la Fe");
  assert.equal(puedeJugar(e, renace), false);
});

test("Renace la Fe: pagando un Oro y Desterrándolo de tu Cementerio el oponente Bota cuatro cartas", () => {
  let e = mesa();
  oros(e, 0, 1);
  const renace = poner(e, 0, "cementerio", "Renace la Fe");
  e = aplicar(e, habilidad(renace, "Renace la Fe"));
  assert.equal(zonaDe(e, renace), "destierro");
  assert.equal(e.jugadores[1].castillo.length, 26);
  assert.equal(e.jugadores[0].reserva.length, 0);
});

test("Resistir: busca un Arma en tu Castillo y la juega reduciendo su coste en un Oro, hasta 0", () => {
  let e = mesa();
  oros(e, 0, 1);
  const v = poner(e, 0, "defensa", "Valefor");
  const arma = poner(e, 0, "castillo", "Pedrenyal");
  const resistir = poner(e, 0, "mano", "Resistir");
  e = hacer(e, jugar(resistir), arma);
  assert.equal(zonaDe(e, arma), "arma");
  assert.deepEqual(e.armas[v], [arma]);
  assert.equal(N.fuerza(e, v), 5);
});

test("Resistir: también puede jugar un Arma de tu Cementerio", () => {
  let e = mesa();
  oros(e, 0, 1);
  const v = poner(e, 0, "defensa", "Valefor");
  const arma = poner(e, 0, "cementerio", "Pedrenyal");
  const resistir = poner(e, 0, "mano", "Resistir");
  e = hacer(e, jugar(resistir), arma);
  assert.deepEqual(e.armas[v], [arma]);
});

test("Resistir: hasta tu próximo turno los Talismanes que irían al Cementerio son Desterrados", () => {
  let e = mesa();
  oros(e, 0, 3);
  poner(e, 0, "defensa", "Valefor");
  const arma = poner(e, 0, "castillo", "Pedrenyal");
  const resistir = poner(e, 0, "mano", "Resistir");
  const saltar = poner(e, 0, "mano", "Saltar la Defensa");
  e = hacer(e, jugar(resistir), arma);
  assert.equal(zonaDe(e, resistir), "cementerio");
  e = hacer(e, jugar(saltar), texto("Robar"));
  assert.equal(zonaDe(e, saltar), "destierro");
  e.turno += 1;
  e.activo = 1;
  N.expirar(e, "inicio");
  const rival = poner(e, 1, "cementerio", "Renace la Fe");
  e.jugadores[1].cementerio = [];
  OPS.finTalisman(e, { uid: rival });
  assert.equal(zonaDe(e, rival), "destierro");
  e.turno += 1;
  e.activo = 0;
  N.expirar(e, "inicio");
  const tarde = poner(e, 1, "cementerio", "Renace la Fe");
  e.jugadores[1].cementerio = e.jugadores[1].cementerio.filter((u) => u !== tarde);
  OPS.finTalisman(e, { uid: tarde });
  assert.equal(zonaDe(e, tarde), "cementerio");
});

test("Revivir Campeon: los Aliados de coste 2 o menos tienen Fuerza 0 por el turno", () => {
  let e = mesa();
  oros(e, 0, 1);
  const v = poner(e, 0, "defensa", "Valefor");
  const rv = poner(e, 1, "defensa", "Valefor");
  const caro = ficticia(e, 1, "defensa", { coste: 3, fuerza: 5 });
  const revivir = poner(e, 0, "mano", "Revivir Campeon");
  e = sinRespuesta(aplicar(e, jugar(revivir)));
  assert.equal(N.fuerza(e, v), 0);
  assert.equal(N.fuerza(e, rv), 0);
  assert.equal(N.fuerza(e, caro), 5);
  N.expirar(e, "finTurno");
  assert.equal(N.fuerza(e, v), 3);
});

test("Revivir Campeon: busca un Talismán que no sea Revivir Campeon y hasta un Aliado de tu Cementerio", () => {
  let e = mesa();
  oros(e, 0, 1);
  const manada = poner(e, 0, "castillo", "Llamar a la Manada");
  const otra = poner(e, 0, "castillo", "Revivir Campeon");
  const a = poner(e, 0, "cementerio", "Valefor");
  const revivir = poner(e, 0, "mano", "Revivir Campeon");
  e = aplicar(e, jugar(revivir));
  assert.equal(e.pendiente.opciones.some((o) => o.valor === otra), false);
  e = elegir(e, manada);
  e = elegir(e, a);
  assert.equal(zonaDe(e, manada), "mano");
  assert.equal(zonaDe(e, a), "mano");
  assert.equal(zonaDe(e, otra), "castillo");
});

test("Revivir Campeon: los Aliados afectados no pueden modificar su Fuerza", { todo: "efecto: Fuerza fija que no puede modificarse por el turno" }, () => {});

test("Rey del Disfraz: Destierra una carta de coste 3 o más", () => {
  let e = mesa();
  oros(e, 0, 1);
  const b = poner(e, 1, "defensa", "Balaur");
  const rey = poner(e, 0, "mano", "Rey del Disfraz");
  e = hacer(e, jugar(rey), texto("Desterrar"));
  assert.equal(zonaDe(e, b), "destierro");
});

test("Rey del Disfraz: Destruye todas las cartas de coste 0 que no son Oro", () => {
  let e = mesa();
  oros(e, 0, 1);
  const a = ficticia(e, 0, "defensa", { coste: 0 });
  const b = ficticia(e, 1, "defensa", { coste: 0 });
  const c = poner(e, 1, "defensa", "Valefor");
  const oro = poner(e, 1, "reserva", "Drácula");
  const rey = poner(e, 0, "mano", "Rey del Disfraz");
  e = hacer(e, jugar(rey), texto("Destruir"));
  assert.equal(zonaDe(e, a), "cementerio");
  assert.equal(zonaDe(e, b), "cementerio");
  assert.equal(zonaDe(e, c), "defensa");
  assert.equal(zonaDe(e, oro), "reserva");
});

test("Rey del Disfraz: si el oponente jugó un Aliado sin pagar su coste o de coste 0 este turno, se juega sin pagar", () => {
  let e = mesa();
  const rey = poner(e, 0, "mano", "Rey del Disfraz");
  assert.equal(costeDe(e, 0, rey).pagar, 1);
  const gratis = ficticia(e, 1, "defensa", { coste: 2 });
  e = disparar(e, "juega", { uid: gratis, j: 1, tipo: "Aliado", pagado: false });
  assert.equal(costeDe(e, 0, rey).pagar, 0);
  e.turno += 1;
  assert.equal(costeDe(e, 0, rey).pagar, 1);
  const cero = ficticia(e, 1, "defensa", { coste: 0 });
  e = disparar(e, "juega", { uid: cero, j: 1, tipo: "Aliado", pagado: true });
  assert.equal(costeDe(e, 0, rey).pagar, 0);
});

test("Rey del Disfraz: un Aliado pagado de coste 1 o más no lo abarata", () => {
  let e = mesa();
  const rey = poner(e, 0, "mano", "Rey del Disfraz");
  const v = poner(e, 1, "defensa", "Valefor");
  e = disparar(e, "juega", { uid: v, j: 1, tipo: "Aliado", pagado: true });
  assert.equal(costeDe(e, 0, rey).pagar, 1);
});

test("Rey del Disfraz: puede jugarse al comienzo de la Fase Final", () => {
  let e = mesa();
  oros(e, 0, 1);
  const b = poner(e, 1, "defensa", "Balaur");
  const rey = poner(e, 0, "mano", "Rey del Disfraz");
  e = aplicar(e, { tipo: "terminar" });
  assert.equal(e.fase, "momento");
  assert.equal(puedeJugar(e, rey), true);
  e = hacer(e, jugar(rey), texto("Desterrar"));
  assert.equal(zonaDe(e, b), "destierro");
});

test("Rito de Pontchartrain: convierte una carta oponente en una del mismo tipo sin habilidad y Roba una carta", () => {
  let e = mesa();
  oros(e, 0, 1);
  const rv = poner(e, 1, "defensa", "Valefor");
  const rito = poner(e, 0, "mano", "Rito de Pontchartrain");
  e = hacer(e, jugar(rito), texto("Convertir"));
  assert.equal(N.carta(e, rv).tipo, "Aliado");
  assert.equal(N.activa(e, rv), false);
  assert.equal(N.fuerza(e, rv), 3);
  assert.equal(e.jugadores[0].mano.length, 1);
  assert.equal(zonaDe(e, rito), "cementerio");
});

test("Rito de Pontchartrain: si el oponente no recibió daño, Bota cinco cartas y el Talismán vuelve a tu mano", () => {
  let e = mesa();
  oros(e, 0, 1);
  const rito = poner(e, 0, "mano", "Rito de Pontchartrain");
  e = hacer(e, jugar(rito), texto("Si tu oponente"));
  assert.equal(e.jugadores[1].castillo.length, 25);
  assert.equal(zonaDe(e, rito), "mano");
});

test("Rito de Pontchartrain: si el oponente recibió daño este turno no Bota ni vuelve a la mano", () => {
  let e = mesa();
  oros(e, 0, 1);
  e.registro.push({ turno: e.turno, dano: 2, destruidos: 0 });
  const rito = poner(e, 0, "mano", "Rito de Pontchartrain");
  e = hacer(e, jugar(rito), texto("Si tu oponente"));
  assert.equal(e.jugadores[1].castillo.length, 30);
  assert.equal(zonaDe(e, rito), "cementerio");
});

test("Rito de Pontchartrain: si el oponente tiene menos de veinte cartas en su Castillo aplica ambos efectos", () => {
  let e = mesa();
  oros(e, 0, 1);
  e.jugadores[1].castillo.splice(0, 12);
  const rv = poner(e, 1, "defensa", "Valefor");
  const rito = poner(e, 0, "mano", "Rito de Pontchartrain");
  e = sinRespuesta(aplicar(e, jugar(rito)));
  assert.equal(N.activa(e, rv), false);
  assert.equal(e.jugadores[1].castillo.length, 13);
  assert.equal(zonaDe(e, rito), "mano");
});

test("Rito del Bandido: reduce su coste en un Oro por cada Bandido que controles, hasta un mínimo de 1", () => {
  const e = mesa();
  const rito = poner(e, 0, "mano", "Rito del Bandido");
  assert.equal(costeDe(e, 0, rito).pagar, 3);
  poner(e, 0, "defensa", "Bandido Neira");
  assert.equal(costeDe(e, 0, rito).pagar, 2);
  poner(e, 0, "defensa", "Bandido Neira");
  poner(e, 0, "defensa", "Bandido Neira");
  assert.equal(costeDe(e, 0, rito).pagar, 1);
  poner(e, 1, "defensa", "Bandido Neira");
  assert.equal(costeDe(e, 0, rito).pagar, 1);
});

test("Rito del Bandido: al oponente le cuesta un Oro adicional disparar habilidades este turno", () => {
  let e = mesa();
  oros(e, 0, 3);
  const rito = poner(e, 0, "mano", "Rito del Bandido");
  const rv = poner(e, 1, "defensa", "Valefor");
  e = sinRespuesta(aplicar(e, jugar(rito)));
  assert.equal(N.impuestoHabilidad(e, 1, rv, "disparada"), 1);
  assert.equal(N.impuestoHabilidad(e, 0, rv, "disparada"), 0);
  N.expirar(e, "finTurno");
  assert.equal(N.impuestoHabilidad(e, 1, rv, "disparada"), 0);
});

test("Rito del Bandido: al oponente le cuesta un Oro adicional jugar Talismanes este turno", () => {
  let e = mesa();
  oros(e, 0, 3);
  const rito = poner(e, 0, "mano", "Rito del Bandido");
  const suyo = poner(e, 1, "mano", "Remate Mortal");
  const mio = poner(e, 0, "mano", "Remate Mortal");
  const aliado = poner(e, 1, "mano", "Valefor");
  const base = costeDe(e, 1, aliado).pagar;
  e = sinRespuesta(aplicar(e, jugar(rito)));
  assert.equal(costeDe(e, 1, suyo).pagar, 2);
  assert.equal(costeDe(e, 0, mio).pagar, 1);
  assert.equal(costeDe(e, 1, aliado).pagar, base);
  N.expirar(e, "finTurno");
  assert.equal(costeDe(e, 1, suyo).pagar, 1);
});

test("Rito del Bandido: Desterrándolo de tu Cementerio y pagando un Oro Baraja un Aliado de coste 2 o menos", () => {
  let e = mesa();
  oros(e, 0, 1);
  const rito = poner(e, 0, "cementerio", "Rito del Bandido");
  const rv = poner(e, 1, "defensa", "Valefor");
  e = aplicar(e, habilidad(rito, "Rito del Bandido"));
  assert.equal(zonaDe(e, rito), "destierro");
  assert.equal(zonaDe(e, rv), "castillo");
});

test("Ritual Oscuro: tiene Exhumar y desde el Cementerio Roba y Baraja una carta de coste 2 o menos", () => {
  let e = mesa();
  oros(e, 0, 1);
  const rv = poner(e, 1, "defensa", "Valefor");
  const ritual = poner(e, 0, "cementerio", "Ritual Oscuro");
  assert.equal(N.tiene(e, ritual, "Exhumar"), true);
  e = sinRespuesta(aplicar(e, jugar(ritual, { desde: "cementerio" })));
  e = elegir(e, texto("Robar"));
  e = elegir(e, texto("Barajar una carta"));
  e = elegir(e, rv);
  assert.equal(zonaDe(e, rv), "castillo");
  assert.equal(e.jugadores[0].mano.length, 1);
  assert.equal(zonaDe(e, ritual), "destierro");
});

test("Ritual Oscuro: Baraja y/o Destierra hasta cuatro cartas de los Cementerios", () => {
  let e = mesa();
  oros(e, 0, 1);
  const c = [0, 0, 1, 1].map((j) => poner(e, j, "cementerio", "Valefor"));
  const ritual = poner(e, 0, "mano", "Ritual Oscuro");
  e = hacer(e, jugar(ritual), texto("Barajar y/o"), null, c[0], c[2], null, c[1], null);
  assert.deepEqual(c.map((u) => zonaDe(e, u)), ["castillo", "destierro", "castillo", "cementerio"]);
});

test("Ritual Vudú: en tu Vigilia reduce su coste por cada carta que jugó tu oponente este turno, hasta 0", () => {
  const e = mesa();
  const vudu = poner(e, 0, "mano", "Ritual Vudú");
  assert.equal(costeDe(e, 0, vudu).pagar, 2);
  e.jugadores[1].jugadas.Talismán = 1;
  assert.equal(costeDe(e, 0, vudu).pagar, 1);
  e.jugadores[1].jugadas.Aliado = 2;
  assert.equal(costeDe(e, 0, vudu).pagar, 0);
  e.fase = "talismanes";
  assert.equal(costeDe(e, 0, vudu).pagar, 2);
});

test("Ritual Vudú: Roba una carta, sube un Aliado del Cementerio y no puedes jugar otro Ritual Vudú este turno", () => {
  let e = mesa();
  oros(e, 0, 4);
  const a = poner(e, 0, "cementerio", "Valefor");
  const vudu = poner(e, 0, "mano", "Ritual Vudú");
  const otro = poner(e, 0, "mano", "Ritual Vudú");
  e = hacer(e, jugar(vudu), a);
  assert.equal(zonaDe(e, a), "mano");
  assert.equal(e.jugadores[0].mano.length, 3);
  assert.equal(puedeJugar(e, otro), false);
});

test("Ritual Vudú: al comienzo de tu próximo turno genera un Oro y Roba dos cartas", () => {
  let e = mesa();
  oros(e, 0, 2);
  const vudu = poner(e, 0, "mano", "Ritual Vudú");
  e = sinRespuesta(aplicar(e, jugar(vudu)));
  const mano = e.jugadores[0].mano.length;
  e = disparar(e, "comienzoTurno", { j: 1 });
  assert.equal(e.jugadores[0].mano.length, mano);
  e = disparar(e, "comienzoTurno", { j: 0 });
  assert.equal(e.jugadores[0].mano.length, mano + 2);
  assert.equal(e.jugadores[0].generados.reduce((s, g) => s + g.n, 0), 1);
  e = disparar(e, "comienzoTurno", { j: 0 });
  assert.equal(e.jugadores[0].mano.length, mano + 2);
});

test("Ritual de Sombras: Baraja y/o Destierra hasta dos cartas de los Cementerios y Roba una carta", () => {
  let e = mesa();
  oros(e, 0, 1);
  const a = poner(e, 1, "cementerio", "Valefor");
  const b = poner(e, 1, "cementerio", "Valefor");
  const ritual = poner(e, 0, "mano", "Ritual de Sombras");
  e = hacer(e, jugar(ritual), a, null, b);
  assert.equal(zonaDe(e, a), "castillo");
  assert.equal(zonaDe(e, b), "destierro");
  assert.equal(e.jugadores[0].mano.length, 1);
});

test("Ritual de Sombras: al comienzo de tu Vigilia puedes pagar un Oro para subirlo del Cementerio a tu mano", () => {
  let e = mesa();
  oros(e, 0, 1);
  const ritual = poner(e, 0, "cementerio", "Ritual de Sombras");
  e = disparar(e, "comienzoVigilia", { j: 0 });
  e = elegir(e, true);
  assert.equal(zonaDe(e, ritual), "mano");
  assert.equal(e.jugadores[0].reserva.length, 0);
});

test("Ritual de Sombras: no se ofrece sin Oros ni en la Vigilia oponente", () => {
  let e = mesa();
  const ritual = poner(e, 0, "cementerio", "Ritual de Sombras");
  e = disparar(e, "comienzoVigilia", { j: 0 });
  assert.equal(e.pendiente, null);
  oros(e, 0, 1);
  e = disparar(e, "comienzoVigilia", { j: 1 });
  assert.equal(e.pendiente, null);
  assert.equal(zonaDe(e, ritual), "cementerio");
});

test("Rugido de Titán: reduce su coste por cada Aliado Titán o Ignis que controles o muestres de tu mano, mínimo 1", () => {
  const e = mesa();
  const rugido = poner(e, 0, "mano", "Rugido de Titán");
  assert.equal(costeDe(e, 0, rugido).pagar, 3);
  poner(e, 0, "defensa", "Titán Abismal");
  assert.equal(costeDe(e, 0, rugido).pagar, 2);
  poner(e, 0, "mano", "Ignis Desatado");
  assert.equal(costeDe(e, 0, rugido).pagar, 1);
  poner(e, 0, "mano", "Ignis Desatado");
  assert.equal(costeDe(e, 0, rugido).pagar, 1);
});

test("Rugido de Titán: previene que una carta Ignis o Titán que controles sea afectada por un efecto oponente", () => {
  let e = mesa();
  oros(e, 0, 2);
  const titan = poner(e, 0, "defensa", "Titán Abismal");
  const v = poner(e, 0, "defensa", "Valefor");
  const danza = poner(e, 1, "mano", "Danza del Cuchillo");
  const rugido = poner(e, 0, "mano", "Rugido de Titán");
  e = sinRespuesta(aplicar(e, jugar(rugido)));
  assert.equal(e.pendiente.opciones.some((o) => o.valor === v), false);
  e = elegir(e, titan);
  assert.equal(N.proteccionContra(e, titan, ctxRival(e, danza)).inmune, true);
  assert.equal(N.proteccionContra(e, v, ctxRival(e, danza)).inmune, false);
  N.expirar(e, "finTurno");
  assert.equal(N.proteccionContra(e, titan, ctxRival(e, danza)).inmune, false);
});

test("Rugido de Titán: previene que la carta sea Anulada o su habilidad cancelada", { todo: "protección: prevenir que una carta de cierto nombre sea Anulada o su habilidad cancelada" }, () => {});

test("Rugido del Origen: aplica los efectos de Bestia, Dragón y Sombra según tus Razas", () => {
  let e = mesa();
  oros(e, 0, 1);
  const bestia = ficticia(e, 0, "defensa", { razas: ["Bestia"] });
  const dragon = poner(e, 0, "defensa", "Valefor");
  ficticia(e, 0, "defensa", { razas: ["Sombra"] });
  const c = poner(e, 0, "cementerio", "Balaur");
  const rugido = poner(e, 0, "mano", "Rugido del Origen");
  e = hacer(e, jugar(rugido), texto("Bestia"), texto("Dragón"), texto("Sombra"));
  assert.equal(N.fuerza(e, bestia), 3);
  assert.equal(N.fuerza(e, dragon), 4);
  assert.equal(zonaDe(e, c), "pagado");
  assert.equal(N.carta(e, c).tipo, "Oro");
  assert.equal(N.activa(e, c), false);
  assert.equal(e.jugadores[1].destierro.length, 4);
});

test("Rugido del Origen: solo ofrece los efectos de las Razas que controlas", () => {
  let e = mesa();
  oros(e, 0, 1);
  ficticia(e, 0, "defensa", { razas: ["Sombra"] });
  const rugido = poner(e, 0, "mano", "Rugido del Origen");
  e = sinRespuesta(aplicar(e, jugar(rugido)));
  assert.deepEqual(textos(e), ["Sombra: tu oponente Destierra cuatro cartas del tope de su Castillo", "listo"]);
});

test("Ruptura del Límite: el oponente Bota cuatro y puedes Desterrar dos Aliados para repetirlo y Robar dos", () => {
  let e = mesa();
  oros(e, 0, 1);
  const a = poner(e, 0, "defensa", "Valefor");
  const b = poner(e, 0, "defensa", "Valefor");
  const ruptura = poner(e, 0, "mano", "Ruptura del Límite");
  e = hacer(e, jugar(ruptura), true);
  assert.equal(zonaDe(e, a), "destierro");
  assert.equal(zonaDe(e, b), "destierro");
  assert.equal(e.jugadores[1].castillo.length, 22);
  assert.equal(e.jugadores[0].mano.length, 2);
  assert.equal(zonaDe(e, ruptura), "destierro");
});

test("Ruptura del Límite: sin dos Aliados de coste 1 o más solo Bota cuatro", () => {
  let e = mesa();
  oros(e, 0, 1);
  poner(e, 0, "defensa", "Valefor");
  ficticia(e, 0, "defensa", { coste: 0 });
  const ruptura = poner(e, 0, "mano", "Ruptura del Límite");
  e = sinRespuesta(aplicar(e, jugar(ruptura)));
  assert.equal(e.pendiente, null);
  assert.equal(e.jugadores[1].castillo.length, 26);
});

test("Sabiduria de la Oruga: Destierra hasta dos cartas de coste 2 o menos de la mano oponente y se Destierra", () => {
  let e = mesa();
  oros(e, 0, 2);
  const a = poner(e, 1, "mano", "Valefor");
  const b = poner(e, 1, "mano", "Balaur");
  const c = poner(e, 1, "mano", "Valefor");
  const oruga = poner(e, 0, "mano", "Sabiduria de la Oruga");
  e = aplicar(e, jugar(oruga));
  assert.equal(e.pendiente.opciones.some((o) => o.valor === b), false);
  e = elegir(e, a);
  e = elegir(e, c);
  assert.equal(zonaDe(e, a), "destierro");
  assert.equal(zonaDe(e, c), "destierro");
  assert.equal(zonaDe(e, b), "mano");
  assert.equal(zonaDe(e, oruga), "destierro");
});

test("Sabiduria de la Oruga: hasta el final de tu próximo turno los jugadores solo atacan con un Aliado", () => {
  let e = mesa();
  oros(e, 0, 2);
  const a1 = poner(e, 0, "defensa", "Valefor");
  const a2 = poner(e, 0, "defensa", "Valefor");
  const oruga = poner(e, 0, "mano", "Sabiduria de la Oruga");
  e = sinRespuesta(aplicar(e, jugar(oruga)));
  const vigente = (s) => s.efectos.some((f) => f.tipo === "maxAtacantes" && f.n === 1 && f.j === undefined);
  assert.equal(vigente(e), true);
  const f = structuredClone({ ...e, catalogo: null });
  e = aplicar(e, { tipo: "batalla" });
  while (e.fase === "momento") e = aplicar(e, { tipo: "pasarMomento" });
  e = aplicar(e, { tipo: "atacar", uid: a1 });
  assert.equal(accionesLegales(e).some((a) => a.tipo === "atacar" && a.uid === a2), false);
  for (let t = 0; t < 3; t++) {
    N.expirar(f, "finTurno");
    assert.equal(vigente(f), t < 2);
    f.turno += 1;
  }
});

test("Sabiduria de la Oruga: solo se Roban hasta tres cartas por efectos por turno", { todo: "efecto: límite de cartas Robadas por efectos por turno" }, () => {});

test("Sacrificio Solar: Anula una carta de coste 0 y no se puede jugar fuera de respuesta", () => {
  let e = mesa();
  oros(e, 1, 1);
  const sacrificio = poner(e, 1, "mano", "Sacrificio Solar");
  const seduccion = poner(e, 0, "mano", "Seducción");
  assert.equal(N.carta(e, sacrificio).soloRespuesta, true);
  e = aplicar(e, jugar(seduccion));
  assert.ok(accionesLegales(e).some((a) => a.tipo === "responder" && a.uid === sacrificio));
  e = aplicar(e, { tipo: "responder", uid: sacrificio });
  e = sinRespuesta(e);
  assert.equal(zonaDe(e, seduccion), "destierro");
  assert.equal(zonaDe(e, sacrificio), "cementerio");
  assert.equal(e.jugadores[0].mano.length, 0);
});

test("Sacrificio Solar: no responde a cartas de coste 1 o más", () => {
  let e = mesa();
  oros(e, 0, 1);
  oros(e, 1, 1);
  poner(e, 1, "mano", "Sacrificio Solar");
  const manada = poner(e, 0, "mano", "Llamar a la Manada");
  e = aplicar(e, jugar(manada));
  assert.equal(accionesLegales(e).some((a) => a.tipo === "responder"), false);
});

test("Sacrificio Solar: pagando un Oro y Barajándola desde tu mano Destierra una carta de coste 2 o menos y Roba una", () => {
  let e = mesa();
  oros(e, 0, 1);
  const rv = poner(e, 1, "defensa", "Valefor");
  const sacrificio = poner(e, 0, "mano", "Sacrificio Solar");
  e = hacer(e, habilidad(sacrificio, "Sacrificio Solar"), texto("Desterrar"), rv);
  assert.equal(zonaDe(e, rv), "destierro");
  assert.equal(zonaDe(e, sacrificio), "castillo");
  assert.equal(e.jugadores[0].mano.length, 1);
});

test("Sacrificio Solar: Anula o cancela cartas jugadas sin pagar su coste y cancela habilidades", { todo: "respuesta: Anular una carta jugada sin pagar su coste o cancelar la habilidad de una carta" }, () => {});

test("Saltar la Defensa: Roba dos cartas", () => {
  let e = mesa();
  oros(e, 0, 1);
  const saltar = poner(e, 0, "mano", "Saltar la Defensa");
  e = hacer(e, jugar(saltar), texto("Robar"));
  assert.equal(e.jugadores[0].mano.length, 2);
});

test("Saltar la Defensa: busca tres cartas de distinto nombre en el Castillo oponente y las Destierra", () => {
  let e = mesa();
  oros(e, 0, 1);
  const v = poner(e, 1, "castillo", "Valefor");
  const v2 = poner(e, 1, "castillo", "Valefor");
  const b = poner(e, 1, "castillo", "Balaur");
  const saltar = poner(e, 0, "mano", "Saltar la Defensa");
  e = hacer(e, jugar(saltar), texto("Buscar"), v);
  assert.equal(e.pendiente.opciones.some((o) => o.valor === v2), false);
  e = elegir(e, b);
  e = elegir(e, (x) => x !== null && N.carta(e, x).nombre === "Drácula");
  assert.equal(e.jugadores[1].destierro.length, 3);
  assert.equal(zonaDe(e, v2), "castillo");
});

test("Saltar la Defensa: con Castillo de Arena en tu Destierro aplica ambos efectos", () => {
  let e = mesa();
  oros(e, 0, 1);
  ficticia(e, 0, "cementerio", { nombre: "Castillo de Arena", tipo: "Talismán" });
  const saltar = poner(e, 0, "mano", "Saltar la Defensa");
  e = sinRespuesta(aplicar(e, jugar(saltar)));
  e = elegir(e, null);
  assert.equal(e.jugadores[0].mano.length, 2);
});

test("Saltar la Defensa: con Castillo de Arena no puede ser Anulado", () => {
  let e = mesa();
  oros(e, 0, 2);
  oros(e, 1, 5);
  poner(e, 1, "mano", "Ciempiés-SP");
  const saltar = poner(e, 0, "mano", "Saltar la Defensa");
  assert.equal(puedeResponder(aplicar(e, jugar(saltar))), true);
  ficticia(e, 0, "cementerio", { nombre: "Castillo de Arena", tipo: "Talismán" });
  e = aplicar(e, jugar(saltar));
  assert.equal(puedeResponder(e), false);
});

test("Saltar la Defensa: el ataque de tus Aliados no puede ser cancelado este turno", { todo: "efecto: el ataque no puede ser cancelado" }, () => {});

test("Santo Santo Santo: el oponente Descarta tres al azar y puede Desterrar cuatro del tope por cada una para recuperarla; tú Robas", () => {
  let e = mesa();
  oros(e, 0, 2);
  const m = [1, 2, 3].map(() => poner(e, 1, "mano", "Valefor"));
  const santo = poner(e, 0, "mano", "Santo Santo Santo");
  e = sinRespuesta(aplicar(e, jugar(santo)));
  assert.equal(e.pendiente.jugador, 1);
  e = elegir(e, m[0]);
  e = elegir(e, null);
  assert.equal(zonaDe(e, m[0]), "mano");
  assert.equal(zonaDe(e, m[1]), "cementerio");
  assert.equal(zonaDe(e, m[2]), "cementerio");
  assert.equal(e.jugadores[1].castillo.length, 26);
  assert.equal(e.jugadores[1].destierro.length, 4);
  assert.equal(e.jugadores[0].mano.length, 1);
});

test("Santo Santo Santo: solo puede jugarse pagando su coste", () => {
  const e = mesa();
  const santo = poner(e, 0, "mano", "Santo Santo Santo");
  assert.equal(N.carta(e, santo).soloPagando, true);
});

test("Saurial: hasta dos Oros se convierten en Aliados de Fuerza 4, Imbloqueable, que no pueden salir del juego", () => {
  let e = mesa();
  const [a, b] = oros(e, 0, 4);
  const saurial = poner(e, 0, "mano", "Saurial");
  e = sinRespuesta(aplicar(e, jugar(saurial)));
  const libres = e.jugadores[0].reserva;
  const [c, d] = libres;
  e = elegir(e, c);
  e = elegir(e, d);
  for (const u of [c, d]) {
    assert.equal(zonaDe(e, u), "defensa");
    assert.equal(N.carta(e, u).tipo, "Aliado");
    assert.equal(N.fuerza(e, u), 4);
    assert.equal(N.tiene(e, u, "Imbloqueable"), true);
    assert.equal(N.puedeSalir(e, u), false);
  }
  assert.equal(zonaDe(e, a), "pagado");
  assert.equal(zonaDe(e, b), "pagado");
});

test("Saurial: desde tu Cementerio, Desterrando un Oro de ahí, se juega pagando un Oro menos y se Destierra", () => {
  let e = mesa();
  oros(e, 0, 2);
  const oro = poner(e, 0, "cementerio", "Drácula");
  const saurial = poner(e, 0, "cementerio", "Saurial");
  e = aplicar(e, habilidad(saurial, "Saurial"));
  const [c] = e.jugadores[0].reserva;
  e = elegir(e, c);
  e = elegir(e, null);
  assert.equal(zonaDe(e, oro), "destierro");
  assert.equal(zonaDe(e, saurial), "destierro");
  assert.equal(N.fuerza(e, c), 4);
});

test("Saurial: los Oros convertidos tienen nombre Dinosaurio", { todo: "conversión: cambiar el nombre de una carta convertida" }, () => {});

test("Seducción: cada jugador Roba hasta tres y el oponente Destierra dos del tope por cada carta que Robe", () => {
  let e = mesa();
  const seduccion = poner(e, 0, "mano", "Seducción");
  e = hacer(e, jugar(seduccion), texto("Cada jugador Roba"), 3);
  const [t1, t2] = e.pendiente.opciones.map((o) => o.valor);
  e = elegir(e, t1);
  e = elegir(e, t2);
  e = elegir(e, null);
  assert.equal(e.jugadores[0].mano.length, 3);
  assert.equal(e.jugadores[1].mano.length, 2);
  assert.equal(e.jugadores[1].destierro.length, 4);
  assert.equal(zonaDe(e, seduccion), "destierro");
});

test("Seducción: cada jugador pone un Oro de su mano en su Oro Pagado y el del oponente entra sin habilidad", () => {
  let e = mesa();
  const mio = poner(e, 0, "mano", "Drácula");
  const suyo = poner(e, 1, "mano", "Onsen");
  const seduccion = poner(e, 0, "mano", "Seducción");
  e = hacer(e, jugar(seduccion), texto("Cada jugador pone"));
  assert.equal(e.pendiente, null);
  assert.equal(zonaDe(e, mio), "pagado");
  assert.ok(e.jugadores[1].pagado.includes(suyo));
  assert.equal(N.activa(e, suyo), false);
  N.expirar(e, "finTurno");
  assert.equal(N.activa(e, suyo), true);
});

test("Segundo Sello: busca un Sello y hasta dos Aliados ganan 2 de Fuerza y su daño va al Destierro", () => {
  let e = mesa();
  oros(e, 0, 1);
  const sello = poner(e, 0, "castillo", "Primer Sello");
  const a = poner(e, 0, "defensa", "Valefor");
  const b = poner(e, 0, "defensa", "Valefor");
  const segundo = poner(e, 0, "mano", "Segundo Sello");
  e = hacer(e, jugar(segundo), sello, a, null);
  assert.equal(zonaDe(e, sello), "mano");
  assert.equal(N.fuerza(e, a), 5);
  assert.equal(N.tiene(e, a, "DanoAlDestierro"), true);
  assert.equal(N.fuerza(e, b), 3);
  N.expirar(e, "finTurno");
  assert.equal(N.fuerza(e, a), 3);
});

test("Segundo Sello: el daño directo de tus Sello va al Destierro y desde el Cementerio tus Sello no pueden ser Anulados", { todo: "continua desde el Cementerio: cartas de cierto nombre no pueden ser Anuladas; efecto: daño directo de cartas de cierto nombre va al Destierro" }, () => {});

test("Semilla de Destruccion: el oponente muestra hasta un Oro y pone todo en su Cementerio; pagando un Oro se repite", () => {
  let e = mesa();
  oros(e, 0, 3);
  const r = e.jugadores[1].castillo;
  const v1 = poner(e, 1, "castillo", "Valefor");
  const v2 = poner(e, 1, "castillo", "Valefor");
  r.splice(r.indexOf(v1), 1);
  r.splice(r.indexOf(v2), 1);
  r.unshift(v1, v2);
  const semilla = poner(e, 0, "mano", "Semilla de Destruccion");
  e = sinRespuesta(aplicar(e, jugar(semilla)));
  assert.equal(e.jugadores[1].cementerio.length, 3);
  assert.equal(zonaDe(e, v1), "cementerio");
  e = elegir(e, true);
  assert.equal(e.jugadores[1].cementerio.length, 4);
  assert.equal(e.jugadores[0].reserva.length, 0);
  assert.equal(zonaDe(e, semilla), "destierro");
});

test("Sentir Energia: Baraja una carta de tu Cementerio y Roba una carta", () => {
  let e = mesa();
  oros(e, 0, 1);
  const c = poner(e, 0, "cementerio", "Valefor");
  const sentir = poner(e, 0, "mano", "Sentir Energia");
  e = hacer(e, jugar(sentir), null, c);
  assert.equal(zonaDe(e, c), "castillo");
  assert.equal(e.jugadores[0].mano.length, 1);
});

test("Sentir Energia: Barajándolo desde tu Cementerio una carta recupera su habilidad", () => {
  let e = mesa();
  const v = poner(e, 0, "defensa", "Valefor");
  const sentir = poner(e, 0, "cementerio", "Sentir Energia");
  assert.equal(puedeUsar(e, sentir), false);
  N.agregarEfecto(e, { tipo: "pierdeHabilidad", uid: v }, 1);
  assert.equal(N.activa(e, v), false);
  e = aplicar(e, habilidad(sentir, "Sentir Energia"));
  assert.equal(N.activa(e, v), true);
  assert.equal(zonaDe(e, sentir), "castillo");
});

test("Sentir Energia: previene que una carta que controles sea afectada por un efecto oponente", () => {
  let e = mesa();
  oros(e, 0, 1);
  const v = poner(e, 0, "defensa", "Valefor");
  const rv = poner(e, 1, "defensa", "Valefor");
  const danza = poner(e, 1, "mano", "Danza del Cuchillo");
  const sentir = poner(e, 0, "mano", "Sentir Energia");
  e = sinRespuesta(aplicar(e, jugar(sentir)));
  assert.equal(e.pendiente.opciones.some((o) => o.valor === rv), false);
  e = elegir(e, v);
  assert.equal(N.proteccionContra(e, v, ctxRival(e, danza)).inmune, true);
  assert.equal(e.jugadores[0].mano.length, 1);
  N.expirar(e, "finTurno");
  assert.equal(N.proteccionContra(e, v, ctxRival(e, danza)).inmune, false);
});

test("Septimo Sello: no puede ser Anulado", () => {
  const e = mesa();
  const s = poner(e, 0, "mano", "Septimo Sello");
  assert.equal(N.carta(e, s).claves.includes("NoAnulable"), true);
});

test("Septimo Sello: convierte un Oro y una carta oponente de cada coste en Fuerza 0 sin habilidad; una tuya gana Indestructible e Indesterrable", () => {
  let e = mesa();
  oros(e, 0, 2);
  const oro = poner(e, 1, "reserva", "Onsen");
  const r1 = poner(e, 1, "defensa", "Valefor");
  const r2 = poner(e, 1, "defensa", "Valefor");
  const r3 = ficticia(e, 1, "defensa", { coste: 3, fuerza: 5 });
  const mio = poner(e, 0, "defensa", "Valefor");
  const septimo = poner(e, 0, "mano", "Septimo Sello");
  e = hacer(e, jugar(septimo), r1);
  assert.equal(e.pendiente.opciones.some((o) => o.valor === r2), false);
  e = elegir(e, r3);
  e = elegir(e, mio);
  e = elegir(e, texto("Robar"));
  assert.equal(N.activa(e, oro), false);
  assert.equal(N.fuerza(e, r1), 0);
  assert.equal(N.activa(e, r1), false);
  assert.equal(N.fuerza(e, r3), 0);
  assert.equal(N.fuerza(e, r2), 3);
  assert.equal(N.tiene(e, mio, "Indestructible"), true);
  assert.equal(N.tiene(e, mio, "Indesterrable"), true);
  assert.equal(e.jugadores[0].mano.length, 2);
});

test("Septimo Sello: el oponente Bota una carta por cada Sello en tu Cementerio, hasta siete", () => {
  let e = mesa();
  oros(e, 0, 2);
  for (let i = 0; i < 9; i++) poner(e, 0, "cementerio", "Cuarto Sello");
  poner(e, 0, "cementerio", "Valefor");
  const septimo = poner(e, 0, "mano", "Septimo Sello");
  e = sinRespuesta(aplicar(e, jugar(septimo)));
  e = elegir(e, (v) => v !== null);
  e = elegir(e, texto("Tu oponente Bota"));
  assert.equal(e.jugadores[1].castillo.length, 23);
});

test("Serafurgia: Destierra un Oro tuyo y convierte una carta oponente de coste 3 o menos en un Oro sin habilidad en tu Oro Pagado", () => {
  let e = mesa();
  oros(e, 0, 2);
  const rv = poner(e, 1, "defensa", "Valefor");
  const sera = poner(e, 0, "mano", "Serafurgia");
  e = sinRespuesta(aplicar(e, jugar(sera)));
  const [o] = e.jugadores[0].reserva;
  e = elegir(e, o);
  assert.equal(zonaDe(e, o), "destierro");
  assert.ok(e.jugadores[0].pagado.includes(rv));
  assert.equal(N.carta(e, rv).tipo, "Oro");
  assert.equal(N.activa(e, rv), false);
});

test("Serafurgia: requiere un Oro que controles", () => {
  const e = mesa();
  e.jugadores[0].generados = [{ n: 1, tipos: null }];
  const sera = poner(e, 0, "mano", "Serafurgia");
  assert.equal(puedeJugar(e, sera), false);
});

test("Serafurgia: Desterrándolo de tu Cementerio una carta pierde su habilidad por el turno", () => {
  let e = mesa();
  const rv = poner(e, 1, "defensa", "Valefor");
  const sera = poner(e, 0, "cementerio", "Serafurgia");
  e = aplicar(e, habilidad(sera, "Serafurgia"));
  assert.equal(zonaDe(e, sera), "destierro");
  assert.equal(N.activa(e, rv), false);
  N.expirar(e, "finTurno");
  assert.equal(N.activa(e, rv), true);
});

test("Sesión Espiritista: al jugarlo se Destierra", () => {
  let e = mesa();
  oros(e, 0, 1);
  const sesion = poner(e, 0, "mano", "Sesión Espiritista");
  e = sinRespuesta(aplicar(e, jugar(sesion)));
  assert.equal(zonaDe(e, sesion), "destierro");
});

test("Sesión Espiritista: hasta tu próximo turno, cuando el oponente Roba por un efecto puedes poner esa cantidad del tope de tu Castillo en tu mano", () => {
  let e = mesa();
  oros(e, 0, 1);
  const sesion = poner(e, 0, "mano", "Sesión Espiritista");
  e = sinRespuesta(aplicar(e, jugar(sesion)));
  assert.equal(zonaDe(e, sesion), "destierro");
  N.robar(e, 0, 1, true);
  resolver(e);
  assert.equal(e.pendiente, null);
  N.robar(e, 1, 2);
  resolver(e);
  assert.equal(e.pendiente, null);
  const mano = e.jugadores[0].mano.length;
  const castillo = e.jugadores[0].castillo.length;
  N.robar(e, 1, 2, true);
  resolver(e);
  e = elegir(e, true);
  assert.equal(e.jugadores[0].mano.length, mano + 2);
  assert.equal(e.jugadores[0].castillo.length, castillo - 2);
  e.turno += 2;
  N.expirar(e, "inicio");
  N.robar(e, 1, 1, true);
  resolver(e);
  assert.equal(e.pendiente, null);
});

test("Sesión Espiritista: también cuando el oponente sube o busca cartas a su mano por un efecto", { todo: "evento: cuando un jugador pone cartas en su mano por un efecto que no sea Robar" }, () => {});

test("Sesión Espiritista: por el resto del juego el daño de combate a tu Castillo se reduce en dos", { todo: "efecto: reducir el daño de combate recibido por tu Castillo de forma permanente" }, () => {});
