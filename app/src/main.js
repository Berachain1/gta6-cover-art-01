// main.js — wires the Palm Heat Cover Studio editor.
//
// Photo picker + drag-drop, the six built-in sample photos, layout and grade
// pickers, caption fields, per-panel crop and position (click a panel, drag
// to pan, scroll to zoom), undo / redo, and PNG export in all three post
// sizes. A `?shot=` query runs a fixed scene for screenshots instead
// (./shots.js).

import { drawCoverGrid, exportCoverPNG, EXPORT_SIZES, LAYOUTS, GRADES, layoutPanels, panelCount } from './cover.js';
import { runShot } from './shots.js';

const SAMPLE_PHOTOS = [
  { src: 'samples/woman.jpg', name: 'Woman · convertible' },
  { src: 'samples/fisherman.jpg', name: 'Fisherman · pier' },
  { src: 'samples/neon.jpg', name: 'Friends · neon street' },
  { src: 'samples/rooftop.jpg', name: 'Man · rooftop' },
  { src: 'samples/boulevard.jpg', name: 'Boulevard · kit' },
  { src: 'samples/pier.jpg', name: 'Pier · kit' },
  { src: 'samples/car.jpg', name: 'Orange car · deco street' },
  { src: 'samples/coast.jpg', name: 'Coast road · sunset' },
  { src: 'samples/sunset.jpg', name: 'Woman · sunset convertible' },
];

// Panel caption chips (place / time / line), one per sample photo —
// original wording, the location/time chips the top-5 covers carry.
const CAPTIONS = [
  { place: 'CORAL DRIVE', time: '6:47 PM', line: 'ENGINE RUNNING' },
  { place: 'PIER 26', time: '5:30 AM', line: 'FIRST CAST' },
  { place: 'NEON MILE', time: '11:50 PM', line: 'NO BRAKES' },
  { place: 'ROOFTOP 9', time: '8:30 PM', line: 'CITY LIGHTS' },
  { place: 'PALM ROW', time: '9:15 PM', line: 'AFTER DARK' },
  { place: 'TOWER 2', time: '6:10 PM', line: 'GOLDEN HOUR' },
  { place: 'DECO ROW', time: '7:05 PM', line: 'TOP DOWN' },
  { place: 'COAST ROAD', time: '6:58 PM', line: 'LAST LIGHT' },
  { place: 'CORAL DRIVE', time: '7:42 PM', line: 'GOLDEN HOUR' },
];

