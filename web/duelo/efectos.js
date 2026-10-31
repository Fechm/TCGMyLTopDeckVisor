import * as N from "./nucleo.js";

export const OPS = {};

const jugadorDe = (ctx, quien) => (quien === "rival" ? N.rival(ctx.ctrl) : ctx.ctrl);

const ALIAS = {
  aliados: N.aliadosDe,
  oros: N.orosDe,
  armas: N.armasDe,
  enJuego: N.enJuegoDe,
};

export function fuente(e, ctx, spec) {
  if (spec === "fuente") return [ctx.fuente];
  if (spec.startsWith("var:")) return [...(ctx.vars[spec.slice(4)] ?? [])];
  const [quien, zona] = spec.split(":");
  const js = quien === "todos" ? [ctx.ctrl, N.rival(ctx.ctrl)] : [jugadorDe(ctx, quien)];
  return js.flatMap((j) => (ALIAS[zona] ? ALIAS[zona](e, j) : e.jugadores[j][zona]));
}

export function limiteArmas(e, aliado) {
  const j = N.controlador(e, aliado);
  if (N.hay(e, j, (k, propio) => propio && k.armasSinLimite)) return Infinity;
  return 1 + (N.hay(e, j, (k, propio) => propio && k.armaAdicional) ? 1 : 0);
}

export function armaCabe(e, aliado, arma) {
  if (N.tiene(e, aliado, "NoPortaArmas")) return false;
  const req = N.carta(e, arma).portadorSi;
  if (req) {
    const p = N.carta(e, aliado);
    if (req.raza && !(p.razas ?? []).includes(req.raza)) return false;
    if (req.fuerzaMin !== undefined && N.fuerza(e, aliado) < req.fuerzaMin) return false;
    if (req.fuerzaMax !== undefined && N.fuerza(e, aliado) > req.fuerzaMax) return false;
  }
  if (N.carta(e, arma).claves.includes("NoCuentaLimite")) return true;
  const usadas = (e.armas[aliado] ?? []).filter((a) => !N.carta(e, a).claves.includes("NoCuentaLimite")).length;
  return usadas < limiteArmas(e, aliado);
}

export function cumple(e, ctx, uid, f = {}, para) {
  const c = N.carta(e, uid);
  const coste = c.coste ?? 0;
  if (f.tipo && ![].concat(f.tipo).includes(c.tipo)) return false;
  if (f.noTipo && f.noTipo.includes(c.tipo)) return false;
  if (f.costeMax !== undefined && coste > f.costeMax) return false;
  if (f.costeMin !== undefined && coste < f.costeMin) return false;
  if (f.conHabilidad && c.sinHabilidad) return false;
  if (f.noFuente && uid === ctx.fuente) return false;
  if (f.excluir && f.excluir.includes(uid)) return false;
  if (f.zona && N.ubicar(e, uid)?.zona !== f.zona) return false;
  if (f.armaLibre && !armaCabe(e, uid, f.armaLibre)) return false;
  if (f.f && !N.def(e, ctx.def).fns[f.f](e, ctx, uid)) return false;
  const zona = N.ubicar(e, uid)?.zona;
  if (zona && zona !== "castillo" && zona !== "mano") {
    const pr = N.proteccionContra(e, uid, ctx);
    if (pr.inmune) return false;
    if (pr.cuesta && pr.cuesta > disponibles(e, ctx.ctrl)) return false;
    if (para === "convertir" && N.tiene(e, uid, "NoConvertible")) return false;
  }
  if (N.enJuego(e, uid)) {
    if (para === "destruir" && N.tiene(e, uid, "Indestructible")) return false;
    if (para === "desterrar" && N.tiene(e, uid, "Indesterrable")) return false;
    if (ctx.costeFuente === 1 && N.tiene(e, uid, "ProtegidoCoste1")) return false;
    if (para === "tomar" && !N.puedeTomar(e, uid, ctx.ctrl)) return false;
  }
  return true;
}

export function hayObjetivo(e, ctx, req) {
  return [...new Set(req.de.flatMap((s) => fuente(e, ctx, s)))].some((u) => cumple(e, ctx, u, req.filtro, req.para));
}

