import * as N from "../nucleo.js";
import { sel, mov, barajar, robar, efecto, buscar, castilloElegido, coste } from "../formato.js";

const disp = (e, j, tipo) =>
  e.jugadores[j].reserva.length + (e.jugadores[j].generados ?? []).filter((g) => !g.tipos || g.tipos.includes(tipo)).reduce((s, g) => s + g.n, 0);

const contar = (e, j, c) => {
  const p = e.jugadores[j];
  p.jugadas[c.tipo] = (p.jugadas[c.tipo] ?? 0) + 1;
  p.jugadas.nombres[c.nombre] = (p.jugadas.nombres[c.nombre] ?? 0) + 1;
  if (["Aliado", "Arma", "Tótem"].includes(c.tipo)) p.jugadas.total += 1;
};

const jugarPagando = (e, ctx, api, uid, n, desde) => {
  const j = ctx.ctrl;
  const c = N.carta(e, uid);
  api.pagarOros(e, j, n, c.tipo);
  contar(e, j, c);
  N.disparar(e, "juega", { uid, j, tipo: c.tipo, pagado: true, desde });
  const datos = { pagado: true, desde };
  if (c.tipo === "Arma") return [{ op: "sel", de: ["yo:aliados"], filtro: { armaLibre: uid }, como: "_port" }, { op: "portar", arma: uid, en: "_port", datos }];
  return [{ op: "entrar", uid, datos }];
};

const cancelarAtaque = (e, uids) => {
  for (const u of uids) {
    const j = N.controlador(e, u);
    if (!e.jugadores[j].ataque.includes(u)) continue;
    N.sacar(e, u);
    e.jugadores[j].defensa.push(u);
    e.atacantes = e.atacantes.filter((x) => x !== u);
    for (const [b, a] of Object.entries(e.bloqueos)) if (a === u) delete e.bloqueos[b];
  }
};

const barajarYDesterrar = (n) => [
  sel(["todos:cementerio"], {}, "c", { n, hasta: true }),
  mov("barajar", "c"),
  sel(["todos:cementerio"], {}, "d", { nf: "resto", hasta: true }),
  mov("desterrar", "d"),
];

const costeAplastar = (e, u) => {
  const c = coste(e, u);
  const red = (N.carta(e, u).razas ?? []).includes("Daikaiju") ? 2 : 1;
  return Math.max(Math.min(c, 1), c - red);
};

const RAZAS_APLASTAR = ["Caballero", "Eterno", "Guerrero", "Héroe"];

