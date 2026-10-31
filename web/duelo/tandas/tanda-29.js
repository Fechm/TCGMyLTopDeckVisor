import * as N from "../nucleo.js";
import { sel, mov, barajar, robar, efecto, buscar, coste } from "../formato.js";

const dispo = (e, j, tipo) => {
  const p = e.jugadores[j];
  return p.reserva.length + (p.generados ?? []).filter((g) => !g.tipos || (tipo && g.tipos.includes(tipo))).reduce((s, g) => s + g.n, 0);
};

const precio = (e, u, red, min) => {
  const c = coste(e, u);
  return Math.max(Math.min(c, min), c - red);
};

const pagable = (red, min) => (e, ctx, u) => {
  const c = N.carta(e, u);
  if (c.tipo === "Arma" && !N.aliadosDe(e, ctx.ctrl).length) return false;
  return precio(e, u, red, min) <= dispo(e, ctx.ctrl, c.tipo);
};

const jugarPagando = (red, min) => (e, ctx, api) => {
  const [u] = ctx.vars.x ?? [];
  if (!u) return;
  const c = N.carta(e, u);
  const n = precio(e, u, red, min);
  if (n > api.disponibles(e, ctx.ctrl, c.tipo)) return;
  const desde = N.ubicar(e, u)?.zona ?? null;
  api.pagarOros(e, ctx.ctrl, n, c.tipo);
  N.disparar(e, "juega", { uid: u, j: ctx.ctrl, tipo: c.tipo, pagado: true, desde });
  const datos = { pagado: true, desde };
  if (c.tipo === "Arma") return [sel(["yo:aliados"], { armaLibre: u }, "_port"), { op: "portar", arma: u, en: "_port", datos }];
  return [{ op: "entrar", uid: u, datos }];
};

const hayPagable = (zonas, filtro, red, min) => (e, ctx) =>
  zonas.flatMap((z) => e.jugadores[ctx.ctrl][z]).some((u) => {
    const c = N.carta(e, u);
    if (filtro.tipo && ![].concat(filtro.tipo).includes(c.tipo)) return false;
    if (filtro.costeMin !== undefined && coste(e, u) < filtro.costeMin) return false;
    return pagable(red, min)(e, ctx, u);
  });

const nTotemsEnJuego = (e) => [0, 1].flatMap((j) => e.jugadores[j].apoyo).filter((u) => N.carta(e, u).tipo === "Tótem").length;

const sumaHasta = (max, como) => (e, ctx, u) => (ctx.vars[como] ?? []).reduce((s, x) => s + coste(e, x), 0) + coste(e, u) <= max;

const mismoCementerio = (como) => (e, ctx, u) => {
  const [p] = ctx.vars[como] ?? [];
  return !p || N.dueno(p) === N.dueno(u);
};

const conAliados = (e, ctx) => N.aliadosDe(e, ctx.ctrl).length > 0;
const sinAliados = (e, ctx) => N.aliadosDe(e, ctx.ctrl).length === 0;
const conMano = (e, ctx) => e.jugadores[ctx.ctrl].mano.length > 0;
const esMonte = (e, ctx, u) => N.carta(e, u).nombre.startsWith("Monte");

const agruparOro = [sel(["yo:pagado"], { tipo: "Oro" }, "o"), mov("reserva", "o")];