function cantidad(e, p, ctx) {
  if (p.nf) return N.def(e, ctx.def).fns[p.nf](e, ctx);
  return p.n ?? 1;
}

function cobrarProteccion(e, ctx, uids) {
  for (const u of uids) {
    const { cuesta } = N.proteccionContra(e, u, ctx);
    if (cuesta) pagarOros(e, ctx.ctrl, cuesta);
  }
}

function candidatos(e, p, ctx) {
  const ya = ctx.vars[p.como];
  const todos = p.de.flatMap((s) => fuente(e, ctx, s));
  return [...new Set(todos)].filter((u) => !ya.includes(u) && cumple(e, ctx, u, p.filtro, p.para));
}

const PRIVADAS = ["castillo"];

function pedir(e, p, fr) {
  const ctx = fr.ctx;
  const ya = ctx.vars[p.como];
  const n = cantidad(e, p, ctx);
  if (ya.length >= n) return;
  const cands = candidatos(e, p, ctx);
  if (!cands.length) return;
  if (p.azar) {
    const u = cands[Math.floor(N.azar(e) * cands.length)];
    cobrarProteccion(e, ctx, [u]);
    ya.push(u);
    return pedir(e, p, fr);
  }
  const buscar = p.de.some((s) => PRIVADAS.includes(s.split(":")[1]));
  if (!p.hasta && !buscar && cands.length <= n - ya.length) {
    cobrarProteccion(e, ctx, cands);
    ya.push(...cands);
    return;
  }
  const vistos = new Set();
  const opciones = [];
  for (const u of cands) {
    const clave = buscar ? N.dueno(u) + e.instancias[u] : u;
    if (vistos.has(clave)) continue;
    vistos.add(clave);
    opciones.push({ valor: u });
  }
  if (p.hasta || buscar) opciones.push({ valor: null });
  e.pendiente = { jugador: jugadorDe(ctx, p.quien), opciones, cont: { op: "sel", p } };
}

OPS.sel = (e, p, fr) => {
  fr.ctx.vars[p.como] = [];
  const buscaAliado = p.de.some((s) => s === "yo:castillo" || s === "todos:castillo") && (!p.filtro?.tipo || [].concat(p.filtro.tipo).includes("Aliado"));
  if (buscaAliado && fr.buscoEn !== fr.i) {
    fr.buscoEn = fr.i;
    N.disparar(e, "busca", { j: fr.ctx.ctrl, tipo: "Aliado" });
    if (e.cola[0] !== fr) {
      fr.i -= 1;
      return;
    }
  }
  pedir(e, p, fr);
};
OPS.sel.elegir = (e, cont, valor, fr) => {
  if (valor === null) return;
  cobrarProteccion(e, fr.ctx, [valor]);
  fr.ctx.vars[cont.p.como].push(valor);
  pedir(e, cont.p, fr);
};

export function entrarOro(e, uid, j, zona) {
  N.mover(e, uid, zona, { j });
  const p = e.jugadores[j];
  p.orosPuestos += 1;
  N.disparar(e, "rivalPoneOro", { j, n: p.orosPuestos });
  N.disparar(e, "entra", { uid, j });
}

export function entrarEnJuego(e, uid, j, portador, datos = {}) {
  const c = N.carta(e, uid);
  if (c.tipo === "Aliado") {
    N.mover(e, uid, "defensa", { j });
    e.jugadores[j].nuevos.push(uid);
  } else if (c.tipo === "Arma") {
    if (!portador || !N.enJuego(e, portador) || !armaCabe(e, portador, uid)) {
      N.mover(e, uid, "cementerio");
      return;
    }
    N.sacar(e, uid);
    (e.armas[portador] ??= []).push(uid);
  } else if (c.tipo === "Tótem") {
    N.mover(e, uid, "apoyo", { j });
  } else if (c.tipo === "Oro") {
    return entrarOro(e, uid, j, "reserva");
  }
  N.disparar(e, "entra", { uid, j, ...datos });
}

function indesterrableCementerio(e, uid) {
  const u = N.ubicar(e, uid);
  if (u?.zona !== "cementerio") return false;
  const c = N.carta(e, uid);
  if (!c.sinHabilidad && c.claves.includes("IndesterrableCementerio")) return true;
  return N.hay(e, u.j, (k, propio) => propio && k.cementerioIndesterrable && (!k.cementerioIndesterrable.conClave || c.claves.includes(k.cementerioIndesterrable.conClave)));
}

