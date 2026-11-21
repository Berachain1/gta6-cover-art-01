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

function clampByte(n) {
  return Math.min(255, Math.max(0, n));
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
  // Warm mids on purpose — coral-orange at 0.55, not magenta-pink —
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
 * Builds one lookup table per channel for `grade`. `strength` 0..1
 * sets how far the mapped colour replaces the original pixel
 * (1 = full gradient map).
 */
export function buildGradeLUT(grade, strength = 0.62) {
  const st = GRADE_PALETTES[grade] ?? GRADE_PALETTES.sunset;
  const lut = { r: new Uint8Array(256), g: new Uint8Array(256), b: new Uint8Array(256) };
  for (let v = 0; v < 256; v++) {
    const p = v / 255;
    let lo = st[0];
    let hi = st[st.length - 1];
    for (let i = 0; i + 1 < st.length; i++) {
      if (p >= st[i].at && p <= st[i + 1].at) {
        lo = st[i];
        hi = st[i + 1];
        break;
      }
    }
    const span = hi.at - lo.at;
    const t = span === 0 ? 0 : (p - lo.at) / span;
    for (const ch of ["r", "g", "b"]) {
      const c = lo[ch] + (hi[ch] - lo[ch]) * t;
      lut[ch][v] = Math.round(v + (c - v) * strength);
    }
  }
  return lut;
}

/** Runs every pixel through the grade LUT, keyed by brightness. */
export function applyGradientGrade(img, grade, strength) {
  const lut = buildGradeLUT(grade, strength);
  const d = img.data;
  for (let i = 0; i < d.length; i += 4) {
    const lum = (d[i] * 0.299 + d[i + 1] * 0.587 + d[i + 2] * 0.114) | 0;
    d[i] = lut.r[lum];
    d[i + 1] = lut.g[lum];
    d[i + 2] = lut.b[lum];
  }
  return img;
}

/**
 * Warms the skin band: pixels whose brightness sits in the middle range
 * get a red lift and a blue cut, fading to nothing at the band edges.
 * It runs before posterising so the poster-ink grade keeps faces warm
 * rather than pushing them toward violet. `amount` 0..1; 0.5 is gentle.
 */
export function warmSkinTones(img, amount = 0.5) {
  const d = img.data;
  const redUp = amount * 14;
  const blueDown = amount * 12;
  for (let i = 0; i < d.length; i += 4) {
    const lum = d[i] * 0.299 + d[i + 1] * 0.587 + d[i + 2] * 0.114;
    if (lum < 70 || lum > 215) {
      continue;
    }
    // Triangle weight: full effect near brightness 140, fading to none at the edges.
    const wt = lum < 140 ? (lum - 70) / 70 : (215 - lum) / 75;
    d[i] = clampByte(d[i] + redUp * wt);
    d[i + 2] = clampByte(d[i + 2] - blueDown * wt);
  }
  return img;
}

/**
 * Warms the bright end: pixels brighter than `cutoff` get a red/orange
 * lift that grows with brightness, so skies and highlights glow sunset
 * instead of staying pale blue-white. Only the sunset grade uses it.
 */
export function warmHighlights(frame, amount = 0.5, cutoff = 175) {
  const d = frame.data;
  for (let i = 0; i < d.length; i += 4) {
    const lum = d[i] * 0.299 + d[i + 1] * 0.587 + d[i + 2] * 0.114;
    if (lum <= cutoff) {
      continue;
    }
    const wt = amount * ((lum - cutoff) / (255 - cutoff));
    d[i] = clampByte(d[i] + 26 * wt);
    d[i + 1] = clampByte(d[i + 1] + 8 * wt);
    d[i + 2] = clampByte(d[i + 2] - 14 * wt);
  }
  return frame;
}

/** Flattens every channel to `levels` even steps — the comic-ink feel. */
export function posterizeImageData(img, levels = 5) {
  const d = img.data;
  const step = 255 / (levels - 1);
  for (let i = 0; i < d.length; i += 4) {
    for (let c = 0; c <= 2; c++) {
      const v = Math.round(d[i + c] / step) * step;
      d[i + c] = Math.round(v);
    }
  }
  return img;
}

/** Pushes colours away from grey, in place (1 leaves them unchanged). */
export function saturateImageData(img, amt = 1.25) {
  const d = img.data;
  for (let i = 0; i < d.length; i += 4) {
    const lum = d[i] * 0.299 + d[i + 1] * 0.587 + d[i + 2] * 0.114;
    for (let c = 0; c <= 2; c++) {
      d[i + c] = clampByte(lum + (d[i + c] - lum) * amt);
    }
  }
  return img;
}

let halftoneTile = null;
/** A reusable print-dot tile, denser toward one corner of a cell. */
export function makeHalftonePattern(size = 96) {
  if (halftoneTile === null) {
    const cv = document.createElement("canvas");
    cv.width = size;
    cv.height = size;
    const ctx = cv.getContext("2d");
    const sz = 12;
    for (let row = 0; row < size / sz; row++) {
      for (let col = 0; col < size / sz; col++) {
        const r = 1 + ((row + col) % 4) * 1.1;
        ctx.fillStyle = "rgba(20,4,32,0.55)";
        ctx.beginPath();
        ctx.arc(col * sz + sz * 0.5, row * sz + sz * 0.5, r, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    halftoneTile = cv;
  }
  return halftoneTile;
}

/** Lays halftone dots over a panel, at low opacity. */
export function applyHalftone(ctx, w, h, alpha = 0.16) {
  const p = ctx.createPattern(makeHalftonePattern(), "repeat");
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.fillStyle = p;
  ctx.fillRect(0, 0, w, h);
  ctx.restore();
}

let grainTile = null;
/** A reusable neutral film-grain tile, built once. */
export function makeGrainCanvas(size = 160) {
  if (grainTile === null) {
    const cv = document.createElement("canvas");
    cv.width = size;
    cv.height = size;
    const ctx = cv.getContext("2d");
    const im = ctx.createImageData(size, size);
    for (let i = 0; i < im.data.length; i += 4) {
      const v = 98 + Math.floor(40 * Math.random());
      im.data[i] = v;
      im.data[i + 1] = v;
      im.data[i + 2] = v;
      im.data[i + 3] = 255;
    }
    ctx.putImageData(im, 0, 0);
    grainTile = cv;
  }
  return grainTile;
}

/** Dusts film grain over a panel using an overlay blend. */
export function applyGrain(ctx, w, h, alpha = 0.07) {
  const p = ctx.createPattern(makeGrainCanvas(), "repeat");
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.globalCompositeOperation = "overlay";
  ctx.fillStyle = p;
  ctx.fillRect(0, 0, w, h);
  ctx.restore();
}

/** Darkens the corners of a panel so it reads like a printed poster. */
export function applyVignette(ctx, w, h, amt = 0.28) {
  const g = ctx.createRadialGradient(
    w * 0.5, h * 0.5, Math.min(w, h) * 0.32,
    w * 0.5, h * 0.5, Math.max(w, h) * 0.72,
  );
  g.addColorStop(0, "rgba(10,2,20,0)");
  g.addColorStop(1, "rgba(10,2,20," + amt + ")");
  ctx.save();
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
  ctx.restore();
}

/**
 * Grades a single photo panel and hands back the graded canvas.
 * `crop` is {fx, fy, zoom} — focus point (0..1) and zoom (>= 1).
 * The grade runs at most ~760 px wide and is upscaled when drawn,
 * which keeps the pixel loops fast with no visible loss at post sizes.
 */
export function gradePanelImage(photo, pw, ph, crop, gradeName) {
  const out = document.createElement("canvas");
  const w = Math.round(pw);
  const h = Math.round(ph);
  out.width = Math.max(2, w);
  out.height = Math.max(2, h);
  const ctx = out.getContext("2d");
  drawCroppedPhoto(ctx, photo, 0, 0, pw, ph, crop);
  const img = ctx.getImageData(0, 0, out.width, out.height);
  switch (gradeName) {
    case "golden":
      applyGradientGrade(img, "golden", 0.58);
      break;
    case "neon":
      saturateImageData(img, 1.3);
      applyGradientGrade(img, "neon", 0.6);
      break;
    case "ink":
      saturateImageData(img, 1.2);
      applyGradientGrade(img, "ink", 0.42);
      warmSkinTones(img, 0.8);
      posterizeImageData(img, 6);
      break;
    default:
      // Sunset (the default) stays photographic — never a gradient map.
      // A map swaps each pixel's hue for a brightness-derived tint (its
      // LUT keys on brightness alone), so at any strength it turns the
      // pink car cream and the sea grey. A saturation lift plus warm
      // mids keeps each photo's own colour and gives the warm sunset
      // feel the top covers have. The highlight lift is what makes
      // skies glow orange like #1's instead of staying pale — it only
      // touches the bright end, so mid-tone skin is untouched.
      saturateImageData(img, 1.18);
      warmSkinTones(img, 0.6);
      warmHighlights(img, 0.55);
      break;
  }
  ctx.putImageData(img, 0, 0);
  if (gradeName === "ink") {
    applyHalftone(ctx, out.width, out.height, 0.12);
  }
  const grain = gradeName === "ink" ? 0.09 : 0.06;
  applyGrain(ctx, out.width, out.height, grain);
  const vig = gradeName === "ink" ? 0.3 : 0.18;
  applyVignette(ctx, out.width, out.height, vig);
  return out;
}

/**
 * Cover-fits `photo` into the rect (dx, dy, tw, th) on `ctx`,
 * panning toward the focus point and zooming in. Empty space
 * never shows in the crop.
 */
export function drawCroppedPhoto(ctx, photo, dx, dy, tw, th, crop = {}) {
  const iw = photo.naturalWidth || photo.width;
  const ih = photo.naturalHeight || photo.height;
  const focusX = crop.fx ?? 0.5;
  const focusY = crop.fy ?? 0.4;
  let z = crop.zoom ?? 1;
  z = Math.max(1, z);
  const s = z * Math.max(tw / iw, th / ih);
  const cw = tw / s;
  const ch = th / s;
  const sx = Math.min(Math.max(iw * focusX - cw / 2, 0), iw - cw);
  const sy = Math.min(Math.max(ih * focusY - ch / 2, 0), ih - ch);
  ctx.drawImage(photo, sx, sy, cw, ch, dx, dy, tw, th);
}
