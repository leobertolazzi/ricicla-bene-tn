# Changelog

All notable application and UI changes to **Ricicla Bene TN** are documented in this file.
Automated weekly data updates to Dolomiti Ambiente's Riciclabolario are tracked via pull requests rather than entries here.

## [0.2.0] - 2026-11-25

### Changed
- Computed softmax probabilities in `rankTopK` across all dictionary items (`432` entries) rather than normalizing only over the top 10 shortlist.
- Formatted positive confidence scores below `0.5%` as `<1%` instead of `0%`.
- Redesigned the app icon and favicon (`docs/app_icon.svg`, `web/icons/favicon.svg`, and rendered PNG sizes) with a minimal geometric twin-peak mountain inside the 3-arc recycling ring.
- Updated app version to `0.2.0` and bumped the Service Worker cache key (`ricicla-bene-tn-v0.2.0-1`).

## [0.1.0]

### Added
- Initial offline-capable PWA for household waste sorting in Trento (*Utenza Domestica*) based on Dolomiti Ambiente's Riciclabolario.
- On-device zero-shot image classification using 4-bit quantized `google/siglip2-base-patch16-224` (`onnxruntime-web` WebGPU/WASM) and precomputed float16 text embeddings.
- Top-10 predictions with Trento color-coded bin badges and disposal guidance.
- Searchable Riciclabolario tab with bin filter chips, sorting Guide tab, bilingual IT/EN support, and light/dark theme.
- Offline pipeline (`pipeline/`) and weekly GitHub Actions check for Riciclabolario updates.
