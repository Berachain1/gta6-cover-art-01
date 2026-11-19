// main.js — sets up the Palm Heat Cover Studio editor.
//
// Photo picker and drag-drop, the built-in sample photos, layout and
// grade pickers, caption fields, per-panel crop and position (click a
// panel, drag to pan, scroll to zoom), undo / redo, and PNG export in
// all three post sizes. A `?shot=` query runs a fixed scene for
// screenshots instead (./shots.js).

import { drawCoverGrid, exportCoverPNG, EXPORT_SIZES, LAYOUTS, GRADES, layoutPanels, panelCount } from "./cover.js";
import { runShot } from "./shots.js";

// Sample photos as [file, label] pairs; the objects the app uses are
// built from them just below, so the table stays compact.
const SAMPLE_PHOTO_ROWS = [
  ["samples/woman.jpg", "Woman · convertible"],
  ["samples/fisherman.jpg", "Fisherman · pier"],
  ["samples/neon.jpg", "Friends · neon street"],
  ["samples/rooftop.jpg", "Man · rooftop"],
  ["samples/boulevard.jpg", "Boulevard · kit"],
  ["samples/pier.jpg", "Pier · kit"],
  ["samples/car.jpg", "Orange car · deco street"],
  ["samples/coast.jpg", "Coast road · sunset"],
  ["samples/sunset.jpg", "Woman · sunset convertible"],
];
const SAMPLE_PHOTOS = SAMPLE_PHOTO_ROWS.map((row) => ({ src: row[0], name: row[1] }));

// Caption chips for the panels (place / time / line), one per sample
// photo — original wording, the location/time chips the top-5 covers
// carry on theirs. Rows are [place, time, line].
const CAPTION_ROWS = [
  ["CORAL DRIVE", "6:47 PM", "ENGINE RUNNING"],
  ["PIER 26", "5:30 AM", "FIRST CAST"],
  ["NEON MILE", "11:50 PM", "NO BRAKES"],
  ["ROOFTOP 9", "8:30 PM", "CITY LIGHTS"],
  ["PALM ROW", "9:15 PM", "AFTER DARK"],
  ["TOWER 2", "6:10 PM", "GOLDEN HOUR"],
  ["DECO ROW", "7:05 PM", "TOP DOWN"],
  ["COAST ROAD", "6:58 PM", "LAST LIGHT"],
  ["CORAL DRIVE", "7:42 PM", "GOLDEN HOUR"],
];
const CAPTIONS = CAPTION_ROWS.map((row) => ({ place: row[0], time: row[1], line: row[2] }));

// Builds one panel crop from a row [photo, fx, fy, zoom] with an optional
// fifth element [photo, fx, fy, zoom] that overrides the crop in square.
function cropRow(row) {
  const made = { photo: row[0], fx: row[1], fy: row[2], zoom: row[3] };
  if (row[4] !== undefined) {
    const sq = row[4];
    made.sq = { photo: sq[0], fx: sq[1], fy: sq[2], zoom: sq[3] };
  }
  return made;
}

