import { test } from "node:test";
import assert from "node:assert/strict";
import { mesa, poner, oros } from "./ayuda-duelo.mjs";
import { rasgos, RASGOS, ajustar, perdida, logit, muestrasDePartida, foto } from "../web/duelo/aprendizaje.js";
import { MODELO } from "../web/duelo/modelo.js";
import { evaluar, configurar } from "../web/duelo/bot.js";

test("aprendizaje: los rasgos de un jugador son el espejo de los del otro", () => {
  const e = mesa();
  poner(e, 0, "defensa", "Balaur");
  oros(e, 0, 2);
  poner(e, 1, "mano", "Sir Galahad");
  const a = rasgos(e, 0);
  const b = rasgos(e, 1);
  assert.equal(a.length, RASGOS.length);
  RASGOS.forEach((nombre, i) => {
    if (nombre !== "guardia") assert.equal(a[i] + b[i], 0, nombre);
  });
});

test("aprendizaje: ajustar baja la pérdida sobre partidas registradas", () => {
  const muestras = [];
  for (let k = 0; k < 40; k++) {
    const gana = k % 2;
    const phi = RASGOS.map((_, i) => (i === 0 ? (gana ? 6 : -6) : 0));
    muestras.push(...muestrasDePartida([{ phi0: phi, phi1: phi.map((x) => -x) }], gana ? 0 : 1));
  }
  const antes = perdida(MODELO, muestras);
  const despues = perdida(ajustar(MODELO, muestras), muestras);
  assert.ok(despues < antes, `${despues} < ${antes}`);
});

test("aprendizaje: con ancla los pesos no se alejan mucho del modelo base", () => {
  const ruido = Array.from({ length: 30 }, (_, k) => ({ phi: RASGOS.map((_, i) => ((k * 7 + i * 3) % 11) - 5), j: k % 2, z: (k * 5) % 3 === 0 ? 1 : 0 }));
  const libre = ajustar(MODELO, ruido, { pasos: 200, tasa: 0.3, l2: 0 });
  const anclado = ajustar(MODELO, ruido, { pasos: 200, tasa: 0.3, l2: 0.5, ancla: MODELO });
  const distancia = (m) => m.w.reduce((s, w, i) => s + Math.abs((w - MODELO.w[i]) * MODELO.escala[i]), 0);
  assert.ok(distancia(anclado) < distancia(libre));
});

test("aprendizaje: la evaluación del bot usa el modelo configurado", () => {
  const e = mesa();
  poner(e, 0, "defensa", "Balaur");
  const base = evaluar(e, 0);
  const otro = { ...MODELO, w: MODELO.w.map((w, i) => (RASGOS[i] === "fuerza" ? w * 3 : w)) };
  configurar({ modelo: otro });
  const cambiado = evaluar(e, 0);
  configurar({ modelo: MODELO });
  assert.ok(cambiado > base);
  assert.equal(evaluar(e, 0), base);
  assert.ok(Math.abs(base - 10 * logit(MODELO, foto(e).phi0, 0)) < 1e-9);
});
