// cover.js — the cover renderer.
//
// drawCoverGrid paints a full GTA-style poster onto any 2D canvas at any
// size: a multi-panel photo grid with black gutters, a gradient-map or
// poster-ink grade on every panel, one huge gradient title block with a
// neon script subtitle, and poster furniture (starburst badge, HEAT
// stars, barcode, ORIGINAL ribbon). exportCoverPNG renders the same art
// offscreen at the exact post size and hands back a PNG blob.
//
// The title block comes in four shapes: 'cell' (the title is one grid
// cell), 'band' (a full-width band, used for portrait / square re-flows),
// 'hero' (a full-width band whose title is stretched to sprawl across
// the whole width, like the top covers) and 'overlap' (the title floats
// over the panels). In overlap mode the letters sit on a dark scrim,
// and the script subtitle gets its own solid dark plate behind it —
// without that plate the subtitle can land on a bright, busy photo area
// and disappear, which is exactly what happens on the Tilted layout's
// lower panels.

import { gradePanelImage, drawCroppedPhoto } from "./grades.js";

// Post sizes and their labels, as [key, width, height, label] rows.
const EXPORT_SIZE_ROWS = [
  ["landscape", 1920, 1080, "1920 × 1080"],
  ["portrait", 1080, 1350, "1080 × 1350"],
  ["square", 1080, 1080, "1080 × 1080"],
];
export const EXPORT_SIZES = Object.fromEntries(
  EXPORT_SIZE_ROWS.map((row) => [row[0], { w: row[1], h: row[2], label: row[3] }]),
);

// Layout names for the editor picker, as [key, label] rows.
const LAYOUT_ROWS = [
  ["chaos", "Chaos Key-Art · tilted collage + title over photos"],
  ["hero-vice", "Hero Vice · big-face hero + title band + strip"],
  ["vice-grid", "Vice Grid · 9-panel poster"],
  ["hero-three", "Hero + Three"],
  ["tilted", "Tilted Snapshots"],
  ["full-bleed", "Full Bleed"],
];
export const LAYOUTS = Object.fromEntries(LAYOUT_ROWS);

// Grade names for the editor picker, as [key, label] rows.
const GRADE_ROWS = [
  ["ink", "Poster Ink"],
  ["sunset", "Sunset"],
  ["neon", "Neon Night"],
  ["golden", "Golden Hour"],
];
export const GRADES = Object.fromEntries(GRADE_ROWS);

const GUT = 10;

/**
 * Panel geometry for a layout at (w, h). Returns { panels, title, badge }:
 * panels are {x, y, w, h} rects (optionally `slant` for diagonal cuts or
 * `snap` for a rotated polaroid); title is the title-block rect plus a
 * `mode` ('cell' | 'band' | 'overlap'); badge is the starburst position.
 */
