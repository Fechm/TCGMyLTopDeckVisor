import * as N from "../nucleo.js";
import { sel, mov, robar, efecto, castilloElegido, coste } from "../formato.js";

const botar = (n, quien = "rival") => ({ op: "botar", n, quien });

const pagaImpuesto = (e, ctrl) =>
  N.cuantas(e, ctrl, (k) => k.impuestoTalisman) + e.efectos.filter((f) => f.tipo === "impuestoTalisman").length > 0 ||
  N.hay(e, ctrl, (k, propio) => !propio && k.rivalImpuestoCoste0);

export const HABILIDADES = {
  Ileana: {
    claves: ["Indestructible"],
    activadas: [
      {
        texto: "Guerra de Talismanes: tu oponente Bota una carta por cada Aliado de tu Línea de Defensa",
        momento: "talismanes",
        veces: "turno",
        hacer: [{ op: "botar", nf: "defensores", quien: "rival" }],
      },
    ],
    disparadas: [{ cuando: ["faseFinal"], opcional: true, hacer: [sel(["todos:cementerio"], {}, "c", { n: 2, hasta: true }), mov("desterrar", "c")] }],
    fns: { defensores: (e, ctx) => e.jugadores[ctx.ctrl].defensa.length },
  },
  Keshalyi: {
    disparadas: [
      { cuando: ["juega"], quien: "yo", veces: 2, si: "esTalisman", hacer: [robar(1), sel(["yo:mano"], {}, "m"), mov("barajar", "m"), botar(3)] },
      { cuando: ["faseFinal"], si: "jugoOtroAliado", opcional: true, hacer: [sel(["todos:cementerio"], {}, "c", { n: 3, hasta: true }), mov("desterrar", "c")] },
    ],
    continuas: [{ fuerza: -1, a: "aliadosRival" }],
    fns: {
      esTalisman: (e, ctx) => ctx.datos.tipo === "Talismán",
      jugoOtroAliado: (e, ctx) => {
        const jugadas = e.jugadores[ctx.ctrl].jugadas;
        return (jugadas.Aliado ?? 0) - (jugadas.nombres.Keshalyi ?? 0) > 0;
      },
    },
  },
  "Legua Muerta": {
    reduce: "red",
    talisman: [sel(["todos:aliados"], {}, "x", { n: 99 }), { op: "fn", f: "recordar" }, mov("barajar", "x"), { op: "fn", f: "botarPorBarajados" }],
    fns: {
      red: (e, ctx) => N.orosDe(e, ctx.ctrl).filter((u) => N.activa(e, u)).length,
      recordar: (e, ctx) => {
        ctx.vars.r = (ctx.vars.x ?? []).filter((u) => N.controlador(e, u) !== ctx.ctrl);
      },
      botarPorBarajados: (e, ctx) => {
        const n = (ctx.vars.r ?? []).filter((u) => N.ubicar(e, u)?.zona === "castillo").length;
        if (n) N.quitarDelCastillo(e, N.rival(ctx.ctrl), n, "cementerio");
      },
    },
  },
  "Leon Indiferente": {
    costeExtra: "extra",
    talisman: [
      { op: "fn", f: "recordarPago" },
      castilloElegido((quien) => [
        { op: "tope", quien, n: 2, como: "t" },
        { op: "convertir", var: "t", en: "Aliado", fuerza: 2, a: "defensa" },
        efecto("t", { tipo: "noSale" }, "proximoTurno"),
        efecto("t", { tipo: "noCambia" }, "proximoTurno"),
      ]),
      { op: "si", f: "pago", entonces: [robar(2)] },
    ],
    fns: {
      extra: (e, ctx) => (N.aliadosDe(e, ctx.ctrl).length > 0 ? 1 : 0),
      recordarPago: (e, ctx) => {
        ctx.vars.pago = N.aliadosDe(e, ctx.ctrl).length > 0 || pagaImpuesto(e, ctx.ctrl);
      },
      pago: (e, ctx) => ctx.vars.pago === true,
    },
  },
  "Lobos de los Cárpatos": {
    claves: ["Furia"],
    disparadas: [
      {
        cuando: ["entra"],
        hacer: [
          {
            op: "opcional",
            texto: "Descartar o Destruir una carta que controles: robar dos cartas y ganar 1 de Fuerza",
            requiere: "puede",
            pasos: [
              {
                op: "modo",
                opciones: [
                  { texto: "Descartar una carta de tu mano", requiere: { de: ["yo:mano"], filtro: {} }, pasos: [sel(["yo:mano"], {}, "d"), mov("cementerio", "d")] },
                  {
                    texto: "Destruir una carta que controles",
                    requiere: { de: ["yo:enJuego"], filtro: {}, para: "destruir" },
                    pasos: [sel(["yo:enJuego"], {}, "d", { para: "destruir" }), mov("destruir", "d")],
                  },
                ],
              },
              robar(2),
              sel(["fuente"], {}, "yo"),
              efecto("yo", { tipo: "fuerza", n: 1 }, "mientras"),
            ],
          },
        ],
      },
    ],
    continuas: [{ limiteBarajarCementerio: true }],
    fns: {
      puede: (e, ctx) => e.jugadores[ctx.ctrl].mano.length > 0 || N.enJuegoDe(e, ctx.ctrl).some((u) => !N.tiene(e, u, "Indestructible")),
    },
  },
  "Los Szgany": {
    claves: ["Furia"],
    disparadas: [
      { cuando: ["ataca"], hacer: [sel(["rival:aliados"], {}, "b"), sel(["yo:ataque"], {}, "a"), { op: "fn", f: "forzar" }] },
      { cuando: ["saleDelJuego", "sale"], quien: "yo", veces: 1, si: "esAliado", opcional: true, hacer: [botar(3)] },
    ],
    fns: {
      forzar: (e, ctx) => {
        for (const uid of ctx.vars.b ?? []) {
          for (const atacante of ctx.vars.a ?? []) N.agregarEfecto(e, { tipo: "debeBloquearA", uid, atacante }, ctx.ctrl);
        }
      },
      esAliado: (e, ctx) => !ctx.datos.tipo || ctx.datos.tipo === "Aliado",
    },
  },
  "Manu Tara": {
    continuas: [{ zona: "reserva", si: "conAliadosDeCoste", otrosOrosSinHabilidad: true }],
    disparadas: [{ cuando: ["alCementerio"], quien: "yo", veces: 1, opcional: true, hacer: [{ op: "fn", f: "cargar" }, mov("barajar", "c")] }],
    fns: {
      conAliadosDeCoste: (e, ctx) => N.aliadosDe(e, ctx.ctrl).some((u) => coste(e, u) >= 1),
      cargar: (e, ctx) => {
        ctx.vars.c = [ctx.datos.uid];
      },
    },
  },
  "Monjas de Budapest": {
    disparadas: [{ cuando: ["entra"], hacer: [sel(["yo:cementerio"], { tipo: "Tótem", costeMax: 3 }, "a", { hasta: true }), { op: "fn", f: "segundo" }] }],
    activadas: [
      {
        texto: "Barajar y/o Desterrar hasta tres cartas de los Cementerios",
        momento: "vigilia",
        veces: "turno",
        hacer: [
          sel(["todos:cementerio"], {}, "c", { n: 3, hasta: true }),
          mov("barajar", "c"),
          sel(["todos:cementerio"], {}, "d", { nf: "resto", hasta: true }),
          mov("desterrar", "d"),
        ],
      },
    ],
    fns: {
      segundo: (e, ctx) => {
        const [a] = ctx.vars.a ?? [];
        if (!a) return [];
        return [sel(["yo:cementerio"], { tipo: "Tótem", costeMax: 3 - coste(e, a), excluir: [a] }, "a2", { hasta: true }), { op: "fn", f: "jugar" }];
      },
      jugar: (e, ctx) => {
        ctx.vars.t = [...(ctx.vars.a ?? []), ...(ctx.vars.a2 ?? [])];
        return [{ op: "jugarGratis", var: "t" }];
      },
      resto: (e, ctx) => 3 - (ctx.vars.c ?? []).length,
    },
  },
  "Monjes Ortodoxos": {
    disparadas: [
      {
        cuando: ["entra"],
        opcional: true,
        hacer: [
          {
            op: "modo",
            opciones: [
              {
                texto: "Usar la habilidad de entrada de un Tótem de coste 2 o menos",
                requiere: { de: ["todos:apoyo"], filtro: { tipo: "Tótem", costeMax: 2 } },
                pasos: [sel(["todos:apoyo"], { tipo: "Tótem", costeMax: 2 }, "t"), { op: "fn", f: "usar" }],
              },
              { texto: "Generar un Oro para jugar Tótem por el turno", pasos: [{ op: "generar", n: 1, tipos: ["Tótem"] }] },
            ],
          },
        ],
      },
    ],
    activadas: [
      {
        texto: "Hasta un Tótem de tu Cementerio gana Exhumar y robas dos cartas",
        veces: "turno",
        hacer: [sel(["yo:cementerio"], { tipo: "Tótem" }, "c", { hasta: true }), efecto("c", { tipo: "gana", clave: "Exhumar" }, "turno"), robar(2)],
      },
    ],
    fns: {
      usar: (e, ctx) => {
        for (const uid of ctx.vars.t ?? []) {
          if (!N.activa(e, uid)) continue;
          const d = N.carta(e, uid);
          for (const t of d.disparadas) {
            if (!t.cuando.includes("entra")) continue;
            const pasos = t.opcional ? [{ op: "opcional", texto: d.nombre, pasos: t.hacer }] : t.hacer;
            e.cola.unshift(N.nuevoFrame(pasos, { ctrl: ctx.ctrl, fuente: uid, def: d.id, costeFuente: d.coste ?? 0, datos: { uid, j: ctx.ctrl } }));
          }
        }
      },
    },
  },
  Moroi: {
    claves: ["Furia"],
    disparadas: [
      {
        cuando: ["entra"],
        opcional: true,
        hacer: [sel(["yo:castillo"], { tipo: "Aliado", costeMin: 2, costeMax: 2 }, "b"), { op: "jugarGratis", var: "b" }, { op: "barajarCastillo", quien: "yo" }],
      },
    ],
    continuas: [{ fuerza: 1, a: "tusAliados" }, { gana: "Imbloqueable", a: "tusAliados" }],
  },
  Mortaja: {
    talisman: [sel(["todos:aliados"], {}, "x", { n: 99 }), mov("barajar", "x")],
    activadas: [
      {
        texto: "Pagar un Oro y ponerla al fondo de tu Castillo: subir hasta dos cartas que no sean Talismán de tu Cementerio a tu mano",
        zona: "mano",
        oros: 1,
        hacer: [sel(["fuente"], {}, "yo"), mov("fondo", "yo"), sel(["yo:cementerio"], { noTipo: ["Talismán"] }, "c", { n: 2, hasta: true }), mov("mano", "c")],
      },
    ],
  },
  "No Más Magia": {
    destierroAlJugar: true,
    talisman: [
      { op: "efecto", efecto: { tipo: "impuestoTalisman" }, fin: "juego" },
      { op: "efecto", efecto: { tipo: "impuestoSinPagar" }, fin: "juego" },
    ],
  },
};
