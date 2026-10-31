import * as N from "../nucleo.js";
import { sel, mov, barajar, robar, efecto, buscar, coste } from "../formato.js";
import { armaCabe, disponibles, pagarOros, hayObjetivo, impuestoSinPagar } from "../efectos.js";

const botar = (n, quien = "rival") => ({ op: "botar", n, quien });
const esCaballero = (e, u) => (N.carta(e, u).razas ?? []).includes("Caballero");
const controlaArmas = (e, ctx) => N.armasDe(e, ctx.ctrl).length > 0;
const claveArmas = (j) => `armasJugadas|${j}`;
const jugoArmasAntes = (e, ctx) => e.usos[claveArmas(ctx.ctrl)] === e.turno - 2;
const armasOAntes = (e, ctx) => controlaArmas(e, ctx) || jugoArmasAntes(e, ctx);
const registrarArmas = { cuando: ["juega"], quien: "yo", zona: ["mano", "cementerio"], si: "registrar", hacer: [] };
const registrar = (e, ctx) => {
  if (ctx.datos.tipo === "Arma") e.usos[claveArmas(ctx.ctrl)] = e.turno;
  return false;
};
const conArma = (e, ctx) => ((e.armas[ctx.objetivo] ?? []).length ? 1 : 0);
const esArma = (e, ctx) => ctx.datos.tipo === "Arma";
const deTipoEn = (e, j, zonas, tipos) => zonas.some((z) => e.jugadores[j][z].some((u) => tipos.includes(N.carta(e, u).tipo)));

const desterrarDeUnCementerio = (cantidad) => ({
  op: "modo",
  opciones: [
    { texto: "tu Cementerio", pasos: [sel(["yo:cementerio"], {}, "c", { ...cantidad, hasta: true }), mov("desterrar", "c")] },
    { texto: "Cementerio oponente", pasos: [sel(["rival:cementerio"], {}, "c", { ...cantidad, hasta: true }), mov("desterrar", "c")] },
  ],
});

function contar(e, j, c) {
  const p = e.jugadores[j];
  p.jugadas[c.tipo] = (p.jugadas[c.tipo] ?? 0) + 1;
  p.jugadas.nombres[c.nombre] = (p.jugadas.nombres[c.nombre] ?? 0) + 1;
  if (["Aliado", "Arma", "Tótem"].includes(c.tipo)) p.jugadas.total += 1;
}

const pagable = (red, minimo) => (e, ctx, u) => {
  const c = N.carta(e, u);
  if (c.tipo === "Oro" || c.soloRespuesta) return false;
  if (Math.max(minimo, coste(e, u) - red) > disponibles(e, ctx.ctrl, c.tipo)) return false;
  if (c.tipo === "Arma" && !N.aliadosDe(e, ctx.ctrl).some((a) => armaCabe(e, a, u))) return false;
  if (c.tipo === "Talismán" && c.requiere) {
    const ctxT = { ctrl: ctx.ctrl, fuente: u, def: c.id, costeFuente: c.coste ?? 0, vars: {} };
    return typeof c.requiere === "string" ? c.fns[c.requiere](e, ctxT) : hayObjetivo(e, ctxT, c.requiere);
  }
  return true;
};

