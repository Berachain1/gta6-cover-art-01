// main.ts — the build step the grader runs for this entry.
//
// The graded piece is the cover studio in app/: a shell page, the
// modules in app/src/, Anton and Pacifico as files, and eight sample
// pictures. Six multi-panel layouts, four grades, a panel editor
// with crop and move, undo/redo, and PNG export in three sizes
// (1920x1080, 1080x1350, 1080x1080). The screenshots/ folder holds
// four frames the app drew itself: cover, editor, portrait, square.
//
// Node 22, no dependencies. The script copies app/ and screenshots/
// next to it into the output directory, then asks the vendored
// make.fun library to write dossier.json — the summary the judge
// reads. The vendored file must never change; it stays byte-identical.
//
// Local run: `node serve.ts`, then open http://localhost:8080.
// Outside a grader container, MAKEFUN_OUTPUT_DIR replaces /output:
//   mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts

import { cpSync, existsSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { buildDossier } from "./vendor/makefun-app.ts";

// The directory this file sits in, and the graded output directory.
const here = fileURLToPath(new URL("./", import.meta.url));
const outDir = process.env.MAKEFUN_OUTPUT_DIR ?? "/output";

// Copy one tree, creating the destination first. A missing source is
// fine — the destination folder is still made, so the output keeps
// its shape either way.
function copyTree(from, to) {
  mkdirSync(to, { recursive: true });
  if (existsSync(from)) {
    cpSync(from, to, { recursive: true });
  }
}

mkdirSync(outDir, { recursive: true });
copyTree(join(here, "app"), join(outDir, "app"));
copyTree(join(here, "screenshots"), join(outDir, "screenshots"));

// Limits from the scorer's own reference/gate.json. Only
// text_max_bytes changes the byte count; the rest mirror refusals the
// scorer would make by itself — more than 4 screenshots, or any one
// over 256 KiB; more than 993 files under app/, or 48 MiB of app
// files in total; any path under app/ longer than 1000 bytes. app/
// counts toward /output's own 1000-entry cap, alongside its
// screenshots/ and dossier.json.
const dossier = buildDossier(outDir, {
  text_max_bytes: 163840,
  screenshots: { max: 4, max_bytes: 262144 },
  app_max_files: 993,
  app_max_bytes: 50331648,
  app_path_max_bytes: 1000,
});
writeFileSync(join(outDir, "dossier.json"), dossier);
