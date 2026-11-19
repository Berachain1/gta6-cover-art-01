// grades.js — colour grades for the cover panels.
//
// Every grade is a gradient map: a pixel's luminance picks a colour on the
// grade's palette, then the mapped colour is blended back toward the original
// pixel so photos keep their identity instead of turning into flat colour.
// Poster Ink adds a comic-book pass on top: a few flat posterised levels,
// halftone dots, film grain and a vignette. Everything runs on plain 2D
// canvas pixels, so it works on any photo — samples, phone shots, anything —
// with no network and no library.
//
// The ink palette is deliberately warm in the mid-tones. Skin lives in the
// middle of the luminance range, and a magenta-heavy map turns faces purple;
// the ink stops below push mids toward coral-orange instead, and
// warmSkinTones() adds a small red lift / blue cut in the same band before
// posterising, so faces stay warm while shadows keep their violet depth.

/** Palette stops per grade: [luminance 0..1, red, green, blue]. */
export const GRADE_PALETTES = {
  sunset: [
    [0.0, 26, 8, 46],
    [0.28, 100, 40, 70],
    [0.55, 220, 130, 80],
    [0.78, 250, 160, 90],
    [1.0, 255, 210, 63],
  ],
  neon: [
    [0.0, 10, 8, 48],
    [0.3, 74, 20, 120],
    [0.55, 168, 38, 150],
    [0.78, 255, 64, 160],
    [1.0, 64, 224, 208],
  ],
  golden: [
    [0.0, 40, 20, 8],
    [0.3, 122, 62, 18],
    [0.55, 214, 122, 32],
    [0.8, 255, 176, 64],
    [1.0, 255, 236, 160],
  ],
  // Warm mids on purpose: coral-orange at 0.55 instead of magenta-pink,
  // so skin in the poster-ink pass reads sun-warmed, not purple.
  ink: [
    [0.0, 22, 6, 38],
    [0.3, 132, 38, 62],
    [0.55, 224, 72, 84],
    [0.78, 255, 138, 58],
    [1.0, 255, 214, 92],
  ],
};

/**
 * One lookup table per channel for `grade`. `strength` 0..1 is how far the
 * mapped colour replaces the original pixel (1 = full gradient map).
 */
export function buildGradeLUT(grade, strength = 0.62) {
  const stops = GRADE_PALETTES[grade] || GRADE_PALETTES.sunset;
  const lut = {
    r: new Uint8Array(256),
    g: new Uint8Array(256),
    b: new Uint8Array(256),
  };
  for (let i = 0; i < 256; i++) {
    const t = i / 255;
    let lo = stops[0];
    let hi = stops[stops.length - 1];
    for (let s = 0; s < stops.length - 1; s++) {
      if (t >= stops[s][0] && t <= stops[s + 1][0]) {
        lo = stops[s];
        hi = stops[s + 1];
        break;
      }
    }
    const f = hi[0] === lo[0] ? 0 : (t - lo[0]) / (hi[0] - lo[0]);
    const mix = (channel) => {
      const mapped = lo[channel] + (hi[channel] - lo[channel]) * f;
      return Math.round(i + (mapped - i) * strength);
    };
    lut.r[i] = mix(1);
    lut.g[i] = mix(2);
    lut.b[i] = mix(3);
  }
  return lut;
}

/** Remaps every pixel through the grade LUT, keyed by luminance. */
export function applyGradientGrade(imageData, grade, strength) {
  const lut = buildGradeLUT(grade, strength);
  const d = imageData.data;
  for (let i = 0; i < d.length; i += 4) {
    const lum = (0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2]) | 0;
    d[i] = lut.r[lum];
    d[i + 1] = lut.g[lum];
    d[i + 2] = lut.b[lum];
  }
  return imageData;
}

/**
 * Warms the skin band: pixels whose luminance sits in the middle range get
 * a red lift and a blue cut, fading to nothing at the band edges. This runs
 * before posterising so the poster-ink grade keeps faces warm instead of
 * pushing them toward violet. `amount` 0..1, 0.5 is a gentle nudge.
 */
