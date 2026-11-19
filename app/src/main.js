// main.js — the Palm Heat Cover Studio editor, wired up.
//
// What lives here: picking photos and dropping them in, the built-in
// sample photos, the layout and grade pickers, the caption fields,
// per-panel crop and position (click a panel, drag to pan, scroll to
// zoom), undo and redo, and PNG export in all three post sizes. When
// the URL carries a `?shot=` query, a fixed scene runs for screenshots
// instead — see ./shots.js for those.

import { drawCoverGrid, exportCoverPNG, EXPORT_SIZES, LAYOUTS, GRADES, layoutPanels, panelCount } from "./cover.js";
import { runShot } from "./shots.js";

// The sample photos the app ships with: [file, label the strip shows
// under each thumbnail].
const SAMPLE_PHOTOS = [
  ["samples/woman.jpg", "Woman · convertible"],
  ["samples/fisherman.jpg", "Fisherman · pier"],
  ["samples/neon.jpg", "Friends · neon street"],
  ["samples/rooftop.jpg", "Man · rooftop"],
  ["samples/boulevard.jpg", "Boulevard · kit"],
  ["samples/pier.jpg", "Pier · kit"],
  ["samples/car.jpg", "Orange car · deco street"],
  ["samples/coast.jpg", "Coast road · sunset"],
  ["samples/sunset.jpg", "Woman · sunset convertible"],
].map(([src, name]) => ({ src, name }));

// Caption chips for the panels [place, time, line], one per sample
// photo. The wording is original — the same kind of location/time
// chips the top-5 covers carry on theirs.
const CAPTIONS = [
  ["CORAL DRIVE", "6:47 PM", "ENGINE RUNNING"],
  ["PIER 26", "5:30 AM", "FIRST CAST"],
  ["NEON MILE", "11:50 PM", "NO BRAKES"],
  ["ROOFTOP 9", "8:30 PM", "CITY LIGHTS"],
  ["PALM ROW", "9:15 PM", "AFTER DARK"],
  ["TOWER 2", "6:10 PM", "GOLDEN HOUR"],
  ["DECO ROW", "7:05 PM", "TOP DOWN"],
  ["COAST ROAD", "6:58 PM", "LAST LIGHT"],
  ["CORAL DRIVE", "7:42 PM", "GOLDEN HOUR"],
].map(([place, time, line]) => ({ place, time, line }));

// Default crop per panel, per layout. A crop is
// [photo, fx, fy, zoom], with an optional fifth slot carrying the
// square-only override as [photo, fx, fy, zoom]. fx/fy is the focus
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
// close). The 3-panel row in portrait and square runs P1 P2 P3,
// and the title crashes over the whole row — a face in the LEFT
// column sits behind the "P" and can never escape it, so the row
// is ordered face-free on the left: car (no face), neon, rooftop
// (right column, where the fisherman's face already escaped the
// "T"). Landscape is unaffected: P1 mid-top and P3 right-top both
// sit fully above the title, so car, rooftop and fisherman all stay
// whole there. Square is the exception: its row is short (0.44h),
// the title's letters cover the whole row top, and the rooftop
// face — at the top of its photo — cannot be cropped below the
// letters at any zoom (verified: zoom 1.35 only pushed the beard
// below them). So P3 carries an `sq` override: the coast road (no
// face) in square only. The override lives in cover.js
// (drawCoverGrid, w === h).
function toCrop(t) {
  let c = { photo: t[0], fx: t[1], fy: t[2], zoom: t[3] };
  if (t[4] !== undefined) {
    c.sq = { photo: t[4][0], fx: t[4][1], fy: t[4][2], zoom: t[4][3] };
  }
  return c;
}

