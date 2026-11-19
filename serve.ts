// A minimal static file server for the app/ folder, Node 22 with only
// the standard library. It exists so the entry can be tried on a laptop
// with no build step at all: `node serve.ts` serves app/ on
// http://localhost:8080. It serves the MIME types an offline web app
// needs, rejects any path that escapes app/, and otherwise stays out of
// the way — a local convenience, not a server for the public internet.
import { createServer } from "node:http";
import { createReadStream, statSync } from "node:fs";
import { extname, join, normalize, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

const rootDir = resolve(fileURLToPath(new URL("./app", import.meta.url)));
const args = process.argv.slice(2);
const flagIdx = args.indexOf("--port");
const requested = flagIdx === -1 ? 8080 : Number(args[flagIdx + 1]);
const port = Number.isInteger(requested) && requested > 0 && requested < 65536 ? requested : 8080;

// MIME types by extension, so the table stays sortable.
const TYPES_BY_EXT = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".webp": "image/webp",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
  ".woff2": "font/woff2",
  ".woff": "font/woff",
  ".ttf": "font/ttf",
  ".otf": "font/otf",
  ".bin": "application/octet-stream",
  ".wasm": "application/wasm",
  ".wav": "audio/wav",
  ".mp3": "audio/mpeg",
  ".ogg": "audio/ogg",
  ".txt": "text/plain; charset=utf-8",
};

function mimeFor(name) {
  const found = TYPES_BY_EXT[extname(name).toLowerCase()];
  return found === undefined ? "application/octet-stream" : found;
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
  if (abs !== rootDir && abs.startsWith(rootDir + sep) === false) {
    res.writeHead(403).end("forbidden");
    return;
  }
  let size;
  try {
    const stat = statSync(abs);
    if (stat.isFile() === false) {
      throw new Error("not a file");
    }
    size = stat.size;
  } catch {
    res.writeHead(404).end("not found");
    return;
  }
  res.writeHead(200, {
    "cache-control": "no-store",
    "content-type": mimeFor(abs),
    "content-length": size,
  });
  createReadStream(abs).pipe(res);
}).listen(port, "127.0.0.1", () => {
  console.log("serving app/ at http://localhost:" + port);
});
