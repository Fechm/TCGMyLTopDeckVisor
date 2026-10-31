import { accionesLegales, aplicar, jugadorQueDecide } from "./motor.js";
import * as N from "./nucleo.js";

import { MODELO } from "./modelo.js";
import { rasgos, logit, valor, ESCALA } from "./aprendizaje.js";

export { valor };

const MEJORA_MINIMA = 0.05;
const MAX_CANDIDATOS_ATAQUE = 4;
const TOPE_SIMULADO = 50;

export const OPCIONES = { simAtaque: true, simBloqueo: true, modelo: MODELO, mc: null };

let enSimulacion = false;

export function configurar(o) {
  Object.assign(OPCIONES, o);
}

export function evaluar(e, j, modelo = OPCIONES.modelo) {
  if (e.ganador !== null) return e.ganador === j ? 1000 : -1000;
  return ESCALA * logit(modelo, rasgos(e, j), j);
}

function asentar(e, prof) {
  for (let k = 0; k < 30 && e.ganador === null; k++) {
    if (e.pendiente) {
      e = aplicar(e, { tipo: "elegir", i: mejorEleccion(e, prof + 1) });
      continue;
    }
    const top = e.pila.at(-1);
    if (top && !top.cerrada) {
      e = aplicar(e, { tipo: "noResponder" });
      continue;
    }
    if (e.fase === "momento") {
      e = aplicar(e, { tipo: "pasarMomento" });
      continue;
    }
    break;
  }
  return e;
}

export function mejorEleccion(e, prof = 0) {
  const j = e.pendiente.jugador;
  const opciones = e.pendiente.opciones;
  if (opciones.length === 1) return 0;
  let mejor = 0;
  let mejorPuntaje = -Infinity;
  opciones.forEach((o, i) => {
    let s = aplicar(e, { tipo: "elegir", i });
    if (opciones.length <= 4 && prof === 0 && !enSimulacion) s = asentar(s, prof);
    const puntaje = evaluar(s, j) - (o.valor === null ? 0.01 : 0);
    if (puntaje > mejorPuntaje) {
      mejorPuntaje = puntaje;
      mejor = i;
    }
  });
  return mejor;
}

function mejorJugada(e, j, candidatas) {
  const base = evaluar(e, j);
  let mejor = null;
  let mejorPuntaje = base + MEJORA_MINIMA;
  for (const a of candidatas) {
    const s = aplicar(e, a);
    const puntaje = evaluar(enSimulacion ? s : asentar(s, 0), j);
    if (puntaje > mejorPuntaje) {
      mejorPuntaje = puntaje;
      mejor = a;
    }
  }
  return mejor;
}

function reglaBloqueo(e, j, legales) {
  const bloquear = legales.filter((a) => a.tipo === "bloquear");
  const fin = legales.find((a) => a.tipo === "finBloqueo");
  if (!bloquear.length) return fin;
  const bloqueados = new Set(Object.values(e.bloqueos));
  const libres = e.atacantes.filter((a) => !bloqueados.has(a) && e.jugadores[N.rival(j)].ataque.includes(a));
  const entrante = libres.reduce((s, a) => s + N.fuerza(e, a), 0);
  const letal = entrante >= e.jugadores[j].castillo.length;
  const opciones = [...bloquear].sort((x, y) => N.fuerza(e, y.atacante) - N.fuerza(e, x.atacante));
  for (const a of opciones) {
    const fa = N.fuerza(e, a.atacante);
    const fb = N.fuerza(e, a.uid);
    const sobrevive = fb > fa || (N.tiene(e, a.uid, "Indestructible") && fb >= fa);
    if (sobrevive && !N.tiene(e, a.atacante, "Indestructible")) return a;
  }
  for (const a of opciones) {
    if (N.fuerza(e, a.uid) === N.fuerza(e, a.atacante) && valor(e, a.atacante) >= valor(e, a.uid)) return a;
  }
  if (letal) {
    const chica = [...opciones].sort((x, y) => valor(e, x.uid) - valor(e, y.uid) || N.fuerza(e, y.atacante) - N.fuerza(e, x.atacante));
    return chica.find((a) => N.fuerza(e, a.atacante) === N.fuerza(e, opciones[0].atacante)) ?? chica[0];
  }
  return fin ?? opciones[0];
}

