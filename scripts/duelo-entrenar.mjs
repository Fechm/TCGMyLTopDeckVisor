import { Worker, isMainThread, parentPort, workerData } from "node:worker_threads";
import { writeFileSync } from "node:fs";
import { availableParallelism } from "node:os";
import { fileURLToPath } from "node:url";

const RAIZ = new URL("../web/duelo/", import.meta.url);
const TOPE_MS = 90000;

async function trabajador() {
  const { crearPartida, accionesLegales, aplicar, jugadorQueDecide } = await import(new URL("motor.js", RAIZ));
  const { MAZOS } = await import(new URL("cartas-base.js", RAIZ));
  const { elegirAccion, configurar } = await import(new URL("bot.js", RAIZ));
  const { foto } = await import(new URL("aprendizaje.js", RAIZ));
  parentPort.on("message", ({ semilla, modelos, epsilon, registrar }) => {
    let azar = semilla >>> 0;
    const tirar = () => ((azar = (Math.imul(azar, 1664525) + 1013904223) >>> 0) / 4294967296);
    let e = crearPartida({ semilla, mazos: [MAZOS.dragon, MAZOS.caballero] });
    const estados = [];
    let ultimoTurno = -1;
    const t0 = Date.now();
    let n = 0;
    try {
      for (; n < 4000 && e.ganador === null; n++) {
        if (Date.now() - t0 > TOPE_MS) throw new Error(`partida ${semilla} pasó ${TOPE_MS / 1000} s en la fase ${e.fase}, turno ${e.turno + 1}`);
        if (registrar && e.fase === "vigilia" && !e.pendiente && e.turno !== ultimoTurno) {
          ultimoTurno = e.turno;
          estados.push(foto(e));
        }
        const quien = e.pendiente ? e.pendiente.jugador : jugadorQueDecide(e);
        configurar({ modelo: modelos[quien] });
        const legales = accionesLegales(e);
        const accion = tirar() < epsilon ? legales[Math.floor(tirar() * legales.length)] : elegirAccion(e);
        e = aplicar(e, accion);
      }
      parentPort.postMessage({ ganador: e.ganador, estados, turnos: e.turno + 1, ms: Date.now() - t0, acciones: n });
    } catch (x) {
      parentPort.postMessage({ ganador: null, estados: [], error: x.message, ms: Date.now() - t0, acciones: n });
    }
  });
}

function crearPiscina(n) {
  const archivo = fileURLToPath(import.meta.url);
  const hilos = Array.from({ length: n }, () => new Worker(archivo, { workerData: { hilo: true } }));
  const libres = [...hilos];
  const cola = [];
  const despachar = () => {
    while (libres.length && cola.length) {
      const w = libres.pop();
      const { tarea, ok } = cola.shift();
      w.once("message", (r) => {
        libres.push(w);
        ok(r);
        despachar();
      });
      w.postMessage(tarea);
    }
  };
  return {
    pedir: (tarea) => new Promise((ok) => { cola.push({ tarea, ok }); despachar(); }),
    cerrar: () => hilos.forEach((h) => h.terminate()),
  };
}

async function comparar(archivoA, archivoB, n) {
  const { pathToFileURL } = await import("node:url");
  const { resolve } = await import("node:path");
  const A = (await import(pathToFileURL(resolve(archivoA)))).MODELO;
  const B = (await import(pathToFileURL(resolve(archivoB)))).MODELO;
  const piscina = crearPiscina(Math.max(1, availableParallelism() - 1));
  const inicio = Date.now();
  const r = await Promise.all(
    Array.from({ length: n }, (_, i) => {
      const lado = i % 2;
      const modelos = lado === 0 ? [A, B] : [B, A];
      return piscina.pedir({ semilla: 5000000 + Math.floor(i / 2), modelos, epsilon: 0, registrar: false }).then((x) => ({ gana: x.ganador === lado ? 1 : 0, lado, error: x.error }));
    }),
  );
  piscina.cerrar();
  const total = r.reduce((s, x) => s + x.gana, 0);
  const porLado = [0, 1].map((l) => r.filter((x) => x.lado === l));
  const tasa = total / n;
  const error = Math.sqrt((tasa * (1 - tasa)) / n);
  console.log(`A gana ${total}/${n} = ${(tasa * 100).toFixed(1)}% ± ${(196 * error).toFixed(1)} (95%)`);
  console.log(`A con Dragón ${porLado[0].reduce((s, x) => s + x.gana, 0)}/${porLado[0].length}, A con Caballero ${porLado[1].reduce((s, x) => s + x.gana, 0)}/${porLado[1].length}; errores ${r.filter((x) => x.error).length}; ${((Date.now() - inicio) / 1000).toFixed(0)} s`);
}

