export const ZONAS = ["castillo", "mano", "reserva", "pagado", "defensa", "ataque", "apoyo", "cementerio", "destierro"];
export const EN_JUEGO = ["reserva", "pagado", "defensa", "ataque", "apoyo"];
export const FUERA = ["castillo", "mano", "cementerio", "destierro"];

export const dueno = (uid) => Number(uid.split("-")[0]);
export const rival = (j) => 1 - j;

const VACIO = { claves: [], continuas: [], disparadas: [], activadas: [], fns: {} };

export function def(e, id) {
  return { ...VACIO, ...e.catalogo[id] };
}

export function carta(e, uid) {
  const b = def(e, e.instancias[uid]);
  const c = e.conv[uid];
  return c ? { ...b, tipo: c.tipo, fuerza: c.fuerza ?? b.fuerza, coste: c.coste ?? b.coste, sinHabilidad: c.sinHabilidad || b.sinHabilidad } : b;
}

export function azar(e) {
  const s = (e.azar + 0x6d2b79f5) >>> 0;
  e.azar = s;
  let t = s;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

export function barajar(e, lista) {
  for (let i = lista.length - 1; i > 0; i--) {
    const j = Math.floor(azar(e) * (i + 1));
    [lista[i], lista[j]] = [lista[j], lista[i]];
  }
}

export function portadorDe(e, uid) {
  for (const [p, lista] of Object.entries(e.armas)) if (lista.includes(uid)) return p;
  return null;
}

export function ubicar(e, uid) {
  for (const j of [0, 1]) {
    for (const z of ZONAS) if (e.jugadores[j][z].includes(uid)) return { j, zona: z };
  }
  const p = portadorDe(e, uid);
  if (p) return { j: ubicar(e, p).j, zona: "arma", portador: p };
  return null;
}

export function enJuego(e, uid) {
  const u = ubicar(e, uid);
  return !!u && (EN_JUEGO.includes(u.zona) || u.zona === "arma");
}

export function controlador(e, uid) {
  const u = ubicar(e, uid);
  return u && (EN_JUEGO.includes(u.zona) || u.zona === "arma") ? u.j : dueno(uid);
}

export const aliadosDe = (e, j) => [...e.jugadores[j].defensa, ...e.jugadores[j].ataque];
export const orosDe = (e, j) => [...e.jugadores[j].reserva, ...e.jugadores[j].pagado];
export const armasDe = (e, j) => aliadosDe(e, j).flatMap((a) => e.armas[a] ?? []);
export const enJuegoDe = (e, j) => [...aliadosDe(e, j), ...e.jugadores[j].apoyo, ...orosDe(e, j), ...armasDe(e, j)];
export const todoEnJuego = (e) => [...enJuegoDe(e, e.activo), ...enJuegoDe(e, rival(e.activo))];

function efectoSobre(f, e, uid) {
  return f.uid === uid || (f.nombre && f.nombre === carta(e, uid).nombre);
}

function noPuedePerder(e, uid, prof) {
  const c = carta(e, uid);
  if (c.claves.includes("NoPierdeHabilidad")) return true;
  if (c.tipo !== "Aliado") return false;
  const j = controlador(e, uid);
  return [...orosDe(e, j), ...e.jugadores[j].apoyo, ...aliadosDe(e, j)].some(
    (x) => x !== uid && carta(e, x).continuas?.some((k) => k.aliadosNoPierden) && activa(e, x, prof + 1),
  );
}

export function activa(e, uid, prof = 0) {
  const c = carta(e, uid);
  if (c.sinHabilidad) return false;
  if (prof > 3) return true;
  if (!enJuego(e, uid)) {
    const u = ubicar(e, uid);
    if (u?.zona === "cementerio" && hay(e, u.j, (k, propio) => !propio && k.cementerioRivalSinHabilidad)) return false;
    return true;
  }
  if (noPuedePerder(e, uid, prof)) return true;
  if (e.efectos.some((f) => f.tipo === "pierdeHabilidad" && efectoSobre(f, e, uid))) return false;
  if (c.tipo === "Oro") {
    const j = controlador(e, uid);
    if (aliadosDe(e, rival(j)).some((a) => carta(e, a).continuas.some((k) => k.orosRivalSinHabilidad) && activa(e, a, prof + 1))) return false;
    for (const k of [0, 1]) {
      for (const o of e.jugadores[k].reserva) {
        if (o === uid) continue;
        const d = carta(e, o);
        const silencia = d.continuas.some((x) => x.otrosOrosSinHabilidad && (!x.si || d.fns[x.si](e, { ctrl: k, fuente: o, def: d.id })));
        if (silencia && activa(e, o, prof + 1)) return false;
      }
    }
  }
  return true;
}

export function habilidades(e, uid) {
  const conv = e.conv[uid];
  const lista = [];
  if (conv?.como) lista.push(def(e, conv.como));
  else if (activa(e, uid)) lista.push(carta(e, uid));
  for (const id of e.ganadas[uid] ?? []) if (activa(e, uid) || conv) lista.push(def(e, id));
  return lista;
}

export function* continuas(e) {
  for (const uid of todoEnJuego(e)) {
    const j = controlador(e, uid);
    for (const d of habilidades(e, uid)) {
      for (const k of d.continuas) {
        if (k.si && !d.fns[k.si](e, { ctrl: j, fuente: uid, def: d.id })) continue;
        if (k.zona && !e.jugadores[j][k.zona].includes(uid)) continue;
        yield { uid, j, k, d };
      }
    }
  }
}

function alcanza(e, a, fuente, jFuente, objetivo) {
  if (a === "aliados") return true;
  if (a === "tusAliados") return controlador(e, objetivo) === jFuente;
  if (a === "aliadosRival") return controlador(e, objetivo) !== jFuente;
  if (a === "tusDemasAliados") return controlador(e, objetivo) === jFuente && objetivo !== fuente;
  if (a === "demasAliados") return objetivo !== fuente;
  if (a === "propia") return objetivo === fuente;
  return false;
}

function filtraObjetivo(e, k, uid) {
  const c = carta(e, uid);
  if (k.raza && !(c.razas ?? []).includes(k.raza)) return false;
  if (k.costeMin !== undefined && (c.coste ?? 0) < k.costeMin) return false;
  if (k.costeMax !== undefined && (c.coste ?? 0) > k.costeMax) return false;
  return true;
}

export function claves(e, uid) {
  const s = new Set();
  for (const d of habilidades(e, uid)) d.claves.forEach((k) => s.add(k));
  for (const a of e.armas[uid] ?? []) if (activa(e, a)) (carta(e, a).portador?.claves ?? []).forEach((k) => s.add(k));
  if (carta(e, uid).tipo === "Aliado") {
    for (const { uid: f, j, k } of continuas(e)) if (k.gana && alcanza(e, k.a, f, j, uid) && filtraObjetivo(e, k, uid)) s.add(k.gana);
  }
  for (const f of e.efectos) if (f.tipo === "gana" && (f.uid === uid || (f.aliadosDe !== undefined && controlador(e, uid) === f.aliadosDe))) s.add(f.clave);
  return s;
}

export const tiene = (e, uid, k) => claves(e, uid).has(k);

export function fuerza(e, uid) {
  const c = carta(e, uid);
  let f = c.fuerza ?? 0;
  for (const a of e.armas[uid] ?? []) if (activa(e, a)) f += carta(e, a).portador?.fuerza ?? 0;
  for (const { uid: fu, j, k, d } of continuas(e)) {
    if (!alcanza(e, k.a, fu, j, uid) || !filtraObjetivo(e, k, uid)) continue;
    if (k.fuerza) f += k.fuerza;
    if (k.fuerzaPor) f += d.fns[k.fuerzaPor](e, { ctrl: j, fuente: fu, def: d.id, objetivo: uid });
  }
  for (const j of [0, 1]) {
    for (const x of e.jugadores[j].cementerio) {
      const cc = carta(e, x).continuasCementerio;
      if (!cc?.length || !activa(e, x)) continue;
      for (const k of cc) {
        if (k.fuerza && (c.coste ?? 0) <= k.costeMax && (!k.conClave || tiene(e, uid, k.conClave))) f += k.fuerza;
      }
    }
  }
  for (const ef of e.efectos) if (ef.tipo === "fuerza" && ef.uid === uid) f += ef.n;
  return Math.max(0, f);
}

export function hay(e, j, pred) {
  for (const { j: jj, k } of continuas(e)) if (pred(k, jj === j)) return true;
  return false;
}

export function cuantas(e, j, pred) {
  let n = 0;
  for (const { j: jj, k } of continuas(e)) if (pred(k, jj === j)) n += 1;
  return n;
}

export function puedeSalir(e, uid) {
  if (!enJuego(e, uid)) return true;
  if (tiene(e, uid, "NoSale")) return false;
  return !e.efectos.some((f) => f.tipo === "noSale" && f.uid === uid);
}

export function puedeTomar(e, uid, j) {
  if (dueno(uid) !== j && hay(e, j, (k) => k.noTomarControl)) return false;
  if (!enJuego(e, uid) || controlador(e, uid) === j) return true;
  if (carta(e, uid).tipo === "Aliado") {
    if (hay(e, controlador(e, uid), (k, propio) => propio && k.aliadosNoCambian)) return false;
    if (tiene(e, uid, "Furia") && hay(e, controlador(e, uid), (k, propio) => propio && k.furiaNoCambia)) return false;
    if (e.efectos.some((f) => f.tipo === "noCambia" && f.uid === uid)) return false;
    if ((e.armas[uid] ?? []).some((a) => activa(e, a) && carta(e, a).portador?.noCambia)) return false;
  }
  return true;
}

export function agregarEfecto(e, efecto, ctrl) {
  const fin = efecto.fin ?? "turno";
  let f;
  if (fin === "turno") f = { finTurno: e.turno };
  else if (fin === "dosTurnos") f = { finTurno: e.turno + 1 };
  else if (fin === "proximoTurno") f = { inicioDe: ctrl, desde: e.turno };
  else if (fin === "turnoRival") f = { finTurno: e.activo === ctrl ? e.turno + 1 : e.turno };
  else f = { [fin]: true };
  e.efectos.push({ ...efecto, fin: f });
}

export function expirar(e, momento) {
  e.efectos = e.efectos.filter((f) => {
    if (momento === "finTurno" && f.fin.finTurno !== undefined) return f.fin.finTurno > e.turno;
    if (momento === "inicio" && f.fin.inicioDe !== undefined) return !(f.fin.inicioDe === e.activo && e.turno > f.fin.desde);
    if (f.fin.mientras) return enJuego(e, f.uid);
    return true;
  });
  for (const [uid, c] of Object.entries(e.conv)) {
    if (momento === "inicio" && c.hastaInicioDe === e.activo && e.turno > c.desde) revertir(e, uid);
  }
}

function revertir(e, uid) {
  const c = e.conv[uid];
  delete e.conv[uid];
  if (!enJuego(e, uid) || !c.vuelve) return;
  const j = controlador(e, uid);
  sacar(e, uid);
  e.jugadores[j][c.vuelve].push(uid);
  if (c.vuelve === "defensa") e.jugadores[j].nuevos.push(uid);
}

export function sacar(e, uid) {
  for (const p of e.jugadores) {
    for (const z of ZONAS) {
      const i = p[z].indexOf(uid);
      if (i >= 0) p[z].splice(i, 1);
    }
  }
  const p = portadorDe(e, uid);
  if (p) {
    e.armas[p] = e.armas[p].filter((x) => x !== uid);
    if (!e.armas[p].length) delete e.armas[p];
  }
}

export function mover(e, uid, zona, { j, fondo = false } = {}) {
  const u = ubicar(e, uid);
  const sale = u && (EN_JUEGO.includes(u.zona) || u.zona === "arma") && FUERA.includes(zona);
  const defsSalida = sale ? habilidades(e, uid) : [];
  const ctrlAntes = u?.j;
  sacar(e, uid);
  if (sale) {
    delete e.conv[uid];
    delete e.ganadas[uid];
    const armas = e.armas[uid] ?? [];
    delete e.armas[uid];
    for (const a of armas) e.jugadores[dueno(a)].cementerio.push(a);
    for (const p of e.jugadores) p.nuevos = p.nuevos.filter((x) => x !== uid);
  }
  const destino = FUERA.includes(zona) ? dueno(uid) : j ?? ctrlAntes ?? dueno(uid);
  const lista = e.jugadores[destino][zona];
  if (zona === "castillo" && !fondo) lista.unshift(uid);
  else lista.push(uid);
  if (sale) {
    dispararSalida(e, uid, defsSalida, ctrlAntes);
    disparar(e, "saleDelJuego", { uid, j: ctrlAntes, tipo: carta(e, uid).tipo });
  }
  if (zona === "cementerio") disparar(e, "alCementerio", { uid, j: dueno(uid) });
}

export function robar(e, j, n) {
  const p = e.jugadores[j];
  for (let i = 0; i < n && p.castillo.length; i++) p.mano.push(p.castillo.shift());
}

function limiteCastillo(e, j, n) {
  if (!e.efectos.some((f) => f.tipo === "limiteCastillo")) return n;
  const p = e.jugadores[j];
  return Math.max(0, Math.min(n, 10 - p.salidasCastillo));
}

export function quitarDelCastillo(e, j, n, zona, fondo = false, porDano = false) {
  const p = e.jugadores[j];
  if (zona === "cementerio" && n === 1 && hay(e, j, (k, propio) => !propio && k.botarUnoEsDos)) n = 2;
  const k = limiteCastillo(e, j, n);
  const cartas = fondo ? p.castillo.splice(Math.max(0, p.castillo.length - k), k) : p.castillo.splice(0, k);
  p[zona].push(...cartas);
  p.salidasCastillo += cartas.length;
  if (cartas.length) disparar(e, "salenDelCastillo", { j, uids: cartas, zona, porDano });
  return cartas.length;
}

export function barajarCastillo(e, j) {
  barajar(e, e.jugadores[j].castillo);
}

export function nuevoFrame(pasos, ctx) {
  return { pasos: [...pasos], i: 0, ctx: { vars: {}, ...ctx } };
}

export function impuestoHabilidad(e, ctrl, uid, tipo) {
  let n = 0;
  const c = carta(e, uid);
  const fuera = !enJuego(e, uid);
  if ((fuera || (c.coste ?? 0) === 0) && hay(e, ctrl, (k, propio) => !propio && k.rivalImpuestoCoste0)) n += 1;
  if (tipo === "disparada" && e.efectos.some((f) => f.tipo === "disparadasCuestan" && f.j === ctrl)) n += 1;
  return n;
}

function silenciada(e, uid, evento, datos) {
  if (evento !== "entra" || datos.uid !== uid) return false;
  const c = carta(e, uid);
  if (c.tipo !== "Aliado") return false;
  return hay(e, 0, (k) => k.silenciaEntradaCosteMax !== undefined && (c.coste ?? 0) <= k.silenciaEntradaCosteMax);
}

function framesDe(e, uid, defs, evento, datos, ctrl) {
  const frames = [];
  if (silenciada(e, uid, evento, datos)) return frames;
  for (const d of defs) {
    d.disparadas.forEach((t, indice) => {
      if (!t.cuando.includes(evento)) return;
      const quien = t.quien ?? (["entra", "ataca", "sale", "haceDano"].includes(evento) ? "propia" : "yo");
      if (quien === "propia" && datos.uid !== uid) return;
      if (quien === "yo" && datos.j !== ctrl) return;
      if (quien === "rival" && datos.j === ctrl) return;
      if (quien === "otra" && datos.uid === uid) return;
      const ctx = { ctrl, fuente: uid, def: d.id, costeFuente: d.coste ?? 0, datos };
      if (t.si && !d.fns[t.si](e, ctx)) return;
      if (t.veces) {
        const clave = `${uid}|${d.id}|d${indice}`;
        const uso = e.usos[clave];
        const n = uso?.turno === e.turno ? uso.n : 0;
        if (n >= t.veces) return;
        e.usos[clave] = { turno: e.turno, n: n + 1 };
      }
      let pasos = t.hacer;
      if (t.opcional) pasos = [{ op: "opcional", texto: `${d.nombre}`, pasos }];
      const imp = impuestoHabilidad(e, ctrl, uid, "disparada");
      if (imp) pasos = [{ op: "opcional", texto: `${d.nombre} (paga ${imp})`, pagar: imp, pasos }];
      frames.push(nuevoFrame(pasos, ctx));
    });
  }
  return frames;
}

export function disparar(e, evento, datos = {}) {
  const frames = [];
  for (const j of [e.activo, rival(e.activo)]) {
    for (const uid of enJuegoDe(e, j)) frames.push(...framesDe(e, uid, habilidades(e, uid), evento, datos, j));
    for (const z of ["mano", "cementerio"]) {
      for (const uid of e.jugadores[j][z]) {
        const d = carta(e, uid);
        if (d.sinHabilidad) continue;
        const fuera = { ...d, disparadas: d.disparadas.filter((t) => t.zona?.includes(z) && t.cuando.includes(evento)) };
        if (fuera.disparadas.length && activa(e, uid)) frames.push(...framesDe(e, uid, [fuera], evento, datos, j));
      }
    }
  }
  e.cola.unshift(...frames);
}

function dispararSalida(e, uid, defs, ctrl) {
  e.cola.unshift(...framesDe(e, uid, defs, "sale", { uid, j: ctrl }, ctrl));
}