function decidirDescarte(e, j, legales) {
  return [...legales].sort((x, y) => valor(e, x.uid) - valor(e, y.uid))[0];
}

function cerrarTurno(s, j) {
  for (let k = 0; k < 80 && s.ganador === null && s.activo === j; k++) {
    if (s.pendiente) {
      s = aplicar(s, { tipo: "elegir", i: mejorEleccion(s, 2) });
      continue;
    }
    const top = s.pila.at(-1);
    if (top && !top.cerrada) {
      s = aplicar(s, { tipo: "noResponder" });
      continue;
    }
    const legales = accionesLegales(s);
    const quien = jugadorQueDecide(s);
    let a;
    if (s.fase === "bloqueo") a = reglaBloqueo(s, quien, legales);
    else if (s.fase === "final") a = decidirDescarte(s, quien, legales);
    else a = legales.find((x) => ["pasar", "finAtaque", "terminar", "finBloqueo", "pasarMomento"].includes(x.tipo)) ?? legales[0];
    s = aplicar(s, a);
  }
  return s;
}

function probar(e, j, acciones) {
  try {
    let s = e;
    for (const a of acciones) s = asentar(aplicar(s, a), 1);
    return evaluar(cerrarTurno(s, j), j);
  } catch {
    return -Infinity;
  }
}

function reglaAtaque(e, j, posibles) {
  const blo = e.jugadores[N.rival(j)].defensa.filter((b) => !e.efectos.some((f) => f.tipo === "noAtacarBloquear" && f.uid === b)).map((b) => N.fuerza(e, b)).sort((a, b) => b - a);
  const castilloRival = e.jugadores[N.rival(j)].castillo.length;
  const fuerzas = [...posibles, ...e.atacantes].map((u) => N.fuerza(e, u)).sort((a, b) => b - a);
  if (fuerzas.slice(blo.length).reduce((s, f) => s + f, 0) >= castilloRival) return posibles;
  const mayor = blo[0] ?? -1;
  return posibles.filter((u) => {
    const f = N.fuerza(e, u);
    return f > 0 && (f > mayor || N.tiene(e, u, "Imbloqueable") || N.tiene(e, u, "Indestructible"));
  });
}

function planAtaque(e, j, posibles) {
  if (!OPCIONES.simAtaque) return reglaAtaque(e, j, posibles);
  const previo = e.fase === "vigilia" ? [{ tipo: "batalla" }] : [];
  const atacar = (us) => [...previo, ...us.map((uid) => ({ tipo: "atacar", uid }))];
  let elegidos = [];
  let mejor = probar(e, j, e.fase === "vigilia" ? [{ tipo: "terminar" }] : [{ tipo: "finAtaque" }]);
  const todos = probar(e, j, atacar(posibles));
  const candidatos = [...posibles].sort((x, y) => N.fuerza(e, y) - N.fuerza(e, x)).slice(0, MAX_CANDIDATOS_ATAQUE);
  for (let ronda = 0; ronda < MAX_CANDIDATOS_ATAQUE; ronda++) {
    let paso = null;
    let puntaje = mejor;
    for (const u of candidatos) {
      if (elegidos.includes(u)) continue;
      const p = probar(e, j, atacar([...elegidos, u]));
      if (p > puntaje + MEJORA_MINIMA) {
        puntaje = p;
        paso = u;
      }
    }
    if (!paso) break;
    elegidos.push(paso);
    mejor = puntaje;
  }
  if (todos > mejor + MEJORA_MINIMA) return [...posibles].sort((x, y) => N.fuerza(e, y) - N.fuerza(e, x));
  return elegidos;
}

function decidirRespuesta(e, j, legales) {
  const resp = legales.filter((a) => a.tipo === "responder");
  if (!resp.length) return { tipo: "noResponder" };
  const top = e.pila.at(-1);
  const c = N.carta(e, top.uid);
  const vale = c.tipo === "Talismán" || c.tipo === "Tótem" || top.coste >= 2;
  if (!vale) return { tipo: "noResponder" };
  const mano = e.jugadores[j].mano.length;
  const ordenadas = resp
    .filter((a) => !(N.carta(e, a.uid).nombre === "Dragón Dorado" && mano - 1 < top.coste))
    .sort((x, y) => valor(e, x.uid) - valor(e, y.uid));
  return ordenadas[0] ?? { tipo: "noResponder" };
}

