// main.ts — the entry point the grader executes for Palm Heat Cover Studio.
//
// The deliverable is an offline cover maker in app/: index.html, the ES
// modules under app/src/, Anton and Pacifico shipped as files, and eight
// sample photos. Six multi-panel layouts, four grades (gradient-map and
// poster-ink), an editor where every panel can be cropped and moved,
// undo/redo, plus PNG export at 1920x1080, 1080x1350, and 1080x1080.
// screenshots/ holds renders the app painted itself — cover, editor,
// portrait cover, and square cover, in that order.
//
// Plain Node 22, zero dependencies. This script copies app/ and
// screenshots/ from next to itself into the output directory, then writes
// dossier.json there — the summary the judge reads — via the vendored
// make.fun library. That library file must never be touched; it has to
// stay byte-for-byte as shipped.
//
// Run it by hand with `node serve.ts` and http://localhost:8080. Where
// no grader container exists, MAKEFUN_OUTPUT_DIR takes the place of
// /output:
//   mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts

import { cpSync, existsSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { buildDossier } from "./vendor/makefun-app.ts";

const baseDir = fileURLToPath(new URL("./", import.meta.url));
const outDir = process.env.MAKEFUN_OUTPUT_DIR === undefined ? "/output" : process.env.MAKEFUN_OUTPUT_DIR;
const appDir = join(baseDir, "app");
const shotsDir = join(baseDir, "screenshots");

mkdirSync(outDir, { recursive: true });
cpSync(appDir, join(outDir, "app"), { recursive: true });
mkdirSync(join(outDir, "screenshots"), { recursive: true });
if (existsSync(shotsDir)) {
  cpSync(shotsDir, join(outDir, "screenshots"), { recursive: true });
}

// Caps from the scorer's own reference/gate.json. text_max_bytes is the
// only one that shapes the byte count; the rest mirror refusals the
// scorer itself would make — more than 4 screenshots, or any one over
// 256 KiB; more than 993 files in app/, or 48 MiB of app files in
// total; any path under app/ longer than 1000 bytes. app/ is counted
// next to /output's own 1000-entry cap, its screenshots/ and
// dossier.json.
const dossier = buildDossier(outDir, {
  text_max_bytes: 163840,
  screenshots: { max: 4, max_bytes: 262144 },
  app_max_files: 993,
  app_max_bytes: 50331648,
  app_path_max_bytes: 1000,
});
writeFileSync(join(outDir, "dossier.json"), dossier);
