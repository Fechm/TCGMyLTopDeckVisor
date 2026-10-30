import { accionesLegales, aplicar, jugadorQueDecide } from "./motor.js";
import * as N from "./nucleo.js";

const MEJORA_MINIMA = 0.05;

export function valor(e, uid) {
  const c = N.carta(e, uid);
  const coste = c.coste ?? 0;
  if (c.tipo === "Aliado") return (c.fuerza ?? 0) + coste;
  if (c.tipo === "Oro") return c.sinHabilidad ? 1 : 1.5;
  if (c.tipo === "Tótem") return 3 + coste;
  return 2 + coste;
}

export function evaluar(e, j) {
  if (e.ganador !== null) return e.ganador === j ? 1000 : -1000;
  const lado = (k) => {
    const p = e.jugadores[k];
    const aliados = N.aliadosDe(e, k);
    const fuerza = aliados.reduce((s, a) => s + N.fuerza(e, a), 0);
    const oros = N.orosDe(e, k).reduce((s, o) => s + (N.activa(e, o) && !N.carta(e, o).sinHabilidad ? 1.3 : 1), 0);
    const mano = p.mano.reduce((s, u) => s + 0.6 + 0.08 * valor(e, u), 0);
    const castillo = p.castillo.length;
    const peligro = castillo < 10 ? (10 - castillo) * 0.5 : 0;
    return castillo - peligro + fuerza * 1.2 + aliados.length * 0.5 + N.armasDe(e, k).length + p.apoyo.length * 2.5 + oros + mano;
  };
  return lado(j) - lado(N.rival(j));
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
    if (opciones.length <= 4 && prof < 2) s = asentar(s, prof);
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
    const puntaje = evaluar(asentar(aplicar(e, a), 0), j);
    if (puntaje > mejorPuntaje) {
      mejorPuntaje = puntaje;
      mejor = a;
    }
  }
  return mejor;
}

function bloqueadoresRivales(e, j) {
  return e.jugadores[N.rival(j)].defensa.filter((b) => !e.efectos.some((f) => f.tipo === "noAtacarBloquear" && f.uid === b));
}

function atacantesDeseados(e, j, posibles) {
  const blo = bloqueadoresRivales(e, j).map((b) => N.fuerza(e, b)).sort((a, b) => b - a);
  const castilloRival = e.jugadores[N.rival(j)].castillo.length;
  const fuerzas = posibles.map((u) => N.fuerza(e, u)).sort((a, b) => b - a);
  const total = fuerzas.slice(blo.length).reduce((s, f) => s + f, 0);
  if (total >= castilloRival) return posibles;
  const mayor = blo[0] ?? -1;
  return posibles.filter((u) => {
    const f = N.fuerza(e, u);
    if (f === 0) return false;
    return f > mayor || N.tiene(e, u, "Imbloqueable") || N.tiene(e, u, "Indestructible");
  });
}

function decidirBloqueo(e, j, legales) {
  const bloquear = legales.filter((a) => a.tipo === "bloquear");
  if (!bloquear.length) return legales.find((a) => a.tipo === "finBloqueo");
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
    const fa = N.fuerza(e, a.atacante);
    const fb = N.fuerza(e, a.uid);
    if (fb === fa && valor(e, a.atacante) >= valor(e, a.uid)) return a;
  }
  if (letal) {
    const chica = [...opciones].sort((x, y) => valor(e, x.uid) - valor(e, y.uid) || N.fuerza(e, y.atacante) - N.fuerza(e, x.atacante));
    return chica.find((a) => N.fuerza(e, a.atacante) === N.fuerza(e, opciones[0].atacante)) ?? chica[0];
  }
  return legales.find((a) => a.tipo === "finBloqueo") ?? opciones[0];
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

function decidirVigilia(e, j, legales) {
  const oros = legales.filter((a) => a.tipo === "oro");
  if (oros.length) return mejorJugada(e, j, oros) ?? oros[0];
  const jugada = mejorJugada(e, j, legales.filter((a) => a.tipo === "jugar" || a.tipo === "habilidad"));
  if (jugada) return jugada;
  const batalla = legales.find((a) => a.tipo === "batalla");
  if (batalla) {
    const posibles = accionesLegales(aplicar(e, batalla)).filter((a) => a.tipo === "atacar").map((a) => a.uid);
    if (atacantesDeseados(e, j, posibles).length || !legales.some((a) => a.tipo === "terminar")) return batalla;
  }
  return legales.find((a) => a.tipo === "terminar") ?? legales[0];
}

function decidirAtaque(e, j, legales) {
  const posibles = legales.filter((a) => a.tipo === "atacar").map((a) => a.uid);
  const deseados = atacantesDeseados(e, j, [...posibles, ...e.atacantes]).filter((u) => posibles.includes(u));
  if (deseados.length) return { tipo: "atacar", uid: deseados[0] };
  const fin = legales.find((a) => a.tipo === "finAtaque");
  if (fin) return fin;
  const mejor = [...posibles].sort((x, y) => N.fuerza(e, y) - N.fuerza(e, x))[0];
  return { tipo: "atacar", uid: mejor };
}

function decidirTalismanes(e, j, legales) {
  const jugada = mejorJugada(e, j, legales.filter((a) => a.tipo !== "pasar"));
  return jugada ?? { tipo: "pasar" };
}

function decidirDescarte(e, j, legales) {
  return [...legales].sort((x, y) => valor(e, x.uid) - valor(e, y.uid))[0];
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
    case "final":
      return decidirDescarte(e, j, legales);
    default:
      return legales[0];
  }
}
