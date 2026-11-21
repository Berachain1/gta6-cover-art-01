// cover.js — the poster painter for Palm Heat Cover Studio.
//
// drawCoverGrid takes a canvas, the editor document and the loaded
// photos and paints a complete GTA-style cover onto it: a photo grid
// in several panels with black gutters, a gradient-map or poster-ink
// grade washed over each panel, one enormous gradient title block
// with a neon script subtitle underneath, and all the poster
// furniture (starburst badge, HEAT stars, barcode, ORIGINAL ribbon).
// exportCoverPNG draws that same artwork offscreen at an exact post
// size and returns a PNG blob.
//
// The title block takes four forms. 'cell' fills a single grid cell;
// 'band' is a band across the full width (used when portrait and
// square layouts re-flow); 'hero' is a full-width band whose title
// sprawls across the whole width, the way the top covers do; 'overlap'
// floats the title above the panels. In overlap mode the letters sit
// on a dark scrim, and the script subtitle gets a solid dark plate of
// its own behind it — without that plate the subtitle can fall on a
// bright, busy patch of photo and disappear, which is exactly what
// happens on the Tilted layout's lower panels.

import { gradePanelImage, drawCroppedPhoto } from "./grades.js";

const GUTTER = 10;

// Post sizes and their labels.
export const EXPORT_SIZES = {
  landscape: { label: "1920 × 1080", w: 1920, h: 1080 },
  portrait: { label: "1080 × 1350", w: 1080, h: 1350 },
  square: { label: "1080 × 1080", w: 1080, h: 1080 },
};

// Layout names for the editor picker.
export const LAYOUTS = {
  chaos: "Chaos Key-Art · tilted collage + title over photos",
  "hero-vice": "Hero Vice · big-face hero + title band + strip",
  "vice-grid": "Vice Grid · 9-panel poster",
  "hero-three": "Hero + Three",
  tilted: "Tilted Snapshots",
  "full-bleed": "Full Bleed",
};

// Grade names for the editor picker.
export const GRADES = {
  sunset: "Sunset",
  neon: "Neon Night",
  golden: "Golden Hour",
  ink: "Poster Ink",
};

// hero-vice: one LARGE hero panel on the left (a big face, about half
// the cover), a 2-stack middle column and a 3-stack right column
// above it, a WIDE title band across the full width — 30%, the title
// zone of the top covers, not a 42% flat slab — and a thin bottom
// strip with palms, tagline, fine print, and barcode. The title
// sprawls across the band the way the top-2 covers do; a press-quote
// pill straddles the panel/title boundary, and every panel carries a
// location/time caption chip.
function heroVicePanels(w, h, g, tall) {
  const bandPx = 0.3 * h;
  const footPx = 0.075 * h;
  const topPx = h - bandPx - footPx - 4 * g;
  const titleY = topPx + g + g;
  const footY = bandPx + titleY + g;
  const footRect = { x: g, y: footY, w: w - g * 2, h: h - footY - g };
  const tiles = [];
  if (tall) {
    const leadHeight = 0.6 * topPx;
    tiles.push({ x: g, y: g, w: w - g * 2, h: leadHeight });
    const colW = (w - 4 * g) / 3;
    const rowH = topPx - leadHeight - g;
    for (let ci = 0; ci < 3; ci += 1) {
      tiles.push({ x: ci * (colW + g) + g, y: leadHeight + g + g, w: colW, h: rowH });
    }
    return {
      burst: { x: 76, y: 76 },
      tiles,
      foot: footRect,
      mast: { x: g, y: titleY, w: w - g * 2, h: bandPx, kind: "hero" },
    };
  }
  const leadWidth = w * 0.46 - g;
  const midW = w * 0.235 - g;
  const rightW = w * 0.305 - g * 2;
  const midX = g + g + leadWidth;
  const rightX = midW + midX + g;
  tiles.push({ x: g, y: g, w: leadWidth, h: topPx });
  const midH = (topPx - g) / 2;
  tiles.push({ x: midX, y: g, w: midW, h: midH });
  tiles.push({ x: midX, y: midH + g + g, w: midW, h: midH });
  const rowH = (topPx - g * 2) / 3;
  for (let ri = 0; ri < 3; ri += 1) {
    tiles.push({ x: rightX, y: ri * (rowH + g) + g, w: rightW, h: rowH });
  }
  return {
    burst: { x: 64 + g, y: 64 + g },
    tiles,
    foot: footRect,
    mast: { x: g, y: titleY, w: w - g * 2, h: bandPx, kind: "hero" },
  };
}

// chaos is the top-3 covers' key-art collage. Photos run the full
// height BEHIND the title — the title crashes OVER them from about
// 50% down, like do-tinh's SUNSET STATE and ahmadfdn's VICE STATE —
// and there is no title band at all. The hero panel's right edge is
// a diagonal (slant), one mid panel and two right panels are rotated
// a few degrees, and the starburst sits on a panel junction instead
// of a corner. `fugitive` is the top-right anchor of the fisherman
// panel for the WANTED pill.
function chaosPanels(w, h, g, tall) {
  const footPx = 0.075 * h;
  const footY = h - footPx - g;
  const footRect = { x: g, y: footY, w: w - g * 2, h: h - footY - g };
  const tiles = [];
  let mastH = h * 0.38;
  if (tall) {
    mastH = h * 0.34;
  }
  const mast = { x: 0, y: h * 0.5, w, h: mastH, kind: "chaos" };
  if (tall) {
    const tallH = h * 0.44;
    tiles.push({ x: g, y: g, w: w - g * 2, h: tallH, slant: 30 });
    const colW = (w - 4 * g) / 3;
    // The row runs down to the photo bottom (0.88h) so photos fill
    // behind the title all the way to the strip — a short row left a
    // black scrim void under the title in portrait/square.
    const rowTop = tallH + g + g;
    const rowH = h * 0.88 - rowTop;
    tiles.push({ x: g, y: rowTop, w: colW, h: rowH, rot: -0.02 });
    tiles.push({ x: colW + g + g, y: rowTop, w: colW, h: rowH });
    tiles.push({ x: 2 * (colW + g) + g, y: rowTop, w: colW, h: rowH, rot: 0.025 });
    return {
      burst: { x: w * 0.66, y: tallH + g + g },
      tiles,
      foot: footRect,
      mast,
      fugitive: { x: g + 3 * colW + g * 2, y: rowTop },
    };
  }
  const floor = h * 0.88;
  const top = floor - g;
  const leadWidth = 0.44 * w - g;
  const midX = g + g + leadWidth;
  const midW = 0.24 * w - g;
  const rightX = midW + midX + g;
  const rightW = w - rightX - g;
  tiles.push({ x: g, y: g, w: leadWidth, h: top, slant: 36 });
  const midH = (top - g) / 2;
  tiles.push({ x: midX, y: g, w: midW, h: midH, rot: 0.02 });
  tiles.push({ x: midX, y: midH + g + g, w: midW, h: midH, rot: -0.015 });
  const rowH = (top - g * 2) / 3;
  tiles.push({ x: rightX, y: g, w: rightW, h: rowH, rot: -0.03 });
  tiles.push({ x: rightX, y: rowH + g + g, w: rightW, h: rowH, rot: 0.025 });
  tiles.push({ x: rightX, y: 2 * (rowH + g) + g, w: rightW, h: rowH, rot: -0.02 });
  return {
    // Starburst on the hero/mid-column junction up where no caption
    // chip lives (the old junction sat on the fisherman's chip), and
    // WANTED on the car panel's top-right — the fisherman panel's
    // top-right is under the ORIGINAL ribbon, which hid the pill.
    burst: { x: midX, y: top * 0.22 },
    tiles,
    foot: footRect,
    mast,
    fugitive: { x: rightX + rightW, y: rowH + g + g },
  };
}

