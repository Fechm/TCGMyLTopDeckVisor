import * as N from "../nucleo.js";
import { sel, mov, barajar, robar, efecto, buscar, castilloElegido, coste } from "../formato.js";
import { disponibles, armaCabe } from "../efectos.js";

const sumaCostes = (e, lista) => (lista ?? []).reduce((s, u) => s + coste(e, u), 0);

const aliadosEnJuego = (e) => [...N.aliadosDe(e, 0), ...N.aliadosDe(e, 1)];

const desterrarFuente = [sel(["fuente"], {}, "yo"), mov("desterrar", "yo")];
const descartarFuente = [sel(["fuente"], {}, "yo"), mov("cementerio", "yo")];

const pasarAMano = (e, uids, j) => {
  for (const u of uids) {
    N.sacar(e, u);
    e.jugadores[j].mano.push(u);
  }
};

const contar = (e, j, c) => {
  const p = e.jugadores[j];
  p.jugadas[c.tipo] = (p.jugadas[c.tipo] ?? 0) + 1;
  p.jugadas.nombres[c.nombre] = (p.jugadas.nombres[c.nombre] ?? 0) + 1;
  if (["Aliado", "Arma", "Tótem"].includes(c.tipo)) p.jugadas.total += 1;
};

const jugarPagando = (e, ctx, api, uid, n, desde) => {
  const j = ctx.ctrl;
  const c = N.carta(e, uid);
  if (n > disponibles(e, j, c.tipo)) return [];
  api.pagarOros(e, j, n, c.tipo);
  contar(e, j, c);
  N.disparar(e, "juega", { uid, j, tipo: c.tipo, pagado: true, desde });
  const datos = { pagado: true, desde };
  if (c.tipo === "Arma") return [{ op: "sel", de: ["yo:aliados"], filtro: { armaLibre: uid }, como: "_port" }, { op: "portar", arma: uid, en: "_port", datos }];
  return [{ op: "entrar", uid, datos }];
};

const aTotems = (quien) => [sel([`${quien}:cementerio`], {}, "c", { n: 2, hasta: true }), { op: "fn", f: "totems" }];

