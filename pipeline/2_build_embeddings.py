#!/usr/bin/env python3
"""Build app-ready dictionary JSON and precomputed Float16 text embeddings.

Default model: google/siglip2-base-patch16-224 (Apache-2.0, multilingual IT+EN, 768-d).
Optional presets: tinyclip-40m, tinyclip-8m (MIT).

Outputs:
- artifacts/dictionary_trento.json
- artifacts/embeddings_trento_fp16.bin  (little-endian float16, row-major [N, D])
"""

from __future__ import annotations

import argparse
import json
from pathlib import Path

import numpy as np
import torch
from transformers import AutoModel, AutoProcessor, CLIPModel, CLIPProcessor

ROOT = Path(__file__).resolve().parent.parent
SCRAPED_PATH = ROOT / "data" / "trento_domestica.json"
ENRICHMENT_PATH = ROOT / "data" / "prompt_enrichment.json"
ARTIFACTS_DIR = ROOT / "artifacts"

MODEL_PRESETS = {
    "siglip2-base": {
        "family": "siglip2",
        "hf_id": "google/siglip2-base-patch16-224",
        "display_name": "SigLIP 2 Base",
        "license": "Apache-2.0",
        "image_size": 224,
        "softmax_temperature": 55.0,
    },
    "tinyclip-40m": {
        "family": "clip",
        "hf_id": "wkcn/TinyCLIP-ViT-40M-32-Text-19M-LAION400M",
        "display_name": "TinyCLIP-ViT-40M/32",
        "license": "MIT",
        "image_size": 224,
        "softmax_temperature": 25.0,
    },
    "tinyclip-8m": {
        "family": "clip",
        "hf_id": "wkcn/TinyCLIP-ViT-8M-16-Text-3M-YFCC15M",
        "display_name": "TinyCLIP-ViT-8M/16",
        "license": "MIT",
        "image_size": 224,
        "softmax_temperature": 25.0,
    },
}

EN_PROMPT_TEMPLATES = [
    "a photo of {}",
    "a close-up photo of {}",
    "a photo of {} on a table",
    "a photo of {} to recycle or throw away",
]

IT_PROMPT_TEMPLATES = [
    "foto di {}",
    "immagine di {}",
]

# Official Trento Domestica bin display metadata (verified against dolomitiambiente.it Guida alla raccolta)
BIN_METADATA = {
    1: {
        "short_label": "Carta",
        "color_hex": "#F4C430",
        "text_color_hex": "#1B2024",
        "sf_symbol": "newspaper.fill",
        "guidance_it": "Contenitore con coperchio giallo (raccolta porta a porta settimanale): inserire carta e cartoni sfusi e ripiegati.",
    },
    2: {
        "short_label": "CRM",
        "color_hex": "#64748B",
        "text_color_hex": "#FFFFFF",
        "sf_symbol": "building.2.fill",
        "guidance_it": "Conferire ai Centri Raccolta (CR) o al Centro Integrato di Dolomiti Ambiente sul territorio.",
    },
    3: {
        "short_label": "Ditta Spec.",
        "color_hex": "#C53030",
        "text_color_hex": "#FFFFFF",
        "sf_symbol": "exclamationmark.triangle.fill",
        "guidance_it": "Rifiuto speciale: rivolgersi a una ditta specializzata autorizzata.",
    },
    4: {
        "short_label": "Farmacia",
        "color_hex": "#0F766E",
        "text_color_hex": "#FFFFFF",
        "sf_symbol": "cross.case.fill",
        "guidance_it": "Conferire negli appositi contenitori presso le farmacie.",
    },
    5: {
        "short_label": "Imb. Leggeri",
        "color_hex": "#0284C7",
        "text_color_hex": "#FFFFFF",
        "sf_symbol": "waterbottle.fill",
        "guidance_it": "Sacchi semitrasparenti azzurri (raccolta porta a porta settimanale): solo imballaggi in plastica, alluminio, acciaio e cartoni per bevande, vuoti e ridotti di volume.",
    },
    6: {
        "short_label": "Organico",
        "color_hex": "#7B4F2C",
        "text_color_hex": "#FFFFFF",
        "sf_symbol": "leaf.fill",
        "guidance_it": "Contenitore con coperchio marrone (2 volte a settimana): usare esclusivamente gli appositi sacchetti in carta.",
    },
    7: {
        "short_label": "Residuo",
        "color_hex": "#1B4D3E",
        "text_color_hex": "#FFFFFF",
        "sf_symbol": "trash.fill",
        "guidance_it": "Contenitore con coperchio verde scuro (tariffa puntuale, settimanale): utilizzare qualsiasi tipo di sacchetto per il secco non riciclabile.",
    },
    8: {
        "short_label": "Vetro",
        "color_hex": "#78C850",
        "text_color_hex": "#13260D",
        "sf_symbol": "wineglass.fill",
        "guidance_it": "Contenitore con coperchio verde chiaro (ogni 2 settimane): bottiglie e vasetti sfusi e vuoti, senza tappi metallici.",
    },
}


