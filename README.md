# TCGMyL Top Deck Visor

Escanea tus cartas de Mitos y Leyendas (formato Imperio) con la cámara del teléfono y arma el mejor mazo Dragón con lo que tienes.

## Escáner (`web/`)

Es un sitio estático para Cloudflare Pages: el directorio de salida es `web`, sin build.

1. Sacas una foto de la carta o eliges varias de la galería.
2. El navegador la compara contra las imágenes oficiales de las cartas vigentes en Imperio, con un MobileNetV2 en ONNX que corre en onnxruntime-web.
3. Prueba varios recortes de la foto y te muestra las 5 cartas más parecidas.
4. Confirmas la correcta y queda en tu colección, guardada en el navegador.

Con fotos sintéticas acierta en primera opción el 98% de las fotos normales y el 90% de las difíciles (reflejo, desenfoque, un dedo encima).

Para regenerar los archivos del sitio:

```bash
python descargar.py
python spike/descargar_imagenes.py
python spike/preparar_modelo.py
python spike/exportar_escaner.py
```

## Optimizador de mazo

1. `python descargar.py`: baja desde api.myl.cl las cartas de las ediciones IMP vigentes (`datos/`).
2. `python optimizar.py --iteraciones 4000 --sim 300 --semilla 1`: arma el mazo y escribe `mazo-dragon-semillaN.md`.

Archivos que puedes editar:
- `banlist.json`: prohibidas y limitadas (blog.myl.cl, actualización 12/10/26).
- `valoraciones.json`: puntaje manual 0-10 que reemplaza al automático. Aquí entra tu experiencia de juego.

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

Son las pruebas de reconocimiento:
- `reconocer.py`: compara métodos.
- `mejoras.py`: prueba promediar varios cuadros y reordenar con ORB.
- `multirecorte.py`: prueba el recorte automático.
