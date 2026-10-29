import { readFileSync, writeFileSync } from "node:fs";

const URL_BASE = "https://nzehvfrlbmltxfqkovtu.supabase.co/rest/v1/cartas";
const CLAVE = "sb_publishable_5v43J9mYq5wdC8hxRIduTA_yyzJBZ5n";

const normalizar = (s) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]/g, "");

const mazosFuente = {
  dragon: JSON.parse(readFileSync("datos/meta/mazo-felipe.json", "utf8")),
  caballero: JSON.parse(readFileSync("datos/meta/mazo-basico-caballero.json", "utf8")),
};

async function traerImperio() {
  const filas = [];
  for (let desde = 0; ; desde += 1000) {
    const r = await fetch(`${URL_BASE}?select=id,nombre,tipo,coste,fuerza,razas,habilidad,edicion_id&bloque=eq.IMP&order=id`, {
      headers: { apikey: CLAVE, Range: `${desde}-${desde + 999}` },
    });
    const lote = await r.json();
    filas.push(...lote);
    if (lote.length < 1000) break;
  }
  return filas;
}

const filas = await traerImperio();
const porNombre = new Map();
for (const f of filas) {
  const k = normalizar(f.nombre);
  const actual = porNombre.get(k);
  if (!actual || f.edicion_id > actual.edicion_id) porNombre.set(k, f);
}

const cartas = {};
const mazos = {};
const faltan = [];
for (const [mazo, lista] of Object.entries(mazosFuente)) {
  mazos[mazo] = [];
  for (const [nombre, copias] of Object.entries(lista)) {
    const f = porNombre.get(normalizar(nombre));
    if (!f) { faltan.push(nombre); continue; }
    cartas[f.id] = {
      id: f.id,
      nombre: f.nombre,
      tipo: f.tipo,
      coste: f.coste ?? 0,
      fuerza: f.fuerza ?? 0,
      razas: f.razas ?? [],
      oroInicial: f.tipo === "Oro" && /oro inicial/i.test(f.habilidad ?? ""),
      sinHabilidad: !(f.habilidad ?? "").trim(),
    };
    for (let i = 0; i < copias; i++) mazos[mazo].push(f.id);
  }
}

if (faltan.length) {
  console.error("Sin datos:", faltan.join(", "));
  process.exit(1);
}

const salida = `export const CARTAS = ${JSON.stringify(cartas, null, 1)};\n\nexport const MAZOS = ${JSON.stringify(mazos)};\n`;
writeFileSync("web/duelo/cartas-base.js", salida);
console.log(`${Object.keys(cartas).length} cartas; dragon ${mazos.dragon.length}, caballero ${mazos.caballero.length}`);
