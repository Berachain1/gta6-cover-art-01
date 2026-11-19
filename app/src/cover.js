// cover.js — paints the poster.
//
// drawCoverGrid draws a complete GTA-style cover onto any 2D canvas,
// whatever its size: a multi-panel photo grid with black gutters, a
// gradient-map or poster-ink grade on every panel, one huge gradient
// title block with a neon script subtitle underneath, and the poster
// furniture (starburst badge, HEAT stars, barcode, ORIGINAL ribbon).
// exportCoverPNG renders that same art offscreen at the exact post
// size and returns a PNG blob.
//
// The title block has four shapes: 'cell' (the title fills one grid
// cell), 'band' (a full-width band, used when portrait / square layouts
// re-flow), 'hero' (a full-width band whose title is stretched to
// sprawl across the whole width, like the top covers) and 'overlap'
// (the title floats over the panels). In overlap mode the letters sit
// on a dark scrim, and the script subtitle gets its own solid dark
// plate behind it — without that plate the subtitle can land on a
// bright, busy photo area and vanish, which is exactly what happens
// on the Tilted layout's lower panels.

import { gradePanelImage, drawCroppedPhoto } from "./grades.js";

let GUTTER = 10;

// Post sizes and their labels.
export const EXPORT_SIZES = {
  landscape: { w: 1920, h: 1080, label: "1920 × 1080" },
  portrait: { w: 1080, h: 1350, label: "1080 × 1350" },
  square: { w: 1080, h: 1080, label: "1080 × 1080" },
};

// Layout names for the editor picker.
export const LAYOUTS = {
  "full-bleed": "Full Bleed",
  tilted: "Tilted Snapshots",
  "hero-three": "Hero + Three",
  "vice-grid": "Vice Grid · 9-panel poster",
  "hero-vice": "Hero Vice · big-face hero + title band + strip",
  chaos: "Chaos Key-Art · tilted collage + title over photos",
};

// Grade names for the editor picker.
export const GRADES = {
  sunset: "Sunset",
  neon: "Neon Night",
  golden: "Golden Hour",
  ink: "Poster Ink",
};

/**
 * Panel geometry for a layout at (w, h). Returns { panels, title, badge }:
 * panels are {x, y, w, h} rects (optionally `slant` for diagonal cuts or
 * `snap` for a rotated polaroid); title is the title-block rect plus a
 * `mode` ('cell' | 'band' | 'overlap'); badge is the starburst position.
 */
