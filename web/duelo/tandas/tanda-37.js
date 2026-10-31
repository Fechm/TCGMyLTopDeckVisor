import * as N from "../nucleo.js";
import { sel, mov, robar, efecto, buscar, barajar, coste } from "../formato.js";

const botar = (n, quien = "rival") => ({ op: "botar", n, quien });
const aliadoEnMano = { de: ["yo:mano"], filtro: { tipo: "Aliado" } };
const fuerzaMostrado = (e, ctx) => (ctx.vars.m ?? []).reduce((s, u) => s + (N.carta(e, u).fuerza ?? 0), 0);
const deRaza = (raza) => (e, ctx, u) => (N.carta(e, u).razas ?? []).includes(raza);
const esAliadoSalido = (e, ctx) => !ctx.datos.tipo || ctx.datos.tipo === "Aliado";

const cementerioElegido = (pasosPara) => ({
  op: "modo",
  opciones: [
    { texto: "tu Cementerio", pasos: pasosPara("yo") },
    { texto: "Cementerio oponente", pasos: pasosPara("rival") },
  ],
});

const barajarYDesterrar = (n) => [
  sel(["todos:cementerio"], {}, "c", { n, hasta: true }),
  mov("barajar", "c"),
  sel(["todos:cementerio"], {}, "d", { nf: "resto", hasta: true }),
  mov("desterrar", "d"),
];