function viceGridPanels(w, h, g, tall) {
  const tiles = [];
  if (tall) {
    const colW = (w - 3 * g) / 2;
    const rowH = (h * 0.62 - 4 * g) / 3;
    for (let ri = 0; ri < 3; ri += 1) {
      for (let ci = 0; ci < 2; ci += 1) {
        tiles.push({ x: ci * (colW + g) + g, y: ri * (rowH + g) + g, w: colW, h: rowH });
      }
    }
    const titleY = g + 3 * (rowH + g);
    return {
      burst: { x: 76, y: 76 },
      tiles,
      mast: { x: g, y: titleY, w: w - g * 2, h: h - titleY - g, kind: "band" },
    };
  }
  const colW = (w - 4 * g) / 3;
  const rowH = (h - 4 * g) / 3;
  for (let ri = 0; ri < 3; ri += 1) {
    for (let ci = 0; ci < 3; ci += 1) {
      if (ri === 1 && ci === 1) {
        // centre cell is the title block
      } else {
        tiles.push({ x: ci * (colW + g) + g, y: ri * (rowH + g) + g, w: colW, h: rowH });
      }
    }
  }
  return {
    burst: { x: 64 + g, y: 64 + g },
    tiles,
    mast: { x: g + (colW + g), y: g + (rowH + g), w: colW, h: rowH, kind: "cell" },
  };
}

function heroThreePanels(w, h, g, tall) {
  const tiles = [];
  if (tall) {
    const tallH = h * 0.44;
    tiles.push({ x: g, y: g, w: w - g * 2, h: tallH });
    const colW = (w - 4 * g) / 3;
    const rowH = 0.2 * h;
    for (let ci = 0; ci < 3; ci += 1) {
      tiles.push({ x: ci * (colW + g) + g, y: tallH + g * 2, w: colW, h: rowH });
    }
    const titleY = tallH + rowH + 3 * g;
    return {
      burst: { x: 76, y: 76 },
      tiles,
      mast: { x: g, y: titleY, w: w - g * 2, h: h - titleY - g, kind: "band" },
    };
  }
  const leadWidth = 0.56 * w;
  tiles.push({ x: g, y: g, w: leadWidth - g, h: h - g * 2 });
  const restW = w - leadWidth - g * 2;
  const rowH = (h - 4 * g) / 3;
  for (let ri = 0; ri < 3; ri += 1) {
    tiles.push({ x: g + leadWidth, y: ri * (rowH + g) + g, w: restW, h: rowH });
  }
  return {
    burst: { x: 78, y: 54 },
    tiles,
    mast: { x: g, y: h * 0.66, w: w - g * 2, h: h * 0.34 - g, kind: "overlap" },
  };
}

function tiltedPanels(w, h, g, tall) {
  const tiles = [];
  if (tall) {
    const tallH = 0.4 * h;
    tiles.push({ x: g, y: g, w: w - g * 2, h: tallH, slant: 40 });
    const colW = (w - 3 * g) / 2;
    const rowH = 0.24 * h;
    tiles.push({ x: g, y: tallH + g * 2, w: colW, h: rowH, slant: -30 });
    tiles.push({ x: colW + g + g, y: tallH + g * 2, w: colW, h: rowH, slant: 30 });
    const titleY = tallH + rowH + 3 * g;
    return {
      burst: { x: 76, y: 76 },
      tiles,
      mast: { x: g, y: titleY, w: w - g * 2, h: h - titleY - g, kind: "band" },
    };
  }
  const leadWidth = 0.5 * w;
  tiles.push({ x: g, y: g, w: leadWidth, h: h * 0.62, slant: 46 });
  tiles.push({ x: g + leadWidth, y: g, w: w - leadWidth - g * 2, h: h * 0.62, slant: -46 });
  const botW = (w - 4 * g) / 3;
  for (let ci = 0; ci < 3; ci += 1) {
    let slant = -26;
    if (ci === 1) {
      slant = 0;
    } else if (ci === 0) {
      slant = 26;
    }
    tiles.push({ x: g + ci * (botW + g), y: h * 0.62 + g, w: botW, h: h * 0.38 - 2 * g, slant });
  }
  return {
    burst: { x: 64 + g, y: 64 + g },
    tiles,
    mast: { x: 0.22 * w, y: 0.42 * h, w: 0.56 * w, h: 0.3 * h, kind: "overlap" },
  };
}

