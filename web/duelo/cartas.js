import { CARTAS, MAZOS } from "./cartas-base.js";
import * as N from "./nucleo.js";

export { MAZOS };

const sel = (de, filtro = {}, como = "x", extra = {}) => ({ op: "sel", de: [].concat(de), filtro, como, ...extra });
const mov = (a, v = "x") => ({ op: "mover", var: v, a });
const barajar = (quien = "yo") => ({ op: "barajarCastillo", quien });
const robar = (n, quien = "yo") => ({ op: "robar", n, quien });
const efecto = (v, ef, fin) => ({ op: "efecto", var: v, efecto: ef, fin });
const buscar = (de, filtro, a = "mano") => [sel(de, filtro, "b"), mov(a, "b"), barajar(), ...(de.includes("todos:castillo") ? [barajar("rival")] : [])];
const mirar = (n, ...destinos) => [
  { op: "tope", n, como: "m" },
  ...destinos.flatMap((a, i) => [sel(["var:m"], { zona: "castillo" }, `m${i}`), mov(a, `m${i}`)]),
];
const castilloElegido = (pasosPara) => ({
  op: "modo",
  opciones: [
    { texto: "tu Castillo", pasos: pasosPara("yo") },
    { texto: "Castillo oponente", pasos: pasosPara("rival") },
  ],
});
const aliadoDeCastillo = (quien) => [{ op: "tope", quien, n: 1, como: "t" }, { op: "convertir", var: "t", en: "Aliado", fuerza: 2, a: "defensa" }];
const coste = (e, u) => N.carta(e, u).coste ?? 0;

const carcosa = [
  {
    op: "modo",
    opciones: [
      {
        texto: "Desterrar una carta que no sea Oro",
        requiere: { de: ["todos:enJuego"], filtro: { noTipo: ["Oro"] }, para: "desterrar" },
        pasos: [sel(["todos:enJuego"], { noTipo: ["Oro"] }, "x", { para: "desterrar" }), mov("desterrar")],
      },
      { texto: "Desterrar un Talismán de la mano oponente", pasos: [sel(["rival:mano"], { tipo: "Talismán" }), mov("desterrar")] },
    ],
  },
  robar(1),
];

const barajarCementerios = [sel(["todos:cementerio"], {}, "c", { nf: "nOros", hasta: true }), mov("barajar", "c")];

const alFondoYRobar = {
  zona: "mano",
  veces: "turnoNombre",
  requiere: "otraEnMano",
  hacer: [sel(["fuente"], {}, "yo"), sel(["yo:mano"], { noFuente: true }), mov("fondo", "yo"), mov("fondo"), robar(2)],
};
const otraEnMano = (e, ctx) => e.jugadores[ctx.ctrl].mano.length >= 2;

