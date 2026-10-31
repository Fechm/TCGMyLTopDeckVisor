import * as N from "../nucleo.js";
import { sel, mov, barajar, robar, efecto, buscar, coste } from "../formato.js";
import { disponibles } from "../efectos.js";

const CONSIDERADOS_BANDIDO = ["Canaan", "Cush"];

const esBandido = (e, u) => {
  const nombre = N.carta(e, u).nombre;
  return nombre.includes("Bandido") || CONSIDERADOS_BANDIDO.includes(nombre);
};

const bandidosDe = (e, j) => N.aliadosDe(e, j).filter((u) => esBandido(e, u)).length;

const precio = (e, u, rebaja, minimo) => Math.max(Math.min(coste(e, u), minimo), coste(e, u) - rebaja);

const contar = (e, j, c) => {
  const p = e.jugadores[j];
  p.jugadas[c.tipo] = (p.jugadas[c.tipo] ?? 0) + 1;
  p.jugadas.nombres[c.nombre] = (p.jugadas.nombres[c.nombre] ?? 0) + 1;
  if (["Aliado", "Arma", "Tótem"].includes(c.tipo)) p.jugadas.total += 1;
};

const jugarPagando = (e, ctx, api, uid, n, portadores = ["yo:aliados"]) => {
  const j = ctx.ctrl;
  const c = N.carta(e, uid);
  if (n > disponibles(e, j, c.tipo)) return [];
  const desde = N.ubicar(e, uid)?.zona ?? null;
  api.pagarOros(e, j, n, c.tipo);
  contar(e, j, c);
  N.disparar(e, "juega", { uid, j, tipo: c.tipo, pagado: true, desde });
  const datos = { pagado: true, desde };
  if (c.tipo === "Arma") return [{ op: "sel", de: portadores, filtro: { armaLibre: uid }, como: "_port" }, { op: "portar", arma: uid, en: "_port", datos }];
  return [{ op: "entrar", uid, datos }];
};

const barajarseYBuscarDos = (filtro) => [
  sel(["fuente"], {}, "yo"),
  mov("barajar", "yo"),
  sel(["yo:castillo"], filtro, "a"),
  { op: "fn", f: "segundoAliado" },
  { op: "jugarGratis", var: "a" },
  mov("mano", "b"),
  barajar(),
];

const segundoAliado = (filtro) => (e, ctx) => {
  const [a] = ctx.vars.a ?? [];
  if (!a) return [];
  return [sel(["yo:castillo"], { ...filtro, excluir: [a] }, "b")];
};

const agrupar = (e, uids) => {
  for (const u of uids) {
    const j = N.controlador(e, u);
    if (!e.jugadores[j].ataque.includes(u)) continue;
    N.sacar(e, u);
    e.jugadores[j].defensa.push(u);
  }
};

const FILTRO_BELETH = { tipo: "Aliado", costeMin: 1, costeMax: 1, f: "noBeleth" };
const FILTRO_CAIN = { tipo: "Aliado", costeMax: 2 };

