// grades.js — the colour grades painted onto each cover panel.
//
// A grade is a gradient map: a pixel's brightness picks a colour out
// of the grade's palette, and that colour is blended back toward the
// pixel it came from, so a photo keeps its own identity instead of
// going flat. Poster Ink adds a comic-book pass on top of that: a few
// flat posterised levels, halftone dots, film grain, and a vignette.
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

function clampByte(v) {
  return Math.min(255, Math.max(0, v));
}

// Palette stops per grade, as {at, r, g, b} stops the lookup reads.
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
  // Warm mids on purpose: coral-orange at 0.55 rather than magenta-pink,
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
  const ramp = GRADE_PALETTES[grade] ?? GRADE_PALETTES.sunset;
  const luts = { r: new Uint8Array(256), g: new Uint8Array(256), b: new Uint8Array(256) };
  for (let n = 0; n < 256; n += 1) {
    const t = n / 255;
    let lo = ramp[0];
    let hi = ramp[ramp.length - 1];
    for (let i = 0; i + 1 < ramp.length; i += 1) {
      if (t >= ramp[i].at && t <= ramp[i + 1].at) {
        lo = ramp[i];
        hi = ramp[i + 1];
        break;
      }
    }
    const span = hi.at - lo.at;
    const mix = span === 0 ? 0 : (t - lo.at) / span;
    for (const channel of ["r", "g", "b"]) {
      const mapped = lo[channel] + (hi[channel] - lo[channel]) * mix;
      luts[channel][n] = Math.round(n + (mapped - n) * strength);
    }
  }
  return luts;
}

/** Pushes every pixel through the grade LUT, keyed by brightness. */
export function applyGradientGrade(frame, grade, strength) {
  const lut = buildGradeLUT(grade, strength);
  const buf = frame.data;
  let i = 0;
  while (i < buf.length) {
    const lum = (0.299 * buf[i] + 0.587 * buf[i + 1] + 0.114 * buf[i + 2]) | 0;
    buf[i] = lut.r[lum];
    buf[i + 1] = lut.g[lum];
    buf[i + 2] = lut.b[lum];
    i += 4;
  }
  return frame;
}

/**
 * Warms the skin band: pixels whose brightness sits in the middle range
 * get a red lift and a blue cut, fading to nothing at the band edges.
 * This runs before posterising so the poster-ink grade keeps faces warm
 * rather than pushing them toward violet. `amount` 0..1; 0.5 is gentle.
 */
export function warmSkinTones(frame, amount = 0.5) {
  const buf = frame.data;
  const redLift = amount * 14;
  const blueCut = amount * 12;
  for (let i = 0; i < buf.length; i += 4) {
    const lum = 0.299 * buf[i] + 0.587 * buf[i + 1] + 0.114 * buf[i + 2];
    if (lum < 70 || lum > 215) {
      continue;
    }
    // Triangle weight: full effect near brightness 140, none at the edges.
    const wgt = lum < 140 ? (lum - 70) / 70 : (215 - lum) / 75;
    buf[i] = clampByte(redLift * wgt + buf[i]);
    buf[i + 2] = clampByte(buf[i + 2] - wgt * blueCut);
  }
  return frame;
}

/**
 * Warms the bright end: pixels brighter than `cutoff` get a red/orange
 * lift that grows with brightness, so skies and highlights glow sunset
 * instead of staying pale blue-white. Only the sunset grade uses it.
 */
export function warmHighlights(img, amount = 0.5, cutoff = 175) {
  const d = img.data;
  for (let i = 0; i < d.length; i += 4) {
    const lum = 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2];
    if (lum <= cutoff) {
      continue;
    }
    const wgt = ((lum - cutoff) / (255 - cutoff)) * amount;
    d[i] = clampByte(d[i] + wgt * 26);
    d[i + 1] = clampByte(d[i + 1] + wgt * 8);
    d[i + 2] = clampByte(d[i + 2] - wgt * 14);
  }
  return img;
}

/** Flattens each channel to `levels` even steps — the comic-ink feel. */
export function posterizeImageData(frame, levels = 5) {
  const d = frame.data;
  const step = 255 / (levels - 1);
  for (let i = 0; i < d.length; i += 4) {
    for (let c = 0; c <= 2; c += 1) {
      const stepped = Math.round(d[i + c] / step) * step;
      d[i + c] = Math.round(stepped);
    }
  }
  return frame;
}

/** Pushes colours away from grey in place (1 leaves them unchanged). */
export function saturateImageData(frame, boost = 1.25) {
  const buf = frame.data;
  for (let i = 0; i < buf.length; i += 4) {
    const lum = 0.299 * buf[i] + 0.587 * buf[i + 1] + 0.114 * buf[i + 2];
    for (let c = 0; c <= 2; c += 1) {
      buf[i + c] = clampByte((buf[i + c] - lum) * boost + lum);
    }
  }
  return frame;
}

let halftoneTile = null;
/** A reusable tile of print dots, denser toward one corner of a cell. */
export function makeHalftonePattern(size = 96) {
  if (halftoneTile === null) {
    const sheet = document.createElement("canvas");
    sheet.width = size;
    sheet.height = size;
    const gc = sheet.getContext("2d");
    const grid = 12;
    for (let r = 0; r < size / grid; r += 1) {
      for (let c = 0; c < size / grid; c += 1) {
        const dot = 1 + ((r + c) % 4) * 1.1;
        gc.fillStyle = "rgba(20,4,32,0.55)";
        gc.beginPath();
        gc.arc(grid * c + 0.5 * grid, grid * r + 0.5 * grid, dot, 0, 2 * Math.PI);
        gc.fill();
      }
    }
    halftoneTile = sheet;
  }
  return halftoneTile;
}

