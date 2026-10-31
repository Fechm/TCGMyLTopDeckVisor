import * as N from "../nucleo.js";
import { sel, mov, barajar, robar, efecto, buscar, castilloElegido, aliadoDeCastillo, coste } from "../formato.js";
import { armaCabe, disponibles, pagarOros } from "../efectos.js";

const botar = (n, quien = "rival") => ({ op: "botar", n, quien });

const barajarODesterrar = (v) => ({
  op: "modo",
  opciones: [
    { texto: "Barajar", pasos: [mov("barajar", v)] },
    { texto: "Desterrar", pasos: [mov("desterrar", v)] },
  ],
});

const portadorLibre = (e, ctx, u) => u !== ctx.fuente && armaCabe(e, u, ctx.fuente);

const registrarPortador = (clave) => (e, ctx) => {
  const p = N.portadorDe(e, ctx.fuente);
  if (p) e.usos[`${clave}|${ctx.fuente}`] = p;
};

const salioPortador = (clave) => (e, ctx) => N.ubicar(e, ctx.fuente)?.zona === "cementerio" && e.usos[`${clave}|${ctx.fuente}`] === ctx.datos.uid;


const libreUnaVez = (clave) => (e, ctx) => e.usos[`${clave}|${ctx.fuente}`] !== e.turno;
const marcarUnaVez = (clave) => (e, ctx) => {
  e.usos[`${clave}|${ctx.fuente}`] = e.turno;
};

const jugableReducido = (e, ctx, u) => {
  const c = N.carta(e, u);
  if (!["Aliado", "Arma", "Tótem"].includes(c.tipo)) return false;
  if (Math.max(0, coste(e, u) - 1) > disponibles(e, ctx.ctrl, c.tipo)) return false;
  if (c.tipo === "Arma") return N.aliadosDe(e, ctx.ctrl).some((a) => armaCabe(e, a, u));
  return true;
};

