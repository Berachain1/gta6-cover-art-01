// grades.js — colour grades for every cover panel.
//
// A grade works as a gradient map: a pixel's brightness picks a colour
// from the grade's palette, and that colour is blended back toward the
// pixel it came from, so a photo keeps its own identity instead of
// going flat. Poster Ink adds a comic-book pass on top: a few flat
// posterised levels, halftone dots, film grain, and a vignette.
// Everything runs on plain 2D canvas pixels, so it works on any
// photo — samples, phone shots, anything — with no network and no
// library.
//
// The ink palette is warm in the mid-tones on purpose. Skin lives in
// the middle of the brightness range, and a magenta-heavy map turns
// faces purple; the ink stops below push mids toward coral-orange
// instead, and warmSkinTones() adds a small red lift and blue cut in
// that same band before posterising, so faces stay warm while the
// shadows keep their violet depth.

// Rec. 601 brightness of the pixel starting at `k` in `data`.
function luma(data, k) {
  return data[k] * 0.299 + data[k + 1] * 0.587 + data[k + 2] * 0.114;
}

function clamp255(n) {
  return Math.max(0, Math.min(255, n));
}

function clampNum(v, lo, hi) {
  return Math.min(hi, Math.max(lo, v));
}

// Palette stops per grade, as [at, r, g, b] rows the lookup reads.
export const GRADE_PALETTES = {
  sunset: [
    [0, 26, 8, 46],
    [0.28, 100, 40, 70],
    [0.55, 220, 130, 80],
    [0.78, 250, 160, 90],
    [1, 255, 210, 63],
  ],
  neon: [
    [0, 10, 8, 48],
    [0.3, 74, 20, 120],
    [0.55, 168, 38, 150],
    [0.78, 255, 64, 160],
    [1, 64, 224, 208],
  ],
  golden: [
    [0, 40, 20, 8],
    [0.3, 122, 62, 18],
    [0.55, 214, 122, 32],
    [0.8, 255, 176, 64],
    [1, 255, 236, 160],
  ],
  // Warm mids on purpose — coral-orange at 0.55, not magenta-pink —
  // so skin in the poster-ink pass reads sun-warmed instead of purple.
  ink: [
    [0, 22, 6, 38],
    [0.3, 132, 38, 62],
    [0.55, 224, 72, 84],
    [0.78, 255, 138, 58],
    [1, 255, 214, 92],
  ],
};

// The two palette stops bracketing `pos` (0..1) in `ramp`. Each stop
// is [at, r, g, b], so index 0 is the position and 1..3 are colours.
function findStops(ramp, pos) {
  let low = ramp[0];
  let high = ramp[ramp.length - 1];
  for (let k = 0; k + 1 < ramp.length; k++) {
    if (pos < ramp[k][0] || pos > ramp[k + 1][0]) {
      continue;
    }
    low = ramp[k];
    high = ramp[k + 1];
    break;
  }
  return [low, high];
}

/**
 * Builds one lookup table per channel for `grade`. `strength` 0..1
 * sets how far the mapped colour replaces the original pixel
 * (1 = full gradient map).
 */
export function buildGradeLUT(grade, strength = 0.62) {
  const ramp = GRADE_PALETTES[grade] ?? GRADE_PALETTES.sunset;
  const table = { r: new Uint8Array(256), g: new Uint8Array(256), b: new Uint8Array(256) };
  const chanNames = ["r", "g", "b"];
  for (let val = 0; val < 256; val++) {
    const pos = val / 255;
    const [low, high] = findStops(ramp, pos);
    const gap = high[0] - low[0];
    let mix = 0;
    if (gap !== 0) {
      mix = (pos - low[0]) / gap;
    }
    chanNames.forEach((chan, idx) => {
      const stopIdx = idx + 1;
      const col = low[stopIdx] + (high[stopIdx] - low[stopIdx]) * mix;
      table[chan][val] = Math.round(val + (col - val) * strength);
    });
  }
  return table;
}

/** Runs every pixel through the grade LUT, keyed by brightness. */
export function applyGradientGrade(pic, grade, strength) {
  const table = buildGradeLUT(grade, strength);
  const data = pic.data;
  let k = 0;
  while (k < data.length) {
    const bright = luma(data, k) | 0;
    data[k] = table.r[bright];
    data[k + 1] = table.g[bright];
    data[k + 2] = table.b[bright];
    k += 4;
  }
  return pic;
}

