import { test } from "node:test";
import assert from "node:assert/strict";
import { mesa, poner, oros, hacer, elegir, sinRespuesta, accionesLegales, aplicar, zonaDe, id, N } from "./ayuda-duelo.mjs";
import { costeDe } from "../web/duelo/motor.js";

function fijarTope(e, j, nombres) {
  return nombres.map((nombre, i) => {
    const uid = e.jugadores[j].castillo[i];
    e.instancias[uid] = id(nombre);
    return uid;
  });
}

function habilidadDe(e, uid, nombre, h = 0) {
  return { tipo: "habilidad", uid, def: id(nombre), h };
}

function jugaDesdeMano(e, uid) {
  return accionesLegales(e).some((a) => a.tipo === "jugar" && a.uid === uid);
}

test("Dragón Dorado: solo se juega como respuesta, anula una carta, se destierra y baraja tantas cartas de la mano como el coste anulado", () => {
  let e = mesa();
  oros(e, 0, 1);
  const valefor = poner(e, 0, "mano", "Valefor");
  const dorado = poner(e, 1, "mano", "Dragón Dorado");
  const a = poner(e, 1, "mano", "Jabberwocky");
  const b = poner(e, 1, "mano", "Sir Persival");
  e = aplicar(e, { tipo: "jugar", uid: valefor });
  assert.ok(accionesLegales(e).some((x) => x.tipo === "responder" && x.uid === dorado));
  e = hacer(e, { tipo: "responder", uid: dorado }, a);
  assert.equal(zonaDe(e, valefor), "cementerio");
  assert.equal(zonaDe(e, dorado), "destierro");
  assert.equal(zonaDe(e, a), "castillo");
  assert.equal(zonaDe(e, b), "mano");
  assert.equal(e.jugadores[1].mano.length, 1);
});

test("Dragón Dorado: no puede jugarse en la Vigilia propia", () => {
  const e = mesa();
  const dorado = poner(e, 0, "mano", "Dragón Dorado");
  assert.equal(jugaDesdeMano(e, dorado), false);
});

test("Ciempiés-SP: paga un Oro y anula una carta de coste 3", () => {
  let e = mesa();
  oros(e, 0, 3);
  oros(e, 1, 1);
  const persival = poner(e, 0, "mano", "Sir Persival");
  const ciempies = poner(e, 1, "mano", "Ciempiés-SP");
  e = aplicar(e, { tipo: "jugar", uid: persival });
  assert.ok(accionesLegales(e).some((x) => x.tipo === "responder" && x.uid === ciempies));
  e = aplicar(e, { tipo: "responder", uid: ciempies });
  assert.equal(zonaDe(e, persival), "cementerio");
  assert.equal(zonaDe(e, ciempies), "cementerio");
  assert.equal(e.jugadores[1].pagado.length, 1);
});

test("Ciempiés-SP: no puede anular una carta de coste 4 o más", () => {
  let e = mesa();
  oros(e, 0, 7);
  oros(e, 1, 1);
  const gusano = poner(e, 0, "mano", "Gusano Rojo");
  const ciempies = poner(e, 1, "mano", "Ciempiés-SP");
  e = aplicar(e, { tipo: "jugar", uid: gusano });
  assert.equal(accionesLegales(e).some((x) => x.tipo === "responder" && x.uid === ciempies), false);
});

test("Vision Heroica: baraja una carta de coste 3 o menos en juego", () => {
  let e = mesa();
  oros(e, 0, 1);
  const vision = poner(e, 0, "mano", "Vision Heroica");
  const jab = poner(e, 1, "defensa", "Jabberwocky");
  e = sinRespuesta(hacer(e, { tipo: "jugar", uid: vision }, jab));
  assert.equal(zonaDe(e, jab), "castillo");
  assert.equal(zonaDe(e, vision), "cementerio");
});

