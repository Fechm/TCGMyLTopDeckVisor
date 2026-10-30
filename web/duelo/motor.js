import { CATALOGO } from "./cartas.js";
import * as N from "./nucleo.js";
import { OPS, resolver, elegir, revisarDerrota, entrarEnJuego, entrarOro, pagarOros, armaCabe, hayObjetivo } from "./efectos.js";

export { carta, fuerza, claves, activa } from "./nucleo.js";

export const LIMITE_MANO = 8;
export const MANO_INICIAL = 8;

function clonar(e) {
  const { catalogo, ...resto } = e;
  return { ...structuredClone(resto), catalogo };
}

function jugadorVacio() {
  return {
    castillo: [], mano: [], reserva: [], pagado: [], defensa: [], ataque: [], apoyo: [],
    cementerio: [], destierro: [], nuevos: [], oroJugado: false, otraJugada: false,
    mulliganListo: false, mulliganGratisUsado: false, orosPuestos: 0, salidasCastillo: 0,
    jugadas: { total: 0, nombres: {} }, declarados: [], atacoEsteTurno: false, atacoTurnoAnterior: false,
  };
}

function oroDeInicio(e, ids) {
  const i = ids.findIndex((id) => e.catalogo[id].oroInicial);
  if (i >= 0) return i;
  return ids.findIndex((id) => e.catalogo[id].tipo === "Oro" && e.catalogo[id].sinHabilidad);
}

export function crearPartida({ semilla = 1, mazos, catalogo = CATALOGO, inicial } = {}) {
  const e = {
    catalogo, azar: semilla >>> 0, instancias: {}, armas: {}, conv: {}, ganadas: {}, efectos: [],
    cola: [], pendiente: null, pila: [], usos: {}, jugadores: [jugadorVacio(), jugadorVacio()],
    turno: 0, activo: 0, inicial: 0, fase: "mulligan", turnoMulligan: 0,
    atacantes: [], bloqueos: {}, prioridad: 0, pases: 0, ganador: null, registro: [],
  };
  mazos.forEach((ids, j) => {
    const iOro = oroDeInicio(e, ids);
    const p = e.jugadores[j];
    ids.forEach((id, k) => {
      const uid = `${j}-${k}`;
      e.instancias[uid] = id;
      (k === iOro ? p.reserva : p.castillo).push(uid);
    });
    N.barajar(e, p.castillo);
  });
  e.inicial = inicial ?? (N.azar(e) < 0.5 ? 0 : 1);
  e.activo = e.inicial;
  e.turnoMulligan = e.inicial;
  N.robar(e, 0, MANO_INICIAL);
  N.robar(e, 1, MANO_INICIAL);
  return e;
}

const ctxDe = (e, j, uid) => {
  const c = N.carta(e, uid);
  return { ctrl: j, fuente: uid, def: c.id, costeFuente: c.coste ?? 0, vars: {} };
};

function requiere(e, ctx, r) {
  if (!r) return true;
  if (typeof r === "string") return N.def(e, ctx.def).fns[r](e, ctx);
  return hayObjetivo(e, ctx, r);
}

export function costeDe(e, j, uid) {
  const c = N.carta(e, uid);
  const impreso = c.coste ?? 0;
  const ctx = ctxDe(e, j, uid);
  let coste = impreso;
  if (c.reduce) coste = Math.max(Math.min(impreso, 1), impreso - c.fns[c.reduce](e, ctx));
  let pagar = coste;
  if (c.orosMenos) pagar = Math.max(0, pagar - c.fns[c.orosMenos](e, ctx));
  if (impreso === 0 && N.hay(e, j, (k, propio) => !propio && k.rivalImpuestoCoste0)) pagar += 1;
  return { coste, pagar };
}

function restringido(e, j, uid) {
  const c = N.carta(e, uid);
  const p = e.jugadores[j];
  const ponen = ["Aliado", "Arma", "Tótem"].includes(c.tipo);
  if (ponen && N.hay(e, j, (k, propio) => !propio && k.rivalMaxNoOro) && p.jugadas.total >= 3) return true;
  if (e.efectos.some((f) => f.tipo === "unaPorTipo" && f.j === j) && (p.jugadas[c.tipo] ?? 0) >= 1) return true;
  if (e.efectos.some((f) => f.tipo === "noJugarNombre" && f.j === j && f.nombre === c.nombre)) return true;
  if (c.unoPorTurno && p.jugadas.nombres[c.nombre]) return true;
  return false;
}