// Default crop per panel, per layout: { photo, fx, fy, zoom }. fx/fy is the
// focus point (0..1) inside the photo; zoom >= 1. The crops are chosen so
// faces stay in frame and no panel shows an awkward body-part cut.
//
// hero-vice is MULTI-SUBJECT (v3): six different photos, one per panel —
// the top-5 covers' variety. Hero is the woman + pink convertible with
// her face whole (x ≈ 0.42, y ≈ 0.32); the other panels are the rooftop
// man, the neon couple, the fisherman, the orange car and the coast road,
// each cropped so its subject stays in frame.
const DEFAULT_ASSIGNMENTS = {
  // chaos is the v4 default: the top-3 key-art collage. Same six photos
  // as hero-vice (woman hero, rooftop man, neon couple, fisherman,
  // orange car, coast road), each cropped so its subject stays in frame.
  // v5: hero is the SUNSET woman (photo 8, blazing sky — #1's glow was
  // the one gap no layout fix could close). The 3-panel row in portrait/
  // square runs P1 P2 P3, and the title crashes over the whole row — a
  // face in the LEFT column sits behind the "P" and can never escape it,
  // so the row is ordered face-free left: car (no face), neon, rooftop
  // (right column, where the fisherman's face already escaped the "T").
  // Landscape is unaffected: P1 mid-top and P3 right-top both sit fully
  // above the title, so car/rooftop/fisherman all stay whole there.
  // Square is the exception: its row is short (0.44h), the title's
  // letters cover the whole row top, and the rooftop face — at the top
  // of its photo — cannot be cropped below the letters at any zoom
  // (verified: zoom 1.35 only pushed the beard below them). So P3
  // carries an `sq` override: the coast road (no face) in square only.
  // The override lives in cover.js (drawCoverGrid, w === h).
  chaos: [
    { photo: 8, fx: 0.42, fy: 0.32, zoom: 1.05 },
    { photo: 6, fx: 0.55, fy: 0.55, zoom: 1.15 },
    { photo: 2, fx: 0.55, fy: 0.42, zoom: 1.1 },
    { photo: 3, fx: 0.48, fy: 0.28, zoom: 1.0, sq: { photo: 7, fx: 0.45, fy: 0.55, zoom: 1.15 } },
    { photo: 1, fx: 0.48, fy: 0.3, zoom: 1.0 },
    { photo: 7, fx: 0.45, fy: 0.55, zoom: 1.15 },
  ],
  'hero-vice': [
    { photo: 0, fx: 0.42, fy: 0.32, zoom: 1.05 },
    { photo: 3, fx: 0.48, fy: 0.3, zoom: 1.15 },
    { photo: 2, fx: 0.55, fy: 0.42, zoom: 1.1 },
    { photo: 1, fx: 0.48, fy: 0.3, zoom: 1.0 },
    { photo: 6, fx: 0.55, fy: 0.55, zoom: 1.15 },
    { photo: 7, fx: 0.45, fy: 0.55, zoom: 1.15 },
  ],
  'vice-grid': [
    { photo: 0, fx: 0.5, fy: 0.32, zoom: 1.15 },
    { photo: 3, fx: 0.5, fy: 0.35, zoom: 1.1 },
    { photo: 1, fx: 0.5, fy: 0.35, zoom: 1.15 },
    { photo: 2, fx: 0.5, fy: 0.45, zoom: 1.05 },
    { photo: 6, fx: 0.55, fy: 0.55, zoom: 1.15 },
    { photo: 4, fx: 0.5, fy: 0.3, zoom: 1.25 },
    { photo: 7, fx: 0.45, fy: 0.55, zoom: 1.15 },
    { photo: 2, fx: 0.72, fy: 0.45, zoom: 1.4 },
  ],
  'hero-three': [
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
  'full-bleed': [
    { photo: 0, fx: 0.5, fy: 0.35, zoom: 1.05 },
    { photo: 2, fx: 0.5, fy: 0.45, zoom: 1.1 },
    { photo: 1, fx: 0.5, fy: 0.35, zoom: 1.2 },
  ],
};

/** A fresh default state (screenshot scenes start from this too). */
export function defaultState() {
  return {
    layout: 'chaos',
    grade: 'sunset',
    title: 'PALM HEAT',
    subtitle: 'where the sun never sets',
    place: 'CORAL BAY',
    tagline: 'EVERY STREET HAS A STORY',
    heat: 5,
    onePhoto: false,
    showRibbon: true,
    showBarcode: true,
    showCaptions: true,
    captions: CAPTIONS.map((c) => ({ ...c })),
    size: 'landscape',
    assignments: JSON.parse(JSON.stringify(DEFAULT_ASSIGNMENTS)),
    selectedPanel: 0,
  };
}

export const state = defaultState();
export const photos = []; // loaded Image elements; index matches photoNames
const photoNames = SAMPLE_PHOTOS.map((p) => p.name);

/** Loads one image, resolving once it can be drawn. */
export function loadImage(url) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`cannot load ${url}`));
    img.src = url;
  });
}

/** Loads every sample photo; resolves when all are drawable. */
export async function loadSamplePhotos() {
  photos.length = 0;
  for (const s of SAMPLE_PHOTOS) photos.push(await loadImage(s.src));
  return photos;
}

const canvas = document.getElementById('cover');
const status = document.getElementById('status');
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
  if (undoStack.length > 40) undoStack.shift();
  redoStack = [];
  updateUndoButtons();
}