function noBarajable(e, uid) {
  if (N.tiene(e, uid, "NoBarajable")) return true;
  return N.carta(e, uid).tipo === "Aliado" && N.hay(e, N.controlador(e, uid), (k, propio) => propio && k.aliadosNoBarajables);
}

function sePuedeBarajar(e, uid, ctx) {
  const u = N.ubicar(e, uid);
  if (u?.zona !== "cementerio") return true;
  if (N.hay(e, u.j, (k, propio) => !propio && k.cementerioRivalNoBaraja)) return false;
  const limite = N.hay(e, 0, (k) => k.limiteBarajarCementerio);
  if (!limite) return true;
  const p = e.jugadores[ctx.ctrl];
  if ((p.barajadasCementerio ?? 0) >= 3) return false;
  p.barajadasCementerio = (p.barajadasCementerio ?? 0) + 1;
  return true;
}

function moverA(e, uid, a, ctx) {
  const dentro = N.enJuego(e, uid);
  if (dentro && !["pagado", "reserva"].includes(a) && !N.puedeSalir(e, uid)) return;
  switch (a) {
    case "destruir":
      if (dentro && !N.tiene(e, uid, "Indestructible")) N.mover(e, uid, "cementerio");
      break;
    case "desterrar":
      if (dentro && N.tiene(e, uid, "Indesterrable")) break;
      if (!dentro && indesterrableCementerio(e, uid)) break;
      N.mover(e, uid, "destierro");
      break;
    case "barajar":
      if (!sePuedeBarajar(e, uid, ctx) || (dentro && noBarajable(e, uid))) break;
      N.mover(e, uid, "castillo");
      N.barajarCastillo(e, N.dueno(uid));
      break;
    case "fondo":
      N.mover(e, uid, "castillo", { fondo: true });
      break;
    case "pagado":
    case "reserva":
      if (!dentro && !N.puedeTomar(e, uid, ctx.ctrl)) break;
      if (!dentro && N.carta(e, uid).tipo === "Oro") entrarOro(e, uid, ctx.ctrl, a);
      else N.mover(e, uid, a, { j: dentro ? N.controlador(e, uid) : ctx.ctrl });
      break;
    default:
      N.mover(e, uid, a);
  }
}

function limiteSalidas(e, ctx) {
  const salidas = [0, 0];
  return (uid) => {
    if (!N.enJuego(e, uid) || N.carta(e, uid).tipo !== "Aliado") return true;
    const j = N.controlador(e, uid);
    if (j === ctx.ctrl || !N.hay(e, j, (k, propio) => propio && k.maxSalidasPorEfecto)) return true;
    if (salidas[j] >= 2) return false;
    salidas[j] += 1;
    return true;
  };
}

OPS.mover = (e, p, fr) => {
  const permite = limiteSalidas(e, fr.ctx);
  for (const uid of fr.ctx.vars[p.var] ?? []) if (permite(uid)) moverA(e, uid, p.a, fr.ctx);
};

OPS.convertir = (e, p, fr) => {
  const ctx = fr.ctx;
  for (const uid of fr.ctx.vars[p.var] ?? []) {
    if (!N.puedeTomar(e, uid, ctx.ctrl)) continue;
    if (N.enJuego(e, uid) && N.tiene(e, uid, "NoConvertible")) continue;
    for (const a of e.armas[uid] ?? []) N.mover(e, a, "cementerio");
    delete e.armas[uid];
    delete e.ganadas[uid];
    N.mover(e, uid, p.a, { j: ctx.ctrl });
    for (const pj of e.jugadores) pj.nuevos = pj.nuevos.filter((x) => x !== uid);
    e.conv[uid] = { tipo: p.en, fuerza: p.fuerza, coste: p.coste, sinHabilidad: !p.como, como: p.como };
    if (p.hasta) Object.assign(e.conv[uid], { hastaInicioDe: ctx.ctrl, desde: e.turno, vuelve: p.vuelve });
    if (p.en === "Aliado") e.jugadores[ctx.ctrl].nuevos.push(uid);
    if (p.en === "Oro") {
      const pj = e.jugadores[ctx.ctrl];
      pj.orosPuestos += 1;
      N.disparar(e, "rivalPoneOro", { j: ctx.ctrl, n: pj.orosPuestos });
    }
  }
};

