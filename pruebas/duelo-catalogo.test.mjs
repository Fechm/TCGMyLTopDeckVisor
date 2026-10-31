import { test } from "node:test";
import assert from "node:assert/strict";
import { CATALOGO } from "../web/duelo/cartas.js";

function funcionesSueltas(valor, ruta, salida) {
  if (typeof valor === "function") salida.push(ruta);
  else if (Array.isArray(valor)) valor.forEach((v, i) => funcionesSueltas(v, `${ruta}[${i}]`, salida));
  else if (valor && typeof valor === "object") {
    for (const [k, v] of Object.entries(valor)) if (k !== "fns") funcionesSueltas(v, `${ruta}.${k}`, salida);
  }
  return salida;
}

test("catálogo: las funciones de las cartas solo viven en fns y se referencian por nombre", () => {
  const sueltas = Object.values(CATALOGO).flatMap((c) => funcionesSueltas(c, c.nombre ?? c.id, []));
  assert.deepEqual(sueltas, []);
});
