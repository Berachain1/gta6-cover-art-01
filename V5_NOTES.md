# V5 — the final round before submit (gta6-cover-art-01)

HEAD is still `fb3c0fc` and nothing has been submitted, pushed or committed — v5 lives only in the worktree. The recording (`01a1f3ee-5b16-772e-b03a-8d8309487db3`, PID 11313) is still running and untouched. Deadline: Saturday 21 Nov, 17:30 WIB. Quota: a full 3/3. Bos's rule stands — SUBMIT TERAKHIR = FINAL, no submit just to measure; the work has to be right first.

## Verdict up front

**Top 10 is now CREDIBLE — every gap that could be named and fixed has been closed.** A paid place (top 50) is very likely. But top 10 is still UNPROVEN — the only proof is the dev grade after submit, and Bos has already ruled that the last submit is final (no submit to measure). Rank 1 cannot be claimed.

The board, re-checked: #1 do-tinh 93.9361, #2 amber-lark-66 93.6356, #3 ahmadfdn 93.362, #10 hayatoshima8810-sketch 92.1573, ranked 3,063 — the top 3 and the #10 bar have not moved since 23:23 WIB.

## The three v4 gaps, closed

### A. Rooftop man's face in portrait/square — v4 gap #3

The analysis came first, no guessing: in portrait and square the 3-panel row runs P1 P2 P3, and the title crashes over the WHOLE row, so a face in the LEFT column ends up behind the "P" and no crop can free it.

- **Chaos row reordered:** P1 is now the orange car (no face), P2 neon, P3 rooftop. Landscape does not change: P1 mid-top and P3 right-top both sit fully above the title, so car, rooftop and fisherman all stay whole there. The fisherman moves to P4 (right-mid); WANTED stays at P4's top-right corner — it covers no face, since the face sits at the panel's middle-left.
- **Portrait: the face IS visible.** Each panel's crop was checked at 2× zoom: eyes, nose and beard clear, only the mouth slightly touched by the letter "A". Before, the whole face sat behind "P".
- **Square: no crop frees the face** — proven, not assumed. The face sits at the top of its photo, the letters cover the top of the panel, and no crop can push the face below the letters at any zoom (zoom 1.35 tried: only the beard appeared below the letters, the eyes stayed hidden). The fix is a new per-ratio `sq` override in `drawCoverGrid` (w === h) — P3 in square uses the coast-road photo (no face). Square is now clean: sunset hero + car + neon + coast, no hidden face. Portrait and landscape are untouched by this override.

### B. Sunset hero photo — v4 gap #1

`app/samples/sunset.jpg` (1920×1280, 538 KB) was generated from `woman.jpg` as the identity reference: the SAME woman — dark curly hair, big black sunglasses, gold hoop earrings, white shirt — leaning on a pink convertible, under a burning orange-magenta sunset sky, a low sun over the sea horizon, palm silhouettes, a Miami beach boulevard. I viewed it: photographic, cinematic, the subject consistent with v4.

- `SAMPLE_PHOTOS` grows by one (index 8), a new caption arrives (`CORAL DRIVE · 7:42 PM · GOLDEN HOUR`), and the chaos hero becomes photo 8 (previously the daytime photo 0). Other layouts are untouched — hero-vice still uses photo 0.

### C. Deeper title shadow — v4 gap #2

In `cover.js` drawTitleBlock, hero/chaos mode: shadow alpha 0.55 → **0.8**, blur from size×0.10 to **×0.14**, offsetY from size×0.06 to **×0.08**. The title still reads fully. Side by side, our shadow depth is now in the same class as #1's — #1's shadow is still slightly more purple, but that difference is below what a judge can tell apart between two different photos.

Carried over from v4 unchanged: chaos layout, tilted panels, VOL.06, WANTED, COLLECTOR'S EDITION, the photographic grade, 8 photos (+1 sunset = 9 samples), the quote pill, strip + barcode, starburst, ribbon.

## Tests — all passing, verified by me

- **Local gate: 4 passed, 0 failed,** 17 skipped, 5 at-submission (the submit steps, as expected).
- **Matrix: 6 layouts × 4 grades = 24 renders.** Every PNG produced, pixel sd 43.8–64.4 (nothing blank), **zero console, page or request errors**.
- **A real export.** The "Export all 3 sizes" button clicked in headless Chrome via CDP — 3 PNG blobs + 3 downloaded files, sizes verified: 1920×1080 (3,201,788 B), 1080×1350 (2,364,875 B), and 1080×1080 (1,884,023 B). Zero page errors.
- **4 fresh screenshots, all ≤256 KiB** (214,540 / 239,889 / 258,527 / 213,430 B), **all viewed by me**. Head-to-head sheet: `~/workspace/make-fun/vs-top3-cover-art-v5.jpg` (viewed by me).
- Editor: "Chaos Key-Art" is the default, 9 photo thumbs in the strip, every layout/grade switch works, no errors.

## Honest comparison with the top 3

Side by side, we now fully share the visual language of #1/#3: a blazing sunset hero, the title crashing into the photo, tilted panels, 6 photos, a warm grade, all the furniture (VOL.06, WANTED, COLLECTOR'S, quote pill, strip, starburst on a junction). All three named v4 gaps are closed.

**Gaps that remain — named:**
1. **The neon couple in the middle panel (portrait/square).** Title letters half cover their faces. #1's motorbike panel is half covered the same way — a property of the chaos formula, not a flaw unique to us.
2. **#1's title shadow is still slightly more purple/deep.** The gap is small now; going deeper risks dirtying the letters.
3. **A different hero subject.** #1 shows a woman in a tank top on a beach; we show a woman in a convertible. Equal energy, not a gap.

## Parent steps before submit

Commit + push to a **NEW public repo** (drand anchor — the repo must be created after 2026-11-19 10:30 UTC), `.makefun/owner.json`, write muse-usage, seal recording PID 11313, then submit. This bounty still has quota 3/3. Deadline Saturday 21 Nov 17:30 WIB.
