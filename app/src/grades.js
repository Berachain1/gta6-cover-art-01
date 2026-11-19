// grades.js — the colour grades painted onto cover panels.
//
// A grade is a gradient map: a pixel's brightness selects a colour from
// the grade's palette, and that colour is blended back toward the pixel
// it came from, so a photo keeps its own identity instead of going flat.
// Poster Ink layers a comic-book pass on top: a few flat posterised
// levels, halftone dots, film grain, and a vignette. Everything runs on
// plain 2D canvas pixels, so it works on any photo — samples, phone
// shots, anything — with no network and no library.
//
// The ink palette stays warm in the mid-tones deliberately. Skin lives
// in the middle of the brightness range, and a magenta-heavy map turns
// faces purple; the ink stops below push mids toward coral-orange
// instead, and warmSkinTones() adds a small red lift and blue cut in
// that same band before posterising, so faces stay warm while shadows
// keep their violet depth.

function clampByte(n) {
  if (n > 255) {
    return 255;
  }
  if (n < 0) {
    return 0;
  }
  return n;
}

// Palette stops per grade. Each stop names its brightness position
// (`at`, 0..1) and its colour channels, so the lookup below reads
// `stop.at` / `stop.r` / `stop.g` / `stop.b` instead of indices.
export const GRADE_PALETTES = {
  sunset: [
    { at: 0.0, r: 26, g: 8, b: 46 },
    { at: 0.28, r: 100, g: 40, b: 70 },
    { at: 0.55, r: 220, g: 130, b: 80 },
    { at: 0.78, r: 250, g: 160, b: 90 },
    { at: 1.0, r: 255, g: 210, b: 63 },
  ],
  neon: [
    { at: 0.0, r: 10, g: 8, b: 48 },
    { at: 0.3, r: 74, g: 20, b: 120 },
    { at: 0.55, r: 168, g: 38, b: 150 },
    { at: 0.78, r: 255, g: 64, b: 160 },
    { at: 1.0, r: 64, g: 224, b: 208 },
  ],
  golden: [
    { at: 0.0, r: 40, g: 20, b: 8 },
    { at: 0.3, r: 122, g: 62, b: 18 },
    { at: 0.55, r: 214, g: 122, b: 32 },
    { at: 0.8, r: 255, g: 176, b: 64 },
    { at: 1.0, r: 255, g: 236, b: 160 },
  ],
  // Warm mids by design: coral-orange at 0.55 rather than magenta-pink,
  // so skin in the poster-ink pass reads sun-warmed instead of purple.
  ink: [
    { at: 0.0, r: 22, g: 6, b: 38 },
    { at: 0.3, r: 132, g: 38, b: 62 },
    { at: 0.55, r: 224, g: 72, b: 84 },
    { at: 0.78, r: 255, g: 138, b: 58 },
    { at: 1.0, r: 255, g: 214, b: 92 },
  ],
};

/**
 * One lookup table per channel for `grade`. `strength` 0..1 sets how far
 * the mapped colour replaces the original pixel (1 = full gradient map).
 */
export function buildGradeLUT(grade, strength = 0.62) {
  const palette = GRADE_PALETTES[grade] === undefined ? GRADE_PALETTES.sunset : GRADE_PALETTES[grade];
  const lut = { r: new Uint8Array(256), g: new Uint8Array(256), b: new Uint8Array(256) };
  for (let idx = 0; idx < 256; idx += 1) {
    const pos = idx / 255;
    let lo = palette[0];
    let hi = palette[palette.length - 1];
    for (let s = 0; s + 1 < palette.length; s += 1) {
      if (pos >= palette[s].at && pos <= palette[s + 1].at) {
        lo = palette[s];
        hi = palette[s + 1];
        break;
      }
    }
    const range = hi.at - lo.at;
    let frac = 0;
    if (range !== 0) {
      frac = (pos - lo.at) / range;
    }
    const mix = (channel) => {
      const mapped = (hi[channel] - lo[channel]) * frac + lo[channel];
      return Math.round(idx + (mapped - idx) * strength);
    };
    lut.r[idx] = mix("r");
    lut.g[idx] = mix("g");
    lut.b[idx] = mix("b");
  }
  return lut;
}

/** Pushes every pixel through the grade LUT, keyed by brightness. */
export function applyGradientGrade(imageData, grade, strength) {
  const lut = buildGradeLUT(grade, strength);
  const data = imageData.data;
  let i = 0;
  while (i < data.length) {
    const bright = (0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2]) | 0;
    data[i] = lut.r[bright];
    data[i + 1] = lut.g[bright];
    data[i + 2] = lut.b[bright];
    i += 4;
  }
  return imageData;
}

