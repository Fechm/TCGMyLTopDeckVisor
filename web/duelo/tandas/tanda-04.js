import * as N from "../nucleo.js";
import { sel, mov, barajar, robar, efecto, buscar, castilloElegido, coste } from "../formato.js";
import { disponibles, hayObjetivo } from "../efectos.js";

const esAzi = (e, ctx, u) => {
  const c = N.carta(e, u);
  return /\bAzi\b/.test(c.nombre) || c.nombre === "Dagon" || e.conv[u]?.como === "azi";
};

const porOros = (minimo) => (e, ctx) => Math.min(N.orosDe(e, ctx.ctrl).length, Math.max(0, coste(e, ctx.fuente) - minimo));

const sinCopia = (e, ctx) => !N.aliadosDe(e, ctx.ctrl).some((a) => N.carta(e, a).id === ctx.def);

const costeReducido = (c) => Math.max(Math.min(c, 1), c - 1);

const usosChinivilu = (e, ctx) => {
  const u = e.usos[`chinivilu|${ctx.fuente}`];
  return u?.turno === e.turno ? u.n : 0;
};

const barajarYDesterrarTres = [
  sel(["todos:cementerio"], {}, "c", { n: 3, hasta: true }),
  mov("barajar", "c"),
  sel(["todos:cementerio"], {}, "d", { nf: "resto", hasta: true }),
  mov("desterrar", "d"),
];

const pagarHastaTres = (pasosPara) => ({
  op: "modo",
  hasta: true,
  opciones: [1, 2, 3].map((k) => ({ texto: `Pagar ${k} Oro${k > 1 ? "s" : ""}`, requiere: `r${k}`, pasos: [{ op: "pagar", n: k }, ...pasosPara(k)] })),
});

const reservaMin = {
  r1: (e, ctx) => e.jugadores[ctx.ctrl].reserva.length >= 1,
  r2: (e, ctx) => e.jugadores[ctx.ctrl].reserva.length >= 2,
  r3: (e, ctx) => e.jugadores[ctx.ctrl].reserva.length >= 3,
};

