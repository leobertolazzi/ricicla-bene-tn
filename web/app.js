/* Ricicla Bene TN — 100% client-side SigLIP 2 (Apache-2.0) zero-shot PWA */

const APP_VERSION = "0.1.0";
const MODEL_URL = "./assets/model_image.onnx";
const DICT_URL = "./assets/dictionary_trento.json";
const EMB_URL = "./assets/embeddings_trento_fp16.bin";
const DEFAULT_IMAGE_SIZE = 224;
const DEFAULT_SOFTMAX_TEMP = 55.0;

const BIN_ICON_PATHS = {
  1: '<path d="M4 22h16a2 2 0 0 0 2-2V4a2 2 0 0 0-2-2H8a2 2 0 0 0-2 2v16a2 2 0 0 1-2 2Zm0 0a2 2 0 0 1-2-2v-9c0-1.1.9-2 2-2h2"/><path d="M18 14h-8"/><path d="M15 18h-5"/><path d="M10 6h8v4h-8V6Z"/>',
  2: '<path d="M3 21h18"/><path d="M5 21V7l8-4v18"/><path d="M19 21V11l-6-4"/><path d="M9 9v.01"/><path d="M9 12v.01"/><path d="M9 15v.01"/><path d="M9 18v.01"/>',
  3: '<path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><path d="M12 9v4"/><path d="M12 17h.01"/>',
  4: '<path d="M11 2a2 2 0 0 0-2 2v5H4a2 2 0 0 0-2 2v2c0 1.1.9 2 2 2h5v5c0 1.1.9 2 2 2h2a2 2 0 0 0 2-2v-5h5a2 2 0 0 0 2-2v-2a2 2 0 0 0-2-2h-5V4a2 2 0 0 0-2-2h-2z"/>',
  5: '<path d="M10 2v2.5L7 7.5V20a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2V7.5l-3-3V2Z"/><path d="M9 2h6"/><path d="M7 12h10"/>',
  6: '<path d="M11 20A7 7 0 0 1 9.8 6.1C15.5 5 17 4.48 19 2c1 2 2 4.18 2 8 0 5.5-4.78 10-10 10Z"/><path d="M2 21c0-3 1.85-5.36 5.08-6C9.5 14.52 12 13 13 12"/>',
  7: '<path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/>',
  8: '<path d="M9 2h6"/><path d="M10 2v4l-2.5 3.5A3 3 0 0 0 7 11.2V20a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2v-8.8a3 3 0 0 0-.5-1.7L14 6V2"/>',
};

const CHEVRON_SVG = '<svg class="icon icon--sm expand-chevron" viewBox="0 0 24 24" aria-hidden="true"><path d="m6 9 6 6 6-6"/></svg>';

function binIconSvg(binId, sizeClass = "icon--xs") {
  const paths = BIN_ICON_PATHS[binId] || '<circle cx="12" cy="12" r="9"/>';
  return `<svg class="icon ${sizeClass}" viewBox="0 0 24 24" aria-hidden="true">${paths}</svg>`;
}

const BIN_EN = {
  1: {
    label: "PAPER & CARDBOARD",
    short: "Paper",
    guidance: "Yellow-lid bin (weekly kerbside pickup): place loose, flattened paper and cardboard.",
  },
  2: {
    label: "RECYCLING CENTER (CRM)",
    short: "CRM",
    guidance: "Bring to a Dolomiti Ambiente Recycling Center (CR) or Centro Integrato.",
  },
  3: {
    label: "SPECIALIZED CONTRACTOR",
    short: "Special",
    guidance: "Special waste: contact an authorized waste disposal contractor.",
  },
  4: {
    label: "PHARMACY",
    short: "Pharmacy",
    guidance: "Dispose of in the dedicated collection bins at pharmacies.",
  },
  5: {
    label: "LIGHT PACKAGING",
    short: "Packaging",
    guidance: "Light-blue semi-transparent bags (weekly kerbside pickup): empty plastic, aluminum, steel, and drink cartons only.",
  },
  6: {
    label: "ORGANIC WASTE",
    short: "Organic",
    guidance: "Brown-lid bin (twice weekly): use the dedicated paper bags only.",
  },
  7: {
    label: "RESIDUAL WASTE",
    short: "Residual",
    guidance: "Dark-green-lid bin (pay-as-you-throw, weekly): use any bag for non-recyclable dry waste.",
  },
  8: {
    label: "GLASS",
    short: "Glass",
    guidance: "Light-green-lid bin (every 2 weeks): empty bottles and jars placed loose, without metal lids.",
  },
};

