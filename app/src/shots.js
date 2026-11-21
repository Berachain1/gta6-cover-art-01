// shots.js — the fixed scenes used for screenshots, picked by
// `?shot=`.
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
const COVER_DIMS = {
  landscape: [1920, 1080],
  square: [1080, 1080],
  portrait: [1080, 1350],
};

// Query keys copied straight onto state fields, in order.
const STATE_KEYS = ["layout", "grade", "title", "size"];

/** Copies the recognised ?key=value pairs from the URL into state. */
function copyQueryToState(q, state) {
  for (const k of STATE_KEYS) {
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
async function ensureFaces() {
  await document.fonts.ready;
  // fonts.ready can settle before Anton/Pacifico have even started
  // loading (nothing on the page uses them until the canvas does), and
  // a draw that measures with the fallback font comes out small — so
  // load both faces explicitly before anything is measured or drawn.
  await document.fonts.load("100px Anton");
  await document.fonts.load("40px Pacifico");
}

/** Paints the cover scene onto the page canvas at the post size. */
async function renderCoverShot(q, kit) {
  document.body.classList.add("shot-cover");
  copyQueryToState(q, kit.state);
  await ensureFaces();
  await kit.loadSamplePhotos();
  let key = kit.state.size;
  if (key === undefined || key === "") {
    key = "landscape";
  }
  const dims = COVER_DIMS[key] ?? COVER_DIMS.landscape;
  kit.canvas.width = dims[0];
  kit.canvas.height = dims[1];
  drawCoverGrid(kit.canvas, kit.state, kit.photos);
  document.title = "READY";
  window.__shotReady = true;
}

/** Paints the editor scene: controls wired, preview drawn. */
async function renderEditorShot(q, kit) {
  copyQueryToState(q, kit.state);
  await ensureFaces();
  await kit.loadSamplePhotos();
  kit.bindEditor();
  kit.syncControls();
  kit.renderPreview();
  document.title = "READY";
  window.__shotReady = true;
}

// Portrait and square are the cover scene with the size preset.
function coverWithSize(size) {
  return async (q, kit) => {
    kit.state.size = size;
    await renderCoverShot(q, kit);
  };
}

const SCENES = {
  editor: renderEditorShot,
  cover: renderCoverShot,
  portrait: coverWithSize("portrait"),
  square: coverWithSize("square"),
};

export async function runShot(scene, q, kit) {
  const run = SCENES[scene];
  if (run === undefined) {
    window.__shotReady = true;
    return;
  }
  await run(q, kit);
}
