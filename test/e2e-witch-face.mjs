// Mike 2026-11-03: the Witch (public/models/witch.glb, Quaternius CC0) gets a drawn face like the other figures:
// a face quad on her head bone with the drawn sheet (the hero's for now), and her baked eyes hidden.
// Serves dist/ over local HTTP (Chromium won't fetch .glb from file://).
// Usage: node test/e2e-witch-face.mjs [path/to/index.html]   (CHROMIUM_PATH as in e2e.mjs)
import { chromium } from 'playwright-core';
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';

const file = path.resolve(process.argv[2] ?? 'dist/index.html');
const shots = path.resolve(process.env.SHOTS_DIR ?? 'test/screenshots');
fs.mkdirSync(shots, { recursive: true });
const root = path.dirname(file);
const server = http.createServer((req, res) => {
  const p = path.join(root, decodeURIComponent(new URL(req.url, 'http://x').pathname));
  if (!p.startsWith(root) || !fs.existsSync(p) || fs.statSync(p).isDirectory()) { res.writeHead(404); res.end(); return; }
  res.writeHead(200, { 'Content-Type': p.endsWith('.html') ? 'text/html' : 'application/octet-stream' });
  fs.createReadStream(p).pipe(res);
});
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const base = `http://127.0.0.1:${server.address().port}/`;
const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH || undefined,
  args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'],
});
const results = [];
const check = (id, ok, detail = '') => { results.push({ id, ok }); console.log(`${ok ? 'PASS' : 'FAIL'}  ${id}${detail ? '  — ' + detail : ''}`); };
const G = (page, fn, arg) => page.evaluate(fn, arg);

const page = await (await browser.newContext({ viewport: { width: 1280, height: 720 } })).newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
await page.goto(base + path.basename(file) + '?models=witch');
await page.waitForFunction(() => window.__gametool);
await page.waitForFunction(() => window.__gametool.loadedModels.has('witch'), null, { timeout: 90000 });
await page.waitForTimeout(400);
await page.click('#begin');
await page.waitForFunction(() => window.__gametool.state === 'play');

const info = await G(page, () => {
  const g = window.__gametool, h = g.loadedModels.get('witch'), V = g.Vector3, f = h.userData.face;
  if (!f) return null;
  let eyes = null, head = null;
  h.traverse((o) => { if (o.name === 'Witch_Head_5') eyes = o.visible; if (o.name === 'Witch_Head_2') head = o; });
  const p = f.getWorldPosition(new V()), hb = new g.Box3().setFromObject(head);
  const q = f.getWorldQuaternion(h.quaternion.clone()), fwd = new V(0, 0, 1).applyQuaternion(q), modelFwd = new V(0, 0, 1).applyQuaternion(h.getWorldQuaternion(h.quaternion.clone()));
  const shot = { pos: p.clone().addScaledVector(fwd, 0.9).add(new V(0, 0.05, 0)), look: p.clone(), fov: 35 };
  g.player.body.visible = false; g.rig.setShot(shot);
  return { onHead: f.parent?.isBone && /head/i.test(f.parent.name), eyesHidden: eyes === false, faces: fwd.dot(modelFwd), inFront: p.y > hb.min.y && p.y < hb.max.y, bone: f.parent?.name };
});
check('The witch .glb has a face quad on her head bone', !!info && info.onHead, JSON.stringify(info));
check('Her baked eyes are hidden', !!info && info.eyesHidden);
check('The face sits on the front of her head and faces the way she does', !!info && info.inFront && info.faces > 0.95, JSON.stringify(info));
const drawn = await page.waitForFunction(() => { const m = window.__gametool.loadedModels.get('witch').userData.face.material; return m.visible && !!m.map; }, null, { timeout: 20000 }).then(() => true, () => false);
check('The drawn face sheet shows on it', drawn);
await page.waitForTimeout(1500);
await page.screenshot({ path: path.join(shots, 'witch-face.png') });
check('No page errors', errors.length === 0, errors.slice(0, 3).join(' | '));
await browser.close(); server.close();
const failed = results.filter((r) => !r.ok).length;
console.log(`${results.length - failed}/${results.length} checks passed`);
process.exit(failed ? 1 : 0);
