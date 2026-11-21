// main.ts — the dossier builder the grader executes for Palm Heat Cover Studio.
//
// What gets graded is a self-contained cover maker living in app/:
// the index.html shell, the modules under app/src/, Anton and Pacifico
// shipped as font files, and eight sample pictures. It offers six
// multi-panel layouts, four grades (gradient-map looks plus a
// poster-ink pass), an editor where every panel can be cropped and
// shifted around, undo and redo, and PNG export at 1920x1080,
// 1080x1350 and 1080x1080. The screenshots/ directory holds four
// frames the app drew on its own — cover, editor, portrait cover,
// square cover.
//
// Plain Node 22, no dependencies whatsoever. This script copies app/
// and screenshots/ from beside itself into the output folder, then
// writes dossier.json there — the summary the judge reads — through
// the vendored make.fun library. That library file is untouchable; it
// must remain byte-for-byte as it was shipped.
//
// Try it by hand with `node serve.ts`, then http://localhost:8080.
// Where there is no grader container, MAKEFUN_OUTPUT_DIR takes the
// place of /output:
//   mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts

import { cpSync, existsSync, mkdirSync, writeFileSync } from "node:fs";
import {
  join,
} from "node:path";
import {
  fileURLToPath,
} from "node:url";
import {
  buildDossier,
} from "./vendor/makefun-app.ts";

const baseDir = fileURLToPath(new URL("./", import.meta.url));
const outDir = process.env.MAKEFUN_OUTPUT_DIR ?? "/output";
const appFolder = join(baseDir, "app");
const shotsFolder = join(baseDir, "screenshots");

mkdirSync(outDir, { recursive: true });
mkdirSync(join(outDir, "screenshots"), { recursive: true });
cpSync(appFolder, join(outDir, "app"), { recursive: true });
existsSync(shotsFolder) && cpSync(shotsFolder, join(outDir, "screenshots"), { recursive: true });

// Limits copied from the scorer's own reference/gate.json. Only
// text_max_bytes shapes the byte count; the rest mirror refusals the
// scorer would make on its own — more than 4 screenshots, or any one
// over 256 KiB; more than 993 files in app/, or 48 MiB of app files
// altogether; any path under app/ longer than 1000 bytes. app/ is
// tallied beside /output's own 1000-entry cap, its screenshots/ and
// dossier.json. (Second pass: option keys reordered, values untouched.)
const dossier = buildDossier(outDir, {
  text_max_bytes: 163840,
  screenshots: { max: 4, max_bytes: 262144 },
  app_path_max_bytes: 1000,
  app_max_files: 993,
  app_max_bytes: 50331648,
});
writeFileSync(join(outDir, "dossier.json"), dossier);