test("Vision Heroica: como respuesta anula un Talismán oponente", () => {
  let e = mesa();
  oros(e, 0, 1);
  oros(e, 1, 1);
  const guillatun = poner(e, 0, "mano", "Guillatún");
  const vision = poner(e, 1, "mano", "Vision Heroica");
  e = aplicar(e, { tipo: "jugar", uid: guillatun });
  assert.ok(accionesLegales(e).some((x) => x.tipo === "responder" && x.uid === vision));
  e = aplicar(e, { tipo: "responder", uid: vision });
  assert.equal(zonaDe(e, guillatun), "cementerio");
  assert.equal(e.pendiente, null);
  assert.equal(e.jugadores[0].mano.length, 0);
});

test("Vision Heroica: no anula una carta que no es Talismán", () => {
  let e = mesa();
  oros(e, 0, 1);
  oros(e, 1, 1);
  const valefor = poner(e, 0, "mano", "Valefor");
  const vision = poner(e, 1, "mano", "Vision Heroica");
  e = aplicar(e, { tipo: "jugar", uid: valefor });
  assert.equal(accionesLegales(e).some((x) => x.tipo === "responder" && x.uid === vision), false);
});

test("Vision Heroica: desde el Cementerio, pagando un Oro, sube a la mano y roba una carta", () => {
  let e = mesa();
  oros(e, 0, 1);
  const vision = poner(e, 0, "cementerio", "Vision Heroica");
  e = hacer(e, habilidadDe(e, vision, "Vision Heroica"));
  assert.equal(zonaDe(e, vision), "mano");
  assert.equal(e.jugadores[0].mano.length, 2);
  assert.equal(e.jugadores[0].pagado.length, 1);
});

test("Cuervo Nocturno: destierra seis cartas del tope del Castillo oponente", () => {
  let e = mesa();
  oros(e, 0, 2);
  const cuervo = poner(e, 0, "mano", "Cuervo Nocturno");
  e = sinRespuesta(hacer(e, { tipo: "jugar", uid: cuervo }));
  assert.equal(e.jugadores[1].castillo.length, 24);
  assert.equal(e.jugadores[1].destierro.length, 6);
  assert.equal(zonaDe(e, cuervo), "cementerio");
});

test("Cuervo Nocturno: no puede ser Anulado", () => {
  let e = mesa();
  oros(e, 0, 2);
  oros(e, 1, 1);
  const cuervo = poner(e, 0, "mano", "Cuervo Nocturno");
  const ciempies = poner(e, 1, "mano", "Ciempiés-SP");
  e = aplicar(e, { tipo: "jugar", uid: cuervo });
  assert.equal(accionesLegales(e).some((x) => x.tipo === "responder" && x.uid === ciempies), false);
  assert.equal(e.jugadores[1].castillo.length, 24);
});

test("Cuervo Nocturno: si atacaste el turno anterior tiene Exhumar y se destierra tras jugarlo desde el Cementerio", () => {
  let e = mesa();
  oros(e, 0, 2);
  const cuervo = poner(e, 0, "cementerio", "Cuervo Nocturno");
  assert.equal(accionesLegales(e).some((a) => a.tipo === "jugar" && a.uid === cuervo), false);
  e.jugadores[0].atacoTurnoAnterior = true;
  e = sinRespuesta(hacer(e, { tipo: "jugar", uid: cuervo, desde: "cementerio" }));
  assert.equal(zonaDe(e, cuervo), "destierro");
  assert.equal(e.jugadores[1].destierro.length, 6);
});

test("Cuervo Nocturno: desde la mano, pone esta y otra carta al fondo del Castillo y roba dos cartas", () => {
  let e = mesa();
  const cuervo = poner(e, 0, "mano", "Cuervo Nocturno");
  const otra = poner(e, 0, "mano", "Valefor");
  e = hacer(e, habilidadDe(e, cuervo, "Cuervo Nocturno"));
  assert.equal(zonaDe(e, cuervo), "castillo");
  assert.equal(zonaDe(e, otra), "castillo");
  assert.equal(e.jugadores[0].castillo.at(-1), otra);
  assert.equal(e.jugadores[0].castillo.at(-2), cuervo);
  assert.equal(e.jugadores[0].mano.length, 2);
});

