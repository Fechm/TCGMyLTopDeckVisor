import { crearPartida, accionesLegales, aplicar, jugadorQueDecide } from "../web/duelo/motor.js";
import { CATALOGO, TRANSCRITAS } from "../web/duelo/cartas.js";
import { elegirAccion } from "../web/duelo/bot.js";

const PARTIDAS = Number(process.argv[2] ?? 300);
const TIPO = process.argv[3] ?? "azar";
const SOLO = process.argv[4] ? new Set(process.argv[4].split(",")) : null;
const TOPE_ACCIONES = 20000;

const usables = Object.values(CATALOGO).filter((c) => c.id !== "azi" && (c.sinHabilidad || TRANSCRITAS.has(c.nombre)));
const nuevas = SOLO ? usables.filter((c) => SOLO.has(c.nombre)) : usables;

function generador(semilla) {
  let s = semilla >>> 0;
  return () => ((s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 4294967296);
}

function mazoAzar(azar) {
  const copias = {};
  const mazo = [];
  const tomar = (lista, n) => {
    for (let k = 0; k < n * 20 && n > 0; k++) {
      const c = lista[Math.floor(azar() * lista.length)];
      if ((copias[c.id] ?? 0) >= 3) continue;
      copias[c.id] = (copias[c.id] ?? 0) + 1;
      mazo.push(c.id);
      n--;
    }
  };
  tomar(usables.filter((c) => c.tipo === "Oro"), 16);
  tomar(nuevas, 20);
  tomar(usables.filter((c) => c.tipo !== "Oro"), 50 - mazo.length);
  return mazo;
}

const resumen = { ganador: 0, errores: [], bucles: 0, usadas: new Set() };
const inicio = Date.now();
for (let i = 0; i < PARTIDAS; i++) {
  const azar = generador(i * 7919 + 17);
  const mazos = [mazoAzar(azar), mazoAzar(azar)];
  let e = crearPartida({ semilla: i + 1, mazos });
  let n = 0;
  try {
    while (e.ganador === null && n < TOPE_ACCIONES) {
      const legales = accionesLegales(e);
      if (!legales.length) throw new Error(`sin acciones en fase ${e.fase}`);
      const a = TIPO === "azar" ? legales[Math.floor(azar() * legales.length)] : elegirAccion(e);
      if (a.tipo === "jugar" || a.tipo === "habilidad") resumen.usadas.add(CATALOGO[e.instancias[a.uid]]?.nombre);
      e = aplicar(e, a);
      n++;
    }
  } catch (err) {
    resumen.errores.push(`partida ${i + 1}: ${err.message} ${err.stack?.split("\n")[1]?.trim() ?? ""}`);
    continue;
  }
  if (e.ganador === null) resumen.bucles++;
  else resumen.ganador++;
}
const sinUsar = nuevas.filter((c) => !resumen.usadas.has(c.nombre)).length;
console.log(`Estrés (${TIPO}): ${PARTIDAS} partidas, con ganador ${resumen.ganador}, errores ${resumen.errores.length}, bucles ${resumen.bucles}`);
console.log(`Cartas del grupo usadas: ${nuevas.length - sinUsar}/${nuevas.length}; ${((Date.now() - inicio) / 1000).toFixed(0)} s`);
const vistos = new Map();
for (const x of resumen.errores) {
  const k = x.replace(/^partida \d+: /, "");
  vistos.set(k, [...(vistos.get(k) ?? []), x.match(/^partida (\d+)/)[1]]);
}
for (const [k, ps] of vistos) console.log(`  ${ps.length}× ${k} (partidas ${ps.slice(0, 5).join(",")})`);
