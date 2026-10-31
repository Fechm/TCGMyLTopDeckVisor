import * as N from "../nucleo.js";
import { sel, mov, barajar, robar, efecto, buscar, coste } from "../formato.js";

const desdeLaFuente = (a) => [sel(["fuente"], {}, "yo"), mov(a, "yo")];

const sinHabilidad = (e, ctx) => {
  e.conv[ctx.fuente] = { tipo: "Oro", sinHabilidad: true };
};

const pagarloYApagarlo = [...desdeLaFuente("pagado"), { op: "fn", f: "apagar" }];

const enReserva = (e, ctx) => e.jugadores[ctx.ctrl].reserva.includes(ctx.fuente);

const conMano = (e, ctx) => e.jugadores[ctx.ctrl].mano.length > 0;

const descartar = (como = "d", filtro = {}) => [sel(["yo:mano"], filtro, como), mov("cementerio", como)];

const barajarODesterrar = (v) => ({
  op: "modo",
  opciones: [
    { texto: "Barajar", pasos: [mov("barajar", v)] },
    { texto: "Desterrar", pasos: [mov("desterrar", v)] },
  ],
});

const cancelarAtaque = (e, uids) => {
  for (const u of uids) {
    const j = N.controlador(e, u);
    if (!e.jugadores[j].ataque.includes(u) || N.tiene(e, u, "AtaqueNoCancelable")) continue;
    N.sacar(e, u);
    e.jugadores[j].defensa.push(u);
    e.atacantes = e.atacantes.filter((x) => x !== u);
    for (const [b, a] of Object.entries(e.bloqueos)) if (a === u) delete e.bloqueos[b];
  }
};

const oroOBarato = (e, ctx, u) => N.carta(e, u).tipo === "Oro" || coste(e, u) <= 2;

const frankenstein = {
  activadas: [
    {
      texto: "En tu turno, pagarlo y Barajar una carta de tu mano: un Oro o carta de coste 2 o menos pierde su habilidad por el turno",
      momento: "tuTurno",
      requiere: "puedePagar",
      coste: [...desdeLaFuente("pagado"), sel(["yo:mano"], {}, "m"), mov("barajar", "m")],
      hacer: [sel(["todos:enJuego"], { f: "oroOBarato" }), efecto("x", { tipo: "pierdeHabilidad" })],
    },
    {
      texto: "Descartar una carta: una carta en juego pierde su habilidad por el turno",
      veces: "turno",
      requiere: "conMano",
      coste: descartar(),
      hacer: [sel(["todos:enJuego"], {}, "x"), efecto("x", { tipo: "pierdeHabilidad" })],
    },
  ],
  fns: {
    oroOBarato,
    conMano,
    puedePagar: (e, ctx) => enReserva(e, ctx) && conMano(e, ctx),
  },
};