function applySnapshot(json) {
  Object.assign(state, JSON.parse(json));
  syncControls();
  renderPreview();
}

export function undo() {
  if (!undoStack.length) return;
  redoStack.push(snapshotState());
  applySnapshot(undoStack.pop());
  updateUndoButtons();
}

export function redo() {
  if (!redoStack.length) return;
  undoStack.push(snapshotState());
  applySnapshot(redoStack.pop());
  updateUndoButtons();
}

function updateUndoButtons() {
  const u = document.getElementById('undo');
  const r = document.getElementById('redo');
  if (u) u.disabled = !undoStack.length;
  if (r) r.disabled = !redoStack.length;
}

/** Redraws the live preview at the selected post size. */
export function renderPreview() {
  const size = EXPORT_SIZES[state.size];
  canvas.width = size.w;
  canvas.height = size.h;
  canvas.style.aspectRatio = `${size.w} / ${size.h}`;
  lastPanels = drawCoverGrid(canvas, state, photos).panels;
  drawSelection();
  status.textContent = `Live preview · ${size.label} · ${LAYOUTS[state.layout]} · ${GRADES[state.grade]}`;
}

/** Outlines the selected panel on the preview canvas. */
function drawSelection() {
  const ctx = canvas.getContext('2d');
  const p = lastPanels[state.selectedPanel];
  if (!p) return;
  ctx.save();
  ctx.strokeStyle = '#ffd23f';
  ctx.lineWidth = Math.max(3, canvas.width / 480);
  ctx.setLineDash([18, 10]);
  ctx.strokeRect(p.x + 2, p.y + 2, p.w - 4, p.h - 4);
  ctx.setLineDash([]);
  ctx.fillStyle = '#ffd23f';
  ctx.font = `bold ${Math.max(16, canvas.width / 64)}px sans-serif`;
  ctx.textAlign = 'left';
  ctx.fillText(`PANEL ${state.selectedPanel + 1}`, p.x + 14, p.y + Math.max(22, canvas.width / 48));
  ctx.restore();
}

/**
 * Fills every panel of every layout with one photo (the #2 trick: one face,
 * many crops — the cover stays consistent).
 */
export function fillAllWithPhoto(photoIndex) {
  pushUndo();
  const fxs = [0.5, 0.3, 0.7, 0.5, 0.25, 0.75, 0.5, 0.35];
  const fys = [0.32, 0.45, 0.4, 0.3, 0.5, 0.42, 0.6, 0.35];
  for (const layout of Object.keys(state.assignments)) {
    state.assignments[layout] = state.assignments[layout].map((a, i) => ({
      ...a,
      photo: photoIndex,
      fx: fxs[i % 8],
      fy: fys[i % 8],
      zoom: 1.25,
    }));
  }
  renderPreview();
}

/** Puts a photo into the selected panel (or all panels, if one-photo mode). */
export function assignPhotoToSelected(photoIndex) {
  pushUndo();
  const list = state.assignments[state.layout];
  if (list[state.selectedPanel]) list[state.selectedPanel].photo = photoIndex;
  if (state.onePhoto) fillAllWithPhoto(photoIndex);
  else renderPreview();
  renderPhotoStrip();
}

/** Cycles the selected panel to the next photo. */
export function cyclePanelPhoto() {
  const list = state.assignments[state.layout];
  const a = list[state.selectedPanel];
  if (!a) return;
  assignPhotoToSelected((a.photo + 1) % photos.length);
}

