import * as N from "../nucleo.js";
import { sel, mov, barajar, robar, efecto, buscar, castilloElegido, coste } from "../formato.js";
import { armaCabe, disponibles, hayObjetivo } from "../efectos.js";

const botar = (n, quien = "rival") => ({ op: "botar", n, quien });
const resto = (n) => (e, ctx) => n - (ctx.vars.c ?? []).length;
const barajarYDesterrar = (n, nf) => [
  sel(["todos:cementerio"], {}, "c", { n, hasta: true }),
  mov("barajar", "c"),
  sel(["todos:cementerio"], {}, "d", { nf, hasta: true }),
  mov("desterrar", "d"),
];
const barajarCementerios = (n) => [sel(["todos:cementerio"], {}, "c", { n, hasta: true }), mov("barajar", "c")];
const descarteRival = (como = "d") => [sel(["rival:mano"], {}, como, { quien: "rival" }), mov("cementerio", como)];
const esArma = (e, ctx) => ctx.datos.tipo === "Arma";
const esAliado = (e, ctx) => !ctx.datos.tipo || ctx.datos.tipo === "Aliado";
const armasRecientes = (e, j) => N.armasDe(e, j).length > 0 || (e.jugadores[j].jugadas.Arma ?? 0) > 0;
const atacoSolo = (e, j, uid) => {
  const d = e.jugadores[j].declarados;
  return e.activo === j && d.length === 1 && d[0] === uid;
};
const rebajado = (e, u) => Math.max(1, coste(e, u) - 1);

