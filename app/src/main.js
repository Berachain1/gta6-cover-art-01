// main.js — the editor behind Palm Heat Cover Studio.
//
// This module wires the whole studio: choosing and dropping in photos,
// the bundled sample set, the layout and grade pickers, the caption
// fields, per-panel cropping and positioning (click to select a panel,
// drag to pan it, scroll to zoom), undo plus redo, and PNG export in
// all three post sizes. A `?shot=` query in the URL swaps the editor
// for a fixed screenshot scene instead — the scenes live in ./shots.js.

import { EXPORT_SIZES, GRADES, LAYOUTS, drawCoverGrid, exportCoverPNG, layoutPanels, panelCount } from "./cover.js";
import { runShot } from "./shots.js";

// The sample photos the app ships with: {name, src} objects, name
// being the label the strip shows under each thumbnail.
const SAMPLE_PHOTOS = [
  { src: "samples/woman.jpg", name: "Woman · convertible" },
  { src: "samples/fisherman.jpg", name: "Fisherman · pier" },
  { src: "samples/neon.jpg", name: "Friends · neon street" },
  { src: "samples/rooftop.jpg", name: "Man · rooftop" },
  { src: "samples/boulevard.jpg", name: "Boulevard · kit" },
  { src: "samples/pier.jpg", name: "Pier · kit" },
  { src: "samples/car.jpg", name: "Orange car · deco street" },
  { src: "samples/coast.jpg", name: "Coast road · sunset" },
  { src: "samples/sunset.jpg", name: "Woman · sunset convertible" },
];

// Caption chips for the panels {line, time, place}, one per sample
// photo. The wording is original — the same kind of location/time
// chips the top-5 covers carry on theirs.
const CAPTIONS = [
  { place: "CORAL DRIVE", time: "6:47 PM", line: "ENGINE RUNNING" },
  { place: "PIER 26", time: "5:30 AM", line: "FIRST CAST" },
  { place: "NEON MILE", time: "11:50 PM", line: "NO BRAKES" },
  { place: "ROOFTOP 9", time: "8:30 PM", line: "CITY LIGHTS" },
  { place: "PALM ROW", time: "9:15 PM", line: "AFTER DARK" },
  { place: "TOWER 2", time: "6:10 PM", line: "GOLDEN HOUR" },
  { place: "DECO ROW", time: "7:05 PM", line: "TOP DOWN" },
  { place: "COAST ROAD", time: "6:58 PM", line: "LAST LIGHT" },
  { place: "CORAL DRIVE", time: "7:42 PM", line: "GOLDEN HOUR" },
];