export function layoutPanels(w, h, layout) {
  let gut = GUTTER * (w / 1920);
  let tall = h >= w;
  let panels = [];

  // hero-vice: one LARGE hero panel on the left (a big face, about
  // half the cover), a 2-stack middle column and a 3-stack right column
  // above it, a WIDE title band across the full width — 30%, the title
  // zone of the top covers, not a 42% flat slab — and a thin bottom
  // strip with palms, tagline, fine print, and barcode. The title
  // sprawls across the band the way the top-2 covers do; a press-quote
  // pill straddles the panel/title boundary, and every panel carries a
  // location/time caption chip.
  if (layout === "hero-vice") {
    let bandH = h * 0.3;
    let stripH = h * 0.075;
    let topH = h - bandH - stripH - gut * 4;
    let titleY = gut + topH + gut;
    let stripTop = titleY + bandH + gut;
    let strip = { x: gut, y: stripTop, w: w - gut * 2, h: h - stripTop - gut };
    if (tall) {
      let heroH = topH * 0.6;
      panels[panels.length] = { x: gut, y: gut, w: w - gut * 2, h: heroH };
      let colW = (w - gut * 4) / 3;
      let rowH = topH - heroH - gut;
      let c = 0;
      while (c < 3) {
        panels[panels.length] = { x: gut + c * (colW + gut), y: gut + heroH + gut, w: colW, h: rowH };
        c += 1;
      }
      return { // hero-vice, tall layout
        badge: { x: 76, y: 76 }, // hero-vice tall
        panels: panels,
        strip: strip,
        title: { x: gut, y: titleY, w: w - gut * 2, h: bandH, mode: "hero" }, // hero-vice tall
      };
    }
    let heroW = w * 0.46 - gut;
    let midW = w * 0.235 - gut;
    let rightW = w * 0.305 - gut * 2;
    let midLeft = gut + heroW + gut;
    let rightLeft = midLeft + midW + gut;
    panels[panels.length] = { x: gut, y: gut, w: heroW, h: topH };
    let midH = (topH - gut) / 2;
    panels[panels.length] = { x: midLeft, y: gut, w: midW, h: midH };
    panels[panels.length] = { x: midLeft, y: gut + midH + gut, w: midW, h: midH };
    let rowH = (topH - gut * 2) / 3;
    let r = 0;
    while (r < 3) {
      panels[panels.length] = { x: rightLeft, y: gut + r * (rowH + gut), w: rightW, h: rowH };
      r += 1;
    }
    return { // hero-vice, wide layout
      badge: { x: gut + 64, y: gut + 64 },
      panels: panels,
      strip: strip,
      title: { x: gut, y: titleY, w: w - gut * 2, h: bandH, mode: "hero" }, // hero-vice wide
    };
  }

  // chaos is the key-art collage of the top-3 covers. The photos run
  // the full height BEHIND the title — the title crashes OVER them
  // from about 50% down, like do-tinh's SUNSET STATE and ahmadfdn's
  // VICE STATE — and there is no title band at all. The hero panel's
  // right edge is a diagonal (slant), one mid panel and two right
  // panels are rotated a few degrees, and the starburst sits on a
  // panel junction instead of a corner. `wanted` is the top-right
  // anchor of the fisherman panel for the WANTED pill.
  if (layout === "chaos") {
    let stripH = h * 0.075;
    let stripTop = h - stripH - gut;
    let strip = { x: gut, y: stripTop, w: w - gut * 2, h: h - stripTop - gut };
    let titleH = h * 0.38;
    if (tall) {
      titleH = h * 0.34;
    }
    let title = { x: 0, y: h * 0.5, w, h: titleH, mode: "chaos" };
    if (tall) {
      let heroH = h * 0.44;
      panels[panels.length] = { x: gut, y: gut, w: w - gut * 2, h: heroH, slant: 30 };
      let colW = (w - gut * 4) / 3;
      // The row runs down to the photo bottom (0.88h) so photos fill
      // behind the title all the way to the strip — a short row left a
      // black scrim void under the title in portrait/square.
      let rowY = gut + heroH + gut;
      let rowH = h * 0.88 - rowY;
      panels[panels.length] = { x: gut, y: rowY, w: colW, h: rowH, rot: -0.02 };
      panels[panels.length] = { x: gut + colW + gut, y: rowY, w: colW, h: rowH };
      panels[panels.length] = { x: gut + 2 * (colW + gut), y: rowY, w: colW, h: rowH, rot: 0.025 };
      return { // chaos, tall layout
        badge: { x: w * 0.66, y: gut + heroH + gut },
        panels: panels,
        strip: strip,
        title: title,
        wanted: { x: gut + 3 * colW + gut * 2, y: rowY },
      };
    }
    let photoBase = h * 0.88;
    let topH = photoBase - gut;
    let heroW = w * 0.44 - gut;
    let midLeft = gut + heroW + gut;
    let midW = w * 0.24 - gut;
    let rightLeft = midLeft + midW + gut;
    let rightW = w - rightLeft - gut;
    panels[panels.length] = { x: gut, y: gut, w: heroW, h: topH, slant: 36 };
    let midH = (topH - gut) / 2;
    panels[panels.length] = { x: midLeft, y: gut, w: midW, h: midH, rot: 0.02 };
    panels[panels.length] = { x: midLeft, y: gut + midH + gut, w: midW, h: midH, rot: -0.015 };
    let rowH = (topH - gut * 2) / 3;
    panels[panels.length] = { x: rightLeft, y: gut, w: rightW, h: rowH, rot: -0.03 };
    panels[panels.length] = { x: rightLeft, y: gut + rowH + gut, w: rightW, h: rowH, rot: 0.025 };
    panels[panels.length] = { x: rightLeft, y: gut + 2 * (rowH + gut), w: rightW, h: rowH, rot: -0.02 };
    return { // chaos, wide layout
      // Starburst on the hero/mid-column junction up where no caption
      // chip lives (the old junction sat on the fisherman's chip), and
      // WANTED on the car panel's top-right — the fisherman panel's
      // top-right is under the ORIGINAL ribbon, which hid the pill.
      badge: { x: midLeft, y: topH * 0.22 },
      panels: panels,
      strip: strip,
      title: title,
      wanted: { x: rightLeft + rightW, y: gut + rowH + gut },
    };
  }

  if (layout === "vice-grid") {
    if (tall) {
      let colW = (w - gut * 3) / 2;
      let rowH = (h * 0.62 - gut * 4) / 3;
      let r = 0;
      while (r < 3) {
        let c = 0;
        while (c < 2) {
          panels[panels.length] = { x: gut + c * (colW + gut), y: gut + r * (rowH + gut), w: colW, h: rowH };
          c += 1;
        }
        r += 1;
      }
      let titleY = gut + 3 * (rowH + gut);
      return { // vice-grid, tall layout
        badge: { x: 76, y: 76 }, // vice-grid tall
        panels: panels,
        title: { x: gut, y: titleY, w: w - gut * 2, h: h - titleY - gut, mode: "band" },
      };
    }
    let colW = (w - gut * 4) / 3;
    let rowH = (h - gut * 4) / 3;
    let r = 0;
    while (r < 3) {
      let c = 0;
      while (c < 3) {
        if (r === 1 && c === 1) {
          // centre cell is the title block
        } else {
          panels[panels.length] = { x: gut + c * (colW + gut), y: gut + r * (rowH + gut), w: colW, h: rowH };
        }
        c += 1;
      }
      r += 1;
    }
    return { // vice-grid, wide layout
      badge: { x: gut + 64, y: gut + 64 },
      panels: panels,
      title: { x: gut + (colW + gut), y: gut + (rowH + gut), w: colW, h: rowH, mode: "cell" },
    };
  }

  if (layout === "hero-three") {
    if (tall) {
      let heroH = h * 0.44;
      panels[panels.length] = { x: gut, y: gut, w: w - gut * 2, h: heroH };
      let colW = (w - gut * 4) / 3;
      let rowH = h * 0.2;
      let c = 0;
      while (c < 3) {
        panels[panels.length] = { x: gut + c * (colW + gut), y: heroH + gut * 2, w: colW, h: rowH };
        c += 1;
      }
      let titleY = heroH + rowH + gut * 3;
      return { // hero-three, tall layout
        badge: { x: 76, y: 76 }, // hero-three tall
        panels: panels,
        title: { x: gut, y: titleY, w: w - gut * 2, h: h - titleY - gut, mode: "band" },
      };
    }
    let heroW = w * 0.56;
    panels[panels.length] = { x: gut, y: gut, w: heroW - gut, h: h - gut * 2 };
    let restW = w - heroW - gut * 2;
    let rowH = (h - gut * 4) / 3;
    let r = 0;
    while (r < 3) {
      panels[panels.length] = { x: heroW + gut, y: gut + r * (rowH + gut), w: restW, h: rowH };
      r += 1;
    }
    return { // hero-three, wide layout
      badge: { x: 78, y: 54 },
      panels: panels,
      title: { x: gut, y: h * 0.66, w: w - gut * 2, h: h * 0.34 - gut, mode: "overlap" },
    };
  }

  if (layout === "tilted") {
    if (tall) {
      let heroH = h * 0.4;
      panels[panels.length] = { x: gut, y: gut, w: w - gut * 2, h: heroH, slant: 40 };
      let colW = (w - gut * 3) / 2;
      let rowH = h * 0.24;
      panels[panels.length] = { x: gut, y: heroH + gut * 2, w: colW, h: rowH, slant: -30 };
      panels[panels.length] = { x: gut + colW + gut, y: heroH + gut * 2, w: colW, h: rowH, slant: 30 };
      let titleY = heroH + rowH + gut * 3;
      return { // tilted, tall layout
        badge: { x: 76, y: 76 }, // tilted tall
        panels: panels,
        title: { x: gut, y: titleY, w: w - gut * 2, h: h - titleY - gut, mode: "band" },
      };
    }
    let heroW = w * 0.5;
    panels[panels.length] = { x: gut, y: gut, w: heroW, h: h * 0.62, slant: 46 };
    panels[panels.length] = { x: heroW + gut, y: gut, w: w - heroW - gut * 2, h: h * 0.62, slant: -46 };
    let botW = (w - gut * 4) / 3;
    let c = 0;
    while (c < 3) {
      let slant = -26;
      if (c === 1) {
        slant = 0;
      } else if (c === 0) {
        slant = 26;
      }
      panels[panels.length] = { x: gut + c * (botW + gut), y: h * 0.62 + gut, w: botW, h: h * 0.38 - gut * 2, slant };
      c += 1;
    }
    return { // tilted, wide layout
      badge: { x: gut + 64, y: gut + 64 },
      panels: panels,
      title: { x: w * 0.22, y: h * 0.42, w: w * 0.56, h: h * 0.3, mode: "overlap" },
    };
  }

  // full-bleed: a single photo fills the frame, with snapshots floating on top.
  if (tall) {
    panels[panels.length] = { x: 0, y: 0, w, h: h * 0.72 };
    panels[panels.length] = { x: gut, y: h * 0.52, w: w * 0.42, h: h * 0.2, snap: true };
    return { // full-bleed, tall layout
      badge: { x: 76, y: 76 }, // full-bleed tall
      panels: panels,
      title: { x: 0, y: h * 0.72, w, h: h * 0.28, mode: "band" },
    };
  }
  panels[panels.length] = { x: 0, y: 0, w, h };
  panels[panels.length] = { x: w * 0.66, y: gut * 2, w: w * 0.3, h: h * 0.34, snap: true };
  panels[panels.length] = { x: w * 0.04, y: h * 0.06, w: w * 0.24, h: h * 0.3, snap: true };
  return { // full-bleed, wide layout
    badge: { x: w * 0.5, y: 60 },
    panels: panels,
    title: { x: 0, y: h * 0.6, w, h: h * 0.4, mode: "overlap" },
  };
}

