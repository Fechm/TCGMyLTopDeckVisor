import * as N from "../nucleo.js";
import { sel, mov, barajar, robar, efecto, buscar, castilloElegido, coste } from "../formato.js";
import { disponibles, pagarOros } from "../efectos.js";

const sinCopia = (e, ctx) => !e.jugadores[ctx.ctrl].apoyo.some((u) => u !== ctx.fuente && N.carta(e, u).id === ctx.def);

const agruparOro = [sel(["yo:pagado"], { tipo: "Oro" }, "o"), mov("reserva", "o")];

const barajarODesterrar = (v) => ({
  op: "modo",
  opciones: [
    { texto: "Barajar", pasos: [mov("barajar", v)] },
    { texto: "Desterrar", pasos: [mov("desterrar", v)] },
  ],
});

const deCementerios = (n) => [sel(["todos:cementerio"], {}, "c", { n, hasta: true }), barajarODesterrar("c")];

const sumaCostes = (tope) => ({
  suma: (e, ctx) => {
    const acc = ctx.vars.acc ?? [];
    const usado = acc.reduce((s, u) => s + coste(e, u), 0);
    return [sel(["todos:enJuego"], { costeMax: tope - usado, excluir: acc, noFuente: true }, "n", { hasta: true }), { op: "fn", f: "sumar" }];
  },
  sumar: (e, ctx) => {
    const n = ctx.vars.n ?? [];
    if (!n.length) return [];
    ctx.vars.acc = [...(ctx.vars.acc ?? []), ...n];
    return [{ op: "fn", f: "suma" }];
  },
});

const tomarDato = (e, ctx) => {
  ctx.vars.s = [ctx.datos.uid];
};

const visionLibre = (e, ctx, i) => !(e.turno <= (e.usos[`vision|${ctx.fuente}|${i}`] ?? -9) + 2);

