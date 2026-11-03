// Bakes src/art/trees/tree-cards.png (+ .json, how much of its card each tree fills): every tree in the 99.Miles Low Poly Forest Tree Pack (CC BY 4.0), drawn
// side-on into a 128 x 256 card each, on a 4 x 2 grid, for the crossed-quad trees (src/world/treeCards.ts). Mike 2026-11-03:
// crossed-quad trees on every preset; the .glb itself no longer ships.
// Usage: node scripts/bake-tree-cards.mjs path/to/forest-trees.glb
// (the .glb left the repo with the switch; it is in references/ and in git history before it.)
import { chromium } from 'playwright-core';
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';

const glb = path.resolve(process.argv[2] ?? 'references/low_poly_forest_tree_pack/forest-trees.glb');
const root = process.cwd();
const server = http.createServer((req, res) => {
  const u = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  const p = u === '/tree.glb' ? glb : path.join(root, u);
  if (!fs.existsSync(p) || fs.statSync(p).isDirectory()) { res.writeHead(404); res.end(); return; }
  res.writeHead(200, { 'Content-Type': p.endsWith('.html') ? 'text/html' : p.endsWith('.js') ? 'text/javascript' : 'application/octet-stream' });
  fs.createReadStream(p).pipe(res);
});
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const page = await browser.newPage();
page.on('pageerror', (e) => console.error(e.message));
await page.goto(`http://127.0.0.1:${server.address().port}/scripts/bake/tree-cards.html`);
await page.waitForFunction(() => window.ready);
const out = await page.evaluate(() => window.bake('/tree.glb'));
fs.mkdirSync('src/art/trees', { recursive: true });
fs.writeFileSync('src/art/trees/tree-cards.json', JSON.stringify({ cell: [128, 256], cols: 4, fill: out.fill }) + '\n');
fs.writeFileSync('src/art/trees/tree-cards.png', Buffer.from(out.url.split(',')[1], 'base64'));
// Then (optional, smaller inline size): python3 -c "from PIL import Image; Image.open('src/art/trees/tree-cards.png').quantize(96, method=2).save('src/art/trees/tree-cards.png', optimize=True)"
console.log(out.keys.join(" ")); console.log(`${out.n} cards, heights ${out.heights.join(', ')} → src/art/trees/tree-cards.png`);
await browser.close(); server.close();