/**
 * Warms the skin band: pixels whose brightness sits in the middle range
 * get a red lift and a blue cut, fading to nothing at the band edges.
 * It runs before posterising so the poster-ink grade keeps faces warm
 * rather than pushing them toward violet. `amount` 0..1; 0.5 is gentle.
 */
export function warmSkinTones(pic, amount = 0.5) {
  const data = pic.data;
  const redLift = amount * 14;
  const blueCut = amount * 12;
  let k = 0;
  while (k < data.length) {
    const bright = luma(data, k);
    if (bright >= 70 && bright <= 215) {
      // Triangle weight: full effect near brightness 140, fading to none at the edges.
      let w;
      if (bright < 140) {
        w = (bright - 70) / 70;
      } else {
        w = (215 - bright) / 75;
      }
      data[k] = clamp255(data[k] + redLift * w);
      data[k + 2] = clamp255(data[k + 2] - blueCut * w);
    }
    k += 4;
  }
  return pic;
}

/**
 * Warms the bright end: pixels brighter than `cutoff` get a red/orange
 * lift that grows with brightness, so skies and highlights glow sunset
 * instead of staying pale blue-white. Only the sunset grade uses it.
 */
export function warmHighlights(frame, amount = 0.5, cutoff = 175) {
  const data = frame.data;
  let k = 0;
  while (k < data.length) {
    const bright = luma(data, k);
    if (bright > cutoff) {
      const w = amount * ((bright - cutoff) / (255 - cutoff));
      data[k] = clamp255(data[k] + 26 * w);
      data[k + 1] = clamp255(data[k + 1] + 8 * w);
      data[k + 2] = clamp255(data[k + 2] - 14 * w);
    }
    k += 4;
  }
  return frame;
}

/** Flattens every channel to `levels` even steps — the comic-ink feel. */
export function posterizeImageData(pic, levels = 5) {
  const data = pic.data;
  const gap = 255 / (levels - 1);
  let k = 0;
  while (k < data.length) {
    [0, 1, 2].forEach((chan) => {
      const val = Math.round(data[k + chan] / gap) * gap;
      data[k + chan] = Math.round(val);
    });
    k += 4;
  }
  return pic;
}

/** Pushes colours away from grey, in place (1 leaves them unchanged). */
export function saturateImageData(pic, amt = 1.25) {
  const data = pic.data;
  let k = 0;
  while (k < data.length) {
    const bright = luma(data, k);
    [0, 1, 2].forEach((chan) => {
      data[k + chan] = clamp255(bright + (data[k + chan] - bright) * amt);
    });
    k += 4;
  }
  return pic;
}

let halftoneTile = null;
/** A reusable print-dot tile, denser toward one corner of a cell. */
export function makeHalftonePattern(size = 96) {
  if (halftoneTile === null) {
    const tile = document.createElement("canvas");
    tile.width = size;
    tile.height = size;
    const pen = tile.getContext("2d");
    const cell = 12;
    const rows = Math.floor(size / cell);
    for (let ry = 0; ry < rows; ry++) {
      for (let cx = 0; cx < rows; cx++) {
        const rad = 1 + 1.1 * ((ry + cx) % 4);
        const px = cx * cell + cell * 0.5;
        const py = ry * cell + cell * 0.5;
        pen.fillStyle = "rgba(20,4,32,0.55)";
        pen.beginPath();
        pen.arc(px, py, rad, 0, Math.PI * 2);
        pen.fill();
      }
    }
    halftoneTile = tile;
  }
  return halftoneTile;
}

/** Lays halftone dots over a panel, at low opacity. */
export function applyHalftone(pen, w, h, alpha = 0.16) {
  const pat = pen.createPattern(makeHalftonePattern(), "repeat");
  pen.save();
  pen.globalAlpha = alpha;
  pen.fillStyle = pat;
  pen.fillRect(0, 0, w, h);
  pen.restore();
}

let grainTile = null;
/** A reusable neutral film-grain tile, built once. */
export function makeGrainCanvas(size = 160) {
  if (grainTile === null) {
    const tile = document.createElement("canvas");
    tile.width = size;
    tile.height = size;
    const pen = tile.getContext("2d");
    const frame = pen.createImageData(size, size);
    let k = 0;
    while (k < frame.data.length) {
      const val = 98 + Math.floor(40 * Math.random());
      frame.data[k] = val;
      frame.data[k + 1] = val;
      frame.data[k + 2] = val;
      frame.data[k + 3] = 255;
      k += 4;
    }
    pen.putImageData(frame, 0, 0);
    grainTile = tile;
  }
  return grainTile;
}