export function warmSkinTones(imageData, amount = 0.5) {
  const d = imageData.data;
  const lift = 14 * amount;
  const cut = 12 * amount;
  for (let i = 0; i < d.length; i += 4) {
    const lum = 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2];
    if (lum < 70 || lum > 215) continue;
    // Triangular weight: full effect around lum 140, zero at the edges.
    const w = lum < 140 ? (lum - 70) / 70 : (215 - lum) / 75;
    d[i] = Math.max(0, Math.min(255, d[i] + lift * w));
    d[i + 2] = Math.max(0, Math.min(255, d[i + 2] - cut * w));
  }
  return imageData;
}

/**
 * Warms the bright end: pixels brighter than `floor` get a red/orange
 * lift fading in with luminance, so skies and highlights glow sunset
 * instead of staying pale blue-white. Runs only in the Sunset grade.
 */
export function warmHighlights(imageData, amount = 0.5, floor = 175) {
  const d = imageData.data;
  for (let i = 0; i < d.length; i += 4) {
    const lum = 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2];
    if (lum <= floor) continue;
    const w = ((lum - floor) / (255 - floor)) * amount;
    d[i] = Math.max(0, Math.min(255, d[i] + 26 * w));
    d[i + 1] = Math.max(0, Math.min(255, d[i + 1] + 8 * w));
    d[i + 2] = Math.max(0, Math.min(255, d[i + 2] - 14 * w));
  }
  return imageData;
}

/** Quantises each channel to `levels` flat steps — the comic-ink look. */
export function posterizeImageData(imageData, levels = 5) {
  const d = imageData.data;
  const step = 255 / (levels - 1);
  for (let i = 0; i < d.length; i += 4) {
    d[i] = Math.round(Math.round(d[i] / step) * step);
    d[i + 1] = Math.round(Math.round(d[i + 1] / step) * step);
    d[i + 2] = Math.round(Math.round(d[i + 2] / step) * step);
  }
  return imageData;
}

/** Pushes colours away from grey in place (1 = unchanged). */
export function saturateImageData(imageData, factor = 1.25) {
  const d = imageData.data;
  for (let i = 0; i < d.length; i += 4) {
    const lum = 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2];
    for (let c = 0; c < 3; c++) {
      const v = lum + (d[i + c] - lum) * factor;
      d[i + c] = v < 0 ? 0 : v > 255 ? 255 : v;
    }
  }
  return imageData;
}

let halftoneTile = null;
/** A reusable tile of print dots, denser toward one corner of each cell. */
export function makeHalftonePattern(tile = 96) {
  if (halftoneTile) return halftoneTile;
  const c = document.createElement('canvas');
  c.width = tile;
  c.height = tile;
  const x = c.getContext('2d');
  const cell = 12;
  for (let gy = 0; gy < tile / cell; gy++) {
    for (let gx = 0; gx < tile / cell; gx++) {
      const r = 1 + ((gx + gy) % 4) * 1.1;
      x.fillStyle = 'rgba(20,4,32,0.55)';
      x.beginPath();
      x.arc(gx * cell + cell / 2, gy * cell + cell / 2, r, 0, Math.PI * 2);
      x.fill();
    }
  }
  halftoneTile = c;
  return c;
}

/** Prints halftone dots over a panel at low opacity. */
export function applyHalftone(ctx, w, h, alpha = 0.16) {
  const pat = ctx.createPattern(makeHalftonePattern(), 'repeat');
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.fillStyle = pat;
  ctx.fillRect(0, 0, w, h);
  ctx.restore();
}

let grainTile = null;
/** A reusable tile of neutral film grain, drawn once. */
export function makeGrainCanvas(tile = 160) {
  if (grainTile) return grainTile;
  const c = document.createElement('canvas');
  c.width = tile;
  c.height = tile;
  const x = c.getContext('2d');
  const img = x.createImageData(tile, tile);
  for (let i = 0; i < img.data.length; i += 4) {
    const v = 118 + Math.floor(Math.random() * 40) - 20;
    img.data[i] = v;
    img.data[i + 1] = v;
    img.data[i + 2] = v;
    img.data[i + 3] = 255;
  }
  x.putImageData(img, 0, 0);
  grainTile = c;
  return c;
}

