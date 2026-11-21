# V4 — the chaos layout becomes the default (gta6-cover-art-01)

Nothing is committed yet: HEAD still points at `fb3c0fc`, and v4 lives only in the worktree. Twelve files carry changes; car.jpg and coast.jpg come straight from v3. The recording (`01a1f3ee-5b16-772e-b03a-8d8309487db3`, PID 11313) is still going and untouched. The bounty ends Saturday 21 Nov at 17:30 WIB with the full 3/3 quota intact.

## Verdict

**A top-10 finish is CREDIBLE now — not just "plausible" in the abstract.** V3 sat around 87–88, which is #50 territory. V4 shuts every formula gap that had been called out: the flat band, the missing tilt, the absent VOL/WANTED furniture, the black scrim, the pale grade. Only the dev grade after a submit can settle whether it proves out.

The board at about 23:30 WIB reads #1 do-tinh 93.94, #2 amber-lark-66 93.64, #3 ahmadfdn 93.36, #10 hayatoshima 92.16, #50 87.27.

Every visible axis now matches the formula: the title crashes into the photo, panels tilt and run diagonally, six photos, a warm photographic grade, caption chips, a quote pill, strip plus barcode, a starburst parked on a junction, VOL. 06, WANTED, COLLECTOR'S EDITION. Put next to #1 and #3, the cover now speaks their visual language — it is no longer a neat grid standing against their collages.

## What changed: `chaos` is the default everywhere

The heart of v4 is a layout named **chaos**, now the default in the app and in all four screenshots. It rebuilds the key-art formula the top 3 use, worked out from the real entries of do-tinh, amber-lark-66 and ahmadfdn (kept under `/tmp/cover-top/`):

- **Three furniture pieces v3 lacked.** **VOL. 06** (a cyan chip) and **COLLECTOR'S EDITION** (a pink pill) at the bottom-right of the title zone, plus **WANTED ★★★★★** (a dark pill with gold text) on the car panel.
- **The title overlaps the photo now; the band is gone.** The title band, 30% tall, is removed. The street photo covers 0.88 of the frame height and lies BEHIND the title; PALM HEAT (0.72 zone height, 0.88 width sprawl, 0.13 outline, magenta shadow) begins at 50% of the frame and crosses the photo, the way SUNSET STATE and VICE STATE do it on the leaders' covers.
- **Panels tilt.** The hero gets slant 36 — a diagonal right edge in ahmadfdn's style — and the smaller panels get small rotations: rooftop +0.02, fisherman −0.03, car +0.025, coast −0.02 rad. The rotation is new in `drawCoverGrid`: clip inside the rotated space, paint at 1.06× so the corners stay covered, stroke inside the same transform.
- **Starburst and WANTED moved.** The EST. 2026 starburst now sits on the junction of the hero and the middle column — its old spot covered the PIER 26 chip. WANTED moved as well: its first spot hid behind the ORIGINAL ribbon in the top-right corner.
- **A far lighter scrim, chaos only.** The gradient went from 0.05 → 0.9 down to 0 → 0.18 → 0.38 → 0.55. The first heavy scrim drowned the lower panels in black; do-tinh runs no scrim at all, just outline plus shadow on the title.
- **Pink subtitle, no plate.** `#ff5da2` with a magenta glow — the "Neon Tide" treatment. White type over a bright photo cannot be read, so the plate is gone and the colour does the work.
- **Portrait and square panels now reach 0.88h.** The first version left a big black void under the title with the subtitle floating on black. Caption chips on panels that reach far into the title zone are skipped (60px threshold), so half-covered text fragments never show up — "DOWN" appeared in early v4 and is gone.
- **A warmer Sunset grade.** New `warmHighlights()` in grades.js: a red/orange lift only above lum 175, so the sky glows orange like #1's while mid-tone skin stays untouched.

Carried over from v3 without change: the photographic Sunset grade (no gradient map), 8 different photos, caption chips, the quote pill, the bottom strip (palms, tagline, fine print, barcode), the starburst, and the ORIGINAL · FAN MADE ribbon.

## Checks — all green

- **Local gate returned 4 passed, 0 failed, 17 skipped and 5 at-submission** — run twice, once before warmHighlights and once after it.
- **Matrix: 24 renders from 6 layouts × 4 grades.** Every PNG came out, pixel sd 57–75 (nothing blank), and **not one console, page or request error**.
- **A real export.** "Export all 3 sizes" clicked in headless Chrome produced valid PNGs at 1920×1080 (3,019,160 B), 1080×1350 and 1080×1080.
- **4 fresh screenshots, all ≤256 KiB, all viewed by me:** 1-cover 173,456 B, 2-editor 244,826 B, 3-portrait 203,236 B, 4-square 168,868 B. The head-to-head sheet is `~/workspace/make-fun/vs-top3-cover-art-v4.jpg` (viewed by me).
- Editor: "Chaos Key-Art" is the default; every one of the 6 layout and 4 grade switches works; an upload grows the strip from 8 to 9 thumbs; pan and zoom run with no errors.

## Gaps still open, named

1. **Source-photo glow.** #1's sky is a genuine sunset sky (burning orange); our hero photo is daytime. The warm lift helps but cannot change what is in the photo — a material limit, not a layout one.
2. **#1's title shadow is deeper.** Their purple drop shadow runs a little thicker than ours; our title still reads fully.
3. **Faces in the lower portrait/square row.** In shots 3/4 the rooftop man's face is partly behind the letter "P". Shot 1 (landscape, the main one) has no such problem — every face is whole.
4. **The neon-couple panel (landscape).** Mostly covered by title letters; only the neon sign shows. #1's lower panel (motorbike) is half covered the same way — a property of the chaos formula, not a flaw unique to us.

## Parent steps before submit

Commit + push to a **NEW public repo** (drand anchor — the repo must be created after 2026-11-19 10:30 UTC), `.makefun/owner.json`, write muse-usage, seal recording PID 11313, then submit the entry.