// full-bleed: a single photo fills the frame, with snapshots floating on top.
function fullBleedPanels(w, h, g, tall) {
  const tiles = [];
  if (tall) {
    tiles.push({ x: 0, y: 0, w, h: h * 0.72 });
    tiles.push({ x: g, y: 0.52 * h, w: 0.42 * w, h: 0.2 * h, snap: true });
    return {
      burst: { x: 76, y: 76 },
      tiles,
      mast: { x: 0, y: h * 0.72, w, h: h * 0.28, kind: "band" },
    };
  }
  tiles.push({ x: 0, y: 0, w, h });
  tiles.push({ x: w * 0.66, y: g * 2, w: w * 0.3, h: h * 0.34, snap: true });
  tiles.push({ x: 0.04 * w, y: 0.06 * h, w: 0.24 * w, h: 0.3 * h, snap: true });
  return {
    burst: { x: 0.5 * w, y: 60 },
    tiles,
    mast: { x: 0, y: 0.6 * h, w, h: 0.4 * h, kind: "overlap" },
  };
}

/**
 * Panel geometry for a layout at (w, h). It returns { tiles, mast, burst }:
 * tiles are {x, y, w, h} rects (optionally `slant` for diagonal cuts or
 * `snap` for a rotated polaroid); mast is the title-block rect plus a
 * `kind` ('cell' | 'band' | 'overlap'); burst is where the starburst goes.
 */
export function layoutPanels(w, h, layout) {
  const g = (w / 1920) * GUTTER;
  const tall = w <= h;
  switch (layout) {
    case "hero-vice":
      return heroVicePanels(w, h, g, tall);
    case "chaos":
      return chaosPanels(w, h, g, tall);
    case "vice-grid":
      return viceGridPanels(w, h, g, tall);
    case "hero-three":
      return heroThreePanels(w, h, g, tall);
    case "tilted":
      return tiltedPanels(w, h, g, tall);
    default:
      return fullBleedPanels(w, h, g, tall);
  }
}

/** The Anton size that fits `text` inside `limit`, shrinking 2 px at a time. */
export function fitTitleFont(pen, text, limit, max, face = "Anton") {
  let size = max;
  pen.font = size + "px " + face + ", sans-serif";
  for (;;) {
    if (pen.measureText(text).width <= limit || size <= 20) {
      break;
    }
    size -= 2;
    pen.font = size + "px " + face + ", sans-serif";
  }
  return size;
}

/** How many photo panels a layout has. */
export function panelCount(layout) {
  switch (layout) {
    case "chaos":
    case "hero-vice":
      return 6;
    case "vice-grid":
      return 8;
    case "hero-three":
      return 4;
    case "tilted":
      return 5;
    case "full-bleed":
      return 3;
    default:
      return 8;
  }
}

/** A filled rounded-rectangle path (avoids any pen.roundRect dependency). */
export function roundRectPath(pen, x, y, w, h, radius) {
  const r = Math.min(radius, h / 2, w / 2);
  const x0 = x;
  const x1 = x + w;
  const y0 = y;
  const y1 = y + h;
  pen.beginPath();
  pen.moveTo(x0 + r, y0);
  pen.lineTo(x1 - r, y0);
  pen.quadraticCurveTo(x1, y0, x1, y0 + r);
  pen.lineTo(x1, y1 - r);
  pen.quadraticCurveTo(x1, y1, x1 - r, y1);
  pen.lineTo(x0 + r, y1);
  pen.quadraticCurveTo(x0, y1, x0, y1 - r);
  pen.lineTo(x0, y0 + r);
  pen.quadraticCurveTo(x0, y0, x0 + r, y0);
  pen.closePath();
}

/** A spiky starburst badge (EST. 2026 / NEW) with two lines of text. */
export function drawStarburstBadge(pen, cx, cy, r, line1, line2) {
  pen.save(); // starburst
  pen.translate(cx, cy);
  // Spike tips alternate between the outer radius and a shorter inner
  // one; the points are collected first, then traced in one pass.
  const spikes = [];
  const points = 14;
  for (let i = 0; i < points * 2; i += 1) {
    const a = (i / points - 0.5) * Math.PI;
    const d = r * (i % 2 === 0 ? 1 : 0.78);
    spikes.push([Math.cos(a) * d, Math.sin(a) * d]);
  }
  pen.beginPath();
  spikes.forEach(([sx, sy], i) => {
    if (i === 0) {
      pen.moveTo(sx, sy);
    } else {
      pen.lineTo(sx, sy);
    }
  });
  pen.closePath();
  pen.fillStyle = "#ffd23f";
  pen.fill();
  pen.lineWidth = Math.max(2, r * 0.07);
  pen.strokeStyle = "#14041f";
  pen.stroke();
  pen.fillStyle = "#14041f";
  pen.textAlign = "center";
  pen.textBaseline = "middle";
  pen.font = r * 0.42 + "px Anton, sans-serif";
  pen.fillText(line1, 0, r * -0.16);
  pen.font = r * 0.26 + "px Anton, sans-serif";
  pen.fillText(line2, 0, r * 0.24);
  pen.restore(); // starburst done
}

/** Five HEAT stars, `heat` of them filled gold. */
export function drawHeatStars(pen, cx, y, size, heat, fill = "#ffd23f", stroke = "#14041f") {
  pen.save(); // heat stars
  pen.textAlign = "center";
  pen.textBaseline = "middle";
  pen.font = size + "px sans-serif";
  const gap = size * 1.15;
  const startX = cx - gap * 2;
  const slots = [0, 1, 2, 3, 4];
  slots.forEach((i) => {
    pen.fillStyle = i < heat ? fill : "rgba(255,255,255,0.28)";
    pen.strokeStyle = stroke;
    pen.lineWidth = Math.max(1, size * 0.06);
    const x = startX + i * gap;
    pen.strokeText("★", x, y);
    pen.fillText("★", x, y);
  });
  pen.restore(); // heat stars done
}

/** A fake barcode strip, seeded by the title so it is stable per cover. */
export function drawBarcode(pen, x, y, w, h, seedText) {
  pen.save(); // barcode
  pen.fillStyle = "#ffffff";
  pen.fillRect(x, y, w, h);
  let seed = 7;
  for (let i = 0; i < seedText.length; i += 1) {
    seed = (seedText.charCodeAt(i) + seed * 31) % 997;
  }
  let barX = x + w * 0.04;
  let v = seed;
  let barW = 0;
  pen.fillStyle = "#14041f";
  while (barX < x + w * 0.96) {
    v = (v * 16807) % 2147483647;
    barW = 1 + (v % 4) * (w / 220);
    if (v % 3 !== 0) {
      pen.fillRect(barX, y + 0.08 * h, barW, 0.72 * h);
    }
    barX += barW + w / 220;
  }
  pen.restore(); // barcode done
}