test("Cuervo Nocturno: la habilidad de la mano requiere otra carta en la mano", () => {
  const e = mesa();
  const cuervo = poner(e, 0, "mano", "Cuervo Nocturno");
  assert.equal(accionesLegales(e).some((a) => a.tipo === "habilidad" && a.uid === cuervo), false);
});

test("Caminar el Tablón: destierra de la mano oponente una carta que no sea Oro", () => {
  let e = mesa();
  oros(e, 0, 1);
  const caminar = poner(e, 0, "mano", "Caminar el Tablón");
  const oro = poner(e, 1, "mano", "Drácula");
  const jab = poner(e, 1, "mano", "Jabberwocky");
  const val = poner(e, 1, "mano", "Valefor");
  e = sinRespuesta(hacer(e, { tipo: "jugar", uid: caminar }, val));
  assert.equal(zonaDe(e, val), "destierro");
  assert.equal(zonaDe(e, jab), "mano");
  assert.equal(zonaDe(e, oro), "mano");
});

test("Caminar el Tablón: no se puede jugar si la mano oponente solo tiene Oros", () => {
  const e = mesa();
  oros(e, 0, 1);
  const caminar = poner(e, 0, "mano", "Caminar el Tablón");
  poner(e, 1, "mano", "Drácula");
  assert.equal(jugaDesdeMano(e, caminar), false);
});

test("Efigie: destierra un Aliado oponente de coste 2 o menos y un Aliado propio gana su habilidad", () => {
  let e = mesa();
  oros(e, 0, 3);
  const efigie = poner(e, 0, "mano", "Efigie");
  const persival = poner(e, 0, "defensa", "Sir Persival");
  const valefor = poner(e, 1, "defensa", "Valefor");
  assert.equal(N.tiene(e, persival, "Furia"), false);
  e = sinRespuesta(hacer(e, { tipo: "jugar", uid: efigie }));
  assert.equal(zonaDe(e, valefor), "destierro");
  assert.equal(N.tiene(e, persival, "Furia"), true);
});

test("Efigie: no puede elegir un Aliado oponente de coste 3 o más", () => {
  const e = mesa();
  oros(e, 0, 3);
  const efigie = poner(e, 0, "mano", "Efigie");
  poner(e, 0, "defensa", "Sir Persival");
  poner(e, 1, "defensa", "Sir Galahad");
  assert.equal(jugaDesdeMano(e, efigie), false);
});

test("Efigie: tiene Exhumar, se juega desde el Cementerio y luego se destierra", () => {
  let e = mesa();
  oros(e, 0, 3);
  const efigie = poner(e, 0, "cementerio", "Efigie");
  poner(e, 0, "defensa", "Sir Persival");
  poner(e, 1, "defensa", "Valefor");
  e = sinRespuesta(hacer(e, { tipo: "jugar", uid: efigie, desde: "cementerio" }));
  assert.equal(zonaDe(e, efigie), "destierro");
});

test("Señal de la Bestia: un Aliado pierde 3 de Fuerza, debe bloquear y robas una carta", () => {
  let e = mesa();
  oros(e, 0, 1);
  const senal = poner(e, 0, "mano", "Señal de la Bestia");
  const valefor = poner(e, 0, "defensa", "Valefor");
  const balaur = poner(e, 1, "defensa", "Balaur");
  assert.equal(N.fuerza(e, balaur), 5);
  e = sinRespuesta(hacer(e, { tipo: "jugar", uid: senal }, 0, balaur));
  assert.equal(N.fuerza(e, balaur), 2);
  assert.equal(e.jugadores[0].mano.length, 1);
  e = aplicar(e, { tipo: "batalla" });
  e = aplicar(e, { tipo: "atacar", uid: valefor });
  e = aplicar(e, { tipo: "finAtaque" });
  const legales = accionesLegales(e);
  assert.equal(legales.some((a) => a.tipo === "finBloqueo"), false);
  assert.ok(legales.some((a) => a.tipo === "bloquear" && a.uid === balaur));
});