export const HABILIDADES = {
  Pegana: {
    claves: ["NoAnulable"],
    disparadas: [
      { cuando: ["entra"], hacer: [{ op: "fn", f: "sincronizar" }] },
      { cuando: ["alCementerio", "comienzoTurno", "juega", "saleDelJuego"], quien: "cualquiera", hacer: [{ op: "fn", f: "sincronizar" }] },
      { cuando: ["sale"], hacer: [{ op: "fn", f: "sincronizar" }] },
    ],
    fns: {
      sincronizar: (e, ctx) => {
        e.efectos = e.efectos.filter((f) => !(f.tipo === "noJugarNombre" && f.origen === ctx.fuente));
        if (!N.enJuego(e, ctx.fuente)) return;
        for (const j of [0, 1]) {
          const p = e.jugadores[j];
          const nombres = new Set([...p.cementerio, ...p.destierro].filter((u) => N.carta(e, u).tipo !== "Aliado").map((u) => N.carta(e, u).nombre));
          for (const nombre of nombres) N.agregarEfecto(e, { tipo: "noJugarNombre", j, nombre, origen: ctx.fuente, uid: ctx.fuente, fin: "mientras" }, ctx.ctrl);
        }
      },
    },
  },
  "Piedra de la Iglesia": {
    claves: ["Indestructible"],
    disparadas: [
      {
        cuando: ["comienzoVigilia"],
        quien: "cualquiera",
        hacer: [castilloElegido((quien) => [{ op: "tope", quien, n: 3, como: "m" }, sel(["var:m"], { zona: "castillo" }, "c"), mov("cementerio", "c")])],
      },
    ],
    activadas: [
      {
        texto: "Destruir una carta que controles para robar una carta",
        veces: "turno",
        requiere: { de: ["yo:enJuego"], filtro: {}, para: "destruir" },
        coste: [sel(["yo:enJuego"], {}, "d", { para: "destruir" }), mov("destruir", "d")],
        hacer: [robar(1)],
      },
    ],
  },
  "Pirámide de Guiza": {
    requiere: "sinCopia",
    disparadas: [
      { cuando: ["entra"], hacer: [{ op: "fn", f: "razas" }] },
      { cuando: ["sale"], si: "destruidaODesterrada", hacer: [sel(["todos:aliados"], { f: "otraRaza" }, "x", { n: 99 }), mov("destruir")] },
    ],
    continuas: [{ fuerzaPor: "porRaza", a: "tusAliados" }],
    fns: {
      sinCopia,
      razas: (e) => {
        const razas = [...new Set(Object.values(e.catalogo).filter((c) => c.tipo === "Aliado").flatMap((c) => c.razas ?? []))].filter((r) => r !== "Sin raza");
        return [{ op: "modo", opciones: razas.map((r) => ({ texto: r, pasos: [{ op: "fn", f: "fijar", raza: r }] })) }];
      },
      fijar: (e, ctx, api, p) => {
        e.usos[`raza|${ctx.fuente}`] = p.raza;
      },
      porRaza: (e, ctx) => ((N.carta(e, ctx.objetivo).razas ?? []).includes(e.usos[`raza|${ctx.fuente}`]) ? 2 : 0),
      destruidaODesterrada: (e, ctx) => ["cementerio", "destierro"].includes(N.ubicar(e, ctx.fuente)?.zona),
      otraRaza: (e, ctx, u) => !(N.carta(e, u).razas ?? []).includes(e.usos[`raza|${ctx.fuente}`]),
    },
  },
  "Planta de la Juventud": {
    activadas: [
      {
        texto: "Jugar un Tótem de tu Cementerio pagando su coste",
        momento: "vigilia",
        veces: "turno",
        requiere: { de: ["yo:cementerio"], filtro: { tipo: "Tótem", f: "pagable" } },
        hacer: [sel(["yo:cementerio"], { tipo: "Tótem", f: "pagable" }, "t"), { op: "fn", f: "jugarTotem" }],
      },
    ],
    fns: {
      pagable: (e, ctx, u) => coste(e, u) <= disponibles(e, ctx.ctrl, "Tótem"),
      jugarTotem: (e, ctx, api) => {
        for (const u of ctx.vars.t ?? []) {
          pagarOros(e, ctx.ctrl, coste(e, u), "Tótem");
          N.disparar(e, "juega", { uid: u, j: ctx.ctrl, tipo: "Tótem", pagado: true, desde: "cementerio" });
          api.entrarEnJuego(e, u, ctx.ctrl, undefined, { pagado: true, desde: "cementerio" });
        }
      },
    },
  },
  "Plaza de Armas": {
    claves: ["NoAnulable"],
    activadas: [
      {
        texto: "Mostrar del tope de tu Castillo hasta un Arma, ponerla en tu mano y generar un Oro para Armas",
        veces: "turno",
        hacer: [{ op: "mostrarHasta", n: 1, filtro: { tipo: "Arma" }, como: "m" }, mov("mano", "m"), barajar(), { op: "generar", n: 1, tipos: ["Arma"] }],
      },
    ],
    continuas: [{ impuestoTalisman: true, si: "talismanVigilia" }],
    fns: {
      talismanVigilia: (e, ctx) => e.fase === "vigilia" && N.aliadosDe(e, ctx.ctrl).some((a) => coste(e, a) >= 1),
    },
  },
  "Plaza de Armas - Sp": {
    claves: ["NoAnulable"],
    requiere: "sinCopia",
    disparadas: [
      {
        cuando: ["entra"],
        hacer: [{ op: "modo", opciones: ["Talismán", "Arma", "Tótem"].map((t) => ({ texto: t, pasos: [{ op: "fn", f: "nombrar", tipo: t }] })) }],
      },
    ],
    continuas: [{ impuestoTalisman: true, si: "nombroTalisman" }, { fuerza: 1, a: "tusAliados" }],
    fns: {
      sinCopia,
      nombrar: (e, ctx, api, p) => {
        e.usos[`tipo|${ctx.fuente}`] = p.tipo;
      },
      nombroTalisman: (e, ctx) => e.usos[`tipo|${ctx.fuente}`] === "Talismán",
    },
  },
  Pnyx: {
    claves: ["Exhumar"],
    disparadas: [{ cuando: ["entra"], hacer: [sel(["todos:enJuego"], { costeMax: 2, noFuente: true }), mov("barajar"), robar(1)] }],
    activadas: [
      {
        texto: "Hasta una carta en juego y hasta una carta de un Cementerio o Destierro pierden su habilidad hasta tu próximo turno",
        veces: "turno",
        hacer: [
          sel(["todos:enJuego"], {}, "a", { hasta: true }),
          efecto("a", { tipo: "pierdeHabilidad" }, "proximoTurno"),
          sel(["todos:cementerio", "todos:destierro"], {}, "b", { hasta: true }),
          { op: "fn", f: "silenciar" },
        ],
      },
    ],
    fns: {
      silenciar: (e, ctx) => {
        for (const u of ctx.vars.b ?? []) e.conv[u] = { tipo: N.carta(e, u).tipo, sinHabilidad: true, hastaInicioDe: ctx.ctrl, desde: e.turno };
      },
    },
  },
  "Puerta del Firmamento": {
    activadas: [
      {
        texto: "Buscar un Tótem en tu Castillo o generar un Oro para Tótems",
        momento: "vigilia",
        veces: "turno",
        hacer: [
          {
            op: "modo",
            opciones: [
              { texto: "Buscar un Tótem", pasos: buscar(["yo:castillo"], { tipo: "Tótem" }) },
              { texto: "Generar un Oro para Tótems", pasos: [{ op: "generar", n: 1, tipos: ["Tótem"] }] },
            ],
          },
        ],
      },
      {
        texto: "Convertir un Tótem en un Aliado con Furia y Fuerza igual a su coste por el turno",
        veces: "turno",
        requiere: { de: ["yo:apoyo"], filtro: { tipo: "Tótem" } },
        hacer: [sel(["yo:apoyo"], { tipo: "Tótem" }, "t"), { op: "fn", f: "convertir" }],
      },
    ],
    fns: {
      convertir: (e, ctx) => {
        for (const u of ctx.vars.t ?? []) {
          const f = coste(e, u);
          N.mover(e, u, "defensa", { j: ctx.ctrl });
          e.jugadores[ctx.ctrl].nuevos.push(u);
          e.conv[u] = { tipo: "Aliado", fuerza: f, sinHabilidad: true, hastaInicioDe: N.rival(ctx.ctrl), desde: e.turno, vuelve: "apoyo" };
          N.agregarEfecto(e, { tipo: "gana", clave: "Furia", uid: u }, ctx.ctrl);
        }
      },
    },
  },
  "Quicaví": {
    claves: ["Exhumar"],
    disparadas: [{ cuando: ["entra"], hacer: [{ op: "generar", n: 1 }] }],
    activadas: [
      {
        texto: "Hasta tu próximo turno, una carta de tu Cementerio gana Exhumar y no recibes daño de combate",
        veces: "turno",
        hacer: [
          sel(["yo:cementerio"], {}, "c"),
          efecto("c", { tipo: "gana", clave: "Exhumar" }, "proximoTurno"),
          { op: "efecto", efecto: { tipo: "prevenirDano" }, jugador: "yo", fin: "proximoTurno" },
        ],
      },
    ],
  },
  "Reino de Midgard": {
    disparadas: [
      { cuando: ["entra"], opcional: true, hacer: [robar(2), sel(["yo:mano"]), mov("cementerio")] },
      { cuando: ["faseFinal"], hacer: [sel(["todos:cementerio"], {}, "c", { n: 2, hasta: true }), mov("desterrar", "c")] },
      { cuando: ["faseFinal"], quien: "rival", hacer: [{ op: "botar", n: 1, quien: "rival" }] },
    ],
  },
  Reni: {
    disparadas: [{ cuando: ["entra"], opcional: true, hacer: [sel(["yo:cementerio"], { tipo: "Aliado" }, "a", { n: 2, hasta: true }), mov("mano", "a")] }],
    continuas: [{ fuerzaPor: "costesDistintos", a: "tusAliados" }],
    fns: { costesDistintos: (e, ctx) => new Set(N.aliadosDe(e, ctx.ctrl).map((u) => coste(e, u))).size },
  },
  "Santuario de la Fuerza": {
    disparadas: [{ cuando: ["anulada"], quien: "yo", si: "aliadoOArma", opcional: true, hacer: [{ op: "fn", f: "tomarDato" }, mov("mano", "s")] }],
    continuas: [{ gana: "AtacaAlEntrar", a: "tusAliados" }, { fuerza: 1, a: "tusAliados" }],
    fns: {
      tomarDato,
      aliadoOArma: (e, ctx) => ["Aliado", "Arma"].includes(ctx.datos.tipo) && e.jugadores[ctx.ctrl].cementerio.includes(ctx.datos.uid),
    },
  },
  Sarras: {
    activadas: [{ texto: "Buscar en tu Castillo un Talismán de coste 3 o más", momento: "vigilia", veces: "turno", hacer: buscar(["yo:castillo"], { tipo: "Talismán", costeMin: 3 }) }],
  },
  Stonehenge: {
    requiere: "sinCopia",
    activadas: [
      {
        texto: "Botar dos cartas para subir una carta que no sea Talismán de tu Cementerio a tu mano",
        momento: "vigilia",
        veces: "turno",
        requiere: "puedeBotar",
        coste: [{ op: "botar", n: 2 }],
        hacer: [sel(["yo:cementerio"], { noTipo: ["Talismán"] }), mov("mano")],
      },
    ],
    fns: { sinCopia, puedeBotar: (e, ctx) => e.jugadores[ctx.ctrl].castillo.length > 2 },
  },
  "Templo de Hatshepsut": {
    claves: ["Exhumar"],
    disparadas: [
      { cuando: ["entra"], hacer: [sel(["rival:enJuego"], { costeMax: 3 }), barajarODesterrar("x")] },
      { cuando: ["faseFinal"], si: "libre", opcional: true, hacer: [{ op: "fn", f: "marcar" }, ...deCementerios(3)] },
    ],
    activadas: [
      {
        texto: "Desterrar o Barajar hasta tres cartas de los Cementerios",
        momento: "vigilia",
        veces: "turno",
        requiere: "libre",
        hacer: [{ op: "fn", f: "marcar" }, ...deCementerios(3)],
      },
    ],
    fns: {
      libre: (e, ctx) => e.usos[`hatshepsut|${ctx.fuente}`] !== e.turno,
      marcar: (e, ctx) => {
        e.usos[`hatshepsut|${ctx.fuente}`] = e.turno;
      },
    },
  },
  "Templo de los Eternos": {
    activadas: [
      {
        texto: "Barajar hasta un Aliado o Tótem y hasta tres cartas de los Cementerios",
        veces: "turno",
        hacer: [
          sel(["todos:aliados", "todos:apoyo"], { tipo: ["Aliado", "Tótem"] }, "a", { hasta: true }),
          mov("barajar", "a"),
          sel(["todos:cementerio"], {}, "c", { n: 3, hasta: true }),
          mov("barajar", "c"),
        ],
      },
    ],
  },
  "Torre de Babel": {
    claves: ["Exhumar"],
    disparadas: [{ cuando: ["entra"], hacer: [{ op: "fn", f: "suma" }, efecto("acc", { tipo: "pierdeHabilidad" }), mov("barajar", "acc")] }],
    activadas: [
      {
        texto: "Barajar una carta de tu mano para Barajar o Desterrar hasta cinco cartas de los Cementerios y robar dos",
        veces: "turno",
        requiere: "conMano",
        coste: [sel(["yo:mano"], {}, "m"), mov("barajar", "m")],
        hacer: [...deCementerios(5), robar(2)],
      },
    ],
    fns: { ...sumaCostes(4), conMano: (e, ctx) => e.jugadores[ctx.ctrl].mano.length > 0 },
  },
  Transilvania: {
    claves: ["Exhumar"],
    disparadas: [
      {
        cuando: ["entra", "sale"],
        hacer: [
          {
            op: "opcional",
            texto: "Pagar un Oro para convertir una carta de coste 4 o menos en un Oro sin habilidad en tu Oro Pagado",
            pagar: 1,
            requiere: { de: ["todos:enJuego"], filtro: { costeMax: 4, noFuente: true }, para: "tomar" },
            pasos: [sel(["todos:enJuego"], { costeMax: 4, noFuente: true }, "x", { para: "tomar" }), { op: "convertir", var: "x", en: "Oro", a: "pagado" }],
          },
        ],
      },
      { cuando: ["faseFinal"], hacer: [...agruparOro, robar(1)] },
    ],
  },
  "Tumba de la Esperanza": {
    activadas: [
      {
        texto: "Destruir una carta de coste 0",
        veces: "turno",
        requiere: { de: ["todos:enJuego"], filtro: { costeMax: 0 }, para: "destruir" },
        hacer: [sel(["todos:enJuego"], { costeMax: 0 }, "x", { para: "destruir" }), mov("destruir")],
      },
      {
        texto: "Descartar una carta para robar dos",
        veces: "turno",
        requiere: "conMano",
        coste: [sel(["yo:mano"], {}, "d"), mov("cementerio", "d")],
        hacer: [robar(2)],
      },
    ],
    disparadas: [
      {
        cuando: ["faseFinal"],
        hacer: [
          {
            op: "opcional",
            texto: "Desterrar una carta de tu mano para agrupar un Oro",
            requiere: "conMano",
            pasos: [sel(["yo:mano"], {}, "d"), mov("desterrar", "d"), ...agruparOro],
          },
        ],
      },
    ],
    fns: { conMano: (e, ctx) => e.jugadores[ctx.ctrl].mano.length > 0 },
  },
  "Tunel de Madriguera": {
    requiere: "dosOMas",
    activadas: [{ texto: "Buscar un Arma o Tótem en tu Castillo", momento: "vigilia", veces: "turno", hacer: buscar(["yo:castillo"], { tipo: ["Arma", "Tótem"] }) }],
    disparadas: [
      {
        cuando: ["faseFinal"],
        opcional: true,
        hacer: [
          {
            op: "modo",
            opciones: [
              { texto: "Robar una carta", pasos: [robar(1)] },
              { texto: "El oponente Bota tres cartas", pasos: [{ op: "botar", n: 3, quien: "rival" }] },
            ],
          },
        ],
      },
    ],
    fns: {
      dosOMas: (e, ctx) => N.aliadosDe(e, ctx.ctrl).length + e.jugadores[ctx.ctrl].apoyo.filter((u) => N.carta(e, u).tipo === "Tótem").length >= 2,
    },
  },
  "Tótem de la Visión Eterna": {
    activadas: [
      {
        texto: "Elegir un efecto: Barajar cartas de coste total 4 o menos y robar dos, o buscar una carta y el oponente Descarta una",
        momento: "vigilia",
        veces: "turno",
        requiere: "algunoLibre",
        hacer: [
          {
            op: "modo",
            opciones: [
              {
                texto: "Barajar cartas en juego de coste total 4 o menos y robar dos",
                requiere: "libre0",
                pasos: [{ op: "fn", f: "marcar", i: 0 }, { op: "fn", f: "suma" }, mov("barajar", "acc"), robar(2)],
              },
              {
                texto: "Buscar una carta en tu Castillo y el oponente Descarta una carta",
                requiere: "libre1",
                pasos: [{ op: "fn", f: "marcar", i: 1 }, ...buscar(["yo:castillo"], {}), sel(["rival:mano"], {}, "d", { quien: "rival" }), mov("cementerio", "d")],
              },
            ],
          },
        ],
      },
    ],
    fns: {
      ...sumaCostes(4),
      marcar: (e, ctx, api, p) => {
        e.usos[`vision|${ctx.fuente}|${p.i}`] = e.turno;
      },
      libre0: (e, ctx) => visionLibre(e, ctx, 0),
      libre1: (e, ctx) => visionLibre(e, ctx, 1),
      algunoLibre: (e, ctx) => visionLibre(e, ctx, 0) || visionLibre(e, ctx, 1),
    },
  },
  "Tótem del Dragón Ancestral": {
    claves: ["Exhumar"],
    disparadas: [
      {
        cuando: ["entra"],
        hacer: [
          ...deCementerios(3),
          {
            op: "modo",
            opciones: [
              {
                texto: "Destruir una carta de coste 2 o menos",
                requiere: { de: ["todos:enJuego"], filtro: { costeMax: 2, noFuente: true }, para: "destruir" },
                pasos: [sel(["todos:enJuego"], { costeMax: 2, noFuente: true }, "x", { para: "destruir" }), mov("destruir")],
              },
              { texto: "Robar dos cartas", pasos: [robar(2)] },
            ],
          },
        ],
      },
    ],
  },
  "Túneles Secretos": {
    disparadas: [
      { cuando: ["entra"], hacer: [sel(["yo:mano", "yo:cementerio"], { noTipo: ["Oro"], f: "pagable" }, "j"), { op: "fn", f: "jugarReducida" }] },
      { cuando: ["saleDelJuego"], quien: "yo", veces: 1, si: "aliadoPropio", opcional: true, hacer: [{ op: "fn", f: "tomarDato" }, mov("mano", "s")] },
      { cuando: ["faseFinal"], hacer: [...deCementerios(5), robar(1)] },
    ],
    fns: {
      tomarDato,
      pagable: (e, ctx, u) => Math.max(0, coste(e, u) - 1) <= disponibles(e, ctx.ctrl, N.carta(e, u).tipo),
      aliadoPropio: (e, ctx) => ctx.datos.tipo === "Aliado" && ctx.datos.uid !== ctx.fuente,
      jugarReducida: (e, ctx) => {
        const [u] = ctx.vars.j ?? [];
        if (!u) return;
        const c = N.carta(e, u);
        const desde = N.ubicar(e, u)?.zona ?? null;
        pagarOros(e, ctx.ctrl, Math.max(0, coste(e, u) - 1), c.tipo);
        N.disparar(e, "juega", { uid: u, j: ctx.ctrl, tipo: c.tipo, pagado: true, desde });
        const datos = { pagado: true, desde };
        if (c.tipo === "Talismán") {
          N.sacar(e, u);
          e.cola.unshift(N.nuevoFrame([...(c.talisman ?? []), { op: "finTalisman", uid: u }], { ctrl: ctx.ctrl, fuente: u, def: c.id, costeFuente: c.coste ?? 0 }));
          return;
        }
        if (c.tipo === "Arma") return [sel(["yo:aliados"], { armaLibre: u }, "_port"), { op: "portar", arma: u, en: "_port", datos }];
        return [{ op: "entrar", uid: u, datos }];
      },
    },
  },
  Vinland: {
    activadas: [
      {
        texto: "Subir un Tótem de tu Cementerio a tu mano y Descartar una carta",
        veces: "turno",
        requiere: { de: ["yo:cementerio"], filtro: { tipo: "Tótem" } },
        hacer: [sel(["yo:cementerio"], { tipo: "Tótem" }, "t"), mov("mano", "t"), sel(["yo:mano"], {}, "d"), mov("cementerio", "d")],
      },
    ],
    continuas: [{ fuerza: -1, a: "aliadosRival" }],
  },
  "Virreinato del Peru": {
    claves: ["Exhumar"],
    disparadas: [{ cuando: ["entra"], hacer: [robar(2), { op: "botar", n: 4, quien: "rival" }] }],
    activadas: [
      {
        texto: "Destruirlo para robar dos cartas y Descartar una",
        coste: [sel(["fuente"], {}, "yo"), mov("destruir", "yo")],
        hacer: [robar(2), sel(["yo:mano"], {}, "d"), mov("cementerio", "d")],
      },
    ],
    continuas: [{ fuerza: 2, a: "tusAliados" }],
  },
};