/** A simple palm silhouette: curved trunk plus drooping fronds. */
export function drawPalmSilhouette(pen, x, y, scale, color) {
  pen.save(); // palm
  pen.translate(x, y);
  pen.scale(scale, scale);
  pen.strokeStyle = color;
  pen.fillStyle = color;
  pen.lineWidth = 7;
  pen.lineCap = "round";
  pen.beginPath();
  pen.moveTo(0, 0);
  pen.quadraticCurveTo(14, -60, 4, -110);
  pen.stroke();
  const fronds = [0, 1, 2, 3, 4, 5, 6];
  fronds.forEach((k) => {
    const a = (k * 52 - 160) * (Math.PI / 180);
    pen.beginPath();
    pen.moveTo(4, -110);
    pen.quadraticCurveTo(
      Math.cos(a) * 55 + 4, Math.sin(a) * 42 - 110,
      Math.cos(a) * 88 + 4, Math.sin(a) * 78 - 110,
    );
    pen.stroke();
  });
  pen.restore(); // palm done
}

// A small pill label right-aligned to `edgeX`, top edge at `top` —
// it returns the pill's left edge so a second pill can sit beside it.
// This is the furniture the top-3 covers carry that v3 lacked: the
// cyan VOL. 06 chip and the pink COLLECTOR'S EDITION ribbon (#2/#3),
// and the dark WANTED pill with gold stars (#2/#3).
function drawPillRight(pen, edgeX, top, text, bg, fg, fs, o = {}) {
  pen.save(); // pill
  pen.font = fs + "px Anton, sans-serif";
  const tw = pen.measureText(text).width;
  const pd = fs * 0.75;
  const pw = tw + pd * 2;
  const ph = fs * 1.75;
  pen.translate(edgeX - pw / 2, top + ph / 2);
  if (o.rot !== undefined) {
    pen.rotate(o.rot);
  }
  let rad;
  if (o.square) {
    rad = Math.max(3, fs * 0.15);
  } else {
    rad = ph / 2;
  }
  roundRectPath(pen, -pw / 2, -ph / 2, pw, ph, rad);
  pen.fillStyle = bg;
  pen.fill();
  if (o.stroke) {
    pen.lineWidth = Math.max(1.5, fs * 0.09);
    pen.strokeStyle = o.stroke;
    pen.stroke();
  }
  pen.fillStyle = fg;
  pen.textAlign = "center";
  pen.textBaseline = "middle";
  pen.fillText(text, 0, fs * 0.05);
  pen.restore(); // pill done
  return edgeX - pw;
}

// Paints a gradient from [position, colour] pairs onto `grad`.
function paintStops(grad, pairs) {
  for (const [at, color] of pairs) {
    grad.addColorStop(at, color);
  }
}

// Picks a text field: the document's value when set, the fallback
// otherwise; uppercased when `upper` is true.
function fieldText(value, fallback, upper) {
  let out = value;
  if (out === undefined || out === "") {
    out = fallback;
  }
  return upper ? out.toUpperCase() : out;
}

// Paints the title block's background: a sunset gradient panel for
// the cell/band/hero kinds, a dark scrim for overlap/chaos.
function paintMastBackground(pen, x, y, w, h, kind) {
  if (kind === "cell" || kind === "band" || kind === "hero") {
    const bg = pen.createLinearGradient(x, y, x, y + h);
    // Deep magenta-purple at the top so the yellow title reads, warming
    // to pink, orange and amber at the bottom — the top-2 bands' shape.
    const leadPairs = [[0, "#8a1c63"], [0.35, "#ff2e7e"], [0.7, "#ff7a2f"], [1, "#ffb03a"]];
    const slabPairs = [[0, "#ff2e7e"], [0.45, "#ff7a2f"], [1, "#ffb03a"]];
    const ramp = kind === "hero" ? leadPairs : slabPairs;
    paintStops(bg, ramp);
    pen.fillStyle = bg;
    pen.fillRect(x, y, w, h);
    // Small sun disc tucked in the top-right corner, clear of the
    // lettering — except in hero mode, where the sprawling title leaves
    // no clear spot.
    if (kind !== "hero") {
      pen.globalAlpha = 0.55;
      pen.fillStyle = "#ffe9a8";
      pen.beginPath();
      pen.arc(x + w * 0.84, y + h * 0.2, Math.min(w, h) * 0.13, 0, Math.PI * 2);
      pen.fill();
      pen.globalAlpha = 1;
    }
    return;
  }
  // Overlap: a scrim so the title stays readable over photos. Chaos
  // mode uses a MUCH lighter scrim than overlap — do-tinh's title sits
  // straight on bright photos with only its outline + shadow, and the
  // heavy scrim was drowning the lower panels in black.
  const veil = pen.createLinearGradient(x, y, x, y + h);
  const chaosPairs = [[0, 0], [0.3, 0.18], [0.62, 0.38], [1, 0.55]];
  const basePairs = [[0, 0.05], [0.3, 0.5], [0.62, 0.78], [1, 0.9]];
  const ramp = kind === "chaos" ? chaosPairs : basePairs;
  for (const [at, a] of ramp) {
    veil.addColorStop(at, "rgba(16,2,26," + a + ")");
  }
  pen.fillStyle = veil;
  pen.fillRect(x, y, w, h);
}

// Draws a list of words at `baseY`, starting at `at`, with the given
// canvas text method ("strokeText" or "fillText"), stepping by the
// per-word widths plus `wordGap`.
function drawWords(pen, parts, widths, wordGap, at, baseY, method) {
  parts.forEach((word, i) => {
    pen[method](word, at, baseY);
    at += widths[i] + wordGap;
  });
}

/**
 * Draws the title block: a sunset-gradient panel with an eyebrow
 * line, one huge gradient title (auto-fit, black outline), a neon
 * script subtitle, a tagline, and the HEAT stars.
 *
 * In overlap mode the block hovers over photos, so it first paints a
 * dark scrim and puts a solid dark plate behind the script subtitle.
 * Without that plate the subtitle can land on a bright, busy photo
 * patch and disappear — exactly what happens on the Tilted layout's
 * lower panels.
 */
