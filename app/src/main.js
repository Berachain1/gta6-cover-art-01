// main.js — the editor behind Palm Heat Cover Studio.
//
// This module wires the whole studio: choosing and dropping in photos,
// the bundled sample set, the layout and grade pickers, the caption
// fields, per-panel cropping and positioning (click to select a panel,
// drag to pan it, scroll to zoom), undo plus redo, and PNG export in
// all three post sizes. A `?shot=` query in the URL swaps the editor
// for a fixed screenshot scene instead — the scenes live in ./shots.js.

import { layoutPanels, panelCount, drawCoverGrid, exportCoverPNG, LAYOUTS, GRADES, EXPORT_SIZES } from "./cover.js";
import { runShot } from "./shots.js";

// The sample photos the app ships with: {src, name} objects, name
// being the label the strip shows under each thumbnail.
const SAMPLE_SHOTS = [
  { name: "Woman · convertible", src: "samples/woman.jpg" },
  { name: "Fisherman · pier", src: "samples/fisherman.jpg" },
  { name: "Friends · neon street", src: "samples/neon.jpg" },
  { name: "Man · rooftop", src: "samples/rooftop.jpg" },
  { name: "Boulevard · kit", src: "samples/boulevard.jpg" },
  { name: "Pier · kit", src: "samples/pier.jpg" },
  { name: "Orange car · deco street", src: "samples/car.jpg" },
  { name: "Coast road · sunset", src: "samples/coast.jpg" },
  { name: "Woman · sunset convertible", src: "samples/sunset.jpg" },
];

// Caption chips for the panels {place, time, line}, one per sample
// photo. The wording is original — the same kind of location/time
// chips the top-5 covers carry on theirs.
const CAPTIONS = [
  { line: "ENGINE RUNNING", place: "CORAL DRIVE", time: "6:47 PM" },
  { line: "FIRST CAST", place: "PIER 26", time: "5:30 AM" },
  { line: "NO BRAKES", place: "NEON MILE", time: "11:50 PM" },
  { line: "CITY LIGHTS", place: "ROOFTOP 9", time: "8:30 PM" },
  { line: "AFTER DARK", place: "PALM ROW", time: "9:15 PM" },
  { line: "GOLDEN HOUR", place: "TOWER 2", time: "6:10 PM" },
  { line: "TOP DOWN", place: "DECO ROW", time: "7:05 PM" },
  { line: "LAST LIGHT", place: "COAST ROAD", time: "6:58 PM" },
  { line: "GOLDEN HOUR", place: "CORAL DRIVE", time: "7:42 PM" },
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
    { fx: 0.42, fy: 0.32, photo: 8, zoom: 1.05 },
    { fx: 0.55, fy: 0.55, photo: 6, zoom: 1.15 },
    { fx: 0.55, fy: 0.42, photo: 2, zoom: 1.1 },
    { fx: 0.48, fy: 0.28, photo: 3, sq: { fx: 0.45, fy: 0.55, photo: 7, zoom: 1.15 }, zoom: 1 },
    { fx: 0.48, fy: 0.3, photo: 1, zoom: 1 },
    { fx: 0.45, fy: 0.55, photo: 7, zoom: 1.15 },
  ],
  "hero-vice": [
    { fx: 0.42, fy: 0.32, photo: 0, zoom: 1.05 },
    { fx: 0.48, fy: 0.3, photo: 3, zoom: 1.15 },
    { fx: 0.55, fy: 0.42, photo: 2, zoom: 1.1 },
    { fx: 0.48, fy: 0.3, photo: 1, zoom: 1 },
    { fx: 0.55, fy: 0.55, photo: 6, zoom: 1.15 },
    { fx: 0.45, fy: 0.55, photo: 7, zoom: 1.15 },
  ],
  "vice-grid": [
    { fx: 0.5, fy: 0.32, photo: 0, zoom: 1.15 },
    { fx: 0.5, fy: 0.35, photo: 3, zoom: 1.1 },
    { fx: 0.5, fy: 0.35, photo: 1, zoom: 1.15 },
    { fx: 0.5, fy: 0.45, photo: 2, zoom: 1.05 },
    { fx: 0.55, fy: 0.55, photo: 6, zoom: 1.15 },
    { fx: 0.5, fy: 0.3, photo: 4, zoom: 1.25 },
    { fx: 0.45, fy: 0.55, photo: 7, zoom: 1.15 },
    { fx: 0.72, fy: 0.45, photo: 2, zoom: 1.4 },
  ],
  "hero-three": [
    { fx: 0.5, fy: 0.32, photo: 0, zoom: 1.05 },
    { fx: 0.5, fy: 0.45, photo: 2, zoom: 1.1 },
    { fx: 0.5, fy: 0.35, photo: 1, zoom: 1.2 },
    { fx: 0.5, fy: 0.35, photo: 3, zoom: 1.15 },
  ],
  tilted: [
    { fx: 0.5, fy: 0.32, photo: 0, zoom: 1.1 },
    { fx: 0.5, fy: 0.35, photo: 1, zoom: 1.15 },
    { fx: 0.5, fy: 0.45, photo: 2, zoom: 1.1 },
    { fx: 0.5, fy: 0.35, photo: 3, zoom: 1.2 },
    { fx: 0.55, fy: 0.55, photo: 6, zoom: 1.1 },
  ],
  "full-bleed": [
    { fx: 0.5, fy: 0.35, photo: 0, zoom: 1.05 },
    { fx: 0.5, fy: 0.45, photo: 2, zoom: 1.1 },
    { fx: 0.5, fy: 0.35, photo: 1, zoom: 1.2 },
  ],
};

