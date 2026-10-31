import * as N from "../nucleo.js";
import { sel, mov, barajar, robar, efecto, buscar, coste } from "../formato.js";
import { armaCabe, disponibles } from "../efectos.js";

const esHeroe = (e, u) => (N.carta(e, u).razas ?? []).includes("Héroe");
const esCarrera = (e, u) => N.carta(e, u).nombre.includes("Carrera");
const rebajado = (e, u) => Math.max(Math.min(coste(e, u), 1), coste(e, u) - 1);
const hayAliados = { de: ["todos:aliados"], filtro: {} };

let doblando = false;
const doble = (e, ctx) => {
  if (doblando || e.fase !== "danando" || Object.values(e.bloqueos).includes(ctx.objetivo)) return 0;
  doblando = true;
  try {
    return N.fuerza(e, ctx.objetivo);
  } finally {
    doblando = false;
  }
};

function jugarRebajado(e, ctx, api, uid) {
  const j = ctx.ctrl;
  const c = N.carta(e, uid);
  const desde = N.ubicar(e, uid)?.zona ?? null;
  api.pagarOros(e, j, rebajado(e, uid), c.tipo);
  const jug = e.jugadores[j].jugadas;
  jug[c.tipo] = (jug[c.tipo] ?? 0) + 1;
  jug.total += 1;
  jug.nombres[c.nombre] = (jug.nombres[c.nombre] ?? 0) + 1;
  N.disparar(e, "juega", { uid, j, tipo: c.tipo, pagado: true, desde });
  const datos = { pagado: true, desde };
  if (c.tipo === "Arma") return [sel(["yo:aliados"], { armaLibre: uid }, "_port"), { op: "portar", arma: uid, en: "_port", datos }];
  return [{ op: "entrar", uid, datos }];
}

const comunes = {
  heroe: (e, ctx, u) => esHeroe(e, u),
  miTurno: (e, ctx) => e.activo === ctx.ctrl,
  primero: (e, ctx) => e.activo === ctx.ctrl && e.jugadores[ctx.ctrl].declarados.length === 1,
  comprometer: (e, ctx) => {
    N.agregarEfecto(e, { tipo: "noAtacar", j: ctx.ctrl }, ctx.ctrl);
  },
  doble,
  dobleMarcado: (e, ctx) => (e.efectos.some((f) => f.tipo === "dobleDano" && f.uid === ctx.objetivo) ? doble(e, ctx) : 0),
};

const comprometer = { op: "fn", f: "comprometer" };
const noDeclarable = [
  { cuando: ["entra"], si: "miTurno", hacer: [sel(["fuente"], {}, "yo"), efecto("yo", { tipo: "noAtacarBloquear" })] },
  { cuando: ["comienzoTurno"], hacer: [sel(["fuente"], {}, "yo"), efecto("yo", { tipo: "noAtacarBloquear" })] },
];
const destruirCoste2 = [sel(["todos:enJuego"], { costeMin: 2, costeMax: 2 }, "x", { n: 2, hasta: true, para: "destruir" }), mov("destruir")];
const carreraBuff = [sel(["todos:aliados"], {}, "a"), efecto("a", { tipo: "fuerza", n: 3 }), efecto("a", { tipo: "gana", clave: "DanoAlDestierro" })];