const I18N = {
  it: {
    updateBanner: "<strong>Riciclabolario aggiornato</strong> alle ultime regole di Dolomiti Ambiente.",
    iosInstall: "<strong>Installa su iPhone:</strong> tocca <strong>Condividi</strong> in Safari e poi <strong>Aggiungi alla schermata Home</strong>.",
    scanHeading: "Inquadra un rifiuto",
    scanHint: "Scatta o carica una foto di un solo oggetto per vedere dove conferirlo a Trento.",
    takePhoto: "Scatta foto",
    library: "Libreria",
    analyzing: "Analisi in corso sul dispositivo...",
    topMatchEyebrow: "Corrispondenza migliore",
    top10Title: "Top 10 risultati",
    notFoundBtn: "Non è tra questi? Cerca nel Riciclabolario",
    privacyTitle: "100% offline e privato",
    privacyBody: (n) => `SigLIP 2 gira interamente nel tuo browser (nessuna foto esce dal dispositivo) e confronta l'immagine con tutte le <span id="item-count-inline">${n}</span> voci di Dolomiti Ambiente.`,
    warningLabel: "Avviso:",
    warningBody: "i modelli AI possono commettere errori. Sei tu l'unico responsabile della scelta finale su dove conferire il rifiuto.",
    searchPlaceholder: "Cerca un rifiuto (es. yogurt, vetro, pizza)...",
    searchEmpty: "Nessun rifiuto trovato con questi filtri.",
    resetFilters: "Reimposta filtri",
    guideTitle: "Raccolta differenziata — Trento",
    sourceTitle: "Fonte dati, Modello & Note legali",
    legalNote: "Applicazione civica non ufficiale, gratuita e open-source (licenza MIT), non affiliata a Dolomiti Ambiente S.r.l. né alla Provincia Autonoma di Trento. I dati informativi sono tratti dal Riciclabolario pubblico di Dolomiti Ambiente; per conferme ufficiali fai riferimento al sito istituzionale di Dolomiti Ambiente.",
    tabScan: "Scansiona",
    tabSearch: "Riciclabolario",
    tabGuide: "Guida",
    themeLight: "Tema chiaro",
    themeDark: "Tema scuro",
    statusLoading: "Caricamento modello...",
    statusReady: (ep) => `Offline · ${ep}`,
    statusError: "Errore modello",
    whereToDispose: "Dove conferirlo",
    allFilter: "Tutti",
    itemsFound: (n) => `${n} voci`,
    metaVersion: "Versione app",
    metaMunicipality: "Comune",
    metaItems: "Voci dizionario",
    metaUpdated: "Aggiornato al",
    metaModel: "Modello on-device",
    linkGuide: "Guida ufficiale alla raccolta (Trento)",
    linkDict: "Riciclabolario Dolomiti Ambiente",
    linkPdf: "PDF ufficiale Dolomiti Ambiente",
    errModelWait: "Il modello si sta ancora caricando: riprova tra un attimo.",
    errAnalyze: (m) => `Errore durante l'analisi: ${m}`,
    errImageRead: "Impossibile leggere l'immagine selezionata.",
  },
  en: {
    updateBanner: "<strong>Dictionary updated</strong> with the latest Dolomiti Ambiente rules.",
    iosInstall: "<strong>Install on iPhone:</strong> tap <strong>Share</strong> in Safari, then <strong>Add to Home Screen</strong>.",
    scanHeading: "Scan a waste item",
    scanHint: "Take or upload a photo of a single item to see how to sort it in Trento.",
    takePhoto: "Take photo",
    library: "Library",
    analyzing: "Analyzing on device...",
    topMatchEyebrow: "Best match",
    top10Title: "Top 10 matches",
    notFoundBtn: "Not here? Search the Riciclabolario",
    privacyTitle: "100% offline & private",
    privacyBody: (n) => `SigLIP 2 runs directly in your browser (photos never leave your device) and matches against all <span id="item-count-inline">${n}</span> Dolomiti Ambiente entries.`,
    warningLabel: "Note:",
    warningBody: "AI models can make mistakes. You are solely responsible for choosing where to dispose of the item.",
    searchPlaceholder: "Search an item (e.g. yogurt, glass, pizza)...",
    searchEmpty: "No matching waste items found.",
    resetFilters: "Reset filters",
    guideTitle: "Waste sorting guide — Trento",
    sourceTitle: "Data source, Model & Legal notice",
    legalNote: "Unofficial, free, open-source civic app (MIT license), not affiliated with Dolomiti Ambiente S.r.l. or Provincia Autonoma di Trento. Sorting rules are sourced from Dolomiti Ambiente's public Riciclabolario; always refer to Dolomiti Ambiente's official site for confirmation.",
    tabScan: "Scan",
    tabSearch: "Dictionary",
    tabGuide: "Guide",
    themeLight: "Light theme",
    themeDark: "Dark theme",
    statusLoading: "Loading model...",
    statusReady: (ep) => `Offline · ${ep}`,
    statusError: "Model error",
    whereToDispose: "Where to dispose",
    allFilter: "All",
    itemsFound: (n) => `${n} items`,
    metaVersion: "App version",
    metaMunicipality: "Municipality",
    metaItems: "Dictionary items",
    metaUpdated: "Last updated",
    metaModel: "On-device model",
    linkGuide: "Official Trento sorting guide",
    linkDict: "Dolomiti Ambiente Riciclabolario",
    linkPdf: "Official Dolomiti Ambiente PDF",
    errModelWait: "The model is still loading: please try again in a moment.",
    errAnalyze: (m) => `Analysis error: ${m}`,
    errImageRead: "Could not read the selected image.",
  },
};

