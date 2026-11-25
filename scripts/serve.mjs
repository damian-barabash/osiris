// Маленький статический сервер, который ведёт себя как GitHub Pages: каталог → index.html, нет файла → 404.html.
import { createServer } from "node:http";
import { existsSync, readFileSync, statSync } from "node:fs";
import { extname, join, normalize } from "node:path";

const TYPES = { ".html": "text/html; charset=utf-8", ".js": "text/javascript", ".css": "text/css", ".json": "application/json", ".svg": "image/svg+xml", ".png": "image/png", ".ico": "image/x-icon", ".woff2": "font/woff2", ".ttf": "font/ttf", ".xml": "application/xml", ".txt": "text/plain", ".webmanifest": "application/manifest+json" };

export function serve(root = "dist", port = 4173) {
  const server = createServer((req, res) => {
    const path = normalize(decodeURIComponent((req.url ?? "/").split("?")[0])).replace(/^(\.\.[/\\])+/, "");
    let file = join(root, path);
    if (existsSync(file) && statSync(file).isDirectory()) file = join(file, "index.html");
    let status = 200;
    if (!existsSync(file)) { file = join(root, "404.html"); status = 404; }
    res.writeHead(status, { "Content-Type": TYPES[extname(file)] ?? "application/octet-stream" });
    res.end(readFileSync(file));
  });
  return new Promise((ok) => server.listen(port, "127.0.0.1", () => ok(server)));
}
if (import.meta.url === `file://${process.argv[1]}`) { await serve(process.argv[2] ?? "dist", Number(process.argv[3] ?? 4173)); console.log("http://127.0.0.1:" + (process.argv[3] ?? 4173)); }
