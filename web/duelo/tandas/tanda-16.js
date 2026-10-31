import * as N from "../nucleo.js";
import { sel, mov, barajar, robar, efecto, buscar, coste } from "../formato.js";

const razasDe = (e, u) => N.carta(e, u).razas ?? [];

const tieneRaza = (raza) => (e, ctx) => N.aliadosDe(e, ctx.ctrl).some((a) => razasDe(e, a).includes(raza));

const nombreIncluye = (e, u, ...partes) => partes.some((p) => N.carta(e, u).nombre.includes(p));

const enCementerioODestierro = (nombre) => (e, ctx) => {
  const p = e.jugadores[ctx.ctrl];
  return [...p.cementerio, ...p.destierro].some((u) => N.carta(e, u).nombre === nombre);
};

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

const orosLibres = (e, j) => e.jugadores[j].reserva.length + (e.jugadores[j].generados ?? []).reduce((s, g) => s + g.n, 0);

const costeRebajado = (e, uid, rebaja, minimo) => {
  const impreso = coste(e, uid);
  return Math.max(Math.min(impreso, minimo), impreso - rebaja);
};

const pagableDesde = (rebaja, minimo) => (e, ctx, u) => {
  if (costeRebajado(e, u, rebaja, minimo) > orosLibres(e, ctx.ctrl)) return false;
  if (N.carta(e, u).tipo === "Arma") return N.aliadosDe(e, ctx.ctrl).length > 0;
  return true;
};

function entrarPagando(e, ctx, api, uid, pagar, portador) {
  const c = N.carta(e, uid);
  const j = ctx.ctrl;
  if (pagar > api.disponibles(e, j, c.tipo)) return;
  const desde = N.ubicar(e, uid)?.zona ?? null;
  api.pagarOros(e, j, pagar, c.tipo);
  N.disparar(e, "juega", { uid, j, tipo: c.tipo, pagado: true, desde });
  api.entrarEnJuego(e, uid, j, portador, { pagado: true, desde });
}

function jugarRebajado(e, ctx, api, rebaja, minimo) {
  const uid = (ctx.vars.a ?? [])[0];
  if (!uid) return;
  if (N.carta(e, uid).tipo === "Arma") {
    ctx.vars.rebaja = rebaja;
    ctx.vars.minimo = minimo;
    return [sel(["yo:aliados"], { armaLibre: uid }, "_port"), { op: "fn", f: "portarRebajado" }];
  }
  entrarPagando(e, ctx, api, uid, costeRebajado(e, uid, rebaja, minimo));
}

const portarRebajado = (e, ctx, api) => {
  const uid = (ctx.vars.a ?? [])[0];
  const [port] = ctx.vars._port ?? [];
  if (!uid || !port) return;
  entrarPagando(e, ctx, api, uid, costeRebajado(e, uid, ctx.vars.rebaja ?? 0, ctx.vars.minimo ?? 0), port);
};

const unoOAmbos = (condicion, opciones) => (e, ctx) => {
  if (N.def(e, ctx.def).fns[condicion](e, ctx)) return opciones.flatMap((o) => o.pasos);
  return [{ op: "modo", opciones }];
};

const vaciarHabilidad = (e, u, extra = {}) => {
  delete e.ganadas[u];
  e.conv[u] = { ...(e.conv[u] ?? {}), tipo: N.carta(e, u).tipo, sinHabilidad: true, como: undefined, ...extra };
};

const jugadasDe = (p) => Object.entries(p.jugadas).filter(([t]) => !["total", "nombres", "anuladas"].includes(t)).reduce((s, [, n]) => s + n, 0);

const enSuVigilia = (e, ctx) => e.fase === "vigilia" && e.activo === ctx.ctrl;

const remateOpciones = [
  { texto: "Tus Aliados ganan 1 de Fuerza y los oponentes pierden 1, permanentemente", pasos: [{ op: "fn", f: "fortalecer" }] },
  {
    texto: "Jugar una carta de tu Cementerio reduciendo su coste en un Oro, mínimo 1",
    pasos: [sel(["yo:cementerio"], { tipo: ["Aliado", "Arma", "Tótem"], f: "pagable" }, "a", { hasta: true }), { op: "fn", f: "jugar" }],
  },
];

