import * as N from "../nucleo.js";
import { sel, mov, barajar, robar, efecto, buscar, castilloElegido, coste } from "../formato.js";
import { disponibles, hayObjetivo, impuestoSinPagar, pagarOros } from "../efectos.js";

const desterrarCementerio = (quien) => [sel([`${quien}:cementerio`], {}, "c", { n: 99 }), mov("desterrar", "c")];

const exorcismoCementerio = [
  {
    op: "modo",
    opciones: [
      { texto: "Desterrar tu Cementerio", pasos: desterrarCementerio("yo") },
      { texto: "Desterrar el Cementerio oponente", pasos: desterrarCementerio("rival") },
    ],
  },
];

const exorcismoCarta = [
  sel(["todos:enJuego"], {}, "h"),
  efecto("h", { tipo: "pierdeHabilidad" }, "mientras"),
  efecto("h", { tipo: "noAtacarBloquear" }, "mientras"),
];

const barajarYDesterrar = (n) => [
  sel(["todos:cementerio"], {}, "c", { n, hasta: true }),
  mov("barajar", "c"),
  sel(["todos:cementerio"], {}, "d", { nf: `resto${n}`, hasta: true }),
  mov("desterrar", "d"),
];

const resto = (n) => (e, ctx) => n - (ctx.vars.c ?? []).length;

const itemObjetivo = (e, ctx) => e.pila[ctx.objetivoPila];

const subirDelCementerio = [sel(["fuente"], {}, "yo"), mov("mano", "yo")];

const distintoDe = (v) => (e, ctx, u) => !(ctx.vars[v] ?? []).some((x) => N.carta(e, x).nombre === N.carta(e, u).nombre);

const tieneRaza = (raza) => (e, ctx) => N.aliadosDe(e, ctx.ctrl).some((a) => (N.carta(e, a).razas ?? []).includes(raza));

const costeSolar = (e, ctx, u) => Math.max(0, coste(e, u) - (ctx.vars.d ?? []).length);

const diluvio = (conAnular) => ({
  op: "modo",
  opciones: [
    ...(conAnular
      ? [
          {
            texto: "Anular una carta que no sea Aliado, Desterrarla y Desterrar tres cartas del tope de un Castillo",
            requiere: "anulable",
            pasos: [{ op: "fn", f: "reanular" }, castilloElegido((quien) => [{ op: "desterrarTope", quien, n: 3 }])],
          },
        ]
      : []),
    { texto: "Tu oponente Descarta dos cartas de su mano", pasos: [sel(["rival:mano"], {}, "m", { n: 2, quien: "rival" }), mov("cementerio", "m")] },
    {
      texto: "Cada jugador elige uno de sus Aliados y Baraja el resto",
      pasos: [sel(["yo:aliados"], {}, "k"), sel(["rival:aliados"], {}, "k2", { quien: "rival" }), { op: "fn", f: "barajarResto" }],
    },
  ],
});

