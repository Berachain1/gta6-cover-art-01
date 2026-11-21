// cover.js — the poster painter.
//
// drawCoverGrid paints a whole GTA-style cover onto any 2D canvas, at
// any size: a multi-panel photo grid with black gutters, a gradient-map
// or poster-ink grade on every panel, one huge gradient title block
// with a neon script subtitle beneath it, and the poster furniture
// (starburst badge, HEAT stars, barcode, ORIGINAL ribbon).
// exportCoverPNG draws that same art offscreen at the exact post size
// and hands back a PNG blob.
//
// The title block comes in four shapes: 'cell' (the title fills a
// single grid cell), 'band' (a full-width band, used when portrait /
// square layouts re-flow), 'hero' (a full-width band whose title is
// stretched to sprawl across the whole width, like the top covers)
// and 'overlap' (the title floats over the panels). In overlap mode
// the letters sit on a dark scrim, and the script subtitle gets its own
// solid dark plate behind it — without that plate the subtitle can land
// on a bright, busy photo area and vanish, which is exactly what happens
// on the Tilted layout's lower panels.

import { gradePanelImage, drawCroppedPhoto } from "./grades.js";

const GUTTER = 10;

// Post sizes and their labels.
export const EXPORT_SIZES = {
  landscape: { h: 1080, w: 1920, label: "1920 × 1080" },
  portrait: { h: 1350, w: 1080, label: "1080 × 1350" },
  square: { h: 1080, w: 1080, label: "1080 × 1080" },
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

/**
 * Panel geometry for a layout at (w, h). Returns { panels, title, badge }:
 * panels are {x, y, w, h} rects (optionally `slant` for diagonal cuts or
 * `snap` for a rotated polaroid); title is the title-block rect plus a
 * `mode` ('cell' | 'band' | 'overlap'); badge is the starburst position.
 */
export function layoutPanels(w, h, layout) {
  const gap = (w / 1920) * GUTTER;
  const isTall = w <= h;
  const out = [];

  // hero-vice: one LARGE hero panel on the left (a big face, about
  // half the cover), a 2-stack middle column and a 3-stack right column
  // above it, a WIDE title band across the full width — 30%, the title
  // zone of the top covers, not a 42% flat slab — and a thin bottom
  // strip with palms, tagline, fine print, and barcode. The title
  // sprawls across the band the way the top-2 covers do; a press-quote
  // pill straddles the panel/title boundary, and every panel carries a
  // location/time caption chip.
  if (layout === "hero-vice") {
    const band = h * 0.3;
    const strip = h * 0.075;
    const top = h - band - strip - 4 * gap;
    const ty = gap + top + gap;
    const sy = ty + band + gap;
    const foot = { x: gap, y: sy, w: w - 2 * gap, h: h - sy - gap };
    if (isTall) {
      const hh = top * 0.6;
      out.push({ x: gap, y: gap, w: w - 2 * gap, h: hh });
      const cw = (w - 4 * gap) / 3;
      const rh = top - hh - gap;
      for (let c = 0; c < 3; c += 1) {
        out.push({ x: gap + c * (cw + gap), y: gap + hh + gap, w: cw, h: rh });
      }
      return { // hero-vice, tall layout
        badge: { x: 76, y: 76 }, // hero-vice tall
        panels: out,
        strip: foot,
        title: { x: gap, y: ty, w: w - 2 * gap, h: band, mode: "hero" }, // hero-vice tall
      };
    }
    const hw = 0.46 * w - gap;
    const mw = 0.235 * w - gap;
    const rw = 0.305 * w - 2 * gap;
    const ml = gap + hw + gap;
    const rl = ml + mw + gap;
    out.push({ x: gap, y: gap, w: hw, h: top });
    const mh = (top - gap) / 2;
    out.push({ x: ml, y: gap, w: mw, h: mh });
    out.push({ x: ml, y: gap + mh + gap, w: mw, h: mh });
    const rh = (top - 2 * gap) / 3;
    for (let r = 0; r < 3; r += 1) {
      out.push({ x: rl, y: gap + r * (rh + gap), w: rw, h: rh });
    }
    return { // hero-vice, wide layout
      badge: { x: gap + 64, y: gap + 64 },
      panels: out,
      strip: foot,
      title: { x: gap, y: ty, w: w - 2 * gap, h: band, mode: "hero" }, // hero-vice wide
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
    const strip = h * 0.075;
    const sy = h - strip - gap;
    const foot = { x: gap, y: sy, w: w - 2 * gap, h: h - sy - gap };
    let titleH = 0.38 * h;
    if (isTall) {
      titleH = 0.34 * h;
    }
    const title = { x: 0, y: 0.5 * h, w, h: titleH, mode: "chaos" };
    if (isTall) {
      const hh = 0.44 * h;
      out.push({ x: gap, y: gap, w: w - 2 * gap, h: hh, slant: 30 });
      const cw = (w - 4 * gap) / 3;
      // The row runs down to the photo bottom (0.88h) so photos fill
      // behind the title all the way to the strip — a short row left a
      // black scrim void under the title in portrait/square.
      const ry = gap + hh + gap;
      const rh = 0.88 * h - ry;
      out.push({ x: gap, y: ry, w: cw, h: rh, rot: -0.02 });
      out.push({ x: gap + cw + gap, y: ry, w: cw, h: rh });
      out.push({ x: gap + 2 * (cw + gap), y: ry, w: cw, h: rh, rot: 0.025 });
      return { // chaos, tall layout
        badge: { x: 0.66 * w, y: gap + hh + gap },
        panels: out,
        strip: foot,
        title: title,
        wanted: { x: gap + 3 * cw + 2 * gap, y: ry },
      };
    }
    const photoBase = 0.88 * h;
    const top = photoBase - gap;
    const hw = 0.44 * w - gap;
    const ml = gap + hw + gap;
    const mw = 0.24 * w - gap;
    const rl = ml + mw + gap;
    const rw = w - rl - gap;
    out.push({ x: gap, y: gap, w: hw, h: top, slant: 36 });
    const mh = (top - gap) / 2;
    out.push({ x: ml, y: gap, w: mw, h: mh, rot: 0.02 });
    out.push({ x: ml, y: gap + mh + gap, w: mw, h: mh, rot: -0.015 });
    const rh = (top - 2 * gap) / 3;
    out.push({ x: rl, y: gap, w: rw, h: rh, rot: -0.03 });
    out.push({ x: rl, y: gap + rh + gap, w: rw, h: rh, rot: 0.025 });
    out.push({ x: rl, y: gap + 2 * (rh + gap), w: rw, h: rh, rot: -0.02 });
    return { // chaos, wide layout
      // Starburst on the hero/mid-column junction up where no caption
      // chip lives (the old junction sat on the fisherman's chip), and
      // WANTED on the car panel's top-right — the fisherman panel's
      // top-right is under the ORIGINAL ribbon, which hid the pill.
      badge: { x: ml, y: top * 0.22 },
      panels: out,
      strip: foot,
      title: title,
      wanted: { x: rl + rw, y: gap + rh + gap },
    };
  }

  if (layout === "vice-grid") {
    if (isTall) {
      const cw = (w - 3 * gap) / 2;
      const rh = (0.62 * h - 4 * gap) / 3;
      for (let r = 0; r < 3; r += 1) {
        for (let c = 0; c < 2; c += 1) {
          out.push({ x: gap + c * (cw + gap), y: gap + r * (rh + gap), w: cw, h: rh });
        }
      }
      const ty = gap + 3 * (rh + gap);
      return { // vice-grid, tall layout
        badge: { x: 76, y: 76 }, // vice-grid tall
        panels: out,
        title: { x: gap, y: ty, w: w - 2 * gap, h: h - ty - gap, mode: "band" },
      };
    }
    const cw = (w - 4 * gap) / 3;
    const rh = (h - 4 * gap) / 3;
    for (let r = 0; r < 3; r += 1) {
      for (let c = 0; c < 3; c += 1) {
        if (r === 1 && c === 1) {
          // centre cell is the title block
        } else {
          out.push({ x: gap + c * (cw + gap), y: gap + r * (rh + gap), w: cw, h: rh });
        }
      }
    }
    return { // vice-grid, wide layout
      badge: { x: gap + 64, y: gap + 64 },
      panels: out,
      title: { x: gap + (cw + gap), y: gap + (rh + gap), w: cw, h: rh, mode: "cell" },
    };
  }

  if (layout === "hero-three") {
    if (isTall) {
      const hh = 0.44 * h;
      out.push({ x: gap, y: gap, w: w - 2 * gap, h: hh });
      const cw = (w - 4 * gap) / 3;
      const rh = 0.2 * h;
      for (let c = 0; c < 3; c += 1) {
        out.push({ x: gap + c * (cw + gap), y: hh + 2 * gap, w: cw, h: rh });
      }
      const ty = hh + rh + 3 * gap;
      return { // hero-three, tall layout
        badge: { x: 76, y: 76 }, // hero-three tall
        panels: out,
        title: { x: gap, y: ty, w: w - 2 * gap, h: h - ty - gap, mode: "band" },
      };
    }
    const hw = 0.56 * w;
    out.push({ x: gap, y: gap, w: hw - gap, h: h - 2 * gap });
    const restW = w - hw - 2 * gap;
    const rh = (h - 4 * gap) / 3;
    for (let r = 0; r < 3; r += 1) {
      out.push({ x: hw + gap, y: gap + r * (rh + gap), w: restW, h: rh });
    }
    return { // hero-three, wide layout
      badge: { x: 78, y: 54 },
      panels: out,
      title: { x: gap, y: 0.66 * h, w: w - 2 * gap, h: 0.34 * h - gap, mode: "overlap" },
    };
  }

  if (layout === "tilted") {
    if (isTall) {
      const hh = 0.4 * h;
      out.push({ x: gap, y: gap, w: w - 2 * gap, h: hh, slant: 40 });
      const cw = (w - 3 * gap) / 2;
      const rh = 0.24 * h;
      out.push({ x: gap, y: hh + 2 * gap, w: cw, h: rh, slant: -30 });
      out.push({ x: gap + cw + gap, y: hh + 2 * gap, w: cw, h: rh, slant: 30 });
      const ty = hh + rh + 3 * gap;
      return { // tilted, tall layout
        badge: { x: 76, y: 76 }, // tilted tall
        panels: out,
        title: { x: gap, y: ty, w: w - 2 * gap, h: h - ty - gap, mode: "band" },
      };
    }
    const hw = 0.5 * w;
    out.push({ x: gap, y: gap, w: hw, h: 0.62 * h, slant: 46 });
    out.push({ x: hw + gap, y: gap, w: w - hw - 2 * gap, h: 0.62 * h, slant: -46 });
    const botW = (w - 4 * gap) / 3;
    for (let c = 0; c < 3; c += 1) {
      let slant = -26;
      if (c === 1) {
        slant = 0;
      } else if (c === 0) {
        slant = 26;
      }
      out.push({ x: gap + c * (botW + gap), y: 0.62 * h + gap, w: botW, h: 0.38 * h - 2 * gap, slant });
    }
    return { // tilted, wide layout
      badge: { x: gap + 64, y: gap + 64 },
      panels: out,
      title: { x: 0.22 * w, y: 0.42 * h, w: 0.56 * w, h: 0.3 * h, mode: "overlap" },
    };
  }

  // full-bleed: a single photo fills the frame, with snapshots floating on top.
  if (isTall) {
    out.push({ x: 0, y: 0, w, h: 0.72 * h });
    out.push({ x: gap, y: 0.52 * h, w: 0.42 * w, h: 0.2 * h, snap: true });
    return { // full-bleed, tall layout
      badge: { x: 76, y: 76 }, // full-bleed tall
      panels: out,
      title: { x: 0, y: 0.72 * h, w, h: 0.28 * h, mode: "band" },
    };
  }
  out.push({ x: 0, y: 0, w, h });
  out.push({ x: 0.66 * w, y: 2 * gap, w: 0.3 * w, h: 0.34 * h, snap: true });
  out.push({ x: 0.04 * w, y: 0.06 * h, w: 0.24 * w, h: 0.3 * h, snap: true });
  return { // full-bleed, wide layout
    badge: { x: 0.5 * w, y: 60 },
    panels: out,
    title: { x: 0, y: 0.6 * h, w, h: 0.4 * h, mode: "overlap" },
  };
}

/** The Anton size that fits `text` inside `limit`, shrinking 2 px at a time. */
export function fitTitleFont(ctx, text, limit, cap, face = "Anton") {
  let s = cap;
  ctx.font = s + "px " + face + ", sans-serif";
  while (ctx.measureText(text).width > limit && s > 20) {
    s -= 2;
    ctx.font = s + "px " + face + ", sans-serif";
  }
  return s;
}

/** How many photo panels a layout has. */
export function panelCount(layout) {
  const table = { chaos: 6, "hero-vice": 6, "vice-grid": 8, "hero-three": 4, tilted: 5, "full-bleed": 3 };
  return table[layout] ?? 8;
}

/** A filled rounded-rectangle path (avoids any ctx.roundRect dependency). */
export function roundRectPath(ctx, x, y, w, h, corner) {
  const r = Math.min(corner, h / 2, w / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

/** A spiky starburst badge (EST. 2026 / NEW) with two lines of text. */
export function drawStarburstBadge(ctx, cx, cy, r, line1, line2) {
  ctx.save(); // starburst
  ctx.translate(cx, cy);
  ctx.beginPath();
  const spikes = 14;
  for (let i = 0; i < spikes * 2; i += 1) {
    const ang = (i / spikes - 0.5) * Math.PI;
    const rad = i % 2 === 0 ? r : 0.78 * r;
    const px = Math.cos(ang) * rad;
    const py = Math.sin(ang) * rad;
    if (i === 0) {
      ctx.moveTo(px, py);
    } else {
      ctx.lineTo(px, py);
    }
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
  ctx.font = 0.42 * r + "px Anton, sans-serif";
  ctx.fillText(line1, 0, -0.16 * r);
  ctx.font = 0.26 * r + "px Anton, sans-serif";
  ctx.fillText(line2, 0, 0.24 * r);
  ctx.restore(); // starburst done
}

/** Five HEAT stars, `heat` of them filled gold. */
export function drawHeatStars(ctx, cx, y, size, heat, fill = "#ffd23f", stroke = "#14041f") {
  ctx.save(); // heat stars
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.font = size + "px sans-serif";
  const step = 1.15 * size;
  const x0 = cx - 2 * step;
  for (let i = 0; i < 5; i += 1) {
    ctx.fillStyle = i < heat ? fill : "rgba(255,255,255,0.28)";
    ctx.strokeStyle = stroke;
    ctx.lineWidth = Math.max(1, 0.06 * size);
    const x = x0 + i * step;
    ctx.strokeText("★", x, y);
    ctx.fillText("★", x, y);
  }
  ctx.restore(); // heat stars done
}

/** A fake barcode strip, seeded by the title so it is stable per cover. */
export function drawBarcode(ctx, x, y, w, h, seedText) {
  ctx.save(); // barcode
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(x, y, w, h);
  let s = 7;
  for (let k = 0; k < seedText.length; k += 1) {
    s = (seedText.charCodeAt(k) + 31 * s) % 997;
  }
  let bw = 0;
  ctx.fillStyle = "#14041f";
  for (let cx = x + 0.04 * w, r = s; cx < x + 0.96 * w; cx += bw + w / 220) {
    r = (r * 16807) % 2147483647;
    bw = 1 + (r % 4) * (w / 220);
    if (r % 3 !== 0) {
      ctx.fillRect(cx, y + 0.08 * h, bw, 0.72 * h);
    }
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
  for (let k = 0; k < 7; k += 1) {
    const a = (52 * k - 160) * (Math.PI / 180);
    ctx.beginPath();
    ctx.moveTo(4, -110);
    ctx.quadraticCurveTo(
      Math.cos(a) * 55 + 4, Math.sin(a) * 42 - 110,
      Math.cos(a) * 88 + 4, Math.sin(a) * 78 - 110,
    );
    ctx.stroke();
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
  const tw = ctx.measureText(text).width;
  const pad = 0.75 * fs;
  const pw = tw + 2 * pad;
  const ph = 1.75 * fs;
  ctx.translate(edgeX - 0.5 * pw, top + 0.5 * ph);
  opt.rot !== undefined && ctx.rotate(opt.rot);
  const rad = opt.square ? Math.max(3, 0.15 * fs) : 0.5 * ph;
  roundRectPath(ctx, -0.5 * pw, -0.5 * ph, pw, ph, rad);
  ctx.fillStyle = bg;
  ctx.fill();
  if (opt.stroke) {
    ctx.lineWidth = Math.max(1.5, 0.09 * fs);
    ctx.strokeStyle = opt.stroke;
    ctx.stroke();
  }
  ctx.fillStyle = fg;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(text, 0, 0.05 * fs);
  ctx.restore(); // pill done
  return edgeX - pw;
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
  const { x, y, w, h } = rect;
  const mode = rect.mode ?? "cell";
  ctx.save(); // title block
  if (mode === "cell" || mode === "band" || mode === "hero") {
    const bg = ctx.createLinearGradient(x, y, x, y + h);
    // Deep magenta-purple at the top so the yellow title reads, warming
    // to pink, orange and amber at the bottom — the top-2 bands' shape.
    const heroStops = [{ at: 1, color: "#ffb03a" }, { at: 0.7, color: "#ff7a2f" }, { at: 0.35, color: "#ff2e7e" }, { at: 0, color: "#8a1c63" }];
    const bandStops = [{ at: 1, color: "#ffb03a" }, { at: 0.45, color: "#ff7a2f" }, { at: 0, color: "#ff2e7e" }];
    const stops = mode === "hero" ? heroStops : bandStops;
    for (const stop of stops) {
      bg.addColorStop(stop.at, stop.color);
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
      ctx.arc(x + 0.84 * w, y + 0.2 * h, 0.13 * Math.min(w, h), 0, 2 * Math.PI);
      ctx.fill();
      ctx.globalAlpha = 1;
    }
  } else {
    // Overlap: a scrim so the title stays readable over photos. Chaos
    // mode uses a MUCH lighter scrim than overlap — do-tinh's title sits
    // straight on bright photos with only its outline + shadow, and the
    // heavy scrim was drowning the lower panels in black.
    const scrim = ctx.createLinearGradient(x, y, x, y + h);
    const chaosStops = [{ at: 1, a: 0.55 }, { at: 0.62, a: 0.38 }, { at: 0.3, a: 0.18 }, { at: 0, a: 0 }];
    const plainStops = [{ at: 1, a: 0.9 }, { at: 0.62, a: 0.78 }, { at: 0.3, a: 0.5 }, { at: 0, a: 0.05 }];
    const stops = mode === "chaos" ? chaosStops : plainStops;
    for (const stop of stops) {
      scrim.addColorStop(stop.at, "rgba(16,2,26," + stop.a + ")");
    }
    ctx.fillStyle = scrim;
    ctx.fillRect(x, y, w, h);
  }

  const inset = 0.04 * w;
  const midX = x + w / 2;
  let title = "PALM HEAT";
  if (state.title !== undefined && state.title !== "") {
    title = state.title.toUpperCase();
  }
  let sub = "";
  if (state.subtitle !== undefined) {
    sub = state.subtitle;
  }
  let place = "CORAL BAY";
  if (state.place !== undefined && state.place !== "") {
    place = state.place.toUpperCase();
  }
  let tag = "";
  if (state.tagline !== undefined) {
    tag = state.tagline.toUpperCase();
  }

  // Eyebrow: WELCOME TO · PLACE. Hero and chaos mode skip it — the
  // enlarged title (caps + outline + shadow) reaches up into the
  // eyebrow line and paints over it; #1/#2 run a bare title band too.
  if (mode !== "hero" && mode !== "chaos") {
    ctx.textAlign = "center";
    ctx.textBaseline = "alphabetic";
    const brow = Math.max(13, Math.min(0.045 * w, 0.11 * h));
    ctx.font = brow + "px Anton, sans-serif";
    const browCol = mode === "overlap" ? "#ffd23f" : "#fff3c4";
    ctx.fillStyle = browCol;
    ctx.fillText("★  WELCOME TO " + place + "  ★", midX, y + 0.12 * h);
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
  const cap = mode === "chaos" ? 0.72 * h : mode === "hero" ? 0.66 * h : Math.min(0.52 * h, 0.52 * w);
  const size = fitTitleFont(ctx, title, w - 2 * inset, cap);
  const yFrac = mode === "hero" ? 0.58 : mode === "chaos" ? 0.52 : sub !== "" ? 0.6 : 0.64;
  const titleY = y + yFrac * h;
  const fill = ctx.createLinearGradient(0, titleY - size, 0, titleY + 0.12 * size);
  const titleStops = [{ at: 1, color: "#ff2e7e" }, { at: 0.5, color: "#ff9a2f" }, { at: 0, color: "#ffe14d" }];
  for (const stop of titleStops) {
    fill.addColorStop(stop.at, stop.color);
  }
  ctx.font = size + "px Anton, sans-serif";
  ctx.lineJoin = "round";
  const ow = mode === "hero" ? 0.13 : 0.11;
  ctx.lineWidth = Math.max(3, size * ow);
  ctx.strokeStyle = "#14041f";
  // Hero and chaos mode: a magenta drop shadow behind the black
  // outline, the way the top covers' titles lift off the band (or off
  // the photos).
  if (mode === "chaos" || mode === "hero") {
    // v5: deeper than v4 (0.55/0.10/0.06) — #1's title shadow sits
    // visibly deeper than ours; the title stays fully readable.
    ctx.shadowColor = "rgba(255,46,126,0.8)";
    ctx.shadowBlur = 0.14 * size;
    ctx.shadowOffsetY = 0.08 * size;
  } else {
    ctx.shadowColor = "rgba(20,4,31,0.65)";
    ctx.shadowBlur = 0.08 * size;
    ctx.shadowOffsetY = 0.05 * size;
  }
  let sx = 1;
  let track = 0;
  if (mode === "hero" || mode === "chaos") {
    const w0 = ctx.measureText(title).width;
    const gf = mode === "chaos" ? 0.88 : 0.85;
    const gw = w * gf;
    sx = Math.min(1.15, gw / Math.max(1, w0));
    track = Math.max(0, (gw - w0 * sx) / Math.max(1, title.length - 1));
    ctx.save(); // title stretch
    ctx.translate(midX, 0);
    ctx.scale(sx, 1);
    ctx.translate(-midX, 0);
    ctx.letterSpacing = track + "px";
  }
  // Hero and chaos mode with a multi-word title: draw word by word, so
  // the gap between words is a controlled 2x tracking, not the space
  // advance plus tracking (which leaves a canyon between PALM and HEAT).
  if ((mode === "hero" || mode === "chaos") && title.indexOf(" ") !== -1) {
    const words = title.split(" ");
    const wws = words.map((word) => ctx.measureText(word).width);
    // Word gap is just the space advance plus a little tracking — the
    // 2x tracking gap left a canyon between PALM and HEAT; #2's
    // SUNSET HEIST sits tight, about a third of a letter wide.
    const gap = 0.1 * size + track;
    const total = wws.reduce((sum, ww) => sum + ww, (words.length - 1) * gap);
    ctx.textAlign = "left";
    let cur = midX - total / 2;
    words.forEach((word, i) => {
      ctx.strokeText(word, cur, titleY);
      cur += wws[i] + gap;
    });
    ctx.fillStyle = fill;
    cur = midX - total / 2;
    words.forEach((word, i) => {
      ctx.fillText(word, cur, titleY);
      cur += wws[i] + gap;
    });
    ctx.textAlign = "center";
  } else {
    ctx.strokeText(title, midX, titleY);
    ctx.fillStyle = fill;
    ctx.fillText(title, midX, titleY);
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
  if (sub !== "") {
    const spx = mode === "chaos" ? Math.min(0.075 * w, 0.17 * h, 0.38 * size) : mode === "hero" ? Math.min(0.08 * w, 0.17 * h, 0.4 * size) : Math.min(0.085 * w, 0.17 * h, 0.42 * size);
    const sf = mode === "hero" ? 0.85 : 0.8;
    const sy = y + h * sf;
    ctx.font = spx + "px Pacifico, cursive";
    if (mode === "overlap") {
      const plateW = Math.min(ctx.measureText(sub).width + 1.1 * spx, 0.92 * w);
      roundRectPath(ctx, midX - plateW / 2, sy - 0.72 * spx, plateW, 1.15 * spx, 0.32 * spx);
      ctx.fillStyle = "rgba(16,2,26,0.82)";
      ctx.fill();
    }
    const subColor = mode === "chaos" ? "#ff5da2" : "#ffffff";
    ctx.fillStyle = subColor;
    ctx.shadowColor = "#ff2e9e";
    ctx.shadowBlur = 0.5 * spx;
    ctx.fillText(sub, midX, sy);
    ctx.shadowBlur = 0;
  }

  // Tagline + HEAT stars live in the bottom strip in hero and chaos
  // mode (the title zone is full — title + script fill it); other
  // modes keep them inside the block as before.
  if (mode !== "hero" && mode !== "chaos") {
    const ty = y + h * (sub !== "" ? 0.9 : 0.85);
    if (tag !== "") {
      const tpx = Math.max(11, Math.min(0.07 * h, 0.032 * w));
      ctx.font = tpx + "px Anton, sans-serif";
      ctx.fillStyle = "#ffffff";
      ctx.fillText(tag, midX, ty);
    }
    // Gold stars vanish on the orange hero band, so the hero band gets
    // dark stars with a light outline instead.
    const hv = state.heat ?? 5;
    drawHeatStars(ctx, midX, y + 0.965 * h, Math.max(12, 0.07 * h), hv, "#ffd23f", "#14041f");
  }
  ctx.restore(); // title block done
}

// The bottom strip (hero mode): a thin magenta-gradient band under
// the title carrying dark palm silhouettes, the tagline, fine print
// and a barcode — the foot furniture every top-5 cover has.
export function drawBottomStrip(ctx, rect, state) {
  const { x, y, w, h } = rect;
  const sc = w / 1920;
  ctx.save(); // bottom strip
  const bg = ctx.createLinearGradient(x, y, x + w, y);
  const stops = [{ at: 1, color: "#ff2e7e" }, { at: 0.5, color: "#a01e68" }, { at: 0, color: "#ff2e7e" }];
  for (const stop of stops) {
    bg.addColorStop(stop.at, stop.color);
  }
  ctx.fillStyle = bg;
  ctx.fillRect(x, y, w, h);
  // Palm silhouettes, clipped to the strip so fronds bleed off its edge
  // the way the top covers' palm strips do.
  ctx.save(); // strip clip
  ctx.beginPath();
  ctx.rect(x, y, w, h);
  ctx.clip();
  const ps = (0.72 * h) / 110;
  drawPalmSilhouette(ctx, x + 0.02 * w, y + h - 2, ps, "rgba(20,4,31,0.9)");
  drawPalmSilhouette(ctx, x + 0.055 * w, y + h - 2, 0.8 * ps, "rgba(20,4,31,0.9)");
  drawPalmSilhouette(ctx, x + 0.09 * w, y + h - 2, 0.6 * ps, "rgba(20,4,31,0.9)");
  drawPalmSilhouette(ctx, x + 0.885 * w, y + h - 2, 0.7 * ps, "rgba(20,4,31,0.9)");
  ctx.restore(); // strip clip done
  // Tagline, centred, with the fine print under it.
  ctx.textAlign = "center";
  ctx.textBaseline = "alphabetic";
  const tpx = Math.max(12, 0.3 * h);
  ctx.font = tpx + "px Anton, sans-serif";
  ctx.fillStyle = "#ffffff";
  const tag = state.tagline ?? "";
  ctx.fillText(tag, x + 0.5 * w, y + 0.42 * h);
  const long = "PALM HEAT — A PALM HEAT COVER STUDIO PICTURE · STARRING YOU · SHOT ON YOUR OWN CAMERA · GRADED BY HAND · LETTERING AND SEAL ORIGINAL";
  const short = "PALM HEAT — A PALM HEAT COVER STUDIO PICTURE · STARRING YOU";
  // The fine print must fit between the palms and the barcode: on narrow
  // covers (portrait/square) the full line overflows both edges, so use
  // the short line and shrink until it fits the middle 70% of the strip.
  const txt = ctx.measureText(long).width > 0.7 * w ? short : long;
  let fpx = Math.max(8, 0.14 * h);
  ctx.font = fpx + "px sans-serif";
  while (fpx > 7 && ctx.measureText(txt).width > 0.7 * w) {
    fpx -= 1;
    ctx.font = fpx + "px sans-serif";
  }
  ctx.fillStyle = "rgba(255,255,255,0.82)";
  ctx.fillText(txt, x + 0.5 * w, y + 0.78 * h);
  // Barcode, far right.
  const cw = 88 * sc;
  const ch = 0.62 * h;
  const cx = x + w - cw - 10 * sc;
  const cy = y + (h - ch) / 2;
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(cx - 3 * sc, cy - 3 * sc, cw + 6 * sc, ch + 6 * sc);
  ctx.fillStyle = "#14041f";
  let sw = 0;
  let pen = cx;
  let r = 11;
  while (pen < cx + cw - 2) {
    r = (7 + 31 * r) % 97;
    sw = 1 + (r % 3) * 1.4;
    if (r % 3 !== 0) {
      ctx.fillRect(pen, cy, sw, ch);
    }
    pen += sw + 1.8;
  }
  ctx.restore(); // bottom strip done
}

// WANTED ★★★★★ pill on a photo panel's top-right corner (chaos mode),
// tilted a touch like a stuck-on label.
export function drawWantedPill(ctx, anchor, coverW) {
  const sc = Math.max(coverW / 1920, 0.5);
  const size = Math.max(13, 24 * sc);
  drawPillRight(ctx, anchor.x - 10 * sc, anchor.y + 10 * sc, "WANTED ★★★★★", "#14041f", "#ffd23f", size, { rot: -0.02, stroke: "#ffd23f" });
}

// VOL. 06 chip + COLLECTOR'S EDITION ribbon at the title zone's
// bottom-right (chaos mode), the way #2/#3 carry them.
export function drawVolCluster(ctx, titleRect, state) {
  const sc = Math.max(titleRect.w / 1920, 0.5);
  const size = Math.max(13, 26 * sc);
  const y = titleRect.y + 0.86 * titleRect.h;
  const right = titleRect.x + titleRect.w - 0.025 * titleRect.w;
  const left = drawPillRight(ctx, right, y, "VOL. 06", "#22d3ee", "#0b2a33", size, { square: true });
  drawPillRight(ctx, left - 12 * sc, y, "COLLECTOR'S EDITION", "#ff2e7e", "#ffffff", size, { square: true });
}

// A press-quote pill straddling the panel/title boundary (hero mode) —
// the top covers' star-quote strip, condensed into a pill so it never
// covers a face. The wording is original, not copied from any top entry.
export function drawQuotePill(ctx, titleRect, state) {
  const mid = titleRect.x + titleRect.w / 2;
  const top = titleRect.y;
  const sc = titleRect.w / 1920;
  const stars = "★★★★★";
  const line = "‘THE CITY NEVER SLEEPS’ — THE CORAL HERALD";
  ctx.save(); // quote pill
  const size = Math.max(12, 21 * sc);
  ctx.font = size + "px Anton, sans-serif";
  const mw = ctx.measureText(stars).width;
  const qw = ctx.measureText(line).width;
  const g = 10 * sc;
  const p = 18 * sc;
  const pw = mw + g + qw + 2 * p;
  const ph = 42 * sc;
  roundRectPath(ctx, mid - 0.5 * pw, top - 0.5 * ph, pw, ph, 0.5 * ph);
  ctx.fillStyle = "#14041f";
  ctx.fill();
  ctx.lineWidth = Math.max(1.5, 2 * sc);
  ctx.strokeStyle = "#ffd23f";
  ctx.stroke();
  ctx.textAlign = "left";
  ctx.textBaseline = "middle";
  ctx.fillStyle = "#ffd23f";
  ctx.fillText(stars, mid - 0.5 * pw + p, top);
  ctx.fillStyle = "#ffffff";
  ctx.fillText(line, mid - 0.5 * pw + p + mw + g, top);
  ctx.restore(); // quote pill done
}

// A small location/time chip in a panel's bottom-left corner — the
// caption chips every top-5 cover puts on its panels. Panels too
// narrow to hold the chip are skipped rather than clipped.
export function drawPanelCaption(ctx, p, cap, coverW) {
  if (cap == null) {
    return; // no caption to draw
  }
  const sc = Math.max(coverW / 1920, 0.5);
  const ix = 10 * sc;
  const iy = 7 * sc;
  const ps = Math.max(11, 15 * sc);
  const ls = Math.max(9, 11 * sc);
  const sub = `${cap.time} · ${cap.line}`;
  ctx.save(); // caption chip
  ctx.textAlign = "left";
  ctx.textBaseline = "alphabetic";
  ctx.font = ps + "px Anton, sans-serif";
  const pw = ctx.measureText(cap.place).width;
  ctx.font = ls + "px sans-serif";
  const lw = ctx.measureText(sub).width;
  const bw = Math.max(lw, pw) + 2 * ix;
  const bh = 2 * iy + ps + 4 * sc + ls;
  const bx = p.x + 8 * sc;
  const by = p.y + p.h - bh - 8 * sc;
  if (bh > p.h - 16 * sc || bw > p.w - 16 * sc) {
    ctx.restore(); // caption chip skipped
    return;
  }
  roundRectPath(ctx, bx, by, bw, bh, 4 * sc);
  ctx.fillStyle = "rgba(12,2,20,0.85)";
  ctx.fill();
  ctx.fillStyle = "#ffffff";
  ctx.font = ps + "px Anton, sans-serif";
  ctx.fillText(cap.place, bx + ix, iy + by + ps);
  ctx.fillStyle = "#ffd7ef";
  ctx.font = ls + "px sans-serif";
  ctx.fillText(sub, bx + ix, iy + by + ps + 4 * sc + ls);
  ctx.restore(); // caption chip done
}

/**
 * Paints the whole cover onto `ctx` at the canvas's own size.
 * `state` holds the layout, grade, texts, heat, assignments and the
 * photo images; `photos` is the array of loaded images, and the
 * assignments index into it.
 */
export function drawCoverGrid(canvas, state, photos) {
  const cw = canvas.width;
  const ch = canvas.height;
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = "#0d0214";
  ctx.fillRect(0, 0, cw, ch);
  const geo = layoutPanels(cw, ch, state.layout);
  const { panels, title, badge, strip, wanted } = geo;
  const allCrops = state.assignments[state.layout];
  const crops = allCrops ?? [];
  const cache = new Map();
  function keyFor(pi, pw, ph, cr) {
    return `${pi}|${pw}x${ph}|${cr.fx.toFixed(2)},${cr.fy.toFixed(2)},${cr.zoom.toFixed(2)}`;
  }

  for (let pi = 0; pi < panels.length; pi += 1) {
    const p = panels[pi];
    const slot = crops[pi] ?? { photo: 0, fx: 0.5, fy: 0.4, zoom: 1 };
    // v5: per-ratio override — one crop cannot serve both the tall
    // portrait row and the short square row. A face that escapes the
    // title in portrait can sit fully behind the letters in square
    // (the face is at the top of its photo, the letters cover the top
    // of the panel, and the crop cannot push it below them). `sq`
    // replaces photo/crop for the square render only; landscape and
    // portrait are untouched by it.
    const cr = cw === ch && slot.sq !== undefined ? { ...slot, ...slot.sq } : slot;
    const img = photos[cr.photo] ?? photos[0];
    let lyr = null;
    if (img !== undefined) {
      const ck = keyFor(cr.photo, Math.round(p.w), Math.round(p.h), cr);
      lyr = cache.get(ck);
      if (lyr === undefined) {
        // Grade at most ~760 px wide, then upscale — fast and smooth.
        const factor = Math.min(760 / p.w, 1);
        lyr = gradePanelImage(img, Math.max(2, factor * p.w), Math.max(2, factor * p.h), cr, state.grade);
        cache.set(ck, lyr);
      }
    }
    if (p.rot !== undefined) {
      // Rotated photo card (chaos): clip to the panel rect in rotated
      // space and draw the graded image slightly oversized so the corners
      // stay covered after the rotation — the collage tilt of the top
      // covers. The black edge is stroked inside the same transform.
      ctx.save(); // rotated panel
      ctx.translate(p.x + p.w / 2, p.y + p.h / 2);
      ctx.rotate(p.rot);
      ctx.beginPath();
      ctx.rect(-p.w / 2, -p.h / 2, p.w, p.h);
      ctx.clip();
      if (lyr !== null) {
        ctx.drawImage(lyr, p.w * -0.53, p.h * -0.53, p.w * 1.06, p.h * 1.06);
      }
      ctx.strokeStyle = "#0d0214";
      ctx.lineWidth = (cw / 1920) * GUTTER;
      ctx.strokeRect(-0.5 * p.w, -0.5 * p.h, p.w, p.h);
      ctx.restore(); // rotated panel done
    } else {
      ctx.save(); // plain panel
      if (p.slant !== undefined) {
        // Diagonal panel: clip a parallelogram, draw the photo inside it.
        ctx.beginPath();
        ctx.moveTo(p.x + p.slant, p.y);
        ctx.lineTo(p.x + p.w, p.y);
        ctx.lineTo(p.x + p.w - p.slant, p.y + p.h);
        ctx.lineTo(p.x, p.y + p.h);
        ctx.closePath();
        ctx.clip();
      } else if (p.snap) {
        ctx.translate(p.x + p.w / 2, p.y + p.h / 2);
        ctx.rotate(-0.045);
        ctx.translate(-p.w / 2, -p.h / 2);
      }
      if (lyr !== null) {
        let dx = 0;
        let dy = 0;
        let dw = p.w;
        let dh = p.h;
        if (p.snap) {
          dx = p.w * -0.04;
          dy = p.h * -0.04;
          dw = p.w * 1.08;
          dh = p.h * 1.08;
          // White polaroid border around the snapshot.
          ctx.fillStyle = "#ffffff";
          ctx.fillRect(p.w * -0.05, p.h * -0.05, p.w * 1.1, p.h * 1.16);
          ctx.drawImage(lyr, dx, dy, dw, dh);
        } else {
          ctx.drawImage(lyr, p.x, p.y, p.w, p.h);
        }
      }
      ctx.restore(); // plain panel done
      // Black gutter edge per panel.
      ctx.save(); // gutter edge
      ctx.strokeStyle = "#0d0214";
      ctx.lineWidth = (cw / 1920) * GUTTER;
      ctx.beginPath();
      ctx.rect(p.x, p.y, p.w, p.h);
      ctx.stroke();
      ctx.restore(); // gutter edge done
    }
    // Location/time caption chip in the panel's bottom-left corner
    // (hero mode + any layout that wants it; off when the editor
    // toggles captions off). In chaos mode a chip whose panel runs
    // deep under the title would sit under the dark scrim and turn
    // muddy — the top covers leave those panels clean — so skip it.
    const underTitle = state.layout === "chaos" && title.y + 60 < p.y + p.h;
    if (state.showCaptions !== false && underTitle === false) {
      const list = state.captions ?? [];
      const cap = list[cr.photo] ?? { place: "YOUR SHOT", time: "TONIGHT", line: "SHOT ON YOUR CAMERA" };
      drawPanelCaption(ctx, p, cap, cw);
    }
  }

  // WANTED pill on the fisherman panel (chaos mode) — drawn on the
  // photo, before the title paints over the lower panels.
  if (state.layout === "chaos" && wanted !== undefined) {
    drawWantedPill(ctx, wanted, cw);
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
  const br = Math.max(0.038 * cw, 34);
  drawStarburstBadge(ctx, badge.x, badge.y, br, "EST.", "2026");
  if (state.showRibbon !== false) {
    ctx.save(); // ribbon
    const rw = 0.2 * cw;
    const rh = Math.max(0.035 * ch, 18);
    ctx.fillStyle = "#ff2e7e";
    ctx.fillRect(cw - rw - (cw / 1920) * GUTTER, (cw / 1920) * GUTTER + 0.02 * ch, rw, rh);
    ctx.fillStyle = "#ffffff";
    ctx.font = Math.max(0.42 * rh, 11) + "px Anton, sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("ORIGINAL · FAN MADE", cw - 0.5 * rw - (cw / 1920) * GUTTER, (cw / 1920) * GUTTER + 0.5 * rh + 0.02 * ch);
    ctx.restore(); // ribbon done
  }
  if (state.showBarcode !== false && title.mode !== "cell" && title.mode !== "hero") {
    const bt = state.title !== undefined && state.title !== "" ? state.title : "PALM HEAT";
    drawBarcode(ctx, cw - 0.09 * cw - GUTTER, ch - 0.075 * ch, 0.09 * cw, 0.055 * ch, bt);
  }
  return { strip: strip, title: title, panels: panels };
}

/** Renders the cover offscreen at an exact post size and returns a PNG blob. */
export function exportCoverPNG(state, photos, sizeKey) {
  return new Promise((resolve) => {
    const size = EXPORT_SIZES[sizeKey];
    const cv = document.createElement("canvas");
    cv.width = size.w;
    cv.height = size.h;
    drawCoverGrid(cv, state, photos);
    cv.toBlob(resolve, "image/png");
  });
}