export function drawTitleBlock(pen, rect, doc) {
  const { x, y, w, h } = rect;
  const kind = rect.kind ?? "cell";
  pen.save(); // title block
  paintMastBackground(pen, x, y, w, h, kind);

  const inset = w * 0.04;
  const midX = x + w / 2;
  const mastText = fieldText(doc.title, "PALM HEAT", true);
  const script = fieldText(doc.subtitle, "", false);
  const place = fieldText(doc.place, "CORAL BAY", true);
  const slogan = fieldText(doc.tagline, "", true);

  // Eyebrow: WELCOME TO · PLACE. Hero and chaos mode skip it — the
  // enlarged title (caps + outline + shadow) reaches up into the
  // eyebrow line and paints over it; #1/#2 run a bare title band too.
  if (kind !== "hero" && kind !== "chaos") {
    pen.textAlign = "center";
    pen.textBaseline = "alphabetic";
    const browA = w * 0.045;
    const browB = h * 0.11;
    const browPx = Math.max(13, Math.min(browA, browB));
    pen.font = browPx + "px Anton, sans-serif";
    let browTint = "#fff3c4";
    if (kind === "overlap") {
      browTint = "#ffd23f";
    }
    pen.fillStyle = browTint;
    pen.fillText("★  WELCOME TO " + place + "  ★", midX, y + h * 0.12);
  }

  // Main title — gradient fill, thick black outline, hard shadow.
  // (textAlign is set here, not in the eyebrow block above, because hero
  // mode skips the eyebrow — a one-word title must still centre.)
  pen.textAlign = "center";
  pen.textBaseline = "alphabetic";
  // Hero and chaos mode: the title must SPRAWL across the band like
  // the top-2 covers, not sit in the middle — so it is sized tall,
  // then stretched horizontally (glyph scale, capped) with the
  // remaining width taken up by letter tracking. Short titles like
  // PALM HEAT would otherwise occupy only half the band. Chaos
  // sprawls a touch wider (0.88) and taller (0.72) than hero — its
  // title crashes over photos.
  let capPx;
  if (kind === "chaos") {
    capPx = 0.72 * h;
  } else if (kind === "hero") {
    capPx = h * 0.66;
  } else {
    capPx = Math.min(h * 0.52, w * 0.52);
  }
  const px = fitTitleFont(pen, mastText, w - 2 * inset, capPx);
  let yPos;
  if (kind === "hero") {
    yPos = 0.58;
  } else if (kind === "chaos") {
    yPos = 0.52;
  } else if (script !== "") {
    yPos = 0.6;
  } else {
    yPos = 0.64;
  }
  const baseY = y + h * yPos;
  const grad = pen.createLinearGradient(0, baseY - px, 0, baseY + px * 0.12);
  paintStops(grad, [[0, "#ffe14d"], [0.5, "#ff9a2f"], [1, "#ff2e7e"]]);
  pen.font = px + "px Anton, sans-serif";
  pen.lineJoin = "round";
  let rim = 0.11;
  if (kind === "hero") {
    rim = 0.13;
  }
  pen.lineWidth = Math.max(3, px * rim);
  pen.strokeStyle = "#14041f";
  // Hero and chaos mode: a magenta drop shadow behind the black
  // outline, the way the top covers' titles lift off the band (or off
  // the photos).
  if (kind === "chaos" || kind === "hero") {
    // v5: deeper than v4 (0.55/0.10/0.06) — #1's title shadow sits
    // visibly deeper than ours; the title stays fully readable.
    pen.shadowColor = "rgba(255,46,126,0.8)";
    pen.shadowBlur = px * 0.14;
    pen.shadowOffsetY = px * 0.08;
  } else {
    pen.shadowColor = "rgba(20,4,31,0.65)";
    pen.shadowBlur = px * 0.08;
    pen.shadowOffsetY = px * 0.05;
  }
  let wide = 1;
  let track = 0;
  if (kind === "hero" || kind === "chaos") {
    const rawW = pen.measureText(mastText).width;
    let aim = 0.85;
    if (kind === "chaos") {
      aim = 0.88;
    }
    const wantW = w * aim;
    wide = Math.min(wantW / Math.max(1, rawW), 1.15);
    const span = mastText.length - 1;
    const spare = wantW - rawW * wide;
    track = Math.max(0, spare / Math.max(1, span));
    pen.save(); // title stretch
    pen.translate(midX, 0);
    pen.scale(wide, 1);
    pen.translate(-midX, 0);
    pen.letterSpacing = track + "px";
  }
  // Hero and chaos mode with a multi-word title: draw word by word, so
  // the gap between words is a controlled 2x tracking, not the space
  // advance plus tracking (which leaves a canyon between PALM and HEAT).
  if ((kind === "hero" || kind === "chaos") && mastText.indexOf(" ") !== -1) {
    const parts = mastText.split(" ");
    const partWidths = parts.map((word) => pen.measureText(word).width);
    // Word gap is just the space advance plus a little tracking — the
    // 2x tracking gap left a canyon between PALM and HEAT; #2's
    // SUNSET HEIST sits tight, about a third of a letter wide.
    const wordGap = px * 0.1 + track;
    const sum = partWidths.reduce((acc, ww) => acc + ww, (parts.length - 1) * wordGap);
    pen.textAlign = "left";
    const startAt = midX - sum / 2;
    drawWords(pen, parts, partWidths, wordGap, startAt, baseY, "strokeText");
    pen.fillStyle = grad;
    drawWords(pen, parts, partWidths, wordGap, startAt, baseY, "fillText");
    pen.textAlign = "center";
  } else {
    pen.strokeText(mastText, midX, baseY);
    pen.fillStyle = grad;
    pen.fillText(mastText, midX, baseY);
  }
  if (kind === "hero" || kind === "chaos") {
    pen.restore(); // title stretch done
    pen.letterSpacing = "0px";
  }
  pen.shadowColor = "transparent";
  pen.shadowBlur = 0;
  pen.shadowOffsetY = 0;

  // Neon script subtitle — on a solid dark plate in overlap mode, so
  // it never sits directly on a busy photo. Chaos mode skips the
  // plate: its subtitle sits on the dark end of the scrim like
  // do-tinh's "Neon Tide", white with a hot-pink glow.
  if (script !== "") {
    let scriptPx;
    if (kind === "chaos") {
      scriptPx = Math.min(w * 0.075, h * 0.17, px * 0.38);
    } else if (kind === "hero") {
      scriptPx = Math.min(w * 0.08, h * 0.17, px * 0.4);
    } else {
      scriptPx = Math.min(w * 0.085, h * 0.17, px * 0.42);
    }
    let scriptY = 0.8;
    if (kind === "hero") {
      scriptY = 0.85;
    }
    const scriptTop = y + h * scriptY;
    pen.font = scriptPx + "px Pacifico, cursive";
    if (kind === "overlap") {
      const plateW = Math.min(pen.measureText(script).width + scriptPx * 1.1, w * 0.92);
      roundRectPath(pen, midX - plateW / 2, scriptTop - scriptPx * 0.72, plateW, scriptPx * 1.15, scriptPx * 0.32);
      pen.fillStyle = "rgba(16,2,26,0.82)";
      pen.fill();
    }
    let tint = "#ffffff";
    if (kind === "chaos") {
      tint = "#ff5da2";
    }
    pen.fillStyle = tint;
    pen.shadowColor = "#ff2e9e";
    pen.shadowBlur = scriptPx * 0.5;
    pen.fillText(script, midX, scriptTop);
    pen.shadowBlur = 0;
  }

  // Tagline + HEAT stars live in the bottom strip in hero and chaos
  // mode (the title zone is full — title + script fill it); other
  // modes keep them inside the block as before.
  if (kind !== "hero" && kind !== "chaos") {
    const tagTop = y + h * (script !== "" ? 0.9 : 0.85);
    if (slogan !== "") {
      const tagPx = Math.max(11, Math.min(h * 0.07, w * 0.032));
      pen.font = tagPx + "px Anton, sans-serif";
      pen.fillStyle = "#ffffff";
      pen.fillText(slogan, midX, tagTop);
    }
    // Gold stars vanish on the orange hero band, so the hero band gets
    // dark stars with a light outline instead.
    const hot = doc.heat ?? 5;
    drawHeatStars(pen, midX, y + h * 0.965, Math.max(12, h * 0.07), hot, "#ffd23f", "#14041f");
  }
  pen.restore(); // title block done
}

