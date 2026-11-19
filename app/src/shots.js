// shots.js — fixed scenes for the screenshots, selected by `?shot=`:
//
//   ?shot=cover[&layout=..&grade=..&title=..&size=landscape|portrait|square]
//       just the exported cover, edge to edge — the same drawing the
//       app exports as a PNG, at the post size
//   ?shot=editor — the editor itself in the browser, samples loaded
//
// After a scene has painted it sets window.__shotReady, so a headless
// screenshot can wait for that flag instead of guessing a delay.

import { drawCoverGrid } from "./cover.js";

// Post sizes for the cover scene: [width, height] in pixels.
const SHOT_SIZES = {
  landscape: [1920, 1080],
  portrait: [1080, 1350],
  square: [1080, 1080],
};

// Query keys that copy straight onto state fields, in order.
const QUERY_KEYS = ["layout", "grade", "title", "size"];

/** Copies the recognised ?key=value pairs from the URL into state. */
function applyParams(query, st) {
  QUERY_KEYS.forEach((key) => {
    const value = query.get(key);
    if (value !== null && value !== "") {
      st[key] = value;
    }
  });
  const subtitle = query.get("subtitle");
  if (subtitle !== null) {
    st.subtitle = subtitle;
  }
}

/** Paints the cover scene onto the page canvas at the post size. */
async function runCoverScene(query, env) {
  document.body.classList.add("shot-cover");
  applyParams(query, env.state);
  await document.fonts.ready;
  // fonts.ready can settle before Anton/Pacifico have even started
  // loading (nothing on the page uses them until the canvas does), and
  // a draw that measures with the fallback font comes out small — so
  // load both faces explicitly before anything is measured or drawn.
  await document.fonts.load("100px Anton");
  await document.fonts.load("40px Pacifico");
  await env.loadSamplePhotos();
  const pickedSize = env.state.size === undefined || env.state.size === "" ? "landscape" : env.state.size;
  const dims = SHOT_SIZES[pickedSize] === undefined ? SHOT_SIZES.landscape : SHOT_SIZES[pickedSize];
  env.canvas.width = dims[0];
  env.canvas.height = dims[1];
  drawCoverGrid(env.canvas, env.state, env.photos);
  document.title = "READY";
  window.__shotReady = true;
}

/** Paints the editor scene: controls wired, preview drawn. */
async function runEditorScene(query, env) {
  applyParams(query, env.state);
  await document.fonts.ready;
  // Same explicit load as the cover scene: fonts.ready alone can settle
  // before the faces have started loading, and the preview measures its
  // title with whatever font is there.
  await document.fonts.load("100px Anton");
  await document.fonts.load("40px Pacifico");
  await env.loadSamplePhotos();
  env.bindEditor();
  env.syncControls();
  env.renderPreview();
  document.title = "READY";
  window.__shotReady = true;
}

// Portrait and square are the cover scene with the size preset.
const COVER_SIZE_PRESETS = { cover: null, portrait: "portrait", square: "square" };

export async function runShot(shot, query, env) {
  const preset = Object.prototype.hasOwnProperty.call(COVER_SIZE_PRESETS, shot)
    ? COVER_SIZE_PRESETS[shot]
    : undefined;
  if (preset !== undefined || shot === "cover") {
    if (preset) {
      env.state.size = preset;
    }
    await runCoverScene(query, env);
    return;
  }
  if (shot === "editor") {
    await runEditorScene(query, env);
    return;
  }
  window.__shotReady = true;
}
