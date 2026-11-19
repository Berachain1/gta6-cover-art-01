# Palm Heat — GTA 6 Cover Studio

A cover maker that runs entirely in your browser: pick a burning-sunset hero photo, arrange it across six multi-panel layouts, paint one of four grades over it, drag every panel where you want it — then take the finished cover home as a PNG.

[![make.fun · gta6-cover-art-01](https://make.fun/badge/gta6-cover-art-01.svg)](https://make.fun/bounty/gta6-cover-art-01)
[![rank](https://make.fun/badge/gta6-cover-art-01/berachain1/gta6-cover-art-01/rank.svg)](https://make.fun/bounty/gta6-cover-art-01/leaderboard)
[![reward](https://make.fun/badge/gta6-cover-art-01/berachain1/gta6-cover-art-01/reward.svg)](https://make.fun/bounty/gta6-cover-art-01)

This repo is my entry for the [gta6-cover-art-01 bounty on make.fun](https://make.fun/bounty/gta6-cover-art-01). Want to try make.fun yourself? Join with my referral: https://make.fun/r/tmeqzjwq

## Inside the studio

- Six multi-panel cover layouts, plus four grades (gradient-map looks and a poster-ink treatment)
- A live editor: crop and move every panel, with undo/redo
- A sunset hero photo under an Anton title and a Pacifico script subtitle
- PNG exports at 1920x1080, 1080x1350, and 1080x1080
- Fully offline, plain Node 22, no dependencies; Anton and Pacifico ship as files, along with eight sample photos

## Running it

```sh
node serve.ts # start the studio
```

Then open http://localhost:8080 in your browser.

## The screenshot set

The `screenshots/` folder holds four renders painted by the app itself: the cover, the editor, the portrait cover, and the square cover.