/** The Anton size that fits `text` inside `limit`, shrinking 2 px at a time. */
export function fitTitleFont(ctx, text, limit, cap, face = "Anton") {
  let size = cap;
  ctx.font = size + "px " + face + ", sans-serif";
  while (size > 20 && ctx.measureText(text).width > limit) {
    size -= 2;
    ctx.font = size + "px " + face + ", sans-serif";
  }
  return size;
}

/** How many photo panels a layout has. */
export function panelCount(layout) {
  let counts = { "full-bleed": 3, tilted: 5, "hero-three": 4, "hero-vice": 6, "vice-grid": 8, chaos: 6 };
  let n = counts[layout];
  if (n === undefined) {
    n = 8;
  }
  return n;
}

/** A filled rounded-rectangle path (avoids any ctx.roundRect dependency). */
export function roundRectPath(ctx, x, y, w, h, corner) {
  let rad = Math.min(w / 2, h / 2, corner);
  ctx.beginPath();
  ctx.moveTo(x + rad, y);
  ctx.lineTo(x + w - rad, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + rad);
  ctx.lineTo(x + w, y + h - rad);
  ctx.quadraticCurveTo(x + w, y + h, x + w - rad, y + h);
  ctx.lineTo(x + rad, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - rad);
  ctx.lineTo(x, y + rad);
  ctx.quadraticCurveTo(x, y, x + rad, y);
  ctx.closePath();
}

/** A spiky starburst badge (EST. 2026 / NEW) with two lines of text. */
export function drawStarburstBadge(ctx, cx, cy, r, line1, line2) {
  ctx.save(); // starburst
  ctx.translate(cx, cy);
  ctx.beginPath();
  let points = 14;
  let i = 0;
  while (i < 2 * points) {
    let a = (i * Math.PI) / points - Math.PI / 2;
    let radius = r * 0.78;
    if (i % 2 === 0) {
      radius = r;
    }
    let px = Math.cos(a) * radius;
    let py = Math.sin(a) * radius;
    if (i === 0) {
      ctx.moveTo(px, py);
    } else {
      ctx.lineTo(px, py);
    }
    i += 1;
  }
  ctx.closePath();
  ctx.fillStyle = "#ffd23f";
  ctx.fill();
  ctx.lineWidth = Math.max(2, 0.07 * r);
  ctx.strokeStyle = "#14041f";
  ctx.stroke();
  ctx.fillStyle = "#14041f";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.font = r * 0.42 + "px Anton, sans-serif";
  ctx.fillText(line1, 0, r * -0.16);
  ctx.font = r * 0.26 + "px Anton, sans-serif";
  ctx.fillText(line2, 0, r * 0.24);
  ctx.restore(); // starburst done
}

/** Five HEAT stars, `heat` of them filled gold. */
export function drawHeatStars(ctx, cx, y, size, heat, fill = "#ffd23f", stroke = "#14041f") {
  ctx.save(); // heat stars
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.font = size + "px sans-serif";
  let pitch = size * 1.15;
  let firstX = cx - 2 * pitch;
  let i = 0;
  while (i < 5) {
    if (i < heat) {
      ctx.fillStyle = fill;
    } else {
      ctx.fillStyle = "rgba(255,255,255,0.28)";
    }
    ctx.strokeStyle = stroke;
    ctx.lineWidth = Math.max(1, 0.06 * size);
    let sx = firstX + i * pitch;
    ctx.strokeText("★", sx, y);
    ctx.fillText("★", sx, y);
    i += 1;
  }
  ctx.restore(); // heat stars done
}

/** A fake barcode strip, seeded by the title so it is stable per cover. */
export function drawBarcode(ctx, x, y, w, h, seedText) {
  ctx.save(); // barcode
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(x, y, w, h);
  let seed = 7;
  let si = 0;
  while (si < seedText.length) {
    seed = (seedText.charCodeAt(si) + 31 * seed) % 997;
    si += 1;
  }
  let cursorX = x + w * 0.04;
  let rnd = seed;
  ctx.fillStyle = "#14041f";
  while (cursorX < x + w * 0.96) {
    rnd = (rnd * 16807) % 2147483647;
    let barW = 1 + (rnd % 4) * (w / 220);
    if (rnd % 3 !== 0) {
      ctx.fillRect(cursorX, y + h * 0.08, barW, h * 0.72);
    }
    cursorX += barW + w / 220;
  }
  ctx.restore(); // barcode done
}

