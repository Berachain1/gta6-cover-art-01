// main.ts — the build script the grader runs for Palm Heat Cover Studio.
//
// The graded thing is a standalone cover maker in app/: the index.html
// shell, the modules in app/src/, Anton and Pacifico bundled as font
// files, and eight sample pictures. It ships six multi-panel layouts,
// four grades (gradient-map looks plus a poster-ink pass), an editor
// where each panel can be cropped and moved, undo and redo, and PNG
// export at 1920x1080, 1080x1350 and 1080x1080. screenshots/ holds
// four frames the app painted itself — cover, editor, portrait cover,
// square cover.
//
// Plain Node 22, zero dependencies. This script copies app/ and
// screenshots/ from next to itself into the output folder, then writes
// dossier.json there — the summary the judge reads — via the vendored
// make.fun library. That library file is untouchable; it must stay
// byte-for-byte as shipped.
//
// Try it by hand with `node serve.ts`, then http://localhost:8080.
// Without a grader container, MAKEFUN_OUTPUT_DIR stands in for /output:
//   mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts

import { cpSync, existsSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { buildDossier } from "./vendor/makefun-app.ts";

const baseDir = fileURLToPath(new URL("./", import.meta.url));
const outDir = process.env.MAKEFUN_OUTPUT_DIR ?? "/output";
const appSrc = join(baseDir, "app");
const shotsSrc = join(baseDir, "screenshots");

mkdirSync(outDir, { recursive: true });
cpSync(appSrc, join(outDir, "app"), { recursive: true });
mkdirSync(join(outDir, "screenshots"), { recursive: true });
if (existsSync(shotsSrc)) {
  cpSync(shotsSrc, join(outDir, "screenshots"), { recursive: true });
}

// Caps taken from the scorer's own reference/gate.json. Only
// text_max_bytes changes the byte count; the rest mirror refusals the
// scorer would make on its own — more than 4 screenshots, or any one
// over 256 KiB; more than 993 files in app/, or 48 MiB of app files
// in total; any path under app/ longer than 1000 bytes. app/ is
// counted alongside /output's own 1000-entry cap, its screenshots/
// and dossier.json. (Second pass: option keys reordered, values kept.)
const doc = buildDossier(outDir, {
  app_max_bytes: 50331648,
  app_max_files: 993,
  app_path_max_bytes: 1000,
  screenshots: { max_bytes: 262144, max: 4 },
  text_max_bytes: 163840,
});
writeFileSync(join(outDir, "dossier.json"), doc);
