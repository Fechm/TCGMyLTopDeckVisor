# TCGMyL Top Deck Visor

Escanea tus cartas de Mitos y Leyendas (formato Imperio) con la cámara del teléfono, guárdalas en tu Top Deck digital y arma el mejor mazo Dragón con lo que tienes.

Datos e imágenes de cartas: [Códice TCG](https://codicetcg.org) (Imperio vigente, incluida Drácula: Rey Vampiro). Mitos y Leyendas es marca de sus respectivos dueños.

## Sitio (`web/`)

Es un sitio estático para Cloudflare Pages: el directorio de salida es `web`, sin build.

- **Escanear (`index.html`):** escáner continuo con la cámara.
  - Reconoce la carta en el marco con un MobileNetV2 en ONNX (onnxruntime-web).
  - Cuando la red duda, confirma con puntos ORB (OpenCV.js).
  - La registra sola y suma copias.
  - Tiene botón «Foil» y, en forma opcional, sugerencia «parece foil» midiendo el cambio de color al inclinar la carta.
- **Mi Top Deck (`topdeck.html`):** tu colección como carpeta, con filtros, y un visor 3D con inclinación por dedo o giroscopio, reflejo, holográfico para las foil y reverso.

La colección se guarda en el navegador (`localStorage`).

Para regenerar los archivos del sitio:

```bash
python descargar_codice.py
python spike/preparar_modelo.py
python spike/exportar_codice.py
```

## Optimizador de mazo

1. `python descargar_codice.py`: baja las cartas de la temporada vigente de Imperio, la banlist (que reescribe `banlist.json`) y las imágenes (`datos/`).
2. `python optimizar.py --iteraciones 4000 --sim 300 --semilla 1`: arma el mazo y escribe `mazo-dragon-semillaN.md`.

Archivos que puedes editar:
- `valoraciones.json`: puntaje manual 0-10 que reemplaza al automático. Aquí entra tu experiencia de juego.
- `banlist.json`: se regenera desde Códice en cada descarga.

El puntaje de cada mazo combina:
- **Calidad** (50%): promedio del puntaje de sus cartas.
- **Velocidad** (30%): turno promedio en que gana contra un rival que no hace nada.
- **Consistencia** (20%): aliado jugado al turno 2, Oro todos los turnos del 1 al 4, manos sin cartas muertas.

Respeta las reglas del Documento Actualizado de Reglas (abril 2026):
- **Mazo:** 50 cartas, máximo 3 copias.
- **Imperio Racial:** aliados de una sola raza, con hasta 4 sin raza, y al menos 17 entre Aliados, Armas y Tótems.
- **Partida:** Oro Inicial, mulligan gratis con 0 o 1 Oro, coste mínimo 1 y límite de 8 cartas en mano.

Lo que la simulación no modela: bloqueos y respuestas del rival, Anular, cementerio y la mayoría de las habilidades activadas.

## Carpeta `spike/`

Son las pruebas y calibraciones:
- `reconocer.py`, `mejoras.py` y `multirecorte.py`: métodos de reconocimiento.
- `orb.py`: verificación por dibujo.
- `calibrar.py`: umbrales de registro.
- `foil.py` y `foil_vivo.py`: detección de foil con videos reales.

`descargar.py` y `wiki_especiales.py` son las fuentes anteriores (api.myl.cl y la wiki), reemplazadas por Códice.
