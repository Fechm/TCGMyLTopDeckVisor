import * as N from "../nucleo.js";
import { sel, mov, barajar, robar, efecto, buscar, castilloElegido, aliadoDeCastillo, coste } from "../formato.js";
import { armaCabe, hayObjetivo } from "../efectos.js";

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
const deTipoEn = (e, j, zonas, tipos) => zonas.some((z) => e.jugadores[j][z].some((u) => tipos.includes(N.carta(e, u).tipo)));
const armaEnManoOCementerio = (e, ctx) => deTipoEn(e, ctx.ctrl, ["mano", "cementerio"], ["Arma"]);
const sinTildes = (s) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

const vetarNombres = (jugadores) => (e, ctx) => {
  const js = jugadores === "ambos" ? [0, 1] : [N.rival(ctx.ctrl)];
  for (const u of ctx.vars.n ?? []) for (const j of js) N.agregarEfecto(e, { tipo: "noJugarNombre", j, nombre: N.carta(e, u).nombre, fin: "proximoTurno" }, ctx.ctrl);
};

const vecesPorTurno = (clave, max) => (e, ctx) => {
  const k = `${clave}|${ctx.fuente}`;
  const uso = e.usos[k];
  const n = uso?.turno === e.turno ? uso.n : 0;
  if (n >= max) return false;
  e.usos[k] = { turno: e.turno, n: n + 1 };
  return true;
};

function portarComoArma(e, uid, portador) {
  if (uid === portador || !N.enJuego(e, portador)) return;
  N.sacar(e, uid);
  e.conv[uid] = { tipo: "Arma", sinHabilidad: true };
  (e.armas[portador] ??= []).push(uid);
}

const limpiarConvertidas = (e) => {
  for (const [u, c] of Object.entries(e.conv)) if (c.tipo === "Arma" && !N.enJuego(e, u)) delete e.conv[u];
};

const desdeUnCementerio = (cantidad, pasosCon) => ({
  op: "modo",
  opciones: [
    { texto: "tu Cementerio", pasos: [sel(["yo:cementerio"], {}, "c", { ...cantidad, hasta: true }), ...pasosCon] },
    { texto: "Cementerio oponente", pasos: [sel(["rival:cementerio"], {}, "c", { ...cantidad, hasta: true }), ...pasosCon] },
  ],
});

const cambiarPortador = {
  fns: {
    movible: (e, ctx, a) => N.aliadosDe(e, ctx.ctrl).some((x) => x !== N.portadorDe(e, a) && armaCabe(e, x, a)),
    nuevoPortador: (e, ctx, x) => {
      const [a] = ctx.vars.a ?? [];
      return !!a && x !== N.portadorDe(e, a) && armaCabe(e, x, a);
    },
    cambiar: (e, ctx) => {
      const [a] = ctx.vars.a ?? [];
      const [p] = ctx.vars.p ?? [];
      if (!a || !p) return;
      N.sacar(e, a);
      (e.armas[p] ??= []).push(a);
    },
  },
  pasos: [sel(["yo:armas"], { f: "movible" }, "a"), sel(["yo:aliados"], { f: "nuevoPortador" }, "p"), { op: "fn", f: "cambiar" }],
};