OPS.tope = (e, p, fr) => {
  const c = e.jugadores[jugadorDe(fr.ctx, p.quien)].castillo;
  const n = cantidad(e, p, fr.ctx);
  fr.ctx.vars[p.como] = p.fondo ? c.slice(Math.max(0, c.length - n)) : c.slice(0, n);
};

OPS.mostrarHasta = (e, p, fr) => {
  const c = e.jugadores[fr.ctx.ctrl].castillo;
  const hallados = [];
  const tipos = [...(p.tipos ?? [])];
  for (const u of c) {
    const k = N.carta(e, u);
    if (p.tipos) {
      const i = tipos.indexOf(k.tipo);
      if (i >= 0) { tipos.splice(i, 1); hallados.push(u); }
      if (!tipos.length) break;
    } else if (cumple(e, fr.ctx, u, p.filtro) && !(p.distintoNombre && hallados.some((h) => N.carta(e, h).nombre === k.nombre))) {
      hallados.push(u);
      if (hallados.length >= p.n) break;
    }
  }
  fr.ctx.vars[p.como] = hallados;
};

OPS.robar = (e, p, fr) => N.robar(e, jugadorDe(fr.ctx, p.quien), cantidad(e, p, fr.ctx), true);

OPS.robarHasta = (e, p, fr) => {
  const opciones = Array.from({ length: p.n + 1 }, (_, i) => ({ valor: i }));
  e.pendiente = { jugador: fr.ctx.ctrl, opciones, cont: { op: "robarHasta", p } };
};
OPS.robarHasta.elegir = (e, cont, valor, fr) => N.robar(e, fr.ctx.ctrl, valor);

OPS.botar = (e, p, fr) => N.quitarDelCastillo(e, jugadorDe(fr.ctx, p.quien), cantidad(e, p, fr.ctx), "cementerio");

OPS.desterrarTope = (e, p, fr) => N.quitarDelCastillo(e, jugadorDe(fr.ctx, p.quien), cantidad(e, p, fr.ctx), "destierro", p.fondo);

OPS.barajarCastillo = (e, p, fr) => N.barajarCastillo(e, jugadorDe(fr.ctx, p.quien));

OPS.efecto = (e, p, fr) => {
  const base = { ...p.efecto, fin: p.fin };
  if (p.jugador) base.j = jugadorDe(fr.ctx, p.jugador);
  if (p.var) for (const uid of fr.ctx.vars[p.var] ?? []) N.agregarEfecto(e, { ...base, uid }, fr.ctx.ctrl);
  else N.agregarEfecto(e, base, fr.ctx.ctrl);
};

function requisito(e, ctx, r) {
  if (!r) return true;
  if (typeof r === "string") return N.def(e, ctx.def).fns[r](e, ctx);
  return hayObjetivo(e, ctx, r);
}

function pedirModo(e, p, fr, elegidos) {
  const libres = p.opciones.map((o, i) => i).filter((i) => !elegidos.includes(i) && requisito(e, fr.ctx, p.opciones[i].requiere));
  const n = p.n ?? 1;
  if (elegidos.length >= n || !libres.length) {
    fr.pasos.splice(fr.i, 0, ...elegidos.flatMap((i) => p.opciones[i].pasos));
    return;
  }
  const opciones = libres.map((i) => ({ valor: i, texto: p.opciones[i].texto }));
  if (p.hasta || elegidos.length) opciones.push({ valor: null, texto: "listo" });
  e.pendiente = { jugador: fr.ctx.ctrl, opciones, cont: { op: "modo", p, elegidos } };
}

OPS.modo = (e, p, fr) => pedirModo(e, p, fr, []);
OPS.modo.elegir = (e, cont, valor, fr) => {
  if (valor === null) return pedirModo(e, { ...cont.p, n: cont.elegidos.length }, fr, cont.elegidos);
  pedirModo(e, cont.p, fr, [...cont.elegidos, valor]);
};

