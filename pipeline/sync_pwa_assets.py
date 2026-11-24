#!/usr/bin/env python3
"""Copy generated ML artifacts into web/assets/ and render PWA Home Screen icons from docs/app_icon.svg."""

from __future__ import annotations

import shutil
import subprocess
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
ARTIFACTS = ROOT / "artifacts"
DOCS = ROOT / "docs"
WEB_ASSETS = ROOT / "web" / "assets"
WEB_ICONS = ROOT / "web" / "icons"


def render_icons() -> None:
    svg_path = DOCS / "app_icon.svg"
    rsvg = shutil.which("rsvg-convert")
    if rsvg and svg_path.exists():
        for size in (180, 192, 512):
            out_path = WEB_ICONS / f"icon-{size}.png"
            subprocess.run([rsvg, "-w", str(size), "-h", str(size), str(svg_path), "-o", str(out_path)], check=True)
            print(f"Rendered {out_path} ({size}x{size}) from {svg_path.name}")
        out_1024 = DOCS / "app_icon_1024.png"
        subprocess.run([rsvg, "-w", "1024", "-h", "1024", str(svg_path), "-o", str(out_1024)], check=True)
        print(f"Rendered {out_1024} (1024x1024)")
    else:
        print("Skipping icon re-render (rsvg-convert not found; keeping existing PNG icons in web/icons/).")


def main() -> None:
    WEB_ASSETS.mkdir(parents=True, exist_ok=True)
    WEB_ICONS.mkdir(parents=True, exist_ok=True)

    for old_name in ("mobileclip2_s0_image.onnx", "tinyclip_image.onnx"):
        legacy = WEB_ASSETS / old_name
        if legacy.exists():
            legacy.unlink()

    for filename in ("dictionary_trento.json", "embeddings_trento_fp16.bin", "model_image.onnx"):
        src = ARTIFACTS / filename
        dst = WEB_ASSETS / filename
        if not src.exists():
            raise FileNotFoundError(f"Missing artifact: {src}")
        shutil.copy2(src, dst)
        size = dst.stat().st_size
        unit = "MB" if size >= 1000 * 1000 else "KB"
        val = size / 1e6 if unit == "MB" else size / 1024
        print(f"Copied {src.name} -> {dst} ({val:.2f} {unit})")

    render_icons()


if __name__ == "__main__":
    main()
