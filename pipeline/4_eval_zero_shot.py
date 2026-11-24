#!/usr/bin/env python3
"""Evaluate zero-shot Top-K recycling retrieval on local images using the exported ONNX model.

Usage:
  pipeline/.venv/bin/python pipeline/4_eval_zero_shot.py path/to/photo.jpg --top-k 10
"""

from __future__ import annotations

import argparse
import json
import time
from pathlib import Path

import numpy as np
import onnxruntime as ort
from PIL import Image, ImageOps

ROOT = Path(__file__).resolve().parent.parent
ARTIFACTS_DIR = ROOT / "artifacts"


def center_crop_square(img: Image.Image, size: int) -> Image.Image:
    """Match CLIP Resize(shortest=size) + CenterCrop(size)."""
    img = ImageOps.exif_transpose(img).convert("RGB")
    w, h = img.size
    scale = size / min(w, h)
    new_w, new_h = int(round(w * scale)), int(round(h * scale))
    img = img.resize((new_w, new_h), Image.Resampling.BILINEAR)
    left = (new_w - size) // 2
    top = (new_h - size) // 2
    return img.crop((left, top, left + size, top + size))


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("images", nargs="+", type=Path, help="One or more image paths to classify")
    parser.add_argument("--top-k", type=int, default=10)
    args = parser.parse_args()

    dictionary = json.loads((ARTIFACTS_DIR / "dictionary_trento.json").read_text(encoding="utf-8"))
    dim = dictionary["embedding_dim"]
    image_size = int(dictionary.get("image_size", 224))
    items = dictionary["items"]
    emb_matrix = np.fromfile(ARTIFACTS_DIR / "embeddings_trento_fp16.bin", dtype="<f2").reshape(len(items), dim).astype(np.float32)

    model_path = ARTIFACTS_DIR / "model_image.onnx"
    print(f"Loading ONNX model ({dictionary.get('model_name')}): {model_path}")
    sess = ort.InferenceSession(str(model_path), providers=["CPUExecutionProvider"])

    for img_path in args.images:
        img = center_crop_square(Image.open(img_path), size=image_size)
        t0 = time.perf_counter()
        arr = np.asarray(img, dtype=np.float32) / 255.0
        chw = arr.transpose(2, 0, 1)[None, ...]
        vec = sess.run(["image_embedding"], {"image": chw})[0].reshape(-1)
        dt_ms = (time.perf_counter() - t0) * 1000.0

        scores = emb_matrix @ vec
        top_idx = np.argsort(scores)[::-1][: args.top_k]

        print(f"\n=== {img_path.name} ({dt_ms:.1f} ms) ===")
        for rank, idx in enumerate(top_idx, start=1):
            it = items[int(idx)]
            print(f"  {rank}. [{scores[idx]:.3f}] {it['name_it']}  -->  {it['bin_label']}")


if __name__ == "__main__":
    main()
