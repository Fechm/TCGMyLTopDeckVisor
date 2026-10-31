import * as N from "../nucleo.js";
import { sel, mov, barajar, robar, efecto, buscar, castilloElegido, coste } from "../formato.js";
import { armaCabe } from "../efectos.js";

const conMano = (e, ctx) => e.jugadores[ctx.ctrl].mano.length > 0;
const nOros = (e, ctx) => N.orosDe(e, ctx.ctrl).length;
const cargarDato = (e, ctx) => {
  ctx.vars.c = [ctx.datos.uid];
};

const barajarYDesterrar = (n) => [
  sel(["todos:cementerio"], {}, "c", { n, hasta: true }),
  mov("barajar", "c"),
  sel(["todos:cementerio"], {}, "d", { nf: "resto", hasta: true }),
  mov("desterrar", "d"),
];

const viajeAlCentro = {
  disparadas: [
    {
      cuando: ["anulada"],
      quien: "yo",
      veces: 1,
      si: "noTalisman",
      opcional: true,
      hacer: [{ op: "desterrarTope", n: 1, quien: "yo" }, { op: "fn", f: "cargar" }, sel(["var:c"], { zona: "cementerio" }, "s"), mov("mano", "s")],
    },
    { cuando: ["juega"], quien: "yo", si: "pagadoConEste", hacer: [robar(1)] },
  ],
  fns: {
    noTalisman: (e, ctx) => ctx.datos.tipo !== "Talismán",
    cargar: cargarDato,
    pagadoConEste: (e, ctx) => {
      const k = coste(e, ctx.datos.uid);
      if (!ctx.datos.pagado || k < 2) return false;
      const pagado = e.jugadores[ctx.ctrl].pagado;
      return pagado.slice(Math.max(0, pagado.length - k)).includes(ctx.fuente);
    },
  },
};

const nombrar = (filtro = {}) => sel(["rival:mano", "rival:castillo", "rival:cementerio", "todos:enJuego"], filtro, "n");

const portadorLibre = (e, ctx, u) => u !== ctx.fuente && armaCabe(e, u, ctx.fuente);

