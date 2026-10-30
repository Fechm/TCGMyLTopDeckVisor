import * as N from "../nucleo.js";
import { sel, mov, barajar, robar, efecto, coste } from "../formato.js";
import { disponibles, hayObjetivo } from "../efectos.js";

const subirTotem = {
  texto: "Desterrarlo de tu mano o Cementerio para subir un Tótem de tu Cementerio a tu mano",
  momento: "vigilia",
  requiere: { de: ["yo:cementerio"], filtro: { tipo: "Tótem", noFuente: true } },
  coste: [sel(["fuente"], {}, "yo"), mov("desterrar", "yo")],
  hacer: [sel(["yo:cementerio"], { tipo: "Tótem" }), mov("mano")],
};

export const HABILIDADES = {
  Perugia: {
    disparadas: [
      { cuando: ["entra"], hacer: [{ op: "efecto", efecto: { tipo: "unaPorTipo" }, fin: "dosTurnos" }] },
      {
        cuando: ["sale"],
        si: "porAliado",
        hacer: [
          {
            op: "opcional",
            texto: "Pagar un Oro: buscar un Aliado en cada Castillo, desterrarlos y robar una carta",
            pagar: 1,
            pasos: [
              sel(["yo:castillo"], { tipo: "Aliado" }, "a"),
              sel(["rival:castillo"], { tipo: "Aliado" }, "b"),
              mov("desterrar", "a"),
              mov("desterrar", "b"),
              barajar(),
              barajar("rival"),
              robar(1),
            ],
          },
        ],
      },
    ],
    fns: {
      porAliado: (e, ctx) => {
        const origen = e.cola[0]?.ctx?.fuente;
        if (!origen || !e.instancias[origen]) return false;
        return N.ubicar(e, ctx.fuente)?.zona === "destierro" && N.carta(e, origen).tipo === "Aliado";
      },
    },
  },
  "Plaga de Ratas": {
    disparadas: [
      {
        cuando: ["entra"],
        opcional: true,
        hacer: [sel(["yo:castillo", "yo:cementerio"], { f: "esRatas" }, "r"), { op: "jugarGratis", var: "r" }, barajar()],
      },
    ],
    activadas: [
      {
        texto: "Destruirlo: barajar hasta dos cartas de los Cementerios o un Aliado gana 1 de Fuerza permanentemente",
        coste: [sel(["fuente"], {}, "yo"), mov("destruir", "yo")],
        hacer: [
          {
            op: "modo",
            opciones: [
              { texto: "Barajar hasta dos cartas de los Cementerios", pasos: [sel(["todos:cementerio"], {}, "c", { n: 2, hasta: true }), mov("barajar", "c")] },
              {
                texto: "Un Aliado gana 1 de Fuerza permanentemente",
                requiere: { de: ["todos:aliados"], filtro: {} },
                pasos: [sel(["todos:aliados"]), efecto("x", { tipo: "fuerza", n: 1 }, "juego")],
              },
            ],
          },
        ],
      },
    ],
    fns: { esRatas: (e, ctx, u) => N.carta(e, u).nombre === "Plaga de Ratas" },
  },
  "Santa Diestra": {
    anulaSinPagar: true,
  },
  "Plaga Inmunda": {
    continuas: [{ maxSalidasPorEfecto: true }],
    disparadas: [
      {
        cuando: ["entra"],
        opcional: true,
        hacer: [sel(["yo:cementerio"], {}, "c", { n: 2, hasta: true }), { op: "convertir", var: "c", en: "Aliado", fuerza: 1, a: "defensa" }],
      },
    ],
  },
  "Poeta del Upir": {
    disparadas: [
      {
        cuando: ["entra"],
        hacer: [
          { op: "fn", f: "marcar" },
          sel(["todos:enJuego"], { costeMax: 2 }, "a"),
          mov("barajar", "a"),
          { op: "si", f: "dos", entonces: [sel(["todos:enJuego"], { costeMax: 2 }, "b"), mov("barajar", "b"), robar(1)] },
        ],
      },
    ],
    activadas: [{ ...subirTotem, zona: "mano" }, { ...subirTotem, zona: "cementerio" }],
    fns: {
      marcar: (e, ctx) => {
        ctx.vars.dos = e.jugadores[ctx.ctrl].apoyo.filter((u) => N.carta(e, u).tipo === "Tótem").length >= 2;
      },
      dos: (e, ctx) => ctx.vars.dos === true,
    },
  },
  Pricolici: {
    disparadas: [
      {
        cuando: ["entra"],
        hacer: [
          {
            op: "opcional",
            texto: "Jugar un Aliado de tu Cementerio reduciendo su coste en un Oro",
            requiere: { de: ["yo:cementerio"], filtro: { tipo: "Aliado", f: "asequible" } },
            pasos: [sel(["yo:cementerio"], { tipo: "Aliado", f: "asequible" }, "x"), { op: "fn", f: "jugar" }],
          },
        ],
      },
    ],
    continuas: [{ cementerioRivalSinHabilidad: true }, { cementerioRivalNoBaraja: true }],
    fns: {
      asequible: (e, ctx, u) => Math.max(0, coste(e, u) - 1) <= disponibles(e, ctx.ctrl, "Aliado"),
      jugar: (e, ctx, api) => {
        const [uid] = ctx.vars.x ?? [];
        if (!uid) return;
        api.pagarOros(e, ctx.ctrl, Math.max(0, coste(e, uid) - 1), "Aliado");
        N.disparar(e, "juega", { uid, j: ctx.ctrl, tipo: "Aliado", pagado: true, desde: "cementerio" });
        return [{ op: "entrar", uid, datos: { pagado: true, desde: "cementerio" } }];
      },
    },
  },
  Urias: {
    claves: ["Furia"],
    disparadas: [
      {
        cuando: ["haceDano"],
        quien: "yo",
        opcional: true,
        hacer: [
          sel(["yo:aliados"], {}, "s"),
          mov("barajar", "s"),
          sel(["todos:enJuego"], { costeMax: 2, noFuente: true, para: "tomar" }, "a", { hasta: true }),
          sel(["todos:cementerio"], { para: "tomar" }, "c", { hasta: true }),
          { op: "convertir", var: "a", en: "Aliado", fuerza: 2, a: "defensa" },
          { op: "convertir", var: "c", en: "Aliado", fuerza: 2, a: "defensa" },
        ],
      },
    ],
  },
  Valerious: {
    disparadas: [
      { cuando: ["entra"], si: "pagado", hacer: [sel(["rival:enJuego"], { noTipo: ["Oro"] }, "x", { n: 99 }), mov("barajar")] },
      {
        cuando: ["juega"],
        quien: "rival",
        zona: ["mano"],
        si: "hayAliadoRival",
        opcional: true,
        hacer: [sel(["fuente"], {}, "yo"), mov("desterrar", "yo"), sel(["rival:aliados"], {}, "a"), efecto("a", { tipo: "debeAtacar" }, "turno")],
      },
    ],
    fns: {
      pagado: (e, ctx) => ctx.datos.pagado === true,
      hayAliadoRival: (e, ctx) => N.aliadosDe(e, N.rival(ctx.ctrl)).length > 0,
    },
  },
  "Válva Apei": {
    activadas: [
      {
        texto: "Si controlas dos o más Tótems, convertir una carta de coste 2 o menos en un Tótem sin habilidad y ganar su control",
        veces: "turno",
        requiere: "puede",
        hacer: [sel(["todos:enJuego"], { costeMax: 2, noFuente: true, para: "tomar" }, "x"), { op: "convertir", var: "x", en: "Tótem", fuerza: 0, a: "apoyo" }],
      },
    ],
    disparadas: [{ cuando: ["sale"], hacer: [{ op: "fn", f: "devolver" }] }],
    fns: {
      puede: (e, ctx) =>
        e.jugadores[ctx.ctrl].apoyo.filter((u) => N.carta(e, u).tipo === "Tótem").length >= 2 &&
        hayObjetivo(e, ctx, { de: ["todos:enJuego"], filtro: { costeMax: 2, noFuente: true }, para: "tomar" }),
      devolver: (e) => {
        for (const u of N.todoEnJuego(e)) {
          const loc = N.ubicar(e, u);
          if (loc.zona === "arma" || loc.j === N.dueno(u) || N.carta(e, u).tipo === "Oro") continue;
          N.sacar(e, u);
          e.jugadores[N.dueno(u)][loc.zona === "ataque" ? "defensa" : loc.zona].push(u);
        }
      },
    },
  },
  "Válva Bailor": {
    claves: ["Indestructible"],
    disparadas: [
      {
        cuando: ["entra"],
        hacer: [
          sel(["todos:enJuego", "todos:cementerio"], { f: "elegible", noFuente: true, para: "tomar" }, "x", { n: 2, hasta: true }),
          { op: "convertir", var: "x", en: "Tótem", fuerza: 0, coste: 5, a: "apoyo" },
        ],
      },
    ],
    fns: { elegible: (e, ctx, u) => !N.enJuego(e, u) || coste(e, u) <= 2 },
  },
  "Zâna": {
    disparadas: [
      {
        cuando: ["entra"],
        quien: "cualquiera",
        veces: 1,
        si: "cuesta",
        opcional: true,
        hacer: [
          robar(1),
          robar(1, "rival"),
          sel(["yo:mano"], {}, "a"),
          sel(["rival:mano"], {}, "b", { quien: "rival" }),
          mov("barajar", "a"),
          mov("barajar", "b"),
          sel(["yo:cementerio"], {}, "c", { n: 2, hasta: true }),
          mov("barajar", "c"),
        ],
      },
    ],
    continuas: [{ fuerza: -1, a: "aliadosRival" }],
    fns: { cuesta: (e, ctx) => coste(e, ctx.datos.uid) >= 1 },
  },
};