const state = {
  lang: "it",
  dictionary: null,
  binsById: new Map(),
  embeddings: null, // Float32Array [itemCount * dim]
  imageSize: DEFAULT_IMAGE_SIZE,
  softmaxTemp: DEFAULT_SOFTMAX_TEMP,
  session: null,
  modelStatusMode: "loading",
  executionProvider: "wasm",
  topK: 10,
  currentImageBitmap: null,
  currentPreviewUrl: null,
  lastPredictions: null,
  lastInferenceMs: 0,
  expandedId: null,
  expandedSearchId: null,
  selectedBinFilter: null,
};

const el = {};

function $(id) {
  return document.getElementById(id);
}

function t(key, ...args) {
  const dict = I18N[state.lang] || I18N.it;
  const val = dict[key];
  return typeof val === "function" ? val(...args) : val;
}

function capitalize(str) {
  return str ? str.charAt(0).toUpperCase() + str.slice(1) : "";
}

function itemDisplay(item) {
  if (state.lang === "en" && Array.isArray(item.prompts_en) && item.prompts_en.length > 0) {
    return {
      primary: capitalize(item.prompts_en[0]),
      secondary: item.name_it,
    };
  }
  return { primary: item.name_it, secondary: null };
}

function binDisplay(bin) {
  if (state.lang === "en" && BIN_EN[bin.id]) {
    return {
      label: BIN_EN[bin.id].label,
      short: BIN_EN[bin.id].short,
      guidance: BIN_EN[bin.id].guidance,
    };
  }
  return {
    label: bin.label,
    short: bin.short_label,
    guidance: bin.guidance_it,
  };
}