// The bottom strip (hero mode): a thin magenta-gradient band below
// the title, carrying dark palm silhouettes, the tagline, fine print
// and a barcode — the foot furniture every top-5 cover has.
export function drawBottomStrip(pen, rect, doc) {
  const { x, y, w, h } = rect;
  const s = w / 1920;
  pen.save(); // bottom strip
  const grad = pen.createLinearGradient(x, y, x + w, y);
  paintStops(grad, [[0, "#ff2e7e"], [0.5, "#a01e68"], [1, "#ff2e7e"]]);
  pen.fillStyle = grad;
  pen.fillRect(x, y, w, h);
  // Palm silhouettes, clipped to the strip so fronds bleed off its edge
  // the way the top covers' palm strips do.
  pen.save(); // strip clip
  pen.beginPath();
  pen.rect(x, y, w, h);
  pen.clip();
  const palmS = (0.72 * h) / 110;
  const palmSpots = [[0.02, 1], [0.055, 0.8], [0.09, 0.6], [0.885, 0.7]];
  palmSpots.forEach(([fx, sc]) => {
    drawPalmSilhouette(pen, x + w * fx, y + h - 2, palmS * sc, "rgba(20,4,31,0.9)");
  });
  pen.restore(); // strip clip done
  // Tagline, centred, with the fine print under it.
  pen.textAlign = "center";
  pen.textBaseline = "alphabetic";
  const tagPx = Math.max(12, 0.3 * h);
  pen.font = tagPx + "px Anton, sans-serif";
  pen.fillStyle = "#ffffff";
  const slogan = doc.tagline ?? "";
  pen.fillText(slogan, x + w * 0.5, y + h * 0.42);
  const fullLine = "PALM HEAT — A PALM HEAT COVER STUDIO PICTURE · STARRING YOU · SHOT ON YOUR OWN CAMERA · GRADED BY HAND · LETTERING AND SEAL ORIGINAL";
  const briefLine = "PALM HEAT — A PALM HEAT COVER STUDIO PICTURE · STARRING YOU";
  // The fine print must fit between the palms and the barcode: on narrow
  // covers (portrait/square) the full line overflows both edges, so use
  // the short line and shrink until it fits the middle 70% of the strip.
  let line = briefLine;
  if (pen.measureText(fullLine).width <= w * 0.7) {
    line = fullLine;
  }
  let finePx = Math.max(8, h * 0.14);
  pen.font = finePx + "px sans-serif";
  for (; finePx > 7 && pen.measureText(line).width > w * 0.7; finePx -= 1) {
    pen.font = finePx + "px sans-serif";
  }
  pen.fillStyle = "rgba(255,255,255,0.82)";
  pen.fillText(line, x + w * 0.5, y + h * 0.78);
  // Barcode, far right.
  const barW = s * 88;
  const barH = h * 0.62;
  const barX = x + w - barW - s * 10;
  const barY = y + (h - barH) / 2;
  pen.fillStyle = "#ffffff";
  pen.fillRect(barX - s * 3, barY - s * 3, barW + s * 6, barH + s * 6);
  pen.fillStyle = "#14041f";
  let seed = 11;
  for (let bx = barX; bx < barX + barW - 2;) {
    seed = (7 + seed * 31) % 97;
    const bw = 1 + (seed % 3) * 1.4;
    if (seed % 3 !== 0) {
      pen.fillRect(bx, barY, bw, barH);
    }
    bx += bw + 1.8;
  }
  pen.restore(); // bottom strip done
}

// WANTED ★★★★★ pill on a photo panel's top-right corner (chaos mode),
// tilted slightly, like a stuck-on label.
export function drawWantedPill(pen, anchor, coverW) {
  const s = Math.max(coverW / 1920, 0.5);
  const px = Math.max(13, s * 24);
  drawPillRight(pen, anchor.x - s * 10, anchor.y + s * 10, "WANTED ★★★★★", "#14041f", "#ffd23f", px, { rot: -0.02, stroke: "#ffd23f" });
}

