import * as N from "../nucleo.js";
import { sel, mov, barajar, robar, efecto, coste } from "../formato.js";

const sumaCostes = (e, lista) => (lista ?? []).reduce((s, u) => s + coste(e, u), 0);

const aliadosEnJuego = (e) => [...N.aliadosDe(e, 0), ...N.aliadosDe(e, 1)];

const aliadoAnulado = (e) => e.jugadores.some((p) => (p.jugadas.anuladas?.Aliado ?? 0) > 0);

const tieneRaza = (raza) => (e, ctx) => N.aliadosDe(e, ctx.ctrl).some((a) => (N.carta(e, a).razas ?? []).includes(raza));

function jugarTalismanGratis(e, ctx, api, uid) {
  if (!uid) return;
  const c = N.carta(e, uid);
  if (c.soloPagando) return;
  const j = ctx.ctrl;
  const imp = api.impuestoSinPagar(e, j);
  if (imp > api.disponibles(e, j, c.tipo)) return;
  api.pagarOros(e, j, imp, c.tipo);
  const desde = N.ubicar(e, uid)?.zona ?? null;
  N.sacar(e, uid);
  e.cola.unshift(N.nuevoFrame([...(c.talisman ?? []), { op: "finTalisman", uid }], { ctrl: j, fuente: uid, def: c.id, costeFuente: c.coste ?? 0 }));
  N.disparar(e, "juega", { uid, j, tipo: c.tipo, pagado: false, desde });
}

