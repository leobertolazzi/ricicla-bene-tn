#!/usr/bin/env python3
"""Scrape the official Dolomiti Ambiente Riciclabolario for Comune di Trento (Domestica).

Uses only Python stdlib. Fetches:
1. The Riciclabolario HTML page to get all waste items (<select name="id_riciclabolario">).
2. The site CSS to inspect official badge colors for each waste bin type_N class.
3. The POST endpoint for every item ID to get its exact disposal categories ("Dove conferirlo").

Outputs:
- data/trento_domestica.json
"""

from __future__ import annotations

import concurrent.futures
import html
import json
import re
import time
import urllib.parse
import urllib.request
from datetime import datetime, timezone
from pathlib import Path

BASE_URL = "https://dolomitiambiente.it"
RICICLABOLARIO_URL = f"{BASE_URL}/it/trento/domestica/raccolta-differenziata/riciclabolario"
USER_AGENT = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) RiciclaBeneTN/1.0"

ROOT = Path(__file__).resolve().parent.parent
OUT_PATH = ROOT / "data" / "trento_domestica.json"


def http_get(url: str, timeout: int = 20) -> str:
    req = urllib.request.Request(url, headers={"User-Agent": USER_AGENT})
    with urllib.request.urlopen(req, timeout=timeout) as resp:
        return resp.read().decode("utf-8", errors="replace")


def fetch_item_bins(item_id: str, retries: int = 3) -> list[dict]:
    payload = urllib.parse.urlencode(
        {
            "parent": "id_riciclabolario",
            "change": "true",
            "id_riciclabolario": item_id,
            "tags": "",
            "child": "tags",
        }
    ).encode("utf-8")

    headers = {
        "User-Agent": USER_AGENT,
        "X-Requested-With": "XMLHttpRequest",
        "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
        "Referer": RICICLABOLARIO_URL,
    }

    last_err: Exception | None = None
    for attempt in range(retries):
        try:
            req = urllib.request.Request(RICICLABOLARIO_URL, data=payload, headers=headers, method="POST")
            with urllib.request.urlopen(req, timeout=20) as resp:
                raw = resp.read().decode("utf-8", errors="replace")
            data = json.loads(raw)
            snippet = data.get("html", "")
            # Matches e.g.: <div value="5" class="badge type_5 bg-secondary"> IMBALLAGGI LEGGERI</div>
            matches = re.findall(
                r'<div[^>]*value="(\d+)"[^>]*class="[^"]*\btype_(\d+)\b[^"]*"[^>]*>(.*?)</div>',
                snippet,
                flags=re.S | re.I,
            )
            bins = []
            for val_id, type_id, label in matches:
                clean_label = re.sub(r"\s+", " ", html.unescape(label)).strip()
                bins.append(
                    {
                        "id": int(val_id),
                        "type_id": int(type_id),
                        "label": clean_label,
                    }
                )
            return bins
        except Exception as exc:
            last_err = exc
            time.sleep(0.5 * (attempt + 1))

    raise RuntimeError(f"Failed fetching item {item_id}: {last_err}")


def extract_css_colors(page_html: str) -> dict[str, str]:
    """Extract background-color for .type_N classes from the site stylesheet."""
    css_match = re.search(r'<link[^>]+href="(/assets/style/[^"]+\.css)"', page_html)
    if not css_match:
        return {}
    css_url = BASE_URL + css_match.group(1)
    try:
        css = http_get(css_url)
    except Exception:
        return {}

    colors: dict[str, str] = {}
    for type_num, body in re.findall(r"\.type_(\d+)\s*\{([^}]*)\}", css):
        bg = re.search(r"background(?:-color)?\s*:\s*(#[0-9a-fA-F]{3,8})", body)
        if bg:
            colors[type_num] = bg.group(1).lower()
    return colors


def main() -> None:
    print(f"Fetching {RICICLABOLARIO_URL} ...")
    page_html = http_get(RICICLABOLARIO_URL)

    # Extract select options inside id_riciclabolario
    select_match = re.search(
        r'<select[^>]*id="id_riciclabolario"[^>]*>(.*?)</select>',
        page_html,
        flags=re.S | re.I,
    )
    if not select_match:
        raise RuntimeError("Could not find <select id='id_riciclabolario'> in page HTML")

    raw_options = re.findall(
        r'<option[^>]*value="(\d+)"[^>]*>(.*?)</option>',
        select_match.group(1),
        flags=re.S | re.I,
    )
    items_meta = []
    for opt_id, opt_name in raw_options:
        if opt_id == "0":
            continue
        clean_name = re.sub(r"\s+", " ", html.unescape(opt_name)).strip()
        items_meta.append((int(opt_id), clean_name))

    print(f"Found {len(items_meta)} items. Extracting stylesheet bin colors...")
    css_colors = extract_css_colors(page_html)
    print(f"Extracted CSS colors for {len(css_colors)} bin types: {css_colors}")

    # Extract official PDF link if present
    pdf_match = re.search(r'href="(/files/modulistica/[^"]*riciclabolario[^"]*\.pdf)"', page_html, flags=re.I)
    pdf_url = (BASE_URL + pdf_match.group(1)) if pdf_match else None

    results = []
    bins_catalog: dict[int, dict] = {}
    done = 0

    print("Fetching disposal categories for all items (8 concurrent workers)...")
    with concurrent.futures.ThreadPoolExecutor(max_workers=8) as pool:
        future_to_meta = {
            pool.submit(fetch_item_bins, str(item_id)): (item_id, name)
            for item_id, name in items_meta
        }
        for future in concurrent.futures.as_completed(future_to_meta):
            item_id, name = future_to_meta[future]
            item_bins = future.result()
            for b in item_bins:
                tid = b["type_id"]
                if tid not in bins_catalog:
                    bins_catalog[tid] = {
                        "id": tid,
                        "label": b["label"],
                        "color_hex": css_colors.get(str(tid)),
                    }
            results.append(
                {
                    "id": item_id,
                    "name_it": name,
                    "bin_ids": [b["type_id"] for b in item_bins],
                    "bins": [b["label"] for b in item_bins],
                }
            )
            done += 1
            if done % 50 == 0 or done == len(items_meta):
                print(f"  Progress: {done}/{len(items_meta)}")

    # Sort deterministically by Italian name (matching Dolomiti Ambiente dropdown order)
    results.sort(key=lambda x: (x["name_it"].casefold(), x["id"]))

    missing_bins = [r for r in results if not r["bin_ids"]]
    if missing_bins:
        print(f"WARNING: {len(missing_bins)} items have no bin assigned: {[r['name_it'] for r in missing_bins[:10]]}")

    output = {
        "schema_version": 1,
        "comune": "Trento",
        "utenza": "Domestica",
        "source_url": RICICLABOLARIO_URL,
        "pdf_url": pdf_url,
        "scraped_at": datetime.now(timezone.utc).isoformat(),
        "item_count": len(results),
        "bins": [bins_catalog[k] for k in sorted(bins_catalog.keys())],
        "items": results,
    }

    OUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    OUT_PATH.write_text(json.dumps(output, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"Saved {len(results)} items and {len(bins_catalog)} bin categories to {OUT_PATH}")


if __name__ == "__main__":
    main()
