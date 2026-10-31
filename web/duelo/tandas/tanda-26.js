import * as N from "../nucleo.js";
import { sel, mov, barajar, robar, efecto, buscar, coste } from "../formato.js";
import { disponibles } from "../efectos.js";

const delPortador = (e, ctx) => N.portadorDe(e, ctx.fuente) === ctx.datos.uid;
const fuerzaDelPortador = (calc) => (e, ctx) => (N.portadorDe(e, ctx.fuente) === ctx.objetivo ? calc(e, ctx) : 0);
const costePortador = (e, ctx) => {
  const p = N.portadorDe(e, ctx.fuente);
  return p ? coste(e, p) : 0;
};

const barajarDeMano = {
  texto: "Barajar esta carta de tu mano para Robar una carta",
  zona: "mano",
  coste: [sel(["fuente"], {}, "yo"), mov("barajar", "yo")],
  hacer: [robar(1)],
};

const botadaPorDano = {
  zona: ["cementerio"],
  cuando: ["salenDelCastillo"],
  quien: "yo",
  si: "botadaPorDano",
  hacer: [{ op: "fn", f: "detenerBoteo" }],
};

const fnsBotada = {
  botadaPorDano: (e, ctx) => !!ctx.datos.porDano && ctx.datos.zona === "cementerio" && ctx.datos.uids.includes(ctx.fuente),
  detenerBoteo: (e, ctx) => {
    const uids = ctx.datos.uids;
    const resto = uids.slice(uids.indexOf(ctx.fuente) + 1).filter((u) => N.ubicar(e, u)?.zona === "cementerio");
    for (const u of resto) N.sacar(e, u);
    e.jugadores[ctx.ctrl].castillo.unshift(...resto);
    if (N.ubicar(e, ctx.fuente)?.zona === "cementerio") N.mover(e, ctx.fuente, "destierro");
  },
};

const desterrarOBarajar = [
  sel(["todos:cementerio"], {}, "c"),
  { op: "modo", opciones: [{ texto: "Barajar", pasos: [mov("barajar", "c")] }, { texto: "Desterrar", pasos: [mov("desterrar", "c")] }] },
];

const manoODestierro = (v) => ({
  op: "modo",
  opciones: [
    { texto: "A la mano", pasos: [mov("mano", v)] },
    { texto: "Al Destierro", pasos: [mov("desterrar", v)] },
  ],
});