export const HABILIDADES = {
  "Contactar Ancestros": {
    talisman: [sel(["todos:aliados"]), efecto("x", { tipo: "noSale" }), efecto("x", { tipo: "noCambia" })],
    activadas: [
      {
        texto: "Convertir este Talismán de tu mano en un Oro sin habilidad en tu Reserva y Robar una carta",
        zona: "mano",
        momento: "vigilia",
        requiere: "sinOroPuesto",
        hacer: [sel(["fuente"], {}, "yo"), { op: "convertir", var: "yo", en: "Oro", a: "reserva" }, robar(1)],
      },
    ],
    fns: {
      sinOroPuesto: (e, ctx) => {
        const p = e.jugadores[ctx.ctrl];
        return p.orosPuestos === 0 && !p.oroJugado;
      },
    },
  },
  "Contacto con Friendship": {
    requiere: { de: ["rival:armas"], filtro: {}, para: "tomar" },
    talisman: [
      sel(["rival:armas"], {}, "a", { para: "tomar" }),
      sel(["yo:aliados"], { f: "porta" }, "p"),
      { op: "fn", f: "tomar" },
      { op: "si", f: "esDueno", entonces: [{ op: "generar", n: 1 }] },
    ],
    fns: {
      porta: (e, ctx, u) => (ctx.vars.a ?? []).some((a) => armaCabe(e, u, a)),
      tomar: (e, ctx) => {
        const [a] = ctx.vars.a ?? [];
        const [p] = ctx.vars.p ?? [];
        if (!a || !p) return;
        N.sacar(e, a);
        (e.armas[p] ??= []).push(a);
      },
      esDueno: (e, ctx) => (ctx.vars.a ?? []).some((a) => N.dueno(a) === ctx.ctrl && N.controlador(e, a) === ctx.ctrl),
    },
  },
  Corromper: {
    requiere: "tresEnMano",
    talisman: [
      sel(["rival:mano"], {}, "a"),
      { op: "fn", f: "aMiMano" },
      sel(["yo:mano"], { f: "noTomada" }, "b", { quien: "rival" }),
      { op: "fn", f: "aSuMano" },
    ],
    fns: {
      tresEnMano: (e, ctx) => e.jugadores[ctx.ctrl].mano.filter((u) => u !== ctx.fuente).length >= 3,
      aMiMano: (e, ctx) => pasarAMano(e, ctx.vars.a ?? [], ctx.ctrl),
      noTomada: (e, ctx, u) => !(ctx.vars.a ?? []).includes(u),
      aSuMano: (e, ctx) => pasarAMano(e, ctx.vars.b ?? [], N.rival(ctx.ctrl)),
    },
  },
  "Cortar las Cadenas": {
    claves: ["Exhumar", "NoAnulable"],
    talisman: [{ op: "botar", n: 5, quien: "rival" }],
    activadas: [
      {
        texto: "Desde tu Destierro, pagar un Oro y Barajarlo en tu Castillo: Robar dos cartas o buscar un Tenshi",
        zona: "destierro",
        oros: 1,
        coste: [sel(["fuente"], {}, "yo"), mov("barajar", "yo")],
        hacer: [
          {
            op: "modo",
            opciones: [
              { texto: "Robar dos cartas", pasos: [robar(2)] },
              { texto: "Buscar en tu Castillo un Tenshi", pasos: buscar(["yo:castillo"], { f: "tenshi" }) },
            ],
          },
        ],
      },
    ],
    fns: { tenshi: (e, ctx, u) => /\bTenshi\b/.test(N.carta(e, u).nombre) || (N.carta(e, u).razas ?? []).includes("Tenshi") },
  },
  "Corte Letal": {
    talisman: [sel(["rival:cementerio"]), mov("desterrar"), { op: "fn", f: "copias" }, robar(2)],
    fns: {
      copias: (e, ctx) => {
        const nombres = (ctx.vars.x ?? []).map((u) => N.carta(e, u).nombre);
        if (!nombres.length) return;
        const r = N.rival(ctx.ctrl);
        const p = e.jugadores[r];
        for (const z of ["castillo", "cementerio", "mano"]) {
          for (const u of [...p[z]]) if (nombres.includes(N.carta(e, u).nombre)) N.mover(e, u, "destierro");
        }
        N.barajarCastillo(e, r);
      },
    },
  },
  "Cruzar el Bosque": {
    destierroAlJugar: true,
    talisman: [
      {
        op: "modo",
        opciones: [
          {
            texto: "Subir una carta oponente de coste 2 o menos a la mano",
            requiere: { de: ["rival:enJuego"], filtro: { costeMax: 2 } },
            pasos: [sel(["rival:enJuego"], { costeMax: 2 }), mov("mano")],
          },
          {
            texto: "Destruir hasta dos cartas de coste 1 o menos",
            pasos: [sel(["todos:enJuego"], { costeMax: 1 }, "d", { n: 2, hasta: true, para: "destruir" }), mov("destruir", "d")],
          },
        ],
      },
      robar(2),
    ],
  },
  "Cruzar la Cordillera": {
    momentos: ["comienzoVigilia", "comienzoVigiliaRival"],
    destierroAlJugar: true,
    talisman: [robar(1)],
  },
  "Cuarto Sello": {
    momentos: ["comienzoFase"],
    talisman: [
      ...buscar(["yo:castillo"], { f: "sello" }),
      sel(["todos:enJuego"], { costeMax: 4 }, "d", { hasta: true, para: "destruir" }),
      mov("destruir", "d"),
      robar(2),
    ],
    activadas: [
      {
        texto: "Pagar un Oro y Descartarlo: un Aliado pierde su habilidad y 4 de Fuerza por el turno",
        zona: "mano",
        oros: 1,
        requiere: { de: ["todos:aliados"], filtro: {} },
        coste: descartarFuente,
        hacer: [sel(["todos:aliados"]), efecto("x", { tipo: "pierdeHabilidad" }), efecto("x", { tipo: "fuerza", n: -4 })],
      },
    ],
    fns: { sello: (e, ctx, u) => /\bSello\b/.test(N.carta(e, u).nombre) },
  },
  "Culto a la Muerte": {
    requiere: { de: ["todos:enJuego"], filtro: { conHabilidad: true } },
    talisman: [sel(["todos:enJuego"], { conHabilidad: true }), { op: "fn", f: "cancelar" }],
    respuesta: { anula: { tipo: ["Talismán", "Arma", "Tótem"], costeMax: 2 }, pasos: [{ op: "fn", f: "desterrarAnulada" }] },
    fns: {
      cancelar: (e, ctx) => {
        for (const u of ctx.vars.x ?? []) N.agregarEfecto(e, { tipo: "pierdeHabilidad", nombre: N.carta(e, u).nombre }, ctx.ctrl);
      },
      desterrarAnulada: (e, ctx) => {
        const item = e.pila[ctx.objetivoPila];
        if (item) item.destierro = true;
      },
    },
  },
  "Danza Celestial": {
    destierroAlJugar: true,
    talisman: [
      {
        op: "modo",
        opciones: [
          {
            texto: "Barajar hasta cuatro cartas de tu Cementerio y Robar tres",
            pasos: [sel(["yo:cementerio"], {}, "c", { n: 4, hasta: true }), mov("barajar", "c"), robar(3)],
          },
          {
            texto: "Desterrar una carta sin habilidad de la que seas dueño y jugarla reduciendo su coste en un Oro",
            requiere: { de: ["yo:mano", "todos:enJuego"], filtro: { f: "sinHabPropia" } },
            pasos: [sel(["yo:mano", "todos:enJuego"], { f: "sinHabPropia" }, "x", { para: "desterrar" }), mov("desterrar"), { op: "fn", f: "jugarla" }],
          },
        ],
      },
    ],
    fns: {
      sinHabPropia: (e, ctx, u) => u !== ctx.fuente && N.dueno(u) === ctx.ctrl && !!N.carta(e, u).sinHabilidad,
      jugarla: (e, ctx, api) => {
        const [u] = ctx.vars.x ?? [];
        if (!u || N.ubicar(e, u)?.zona !== "destierro") return;
        return jugarPagando(e, ctx, api, u, Math.max(0, coste(e, u) - 1), "destierro");
      },
    },
  },
  "Danza de Dragones": {
    requiere: "cincoOros",
    talisman: [sel(["yo:cementerio"], { tipo: ["Aliado", "Oro"] }, "x", { hasta: true }), mov("mano")],
    fns: {
      cincoOros: (e, ctx) =>
        N.orosDe(e, ctx.ctrl).length + e.jugadores[ctx.ctrl].mano.filter((u) => N.carta(e, u).tipo === "Oro").length >= 5,
    },
  },
  "Danza del Cuchillo": {
    talisman: [sel(["rival:aliados"], { costeMax: 3 }, "x", { para: "destruir" }), mov("destruir"), ...buscar(["yo:castillo"], { tipo: "Oro" })],
    activadas: [
      {
        texto: "Desterrarlo de tu Cementerio y pagar un Oro: Robar dos cartas",
        zona: "cementerio",
        oros: 1,
        coste: desterrarFuente,
        hacer: [robar(2)],
      },
    ],
  },
  "De Rodillas": {
    claves: ["NoAnulable"],
    talisman: [
      sel(["rival:aliados"], {}, "a", { n: 2, hasta: true }),
      efecto("a", { tipo: "pierdeHabilidad" }),
      efecto("a", { tipo: "fuerza", n: -99 }),
    ],
  },
  Depredar: {
    claves: ["NoAnulable"],
    orosMenos: "porAliado",
    talisman: [
      sel(["todos:aliados"], { f: "cabe" }, "a", { n: 3, hasta: true }),
      efecto("a", { tipo: "pierdeHabilidad" }),
      efecto("a", { tipo: "fuerza", n: -99 }),
      efecto("a", { tipo: "gana", clave: "Indestructible" }),
    ],
    fns: {
      porAliado: (e) => aliadosEnJuego(e).length,
      cabe: (e, ctx, u) => coste(e, u) + sumaCostes(e, ctx.vars.a) <= 3,
    },
  },
  "Desafiar la Autoridad": {
    destierroAlJugar: true,
    talisman: [
      robar(2),
      sel(["yo:aliados"], { conHabilidad: true }, "a"),
      { op: "fn", f: "recordar" },
      mov("barajar", "a"),
      sel(["rival:castillo"], { tipo: "Aliado", f: "igual" }, "b"),
      { op: "jugarGratis", var: "b" },
      barajar("rival"),
    ],
    fns: {
      recordar: (e, ctx) => {
        ctx.vars.ref = (ctx.vars.a ?? []).map((u) => [coste(e, u), N.carta(e, u).nombre]);
      },
      igual: (e, ctx, u) => (ctx.vars.ref ?? []).some(([c, n]) => coste(e, u) === c && N.carta(e, u).nombre !== n),
    },
  },
  "Desafio de Humpty Dumpty": {
    destierroAlJugar: true,
    talisman: [
      sel(["rival:mano"], { tipo: "Aliado", costeMax: 2 }, "c"),
      {
        op: "modo",
        opciones: [
          { texto: "Convertir la primera carta de tu Castillo en una copia y ponerla en juego", requiere: "eligio", pasos: [{ op: "fn", f: "copiar" }] },
          { texto: "Generar un Oro por el turno", pasos: [{ op: "generar", n: 1 }] },
        ],
      },
    ],
    fns: {
      eligio: (e, ctx) => (ctx.vars.c ?? []).length > 0,
      copiar: (e, ctx) => {
        const [c] = ctx.vars.c ?? [];
        if (!c) return;
        const k = N.carta(e, c);
        return [
          { op: "tope", quien: "yo", n: 1, como: "t" },
          { op: "convertir", var: "t", en: "Aliado", fuerza: k.fuerza, coste: k.coste, como: e.instancias[c], a: "defensa" },
          { op: "fn", f: "entra" },
        ];
      },
      entra: (e, ctx) => {
        for (const t of ctx.vars.t ?? []) if (N.enJuego(e, t)) N.disparar(e, "entra", { uid: t, j: ctx.ctrl, pagado: false, desde: "castillo" });
      },
    },
  },
  "Desafio del Ingenio": {
    talisman: [
      sel(["todos:cementerio"], {}, "c", { n: 3, hasta: true }),
      mov("barajar", "c"),
      ...buscar(["yo:castillo"], { tipo: "Aliado" }),
      robar(2),
    ],
    activadas: [
      {
        texto: "Pagar un Oro y Desterrarlo de tu Cementerio: Desterrar las primeras tres cartas del Castillo oponente",
        zona: "cementerio",
        oros: 1,
        coste: desterrarFuente,
        hacer: [{ op: "desterrarTope", n: 3, quien: "rival" }],
      },
    ],
  },
  "Descubrir Disfraz": {
    destierroAlJugar: true,
    requiere: { de: ["todos:aliados"], filtro: {} },
    talisman: [
      sel(["todos:aliados"], {}, "a"),
      castilloElegido((quien) => [sel([`${quien}:castillo`], { tipo: "Aliado", f: "copia" }, "b"), { op: "fn", f: "jugarCopia" }, barajar(quien)]),
    ],
    activadas: [{ texto: "Descartarlo para Robar una carta", zona: "mano", coste: descartarFuente, hacer: [robar(1)] }],
    fns: {
      copia: (e, ctx, u) => (ctx.vars.a ?? []).some((a) => N.carta(e, a).nombre === N.carta(e, u).nombre),
      jugarCopia: (e, ctx, api) => {
        const [u] = ctx.vars.b ?? [];
        if (!u) return;
        return jugarPagando(e, ctx, api, u, Math.max(0, coste(e, u) - 2), "castillo");
      },
    },
  },
  "Desembarco Orco": {
    claves: ["NoAnulable"],
    talisman: [{ op: "fn", f: "devolver" }],
    fns: {
      devolver: (e) => {
        const ajena = (u) => N.enJuego(e, u) && N.carta(e, u).tipo !== "Oro" && N.controlador(e, u) !== N.dueno(u);
        for (const u of N.todoEnJuego(e).filter(ajena)) if (ajena(u)) N.mover(e, u, "mano");
      },
    },
  },
  "Despertar de Behemot": {
    claves: ["Exhumar", "NoAnulable"],
    talisman: [
      {
        op: "modo",
        opciones: [
          {
            texto: "Barajar una carta oponente de coste 3 o más",
            requiere: { de: ["rival:enJuego"], filtro: { costeMin: 3 } },
            pasos: [sel(["rival:enJuego"], { costeMin: 3 }), mov("barajar")],
          },
          { texto: "Buscar en tu Castillo una carta de coste 3 o más", pasos: buscar(["yo:castillo"], { costeMin: 3 }) },
        ],
      },
      { op: "efecto", jugador: "yo", efecto: { tipo: "noJugarMas" } },
      { op: "efecto", jugador: "yo", efecto: { tipo: "maxHabilidades", n: 0 } },
    ],
  },
  "Destruccion Urbana": {
    claves: ["Exhumar"],
    talisman: [
      {
        op: "modo",
        opciones: [
          { texto: "Tu Cementerio", pasos: aTotems("yo") },
          { texto: "Cementerio oponente", pasos: aTotems("rival") },
        ],
      },
    ],
    activadas: [
      {
        texto: "Destruir este Tótem: no recibir daño este turno, Robar dos cartas o Barajar una carta de coste 2 o menos",
        requiere: "enJuego",
        coste: [sel(["fuente"], {}, "yo"), mov("destruir", "yo")],
        hacer: [
          {
            op: "modo",
            opciones: [
              { texto: "No recibir daño este turno", pasos: [{ op: "efecto", jugador: "yo", efecto: { tipo: "prevenirDano" } }] },
              { texto: "Robar dos cartas", pasos: [robar(2)] },
              {
                texto: "Barajar una carta de coste 2 o menos",
                requiere: { de: ["todos:enJuego"], filtro: { costeMax: 2 } },
                pasos: [sel(["todos:enJuego"], { costeMax: 2 }, "b"), mov("barajar", "b")],
              },
            ],
          },
        ],
      },
    ],
    fns: {
      totems: (e, ctx) => [{ op: "convertir", var: "c", en: "Tótem", a: "apoyo", como: ctx.def }],
      enJuego: (e, ctx) => N.enJuego(e, ctx.fuente),
    },
  },
  "Destruir Refugio": {
    claves: ["Exhumar"],
    destierroAlJugar: true,
    talisman: [
      sel(["todos:enJuego"], { tipo: "Tótem", costeMax: 2 }, "x", { n: 99, para: "destruir" }),
      efecto("x", { tipo: "pierdeHabilidad" }, "mientras"),
      mov("destruir"),
    ],
  },
  "Dolor de Rocinante": {
    talisman: [sel(["todos:enJuego"], { costeMax: 2 }), { op: "fn", f: "totem" }, robar(2)],
    disparadas: [{ zona: ["cementerio"], cuando: ["faseFinal"], quien: "rival", hacer: [{ op: "desterrarTope", nf: "sinHab", quien: "rival" }] }],
    fns: {
      totem: (e, ctx) => {
        for (const u of ctx.vars.x ?? []) {
          if (!N.enJuego(e, u)) continue;
          const j = N.controlador(e, u);
          for (const a of e.armas[u] ?? []) N.mover(e, a, "cementerio");
          delete e.armas[u];
          delete e.ganadas[u];
          N.mover(e, u, "apoyo", { j });
          for (const p of e.jugadores) p.nuevos = p.nuevos.filter((x) => x !== u);
          e.conv[u] = { tipo: "Tótem", sinHabilidad: true };
        }
      },
      sinHab: (e, ctx) => N.enJuegoDe(e, N.rival(ctx.ctrl)).filter((u) => N.carta(e, u).sinHabilidad).length,
    },
  },
  "Dos de Cada Uno": {
    talisman: [
      sel(["yo:castillo"], { noTipo: ["Talismán"], f: "conCopia" }, "a"),
      sel(["yo:castillo"], { noTipo: ["Talismán"], f: "mismoNombre" }, "b"),
      mov("mano", "a"),
      mov("mano", "b"),
      barajar(),
    ],
    fns: {
      conCopia: (e, ctx, u) => e.jugadores[ctx.ctrl].castillo.some((x) => x !== u && N.carta(e, x).nombre === N.carta(e, u).nombre),
      mismoNombre: (e, ctx, u) => (ctx.vars.a ?? []).some((a) => a !== u && N.carta(e, a).nombre === N.carta(e, u).nombre),
    },
  },
  "Duelo Espacial": {
    claves: ["IndesterrableCementerio"],
    talisman: [
      sel(["todos:castillo", "todos:cementerio"], { noFuente: true }),
      { op: "convertir", var: "x", en: "Oro", a: "pagado" },
      barajar(),
      barajar("rival"),
    ],
    activadas: [{ texto: "En tu Vigilia, desde el Cementerio: Robar una carta", zona: "cementerio", momento: "vigilia", veces: "turnoNombre", hacer: [robar(1)] }],
  },
};
