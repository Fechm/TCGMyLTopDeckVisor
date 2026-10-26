import sys
import urllib.request
from pathlib import Path

import onnx

MODELOS = Path(__file__).parent / "modelos"
URL = "https://media.githubusercontent.com/media/onnx/models/main/validated/vision/classification/mobilenet/model/mobilenetv2-12.onnx"


def main():
    MODELOS.mkdir(exist_ok=True)
    original = MODELOS / "mobilenetv2-12.onnx"
    if not original.exists():
        urllib.request.urlretrieve(URL, original)
    m = onnx.load(original)
    m.graph.node.remove(m.graph.node[-1])
    del m.graph.output[:]
    m.graph.output.append(onnx.helper.make_tensor_value_info("472", onnx.TensorProto.FLOAT, ["batch_size", 1280]))
    for nombre in ("classifier.1.weight", "classifier.1.bias"):
        m.graph.initializer.remove(next(i for i in m.graph.initializer if i.name == nombre))
    onnx.checker.check_model(m)
    salida = MODELOS / "mobilenetv2-emb.onnx"
    onnx.save(m, salida)
    if "--q8" in sys.argv:
        from onnxruntime.quantization import QuantType, quantize_dynamic
        from onnxruntime.quantization.shape_inference import quant_pre_process
        pre = MODELOS / "mobilenetv2-emb-pre.onnx"
        quant_pre_process(str(salida), str(pre))
        quantize_dynamic(str(pre), str(MODELOS / "mobilenetv2-emb-q8.onnx"), weight_type=QuantType.QUInt8)
    print("listo:", sorted(p.name for p in MODELOS.glob("*.onnx")))


if __name__ == "__main__":
    main()