// Default crop per panel, per layout. fx/fy is the focus point (0..1)
// inside the photo; zoom >= 1. The crops are picked so faces stay in
// frame and no panel shows an awkward body-part cut.
//
// hero-vice is MULTI-SUBJECT (v3): six different photos, one per panel —
// the top-5 covers' variety. Hero is the woman plus pink convertible
// with her face whole (x about 0.42, y about 0.32); the other panels
// are the rooftop man, the neon couple, the fisherman, the orange car
// and the coast road, each cropped so its subject stays in frame.
const DEFAULT_ASSIGNMENTS = {
  // chaos is the v4 default: the top-3 key-art collage. Same six photos
  // as hero-vice (woman hero, rooftop man, neon couple, fisherman,
  // orange car, coast road), each cropped so its subject stays in frame.
  // v5: the hero is the SUNSET woman (photo 8, blazing sky — #1's glow
  // was the one gap no layout fix could close). The 3-panel row in
  // portrait and square runs P1 P2 P3, and the title crashes over the
  // whole row — a face in the LEFT column sits behind the "P" and can
  // never escape it, so the row is ordered face-free on the left: car
  // (no face), neon, rooftop (right column, where the fisherman's face
  // already escaped the "T"). Landscape is unaffected: P1 mid-top and
  // P3 right-top both sit fully above the title, so car, rooftop and
  // fisherman all stay whole there. Square is the exception: its row is
  // short (0.44h), the title's letters cover the whole row top, and the
  // rooftop face — at the top of its photo — cannot be cropped below the
  // letters at any zoom (verified: zoom 1.35 only pushed the beard below
  // them). So P3 carries an `sq` override: the coast road (no face) in
  // square only. The override lives in cover.js (drawCoverGrid, w === h).
  chaos: [
    [8, 0.42, 0.32, 1.05],
    [6, 0.55, 0.55, 1.15],
    [2, 0.55, 0.42, 1.1],
    [3, 0.48, 0.28, 1.0, [7, 0.45, 0.55, 1.15]],
    [1, 0.48, 0.3, 1.0],
    [7, 0.45, 0.55, 1.15],
  ].map(cropRow),
  "hero-vice": [
    [0, 0.42, 0.32, 1.05],
    [3, 0.48, 0.3, 1.15],
    [2, 0.55, 0.42, 1.1],
    [1, 0.48, 0.3, 1.0],
    [6, 0.55, 0.55, 1.15],
    [7, 0.45, 0.55, 1.15],
  ].map(cropRow),
  "vice-grid": [
    [0, 0.5, 0.32, 1.15],
    [3, 0.5, 0.35, 1.1],
    [1, 0.5, 0.35, 1.15],
    [2, 0.5, 0.45, 1.05],
    [6, 0.55, 0.55, 1.15],
    [4, 0.5, 0.3, 1.25],
    [7, 0.45, 0.55, 1.15],
    [2, 0.72, 0.45, 1.4],
  ].map(cropRow),
  "hero-three": [
    [0, 0.5, 0.32, 1.05],
    [2, 0.5, 0.45, 1.1],
    [1, 0.5, 0.35, 1.2],
    [3, 0.5, 0.35, 1.15],
  ].map(cropRow),
  tilted: [
    [0, 0.5, 0.32, 1.1],
    [1, 0.5, 0.35, 1.15],
    [2, 0.5, 0.45, 1.1],
    [3, 0.5, 0.35, 1.2],
    [6, 0.55, 0.55, 1.1],
  ].map(cropRow),
  "full-bleed": [
    [0, 0.5, 0.35, 1.05],
    [2, 0.5, 0.45, 1.1],
    [1, 0.5, 0.35, 1.2],
  ].map(cropRow),
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
    captions: CAPTIONS.map((c) => ({ ...c })),
    size: "landscape",
    assignments: JSON.parse(JSON.stringify(DEFAULT_ASSIGNMENTS)),
    selectedPanel: 0,
  };
}

export const state = defaultState();
export const photos = []; // loaded Image elements; index matches photoLabels
const photoLabels = SAMPLE_PHOTOS.map((p) => p.name);

/** Loads one image, resolving once it is drawable. */
export function loadImage(url) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("could not load " + url));
    img.src = url;
  });
}

/** Loads every sample photo; resolves once all are drawable. */
export async function loadSamplePhotos() {
  photos.length = 0;
  for (const s of SAMPLE_PHOTOS) {
    photos.push(await loadImage(s.src));
  }
  return photos;
}

const canvas = document.querySelector("#cover");
const status = document.querySelector("#status");
let undoHistory = [];
let redoHistory = [];
let lastPanels = [];

/** Serialises the editable part of the state for undo / redo. */
function snapshotState() {
  const rest = { ...state };
  delete rest.selectedPanel;
  return JSON.stringify(rest);
}

function pushUndo() {
  undoHistory.push(snapshotState());
  if (undoHistory.length > 40) {
    undoHistory.shift();
  }
  redoHistory = [];
  updateUndoButtons();
}

function applySnapshot(snap) {
  Object.assign(state, JSON.parse(snap));
  syncControls();
  renderPreview();
}

export function undo() {
  if (undoHistory.length === 0) {
    return;
  }
  redoHistory.push(snapshotState());
  applySnapshot(undoHistory.pop());
  updateUndoButtons();
}

export function redo() {
  if (redoHistory.length === 0) {
    return;
  }
  undoHistory.push(snapshotState());
  applySnapshot(redoHistory.pop());
  updateUndoButtons();
}