export function layoutPanels(w, h, layout) {
  const gutter = GUT * (w / 1920);
  const isTall = h >= w;
  const panels = [];

  // hero-vice puts one LARGE hero panel on the left (a big face, about
  // half the cover), a 2-stack middle column and a 3-stack right column
  // above it, a WIDE title band across the full width — 30%, the title
  // zone of the top covers, not a 42% flat slab — and a thin bottom
  // strip with palms, tagline, fine print, and barcode. The title
  // sprawls across the band the way the top-2 covers do; a press-quote
  // pill straddles the panel/title boundary, and every panel carries a
  // location/time caption chip.
  if (layout === "hero-vice") {
    const bandH = h * 0.3;
    const stripH = h * 0.075;
    const topH = h - bandH - stripH - gutter * 4;
    const titleY = gutter + topH + gutter;
    const stripTop = titleY + bandH + gutter;
    const strip = { x: gutter, y: stripTop, w: w - gutter * 2, h: h - stripTop - gutter };
    if (isTall) {
      const heroH = topH * 0.6;
      panels.push({ x: gutter, y: gutter, w: w - gutter * 2, h: heroH });
      const colW = (w - gutter * 4) / 3;
      const rowH = topH - heroH - gutter;
      let c = 0;
      while (c < 3) {
        panels.push({ x: gutter + c * (colW + gutter), y: gutter + heroH + gutter, w: colW, h: rowH });
        c += 1;
      }
      return {
        panels,
        title: { x: gutter, y: titleY, w: w - gutter * 2, h: bandH, mode: "hero" }, // hero-vice tall
        strip,
        badge: { x: 76, y: 76 }, // hero-vice tall
      };
    }
    const heroW = w * 0.46 - gutter;
    const midW = w * 0.235 - gutter;
    const rightW = w * 0.305 - gutter * 2;
    const midLeft = gutter + heroW + gutter;
    const rightLeft = midLeft + midW + gutter;
    panels.push({ x: gutter, y: gutter, w: heroW, h: topH });
    const midH = (topH - gutter) / 2;
    panels.push({ x: midLeft, y: gutter, w: midW, h: midH });
    panels.push({ x: midLeft, y: gutter + midH + gutter, w: midW, h: midH });
    const rowH = (topH - gutter * 2) / 3;
    let r = 0;
    while (r < 3) {
      panels.push({ x: rightLeft, y: gutter + r * (rowH + gutter), w: rightW, h: rowH });
      r += 1;
    }
    return {
      panels,
      title: { x: gutter, y: titleY, w: w - gutter * 2, h: bandH, mode: "hero" }, // hero-vice wide
      strip,
      badge: { x: gutter + 64, y: gutter + 64 },
    };
  }

  // chaos is the top-3 covers' key-art collage. Photos run the full
  // height BEHIND the title — the title crashes OVER them from about 50%
  // down, like do-tinh's SUNSET STATE / ahmadfdn's VICE STATE — and
  // there is no title band at all. The hero panel's right edge is a
  // diagonal (slant), one mid panel and two right panels are rotated a
  // few degrees, and the starburst sits on a panel junction instead of a
  // corner. `wanted` is the top-right anchor of the fisherman panel for
  // the WANTED pill.
  if (layout === "chaos") {
    const stripH = h * 0.075;
    const stripTop = h - stripH - gutter;
    const strip = { x: gutter, y: stripTop, w: w - gutter * 2, h: h - stripTop - gutter };
    const title = { x: 0, y: h * 0.5, w, h: h * (isTall ? 0.34 : 0.38), mode: "chaos" };
    if (isTall) {
      const heroH = h * 0.44;
      panels.push({ x: gutter, y: gutter, w: w - gutter * 2, h: heroH, slant: 30 });
      const colW = (w - gutter * 4) / 3;
      // The row runs down to the photo bottom (0.88h) so photos fill
      // behind the title all the way to the strip — a short row left a
      // black scrim void under the title in portrait/square.
      const rowY = gutter + heroH + gutter;
      const rowH = h * 0.88 - rowY;
      panels.push({ x: gutter, y: rowY, w: colW, h: rowH, rot: -0.02 });
      panels.push({ x: gutter + colW + gutter, y: rowY, w: colW, h: rowH });
      panels.push({ x: gutter + 2 * (colW + gutter), y: rowY, w: colW, h: rowH, rot: 0.025 });
      return {
        panels,
        title,
        strip,
        badge: { x: w * 0.66, y: gutter + heroH + gutter },
        wanted: { x: gutter + 3 * colW + gutter * 2, y: rowY },
      };
    }
    const photoBase = h * 0.88;
    const topH = photoBase - gutter;
    const heroW = w * 0.44 - gutter;
    const midLeft = gutter + heroW + gutter;
    const midW = w * 0.24 - gutter;
    const rightLeft = midLeft + midW + gutter;
    const rightW = w - rightLeft - gutter;
    panels.push({ x: gutter, y: gutter, w: heroW, h: topH, slant: 36 });
    const midH = (topH - gutter) / 2;
    panels.push({ x: midLeft, y: gutter, w: midW, h: midH, rot: 0.02 });
    panels.push({ x: midLeft, y: gutter + midH + gutter, w: midW, h: midH, rot: -0.015 });
    const rowH = (topH - gutter * 2) / 3;
    panels.push({ x: rightLeft, y: gutter, w: rightW, h: rowH, rot: -0.03 });
    panels.push({ x: rightLeft, y: gutter + rowH + gutter, w: rightW, h: rowH, rot: 0.025 });
    panels.push({ x: rightLeft, y: gutter + 2 * (rowH + gutter), w: rightW, h: rowH, rot: -0.02 });
    return {
      panels,
      title,
      strip,
      // Starburst on the hero/mid-column junction up where no caption
      // chip lives (the old junction sat on the fisherman's chip), and
      // WANTED on the car panel's top-right — the fisherman panel's
      // top-right is under the ORIGINAL ribbon, which hid the pill.
      badge: { x: midLeft, y: topH * 0.22 },
      wanted: { x: rightLeft + rightW, y: gutter + rowH + gutter },
    };
  }

  if (layout === "vice-grid") {
    if (isTall) {
      const colW = (w - gutter * 3) / 2;
      const rowH = (h * 0.62 - gutter * 4) / 3;
      let r = 0;
      while (r < 3) {
        let c = 0;
        while (c < 2) {
          panels.push({ x: gutter + c * (colW + gutter), y: gutter + r * (rowH + gutter), w: colW, h: rowH });
          c += 1;
        }
        r += 1;
      }
      const titleY = gutter + 3 * (rowH + gutter);
      return {
        panels,
        title: { x: gutter, y: titleY, w: w - gutter * 2, h: h - titleY - gutter, mode: "band" },
        badge: { x: 76, y: 76 }, // vice-grid tall
      };
    }
    const colW = (w - gutter * 4) / 3;
    const rowH = (h - gutter * 4) / 3;
    let r = 0;
    while (r < 3) {
      let c = 0;
      while (c < 3) {
        if (r === 1 && c === 1) {
          // centre cell is the title block
        } else {
          panels.push({ x: gutter + c * (colW + gutter), y: gutter + r * (rowH + gutter), w: colW, h: rowH });
        }
        c += 1;
      }
      r += 1;
    }
    return {
      panels,
      title: { x: gutter + (colW + gutter), y: gutter + (rowH + gutter), w: colW, h: rowH, mode: "cell" },
      badge: { x: gutter + 64, y: gutter + 64 },
    };
  }

  if (layout === "hero-three") {
    if (isTall) {
      const heroH = h * 0.44;
      panels.push({ x: gutter, y: gutter, w: w - gutter * 2, h: heroH });
      const colW = (w - gutter * 4) / 3;
      const rowH = h * 0.2;
      let c = 0;
      while (c < 3) {
        panels.push({ x: gutter + c * (colW + gutter), y: heroH + gutter * 2, w: colW, h: rowH });
        c += 1;
      }
      const titleY = heroH + rowH + gutter * 3;
      return {
        panels,
        title: { x: gutter, y: titleY, w: w - gutter * 2, h: h - titleY - gutter, mode: "band" },
        badge: { x: 76, y: 76 }, // hero-three tall
      };
    }
    const heroW = w * 0.56;
    panels.push({ x: gutter, y: gutter, w: heroW - gutter, h: h - gutter * 2 });
    const restW = w - heroW - gutter * 2;
    const rowH = (h - gutter * 4) / 3;
    let r = 0;
    while (r < 3) {
      panels.push({ x: heroW + gutter, y: gutter + r * (rowH + gutter), w: restW, h: rowH });
      r += 1;
    }
    return {
      panels,
      title: { x: gutter, y: h * 0.66, w: w - gutter * 2, h: h * 0.34 - gutter, mode: "overlap" },
      badge: { x: 78, y: 54 },
    };
  }

  if (layout === "tilted") {
    if (isTall) {
      const heroH = h * 0.4;
      panels.push({ x: gutter, y: gutter, w: w - gutter * 2, h: heroH, slant: 40 });
      const colW = (w - gutter * 3) / 2;
      const rowH = h * 0.24;
      panels.push({ x: gutter, y: heroH + gutter * 2, w: colW, h: rowH, slant: -30 });
      panels.push({ x: gutter + colW + gutter, y: heroH + gutter * 2, w: colW, h: rowH, slant: 30 });
      const titleY = heroH + rowH + gutter * 3;
      return {
        panels,
        title: { x: gutter, y: titleY, w: w - gutter * 2, h: h - titleY - gutter, mode: "band" },
        badge: { x: 76, y: 76 }, // tilted tall
      };
    }
    const heroW = w * 0.5;
    panels.push({ x: gutter, y: gutter, w: heroW, h: h * 0.62, slant: 46 });
    panels.push({ x: heroW + gutter, y: gutter, w: w - heroW - gutter * 2, h: h * 0.62, slant: -46 });
    const botW = (w - gutter * 4) / 3;
    let c = 0;
    while (c < 3) {
      const slant = c === 1 ? 0 : (c === 0 ? 26 : -26);
      panels.push({ x: gutter + c * (botW + gutter), y: h * 0.62 + gutter, w: botW, h: h * 0.38 - gutter * 2, slant });
      c += 1;
    }
    return {
      panels,
      title: { x: w * 0.22, y: h * 0.42, w: w * 0.56, h: h * 0.3, mode: "overlap" },
      badge: { x: gutter + 64, y: gutter + 64 },
    };
  }

  // full-bleed: one photo fills the frame, snapshots float on top.
  if (isTall) {
    panels.push({ x: 0, y: 0, w, h: h * 0.72 });
    panels.push({ x: gutter, y: h * 0.52, w: w * 0.42, h: h * 0.2, snap: true });
    return {
      panels,
      title: { x: 0, y: h * 0.72, w, h: h * 0.28, mode: "band" },
      badge: { x: 76, y: 76 }, // full-bleed tall
    };
  }
  panels.push({ x: 0, y: 0, w, h });
  panels.push({ x: w * 0.66, y: gutter * 2, w: w * 0.3, h: h * 0.34, snap: true });
  panels.push({ x: w * 0.04, y: h * 0.06, w: w * 0.24, h: h * 0.3, snap: true });
  return {
    panels,
    title: { x: 0, y: h * 0.6, w, h: h * 0.4, mode: "overlap" },
    badge: { x: w * 0.5, y: 60 },
  };
}