export const HABILIDADES = {
  Humberstone: {
    activadas: [
      {
        texto: "Jugar un Aliado desde tu mano o Cementerio reduciendo su coste en un Oro (mínimo 1)",
        momento: "tuTurno",
        veces: "turno",
        requiere: "puede",
        hacer: [sel(["yo:mano", "yo:cementerio"], { tipo: "Aliado", f: "pagable" }), { op: "fn", f: "jugar" }],
      },
    ],
    fns: {
      pagable: pagable(1, 1),
      jugar: jugarPagando(1, 1),
      puede: hayPagable(["mano", "cementerio"], { tipo: "Aliado" }, 1, 1),
    },
  },
  "Hy Brasil": {
    activadas: [
      {
        texto: "Tu oponente Bota una carta por cada Tótem en juego; luego Destierra hasta tres cartas de un Cementerio",
        momento: "vigilia",
        veces: "turno",
        hacer: [
          { op: "botar", quien: "rival", nf: "nTotems" },
          sel(["todos:cementerio"], { f: "mismo" }, "c", { n: 3, hasta: true }),
          mov("desterrar", "c"),
        ],
      },
    ],
    fns: { nTotems: (e) => nTotemsEnJuego(e), mismo: mismoCementerio("c") },
  },
  "Karakórum": {
    activadas: [
      {
        texto: "Mirar tantas cartas del tope de tu Castillo como Aliados controles, poner dos en tu mano y Barajar el resto",
        veces: "turno",
        requiere: "conAliados",
        hacer: [{ op: "tope", nf: "nAliados", como: "m" }, sel(["var:m"], { zona: "castillo" }, "p", { n: 2 }), mov("mano", "p"), barajar()],
      },
    ],
    continuas: [{ fuerza: 1, a: "tusAliados" }],
    fns: { conAliados, nAliados: (e, ctx) => N.aliadosDe(e, ctx.ctrl).length },
  },
  "La Mancha": {
    claves: ["Indestructible", "Indesterrable"],
    activadas: [
      {
        texto: "Barajar cartas oponentes cuyos costes sumen 3 o menos, o buscar una carta en tu Castillo",
        veces: "turno",
        hacer: [
          {
            op: "modo",
            opciones: [
              {
                texto: "Barajar cartas oponentes cuyos costes sumen 3 o menos",
                requiere: { de: ["rival:enJuego"], filtro: { costeMax: 3 } },
                pasos: [sel(["rival:enJuego"], { f: "suma3" }, "x", { n: 99, hasta: true }), mov("barajar")],
              },
              { texto: "Buscar una carta en tu Castillo", pasos: buscar(["yo:castillo"], {}) },
            ],
          },
        ],
      },
    ],
    disparadas: [{ cuando: ["faseFinal"], hacer: [sel(["yo:cementerio"], {}, "c", { n: 3, hasta: true }), mov("barajar", "c"), ...agruparOro, robar(2)] }],
    fns: { suma3: sumaHasta(3, "x") },
  },
  "Laboratorio Siniestro": {
    activadas: [
      {
        texto: "Buscar en tu Castillo un Aliado y un Oro y ponerlos en tu mano",
        momento: "vigilia",
        veces: "turno",
        hacer: [sel(["yo:castillo"], { tipo: "Aliado" }, "a"), sel(["yo:castillo"], { tipo: "Oro" }, "o"), mov("mano", "a"), mov("mano", "o"), barajar()],
      },
      {
        texto: "Un Aliado que controles gana Furia y su daño va al Destierro este turno",
        momento: "vigilia",
        veces: "turno",
        requiere: "conAliados",
        hacer: [sel(["yo:aliados"]), efecto("x", { tipo: "gana", clave: "Furia" }), efecto("x", { tipo: "gana", clave: "DanoAlDestierro" })],
      },
    ],
    fns: { conAliados },
  },
  Ladurum: {
    orosMenos: "mostradas",
    activadas: [
      {
        texto: "Mostrar cartas del tope de tu Castillo hasta un Aliado y un Arma o Tótem; ponerlos en tu mano y Barajar el resto",
        veces: "turno",
        hacer: [{ op: "fn", f: "mostrar" }, mov("mano", "m"), barajar()],
      },
    ],
    fns: {
      mostradas: (e, ctx) => e.jugadores[ctx.ctrl].mano.filter((u) => u !== ctx.fuente).reduce((s, u) => s + coste(e, u), 0),
      mostrar: (e, ctx) => {
        let aliado = null;
        let otra = null;
        for (const u of e.jugadores[ctx.ctrl].castillo) {
          const t = N.carta(e, u).tipo;
          if (!aliado && t === "Aliado") aliado = u;
          else if (!otra && (t === "Arma" || t === "Tótem")) otra = u;
          if (aliado && otra) break;
        }
        ctx.vars.m = [aliado, otra].filter(Boolean);
      },
    },
  },
  Leng: {
    claves: ["NoAnulable"],
    disparadas: [{ cuando: ["entra", "comienzoTurno"], hacer: [{ op: "desterrarTope", quien: "rival", nf: "orosRival" }] }],
    fns: { orosRival: (e, ctx) => e.jugadores[N.rival(ctx.ctrl)].reserva.length },
  },
  Londres: {
    claves: ["Indesterrable"],
    disparadas: [
      {
        cuando: ["entra"],
        hacer: [sel(["yo:castillo"], { tipo: ["Aliado", "Tótem"], f: "pagable" }), { op: "fn", f: "jugar" }, barajar()],
      },
    ],
    activadas: [
      {
        texto: "Los Aliados oponentes pierden 1 de Fuerza permanentemente y una carta pierde su habilidad por el turno",
        veces: "turno",
        hacer: [{ op: "fn", f: "debilitar" }, sel(["todos:enJuego"], { noFuente: true }, "h"), efecto("h", { tipo: "pierdeHabilidad" })],
      },
    ],
    fns: {
      pagable: pagable(1, 0),
      jugar: jugarPagando(1, 0),
      debilitar: (e, ctx) => {
        for (const u of N.aliadosDe(e, N.rival(ctx.ctrl))) N.agregarEfecto(e, { tipo: "fuerza", uid: u, n: -1, fin: "juego" }, ctx.ctrl);
      },
    },
  },
  Luxor: {
    activadas: [
      {
        texto: "Descartar una carta que no sea Talismán para buscar en tu Castillo una carta del mismo tipo",
        momento: "vigilia",
        veces: "turno",
        requiere: "descartable",
        coste: [sel(["yo:mano"], { noTipo: ["Talismán"] }, "d"), mov("cementerio", "d")],
        hacer: [sel(["yo:castillo"], { f: "mismoTipo" }, "b"), mov("mano", "b"), barajar()],
      },
    ],
    continuas: [{ fuerza: 1, a: "tusAliados" }],
    fns: {
      descartable: (e, ctx) => e.jugadores[ctx.ctrl].mano.some((u) => N.carta(e, u).tipo !== "Talismán"),
      mismoTipo: (e, ctx, u) => {
        const [d] = ctx.vars.d ?? [];
        return !!d && N.carta(e, u).tipo === N.carta(e, d).tipo;
      },
    },
  },
  Magog: {
    activadas: [
      {
        texto: "Destruir un Aliado de coste 3 o menos y Robar una carta",
        veces: "turno",
        requiere: { de: ["todos:aliados"], filtro: { costeMax: 3 }, para: "destruir" },
        hacer: [sel(["todos:aliados"], { costeMax: 3 }, "x", { para: "destruir" }), mov("destruir"), robar(1)],
      },
    ],
  },
  Manicomio: {
    activadas: [
      {
        texto: "Mostrar cartas del tope de tu Castillo hasta un Aliado de coste 2 o menos y ponerlo en tu mano",
        momento: "tuTurno",
        veces: "turno",
        hacer: [{ op: "mostrarHasta", n: 1, filtro: { tipo: "Aliado", costeMax: 2 }, como: "m" }, mov("mano", "m")],
      },
    ],
  },
  "Mar de Azufre": {
    claves: ["ProtegidoCoste1"],
  },
  "Mesa del Te": {
    claves: ["Exhumar"],
    continuas: [{ fuerza: 1, a: "tusAliados" }],
  },
  Metropolitan: {
    disparadas: [
      {
        cuando: ["entra"],
        hacer: [
          {
            op: "modo",
            opciones: [
              { texto: "Generar un Oro para Aliados", pasos: [{ op: "generar", n: 1, tipos: ["Aliado"] }] },
              { texto: "Robar dos cartas", pasos: [robar(2)] },
            ],
          },
        ],
      },
      { cuando: ["ataca"], hacer: [sel(["todos:aliados"], { f: "otro" }, "x"), { op: "fn", f: "fuerza5" }] },
      { cuando: ["faseFinal"], si: "convertido", hacer: [{ op: "fn", f: "volver" }] },
    ],
    activadas: [
      {
        texto: "Convertirlo en un Aliado con Fuerza 3 hasta la Fase Final",
        momento: "vigilia",
        veces: "turno",
        requiere: "esTotem",
        hacer: [{ op: "fn", f: "aAliado" }],
      },
    ],
    fns: {
      esTotem: (e, ctx) => e.jugadores[ctx.ctrl].apoyo.includes(ctx.fuente),
      convertido: (e, ctx) => !!e.conv[ctx.fuente],
      otro: (e, ctx, u) => N.carta(e, u).nombre !== "Metropolitan",
      aAliado: (e, ctx) => {
        e.conv[ctx.fuente] = { tipo: "Aliado", fuerza: 3, como: ctx.def };
        N.sacar(e, ctx.fuente);
        e.jugadores[ctx.ctrl].defensa.push(ctx.fuente);
      },
      volver: (e, ctx) => {
        delete e.conv[ctx.fuente];
        if (!N.enJuego(e, ctx.fuente)) return;
        N.sacar(e, ctx.fuente);
        e.jugadores[ctx.ctrl].apoyo.push(ctx.fuente);
      },
      fuerza5: (e, ctx) => {
        for (const u of ctx.vars.x ?? []) N.agregarEfecto(e, { tipo: "fuerza", uid: u, n: 5 - N.fuerza(e, u) }, ctx.ctrl);
      },
    },
  },
  "Mina Maldita": {
    disparadas: [{ cuando: ["entra"], hacer: [sel(["rival:enJuego"], { costeMax: 2, noTipo: ["Oro"] }, "x", { n: 99, para: "desterrar" }), mov("desterrar")] }],
    activadas: [
      {
        texto: "Robar dos cartas o convertir una carta al azar de la mano oponente en un Oro sin habilidad en tu Oro Pagado",
        veces: "turno",
        hacer: [
          {
            op: "modo",
            opciones: [
              { texto: "Robar dos cartas", pasos: [robar(2)] },
              {
                texto: "Convertir una carta al azar de la mano oponente en Oro",
                requiere: "manoRival",
                pasos: [sel(["rival:mano"], {}, "x", { azar: true }), { op: "convertir", var: "x", en: "Oro", a: "pagado" }],
              },
            ],
          },
        ],
      },
    ],
    fns: { manoRival: (e, ctx) => e.jugadores[N.rival(ctx.ctrl)].mano.length > 0 },
  },
  "Monte Hermon": {
    disparadas: [{ cuando: ["entra"], hacer: buscar(["yo:castillo"], { tipo: "Tótem", f: "monte" }) }],
    activadas: [
      {
        texto: "Descartar un Aliado o Tótem para mostrar cartas del tope de tu Castillo hasta un Talismán y ponerlo en tu mano",
        veces: "turno",
        requiere: { de: ["yo:mano"], filtro: { tipo: ["Aliado", "Tótem"] } },
        coste: [sel(["yo:mano"], { tipo: ["Aliado", "Tótem"] }, "d"), mov("cementerio", "d")],
        hacer: [{ op: "mostrarHasta", n: 1, filtro: { tipo: "Talismán" }, como: "m" }, mov("mano", "m")],
      },
    ],
    continuas: [{ fuerza: -1, a: "aliadosRival" }],
    fns: { monte: esMonte },
  },
  "Monte Meguido": {
    disparadas: [{ cuando: ["entra"], hacer: buscar(["yo:castillo"], { tipo: "Tótem", f: "monte" }) }],
    activadas: [
      {
        texto: "Descartar una carta para jugar un Aliado de coste 3 o más de tu Cementerio reduciendo su coste en un Oro",
        veces: "turno",
        requiere: "puede",
        coste: [sel(["yo:mano"], {}, "d"), mov("cementerio", "d")],
        hacer: [sel(["yo:cementerio"], { tipo: "Aliado", costeMin: 3, f: "pagable" }), { op: "fn", f: "jugar" }],
      },
    ],
    continuas: [{ fuerza: 1, a: "tusAliados" }, { gana: "Indestructible", a: "tusAliados" }],
    fns: {
      monte: esMonte,
      pagable: pagable(1, 1),
      jugar: jugarPagando(1, 1),
      puede: (e, ctx) => conMano(e, ctx) && hayPagable(["cementerio"], { tipo: "Aliado", costeMin: 3 }, 1, 1)(e, ctx),
    },
  },
  "Monumento Heroico": {
    disparadas: [{ cuando: ["entra"], hacer: [sel(["todos:cementerio"], {}, "c", { n: 4, hasta: true }), mov("barajar", "c"), robar(3)] }],
    continuas: [{ aliadosNoPierden: true }, { fuerza: 1, a: "tusAliados" }],
  },
  "Monumento Inmortal": {
    respuestaMano: { anula: { tipo: "Aliado", coste: 0 }, oros: 0 },
    disparadas: [{ cuando: ["sale"], hacer: [robar(2)] }],
  },
  "Morro de Arica": {
    disparadas: [{ cuando: ["entra"], opcional: true, hacer: buscar(["yo:castillo"], { tipo: "Arma", costeMin: 2, costeMax: 2 }) }],
    activadas: [{ texto: "Generar un Oro para jugar Armas", veces: "turno", hacer: [{ op: "generar", n: 1, tipos: ["Arma"] }] }],
  },
  "Nunca Jamas": {
    claves: ["Exhumar"],
    requiere: "conAliados",
    activadas: [
      {
        texto: "Hasta dos Aliados ganan o pierden 2 de Fuerza por el turno",
        veces: "turno",
        requiere: { de: ["todos:aliados"], filtro: {} },
        hacer: [
          sel(["todos:aliados"], {}, "x", { n: 2, hasta: true }),
          {
            op: "modo",
            opciones: [
              { texto: "Ganan 2 de Fuerza", pasos: [efecto("x", { tipo: "fuerza", n: 2 })] },
              { texto: "Pierden 2 de Fuerza", pasos: [efecto("x", { tipo: "fuerza", n: -2 })] },
            ],
          },
        ],
      },
    ],
    fns: { conAliados },
  },
  "Ojo Antiguo": {
    activadas: [
      {
        texto: "Prevenir que otra carta salga del juego, o Destruir todas las cartas de coste 1 o menos y Robar una carta",
        veces: "turno",
        hacer: [
          {
            op: "modo",
            opciones: [
              {
                texto: "Prevenir que otra carta salga del juego",
                requiere: { de: ["todos:enJuego"], filtro: { noFuente: true } },
                pasos: [sel(["todos:enJuego"], { noFuente: true }), efecto("x", { tipo: "noSale" })],
              },
              {
                texto: "Destruir todas las cartas de coste 1 o menos y Robar una carta",
                pasos: [sel(["todos:enJuego"], { costeMax: 1, noTipo: ["Oro"] }, "x", { n: 99, para: "destruir" }), mov("destruir"), robar(1)],
              },
            ],
          },
        ],
      },
    ],
    continuas: [{ gana: "Indestructible", a: "tusAliados" }, { gana: "Indesterrable", a: "tusAliados" }],
  },
  Olimpia: {
    disparadas: [
      { cuando: ["juega"], quien: "yo", si: "talismanSinAliados", hacer: [{ op: "botar", n: 1, quien: "rival" }] },
      { cuando: ["faseFinal"], si: "sinAliados", opcional: true, hacer: buscar(["yo:castillo"], { tipo: "Talismán", costeMin: 3 }) },
    ],
    fns: {
      sinAliados,
      talismanSinAliados: (e, ctx) => ctx.datos.tipo === "Talismán" && sinAliados(e, ctx),
    },
  },
  "Palacio de la Real Audiencia": {
    claves: ["Exhumar"],
    disparadas: [
      { cuando: ["entra"], hacer: [sel(["rival:enJuego"], { f: "suma3" }, "x", { n: 3, hasta: true }), mov("barajar")] },
      {
        cuando: ["juega"],
        quien: "yo",
        veces: 3,
        si: "aliado",
        opcional: true,
        hacer: [sel(["todos:cementerio"], { f: "mismo" }, "c", { n: 2, hasta: true }), mov("barajar", "c"), robar(1)],
      },
    ],
    fns: {
      suma3: sumaHasta(3, "x"),
      mismo: mismoCementerio("c"),
      aliado: (e, ctx) => ctx.datos.tipo === "Aliado",
    },
  },
  "París": {
    activadas: [
      {
        texto: "Buscar en tu Castillo un Oro sin habilidad y ponerlo en tu Oro Pagado",
        momento: "tuTurno",
        veces: "turno",
        hacer: buscar(["yo:castillo"], { tipo: "Oro", f: "sinHab" }, "pagado"),
      },
      {
        texto: "Poner una carta de tu mano en el tope de tu Castillo y dos cartas del fondo en tu mano",
        momento: "tuTurno",
        veces: "turno",
        requiere: "conMano",
        hacer: [sel(["yo:mano"], {}, "t"), mov("castillo", "t"), { op: "tope", n: 2, fondo: true, como: "f" }, mov("mano", "f")],
      },
    ],
    disparadas: [
      {
        cuando: ["comienzoVigilia"],
        quien: "rival",
        si: "puede",
        opcional: true,
        hacer: [sel(["yo:mano"], { tipo: ["Arma", "Tótem"], f: "pagable" }), { op: "fn", f: "jugar" }],
      },
    ],
    fns: {
      conMano,
      sinHab: (e, ctx, u) => !!N.carta(e, u).sinHabilidad,
      pagable: pagable(0, 0),
      jugar: jugarPagando(0, 0),
      puede: hayPagable(["mano"], { tipo: ["Arma", "Tótem"] }, 0, 0),
    },
  },
};
