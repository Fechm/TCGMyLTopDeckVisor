import json
import shutil

import numpy as np

import multirecorte as mr
import reconocer as r

DESTINO = r.RAIZ / "web"
TIPOS = {"1": "Aliado", "2": "Talismán", "3": "Arma", "4": "Tótem", "5": "Oro"}

cartas = json.loads((r.RAIZ / "datos" / "cartas-imperio.json").read_text(encoding="utf-8"))
ruta_nombres = r.RAIZ / "datos" / "nombres.json"
nombres = json.loads(ruta_nombres.read_text(encoding="utf-8")) if ruta_nombres.exists() else {}
ediciones = {e["slug"]: e["title"].replace("IMP - ", "") for e in json.loads((r.RAIZ / "datos" / "ediciones.json").read_text(encoding="utf-8"))}
catalogos = json.loads((r.RAIZ / "datos" / "catalogos.json").read_text(encoding="utf-8"))
razas = {x["id"]: x["name"] for x in catalogos["races"]}

refs = [(c, r.IMAGENES / f"{c['ed_edid']}-{c['edid']}.jpg") for c in cartas]
ruta_especiales = r.RAIZ / "datos" / "especiales.json"
for c in json.loads(ruta_especiales.read_text(encoding="utf-8")) if ruta_especiales.exists() else []:
    nombres[c["id"]] = c["name"]
    ediciones[c["ed_slug"]] = c["ed_titulo"]
    refs.append((c, r.RAIZ / "datos" / "especiales" / f"{c['id']}.jpg"))
refs = [(c, p) for c, p in refs if p.exists()]
f = r.metodos(r.Embedder())["cnn_carta+arte"]
base = f([r.leer(p) for _, p in refs]).astype(np.float32)

escala = np.abs(base).max(axis=1, keepdims=True) / 127
q = np.round(base / escala).astype(np.int8)
reconstruida = q.astype(np.float32) * escala
rng = np.random.default_rng(4)
idx = rng.choice(len(refs), 150, replace=False)
fotos = [mr.foto_telefono(r.leer(refs[i][1]), rng, False) for i in idx]
iguales = 0
for foto in fotos:
    e = f(mr.recortes(foto))
    iguales += int(np.argmax((e @ base.T).max(0))) == int(np.argmax((e @ reconstruida.T).max(0)))
print(f"int8 coincide con float32 en {iguales}/{len(fotos)} fotos")

q.tofile(DESTINO / "referencias.bin")
escala.astype(np.float32).tofile(DESTINO / "escalas.bin")
shutil.copy(r.MODELO, DESTINO / "modelo.onnx")
meta = {
    "dim": base.shape[1],
    "arte": r.ARTE,
    "escalas": mr.ESCALAS,
    "cartas": [
        {
            "id": c["id"],
            "nombre": nombres.get(c["id"]) or c["name"].title(),
            "edicion": ediciones.get(c["ed_slug"], c["ed_slug"]),
            "tipo": TIPOS.get(c["type"], ""),
            "coste": c["cost"],
            "fuerza": c["damage"],
            "raza": razas.get(c["race"], "") if c["type"] == "1" else "",
        }
        for c, _ in refs
    ],
}
(DESTINO / "catalogo.json").write_text(json.dumps(meta, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
print(len(refs), "cartas exportadas")