function normalizeText(str) {
  return str
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

/** Convert an IEEE 754 binary16 uint16 value to a JS float32 number. */
function float16ToFloat32(h) {
  const s = (h & 0x8000) >> 15;
  const e = (h & 0x7c00) >> 10;
  const f = h & 0x03ff;
  if (e === 0) {
    return (s ? -1 : 1) * Math.pow(2, -14) * (f / 1024);
  }
  if (e === 0x1f) {
    return f ? NaN : (s ? -Infinity : Infinity);
  }
  return (s ? -1 : 1) * Math.pow(2, e - 15) * (1 + f / 1024);
}

function decodeFloat16Matrix(arrayBuffer, expectedLength) {
  const view = new DataView(arrayBuffer);
  const out = new Float32Array(expectedLength);
  for (let i = 0; i < expectedLength; i++) {
    out[i] = float16ToFloat32(view.getUint16(i * 2, true));
  }
  return out;
}

function setModelStatus(mode, text) {
  state.modelStatusMode = mode;
  el.modelStatus.className = `status-badge status-badge--${mode}`;
  el.modelStatusText.textContent = text;
}

function refreshStatusText() {
  if (state.modelStatusMode === "ready") {
    setModelStatus("ready", t("statusReady", state.executionProvider.toUpperCase()));
  } else if (state.modelStatusMode === "error") {
    setModelStatus("error", t("statusError"));
  } else {
    setModelStatus("loading", t("statusLoading"));
  }
}

function applyLanguage(lang, persist = false) {
  state.lang = lang === "en" ? "en" : "it";
  document.documentElement.lang = state.lang;
  if (persist) {
    localStorage.setItem("ricicla_lang", state.lang);
  }

  document.querySelectorAll(".lang-btn").forEach((btn) => {
    btn.classList.toggle("active", btn.dataset.lang === state.lang);
  });

  document.querySelectorAll("[data-i18n]").forEach((node) => {
    node.textContent = t(node.dataset.i18n);
  });

  const itemCount = state.dictionary ? state.dictionary.item_count : 432;
  document.querySelectorAll("[data-i18n-html]").forEach((node) => {
    const key = node.dataset.i18nHtml;
    node.innerHTML = key === "privacyBody" ? t(key, itemCount) : t(key);
  });

  el.searchInput.placeholder = t("searchPlaceholder");
  refreshStatusText();

  const currentTheme = document.documentElement.dataset.theme === "dark" ? "dark" : "light";
  applyTheme(currentTheme, false);

  if (state.dictionary) {
    renderBinFilterChips();
    renderSearchList();
    renderGuide();
  }
  if (state.lastPredictions) {
    renderPredictions(state.lastPredictions, state.lastInferenceMs);
  }
}

async function initDictionaryAndEmbeddings() {
  const [dictRes, embRes] = await Promise.all([fetch(DICT_URL), fetch(EMB_URL)]);
  if (!dictRes.ok || !embRes.ok) {
    throw new Error("Impossibile caricare dizionario o matrice embeddings.");
  }
  const dict = await dictRes.json();
  const embBuf = await embRes.arrayBuffer();

  const previousScrapedAt = state.dictionary?.scraped_at;
  state.dictionary = dict;
  state.imageSize = Number(dict.image_size) || DEFAULT_IMAGE_SIZE;
  state.softmaxTemp = Number(dict.softmax_temperature) || DEFAULT_SOFTMAX_TEMP;
  state.binsById = new Map(dict.bins.map((b) => [b.id, b]));
  const totalFloats = dict.item_count * dict.embedding_dim;
  if (embBuf.byteLength !== totalFloats * 2) {
    throw new Error(`Dimensione embeddings inattesa: ${embBuf.byteLength} byte.`);
  }
  state.embeddings = decodeFloat16Matrix(embBuf, totalFloats);

  const countEl = $("item-count-inline");
  if (countEl) countEl.textContent = String(dict.item_count);

  renderBinFilterChips();
  renderSearchList();
  renderGuide();

  if (previousScrapedAt && dict.scraped_at && previousScrapedAt !== dict.scraped_at) {
    el.updateBanner?.classList.remove("hidden");
  }
}

async function initOnnxSession() {
  if (typeof ort === "undefined") {
    throw new Error("ONNX Runtime Web non caricato.");
  }

  const ortBaseUrl = new URL("./vendor/ort/", window.location.href).href;
  const modelUrl = new URL(MODEL_URL, window.location.href).href;
  ort.env.wasm.wasmPaths = ortBaseUrl;
  ort.env.wasm.numThreads = self.crossOriginIsolated
    ? Math.min(4, navigator.hardwareConcurrency || 2)
    : 1;

  setModelStatus("loading", t("statusLoading"));

  const providersToTry = navigator.gpu ? [["webgpu", "wasm"], ["wasm"]] : [["wasm"]];
  let lastError = null;
  for (const providers of providersToTry) {
    try {
      const session = await ort.InferenceSession.create(modelUrl, {
        executionProviders: providers,
        graphOptimizationLevel: "all",
      });
      state.session = session;
      state.executionProvider = providers[0];
      setModelStatus("ready", t("statusReady", providers[0].toUpperCase()));
      return;
    } catch (err) {
      lastError = err;
    }
  }
  throw lastError || new Error("Impossibile inizializzare il modello ONNX.");
}

/** Resize shortest side to imageSize + center-crop -> CHW float32 tensor in [0, 1]. */
function preprocessImageToTensor(bitmap) {
  const imageSize = state.imageSize;
  const canvas = document.createElement("canvas");
  canvas.width = imageSize;
  canvas.height = imageSize;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });

  const scale = Math.max(imageSize / bitmap.width, imageSize / bitmap.height);
  const drawW = bitmap.width * scale;
  const drawH = bitmap.height * scale;
  const dx = (imageSize - drawW) / 2;
  const dy = (imageSize - drawH) / 2;

  ctx.drawImage(bitmap, dx, dy, drawW, drawH);
  const { data } = ctx.getImageData(0, 0, imageSize, imageSize);

  const area = imageSize * imageSize;
  const chw = new Float32Array(3 * area);
  const inv255 = 1.0 / 255.0;
  for (let i = 0; i < area; i++) {
    const p = i * 4;
    chw[i] = data[p] * inv255;
    chw[area + i] = data[p + 1] * inv255;
    chw[2 * area + i] = data[p + 2] * inv255;
  }

  return new ort.Tensor("float32", chw, [1, 3, imageSize, imageSize]);
}

function rankTopK(imageVec, k) {
  const { items, embedding_dim: dim } = state.dictionary;
  const mat = state.embeddings;
  const n = items.length;

  let normSq = 0;
  for (let j = 0; j < dim; j++) normSq += imageVec[j] * imageVec[j];
  const invNorm = 1.0 / Math.sqrt(Math.max(normSq, 1e-12));
  const q = new Float32Array(dim);
  for (let j = 0; j < dim; j++) q[j] = imageVec[j] * invNorm;

  const scores = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    let dot = 0;
    const base = i * dim;
    for (let j = 0; j < dim; j++) {
      dot += mat[base + j] * q[j];
    }
    scores[i] = dot;
  }

  const indices = Array.from({ length: n }, (_, i) => i);
  indices.sort((a, b) => scores[b] - scores[a]);
  const top = indices.slice(0, k);

  const temp = state.softmaxTemp;
  const maxLogit = Math.max(...top.map((i) => scores[i] * temp));
  const exps = top.map((i) => Math.exp(scores[i] * temp - maxLogit));
  const expSum = exps.reduce((a, b) => a + b, 0) || 1;

  return top.map((idx, rankIdx) => {
    const item = items[idx];
    return {
      rank: rankIdx + 1,
      item,
      bin: state.binsById.get(item.bin_id),
      cosine: scores[idx],
      confidence: exps[rankIdx] / expSum,
    };
  });
}

