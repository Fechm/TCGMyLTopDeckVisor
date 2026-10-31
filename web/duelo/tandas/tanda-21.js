import * as N from "../nucleo.js";
import { sel, mov, barajar, robar, buscar, castilloElegido, coste } from "../formato.js";

const desdeLaFuente = (a) => [sel(["fuente"], {}, "yo"), mov(a, "yo")];

const barajarCementerios = (n, de = "todos:cementerio") => [sel([de], {}, "c", { n, hasta: true }), mov("barajar", "c")];

const enReserva = (e, ctx) => e.jugadores[ctx.ctrl].reserva.includes(ctx.fuente);

const libreParaArma = (e, u) => !N.tiene(e, u, "NoPortaArmas") && !(e.armas[u] ?? []).length;

const orosLibres = (e, j) => e.jugadores[j].reserva.length + (e.jugadores[j].generados ?? []).reduce((s, g) => s + g.n, 0);

const pagable = (rebaja) => (e, ctx, u) => {
  const c = N.carta(e, u);
  if (c.tipo === "Oro") return false;
  if (Math.max(0, coste(e, u) - rebaja) > orosLibres(e, ctx.ctrl)) return false;
  return c.tipo !== "Arma" || N.aliadosDe(e, ctx.ctrl).some((a) => libreParaArma(e, a));
};

function contarJugada(e, j, c) {
  const p = e.jugadores[j];
  p.jugadas[c.tipo] = (p.jugadas[c.tipo] ?? 0) + 1;
  p.jugadas.nombres[c.nombre] = (p.jugadas.nombres[c.nombre] ?? 0) + 1;
  if (["Aliado", "Arma", "Tótem"].includes(c.tipo)) p.jugadas.total += 1;
}

function talismanValido(e, j, u, c, api) {
  if (!c.requiere) return true;
  const ctxT = { ctrl: j, fuente: u, def: c.id, costeFuente: c.coste ?? 0, vars: {} };
  if (typeof c.requiere === "string") return c.fns[c.requiere](e, ctxT);
  return api.hayObjetivo(e, ctxT, c.requiere);
}

function jugarCarta(e, ctx, api, u, rebaja) {
  const c = N.carta(e, u);
  const j = ctx.ctrl;
  const desde = N.ubicar(e, u)?.zona ?? "mano";
  const pagar = Math.max(0, coste(e, u) - rebaja);
  if (pagar > api.disponibles(e, j, c.tipo)) return;
  if (c.tipo === "Talismán" && !talismanValido(e, j, u, c, api)) return;
  api.pagarOros(e, j, pagar, c.tipo);
  contarJugada(e, j, c);
  const datos = { pagado: true, desde };
  if (c.tipo === "Talismán") {
    N.sacar(e, u);
    const ctxT = { ctrl: j, fuente: u, def: c.id, costeFuente: c.coste ?? 0 };
    e.cola.unshift(N.nuevoFrame([...(c.talisman ?? []), { op: "finTalisman", uid: u, destierro: !!c.destierroAlJugar }], ctxT));
    N.disparar(e, "juega", { uid: u, j, tipo: c.tipo, pagado: true, desde });
    return;
  }
  N.disparar(e, "juega", { uid: u, j, tipo: c.tipo, pagado: true, desde });
  if (c.tipo === "Arma") return [sel(["yo:aliados"], { armaLibre: u }, "_port"), { op: "portar", arma: u, en: "_port", datos }];
  api.entrarEnJuego(e, u, j, undefined, datos);
}

const copiasEn = (e, j, zona, nombre, excluir) => e.jugadores[j][zona].filter((u) => u !== excluir && N.carta(e, u).nombre === nombre).length;

