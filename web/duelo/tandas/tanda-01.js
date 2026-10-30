import * as N from "../nucleo.js";
import { sel, mov, barajar, robar, efecto, castilloElegido } from "../formato.js";

const sinCopia = (e, ctx) => !N.aliadosDe(e, ctx.ctrl).some((a) => N.carta(e, a).id === ctx.def);

const botarTres = { op: "botar", n: 3, quien: "rival" };

export const HABILIDADES = {
  "Ama del Tyn": {
    disparadas: [
      {
        cuando: ["entra"],
        hacer: [sel(["yo:castillo"], { tipo: "Tótem", costeMax: 3 }, "b"), { op: "jugarGratis", var: "b" }, barajar()],
      },
    ],
    continuas: [{ silenciaEntradaCosteMax: 1 }],
  },
  "Amo de las Cadenas": {
    requiere: "sinCopia",
    claves: ["NoPortaArmas"],
    disparadas: [
      {
        zona: ["mano"],
        cuando: ["busca"],
        quien: "yo",
        opcional: true,
        hacer: [sel(["fuente"], {}, "yo"), { op: "jugarGratis", var: "yo" }],
      },
      {
        cuando: ["ataca"],
        opcional: true,
        hacer: [sel(["rival:aliados"], {}, "x"), { op: "fn", f: "obligar" }],
      },
    ],
    fns: {
      sinCopia,
      obligar: (e, ctx) => {
        for (const b of ctx.vars.x ?? []) N.agregarEfecto(e, { tipo: "debeBloquearA", uid: b, atacante: ctx.fuente }, ctx.ctrl);
      },
    },
  },
  "Azi Demoniaco": {
    activadas: [
      {
        texto: "Convertir este Aliado hasta tu próximo turno en un Oro que no puede salir del juego y ponerlo en tu Oro Pagado",
        momento: "tuTurno",
        veces: "turno",
        requiere: "esAliado",
        hacer: [
          sel(["fuente"], {}, "yo"),
          { op: "fn", f: "convertir" },
          efecto("yo", { tipo: "noSale" }, "proximoTurno"),
        ],
      },
    ],
    disparadas: [
      {
        cuando: ["faseFinal"],
        si: "esOro",
        hacer: [
          sel(["todos:cementerio"], {}, "c"),
          { op: "si", f: "hayC", entonces: [{ op: "modo", opciones: [{ texto: "Barajar", pasos: [mov("barajar", "c")] }, { texto: "Desterrar", pasos: [mov("desterrar", "c")] }] }] },
        ],
      },
    ],
    fns: {
      convertir: (e, ctx) => [{ op: "convertir", var: "yo", en: "Oro", a: "pagado", como: ctx.def, hasta: true, vuelve: "defensa" }],
      esAliado: (e, ctx) => !e.conv[ctx.fuente],
      esOro: (e, ctx) => !!e.conv[ctx.fuente],
      hayC: (e, ctx) => (ctx.vars.c ?? []).length > 0,
    },
  },
  "Bandidos Szgany": {
    claves: ["Furia"],
    disparadas: [{ cuando: ["entra", "ataca"], hacer: [botarTres] }],
    continuas: [{ botarUnoEsDos: true }, { fuerza: 1, a: "tusAliados", raza: "Bandido" }],
  },
  Blajini: {
    claves: ["Furia", "Exhumar"],
    disparadas: [
      {
        cuando: ["entra"],
        si: "desdeCementerio",
        hacer: [robar(2), sel(["yo:mano"], {}, "d", { hasta: true }), mov("cementerio", "d")],
      },
      {
        cuando: ["entra", "sale"],
        hacer: [
          castilloElegido((quien) => [{ op: "botar", n: 3, quien }]),
          sel(["yo:cementerio"], { noTipo: ["Talismán"] }, "s"),
          mov("mano", "s"),
        ],
      },
    ],
    fns: { desdeCementerio: (e, ctx) => ctx.datos.desde === "cementerio" },
  },
  "Camino del Inca": {
    claves: ["UnaCopia"],
    continuas: [{ impuestoSinPagar: true, zona: "reserva" }],
  },
  Cathach: {
    disparadas: [
      {
        cuando: ["entra"],
        opcional: true,
        hacer: [sel(["yo:cementerio"], {}, "c", { n: 2 }), mov("barajar", "c")],
      },
    ],
    continuas: [{ fuerza: -1, a: "aliadosRival", si: "soloDragones" }],
    fns: {
      soloDragones: (e, ctx) => N.aliadosDe(e, ctx.ctrl).every((a) => (N.carta(e, a).razas ?? []).includes("Dragón")),
    },
  },
  "Comer Insectos": {
    claves: ["Exhumar"],
    talisman: [
      sel(["yo:enJuego"], { conHabilidad: true, costeMin: 1 }, "x", { n: 2, hasta: true, para: "destruir" }),
      mov("destruir"),
      { op: "fn", f: "ganar" },
    ],
    fns: {
      ganar: (e, ctx) => {
        const k = (ctx.vars.x ?? []).filter((u) => !N.enJuego(e, u)).length;
        N.agregarEfecto(e, { tipo: "noPrevenible", aliadosDe: ctx.ctrl }, ctx.ctrl);
        if (!k) return;
        for (const a of N.aliadosDe(e, ctx.ctrl)) N.agregarEfecto(e, { tipo: "fuerza", n: k, uid: a }, ctx.ctrl);
      },
    },
  },
  "Falso Infante": {
    reduce: "red",
    disparadas: [
      {
        cuando: ["faseFinal"],
        hacer: [
          castilloElegido((quien) => [{ op: "desterrarTope", quien, n: 1, fondo: true }]),
          sel(["todos:cementerio"], {}, "c", { hasta: true }),
          mov("desterrar", "c"),
        ],
      },
    ],
    fns: { red: (e, ctx) => N.enJuegoDe(e, ctx.ctrl).filter((u) => N.tiene(e, u, "Exhumar")).length },
  },
  "Ghul Leal": {
    claves: ["Furia"],
    disparadas: [{ cuando: ["saleDelJuego"], veces: 3, si: "esAliado", hacer: [{ op: "botar", n: 1, quien: "rival" }] }],
    continuas: [{ furiaNoCambia: true }],
    fns: { esAliado: (e, ctx) => ctx.datos.tipo === "Aliado" },
  },
  Grimorio: {
    activadas: [
      {
        texto: "Pagar este Oro y barajar una carta de tu mano: buscar en el Castillo oponente una carta del mismo tipo y desterrarla con todas sus copias",
        requiere: "puede",
        coste: [sel(["fuente"], {}, "yo"), mov("pagado", "yo")],
        hacer: [sel(["yo:mano"], {}, "m"), mov("barajar", "m"), { op: "fn", f: "buscar" }],
      },
    ],
    fns: {
      puede: (e, ctx) => e.jugadores[ctx.ctrl].reserva.includes(ctx.fuente) && e.jugadores[ctx.ctrl].mano.length > 0,
      buscar: (e, ctx) => {
        const [m] = ctx.vars.m ?? [];
        if (!m) return [];
        return [sel(["rival:castillo"], { tipo: N.carta(e, m).tipo }, "b"), { op: "fn", f: "copias" }, barajar("rival")];
      },
      copias: (e, ctx) => {
        const [b] = ctx.vars.b ?? [];
        if (!b) return;
        const rivalJ = N.rival(ctx.ctrl);
        const nombre = N.carta(e, b).nombre;
        for (const u of [...e.jugadores[rivalJ].castillo]) if (N.carta(e, u).nombre === nombre) N.mover(e, u, "destierro");
      },
    },
  },
  Hiemal: {
    claves: ["NoAnulable"],
    talisman: [{ op: "fn", f: "dados" }],
    fns: {
      dados: (e) => {
        const r = [0, 1, 2].map(() => Math.floor(N.azar(e) * 6) + 1);
        const pasos = [];
        const pares = r.filter((x) => x % 2 === 0).length;
        if (pares) pasos.push({ op: "botar", n: 3 * pares, quien: "rival" });
        if (r.includes(1)) pasos.push({ op: "generar", n: 1, tipos: ["Aliado", "Talismán"] });
        return pasos;
      },
    },
  },
};