function updateUndoButtons() {
  const undoBtn = document.querySelector("#undo");
  const redoBtn = document.querySelector("#redo");
  if (undoBtn !== null) {
    undoBtn.disabled = undoHistory.length === 0;
  }
  if (redoBtn !== null) {
    redoBtn.disabled = redoHistory.length === 0;
  }
}

/** Redraws the live preview at the selected post size. */
export function renderPreview() {
  const size = EXPORT_SIZES[state.size];
  canvas.width = size.w;
  canvas.height = size.h;
  canvas.style.aspectRatio = size.w + " / " + size.h;
  const art = drawCoverGrid(canvas, state, photos);
  lastPanels = art.panels;
  drawSelection();
  status.textContent = "Preview · " + size.label + " · " + LAYOUTS[state.layout] + " · " + GRADES[state.grade];
}

/** Outlines the selected panel on the preview canvas. */
function drawSelection() {
  const ctx = canvas.getContext("2d");
  const panel = lastPanels[state.selectedPanel];
  if (panel === undefined) {
    return;
  }
  ctx.save();
  ctx.strokeStyle = "#ffd23f";
  ctx.lineWidth = Math.max(3, canvas.width / 480);
  ctx.setLineDash([18, 10]);
  ctx.strokeRect(2 + panel.x, 2 + panel.y, panel.w - 4, panel.h - 4);
  ctx.setLineDash([]);
  ctx.fillStyle = "#ffd23f";
  ctx.font = "bold " + Math.max(16, canvas.width / 64) + "px sans-serif";
  ctx.textAlign = "left";
  ctx.fillText("PANEL " + (1 + state.selectedPanel), 14 + panel.x, Math.max(22, canvas.width / 48) + panel.y);
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
  for (const name of Object.keys(state.assignments)) {
    state.assignments[name] = state.assignments[name].map((a, i) => ({
      ...a,
      photo: photoIndex,
      fx: xs[i % 8],
      fy: ys[i % 8],
      zoom: 1.25,
    }));
  }
  renderPreview();
}

/** Puts a photo into the selected panel (or all panels, in one-photo mode). */
export function assignPhotoToSelected(photoIndex) {
  pushUndo();
  const list = state.assignments[state.layout];
  if (list[state.selectedPanel] !== undefined) {
    list[state.selectedPanel].photo = photoIndex;
  }
  if (state.onePhoto) {
    fillAllWithPhoto(photoIndex);
  } else {
    renderPreview();
  }
  renderPhotoStrip();
}

/** Cycles the selected panel to the next photo. */
export function cyclePanelPhoto() {
  const list = state.assignments[state.layout];
  const cur = list[state.selectedPanel];
  if (cur === undefined) {
    return;
  }
  assignPhotoToSelected((cur.photo + 1) % photos.length);
}

function syncControls() {
  const setVal = (id, value) => {
    const input = document.getElementById(id);
    if (input !== null) {
      input.value = value;
    }
  };
  setVal("title", state.title);
  setVal("subtitle", state.subtitle);
  setVal("place", state.place);
  setVal("tagline", state.tagline);
  document.querySelectorAll("#layout-pick button").forEach((btn) => {
    btn.classList.toggle("active", btn.dataset.layout === state.layout);
  });
  document.querySelectorAll("#grade-pick button").forEach((btn) => {
    btn.classList.toggle("active", btn.dataset.grade === state.grade);
  });
  document.querySelectorAll("#size-pick button").forEach((btn) => {
    btn.classList.toggle("active", btn.dataset.size === state.size);
  });
  document.querySelectorAll("#heat-pick button").forEach((btn, i) => {
    btn.classList.toggle("active", i < state.heat);
  });
  const oneBox = document.querySelector("#one-photo");
  if (oneBox !== null) {
    oneBox.checked = state.onePhoto;
  }
  const capBox = document.querySelector("#captions");
  if (capBox !== null) {
    capBox.checked = state.showCaptions !== false;
  }
  const zoomEl = document.getElementById("zoom");
  const cur = (state.assignments[state.layout] || [])[state.selectedPanel];
  if (zoomEl !== null && cur !== undefined) {
    zoomEl.value = cur.zoom;
  }
  renderPhotoStrip();
}