function syncControls() {
  const set = (id, v) => { const el = document.getElementById(id); if (el) el.value = v; };
  set('title', state.title);
  set('subtitle', state.subtitle);
  set('place', state.place);
  set('tagline', state.tagline);
  document.querySelectorAll('#layout-pick button').forEach((b) => b.classList.toggle('active', b.dataset.layout === state.layout));
  document.querySelectorAll('#grade-pick button').forEach((b) => b.classList.toggle('active', b.dataset.grade === state.grade));
  document.querySelectorAll('#size-pick button').forEach((b) => b.classList.toggle('active', b.dataset.size === state.size));
  document.querySelectorAll('#heat-pick button').forEach((b, i) => b.classList.toggle('active', i < state.heat));
  const one = document.getElementById('one-photo');
  if (one) one.checked = state.onePhoto;
  const cap = document.getElementById('captions');
  if (cap) cap.checked = state.showCaptions !== false;
  const zoom = document.getElementById('zoom');
  const a = (state.assignments[state.layout] || [])[state.selectedPanel];
  if (zoom && a) zoom.value = a.zoom;
  renderPhotoStrip();
}

/** The photo strip: samples + uploads, click to put into the selected panel. */
function renderPhotoStrip() {
  const strip = document.getElementById('photo-strip');
  if (!strip) return;
  strip.innerHTML = '';
  photos.forEach((img, i) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'thumb';
    b.title = photoNames[i] || `Photo ${i + 1}`;
    const t = document.createElement('img');
    t.src = img.src;
    t.alt = b.title;
    b.appendChild(t);
    const a = (state.assignments[state.layout] || [])[state.selectedPanel];
    if (a && a.photo === i) b.classList.add('in-use');
    b.addEventListener('click', () => assignPhotoToSelected(i));
    strip.appendChild(b);
  });
}

/** Downloads a blob as a file. */
function downloadBlob(blob, name) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 5000);
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
  for (const key of Object.keys(EXPORT_SIZES)) {
    // eslint-disable-next-line no-await-in-loop
    await exportPNG(key);
  }
  status.textContent = 'Saved all 3 sizes: 1920 × 1080, 1080 × 1350, 1080 × 1080';
}

/** Adds user files as photos (read locally only — never uploaded). */
export async function addUserFiles(files) {
  for (const file of files) {
    if (!file.type.startsWith('image/')) continue;
    // eslint-disable-next-line no-await-in-loop
    const img = await loadImage(URL.createObjectURL(file));
    photos.push(img);
    photoNames.push(file.name);
  }
  renderPhotoStrip();
  renderPreview();
}

/** Maps a click on the preview canvas to a panel index (topmost first). */
function panelAt(clientX, clientY) {
  const rect = canvas.getBoundingClientRect();
  const x = ((clientX - rect.left) / rect.width) * canvas.width;
  const y = ((clientY - rect.top) / rect.height) * canvas.height;
  for (let i = lastPanels.length - 1; i >= 0; i--) {
    const p = lastPanels[i];
    if (x >= p.x && x <= p.x + p.w && y >= p.y && y <= p.y + p.h) return i;
  }
  return -1;
}

