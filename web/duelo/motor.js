import { CARTAS } from "./cartas-base.js";

export const LIMITE_MANO = 8;
export const MANO_INICIAL = 8;

function siguienteAzar(a) {
  const s = (a + 0x6d2b79f5) >>> 0;
  let t = s;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return { s, x: ((t ^ (t >>> 14)) >>> 0) / 4294967296 };
}

function azar(e) {
  const { s, x } = siguienteAzar(e.azar);
  e.azar = s;
  return x;
}

function barajar(e, lista) {
  for (let i = lista.length - 1; i > 0; i--) {
    const j = Math.floor(azar(e) * (i + 1));
    [lista[i], lista[j]] = [lista[j], lista[i]];
  }
}

function clonar(e) {
  const { catalogo, ...resto } = e;
  return { ...structuredClone(resto), catalogo };
}

export function carta(e, uid) {
  return e.catalogo[e.instancias[uid]];
}

export function fuerza(e, uid) {
  const base = carta(e, uid).fuerza;
  const arma = e.armas[uid];
  return base + (arma ? carta(e, arma).fuerza : 0);
}

function jugadorVacio() {
  return {
    castillo: [], mano: [], reserva: [], pagado: [], defensa: [], ataque: [], apoyo: [],
    cementerio: [], destierro: [], nuevos: [], oroJugado: false, otraJugada: false,
    mulliganListo: false, mulliganGratisUsado: false,
  };
}

function robar(e, j, n) {
  const p = e.jugadores[j];
  for (let i = 0; i < n && p.castillo.length; i++) p.mano.push(p.castillo.shift());
}

function oroDeInicio(e, ids) {
  const i = ids.findIndex((id) => e.catalogo[id].oroInicial);
  if (i >= 0) return i;
  return ids.findIndex((id) => e.catalogo[id].tipo === "Oro" && e.catalogo[id].sinHabilidad);
}

export function crearPartida({ semilla = 1, mazos, catalogo = CARTAS, inicial } = {}) {
  const e = {
    catalogo, azar: semilla >>> 0, instancias: {}, armas: {}, jugadores: [jugadorVacio(), jugadorVacio()],
    turno: 0, activo: 0, inicial: 0, fase: "mulligan", turnoMulligan: 0,
    atacantes: [], bloqueos: {}, prioridad: 0, pases: 0, ganador: null, registro: [],
  };
  mazos.forEach((ids, j) => {
    const lista = [...ids];
    const iOro = oroDeInicio(e, lista);
    const p = e.jugadores[j];
    lista.forEach((id, k) => {
      const uid = `${j}-${k}`;
      e.instancias[uid] = id;
      if (k === iOro) p.reserva.push(uid);
      else p.castillo.push(uid);
    });
    barajar(e, p.castillo);
  });
  e.inicial = inicial ?? (azar(e) < 0.5 ? 0 : 1);
  e.activo = e.inicial;
  e.turnoMulligan = e.inicial;
  robar(e, 0, MANO_INICIAL);
  robar(e, 1, MANO_INICIAL);
  return e;
}

const oponente = (j) => 1 - j;

function orosEnMano(e, j) {
  return e.jugadores[j].mano.filter((u) => carta(e, u).tipo === "Oro").length;
}

function puedePagar(e, j, uid) {
  return carta(e, uid).coste <= e.jugadores[j].reserva.length;
}

function aliadosEnJuego(p) {
  return [...p.defensa, ...p.ataque];
}

function jugadasDeMano(e, j, tipos) {
  const p = e.jugadores[j];
  const acciones = [];
  const vistos = new Set();
  for (const uid of p.mano) {
    const c = carta(e, uid);
    if (!tipos.includes(c.tipo) || !puedePagar(e, j, uid)) continue;
    const clave = c.id;
    if (vistos.has(clave)) continue;
    vistos.add(clave);
    if (c.tipo === "Arma") {
      for (const a of aliadosEnJuego(p)) if (!e.armas[a]) acciones.push({ tipo: "jugar", uid, portador: a });
    } else {
      acciones.push({ tipo: "jugar", uid });
    }
  }
  return acciones;
}