const ASSIGNMENTS_DEFAULT = {
  chaos: [
    [8, 0.42, 0.32, 1.05],
    [6, 0.55, 0.55, 1.15],
    [2, 0.55, 0.42, 1.1],
    [3, 0.48, 0.28, 1, [7, 0.45, 0.55, 1.15]],
    [1, 0.48, 0.3, 1],
    [7, 0.45, 0.55, 1.15],
  ].map(toCrop),
  "hero-vice": [
    [0, 0.42, 0.32, 1.05],
    [3, 0.48, 0.3, 1.15],
    [2, 0.55, 0.42, 1.1],
    [1, 0.48, 0.3, 1],
    [6, 0.55, 0.55, 1.15],
    [7, 0.45, 0.55, 1.15],
  ].map(toCrop),
  "vice-grid": [
    [0, 0.5, 0.32, 1.15],
    [3, 0.5, 0.35, 1.1],
    [1, 0.5, 0.35, 1.15],
    [2, 0.5, 0.45, 1.05],
    [6, 0.55, 0.55, 1.15],
    [4, 0.5, 0.3, 1.25],
    [7, 0.45, 0.55, 1.15],
    [2, 0.72, 0.45, 1.4],
  ].map(toCrop),
  "hero-three": [
    [0, 0.5, 0.32, 1.05],
    [2, 0.5, 0.45, 1.1],
    [1, 0.5, 0.35, 1.2],
    [3, 0.5, 0.35, 1.15],
  ].map(toCrop),
  tilted: [
    [0, 0.5, 0.32, 1.1],
    [1, 0.5, 0.35, 1.15],
    [2, 0.5, 0.45, 1.1],
    [3, 0.5, 0.35, 1.2],
    [6, 0.55, 0.55, 1.1],
  ].map(toCrop),
  "full-bleed": [
    [0, 0.5, 0.35, 1.05],
    [2, 0.5, 0.45, 1.1],
    [1, 0.5, 0.35, 1.2],
  ].map(toCrop),
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
    assignments: JSON.parse(JSON.stringify(ASSIGNMENTS_DEFAULT)),
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
  for (let n = 0; n < SAMPLE_PHOTOS.length; n += 1) {
    photos.push(await loadImage(SAMPLE_PHOTOS[n].src));
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
  let copy = { ...state };
  delete copy.selectedPanel;
  return JSON.stringify(copy);
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
  paintPreview();
}

export function undo() {
  if (undoHistory.length === 0) {
    return; // nothing to undo
  }
  redoHistory.push(snapshotState());
  applySnapshot(undoHistory.pop());
  updateUndoButtons();
}

export function redo() {
  if (redoHistory.length === 0) {
    return; // nothing to redo
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
export function paintPreview() {
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
  const sel = lastPanels[state.selectedPanel];
  if (sel === undefined) {
    return; // no panel selected
  }
  const ctx = canvas.getContext("2d");
  ctx.save();
  ctx.strokeStyle = "#ffd23f";
  ctx.lineWidth = Math.max(3, canvas.width / 480);
  ctx.setLineDash([18, 10]);
  ctx.strokeRect(2 + sel.x, 2 + sel.y, sel.w - 4, sel.h - 4);
  ctx.setLineDash([]);
  ctx.fillStyle = "#ffd23f";
  ctx.font = "bold " + Math.max(16, canvas.width / 64) + "px sans-serif";
  ctx.textAlign = "left";
  ctx.fillText("PANEL " + (1 + state.selectedPanel), 14 + sel.x, Math.max(22, canvas.width / 48) + sel.y);
  ctx.restore();
}

/**
 * Fills every panel of every layout with one photo (the #2 trick: one
 * face, many crops, so the cover stays consistent).
 */
export function fillAllWithPhoto(photoIndex) {
  pushUndo();
  const fxList = [0.5, 0.3, 0.7, 0.5, 0.25, 0.75, 0.5, 0.35];
  const fyList = [0.32, 0.45, 0.4, 0.3, 0.5, 0.42, 0.6, 0.35];
  for (const name in state.assignments) {
    state.assignments[name] = state.assignments[name].map((a, i) => ({
      ...a,
      photo: photoIndex,
      fx: fxList[i % 8],
      fy: fyList[i % 8],
      zoom: 1.25,
    }));
  }
  paintPreview();
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
    paintPreview();
  }
  renderPhotoStrip();
}

/** Cycles the selected panel to the next photo. */
export function cyclePanelPhoto() {
  const list = state.assignments[state.layout];
  const cur = list[state.selectedPanel];
  if (cur === undefined) {
    return; // no panel under the cursor
  }
  assignPhotoToSelected((cur.photo + 1) % photos.length);
}

function syncControls() {
  const setInput = (id, value) => {
    const input = document.getElementById(id);
    if (input !== null) {
      input.value = value;
    }
  };
  setInput("title", state.title);
  setInput("subtitle", state.subtitle);
  setInput("place", state.place);
  setInput("tagline", state.tagline);
  for (const b of document.querySelectorAll("#layout-pick button")) {
    b.classList.toggle("active", b.dataset.layout === state.layout);
  } // layout buttons
  for (const b of document.querySelectorAll("#grade-pick button")) {
    b.classList.toggle("active", b.dataset.grade === state.grade);
  } // grade buttons
  for (const b of document.querySelectorAll("#size-pick button")) {
    b.classList.toggle("active", b.dataset.size === state.size);
  } // size buttons
  let hi = 0;
  for (const b of document.querySelectorAll("#heat-pick button")) {
    b.classList.toggle("active", hi < state.heat);
    hi += 1;
  } // heat stars
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
    return; // no strip on this page
  }
  bar.innerHTML = "";
  for (let idx = 0; idx < photos.length; idx += 1) {
    const img = photos[idx];
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "thumb";
    let label = photoLabels[idx];
    if (label === undefined) {
      label = "Photo " + (idx + 1);
    }
    btn.title = label;
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
  }
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
  const keys = Object.keys(EXPORT_SIZES);
  for (let k = 0; k < keys.length; k += 1) {
    // eslint-disable-next-line no-await-in-loop
    await exportPNG(keys[k]);
  }
  status.textContent = "All 3 sizes saved: 1920 × 1080, 1080 × 1350, 1080 × 1080";
}

/** Adds user files as photos (read locally only — never uploaded). */
export async function addUserFiles(fileList) {
  for (let fi = 0; fi < fileList.length; fi += 1) {
    const f = fileList[fi];
    if (f.type.startsWith("image/") === false) {
      continue; // skip non-images
    }
    // eslint-disable-next-line no-await-in-loop
    const img = await loadImage(URL.createObjectURL(f));
    photos.push(img);
    photoLabels.push(f.name);
  }
  renderPhotoStrip();
  paintPreview();
}

/** Maps a click on the preview canvas to a panel index (topmost first). */
function panelAt(clientX, clientY) {
  const box = canvas.getBoundingClientRect();
  const x = canvas.width * ((clientX - box.left) / box.width);
  const y = canvas.height * ((clientY - box.top) / box.height);
  for (let i = lastPanels.length - 1; i >= 0; i -= 1) {
    const panel = lastPanels[i];
    if (panel.x <= x && x <= panel.x + panel.w && panel.y <= y && y <= panel.y + panel.h) {
      return i;
    }
  }
  return -1;
}

/** Wires every control in the editor shell to the state. */
function bindEditor() {
  document.getElementById("photo").addEventListener("change", (e) => {
    addUserFiles(Array.from(e.target.files));
    e.target.value = "";
  });
  const dropZone = document.getElementById("dropzone");
  dropZone.addEventListener("dragover", (e) => {
    e.preventDefault();
    dropZone.classList.add("over");
  });
  dropZone.addEventListener("dragleave", () => dropZone.classList.remove("over"));
  dropZone.addEventListener("drop", (e) => {
    e.preventDefault();
    dropZone.classList.remove("over");
    addUserFiles(Array.from(e.dataTransfer.files));
  });
  for (const b of document.querySelectorAll("#layout-pick button")) {
    b.addEventListener("click", () => {
      pushUndo();
      state.layout = b.dataset.layout;
      state.selectedPanel = 0;
      syncControls();
      paintPreview();
    });
  } // layout picker
  for (const b of document.querySelectorAll("#grade-pick button")) {
    b.addEventListener("click", () => {
      pushUndo();
      state.grade = b.dataset.grade;
      syncControls();
      paintPreview();
    });
  } // grade picker
  for (const b of document.querySelectorAll("#size-pick button")) {
    b.addEventListener("click", () => {
      state.size = b.dataset.size;
      syncControls();
      paintPreview();
    });
  } // size picker
  let hi = 0;
  for (const b of document.querySelectorAll("#heat-pick button")) {
    const n = hi;
    b.addEventListener("click", () => {
      pushUndo();
      state.heat = n + 1;
      syncControls();
      paintPreview();
    });
    hi += 1;
  } // heat picker
  for (const id of ["title", "subtitle", "place", "tagline"]) {
    document.getElementById(id).addEventListener("input", (e) => {
      state[id] = e.target.value;
      paintPreview();
    });
    document.getElementById(id).addEventListener("change", pushUndo);
  }
  document.getElementById("one-photo").addEventListener("change", (e) => {
    pushUndo();
    state.onePhoto = e.target.checked;
    if (state.onePhoto) {
      const crop = (state.assignments[state.layout] || [])[state.selectedPanel];
      if (crop !== undefined) {
        fillAllWithPhoto(crop.photo);
      }
    } else {
      paintPreview();
    }
  });
  document.getElementById("captions").addEventListener("change", (e) => {
    pushUndo();
    state.showCaptions = e.target.checked;
    paintPreview();
  });
  document.getElementById("cycle-photo").addEventListener("click", cyclePanelPhoto);
  document.getElementById("zoom").addEventListener("input", (e) => {
    const crop = (state.assignments[state.layout] || [])[state.selectedPanel];
    if (crop !== undefined) {
      crop.zoom = Number(e.target.value);
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
  canvas.addEventListener("pointerdown", (e) => {
    const i = panelAt(e.clientX, e.clientY);
    if (i < 0) {
      return; // clicked outside any panel
    }
    state.selectedPanel = i;
    const crop = (state.assignments[state.layout] || [])[i];
    drag = { x: e.clientX, y: e.clientY, fx: crop.fx, fy: crop.fy };
    canvas.setPointerCapture(e.pointerId);
    paintPreview();
  });
  canvas.addEventListener("pointermove", (e) => {
    if (drag === null) {
      return; // not dragging
    }
    const crop = (state.assignments[state.layout] || [])[state.selectedPanel];
    const rect = canvas.getBoundingClientRect();
    const p = lastPanels[state.selectedPanel];
    if (crop === undefined || p === undefined) {
      return; // no panel to pan
    }
    const dx = (canvas.width / p.w) * ((e.clientX - drag.x) / rect.width);
    const dy = (canvas.height / p.h) * ((e.clientY - drag.y) / rect.height);
    crop.fx = Math.max(0, Math.min(1, drag.fx - dx));
    crop.fy = Math.max(0, Math.min(1, drag.fy - dy));
    paintPreview();
  });
  canvas.addEventListener("pointerup", () => {
    if (drag !== null) {
      pushUndo();
      drag = null;
    }
  });
  canvas.addEventListener("wheel", (e) => {
    e.preventDefault();
    const crop = (state.assignments[state.layout] || [])[state.selectedPanel];
    if (crop === undefined) {
      return; // no panel to zoom
    }
    let f = 0.93;
    if (e.deltaY < 0) {
      f = 1.08;
    }
    crop.zoom = Math.max(1, Math.min(3, crop.zoom * f));
    const zoomInput = document.getElementById("zoom");
    if (zoomInput !== null) {
      zoomInput.value = crop.zoom;
    }
    paintPreview();
  }, { passive: false });
  document.addEventListener("keydown", (e) => {
    const meta = e.ctrlKey || e.metaKey;
    const k = e.key.toLowerCase();
    if (meta && k === "z" && e.shiftKey === false) {
      e.preventDefault();
      undo();
    }
    if (meta && (k === "y" || (k === "z" && e.shiftKey))) {
      e.preventDefault();
      redo();
    }
  });
}

const params = new URLSearchParams(window.location.search);
const shot = params.get("shot");
if (shot !== null && shot !== "") {
  runShot(shot, params, { state, photos, loadSamplePhotos, loadImage, renderPreview: paintPreview, canvas, bindEditor, syncControls });
} else {
  await document.fonts.ready;
  await document.fonts.load("100px Anton");
  await document.fonts.load("40px Pacifico");
  await loadSamplePhotos();
  bindEditor();
  syncControls();
  paintPreview();
}