export const HABILIDADES = {
  "Guia del Guardián": {
    portador: { fuerza: 2 },
    disparadas: [
      {
        cuando: ["entra"],
        hacer: [
          robar(1),
          sel(["yo:cementerio"], { tipo: "Aliado" }, "a", { hasta: true }),
          mov("mano", "a"),
          sel(["todos:cementerio"], {}, "d", { hasta: true }),
          mov("desterrar", "d"),
        ],
      },
    ],
  },
  Gungnir: {
    portador: { fuerza: 2 },
    disparadas: [{ cuando: ["entra"], opcional: true, hacer: buscar(["yo:castillo"], { tipo: "Oro" }, "pagado") }],
    activadas: [
      {
        texto: "Barajar hasta una carta oponente que no sea Oro y hasta cuatro cartas de los Cementerios",
        momento: "vigilia",
        veces: "turno",
        hacer: [
          sel(["rival:enJuego"], { noTipo: ["Oro"] }, "x", { hasta: true }),
          mov("barajar", "x"),
          sel(["todos:cementerio"], {}, "c", { n: 4, hasta: true }),
          mov("barajar", "c"),
        ],
      },
    ],
  },
  "Hacha Solar": {
    portador: { fuerza: 3, claves: ["Indestructible"] },
    activadas: [
      {
        texto: "Buscar en tu Castillo un Oro y ponerlo en tu Oro Pagado",
        momento: "vigilia",
        veces: "turno",
        hacer: buscar(["yo:castillo"], { tipo: "Oro" }, "pagado"),
      },
    ],
  },
  "Hacha de Seth": {
    portador: { fuerza: 2 },
    activadas: [
      {
        texto: "Barajar una carta de coste 2 o menos",
        momento: "vigilia",
        veces: "turno",
        requiere: { de: ["todos:enJuego"], filtro: { costeMax: 2 } },
        hacer: [sel(["todos:enJuego"], { costeMax: 2 }), mov("barajar")],
      },
      {
        texto: "Buscar dos cartas en cada Castillo: una al Cementerio y la otra a la mano o al Destierro",
        momento: "vigilia",
        veces: "turno",
        hacer: [
          sel(["yo:castillo"], {}, "c1"),
          mov("cementerio", "c1"),
          sel(["yo:castillo"], {}, "m1"),
          manoODestierro("m1"),
          barajar(),
          sel(["rival:castillo"], {}, "c2"),
          mov("cementerio", "c2"),
          sel(["rival:castillo"], {}, "m2"),
          manoODestierro("m2"),
          barajar("rival"),
        ],
      },
    ],
  },
  Hatchet: {
    claves: ["Exhumar"],
    portador: { fuerza: 2, noCambia: true, claves: ["NoBarajable"] },
    activadas: [
      {
        texto: "Un Oro y hasta una carta oponente pierden su habilidad hasta tu próximo turno y Robas dos cartas",
        momento: "tuTurno",
        veces: "turno",
        hacer: [
          sel(["todos:oros"], { tipo: "Oro" }, "o"),
          efecto("o", { tipo: "pierdeHabilidad" }, "proximoTurno"),
          sel(["rival:enJuego"], {}, "r", { hasta: true }),
          efecto("r", { tipo: "pierdeHabilidad" }, "proximoTurno"),
          robar(2),
        ],
      },
    ],
  },
  "Haz Atomico": {
    continuas: [{ fuerzaPor: "fuerzaCoste", a: "aliados" }],
    activadas: [
      {
        texto: "Barajar una carta de coste igual o menor al del portador",
        momento: "tuTurno",
        veces: "turno",
        requiere: "hayBarata",
        hacer: [sel(["todos:enJuego"], { f: "barata" }), mov("barajar")],
      },
    ],
    disparadas: [{ zona: ["cementerio"], cuando: ["juega"], quien: "yo", si: "primerAliado", hacer: [{ op: "fn", f: "blindar" }] }],
    fns: {
      fuerzaCoste: fuerzaDelPortador(costePortador),
      barata: (e, ctx, u) => coste(e, u) <= costePortador(e, ctx),
      hayBarata: (e, ctx) => N.todoEnJuego(e).some((u) => coste(e, u) <= costePortador(e, ctx)),
      primerAliado: (e, ctx) => ctx.datos.tipo === "Aliado" && ctx.datos.pagado !== false && coste(e, ctx.datos.uid) >= 2 && e.usos[`hazAtomico|${ctx.ctrl}`] !== e.turno,
      blindar: (e, ctx) => {
        e.usos[`hazAtomico|${ctx.ctrl}`] = e.turno;
        const item = e.pila.find((it) => it.uid === ctx.datos.uid);
        if (item) item.cerrada = true;
      },
    },
  },
  Jarngreipr: {
    claves: ["Exhumar"],
    portador: { fuerza: 3, claves: ["Imbloqueable"] },
    activadas: [
      {
        texto: "Barajar una carta que no sea Oro; no se pueden jugar cartas con su nombre hasta tu próximo turno",
        momento: "vigilia",
        veces: "turno",
        requiere: { de: ["todos:enJuego"], filtro: { noTipo: ["Oro"] } },
        hacer: [sel(["todos:enJuego"], { noTipo: ["Oro"] }), { op: "fn", f: "vetar" }, mov("barajar")],
      },
    ],
    fns: {
      vetar: (e, ctx) => {
        for (const u of ctx.vars.x ?? []) {
          for (const j of [0, 1]) N.agregarEfecto(e, { tipo: "noJugarNombre", j, nombre: N.carta(e, u).nombre, fin: "proximoTurno" }, ctx.ctrl);
        }
      },
    },
  },
  "Katana Colosal": {
    portador: { fuerza: 2, claves: ["Furia"] },
    disparadas: [
      { cuando: ["entra"], hacer: [robar(1)] },
      {
        cuando: ["haceDano"],
        quien: "cualquiera",
        si: "delPortador",
        hacer: [
          {
            op: "opcional",
            texto: "Desterrar una carta de un Cementerio y todas sus copias del Castillo y Cementerio de su dueño",
            requiere: { de: ["todos:cementerio"], filtro: {} },
            pasos: [sel(["todos:cementerio"], {}, "c"), { op: "fn", f: "copias" }],
          },
        ],
      },
    ],
    fns: {
      delPortador,
      copias: (e, ctx) => {
        for (const u of ctx.vars.c ?? []) {
          const nombre = N.carta(e, u).nombre;
          const d = N.dueno(u);
          const p = e.jugadores[d];
          const todas = [u, ...[...p.castillo, ...p.cementerio].filter((x) => x !== u && N.carta(e, x).nombre === nombre)];
          for (const x of todas) N.mover(e, x, "destierro");
          N.barajarCastillo(e, d);
        }
      },
    },
  },
  Kukri: {
    momentos: ["talismanes", "faseFinal"],
    requiere: "noFaseFinalPropia",
    portador: { fuerza: 2, claves: ["Indestructible"] },
    disparadas: [
      {
        cuando: ["entra"],
        hacer: [sel(["rival:mano"], {}, "x", { quien: "rival" }), mov("barajar"), { op: "si", f: "turnoRival", entonces: [robar(2)] }],
      },
    ],
    fns: {
      turnoRival: (e, ctx) => e.activo !== ctx.ctrl,
      noFaseFinalPropia: (e, ctx) => !(e.fase === "momento" && e.momento?.nombre === "final" && e.activo === ctx.ctrl),
    },
  },
  "La Esmeralda": {
    claves: ["Exhumar"],
    portador: { fuerza: 3, claves: ["Furia"] },
    disparadas: [
      { cuando: ["entra"], hacer: [{ op: "generar", n: 1 }] },
      {
        cuando: ["comienzoTurno"],
        quien: "cualquiera",
        hacer: [sel(["rival:mano"], {}, "x", { quien: "rival" }), mov("barajar"), { op: "si", f: "otraArma", entonces: [robar(2)] }],
      },
    ],
    fns: { otraArma: (e, ctx) => N.armasDe(e, ctx.ctrl).some((a) => a !== ctx.fuente) },
  },
  "Lanza Argenta": {
    portador: { fuerza: 2, claves: ["Indesterrable"] },
    activadas: [{ texto: "Destruir esta Arma para Robar tres cartas", coste: [sel(["fuente"], {}, "yo"), mov("destruir", "yo")], hacer: [robar(3)] }],
    disparadas: [
      {
        zona: ["cementerio"],
        cuando: ["alCementerio"],
        quien: "propia",
        hacer: [sel(["todos:cementerio"], { noFuente: true }, "c", { n: 2, hasta: true }), sel(["fuente"], {}, "yo"), mov("barajar", "yo"), mov("barajar", "c")],
      },
    ],
  },
  "Lanza Sacra": {
    portador: { fuerza: 1, claves: ["Furia"] },
    disparadas: [
      {
        cuando: ["entra"],
        hacer: [
          {
            op: "modo",
            hasta: true,
            opciones: [
              {
                texto: "Jugar un Arma de tu Destierro reduciendo su coste en un Oro (mínimo 1)",
                requiere: { de: ["yo:destierro"], filtro: { tipo: "Arma", f: "pagable" } },
                pasos: [sel(["yo:destierro"], { tipo: "Arma", f: "pagable" }, "a"), { op: "fn", f: "jugarDeDestierro" }],
              },
              {
                texto: "Subir un Arma de tu Destierro a tu mano",
                requiere: { de: ["yo:destierro"], filtro: { tipo: "Arma" } },
                pasos: [sel(["yo:destierro"], { tipo: "Arma" }, "a"), mov("mano", "a")],
              },
            ],
          },
        ],
      },
    ],
    activadas: [barajarDeMano],
    fns: {
      pagable: (e, ctx, u) => Math.max(1, coste(e, u) - 1) <= disponibles(e, ctx.ctrl, "Arma"),
      jugarDeDestierro: (e, ctx, api) => {
        const [a] = ctx.vars.a ?? [];
        if (!a) return [];
        const pagar = Math.max(1, coste(e, a) - 1);
        if (pagar > api.disponibles(e, ctx.ctrl, "Arma")) return [];
        api.pagarOros(e, ctx.ctrl, pagar, "Arma");
        return [sel(["yo:aliados"], { armaLibre: a }, "_p"), { op: "portar", arma: a, en: "_p", datos: { pagado: true, desde: "destierro" } }];
      },
    },
  },
  "Lanza de Exorcista": {
    claves: ["Exhumar"],
    portador: { fuerza: 3, claves: ["Furia", "Imbloqueable"] },
    activadas: [
      {
        texto: "Desterrar cartas oponentes cuyos costes sumen hasta 3",
        veces: "turno",
        requiere: { de: ["rival:enJuego"], filtro: { costeMax: 3 }, para: "desterrar" },
        hacer: [{ op: "fn", f: "siguiente" }],
      },
    ],
    disparadas: [
      {
        cuando: ["faseFinal"],
        quien: "cualquiera",
        hacer: [
          sel(["todos:cementerio"], {}, "c", { n: 3, hasta: true }),
          mov("barajar", "c"),
          sel(["todos:cementerio"], {}, "d", { nf: "resto", hasta: true }),
          mov("desterrar", "d"),
          robar(1),
        ],
      },
    ],
    fns: {
      resto: (e, ctx) => 3 - (ctx.vars.c ?? []).length,
      siguiente: (e, ctx) => {
        const acum = [...(ctx.vars.acum ?? []), ...(ctx.vars.d ?? [])];
        ctx.vars.acum = acum;
        const libre = 3 - acum.reduce((s, u) => s + coste(e, u), 0);
        return [
          sel(["rival:enJuego"], { costeMax: libre, excluir: acum }, "d", { hasta: true, para: "desterrar" }),
          { op: "si", f: "eligio", entonces: [{ op: "fn", f: "siguiente" }], sino: [mov("desterrar", "acum")] },
        ];
      },
      eligio: (e, ctx) => (ctx.vars.d ?? []).length > 0,
    },
  },
  "Lanza de Madera": {
    claves: ["Exhumar"],
    portador: { fuerza: 1, claves: ["Imbloqueable", "DanoAlDestierro"] },
  },
  "Lanza de Sombras": {
    claves: ["Exhumar"],
    portador: { fuerza: 1, claves: ["Furia"] },
    activadas: [
      {
        texto: "Destruir un Aliado que controles: Barajar una carta oponente de coste 2 o menos, Desterrar la carta del tope de un Castillo y Robar una carta",
        momento: "tuTurno",
        veces: "turno",
        requiere: { de: ["yo:aliados"], filtro: {}, para: "destruir" },
        coste: [sel(["yo:aliados"], {}, "s", { para: "destruir" }), mov("destruir", "s")],
        hacer: [
          sel(["rival:enJuego"], { costeMax: 2 }),
          mov("barajar"),
          {
            op: "modo",
            opciones: [
              { texto: "Tope de tu Castillo", pasos: [{ op: "desterrarTope", n: 1, quien: "yo" }] },
              { texto: "Tope del Castillo oponente", pasos: [{ op: "desterrarTope", n: 1, quien: "rival" }] },
            ],
          },
          robar(1),
        ],
      },
    ],
  },
  "Lanza del Juramento": {
    portador: { fuerza: 4, claves: ["Furia"] },
    disparadas: [
      {
        cuando: ["entra"],
        hacer: [
          sel(["rival:oros"], { tipo: "Oro" }, "o"),
          { ...efecto("o", { tipo: "noAgrupa" }, "juego"), jugador: "rival" },
          sel(["todos:enJuego"], {}, "h"),
          efecto("h", { tipo: "pierdeHabilidad" }, "turnoRival"),
        ],
      },
      {
        cuando: ["haceDano"],
        quien: "cualquiera",
        si: "delPortador",
        hacer: [sel(["yo:mano", "yo:cementerio"], { tipo: ["Aliado", "Arma", "Tótem"], costeMax: 2 }, "g"), { op: "jugarGratis", var: "g" }],
      },
    ],
    fns: { delPortador },
  },
  Luthairon: {
    claves: ["Exhumar"],
    portador: { fuerza: 1, claves: ["Indestructible"] },
    disparadas: [{ cuando: ["entra"], hacer: [{ op: "fn", f: "robarCoste" }] }],
    fns: { robarCoste: (e, ctx) => [{ op: "robarHasta", n: costePortador(e, ctx) }] },
  },
  "Machete del Abuelo": {
    activadas: [
      {
        texto: "Un Aliado gana Furia y 2 de Fuerza permanentemente y puedes Robar hasta su coste más una cartas",
        momento: "tuTurno",
        veces: "turno",
        requiere: { de: ["todos:aliados"], filtro: {} },
        hacer: [
          sel(["todos:aliados"], {}, "a"),
          efecto("a", { tipo: "fuerza", n: 2 }, "mientras"),
          efecto("a", { tipo: "gana", clave: "Furia" }, "mientras"),
          { op: "fn", f: "robarCoste" },
        ],
      },
      {
        texto: "Una carta que no sea Oro pierde su habilidad y es Desterrada",
        veces: "turno",
        requiere: { de: ["todos:enJuego"], filtro: { noTipo: ["Oro"] }, para: "desterrar" },
        hacer: [sel(["todos:enJuego"], { noTipo: ["Oro"] }, "x", { para: "desterrar" }), efecto("x", { tipo: "pierdeHabilidad" }, "mientras"), mov("desterrar")],
      },
    ],
    fns: {
      robarCoste: (e, ctx) => {
        const [a] = ctx.vars.a ?? [];
        return a ? [{ op: "robarHasta", n: coste(e, a) + 1 }] : [];
      },
    },
  },
  "Macuñ": {
    exhumarSi: "conRaza",
    portador: { fuerza: 2, claves: ["NoConvertible"] },
    activadas: [{ texto: "Barajar o Desterrar una carta de un Cementerio", momento: "tuTurno", veces: "turno", requiere: { de: ["todos:cementerio"], filtro: {} }, hacer: desterrarOBarajar }],
    fns: {
      conRaza: (e, ctx) => N.aliadosDe(e, ctx.ctrl).some((a) => (N.carta(e, a).razas ?? []).some((r) => ["Caballero", "Guerrero", "Héroe"].includes(r))),
    },
  },
  "Martillo Mjlnir": {
    portador: { fuerza: 3 },
    activadas: [
      {
        texto: "Subir un Aliado de tu Cementerio a tu mano",
        momento: "vigilia",
        veces: "turno",
        requiere: { de: ["yo:cementerio"], filtro: { tipo: "Aliado" } },
        hacer: [sel(["yo:cementerio"], { tipo: "Aliado" }), mov("mano")],
      },
    ],
    disparadas: [
      { cuando: ["haceDano"], quien: "cualquiera", si: "delPortador", hacer: [{ op: "fn", f: "marcar" }] },
      {
        cuando: ["faseFinal"],
        si: "hizoDano",
        opcional: true,
        hacer: [
          {
            op: "modo",
            opciones: [
              { texto: "Tu Cementerio", pasos: [sel(["yo:cementerio"], {}, "c", { n: 5, hasta: true }), mov("desterrar", "c")] },
              { texto: "Cementerio oponente", pasos: [sel(["rival:cementerio"], {}, "c", { n: 5, hasta: true }), mov("desterrar", "c")] },
            ],
          },
        ],
      },
    ],
    fns: {
      delPortador,
      marcar: (e, ctx) => {
        e.usos[`mjolnir|${ctx.fuente}`] = e.turno;
      },
      hizoDano: (e, ctx) => e.usos[`mjolnir|${ctx.fuente}`] === e.turno,
    },
  },
  "Mosquete Charleville": {
    portador: { fuerza: 2 },
    disparadas: [{ cuando: ["entra"], hacer: [sel(["yo:mano"], {}, "x", { n: 99, hasta: true }), { op: "fn", f: "canje" }] }],
    fns: {
      canje: (e, ctx) => {
        const k = (ctx.vars.x ?? []).length;
        for (const u of ctx.vars.x ?? []) N.mover(e, u, "castillo");
        if (k) N.barajarCastillo(e, ctx.ctrl);
        N.robar(e, ctx.ctrl, k + 1);
      },
    },
  },
  Peacemaker: {
    portador: { claves: ["Furia"] },
    continuas: [{ fuerzaPor: "porMano", a: "aliados" }],
    disparadas: [
      {
        cuando: ["entra"],
        opcional: true,
        hacer: [sel(["yo:castillo", "yo:cementerio"], { tipo: "Arma", f: "distinto" }, "b", { n: 3, hasta: true }), mov("mano", "b"), barajar()],
      },
    ],
    fns: {
      porMano: fuerzaDelPortador((e, ctx) => e.jugadores[ctx.ctrl].mano.length),
      distinto: (e, ctx, u) => !(ctx.vars.b ?? []).some((x) => N.carta(e, x).nombre === N.carta(e, u).nombre),
    },
  },
  "Pistola de Dos Cañones": {
    portador: { fuerza: 2 },
    disparadas: [
      {
        cuando: ["haceDano"],
        quien: "cualquiera",
        si: "delPortador",
        hacer: [
          {
            op: "opcional",
            texto: "Barajar una carta de coste 2 o menos",
            requiere: { de: ["todos:enJuego"], filtro: { costeMax: 2 } },
            pasos: [sel(["todos:enJuego"], { costeMax: 2 }), mov("barajar")],
          },
        ],
      },
      botadaPorDano,
    ],
    activadas: [barajarDeMano],
    fns: { delPortador, ...fnsBotada },
  },
  "Pistolas de Duelo": {
    claves: ["Exhumar"],
    portador: { fuerza: 2, claves: ["Imbloqueable"] },
    activadas: [
      {
        texto: "Si el portador cuesta 2 o menos, puedes Descartar una carta para que dispare su habilidad de entrar en juego; si no, Robar dos cartas",
        momento: "tuTurno",
        veces: "turno",
        hacer: [
          {
            op: "si",
            f: "barato",
            entonces: [
              {
                op: "opcional",
                texto: "Descartar una carta para que el portador dispare su habilidad de entrar en juego",
                requiere: { de: ["yo:mano"], filtro: {} },
                pasos: [sel(["yo:mano"], {}, "d"), mov("cementerio", "d"), { op: "fn", f: "reentrar" }],
              },
            ],
            sino: [robar(2)],
          },
        ],
      },
    ],
    fns: {
      barato: (e, ctx) => {
        const p = N.portadorDe(e, ctx.fuente);
        return !!p && coste(e, p) <= 2;
      },
      reentrar: (e, ctx) => {
        const p = N.portadorDe(e, ctx.fuente);
        if (p) N.disparar(e, "entra", { uid: p, j: ctx.ctrl });
      },
    },
  },
  "Puo Estelar": {
    claves: ["Exhumar"],
    portador: { fuerza: 3, claves: ["Furia"] },
    activadas: [
      {
        texto: "Barajar esta carta de tu mano para prevenir que una carta que controles sea afectada por un Oro o carta de coste 0",
        zona: "mano",
        coste: [sel(["fuente"], {}, "yo"), mov("barajar", "yo")],
        requiere: { de: ["yo:enJuego"], filtro: {} },
        hacer: [
          sel(["yo:enJuego"], {}, "p"),
          efecto("p", { tipo: "proteccion", por: ["Oro"] }, "turno"),
          efecto("p", { tipo: "proteccion", costeMax: 0 }, "turno"),
        ],
      },
    ],
    disparadas: [botadaPorDano],
    fns: { ...fnsBotada },
  },
};