export const HABILIDADES = {
  "Tangata Manu": {
    claves: ["Furia", "Indestructible"],
    disparadas: [
      {
        cuando: ["entra"],
        si: "libre",
        hacer: [{ op: "fn", f: "marcar" }, { op: "tope", n: 6, como: "m" }, sel(["var:m"], { costeMax: 2, noTipo: ["Talismán"] }, "j"), { op: "jugarGratis", var: "j" }],
      },
    ],
    fns: {
      libre: (e, ctx) => e.usos[`tangata|${ctx.ctrl}`] !== e.turno,
      marcar: (e, ctx) => {
        e.usos[`tangata|${ctx.ctrl}`] = e.turno;
      },
    },
  },
  Watson: {
    claves: ["Imbloqueable"],
    reduce: "red",
    activadas: [
      {
        texto: "Desterrar del tope del Castillo oponente tantas cartas como Fuerza tenga un Aliado que porte Arma",
        momento: "tuTurno",
        veces: "turno",
        requiere: "hayArmado",
        hacer: [sel(["todos:aliados"], { f: "armado" }, "a"), { op: "desterrarTope", quien: "rival", nf: "fuerzaArmado" }],
      },
    ],
    fns: {
      red: (e, ctx) => (N.armasDe(e, ctx.ctrl).length > 0 ? 1 : 0),
      armado: (e, ctx, u) => (e.armas[u] ?? []).length > 0,
      hayArmado: (e) => [...N.aliadosDe(e, 0), ...N.aliadosDe(e, 1)].some((u) => (e.armas[u] ?? []).length > 0),
      fuerzaArmado: (e, ctx) => {
        const [a] = ctx.vars.a ?? [];
        return a ? N.fuerza(e, a) : 0;
      },
    },
  },
  Yaju: {
    reduce: "red",
    disparadas: [{ cuando: ["entra", "ataca"], hacer: [sel(["todos:enJuego"], { costeMax: 2 }, "a", { hasta: true }), { op: "fn", f: "segundo" }] }],
    continuas: [
      { gana: "Furia", a: "propia", si: "portaArma" },
      { gana: "DanoAlDestierro", a: "propia", si: "portaArma" },
    ],
    fns: {
      red: (e, ctx) =>
        [...e.jugadores[ctx.ctrl].mano, ...e.jugadores[ctx.ctrl].cementerio].some((u) => u !== ctx.fuente && ["Arma", "Tótem"].includes(N.carta(e, u).tipo)) ? 1 : 0,
      segundo: (e, ctx) => {
        const [a] = ctx.vars.a ?? [];
        if (!a) return [];
        return [sel(["todos:enJuego"], { costeMax: 2 - coste(e, a), excluir: [a] }, "a2", { hasta: true }), mov("barajar", "a"), mov("barajar", "a2")];
      },
      portaArma: (e, ctx) => (e.armas[ctx.fuente] ?? []).length > 0,
    },
  },
  Zadquiel: {
    claves: ["Furia", "Imbloqueable"],
    disparadas: [{ cuando: ["ataca"], hacer: [sel(["rival:mano"], { noTipo: ["Oro"] }, "n"), { op: "fn", f: "vetar" }] }],
    activadas: [
      {
        texto: "Jugar un Arma sobre este Aliado o uno oponente reduciendo su coste en un Oro, hasta un mínimo de 1",
        momento: "vigilia",
        veces: "turno",
        requiere: "puedeArmar",
        hacer: [sel(["yo:mano"], { tipo: "Arma", f: "asequible" }, "w"), { op: "fn", f: "armar" }],
      },
    ],
    fns: {
      vetar: (e, ctx) => {
        for (const u of ctx.vars.n ?? []) N.agregarEfecto(e, { tipo: "noJugarNombre", j: N.rival(ctx.ctrl), nombre: N.carta(e, u).nombre, fin: "proximoTurno" }, ctx.ctrl);
      },
      asequible: (e, ctx, u) => precio(e, u, 1, 1) <= disponibles(e, ctx.ctrl, "Arma"),
      puedeArmar: (e, ctx) => e.jugadores[ctx.ctrl].mano.some((u) => N.carta(e, u).tipo === "Arma" && precio(e, u, 1, 1) <= disponibles(e, ctx.ctrl, "Arma")),
      armar: (e, ctx, api) => {
        const [w] = ctx.vars.w ?? [];
        if (!w) return [];
        return jugarPagando(e, ctx, api, w, precio(e, w, 1, 1), ["fuente", "rival:aliados"]);
      },
    },
  },
  "Zhong Kui": {
    claves: ["Imbloqueable"],
    disparadas: [
      { cuando: ["entra"], hacer: [sel(["yo:castillo"], { tipo: ["Arma", "Tótem"], f: "asequible" }, "b"), { op: "fn", f: "jugar" }, barajar()] },
      {
        cuando: ["entra"],
        hacer: [
          { op: "efecto", efecto: { tipo: "impuestoSinPagar" }, fin: "proximoTurno" },
          { op: "efecto", efecto: { tipo: "impuestoTalisman" }, fin: "proximoTurno" },
        ],
      },
    ],
    fns: {
      asequible: (e, ctx, u) => precio(e, u, 1, 0) <= disponibles(e, ctx.ctrl, N.carta(e, u).tipo),
      jugar: (e, ctx, api) => {
        const [u] = ctx.vars.b ?? [];
        if (!u) return [];
        return jugarPagando(e, ctx, api, u, precio(e, u, 1, 0));
      },
    },
  },
  Ahab: {
    claves: ["Furia"],
    disparadas: [{ cuando: ["entra"], hacer: buscar(["yo:castillo"], { tipo: "Aliado", f: "noAhab" }) }],
    activadas: [
      {
        texto: "Agrupar un Oro si tu oponente jugó más de una carta este turno",
        momento: "tuTurno",
        veces: "turno",
        requiere: "puede",
        hacer: [sel(["yo:pagado"], {}, "o"), { op: "fn", f: "agruparOro" }],
      },
    ],
    fns: {
      noAhab: (e, ctx, u) => N.carta(e, u).nombre !== "Ahab",
      puede: (e, ctx) => {
        const jugadas = e.jugadores[N.rival(ctx.ctrl)].jugadas;
        const n = Object.entries(jugadas).filter(([t]) => !["total", "nombres", "anuladas"].includes(t)).reduce((s, [, k]) => s + k, 0);
        return n > 1 && e.jugadores[ctx.ctrl].pagado.length > 0;
      },
      agruparOro: (e, ctx) => {
        for (const u of ctx.vars.o ?? []) N.mover(e, u, "reserva", { j: ctx.ctrl });
      },
    },
  },
  "Antonio Pincheira": {
    claves: ["Furia"],
    disparadas: [
      {
        cuando: ["entra", "ataca"],
        hacer: [{ op: "botar", n: 6, quien: "rival" }, sel(["rival:cementerio"], { tipo: "Oro" }, "o", { hasta: true }), { op: "ponerOro", var: "o", a: "reserva" }],
      },
      { cuando: ["faseFinal"], hacer: [sel(["yo:ataque"], {}, "a", { n: 2, hasta: true }), { op: "fn", f: "agrupar" }] },
    ],
    activadas: [{ texto: "Robar dos cartas", veces: "turno", hacer: [robar(2)] }],
    continuas: [{ impuestoTalisman: true }],
    fns: { agrupar: (e, ctx) => agrupar(e, ctx.vars.a ?? []) },
  },
  "Auguste Dupin": {
    claves: ["Furia"],
    disparadas: [{ cuando: ["entra"], hacer: [sel(["rival:mano"], { tipo: ["Talismán", "Tótem"] }, "x", { n: 99 }), mov("cementerio")] }],
    continuas: [{ cementerioRivalNoBaraja: true }],
  },
  "Bandido Esqueleto": {
    claves: ["Furia"],
    disparadas: [
      {
        cuando: ["entra"],
        hacer: [
          robar(1),
          {
            op: "opcional",
            texto: "Jugar un Aliado o Arma de tu mano o Cementerio pagando su coste",
            requiere: { de: ["yo:mano", "yo:cementerio"], filtro: { tipo: ["Aliado", "Arma"], f: "pagable" } },
            pasos: [sel(["yo:mano", "yo:cementerio"], { tipo: ["Aliado", "Arma"], f: "pagable" }, "p"), { op: "fn", f: "jugar" }],
          },
        ],
      },
    ],
    fns: {
      pagable: (e, ctx, u) => coste(e, u) <= disponibles(e, ctx.ctrl, N.carta(e, u).tipo),
      jugar: (e, ctx, api) => {
        const [u] = ctx.vars.p ?? [];
        if (!u) return [];
        const bandido = esBandido(e, u);
        const pasos = jugarPagando(e, ctx, api, u, coste(e, u));
        if (pasos.length && bandido) pasos.push({ op: "generar", n: 1, tipos: ["Aliado", "Arma"] });
        return pasos;
      },
    },
  },
  "Bandido Liberona": {
    claves: ["Furia"],
    disparadas: [
      {
        cuando: ["entra"],
        hacer: [
          { op: "tope", n: 4, como: "m" },
          sel(["var:m"], {}, "a"),
          mov("mano", "a"),
          { op: "si", f: "dosBandidos", entonces: [sel(["var:m"], { zona: "castillo" }, "b", { hasta: true }), mov("mano", "b")] },
        ],
      },
    ],
    fns: { dosBandidos: (e, ctx) => bandidosDe(e, ctx.ctrl) >= 2 },
  },
  "Bandido Medieval": {
    claves: ["Furia"],
    disparadas: [
      {
        cuando: ["entra"],
        hacer: [
          {
            op: "modo",
            opciones: [
              { texto: "Buscar una carta Bandido o un Aliado de coste 2 o menos", pasos: buscar(["yo:castillo"], { f: "buscable" }) },
              {
                texto: "Convertir un Oro oponente en un Oro sin habilidad",
                requiere: { de: ["rival:oros"], filtro: {} },
                pasos: [sel(["rival:oros"], {}, "o"), efecto("o", { tipo: "pierdeHabilidad" }, "mientras")],
              },
            ],
          },
        ],
      },
    ],
    activadas: [
      {
        texto: "Un Aliado o tus Aliados Bandido ganan 1 de Fuerza permanentemente",
        veces: "turno",
        hacer: [
          {
            op: "modo",
            opciones: [
              { texto: "Un Aliado gana 1 de Fuerza", requiere: { de: ["todos:aliados"], filtro: {} }, pasos: [sel(["todos:aliados"], {}, "a"), efecto("a", { tipo: "fuerza", n: 1 }, "mientras")] },
              { texto: "Tus Aliados Bandido ganan 1 de Fuerza", pasos: [sel(["yo:aliados"], { f: "bandido" }, "b", { n: 99 }), efecto("b", { tipo: "fuerza", n: 1 }, "mientras")] },
            ],
          },
        ],
      },
    ],
    fns: {
      buscable: (e, ctx, u) => esBandido(e, u) || (N.carta(e, u).tipo === "Aliado" && coste(e, u) <= 2),
      bandido: (e, ctx, u) => esBandido(e, u),
    },
  },
  "Bandido Neira": {
    claves: ["Furia"],
    disparadas: [
      {
        cuando: ["haceDano"],
        opcional: true,
        hacer: [
          {
            op: "modo",
            opciones: [
              { texto: "Desterrar hasta dos cartas de un Cementerio", pasos: [sel(["todos:cementerio"], {}, "c", { n: 2, hasta: true }), mov("desterrar", "c")] },
              {
                texto: "Poner un Oro de un Cementerio como Oro sin habilidad en tu Oro Pagado",
                requiere: "dosBandidosConOro",
                pasos: [sel(["todos:cementerio"], { tipo: "Oro" }, "o"), { op: "convertir", var: "o", en: "Oro", a: "pagado" }],
              },
            ],
          },
        ],
      },
    ],
    fns: {
      dosBandidosConOro: (e, ctx) =>
        bandidosDe(e, ctx.ctrl) >= 2 && [...e.jugadores[0].cementerio, ...e.jugadores[1].cementerio].some((u) => N.carta(e, u).tipo === "Oro"),
    },
  },
  "Bandido Salas": {
    disparadas: [
      {
        cuando: ["entra"],
        hacer: [
          {
            op: "modo",
            opciones: [
              { texto: "Buscar un Aliado en tu Castillo", pasos: buscar(["yo:castillo"], { tipo: "Aliado" }) },
              {
                texto: "Intercambiar el control de un Oro tuyo por un Oro oponente y moverlos al Oro Pagado",
                requiere: "puedeIntercambiar",
                pasos: [sel(["yo:oros"], {}, "a"), sel(["rival:oros"], {}, "b", { para: "tomar" }), { op: "fn", f: "intercambiar" }],
              },
            ],
          },
        ],
      },
    ],
    continuas: [{ fuerzaPor: "bonoBandido", a: "tusAliados", si: "dosBandidos" }],
    fns: {
      puedeIntercambiar: (e, ctx) => N.orosDe(e, ctx.ctrl).length > 0 && N.orosDe(e, N.rival(ctx.ctrl)).some((u) => N.puedeTomar(e, u, ctx.ctrl)),
      intercambiar: (e, ctx) => {
        const [a] = ctx.vars.a ?? [];
        const [b] = ctx.vars.b ?? [];
        if (!a || !b) return;
        N.mover(e, a, "pagado", { j: N.rival(ctx.ctrl) });
        N.mover(e, b, "pagado", { j: ctx.ctrl });
      },
      dosBandidos: (e, ctx) => bandidosDe(e, ctx.ctrl) >= 2,
      bonoBandido: (e, ctx) => (esBandido(e, ctx.objetivo) ? 1 : 0),
    },
  },
  Beleth: {
    claves: ["Furia", "Imbloqueable"],
    disparadas: [{ cuando: ["haceDano"], opcional: true, hacer: barajarseYBuscarDos(FILTRO_BELETH) }],
    continuas: [{ fuerza: 1, a: "tusDemasAliados", raza: "Guerrero" }],
    fns: {
      noBeleth: (e, ctx, u) => N.carta(e, u).nombre !== "Beleth",
      segundoAliado: segundoAliado(FILTRO_BELETH),
    },
  },
  "Berserker Z": {
    claves: ["Furia"],
    disparadas: [{ cuando: ["entra"], hacer: [{ op: "tope", n: 1, fondo: true, como: "u" }, mov("mano", "u")] }],
  },
  Breaker: {
    claves: ["Furia"],
    disparadas: [
      {
        cuando: ["entra"],
        hacer: [
          {
            op: "opcional",
            texto: "Mostrar dos Aliados o Armas de coste 2 o menos: jugar uno sin pagar su coste y Barajar el otro",
            requiere: "dos",
            pasos: [
              sel(["yo:mano", "yo:cementerio"], { tipo: ["Aliado", "Arma"], costeMax: 2 }, "m", { n: 2 }),
              sel(["var:m"], {}, "g"),
              { op: "fn", f: "resto" },
              mov("barajar", "r"),
              { op: "jugarGratis", var: "g" },
            ],
          },
        ],
      },
    ],
    fns: {
      dos: (e, ctx) =>
        [...e.jugadores[ctx.ctrl].mano, ...e.jugadores[ctx.ctrl].cementerio].filter((u) => ["Aliado", "Arma"].includes(N.carta(e, u).tipo) && coste(e, u) <= 2).length >= 2,
      resto: (e, ctx) => {
        ctx.vars.r = (ctx.vars.m ?? []).filter((u) => !(ctx.vars.g ?? []).includes(u));
      },
    },
  },
  Cain: {
    claves: ["Furia", "Imbloqueable"],
    disparadas: [
      {
        cuando: ["entra"],
        hacer: [
          {
            op: "modo",
            opciones: [
              { texto: "Barajar hasta una carta de coste 2 o menos", pasos: [sel(["todos:enJuego"], { costeMax: 2 }, "x", { hasta: true }), mov("barajar")] },
              { texto: "Robar dos cartas", pasos: [robar(2)] },
            ],
          },
        ],
      },
      { cuando: ["haceDano"], opcional: true, hacer: barajarseYBuscarDos(FILTRO_CAIN) },
    ],
    fns: { segundoAliado: segundoAliado(FILTRO_CAIN) },
  },
  Calfucura: {
    claves: ["Furia"],
    disparadas: [
      {
        cuando: ["entra"],
        opcional: true,
        hacer: [
          sel(["yo:castillo", "yo:cementerio"], { tipo: "Aliado" }, "a"),
          sel(["yo:castillo", "yo:cementerio"], { tipo: "Aliado", f: "distinto" }, "b"),
          mov("mano", "a"),
          mov("mano", "b"),
          barajar(),
        ],
      },
    ],
    activadas: [{ texto: "Generar un Oro para jugar Aliados o Armas por el turno", veces: "turno", hacer: [{ op: "generar", n: 1, tipos: ["Aliado", "Arma"] }] }],
    fns: {
      distinto: (e, ctx, u) => (ctx.vars.a ?? []).every((a) => a !== u && coste(e, a) !== coste(e, u)),
    },
  },
  Canaan: {
    claves: ["Furia"],
    disparadas: [
      {
        cuando: ["entra"],
        opcional: true,
        hacer: [
          {
            op: "modo",
            opciones: [
              {
                texto: "Un Oro que controles gana las habilidades de un Oro oponente",
                requiere: "orosAmbos",
                pasos: [sel(["yo:oros"], {}, "a"), sel(["rival:oros"], {}, "b"), { op: "fn", f: "ganar" }],
              },
              { texto: "Buscar un Arma en tu Castillo", pasos: buscar(["yo:castillo"], { tipo: "Arma" }) },
            ],
          },
        ],
      },
    ],
    fns: {
      orosAmbos: (e, ctx) => N.orosDe(e, ctx.ctrl).length > 0 && N.orosDe(e, N.rival(ctx.ctrl)).length > 0,
      ganar: (e, ctx) => {
        const [a] = ctx.vars.a ?? [];
        const [b] = ctx.vars.b ?? [];
        if (!a || !b) return;
        e.ganadas[a] = [...(e.ganadas[a] ?? []), e.instancias[b]];
      },
    },
  },
  "Capitan Flint": {
    continuas: [{ fuerza: 1, a: "tusAliados" }],
  },
  "Cochero de Sombras": {
    claves: ["Furia"],
    disparadas: [
      { cuando: ["ataca"], hacer: [sel(["rival:aliados"], {}, "b", { hasta: true }), sel(["yo:ataque"], {}, "a"), { op: "fn", f: "forzar" }] },
      {
        cuando: ["haceDano"],
        opcional: true,
        hacer: [
          sel(["fuente"], {}, "yo"),
          mov("barajar", "yo"),
          {
            op: "modo",
            opciones: [
              {
                texto: "Destruir una carta de coste 2 o menos",
                requiere: { de: ["todos:enJuego"], filtro: { costeMax: 2 }, para: "destruir" },
                pasos: [sel(["todos:enJuego"], { costeMax: 2 }, "x", { para: "destruir" }), mov("destruir")],
              },
              {
                texto: "Jugar un Aliado o Arma de coste 1 de tu mano o Cementerio sin pagar su coste",
                requiere: { de: ["yo:mano", "yo:cementerio"], filtro: { tipo: ["Aliado", "Arma"], costeMin: 1, costeMax: 1 } },
                pasos: [sel(["yo:mano", "yo:cementerio"], { tipo: ["Aliado", "Arma"], costeMin: 1, costeMax: 1 }, "g"), { op: "jugarGratis", var: "g" }],
              },
            ],
          },
        ],
      },
    ],
    fns: {
      forzar: (e, ctx) => {
        for (const uid of ctx.vars.b ?? []) {
          for (const atacante of ctx.vars.a ?? []) N.agregarEfecto(e, { tipo: "debeBloquearA", uid, atacante }, ctx.ctrl);
        }
      },
    },
  },
  "Corsario Negro": {
    disparadas: [
      {
        cuando: ["entra"],
        opcional: true,
        hacer: [{ op: "mostrarHasta", n: 2, filtro: { tipo: "Aliado", f: "guerrero" }, como: "m" }, mov("mano", "m")],
      },
    ],
    activadas: [
      {
        texto: "Destruir este Aliado: tu oponente Bota tantas cartas como Oros controle",
        momento: "vigilia",
        coste: [sel(["fuente"], {}, "yo"), mov("destruir", "yo")],
        hacer: [{ op: "botar", nf: "orosRival", quien: "rival" }],
      },
    ],
    fns: {
      guerrero: (e, ctx, u) => (N.carta(e, u).razas ?? []).includes("Guerrero"),
      orosRival: (e, ctx) => N.orosDe(e, N.rival(ctx.ctrl)).length,
    },
  },
  Cush: {
    disparadas: [{ zona: ["cementerio"], cuando: ["entra"], quien: "cualquiera", si: "esAliado", opcional: true, hacer: [sel(["fuente"], {}, "yo"), mov("mano", "yo")] }],
    activadas: [
      {
        texto: "Un Aliado Bandido gana Imbloqueable y hace daño al Destierro este turno",
        momento: "tuTurno",
        veces: "turno",
        requiere: { de: ["todos:aliados"], filtro: { f: "bandido" } },
        hacer: [sel(["todos:aliados"], { f: "bandido" }), efecto("x", { tipo: "gana", clave: "Imbloqueable" }, "turno"), efecto("x", { tipo: "gana", clave: "DanoAlDestierro" }, "turno")],
      },
    ],
    fns: {
      esAliado: (e, ctx) => N.carta(e, ctx.datos.uid).tipo === "Aliado",
      bandido: (e, ctx, u) => esBandido(e, u),
    },
  },
  Dhampir: {
    claves: ["Furia"],
    disparadas: [
      {
        cuando: ["entra", "ataca", "sale"],
        hacer: [
          {
            op: "si",
            f: "aliadoEnMano",
            entonces: [
              {
                op: "modo",
                opciones: [
                  { texto: "Desterrar hasta una carta de coste 3 o menos", pasos: [sel(["todos:enJuego"], { costeMax: 3 }, "x", { hasta: true, para: "desterrar" }), mov("desterrar")] },
                  { texto: "Robar dos cartas", pasos: [robar(2)] },
                ],
              },
            ],
          },
        ],
      },
      { cuando: ["juega"], quien: "rival", veces: 3, hacer: [{ op: "si", f: "miTurno", entonces: [{ op: "desterrarTope", n: 2, quien: "rival" }], sino: [{ op: "botar", n: 2, quien: "rival" }] }] },
    ],
    fns: {
      aliadoEnMano: (e, ctx) => e.jugadores[ctx.ctrl].mano.some((u) => N.carta(e, u).tipo === "Aliado"),
      miTurno: (e, ctx) => e.activo === ctx.ctrl,
    },
  },
  "Dhampir Feroce": {
    claves: ["Furia"],
    disparadas: [{ cuando: ["entra", "sale"], hacer: [robar(2), { op: "botar", n: 3, quien: "rival" }] }],
  },
};
