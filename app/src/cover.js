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

import { drawCroppedPhoto, gradePanelImage } from "./grades.js";

const GAP = 10;

// Post sizes and their labels.
export const EXPORT_SIZES = {
  landscape: { label: "1920 × 1080", w: 1920, h: 1080 },
  portrait: { label: "1080 × 1350", w: 1080, h: 1350 },
  square: { label: "1080 × 1080", w: 1080, h: 1080 },
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
  ink: "Poster Ink",
  golden: "Golden Hour",
  neon: "Neon Night",
  sunset: "Sunset",
};

/**
 * Panel geometry for a layout at (w, h). It returns { panels, title, badge }:
 * panels are {x, y, w, h} rects (optionally `slant` for diagonal cuts or
 * `snap` for a rotated polaroid); title is the title-block rect plus a
 * `mode` ('cell' | 'band' | 'overlap'); badge is where the starburst goes.
 */
export function layoutPanels(w, h, layout) {
  const g = (w / 1920) * GAP;
  const tall = w <= h;
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
    const b = h * 0.3;
    const s = h * 0.075;
    const t = h - b - s - 4 * g;
    const titleY = g + t + g;
    const stripY = titleY + b + g;
    const foot = { x: g, y: stripY, w: w - 2 * g, h: h - stripY - g };
    if (tall) {
      const heroH = t * 0.6;
      panels.push({ x: g, y: g, w: w - 2 * g, h: heroH });
      const colW = (w - 4 * g) / 3;
      const rowH = t - heroH - g;
      for (let c = 0; c < 3; c += 1) {
        panels.push({ x: g + c * (colW + g), y: g + heroH + g, w: colW, h: rowH });
      }
      return { // hero-vice, tall layout
        badge: { x: 76, y: 76 }, // hero-vice tall
        panels,
        strip: foot,
        title: { x: g, y: titleY, w: w - 2 * g, h: b, mode: "hero" }, // hero-vice tall
      };
    }
    const heroW = 0.46 * w - g;
    const midW = 0.235 * w - g;
    const rightW = 0.305 * w - 2 * g;
    const midX = g + heroW + g;
    const rightX = midX + midW + g;
    panels.push({ x: g, y: g, w: heroW, h: t });
    const midH = (t - g) / 2;
    panels.push({ x: midX, y: g, w: midW, h: midH });
    panels.push({ x: midX, y: g + midH + g, w: midW, h: midH });
    const rowH = (t - 2 * g) / 3;
    for (let r = 0; r < 3; r += 1) {
      panels.push({ x: rightX, y: g + r * (rowH + g), w: rightW, h: rowH });
    }
    return { // hero-vice, wide layout
      badge: { x: g + 64, y: g + 64 },
      panels,
      strip: foot,
      title: { x: g, y: titleY, w: w - 2 * g, h: b, mode: "hero" }, // hero-vice wide
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
    const s = h * 0.075;
    const stripY = h - s - g;
    const foot = { x: g, y: stripY, w: w - 2 * g, h: h - stripY - g };
    let th = 0.38 * h;
    if (tall) {
      th = 0.34 * h;
    }
    const title = { x: 0, y: 0.5 * h, w, h: th, mode: "chaos" };
    if (tall) {
      const hh = 0.44 * h;
      panels.push({ x: g, y: g, w: w - 2 * g, h: hh, slant: 30 });
      const colW = (w - 4 * g) / 3;
      // The row runs down to the photo bottom (0.88h) so photos fill
      // behind the title all the way to the strip — a short row left a
      // black scrim void under the title in portrait/square.
      const rowY = g + hh + g;
      const rowH = 0.88 * h - rowY;
      panels.push({ x: g, y: rowY, w: colW, h: rowH, rot: -0.02 });
      panels.push({ x: g + colW + g, y: rowY, w: colW, h: rowH });
      panels.push({ x: g + 2 * (colW + g), y: rowY, w: colW, h: rowH, rot: 0.025 });
      return { // chaos, tall layout
        badge: { x: 0.66 * w, y: g + hh + g },
        panels,
        strip: foot,
        title,
        wanted: { x: g + 3 * colW + 2 * g, y: rowY },
      };
    }
    const base = 0.88 * h;
    const t = base - g;
    const heroW = 0.44 * w - g;
    const midX = g + heroW + g;
    const midW = 0.24 * w - g;
    const rightX = midX + midW + g;
    const rightW = w - rightX - g;
    panels.push({ x: g, y: g, w: heroW, h: t, slant: 36 });
    const midH = (t - g) / 2;
    panels.push({ x: midX, y: g, w: midW, h: midH, rot: 0.02 });
    panels.push({ x: midX, y: g + midH + g, w: midW, h: midH, rot: -0.015 });
    const rowH = (t - 2 * g) / 3;
    panels.push({ x: rightX, y: g, w: rightW, h: rowH, rot: -0.03 });
    panels.push({ x: rightX, y: g + rowH + g, w: rightW, h: rowH, rot: 0.025 });
    panels.push({ x: rightX, y: g + 2 * (rowH + g), w: rightW, h: rowH, rot: -0.02 });
    return { // chaos, wide layout
      // Starburst on the hero/mid-column junction up where no caption
      // chip lives (the old junction sat on the fisherman's chip), and
      // WANTED on the car panel's top-right — the fisherman panel's
      // top-right is under the ORIGINAL ribbon, which hid the pill.
      badge: { x: midX, y: t * 0.22 },
      panels,
      strip: foot,
      title,
      wanted: { x: rightX + rightW, y: g + rowH + g },
    };
  }

  if (layout === "vice-grid") {
    if (tall) {
      const colW = (w - 3 * g) / 2;
      const rowH = (0.62 * h - 4 * g) / 3;
      for (let r = 0; r < 3; r += 1) {
        for (let c = 0; c < 2; c += 1) {
          panels.push({ x: g + c * (colW + g), y: g + r * (rowH + g), w: colW, h: rowH });
        }
      }
      const ty = g + 3 * (rowH + g);
      return { // vice-grid, tall layout
        badge: { x: 76, y: 76 }, // vice-grid tall
        panels,
        title: { x: g, y: ty, w: w - 2 * g, h: h - ty - g, mode: "band" },
      };
    }
    const colW = (w - 4 * g) / 3;
    const rowH = (h - 4 * g) / 3;
    for (let r = 0; r < 3; r += 1) {
      for (let c = 0; c < 3; c += 1) {
        if (r === 1 && c === 1) {
          // centre cell is the title block
        } else {
          panels.push({ x: g + c * (colW + g), y: g + r * (rowH + g), w: colW, h: rowH });
        }
      }
    }
    return { // vice-grid, wide layout
      badge: { x: g + 64, y: g + 64 },
      panels,
      title: { x: g + (colW + g), y: g + (rowH + g), w: colW, h: rowH, mode: "cell" },
    };
  }

  if (layout === "hero-three") {
    if (tall) {
      const hh = 0.44 * h;
      panels.push({ x: g, y: g, w: w - 2 * g, h: hh });
      const colW = (w - 4 * g) / 3;
      const rowH = 0.2 * h;
      for (let c = 0; c < 3; c += 1) {
        panels.push({ x: g + c * (colW + g), y: hh + 2 * g, w: colW, h: rowH });
      }
      const ty = hh + rowH + 3 * g;
      return { // hero-three, tall layout
        badge: { x: 76, y: 76 }, // hero-three tall
        panels,
        title: { x: g, y: ty, w: w - 2 * g, h: h - ty - g, mode: "band" },
      };
    }
    const heroW = 0.56 * w;
    panels.push({ x: g, y: g, w: heroW - g, h: h - 2 * g });
    const restW = w - heroW - 2 * g;
    const rowH = (h - 4 * g) / 3;
    for (let r = 0; r < 3; r += 1) {
      panels.push({ x: heroW + g, y: g + r * (rowH + g), w: restW, h: rowH });
    }
    return { // hero-three, wide layout
      badge: { x: 78, y: 54 },
      panels,
      title: { x: g, y: 0.66 * h, w: w - 2 * g, h: 0.34 * h - g, mode: "overlap" },
    };
  }

  if (layout === "tilted") {
    if (tall) {
      const hh = 0.4 * h;
      panels.push({ x: g, y: g, w: w - 2 * g, h: hh, slant: 40 });
      const colW = (w - 3 * g) / 2;
      const rowH = 0.24 * h;
      panels.push({ x: g, y: hh + 2 * g, w: colW, h: rowH, slant: -30 });
      panels.push({ x: g + colW + g, y: hh + 2 * g, w: colW, h: rowH, slant: 30 });
      const ty = hh + rowH + 3 * g;
      return { // tilted, tall layout
        badge: { x: 76, y: 76 }, // tilted tall
        panels,
        title: { x: g, y: ty, w: w - 2 * g, h: h - ty - g, mode: "band" },
      };
    }
    const heroW = 0.5 * w;
    panels.push({ x: g, y: g, w: heroW, h: 0.62 * h, slant: 46 });
    panels.push({ x: heroW + g, y: g, w: w - heroW - 2 * g, h: 0.62 * h, slant: -46 });
    const botW = (w - 4 * g) / 3;
    for (let c = 0; c < 3; c += 1) {
      let slant = -26;
      if (c === 1) {
        slant = 0;
      } else if (c === 0) {
        slant = 26;
      }
      panels.push({ x: g + c * (botW + g), y: 0.62 * h + g, w: botW, h: 0.38 * h - 2 * g, slant });
    }
    return { // tilted, wide layout
      badge: { x: g + 64, y: g + 64 },
      panels,
      title: { x: 0.22 * w, y: 0.42 * h, w: 0.56 * w, h: 0.3 * h, mode: "overlap" },
    };
  }

  // full-bleed: a single photo fills the frame, with snapshots floating on top.
  if (tall) {
    panels.push({ x: 0, y: 0, w, h: 0.72 * h });
    panels.push({ x: g, y: 0.52 * h, w: 0.42 * w, h: 0.2 * h, snap: true });
    return { // full-bleed, tall layout
      badge: { x: 76, y: 76 }, // full-bleed tall
      panels,
      title: { x: 0, y: 0.72 * h, w, h: 0.28 * h, mode: "band" },
    };
  }
  panels.push({ x: 0, y: 0, w, h });
  panels.push({ x: 0.66 * w, y: 2 * g, w: 0.3 * w, h: 0.34 * h, snap: true });
  panels.push({ x: 0.04 * w, y: 0.06 * h, w: 0.24 * w, h: 0.3 * h, snap: true });
  return { // full-bleed, wide layout
    badge: { x: 0.5 * w, y: 60 },
    panels,
    title: { x: 0, y: 0.6 * h, w, h: 0.4 * h, mode: "overlap" },
  };
}

