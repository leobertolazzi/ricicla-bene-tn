#!/usr/bin/env python3
"""Check Dolomiti Ambiente Riciclabolario for changes and rebuild PWA data assets if needed.

Compares freshly scraped items/bins against data/trento_domestica.json (ignoring scraped_at).
If changes are detected:
1. Writes updated data/trento_domestica.json.
2. Rebuilds artifacts/dictionary_trento.json and artifacts/embeddings_trento_fp16.bin.
3. Syncs dictionary + embeddings into web/assets/ (the ONNX image encoder is untouched!).
4. Writes a human-readable diff summary to --summary-out (for GitHub Actions PR bodies).

Exit code is always 0 unless scraping/build fails; sets GITHUB_OUTPUT `changed=true|false` when running in CI.
"""

from __future__ import annotations

import argparse
import json
import os
import shutil
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DATA_PATH = ROOT / "data" / "trento_domestica.json"
ENRICHMENT_PATH = ROOT / "data" / "prompt_enrichment.json"
ARTIFACTS_DIR = ROOT / "artifacts"
WEB_ASSETS_DIR = ROOT / "web" / "assets"


def item_map(doc: dict) -> dict[int, dict]:
    return {int(it["id"]): it for it in doc.get("items", [])}


def compute_diff(old_doc: dict, new_doc: dict, enrichment: dict) -> tuple[bool, str]:
    old_items = item_map(old_doc)
    new_items = item_map(new_doc)

    added_ids = sorted(set(new_items) - set(old_items))
    removed_ids = sorted(set(old_items) - set(new_items))
    changed_bins = []
    renamed = []

    for iid in sorted(set(old_items) & set(new_items)):
        o, n = old_items[iid], new_items[iid]
        if o.get("bins") != n.get("bins"):
            changed_bins.append((iid, n["name_it"], o.get("bins"), n.get("bins")))
        if o.get("name_it") != n.get("name_it"):
            renamed.append((iid, o.get("name_it"), n.get("name_it")))

    bins_changed = old_doc.get("bins") != new_doc.get("bins")
    has_changes = bool(added_ids or removed_ids or changed_bins or renamed or bins_changed)

    lines = ["## Aggiornamento Riciclabolario Trento", ""]
    if not has_changes:
        lines.append("Nessuna variazione rilevata rispetto ai dati attuali.")
        return False, "\n".join(lines) + "\n"

    lines.append(f"- **Voci precedenti:** {len(old_items)} → **Nuove voci:** {len(new_items)}")
    if bins_changed:
        lines.append("- **Categorie di raccolta:** aggiornate")
    if added_ids:
        lines.append(f"\n### Nuove voci aggiunte ({len(added_ids)})")
        for iid in added_ids:
            it = new_items[iid]
            missing_en = " ⚠️ *(senza prompt inglese in `prompt_enrichment.json`)*" if str(iid) not in enrichment else ""
            lines.append(f"- `{iid}` **{it['name_it']}** → `{', '.join(it['bins'])}`{missing_en}")
    if removed_ids:
        lines.append(f"\n### Voci rimosse ({len(removed_ids)})")
        for iid in removed_ids:
            it = old_items[iid]
            lines.append(f"- `{iid}` ~~{it['name_it']}~~")
    if changed_bins:
        lines.append(f"\n### Cambi di bidone/categoria ({len(changed_bins)})")
        for iid, name, old_b, new_b in changed_bins:
            lines.append(f"- `{iid}` **{name}**: `{', '.join(old_b)}` → `{', '.join(new_b)}`")
    if renamed:
        lines.append(f"\n### Voci rinominate ({len(renamed)})")
        for iid, old_n, new_n in renamed:
            lines.append(f"- `{iid}` {old_n} → **{new_n}**")

    return True, "\n".join(lines) + "\n"


def set_github_output(key: str, value: str) -> None:
    gh_out = os.environ.get("GITHUB_OUTPUT")
    if gh_out:
        with open(gh_out, "a", encoding="utf-8") as f:
            f.write(f"{key}={value}\n")


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--summary-out", type=Path, default=None)
    parser.add_argument("--preset", default="siglip2-base")
    args = parser.parse_args()

    old_doc = json.loads(DATA_PATH.read_text(encoding="utf-8"))
    enrichment = json.loads(ENRICHMENT_PATH.read_text(encoding="utf-8"))

    # Run scraper into data/trento_domestica.json, then compare against previous snapshot
    subprocess.run([sys.executable, str(ROOT / "pipeline" / "1_scrape_riciclabolario.py")], check=True)
    new_doc = json.loads(DATA_PATH.read_text(encoding="utf-8"))

    changed, summary = compute_diff(old_doc, new_doc, enrichment)
    print(summary)

    if args.summary_out:
        args.summary_out.write_text(summary, encoding="utf-8")

    if not changed:
        # Restore original file so scraped_at timestamp alone does not dirty git
        DATA_PATH.write_text(json.dumps(old_doc, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
        set_github_output("changed", "false")
        return

    # Rebuild dictionary & Float16 text embeddings (no ONNX re-export needed)
    subprocess.run(
        [sys.executable, str(ROOT / "pipeline" / "2_build_embeddings.py"), "--preset", args.preset],
        check=True,
    )
    WEB_ASSETS_DIR.mkdir(parents=True, exist_ok=True)
    for fname in ("dictionary_trento.json", "embeddings_trento_fp16.bin"):
        shutil.copy2(ARTIFACTS_DIR / fname, WEB_ASSETS_DIR / fname)
        print(f"Synced {fname} -> {WEB_ASSETS_DIR / fname}")

    set_github_output("changed", "true")


if __name__ == "__main__":
    main()