test("Señal de la Bestia: tus Aliados ganan Furia y no se pueden Botar ni Desterrar más de diez cartas de cada Castillo", () => {
  let e = mesa();
  oros(e, 0, 1);
  const senal = poner(e, 0, "mano", "Señal de la Bestia");
  const persival = poner(e, 0, "defensa", "Sir Persival");
  const rival = poner(e, 1, "defensa", "Sir Persival");
  e = sinRespuesta(hacer(e, { tipo: "jugar", uid: senal }, 1));
  assert.equal(N.tiene(e, persival, "Furia"), true);
  assert.equal(N.tiene(e, rival, "Furia"), false);
  assert.equal(N.quitarDelCastillo(e, 1, 15, "cementerio"), 10);
  assert.equal(e.jugadores[1].castillo.length, 20);
});

test("Regresa Lucy: destruye una carta de coste 2 o menos y no ofrece cartas de coste 3", () => {
  let e = mesa();
  oros(e, 0, 1);
  const lucy = poner(e, 0, "mano", "Regresa Lucy");
  const jab = poner(e, 1, "defensa", "Jabberwocky");
  const persival = poner(e, 1, "defensa", "Sir Persival");
  e = aplicar(e, { tipo: "jugar", uid: lucy });
  assert.ok(e.pendiente.opciones.some((o) => o.valor === jab));
  assert.equal(e.pendiente.opciones.some((o) => o.valor === persival), false);
  e = elegir(e, jab);
  assert.equal(zonaDe(e, jab), "cementerio");
  assert.equal(zonaDe(e, persival), "defensa");
});

test("Regresa Lucy: no puede destruir una carta Indestructible", () => {
  let e = mesa();
  oros(e, 0, 1);
  const lucy = poner(e, 0, "mano", "Regresa Lucy");
  const valefor = poner(e, 1, "defensa", "Valefor");
  poner(e, 1, "arma", "Martillo Sacro", { portador: valefor });
  const jab = poner(e, 1, "defensa", "Jabberwocky");
  e = aplicar(e, { tipo: "jugar", uid: lucy });
  assert.equal(e.pendiente.opciones.some((o) => o.valor === valefor), false);
  assert.ok(e.pendiente.opciones.some((o) => o.valor === jab));
});

test("Malocchio: como respuesta anula un Talismán oponente y se destierra", () => {
  let e = mesa();
  oros(e, 0, 1);
  oros(e, 1, 1);
  const guillatun = poner(e, 0, "mano", "Guillatún");
  const malocchio = poner(e, 1, "mano", "Malocchio");
  e = aplicar(e, { tipo: "jugar", uid: guillatun });
  assert.ok(accionesLegales(e).some((x) => x.tipo === "responder" && x.uid === malocchio));
  e = aplicar(e, { tipo: "responder", uid: malocchio });
  assert.equal(zonaDe(e, guillatun), "cementerio");
  assert.equal(zonaDe(e, malocchio), "destierro");
  assert.equal(e.jugadores[0].mano.length, 0);
});

test("Malocchio: no responde a una carta que no es Talismán ni se juega en la Vigilia propia", () => {
  let e = mesa();
  oros(e, 0, 1);
  oros(e, 1, 1);
  const valefor = poner(e, 0, "mano", "Valefor");
  const malocchio = poner(e, 1, "mano", "Malocchio");
  const propia = poner(e, 0, "mano", "Malocchio");
  assert.equal(jugaDesdeMano(e, propia), false);
  e = aplicar(e, { tipo: "jugar", uid: valefor });
  assert.equal(accionesLegales(e).some((x) => x.tipo === "responder" && x.uid === malocchio), false);
});

