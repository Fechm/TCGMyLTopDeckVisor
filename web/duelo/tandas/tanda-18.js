import * as N from "../nucleo.js";
import { sel, mov, barajar, robar, efecto, buscar, coste } from "../formato.js";

const barajarCementerios = (n, de = "todos:cementerio") => [sel([de], {}, "c", { n, hasta: true }), mov("barajar", "c")];

const marca = (nombre) => (e, ctx) => {
  e.usos[`${nombre}|${ctx.fuente}`] = e.turno;
};

const marcada = (nombre) => (e, ctx) => e.usos[`${nombre}|${ctx.fuente}`] !== undefined;

const desmarcar = (nombre) => (e, ctx) => {
  delete e.usos[`${nombre}|${ctx.fuente}`];
};

const desdeLaFuente = (a) => [sel(["fuente"], {}, "yo"), mov(a, "yo")];

const libreParaArma = (e, u) => !N.tiene(e, u, "NoPortaArmas") && !(e.armas[u] ?? []).length;

const orosLibres = (e, j) => e.jugadores[j].reserva.length + (e.jugadores[j].generados ?? []).reduce((s, g) => s + g.n, 0);

const serpiente = [{ op: "tope", n: 3, como: "m" }, sel(["var:m"], { zona: "castillo", f: "valida" }, "a", { hasta: true }), mov("mano", "a"), { op: "fn", f: "encarecer" }];

