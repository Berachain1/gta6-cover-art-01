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
const POST_SIZES = new Map([
  ["portrait", [1080, 1350]], // tall post
  ["square", [1080, 1080]], // square post
  ["landscape", [1920, 1080]], // wide post
]);

// Query keys copied straight onto state fields, in order.
const QUERY_FIELDS = ["layout", "grade", "title", "size"];

/** Copies the recognised ?key=value pairs from the URL into state. */
function applyQueryParams(params, st) {
  for (const key of QUERY_FIELDS) {
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

/** Loads both display faces explicitly before anything is drawn. */
async function primeFonts() {
  await document.fonts.ready;
  // fonts.ready can settle before Anton/Pacifico have even started
  // loading (nothing on the page uses them until the canvas does), and
  // a draw that measures with the fallback font comes out small — so
  // load both faces explicitly before anything is measured or drawn.
  await document.fonts.load("40px Pacifico");
  await document.fonts.load("100px Anton");
}

/** Paints the cover scene onto the page canvas at the post size. */
async function renderCoverShot(params, kit) {
  document.body.classList.add("shot-cover");
  applyQueryParams(params, kit.state);
  await primeFonts();
  await kit.loadSamplePhotos();
  const wanted = kit.state.size === undefined || kit.state.size === "" ? "landscape" : kit.state.size;
  const dims = POST_SIZES.get(wanted) ?? POST_SIZES.get("landscape");
  kit.canvas.width = dims[0];
  kit.canvas.height = dims[1];
  drawCoverGrid(kit.canvas, kit.state, kit.photos); // paint it
  document.title = "READY"; // cover scene done
  window.__shotReady = true; // cover scene done
}

/** Paints the editor scene: controls wired, preview drawn. */
async function renderEditorShot(params, kit) {
  applyQueryParams(params, kit.state);
  await primeFonts();
  await kit.loadSamplePhotos();
  kit.bindEditor(); // wire controls
  kit.syncControls(); // reflect state
  kit.renderPreview(); // draw once
  document.title = "READY"; // editor scene done
  window.__shotReady = true; // editor scene done
}

// Portrait and square are the cover scene with the size preset.
const SHOT_SIZE_PRESET = { cover: null, portrait: "portrait", square: "square" };

export async function runShot(shot, params, kit) {
  if (shot === "editor") {
    await renderEditorShot(params, kit);
  } else if (shot === "cover" || shot === "portrait" || shot === "square") {
    const preset = SHOT_SIZE_PRESET[shot];
    if (preset !== null) {
      kit.state.size = preset;
    }
    await renderCoverShot(params, kit);
  } else {
    window.__shotReady = true; // unknown shot: ready at once
  }
}