/** A simple palm silhouette: curved trunk plus drooping fronds. */
export function drawPalmSilhouette(ctx, x, y, scale, color) {
  ctx.save(); // palm
  ctx.translate(x, y);
  ctx.scale(scale, scale);
  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  ctx.lineWidth = 7;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.quadraticCurveTo(14, -60, 4, -110);
  ctx.stroke();
  let f = 0;
  while (f < 7) {
    let angle = (-160 + 52 * f) * (Math.PI / 180);
    ctx.beginPath();
    ctx.moveTo(4, -110);
    ctx.quadraticCurveTo(
      Math.cos(angle) * 55 + 4, Math.sin(angle) * 42 - 110,
      Math.cos(angle) * 88 + 4, Math.sin(angle) * 78 - 110,
    );
    ctx.stroke();
    f += 1;
  }
  ctx.restore(); // palm done
}

// A small pill label right-aligned to `edgeX`, top edge at `top` —
// it returns the pill's left edge so a second pill can sit beside it.
// This is the furniture the top-3 covers carry that v3 lacked: the
// cyan VOL. 06 chip and the pink COLLECTOR'S EDITION ribbon (#2/#3),
// and the dark WANTED pill with gold stars (#2/#3).
function drawPillRight(ctx, edgeX, top, text, bg, fg, fs, opt = {}) {
  ctx.save(); // pill
  ctx.font = fs + "px Anton, sans-serif";
  let textW = ctx.measureText(text).width;
  let padW = fs * 0.75;
  let pillW = textW + 2 * padW;
  let pillH = fs * 1.75;
  ctx.translate(edgeX - pillW * 0.5, top + pillH * 0.5);
  if (opt.rot !== undefined) {
    ctx.rotate(opt.rot);
  }
  let corner = pillH * 0.5;
  if (opt.square) {
    corner = Math.max(3, 0.15 * fs);
  }
  roundRectPath(ctx, pillW * -0.5, pillH * -0.5, pillW, pillH, corner);
  ctx.fillStyle = bg;
  ctx.fill();
  if (opt.stroke !== undefined) {
    ctx.lineWidth = Math.max(1.5, 0.09 * fs);
    ctx.strokeStyle = opt.stroke;
    ctx.stroke();
  }
  ctx.fillStyle = fg;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(text, 0, fs * 0.05);
  ctx.restore(); // pill done
  return edgeX - pillW;
}

/**
 * Draws the title block: a sunset-gradient panel holding an eyebrow
 * line, one huge gradient title (auto-fit, black outline), a neon
 * script subtitle, a tagline, and the HEAT stars.
 *
 * In overlap mode the block hovers over photos, so it first paints a
 * dark scrim and puts a solid dark plate behind the script subtitle.
 * Skip that plate and the subtitle can land on a bright, busy photo
 * patch and disappear — exactly what happens on the Tilted layout's
 * lower panels.
 */