// Default crop per panel, per layout. A crop is
// {photo, fx, fy, zoom}, with an optional `sq` slot carrying the
// square-only override as {photo, fx, fy, zoom}. fx/fy is the focus
// point (0..1) inside the photo; zoom is >= 1. The crops are picked
// so faces stay in frame and no panel shows an awkward body-part cut.
//
// hero-vice is MULTI-SUBJECT (v3): six different photos, one per
// panel — the variety the top-5 covers have. The hero is the woman
// with the pink convertible, her face whole (x about 0.42, y about
// 0.32); the other panels are the rooftop man, the neon couple, the
// fisherman, the orange car and the coast road, each cropped so its
// subject stays in frame.
//
// chaos is the v4 default: the top-3 key-art collage. Same six
// photos as hero-vice (woman hero, rooftop man, neon couple,
// fisherman, orange car, coast road), each cropped so its subject
// stays in frame. v5: the hero is the SUNSET woman (photo 8, a
// blazing sky — #1's glow was the one gap no layout fix could
// close).
//
// The 3-panel row in portrait and square runs P1 P2 P3, and the title
// crashes over the whole row — a face in the LEFT column sits behind
// the "P" and can never escape it, so the row is ordered face-free on
// the left: car (no face), neon, rooftop (right column, where the
// fisherman's face already escaped the "T"). Landscape is unaffected:
// P1 mid-top and P3 right-top both sit fully above the title, so car,
// rooftop and fisherman all stay whole there.
//
// Square is the awkward one: its 3-panel row is short (0.44h), the
// title's letters cover the whole row top, and the rooftop face —
// sitting at the top of its photo — cannot be cropped below the
// letters at any zoom (verified: zoom 1.35 only pushed the beard
// below them). So P3 carries an `sq` override: the coast road (no
// face) in square only. The override lives in cover.js
// (drawCoverGrid, w === h).
const DEFAULT_CROPS = {
  chaos: [
    { photo: 8, fx: 0.42, fy: 0.32, zoom: 1.05 },
    { photo: 6, fx: 0.55, fy: 0.55, zoom: 1.15 },
    { photo: 2, fx: 0.55, fy: 0.42, zoom: 1.1 },
    { photo: 3, fx: 0.48, fy: 0.28, zoom: 1, sq: { photo: 7, fx: 0.45, fy: 0.55, zoom: 1.15 } },
    { photo: 1, fx: 0.48, fy: 0.3, zoom: 1 },
    { photo: 7, fx: 0.45, fy: 0.55, zoom: 1.15 },
  ],
  "hero-vice": [
    { photo: 0, fx: 0.42, fy: 0.32, zoom: 1.05 },
    { photo: 3, fx: 0.48, fy: 0.3, zoom: 1.15 },
    { photo: 2, fx: 0.55, fy: 0.42, zoom: 1.1 },
    { photo: 1, fx: 0.48, fy: 0.3, zoom: 1 },
    { photo: 6, fx: 0.55, fy: 0.55, zoom: 1.15 },
    { photo: 7, fx: 0.45, fy: 0.55, zoom: 1.15 },
  ],
  "vice-grid": [
    { photo: 0, fx: 0.5, fy: 0.32, zoom: 1.15 },
    { photo: 3, fx: 0.5, fy: 0.35, zoom: 1.1 },
    { photo: 1, fx: 0.5, fy: 0.35, zoom: 1.15 },
    { photo: 2, fx: 0.5, fy: 0.45, zoom: 1.05 },
    { photo: 6, fx: 0.55, fy: 0.55, zoom: 1.15 },
    { photo: 4, fx: 0.5, fy: 0.3, zoom: 1.25 },
    { photo: 7, fx: 0.45, fy: 0.55, zoom: 1.15 },
    { photo: 2, fx: 0.72, fy: 0.45, zoom: 1.4 },
  ],
  "hero-three": [
    { photo: 0, fx: 0.5, fy: 0.32, zoom: 1.05 },
    { photo: 2, fx: 0.5, fy: 0.45, zoom: 1.1 },
    { photo: 1, fx: 0.5, fy: 0.35, zoom: 1.2 },
    { photo: 3, fx: 0.5, fy: 0.35, zoom: 1.15 },
  ],
  tilted: [
    { photo: 0, fx: 0.5, fy: 0.32, zoom: 1.1 },
    { photo: 1, fx: 0.5, fy: 0.35, zoom: 1.15 },
    { photo: 2, fx: 0.5, fy: 0.45, zoom: 1.1 },
    { photo: 3, fx: 0.5, fy: 0.35, zoom: 1.2 },
    { photo: 6, fx: 0.55, fy: 0.55, zoom: 1.1 },
  ],
  "full-bleed": [
    { photo: 0, fx: 0.5, fy: 0.35, zoom: 1.05 },
    { photo: 2, fx: 0.5, fy: 0.45, zoom: 1.1 },
    { photo: 1, fx: 0.5, fy: 0.35, zoom: 1.2 },
  ],
};

/** A fresh default state (screenshot scenes start from this as well). */
export function defaultState() {
  return {
    layout: "chaos",
    grade: "sunset",
    title: "PALM HEAT",
    subtitle: "where the sun never sets",
    place: "CORAL BAY",
    tagline: "EVERY STREET HAS A STORY",
    heat: 5,
    onePhoto: false,
    showRibbon: true,
    showBarcode: true,
    showCaptions: true,
    captions: CAPTIONS.map((c) => ({ place: c.place, time: c.time, line: c.line })),
    size: "landscape",
    assignments: JSON.parse(JSON.stringify(DEFAULT_CROPS)),
    selectedPanel: 0,
  };
}

export const state = defaultState();
export const photos = []; // loaded Image elements; index matches photoNames
const photoNames = SAMPLE_PHOTOS.map((p) => p.name);

/** Loads one image, resolving once it is drawable. */
export function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.addEventListener("load", () => resolve(img));
    img.addEventListener("error", () => reject(new Error("could not load " + src)));
    img.src = src;
  });
}

/** Loads every sample photo; resolves once all are drawable. */
export async function loadSamplePhotos() {
  photos.length = 0;
  for (const p of SAMPLE_PHOTOS) {
    photos.push(await loadImage(p.src));
  }
  return photos;
}

const canvas = document.querySelector("#cover");
const status = document.querySelector("#status");
let undos = [];
let redos = [];
let panels = [];

/** Serialises the editable part of the state for undo / redo. */
function snapshotState() {
  const { selectedPanel, ...keep } = state;
  return JSON.stringify(keep);
}

