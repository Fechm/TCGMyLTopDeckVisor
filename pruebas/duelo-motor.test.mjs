import { test } from "node:test";
import assert from "node:assert/strict";
import { crearPartida, accionesLegales, aplicar, fuerza, jugadorQueDecide } from "../web/duelo/motor.js";
import { CARTAS, MAZOS } from "../web/duelo/cartas-base.js";

const cat = {
  ini: { id: "ini", tipo: "Oro", coste: 0, fuerza: 0, oroInicial: true, sinHabilidad: false },
  oro: { id: "oro", tipo: "Oro", coste: 0, fuerza: 0, oroInicial: false, sinHabilidad: true },
  a3: { id: "a3", tipo: "Aliado", coste: 2, fuerza: 3 },
  a5: { id: "a5", tipo: "Aliado", coste: 3, fuerza: 5 },
  arma: { id: "arma", tipo: "Arma", coste: 1, fuerza: 2 },
  tot: { id: "tot", tipo: "Tótem", coste: 1, fuerza: 0 },
  tal: { id: "tal", tipo: "Talismán", coste: 1, fuerza: 0 },
};

const mazo = () => ["ini", ...Array(19).fill("oro"), ...Array(15).fill("a3"), ...Array(10).fill("a5"), "arma", "arma", "tot", "tal", "tal"];

function nueva(semilla = 7) {
  let e = crearPartida({ semilla, mazos: [mazo(), mazo()], catalogo: cat, inicial: 0 });
  e = aplicar(e, { tipo: "quedarse" });
  return aplicar(e, { tipo: "quedarse" });
}

function poner(e, j, zona, id) {
  const uid = `${j}-t${Object.keys(e.instancias).length}`;
  e.instancias[uid] = id;
  e.jugadores[j][zona].push(uid);
  return uid;
}

function pasarTurno(e) {
  e = aplicar(e, { tipo: "terminar" });
  while (e.fase === "final") e = aplicar(e, accionesLegales(e)[0]);
  return e;
}

function conUids(e, j, zona, ids) {
  return ids.map((id) => poner(e, j, zona, id));
}

test("inicio: oro inicial en reserva, 8 en mano, 41 en castillo", () => {
  const e = crearPartida({ semilla: 3, mazos: [mazo(), mazo()], catalogo: cat, inicial: 1 });
  for (const p of e.jugadores) {
    assert.equal(p.reserva.length, 1);
    assert.equal(e.catalogo[e.instancias[p.reserva[0]]].id, "ini");
    assert.equal(p.mano.length, 8);
    assert.equal(p.castillo.length, 41);
  }
  assert.equal(e.fase, "mulligan");
  assert.equal(jugadorQueDecide(e), 1);
});

test("misma semilla da la misma partida", () => {
  const a = crearPartida({ semilla: 99, mazos: [mazo(), mazo()], catalogo: cat });
  const b = crearPartida({ semilla: 99, mazos: [mazo(), mazo()], catalogo: cat });
  assert.deepEqual(a.jugadores, b.jugadores);
  assert.equal(a.inicial, b.inicial);
});

test("mulligan roba una menos; el gratis exige 0 o 1 oro y se usa una vez", () => {
  let e = crearPartida({ semilla: 5, mazos: [mazo(), mazo()], catalogo: cat, inicial: 0 });
  e = aplicar(e, { tipo: "mulligan" });
  assert.equal(e.jugadores[0].mano.length, 7);
  assert.equal(e.jugadores[0].castillo.length + 7, 49);
  const p = e.jugadores[0];
  const sinOro = p.castillo.filter((u) => e.instancias[u] !== "oro").slice(0, 7);
  p.castillo = [...p.castillo.filter((u) => !sinOro.includes(u)), ...p.mano];
  p.mano = sinOro;
  assert.ok(accionesLegales(e).some((a) => a.tipo === "mulliganGratis"));
  e = aplicar(e, { tipo: "mulliganGratis" });
  assert.equal(e.jugadores[0].mano.length, 7);
  assert.ok(!accionesLegales(e).some((a) => a.tipo === "mulliganGratis"));
  e = aplicar(e, { tipo: "quedarse" });
  assert.equal(jugadorQueDecide(e), 1);
  e = aplicar(e, { tipo: "quedarse" });
  assert.equal(e.fase, "vigilia");
  assert.equal(e.activo, 0);
});

