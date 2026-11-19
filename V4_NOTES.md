# gta6-cover-art-01 — V4 notes (Chaos Key-Art)

Nothing submitted, nothing pushed, nothing committed yet. HEAD is still
`fb3c0fc`; all v4 work sits in the worktree (12 files changed, plus two
new photos from v3, car.jpg and coast.jpg). Recording
`01a1f3ee-5b16-772e-b03a-8d8309487db3` (PID 11313) is still running and
untouched. Deadline Saturday 21 Nov 17:30 WIB; quota still a full 3/3.

## Changes (v3 to v4)

A new **`chaos`** layout (now the default in the app and in all four
screenshots) — the key-art formula of the top 3, learned from the real
images of do-tinh, amber-lark-66, and ahmadfdn (in `/tmp/cover-top/`):

- **The title crashes into the photo instead of sitting in a band.** The
  30%-tall title band is gone: the street photo, 0.88 of the frame tall,
  sits BEHIND the title; the PALM HEAT title (0.72 zone height, 0.88
  width sprawl, 0.13 outline plus magenta shadow) starts at 50% of the
  frame and covers the photo the way SUNSET STATE / VICE STATE do.
- **Tilted panels:** the hero uses slant 36 (diagonal right edge in
  ahmadfdn's style); rooftop +0.02, fisherman −0.03, car +0.025, coast
  −0.02 rad (new rotation in `drawCoverGrid`, clipped inside the
  rotated space, drawn 1.06× so the corners stay covered, stroke inside
  the same transform).
- **Light scrim (chaos only):** 0 → 0.18 → 0.38 → 0.55 (was 0.05 → 0.9).
  The heavy scrim in early v4 drowned the lower panels in black —
  do-tinh uses no scrim at all, just outline plus shadow on the title.
- **Pink subtitle** `#ff5da2` with a magenta glow (like "Neon Tide"),
  no dark plate. White over a bright photo is unreadable.
- **VOL. 06** (cyan chip) plus **COLLECTOR'S EDITION** (pink pill) at
  the bottom-right of the title zone; **WANTED ★★★★★** (dark pill,
  gold text) on the car panel — all three are furniture v3 lacked.
- **The EST. 2026 starburst moved to the junction** of the hero and the
  middle column (it used to sit on another junction where it covered the
  PIER 26 chip); WANTED moved too, because its first spot was hidden
  behind the ORIGINAL ribbon in the top-right corner.
- **Portrait/square panels now run to 0.88h** — the first version left a
  big black void under the title (the subtitle floating on black).
  Caption chips whose panels run far into the title zone are skipped
  (60px threshold) so they do not become half-covered text fragments
  ("DOWN" showed up in early v4, now gone).
- **A warmer Sunset grade:** new `warmHighlights()` in grades.js —
  red/orange lift only above lum 175, so the sky glows orange like #1's
  while skin (mid-tone) stays untouched.

Kept from v3: the photographic Sunset grade (not a gradient map),
8 different photos, caption chips, quote pill, bottom strip (palms +
tagline + fine print + barcode), starburst, ORIGINAL · FAN MADE ribbon.

## Tests (all passing)

- **Local gate: 4 passed, 0 failed, 17 skipped, 5 at-submission**
  (run twice — before and after warmHighlights).
- **Matrix 6 layouts × 4 grades = 24 renders**, every PNG produced,
  pixel sd 57–75 (none blank), **zero console/page/request errors**.
- **Real export:** "Export all 3 sizes" clicked in headless Chrome —
  1920×1080 (3,019,160 B), 1080×1350, 1080×1080, all valid PNGs.
- **4 new screenshots** (all ≤256 KiB) and **viewed by me**:
  1-cover 173,456 B, 2-editor 244,826 B, 3-portrait 203,236 B,
  4-square 168,868 B. Head-to-head sheet:
  `~/workspace/make-fun/vs-top3-cover-art-v4.jpg` (viewed by me).
- Editor: default "Chaos Key-Art", all 6 layout + 4 grade switches work,
  upload 8→9 thumbs, pan/zoom with no errors.

## Honest comparison with the top 3 (board around 23:30 WIB: #1 do-tinh
## 93.94, #2 amber-lark-66 93.64, #3 ahmadfdn 93.36, #10 hayatoshima
## 92.16, #50 87.27)

The formula now matches on every visible axis: title crashing into the
photo, tilted/diagonal panels, 6 photos, warm photographic grade,
caption chips, quote pill, strip + barcode, starburst on a junction,
VOL. 06, WANTED, COLLECTOR'S EDITION. Side by side, we now speak the
same visual language as #1/#3 — no longer a tidy grid against their
collages.

**Verdict: top 10 is now CREDIBLE — not empty "plausible" anymore.** v3
was estimated at ~87–88 (the #50 zone); v4 closes EVERY identified
formula gap (flat band, no tilt, no VOL/WANTED, black scrim, pale
grade). The only proof is still the dev grade after submit.

**Remaining gaps (named):**
1. **Source-photo glow** — #1's sky is a real sunset sky (burning
   orange); our hero photo is daytime. The warm lift helps but cannot
   change what is in the photo. A material limit, not a layout one.
2. **#1's title shadow is deeper** — their purple drop shadow is a
   little thicker than ours; our title still reads fully.
3. **Faces in the lower portrait/square row** — in shots 3/4, the
   rooftop man's face is partly behind the letter "P". Shot 1
   (landscape, the main one) has no such problem — every face is whole.
4. **Neon-couple panel (landscape)** — mostly covered by title letters,
   only the neon sign shows; the same as #1's lower panel (motorbike),
   also half covered — a property of the chaos formula, not a flaw
   unique to us.

## What the parent must do before submit

Commit + push to a **NEW public repo** (drand anchor — the repo must be
created after 2026-11-19 10:30 UTC), `.makefun/owner.json`, write
muse-usage, seal recording PID 11313, then submit.