export const HABILIDADES = {
  "Aku Aku": {
    claves: ["Furia"],
    disparadas: [
      {
        cuando: ["entra"],
        hacer: [
          {
            op: "opcional",
            texto: "Jugar un Aliado de tu Cementerio reduciendo su coste en un Oro",
            requiere: { de: ["yo:cementerio"], filtro: { tipo: "Aliado", f: "asequible" } },
            pasos: [sel(["yo:cementerio"], { tipo: "Aliado", f: "asequible" }, "x"), { op: "fn", f: "jugar" }],
          },
        ],
      },
      {
        cuando: ["haceDano"],
        hacer: [sel(["todos:aliados"], {}, "a"), sel(["todos:cementerio"], {}, "c", { nf: "fuerzaA" }), mov("desterrar", "c")],
      },
    ],
    fns: {
      asequible: (e, ctx, u) => costeReducido(coste(e, u)) <= disponibles(e, ctx.ctrl, "Aliado"),
      jugar: (e, ctx, api) => {
        const [uid] = ctx.vars.x ?? [];
        if (!uid) return;
        api.pagarOros(e, ctx.ctrl, costeReducido(coste(e, uid)), "Aliado");
        N.disparar(e, "juega", { uid, j: ctx.ctrl, tipo: "Aliado", pagado: true, desde: "cementerio" });
        return [{ op: "entrar", uid, datos: { pagado: true, desde: "cementerio" } }];
      },
      fuerzaA: (e, ctx) => {
        const [a] = ctx.vars.a ?? [];
        return a ? N.fuerza(e, a) : 0;
      },
    },
  },
  Amaru: {
    claves: ["Indestructible"],
    reduce: "red",
    activadas: [
      {
        texto: "Un Aliado tuyo de coste 3 o más usa la habilidad ganada: Barajar hasta tres cartas de tu Cementerio",
        momento: "vigilia",
        requiere: "otorgada",
        hacer: [
          sel(["yo:aliados"], { costeMin: 3, f: "libre" }, "a"),
          { op: "fn", f: "marcar" },
          sel(["yo:cementerio"], {}, "c", { n: 3, hasta: true }),
          mov("barajar", "c"),
        ],
      },
    ],
    fns: {
      red: porOros(2),
      libre: (e, ctx, u) => e.usos[`amaru|${u}`] !== e.turno,
      otorgada: (e, ctx) => N.aliadosDe(e, ctx.ctrl).some((u) => coste(e, u) >= 3 && e.usos[`amaru|${u}`] !== e.turno),
      marcar: (e, ctx) => {
        for (const u of ctx.vars.a ?? []) e.usos[`amaru|${u}`] = e.turno;
      },
    },
  },
  "Apofis del Caos": {
    claves: ["Furia"],
    disparadas: [{ cuando: ["ataca"], hacer: [sel(["todos:enJuego"], {}, "x"), { op: "fn", f: "apagar" }] }],
    fns: {
      apagar: (e, ctx) => {
        for (const u of ctx.vars.x ?? []) {
          const nombre = N.carta(e, u).nombre;
          N.agregarEfecto(e, { tipo: "pierdeHabilidad", nombre, fin: "proximoTurno" }, ctx.ctrl);
          for (const v of N.todoEnJuego(e)) {
            if (N.carta(e, v).nombre === nombre) N.agregarEfecto(e, { tipo: "noAtacarBloquear", uid: v, fin: "proximoTurno" }, ctx.ctrl);
          }
        }
      },
    },
  },
  "Azi Dahaka": {
    claves: ["Furia", "Exhumar"],
    activadas: [
      {
        texto: "Destruir una carta que no sea Oro o buscar una carta en tu Castillo, y Robar dos cartas",
        momento: "vigilia",
        veces: "turno",
        hacer: [
          {
            op: "modo",
            opciones: [
              {
                texto: "Destruir una carta que no sea Oro",
                requiere: { de: ["todos:enJuego"], filtro: { noTipo: ["Oro"] }, para: "destruir" },
                pasos: [sel(["todos:enJuego"], { noTipo: ["Oro"] }, "x", { para: "destruir" }), mov("destruir")],
              },
              { texto: "Buscar una carta en tu Castillo", pasos: buscar(["yo:castillo"], {}) },
            ],
          },
          robar(2),
        ],
      },
    ],
    continuas: [{ aliadosNoPierden: true }, { fuerza: 1, a: "tusAliados" }, { orosRivalSinHabilidad: true }],
  },
  "Azi Raoioita": {
    claves: ["Furia"],
    reduce: "red",
    activadas: [
      {
        texto: "Generar un Oro para Aliados y Destruir hasta una carta de coste 2 o menos",
        veces: "turno",
        hacer: [{ op: "generar", n: 1, tipos: ["Aliado"] }, sel(["todos:enJuego"], { costeMax: 2 }, "x", { hasta: true, para: "destruir" }), mov("destruir")],
      },
    ],
    disparadas: [
      {
        zona: ["cementerio"],
        cuando: ["comienzoTurno"],
        quien: "cualquiera",
        hacer: [sel(["todos:enJuego"], { f: "oroOBarato" }), efecto("x", { tipo: "pierdeHabilidad" }, "turno")],
      },
    ],
    fns: {
      red: (e, ctx) => (N.aliadosDe(e, ctx.ctrl).some((a) => (N.carta(e, a).razas ?? []).includes("Dragón")) ? 1 : 0),
      oroOBarato: (e, ctx, u) => N.carta(e, u).tipo === "Oro" || coste(e, u) <= 2,
    },
  },
  "Azi Sruvara": {
    disparadas: [
      {
        cuando: ["entra"],
        hacer: [
          ...buscar(["yo:castillo"], { tipo: "Aliado", f: "esAzi" }),
          sel(["todos:enJuego"], { costeMax: 1, para: "tomar" }, "c"),
          { op: "convertir", var: "c", en: "Oro", a: "pagado" },
        ],
      },
    ],
    fns: { esAzi },
  },
  "Azi del Abismo": {
    activadas: [
      {
        texto: "Descartar una carta: convertir este Aliado hasta tu próximo turno en un Oro en tu Oro Pagado",
        veces: "turno",
        requiere: "puede",
        coste: [sel(["yo:mano"], {}, "d"), mov("cementerio", "d")],
        hacer: [sel(["fuente"], {}, "yo"), { op: "fn", f: "convertir" }],
      },
    ],
    continuas: [{ fuerza: 1, a: "tusAliados", si: "esAliado" }],
    fns: {
      puede: (e, ctx) => !e.conv[ctx.fuente] && e.jugadores[ctx.ctrl].mano.length > 0,
      esAliado: (e, ctx) => !e.conv[ctx.fuente],
      convertir: (e, ctx) => [{ op: "convertir", var: "yo", en: "Oro", a: "pagado", como: ctx.def, hasta: true, vuelve: "defensa" }],
    },
  },
  "Basilisco Chilote": {
    activadas: [
      {
        texto: "Pagar un Oro y poner un Aliado de coste 3 o más de tu mano en el tope de tu Castillo: convertir esta carta en un Oro en tu Oro Pagado",
        zona: "mano",
        oros: 1,
        requiere: { de: ["yo:mano"], filtro: { tipo: "Aliado", costeMin: 3, noFuente: true } },
        coste: [sel(["yo:mano"], { tipo: "Aliado", costeMin: 3, noFuente: true }, "t"), mov("castillo", "t")],
        hacer: [sel(["fuente"], {}, "yo"), { op: "convertir", var: "yo", en: "Oro", a: "pagado" }],
      },
      {
        texto: "Barajar hasta dos cartas de tu Cementerio",
        veces: "turno",
        hacer: [sel(["yo:cementerio"], {}, "c", { n: 2, hasta: true }), mov("barajar", "c")],
      },
    ],
  },
  Bokrug: {
    claves: ["Exhumar"],
    reduce: "red",
    activadas: [
      {
        texto: "Un Aliado gana Furia y hace Daño al Destierro por el turno",
        veces: "turno",
        requiere: { de: ["todos:aliados"], filtro: {} },
        hacer: [sel(["todos:aliados"]), efecto("x", { tipo: "gana", clave: "Furia" }, "turno"), efecto("x", { tipo: "gana", clave: "DanoAlDestierro" }, "turno")],
      },
    ],
    fns: { red: (e, ctx) => N.aliadosDe(e, ctx.ctrl).filter((u) => coste(e, u) >= 3).length },
  },
  "Caicai Vilu": {
    requiere: "sinCopia",
    reduce: "red",
    desdeCementerio: { botar: 4 },
    disparadas: [
      { cuando: ["juega"], quien: "cualquiera", si: "esTalisman", hacer: [{ op: "fn", f: "barajarMano" }] },
      { cuando: ["sale"], hacer: [{ op: "si", f: "destruido", entonces: [sel(["fuente"], {}, "yo"), mov("mano", "yo")] }] },
    ],
    fns: {
      sinCopia,
      red: (e, ctx) => (N.ubicar(e, ctx.fuente)?.zona === "cementerio" ? coste(e, ctx.fuente) : 0),
      esTalisman: (e, ctx) => ctx.datos.tipo === "Talismán",
      barajarMano: (e, ctx) => {
        const quien = ctx.datos.j === ctx.ctrl ? "yo" : "rival";
        return [sel([`${quien}:mano`], {}, "m", { quien }), mov("barajar", "m")];
      },
      destruido: (e, ctx) => N.ubicar(e, ctx.fuente)?.zona === "cementerio",
    },
  },
  Caos: {
    claves: ["Furia"],
    reduce: "red",
    fns: { red: (e, ctx) => Math.max(0, N.orosDe(e, ctx.ctrl).length - N.orosDe(e, N.rival(ctx.ctrl)).length) },
  },
  Carmilla: {
    claves: ["Exhumar"],
    disparadas: [
      {
        cuando: ["entra"],
        hacer: [
          {
            op: "opcional",
            texto: "Destruir una carta de coste 3 o menos y Robar una carta",
            requiere: { de: ["todos:enJuego"], filtro: { costeMax: 3 }, para: "destruir" },
            pasos: [sel(["todos:enJuego"], { costeMax: 3 }, "x", { para: "destruir" }), mov("destruir"), robar(1)],
          },
        ],
      },
    ],
    activadas: [
      {
        texto: "Nombrar una carta que no sea Oro: buscar una copia en la mano o Castillo oponente y Desterrarla",
        momento: "tuTurno",
        veces: "turno",
        hacer: [sel(["rival:mano", "rival:castillo"], { noTipo: ["Oro"] }, "n"), mov("desterrar", "n"), barajar("rival")],
      },
    ],
  },
  Chashkel: {
    claves: ["Exhumar"],
    disparadas: [
      {
        cuando: ["entra"],
        hacer: [
          {
            op: "opcional",
            texto: "Botar tres cartas para Barajar una carta oponente de coste 2 o menos",
            requiere: "puedeBotar",
            pasos: [{ op: "botar", n: 3, quien: "yo" }, sel(["rival:enJuego"], { costeMax: 2 }), mov("barajar")],
          },
        ],
      },
    ],
    activadas: [
      {
        texto: "Buscar en un Castillo una carta y ponerla en el Cementerio de su dueño",
        momento: "tuTurno",
        veces: "turno",
        hacer: [castilloElegido((quien) => [sel([`${quien}:castillo`], {}, "b"), mov("cementerio", "b"), barajar(quien)])],
      },
    ],
    fns: {
      puedeBotar: (e, ctx) => e.jugadores[ctx.ctrl].castillo.length >= 3 && hayObjetivo(e, ctx, { de: ["rival:enJuego"], filtro: { costeMax: 2 } }),
    },
  },
  Chinivilu: {
    activadas: [
      {
        texto: "Pagar o Destruir un Oro que controles: Robar dos cartas (hasta tres veces por turno)",
        requiere: "puede",
        hacer: [
          { op: "fn", f: "contar" },
          {
            op: "modo",
            opciones: [
              { texto: "Pagar un Oro", requiere: "r1", pasos: [{ op: "pagar", n: 1 }] },
              {
                texto: "Destruir un Oro que controles",
                requiere: { de: ["yo:oros"], filtro: {}, para: "destruir" },
                pasos: [sel(["yo:oros"], {}, "o", { para: "destruir" }), mov("destruir", "o")],
              },
            ],
          },
          robar(2),
        ],
      },
    ],
    disparadas: [
      {
        cuando: ["sale"],
        opcional: true,
        hacer: [sel(["yo:castillo"], { f: "copia" }, "b"), { op: "jugarGratis", var: "b" }, barajar()],
      },
    ],
    fns: {
      ...reservaMin,
      puede: (e, ctx) =>
        usosChinivilu(e, ctx) < 3 && (e.jugadores[ctx.ctrl].reserva.length > 0 || hayObjetivo(e, ctx, { de: ["yo:oros"], filtro: {}, para: "destruir" })),
      contar: (e, ctx) => {
        e.usos[`chinivilu|${ctx.fuente}`] = { turno: e.turno, n: usosChinivilu(e, ctx) + 1 };
      },
      copia: (e, ctx, u) => N.carta(e, u).nombre === "Chinivilu",
    },
  },
  "Come Tiempo": {
    claves: ["Furia", "Imbloqueable"],
    reduce: "red",
    disparadas: [{ cuando: ["sale"], hacer: [robar(2)] }],
    fns: { red: porOros(2) },
  },
  "Cristalino Amarillo": {
    activadas: [
      {
        texto: "Si controlas cuatro o más Oros: Barajar hasta dos cartas de tu Cementerio y Robar dos cartas",
        momento: "vigilia",
        veces: "turno",
        requiere: "cuatroOros",
        hacer: [sel(["yo:cementerio"], {}, "c", { n: 2, hasta: true }), mov("barajar", "c"), robar(2)],
      },
    ],
    fns: { cuatroOros: (e, ctx) => N.orosDe(e, ctx.ctrl).length >= 4 },
  },
  Cuchivilu: {
    reduce: "red",
    disparadas: [
      {
        cuando: ["entra"],
        hacer: [pagarHastaTres((k) => [sel(["rival:enJuego"], { costeMax: 2 }, "x", { n: k, para: "destruir" }), mov("destruir")])],
      },
    ],
    fns: { red: porOros(1), ...reservaMin },
  },
  Culebron: {
    reduce: "red",
    disparadas: [
      {
        cuando: ["entra"],
        hacer: [pagarHastaTres((k) => [sel(["rival:mano"], {}, "x", { n: k, azar: true }), mov("cementerio")])],
      },
    ],
    fns: { red: porOros(2), ...reservaMin },
  },
  Dagon: {
    claves: ["Furia"],
    disparadas: [{ cuando: ["entra"], hacer: buscar(["yo:castillo"], { f: "esAzi" }) }],
    fns: { esAzi },
  },
  "Daikaiju Renacido": {
    claves: ["Furia", "Imbloqueable"],
    disparadas: [
      {
        cuando: ["haceDano"],
        opcional: true,
        hacer: [
          {
            op: "modo",
            opciones: [
              {
                texto: "Barajar una carta de coste 2 o menos",
                requiere: { de: ["todos:enJuego"], filtro: { costeMax: 2 } },
                pasos: [sel(["todos:enJuego"], { costeMax: 2 }), mov("barajar")],
              },
              { texto: "Buscar un Aliado en tu Castillo", pasos: buscar(["yo:castillo"], { tipo: "Aliado" }) },
            ],
          },
        ],
      },
      { cuando: ["faseFinal"], hacer: barajarYDesterrarTres },
    ],
    fns: { resto: (e, ctx) => 3 - (ctx.vars.c ?? []).length },
  },
  "Demonio Tenebris": {
    claves: ["Exhumar", "Indesterrable"],
    activadas: [
      {
        texto: "Desterrar hasta una carta que no sea Oro, del tope de un Castillo tantas cartas como coste tenga una carta que controles, y Robar hasta tres",
        momento: "vigilia",
        veces: "turno",
        hacer: [
          sel(["todos:enJuego"], { noTipo: ["Oro"] }, "x", { hasta: true, para: "desterrar" }),
          mov("desterrar"),
          sel(["yo:enJuego"], {}, "k"),
          castilloElegido((quien) => [{ op: "desterrarTope", quien, nf: "costeK" }]),
          { op: "robarHasta", n: 3 },
        ],
      },
    ],
    disparadas: [{ cuando: ["entra"], quien: "yo", si: "aliadoCosteDos", hacer: [{ op: "fn", f: "furia" }] }],
    fns: {
      costeK: (e, ctx) => {
        const [k] = ctx.vars.k ?? [];
        return k ? coste(e, k) : 0;
      },
      aliadoCosteDos: (e, ctx) => N.carta(e, ctx.datos.uid).tipo === "Aliado" && coste(e, ctx.datos.uid) >= 2,
      furia: (e, ctx) => {
        N.agregarEfecto(e, { tipo: "gana", clave: "Furia", uid: ctx.datos.uid }, ctx.ctrl);
      },
    },
  },
  Dracu: {
    claves: ["Furia", "DanoAlDestierro"],
    disparadas: [{ cuando: ["entra"], hacer: buscar(["yo:castillo", "yo:cementerio"], { tipo: ["Oro", "Aliado"], f: "noDracu" }) }],
    fns: { noDracu: (e, ctx, u) => N.carta(e, u).nombre !== "Dracu" },
  },
  "Dragones de la Reina": {
    claves: ["NoAnulable"],
    reduce: "red",
    disparadas: [
      {
        cuando: ["entra", "ataca"],
        hacer: [sel(["todos:aliados"], {}, "a"), efecto("a", { tipo: "gana", clave: "Imbloqueable" }, "turno"), { op: "botar", nf: "nOros", quien: "rival" }],
      },
    ],
    fns: {
      red: (e, ctx) => (e.jugadores[ctx.ctrl].cementerio.filter((u) => N.carta(e, u).tipo === "Aliado").length >= 3 ? 2 : 0),
      nOros: (e, ctx) => N.orosDe(e, ctx.ctrl).length,
    },
  },
  "Dragón Nival": {
    disparadas: [{ cuando: ["entra"], hacer: [sel(["todos:aliados"], { f: "debil" }, "x", { n: 99, para: "destruir" }), mov("destruir")] }],
    fns: { debil: (e, ctx, u) => N.fuerza(e, u) <= 2 },
  },
  "Dragón de Magma": {
    disparadas: [{ cuando: ["entra"], hacer: [sel(["rival:aliados"], {}, "x", { para: "destruir" }), mov("destruir")] }],
  },
};