export const HABILIDADES = {
  "Miguel Grau": {
    disparadas: [
      { cuando: ["entra"], hacer: [...barajarCementerios(3), robar(2)] },
      { zona: ["cementerio"], cuando: ["salenDelCastillo"], si: "botadoPorDano", hacer: [{ op: "fn", f: "detener" }] },
    ],
    activadas: [
      {
        texto: "Barajarlo para Destruir una carta de coste 2 o menos",
        requiere: { de: ["todos:enJuego"], filtro: { costeMax: 2, noFuente: true }, para: "destruir" },
        coste: [sel(["fuente"], {}, "yo"), mov("barajar", "yo")],
        hacer: [sel(["todos:enJuego"], { costeMax: 2 }, "x", { para: "destruir" }), mov("destruir")],
      },
    ],
    fns: {
      botadoPorDano: (e, ctx) => ctx.datos.porDano && ctx.datos.zona === "cementerio" && ctx.datos.uids.includes(ctx.fuente),
      detener: (e, ctx) => {
        const { uids } = ctx.datos;
        const cementerio = e.jugadores[ctx.ctrl].cementerio;
        const despues = uids.slice(uids.indexOf(ctx.fuente) + 1).filter((u) => cementerio.includes(u));
        for (const u of [...despues].reverse()) N.mover(e, u, "castillo");
        N.mover(e, ctx.fuente, "destierro");
      },
    },
  },
  Nanna: {
    claves: ["UnaCopia"],
  },
  Origenes: {
    disparadas: [
      { cuando: ["entra"], hacer: [...barajarCementerios(6), robar(2)] },
      {
        zona: ["cementerio"],
        cuando: ["comienzoTurno"],
        quien: "yo",
        si: "conMano",
        opcional: true,
        hacer: [sel(["yo:mano"], {}, "d"), mov("cementerio", "d"), sel(["fuente"], {}, "yo"), mov("mano", "yo")],
      },
    ],
    fns: { conMano: (e, ctx) => e.jugadores[ctx.ctrl].mano.length > 0 },
  },
  "Paladin de la Luz": {
    activadas: [
      {
        texto: "Barajar un Arma que controles: Barajar y/o Desterrar hasta dos cartas de los Cementerios y buscar un Aliado en tu Castillo",
        veces: "turno",
        requiere: { de: ["yo:armas"], filtro: {} },
        coste: [sel(["yo:armas"], {}, "a"), mov("barajar", "a")],
        hacer: [...barajarYDesterrar(2, "resto2"), ...buscar(["yo:castillo"], { tipo: "Aliado" })],
      },
    ],
    continuas: [{ si: "armas", aliadosNoCambian: true }],
    fns: { armas: (e, ctx) => armasRecientes(e, ctx.ctrl), resto2: resto(2) },
  },
  "Papa Legba": {
    disparadas: [
      {
        cuando: ["entra", "ataca"],
        opcional: true,
        hacer: [
          { op: "fn", f: "mostrar" },
          sel(["var:m"], {}, "a"),
          mov("mano", "a"),
          { op: "fn", f: "otra" },
          mov("cementerio", "r"),
          barajar(),
          {
            op: "si",
            f: "ambos",
            entonces: [
              castilloElegido((quien) => [
                sel([`${quien}:castillo`], {}, "d1"),
                sel([`${quien}:castillo`], { f: "otroNombre" }, "d2"),
                mov("desterrar", "d1"),
                mov("desterrar", "d2"),
                barajar(quien),
              ]),
            ],
          },
        ],
      },
    ],
    fns: {
      mostrar: (e, ctx) => {
        let furia = null;
        let arma = null;
        for (const u of e.jugadores[ctx.ctrl].castillo) {
          const c = N.carta(e, u);
          if (!furia && c.tipo === "Aliado" && c.claves.includes("Furia")) furia = u;
          else if (!arma && c.tipo === "Arma") arma = u;
          if (furia && arma) break;
        }
        ctx.vars.m = [furia, arma].filter(Boolean);
      },
      otra: (e, ctx) => {
        ctx.vars.r = (ctx.vars.m ?? []).filter((u) => !(ctx.vars.a ?? []).includes(u));
      },
      ambos: (e, ctx) => (ctx.vars.m ?? []).length === 2,
      otroNombre: (e, ctx, u) => !(ctx.vars.d1 ?? []).some((x) => N.carta(e, x).nombre === N.carta(e, u).nombre),
    },
  },
  Serafin: {},
  Shade: {
    orosMenos: "gratis",
    disparadas: [
      {
        cuando: ["entra"],
        hacer: [
          {
            op: "modo",
            opciones: [
              { texto: "Barajar y/o Desterrar hasta tres cartas de los Cementerios", pasos: barajarYDesterrar(3, "resto3") },
              { texto: "Este Aliado gana Furia", pasos: [sel(["fuente"], {}, "yo"), efecto("yo", { tipo: "gana", clave: "Furia" }, "mientras")] },
            ],
          },
          { op: "fn", f: "ataqueFirme" },
        ],
      },
    ],
    fns: {
      gratis: (e, ctx) => (e.jugadores[ctx.ctrl].atacoTurnoAnterior ? 99 : 0),
      resto3: resto(3),
      ataqueFirme: (e, ctx) => {
        N.agregarEfecto(e, { tipo: "gana", clave: "AtaqueNoCancelable", aliadosDe: ctx.ctrl }, ctx.ctrl);
      },
    },
  },
  "Ángel Miguel, el Protector": {
    claves: ["Indestructible"],
    disparadas: [{ cuando: ["entra"], hacer: barajarYDesterrar(6, "resto6") }],
    fns: { resto6: resto(6) },
  },
  "Ambrosio O'Higgins": {
    claves: ["Imbloqueable"],
    activadas: [{ texto: "Buscar un Arma en tu Castillo y ponerla en tu mano", veces: "turno", hacer: buscar(["yo:castillo"], { tipo: "Arma" }) }],
  },
  "Andinia-X 2": {
    reduce: "red",
    disparadas: [{ zona: ["cementerio"], cuando: ["juega"], quien: "yo", si: "esArma", opcional: true, hacer: [sel(["fuente"], {}, "yo"), mov("mano", "yo")] }],
    fns: {
      esArma,
      red: (e, ctx) => {
        const p = e.jugadores[ctx.ctrl];
        return [...p.mano, ...p.cementerio].some((u) => u !== ctx.fuente && ["Arma", "Tótem"].includes(N.carta(e, u).tipo)) ? 1 : 0;
      },
    },
  },
  "Arturo Pendragón, Rey Paladín": {
    disparadas: [
      {
        cuando: ["entra"],
        hacer: [
          sel(["todos:aliados"], {}, "a", { n: 2, hasta: true }),
          efecto("a", { tipo: "gana", clave: "Furia" }, "turno"),
          efecto("a", { tipo: "gana", clave: "Imbloqueable" }, "turno"),
        ],
      },
      { cuando: ["comienzoVigilia"], quien: "cualquiera", hacer: [botar(2), ...descarteRival()] },
    ],
    continuas: [{ fuerza: 1, a: "tusDemasAliados" }, { aliadosNoCambian: true }],
  },
  "Arturo Prat": {
    claves: ["Furia"],
    continuas: [{ a: "propia", fuerzaPor: "duplica" }],
    disparadas: [
      { cuando: ["faseFinal"], si: "solo", hacer: [sel(["fuente"], {}, "yo"), mov("destruir", "yo")] },
      {
        cuando: ["sale", "saleDelJuego", "haceDano"],
        quien: "yo",
        veces: 1,
        si: "esAliado",
        opcional: true,
        hacer: [sel(["todos:enJuego"], { costeMax: 3 }, "x", { hasta: true }), mov("barajar")],
      },
    ],
    fns: {
      esAliado,
      solo: (e, ctx) => atacoSolo(e, ctx.ctrl, ctx.fuente),
      duplica: (e, ctx) => (e.fase !== "ataque" && atacoSolo(e, ctx.ctrl, ctx.fuente) ? N.carta(e, ctx.fuente).fuerza ?? 0 : 0),
    },
  },
  "Arturo de Bretaña": {
    disparadas: [
      {
        cuando: ["entra"],
        opcional: true,
        hacer: [sel(["yo:castillo", "yo:cementerio"], { tipo: "Arma" }, "a", { n: 2, hasta: true }), { op: "fn", f: "repartir" }, barajar()],
      },
    ],
    activadas: [
      {
        texto: "Un Arma de tu Cementerio gana Exhumar por el turno",
        veces: "turno",
        requiere: { de: ["yo:cementerio"], filtro: { tipo: "Arma" } },
        hacer: [sel(["yo:cementerio"], { tipo: "Arma" }), efecto("x", { tipo: "gana", clave: "Exhumar" }, "turno")],
      },
    ],
    fns: {
      repartir: (e, ctx) =>
        (ctx.vars.a ?? []).flatMap((u) => [
          { op: "fn", f: "fijar", uid: u },
          {
            op: "modo",
            opciones: [
              { texto: "Jugarla pagando un Oro menos (mínimo 1)", requiere: "puedeJugar", pasos: [{ op: "fn", f: "jugarArma", uid: u }] },
              { texto: "Ponerla en tu mano", pasos: [mov("mano", "actual")] },
            ],
          },
        ]),
      fijar: (e, ctx, api, p) => {
        ctx.vars.actual = [p.uid];
      },
      puedeJugar: (e, ctx) => {
        const [u] = ctx.vars.actual ?? [];
        return !!u && rebajado(e, u) <= disponibles(e, ctx.ctrl, "Arma") && N.aliadosDe(e, ctx.ctrl).some((a) => armaCabe(e, a, u));
      },
      jugarArma: (e, ctx, api, p) => {
        const j = ctx.ctrl;
        const desde = N.ubicar(e, p.uid)?.zona ?? null;
        api.pagarOros(e, j, rebajado(e, p.uid), "Arma");
        const jug = e.jugadores[j].jugadas;
        jug.Arma = (jug.Arma ?? 0) + 1;
        jug.total += 1;
        const nombre = N.carta(e, p.uid).nombre;
        jug.nombres[nombre] = (jug.nombres[nombre] ?? 0) + 1;
        N.disparar(e, "juega", { uid: p.uid, j, tipo: "Arma", pagado: true, desde });
        return [sel(["yo:aliados"], { armaLibre: p.uid }, "_port"), { op: "portar", arma: p.uid, en: "_port", datos: { pagado: true, desde } }];
      },
    },
  },
  Aubrey: {
    claves: ["Furia"],
    continuas: [{ armasEnGuerra: true }],
    disparadas: [
      {
        cuando: ["ataca"],
        quien: "yo",
        si: "primero",
        hacer: [sel(["yo:castillo"], { tipo: ["Aliado", "Arma"], costeMax: 2 }, "b"), { op: "jugarGratis", var: "b" }, { op: "fn", f: "atacando" }, barajar()],
      },
    ],
    fns: {
      primero: (e, ctx) => e.jugadores[ctx.ctrl].declarados.length === 1,
      atacando: (e, ctx) => {
        const p = e.jugadores[ctx.ctrl];
        for (const u of ctx.vars.b ?? []) {
          if (!p.defensa.includes(u) || N.carta(e, u).tipo !== "Aliado") continue;
          N.sacar(e, u);
          p.ataque.push(u);
          e.atacantes.push(u);
        }
      },
    },
  },
  "Baron Vordenburg": {
    claves: ["Furia"],
    disparadas: [{ cuando: ["entra"], hacer: [sel(["yo:aliados"], {}, "a"), { op: "botar", nf: "cuantas", quien: "rival" }] }],
    continuas: [
      { gana: "DanoAlDestierro", a: "tusAliados" },
      { gana: "AtaqueNoCancelable", a: "tusAliados" },
    ],
    fns: { cuantas: (e, ctx) => (ctx.vars.a ?? []).reduce((s, u) => s + N.fuerza(e, u), 0) + N.armasDe(e, ctx.ctrl).length },
  },
  Beauchef: {
    claves: ["Imbloqueable"],
    disparadas: [{ cuando: ["juega"], quien: "yo", veces: 2, si: "esArma", hacer: [...descarteRival(), ...barajarCementerios(3)] }],
    fns: { esArma },
  },
  "Bernardo O'Higgins": {
    claves: ["Furia", "Imbloqueable"],
    continuas: [{ impuestoTalisman: true }],
    activadas: [
      {
        texto: "Barajar un Arma o Aliado Caballero de tu mano o que controles: Desterrar una carta de coste 3 o menos",
        veces: "turno",
        requiere: "puede",
        coste: [sel(["yo:mano", "yo:enJuego"], { f: "armaOCaballero" }, "c"), mov("barajar", "c")],
        hacer: [sel(["todos:enJuego"], { costeMax: 3 }, "x", { para: "desterrar" }), mov("desterrar")],
      },
    ],
    fns: {
      armaOCaballero: (e, ctx, u) => {
        const c = N.carta(e, u);
        return c.tipo === "Arma" || (c.tipo === "Aliado" && (c.razas ?? []).includes("Caballero"));
      },
      puede: (e, ctx) =>
        hayObjetivo(e, ctx, { de: ["yo:mano", "yo:enJuego"], filtro: { f: "armaOCaballero" } }) &&
        hayObjetivo(e, ctx, { de: ["todos:enJuego"], filtro: { costeMax: 3 }, para: "desterrar" }),
    },
  },
  "Caballero Espejado": {
    claves: ["Furia", "Imbloqueable", "DanoAlDestierro"],
    disparadas: [
      {
        cuando: ["entra", "ataca"],
        opcional: true,
        hacer: [
          sel(["todos:enJuego"], { costeMax: 2 }, "x", { para: "destruir", hasta: true }),
          mov("destruir"),
          sel(["yo:mano", "yo:cementerio"], { tipo: "Aliado", costeMax: 1 }, "a", { hasta: true }),
          { op: "jugarGratis", var: "a" },
        ],
      },
    ],
  },
  Camael: {
    disparadas: [
      { cuando: ["entra"], opcional: true, hacer: [sel(["yo:castillo", "yo:cementerio"], { tipo: "Arma", costeMax: 2 }, "a"), { op: "jugarGratis", var: "a" }, barajar()] },
      {
        cuando: ["juega"],
        quien: "yo",
        veces: 2,
        si: "esArma",
        hacer: [...descarteRival(), sel(["rival:enJuego"], { noTipo: ["Oro"] }, "b", { quien: "rival" }), mov("barajar", "b")],
      },
    ],
    fns: { esArma },
  },
  "Capitan Obrien": {
    disparadas: [
      {
        cuando: ["entra"],
        opcional: true,
        hacer: [sel(["todos:enJuego"], { f: "oroOBarata" }, "x", { hasta: true }), efecto("x", { tipo: "pierdeHabilidad" }, "mientras")],
      },
      {
        cuando: ["faseFinal"],
        opcional: true,
        hacer: [
          sel(["todos:cementerio"], {}, "c", { nf: "fuerzaPropia", hasta: true }),
          mov("barajar", "c"),
          sel(["todos:cementerio"], {}, "d", { nf: "restoFuerza", hasta: true }),
          mov("desterrar", "d"),
        ],
      },
    ],
    fns: {
      oroOBarata: (e, ctx, u) => N.carta(e, u).tipo === "Oro" || coste(e, u) <= 2,
      fuerzaPropia: (e, ctx) => (N.enJuego(e, ctx.fuente) ? N.fuerza(e, ctx.fuente) : 0),
      restoFuerza: (e, ctx) => (N.enJuego(e, ctx.fuente) ? N.fuerza(e, ctx.fuente) : 0) - (ctx.vars.c ?? []).length,
    },
  },
  "Capitán del Demeter": {
    claves: ["Furia"],
    reduce: "red",
    disparadas: [{ cuando: ["entra", "ataca"], hacer: [sel(["rival:mano"], {}, "m", { n: 2, azar: true }), { op: "fn", f: "vetar" }] }],
    fns: {
      red: (e, ctx) => (armasRecientes(e, ctx.ctrl) ? 1 : 0),
      vetar: (e, ctx) => {
        for (const u of ctx.vars.m ?? []) N.agregarEfecto(e, { tipo: "noJugarNombre", j: N.rival(ctx.ctrl), nombre: N.carta(e, u).nombre, fin: "proximoTurno" }, ctx.ctrl);
      },
    },
  },
  "Casimiro Marco del Pont": {
    disparadas: [
      {
        cuando: ["entra"],
        hacer: [
          sel(["todos:cementerio"], {}, "c", { n: 2, hasta: true }),
          { op: "convertir", var: "c", en: "Aliado", fuerza: 2, a: "defensa" },
          {
            op: "si",
            f: "faltan",
            entonces: [castilloElegido((quien) => [{ op: "tope", quien, nf: "resto2", como: "t" }, { op: "convertir", var: "t", en: "Aliado", fuerza: 2, a: "defensa" }])],
          },
        ],
      },
      {
        cuando: ["juega"],
        quien: "yo",
        si: "usoOro",
        hacer: [{ op: "fn", f: "desmarcar" }, { op: "opcional", texto: "Barajar una carta de coste 3 o menos", pasos: [sel(["todos:enJuego"], { costeMax: 3 }), mov("barajar")] }],
      },
    ],
    activadas: [{ texto: "Generar un Oro para jugar Armas", veces: "turno", hacer: [{ op: "generar", n: 1, tipos: ["Arma"] }, { op: "fn", f: "marcar" }] }],
    fns: {
      resto2: resto(2),
      faltan: (e, ctx) => (ctx.vars.c ?? []).length < 2,
      marcar: (e, ctx) => {
        e.usos[`casimiro|${ctx.fuente}`] = e.turno;
      },
      desmarcar: (e, ctx) => {
        delete e.usos[`casimiro|${ctx.fuente}`];
      },
      usoOro: (e, ctx) =>
        ctx.datos.tipo === "Arma" &&
        e.usos[`casimiro|${ctx.fuente}`] === e.turno &&
        !(e.jugadores[ctx.ctrl].generados ?? []).some((g) => g.tipos?.includes("Arma")),
    },
  },
  Custodios: {
    claves: ["Furia", "Imbloqueable"],
    disparadas: [{ cuando: ["entra"], opcional: true, hacer: [sel(["yo:mano", "yo:cementerio"], { tipo: "Arma", costeMax: 2 }, "a"), { op: "jugarGratis", var: "a" }] }],
  },
  Danel: {
    disparadas: [
      {
        cuando: ["entra"],
        hacer: [
          sel(["yo:mano"], {}, "d1"),
          sel(["rival:mano"], {}, "d2", { quien: "rival" }),
          mov("cementerio", "d1"),
          mov("cementerio", "d2"),
          { op: "si", f: "huboArma", entonces: [robar(1)] },
        ],
      },
    ],
    continuas: [{ si: "armas", gana: "Furia", a: "tusAliados" }],
    fns: {
      armas: (e, ctx) => armasRecientes(e, ctx.ctrl),
      huboArma: (e, ctx) => [...(ctx.vars.d1 ?? []), ...(ctx.vars.d2 ?? [])].some((u) => N.carta(e, u).tipo === "Arma"),
    },
  },
  "Dorian Gray": {
    disparadas: [{ cuando: ["entra"], hacer: [sel(["yo:mano"], {}, "x", { n: 99, hasta: true }), { op: "fn", f: "dorian" }] }],
    fns: {
      dorian: (e, ctx) => {
        const k = (ctx.vars.x ?? []).length;
        for (const u of ctx.vars.x ?? []) N.mover(e, u, "castillo");
        if (k) N.barajarCastillo(e, ctx.ctrl);
        N.robar(e, ctx.ctrl, k + 1);
      },
    },
  },
};