export const HABILIDADES = {
  Sandokan: {
    claves: ["Furia"],
    activadas: [
      {
        texto: "Mostrar un Aliado de tu mano: tu oponente Bota cartas igual a su Fuerza",
        momento: "tuTurno",
        veces: "turno",
        requiere: aliadoEnMano,
        hacer: [sel(["yo:mano"], { tipo: "Aliado" }, "m"), { op: "botar", nf: "fuerzaMostrado", quien: "rival" }],
      },
    ],
    disparadas: [{ cuando: ["ataca"], quien: "yo", veces: 1, hacer: [{ op: "fn", f: "marcar" }] }],
    continuas: [{ cementerioRivalSinHabilidad: true, si: "vigente" }],
    fns: {
      fuerzaMostrado,
      marcar: (e, ctx) => {
        e.usos[`sandokan|${ctx.fuente}`] = e.turno;
      },
      vigente: (e, ctx) => {
        const t = e.usos[`sandokan|${ctx.fuente}`];
        return t === e.turno || (t === e.turno - 1 && e.activo !== ctx.ctrl);
      },
    },
  },
  "Santos Pincheira": {
    claves: ["Furia"],
    disparadas: [{ zona: ["cementerio"], cuando: ["anulada"], quien: "propia", hacer: [{ op: "fn", f: "permanente" }] }],
    activadas: [
      {
        texto: "Desterrar una carta del Cementerio oponente: tus Aliados ganan Fuerza igual a su coste por el turno",
        veces: "turno",
        requiere: { de: ["rival:cementerio"], filtro: {} },
        hacer: [sel(["rival:cementerio"], {}, "c"), { op: "fn", f: "ganar" }, mov("desterrar", "c")],
      },
    ],
    fns: {
      permanente: (e, ctx) => {
        for (const u of N.aliadosDe(e, ctx.ctrl)) N.agregarEfecto(e, { tipo: "fuerza", uid: u, n: 2, fin: "juego" }, ctx.ctrl);
      },
      ganar: (e, ctx) => {
        const n = (ctx.vars.c ?? []).reduce((s, u) => s + coste(e, u), 0);
        if (!n) return;
        for (const u of N.aliadosDe(e, ctx.ctrl)) N.agregarEfecto(e, { tipo: "fuerza", uid: u, n }, ctx.ctrl);
      },
    },
  },
  "Shakar Raj": {
    claves: ["UnaCopia", "Furia"],
    disparadas: [
      { cuando: ["entra"], hacer: [sel(["todos:aliados"], {}, "a"), efecto("a", { tipo: "fuerza", n: 1 }, "juego")] },
      { cuando: ["faseFinal"], hacer: [cementerioElegido((quien) => [sel([`${quien}:cementerio`], {}, "c", { nf: "cuantas", hasta: true }), mov("desterrar", "c")])] },
    ],
    fns: {
      cuantas: (e) => 1 + N.todoEnJuego(e).filter((u) => N.carta(e, u).tipo === "Aliado" && N.fuerza(e, u) !== (N.carta(e, u).fuerza ?? 0)).length,
    },
  },
  Shiji: {
    claves: ["Furia"],
    reduce: "red",
    disparadas: [
      {
        cuando: ["entra"],
        hacer: [sel(["yo:mano", "yo:cementerio"], { tipo: ["Arma", "Tótem"], costeMin: 1, costeMax: 1 }, "t"), { op: "jugarGratis", var: "t" }],
      },
    ],
    fns: {
      red: (e, ctx) => {
        const p = e.jugadores[ctx.ctrl];
        return [...p.mano, ...p.cementerio].some((u) => ["Arma", "Tótem"].includes(N.carta(e, u).tipo)) ? 1 : 0;
      },
    },
  },
  "Vaku Custodio": {
    claves: ["Furia"],
    disparadas: [
      {
        cuando: ["entra"],
        hacer: [sel(["todos:apoyo", "todos:armas"], { tipo: ["Tótem", "Arma"] }, "x", { n: 2, hasta: true, para: "desterrar" }), mov("desterrar")],
      },
    ],
    continuas: [{ fuerza: 1, a: "tusAliados" }],
  },
  Vathek: {
    disparadas: [
      {
        cuando: ["entra"],
        hacer: [
          {
            op: "opcional",
            texto: "Mostrar un Aliado de tu mano para Barajar hasta dos Aliados oponentes",
            requiere: aliadoEnMano,
            pasos: [sel(["yo:mano"], { tipo: "Aliado" }, "m"), sel(["rival:aliados"], {}, "x", { n: 2, hasta: true }), mov("barajar")],
          },
        ],
      },
    ],
    activadas: [
      {
        texto: "Desterrarlo de tu Cementerio y pagar un Oro: Barajar dos cartas de un Cementerio y robar dos",
        zona: "cementerio",
        oros: 1,
        coste: [sel(["fuente"], {}, "yo"), mov("desterrar", "yo")],
        hacer: [cementerioElegido((quien) => [sel([`${quien}:cementerio`], {}, "c", { n: 2 }), mov("barajar", "c")]), robar(2)],
      },
    ],
  },
  "Vicente Benavides": {
    disparadas: [
      {
        cuando: ["entra"],
        hacer: [sel(["yo:cementerio"], { tipo: "Arma" }, "a"), mov("mano", "a"), sel(["yo:cementerio"], { tipo: "Aliado" }, "b"), mov("mano", "b")],
      },
    ],
    activadas: [
      {
        texto: "Desterrar este Aliado y mostrar un Aliado de tu mano: tu oponente Bota cartas igual a su Fuerza",
        requiere: aliadoEnMano,
        coste: [sel(["fuente"], {}, "yo"), mov("desterrar", "yo")],
        hacer: [sel(["yo:mano"], { tipo: "Aliado" }, "m"), { op: "botar", nf: "fuerzaMostrado", quien: "rival" }],
      },
    ],
    fns: { fuerzaMostrado },
  },
  "Vlad Tepes": {
    claves: ["Indestructible"],
    disparadas: [
      {
        cuando: ["entra"],
        hacer: [
          { op: "tope", n: 6, como: "m" },
          sel(["var:m"], { tipo: "Aliado", costeMax: 1, f: "guerrero" }, "g", { hasta: true }),
          { op: "jugarGratis", var: "g" },
          barajar(),
        ],
      },
    ],
    fns: { guerrero: deRaza("Guerrero") },
  },
  "Vlad el Empalador": {
    claves: ["Furia"],
    disparadas: [
      {
        cuando: ["entra", "ataca"],
        hacer: [{ op: "mostrarHasta", n: 1, filtro: { tipo: "Aliado", costeMin: 1, costeMax: 1 }, como: "m" }, { op: "jugarGratis", var: "m" }],
      },
      {
        cuando: ["saleDelJuego", "sale"],
        quien: "yo",
        veces: 1,
        si: "enTuTurno",
        hacer: [sel(["todos:enJuego"], { costeMax: 3 }, "x", { hasta: true }), mov("barajar"), botar(3)],
      },
    ],
    fns: { enTuTurno: (e, ctx) => e.activo === ctx.ctrl && esAliadoSalido(e, ctx) },
  },
  "Abd-El-Kerim": {
    claves: ["Furia"],
    continuas: [{ rivalDebeAtacar: true }],
    disparadas: [
      {
        cuando: ["entra"],
        hacer: [
          sel(["fuente"], {}, "yo"),
          sel(["yo:aliados"], { noFuente: true }, "o"),
          efecto("yo", { tipo: "noSale" }, "proximoTurno"),
          efecto("o", { tipo: "noSale" }, "proximoTurno"),
        ],
      },
    ],
  },
  Abel: {
    claves: ["Indestructible"],
    activadas: [
      {
        texto: "Un Aliado gana Fuerza igual a la cantidad de Aliados que controla un jugador",
        momento: "vigilia",
        veces: "turno",
        requiere: { de: ["todos:aliados"], filtro: {} },
        hacer: [
          {
            op: "modo",
            opciones: [
              { texto: "Contar tus Aliados", pasos: [{ op: "fn", f: "contar", quien: "yo" }] },
              { texto: "Contar los Aliados oponentes", pasos: [{ op: "fn", f: "contar", quien: "rival" }] },
            ],
          },
          sel(["todos:aliados"], {}, "a"),
          { op: "fn", f: "ganar" },
        ],
      },
    ],
    fns: {
      contar: (e, ctx, api, p) => {
        ctx.vars.n = N.aliadosDe(e, p.quien === "rival" ? N.rival(ctx.ctrl) : ctx.ctrl).length;
      },
      ganar: (e, ctx) => {
        for (const u of ctx.vars.a ?? []) if (ctx.vars.n) N.agregarEfecto(e, { tipo: "fuerza", uid: u, n: ctx.vars.n }, ctx.ctrl);
      },
    },
  },
  "Abraham Van Helsing": {
    disparadas: [
      {
        cuando: ["entra"],
        hacer: [sel(["yo:castillo"], { tipo: "Aliado" }, "b"), sel(["yo:castillo"], { tipo: "Arma" }, "c"), mov("mano", "b"), mov("mano", "c"), barajar()],
      },
    ],
    activadas: [
      {
        texto: "Un Aliado gana 1 de Fuerza e Indestructible por el turno",
        veces: "turno",
        requiere: { de: ["todos:aliados"], filtro: {} },
        hacer: [sel(["todos:aliados"]), efecto("x", { tipo: "fuerza", n: 1 }), efecto("x", { tipo: "gana", clave: "Indestructible" })],
      },
    ],
  },
  Akari: {
    disparadas: [
      {
        cuando: ["entra"],
        hacer: [
          { op: "mostrarHasta", tipos: ["Oro", "Arma", "Tótem"], como: "m" },
          sel(["var:m"], {}, "a"),
          mov("mano", "a"),
          sel(["var:m"], { zona: "castillo" }, "r", { n: 2 }),
          mov("cementerio", "r"),
          barajar(),
        ],
      },
    ],
  },
  "Akari Musashi": {
    disparadas: [
      {
        cuando: ["entra", "ataca"],
        hacer: [sel(["rival:enJuego"], { noTipo: ["Oro"] }, "x", { para: "desterrar" }), mov("desterrar")],
      },
    ],
    activadas: [
      {
        texto: "Buscar en tu Castillo un Aliado Héroe y ponerlo en tu mano",
        veces: "turno",
        hacer: buscar(["yo:castillo"], { tipo: "Aliado", f: "heroe" }),
      },
    ],
    fns: { heroe: deRaza("Héroe") },
  },
  "Akari la Piloto Fenix": {
    claves: ["Furia", "Indestructible"],
    disparadas: [
      {
        cuando: ["entra", "ataca"],
        si: "sola",
        hacer: [
          {
            op: "opcional",
            texto: "Desterrar un Aliado de coste 2 o menos de tu mano o Cementerio para ganar sus habilidades",
            requiere: { de: ["yo:mano", "yo:cementerio"], filtro: { tipo: "Aliado", costeMax: 2 } },
            pasos: [sel(["yo:mano", "yo:cementerio"], { tipo: "Aliado", costeMax: 2 }, "d"), { op: "fn", f: "ganar" }, mov("desterrar", "d")],
          },
        ],
      },
      {
        cuando: ["sale"],
        hacer: [
          sel(["yo:destierro"], { tipo: "Aliado" }, "b", { n: 2 }),
          mov("barajar", "b"),
          sel(["todos:aliados", "todos:apoyo"], { tipo: ["Aliado", "Tótem"] }, "x", { hasta: true, para: "destruir" }),
          mov("destruir"),
        ],
      },
    ],
    fns: {
      sola: (e, ctx) => !e.atacantes.includes(ctx.fuente) || e.atacantes.length === 1,
      ganar: (e, ctx) => {
        if (!N.enJuego(e, ctx.fuente)) return;
        const ids = (ctx.vars.d ?? []).map((u) => e.instancias[u]);
        e.ganadas[ctx.fuente] = [...(e.ganadas[ctx.fuente] ?? []), ...ids];
      },
    },
  },
  Alicia: {
    activadas: [
      {
        texto: "Un Aliado gana 3 de Fuerza y robas dos cartas",
        veces: "turno",
        requiere: { de: ["todos:aliados"], filtro: {} },
        hacer: [sel(["todos:aliados"]), efecto("x", { tipo: "fuerza", n: 3 }), robar(2)],
      },
    ],
  },
  "Allan Quatermain": {
    claves: ["Indestructible"],
    activadas: [
      {
        texto: "Una carta que no sea Oro pierde su habilidad y es Destruida",
        veces: "turno",
        requiere: { de: ["todos:enJuego"], filtro: { noTipo: ["Oro"] } },
        hacer: [sel(["todos:enJuego"], { noTipo: ["Oro"] }), efecto("x", { tipo: "pierdeHabilidad" }, "mientras"), mov("destruir")],
      },
    ],
  },
  "Almirante Akari": {
    claves: ["Indestructible"],
    disparadas: [{ cuando: ["ataca"], quien: "yo", veces: 1, hacer: [{ op: "generar", n: 1, tipos: ["Aliado", "Arma"] }] }],
  },
  "Almirante Gorm": {
    disparadas: [{ cuando: ["entra"], hacer: [sel(["todos:enJuego"], { costeMax: 2 }), efecto("x", { tipo: "pierdeHabilidad" })] }],
  },
  "Arthur Gordon Pym": {},
  Axel: {
    claves: ["Indestructible"],
    soloPagando: true,
  },
  "Blanca Nieves": {
    claves: ["Indestructible"],
    disparadas: [
      { cuando: ["entra"], hacer: [sel(["todos:aliados"], {}, "x", { hasta: true }), mov("barajar")] },
      {
        cuando: ["saleDelJuego", "sale", "haceDano"],
        quien: "yo",
        veces: 1,
        si: "esAliado",
        opcional: true,
        hacer: [sel(["yo:mano", "yo:cementerio"], { tipo: "Aliado", f: "pagable" }, "a"), { op: "fn", f: "jugar" }],
      },
    ],
    fns: {
      esAliado: esAliadoSalido,
      pagable: (e, ctx, u) => Math.max(0, coste(e, u) - 1) <= e.jugadores[ctx.ctrl].reserva.length,
      jugar: (e, ctx, api) => {
        const [u] = ctx.vars.a ?? [];
        if (!u) return [];
        const n = Math.max(0, coste(e, u) - 1);
        if (n > api.disponibles(e, ctx.ctrl, "Aliado")) return [];
        const desde = N.ubicar(e, u)?.zona ?? null;
        api.pagarOros(e, ctx.ctrl, n, "Aliado");
        N.disparar(e, "juega", { uid: u, j: ctx.ctrl, tipo: "Aliado", pagado: true, desde });
        return [{ op: "entrar", uid: u, datos: { pagado: true, desde } }];
      },
    },
  },
  Cam: {
    disparadas: [
      {
        cuando: ["entra"],
        hacer: [
          {
            op: "modo",
            opciones: [
              {
                texto: "Un Aliado no puede salir del juego hasta tu próximo turno",
                requiere: { de: ["todos:aliados"], filtro: {} },
                pasos: [sel(["todos:aliados"]), efecto("x", { tipo: "noSale" }, "proximoTurno")],
              },
              {
                texto: "Hasta dos Aliados cambian su habilidad por Indestructible y tienen Fuerza 0 por el turno",
                pasos: [
                  sel(["todos:aliados"], {}, "c", { n: 2, hasta: true }),
                  efecto("c", { tipo: "pierdeHabilidad" }),
                  efecto("c", { tipo: "gana", clave: "Indestructible" }),
                  efecto("c", { tipo: "fuerza", n: -99 }),
                ],
              },
            ],
          },
        ],
      },
    ],
  },
  "Capitan Daisuke": {
    activadas: [
      {
        texto: "Un Aliado gana Furia, Indestructible y 1 de Fuerza este turno",
        momento: "vigilia",
        veces: "turno",
        requiere: { de: ["todos:aliados"], filtro: {} },
        hacer: [
          sel(["todos:aliados"]),
          efecto("x", { tipo: "gana", clave: "Furia" }),
          efecto("x", { tipo: "gana", clave: "Indestructible" }),
          efecto("x", { tipo: "fuerza", n: 1 }),
        ],
      },
    ],
    disparadas: [{ cuando: ["faseFinal"], hacer: barajarYDesterrar(4) }],
    fns: { resto: (e, ctx) => 4 - (ctx.vars.c ?? []).length },
  },
  "Cazador Zíngaro": {
    claves: ["Indestructible"],
    disparadas: [
      { cuando: ["entra", "ataca"], hacer: [sel(["rival:enJuego"], { noTipo: ["Oro"] }, "x", { para: "destruir" }), mov("destruir")] },
      {
        cuando: ["faseFinal"],
        hacer: [
          sel(["yo:cementerio"], {}, "c", { n: 2, hasta: true }),
          mov("barajar", "c"),
          sel(["rival:cementerio"], {}, "d", { n: 2, hasta: true }),
          mov("desterrar", "d"),
          robar(1),
        ],
      },
    ],
  },
};
