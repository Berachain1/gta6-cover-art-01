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
  if (v > 255) {
    return 255;
  }
  if (v < 0) {
    return 0;
  }
  return v;
}

// Palette stops per grade, as [brightness, r, g, b] rows; the builder
// below turns each row into the {at, r, g, b} stop the lookup reads.
const PALETTE_ROWS = {
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
  // Warm mids on purpose: coral-orange at 0.55 rather than magenta-pink,
  // so skin in the poster-ink pass reads sun-warmed instead of purple.
  ink: [
    [0.0, 22, 6, 38],
    [0.3, 132, 38, 62],
    [0.55, 224, 72, 84],
    [0.78, 255, 138, 58],
    [1.0, 255, 214, 92],
  ],
};

function toStop(row) {
  return { at: row[0], r: row[1], g: row[2], b: row[3] };
}

export const GRADE_PALETTES = {
  sunset: PALETTE_ROWS.sunset.map(toStop),
  neon: PALETTE_ROWS.neon.map(toStop),
  golden: PALETTE_ROWS.golden.map(toStop),
  ink: PALETTE_ROWS.ink.map(toStop),
};

/**
 * One lookup table per channel for `grade`. `strength` 0..1 sets how far
 * the mapped colour replaces the original pixel (1 = full gradient map).
 */
export function buildGradeLUT(grade, strength = 0.62) {
  let ramp = GRADE_PALETTES[grade];
  if (ramp === undefined) {
    ramp = GRADE_PALETTES.sunset;
  }
  const luts = { r: new Uint8Array(256), g: new Uint8Array(256), b: new Uint8Array(256) };
  for (let n = 0; n < 256; n += 1) {
    const t = n / 255;
    let lo = ramp[0];
    let hi = ramp[ramp.length - 1];
    for (let i = 0; i + 1 < ramp.length; i += 1) {
      if (t < ramp[i].at || t > ramp[i + 1].at) {
        continue;
      }
      lo = ramp[i];
      hi = ramp[i + 1];
      break;
    }
    const span = hi.at - lo.at;
    let mix = 0;
    if (span !== 0) {
      mix = (t - lo.at) / span;
    }
    const mapChannel = (channel) => {
      const mapped = lo[channel] + (hi[channel] - lo[channel]) * mix;
      return Math.round(n + (mapped - n) * strength);
    };
    luts.r[n] = mapChannel("r");
    luts.g[n] = mapChannel("g");
    luts.b[n] = mapChannel("b");
  }
  return luts;
}

/** Pushes every pixel through the grade LUT, keyed by brightness. */
export function applyGradientGrade(frame, grade, strength) {
  const lut = buildGradeLUT(grade, strength);
  const buf = frame.data;
  for (let i = 0; i < buf.length; i += 4) {
    const lum = (0.299 * buf[i] + 0.587 * buf[i + 1] + 0.114 * buf[i + 2]) | 0;
    buf[i] = lut.r[lum];
    buf[i + 1] = lut.g[lum];
    buf[i + 2] = lut.b[lum];
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
    let wgt = (215 - lum) / 75;
    if (lum < 140) {
      wgt = (lum - 70) / 70;
    }
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
    for (let c = 2; c >= 0; c -= 1) {
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
    for (let c = 2; c >= 0; c -= 1) {
      buf[i + c] = clampByte((buf[i + c] - lum) * boost + lum);
    }
  }
  return frame;
}

let halftoneTile = null;
/** A reusable tile of print dots, denser toward one corner of a cell. */
export function makeHalftonePattern(size = 96) {
  if (halftoneTile !== null) {
    return halftoneTile;
  }
  const sheet = document.createElement("canvas");
  sheet.width = size;
  sheet.height = size;
  const gc = sheet.getContext("2d");
  const grid = 12;
  for (let c = 0; c < size / grid; c += 1) {
    for (let r = 0; r < size / grid; r += 1) {
      const dot = 1 + ((c + r) % 4) * 1.1;
      gc.fillStyle = "rgba(20,4,32,0.55)";
      gc.beginPath();
      gc.arc(grid * c + 0.5 * grid, grid * r + 0.5 * grid, dot, 0, 2 * Math.PI);
      gc.fill();
    }
  }
  halftoneTile = sheet;
  return sheet;
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
  if (grainTile !== null) {
    return grainTile;
  }
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
  return sheet;
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
  for (const [at, a] of [[0, 0], [1, strength]]) {
    shade.addColorStop(at, "rgba(10,2,20," + a + ")");
  }
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
  if (grade === "ink") {
    saturateImageData(frame, 1.2);
    applyGradientGrade(frame, "ink", 0.42);
    warmSkinTones(frame, 0.8);
    posterizeImageData(frame, 6);
  } else if (grade === "neon") {
    saturateImageData(frame, 1.3);
    applyGradientGrade(frame, "neon", 0.6);
  } else if (grade === "golden") {
    applyGradientGrade(frame, "golden", 0.58);
  } else {
    // Sunset (the default): photographic, NOT a gradient map. The map
    // swaps every pixel's hue for a brightness-derived tint (its LUT is
    // keyed on brightness alone), so at any strength it turns the pink
    // car cream and the sea grey. A saturation lift plus warm mids keeps
    // each photo's own colour and gives the warm sunset feel the top
    // covers have. The highlight lift is what makes skies glow orange
    // like #1's instead of staying pale — it only touches the bright
    // end, so mid-tone skin is untouched.
    saturateImageData(frame, 1.18);
    warmSkinTones(frame, 0.6);
    warmHighlights(frame, 0.55);
  }
  gc.putImageData(frame, 0, 0);
  if (grade === "ink") {
    applyHalftone(gc, out.width, out.height, 0.12);
  }
  let grainAmt = 0.06;
  if (grade === "ink") {
    grainAmt = 0.09;
  }
  applyGrain(gc, out.width, out.height, grainAmt);
  let vigAmt = 0.18;
  if (grade === "ink") {
    vigAmt = 0.3;
  }
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
  let fx = 0.5;
  if (cropSpec.fx !== undefined) {
    fx = cropSpec.fx;
  }
  let fy = 0.4;
  if (cropSpec.fy !== undefined) {
    fy = cropSpec.fy;
  }
  let zoom = 1;
  if (cropSpec.zoom !== undefined) {
    zoom = cropSpec.zoom;
  }
  zoom = Math.max(1, zoom);
  const scale = zoom * Math.max(w / srcW, h / srcH);
  const sw = w / scale;
  const sh = h / scale;
  const ox = Math.max(0, Math.min(fx * srcW - sw * 0.5, srcW - sw));
  const oy = Math.max(0, Math.min(fy * srcH - sh * 0.5, srcH - sh));
  ctx.drawImage(img, ox, oy, sw, sh, destX, destY, w, h);
}
