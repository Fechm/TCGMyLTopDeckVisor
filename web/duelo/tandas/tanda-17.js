import * as N from "../nucleo.js";
import { sel, mov, barajar, robar, efecto, buscar, coste } from "../formato.js";

const esSello = (e, ctx, u) => /\bSello\b/.test(N.carta(e, u).nombre);

const buscarSello = buscar(["yo:castillo"], { f: "sello" });

const limite = (n) => ({ op: "fn", f: "fijarLimite", n });

const barajarYDesterrar = [
  sel(["todos:cementerio"], {}, "c", { nf: "limiteCementerio", hasta: true }),
  mov("barajar", "c"),
  sel(["todos:cementerio"], {}, "d", { nf: "restoCementerio", hasta: true }),
  mov("desterrar", "d"),
];

const cementerios = {
  fijarLimite: (e, ctx, api, p) => {
    ctx.vars.limite = p.n;
  },
  limiteCementerio: (e, ctx) => ctx.vars.limite ?? 0,
  restoCementerio: (e, ctx) => Math.max(0, (ctx.vars.limite ?? 0) - (ctx.vars.c ?? []).length),
};

const noOrosEnJuego = (e) => {
  const todas = N.todoEnJuego(e).filter((u) => N.carta(e, u).tipo !== "Oro");
  return [...todas.filter((u) => N.ubicar(e, u)?.zona === "arma"), ...todas.filter((u) => N.ubicar(e, u)?.zona !== "arma")];
};

const orosLibres = (e, j) => e.jugadores[j].reserva.length + (e.jugadores[j].generados ?? []).reduce((s, g) => s + g.n, 0);

const pagarRebajado = (e, uid, rebaja) => Math.max(0, coste(e, uid) - rebaja);

function jugarRebajado(e, ctx, api, uid, rebaja) {
  if (!uid) return;
  const c = N.carta(e, uid);
  if (!["Aliado", "Tótem"].includes(c.tipo)) return;
  const j = ctx.ctrl;
  const pagar = pagarRebajado(e, uid, rebaja);
  if (pagar > api.disponibles(e, j, c.tipo)) return;
  const desde = N.ubicar(e, uid)?.zona ?? null;
  api.pagarOros(e, j, pagar, c.tipo);
  N.disparar(e, "juega", { uid, j, tipo: c.tipo, pagado: true, desde });
  api.entrarEnJuego(e, uid, j, undefined, { pagado: true, desde });
}

const marca = (nombre) => (e, ctx) => {
  e.usos[`${nombre}|${ctx.fuente}`] = e.turno;
};

const marcada = (nombre) => (e, ctx) => e.usos[`${nombre}|${ctx.fuente}`] === e.turno;

const finTuProximoTurno = (e, ctrl) => ({ finTurno: e.turno + (e.activo === ctrl ? 2 : 1) });

const trempulcahue = {
  claves: ["UnaCopia"],
  soloRespuesta: true,
  respuesta: { anula: { costeMax: 2 }, pasos: [sel(["yo:mano"]), mov("barajar")] },
};

const TIPOS = ["Aliado", "Talismán", "Arma", "Tótem", "Oro"];

