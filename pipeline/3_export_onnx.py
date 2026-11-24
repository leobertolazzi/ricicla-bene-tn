#!/usr/bin/env python3
"""Export the Vision Encoder (only) to compact ONNX for browser/PWA inference.

Default: google/siglip2-base-patch16-224 (Apache-2.0) quantized with 4-bit MatMulNBits
(~70 MB single-file ONNX, supported by onnxruntime-web WASM, < 100 MB GitHub/Vercel limit).
Optional presets: tinyclip-40m, tinyclip-8m (MIT).

Input:  `image`           float32 [1, 3, image_size, image_size] RGB in [0.0, 1.0]
Output: `image_embedding` float32 [1, D] L2-normalized unit vector
"""

from __future__ import annotations

import argparse
import shutil
from pathlib import Path

import numpy as np
import onnx
import onnxruntime as ort
import torch
from onnxruntime.quantization import QuantType, quantize_dynamic
from onnxruntime.quantization.matmul_nbits_quantizer import MatMulNBitsQuantizer
from PIL import Image
from transformers import AutoModel, AutoProcessor, CLIPModel, CLIPProcessor

ROOT = Path(__file__).resolve().parent.parent
ARTIFACTS_DIR = ROOT / "artifacts"

MODEL_PRESETS = {
    "siglip2-base": ("siglip2", "google/siglip2-base-patch16-224"),
    "tinyclip-40m": ("clip", "wkcn/TinyCLIP-ViT-40M-32-Text-19M-LAION400M"),
    "tinyclip-8m": ("clip", "wkcn/TinyCLIP-ViT-8M-16-Text-3M-YFCC15M"),
}


class NormalizedVisionEncoder(torch.nn.Module):
    """Takes RGB [B, 3, H, W] in [0, 1], applies model mean/std, outputs L2-normalized embedding."""

    def __init__(self, model, family: str, mean: tuple[float, ...], std: tuple[float, ...]):
        super().__init__()
        self.family = family
        self.vision_model = model.vision_model
        self.visual_projection = None if family == "siglip2" else model.visual_projection
        self.register_buffer("mean", torch.tensor(mean, dtype=torch.float32).view(1, 3, 1, 1))
        self.register_buffer("std", torch.tensor(std, dtype=torch.float32).view(1, 3, 1, 1))

    def forward(self, image: torch.Tensor) -> torch.Tensor:
        x = (image - self.mean) / self.std
        out = self.vision_model(pixel_values=x)
        feats = out.pooler_output if self.visual_projection is None else self.visual_projection(out.pooler_output)
        return feats / feats.norm(dim=-1, keepdim=True).clamp(min=1e-12)


def verify_onnx_parity(
    onnx_path: Path,
    model,
    processor,
    family: str,
    image_size: int,
    label: str,
) -> float:
    sess = ort.InferenceSession(str(onnx_path), providers=["CPUExecutionProvider"])
    rng = np.random.default_rng(42)
    cosines = []
    for _ in range(3):
        arr = rng.integers(0, 256, size=(image_size, image_size, 3), dtype=np.uint8)
        pil_img = Image.fromarray(arr, mode="RGB")

        with torch.no_grad():
            pt_pix = processor(images=pil_img, return_tensors="pt")["pixel_values"]
            vis_out = model.vision_model(pixel_values=pt_pix).pooler_output
            pt_emb = vis_out if family == "siglip2" else model.visual_projection(vis_out)
            pt_emb = (pt_emb / pt_emb.norm(dim=-1, keepdim=True)).squeeze(0).numpy()

        chw = arr.transpose(2, 0, 1).astype(np.float32) / 255.0
        ort_out = sess.run(["image_embedding"], {"image": chw[None, ...]})[0].reshape(-1)
        cos = float(np.dot(pt_emb, ort_out) / (np.linalg.norm(pt_emb) * np.linalg.norm(ort_out)))
        cosines.append(cos)

    min_cos = min(cosines)
    size_mb = onnx_path.stat().st_size / 1e6
    print(f"  [{label}] size={size_mb:.2f} MB | PyTorch vs ONNX cosine: min={min_cos:.6f}, all={[round(c, 6) for c in cosines]}")
    return min_cos


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--preset", choices=list(MODEL_PRESETS.keys()), default="siglip2-base")
    args = parser.parse_args()

    family, hf_id = MODEL_PRESETS[args.preset]
    print(f"Loading {hf_id} ({family})...")
    if family == "siglip2":
        model = AutoModel.from_pretrained(hf_id).eval()
        processor = AutoProcessor.from_pretrained(hf_id)
    else:
        model = CLIPModel.from_pretrained(hf_id).eval()
        processor = CLIPProcessor.from_pretrained(hf_id)

    ip = processor.image_processor
    image_size = int(ip.size.get("height") or ip.size.get("shortest_edge") or 224)
    mean = tuple(float(m) for m in ip.image_mean)
    std = tuple(float(s) for s in ip.image_std)
    print(f"Detected preprocess: size={image_size}x{image_size}, mean={mean}, std={std}")

    wrapper = NormalizedVisionEncoder(model, family, mean, std).eval()
    dummy = torch.rand(1, 3, image_size, image_size)

    ARTIFACTS_DIR.mkdir(parents=True, exist_ok=True)
    fp32_path = ARTIFACTS_DIR / "model_image_fp32.onnx"
    quant_path = ARTIFACTS_DIR / "model_image_quant.onnx"
    final_path = ARTIFACTS_DIR / "model_image.onnx"

    print("Exporting ONNX (FP32 single-file)...")
    with torch.no_grad():
        torch.onnx.export(
            wrapper,
            (dummy,),
            str(fp32_path),
            input_names=["image"],
            output_names=["image_embedding"],
            opset_version=18,
            do_constant_folding=True,
            external_data=False,
        )

    proto = onnx.load(str(fp32_path), load_external_data=True)
    onnx.save_model(proto, str(fp32_path), save_as_external_data=False)
    for ext in fp32_path.parent.glob(fp32_path.name + ".data*"):
        ext.unlink()

    verify_onnx_parity(fp32_path, model, processor, family, image_size, "ONNX FP32")

    if family == "siglip2":
        print("Quantizing SigLIP 2 to 4-bit (MatMulNBits, block_size=32)...")
        q4 = MatMulNBitsQuantizer(onnx.load(str(fp32_path)), block_size=32, is_symmetric=True, accuracy_level=4)
        q4.process()
        onnx.save_model(q4.model.model, str(quant_path), save_as_external_data=False)
        q_cos = verify_onnx_parity(quant_path, model, processor, family, image_size, "ONNX 4-bit")
        chosen = quant_path if q_cos >= 0.96 else fp32_path
    else:
        print("Quantizing TinyCLIP to INT8 (QUInt8 weights)...")
        quantize_dynamic(
            model_input=str(fp32_path),
            model_output=str(quant_path),
            weight_type=QuantType.QUInt8,
            op_types_to_quantize=["MatMul", "Gemm"],
        )
        q_cos = verify_onnx_parity(quant_path, model, processor, family, image_size, "ONNX INT8")
        chosen = quant_path if q_cos >= 0.985 else fp32_path

    shutil.copy2(chosen, final_path)
    print(f"Promoted {chosen.name} -> {final_path.name} ({final_path.stat().st_size / 1e6:.2f} MB)")


if __name__ == "__main__":
    main()
