import * as N from "../nucleo.js";
import { sel, mov, barajar, robar, efecto, buscar, castilloElegido, coste } from "../formato.js";

const desterrarFuente = [sel(["fuente"], {}, "yo"), mov("desterrar", "yo")];

const desdeCementerio = (texto, hacer, extra = {}) => ({ texto, zona: "cementerio", coste: desterrarFuente, hacer, ...extra });

const barajarODesterrar = (v = "x") => ({
  op: "modo",
  opciones: [
    { texto: "Barajar", pasos: [mov("barajar", v)] },
    { texto: "Desterrar", pasos: [mov("desterrar", v)] },
  ],
});

const miTurno = (e, ctx) => e.activo === ctx.ctrl;

const hayAliados = { de: ["todos:aliados"], filtro: {} };

const TIPOS = ["Aliado", "Arma", "Tótem", "Oro", "Talismán"];

export const HABILIDADES = {
  "Maldición Vudú": {
    requiere: "miTurno",
    talisman: [{ op: "fn", f: "marcar" }, sel(["todos:enJuego"]), efecto("x", { tipo: "pierdeHabilidad" }, "turno")],
    disparadas: [{ zona: ["cementerio"], cuando: ["faseFinal"], quien: "yo", si: "jugadaHoy", hacer: [{ op: "fn", f: "aPagado" }] }],
    activadas: [
      desdeCementerio("Desterrarlo del Cementerio: Barajar o Desterrar una carta de un Cementerio", [sel(["todos:cementerio"]), barajarODesterrar()], { requiere: "otraEnCementerio" }),
    ],
    fns: {
      miTurno,
      marcar: (e, ctx) => {
        e.usos[`vudu|${ctx.fuente}`] = e.turno;
      },
      jugadaHoy: (e, ctx) => e.usos[`vudu|${ctx.fuente}`] === e.turno,
      aPagado: (e, ctx) => {
        const p = e.jugadores[ctx.ctrl];
        p.pagado.push(...p.reserva.splice(0));
      },
      otraEnCementerio: (e, ctx) => [0, 1].some((j) => e.jugadores[j].cementerio.some((u) => u !== ctx.fuente)),
    },
  },
  "Manipular Destino": {
    unoPorTurno: true,
    reduce: "red",
    talisman: [sel(["todos:enJuego"], { costeMax: 2 }), mov("barajar"), robar(2)],
    fns: { red: (e, ctx) => N.enJuegoDe(e, ctx.ctrl).filter((u) => coste(e, u) >= 2).length },
  },
  "Mano de Destruccion": {
    talisman: [
      {
        op: "modo",
        opciones: [
          {
            texto: "Convertir un Oro oponente en un Oro sin habilidad",
            requiere: { de: ["rival:oros"], filtro: {} },
            pasos: [sel(["rival:oros"]), { op: "fn", f: "sinHabilidad" }],
          },
          {
            texto: "Una carta de coste 4 o menos pierde su habilidad y es Desterrada",
            requiere: { de: ["todos:enJuego"], filtro: { costeMax: 4 }, para: "desterrar" },
            pasos: [sel(["todos:enJuego"], { costeMax: 4 }, "x", { para: "desterrar" }), efecto("x", { tipo: "pierdeHabilidad" }, "mientras"), mov("desterrar")],
          },
        ],
      },
    ],
    activadas: [
      desdeCementerio("Desterrarlo del Cementerio: buscar un Oro en tu Castillo (a tu Oro Pagado si es tu turno y no pusiste Oros; si no, a tu mano)", [
        sel(["yo:castillo"], { tipo: "Oro" }, "b"),
        { op: "si", f: "alPagado", entonces: [{ op: "ponerOro", var: "b", a: "pagado" }], sino: [mov("mano", "b")] },
        barajar(),
      ]),
    ],
    fns: {
      sinHabilidad: (e, ctx) => {
        for (const u of ctx.vars.x ?? []) e.conv[u] = { tipo: "Oro", sinHabilidad: true };
      },
      alPagado: (e, ctx) => e.activo === ctx.ctrl && e.jugadores[ctx.ctrl].orosPuestos === 0,
    },
  },
  "Manzana Envenenada": {
    requiere: { de: ["todos:enJuego"], filtro: { costeMax: 3 }, para: "desterrar" },
    talisman: [sel(["todos:enJuego"], { costeMax: 3 }, "x", { para: "desterrar" }), mov("desterrar")],
    disparadas: [
      { zona: ["cementerio"], cuando: ["anulada"], quien: "propia", hacer: [sel(["fuente"], {}, "yo"), { op: "convertir", var: "yo", en: "Oro", a: "pagado" }] },
      {
        zona: ["cementerio"],
        cuando: ["alCementerio", "salenDelCastillo"],
        quien: "cualquiera",
        si: "llegaEnTurnoRival",
        opcional: true,
        hacer: [...desterrarFuente, { op: "desterrarTope", n: 2, quien: "rival" }],
      },
    ],
    fns: {
      llegaEnTurnoRival: (e, ctx) =>
        e.activo !== ctx.ctrl && (ctx.datos.uid === ctx.fuente || (ctx.datos.zona === "cementerio" && (ctx.datos.uids ?? []).includes(ctx.fuente))),
    },
  },
  "Marca de la Bestia": {
    requiere: { de: ["todos:aliados"], filtro: { costeMax: 2 } },
    talisman: [
      sel(["todos:aliados"], { costeMax: 2 }),
      efecto("x", { tipo: "gana", clave: "Furia" }, "proximoTurno"),
      efecto("x", { tipo: "gana", clave: "Indestructible" }, "proximoTurno"),
      efecto("x", { tipo: "noCambia" }, "proximoTurno"),
      efecto("x", { tipo: "debeAtacar" }, "turno"),
    ],
  },
  "Marca de los Justos": {
    activadas: [
      desdeCementerio("Desterrarlo del Cementerio: un Aliado gana 1 de Fuerza por el turno", [sel(["todos:aliados"]), efecto("x", { tipo: "fuerza", n: 1 }, "turno")], {
        requiere: hayAliados,
      }),
    ],
  },
  "Marcha Sobre Versalles": {
    talisman: [
      {
        op: "si",
        f: "masDeUnOro",
        entonces: [sel(["rival:oros"], {}, "x", { para: "desterrar" }), mov("desterrar")],
        sino: [sel(["rival:enJuego"], { costeMax: 2 }, "x", { para: "desterrar" }), mov("desterrar"), robar(1)],
      },
    ],
    fns: { masDeUnOro: (e, ctx) => e.jugadores[N.rival(ctx.ctrl)].orosPuestos > 1 },
  },
  "Miedo en Whitby": {
    talisman: [{ op: "fn", f: "miedo" }],
    fns: {
      miedo: (e, ctx) => {
        const r = N.rival(ctx.ctrl);
        let a = null;
        let b = null;
        for (const u of e.jugadores[r].castillo) {
          if (N.carta(e, u).tipo !== "Aliado") continue;
          if (a === null) a = coste(e, u);
          else if (coste(e, u) !== a) {
            b = coste(e, u);
            break;
          }
        }
        if (b === null) return;
        N.quitarDelCastillo(e, r, Math.max(a, b), "cementerio");
        N.robar(e, ctx.ctrl, Math.min(a, b));
      },
    },
  },
  "Misil de Montu": {
    talisman: [sel(["yo:aliados"], {}, "a", { n: 99 }), efecto("a", { tipo: "fuerza", n: 3 }), efecto("a", { tipo: "gana", clave: "DanoAlDestierro" })],
    activadas: [{ texto: "Barajarlo desde tu mano para Robar una carta", zona: "mano", hacer: [sel(["fuente"], {}, "yo"), mov("barajar", "yo"), robar(1)] }],
  },
  "Misiles de Rastreo": {
    talisman: [
      ...buscar(["todos:castillo"], { tipo: "Oro", f: "copiaEnJuego" }, "reserva"),
      sel(["rival:enJuego"], { costeMax: 3 }, "x", { para: "desterrar" }),
      mov("desterrar"),
    ],
    activadas: [
      desdeCementerio(
        "Pagar un Oro y Desterrarlo del Cementerio: Barajar hasta cuatro cartas de los Cementerios y Robar dos",
        [sel(["todos:cementerio"], {}, "c", { n: 4, hasta: true }), mov("barajar", "c"), robar(2)],
        { oros: 1 },
      ),
    ],
    fns: {
      copiaEnJuego: (e, ctx, u) => N.todoEnJuego(e).some((o) => N.carta(e, o).tipo === "Oro" && N.carta(e, o).nombre === N.carta(e, u).nombre),
    },
  },
  Momificar: {
    talisman: [sel(["yo:cementerio"], { tipo: "Aliado" }, "a"), sel(["rival:cementerio"], { tipo: "Aliado" }, "b", { quien: "rival" }), { op: "fn", f: "momificar" }],
    fns: {
      momificar: (e, ctx, api) => {
        for (const [v, j] of [["a", ctx.ctrl], ["b", N.rival(ctx.ctrl)]]) {
          for (const u of ctx.vars[v] ?? []) api.entrarEnJuego(e, u, j, undefined, { pagado: false, desde: "cementerio" });
        }
      },
    },
  },
  "Monstruo de la Laguna": {
    talisman: [
      robar(1),
      sel(["yo:castillo"], { tipo: "Aliado" }, "b"),
      {
        op: "si",
        f: "busco",
        entonces: [
          {
            op: "modo",
            opciones: [
              { texto: "A tu mano", pasos: [mov("mano", "b")] },
              { texto: "A tu Cementerio", pasos: [mov("cementerio", "b")] },
            ],
          },
        ],
      },
      { op: "si", f: "dino", entonces: [sel(["yo:castillo"], { tipo: "Aliado" }, "c"), mov("cementerio", "c")] },
      barajar(),
    ],
    fns: {
      busco: (e, ctx) => (ctx.vars.b ?? []).length > 0,
      dino: (e, ctx) => (ctx.vars.b ?? []).some((u) => (N.carta(e, u).razas ?? []).includes("Dinosaurio")),
    },
  },
  "Mordida de Vampiro": {
    destierroAlJugar: true,
    requiere: { de: ["todos:enJuego"], filtro: { costeMax: 2 } },
    talisman: [
      sel(["todos:enJuego"], { costeMax: 2 }),
      { op: "fn", f: "recordar" },
      barajarODesterrar(),
      ...buscar(["todos:castillo"], { f: "copia" }, "desterrar"),
      castilloElegido((quien) => [{ op: "desterrarTope", quien, fondo: true, nf: "mordidas" }]),
    ],
    fns: {
      recordar: (e, ctx) => {
        ctx.vars.nombres = (ctx.vars.x ?? []).map((u) => N.carta(e, u).nombre);
      },
      copia: (e, ctx, u) => !(ctx.vars.x ?? []).includes(u) && (ctx.vars.nombres ?? []).includes(N.carta(e, u).nombre),
      mordidas: (e, ctx) => 1 + e.jugadores[ctx.ctrl].destierro.filter((u) => u !== ctx.fuente && N.carta(e, u).nombre === "Mordida de Vampiro").length,
    },
  },
  "Motin a Bordo": {
    destierroAlJugar: true,
    talisman: [
      {
        op: "modo",
        opciones: [
          { texto: "No eres afectado por habilidades y efectos oponentes este turno y Robas una carta", pasos: [robar(1)] },
          {
            texto: "No pagas costes adicionales este turno y Subes hasta un Aliado de coste 2 o menos a la mano",
            pasos: [sel(["todos:aliados"], { costeMax: 2 }, "x", { hasta: true }), mov("mano")],
          },
        ],
      },
    ],
  },
  "Muñeco Vudú": {
    requiere: "vigiliaConFuria",
    talisman: [sel(["rival:mano"], { tipo: ["Talismán", "Tótem"] }), mov("barajar")],
    activadas: [
      {
        texto: "Un Aliado gana 2 de Fuerza permanentemente",
        zona: "cementerio",
        momento: "vigilia",
        veces: "turno",
        requiere: hayAliados,
        hacer: [sel(["todos:aliados"]), efecto("x", { tipo: "fuerza", n: 2 }, "mientras")],
      },
    ],
    fns: {
      vigiliaConFuria: (e, ctx) => e.fase === "vigilia" && e.activo === ctx.ctrl && N.aliadosDe(e, ctx.ctrl).some((a) => N.tiene(e, a, "Furia")),
    },
  },
  Nautilus: {
    claves: ["Exhumar"],
    talisman: [
      sel(["yo:enJuego"], {}, "a", { n: 2, hasta: true }),
      mov("barajar", "a"),
      sel(["rival:aliados"], {}, "b", { nf: "cuantas", quien: "rival" }),
      efecto("b", { tipo: "pierdeHabilidad" }, "mientras"),
      mov("barajar", "b"),
    ],
    fns: { cuantas: (e, ctx) => (ctx.vars.a ?? []).length },
  },
  "Niebla Cuantica": {
    exhumarSi: "tresIguales",
    talisman: [
      { op: "tope", n: 7, como: "m" },
      { op: "tope", n: 7, quien: "rival", como: "r" },
      sel(["var:r"], {}, "d", { nf: "aliadosMostrados" }),
      mov("desterrar", "d"),
    ],
    fns: {
      aliadosMostrados: (e, ctx) => (ctx.vars.m ?? []).filter((u) => N.carta(e, u).tipo === "Aliado").length,
      tresIguales: (e, ctx) => {
        const mano = e.jugadores[ctx.ctrl].mano;
        const repetido = (f) => {
          const n = {};
          for (const u of mano) n[f(u)] = (n[f(u)] ?? 0) + 1;
          return Object.values(n).some((k) => k >= 3);
        };
        return repetido((u) => N.carta(e, u).tipo) || repetido((u) => coste(e, u));
      },
    },
  },
  "Niebla de Muerte": {
    talisman: [sel(["todos:enJuego"], { costeMax: 3 }, "x", { hasta: true, para: "destruir" }), mov("destruir"), { op: "botar", n: 7, quien: "rival" }],
  },
  "Nimas de Cucao": {
    talisman: [{ op: "modo", opciones: TIPOS.map((tipo) => ({ texto: tipo, pasos: [{ op: "fn", f: "silenciar", tipo }] })) }],
    fns: {
      silenciar: (e, ctx, api, p) => {
        for (const u of N.todoEnJuego(e)) if (N.carta(e, u).tipo === p.tipo) N.agregarEfecto(e, { tipo: "pierdeHabilidad", uid: u, fin: "proximoTurno" }, ctx.ctrl);
      },
    },
  },
  "No Mas Bichos": {
    claves: ["NoAnulable"],
    talisman: [sel(["todos:enJuego"], { costeMax: 1 }, "x", { n: 99 }), mov("barajar"), { op: "robar", nf: "cinco" }],
    activadas: [
      {
        texto: "Descartar una carta: Barajar este Talismán desde tu Cementerio en tu Castillo",
        zona: "cementerio",
        requiere: "conMano",
        coste: [sel(["yo:mano"], {}, "d"), mov("cementerio", "d")],
        hacer: [sel(["fuente"], {}, "yo"), mov("barajar", "yo")],
      },
    ],
    fns: {
      cinco: (e, ctx) => Math.max(0, 5 - (ctx.vars.x ?? []).filter((u) => N.ubicar(e, u)?.zona === "castillo").length),
      conMano: (e, ctx) => e.jugadores[ctx.ctrl].mano.length > 0,
    },
  },
  "Ofrenda a los Abuelos": {
    talisman: [castilloElegido((quien) => [sel([`${quien}:castillo`], { f: "otroNombre" }, "a", { n: 2, hasta: true }), mov("desterrar", "a"), barajar(quien)])],
    fns: { otroNombre: (e, ctx, u) => !(ctx.vars.a ?? []).some((x) => N.carta(e, x).nombre === N.carta(e, u).nombre) },
  },
  "Ofrendas al Dragón": {
    claves: ["Exhumar"],
    talisman: [
      sel(["todos:cementerio"], {}, "c", { n: 4, hasta: true }),
      mov("barajar", "c"),
      sel(["todos:cementerio"], {}, "d", { nf: "resto", hasta: true }),
      mov("desterrar", "d"),
      { op: "si", f: "cuatroTipos", entonces: [{ op: "generar", n: 1 }] },
    ],
    activadas: [
      {
        texto: "Descartar este Talismán: un Arma o Tótem pierde su habilidad por el turno",
        zona: "mano",
        requiere: { de: ["todos:enJuego"], filtro: { tipo: ["Arma", "Tótem"] } },
        coste: [sel(["fuente"], {}, "yo"), mov("cementerio", "yo")],
        hacer: [sel(["todos:enJuego"], { tipo: ["Arma", "Tótem"] }), efecto("x", { tipo: "pierdeHabilidad" }, "turno")],
      },
    ],
    fns: {
      resto: (e, ctx) => 4 - (ctx.vars.c ?? []).length,
      cuatroTipos: (e, ctx) => {
        const t = [...(ctx.vars.c ?? []), ...(ctx.vars.d ?? [])];
        return t.length === 4 && new Set(t.map((u) => N.carta(e, u).tipo)).size === 4;
      },
    },
  },
  "Orden Restaurado": {
    talisman: [
      sel(["yo:castillo"], { tipo: "Aliado", costeMin: 1, costeMax: 1 }, "b"),
      { op: "jugarGratis", var: "b" },
      efecto("b", { tipo: "gana", clave: "Furia" }, "mientras"),
      barajar(),
    ],
    activadas: [
      desdeCementerio("Desterrarla del Cementerio: una carta gana Indestructible este turno", [sel(["todos:enJuego"]), efecto("x", { tipo: "gana", clave: "Indestructible" }, "turno")], {
        requiere: { de: ["todos:enJuego"], filtro: {} },
      }),
    ],
  },
  Oriflama: {
    claves: ["Exhumar"],
    talisman: [sel(["todos:aliados"], { f: "portaArma" }, "a", { n: 2, hasta: true }), { op: "fn", f: "potenciar" }],
    fns: {
      portaArma: (e, ctx, u) => (e.armas[u] ?? []).length > 0,
      potenciar: (e, ctx) => {
        const n = N.armasDe(e, ctx.ctrl).length;
        for (const uid of ctx.vars.a ?? []) {
          N.agregarEfecto(e, { tipo: "gana", clave: "Furia", uid, fin: "proximoTurno" }, ctx.ctrl);
          if (n) N.agregarEfecto(e, { tipo: "fuerza", n, uid, fin: "proximoTurno" }, ctx.ctrl);
          N.agregarEfecto(e, { tipo: "noSale", uid, fin: "proximoTurno" }, ctx.ctrl);
        }
      },
    },
  },
  "Pacto Sangriento": {
    talisman: [
      sel(["rival:aliados"], {}, "a", { nf: "sobranAliados", quien: "rival" }),
      sel(["rival:oros"], {}, "o", { nf: "sobranOros", quien: "rival" }),
      { op: "fn", f: "pacto" },
      robar(2),
    ],
    fns: {
      sobranAliados: (e, ctx) => Math.max(0, N.aliadosDe(e, N.rival(ctx.ctrl)).length - N.aliadosDe(e, ctx.ctrl).length),
      sobranOros: (e, ctx) => Math.max(0, N.orosDe(e, N.rival(ctx.ctrl)).length - N.orosDe(e, ctx.ctrl).length),
      pacto: (e, ctx) => {
        const lista = [...(ctx.vars.a ?? []), ...(ctx.vars.o ?? [])];
        const tomar = lista.length <= 3;
        for (const u of lista) {
          const j = tomar && N.puedeTomar(e, u, ctx.ctrl) ? ctx.ctrl : N.controlador(e, u);
          for (const a of [...(e.armas[u] ?? [])]) N.mover(e, a, "cementerio");
          delete e.armas[u];
          delete e.ganadas[u];
          N.mover(e, u, "apoyo", { j });
          for (const p of e.jugadores) p.nuevos = p.nuevos.filter((x) => x !== u);
          e.conv[u] = { tipo: "Tótem", sinHabilidad: true };
        }
      },
    },
  },
};
