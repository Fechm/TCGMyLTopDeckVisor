import * as N from "./nucleo.js";
import { costeDe } from "./motor.js";

export const RASGOS = ["castillo", "peligro", "fuerza", "aliados", "armas", "totems", "oros", "orosHabilidad", "mano", "manoValor", "riesgo", "guardia"];

export const ESCALA = 10;

export function valor(e, uid) {
  const c = N.carta(e, uid);
  const coste = c.coste ?? 0;
  if (c.tipo === "Aliado") return (c.fuerza ?? 0) + coste;
  if (c.tipo === "Oro") return c.sinHabilidad ? 1 : 1.5;
  if (c.tipo === "Tótem") return 3 + coste;
  return 2 + coste;
}

export function amenaza(e, k) {
  const atacantes = N.aliadosDe(e, N.rival(k)).map((a) => N.fuerza(e, a)).sort((a, b) => b - a);
  const bloqueadores = e.jugadores[k].defensa.map((b) => N.fuerza(e, b)).sort((a, b) => b - a);
  return atacantes.reduce((s, fa, i) => s + (i < bloqueadores.length ? Math.max(0, fa - bloqueadores[i]) : fa), 0);
}

function respuestaLista(e, k) {
  const p = e.jugadores[k];
  return p.mano.some((u) => {
    const c = N.carta(e, u);
    if (c.sinHabilidad) return false;
    if (c.respuesta && c.tipo === "Talismán") return costeDe(e, k, u).pagar <= p.reserva.length;
    if (c.respuestaMano) return c.respuestaMano.oros <= p.reserva.length;
    return false;
  });
}

function lado(e, k) {
  const p = e.jugadores[k];
  const aliados = N.aliadosDe(e, k);
  const oros = N.orosDe(e, k);
  const castillo = p.castillo.length;
  return [
    castillo,
    Math.max(0, 10 - castillo),
    aliados.reduce((s, a) => s + N.fuerza(e, a), 0),
    aliados.length,
    N.armasDe(e, k).length,
    p.apoyo.length,
    oros.length,
    oros.filter((o) => N.activa(e, o) && !N.carta(e, o).sinHabilidad).length,
    p.mano.length,
    p.mano.reduce((s, u) => s + valor(e, u), 0),
    Math.min(amenaza(e, k), castillo),
    e.activo === k && respuestaLista(e, k) ? 1 : 0,
  ];
}

export function rasgos(e, j) {
  const a = lado(e, j);
  const b = lado(e, N.rival(j));
  return a.map((x, i) => x - b[i]);
}

export function modeloInicial() {
  return {
    version: 0,
    w: [0.1, -0.05, 0.12, 0.05, 0.1, 0.25, 0.1, 0.03, 0.06, 0.008, 0, 0.08],
    b: [0, 0],
    escala: [8, 4, 8, 2, 1, 1, 3, 2, 3, 15, 5, 1],
    partidas: 0,
  };
}

export function logit(modelo, phi, j) {
  let s = modelo.b[j];
  for (let i = 0; i < phi.length; i++) s += modelo.w[i] * phi[i];
  return s;
}

const sigmoide = (x) => 1 / (1 + Math.exp(-Math.max(-30, Math.min(30, x))));

export function ajustar(modelo, muestras, { pasos = 300, tasa = 0.3, l2 = 0.001, ancla = null } = {}) {
  const k = modelo.w.length;
  const esc = modelo.escala;
  const ws = modelo.w.map((w, i) => w * esc[i]);
  const centro = ancla ? ancla.w.map((w, i) => w * esc[i]) : new Array(k).fill(0);
  const bs = [...modelo.b];
  if (!muestras.length) return modelo;
  for (let paso = 0; paso < pasos; paso++) {
    const gw = new Array(k).fill(0);
    const gb = [0, 0];
    const cuenta = [0, 0];
    for (const { phi, j, z } of muestras) {
      let s = bs[j];
      for (let i = 0; i < k; i++) s += ws[i] * (phi[i] / esc[i]);
      const d = sigmoide(s) - z;
      for (let i = 0; i < k; i++) gw[i] += d * (phi[i] / esc[i]);
      gb[j] += d;
      cuenta[j] += 1;
    }
    const n = muestras.length;
    for (let i = 0; i < k; i++) ws[i] -= tasa * (gw[i] / n + l2 * (ws[i] - centro[i]));
    for (const j of [0, 1]) if (cuenta[j]) bs[j] -= tasa * (gb[j] / cuenta[j]);
  }
  return { ...modelo, w: ws.map((w, i) => w / esc[i]), b: bs };
}

export function perdida(modelo, muestras) {
  let s = 0;
  for (const { phi, j, z } of muestras) {
    const p = sigmoide(logit(modelo, phi, j));
    s -= z ? Math.log(p + 1e-9) : Math.log(1 - p + 1e-9);
  }
  return muestras.length ? s / muestras.length : 0;
}

export function muestrasDePartida(estados, ganador) {
  return estados.flatMap(({ phi0, phi1 }) => [
    { phi: phi0, j: 0, z: ganador === 0 ? 1 : 0 },
    { phi: phi1, j: 1, z: ganador === 1 ? 1 : 0 },
  ]);
}

export function foto(e) {
  return { phi0: rasgos(e, 0), phi1: rasgos(e, 1) };
}
