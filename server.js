"use strict";
/* Tiny static server for the ESST site (no npm packages). Serves index.html and assets/ only. */
const http = require("node:http"), fs = require("node:fs"), path = require("node:path"), zlib = require("node:zlib");
const ROOT = __dirname, PORT = parseInt(process.env.PORT, 10) || 3000;
const TYPES = { ".html": "text/html; charset=utf-8", ".svg": "image/svg+xml", ".png": "image/png", ".jpg": "image/jpeg", ".webp": "image/webp", ".ico": "image/x-icon", ".css": "text/css; charset=utf-8", ".js": "text/javascript; charset=utf-8" };
const cache = new Map();

http.createServer((req, res) => {
  const p = decodeURIComponent(new URL(req.url, "http://x").pathname);
  res.setHeader("X-Content-Type-Options", "nosniff"); res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin"); res.setHeader("X-Frame-Options", "SAMEORIGIN");
  if (p === "/health") { res.writeHead(200, { "Content-Type": "application/json" }); return res.end('{"ok":true}'); }
  if (req.method !== "GET" && req.method !== "HEAD") { res.writeHead(405); return res.end(); }
  let rel = p === "/" ? "index.html" : p.replace(/^\/+/, "");
  const allowed = rel === "index.html" || /^assets\/[\w\-./]+$/.test(rel) && !rel.includes("..");
  let file = path.join(ROOT, allowed ? rel : "index.html");        // unknown path: give the app (it routes by itself)
  if (!allowed && path.extname(rel)) { res.writeHead(404); return res.end("Not found"); }
  fs.stat(file, (e, st) => {
    if (e || !st.isFile()) { res.writeHead(404); return res.end("Not found"); }
    const ext = path.extname(file), type = TYPES[ext] || "application/octet-stream", etag = '"' + st.size.toString(36) + "-" + Math.floor(st.mtimeMs).toString(36) + '"';
    const h = { "Content-Type": type, ETag: etag, "Cache-Control": file.endsWith("index.html") ? "no-cache" : "public, max-age=86400" };
    if (req.headers["if-none-match"] === etag) { res.writeHead(304, h); return res.end(); }
    if (/^(text\/|image\/svg)/.test(type) && /\bgzip\b/.test(req.headers["accept-encoding"] || "")) {
      let g = cache.get(file); if (!g || g.etag !== etag) { g = { etag, buf: zlib.gzipSync(fs.readFileSync(file)) }; cache.set(file, g); }
      res.writeHead(200, Object.assign(h, { "Content-Encoding": "gzip", Vary: "Accept-Encoding", "Content-Length": g.buf.length })); return res.end(req.method === "HEAD" ? undefined : g.buf);
    }
    res.writeHead(200, Object.assign(h, { "Content-Length": st.size })); if (req.method === "HEAD") res.end(); else fs.createReadStream(file).pipe(res);
  });
}).listen(PORT, "0.0.0.0", () => console.log("ESST site listening on " + PORT));
