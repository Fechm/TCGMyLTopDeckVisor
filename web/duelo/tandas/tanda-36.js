import * as N from "../nucleo.js";
import { sel, mov, barajar, robar, efecto, buscar, castilloElegido, aliadoDeCastillo, coste } from "../formato.js";
import { armaCabe, disponibles, pagarOros } from "../efectos.js";

const botar = (n, quien = "rival") => ({ op: "botar", n, quien });
const esPincheira = (e, u) => N.carta(e, u).nombre.includes("Pincheira");
const aliadoEnMano = { de: ["yo:mano"], filtro: { tipo: "Aliado" } };
const nAliados = (e, ctx) => N.aliadosDe(e, ctx.ctrl).length;
const desterrarTres = [sel(["rival:cementerio"], {}, "c", { n: 3, hasta: true }), mov("desterrar", "c")];

function contar(e, j, uid) {
  const c = N.carta(e, uid);
  const p = e.jugadores[j];
  p.jugadas[c.tipo] = (p.jugadas[c.tipo] ?? 0) + 1;
  p.jugadas.nombres[c.nombre] = (p.jugadas.nombres[c.nombre] ?? 0) + 1;
  if (["Aliado", "Arma", "Tótem"].includes(c.tipo)) p.jugadas.total += 1;
}

const reducidoPagable = (e, ctx, u) => Math.max(0, coste(e, u) - 1) <= disponibles(e, ctx.ctrl, "Aliado");

function jugarReducido(e, ctx) {
  const j = ctx.ctrl;
  const pasos = [];
  for (const uid of ctx.vars.b ?? []) {
    const n = Math.max(0, coste(e, uid) - 1);
    if (n > disponibles(e, j, "Aliado")) continue;
    pagarOros(e, j, n, "Aliado");
    const desde = N.ubicar(e, uid)?.zona ?? null;
    contar(e, j, uid);
    N.disparar(e, "juega", { uid, j, tipo: N.carta(e, uid).tipo, pagado: true, desde });
    pasos.push({ op: "entrar", uid, datos: { pagado: true, desde } });
  }
  return pasos;
}