export function drawTitleBlock(ctx, rect, state) {
  let { x, y, w, h } = rect;
  let mode = "cell";
  if (rect.mode !== undefined) {
    mode = rect.mode;
  }
  ctx.save(); // title block
  if (mode === "cell" || mode === "band" || mode === "hero") {
    let bg = ctx.createLinearGradient(x, y, x, y + h);
    // Deep magenta-purple at the top so the yellow title reads, warming
    // to pink, orange and amber at the bottom — the top-2 bands' shape.
    let heroStops = [[1, "#ffb03a"], [0.7, "#ff7a2f"], [0.35, "#ff2e7e"], [0, "#8a1c63"]];
    let bandStops = [[1, "#ffb03a"], [0.45, "#ff7a2f"], [0, "#ff2e7e"]];
    let stops = bandStops;
    if (mode === "hero") {
      stops = heroStops;
    }
    let s = 0;
    while (s < stops.length) {
      bg.addColorStop(stops[s][0], stops[s][1]);
      s += 1;
    }
    ctx.fillStyle = bg;
    ctx.fillRect(x, y, w, h);
    // Small sun disc tucked in the top-right corner, clear of the
    // lettering — except in hero mode, where the sprawling title leaves
    // no clear spot.
    if (mode !== "hero") {
      ctx.globalAlpha = 0.55;
      ctx.fillStyle = "#ffe9a8";
      ctx.beginPath();
      ctx.arc(x + w * 0.84, y + h * 0.2, Math.min(w, h) * 0.13, 0, 2 * Math.PI);
      ctx.fill();
      ctx.globalAlpha = 1;
    }
  } else {
    // Overlap: a scrim so the title stays readable over photos. Chaos
    // mode uses a MUCH lighter scrim than overlap — do-tinh's title sits
    // straight on bright photos with only its outline + shadow, and the
    // heavy scrim was drowning the lower panels in black.
    let scrim = ctx.createLinearGradient(x, y, x, y + h);
    let chaosStops = [[1, 0.55], [0.62, 0.38], [0.3, 0.18], [0, 0]];
    let plainStops = [[1, 0.9], [0.62, 0.78], [0.3, 0.5], [0, 0.05]];
    let stops = plainStops;
    if (mode === "chaos") {
      stops = chaosStops;
    }
    let s = 0;
    while (s < stops.length) {
      scrim.addColorStop(stops[s][0], "rgba(16,2,26," + stops[s][1] + ")");
      s += 1;
    }
    ctx.fillStyle = scrim;
    ctx.fillRect(x, y, w, h);
  }

  let pad = w * 0.04;
  let cx = x + w / 2;
  let titleText = "PALM HEAT";
  if (state.title !== undefined && state.title !== "") {
    titleText = state.title.toUpperCase();
  }
  let subtitle = "";
  if (state.subtitle !== undefined) {
    subtitle = state.subtitle;
  }
  let placeName = "CORAL BAY";
  if (state.place !== undefined && state.place !== "") {
    placeName = state.place.toUpperCase();
  }
  let taglineText = "";
  if (state.tagline !== undefined) {
    taglineText = state.tagline.toUpperCase();
  }

  // Eyebrow: WELCOME TO · PLACE. Hero and chaos mode skip it — the
  // enlarged title (caps + outline + shadow) reaches up into the
  // eyebrow line and paints over it; #1/#2 run a bare title band too.
  if (mode !== "hero" && mode !== "chaos") {
    ctx.textAlign = "center";
    ctx.textBaseline = "alphabetic";
    let browSize = Math.max(13, Math.min(w * 0.045, h * 0.11));
    ctx.font = browSize + "px Anton, sans-serif";
    let browColor = "#fff3c4";
    if (mode === "overlap") {
      browColor = "#ffd23f";
    }
    ctx.fillStyle = browColor;
    ctx.fillText("★  WELCOME TO " + placeName + "  ★", cx, y + h * 0.12);
  }

  // Main title — gradient fill, thick black outline, hard shadow.
  // (textAlign is set here, not in the eyebrow block above, because hero
  // mode skips the eyebrow — a one-word title must still centre.)
  ctx.textAlign = "center";
  ctx.textBaseline = "alphabetic";
  // Hero and chaos mode: the title must SPRAWL across the band like
  // the top-2 covers, not sit in the middle — so it is sized tall,
  // then stretched horizontally (glyph scale, capped) with the
  // remaining width taken up by letter tracking. Short titles like
  // PALM HEAT would otherwise occupy only half the band. Chaos
  // sprawls a touch wider (0.88) and taller (0.72) than hero — its
  // title crashes over photos.
  let capSize;
  if (mode === "chaos") {
    capSize = h * 0.72;
  } else if (mode === "hero") {
    capSize = h * 0.66;
  } else {
    capSize = Math.min(h * 0.52, w * 0.52);
  }
  let px = fitTitleFont(ctx, titleText, w - 2 * pad, capSize);
  let frac = 0.64;
  if (subtitle !== "") {
    frac = 0.6;
  }
  if (mode === "hero") {
    frac = 0.58;
  } else if (mode === "chaos") {
    frac = 0.52;
  }
  let titleY = y + frac * h;
  let fill = ctx.createLinearGradient(0, titleY - px, 0, titleY + px * 0.12);
  let titleStops = [[1, "#ff2e7e"], [0.5, "#ff9a2f"], [0, "#ffe14d"]];
  let s = 0;
  while (s < titleStops.length) {
    fill.addColorStop(titleStops[s][0], titleStops[s][1]);
    s += 1;
  }
  ctx.font = px + "px Anton, sans-serif";
  ctx.lineJoin = "round";
  let outlineW = 0.11;
  if (mode === "hero") {
    outlineW = 0.13;
  }
  ctx.lineWidth = Math.max(3, px * outlineW);
  ctx.strokeStyle = "#14041f";
  // Hero and chaos mode: a magenta drop shadow behind the black
  // outline, the way the top covers' titles lift off the band (or off
  // the photos).
  if (mode !== "chaos" && mode !== "hero") {
    ctx.shadowColor = "rgba(20,4,31,0.65)";
    ctx.shadowBlur = px * 0.08;
    ctx.shadowOffsetY = px * 0.05;
  } else {
    // v5: deeper than v4 (0.55/0.10/0.06) — #1's title shadow sits
    // visibly deeper than ours; the title stays fully readable.
    ctx.shadowColor = "rgba(255,46,126,0.8)";
    ctx.shadowBlur = px * 0.14;
    ctx.shadowOffsetY = px * 0.08;
  }
  let stretch = 1;
  let tracking = 0;
  if (mode === "hero" || mode === "chaos") {
    let rawW = ctx.measureText(titleText).width;
    let goalFrac = 0.85;
    if (mode === "chaos") {
      goalFrac = 0.88;
    }
    let goalW = w * goalFrac;
    stretch = Math.min(goalW / Math.max(1, rawW), 1.15);
    tracking = Math.max(0, (goalW - rawW * stretch) / Math.max(1, titleText.length - 1));
    ctx.save(); // title stretch
    ctx.translate(cx, 0);
    ctx.scale(stretch, 1);
    ctx.translate(-cx, 0);
    ctx.letterSpacing = tracking + "px";
  }
  // Hero and chaos mode with a multi-word title: draw word by word, so
  // the gap between words is a controlled 2x tracking, not the space
  // advance plus tracking (which leaves a canyon between PALM and HEAT).
  if ((mode === "hero" || mode === "chaos") && titleText.indexOf(" ") !== -1) {
    let words = titleText.split(" ");
    let wordWidths = [];
    let wi = 0;
    while (wi < words.length) {
      wordWidths[wordWidths.length] = ctx.measureText(words[wi]).width;
      wi += 1;
    }
    // Word gap is just the space advance plus a little tracking — the
    // 2x tracking gap left a canyon between PALM and HEAT; #2's
    // SUNSET HEIST sits tight, about a third of a letter wide.
    let wordGap = 0.1 * px + tracking;
    let totalW = (words.length - 1) * wordGap;
    wi = 0;
    while (wi < wordWidths.length) {
      totalW += wordWidths[wi];
      wi += 1;
    }
    ctx.textAlign = "left";
    let cursor = cx - totalW / 2;
    let i = 0;
    while (i < words.length) {
      ctx.strokeText(words[i], cursor, titleY);
      cursor += wordWidths[i] + wordGap;
      i += 1;
    }
    ctx.fillStyle = fill;
    cursor = cx - totalW / 2;
    i = 0;
    while (i < words.length) {
      ctx.fillText(words[i], cursor, titleY);
      cursor += wordWidths[i] + wordGap;
      i += 1;
    }
    ctx.textAlign = "center";
  } else {
    ctx.strokeText(titleText, cx, titleY);
    ctx.fillStyle = fill;
    ctx.fillText(titleText, cx, titleY);
  }
  if (mode === "hero" || mode === "chaos") {
    ctx.restore(); // title stretch done
    ctx.letterSpacing = "0px";
  }
  ctx.shadowColor = "transparent";
  ctx.shadowBlur = 0;
  ctx.shadowOffsetY = 0;

  // Neon script subtitle — on a solid dark plate in overlap mode, so
  // it never sits directly on a busy photo. Chaos mode skips the
  // plate: its subtitle sits on the dark end of the scrim like
  // do-tinh's "Neon Tide", white with a hot-pink glow.
  if (subtitle !== "") {
    let subPx = Math.min(w * 0.085, h * 0.17, px * 0.42);
    if (mode === "chaos") {
      subPx = Math.min(w * 0.075, h * 0.17, px * 0.38);
    } else if (mode === "hero") {
      subPx = Math.min(w * 0.08, h * 0.17, px * 0.4);
    }
    let subFrac = 0.8;
    if (mode === "hero") {
      subFrac = 0.85;
    }
    let subTop = y + h * subFrac;
    ctx.font = subPx + "px Pacifico, cursive";
    if (mode === "overlap") {
      let plateW = Math.min(w * 0.92, ctx.measureText(subtitle).width + subPx * 1.1);
      roundRectPath(ctx, cx - plateW / 2, subTop - subPx * 0.72, plateW, subPx * 1.15, subPx * 0.32);
      ctx.fillStyle = "rgba(16,2,26,0.82)";
      ctx.fill();
    }
    let subColor = "#ffffff";
    if (mode === "chaos") {
      subColor = "#ff5da2";
    }
    ctx.fillStyle = subColor;
    ctx.shadowColor = "#ff2e9e";
    ctx.shadowBlur = subPx * 0.5;
    ctx.fillText(subtitle, cx, subTop);
    ctx.shadowBlur = 0;
  }

  // Tagline + HEAT stars live in the bottom strip in hero and chaos
  // mode (the title zone is full — title + script fill it); other
  // modes keep them inside the block as before.
  if (mode !== "hero" && mode !== "chaos") {
    let tagTop = y + h * (subtitle !== "" ? 0.9 : 0.85);
    if (taglineText !== "") {
      let tagPx = Math.max(11, Math.min(w * 0.032, h * 0.07));
      ctx.font = tagPx + "px Anton, sans-serif";
      ctx.fillStyle = "#ffffff";
      ctx.fillText(taglineText, cx, tagTop);
    }
    // Gold stars vanish on the orange hero band, so the hero band gets
    // dark stars with a light outline instead.
    let heat = 5;
    if (state.heat !== undefined) {
      heat = state.heat;
    }
    drawHeatStars(ctx, cx, y + h * 0.965, Math.max(12, h * 0.07), heat, "#ffd23f", "#14041f");
  }
  ctx.restore(); // title block done
}