function pushUndo() {
  undos.push(snapshotState());
  while (undos.length > 40) {
    undos.shift();
  }
  redos = [];
  updateUndoButtons();
}

function applySnapshot(snap) {
  const saved = JSON.parse(snap);
  for (const key of Object.keys(saved)) {
    state[key] = saved[key];
  }
  syncControls();
  paintPreview();
}

export function undo() {
  const snap = undos.pop();
  if (snap === undefined) {
    return; // nothing to undo
  }
  redos.push(snapshotState());
  applySnapshot(snap);
  updateUndoButtons();
}

export function redo() {
  const snap = redos.pop();
  if (snap === undefined) {
    return; // nothing to redo
  }
  undos.push(snapshotState());
  applySnapshot(snap);
  updateUndoButtons();
}

function updateUndoButtons() {
  const u = document.querySelector("#undo");
  const r = document.querySelector("#redo");
  if (u !== null) u.disabled = undos.length === 0;
  if (r !== null) r.disabled = redos.length === 0;
}

/** Redraws the live preview at the selected post size. */
export function paintPreview() {
  const size = EXPORT_SIZES[state.size];
  canvas.width = size.w;
  canvas.height = size.h;
  canvas.style.aspectRatio = `${size.w} / ${size.h}`;
  const out = drawCoverGrid(canvas, state, photos);
  panels = out.panels;
  drawSelection();
  status.textContent = `Preview · ${size.label} · ${LAYOUTS[state.layout]} · ${GRADES[state.grade]}`;
}

/** Outlines the selected panel on the preview canvas. */
function drawSelection() {
  const sel = panels[state.selectedPanel];
  if (sel === undefined) {
    return; // no panel selected
  }
  const ctx = canvas.getContext("2d");
  ctx.save();
  ctx.strokeStyle = "#ffd23f";
  ctx.lineWidth = Math.max(canvas.width / 480, 3);
  ctx.setLineDash([18, 10]);
  ctx.strokeRect(2 + sel.x, 2 + sel.y, sel.w - 4, sel.h - 4);
  ctx.setLineDash([]);
  ctx.fillStyle = "#ffd23f";
  ctx.font = "bold " + Math.max(canvas.width / 64, 16) + "px sans-serif";
  ctx.textAlign = "left";
  ctx.fillText(`PANEL ${1 + state.selectedPanel}`, 14 + sel.x, Math.max(canvas.width / 48, 22) + sel.y);
  ctx.restore();
}

/**
 * Fills every panel of every layout with one photo (the #2 trick: one
 * face, many crops, so the cover stays consistent).
 */
export function fillAllWithPhoto(photoIndex) {
  pushUndo();
  const xs = [0.5, 0.3, 0.7, 0.5, 0.25, 0.75, 0.5, 0.35];
  const ys = [0.32, 0.45, 0.4, 0.3, 0.5, 0.42, 0.6, 0.35];
  for (const key of Object.keys(state.assignments)) {
    state.assignments[key] = state.assignments[key].map((c, i) => ({
      ...c,
      photo: photoIndex,
      fx: xs[i % xs.length],
      fy: ys[i % ys.length],
      zoom: 1.25,
    }));
  }
  paintPreview();
}

/** Puts a photo into the selected panel (or all panels, in one-photo mode). */
export function assignPhotoToSelected(photoIndex) {
  pushUndo();
  const list = state.assignments[state.layout];
  const slot = list[state.selectedPanel];
  if (slot !== undefined) {
    slot.photo = photoIndex;
  }
  state.onePhoto ? fillAllWithPhoto(photoIndex) : paintPreview();
  renderPhotoStrip();
}

/** Cycles the selected panel to the next photo. */
export function cyclePanelPhoto() {
  const list = state.assignments[state.layout];
  const slot = list[state.selectedPanel];
  if (slot !== undefined) {
    assignPhotoToSelected((slot.photo + 1) % photos.length);
  }
}

function syncControls() {
  const fill = (id, value) => {
    const el = document.getElementById(id);
    if (el !== null) el.value = value;
  };
  fill("title", state.title);
  fill("subtitle", state.subtitle);
  fill("place", state.place);
  fill("tagline", state.tagline);
  for (const btn of document.querySelectorAll("#layout-pick button")) {
    btn.classList.toggle("active", state.layout === btn.dataset.layout);
  }
  for (const btn of document.querySelectorAll("#grade-pick button")) {
    btn.classList.toggle("active", state.grade === btn.dataset.grade);
  }
  for (const btn of document.querySelectorAll("#size-pick button")) {
    btn.classList.toggle("active", state.size === btn.dataset.size);
  }
  document.querySelectorAll("#heat-pick button").forEach((btn, n) => {
    btn.classList.toggle("active", n < state.heat);
  });
  const one = document.querySelector("#one-photo");
  if (one !== null) one.checked = state.onePhoto;
  const cap = document.querySelector("#captions");
  if (cap !== null) cap.checked = state.showCaptions !== false;
  const zoom = document.getElementById("zoom");
  const slot = state.assignments[state.layout]?.[state.selectedPanel];
  if (zoom !== null && slot !== undefined) {
    zoom.value = slot.zoom;
  }
  renderPhotoStrip();
}