async function runModelInference(inputTensor) {
  try {
    return await state.session.run({ image: inputTensor });
  } catch (err) {
    // If WebGPU fails on MatMulNBits in a specific browser, fall back cleanly to WASM.
    if (state.executionProvider !== "wasm") {
      console.warn("WebGPU inference failed, falling back to WASM:", err);
      const modelUrl = new URL(MODEL_URL, window.location.href).href;
      state.session = await ort.InferenceSession.create(modelUrl, {
        executionProviders: ["wasm"],
        graphOptimizationLevel: "all",
      });
      state.executionProvider = "wasm";
      refreshStatusText();
      return await state.session.run({ image: inputTensor });
    }
    throw err;
  }
}

async function classifyCurrentImage() {
  if (!state.currentImageBitmap) return;
  if (!state.session || !state.embeddings) {
    showError(t("errModelWait"));
    return;
  }

  el.scanError.classList.add("hidden");
  el.scanLoading.classList.remove("hidden");
  el.scanOverlay?.classList.remove("hidden");

  try {
    const t0 = performance.now();
    const inputTensor = preprocessImageToTensor(state.currentImageBitmap);
    const outputs = await runModelInference(inputTensor);
    const embedding = outputs.image_embedding.data;
    const preds = rankTopK(embedding, state.topK);
    const elapsedMs = performance.now() - t0;

    state.lastPredictions = preds;
    state.lastInferenceMs = elapsedMs;
    state.expandedId = preds[0]?.item.id ?? null;
    renderPredictions(preds, elapsedMs);
  } catch (err) {
    console.error(err);
    showError(t("errAnalyze", err.message || err));
  } finally {
    el.scanLoading.classList.add("hidden");
    el.scanOverlay?.classList.add("hidden");
  }
}

function showError(msg) {
  el.scanError.textContent = msg;
  el.scanError.classList.remove("hidden");
}

function renderPredictions(preds, elapsedMs) {
  el.inferenceMeta.textContent = `${Math.round(elapsedMs)} ms · offline`;
  el.resultsList.innerHTML = "";

  let othersGroup = null;
  if (preds.length > 1) {
    othersGroup = document.createElement("div");
    othersGroup.className = "grouped-list";
  }

  for (const p of preds) {
    const isTop = p.rank === 1;
    const isExpanded = state.expandedId === p.item.id;
    const card = document.createElement("button");
    card.type = "button";
    card.className = `${isTop ? "result-card result-card--top" : "result-row"}${isExpanded ? " is-expanded" : ""}`;
    card.setAttribute("aria-expanded", String(isExpanded));
    card.style.setProperty("--bin-color", p.bin.color_hex);
    card.style.setProperty("--bin-text-color", p.bin.text_color_hex || "#ffffff");

    const pct = Math.round(p.confidence * 100);
    const textColor = p.bin.text_color_hex || "#ffffff";
    const nameInfo = itemDisplay(p.item);
    const binInfo = binDisplay(p.bin);

    card.innerHTML = `
      ${isTop ? `<div class="result-card__eyebrow"><span>★</span><span></span></div>` : ""}
      <div class="result-card__top">
        <span class="rank-circle">#${p.rank}</span>
        <div class="result-card__body">
          <div class="result-card__title-row">
            <div class="result-card__name"></div>
            ${CHEVRON_SVG}
          </div>
          ${nameInfo.secondary ? '<div class="item-subtitle"></div>' : ""}
          <div class="result-card__row">
            <span class="bin-badge" style="background:${p.bin.color_hex};color:${textColor}">${binIconSvg(p.bin.id)} <span></span></span>
            <span class="score-text">${pct}%</span>
          </div>
        </div>
      </div>
      ${isTop ? `<div class="score-bar"><div class="score-bar__fill" style="width:${Math.max(4, pct)}%"></div></div>` : ""}
      <div class="result-card__guidance${isExpanded ? "" : " hidden"}">
        <strong></strong>
        <span></span>
      </div>
    `;

    if (isTop) {
      card.querySelector(".result-card__eyebrow span:last-child").textContent = t("topMatchEyebrow");
    }
    card.querySelector(".result-card__name").textContent = nameInfo.primary;
    if (nameInfo.secondary) {
      card.querySelector(".item-subtitle").textContent = nameInfo.secondary;
    }
    card.querySelector(".bin-badge span").textContent = binInfo.label;
    card.querySelector(".result-card__guidance strong").textContent = t("whereToDispose");
    card.querySelector(".result-card__guidance span").textContent = binInfo.guidance;

    card.addEventListener("click", () => {
      state.expandedId = state.expandedId === p.item.id ? null : p.item.id;
      renderPredictions(preds, elapsedMs);
    });

    if (isTop) {
      el.resultsList.appendChild(card);
    } else {
      othersGroup.appendChild(card);
    }
  }

  if (othersGroup) {
    el.resultsList.appendChild(othersGroup);
  }

  el.resultsSection.classList.remove("hidden");
  el.privacyCard.classList.add("hidden");
}

function revokePreviewUrl() {
  if (state.currentPreviewUrl) {
    URL.revokeObjectURL(state.currentPreviewUrl);
    state.currentPreviewUrl = null;
  }
}

