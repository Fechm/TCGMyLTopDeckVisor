import * as N from "../nucleo.js";
import { sel, mov, barajar, robar, efecto, castilloElegido, coste } from "../formato.js";

const sirve = (g, c) => (!g.tipos || g.tipos.includes(c.tipo)) && (g.costeMin === undefined || (c.coste ?? 0) >= g.costeMin) && (!g.raza || (c.razas ?? []).includes(g.raza));

const disp = (e, j, u) => {
  const c = N.carta(e, u);
  return e.jugadores[j].reserva.length + (e.jugadores[j].generados ?? []).filter((g) => sirve(g, c)).reduce((s, g) => s + g.n, 0);
};

const contar = (e, j, c) => {
  const p = e.jugadores[j];
  p.jugadas[c.tipo] = (p.jugadas[c.tipo] ?? 0) + 1;
  p.jugadas.nombres[c.nombre] = (p.jugadas.nombres[c.nombre] ?? 0) + 1;
  if (["Aliado", "Arma", "Tótem"].includes(c.tipo)) p.jugadas.total += 1;
};

const jugarPagando = (e, ctx, api, uid, n, desde) => {
  const j = ctx.ctrl;
  const c = N.carta(e, uid);
  api.pagarOros(e, j, n, c);
  contar(e, j, c);
  N.disparar(e, "juega", { uid, j, tipo: c.tipo, pagado: true, desde });
  return [{ op: "entrar", uid, datos: { pagado: true, desde } }];
};

const conGolpe = (e, j) => {
  const p = e.jugadores[j];
  return [...p.cementerio, ...p.destierro].some((u) => N.carta(e, u).nombre === "Golpe de Agua");
};

const jugoAngel = (e, j) => {
  const p = e.jugadores[j];
  const nombres = new Set([...Object.keys(p.jugadas?.nombres ?? {}), ...Object.keys(p.jugadasMiTurnoAnterior?.nombres ?? {})]);
  if (!nombres.size) return false;
  return Object.values(e.catalogo).some((c) => c.tipo === "Aliado" && nombres.has(c.nombre) && (c.razas ?? []).includes("Ángel"));
};

const aliadosEnJuego = (e) => [...N.aliadosDe(e, 0), ...N.aliadosDe(e, 1)];

const ponerSinHabilidad = (e, uid, j) => {
  N.mover(e, uid, "defensa", { j });
  e.conv[uid] = { tipo: "Aliado", sinHabilidad: true };
  e.jugadores[j].nuevos.push(uid);
  N.disparar(e, "entra", { uid, j, pagado: false, desde: "castillo" });
};

const duelistas = [
  sel(["rival:castillo"], { tipo: "Aliado" }, "a"),
  sel(["yo:castillo"], { tipo: "Aliado" }, "b", { quien: "rival" }),
  { op: "fn", f: "ponerDuelistas" },
  barajar(),
  barajar("rival"),
];

const desafio = [{ op: "fn", f: "masFuerte" }];

const TIPOS = ["Aliado", "Talismán", "Arma", "Tótem", "Oro"];

const desterrarDe = (quien) => [sel([`${quien}:cementerio`], {}, "d", { n: 2, hasta: true }), mov("desterrar", "d")];

