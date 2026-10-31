import * as N from "../nucleo.js";
import { sel, mov, barajar, robar, efecto, buscar, castilloElegido, coste } from "../formato.js";

const botar = (n, quien = "rival") => ({ op: "botar", n, quien });

const sinCopia = (e, ctx) => {
  const nombre = N.carta(e, ctx.fuente).nombre;
  return !N.enJuegoDe(e, ctx.ctrl).some((u) => u !== ctx.fuente && N.carta(e, u).nombre === nombre);
};

const esAzi = (e, u) => N.carta(e, u).tipo === "Oro" && (e.conv[u]?.como === "azi" || /Azi/.test(N.carta(e, u).nombre));

const orosEnJuego = (e) => N.orosDe(e, 0).length + N.orosDe(e, 1).length;

const noOroCoste = (max) => ({ noTipo: ["Oro"], costeMax: max });

const alResolverOro = (e, ctx) => {
  const pasos = [sel(["fuente"], {}, "yo"), { op: "convertir", var: "yo", en: "Oro", a: "pagado" }];
  e.cola.splice(1, 0, N.nuevoFrame(pasos, { ctrl: ctx.ctrl, fuente: ctx.fuente, def: ctx.def, costeFuente: ctx.costeFuente }));
};

export const HABILIDADES = {
  Tanin: {
    claves: ["Exhumar"],
    requiere: "sinCopia",
    disparadas: [
      {
        cuando: ["entra"],
        hacer: [
          sel(["todos:cementerio"], {}, "c", { nf: "diferencia", hasta: true }),
          mov("barajar", "c"),
          sel(["todos:cementerio"], {}, "d", { nf: "resto", hasta: true }),
          mov("desterrar", "d"),
        ],
      },
    ],
    fns: {
      sinCopia,
      diferencia: (e, ctx) => Math.max(0, N.orosDe(e, ctx.ctrl).length - N.orosDe(e, N.rival(ctx.ctrl)).length),
      resto: (e, ctx) => Math.max(0, N.orosDe(e, ctx.ctrl).length - N.orosDe(e, N.rival(ctx.ctrl)).length) - (ctx.vars.c ?? []).length,
    },
  },
  "Tormenta Feroz": {
    claves: ["Furia"],
    disparadas: [
      { zona: ["cementerio"], cuando: ["entra"], quien: "cualquiera", si: "entraOro", opcional: true, hacer: [sel(["fuente"], {}, "yo"), mov("mano", "yo")] },
      {
        cuando: ["ataca"],
        hacer: [
          {
            op: "opcional",
            texto: "Subir un Oro de tu Cementerio a tu mano",
            requiere: { de: ["yo:cementerio"], filtro: { tipo: "Oro" } },
            pasos: [sel(["yo:cementerio"], { tipo: "Oro" }, "o"), mov("mano", "o")],
          },
        ],
      },
    ],
    fns: { entraOro: (e, ctx) => N.carta(e, ctx.datos.uid).tipo === "Oro" },
  },
  "Trentren Vilu": {
    disparadas: [{ cuando: ["entra"], opcional: true, hacer: [sel(["todos:enJuego"], { noTipo: ["Oro"], noFuente: true }, "x", { n: 99 }), mov("barajar")] }],
    activadas: [
      {
        texto: "Pagar un Oro y Botar cuatro cartas: jugar un Aliado de coste 4 o menos de tu mano o Cementerio sin pagar su coste",
        momento: "tuTurno",
        veces: "turno",
        oros: 1,
        requiere: "puede",
        coste: [botar(4, "yo")],
        hacer: [sel(["yo:mano", "yo:cementerio"], { tipo: "Aliado", costeMax: 4 }, "a"), { op: "jugarGratis", var: "a" }],
      },
    ],
    fns: { puede: (e, ctx) => e.jugadores[ctx.ctrl].castillo.length > 4 },
  },
  Valac: {
    claves: ["Furia"],
    reduce: "red",
    disparadas: [
      {
        cuando: ["entra"],
        hacer: [sel(["rival:enJuego"], noOroCoste(2), "x", { nf: "cuantas", hasta: true, para: "destruir" }), mov("destruir")],
      },
    ],
    fns: {
      red: (e, ctx) => N.orosDe(e, ctx.ctrl).filter((u) => esAzi(e, u)).length,
      cuantas: (e, ctx) => {
        if (!ctx.datos.pagado) return 1;
        const azi = N.orosDe(e, ctx.ctrl).filter((u) => esAzi(e, u)).length;
        return Math.max(1, coste(e, ctx.fuente) - azi) + 1;
      },
    },
  },
  Ventisca: {
    continuas: [{ fuerza: 1, a: "tusAliados", raza: "Dragón" }, { gana: "Furia", a: "tusAliados", si: "soloDragones" }],
    fns: { soloDragones: (e, ctx) => N.aliadosDe(e, ctx.ctrl).every((a) => (N.carta(e, a).razas ?? []).includes("Dragón")) },
  },
  "Wyrm de la Plaga": {
    claves: ["Furia"],
    requiere: "sinCopia",
    disparadas: [
      { cuando: ["entra"], si: "siete", hacer: [{ op: "botar", nf: "orosEnJuego", quien: "rival" }] },
      { cuando: ["entra"], quien: "yo", si: "entraOro", hacer: [botar(2)] },
    ],
    fns: {
      sinCopia,
      siete: (e, ctx) => N.orosDe(e, ctx.ctrl).length >= 7,
      orosEnJuego,
      entraOro: (e, ctx) => N.carta(e, ctx.datos.uid).tipo === "Oro",
    },
  },
  "Zmaj Depredador": {
    claves: ["Furia"],
    disparadas: [{ cuando: ["entra"], hacer: [sel(["todos:enJuego"], noOroCoste(2), "x", { n: 99, para: "destruir" }), mov("destruir"), robar(1)] }],
  },
  "Zmaj Moonshadow": {
    claves: ["Furia"],
    activadas: [
      {
        texto: "Cada jugador Bota tres cartas; puedes poner un Aliado de un Cementerio como Aliado sin habilidad y robas dos",
        veces: "turno",
        hacer: [
          botar(3, "yo"),
          botar(3),
          sel(["todos:cementerio"], { tipo: "Aliado" }, "a", { hasta: true, para: "tomar" }),
          { op: "convertir", var: "a", en: "Aliado", a: "defensa" },
          robar(2),
        ],
      },
    ],
  },
  Zmeoaica: {
    requiere: "sinCopia",
    disparadas: [
      {
        cuando: ["entra"],
        hacer: [
          {
            op: "opcional",
            texto: "Mostrar un Aliado de coste 3 de tu mano para robar dos cartas",
            requiere: { de: ["yo:mano"], filtro: { tipo: "Aliado", costeMin: 3, costeMax: 3 } },
            pasos: [sel(["yo:mano"], { tipo: "Aliado", costeMin: 3, costeMax: 3 }, "m"), robar(2)],
          },
        ],
      },
    ],
    fns: { sinCopia },
  },
  "Zmeu Abismal": {
    claves: ["Furia"],
    disparadas: [
      {
        cuando: ["entra"],
        hacer: [
          {
            op: "opcional",
            texto: "Convertir un Oro en un Oro sin habilidad y ganar su control",
            requiere: { de: ["todos:oros"], filtro: {}, para: "tomar" },
            pasos: [sel(["todos:oros"], {}, "o", { para: "tomar" }), { op: "fn", f: "tomarOro" }],
          },
        ],
      },
      {
        cuando: ["ataca"],
        hacer: [sel(["todos:enJuego"], { noTipo: ["Oro"] }, "x", { hasta: true }), efecto("x", { tipo: "pierdeHabilidad" }, "mientras"), mov("destruir")],
      },
    ],
    fns: {
      tomarOro: (e, ctx) => {
        const [u] = ctx.vars.o ?? [];
        if (!u) return [];
        return [{ op: "convertir", var: "o", en: "Oro", a: N.ubicar(e, u).zona }];
      },
    },
  },
  "A Traves del Espejo": {
    destierroAlJugar: true,
    requiere: { de: ["yo:aliados"], filtro: {} },
    talisman: [
      sel(["yo:aliados"], {}, "r"),
      sel(["yo:cementerio"], { tipo: "Aliado", costeMax: 2 }, "h"),
      { op: "fn", f: "ganar" },
      {
        op: "si",
        f: "exhumarOFuria",
        entonces: [
          sel(["todos:aliados"], {}, "g"),
          {
            op: "modo",
            opciones: [
              { texto: "Gana Furia", pasos: [efecto("g", { tipo: "gana", clave: "Furia" }, "mientras")] },
              { texto: "Gana Imbloqueable", pasos: [efecto("g", { tipo: "gana", clave: "Imbloqueable" }, "mientras")] },
            ],
          },
        ],
      },
    ],
    fns: {
      ganar: (e, ctx) => {
        const hab = (ctx.vars.h ?? []).map((u) => e.instancias[u]);
        for (const r of ctx.vars.r ?? []) e.ganadas[r] = [...(e.ganadas[r] ?? []), ...hab];
      },
      exhumarOFuria: (e, ctx) => N.aliadosDe(e, ctx.ctrl).some((a) => N.tiene(e, a, "Exhumar") || N.tiene(e, a, "Furia")),
    },
  },
  "Abducción del Cabo": {
    requiere: { de: ["rival:enJuego"], filtro: noOroCoste(3) },
    talisman: [sel(["rival:enJuego"], noOroCoste(3)), { op: "fn", f: "recordar" }, mov("mano"), { op: "fn", f: "castigo" }],
    fns: {
      recordar: (e, ctx) => {
        ctx.vars.previas = (ctx.vars.x ?? []).map((u) => ({ tipo: N.carta(e, u).tipo, nombre: N.carta(e, u).nombre }));
      },
      castigo: (e, ctx) => {
        const c = (ctx.vars.previas ?? []).find((k) => ["Aliado", "Tótem"].includes(k.tipo));
        if (!c) return [];
        N.agregarEfecto(e, { tipo: "noJugarNombre", j: N.rival(ctx.ctrl), nombre: c.nombre, fin: "proximoTurno" }, ctx.ctrl);
        return [{ op: "generar", n: 1, tipos: ["Arma", "Tótem"] }];
      },
    },
  },
  Abiku: {
    talisman: [...buscar(["yo:castillo"], {}), robar(1), { op: "fn", f: "aOro" }],
    fns: { aOro: alResolverOro },
  },
  Abordaje: {
    claves: ["Indestructible"],
    continuas: [{ fuerza: -2, a: "tusAliados" }],
    requiere: { de: ["todos:cementerio"], filtro: {} },
    talisman: [sel(["todos:cementerio"], {}, "c"), { op: "fn", f: "abordar" }],
    fns: {
      abordar: (e, ctx) => {
        const r = N.rival(ctx.ctrl);
        for (const u of ctx.vars.c ?? []) {
          e.conv[u] = { tipo: "Aliado", fuerza: 0, sinHabilidad: false, como: ctx.def };
          N.mover(e, u, "defensa", { j: r });
          e.jugadores[r].nuevos.push(u);
        }
      },
    },
  },
  "Abrazo de Maipú": {
    destierroAlJugar: true,
    talisman: [sel(["yo:cementerio"], {}, "c", { n: 99, hasta: true }), mov("barajar", "c"), robar(3)],
  },
  "Absorber Kaiju": {
    reduce: "red",
    talisman: [sel(["todos:aliados"], {}, "x", { n: 99 }), efecto("x", { tipo: "pierdeHabilidad" }), mov("barajar")],
    fns: { red: (e) => N.aliadosDe(e, 0).length + N.aliadosDe(e, 1).length },
  },
  "Acabar la Esperanza": {
    claves: ["Exhumar"],
    requiere: { de: ["todos:enJuego"], filtro: { f: "objetivo" } },
    talisman: [sel(["todos:enJuego"], { f: "objetivo" }), { op: "fn", f: "vaciar" }],
    fns: {
      objetivo: (e, ctx, u) => N.carta(e, u).tipo === "Oro" || coste(e, u) <= 3,
      vaciar: (e, ctx) => {
        const [u] = ctx.vars.x ?? [];
        if (!u) return [];
        const tipo = N.carta(e, u).tipo;
        e.conv[u] = { tipo, sinHabilidad: true };
        return [{ op: "mostrarHasta", n: 2, filtro: { tipo }, como: "m" }, mov("mano", "m"), barajar()];
      },
    },
  },
  "Activar Tenshi Z": {
    talisman: [{ op: "fn", f: "tenshi" }, barajar()],
    activadas: [
      {
        texto: "Desterrarla de tu Cementerio: una carta pierde su habilidad por el turno",
        zona: "cementerio",
        requiere: { de: ["todos:enJuego"], filtro: {} },
        coste: [sel(["fuente"], {}, "yo"), mov("desterrar", "yo")],
        hacer: [sel(["todos:enJuego"]), efecto("x", { tipo: "pierdeHabilidad" })],
      },
    ],
    fns: {
      tenshi: (e, ctx, api) => {
        const castillo = e.jugadores[ctx.ctrl].castillo;
        const oro = castillo.find((u) => N.carta(e, u).tipo === "Oro");
        const otra = castillo.find((u) => ["Arma", "Tótem"].includes(N.carta(e, u).tipo));
        if (otra) N.mover(e, otra, "mano");
        if (oro) api.entrarOro(e, oro, ctx.ctrl, "pagado");
      },
    },
  },
  "Al Abordaje Muchachos": {
    claves: ["Furia"],
    talisman: [sel(["yo:cementerio"], {}, "c", { nf: "orosEnJuego", hasta: true }), { op: "fn", f: "convertir" }],
    disparadas: [{ cuando: ["faseFinal"], quien: "cualquiera", si: "convertida", hacer: [sel(["fuente"], {}, "yo"), mov("barajar", "yo"), { op: "fn", f: "robarUnaVez" }] }],
    fns: {
      orosEnJuego,
      convertir: (e, ctx) => [{ op: "convertir", var: "c", en: "Aliado", fuerza: 3, a: "defensa", como: ctx.def }],
      convertida: (e, ctx) => e.conv[ctx.fuente]?.como === ctx.def,
      robarUnaVez: (e, ctx) => {
        const clave = `muchachos|${ctx.ctrl}|${e.turno}`;
        if (e.usos[clave]) return;
        e.usos[clave] = true;
        N.robar(e, ctx.ctrl, 3);
      },
    },
  },
  "Amanecer Oscuro": {
    destierroAlJugar: true,
    talisman: [
      {
        op: "modo",
        n: 2,
        opciones: [
          { texto: "Prevenir el próximo daño que fueras a recibir", pasos: [{ op: "efecto", efecto: { tipo: "prevenirDano" }, jugador: "yo", fin: "proximoTurno" }] },
          {
            texto: "Buscar un Aliado o Tótem en un Castillo y ponerlo en la mano o Destierro de su dueño",
            pasos: [
              castilloElegido((quien) => [
                sel([`${quien}:castillo`], { tipo: ["Aliado", "Tótem"] }, "b"),
                { op: "modo", opciones: [{ texto: "Mano", pasos: [mov("mano", "b")] }, { texto: "Destierro", pasos: [mov("desterrar", "b")] }] },
                barajar(quien),
              ]),
            ],
          },
          {
            texto: "Barajar una carta de coste 2 o menos",
            requiere: { de: ["todos:enJuego"], filtro: noOroCoste(2) },
            pasos: [sel(["todos:enJuego"], noOroCoste(2), "y"), mov("barajar", "y")],
          },
        ],
      },
    ],
  },
  "Amarre de Bruja": {
    destierroAlJugar: true,
    requiere: "puede",
    talisman: [sel(["yo:aliados"], { costeMin: 2, f: "conPresa" }, "a"), sel(["rival:aliados"], { f: "presa" }, "b", { para: "tomar" }), { op: "fn", f: "amarrar" }],
    disparadas: [{ cuando: ["saleDelJuego"], quien: "cualquiera", si: "vinculo", hacer: [{ op: "fn", f: "soltar" }] }],
    fns: {
      puede: (e, ctx) => N.aliadosDe(e, ctx.ctrl).some((a) => coste(e, a) >= 2 && N.aliadosDe(e, N.rival(ctx.ctrl)).some((b) => N.fuerza(e, b) <= N.fuerza(e, a))),
      conPresa: (e, ctx, a) => N.aliadosDe(e, N.rival(ctx.ctrl)).some((b) => N.fuerza(e, b) <= N.fuerza(e, a)),
      presa: (e, ctx, b) => (ctx.vars.a ?? []).some((a) => N.fuerza(e, b) <= N.fuerza(e, a)),
      amarrar: (e, ctx) => {
        const [a] = ctx.vars.a ?? [];
        for (const b of ctx.vars.b ?? []) {
          const previo = N.controlador(e, b);
          N.mover(e, b, "defensa", { j: ctx.ctrl });
          e.jugadores[ctx.ctrl].nuevos.push(b);
          e.usos[`amarre|${b}`] = { a, j: previo };
          e.ganadas[b] = [...(e.ganadas[b] ?? []), ctx.def];
        }
      },
      vinculo: (e, ctx) => e.usos[`amarre|${ctx.fuente}`]?.a === ctx.datos.uid,
      soltar: (e, ctx) => {
        const b = ctx.fuente;
        const info = e.usos[`amarre|${b}`];
        delete e.usos[`amarre|${b}`];
        e.ganadas[b] = (e.ganadas[b] ?? []).filter((d) => d !== ctx.def);
        if (info && N.enJuego(e, b) && N.controlador(e, b) !== info.j) {
          N.mover(e, b, "defensa", { j: info.j });
          e.jugadores[info.j].nuevos.push(b);
        }
      },
    },
  },
  "Amor de Dulcinea": {
    talisman: [
      {
        op: "modo",
        n: 2,
        hasta: true,
        opciones: [
          {
            texto: "Prevenir que una carta salga del juego",
            requiere: { de: ["todos:enJuego"], filtro: {} },
            pasos: [sel(["todos:enJuego"]), efecto("x", { tipo: "noSale" })],
          },
          {
            texto: "Barajar una carta de coste 2 o menos",
            requiere: { de: ["todos:enJuego"], filtro: noOroCoste(2) },
            pasos: [sel(["todos:enJuego"], noOroCoste(2), "y"), mov("barajar", "y")],
          },
        ],
      },
    ],
  },
  "Aniquilar Titanes": {
    claves: ["NoAnulable"],
    talisman: [
      {
        op: "modo",
        opciones: [
          {
            texto: "Destruir una carta oponente de coste 2 o menos",
            requiere: { de: ["rival:enJuego"], filtro: noOroCoste(2), para: "destruir" },
            pasos: [sel(["rival:enJuego"], noOroCoste(2), "x", { para: "destruir" }), mov("destruir")],
          },
          {
            texto: "Barajar una carta sin habilidad que no sea Oro",
            requiere: { de: ["todos:enJuego"], filtro: { noTipo: ["Oro"], f: "sinHabilidad" } },
            pasos: [sel(["todos:enJuego"], { noTipo: ["Oro"], f: "sinHabilidad" }, "y"), mov("barajar", "y")],
          },
        ],
      },
      { op: "fn", f: "aOro" },
    ],
    fns: {
      sinHabilidad: (e, ctx, u) => !!N.carta(e, u).sinHabilidad,
      aOro: alResolverOro,
    },
  },
  "Aniquilar a la Bestia": {
    talisman: [sel(["todos:enJuego"], noOroCoste(4), "a", { hasta: true }), { op: "fn", f: "segunda" }],
    continuasCementerio: [{ fuerza: -1, costeMax: 99 }],
    fns: {
      segunda: (e, ctx) => {
        const [a] = ctx.vars.a ?? [];
        if (!a) return [];
        return [sel(["todos:enJuego"], { ...noOroCoste(4 - coste(e, a)), excluir: [a] }, "a2", { hasta: true }), { op: "fn", f: "tercera" }];
      },
      tercera: (e, ctx) => {
        const elegidas = [...(ctx.vars.a ?? []), ...(ctx.vars.a2 ?? [])];
        const finales = [{ op: "fn", f: "juntar" }, efecto("t", { tipo: "pierdeHabilidad" }, "mientras"), mov("destruir", "t")];
        if (elegidas.length < 2) return finales;
        const usado = elegidas.reduce((s, u) => s + coste(e, u), 0);
        return [sel(["todos:enJuego"], { ...noOroCoste(4 - usado), excluir: elegidas }, "a3", { hasta: true }), ...finales];
      },
      juntar: (e, ctx) => {
        ctx.vars.t = [...(ctx.vars.a ?? []), ...(ctx.vars.a2 ?? []), ...(ctx.vars.a3 ?? [])];
      },
    },
  },
  "Aparición del Sanatorio": {
    requiere: { de: ["todos:cementerio"], filtro: { tipo: "Aliado", costeMax: 2 }, para: "tomar" },
    talisman: [sel(["todos:cementerio"], { tipo: "Aliado", costeMax: 2 }, "x", { para: "tomar" }), { op: "fn", f: "convertir" }],
    continuas: [{ silenciaEntradaCosteMax: 1, si: "conTalisman" }],
    fns: {
      convertir: (e, ctx) => {
        for (const u of ctx.vars.x ?? []) e.usos[`sanatorio|${u}`] = ctx.fuente;
        return [{ op: "convertir", var: "x", en: "Tótem", a: "apoyo", como: ctx.def }];
      },
      conTalisman: (e, ctx) => {
        const t = e.usos[`sanatorio|${ctx.fuente}`];
        return !!t && N.dueno(t) === ctx.ctrl && e.jugadores[ctx.ctrl].cementerio.includes(t);
      },
    },
  },
};