const pontchartrainOpciones = [
  {
    texto: "Convertir una carta oponente en una del mismo tipo sin habilidad y Robar una carta",
    pasos: [sel(["rival:enJuego"], {}, "c"), { op: "fn", f: "vaciar" }, robar(1)],
  },
  {
    texto: "Si tu oponente no recibió daño este turno, Bota cinco cartas y esta carta vuelve a tu mano",
    pasos: [{ op: "si", f: "sinDano", entonces: [{ op: "botar", n: 5, quien: "rival" }, { op: "fn", f: "marcar" }] }],
  },
];

const saltarOpciones = [
  {
    texto: "Buscar tres cartas de distinto nombre en el Castillo oponente y Desterrarlas",
    pasos: [sel(["rival:castillo"], { f: "distinto" }, "b", { n: 3, hasta: true }), mov("desterrar", "b"), barajar("rival")],
  },
  { texto: "Robar dos cartas", pasos: [robar(2)] },
];

const saurial = [
  sel(["yo:oros"], {}, "d", { n: 2, hasta: true }),
  { op: "convertir", var: "d", en: "Aliado", fuerza: 4, a: "defensa", hasta: true, vuelve: "reserva" },
  efecto("d", { tipo: "gana", clave: "Imbloqueable" }),
  efecto("d", { tipo: "noSale" }),
];

const semilla = (e, ctx) => {
  const r = N.rival(ctx.ctrl);
  const c = e.jugadores[r].castillo;
  const i = c.findIndex((u) => N.carta(e, u).tipo === "Oro");
  const n = i < 0 ? c.length : i + 1;
  if (n) N.quitarDelCastillo(e, r, n, "cementerio");
};