test("Murciélagos del Caos: reduce su coste un Oro por cada Aliado de Fuerza 4 o más, hasta un mínimo de 1", () => {
  const e = mesa();
  const murcielagos = poner(e, 0, "mano", "Murciélagos del Caos");
  assert.equal(costeDe(e, 0, murcielagos).pagar, 3);
  poner(e, 0, "defensa", "Valefor");
  assert.equal(costeDe(e, 0, murcielagos).pagar, 3);
  poner(e, 0, "defensa", "Balaur");
  assert.equal(costeDe(e, 0, murcielagos).pagar, 2);
  poner(e, 0, "defensa", "Gusano Rojo");
  assert.equal(costeDe(e, 0, murcielagos).pagar, 1);
  poner(e, 0, "defensa", "Mecha-Daikaiju");
  assert.equal(costeDe(e, 0, murcielagos).pagar, 1);
});

test("Murciélagos del Caos: mira seis cartas del tope del Castillo y pone dos en la mano", () => {
  let e = mesa();
  oros(e, 0, 3);
  const murcielagos = poner(e, 0, "mano", "Murciélagos del Caos");
  const tope = fijarTope(e, 0, ["Valefor", "Jabberwocky", "Sir Persival", "Sir Galahad", "El Dracul", "Balaur"]);
  e = sinRespuesta(hacer(e, { tipo: "jugar", uid: murcielagos }, tope[1], tope[4]));
  assert.equal(zonaDe(e, tope[1]), "mano");
  assert.equal(zonaDe(e, tope[4]), "mano");
  assert.equal(e.jugadores[0].mano.length, 2);
  assert.deepEqual(e.jugadores[0].castillo.slice(0, 4), [tope[0], tope[2], tope[3], tope[5]]);
});

test("Guillatún: busca una carta en el Castillo y la pone en la mano", () => {
  let e = mesa();
  oros(e, 0, 1);
  const guillatun = poner(e, 0, "mano", "Guillatún");
  const jab = poner(e, 0, "castillo", "Jabberwocky");
  e = sinRespuesta(hacer(e, { tipo: "jugar", uid: guillatun }, jab));
  assert.equal(zonaDe(e, jab), "mano");
  assert.equal(e.jugadores[0].castillo.length, 30);
  assert.equal(zonaDe(e, guillatun), "cementerio");
});

test("Cráneo de Cristal: los Aliados en juego de ambos jugadores pierden 1 de Fuerza", () => {
  const e = mesa();
  const propio = poner(e, 0, "defensa", "Valefor");
  const rival = poner(e, 1, "defensa", "Valefor");
  assert.equal(N.fuerza(e, propio), 3);
  poner(e, 0, "reserva", "Cráneo de Cristal");
  assert.equal(N.fuerza(e, propio), 2);
  assert.equal(N.fuerza(e, rival), 2);
});

test("Cráneo de Cristal: el oponente debe atacar si puede", () => {
  const e = mesa();
  e.activo = 1;
  e.turno = 2;
  poner(e, 1, "defensa", "Valefor");
  assert.ok(accionesLegales(e).some((a) => a.tipo === "terminar"));
  poner(e, 0, "reserva", "Cráneo de Cristal");
  const legales = accionesLegales(e);
  assert.equal(legales.some((a) => a.tipo === "terminar"), false);
  assert.ok(legales.some((a) => a.tipo === "batalla"));
});

test("Cráneo de Cristal: en la Fase Final, sin Oros puestos, pone un Oro de la mano en la Reserva sin habilidad hasta tu próximo turno", () => {
  let e = mesa();
  poner(e, 0, "reserva", "Cráneo de Cristal");
  const hem = poner(e, 0, "mano", "Hem Hem Real");
  e = hacer(e, { tipo: "terminar" }, true);
  assert.equal(zonaDe(e, hem), "reserva");
  assert.equal(N.activa(e, hem), false);
});

test("Cráneo de Cristal: si pusiste un Oro este turno no se activa en la Fase Final", () => {
  let e = mesa();
  poner(e, 0, "reserva", "Cráneo de Cristal");
  const jugado = poner(e, 0, "mano", "Drácula");
  const hem = poner(e, 0, "mano", "Hem Hem Real");
  e = aplicar(e, { tipo: "oro", uid: jugado });
  e = aplicar(e, { tipo: "terminar" });
  assert.equal(e.pendiente, null);
  assert.equal(zonaDe(e, hem), "mano");
});

