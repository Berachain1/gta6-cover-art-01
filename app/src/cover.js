// cover.js — paints the poster onto any 2D canvas.
//
// drawCoverGrid takes a canvas, the editor state and the loaded photos
// and paints a complete GTA-style cover: a multi-panel photo grid with
// black gutters, a gradient-map or poster-ink grade on every panel, one
// huge gradient title block with a neon script subtitle beneath it, and
// the poster furniture (starburst badge, HEAT stars, barcode, ORIGINAL
// ribbon). exportCoverPNG renders that same art offscreen at the exact
// post size and returns a PNG blob.
//
// The title block has four shapes. 'cell' fills one grid cell; 'band'
// is a full-width band (used when portrait / square layouts re-flow);
// 'hero' is a full-width band whose title stretches to sprawl across
// the whole width, like the top covers; 'overlap' floats the title over
// the panels. In overlap mode the letters sit on a dark scrim, and the
// script subtitle gets its own solid dark plate behind it — without
// that plate the subtitle can land on a bright, busy photo area and
// vanish, which is exactly what happens on the Tilted layout's lower
// panels.

import { gradePanelImage, drawCroppedPhoto } from "./grades.js";

const GUTTER = 10;

// Post sizes and their labels.
export const EXPORT_SIZES = {
  square: { h: 1080, label: "1080 × 1080", w: 1080 },
  portrait: { h: 1350, label: "1080 × 1350", w: 1080 },
  landscape: { h: 1080, label: "1920 × 1080", w: 1920 },
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
 * Panel geometry for a layout at (w, h). It returns { panels, title, badge }:
 * panels are {x, y, w, h} rects (optionally `slant` for diagonal cuts or
 * `snap` for a rotated polaroid); title is the title-block rect plus a
 * `mode` ('cell' | 'band' | 'overlap'); badge is where the starburst goes.
 */
export function layoutPanels(w, h, layout) {
  const gap = (w / 1920) * GUTTER;
  const isTall = w <= h;
  const panels = [];

  // hero-vice: one LARGE hero panel on the left (a big face, about half
  // the cover), a 2-stack middle column and a 3-stack right column above
  // it, a WIDE title band across the full width — 30%, the title zone of
  // the top covers, not a 42% flat slab — and a thin bottom strip with
  // palms, tagline, fine print, and barcode. The title sprawls across
  // the band the way the top-2 covers do; a press-quote pill straddles
  // the panel/title boundary, and every panel carries a location/time
  // caption chip.
  if (layout === "hero-vice") {
    const bandH = h * 0.3;
    const stripH = h * 0.075;
    const topH = h - bandH - stripH - 4 * gap;
    const ty = gap + topH + gap;
    const sy = ty + bandH + gap;
    const stripRect = { h: h - sy - gap, w: w - 2 * gap, x: gap, y: sy };
    if (isTall) {
      const heroHeight = topH * 0.6;
      panels.push({ h: heroHeight, w: w - 2 * gap, x: gap, y: gap });
      const colWidth = (w - 4 * gap) / 3;
      const rowHeight = topH - heroHeight - gap;
      for (let c = 0; c < 3; c += 1) {
        panels.push({ h: rowHeight, w: colWidth, x: gap + c * (colWidth + gap), y: gap + heroHeight + gap });
      }
      return { // hero-vice, tall layout
        badge: { x: 76, y: 76 }, // hero-vice tall
        panels,
        strip: stripRect,
        title: { h: bandH, mode: "hero", w: w - 2 * gap, x: gap, y: ty }, // hero-vice tall
      };
    }
    const heroWidth = 0.46 * w - gap;
    const midWidth = 0.235 * w - gap;
    const rightWidth = 0.305 * w - 2 * gap;
    const midLeft = gap + heroWidth + gap;
    const rightLeft = midLeft + midWidth + gap;
    panels.push({ h: topH, w: heroWidth, x: gap, y: gap });
    const midHeight = (topH - gap) / 2;
    panels.push({ h: midHeight, w: midWidth, x: midLeft, y: gap });
    panels.push({ h: midHeight, w: midWidth, x: midLeft, y: gap + midHeight + gap });
    const rowHeight = (topH - 2 * gap) / 3;
    for (let r = 0; r < 3; r += 1) {
      panels.push({ h: rowHeight, w: rightWidth, x: rightLeft, y: gap + r * (rowHeight + gap) });
    }
    return { // hero-vice, wide layout
      badge: { x: gap + 64, y: gap + 64 },
      panels,
      strip: stripRect,
      title: { h: bandH, mode: "hero", w: w - 2 * gap, x: gap, y: ty }, // hero-vice wide
    };
  }

  // chaos is the top-3 covers' key-art collage. Photos run the full
  // height BEHIND the title — the title crashes OVER them from about
  // 50% down, like do-tinh's SUNSET STATE and ahmadfdn's VICE STATE —
  // and there is no title band at all. The hero panel's right edge is
  // a diagonal (slant), one mid panel and two right panels are rotated
  // a few degrees, and the starburst sits on a panel junction instead
  // of a corner. `wanted` is the top-right anchor of the fisherman
  // panel for the WANTED pill.
  if (layout === "chaos") {
    const stripH = h * 0.075;
    const sy = h - stripH - gap;
    const stripRect = { h: h - sy - gap, w: w - 2 * gap, x: gap, y: sy };
    let titleH = 0.38 * h;
    if (isTall) {
      titleH = 0.34 * h;
    }
    const title = { h: titleH, mode: "chaos", w, x: 0, y: 0.5 * h };
    if (isTall) {
      const hh = 0.44 * h;
      panels.push({ h: hh, slant: 30, w: w - 2 * gap, x: gap, y: gap });
      const colWidth = (w - 4 * gap) / 3;
      // The row runs down to the photo bottom (0.88h) so photos fill
      // behind the title all the way to the strip — a short row left a
      // black scrim void under the title in portrait/square.
      const rowY = gap + hh + gap;
      const rowHeight = 0.88 * h - rowY;
      panels.push({ h: rowHeight, rot: -0.02, w: colWidth, x: gap, y: rowY });
      panels.push({ h: rowHeight, w: colWidth, x: gap + colWidth + gap, y: rowY });
      panels.push({ h: rowHeight, rot: 0.025, w: colWidth, x: gap + 2 * (colWidth + gap), y: rowY });
      return { // chaos, tall layout
        badge: { x: 0.66 * w, y: gap + hh + gap },
        panels,
        strip: stripRect,
        title,
        wanted: { x: gap + 3 * colWidth + 2 * gap, y: rowY },
      };
    }
    const base = 0.88 * h;
    const t = base - gap;
    const heroWidth = 0.44 * w - gap;
    const midLeft = gap + heroWidth + gap;
    const midWidth = 0.24 * w - gap;
    const rightLeft = midLeft + midWidth + gap;
    const rightWidth = w - rightLeft - gap;
    panels.push({ h: t, slant: 36, w: heroWidth, x: gap, y: gap });
    const midHeight = (t - gap) / 2;
    panels.push({ h: midHeight, rot: 0.02, w: midWidth, x: midLeft, y: gap });
    panels.push({ h: midHeight, rot: -0.015, w: midWidth, x: midLeft, y: gap + midHeight + gap });
    const rowHeight = (t - 2 * gap) / 3;
    panels.push({ h: rowHeight, rot: -0.03, w: rightWidth, x: rightLeft, y: gap });
    panels.push({ h: rowHeight, rot: 0.025, w: rightWidth, x: rightLeft, y: gap + rowHeight + gap });
    panels.push({ h: rowHeight, rot: -0.02, w: rightWidth, x: rightLeft, y: gap + 2 * (rowHeight + gap) });
    return { // chaos, wide layout
      // Starburst on the hero/mid-column junction up where no caption
      // chip lives (the old junction sat on the fisherman's chip), and
      // WANTED on the car panel's top-right — the fisherman panel's
      // top-right is under the ORIGINAL ribbon, which hid the pill.
      badge: { x: midLeft, y: t * 0.22 },
      panels,
      strip: stripRect,
      title,
      wanted: { x: rightLeft + rightWidth, y: gap + rowHeight + gap },
    };
  }

  if (layout === "vice-grid") {
    if (isTall) {
      const colWidth = (w - 3 * gap) / 2;
      const rowHeight = (0.62 * h - 4 * gap) / 3;
      for (let r = 0; r < 3; r += 1) {
        for (let c = 0; c < 2; c += 1) {
          panels.push({ h: rowHeight, w: colWidth, x: gap + c * (colWidth + gap), y: gap + r * (rowHeight + gap) });
        }
      }
      const ty = gap + 3 * (rowHeight + gap);
      return { // vice-grid, tall layout
        badge: { x: 76, y: 76 }, // vice-grid tall
        panels,
        title: { h: h - ty - gap, mode: "band", w: w - 2 * gap, x: gap, y: ty },
      };
    }
    const colWidth = (w - 4 * gap) / 3;
    const rowHeight = (h - 4 * gap) / 3;
    for (let r = 0; r < 3; r += 1) {
      for (let c = 0; c < 3; c += 1) {
        if (r === 1 && c === 1) {
          // centre cell is the title block
        } else {
          panels.push({ h: rowHeight, w: colWidth, x: gap + c * (colWidth + gap), y: gap + r * (rowHeight + gap) });
        }
      }
    }
    return { // vice-grid, wide layout
      badge: { x: gap + 64, y: gap + 64 },
      panels,
      title: { h: rowHeight, mode: "cell", w: colWidth, x: gap + (colWidth + gap), y: gap + (rowHeight + gap) },
    };
  }

  if (layout === "hero-three") {
    if (isTall) {
      const hh = 0.44 * h;
      panels.push({ h: hh, w: w - 2 * gap, x: gap, y: gap });
      const colWidth = (w - 4 * gap) / 3;
      const rowHeight = 0.2 * h;
      for (let c = 0; c < 3; c += 1) {
        panels.push({ h: rowHeight, w: colWidth, x: gap + c * (colWidth + gap), y: hh + 2 * gap });
      }
      const ty = hh + rowHeight + 3 * gap;
      return { // hero-three, tall layout
        badge: { x: 76, y: 76 }, // hero-three tall
        panels,
        title: { h: h - ty - gap, mode: "band", w: w - 2 * gap, x: gap, y: ty },
      };
    }
    const heroWidth = 0.56 * w;
    panels.push({ h: h - 2 * gap, w: heroWidth - gap, x: gap, y: gap });
    const restWidth = w - heroWidth - 2 * gap;
    const rowHeight = (h - 4 * gap) / 3;
    for (let r = 0; r < 3; r += 1) {
      panels.push({ h: rowHeight, w: restWidth, x: heroWidth + gap, y: gap + r * (rowHeight + gap) });
    }
    return { // hero-three, wide layout
      badge: { x: 78, y: 54 },
      panels,
      title: { h: 0.34 * h - gap, mode: "overlap", w: w - 2 * gap, x: gap, y: 0.66 * h },
    };
  }

  if (layout === "tilted") {
    if (isTall) {
      const hh = 0.4 * h;
      panels.push({ h: hh, slant: 40, w: w - 2 * gap, x: gap, y: gap });
      const colWidth = (w - 3 * gap) / 2;
      const rowHeight = 0.24 * h;
      panels.push({ h: rowHeight, slant: -30, w: colWidth, x: gap, y: hh + 2 * gap });
      panels.push({ h: rowHeight, slant: 30, w: colWidth, x: gap + colWidth + gap, y: hh + 2 * gap });
      const ty = hh + rowHeight + 3 * gap;
      return { // tilted, tall layout
        badge: { x: 76, y: 76 }, // tilted tall
        panels,
        title: { h: h - ty - gap, mode: "band", w: w - 2 * gap, x: gap, y: ty },
      };
    }
    const heroWidth = 0.5 * w;
    panels.push({ h: 0.62 * h, slant: 46, w: heroWidth, x: gap, y: gap });
    panels.push({ h: 0.62 * h, slant: -46, w: w - heroWidth - 2 * gap, x: heroWidth + gap, y: gap });
    const botWidth = (w - 4 * gap) / 3;
    for (let c = 0; c < 3; c += 1) {
      let slant = -26;
      if (c === 1) {
        slant = 0;
      } else if (c === 0) {
        slant = 26;
      }
      panels.push({ h: 0.38 * h - 2 * gap, slant, w: botWidth, x: gap + c * (botWidth + gap), y: 0.62 * h + gap });
    }
    return { // tilted, wide layout
      badge: { x: gap + 64, y: gap + 64 },
      panels,
      title: { h: 0.3 * h, mode: "overlap", w: 0.56 * w, x: 0.22 * w, y: 0.42 * h },
    };
  }

  // full-bleed: a single photo fills the frame, with snapshots floating on top.
  if (isTall) {
    panels.push({ h: 0.72 * h, w, x: 0, y: 0 });
    panels.push({ h: 0.2 * h, snap: true, w: 0.42 * w, x: gap, y: 0.52 * h });
    return { // full-bleed, tall layout
      badge: { x: 76, y: 76 }, // full-bleed tall
      panels,
      title: { h: 0.28 * h, mode: "band", w, x: 0, y: 0.72 * h },
    };
  }
  panels.push({ h, w, x: 0, y: 0 });
  panels.push({ h: 0.34 * h, snap: true, w: 0.3 * w, x: 0.66 * w, y: 2 * gap });
  panels.push({ h: 0.3 * h, snap: true, w: 0.24 * w, x: 0.04 * w, y: 0.06 * h });
  return { // full-bleed, wide layout
    badge: { x: 0.5 * w, y: 60 },
    panels,
    title: { h: 0.4 * h, mode: "overlap", w, x: 0, y: 0.6 * h },
  };
}

/** The Anton size that fits `text` inside `limit`, shrinking 2 px at a time. */
export function fitTitleFont(ctx, text, limit, max, face = "Anton") {
  let px = max;
  ctx.font = px + "px " + face + ", sans-serif";
  while (ctx.measureText(text).width > limit && px > 20) {
    px -= 2;
    ctx.font = px + "px " + face + ", sans-serif";
  }
  return px;
}

/** How many photo panels a layout has. */
export function panelCount(layout) {
  const byLayout = { chaos: 6, "hero-vice": 6, "vice-grid": 8, "hero-three": 4, tilted: 5, "full-bleed": 3 };
  return byLayout[layout] ?? 8;
}

/** A filled rounded-rectangle path (avoids any ctx.roundRect dependency). */
export function roundRectPath(ctx, x, y, w, h, radius) {
  const r = Math.min(radius, w / 2, h / 2);
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
    const angle = (i / spikes - 0.5) * Math.PI;
    const dist = i % 2 === 0 ? r : r * 0.78;
    const x = Math.cos(angle) * dist;
    const y = Math.sin(angle) * dist;
    if (i === 0) {
      ctx.moveTo(x, y);
    } else {
      ctx.lineTo(x, y);
    }
  }
  ctx.closePath();
  ctx.fillStyle = "#ffd23f";
  ctx.fill();
  ctx.lineWidth = Math.max(2, r * 0.07);
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
  const step = size * 1.15;
  const firstX = cx - 2 * step;
  for (let i = 0; i < 5; i += 1) {
    ctx.fillStyle = i < heat ? fill : "rgba(255,255,255,0.28)";
    ctx.strokeStyle = stroke;
    ctx.lineWidth = Math.max(1, size * 0.06);
    const x = firstX + i * step;
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
  for (let i = 0; i < seedText.length; i += 1) {
    s = (seedText.charCodeAt(i) + s * 31) % 997;
  }
  let bw = 0;
  ctx.fillStyle = "#14041f";
  for (let bx = x + w * 0.04, n = s; bx < x + w * 0.96; bx += bw + w / 220) {
    n = (n * 16807) % 2147483647;
    bw = 1 + (n % 4) * (w / 220);
    if (n % 3 !== 0) {
      ctx.fillRect(bx, y + h * 0.08, bw, h * 0.72);
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
  for (let i = 0; i < 7; i += 1) {
    const angle = (i * 52 - 160) * (Math.PI / 180);
    ctx.beginPath();
    ctx.moveTo(4, -110);
    ctx.quadraticCurveTo(
      Math.cos(angle) * 55 + 4, Math.sin(angle) * 42 - 110,
      Math.cos(angle) * 88 + 4, Math.sin(angle) * 78 - 110,
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
function drawPillRight(ctx, edgeX, top, text, bg, fg, fs, o = {}) {
  ctx.save(); // pill
  ctx.font = fs + "px Anton, sans-serif";
  const textW = ctx.measureText(text).width;
  const pad = fs * 0.75;
  const w = textW + pad * 2;
  const h = fs * 1.75;
  ctx.translate(edgeX - w / 2, top + h / 2);
  o.rot !== undefined && ctx.rotate(o.rot);
  const radius = o.square ? Math.max(3, fs * 0.15) : h / 2;
  roundRectPath(ctx, -w / 2, -h / 2, w, h, radius);
  ctx.fillStyle = bg;
  ctx.fill();
  if (o.stroke) {
    ctx.lineWidth = Math.max(1.5, fs * 0.09);
    ctx.strokeStyle = o.stroke;
    ctx.stroke();
  }
  ctx.fillStyle = fg;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(text, 0, fs * 0.05);
  ctx.restore(); // pill done
  return edgeX - w;
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
export function drawTitleBlock(ctx, rect, state) {
  const { x, y, w, h } = rect;
  const mode = rect.mode ?? "cell";
  ctx.save(); // title block
  if (mode === "cell" || mode === "band" || mode === "hero") {
    const bg = ctx.createLinearGradient(x, y, x, y + h);
    // Deep magenta-purple at the top so the yellow title reads, warming
    // to pink, orange and amber at the bottom — the top-2 bands' shape.
    const heroStops = [{ at: 0, color: "#8a1c63" }, { at: 0.35, color: "#ff2e7e" }, { at: 0.7, color: "#ff7a2f" }, { at: 1, color: "#ffb03a" }];
    const bandStops = [{ at: 0, color: "#ff2e7e" }, { at: 0.45, color: "#ff7a2f" }, { at: 1, color: "#ffb03a" }];
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
      ctx.arc(x + w * 0.84, y + h * 0.2, Math.min(w, h) * 0.13, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
    }
  } else {
    // Overlap: a scrim so the title stays readable over photos. Chaos
    // mode uses a MUCH lighter scrim than overlap — do-tinh's title sits
    // straight on bright photos with only its outline + shadow, and the
    // heavy scrim was drowning the lower panels in black.
    const scrim = ctx.createLinearGradient(x, y, x, y + h);
    const chaosStops = [{ at: 0, a: 0 }, { at: 0.3, a: 0.18 }, { at: 0.62, a: 0.38 }, { at: 1, a: 0.55 }];
    const plainStops = [{ at: 0, a: 0.05 }, { at: 0.3, a: 0.5 }, { at: 0.62, a: 0.78 }, { at: 1, a: 0.9 }];
    const stops = mode === "chaos" ? chaosStops : plainStops;
    for (const stop of stops) {
      scrim.addColorStop(stop.at, "rgba(16,2,26," + stop.a + ")");
    }
    ctx.fillStyle = scrim;
    ctx.fillRect(x, y, w, h);
  }

  const inset = w * 0.04;
  const centerX = x + w / 2;
  let titleText = "PALM HEAT";
  if (state.title !== undefined && state.title !== "") {
    titleText = state.title.toUpperCase();
  }
  let sub = "";
  if (state.subtitle !== undefined) {
    sub = state.subtitle;
  }
  let placeName = "CORAL BAY";
  if (state.place !== undefined && state.place !== "") {
    placeName = state.place.toUpperCase();
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
    const browSize = Math.max(13, Math.min(w * 0.045, h * 0.11));
    ctx.font = browSize + "px Anton, sans-serif";
    const browColor = mode === "overlap" ? "#ffd23f" : "#fff3c4";
    ctx.fillStyle = browColor;
    ctx.fillText("★  WELCOME TO " + placeName + "  ★", centerX, y + h * 0.12);
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
  const capSize = mode === "chaos" ? h * 0.72 : mode === "hero" ? h * 0.66 : Math.min(h * 0.52, w * 0.52);
  const size = fitTitleFont(ctx, titleText, w - 2 * inset, capSize);
  const yFrac = mode === "hero" ? 0.58 : mode === "chaos" ? 0.52 : sub !== "" ? 0.6 : 0.64;
  const baselineY = y + h * yFrac;
  const fill = ctx.createLinearGradient(0, baselineY - size, 0, baselineY + size * 0.12);
  const tStops = [{ at: 0, color: "#ffe14d" }, { at: 0.5, color: "#ff9a2f" }, { at: 1, color: "#ff2e7e" }];
  for (const stop of tStops) {
    fill.addColorStop(stop.at, stop.color);
  }
  ctx.font = size + "px Anton, sans-serif";
  ctx.lineJoin = "round";
  const outline = mode === "hero" ? 0.13 : 0.11;
  ctx.lineWidth = Math.max(3, size * outline);
  ctx.strokeStyle = "#14041f";
  // Hero and chaos mode: a magenta drop shadow behind the black
  // outline, the way the top covers' titles lift off the band (or off
  // the photos).
  if (mode === "chaos" || mode === "hero") {
    // v5: deeper than v4 (0.55/0.10/0.06) — #1's title shadow sits
    // visibly deeper than ours; the title stays fully readable.
    ctx.shadowColor = "rgba(255,46,126,0.8)";
    ctx.shadowBlur = size * 0.14;
    ctx.shadowOffsetY = size * 0.08;
  } else {
    ctx.shadowColor = "rgba(20,4,31,0.65)";
    ctx.shadowBlur = size * 0.08;
    ctx.shadowOffsetY = size * 0.05;
  }
  let stretch = 1;
  let tracking = 0;
  if (mode === "hero" || mode === "chaos") {
    const naturalW = ctx.measureText(titleText).width;
    const goal = mode === "chaos" ? 0.88 : 0.85;
    const targetW = w * goal;
    stretch = Math.min(1.15, targetW / Math.max(1, naturalW));
    tracking = Math.max(0, (targetW - naturalW * stretch) / Math.max(1, titleText.length - 1));
    ctx.save(); // title stretch
    ctx.translate(centerX, 0);
    ctx.scale(stretch, 1);
    ctx.translate(-centerX, 0);
    ctx.letterSpacing = tracking + "px";
  }
  // Hero and chaos mode with a multi-word title: draw word by word, so
  // the gap between words is a controlled 2x tracking, not the space
  // advance plus tracking (which leaves a canyon between PALM and HEAT).
  if ((mode === "hero" || mode === "chaos") && titleText.indexOf(" ") !== -1) {
    const words = titleText.split(" ");
    const wordWidths = words.map((word) => ctx.measureText(word).width);
    // Word gap is just the space advance plus a little tracking — the
    // 2x tracking gap left a canyon between PALM and HEAT; #2's
    // SUNSET HEIST sits tight, about a third of a letter wide.
    const gap = size * 0.1 + tracking;
    const total = wordWidths.reduce((sum, ww) => sum + ww, (words.length - 1) * gap);
    ctx.textAlign = "left";
    let cursor = centerX - total / 2;
    words.forEach((word, i) => {
      ctx.strokeText(word, cursor, baselineY);
      cursor += wordWidths[i] + gap;
    });
    ctx.fillStyle = fill;
    cursor = centerX - total / 2;
    words.forEach((word, i) => {
      ctx.fillText(word, cursor, baselineY);
      cursor += wordWidths[i] + gap;
    });
    ctx.textAlign = "center";
  } else {
    ctx.strokeText(titleText, centerX, baselineY);
    ctx.fillStyle = fill;
    ctx.fillText(titleText, centerX, baselineY);
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
    const subSize = mode === "chaos" ? Math.min(w * 0.075, h * 0.17, size * 0.38) : mode === "hero" ? Math.min(w * 0.08, h * 0.17, size * 0.4) : Math.min(w * 0.085, h * 0.17, size * 0.42);
    const subFrac = mode === "hero" ? 0.85 : 0.8;
    const subTop = y + h * subFrac;
    ctx.font = subSize + "px Pacifico, cursive";
    if (mode === "overlap") {
      const plateWidth = Math.min(ctx.measureText(sub).width + subSize * 1.1, w * 0.92);
      roundRectPath(ctx, centerX - plateWidth / 2, subTop - subSize * 0.72, plateWidth, subSize * 1.15, subSize * 0.32);
      ctx.fillStyle = "rgba(16,2,26,0.82)";
      ctx.fill();
    }
    const color = mode === "chaos" ? "#ff5da2" : "#ffffff";
    ctx.fillStyle = color;
    ctx.shadowColor = "#ff2e9e";
    ctx.shadowBlur = subSize * 0.5;
    ctx.fillText(sub, centerX, subTop);
    ctx.shadowBlur = 0;
  }

  // Tagline + HEAT stars live in the bottom strip in hero and chaos
  // mode (the title zone is full — title + script fill it); other
  // modes keep them inside the block as before.
  if (mode !== "hero" && mode !== "chaos") {
    const tagY = y + h * (sub !== "" ? 0.9 : 0.85);
    if (tag !== "") {
      const tagSize = Math.max(11, Math.min(h * 0.07, w * 0.032));
      ctx.font = tagSize + "px Anton, sans-serif";
      ctx.fillStyle = "#ffffff";
      ctx.fillText(tag, centerX, tagY);
    }
    // Gold stars vanish on the orange hero band, so the hero band gets
    // dark stars with a light outline instead.
    const heat = state.heat ?? 5;
    drawHeatStars(ctx, centerX, y + h * 0.965, Math.max(12, h * 0.07), heat, "#ffd23f", "#14041f");
  }
  ctx.restore(); // title block done
}

// The bottom strip (hero mode): a thin magenta-gradient band below
// the title, carrying dark palm silhouettes, the tagline, fine print
// and a barcode — the foot furniture every top-5 cover has.
export function drawBottomStrip(ctx, rect, state) {
  const { x, y, w, h } = rect;
  const k = w / 1920;
  ctx.save(); // bottom strip
  const fill = ctx.createLinearGradient(x, y, x + w, y);
  const stops = [{ at: 0, color: "#ff2e7e" }, { at: 0.5, color: "#a01e68" }, { at: 1, color: "#ff2e7e" }];
  for (const stop of stops) {
    fill.addColorStop(stop.at, stop.color);
  }
  ctx.fillStyle = fill;
  ctx.fillRect(x, y, w, h);
  // Palm silhouettes, clipped to the strip so fronds bleed off its edge
  // the way the top covers' palm strips do.
  ctx.save(); // strip clip
  ctx.beginPath();
  ctx.rect(x, y, w, h);
  ctx.clip();
  const palmK = (h * 0.72) / 110;
  drawPalmSilhouette(ctx, x + w * 0.02, y + h - 2, palmK, "rgba(20,4,31,0.9)");
  drawPalmSilhouette(ctx, x + w * 0.055, y + h - 2, palmK * 0.8, "rgba(20,4,31,0.9)");
  drawPalmSilhouette(ctx, x + w * 0.09, y + h - 2, palmK * 0.6, "rgba(20,4,31,0.9)");
  drawPalmSilhouette(ctx, x + w * 0.885, y + h - 2, palmK * 0.7, "rgba(20,4,31,0.9)");
  ctx.restore(); // strip clip done
  // Tagline, centred, with the fine print under it.
  ctx.textAlign = "center";
  ctx.textBaseline = "alphabetic";
  const tagSize = Math.max(12, h * 0.3);
  ctx.font = tagSize + "px Anton, sans-serif";
  ctx.fillStyle = "#ffffff";
  const tagline = state.tagline ?? "";
  ctx.fillText(tagline, x + w * 0.5, y + h * 0.42);
  const longLine = "PALM HEAT — A PALM HEAT COVER STUDIO PICTURE · STARRING YOU · SHOT ON YOUR OWN CAMERA · GRADED BY HAND · LETTERING AND SEAL ORIGINAL";
  const shortLine = "PALM HEAT — A PALM HEAT COVER STUDIO PICTURE · STARRING YOU";
  // The fine print must fit between the palms and the barcode: on narrow
  // covers (portrait/square) the full line overflows both edges, so use
  // the short line and shrink until it fits the middle 70% of the strip.
  const chosen = ctx.measureText(longLine).width > w * 0.7 ? shortLine : longLine;
  let fine = Math.max(8, h * 0.14);
  ctx.font = fine + "px sans-serif";
  while (fine > 7 && ctx.measureText(chosen).width > w * 0.7) {
    fine -= 1;
    ctx.font = fine + "px sans-serif";
  }
  ctx.fillStyle = "rgba(255,255,255,0.82)";
  ctx.fillText(chosen, x + w * 0.5, y + h * 0.78);
  // Barcode, far right.
  const bw = k * 88;
  const bh = h * 0.62;
  const bx = x + w - bw - k * 10;
  const by = y + (h - bh) / 2;
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(bx - k * 3, by - k * 3, bw + k * 6, bh + k * 6);
  ctx.fillStyle = "#14041f";
  let bw2 = 0;
  let bx2 = bx;
  let n = 11;
  while (bx2 < bx + bw - 2) {
    n = (7 + n * 31) % 97;
    bw2 = 1 + (n % 3) * 1.4;
    if (n % 3 !== 0) {
      ctx.fillRect(bx2, by, bw2, bh);
    }
    bx2 += bw2 + 1.8;
  }
  ctx.restore(); // bottom strip done
}

// WANTED ★★★★★ pill on a photo panel's top-right corner (chaos mode),
// tilted slightly, like a stuck-on label.
export function drawWantedPill(ctx, anchor, coverW) {
  const k = Math.max(coverW / 1920, 0.5);
  const size = Math.max(13, k * 24);
  drawPillRight(ctx, anchor.x - k * 10, anchor.y + k * 10, "WANTED ★★★★★", "#14041f", "#ffd23f", size, { rot: -0.02, stroke: "#ffd23f" });
}

// VOL. 06 chip + COLLECTOR'S EDITION ribbon at the title zone's
// bottom-right (chaos mode), the way #2/#3 carry them.
export function drawVolCluster(ctx, titleRect, state) {
  const k = Math.max(titleRect.w / 1920, 0.5);
  const size = Math.max(13, k * 26);
  const top = titleRect.y + titleRect.h * 0.86;
  const right = titleRect.x + titleRect.w - titleRect.w * 0.025;
  const left = drawPillRight(ctx, right, top, "VOL. 06", "#22d3ee", "#0b2a33", size, { square: true });
  drawPillRight(ctx, left - k * 12, top, "COLLECTOR'S EDITION", "#ff2e7e", "#ffffff", size, { square: true });
}

// A press-quote pill straddling the panel/title boundary (hero mode) —
// the top covers' star-quote strip, condensed into a pill so it never
// covers a face. The wording is original, not copied from any top entry.
export function drawQuotePill(ctx, titleRect, state) {
  const centerX = titleRect.x + titleRect.w / 2;
  const top = titleRect.y;
  const k = titleRect.w / 1920;
  const stars = "★★★★★";
  const text = "‘THE CITY NEVER SLEEPS’ — THE CORAL HERALD";
  ctx.save(); // quote pill
  const size = Math.max(12, k * 21);
  ctx.font = size + "px Anton, sans-serif";
  const starsWidth = ctx.measureText(stars).width;
  const textWidth = ctx.measureText(text).width;
  const gap = k * 10;
  const pad = k * 18;
  const w = starsWidth + gap + textWidth + pad * 2;
  const h = k * 42;
  roundRectPath(ctx, centerX - w / 2, top - h / 2, w, h, h / 2);
  ctx.fillStyle = "#14041f";
  ctx.fill();
  ctx.lineWidth = Math.max(1.5, k * 2);
  ctx.strokeStyle = "#ffd23f";
  ctx.stroke();
  ctx.textAlign = "left";
  ctx.textBaseline = "middle";
  ctx.fillStyle = "#ffd23f";
  ctx.fillText(stars, centerX - w / 2 + pad, top);
  ctx.fillStyle = "#ffffff";
  ctx.fillText(text, centerX - w / 2 + pad + starsWidth + gap, top);
  ctx.restore(); // quote pill done
}

// A small location/time chip in a panel's bottom-left corner — the
// caption chips every top-5 cover puts on its panels. Panels too
// narrow to hold the chip are skipped rather than clipped.
export function drawPanelCaption(ctx, p, cap, coverW) {
  if (cap == null) {
    return; // no caption to draw
  }
  const k = Math.max(coverW / 1920, 0.5);
  const px = k * 10;
  const py = k * 7;
  const placeSize = Math.max(11, k * 15);
  const lineSize = Math.max(9, k * 11);
  const sub = `${cap.time} · ${cap.line}`;
  ctx.save(); // caption chip
  ctx.textAlign = "left";
  ctx.textBaseline = "alphabetic";
  ctx.font = placeSize + "px Anton, sans-serif";
  const placeWidth = ctx.measureText(cap.place).width;
  ctx.font = lineSize + "px sans-serif";
  const lineWidth = ctx.measureText(sub).width;
  const bw = Math.max(lineWidth, placeWidth) + px * 2;
  const bh = py * 2 + placeSize + k * 4 + lineSize;
  const bx = p.x + k * 8;
  const by = p.y + p.h - bh - k * 8;
  if (bh > p.h - k * 16 || bw > p.w - k * 16) {
    ctx.restore(); // caption chip skipped
    return;
  }
  roundRectPath(ctx, bx, by, bw, bh, k * 4);
  ctx.fillStyle = "rgba(12,2,20,0.85)";
  ctx.fill();
  ctx.fillStyle = "#ffffff";
  ctx.font = placeSize + "px Anton, sans-serif";
  ctx.fillText(cap.place, bx + px, py + by + placeSize);
  ctx.fillStyle = "#ffd7ef";
  ctx.font = lineSize + "px sans-serif";
  ctx.fillText(sub, bx + px, py + by + placeSize + k * 4 + lineSize);
  ctx.restore(); // caption chip done
}

/**
 * Paints the whole cover onto `ctx` at the canvas's own size.
 * `state` carries the layout, grade, texts, heat, assignments and the
 * photo images; `photos` is the array of loaded images, and the
 * assignments index into it.
 */
export function drawCoverGrid(canvas, state, photos) {
  const width = canvas.width;
  const height = canvas.height;
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = "#0d0214";
  ctx.fillRect(0, 0, width, height);
  const geo = layoutPanels(width, height, state.layout);
  const { panels, title, badge, strip, wanted } = geo;
  const assignments = state.assignments[state.layout];
  const crops = assignments ?? [];
  const cache = new Map();
  function cacheKey(pi, pw, ph, cr) {
    return `${pi}|${pw}x${ph}|${cr.fx.toFixed(2)},${cr.fy.toFixed(2)},${cr.zoom.toFixed(2)}`;
  }

  for (let i = 0; i < panels.length; i += 1) {
    const p = panels[i];
    const base = crops[i] ?? { fx: 0.5, fy: 0.4, photo: 0, zoom: 1 };
    // v5: per-ratio override — one crop cannot serve both the tall
    // portrait row and the short square row. A face that escapes the
    // title in portrait can sit fully behind the letters in square
    // (the face is at the top of its photo, the letters cover the top
    // of the panel, and the crop cannot push it below them). `sq`
    // replaces photo/crop for the square render only; landscape and
    // portrait are untouched by it.
    const crop = width === height && base.sq !== undefined ? { ...base, ...base.sq } : base;
    const img = photos[crop.photo] ?? photos[0];
    let graded = null;
    if (img !== undefined) {
      const k = cacheKey(crop.photo, Math.round(p.w), Math.round(p.h), crop);
      graded = cache.get(k);
      if (graded === undefined) {
        // Grade at most ~760 px wide, then upscale — fast and smooth.
        const f = Math.min(760 / p.w, 1);
        graded = gradePanelImage(img, Math.max(2, f * p.w), Math.max(2, f * p.h), crop, state.grade);
        cache.set(k, graded);
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
      if (graded !== null) {
        ctx.drawImage(graded, p.w * -0.53, p.h * -0.53, p.w * 1.06, p.h * 1.06);
      }
      ctx.strokeStyle = "#0d0214";
      ctx.lineWidth = (width / 1920) * GUTTER;
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
      if (graded !== null) {
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
          ctx.drawImage(graded, dx, dy, dw, dh);
        } else {
          ctx.drawImage(graded, p.x, p.y, p.w, p.h);
        }
      }
      ctx.restore(); // plain panel done
      // Black gutter edge per panel.
      ctx.save(); // gutter edge
      ctx.strokeStyle = "#0d0214";
      ctx.lineWidth = (width / 1920) * GUTTER;
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
    const hidden = state.layout === "chaos" && title.y + 60 < p.y + p.h;
    if (state.showCaptions !== false && hidden === false) {
      const caps = state.captions ?? [];
      const caption = caps[crop.photo] ?? { line: "SHOT ON YOUR CAMERA", place: "YOUR SHOT", time: "TONIGHT" };
      drawPanelCaption(ctx, p, caption, width);
    }
  }

  // WANTED pill on the fisherman panel (chaos mode) — drawn on the
  // photo, before the title paints over the lower panels.
  if (state.layout === "chaos" && wanted !== undefined) {
    drawWantedPill(ctx, wanted, width);
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
  const badgeR = Math.max(width * 0.038, 34);
  drawStarburstBadge(ctx, badge.x, badge.y, badgeR, "EST.", "2026");
  if (state.showRibbon !== false) {
    ctx.save(); // ribbon
    const ribW = width * 0.2;
    const ribH = Math.max(height * 0.035, 18);
    ctx.fillStyle = "#ff2e7e";
    ctx.fillRect(width - ribW - (width / 1920) * GUTTER, (width / 1920) * GUTTER + height * 0.02, ribW, ribH);
    ctx.fillStyle = "#ffffff";
    ctx.font = Math.max(ribH * 0.42, 11) + "px Anton, sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("ORIGINAL · FAN MADE", width - ribW / 2 - (width / 1920) * GUTTER, (width / 1920) * GUTTER + ribH / 2 + height * 0.02);
    ctx.restore(); // ribbon done
  }
  if (state.showBarcode !== false && title.mode !== "cell" && title.mode !== "hero") {
    const label = state.title !== undefined && state.title !== "" ? state.title : "PALM HEAT";
    drawBarcode(ctx, width - width * 0.09 - GUTTER, height - height * 0.075, width * 0.09, height * 0.055, label);
  }
  return { panels, strip, title };
}

/** Renders the cover offscreen at an exact post size and hands back a PNG blob. */
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
