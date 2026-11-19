// shots.js — the fixed scenes used for screenshots, picked by `?shot=`:
//
//   ?shot=cover[&layout=..&grade=..&title=..&size=landscape|portrait|square]
//       only the exported cover, edge to edge — the same drawing the
//       app exports as a PNG, at the post size
//   ?shot=editor — the editor itself in the browser, samples loaded
//
// Once a scene has painted, it sets window.__shotReady, so a headless
// screenshot can wait for that flag instead of guessing a delay.

import { drawCoverGrid } from "./cover.js";

// Post sizes for the cover scene: [width, height] in pixels.
const POST_DIMS = {
  landscape: [1920, 1080],
  portrait: [1080, 1350],
  square: [1080, 1080],
};

// Query keys copied straight onto state fields, in order.
const PARAM_KEYS = ["layout", "grade", "title", "size"];

/** Copies the recognised ?key=value pairs from the URL into state. */
function copyParams(params, st) {
  for (const key of PARAM_KEYS) {
    const value = params.get(key);
    if (value !== null && value !== "") {
      st[key] = value;
    }
  }
  const subtitle = params.get("subtitle");
  if (subtitle !== null) {
    st.subtitle = subtitle;
  }
}

/** Paints the cover scene onto the page canvas at the post size. */
async function paintCoverScene(params, kit) {
  document.body.classList.add("shot-cover");
  copyParams(params, kit.state);
  await document.fonts.ready;
  // fonts.ready can settle before Anton/Pacifico have even started
  // loading (nothing on the page uses them until the canvas does), and
  // a draw that measures with the fallback font comes out small — so
  // load both faces explicitly before anything is measured or drawn.
  await document.fonts.load("100px Anton");
  await document.fonts.load("40px Pacifico");
  await kit.loadSamplePhotos();
  const wanted = kit.state.size === undefined || kit.state.size === "" ? "landscape" : kit.state.size;
  const dims = POST_DIMS[wanted] === undefined ? POST_DIMS.landscape : POST_DIMS[wanted];
  kit.canvas.width = dims[0];
  kit.canvas.height = dims[1];
  drawCoverGrid(kit.canvas, kit.state, kit.photos);
  document.title = "READY";
  window.__shotReady = true;
}

/** Paints the editor scene: controls wired, preview drawn. */
async function paintEditorScene(params, kit) {
  copyParams(params, kit.state);
  await document.fonts.ready;
  // Same explicit load as the cover scene: fonts.ready alone can settle
  // before the faces have started loading, and the preview measures its
  // title with whatever font is there.
  await document.fonts.load("100px Anton");
  await document.fonts.load("40px Pacifico");
  await kit.loadSamplePhotos();
  kit.bindEditor();
  kit.syncControls();
  kit.renderPreview();
  document.title = "READY";
  window.__shotReady = true;
}

// Portrait and square are the cover scene with the size preset.
const SIZE_BY_SHOT = { cover: null, portrait: "portrait", square: "square" };

export async function runShot(shot, params, kit) {
  if (shot === "editor") {
    await paintEditorScene(params, kit);
    return;
  }
  if (shot === "cover" || shot === "portrait" || shot === "square") {
    const preset = SIZE_BY_SHOT[shot];
    if (preset) {
      kit.state.size = preset;
    }
    await paintCoverScene(params, kit);
    return;
  }
  window.__shotReady = true;
}
