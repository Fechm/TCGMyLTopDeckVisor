import * as N from "../nucleo.js";
import { sel, mov, barajar, robar, efecto, buscar, castilloElegido, coste } from "../formato.js";

const desdeLaFuente = (a) => [sel(["fuente"], {}, "yo"), mov(a, "yo")];

const barajarYDesterrar = (n) => [
  sel(["todos:cementerio"], {}, "c", { n, hasta: true }),
  mov("barajar", "c"),
  sel(["todos:cementerio"], {}, "d", { nf: "restoCementerio", hasta: true }),
  mov("desterrar", "d"),
];

const restoCementerio = (n) => (e, ctx) => n - (ctx.vars.c ?? []).length;

const comoAliado = {
  texto: "Desterrar dos cartas de tu Cementerio: ponerlo en juego como un Aliado sin habilidad de Fuerza 2",
  zona: "cementerio",
  momento: "vigilia",
  requiere: "dosMas",
  coste: [sel(["yo:cementerio"], { noFuente: true }, "c", { n: 2 }), mov("desterrar", "c")],
  hacer: [sel(["fuente"], {}, "yo"), { op: "convertir", var: "yo", en: "Aliado", fuerza: 2, a: "defensa" }],
};

const dosMas = (e, ctx) => e.jugadores[ctx.ctrl].cementerio.filter((u) => u !== ctx.fuente).length >= 2;

const enReserva = (e, ctx) => e.jugadores[ctx.ctrl].reserva.includes(ctx.fuente);

const sinHabilidad = (e, ctx) => {
  e.conv[ctx.fuente] = { tipo: "Oro", sinHabilidad: true };
};

const pagarloSinHabilidad = [sel(["fuente"], {}, "yo"), mov("pagado", "yo"), { op: "fn", f: "sinHabilidad" }];

const orosLibres = (e, j) => e.jugadores[j].reserva.length + (e.jugadores[j].generados ?? []).reduce((s, g) => s + g.n, 0);

const libreParaArma = (e, u) => !N.tiene(e, u, "NoPortaArmas") && !(e.armas[u] ?? []).length;

const aPagar = (e, u, reduce, minimo) => {
  const k = coste(e, u);
  return Math.max(Math.min(k, minimo), k - reduce);
};

const JUGABLES = ["Aliado", "Arma", "Tótem"];

const jugableCon = (e, ctx, u, reduce, minimo, extra) => {
  const c = N.carta(e, u);
  if (!JUGABLES.includes(c.tipo)) return false;
  if (aPagar(e, u, reduce, minimo) + extra > orosLibres(e, ctx.ctrl)) return false;
  return c.tipo !== "Arma" || N.aliadosDe(e, ctx.ctrl).some((a) => libreParaArma(e, a));
};

const jugarReducido = (reduce, minimo) => (e, ctx, api) => {
  const [u] = ctx.vars.a ?? [];
  if (!u) return;
  const c = N.carta(e, u);
  const j = ctx.ctrl;
  const desde = N.ubicar(e, u)?.zona ?? "mano";
  const pagar = aPagar(e, u, reduce, minimo);
  if (pagar > api.disponibles(e, j, c.tipo)) return;
  api.pagarOros(e, j, pagar, c.tipo);
  N.disparar(e, "juega", { uid: u, j, tipo: c.tipo, pagado: true, desde });
  const datos = { pagado: true, desde };
  if (c.tipo === "Arma") return [sel(["yo:aliados"], { armaLibre: u }, "_port"), { op: "portar", arma: u, en: "_port", datos }];
  api.entrarEnJuego(e, u, j, undefined, datos);
};

const botadaPorDano = (e, ctx) => !!ctx.datos.porDano && ctx.datos.zona === "cementerio" && ctx.datos.uids.includes(ctx.fuente);

const dejarDeBotar = (e, ctx) => {
  const uids = ctx.datos.uids;
  const i = uids.indexOf(ctx.fuente);
  const despues = uids.slice(i + 1).filter((u) => N.ubicar(e, u)?.zona === "cementerio");
  for (const u of despues.reverse()) N.mover(e, u, "castillo");
  N.mover(e, ctx.fuente, "destierro");
};