function jugarReducido(e, ctx, uid, red, minimo) {
  const c = N.carta(e, uid);
  const j = ctx.ctrl;
  const pagar = Math.max(minimo, coste(e, uid) - red);
  if (pagar > disponibles(e, j, c.tipo)) return [];
  const desde = N.ubicar(e, uid)?.zona ?? null;
  pagarOros(e, j, pagar, c.tipo);
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

const jugarCon = (red, minimo) => (e, ctx) => {
  const [u] = ctx.vars.a ?? [];
  return u ? jugarReducido(e, ctx, u, red, minimo) : [];
};

const jugarDesde = (zonas, filtro, red, minimo, texto, extra = {}) => ({
  activada: {
    texto,
    veces: "turno",
    ...extra,
    requiere: { de: zonas, filtro: { ...filtro, f: "pagable" } },
    hacer: [sel(zonas, { ...filtro, f: "pagable" }, "a"), { op: "fn", f: "jugar" }],
  },
  fns: { pagable: pagable(red, minimo), jugar: jugarCon(red, minimo) },
});

function aArma(e, uid, portador, ctrl) {
  if (uid === portador || !N.enJuego(e, uid) || !N.enJuego(e, portador) || !N.puedeTomar(e, uid, ctrl)) return;
  for (const a of e.armas[uid] ?? []) N.mover(e, a, "cementerio");
  delete e.armas[uid];
  delete e.ganadas[uid];
  N.sacar(e, uid);
  for (const pj of e.jugadores) pj.nuevos = pj.nuevos.filter((x) => x !== uid);
  e.conv[uid] = { tipo: "Arma", sinHabilidad: true };
  (e.armas[portador] ??= []).push(uid);
}

const limpiarConvertidas = (e) => {
  for (const [u, c] of Object.entries(e.conv)) if (c.tipo === "Arma" && !N.enJuego(e, u)) delete e.conv[u];
};

function pagadoPor(e, j, uid) {
  const c = N.carta(e, uid);
  let x = c.coste ?? 0;
  const ctx = { ctrl: j, fuente: uid, def: c.id, costeFuente: x, vars: {} };
  if (c.reduce) x = Math.max(Math.min(x, 1), x - c.fns[c.reduce](e, ctx));
  if (c.orosMenos) x = Math.max(0, x - c.fns[c.orosMenos](e, ctx));
  return x;
}

const miguel = jugarDesde(["yo:mano", "todos:cementerio"], { noTipo: ["Oro"] }, 1, 0, "Jugar una carta de tu mano o de un Cementerio reduciendo su coste en un Oro", { momento: "tuTurno" });
const husar = jugarDesde(["yo:cementerio"], { tipo: "Arma" }, 0, 0, "Jugar un Arma de tu Cementerio pagando su coste", { momento: "vigilia" });
const mateo = jugarDesde(["yo:cementerio", "yo:destierro"], { tipo: "Arma" }, 0, 0, "Jugar un Arma de tu Cementerio o Destierro pagando su coste", { momento: "vigilia" });
const milena = jugarDesde(["yo:mano", "yo:cementerio"], { tipo: "Arma" }, 1, 0, "Jugar un Arma de tu mano o Cementerio reduciendo su coste en un Oro", { momento: "vigilia" });

export const HABILIDADES = {
  "Dr. Jack Seward": {
    disparadas: [
      { cuando: ["entra"], si: "armasOAntes", hacer: [sel(["rival:aliados"], {}, "x", { n: 99 }), efecto("x", { tipo: "pierdeHabilidad" }, "mientras"), mov("destruir")] },
      registrarArmas,
    ],
    activadas: [
      {
        texto: "Generar un Oro para jugar Armas, o Barajar y/o Desterrar hasta cuatro cartas de los Cementerios y Robar una carta",
        veces: "turno",
        hacer: [
          {
            op: "modo",
            opciones: [
              { texto: "Generar un Oro para jugar Armas", pasos: [{ op: "generar", n: 1, tipos: ["Arma"] }] },
              {
                texto: "Barajar y/o Desterrar hasta cuatro cartas de los Cementerios y Robar una carta",
                pasos: [
                  sel(["todos:cementerio"], {}, "c", { n: 4, hasta: true }),
                  mov("barajar", "c"),
                  sel(["todos:cementerio"], {}, "d", { nf: "resto", hasta: true }),
                  mov("desterrar", "d"),
                  robar(1),
                ],
              },
            ],
          },
        ],
      },
    ],
    fns: { armasOAntes, registrar, resto: (e, ctx) => 4 - (ctx.vars.c ?? []).length },
  },
  "Duque Godofredo": {
    continuas: [{ fuerza: 1, a: "tusAliados", raza: "Caballero" }],
  },
  "El Rey y el Verdugo": {
    claves: ["Imbloqueable"],
    orosMenos: "armas",
    disparadas: [{ cuando: ["entra"], hacer: [sel(["yo:destierro"], { tipo: "Arma" }, "a", { n: 99 }), mov("barajar", "a"), robar(1)] }],
    fns: {
      armas: (e, ctx) => {
        const p = e.jugadores[ctx.ctrl];
        const enZona = [...p.mano, ...p.cementerio].filter((u) => u !== ctx.fuente && N.carta(e, u).tipo === "Arma").length;
        return enZona + N.armasDe(e, ctx.ctrl).length;
      },
    },
  },
  "Felipe Augusto": {
    claves: ["Furia"],
    disparadas: [
      {
        cuando: ["entra"],
        hacer: [
          {
            op: "opcional",
            texto: "Jugar sin pagar un Arma de coste 2 o menos de tu Cementerio en un Aliado Caballero",
            requiere: { de: ["yo:cementerio"], filtro: { tipo: "Arma", costeMax: 2, f: "llevable" } },
            pasos: [sel(["yo:cementerio"], { tipo: "Arma", costeMax: 2, f: "llevable" }, "a"), { op: "fn", f: "jugarEnCaballero" }],
          },
        ],
      },
    ],
    fns: {
      llevable: (e, ctx, u) => N.aliadosDe(e, ctx.ctrl).some((x) => esCaballero(e, x) && armaCabe(e, x, u)),
      caballero: (e, ctx, x) => esCaballero(e, x),
      jugarEnCaballero: (e, ctx) => {
        const [u] = ctx.vars.a ?? [];
        if (!u || N.carta(e, u).soloPagando) return [];
        const j = ctx.ctrl;
        const imp = impuestoSinPagar(e, j);
        if (imp > disponibles(e, j, "Arma")) return [];
        pagarOros(e, j, imp, "Arma");
        N.disparar(e, "juega", { uid: u, j, tipo: "Arma", pagado: false });
        return [
          { op: "ventanaSinPagar", uid: u },
          sel(["yo:aliados"], { armaLibre: u, f: "caballero" }, "_port"),
          { op: "portar", arma: u, en: "_port", datos: { pagado: false, desde: "cementerio" } },
        ];
      },
    },
  },
  "Frumos el Paladín": {
    claves: ["Furia"],
    disparadas: [
      {
        cuando: ["entra"],
        si: "controlaArmas",
        opcional: true,
        hacer: [sel(["yo:mano"], {}, "m", { n: 3, hasta: true }), { op: "fn", f: "recordar" }, mov("barajar", "m"), { op: "robar", nf: "cuantas", quien: "yo" }],
      },
    ],
    continuas: [{ fuerzaPor: "conArma", a: "aliados" }],
    fns: {
      controlaArmas,
      conArma,
      recordar: (e, ctx) => {
        ctx.vars.k = (ctx.vars.m ?? []).length;
      },
      cuantas: (e, ctx) => ctx.vars.k ?? 0,
    },
  },
  "Gilgamesh el Paladin": {
    claves: ["Furia", "Imbloqueable"],
    disparadas: [{ cuando: ["entra", "sale"], hacer: [sel(["todos:enJuego"], { f: "objetivo", noFuente: true }, "x", { para: "destruir" }), mov("destruir")] }],
    continuas: [{ fuerza: 1, a: "tusDemasAliados" }],
    fns: {
      objetivo: (e, ctx, u) => coste(e, u) <= 2 || (N.carta(e, u).tipo === "Aliado" && N.fuerza(e, u) <= N.fuerza(e, ctx.fuente)),
    },
  },
  "Gilgamesh, Paladín de Uruk": {
    claves: ["Furia"],
    disparadas: [
      {
        cuando: ["entra", "ataca"],
        hacer: [
          {
            op: "opcional",
            texto: "Desterrar un Aliado de Fuerza 4 o menos para buscar un Aliado o Arma",
            requiere: { de: ["todos:aliados"], filtro: { f: "f4" }, para: "desterrar" },
            pasos: [
              sel(["todos:aliados"], { f: "f4" }, "x", { para: "desterrar" }),
              mov("desterrar"),
              { op: "si", f: "desterrado", entonces: buscar(["yo:castillo"], { tipo: ["Aliado", "Arma"] }) },
            ],
          },
        ],
      },
      { cuando: ["saleDelJuego", "sale"], quien: "cualquiera", veces: 1, si: "esAliado", hacer: [botar(3)] },
    ],
    fns: {
      f4: (e, ctx, u) => N.fuerza(e, u) <= 4,
      desterrado: (e, ctx) => (ctx.vars.x ?? []).some((u) => N.ubicar(e, u)?.zona === "destierro"),
      esAliado: (e, ctx) => !ctx.datos.tipo || ctx.datos.tipo === "Aliado",
    },
  },
  "Guardián del Tiempo": {
    disparadas: [{ cuando: ["entra"], hacer: [{ op: "efecto", efecto: { tipo: "prevenirDano" }, jugador: "yo", fin: "proximoTurno" }] }],
    activadas: [
      {
        texto: "Tu oponente Descarta una carta de su mano (dos si controlas Armas)",
        veces: "turno",
        requiere: { de: ["rival:mano"], filtro: {} },
        hacer: [sel(["rival:mano"], {}, "x", { quien: "rival", nf: "descartes" }), mov("cementerio")],
      },
    ],
    fns: { descartes: (e, ctx) => (controlaArmas(e, ctx) ? 2 : 1) },
  },
  "Hanta Cinco Anillos": {
    reduce: "red",
    disparadas: [
      { cuando: ["entra"], hacer: [sel(["yo:destierro"], { tipo: "Arma" }, "a", { n: 2, hasta: true }), mov("barajar", "a")] },
      { cuando: ["faseFinal"], si: "controlaArmas", hacer: [desterrarDeUnCementerio({ n: 3 })] },
    ],
    fns: {
      controlaArmas,
      red: (e, ctx) => (deTipoEn(e, ctx.ctrl, ["mano", "cementerio"], ["Arma", "Tótem"]) ? 1 : 0),
    },
  },
  "Hanta el Samurái": {
    disparadas: [
      {
        cuando: ["entra"],
        hacer: [
          {
            op: "opcional",
            texto: "Jugar un Arma de tu mano reduciendo su coste en un Oro",
            requiere: { de: ["yo:mano"], filtro: { tipo: "Arma", f: "pagable" } },
            pasos: [sel(["yo:mano"], { tipo: "Arma", f: "pagable" }, "a"), { op: "fn", f: "jugar" }],
          },
        ],
      },
      { cuando: ["faseFinal"], hacer: [desterrarDeUnCementerio({ nf: "armasMasUno" })] },
    ],
    fns: {
      pagable: pagable(1, 0),
      jugar: jugarCon(1, 0),
      armasMasUno: (e, ctx) => N.armasDe(e, ctx.ctrl).length + 1,
    },
  },
  "Heracles, Paladín Invencible": {
    claves: ["Furia"],
    disparadas: [{ cuando: ["entra"], hacer: [sel(["yo:cementerio"], { noTipo: ["Talismán"] }, "c", { n: 2 }), mov("mano", "c")] }],
    activadas: [
      {
        texto: "Un Aliado gana 2 de Fuerza permanentemente y no puede salir ni cambiar de controlador hasta tu próximo turno",
        veces: "turno",
        requiere: { de: ["todos:aliados"], filtro: {} },
        hacer: [
          sel(["todos:aliados"]),
          efecto("x", { tipo: "fuerza", n: 2 }, "mientras"),
          efecto("x", { tipo: "noSale" }, "proximoTurno"),
          efecto("x", { tipo: "noCambia" }, "proximoTurno"),
        ],
      },
    ],
  },
  "Hijos del Fuego Blanco": {
    disparadas: [
      {
        cuando: ["entra"],
        hacer: [
          {
            op: "opcional",
            texto: "Descartar una carta para buscar un Arma de coste 1 en tu Castillo o Cementerio",
            requiere: { de: ["yo:mano"], filtro: {} },
            pasos: [sel(["yo:mano"], {}, "d"), mov("cementerio", "d"), ...buscar(["yo:castillo", "yo:cementerio"], { tipo: "Arma", costeMin: 1, costeMax: 1 })],
          },
        ],
      },
    ],
  },
  "Húsar Cazador": {
    disparadas: [
      {
        cuando: ["entra", "ataca"],
        hacer: [sel(["yo:mano"], {}, "a"), mov("cementerio", "a"), sel(["rival:mano"], {}, "b", { quien: "rival" }), mov("cementerio", "b")],
      },
    ],
    activadas: [husar.activada],
    continuas: [{ armaAdicional: true }],
    fns: husar.fns,
  },
  "Ignacio Carrera Pinto": {
    claves: ["Imbloqueable"],
    disparadas: [
      { cuando: ["entra", "sale"], hacer: [sel(["yo:castillo"], { tipo: ["Arma", "Aliado"], costeMax: 1 }, "b"), { op: "jugarGratis", var: "b" }, barajar()] },
      {
        cuando: ["juega"],
        quien: "yo",
        veces: 1,
        si: "esArma",
        hacer: [
          {
            op: "opcional",
            texto: "Barajar una carta de coste 2 o menos",
            requiere: { de: ["todos:enJuego"], filtro: { costeMax: 2 } },
            pasos: [sel(["todos:enJuego"], { costeMax: 2 }), mov("barajar")],
          },
        ],
      },
    ],
    fns: { esArma },
  },
  "John Trelawney": {
    reduce: "red",
    disparadas: [registrarArmas],
    fns: {
      registrar,
      red: (e, ctx) => (jugoArmasAntes(e, ctx) || controlaArmas(e, ctx) || deTipoEn(e, ctx.ctrl, ["mano"], ["Arma"]) ? 2 : 0),
    },
  },
  "Juan Mackenna": {
    reduce: "red",
    activadas: [
      {
        texto: "Nombrar una carta que no sea Oro: Barajar una carta con ese nombre de la mano oponente o impedir que se jueguen hasta tu próximo turno",
        veces: "turno",
        requiere: { de: ["rival:mano", "todos:enJuego", "todos:cementerio"], filtro: { noTipo: ["Oro"] } },
        hacer: [
          sel(["rival:mano", "todos:enJuego", "todos:cementerio"], { noTipo: ["Oro"] }, "n"),
          {
            op: "modo",
            opciones: [
              {
                texto: "Barajar una carta con ese nombre de la mano oponente",
                requiere: { de: ["rival:mano"], filtro: { f: "mismoNombre" } },
                pasos: [sel(["rival:mano"], { f: "mismoNombre" }, "b"), mov("barajar", "b")],
              },
              { texto: "Las cartas con ese nombre no pueden ser jugadas hasta tu próximo turno", pasos: [{ op: "fn", f: "vetar" }] },
            ],
          },
        ],
      },
    ],
    fns: {
      red: (e, ctx) => (controlaArmas(e, ctx) ? 1 : 0),
      mismoNombre: (e, ctx, u) => {
        const [n] = ctx.vars.n ?? [];
        return !!n && N.carta(e, u).nombre === N.carta(e, n).nombre;
      },
      vetar: (e, ctx) => {
        const [n] = ctx.vars.n ?? [];
        if (!n) return;
        for (const j of [0, 1]) N.agregarEfecto(e, { tipo: "noJugarNombre", j, nombre: N.carta(e, n).nombre, fin: "proximoTurno" }, ctx.ctrl);
      },
    },
  },
  Kwanyip: {
    claves: ["NoAnulable"],
    activadas: [
      {
        texto: "Convertir hasta un Aliado y hasta un Tótem de coste 3 o menos en Armas sin habilidad y portarlas",
        momento: "vigilia",
        veces: "turno",
        requiere: "convertibles",
        hacer: [
          sel(["todos:aliados"], { costeMax: 3, noFuente: true }, "a", { hasta: true, para: "tomar" }),
          sel(["todos:apoyo"], { tipo: "Tótem", costeMax: 3 }, "t", { hasta: true, para: "tomar" }),
          { op: "fn", f: "portar" },
        ],
      },
    ],
    disparadas: [{ cuando: ["sale"], hacer: [{ op: "fn", f: "limpiar" }] }],
    fns: {
      convertibles: (e, ctx) =>
        hayObjetivo(e, ctx, { de: ["todos:aliados"], filtro: { costeMax: 3, noFuente: true }, para: "tomar" }) ||
        hayObjetivo(e, ctx, { de: ["todos:apoyo"], filtro: { tipo: "Tótem", costeMax: 3 }, para: "tomar" }),
      portar: (e, ctx) => {
        for (const u of [...(ctx.vars.a ?? []), ...(ctx.vars.t ?? [])]) aArma(e, u, ctx.fuente, ctx.ctrl);
      },
      limpiar: limpiarConvertidas,
    },
  },
  "Legion Paladin": {
    disparadas: [
      { cuando: ["entra", "sale"], opcional: true, hacer: [sel(["yo:cementerio"], { tipo: ["Aliado", "Arma"] }, "c", { hasta: true }), mov("mano", "c"), robar(1)] },
      { cuando: ["juega"], quien: "yo", si: "primeraArma", hacer: [{ op: "fn", f: "devolver" }] },
    ],
    fns: {
      primeraArma: (e, ctx) =>
        ctx.datos.tipo === "Arma" && ctx.datos.pagado === true && (e.jugadores[ctx.ctrl].jugadas.Arma ?? 0) === 1 && pagadoPor(e, ctx.ctrl, ctx.datos.uid) >= 2,
      devolver: (e, ctx) => {
        const p = e.jugadores[ctx.ctrl];
        if (p.pagado.length) p.reserva.push(p.pagado.pop());
      },
    },
  },
  "Lord John Roxton": {
    activadas: [
      {
        texto: "Cambiar de portador un Arma que controles o subir un Arma de tu Cementerio a tu mano",
        veces: "turno",
        requiere: "opcionRoxton",
        hacer: [
          {
            op: "modo",
            opciones: [
              {
                texto: "Cambiar de portador un Arma que controles",
                requiere: { de: ["yo:armas"], filtro: { f: "movible" } },
                pasos: [sel(["yo:armas"], { f: "movible" }, "a"), sel(["yo:aliados"], { f: "nuevoPortador" }, "p"), { op: "fn", f: "cambiar" }],
              },
              {
                texto: "Subir un Arma de tu Cementerio a tu mano",
                requiere: { de: ["yo:cementerio"], filtro: { tipo: "Arma" } },
                pasos: [sel(["yo:cementerio"], { tipo: "Arma" }, "c"), mov("mano", "c")],
              },
            ],
          },
        ],
      },
      {
        texto: "Si controlas Armas: Destruir un Aliado Bestia o una carta de coste 1 o menos, o Robar dos cartas",
        veces: "turno",
        requiere: "controlaArmas",
        hacer: [
          {
            op: "modo",
            opciones: [
              {
                texto: "Destruir un Aliado Bestia o una carta de coste 1 o menos",
                requiere: { de: ["todos:enJuego"], filtro: { f: "bestiaOBarata" }, para: "destruir" },
                pasos: [sel(["todos:enJuego"], { f: "bestiaOBarata" }, "x", { para: "destruir" }), mov("destruir")],
              },
              { texto: "Robar dos cartas", pasos: [robar(2)] },
            ],
          },
        ],
      },
    ],
    fns: {
      controlaArmas,
      movible: (e, ctx, a) => N.aliadosDe(e, ctx.ctrl).some((x) => x !== N.portadorDe(e, a) && armaCabe(e, x, a)),
      nuevoPortador: (e, ctx, x) => {
        const [a] = ctx.vars.a ?? [];
        return !!a && x !== N.portadorDe(e, a) && armaCabe(e, x, a);
      },
      opcionRoxton: (e, ctx) =>
        hayObjetivo(e, ctx, { de: ["yo:armas"], filtro: { f: "movible" } }) || hayObjetivo(e, ctx, { de: ["yo:cementerio"], filtro: { tipo: "Arma" } }),
      cambiar: (e, ctx) => {
        const [a] = ctx.vars.a ?? [];
        const [p] = ctx.vars.p ?? [];
        if (!a || !p) return;
        N.sacar(e, a);
        (e.armas[p] ??= []).push(a);
      },
      bestiaOBarata: (e, ctx, u) => {
        const c = N.carta(e, u);
        return (c.tipo === "Aliado" && (c.razas ?? []).includes("Bestia")) || coste(e, u) <= 1;
      },
    },
  },
  Lupin: {
    disparadas: [
      {
        cuando: ["entra", "ataca"],
        opcional: true,
        hacer: [sel(["todos:enJuego"], { costeMax: 3, noFuente: true }, "a", { hasta: true, para: "tomar" }), { op: "fn", f: "segundo" }],
      },
      { cuando: ["sale"], hacer: [{ op: "fn", f: "limpiar" }] },
    ],
    fns: {
      segundo: (e, ctx) => {
        const [a] = ctx.vars.a ?? [];
        if (!a) return [];
        return [sel(["todos:enJuego"], { costeMax: 3 - coste(e, a), excluir: [a], noFuente: true }, "a2", { hasta: true, para: "tomar" }), { op: "fn", f: "portar" }];
      },
      portar: (e, ctx) => {
        for (const u of [...(ctx.vars.a ?? []), ...(ctx.vars.a2 ?? [])]) aArma(e, u, ctx.fuente, ctx.ctrl);
      },
      limpiar: limpiarConvertidas,
    },
  },
  "Manuel Bulnes": {
    claves: ["Imbloqueable"],
    disparadas: [{ cuando: ["entra"], hacer: [robar(1), sel(["yo:mano"], {}, "m"), mov("barajar", "m")] }],
    continuas: [{ fuerzaPor: "porArmas", a: "propia" }],
    fns: { porArmas: (e, ctx) => N.armasDe(e, ctx.ctrl).length },
  },
  "Manuel de Salas": {
    continuas: [
      { gana: "Imbloqueable", a: "tusAliados" },
      { fuerzaPor: "conArma", a: "tusAliados" },
    ],
    fns: { conArma },
  },
  "Mateo de Toro y Zambrano": {
    disparadas: [{ cuando: ["entra"], hacer: [robar(1)] }],
    activadas: [mateo.activada],
    fns: mateo.fns,
  },
  Miguel: {
    claves: ["Furia", "Imbloqueable"],
    disparadas: [{ cuando: ["entra"], hacer: [sel(["rival:mano"], {}, "x", { n: 2, quien: "rival" }), mov("cementerio"), { op: "robarHasta", n: 2 }] }],
    activadas: [miguel.activada],
    fns: miguel.fns,
  },
  Milena: {
    claves: ["Indestructible"],
    activadas: [milena.activada],
    fns: milena.fns,
  },
};
