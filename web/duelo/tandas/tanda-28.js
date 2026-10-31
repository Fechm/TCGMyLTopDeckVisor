import * as N from "../nucleo.js";
import { sel, mov, barajar, robar, efecto, buscar, coste } from "../formato.js";

const totems = (e, j) => e.jugadores[j].apoyo.filter((u) => N.carta(e, u).tipo === "Tótem");

const nTotems = (e, ctx) => totems(e, ctx.ctrl).length;

const sinAliados = (e, ctx) => N.aliadosDe(e, ctx.ctrl).length === 0;

const agruparOro = [sel(["yo:pagado"], { tipo: "Oro" }, "o"), mov("reserva", "o")];

const barajarOdesterrar = (como) => ({
  op: "modo",
  opciones: [
    { texto: "Barajar", pasos: [mov("barajar", como)] },
    { texto: "Desterrar", pasos: [mov("desterrar", como)] },
  ],
});

const totemsCoste1 = (n) => (e, ctx) => totems(e, ctx.ctrl).filter((u) => coste(e, u) >= 1).length >= n;

const aAliado = (v) => ({ op: "convertir", var: v, en: "Aliado", fuerza: 3, a: "defensa" });

export const HABILIDADES = {
  "Ciudad Sin Nombre": {
    activadas: [
      {
        texto: "Un Aliado gana 5 de Fuerza por el turno",
        veces: "turno",
        requiere: { de: ["todos:aliados"], filtro: {} },
        hacer: [sel(["todos:aliados"]), efecto("x", { tipo: "fuerza", n: 5 })],
      },
      {
        texto: "Descartar dos cartas: subir una carta de tu Cementerio a tu mano",
        veces: "turno",
        requiere: "dosEnMano",
        coste: [sel(["yo:mano"], {}, "d", { n: 2 }), mov("cementerio", "d")],
        hacer: [sel(["yo:cementerio"], {}, "c"), mov("mano", "c")],
      },
    ],
    fns: { dosEnMano: (e, ctx) => e.jugadores[ctx.ctrl].mano.length >= 2 },
  },
  "Ciudad de los Cesares": {
    disparadas: [
      {
        cuando: ["entra", "sale"],
        hacer: [sel(["rival:enJuego"], { costeMax: 3 }, "x", { hasta: true }), mov("barajar"), robar(2)],
      },
    ],
    activadas: [
      {
        texto: "Barajar una carta de tu mano para Desterrar una carta de coste 1 o menos",
        veces: "turno",
        requiere: "puede",
        coste: [sel(["yo:mano"], {}, "m"), mov("barajar", "m")],
        hacer: [sel(["todos:enJuego"], { costeMax: 1 }, "x", { para: "desterrar" }), mov("desterrar")],
      },
    ],
    fns: {
      puede: (e, ctx) => e.jugadores[ctx.ctrl].mano.length > 0 && N.todoEnJuego(e).some((u) => coste(e, u) <= 1 && !N.tiene(e, u, "Indesterrable")),
    },
  },
  "Ciudadela Furia": {
    claves: ["NoBarajable"],
    activadas: [
      {
        texto: "Barajar un Aliado o Tótem oponente y Descartar tantas cartas como su coste",
        momento: "vigilia",
        veces: "turno",
        requiere: { de: ["rival:enJuego"], filtro: { tipo: ["Aliado", "Tótem"] } },
        hacer: [sel(["rival:enJuego"], { tipo: ["Aliado", "Tótem"] }), { op: "fn", f: "descartar" }],
      },
    ],
    disparadas: [{ cuando: ["comienzoVigilia"], quien: "rival", si: "sinReserva", opcional: true, hacer: agruparOro }],
    fns: {
      descartar: (e, ctx) => {
        const n = (ctx.vars.x ?? []).reduce((s, u) => s + coste(e, u), 0);
        return [mov("barajar"), sel(["yo:mano"], {}, "d", { n }), mov("cementerio", "d")];
      },
      sinReserva: (e, ctx) => e.jugadores[ctx.ctrl].reserva.length === 0 && e.jugadores[ctx.ctrl].pagado.length > 0,
    },
  },
  "Cueva de Montesinos": {
    disparadas: [{ cuando: ["entra"], hacer: [robar(2)] }],
    activadas: [
      {
        texto: "Destruir este Tótem: tu oponente Bota cuatro cartas o Descarta una carta",
        coste: [sel(["fuente"], {}, "yo"), mov("destruir", "yo")],
        hacer: [
          {
            op: "modo",
            opciones: [
              { texto: "Tu oponente Bota cuatro cartas", pasos: [{ op: "botar", n: 4, quien: "rival" }] },
              { texto: "Tu oponente Descarta una carta", pasos: [sel(["rival:mano"], {}, "d", { quien: "rival" }), mov("cementerio", "d")] },
            ],
          },
        ],
      },
    ],
  },
  "Cueva de Salamanca": {
    reduce: "red",
    activadas: [
      {
        texto: "Poner cartas de tu mano en el fondo del Castillo y Robar la misma cantidad",
        veces: "turno",
        requiere: "conMano",
        hacer: [sel(["yo:mano"], {}, "x", { n: 99, hasta: true }), { op: "fn", f: "cambiar" }],
      },
    ],
    fns: {
      red: (e, ctx) => ([...N.aliadosDe(e, ctx.ctrl), ...totems(e, ctx.ctrl)].some((u) => coste(e, u) >= 1) ? 1 : 0),
      conMano: (e, ctx) => e.jugadores[ctx.ctrl].mano.length > 0,
      cambiar: (e, ctx) => {
        const lista = ctx.vars.x ?? [];
        for (const u of lista) N.mover(e, u, "castillo", { fondo: true });
        N.robar(e, ctx.ctrl, lista.length);
      },
    },
  },
  "Cueva de Xalpen": {
    activadas: [
      {
        texto: "Buscar un Arma o Tótem de coste 2 o más, o generar un Oro para Armas o Tótems",
        momento: "vigilia",
        veces: "turno",
        hacer: [
          {
            op: "modo",
            opciones: [
              { texto: "Buscar un Arma o Tótem de coste 2 o más", pasos: buscar(["yo:castillo"], { tipo: ["Arma", "Tótem"], costeMin: 2 }) },
              { texto: "Generar un Oro para Armas o Tótems", pasos: [{ op: "generar", n: 1, tipos: ["Arma", "Tótem"] }] },
            ],
          },
        ],
      },
      {
        texto: "Un Aliado tiene Fuerza 0 o duplica su Fuerza por el turno",
        veces: "turno",
        requiere: { de: ["todos:aliados"], filtro: {} },
        hacer: [
          sel(["todos:aliados"]),
          {
            op: "modo",
            opciones: [
              { texto: "Fuerza 0", pasos: [{ op: "fn", f: "cero" }] },
              { texto: "Duplicar su Fuerza", pasos: [{ op: "fn", f: "doble" }] },
            ],
          },
        ],
      },
    ],
    fns: {
      cero: (e, ctx) => {
        for (const u of ctx.vars.x ?? []) N.agregarEfecto(e, { tipo: "fuerza", uid: u, n: -N.fuerza(e, u) }, ctx.ctrl);
      },
      doble: (e, ctx) => {
        for (const u of ctx.vars.x ?? []) N.agregarEfecto(e, { tipo: "fuerza", uid: u, n: N.fuerza(e, u) }, ctx.ctrl);
      },
    },
  },
  "Cuevas de Ajanta": {
    activadas: [
      {
        texto: "Un Aliado gana 2 de Fuerza y Furia",
        momento: "vigilia",
        veces: "turno",
        requiere: { de: ["todos:aliados"], filtro: {} },
        hacer: [sel(["todos:aliados"]), efecto("x", { tipo: "fuerza", n: 2 }), efecto("x", { tipo: "gana", clave: "Furia" })],
      },
    ],
    disparadas: [
      {
        cuando: ["faseFinal"],
        si: "atacaron",
        hacer: [sel(["todos:cementerio"], {}, "c", { nf: "nAtacaron", hasta: true }), barajarOdesterrar("c")],
      },
    ],
    fns: {
      nAtacaron: (e, ctx) => e.jugadores[ctx.ctrl].declarados.length,
      atacaron: (e, ctx) => e.jugadores[ctx.ctrl].declarados.length > 0,
    },
  },
  "El Abismo": {
    activadas: [
      {
        texto: "Tu oponente Destierra del tope una carta por cada Tótem que controles y tú Robas dos",
        veces: "turno",
        hacer: [{ op: "desterrarTope", quien: "rival", nf: "nTotems" }, robar(2)],
      },
      {
        texto: "Mirar la mano oponente y Barajar una carta de coste 2 o menos que no sea Aliado",
        momento: "tuTurno",
        veces: "turno",
        requiere: "conMano",
        hacer: [sel(["rival:mano"], { costeMax: 2, noTipo: ["Aliado"] }, "x", { hasta: true }), mov("barajar")],
      },
    ],
    fns: { nTotems, conMano: (e, ctx) => e.jugadores[N.rival(ctx.ctrl)].mano.length > 0 },
  },
  "El Arca": {
    disparadas: [
      {
        cuando: ["entra"],
        hacer: [
          {
            op: "opcional",
            texto: "Pagar un Oro",
            pagar: 1,
            pasos: [
              {
                op: "modo",
                opciones: [
                  { texto: "Robar tres cartas", pasos: [robar(3)] },
                  { texto: "Buscar un Oro y ponerlo en tu Oro Pagado", pasos: buscar(["yo:castillo"], { tipo: "Oro" }, "pagado") },
                ],
              },
            ],
          },
        ],
      },
      { cuando: ["faseFinal"], hacer: [sel(["todos:cementerio"], {}, "c", { nf: "dosPorTotem", hasta: true }), mov("barajar", "c")] },
    ],
    fns: { dosPorTotem: (e, ctx) => 2 * nTotems(e, ctx) },
  },
  "El Fantasma": {
    activadas: [
      {
        texto: "Pagar el coste de una carta oponente: pierde su habilidad, es Destruida y la juegas bajo tu control sin pagar su coste",
        momento: "vigilia",
        veces: "turno",
        requiere: "puede",
        hacer: [sel(["rival:enJuego"], { f: "pagable" }, "x", { para: "destruir" }), { op: "fn", f: "robarAlma" }],
      },
    ],
    fns: {
      pagable: (e, ctx, u) => N.carta(e, u).tipo !== "Oro" && coste(e, u) <= e.jugadores[ctx.ctrl].reserva.length,
      puede: (e, ctx) =>
        N.enJuegoDe(e, N.rival(ctx.ctrl)).some((u) => N.carta(e, u).tipo !== "Oro" && coste(e, u) <= e.jugadores[ctx.ctrl].reserva.length && !N.tiene(e, u, "Indestructible")),
      robarAlma: (e, ctx, api) => {
        const [u] = ctx.vars.x ?? [];
        if (!u) return;
        api.pagarOros(e, ctx.ctrl, coste(e, u));
        N.agregarEfecto(e, { tipo: "pierdeHabilidad", uid: u, fin: "mientras" }, ctx.ctrl);
        if (N.puedeSalir(e, u)) N.mover(e, u, "cementerio");
        e.efectos = e.efectos.filter((f) => !(f.tipo === "pierdeHabilidad" && f.uid === u));
        if (N.ubicar(e, u)?.zona !== "cementerio") return;
        return [{ op: "jugarGratis", var: "x" }];
      },
    },
  },
  "Esfinge Antartica": {
    disparadas: [
      {
        cuando: ["entra"],
        opcional: true,
        hacer: [sel(["rival:aliados"], { costeMax: 2 }, "x", { para: "tomar" }), { op: "convertir", var: "x", en: "Aliado", a: "defensa" }],
      },
    ],
    activadas: [
      {
        texto: "Barajar hasta dos cartas de los Cementerios",
        veces: "turno",
        hacer: [sel(["todos:cementerio"], {}, "c", { n: 2, hasta: true }), mov("barajar", "c")],
      },
    ],
  },
  "Espira del Delirio": {
    disparadas: [
      {
        zona: ["cementerio"],
        cuando: ["juega"],
        quien: "yo",
        si: "aliadoOArma",
        opcional: true,
        hacer: [sel(["fuente"], {}, "yo"), mov("mano", "yo")],
      },
    ],
    activadas: [{ texto: "Robar tres cartas", veces: "turno", hacer: [robar(3)] }],
    fns: { aliadoOArma: (e, ctx) => ["Aliado", "Arma"].includes(ctx.datos.tipo) },
  },
  "Estacion Dos": {
    disparadas: [
      { cuando: ["entra"], hacer: [{ op: "fn", f: "atar" }] },
      { cuando: ["comienzoVigilia"], opcional: true, hacer: [sel(["fuente"], {}, "yo"), mov("destruir", "yo"), { op: "generar", n: 2 }] },
      { cuando: ["sale"], hacer: [{ op: "fn", f: "soltar" }] },
    ],
    fns: {
      atar: (e, ctx) => N.agregarEfecto(e, { tipo: "noAtacar", uid: ctx.fuente, fin: "mientras" }, ctx.ctrl),
      soltar: (e, ctx) => {
        e.efectos = e.efectos.filter((f) => !(f.tipo === "noAtacar" && f.uid === ctx.fuente));
      },
    },
  },
  "Estacion Gaia": {
    claves: ["Exhumar"],
    disparadas: [
      {
        cuando: ["entra"],
        hacer: [robar(2), sel(["yo:mano"], {}, "d"), mov("cementerio", "d"), { op: "desterrarTope", n: 2, quien: "rival" }],
      },
    ],
    continuas: [{ fuerza: 1, a: "tusAliados" }],
  },
  "Estación Fantasma": {
    activadas: [
      {
        texto: "Nombrar una carta que no sea Oro: tu oponente Baraja las cartas que controle con ese nombre",
        veces: "turno",
        requiere: { de: ["rival:enJuego"], filtro: { noTipo: ["Oro"] } },
        hacer: [sel(["rival:enJuego"], { noTipo: ["Oro"] }, "n"), { op: "fn", f: "mismoNombre" }, mov("barajar", "y")],
      },
    ],
    disparadas: [
      {
        cuando: ["ataca"],
        quien: "yo",
        veces: 1,
        hacer: [sel(["yo:aliados"], { f: "conFuria" }, "f", { n: 2, hasta: true }), efecto("f", { tipo: "sinDano" }), { op: "fn", f: "fondo" }],
      },
    ],
    fns: {
      conFuria: (e, ctx, u) => N.tiene(e, u, "Furia"),
      mismoNombre: (e, ctx) => {
        const nombres = (ctx.vars.n ?? []).map((u) => N.carta(e, u).nombre);
        ctx.vars.y = N.enJuegoDe(e, N.rival(ctx.ctrl)).filter((u) => nombres.includes(N.carta(e, u).nombre));
      },
      fondo: (e, ctx) => {
        const n = (ctx.vars.f ?? []).reduce((s, u) => s + N.fuerza(e, u), 0);
        if (n) N.quitarDelCastillo(e, N.rival(ctx.ctrl), n, "destierro", true);
      },
    },
  },
  "Estela Sagrada": {
    activadas: [
      {
        texto: "Pagar un Oro: buscar una carta en tu Castillo o Barajar una carta de coste 2 o menos",
        veces: "turno",
        oros: 1,
        hacer: [
          {
            op: "modo",
            opciones: [
              { texto: "Buscar una carta en tu Castillo", pasos: buscar(["yo:castillo"], {}) },
              {
                texto: "Barajar una carta de coste 2 o menos",
                requiere: { de: ["todos:enJuego"], filtro: { costeMax: 2 } },
                pasos: [sel(["todos:enJuego"], { costeMax: 2 }), mov("barajar")],
              },
            ],
          },
        ],
      },
    ],
    continuas: [1, 2, 3, 4, 5, 6].map((n) => ({ reduceDanoCastillo: 1, si: `t${n}` })),
    fns: Object.fromEntries([1, 2, 3, 4, 5, 6].map((n) => [`t${n}`, totemsCoste1(n)])),
  },
  Fonda: {
    disparadas: [
      {
        cuando: ["juega"],
        quien: "yo",
        veces: 2,
        si: "talisman",
        hacer: [{ op: "botar", n: 2, quien: "rival" }, { op: "si", f: "especial", entonces: [robar(2)] }],
      },
    ],
    fns: {
      talisman: (e, ctx) => ctx.datos.tipo === "Talismán",
      especial: (e, ctx) => ["Terremoto", "Pie de Cueca"].includes(N.carta(e, ctx.datos.uid).nombre),
    },
  },
  "Fuerte de Niebla": {
    activadas: [
      {
        texto: "Generar un Oro para Armas y buscar un Arma en tu Castillo",
        veces: "turno",
        hacer: [{ op: "generar", n: 1, tipos: ["Arma"] }, ...buscar(["yo:castillo"], { tipo: "Arma" })],
      },
    ],
  },
  Gehena: {
    activadas: [
      {
        texto: "Mirar la mano oponente, Desterrar una carta nombrada del Castillo oponente y poner otra de tu Castillo en tu mano",
        veces: "turno",
        hacer: [sel(["rival:castillo"], { noTipo: ["Talismán"] }, "d"), mov("desterrar", "d"), barajar("rival"), ...buscar(["yo:castillo"], { noTipo: ["Talismán"] })],
      },
    ],
    disparadas: [{ cuando: ["faseFinal"], hacer: [...agruparOro, robar(1)] }],
  },
  "Gran Maelstrm": {
    disparadas: [
      {
        cuando: ["faseFinal"],
        quien: "cualquiera",
        si: "sinAliados",
        opcional: true,
        hacer: [
          {
            op: "modo",
            opciones: [
              { texto: "Una carta de un Cementerio", requiere: { de: ["todos:cementerio"], filtro: {} }, pasos: [sel(["todos:cementerio"], {}, "t"), aAliado("t")] },
              { texto: "El tope de tu Castillo", pasos: [{ op: "tope", quien: "yo", n: 1, como: "t" }, aAliado("t")] },
              { texto: "El tope del Castillo oponente", pasos: [{ op: "tope", quien: "rival", n: 1, como: "t" }, aAliado("t")] },
            ],
          },
        ],
      },
    ],
    activadas: [
      {
        texto: "Desterrar este Tótem: no recibes daño hasta tu próximo turno",
        coste: [sel(["fuente"], {}, "yo"), mov("desterrar", "yo")],
        hacer: [{ op: "efecto", efecto: { tipo: "prevenirDano" }, jugador: "yo", fin: "proximoTurno" }],
      },
    ],
    fns: { sinAliados },
  },
  "Gran Yggdrasil": {
    disparadas: [
      {
        cuando: ["entra"],
        hacer: [sel(["yo:castillo"], { tipo: "Tótem", costeMin: 3, costeMax: 3 }, "m"), { op: "jugarGratis", var: "m" }, barajar()],
      },
      { cuando: ["comienzoVigilia"], hacer: [{ op: "desterrarTope", quien: "rival", nf: "nTotems" }] },
    ],
    fns: { nTotems },
  },
  "Guardia Gozosa": {
    disparadas: [
      {
        cuando: ["entra"],
        hacer: [sel(["rival:aliados"], {}, "x", { para: "destruir" }), efecto("x", { tipo: "pierdeHabilidad" }, "mientras"), mov("destruir")],
      },
    ],
    activadas: [
      {
        texto: "Destruir este Tótem: Barajar una carta de tu Cementerio en tu Castillo",
        coste: [sel(["fuente"], {}, "yo"), mov("destruir", "yo")],
        hacer: [sel(["yo:cementerio"], {}, "c"), mov("barajar", "c")],
      },
    ],
  },
  "Hangar de la Ciudadela": {
    disparadas: [
      { cuando: ["entra"], hacer: [sel(["rival:mano"], {}, "m", { quien: "rival" }), mov("barajar", "m"), robar(2)] },
      { zona: ["cementerio"], cuando: ["salenDelCastillo"], quien: "yo", si: "botadaPorDano", hacer: [{ op: "fn", f: "detener" }] },
    ],
    fns: {
      botadaPorDano: (e, ctx) => ctx.datos.porDano && ctx.datos.zona === "cementerio" && ctx.datos.uids.includes(ctx.fuente),
      detener: (e, ctx) => {
        const { uids } = ctx.datos;
        const i = uids.indexOf(ctx.fuente);
        if (i < 0 || N.ubicar(e, ctx.fuente)?.zona !== "cementerio") return;
        const p = e.jugadores[ctx.ctrl];
        const resto = uids.slice(i + 1).filter((u) => p.cementerio.includes(u));
        for (const u of [...resto].reverse()) {
          N.sacar(e, u);
          p.castillo.unshift(u);
        }
        p.salidasCastillo = Math.max(0, p.salidasCastillo - resto.length);
        N.mover(e, ctx.fuente, "destierro");
      },
    },
  },
  Hiva: {
    claves: ["Indesterrable"],
    activadas: [
      {
        texto: "Destruir un Aliado",
        veces: "turno",
        requiere: { de: ["todos:aliados"], filtro: {}, para: "destruir" },
        hacer: [sel(["todos:aliados"], {}, "x", { para: "destruir" }), mov("destruir")],
      },
    ],
  },
  "Hospital San José": {
    disparadas: [
      { cuando: ["entra"], opcional: true, hacer: [sel(["rival:cementerio"], {}, "c", { n: 999 }), mov("desterrar", "c")] },
      { cuando: ["faseFinal"], quien: "rival", hacer: [{ op: "botar", n: 5, quien: "rival" }] },
      { cuando: ["sale"], hacer: [{ op: "botar", n: 5, quien: "rival" }] },
    ],
    activadas: [
      {
        texto: "Barajar hasta seis cartas de los Cementerios y Robar tantas cartas como Tótems de distinto coste controles",
        veces: "turno",
        hacer: [sel(["todos:cementerio"], {}, "c", { n: 6, hasta: true }), mov("barajar", "c"), { op: "robar", nf: "distintos" }],
      },
    ],
    fns: { distintos: (e, ctx) => new Set(totems(e, ctx.ctrl).map((u) => coste(e, u))).size },
  },
};
