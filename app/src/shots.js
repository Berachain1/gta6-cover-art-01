// shots.js — fixed scenes for screenshots, driven by `?shot=`:
//
//   ?shot=cover[&layout=..&grade=..&title=..&size=landscape|portrait|square]
//       the exported cover alone, full frame — the app's own drawing of the
//       PNG it exports, at the post size
//   ?shot=editor — the editor in the browser with sample photos loaded
//
// window.__shotReady is set once the scene has painted, so a headless
// screenshot can wait for it instead of guessing a delay.

import { drawCoverGrid } from './cover.js';

const POST_SIZES = {
  landscape: [1920, 1080],
  portrait: [1080, 1350],
  square: [1080, 1080],
};

/** Applies ?layout / ?grade / ?title / ?subtitle / ?size onto the state. */
function applyParams(query, state) {
  const layout = query.get('layout');
  if (layout) state.layout = layout;
  const grade = query.get('grade');
  if (grade) state.grade = grade;
  const title = query.get('title');
  if (title) state.title = title;
  const subtitle = query.get('subtitle');
  if (subtitle !== null) state.subtitle = subtitle;
  const size = query.get('size');
  if (size) state.size = size;
}

/** Renders the cover scene onto the page canvas at the post size. */
async function runCoverScene(query, ctx) {
  document.body.classList.add('shot-cover');
  applyParams(query, ctx.state);
  await document.fonts.ready;
  await ctx.loadSamplePhotos();
  const sizeKey = ctx.state.size || 'landscape';
  const [w, h] = POST_SIZES[sizeKey] || POST_SIZES.landscape;
  ctx.canvas.width = w;
  ctx.canvas.height = h;
  drawCoverGrid(ctx.canvas, ctx.state, ctx.photos);
  document.title = 'READY';
  window.__shotReady = true;
}

/** Renders the editor scene: controls + live preview with photos loaded. */
async function runEditorScene(query, ctx) {
  applyParams(query, ctx.state);
  await document.fonts.ready;
  await ctx.loadSamplePhotos();
  ctx.bindEditor();
  ctx.syncControls();
  ctx.renderPreview();
  document.title = 'READY';
  window.__shotReady = true;
}

export async function runShot(shot, query, ctx) {
  if (shot === 'cover' || shot === 'portrait' || shot === 'square') {
    if (shot === 'portrait') ctx.state.size = 'portrait';
    if (shot === 'square') ctx.state.size = 'square';
    await runCoverScene(query, ctx);
    return;
  }
  if (shot === 'editor') {
    await runEditorScene(query, ctx);
    return;
  }
  window.__shotReady = true;
}
