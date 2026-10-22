// Automated checks for the partial rebuild (docs/rebuild-plan.md): R1 look, R3 camera rig.
// Usage: npm run build && node test/e2e-rebuild.mjs [path/to/index.html]
import { chromium } from 'playwright-core';
import fs from 'node:fs';
import path from 'node:path';

const file = path.resolve(process.argv[2] ?? 'dist/index.html');
const shots = path.resolve(process.env.SHOTS_DIR ?? 'test/screenshots');
fs.mkdirSync(shots, { recursive: true });
const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH || undefined,
  args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'],
});
const results = [];
const check = (id, ok, detail = '') => { results.push({ id, ok }); console.log(`${ok ? 'PASS' : 'FAIL'}  ${id}${detail ? '  — ' + detail : ''}`); };
const G = (page, fn, arg) => page.evaluate(fn, arg);
// Wait on game state, not wall-clock: the GPU-less test browser runs a few fps.
const until = (page, fn, arg, timeout = 15000) => page.waitForFunction(fn, arg, { timeout, polling: 100 }).then(() => true, () => false);

const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
await ctx.addInitScript(() => localStorage.setItem('gametool.character', JSON.stringify({ name: 'Test', motivation: '', secret: '', created: true })));
const page = await ctx.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
await page.goto('file://' + file);
await page.waitForFunction(() => window.__gametool);

// ---------- R1: pixel textures ----------
const tex = await G(page, () => {
  const g = window.__gametool, ground = g.world.scene.getObjectByName('ground');
  const t = ground.material.map;
  return { mag: t.magFilter, nearest: 1003, w: t.image.width };
});
check('R1 ground uses a nearest-filtered 32 px pixel texture', tex.mag === tex.nearest && tex.w === 32, JSON.stringify(tex));
const batched = await G(page, () => { let n = 0; window.__gametool.world.scene.traverse((o) => { if (o.name === 'static') n++; }); return n; });
check('R1 static props are batched into a handful of meshes', batched > 0 && batched < 20, `${batched} meshes`);

await page.click('#begin');
await page.waitForFunction(() => window.__gametool.state === 'play', null, { timeout: 8000 });

// ---------- R3: follow camera ----------
await G(page, () => { const p = window.__gametool.player; p.pos.set(0, 0, 8.5); p.yaw = 0; p.pitch = 0; });
const follow = await until(page, () => { const g = window.__gametool; const d = g.player.eyePos.distanceTo(g.camera.position); return g.player.thirdPerson && d > 2.5 && d < 3.2; });
check('R3 default view: third-person follow ~3 m behind the eyes', follow);

// ---------- R3: reading shot ----------
await G(page, () => { const p = window.__gametool.player; p.pos.set(0.2, 0, 1.6); p.yaw = 0; p.pitch = -0.35; });
await until(page, () => !document.getElementById('prompt').classList.contains('hidden'));
await page.keyboard.press('KeyE');
await until(page, () => window.__gametool.state === 'book');
const framed = await until(page, () => { const g = window.__gametool; return g.camera.position.distanceTo(g.world.bookCenter) < 2.2 && Math.abs(g.camera.fov - 45) < 1; });
await page.screenshot({ path: path.join(shots, 'rebuild-reading-shot.png') });
check('R3 opening the lectern book frames it (camera < 2.2 m away, 45° FOV)', framed);
await page.keyboard.press('Tab');
const back = await until(page, () => { const g = window.__gametool; return g.state !== 'book' && !g.rig.inShot && Math.abs(g.camera.fov - g.settings.fov) < 0.5; });
check('R3 closing the book blends back to the play camera', back);

// ---------- R3: dialogue two-shot ----------
await G(page, () => {
  const g = window.__gametool, n = g.world.natalieTarget.position, pl = g.player;
  pl.pos.set(n.x + 0.2, 0, n.z + 1.4);
  pl.yaw = Math.atan2(-(n.x - pl.pos.x), -(n.z - pl.pos.z)); pl.pitch = -0.15;
});
await until(page, () => document.getElementById('promptVerb').textContent === 'Talk to Natalie');
await page.keyboard.press('KeyE');
await until(page, () => window.__gametool.state === 'dialogue');
const two = await until(page, () => {
  const g = window.__gametool, n = g.world.natalieTarget.position;
  const dir = g.camera.getWorldDirection(new g.Vector3()), to = new g.Vector3(n.x, 1.5, n.z).sub(g.camera.position).normalize();
  return dir.dot(to) > 0.98 && g.player.body.visible && Math.abs(g.camera.fov - 50) < 1;
});
await page.screenshot({ path: path.join(shots, 'rebuild-dialogue-shot.png') });
check('R3 talking to Natalie frames her over the player\'s shoulder', two);

check('Rebuild: no console/page errors', errors.length === 0, errors.join(' | '));
await browser.close();
const failed = results.filter((r) => !r.ok).length;
console.log(`\n${results.length - failed}/${results.length} checks passed`);
process.exit(failed ? 1 : 0);
