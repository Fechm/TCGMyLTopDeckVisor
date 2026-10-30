import { crearPartida, accionesLegales, aplicar, jugadorQueDecide } from "../web/duelo/motor.js";
import { CATALOGO, MAZOS } from "../web/duelo/cartas.js";
import * as N from "../web/duelo/nucleo.js";

export { accionesLegales, aplicar, jugadorQueDecide, N, CATALOGO };

const ID = new Map(Object.values(CATALOGO).map((c) => [c.nombre, c.id]));

export function id(nombre) {
  if (!ID.has(nombre)) throw new Error(`carta desconocida: ${nombre}`);
  return ID.get(nombre);
}

export function mesa({ semilla = 1, castillo = 30 } = {}) {
  let e = crearPartida({ semilla, mazos: [MAZOS.dragon, MAZOS.caballero], inicial: 0 });
  e = aplicar(e, { tipo: "quedarse" });
  e = aplicar(e, { tipo: "quedarse" });
  e = { ...structuredClone({ ...e, catalogo: null }), catalogo: e.catalogo };
  for (const p of e.jugadores) {
    for (const z of ["mano", "reserva", "pagado", "defensa", "ataque", "apoyo", "cementerio", "destierro", "nuevos"]) p[z] = [];
    p.castillo = [];
  }
  e.armas = {};
  e.turno = 1;
  for (const j of [0, 1]) for (let i = 0; i < castillo; i++) poner(e, j, "castillo", "Drácula");
  return e;
}

let contador = 0;
export function poner(e, j, zona, nombre, { portador } = {}) {
  const uid = `${j}-t${contador++}`;
  e.instancias[uid] = id(nombre);
  if (zona === "arma") (e.armas[portador] ??= []).push(uid);
  else e.jugadores[j][zona].push(uid);
  return uid;
}

export function oros(e, j, n) {
  return Array.from({ length: n }, () => poner(e, j, "reserva", "Drácula"));
}

export function opciones(e) {
  return e.pendiente?.opciones ?? [];
}

export function elegir(e, pred) {
  const i = e.pendiente.opciones.findIndex((o) => (typeof pred === "function" ? pred(o.valor, o) : o.valor === pred || o.texto === pred));
  if (i < 0) throw new Error(`opción no encontrada entre ${JSON.stringify(e.pendiente.opciones)}`);
  return aplicar(e, { tipo: "elegir", i });
}

export function hacer(e, accion, ...elecciones) {
  e = aplicar(e, accion);
  for (const pred of elecciones) e = elegir(e, pred);
  return e;
}

export function sinRespuesta(e) {
  while (!e.pendiente && e.pila.length && !e.pila.at(-1).cerrada) e = aplicar(e, { tipo: "noResponder" });
  return e;
}

export function pasarHasta(e, fase) {
  for (let i = 0; i < 50 && e.fase !== fase && e.ganador === null; i++) {
    if (e.pendiente) e = aplicar(e, { tipo: "elegir", i: e.pendiente.opciones.length - 1 });
    else {
      const l = accionesLegales(e);
      const a = l.find((x) => ["terminar", "pasar", "noResponder", "finAtaque", "finBloqueo", "quedarse"].includes(x.tipo)) ?? l[0];
      e = aplicar(e, a);
    }
  }
  return e;
}

export function zonaDe(e, uid) {
  return N.ubicar(e, uid)?.zona ?? null;
}
