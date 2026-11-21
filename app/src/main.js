// main.js — the editor behind Palm Heat Cover Studio.
//
// This module wires the whole studio: choosing and dropping in photos,
// the bundled sample set, the layout and grade pickers, the caption
// fields, per-panel cropping and positioning (click to select a panel,
// drag to pan it, scroll to zoom), undo plus redo, and PNG export in
// all three post sizes. A `?shot=` query in the URL swaps the editor
// for a fixed screenshot scene instead — the scenes live in ./shots.js.

import { drawCoverGrid, exportCoverPNG, EXPORT_SIZES, LAYOUTS, GRADES, layoutPanels, panelCount } from "./cover.js";
import {
  runShot,
} from "./shots.js";

// The sample photos the app ships with: {name, src} objects, name
// being the label the strip shows under each thumbnail.
const SAMPLE_PICS = [
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

// Caption chips for the panels {line, time, place}, one per sample
// photo. The wording is original — the same kind of location/time
// chips the top-5 covers carry on theirs.
const CAPTION_CARDS = [
  { line: "ENGINE RUNNING", time: "6:47 PM", place: "CORAL DRIVE" },
  { line: "FIRST CAST", time: "5:30 AM", place: "PIER 26" },
  { line: "NO BRAKES", time: "11:50 PM", place: "NEON MILE" },
  { line: "CITY LIGHTS", time: "8:30 PM", place: "ROOFTOP 9" },
  { line: "AFTER DARK", time: "9:15 PM", place: "PALM ROW" },
  { line: "GOLDEN HOUR", time: "6:10 PM", place: "TOWER 2" },
  { line: "TOP DOWN", time: "7:05 PM", place: "DECO ROW" },
  { line: "LAST LIGHT", time: "6:58 PM", place: "COAST ROAD" },
  { line: "GOLDEN HOUR", time: "7:42 PM", place: "CORAL DRIVE" },
];

// Default crop per panel, per layout. A crop is
// {zoom, fy, fx, photo}, with an optional `sq` slot carrying the
// square-only override as {zoom, fy, fx, photo}. fx/fy is the focus
// point (0..1) inside the photo; zoom is >= 1. The crops are picked
// so faces stay in frame and no panel shows an awkward body-part cut.
//
// Square is the awkward one: its 3-panel row is short (0.44h), the
// title's letters cover the whole row top, and the rooftop face —
// sitting at the top of its photo — cannot be cropped below the
// letters at any zoom (verified: zoom 1.35 only pushed the beard
// below them). So P3 carries an `sq` override: the coast road (no
// face) in square only. The override lives in cover.js
// (drawCoverGrid, w === h).
//
// The 3-panel row in portrait and square runs P1 P2 P3, and the title
// crashes over the whole row — a face in the LEFT column sits behind
// the "P" and can never escape it, so the row is ordered face-free on
// the left: car (no face), neon, rooftop (right column, where the
// fisherman's face already escaped the "T"). Landscape is unaffected:
// P1 mid-top and P3 right-top both sit fully above the title, so car,
// rooftop and fisherman all stay whole there.
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
const DEFAULT_CROPS = {
  chaos: [
    { zoom: 1.05, fy: 0.32, fx: 0.42, photo: 8 },
    { zoom: 1.15, fy: 0.55, fx: 0.55, photo: 6 },
    { zoom: 1.1, fy: 0.42, fx: 0.55, photo: 2 },
    { zoom: 1, fy: 0.28, fx: 0.48, photo: 3, sq: { zoom: 1.15, fy: 0.55, fx: 0.45, photo: 7 } },
    { zoom: 1, fy: 0.3, fx: 0.48, photo: 1 },
    { zoom: 1.15, fy: 0.55, fx: 0.45, photo: 7 },
  ],
  "hero-vice": [
    { zoom: 1.05, fy: 0.32, fx: 0.42, photo: 0 },
    { zoom: 1.15, fy: 0.3, fx: 0.48, photo: 3 },
    { zoom: 1.1, fy: 0.42, fx: 0.55, photo: 2 },
    { zoom: 1, fy: 0.3, fx: 0.48, photo: 1 },
    { zoom: 1.15, fy: 0.55, fx: 0.55, photo: 6 },
    { zoom: 1.15, fy: 0.55, fx: 0.45, photo: 7 },
  ],
  "vice-grid": [
    { zoom: 1.15, fy: 0.32, fx: 0.5, photo: 0 },
    { zoom: 1.1, fy: 0.35, fx: 0.5, photo: 3 },
    { zoom: 1.15, fy: 0.35, fx: 0.5, photo: 1 },
    { zoom: 1.05, fy: 0.45, fx: 0.5, photo: 2 },
    { zoom: 1.15, fy: 0.55, fx: 0.55, photo: 6 },
    { zoom: 1.25, fy: 0.3, fx: 0.5, photo: 4 },
    { zoom: 1.15, fy: 0.55, fx: 0.45, photo: 7 },
    { zoom: 1.4, fy: 0.45, fx: 0.72, photo: 2 },
  ],
  "hero-three": [
    { zoom: 1.05, fy: 0.32, fx: 0.5, photo: 0 },
    { zoom: 1.1, fy: 0.45, fx: 0.5, photo: 2 },
    { zoom: 1.2, fy: 0.35, fx: 0.5, photo: 1 },
    { zoom: 1.15, fy: 0.35, fx: 0.5, photo: 3 },
  ],
  tilted: [
    { zoom: 1.1, fy: 0.32, fx: 0.5, photo: 0 },
    { zoom: 1.15, fy: 0.35, fx: 0.5, photo: 1 },
    { zoom: 1.1, fy: 0.45, fx: 0.5, photo: 2 },
    { zoom: 1.2, fy: 0.35, fx: 0.5, photo: 3 },
    { zoom: 1.1, fy: 0.55, fx: 0.55, photo: 6 },
  ],
  "full-bleed": [
    { zoom: 1.05, fy: 0.35, fx: 0.5, photo: 0 },
    { zoom: 1.1, fy: 0.45, fx: 0.5, photo: 2 },
    { zoom: 1.2, fy: 0.35, fx: 0.5, photo: 1 },
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
    captions: CAPTION_CARDS.map((c) => ({ line: c.line, time: c.time, place: c.place })),
    size: "landscape",
    assignments: JSON.parse(JSON.stringify(DEFAULT_CROPS)),
    selectedPanel: 0,
  };
}

export const state = defaultState();
export const photos = []; // loaded Image elements; index matches photoLabels
const photoLabels = SAMPLE_PICS.map((p) => p.name);

/** Loads one image, resolving once it is drawable. */
export function loadImage(src) {
  return new Promise((resolve, reject) => {
    const pic = new Image();
    pic.addEventListener("load", () => resolve(pic));
    pic.addEventListener("error", () => reject(new Error("could not load " + src)));
    pic.src = src;
  });
}

/** Loads every sample photo; resolves once all are drawable. */
export async function loadSamplePhotos() {
  photos.length = 0;
  for (const s of SAMPLE_PICS) {
    photos.push(await loadImage(s.src));
  }
  return photos;
}

const canvas = document.querySelector("#cover");
const status = document.querySelector("#status");
let undoStack = [];
let redoStack = [];
let lastPanels = [];

/** Serialises the editable part of the state for undo / redo. */
function snapshotState() {
  const { selectedPanel, ...rest } = state;
  return JSON.stringify(rest);
}

function pushUndo() {
  undoStack.push(snapshotState());
  while (undoStack.length > 40) {
    undoStack.shift();
  }
  redoStack = [];
  updateUndoButtons();
}

function applySnapshot(snap) {
  const kept = JSON.parse(snap);
  for (const key of Object.keys(kept)) {
    state[key] = kept[key];
  }
  syncControls();
  paintPreview();
}

export function undo() {
  const s = undoStack.pop();
  if (s === undefined) {
    return; // nothing to undo
  }
  redoStack.push(snapshotState());
  applySnapshot(s);
  updateUndoButtons();
}

export function redo() {
  const s = redoStack.pop();
  if (s === undefined) {
    return; // nothing to redo
  }
  undoStack.push(snapshotState());
  applySnapshot(s);
  updateUndoButtons();
}

function updateUndoButtons() {
  const uBtn = document.querySelector("#undo");
  const rBtn = document.querySelector("#redo");
  uBtn !== null && (uBtn.disabled = undoStack.length === 0);
  rBtn !== null && (rBtn.disabled = redoStack.length === 0);
}

/** Redraws the live preview at the selected post size. */
export function paintPreview() {
  const dims = EXPORT_SIZES[state.size];
  canvas.width = dims.w;
  canvas.height = dims.h;
  canvas.style.aspectRatio = `${dims.w} / ${dims.h}`;
  const drawn = drawCoverGrid(canvas, state, photos);
  lastPanels = drawn.panels;
  drawSelection();
  status.textContent = `Preview · ${dims.label} · ${LAYOUTS[state.layout]} · ${GRADES[state.grade]}`;
}

/** Outlines the selected panel on the preview canvas. */
function drawSelection() {
  const pick = lastPanels[state.selectedPanel];
  if (pick === undefined) {
    return; // no panel selected
  }
  const g = canvas.getContext("2d");
  g.save();
  g.strokeStyle = "#ffd23f";
  g.lineWidth = Math.max(3, canvas.width / 480);
  g.setLineDash([18, 10]);
  g.strokeRect(2 + pick.x, 2 + pick.y, pick.w - 4, pick.h - 4);
  g.setLineDash([]);
  g.fillStyle = "#ffd23f";
  g.font = "bold " + Math.max(canvas.width / 64, 16) + "px sans-serif";
  g.textAlign = "left";
  g.fillText(`PANEL ${1 + state.selectedPanel}`, 14 + pick.x, Math.max(canvas.width / 48, 22) + pick.y);
  g.restore();
}

/**
 * Fills every panel of every layout with one photo (the #2 trick: one
 * face, many crops, so the cover stays consistent).
 */
export function fillAllWithPhoto(photoIndex) {
  pushUndo();
  const fxs = [0.5, 0.3, 0.7, 0.5, 0.25, 0.75, 0.5, 0.35];
  const fys = [0.32, 0.45, 0.4, 0.3, 0.5, 0.42, 0.6, 0.35];
  for (const name of Object.keys(state.assignments)) {
    state.assignments[name] = state.assignments[name].map((slot, k) => ({
      ...slot,
      photo: photoIndex,
      fx: fxs[k % fxs.length],
      fy: fys[k % fys.length],
      zoom: 1.25,
    }));
  }
  paintPreview();
}

/** Puts a photo into the selected panel (or all panels, in one-photo mode). */
export function assignPhotoToSelected(photoIndex) {
  pushUndo();
  const slots = state.assignments[state.layout];
  const entry = slots[state.selectedPanel];
  if (entry !== undefined) {
    entry.photo = photoIndex;
  }
  state.onePhoto ? fillAllWithPhoto(photoIndex) : paintPreview();
  renderPhotoStrip();
}

/** Cycles the selected panel to the next photo. */
export function cyclePanelPhoto() {
  const slots = state.assignments[state.layout];
  const entry = slots[state.selectedPanel];
  if (entry !== undefined) {
    assignPhotoToSelected((entry.photo + 1) % photos.length);
  }
}

function syncControls() {
  const setField = (id, value) => {
    const el = document.getElementById(id);
    el !== null && (el.value = value);
  };
  setField("title", state.title);
  setField("subtitle", state.subtitle);
  setField("place", state.place);
  setField("tagline", state.tagline);
  for (const btn of document.querySelectorAll("#layout-pick button")) {
    btn.classList.toggle("active", state.layout === btn.dataset.layout);
  } // layout buttons
  for (const btn of document.querySelectorAll("#grade-pick button")) {
    btn.classList.toggle("active", state.grade === btn.dataset.grade);
  } // grade buttons
  for (const btn of document.querySelectorAll("#size-pick button")) {
    btn.classList.toggle("active", state.size === btn.dataset.size);
  } // size buttons
  document.querySelectorAll("#heat-pick button").forEach((btn, n) => {
    btn.classList.toggle("active", n < state.heat);
  }); // heat stars
  const oneBox = document.querySelector("#one-photo");
  oneBox !== null && (oneBox.checked = state.onePhoto);
  const capBox = document.querySelector("#captions");
  capBox !== null && (capBox.checked = state.showCaptions !== false);
  const zoomEl = document.getElementById("zoom");
  const entry = state.assignments[state.layout]?.[state.selectedPanel];
  if (zoomEl !== null && entry !== undefined) {
    zoomEl.value = entry.zoom;
  }
  renderPhotoStrip();
}

/** The photo strip: samples plus uploads; click to fill the selected panel. */
function renderPhotoStrip() {
  const strip = document.querySelector("#photo-strip");
  if (strip === null) {
    return; // no strip on this page
  }
  strip.innerHTML = "";
  photos.forEach((img, idx) => {
    const b = document.createElement("button");
    b.type = "button";
    b.className = "thumb";
    const name = photoLabels[idx] ?? "Photo " + (idx + 1);
    b.title = name;
    const im = document.createElement("img");
    im.src = img.src;
    im.alt = b.title;
    b.appendChild(im);
    const entry = state.assignments[state.layout]?.[state.selectedPanel];
    if (idx === entry?.photo) {
      b.classList.add("in-use");
    }
    b.addEventListener("click", () => assignPhotoToSelected(idx));
    strip.appendChild(b);
  });
}

/** Downloads a blob as a file. */
function downloadBlob(data, file) {
  const link = document.createElement("a");
  link.href = URL.createObjectURL(data);
  link.download = file;
  link.click();
  setTimeout(() => { URL.revokeObjectURL(link.href); }, 5000);
}

/** Exports the current cover at one post size. */
export async function exportPNG(sizeKey) {
  const data = await exportCoverPNG(state, photos, sizeKey);
  const dims = EXPORT_SIZES[sizeKey];
  downloadBlob(data, `palm-heat-cover-${dims.w}x${dims.h}.png`);
  status.textContent = `Saved palm-heat-cover-${dims.w}x${dims.h}.png`;
}

/** Exports all three post sizes, one PNG each. */
export async function exportAllSizes() {
  for (const key of Object.keys(EXPORT_SIZES)) {
    await exportPNG(key);
  }
  status.textContent = "All 3 sizes saved: 1920 × 1080, 1080 × 1350, 1080 × 1080";
}

/** Adds user files as photos (read locally only — never uploaded). */
export async function addUserFiles(fileList) {
  for (const file of fileList) {
    if (file.type.startsWith("image/")) {
      const pic = await loadImage(URL.createObjectURL(file));
      photos.push(pic);
      photoLabels.push(file.name);
    }
  }
  renderPhotoStrip();
  paintPreview();
}

/** Maps a click on the preview canvas to a panel index (topmost first). */
function panelAt(clientX, clientY) {
  const rect = canvas.getBoundingClientRect();
  const px = canvas.width * ((clientX - rect.left) / rect.width);
  const py = canvas.height * ((clientY - rect.top) / rect.height);
  let k = lastPanels.length;
  while (k > 0) {
    k -= 1;
    const p = lastPanels[k];
    if (px >= p.x && px <= p.x + p.w && py >= p.y && py <= p.y + p.h) {
      return k;
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
  const dz = document.getElementById("dropzone");
  dz.addEventListener("dragover", (ev) => {
    ev.preventDefault();
    dz.classList.add("over");
  });
  dz.addEventListener("dragleave", () => dz.classList.remove("over"));
  dz.addEventListener("drop", (ev) => {
    ev.preventDefault();
    dz.classList.remove("over");
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
  } // layout picker
  for (const btn of document.querySelectorAll("#grade-pick button")) {
    btn.addEventListener("click", () => {
      pushUndo();
      state.grade = btn.dataset.grade;
      syncControls();
      paintPreview();
    });
  } // grade picker
  for (const btn of document.querySelectorAll("#size-pick button")) {
    btn.addEventListener("click", () => {
      state.size = btn.dataset.size;
      syncControls();
      paintPreview();
    });
  } // size picker
  document.querySelectorAll("#heat-pick button").forEach((btn, n) => {
    btn.addEventListener("click", () => {
      pushUndo();
      state.heat = n + 1;
      syncControls();
      paintPreview();
    });
  }); // heat picker
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
      const entry = state.assignments[state.layout]?.[state.selectedPanel];
      if (entry !== undefined) {
        fillAllWithPhoto(entry.photo);
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
    const entry = state.assignments[state.layout]?.[state.selectedPanel];
    if (entry !== undefined) {
      entry.zoom = Number(ev.target.value);
      paintPreview();
    }
  });
  document.getElementById("zoom").addEventListener("change", pushUndo);
  document.getElementById("export").addEventListener("click", () => exportPNG(state.size));
  document.getElementById("export-all").addEventListener("click", exportAllSizes);
  document.getElementById("undo").addEventListener("click", undo);
  document.getElementById("redo").addEventListener("click", redo);

  // Click a panel to select it; drag on it to pan its crop; wheel to zoom.
  let dragging = null;
  canvas.addEventListener("pointerdown", (ev) => {
    const i = panelAt(ev.clientX, ev.clientY);
    if (i >= 0) {
      state.selectedPanel = i;
      const entry = state.assignments[state.layout]?.[i];
      dragging = { x: ev.clientX, y: ev.clientY, fx: entry.fx, fy: entry.fy };
      canvas.setPointerCapture(ev.pointerId);
      paintPreview();
    }
  });
  canvas.addEventListener("pointermove", (ev) => {
    if (dragging !== null) {
      const entry = state.assignments[state.layout]?.[state.selectedPanel];
      const rect = canvas.getBoundingClientRect();
      const p = lastPanels[state.selectedPanel];
      if (entry !== undefined && p !== undefined) {
        const dx = ((ev.clientX - dragging.x) / rect.width) * (canvas.width / p.w);
        const dy = ((ev.clientY - dragging.y) / rect.height) * (canvas.height / p.h);
        entry.fx = Math.max(0, Math.min(1, dragging.fx - dx));
        entry.fy = Math.max(0, Math.min(1, dragging.fy - dy));
        paintPreview();
      }
    }
  });
  canvas.addEventListener("pointerup", () => {
    if (dragging !== null) {
      pushUndo();
      dragging = null;
    }
  });
  canvas.addEventListener("wheel", (ev) => {
    ev.preventDefault();
    const entry = state.assignments[state.layout]?.[state.selectedPanel];
    if (entry === undefined) {
      return; // no panel to zoom
    }
    const f = ev.deltaY < 0 ? 1.08 : 0.93;
    entry.zoom = Math.max(1, Math.min(3, entry.zoom * f));
    const zoomInput = document.getElementById("zoom");
    if (zoomInput !== null) {
      zoomInput.value = entry.zoom;
    }
    paintPreview();
  }, { passive: false });
  document.addEventListener("keydown", (ev) => {
    const mod = ev.ctrlKey || ev.metaKey;
    const key = ev.key.toLowerCase();
    if (mod && key === "z" && !ev.shiftKey) {
      ev.preventDefault();
      undo();
    }
    if (mod && (key === "y" || (key === "z" && ev.shiftKey))) {
      ev.preventDefault();
      redo();
    }
  });
}

const query = new URLSearchParams(window.location.search);
const shot = query.get("shot");
if (shot === null || shot === "") {
  await document.fonts.ready;
  await document.fonts.load("100px Anton");
  await document.fonts.load("40px Pacifico");
  await loadSamplePhotos();
  bindEditor();
  syncControls();
  paintPreview();
} else {
  runShot(shot, query, { state: state, photos: photos, loadSamplePhotos: loadSamplePhotos, loadImage: loadImage, renderPreview: paintPreview, canvas: canvas, bindEditor: bindEditor, syncControls: syncControls });
}
