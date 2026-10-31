import { Worker, isMainThread, parentPort, workerData } from "node:worker_threads";
import { writeFileSync } from "node:fs";
import { availableParallelism } from "node:os";
import { fileURLToPath } from "node:url";

const RAIZ = new URL("../web/duelo/", import.meta.url);
const TOPE_MS = Number(process.env.TOPE_MS ?? 90000);

async function trabajador() {
  const { crearPartida, accionesLegales, aplicar, jugadorQueDecide } = await import(new URL("motor.js", RAIZ));
  const { MAZOS } = await import(new URL("cartas-base.js", RAIZ));
  const { elegirAccion, configurar } = await import(new URL("bot.js", RAIZ));
  const { foto } = await import(new URL("aprendizaje.js", RAIZ));
  parentPort.on("message", ({ semilla, modelos, epsilon, registrar, mcs = [null, null] }) => {
    let azar = semilla >>> 0;
    const tirar = () => ((azar = (Math.imul(azar, 1664525) + 1013904223) >>> 0) / 4294967296);
    let e = crearPartida({ semilla, mazos: [MAZOS.dragon, MAZOS.caballero] });
    const estados = [];
    let ultimoTurno = -1;
    const t0 = Date.now();
    const pensar = [0, 0];
    let n = 0;
    try {
      for (; n < 4000 && e.ganador === null; n++) {
        if (Date.now() - t0 > TOPE_MS) throw new Error(`partida ${semilla} pasó ${TOPE_MS / 1000} s en la fase ${e.fase}, turno ${e.turno + 1}`);
        if (registrar && e.fase === "vigilia" && !e.pendiente && e.turno !== ultimoTurno) {
          ultimoTurno = e.turno;
          estados.push(foto(e));
        }
        const quien = e.pendiente ? e.pendiente.jugador : jugadorQueDecide(e);
        configurar({ modelo: modelos[quien], mc: mcs[quien] });
        const legales = accionesLegales(e);
        const tp = Date.now();
        const accion = tirar() < epsilon ? legales[Math.floor(tirar() * legales.length)] : elegirAccion(e);
        pensar[quien] = Math.max(pensar[quien], Date.now() - tp);
        e = aplicar(e, accion);
      }
      parentPort.postMessage({ ganador: e.ganador, estados, turnos: e.turno + 1, ms: Date.now() - t0, acciones: n, pensar });
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

async function compararMc(simulaciones, n) {
  const { MODELO } = await import(new URL("modelo.js", RAIZ));
  const mc = { simulaciones, candidatos: 3 };
  const piscina = crearPiscina(Math.max(1, availableParallelism() - 1));
  const inicio = Date.now();
  const r = await Promise.all(
    Array.from({ length: n }, (_, i) => {
      const lado = i % 2;
      const mcs = lado === 0 ? [mc, null] : [null, mc];
      return piscina.pedir({ semilla: 6000000 + Math.floor(i / 2), modelos: [MODELO, MODELO], mcs, epsilon: 0, registrar: false }).then((x) => ({ gana: x.ganador === lado ? 1 : 0, lado, error: x.error, pensar: x.pensar?.[lado] ?? 0, ms: x.ms }));
    }),
  );
  piscina.cerrar();
  const total = r.reduce((s, x) => s + x.gana, 0);
  const porLado = [0, 1].map((l) => r.filter((x) => x.lado === l));
  const tasa = total / n;
  const error = Math.sqrt((tasa * (1 - tasa)) / n);
  const pensar = r.map((x) => x.pensar).sort((a, b) => a - b);
  console.log(`MC(${simulaciones}) gana ${total}/${n} = ${(tasa * 100).toFixed(1)}% ± ${(196 * error).toFixed(1)} (95%)`);
  console.log(`MC con Dragón ${porLado[0].reduce((s, x) => s + x.gana, 0)}/${porLado[0].length}, MC con Caballero ${porLado[1].reduce((s, x) => s + x.gana, 0)}/${porLado[1].length}; errores ${r.filter((x) => x.error).length}`);
  console.log(`decisión más lenta por partida: mediana ${pensar[pensar.length >> 1]} ms, p90 ${pensar[Math.floor(pensar.length * 0.9)]} ms; total ${((Date.now() - inicio) / 1000).toFixed(0)} s`);
  r.filter((x) => x.error).slice(0, 3).forEach((x) => console.log("  error:", x.error));
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

function normal(semilla) {
  let s = semilla >>> 0;
  const u = () => ((s = (Math.imul(s, 1664525) + 1013904223) >>> 0) + 1) / 4294967297;
  return () => Math.sqrt(-2 * Math.log(u())) * Math.cos(2 * Math.PI * u());
}

async function enfrentar(piscina, A, B, n, semillaBase) {
  const r = await Promise.all(
    Array.from({ length: n }, (_, i) => {
      const lado = i % 2;
      const modelos = lado === 0 ? [A, B] : [B, A];
      return piscina.pedir({ semilla: semillaBase + Math.floor(i / 2), modelos, epsilon: 0, registrar: false }).then((x) => (x.ganador === lado ? 1 : x.ganador === null ? 0.5 : 0));
    }),
  );
  return r.reduce((a, b) => a + b, 0) / n;
}

async function evolucionar() {
  const { MODELO } = await import(new URL("modelo.js", RAIZ));
  const GENERACIONES = Number(process.argv[3] ?? 12);
  const LAMBDA = Number(process.argv[4] ?? 8);
  const POR_CANDIDATO = Number(process.argv[5] ?? 64);
  const SIGMA = 0.2;
  const ALFA = 0.6;
  const VALIDACION = 420;
  const UMBRAL = 0.53;
  const piscina = crearPiscina(Math.max(1, availableParallelism() - 1));
  const esc = MODELO.escala;
  const aModelo = (ws, base) => ({ ...base, w: ws.map((w, i) => w / esc[i]) });
  let aceptado = MODELO;
  let theta = MODELO.w.map((w, i) => w * esc[i]);
  const azar = normal(20261030 + (MODELO.version ?? 0));
  const inicio = Date.now();
  for (let g = 1; g <= GENERACIONES; g++) {
    const actual = aModelo(theta, aceptado);
    const ruidos = [];
    for (let k = 0; k < LAMBDA / 2; k++) {
      const eps = theta.map(() => azar());
      ruidos.push(eps, eps.map((x) => -x));
    }
    const semillas = 7000000 + g * 10000;
    const puntajes = [];
    for (const eps of ruidos) {
      const cand = aModelo(theta.map((t, i) => t + SIGMA * eps[i] * Math.max(0.05, Math.abs(t))), aceptado);
      puntajes.push(await enfrentar(piscina, cand, actual, POR_CANDIDATO, semillas));
    }
    const grad = theta.map((_, i) => ruidos.reduce((s, eps, k) => s + (puntajes[k] - 0.5) * eps[i], 0) / (LAMBDA * SIGMA));
    theta = theta.map((t, i) => t + ALFA * grad[i] * Math.max(0.05, Math.abs(t)));
    console.log(`gen ${g}: candidatos ${puntajes.map((x) => (x * 100).toFixed(0)).join(" ")} · ${((Date.now() - inicio) / 1000).toFixed(0)} s`);
    if (g % 3 === 0 || g === GENERACIONES) {
      const nuevo = aModelo(theta, aceptado);
      const tasa = await enfrentar(piscina, nuevo, aceptado, VALIDACION, 8000000 + g * 10000);
      const acepta = tasa >= UMBRAL;
      console.log(`  validación contra el aceptado: ${(tasa * 100).toFixed(1)}% ${acepta ? "ACEPTADO" : "rechazado, vuelvo al aceptado"}`);
      if (acepta) {
        aceptado = { ...nuevo, version: (aceptado.version ?? 0) + 1 };
        writeFileSync(new URL("modelo.js", RAIZ), `export const MODELO = ${JSON.stringify(aceptado)};\n`);
      } else {
        theta = aceptado.w.map((w, i) => w * esc[i]);
      }
    }
  }
  console.log("pesos aceptados", JSON.stringify(aceptado.w.map((x) => +x.toFixed(4))), "versión", aceptado.version);
  piscina.cerrar();
}

async function principal() {
  if (process.argv[2] === "comparar") return comparar(process.argv[3], process.argv[4], Number(process.argv[5] ?? 400));
  if (process.argv[2] === "evolucionar") return evolucionar();
  if (process.argv[2] === "mc") return compararMc(Number(process.argv[3] ?? 4), Number(process.argv[4] ?? 200));
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
