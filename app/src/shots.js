// shots.js — the fixed scenes used for screenshots, picked by `?shot=`.
//
//   ?shot=cover[&layout=..&grade=..&title=..&size=landscape|portrait|square]
//       just the exported cover, edge to edge — the same drawing the
//       app exports as a PNG, at the post size
//   ?shot=editor — the editor itself in the browser, samples loaded
//
// Once a scene has painted, it sets window.__shotReady, so a headless
// screenshot can wait for that flag instead of guessing a delay.

import { drawCoverGrid } from "./cover.js";

// Post sizes for the cover scene: [width, height] in pixels.
const SIZE_MAP = {
  portrait: [1080, 1350],
  square: [1080, 1080],
  landscape: [1920, 1080],
};

// Query keys copied straight onto state fields, in order.
const PARAM_KEYS = ["layout", "grade", "title", "size"];

/** Copies the recognised ?key=value pairs from the URL into state. */
function applyQueryParams(q, state) {
  for (const k of PARAM_KEYS) {
    const v = q.get(k);
    if (v !== null && v !== "") {
      state[k] = v;
    }
  }
  const sub = q.get("subtitle");
  if (sub !== null) {
    state.subtitle = sub;
  }
}

/** Loads both display faces explicitly before anything is drawn. */
async function loadFaces() {
  await document.fonts.ready;
  // fonts.ready can settle before Anton/Pacifico have even started
  // loading (nothing on the page uses them until the canvas does), and
  // a draw that measures with the fallback font comes out small — so
  // load both faces explicitly before anything is measured or drawn.
  await document.fonts.load("100px Anton");
  await document.fonts.load("40px Pacifico");
}

/** Paints the cover scene onto the page canvas at the post size. */
async function paintCoverScene(q, kit) {
  document.body.classList.add("shot-cover");
  applyQueryParams(q, kit.state);
  await loadFaces();
  await kit.loadSamplePhotos();
  const sizeKey = kit.state.size === undefined || kit.state.size === "" ? "landscape" : kit.state.size;
  const wh = SIZE_MAP[sizeKey] ?? SIZE_MAP.landscape;
  kit.canvas.width = wh[0];
  kit.canvas.height = wh[1];
  drawCoverGrid(kit.canvas, kit.state, kit.photos);
  document.title = "READY";
  window.__shotReady = true;
}

/** Paints the editor scene: controls wired, preview drawn. */
async function paintEditorScene(q, kit) {
  applyQueryParams(q, kit.state);
  await loadFaces();
  await kit.loadSamplePhotos();
  kit.bindEditor();
  kit.syncControls();
  kit.renderPreview();
  document.title = "READY";
  window.__shotReady = true;
}

// Portrait and square are the cover scene with the size preset.
const SIZE_PRESETS = { square: "square", portrait: "portrait", cover: null };

export async function runShot(scene, q, kit) {
  if (scene === "editor") {
    await paintEditorScene(q, kit);
  } else if (scene === "cover" || scene === "portrait" || scene === "square") {
    const size = SIZE_PRESETS[scene];
    if (size !== null) {
      kit.state.size = size;
    }
    await paintCoverScene(q, kit);
  } else {
    window.__shotReady = true;
  }
}
