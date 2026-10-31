import * as N from "../nucleo.js";
import { sel, mov, barajar, robar, efecto, buscar, castilloElegido } from "../formato.js";

const pagarFuente = [sel(["fuente"], {}, "yo"), mov("pagado", "yo")];
const enReserva = (e, ctx) => e.jugadores[ctx.ctrl].reserva.includes(ctx.fuente);
const sinOrosPuestos = (e, ctx) => e.jugadores[ctx.ctrl].orosPuestos === 0;
const apagar = (e, ctx) => {
  e.conv[ctx.fuente] = { tipo: "Oro", sinHabilidad: true };
};
const marcarOro = (e, ctx) => {
  e.jugadores[ctx.ctrl].oroJugado = true;
};
const cargar = (e, ctx) => {
  ctx.vars.c = [ctx.datos.uid];
};
const bloquea = (e, ctx) => Object.keys(e.bloqueos).some((b) => N.controlador(e, b) === ctx.ctrl);
const barajarODesterrar = (v) => ({
  op: "modo",
  opciones: [
    { texto: "Barajar", pasos: [mov("barajar", v)] },
    { texto: "Desterrar", pasos: [mov("desterrar", v)] },
  ],
});
const NOMBRABLES = ["todos:enJuego", "todos:cementerio", "rival:mano"];

function contar(e, j, c) {
  const p = e.jugadores[j];
  p.jugadas[c.tipo] = (p.jugadas[c.tipo] ?? 0) + 1;
  p.jugadas.nombres[c.nombre] = (p.jugadas.nombres[c.nombre] ?? 0) + 1;
  if (["Aliado", "Arma", "Tótem"].includes(c.tipo)) p.jugadas.total += 1;
}

function jugarReducido(e, ctx, api, uid, red, minimo) {
  const c = N.carta(e, uid);
  const j = ctx.ctrl;
  const pagar = Math.max(minimo, (c.coste ?? 0) - red);
  if (pagar > api.disponibles(e, j, c.tipo)) return [];
  if (c.tipo === "Arma" && !N.aliadosDe(e, j).some((a) => api.armaCabe(e, a, uid))) return [];
  const desde = N.ubicar(e, uid)?.zona ?? null;
  api.pagarOros(e, j, pagar, c.tipo);
  contar(e, j, c);
  const datos = { pagado: true, desde };
  if (c.tipo === "Talismán") {
    N.sacar(e, uid);
    const pasos = [...(c.talisman ?? []), { op: "finTalisman", uid, destierro: !!c.destierroAlJugar }];
    e.cola.splice(1, 0, N.nuevoFrame(pasos, { ctrl: j, fuente: uid, def: c.id, costeFuente: c.coste ?? 0 }));
    N.disparar(e, "juega", { uid, j, tipo: c.tipo, pagado: true, desde });
    return [];
  }
  N.disparar(e, "juega", { uid, j, tipo: c.tipo, pagado: true, desde });
  if (c.tipo === "Arma") return [sel(["yo:aliados"], { armaLibre: uid }, "_port"), { op: "portar", arma: uid, en: "_port", datos }];
  return [{ op: "entrar", uid, datos }];
}

const ponerDesde = (zona) => ({
  texto: `Poner este Oro desde tu ${zona === "mano" ? "mano" : "Cementerio"} en tu Reserva`,
  zona,
  momento: "vigilia",
  requiere: "sinOros",
  hacer: [sel(["fuente"], {}, "yo"), { op: "ponerOro", var: "yo", a: "reserva" }, { op: "fn", f: "marcarOro" }],
});