OPS.opcional = (e, p, fr) => {
  const pagar = p.pagar ?? 0;
  if (pagar > e.jugadores[fr.ctx.ctrl].reserva.length) return;
  if (p.requiere && !requisito(e, fr.ctx, p.requiere)) return;
  e.pendiente = { jugador: fr.ctx.ctrl, opciones: [{ valor: true, texto: p.texto }, { valor: false, texto: "no" }], cont: { op: "opcional", p } };
};
OPS.opcional.elegir = (e, cont, valor, fr) => {
  if (!valor) return;
  pagarOros(e, fr.ctx.ctrl, cont.p.pagar ?? 0);
  fr.pasos.splice(fr.i, 0, ...cont.p.pasos);
};

function sirve(g, carta) {
  const c = typeof carta === "object" && carta ? carta : { tipo: carta };
  if (g.tipos && !(c.tipo && g.tipos.includes(c.tipo))) return false;
  if (g.costeMin !== undefined && (c.coste ?? 0) < g.costeMin) return false;
  if (g.raza && !(c.razas ?? []).includes(g.raza)) return false;
  return true;
}

export function disponibles(e, j, tipo) {
  const p = e.jugadores[j];
  return p.reserva.length + (p.generados ?? []).filter((g) => sirve(g, tipo)).reduce((s, g) => s + g.n, 0);
}

export function pagarOros(e, j, n, tipo) {
  const p = e.jugadores[j];
  for (const g of p.generados ?? []) {
    if (n <= 0) break;
    if (!sirve(g, tipo)) continue;
    const usa = Math.min(g.n, n);
    g.n -= usa;
    n -= usa;
  }
  p.generados = (p.generados ?? []).filter((g) => g.n > 0);
  p.pagado.push(...p.reserva.splice(0, n));
}

export function impuestoSinPagar(e, j) {
  return N.cuantas(e, j, (k) => k.impuestoSinPagar) + e.efectos.filter((f) => f.tipo === "impuestoSinPagar").length;
}

OPS.diferir = (e, p, fr) => {
  const ctx = { ctrl: fr.ctx.ctrl, fuente: fr.ctx.fuente, def: fr.ctx.def, costeFuente: fr.ctx.costeFuente };
  N.agregarEfecto(e, { tipo: "diferido", cuando: p.cuando, pasos: p.pasos, ctx, desde: e.turno, fin: "juego" }, fr.ctx.ctrl);
};

OPS.generar = (e, p, fr) => {
  if (e.efectos.some((f) => f.tipo === "noGenerar" && (f.j === undefined || f.j === fr.ctx.ctrl))) return;
  const pj = e.jugadores[jugadorDe(fr.ctx, p.quien)];
  const g = { n: p.n ?? 1, tipos: p.tipos ?? null };
  if (p.costeMin !== undefined) g.costeMin = p.costeMin;
  if (p.raza) g.raza = p.raza;
  pj.generados = [...(pj.generados ?? []), g];
};

OPS.pagar = (e, p, fr) => pagarOros(e, fr.ctx.ctrl, p.n);

export const API = {};

OPS.fn = (e, p, fr) => {
  const r = N.def(e, fr.ctx.def).fns[p.f](e, fr.ctx, API, p);
  if (Array.isArray(r)) fr.pasos.splice(fr.i, 0, ...r);
};

OPS.si = (e, p, fr) => {
  const ok = N.def(e, fr.ctx.def).fns[p.f](e, fr.ctx, API);
  fr.pasos.splice(fr.i, 0, ...((ok ? p.entonces : p.sino) ?? []));
};

OPS.anular = (e, p, fr) => {
  const item = e.pila[fr.ctx.objetivoPila];
  if (item) {
    item.anulado = true;
    fr.ctx.vars.costeAnulado = item.coste;
  }
};

OPS.portar = (e, p, fr) => {
  if ((fr.ctx.vars._anuladas ?? []).includes(p.arma)) return;
  const [port] = fr.ctx.vars[p.en] ?? [];
  entrarEnJuego(e, p.arma, fr.ctx.ctrl, port, p.datos ?? {});
};