export const HABILIDADES = {
  "Salmón del Saber": {
    continuas: [{ proteccion: { por: ["Talismán"] }, a: "propia" }],
    disparadas: [{ cuando: ["comienzoVigilia"], hacer: [{ op: "fn", f: "robarHastaDos" }] }],
    fns: {
      robarHastaDos: (e, ctx) => {
        const falta = 2 - e.jugadores[ctx.ctrl].mano.length;
        if (falta > 0) N.robar(e, ctx.ctrl, falta);
      },
    },
  },
  "Sarcófago": {
    disparadas: [{ cuando: ["entra"], hacer: [robar(1)] }],
    activadas: [
      {
        texto: "Descartar una carta: Barajar hasta tres cartas de los Cementerios y subir hasta un Aliado de coste 2 o menos de tu Cementerio a tu mano",
        veces: "turno",
        requiere: "conMano",
        coste: [sel(["yo:mano"], {}, "d"), mov("cementerio", "d")],
        hacer: [
          sel(["todos:cementerio"], {}, "c", { n: 3, hasta: true }),
          mov("barajar", "c"),
          sel(["yo:cementerio"], { tipo: "Aliado", costeMax: 2 }, "a", { hasta: true }),
          mov("mano", "a"),
        ],
      },
    ],
    continuas: [{ cementerioIndesterrable: { conClave: "Exhumar" } }],
    fns: { conMano },
  },
  "Sarcófago Impío": {
    disparadas: [
      {
        cuando: ["entra"],
        hacer: [
          { op: "tope", n: 4, fondo: true, como: "m" },
          sel(["var:m"], { zona: "castillo" }, "a"),
          mov("mano", "a"),
          sel(["var:m"], { zona: "castillo" }, "b"),
          mov("cementerio", "b"),
        ],
      },
    ],
    activadas: [
      {
        texto: "Un Aliado gana Indestructible, Indesterrable o No puede ser Barajado hasta tu próximo turno",
        veces: "turno",
        requiere: { de: ["todos:aliados"], filtro: {} },
        hacer: [
          sel(["todos:aliados"]),
          {
            op: "modo",
            opciones: [
              { texto: "Indestructible", pasos: [efecto("x", { tipo: "gana", clave: "Indestructible" }, "proximoTurno")] },
              { texto: "Indesterrable", pasos: [efecto("x", { tipo: "gana", clave: "Indesterrable" }, "proximoTurno")] },
              { texto: "No puede ser Barajado", pasos: [efecto("x", { tipo: "gana", clave: "NoBarajable" }, "proximoTurno")] },
            ],
          },
        ],
      },
    ],
    continuas: [{ fuerza: -1, a: "aliadosRival" }],
  },
  Snagov: {
    disparadas: [
      { cuando: ["entra"], hacer: [sel(["todos:aliados"], {}, "x", { n: 2, hasta: true }), efecto("x", { tipo: "fuerza", n: 2 }, "juego")] },
      { cuando: ["faseFinal"], si: "sinReserva", hacer: [sel(["yo:cementerio"], { tipo: "Aliado" }, "a"), mov("mano", "a")] },
    ],
    activadas: [
      {
        texto: "Pagar un Oro: una carta pierde su habilidad por el turno",
        veces: "turno",
        oros: 1,
        hacer: [sel(["todos:enJuego"]), efecto("x", { tipo: "pierdeHabilidad" }, "turno")],
      },
    ],
    fns: { sinReserva: (e, ctx) => e.jugadores[ctx.ctrl].reserva.length === 0 },
  },
  "Tablas del Juramento": {
    disparadas: [
      {
        zona: ["mano", "cementerio"],
        cuando: ["juega"],
        quien: "rival",
        si: "segundaSinPagar",
        opcional: true,
        hacer: [sel(["fuente"], {}, "yo"), { op: "ponerOro", var: "yo", a: "pagado" }],
      },
      { cuando: ["juega"], quien: "cualquiera", si: "sinPagar", hacer: [{ op: "fn", f: "limitarSinPagar" }] },
    ],
    fns: {
      sinPagar: (e, ctx) => ctx.datos.pagado === false,
      limitarSinPagar: (e, ctx) => {
        N.agregarEfecto(e, { tipo: "noSinPagar", j: ctx.datos.j, fin: "turno" }, ctx.ctrl);
      },
      segundaSinPagar: (e, ctx) => {
        if (ctx.datos.pagado !== false) return false;
        const clave = `tablas|${ctx.fuente}`;
        const uso = e.usos[clave];
        const n = uso?.turno === e.turno ? uso.n + 1 : 1;
        e.usos[clave] = { turno: e.turno, n };
        return n === 2 && ["mano", "cementerio"].includes(N.ubicar(e, ctx.fuente)?.zona);
      },
    },
  },
  Tamales: {
    continuas: [{ proteccion: { por: ["Aliado"] }, a: "propia" }],
    disparadas: [{ cuando: ["faseFinal"], hacer: [sel(["todos:cementerio"], {}, "c", { n: 3, hasta: true }), mov("barajar", "c")] }],
  },
  "Terminal P-12": {
    continuas: [{ zona: "reserva", noPierden: true, a: "tusAliados", tipoObjetivo: ["Aliado", "Arma", "Tótem", "Oro", "Talismán"] }],
  },
  "Tesoro de Bandido": {
    disparadas: [{ cuando: ["entra"], hacer: buscar(["yo:castillo"], { f: "bandido" }) }],
    activadas: [
      {
        texto: "Poner un Oro del Cementerio oponente en tu Reserva",
        momento: "vigilia",
        requiere: "puede",
        hacer: [sel(["rival:cementerio"], { tipo: "Oro" }, "o"), mov("reserva", "o")],
      },
    ],
    continuas: [{ fuerza: 1, a: "tusAliados", raza: "Bandido" }],
    fns: {
      bandido: (e, ctx, u) => (N.carta(e, u).razas ?? []).includes("Bandido"),
      puede: (e, ctx) => e.jugadores[ctx.ctrl].orosPuestos === 0 && e.jugadores[N.rival(ctx.ctrl)].cementerio.some((u) => N.carta(e, u).tipo === "Oro"),
    },
  },
  "Tesoro de la Marquesa": {
    activadas: [
      {
        texto: "Destruir un Oro de tu Reserva: mostrar del tope de tu Castillo hasta un Oro, ponerlo en tu Reserva y Barajar el resto",
        momento: "tuTurno",
        veces: "turno",
        requiere: { de: ["yo:reserva"], filtro: { tipo: "Oro" }, para: "destruir" },
        coste: [sel(["yo:reserva"], { tipo: "Oro" }, "d", { para: "destruir" }), mov("destruir", "d")],
        hacer: [{ op: "mostrarHasta", n: 1, filtro: { tipo: "Oro" }, como: "m" }, mov("reserva", "m"), barajar()],
      },
    ],
    disparadas: [{ cuando: ["alCementerio"], quien: "cualquiera", veces: 1, opcional: true, hacer: [{ op: "fn", f: "cargar" }, mov("desterrar", "c")] }],
    fns: { cargar: cargarDato },
  },
  "Tesoro de los Cesares": {
    claves: ["UnaCopia"],
    disparadas: [{ cuando: ["entra"], hacer: [{ op: "tope", nf: "nOros", como: "m" }, sel(["var:m"], { zona: "castillo" }, "a", { n: 2 }), mov("mano", "a")] }],
    activadas: [
      {
        texto: "Barajar una carta de tu mano: nombrar una carta, que cuesta un Oro adicional el próximo turno",
        veces: "turno",
        requiere: "conMano",
        coste: [sel(["yo:mano"], {}, "b"), mov("barajar", "b")],
        hacer: [nombrar(), { op: "fn", f: "encarecer" }],
      },
    ],
    fns: {
      nOros,
      conMano,
      encarecer: (e, ctx) => {
        for (const u of ctx.vars.n ?? []) N.agregarEfecto(e, { tipo: "impuesto", nombre: N.carta(e, u).nombre, n: 1, fin: "dosTurnos" }, ctx.ctrl);
      },
    },
  },
  "Tesoro del Santiaguillo": {
    disparadas: [
      { cuando: ["entra"], hacer: buscar(["todos:castillo"], { tipo: "Aliado" }, "cementerio") },
      { cuando: ["sale"], si: "destruido", opcional: true, hacer: [sel(["fuente"], {}, "yo"), { op: "fn", f: "convertir" }] },
      { cuando: ["ataca"], si: "comoAliado", hacer: buscar(["todos:castillo"], {}, "desterrar") },
    ],
    fns: {
      comoAliado: (e, ctx) => e.conv[ctx.fuente]?.tipo === "Aliado",
      destruido: (e, ctx) => {
        const clave = `santiaguillo|${ctx.fuente}`;
        if (e.usos[clave]) {
          delete e.usos[clave];
          return false;
        }
        return N.ubicar(e, ctx.fuente)?.zona === "cementerio";
      },
      convertir: (e, ctx) => {
        e.usos[`santiaguillo|${ctx.fuente}`] = true;
        return [{ op: "convertir", var: "yo", en: "Aliado", fuerza: 1, a: "defensa", como: ctx.def }, efecto("yo", { tipo: "gana", clave: "Furia" }, "mientras")];
      },
    },
  },
  Trapelacucha: {
    disparadas: [
      {
        cuando: ["entra"],
        hacer: [
          {
            op: "modo",
            opciones: [
              { texto: "Robar una carta", pasos: [robar(1)] },
              {
                texto: "Subir hasta dos cartas que no sean Talismán de tu Cementerio a tu mano",
                pasos: [sel(["yo:cementerio"], { noTipo: ["Talismán"] }, "s", { n: 2, hasta: true }), mov("mano", "s")],
              },
            ],
          },
        ],
      },
      { cuando: ["faseFinal"], si: "libre", opcional: true, hacer: [{ op: "fn", f: "marcar" }, ...barajarYDesterrar(2)] },
    ],
    activadas: [
      {
        texto: "Barajar y/o Desterrar hasta dos cartas de los Cementerios",
        momento: "vigilia",
        requiere: "libre",
        hacer: [{ op: "fn", f: "marcar" }, ...barajarYDesterrar(2)],
      },
    ],
    fns: {
      libre: (e, ctx) => e.usos[`trapelacucha|${ctx.fuente}`] !== e.turno,
      marcar: (e, ctx) => {
        e.usos[`trapelacucha|${ctx.fuente}`] = e.turno;
      },
      resto: (e, ctx) => 2 - (ctx.vars.c ?? []).length,
    },
  },
  "Trofeo de Cazador": {
    disparadas: [{ cuando: ["entra"], hacer: buscar(["yo:castillo"], { tipo: "Oro" }) }],
    activadas: [
      {
        texto: "Desterrar este Oro: convertir una carta en una carta del mismo tipo sin habilidad",
        coste: [sel(["fuente"], {}, "yo"), mov("desterrar", "yo")],
        hacer: [sel(["todos:enJuego"], { noFuente: true }), { op: "fn", f: "apagar" }],
      },
    ],
    fns: {
      apagar: (e, ctx) => {
        for (const u of ctx.vars.x ?? []) {
          if (!N.enJuego(e, u)) continue;
          const tipo = N.carta(e, u).tipo;
          e.conv[u] = { ...(e.conv[u] ?? {}), tipo, sinHabilidad: true, como: undefined };
        }
      },
    },
  },
  "Trono Divino": {
    continuas: [{ si: "miTurno", noAnulables: { tipoCarta: ["Arma", "Tótem"], costeMin: 2, primera: true } }],
    disparadas: [
      {
        cuando: ["comienzoVigilia"],
        si: "dosArmasTotem",
        opcional: true,
        hacer: [
          { op: "tope", n: 1, como: "m" },
          { op: "modo", opciones: [{ texto: "A tu mano", pasos: [mov("mano", "m")] }, { texto: "A tu Cementerio", pasos: [mov("cementerio", "m")] }] },
        ],
      },
    ],
    fns: {
      miTurno: (e, ctx) => e.activo === ctx.ctrl,
      dosArmasTotem: (e, ctx) => N.armasDe(e, ctx.ctrl).length + e.jugadores[ctx.ctrl].apoyo.filter((u) => N.carta(e, u).tipo === "Tótem").length >= 2,
    },
  },
  "Trono del Cielo": {
    claves: ["UnaCopia"],
    disparadas: [
      {
        cuando: ["entra"],
        hacer: [{ op: "tope", n: 3, como: "m" }, sel(["var:m"], { zona: "castillo" }, "a"), mov("mano", "a"), sel(["var:m"], { zona: "castillo" }, "b"), mov("fondo", "b")],
      },
    ],
  },
  "Trono del Dragón": {
    disparadas: [{ cuando: ["entra"], hacer: [sel(["yo:mano"], {}, "b", { n: 2 }), mov("barajar", "b"), robar(3)] }],
    continuas: [{ si: "tresMismaRaza", fuerza: 1, a: "tusAliados" }],
    fns: {
      tresMismaRaza: (e, ctx) => {
        const cuenta = {};
        for (const a of N.aliadosDe(e, ctx.ctrl)) for (const r of N.carta(e, a).razas ?? []) cuenta[r] = (cuenta[r] ?? 0) + 1;
        return Object.values(cuenta).some((n) => n >= 3);
      },
    },
  },
  "Trono del Rey Eterno": {
    disparadas: [{ cuando: ["entra"], hacer: [{ op: "tope", nf: "nOros", como: "m" }, sel(["var:m"], { zona: "castillo" }, "a"), mov("mano", "a")] }],
    fns: { nOros },
  },
  Tukuturi: {
    disparadas: [{ cuando: ["entra"], hacer: [{ op: "fn", f: "apagarOros" }] }],
    fns: {
      apagarOros: (e, ctx) => {
        for (const u of N.todoEnJuego(e)) {
          if (u !== ctx.fuente && N.carta(e, u).tipo === "Oro") N.agregarEfecto(e, { tipo: "pierdeHabilidad", uid: u, fin: "proximoTurno" }, ctx.ctrl);
        }
      },
    },
  },
  Udjat: {
    activadas: [
      {
        texto: "Dos Aliados ganan o pierden 1 de Fuerza por el turno, o Barajar una carta de tu mano para Robar una carta",
        veces: "turno",
        hacer: [
          {
            op: "modo",
            opciones: [
              {
                texto: "Dos Aliados ganan o pierden 1 de Fuerza",
                requiere: { de: ["todos:aliados"], filtro: {} },
                pasos: [
                  sel(["todos:aliados"], {}, "x", { n: 2 }),
                  {
                    op: "modo",
                    opciones: [
                      { texto: "Ganan 1", pasos: [efecto("x", { tipo: "fuerza", n: 1 })] },
                      { texto: "Pierden 1", pasos: [efecto("x", { tipo: "fuerza", n: -1 })] },
                    ],
                  },
                ],
              },
              { texto: "Barajar una carta de tu mano para Robar una carta", requiere: { de: ["yo:mano"], filtro: {} }, pasos: [sel(["yo:mano"], {}, "b"), mov("barajar", "b"), robar(1)] },
            ],
          },
        ],
      },
    ],
    disparadas: [
      {
        cuando: ["faseFinal"],
        hacer: [
          {
            op: "opcional",
            texto: "Desterrar una carta de tu Cementerio para Desterrar hasta dos cartas del Cementerio oponente",
            requiere: { de: ["yo:cementerio"], filtro: {} },
            pasos: [sel(["yo:cementerio"], {}, "c"), mov("desterrar", "c"), sel(["rival:cementerio"], {}, "r", { n: 2, hasta: true }), mov("desterrar", "r")],
          },
        ],
      },
    ],
  },
  "Un Viaje al Centro de la Tierra": viajeAlCentro,
  "Veinte Mil Leguas de Viaje Submarino": {
    disparadas: [
      {
        zona: ["cementerio"],
        cuando: ["comienzoVigilia"],
        quien: "cualquiera",
        hacer: [
          {
            op: "opcional",
            texto: "Descartar una carta para subir un Oro de tu Cementerio a tu mano",
            requiere: "puede",
            pasos: [sel(["yo:mano"], {}, "d"), mov("cementerio", "d"), sel(["yo:cementerio"], { tipo: "Oro" }, "o"), mov("mano", "o")],
          },
        ],
      },
      { cuando: ["entra"], hacer: [{ op: "mostrarHasta", n: 1, filtro: { tipo: "Oro" }, como: "m" }, mov("mano", "m"), barajar()] },
    ],
    fns: {
      puede: (e, ctx) => {
        const p = e.jugadores[ctx.ctrl];
        return p.mano.length > 0 && [...p.cementerio, ...p.mano].some((u) => N.carta(e, u).tipo === "Oro");
      },
    },
  },
  "Viaje al Centro de la Tierra": viajeAlCentro,
  "Yelmo Jepresh": {
    activadas: [
      {
        texto: "Descartar una carta: mostrar del tope de tu Castillo hasta una carta del mismo tipo, ponerla en tu mano y Barajar el resto",
        veces: "turno",
        requiere: "conMano",
        coste: [sel(["yo:mano"], {}, "d"), mov("cementerio", "d")],
        hacer: [{ op: "fn", f: "mostrarTipo" }],
      },
      {
        texto: "Desterrar este Oro: Barajar dos cartas de tu Cementerio y Robar dos cartas",
        coste: [sel(["fuente"], {}, "yo"), mov("desterrar", "yo")],
        hacer: [sel(["yo:cementerio"], {}, "c", { n: 2 }), mov("barajar", "c"), robar(2)],
      },
    ],
    fns: {
      conMano,
      mostrarTipo: (e, ctx) => {
        const [d] = ctx.vars.d ?? [];
        if (!d) return [];
        return [{ op: "mostrarHasta", n: 1, filtro: { tipo: N.carta(e, d).tipo }, como: "m" }, mov("mano", "m"), barajar()];
      },
    },
  },
  "Zapatillas Rojas": {
    disparadas: [{ cuando: ["entra"], hacer: [nombrar({ costeMax: 3 }), { op: "fn", f: "recordar" }, robar(1)] }],
    fns: {
      recordar: (e, ctx) => {
        const [u] = ctx.vars.n ?? [];
        if (u) N.agregarEfecto(e, { tipo: "impuestoHabilidad", nombre: N.carta(e, u).nombre, n: 1, uid: ctx.fuente, fin: "mientras" }, ctx.ctrl);
      },
    },
  },
  Aho: {
    claves: ["Exhumar"],
    portador: { fuerza: 3 },
    activadas: [
      {
        texto: "Desterrar un Aliado o Tótem y cinco cartas del tope de un Castillo",
        veces: "turno",
        hacer: [
          sel(["todos:aliados", "todos:apoyo"], { tipo: ["Aliado", "Tótem"] }, "x", { para: "desterrar" }),
          mov("desterrar"),
          castilloElegido((quien) => [{ op: "desterrarTope", n: 5, quien }]),
        ],
      },
    ],
    disparadas: [
      { cuando: ["entra"], hacer: [{ op: "fn", f: "registrar" }] },
      {
        zona: ["cementerio"],
        cuando: ["saleDelJuego"],
        quien: "cualquiera",
        si: "salioPortador",
        hacer: [
          {
            op: "modo",
            opciones: [
              { texto: "Subirla a tu mano", pasos: [sel(["fuente"], {}, "yo"), mov("mano", "yo")] },
              { texto: "Cambiarla de portador", requiere: "hayPortador", pasos: [sel(["yo:aliados"], { f: "libre" }, "p"), { op: "fn", f: "reportar" }] },
            ],
          },
        ],
      },
    ],
    fns: {
      registrar: (e, ctx) => {
        const p = N.portadorDe(e, ctx.fuente);
        if (p) e.usos[`aho|${ctx.fuente}`] = p;
      },
      salioPortador: (e, ctx) => N.ubicar(e, ctx.fuente)?.zona === "cementerio" && e.usos[`aho|${ctx.fuente}`] === ctx.datos.uid,
      libre: portadorLibre,
      hayPortador: (e, ctx) => N.aliadosDe(e, ctx.ctrl).some((u) => portadorLibre(e, ctx, u)),
      reportar: (e, ctx) => {
        const [p] = ctx.vars.p ?? [];
        if (!p) return;
        N.sacar(e, ctx.fuente);
        (e.armas[p] ??= []).push(ctx.fuente);
        e.usos[`aho|${ctx.fuente}`] = p;
      },
    },
  },
};