export const HABILIDADES = {
  "Don de Belial": {
    disparadas: [{ cuando: ["entra"], hacer: buscar(["yo:castillo"], { tipo: "Oro" }) }],
    activadas: [
      {
        texto: "Pagarlo y convertirlo en un Oro sin habilidad: subir otro Oro que controles a tu mano y poner un Oro de tu mano en tu Oro Pagado",
        requiere: "puede",
        coste: pagarloYApagarlo,
        hacer: [sel(["yo:oros"], { noFuente: true }, "o"), mov("mano", "o"), sel(["yo:mano"], { tipo: "Oro" }, "p"), { op: "ponerOro", var: "p", a: "pagado" }],
      },
    ],
    fns: {
      apagar: sinHabilidad,
      puede: (e, ctx) => enReserva(e, ctx) && N.orosDe(e, ctx.ctrl).some((u) => u !== ctx.fuente),
    },
  },
  "Dulce Canasta": {
    disparadas: [{ cuando: ["entra"], hacer: buscar(["yo:castillo", "yo:cementerio"], { tipo: "Oro" }) }],
    activadas: [
      {
        texto: "Un Aliado gana o pierde 2 de Fuerza permanentemente",
        veces: "turno",
        requiere: { de: ["todos:aliados"], filtro: {} },
        hacer: [
          sel(["todos:aliados"], {}, "a"),
          {
            op: "modo",
            opciones: [
              { texto: "Gana 2 de Fuerza", pasos: [efecto("a", { tipo: "fuerza", n: 2 }, "mientras")] },
              { texto: "Pierde 2 de Fuerza", pasos: [efecto("a", { tipo: "fuerza", n: -2 }, "mientras")] },
            ],
          },
        ],
      },
    ],
    continuas: [{ zona: "reserva", gana: "Indesterrable", a: "aliados", costeMax: 1 }],
  },
  "El Cuervo y Otros Poemas": {
    disparadas: [
      {
        cuando: ["entra"],
        opcional: true,
        hacer: [{ op: "mostrarHasta", n: 1, filtro: { tipo: ["Aliado", "Tótem"], costeMin: 1, costeMax: 1 }, como: "m" }, mov("mano", "m")],
      },
    ],
    activadas: [
      {
        texto: "Desterrar un Oro que controles: Destruir una carta de coste 2 o menos",
        veces: "turno",
        requiere: { de: ["todos:enJuego"], filtro: { costeMax: 2 }, para: "destruir" },
        coste: [sel(["yo:oros"], {}, "o", { para: "desterrar" }), mov("desterrar", "o")],
        hacer: [sel(["todos:enJuego"], { costeMax: 2 }, "x", { para: "destruir" }), mov("destruir")],
      },
    ],
  },
  "El Démeter": {
    disparadas: [{ cuando: ["entra"], hacer: [{ op: "mostrarHasta", n: 1, filtro: { tipo: "Aliado", costeMax: 2 }, como: "m" }, mov("mano", "m")] }],
    activadas: [
      {
        texto: "Un Aliado debe bloquear este turno si puede",
        veces: "turno",
        requiere: { de: ["todos:aliados"], filtro: {} },
        hacer: [sel(["todos:aliados"]), efecto("x", { tipo: "debeBloquear" })],
      },
    ],
    continuas: [{ zona: "reserva", gana: "AtaqueNoCancelable", a: "tusAliados" }],
  },
  "El Mundo Perdido": {
    continuas: [{ armaAdicional: true }],
    disparadas: [
      {
        cuando: ["anulada"],
        quien: "yo",
        veces: 2,
        si: "aliadoAnulado",
        opcional: true,
        hacer: [sel(["yo:mano"], { tipo: "Arma" }, "arma"), { op: "fn", f: "cargar" }, { op: "convertir", var: "t", en: "Aliado", a: "defensa" }],
      },
    ],
    fns: {
      aliadoAnulado: (e, ctx) =>
        ctx.datos.tipo === "Aliado" &&
        N.ubicar(e, ctx.datos.uid)?.zona === "cementerio" &&
        e.jugadores[ctx.ctrl].mano.some((u) => N.carta(e, u).tipo === "Arma"),
      cargar: (e, ctx) => {
        ctx.vars.t = (ctx.vars.arma ?? []).length ? [ctx.datos.uid] : [];
      },
    },
  },
  "El Ultimo Hombre": {
    activadas: [
      {
        texto: "Mostrar las tres primeras cartas de tu Castillo: por cada Aliado mostrado un Aliado gana 1 de Fuerza permanentemente",
        veces: "turno",
        hacer: [{ op: "tope", n: 3, como: "m" }, { op: "fn", f: "ganar" }],
      },
    ],
    fns: {
      ganar: (e, ctx) => {
        const n = (ctx.vars.m ?? []).filter((u) => N.carta(e, u).tipo === "Aliado").length;
        return Array.from({ length: n }, (_, i) => [sel(["todos:aliados"], {}, `g${i}`), efecto(`g${i}`, { tipo: "fuerza", n: 1 }, "mientras")]).flat();
      },
    },
  },
  "Embrion Titán": {
    disparadas: [
      {
        cuando: ["entra"],
        hacer: [
          sel(["yo:reserva"], { tipo: "Oro", noFuente: true }, "s"),
          mov("mano", "s"),
          {
            op: "modo",
            opciones: [
              { texto: "Buscar una carta que no sea Talismán", pasos: buscar(["yo:castillo"], { noTipo: ["Talismán"] }) },
              { texto: "Robar dos cartas", pasos: [robar(2)] },
            ],
          },
        ],
      },
    ],
  },
  Empanada: {
    disparadas: [{ cuando: ["entra"], opcional: true, hacer: buscar(["yo:castillo"], { f: "empanada" }) }],
    activadas: [
      {
        texto: "Descartar una carta y decir \"Viva Chile\": Robar una carta",
        veces: "turno",
        requiere: "conMano",
        coste: descartar(),
        hacer: [robar(1)],
      },
    ],
    continuas: [
      { si: "conPebre", fuerza: 1, a: "tusAliados" },
      { si: "conPebre", gana: "Imbloqueable", a: "tusAliados" },
    ],
    fns: {
      conMano,
      empanada: (e, ctx, u) => N.carta(e, u).nombre === "Empanada",
      conPebre: (e, ctx) => N.enJuegoDe(e, ctx.ctrl).some((u) => N.carta(e, u).nombre === "Pebre"),
    },
  },
  "En las Montañas de la Locura": {
    activadas: [
      {
        texto: "Barajarlo: mostrar cuatro cartas del tope de tu Castillo, poner los Aliados en tu mano y Barajar el resto",
        coste: desdeLaFuente("barajar"),
        hacer: [{ op: "tope", n: 4, como: "m" }, sel(["var:m"], { tipo: "Aliado", zona: "castillo" }, "a", { n: 99 }), mov("mano", "a"), barajar()],
      },
    ],
  },
  "Escamas de Azi": {
    activadas: [
      {
        texto: "Descartar una carta o Botar tres: buscar una carta Azi en tu Castillo",
        veces: "turno",
        requiere: "puede",
        coste: [
          {
            op: "modo",
            opciones: [
              { texto: "Descartar una carta", requiere: { de: ["yo:mano"], filtro: {} }, pasos: descartar() },
              { texto: "Botar tres cartas", pasos: [{ op: "botar", n: 3, quien: "yo" }] },
            ],
          },
        ],
        hacer: buscar(["yo:castillo"], { f: "azi" }),
      },
    ],
    disparadas: [{ cuando: ["faseFinal"], si: "hayCementerio", hacer: [sel(["todos:cementerio"], {}, "c", { n: 2, hasta: true }), barajarODesterrar("c")] }],
    fns: {
      azi: (e, ctx, u) => /\bAzi\b/.test(N.carta(e, u).nombre),
      puede: (e, ctx) => conMano(e, ctx) || e.jugadores[ctx.ctrl].castillo.length > 3,
      hayCementerio: (e) => e.jugadores.some((p) => p.cementerio.length > 0),
    },
  },
  "Escamas de Dragón": {
    disparadas: [{ cuando: ["entra"], hacer: [{ op: "botar", n: 3, quien: "yo" }, { op: "botar", n: 3, quien: "rival" }, robar(1)] }],
    activadas: [
      {
        texto: "Descartar una carta: buscar una carta en tu Castillo y ponerla en tu Cementerio",
        momento: "vigilia",
        veces: "turno",
        requiere: "conMano",
        coste: descartar(),
        hacer: [sel(["yo:castillo"], {}, "b"), mov("cementerio", "b"), barajar()],
      },
    ],
    fns: { conMano },
  },
  "Escarapela Nacional": {
    disparadas: [
      {
        zona: ["mano"],
        cuando: ["comienzoVigilia"],
        quien: "rival",
        si: "sinMasOros",
        opcional: true,
        hacer: [{ op: "fn", f: "marcar" }, sel(["fuente"], {}, "yo"), { op: "ponerOro", var: "yo", a: "reserva" }],
      },
      { cuando: ["comienzoTurno"], quien: "yo", si: "marcada", hacer: [{ op: "fn", f: "bloquearOros" }] },
      {
        cuando: ["entra"],
        hacer: [
          {
            op: "modo",
            opciones: [
              { texto: "Robar dos cartas", pasos: [robar(2)] },
              { texto: "Buscar un Aliado u Oro", pasos: buscar(["yo:castillo"], { tipo: ["Aliado", "Oro"] }) },
            ],
          },
        ],
      },
    ],
    fns: {
      sinMasOros: (e, ctx) => N.orosDe(e, ctx.ctrl).length <= N.orosDe(e, N.rival(ctx.ctrl)).length,
      marcar: (e, ctx) => {
        e.usos[`escarapela|${ctx.ctrl}`] = e.turno;
      },
      marcada: (e, ctx) => e.usos[`escarapela|${ctx.ctrl}`] !== undefined,
      bloquearOros: (e, ctx) => {
        delete e.usos[`escarapela|${ctx.ctrl}`];
        e.jugadores[ctx.ctrl].oroJugado = true;
      },
    },
  },
  "Escritura Sagrada": {
    disparadas: [{ cuando: ["entra"], hacer: [{ op: "tope", n: 2, como: "m" }, sel(["var:m"], { tipo: "Oro", zona: "castillo" }, "o", { n: 2, hasta: true }), mov("fondo", "o")] }],
    activadas: [
      { texto: "Subirlo a tu mano: prevenir el próximo daño que fueras a recibir este turno", coste: desdeLaFuente("mano"), hacer: [{ op: "fn", f: "prevenir" }] },
      { texto: "Convertirlo en un Oro sin habilidad: prevenir el próximo daño que fueras a recibir este turno", coste: [{ op: "fn", f: "apagar" }], hacer: [{ op: "fn", f: "prevenir" }] },
    ],
    fns: {
      apagar: sinHabilidad,
      prevenir: (e, ctx) => {
        N.agregarEfecto(e, { tipo: "prevenirDano", j: ctx.ctrl, unaVez: true }, ctx.ctrl);
      },
    },
  },
  "Escudo Nacional": {
    disparadas: [{ cuando: ["entra"], hacer: buscar(["yo:castillo"], { f: "escudo" }) }],
    activadas: [
      {
        texto: "Pagar tres Escudo Nacional: jugar un Aliado de tu mano sin pagar su coste",
        momento: "vigilia",
        requiere: "puede",
        coste: [...desdeLaFuente("pagado"), sel(["yo:reserva"], { f: "escudo", noFuente: true }, "otros", { n: 2 }), mov("pagado", "otros")],
        hacer: [sel(["yo:mano"], { tipo: "Aliado" }, "a"), { op: "jugarGratis", var: "a" }],
      },
    ],
    fns: {
      escudo: (e, ctx, u) => N.carta(e, u).nombre === "Escudo Nacional",
      puede: (e, ctx) => {
        const p = e.jugadores[ctx.ctrl];
        return enReserva(e, ctx) && p.reserva.filter((u) => N.carta(e, u).nombre === "Escudo Nacional").length >= 3 && p.mano.some((u) => N.carta(e, u).tipo === "Aliado");
      },
    },
  },
  "Escudo de Vlad III": {
    disparadas: [
      { cuando: ["entra"], hacer: [{ op: "mostrarHasta", tipos: ["Aliado", "Oro"], como: "m" }, sel(["var:m"], {}, "u"), mov("mano", "u"), barajar()] },
      { cuando: ["alCementerio"], quien: "cualquiera", veces: 1, opcional: true, hacer: [{ op: "fn", f: "cargar" }, mov("desterrar", "c")] },
    ],
    continuas: [{ fuerza: -1, a: "aliados" }],
    fns: {
      cargar: (e, ctx) => {
        ctx.vars.c = N.ubicar(e, ctx.datos.uid)?.zona === "cementerio" ? [ctx.datos.uid] : [];
      },
    },
  },
  "Espada Ceremonial": {
    disparadas: [{ cuando: ["entra"], hacer: [sel(["yo:cementerio"], {}, "c", { n: 2, hasta: true }), mov("barajar", "c"), robar(1)] }],
    continuas: [{ si: "sinReserva", fuerzaPor: "bloquea", a: "tusAliados" }],
    fns: {
      sinReserva: (e, ctx) => e.jugadores[ctx.ctrl].reserva.length === 0,
      bloquea: (e, ctx) => (Object.keys(e.bloqueos).includes(ctx.objetivo) ? 1 : 0),
    },
  },
  "Espejo Magico": {
    disparadas: [{ cuando: ["entra"], hacer: [robar(1)] }],
    activadas: [
      {
        texto: "Pagar un Oro: buscar en tu Castillo una carta que no sea Talismán",
        veces: "turno",
        oros: 1,
        hacer: buscar(["yo:castillo"], { noTipo: ["Talismán"] }),
      },
    ],
  },
  "Espíritu de la Máquina": {
    disparadas: [{ cuando: ["entra"], si: "noPrimerTurno", hacer: [{ op: "generar", n: 1, tipos: ["Arma", "Tótem"] }] }],
    activadas: [
      {
        texto: "Barajar o Desterrar una carta de un Cementerio",
        veces: "turno",
        requiere: { de: ["todos:cementerio"], filtro: {} },
        hacer: [sel(["todos:cementerio"], {}, "c"), barajarODesterrar("c")],
      },
    ],
    fns: { noPrimerTurno: (e, ctx) => e.activo !== ctx.ctrl || e.turno >= 2 },
  },
  "Estandarte del Guerrero": {
    disparadas: [
      { cuando: ["entra"], hacer: [robar(1)] },
      { cuando: ["salenDelCastillo"], quien: "cualquiera", si: "porDano", hacer: [{ op: "fn", f: "silenciar" }] },
    ],
    activadas: [
      {
        texto: "Pagarlo: buscar dos cartas en cada Castillo y ponerlas en el Cementerio",
        requiere: "enReserva",
        coste: desdeLaFuente("pagado"),
        hacer: [
          sel(["yo:castillo"], {}, "a", { n: 2 }),
          mov("cementerio", "a"),
          sel(["rival:castillo"], {}, "b", { n: 2 }),
          mov("cementerio", "b"),
          barajar(),
          barajar("rival"),
        ],
      },
    ],
    fns: {
      enReserva,
      porDano: (e, ctx) => !!ctx.datos.porDano && ctx.datos.zona === "cementerio" && enReserva(e, ctx),
      silenciar: (e, ctx) => {
        for (const u of ctx.datos.uids ?? []) e.conv[u] = { tipo: N.carta(e, u).tipo, sinHabilidad: true, hastaInicioDe: N.rival(e.activo), desde: e.turno };
      },
    },
  },
  "Estrella de Kirin": {
    disparadas: [{ cuando: ["entra"], hacer: [{ op: "fn", f: "mostrar" }, mov("mano", "m")] }],
    activadas: [
      {
        texto: "Pagarlo y convertirlo en un Oro sin habilidad: un Oro o carta de coste 2 o menos pasa a ser del mismo tipo sin habilidad",
        requiere: "puede",
        coste: pagarloYApagarlo,
        hacer: [sel(["todos:enJuego"], { f: "oroOBarato", noFuente: true }), { op: "fn", f: "silenciar" }],
      },
    ],
    fns: {
      apagar: sinHabilidad,
      oroOBarato,
      puede: (e, ctx) => enReserva(e, ctx) && N.todoEnJuego(e).some((u) => u !== ctx.fuente && oroOBarato(e, ctx, u)),
      mostrar: (e, ctx) => {
        let oro = null;
        let equipo = null;
        for (const u of e.jugadores[ctx.ctrl].castillo) {
          const t = N.carta(e, u).tipo;
          if (!oro && t === "Oro") oro = u;
          else if (!equipo && (t === "Arma" || t === "Tótem")) equipo = u;
          if (oro && equipo) break;
        }
        ctx.vars.m = [oro, equipo].filter(Boolean);
      },
      silenciar: (e, ctx) => {
        for (const u of ctx.vars.x ?? []) e.conv[u] = { tipo: N.carta(e, u).tipo, sinHabilidad: true };
      },
    },
  },
  "Flor de Lis": {
    disparadas: [{ cuando: ["entra"], hacer: [{ op: "mostrarHasta", tipos: ["Oro"], como: "m" }, mov("mano", "m"), barajar()] }],
    activadas: [
      {
        texto: "Descartar un Oro: cancelar el ataque de hasta dos Aliados de coste 2 o menos",
        requiere: "puede",
        coste: descartar("d", { tipo: "Oro" }),
        hacer: [sel(["todos:ataque"], { costeMax: 2 }, "x", { n: 2, hasta: true }), { op: "fn", f: "cancelar" }],
      },
    ],
    fns: {
      puede: (e, ctx) =>
        e.jugadores[ctx.ctrl].mano.some((u) => N.carta(e, u).tipo === "Oro") && e.jugadores.some((p) => p.ataque.some((u) => coste(e, u) <= 2)),
      cancelar: (e, ctx) => cancelarAtaque(e, ctx.vars.x ?? []),
    },
  },
  "Frankenstein o el Moderno Prometeo": frankenstein,
  "Frankenstein o el Nuevo Prometeo": frankenstein,
  "Fuente de la Juventud": {
    disparadas: [{ cuando: ["entra"], hacer: [robar(2)] }],
  },
  "Garrote Vil": {
    disparadas: [{ cuando: ["entra"], hacer: [{ op: "mostrarHasta", tipos: ["Tótem", "Oro"], como: "m" }, mov("mano", "m"), barajar()] }],
    activadas: [
      {
        texto: "Convertirlo en un Oro sin habilidad: Barajar o Desterrar hasta cuatro cartas de los Cementerios",
        coste: [{ op: "fn", f: "apagar" }],
        hacer: [sel(["todos:cementerio"], {}, "c", { n: 4, hasta: true }), barajarODesterrar("c")],
      },
    ],
    fns: { apagar: sinHabilidad },
  },
};
