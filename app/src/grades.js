// grades.js — colour grades for every cover panel.
//
// Each grade is a gradient map: a pixel's brightness selects a colour
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

function clamp255(v) {
  return Math.max(0, Math.min(255, v));
}

// Palette stops per grade, as {r, g, b, at} stops the lookup reads.
export const GRADE_PALETTES = {
  sunset: [
    { r: 26, g: 8, b: 46, at: 0.0 },
    { r: 100, g: 40, b: 70, at: 0.28 },
    { r: 220, g: 130, b: 80, at: 0.55 },
    { r: 250, g: 160, b: 90, at: 0.78 },
    { r: 255, g: 210, b: 63, at: 1.0 },
  ],
  neon: [
    { r: 10, g: 8, b: 48, at: 0.0 },
    { r: 74, g: 20, b: 120, at: 0.3 },
    { r: 168, g: 38, b: 150, at: 0.55 },
    { r: 255, g: 64, b: 160, at: 0.78 },
    { r: 64, g: 224, b: 208, at: 1.0 },
  ],
  golden: [
    { r: 40, g: 20, b: 8, at: 0.0 },
    { r: 122, g: 62, b: 18, at: 0.3 },
    { r: 214, g: 122, b: 32, at: 0.55 },
    { r: 255, g: 176, b: 64, at: 0.8 },
    { r: 255, g: 236, b: 160, at: 1.0 },
  ],
  // Warm mids on purpose: coral-orange at 0.55 rather than magenta-pink,
  // so skin in the poster-ink pass reads sun-warmed instead of purple.
  ink: [
    { r: 22, g: 6, b: 38, at: 0.0 },
    { r: 132, g: 38, b: 62, at: 0.3 },
    { r: 224, g: 72, b: 84, at: 0.55 },
    { r: 255, g: 138, b: 58, at: 0.78 },
    { r: 255, g: 214, b: 92, at: 1.0 },
  ],
};

/**
 * One lookup table per channel for `grade`. `strength` 0..1 sets how far
 * the mapped colour replaces the original pixel (1 = full gradient map).
 */
export function buildGradeLUT(grade, strength = 0.62) {
  const stops = GRADE_PALETTES[grade] ?? GRADE_PALETTES.sunset;
  const tables = { r: new Uint8Array(256), g: new Uint8Array(256), b: new Uint8Array(256) };
  for (let v = 0; v < 256; v += 1) {
    const pos = v / 255;
    let a = stops[0];
    let b = stops[stops.length - 1];
    for (let i = 0; i + 1 < stops.length; i += 1) {
      if (pos >= stops[i].at && pos <= stops[i + 1].at) {
        a = stops[i];
        b = stops[i + 1];
        break;
      }
    }
    const range = b.at - a.at;
    const frac = range === 0 ? 0 : (pos - a.at) / range;
    for (const ch of ["r", "g", "b"]) {
      const col = a[ch] + (b[ch] - a[ch]) * frac;
      tables[ch][v] = Math.round((col - v) * strength + v);
    }
  }
  return tables;
}

/** Pushes every pixel through the grade LUT, keyed by brightness. */
export function applyGradientGrade(img, grade, strength) {
  const tables = buildGradeLUT(grade, strength);
  const px = img.data;
  let k = 0;
  while (k < px.length) {
    const bright = (px[k] * 0.299 + px[k + 1] * 0.587 + px[k + 2] * 0.114) | 0;
    px[k] = tables.r[bright];
    px[k + 1] = tables.g[bright];
    px[k + 2] = tables.b[bright];
    k += 4;
  }
  return img;
}

/**
 * Warms the skin band: pixels whose brightness sits in the middle range
 * get a red lift and a blue cut, fading to nothing at the band edges.
 * This runs before posterising so the poster-ink grade keeps faces warm
 * rather than pushing them toward violet. `amount` 0..1; 0.5 is gentle.
 */
export function warmSkinTones(img, amount = 0.5) {
  const px = img.data;
  const rBoost = amount * 14;
  const bCut = amount * 12;
  for (let i = 0; i < px.length; i += 4) {
    const bright = 0.299 * px[i] + 0.587 * px[i + 1] + 0.114 * px[i + 2];
    if (bright < 70 || bright > 215) {
      continue;
    }
    // Triangle weight: full effect near brightness 140, none at the edges.
    const w = bright < 140 ? (bright - 70) / 70 : (215 - bright) / 75;
    px[i] = clamp255(px[i] + rBoost * w);
    px[i + 2] = clamp255(px[i + 2] - bCut * w);
  }
  return img;
}

/**
 * Warms the bright end: pixels brighter than `cutoff` get a red/orange
 * lift that grows with brightness, so skies and highlights glow sunset
 * instead of staying pale blue-white. Only the sunset grade uses it.
 */
export function warmHighlights(frame, amount = 0.5, cutoff = 175) {
  const px = frame.data;
  for (let i = 0; i < px.length; i += 4) {
    const bright = 0.299 * px[i] + 0.587 * px[i + 1] + 0.114 * px[i + 2];
    if (bright <= cutoff) {
      continue;
    }
    const w = ((bright - cutoff) / (255 - cutoff)) * amount;
    px[i] = clamp255(px[i] + 26 * w);
    px[i + 1] = clamp255(px[i + 1] + 8 * w);
    px[i + 2] = clamp255(px[i + 2] - 14 * w);
  }
  return frame;
}