export const HABILIDADES = {
  "El Bandido Egipcio": {
    claves: ["Furia"],
    disparadas: [{ cuando: ["entra", "ataca"], hacer: [sel(["rival:castillo"], { tipo: "Oro" }, "b", { n: 2 }), mov("cementerio", "b"), barajar("rival")] }],
  },
  "El Cazador": {
    orosMenos: "gratis",
    disparadas: [{ cuando: ["entra"], hacer: [sel(["todos:aliados"], { costeMax: 2 }, "x", { n: 2, hasta: true }), { op: "fn", f: "neutralizar" }] }],
    fns: {
      gratis: (e, ctx) => {
        const r = N.rival(ctx.ctrl);
        return e.activo === r && e.jugadores[r].declarados.length >= 3 ? 99 : 0;
      },
      neutralizar: (e, ctx) => {
        for (const uid of ctx.vars.x ?? []) {
          N.agregarEfecto(e, { tipo: "pierdeHabilidad", uid }, ctx.ctrl);
          N.agregarEfecto(e, { tipo: "gana", clave: "Indestructible", uid }, ctx.ctrl);
          const f = N.fuerza(e, uid);
          if (f) N.agregarEfecto(e, { tipo: "fuerza", uid, n: -f }, ctx.ctrl);
        }
      },
    },
  },
  "Frederick Ransom": {
    claves: ["Exhumar"],
    activadas: [
      {
        texto: "Poner bajo tu control la primera carta de un Castillo como un Aliado de Fuerza 2 sin habilidad que puede atacar este turno",
        momento: "vigilia",
        veces: "turno",
        requiere: "noMas",
        hacer: [castilloElegido((quien) => [...aliadoDeCastillo(quien), efecto("t", { tipo: "gana", clave: "AtacaAlEntrar" }, "turno")])],
      },
    ],
    fns: { noMas: (e, ctx) => N.aliadosDe(e, ctx.ctrl).length <= N.aliadosDe(e, N.rival(ctx.ctrl)).length },
  },
  Gog: {
    claves: ["Furia"],
    disparadas: [
      { cuando: ["entra"], hacer: [sel(["todos:aliados"], {}, "x", { n: 2, hasta: true }), efecto("x", { tipo: "fuerza", n: 2 }, "mientras")] },
      {
        cuando: ["haceDano"],
        opcional: true,
        hacer: [
          sel(["fuente"], {}, "yo"),
          mov("barajar", "yo"),
          sel(["yo:pagado"], { tipo: "Oro" }, "o"),
          mov("reserva", "o"),
          sel(["yo:castillo"], { tipo: "Aliado" }, "a"),
          mov("mano", "a"),
          sel(["yo:castillo"], { tipo: "Arma" }, "w"),
          mov("mano", "w"),
          barajar(),
        ],
      },
    ],
  },
  Gurzil: {
    claves: ["Furia"],
    orosMenos: "ataco",
    disparadas: [
      {
        cuando: ["ataca"],
        quien: "yo",
        veces: 1,
        hacer: [sel(["rival:aliados"], {}, "f", { n: 2, hasta: true }), { op: "desterrarTope", quien: "rival", nf: "suma" }, robar(1)],
      },
    ],
    fns: {
      ataco: (e, ctx) => (e.jugadores[ctx.ctrl].atacoTurnoAnterior ? 1 : 0),
      suma: (e, ctx) => (ctx.vars.f ?? []).reduce((s, u) => s + N.fuerza(e, u), 0),
    },
  },
  "Hattori Hanzo": {
    claves: ["Furia", "Imbloqueable"],
    activadas: [
      {
        texto: "Un Aliado gana 2 de Fuerza y hace daño al Destierro este turno",
        veces: "turno",
        requiere: { de: ["todos:aliados"], filtro: {} },
        hacer: [sel(["todos:aliados"]), efecto("x", { tipo: "fuerza", n: 2 }), efecto("x", { tipo: "gana", clave: "DanoAlDestierro" })],
      },
    ],
  },
  "Hijo de la Bestia": {
    claves: ["Furia"],
  },
  "Ilunga Mbili": {
    claves: ["Indestructible"],
    disparadas: [
      {
        cuando: ["entra"],
        hacer: [{ op: "mostrarHasta", n: 1, filtro: { tipo: "Aliado", costeMax: 2, f: "guerrero" }, como: "m" }, { op: "jugarGratis", var: "m" }, barajar(), botar(2)],
      },
    ],
    fns: { guerrero: (e, ctx, u) => (N.carta(e, u).razas ?? []).includes("Guerrero") },
  },
  Ismael: {
    claves: ["Furia"],
    disparadas: [{ cuando: ["ataca"], si: "hayRival", opcional: true, hacer: [sel(["rival:aliados"], {}, "b"), { op: "fn", f: "forzar" }] }],
    fns: {
      hayRival: (e, ctx) => N.aliadosDe(e, N.rival(ctx.ctrl)).length > 0,
      forzar: (e, ctx) => {
        for (const uid of ctx.vars.b ?? []) {
          N.agregarEfecto(e, { tipo: "debeBloquearA", uid, atacante: ctx.fuente }, ctx.ctrl);
          N.agregarEfecto(e, { tipo: "fuerza", uid, n: -1 }, ctx.ctrl);
          N.agregarEfecto(e, { tipo: "pierdeHabilidad", uid }, ctx.ctrl);
        }
      },
    },
  },
  "Jane Eyre": {
    claves: ["Furia"],
    disparadas: [{ cuando: ["juega"], quien: "rival", veces: 3, si: "talisman", hacer: [sel(["fuente"], {}, "yo"), efecto("yo", { tipo: "fuerza", n: 2 }, "mientras")] }],
    fns: { talisman: (e, ctx) => ctx.datos.tipo === "Talismán" },
  },
  "Karl Red": {
    claves: ["Furia"],
    activadas: [
      {
        texto: "Mostrar un Aliado de tu mano: tu oponente Bota tres cartas y, si Botó un Oro o un Aliado, puedes poner un Oro de un Cementerio en tu Oro Pagado",
        momento: "tuTurno",
        veces: "turno",
        requiere: aliadoEnMano,
        hacer: [
          sel(["yo:mano"], { tipo: "Aliado" }, "m"),
          { op: "fn", f: "botar" },
          {
            op: "si",
            f: "botoOroAliado",
            entonces: [
              {
                op: "opcional",
                texto: "Poner un Oro de un Cementerio en tu Oro Pagado",
                requiere: { de: ["todos:cementerio"], filtro: { tipo: "Oro" } },
                pasos: [sel(["todos:cementerio"], { tipo: "Oro" }, "o"), { op: "ponerOro", var: "o", a: "pagado" }],
              },
            ],
          },
        ],
      },
    ],
    fns: {
      botar: (e, ctx) => {
        const r = N.rival(ctx.ctrl);
        const n = N.quitarDelCastillo(e, r, 3, "cementerio");
        ctx.vars.botadas = n ? e.jugadores[r].cementerio.slice(-n) : [];
      },
      botoOroAliado: (e, ctx) => (ctx.vars.botadas ?? []).some((u) => ["Oro", "Aliado"].includes(N.carta(e, u).tipo)),
    },
  },
  "Kuchiku Kan": {
    disparadas: [
      {
        cuando: ["entra"],
        hacer: [...buscar(["yo:castillo", "yo:cementerio"], { tipo: "Aliado" }), sel(["yo:aliados"], {}, "a", { n: 99 }), efecto("a", { tipo: "fuerza", n: 1 }, "mientras")],
      },
      { cuando: ["sale"], hacer: [{ op: "fn", f: "liberar" }] },
    ],
    activadas: [
      {
        texto: "Descartar una carta: una carta pierde su habilidad y no puede atacar ni bloquear mientras este Aliado esté en juego",
        veces: "turno",
        requiere: "conMano",
        coste: [sel(["yo:mano"], {}, "d"), mov("cementerio", "d")],
        hacer: [sel(["todos:enJuego"]), { op: "fn", f: "sujetar" }],
      },
    ],
    fns: {
      conMano: (e, ctx) => e.jugadores[ctx.ctrl].mano.length > 0,
      sujetar: (e, ctx) => {
        for (const uid of ctx.vars.x ?? []) {
          N.agregarEfecto(e, { tipo: "pierdeHabilidad", uid, origen: ctx.fuente, fin: "mientras" }, ctx.ctrl);
          N.agregarEfecto(e, { tipo: "noAtacarBloquear", uid, origen: ctx.fuente, fin: "mientras" }, ctx.ctrl);
        }
      },
      liberar: (e, ctx) => {
        e.efectos = e.efectos.filter((f) => f.origen !== ctx.fuente);
      },
    },
  },
  "Kuchiku el Cazador": {
    claves: ["Furia"],
    activadas: [
      {
        texto: "Buscar un Aliado en tu Castillo o Cementerio y jugarlo reduciendo su coste en un Oro",
        momento: "tuTurno",
        veces: "turno",
        hacer: [sel(["yo:castillo", "yo:cementerio"], { tipo: "Aliado", f: "pagable" }, "b"), { op: "fn", f: "jugar" }, barajar()],
      },
      {
        texto: "Destruir hasta una carta de coste 3 o menos y tu oponente Bota cartas igual a la Fuerza de este Aliado",
        momento: "tuTurno",
        veces: "turno",
        hacer: [sel(["todos:enJuego"], { costeMax: 3 }, "x", { hasta: true, para: "destruir" }), mov("destruir"), { op: "botar", nf: "fuerzaPropia", quien: "rival" }],
      },
    ],
    fns: {
      pagable: reducidoPagable,
      jugar: jugarReducido,
      fuerzaPropia: (e, ctx) => N.fuerza(e, ctx.fuente),
    },
  },
  "La Torre": {
    claves: ["Furia"],
    unoPorTurno: true,
    disparadas: [{ cuando: ["entra"], hacer: [sel(["yo:castillo", "yo:cementerio"], { tipo: "Aliado", costeMax: 2 }, "b"), { op: "jugarGratis", var: "b" }, barajar()] }],
    continuas: [{ a: "propia", fuerzaPor: "otros" }],
    fns: { otros: (e, ctx) => N.aliadosDe(e, ctx.ctrl).filter((u) => u !== ctx.fuente).length },
  },
  "Long John Silver": {
    activadas: [
      {
        texto: "Mostrar un Aliado de tu mano: tu oponente muestra cartas de su Castillo hasta mostrar dos Aliados y las pone en su Cementerio",
        momento: "tuTurno",
        veces: "turno",
        requiere: aliadoEnMano,
        hacer: [sel(["yo:mano"], { tipo: "Aliado" }, "m"), { op: "fn", f: "hastaDos" }],
      },
    ],
    fns: {
      hastaDos: (e, ctx) => {
        const r = N.rival(ctx.ctrl);
        const castillo = e.jugadores[r].castillo;
        let k = 0;
        let aliados = 0;
        while (k < castillo.length && aliados < 2) {
          if (N.carta(e, castillo[k]).tipo === "Aliado") aliados += 1;
          k += 1;
        }
        if (k) N.quitarDelCastillo(e, r, k, "cementerio");
      },
    },
  },
  "Los Marcados": {
    disparadas: [
      {
        cuando: ["entra"],
        opcional: true,
        hacer: [
          sel(["yo:cementerio"], { tipo: "Aliado" }, "a", { hasta: true }),
          sel(["yo:cementerio"], { tipo: "Arma" }, "w", { hasta: true }),
          mov("mano", "a"),
          mov("mano", "w"),
        ],
      },
    ],
    activadas: [
      {
        texto: "Desterrar este Aliado: tu oponente no puede declarar más de dos Aliados bloqueadores este turno",
        momento: "tuTurno",
        coste: [sel(["fuente"], {}, "yo"), mov("desterrar", "yo")],
        hacer: [{ op: "efecto", efecto: { tipo: "maxBloqueadores", n: 2 }, jugador: "rival", fin: "turno" }],
      },
      {
        texto: "Desterrarlo de tu Cementerio: tu oponente no puede declarar más de dos Aliados bloqueadores este turno",
        zona: "cementerio",
        momento: "tuTurno",
        coste: [sel(["fuente"], {}, "yo"), mov("desterrar", "yo")],
        hacer: [{ op: "efecto", efecto: { tipo: "maxBloqueadores", n: 2 }, jugador: "rival", fin: "turno" }],
      },
    ],
  },
  "Mariano Osorio": {
    claves: ["Furia"],
    disparadas: [
      {
        cuando: ["entra"],
        hacer: [
          { op: "tope", n: 2, como: "m" },
          { op: "si", f: "aliadoOArma", entonces: [sel(["todos:oros"], { conHabilidad: true }, "o"), efecto("o", { tipo: "pierdeHabilidad" }, "mientras")] },
          mov("mano", "m"),
        ],
      },
      { cuando: ["comienzoVigilia"], si: "libre", opcional: true, hacer: [{ op: "fn", f: "marcar" }, ...desterrarTres] },
      { cuando: ["faseFinal"], si: "libre", hacer: [{ op: "fn", f: "marcar" }, ...desterrarTres] },
    ],
    fns: {
      aliadoOArma: (e, ctx) => (ctx.vars.m ?? []).some((u) => ["Aliado", "Arma"].includes(N.carta(e, u).tipo)),
      libre: (e, ctx) => e.usos[`osorio|${ctx.fuente}`] !== e.turno && e.jugadores[N.rival(ctx.ctrl)].cementerio.length > 0,
      marcar: (e, ctx) => {
        e.usos[`osorio|${ctx.fuente}`] = e.turno;
      },
    },
  },
  "Mr Smee": {
    claves: ["Furia"],
    disparadas: [
      { cuando: ["entra"], hacer: [{ op: "botar", nf: "aliados", quien: "rival" }, sel(["rival:cementerio"], {}, "c", { n: 2 }), mov("desterrar", "c")] },
      { cuando: ["ataca"], hacer: [sel(["todos:enJuego"], { costeMax: 2 }), efecto("x", { tipo: "pierdeHabilidad" })] },
    ],
    fns: { aliados: nAliados },
  },
  Nimrod: {
    claves: ["Furia", "Imbloqueable"],
    disparadas: [
      {
        cuando: ["haceDano"],
        opcional: true,
        hacer: [
          sel(["fuente"], {}, "yo"),
          mov("barajar", "yo"),
          sel(["todos:cementerio"], {}, "c"),
          { op: "convertir", var: "c", en: "Aliado", fuerza: 3, a: "defensa" },
          efecto("c", { tipo: "impuestoTalisman" }, "mientras"),
        ],
      },
    ],
  },
  Orikalon: {
    claves: ["Furia"],
    portador: { fuerza: 2, claves: ["Imbloqueable"] },
    disparadas: [
      {
        cuando: ["entra"],
        opcional: true,
        hacer: [
          sel(["yo:cementerio"], { tipo: "Aliado" }, "a", { hasta: true }),
          sel(["yo:cementerio"], { tipo: "Oro" }, "o", { hasta: true }),
          mov("mano", "a"),
          mov("mano", "o"),
        ],
      },
      { cuando: ["sale"], hacer: [{ op: "si", f: "vuelve", entonces: [sel(["yo:aliados"], {}, "p"), { op: "fn", f: "portar" }] }] },
    ],
    fns: {
      vuelve: (e, ctx) => {
        const clave = `orikalon|${ctx.fuente}`;
        if (e.usos[clave]) {
          delete e.usos[clave];
          return false;
        }
        return ["cementerio", "destierro", "mano", "castillo"].includes(N.ubicar(e, ctx.fuente)?.zona);
      },
      portar: (e, ctx) => {
        const [p] = ctx.vars.p ?? [];
        const uid = ctx.fuente;
        if (!p || !armaCabe(e, p, uid)) return;
        e.conv[uid] = { tipo: "Arma", sinHabilidad: false };
        N.sacar(e, uid);
        (e.armas[p] ??= []).push(uid);
        e.usos[`orikalon|${uid}`] = true;
      },
    },
  },
  "Pablo Pincheira": {
    claves: ["Furia"],
    disparadas: [{ cuando: ["entra"], hacer: [robar(1)] }],
    activadas: [
      {
        texto: "Desterrarlo de tu mano: jugar un Aliado de tu mano pagando su coste",
        zona: "mano",
        momento: "vigilia",
        requiere: "puede",
        coste: [sel(["fuente"], {}, "yo"), mov("desterrar", "yo")],
        hacer: [sel(["yo:mano"], { tipo: "Aliado", f: "pagable" }, "a"), { op: "fn", f: "jugar" }],
      },
    ],
    fns: {
      pagable: (e, ctx, u) => u !== ctx.fuente && coste(e, u) <= disponibles(e, ctx.ctrl, "Aliado"),
      puede: (e, ctx) =>
        e.jugadores[ctx.ctrl].mano.some((u) => u !== ctx.fuente && N.carta(e, u).tipo === "Aliado" && coste(e, u) <= disponibles(e, ctx.ctrl, "Aliado")),
      jugar: (e, ctx) => {
        const j = ctx.ctrl;
        for (const uid of ctx.vars.a ?? []) {
          const n = coste(e, uid);
          if (!e.jugadores[j].mano.includes(uid) || n > disponibles(e, j, "Aliado")) continue;
          pagarOros(e, j, n, "Aliado");
          N.sacar(e, uid);
          contar(e, j, uid);
          N.disparar(e, "juega", { uid, j, tipo: "Aliado", pagado: true, desde: "mano" });
          e.pila.push({ uid, ctrl: j, coste: n, destierro: false, desde: "mano", cerrada: esPincheira(e, uid), anulado: false });
        }
      },
    },
  },
  "Príncipe Orion": {
    claves: ["Furia"],
    disparadas: [
      {
        cuando: ["entra"],
        hacer: [
          {
            op: "modo",
            opciones: [
              { texto: "Robar una carta", pasos: [robar(1)] },
              {
                texto: "Subir un Aliado de tu Cementerio a tu mano",
                requiere: { de: ["yo:cementerio"], filtro: { tipo: "Aliado" } },
                pasos: [sel(["yo:cementerio"], { tipo: "Aliado" }, "a"), mov("mano", "a")],
              },
            ],
          },
        ],
      },
    ],
  },
  "Príncipe Ur Nammu": {
    activadas: [
      {
        texto: "Mostrar las cinco primeras cartas de tu Castillo, jugar un Aliado de ahí reduciendo su coste en un Oro y Barajar el resto",
        momento: "vigilia",
        veces: "turno",
        hacer: [{ op: "tope", n: 5, como: "m" }, sel(["var:m"], { tipo: "Aliado", f: "pagable" }, "b", { hasta: true }), { op: "fn", f: "jugar" }, barajar()],
      },
      {
        texto: "Tu oponente Bota tantas cartas como Aliados controles",
        momento: "vigilia",
        veces: "turno",
        hacer: [{ op: "botar", nf: "aliados", quien: "rival" }],
      },
    ],
    fns: { pagable: reducidoPagable, jugar: jugarReducido, aliados: nAliados },
  },
  "Rosa Pincheira": {
    disparadas: [{ cuando: ["entra"], hacer: buscar(["yo:castillo"], { f: "pincheira" }) }],
    activadas: [
      {
        texto: "Desterrar una carta de tu Cementerio: tu oponente Bota cuatro cartas",
        veces: "turno",
        requiere: "conCementerio",
        coste: [sel(["yo:cementerio"], {}, "c"), mov("desterrar", "c")],
        hacer: [botar(4)],
      },
    ],
    fns: {
      pincheira: (e, ctx, u) => esPincheira(e, u),
      conCementerio: (e, ctx) => e.jugadores[ctx.ctrl].cementerio.length > 0,
    },
  },
  Rysei: {
    claves: ["Furia"],
    activadas: [
      {
        texto: "Mostrar cartas de tu Castillo hasta un Aliado de Fuerza 4 o más, ponerlo en tu mano y Barajar el resto",
        veces: "turno",
        hacer: [{ op: "mostrarHasta", n: 1, filtro: { tipo: "Aliado", f: "fuerte" }, como: "m" }, mov("mano", "m"), barajar()],
      },
    ],
    continuas: [{ a: "tusDemasAliados", fuerzaPor: "conFuria" }],
    fns: {
      fuerte: (e, ctx, u) => (N.carta(e, u).fuerza ?? 0) >= 4,
      conFuria: (e, ctx) => (N.tiene(e, ctx.objetivo, "Furia") ? 1 : 0),
    },
  },
};
