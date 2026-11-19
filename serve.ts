// A tiny static file server for the app/ folder, Node 22 with only
// the standard library. It exists so the entry can be tried on a
// laptop with no build step at all: `node serve.ts` serves app/ on
// http://localhost:8080. It hands out the MIME types an offline web
// app needs, turns away any path that escapes app/, and otherwise
// stays out of the way — a local convenience, not a server for the
// public internet.
import { createServer } from "node:http";
import { createReadStream, statSync } from "node:fs";
import { extname, join, normalize, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

const rootDir = resolve(fileURLToPath(new URL("./app", import.meta.url)));
const args = process.argv.slice(2);
const flagIdx = args.indexOf("--port");
let requested = 8080;
if (flagIdx !== -1) {
  requested = Number(args[flagIdx + 1]);
}
let port = 8080;
if (Number.isInteger(requested) && requested > 0 && requested < 65536) {
  port = requested;
}

// MIME types by extension, kept as pairs so the table stays sortable.
const TYPES_BY_EXT = new Map([
  [".bin", "application/octet-stream"],
  [".css", "text/css; charset=utf-8"],
  [".gif", "image/gif"],
  [".html", "text/html; charset=utf-8"],
  [".ico", "image/x-icon"],
  [".jpeg", "image/jpeg"],
  [".jpg", "image/jpeg"],
  [".js", "text/javascript; charset=utf-8"],
  [".json", "application/json; charset=utf-8"],
  [".mjs", "text/javascript; charset=utf-8"],
  [".mp3", "audio/mpeg"],
  [".ogg", "audio/ogg"],
  [".otf", "font/otf"],
  [".png", "image/png"],
  [".svg", "image/svg+xml"],
  [".ttf", "font/ttf"],
  [".txt", "text/plain; charset=utf-8"],
  [".wasm", "application/wasm"],
  [".wav", "audio/wav"],
  [".webp", "image/webp"],
  [".woff", "font/woff"],
  [".woff2", "font/woff2"],
]);

function mimeFor(name) {
  let found = TYPES_BY_EXT.get(extname(name).toLowerCase());
  if (found === undefined) {
    found = "application/octet-stream";
  }
  return found;
}

createServer((req, res) => {
  const parsed = new URL(req.url ?? "/", "http://localhost");
  let rel;
  try {
    rel = decodeURIComponent(parsed.pathname);
  } catch {
    res.writeHead(400).end("bad request");
    return;
  }
  if (rel.endsWith("/")) {
    rel = rel + "index.html";
  }
  const abs = resolve(join(rootDir, normalize(rel)));
  const inside = abs === rootDir || abs.startsWith(rootDir + sep);
  if (inside === false) {
    res.writeHead(403).end("forbidden");
    return;
  }
  let size;
  let isFile = false;
  try {
    const stat = statSync(abs);
    isFile = stat.isFile();
    size = stat.size;
  } catch {
    isFile = false;
  }
  if (isFile === false) {
    res.writeHead(404).end("not found");
    return;
  }
  res.writeHead(200, {
    "cache-control": "no-store",
    "content-length": size,
    "content-type": mimeFor(abs),
  });
  createReadStream(abs).pipe(res);
}).listen(port, "127.0.0.1", () => {
  console.log("serving app/ at http://localhost:" + port);
});