/** A fresh default state (screenshot scenes start from this as well). */
export function defaultState() {
  return {
    assignments: JSON.parse(JSON.stringify(DEFAULT_CROPS)),
    captions: CAPTIONS.map((c) => ({ line: c.line, place: c.place, time: c.time })),
    grade: "sunset",
    heat: 5,
    layout: "chaos",
    onePhoto: false,
    place: "CORAL BAY",
    selectedPanel: 0,
    showBarcode: true,
    showCaptions: true,
    showRibbon: true,
    size: "landscape",
    subtitle: "where the sun never sets",
    tagline: "EVERY STREET HAS A STORY",
    title: "PALM HEAT",
  };
}

export const doc = defaultState();
export const photos = []; // loaded Image elements; index matches shotNames
const shotNames = SAMPLE_SHOTS.map((p) => p.name);

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
export async function loadSamples() {
  photos.length = 0;
  for (const p of SAMPLE_SHOTS) {
    photos.push(await loadImage(p.src));
  }
  return photos;
}

const cv = document.querySelector("#cover");
const note = document.querySelector("#status");
let past = [];
let future = [];
let tiles = [];

/** Serialises the editable part of the document for undo / redo. */
function snapshotDoc() {
  const { selectedPanel, ...keep } = doc;
  return JSON.stringify(keep);
}

function pushUndo() {
  past.push(snapshotDoc());
  while (past.length > 40) {
    past.shift();
  }
  future = [];
  updateUndoButtons();
}

function applySnapshot(snap) {
  const saved = JSON.parse(snap);
  for (const key of Object.keys(saved)) {
    doc[key] = saved[key];
  }
  sync();
  paint();
}

export function undo() {
  const snap = past.pop();
  if (snap === undefined) {
    return; // nothing to undo
  }
  future.push(snapshotDoc());
  applySnapshot(snap);
  updateUndoButtons();
}

export function redo() {
  const snap = future.pop();
  if (snap === undefined) {
    return; // nothing to redo
  }
  past.push(snapshotDoc());
  applySnapshot(snap);
  updateUndoButtons();
}

function updateUndoButtons() {
  const u = document.querySelector("#undo");
  const r = document.querySelector("#redo");
  if (u !== null) u.disabled = past.length === 0;
  if (r !== null) r.disabled = future.length === 0;
}

