// Serves the built page's folder over local HTTP for suites that reload the page and expect their saves to be there.
// Headless Chromium now and then drops every localStorage key of a file:// page across a navigation (docs/assumptions.md
// #30; seen in about 1 run in 6 of e2e-kill-statue, never over http). `?models=` keeps the placeholder models a
// file:// page would have, so a suite behaves the same either way.
// Usage: const base = await serve(file); await page.goto(base + query); and let the route filter pass LOCAL through.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';

const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.webp': 'image/webp', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml', '.glb': 'model/gltf-binary', '.wasm': 'application/wasm' };
/** Blocks everything on the network except this server: page.route(OUTSIDE, (r) => r.abort()). */
export const OUTSIDE = /^https?:\/\/(?!127\.0\.0\.1[:/])/;

/** Returns a function: url('') or url('?flag') gives the page's address with that query. */
export async function serve(file) {
  const root = path.dirname(path.resolve(file));
  const server = http.createServer((req, res) => {
    const p = path.join(root, decodeURIComponent(new URL(req.url, 'http://x').pathname));
    if (!p.startsWith(root) || !fs.existsSync(p) || fs.statSync(p).isDirectory()) { res.writeHead(404); res.end(); return; }
    res.writeHead(200, { 'content-type': MIME[path.extname(p)] ?? 'application/octet-stream', 'cache-control': 'no-store' });
    fs.createReadStream(p).pipe(res);
  });
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  server.unref();   // never keeps a finished suite alive
  const page = `http://127.0.0.1:${server.address().port}/${path.basename(file)}`;
  return (query = '') => `${page}?models=${query ? '&' + query.replace(/^\?/, '') : ''}`;
}