/** The Anton size that fits `text` inside `limit`, shrinking 2 px at a time. */
export function fitTitleFont(ctx, text, limit, max, face = "Anton") {
  let size = max;
  ctx.font = size + "px " + face + ", sans-serif";
  while (ctx.measureText(text).width > limit && size > 20) {
    size -= 2;
    ctx.font = size + "px " + face + ", sans-serif";
  }
  return size;
}

/** How many photo panels a layout has. */
export function panelCount(layout) {
  const counts = { chaos: 6, "hero-vice": 6, "vice-grid": 8, "hero-three": 4, tilted: 5, "full-bleed": 3 };
  return counts[layout] ?? 8;
}

/** A filled rounded-rectangle path (avoids any ctx.roundRect dependency). */
export function roundRectPath(ctx, x, y, w, h, radius) {
  const rad = Math.min(radius, w / 2, h / 2);
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
  const points = 14;
  for (let i = 0; i < points * 2; i += 1) {
    const a = (i / points - 0.5) * Math.PI;
    const d = i % 2 === 0 ? r : r * 0.78;
    const x = Math.cos(a) * d;
    const y = Math.sin(a) * d;
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
  const gap = size * 1.15;
  const start = cx - 2 * gap;
  for (let i = 0; i < 5; i += 1) {
    ctx.fillStyle = i < heat ? fill : "rgba(255,255,255,0.28)";
    ctx.strokeStyle = stroke;
    ctx.lineWidth = Math.max(1, size * 0.06);
    const x = start + i * gap;
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
  let seed = 7;
  for (let i = 0; i < seedText.length; i += 1) {
    seed = (seedText.charCodeAt(i) + seed * 31) % 997;
  }
  let barW = 0;
  ctx.fillStyle = "#14041f";
  for (let bx = x + w * 0.04, n = seed; bx < x + w * 0.96; bx += barW + w / 220) {
    n = (n * 16807) % 2147483647;
    barW = 1 + (n % 4) * (w / 220);
    if (n % 3 !== 0) {
      ctx.fillRect(bx, y + h * 0.08, barW, h * 0.72);
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
    const ang = (i * 52 - 160) * (Math.PI / 180);
    ctx.beginPath();
    ctx.moveTo(4, -110);
    ctx.quadraticCurveTo(
      Math.cos(ang) * 55 + 4, Math.sin(ang) * 42 - 110,
      Math.cos(ang) * 88 + 4, Math.sin(ang) * 78 - 110,
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
  const padX = fs * 0.75;
  const w = textW + padX * 2;
  const h = fs * 1.75;
  ctx.translate(edgeX - w / 2, top + h / 2);
  o.rot !== undefined && ctx.rotate(o.rot);
  const corner = o.square ? Math.max(3, fs * 0.15) : h / 2;
  roundRectPath(ctx, -w / 2, -h / 2, w, h, corner);
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

  const pad = w * 0.04;
  const cx = x + w / 2;
  let name = "PALM HEAT";
  if (state.title !== undefined && state.title !== "") {
    name = state.title.toUpperCase();
  }
  let subtitle = "";
  if (state.subtitle !== undefined) {
    subtitle = state.subtitle;
  }
  let city = "CORAL BAY";
  if (state.place !== undefined && state.place !== "") {
    city = state.place.toUpperCase();
  }
  let tagline = "";
  if (state.tagline !== undefined) {
    tagline = state.tagline.toUpperCase();
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
    ctx.fillText("★  WELCOME TO " + city + "  ★", cx, y + h * 0.12);
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
  const maxSize = mode === "chaos" ? h * 0.72 : mode === "hero" ? h * 0.66 : Math.min(h * 0.52, w * 0.52);
  const fontSize = fitTitleFont(ctx, name, w - 2 * pad, maxSize);
  const yPos = mode === "hero" ? 0.58 : mode === "chaos" ? 0.52 : subtitle !== "" ? 0.6 : 0.64;
  const titleY = y + h * yPos;
  const grad = ctx.createLinearGradient(0, titleY - fontSize, 0, titleY + fontSize * 0.12);
  const tStops = [{ at: 0, color: "#ffe14d" }, { at: 0.5, color: "#ff9a2f" }, { at: 1, color: "#ff2e7e" }];
  for (const stop of tStops) {
    grad.addColorStop(stop.at, stop.color);
  }
  ctx.font = fontSize + "px Anton, sans-serif";
  ctx.lineJoin = "round";
  const outlineW = mode === "hero" ? 0.13 : 0.11;
  ctx.lineWidth = Math.max(3, fontSize * outlineW);
  ctx.strokeStyle = "#14041f";
  // Hero and chaos mode: a magenta drop shadow behind the black
  // outline, the way the top covers' titles lift off the band (or off
  // the photos).
  if (mode === "chaos" || mode === "hero") {
    // v5: deeper than v4 (0.55/0.10/0.06) — #1's title shadow sits
    // visibly deeper than ours; the title stays fully readable.
    ctx.shadowColor = "rgba(255,46,126,0.8)";
    ctx.shadowBlur = fontSize * 0.14;
    ctx.shadowOffsetY = fontSize * 0.08;
  } else {
    ctx.shadowColor = "rgba(20,4,31,0.65)";
    ctx.shadowBlur = fontSize * 0.08;
    ctx.shadowOffsetY = fontSize * 0.05;
  }
  let scaleX = 1;
  let spacing = 0;
  if (mode === "hero" || mode === "chaos") {
    const natural = ctx.measureText(name).width;
    const goalFrac = mode === "chaos" ? 0.88 : 0.85;
    const goalW = w * goalFrac;
    scaleX = Math.min(1.15, goalW / Math.max(1, natural));
    spacing = Math.max(0, (goalW - natural * scaleX) / Math.max(1, name.length - 1));
    ctx.save(); // title stretch
    ctx.translate(cx, 0);
    ctx.scale(scaleX, 1);
    ctx.translate(-cx, 0);
    ctx.letterSpacing = spacing + "px";
  }
  // Hero and chaos mode with a multi-word title: draw word by word, so
  // the gap between words is a controlled 2x tracking, not the space
  // advance plus tracking (which leaves a canyon between PALM and HEAT).
  if ((mode === "hero" || mode === "chaos") && name.indexOf(" ") !== -1) {
    const parts = name.split(" ");
    const widths = parts.map((word) => ctx.measureText(word).width);
    // Word gap is just the space advance plus a little tracking — the
    // 2x tracking gap left a canyon between PALM and HEAT; #2's
    // SUNSET HEIST sits tight, about a third of a letter wide.
    const wordGap = fontSize * 0.1 + spacing;
    const totalW = widths.reduce((sum, ww) => sum + ww, (parts.length - 1) * wordGap);
    ctx.textAlign = "left";
    let x = cx - totalW / 2;
    parts.forEach((word, i) => {
      ctx.strokeText(word, x, titleY);
      x += widths[i] + wordGap;
    });
    ctx.fillStyle = grad;
    x = cx - totalW / 2;
    parts.forEach((word, i) => {
      ctx.fillText(word, x, titleY);
      x += widths[i] + wordGap;
    });
    ctx.textAlign = "center";
  } else {
    ctx.strokeText(name, cx, titleY);
    ctx.fillStyle = grad;
    ctx.fillText(name, cx, titleY);
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
    const subSize = mode === "chaos" ? Math.min(w * 0.075, h * 0.17, fontSize * 0.38) : mode === "hero" ? Math.min(w * 0.08, h * 0.17, fontSize * 0.4) : Math.min(w * 0.085, h * 0.17, fontSize * 0.42);
    const subFrac = mode === "hero" ? 0.85 : 0.8;
    const subTop = y + h * subFrac;
    ctx.font = subSize + "px Pacifico, cursive";
    if (mode === "overlap") {
      const plateWidth = Math.min(ctx.measureText(subtitle).width + subSize * 1.1, w * 0.92);
      roundRectPath(ctx, cx - plateWidth / 2, subTop - subSize * 0.72, plateWidth, subSize * 1.15, subSize * 0.32);
      ctx.fillStyle = "rgba(16,2,26,0.82)";
      ctx.fill();
    }
    const color = mode === "chaos" ? "#ff5da2" : "#ffffff";
    ctx.fillStyle = color;
    ctx.shadowColor = "#ff2e9e";
    ctx.shadowBlur = subSize * 0.5;
    ctx.fillText(subtitle, cx, subTop);
    ctx.shadowBlur = 0;
  }

  // Tagline + HEAT stars live in the bottom strip in hero and chaos
  // mode (the title zone is full — title + script fill it); other
  // modes keep them inside the block as before.
  if (mode !== "hero" && mode !== "chaos") {
    const tagY = y + h * (subtitle !== "" ? 0.9 : 0.85);
    if (tagline !== "") {
      const tagSize = Math.max(11, Math.min(h * 0.07, w * 0.032));
      ctx.font = tagSize + "px Anton, sans-serif";
      ctx.fillStyle = "#ffffff";
      ctx.fillText(tagline, cx, tagY);
    }
    // Gold stars vanish on the orange hero band, so the hero band gets
    // dark stars with a light outline instead.
    const heat = state.heat ?? 5;
    drawHeatStars(ctx, cx, y + h * 0.965, Math.max(12, h * 0.07), heat, "#ffd23f", "#14041f");
  }
  ctx.restore(); // title block done
}

// The bottom strip (hero mode): a thin magenta-gradient band below
// the title, carrying dark palm silhouettes, the tagline, fine print
// and a barcode — the foot furniture every top-5 cover has.
export function drawBottomStrip(ctx, rect, state) {
  const { x, y, w, h } = rect;
  const scale = w / 1920;
  ctx.save(); // bottom strip
  const grad = ctx.createLinearGradient(x, y, x + w, y);
  const stops = [{ at: 0, color: "#ff2e7e" }, { at: 0.5, color: "#a01e68" }, { at: 1, color: "#ff2e7e" }];
  for (const stop of stops) {
    grad.addColorStop(stop.at, stop.color);
  }
  ctx.fillStyle = grad;
  ctx.fillRect(x, y, w, h);
  // Palm silhouettes, clipped to the strip so fronds bleed off its edge
  // the way the top covers' palm strips do.
  ctx.save(); // strip clip
  ctx.beginPath();
  ctx.rect(x, y, w, h);
  ctx.clip();
  const palmScale = (h * 0.72) / 110;
  drawPalmSilhouette(ctx, x + w * 0.02, y + h - 2, palmScale, "rgba(20,4,31,0.9)");
  drawPalmSilhouette(ctx, x + w * 0.055, y + h - 2, palmScale * 0.8, "rgba(20,4,31,0.9)");
  drawPalmSilhouette(ctx, x + w * 0.09, y + h - 2, palmScale * 0.6, "rgba(20,4,31,0.9)");
  drawPalmSilhouette(ctx, x + w * 0.885, y + h - 2, palmScale * 0.7, "rgba(20,4,31,0.9)");
  ctx.restore(); // strip clip done
  // Tagline, centred, with the fine print under it.
  ctx.textAlign = "center";
  ctx.textBaseline = "alphabetic";
  const tagSize = Math.max(12, h * 0.3);
  ctx.font = tagSize + "px Anton, sans-serif";
  ctx.fillStyle = "#ffffff";
  const tagline = state.tagline ?? "";
  ctx.fillText(tagline, x + w * 0.5, y + h * 0.42);
  const full = "PALM HEAT — A PALM HEAT COVER STUDIO PICTURE · STARRING YOU · SHOT ON YOUR OWN CAMERA · GRADED BY HAND · LETTERING AND SEAL ORIGINAL";
  const brief = "PALM HEAT — A PALM HEAT COVER STUDIO PICTURE · STARRING YOU";
  // The fine print must fit between the palms and the barcode: on narrow
  // covers (portrait/square) the full line overflows both edges, so use
  // the short line and shrink until it fits the middle 70% of the strip.
  const line = ctx.measureText(full).width > w * 0.7 ? brief : full;
  let fineSize = Math.max(8, h * 0.14);
  ctx.font = fineSize + "px sans-serif";
  while (fineSize > 7 && ctx.measureText(line).width > w * 0.7) {
    fineSize -= 1;
    ctx.font = fineSize + "px sans-serif";
  }
  ctx.fillStyle = "rgba(255,255,255,0.82)";
  ctx.fillText(line, x + w * 0.5, y + h * 0.78);
  // Barcode, far right.
  const barW = scale * 88;
  const barH = h * 0.62;
  const barX = x + w - barW - scale * 10;
  const barY = y + (h - barH) / 2;
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(barX - scale * 3, barY - scale * 3, barW + scale * 6, barH + scale * 6);
  ctx.fillStyle = "#14041f";
  let bw = 0;
  let bx = barX;
  let n = 11;
  while (bx < barX + barW - 2) {
    n = (7 + n * 31) % 97;
    bw = 1 + (n % 3) * 1.4;
    if (n % 3 !== 0) {
      ctx.fillRect(bx, barY, bw, barH);
    }
    bx += bw + 1.8;
  }
  ctx.restore(); // bottom strip done
}

// WANTED ★★★★★ pill on a photo panel's top-right corner (chaos mode),
// tilted slightly, like a stuck-on label.
export function drawWantedPill(ctx, anchor, coverW) {
  const scale = Math.max(coverW / 1920, 0.5);
  const fs = Math.max(13, scale * 24);
  drawPillRight(ctx, anchor.x - scale * 10, anchor.y + scale * 10, "WANTED ★★★★★", "#14041f", "#ffd23f", fs, { rot: -0.02, stroke: "#ffd23f" });
}

// VOL. 06 chip + COLLECTOR'S EDITION ribbon at the title zone's
// bottom-right (chaos mode), the way #2/#3 carry them.
export function drawVolCluster(ctx, titleRect, state) {
  const scale = Math.max(titleRect.w / 1920, 0.5);
  const fs = Math.max(13, scale * 26);
  const top = titleRect.y + titleRect.h * 0.86;
  const edge = titleRect.x + titleRect.w - titleRect.w * 0.025;
  const next = drawPillRight(ctx, edge, top, "VOL. 06", "#22d3ee", "#0b2a33", fs, { square: true });
  drawPillRight(ctx, next - scale * 12, top, "COLLECTOR'S EDITION", "#ff2e7e", "#ffffff", fs, { square: true });
}

// A press-quote pill straddling the panel/title boundary (hero mode) —
// the top covers' star-quote strip, condensed into a pill so it never
// covers a face. The wording is original, not copied from any top entry.
export function drawQuotePill(ctx, titleRect, state) {
  const cx = titleRect.x + titleRect.w / 2;
  const y = titleRect.y;
  const scale = titleRect.w / 1920;
  const rate = "★★★★★";
  const quote = "‘THE CITY NEVER SLEEPS’ — THE CORAL HERALD";
  ctx.save(); // quote pill
  const fs = Math.max(12, scale * 21);
  ctx.font = fs + "px Anton, sans-serif";
  const starsW = ctx.measureText(rate).width;
  const quoteW = ctx.measureText(quote).width;
  const gap = scale * 10;
  const pad = scale * 18;
  const w = starsW + gap + quoteW + pad * 2;
  const h = scale * 42;
  roundRectPath(ctx, cx - w / 2, y - h / 2, w, h, h / 2);
  ctx.fillStyle = "#14041f";
  ctx.fill();
  ctx.lineWidth = Math.max(1.5, scale * 2);
  ctx.strokeStyle = "#ffd23f";
  ctx.stroke();
  ctx.textAlign = "left";
  ctx.textBaseline = "middle";
  ctx.fillStyle = "#ffd23f";
  ctx.fillText(rate, cx - w / 2 + pad, y);
  ctx.fillStyle = "#ffffff";
  ctx.fillText(quote, cx - w / 2 + pad + starsW + gap, y);
  ctx.restore(); // quote pill done
}

// A small location/time chip in a panel's bottom-left corner — the
// caption chips every top-5 cover puts on its panels. Panels too
// narrow to hold the chip are skipped rather than clipped.
export function drawPanelCaption(ctx, p, cap, coverW) {
  if (cap == null) {
    return; // no caption to draw
  }
  const scale = Math.max(coverW / 1920, 0.5);
  const padX = scale * 10;
  const padY = scale * 7;
  const placeSize = Math.max(11, scale * 15);
  const lineSize = Math.max(9, scale * 11);
  const second = `${cap.time} · ${cap.line}`;
  ctx.save(); // caption chip
  ctx.textAlign = "left";
  ctx.textBaseline = "alphabetic";
  ctx.font = placeSize + "px Anton, sans-serif";
  const placeW = ctx.measureText(cap.place).width;
  ctx.font = lineSize + "px sans-serif";
  const lineW = ctx.measureText(second).width;
  const boxW = Math.max(lineW, placeW) + padX * 2;
  const boxH = padY * 2 + placeSize + scale * 4 + lineSize;
  const boxX = p.x + scale * 8;
  const boxY = p.y + p.h - boxH - scale * 8;
  if (boxH > p.h - scale * 16 || boxW > p.w - scale * 16) {
    ctx.restore(); // caption chip skipped
    return;
  }
  roundRectPath(ctx, boxX, boxY, boxW, boxH, scale * 4);
  ctx.fillStyle = "rgba(12,2,20,0.85)";
  ctx.fill();
  ctx.fillStyle = "#ffffff";
  ctx.font = placeSize + "px Anton, sans-serif";
  ctx.fillText(cap.place, boxX + padX, padY + boxY + placeSize);
  ctx.fillStyle = "#ffd7ef";
  ctx.font = lineSize + "px sans-serif";
  ctx.fillText(second, boxX + padX, padY + boxY + placeSize + scale * 4 + lineSize);
  ctx.restore(); // caption chip done
}

/**
 * Paints the whole cover onto `ctx` at the canvas's own size.
 * `state` carries the layout, grade, texts, heat, assignments and the
 * photo images; `photos` is the array of loaded images, and the
 * assignments index into it.
 */
export function drawCoverGrid(canvas, state, photos) {
  const W = canvas.width;
  const H = canvas.height;
  const g = canvas.getContext("2d");
  g.fillStyle = "#0d0214";
  g.fillRect(0, 0, W, H);
  const layout = layoutPanels(W, H, state.layout);
  const { panels, title, badge, strip, wanted } = layout;
  const all = state.assignments[state.layout];
  const list = all ?? [];
  const seen = new Map();
  function key(pi, pw, ph, cr) {
    return `${pi}|${pw}x${ph}|${cr.fx.toFixed(2)},${cr.fy.toFixed(2)},${cr.zoom.toFixed(2)}`;
  }

  for (let i = 0; i < panels.length; i += 1) {
    const panel = panels[i];
    const crop = list[i] ?? { photo: 0, fx: 0.5, fy: 0.4, zoom: 1 };
    // v5: per-ratio override — one crop cannot serve both the tall
    // portrait row and the short square row. A face that escapes the
    // title in portrait can sit fully behind the letters in square
    // (the face is at the top of its photo, the letters cover the top
    // of the panel, and the crop cannot push it below them). `sq`
    // replaces photo/crop for the square render only; landscape and
    // portrait are untouched by it.
    const c = W === H && crop.sq !== undefined ? { ...crop, ...crop.sq } : crop;
    const photo = photos[c.photo] ?? photos[0];
    let layer = null;
    if (photo !== undefined) {
      const k = key(c.photo, Math.round(panel.w), Math.round(panel.h), c);
      layer = seen.get(k);
      if (layer === undefined) {
        // Grade at most ~760 px wide, then upscale — fast and smooth.
        const f = Math.min(760 / panel.w, 1);
        layer = gradePanelImage(photo, Math.max(2, f * panel.w), Math.max(2, f * panel.h), c, state.grade);
        seen.set(k, layer);
      }
    }
    if (panel.rot !== undefined) {
      // Rotated photo card (chaos): clip to the panel rect in rotated
      // space and draw the graded image slightly oversized so the corners
      // stay covered after the rotation — the collage tilt of the top
      // covers. The black edge is stroked inside the same transform.
      g.save(); // rotated panel
      g.translate(panel.x + panel.w / 2, panel.y + panel.h / 2);
      g.rotate(panel.rot);
      g.beginPath();
      g.rect(-panel.w / 2, -panel.h / 2, panel.w, panel.h);
      g.clip();
      if (layer !== null) {
        g.drawImage(layer, panel.w * -0.53, panel.h * -0.53, panel.w * 1.06, panel.h * 1.06);
      }
      g.strokeStyle = "#0d0214";
      g.lineWidth = (W / 1920) * GAP;
      g.strokeRect(-0.5 * panel.w, -0.5 * panel.h, panel.w, panel.h);
      g.restore(); // rotated panel done
    } else {
      g.save(); // plain panel
      if (panel.slant !== undefined) {
        // Diagonal panel: clip a parallelogram, draw the photo inside it.
        g.beginPath();
        g.moveTo(panel.x + panel.slant, panel.y);
        g.lineTo(panel.x + panel.w, panel.y);
        g.lineTo(panel.x + panel.w - panel.slant, panel.y + panel.h);
        g.lineTo(panel.x, panel.y + panel.h);
        g.closePath();
        g.clip();
      } else if (panel.snap) {
        g.translate(panel.x + panel.w / 2, panel.y + panel.h / 2);
        g.rotate(-0.045);
        g.translate(-panel.w / 2, -panel.h / 2);
      }
      if (layer !== null) {
        let dx = 0;
        let dy = 0;
        let dw = panel.w;
        let dh = panel.h;
        if (panel.snap) {
          dx = panel.w * -0.04;
          dy = panel.h * -0.04;
          dw = panel.w * 1.08;
          dh = panel.h * 1.08;
          // White polaroid border around the snapshot.
          g.fillStyle = "#ffffff";
          g.fillRect(panel.w * -0.05, panel.h * -0.05, panel.w * 1.1, panel.h * 1.16);
          g.drawImage(layer, dx, dy, dw, dh);
        } else {
          g.drawImage(layer, panel.x, panel.y, panel.w, panel.h);
        }
      }
      g.restore(); // plain panel done
      // Black gutter edge per panel.
      g.save(); // gutter edge
      g.strokeStyle = "#0d0214";
      g.lineWidth = (W / 1920) * GAP;
      g.beginPath();
      g.rect(panel.x, panel.y, panel.w, panel.h);
      g.stroke();
      g.restore(); // gutter edge done
    }
    // Location/time caption chip in the panel's bottom-left corner
    // (hero mode + any layout that wants it; off when the editor
    // toggles captions off). In chaos mode a chip whose panel runs
    // deep under the title would sit under the dark scrim and turn
    // muddy — the top covers leave those panels clean — so skip it.
    const hidden = state.layout === "chaos" && title.y + 60 < panel.y + panel.h;
    if (state.showCaptions !== false && hidden === false) {
      const caps = state.captions ?? [];
      const caption = caps[c.photo] ?? { place: "YOUR SHOT", time: "TONIGHT", line: "SHOT ON YOUR CAMERA" };
      drawPanelCaption(g, panel, caption, W);
    }
  }

  // WANTED pill on the fisherman panel (chaos mode) — drawn on the
  // photo, before the title paints over the lower panels.
  if (state.layout === "chaos" && wanted !== undefined) {
    drawWantedPill(g, wanted, W);
  }

  drawTitleBlock(g, title, state);

  // Hero and chaos furniture: the bottom strip (palms + tagline +
  // fine print + barcode) and the press-quote pill on the panel/title
  // boundary. Chaos adds the VOL. 06 chip + COLLECTOR'S EDITION
  // ribbon. Other layouts keep the old barcode placement instead.
  if ((title.mode === "hero" || title.mode === "chaos") && strip !== undefined) {
    drawBottomStrip(g, strip, state);
    drawQuotePill(g, title, state);
  }
  if (title.mode === "chaos") {
    drawVolCluster(g, title, state);
  }

  // Poster furniture.
  const badgeR = Math.max(W * 0.038, 34);
  drawStarburstBadge(g, badge.x, badge.y, badgeR, "EST.", "2026");
  if (state.showRibbon !== false) {
    g.save(); // ribbon
    const ribW = W * 0.2;
    const ribH = Math.max(H * 0.035, 18);
    g.fillStyle = "#ff2e7e";
    g.fillRect(W - ribW - (W / 1920) * GAP, (W / 1920) * GAP + H * 0.02, ribW, ribH);
    g.fillStyle = "#ffffff";
    g.font = Math.max(ribH * 0.42, 11) + "px Anton, sans-serif";
    g.textAlign = "center";
    g.textBaseline = "middle";
    g.fillText("ORIGINAL · FAN MADE", W - ribW / 2 - (W / 1920) * GAP, (W / 1920) * GAP + ribH / 2 + H * 0.02);
    g.restore(); // ribbon done
  }
  if (state.showBarcode !== false && title.mode !== "cell" && title.mode !== "hero") {
    const label = state.title !== undefined && state.title !== "" ? state.title : "PALM HEAT";
    drawBarcode(g, W - W * 0.09 - GAP, H - H * 0.075, W * 0.09, H * 0.055, label);
  }
  return { strip, title, panels };
}

/** Renders the cover offscreen at an exact post size and hands back a PNG blob. */
export function exportCoverPNG(state, photos, sizeKey) {
  return new Promise((resolve) => {
    const dims = EXPORT_SIZES[sizeKey];
    const out = document.createElement("canvas");
    out.width = dims.w;
    out.height = dims.h;
    drawCoverGrid(out, state, photos);
    out.toBlob(resolve, "image/png");
  });
}
