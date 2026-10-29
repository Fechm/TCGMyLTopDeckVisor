import { crearPartida, accionesLegales, aplicar } from "../web/duelo/motor.js";
import { MAZOS } from "../web/duelo/cartas-base.js";

const PARTIDAS = Number(process.argv[2] ?? 500);
const TOPE_ACCIONES = 20000;

function botAzar(semilla) {
  let s = semilla >>> 0;
  return (acciones) => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return acciones[s % acciones.length];
  };
}

const resumen = { victorias: { dragon: 0, caballero: 0 }, inicialGana: 0, errores: [], bucles: 0, turnos: [], acciones: [] };
const inicio = Date.now();

for (let i = 0; i < PARTIDAS; i++) {
  const elegir = botAzar(i * 7919 + 1);
  let e = crearPartida({ semilla: i + 1, mazos: [MAZOS.dragon, MAZOS.caballero] });
  let n = 0;
  try {
    while (e.ganador === null && n < TOPE_ACCIONES) {
      const legales = accionesLegales(e);
      if (!legales.length) throw new Error(`sin acciones en fase ${e.fase}`);
      e = aplicar(e, elegir(legales));
      n++;
    }
  } catch (err) {
    resumen.errores.push(`partida ${i + 1}: ${err.message}`);
    continue;
  }
  if (e.ganador === null) { resumen.bucles++; continue; }
  resumen.victorias[e.ganador === 0 ? "dragon" : "caballero"]++;
  if (e.ganador === e.inicial) resumen.inicialGana++;
  resumen.turnos.push(e.turno + 1);
  resumen.acciones.push(n);
}

const prom = (xs) => (xs.length ? (xs.reduce((a, b) => a + b, 0) / xs.length).toFixed(1) : "-");
const terminadas = resumen.turnos.length;
console.log(`Partidas: ${PARTIDAS}, con ganador: ${terminadas}, errores: ${resumen.errores.length}, bucles: ${resumen.bucles}`);
console.log(`Dragón ${resumen.victorias.dragon} / Caballero ${resumen.victorias.caballero}; gana quien empieza: ${resumen.inicialGana}`);
console.log(`Turnos prom ${prom(resumen.turnos)} (min ${Math.min(...resumen.turnos)}, max ${Math.max(...resumen.turnos)}); acciones prom ${prom(resumen.acciones)}`);
console.log(`Tiempo: ${((Date.now() - inicio) / 1000).toFixed(1)} s`);
resumen.errores.slice(0, 5).forEach((m) => console.log(m));
if (resumen.errores.length || resumen.bucles || terminadas !== PARTIDAS) process.exit(1);