export function jugadorQueDecide(e) {
  if (e.ganador !== null) return null;
  if (e.fase === "mulligan") return e.turnoMulligan;
  if (e.fase === "bloqueo") return oponente(e.activo);
  if (e.fase === "talismanes") return e.prioridad;
  return e.activo;
}

export function accionesLegales(e) {
  if (e.ganador !== null) return [];
  const j = jugadorQueDecide(e);
  const p = e.jugadores[j];
  switch (e.fase) {
    case "mulligan": {
      const a = [{ tipo: "quedarse" }];
      if (p.mano.length > 1) a.push({ tipo: "mulligan" });
      if (!p.mulliganGratisUsado && orosEnMano(e, j) <= 1) a.push({ tipo: "mulliganGratis" });
      return a;
    }
    case "vigilia": {
      const a = [];
      if (!p.oroJugado && !p.otraJugada) {
        const vistos = new Set();
        for (const uid of p.mano) {
          const c = carta(e, uid);
          if (c.tipo === "Oro" && !vistos.has(c.id)) {
            vistos.add(c.id);
            a.push({ tipo: "oro", uid });
          }
        }
      }
      a.push(...jugadasDeMano(e, j, ["Aliado", "Arma", "Tótem", "Talismán"]));
      if (p.defensa.some((u) => !p.nuevos.includes(u))) a.push({ tipo: "batalla" });
      a.push({ tipo: "terminar" });
      return a;
    }
    case "ataque": {
      const a = p.defensa.filter((u) => !p.nuevos.includes(u)).map((uid) => ({ tipo: "atacar", uid }));
      a.push({ tipo: "finAtaque" });
      return a;
    }
    case "bloqueo": {
      const a = [];
      const bloqueados = new Set(Object.values(e.bloqueos));
      const bloqueadores = new Set(Object.keys(e.bloqueos));
      const libresAtacantes = e.atacantes.filter((u) => !bloqueados.has(u));
      for (const b of p.defensa) {
        if (bloqueadores.has(b)) continue;
        for (const at of libresAtacantes) a.push({ tipo: "bloquear", uid: b, atacante: at });
      }
      a.push({ tipo: "finBloqueo" });
      return a;
    }
    case "talismanes":
      return [...jugadasDeMano(e, j, ["Talismán"]), { tipo: "pasar" }];
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

function quitar(lista, uid) {
  const i = lista.indexOf(uid);
  if (i >= 0) lista.splice(i, 1);
  return i >= 0;
}

function pagar(e, j, coste) {
  const p = e.jugadores[j];
  p.pagado.push(...p.reserva.splice(0, coste));
}

function destruir(e, uid) {
  const j = Number(uid.split("-")[0]);
  const p = e.jugadores[j];
  quitar(p.defensa, uid) || quitar(p.ataque, uid);
  p.cementerio.push(uid);
  const arma = e.armas[uid];
  if (arma) {
    delete e.armas[uid];
    e.jugadores[Number(arma.split("-")[0])].cementerio.push(arma);
  }
}

function botar(e, j, n) {
  const p = e.jugadores[j];
  p.cementerio.push(...p.castillo.splice(0, n));
}

function revisarDerrota(e) {
  if (e.ganador !== null || e.fase === "mulligan") return;
  for (const j of [e.activo, oponente(e.activo)]) {
    if (e.jugadores[j].castillo.length === 0) {
      e.ganador = oponente(j);
      e.fase = "fin";
      return;
    }
  }
}

function empezarTurno(e, saltarAgrupacion) {
  const p = e.jugadores[e.activo];
  if (!saltarAgrupacion) {
    p.defensa.push(...p.ataque.splice(0));
    p.reserva.push(...p.pagado.splice(0));
    p.nuevos = [];
  }
  p.oroJugado = false;
  p.otraJugada = false;
  e.fase = "vigilia";
}

function terminarTurno(e) {
  e.activo = oponente(e.activo);
  e.turno += 1;
  empezarTurno(e, false);
}

function faseFinal(e) {
  e.fase = "final";
  e.atacantes = [];
  e.bloqueos = {};
  if (e.turno > 0) robar(e, e.activo, 1);
  revisarDerrota(e);
  if (e.ganador === null && e.jugadores[e.activo].mano.length <= LIMITE_MANO) terminarTurno(e);
}

function resolverCombate(e) {
  const def = oponente(e.activo);
  const bloqueadorDe = Object.fromEntries(Object.entries(e.bloqueos).map(([b, a]) => [a, b]));
  let dano = 0;
  const destruidos = [];
  for (const at of e.atacantes) {
    const b = bloqueadorDe[at];
    const fa = fuerza(e, at);
    if (!b) { dano += fa; continue; }
    const fb = fuerza(e, b);
    if (fa > fb) { destruidos.push(b); dano += fa - fb; }
    else if (fa === fb) destruidos.push(b, at);
    else destruidos.push(at);
  }
  destruidos.forEach((u) => destruir(e, u));
  botar(e, def, dano);
  e.registro.push({ turno: e.turno, dano, destruidos: destruidos.length });
  revisarDerrota(e);
  if (e.ganador === null) faseFinal(e);
}

function siguienteMulligan(e) {
  e.jugadores[e.turnoMulligan].mulliganListo = true;
  const otro = oponente(e.turnoMulligan);
  if (!e.jugadores[otro].mulliganListo) {
    e.turnoMulligan = otro;
    return;
  }
  e.activo = e.inicial;
  empezarTurno(e, true);
}

function cambiarMano(e, j, n) {
  const p = e.jugadores[j];
  p.castillo.push(...p.mano.splice(0));
  barajar(e, p.castillo);
  robar(e, j, n);
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
      quitar(p.mano, accion.uid);
      p.reserva.push(accion.uid);
      p.oroJugado = true;
      break;
    case "jugar": {
      const c = carta(e, accion.uid);
      quitar(p.mano, accion.uid);
      pagar(e, j, c.coste);
      if (e.fase === "vigilia") p.otraJugada = true;
      if (c.tipo === "Aliado") { p.defensa.push(accion.uid); p.nuevos.push(accion.uid); }
      else if (c.tipo === "Arma") e.armas[accion.portador] = accion.uid;
      else if (c.tipo === "Tótem") p.apoyo.push(accion.uid);
      else p.cementerio.push(accion.uid);
      if (e.fase === "talismanes") e.pases = 0;
      break;
    }
    case "batalla":
      e.fase = "ataque";
      break;
    case "terminar":
      faseFinal(e);
      break;
    case "atacar":
      quitar(p.defensa, accion.uid);
      p.ataque.push(accion.uid);
      e.atacantes.push(accion.uid);
      break;
    case "finAtaque":
      if (e.atacantes.length) e.fase = "bloqueo";
      else faseFinal(e);
      break;
    case "bloquear":
      e.bloqueos[accion.uid] = accion.atacante;
      break;
    case "finBloqueo":
      e.fase = "talismanes";
      e.prioridad = oponente(e.activo);
      e.pases = 0;
      break;
    case "pasar":
      e.pases += 1;
      e.prioridad = oponente(e.prioridad);
      if (e.pases >= 2) resolverCombate(e);
      break;
    case "descartar":
      quitar(p.mano, accion.uid);
      p.cementerio.push(accion.uid);
      if (p.mano.length <= LIMITE_MANO) terminarTurno(e);
      break;
  }
  if (accion.tipo === "jugar" && e.fase === "talismanes") e.prioridad = oponente(e.prioridad);
  revisarDerrota(e);
  return e;
}