export const HABILIDADES = {
  Aplastar: {
    talisman: [
      sel(["yo:cementerio"], { tipo: "Aliado", f: "pagable" }, "a", { hasta: true }),
      { op: "fn", f: "jugarAliado" },
      sel(["todos:aliados"], { f: "cabe" }, "d", { n: 99, hasta: true, para: "desterrar" }),
      mov("desterrar", "d"),
    ],
    fns: {
      pagable: (e, ctx, u) => costeAplastar(e, u) <= disp(e, ctx.ctrl, "Aliado"),
      jugarAliado: (e, ctx, api) => {
        const [u] = ctx.vars.a ?? [];
        if (!u) return [];
        return jugarPagando(e, ctx, api, u, costeAplastar(e, u), "cementerio");
      },
      cabe: (e, ctx, u) => {
        if (!(N.carta(e, u).razas ?? []).some((r) => RAZAS_APLASTAR.includes(r))) return false;
        const usado = (ctx.vars.d ?? []).reduce((s, x) => s + coste(e, x), 0);
        return coste(e, u) <= 3 - usado;
      },
    },
  },
  "Aqui Están Todos Locos": {
    destierroAlJugar: true,
    requiere: "puede",
    talisman: [sel(["yo:aliados"], { costeMax: 2, f: "conGemelo" }, "a"), sel(["yo:aliados"], { f: "gemelo" }, "b"), { op: "fn", f: "copiar" }],
    fns: {
      conGemelo: (e, ctx, u) => N.aliadosDe(e, ctx.ctrl).some((o) => o !== u && coste(e, o) === coste(e, u)),
      gemelo: (e, ctx, u) => {
        const [a] = ctx.vars.a ?? [];
        return !!a && u !== a && coste(e, u) === coste(e, a);
      },
      puede: (e, ctx) => N.aliadosDe(e, ctx.ctrl).some((u) => coste(e, u) <= 2 && N.aliadosDe(e, ctx.ctrl).some((o) => o !== u && coste(e, o) === coste(e, u))),
      copiar: (e, ctx) => {
        const [a] = ctx.vars.a ?? [];
        const [b] = ctx.vars.b ?? [];
        if (!a || !b) return;
        const m = N.carta(e, b);
        e.conv[a] = { tipo: "Aliado", fuerza: m.fuerza, coste: m.coste, sinHabilidad: false, como: e.instancias[b] };
      },
    },
  },
  "Ardor Celestial": {
    claves: ["Exhumar"],
    talisman: [
      {
        op: "modo",
        n: 2,
        hasta: true,
        opciones: [
          { texto: "Cancelar el ataque de los Aliados oponentes", pasos: [{ op: "fn", f: "cancelar" }] },
          {
            texto: "Desterrar una carta de coste 2 o menos",
            requiere: { de: ["todos:enJuego"], filtro: { costeMax: 2 }, para: "desterrar" },
            pasos: [sel(["todos:enJuego"], { costeMax: 2 }, "x", { para: "desterrar" }), mov("desterrar")],
          },
          { texto: "Barajar y/o Desterrar hasta cuatro cartas de los Cementerios y robar una", pasos: [...barajarYDesterrar(4), robar(1)] },
        ],
      },
    ],
    fns: {
      cancelar: (e, ctx) => cancelarAtaque(e, [...e.jugadores[N.rival(ctx.ctrl)].ataque]),
      resto: (e, ctx) => 4 - (ctx.vars.c ?? []).length,
    },
  },
  "Aringa Ora": {
    destierroAlJugar: true,
    talisman: [
      robar(3),
      {
        op: "modo",
        opciones: ["Talismán", "Arma", "Tótem", "Oro"].map((tipo) => ({ texto: `Nombrar ${tipo}`, pasos: [{ op: "fn", f: "nombrar", tipo }] })),
      },
    ],
    fns: {
      nombrar: (e, ctx, api, p) => {
        const ef = p.tipo === "Talismán" ? { tipo: "impuestoTalisman" } : { tipo: "impuestoTipo", tipoCarta: p.tipo };
        N.agregarEfecto(e, { ...ef, fin: "proximoTurno" }, N.rival(ctx.ctrl));
      },
    },
  },
  "Artilleria Pesada": {
    talisman: [{ op: "fn", f: "rellenar" }],
    fns: {
      rellenar: (e, ctx) => {
        N.robar(e, ctx.ctrl, Math.max(0, 8 - e.jugadores[ctx.ctrl].mano.length));
      },
    },
  },
  "Asalto Estelar": {
    talisman: [
      castilloElegido((quien) => [
        { op: "tope", quien, n: 11, como: "m" },
        sel(["var:m"], { zona: "castillo" }, "t", { n: 3 }),
        { op: "modo", opciones: [{ texto: "Destierro", pasos: [mov("desterrar", "t")] }, { texto: "Cementerio", pasos: [mov("cementerio", "t")] }] },
      ]),
      robar(1),
    ],
    activadas: [
      {
        texto: "Desterrarlo de tu Cementerio: Barajar hasta tres cartas de los Cementerios",
        zona: "cementerio",
        coste: [sel(["fuente"], {}, "yo"), mov("desterrar", "yo")],
        hacer: [sel(["todos:cementerio"], {}, "c", { n: 3, hasta: true }), mov("barajar", "c")],
      },
    ],
  },
  "Ascenso de Enoc": {
    talisman: [sel(["todos:enJuego"], { noTipo: ["Oro"], f: "sinHab" }), mov("barajar"), { op: "mostrarHasta", tipos: ["Aliado"], como: "m" }, mov("mano", "m")],
    fns: { sinHab: (e, ctx, u) => !N.activa(e, u) },
  },
  "Asimilar Materia": {
    unoPorTurno: true,
    orosMenos: "porOro",
    talisman: [robar(1), sel(["todos:aliados"], {}, "a", { n: 2, hasta: true }), efecto("a", { tipo: "gana", clave: "DanoAlDestierro" }, "turno")],
    fns: { porOro: (e, ctx) => N.orosDe(e, ctx.ctrl).length },
  },
  "Atacar al Vampiro": {
    claves: ["Exhumar"],
    talisman: [
      sel(["todos:enJuego"], {}, "c"),
      { op: "fn", f: "convertir" },
      sel(["rival:enJuego"], { costeMax: 2, noTipo: ["Arma"] }, "t", { para: "tomar" }),
      { op: "fn", f: "tomar" },
    ],
    fns: {
      convertir: (e, ctx) => {
        for (const u of ctx.vars.c ?? []) e.conv[u] = { tipo: N.carta(e, u).tipo, sinHabilidad: true };
      },
      tomar: (e, ctx) => {
        for (const u of ctx.vars.t ?? []) {
          if (!N.puedeTomar(e, u, ctx.ctrl)) continue;
          const loc = N.ubicar(e, u);
          N.mover(e, u, loc.zona === "ataque" ? "defensa" : loc.zona, { j: ctx.ctrl });
          e.atacantes = e.atacantes.filter((x) => x !== u);
          for (const p of e.jugadores) p.nuevos = p.nuevos.filter((x) => x !== u);
          if (N.carta(e, u).tipo === "Aliado") e.jugadores[ctx.ctrl].nuevos.push(u);
        }
      },
    },
  },
  "Ataque Bandido": {
    talisman: [
      {
        op: "modo",
        opciones: [
          { texto: "Buscar un Bandido en tu Castillo", pasos: buscar(["yo:castillo"], { tipo: "Aliado", f: "bandido" }) },
          {
            texto: "Jugar un Arma o Tótem de tu Cementerio o Destierro pagando su coste",
            requiere: { de: ["yo:cementerio", "yo:destierro"], filtro: { tipo: ["Arma", "Tótem"], f: "pagable" } },
            pasos: [sel(["yo:cementerio", "yo:destierro"], { tipo: ["Arma", "Tótem"], f: "pagable" }, "a"), { op: "fn", f: "jugarlo" }],
          },
        ],
      },
    ],
    activadas: [
      {
        texto: "Pagar un Oro y Desterrarlo de tu mano: un Arma o Tótem de coste 3 o menos pierde su habilidad y es Destruido",
        zona: "mano",
        oros: 1,
        requiere: { de: ["todos:enJuego"], filtro: { tipo: ["Arma", "Tótem"], costeMax: 3 } },
        coste: [sel(["fuente"], {}, "yo"), mov("desterrar", "yo")],
        hacer: [sel(["todos:enJuego"], { tipo: ["Arma", "Tótem"], costeMax: 3 }), efecto("x", { tipo: "pierdeHabilidad" }, "mientras"), mov("destruir")],
      },
    ],
    fns: {
      bandido: (e, ctx, u) => (N.carta(e, u).razas ?? []).includes("Bandido"),
      pagable: (e, ctx, u) => {
        const c = N.carta(e, u);
        if (c.tipo === "Arma" && !N.aliadosDe(e, ctx.ctrl).length) return false;
        return coste(e, u) <= disp(e, ctx.ctrl, c.tipo);
      },
      jugarlo: (e, ctx, api) => {
        const [u] = ctx.vars.a ?? [];
        if (!u) return [];
        return jugarPagando(e, ctx, api, u, coste(e, u), N.ubicar(e, u)?.zona ?? null);
      },
    },
  },
  "Ataque Feerico": {
    talisman: [
      { op: "mostrarHasta", n: 2, filtro: { tipo: "Aliado", costeMin: 2, costeMax: 2 }, distintoNombre: true, como: "m" },
      sel(["var:m"], { zona: "castillo" }, "j"),
      { op: "jugarGratis", var: "j" },
      { op: "fn", f: "resto" },
      mov("mano", "r"),
      barajar(),
    ],
    activadas: [
      {
        texto: "Desterrarlo de tu Cementerio: un Aliado pierde 2 de Fuerza permanentemente",
        zona: "cementerio",
        requiere: { de: ["todos:aliados"], filtro: {} },
        coste: [sel(["fuente"], {}, "yo"), mov("desterrar", "yo")],
        hacer: [sel(["todos:aliados"]), efecto("x", { tipo: "fuerza", n: -2 }, "mientras")],
      },
    ],
    fns: {
      resto: (e, ctx) => {
        ctx.vars.r = (ctx.vars.m ?? []).filter((u) => !(ctx.vars.j ?? []).includes(u) && N.ubicar(e, u)?.zona === "castillo");
      },
    },
  },
  "Aun Tenemos Patria": {
    talisman: [{ op: "botar", n: 3, quien: "rival" }, robar(2)],
  },
  Avaricia: {
    talisman: [
      sel(["yo:castillo"], { tipo: "Oro" }, "p", { n: 2 }),
      efecto("p", { tipo: "pierdeHabilidad" }, "turno"),
      { op: "ponerOro", var: "p", a: "pagado" },
      sel(["yo:castillo"], { tipo: "Oro" }, "m"),
      mov("mano", "m"),
      barajar(),
      { op: "si", f: "siete", entonces: [robar(2)] },
    ],
    disparadas: [{ zona: ["cementerio"], cuando: ["rivalPoneOro"], quien: "yo", opcional: true, hacer: [sel(["fuente"], {}, "yo"), mov("mano", "yo")] }],
    fns: { siete: (e, ctx) => N.orosDe(e, ctx.ctrl).length >= 7 },
  },
  "Aventuras de Sancho": {
    reduce: "red",
    talisman: [sel(["todos:enJuego"], { noTipo: ["Oro"] }, "x", { n: 999 }), efecto("x", { tipo: "pierdeHabilidad" }, "mientras"), mov("barajar")],
    fns: { red: (e, ctx) => N.enJuegoDe(e, ctx.ctrl).filter((u) => coste(e, u) >= 1).length },
  },
  Avistamientos: {
    talisman: [sel(["rival:mano"], { noTipo: ["Oro"] }), mov("barajar")],
  },
  "Bajo el Traiguen": {
    requiere: { de: ["rival:enJuego"], filtro: { costeMax: 2 } },
    talisman: [sel(["rival:enJuego"], { costeMax: 2 }), mov("barajar"), { op: "fn", f: "marcar" }],
    disparadas: [
      {
        zona: ["cementerio"],
        cuando: ["alCementerio"],
        quien: "propia",
        si: "recien",
        hacer: [{ op: "fn", f: "olvidar" }, sel(["fuente"], {}, "yo"), mov("barajar", "yo")],
      },
    ],
    fns: {
      marcar: (e, ctx) => {
        e.usos[`traiguen|${ctx.fuente}`] = e.turno;
      },
      recien: (e, ctx) => e.usos[`traiguen|${ctx.fuente}`] === e.turno,
      olvidar: (e, ctx) => {
        delete e.usos[`traiguen|${ctx.fuente}`];
      },
    },
  },
  "Bajo la Higuera": {
    talisman: [
      { op: "tope", quien: "rival", n: 1, como: "t" },
      sel(["var:t"], {}, "d", { quien: "rival", hasta: true }),
      { op: "si", f: "desterro", entonces: [{ op: "desterrarTope", n: 5, quien: "rival" }], sino: [robar(4)] },
    ],
    fns: { desterro: (e, ctx) => (ctx.vars.d ?? []).length > 0 },
  },
  "Bastón de la Bestia": {
    talisman: [],
    activadas: [
      {
        texto: "Pagar un Oro: subir un Aliado o Tótem de tu Cementerio a tu mano",
        zona: "mano",
        veces: "turno",
        oros: 1,
        requiere: { de: ["yo:cementerio"], filtro: { tipo: ["Aliado", "Tótem"] } },
        hacer: [sel(["yo:cementerio"], { tipo: ["Aliado", "Tótem"] }), mov("mano")],
      },
      {
        texto: "Sin Oros en Reserva, descartar una carta: cancelar el ataque de un Aliado o hasta tres Aliados ganan 1 de Fuerza",
        zona: "mano",
        momento: "talismanes",
        requiere: "sinReserva",
        coste: [sel(["yo:mano"], {}, "d"), mov("cementerio", "d")],
        hacer: [
          {
            op: "modo",
            opciones: [
              { texto: "Cancelar el ataque de un Aliado", requiere: { de: ["todos:ataque"], filtro: {} }, pasos: [sel(["todos:ataque"]), { op: "fn", f: "cancelar" }] },
              { texto: "Hasta tres Aliados ganan 1 de Fuerza", pasos: [sel(["todos:aliados"], {}, "f", { n: 3, hasta: true }), efecto("f", { tipo: "fuerza", n: 1 })] },
            ],
          },
        ],
      },
    ],
    fns: {
      sinReserva: (e, ctx) => e.jugadores[ctx.ctrl].reserva.length === 0,
      cancelar: (e, ctx) => cancelarAtaque(e, ctx.vars.x ?? []),
    },
  },
  "Batalla de Azincourt": {
    soloRespuesta: true,
    respuesta: { anula: { tipo: "Aliado", costeMax: 2 } },
  },
  "Batalla de Rancagua": {
    destierroAlJugar: true,
    talisman: [
      robar(2),
      sel(["todos:enJuego"], { f: "objetivo" }, "x", { hasta: true, para: "desterrar" }),
      mov("desterrar"),
      sel(["yo:enJuego"], {}, "r"),
      { op: "fn", f: "otorgar" },
    ],
    activadas: [
      {
        texto: "Una vez en tu turno: Barajar y/o Desterrar hasta tres cartas de los Cementerios",
        momento: "tuTurno",
        veces: "turno",
        hacer: barajarYDesterrar(3),
      },
    ],
    fns: {
      objetivo: (e, ctx, u) => {
        const c = N.carta(e, u);
        return c.tipo === "Tótem" || (c.tipo === "Aliado" && coste(e, u) <= 3);
      },
      otorgar: (e, ctx) => {
        for (const r of ctx.vars.r ?? []) e.ganadas[r] = [...(e.ganadas[r] ?? []), ctx.def];
      },
      resto: (e, ctx) => 3 - (ctx.vars.c ?? []).length,
    },
  },
  "Batalla de Trafalgar": {
    orosMenos: "porAliado",
    talisman: [sel(["rival:aliados"], { costeMax: 1 }, "x", { n: 3, hasta: true }), mov("mano")],
    fns: { porAliado: (e, ctx) => N.aliadosDe(e, N.rival(ctx.ctrl)).length },
  },
  "Bola de Fuego": {
    requiere: { de: ["todos:enJuego"], filtro: { noTipo: ["Oro"] }, para: "destruir" },
    talisman: [sel(["todos:enJuego"], { noTipo: ["Oro"] }, "x", { para: "destruir" }), mov("destruir")],
  },
  "Bomba Electrica": {
    talisman: [sel(["yo:aliados"], {}, "k"), sel(["rival:aliados"], {}, "k2", { quien: "rival" }), { op: "fn", f: "resto" }, mov("barajar", "r")],
    fns: {
      resto: (e, ctx) => {
        const quedan = [...(ctx.vars.k ?? []), ...(ctx.vars.k2 ?? [])];
        ctx.vars.r = [...N.aliadosDe(e, ctx.ctrl), ...N.aliadosDe(e, N.rival(ctx.ctrl))].filter((u) => !quedan.includes(u));
      },
    },
  },
  "Brujas de Belial": {
    requiere: { de: ["todos:aliados"], filtro: { costeMax: 2 } },
    talisman: [
      sel(["todos:aliados"], { costeMax: 2 }),
      efecto("x", { tipo: "gana", clave: "Indestructible" }, "proximoTurno"),
      efecto("x", { tipo: "debeAtacar" }, "turno"),
      efecto("x", { tipo: "noCambia" }, "proximoTurno"),
    ],
  },
  "Caceria de Brujas": {
    talisman: [sel(["rival:mano"], { tipo: "Talismán" }, "x", { n: 99 }), mov("cementerio")],
  },
};
