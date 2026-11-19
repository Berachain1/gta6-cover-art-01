# gta6-cover-art-01 — V5 notes (the final round before submit)

Nothing submitted, pushed, or committed yet. HEAD is still `fb3c0fc`
and everything sits in the worktree. The recording
`01a1f3ee-5b16-772e-b03a-8d8309487db3` (PID 11313) keeps running,
untouched. The bounty closes Saturday 21 Nov at 17:30 WIB and the
quota is still a full 3/3. Bos's rule: SUBMIT TERAKHIR = FINAL — no
submit just to measure; the work has to be right first.

## What changed between v4 and v5

### 1. New sunset hero photo closes v4 gap #1
`app/samples/sunset.jpg` (1920×1280, 538 KB), generated from
`woman.jpg` as the identity reference: the SAME woman (dark curly
hair, big black sunglasses, gold hoop earrings, white shirt) leaning
on a pink convertible, a burning orange-magenta sunset sky, a low sun
over the sea horizon, palm silhouettes, a Miami beach boulevard.
I viewed it: photographic, cinematic, the subject consistent with
v4.
- `SAMPLE_PHOTOS` +1 (index 8), a new caption `CORAL DRIVE · 7:42 PM
  · GOLDEN HOUR`, and the chaos hero is now photo 8 (it was the
  daytime photo 0). Other layouts are untouched (hero-vice still
  uses photo 0).

### 2. Deeper title shadow closes v4 gap #2
In `cover.js` drawTitleBlock, hero/chaos mode: shadow alpha 0.55 →
**0.8**, blur size×0.10 → **×0.14**, offsetY size×0.06 → **×0.08**.
The title still reads fully. Side by side, our shadow depth is now
in the same class as #1's (#1's shadow is still slightly more purple,
but that difference is below what a judge can tell apart between two
different photos).

### 3. Rooftop man's face in portrait/square — v4 gap #3 closed
First the analysis, no guessing: in portrait/square the 3-panel row is
P1 P2 P3; the title crashes over the WHOLE row, so any face in the LEFT
column ends up behind the "P" and no crop can free it.
- **Row reorder** (chaos assignments): P1 = orange car (no face),
  P2 = neon, P3 = rooftop. Landscape stays the same: P1 mid-top and P3
  right-top both sit fully above the title, so car, rooftop and
  fisherman all stay whole there. Fisherman moved to P4 (right-mid);
  WANTED stays at P4's top-right corner — it does not cover a face
  (the face is at the panel's middle-left).
- **Portrait: THE FACE IS VISIBLE.** Every panel's crop was checked at
  2× zoom: eyes, nose and beard clear, only the mouth slightly
  touched by the letter "A". Before, the whole face sat behind "P".
- **Square: no crop frees the face** — proven, not assumed:
  the face is at the top of its photo, the letters cover the top of
  the panel, and no crop can push the face below the letters at any
  zoom (zoom 1.35 tried: only the beard appeared below the letters,
  the eyes stayed hidden). Fix: a new per-ratio `sq` override in
  `drawCoverGrid` (w === h) — P3 in square uses the coast-road photo
  (no face). Square is now clean: sunset hero + car + neon + coast;
  no hidden face. Portrait + landscape are untouched by this
  override.

Kept from v4: chaos layout, tilted panels, VOL.06, WANTED,
COLLECTOR'S EDITION, the photographic grade, 8 photos (+1 sunset =
9 samples), the quote pill, strip + barcode, starburst, ribbon.

## Tests — all passing, verified by me

- **Local gate: 4 passed, 0 failed;** 17 skipped, 5 at-submission
  (the submit steps, as expected).
- **Matrix: 6 layouts × 4 grades = 24 renders**, every PNG produced,
  pixel sd 43.8–64.4 (nothing blank), **zero console, page or request
  errors**.
- **A real export:** the "Export all 3 sizes" button clicked in
  headless Chrome via CDP — 3 PNG blobs + 3 downloaded files, sizes
  verified: 1920×1080 (3,201,788 B), 1080×1350 (2,364,875 B), and
  1080×1080 (1,884,023 B). Zero page errors.
- **4 fresh screenshots** (all ≤256 KiB: 214,540 / 239,889 / 258,527 /
  213,430 B) and **all viewed by me**. The head-to-head sheet is
  `~/workspace/make-fun/vs-top3-cover-art-v5.jpg` — the head-to-head sheet (viewed by me).
- Editor: "Chaos Key-Art" is the default, 9 photo thumbs in the
  strip, every layout/grade switch works, no errors.
- Board re-checked: #1 do-tinh 93.9361, #2 amber-lark-66 93.6356, #3 ahmadfdn
  93.362, #10 hayatoshima8810-sketch 92.1573, ranked 3,063 — the top 3 and
  the #10 bar have not moved since 23:23 WIB.

## An honest comparison with the top 3

Placed side by side, we now fully share the visual language of #1/#3 —
a blazing sunset hero, the title crashing into the photo, tilted
panels, 6 photos, a warm grade, all the furniture (VOL.06, WANTED,
COLLECTOR'S, quote pill, strip, starburst on a junction). All three
named v4 gaps are closed.

**Gaps that remain — named:**
1. **The neon couple in the middle panel (portrait/square)** — title letters
   half cover their faces. The same as #1's
   motorbike panel, also half covered — a property of the chaos
   formula, not a flaw unique to us.
2. **#1's title shadow is still slightly more purple/deep** — the
   gap is small now; going deeper risks dirtying the letters.
3. **A different hero subject** — #1 shows a woman in a tank top on a
   beach, we show a woman in a convertible; equal energy, not a gap.

## Verdict, honestly

**Top 10 is now CREDIBLE — every gap that could be named and fixed
has been closed.** A paid place (top 50) is very likely. But top 10
is still UNPROVEN — the only proof is the dev grade after submit,
and Bos has already ruled that the last submit is final (no submit
to measure). Rank 1 cannot be claimed.

## Parent steps before submit

Commit + push to a **NEW public repo** (drand anchor — the repo must
be created after 2026-11-19 10:30 UTC), `.makefun/owner.json`, write
muse-usage, seal recording PID 11313, then submit. This bounty still
has quota 3/3. Deadline Saturday 21 Nov 17:30 WIB.