// The bottom strip (hero mode): a thin magenta-gradient band under
// the title carrying dark palm silhouettes, the tagline, fine print
// and a barcode — the foot furniture every top-5 cover has.
export function drawBottomStrip(ctx, rect, state) {
  let { x, y, w, h } = rect;
  let scale = w / 1920;
  ctx.save(); // bottom strip
  let wash = ctx.createLinearGradient(x, y, x + w, y);
  let washStops = [[1, "#ff2e7e"], [0.5, "#a01e68"], [0, "#ff2e7e"]];
  let s = 0;
  while (s < washStops.length) {
    wash.addColorStop(washStops[s][0], washStops[s][1]);
    s += 1;
  }
  ctx.fillStyle = wash;
  ctx.fillRect(x, y, w, h);
  // Palm silhouettes, clipped to the strip so fronds bleed off its edge
  // the way the top covers' palm strips do.
  ctx.save(); // strip clip
  ctx.beginPath();
  ctx.rect(x, y, w, h);
  ctx.clip();
  let palmScale = (h * 0.72) / 110;
  drawPalmSilhouette(ctx, x + w * 0.02, y + h - 2, palmScale, "rgba(20,4,31,0.9)");
  drawPalmSilhouette(ctx, x + w * 0.055, y + h - 2, palmScale * 0.8, "rgba(20,4,31,0.9)");
  drawPalmSilhouette(ctx, x + w * 0.09, y + h - 2, palmScale * 0.6, "rgba(20,4,31,0.9)");
  drawPalmSilhouette(ctx, x + w * 0.885, y + h - 2, palmScale * 0.7, "rgba(20,4,31,0.9)");
  ctx.restore(); // strip clip done
  // Tagline, centred, with the fine print under it.
  ctx.textAlign = "center";
  ctx.textBaseline = "alphabetic";
  let tagPx = Math.max(12, h * 0.3);
  ctx.font = tagPx + "px Anton, sans-serif";
  ctx.fillStyle = "#ffffff";
  let stripTag = "";
  if (state.tagline !== undefined) {
    stripTag = state.tagline;
  }
  ctx.fillText(stripTag, x + w * 0.5, y + h * 0.42);
  let fineLong = "PALM HEAT — A PALM HEAT COVER STUDIO PICTURE · STARRING YOU · SHOT ON YOUR OWN CAMERA · GRADED BY HAND · LETTERING AND SEAL ORIGINAL";
  let fineBrief = "PALM HEAT — A PALM HEAT COVER STUDIO PICTURE · STARRING YOU";
  // The fine print must fit between the palms and the barcode: on narrow
  // covers (portrait/square) the full line overflows both edges, so use
  // the short line and shrink until it fits the middle 70% of the strip.
  let finePx = Math.max(8, h * 0.14);
  ctx.font = finePx + "px sans-serif";
  let line = fineLong;
  if (ctx.measureText(line).width > w * 0.7) {
    line = fineBrief;
  }
  while (finePx > 7 && ctx.measureText(line).width > w * 0.7) {
    finePx -= 1;
    ctx.font = finePx + "px sans-serif";
  }
  ctx.fillStyle = "rgba(255,255,255,0.82)";
  ctx.fillText(line, x + w * 0.5, y + h * 0.78);
  // Barcode, far right.
  let codeW = scale * 88;
  let codeH = h * 0.62;
  let codeX = x + w - codeW - scale * 10;
  let codeY = y + (h - codeH) / 2;
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(codeX - scale * 3, codeY - scale * 3, codeW + scale * 6, codeH + scale * 6);
  ctx.fillStyle = "#14041f";
  let pen = codeX;
  let rnd = 11;
  while (pen < codeX + codeW - 2) {
    rnd = (7 + 31 * rnd) % 97;
    let stripeW = 1 + (rnd % 3) * 1.4;
    if (rnd % 3 !== 0) {
      ctx.fillRect(pen, codeY, stripeW, codeH);
    }
    pen += stripeW + 1.8;
  }
  ctx.restore(); // bottom strip done
}

// WANTED ★★★★★ pill on a photo panel's top-right corner (chaos mode),
// tilted a touch like a stuck-on label.
export function drawWantedPill(ctx, anchor, coverW) {
  let scale = Math.max(coverW / 1920, 0.5);
  let px = Math.max(13, scale * 24);
  drawPillRight(ctx, anchor.x - scale * 10, anchor.y + scale * 10, "WANTED ★★★★★", "#14041f", "#ffd23f", px, { rot: -0.02, stroke: "#ffd23f" });
}

// VOL. 06 chip + COLLECTOR'S EDITION ribbon at the title zone's
// bottom-right (chaos mode), the way #2/#3 carry them.
export function drawVolCluster(ctx, titleRect, state) {
  let scale = Math.max(titleRect.w / 1920, 0.5);
  let px = Math.max(13, scale * 26);
  let top = titleRect.y + titleRect.h * 0.86;
  let edge = titleRect.x + titleRect.w - titleRect.w * 0.025;
  let volEdge = drawPillRight(ctx, edge, top, "VOL. 06", "#22d3ee", "#0b2a33", px, { square: true });
  drawPillRight(ctx, volEdge - scale * 12, top, "COLLECTOR'S EDITION", "#ff2e7e", "#ffffff", px, { square: true });
}

