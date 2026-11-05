// B43 (Mike 2026-11-03, "NPCs don't seem to be affected by dynamic lighting"): characters keep their painted
// look, but the hour dims them and nearby point lights (torch, campfire, lanterns) light them.
// Usage: node test/e2e-npc-light.mjs [path/to/index.html]   (CHROMIUM_PATH as in e2e.mjs)
import { chromium } from 'playwright-core';
import path from 'node:path';

const file = path.resolve(process.argv[2] ?? 'dist/index.html');
const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH || undefined,
  args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'],
});
const results = [];
const check = (id, ok, detail = '') => { results.push({ id, ok }); console.log(`${ok ? 'PASS' : 'FAIL'}  ${id}${detail ? '  — ' + detail : ''}`); };
const G = (page, fn, arg) => page.evaluate(fn, arg);

const page = await (await browser.newContext({ viewport: { width: 960, height: 540 } })).newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
await page.route(/^https?:/, (r) => r.abort());
await page.goto('file://' + file);
await page.waitForFunction(() => window.__gametool);
await page.waitForTimeout(400);
await page.click('#begin');
await page.waitForFunction(() => window.__gametool.state === 'play', null, { timeout: 60000 });

// Every character (the player, townsfolk, standees, Kavik) uses the lit character material.
const mats = await G(page, () => {
  const g = window.__gametool, out = { figures: 0, lit: 0, basic: [] };
  for (const [id, p] of g.puppets) {
    const root = p.root ?? p.body ?? p.obj ?? null;
    if (!root?.traverse) continue;
    out.figures++;
    let ok = true;
    root.traverse((o) => { if ((o.isMesh || o.isSkinnedMesh) && o.material && !Array.isArray(o.material) && (o.material.vertexColors || o.userData?.isFace) && !['figure-lit', 'figure-cel'].includes(o.material.customProgramCacheKey?.())) ok = false; });
    if (ok) out.lit++; else out.basic.push(id);
  }
  return out;
});
check('Every character uses the lit character material', mats.figures > 5 && mats.basic.length === 0, JSON.stringify({ ...mats, basic: mats.basic.slice(0, 5) }));

// The hour tints them: white by day, darker at night.
const shade = await G(page, () => { const g = window.__gametool, s = []; for (const t of ['day', 'sunset', 'night']) { g.world.setTime(t); g.nightLights.setTime(t); const c = g.figureLight.shade.value; s.push((c.r + c.g + c.b) / 3); } return s; });
check('The hour dims characters: day 1, sunset darker, night darker still', shade[0] === 1 && shade[1] < 0.9 && shade[2] < 0.6, JSON.stringify(shade));

// A torch beside a character at night lights it up. Look at the hero standee, then read its pixels with the
// player's torch out and lit.
const look = () => G(page, () => {
  const g = window.__gametool, h = g.world.standees.hero.position, p = g.player;
  p.thirdPerson = false;
  p.pos.set(h.x + 1.4, 0, h.z + 1.4); p.yaw = p.bodyYaw = Math.atan2(1.4, 1.4); p.pitch = -0.1;
});
const lum = () => G(page, () => new Promise((done) => requestAnimationFrame(() => {
  const g = window.__gametool, h = g.world.standees.hero.position.clone(); h.y += 1.1;
  h.project(g.camera);
  const c = document.querySelector('canvas'), x = (h.x + 1) / 2 * c.width, y = (1 - h.y) / 2 * c.height;
  const k = document.createElement('canvas'); k.width = 24; k.height = 24;
  const ctx = k.getContext('2d'); ctx.drawImage(c, x - 12, y - 12, 24, 24, 0, 0, 24, 24);
  const d = ctx.getImageData(0, 0, 24, 24).data; let s = 0;
  for (let i = 0; i < d.length; i += 4) s += (d[i] + d[i + 1] + d[i + 2]) / 3;
  done({ lum: s / (d.length / 4), x: Math.round(x), y: Math.round(y) });
})));
await G(page, () => { const g = window.__gametool; g.world.setTime('night'); g.nightLights.setTime('night'); if (g.torch.lit) g.torch.toggle(); });
await look(); await page.waitForTimeout(1500); await look(); await page.waitForTimeout(1500);
const dark = await lum();
await G(page, () => { const g = window.__gametool; if (!g.torch.lit) g.torch.toggle(); });
await page.waitForTimeout(1500); await look(); await page.waitForTimeout(1500);
const lit = await lum();
check('At night a lit torch brightens a character beside it', lit.lum > dark.lum * 1.2 && Math.abs(lit.x - dark.x) < 8 && Math.abs(lit.y - dark.y) < 8, JSON.stringify({ dark, lit }));
await page.screenshot({ path: path.resolve(process.env.SHOTS_DIR ?? 'test/screenshots', 'b43-torch-night.png') });
check('No page errors', errors.length === 0, errors.slice(0, 3).join(' | '));

await browser.close();
const failed = results.filter((r) => !r.ok).length;
console.log(`${results.length - failed}/${results.length} checks passed`);
process.exit(failed ? 1 : 0);
