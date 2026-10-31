import * as N from "../nucleo.js";
import { sel, mov, barajar, robar, efecto, buscar, coste } from "../formato.js";

const botar = (n, quien = "rival") => ({ op: "botar", n, quien });

const esSello = (e, u) => N.carta(e, u).nombre.includes("Sello");

const razasDe = (e, u) => N.carta(e, u).razas ?? [];

const tieneRaza = (raza) => (e, ctx) => N.aliadosDe(e, ctx.ctrl).some((a) => razasDe(e, a).includes(raza));

const orosPara = (e, j, tipo) =>
  e.jugadores[j].reserva.length + (e.jugadores[j].generados ?? []).filter((g) => !g.tipos || g.tipos.includes(tipo)).reduce((s, g) => s + g.n, 0);

const marcas = (nombre) => ({
  marcar: (e, ctx) => {
    e.usos[`${nombre}|${ctx.fuente}`] = e.turno;
  },
  resuelta: (e, ctx) => e.usos[`${nombre}|${ctx.fuente}`] === e.turno,
  desmarcar: (e, ctx) => {
    delete e.usos[`${nombre}|${ctx.fuente}`];
  },
});

const desterrarseAlResolver = {
  zona: ["cementerio"],
  cuando: ["alCementerio"],
  quien: "propia",
  si: "resuelta",
  hacer: [{ op: "fn", f: "desmarcar" }, sel(["fuente"], {}, "yo"), mov("desterrar", "yo")],
};

const alSerAnulado = (hacer) => ({ zona: ["cementerio"], cuando: ["anulada"], quien: "propia", hacer });

const pierdeYDestierra = (de, filtro = {}) => [sel(de, filtro, "x", { para: "desterrar" }), efecto("x", { tipo: "pierdeHabilidad" }, "mientras"), mov("desterrar")];

const cementerioElegido = (pasosPara) => ({
  op: "modo",
  opciones: [
    { texto: "tu Cementerio", pasos: pasosPara("yo") },
    { texto: "Cementerio oponente", pasos: pasosPara("rival") },
  ],
});

const barajarODesterrar = (v) => ({
  op: "modo",
  opciones: [
    { texto: "Barajar", pasos: [mov("barajar", v)] },
    { texto: "Desterrar", pasos: [mov("desterrar", v)] },
  ],
});

const TIPOS = ["Aliado", "Talismán", "Arma", "Tótem", "Oro"];

function primerosAliados(e, j) {
  const hallados = [];
  for (const u of e.jugadores[j].castillo) {
    const c = N.carta(e, u);
    if (c.tipo === "Aliado" && (c.coste ?? 0) <= 2) hallados.push(u);
    if (hallados.length >= 2) break;
  }
  return hallados;
}

