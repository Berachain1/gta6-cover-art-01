# V4 build notes — gta6-cover-art-01 (Chaos Key-Art)

Still unsubmitted, unpushed, uncommitted. HEAD is still `fb3c0fc` and
every bit of v4 lives in the worktree: 12 files changed, plus car.jpg
and coast.jpg, two photos that arrived with v3. The recording
`01a1f3ee-5b16-772e-b03a-8d8309487db3` (PID 11313) is still running,
untouched. The bounty closes Saturday 21 Nov at 17:30 WIB and the
quota is still untouched at 3/3.

## What changed between v3 and v4

The headline is a brand-new **`chaos`** layout, now the default in the
app and in all four screenshots. It copies the key-art formula of the
top 3, worked out from the real entries of do-tinh, amber-lark-66 and
ahmadfdn (saved under `/tmp/cover-top/`):

- **The title smashes into the photo instead of floating in its own
  band.** The 30%-tall title band is deleted: the street photo, 0.88
  of the frame tall, now sits BEHIND the title, and the PALM HEAT
  title (0.72 zone height, 0.88 width sprawl, 0.13 outline plus a
  magenta shadow) starts at 50% of the frame and covers the photo the
  way SUNSET STATE and VICE STATE do on the leaders' covers.
- **Tilted panels:** the hero carries slant 36 (a diagonal right edge,
  ahmadfdn's style); rooftop +0.02, fisherman −0.03, car +0.025 and
  coast −0.02 rad (a new rotation in `drawCoverGrid`, clipped inside
  the rotated space, painted 1.06× so the corners stay covered, with
  the stroke inside the same transform).
- **A lighter scrim, chaos only:** 0 → 0.18 → 0.38 → 0.55 (it was
  0.05 → 0.9). The first heavy scrim drowned the lower panels in
  black — do-tinh runs no scrim at all, just outline plus shadow on
  the title.
- **Pink subtitle** `#ff5da2` with a magenta glow (the "Neon Tide"
  treatment) and no dark plate behind it. White type over a bright
  photo is unreadable.
- **VOL. 06** (a cyan chip) plus **COLLECTOR'S EDITION** (a pink
  pill) at the bottom-right of the title zone; **WANTED ★★★★★** (a
  dark pill, gold text) on the car panel — three pieces of furniture
  v3 simply did not have.
- **The EST. 2026 starburst moved to the junction** of the hero and
  the middle column (its old spot covered the PIER 26 chip); WANTED
  moved as well, because its first spot sat hidden behind the
  ORIGINAL ribbon in the top-right corner.
- **Portrait and square panels now run to 0.88h** — the first version
  left a big black void under the title, with the subtitle floating
  on black. Caption chips on panels that run far into the title zone
  are skipped (a 60px threshold), so they never become half-covered
  text fragments ("DOWN" showed up in early v4 and is gone now).
- **A warmer Sunset grade:** a new `warmHighlights()` in grades.js —
  a red/orange lift only above lum 175, so the sky glows orange the
  way #1's does while skin (mid-tone) stays untouched.

Carried over from v3: the photographic Sunset grade (not a gradient
map), 8 different photos, caption chips, the quote pill, the bottom
strip (palms + tagline + fine print + barcode), the starburst, and
the ORIGINAL · FAN MADE ribbon.

## Tests — everything passing

- **Local gate: 4 passed, 0 failed; 17 skipped, 5 at-submission**
  (checked twice — once before and once after warmHighlights).
- **Matrix: 6 layouts × 4 grades = 24 renders**, every PNG produced,
  pixel sd 57–75 (nothing blank), **zero console/page/request
  errors**.
- **A real export:** "Export all 3 sizes" clicked in headless
  Chrome — 1920×1080 (3,019,160 B), 1080×1350 and 1080×1080, all
  valid PNGs.
- **4 fresh screenshots** (all ≤256 KiB) and **viewed by me**:
  1-cover 173,456 B, 2-editor 244,826 B, 3-portrait 203,236 B, 4-square
  168,868 B. The head-to-head sheet is `~/workspace/make-fun/vs-top3-cover-art-v4.jpg`
  (viewed by me).
- Editor: "Chaos Key-Art" is the default, all 6 layout and 4 grade
  switches work, upload grows the strip 8→9 thumbs, pan/zoom runs
  with no errors.

## Stacked against the top 3

Board around 23:30 WIB: #1 do-tinh 93.94, #2 amber-lark-66 93.64, #3 ahmadfdn 93.36, #10 hayatoshima 92.16, #50 87.27.

The formula now matches on every visible axis: the title crashing
into the photo, tilted/diagonal panels, 6 photos, a warm
photographic grade, caption chips, a quote pill, strip + barcode, a
starburst on a junction, VOL. 06, WANTED, COLLECTOR'S EDITION. Side
by side, we now speak the same visual language as #1 and #3 — no
longer a tidy grid set against their collages.

**Verdict: top 10 is now CREDIBLE — not empty "plausible" any more.**
v3 was estimated around 87–88 (the #50 zone); v4 closes EVERY
formula gap that was identified (the flat band, no tilt, no
VOL/WANTED, the black scrim, the pale grade). The only proof left is
still the dev grade after submit.

**Gaps that remain (named):**
1. **Source-photo glow** — #1's sky is a genuine sunset sky (burning
   orange); our hero photo is daytime. The warm lift helps but it
   cannot change what is in the photo. A material limit, not a
   layout one.
2. **#1's title shadow is deeper** — their purple drop shadow runs a
   little thicker than ours; our title still reads fully.
3. **Faces in the lower portrait/square row** — in shots 3/4, the
   rooftop man's face is partly behind the letter "P". Shot 1
   (landscape, the main one) has no such problem — every face is
   whole.
4. **The neon-couple panel (landscape)** — mostly covered by title
   letters, only the neon sign shows; the same as #1's lower panel
   (motorbike), also half covered — a property of the chaos formula,
   not a flaw unique to us.

## Parent steps before submit

Commit + push to a **NEW public repo** (drand anchor — the repo must
be created after 2026-11-19 10:30 UTC), `.makefun/owner.json`, write
muse-usage, seal recording PID 11313, then submit the entry.