export const HABILIDADES = {
  "Exorcismo de Carmen Marín": {
    talisman: [
      {
        op: "modo",
        opciones: [
          { texto: "Desterrar un Cementerio", pasos: exorcismoCementerio },
          { texto: "Una carta pierde su habilidad y no puede atacar ni bloquear", requiere: { de: ["todos:enJuego"], filtro: {} }, pasos: exorcismoCarta },
          { texto: "Botar dos cartas para elegir ambos efectos", requiere: "puedeBotar", pasos: [{ op: "botar", n: 2, quien: "yo" }, ...exorcismoCementerio, ...exorcismoCarta] },
          {
            texto: "Descartar una carta para elegir ambos efectos",
            requiere: "puedeDescartar",
            pasos: [sel(["yo:mano"], {}, "d"), mov("cementerio", "d"), ...exorcismoCementerio, ...exorcismoCarta],
          },
        ],
      },
    ],
    fns: {
      puedeBotar: (e, ctx) => e.jugadores[ctx.ctrl].castillo.length > 2,
      puedeDescartar: (e, ctx) => e.jugadores[ctx.ctrl].mano.length > 0,
    },
  },
  "Expulsar del Eden": {
    requiere: { de: ["rival:enJuego"], filtro: { costeMax: 2 } },
    talisman: [sel(["rival:enJuego"], { costeMax: 2 }), mov("barajar"), { op: "fn", f: "armar" }],
    disparadas: [{ zona: ["cementerio"], cuando: ["juega"], quien: "rival", si: "pendiente", hacer: [{ op: "fn", f: "silenciar" }] }],
    fns: {
      armar: (e, ctx) => {
        e.usos[`eden|${ctx.fuente}`] = true;
      },
      pendiente: (e, ctx) => !!e.usos[`eden|${ctx.fuente}`] && ["Aliado", "Tótem"].includes(ctx.datos.tipo),
      silenciar: (e, ctx) => {
        delete e.usos[`eden|${ctx.fuente}`];
        N.agregarEfecto(e, { tipo: "pierdeHabilidad", uid: ctx.datos.uid, fin: "proximoTurno" }, N.rival(ctx.ctrl));
      },
    },
  },
  "Expulsar el Mal": {
    soloRespuesta: true,
    respuesta: { anula: {}, pasos: [{ op: "fn", f: "exhumada" }] },
    fns: {
      exhumada: (e, ctx) => {
        const item = itemObjetivo(e, ctx);
        if (!item) return;
        if (!N.tiene(e, item.uid, "Exhumar")) {
          item.anulado = false;
          return;
        }
        item.destierro = true;
        if (coste(e, item.uid) >= 3) return [sel(["yo:mano"], {}, "m"), mov("desterrar", "m")];
      },
    },
  },
  Expulsion: {
    soloRespuesta: true,
    respuesta: { anula: {}, pasos: [{ op: "fn", f: "expulsar" }] },
    activadas: [
      {
        texto: "Desterrarla de tu Cementerio: una carta pierde su habilidad por el turno",
        zona: "cementerio",
        requiere: { de: ["todos:enJuego"], filtro: {} },
        coste: [sel(["fuente"], {}, "yo"), mov("desterrar", "yo")],
        hacer: [sel(["todos:enJuego"]), efecto("x", { tipo: "pierdeHabilidad" })],
      },
    ],
    fns: {
      expulsar: (e, ctx) => {
        const item = itemObjetivo(e, ctx);
        if (!item || N.carta(e, item.uid).tipo === "Talismán") return;
        item.anulado = false;
        N.agregarEfecto(e, { tipo: "pierdeHabilidad", uid: item.uid, fin: "turno" }, ctx.ctrl);
      },
    },
  },
  "Falso Profeta": {
    talisman: [{ op: "fn", f: "mostrar" }],
    fns: {
      mostrar: (e, ctx) => {
        const [u] = e.jugadores[ctx.ctrl].castillo;
        if (!u) return;
        if (N.carta(e, u).tipo !== "Aliado") {
          N.robar(e, ctx.ctrl, 1);
          return;
        }
        N.mover(e, u, "cementerio");
        N.quitarDelCastillo(e, N.rival(ctx.ctrl), 2, "cementerio");
        return [{ op: "opcional", texto: "Repetir el efecto", pasos: [{ op: "fn", f: "mostrar" }] }];
      },
    },
  },
  "Fantasma del Puente": {
    talisman: [...barajarYDesterrar(4), robar(2)],
    activadas: [{ texto: "Barajar este Talismán de tu Cementerio en tu Castillo", zona: "cementerio", momento: "vigilia", hacer: [sel(["fuente"], {}, "yo"), mov("barajar", "yo")] }],
    fns: { resto4: resto(4) },
  },
  "Fantasmas del Palacio": {
    requiere: { de: ["todos:enJuego"], filtro: {} },
    talisman: [
      {
        op: "modo",
        opciones: [
          { texto: "Barajar una carta de coste 3 o menos", requiere: { de: ["todos:enJuego"], filtro: { costeMax: 3 } }, pasos: [sel(["todos:enJuego"], { costeMax: 3 }), mov("barajar")] },
          { texto: "Pagar un Oro: Barajar una carta de cualquier coste", requiere: "puedePagar", pasos: [{ op: "pagar", n: 1 }, sel(["todos:enJuego"]), mov("barajar")] },
        ],
      },
    ],
    activadas: [
      {
        texto: "Pagar el coste de un Aliado de tu Cementerio: poner este Talismán en juego como una copia de ese Aliado",
        zona: "cementerio",
        requiere: "hayAliado",
        hacer: [sel(["yo:cementerio"], { tipo: "Aliado", f: "asequible", noFuente: true }, "a"), { op: "fn", f: "copiar" }],
      },
    ],
    fns: {
      puedePagar: (e, ctx) => e.jugadores[ctx.ctrl].reserva.length >= 1,
      asequible: (e, ctx, u) => coste(e, u) <= disponibles(e, ctx.ctrl, "Aliado"),
      hayAliado: (e, ctx) => hayObjetivo(e, ctx, { de: ["yo:cementerio"], filtro: { tipo: "Aliado", f: "asequible", noFuente: true } }),
      copiar: (e, ctx, api) => {
        const [a] = ctx.vars.a ?? [];
        if (!a || N.ubicar(e, ctx.fuente)?.zona !== "cementerio") return;
        const c = N.carta(e, a);
        api.pagarOros(e, ctx.ctrl, coste(e, a), "Aliado");
        e.conv[ctx.fuente] = { tipo: "Aliado", fuerza: c.fuerza, coste: c.coste, sinHabilidad: false, como: c.id };
        api.entrarEnJuego(e, ctx.fuente, ctx.ctrl, undefined, { pagado: true, desde: "cementerio" });
      },
    },
  },
  "Favor de la Corte": {
    requiere: { de: ["rival:enJuego"], filtro: { noTipo: ["Oro"] } },
    talisman: [sel(["rival:enJuego"], { noTipo: ["Oro"] }), mov("mano")],
  },
  "Fin de Travesia": {
    talisman: [{ op: "fn", f: "convertidas" }, mov("barajar")],
    fns: {
      convertidas: (e, ctx) => {
        ctx.vars.x = N.todoEnJuego(e).filter((u) => e.conv[u] && N.def(e, e.instancias[u]).tipo !== "Oro");
      },
    },
  },
  "Fision Nuclear": {
    destierroAlJugar: true,
  },
  "Flecha Ácida": {
    requiere: { de: ["rival:aliados"], filtro: { f: "debil" }, para: "destruir" },
    talisman: [sel(["rival:aliados"], { f: "debil" }, "x", { para: "destruir" }), mov("destruir"), robar(1)],
    fns: { debil: (e, ctx, u) => N.fuerza(e, u) <= 2 },
  },
  "Forma Canina": {
    destierroAlJugar: true,
    talisman: [robar(1), { op: "botar", nf: "conCoste", quien: "rival" }],
    activadas: [
      {
        texto: "Desterrar dos cartas de tu Cementerio: subir este Talismán de tu Cementerio a tu mano",
        zona: "cementerio",
        requiere: "dosMas",
        coste: [sel(["yo:cementerio"], { noFuente: true }, "c", { n: 2 }), mov("desterrar", "c")],
        hacer: subirDelCementerio,
      },
    ],
    fns: {
      conCoste: (e) => N.todoEnJuego(e).filter((u) => coste(e, u) >= 1).length,
      dosMas: (e, ctx) => e.jugadores[ctx.ctrl].cementerio.length >= 3,
    },
  },
  "Forma de Ataque": {
    talisman: [{ op: "desterrarTope", quien: "rival", nf: "suma" }, ...barajarYDesterrar(3), robar(3)],
    fns: {
      suma: (e, ctx) => N.enJuegoDe(e, ctx.ctrl).reduce((s, u) => s + coste(e, u), 0),
      resto3: resto(3),
    },
  },
  "Forma de Niebla": {
    requiere: { de: ["todos:aliados"], filtro: { costeMax: 2 } },
    talisman: [sel(["todos:aliados"], { costeMax: 2 }, "a"), { op: "fn", f: "quitarFuerza" }, sel(["todos:aliados"], {}, "b"), { op: "fn", f: "darFuerza" }],
    activadas: [
      {
        texto: "Destruir una carta que controles: jugar este Talismán sin pagar su coste",
        zona: "mano",
        requiere: "sinPagar",
        coste: [sel(["yo:enJuego"], {}, "s", { para: "destruir" }), mov("destruir", "s")],
        hacer: [{ op: "fn", f: "jugarSinPagar" }],
      },
    ],
    fns: {
      quitarFuerza: (e, ctx) => {
        const [a] = ctx.vars.a ?? [];
        ctx.vars.n = [a ? N.fuerza(e, a) : 0];
        if (!a) return;
        N.agregarEfecto(e, { tipo: "pierdeHabilidad", uid: a, fin: "mientras" }, ctx.ctrl);
        N.agregarEfecto(e, { tipo: "fuerza", uid: a, n: -ctx.vars.n[0], fin: "mientras" }, ctx.ctrl);
      },
      darFuerza: (e, ctx) => {
        const [b] = ctx.vars.b ?? [];
        const [n] = ctx.vars.n ?? [0];
        if (b && n) N.agregarEfecto(e, { tipo: "fuerza", uid: b, n, fin: "mientras" }, ctx.ctrl);
      },
      sinPagar: (e, ctx) =>
        hayObjetivo(e, ctx, { de: ["yo:enJuego"], filtro: {}, para: "destruir" }) &&
        hayObjetivo(e, ctx, { de: ["todos:aliados"], filtro: { costeMax: 2 } }) &&
        impuestoSinPagar(e, ctx.ctrl) <= disponibles(e, ctx.ctrl, "Talismán"),
      jugarSinPagar: (e, ctx) => {
        const j = ctx.ctrl;
        const uid = ctx.fuente;
        if (!e.jugadores[j].mano.includes(uid)) return;
        const imp = impuestoSinPagar(e, j);
        if (imp > disponibles(e, j, "Talismán")) return;
        pagarOros(e, j, imp, "Talismán");
        N.sacar(e, uid);
        N.disparar(e, "juega", { uid, j, tipo: "Talismán", pagado: false, desde: "mano" });
        e.pila.push({ uid, ctrl: j, coste: coste(e, uid), destierro: false, desde: "mano", cerrada: false, anulado: false });
      },
    },
  },
  "Fuego Purificador": {
    soloRespuesta: true,
  },
  "Fuego del Desierto": {
    requiere: { de: ["todos:aliados"], filtro: {}, para: "destruir" },
    talisman: [
      sel(["todos:aliados"], {}, "x", { para: "destruir" }),
      mov("destruir"),
      robar(1),
      { op: "fn", f: "quedarse" },
      sel(["fuente"], {}, "yo"),
      { op: "convertir", var: "yo", en: "Oro", a: "pagado" },
    ],
    fns: {
      quedarse: (e, ctx) => {
        const fr = e.cola.find((f) => f.ctx.fuente === ctx.fuente && f.pasos.some((p) => p.op === "finTalisman"));
        if (fr) fr.pasos = fr.pasos.filter((p) => p.op !== "finTalisman");
      },
    },
  },
  "Fuerza Estelar": {
    talisman: [
      {
        op: "modo",
        n: 3,
        hasta: true,
        opciones: [
          { texto: "Eterno: Robar tres cartas y Descartar una", requiere: "eterno", pasos: [robar(3), sel(["yo:mano"], {}, "d"), mov("cementerio", "d")] },
          { texto: "Faerie: Barajar Aliados cuyas Fuerzas sumen hasta 4", requiere: "faerie", pasos: [sel(["todos:aliados"], { f: "cabe" }, "f", { n: 99, hasta: true }), mov("barajar", "f")] },
          {
            texto: "Sacerdote: Buscar dos cartas de distinto nombre en cada Castillo y Desterrarlas",
            requiere: "sacerdote",
            pasos: [
              sel(["yo:castillo"], { f: "distinto1" }, "s1", { n: 2 }),
              mov("desterrar", "s1"),
              barajar(),
              sel(["rival:castillo"], { f: "distinto2" }, "s2", { n: 2 }),
              mov("desterrar", "s2"),
              barajar("rival"),
            ],
          },
        ],
      },
    ],
    fns: {
      eterno: tieneRaza("Eterno"),
      faerie: tieneRaza("Faerie"),
      sacerdote: tieneRaza("Sacerdote"),
      cabe: (e, ctx, u) => N.fuerza(e, u) + (ctx.vars.f ?? []).reduce((s, x) => s + N.fuerza(e, x), 0) <= 4,
      distinto1: distintoDe("s1"),
      distinto2: distintoDe("s2"),
    },
  },
  "Furia Berserker": {
    costeExtra: "enVigilia",
    talisman: [
      robar(2),
      sel(["yo:aliados"], {}, "a", { n: 2, hasta: true }),
      efecto("a", { tipo: "fuerza", n: 2 }),
      efecto("a", { tipo: "gana", clave: "Indestructible" }),
    ],
    fns: { enVigilia: (e, ctx) => (e.fase === "vigilia" && e.activo === ctx.ctrl ? 1 : 0) },
  },
  "Furia de Titán": {
    destierroAlJugar: true,
    requiere: { de: ["yo:aliados"], filtro: {} },
    talisman: [
      sel(["yo:aliados"], {}, "a"),
      {
        op: "si",
        f: "enAtaque",
        entonces: [efecto("a", { tipo: "noSale" }, "proximoTurno"), efecto("a", { tipo: "gana", clave: "DanoAlDestierro" }, "proximoTurno")],
      },
    ],
    fns: { enAtaque: (e, ctx) => (ctx.vars.a ?? []).some((u) => e.jugadores[ctx.ctrl].ataque.includes(u)) },
  },
  "Furia del Exilio": {
    talisman: [{ op: "fn", f: "exilio" }],
    fns: {
      exilio: (e, ctx) => {
        const r = N.rival(ctx.ctrl);
        const cem = [...e.jugadores[r].cementerio];
        for (const u of cem) N.mover(e, u, "destierro");
        const nOros = cem.filter((u) => N.carta(e, u).tipo === "Oro").length;
        if (nOros) N.quitarDelCastillo(e, r, 3 * nOros, "cementerio");
        if (cem.length < 6) return [{ op: "generar", n: 1, tipos: ["Aliado"] }];
      },
    },
  },
  "Garras de Balam": {
    talisman: [...buscar(["yo:castillo"], { tipo: "Oro" }, "pagado"), robar(1)],
    activadas: [{ texto: "Pagar dos Oros: subir este Talismán de tu Cementerio a tu mano", zona: "cementerio", oros: 2, hacer: subirDelCementerio }],
  },
  "Golpe Fulminante": {
    unoPorTurno: true,
    requiere: "puede",
    talisman: [sel(["yo:mano"], {}, "m"), mov("barajar", "m"), sel(["rival:mano"], { tipo: "Talismán" }, "t"), mov("desterrar", "t")],
    fns: {
      puede: (e, ctx) => {
        const p = e.jugadores[ctx.ctrl];
        return (p.jugadas.Aliado ?? 0) >= 1 && p.mano.length >= 2;
      },
    },
  },
  "Golpe Solar": {
    destierroAlJugar: true,
    talisman: [
      sel(["yo:mano"], {}, "d", { n: 2, hasta: true }),
      mov("cementerio", "d"),
      sel(["yo:mano", "yo:cementerio"], { tipo: "Aliado", f: "asequible" }, "a"),
      { op: "fn", f: "jugarAliado" },
      sel(["rival:enJuego"], { costeMax: 2 }, "b", { hasta: true }),
      mov("barajar", "b"),
    ],
    fns: {
      asequible: (e, ctx, u) => costeSolar(e, ctx, u) <= disponibles(e, ctx.ctrl, "Aliado"),
      jugarAliado: (e, ctx, api) => {
        const [uid] = ctx.vars.a ?? [];
        if (!uid) return;
        const desde = N.ubicar(e, uid)?.zona ?? "mano";
        api.pagarOros(e, ctx.ctrl, costeSolar(e, ctx, uid), "Aliado");
        N.disparar(e, "juega", { uid, j: ctx.ctrl, tipo: "Aliado", pagado: true, desde });
        return [{ op: "entrar", uid, datos: { pagado: true, desde } }];
      },
    },
  },
  "Gran Diluvio": {
    talisman: [diluvio(false)],
    respuesta: { anula: {}, pasos: [{ op: "fn", f: "revertir" }, diluvio(true)] },
    fns: {
      revertir: (e, ctx) => {
        const item = itemObjetivo(e, ctx);
        if (item) item.anulado = false;
      },
      anulable: (e, ctx) => {
        const item = itemObjetivo(e, ctx);
        return !!item && N.carta(e, item.uid).tipo !== "Aliado";
      },
      reanular: (e, ctx) => {
        const item = itemObjetivo(e, ctx);
        if (item) Object.assign(item, { anulado: true, destierro: true });
      },
      barajarResto: (e, ctx) => [
        sel(["yo:aliados"], { excluir: ctx.vars.k ?? [] }, "r1", { n: 99 }),
        mov("barajar", "r1"),
        sel(["rival:aliados"], { excluir: ctx.vars.k2 ?? [] }, "r2", { n: 99 }),
        mov("barajar", "r2"),
      ],
    },
  },
  "Gran Escape": {
    destierroAlJugar: true,
    claves: ["Imbloqueable", "DanoAlDestierro"],
    requiere: { de: ["yo:aliados"], filtro: { costeMin: 1 } },
    talisman: [sel(["yo:aliados"], { costeMin: 1 }, "a"), { op: "fn", f: "otorgar" }],
    activadas: [
      {
        texto: "Destruir una carta de coste 2 o menos",
        veces: "turno",
        requiere: { de: ["todos:enJuego"], filtro: { costeMax: 2 }, para: "destruir" },
        hacer: [sel(["todos:enJuego"], { costeMax: 2 }, "x", { para: "destruir" }), mov("destruir")],
      },
    ],
    fns: {
      otorgar: (e, ctx) => {
        for (const a of ctx.vars.a ?? []) e.ganadas[a] = [...(e.ganadas[a] ?? []), ctx.def];
      },
    },
  },
};