export const HABILIDADES = {
  Molotok: {
    continuas: [{ armasEnGuerra: true }],
  },
  "Mycroft Holmes": {
    disparadas: [
      { cuando: ["entra"], hacer: buscar(["yo:castillo"], { tipo: "Aliado", f: "holmes" }) },
      { cuando: ["entra"], hacer: [castilloElegido(aliadoDeCastillo)] },
    ],
    fns: { holmes: (e, ctx, u) => N.carta(e, u).nombre.includes("Holmes") },
  },
  "Nefertiti de Corazones": {
    claves: ["Imbloqueable"],
    activadas: [
      {
        texto: "Barajar o Destruir hasta una carta de coste 3 o menos y Barajar hasta tres cartas de los Cementerios",
        momento: "tuTurno",
        veces: "turno",
        hacer: [
          sel(["todos:enJuego"], { costeMax: 3 }, "x", { hasta: true }),
          {
            op: "si",
            f: "eligio",
            entonces: [{ op: "modo", opciones: [{ texto: "Barajar", pasos: [mov("barajar")] }, { texto: "Destruir", pasos: [mov("destruir")] }] }],
          },
          sel(["todos:cementerio"], {}, "c", { n: 3, hasta: true }),
          mov("barajar", "c"),
        ],
      },
    ],
    disparadas: [
      { cuando: ["alCementerio"], quien: "rival", si: "dosVeces", hacer: [sel(["rival:cementerio"], {}, "c", { n: 2, hasta: true }), mov("desterrar", "c")] },
      { cuando: ["salenDelCastillo"], quien: "rival", si: "botaDosVeces", hacer: [sel(["rival:cementerio"], {}, "c", { n: 2, hasta: true }), mov("desterrar", "c")] },
    ],
    fns: {
      eligio: (e, ctx) => (ctx.vars.x ?? []).length > 0,
      dosVeces: vecesPorTurno("nefertiti", 2),
      botaDosVeces: (e, ctx) => ctx.datos.zona === "cementerio" && vecesPorTurno("nefertiti", 2)(e, ctx),
    },
  },
  Nemo: {
    disparadas: [
      { cuando: ["entra"], hacer: buscar(["yo:castillo", "yo:cementerio"], { tipo: "Arma" }) },
      {
        cuando: ["saleDelJuego"],
        quien: "cualquiera",
        veces: 1,
        si: "puede",
        opcional: true,
        hacer: [{ op: "fn", f: "cargar" }, { op: "convertir", var: "x", en: "Aliado", fuerza: 2, a: "defensa" }],
      },
    ],
    fns: {
      puede: (e, ctx) => armaEnManoOCementerio(e, ctx) && !N.enJuego(e, ctx.datos.uid),
      cargar: (e, ctx) => {
        ctx.vars.x = [ctx.datos.uid];
      },
    },
  },
  "Nu-Galahad": {
    claves: ["Imbloqueable"],
    reduce: "red",
    exhumarSi: "armasOAntes",
    disparadas: [
      { cuando: ["entra", "sale"], hacer: [sel(["yo:destierro"], { tipo: "Arma" }, "a", { n: 2, hasta: true }), mov("barajar", "a"), robar(2)] },
      registrarArmas,
    ],
    fns: { armasOAntes, registrar, red: (e, ctx) => (armasOAntes(e, ctx) ? 1 : 0) },
  },
  "Nu-Galahad Prime": {
    disparadas: [{ cuando: ["entra"], hacer: buscar(["yo:castillo"], { f: "armaOCaballero" }) }],
    activadas: [
      {
        texto: "Comienzo de la Batalla: convertir Armas que controles en Aliados de Fuerza 3 con Furia e Imbloqueable",
        momento: "vigilia",
        veces: "turno",
        requiere: "controlaArmas",
        hacer: [
          sel(["yo:armas"], {}, "a", { n: 99, hasta: true }),
          { op: "convertir", var: "a", en: "Aliado", fuerza: 3, a: "defensa" },
          efecto("a", { tipo: "gana", clave: "Furia" }),
          efecto("a", { tipo: "gana", clave: "Imbloqueable" }),
        ],
      },
    ],
    fns: {
      controlaArmas,
      armaOCaballero: (e, ctx, u) => {
        const c = N.carta(e, u);
        return c.tipo === "Arma" || (c.tipo === "Aliado" && esCaballero(e, u));
      },
    },
  },
  "Nu-Galahad el Bastion": {
    activadas: [
      {
        texto: "Portar hasta tres cartas de un Cementerio como Armas sin habilidad",
        veces: "turno",
        requiere: "hayCementerio",
        hacer: [desdeUnCementerio({ n: 3 }, [{ op: "fn", f: "portar" }])],
      },
      {
        texto: "Mirar tantas cartas del tope de tu Castillo como Armas controles, jugar un Arma y un Aliado de Fuerza 4 o menos sin pagar su coste y Barajar el resto",
        veces: "turno",
        requiere: "controlaArmas",
        hacer: [
          { op: "tope", nf: "armas", como: "m" },
          sel(["var:m"], { tipo: "Arma", zona: "castillo" }, "a", { hasta: true }),
          sel(["var:m"], { tipo: "Aliado", zona: "castillo", f: "fuerza4" }, "b", { hasta: true }),
          { op: "jugarGratis", var: "a" },
          { op: "jugarGratis", var: "b" },
          barajar(),
        ],
      },
    ],
    disparadas: [{ cuando: ["sale"], hacer: [{ op: "fn", f: "limpiar" }] }],
    continuas: [{ armaAdicional: true }],
    fns: {
      controlaArmas,
      hayCementerio: (e) => e.jugadores.some((p) => p.cementerio.length > 0),
      armas: (e, ctx) => N.armasDe(e, ctx.ctrl).length,
      fuerza4: (e, ctx, u) => (N.carta(e, u).fuerza ?? 0) <= 4,
      portar: (e, ctx) => {
        for (const u of ctx.vars.c ?? []) portarComoArma(e, u, ctx.fuente);
      },
      limpiar: limpiarConvertidas,
    },
  },
  "Otto Lidenbrock": {
    activadas: [
      {
        texto: "Mostrar un Arma de tu mano o Cementerio: convertir una carta de coste 3 o menos o de un Cementerio en un Aliado de Fuerza 2 sin habilidad bajo tu control",
        momento: "tuTurno",
        veces: "turno",
        requiere: "puede",
        hacer: [
          sel(["yo:mano", "yo:cementerio"], { tipo: "Arma" }, "arma"),
          sel(["todos:enJuego", "todos:cementerio"], { f: "objetivo", noFuente: true }, "x", { para: "tomar" }),
          { op: "convertir", var: "x", en: "Aliado", fuerza: 2, a: "defensa" },
        ],
      },
    ],
    continuas: [{ armaAdicional: true }],
    fns: {
      objetivo: (e, ctx, u) => !N.enJuego(e, u) || coste(e, u) <= 3,
      puede: (e, ctx) =>
        armaEnManoOCementerio(e, ctx) && hayObjetivo(e, ctx, { de: ["todos:enJuego", "todos:cementerio"], filtro: { f: "objetivo", noFuente: true }, para: "tomar" }),
    },
  },
  "Padre de la Patria": {
    activadas: [{ texto: "Generar un Oro para jugar Armas o Aliados por el turno", momento: "tuTurno", veces: "turno", hacer: [{ op: "generar", n: 1, tipos: ["Arma", "Aliado"] }] }],
    disparadas: [
      {
        cuando: ["entra"],
        hacer: [
          {
            op: "opcional",
            texto: "Subir un Arma que controles a la mano de su dueño para jugar un Arma de igual o menor coste sin pagar su coste",
            requiere: { de: ["yo:armas"], filtro: {} },
            pasos: [
              sel(["yo:armas"], {}, "a"),
              { op: "fn", f: "recordar" },
              mov("mano", "a"),
              sel(["yo:mano"], { tipo: "Arma", f: "jugable" }, "b", { hasta: true }),
              { op: "jugarGratis", var: "b" },
            ],
          },
        ],
      },
    ],
    fns: {
      recordar: (e, ctx) => {
        ctx.vars.costeMax = (ctx.vars.a ?? []).map((u) => coste(e, u));
      },
      jugable: (e, ctx, u) => coste(e, u) <= (ctx.vars.costeMax?.[0] ?? -1) && N.aliadosDe(e, ctx.ctrl).some((x) => armaCabe(e, x, u)),
    },
  },
  "Paladin David": {
    claves: ["Indestructible"],
    activadas: [{ texto: "Buscar un Aliado, Arma u Oro en tu Castillo", veces: "turno", hacer: buscar(["yo:castillo"], { tipo: ["Aliado", "Arma", "Oro"] }) }],
    disparadas: [
      {
        cuando: ["faseFinal"],
        quien: "cualquiera",
        hacer: [
          sel(["todos:cementerio"], {}, "c", { n: 2, hasta: true }),
          mov("barajar", "c"),
          sel(["todos:cementerio"], {}, "d", { nf: "resto", hasta: true }),
          mov("desterrar", "d"),
        ],
      },
    ],
    continuas: [{ gana: "Imbloqueable", a: "tusAliados" }],
    fns: { resto: (e, ctx) => 2 - (ctx.vars.c ?? []).length },
  },
  "Paladin de la Esperanza": {
    disparadas: [
      {
        cuando: ["entra"],
        opcional: true,
        hacer: [
          sel(["yo:castillo"], { f: "paladinOArma" }, "b", { n: 2, hasta: true }),
          sel(["var:b"], {}, "c", { n: 2, hasta: true }),
          mov("cementerio", "c"),
          sel(["var:b"], { zona: "castillo" }, "m", { n: 2 }),
          mov("mano", "m"),
          barajar(),
          { op: "robar", nf: "armasAlCementerio", quien: "yo" },
        ],
      },
    ],
    fns: {
      paladinOArma: (e, ctx, u) => {
        const c = N.carta(e, u);
        return c.tipo === "Arma" || (c.tipo === "Aliado" && sinTildes(c.nombre).includes("paladin"));
      },
      armasAlCementerio: (e, ctx) => (ctx.vars.c ?? []).filter((u) => N.carta(e, u).tipo === "Arma").length,
    },
  },
  "Paladín Arthur Holmwood": {
    disparadas: [
      { cuando: ["entra"], hacer: [sel(["rival:mano"], {}, "n", { azar: true }), { op: "fn", f: "vetar" }] },
      {
        cuando: ["saleDelJuego"],
        quien: "yo",
        zona: ["cementerio"],
        veces: 2,
        si: "armaDestruida",
        opcional: true,
        hacer: [{ op: "fn", f: "cargar" }, mov("mano", "x")],
      },
    ],
    fns: {
      vetar: vetarNombres("rival"),
      armaDestruida: (e, ctx) => ctx.datos.tipo === "Arma" && N.dueno(ctx.datos.uid) === ctx.ctrl && N.ubicar(e, ctx.datos.uid)?.zona === "cementerio",
      cargar: (e, ctx) => {
        ctx.vars.x = [ctx.datos.uid];
      },
    },
  },
  "Paladín Harker": {
    claves: ["Furia", "Imbloqueable"],
    disparadas: [
      {
        cuando: ["entra", "ataca"],
        si: "controlaArmas",
        hacer: [
          sel(["rival:mano", "rival:castillo", "todos:enJuego", "todos:cementerio"], { noFuente: true }, "n", { nf: "nombres", hasta: true }),
          { op: "fn", f: "vetar" },
        ],
      },
    ],
    activadas: [
      {
        texto: "Generar un Oro para Armas y Desterrar hasta una carta de coste 3 o menos",
        veces: "turno",
        hacer: [{ op: "generar", n: 1, tipos: ["Arma"] }, sel(["todos:enJuego"], { costeMax: 3 }, "x", { hasta: true, para: "desterrar" }), mov("desterrar")],
      },
    ],
    fns: {
      controlaArmas,
      nombres: (e, ctx) => Math.min(3, N.armasDe(e, ctx.ctrl).length),
      vetar: vetarNombres("ambos"),
    },
  },
  "Pipin el Breve": {
    claves: ["Imbloqueable"],
    disparadas: [{ cuando: ["entra"], opcional: true, hacer: buscar(["yo:castillo"], { f: "objetivo" }) }],
    continuas: [{ fuerzaPor: "armasCementerio", a: "propia" }],
    fns: {
      objetivo: (e, ctx, u) => {
        const c = N.carta(e, u);
        if (c.nombre === "Pipin el Breve") return false;
        if (c.tipo === "Arma") return coste(e, u) <= 2;
        return c.tipo === "Aliado" && (esCaballero(e, u) || N.tiene(e, u, "Imbloqueable"));
      },
      armasCementerio: (e, ctx) => e.jugadores[ctx.ctrl].cementerio.filter((u) => N.carta(e, u).tipo === "Arma").length,
    },
  },
  Prendick: {
    disparadas: [{ cuando: ["entra"], si: "controlaArmas", hacer: [sel(["yo:aliados"], {}, "a", { n: 99 }), efecto("a", { tipo: "fuerza", n: 2 })] }],
    activadas: [
      {
        texto: "Tu oponente pone en su Cementerio tantas cartas del tope de su Castillo como Fuerza tenga un Aliado que porte Armas",
        momento: "tuTurno",
        veces: "turno",
        requiere: { de: ["todos:aliados"], filtro: { f: "portaArmas" } },
        hacer: [sel(["todos:aliados"], { f: "portaArmas" }, "a"), { op: "botar", nf: "fuerzaElegido", quien: "rival" }],
      },
    ],
    fns: {
      controlaArmas,
      portaArmas: (e, ctx, u) => (e.armas[u] ?? []).length > 0,
      fuerzaElegido: (e, ctx) => {
        const [a] = ctx.vars.a ?? [];
        return a ? N.fuerza(e, a) : 0;
      },
    },
  },
  Raguel: {
    disparadas: [{ cuando: ["entra"], opcional: true, hacer: buscar(["yo:castillo", "yo:cementerio"], { tipo: "Aliado" }) }],
  },
  "Ramón Freire": {
    disparadas: [{ cuando: ["entra"], hacer: [robar(2)] }],
    activadas: [
      {
        texto: "Desterrarlo de tu mano para generar un Oro para jugar Armas",
        zona: "mano",
        requiere: "puede",
        coste: [sel(["fuente"], {}, "yo"), mov("desterrar", "yo")],
        hacer: [{ op: "fn", f: "marcar" }, { op: "generar", n: 1, tipos: ["Arma"] }],
      },
      {
        texto: "Desterrarlo para generar un Oro para jugar Armas",
        requiere: "puede",
        coste: [sel(["fuente"], {}, "yo"), mov("desterrar", "yo")],
        hacer: [{ op: "fn", f: "marcar" }, { op: "generar", n: 1, tipos: ["Arma"] }],
      },
    ],
    fns: {
      puede: (e, ctx) => e.usos[`freire|${ctx.ctrl}`] !== e.turno && N.aliadosDe(e, ctx.ctrl).some((u) => coste(e, u) >= 2),
      marcar: (e, ctx) => {
        e.usos[`freire|${ctx.ctrl}`] = e.turno;
      },
    },
  },
  "Regan Liberator": {
    reduce: "red",
    disparadas: [{ cuando: ["entra"], hacer: [{ op: "fn", f: "recuperar" }] }],
    continuas: [{ gana: "Imbloqueable", a: "tusAliados" }, { aliadosNoCambian: true }],
    fns: {
      red: (e, ctx) => (deTipoEn(e, ctx.ctrl, ["mano", "cementerio"], ["Arma", "Tótem"]) ? 1 : 0),
      recuperar: (e, ctx) => {
        for (const u of N.enJuegoDe(e, N.rival(ctx.ctrl))) {
          if (N.dueno(u) !== ctx.ctrl || !N.puedeTomar(e, u, ctx.ctrl)) continue;
          const zona = N.ubicar(e, u).zona;
          if (zona === "arma") continue;
          N.mover(e, u, zona === "ataque" ? "defensa" : zona, { j: ctx.ctrl });
        }
      },
    },
  },
  Remiel: {
    claves: ["Furia", "Imbloqueable"],
    disparadas: [
      {
        cuando: ["ataca"],
        hacer: [
          sel(["rival:mano"], {}, "d", { quien: "rival" }),
          mov("cementerio", "d"),
          { op: "si", f: "descarto", entonces: buscar(["yo:castillo", "yo:cementerio"], { tipo: ["Aliado", "Arma"] }) },
        ],
      },
    ],
    fns: {
      descarto: (e, ctx) => {
        if (!(ctx.vars.d ?? []).length || e.usos[`remiel|${ctx.fuente}`] === e.turno) return false;
        e.usos[`remiel|${ctx.fuente}`] = e.turno;
        return true;
      },
    },
  },
  "Roderick Usher": {
    claves: ["Imbloqueable"],
    disparadas: [
      {
        cuando: ["entra"],
        hacer: [
          {
            op: "modo",
            hasta: true,
            opciones: [
              { texto: "Cambiar de portador un Arma que controles", requiere: { de: ["yo:armas"], filtro: { f: "movible" } }, pasos: cambiarPortador.pasos },
              {
                texto: "Subir un Aliado o Arma de tu Cementerio a tu mano",
                requiere: { de: ["yo:cementerio"], filtro: { tipo: ["Aliado", "Arma"] } },
                pasos: [sel(["yo:cementerio"], { tipo: ["Aliado", "Arma"] }, "c"), mov("mano", "c")],
              },
            ],
          },
        ],
      },
    ],
    fns: cambiarPortador.fns,
  },
  "San Martin Libertadores": {
    claves: ["Imbloqueable"],
    disparadas: [{ cuando: ["entra"], hacer: [{ op: "mostrarHasta", tipos: ["Arma", "Arma"], como: "m" }, mov("mano", "m")] }],
  },
  "Sancho Panza": {
    claves: ["Furia"],
    disparadas: [
      {
        cuando: ["entra"],
        hacer: [
          {
            op: "opcional",
            texto: "Jugar un Aliado o Arma de coste 1 de tu mano o Cementerio sin pagar su coste",
            requiere: { de: ["yo:mano", "yo:cementerio"], filtro: { tipo: ["Aliado", "Arma"], costeMin: 1, costeMax: 1, f: "jugable" } },
            pasos: [sel(["yo:mano", "yo:cementerio"], { tipo: ["Aliado", "Arma"], costeMin: 1, costeMax: 1, f: "jugable" }, "b"), { op: "jugarGratis", var: "b" }],
          },
        ],
      },
      { cuando: ["sale"], hacer: [robar(2)] },
    ],
    fns: {
      jugable: (e, ctx, u) => N.carta(e, u).tipo !== "Arma" || N.aliadosDe(e, ctx.ctrl).some((x) => armaCabe(e, x, u)),
    },
  },
  "Sherlock Holmes": {
    disparadas: [
      {
        cuando: ["entra", "ataca"],
        hacer: [
          sel(["todos:enJuego"], { noTipo: ["Oro"], noFuente: true }, "x", { n: 2, hasta: true, para: "tomar" }),
          { op: "convertir", var: "x", en: "Aliado", fuerza: 3, a: "defensa" },
          { op: "fn", f: "topes" },
          robar(2),
          sel(["yo:aliados"], {}, "a", { n: 99 }),
          efecto("a", { tipo: "noSale" }, "proximoTurno"),
        ],
      },
    ],
    fns: {
      topes: (e, ctx) => {
        const resto = 2 - (ctx.vars.x ?? []).length;
        if (resto <= 0) return [];
        const tope = (quien) => [{ op: "tope", quien, n: 1, como: "t" }, { op: "convertir", var: "t", en: "Aliado", fuerza: 3, a: "defensa" }];
        return [
          {
            op: "modo",
            n: resto,
            hasta: true,
            opciones: [
              { texto: "Convertir la primera carta de tu Castillo", pasos: tope("yo") },
              { texto: "Convertir la primera carta del Castillo oponente", pasos: tope("rival") },
            ],
          },
        ];
      },
    },
  },
  Striker: {
    claves: ["Imbloqueable"],
    disparadas: [
      {
        cuando: ["entra"],
        hacer: [
          {
            op: "si",
            f: "controlaArmas",
            entonces: [
              {
                op: "modo",
                opciones: [
                  {
                    texto: "Destruir una carta que no sea Oro",
                    requiere: { de: ["todos:enJuego"], filtro: { noTipo: ["Oro"] }, para: "destruir" },
                    pasos: [sel(["todos:enJuego"], { noTipo: ["Oro"] }, "x", { para: "destruir" }), mov("destruir")],
                  },
                  { texto: "Robar dos cartas", pasos: [robar(2)] },
                ],
              },
            ],
            sino: [sel(["todos:aliados"], { costeMax: 2 }, "x", { para: "destruir" }), mov("destruir")],
          },
        ],
      },
    ],
    fns: { controlaArmas },
  },
  "Taka No Me": {
    activadas: [
      {
        texto: "Mostrar cartas del tope de tu Castillo hasta un Arma y un Tótem, ponerlos en tu mano y Barajar el resto",
        momento: "tuTurno",
        veces: "turno",
        hacer: [{ op: "mostrarHasta", tipos: ["Arma", "Tótem"], como: "m" }, mov("mano", "m"), barajar()],
      },
      {
        texto: "Mirar tres cartas de la mano oponente y elegir una que no pueda ser jugada hasta tu próximo turno",
        momento: "tuTurno",
        veces: "turno",
        requiere: { de: ["rival:mano"], filtro: {} },
        hacer: [sel(["rival:mano"], {}, "m", { n: 3, azar: true }), sel(["var:m"], {}, "n"), { op: "fn", f: "vetar" }],
      },
    ],
    fns: { vetar: vetarNombres("rival") },
  },
};