export const HABILIDADES = {
  "Malleus Maleficarum": {
    disparadas: [
      { cuando: ["entra"], hacer: [sel(NOMBRABLES, { f: "noMalleus" }, "n"), { op: "fn", f: "nombrar" }] },
      { cuando: ["sale"], hacer: [{ op: "fn", f: "olvidar" }] },
      {
        zona: ["cementerio"],
        cuando: ["faseFinal"],
        si: "otraEnCementerio",
        opcional: true,
        hacer: [sel(["yo:cementerio"], { noFuente: true }, "c"), mov("desterrar", "c"), sel(["fuente"], {}, "yo"), mov("mano", "yo")],
      },
    ],
    fns: {
      noMalleus: (e, ctx, u) => N.carta(e, u).nombre !== "Malleus Maleficarum",
      nombrar: (e, ctx) => {
        for (const u of ctx.vars.n ?? []) N.agregarEfecto(e, { tipo: "pierdeHabilidad", nombre: N.carta(e, u).nombre, origen: ctx.fuente, fin: "juego" }, ctx.ctrl);
      },
      olvidar: (e, ctx) => {
        e.efectos = e.efectos.filter((f) => f.origen !== ctx.fuente);
      },
      otraEnCementerio: (e, ctx) => e.jugadores[ctx.ctrl].cementerio.some((u) => u !== ctx.fuente),
    },
  },
  "Matriz V": {
    claves: ["NoConvertible"],
    disparadas: [{ cuando: ["entra"], hacer: [robar(1), sel(["yo:enJuego"], {}, "i", { n: 2, hasta: true }), efecto("i", { tipo: "gana", clave: "Indestructible" }, "mientras")] }],
  },
  "Medalla de Papa Legba": {
    disparadas: [{ cuando: ["entra"], opcional: true, hacer: [robar(1)] }],
    activadas: [
      {
        texto: "Poner la primera carta del Castillo oponente en tu Oro Pagado como un Oro sin habilidad",
        momento: "vigilia",
        veces: "turno",
        requiere: "puede",
        hacer: [{ op: "tope", quien: "rival", n: 1, como: "t" }, { op: "convertir", var: "t", en: "Oro", a: "pagado" }],
      },
    ],
    fns: {
      puede: (e, ctx) => {
        const jugadas = e.jugadores[N.rival(ctx.ctrl)].jugadas;
        const n = Object.entries(jugadas).filter(([t]) => !["total", "nombres", "anuladas"].includes(t)).reduce((s, [, k]) => s + k, 0);
        return n + (e.jugadores[N.rival(ctx.ctrl)].habilidadesUsadas ?? 0) > 2 && N.aliadosDe(e, ctx.ctrl).some((a) => N.tiene(e, a, "Furia"));
      },
    },
  },
  "Medalla de Santa Muerte": {
    disparadas: [
      {
        cuando: ["comienzoTurno"],
        quien: "cualquiera",
        si: "conMano",
        opcional: true,
        hacer: [sel(["yo:mano"], {}, "d"), mov("cementerio", "d"), sel([...NOMBRABLES, "yo:mano"], { noTipo: ["Oro"] }, "n"), { op: "fn", f: "silenciar" }],
      },
    ],
    fns: {
      conMano: (e, ctx) => e.jugadores[ctx.ctrl].mano.length > 0,
      silenciar: (e, ctx) => {
        for (const u of ctx.vars.n ?? []) N.agregarEfecto(e, { tipo: "pierdeHabilidad", nombre: N.carta(e, u).nombre }, ctx.ctrl);
      },
    },
  },
  "Mente Suprema": {
    continuas: [{ talismanesAlDestierro: true, si: "dosConHabilidad" }],
    fns: { dosConHabilidad: (e, ctx) => N.aliadosDe(e, ctx.ctrl).filter((a) => !N.carta(e, a).sinHabilidad).length >= 2 },
  },
  "Miguel de Cervantes": {
    activadas: [
      {
        texto: "Poner en juego un Aliado de coste 2 o menos de tu Cementerio como un Aliado sin habilidad",
        veces: "turno",
        requiere: "sinAliados",
        hacer: [sel(["yo:cementerio"], { tipo: "Aliado", costeMax: 2 }, "a"), { op: "convertir", var: "a", en: "Aliado", a: "defensa" }],
      },
    ],
    disparadas: [{ cuando: ["anulada"], quien: "yo", veces: 1, si: "aliadoCaro", hacer: [{ op: "generar", n: 1, tipos: ["Aliado"], costeMin: 2 }] }],
    fns: {
      sinAliados: (e, ctx) =>
        N.aliadosDe(e, ctx.ctrl).length === 0 && e.jugadores[ctx.ctrl].cementerio.some((u) => N.carta(e, u).tipo === "Aliado" && (N.carta(e, u).coste ?? 0) <= 2),
      aliadoCaro: (e, ctx) => ctx.datos.tipo === "Aliado" && (N.carta(e, ctx.datos.uid).coste ?? 0) >= 2,
    },
  },
  "Monitor Araucano": {
    activadas: [
      {
        texto: "Mostrar un Arma de tu mano: la primera carta de tu Castillo entra como un Aliado sin habilidad de Fuerza 0",
        veces: "turno",
        requiere: { de: ["yo:mano"], filtro: { tipo: "Arma" } },
        hacer: [sel(["yo:mano"], { tipo: "Arma" }, "m"), { op: "tope", n: 1, como: "t" }, { op: "convertir", var: "t", en: "Aliado", fuerza: 0, a: "defensa" }],
      },
    ],
  },
  "Muro de los Caidos": {
    disparadas: [{ cuando: ["entra"], opcional: true, hacer: buscar(["yo:castillo"], { tipo: ["Aliado", "Tótem"], costeMin: 2 }) }],
  },
  Necronomicon: {
    continuas: [{ gana: "Indestructible", tipoObjetivo: "Oro", a: "aliados" }],
    activadas: [
      {
        texto: "Poner hasta dos cartas de tu mano en el fondo de tu Castillo y Robar esa cantidad",
        veces: "turno",
        requiere: "conMano",
        hacer: [sel(["yo:mano"], {}, "x", { n: 2, hasta: true }), { op: "fn", f: "fondo" }],
      },
    ],
    fns: {
      conMano: (e, ctx) => e.jugadores[ctx.ctrl].mano.length > 0,
      fondo: (e, ctx) => {
        const lista = ctx.vars.x ?? [];
        for (const u of lista) N.mover(e, u, "castillo", { fondo: true });
        N.robar(e, ctx.ctrl, lista.length);
      },
    },
  },
  "Nombre de Horus": {
    disparadas: [
      {
        cuando: ["entra"],
        opcional: true,
        hacer: [
          castilloElegido((quien) =>
            quien === "rival"
              ? [{ op: "tope", quien, n: 6, como: "m" }, sel(["var:m"], { zona: "castillo" }, "d", { n: 3 }), mov("desterrar", "d")]
              : [
                  { op: "tope", quien, n: 6, como: "m" },
                  sel(["var:m"], { zona: "castillo" }, "a"),
                  mov("mano", "a"),
                  sel(["var:m"], { zona: "castillo" }, "c", { n: 2 }),
                  mov("cementerio", "c"),
                ],
          ),
        ],
      },
    ],
  },
  "Orden del Dragón": {
    disparadas: [
      {
        cuando: ["entra"],
        hacer: [
          sel(["todos:enJuego"], { costeMax: 2, noFuente: true }, "x", { hasta: true }),
          efecto("x", { tipo: "pierdeHabilidad" }, "turno"),
          {
            op: "modo",
            opciones: ["Arma", "Tótem"].map((tipo) => ({
              texto: `Nombrar ${tipo}`,
              pasos: [{ op: "mostrarHasta", n: 1, filtro: { tipo }, como: "m" }, mov("mano", "m"), barajar()],
            })),
          },
        ],
      },
    ],
  },
  Pallax: {
    continuas: [{ proteccion: { por: ["Oro"], cuesta: 1 }, a: "tusAliados", tipoObjetivo: "Aliado", conArma: true }],
    disparadas: [{ cuando: ["entra"], hacer: [{ op: "tope", n: 1, como: "a" }, { op: "tope", n: 1, fondo: true, como: "b" }, mov("mano", "a"), mov("mano", "b")] }],
    activadas: [
      {
        texto: "Desterrar dos cartas de tu Cementerio: ponerlo en juego como un Aliado sin habilidad de Fuerza 2",
        zona: "cementerio",
        requiere: "dosMas",
        coste: [sel(["yo:cementerio"], { noFuente: true }, "c", { n: 2 }), mov("desterrar", "c")],
        hacer: [sel(["fuente"], {}, "yo"), { op: "convertir", var: "yo", en: "Aliado", fuerza: 2, a: "defensa" }],
      },
    ],
    fns: { dosMas: (e, ctx) => e.jugadores[ctx.ctrl].cementerio.filter((u) => u !== ctx.fuente).length >= 2 },
  },
  "Pan de Muerto": {
    activadas: [
      {
        texto: "Pagarlo: buscar un Talismán o Tótem de coste 2 o más en tu Castillo y jugarlo reduciendo su coste en un Oro",
        momento: "vigilia",
        veces: "turno",
        requiere: "enReserva",
        coste: pagarFuente,
        hacer: [sel(["yo:castillo"], { tipo: ["Talismán", "Tótem"], costeMin: 2 }, "b"), { op: "fn", f: "jugarB" }, barajar()],
      },
    ],
    continuas: [{ gana: "Indestructible", a: "tusAliados", si: "bloquea" }],
    fns: {
      enReserva,
      bloquea,
      jugarB: (e, ctx, api) => (ctx.vars.b ?? []).flatMap((u) => jugarReducido(e, ctx, api, u, 1, 0)),
    },
  },
  "Patria Vieja": {
    activadas: [
      {
        texto: "Mirar las primeras seis cartas de tu Castillo y poner un Oro de ahí en tu Reserva",
        momento: "vigilia",
        veces: "turno",
        requiere: "sinOros",
        hacer: [{ op: "tope", n: 6, como: "m" }, sel(["var:m"], { zona: "castillo", tipo: "Oro" }, "o"), { op: "ponerOro", var: "o", a: "reserva" }],
      },
    ],
    continuas: [
      { fuerza: 1, a: "tusAliados", costeMin: 1 },
      { gana: "Indestructible", a: "tusAliados", costeMin: 1, si: "bloquea" },
    ],
    fns: { sinOros: sinOrosPuestos, bloquea },
  },
  Pebre: {
    disparadas: [
      {
        cuando: ["entra"],
        hacer: [sel(["yo:castillo"], { f: "empanada" }, "a"), mov("mano", "a"), sel(["yo:castillo"], { f: "anticucho" }, "b"), mov("mano", "b"), barajar()],
      },
    ],
    activadas: [
      {
        texto: "Destruir un Oro que controles: jugar un Anticucho o Terremoto de tu mano reduciendo su coste en un Oro",
        veces: "turno",
        requiere: "puede",
        coste: [sel(["yo:oros"], {}, "o", { para: "destruir" }), mov("destruir", "o")],
        hacer: [sel(["yo:mano"], { f: "comida" }, "b"), { op: "fn", f: "jugarB" }],
      },
    ],
    fns: {
      empanada: (e, ctx, u) => N.carta(e, u).nombre === "Empanada",
      anticucho: (e, ctx, u) => N.carta(e, u).nombre === "Anticucho",
      comida: (e, ctx, u) => ["Anticucho", "Terremoto"].includes(N.carta(e, u).nombre),
      puede: (e, ctx) =>
        e.jugadores[ctx.ctrl].mano.some((u) => ["Anticucho", "Terremoto"].includes(N.carta(e, u).nombre)) &&
        N.orosDe(e, ctx.ctrl).some((o) => !N.tiene(e, o, "Indestructible")),
      jugarB: (e, ctx, api) => (ctx.vars.b ?? []).flatMap((u) => jugarReducido(e, ctx, api, u, 1, 0)),
    },
  },
  "Peral Encantado": {
    desdeCementerio: { oro: true },
    disparadas: [{ cuando: ["entra"], hacer: [{ op: "fn", f: "peral" }] }],
    fns: {
      peral: (e, ctx) => {
        const castillo = e.jugadores[ctx.ctrl].castillo;
        const oro = (sin) => castillo.find((u) => N.carta(e, u).tipo === "Oro" && !!N.carta(e, u).sinHabilidad === sin);
        const hallados = [oro(false), oro(true)].filter(Boolean);
        for (const u of hallados) N.mover(e, u, "mano");
        N.barajarCastillo(e, ctx.ctrl);
      },
    },
  },
  "Perla de Sangre": {
    activadas: [
      {
        texto: "Pagarlo: buscar un Aliado en tu Castillo y ponerlo en tu mano o jugarlo reduciendo su coste en un Oro",
        momento: "vigilia",
        veces: "turno",
        requiere: "enReserva",
        coste: pagarFuente,
        hacer: [
          sel(["yo:castillo"], { tipo: "Aliado" }, "b"),
          {
            op: "modo",
            opciones: [
              { texto: "Ponerlo en tu mano", pasos: [mov("mano", "b")] },
              { texto: "Jugarlo reduciendo su coste en un Oro", pasos: [{ op: "fn", f: "jugarB" }] },
            ],
          },
          barajar(),
        ],
      },
      {
        texto: "Convertirlo en un Oro sin habilidad: Barajar o Desterrar hasta cuatro cartas de los Cementerios y Robar hasta dos",
        coste: [{ op: "fn", f: "apagar" }],
        hacer: [sel(["todos:cementerio"], {}, "c", { n: 4, hasta: true }), barajarODesterrar("c"), { op: "robarHasta", n: 2 }],
      },
    ],
    fns: {
      enReserva,
      apagar,
      jugarB: (e, ctx, api) => (ctx.vars.b ?? []).flatMap((u) => jugarReducido(e, ctx, api, u, 1, 1)),
    },
  },
  "Piedra del Chaman": {
    disparadas: [
      { zona: ["cementerio"], cuando: ["alCementerio"], quien: "propia", si: "porRival", hacer: [sel(["fuente"], {}, "yo"), mov("pagado", "yo")] },
      { cuando: ["entra"], hacer: [robar(1)] },
      { cuando: ["alCementerio"], quien: "cualquiera", veces: 1, opcional: true, hacer: [{ op: "fn", f: "cargar" }, mov("desterrar", "c")] },
    ],
    fns: {
      cargar,
      porRival: (e, ctx) => {
        const fr = e.cola[0];
        return !!fr && fr.ctx.ctrl !== ctx.ctrl;
      },
    },
  },
  "Pintura Sagrada": {
    activadas: [ponerDesde("mano")],
    disparadas: [
      { cuando: ["entra"], hacer: buscar(["yo:castillo"], {}, "cementerio") },
      { cuando: ["faseFinal"], quien: "cualquiera", si: "hayCementerio", opcional: true, hacer: [sel(["todos:cementerio"], {}, "c"), barajarODesterrar("c")] },
    ],
    fns: {
      sinOros: sinOrosPuestos,
      marcarOro,
      hayCementerio: (e) => e.jugadores.some((p) => p.cementerio.length > 0),
    },
  },
  "Polvo de Hadas": {
    disparadas: [
      {
        cuando: ["entra"],
        opcional: true,
        hacer: [
          { op: "tope", n: 3, como: "m" },
          sel(["var:m"], { zona: "castillo" }, "a"),
          mov("mano", "a"),
          sel(["var:m"], { zona: "castillo" }, "b"),
          mov("cementerio", "b"),
          sel(["var:m"], { zona: "castillo" }, "c"),
          {
            op: "modo",
            opciones: [
              { texto: "Destierro", pasos: [mov("desterrar", "c")] },
              { texto: "Fondo de tu Castillo", pasos: [mov("fondo", "c")] },
            ],
          },
        ],
      },
    ],
  },
  "Primer Escudo": {
    activadas: [
      ponerDesde("mano"),
      ponerDesde("cementerio"),
      {
        texto: "Convertirlo en un Oro sin habilidad, pagar un Oro y mostrar dos Aliados de tu mano: Anular un Talismán",
        oros: 1,
        respuesta: { anula: { tipo: "Talismán" } },
        coste: [{ op: "fn", f: "apagar" }, sel(["yo:mano"], { tipo: "Aliado" }, "m", { n: 2 })],
        hacer: [],
      },
    ],
    fns: { sinOros: sinOrosPuestos, marcarOro, apagar },
  },
  "Quantum Megumi": {
    activadas: [
      {
        texto: "Barajar una carta de tu mano: Barajar hasta tres cartas de tu Cementerio y Robar una carta",
        veces: "turno",
        requiere: "conMano",
        coste: [sel(["yo:mano"], {}, "m"), mov("barajar", "m")],
        hacer: [sel(["yo:cementerio"], {}, "c", { n: 3, hasta: true }), mov("barajar", "c"), robar(1)],
      },
    ],
    disparadas: [{ cuando: ["faseFinal"], opcional: true, hacer: [sel(["todos:cementerio"], {}, "c", { n: 2, hasta: true }), mov("desterrar", "c")] }],
    fns: { conMano: (e, ctx) => e.jugadores[ctx.ctrl].mano.length > 0 },
  },
  "Retrato de la Condesa": {
    disparadas: [{ cuando: ["entra"], hacer: buscar(["yo:castillo"], { tipo: "Oro" }) }],
    continuas: [{ noTomarControl: true }],
  },
  Romualdito: {
    disparadas: [
      {
        cuando: ["comienzoVigilia"],
        quien: "cualquiera",
        si: "sinReserva",
        hacer: [{ op: "desterrarTope", n: 2, quien: "yo" }, sel(["todos:cementerio"], {}, "c", { hasta: true }), mov("desterrar", "c")],
      },
    ],
    fns: { sinReserva: (e, ctx) => e.jugadores[ctx.ctrl].reserva.length === 0 },
  },
  Salitre: {
    continuas: [{ gana: "Indesterrable", tipoObjetivo: "Oro", a: "aliados" }],
    disparadas: [
      { cuando: ["entra"], hacer: [robar(2), sel(["yo:mano"], {}, "m"), mov("barajar", "m")] },
      { cuando: ["saleDelJuego"], quien: "cualquiera", si: "oroDestruido", hacer: [{ op: "fn", f: "cargar" }, mov("barajar", "c")] },
    ],
    activadas: [
      {
        texto: "Poner un Oro de tu Cementerio en juego como si estuviera en tu mano",
        momento: "vigilia",
        requiere: "puedeOro",
        hacer: [sel(["yo:cementerio"], { tipo: "Oro" }, "o"), { op: "ponerOro", var: "o", a: "reserva" }, { op: "fn", f: "marcarOro" }],
      },
    ],
    fns: {
      cargar,
      marcarOro,
      oroDestruido: (e, ctx) => ctx.datos.tipo === "Oro" && N.ubicar(e, ctx.datos.uid)?.zona === "cementerio",
      puedeOro: (e, ctx) => {
        const p = e.jugadores[ctx.ctrl];
        if (p.oroJugado || p.otraJugada) return false;
        if (e.efectos.some((f) => f.tipo === "noJugarMas" && (f.j === undefined || f.j === ctx.ctrl))) return false;
        return p.cementerio.some((u) => N.carta(e, u).tipo === "Oro");
      },
    },
  },
};