// VOL. 06 chip + COLLECTOR'S EDITION ribbon at the title zone's
// bottom-right (chaos mode), the way #2/#3 carry them.
export function drawVolCluster(pen, mastRect, doc) {
  const s = Math.max(mastRect.w / 1920, 0.5);
  const px = Math.max(13, s * 26);
  const topY = mastRect.y + mastRect.h * 0.86;
  const rightX = mastRect.x + mastRect.w - mastRect.w * 0.025;
  const leftX = drawPillRight(pen, rightX, topY, "VOL. 06", "#22d3ee", "#0b2a33", px, { square: true });
  drawPillRight(pen, leftX - s * 12, topY, "COLLECTOR'S EDITION", "#ff2e7e", "#ffffff", px, { square: true });
}

// A press-quote pill straddling the panel/title boundary (hero mode) —
// the top covers' star-quote strip, condensed into a pill so it never
// covers a face. The wording is original, not copied from any top entry.
export function drawQuotePill(pen, mastRect, doc) {
  const midX = mastRect.x + mastRect.w / 2;
  const topY = mastRect.y;
  const s = mastRect.w / 1920;
  const marks = "★★★★★";
  const quote = "‘THE CITY NEVER SLEEPS’ — THE CORAL HERALD";
  pen.save(); // quote pill
  const px = Math.max(12, s * 21);
  pen.font = px + "px Anton, sans-serif";
  const marksW = pen.measureText(marks).width;
  const quoteW = pen.measureText(quote).width;
  const sp = s * 10;
  const pd = s * 18;
  const pw = marksW + sp + quoteW + pd * 2;
  const ph = s * 42;
  roundRectPath(pen, midX - pw / 2, topY - ph / 2, pw, ph, ph / 2);
  pen.fillStyle = "#14041f";
  pen.fill();
  pen.lineWidth = Math.max(1.5, s * 2);
  pen.strokeStyle = "#ffd23f";
  pen.stroke();
  pen.textAlign = "left";
  pen.textBaseline = "middle";
  pen.fillStyle = "#ffd23f";
  pen.fillText(marks, midX - pw / 2 + pd, topY);
  pen.fillStyle = "#ffffff";
  pen.fillText(quote, midX - pw / 2 + pd + marksW + sp, topY);
  pen.restore(); // quote pill done
}

// A small location/time chip in a panel's bottom-left corner — the
// caption chips every top-5 cover puts on its panels. Panels too
// narrow to hold the chip are skipped rather than clipped.
export function drawPanelCaption(pen, cell, chip, coverW) {
  if (chip == null) {
    return; // no caption to draw
  }
  const s = Math.max(coverW / 1920, 0.5);
  const padX = s * 10;
  const padY = s * 7;
  const placePx = Math.max(11, s * 15);
  const linePx = Math.max(9, s * 11);
  const line2 = `${chip.time} · ${chip.line}`;
  pen.save(); // caption chip
  pen.textAlign = "left";
  pen.textBaseline = "alphabetic";
  pen.font = placePx + "px Anton, sans-serif";
  const placeW = pen.measureText(chip.place).width;
  pen.font = linePx + "px sans-serif";
  const lineW = pen.measureText(line2).width;
  const boxW = Math.max(lineW, placeW) + padX * 2;
  const boxH = padY * 2 + placePx + s * 4 + linePx;
  const boxX = cell.x + s * 8;
  const boxY = cell.y + cell.h - boxH - s * 8;
  const tooTall = boxH > cell.h - s * 16;
  const tooWide = boxW > cell.w - s * 16;
  if (tooTall || tooWide) {
    pen.restore(); // caption chip skipped
    return;
  }
  roundRectPath(pen, boxX, boxY, boxW, boxH, s * 4);
  pen.fillStyle = "rgba(12,2,20,0.85)";
  pen.fill();
  pen.fillStyle = "#ffffff";
  pen.font = placePx + "px Anton, sans-serif";
  pen.fillText(chip.place, boxX + padX, padY + boxY + placePx);
  pen.fillStyle = "#ffd7ef";
  pen.font = linePx + "px sans-serif";
  pen.fillText(line2, boxX + padX, padY + boxY + placePx + s * 4 + linePx);
  pen.restore(); // caption chip done
}

// Paints one photo panel (rotated, slanted, snapshot or plain) plus
// its black gutter edge. `done` is the graded image, or null when the
// photo failed to load.
function paintPanel(pen, cell, done, cw) {
  if (cell.rot !== undefined) {
    // Rotated photo card (chaos): clip to the panel rect in rotated
    // space and draw the graded image slightly oversized so the corners
    // stay covered after the rotation — the collage tilt of the top
    // covers. The black edge is stroked inside the same transform.
    pen.save(); // rotated panel
    pen.translate(cell.x + cell.w / 2, cell.y + cell.h / 2);
    pen.rotate(cell.rot);
    pen.beginPath();
    pen.rect(-cell.w / 2, -cell.h / 2, cell.w, cell.h);
    pen.clip();
    if (done !== null) {
      pen.drawImage(done, cell.w * -0.53, cell.h * -0.53, cell.w * 1.06, cell.h * 1.06);
    }
    pen.strokeStyle = "#0d0214";
    pen.lineWidth = (cw / 1920) * GUTTER;
    pen.strokeRect(-0.5 * cell.w, -0.5 * cell.h, cell.w, cell.h);
    pen.restore(); // rotated panel done
    return;
  }
  pen.save(); // plain panel
  if (cell.slant !== undefined) {
    // Diagonal panel: clip a parallelogram, draw the photo inside it.
    pen.beginPath();
    pen.moveTo(cell.x + cell.slant, cell.y);
    pen.lineTo(cell.x + cell.w, cell.y);
    pen.lineTo(cell.x + cell.w - cell.slant, cell.y + cell.h);
    pen.lineTo(cell.x, cell.y + cell.h);
    pen.closePath();
    pen.clip();
  } else if (cell.snap) {
    pen.translate(cell.x + cell.w / 2, cell.y + cell.h / 2);
    pen.rotate(-0.045);
    pen.translate(-cell.w / 2, -cell.h / 2);
  }
  if (done !== null) {
    if (cell.snap) {
      // White polaroid border around the snapshot.
      pen.fillStyle = "#ffffff";
      pen.fillRect(cell.w * -0.05, cell.h * -0.05, cell.w * 1.1, cell.h * 1.16);
      pen.drawImage(done, cell.w * -0.04, cell.h * -0.04, cell.w * 1.08, cell.h * 1.08);
    } else {
      pen.drawImage(done, cell.x, cell.y, cell.w, cell.h);
    }
  }
  pen.restore(); // plain panel done
  // Black gutter edge per panel.
  pen.save(); // gutter edge
  pen.strokeStyle = "#0d0214";
  pen.lineWidth = (cw / 1920) * GUTTER;
  pen.beginPath();
  pen.rect(cell.x, cell.y, cell.w, cell.h);
  pen.stroke();
  pen.restore(); // gutter edge done
}