function desdeCementerio(e, j, uid) {
  const c = N.carta(e, uid);
  if (c.sinHabilidad) return null;
  if (c.claves.includes("Exhumar")) return { exhumado: true };
  if (c.exhumarSi && c.fns[c.exhumarSi](e, ctxDe(e, j, uid))) return { exhumado: true };
  if (c.desdeCementerio) return c.desdeCementerio;
  return null;
}

function momentoJugar(e, j) {
  if (e.fase === "vigilia" && e.activo === j) return "vigilia";
  if (e.fase === "talismanes" && e.prioridad === j) return "talismanes";
  return null;
}

function jugadas(e, j) {
  const momento = momentoJugar(e, j);
  if (!momento) return [];
  const p = e.jugadores[j];
  const armasEnGuerra = N.hay(e, j, (k, propio) => propio && k.armasEnGuerra);
  const acciones = [];
  const vistos = new Set();
  const origenes = [...p.mano.map((u) => [u, "mano"]), ...p.cementerio.map((u) => [u, "cementerio"])];
  for (const [uid, desde] of origenes) {
    const c = N.carta(e, uid);
    if (c.tipo === "Oro" || c.soloRespuesta) continue;
    if (momento === "talismanes" && !(c.tipo === "Talismán" || (c.tipo === "Arma" && armasEnGuerra))) continue;
    const alt = desde === "cementerio" ? desdeCementerio(e, j, uid) : {};
    if (!alt) continue;
    const clave = `${c.id}|${desde}`;
    if (vistos.has(clave)) continue;
    const { pagar } = costeDe(e, j, uid);
    if (pagar > p.reserva.length) continue;
    if (alt.botar && p.castillo.length <= alt.botar) continue;
    if (restringido(e, j, uid)) continue;
    if (!requiere(e, ctxDe(e, j, uid), c.requiere)) continue;
    vistos.add(clave);
    const extra = desde === "cementerio" ? { desde } : {};
    if (c.tipo === "Arma") {
      for (const a of N.aliadosDe(e, j)) if (armaCabe(e, a, uid)) acciones.push({ tipo: "jugar", uid, portador: a, ...extra });
    } else {
      acciones.push({ tipo: "jugar", uid, ...extra });
    }
  }
  return acciones;
}

function orosJugables(e, j) {
  const p = e.jugadores[j];
  if (p.oroJugado || p.otraJugada) return [];
  const controlaUnica = (c) => c.claves.includes("UnaCopia") && N.orosDe(e, j).some((o) => N.carta(e, o).nombre === c.nombre);
  const a = [];
  const vistos = new Set();
  for (const [uid, desde] of [...p.mano.map((u) => [u, "mano"]), ...p.cementerio.map((u) => [u, "cementerio"])]) {
    const c = N.carta(e, uid);
    if (c.tipo !== "Oro" || vistos.has(c.id + desde) || controlaUnica(c)) continue;
    if (desde === "cementerio" && !(c.desdeCementerio && !c.sinHabilidad)) continue;
    vistos.add(c.id + desde);
    a.push(desde === "mano" ? { tipo: "oro", uid } : { tipo: "oro", uid, desde });
  }
  return a;
}

function momentoHabilidad(e, j, m) {
  const suVigilia = e.fase === "vigilia" && e.activo === j;
  const suPrioridad = e.fase === "talismanes" && e.prioridad === j;
  if (m === "vigilia") return suVigilia;
  if (m === "tuTurno") return suVigilia || (suPrioridad && e.activo === j);
  return suVigilia || suPrioridad;
}

function claveUso(e, j, uid, d, h, a) {
  return a.veces === "turnoNombre" ? `${j}|${d.nombre}|${h}` : `${uid}|${d.id}|${h}`;
}