export const HABILIDADES = {
  "Duelo Magico": {
    destierroAlJugar: true,
    talisman: [{ op: "fn", f: "duelo" }],
    fns: {
      duelo: (e, ctx) => {
        const total = (j) => e.jugadores[j].mano.reduce((s, u) => s + coste(e, u), 0);
        const a = total(ctx.ctrl);
        const b = total(N.rival(ctx.ctrl));
        if (a === b) return;
        const j = a > b ? ctx.ctrl : N.rival(ctx.ctrl);
        N.agregarEfecto(e, { tipo: "limiteBotarDescartar", j, fin: "juego" }, ctx.ctrl);
      },
    },
  },
  "Duelo Personal": {
    noAnulableSi: "golpe",
    talisman: [{ op: "fn", f: "elegir" }],
    fns: {
      golpe: (e, ctx) => conGolpe(e, ctx.ctrl),
      elegir: (e, ctx) => {
        if (conGolpe(e, ctx.ctrl)) return [...duelistas, ...desafio];
        return [
          {
            op: "modo",
            opciones: [
              { texto: "Cada jugador busca un Aliado en el Castillo oponente y lo pone en juego sin habilidad", pasos: duelistas },
              { texto: "El controlador del Aliado con más Fuerza Roba tres cartas y su oponente Descarta una", pasos: desafio },
            ],
          },
        ];
      },
      ponerDuelistas: (e, ctx) => {
        for (const u of ctx.vars.a ?? []) ponerSinHabilidad(e, u, ctx.ctrl);
        for (const u of ctx.vars.b ?? []) ponerSinHabilidad(e, u, N.rival(ctx.ctrl));
      },
      masFuerte: (e, ctx) => {
        const aliados = aliadosEnJuego(e);
        if (!aliados.length) return [];
        const max = Math.max(...aliados.map((u) => N.fuerza(e, u)));
        const ctrls = new Set(aliados.filter((u) => N.fuerza(e, u) === max).map((u) => N.controlador(e, u)));
        if (ctrls.size !== 1) return [];
        const yo = [...ctrls][0] === ctx.ctrl;
        return [robar(3, yo ? "yo" : "rival"), sel([yo ? "rival:mano" : "yo:mano"], {}, "d", { quien: yo ? "rival" : "yo" }), mov("cementerio", "d")];
      },
    },
  },
  "Duelo a Siete Pasos": {
    claves: ["Exhumar"],
    requiere: { de: ["yo:enJuego"], filtro: {}, para: "destruir" },
    talisman: [
      sel(["yo:enJuego"], {}, "s", { para: "destruir" }),
      { op: "fn", f: "recordar" },
      mov("destruir", "s"),
      sel(["rival:enJuego"], { f: "barata" }),
      efecto("x", { tipo: "pierdeHabilidad" }, "mientras"),
      mov("destruir"),
    ],
    fns: {
      recordar: (e, ctx) => {
        const [s] = ctx.vars.s ?? [];
        ctx.vars.cd = s ? coste(e, s) : -1;
      },
      barata: (e, ctx, u) => coste(e, u) <= (ctx.vars.cd ?? -1),
    },
  },
  "Duelo a Siete Pasos - Sp": {
    soloRespuesta: true,
    destierroAlJugar: true,
    respuesta: { anula: { tipo: "Talismán", costeMax: 2 }, pasos: [{ op: "fn", f: "desterrarAnulada" }, robar(1)] },
    fns: {
      desterrarAnulada: (e, ctx) => {
        const item = e.pila[ctx.objetivoPila];
        if (item) item.destierro = true;
      },
    },
  },
  "Duelo de Dragones": {
    momentos: ["comienzoFase"],
    destierroAlJugar: true,
    talisman: [
      sel(["rival:mano"], { costeMax: 2 }, "m"),
      mov("desterrar", "m"),
      castilloElegido((quien) => [sel([`${quien}:castillo`], {}, "c"), mov("desterrar", "c"), barajar(quien)]),
      {
        op: "modo",
        opciones: [
          { texto: "Tu Cementerio", pasos: desterrarDe("yo") },
          { texto: "Cementerio oponente", pasos: desterrarDe("rival") },
        ],
      },
      { op: "si", f: "dosOMas", entonces: [robar(2)] },
    ],
    fns: {
      dosOMas: (e, ctx) => ["m", "c", "d"].flatMap((v) => ctx.vars[v] ?? []).filter((u) => N.ubicar(e, u)?.zona === "destierro").length >= 2,
    },
  },
  "Duelo en Marte": {
    momentos: ["comienzoFase"],
    talisman: [
      sel(["yo:castillo"], { tipo: ["Arma", "Tótem"] }, "b", { n: 3 }),
      {
        op: "modo",
        opciones: [
          { texto: "Ponerlos en tu mano", pasos: [mov("mano", "b")] },
          { texto: "Ponerlos en tu Cementerio", pasos: [mov("cementerio", "b")] },
        ],
      },
      barajar(),
    ],
  },
  "Día de los Muertos": {
    claves: ["NoPortaArmas"],
    reduce: "red",
    continuas: [{ zona: "cementerio", reduceDanoCastillo: 2 }],
    talisman: [{ op: "fn", f: "convertir" }],
    fns: {
      red: (e) => N.todoEnJuego(e).filter((u) => N.carta(e, u).tipo !== "Oro").length,
      convertir: (e, ctx) => {
        for (const u of aliadosEnJuego(e)) {
          for (const a of [...(e.armas[u] ?? [])]) N.mover(e, a, "cementerio");
          delete e.armas[u];
          delete e.ganadas[u];
          e.conv[u] = { tipo: "Aliado", fuerza: 1, sinHabilidad: false, como: ctx.def };
        }
      },
    },
  },
  "Ea Poe": {
    talisman: [{ op: "fn", f: "ofrecer" }],
    fns: {
      ofrecer: (e, ctx) => [
        {
          op: "modo",
          opciones: Array.from({ length: e.jugadores[ctx.ctrl].reserva.length + 1 }, (_, i) => ({
            texto: `Pagar ${i} Oros`,
            pasos: [{ op: "fn", f: "desterrar", n: i }],
          })),
        },
      ],
      desterrar: (e, ctx, api, p) => {
        api.pagarOros(e, ctx.ctrl, p.n);
        const r = N.rival(ctx.ctrl);
        const tope = e.jugadores[r].castillo.slice(0, p.n + 2);
        N.quitarDelCastillo(e, r, p.n + 2, "destierro");
        const k = tope.filter((u) => e.jugadores[r].destierro.includes(u) && ["Talismán", "Tótem"].includes(N.carta(e, u).tipo)).length;
        if (k) N.robar(e, ctx.ctrl, k);
      },
    },
  },
  "El Caleuche": {
    claves: ["NoAnulable"],
    talisman: [sel(["todos:enJuego"], { costeMax: 2 }), mov("barajar"), robar(2)],
  },
  "El Dragón Emerge": {
    continuas: [{ zona: "cementerio", a: "tusAliados", fuerza: 1, costeMin: 3 }],
    talisman: [sel(["yo:castillo"], { tipo: "Aliado", costeMin: 3, f: "pagable" }, "a"), barajar(), { op: "fn", f: "jugar" }],
    fns: {
      pagable: (e, ctx, u) => Math.max(0, coste(e, u) - 1) <= disp(e, ctx.ctrl, u),
      jugar: (e, ctx, api) => {
        const [u] = ctx.vars.a ?? [];
        if (!u) return [];
        return jugarPagando(e, ctx, api, u, Math.max(0, coste(e, u) - 1), "castillo");
      },
    },
  },
  "El Gran Descenso": {
    soloPagando: true,
    talisman: [
      sel(["rival:mano"], {}, "d", { n: 3, azar: true }),
      mov("cementerio", "d"),
      sel(["var:d"], { zona: "cementerio", f: "recuperable" }, "r", { n: 3, hasta: true, quien: "rival" }),
      { op: "fn", f: "recuperar" },
    ],
    fns: {
      recuperable: (e, ctx) => e.jugadores[N.rival(ctx.ctrl)].castillo.length >= 4 * ((ctx.vars.r?.length ?? 0) + 1),
      recuperar: (e, ctx) => {
        const r = N.rival(ctx.ctrl);
        for (const u of ctx.vars.r ?? []) {
          N.quitarDelCastillo(e, r, 4, "destierro");
          N.mover(e, u, "mano");
          N.robar(e, ctx.ctrl, 1);
        }
      },
    },
  },
  "El Ángel y Su Juicio": {
    claves: ["Exhumar"],
    talisman: [sel(["yo:castillo"], { tipo: "Aliado", f: "pagable" }, "a"), barajar(), { op: "fn", f: "jugar" }],
    fns: {
      angel: (e, ctx) => N.aliadosDe(e, ctx.ctrl).some((u) => (N.carta(e, u).razas ?? []).includes("Ángel")) || jugoAngel(e, ctx.ctrl),
      reducido: (e, ctx, u) => Math.max(0, coste(e, u) - (N.def(e, ctx.def).fns.angel(e, ctx) ? 3 : 2)),
      pagable: (e, ctx, u) => N.def(e, ctx.def).fns.reducido(e, ctx, u) <= disp(e, ctx.ctrl, u),
      jugar: (e, ctx, api) => {
        const [u] = ctx.vars.a ?? [];
        if (!u) return [];
        const fns = N.def(e, ctx.def).fns;
        const angel = fns.angel(e, ctx);
        const pasos = jugarPagando(e, ctx, api, u, fns.reducido(e, ctx, u), "castillo");
        return angel ? [...pasos, robar(1)] : pasos;
      },
    },
  },
  Elemental: {
    soloPagando: true,
    destierroAlJugar: true,
    talisman: [
      sel(["rival:mano"], {}, "d", { n: 3, quien: "rival" }),
      mov("cementerio", "d"),
      sel(["yo:castillo"], { f: "sherlock" }, "b"),
      mov("mano", "b"),
      barajar(),
    ],
    fns: { sherlock: (e, ctx, u) => N.carta(e, u).nombre === "Sherlock Holmes" },
  },
  "Energía Suprema": {
    destierroAlJugar: true,
    requiere: { de: ["yo:mano", "yo:cementerio"], filtro: { tipo: ["Arma", "Tótem"] } },
    talisman: [{ op: "generar", n: 2, tipos: ["Aliado"], costeMin: 3 }],
  },
  Ensamble: {
    talisman: [{ op: "fn", f: "ensamble" }],
    disparadas: [{ zona: ["cementerio"], cuando: ["anulada"], quien: "propia", hacer: [{ op: "fn", f: "agrupar" }, robar(1)] }],
    fns: {
      agrupar: (e, ctx) => {
        const [u] = e.jugadores[ctx.ctrl].pagado;
        if (u) N.mover(e, u, "reserva", { j: ctx.ctrl });
      },
      ensamble: (e, ctx) => {
        const yo = ctx.ctrl;
        const r = N.rival(yo);
        const baratas = (j) => e.jugadores[j].mano.filter((u) => coste(e, u) <= 1);
        const mias = baratas(yo);
        for (const u of [...mias, ...baratas(r)]) N.mover(e, u, "cementerio");
        const antes = e.jugadores[yo].mano.length;
        N.robar(e, yo, mias.length);
        if (e.jugadores[yo].mano.length - antes < 3) N.quitarDelCastillo(e, r, 6, "cementerio");
      },
    },
  },
  Envidia: {
    soloRespuesta: true,
    respuesta: { anula: { costeMax: 3 }, pasos: [{ op: "fn", f: "tomar" }] },
    activadas: [
      {
        texto: "Desterrarla del Cementerio: Robar una carta",
        zona: "cementerio",
        requiere: "menosCartas",
        coste: [sel(["fuente"], {}, "yo"), mov("desterrar", "yo")],
        hacer: [robar(1)],
      },
    ],
    fns: {
      menosCartas: (e, ctx) => e.jugadores[ctx.ctrl].mano.length < e.jugadores[N.rival(ctx.ctrl)].mano.length,
      tomar: (e, ctx, api) => {
        const item = e.pila[ctx.objetivoPila];
        if (!item) return;
        const c = N.carta(e, item.uid);
        const imp = api.impuestoSinPagar(e, ctx.ctrl);
        if (imp > api.disponibles(e, ctx.ctrl, c.tipo)) return;
        if (c.tipo === "Arma") {
          const port = N.aliadosDe(e, ctx.ctrl).find((a) => api.armaCabe(e, a, item.uid));
          if (!port) return;
          item.portador = port;
        }
        api.pagarOros(e, ctx.ctrl, imp, c.tipo);
        Object.assign(item, { anulado: false, ctrl: ctx.ctrl, cerrada: true });
      },
    },
  },
  "Envidia Mortal": {
    talisman: [{ op: "modo", opciones: TIPOS.map((tipo) => ({ texto: tipo, pasos: [{ op: "fn", f: "comparar", tipo }] })) }],
    fns: {
      comparar: (e, ctx, api, p) => {
        ctx.vars.tipo = p.tipo;
        const cuenta = (j) => e.jugadores[j].mano.filter((u) => N.carta(e, u).tipo === p.tipo).length;
        if (cuenta(N.rival(ctx.ctrl)) <= cuenta(ctx.ctrl)) return [robar(2)];
        return [sel(["yo:castillo"], {}, "b"), mov("mano", "b"), barajar(), sel(["rival:mano"], { f: "delTipo" }, "d", { quien: "rival" }), mov("desterrar", "d")];
      },
      delTipo: (e, ctx, u) => N.carta(e, u).tipo === ctx.vars.tipo,
    },
  },
  "Escorpion de Seth": {
    claves: ["NoAnulable"],
    destierroAlJugar: true,
    talisman: [sel(["rival:enJuego"], { noTipo: ["Oro"] }, "x", { n: 99 }), mov("barajar")],
  },
  "Escudo Estelar": {
    soloRespuesta: true,
  },
  "Escudo Prisma Zeta": {
    talisman: [
      sel(["todos:enJuego"], {}, "x", { n: 2, hasta: true }),
      {
        op: "modo",
        opciones: [
          { texto: "Este turno", pasos: [efecto("x", { tipo: "pierdeHabilidad" }, "turno")] },
          { texto: "El turno siguiente", pasos: [efecto("x", { tipo: "pierdeHabilidad" }, "dosTurnos")] },
        ],
      },
      robar(2),
    ],
    disparadas: [
      {
        zona: ["cementerio"],
        cuando: ["comienzoVigilia"],
        quien: "yo",
        si: "otra",
        opcional: true,
        hacer: [sel(["yo:cementerio"], { noFuente: true }, "c"), mov("desterrar", "c"), sel(["fuente"], {}, "yo"), mov("mano", "yo")],
      },
    ],
    fns: { otra: (e, ctx) => e.jugadores[ctx.ctrl].cementerio.some((u) => u !== ctx.fuente) },
  },
  "Espectro del Padre": {
    requiere: { de: ["rival:aliados"], filtro: {}, para: "destruir" },
    talisman: [sel(["rival:aliados"], {}, "x", { para: "destruir" }), mov("destruir")],
  },
  "Espectros Vindicantes": {
    claves: ["NoAnulable"],
    talisman: [
      castilloElegido((quien) => [sel([`${quien}:castillo`], { f: "distinto" }, "b", { n: 2 }), mov("desterrar", "b"), barajar(quien)]),
      sel(["rival:mano"], {}, "d", { quien: "rival" }),
      mov("cementerio", "d"),
    ],
    fns: { distinto: (e, ctx, u) => !(ctx.vars.b ?? []).some((x) => N.carta(e, x).nombre === N.carta(e, u).nombre) },
  },
  "Estaca en el Corazón": {
    claves: ["NoAnulable"],
    unoPorTurno: true,
    talisman: [{ op: "fn", f: "devolver" }],
    fns: {
      devolver: (e) => {
        for (const u of N.todoEnJuego(e)) {
          if (N.carta(e, u).tipo === "Oro") continue;
          const loc = N.ubicar(e, u);
          const d = N.dueno(u);
          if (loc.zona === "arma" || loc.j === d || !N.puedeTomar(e, u, d)) continue;
          N.sacar(e, u);
          e.jugadores[d][loc.zona === "ataque" ? "defensa" : loc.zona].push(u);
        }
      },
    },
  },
  "Estirpe Maldita": {
    talisman: [{ op: "fn", f: "estirpe" }, robar(2), sel(["yo:aliados"], {}, "a", { n: 99 }), efecto("a", { tipo: "fuerza", n: 2 }, "juego")],
    activadas: [
      {
        texto: "Desterrarla del Cementerio: un Aliado de coste 2 o menos gana Furia",
        zona: "cementerio",
        requiere: { de: ["todos:aliados"], filtro: { costeMax: 2 } },
        coste: [sel(["fuente"], {}, "yo"), mov("desterrar", "yo")],
        hacer: [sel(["todos:aliados"], { costeMax: 2 }), efecto("x", { tipo: "gana", clave: "Furia" }, "mientras")],
      },
    ],
    fns: {
      estirpe: (e, ctx) => {
        const n = N.aliadosDe(e, ctx.ctrl).length;
        if (!n) return [];
        return [castilloElegido((quien) => [{ op: "tope", quien, n, como: "t" }, { op: "convertir", var: "t", en: "Aliado", fuerza: 2, a: "defensa" }])];
      },
    },
  },
  Exhumar: {
    requiere: { de: ["yo:cementerio"], filtro: { tipo: "Aliado" } },
    talisman: [sel(["yo:cementerio"], { tipo: "Aliado", f: "pagable" }, "a"), { op: "fn", f: "jugar" }],
    fns: {
      pagable: (e, ctx, u) => coste(e, u) <= disp(e, ctx.ctrl, u),
      fuerte: (e, ctx) => (ctx.vars.a ?? []).some((u) => N.fuerza(e, u) >= 4),
      jugar: (e, ctx, api) => {
        const [u] = ctx.vars.a ?? [];
        if (!u) return [];
        return [
          ...jugarPagando(e, ctx, api, u, coste(e, u), "cementerio"),
          {
            op: "si",
            f: "fuerte",
            entonces: [efecto("a", { tipo: "gana", clave: "Furia" }, "mientras"), sel(["rival:mano"], { tipo: "Talismán" }, "t", { hasta: true }), mov("desterrar", "t")],
            sino: [
              efecto("a", { tipo: "gana", clave: "Indesterrable" }, "mientras"),
              sel(["todos:aliados"], { costeMax: 3 }, "d", { hasta: true, para: "desterrar" }),
              mov("desterrar", "d"),
            ],
          },
        ];
      },
    },
  },
};
