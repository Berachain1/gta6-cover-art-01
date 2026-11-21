// A small static file server for the app/ directory, Node 22 with
// nothing but the standard library. It is there so the entry can be
// tried on a laptop with no build step at all: `node serve.ts` puts
// app/ on http://localhost:8080. It knows the MIME types an offline
// web app needs, refuses any path that escapes app/, and otherwise
// stays out of the way — a local convenience, not a server for the
// public internet.
import { createServer } from "node:http";
import { createReadStream, statSync } from "node:fs";
import { extname, join, normalize, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

const appRoot = resolve(fileURLToPath(new URL("./app", import.meta.url)));
const argv = process.argv.slice(2);
const portArg = argv.indexOf("--port");
const rawPort = portArg < 0 ? "8080" : argv[portArg + 1];
const parsed = Number(rawPort);
const port = Number.isInteger(parsed) && parsed > 0 && parsed < 65536 ? parsed : 8080;

// MIME types by extension, built from pairs so the table stays flat.
const TYPES = Object.fromEntries([
  [".woff2", "font/woff2"],
  [".woff", "font/woff"],
  [".ttf", "font/ttf"],
  [".otf", "font/otf"],
  [".webp", "image/webp"],
  [".png", "image/png"],
  [".jpg", "image/jpeg"],
  [".jpeg", "image/jpeg"],
  [".gif", "image/gif"],
  [".svg", "image/svg+xml"],
  [".ico", "image/x-icon"],
  [".mp3", "audio/mpeg"],
  [".ogg", "audio/ogg"],
  [".wav", "audio/wav"],
  [".wasm", "application/wasm"],
  [".js", "text/javascript; charset=utf-8"],
  [".mjs", "text/javascript; charset=utf-8"],
  [".json", "application/json; charset=utf-8"],
  [".css", "text/css; charset=utf-8"],
  [".html", "text/html; charset=utf-8"],
  [".txt", "text/plain; charset=utf-8"],
  [".bin", "application/octet-stream"],
]);

function mimeType(file) {
  return TYPES[extname(file).toLowerCase()] ?? "application/octet-stream";
}

// Maps a request path onto a file inside appRoot, or null when the
// path would escape it.
function resolveAppPath(pathname) {
  const file = resolve(join(appRoot, normalize(pathname)));
  const inside = file === appRoot || file.startsWith(appRoot + sep);
  return inside ? file : null;
}

function send(res, code, body) {
  res.writeHead(code).end(body);
}

function handle(req, res) {
  const url = new URL(req.url ?? "/", "http://localhost");
  let path;
  try {
    path = decodeURIComponent(url.pathname);
  } catch {
    send(res, 400, "bad request");
    return;
  }
  if (path.endsWith("/")) {
    path += "index.html";
  }
  const file = resolveAppPath(path);
  if (file === null) {
    send(res, 403, "forbidden");
    return;
  }
  let info;
  try {
    info = statSync(file);
  } catch {
    info = null;
  }
  if (info === null || info.isFile() === false) {
    send(res, 404, "not found");
    return;
  }
  res.writeHead(200, {
    "content-type": mimeType(file),
    "content-length": info.size,
    "cache-control": "no-store",
  });
  createReadStream(file).pipe(res);
}

createServer(handle).listen(port, "127.0.0.1", () => {
  console.log("serving app/ at http://localhost:" + port);
});