/** The photo strip: samples plus uploads; click to fill the selected panel. */
function renderPhotoStrip() {
  const bar = document.querySelector("#photo-strip");
  if (bar === null) {
    return;
  }
  bar.innerHTML = "";
  photos.forEach((img, idx) => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "thumb";
    btn.title = photoLabels[idx] === undefined ? "Photo " + (idx + 1) : photoLabels[idx];
    const thumb = document.createElement("img");
    thumb.src = img.src;
    thumb.alt = btn.title;
    btn.appendChild(thumb);
    const cur = (state.assignments[state.layout] || [])[state.selectedPanel];
    if (cur !== undefined && idx === cur.photo) {
      btn.classList.add("in-use");
    }
    btn.addEventListener("click", () => {
      assignPhotoToSelected(idx);
    });
    bar.appendChild(btn);
  });
}

/** Downloads a blob as a file. */
function downloadBlob(blob, name) {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 5000);
}

/** Exports the current cover at one post size. */
export async function exportPNG(sizeKey) {
  const blob = await exportCoverPNG(state, photos, sizeKey);
  const size = EXPORT_SIZES[sizeKey];
  downloadBlob(blob, "palm-heat-cover-" + size.w + "x" + size.h + ".png");
  status.textContent = "Saved palm-heat-cover-" + size.w + "x" + size.h + ".png";
}

/** Exports all three post sizes, one PNG each. */
export async function exportAllSizes() {
  for (const key of Object.keys(EXPORT_SIZES)) {
    // eslint-disable-next-line no-await-in-loop
    await exportPNG(key);
  }
  status.textContent = "All 3 sizes saved: 1920 × 1080, 1080 × 1350, 1080 × 1080";
}

/** Adds user files as photos (read locally only — never uploaded). */
export async function addUserFiles(fileList) {
  for (const f of fileList) {
    if (f.type.startsWith("image/") === false) {
      continue;
    }
    // eslint-disable-next-line no-await-in-loop
    const img = await loadImage(URL.createObjectURL(f));
    photos.push(img);
    photoLabels.push(f.name);
  }
  renderPhotoStrip();
  renderPreview();
}

/** Maps a click on the preview canvas to a panel index (topmost first). */
function panelAt(clientX, clientY) {
  const box = canvas.getBoundingClientRect();
  const x = canvas.width * ((clientX - box.left) / box.width);
  const y = canvas.height * ((clientY - box.top) / box.height);
  let i = lastPanels.length - 1;
  while (i >= 0) {
    const panel = lastPanels[i];
    if (panel.x <= x && x <= panel.x + panel.w && panel.y <= y && y <= panel.y + panel.h) {
      return i;
    }
    i -= 1;
  }
  return -1;
}