function habilidadesUsables(e, j) {
  const p = e.jugadores[j];
  const fuentes = [];
  for (const uid of N.enJuegoDe(e, j)) for (const d of N.habilidades(e, uid)) fuentes.push([uid, d, "juego"]);
  for (const z of ["mano", "cementerio"]) {
    for (const uid of p[z]) {
      const d = N.carta(e, uid);
      if (!d.sinHabilidad) fuentes.push([uid, d, z]);
    }
  }
  const acciones = [];
  for (const [uid, d, zona] of fuentes) {
    d.activadas.forEach((a, h) => {
      if ((a.zona ?? "juego") !== zona) return;
      if (!momentoHabilidad(e, j, a.momento ?? "cualquiera")) return;
      if (a.veces && e.usos[claveUso(e, j, uid, d, h, a)] === e.turno) return;
      const oros = (a.oros ?? 0) + N.impuestoHabilidad(e, j, uid, "activada");
      if (oros > p.reserva.length) return;
      const ctx = { ctrl: j, fuente: uid, def: d.id, costeFuente: d.coste ?? 0, vars: {} };
      if (!requiere(e, ctx, a.requiere)) return;
      acciones.push({ tipo: "habilidad", uid, def: d.id, h });
    });
  }
  return acciones;
}

function atacables(e, j) {
  if (e.efectos.some((f) => f.tipo === "noAtacar" && (f.j === undefined || f.j === j))) return [];
  const p = e.jugadores[j];
  return p.defensa.filter((u) => {
    if (e.efectos.some((f) => f.tipo === "noAtacarBloquear" && f.uid === u)) return false;
    return !p.nuevos.includes(u) || N.tiene(e, u, "Furia") || N.tiene(e, u, "AtacaAlEntrar");
  });
}

function debeAtacar(e, j) {
  return N.hay(e, j, (k, propio) => !propio && k.rivalDebeAtacar) && atacables(e, j).length > 0;
}

function respuestas(e, j, item) {
  const p = e.jugadores[j];
  const objetivo = N.carta(e, item.uid);
  if (objetivo.claves.includes("NoAnulable") && !objetivo.sinHabilidad) return [];
  const sirve = (f) =>
    (!f.tipo || f.tipo === objetivo.tipo) &&
    (f.costeMax === undefined || item.coste <= f.costeMax) &&
    (f.coste === undefined || item.coste === f.coste);
  const a = [];
  const vistos = new Set();
  for (const uid of p.mano) {
    const c = N.carta(e, uid);
    if (c.sinHabilidad || vistos.has(c.id)) continue;
    if (c.respuesta && c.tipo === "Talismán" && sirve(c.respuesta.anula)) {
      if (costeDe(e, j, uid).pagar > p.reserva.length || restringido(e, j, uid)) continue;
      vistos.add(c.id);
      a.push({ tipo: "responder", uid });
    } else if (c.respuestaMano && sirve(c.respuestaMano.anula) && c.respuestaMano.oros <= p.reserva.length) {
      vistos.add(c.id);
      a.push({ tipo: "responder", uid });
    }
  }
  return a;
}

export function jugadorQueDecide(e) {
  if (e.ganador !== null) return null;
  if (e.pendiente) return e.pendiente.jugador;
  const top = e.pila.at(-1);
  if (top && !top.cerrada) return N.rival(top.ctrl);
  if (e.fase === "mulligan") return e.turnoMulligan;
  if (e.fase === "bloqueo") return N.rival(e.activo);
  if (e.fase === "talismanes") return e.prioridad;
  return e.activo;
}