/** Flattens each channel to `levels` even steps — the comic-ink feel. */
export function posterizeImageData(img, levels = 5) {
  const px = img.data;
  const gap = 255 / (levels - 1);
  for (let i = 0; i < px.length; i += 4) {
    for (let c = 0; c <= 2; c += 1) {
      const q = Math.round(px[i + c] / gap) * gap;
      px[i + c] = Math.round(q);
    }
  }
  return img;
}

/** Pushes colours away from grey in place (1 leaves them unchanged). */
export function saturateImageData(img, gain = 1.25) {
  const px = img.data;
  for (let i = 0; i < px.length; i += 4) {
    const bright = 0.299 * px[i] + 0.587 * px[i + 1] + 0.114 * px[i + 2];
    for (let c = 0; c <= 2; c += 1) {
      px[i + c] = clamp255(bright + (px[i + c] - bright) * gain);
    }
  }
  return img;
}

let dotTile = null;
/** A reusable tile of print dots, denser toward one corner of a cell. */
export function makeHalftonePattern(size = 96) {
  if (dotTile === null) {
    const tile = document.createElement("canvas");
    tile.width = size;
    tile.height = size;
    const g = tile.getContext("2d");
    const cell = 12;
    for (let r = 0; r < size / cell; r += 1) {
      for (let c = 0; c < size / cell; c += 1) {
        const rad = 1 + 1.1 * ((r + c) % 4);
        g.fillStyle = "rgba(20,4,32,0.55)";
        g.beginPath();
        g.arc(c * cell + cell * 0.5, r * cell + cell * 0.5, rad, 0, Math.PI * 2);
        g.fill();
      }
    }
    dotTile = tile;
  }
  return dotTile;
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

let noiseTile = null;
/** A reusable tile of neutral film grain, built once. */
export function makeGrainCanvas(size = 160) {
  if (noiseTile === null) {
    const tile = document.createElement("canvas");
    tile.width = size;
    tile.height = size;
    const g = tile.getContext("2d");
    const im = g.createImageData(size, size);
    for (let i = 0; i < im.data.length; i += 4) {
      const val = 98 + Math.floor(40 * Math.random());
      im.data[i] = val;
      im.data[i + 1] = val;
      im.data[i + 2] = val;
      im.data[i + 3] = 255;
    }
    g.putImageData(im, 0, 0);
    noiseTile = tile;
  }
  return noiseTile;
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
export function applyVignette(ctx, w, h, power = 0.28) {
  const grad = ctx.createRadialGradient(
    0.5 * w, 0.5 * h, 0.32 * Math.min(h, w),
    0.5 * w, 0.5 * h, 0.72 * Math.max(h, w),
  );
  grad.addColorStop(0, "rgba(10,2,20,0)");
  grad.addColorStop(1, "rgba(10,2,20," + power + ")");
  ctx.save();
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, w, h);
  ctx.restore();
}

/**
 * Grades one photo panel and returns the graded canvas. `crop` is
 * {fx, fy, zoom} — the focus point (0..1) and zoom (>= 1). The grade
 * runs at most ~760 px wide and is upscaled on draw, which keeps the
 * pixel loops fast without visible loss at post sizes.
 */
export function gradePanelImage(photo, pw, ph, crop, gradeName) {
  const cv = document.createElement("canvas");
  const cw = Math.round(pw);
  const ch = Math.round(ph);
  cv.width = Math.max(2, cw);
  cv.height = Math.max(2, ch);
  const g = cv.getContext("2d");
  drawCroppedPhoto(g, photo, 0, 0, pw, ph, crop);
  const frame = g.getImageData(0, 0, cv.width, cv.height);
  switch (gradeName) {
    case "golden":
      applyGradientGrade(frame, "golden", 58 / 100);
      break;
    case "neon":
      saturateImageData(frame, 13 / 10);
      applyGradientGrade(frame, "neon", 6 / 10);
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
  g.putImageData(frame, 0, 0);
  if (gradeName === "ink") {
    applyHalftone(g, cv.width, cv.height, 12 / 100);
  }
  const grainAmt = gradeName === "ink" ? 9 / 100 : 6 / 100;
  applyGrain(g, cv.width, cv.height, grainAmt);
  const vigAmt = gradeName === "ink" ? 3 / 10 : 18 / 100;
  applyVignette(g, cv.width, cv.height, vigAmt);
  return cv;
}

/**
 * Cover-fits `photo` into the rect (dx, dy, tw, th) on `g`, panning
 * toward the focus point and zooming in. The crop never shows empty
 * space.
 */
export function drawCroppedPhoto(g, photo, dx, dy, tw, th, crop = {}) {
  const sw0 = photo.naturalWidth || photo.width;
  const sh0 = photo.naturalHeight || photo.height;
  const fx = crop.fx ?? 0.5;
  const fy = crop.fy ?? 0.4;
  let zoom = crop.zoom ?? 1;
  zoom = Math.max(1, zoom);
  const scale = zoom * Math.max(tw / sw0, th / sh0);
  const sw = tw / scale;
  const sh = th / scale;
  const ox = Math.max(0, Math.min(sw0 - sw, sw0 * fx - sw * 0.5));
  const oy = Math.max(0, Math.min(sh0 - sh, sh0 * fy - sh * 0.5));
  g.drawImage(photo, ox, oy, sw, sh, dx, dy, tw, th);
}
