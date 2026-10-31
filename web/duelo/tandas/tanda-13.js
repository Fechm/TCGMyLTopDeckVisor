import * as N from "../nucleo.js";
import { sel, mov, barajar, robar, efecto, buscar, castilloElegido, coste } from "../formato.js";

const razasDe = (e, u) => N.carta(e, u).razas ?? [];

const tieneRaza = (raza) => (e, ctx) => N.aliadosDe(e, ctx.ctrl).some((a) => razasDe(e, a).includes(raza));

const barajarCementerios = (n) => [sel(["todos:cementerio"], {}, "c", { n, hasta: true }), mov("barajar", "c")];

const desdeCementerio = (texto, pasos, extra = {}) => ({
  texto,
  zona: "cementerio",
  coste: [sel(["fuente"], {}, "yo"), mov("desterrar", "yo")],
  hacer: pasos,
  ...extra,
});

const distintoNombre = (como) => (e, ctx, u) => !(ctx.vars[como] ?? []).some((x) => N.carta(e, x).nombre === N.carta(e, u).nombre);

const marca = (nombre) => (e, ctx) => {
  e.usos[`${nombre}|${ctx.fuente}`] = e.turno;
};

const marcada = (nombre) => (e, ctx) => e.usos[`${nombre}|${ctx.fuente}`] === e.turno;

const desmarcar = (e, nombre, uid) => {
  delete e.usos[`${nombre}|${uid}`];
};

const orosLibres = (e, j) => e.jugadores[j].reserva.length + (e.jugadores[j].generados ?? []).reduce((s, g) => s + g.n, 0);

const costeRebajado = (e, uid, rebaja) => {
  const impreso = coste(e, uid);
  return rebaja ? Math.max(Math.min(impreso, 1), impreso - rebaja) : impreso;
};

const rebajaLuz = (e, u) => (razasDe(e, u).includes("Tenshi") ? 2 : 1);

function jugarPagando(e, ctx, api, uid, rebaja) {
  if (!uid) return;
  const c = N.carta(e, uid);
  const j = ctx.ctrl;
  const pagar = costeRebajado(e, uid, rebaja);
  if (pagar > api.disponibles(e, j, c.tipo)) return;
  const desde = N.ubicar(e, uid)?.zona ?? null;
  api.pagarOros(e, j, pagar, c.tipo);
  N.disparar(e, "juega", { uid, j, tipo: c.tipo, pagado: true, desde });
  api.entrarEnJuego(e, uid, j, undefined, { pagado: true, desde });
}

function convertirEnTotem(e, uid, j, conv) {
  for (const a of e.armas[uid] ?? []) N.mover(e, a, "cementerio");
  delete e.armas[uid];
  delete e.ganadas[uid];
  if (N.ubicar(e, uid)?.zona !== "apoyo") N.mover(e, uid, "apoyo", { j });
  for (const p of e.jugadores) p.nuevos = p.nuevos.filter((x) => x !== uid);
  e.conv[uid] = { tipo: "Tótem", ...conv };
}

const RAZAS_LUZ = ["Bestia", "Dragón", "Faerie", "Sombra"];