export function accionesLegales(e) {
  if (e.ganador !== null) return [];
  if (e.pendiente) return e.pendiente.opciones.map((_, i) => ({ tipo: "elegir", i }));
  const j = jugadorQueDecide(e);
  const top = e.pila.at(-1);
  if (top && !top.cerrada) return [...respuestas(e, j, top), { tipo: "noResponder" }];
  const p = e.jugadores[j];
  switch (e.fase) {
    case "mulligan": {
      const a = [{ tipo: "quedarse" }];
      if (p.mano.length > 1) a.push({ tipo: "mulligan" });
      if (!p.mulliganGratisUsado && p.mano.filter((u) => N.carta(e, u).tipo === "Oro").length <= 1) a.push({ tipo: "mulliganGratis" });
      return a;
    }
    case "vigilia": {
      const a = [...orosJugables(e, j), ...jugadas(e, j), ...habilidadesUsables(e, j)];
      const puedeAtacar = atacables(e, j).length > 0;
      if (puedeAtacar) a.push({ tipo: "batalla" });
      if (!debeAtacar(e, j)) a.push({ tipo: "terminar" });
      return a;
    }
    case "ataque": {
      const a = atacables(e, j).map((uid) => ({ tipo: "atacar", uid }));
      if (e.atacantes.length || !debeAtacar(e, j)) a.push({ tipo: "finAtaque" });
      return a;
    }
    case "bloqueo": {
      const a = [];
      const bloqueados = new Set(Object.values(e.bloqueos));
      const libres = e.atacantes.filter((u) => !bloqueados.has(u) && !N.tiene(e, u, "Imbloqueable"));
      const usados = new Set(Object.keys(e.bloqueos));
      const posibles = p.defensa.filter((b) => !usados.has(b) && !e.efectos.some((f) => f.tipo === "noAtacarBloquear" && f.uid === b));
      for (const b of posibles) for (const at of libres) a.push({ tipo: "bloquear", uid: b, atacante: at });
      const obligado = libres.length && posibles.some((b) => e.efectos.some((f) => f.tipo === "debeBloquear" && f.uid === b));
      if (!obligado) a.push({ tipo: "finBloqueo" });
      return a;
    }
    case "talismanes":
      return [...jugadas(e, j), ...habilidadesUsables(e, j), { tipo: "pasar" }];
    case "final":
      return p.mano.map((uid) => ({ tipo: "descartar", uid }));
    default:
      return [];
  }
}

function igual(a, b) {
  const ka = Object.keys(a);
  return ka.length === Object.keys(b).length && ka.every((k) => a[k] === b[k]);
}

function flujo(e, ...pasos) {
  e.cola.push(N.nuevoFrame(pasos.map((paso) => ({ op: "flujo", paso })), { ctrl: e.activo }));
}

const FLUJO = {
  agrupacion(e) {
    const j = e.activo;
    const p = e.jugadores[j];
    if (e.turno > 0) {
      p.defensa.push(...p.ataque.splice(0));
      p.reserva.push(...p.pagado.splice(0));
    }
    p.nuevos = [];
    p.atacoTurnoAnterior = p.atacoEsteTurno;
    p.atacoEsteTurno = false;
    for (const q of e.jugadores) {
      Object.assign(q, { oroJugado: false, otraJugada: false, orosPuestos: 0, salidasCastillo: 0, jugadas: { total: 0, nombres: {} }, declarados: [] });
    }
    N.expirar(e, "inicio");
    if (e.turno > 0) N.disparar(e, "comienzoTurno", { j });
  },
  inicioVigilia(e) {
    N.disparar(e, "comienzoVigilia", { j: e.activo });
  },
  vigilia(e) {
    e.fase = "vigilia";
  },
  dano(e) {
    const def = N.rival(e.activo);
    const bloqueadorDe = {};
    for (const [b, a] of Object.entries(e.bloqueos)) if (aliadoEnLinea(e, b, def)) bloqueadorDe[a] = b;
    const atacantes = e.atacantes.filter((u) => e.jugadores[e.activo].ataque.includes(u));
    let alCementerio = 0;
    let alDestierro = 0;
    const destruidos = [];
    const hicieron = [];
    for (const at of atacantes) {
      const b = bloqueadorDe[at];
      const fa = fuerzaCombate(e, at);
      let d = 0;
      if (!b) d = fa;
      else {
        const fb = fuerzaCombate(e, b);
        if (fa > fb) { destruidos.push(b); d = fa - fb; }
        else if (fa === fb) destruidos.push(b, at);
        else destruidos.push(at);
      }
      if (e.efectos.some((f) => f.tipo === "sinDano" && f.uid === at)) d = 0;
      if (d > 0) hicieron.push(at);
      if (N.tiene(e, at, "DanoAlDestierro")) alDestierro += d;
      else alCementerio += d;
    }
    for (const u of destruidos) if (N.enJuego(e, u) && !N.tiene(e, u, "Indestructible")) N.mover(e, u, "cementerio");
    N.quitarDelCastillo(e, def, alCementerio, "cementerio");
    N.quitarDelCastillo(e, def, alDestierro, "destierro");
    e.registro.push({ turno: e.turno, dano: alCementerio + alDestierro, destruidos: destruidos.length });
    for (const at of hicieron.reverse()) N.disparar(e, "haceDano", { uid: at, j: e.activo });
  },
  finCombate(e) {
    e.atacantes = [];
    e.bloqueos = {};
  },
  final(e) {
    e.fase = "finalizando";
    N.disparar(e, "faseFinal", { j: e.activo });
  },
  cierre(e) {
    N.expirar(e, "finTurno");
    if (e.turno > 0) N.robar(e, e.activo, 1);
    revisarDerrota(e);
    if (e.ganador !== null) return;
    if (e.jugadores[e.activo].mano.length > LIMITE_MANO) e.fase = "final";
    else flujo(e, "pasarTurno");
  },
  pasarTurno(e) {
    e.activo = N.rival(e.activo);
    e.turno += 1;
    e.fase = "agrupando";
    flujo(e, "agrupacion", "inicioVigilia", "vigilia");
  },
};