/** The photo strip: samples plus uploads; click to fill the selected panel. */
function renderPhotoStrip() {
  const el = document.querySelector("#photo-strip");
  if (el === null) {
    return; // no strip on this page
  }
  el.innerHTML = "";
  photos.forEach((img, idx) => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "thumb";
    const label = photoNames[idx] ?? "Photo " + (idx + 1);
    btn.title = label;
    const thumb = document.createElement("img");
    thumb.src = img.src;
    thumb.alt = btn.title;
    btn.appendChild(thumb);
    const slot = state.assignments[state.layout]?.[state.selectedPanel];
    if (idx === slot?.photo) {
      btn.classList.add("in-use");
    }
    btn.addEventListener("click", () => assignPhotoToSelected(idx));
    el.appendChild(btn);
  });
}

/** Downloads a blob as a file. */
function downloadBlob(blob, name) {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = name;
  a.click();
  setTimeout(() => { URL.revokeObjectURL(a.href); }, 5000);
}

/** Exports the current cover at one post size. */
export async function exportPNG(sizeKey) {
  const blob = await exportCoverPNG(state, photos, sizeKey);
  const size = EXPORT_SIZES[sizeKey];
  downloadBlob(blob, `palm-heat-cover-${size.w}x${size.h}.png`);
  status.textContent = `Saved palm-heat-cover-${size.w}x${size.h}.png`;
}

/** Exports all three post sizes, one PNG each. */
export async function exportAllSizes() {
  for (const k of Object.keys(EXPORT_SIZES)) {
    await exportPNG(k);
  }
  status.textContent = "All 3 sizes saved: 1920 × 1080, 1080 × 1350, 1080 × 1080";
}

/** Adds user files as photos (read locally only — never uploaded). */
export async function addUserFiles(files) {
  for (const f of files) {
    if (f.type.startsWith("image/")) {
      const img = await loadImage(URL.createObjectURL(f));
      photos.push(img);
      photoNames.push(f.name);
    }
  }
  renderPhotoStrip();
  paintPreview();
}

/** Maps a click on the preview canvas to a panel index (topmost first). */
function panelAt(clientX, clientY) {
  const r = canvas.getBoundingClientRect();
  const x = canvas.width * ((clientX - r.left) / r.width);
  const y = canvas.height * ((clientY - r.top) / r.height);
  let i = panels.length;
  while (i > 0) {
    i -= 1;
    const panel = panels[i];
    if (x >= panel.x && x <= panel.x + panel.w && y >= panel.y && y <= panel.y + panel.h) {
      return i;
    }
  }
  return -1;
}