// A press-quote pill straddling the panel/title boundary (hero mode) —
// the top covers' star-quote strip, condensed into a pill so it never
// covers a face. The wording is original, not copied from any top entry.
export function drawQuotePill(ctx, titleRect, state) {
  let cx = titleRect.x + titleRect.w / 2;
  let edgeY = titleRect.y;
  let scale = titleRect.w / 1920;
  let mark = "★★★★★";
  let quote = "‘THE CITY NEVER SLEEPS’ — THE CORAL HERALD";
  ctx.save(); // quote pill
  let px = Math.max(12, scale * 21);
  ctx.font = px + "px Anton, sans-serif";
  let markW = ctx.measureText(mark).width;
  let quoteW = ctx.measureText(quote).width;
  let gap = scale * 10;
  let pad = scale * 18;
  let pillW = markW + gap + quoteW + 2 * pad;
  let pillH = scale * 42;
  roundRectPath(ctx, cx - pillW * 0.5, edgeY - pillH * 0.5, pillW, pillH, pillH * 0.5);
  ctx.fillStyle = "#14041f";
  ctx.fill();
  ctx.lineWidth = Math.max(1.5, 2 * scale);
  ctx.strokeStyle = "#ffd23f";
  ctx.stroke();
  ctx.textAlign = "left";
  ctx.textBaseline = "middle";
  ctx.fillStyle = "#ffd23f";
  ctx.fillText(mark, cx - pillW * 0.5 + pad, edgeY);
  ctx.fillStyle = "#ffffff";
  ctx.fillText(quote, cx - pillW * 0.5 + pad + markW + gap, edgeY);
  ctx.restore(); // quote pill done
}

// A small location/time chip in a panel's bottom-left corner — the
// caption chips every top-5 cover puts on its panels. Panels too
// narrow to hold the chip are skipped rather than clipped.
export function drawPanelCaption(ctx, p, cap, coverW) {
  if (cap === null || cap === undefined) {
    return; // no caption to draw
  }
  let scale = Math.max(coverW / 1920, 0.5);
  let insetX = scale * 10;
  let insetY = scale * 7;
  let placeSize = Math.max(11, 15 * scale);
  let lineSize = Math.max(9, 11 * scale);
  let second = cap.time + " · " + cap.line;
  ctx.save(); // caption chip
  ctx.textAlign = "left";
  ctx.textBaseline = "alphabetic";
  ctx.font = placeSize + "px Anton, sans-serif";
  let placeW = ctx.measureText(cap.place).width;
  ctx.font = lineSize + "px sans-serif";
  let lineW = ctx.measureText(second).width;
  let boxW = Math.max(lineW, placeW) + 2 * insetX;
  let boxH = 2 * insetY + placeSize + 4 * scale + lineSize;
  let boxX = p.x + scale * 8;
  let boxY = p.y + p.h - boxH - scale * 8;
  if (boxH > p.h - scale * 16 || boxW > p.w - scale * 16) {
    ctx.restore(); // caption chip skipped
    return;
  }
  roundRectPath(ctx, boxX, boxY, boxW, boxH, scale * 4);
  ctx.fillStyle = "rgba(12,2,20,0.85)";
  ctx.fill();
  ctx.fillStyle = "#ffffff";
  ctx.font = placeSize + "px Anton, sans-serif";
  ctx.fillText(cap.place, boxX + insetX, insetY + boxY + placeSize);
  ctx.fillStyle = "#ffd7ef";
  ctx.font = lineSize + "px sans-serif";
  ctx.fillText(second, boxX + insetX, insetY + boxY + placeSize + 4 * scale + lineSize);
  ctx.restore(); // caption chip done
}

/**
 * Paints the whole cover onto `ctx` at the canvas's own size.
 * `state` holds the layout, grade, texts, heat, assignments and the
 * photo images; `photos` is the array of loaded images, and the
 * assignments index into it.
 */