test("aplicar no muta el estado de entrada y rechaza acciones ilegales", () => {
  const e = nueva();
  const copia = JSON.stringify({ ...e, catalogo: null });
  aplicar(e, { tipo: "terminar" });
  assert.equal(JSON.stringify({ ...e, catalogo: null }), copia);
  assert.throws(() => aplicar(e, { tipo: "finBloqueo" }), /ilegal/);
});

test("oro solo como primera carta y una vez por turno", () => {
  const e0 = nueva();
  e0.jugadores[0].mano = conUids(e0, 0, "mano", ["oro", "oro", "tal"]);
  const [o1, , tal] = e0.jugadores[0].mano;
  conUids(e0, 0, "reserva", ["oro"]);
  const e = aplicar(e0, { tipo: "oro", uid: o1 });
  assert.equal(e.jugadores[0].reserva.length, 3);
  assert.ok(!accionesLegales(e).some((a) => a.tipo === "oro"));
  const f = aplicar(e0, { tipo: "jugar", uid: tal });
  assert.ok(!accionesLegales(f).some((a) => a.tipo === "oro"));
});

test("pagar mueve oros de la reserva al oro pagado y la agrupación los devuelve", () => {
  const e0 = nueva();
  e0.jugadores[0].mano = conUids(e0, 0, "mano", ["a3"]);
  conUids(e0, 0, "reserva", ["oro", "oro"]);
  const a3 = e0.jugadores[0].mano[0];
  let e = aplicar(e0, { tipo: "jugar", uid: a3 });
  assert.equal(e.jugadores[0].reserva.length, 1);
  assert.equal(e.jugadores[0].pagado.length, 2);
  assert.deepEqual(e.jugadores[0].defensa, [a3]);
  e = pasarTurno(pasarTurno(e));
  assert.equal(e.activo, 0);
  assert.equal(e.jugadores[0].reserva.length, 3);
  assert.equal(e.jugadores[0].pagado.length, 0);
});

test("no se puede jugar lo que no se puede pagar", () => {
  const e = nueva();
  e.jugadores[0].mano = conUids(e, 0, "mano", ["a5"]);
  assert.ok(!accionesLegales(e).some((a) => a.tipo === "jugar"));
});

test("un arma por aliado y suma su fuerza", () => {
  const e0 = nueva();
  const [al] = conUids(e0, 0, "defensa", ["a3"]);
  e0.jugadores[0].mano = conUids(e0, 0, "mano", ["arma", "arma"]);
  conUids(e0, 0, "reserva", ["oro"]);
  const [w1] = e0.jugadores[0].mano;
  let e = aplicar(e0, { tipo: "jugar", uid: w1, portador: al });
  assert.equal(fuerza(e, al), 5);
  assert.ok(!accionesLegales(e).some((a) => a.tipo === "jugar"));
});

test("aliado recién jugado no ataca; el del turno anterior sí", () => {
  const e0 = nueva();
  conUids(e0, 0, "reserva", ["oro"]);
  e0.jugadores[0].mano = conUids(e0, 0, "mano", ["a3"]);
  let e = aplicar(e0, { tipo: "jugar", uid: e0.jugadores[0].mano[0] });
  assert.ok(!accionesLegales(e).some((a) => a.tipo === "batalla"));
  e = pasarTurno(pasarTurno(e));
  assert.ok(accionesLegales(e).some((a) => a.tipo === "batalla"));
});

function hastaCombate(e, atacantes, bloqueos = []) {
  e = aplicar(e, { tipo: "batalla" });
  for (const u of atacantes) e = aplicar(e, { tipo: "atacar", uid: u });
  e = aplicar(e, { tipo: "finAtaque" });
  for (const [b, a] of bloqueos) e = aplicar(e, { tipo: "bloquear", uid: b, atacante: a });
  e = aplicar(e, { tipo: "finBloqueo" });
  e = aplicar(e, { tipo: "pasar" });
  return aplicar(e, { tipo: "pasar" });
}

test("ataque sin bloqueo bota la fuerza completa del castillo", () => {
  const e0 = nueva();
  const [a5] = conUids(e0, 0, "defensa", ["a5"]);
  const antes = e0.jugadores[1].castillo.length;
  const e = hastaCombate(e0, [a5]);
  assert.equal(e.jugadores[1].castillo.length, antes - 5);
  assert.equal(e.jugadores[1].cementerio.length, 5);
  assert.equal(e.activo, 1);
  assert.deepEqual(e.jugadores[0].ataque, [a5]);
});