export const HABILIDADES = {
  "Revólver Webley": {
    claves: ["Exhumar"],
    portador: { fuerza: 2, claves: ["Furia"] },
    disparadas: [
      {
        cuando: ["entra"],
        hacer: [
          {
            op: "opcional",
            texto: "Jugar una carta de tu mano o Cementerio reduciendo su coste en un Oro",
            requiere: "hayJugable",
            pasos: [sel(["yo:mano", "yo:cementerio"], { f: "jugable" }, "j"), { op: "fn", f: "jugarReducido" }],
          },
        ],
      },
    ],
    fns: {
      jugable: jugableReducido,
      hayJugable: (e, ctx) => [...e.jugadores[ctx.ctrl].mano, ...e.jugadores[ctx.ctrl].cementerio].some((u) => jugableReducido(e, ctx, u)),
      jugarReducido: (e, ctx) => {
        const pasos = [];
        for (const u of ctx.vars.j ?? []) {
          const c = N.carta(e, u);
          const desde = N.ubicar(e, u)?.zona ?? null;
          pagarOros(e, ctx.ctrl, Math.max(0, coste(e, u) - 1), c.tipo);
          const datos = { pagado: true, desde };
          if (c.tipo === "Arma") pasos.push({ op: "sel", de: ["yo:aliados"], filtro: { armaLibre: u }, como: "_port" }, { op: "portar", arma: u, en: "_port", datos });
          else pasos.push({ op: "entrar", uid: u, datos });
          N.disparar(e, "juega", { uid: u, j: ctx.ctrl, tipo: c.tipo, pagado: true, desde });
        }
        return pasos;
      },
    },
  },
  "Rifle Winchester": {
    portador: { fuerza: 2, claves: ["Indestructible"] },
    disparadas: [
      { cuando: ["entra"], hacer: buscar(["yo:castillo"], { tipo: "Aliado" }) },
      { cuando: ["ataca"], quien: "cualquiera", si: "portadorAtaca", hacer: buscar(["yo:castillo"], { tipo: "Aliado" }) },
      { cuando: ["sale"], hacer: [botar(3)] },
    ],
    fns: {
      portadorAtaca: (e, ctx) => N.portadorDe(e, ctx.fuente) === ctx.datos.uid,
    },
  },
  "Sable Corto": {
    reduce: "red",
    portador: { fuerza: 1, claves: ["Indesterrable"] },
    activadas: [
      {
        texto: "Tu oponente pone en su Cementerio tantas cartas del tope de su Castillo como Fuerza tenga un Aliado que controles",
        momento: "vigilia",
        veces: "turno",
        requiere: { de: ["yo:aliados"], filtro: {} },
        hacer: [sel(["yo:aliados"], {}, "a"), { op: "fn", f: "mostrar" }],
      },
    ],
    fns: {
      red: (e, ctx) => (N.armasDe(e, ctx.ctrl).length > 0 ? 1 : 0),
      mostrar: (e, ctx) => {
        const [a] = ctx.vars.a ?? [];
        if (a) N.quitarDelCastillo(e, N.rival(ctx.ctrl), N.fuerza(e, a), "cementerio");
      },
    },
  },
  "Spada Da Lato": {
    portador: { fuerza: 1 },
    disparadas: [{ cuando: ["entra"], opcional: true, hacer: [{ op: "fn", f: "robarFuerza" }] }],
    fns: {
      robarFuerza: (e, ctx) => {
        const p = N.portadorDe(e, ctx.fuente);
        if (p) N.robar(e, ctx.ctrl, N.fuerza(e, p));
      },
    },
  },
  "Trampa Dulce": {
    portador: { fuerza: 2, claves: ["Indestructible"] },
    disparadas: [
      { cuando: ["entra"], hacer: [{ op: "fn", f: "registrar" }] },
      {
        zona: ["cementerio"],
        cuando: ["saleDelJuego"],
        quien: "cualquiera",
        si: "salioPortador",
        hacer: [
          {
            op: "opcional",
            texto: "Cambiar Trampa Dulce de portador",
            requiere: "hayPortador",
            pasos: [sel(["yo:aliados"], { f: "libre" }, "p"), { op: "fn", f: "reportar" }],
          },
        ],
      },
    ],
    fns: {
      registrar: registrarPortador("trampa"),
      salioPortador: salioPortador("trampa"),
      libre: portadorLibre,
      hayPortador: (e, ctx) => N.aliadosDe(e, ctx.ctrl).some((u) => portadorLibre(e, ctx, u)),
      reportar: (e, ctx) => {
        const [p] = ctx.vars.p ?? [];
        if (!p) return;
        N.sacar(e, ctx.fuente);
        (e.armas[p] ??= []).push(ctx.fuente);
        e.usos[`trampa|${ctx.fuente}`] = p;
      },
    },
  },
  "Trompeta del Apocalipsis": {
    claves: ["Exhumar"],
    continuas: [{ fuerzaPor: "sinFuerza", a: "aliados" }],
    disparadas: [
      { cuando: ["entra"], hacer: [{ op: "fn", f: "silenciar" }] },
      { cuando: ["sale"], hacer: [{ op: "fn", f: "liberar" }] },
      {
        cuando: ["faseFinal"],
        hacer: [sel(["todos:cementerio"], {}, "c", { hasta: true, quien: "rival" }), { op: "fn", f: "levantar" }],
      },
    ],
    fns: {
      sinFuerza: (e, ctx) => (N.portadorDe(e, ctx.fuente) === ctx.objetivo ? -(N.carta(e, ctx.objetivo).fuerza ?? 0) : 0),
      silenciar: (e, ctx) => {
        const p = N.portadorDe(e, ctx.fuente);
        if (p) N.agregarEfecto(e, { tipo: "pierdeHabilidad", uid: p, fin: "mientras", trompeta: ctx.fuente }, ctx.ctrl);
      },
      liberar: (e, ctx) => {
        e.efectos = e.efectos.filter((f) => f.trompeta !== ctx.fuente);
      },
      levantar: (e, ctx) => {
        const r = N.rival(ctx.ctrl);
        for (const u of ctx.vars.c ?? []) {
          N.mover(e, u, "defensa", { j: r });
          e.conv[u] = { tipo: "Aliado", fuerza: 3, sinHabilidad: true };
          e.jugadores[r].nuevos.push(u);
        }
        const sinHab = N.aliadosDe(e, r).filter((u) => !N.activa(e, u)).length;
        N.quitarDelCastillo(e, ctx.ctrl, sinHab + 2, "cementerio");
      },
    },
  },
  "Yelmo Vendel": {
    portador: { fuerza: 2, claves: ["Indestructible"] },
    activadas: [
      {
        texto: "Buscar en un Castillo dos cartas con distinto nombre y Desterrarlas",
        momento: "vigilia",
        veces: "turno",
        hacer: [
          castilloElegido((quien) => [
            sel([`${quien}:castillo`], {}, "b"),
            sel([`${quien}:castillo`], { f: "otroNombre" }, "b2"),
            mov("desterrar", "b"),
            mov("desterrar", "b2"),
            barajar(quien),
          ]),
        ],
      },
    ],
    disparadas: [
      {
        cuando: ["faseFinal"],
        hacer: [
          sel(["todos:cementerio"], {}, "c", { n: 3, hasta: true }),
          mov("barajar", "c"),
          sel(["todos:cementerio"], {}, "d", { nf: "resto", hasta: true }),
          mov("desterrar", "d"),
          robar(1),
        ],
      },
    ],
    fns: {
      otroNombre: (e, ctx, u) => !(ctx.vars.b ?? []).some((b) => N.carta(e, b).nombre === N.carta(e, u).nombre),
      resto: (e, ctx) => 3 - (ctx.vars.c ?? []).length,
    },
  },
  "Yelmo de Mambrino": {
    portador: { fuerza: 1, claves: ["Indesterrable"] },
    disparadas: [{ cuando: ["entra", "juega"], quien: "cualquiera", si: "dispara", veces: 2, hacer: [robar(1), castilloElegido(aliadoDeCastillo)] }],
    fns: {
      dispara: (e, ctx) => {
        const d = ctx.datos;
        if (d.uid === ctx.fuente) return true;
        return !!d.tipo && d.j === ctx.ctrl && ["Arma", "Aliado"].includes(d.tipo);
      },
    },
  },
  "Ahu Tongariki": {
    claves: ["NoAnulable"],
    disparadas: [
      {
        cuando: ["entra"],
        hacer: [
          {
            op: "modo",
            opciones: [
              {
                texto: "Barajar una carta de coste 2 o menos",
                requiere: { de: ["todos:enJuego"], filtro: { costeMax: 2 } },
                pasos: [sel(["todos:enJuego"], { costeMax: 2 }), mov("barajar")],
              },
              { texto: "Robar dos cartas", pasos: [robar(2)] },
            ],
          },
        ],
      },
    ],
    continuas: [{ fuerza: -1, a: "aliados", costeMax: 1 }, { gana: "Indestructible", a: "tusAliados" }],
  },
  "Altar de Muertos": {
    disparadas: [
      {
        cuando: ["entra"],
        hacer: [
          {
            op: "modo",
            opciones: [
              {
                texto: "Barajar la mitad de los Aliados de cada jugador",
                pasos: [sel(["yo:aliados"], {}, "a", { nf: "mitadYo" }), sel(["rival:aliados"], {}, "b", { nf: "mitadRival" }), mov("barajar", "a"), mov("barajar", "b")],
              },
              {
                texto: "Barajar una carta de coste 3 o menos",
                requiere: { de: ["todos:enJuego"], filtro: { costeMax: 3 } },
                pasos: [sel(["todos:enJuego"], { costeMax: 3 }), mov("barajar")],
              },
            ],
          },
        ],
      },
    ],
    activadas: [
      {
        texto: "Por cada Tótem que controles, tu oponente Bota dos o Destierra una del tope de su Castillo; con dos Tótem o menos, Roba una",
        momento: "tuTurno",
        veces: "turno",
        hacer: [{ op: "fn", f: "porTotem" }, { op: "si", f: "pocos", entonces: [robar(1)] }],
      },
    ],
    fns: {
      mitadYo: (e, ctx) => Math.ceil(N.aliadosDe(e, ctx.ctrl).length / 2),
      mitadRival: (e, ctx) => Math.ceil(N.aliadosDe(e, N.rival(ctx.ctrl)).length / 2),
      porTotem: (e, ctx) => {
        const n = e.jugadores[ctx.ctrl].apoyo.filter((u) => N.carta(e, u).tipo === "Tótem").length;
        return Array.from({ length: n }, () => ({
          op: "modo",
          opciones: [
            { texto: "Tu oponente Bota dos cartas", pasos: [botar(2)] },
            { texto: "Desterrar una carta del tope del Castillo oponente", pasos: [{ op: "desterrarTope", n: 1, quien: "rival" }] },
          ],
        }));
      },
      pocos: (e, ctx) => e.jugadores[ctx.ctrl].apoyo.filter((u) => N.carta(e, u).tipo === "Tótem").length <= 2,
    },
  },
  "Altar del Juramento": {
    disparadas: [
      {
        cuando: ["entra"],
        hacer: [
          sel(["todos:aliados"], {}, "a", { n: 2, hasta: true }),
          {
            op: "modo",
            opciones: [
              { texto: "Ganan 2 de Fuerza", pasos: [efecto("a", { tipo: "fuerza", n: 2 }, "juego")] },
              { texto: "Pierden 2 de Fuerza", pasos: [efecto("a", { tipo: "fuerza", n: -2 }, "juego")] },
            ],
          },
        ],
      },
    ],
    activadas: [
      {
        texto: "Desterrarlo: subir del Cementerio a tu mano hasta dos cartas al azar",
        coste: [sel(["fuente"], {}, "yo"), mov("desterrar", "yo")],
        hacer: [sel(["yo:cementerio"], {}, "c", { n: 2, azar: true }), mov("mano", "c")],
      },
    ],
  },
  Antartica: {
    continuas: [{ fuerza: 2, a: "tusAliados" }, { cementerioRivalSinHabilidad: true }],
    activadas: [
      {
        texto: "Si atacaste en tu turno anterior, generar un Oro para jugar Aliados; al usarlo, Robas una carta",
        veces: "turno",
        requiere: "ataco",
        hacer: [{ op: "fn", f: "generar" }],
      },
    ],
    disparadas: [{ cuando: ["juega"], quien: "yo", si: "usado", hacer: [{ op: "fn", f: "limpiar" }, robar(1)] }],
    fns: {
      ataco: (e, ctx) => e.jugadores[ctx.ctrl].atacoTurnoAnterior,
      generar: (e, ctx) => {
        const p = e.jugadores[ctx.ctrl];
        p.generados = [...(p.generados ?? []), { n: 1, tipos: ["Aliado"], antartica: ctx.fuente }];
        e.usos[`antartica|${ctx.fuente}`] = e.turno;
      },
      usado: (e, ctx) =>
        e.usos[`antartica|${ctx.fuente}`] === e.turno && !(e.jugadores[ctx.ctrl].generados ?? []).some((g) => g.antartica === ctx.fuente),
      limpiar: (e, ctx) => {
        delete e.usos[`antartica|${ctx.fuente}`];
      },
    },
  },
  "Arco del Triunfo": {
    continuas: [{ fuerza: 1, a: "tusAliados" }, { gana: "DanoAlDestierro", a: "tusAliados" }],
    disparadas: [
      {
        cuando: ["entra", "sale"],
        hacer: [
          { op: "mostrarHasta", n: 1, filtro: { tipo: ["Aliado", "Tótem"], costeMin: 2, costeMax: 2 }, como: "m" },
          {
            op: "modo",
            opciones: [
              { texto: "Ponerlo en juego", requiere: "mostro", pasos: [{ op: "jugarGratis", var: "m" }] },
              { texto: "Ponerlo en tu mano", requiere: "mostro", pasos: [mov("mano", "m")] },
            ],
          },
          barajar(),
        ],
      },
    ],
    fns: { mostro: (e, ctx) => (ctx.vars.m ?? []).length > 0 },
  },
  "Bayou St. John": {
    disparadas: [
      { cuando: ["entra"], hacer: [robar(2)] },
      { cuando: ["comienzoVigilia"], si: "libre", opcional: true, hacer: [{ op: "fn", f: "marcar" }, sel(["rival:cementerio"], {}, "c", { n: 3, hasta: true }), mov("desterrar", "c")] },
      { cuando: ["faseFinal"], si: "libre", hacer: [{ op: "fn", f: "marcar" }, sel(["rival:cementerio"], {}, "c", { n: 3, hasta: true }), mov("desterrar", "c")] },
    ],
    activadas: [
      {
        texto: "Descartar o Destruir una carta que controles: hasta dos Aliados de coste 2 o menos ganan 1 de Fuerza y Furia",
        veces: "turno",
        requiere: "puede",
        hacer: [
          {
            op: "modo",
            opciones: [
              { texto: "Descartar una carta de tu mano", requiere: { de: ["yo:mano"], filtro: {} }, pasos: [sel(["yo:mano"], {}, "d"), mov("cementerio", "d")] },
              {
                texto: "Destruir una carta que controles",
                requiere: { de: ["yo:enJuego"], filtro: {}, para: "destruir" },
                pasos: [sel(["yo:enJuego"], {}, "d", { para: "destruir" }), mov("destruir", "d")],
              },
            ],
          },
          sel(["todos:aliados"], { costeMax: 2 }, "a", { n: 2, hasta: true }),
          efecto("a", { tipo: "fuerza", n: 1 }),
          efecto("a", { tipo: "gana", clave: "Furia" }),
        ],
      },
    ],
    fns: {
      libre: libreUnaVez("bayou"),
      marcar: marcarUnaVez("bayou"),
      puede: (e, ctx) => e.jugadores[ctx.ctrl].mano.length > 0 || N.enJuegoDe(e, ctx.ctrl).some((u) => !N.tiene(e, u, "Indestructible")),
    },
  },
  Bistritz: {
    continuas: [{ fuerza: -1, a: "aliadosRival" }],
    disparadas: [{ cuando: ["entra"], hacer: [{ op: "robarHasta", n: 3 }] }],
    activadas: [
      {
        texto: "Convertir la primera carta de un Castillo en un Aliado con Furia de Fuerza 4",
        veces: "turno",
        hacer: [
          castilloElegido((quien) => [
            { op: "tope", quien, n: 1, como: "t" },
            { op: "convertir", var: "t", en: "Aliado", fuerza: 4, a: "defensa" },
            efecto("t", { tipo: "gana", clave: "Furia" }, "mientras"),
          ]),
        ],
      },
    ],
  },
  "Campus de Muerte": {
    reduce: "red",
    claves: ["NoAnulable"],
    continuas: [{ fuerzaPor: "porOtros", a: "aliados" }],
    activadas: [
      {
        texto: "Buscar un Arma o Tótem en tu Castillo y ponerlo en tu mano",
        momento: "tuTurno",
        veces: "turno",
        hacer: buscar(["yo:castillo"], { tipo: ["Arma", "Tótem"] }),
      },
    ],
    fns: {
      red: (e, ctx) => (N.aliadosDe(e, ctx.ctrl).length <= 1 ? 1 : 0),
      porOtros: (e, ctx) => -Math.max(0, N.aliadosDe(e, N.controlador(e, ctx.objetivo)).length - 1),
    },
  },
  "Capilla de los Susurros": {
    claves: ["Exhumar"],
    continuas: [{ fuerza: 1, a: "tusAliados" }],
    disparadas: [{ cuando: ["ataca"], quien: "rival", hacer: [{ op: "fn", f: "cargar" }, efecto("x", { tipo: "fuerza", n: -1 })] }],
    fns: {
      cargar: (e, ctx) => {
        ctx.vars.x = [ctx.datos.uid];
      },
    },
  },
  "Casa Colorada": {
    disparadas: [
      { cuando: ["entra"], opcional: true, hacer: [sel(["todos:enJuego"], { costeMin: 2 }), barajarODesterrar("x")] },
      { cuando: ["comienzoVigilia"], quien: "yo", opcional: true, hacer: [sel(["todos:cementerio"], {}, "c", { n: 3, hasta: true }), barajarODesterrar("c"), robar(1)] },
      { cuando: ["faseFinal"], quien: "rival", opcional: true, hacer: [sel(["todos:cementerio"], {}, "c", { n: 3, hasta: true }), barajarODesterrar("c"), robar(1)] },
    ],
  },
  "Casa de Opio": {
    claves: ["NoAnulable"],
    disparadas: [{ cuando: ["juega"], quien: "rival", si: "miTurno", veces: 1, hacer: [{ op: "generar", n: 1, tipos: ["Aliado", "Arma"] }] }],
    fns: { miTurno: (e, ctx) => e.activo === ctx.ctrl },
  },
  "Castillo Drácula": {
    disparadas: [
      {
        cuando: ["entra"],
        hacer: [
          sel(["todos:enJuego"], { costeMax: 3, noFuente: true }, "a", { hasta: true }),
          { op: "fn", f: "segundo" },
          {
            op: "modo",
            opciones: [
              { texto: "Barajar", pasos: [mov("barajar", "a"), mov("barajar", "a2")] },
              { texto: "Desterrar", pasos: [mov("desterrar", "a"), mov("desterrar", "a2")] },
            ],
          },
          robar(2),
        ],
      },
    ],
    activadas: [
      {
        texto: "Pagar un Oro: hasta tu próximo turno no recibes daño de combate, o tu oponente Bota cinco cartas",
        veces: "turno",
        oros: 1,
        hacer: [
          {
            op: "modo",
            opciones: [
              { texto: "No recibir daño de combate hasta tu próximo turno", pasos: [{ op: "efecto", efecto: { tipo: "prevenirDano" }, jugador: "yo", fin: "proximoTurno" }] },
              { texto: "Tu oponente Bota cinco cartas", pasos: [botar(5)] },
            ],
          },
        ],
      },
    ],
    fns: {
      segundo: (e, ctx) => {
        const [a] = ctx.vars.a ?? [];
        if (!a) return [];
        return [sel(["todos:enJuego"], { costeMax: 3 - coste(e, a), excluir: [a], noFuente: true }, "a2", { hasta: true })];
      },
    },
  },
  "Castillo de Karnstein": {
    claves: ["Exhumar"],
    disparadas: [
      {
        cuando: ["entra"],
        quien: "cualquiera",
        si: "totemMio",
        veces: 1,
        hacer: [sel(["todos:enJuego"], { noTipo: ["Oro"] }, "x", { hasta: true, para: "desterrar" }), mov("desterrar"), robar(2)],
      },
    ],
    fns: { totemMio: (e, ctx) => ctx.datos.j === ctx.ctrl && N.carta(e, ctx.datos.uid).tipo === "Tótem" },
  },
  "Cementerio General": {
    claves: ["Exhumar"],
    disparadas: [{ cuando: ["entra"], hacer: [sel(["rival:enJuego"], { costeMax: 3 }, "x", { nf: "exhumar", hasta: true }), mov("barajar"), robar(2)] }],
    fns: { exhumar: (e, ctx) => N.enJuegoDe(e, ctx.ctrl).filter((u) => N.tiene(e, u, "Exhumar")).length },
  },
  "Cementerio Maldito": {
    claves: ["Exhumar"],
    activadas: [
      {
        texto: "Barajar o Desterrar hasta cuatro cartas de los Cementerios",
        veces: "turno",
        hacer: [sel(["todos:cementerio"], {}, "c", { n: 4, hasta: true }), barajarODesterrar("c")],
      },
      {
        texto: "Elegir un tipo: tus cartas de ese tipo y coste 1 o más en tu Cementerio ganan Exhumar por el turno",
        veces: "turno",
        hacer: [
          {
            op: "modo",
            opciones: ["Aliado", "Arma", "Tótem"].map((tipo) => ({ texto: tipo, pasos: [{ op: "fn", f: "exhumarTipo", tipo }] })),
          },
        ],
      },
    ],
    fns: {
      exhumarTipo: (e, ctx, api, p) => {
        for (const u of e.jugadores[ctx.ctrl].cementerio) {
          if (N.carta(e, u).tipo === p.tipo && coste(e, u) >= 1) N.agregarEfecto(e, { tipo: "gana", clave: "Exhumar", uid: u, fin: "turno" }, ctx.ctrl);
        }
      },
    },
  },
  "Cementerio de Kingstead": {
    claves: ["Exhumar"],
    disparadas: [
      { cuando: ["entra"], opcional: true, hacer: [sel(["todos:enJuego"], { noFuente: true }), efecto("x", { tipo: "pierdeHabilidad" }, "proximoTurno")] },
      { cuando: ["comienzoTurno"], opcional: true, hacer: [sel(["fuente"], {}, "yo"), mov("destruir", "yo"), { op: "si", f: "destruido", entonces: [botar(3)] }] },
    ],
    fns: { destruido: (e, ctx) => N.ubicar(e, ctx.fuente)?.zona === "cementerio" },
  },
  "Chestnut Hill": {},
};