/**
 * Paints the whole cover onto `pen` at the canvas's own size.
 * `doc` carries the layout, grade, texts, heat, assignments and the
 * photo images; `photos` is the array of loaded images, and the
 * assignments index into it.
 */
export function drawCoverGrid(canvas, doc, photos) {
  const cw = canvas.width;
  const ch = canvas.height;
  const pen = canvas.getContext("2d");
  pen.fillStyle = "#0d0214";
  pen.fillRect(0, 0, cw, ch);
  const lay = layoutPanels(cw, ch, doc.layout);
  const { tiles, mast, burst, foot, fugitive } = lay;
  const plan = doc.assignments[doc.layout];
  const slots = plan ?? [];
  const memo = new Map();
  function memoKey(pi, pw, ph, cr) {
    const focus = cr.fx.toFixed(2) + "," + cr.fy.toFixed(2) + "," + cr.zoom.toFixed(2);
    return [pi, pw + "x" + ph, focus].join("|");
  }

  for (let i = 0; i < tiles.length; i += 1) {
    const cell = tiles[i];
    const def = slots[i] ?? { fx: 0.5, fy: 0.4, photo: 0, zoom: 1 };
    // v5: per-ratio override — one crop cannot serve both the tall
    // portrait row and the short square row. A face that escapes the
    // title in portrait can sit fully behind the letters in square
    // (the face is at the top of its photo, the letters cover the top
    // of the panel, and the crop cannot push it below them). `sq`
    // replaces photo/crop for the square render only; landscape and
    // portrait are untouched by it.
    let cut = def;
    if (cw === ch && def.sq !== undefined) {
      cut = { ...def, ...def.sq };
    }
    const pic = photos[cut.photo] ?? photos[0];
    let done = null;
    if (pic !== undefined) {
      const key = memoKey(cut.photo, Math.round(cell.w), Math.round(cell.h), cut);
      done = memo.get(key);
      if (done === undefined) {
        // Grade at most ~760 px wide, then upscale — fast and smooth.
        const shrink = Math.min(760 / cell.w, 1);
        const gw = Math.max(2, shrink * cell.w);
        const gh = Math.max(2, shrink * cell.h);
        done = gradePanelImage(pic, gw, gh, cut, doc.grade);
        memo.set(key, done);
      }
    }
    paintPanel(pen, cell, done, cw);
    // Location/time caption chip in the panel's bottom-left corner
    // (hero mode + any layout that wants it; off when the editor
    // toggles captions off). In chaos mode a chip whose panel runs
    // deep under the title would sit under the dark scrim and turn
    // muddy — the top covers leave those panels clean — so skip it.
    const buried = doc.layout === "chaos" && mast.y + 60 < cell.y + cell.h;
    const showChip = doc.showCaptions !== false && buried === false;
    if (showChip) {
      const chips = doc.captions ?? [];
      const chip = chips[cut.photo] ?? { line: "SHOT ON YOUR CAMERA", place: "YOUR SHOT", time: "TONIGHT" };
      drawPanelCaption(pen, cell, chip, cw);
    }
  }

  // WANTED pill on the fisherman panel (chaos mode) — drawn on the
  // photo, before the title paints over the lower panels.
  if (doc.layout === "chaos" && fugitive !== undefined) {
    drawWantedPill(pen, fugitive, cw);
  }

  drawTitleBlock(pen, mast, doc);

  // Hero and chaos furniture: the bottom strip (palms + tagline +
  // fine print + barcode) and the press-quote pill on the panel/title
  // boundary. Chaos adds the VOL. 06 chip + COLLECTOR'S EDITION
  // ribbon. Other layouts keep the old barcode placement instead.
  const hasFoot = mast.kind === "hero" || mast.kind === "chaos";
  if (hasFoot && foot !== undefined) {
    drawBottomStrip(pen, foot, doc);
    drawQuotePill(pen, mast, doc);
  }
  if (mast.kind === "chaos") {
    drawVolCluster(pen, mast, doc);
  }

  // Poster furniture.
  const burstR = Math.max(cw * 0.038, 34);
  drawStarburstBadge(pen, burst.x, burst.y, burstR, "EST.", "2026");
  if (doc.showRibbon !== false) {
    pen.save(); // ribbon
    const ribbonW = cw * 0.2;
    const ribbonH = Math.max(ch * 0.035, 18);
    pen.fillStyle = "#ff2e7e";
    pen.fillRect(cw - ribbonW - (cw / 1920) * GUTTER, (cw / 1920) * GUTTER + ch * 0.02, ribbonW, ribbonH);
    pen.fillStyle = "#ffffff";
    pen.font = Math.max(11, ribbonH * 0.42) + "px Anton, sans-serif";
    pen.textAlign = "center";
    pen.textBaseline = "middle";
    pen.fillText("ORIGINAL · FAN MADE", cw - ribbonW / 2 - (cw / 1920) * GUTTER, (cw / 1920) * GUTTER + ribbonH / 2 + ch * 0.02);
    pen.restore(); // ribbon done
  }
  const wantBarcode = doc.showBarcode !== false && mast.kind !== "cell" && mast.kind !== "hero";
  if (wantBarcode) {
    const name = doc.title !== undefined && doc.title !== "" ? doc.title : "PALM HEAT";
    drawBarcode(pen, cw - cw * 0.09 - GUTTER, ch - 0.075 * ch, cw * 0.09, ch * 0.055, name);
  }
  return { panels: tiles, strip: foot, title: mast };
}

/** Renders the cover offscreen at an exact post size and hands back a PNG blob. */
export async function exportCoverPNG(doc, photos, sizeKey) {
  const size = EXPORT_SIZES[sizeKey];
  const cv = document.createElement("canvas");
  cv.width = size.w;
  cv.height = size.h;
  drawCoverGrid(cv, doc, photos);
  return new Promise((resolve) => cv.toBlob(resolve, "image/png"));
}