export const HABILIDADES = {
  "Sexto Sello": {
    claves: ["NoAnulable"],
    talisman: [
      ...buscarSello,
      {
        op: "modo",
        opciones: [
          { texto: "Destruir todas las cartas que no sean Oro", pasos: [{ op: "fn", f: "todas" }, mov("destruir", "t")] },
          { texto: "Desterrar todas las cartas que no sean Oro", pasos: [{ op: "fn", f: "todas" }, mov("desterrar", "t")] },
        ],
      },
      { op: "fn", f: "botarSeis" },
    ],
    fns: {
      sello: esSello,
      todas: (e, ctx) => {
        ctx.vars.t = noOrosEnJuego(e);
      },
      botarSeis: (e, ctx) => {
        let sellos = 0;
        for (const j of [ctx.ctrl, N.rival(ctx.ctrl)]) {
          const p = e.jugadores[j];
          const antes = p.cementerio.length;
          N.quitarDelCastillo(e, j, 6, "cementerio");
          sellos += p.cementerio.slice(antes).filter((u) => esSello(e, ctx, u)).length;
        }
        if (sellos) N.quitarDelCastillo(e, N.rival(ctx.ctrl), sellos, "cementerio");
      },
    },
  },
  Sheut: {
    orosMenos: "menosOros",
    destierroAlJugar: true,
    soloRespuesta: true,
    respuesta: { anula: { costeMax: 1 }, pasos: [{ op: "fn", f: "soloAliadoTotem" }] },
    fns: {
      menosOros: (e, ctx) => (N.orosDe(e, ctx.ctrl).length < N.orosDe(e, N.rival(ctx.ctrl)).length ? 1 : 0),
      soloAliadoTotem: (e, ctx) => {
        const item = e.pila[ctx.objetivoPila];
        if (item && !["Aliado", "Tótem"].includes(N.carta(e, item.uid).tipo)) item.anulado = false;
      },
    },
  },
  "Sidhes del Bosque": {
    talisman: [
      {
        op: "modo",
        opciones: [
          { texto: "Robar una carta", pasos: [robar(1)] },
          {
            texto: "Subir un Aliado de tu Cementerio a tu mano",
            requiere: { de: ["yo:cementerio"], filtro: { tipo: "Aliado" } },
            pasos: [sel(["yo:cementerio"], { tipo: "Aliado" }), mov("mano")],
          },
        ],
      },
    ],
  },
  "Silenciar Mundo": {
    claves: ["NoAnulable"],
    talisman: [{ op: "fn", f: "silenciar" }],
    fns: {
      silenciar: (e, ctx) => {
        const r = N.rival(ctx.ctrl);
        const blancos = [...N.armasDe(e, r), ...e.jugadores[r].apoyo.filter((u) => N.carta(e, u).tipo === "Tótem")];
        for (const u of blancos) e.efectos.push({ tipo: "pierdeHabilidad", uid: u, fin: finTuProximoTurno(e, ctx.ctrl) });
        const total = blancos.reduce((s, u) => s + coste(e, u), 0);
        return total <= 3 ? [{ op: "robarHasta", n: 2 }] : [];
      },
    },
  },
  "Sin Tregua": {
    talisman: [
      {
        op: "modo",
        opciones: [
          { texto: "tu Castillo", pasos: [sel(["yo:castillo"], {}, "b", { n: 2 }), mov("desterrar", "b"), barajar()] },
          { texto: "Castillo oponente", pasos: [sel(["rival:castillo"], {}, "b", { n: 2 }), mov("desterrar", "b"), barajar("rival")] },
        ],
      },
    ],
    disparadas: [{ zona: ["cementerio"], cuando: ["comienzoVigilia"], quien: "yo", opcional: true, hacer: [sel(["fuente"], {}, "yo"), mov("mano", "yo")] }],
  },
  Soberbia: {
    requiere: { de: ["todos:aliados"], filtro: {} },
    talisman: [sel(["todos:aliados"], {}, "a"), { op: "fn", f: "otorgar" }],
    activadas: [
      {
        texto: "Barajar todos los Aliados de menor Fuerza que este Aliado",
        momento: "vigilia",
        veces: "turno",
        hacer: [{ op: "fn", f: "barajarMenores" }],
      },
    ],
    fns: {
      otorgar: (e, ctx) => {
        for (const a of ctx.vars.a ?? []) e.ganadas[a] = [...(e.ganadas[a] ?? []), ctx.def];
      },
      barajarMenores: (e, ctx) => {
        const f = N.fuerza(e, ctx.fuente);
        ctx.vars.x = [...N.aliadosDe(e, 0), ...N.aliadosDe(e, 1)].filter((u) => u !== ctx.fuente && N.fuerza(e, u) < f);
        return [mov("barajar")];
      },
    },
  },
  "Sombra Etérea": {
    claves: ["Exhumar"],
    talisman: [
      {
        op: "modo",
        opciones: TIPOS.map((t) => ({
          texto: `Nombrar una carta de tipo ${t}`,
          pasos: [{ op: "mostrarHasta", n: 1, filtro: { tipo: t }, como: "m" }, mov("mano", "m")],
        })),
      },
    ],
  },
  "Supremacia Kaiju": {
    destierroAlJugar: true,
    talisman: [limite(3), ...barajarYDesterrar, ...buscar(["yo:castillo"], {})],
    fns: { ...cementerios },
  },
  "Ta Kona": {
    costeExtra: "porAliado",
    talisman: [],
    fns: { porAliado: (e, ctx) => Math.min(3, N.aliadosDe(e, ctx.ctrl).length) },
  },
  Tapati: {
    talisman: [{ op: "fn", f: "todas" }, mov("desterrar", "t"), { op: "fn", f: "porDesterrada" }, ...barajarYDesterrar],
    disparadas: [
      {
        zona: ["cementerio"],
        cuando: ["anulada"],
        quien: "propia",
        hacer: [sel(["yo:pagado"], {}, "o"), mov("reserva", "o"), ...buscar(["yo:castillo"], {})],
      },
    ],
    fns: {
      ...cementerios,
      todas: (e, ctx) => {
        ctx.vars.t = noOrosEnJuego(e);
      },
      porDesterrada: (e, ctx) => {
        ctx.vars.limite = 2 * (ctx.vars.t ?? []).filter((u) => N.ubicar(e, u)?.zona === "destierro").length;
      },
    },
  },
  Tempilcahue: {
    destierroAlJugar: true,
    talisman: [
      {
        op: "modo",
        opciones: [
          {
            texto: "Buscar una carta y Robar una; no puedes jugar cartas este turno",
            pasos: [...buscar(["yo:castillo"], {}), robar(1), { op: "efecto", efecto: { tipo: "noJugarMas" }, jugador: "yo", fin: "turno" }],
          },
          {
            texto: "Pagar dos Oros: Barajar cartas de coste total 4 o menos y Robar dos",
            requiere: "dosOros",
            pasos: [{ op: "pagar", n: 2 }, sel(["todos:enJuego"], { f: "cabe" }, "x", { n: 99, hasta: true }), mov("barajar"), robar(2)],
          },
        ],
      },
    ],
    fns: {
      dosOros: (e, ctx) => orosLibres(e, ctx.ctrl) >= 2,
      cabe: (e, ctx, u) => coste(e, u) + (ctx.vars.x ?? []).reduce((s, x) => s + coste(e, x), 0) <= 4,
    },
  },
  "Tentaciones Divinas": {
    destierroAlJugar: true,
    talisman: [
      {
        op: "modo",
        n: 2,
        opciones: [
          {
            texto: "Hasta tres Aliados ganan 1 de Fuerza y hacen daño de combate al Destierro",
            pasos: [
              sel(["todos:aliados"], {}, "a", { n: 3, hasta: true }),
              efecto("a", { tipo: "fuerza", n: 1 }),
              efecto("a", { tipo: "gana", clave: "DanoAlDestierro" }),
            ],
          },
          { texto: "Robar tres cartas y Descartar dos", pasos: [robar(3), sel(["yo:mano"], {}, "d", { n: 2 }), mov("cementerio", "d")] },
          {
            texto: "Un Oro o carta de coste 2 o menos pierde su habilidad hasta tu próximo turno",
            requiere: { de: ["todos:enJuego"], filtro: { f: "oroOBarata" } },
            pasos: [sel(["todos:enJuego"], { f: "oroOBarata" }, "h"), efecto("h", { tipo: "pierdeHabilidad" }, "proximoTurno")],
          },
        ],
      },
    ],
    fns: { oroOBarata: (e, ctx, u) => N.carta(e, u).tipo === "Oro" || coste(e, u) <= 2 },
  },
  "Tercer Sello": {
    talisman: [...buscarSello, { op: "fn", f: "debilitarTodos" }],
    disparadas: [{ zona: ["cementerio"], cuando: ["entra"], quien: "cualquiera", si: "vigente", hacer: [{ op: "fn", f: "debilitarEntrante" }] }],
    fns: {
      sello: esSello,
      debilitarTodos: (e, ctx) => {
        for (const a of [...N.aliadosDe(e, 0), ...N.aliadosDe(e, 1)]) N.agregarEfecto(e, { tipo: "fuerza", uid: a, n: -3, fin: "proximoTurno" }, ctx.ctrl);
        N.agregarEfecto(e, { tipo: "tercerSello", fuente: ctx.fuente, fin: "proximoTurno" }, ctx.ctrl);
        ctx.vars.z = N.aliadosDe(e, N.rival(ctx.ctrl)).filter((a) => N.fuerza(e, a) === 0);
        return [mov("barajar", "z")];
      },
      vigente: (e, ctx) =>
        e.efectos.some((f) => f.tipo === "tercerSello" && f.fuente === ctx.fuente) && N.carta(e, ctx.datos.uid).tipo === "Aliado" && N.enJuego(e, ctx.datos.uid),
      debilitarEntrante: (e, ctx) => {
        N.agregarEfecto(e, { tipo: "fuerza", uid: ctx.datos.uid, n: -3, fin: "proximoTurno" }, ctx.ctrl);
      },
    },
  },
  Terremoto: {
    unoPorTurno: true,
    requiere: "enTuVigilia",
    talisman: [sel(["todos:aliados"], {}, "a"), { op: "fn", f: "sacudir" }],
    disparadas: [{ zona: ["cementerio"], cuando: ["ataca"], quien: "cualquiera", si: "sacudido", hacer: [{ op: "botar", nf: "aBotar", quien: "yo" }] }],
    fns: {
      enTuVigilia: (e, ctx) => e.fase === "vigilia" && e.activo === ctx.ctrl,
      sacudir: (e, ctx) => {
        for (const a of ctx.vars.a ?? []) {
          const anticucho = (e.armas[a] ?? []).some((x) => N.carta(e, x).nombre === "Anticucho");
          const f = N.fuerza(e, a);
          N.agregarEfecto(e, { tipo: "fuerza", uid: a, n: anticucho ? 2 * f : f, fin: "proximoTurno" }, ctx.ctrl);
          N.agregarEfecto(e, { tipo: "terremoto", uid: a, fuente: ctx.fuente, impresa: anticucho, fin: "proximoTurno" }, ctx.ctrl);
        }
      },
      sacudido: (e, ctx) => e.efectos.some((f) => f.tipo === "terremoto" && f.fuente === ctx.fuente && f.uid === ctx.datos.uid),
      aBotar: (e, ctx) => {
        const f = e.efectos.find((x) => x.tipo === "terremoto" && x.fuente === ctx.fuente && x.uid === ctx.datos.uid);
        return f?.impresa ? N.carta(e, f.uid).fuerza ?? 0 : N.fuerza(e, ctx.datos.uid);
      },
    },
  },
  "Tierra del Fuego": {
    destierroAlJugar: true,
    talisman: [
      {
        op: "modo",
        n: 3,
        hasta: true,
        opciones: [
          {
            texto: "Cada jugador Baraja un Aliado de coste 1 o menos que controle",
            pasos: [
              sel(["yo:aliados"], { costeMax: 1 }, "a"),
              mov("barajar", "a"),
              sel(["rival:aliados"], { costeMax: 1 }, "b", { quien: "rival" }),
              mov("barajar", "b"),
            ],
          },
          {
            texto: "Pagar un Oro: Desterrar un Arma o Tótem",
            requiere: "unOro",
            pasos: [{ op: "pagar", n: 1 }, sel(["todos:enJuego"], { tipo: ["Arma", "Tótem"] }, "t", { para: "desterrar" }), mov("desterrar", "t")],
          },
          { texto: "Pagar un Oro: Robar tres cartas", requiere: "unOro", pasos: [{ op: "pagar", n: 1 }, robar(3)] },
        ],
      },
    ],
    fns: { unOro: (e, ctx) => orosLibres(e, ctx.ctrl) >= 1 },
  },
  "Tifon de Huesos": {
    talisman: [limite(4), ...barajarYDesterrar, robar(1), { op: "fn", f: "marcar" }],
    disparadas: [
      {
        zona: ["cementerio"],
        cuando: ["alCementerio"],
        quien: "propia",
        si: "resuelto",
        hacer: [{ op: "fn", f: "desmarcar" }, sel(["fuente"], {}, "yo"), mov("barajar", "yo"), ...buscar(["yo:castillo"], { f: "daikaiju" })],
      },
    ],
    fns: {
      ...cementerios,
      marcar: marca("tifon"),
      resuelto: marcada("tifon"),
      desmarcar: (e, ctx) => {
        delete e.usos[`tifon|${ctx.fuente}`];
      },
      daikaiju: (e, ctx, u) => N.carta(e, u).nombre.includes("Daikaiju"),
    },
  },
  "Toma del Morro": {
    claves: ["Exhumar", "NoAnulable"],
    requiere: { de: ["rival:enJuego"], filtro: { noTipo: ["Oro"] }, para: "desterrar" },
    talisman: [
      sel(["rival:enJuego"], { noTipo: ["Oro"] }, "x", { para: "desterrar" }),
      { op: "fn", f: "recordar" },
      mov("desterrar"),
      sel(["yo:castillo"], { f: "igualOMenor" }, "b"),
      {
        op: "si",
        f: "hallada",
        entonces: [
          {
            op: "modo",
            opciones: [
              { texto: "Jugarla reduciendo su coste en un Oro", requiere: "jugable", pasos: [{ op: "fn", f: "jugar" }] },
              { texto: "Ponerla en tu mano", pasos: [mov("mano", "b")] },
            ],
          },
        ],
      },
      barajar(),
    ],
    fns: {
      recordar: (e, ctx) => {
        ctx.vars.costeDesterrada = (ctx.vars.x ?? []).reduce((s, u) => Math.max(s, coste(e, u)), 0);
      },
      igualOMenor: (e, ctx, u) => (ctx.vars.x ?? []).length > 0 && coste(e, u) <= (ctx.vars.costeDesterrada ?? 0),
      hallada: (e, ctx) => (ctx.vars.b ?? []).length > 0,
      jugable: (e, ctx) => {
        const [u] = ctx.vars.b ?? [];
        return !!u && ["Aliado", "Tótem"].includes(N.carta(e, u).tipo) && pagarRebajado(e, u, 1) <= orosLibres(e, ctx.ctrl);
      },
      jugar: (e, ctx, api) => jugarRebajado(e, ctx, api, (ctx.vars.b ?? [])[0], 1),
    },
  },
  Transformacion: {
    destierroAlJugar: true,
    talisman: [
      {
        op: "modo",
        opciones: [
          { texto: "Prevenir que una carta que controles sea afectada y Robar una carta", pasos: [robar(1)] },
          { texto: "Prevenir un efecto que fuera a afectarte y buscar un Aliado", pasos: buscar(["yo:castillo"], { tipo: "Aliado" }) },
        ],
      },
    ],
  },
  "Transformación de Lucy": {
    destierroAlJugar: true,
    talisman: [
      {
        op: "modo",
        opciones: [
          {
            texto: "Ganar el control de un Aliado o Tótem del que seas dueño y Descartar tantas cartas como su coste",
            requiere: { de: ["rival:enJuego"], filtro: { tipo: ["Aliado", "Tótem"], f: "propia" }, para: "tomar" },
            pasos: [
              sel(["rival:enJuego"], { tipo: ["Aliado", "Tótem"], f: "propia" }, "t", { para: "tomar" }),
              { op: "fn", f: "tomar" },
              sel(["yo:mano"], {}, "d", { nf: "costeTomada" }),
              mov("cementerio", "d"),
            ],
          },
          {
            texto: "Un Aliado gana 2 de Fuerza permanentemente e Indesterrable",
            requiere: { de: ["todos:aliados"], filtro: {} },
            pasos: [sel(["todos:aliados"], {}, "a"), efecto("a", { tipo: "fuerza", n: 2 }, "juego"), efecto("a", { tipo: "gana", clave: "Indesterrable" }, "juego")],
          },
        ],
      },
    ],
    fns: {
      propia: (e, ctx, u) => N.dueno(u) === ctx.ctrl,
      tomar: (e, ctx) => {
        for (const u of ctx.vars.t ?? []) {
          if (!N.puedeTomar(e, u, ctx.ctrl)) continue;
          const loc = N.ubicar(e, u);
          N.mover(e, u, loc.zona === "ataque" ? "defensa" : loc.zona, { j: ctx.ctrl });
          e.atacantes = e.atacantes.filter((x) => x !== u);
          for (const p of e.jugadores) p.nuevos = p.nuevos.filter((x) => x !== u);
          if (N.carta(e, u).tipo === "Aliado") e.jugadores[ctx.ctrl].nuevos.push(u);
        }
      },
      costeTomada: (e, ctx) => (ctx.vars.t ?? []).filter((u) => N.controlador(e, u) === ctx.ctrl).reduce((s, u) => s + coste(e, u), 0),
    },
  },
  Trempulcahue: { ...trempulcahue },
  "Trempulcahue Bestiarium": { ...trempulcahue },
  "Tripulación Maldita": {
    requiere: "sieteEnCementerio",
    talisman: [
      sel(["todos:cementerio", "yo:mano", "todos:enJuego"], {}, "n"),
      sel(["rival:cementerio"], {}, "r", { azar: true }),
      { op: "fn", f: "revelar" },
    ],
    fns: {
      sieteEnCementerio: (e, ctx) => e.jugadores[N.rival(ctx.ctrl)].cementerio.length >= 7,
      revelar: (e, ctx, api) => {
        const [n] = ctx.vars.n ?? [];
        const [r] = ctx.vars.r ?? [];
        if (n && r && N.carta(e, n).nombre === N.carta(e, r).nombre) return jugarRebajado(e, ctx, api, r, 2);
        N.robar(e, ctx.ctrl, 2);
      },
    },
  },
  "Tumulto Voraz": {
    talisman: [{ op: "mostrarHasta", n: 1, filtro: { tipo: "Oro" }, como: "m" }, { op: "ponerOro", var: "m", a: "pagado" }],
  },
  "Un Nuevo Guardián": {
    talisman: [{ op: "mostrarHasta", tipos: ["Aliado", "Arma", "Tótem", "Oro"], como: "m" }, mov("mano", "m"), barajar()],
    activadas: [
      {
        texto: "Desterrarlo de tu Cementerio: cancelar el ataque de un Aliado oponente o Barajar hasta dos cartas de un Cementerio",
        zona: "cementerio",
        coste: [sel(["fuente"], {}, "yo"), mov("desterrar", "yo")],
        hacer: [
          {
            op: "modo",
            opciones: [
              { texto: "Cancelar el ataque de un Aliado oponente", requiere: { de: ["rival:ataque"], filtro: {} }, pasos: [sel(["rival:ataque"]), { op: "fn", f: "cancelar" }] },
              { texto: "Barajar hasta dos cartas de tu Cementerio", pasos: [sel(["yo:cementerio"], {}, "c", { n: 2, hasta: true }), mov("barajar", "c")] },
              { texto: "Barajar hasta dos cartas del Cementerio oponente", pasos: [sel(["rival:cementerio"], {}, "c", { n: 2, hasta: true }), mov("barajar", "c")] },
            ],
          },
        ],
      },
    ],
    fns: {
      cancelar: (e, ctx) => {
        for (const u of ctx.vars.x ?? []) {
          const j = N.controlador(e, u);
          if (!e.jugadores[j].ataque.includes(u)) continue;
          N.sacar(e, u);
          e.jugadores[j].defensa.push(u);
          e.atacantes = e.atacantes.filter((x) => x !== u);
          for (const [b, a] of Object.entries(e.bloqueos)) if (a === u) delete e.bloqueos[b];
        }
      },
    },
  },
  "Union Espacial": {
    talisman: [{ op: "fn", f: "fuertes" }, efecto("f", { tipo: "pierdeHabilidad" }, "mientras"), mov("barajar", "f")],
    fns: {
      fuertes: (e, ctx) => {
        ctx.vars.f = [...N.aliadosDe(e, 0), ...N.aliadosDe(e, 1)].filter((u) => N.fuerza(e, u) >= 4);
      },
    },
  },
};