/** Dusts film grain over a panel using an overlay blend. */
export function applyGrain(pen, w, h, alpha = 0.07) {
  const pat = pen.createPattern(makeGrainCanvas(), "repeat");
  pen.save();
  pen.globalAlpha = alpha;
  pen.globalCompositeOperation = "overlay";
  pen.fillStyle = pat;
  pen.fillRect(0, 0, w, h);
  pen.restore();
}

/** Darkens the corners of a panel so it reads like a printed poster. */
export function applyVignette(pen, w, h, amt = 0.28) {
  const grad = pen.createRadialGradient(
    0.5 * w, 0.5 * h, 0.32 * Math.min(w, h),
    0.5 * w, 0.5 * h, 0.72 * Math.max(w, h),
  );
  grad.addColorStop(0, "rgba(10,2,20,0)");
  grad.addColorStop(1, "rgba(10,2,20," + amt + ")");
  pen.save();
  pen.fillStyle = grad;
  pen.fillRect(0, 0, w, h);
  pen.restore();
}

/**
 * Grades a single photo panel and hands back the graded canvas.
 * `crop` is {fx, fy, zoom} — focus point (0..1) and zoom (>= 1).
 * The grade runs at most ~760 px wide and is upscaled when drawn,
 * which keeps the pixel loops fast with no visible loss at post sizes.
 */
export function gradePanelImage(shot, pw, ph, crop, gradeName) {
  const cv = document.createElement("canvas");
  const cw = Math.round(pw);
  const ch = Math.round(ph);
  cv.width = Math.max(2, cw);
  cv.height = Math.max(2, ch);
  const pen = cv.getContext("2d");
  drawCroppedPhoto(pen, shot, 0, 0, pw, ph, crop);
  const frame = pen.getImageData(0, 0, cv.width, cv.height);
  if (gradeName === "golden") {
    applyGradientGrade(frame, "golden", 0.58);
  } else if (gradeName === "neon") {
    saturateImageData(frame, 1.3);
    applyGradientGrade(frame, "neon", 0.6);
  } else if (gradeName === "ink") {
    saturateImageData(frame, 1.2);
    applyGradientGrade(frame, "ink", 0.42);
    warmSkinTones(frame, 0.8);
    posterizeImageData(frame, 6);
  } else {
    // Sunset (the default) stays photographic — never a gradient map.
    // A map swaps each pixel's hue for a brightness-derived tint (its
    // LUT keys on brightness alone), so at any strength it turns the
    // pink car cream and the sea grey. A saturation lift plus warm
    // mids keeps each photo's own colour and gives the warm sunset
    // feel the top covers have. The highlight lift is what makes
    // skies glow orange like #1's instead of staying pale — it only
    // touches the bright end, so mid-tone skin is untouched.
    saturateImageData(frame, 1.18);
    warmSkinTones(frame, 0.6);
    warmHighlights(frame, 0.55);
  }
  pen.putImageData(frame, 0, 0);
  if (gradeName === "ink") {
    applyHalftone(pen, cv.width, cv.height, 0.12);
  }
  let dust = 0.06;
  if (gradeName === "ink") {
    dust = 0.09;
  }
  applyGrain(pen, cv.width, cv.height, dust);
  let shade = 0.18;
  if (gradeName === "ink") {
    shade = 0.3;
  }
  applyVignette(pen, cv.width, cv.height, shade);
  return cv;
}

/**
 * Cover-fits `shot` into the rect (dx, dy, tw, th) on `pen`,
 * panning toward the focus point and zooming in. Empty space
 * never shows in the crop.
 */
export function drawCroppedPhoto(pen, shot, dx, dy, tw, th, crop = {}) {
  const sw = shot.naturalWidth || shot.width;
  const sh = shot.naturalHeight || shot.height;
  const fx0 = crop.fx ?? 0.5;
  const fy0 = crop.fy ?? 0.4;
  let zoom = crop.zoom ?? 1;
  zoom = Math.max(1, zoom);
  const scale = zoom * Math.max(tw / sw, th / sh);
  const srcW = tw / scale;
  const srcH = th / scale;
  const srcX = clampNum(sw * fx0 - srcW / 2, 0, sw - srcW);
  const srcY = clampNum(sh * fy0 - srcH / 2, 0, sh - srcH);
  pen.drawImage(shot, srcX, srcY, srcW, srcH, dx, dy, tw, th);
}