export const HABILIDADES = {
  "Vampiro Eterno": {
    claves: ["Exhumar", "NoAnulable"],
    soloPagando: true,
    talisman: [{ op: "fn", f: "mitad" }],
    fns: {
      mitad: (e, ctx) => {
        const r = N.rival(ctx.ctrl);
        const n = Math.ceil(e.jugadores[r].castillo.length / 2);
        const k = N.quitarDelCastillo(e, r, n, "cementerio");
        return k < 10 ? [{ op: "generar", n: 1 }] : [];
      },
    },
  },
  "Viaje Temporal": {
    soloPagando: true,
    destierroAlJugar: true,
    requiere: "miTurno",
    talisman: [],
    fns: { miTurno: (e, ctx) => e.activo === ctx.ctrl },
  },
  "Viaje en Globo": {
    destierroAlJugar: true,
    talisman: [{ op: "diferir", cuando: "faseFinal", pasos: [robar(2), sel(["todos:enJuego"], { costeMax: 2 }, "b", { hasta: true }), mov("barajar", "b")] }],
  },
  "Vision de Noé": {
    talisman: [{ op: "fn", f: "elegir" }, mov("barajar", "b"), { op: "fn", f: "resultado" }],
    fns: {
      elegir: (e, ctx) => {
        const resto = [];
        for (const j of [ctx.ctrl, N.rival(ctx.ctrl)]) {
          const porCoste = new Map();
          for (const a of N.aliadosDe(e, j)) {
            const k = coste(e, a);
            const ya = porCoste.get(k);
            if (ya === undefined || N.fuerza(e, a) > N.fuerza(e, ya)) {
              if (ya !== undefined) resto.push(ya);
              porCoste.set(k, a);
            } else resto.push(a);
          }
        }
        ctx.vars.b = resto;
        ctx.vars.antes = resto.map((u) => N.controlador(e, u));
      },
      resultado: (e, ctx) => {
        const barajados = (j) => (ctx.vars.b ?? []).filter((u, i) => ctx.vars.antes[i] === j && N.ubicar(e, u)?.zona === "castillo").length;
        const pasos = [];
        if (barajados(N.rival(ctx.ctrl)) <= 2) pasos.push({ op: "desterrarTope", n: 5, quien: "rival" });
        if (barajados(ctx.ctrl) >= 2) pasos.push(robar(3));
        return pasos;
      },
    },
  },
  "Visión de Enoc": {
    requiere: { de: ["yo:aliados"], filtro: {} },
    talisman: [sel(["yo:aliados"], {}, "a"), efecto("a", { tipo: "proteccion", por: "todo" }), { op: "fn", f: "marcar" }],
    respuesta: { anula: { tipo: "Talismán", costeMax: 2 }, pasos: [{ op: "fn", f: "marcar" }] },
    disparadas: [
      { zona: ["cementerio"], cuando: ["alCementerio"], quien: "propia", si: "resuelta", hacer: [{ op: "fn", f: "desmarcar" }, ...desdeLaFuente("barajar")] },
      { zona: ["cementerio"], cuando: ["salenDelCastillo"], quien: "yo", si: "botadaPorDano", opcional: true, hacer: barajarCementerios(5) },
    ],
    fns: {
      marcar: marca("enoc"),
      resuelta: marcada("enoc"),
      desmarcar: desmarcar("enoc"),
      botadaPorDano: (e, ctx) => !!ctx.datos.porDano && ctx.datos.zona === "cementerio" && ctx.datos.uids.includes(ctx.fuente),
    },
  },
  Vive: {
    talisman: [
      robar(3),
      sel(["yo:aliados"], {}, "a", { n: 99 }),
      efecto("a", { tipo: "fuerza", n: 2 }),
      sel(["rival:aliados"], {}, "r", { n: 99 }),
      efecto("r", { tipo: "pierdeHabilidad" }),
      efecto("r", { tipo: "fuerza", n: -2 }),
    ],
  },
  "Voces de Hielo": {
    talisman: [sel(["todos:enJuego"], { costeMax: 2 }, "x", { para: "destruir" }), mov("destruir"), ...barajarCementerios(3, "yo:cementerio")],
    respuesta: { anula: { tipo: "Tótem", costeMax: 2 }, pasos: barajarCementerios(3, "yo:cementerio") },
    activadas: [{ texto: "Pagar un Oro: subirlo de tu Cementerio a tu mano", zona: "cementerio", oros: 1, hacer: desdeLaFuente("mano") }],
  },
  Voladora: {
    claves: ["NoAnulable"],
    talisman: [...buscar(["yo:castillo", "yo:cementerio"], { noTipo: ["Talismán"] }), { op: "generar", n: 1, costeMin: 3 }],
    activadas: [
      {
        texto: "Pagar un Oro y Desterrarlo de tu Cementerio: buscar dos cartas de distinto tipo en tu Castillo",
        zona: "cementerio",
        oros: 1,
        coste: desdeLaFuente("desterrar"),
        hacer: [sel(["yo:castillo"], { f: "otroTipo" }, "b", { n: 2 }), mov("mano", "b"), barajar()],
      },
    ],
    fns: { otroTipo: (e, ctx, u) => !(ctx.vars.b ?? []).some((x) => N.carta(e, x).tipo === N.carta(e, u).tipo) },
  },
  "Vuelo del Raiquen": {
    requiere: { de: ["todos:aliados"], filtro: { costeMax: 2, f: "marcado" }, para: "desterrar" },
    talisman: [sel(["todos:aliados"], { costeMax: 2, f: "marcado" }, "x", { para: "desterrar" }), mov("desterrar")],
    fns: { marcado: (e, ctx, u) => ["Furia", "Exhumar", "Indestructible"].some((k) => N.tiene(e, u, k)) },
  },
  "Vínculo de Sangre": {
    destierroAlJugar: true,
    talisman: [sel(["yo:enJuego"], { noTipo: ["Oro"] }, "v", { n: 2 }), { op: "fn", f: "vincular" }, ...barajarCementerios(3), { op: "robarHasta", n: 2 }],
    disparadas: [{ zona: ["destierro"], cuando: ["saleDelJuego"], quien: "cualquiera", si: "vinculada", hacer: [{ op: "fn", f: "romper" }] }],
    fns: {
      vincular: (e, ctx) => {
        const [a, b] = ctx.vars.v ?? [];
        if (!a || !b) return;
        for (const [uid, otra] of [[a, b], [b, a]]) N.agregarEfecto(e, { tipo: "proteccion", uid, otra, cuesta: 1, vinculo: ctx.fuente, fin: "juego" }, ctx.ctrl);
      },
      vinculada: (e, ctx) => e.efectos.some((f) => f.tipo === "proteccion" && f.vinculo === ctx.fuente && (f.uid === ctx.datos.uid || f.otra === ctx.datos.uid)),
      romper: (e, ctx) => {
        const u = ctx.datos.uid;
        e.efectos = e.efectos.filter((f) => !(f.tipo === "proteccion" && f.vinculo === ctx.fuente && (f.uid === u || f.otra === u)));
      },
    },
  },
  "Y Vivieron Felices": {
    destierroAlJugar: true,
    talisman: [
      {
        op: "modo",
        opciones: ["Aliado", "Arma", "Tótem", "Talismán"].map((tipo) => ({
          texto: tipo,
          pasos: [sel(["todos:enJuego"], { tipo }, "t", { n: 99 }), efecto("t", { tipo: "pierdeHabilidad" }), mov("barajar", "t")],
        })),
      },
      { op: "fn", f: "alFinal" },
    ],
    fns: { alFinal: () => [{ op: "diferir", cuando: "faseFinalPropia", pasos: [robar(1), { op: "fn", f: "alFinal" }] }] },
  },
  "Yo Soy el Rey": {
    claves: ["NoAnulable"],
    soloPagando: true,
    destierroAlJugar: true,
    talisman: [robar(3)],
  },
  "Ajo Protector": {
    activadas: [
      {
        texto: "Barajar tu Castillo y Botar una carta; si tiene coste 1 o más, Botar tantas cartas como su coste",
        veces: "turno",
        hacer: [{ op: "fn", f: "botar" }],
      },
    ],
    fns: {
      botar: (e, ctx) => {
        const p = e.jugadores[ctx.ctrl];
        N.barajarCastillo(e, ctx.ctrl);
        const u = p.castillo[0];
        if (!u || !N.quitarDelCastillo(e, ctx.ctrl, 1, "cementerio")) return;
        const k = coste(e, u);
        if (k >= 1) N.quitarDelCastillo(e, ctx.ctrl, k, "cementerio");
      },
    },
  },
  Alicanto: {
    activadas: [
      {
        texto: "Desterrar este Oro: prevenir el próximo daño de este turno y convertir una carta de tu mano en un Oro sin habilidad en tu Oro Pagado",
        momento: "talismanes",
        coste: desdeLaFuente("desterrar"),
        hacer: [{ op: "fn", f: "prevenir" }, sel(["yo:mano"], {}, "m", { hasta: true }), { op: "convertir", var: "m", en: "Oro", a: "pagado" }],
      },
    ],
    fns: {
      prevenir: (e, ctx) => {
        N.agregarEfecto(e, { tipo: "prevenirDano", j: ctx.ctrl, unaVez: true }, ctx.ctrl);
      },
    },
  },
  "Alicia en el Pais de las Maravillas": {
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
      jugable: (e, ctx, u) => {
        if (Math.max(0, coste(e, u) - 1) > orosLibres(e, ctx.ctrl)) return false;
        return N.carta(e, u).tipo !== "Arma" || N.aliadosDe(e, ctx.ctrl).some((a) => libreParaArma(e, a));
      },
      jugar: (e, ctx, api) => {
        const [u] = ctx.vars.a ?? [];
        if (!u) return;
        const c = N.carta(e, u);
        const j = ctx.ctrl;
        const pagar = Math.max(0, coste(e, u) - 1);
        if (pagar > api.disponibles(e, j, c.tipo)) return;
        api.pagarOros(e, j, pagar, c.tipo);
        N.disparar(e, "juega", { uid: u, j, tipo: c.tipo, pagado: true, desde: "mano" });
        const datos = { pagado: true, desde: "mano" };
        if (c.tipo === "Arma") return [sel(["yo:aliados"], { armaLibre: u }, "_port"), { op: "portar", arma: u, en: "_port", datos }];
        api.entrarEnJuego(e, u, j, undefined, datos);
      },
    },
  },
  "Altar de Moloch": {
    disparadas: [{ cuando: ["entra"], hacer: [robar(1), { op: "fn", f: "proteger" }] }],
    activadas: [
      {
        texto: "Pagar el coste de una carta oponente de la que seas dueño: subirla a tu mano y jugarla sin pagar su coste",
        veces: "turno",
        requiere: { de: ["rival:enJuego"], filtro: { f: "propiaPagable" } },
        hacer: [sel(["rival:enJuego"], { f: "propiaPagable" }), { op: "fn", f: "pagar" }, mov("mano"), { op: "jugarGratis", var: "x" }],
      },
    ],
    fns: {
      proteger: (e, ctx) => {
        N.agregarEfecto(e, { tipo: "gana", clave: "Indestructible", aliadosDe: ctx.ctrl, fin: "proximoTurno" }, ctx.ctrl);
      },
      propiaPagable: (e, ctx, u) => N.dueno(u) === ctx.ctrl && coste(e, u) <= orosLibres(e, ctx.ctrl),
      pagar: (e, ctx, api) => {
        for (const u of ctx.vars.x ?? []) api.pagarOros(e, ctx.ctrl, coste(e, u), N.carta(e, u).tipo);
      },
    },
  },
  "Amuleto Indibi": {
    disparadas: [
      { cuando: ["entra"], hacer: [robar(1)] },
      { cuando: ["alCementerio"], quien: "cualquiera", veces: 1, opcional: true, hacer: [{ op: "fn", f: "cargar" }, mov("barajar", "c")] },
    ],
    activadas: [
      {
        texto: "Barajar este Oro: hasta dos Aliados ganan 1 de Fuerza y su daño de combate va al Destierro este turno",
        coste: desdeLaFuente("barajar"),
        hacer: [sel(["todos:aliados"], {}, "a", { n: 2, hasta: true }), efecto("a", { tipo: "fuerza", n: 1 }), efecto("a", { tipo: "gana", clave: "DanoAlDestierro" })],
      },
    ],
    fns: {
      cargar: (e, ctx) => {
        ctx.vars.c = [ctx.datos.uid];
      },
    },
  },
  "Amuleto de Serpiente": {
    disparadas: [
      { cuando: ["entra"], opcional: true, hacer: serpiente },
      { cuando: ["comienzoVigilia"], opcional: true, hacer: serpiente },
    ],
    fns: {
      encarecer: (e, ctx) => {
        if ((ctx.vars.a ?? []).length) N.agregarEfecto(e, { tipo: "impuesto", tipoCarta: "Talismán", yaJugado: true, n: 1, fin: "proximoTurno" }, ctx.ctrl);
      },
      valida: (e, ctx, u) => {
        const c = N.carta(e, u);
        if (c.tipo === "Arma") return true;
        return c.tipo === "Aliado" && ((c.coste ?? 0) <= 1 || c.claves.includes("Furia"));
      },
    },
  },
  Angelus: {
    disparadas: [
      {
        cuando: ["entra"],
        hacer: [
          { op: "tope", n: 5, como: "m" },
          {
            op: "modo",
            opciones: [
              { texto: "Una carta a tu mano", pasos: [sel(["var:m"], { zona: "castillo" }, "a"), mov("mano", "a")] },
              {
                texto: "Dos Armas y/o Tótem a tu mano",
                requiere: "dosEquipos",
                pasos: [sel(["var:m"], { zona: "castillo", tipo: ["Arma", "Tótem"] }, "a", { n: 2 }), mov("mano", "a")],
              },
            ],
          },
        ],
      },
    ],
    fns: {
      dosEquipos: (e, ctx) => (ctx.vars.m ?? []).filter((u) => ["Arma", "Tótem"].includes(N.carta(e, u).tipo)).length >= 2,
    },
  },
  Animita: {
    disparadas: [{ cuando: ["entra"], hacer: [{ op: "botar", n: 3, quien: "yo" }, { op: "botar", n: 3, quien: "rival" }, robar(1)] }],
    activadas: [
      {
        texto: "Una carta de tu Cementerio que no sea Talismán gana Exhumar por el turno",
        momento: "vigilia",
        veces: "turno",
        requiere: { de: ["yo:cementerio"], filtro: { noTipo: ["Talismán"] } },
        hacer: [sel(["yo:cementerio"], { noTipo: ["Talismán"] }, "c"), efecto("c", { tipo: "gana", clave: "Exhumar" })],
      },
    ],
  },
  Argos: {
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
    fns: { dosMas: (e, ctx) => e.jugadores[ctx.ctrl].cementerio.filter((u) => u !== ctx.fuente).length >= 2 },
  },
  "Armeria del Guerrero": {
    disparadas: [
      {
        cuando: ["comienzoTurno"],
        quien: "rival",
        hacer: [...barajarCementerios(2), sel(["todos:cementerio"], {}, "d", { nf: "resto", hasta: true }), mov("desterrar", "d")],
      },
    ],
    continuas: [{ fuerza: 1, a: "tusAliados", costeMin: 1 }],
    fns: { resto: (e, ctx) => 2 - (ctx.vars.c ?? []).length },
  },
  "Arpa de David": {
    desdeCementerio: { oro: true },
    disparadas: [{ cuando: ["entra"], hacer: [robar(1)] }],
    activadas: [
      {
        texto: "Barajar una carta que controles para Barajar una carta oponente de coste 1 o menos",
        momento: "vigilia",
        veces: "turno",
        requiere: { de: ["rival:enJuego"], filtro: { costeMax: 1 } },
        coste: [sel(["yo:enJuego"], {}, "c"), mov("barajar", "c")],
        hacer: [sel(["rival:enJuego"], { costeMax: 1 }), mov("barajar")],
      },
    ],
  },
  "Arpon Sagrado": {
    portador: { fuerza: 2, claves: ["Indestructible", "DanoAlDestierro"] },
    disparadas: [{ cuando: ["entra"], hacer: buscar(["yo:castillo"], { tipo: ["Oro", "Arma"] }) }],
    activadas: [
      {
        texto: "Convertirlo hasta tu próximo turno en un Arma (+2 de Fuerza, Indestructible, daño al Destierro) y portarla",
        veces: "turno",
        requiere: "puedePortar",
        hacer: [sel(["yo:aliados"], { f: "libre" }, "p"), { op: "fn", f: "armar" }],
      },
    ],
    fns: {
      libre: (e, ctx, u) => libreParaArma(e, u),
      puedePortar: (e, ctx) => N.orosDe(e, ctx.ctrl).includes(ctx.fuente) && N.aliadosDe(e, ctx.ctrl).some((u) => libreParaArma(e, u)),
      armar: (e, ctx) => {
        const [p] = ctx.vars.p ?? [];
        if (!p) return;
        N.sacar(e, ctx.fuente);
        (e.armas[p] ??= []).push(ctx.fuente);
        e.conv[ctx.fuente] = { tipo: "Arma", sinHabilidad: false, hastaInicioDe: ctx.ctrl, desde: e.turno, vuelve: "reserva" };
      },
    },
  },
  "Aurora de Chile": {
    disparadas: [
      { cuando: ["entra"], hacer: [robar(1)] },
      {
        cuando: ["sale"],
        hacer: [
          sel(["yo:castillo"], { tipo: "Oro", f: "otro" }, "a"),
          mov("pagado", "a"),
          sel(["yo:castillo"], { tipo: "Oro", f: "otro" }, "b"),
          mov("mano", "b"),
          barajar(),
        ],
      },
    ],
    continuas: [{ proteccion: { por: ["Talismán"] }, a: "tusAliados", tipoObjetivo: "Aliado", si: "miTurno" }],
    fns: { otro: (e, ctx, u) => N.carta(e, u).nombre !== "Aurora de Chile", miTurno: (e, ctx) => e.activo === ctx.ctrl },
  },
};