/**
 * Warms the skin band: pixels whose brightness sits in the middle range
 * get a red lift and a blue cut, fading to nothing at the band edges.
 * This runs before posterising so the poster-ink grade keeps faces warm
 * rather than pushing them toward violet. `amount` 0..1; 0.5 is gentle.
 */
export function warmSkinTones(imageData, amount = 0.5) {
  const data = imageData.data;
  const redLift = 14 * amount;
  const blueCut = 12 * amount;
  let i = 0;
  while (i < data.length) {
    const bright = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
    if (bright >= 70 && bright <= 215) {
      // Triangle weight: full effect near brightness 140, none at the edges.
      const weight = bright < 140 ? (bright - 70) / 70 : (215 - bright) / 75;
      data[i] = clampByte(data[i] + redLift * weight);
      data[i + 2] = clampByte(data[i + 2] - weight * blueCut);
    }
    i += 4;
  }
  return imageData;
}

/**
 * Warms the bright end: pixels brighter than `cutoff` get a red/orange
 * lift that grows with brightness, so skies and highlights glow sunset
 * instead of staying pale blue-white. Only the sunset grade uses it.
 */
export function warmHighlights(imageData, amount = 0.5, cutoff = 175) {
  const data = imageData.data;
  let i = 0;
  while (i < data.length) {
    const bright = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
    if (bright > cutoff) {
      const weight = amount * ((bright - cutoff) / (255 - cutoff));
      data[i] = clampByte(data[i] + weight * 26);
      data[i + 1] = clampByte(data[i + 1] + weight * 8);
      data[i + 2] = clampByte(data[i + 2] - weight * 14);
    }
    i += 4;
  }
  return imageData;
}

/** Flattens each channel to `levels` even steps — the comic-ink feel. */
export function posterizeImageData(imageData, levels = 5) {
  const data = imageData.data;
  const step = 255 / (levels - 1);
  let i = 0;
  while (i < data.length) {
    for (let c = 0; c < 3; c += 1) {
      const stepped = Math.round(data[i + c] / step) * step;
      data[i + c] = Math.round(stepped);
    }
    i += 4;
  }
  return imageData;
}

/** Pushes colours away from grey in place (1 leaves them unchanged). */
export function saturateImageData(imageData, boost = 1.25) {
  const data = imageData.data;
  let i = 0;
  while (i < data.length) {
    const bright = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
    for (let c = 0; c < 3; c += 1) {
      data[i + c] = clampByte((data[i + c] - bright) * boost + bright);
    }
    i += 4;
  }
  return imageData;
}

let halftoneTile = null;
/** A reusable tile of print dots, denser toward one corner of a cell. */
export function makeHalftonePattern(size = 96) {
  if (halftoneTile !== null) {
    return halftoneTile;
  }
  const tileCanvas = document.createElement("canvas");
  tileCanvas.width = size;
  tileCanvas.height = size;
  const tctx = tileCanvas.getContext("2d");
  const cellPx = 12;
  let row = 0;
  while (row < size / cellPx) {
    let col = 0;
    while (col < size / cellPx) {
      const dotR = 1 + 1.1 * ((col + row) % 4);
      tctx.fillStyle = "rgba(20,4,32,0.55)";
      tctx.beginPath();
      tctx.arc(cellPx * col + 0.5 * cellPx, cellPx * row + 0.5 * cellPx, dotR, 0, 2 * Math.PI);
      tctx.fill();
      col += 1;
    }
    row += 1;
  }
  halftoneTile = tileCanvas;
  return tileCanvas;
}

/** Lays halftone dots over a panel at low opacity. */
export function applyHalftone(ctx, w, h, alpha = 0.16) {
  const pat = ctx.createPattern(makeHalftonePattern(), "repeat");
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.fillStyle = pat;
  ctx.fillRect(0, 0, w, h);
  ctx.restore();
}

let grainTile = null;
/** A reusable tile of neutral film grain, built once. */
export function makeGrainCanvas(size = 160) {
  if (grainTile !== null) {
    return grainTile;
  }
  const tileCanvas = document.createElement("canvas");
  tileCanvas.width = size;
  tileCanvas.height = size;
  const tctx = tileCanvas.getContext("2d");
  const img = tctx.createImageData(size, size);
  let i = 0;
  while (i < img.data.length) {
    const v = Math.floor(Math.random() * 40) + 98;
    img.data[i] = v;
    img.data[i + 1] = v;
    img.data[i + 2] = v;
    img.data[i + 3] = 255;
    i += 4;
  }
  tctx.putImageData(img, 0, 0);
  grainTile = tileCanvas;
  return tileCanvas;
}

