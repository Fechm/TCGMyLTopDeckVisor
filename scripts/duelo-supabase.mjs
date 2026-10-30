const URL_BASE = "https://nzehvfrlbmltxfqkovtu.supabase.co/rest/v1/cartas";
const CLAVE = "sb_publishable_5v43J9mYq5wdC8hxRIduTA_yyzJBZ5n";

export const normalizar = (s) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]/g, "");

export async function traerImperio() {
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

export function ultimaEdicionPorNombre(filas) {
  const porNombre = new Map();
  for (const f of filas) {
    const k = normalizar(f.nombre);
    const actual = porNombre.get(k);
    if (!actual || f.edicion_id > actual.edicion_id) porNombre.set(k, f);
  }
  return porNombre;
}

export function cartaBase(f) {
  return {
    id: f.id,
    nombre: f.nombre,
    tipo: f.tipo,
    coste: f.coste ?? 0,
    fuerza: f.fuerza ?? 0,
    razas: f.razas ?? [],
    oroInicial: f.tipo === "Oro" && /oro inicial/i.test(f.habilidad ?? ""),
    sinHabilidad: !(f.habilidad ?? "").trim(),
    texto: (f.habilidad ?? "").replace(/\s+/g, " ").trim(),
  };
}