const alBotarPorDano = { zona: ["cementerio"], cuando: ["salenDelCastillo"], quien: "yo", si: "botadaPorDano", hacer: [{ op: "fn", f: "dejarDeBotar" }] };

const ganaPorElTurno = (claves) => ({
  op: "modo",
  opciones: claves.map((clave) => ({ texto: `Gana ${clave}`, pasos: [efecto("a", { tipo: "gana", clave })] })),
});

const aliadoBarato = { de: ["todos:aliados"], filtro: { costeMax: 2 } };

export const HABILIDADES = {
  Belta: {
    disparadas: [{ cuando: ["entra"], opcional: true, hacer: buscar(["yo:castillo"], { tipo: "Tótem" }) }],
    activadas: [
      { texto: "Barajar y/o Desterrar hasta dos cartas de los Cementerios", veces: "turno", hacer: barajarYDesterrar(2) },
      comoAliado,
    ],
    fns: { dosMas, restoCementerio: restoCementerio(2) },
  },
  Bullnax: {
    disparadas: [
      { cuando: ["entra"], opcional: true, hacer: buscar(["yo:castillo"], { tipo: "Oro" }) },
      {
        cuando: ["ataca"],
        quien: "yo",
        veces: 1,
        hacer: [sel(["rival:defensa"], {}, "b"), sel(["yo:ataque"], {}, "a"), { op: "fn", f: "forzar" }],
      },
    ],
    activadas: [comoAliado],
    fns: {
      dosMas,
      forzar: (e, ctx) => {
        const [b] = ctx.vars.b ?? [];
        const [a] = ctx.vars.a ?? [];
        if (b && a) N.agregarEfecto(e, { tipo: "debeBloquearA", uid: b, atacante: a }, ctx.ctrl);
      },
    },
  },
  "Báculo de los Eternos": {
    activadas: [
      {
        texto: "Mirar tantas cartas del tope como Armas y Tótem controles y Robar una carta; no Robas al finalizar tu turno",
        momento: "tuTurno",
        veces: "turno",
        hacer: [robar(1), { op: "fn", f: "marcar" }],
      },
    ],
    disparadas: [
      { cuando: ["faseFinal"], si: "marcado", hacer: [{ op: "fn", f: "guardar" }] },
      { cuando: ["comienzoTurno"], quien: "rival", si: "guardado", hacer: [{ op: "fn", f: "devolver" }] },
    ],
    fns: {
      marcar: (e, ctx) => {
        e.usos[`baculo|${ctx.fuente}`] = e.turno;
      },
      marcado: (e, ctx) => e.usos[`baculo|${ctx.fuente}`] === e.turno,
      guardar: (e, ctx) => {
        delete e.usos[`baculo|${ctx.fuente}`];
        const u = e.jugadores[ctx.ctrl].castillo[0];
        if (u) e.usos[`baculoCarta|${ctx.fuente}`] = u;
      },
      guardado: (e, ctx) => e.usos[`baculoCarta|${ctx.fuente}`] !== undefined,
      devolver: (e, ctx) => {
        const u = e.usos[`baculoCarta|${ctx.fuente}`];
        delete e.usos[`baculoCarta|${ctx.fuente}`];
        if (e.jugadores[ctx.ctrl].mano.includes(u)) N.mover(e, u, "castillo");
      },
    },
  },
  "Calaveras de Azúcar": {
    disparadas: [
      {
        cuando: ["entra"],
        hacer: [{ op: "mostrarHasta", n: 2, filtro: { tipo: "Oro" }, distintoNombre: true, como: "m" }, mov("mano", "m"), barajar()],
      },
    ],
  },
  "Campana Hundida": {
    disparadas: [
      { cuando: ["entra"], hacer: [{ op: "tope", n: 1, fondo: true, como: "f" }, mov("mano", "f")] },
      { cuando: ["juega"], quien: "rival", si: "noAnulable", opcional: true, hacer: [...desdeLaFuente("desterrar"), { op: "fn", f: "silenciar" }] },
    ],
    fns: {
      noAnulable: (e, ctx) => {
        const c = N.carta(e, ctx.datos.uid);
        return ["Aliado", "Tótem"].includes(c.tipo) && c.claves.includes("NoAnulable") && !c.sinHabilidad;
      },
      silenciar: (e, ctx) => {
        N.agregarEfecto(e, { tipo: "pierdeHabilidad", uid: ctx.datos.uid }, ctx.ctrl);
      },
    },
  },
  "Carro Szgany": {
    disparadas: [
      {
        cuando: ["faseFinal"],
        hacer: [
          {
            op: "modo",
            opciones: [
              { texto: "Tu Cementerio", pasos: [sel(["yo:cementerio"], {}, "c", { n: 2, hasta: true }), mov("desterrar", "c")] },
              { texto: "Cementerio oponente", pasos: [sel(["rival:cementerio"], {}, "c", { n: 2, hasta: true }), mov("desterrar", "c")] },
            ],
          },
        ],
      },
    ],
    continuas: [{ armaAdicional: true, si: "conRaza" }],
    fns: {
      conRaza: (e, ctx) => N.aliadosDe(e, ctx.ctrl).some((a) => (N.carta(e, a).razas ?? []).some((r) => ["Caballero", "Guerrero", "Héroe"].includes(r))),
    },
  },
  "Carro de Sol": {
    activadas: [
      {
        texto: "Un Aliado de coste 2 o menos gana Furia, Indestructible o Imbloqueable por el turno",
        veces: "turno",
        requiere: aliadoBarato,
        hacer: [sel(["todos:aliados"], { costeMax: 2 }, "a"), ganaPorElTurno(["Furia", "Indestructible", "Imbloqueable"])],
      },
      {
        texto: "Desterrar este Oro de tu Reserva: Desterrar una carta de coste 2 o menos",
        requiere: "puedeDesterrar",
        coste: desdeLaFuente("desterrar"),
        hacer: [sel(["todos:enJuego"], { costeMax: 2 }, "x", { para: "desterrar" }), mov("desterrar")],
      },
    ],
    fns: {
      puedeDesterrar: (e, ctx) =>
        enReserva(e, ctx) && N.todoEnJuego(e).some((u) => u !== ctx.fuente && coste(e, u) <= 2 && !N.tiene(e, u, "Indesterrable")),
    },
  },
  Cerebelum: {
    disparadas: [
      {
        cuando: ["entra"],
        hacer: [
          { op: "tope", n: 3, como: "m" },
          {
            op: "modo",
            opciones: [
              { texto: "Todos los Aliados a tu mano", pasos: [sel(["var:m"], { tipo: "Aliado" }, "a", { n: 3 }), mov("mano", "a")] },
              { texto: "Una carta a tu mano", pasos: [sel(["var:m"], { zona: "castillo" }, "a"), mov("mano", "a")] },
            ],
          },
          barajar(),
        ],
      },
    ],
  },
  "Chupilca del Diablo": {
    disparadas: [{ cuando: ["entra"], hacer: [robar(1)] }],
    activadas: [
      {
        texto: "Desterrar este Oro: hasta dos Aliados ganan 2 de Fuerza por el turno",
        coste: desdeLaFuente("desterrar"),
        hacer: [sel(["todos:aliados"], {}, "a", { n: 2, hasta: true }), efecto("a", { tipo: "fuerza", n: 2 })],
      },
      {
        texto: "Un Aliado de coste 2 o menos gana Furia o Indestructible por el turno",
        veces: "turno",
        requiere: aliadoBarato,
        hacer: [sel(["todos:aliados"], { costeMax: 2 }, "a"), ganaPorElTurno(["Furia", "Indestructible"])],
      },
    ],
  },
  "Colmillo de Vampiro": {
    disparadas: [
      {
        cuando: ["comienzoVigilia"],
        quien: "cualquiera",
        opcional: true,
        hacer: [...barajarYDesterrar(2), { op: "si", f: "roba", entonces: [robar(1)] }],
      },
    ],
    fns: {
      restoCementerio: restoCementerio(2),
      roba: (e, ctx) => N.aliadosDe(e, ctx.ctrl).length > 0 && e.jugadores[ctx.ctrl].reserva.length === 0,
    },
  },
  "Compendium Maleficarum": {
    disparadas: [
      { cuando: ["entra"], hacer: [sel(["rival:mano", "rival:castillo", "rival:cementerio"], {}, "n"), { op: "fn", f: "vetar" }] },
      {
        zona: ["cementerio"],
        cuando: ["comienzoVigilia"],
        si: "otra",
        opcional: true,
        hacer: [sel(["yo:cementerio"], { noFuente: true }, "c"), mov("desterrar", "c"), ...desdeLaFuente("mano")],
      },
    ],
    fns: {
      vetar: (e, ctx) => {
        for (const u of ctx.vars.n ?? []) N.agregarEfecto(e, { tipo: "noJugarNombre", j: N.rival(ctx.ctrl), nombre: N.carta(e, u).nombre, fin: "proximoTurno" }, ctx.ctrl);
      },
      otra: (e, ctx) => e.jugadores[ctx.ctrl].cementerio.some((u) => u !== ctx.fuente),
    },
  },
  "Corazon de Muerte": {
    activadas: [
      {
        texto: "Pagar este Oro: jugar una carta de tu Cementerio que no sea Talismán reduciendo su coste en un Oro",
        momento: "vigilia",
        requiere: "puede",
        coste: desdeLaFuente("pagado"),
        hacer: [sel(["yo:cementerio"], { f: "jugable" }, "a"), { op: "fn", f: "jugar" }],
      },
    ],
    fns: {
      puede: (e, ctx) => enReserva(e, ctx) && e.jugadores[ctx.ctrl].cementerio.some((u) => jugableCon(e, ctx, u, 1, 0, 1)),
      jugable: (e, ctx, u) => jugableCon(e, ctx, u, 1, 0, 0),
      jugar: jugarReducido(1, 0),
    },
  },
  "Corazón de Dragón": {
    disparadas: [{ cuando: ["entra"], hacer: [sel(["rival:oros"], {}, "o"), { op: "fn", f: "copiar" }] }],
    activadas: [
      {
        texto: "Ponerlo desde tu mano en tu Reserva",
        zona: "mano",
        momento: "vigilia",
        requiere: "sinOros",
        hacer: [sel(["fuente"], {}, "yo"), { op: "ponerOro", var: "yo", a: "reserva" }],
      },
      {
        texto: "Ponerlo desde tu Cementerio en tu Reserva",
        zona: "cementerio",
        momento: "vigilia",
        requiere: "sinOros",
        hacer: [sel(["fuente"], {}, "yo"), { op: "ponerOro", var: "yo", a: "reserva" }],
      },
    ],
    fns: {
      sinOros: (e, ctx) => e.jugadores[ctx.ctrl].orosPuestos === 0,
      copiar: (e, ctx) => {
        const [o] = ctx.vars.o ?? [];
        if (!o || !N.enJuego(e, ctx.fuente)) return;
        e.conv[ctx.fuente] = { tipo: "Oro", sinHabilidad: false, como: e.instancias[o] };
      },
    },
  },
  "Corona de la Bestia": {
    activadas: [
      {
        texto: "Robar una carta y Barajar una carta de tu mano",
        veces: "turno",
        hacer: [robar(1), sel(["yo:mano"], {}, "m"), mov("barajar", "m")],
      },
    ],
  },
  "Cristo de Mayo": {
    claves: ["NoPierdeHabilidad"],
    activadas: [
      {
        texto: "Descartar un Oro o Talismán: buscar un Aliado o Tótem de coste 2 en tu Castillo",
        veces: "turno",
        requiere: { de: ["yo:mano"], filtro: { tipo: ["Oro", "Talismán"] } },
        coste: [sel(["yo:mano"], { tipo: ["Oro", "Talismán"] }, "d"), mov("cementerio", "d")],
        hacer: buscar(["yo:castillo"], { tipo: ["Aliado", "Tótem"], costeMin: 2, costeMax: 2 }),
      },
      {
        texto: "Pagarlo y convertirlo en un Oro sin habilidad: Barajar una carta que no sea Oro (si tenía coste 4 o más, Descartas una carta)",
        requiere: "puedeBarajar",
        coste: pagarloSinHabilidad,
        hacer: [
          sel(["todos:enJuego"], { noTipo: ["Oro"] }),
          { op: "fn", f: "recordar" },
          mov("barajar"),
          { op: "si", f: "caro", entonces: [sel(["yo:mano"], {}, "d"), mov("cementerio", "d")] },
        ],
      },
    ],
    fns: {
      sinHabilidad,
      puedeBarajar: (e, ctx) => enReserva(e, ctx) && N.todoEnJuego(e).some((u) => N.carta(e, u).tipo !== "Oro"),
      recordar: (e, ctx) => {
        ctx.vars.caro = (ctx.vars.x ?? []).some((u) => coste(e, u) >= 4);
      },
      caro: (e, ctx) => !!ctx.vars.caro,
    },
  },
  "Crono Diamante": {
    disparadas: [{ cuando: ["juega"], quien: "yo", si: "aliadoCaro", hacer: [{ op: "fn", f: "marcar" }] }],
    activadas: [
      {
        texto: "Descartar una carta: jugar un Aliado reduciendo su coste en un Oro, hasta un mínimo de 1",
        veces: "turno",
        momento: "vigilia",
        requiere: "puede",
        coste: [sel(["yo:mano"], {}, "d"), mov("cementerio", "d")],
        hacer: [sel(["yo:mano"], { tipo: "Aliado", f: "jugable" }, "a"), { op: "fn", f: "jugar" }],
      },
    ],
    fns: {
      aliadoCaro: (e, ctx) => ctx.datos.tipo === "Aliado" && coste(e, ctx.datos.uid) >= 2,
      marcar: (e, ctx) => {
        e.usos[`crono|${ctx.ctrl}`] = e.turno;
      },
      puede: (e, ctx) =>
        e.usos[`crono|${ctx.ctrl}`] === e.turno &&
        e.jugadores[ctx.ctrl].mano.length >= 2 &&
        e.jugadores[ctx.ctrl].mano.some((u) => N.carta(e, u).tipo === "Aliado" && jugableCon(e, ctx, u, 1, 1, 0)),
      jugable: (e, ctx, u) => jugableCon(e, ctx, u, 1, 1, 0),
      jugar: jugarReducido(1, 1),
    },
  },
  "Cruz de Borgoa": {
    disparadas: [{ cuando: ["entra"], hacer: buscar(["yo:castillo"], { tipo: "Aliado", f: "debil" }) }],
    fns: { debil: (e, ctx, u) => (N.carta(e, u).fuerza ?? 0) <= 2 },
  },
  "Cráneo de Duvel": {
    activadas: [
      {
        texto: "Poner una carta de tu mano en el tope de tu Castillo y la carta del fondo en tu mano",
        veces: "turno",
        requiere: "conMano",
        hacer: [sel(["yo:mano"], {}, "m"), mov("castillo", "m"), { op: "tope", n: 1, fondo: true, como: "f" }, mov("mano", "f")],
      },
    ],
    continuas: [{ fuerza: 1, a: "tusAliados", zona: "reserva" }],
    disparadas: [{ cuando: ["faseFinal"], si: "enReserva", hacer: [{ op: "fn", f: "agrupar" }] }],
    fns: {
      conMano: (e, ctx) => e.jugadores[ctx.ctrl].mano.length > 0,
      enReserva,
      agrupar: (e, ctx) => {
        const p = e.jugadores[ctx.ctrl];
        p.defensa.push(...p.ataque.splice(0));
      },
    },
  },
  "Cráneos Vivos": {
    disparadas: [{ cuando: ["entra"], hacer: [castilloElegido((quien) => [{ op: "fn", f: "mostrarDos", quien }])] }],
    activadas: [
      {
        texto: "Pagarlo y convertirlo en un Oro sin habilidad: tu oponente Bota tantas cartas como tipos distintos haya en los Destierros",
        requiere: "enReserva",
        coste: pagarloSinHabilidad,
        hacer: [{ op: "fn", f: "botar" }],
      },
    ],
    fns: {
      enReserva,
      sinHabilidad,
      mostrarDos: (e, ctx, api, p) => {
        const j = p.quien === "rival" ? N.rival(ctx.ctrl) : ctx.ctrl;
        const castillo = e.jugadores[j].castillo;
        const [primera] = castillo;
        if (!primera) return;
        const tipo = N.carta(e, primera).tipo;
        const segunda = castillo.find((u) => N.carta(e, u).tipo !== tipo);
        for (const u of [primera, segunda].filter(Boolean)) N.mover(e, u, "destierro");
      },
      botar: (e) => {
        const tipos = new Set(e.jugadores.flatMap((p) => p.destierro.map((u) => N.carta(e, u).tipo)));
        return [{ op: "botar", n: tipos.size, quien: "rival" }];
      },
    },
  },
  "Cuerno de Titán": {
    activadas: [
      {
        texto: "Destruir una carta que controles o Descartar una carta: buscar una carta Titán en tu Castillo",
        veces: "turno",
        requiere: "puede",
        coste: [
          {
            op: "modo",
            opciones: [
              {
                texto: "Destruir una carta que controles",
                requiere: { de: ["yo:enJuego"], filtro: {}, para: "destruir" },
                pasos: [sel(["yo:enJuego"], {}, "c", { para: "destruir" }), mov("destruir", "c")],
              },
              { texto: "Descartar una carta", requiere: { de: ["yo:mano"], filtro: {} }, pasos: [sel(["yo:mano"], {}, "c"), mov("cementerio", "c")] },
            ],
          },
        ],
        hacer: buscar(["yo:castillo"], { f: "titan" }),
      },
    ],
    continuas: [{ fuerzaPor: "titanPropio", a: "tusAliados" }],
    fns: {
      puede: (e, ctx) => e.jugadores[ctx.ctrl].mano.length > 0 || N.enJuegoDe(e, ctx.ctrl).some((u) => !N.tiene(e, u, "Indestructible")),
      titan: (e, ctx, u) => N.carta(e, u).nombre.includes("Titán"),
      titanPropio: (e, ctx) => (N.carta(e, ctx.objetivo).nombre.includes("Titán") ? 1 : 0),
    },
  },
  "Cáliz de Sangre": {
    activadas: [
      {
        texto: "Barajar un Oro de tu Reserva; si lo haces, poner un Oro de tu mano en tu Reserva",
        momento: "vigilia",
        veces: "turno",
        requiere: { de: ["yo:reserva"], filtro: { tipo: "Oro" } },
        hacer: [
          sel(["yo:reserva"], { tipo: "Oro" }, "o"),
          mov("barajar", "o"),
          { op: "si", f: "barajado", entonces: [sel(["yo:mano"], { tipo: "Oro" }, "p"), { op: "ponerOro", var: "p", a: "reserva" }] },
        ],
      },
    ],
    disparadas: [
      {
        cuando: ["faseFinal"],
        hacer: [
          {
            op: "modo",
            hasta: true,
            opciones: [
              { texto: "Barajar hasta dos cartas de tu Cementerio", pasos: [sel(["yo:cementerio"], {}, "c", { n: 2, hasta: true }), mov("barajar", "c")] },
              { texto: "Desterrar una carta de un Cementerio", requiere: { de: ["todos:cementerio"], filtro: {} }, pasos: [sel(["todos:cementerio"], {}, "c"), mov("desterrar", "c")] },
            ],
          },
        ],
      },
    ],
    fns: { barajado: (e, ctx) => (ctx.vars.o ?? []).some((u) => N.ubicar(e, u)?.zona === "castillo") },
  },
  "Diadema Angelical": {
    disparadas: [{ cuando: ["entra"], hacer: [robar(1)] }, alBotarPorDano],
    activadas: [
      {
        texto: "Barajarlo desde tu mano y pagar un Oro: jugar una carta reduciendo su coste en un Oro; no puede ser Anulada",
        zona: "mano",
        momento: "vigilia",
        requiere: "puede",
        coste: desdeLaFuente("barajar"),
        hacer: [{ op: "pagar", n: 1 }, sel(["yo:mano"], { f: "jugable" }, "a"), { op: "fn", f: "jugar" }],
      },
      {
        texto: "Barajarlo y pagar un Oro: jugar una carta reduciendo su coste en un Oro; no puede ser Anulada",
        momento: "vigilia",
        requiere: "puede",
        coste: desdeLaFuente("barajar"),
        hacer: [{ op: "pagar", n: 1 }, sel(["yo:mano"], { f: "jugable" }, "a"), { op: "fn", f: "jugar" }],
      },
    ],
    fns: {
      botadaPorDano,
      dejarDeBotar,
      puede: (e, ctx) => {
        const propia = e.jugadores[ctx.ctrl].reserva.includes(ctx.fuente) ? 1 : 0;
        return e.jugadores[ctx.ctrl].mano.some((u) => u !== ctx.fuente && jugableCon(e, ctx, u, 1, 0, 1 + propia));
      },
      jugable: (e, ctx, u) => jugableCon(e, ctx, u, 1, 0, 0),
      jugar: jugarReducido(1, 0),
    },
  },
  "Diadema Celestial": {
    disparadas: [{ cuando: ["entra"], hacer: [{ op: "mostrarHasta", tipos: ["Aliado", "Talismán"], como: "m" }, mov("mano", "m")] }, alBotarPorDano],
    continuas: [{ fuerzaPor: "bloquea", a: "tusAliados" }],
    fns: {
      botadaPorDano,
      dejarDeBotar,
      bloquea: (e, ctx) => (e.bloqueos[ctx.objetivo] !== undefined ? 1 : 0),
    },
  },
  "Diente de Dragón": {
    disparadas: [
      {
        cuando: ["faseFinal"],
        hacer: [
          {
            op: "opcional",
            texto: "Barajar una carta de tu mano para mostrar hasta una carta de coste 3 o más y ponerla en tu mano",
            requiere: "conMano",
            pasos: [sel(["yo:mano"], {}, "m"), mov("barajar", "m"), { op: "mostrarHasta", n: 1, filtro: { costeMin: 3 }, como: "h" }, mov("mano", "h")],
          },
        ],
      },
    ],
    fns: { conMano: (e, ctx) => e.jugadores[ctx.ctrl].mano.length > 0 },
  },
  "Directorium Inquisitorum": {
    activadas: [
      {
        texto: "Ponerlo en juego desde tu Cementerio como si estuviera en tu mano",
        zona: "cementerio",
        momento: "vigilia",
        requiere: "puedeOro",
        hacer: [{ op: "fn", f: "marcar" }, sel(["fuente"], {}, "yo"), { op: "ponerOro", var: "yo", a: "reserva" }],
      },
    ],
    disparadas: [
      {
        cuando: ["entra"],
        hacer: [
          { op: "fn", f: "leer" },
          {
            op: "modo",
            hasta: true,
            opciones: [
              { texto: "Buscar un Oro en tu Castillo", pasos: buscar(["yo:castillo"], { tipo: "Oro" }) },
              { texto: "Robar dos cartas", requiere: "desdeCementerio", pasos: [robar(2)] },
            ],
          },
        ],
      },
    ],
    fns: {
      puedeOro: (e, ctx) => {
        const p = e.jugadores[ctx.ctrl];
        return !p.oroJugado && !p.otraJugada && !e.efectos.some((f) => f.tipo === "noJugarMas" && (f.j === undefined || f.j === ctx.ctrl));
      },
      marcar: (e, ctx) => {
        e.jugadores[ctx.ctrl].oroJugado = true;
        e.usos[`directorium|${ctx.fuente}`] = e.turno;
      },
      leer: (e, ctx) => {
        ctx.vars.desdeCementerio = e.usos[`directorium|${ctx.fuente}`] === e.turno;
        delete e.usos[`directorium|${ctx.fuente}`];
      },
      desdeCementerio: (e, ctx) => !!ctx.vars.desdeCementerio,
    },
  },
};
