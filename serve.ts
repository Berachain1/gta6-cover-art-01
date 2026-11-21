// A tiny static file server for the app/ directory, Node 22 with
// only the standard library. It exists so the entry can be tried on
// a laptop with no build step at all: `node serve.ts` serves app/ on
// http://localhost:8080. It serves the MIME types an offline web app
// needs, turns away any path that escapes app/, and otherwise stays
// out of the way — a local convenience, not a server for the public
// internet.
import { createServer } from "node:http";
import { statSync, createReadStream } from "node:fs";
import { sep, resolve, normalize, join, extname } from "node:path";
import { fileURLToPath } from "node:url";

const appRoot = resolve(fileURLToPath(new URL("./app", import.meta.url)));
const argv = process.argv.slice(2);
const flagIdx = argv.indexOf("--port");
const chosen = flagIdx === -1 ? 8080 : Number(argv[flagIdx + 1]);
const port = Number.isInteger(chosen) && chosen > 0 && chosen < 65536 ? chosen : 8080;

// MIME types by extension, kept as a plain lookup table.
const TYPES = {
  '.bin': 'application/octet-stream',
  '.css': 'text/css; charset=utf-8',
  '.gif': 'image/gif',
  '.html': 'text/html; charset=utf-8',
  '.ico': 'image/x-icon',
  '.jpeg': 'image/jpeg',
  '.jpg': 'image/jpeg',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.mp3': 'audio/mpeg',
  '.ogg': 'audio/ogg',
  '.otf': 'font/otf',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.ttf': 'font/ttf',
  '.txt': 'text/plain; charset=utf-8',
  '.wasm': 'application/wasm',
  '.wav': 'audio/wav',
  '.webp': 'image/webp',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
};

function mimeType(file) {
  return TYPES[extname(file).toLowerCase()] ?? "application/octet-stream";
}

createServer((req, res) => {
  const url = new URL(req.url ?? "/", "http://localhost");
  let path;
  try {
    path = decodeURIComponent(url.pathname);
  } catch {
    res.writeHead(400).end("bad request");
    return;
  }
  path = path.endsWith("/") ? path + "index.html" : path;
  const file = resolve(join(appRoot, normalize(path)));
  const ok = file === appRoot || file.startsWith(appRoot + sep);
  if (!ok) {
    res.writeHead(403).end("forbidden");
    return;
  }
  let info = null;
  try {
    info = statSync(file);
  } catch {
    info = null;
  }
  if (info === null || info.isFile() === false) {
    res.writeHead(404).end("not found");
    return;
  }
  const bytes = info.size;
  res.writeHead(200, {
    "cache-control": "no-store",
    "content-length": bytes,
    "content-type": mimeType(file),
  });
  createReadStream(file).pipe(res);
}).listen(port, "127.0.0.1", () => {
  console.log(`serving app/ at http://localhost:${port}`);
});