test("bloqueo: mayor fuerza destruye y pasa la diferencia; empate destruye a ambos", () => {
  const e0 = nueva();
  const [a5, a3] = conUids(e0, 0, "defensa", ["a5", "a3"]);
  const [b3, c3] = conUids(e0, 1, "defensa", ["a3", "a3"]);
  const antes = e0.jugadores[1].castillo.length;
  const e = hastaCombate(e0, [a5, a3], [[b3, a5], [c3, a3]]);
  assert.equal(e.jugadores[1].castillo.length, antes - 2);
  assert.ok(e.jugadores[1].cementerio.includes(b3));
  assert.ok(e.jugadores[1].cementerio.includes(c3));
  assert.ok(e.jugadores[0].cementerio.includes(a3));
  assert.deepEqual(e.jugadores[0].ataque, [a5]);
});

test("bloqueador más fuerte destruye al atacante sin daño; el arma va al cementerio", () => {
  const e0 = nueva();
  const [a3] = conUids(e0, 0, "defensa", ["a3"]);
  const [w] = conUids(e0, 0, "apoyo", ["arma"]);
  e0.jugadores[0].apoyo = [];
  e0.armas[a3] = w;
  const [b5] = conUids(e0, 1, "defensa", ["a5"]);
  const antes = e0.jugadores[1].castillo.length;
  const e = hastaCombate(e0, [a3], [[b5, a3]]);
  assert.equal(e.jugadores[1].castillo.length, antes);
  assert.ok(e.jugadores[0].cementerio.includes(a3));
  assert.ok(e.jugadores[0].cementerio.includes(w));
  assert.equal(e.armas[a3], undefined);
});

test("guerra de talismanes: empieza el defensor y jugar reinicia los pases", () => {
  let e = nueva();
  const [a5] = conUids(e, 0, "defensa", ["a5"]);
  e.jugadores[1].mano = conUids(e, 1, "mano", ["tal"]);
  conUids(e, 1, "reserva", ["oro"]);
  e = aplicar(e, { tipo: "batalla" });
  e = aplicar(e, { tipo: "atacar", uid: a5 });
  e = aplicar(e, { tipo: "finAtaque" });
  e = aplicar(e, { tipo: "finBloqueo" });
  assert.equal(jugadorQueDecide(e), 1);
  e = aplicar(e, { tipo: "pasar" });
  assert.equal(jugadorQueDecide(e), 0);
  e = aplicar(e, { tipo: "pasar" });
  assert.equal(e.fase, "vigilia");
});

test("primer turno no roba; el siguiente sí roba en la fase final", () => {
  let e = nueva();
  const mano0 = e.jugadores[0].mano.length;
  e = aplicar(e, { tipo: "terminar" });
  assert.equal(e.jugadores[0].mano.length, mano0);
  const mano1 = e.jugadores[1].mano.length;
  e = aplicar(e, { tipo: "terminar" });
  assert.equal(e.jugadores[1].mano.length, mano1 + 1);
});

test("límite de mano: descarta hasta 8 antes de pasar el turno", () => {
  let e = nueva();
  e = aplicar(e, { tipo: "terminar" });
  conUids(e, 1, "mano", ["tal", "tal"]);
  e = aplicar(e, { tipo: "terminar" });
  assert.equal(e.fase, "final");
  assert.equal(e.jugadores[1].mano.length, 11);
  while (e.fase === "final") e = aplicar(e, accionesLegales(e)[0]);
  assert.equal(e.jugadores[1].mano.length, 8);
  assert.equal(e.activo, 0);
});

test("pierde quien se queda sin castillo por daño", () => {
  const e0 = nueva();
  const [a5] = conUids(e0, 0, "defensa", ["a5"]);
  e0.jugadores[1].castillo = e0.jugadores[1].castillo.slice(0, 4);
  const e = hastaCombate(e0, [a5]);
  assert.equal(e.ganador, 0);
  assert.deepEqual(accionesLegales(e), []);
});

test("pierde quien roba su última carta", () => {
  let e = nueva();
  e = aplicar(e, { tipo: "terminar" });
  e.jugadores[1].castillo = e.jugadores[1].castillo.slice(0, 1);
  e = aplicar(e, { tipo: "terminar" });
  assert.equal(e.ganador, 0);
});

test("los mazos reales tienen 50 cartas y un oro inicial", () => {
  for (const ids of Object.values(MAZOS)) {
    assert.equal(ids.length, 50);
    assert.ok(ids.some((id) => CARTAS[id].oroInicial));
  }
  const e = crearPartida({ semilla: 1, mazos: [MAZOS.dragon, MAZOS.caballero] });
  assert.ok(e.jugadores.every((p) => p.reserva.length === 1 && p.castillo.length === 41));
});
