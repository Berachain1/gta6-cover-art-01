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
const requested = flagIdx === -1 ? 8080 : Number(args[flagIdx + 1]);
const port = Number.isInteger(requested) && requested > 0 && requested < 65536 ? requested : 8080;

// MIME types by extension, as a plain lookup object.
const TYPES_BY_EXT = {
  ".bin": "application/octet-stream",
  ".css": "text/css; charset=utf-8",
  ".gif": "image/gif",
  ".html": "text/html; charset=utf-8",
  ".ico": "image/x-icon",
  ".jpeg": "image/jpeg",
  ".jpg": "image/jpeg",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".mp3": "audio/mpeg",
  ".ogg": "audio/ogg",
  ".otf": "font/otf",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".ttf": "font/ttf",
  ".txt": "text/plain; charset=utf-8",
  ".wasm": "application/wasm",
  ".wav": "audio/wav",
  ".webp": "image/webp",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
};

function mimeFor(name) {
  return TYPES_BY_EXT[extname(name).toLowerCase()] ?? "application/octet-stream";
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
  rel = rel.endsWith("/") ? rel + "index.html" : rel;
  const abs = resolve(join(rootDir, normalize(rel)));
  const inside = abs === rootDir || abs.startsWith(rootDir + sep);
  if (!inside) {
    res.writeHead(403).end("forbidden");
    return;
  }
  let stat = null;
  try {
    stat = statSync(abs);
  } catch {
    stat = null;
  }
  if (stat === null || stat.isFile() === false) {
    res.writeHead(404).end("not found");
    return;
  }
  const size = stat.size;
  res.writeHead(200, {
    "content-type": mimeFor(abs),
    "content-length": size,
    "cache-control": "no-store",
  });
  createReadStream(abs).pipe(res);
}).listen(port, "127.0.0.1", () => {
  console.log(`serving app/ at http://localhost:${port}`);
});