/** Wires every control in the editor shell to the state. */
function bindEditor() {
  document.getElementById("photo").addEventListener("change", (ev) => {
    addUserFiles([...ev.target.files]);
    ev.target.value = "";
  });
  const zone = document.getElementById("dropzone");
  zone.addEventListener("dragover", (ev) => {
    ev.preventDefault();
    zone.classList.add("over");
  });
  zone.addEventListener("dragleave", () => zone.classList.remove("over"));
  zone.addEventListener("drop", (ev) => {
    ev.preventDefault();
    zone.classList.remove("over");
    addUserFiles([...ev.dataTransfer.files]);
  });
  document.querySelectorAll("#layout-pick button").forEach((btn) => {
    btn.addEventListener("click", () => {
      pushUndo();
      state.layout = btn.dataset.layout;
      state.selectedPanel = 0;
      syncControls();
      renderPreview();
    });
  });
  document.querySelectorAll("#grade-pick button").forEach((btn) => {
    btn.addEventListener("click", () => {
      pushUndo();
      state.grade = btn.dataset.grade;
      syncControls();
      renderPreview();
    });
  });
  document.querySelectorAll("#size-pick button").forEach((btn) => {
    btn.addEventListener("click", () => {
      state.size = btn.dataset.size;
      syncControls();
      renderPreview();
    });
  });
  document.querySelectorAll("#heat-pick button").forEach((btn, i) => {
    btn.addEventListener("click", () => {
      pushUndo();
      state.heat = i + 1;
      syncControls();
      renderPreview();
    });
  });
  for (const id of ["title", "subtitle", "place", "tagline"]) {
    document.getElementById(id).addEventListener("input", (ev) => {
      state[id] = ev.target.value;
      renderPreview();
    });
    document.getElementById(id).addEventListener("change", pushUndo);
  }
  document.getElementById("one-photo").addEventListener("change", (ev) => {
    pushUndo();
    state.onePhoto = ev.target.checked;
    if (state.onePhoto) {
      const assign = (state.assignments[state.layout] || [])[state.selectedPanel];
      if (assign !== undefined) {
        fillAllWithPhoto(assign.photo);
      }
    } else {
      renderPreview();
    }
  });
  document.getElementById("captions").addEventListener("change", (ev) => {
    pushUndo();
    state.showCaptions = ev.target.checked;
    renderPreview();
  });
  document.getElementById("cycle-photo").addEventListener("click", cyclePanelPhoto);
  document.getElementById("zoom").addEventListener("input", (ev) => {
    const assign = (state.assignments[state.layout] || [])[state.selectedPanel];
    if (assign !== undefined) {
      assign.zoom = Number(ev.target.value);
      renderPreview();
    }
  });
  document.getElementById("zoom").addEventListener("change", pushUndo);
  document.getElementById("export").addEventListener("click", () => exportPNG(state.size));
  document.getElementById("export-all").addEventListener("click", exportAllSizes);
  document.getElementById("undo").addEventListener("click", undo);
  document.getElementById("redo").addEventListener("click", redo);

  // Click a panel to select it; drag on it to pan its crop; wheel to zoom.
  let dragState = null;
  canvas.addEventListener("pointerdown", (ev) => {
    const i = panelAt(ev.clientX, ev.clientY);
    if (i < 0) {
      return;
    }
    state.selectedPanel = i;
    const assign = (state.assignments[state.layout] || [])[i];
    dragState = { x: ev.clientX, y: ev.clientY, fx: assign.fx, fy: assign.fy };
    canvas.setPointerCapture(ev.pointerId);
    renderPreview();
  });
  canvas.addEventListener("pointermove", (ev) => {
    if (dragState === null) {
      return;
    }
    const assign = (state.assignments[state.layout] || [])[state.selectedPanel];
    const box = canvas.getBoundingClientRect();
    const panel = lastPanels[state.selectedPanel];
    if (assign === undefined || panel === undefined) {
      return;
    }
    const dx = (canvas.width / panel.w) * ((ev.clientX - dragState.x) / box.width);
    const dy = (canvas.height / panel.h) * ((ev.clientY - dragState.y) / box.height);
    assign.fx = Math.max(0, Math.min(1, dragState.fx - dx));
    assign.fy = Math.max(0, Math.min(1, dragState.fy - dy));
    renderPreview();
  });
  canvas.addEventListener("pointerup", () => {
    if (dragState !== null) {
      pushUndo();
      dragState = null;
    }
  });
  canvas.addEventListener("wheel", (ev) => {
    ev.preventDefault();
    const assign = (state.assignments[state.layout] || [])[state.selectedPanel];
    if (assign === undefined) {
      return;
    }
    const factor = ev.deltaY < 0 ? 1.08 : 0.93;
    assign.zoom = Math.max(1, Math.min(3, assign.zoom * factor));
    const zoomEl = document.getElementById("zoom");
    if (zoomEl !== null) {
      zoomEl.value = assign.zoom;
    }
    renderPreview();
  }, { passive: false });
  document.addEventListener("keydown", (ev) => {
    const mod = ev.ctrlKey || ev.metaKey;
    const key = ev.key.toLowerCase();
    if (mod && key === "z" && ev.shiftKey === false) {
      ev.preventDefault();
      undo();
    }
    if (mod && (key === "y" || (key === "z" && ev.shiftKey))) {
      ev.preventDefault();
      redo();
    }
  });
}

const params = new URLSearchParams(window.location.search);
const shot = params.get("shot");
if (shot !== null && shot !== "") {
  runShot(shot, params, { state, photos, loadSamplePhotos, loadImage, renderPreview, canvas, bindEditor, syncControls });
} else {
  await document.fonts.ready;
  await document.fonts.load("100px Anton");
  await document.fonts.load("40px Pacifico");
  await loadSamplePhotos();
  bindEditor();
  syncControls();
  renderPreview();
}