export const HABILIDADES = {
  "Grisgrís": {
    disparadas: [
      { cuando: ["ataca"], quien: "yo", hacer: [{ op: "fn", f: "contar" }] },
      {
        cuando: ["comienzoVigilia"],
        quien: "rival",
        si: "atacaron",
        opcional: true,
        hacer: [sel(["todos:cementerio"], {}, "c", { nf: "atacantes", hasta: true }), mov("desterrar", "c")],
      },
    ],
    fns: {
      contar: (e, ctx) => {
        const clave = `grisgris|${ctx.fuente}`;
        const u = e.usos[clave];
        e.usos[clave] = { turno: e.turno, n: u?.turno === e.turno ? u.n + 1 : 1 };
      },
      atacantes: (e, ctx) => {
        const u = e.usos[`grisgris|${ctx.fuente}`];
        return u && u.turno === e.turno - 1 ? u.n : 0;
      },
      atacaron: (e, ctx) => {
        const u = e.usos[`grisgris|${ctx.fuente}`];
        return !!u && u.turno === e.turno - 1 && u.n > 0;
      },
    },
  },
  "Guitarra Morisca": {
    activadas: [
      {
        texto: "Destruir este Oro: reducir a 0 el daño que fueras a recibir este turno",
        coste: desdeLaFuente("destruir"),
        hacer: [{ op: "fn", f: "prevenir" }],
      },
      {
        texto: "Desterrarla de tu Cementerio: Barajar hasta tres cartas de tu Cementerio",
        zona: "cementerio",
        coste: desdeLaFuente("desterrar"),
        hacer: barajarCementerios(3, "yo:cementerio"),
      },
    ],
    fns: {
      prevenir: (e, ctx) => {
        N.agregarEfecto(e, { tipo: "prevenirDano", j: ctx.ctrl }, ctx.ctrl);
      },
    },
  },
  "Hervidero de Sangre": {
    claves: ["UnaCopia"],
    disparadas: [
      {
        cuando: ["entra"],
        si: "desdeMano",
        opcional: true,
        hacer: [sel(["rival:oros"], {}, "x", { para: "tomar" }), { op: "fn", f: "intercambiar" }],
      },
    ],
    fns: {
      desdeMano: (e, ctx) => !ctx.datos.desde || ctx.datos.desde === "mano",
      intercambiar: (e, ctx) => {
        const [o] = ctx.vars.x ?? [];
        if (!o || !N.enJuego(e, ctx.fuente) || !N.puedeTomar(e, ctx.fuente, N.rival(ctx.ctrl))) return;
        const zf = N.ubicar(e, ctx.fuente).zona;
        const zo = N.ubicar(e, o).zona;
        N.mover(e, ctx.fuente, zf, { j: N.rival(ctx.ctrl) });
        N.mover(e, o, zo, { j: ctx.ctrl });
      },
    },
  },
  Hidromiel: {
    disparadas: [
      {
        cuando: ["entra"],
        hacer: [
          {
            op: "modo",
            opciones: [
              { texto: "Tu Cementerio", pasos: barajarCementerios(3, "yo:cementerio") },
              { texto: "Cementerio oponente", pasos: barajarCementerios(3, "rival:cementerio") },
            ],
          },
          robar(2),
        ],
      },
    ],
  },
  "Hostias Consagradas": {
    claves: ["NoPierdeHabilidad"],
    disparadas: [{ cuando: ["juega"], quien: "cualquiera", si: "tercera", hacer: [{ op: "fn", f: "barajarMano" }] }],
    continuas: [{ rivalDebeAtacar: true, si: "razas" }],
    fns: {
      tercera: (e, ctx) => (e.jugadores[ctx.datos.j].jugadas[ctx.datos.tipo] ?? 0) >= 3,
      barajarMano: (e, ctx) => {
        const q = ctx.datos.j === ctx.ctrl ? "yo" : "rival";
        return [sel([`${q}:mano`], {}, "h", { quien: q }), mov("barajar", "h")];
      },
      razas: (e, ctx) => N.aliadosDe(e, ctx.ctrl).some((a) => (N.carta(e, a).razas ?? []).some((r) => ["Eterno", "Faerie", "Sacerdote"].includes(r))),
    },
  },
  "Huevos de Oro": {
    activadas: [
      {
        texto: "Pagar un Oro: convertir la carta del tope de un Castillo en un Oro sin habilidad en tu Oro Pagado (una vez por partida)",
        oros: 1,
        requiere: "virgen",
        hacer: [{ op: "fn", f: "marcar" }, castilloElegido((quien) => [{ op: "tope", quien, n: 1, como: "t" }, { op: "convertir", var: "t", en: "Oro", a: "pagado" }])],
      },
    ],
    fns: {
      virgen: (e, ctx) => e.usos[`huevos|${ctx.fuente}`] === undefined,
      marcar: (e, ctx) => {
        e.usos[`huevos|${ctx.fuente}`] = e.turno;
      },
    },
  },
  "Incensario Serafico": {
    disparadas: [
      {
        zona: ["mano", "cementerio"],
        cuando: ["rivalPoneOro"],
        quien: "rival",
        si: "masDeUno",
        opcional: true,
        hacer: [sel(["fuente"], {}, "yo"), { op: "ponerOro", var: "yo", a: "pagado" }],
      },
    ],
    activadas: [{ texto: "Pagar un Oro: Robar dos cartas", veces: "turno", oros: 1, hacer: [robar(2)] }],
    fns: { masDeUno: (e, ctx) => ctx.datos.n >= 2 },
  },
  "Infernum Vox": {
    disparadas: [{ cuando: ["entra"], hacer: [robar(1)] }],
    activadas: [
      {
        texto: "Ponerlo de tu mano en tu Reserva",
        zona: "mano",
        momento: "vigilia",
        requiere: "sinOros",
        hacer: [sel(["fuente"], {}, "yo"), { op: "ponerOro", var: "yo", a: "reserva" }],
      },
      {
        texto: "Mirar seis cartas del tope de un Castillo y poner al fondo las que elijas",
        veces: "turno",
        hacer: [castilloElegido((quien) => [{ op: "tope", quien, n: 6, como: "m" }, sel(["var:m"], { zona: "castillo" }, "f", { n: 6, hasta: true }), mov("fondo", "f")])],
      },
    ],
    continuas: [{ fuerza: -1, a: "aliadosRival" }],
    fns: { sinOros: (e, ctx) => e.jugadores[ctx.ctrl].orosPuestos === 0 },
  },
  "Insignia del Guerrero": {
    disparadas: [{ cuando: ["entra"], opcional: true, hacer: [{ op: "fn", f: "mostrar" }] }],
    fns: {
      mostrar: (e, ctx) => {
        let aliado = null;
        let arma = null;
        for (const u of e.jugadores[ctx.ctrl].castillo) {
          const c = N.carta(e, u);
          if ((c.coste ?? 0) > 2) continue;
          if (!aliado && c.tipo === "Aliado") aliado = u;
          else if (!arma && c.tipo === "Arma") arma = u;
          if (aliado && arma) break;
        }
        for (const u of [aliado, arma]) if (u) N.mover(e, u, "mano");
        N.barajarCastillo(e, ctx.ctrl);
      },
    },
  },
  Kultrung: {
    claves: ["UnaCopia"],
    disparadas: [
      { zona: ["cementerio"], cuando: ["alCementerio"], quien: "propia", si: "turnoRival", opcional: true, hacer: desdeLaFuente("mano") },
      { zona: ["cementerio"], cuando: ["salenDelCastillo"], quien: "yo", si: "botado", opcional: true, hacer: desdeLaFuente("mano") },
    ],
    activadas: [
      {
        texto: "Pagar este Oro: generar dos Oros por el turno para jugar cartas",
        requiere: "enReserva",
        coste: desdeLaFuente("pagado"),
        hacer: [{ op: "generar", n: 2 }],
      },
    ],
    fns: {
      enReserva,
      turnoRival: (e, ctx) => e.activo !== ctx.ctrl,
      botado: (e, ctx) => ctx.datos.zona === "cementerio" && ctx.datos.uids.includes(ctx.fuente) && (ctx.datos.porDano || e.activo !== ctx.ctrl),
    },
  },
  "La Estrella Solitaria": {
    activadas: [
      {
        texto: "Pagar un Oro: buscar en tu Castillo una carta que no sea Talismán",
        veces: "turno",
        oros: 1,
        hacer: buscar(["yo:castillo"], { noTipo: ["Talismán"] }),
      },
    ],
    continuas: [{ aliadosNoPierden: true }],
  },
  "La Isla del Doctor Moreau": {
    disparadas: [{ cuando: ["entra"], hacer: [{ op: "generar", n: 1 }] }],
    activadas: [
      {
        texto: "Pagar un Oro: Barajar hasta dos cartas de los Cementerios y Robar una carta",
        veces: "turno",
        oros: 1,
        hacer: [...barajarCementerios(2), robar(1)],
      },
    ],
  },
  "La Isla del Tesoro": {
    disparadas: [
      {
        cuando: ["juega"],
        quien: "yo",
        veces: 1,
        si: "pagoAliado",
        opcional: true,
        hacer: [sel(["rival:cementerio"], {}, "c", { nf: "costeJugado", hasta: true }), mov("desterrar", "c")],
      },
    ],
    fns: {
      pagoAliado: (e, ctx) => ctx.datos.tipo === "Aliado" && ctx.datos.pagado && coste(e, ctx.datos.uid) > 0 && e.jugadores[ctx.ctrl].pagado.includes(ctx.fuente),
      costeJugado: (e, ctx) => coste(e, ctx.datos.uid),
    },
  },
  "La Ouija": {
    disparadas: [
      {
        cuando: ["entra"],
        hacer: [
          {
            op: "modo",
            opciones: [
              { texto: "La primera carta de tu Castillo", pasos: [{ op: "tope", n: 1, como: "t" }, mov("mano", "t")] },
              { texto: "La última carta de tu Castillo", pasos: [{ op: "tope", n: 1, fondo: true, como: "t" }, mov("mano", "t")] },
            ],
          },
        ],
      },
    ],
    activadas: [
      {
        texto: "Jugar una carta de tu Cementerio o del tope de tu Castillo",
        momento: "vigilia",
        veces: "turno",
        requiere: "hayJugable",
        hacer: [{ op: "tope", n: 1, como: "t" }, sel(["yo:cementerio", "var:t"], { f: "jugable" }, "a"), { op: "fn", f: "jugar" }],
      },
    ],
    fns: {
      jugable: pagable(0),
      hayJugable: (e, ctx) => [...e.jugadores[ctx.ctrl].cementerio, ...e.jugadores[ctx.ctrl].castillo.slice(0, 1)].some((u) => pagable(0)(e, ctx, u)),
      jugar: (e, ctx, api) => {
        const [u] = ctx.vars.a ?? [];
        if (u) return jugarCarta(e, ctx, api, u, 0);
      },
    },
  },
  "Laboratorio Maldito": {
    activadas: [
      {
        texto: "Pagar este Oro: buscar un Aliado en tu Castillo",
        momento: "vigilia",
        requiere: "enReserva",
        coste: desdeLaFuente("pagado"),
        hacer: buscar(["yo:castillo"], { tipo: "Aliado" }),
      },
      {
        texto: "Un Aliado de tu Cementerio gana Exhumar por el turno",
        veces: "turno",
        requiere: { de: ["yo:cementerio"], filtro: { tipo: "Aliado" } },
        hacer: [sel(["yo:cementerio"], { tipo: "Aliado" }, "c"), { op: "efecto", var: "c", efecto: { tipo: "gana", clave: "Exhumar" } }],
      },
    ],
    fns: { enReserva },
  },
  "Lagrima de Dragón": {
    claves: ["Indesterrable", "NoPierdeHabilidad"],
    disparadas: [{ cuando: ["saleDelJuego"], quien: "rival", si: "enCombate", opcional: true, hacer: [robar(1)] }],
    continuas: [{ noTomarControl: true }, { rivalDebeAtacar: true }],
    fns: {
      enCombate: (e, ctx) => ctx.datos.tipo === "Aliado" && e.fase === "danando" && N.ubicar(e, ctx.datos.uid)?.zona === "cementerio",
    },
  },
  "Las Aventuras de Alicia en el Pais de las Maravillas": {
    activadas: [
      {
        texto: "Pagar un Oro: ponerlo desde tu mano en tu Oro Pagado",
        zona: "mano",
        momento: "vigilia",
        oros: 1,
        requiere: "sinMasOros",
        hacer: [sel(["fuente"], {}, "yo"), { op: "ponerOro", var: "yo", a: "pagado" }],
      },
      {
        texto: "Pagar un Oro: Robar tres y Barajar dos de tu mano, o jugar un Arma o Tótem reduciendo su coste en uno",
        veces: "turno",
        oros: 1,
        hacer: [
          {
            op: "modo",
            opciones: [
              { texto: "Robar tres cartas y Barajar dos de tu mano", pasos: [robar(3), sel(["yo:mano"], {}, "m", { n: 2 }), mov("barajar", "m")] },
              {
                texto: "Jugar un Arma o Tótem reduciendo su coste en un Oro",
                requiere: { de: ["yo:mano"], filtro: { tipo: ["Arma", "Tótem"], f: "jugable" } },
                pasos: [sel(["yo:mano"], { tipo: ["Arma", "Tótem"], f: "jugable" }, "a"), { op: "fn", f: "jugar" }],
              },
            ],
          },
        ],
      },
    ],
    fns: {
      sinMasOros: (e, ctx) => N.orosDe(e, ctx.ctrl).length <= N.orosDe(e, N.rival(ctx.ctrl)).length,
      jugable: pagable(1),
      jugar: (e, ctx, api) => {
        const [u] = ctx.vars.a ?? [];
        if (u) return jugarCarta(e, ctx, api, u, 1);
      },
    },
  },
  "Las Aventuras de Sherlock Holmes": {
    disparadas: [{ cuando: ["entra"], hacer: buscar(["yo:castillo"], { f: "copia" }) }],
    continuas: [
      { fuerzaPor: "otrasPagadas", a: "tusAliados" },
      { fuerzaPor: "enReserva", a: "aliadosRival" },
    ],
    fns: {
      copia: (e, ctx, u) => N.carta(e, u).nombre === "Las Aventuras de Sherlock Holmes",
      otrasPagadas: (e, ctx) => copiasEn(e, ctx.ctrl, "pagado", "Las Aventuras de Sherlock Holmes", ctx.fuente),
      enReserva: (e, ctx) => -copiasEn(e, ctx.ctrl, "reserva", "Las Aventuras de Sherlock Holmes"),
    },
  },
  "Legión de Honor": {
    activadas: [
      {
        texto: "Pagar este Oro: mover un Oro oponente a su Oro Pagado",
        momento: "vigilia",
        veces: "turno",
        requiere: "puede",
        coste: desdeLaFuente("pagado"),
        hacer: [sel(["rival:reserva"], { tipo: "Oro" }, "o"), mov("pagado", "o")],
      },
    ],
    continuas: [{ fuerza: 1, a: "tusAliados", zona: "reserva" }],
    fns: { puede: (e, ctx) => enReserva(e, ctx) && e.jugadores[N.rival(ctx.ctrl)].reserva.length > 0 },
  },
  Levisterio: {
    disparadas: [{ cuando: ["entra"], hacer: [robar(1), { op: "si", f: "pocosTalismanes", entonces: [{ op: "generar", n: 1, tipos: ["Arma"] }, robar(1)] }] }],
    continuas: [{ armaAdicional: true }],
    fns: { pocosTalismanes: (e, ctx) => e.jugadores[ctx.ctrl].mano.filter((u) => N.carta(e, u).tipo === "Talismán").length <= 1 },
  },
  "Libro de Revelaciones": {
    claves: ["UnaCopia"],
    disparadas: [{ cuando: ["entra"], hacer: [{ op: "tope", n: 3, como: "m" }, sel(["var:m"], { zona: "castillo" }, "a"), mov("mano", "a"), barajar()] }],
  },
  "Libro de las Obras": {
    claves: ["UnaCopia"],
    disparadas: [{ cuando: ["entra"], hacer: [...barajarCementerios(4), robar(1)] }],
    activadas: [
      {
        texto: "Convertir este Oro en un Oro sin habilidad: subir a la mano de su dueño un Oro del Oro Pagado",
        momento: "tuTurno",
        veces: "turno",
        requiere: "puede",
        hacer: [{ op: "fn", f: "apagar" }, sel(["todos:pagado"], { tipo: "Oro", noFuente: true }, "o"), mov("mano", "o")],
      },
    ],
    fns: {
      puede: (e, ctx) =>
        N.orosDe(e, N.rival(ctx.ctrl)).length >= N.orosDe(e, ctx.ctrl).length + 2 &&
        [...e.jugadores[0].pagado, ...e.jugadores[1].pagado].some((u) => u !== ctx.fuente && N.carta(e, u).tipo === "Oro"),
      apagar: (e, ctx) => {
        e.conv[ctx.fuente] = { tipo: "Oro", sinHabilidad: true };
      },
    },
  },
  "Llave del Abismo": {
    disparadas: [{ cuando: ["entra"], quien: "yo", si: "conFuria", hacer: [{ op: "botar", n: 1, quien: "rival" }] }],
    continuas: [
      { fuerza: 1, a: "tusAliados" },
      { gana: "Indestructible", a: "tusAliados" },
    ],
    fns: { conFuria: (e, ctx) => N.carta(e, ctx.datos.uid).tipo === "Aliado" && N.tiene(e, ctx.datos.uid, "Furia") },
  },
  "Los Siete Sellos": {
    claves: ["UnaCopia"],
    disparadas: [{ cuando: ["alCementerio"], quien: "yo", veces: 2, si: "selloResuelto", hacer: [{ op: "botar", n: 2, quien: "rival" }] }],
    fns: {
      selloResuelto: (e, ctx) => {
        const c = N.carta(e, ctx.datos.uid);
        if (c.tipo !== "Talismán" || !c.nombre.includes("Sello")) return false;
        const fr = e.cola[0];
        return !!fr && fr.ctx.ctrl === ctx.ctrl && fr.pasos.some((p) => p.op === "finTalisman" && p.uid === ctx.datos.uid);
      },
    },
  },
  "Lycón": {
    continuas: [{ cementerioRivalSinHabilidad: true, zona: "pagado", si: "atacando" }],
    activadas: [
      {
        texto: "Desterrar dos cartas de tu Cementerio: ponerlo en juego como un Aliado sin habilidad de Fuerza 2",
        zona: "cementerio",
        momento: "vigilia",
        requiere: "dosMas",
        coste: [sel(["yo:cementerio"], { noFuente: true }, "c", { n: 2 }), mov("desterrar", "c")],
        hacer: [sel(["fuente"], {}, "yo"), { op: "convertir", var: "yo", en: "Aliado", fuerza: 2, a: "defensa" }],
      },
    ],
    fns: {
      atacando: (e, ctx) => {
        const n = e.jugadores[ctx.ctrl].ataque.length;
        return n >= 1 && n <= 3;
      },
      dosMas: (e, ctx) => e.jugadores[ctx.ctrl].cementerio.filter((u) => u !== ctx.fuente).length >= 2,
    },
  },
};