function bindEditor() {
  document.getElementById('photo').addEventListener('change', (e) => {
    addUserFiles([...e.target.files]);
    e.target.value = '';
  });
  const drop = document.getElementById('dropzone');
  drop.addEventListener('dragover', (e) => { e.preventDefault(); drop.classList.add('over'); });
  drop.addEventListener('dragleave', () => drop.classList.remove('over'));
  drop.addEventListener('drop', (e) => {
    e.preventDefault();
    drop.classList.remove('over');
    addUserFiles([...e.dataTransfer.files]);
  });
  document.querySelectorAll('#layout-pick button').forEach((b) => b.addEventListener('click', () => {
    pushUndo();
    state.layout = b.dataset.layout;
    state.selectedPanel = 0;
    syncControls();
    renderPreview();
  }));
  document.querySelectorAll('#grade-pick button').forEach((b) => b.addEventListener('click', () => {
    pushUndo();
    state.grade = b.dataset.grade;
    syncControls();
    renderPreview();
  }));
  document.querySelectorAll('#size-pick button').forEach((b) => b.addEventListener('click', () => {
    state.size = b.dataset.size;
    syncControls();
    renderPreview();
  }));
  document.querySelectorAll('#heat-pick button').forEach((b, i) => b.addEventListener('click', () => {
    pushUndo();
    state.heat = i + 1;
    syncControls();
    renderPreview();
  }));
  for (const id of ['title', 'subtitle', 'place', 'tagline']) {
    document.getElementById(id).addEventListener('input', (e) => {
      state[id] = e.target.value;
      renderPreview();
    });
    document.getElementById(id).addEventListener('change', pushUndo);
  }
  document.getElementById('one-photo').addEventListener('change', (e) => {
    pushUndo();
    state.onePhoto = e.target.checked;
    if (state.onePhoto) {
      const a = (state.assignments[state.layout] || [])[state.selectedPanel];
      if (a) fillAllWithPhoto(a.photo);
    } else renderPreview();
  });
  document.getElementById('captions').addEventListener('change', (e) => {
    pushUndo();
    state.showCaptions = e.target.checked;
    renderPreview();
  });
  document.getElementById('cycle-photo').addEventListener('click', cyclePanelPhoto);
  document.getElementById('zoom').addEventListener('input', (e) => {
    const a = (state.assignments[state.layout] || [])[state.selectedPanel];
    if (a) { a.zoom = Number(e.target.value); renderPreview(); }
  });
  document.getElementById('zoom').addEventListener('change', pushUndo);
  document.getElementById('export').addEventListener('click', () => exportPNG(state.size));
  document.getElementById('export-all').addEventListener('click', exportAllSizes);
  document.getElementById('undo').addEventListener('click', undo);
  document.getElementById('redo').addEventListener('click', redo);

  // Click a panel to select it; drag on it to pan its crop; wheel to zoom.
  let drag = null;
  canvas.addEventListener('pointerdown', (e) => {
    const i = panelAt(e.clientX, e.clientY);
    if (i < 0) return;
    state.selectedPanel = i;
    const a = (state.assignments[state.layout] || [])[i];
    drag = { x: e.clientX, y: e.clientY, fx: a.fx, fy: a.fy };
    canvas.setPointerCapture(e.pointerId);
    renderPreview();
  });
  canvas.addEventListener('pointermove', (e) => {
    if (!drag) return;
    const a = (state.assignments[state.layout] || [])[state.selectedPanel];
    const rect = canvas.getBoundingClientRect();
    const p = lastPanels[state.selectedPanel];
    if (!a || !p) return;
    a.fx = Math.max(0, Math.min(1, drag.fx - ((e.clientX - drag.x) / rect.width) * (canvas.width / p.w)));
    a.fy = Math.max(0, Math.min(1, drag.fy - ((e.clientY - drag.y) / rect.height) * (canvas.height / p.h)));
    renderPreview();
  });
  canvas.addEventListener('pointerup', () => { if (drag) { pushUndo(); drag = null; } });
  canvas.addEventListener('wheel', (e) => {
    e.preventDefault();
    const a = (state.assignments[state.layout] || [])[state.selectedPanel];
    if (!a) return;
    a.zoom = Math.max(1, Math.min(3, a.zoom * (e.deltaY < 0 ? 1.08 : 0.93)));
    const zoom = document.getElementById('zoom');
    if (zoom) zoom.value = a.zoom;
    renderPreview();
  }, { passive: false });
  document.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z' && !e.shiftKey) { e.preventDefault(); undo(); }
    if ((e.ctrlKey || e.metaKey) && (e.key.toLowerCase() === 'y' || (e.key.toLowerCase() === 'z' && e.shiftKey))) { e.preventDefault(); redo(); }
  });
}

const query = new URLSearchParams(location.search);
const shot = query.get('shot');
if (shot) {
  runShot(shot, query, { state, photos, loadSamplePhotos, loadImage, renderPreview, canvas, bindEditor, syncControls });
} else {
  await document.fonts.ready;
  await loadSamplePhotos();
  bindEditor();
  syncControls();
  renderPreview();
}