OPS.jugarGratis = (e, p, fr) => {
  const pasos = [];
  const j = fr.ctx.ctrl;
  for (const uid of fr.ctx.vars[p.var] ?? []) {
    const c = N.carta(e, uid);
    if (c.soloPagando) continue;
    if (e.efectos.some((f) => f.tipo === "noSinPagar" && (f.j === undefined || f.j === j))) continue;
    const imp = impuestoSinPagar(e, j);
    if (imp > disponibles(e, j, c)) continue;
    pagarOros(e, j, imp, c);
    const datos = { pagado: false, desde: N.ubicar(e, uid)?.zona ?? null };
    pasos.push({ op: "ventanaSinPagar", uid });
    if (c.tipo === "Arma") {
      pasos.push({ op: "sel", de: ["yo:aliados"], filtro: { armaLibre: uid }, como: "_port" }, { op: "portar", arma: uid, en: "_port", datos });
    } else {
      pasos.push({ op: "entrar", uid, datos });
    }
    N.disparar(e, "juega", { uid, j, tipo: c.tipo, pagado: false });
  }
  fr.pasos.splice(fr.i, 0, ...pasos);
};

OPS.entrar = (e, p, fr) => {
  if ((fr.ctx.vars._anuladas ?? []).includes(p.uid)) return;
  if (N.carta(e, p.uid).soloPagando && !p.datos?.pagado) return;
  entrarEnJuego(e, p.uid, fr.ctx.ctrl, undefined, p.datos ?? {});
};

function anuladorSinPagar(e, j) {
  return N.orosDe(e, j).find((o) => N.carta(e, o).anulaSinPagar && N.activa(e, o) && !N.carta(e, o).sinHabilidad);
}

OPS.ventanaSinPagar = (e, p, fr) => {
  const rival = N.rival(fr.ctx.ctrl);
  const oro = anuladorSinPagar(e, rival);
  if (!oro) return;
  e.pendiente = {
    jugador: rival,
    opciones: [{ valor: true, texto: `Desterrar ${N.carta(e, oro).nombre} para Anular ${N.carta(e, p.uid).nombre}` }, { valor: false, texto: "no" }],
    cont: { op: "ventanaSinPagar", uid: p.uid, oro },
  };
};
OPS.ventanaSinPagar.elegir = (e, cont, valor, fr) => {
  if (!valor) return;
  N.mover(e, cont.oro, "destierro");
  N.mover(e, cont.uid, "cementerio");
  fr.ctx.vars._anuladas = [...(fr.ctx.vars._anuladas ?? []), cont.uid];
};

OPS.ponerOro = (e, p, fr) => {
  for (const uid of fr.ctx.vars[p.var] ?? []) entrarOro(e, uid, fr.ctx.ctrl, p.a);
};

OPS.finTalisman = (e, p) => N.mover(e, p.uid, p.destierro || N.hay(e, 0, (k) => k.talismanesAlDestierro) ? "destierro" : "cementerio");

Object.assign(API, N, { entrarOro, entrarEnJuego, fuente, cumple, pagarOros, disponibles, impuestoSinPagar, armaCabe, hayObjetivo });

export function ejecutar(e, paso, fr) {
  const f = OPS[paso.op];
  if (!f) throw new Error(`op desconocida: ${paso.op}`);
  f(e, paso, fr);
}

export function resolver(e) {
  while (!e.pendiente && !e.espera && e.ganador === null && e.cola.length) {
    const fr = e.cola[0];
    if (fr.i >= fr.pasos.length) {
      e.cola.shift();
      continue;
    }
    ejecutar(e, fr.pasos[fr.i++], fr);
    revisarDerrota(e);
  }
}

export function elegir(e, valor) {
  const { cont } = e.pendiente;
  e.pendiente = null;
  OPS[cont.op].elegir(e, cont, valor, e.cola[0]);
}

export function revisarDerrota(e) {
  if (e.ganador !== null || e.fase === "mulligan") return;
  for (const j of [e.activo, N.rival(e.activo)]) {
    if (e.jugadores[j].castillo.length === 0) {
      e.ganador = N.rival(j);
      e.fase = "fin";
      e.pendiente = null;
      return;
    }
  }
}