export const HABILIDADES = {
  "Remate Mortal": {
    noAnulableSi: "descanso",
    talisman: [{ op: "fn", f: "elegir" }],
    fns: {
      elegir: unoOAmbos("descanso", remateOpciones),
      descanso: enCementerioODestierro("Descanso Solar"),
      fortalecer: (e, ctx) => {
        for (const a of N.aliadosDe(e, ctx.ctrl)) N.agregarEfecto(e, { tipo: "fuerza", uid: a, n: 1, fin: "juego" }, ctx.ctrl);
        for (const a of N.aliadosDe(e, N.rival(ctx.ctrl))) N.agregarEfecto(e, { tipo: "fuerza", uid: a, n: -1, fin: "juego" }, ctx.ctrl);
      },
      pagable: pagableDesde(1, 1),
      jugar: (e, ctx, api) => jugarRebajado(e, ctx, api, 1, 1),
      portarRebajado,
    },
  },
  "Renace la Fe": {
    requiere: { de: ["rival:aliados"], filtro: {} },
    talisman: [sel(["rival:aliados"]), mov("mano"), sel(["yo:cementerio"], {}, "c", { hasta: true }), mov("mano", "c")],
    activadas: [desdeCementerio("Pagar un Oro y Desterrarlo de tu Cementerio: tu oponente Bota cuatro cartas", [{ op: "botar", n: 4, quien: "rival" }], { oros: 1 })],
  },
  Resistir: {
    talisman: [{ op: "fn", f: "activar" }, sel(["yo:castillo", "yo:cementerio"], { tipo: "Arma", f: "pagable" }, "a"), barajar(), { op: "fn", f: "jugar" }],
    continuas: [{ zona: "cementerio", talismanesAlDestierro: true, si: "vigente" }],
    fns: {
      activar: (e, ctx) => {
        N.agregarEfecto(e, { tipo: "resistir", uid: ctx.fuente, fin: "proximoTurno" }, ctx.ctrl);
      },
      vigente: (e, ctx) => e.efectos.some((f) => f.tipo === "resistir" && f.uid === ctx.fuente),
      pagable: pagableDesde(1, 0),
      jugar: (e, ctx, api) => jugarRebajado(e, ctx, api, 1, 0),
      portarRebajado,
    },
  },
  "Revivir Campeon": {
    talisman: [
      { op: "fn", f: "aCero" },
      ...buscar(["yo:castillo"], { tipo: "Talismán", f: "otro" }),
      sel(["yo:cementerio"], { tipo: "Aliado" }, "c", { hasta: true }),
      mov("mano", "c"),
    ],
    fns: {
      aCero: (e, ctx) => {
        for (const j of [0, 1]) {
          for (const a of N.aliadosDe(e, j)) {
            if (coste(e, a) <= 2) N.agregarEfecto(e, { tipo: "fuerza", uid: a, n: -N.fuerza(e, a) }, ctx.ctrl);
          }
        }
      },
      otro: (e, ctx, u) => N.carta(e, u).nombre !== "Revivir Campeon",
    },
  },
  "Rey del Disfraz": {
    momentos: ["faseFinal"],
    orosMenos: "gratis",
    talisman: [
      {
        op: "modo",
        opciones: [
          {
            texto: "Desterrar una carta de coste 3 o más",
            requiere: { de: ["todos:enJuego"], filtro: { costeMin: 3 }, para: "desterrar" },
            pasos: [sel(["todos:enJuego"], { costeMin: 3 }, "x", { para: "desterrar" }), mov("desterrar")],
          },
          {
            texto: "Destruir todas las cartas de coste 0",
            pasos: [sel(["todos:enJuego"], { costeMax: 0, noTipo: ["Oro"] }, "x", { n: 99, para: "destruir" }), mov("destruir")],
          },
        ],
      },
    ],
    disparadas: [{ zona: ["mano"], cuando: ["juega"], quien: "rival", si: "aliadoGratis", hacer: [{ op: "fn", f: "marcar" }] }],
    fns: {
      aliadoGratis: (e, ctx) => ctx.datos.tipo === "Aliado" && (ctx.datos.pagado === false || coste(e, ctx.datos.uid) === 0),
      marcar: (e, ctx) => {
        e.usos[`reyDisfraz|${ctx.ctrl}`] = e.turno;
      },
      gratis: (e, ctx) => (e.usos[`reyDisfraz|${ctx.ctrl}`] === e.turno ? 99 : 0),
    },
  },
  "Rito de Pontchartrain": {
    talisman: [{ op: "fn", f: "elegir" }],
    disparadas: [
      {
        zona: ["cementerio"],
        cuando: ["alCementerio"],
        quien: "propia",
        si: "resuelta",
        hacer: [{ op: "fn", f: "desmarcar" }, sel(["fuente"], {}, "yo"), mov("mano", "yo")],
      },
    ],
    fns: {
      elegir: unoOAmbos("pocoCastillo", pontchartrainOpciones),
      pocoCastillo: (e, ctx) => e.jugadores[N.rival(ctx.ctrl)].castillo.length < 20,
      vaciar: (e, ctx) => {
        for (const u of ctx.vars.c ?? []) vaciarHabilidad(e, u);
      },
      sinDano: (e, ctx) => !(e.activo === ctx.ctrl && e.registro.some((r) => r.turno === e.turno && r.dano > 0)),
      marcar: marca("pontchartrain"),
      resuelta: marcada("pontchartrain"),
      desmarcar: (e, ctx) => {
        delete e.usos[`pontchartrain|${ctx.fuente}`];
      },
    },
  },
  "Rito del Bandido": {
    reduce: "bandidos",
    talisman: [
      { op: "efecto", efecto: { tipo: "impuesto", tipoCarta: "Talismán", n: 1 }, jugador: "rival", fin: "turno" },
      { op: "efecto", efecto: { tipo: "impuestoHabilidad", de: "disparada", n: 1 }, jugador: "rival", fin: "turno" },
    ],
    activadas: [
      desdeCementerio(
        "Desterrarlo de tu Cementerio y pagar un Oro: Barajar un Aliado de coste 2 o menos",
        [sel(["todos:aliados"], { costeMax: 2 }, "b"), mov("barajar", "b")],
        { oros: 1, requiere: { de: ["todos:aliados"], filtro: { costeMax: 2 } } },
      ),
    ],
    fns: { bandidos: (e, ctx) => N.aliadosDe(e, ctx.ctrl).filter((u) => nombreIncluye(e, u, "Bandido")).length },
  },
  "Ritual Oscuro": {
    claves: ["Exhumar"],
    talisman: [
      {
        op: "modo",
        n: 2,
        hasta: true,
        opciones: [
          {
            texto: "Barajar y/o Desterrar hasta cuatro cartas de los Cementerios",
            pasos: [
              sel(["todos:cementerio"], {}, "c", { n: 4, hasta: true }),
              mov("barajar", "c"),
              sel(["todos:cementerio"], {}, "d", { nf: "resto", hasta: true }),
              mov("desterrar", "d"),
            ],
          },
          {
            texto: "Barajar una carta de coste 2 o menos",
            requiere: { de: ["todos:enJuego"], filtro: { costeMax: 2 } },
            pasos: [sel(["todos:enJuego"], { costeMax: 2 }, "b"), mov("barajar", "b")],
          },
          { texto: "Robar una carta", pasos: [robar(1)] },
        ],
      },
    ],
    fns: { resto: (e, ctx) => 4 - (ctx.vars.c ?? []).length },
  },
  "Ritual Vudú": {
    orosMenos: "jugadasRival",
    talisman: [{ op: "fn", f: "vetar" }, robar(1), sel(["yo:cementerio"], { tipo: "Aliado" }, "c", { hasta: true }), mov("mano", "c"), { op: "fn", f: "pendiente" }],
    disparadas: [
      { zona: ["cementerio"], cuando: ["comienzoTurno"], quien: "yo", si: "hayPendiente", hacer: [{ op: "fn", f: "cumplir" }, { op: "generar", n: 1 }, robar(2)] },
    ],
    fns: {
      jugadasRival: (e, ctx) => (enSuVigilia(e, ctx) ? jugadasDe(e.jugadores[N.rival(ctx.ctrl)]) : 0),
      vetar: (e, ctx) => {
        if (enSuVigilia(e, ctx)) N.agregarEfecto(e, { tipo: "noJugarNombre", j: ctx.ctrl, nombre: "Ritual Vudú" }, ctx.ctrl);
      },
      pendiente: (e, ctx) => {
        N.agregarEfecto(e, { tipo: "vuduPendiente", uid: ctx.fuente, fin: "juego" }, ctx.ctrl);
      },
      hayPendiente: (e, ctx) => e.efectos.some((f) => f.tipo === "vuduPendiente" && f.uid === ctx.fuente),
      cumplir: (e, ctx) => {
        e.efectos = e.efectos.filter((f) => !(f.tipo === "vuduPendiente" && f.uid === ctx.fuente));
      },
    },
  },
  "Ritual de Sombras": {
    talisman: [
      sel(["todos:cementerio"], {}, "c", { n: 2, hasta: true }),
      mov("barajar", "c"),
      sel(["todos:cementerio"], {}, "d", { nf: "resto", hasta: true }),
      mov("desterrar", "d"),
      robar(1),
    ],
    disparadas: [
      {
        zona: ["cementerio"],
        cuando: ["comienzoVigilia"],
        quien: "yo",
        hacer: [{ op: "opcional", texto: "Pagar un Oro: subir Ritual de Sombras a tu mano", pagar: 1, pasos: [sel(["fuente"], {}, "yo"), mov("mano", "yo")] }],
      },
    ],
    fns: { resto: (e, ctx) => 2 - (ctx.vars.c ?? []).length },
  },
  "Rugido de Titán": {
    reduce: "titanes",
    talisman: [sel(["yo:enJuego"], { f: "titan" }, "p", { hasta: true }), efecto("p", { tipo: "proteccion", por: "todo" })],
    fns: {
      titan: (e, ctx, u) => nombreIncluye(e, u, "Titán", "Ignis"),
      titanes: (e, ctx) => {
        const enJuego = N.aliadosDe(e, ctx.ctrl).filter((u) => nombreIncluye(e, u, "Titán", "Ignis")).length;
        const enMano = e.jugadores[ctx.ctrl].mano.filter((u) => N.carta(e, u).tipo === "Aliado" && nombreIncluye(e, u, "Titán", "Ignis")).length;
        return enJuego + enMano;
      },
    },
  },
  "Rugido del Origen": {
    talisman: [
      {
        op: "modo",
        n: 3,
        hasta: true,
        opciones: [
          { texto: "Bestia: tus Aliados ganan 1 de Fuerza", requiere: "bestia", pasos: [sel(["yo:aliados"], {}, "a", { n: 99 }), efecto("a", { tipo: "fuerza", n: 1 })] },
          {
            texto: "Dragón: poner una carta de tu Cementerio en tu Oro Pagado como un Oro sin habilidad",
            requiere: "dragonConCementerio",
            pasos: [sel(["yo:cementerio"], {}, "o"), { op: "convertir", var: "o", en: "Oro", a: "pagado" }],
          },
          { texto: "Sombra: tu oponente Destierra cuatro cartas del tope de su Castillo", requiere: "sombra", pasos: [{ op: "desterrarTope", n: 4, quien: "rival" }] },
        ],
      },
    ],
    fns: {
      bestia: tieneRaza("Bestia"),
      dragonConCementerio: (e, ctx) => tieneRaza("Dragón")(e, ctx) && e.jugadores[ctx.ctrl].cementerio.length > 0,
      sombra: tieneRaza("Sombra"),
    },
  },
  "Ruptura del Límite": {
    destierroAlJugar: true,
    talisman: [
      { op: "botar", n: 4, quien: "rival" },
      {
        op: "opcional",
        texto: "Desterrar dos Aliados tuyos de coste 1 o más: repetir el efecto y Robar dos cartas",
        requiere: "dosAliados",
        pasos: [sel(["yo:aliados"], { costeMin: 1 }, "d", { n: 2, para: "desterrar" }), mov("desterrar", "d"), { op: "botar", n: 4, quien: "rival" }, robar(2)],
      },
    ],
    fns: {
      dosAliados: (e, ctx) => N.aliadosDe(e, ctx.ctrl).filter((u) => coste(e, u) >= 1 && !N.tiene(e, u, "Indesterrable") && N.puedeSalir(e, u)).length >= 2,
    },
  },
  "Sabiduria de la Oruga": {
    destierroAlJugar: true,
    talisman: [sel(["rival:mano"], { costeMax: 2 }, "x", { n: 2, hasta: true }), mov("desterrar"), { op: "fn", f: "unAtacante" }],
    fns: {
      unAtacante: (e, ctx) => {
        e.efectos.push({ tipo: "maxAtacantes", n: 1, fin: { finTurno: e.turno + (e.activo === ctx.ctrl ? 2 : 1) } });
      },
    },
  },
  "Sacrificio Solar": {
    claves: ["UnaCopia"],
    soloRespuesta: true,
    respuesta: { anula: { costeMax: 0 } },
    activadas: [
      {
        texto: "Pagar un Oro y Barajarla desde tu mano: Desterrar o Barajar una carta de coste 2 o menos y Robar una carta",
        zona: "mano",
        oros: 1,
        coste: [sel(["fuente"], {}, "yo"), mov("barajar", "yo")],
        hacer: [
          {
            op: "modo",
            opciones: [
              {
                texto: "Desterrar una carta de coste 2 o menos",
                requiere: { de: ["todos:enJuego"], filtro: { costeMax: 2 }, para: "desterrar" },
                pasos: [sel(["todos:enJuego"], { costeMax: 2 }, "x", { para: "desterrar" }), mov("desterrar")],
              },
              {
                texto: "Barajar una carta de coste 2 o menos",
                requiere: { de: ["todos:enJuego"], filtro: { costeMax: 2 } },
                pasos: [sel(["todos:enJuego"], { costeMax: 2 }), mov("barajar")],
              },
            ],
          },
          robar(1),
        ],
      },
    ],
  },
  "Saltar la Defensa": {
    noAnulableSi: "arena",
    talisman: [{ op: "fn", f: "elegir" }],
    fns: {
      elegir: unoOAmbos("arena", saltarOpciones),
      arena: enCementerioODestierro("Castillo de Arena"),
      distinto: distintoNombre("b"),
    },
  },
  "Santo Santo Santo": {
    soloPagando: true,
    talisman: [
      sel(["rival:mano"], {}, "d", { n: 3, azar: true }),
      mov("cementerio", "d"),
      sel(["var:d"], { zona: "cementerio", f: "recuperable" }, "r", { n: 3, hasta: true, quien: "rival" }),
      { op: "fn", f: "recuperar" },
    ],
    fns: {
      recuperable: (e, ctx) => e.jugadores[N.rival(ctx.ctrl)].castillo.length >= 4 * ((ctx.vars.r ?? []).length + 1),
      recuperar: (e, ctx) => {
        const r = N.rival(ctx.ctrl);
        for (const u of ctx.vars.r ?? []) {
          if (N.quitarDelCastillo(e, r, 4, "destierro") < 4) break;
          N.mover(e, u, "mano");
          N.robar(e, ctx.ctrl, 1);
        }
      },
    },
  },
  Saurial: {
    talisman: saurial,
    activadas: [
      {
        texto: "Desterrar un Oro de tu Cementerio: jugarlo desde tu Cementerio pagando un Oro menos y Desterrarlo",
        zona: "cementerio",
        oros: 1,
        requiere: { de: ["yo:cementerio"], filtro: { tipo: "Oro" } },
        coste: [sel(["yo:cementerio"], { tipo: "Oro" }, "o"), mov("desterrar", "o")],
        hacer: [...saurial, sel(["fuente"], {}, "yo"), mov("desterrar", "yo")],
      },
    ],
  },
  "Seducción": {
    destierroAlJugar: true,
    talisman: [
      {
        op: "modo",
        opciones: [
          {
            texto: "Cada jugador Roba hasta tres cartas; por cada una que Robe tu oponente, Destierra dos del tope de su Castillo",
            pasos: [
              { op: "robarHasta", n: 3 },
              { op: "tope", quien: "rival", n: 3, como: "t" },
              sel(["var:t"], {}, "r", { n: 3, hasta: true, quien: "rival" }),
              { op: "fn", f: "robaRival" },
            ],
          },
          {
            texto: "Cada jugador pone un Oro de su mano en su Oro Pagado; el oponente sin habilidad",
            pasos: [
              sel(["yo:mano"], { tipo: "Oro" }, "o"),
              { op: "ponerOro", var: "o", a: "pagado" },
              sel(["rival:mano"], { tipo: "Oro" }, "p", { quien: "rival" }),
              { op: "fn", f: "oroRival" },
            ],
          },
        ],
      },
    ],
    fns: {
      robaRival: (e, ctx) => {
        const r = N.rival(ctx.ctrl);
        const antes = e.jugadores[r].mano.length;
        N.robar(e, r, (ctx.vars.r ?? []).length);
        const k = e.jugadores[r].mano.length - antes;
        if (k) N.quitarDelCastillo(e, r, 2 * k, "destierro");
      },
      oroRival: (e, ctx, api) => {
        const r = N.rival(ctx.ctrl);
        for (const u of ctx.vars.p ?? []) {
          N.agregarEfecto(e, { tipo: "pierdeHabilidad", uid: u }, ctx.ctrl);
          api.entrarOro(e, u, r, "pagado");
        }
      },
    },
  },
  "Segundo Sello": {
    talisman: [
      ...buscar(["yo:castillo"], { f: "sello" }),
      sel(["todos:aliados"], {}, "a", { n: 2, hasta: true }),
      efecto("a", { tipo: "fuerza", n: 2 }),
      efecto("a", { tipo: "gana", clave: "DanoAlDestierro" }),
    ],
    fns: { sello: (e, ctx, u) => nombreIncluye(e, u, "Sello") },
  },
  "Semilla de Destruccion": {
    destierroAlJugar: true,
    talisman: [{ op: "fn", f: "semilla" }, { op: "opcional", texto: "Pagar un Oro: repetir el efecto", pagar: 1, pasos: [{ op: "fn", f: "semilla" }] }],
    fns: { semilla },
  },
  "Sentir Energia": {
    talisman: [
      sel(["yo:enJuego"], {}, "p", { hasta: true }),
      efecto("p", { tipo: "proteccion", por: "todo" }),
      sel(["yo:cementerio"], {}, "c", { hasta: true }),
      mov("barajar", "c"),
      robar(1),
    ],
    activadas: [
      {
        texto: "Barajarlo desde tu Cementerio: una carta recupera su habilidad",
        zona: "cementerio",
        requiere: "haySilenciada",
        coste: [sel(["fuente"], {}, "yo"), mov("barajar", "yo")],
        hacer: [sel(["todos:enJuego"], { f: "silenciada" }, "s"), { op: "fn", f: "restaurar" }],
      },
    ],
    fns: {
      silenciada: (e, ctx, u) => e.efectos.some((f) => f.tipo === "pierdeHabilidad" && f.uid === u),
      haySilenciada: (e) => e.efectos.some((f) => f.tipo === "pierdeHabilidad" && f.uid && N.enJuego(e, f.uid)),
      restaurar: (e, ctx) => {
        const s = ctx.vars.s ?? [];
        e.efectos = e.efectos.filter((f) => !(f.tipo === "pierdeHabilidad" && s.includes(f.uid)));
      },
    },
  },
  "Septimo Sello": {
    claves: ["NoAnulable"],
    talisman: [
      sel(["rival:oros"], {}, "o"),
      sel(["rival:enJuego"], { noTipo: ["Oro"], f: "otroCoste" }, "c", { n: 99, hasta: true }),
      { op: "fn", f: "convertir" },
      sel(["yo:enJuego"], {}, "p"),
      efecto("p", { tipo: "gana", clave: "Indestructible" }),
      efecto("p", { tipo: "gana", clave: "Indesterrable" }),
      {
        op: "modo",
        opciones: [
          { texto: "Robar dos cartas", pasos: [robar(2)] },
          { texto: "Tu oponente Bota una carta por cada Sello en tu Cementerio, hasta siete", pasos: [{ op: "botar", nf: "sellos", quien: "rival" }] },
        ],
      },
    ],
    fns: {
      otroCoste: (e, ctx, u) => !(ctx.vars.c ?? []).some((x) => coste(e, x) === coste(e, u)),
      convertir: (e, ctx) => {
        for (const u of [...(ctx.vars.o ?? []), ...(ctx.vars.c ?? [])]) vaciarHabilidad(e, u, { fuerza: 0 });
      },
      sellos: (e, ctx) => Math.min(7, e.jugadores[ctx.ctrl].cementerio.filter((u) => nombreIncluye(e, u, "Sello")).length),
    },
  },
  Serafurgia: {
    requiere: { de: ["yo:oros"], filtro: {}, para: "desterrar" },
    talisman: [
      sel(["yo:oros"], {}, "o", { para: "desterrar" }),
      mov("desterrar", "o"),
      {
        op: "si",
        f: "desterrado",
        entonces: [sel(["rival:enJuego"], { costeMax: 3 }, "x", { para: "tomar" }), { op: "convertir", var: "x", en: "Oro", a: "pagado" }],
      },
    ],
    activadas: [
      desdeCementerio("Desterrarlo de tu Cementerio: una carta pierde su habilidad por el turno", [sel(["todos:enJuego"]), efecto("x", { tipo: "pierdeHabilidad" })], {
        requiere: { de: ["todos:enJuego"], filtro: {} },
      }),
    ],
    fns: { desterrado: (e, ctx) => (ctx.vars.o ?? []).some((u) => N.ubicar(e, u)?.zona === "destierro") },
  },
  "Sesión Espiritista": {
    destierroAlJugar: true,
    talisman: [{ op: "fn", f: "activar" }],
    disparadas: [
      {
        zona: ["destierro"],
        cuando: ["roba"],
        quien: "rival",
        si: "vigente",
        hacer: [{ op: "opcional", texto: "Poner la misma cantidad de cartas del tope de tu Castillo en tu mano", pasos: [{ op: "fn", f: "copiar" }] }],
      },
    ],
    fns: {
      activar: (e, ctx) => {
        N.agregarEfecto(e, { tipo: "sesionEspiritista", uid: ctx.fuente, fin: "proximoTurno" }, ctx.ctrl);
      },
      vigente: (e, ctx) => e.efectos.some((f) => f.tipo === "sesionEspiritista" && f.uid === ctx.fuente),
      copiar: (e, ctx) => {
        N.robar(e, ctx.ctrl, ctx.datos.n);
      },
    },
  },
};