export function drawCoverGrid(canvas, state, photos) {
  let w = canvas.width;
  let h = canvas.height;
  let ctx = canvas.getContext("2d");
  ctx.fillStyle = "#0d0214";
  ctx.fillRect(0, 0, w, h);
  let layout = layoutPanels(w, h, state.layout);
  let { panels, title, badge, strip, wanted } = layout;
  let layoutAssigns = state.assignments[state.layout];
  let assigns = [];
  if (layoutAssigns !== undefined) {
    assigns = layoutAssigns;
  }
  let graded = new Map();
  function cacheKey(pi, pw, ph, crop) {
    return pi + "|" + pw + "x" + ph + "|" + crop.fx.toFixed(2) + "," + crop.fy.toFixed(2) + "," + crop.zoom.toFixed(2);
  }

  let idx = 0;
  while (idx < panels.length) {
    let panel = panels[idx];
    let fallback = { photo: 0, fx: 0.5, fy: 0.4, zoom: 1 };
    let base = fallback;
    if (assigns[idx] !== undefined) {
      base = assigns[idx];
    }
    // v5: per-ratio override — one crop cannot serve both the tall
    // portrait row and the short square row. A face that escapes the
    // title in portrait can sit fully behind the letters in square
    // (the face is at the top of its photo, the letters cover the top
    // of the panel, and the crop cannot push it below them). `sq`
    // replaces photo/crop for the square render only; landscape and
    // portrait are untouched by it.
    let crop = base;
    if (w === h && base.sq !== undefined) {
      crop = { ...base, ...base.sq };
    }
    let photo = photos[0];
    if (photos[crop.photo] !== undefined) {
      photo = photos[crop.photo];
    }
    let layer = null;
    if (photo !== undefined) {
      let key = cacheKey(crop.photo, Math.round(panel.w), Math.round(panel.h), crop);
      layer = graded.get(key);
      if (layer === undefined) {
        // Grade at most ~760 px wide, then upscale — fast and smooth.
        let cap = 760;
        let factor = Math.min(cap / panel.w, 1);
        layer = gradePanelImage(photo, Math.max(factor * panel.w, 2), Math.max(factor * panel.h, 2), crop, state.grade);
        graded.set(key, layer);
      }
    }
    if (panel.rot !== undefined) {
      // Rotated photo card (chaos): clip to the panel rect in rotated
      // space and draw the graded image slightly oversized so the corners
      // stay covered after the rotation — the collage tilt of the top
      // covers. The black edge is stroked inside the same transform.
      ctx.save(); // rotated panel
      ctx.translate(panel.x + panel.w / 2, panel.y + panel.h / 2);
      ctx.rotate(panel.rot);
      ctx.beginPath();
      ctx.rect(-panel.w / 2, -panel.h / 2, panel.w, panel.h);
      ctx.clip();
      if (layer !== null) {
        ctx.drawImage(layer, -0.53 * panel.w, -0.53 * panel.h, 1.06 * panel.w, 1.06 * panel.h);
      }
      ctx.strokeStyle = "#0d0214";
      ctx.lineWidth = (w / 1920) * GUTTER;
      ctx.strokeRect(-0.5 * panel.w, -0.5 * panel.h, panel.w, panel.h);
      ctx.restore(); // rotated panel done
    } else {
      ctx.save(); // plain panel
      if (panel.slant !== undefined) {
        // Diagonal panel: clip a parallelogram, draw the photo inside it.
        ctx.beginPath();
        ctx.moveTo(panel.x + panel.slant, panel.y);
        ctx.lineTo(panel.x + panel.w, panel.y);
        ctx.lineTo(panel.x + panel.w - panel.slant, panel.y + panel.h);
        ctx.lineTo(panel.x, panel.y + panel.h);
        ctx.closePath();
        ctx.clip();
      } else if (panel.snap) {
        ctx.translate(panel.x + panel.w / 2, panel.y + panel.h / 2);
        ctx.rotate(-0.045);
        ctx.translate(-panel.w / 2, -panel.h / 2);
      }
      if (layer !== null) {
        let dx = 0;
        let dy = 0;
        let dw = panel.w;
        let dh = panel.h;
        if (panel.snap) {
          dx = -0.04 * panel.w;
          dy = -0.04 * panel.h;
          dw = 1.08 * panel.w;
          dh = 1.08 * panel.h;
          // White polaroid border around the snapshot.
          ctx.fillStyle = "#ffffff";
          ctx.fillRect(-0.05 * panel.w, -0.05 * panel.h, 1.1 * panel.w, 1.16 * panel.h);
          ctx.drawImage(layer, dx, dy, dw, dh);
        } else {
          ctx.drawImage(layer, panel.x, panel.y, panel.w, panel.h);
        }
      }
      ctx.restore(); // plain panel done
      // Black gutter edge per panel.
      ctx.save(); // gutter edge
      ctx.strokeStyle = "#0d0214";
      ctx.lineWidth = GUTTER * (w / 1920);
      ctx.beginPath();
      ctx.rect(panel.x, panel.y, panel.w, panel.h);
      ctx.stroke();
      ctx.restore(); // gutter edge done
    }
    // Location/time caption chip in the panel's bottom-left corner
    // (hero mode + any layout that wants it; off when the editor
    // toggles captions off). In chaos mode a chip whose panel runs
    // deep under the title would sit under the dark scrim and turn
    // muddy — the top covers leave those panels clean — so skip it.
    let hiddenByTitle = state.layout === "chaos" && panel.y + panel.h > title.y + 60;
    if (state.showCaptions !== false && hiddenByTitle === false) {
      let caps = [];
      if (state.captions !== undefined) {
        caps = state.captions;
      }
      let stored = caps[crop.photo];
      let caption = { place: "YOUR SHOT", time: "TONIGHT", line: "SHOT ON YOUR CAMERA" };
      if (stored !== undefined) {
        caption = stored;
      }
      drawPanelCaption(ctx, panel, caption, w);
    }
    idx += 1;
  }

  // WANTED pill on the fisherman panel (chaos mode) — drawn on the
  // photo, before the title paints over the lower panels.
  if (state.layout === "chaos" && wanted !== undefined) {
    drawWantedPill(ctx, wanted, w);
  }

  drawTitleBlock(ctx, title, state);

  // Hero and chaos furniture: the bottom strip (palms + tagline +
  // fine print + barcode) and the press-quote pill on the panel/title
  // boundary. Chaos adds the VOL. 06 chip + COLLECTOR'S EDITION
  // ribbon. Other layouts keep the old barcode placement instead.
  if ((title.mode === "hero" || title.mode === "chaos") && strip !== undefined) {
    drawBottomStrip(ctx, strip, state);
    drawQuotePill(ctx, title, state);
  }
  if (title.mode === "chaos") {
    drawVolCluster(ctx, title, state);
  }

  // Poster furniture.
  let badgeR = Math.max(34, w * 0.038);
  drawStarburstBadge(ctx, badge.x, badge.y, badgeR, "EST.", "2026");
  if (state.showRibbon !== false) {
    ctx.save(); // ribbon
    let ribbonW = w * 0.2;
    let ribbonH = Math.max(h * 0.035, 18);
    ctx.fillStyle = "#ff2e7e";
    ctx.fillRect(w - ribbonW - GUTTER * (w / 1920), GUTTER * (w / 1920) + h * 0.02, ribbonW, ribbonH);
    ctx.fillStyle = "#ffffff";
    ctx.font = Math.max(11, ribbonH * 0.42) + "px Anton, sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("ORIGINAL · FAN MADE", w - ribbonW * 0.5 - GUTTER * (w / 1920), GUTTER * (w / 1920) + h * 0.02 + ribbonH * 0.5);
    ctx.restore(); // ribbon done
  }
  if (state.showBarcode !== false && title.mode !== "cell" && title.mode !== "hero") {
    let barTitle = "PALM HEAT";
    if (state.title !== undefined && state.title !== "") {
      barTitle = state.title;
    }
    drawBarcode(ctx, w - w * 0.09 - GUTTER, h - h * 0.075, w * 0.09, h * 0.055, barTitle);
  }
  return { strip: strip, title: title, panels: panels };
}

/** Renders the cover offscreen at an exact post size and returns a PNG blob. */
export function exportCoverPNG(state, photos, sizeKey) {
  return new Promise((resolve) => {
    let dims = EXPORT_SIZES[sizeKey];
    let c = document.createElement("canvas");
    c.width = dims.w;
    c.height = dims.h;
    drawCoverGrid(c, state, photos);
    c.toBlob(resolve, "image/png");
  });
}