async function principal() {
  if (process.argv[2] === "comparar") return comparar(process.argv[3], process.argv[4], Number(process.argv[5] ?? 400));
  const { MODELO } = await import(new URL("modelo.js", RAIZ));
  const { ajustar, perdida, muestrasDePartida } = await import(new URL("aprendizaje.js", RAIZ));
  const GENERACIONES = Number(process.argv[2] ?? 6);
  const PARTIDAS = Number(process.argv[3] ?? 280);
  const EVALUACION = Number(process.argv[4] ?? 140);
  const UMBRAL = 0.53;
  const piscina = crearPiscina(Math.max(1, availableParallelism() - 1));
  let modelo = MODELO;
  const memoria = [];
  let semilla = 100000 + (MODELO.version ?? 0) * 10007;
  const inicio = Date.now();
  for (let g = 1; g <= GENERACIONES; g++) {
    const partidas = await Promise.all(
      Array.from({ length: PARTIDAS }, () => piscina.pedir({ semilla: semilla++, modelos: [modelo, modelo], epsilon: 0.08, registrar: true })),
    );
    const errores = partidas.filter((p) => p.error).length;
    partidas.filter((p) => p.error).slice(0, 3).forEach((p) => console.log("  error:", p.error));
    const lenta = partidas.reduce((m, p) => (p.ms > m.ms ? p : m), { ms: 0 });
    console.log(`  partidas: más lenta ${(lenta.ms / 1000).toFixed(1)} s con ${lenta.acciones} acciones`);
    const nuevas = partidas.filter((p) => p.ganador !== null).flatMap((p) => muestrasDePartida(p.estados, p.ganador));
    memoria.push(nuevas);
    if (memoria.length > 3) memoria.shift();
    const datos = memoria.flat();
    const candidato = ajustar(modelo, datos);
    const evals = await Promise.all(
      Array.from({ length: EVALUACION }, (_, i) => {
        const lado = i % 2;
        const modelos = lado === 0 ? [candidato, modelo] : [modelo, candidato];
        return piscina.pedir({ semilla: 900000 + g * 1000 + Math.floor(i / 2), modelos, epsilon: 0, registrar: false }).then((r) => (r.ganador === lado ? 1 : 0));
      }),
    );
    const tasa = evals.reduce((a, b) => a + b, 0) / evals.length;
    const acepta = tasa >= UMBRAL;
    console.log(
      `gen ${g}: ${nuevas.length} muestras, pérdida ${perdida(modelo, datos).toFixed(4)} -> ${perdida(candidato, datos).toFixed(4)}, ` +
        `candidato gana ${(tasa * 100).toFixed(1)}% ${acepta ? "ACEPTADO" : "rechazado"}, errores ${errores}, ${((Date.now() - inicio) / 1000).toFixed(0)} s`,
    );
    if (acepta) {
      modelo = { ...candidato, version: (modelo.version ?? 0) + 1, partidas: (modelo.partidas ?? 0) + PARTIDAS * memoria.length };
      writeFileSync(new URL("modelo.js", RAIZ), `export const MODELO = ${JSON.stringify(modelo)};\n`);
    }
  }
  console.log("pesos finales", JSON.stringify(modelo.w.map((x) => +x.toFixed(4))), "versión", modelo.version);
  piscina.cerrar();
}

if (isMainThread) principal();
else if (workerData?.hilo) trabajador();
