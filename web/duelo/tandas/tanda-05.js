import * as N from "../nucleo.js";
import { sel, mov, barajar, robar, efecto, buscar, coste } from "../formato.js";
import { disponibles } from "../efectos.js";

const botar = (n, quien = "rival") => ({ op: "botar", n, quien });

const sumandoTres = (para) => [sel(["todos:enJuego"], { costeMax: 3 }, "a", { hasta: true, para }), { op: "fn", f: "segundo" }];

const segundoSumando = (accion, para) => (e, ctx) => {
  const [a] = ctx.vars.a ?? [];
  if (!a) return [];
  return [sel(["todos:enJuego"], { costeMax: 3 - coste(e, a), excluir: [a] }, "a2", { hasta: true, para }), mov(accion, "a"), mov(accion, "a2")];
};

const jugarReducido = (minimo) => (e, ctx, api) => {
  const [uid] = ctx.vars.x ?? [];
  if (!uid) return;
  const desde = N.ubicar(e, uid)?.zona ?? null;
  api.pagarOros(e, ctx.ctrl, Math.max(minimo, coste(e, uid) - 1), "Aliado");
  N.disparar(e, "juega", { uid, j: ctx.ctrl, tipo: "Aliado", pagado: true, desde });
  return [{ op: "entrar", uid, datos: { pagado: true, desde } }];
};

const asequible = (minimo) => (e, ctx, u) => Math.max(minimo, coste(e, u) - 1) <= disponibles(e, ctx.ctrl, "Aliado");

const orosControlados = (e, ctx) => N.orosDe(e, ctx.ctrl).length;

const aliadosEnCementerio = (e, j) => e.jugadores[j].cementerio.filter((u) => N.carta(e, u).tipo === "Aliado").length;