export const HABILIDADES = {
  "Juicio de Vigilantes": {
    talisman: [
      sel(["todos:enJuego"], { noTipo: ["Oro"] }, "x", { hasta: true }),
      mov("barajar"),
      ...buscar(["yo:castillo"], {}),
      sel(["yo:aliados"], {}, "a", { n: 99 }),
      efecto("a", { tipo: "fuerza", n: 2 }, "juego"),
    ],
  },
  "Julio Verne": {
    claves: ["NoAnulable"],
    talisman: [sel(["yo:aliados"], {}, "x", { n: 99, hasta: true }), mov("mano"), { op: "fn", f: "guardar" }],
    disparadas: [{ zona: ["cementerio"], cuando: ["comienzoTurno"], quien: "yo", si: "pendiente", hacer: [{ op: "fn", f: "devolver" }] }],
    fns: {
      guardar: (e, ctx) => {
        const cartas = (ctx.vars.x ?? []).filter((u) => e.jugadores[ctx.ctrl].mano.includes(u));
        if (cartas.length) N.agregarEfecto(e, { tipo: "jugarAlComienzo", uid: ctx.fuente, cartas, fin: "juego" }, ctx.ctrl);
      },
      pendiente: (e, ctx) => e.efectos.some((f) => f.tipo === "jugarAlComienzo" && f.uid === ctx.fuente),
      devolver: (e, ctx) => {
        const f = e.efectos.find((x) => x.tipo === "jugarAlComienzo" && x.uid === ctx.fuente);
        e.efectos = e.efectos.filter((x) => x !== f);
        ctx.vars.v = f.cartas.filter((u) => e.jugadores[ctx.ctrl].mano.includes(u));
        return [{ op: "jugarGratis", var: "v" }, { op: "fn", f: "fortalecer" }];
      },
      fortalecer: (e, ctx) => {
        for (const u of ctx.vars.v ?? []) if (N.enJuego(e, u)) N.agregarEfecto(e, { tipo: "fuerza", uid: u, n: 1, fin: "juego" }, ctx.ctrl);
      },
    },
  },
  "Jurado Descontento": {
    respuesta: { anula: { tipo: "Tótem", costeMax: 3 } },
    talisman: [
      {
        op: "modo",
        opciones: [
          { texto: "Cada jugador Baraja los Aliados y Tótems ajenos que controle y Destierra dos del tope por cada uno", pasos: [{ op: "fn", f: "barajarAjenas" }] },
          {
            texto: "Desterrar un Tótem de coste 3 o menos",
            requiere: { de: ["todos:apoyo"], filtro: { tipo: "Tótem", costeMax: 3 }, para: "desterrar" },
            pasos: [sel(["todos:apoyo"], { tipo: "Tótem", costeMax: 3 }, "t", { para: "desterrar" }), mov("desterrar", "t")],
          },
        ],
      },
    ],
    fns: {
      barajarAjenas: (e, ctx) => {
        for (const j of [ctx.ctrl, N.rival(ctx.ctrl)]) {
          const ajenas = [...N.aliadosDe(e, j), ...e.jugadores[j].apoyo].filter(
            (u) => N.dueno(u) !== j && ["Aliado", "Tótem"].includes(N.carta(e, u).tipo) && N.puedeSalir(e, u),
          );
          for (const u of ajenas) {
            N.mover(e, u, "castillo");
            N.barajarCastillo(e, N.dueno(u));
          }
          if (ajenas.length) N.quitarDelCastillo(e, j, 2 * ajenas.length, "destierro");
        }
      },
    },
  },
  Juramento: {
    talisman: [sel(["todos:cementerio"], { tipo: "Aliado", costeMax: 2, f: "pagable" }, "a"), { op: "fn", f: "jugar" }],
    activadas: [
      desdeCementerio(
        "Desterrarlo y pagar un Oro: buscar hasta dos cartas de distinto nombre en el Castillo oponente y Desterrarlas",
        [sel(["rival:castillo"], { f: "distinto" }, "b", { n: 2, hasta: true }), mov("desterrar", "b"), barajar("rival")],
        { oros: 1 },
      ),
    ],
    fns: {
      pagable: (e, ctx, u) => coste(e, u) <= orosLibres(e, ctx.ctrl),
      jugar: (e, ctx, api) => jugarPagando(e, ctx, api, (ctx.vars.a ?? [])[0], 0),
      distinto: distintoNombre("b"),
    },
  },
  "Kaiju de Luz": {
    talisman: [
      sel(["yo:mano"], {}, "x", { n: 99, hasta: true }),
      { op: "fn", f: "cambiar" },
      sel(["yo:mano"], {}, "m", { n: 99, hasta: true }),
      { op: "botar", nf: "tipos", quien: "rival" },
    ],
    fns: {
      cambiar: (e, ctx) => {
        const k = (ctx.vars.x ?? []).length;
        for (const u of ctx.vars.x ?? []) N.mover(e, u, "castillo");
        if (k) N.barajarCastillo(e, ctx.ctrl);
        N.robar(e, ctx.ctrl, k + 1);
      },
      tipos: (e, ctx) => new Set((ctx.vars.m ?? []).map((u) => N.carta(e, u).tipo)).size,
    },
  },
  "La Hora del Diablo": {
    destierroAlJugar: true,
    talisman: [
      sel(["yo:castillo"], {}, "a", { n: 2 }),
      mov("cementerio", "a"),
      sel(["rival:castillo"], {}, "b", { n: 2 }),
      mov("cementerio", "b"),
      barajar(),
      barajar("rival"),
      robar(1),
      {
        op: "opcional",
        texto: "Pagar tres Oros y Barajar tres copias de tu Destierro: Desterrar hasta tres cartas oponentes de distinto tipo",
        pagar: 3,
        requiere: "tresCopias",
        pasos: [{ op: "fn", f: "barajarCopias" }, sel(["rival:enJuego"], { f: "otroTipo" }, "d", { n: 3, hasta: true, para: "desterrar" }), mov("desterrar", "d")],
      },
    ],
    fns: {
      tresCopias: (e, ctx) => e.jugadores[ctx.ctrl].destierro.filter((u) => N.carta(e, u).nombre === "La Hora del Diablo").length >= 3,
      barajarCopias: (e, ctx) => {
        const copias = e.jugadores[ctx.ctrl].destierro.filter((u) => N.carta(e, u).nombre === "La Hora del Diablo").slice(0, 3);
        for (const u of copias) N.mover(e, u, "castillo");
        N.barajarCastillo(e, ctx.ctrl);
      },
      otroTipo: (e, ctx, u) => !(ctx.vars.d ?? []).some((x) => N.carta(e, x).tipo === N.carta(e, u).tipo),
    },
  },
  "La Ira de Dios": {
    talisman: [sel(["rival:mano"], {}, "x", { quien: "rival" }), mov("desterrar"), { op: "fn", f: "marcar" }],
    disparadas: [
      {
        zona: ["cementerio"],
        cuando: ["alCementerio"],
        quien: "propia",
        si: "resuelta",
        hacer: [{ op: "fn", f: "desmarcar" }, sel(["fuente"], {}, "yo"), mov("barajar", "yo")],
      },
    ],
    fns: {
      marcar: marca("ira"),
      resuelta: marcada("ira"),
      desmarcar: (e, ctx) => desmarcar(e, "ira", ctx.fuente),
    },
  },
  "La Sentencia de los Dioses": {
    talisman: [],
  },
  "Legion Celestial": {
    talisman: [
      {
        op: "modo",
        n: 3,
        hasta: true,
        opciones: [
          { texto: "Eterno: generar un Oro para jugar Tótem", requiere: "eterno", pasos: [{ op: "generar", n: 1, tipos: ["Tótem"] }] },
          { texto: "Faerie: hasta dos Aliados pierden 3 de Fuerza", requiere: "faerie", pasos: [sel(["todos:aliados"], {}, "f", { n: 2, hasta: true }), efecto("f", { tipo: "fuerza", n: -3 })] },
          {
            texto: "Sacerdote: Barajar y/o Desterrar hasta seis cartas de los Cementerios",
            requiere: "sacerdote",
            pasos: [...barajarCementerios(6), sel(["todos:cementerio"], {}, "d", { nf: "resto", hasta: true }), mov("desterrar", "d")],
          },
        ],
      },
    ],
    fns: {
      eterno: tieneRaza("Eterno"),
      faerie: tieneRaza("Faerie"),
      sacerdote: tieneRaza("Sacerdote"),
      resto: (e, ctx) => 6 - (ctx.vars.c ?? []).length,
    },
  },
  "Legion Demoniaca": {
    talisman: [
      {
        op: "modo",
        n: 3,
        hasta: true,
        opciones: [
          { texto: "Bestia: tus Aliados ganan Furia e Indestructible por el turno", requiere: "bestia", pasos: [{ op: "fn", f: "furiaIndestructible" }] },
          { texto: "Dragón: generar un Oro para jugar Aliados", requiere: "dragon", pasos: [{ op: "generar", n: 1, tipos: ["Aliado"] }] },
          {
            texto: "Sombra: buscar tres cartas de distinto nombre en el Castillo oponente y Desterrarlas",
            requiere: "sombra",
            pasos: [sel(["rival:castillo"], { f: "distinto" }, "b", { n: 3, hasta: true }), mov("desterrar", "b"), barajar("rival")],
          },
        ],
      },
    ],
    fns: {
      bestia: tieneRaza("Bestia"),
      dragon: tieneRaza("Dragón"),
      sombra: tieneRaza("Sombra"),
      distinto: distintoNombre("b"),
      furiaIndestructible: (e, ctx) => {
        N.agregarEfecto(e, { tipo: "gana", clave: "Furia", aliadosDe: ctx.ctrl }, ctx.ctrl);
        N.agregarEfecto(e, { tipo: "gana", clave: "Indestructible", aliadosDe: ctx.ctrl }, ctx.ctrl);
      },
    },
  },
  "Levantar Zombie": {
    destierroAlJugar: true,
    talisman: [],
    activadas: [desdeCementerio("Desterrarlo de tu Cementerio: Barajar hasta tres cartas de los Cementerios", barajarCementerios(3))],
  },
  "Libro de Enoc": {
    talisman: [robar(1)],
    disparadas: [{ cuando: ["entra"], hacer: [robar(1)] }],
    continuas: [
      { zona: "pagado", fuerza: 1, a: "tusAliados" },
      { zona: "pagado", gana: "Indestructible", a: "tusAliados" },
    ],
  },
  "Linaje Maldito": {
    talisman: [{ op: "fn", f: "dado" }],
    fns: {
      dado: (e) => {
        const d = Math.floor(N.azar(e) * 6) + 1;
        if (d % 2 === 0) return [{ op: "fn", f: "sinCombate" }, { op: "desterrarTope", n: 4, quien: "rival" }];
        return [sel(["todos:aliados"], {}, "a", { n: 2, hasta: true }), efecto("a", { tipo: "fuerza", n: 2 }), efecto("a", { tipo: "gana", clave: "Furia" })];
      },
      sinCombate: (e, ctx) => {
        for (const a of N.aliadosDe(e, N.rival(ctx.ctrl))) N.agregarEfecto(e, { tipo: "sinDano", uid: a, fin: "proximoTurno" }, ctx.ctrl);
      },
    },
  },
  "Locura de Renfield": {
    talisman: [
      castilloElegido((quien) => [
        { op: "tope", quien, n: 3, como: "m" },
        {
          op: "modo",
          opciones: [
            { texto: "A la mano de su dueño", pasos: [mov("mano", "m")] },
            { texto: "Al Destierro de su dueño", pasos: [mov("desterrar", "m")] },
          ],
        },
      ]),
    ],
    activadas: [
      desdeCementerio("Pagar un Oro y Desterrarlo de tu Cementerio: Barajar un Oro oponente", [sel(["rival:oros"], {}, "o"), mov("barajar", "o")], {
        oros: 1,
        requiere: "masDeUnOro",
      }),
    ],
    fns: {
      masDeUnOro: (e, ctx) => e.jugadores[N.rival(ctx.ctrl)].orosPuestos > 1 && N.orosDe(e, N.rival(ctx.ctrl)).length > 0,
    },
  },
  "Los Descarnados": {
    requiere: { de: ["rival:aliados"], filtro: { costeMax: 3 } },
    talisman: [sel(["rival:aliados"], { costeMax: 3 }), mov("mano")],
    activadas: [
      {
        texto: "Ponerla al fondo de tu Castillo: Robar una carta",
        zona: "mano",
        coste: [sel(["fuente"], {}, "yo"), mov("fondo", "yo")],
        hacer: [robar(1)],
      },
    ],
  },
  "Los Olvidados": {
    requiere: { de: ["rival:enJuego"], filtro: { costeMax: 2 } },
    talisman: [sel(["rival:enJuego"], { costeMax: 2 }), { op: "fn", f: "convertir" }, { op: "fn", f: "marcar" }],
    disparadas: [
      { cuando: ["comienzoVigilia"], quien: "yo", hacer: [robar(1, "rival")] },
      { zona: ["cementerio"], cuando: ["alCementerio"], quien: "propia", si: "resuelta", hacer: [{ op: "fn", f: "aTotem" }] },
    ],
    fns: {
      convertir: (e, ctx) => {
        for (const u of ctx.vars.x ?? []) convertirEnTotem(e, u, N.controlador(e, u), { como: ctx.def });
      },
      marcar: marca("olvidados"),
      resuelta: marcada("olvidados"),
      aTotem: (e, ctx) => {
        desmarcar(e, "olvidados", ctx.fuente);
        convertirEnTotem(e, ctx.fuente, ctx.ctrl, { sinHabilidad: true });
      },
    },
  },
  "Los Pincheira": {
    claves: ["NoAnulable"],
    requiere: { de: ["todos:aliados"], filtro: { f: "debil" }, para: "desterrar" },
    talisman: [
      sel(["todos:aliados"], { f: "debil" }, "x", { para: "desterrar" }),
      { op: "fn", f: "recordar" },
      mov("desterrar"),
      { op: "robar", nf: "costeDesterrada", quien: "yo" },
    ],
    fns: {
      debil: (e, ctx, u) => coste(e, u) <= 1 || N.fuerza(e, u) <= 2,
      recordar: (e, ctx) => {
        ctx.vars.n = (ctx.vars.x ?? []).reduce((s, u) => s + coste(e, u), 0);
      },
      costeDesterrada: (e, ctx) => ((ctx.vars.x ?? []).some((u) => N.ubicar(e, u)?.zona === "destierro") ? ctx.vars.n ?? 0 : 0),
    },
  },
  Lucerna: {
    talisman: [{ op: "si", f: "sinOros", entonces: buscar(["yo:castillo"], { tipo: "Oro" }, "reserva") }],
    fns: { sinOros: (e, ctx) => !e.jugadores[ctx.ctrl].mano.some((u) => N.carta(e, u).tipo === "Oro") },
  },
  "Lucha Celestial": {
    claves: ["Indesterrable"],
    talisman: [sel(["yo:enJuego"], {}, "x", { n: 2, hasta: true }), { op: "fn", f: "convertir" }],
    activadas: [
      {
        texto: "Barajar una carta de tu Cementerio por cada Tótem que controles y tu oponente Bota una carta",
        veces: "turno",
        hacer: [sel(["yo:cementerio"], {}, "c", { nf: "totems" }), mov("barajar", "c"), { op: "botar", n: 1, quien: "rival" }],
      },
    ],
    fns: {
      convertir: (e, ctx) => {
        for (const u of ctx.vars.x ?? []) convertirEnTotem(e, u, ctx.ctrl, { como: ctx.def });
      },
      totems: (e, ctx) => e.jugadores[ctx.ctrl].apoyo.filter((u) => N.carta(e, u).tipo === "Tótem").length,
    },
  },
  "Lucha de Saurios": {
    claves: ["Exhumar"],
    destierroAlJugar: true,
    talisman: [
      {
        op: "opcional",
        texto: "Buscar un Dinosaurio y Barajar una carta oponente de coste 2 o menos",
        pasos: [...buscar(["yo:castillo"], { f: "dinosaurio" }), sel(["rival:enJuego"], { costeMax: 2 }, "r"), mov("barajar", "r")],
      },
    ],
    fns: { dinosaurio: (e, ctx, u) => razasDe(e, u).includes("Dinosaurio") },
  },
  Lujuria: {
    talisman: [sel(["yo:castillo"], { tipo: "Aliado" }, "b", { n: 2 }), mov("mano", "b"), barajar()],
    activadas: [desdeCementerio("Desterrarlo de tu Cementerio: Barajar hasta tres cartas de los Cementerios", barajarCementerios(3))],
  },
  "Luz Desafiante": {
    talisman: [
      sel(["yo:cementerio"], { tipo: "Aliado", f: "pagable" }, "a"),
      { op: "fn", f: "jugar" },
      sel(["todos:aliados"], { f: "cabe" }, "d", { n: 99, hasta: true, para: "desterrar" }),
      mov("desterrar", "d"),
    ],
    fns: {
      pagable: (e, ctx, u) => costeRebajado(e, u, rebajaLuz(e, u)) <= orosLibres(e, ctx.ctrl),
      jugar: (e, ctx, api) => {
        const u = (ctx.vars.a ?? [])[0];
        if (u) jugarPagando(e, ctx, api, u, rebajaLuz(e, u));
      },
      cabe: (e, ctx, u) =>
        razasDe(e, u).some((r) => RAZAS_LUZ.includes(r)) && coste(e, u) + (ctx.vars.d ?? []).reduce((s, x) => s + coste(e, x), 0) <= 3,
    },
  },
  "Magia de Serpientes": {
    claves: ["Exhumar"],
    talisman: [sel(["todos:aliados"], { costeMax: 2 }), { op: "fn", f: "vaciar" }, castilloElegido((quien) => [{ op: "desterrarTope", n: 2, quien }])],
    fns: {
      vaciar: (e, ctx) => {
        for (const u of ctx.vars.x ?? []) {
          delete e.ganadas[u];
          e.conv[u] = { tipo: "Aliado", fuerza: 0, sinHabilidad: true };
        }
      },
    },
  },
  "Mala Flecha": {
    destierroAlJugar: true,
    respuesta: { anula: { costeMax: 1 } },
    talisman: [sel(["rival:mano"], { costeMax: 1 }), mov("cementerio")],
  },
  "Maldicion en la Tormenta": {
    requiere: "otraEnMano",
    talisman: [sel(["yo:mano"]), mov("barajar")],
    fns: { otraEnMano: (e, ctx) => e.jugadores[ctx.ctrl].mano.filter((u) => u !== ctx.fuente).length > 0 },
  },
};