function decidirMulligan(e, j, legales) {
  const mano = e.jugadores[j].mano;
  const oros = mano.filter((u) => N.carta(e, u).tipo === "Oro").length;
  if (oros >= 2 && oros <= 5) return { tipo: "quedarse" };
  if (legales.some((a) => a.tipo === "mulliganGratis")) return { tipo: "mulliganGratis" };
  if (mano.length > 6 && (oros === 0 || oros >= 6)) return { tipo: "mulligan" };
  return { tipo: "quedarse" };
}

function vigiliaHeuristica(e, j, legales) {
  const oros = legales.filter((a) => a.tipo === "oro");
  if (oros.length) return mejorJugada(e, j, oros) ?? oros[0];
  const jugada = mejorJugada(e, j, legales.filter((a) => a.tipo === "jugar" || a.tipo === "habilidad"));
  if (jugada) return jugada;
  const batalla = legales.find((a) => a.tipo === "batalla");
  const terminar = legales.find((a) => a.tipo === "terminar");
  if (batalla) {
    if (!terminar) return batalla;
    const posibles = accionesLegales(asentar(aplicar(e, batalla), 1)).filter((a) => a.tipo === "atacar").map((a) => a.uid);
    if (planAtaque(e, j, posibles).length) return batalla;
  }
  return terminar ?? legales[0];
}

function determinizar(e, j, k) {
  const { catalogo, ...resto } = e;
  const s = { ...structuredClone(resto), catalogo };
  s.azar = (e.azar ^ Math.imul(k + 1, 0x9e3779b1)) >>> 0;
  const r = s.jugadores[N.rival(j)];
  const ocultas = [...r.mano, ...r.castillo];
  N.barajar(s, ocultas);
  r.mano = ocultas.slice(0, r.mano.length);
  r.castillo = ocultas.slice(r.mano.length);
  N.barajar(s, s.jugadores[j].castillo);
  return s;
}

function simular(s, j, horizonte) {
  for (let k = 0; k < 600 && s.ganador === null && s.turno < horizonte; k++) s = aplicar(s, elegirAccion(s));
  return Math.max(-TOPE_SIMULADO, Math.min(TOPE_SIMULADO, evaluar(s, j)));
}

function candidatasMc(e, j, legales, heuristica) {
  const jugadas = legales.filter((a) => a.tipo === "jugar" || a.tipo === "habilidad" || a.tipo === "oro");
  const puntuadas = jugadas.map((a) => {
    try {
      return [a, evaluar(asentar(aplicar(e, a), 0), j)];
    } catch {
      return [a, -Infinity];
    }
  });
  const mejores = puntuadas.sort((x, y) => y[1] - x[1]).slice(0, OPCIONES.mc.candidatos ?? 3).map((x) => x[0]);
  const cierre = legales.filter((a) => a.tipo === "batalla" || a.tipo === "terminar");
  const clave = (a) => JSON.stringify(a);
  const vistas = new Set();
  return [heuristica, ...mejores, ...cierre].filter((a) => a && !vistas.has(clave(a)) && vistas.add(clave(a)));
}

