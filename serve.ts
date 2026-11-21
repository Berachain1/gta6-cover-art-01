// A small static file server for the app/ directory, Node 22 using
// only the standard library. It is there so the entry can be tried on
// a laptop with no build step at all: `node serve.ts` serves app/ on
// http://localhost:8080. It serves the MIME types an offline web app
// needs, turns away any path that escapes app/, and otherwise stays
// out of the way — a local convenience, not a server for the public
// internet.
import { createServer } from "node:http";
import { createReadStream, statSync } from "node:fs";
import { extname, join, normalize, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(fileURLToPath(new URL("./app", import.meta.url)));
const args = process.argv.slice(2);
const flagAt = args.indexOf("--port");
const picked = flagAt === -1 ? 8080 : Number(args[flagAt + 1]);
const port = Number.isInteger(picked) && picked > 0 && picked < 65536 ? picked : 8080;

// MIME types by extension, kept as a plain lookup table.
const MIME = {
  '.woff2': 'font/woff2',
  '.woff': 'font/woff',
  '.webp': 'image/webp',
  '.wav': 'audio/wav',
  '.wasm': 'application/wasm',
  '.txt': 'text/plain; charset=utf-8',
  '.ttf': 'font/ttf',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.otf': 'font/otf',
  '.ogg': 'audio/ogg',
  '.mp3': 'audio/mpeg',
  '.mjs': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.ico': 'image/x-icon',
  '.html': 'text/html; charset=utf-8',
  '.gif': 'image/gif',
  '.css': 'text/css; charset=utf-8',
  '.bin': 'application/octet-stream',
};

function mimeFor(file) {
  return MIME[extname(file).toLowerCase()] ?? "application/octet-stream";
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
  const file = resolve(join(root, normalize(path)));
  const ok = file === root || file.startsWith(root + sep);
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
    "content-type": mimeFor(file),
    "content-length": bytes,
    "cache-control": "no-store",
  });
  createReadStream(file).pipe(res);
}).listen(port, "127.0.0.1", () => {
  console.log(`serving app/ at http://localhost:${port}`);
});