OPS.flujo = (e, p) => FLUJO[p.paso](e);

function aliadoEnLinea(e, uid, j) {
  return e.jugadores[j].defensa.includes(uid) || e.jugadores[j].ataque.includes(uid);
}

function fuerzaCombate(e, uid) {
  return N.fuerza(e, uid);
}

function irAFinal(e) {
  flujo(e, "final", "cierre");
}

function siguienteMulligan(e) {
  e.jugadores[e.turnoMulligan].mulliganListo = true;
  const otro = N.rival(e.turnoMulligan);
  if (!e.jugadores[otro].mulliganListo) {
    e.turnoMulligan = otro;
    return;
  }
  e.activo = e.inicial;
  e.fase = "agrupando";
  flujo(e, "agrupacion", "inicioVigilia", "vigilia");
}

function cambiarMano(e, j, n) {
  const p = e.jugadores[j];
  p.castillo.push(...p.mano.splice(0));
  N.barajar(e, p.castillo);
  N.robar(e, j, n);
}

function abrirVentana(e, item) {
  e.pila.push(item);
  if (!respuestas(e, N.rival(item.ctrl), item).length) item.cerrada = true;
}

function contarJugada(e, j, c) {
  const p = e.jugadores[j];
  p.jugadas[c.tipo] = (p.jugadas[c.tipo] ?? 0) + 1;
  p.jugadas.nombres[c.nombre] = (p.jugadas.nombres[c.nombre] ?? 0) + 1;
  if (["Aliado", "Arma", "Tótem"].includes(c.tipo)) p.jugadas.total += 1;
}

function jugar(e, j, accion) {
  const p = e.jugadores[j];
  const c = N.carta(e, accion.uid);
  const desde = accion.desde ?? "mano";
  const alt = desde === "cementerio" ? desdeCementerio(e, j, accion.uid) : {};
  const { coste, pagar } = costeDe(e, j, accion.uid);
  N.sacar(e, accion.uid);
  pagarOros(e, j, pagar);
  if (alt.botar) N.quitarDelCastillo(e, j, alt.botar, "cementerio");
  if (e.fase === "vigilia") p.otraJugada = true;
  if (e.fase === "talismanes") {
    e.pases = 0;
    e.prioridad = N.rival(e.prioridad);
  }
  contarJugada(e, j, c);
  const destierro = !!(c.destierroAlJugar || (alt.exhumado && c.tipo === "Talismán"));
  abrirVentana(e, { uid: accion.uid, ctrl: j, coste, portador: accion.portador, destierro, cerrada: false, anulado: false });
}

function responder(e, j, uid) {
  const c = N.carta(e, uid);
  const objetivo = e.pila.length - 1;
  e.pila[objetivo].cerrada = true;
  if (c.tipo === "Talismán") {
    const { coste, pagar } = costeDe(e, j, uid);
    N.sacar(e, uid);
    pagarOros(e, j, pagar);
    contarJugada(e, j, c);
    abrirVentana(e, { uid, ctrl: j, coste, objetivo, comoRespuesta: true, destierro: !!c.destierroAlJugar, cerrada: false, anulado: false });
    return;
  }
  pagarOros(e, j, c.respuestaMano.oros);
  N.mover(e, uid, "destierro");
  e.pila[objetivo].anulado = true;
}