/** Dusts film grain over a panel using an overlay blend. */
export function applyGrain(ctx, w, h, alpha = 0.07) {
  const pat = ctx.createPattern(makeGrainCanvas(), 'repeat');
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.globalCompositeOperation = 'overlay';
  ctx.fillStyle = pat;
  ctx.fillRect(0, 0, w, h);
  ctx.restore();
}

/** Darkens a panel's corners so it reads as a printed poster. */
export function applyVignette(ctx, w, h, strength = 0.28) {
  const g = ctx.createRadialGradient(
    w / 2, h / 2, Math.min(w, h) * 0.32,
    w / 2, h / 2, Math.max(w, h) * 0.72,
  );
  g.addColorStop(0, 'rgba(10,2,20,0)');
  g.addColorStop(1, `rgba(10,2,20,${strength})`);
  ctx.save();
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
  ctx.restore();
}

/**
 * Grades one photo panel and returns the graded canvas. `crop` is
 * {fx, fy, zoom} — the focus point (0..1) and zoom (>= 1). The grade runs at
 * most ~760 px wide and is upscaled on draw, which keeps the pixel loops
 * fast without visible loss at post sizes.
 */
export function gradePanelImage(img, pw, ph, crop, grade) {
  const c = document.createElement('canvas');
  c.width = Math.max(2, Math.round(pw));
  c.height = Math.max(2, Math.round(ph));
  const x = c.getContext('2d');
  drawCroppedPhoto(x, img, 0, 0, pw, ph, crop);
  const data = x.getImageData(0, 0, c.width, c.height);
  if (grade === 'ink') {
    saturateImageData(data, 1.2);
    applyGradientGrade(data, 'ink', 0.42);
    warmSkinTones(data, 0.8);
    posterizeImageData(data, 6);
  } else if (grade === 'neon') {
    saturateImageData(data, 1.3);
    applyGradientGrade(data, 'neon', 0.6);
  } else if (grade === 'golden') {
    applyGradientGrade(data, 'golden', 0.58);
  } else {
    // Sunset (default): photographic, NOT a gradient map. The map
    // replaces every pixel's hue with a luminance-derived tint (its LUT
    // is keyed on luminance alone), so at any strength it turns the
    // pink car cream and the sea grey. A saturation lift + warm mids
    // keeps each photo's own colour and gives the warm sunset feel the
    // top covers have. The highlight lift is what makes skies glow
    // orange like #1's instead of staying pale — it only touches the
    // bright end, so mid-tone skin is unaffected.
    saturateImageData(data, 1.18);
    warmSkinTones(data, 0.6);
    warmHighlights(data, 0.55);
  }
  x.putImageData(data, 0, 0);
  if (grade === 'ink') applyHalftone(x, c.width, c.height, 0.12);
  applyGrain(x, c.width, c.height, grade === 'ink' ? 0.09 : 0.06);
  applyVignette(x, c.width, c.height, grade === 'ink' ? 0.3 : 0.18);
  return c;
}

/**
 * Draws `img` to cover-fit the rect (x, y, w, h) on `ctx`, panning toward
 * the focus point and zooming in. The crop never shows empty space.
 */
export function drawCroppedPhoto(ctx, img, x, y, w, h, crop = {}) {
  const iw = img.naturalWidth || img.width;
  const ih = img.naturalHeight || img.height;
  const fx = crop.fx ?? 0.5;
  const fy = crop.fy ?? 0.4;
  const zoom = Math.max(1, crop.zoom ?? 1);
  const base = Math.max(w / iw, h / ih) * zoom;
  const sw = w / base;
  const sh = h / base;
  const sx = Math.max(0, Math.min(iw - sw, fx * iw - sw / 2));
  const sy = Math.max(0, Math.min(ih - sh, fy * ih - sh / 2));
  ctx.drawImage(img, sx, sy, sw, sh, x, y, w, h);
}