export const HABILIDADES = {
  "Cadenas de Titán": {
    claves: ["NoAnulable"],
    requiere: "aliadoAnulado",
    talisman: [{ op: "desterrarTope", n: 6, quien: "rival" }, robar(2), { op: "fn", f: "cerrar" }],
    fns: {
      aliadoAnulado,
      cerrar: (e, ctx) => {
        N.agregarEfecto(e, { tipo: "noJugarMas", fin: "turno" }, ctx.ctrl);
        N.agregarEfecto(e, { tipo: "prevenirDano", j: N.rival(ctx.ctrl), fin: "turno" }, ctx.ctrl);
      },
    },
  },
  "Cae la Casa Usher": {
    claves: ["Exhumar"],
    talisman: [
      {
        op: "modo",
        opciones: [
          {
            texto: "Barajar hasta tres cartas de tu Cementerio y Robar dos cartas",
            pasos: [sel(["yo:cementerio"], {}, "c", { n: 3, hasta: true }), mov("barajar", "c"), robar(2)],
          },
          {
            texto: "Hasta tres Aliados no hacen daño este turno",
            pasos: [sel(["todos:aliados"], {}, "a", { n: 3, hasta: true }), efecto("a", { tipo: "sinDano" })],
          },
        ],
      },
    ],
  },
  "Cae la Reina": {
    claves: ["Exhumar"],
    soloPagando: true,
    destierroAlJugar: true,
    talisman: [sel(["todos:cementerio"], {}, "c", { n: 10, hasta: true }), mov("barajar", "c"), robar(3)],
  },
  "Caida del Alba": {
    destierroAlJugar: true,
    talisman: [
      sel(["rival:mano", "rival:castillo", "rival:cementerio"], {}, "n"),
      sel(["rival:mano"], { f: "mismoNombre" }, "d", { hasta: true, quien: "rival" }),
      mov("desterrar", "d"),
      { op: "si", f: "nadaDesterrado", entonces: [sel(["yo:castillo"], {}, "b", { n: 2 }), mov("mano", "b"), barajar()] },
    ],
    activadas: [
      {
        texto: "Desterrarla del Cementerio y pagar un Oro: Desterrar una carta de coste 2 o menos",
        zona: "cementerio",
        oros: 1,
        requiere: { de: ["todos:enJuego"], filtro: { costeMax: 2 }, para: "desterrar" },
        coste: [sel(["fuente"], {}, "yo"), mov("desterrar", "yo")],
        hacer: [sel(["todos:enJuego"], { costeMax: 2 }, "x", { para: "desterrar" }), mov("desterrar")],
      },
    ],
    fns: {
      mismoNombre: (e, ctx, u) => (ctx.vars.n ?? []).some((x) => N.carta(e, x).nombre === N.carta(e, u).nombre),
      nadaDesterrado: (e, ctx) => !(ctx.vars.d ?? []).length,
    },
  },
  "Cambiar de Tamaño": {
    talisman: [
      sel(["todos:aliados"], { f: "ataco" }, "a", { n: 2, hasta: true }),
      { op: "fn", f: "desterrarPorFuerza" },
      { op: "fn", f: "sinCombate" },
      sel(["yo:destierro"], { tipo: "Aliado" }, "d", { n: 2, hasta: true }),
      mov("barajar", "d"),
    ],
    fns: {
      ataco: (e, ctx, u) => e.jugadores.some((p) => p.declarados.includes(u)),
      desterrarPorFuerza: (e, ctx) => {
        const n = (ctx.vars.a ?? []).reduce((s, u) => s + N.fuerza(e, u), 0);
        if (n) N.quitarDelCastillo(e, N.rival(ctx.ctrl), n, "destierro");
      },
      sinCombate: (e, ctx) => N.agregarEfecto(e, { tipo: "prevenirDano", fin: "dosTurnos" }, ctx.ctrl),
    },
  },
  "Camino del Guerrero": {
    requiere: "cuatroAliados",
    talisman: [sel(["yo:aliados"], {}, "a", { n: 99 }), efecto("a", { tipo: "fuerza", n: 1 }, "juego")],
    fns: {
      cuatroAliados: (e, ctx) =>
        N.aliadosDe(e, ctx.ctrl).length + e.jugadores[ctx.ctrl].mano.filter((u) => N.carta(e, u).tipo === "Aliado").length >= 4,
    },
  },
  "Canto de los Serafin": {
    soloRespuesta: true,
    respuesta: {
      anula: {},
      pasos: [
        { op: "fn", f: "ofrecer" },
        {
          op: "modo",
          opciones: [
            { texto: "Robar dos cartas", pasos: [robar(2)] },
            {
              texto: "Desterrar una carta oponente que no sea Oro",
              requiere: { de: ["rival:enJuego"], filtro: { noTipo: ["Oro"] }, para: "desterrar" },
              pasos: [sel(["rival:enJuego"], { noTipo: ["Oro"] }, "d", { para: "desterrar" }), mov("desterrar", "d")],
            },
            { texto: "No recibir daño este turno", pasos: [{ op: "fn", f: "sinDanoRival" }] },
          ],
        },
      ],
    },
    fns: {
      ofrecer: (e, ctx) => {
        const item = e.pila[ctx.objetivoPila];
        if (!item) return [];
        return [{ op: "opcional", texto: "Jugar la carta Anulada bajo tu control", pagar: Math.max(0, (item.coste ?? 0) - 1), pasos: [{ op: "fn", f: "tomar" }] }];
      },
      tomar: (e, ctx, api) => {
        const item = e.pila[ctx.objetivoPila];
        if (!item) return;
        if (N.carta(e, item.uid).tipo === "Arma") {
          const port = N.aliadosDe(e, ctx.ctrl).find((a) => api.armaCabe(e, a, item.uid));
          if (!port) return;
          item.portador = port;
        }
        Object.assign(item, { anulado: false, ctrl: ctx.ctrl, cerrada: true });
      },
      sinDanoRival: (e, ctx) => N.agregarEfecto(e, { tipo: "prevenirDano", j: ctx.ctrl, fin: "turno" }, ctx.ctrl),
    },
  },
  "Capa de Invisibildiad": {
    destierroAlJugar: true,
    claves: ["Indesterrable"],
    talisman: [
      sel(["todos:enJuego"], { costeMax: 2 }, "x"),
      mov("barajar"),
      sel(["yo:aliados"], { costeMin: 1 }, "a", { hasta: true }),
      { op: "fn", f: "otorgar" },
    ],
    disparadas: [{ cuando: ["comienzoVigilia"], quien: "yo", hacer: [{ op: "generar", n: 1 }, robar(1)] }],
    fns: {
      otorgar: (e, ctx) => {
        for (const a of ctx.vars.a ?? []) e.ganadas[a] = [...(e.ganadas[a] ?? []), ctx.def];
      },
    },
  },
  "Captura Colosal": {
    requiere: "ambos",
    talisman: [sel(["yo:aliados"], {}, "a"), sel(["rival:aliados"], {}, "b"), { op: "fn", f: "capturar" }],
    disparadas: [{ cuando: ["faseFinal"], quien: "yo", hacer: [{ op: "desterrarTope", n: 2, quien: "yo" }] }],
    fns: {
      ambos: (e, ctx) => N.aliadosDe(e, ctx.ctrl).length > 0 && N.aliadosDe(e, N.rival(ctx.ctrl)).length > 0,
      capturar: (e, ctx) => {
        const [a] = ctx.vars.a ?? [];
        const [b] = ctx.vars.b ?? [];
        if (!a || !b) return;
        const fa = N.fuerza(e, a);
        const fb = N.fuerza(e, b);
        if (fa === fb) return;
        const u = fa < fb ? a : b;
        e.conv[u] = { tipo: "Aliado", como: ctx.def, sinHabilidad: false };
        N.agregarEfecto(e, { tipo: "noAtacarBloquear", uid: u, fin: "mientras" }, ctx.ctrl);
      },
    },
  },
  "Capturar Cerbero": {
    destierroAlJugar: true,
    talisman: [{ op: "fn", f: "igualar" }],
    fns: {
      igualar: (e, ctx) => {
        const n = e.jugadores[N.rival(ctx.ctrl)].mano.length - e.jugadores[ctx.ctrl].mano.length;
        if (n > 0) N.robar(e, ctx.ctrl, n);
      },
    },
  },
  "Carpa Dragón": {
    reduce: "red",
    talisman: [sel(["todos:aliados"], {}, "x", { n: 99, para: "destruir" }), mov("destruir")],
    fns: { red: (e) => aliadosEnJuego(e).length },
  },
  Catalepsia: {
    requiere: "tresOros",
    talisman: [sel(["yo:castillo"], { tipo: "Oro", f: "sinHab" }, "b", { n: 2 }), mov("pagado", "b"), barajar(), robar(1)],
    fns: {
      tresOros: (e, ctx) => N.orosDe(e, ctx.ctrl).length >= 3,
      sinHab: (e, ctx, u) => !!N.carta(e, u).sinHabilidad,
    },
  },
  "Celebrar la Muerte": {
    requiere: { de: ["todos:enJuego"], filtro: { costeMax: 3 }, para: "desterrar" },
    talisman: [
      sel(["todos:enJuego"], { costeMax: 3 }, "x", { para: "desterrar" }),
      { op: "fn", f: "vetar" },
      mov("desterrar"),
      { op: "fn", f: "marcar" },
    ],
    disparadas: [
      {
        zona: ["cementerio"],
        cuando: ["alCementerio"],
        quien: "propia",
        si: "recienResuelto",
        hacer: [{ op: "fn", f: "desmarcar" }, sel(["fuente"], {}, "yo"), mov("barajar", "yo")],
      },
      {
        zona: ["cementerio"],
        cuando: ["salenDelCastillo"],
        si: "botadaPorDano",
        opcional: true,
        hacer: [sel(["fuente"], {}, "yo"), mov("desterrar", "yo"), sel(["todos:cementerio"], {}, "c", { n: 5, hasta: true }), mov("barajar", "c")],
      },
    ],
    fns: {
      vetar: (e, ctx) => {
        for (const u of ctx.vars.x ?? []) {
          const nombre = N.carta(e, u).nombre;
          for (const j of [0, 1]) N.agregarEfecto(e, { tipo: "noJugarNombre", j, nombre, fin: "proximoTurno" }, ctx.ctrl);
        }
      },
      marcar: (e, ctx) => {
        e.usos[`celebrar|${ctx.fuente}`] = e.turno;
      },
      recienResuelto: (e, ctx) => e.usos[`celebrar|${ctx.fuente}`] === e.turno,
      botadaPorDano: (e, ctx) => ctx.datos.porDano && ctx.datos.zona === "cementerio" && ctx.datos.uids.includes(ctx.fuente),
      desmarcar: (e, ctx) => {
        delete e.usos[`celebrar|${ctx.fuente}`];
      },
    },
  },
  "Chivateo del Mandinga": {
    talisman: [sel(["todos:aliados"], { f: "fuerte" }, "x", { n: 99, para: "destruir" }), { op: "fn", f: "recordar" }, mov("destruir"), { op: "fn", f: "robarPorDestruido" }],
    fns: {
      fuerte: (e, ctx, u) => N.fuerza(e, u) >= 3,
      recordar: (e, ctx) => {
        ctx.vars.r = (ctx.vars.x ?? []).map((u) => [u, N.controlador(e, u)]);
      },
      robarPorDestruido: (e, ctx) => {
        for (const [u, j] of ctx.vars.r ?? []) if (!N.enJuego(e, u)) N.robar(e, j, 1);
      },
    },
  },
  "Choque de Colosos": {
    requiere: { de: ["todos:aliados"], filtro: {} },
    talisman: [
      sel(["todos:aliados"], {}, "a"),
      { op: "robar", nf: "costeElegido", quien: "yo" },
      sel(["rival:enJuego"], { costeMin: 1, f: "cabe" }, "d", { n: 99, hasta: true, para: "destruir" }),
      mov("destruir", "d"),
    ],
    fns: {
      costeElegido: (e, ctx) => sumaCostes(e, ctx.vars.a),
      cabe: (e, ctx, u) => coste(e, u) + sumaCostes(e, ctx.vars.d) <= sumaCostes(e, ctx.vars.a),
    },
  },
  "Cienpies-SP": {
    soloRespuesta: true,
    respuesta: { anula: { costeMax: 3 } },
  },
  "Clamor de los Justos": {
    talisman: [
      {
        op: "modo",
        n: 3,
        hasta: true,
        opciones: [
          { texto: "Caballero: generar un Oro para jugar Armas y/o Caballeros", requiere: "caballero", pasos: [{ op: "generar", n: 1, tipos: ["Arma", "Aliado"], costeMin: 2 }] },
          { texto: "Guerrero: tus Aliados ganan 2 de Fuerza", requiere: "guerrero", pasos: [sel(["yo:aliados"], {}, "a", { n: 99 }), efecto("a", { tipo: "fuerza", n: 2 })] },
          { texto: "Héroe: los Talismanes cuestan un Oro adicional por el turno", requiere: "heroe", pasos: [{ op: "efecto", efecto: { tipo: "impuestoTalisman" }, fin: "turno" }] },
        ],
      },
    ],
    fns: { caballero: tieneRaza("Caballero"), guerrero: tieneRaza("Guerrero"), heroe: tieneRaza("Héroe") },
  },
  "Colaborador Titán": {
    talisman: [{ op: "desterrarTope", nf: "titanes", quien: "rival" }, robar(2)],
    fns: {
      titanes: (e, ctx) => sumaCostes(e, N.aliadosDe(e, ctx.ctrl).filter((u) => /Titán|Ignis/.test(N.carta(e, u).nombre))),
    },
  },
  "Colapso Global": {
    talisman: [robar(1)],
  },
  "Combate Naval de Iquique": {
    claves: ["NoAnulable"],
    talisman: [sel(["todos:enJuego"], { tipo: ["Arma", "Tótem"], f: "cabe" }, "x", { n: 2, hasta: true, para: "desterrar" }), mov("desterrar")],
    activadas: [
      {
        texto: "Desterrarla del Cementerio: un Arma o Tótem pierde su habilidad este turno o durante el próximo turno",
        zona: "cementerio",
        requiere: { de: ["todos:enJuego"], filtro: { tipo: ["Arma", "Tótem"] } },
        coste: [sel(["fuente"], {}, "yo"), mov("desterrar", "yo")],
        hacer: [
          sel(["todos:enJuego"], { tipo: ["Arma", "Tótem"] }),
          {
            op: "modo",
            opciones: [
              { texto: "Este turno", pasos: [efecto("x", { tipo: "pierdeHabilidad" }, "turno")] },
              { texto: "Durante el próximo turno", pasos: [efecto("x", { tipo: "pierdeHabilidad" }, "dosTurnos")] },
            ],
          },
        ],
      },
    ],
    fns: { cabe: (e, ctx, u) => coste(e, u) + sumaCostes(e, ctx.vars.x) <= 4 },
  },
  "Combate de Punta Gruesa": {
    momentos: ["comienzoFase"],
    talisman: [sel(["rival:mano"], { noTipo: ["Oro"] }), mov("cementerio"), { op: "si", f: "barata", entonces: [robar(1)] }],
    fns: { barata: (e, ctx) => (ctx.vars.x ?? []).some((u) => coste(e, u) <= 2) },
  },
  "Comite de Animales": {
    noAnulableCosteMax: 1,
    talisman: [{ op: "fn", f: "convertir" }],
    fns: {
      convertir: (e) => {
        const n = aliadosEnJuego(e).filter((u) => coste(e, u) >= 1).length;
        if (!n) return [];
        return [
          { op: "tope", quien: "yo", n, como: "t" },
          { op: "convertir", var: "t", en: "Aliado", fuerza: 2, a: "defensa" },
          efecto("t", { tipo: "gana", clave: "Furia" }, "mientras"),
        ];
      },
    },
  },
  "Conan Doyle": {
    claves: ["NoAnulable"],
    momentos: ["comienzoVigilia", "talismanes", "faseFinal"],
    talisman: [sel(["yo:mano", "yo:cementerio"], { tipo: "Aliado", costeMax: 2 }, "b", { hasta: true }), { op: "jugarGratis", var: "b" }],
  },
  "Concilio de los Eternos": {
    requiere: "cuatroTipos",
    talisman: [{ op: "fn", f: "limitarAtaque" }],
    fns: {
      limitarAtaque: (e, ctx) => N.agregarEfecto(e, { tipo: "maxAtacantes", j: N.rival(ctx.ctrl), n: 2, fin: "turno" }, ctx.ctrl),
      cuatroTipos: (e, ctx) => {
        const cartas = [...N.enJuegoDe(e, ctx.ctrl), ...e.jugadores[ctx.ctrl].mano.filter((u) => u !== ctx.fuente)];
        return new Set(cartas.map((u) => N.carta(e, u).tipo)).size >= 4;
      },
    },
  },
  "Conocimiento Prohibido": {
    claves: ["Exhumar"],
    talisman: [
      sel(["yo:castillo"], { tipo: "Talismán", costeMax: 3 }, "a"),
      sel(["rival:castillo"], { tipo: "Talismán" }, "b"),
      barajar(),
      barajar("rival"),
      {
        op: "modo",
        opciones: [
          { texto: "Jugar el tuyo y Desterrar el del oponente", requiere: { de: ["var:a"], filtro: {} }, pasos: [{ op: "fn", f: "jugarA" }, mov("desterrar", "b")] },
          { texto: "Jugar el del oponente y Desterrar el tuyo", requiere: { de: ["var:b"], filtro: {} }, pasos: [{ op: "fn", f: "jugarB" }, mov("desterrar", "a")] },
        ],
      },
    ],
    fns: {
      jugarA: (e, ctx, api) => jugarTalismanGratis(e, ctx, api, (ctx.vars.a ?? [])[0]),
      jugarB: (e, ctx, api) => jugarTalismanGratis(e, ctx, api, (ctx.vars.b ?? [])[0]),
    },
  },
};