def encode_prompts(model, processor, family: str, prompts: list[str], device: str) -> torch.Tensor:
    if family == "siglip2":
        toks = processor(
            text=prompts,
            padding="max_length",
            max_length=64,
            truncation=True,
            return_tensors="pt",
        ).to(device)
        out = model.get_text_features(input_ids=toks["input_ids"])
        return out.pooler_output if hasattr(out, "pooler_output") else out
    toks = processor(text=prompts, return_tensors="pt", padding=True, truncation=True).to(device)
    text_out = model.text_model(**toks)
    return model.text_projection(text_out.pooler_output)


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--preset", choices=list(MODEL_PRESETS.keys()), default="siglip2-base")
    args = parser.parse_args()

    preset = MODEL_PRESETS[args.preset]
    hf_id = preset["hf_id"]
    family = preset["family"]

    scraped = json.loads(SCRAPED_PATH.read_text(encoding="utf-8"))
    enrichment: dict[str, list[str]] = json.loads(ENRICHMENT_PATH.read_text(encoding="utf-8"))

    items = scraped["items"]
    missing = [str(it["id"]) for it in items if str(it["id"]) not in enrichment]
    if missing:
        print(
            f"WARNING: {len(missing)} item(s) missing from prompt_enrichment.json ({missing[:5]}); "
            "falling back to raw Italian name."
        )

    print(f"Loading {hf_id} ({preset['license']} license)...")
    device = "mps" if torch.backends.mps.is_available() else "cpu"
    if family == "siglip2":
        model = AutoModel.from_pretrained(hf_id).to(device).eval()
        processor = AutoProcessor.from_pretrained(hf_id)
    else:
        model = CLIPModel.from_pretrained(hf_id).to(device).eval()
        processor = CLIPProcessor.from_pretrained(hf_id)

    embeddings_list: list[np.ndarray] = []
    app_items = []

    print(f"Encoding {len(items)} dictionary items with prompt ensembling on {device}...")
    with torch.no_grad():
        for idx, it in enumerate(items):
            item_id = it["id"]
            phrases = enrichment.get(str(item_id), [it["name_it"]])
            prompts = [tpl.format(phrase) for phrase in phrases for tpl in EN_PROMPT_TEMPLATES]
            if family == "siglip2":
                # SigLIP 2 is natively multilingual, so include Italian Riciclabolario prompts too
                prompts.extend(tpl.format(it["name_it"]) for tpl in IT_PROMPT_TEMPLATES)

            feats = encode_prompts(model, processor, family, prompts, device)
            feats = feats / feats.norm(dim=-1, keepdim=True)
            mean_feat = feats.mean(dim=0)
            mean_feat = mean_feat / mean_feat.norm(dim=-1, keepdim=True)
            embeddings_list.append(mean_feat.cpu().numpy().astype(np.float32))

            bin_id = it["bin_ids"][0]
            bin_label = it["bins"][0]
            app_items.append(
                {
                    "index": idx,
                    "id": item_id,
                    "name_it": it["name_it"],
                    "bin_id": bin_id,
                    "bin_label": bin_label,
                    "prompts_en": phrases,
                }
            )

    emb_matrix = np.stack(embeddings_list, axis=0)
    emb_fp16 = emb_matrix.astype("<f2")

    norms = np.linalg.norm(emb_fp16.astype(np.float32), axis=1)
    print(
        f"Embedding matrix shape: {emb_fp16.shape}, dtype: {emb_fp16.dtype}, "
        f"norm min={norms.min():.4f} max={norms.max():.4f}"
    )

    bins_out = []
    for b in scraped["bins"]:
        bid = b["id"]
        meta = BIN_METADATA[bid]
        bins_out.append(
            {
                "id": bid,
                "label": b["label"],
                "short_label": meta["short_label"],
                "color_hex": meta["color_hex"],
                "text_color_hex": meta["text_color_hex"],
                "source_color_hex": b.get("color_hex"),
                "sf_symbol": meta["sf_symbol"],
                "guidance_it": meta["guidance_it"],
            }
        )

    dict_out = {
        "schema_version": 3,
        "comune": scraped["comune"],
        "utenza": scraped["utenza"],
        "source_url": scraped["source_url"],
        "pdf_url": scraped.get("pdf_url"),
        "scraped_at": scraped["scraped_at"],
        "model_name": preset["display_name"],
        "model_hf_id": hf_id,
        "model_license": preset["license"],
        "image_size": preset["image_size"],
        "softmax_temperature": preset["softmax_temperature"],
        "embedding_dim": int(emb_fp16.shape[1]),
        "item_count": len(app_items),
        "bins": bins_out,
        "items": app_items,
    }

    ARTIFACTS_DIR.mkdir(parents=True, exist_ok=True)
    emb_path = ARTIFACTS_DIR / "embeddings_trento_fp16.bin"
    dict_path = ARTIFACTS_DIR / "dictionary_trento.json"

    emb_fp16.tofile(emb_path)
    dict_path.write_text(json.dumps(dict_out, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

    print(f"Wrote {emb_path} ({emb_path.stat().st_size / 1024:.1f} KB)")
    print(f"Wrote {dict_path} ({dict_path.stat().st_size / 1024:.1f} KB)")


if __name__ == "__main__":
    main()