test("Signo Amarillo: al entrar mira cuatro cartas, pone una en la mano y otra en el Cementerio", () => {
  let e = mesa();
  const signo = poner(e, 0, "mano", "Signo Amarillo");
  const tope = fijarTope(e, 0, ["Valefor", "Jabberwocky", "Sir Persival", "Sir Galahad"]);
  e = hacer(e, { tipo: "oro", uid: signo }, tope[0], tope[2]);
  assert.equal(zonaDe(e, tope[0]), "mano");
  assert.equal(zonaDe(e, tope[2]), "cementerio");
  assert.deepEqual(e.jugadores[0].castillo.slice(0, 2), [tope[1], tope[3]]);
});

test("Signo Amarillo: es Indesterrable", () => {
  const e = mesa();
  const signo = poner(e, 0, "reserva", "Signo Amarillo");
  assert.equal(N.tiene(e, signo, "Indesterrable"), true);
});

test("Don de Amma: cuando el oponente pone su segundo Oro, puedes ponerlo desde la mano en tu Oro Pagado", () => {
  let e = mesa();
  oros(e, 0, 1);
  e.jugadores[0].orosPuestos = 1;
  const jab = poner(e, 0, "mano", "Jabberwocky");
  const don = poner(e, 1, "mano", "Don de Amma");
  e = sinRespuesta(hacer(e, { tipo: "jugar", uid: jab }));
  e = elegir(e, true);
  assert.equal(zonaDe(e, don), "pagado");
  assert.ok(e.jugadores[1].pagado.includes(don));
});

test("Don de Amma: con el primer Oro del oponente no se activa", () => {
  let e = mesa();
  oros(e, 0, 1);
  const jab = poner(e, 0, "mano", "Jabberwocky");
  const don = poner(e, 1, "mano", "Don de Amma");
  e = sinRespuesta(hacer(e, { tipo: "jugar", uid: jab }));
  assert.equal(e.pendiente, null);
  assert.equal(zonaDe(e, don), "mano");
});

test("Don de Amma: una vez por turno destierra un Oro con habilidad de la Reserva y busca un Oro en el Castillo para la Reserva", () => {
  let e = mesa();
  const don = poner(e, 0, "reserva", "Don de Amma");
  const hem = poner(e, 0, "reserva", "Hem Hem Real");
  const craneo = poner(e, 0, "castillo", "Cráneo de Cristal");
  e = hacer(e, habilidadDe(e, don, "Don de Amma"), hem, craneo);
  assert.equal(zonaDe(e, hem), "destierro");
  assert.equal(zonaDe(e, craneo), "reserva");
  assert.equal(accionesLegales(e).some((a) => a.tipo === "habilidad" && a.uid === don), false);
});

test("Aegishjalmur: se pone desde el Cementerio; al entrar elige subir un Aliado del Cementerio y robar una carta", () => {
  let e = mesa();
  const aegis = poner(e, 0, "cementerio", "Aegishjalmur");
  const valefor = poner(e, 0, "cementerio", "Valefor");
  e = hacer(e, { tipo: "oro", uid: aegis, desde: "cementerio" }, 0, 2);
  assert.equal(zonaDe(e, aegis), "reserva");
  assert.equal(zonaDe(e, valefor), "mano");
  assert.equal(e.jugadores[0].mano.length, 2);
});

test("Aegishjalmur: al entrar elige barajar una carta de coste 2 o menos y robar una carta", () => {
  let e = mesa();
  const aegis = poner(e, 0, "cementerio", "Aegishjalmur");
  const jab = poner(e, 1, "defensa", "Jabberwocky");
  e = hacer(e, { tipo: "oro", uid: aegis, desde: "cementerio" }, 1, 2, jab);
  assert.equal(zonaDe(e, jab), "castillo");
  assert.equal(e.jugadores[0].mano.length, 1);
});

