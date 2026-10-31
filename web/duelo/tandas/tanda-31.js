import * as N from "../nucleo.js";
import { sel, mov, barajar, robar, efecto, buscar, castilloElegido, coste } from "../formato.js";

const esJinete = (e, u) => N.carta(e, u).nombre.includes("Jinete");
const jinetes = (e, j) => N.aliadosDe(e, j).filter((u) => esJinete(e, u));
const otroJinete = (e, ctx) => jinetes(e, ctx.ctrl).some((u) => u !== ctx.fuente);
const cuatroJinetes = (e, ctx) => jinetes(e, ctx.ctrl).length >= 4;
const unica = (e, ctx) => !N.enJuegoDe(e, ctx.ctrl).some((u) => N.carta(e, u).nombre === N.def(e, ctx.def).nombre);
const soloEsta = (e, ctx) => N.aliadosDe(e, ctx.ctrl).every((u) => u === ctx.fuente);
const conMano = (e, ctx) => e.jugadores[ctx.ctrl].mano.length > 0;

const parejaAlEntrar = (nombre) => ({
  disparadas: [{ cuando: ["entra"], hacer: [...buscar(["yo:castillo"], { f: "pareja" }), { op: "si", f: "solo", entonces: [{ op: "jugarGratis", var: "b" }] }] }],
  fns: { pareja: (e, ctx, u) => N.carta(e, u).nombre === nombre, solo: soloEsta },
});

const cementerioElegido = (pasosPara) => ({
  op: "modo",
  opciones: [
    { texto: "tu Cementerio", pasos: pasosPara("yo") },
    { texto: "Cementerio oponente", pasos: pasosPara("rival") },
  ],
});

const adan = parejaAlEntrar("Eva");
const eva = parejaAlEntrar("Adan");

