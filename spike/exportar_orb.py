import json
import struct

import numpy as np

import orb
import reconocer as r

DESTINO = r.RAIZ / "web" / "orb"


def main():
    DESTINO.mkdir(exist_ok=True)
    for viejo in DESTINO.glob("*.bin"):
        viejo.unlink()
    meta = json.loads((r.RAIZ / "web" / "catalogo.json").read_text(encoding="utf-8"))
    rutas = orb.rutas_catalogo()
    total = 0
    for i, c in enumerate(meta["cartas"]):
        pts, des = orb.rasgos(r.leer(rutas[c["id"]]))
        n = 0 if des is None else len(des)
        coords = np.round(pts[:n] * 16).astype(np.uint16) if n else np.zeros((0, 2), np.uint16)
        datos = struct.pack("<H", n) + coords.tobytes() + (des.tobytes() if n else b"")
        (DESTINO / f"{i}.bin").write_bytes(datos)
        total += len(datos)
    print(len(meta["cartas"]), "cartas,", round(total / 1e6, 1), "MB")


if __name__ == "__main__":
    main()