async function handleImageFile(file) {
  if (!file) return;
  try {
    const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
    state.currentImageBitmap?.close?.();
    state.currentImageBitmap = bitmap;

    const previewUrl = URL.createObjectURL(file);
    revokePreviewUrl();
    state.currentPreviewUrl = previewUrl;
    el.previewImage.src = previewUrl;
    el.previewImage.classList.remove("hidden");
    el.clearImageBtn.classList.remove("hidden");
    el.previewPlaceholder.classList.add("hidden");

    await classifyCurrentImage();
  } catch (err) {
    showError(t("errImageRead"));
    console.error(err);
  }
}

function clearImage() {
  state.currentImageBitmap?.close?.();
  state.currentImageBitmap = null;
  state.lastPredictions = null;
  revokePreviewUrl();
  el.previewImage.removeAttribute("src");
  el.previewImage.classList.add("hidden");
  el.clearImageBtn.classList.add("hidden");
  el.scanOverlay?.classList.add("hidden");
  el.previewPlaceholder.classList.remove("hidden");
  el.resultsSection.classList.add("hidden");
  el.scanError.classList.add("hidden");
  el.privacyCard.classList.remove("hidden");
  el.cameraInput.value = "";
  el.galleryInput.value = "";
}

function renderBinFilterChips() {
  el.binFilterChips.innerHTML = "";

  const allChip = document.createElement("button");
  allChip.type = "button";
  allChip.className = `chip${state.selectedBinFilter === null ? " active" : ""}`;
  allChip.textContent = t("allFilter");
  if (state.selectedBinFilter === null) {
    allChip.style.background = "var(--accent)";
  }
  allChip.addEventListener("click", () => {
    state.selectedBinFilter = null;
    renderBinFilterChips();
    renderSearchList();
  });
  el.binFilterChips.appendChild(allChip);

  for (const bin of state.dictionary.bins) {
    const chip = document.createElement("button");
    chip.type = "button";
    const active = state.selectedBinFilter === bin.id;
    const binInfo = binDisplay(bin);
    chip.className = `chip${active ? " active" : ""}`;
    chip.innerHTML = `${binIconSvg(bin.id)} <span></span>`;
    chip.querySelector("span").textContent = binInfo.short;
    if (active) {
      chip.style.background = bin.color_hex;
      chip.style.color = bin.text_color_hex || "#ffffff";
    }
    chip.addEventListener("click", () => {
      state.selectedBinFilter = active ? null : bin.id;
      renderBinFilterChips();
      renderSearchList();
    });
    el.binFilterChips.appendChild(chip);
  }
}

function renderSearchList() {
  if (!state.dictionary) return;
  const rawValue = el.searchInput.value;
  el.clearSearchBtn?.classList.toggle("hidden", rawValue.length === 0);

  const query = normalizeText(rawValue.trim());
  const tokens = query ? query.split(/\s+/) : [];

  const matches = state.dictionary.items.filter((item) => {
    if (state.selectedBinFilter !== null && item.bin_id !== state.selectedBinFilter) {
      return false;
    }
    if (tokens.length === 0) return true;
    const binInfo = binDisplay(state.binsById.get(item.bin_id));
    const hay = normalizeText(`${item.name_it} ${item.bin_label} ${binInfo.label} ${(item.prompts_en || []).join(" ")}`);
    return tokens.every((tok) => hay.includes(tok));
  });

  el.searchCount.textContent = t("itemsFound", matches.length);
  el.searchList.innerHTML = "";

  if (matches.length === 0) {
    const empty = document.createElement("div");
    empty.className = "empty-state";
    empty.innerHTML = `<p></p><button type="button" class="btn btn--ghost"></button>`;
    empty.querySelector("p").textContent = t("searchEmpty");
    const resetBtn = empty.querySelector("button");
    resetBtn.textContent = t("resetFilters");
    resetBtn.addEventListener("click", () => {
      el.searchInput.value = "";
      state.selectedBinFilter = null;
      renderBinFilterChips();
      renderSearchList();
    });
    el.searchList.appendChild(empty);
    return;
  }

  const frag = document.createDocumentFragment();
  for (const item of matches) {
    const bin = state.binsById.get(item.bin_id);
    const nameInfo = itemDisplay(item);
    const binInfo = binDisplay(bin);
    const isExpanded = state.expandedSearchId === item.id;

    const row = document.createElement("button");
    row.type = "button";
    row.className = `search-item${isExpanded ? " is-expanded" : ""}`;
    row.setAttribute("aria-expanded", String(isExpanded));

    row.innerHTML = `
      <div class="search-item__header">
        <div class="search-item__main">
          <div class="search-item__name"></div>
          ${nameInfo.secondary ? '<div class="item-subtitle"></div>' : ""}
          <span class="bin-badge" style="background:${bin.color_hex};color:${bin.text_color_hex || "#ffffff"}">${binIconSvg(bin.id)} <span></span></span>
        </div>
        ${CHEVRON_SVG}
      </div>
      <div class="result-card__guidance${isExpanded ? "" : " hidden"}">
        <strong></strong>
        <span></span>
      </div>
    `;

    row.querySelector(".search-item__name").textContent = nameInfo.primary;
    if (nameInfo.secondary) {
      row.querySelector(".item-subtitle").textContent = nameInfo.secondary;
    }
    row.querySelector(".bin-badge span").textContent = binInfo.label;
    row.querySelector(".result-card__guidance strong").textContent = t("whereToDispose");
    row.querySelector(".result-card__guidance span").textContent = binInfo.guidance;

    row.addEventListener("click", () => {
      state.expandedSearchId = state.expandedSearchId === item.id ? null : item.id;
      renderSearchList();
    });

    frag.appendChild(row);
  }
  el.searchList.appendChild(frag);
}