test("Agua Sagrada: al entrar baraja hasta tres cartas de los Cementerios", () => {
  let e = mesa();
  const agua = poner(e, 0, "mano", "Agua Sagrada");
  const a = poner(e, 0, "cementerio", "Valefor");
  const b = poner(e, 0, "cementerio", "Jabberwocky");
  const c = poner(e, 1, "cementerio", "Sir Persival");
  const d = poner(e, 1, "cementerio", "Balaur");
  e = hacer(e, { tipo: "oro", uid: agua }, a, c, d);
  assert.equal(zonaDe(e, a), "castillo");
  assert.equal(zonaDe(e, c), "castillo");
  assert.equal(zonaDe(e, d), "castillo");
  assert.equal(zonaDe(e, b), "cementerio");
});

test("Agua Sagrada: pagando un Oro busca un Arma, Tótem u Oro en el Castillo y la pone en la mano", () => {
  let e = mesa();
  oros(e, 0, 1);
  const agua = poner(e, 0, "reserva", "Agua Sagrada");
  const martillo = poner(e, 0, "castillo", "Martillo Sacro");
  e = hacer(e, habilidadDe(e, agua, "Agua Sagrada"), martillo);
  assert.equal(zonaDe(e, martillo), "mano");
  assert.equal(e.jugadores[0].pagado.length, 1);
});

test("Agua Sagrada: al salir del juego baraja hasta tres cartas de los Cementerios", () => {
  let e = mesa();
  oros(e, 0, 1);
  const lucy = poner(e, 0, "mano", "Regresa Lucy");
  const agua = poner(e, 1, "reserva", "Agua Sagrada");
  const valefor = poner(e, 0, "cementerio", "Valefor");
  e = sinRespuesta(hacer(e, { tipo: "jugar", uid: lucy }, agua, valefor, null));
  assert.equal(zonaDe(e, valefor), "castillo");
});

test("Tetramorfo: al entrar roba una carta", () => {
  let e = mesa();
  const tetra = poner(e, 0, "mano", "Tetramorfo");
  e = aplicar(e, { tipo: "oro", uid: tetra });
  assert.equal(zonaDe(e, tetra), "reserva");
  assert.equal(e.jugadores[0].mano.length, 1);
});

test("Tetramorfo: destierra una carta de tu Cementerio para que una carta no Oro y sus copias pierdan su habilidad hasta la Fase Final", () => {
  let e = mesa();
  const tetra = poner(e, 0, "reserva", "Tetramorfo");
  const cem = poner(e, 0, "cementerio", "Drácula");
  const propia = poner(e, 0, "defensa", "Valefor");
  const copia = poner(e, 1, "defensa", "Valefor");
  const jab = poner(e, 1, "defensa", "Jabberwocky");
  e = hacer(e, habilidadDe(e, tetra, "Tetramorfo"), propia);
  assert.equal(zonaDe(e, cem), "destierro");
  assert.equal(N.activa(e, propia), false);
  assert.equal(N.activa(e, copia), false);
  assert.equal(N.activa(e, jab), true);
  e = aplicar(e, { tipo: "terminar" });
  assert.equal(e.turno, 2);
  assert.equal(N.activa(e, propia), true);
});

test("Tetramorfo: la habilidad requiere una carta en tu Cementerio", () => {
  const e = mesa();
  const tetra = poner(e, 0, "reserva", "Tetramorfo");
  poner(e, 1, "defensa", "Valefor");
  assert.equal(accionesLegales(e).some((a) => a.tipo === "habilidad" && a.uid === tetra), false);
});

test("Huitzilin: solo puedes controlar una copia", () => {
  const e = mesa();
  const enMano = poner(e, 0, "mano", "Huitzilin");
  assert.ok(accionesLegales(e).some((a) => a.tipo === "oro" && a.uid === enMano));
  poner(e, 0, "reserva", "Huitzilin");
  assert.equal(accionesLegales(e).some((a) => a.tipo === "oro" && a.uid === enMano), false);
});