export const HABILIDADES = {
  "Paso del Camahueto": {
    claves: ["Exhumar"],
    talisman: [
      {
        op: "modo",
        opciones: [
          {
            texto: "Convertir un Aliado de coste 2 o menos en un Aliado sin habilidad y ganar su control",
            requiere: { de: ["todos:aliados"], filtro: { costeMax: 2 }, para: "tomar" },
            pasos: [sel(["todos:aliados"], { costeMax: 2 }, "x", { para: "tomar" }), { op: "convertir", var: "x", en: "Aliado", a: "defensa" }],
          },
          {
            texto: "Una carta de coste 2 o menos pierde su habilidad y es Desterrada",
            requiere: { de: ["todos:enJuego"], filtro: { costeMax: 2 }, para: "desterrar" },
            pasos: pierdeYDestierra(["todos:enJuego"], { costeMax: 2 }),
          },
        ],
      },
    ],
  },
  "Pecado Original": {
    talisman: [
      sel(["todos:enJuego"], { noTipo: ["Oro"] }, "x", { n: 2, hasta: true }),
      mov("barajar"),
      sel(["yo:castillo"], {}, "b", { n: 2 }),
      mov("mano", "b"),
      barajar(),
    ],
    disparadas: [{ zona: ["cementerio"], cuando: ["entra"], quien: "rival", veces: 3, si: "esAliado", hacer: [{ op: "desterrarTope", n: 1, quien: "rival" }] }],
    fns: { esAliado: (e, ctx) => N.carta(e, ctx.datos.uid).tipo === "Aliado" },
  },
  "Perder la Razon": {
    claves: ["Exhumar"],
    disparadas: [alSerAnulado([{ op: "generar", n: 2, tipos: ["Aliado"] }])],
    talisman: [
      { op: "tope", n: 6, como: "m" },
      {
        op: "modo",
        hasta: true,
        opciones: [
          {
            texto: "Jugar una carta de coste 3 o menos sin pagar su coste",
            requiere: { de: ["var:m"], filtro: { zona: "castillo", costeMax: 3, noTipo: ["Oro", "Talismán"] } },
            pasos: [sel(["var:m"], { zona: "castillo", costeMax: 3, noTipo: ["Oro", "Talismán"] }, "j", { hasta: true }), { op: "jugarGratis", var: "j" }],
          },
          {
            texto: "Poner un Oro en tu Oro Pagado",
            requiere: { de: ["var:m"], filtro: { zona: "castillo", tipo: "Oro" } },
            pasos: [sel(["var:m"], { zona: "castillo", tipo: "Oro" }, "o", { hasta: true }), { op: "ponerOro", var: "o", a: "pagado" }],
          },
        ],
      },
    ],
  },
  Pereza: {
    destierroAlJugar: true,
    talisman: [
      { op: "efecto", efecto: { tipo: "noAtacar" }, fin: "dosTurnos" },
      { op: "efecto", efecto: { tipo: "maxNoOro", n: 1 }, jugador: "yo", fin: "dosTurnos" },
    ],
  },
  "Pie de Cueca": {
    talisman: [
      { op: "tope", quien: "rival", n: 8, como: "r" },
      sel(["var:r"], {}, "rd", { azar: true }),
      mov("desterrar", "rd"),
      { op: "tope", n: 8, como: "m" },
      sel(["var:m"], {}, "mm", { azar: true }),
      mov("mano", "mm"),
      { op: "opcional", texto: "Buscar un Pie de Cueca en tu Castillo", requiere: "fonda", pasos: buscar(["yo:castillo"], { f: "pieDeCueca" }) },
    ],
    fns: {
      fonda: (e, ctx) => N.enJuegoDe(e, ctx.ctrl).some((u) => N.carta(e, u).nombre === "Fonda"),
      pieDeCueca: (e, ctx, u) => N.carta(e, u).nombre === "Pie de Cueca",
    },
  },
  "Pocion del Mal": {
    momentos: ["comienzoFase"],
    destierroAlJugar: true,
    talisman: [sel(["todos:enJuego"], { costeMax: 2 }), mov("barajar"), { op: "fn", f: "activar" }],
    disparadas: [
      {
        zona: ["destierro"],
        cuando: ["juega"],
        quien: "rival",
        si: "activa",
        hacer: [cementerioElegido((quien) => [sel([`${quien}:cementerio`], {}, "c", { hasta: true }), barajarODesterrar("c")]), robar(1)],
      },
    ],
    fns: {
      activar: (e, ctx) => N.agregarEfecto(e, { tipo: "pocionDelMal", uid: ctx.fuente, fin: "turno" }, ctx.ctrl),
      activa: (e, ctx) => e.efectos.some((f) => f.tipo === "pocionDelMal" && f.uid === ctx.fuente),
    },
  },
  "Pozo Impuro": {
    claves: ["Exhumar"],
    unoPorTurno: true,
    talisman: [
      {
        op: "modo",
        opciones: [
          {
            texto: "Barajar una carta de coste 1 o menos",
            requiere: { de: ["todos:enJuego"], filtro: { costeMax: 1 } },
            pasos: [sel(["todos:enJuego"], { costeMax: 1 }), mov("barajar")],
          },
          {
            texto: "Desterrar una carta de tu mano para Barajar una carta de coste 2",
            requiere: "manoYCoste2",
            pasos: [sel(["yo:mano"], {}, "d"), mov("desterrar", "d"), sel(["todos:enJuego"], { costeMin: 2, costeMax: 2 }), mov("barajar")],
          },
        ],
      },
    ],
    fns: {
      manoYCoste2: (e, ctx) => e.jugadores[ctx.ctrl].mano.length > 0 && N.todoEnJuego(e).some((u) => coste(e, u) === 2),
    },
  },
  "Primer Sello": {
    talisman: [...buscar(["yo:castillo"], { f: "sello" }), { op: "botar", nf: "porSellos", quien: "rival" }],
    disparadas: [{ zona: ["cementerio"], cuando: ["juega"], quien: "yo", veces: 1, si: "jugoSello", hacer: [botar(1)] }],
    fns: {
      sello: (e, ctx, u) => esSello(e, u),
      porSellos: (e, ctx) => 1 + e.jugadores[ctx.ctrl].cementerio.filter((u) => esSello(e, u)).length,
      jugoSello: (e, ctx) => esSello(e, ctx.datos.uid),
    },
  },
  "Prisionero de Drácula": {
    talisman: [sel(["todos:aliados"], { costeMax: 3 }, "x", { para: "tomar" }), { op: "convertir", var: "x", en: "Tótem", a: "apoyo" }, robar(2)],
  },
  "Protocolo Totemico": {
    respuesta: { anula: { tipo: ["Tótem", "Arma"], costeMax: 2 } },
    talisman: [
      {
        op: "modo",
        opciones: [
          {
            texto: "Destruir una carta de coste 2 o menos",
            requiere: { de: ["todos:enJuego"], filtro: { costeMax: 2 }, para: "destruir" },
            pasos: [sel(["todos:enJuego"], { costeMax: 2 }, "x", { para: "destruir" }), mov("destruir")],
          },
          {
            texto: "Barajar una carta de coste 2 o menos",
            requiere: { de: ["todos:enJuego"], filtro: { costeMax: 2 } },
            pasos: [sel(["todos:enJuego"], { costeMax: 2 }), mov("barajar")],
          },
        ],
      },
    ],
    activadas: [
      {
        texto: "Mostrar cuatro cartas de un mismo tipo o coste de tu mano: subir este Talismán del Cementerio a tu mano",
        zona: "cementerio",
        requiere: "cuatroIguales",
        hacer: [sel(["fuente"], {}, "yo"), mov("mano", "yo")],
      },
    ],
    fns: {
      cuatroIguales: (e, ctx) => {
        const mano = e.jugadores[ctx.ctrl].mano.map((u) => N.carta(e, u));
        const maximo = (clave) => {
          const cuenta = {};
          for (const c of mano) cuenta[c[clave] ?? 0] = (cuenta[c[clave] ?? 0] ?? 0) + 1;
          return Math.max(0, ...Object.values(cuenta));
        };
        return maximo("tipo") >= 4 || maximo("coste") >= 4;
      },
    },
  },
  "Psicofonía": {
    talisman: [
      {
        op: "modo",
        opciones: [
          {
            texto: "Una carta de coste 2 o menos pierde su habilidad, es Desterrada y Robas una carta",
            requiere: { de: ["todos:enJuego"], filtro: { costeMax: 2 }, para: "desterrar" },
            pasos: [...pierdeYDestierra(["todos:enJuego"], { costeMax: 2 }), robar(1)],
          },
          {
            texto: "Pagar un Oro: un Aliado pierde su habilidad, es Desterrado y Robas dos cartas",
            requiere: "puedePagar",
            pasos: [{ op: "pagar", n: 1 }, ...pierdeYDestierra(["todos:aliados"]), robar(2)],
          },
        ],
      },
    ],
    fns: {
      puedePagar: (e, ctx) => e.jugadores[ctx.ctrl].reserva.length >= 1 && N.todoEnJuego(e).some((u) => N.carta(e, u).tipo === "Aliado"),
    },
  },
  "Puertas Grandes y Pequeas": {
    destierroAlJugar: true,
    talisman: [{ op: "efecto", efecto: { tipo: "prevenirDano", unaVez: true }, jugador: "yo", fin: "turno" }, { op: "botar", nf: "atacantes", quien: "rival" }],
    fns: { atacantes: (e, ctx) => 2 * e.jugadores[N.rival(ctx.ctrl)].ataque.length },
  },
  "Pulso Kaiju": {
    momentos: ["comienzoFase"],
    talisman: [
      sel(["yo:castillo"], { tipo: "Aliado" }, "a"),
      sel(["yo:castillo"], { tipo: "Aliado", f: "distinto" }, "c", { n: 2 }),
      mov("mano", "a"),
      mov("cementerio", "c"),
      barajar(),
      robar(1),
    ],
    fns: {
      distinto: (e, ctx, u) => ![...(ctx.vars.a ?? []), ...(ctx.vars.c ?? [])].some((x) => N.carta(e, x).nombre === N.carta(e, u).nombre),
    },
  },
  "Purificar Alma": {
    talisman: [
      {
        op: "modo",
        opciones: TIPOS.map((tipo) => ({ texto: tipo, pasos: [{ op: "fn", f: "delTipo", tipo }, barajarODesterrar("c")] })),
      },
    ],
    fns: {
      delTipo: (e, ctx, api, p) => {
        ctx.vars.c = [0, 1].flatMap((j) => e.jugadores[j].cementerio).filter((u) => N.carta(e, u).tipo === p.tipo);
      },
    },
  },
  "Pánico Vampiro": {
    talisman: [{ op: "fn", f: "panico" }],
    disparadas: [desterrarseAlResolver],
    fns: {
      ...marcas("panico"),
      panico: (e, ctx) => {
        N.barajarCastillo(e, ctx.ctrl);
        const u = e.jugadores[ctx.ctrl].castillo[0];
        if (!u) return [];
        const tipo = N.carta(e, u).tipo;
        if (tipo === "Aliado") return [{ op: "fn", f: "guardar", uid: u }, mov("mano", "t")];
        if (tipo === "Oro" || tipo === "Talismán") return [sel(["todos:cementerio"], {}, "c", { n: 2, hasta: true }), mov("barajar", "c"), { op: "fn", f: "marcar" }];
        return [sel(["todos:enJuego"], { costeMin: 1, costeMax: 1 }, "x", { para: "destruir" }), mov("destruir")];
      },
      guardar: (e, ctx, api, p) => {
        ctx.vars.t = [p.uid];
      },
    },
  },
  "Quemar el Corazón": {
    disparadas: [alSerAnulado([{ op: "fn", f: "agrupar" }]), desterrarseAlResolver],
    talisman: [
      {
        op: "modo",
        n: 2,
        hasta: true,
        opciones: [
          {
            texto: "Buscar una carta en un Castillo y Desterrarla",
            pasos: [
              {
                op: "modo",
                opciones: [
                  { texto: "tu Castillo", pasos: [sel(["yo:castillo"], {}, "b"), mov("desterrar", "b"), barajar()] },
                  { texto: "Castillo oponente", pasos: [sel(["rival:castillo"], {}, "b"), mov("desterrar", "b"), barajar("rival")] },
                ],
              },
            ],
          },
          { texto: "Tu oponente Destierra dos cartas de su mano", pasos: [sel(["rival:mano"], {}, "d", { n: 2, quien: "rival" }), mov("desterrar", "d")] },
          {
            texto: "Un Aliado pierde su habilidad y es Desterrado",
            requiere: { de: ["todos:aliados"], filtro: {}, para: "desterrar" },
            pasos: pierdeYDestierra(["todos:aliados"]),
          },
          { texto: "No recibes daño hasta tu próximo turno", pasos: [{ op: "efecto", efecto: { tipo: "prevenirDano" }, jugador: "yo", fin: "proximoTurno" }] },
        ],
      },
      { op: "fn", f: "marcar" },
    ],
    fns: {
      ...marcas("quemar"),
      agrupar: (e, ctx) => {
        const [u] = e.jugadores[ctx.ctrl].pagado;
        if (u) N.mover(e, u, "reserva", { j: ctx.ctrl });
      },
    },
  },
  "Quinto Sello": {
    talisman: [
      ...buscar(["yo:castillo"], { f: "sello" }),
      sel(["todos:cementerio"], {}, "c", { n: 5, hasta: true }),
      mov("barajar", "c"),
      {
        op: "modo",
        hasta: true,
        opciones: [
          {
            texto: "Jugar un Aliado de tu Cementerio reduciendo su coste en un Oro",
            requiere: { de: ["yo:cementerio"], filtro: { tipo: "Aliado", f: "aliadoPagable" } },
            pasos: [sel(["yo:cementerio"], { tipo: "Aliado", f: "aliadoPagable" }, "a"), { op: "fn", f: "jugarAliado" }],
          },
          {
            texto: "Jugar un Sello de tu Cementerio pagando su coste",
            requiere: { de: ["yo:cementerio"], filtro: { tipo: "Talismán", f: "selloPagable" } },
            pasos: [sel(["yo:cementerio"], { tipo: "Talismán", f: "selloPagable" }, "s"), { op: "fn", f: "jugarSello" }],
          },
        ],
      },
    ],
    fns: {
      sello: (e, ctx, u) => esSello(e, u),
      aliadoPagable: (e, ctx, u) => Math.max(0, coste(e, u) - 1) <= orosPara(e, ctx.ctrl, "Aliado"),
      selloPagable: (e, ctx, u) => esSello(e, u) && coste(e, u) <= orosPara(e, ctx.ctrl, "Talismán"),
      jugarAliado: (e, ctx, api) => {
        const [u] = ctx.vars.a ?? [];
        if (!u) return;
        api.pagarOros(e, ctx.ctrl, Math.max(0, coste(e, u) - 1), "Aliado");
        N.disparar(e, "juega", { uid: u, j: ctx.ctrl, tipo: "Aliado", pagado: true, desde: "cementerio" });
        api.entrarEnJuego(e, u, ctx.ctrl, undefined, { pagado: true, desde: "cementerio" });
      },
      jugarSello: (e, ctx, api) => {
        const [u] = ctx.vars.s ?? [];
        if (!u) return;
        const c = N.carta(e, u);
        api.pagarOros(e, ctx.ctrl, coste(e, u), "Talismán");
        N.sacar(e, u);
        e.cola.unshift(N.nuevoFrame([...(c.talisman ?? []), { op: "finTalisman", uid: u }], { ctrl: ctx.ctrl, fuente: u, def: c.id, costeFuente: c.coste ?? 0 }));
        N.disparar(e, "juega", { uid: u, j: ctx.ctrl, tipo: "Talismán", pagado: true, desde: "cementerio" });
      },
    },
  },
  "R L Stevenson": {
    momentos: ["comienzoFase"],
    destierroAlJugar: true,
    talisman: [
      sel(["todos:enJuego"], { costeMax: 2 }, "x", { para: "tomar" }),
      { op: "convertir", var: "x", en: "Tótem", a: "apoyo" },
      { op: "mostrarHasta", n: 1, filtro: { tipo: "Aliado" }, como: "m" },
      mov("mano", "m"),
      barajar(),
    ],
  },
  "Rafaga de Energia": {
    talisman: [
      {
        op: "modo",
        n: 3,
        hasta: true,
        opciones: [
          {
            texto: "Caballero: Barajar un Aliado en juego",
            requiere: "caballero",
            pasos: [sel(["todos:aliados"]), mov("barajar")],
          },
          {
            texto: "Guerrero: tu oponente Bota cartas igual a la Fuerza de un Aliado en juego",
            requiere: "guerrero",
            pasos: [sel(["todos:aliados"], {}, "g"), { op: "botar", nf: "fuerzaElegida", quien: "rival" }],
          },
          {
            texto: "Héroe: afectar a tus Aliados cuesta un Oro adicional hasta tu próximo turno",
            requiere: "heroe",
            pasos: [{ op: "fn", f: "proteger" }],
          },
        ],
      },
    ],
    fns: {
      caballero: (e, ctx) => tieneRaza("Caballero")(e, ctx) && N.todoEnJuego(e).some((u) => N.carta(e, u).tipo === "Aliado"),
      guerrero: tieneRaza("Guerrero"),
      heroe: tieneRaza("Héroe"),
      proteger: (e, ctx) => N.agregarEfecto(e, { tipo: "proteccion", de: ctx.ctrl, cuesta: 1, tipoObjetivo: "Aliado", fin: "proximoTurno" }, ctx.ctrl),
      fuerzaElegida: (e, ctx) => (ctx.vars.g ?? []).reduce((s, u) => s + N.fuerza(e, u), 0),
    },
  },
  Ragnarok: {
    talisman: [{ op: "si", f: "mismaRaza", entonces: [sel(["todos:aliados"], {}, "x", { n: 99 }), mov("barajar")] }, { op: "fn", f: "revelar" }],
    fns: {
      mismaRaza: (e, ctx) => {
        const aliados = N.aliadosDe(e, ctx.ctrl);
        if (!aliados.length) return true;
        return razasDe(e, aliados[0]).some((r) => aliados.every((a) => razasDe(e, a).includes(r)));
      },
      revelar: (e, ctx, api) => {
        for (const j of [ctx.ctrl, N.rival(ctx.ctrl)]) {
          const hallados = primerosAliados(e, j);
          if (hallados.length === 2) {
            const i = Math.floor(N.azar(e) * 2);
            N.mover(e, hallados[i], "mano");
            const otro = hallados[1 - i];
            N.disparar(e, "juega", { uid: otro, j, tipo: "Aliado", pagado: false, desde: "castillo" });
            api.entrarEnJuego(e, otro, j, undefined, { pagado: false, desde: "castillo" });
          } else if (hallados.length === 1) {
            N.mover(e, hallados[0], "mano");
          }
          N.barajarCastillo(e, j);
        }
      },
    },
  },
  "Rayo Gaia": {
    soloRespuesta: true,
    talisman: [sel(["yo:aliados"], { costeMax: 2 }, "x", { para: "desterrar" }), mov("desterrar")],
  },
  "Rayo Penetrante": {
    momentos: ["faseFinal"],
    talisman: [
      {
        op: "modo",
        opciones: [
          {
            texto: "Desterrar una carta de coste 2 o menos y Barajar o Desterrar hasta tres cartas de un Cementerio",
            pasos: [
              sel(["todos:enJuego"], { costeMax: 2 }, "x", { para: "desterrar" }),
              mov("desterrar"),
              cementerioElegido((quien) => [sel([`${quien}:cementerio`], {}, "c", { n: 3, hasta: true }), barajarODesterrar("c")]),
            ],
          },
          {
            texto: "Desterrar una carta oponente de coste 3 o más y tu oponente Roba una carta",
            requiere: { de: ["rival:enJuego"], filtro: { costeMin: 3 }, para: "desterrar" },
            pasos: [sel(["rival:enJuego"], { costeMin: 3 }, "x", { para: "desterrar" }), mov("desterrar"), robar(1, "rival")],
          },
        ],
      },
    ],
  },
  "Red de Plata": {
    destierroAlJugar: true,
    respuesta: { anula: { tipo: "Aliado" }, pasos: [{ op: "fn", f: "desterrarAnulado" }] },
    talisman: [sel(["todos:aliados"], {}, "x"), efecto("x", { tipo: "pierdeHabilidad" }), { op: "si", f: "barato", entonces: [mov("desterrar")] }],
    activadas: [
      {
        texto: "Desterrarlo de tu Cementerio: un Aliado pierde su habilidad por el turno",
        zona: "cementerio",
        requiere: { de: ["todos:aliados"], filtro: {} },
        coste: [sel(["fuente"], {}, "yo"), mov("desterrar", "yo")],
        hacer: [sel(["todos:aliados"], {}, "a"), efecto("a", { tipo: "pierdeHabilidad" })],
      },
    ],
    fns: {
      barato: (e, ctx) => (ctx.vars.x ?? []).some((u) => coste(e, u) <= 2),
      desterrarAnulado: (e, ctx) => {
        const item = e.pila[ctx.objetivoPila];
        if (item && (ctx.vars.costeAnulado ?? 0) <= 2) item.destierro = true;
      },
    },
  },
  "Reflejo Maldito": {
    destierroAlJugar: true,
    claves: ["NoAnulable"],
    talisman: [sel(["todos:enJuego"], { f: "cabe" }, "x", { n: 99, hasta: true }), mov("barajar"), robar(1)],
    fns: {
      cabe: (e, ctx, u) => (ctx.vars.x ?? []).reduce((s, x) => s + coste(e, x), 0) + coste(e, u) <= 4,
    },
  },
  "Regresa la Razon": {
    disparadas: [alSerAnulado([{ op: "generar", n: 1, tipos: ["Arma"] }])],
    talisman: [
      sel(["todos:aliados"], {}, "a"),
      {
        op: "modo",
        opciones: [
          { texto: "Poner tus cartas en tu mano", pasos: [{ op: "tope", nf: "impresa", como: "m" }, mov("mano", "m")] },
          { texto: "Poner las cartas oponentes en su Cementerio", pasos: [{ op: "tope", quien: "rival", nf: "impresa", como: "m" }, mov("cementerio", "m")] },
        ],
      },
    ],
    fns: {
      impresa: (e, ctx) => (ctx.vars.a ?? []).reduce((s, u) => s + (N.def(e, e.instancias[u]).fuerza ?? 0), 0),
    },
  },
};