/** Redraws the live preview at the selected post size. */
export function paint() {
  const size = EXPORT_SIZES[doc.size];
  cv.width = size.w;
  cv.height = size.h;
  cv.style.aspectRatio = `${size.w} / ${size.h}`;
  const out = drawCoverGrid(cv, doc, photos);
  tiles = out.panels;
  drawSelected();
  note.textContent = `Preview · ${size.label} · ${LAYOUTS[doc.layout]} · ${GRADES[doc.grade]}`;
}

/** Outlines the selected panel on the preview canvas. */
function drawSelected() {
  const sel = tiles[doc.selectedPanel];
  if (sel === undefined) {
    return; // no panel selected
  }
  const pen = cv.getContext("2d");
  pen.save();
  pen.strokeStyle = "#ffd23f";
  pen.lineWidth = Math.max(cv.width / 480, 3);
  pen.setLineDash([18, 10]);
  pen.strokeRect(2 + sel.x, 2 + sel.y, sel.w - 4, sel.h - 4);
  pen.setLineDash([]);
  pen.fillStyle = "#ffd23f";
  pen.font = "bold " + Math.max(cv.width / 64, 16) + "px sans-serif";
  pen.textAlign = "left";
  pen.fillText(`PANEL ${1 + doc.selectedPanel}`, 14 + sel.x, Math.max(cv.width / 48, 22) + sel.y);
  pen.restore();
}

/**
 * Fills every panel of every layout with one photo (the #2 trick: one
 * face, many crops, so the cover stays consistent).
 */
export function fillAllWithShot(shotIndex) {
  pushUndo();
  const xs = [0.5, 0.3, 0.7, 0.5, 0.25, 0.75, 0.5, 0.35];
  const ys = [0.32, 0.45, 0.4, 0.3, 0.5, 0.42, 0.6, 0.35];
  for (const key of Object.keys(doc.assignments)) {
    doc.assignments[key] = doc.assignments[key].map((c, i) => ({
      ...c,
      fx: xs[i % xs.length],
      fy: ys[i % ys.length],
      photo: shotIndex,
      zoom: 1.25,
    }));
  }
  paint();
}

/** Puts a photo into the selected panel (or all panels, in one-photo mode). */
export function assignShotToSelected(shotIndex) {
  pushUndo();
  const list = doc.assignments[doc.layout];
  const cell = list[doc.selectedPanel];
  if (cell !== undefined) {
    cell.photo = shotIndex;
  }
  doc.onePhoto ? fillAllWithShot(shotIndex) : paint();
  renderShotStrip();
}

/** Cycles the selected panel to the next photo. */
export function cyclePanelShot() {
  const list = doc.assignments[doc.layout];
  const cell = list[doc.selectedPanel];
  if (cell !== undefined) {
    assignShotToSelected((cell.photo + 1) % photos.length);
  }
}

function sync() {
  const fill = (id, value) => {
    const el = document.getElementById(id);
    if (el !== null) el.value = value;
  };
  fill("title", doc.title);
  fill("subtitle", doc.subtitle);
  fill("place", doc.place);
  fill("tagline", doc.tagline);
  for (const el of document.querySelectorAll("#layout-pick button")) {
    el.classList.toggle("active", doc.layout === el.dataset.layout);
  }
  for (const el of document.querySelectorAll("#grade-pick button")) {
    el.classList.toggle("active", doc.grade === el.dataset.grade);
  }
  for (const el of document.querySelectorAll("#size-pick button")) {
    el.classList.toggle("active", doc.size === el.dataset.size);
  }
  document.querySelectorAll("#heat-pick button").forEach((el, n) => {
    el.classList.toggle("active", n < doc.heat);
  });
  const one = document.querySelector("#one-photo");
  if (one !== null) one.checked = doc.onePhoto;
  const cap = document.querySelector("#captions");
  if (cap !== null) cap.checked = doc.showCaptions !== false;
  const zoom = document.getElementById("zoom");
  const cell = doc.assignments[doc.layout]?.[doc.selectedPanel];
  if (zoom !== null && cell !== undefined) {
    zoom.value = cell.zoom;
  }
  renderShotStrip();
}