export const HABILIDADES = {
  Jabberwocky: {
    reduce: "red",
    claves: ["NoAnulable"],
    disparadas: [{ cuando: ["entra", "ataca"], hacer: [{ op: "tope", quien: "rival", n: 1, como: "t" }, { op: "convertir", var: "t", en: "Oro", a: "pagado" }] }],
    fns: { red: (e, ctx) => (N.aliadosDe(e, ctx.ctrl).some((a) => coste(e, a) <= 1) ? 0 : 1) },
  },
  "Mecha-Daikaiju": {
    claves: ["Indestructible", "Indesterrable"],
    disparadas: [{ cuando: ["entra"], hacer: [{ op: "robarHasta", n: 3 }] }],
    activadas: [
      {
        momento: "tuTurno",
        veces: "turno",
        hacer: [...buscar(["yo:castillo"], { tipo: "Oro" }, "pagado"), { op: "efecto", efecto: { tipo: "disparadasCuestan" }, jugador: "rival", fin: "proximoTurno" }],
      },
    ],
    continuas: [{ fuerza: 1, a: "tusAliados" }, { gana: "Furia", a: "tusAliados" }],
  },
  "Daikaiju Furioso": {
    disparadas: [
      {
        cuando: ["entra"],
        hacer: [
          { op: "efecto", efecto: { tipo: "noAtacar" }, jugador: "rival", fin: "turnoRival" },
          { op: "efecto", efecto: { tipo: "unaPorTipo" }, jugador: "rival", fin: "turnoRival" },
          robar(2),
        ],
      },
    ],
    activadas: [{ zona: "cementerio", oros: 1, hacer: [sel(["fuente"], {}, "yo"), { op: "convertir", var: "yo", en: "Oro", a: "pagado" }] }],
    continuas: [{ orosRivalSinHabilidad: true }],
  },
  "Padre Dagón": {
    claves: ["NoAnulable"],
    activadas: [
      {
        veces: "turno",
        requiere: { de: ["rival:enJuego"], filtro: { noTipo: ["Oro"] } },
        hacer: [sel(["rival:enJuego"], { noTipo: ["Oro"] }), efecto("x", { tipo: "pierdeHabilidad" }, "mientras"), mov("destruir")],
      },
    ],
    continuas: [{ rivalMaxNoOro: 3 }],
  },
  Balaur: {
    claves: ["Furia", "Indestructible", "DanoAlDestierro"],
    disparadas: [{ cuando: ["entra", "ataca", "sale"], hacer: [sel(["yo:mano", "yo:cementerio"], { tipo: "Oro" }, "o"), { op: "ponerOro", var: "o", a: "pagado" }] }],
    continuas: [{ rivalImpuestoCoste0: true }],
  },
  "White Worm": {
    claves: ["Furia"],
    activadas: [
      {
        momento: "tuTurno",
        veces: "turno",
        requiere: { de: ["todos:enJuego"], filtro: { noTipo: ["Oro"], noFuente: true }, para: "tomar" },
        hacer: [
          sel(["todos:enJuego"], { noTipo: ["Oro"], noFuente: true }, "x", { para: "tomar" }),
          { op: "convertir", var: "x", en: "Oro", a: "pagado" },
          { op: "si", f: "caro", entonces: [sel(["yo:oros"], {}, "o"), mov("barajar", "o")] },
        ],
      },
      {
        veces: "turno",
        hacer: [
          sel(["todos:cementerio"], {}, "c", { n: 3, hasta: true }),
          { op: "modo", opciones: [{ texto: "Barajar", pasos: [mov("barajar", "c")] }, { texto: "Desterrar", pasos: [mov("desterrar", "c")] }] },
          robar(1),
        ],
      },
    ],
    fns: { caro: (e, ctx) => (ctx.vars.x ?? []).some((u) => coste(e, u) >= 3) },
  },
  "El Dracul": {
    claves: ["Furia"],
    disparadas: [{ cuando: ["entra"], opcional: true, hacer: [{ op: "mostrarHasta", tipos: ["Oro", "Aliado"], como: "m" }, mov("mano", "m"), barajar()] }],
  },
  Valefor: {
    claves: ["Furia"],
    disparadas: [
      {
        cuando: ["haceDano"],
        hacer: [
          {
            op: "modo",
            opciones: [
              {
                texto: "Convertirse en Oro Azi",
                pasos: [sel(["fuente"], {}, "yo"), { op: "convertir", var: "yo", en: "Oro", a: "pagado", como: "azi", hasta: true, vuelve: "defensa" }],
              },
              { texto: "Mirar cuatro cartas", pasos: mirar(4, "mano", "cementerio") },
            ],
          },
        ],
      },
    ],
  },
  "Draco Conjurador": {
    disparadas: [{ cuando: ["entra"], opcional: true, hacer: buscar(["yo:castillo"], { tipo: "Oro" }) }],
  },
  "Gusano Rojo": {
    claves: ["Furia", "Imbloqueable", "DanoAlDestierro"],
    activadas: [{ veces: "turno", hacer: buscar(["todos:castillo"], { tipo: "Oro" }, "pagado") }],
  },
  "Martillo Sacro": {
    claves: ["Exhumar"],
    portador: { fuerza: 1, claves: ["Indestructible"] },
    activadas: [
      {
        momento: "vigilia",
        veces: "turno",
        requiere: { de: ["rival:aliados"], filtro: { costeMax: 2 } },
        hacer: [sel(["rival:aliados"], { costeMax: 2 }), { op: "si", f: "exh", entonces: [mov("desterrar")], sino: [mov("destruir")] }],
      },
    ],
    fns: { exh: (e, ctx) => (ctx.vars.x ?? []).some((u) => N.tiene(e, u, "Exhumar")) },
  },
  "Espada Vikinga": {
    portador: { fuerza: 2 },
    disparadas: [{ cuando: ["entra"], hacer: [robar(2), sel(["rival:enJuego"], { f: "barata" }), mov("barajar")] }],
    respuestaMano: { oros: 1, anula: { coste: 1 } },
    fns: { barata: (e, ctx, u) => coste(e, u) <= N.aliadosDe(e, ctx.ctrl).length },
  },
  Carcosa: {
    disparadas: [
      { cuando: ["entra"], hacer: carcosa },
      { cuando: ["comienzoTurno"], quien: "rival", hacer: carcosa },
      { cuando: ["comienzoTurno"], quien: "yo", hacer: [{ op: "botar", n: 4, quien: "rival" }] },
      { cuando: ["sale"], hacer: [{ op: "botar", n: 4, quien: "rival" }] },
    ],
  },
  "Templo Gótico": {
    disparadas: [
      {
        cuando: ["entra"],
        hacer: [
          {
            op: "modo",
            opciones: [
              { texto: "Barajar hasta dos cartas de coste total 4 o menos", pasos: [sel(["todos:enJuego"], { costeMax: 4, noFuente: true }, "a", { hasta: true }), { op: "fn", f: "segundo" }] },
              { texto: "Buscar dos cartas", pasos: [sel(["yo:castillo"], {}, "b", { n: 2 }), mov("mano", "b"), barajar()] },
            ],
          },
        ],
      },
      { cuando: ["comienzoVigilia"], si: "libre", opcional: true, hacer: [{ op: "fn", f: "marcar" }, ...barajarCementerios] },
      { cuando: ["faseFinal"], si: "libre", hacer: [{ op: "fn", f: "marcar" }, ...barajarCementerios] },
    ],
    fns: {
      libre: (e, ctx) => e.usos[`templo|${ctx.fuente}`] !== e.turno,
      marcar: (e, ctx) => {
        e.usos[`templo|${ctx.fuente}`] = e.turno;
      },
      segundo: (e, ctx) => {
        const [a] = ctx.vars.a ?? [];
        if (!a) return [];
        return [sel(["todos:enJuego"], { costeMax: 4 - coste(e, a), excluir: [a], noFuente: true }, "a2", { hasta: true }), mov("barajar", "a"), mov("barajar", "a2")];
      },
      nOros: (e, ctx) => N.orosDe(e, ctx.ctrl).length,
    },
  },
  "Abadía de Carfax": {
    claves: ["ProtegidoCoste1"],
    continuas: [{ fuerza: 1, a: "tusAliados" }],
    disparadas: [
      {
        cuando: ["entra", "sale"],
        hacer: [
          robar(2),
          sel(["yo:mano"]),
          { op: "modo", opciones: [{ texto: "Barajar", pasos: [mov("barajar")] }, { texto: "Desterrar", pasos: [mov("desterrar")] }] },
        ],
      },
    ],
  },
  "Dragón Dorado": {
    soloRespuesta: true,
    destierroAlJugar: true,
    respuesta: { anula: {}, pasos: [{ op: "fn", f: "barajarMano" }] },
    fns: { barajarMano: (e, ctx) => [sel(["yo:mano"], {}, "x", { n: ctx.vars.costeAnulado ?? 0 }), mov("barajar")] },
  },
  "Ciempiés-SP": {
    soloRespuesta: true,
    respuesta: { anula: { costeMax: 3 } },
  },
  "Vision Heroica": {
    requiere: { de: ["todos:enJuego"], filtro: { costeMax: 3 } },
    talisman: [sel(["todos:enJuego"], { costeMax: 3 }), mov("barajar")],
    respuesta: { anula: { tipo: "Talismán" } },
    activadas: [{ zona: "cementerio", oros: 1, hacer: [sel(["fuente"], {}, "yo"), mov("mano", "yo"), robar(1)] }],
  },
  "Cuervo Nocturno": {
    claves: ["NoAnulable"],
    exhumarSi: "ataco",
    talisman: [{ op: "desterrarTope", n: 6, quien: "rival" }],
    activadas: [alFondoYRobar],
    fns: { ataco: (e, ctx) => e.jugadores[ctx.ctrl].atacoTurnoAnterior, otraEnMano },
  },
  "Caminar el Tablón": {
    requiere: { de: ["rival:mano"], filtro: { noTipo: ["Oro"] } },
    talisman: [sel(["rival:mano"], { noTipo: ["Oro"] }), mov("desterrar")],
  },
  Efigie: {
    claves: ["Exhumar"],
    requiere: { de: ["rival:aliados"], filtro: { costeMax: 2 }, para: "desterrar" },
    talisman: [
      sel(["rival:aliados"], { costeMax: 2 }, "x", { para: "desterrar" }),
      { op: "fn", f: "recordar" },
      mov("desterrar"),
      sel(["yo:aliados"], { costeMin: 1 }, "r"),
      { op: "fn", f: "ganar" },
    ],
    fns: {
      recordar: (e, ctx) => {
        ctx.vars.hab = (ctx.vars.x ?? []).map((u) => e.instancias[u]);
      },
      ganar: (e, ctx) => {
        for (const r of ctx.vars.r ?? []) e.ganadas[r] = [...(e.ganadas[r] ?? []), ...(ctx.vars.hab ?? [])];
      },
    },
  },
  "Señal de la Bestia": {
    talisman: [
      {
        op: "modo",
        opciones: [
          {
            texto: "Un Aliado pierde 3 de Fuerza y debe bloquear",
            requiere: { de: ["todos:aliados"], filtro: {} },
            pasos: [sel(["todos:aliados"]), efecto("x", { tipo: "fuerza", n: -3 }), efecto("x", { tipo: "debeBloquear" }), robar(1)],
          },
          { texto: "Tus Aliados ganan Furia y se limita el Castillo", pasos: [{ op: "fn", f: "furia" }] },
        ],
      },
    ],
    fns: {
      furia: (e, ctx) => {
        N.agregarEfecto(e, { tipo: "gana", clave: "Furia", aliadosDe: ctx.ctrl }, ctx.ctrl);
        N.agregarEfecto(e, { tipo: "limiteCastillo" }, ctx.ctrl);
      },
    },
  },
  "Regresa Lucy": {
    requiere: { de: ["todos:enJuego"], filtro: { costeMax: 2 }, para: "destruir" },
    talisman: [sel(["todos:enJuego"], { costeMax: 2 }, "x", { para: "destruir" }), mov("destruir")],
  },
  Malocchio: {
    soloRespuesta: true,
    destierroAlJugar: true,
    respuesta: { anula: { tipo: "Talismán" } },
  },
  "Murciélagos del Caos": {
    reduce: "red",
    talisman: mirar(6, "mano", "mano"),
    fns: { red: (e, ctx) => N.aliadosDe(e, ctx.ctrl).filter((a) => N.fuerza(e, a) >= 4).length },
  },
  "Cráneo de Cristal": {
    disparadas: [
      {
        cuando: ["faseFinal"],
        si: "sinOros",
        hacer: [
          {
            op: "opcional",
            texto: "Poner un Oro de la mano o Cementerio",
            requiere: { de: ["yo:mano", "yo:cementerio"], filtro: { tipo: "Oro" } },
            pasos: [sel(["yo:mano", "yo:cementerio"], { tipo: "Oro" }, "o"), efecto("o", { tipo: "pierdeHabilidad" }, "proximoTurno"), { op: "ponerOro", var: "o", a: "reserva" }],
          },
        ],
      },
    ],
    continuas: [{ rivalDebeAtacar: true }, { fuerza: -1, a: "aliados" }],
    fns: { sinOros: (e, ctx) => e.jugadores[ctx.ctrl].orosPuestos === 0 },
  },
  "Signo Amarillo": {
    claves: ["Indesterrable"],
    disparadas: [{ cuando: ["entra"], hacer: mirar(4, "mano", "cementerio") }],
  },
  "Don de Amma": {
    disparadas: [
      {
        zona: ["mano", "cementerio"],
        cuando: ["rivalPoneOro"],
        quien: "rival",
        si: "segundo",
        opcional: true,
        hacer: [sel(["fuente"], {}, "yo"), { op: "ponerOro", var: "yo", a: "pagado" }],
      },
    ],
    activadas: [
      {
        veces: "turno",
        requiere: { de: ["yo:reserva"], filtro: { tipo: "Oro", conHabilidad: true } },
        hacer: [sel(["yo:reserva"], { tipo: "Oro", conHabilidad: true }), mov("desterrar"), ...buscar(["yo:castillo"], { tipo: "Oro" }, "reserva")],
      },
    ],
    fns: { segundo: (e, ctx) => ctx.datos.n === 2 },
  },
  "Drácula": {},
  Aegishjalmur: {
    desdeCementerio: { oro: true },
    disparadas: [
      {
        cuando: ["entra"],
        hacer: [
          {
            op: "modo",
            n: 2,
            opciones: [
              { texto: "Subir un Aliado del Cementerio", requiere: { de: ["yo:cementerio"], filtro: { tipo: "Aliado" } }, pasos: [sel(["yo:cementerio"], { tipo: "Aliado" }), mov("mano")] },
              { texto: "Barajar hasta una carta de coste 2 o menos", pasos: [sel(["todos:enJuego"], { costeMax: 2 }, "y", { hasta: true }), mov("barajar", "y")] },
              { texto: "Robar una carta", pasos: [robar(1)] },
            ],
          },
        ],
      },
    ],
  },
  "Agua Sagrada": {
    disparadas: [{ cuando: ["entra", "sale"], hacer: [sel(["todos:cementerio"], {}, "c", { n: 3, hasta: true }), mov("barajar", "c")] }],
    activadas: [{ veces: "turno", oros: 1, hacer: buscar(["yo:castillo", "yo:cementerio"], { tipo: ["Oro", "Arma", "Tótem"] }) }],
  },
  Tetramorfo: {
    disparadas: [{ cuando: ["entra"], hacer: [robar(1)] }],
    activadas: [
      {
        momento: "tuTurno",
        veces: "turno",
        requiere: "puede",
        coste: [sel(["yo:cementerio"], {}, "c"), mov("desterrar", "c")],
        hacer: [sel(["todos:enJuego"], { noTipo: ["Oro"] }), { op: "fn", f: "pierde" }],
      },
    ],
    fns: {
      puede: (e, ctx) => e.jugadores[ctx.ctrl].cementerio.length > 0 && N.todoEnJuego(e).some((u) => N.carta(e, u).tipo !== "Oro"),
      pierde: (e, ctx) => {
        for (const u of ctx.vars.x ?? []) N.agregarEfecto(e, { tipo: "pierdeHabilidad", nombre: N.carta(e, u).nombre }, ctx.ctrl);
      },
    },
  },
  Huitzilin: { claves: ["UnaCopia"] },
  "Abu Simbel": {
    continuas: [{ fuerza: 1, a: "tusAliados" }, { aliadosNoPierden: true }, { noTomarControl: true }],
    disparadas: [{ cuando: ["entra"], hacer: [{ op: "fn", f: "devolver" }] }],
    fns: {
      devolver: (e) => {
        for (const u of N.todoEnJuego(e)) {
          const loc = N.ubicar(e, u);
          if (loc.zona === "arma" || loc.j === N.dueno(u)) continue;
          N.sacar(e, u);
          e.jugadores[N.dueno(u)][loc.zona === "ataque" ? "defensa" : loc.zona].push(u);
        }
      },
    },
  },
  "Guillatún": {
    talisman: buscar(["yo:castillo"], {}),
  },
  "Hem Hem Real": {
    activadas: [
      { veces: "turno", requiere: { de: ["todos:aliados"], filtro: {} }, hacer: [sel(["todos:aliados"]), efecto("x", { tipo: "sinDano" })] },
      { coste: [sel(["fuente"], {}, "yo"), mov("mano", "yo")], hacer: [robar(2), sel(["todos:aliados"], {}, "a"), efecto("a", { tipo: "fuerza", n: 2 })] },
    ],
  },
  "Patrulla Nocturna": {
    claves: ["Furia"],
    disparadas: [{ cuando: ["entra", "ataca"], opcional: true, hacer: buscar(["yo:castillo", "yo:cementerio"], { tipo: "Arma" }) }],
    continuas: [{ armaAdicional: true }, { fuerza: 1, a: "tusAliados" }],
  },
  "Sir Peter Hawkins": {
    claves: ["Furia"],
    disparadas: [
      {
        cuando: ["entra"],
        hacer: [
          {
            op: "modo",
            opciones: [
              { texto: "Robar dos y descartar una", pasos: [robar(2), sel(["yo:mano"]), mov("cementerio")] },
              { texto: "Buscar un Arma", pasos: buscar(["yo:castillo"], { tipo: "Arma" }) },
            ],
          },
        ],
      },
    ],
    continuas: [{ armasEnGuerra: true }],
  },
  "Guardia Real": {
    claves: ["AtacaAlEntrar"],
    disparadas: [{ cuando: ["faseFinal"], si: "noAtaco", hacer: [sel(["fuente"], {}, "yo"), mov("destruir", "yo")] }],
    fns: { noAtaco: (e, ctx) => !e.jugadores[ctx.ctrl].declarados.includes(ctx.fuente) },
  },
  "Sir Galahad": {
    claves: ["AtacaAlEntrar"],
    disparadas: [{ cuando: ["haceDano"], hacer: [sel(["rival:mano"], {}, "x", { azar: true }), mov("cementerio")] }],
  },
  "Sir Persival": {
    disparadas: [{ cuando: ["entra"], hacer: [sel(["rival:aliados"]), mov("barajar")] }],
  },
  "Jaques de Molay": {
    claves: ["AtacaAlEntrar"],
    disparadas: [{ cuando: ["ataca"], si: "recien", hacer: [sel(["rival:castillo"], { tipo: "Talismán" }, "t", { n: 2 }), mov("cementerio", "t"), barajar("rival")] }],
    fns: { recien: (e, ctx) => e.jugadores[ctx.ctrl].nuevos.includes(ctx.fuente) },
  },
  "Zweihander Brutal": {
    reduce: "red",
    portador: { fuerza: 2, claves: ["Furia"] },
    fns: { red: (e, ctx) => N.aliadosDe(e, ctx.ctrl).length },
  },
  "Vieja Snaphance": {
    claves: ["NoCuentaLimite"],
    portador: { fuerza: 1, noCambia: true },
    disparadas: [{ cuando: ["entra"], hacer: [sel(["todos:enJuego"], { f: "objetivo" }), efecto("x", { tipo: "pierdeHabilidad" }, "dosTurnos"), robar(1)] }],
    fns: { objetivo: (e, ctx, u) => N.carta(e, u).tipo === "Oro" || coste(e, u) <= 2 },
  },
  Pedrenyal: {
    portador: { fuerza: 2, claves: ["Indestructible"] },
  },
  "Hacha Danesa": {
    claves: ["NoPierdeHabilidad"],
    portador: { fuerza: 2 },
    continuas: [{ aliadosNoCambian: true }],
    activadas: [
      {
        momento: "vigilia",
        veces: "turno",
        requiere: { de: ["rival:aliados"], filtro: { costeMax: 2 } },
        hacer: [sel(["rival:aliados"], { costeMax: 2 }), mov("barajar"), robar(1)],
      },
    ],
  },
  "Isla de Poveglia": {
    desdeCementerio: { botar: 3 },
    disparadas: [{ cuando: ["entra", "sale"], opcional: true, hacer: [castilloElegido(aliadoDeCastillo)] }],
  },
  "Fortaleza Hoshi": {
    disparadas: [
      {
        cuando: ["entra"],
        hacer: [{ op: "mostrarHasta", n: 2, filtro: { tipo: "Tótem", costeMax: 2 }, distintoNombre: true, como: "m" }, { op: "jugarGratis", var: "m" }, barajar()],
      },
    ],
    activadas: [{ veces: "turno", hacer: [castilloElegido((quien) => [{ op: "desterrarTope", quien, nf: "totems" }])] }],
    fns: { totems: (e, ctx) => e.jugadores[ctx.ctrl].apoyo.length },
  },
  "Llamada Sombría": {
    requiere: "puede",
    talisman: [sel(["todos:castillo"], { tipo: "Arma", costeMax: 1, costeMin: 1 }, "a"), { op: "jugarGratis", var: "a" }, barajar(), barajar("rival")],
    fns: { puede: (e, ctx) => N.orosDe(e, ctx.ctrl).length >= 3 && N.aliadosDe(e, ctx.ctrl).length > 0 },
  },
  "Toque Helado": {
    talisman: [
      {
        op: "modo",
        n: 2,
        hasta: true,
        opciones: [
          {
            texto: "Un Aliado pierde su habilidad y no puede atacar ni bloquear",
            requiere: { de: ["todos:aliados"], filtro: {} },
            pasos: [sel(["todos:aliados"]), efecto("x", { tipo: "pierdeHabilidad" }, "mientras"), efecto("x", { tipo: "noAtacarBloquear" }, "mientras")],
          },
          { texto: "Nombrar una carta", pasos: [sel(["rival:mano", "rival:castillo", "rival:cementerio"], { noTipo: ["Oro"] }, "n"), { op: "fn", f: "vetar" }] },
          { texto: "No se puede atacar hasta tu próximo turno", pasos: [{ op: "efecto", efecto: { tipo: "noAtacar" }, fin: "proximoTurno" }] },
        ],
      },
    ],
    fns: {
      vetar: (e, ctx) => {
        for (const u of ctx.vars.n ?? []) N.agregarEfecto(e, { tipo: "noJugarNombre", j: N.rival(ctx.ctrl), nombre: N.carta(e, u).nombre, fin: "proximoTurno" }, ctx.ctrl);
      },
    },
  },
  "Llamar a la Manada": {
    talisman: [robar(3)],
  },
  "Hija del Caos": {
    talisman: [{ op: "fn", f: "hija" }],
    fns: {
      hija: (e, ctx, api) => {
        const p = e.jugadores[ctx.ctrl];
        N.barajarCastillo(e, ctx.ctrl);
        const u = p.castillo[0];
        if (!u) return;
        N.mover(e, u, "mano");
        const c = N.carta(e, u);
        if (c.tipo === "Oro") return api.entrarOro(e, u, ctx.ctrl, "pagado");
        if (coste(e, u) <= 2) N.robar(e, ctx.ctrl, coste(e, u));
        else N.quitarDelCastillo(e, N.rival(ctx.ctrl), coste(e, u), "destierro");
      },
    },
  },
  "Gusano Vampiro": {
    talisman: [
      {
        op: "modo",
        opciones: [
          { texto: "Desterrar dos del tope", pasos: [{ op: "desterrarTope", n: 2, quien: "rival" }] },
          { texto: "Desterrar dos del fondo", pasos: [{ op: "desterrarTope", n: 2, quien: "rival", fondo: true }] },
        ],
      },
    ],
    continuasCementerio: [{ fuerza: -1, costeMax: 1, conClave: "Furia" }],
  },
  Aaru: {
    unoPorTurno: true,
    orosMenos: "porOro",
    talisman: [sel(["yo:mano"], {}, "x", { n: 99, hasta: true }), { op: "fn", f: "aaru" }],
    fns: {
      porOro: (e, ctx) => N.orosDe(e, ctx.ctrl).length,
      aaru: (e, ctx) => {
        const k = (ctx.vars.x ?? []).length;
        for (const u of ctx.vars.x ?? []) N.mover(e, u, "castillo");
        if (k) N.barajarCastillo(e, ctx.ctrl);
        N.robar(e, ctx.ctrl, k + 2);
      },
    },
  },
  "Biblioteca de Caballeria": {
    disparadas: [{ cuando: ["faseFinal"], quien: "rival", si: "sinAliados", hacer: [robar(1), castilloElegido(aliadoDeCastillo)] }],
    fns: { sinAliados: (e, ctx) => N.aliadosDe(e, ctx.ctrl).length === 0 },
  },
  Tyet: {
    disparadas: [{ cuando: ["entra"], hacer: buscar(["yo:castillo"], { tipo: ["Arma", "Oro"] }) }],
    activadas: [
      {
        requiere: "enReserva",
        coste: [sel(["fuente"], {}, "yo"), mov("pagado", "yo")],
        hacer: [sel(["todos:reserva"], { tipo: "Oro", noFuente: true }), efecto("x", { tipo: "pierdeHabilidad" }), mov("pagado")],
      },
      alFondoYRobar,
    ],
    fns: { enReserva: (e, ctx) => e.jugadores[ctx.ctrl].reserva.includes(ctx.fuente), otraEnMano },
  },
  "Relicario de San Pancracio": {
    disparadas: [
      {
        cuando: ["entra"],
        hacer: [
          { op: "tope", n: 4, como: "m" },
          sel(["var:m"], { zona: "castillo" }, "a"),
          mov("mano", "a"),
          sel(["var:m"], { zona: "castillo" }, "b"),
          { op: "modo", opciones: [{ texto: "Cementerio", pasos: [mov("cementerio", "b")] }, { texto: "Destierro", pasos: [mov("desterrar", "b")] }] },
        ],
      },
      {
        cuando: ["comienzoVigilia"],
        quien: "rival",
        opcional: true,
        hacer: [castilloElegido((quien) => [{ op: "tope", quien, n: 3, fondo: true, como: "f" }, sel(["var:f"], {}, "d"), mov("desterrar", "d")])],
      },
    ],
  },
  "Nocturlabio de Liull": {
    disparadas: [
      {
        cuando: ["entra"],
        hacer: [
          { op: "mostrarHasta", tipos: ["Oro", "Aliado", "Tótem"], como: "m" },
          {
            op: "modo",
            opciones: [
              { texto: "Una a la mano", pasos: [sel(["var:m"]), mov("mano")] },
              { texto: "Pagar un Oro: las tres a la mano", requiere: "puedePagar", pasos: [{ op: "pagar", n: 1 }, mov("mano", "m")] },
            ],
          },
          barajar(),
        ],
      },
    ],
    fns: { puedePagar: (e, ctx) => e.jugadores[ctx.ctrl].reserva.length >= 1 },
  },
  Onsen: {
    disparadas: [{ cuando: ["entra"], hacer: buscar(["yo:castillo"], { noTipo: ["Aliado", "Talismán"] }) }],
    activadas: [
      {
        coste: [sel(["fuente"], {}, "yo"), mov("destruir", "yo")],
        hacer: [
          sel(["todos:cementerio"], {}, "c", { n: 5, hasta: true }),
          { op: "modo", opciones: [{ texto: "Barajar", pasos: [mov("barajar", "c")] }, { texto: "Desterrar", pasos: [mov("desterrar", "c")] }] },
        ],
      },
    ],
  },
  Was: {
    disparadas: [
      { cuando: ["entra"], hacer: [{ op: "mostrarHasta", n: 2, filtro: { noTipo: ["Talismán"] }, como: "m" }, mov("mano", "m"), barajar()] },
      { cuando: ["faseFinal"], si: "tres", opcional: true, hacer: [sel(["todos:cementerio"], {}, "c", { n: 2 }), mov("desterrar", "c")] },
    ],
    fns: { tres: (e, ctx) => N.aliadosDe(e, ctx.ctrl).length >= 3 },
  },
};

const AZI = {
  id: "azi",
  nombre: "Oro Azi",
  tipo: "Oro",
  coste: 0,
  fuerza: 0,
  disparadas: [{ cuando: ["faseFinal"], hacer: [sel(["todos:cementerio"], {}, "c"), mov("barajar", "c")] }],
};

function construir() {
  const porNombre = new Map(Object.values(CARTAS).map((c) => [c.nombre, c.id]));
  for (const nombre of Object.keys(HABILIDADES)) {
    if (!porNombre.has(nombre)) throw new Error(`Habilidad sin carta base: ${nombre}`);
  }
  const catalogo = { azi: AZI };
  for (const c of Object.values(CARTAS)) catalogo[c.id] = { ...c, ...(HABILIDADES[c.nombre] ?? {}) };
  return catalogo;
}

export const CATALOGO = construir();
