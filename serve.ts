// A minimal static file server for the app/ folder, Node 22 with only
// the standard library. It exists so the entry can be tried on a laptop
// with no build step at all: `node serve.ts` serves app/ on
// http://localhost:8080. It serves the MIME types an offline web app
// needs, rejects any path that escapes app/, and otherwise stays out of
// the way — a local convenience, not a server for the public internet.
import { createReadStream, statSync } from "node:fs";
import { createServer } from "node:http";
import { extname, join, normalize, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

const appRoot = resolve(fileURLToPath(new URL("./app", import.meta.url)));
const cliArgs = process.argv.slice(2);
const portFlag = cliArgs.indexOf("--port");
const wantedPort = portFlag === -1 ? 8080 : Number(cliArgs[portFlag + 1]);
const portNo = Number.isInteger(wantedPort) && wantedPort > 0 && wantedPort < 65536 ? wantedPort : 8080;

// MIME types, as [extension, type] pairs so the table stays sortable.
const MIME_PAIRS = [
  [".html", "text/html; charset=utf-8"],
  [".js", "text/javascript; charset=utf-8"],
  [".mjs", "text/javascript; charset=utf-8"],
  [".css", "text/css; charset=utf-8"],
  [".json", "application/json; charset=utf-8"],
  [".png", "image/png"],
  [".jpg", "image/jpeg"],
  [".jpeg", "image/jpeg"],
  [".gif", "image/gif"],
  [".webp", "image/webp"],
  [".svg", "image/svg+xml"],
  [".ico", "image/x-icon"],
  [".woff2", "font/woff2"],
  [".woff", "font/woff"],
  [".ttf", "font/ttf"],
  [".otf", "font/otf"],
  [".bin", "application/octet-stream"],
  [".wasm", "application/wasm"],
  [".wav", "audio/wav"],
  [".mp3", "audio/mpeg"],
  [".ogg", "audio/ogg"],
  [".txt", "text/plain; charset=utf-8"],
];
const MIME_TYPES = Object.fromEntries(MIME_PAIRS);

function mimeFor(name) {
  const found = MIME_TYPES[extname(name).toLowerCase()];
  return found === undefined ? "application/octet-stream" : found;
}

createServer((request, response) => {
  const url = new URL(request.url === null || request.url === undefined ? "/" : request.url, "http://localhost");
  let path;
  try {
    path = decodeURIComponent(url.pathname);
  } catch {
    response.writeHead(400).end("bad request");
    return;
  }
  if (path.endsWith("/")) {
    path = path + "index.html";
  }
  const target = resolve(join(appRoot, normalize(path)));
  if (target !== appRoot && target.startsWith(appRoot + sep) === false) {
    response.writeHead(403).end("forbidden");
    return;
  }
  let bytes;
  try {
    const stat = statSync(target);
    if (stat.isFile() === false) {
      throw new Error("not a file");
    }
    bytes = stat.size;
  } catch {
    response.writeHead(404).end("not found");
    return;
  }
  response.writeHead(200, {
    "cache-control": "no-store",
    "content-type": mimeFor(target),
    "content-length": bytes,
  });
  createReadStream(target).pipe(response);
}).listen(portNo, "127.0.0.1", () => {
  console.log("serving app/ at http://localhost:" + portNo);
});