test("Abu Simbel: tus Aliados ganan 1 de Fuerza", () => {
  const e = mesa();
  const propio = poner(e, 0, "defensa", "Valefor");
  const rival = poner(e, 1, "defensa", "Valefor");
  poner(e, 0, "reserva", "Abu Simbel");
  assert.equal(N.fuerza(e, propio), 4);
  assert.equal(N.fuerza(e, rival), 3);
});

test("Abu Simbel: al entrar, cada jugador gana el control de las cartas de las que es dueño", () => {
  let e = mesa();
  const abu = poner(e, 0, "mano", "Abu Simbel");
  const ajeno = poner(e, 1, "defensa", "Valefor");
  N.sacar(e, ajeno);
  e.jugadores[0].defensa.push(ajeno);
  assert.equal(N.controlador(e, ajeno), 0);
  e = aplicar(e, { tipo: "oro", uid: abu });
  assert.equal(zonaDe(e, ajeno), "defensa");
  assert.equal(N.controlador(e, ajeno), 1);
});

test("Abu Simbel: los jugadores no pueden ganar el control de cartas de las que no son dueños", () => {
  let e = mesa();
  oros(e, 0, 1);
  poner(e, 0, "reserva", "Abu Simbel");
  const jab = poner(e, 0, "mano", "Jabberwocky");
  const tope = e.jugadores[1].castillo[0];
  e = sinRespuesta(hacer(e, { tipo: "jugar", uid: jab }));
  assert.equal(zonaDe(e, tope), "castillo");
  assert.equal(e.jugadores[0].pagado.includes(tope), false);
});

test("Abu Simbel: tus Aliados no pueden perder su habilidad", () => {
  const e = mesa();
  const valefor = poner(e, 0, "defensa", "Valefor");
  N.agregarEfecto(e, { tipo: "pierdeHabilidad", uid: valefor }, 0);
  assert.equal(N.activa(e, valefor), false);
  poner(e, 0, "reserva", "Abu Simbel");
  assert.equal(N.activa(e, valefor), true);
});

function ataqueSimple(usarHem) {
  let e = mesa();
  const hem = poner(e, 0, "reserva", "Hem Hem Real");
  const valefor = poner(e, 0, "defensa", "Valefor");
  if (usarHem) e = hacer(e, habilidadDe(e, hem, "Hem Hem Real", 0));
  e = aplicar(e, { tipo: "batalla" });
  e = aplicar(e, { tipo: "atacar", uid: valefor });
  e = aplicar(e, { tipo: "finAtaque" });
  e = aplicar(e, { tipo: "finBloqueo" });
  e = aplicar(e, { tipo: "pasar" });
  e = aplicar(e, { tipo: "pasar" });
  return e;
}

test("Hem Hem Real: un Aliado no hace daño de combate este turno", () => {
  assert.equal(ataqueSimple(false).jugadores[1].castillo.length, 27);
  assert.equal(ataqueSimple(true).jugadores[1].castillo.length, 30);
});

test("Hem Hem Real: la primera habilidad solo se usa una vez por turno", () => {
  let e = mesa();
  const hem = poner(e, 0, "reserva", "Hem Hem Real");
  poner(e, 0, "defensa", "Valefor");
  e = hacer(e, habilidadDe(e, hem, "Hem Hem Real", 0));
  assert.equal(accionesLegales(e).some((a) => a.tipo === "habilidad" && a.uid === hem && a.h === 0), false);
});

test("Hem Hem Real: subirlo a la mano roba dos cartas y un Aliado gana 2 de Fuerza", () => {
  let e = mesa();
  const hem = poner(e, 0, "reserva", "Hem Hem Real");
  const valefor = poner(e, 0, "defensa", "Valefor");
  e = hacer(e, habilidadDe(e, hem, "Hem Hem Real", 1));
  assert.equal(zonaDe(e, hem), "mano");
  assert.equal(e.jugadores[0].mano.length, 3);
  assert.equal(N.fuerza(e, valefor), 5);
});