export const HABILIDADES = {
  "Draig Ifang": {
    disparadas: [
      { cuando: ["entra"], opcional: true, hacer: [robar(1)] },
      { cuando: ["sale"], si: "soloDragones", opcional: true, hacer: buscar(["yo:castillo"], { tipo: "Oro" }, "pagado") },
    ],
    fns: {
      soloDragones: (e, ctx) =>
        ["cementerio", "castillo"].includes(N.ubicar(e, ctx.fuente)?.zona) && N.aliadosDe(e, ctx.ctrl).every((u) => (N.carta(e, u).razas ?? []).includes("Dragón")),
    },
  },
  "Draig Wych": {
    claves: ["Furia"],
    disparadas: [{ cuando: ["entra"], hacer: [{ op: "tope", n: 1, como: "t" }, { op: "convertir", var: "t", en: "Oro", a: "pagado" }] }],
  },
  "Duque Glauru": {
    claves: ["Furia", "Imbloqueable"],
    activadas: [
      {
        texto: "Pagar un Oro y mostrarlo de tu mano: buscar en tu Castillo un Aliado de coste 3 o más y ponerlo en tu mano",
        zona: "mano",
        oros: 1,
        requiere: "dosVeces",
        hacer: [{ op: "fn", f: "contar" }, ...buscar(["yo:castillo"], { tipo: "Aliado", costeMin: 3 })],
      },
    ],
    fns: {
      dosVeces: (e, ctx) => {
        const uso = e.usos[`glauru|${ctx.ctrl}`];
        return !uso || uso.turno !== e.turno || uso.n < 2;
      },
      contar: (e, ctx) => {
        const clave = `glauru|${ctx.ctrl}`;
        const uso = e.usos[clave];
        e.usos[clave] = { turno: e.turno, n: uso?.turno === e.turno ? uso.n + 1 : 1 };
      },
    },
  },
  Duvel: {
    claves: ["Exhumar"],
    activadas: [
      {
        texto: "Descartar una carta: Destruir una carta que no sea Oro o buscar un Aliado en tu Castillo",
        veces: "turno",
        requiere: "conMano",
        coste: [sel(["yo:mano"], {}, "d"), mov("cementerio", "d")],
        hacer: [
          {
            op: "modo",
            opciones: [
              {
                texto: "Destruir una carta que no sea Oro",
                requiere: { de: ["todos:enJuego"], filtro: { noTipo: ["Oro"] }, para: "destruir" },
                pasos: [sel(["todos:enJuego"], { noTipo: ["Oro"] }, "x", { para: "destruir" }), mov("destruir")],
              },
              { texto: "Buscar un Aliado en tu Castillo", pasos: buscar(["yo:castillo"], { tipo: "Aliado" }) },
            ],
          },
        ],
      },
      {
        texto: "Un Aliado gana Furia y 1 de Fuerza por el turno",
        veces: "turno",
        requiere: { de: ["todos:aliados"], filtro: {} },
        hacer: [sel(["todos:aliados"]), efecto("x", { tipo: "fuerza", n: 1 }, "turno"), efecto("x", { tipo: "gana", clave: "Furia" }, "turno")],
      },
    ],
    fns: { conMano: (e, ctx) => e.jugadores[ctx.ctrl].mano.length > 0 },
  },
  "Fenrir, Tenebris Desencadenado": {
    claves: ["Furia"],
    disparadas: [{ cuando: ["entra"], hacer: [robar(2), sel(["rival:castillo"], { f: "distinto" }, "a", { n: 2 }), mov("desterrar", "a"), barajar("rival")] }],
    fns: { distinto: (e, ctx, u) => !(ctx.vars.a ?? []).some((a) => N.carta(e, a).nombre === N.carta(e, u).nombre) },
  },
  "Gente Reptil": {
    claves: ["Exhumar", "Furia"],
    disparadas: [{ cuando: ["entra"], hacer: [sel(["todos:enJuego"], { noTipo: ["Oro"] }, "x", { n: 2, hasta: true, para: "destruir" }), mov("destruir")] }],
  },
  "Gran Dragón": {
    claves: ["Furia"],
    disparadas: [{ cuando: ["entra", "ataca"], hacer: sumandoTres() }],
    activadas: [
      {
        texto: "Mirar la mano oponente y poner un Oro de tu mano o Cementerio en tu Oro Pagado",
        veces: "turno",
        requiere: { de: ["yo:mano", "yo:cementerio"], filtro: { tipo: "Oro" } },
        hacer: [sel(["yo:mano", "yo:cementerio"], { tipo: "Oro" }, "o"), { op: "ponerOro", var: "o", a: "pagado" }],
      },
    ],
    continuas: [{ a: "propia", fuerzaPor: "orosPagados" }],
    fns: { segundo: segundoSumando("barajar"), orosPagados: (e, ctx) => e.jugadores[ctx.ctrl].pagado.length },
  },
  "Gusano Blanco": {
    claves: ["Exhumar"],
    activadas: [
      {
        texto: "Poner un Oro de tu mano o de un Cementerio en tu Reserva",
        momento: "tuTurno",
        veces: "turno",
        requiere: { de: ["yo:mano", "todos:cementerio"], filtro: { tipo: "Oro" } },
        hacer: [sel(["yo:mano", "todos:cementerio"], { tipo: "Oro" }, "o"), { op: "ponerOro", var: "o", a: "reserva" }],
      },
    ],
    disparadas: [{ cuando: ["rivalPoneOro"], quien: "yo", veces: 3, hacer: [botar(3)] }],
  },
  "Jabberwocky Desatado": {
    claves: ["Exhumar"],
    activadas: [
      {
        texto: "Desterrar un Aliado que controles: generar tantos Oros como su coste por el turno",
        veces: "turno",
        requiere: { de: ["yo:aliados"], filtro: {}, para: "desterrar" },
        hacer: [sel(["yo:aliados"], {}, "d", { para: "desterrar" }), { op: "fn", f: "generar" }],
      },
      {
        texto: "Robar tres cartas y Descartar una, o buscar un Aliado en tu Castillo",
        momento: "tuTurno",
        veces: "turno",
        hacer: [
          {
            op: "modo",
            opciones: [
              { texto: "Robar tres y Descartar una", pasos: [robar(3), sel(["yo:mano"], {}, "d"), mov("cementerio", "d")] },
              { texto: "Buscar un Aliado en tu Castillo", pasos: buscar(["yo:castillo"], { tipo: "Aliado" }) },
            ],
          },
        ],
      },
    ],
    fns: {
      generar: (e, ctx) => {
        const [d] = ctx.vars.d ?? [];
        if (!d) return [];
        const n = coste(e, d);
        return [mov("desterrar", "d"), ...(n > 0 ? [{ op: "generar", n }] : [])];
      },
    },
  },
  Jaculus: {
    disparadas: [
      {
        cuando: ["entra"],
        opcional: true,
        hacer: [sel(["yo:castillo"], { tipo: "Aliado", costeMin: 3, f: "dragon" }, "x"), { op: "fn", f: "jugar" }, barajar()],
      },
    ],
    activadas: [
      {
        texto: "Desterrarlo: Destruir una carta de coste 1 o menos",
        requiere: { de: ["todos:enJuego"], filtro: { costeMax: 1, noFuente: true }, para: "destruir" },
        coste: [sel(["fuente"], {}, "yo"), mov("desterrar", "yo")],
        hacer: [sel(["todos:enJuego"], { costeMax: 1 }, "x", { para: "destruir" }), mov("destruir")],
      },
      {
        texto: "Desterrarlo: Anular una carta de coste 1 o menos",
        respuesta: { anula: { costeMax: 1 } },
        coste: [sel(["fuente"], {}, "yo"), mov("desterrar", "yo")],
        hacer: [],
      },
    ],
    fns: {
      dragon: (e, ctx, u) => (N.carta(e, u).razas ?? []).includes("Dragón") && asequible(0)(e, ctx, u),
      jugar: jugarReducido(0),
    },
  },
  Jormundgander: {
    claves: ["Furia"],
    disparadas: [
      { cuando: ["entra"], hacer: [robar(1)] },
      { cuando: ["haceDano"], opcional: true, hacer: [sel(["fuente"], {}, "yo"), { op: "fn", f: "aOro" }] },
      { cuando: ["juega"], quien: "yo", si: "pagadoComoOro", hacer: [{ op: "fn", f: "aAliado" }] },
    ],
    fns: {
      aOro: (e, ctx) => [{ op: "convertir", var: "yo", en: "Oro", a: "pagado", como: ctx.def }, { op: "fn", f: "marcar" }],
      marcar: (e, ctx) => {
        if (e.conv[ctx.fuente]) e.conv[ctx.fuente].desde = e.turno;
      },
      pagadoComoOro: (e, ctx) =>
        ctx.datos.tipo === "Aliado" &&
        ctx.datos.pagado === true &&
        !!e.conv[ctx.fuente]?.como &&
        e.conv[ctx.fuente].desde !== e.turno &&
        e.jugadores[ctx.ctrl].pagado.includes(ctx.fuente),
      aAliado: (e, ctx) => {
        const u = ctx.fuente;
        if (!e.conv[u] || !e.jugadores[ctx.ctrl].pagado.includes(u)) return;
        delete e.conv[u];
        N.sacar(e, u);
        e.jugadores[ctx.ctrl].defensa.push(u);
        e.jugadores[ctx.ctrl].nuevos.push(u);
      },
    },
  },
  "La Última Bestia": {
    claves: ["Exhumar"],
    disparadas: [{ cuando: ["entra"], si: "noDeMano", hacer: [{ op: "generar", n: 1, tipos: ["Aliado"] }] }],
    activadas: [
      {
        texto: "Pagar un Oro: jugar un Aliado de tu Cementerio reduciendo su coste en un Oro (mínimo 1)",
        veces: "turno",
        oros: 1,
        requiere: "hayAliado",
        hacer: [{ op: "fn", f: "gastar" }, sel(["yo:cementerio"], { tipo: "Aliado", noFuente: true, f: "asequible" }, "x"), { op: "fn", f: "jugar" }],
      },
      {
        texto: "Pagar un Oro: Anular una carta",
        respuesta: { anula: {} },
        veces: "turno",
        oros: 1,
        hacer: [{ op: "fn", f: "gastar" }],
      },
    ],
    fns: {
      gastar: (e, ctx) => {
        for (const h of [0, 1]) e.usos[`${ctx.fuente}|${ctx.def}|${h}`] = e.turno;
      },
      noDeMano: (e, ctx) => ctx.datos.desde !== "mano",
      asequible: asequible(1),
      hayAliado: (e, ctx) => {
        const libres = disponibles(e, ctx.ctrl) - 1;
        return e.jugadores[ctx.ctrl].cementerio.some((u) => u !== ctx.fuente && N.carta(e, u).tipo === "Aliado" && Math.max(1, coste(e, u) - 1) <= libres);
      },
      jugar: jugarReducido(1),
    },
  },
  Leviathan: {
    claves: ["NoBarajable"],
    disparadas: [
      { cuando: ["entra"], hacer: [sel(["todos:enJuego"], { noTipo: ["Oro"] }, "x", { n: 2, hasta: true, para: "desterrar" }), mov("desterrar"), robar(2)] },
      { cuando: ["ataca"], quien: "rival", hacer: [{ op: "fn", f: "sinDano" }] },
    ],
    activadas: [
      {
        texto: "Destruir un Oro que controles: ganar el control de un Oro oponente (se baraja en tu Fase Final)",
        veces: "turno",
        requiere: "puedeTomar",
        coste: [sel(["yo:oros"], {}, "d", { para: "destruir" }), mov("destruir", "d")],
        hacer: [sel(["rival:oros"], {}, "o", { para: "tomar" }), { op: "fn", f: "tomar" }],
      },
    ],
    fns: {
      sinDano: (e, ctx) => {
        N.agregarEfecto(e, { tipo: "sinDano", uid: ctx.datos.uid }, ctx.ctrl);
      },
      puedeTomar: (e, ctx) => N.orosDe(e, ctx.ctrl).length > 0 && N.orosDe(e, N.rival(ctx.ctrl)).some((u) => N.puedeTomar(e, u, ctx.ctrl)),
      tomar: (e, ctx) => {
        const pasos = [];
        for (const u of ctx.vars.o ?? []) {
          if (!N.puedeTomar(e, u, ctx.ctrl)) continue;
          N.mover(e, u, N.ubicar(e, u).zona, { j: ctx.ctrl });
          pasos.push({ op: "fn", f: "barajarTomado", uid: u });
        }
        return pasos.length ? [{ op: "diferir", cuando: "faseFinalPropia", pasos }] : [];
      },
      barajarTomado: (e, ctx, api, p) => {
        if (!N.enJuego(e, p.uid) || N.controlador(e, p.uid) !== ctx.ctrl) return;
        N.mover(e, p.uid, "castillo");
        N.barajarCastillo(e, N.dueno(p.uid));
      },
    },
  },
  Lluhay: {
    continuas: [{ proteccion: { por: ["Aliado"] }, a: "propia" }],
    disparadas: [{ cuando: ["entra"], quien: "yo", veces: 2, si: "dragon", hacer: [{ op: "botar", nf: "fuerzaEntrante", quien: "rival" }] }],
    fns: {
      dragon: (e, ctx) => {
        const c = N.carta(e, ctx.datos.uid);
        return c.tipo === "Aliado" && (c.razas ?? []).includes("Dragón");
      },
      fuerzaEntrante: (e, ctx) => N.fuerza(e, ctx.datos.uid),
    },
  },
  "Lord Ruthven": {
    claves: ["Exhumar"],
    disparadas: [
      {
        cuando: ["entra", "haceDano"],
        hacer: [
          {
            op: "opcional",
            texto: "Poner un Oro de tu mano en tu Oro Pagado",
            requiere: { de: ["yo:mano"], filtro: { tipo: "Oro" } },
            pasos: [sel(["yo:mano"], { tipo: "Oro" }, "o"), { op: "ponerOro", var: "o", a: "pagado" }],
          },
        ],
      },
    ],
    activadas: [
      {
        texto: "Buscar hasta tres cartas de distinto tipo en cada Castillo y ponerlas en el Cementerio o Destierro de su dueño",
        veces: "turno",
        hacer: [
          sel(["yo:castillo"], { f: "distintoA" }, "a", { n: 3, hasta: true }),
          sel(["rival:castillo"], { f: "distintoB" }, "b", { n: 3, hasta: true }),
          { op: "fn", f: "juntar" },
          {
            op: "modo",
            opciones: [
              { texto: "Cementerio", pasos: [mov("cementerio", "c")] },
              { texto: "Destierro", pasos: [mov("desterrar", "c")] },
            ],
          },
          barajar(),
          barajar("rival"),
        ],
      },
    ],
    fns: {
      distintoA: (e, ctx, u) => !(ctx.vars.a ?? []).some((x) => N.carta(e, x).tipo === N.carta(e, u).tipo),
      distintoB: (e, ctx, u) => !(ctx.vars.b ?? []).some((x) => N.carta(e, x).tipo === N.carta(e, u).tipo),
      juntar: (e, ctx) => {
        ctx.vars.c = [...(ctx.vars.a ?? []), ...(ctx.vars.b ?? [])];
      },
    },
  },
  "Mordred, el Traidor Tenebris": {
    claves: ["Exhumar"],
    activadas: [
      {
        texto: "Desterrar hasta tantas cartas del Cementerio oponente como Oros controles; un Aliado gana Furia y 1 de Fuerza por cada Aliado en el Destierro oponente",
        momento: "vigilia",
        veces: "turno",
        hacer: [sel(["rival:cementerio"], {}, "c", { nf: "nOros", hasta: true }), mov("desterrar", "c"), sel(["todos:aliados"], {}, "a"), { op: "fn", f: "potenciar" }],
      },
    ],
    fns: {
      nOros: orosControlados,
      potenciar: (e, ctx) => {
        const n = e.jugadores[N.rival(ctx.ctrl)].destierro.filter((u) => N.carta(e, u).tipo === "Aliado").length;
        for (const a of ctx.vars.a ?? []) {
          N.agregarEfecto(e, { tipo: "gana", clave: "Furia", uid: a }, ctx.ctrl);
          if (n) N.agregarEfecto(e, { tipo: "fuerza", n, uid: a }, ctx.ctrl);
        }
      },
    },
  },
  Nefandos: {
    claves: ["Furia", "Exhumar"],
    disparadas: [{ cuando: ["entra"], opcional: true, hacer: [sel(["yo:mano", "yo:cementerio"], { tipo: "Aliado", costeMax: 2 }, "x"), { op: "jugarGratis", var: "x" }] }],
    continuas: [{ gana: "Indesterrable", a: "tusDemasAliados" }, { gana: "DanoAlDestierro", a: "tusDemasAliados" }],
  },
  Nguruvilu: {
    claves: ["Furia", "Imbloqueable", "NoAnulable"],
    reduce: "red",
    disparadas: [{ cuando: ["entra"], si: "pagado", hacer: [{ op: "robar", nf: "pagados" }] }],
    fns: {
      red: (e, ctx) => Math.min(5, N.orosDe(e, ctx.ctrl).length + aliadosEnCementerio(e, ctx.ctrl)),
      pagado: (e, ctx) => ctx.datos.pagado === true,
      pagados: (e, ctx) => 8 - Math.min(5, N.orosDe(e, ctx.ctrl).length + aliadosEnCementerio(e, ctx.ctrl)),
    },
  },
  "Noth-Yidik": {
    claves: ["Furia"],
    disparadas: [
      { cuando: ["entra"], hacer: [robar(3)] },
      { cuando: ["faseFinal"], quien: "cualquiera", hacer: [sel(["todos:cementerio"], {}, "c", { n: 5, hasta: true }), mov("desterrar", "c")] },
    ],
    continuas: [{ fuerza: 2, a: "tusAliados" }, { gana: "Imbloqueable", a: "tusAliados" }],
  },
  Pihuchen: {
    claves: ["NoPierdeHabilidad"],
    reduce: "red",
    disparadas: [{ cuando: ["entra"], quien: "cualquiera", si: "barato", hacer: [{ op: "fn", f: "desterrarDos" }] }],
    fns: {
      red: (e, ctx) => Math.min(2, N.orosDe(e, ctx.ctrl).length),
      barato: (e, ctx) => {
        const c = N.carta(e, ctx.datos.uid);
        return c.tipo === "Aliado" && (c.coste ?? 0) <= 2;
      },
      desterrarDos: (e, ctx) => {
        N.quitarDelCastillo(e, ctx.datos.j, 2, "destierro");
      },
    },
  },
  Piruquina: {
    claves: ["Furia"],
    reduce: "red",
    activadas: [
      {
        texto: "Pagar un Oro y ponerlo al fondo de tu Castillo: reducir a cero el próximo daño a tu Castillo",
        zona: "mano",
        oros: 1,
        hacer: [sel(["fuente"], {}, "yo"), mov("fondo", "yo"), { op: "fn", f: "prevenir" }],
      },
    ],
    fns: {
      red: orosControlados,
      prevenir: (e, ctx) => {
        N.agregarEfecto(e, { tipo: "prevenirDano", j: ctx.ctrl, unaVez: true, fin: "juego" }, ctx.ctrl);
      },
    },
  },
  "Quetzalcóatl, el Sol Tenebris": {
    claves: ["Furia", "Exhumar", "NoAnulable", "NoPierdeHabilidad"],
    disparadas: [{ cuando: ["entra"], opcional: true, hacer: [sel(["yo:cementerio"], {}, "c", { n: 2, hasta: true }), mov("mano", "c")] }],
    activadas: [
      {
        texto: "Barajar hasta seis cartas de los Cementerios y Robar dos cartas",
        veces: "turno",
        hacer: [sel(["todos:cementerio"], {}, "c", { n: 6, hasta: true }), mov("barajar", "c"), robar(2)],
      },
    ],
  },
  "Ryujin el Atormentador": {
    claves: ["Exhumar", "Furia"],
    costeAlternativo: { botar: 4, reduce: 1 },
    disparadas: [{ cuando: ["ataca"], hacer: sumandoTres("desterrar") }],
    activadas: [
      {
        texto: "Barajar hasta tres cartas de tu Cementerio y Robar dos cartas",
        veces: "turno",
        hacer: [sel(["yo:cementerio"], {}, "c", { n: 3, hasta: true }), mov("barajar", "c"), robar(2)],
      },
    ],
    fns: { segundo: segundoSumando("desterrar", "desterrar") },
  },
  "Serpiente Verde": {
    activadas: [
      {
        texto: "Destruirlo: generar un Oro para jugar Aliados de coste 3 o más",
        coste: [sel(["fuente"], {}, "yo"), mov("destruir", "yo")],
        hacer: [{ op: "generar", n: 1, tipos: ["Aliado"], costeMin: 3 }],
      },
    ],
    disparadas: [
      {
        cuando: ["alCementerio"],
        quien: "propia",
        zona: ["cementerio"],
        si: "sinBaratos",
        opcional: true,
        hacer: [sel(["todos:cementerio"], {}, "c", { n: 4, hasta: true }), mov("barajar", "c")],
      },
    ],
    fns: { sinBaratos: (e, ctx) => !N.aliadosDe(e, ctx.ctrl).some((u) => coste(e, u) <= 1) },
  },
  Shaatan: {
    reduce: "red",
    activadas: [
      { texto: "Tu oponente Bota una carta por cada Oro que controles", veces: "turno", hacer: [{ op: "botar", nf: "nOros", quien: "rival" }] },
      {
        texto: "Destruir una carta que controles: subirlo de tu Cementerio a tu mano",
        zona: "cementerio",
        requiere: { de: ["yo:enJuego"], filtro: {}, para: "destruir" },
        coste: [sel(["yo:enJuego"], {}, "d", { para: "destruir" }), mov("destruir", "d")],
        hacer: [sel(["fuente"], {}, "yo"), mov("mano", "yo")],
      },
    ],
    fns: {
      red: (e, ctx) => (aliadosEnCementerio(e, ctx.ctrl) >= 3 ? 2 : 0),
      nOros: orosControlados,
    },
  },
};