function resolverPila(e) {
  const item = e.pila.pop();
  const c = N.carta(e, item.uid);
  const dueno = e.jugadores[N.dueno(item.uid)];
  if (item.anulado) {
    (item.destierro ? dueno.destierro : dueno.cementerio).push(item.uid);
    return;
  }
  if (c.tipo === "Talismán") {
    const pasos = item.comoRespuesta ? [{ op: "anular" }, ...(c.respuesta.pasos ?? [])] : c.talisman ?? [];
    const ctx = { ctrl: item.ctrl, fuente: item.uid, def: c.id, costeFuente: c.coste ?? 0, objetivoPila: item.objetivo };
    e.cola.unshift(N.nuevoFrame([...pasos, { op: "finTalisman", uid: item.uid, destierro: item.destierro }], ctx));
    return;
  }
  entrarEnJuego(e, item.uid, item.ctrl, item.portador);
}

function avanzar(e) {
  for (let guarda = 0; guarda < 10000; guarda++) {
    resolver(e);
    if (e.pendiente || e.ganador !== null) return;
    const top = e.pila.at(-1);
    if (!top) return;
    if (!top.cerrada) return;
    resolverPila(e);
  }
  throw new Error("avanzar no converge");
}

function usarHabilidad(e, j, accion) {
  const d = N.def(e, accion.def);
  const a = d.activadas[accion.h];
  e.usos[claveUso(e, j, accion.uid, d, accion.h, a)] = e.turno;
  pagarOros(e, j, (a.oros ?? 0) + N.impuestoHabilidad(e, j, accion.uid, "activada"));
  if (e.fase === "talismanes") {
    e.pases = 0;
    e.prioridad = N.rival(e.prioridad);
  }
  const ctx = { ctrl: j, fuente: accion.uid, def: d.id, costeFuente: d.coste ?? 0 };
  e.cola.unshift(N.nuevoFrame([...(a.coste ?? []), ...a.hacer], ctx));
}

export function aplicar(estado, accion) {
  const legales = accionesLegales(estado);
  if (!legales.some((a) => igual(a, accion))) {
    throw new Error(`Acción ilegal en fase ${estado.fase}: ${JSON.stringify(accion)}`);
  }
  const e = clonar(estado);
  const j = jugadorQueDecide(e);
  const p = e.jugadores[j];
  switch (accion.tipo) {
    case "elegir":
      elegir(e, e.pendiente.opciones[accion.i].valor);
      break;
    case "noResponder":
      e.pila.at(-1).cerrada = true;
      break;
    case "responder":
      responder(e, j, accion.uid);
      break;
    case "quedarse":
      siguienteMulligan(e);
      break;
    case "mulligan":
      cambiarMano(e, j, p.mano.length - 1);
      break;
    case "mulliganGratis":
      p.mulliganGratisUsado = true;
      cambiarMano(e, j, p.mano.length);
      break;
    case "oro":
      p.oroJugado = true;
      entrarOro(e, accion.uid, j, "reserva");
      break;
    case "jugar":
      jugar(e, j, accion);
      break;
    case "habilidad":
      usarHabilidad(e, j, accion);
      break;
    case "batalla":
      e.fase = "ataque";
      break;
    case "terminar":
      irAFinal(e);
      break;
    case "atacar":
      N.sacar(e, accion.uid);
      p.ataque.push(accion.uid);
      e.atacantes.push(accion.uid);
      p.declarados.push(accion.uid);
      p.atacoEsteTurno = true;
      N.disparar(e, "ataca", { uid: accion.uid, j });
      break;
    case "finAtaque":
      if (e.atacantes.length) e.fase = "bloqueo";
      else irAFinal(e);
      break;
    case "bloquear":
      e.bloqueos[accion.uid] = accion.atacante;
      break;
    case "finBloqueo":
      e.fase = "talismanes";
      e.prioridad = N.rival(e.activo);
      e.pases = 0;
      break;
    case "pasar":
      e.pases += 1;
      e.prioridad = N.rival(e.prioridad);
      if (e.pases >= 2) {
        e.fase = "danando";
        flujo(e, "dano", "finCombate", "final", "cierre");
      }
      break;
    case "descartar":
      N.mover(e, accion.uid, "cementerio");
      if (p.mano.length <= LIMITE_MANO) flujo(e, "pasarTurno");
      break;
  }
  avanzar(e);
  revisarDerrota(e);
  return e;
}