function createSourceLink(href, label) {
  const link = document.createElement("a");
  link.href = href;
  link.target = "_blank";
  link.rel = "noopener noreferrer";
  link.innerHTML = `<span></span><svg class="icon icon--xs" viewBox="0 0 24 24" aria-hidden="true"><path d="M7 17 17 7"/><path d="M7 7h10v10"/></svg>`;
  link.querySelector("span").textContent = label;
  return link;
}

function renderGuide() {
  const dict = state.dictionary;
  el.guideBinsList.innerHTML = "";
  for (const bin of dict.bins) {
    const binInfo = binDisplay(bin);
    const card = document.createElement("div");
    card.className = "guide-card";
    card.innerHTML = `
      <div class="guide-icon" style="background:${bin.color_hex};color:${bin.text_color_hex || "#ffffff"}">${binIconSvg(bin.id, "icon--md")}</div>
      <div>
        <h3></h3>
        <p></p>
      </div>
    `;
    card.querySelector("h3").textContent = binInfo.label;
    card.querySelector("p").textContent = binInfo.guidance;
    el.guideBinsList.appendChild(card);
  }

  const updatedDate = dict.scraped_at ? dict.scraped_at.slice(0, 10) : "-";
  const utenzaLabel = state.lang === "en" ? "Household" : dict.utenza;
  el.sourceMeta.innerHTML = `
    <dt>${t("metaVersion")}</dt><dd>v${APP_VERSION}</dd>
    <dt>${t("metaMunicipality")}</dt><dd>${dict.comune} (${utenzaLabel})</dd>
    <dt>${t("metaItems")}</dt><dd>${dict.item_count}</dd>
    <dt>${t("metaUpdated")}</dt><dd>${updatedDate}</dd>
    <dt>${t("metaModel")}</dt><dd>${dict.model_name} (${dict.model_license || "MIT"})</dd>
  `;

  el.sourceLinks.innerHTML = "";
  el.sourceLinks.appendChild(
    createSourceLink(
      "https://dolomitiambiente.it/it/trento/domestica/raccolta-differenziata/guida-alla-raccolta",
      t("linkGuide")
    )
  );
  el.sourceLinks.appendChild(createSourceLink(dict.source_url, t("linkDict")));
  if (dict.pdf_url) {
    el.sourceLinks.appendChild(createSourceLink(dict.pdf_url, t("linkPdf")));
  }
}

function switchTab(tabName) {
  document.querySelectorAll(".tab-panel").forEach((panel) => {
    panel.classList.toggle("active", panel.id === `tab-${tabName}`);
  });
  document.querySelectorAll(".tab-btn").forEach((btn) => {
    btn.classList.toggle("active", btn.dataset.tab === tabName);
  });
  window.scrollTo({ top: 0, behavior: "instant" });
}

function maybeShowIOSInstallHint() {
  const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
  const isStandalone = window.matchMedia("(display-mode: standalone)").matches || window.navigator.standalone;
  const dismissed = localStorage.getItem("ricicla_install_hint_dismissed") === "1";
  if (isIOS && !isStandalone && !dismissed) {
    el.iosInstallHint.classList.remove("hidden");
  }
}

function applyTheme(theme, persist = false) {
  document.documentElement.dataset.theme = theme;
  if (persist) {
    localStorage.setItem("ricicla_theme", theme);
  }
  const meta = $("meta-theme-color");
  if (meta) {
    meta.content = theme === "dark" ? "#0b1218" : "#006390";
  }
  if (el.themeIconMoon && el.themeIconSun && el.themeToggleLabel) {
    if (theme === "dark") {
      el.themeIconMoon.classList.add("hidden");
      el.themeIconSun.classList.remove("hidden");
      el.themeToggleLabel.textContent = t("themeLight");
      el.themeToggle.title = t("themeLight");
      el.themeToggle.setAttribute("aria-label", t("themeLight"));
    } else {
      el.themeIconSun.classList.add("hidden");
      el.themeIconMoon.classList.remove("hidden");
      el.themeToggleLabel.textContent = t("themeDark");
      el.themeToggle.title = t("themeDark");
      el.themeToggle.setAttribute("aria-label", t("themeDark"));
    }
  }
}

