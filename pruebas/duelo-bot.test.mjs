import { test } from "node:test";
import assert from "node:assert/strict";
import { mesa, poner, oros, aplicar, accionesLegales, N } from "./ayuda-duelo.mjs";
import { elegirAccion, evaluar } from "../web/duelo/bot.js";

test("bot: pone un Oro antes que cualquier otra carta", () => {
  const e = mesa();
  oros(e, 0, 2);
  poner(e, 0, "mano", "Valefor");
  poner(e, 0, "mano", "Drácula");
  assert.equal(elegirAccion(e).tipo, "oro");
});

test("bot: juega el Aliado que puede pagar", () => {
  const e = mesa();
  oros(e, 0, 3);
  const balaur = poner(e, 0, "mano", "Balaur");
  assert.deepEqual(elegirAccion(e), { tipo: "jugar", uid: balaur });
});

test("bot: ataca si ningún bloqueador rival lo iguala", () => {
  let e = mesa();
  const balaur = poner(e, 0, "defensa", "Balaur");
  poner(e, 1, "defensa", "Sir Galahad");
  assert.equal(elegirAccion(e).tipo, "batalla");
  e = aplicar(e, { tipo: "batalla" });
  assert.deepEqual(elegirAccion(e), { tipo: "atacar", uid: balaur });
});

test("bot: no ataca contra un bloqueador más fuerte", () => {
  const e = mesa();
  poner(e, 0, "defensa", "El Dracul");
  poner(e, 1, "defensa", "Jaques de Molay");
  assert.equal(elegirAccion(e).tipo, "terminar");
});

test("bot: bloquea con un Aliado que mata al atacante y sobrevive", () => {
  let e = mesa();
  const dracul = poner(e, 0, "defensa", "El Dracul");
  const jaques = poner(e, 1, "defensa", "Jaques de Molay");
  poner(e, 1, "defensa", "Sir Galahad");
  e = aplicar(e, { tipo: "batalla" });
  e = aplicar(e, { tipo: "atacar", uid: dracul });
  e = aplicar(e, { tipo: "finAtaque" });
  assert.deepEqual(elegirAccion(e), { tipo: "bloquear", uid: jaques, atacante: dracul });
});

test("bot: bloquea aunque pierda el Aliado si el daño es letal", () => {
  let e = mesa({ castillo: 4 });
  const balaur = poner(e, 0, "defensa", "Balaur");
  const galahad = poner(e, 1, "defensa", "Sir Galahad");
  e = aplicar(e, { tipo: "batalla" });
  e = aplicar(e, { tipo: "atacar", uid: balaur });
  e = aplicar(e, { tipo: "finAtaque" });
  assert.deepEqual(elegirAccion(e), { tipo: "bloquear", uid: galahad, atacante: balaur });
});

test("bot: no bloquea si solo regalaría su Aliado sin daño letal", () => {
  let e = mesa();
  const balaur = poner(e, 0, "defensa", "Balaur");
  poner(e, 1, "defensa", "Sir Galahad");
  e = aplicar(e, { tipo: "batalla" });
  e = aplicar(e, { tipo: "atacar", uid: balaur });
  e = aplicar(e, { tipo: "finAtaque" });
  assert.equal(elegirAccion(e).tipo, "finBloqueo");
});

test("bot: Anula un Aliado caro y deja pasar uno barato", () => {
  let e = mesa();
  oros(e, 0, 1);
  oros(e, 1, 1);
  const dracul = poner(e, 0, "mano", "El Dracul");
  poner(e, 1, "mano", "Ciempiés-SP");
  e = aplicar(e, { tipo: "jugar", uid: dracul });
  assert.ok(accionesLegales(e).some((a) => a.tipo === "responder"));
  assert.equal(elegirAccion(e).tipo, "noResponder");
  let f = mesa();
  oros(f, 0, 3);
  oros(f, 1, 1);
  const balaur = poner(f, 0, "mano", "Balaur");
  const ciempies = poner(f, 1, "mano", "Ciempiés-SP");
  f = aplicar(f, { tipo: "jugar", uid: balaur });
  assert.deepEqual(elegirAccion(f), { tipo: "responder", uid: ciempies });
});

test("bot: en una elección destruye el Aliado rival más valioso", () => {
  let e = mesa();
  oros(e, 0, 1);
  const lucy = poner(e, 0, "mano", "Regresa Lucy");
  poner(e, 1, "defensa", "El Dracul");
  const valefor = poner(e, 1, "defensa", "Valefor");
  e = aplicar(e, { tipo: "jugar", uid: lucy });
  while (!e.pendiente) e = aplicar(e, accionesLegales(e)[0]);
  e = aplicar(e, elegirAccion(e));
  assert.equal(N.ubicar(e, valefor).zona, "cementerio");
});

test("bot: se queda con una mano de 2 a 5 Oros y cambia una sin Oros", () => {
  const e = mesa();
  e.fase = "mulligan";
  e.turnoMulligan = 0;
  e.jugadores[0].mano = [];
  for (const n of ["Drácula", "Drácula", "Valefor", "Balaur", "Efigie", "Carcosa", "Jabberwocky", "Balaur"]) poner(e, 0, "mano", n);
  assert.equal(elegirAccion(e).tipo, "quedarse");
  e.jugadores[0].mano = [];
  for (const n of ["Valefor", "Balaur", "Efigie", "Carcosa", "Jabberwocky", "Balaur", "Valefor", "Efigie"]) poner(e, 0, "mano", n);
  assert.equal(elegirAccion(e).tipo, "mulliganGratis");
});

test("bot: la evaluación premia tener más Castillo y Aliados más fuertes", () => {
  const e = mesa();
  const base = evaluar(e, 0);
  poner(e, 0, "defensa", "Balaur");
  assert.ok(evaluar(e, 0) > base);
  assert.ok(evaluar(e, 1) < evaluar(e, 0));
  e.jugadores[1].castillo.splice(0, 5);
  assert.ok(evaluar(e, 0) > evaluar(e, 1));
});

test("bot: juega una partida entera contra sí mismo sin acciones ilegales", () => {
  let e = mesa({ castillo: 15 });
  for (const n of ["Drácula", "Drácula", "Balaur", "Valefor", "Efigie"]) poner(e, 0, "mano", n);
  for (const n of ["Drácula", "Drácula", "Patrulla Nocturna", "Sir Galahad", "Pedrenyal"]) poner(e, 1, "mano", n);
  oros(e, 0, 1);
  oros(e, 1, 1);
  for (let i = 0; i < 3000 && e.ganador === null; i++) e = aplicar(e, elegirAccion(e));
  assert.notEqual(e.ganador, null);
});

test("bot: valora guardar un Oro para Anular en su turno", () => {
  const e = mesa();
  poner(e, 0, "mano", "Ciempiés-SP");
  const sin = evaluar(e, 0);
  oros(e, 0, 1);
  const con = evaluar(e, 0);
  assert.ok(con - sin > 1);
});

test("bot: obligado a atacar por Cráneo de Cristal, ataca con el que no pierde", () => {
  let e = mesa();
  poner(e, 1, "reserva", "Cráneo de Cristal");
  poner(e, 1, "defensa", "Padre Dagón");
  poner(e, 0, "defensa", "El Dracul");
  const balaur = poner(e, 0, "defensa", "Balaur");
  assert.ok(!accionesLegales(e).some((a) => a.tipo === "terminar"));
  e = aplicar(e, elegirAccion(e));
  assert.equal(e.fase, "ataque");
  assert.deepEqual(elegirAccion(e), { tipo: "atacar", uid: balaur });
});
