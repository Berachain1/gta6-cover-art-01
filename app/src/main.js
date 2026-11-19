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

// The sample photos the app ships with: file plus the label the strip
// shows under each thumbnail.
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

// Caption chips for the panels (place / time / line), one per sample
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

// Default crop per panel, per layout. fx/fy is the focus point (0..1)
// inside the photo; zoom is >= 1. The crops are picked so faces stay
// in frame and no panel shows an awkward body-part cut. A crop may
// carry an `sq` override used only for the square render.
//
// hero-vice is MULTI-SUBJECT (v3): six different photos, one per
// panel — the variety the top-5 covers have. The hero is the woman
// with the pink convertible, her face whole (x about 0.42, y about
// 0.32); the other panels are the rooftop man, the neon couple, the
// fisherman, the orange car and the coast road, each cropped so its
// subject stays in frame.
const ASSIGNMENTS_DEFAULT = {
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
  let n = 0;
  while (n < SAMPLE_PHOTOS.length) {
    photos.push(await loadImage(SAMPLE_PHOTOS[n].src));
    n += 1;
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
  const copy = { ...state };
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
  const ctx = canvas.getContext("2d");
  const sel = lastPanels[state.selectedPanel];
  if (sel === undefined) {
    return; // no panel selected
  }
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
  for (const name of Object.keys(state.assignments)) {
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
  document.querySelectorAll("#layout-pick button").forEach((b) => {
    b.classList.toggle("active", b.dataset.layout === state.layout);
  }); // layout buttons
  document.querySelectorAll("#grade-pick button").forEach((b) => {
    b.classList.toggle("active", b.dataset.grade === state.grade);
  }); // grade buttons
  document.querySelectorAll("#size-pick button").forEach((b) => {
    b.classList.toggle("active", b.dataset.size === state.size);
  }); // size buttons
  document.querySelectorAll("#heat-pick button").forEach((b, i) => {
    b.classList.toggle("active", i < state.heat);
  }); // heat stars
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
  document.getElementById("photo").addEventListener("change", (e) => {
    addUserFiles([...e.target.files]);
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
    addUserFiles([...e.dataTransfer.files]);
  });
  document.querySelectorAll("#layout-pick button").forEach((b) => {
    b.addEventListener("click", () => {
      pushUndo();
      state.layout = b.dataset.layout;
      state.selectedPanel = 0;
      syncControls();
      paintPreview();
    });
  }); // layout picker
  document.querySelectorAll("#grade-pick button").forEach((b) => {
    b.addEventListener("click", () => {
      pushUndo();
      state.grade = b.dataset.grade;
      syncControls();
      paintPreview();
    });
  }); // grade picker
  document.querySelectorAll("#size-pick button").forEach((b) => {
    b.addEventListener("click", () => {
      state.size = b.dataset.size;
      syncControls();
      paintPreview();
    });
  }); // size picker
  document.querySelectorAll("#heat-pick button").forEach((b, i) => {
    b.addEventListener("click", () => {
      pushUndo();
      state.heat = i + 1;
      syncControls();
      paintPreview();
    });
  }); // heat picker
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
    const f = e.deltaY < 0 ? 1.08 : 0.93;
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