function setupDropZone() {
  const card = el.previewCard;
  const placeholder = el.previewPlaceholder;
  if (!card || !placeholder) return;

  placeholder.addEventListener("click", () => el.galleryInput.click());
  placeholder.addEventListener("keydown", (e) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      el.galleryInput.click();
    }
  });

  ["dragenter", "dragover"].forEach((evt) => {
    card.addEventListener(evt, (e) => {
      e.preventDefault();
      card.classList.add("is-dragover");
    });
  });

  ["dragleave", "drop"].forEach((evt) => {
    card.addEventListener(evt, (e) => {
      e.preventDefault();
      card.classList.remove("is-dragover");
    });
  });

  card.addEventListener("drop", (e) => {
    const file = e.dataTransfer?.files?.[0];
    if (file && file.type.startsWith("image/")) {
      handleImageFile(file);
    }
  });
}

function registerServiceWorker() {
  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.register("./sw.js").catch((err) => {
      console.warn("Service worker registration failed:", err);
    });
    navigator.serviceWorker.addEventListener("message", (event) => {
      if (event.data?.type === "DATA_UPDATED") {
        initDictionaryAndEmbeddings().catch((err) => {
          console.warn("Background dictionary refresh failed:", err);
        });
      }
    });
  }
}

async function bootstrap() {
  el.themeToggle = $("theme-toggle");
  el.themeIconMoon = $("theme-icon-moon");
  el.themeIconSun = $("theme-icon-sun");
  el.themeToggleLabel = $("theme-toggle-label");
  el.updateBanner = $("update-banner");
  el.dismissUpdateBanner = $("dismiss-update-banner");
  el.modelStatus = $("model-status");
  el.modelStatusText = $("model-status-text");
  el.iosInstallHint = $("ios-install-hint");
  el.dismissInstallHint = $("dismiss-install-hint");
  el.previewCard = $("preview-card");
  el.previewImage = $("preview-image");
  el.scanOverlay = $("scan-overlay");
  el.clearImageBtn = $("clear-image-btn");
  el.previewPlaceholder = $("preview-placeholder");
  el.cameraInput = $("camera-input");
  el.galleryInput = $("gallery-input");
  el.scanLoading = $("scan-loading");
  el.scanError = $("scan-error");
  el.resultsSection = $("results-section");
  el.resultsList = $("results-list");
  el.inferenceMeta = $("inference-meta");
  el.privacyCard = $("privacy-card");
  el.jumpToSearchBtn = $("jump-to-search-btn");
  el.searchInput = $("search-input");
  el.clearSearchBtn = $("clear-search-btn");
  el.binFilterChips = $("bin-filter-chips");
  el.searchCount = $("search-count");
  el.searchList = $("search-list");
  el.guideBinsList = $("guide-bins-list");
  el.sourceMeta = $("source-meta");
  el.sourceLinks = $("source-links");

  el.cameraInput.addEventListener("change", (e) => handleImageFile(e.target.files?.[0]));
  el.galleryInput.addEventListener("change", (e) => handleImageFile(e.target.files?.[0]));
  el.clearImageBtn.addEventListener("click", clearImage);
  el.jumpToSearchBtn.addEventListener("click", () => {
    switchTab("search");
    el.searchInput.focus();
  });
  el.searchInput.addEventListener("input", renderSearchList);
  el.clearSearchBtn?.addEventListener("click", () => {
    el.searchInput.value = "";
    renderSearchList();
    el.searchInput.focus();
  });

  setupDropZone();

  el.dismissInstallHint.addEventListener("click", () => {
    el.iosInstallHint.classList.add("hidden");
    localStorage.setItem("ricicla_install_hint_dismissed", "1");
  });

  el.dismissUpdateBanner.addEventListener("click", () => {
    el.updateBanner.classList.add("hidden");
  });

  document.querySelectorAll(".tab-btn").forEach((btn) => {
    btn.addEventListener("click", () => switchTab(btn.dataset.tab));
  });

  document.querySelectorAll(".lang-btn").forEach((btn) => {
    btn.addEventListener("click", () => applyLanguage(btn.dataset.lang, true));
  });

  const savedLang = localStorage.getItem("ricicla_lang");
  const initialLang =
    savedLang === "it" || savedLang === "en"
      ? savedLang
      : navigator.language?.toLowerCase().startsWith("en")
        ? "en"
        : "it";

  const initialTheme = document.documentElement.dataset.theme === "dark" ? "dark" : "light";
  applyTheme(initialTheme, false);
  el.themeToggle.addEventListener("click", () => {
    const next = document.documentElement.dataset.theme === "dark" ? "light" : "dark";
    applyTheme(next, true);
  });

  applyLanguage(initialLang, false);
  maybeShowIOSInstallHint();
  registerServiceWorker();

  try {
    await initDictionaryAndEmbeddings();
    await initOnnxSession();
    if (state.currentImageBitmap) {
      await classifyCurrentImage();
    }
  } catch (err) {
    console.error(err);
    setModelStatus("error", t("statusError"));
    showError(err.message || "Error");
  }
}

window.addEventListener("DOMContentLoaded", bootstrap);