function buscarVigilia(e, j, legales) {
  const heuristica = vigiliaHeuristica(e, j, legales);
  const candidatas = candidatasMc(e, j, legales, heuristica);
  if (candidatas.length <= 1) return heuristica;
  const { simulaciones = 4, margen = 1, msMax = null } = OPCIONES.mc;
  const horizonte = e.turno + 2;
  const valores = candidatas.map(() => []);
  const inicio = Date.now();
  const respaldo = { ...OPCIONES };
  enSimulacion = true;
  Object.assign(OPCIONES, { simAtaque: false, simBloqueo: false });
  try {
    for (let k = 0; k < simulaciones; k++) {
      if (msMax !== null && k > 1 && Date.now() - inicio > msMax) break;
      candidatas.forEach((a, i) => {
        let v;
        try {
          v = simular(aplicar(determinizar(e, j, k), a), j, horizonte);
        } catch {
          v = -TOPE_SIMULADO;
        }
        valores[i].push(v);
      });
    }
  } finally {
    enSimulacion = false;
    Object.assign(OPCIONES, respaldo);
  }
  let mejor = 0;
  let mejorVentaja = 0;
  valores.forEach((vs, i) => {
    if (i === 0 || vs.length < 2) return;
    const d = vs.map((v, k) => v - valores[0][k]);
    const media = d.reduce((x, y) => x + y, 0) / d.length;
    const varianza = d.reduce((x, y) => x + (y - media) ** 2, 0) / (d.length - 1);
    if (media > margen && media > Math.sqrt(varianza / d.length) && media > mejorVentaja) {
      mejor = i;
      mejorVentaja = media;
    }
  });
  return candidatas[mejor];
}

function decidirVigilia(e, j, legales) {
  if (OPCIONES.mc && !enSimulacion) return buscarVigilia(e, j, legales);
  return vigiliaHeuristica(e, j, legales);
}

function decidirAtaque(e, j, legales) {
  const posibles = legales.filter((a) => a.tipo === "atacar").map((a) => a.uid);
  const fin = legales.find((a) => a.tipo === "finAtaque");
  if (!posibles.length) return fin;
  const plan = planAtaque(e, j, posibles);
  if (plan.length) return { tipo: "atacar", uid: plan[0] };
  if (fin) return fin;
  const puntajes = posibles.map((uid) => [uid, probar(e, j, [{ tipo: "atacar", uid }])]);
  return { tipo: "atacar", uid: puntajes.sort((x, y) => y[1] - x[1])[0][0] };
}

function decidirBloqueo(e, j, legales) {
  const fin = legales.find((a) => a.tipo === "finBloqueo");
  const bloquear = legales.filter((a) => a.tipo === "bloquear");
  if (!bloquear.length) return fin;
  if (!OPCIONES.simBloqueo) return reglaBloqueo(e, j, legales);
  const atacante = N.rival(j);
  const puntaje = (a) => {
    try {
      let s = aplicar(e, a);
      if (a.tipo === "bloquear") s = aplicar(s, reglaBloqueo(s, j, accionesLegales(s)) ?? { tipo: "finBloqueo" });
      return -evaluar(cerrarTurno(s, atacante), atacante);
    } catch {
      return -Infinity;
    }
  };
  let mejor = fin ?? null;
  let mejorPuntaje = fin ? puntaje(fin) : -Infinity;
  for (const a of bloquear) {
    const p = puntaje(a);
    if (p > mejorPuntaje + (mejor ? MEJORA_MINIMA : 0)) {
      mejorPuntaje = p;
      mejor = a;
    }
  }
  return mejor ?? reglaBloqueo(e, j, legales);
}

function decidirTalismanes(e, j, legales) {
  const jugada = mejorJugada(e, j, legales.filter((a) => a.tipo !== "pasar"));
  return jugada ?? { tipo: "pasar" };
}

export function elegirAccion(e) {
  const legales = accionesLegales(e);
  if (legales.length <= 1) return legales[0];
  const j = jugadorQueDecide(e);
  if (e.pendiente) return { tipo: "elegir", i: mejorEleccion(e) };
  const top = e.pila.at(-1);
  if (top && !top.cerrada) return decidirRespuesta(e, j, legales);
  switch (e.fase) {
    case "mulligan":
      return decidirMulligan(e, j, legales);
    case "vigilia":
      return decidirVigilia(e, j, legales);
    case "ataque":
      return decidirAtaque(e, j, legales);
    case "bloqueo":
      return decidirBloqueo(e, j, legales);
    case "talismanes":
      return decidirTalismanes(e, j, legales);
    case "momento":
      return mejorJugada(e, j, legales.filter((a) => a.tipo === "jugar")) ?? { tipo: "pasarMomento" };
    case "final":
      return decidirDescarte(e, j, legales);
    default:
      return legales[0];
  }
}