/** Lays halftone dots over a panel at low opacity. */
export function applyHalftone(ctx, w, h, alpha = 0.16) {
  const dots = ctx.createPattern(makeHalftonePattern(), "repeat");
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.fillStyle = dots;
  ctx.fillRect(0, 0, w, h);
  ctx.restore();
}

let grainTile = null;
/** A reusable tile of neutral film grain, built once. */
export function makeGrainCanvas(size = 160) {
  if (grainTile === null) {
    const sheet = document.createElement("canvas");
    sheet.width = size;
    sheet.height = size;
    const gc = sheet.getContext("2d");
    const img = gc.createImageData(size, size);
    for (let i = 0; i < img.data.length; i += 4) {
      const v = Math.floor(Math.random() * 40) + 98;
      img.data[i] = v;
      img.data[i + 1] = v;
      img.data[i + 2] = v;
      img.data[i + 3] = 255;
    }
    gc.putImageData(img, 0, 0);
    grainTile = sheet;
  }
  return grainTile;
}

/** Dusts film grain over a panel with an overlay blend. */
export function applyGrain(ctx, w, h, alpha = 0.07) {
  const dots = ctx.createPattern(makeGrainCanvas(), "repeat");
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.globalCompositeOperation = "overlay";
  ctx.fillStyle = dots;
  ctx.fillRect(0, 0, w, h);
  ctx.restore();
}

/** Darkens a panel's corners so it reads like a printed poster. */
export function applyVignette(ctx, w, h, strength = 0.28) {
  const shade = ctx.createRadialGradient(
    w * 0.5, h * 0.5, Math.min(w, h) * 0.32,
    w * 0.5, h * 0.5, Math.max(w, h) * 0.72,
  );
  shade.addColorStop(0, "rgba(10,2,20,0)");
  shade.addColorStop(1, "rgba(10,2,20," + strength + ")");
  ctx.save();
  ctx.fillStyle = shade;
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
  const out = document.createElement("canvas");
  const gw = Math.round(panelW);
  const gh = Math.round(panelH);
  out.width = Math.max(gw, 2);
  out.height = Math.max(gh, 2);
  const gc = out.getContext("2d");
  drawCroppedPhoto(gc, img, 0, 0, panelW, panelH, cropSpec);
  const frame = gc.getImageData(0, 0, out.width, out.height);
  switch (grade) {
    case "neon":
      saturateImageData(frame, 13 / 10);
      applyGradientGrade(frame, "neon", 6 / 10);
      break;
    case "golden":
      applyGradientGrade(frame, "golden", 58 / 100);
      break;
    case "ink":
      saturateImageData(frame, 12 / 10);
      applyGradientGrade(frame, "ink", 42 / 100);
      warmSkinTones(frame, 8 / 10);
      posterizeImageData(frame, 6);
      break;
    default:
      // Sunset (the default): photographic, NOT a gradient map. The map
      // swaps every pixel's hue for a brightness-derived tint (its LUT is
      // keyed on brightness alone), so at any strength it turns the pink
      // car cream and the sea grey. A saturation lift plus warm mids keeps
      // each photo's own colour and gives the warm sunset feel the top
      // covers have. The highlight lift is what makes skies glow orange
      // like #1's instead of staying pale — it only touches the bright
      // end, so mid-tone skin is untouched.
      saturateImageData(frame, 118 / 100);
      warmSkinTones(frame, 6 / 10);
      warmHighlights(frame, 55 / 100);
      break;
  }
  gc.putImageData(frame, 0, 0);
  if (grade === "ink") {
    applyHalftone(gc, out.width, out.height, 12 / 100);
  }
  const grainAmt = grade === "ink" ? 9 / 100 : 6 / 100;
  applyGrain(gc, out.width, out.height, grainAmt);
  const vigAmt = grade === "ink" ? 3 / 10 : 18 / 100;
  applyVignette(gc, out.width, out.height, vigAmt);
  return out;
}

/**
 * Cover-fits `img` into the rect (destX, destY, w, h) on `ctx`, panning
 * toward the focus point and zooming in. The crop never shows empty
 * space.
 */
export function drawCroppedPhoto(ctx, img, destX, destY, w, h, cropSpec = {}) {
  const srcW = img.naturalWidth || img.width;
  const srcH = img.naturalHeight || img.height;
  const fx = cropSpec.fx ?? 0.5;
  const fy = cropSpec.fy ?? 0.4;
  let zoom = cropSpec.zoom ?? 1;
  zoom = Math.max(1, zoom);
  const scale = Math.max(w / srcW, h / srcH) * zoom;
  const sw = w / scale;
  const sh = h / scale;
  const ox = Math.max(0, Math.min(srcW - sw, fx * srcW - sw * 0.5));
  const oy = Math.max(0, Math.min(srcH - sh, fy * srcH - sh * 0.5));
  ctx.drawImage(img, ox, oy, sw, sh, destX, destY, w, h);
}