/** Dusts film grain over a panel with an overlay blend. */
export function applyGrain(ctx, w, h, alpha = 0.07) {
  const pat = ctx.createPattern(makeGrainCanvas(), "repeat");
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.globalCompositeOperation = "overlay";
  ctx.fillStyle = pat;
  ctx.fillRect(0, 0, w, h);
  ctx.restore();
}

/** Darkens a panel's corners so it reads like a printed poster. */
export function applyVignette(ctx, w, h, strength = 0.28) {
  const grad = ctx.createRadialGradient(
    w * 0.5, h * 0.5, Math.min(w, h) * 0.32,
    w * 0.5, h * 0.5, Math.max(w, h) * 0.72,
  );
  grad.addColorStop(0, "rgba(10,2,20,0)");
  grad.addColorStop(1, "rgba(10,2,20," + strength + ")");
  ctx.save();
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, w, h);
  ctx.restore();
}

/**
 * Grades one photo panel and returns the graded canvas. `cropSpec` is
 * {fx, fy, zoom} — the focus point (0..1) and zoom (>= 1). The grade
 * runs at most ~760 px wide and is upscaled on draw, which keeps the
 * pixel loops fast without visible loss at post sizes.
 */
export function gradePanelImage(img, panelW, panelH, cropSpec, grade) {
  const canvas = document.createElement("canvas");
  const cw = Math.round(panelW);
  const ch = Math.round(panelH);
  canvas.width = cw < 2 ? 2 : cw;
  canvas.height = ch < 2 ? 2 : ch;
  const pctx = canvas.getContext("2d");
  drawCroppedPhoto(pctx, img, 0, 0, panelW, panelH, cropSpec);
  const pixels = pctx.getImageData(0, 0, canvas.width, canvas.height);
  if (grade === "ink") {
    saturateImageData(pixels, 1.2);
    applyGradientGrade(pixels, "ink", 0.42);
    warmSkinTones(pixels, 0.8);
    posterizeImageData(pixels, 6);
  } else if (grade === "neon") {
    saturateImageData(pixels, 1.3);
    applyGradientGrade(pixels, "neon", 0.6);
  } else if (grade === "golden") {
    applyGradientGrade(pixels, "golden", 0.58);
  } else {
    // Sunset (the default): photographic, NOT a gradient map. The map
    // swaps every pixel's hue for a brightness-derived tint (its LUT is
    // keyed on brightness alone), so at any strength it turns the pink
    // car cream and the sea grey. A saturation lift plus warm mids keeps
    // each photo's own colour and gives the warm sunset feel the top
    // covers have. The highlight lift is what makes skies glow orange
    // like #1's instead of staying pale — it only touches the bright
    // end, so mid-tone skin is untouched.
    saturateImageData(pixels, 1.18);
    warmSkinTones(pixels, 0.6);
    warmHighlights(pixels, 0.55);
  }
  pctx.putImageData(pixels, 0, 0);
  if (grade === "ink") {
    applyHalftone(pctx, canvas.width, canvas.height, 0.12);
  }
  const grainAlpha = grade !== "ink" ? 0.06 : 0.09;
  applyGrain(pctx, canvas.width, canvas.height, grainAlpha);
  const vigStrength = grade !== "ink" ? 0.18 : 0.3;
  applyVignette(pctx, canvas.width, canvas.height, vigStrength);
  return canvas;
}

/**
 * Cover-fits `img` into the rect (destX, destY, w, h) on `ctx`, panning
 * toward the focus point and zooming in. The crop never shows empty
 * space.
 */
export function drawCroppedPhoto(ctx, img, destX, destY, w, h, cropSpec = {}) {
  const imgW = img.naturalWidth || img.width;
  const imgH = img.naturalHeight || img.height;
  const focusX = cropSpec.fx === undefined ? 0.5 : cropSpec.fx;
  const focusY = cropSpec.fy === undefined ? 0.4 : cropSpec.fy;
  const zoomFactor = Math.max(1, cropSpec.zoom === undefined ? 1 : cropSpec.zoom);
  const base = zoomFactor * Math.max(w / imgW, h / imgH);
  const srcW = w / base;
  const srcH = h / base;
  const sx = Math.max(0, Math.min(focusX * imgW - srcW * 0.5, imgW - srcW));
  const sy = Math.max(0, Math.min(focusY * imgH - srcH * 0.5, imgH - srcH));
  ctx.drawImage(img, sx, sy, srcW, srcH, destX, destY, w, h);
}