/** The photo strip: samples plus uploads; click to fill the selected panel. */
function renderShotStrip() {
  const el = document.querySelector("#photo-strip");
  if (el === null) {
    return; // no strip on this page
  }
  el.innerHTML = "";
  photos.forEach((img, idx) => {
    const el2 = document.createElement("button");
    el2.type = "button";
    el2.className = "thumb";
    const label = shotNames[idx] ?? "Photo " + (idx + 1);
    el2.title = label;
    const thumb = document.createElement("img");
    thumb.src = img.src;
    thumb.alt = el2.title;
    el2.appendChild(thumb);
    const cell = doc.assignments[doc.layout]?.[doc.selectedPanel];
    if (idx === cell?.photo) {
      el2.classList.add("in-use");
    }
    el2.addEventListener("click", () => assignShotToSelected(idx));
    el.appendChild(el2);
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
  const blob = await exportCoverPNG(doc, photos, sizeKey);
  const size = EXPORT_SIZES[sizeKey];
  downloadBlob(blob, `palm-heat-cover-${size.w}x${size.h}.png`);
  note.textContent = `Saved palm-heat-cover-${size.w}x${size.h}.png`;
}

/** Exports all three post sizes, one PNG each. */
export async function exportAllSizes() {
  for (const k of Object.keys(EXPORT_SIZES)) {
    await exportPNG(k);
  }
  note.textContent = "All 3 sizes saved: 1920 × 1080, 1080 × 1350, 1080 × 1080";
}

/** Adds user files as photos (read locally only — never uploaded). */
export async function addUserFiles(files) {
  for (const f of files) {
    if (f.type.startsWith("image/")) {
      const img = await loadImage(URL.createObjectURL(f));
      photos.push(img);
      shotNames.push(f.name);
    }
  }
  renderShotStrip();
  paint();
}

/** Maps a click on the preview canvas to a panel index (topmost first). */
function tileAt(clientX, clientY) {
  const r = cv.getBoundingClientRect();
  const x = cv.width * ((clientX - r.left) / r.width);
  const y = cv.height * ((clientY - r.top) / r.height);
  let i = tiles.length;
  while (i > 0) {
    i -= 1;
    const tile = tiles[i];
    if (x >= tile.x && x <= tile.x + tile.w && y >= tile.y && y <= tile.y + tile.h) {
      return i;
    }
  }
  return -1;
}

/** Wires every control in the editor shell to the document. */
function bind() {
  document.getElementById("photo").addEventListener("change", (evt) => {
    addUserFiles(Array.from(evt.target.files));
    evt.target.value = "";
  });
  const drop = document.getElementById("dropzone");
  drop.addEventListener("dragover", (evt) => {
    evt.preventDefault();
    drop.classList.add("over");
  });
  drop.addEventListener("dragleave", () => drop.classList.remove("over"));
  drop.addEventListener("drop", (evt) => {
    evt.preventDefault();
    drop.classList.remove("over");
    addUserFiles(Array.from(evt.dataTransfer.files));
  });
  for (const el of document.querySelectorAll("#layout-pick button")) {
    el.addEventListener("click", () => {
      pushUndo();
      doc.layout = el.dataset.layout;
      doc.selectedPanel = 0;
      sync();
      paint();
    });
  }
  for (const el of document.querySelectorAll("#grade-pick button")) {
    el.addEventListener("click", () => {
      pushUndo();
      doc.grade = el.dataset.grade;
      sync();
      paint();
    });
  }
  for (const el of document.querySelectorAll("#size-pick button")) {
    el.addEventListener("click", () => {
      doc.size = el.dataset.size;
      sync();
      paint();
    });
  }
  document.querySelectorAll("#heat-pick button").forEach((el, n) => {
    el.addEventListener("click", () => {
      pushUndo();
      doc.heat = n + 1;
      sync();
      paint();
    });
  });
  ["title", "subtitle", "place", "tagline"].forEach((id) => {
    document.getElementById(id).addEventListener("input", (evt) => {
      doc[id] = evt.target.value;
      paint();
    });
    document.getElementById(id).addEventListener("change", pushUndo);
  });
  document.getElementById("one-photo").addEventListener("change", (evt) => {
    pushUndo();
    doc.onePhoto = evt.target.checked;
    if (doc.onePhoto) {
      const cell = doc.assignments[doc.layout]?.[doc.selectedPanel];
      if (cell !== undefined) {
        fillAllWithShot(cell.photo);
      }
    } else {
      paint();
    }
  });
  document.getElementById("captions").addEventListener("change", (evt) => {
    pushUndo();
    doc.showCaptions = evt.target.checked;
    paint();
  });
  document.getElementById("cycle-photo").addEventListener("click", cyclePanelShot);
  document.getElementById("zoom").addEventListener("input", (evt) => {
    const cell = doc.assignments[doc.layout]?.[doc.selectedPanel];
    if (cell !== undefined) {
      cell.zoom = Number(evt.target.value);
      paint();
    }
  });
  document.getElementById("zoom").addEventListener("change", pushUndo);
  document.getElementById("export").addEventListener("click", () => exportPNG(doc.size));
  document.getElementById("export-all").addEventListener("click", exportAllSizes);
  document.getElementById("undo").addEventListener("click", undo);
  document.getElementById("redo").addEventListener("click", redo);

  // Click a panel to select it; drag on it to pan its crop; wheel to zoom.
  let grab = null;
  cv.addEventListener("pointerdown", (evt) => {
    const i = tileAt(evt.clientX, evt.clientY);
    if (i >= 0) {
      doc.selectedPanel = i;
      const cell = doc.assignments[doc.layout]?.[i];
      grab = { fx: cell.fx, fy: cell.fy, x: evt.clientX, y: evt.clientY };
      cv.setPointerCapture(evt.pointerId);
      paint();
    }
  });
  cv.addEventListener("pointermove", (evt) => {
    if (grab !== null) {
      const cell = doc.assignments[doc.layout]?.[doc.selectedPanel];
      const r = cv.getBoundingClientRect();
      const p = tiles[doc.selectedPanel];
      if (cell !== undefined && p !== undefined) {
        const dx = ((evt.clientX - grab.x) / r.width) * (cv.width / p.w);
        const dy = ((evt.clientY - grab.y) / r.height) * (cv.height / p.h);
        cell.fx = Math.max(0, Math.min(1, grab.fx - dx));
        cell.fy = Math.max(0, Math.min(1, grab.fy - dy));
        paint();
      }
    }
  });
  cv.addEventListener("pointerup", () => {
    if (grab !== null) {
      pushUndo();
      grab = null;
    }
  });
  cv.addEventListener("wheel", (evt) => {
    evt.preventDefault();
    const cell = doc.assignments[doc.layout]?.[doc.selectedPanel];
    if (cell === undefined) {
      return; // no panel to zoom
    }
    const factor = evt.deltaY < 0 ? 1.08 : 0.93;
    cell.zoom = Math.max(1, Math.min(3, cell.zoom * factor));
    const zoomEl = document.getElementById("zoom");
    if (zoomEl !== null) {
      zoomEl.value = cell.zoom;
    }
    paint();
  }, { passive: false });
  document.addEventListener("keydown", (evt) => {
    const meta = evt.ctrlKey || evt.metaKey;
    const k = evt.key.toLowerCase();
    if (meta && k === "z" && !evt.shiftKey) {
      evt.preventDefault();
      undo();
    }
    if (meta && (k === "y" || (k === "z" && evt.shiftKey))) {
      evt.preventDefault();
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
  await loadSamples();
  bind();
  sync();
  paint();
} else {
  runShot(scene, params, { bindEditor: bind, canvas: cv, loadImage: loadImage, loadSamplePhotos: loadSamples, photos: photos, renderPreview: paint, state: doc, syncControls: sync });
}