export const HABILIDADES = {
  Daiksuke: {
    disparadas: [
      {
        zona: ["cementerio"],
        cuando: ["alCementerio"],
        quien: "propia",
        si: "turnoRival",
        opcional: true,
        hacer: [{ op: "fn", f: "jugarse" }],
      },
      {
        cuando: ["entra"],
        hacer: [
          ...buscar(["yo:castillo"], { tipo: ["Arma", "Tótem"] }, "cementerio"),
          {
            op: "modo",
            opciones: [
              {
                texto: "Subir una carta que no sea Talismán de tu Cementerio a tu mano",
                requiere: { de: ["yo:cementerio"], filtro: { noTipo: ["Talismán"] } },
                pasos: [sel(["yo:cementerio"], { noTipo: ["Talismán"] }, "s"), mov("mano", "s")],
              },
              { texto: "Robar una carta", pasos: [robar(1)] },
            ],
          },
        ],
      },
    ],
    fns: {
      turnoRival: (e, ctx) => e.activo !== ctx.ctrl && rebajado(e, ctx.fuente) <= disponibles(e, ctx.ctrl, "Aliado"),
      jugarse: (e, ctx, api) => (e.jugadores[ctx.ctrl].cementerio.includes(ctx.fuente) ? jugarRebajado(e, ctx, api, ctx.fuente) : []),
    },
  },
  "Daisuke Tokugawa": {
    claves: ["Indestructible", "NoPierdeHabilidad"],
    disparadas: [
      {
        cuando: ["entra"],
        hacer: [
          {
            op: "modo",
            opciones: [
              {
                texto: "Destruir una carta de coste 2 o menos",
                requiere: { de: ["todos:enJuego"], filtro: { costeMax: 2 }, para: "destruir" },
                pasos: [sel(["todos:enJuego"], { costeMax: 2 }, "x", { para: "destruir" }), mov("destruir")],
              },
              { texto: "Buscar una carta que no sea Talismán", pasos: buscar(["yo:castillo"], { noTipo: ["Talismán"] }) },
            ],
          },
        ],
      },
      { cuando: ["ataca"], quien: "cualquiera", hacer: [{ op: "fn", f: "limitar" }] },
    ],
    fns: {
      limitar: (e, ctx) => {
        N.agregarEfecto(e, { tipo: "noAtacar", j: ctx.datos.j }, ctx.ctrl);
      },
    },
  },
  Elias: {
    claves: ["Indestructible"],
    disparadas: noDeclarable,
    fns: comunes,
  },
  Elijah: {
    claves: ["Indestructible"],
    continuas: [{ rivalDebeAtacar: true }],
    disparadas: [{ cuando: ["entra"], opcional: true, hacer: [robar(1), sel(["todos:aliados"], {}, "a"), efecto("a", { tipo: "fuerza", n: 2 })] }],
  },
  Endimion: {
    claves: ["UnaCopia"],
    activadas: [
      {
        texto: "Un Aliado Héroe gana 1 de Fuerza por cada Oro en el Oro Pagado oponente",
        veces: "turno",
        requiere: { de: ["todos:aliados"], filtro: { f: "heroe" } },
        hacer: [sel(["todos:aliados"], { f: "heroe" }), { op: "fn", f: "ganar" }],
      },
    ],
    fns: {
      ...comunes,
      ganar: (e, ctx) => {
        const n = e.jugadores[N.rival(ctx.ctrl)].pagado.length;
        for (const u of ctx.vars.x ?? []) N.agregarEfecto(e, { tipo: "fuerza", n, uid: u }, ctx.ctrl);
      },
    },
  },
  Enoc: {
    reduce: "red",
    disparadas: [{ cuando: ["entra"], hacer: [sel(["todos:enJuego"], { noTipo: ["Oro"] }, "x", { n: 99, para: "destruir" }), mov("destruir")] }],
    activadas: [
      {
        texto: "Robar dos cartas y un Aliado hace doble daño de combate este turno",
        veces: "turno",
        hacer: [robar(2), sel(["todos:aliados"], {}, "a"), efecto("a", { tipo: "dobleDano" })],
      },
    ],
    continuas: [{ gana: "Indestructible", a: "tusAliados", raza: "Héroe" }, { a: "aliados", fuerzaPor: "dobleMarcado" }],
    fns: { ...comunes, red: (e, ctx) => (N.aliadosDe(e, ctx.ctrl).length <= 1 ? 1 : 0) },
  },
  "General Washington": {
    claves: ["Indestructible"],
    activadas: [
      {
        texto: "Jugar un Arma o un Aliado (no General Washington) de tu mano o Cementerio por un Oro menos",
        momento: "vigilia",
        veces: "turno",
        requiere: { de: ["yo:mano", "yo:cementerio"], filtro: { f: "jugable" } },
        hacer: [sel(["yo:mano", "yo:cementerio"], { f: "jugable" }, "j"), { op: "fn", f: "jugarElegida" }],
      },
    ],
    fns: {
      jugable: (e, ctx, u) => {
        const c = N.carta(e, u);
        if (!["Aliado", "Arma"].includes(c.tipo) || c.nombre === "General Washington") return false;
        if (rebajado(e, u) > disponibles(e, ctx.ctrl, c.tipo)) return false;
        return c.tipo === "Aliado" || N.aliadosDe(e, ctx.ctrl).some((a) => armaCabe(e, a, u));
      },
      jugarElegida: (e, ctx, api) => {
        const [u] = ctx.vars.j ?? [];
        return u ? jugarRebajado(e, ctx, api, u) : [];
      },
    },
  },
  Heracles: {
    claves: ["UnaCopia"],
    disparadas: [{ cuando: ["entra"], hacer: [sel(["todos:aliados"], { f: "heroe" }, "h", { n: 2, hasta: true }), efecto("h", { tipo: "fuerza", n: 2 })] }],
    continuas: [{ a: "tusAliados", raza: "Héroe", fuerzaPor: "doble" }],
    fns: comunes,
  },
  "Hipolito Villegas": {
    claves: ["Indestructible"],
    disparadas: [
      { cuando: ["entra"], opcional: true, hacer: destruirCoste2 },
      { cuando: ["ataca"], quien: "yo", si: "primero", opcional: true, hacer: [comprometer, ...destruirCoste2] },
    ],
    fns: comunes,
  },
  "Hombre Invisible": {
    claves: ["Imbloqueable"],
    activadas: [{ texto: "Un Aliado gana 2 de Fuerza", veces: "turno", requiere: hayAliados, hacer: [sel(["todos:aliados"]), efecto("x", { tipo: "fuerza", n: 2 })] }],
    disparadas: [{ cuando: ["ataca"], quien: "yo", si: "primero", opcional: true, hacer: [{ op: "fn", f: "agrupar" }] }],
    fns: {
      ...comunes,
      agrupar: (e, ctx) => {
        const u = ctx.datos.uid;
        const p = e.jugadores[ctx.ctrl];
        if (!p.ataque.includes(u)) return;
        N.quitarDelCastillo(e, N.rival(ctx.ctrl), N.fuerza(e, u), "cementerio");
        N.sacar(e, u);
        p.defensa.push(u);
        e.atacantes = e.atacantes.filter((x) => x !== u);
        N.agregarEfecto(e, { tipo: "noAtacarBloquear", uid: u }, ctx.ctrl);
      },
    },
  },
  "Huaso Bueras": {
    claves: ["Furia"],
    disparadas: [
      {
        cuando: ["ataca"],
        si: "primero",
        opcional: true,
        hacer: [comprometer, { op: "modo", opciones: [0, 1, 2, 3, 4, 5, 6].map((c) => ({ texto: `Coste ${c}`, pasos: [{ op: "fn", f: "barajarCoste", c }] })) }],
      },
    ],
    fns: {
      ...comunes,
      delCoste: (e, ctx, u) => coste(e, u) === ctx.vars.coste?.[0],
      barajarCoste: (e, ctx, api, p) => {
        ctx.vars.coste = [p.c];
        return [sel(["rival:enJuego"], { f: "delCoste" }, "x", { n: 99 }), mov("barajar")];
      },
    },
  },
  "Husares de la Muerte": {
    disparadas: [{ cuando: ["entra"], hacer: buscar(["yo:castillo"], { tipo: "Aliado" }) }],
    continuas: [{ gana: "NoSale", a: "tusAliados", raza: "Héroe", si: "enBatalla" }],
    fns: { enBatalla: (e) => ["ataque", "bloqueo", "talismanes", "danando"].includes(e.fase) },
  },
  "Ignacio de la Carrera": {
    claves: ["Indestructible"],
    disparadas: [
      {
        cuando: ["entra"],
        hacer: [sel(["yo:castillo"], { tipo: "Aliado" }, "b"), mov("mano", "b"), barajar(), { op: "si", f: "carrera", entonces: [{ op: "generar", n: 1, tipos: ["Aliado"] }] }],
      },
    ],
    fns: { carrera: (e, ctx) => (ctx.vars.b ?? []).some((u) => esCarrera(e, u)) },
  },
  Jafet: {
    disparadas: [
      {
        cuando: ["entra"],
        opcional: true,
        hacer: [
          sel(["todos:cementerio"], {}, "c", { n: 5, hasta: true }),
          { op: "modo", opciones: [{ texto: "Barajar", pasos: [mov("barajar", "c")] }, { texto: "Desterrar", pasos: [mov("desterrar", "c")] }] },
          robar(3),
        ],
      },
    ],
    activadas: [
      {
        texto: "Desterrarlo de tu mano y pagar dos Oros: hasta dos Aliados no pueden salir del juego hasta tu próximo turno",
        zona: "mano",
        oros: 2,
        coste: [sel(["fuente"], {}, "yo"), mov("desterrar", "yo")],
        hacer: [sel(["todos:aliados"], {}, "a", { n: 2, hasta: true }), efecto("a", { tipo: "noSale" }, "proximoTurno")],
      },
    ],
  },
  "Javiera Carrera": {
    activadas: [
      {
        texto: "Un Aliado duplica su Fuerza por el turno (un Carrera la triplica y no puede salir del juego)",
        veces: "turno",
        requiere: hayAliados,
        hacer: [sel(["todos:aliados"]), { op: "fn", f: "multiplicar" }],
      },
      {
        texto: "Desterrar hasta tres cartas de un Cementerio y robar una",
        momento: "vigilia",
        veces: "turno",
        hacer: [
          {
            op: "modo",
            opciones: [
              { texto: "tu Cementerio", pasos: [sel(["yo:cementerio"], {}, "c", { n: 3, hasta: true }), mov("desterrar", "c")] },
              { texto: "Cementerio oponente", pasos: [sel(["rival:cementerio"], {}, "c", { n: 3, hasta: true }), mov("desterrar", "c")] },
            ],
          },
          robar(1),
        ],
      },
    ],
    fns: {
      multiplicar: (e, ctx) => {
        for (const u of ctx.vars.x ?? []) {
          const f = N.fuerza(e, u);
          const carrera = esCarrera(e, u);
          N.agregarEfecto(e, { tipo: "fuerza", n: carrera ? 2 * f : f, uid: u }, ctx.ctrl);
          if (carrera) N.agregarEfecto(e, { tipo: "noSale", uid: u, fin: "proximoTurno" }, ctx.ctrl);
        }
      },
    },
  },
  "Jim Hawkins": {
    claves: ["NoAnulable"],
    disparadas: [{ cuando: ["entra"], hacer: [{ op: "mostrarHasta", n: 1, filtro: { tipo: "Oro" }, como: "m" }, mov("mano", "m"), barajar()] }],
  },
  "Jose Miguel Carrera": {
    claves: ["Furia"],
    disparadas: [{ cuando: ["sale", "saleDelJuego"], quien: "yo", veces: 1, si: "esAliado", hacer: [robar(1)] }],
    fns: { esAliado: (e, ctx) => !ctx.datos.tipo || ctx.datos.tipo === "Aliado" },
  },
  "Juan Jose Carrera": {
    claves: ["Indestructible", "NoAnulable"],
    disparadas: [
      { cuando: ["entra"], hacer: carreraBuff },
      { cuando: ["ataca"], quien: "yo", si: "primero", opcional: true, hacer: [comprometer, ...carreraBuff] },
    ],
    fns: comunes,
  },
  "Justo Estay": {
    claves: ["Indestructible"],
    disparadas: [
      { cuando: ["entra"], si: "oroEnMano", opcional: true, hacer: [sel(["yo:mano"], { tipo: "Oro" }, "o"), { op: "ponerOro", var: "o", a: "pagado" }] },
      {
        cuando: ["ataca"],
        quien: "yo",
        si: "primeroConMano",
        opcional: true,
        hacer: [comprometer, sel(["yo:mano"], {}, "c"), mov("barajar", "c"), ...buscar(["yo:castillo"], { tipo: "Aliado" })],
      },
    ],
    fns: {
      ...comunes,
      oroEnMano: (e, ctx) => e.jugadores[ctx.ctrl].mano.some((u) => N.carta(e, u).tipo === "Oro"),
      primeroConMano: (e, ctx) => comunes.primero(e, ctx) && e.jugadores[ctx.ctrl].mano.length > 0,
    },
  },
  "Kai Pendragon": {
    disparadas: noDeclarable,
    fns: comunes,
  },
  "Kai Piloto Prodigio": {
    claves: ["Indestructible"],
    activadas: [
      {
        texto: "Un Aliado gana 1 de Fuerza, Furia y hace doble daño de combate este turno",
        momento: "vigilia",
        veces: "turno",
        requiere: hayAliados,
        hacer: [
          sel(["todos:aliados"], {}, "a"),
          efecto("a", { tipo: "fuerza", n: 1 }),
          efecto("a", { tipo: "gana", clave: "Furia" }),
          efecto("a", { tipo: "dobleDano" }),
        ],
      },
    ],
    continuas: [{ a: "aliados", fuerzaPor: "dobleMarcado" }],
    fns: comunes,
  },
  "Lady Mina Harker": {
    disparadas: [{ cuando: ["entra", "sale"], hacer: buscar(["yo:castillo"], {}) }],
  },
  "Los Señalados": {
    claves: ["Furia", "NoPortaArmas"],
    disparadas: [
      { cuando: ["entra"], hacer: [sel(["fuente"], {}, "yo"), efecto("yo", { tipo: "gana", clave: "Imbloqueable" })] },
      { cuando: ["haceDano"], hacer: [{ op: "fn", f: "marcar" }] },
      { cuando: ["faseFinal"], si: "hizoDano", hacer: [sel(["fuente"], {}, "yo"), efecto("yo", { tipo: "fuerza", n: 1 }, "juego")] },
    ],
    fns: {
      marcar: (e, ctx) => {
        e.usos[`senalados|${ctx.fuente}`] = e.turno;
      },
      hizoDano: (e, ctx) => e.usos[`senalados|${ctx.fuente}`] === e.turno,
    },
  },
  "Luis Carrera": {
    disparadas: [
      {
        cuando: ["entra"],
        hacer: [sel(["todos:aliados"], {}, "a"), efecto("a", { tipo: "gana", clave: "Indestructible" }), { op: "robar", nf: "cuantos" }],
      },
    ],
    fns: {
      cuantos: (e, ctx) => {
        const a = N.aliadosDe(e, ctx.ctrl);
        return a.length + a.filter((u) => esCarrera(e, u)).length;
      },
    },
  },
  "Manuel Rodriguez": {
    claves: ["Furia", "DanoAlDestierro"],
    continuas: [{ a: "propia", fuerzaPor: "doble" }],
    disparadas: [
      { cuando: ["ataca"], si: "primero", opcional: true, hacer: [comprometer, robar(1)] },
      {
        cuando: ["comienzoTurno"],
        quien: "cualquiera",
        hacer: [
          {
            op: "modo",
            opciones: [
              { texto: "Generar un Oro para jugar Aliados", pasos: [{ op: "generar", n: 1, tipos: ["Aliado"] }] },
              {
                texto: "Barajar una carta de coste 3 o menos",
                requiere: { de: ["todos:enJuego"], filtro: { costeMax: 3 } },
                pasos: [sel(["todos:enJuego"], { costeMax: 3 }), mov("barajar")],
              },
            ],
          },
        ],
      },
    ],
    fns: comunes,
  },
};