/** How many photo panels a layout has. */
export function panelCount(layout) {
  switch (layout) {
    case "chaos":
      return 6;
    case "vice-grid":
      return 8;
    case "hero-vice":
      return 6;
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

/** The Anton size that fits `text` inside `limit`, shrinking 2 px at a time. */
export function fitTitleFont(ctx, text, limit, cap, face = "Anton") {
  let px = cap;
  ctx.font = px + "px " + face + ", sans-serif";
  while (px > 20 && ctx.measureText(text).width > limit) {
    px = px - 2;
    ctx.font = px + "px " + face + ", sans-serif";
  }
  return px;
}

/** A filled rounded-rectangle path (avoids any ctx.roundRect dependency). */
export function roundRectPath(ctx, x, y, w, h, corner) {
  const radius = Math.min(corner, h / 2, w / 2);
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.lineTo(x + w - radius, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + radius);
  ctx.lineTo(x + w, y + h - radius);
  ctx.quadraticCurveTo(x + w, y + h, x + w - radius, y + h);
  ctx.lineTo(x + radius, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - radius);
  ctx.lineTo(x, y + radius);
  ctx.quadraticCurveTo(x, y, x + radius, y);
  ctx.closePath();
}

/** A spiky starburst badge (EST. 2026 / NEW) with two lines of text. */
export function drawStarburstBadge(ctx, cx, cy, r, line1, line2) {
  ctx.save();
  ctx.translate(cx, cy);
  ctx.beginPath();
  const spikes = 14;
  let i = 0;
  while (i < 2 * spikes) {
    const a = (i * Math.PI) / spikes - Math.PI / 2;
    let rad = r * 0.78;
    if (i % 2 === 0) {
      rad = r;
    }
    const sx = Math.cos(a) * rad;
    const sy = Math.sin(a) * rad;
    if (i === 0) {
      ctx.moveTo(sx, sy);
    } else {
      ctx.lineTo(sx, sy);
    }
    i += 1;
  }
  ctx.closePath();
  ctx.fillStyle = "#ffd23f";
  ctx.fill();
  ctx.lineWidth = Math.max(0.07 * r, 2);
  ctx.strokeStyle = "#14041f";
  ctx.stroke();
  ctx.fillStyle = "#14041f";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.font = r * 0.42 + "px Anton, sans-serif";
  ctx.fillText(line1, 0, r * -0.16);
  ctx.font = r * 0.26 + "px Anton, sans-serif";
  ctx.fillText(line2, 0, r * 0.24);
  ctx.restore();
}

/** Five HEAT stars, `heat` of them filled gold. */
export function drawHeatStars(ctx, cx, y, size, heat, fill = "#ffd23f", stroke = "#14041f") {
  ctx.save();
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.font = size + "px sans-serif";
  const pitch = size * 1.15;
  const firstX = cx - 2 * pitch;
  let i = 0;
  while (i < 5) {
    if (i < heat) {
      ctx.fillStyle = fill;
    } else {
      ctx.fillStyle = "rgba(255,255,255,0.28)";
    }
    ctx.strokeStyle = stroke;
    ctx.lineWidth = Math.max(0.06 * size, 1);
    const sx = firstX + i * pitch;
    ctx.strokeText("★", sx, y);
    ctx.fillText("★", sx, y);
    i += 1;
  }
  ctx.restore();
}

/** A fake barcode strip, seeded by the title so it is stable per cover. */
export function drawBarcode(ctx, x, y, w, h, seedText) {
  ctx.save();
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(x, y, w, h);
  let code = 7;
  for (const ch of seedText) {
    code = (ch.charCodeAt(0) + 31 * code) % 997;
  }
  let cursorX = x + w * 0.04;
  let roll = code;
  ctx.fillStyle = "#14041f";
  while (cursorX < x + w * 0.96) {
    roll = (16807 * roll) % 2147483647;
    const barW = 1 + (roll % 4) * (w / 220);
    if (roll % 3 !== 0) {
      ctx.fillRect(cursorX, y + h * 0.08, barW, h * 0.72);
    }
    cursorX += barW + w / 220;
  }
  ctx.restore();
}

/** A simple palm silhouette: curved trunk plus drooping fronds. */
export function drawPalmSilhouette(ctx, x, y, scale, color) {
  ctx.save();
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
    const angle = (-160 + 52 * f) * (Math.PI / 180);
    ctx.beginPath();
    ctx.moveTo(4, -110);
    ctx.quadraticCurveTo(
      Math.cos(angle) * 55 + 4, Math.sin(angle) * 42 - 110,
      Math.cos(angle) * 88 + 4, Math.sin(angle) * 78 - 110,
    );
    ctx.stroke();
    f += 1;
  }
  ctx.restore();
}

/**
 * The title block: a sunset-gradient panel, an eyebrow, one huge
 * gradient title (auto-fit, black outline), a neon script subtitle, a
 * tagline, and HEAT stars.
 *
 * In overlap mode the block floats over photos, so it paints a dark
 * scrim first and gives the script subtitle its own solid dark plate —
 * without that plate, the subtitle can land on a bright, busy photo
 * area and disappear, which is exactly what happens on the Tilted
 * layout's lower panels.
 */
export function drawTitleBlock(ctx, rect, state) {
  const x = rect.x;
  const y = rect.y;
  const w = rect.w;
  const h = rect.h;
  const mode = rect.mode === undefined ? "cell" : rect.mode;
  ctx.save();
  if (mode === "cell" || mode === "band" || mode === "hero") {
    const bg = ctx.createLinearGradient(x, y, x, y + h);
    if (mode === "hero") {
      // Deep magenta-purple at the top so the yellow title reads, warming
      // to pink, orange and amber at the bottom — the top-2 bands' shape.
      bg.addColorStop(0, "#8a1c63");
      bg.addColorStop(0.35, "#ff2e7e");
      bg.addColorStop(0.7, "#ff7a2f");
      bg.addColorStop(1, "#ffb03a");
    } else {
      bg.addColorStop(0, "#ff2e7e");
      bg.addColorStop(0.45, "#ff7a2f");
      bg.addColorStop(1, "#ffb03a");
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
    const scrim = ctx.createLinearGradient(x, y, x, y + h);
    if (mode === "chaos") {
      scrim.addColorStop(0, "rgba(16,2,26,0)");
      scrim.addColorStop(0.3, "rgba(16,2,26,0.18)");
      scrim.addColorStop(0.62, "rgba(16,2,26,0.38)");
      scrim.addColorStop(1, "rgba(16,2,26,0.55)");
    } else {
      scrim.addColorStop(0, "rgba(16,2,26,0.05)");
      scrim.addColorStop(0.3, "rgba(16,2,26,0.5)");
      scrim.addColorStop(0.62, "rgba(16,2,26,0.78)");
      scrim.addColorStop(1, "rgba(16,2,26,0.9)");
    }
    ctx.fillStyle = scrim;
    ctx.fillRect(x, y, w, h);
  }

  const centerX = x + w / 2;
  const inset = w * 0.04;
  const head = (state.title === undefined || state.title === "" ? "PALM HEAT" : state.title).toUpperCase();
  const sub = state.subtitle === undefined ? "" : state.subtitle;
  const locale = (state.place === undefined || state.place === "" ? "CORAL BAY" : state.place).toUpperCase();
  const tag = (state.tagline === undefined ? "" : state.tagline).toUpperCase();

  // Eyebrow: WELCOME TO · PLACE. Skipped in hero and chaos mode — the
  // enlarged title (caps + outline + shadow) reaches up into the eyebrow
  // line and paints over it; #1/#2 run a bare title band too.
  if (mode !== "hero" && mode !== "chaos") {
    ctx.textAlign = "center";
    ctx.textBaseline = "alphabetic";
    const browSize = Math.max(13, Math.min(w * 0.045, h * 0.11));
    ctx.font = browSize + "px Anton, sans-serif";
    if (mode === "overlap") {
      ctx.fillStyle = "#ffd23f";
    } else {
      ctx.fillStyle = "#fff3c4";
    }
    ctx.fillText("★  WELCOME TO " + locale + "  ★", centerX, y + h * 0.12);
  }

  // Main title — gradient fill, thick black outline, hard shadow.
  // (textAlign is set here, not in the eyebrow block above, because hero
  // mode skips the eyebrow — a one-word title must still centre.)
  ctx.textAlign = "center";
  ctx.textBaseline = "alphabetic";
  // Hero and chaos mode: the title must SPRAWL across the band like the
  // top-2 covers, not sit in the middle — so it is sized tall, then
  // stretched horizontally (glyph scale, capped) with the remaining width
  // taken up by letter tracking. Short titles like PALM HEAT would
  // otherwise occupy only half the band. Chaos sprawls a touch wider
  // (0.88) and taller (0.72) than hero — its title crashes over photos.
  let capSize = Math.min(w * 0.52, h * 0.52);
  if (mode === "hero") {
    capSize = h * 0.66;
  } else if (mode === "chaos") {
    capSize = h * 0.72;
  }
  const px = fitTitleFont(ctx, head, w - 2 * inset, capSize);
  let titleY = y + (sub !== "" ? 0.6 : 0.64) * h;
  if (mode === "hero") {
    titleY = y + 0.58 * h;
  } else if (mode === "chaos") {
    titleY = y + 0.52 * h;
  }
  const fill = ctx.createLinearGradient(0, titleY - px, 0, titleY + px * 0.12);
  fill.addColorStop(0, "#ffe14d");
  fill.addColorStop(0.5, "#ff9a2f");
  fill.addColorStop(1, "#ff2e7e");
  ctx.font = px + "px Anton, sans-serif";
  ctx.lineJoin = "round";
  const outlineW = mode === "hero" ? 0.13 : 0.11;
  ctx.lineWidth = Math.max(3, px * outlineW);
  ctx.strokeStyle = "#14041f";
  // Hero and chaos mode: a magenta drop shadow behind the black outline,
  // the way the top covers' titles lift off the band (or off the photos).
  if (mode === "hero" || mode === "chaos") {
    // v5: deeper than v4 (0.55/0.10/0.06) — #1's title shadow sits
    // visibly deeper than ours; the title stays fully readable.
    ctx.shadowColor = "rgba(255,46,126,0.8)";
    ctx.shadowBlur = px * 0.14;
    ctx.shadowOffsetY = px * 0.08;
  } else {
    ctx.shadowColor = "rgba(20,4,31,0.65)";
    ctx.shadowBlur = px * 0.08;
    ctx.shadowOffsetY = px * 0.05;
  }
  let stretch = 1;
  let tracking = 0;
  if (mode === "hero" || mode === "chaos") {
    const rawW = ctx.measureText(head).width;
    const goalW = w * (mode === "chaos" ? 0.88 : 0.85);
    stretch = Math.min(1.15, goalW / Math.max(1, rawW));
    tracking = Math.max(0, (goalW - rawW * stretch) / Math.max(1, head.length - 1));
    ctx.save();
    ctx.translate(centerX, 0);
    ctx.scale(stretch, 1);
    ctx.translate(-centerX, 0);
    ctx.letterSpacing = tracking + "px";
  }
  // Hero and chaos mode with a multi-word title: draw word by word so the
  // gap between words is a controlled 2x tracking, not the space advance
  // plus tracking (which leaves a canyon between PALM and HEAT).
  if ((mode === "hero" || mode === "chaos") && head.includes(" ")) {
    const words = head.split(" ");
    const widths = words.map((wd) => ctx.measureText(wd).width);
    // Word gap is just the space advance plus a little tracking — the
    // 2x tracking gap left a canyon between PALM and HEAT; #2's
    // SUNSET HEIST sits tight, about a third of a letter wide.
    const wordGap = 0.1 * px + tracking;
    const totalW = widths.reduce((a, b) => b + a, 0) + (words.length - 1) * wordGap;
    ctx.textAlign = "left";
    let penX = centerX - totalW / 2;
    let i = 0;
    while (i < words.length) {
      ctx.strokeText(words[i], penX, titleY);
      penX += widths[i] + wordGap;
      i += 1;
    }
    ctx.fillStyle = fill;
    penX = centerX - totalW / 2;
    i = 0;
    while (i < words.length) {
      ctx.fillText(words[i], penX, titleY);
      penX += widths[i] + wordGap;
      i += 1;
    }
    ctx.textAlign = "center";
  } else {
    ctx.strokeText(head, centerX, titleY);
    ctx.fillStyle = fill;
    ctx.fillText(head, centerX, titleY);
  }
  if (mode === "hero" || mode === "chaos") {
    ctx.restore();
    ctx.letterSpacing = "0px";
  }
  ctx.shadowColor = "transparent";
  ctx.shadowBlur = 0;
  ctx.shadowOffsetY = 0;

  // Neon script subtitle — on a solid dark plate in overlap mode so it
  // never sits directly on a busy photo. Chaos mode skips the plate: its
  // subtitle sits on the dark end of the scrim like do-tinh's "Neon Tide",
  // white with a hot-pink glow.
  if (sub !== "") {
    let subPx = Math.min(w * 0.085, h * 0.17, px * 0.42);
    if (mode === "hero") {
      subPx = Math.min(w * 0.08, h * 0.17, px * 0.4);
    } else if (mode === "chaos") {
      subPx = Math.min(w * 0.075, h * 0.17, px * 0.38);
    }
    const subTop = y + h * (mode === "hero" ? 0.85 : 0.8);
    ctx.font = subPx + "px Pacifico, cursive";
    if (mode === "overlap") {
      const plateW = Math.min(w * 0.92, ctx.measureText(sub).width + subPx * 1.1);
      roundRectPath(ctx, centerX - plateW / 2, subTop - subPx * 0.72, plateW, subPx * 1.15, subPx * 0.32);
      ctx.fillStyle = "rgba(16,2,26,0.82)";
      ctx.fill();
    }
    if (mode === "chaos") {
      ctx.fillStyle = "#ff5da2";
    } else {
      ctx.fillStyle = "#ffffff";
    }
    ctx.shadowColor = "#ff2e9e";
    ctx.shadowBlur = subPx * 0.5;
    ctx.fillText(sub, centerX, subTop);
    ctx.shadowBlur = 0;
  }

  // Tagline + HEAT stars live in the bottom strip in hero and chaos mode
  // (the title zone is full — title + script fill it); other modes keep
  // them inside the block as before.
  if (mode !== "hero" && mode !== "chaos") {
    const tagTop = y + h * (sub !== "" ? 0.9 : 0.85);
    if (tag !== "") {
      const tagPx = Math.max(11, Math.min(w * 0.032, h * 0.07));
      ctx.font = tagPx + "px Anton, sans-serif";
      ctx.fillStyle = "#ffffff";
      ctx.fillText(tag, centerX, tagTop);
    }
    // Gold stars vanish on the orange hero band, so the hero band gets
    // dark stars with a light outline instead.
    drawHeatStars(ctx, centerX, y + h * 0.965, Math.max(12, h * 0.07), state.heat === undefined ? 5 : state.heat, "#ffd23f", "#14041f");
  }
  ctx.restore();
}

// A thin bottom strip under the title band (hero mode): a magenta
// gradient with dark palm silhouettes, the tagline, fine print and a
// barcode — the furniture every top-5 cover carries at the foot.
export function drawBottomStrip(ctx, rect, state) {
  const x = rect.x;
  const y = rect.y;
  const w = rect.w;
  const h = rect.h;
  const scale = w / 1920;
  ctx.save();
  const wash = ctx.createLinearGradient(x, y, x + w, y);
  wash.addColorStop(0, "#ff2e7e");
  wash.addColorStop(0.5, "#a01e68");
  wash.addColorStop(1, "#ff2e7e");
  ctx.fillStyle = wash;
  ctx.fillRect(x, y, w, h);
  // Palm silhouettes, clipped to the strip so fronds bleed off its edge
  // the way the top covers' palm strips do.
  ctx.save();
  ctx.beginPath();
  ctx.rect(x, y, w, h);
  ctx.clip();
  const palm = (h * 0.72) / 110;
  drawPalmSilhouette(ctx, x + w * 0.02, y + h - 2, palm, "rgba(20,4,31,0.9)");
  drawPalmSilhouette(ctx, x + w * 0.055, y + h - 2, palm * 0.8, "rgba(20,4,31,0.9)");
  drawPalmSilhouette(ctx, x + w * 0.09, y + h - 2, palm * 0.6, "rgba(20,4,31,0.9)");
  drawPalmSilhouette(ctx, x + w * 0.885, y + h - 2, palm * 0.7, "rgba(20,4,31,0.9)");
  ctx.restore();
  // Tagline, centred, with the fine print under it.
  ctx.textAlign = "center";
  ctx.textBaseline = "alphabetic";
  const tagPx = Math.max(12, h * 0.3);
  ctx.font = tagPx + "px Anton, sans-serif";
  ctx.fillStyle = "#ffffff";
  ctx.fillText(state.tagline === undefined ? "" : state.tagline, x + w * 0.5, y + h * 0.42);
  const fineLong = "PALM HEAT — A PALM HEAT COVER STUDIO PICTURE · STARRING YOU · SHOT ON YOUR OWN CAMERA · GRADED BY HAND · LETTERING AND SEAL ORIGINAL";
  const fineBrief = "PALM HEAT — A PALM HEAT COVER STUDIO PICTURE · STARRING YOU";
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
  const codeW = scale * 88;
  const codeH = h * 0.62;
  const codeX = x + w - codeW - scale * 10;
  const codeY = y + (h - codeH) / 2;
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(codeX - scale * 3, codeY - scale * 3, codeW + scale * 6, codeH + scale * 6);
  ctx.fillStyle = "#14041f";
  let pen = codeX;
  let roll = 11;
  while (pen < codeX + codeW - 2) {
    roll = (31 * roll + 7) % 97;
    const stripeW = 1 + (roll % 3) * 1.4;
    if (roll % 3 !== 0) {
      ctx.fillRect(pen, codeY, stripeW, codeH);
    }
    pen += stripeW + 1.8;
  }
  ctx.restore();
}

// A small pill label right-aligned to `edgeX`, top edge at `top` —
// returns the pill's left edge so a second pill can sit beside it. The
// furniture the top-3 covers carry that v3 lacked: the cyan VOL. 06 chip
// and the pink COLLECTOR'S EDITION ribbon (#2/#3), and the dark WANTED
// pill with gold stars (#2/#3).
function drawPillRight(ctx, edgeX, top, text, bg, fg, fs, opt = {}) {
  ctx.save();
  ctx.font = fs + "px Anton, sans-serif";
  const textW = ctx.measureText(text).width;
  const pad = fs * 0.75;
  const pillW = textW + 2 * pad;
  const pillH = fs * 1.75;
  ctx.translate(edgeX - pillW * 0.5, top + pillH * 0.5);
  if (opt.rot !== undefined) {
    ctx.rotate(opt.rot);
  }
  const corner = opt.square ? Math.max(0.15 * fs, 3) : pillH * 0.5;
  roundRectPath(ctx, pillW * -0.5, pillH * -0.5, pillW, pillH, corner);
  ctx.fillStyle = bg;
  ctx.fill();
  if (opt.stroke !== undefined) {
    ctx.lineWidth = Math.max(0.09 * fs, 1.5);
    ctx.strokeStyle = opt.stroke;
    ctx.stroke();
  }
  ctx.fillStyle = fg;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(text, 0, fs * 0.05);
  ctx.restore();
  return edgeX - pillW;
}

// WANTED ★★★★★ pill on a photo panel's top-right corner (chaos mode),
// tilted a touch like a stuck-on label.
export function drawWantedPill(ctx, anchor, coverW) {
  const scale = Math.max(coverW / 1920, 0.5);
  const px = Math.max(13, scale * 24);
  drawPillRight(ctx, anchor.x - scale * 10, anchor.y + scale * 10, "WANTED ★★★★★", "#14041f", "#ffd23f", px, { rot: -0.02, stroke: "#ffd23f" });
}

// VOL. 06 chip + COLLECTOR'S EDITION ribbon at the title zone's
// bottom-right (chaos mode), the way #2/#3 carry them.
export function drawVolCluster(ctx, titleRect, state) {
  const scale = Math.max(titleRect.w / 1920, 0.5);
  const px = Math.max(13, scale * 26);
  const top = titleRect.y + titleRect.h * 0.86;
  const edge = titleRect.x + titleRect.w - titleRect.w * 0.025;
  const volEdge = drawPillRight(ctx, edge, top, "VOL. 06", "#22d3ee", "#0b2a33", px, { square: true });
  drawPillRight(ctx, volEdge - scale * 12, top, "COLLECTOR'S EDITION", "#ff2e7e", "#ffffff", px, { square: true });
}

// A press-quote pill straddling the panel/title boundary (hero mode) —
// the top covers' star-quote strip, condensed into a pill so it never
// covers a face. Wording is original, not copied from any top entry.
export function drawQuotePill(ctx, titleRect, state) {
  const centerX = titleRect.x + titleRect.w / 2;
  const edgeY = titleRect.y;
  const scale = titleRect.w / 1920;
  const mark = "★★★★★";
  const quote = "‘THE CITY NEVER SLEEPS’ — THE CORAL HERALD";
  ctx.save();
  const px = Math.max(12, scale * 21);
  ctx.font = px + "px Anton, sans-serif";
  const markW = ctx.measureText(mark).width;
  const quoteW = ctx.measureText(quote).width;
  const gap = scale * 10;
  const pad = scale * 18;
  const pillW = markW + gap + quoteW + 2 * pad;
  const pillH = scale * 42;
  roundRectPath(ctx, centerX - pillW * 0.5, edgeY - pillH * 0.5, pillW, pillH, pillH * 0.5);
  ctx.fillStyle = "#14041f";
  ctx.fill();
  ctx.lineWidth = Math.max(2 * scale, 1.5);
  ctx.strokeStyle = "#ffd23f";
  ctx.stroke();
  ctx.textAlign = "left";
  ctx.textBaseline = "middle";
  ctx.fillStyle = "#ffd23f";
  ctx.fillText(mark, centerX - pillW * 0.5 + pad, edgeY);
  ctx.fillStyle = "#ffffff";
  ctx.fillText(quote, centerX - pillW * 0.5 + pad + markW + gap, edgeY);
  ctx.restore();
}

// A small location/time chip in a panel's bottom-left corner — the
// caption chips every top-5 cover puts on its panels. Skips panels too
// narrow to hold the chip rather than clipping it.
export function drawPanelCaption(ctx, p, cap, coverW) {
  if (cap === undefined || cap === null) {
    return;
  }
  const scale = Math.max(coverW / 1920, 0.5);
  const insetX = scale * 10;
  const insetY = scale * 7;
  const placePx = Math.max(15 * scale, 11);
  const linePx = Math.max(11 * scale, 9);
  const sub = cap.time + " · " + cap.line;
  ctx.save();
  ctx.textAlign = "left";
  ctx.textBaseline = "alphabetic";
  ctx.font = placePx + "px Anton, sans-serif";
  const placeW = ctx.measureText(cap.place).width;
  ctx.font = linePx + "px sans-serif";
  const lineW = ctx.measureText(sub).width;
  const boxW = Math.max(placeW, lineW) + 2 * insetX;
  const boxH = 2 * insetY + placePx + 4 * scale + linePx;
  const boxX = p.x + scale * 8;
  const boxY = p.y + p.h - boxH - scale * 8;
  if (boxW > p.w - scale * 16 || boxH > p.h - scale * 16) {
    ctx.restore();
    return;
  }
  roundRectPath(ctx, boxX, boxY, boxW, boxH, scale * 4);
  ctx.fillStyle = "rgba(12,2,20,0.85)";
  ctx.fill();
  ctx.fillStyle = "#ffffff";
  ctx.font = placePx + "px Anton, sans-serif";
  ctx.fillText(cap.place, boxX + insetX, insetY + boxY + placePx);
  ctx.fillStyle = "#ffd7ef";
  ctx.font = linePx + "px sans-serif";
  ctx.fillText(sub, boxX + insetX, insetY + boxY + placePx + 4 * scale + linePx);
  ctx.restore();
}

/**
 * Draws the whole cover onto `ctx` at the canvas's own size.
 * `state` carries layout, grade, texts, heat, assignments and photo
 * images; `photos` is the array of loaded images; assignments index
 * into it.
 */
export function drawCoverGrid(canvas, state, photos) {
  const ctx = canvas.getContext("2d");
  const w = canvas.width;
  const h = canvas.height;
  ctx.fillStyle = "#0d0214";
  ctx.fillRect(0, 0, w, h);
  const geo = layoutPanels(w, h, state.layout);
  const panels = geo.panels;
  const title = geo.title;
  const badge = geo.badge;
  const strip = geo.strip;
  const wanted = geo.wanted;
  const layoutAssigns = state.assignments[state.layout];
  const assigns = layoutAssigns === undefined ? [] : layoutAssigns;
  const cache = new Map();
  const keyFor = (pi, pw, ph, crop) =>
    pi + "|" + pw + "x" + ph + "|" + crop.fx.toFixed(2) + "," + crop.fy.toFixed(2) + "," + crop.zoom.toFixed(2);

  panels.forEach((panel, idx) => {
    const fallback = { photo: 0, fx: 0.5, fy: 0.4, zoom: 1 };
    const base = assigns[idx] === undefined ? fallback : assigns[idx];
    // v5: per-ratio override — one crop cannot serve both the tall
    // portrait row and the short square row. A face that escapes the
    // title in portrait can sit fully behind the letters in square
    // (the face is at the top of its photo, the letters cover the top
    // of the panel, and the crop cannot push it below them). `sq`
    // replaces photo/crop for the square render only; landscape and
    // portrait are untouched.
    const crop = w === h && base.sq !== undefined ? { ...base, ...base.sq } : base;
    const photo = photos[crop.photo] === undefined ? photos[0] : photos[crop.photo];
    let layer = null;
    if (photo !== undefined) {
      const key = keyFor(crop.photo, Math.round(panel.w), Math.round(panel.h), crop);
      layer = cache.get(key);
      if (layer === undefined) {
        // Grade at most ~760 px wide, then upscale — fast and smooth.
        const cap = 760;
        const factor = cap / panel.w < 1 ? cap / panel.w : 1;
        layer = gradePanelImage(photo, Math.max(factor * panel.w, 2), Math.max(factor * panel.h, 2), crop, state.grade);
        cache.set(key, layer);
      }
    }
    if (panel.rot !== undefined) {
      // Rotated photo card (chaos): clip to the panel rect in rotated
      // space and draw the graded image slightly oversized so the corners
      // stay covered after the rotation — the collage tilt of the top
      // covers. The black edge is stroked inside the same transform.
      ctx.save();
      ctx.translate(panel.x + panel.w / 2, panel.y + panel.h / 2);
      ctx.rotate(panel.rot);
      ctx.beginPath();
      ctx.rect(-panel.w / 2, -panel.h / 2, panel.w, panel.h);
      ctx.clip();
      if (layer !== null) {
        ctx.drawImage(layer, -0.53 * panel.w, -0.53 * panel.h, 1.06 * panel.w, 1.06 * panel.h);
      }
      ctx.strokeStyle = "#0d0214";
      ctx.lineWidth = (w / 1920) * GUT;
      ctx.strokeRect(-0.5 * panel.w, -0.5 * panel.h, panel.w, panel.h);
      ctx.restore();
    } else {
      ctx.save();
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
        const dx = panel.snap ? -0.04 * panel.w : 0;
        const dy = panel.snap ? -0.04 * panel.h : 0;
        const dw = (panel.snap ? 1.08 : 1) * panel.w;
        const dh = (panel.snap ? 1.08 : 1) * panel.h;
        if (panel.snap) {
          // White polaroid border around the snapshot.
          ctx.fillStyle = "#ffffff";
          ctx.fillRect(-0.05 * panel.w, -0.05 * panel.h, 1.1 * panel.w, 1.16 * panel.h);
          ctx.drawImage(layer, dx, dy, dw, dh);
        } else {
          ctx.drawImage(layer, panel.x, panel.y, panel.w, panel.h);
        }
      }
      ctx.restore();
      // Black gutter edge per panel.
      ctx.save();
      ctx.strokeStyle = "#0d0214";
      ctx.lineWidth = GUT * (w / 1920);
      ctx.beginPath();
      ctx.rect(panel.x, panel.y, panel.w, panel.h);
      ctx.stroke();
      ctx.restore();
    }
    // Location/time caption chip in the panel's bottom-left corner
    // (hero mode + any layout that wants it; off when the editor toggles
    // captions off). In chaos mode a chip whose panel runs deep under
    // the title would sit under the dark scrim and turn muddy — the top
    // covers leave those panels clean — so skip it.
    const hiddenByTitle = state.layout === "chaos" && panel.y + panel.h > title.y + 60;
    if (state.showCaptions !== false && hiddenByTitle === false) {
      const caps = state.captions === undefined ? [] : state.captions;
      const stored = caps[crop.photo];
      const caption = stored === undefined
        ? { place: "YOUR SHOT", time: "TONIGHT", line: "SHOT ON YOUR CAMERA" }
        : stored;
      drawPanelCaption(ctx, panel, caption, w);
    }
  });

  // WANTED pill on the fisherman panel (chaos mode) — drawn on the photo,
  // before the title paints over the lower panels.
  if (state.layout === "chaos" && wanted !== undefined) {
    drawWantedPill(ctx, wanted, w);
  }

  drawTitleBlock(ctx, title, state);

  // Hero and chaos furniture: the bottom strip (palms + tagline + fine
  // print + barcode) and the press-quote pill on the panel/title
  // boundary. Chaos adds the VOL. 06 chip + COLLECTOR'S EDITION ribbon.
  // Other layouts keep the old barcode placement instead.
  if ((title.mode === "hero" || title.mode === "chaos") && strip !== undefined) {
    drawBottomStrip(ctx, strip, state);
    drawQuotePill(ctx, title, state);
  }
  if (title.mode === "chaos") {
    drawVolCluster(ctx, title, state);
  }

  // Poster furniture.
  const badgeR = Math.max(w * 0.038, 34);
  drawStarburstBadge(ctx, badge.x, badge.y, badgeR, "EST.", "2026");
  if (state.showRibbon !== false) {
    ctx.save();
    const ribbonW = w * 0.2;
    const ribbonH = Math.max(h * 0.035, 18);
    ctx.fillStyle = "#ff2e7e";
    ctx.fillRect(w - ribbonW - GUT * (w / 1920), GUT * (w / 1920) + h * 0.02, ribbonW, ribbonH);
    ctx.fillStyle = "#ffffff";
    ctx.font = Math.max(11, ribbonH * 0.42) + "px Anton, sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("ORIGINAL · FAN MADE", w - ribbonW * 0.5 - GUT * (w / 1920), GUT * (w / 1920) + h * 0.02 + ribbonH * 0.5);
    ctx.restore();
  }
  if (state.showBarcode !== false && title.mode !== "cell" && title.mode !== "hero") {
    const barTitle = state.title === undefined || state.title === "" ? "PALM HEAT" : state.title;
    drawBarcode(ctx, w - w * 0.09 - GUT, h - h * 0.075, w * 0.09, h * 0.055, barTitle);
  }
  return { panels, title, strip };
}

/** Renders the cover offscreen at an exact post size and returns a PNG blob. */
export function exportCoverPNG(state, photos, sizeKey) {
  return new Promise((resolve) => {
    const dims = EXPORT_SIZES[sizeKey];
    const c = document.createElement("canvas");
    c.width = dims.w;
    c.height = dims.h;
    drawCoverGrid(c, state, photos);
    c.toBlob((blob) => resolve(blob), "image/png");
  });
}