export const HABILIDADES = {
  "Xanadú": {
    activadas: [{ texto: "Si controlas dos o más Tótem, Robar una carta", veces: "turno", requiere: "dosTotems", hacer: [robar(1)] }],
    fns: { dosTotems: (e, ctx) => e.jugadores[ctx.ctrl].apoyo.filter((u) => N.carta(e, u).tipo === "Tótem").length >= 2 },
  },
  Yggdrasil: {
    requiere: "unica",
    disparadas: [
      { cuando: ["entra"], hacer: [sel(["todos:aliados"], {}, "x", { n: 99 }), mov("barajar", "x")] },
      { cuando: ["faseFinal"], hacer: [{ op: "fn", f: "revertir" }] },
    ],
    activadas: [
      {
        texto: "Convertir un Tótem que controles en un Aliado con Fuerza igual a su coste hasta la Fase Final",
        momento: "vigilia",
        veces: "turno",
        requiere: { de: ["yo:apoyo"], filtro: { tipo: "Tótem" } },
        hacer: [sel(["yo:apoyo"], { tipo: "Tótem" }, "t"), { op: "fn", f: "animar" }],
      },
    ],
    fns: {
      unica,
      animar: (e, ctx) => {
        for (const u of ctx.vars.t ?? []) {
          const c = coste(e, u);
          N.mover(e, u, "defensa", { j: ctx.ctrl });
          e.conv[u] = { tipo: "Aliado", fuerza: c, coste: c, sinHabilidad: false, totemDe: ctx.fuente };
        }
      },
      revertir: (e, ctx) => {
        for (const [u, c] of Object.entries(e.conv)) {
          if (c.totemDe !== ctx.fuente) continue;
          delete e.conv[u];
          if (N.enJuego(e, u)) N.mover(e, u, "apoyo", { j: N.controlador(e, u) });
        }
      },
    },
  },
  Adan: {
    disparadas: adan.disparadas,
    activadas: [
      {
        texto: "Poner hasta dos cartas de tu mano en el fondo de tu Castillo y Robar esa misma cantidad",
        veces: "turno",
        requiere: "conMano",
        hacer: [sel(["yo:mano"], {}, "x", { n: 2, hasta: true }), mov("fondo", "x"), { op: "robar", nf: "tantas" }],
      },
    ],
    fns: { ...adan.fns, conMano, tantas: (e, ctx) => (ctx.vars.x ?? []).length },
  },
  "Alicia en Wonderland": {
    disparadas: [
      { cuando: ["entra"], hacer: [{ op: "fn", f: "mostrar" }, mov("mano", "m")] },
      { cuando: ["entra"], hacer: [sel(["todos:enJuego", "rival:mano", "rival:cementerio"], { noFuente: true }, "n"), { op: "fn", f: "nombrar" }] },
      { cuando: ["sale"], hacer: [{ op: "fn", f: "liberar" }] },
    ],
    fns: {
      mostrar: (e, ctx) => {
        const hallados = [];
        for (const u of e.jugadores[ctx.ctrl].castillo) {
          if (N.carta(e, u).tipo !== "Aliado" || hallados.some((h) => coste(e, h) === coste(e, u))) continue;
          hallados.push(u);
          if (hallados.length >= 2) break;
        }
        ctx.vars.m = hallados;
      },
      nombrar: (e, ctx) => {
        for (const u of ctx.vars.n ?? []) N.agregarEfecto(e, { tipo: "pierdeHabilidad", nombre: N.carta(e, u).nombre, origen: ctx.fuente, fin: "juego" }, ctx.ctrl);
      },
      liberar: (e, ctx) => {
        e.efectos = e.efectos.filter((f) => f.origen !== ctx.fuente);
      },
    },
  },
  "Arturo Prat - Sp": {
    activadas: [
      {
        texto: "Intercambiar el control de una carta que controles por una oponente que cueste hasta un Oro más",
        veces: "turno",
        requiere: "hayPar",
        hacer: [sel(["yo:enJuego"], { f: "cedible" }, "a"), sel(["rival:enJuego"], { f: "tomable" }, "b", { para: "tomar" }), { op: "fn", f: "intercambiar" }],
      },
    ],
    disparadas: [
      {
        cuando: ["entra"],
        quien: "yo",
        veces: 3,
        si: "esAliado",
        hacer: [sel(["todos:cementerio"], {}, "c", { hasta: true }), mov("barajar", "c"), robar(1)],
      },
    ],
    fns: {
      cedible: (e, ctx, u) => N.carta(e, u).tipo !== "Arma" && N.puedeTomar(e, u, N.rival(ctx.ctrl)),
      tomable: (e, ctx, u) => {
        const [a] = ctx.vars.a ?? [];
        return N.carta(e, u).tipo !== "Arma" && coste(e, u) <= (a ? coste(e, a) : 0) + 1;
      },
      hayPar: (e, ctx) => {
        const mias = N.enJuegoDe(e, ctx.ctrl).filter((u) => N.carta(e, u).tipo !== "Arma" && N.puedeTomar(e, u, N.rival(ctx.ctrl)));
        const suyas = N.enJuegoDe(e, N.rival(ctx.ctrl)).filter((u) => N.carta(e, u).tipo !== "Arma" && N.puedeTomar(e, u, ctx.ctrl));
        return mias.some((a) => suyas.some((b) => coste(e, b) <= coste(e, a) + 1));
      },
      intercambiar: (e, ctx) => {
        const [a] = ctx.vars.a ?? [];
        const [b] = ctx.vars.b ?? [];
        if (!a || !b) return;
        const za = N.ubicar(e, a).zona;
        const zb = N.ubicar(e, b).zona;
        N.mover(e, a, za === "ataque" ? "defensa" : za, { j: N.rival(ctx.ctrl) });
        N.mover(e, b, zb === "ataque" ? "defensa" : zb, { j: ctx.ctrl });
      },
      esAliado: (e, ctx) => N.carta(e, ctx.datos.uid).tipo === "Aliado",
    },
  },
  "Ava Rei Pua": {
    claves: ["NoBarajable"],
  },
  Belial: {
    activadas: [
      {
        texto: "Botar dos cartas para subirlo de tu Cementerio a tu mano",
        zona: "cementerio",
        veces: "turnoNombre",
        requiere: "puedeBotar",
        coste: [{ op: "botar", n: 2, quien: "yo" }],
        hacer: [sel(["fuente"], {}, "yo"), mov("mano", "yo")],
      },
    ],
    disparadas: [
      {
        cuando: ["entra"],
        hacer: [sel(["todos:enJuego"], { costeMax: 2 }, "x", { hasta: true, para: "desterrar" }), mov("desterrar"), robar(1)],
      },
    ],
    fns: { puedeBotar: (e, ctx) => e.jugadores[ctx.ctrl].castillo.length > 2 },
  },
  "Cleopatra VII": {
    claves: ["Indestructible"],
  },
  "Don Quijote": {
    claves: ["Exhumar", "Indesterrable"],
    disparadas: [{ cuando: ["entra"], opcional: true, hacer: [sel(["yo:castillo"], { noTipo: ["Talismán"] }, "b", { n: 2 }), mov("mano", "b"), barajar()] }],
    activadas: [{ texto: "Robar dos cartas", veces: "turno", hacer: [robar(2)] }],
  },
  "Espiritu Kotaix": {
    claves: ["Indesterrable"],
    activadas: [{ texto: "Robar dos cartas y Barajar una carta oponente que no sea Oro", veces: "turno", hacer: [robar(2), sel(["rival:enJuego"], { noTipo: ["Oro"] }), mov("barajar")] }],
    continuas: [{ fuerza: 2, a: "tusAliados" }, { gana: "Furia", a: "tusAliados" }],
  },
  Eva: {
    disparadas: eva.disparadas,
    activadas: [
      {
        texto: "Pagar un Oro: buscar un Aliado y un Talismán en tu Castillo",
        momento: "vigilia",
        veces: "turno",
        oros: 1,
        hacer: [sel(["yo:castillo"], { tipo: "Aliado" }, "a"), sel(["yo:castillo"], { tipo: "Talismán" }, "t"), mov("mano", "a"), mov("mano", "t"), barajar()],
      },
    ],
    continuas: [{ fuerza: 1, a: "tusAliados" }],
    fns: eva.fns,
  },
  "Guerrillero Rodriguez": {
    claves: ["Indestructible"],
    disparadas: [{ cuando: ["entra"], hacer: [robar(1)] }],
  },
  "Hijo de la Rebeldia": {
    claves: ["Furia", "Imbloqueable"],
    disparadas: [
      { zona: ["cementerio"], cuando: ["anulada"], quien: "propia", hacer: buscar(["yo:castillo"], {}) },
      { cuando: ["sale"], si: "desterrado", hacer: buscar(["yo:castillo"], {}) },
      { cuando: ["comienzoVigilia"], quien: "cualquiera", hacer: [{ op: "fn", f: "obligar" }] },
    ],
    fns: {
      desterrado: (e, ctx) => N.ubicar(e, ctx.fuente)?.zona === "destierro",
      obligar: (e) => {
        for (const u of N.aliadosDe(e, e.activo)) N.agregarEfecto(e, { tipo: "debeAtacar", uid: u }, e.activo);
      },
    },
  },
  "Ivi Atua": {
    claves: ["NoBarajable"],
    activadas: [
      {
        texto: "Desterrar hasta dos cartas cuyos costes sumen hasta 2 y Robar dos cartas",
        momento: "tuTurno",
        veces: "turno",
        hacer: [sel(["todos:enJuego"], { costeMax: 2 }, "a", { hasta: true, para: "desterrar" }), { op: "fn", f: "segundo" }],
      },
      {
        texto: "Barajar una carta de tu mano: no recibes daño de combate hasta tu próximo turno",
        veces: "turno",
        requiere: "conMano",
        coste: [sel(["yo:mano"], {}, "c"), mov("barajar", "c")],
        hacer: [{ op: "efecto", efecto: { tipo: "prevenirDano" }, jugador: "yo", fin: "proximoTurno" }],
      },
    ],
    fns: {
      conMano,
      segundo: (e, ctx) => {
        const [a] = ctx.vars.a ?? [];
        const resto = a ? [sel(["todos:enJuego"], { costeMax: 2 - coste(e, a), excluir: [a] }, "a2", { hasta: true, para: "desterrar" })] : [];
        return [...resto, mov("desterrar", "a"), mov("desterrar", "a2"), robar(2)];
      },
    },
  },
  "Jinete de la Guerra": {
    claves: ["Exhumar", "Furia"],
    activadas: [
      {
        texto: "Destruir hasta una carta de coste 1 o menos (si controlas otro Jinete, además buscar un Jinete en tu Castillo o Cementerio)",
        momento: "tuTurno",
        veces: "turno",
        hacer: [
          sel(["todos:enJuego"], { costeMax: 1 }, "x", { hasta: true, para: "destruir" }),
          mov("destruir"),
          { op: "si", f: "otroJinete", entonces: [sel(["yo:castillo", "yo:cementerio"], { f: "jinete" }, "j"), mov("mano", "j"), barajar()] },
        ],
      },
    ],
    continuas: [
      { si: "cuatro", gana: "Furia", a: "tusAliados" },
      { si: "cuatro", gana: "DanoAlDestierro", a: "tusAliados" },
    ],
    fns: { otroJinete, cuatro: cuatroJinetes, jinete: (e, ctx, u) => esJinete(e, u) },
  },
  "Jinete de la Muerte": {
    claves: ["Exhumar", "Indesterrable"],
    activadas: [
      {
        texto: "Desterrar una carta que no sea Oro (con cuatro Aliados Jinete, las cartas que no sean Jinete ni Oro pierden su habilidad y son Destruidas)",
        veces: "turno",
        hacer: [{ op: "si", f: "cuatro", entonces: [{ op: "fn", f: "arrasar" }], sino: [sel(["todos:enJuego"], { noTipo: ["Oro"] }, "x", { para: "desterrar" }), mov("desterrar")] }],
      },
    ],
    fns: {
      cuatro: cuatroJinetes,
      arrasar: (e, ctx) => {
        ctx.vars.z = N.todoEnJuego(e).filter((u) => N.carta(e, u).tipo !== "Oro" && !esJinete(e, u));
        return [efecto("z", { tipo: "pierdeHabilidad" }, "mientras"), mov("destruir", "z")];
      },
    },
  },
  "Jinete de la Peste": {
    claves: ["Exhumar", "Imbloqueable"],
    activadas: [
      {
        texto: "Buscar en un Castillo dos cartas de distinto nombre y Desterrarlas (si controlas otro Jinete, además Robar una carta)",
        veces: "turno",
        hacer: [
          castilloElegido((quien) => [sel([`${quien}:castillo`], {}, "a"), sel([`${quien}:castillo`], { f: "distinto" }, "b"), mov("desterrar", "a"), mov("desterrar", "b"), barajar(quien)]),
          { op: "si", f: "otroJinete", entonces: [robar(1)] },
        ],
      },
    ],
    fns: {
      otroJinete,
      distinto: (e, ctx, u) => !(ctx.vars.a ?? []).some((a) => N.carta(e, a).nombre === N.carta(e, u).nombre),
    },
  },
  "Jinete del Hambre": {
    claves: ["Exhumar", "Indestructible"],
    activadas: [
      {
        texto: "Desterrar una carta de tu mano: un Jinete no sale del juego este turno o Robar una carta (si controlas otro Jinete, tu oponente Descarta una carta)",
        veces: "turno",
        requiere: "conMano",
        coste: [sel(["yo:mano"], {}, "c"), mov("desterrar", "c")],
        hacer: [
          {
            op: "modo",
            opciones: [
              { texto: "Un Jinete no puede salir del juego este turno", requiere: { de: ["yo:aliados"], filtro: { f: "jinete" } }, pasos: [sel(["yo:aliados"], { f: "jinete" }, "j"), efecto("j", { tipo: "noSale" })] },
              { texto: "Robar una carta", pasos: [robar(1)] },
            ],
          },
          { op: "si", f: "otroJinete", entonces: [sel(["rival:mano"], {}, "d", { quien: "rival" }), mov("cementerio", "d")] },
        ],
      },
    ],
    fns: { otroJinete, conMano, jinete: (e, ctx, u) => esJinete(e, u) },
  },
  "Jonathan Harker": {
    activadas: [
      {
        texto: "Barajar un Arma de coste 1 o más que controles para jugar un Arma de coste 1 o más de tu mano o Cementerio pagando un Oro menos",
        momento: "vigilia",
        veces: "turno",
        requiere: "puedeCambiar",
        coste: [sel(["yo:armas"], { costeMin: 1 }, "v"), mov("barajar", "v")],
        hacer: [sel(["yo:mano", "yo:cementerio"], { tipo: "Arma", costeMin: 1, f: "pagable" }, "a"), { op: "fn", f: "jugarArma" }],
      },
    ],
    fns: {
      pagable: (e, ctx, u) => Math.max(0, coste(e, u) - 1) <= e.jugadores[ctx.ctrl].reserva.length,
      puedeCambiar: (e, ctx) => {
        const p = e.jugadores[ctx.ctrl];
        if (!N.armasDe(e, ctx.ctrl).some((u) => coste(e, u) >= 1)) return false;
        return [...p.mano, ...p.cementerio].some((u) => N.carta(e, u).tipo === "Arma" && coste(e, u) >= 1 && coste(e, u) - 1 <= p.reserva.length);
      },
      jugarArma: (e, ctx, api) => {
        const [a] = ctx.vars.a ?? [];
        if (!a) return;
        const desde = N.ubicar(e, a).zona;
        api.pagarOros(e, ctx.ctrl, Math.max(0, coste(e, a) - 1), "Arma");
        N.disparar(e, "juega", { uid: a, j: ctx.ctrl, tipo: "Arma", pagado: true, desde });
        return [sel(["yo:aliados"], { armaLibre: a }, "_port"), { op: "portar", arma: a, en: "_port", datos: { pagado: true, desde } }];
      },
    },
  },
  Jupitris: {
    claves: ["Furia", "Imbloqueable", "Indestructible"],
    disparadas: [
      {
        cuando: ["entra"],
        hacer: [{ op: "efecto", efecto: { tipo: "prevenirDano" }, jugador: "yo", fin: "proximoTurno" }, { op: "opcional", texto: "Robar tres cartas", pasos: [robar(3)] }],
      },
    ],
    activadas: [
      {
        texto: "Barajar un Aliado oponente y tres cartas de un Cementerio",
        veces: "turno",
        hacer: [
          sel(["rival:aliados"]),
          mov("barajar"),
          cementerioElegido((quien) => [sel([`${quien}:cementerio`], {}, "c", { n: 3 }), mov("barajar", "c")]),
          { op: "si", f: "cinco", entonces: [castilloElegido((quien) => [{ op: "desterrarTope", n: 10, quien }])] },
        ],
      },
    ],
    fns: {
      cinco: (e, ctx) => {
        const nombres = new Set(N.enJuegoDe(e, ctx.ctrl).map((u) => N.carta(e, u).nombre));
        return ["Argo", "Belta", "Bullnax", "Lycón", "Pallaz"].every((n) => nombres.has(n));
      },
    },
  },
  "La Catrina": {
    claves: ["Exhumar"],
    disparadas: [
      {
        cuando: ["entra"],
        hacer: [sel(["rival:enJuego"], { noTipo: ["Oro"] }, "x", { n: 99 }), mov("barajar"), { op: "desterrarTope", quien: "rival", nf: "orosRival" }],
      },
    ],
    continuas: [{ cementerioRivalSinHabilidad: true }],
    fns: { orosRival: (e, ctx) => N.orosDe(e, N.rival(ctx.ctrl)).length },
  },
  "La Serpiente del Eden": {
    claves: ["Furia"],
    disparadas: [
      { cuando: ["entra"], hacer: buscar(["yo:castillo"], { noTipo: ["Talismán"] }) },
      {
        cuando: ["faseFinal"],
        hacer: [
          sel(["todos:cementerio"], {}, "c", { n: 2, hasta: true }),
          mov("barajar", "c"),
          sel(["todos:cementerio"], {}, "d", { nf: "resto", hasta: true }),
          mov("desterrar", "d"),
          robar(1),
        ],
      },
      { cuando: ["sale"], si: "destruido", hacer: [{ op: "botar", n: 3, quien: "rival" }] },
    ],
    fns: {
      resto: (e, ctx) => 2 - (ctx.vars.c ?? []).length,
      destruido: (e, ctx) => N.ubicar(e, ctx.fuente)?.zona === "cementerio",
    },
  },
  "Lucifer el Caido": {
    claves: ["Exhumar", "Indesterrable"],
    disparadas: [
      { cuando: ["entra"], hacer: [sel(["rival:aliados"], {}, "x", { n: 99, para: "desterrar" }), mov("desterrar")] },
      { cuando: ["entra"], quien: "yo", veces: 2, si: "oroOCementerio", hacer: [sel(["todos:enJuego"]), efecto("x", { tipo: "pierdeHabilidad" }, "proximoTurno")] },
    ],
    fns: { oroOCementerio: (e, ctx) => N.carta(e, ctx.datos.uid).tipo === "Oro" || ctx.datos.desde === "cementerio" },
  },
  Malevolente: {
    requiere: "unica",
    fns: { unica },
  },
  Metalmorfo: {
    claves: ["Furia"],
    disparadas: [{ cuando: ["entra"], hacer: [{ op: "mostrarHasta", tipos: ["Aliado", "Arma"], como: "m" }, mov("mano", "m"), barajar()] }],
    activadas: [
      {
        texto: "Un Aliado es Imbloqueable y hace daño al Destierro este turno",
        veces: "turno",
        requiere: { de: ["todos:aliados"], filtro: {} },
        hacer: [sel(["todos:aliados"]), efecto("x", { tipo: "gana", clave: "Imbloqueable" }), efecto("x", { tipo: "gana", clave: "DanoAlDestierro" })],
      },
    ],
  },
};