/** Wires every control in the editor shell to the state. */
function bindEditor() {
  document.getElementById("photo").addEventListener("change", (ev) => {
    addUserFiles(Array.from(ev.target.files));
    ev.target.value = "";
  });
  const drop = document.getElementById("dropzone");
  drop.addEventListener("dragover", (ev) => {
    ev.preventDefault();
    drop.classList.add("over");
  });
  drop.addEventListener("dragleave", () => drop.classList.remove("over"));
  drop.addEventListener("drop", (ev) => {
    ev.preventDefault();
    drop.classList.remove("over");
    addUserFiles(Array.from(ev.dataTransfer.files));
  });
  for (const btn of document.querySelectorAll("#layout-pick button")) {
    btn.addEventListener("click", () => {
      pushUndo();
      state.layout = btn.dataset.layout;
      state.selectedPanel = 0;
      syncControls();
      paintPreview();
    });
  }
  for (const btn of document.querySelectorAll("#grade-pick button")) {
    btn.addEventListener("click", () => {
      pushUndo();
      state.grade = btn.dataset.grade;
      syncControls();
      paintPreview();
    });
  }
  for (const btn of document.querySelectorAll("#size-pick button")) {
    btn.addEventListener("click", () => {
      state.size = btn.dataset.size;
      syncControls();
      paintPreview();
    });
  }
  document.querySelectorAll("#heat-pick button").forEach((btn, n) => {
    btn.addEventListener("click", () => {
      pushUndo();
      state.heat = n + 1;
      syncControls();
      paintPreview();
    });
  });
  ["title", "subtitle", "place", "tagline"].forEach((id) => {
    document.getElementById(id).addEventListener("input", (ev) => {
      state[id] = ev.target.value;
      paintPreview();
    });
    document.getElementById(id).addEventListener("change", pushUndo);
  });
  document.getElementById("one-photo").addEventListener("change", (ev) => {
    pushUndo();
    state.onePhoto = ev.target.checked;
    if (state.onePhoto) {
      const slot = state.assignments[state.layout]?.[state.selectedPanel];
      if (slot !== undefined) {
        fillAllWithPhoto(slot.photo);
      }
    } else {
      paintPreview();
    }
  });
  document.getElementById("captions").addEventListener("change", (ev) => {
    pushUndo();
    state.showCaptions = ev.target.checked;
    paintPreview();
  });
  document.getElementById("cycle-photo").addEventListener("click", cyclePanelPhoto);
  document.getElementById("zoom").addEventListener("input", (ev) => {
    const slot = state.assignments[state.layout]?.[state.selectedPanel];
    if (slot !== undefined) {
      slot.zoom = Number(ev.target.value);
      paintPreview();
    }
  });
  document.getElementById("zoom").addEventListener("change", pushUndo);
  document.getElementById("export").addEventListener("click", () => exportPNG(state.size));
  document.getElementById("export-all").addEventListener("click", exportAllSizes);
  document.getElementById("undo").addEventListener("click", undo);
  document.getElementById("redo").addEventListener("click", redo);

  // Click a panel to select it; drag on it to pan its crop; wheel to zoom.
  let drag = null;
  canvas.addEventListener("pointerdown", (ev) => {
    const i = panelAt(ev.clientX, ev.clientY);
    if (i >= 0) {
      state.selectedPanel = i;
      const slot = state.assignments[state.layout]?.[i];
      drag = { x: ev.clientX, y: ev.clientY, fx: slot.fx, fy: slot.fy };
      canvas.setPointerCapture(ev.pointerId);
      paintPreview();
    }
  });
  canvas.addEventListener("pointermove", (ev) => {
    if (drag !== null) {
      const slot = state.assignments[state.layout]?.[state.selectedPanel];
      const r = canvas.getBoundingClientRect();
      const p = panels[state.selectedPanel];
      if (slot !== undefined && p !== undefined) {
        const dx = ((ev.clientX - drag.x) / r.width) * (canvas.width / p.w);
        const dy = ((ev.clientY - drag.y) / r.height) * (canvas.height / p.h);
        slot.fx = Math.min(1, Math.max(0, drag.fx - dx));
        slot.fy = Math.min(1, Math.max(0, drag.fy - dy));
        paintPreview();
      }
    }
  });
  canvas.addEventListener("pointerup", () => {
    if (drag !== null) {
      pushUndo();
      drag = null;
    }
  });
  canvas.addEventListener("wheel", (ev) => {
    ev.preventDefault();
    const slot = state.assignments[state.layout]?.[state.selectedPanel];
    if (slot === undefined) {
      return; // no panel to zoom
    }
    const factor = ev.deltaY < 0 ? 1.08 : 0.93;
    slot.zoom = Math.min(3, Math.max(1, slot.zoom * factor));
    const zoomEl = document.getElementById("zoom");
    if (zoomEl !== null) {
      zoomEl.value = slot.zoom;
    }
    paintPreview();
  }, { passive: false });
  document.addEventListener("keydown", (ev) => {
    const meta = ev.ctrlKey || ev.metaKey;
    const k = ev.key.toLowerCase();
    if (meta && k === "z" && !ev.shiftKey) {
      ev.preventDefault();
      undo();
    }
    if (meta && (k === "y" || (k === "z" && ev.shiftKey))) {
      ev.preventDefault();
      redo();
    }
  });
}

const params = new URLSearchParams(window.location.search);
const scene = params.get("shot");
if (scene === null || scene === "") {
  await document.fonts.ready;
  await document.fonts.load("40px Pacifico");
  await document.fonts.load("100px Anton");
  await loadSamplePhotos();
  bindEditor();
  syncControls();
  paintPreview();
} else {
  runShot(scene, params, { canvas: canvas, state: state, photos: photos, loadSamplePhotos: loadSamplePhotos, loadImage: loadImage, renderPreview: paintPreview, bindEditor: bindEditor, syncControls: syncControls });
}
