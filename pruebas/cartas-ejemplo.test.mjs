import { test } from "node:test";
import assert from "node:assert/strict";
import { mesa, poner, oros, hacer, sinRespuesta, accionesLegales, aplicar, zonaDe, N } from "./ayuda-duelo.mjs";

test("Jabberwocky: al entrar convierte el tope del Castillo oponente en Oro en tu Oro Pagado", () => {
  let e = mesa();
  oros(e, 0, 1);
  const jab = poner(e, 0, "mano", "Jabberwocky");
  const tope = e.jugadores[1].castillo[0];
  e = sinRespuesta(hacer(e, { tipo: "jugar", uid: jab }));
  assert.equal(zonaDe(e, jab), "defensa");
  assert.ok(e.jugadores[0].pagado.includes(tope));
  assert.equal(N.carta(e, tope).tipo, "Oro");
});

test("Espada Vikinga: desde la mano, paga un Oro y se destierra para Anular una carta de coste 1", () => {
  let e = mesa();
  oros(e, 0, 1);
  oros(e, 1, 1);
  const valefor = poner(e, 0, "mano", "Valefor");
  const espada = poner(e, 1, "mano", "Espada Vikinga");
  e = aplicar(e, { tipo: "jugar", uid: valefor });
  assert.ok(accionesLegales(e).some((a) => a.tipo === "responder" && a.uid === espada));
  e = aplicar(e, { tipo: "responder", uid: espada });
  assert.equal(zonaDe(e, valefor), "cementerio");
  assert.equal(zonaDe(e, espada), "destierro");
  assert.equal(e.jugadores[1].pagado.length, 1);
});
