// UX pass (Mike 2026-10-31), part 2, the world tells you instead of the HUD: a fingerpost and chimney smoke for
// directions, a purse at the hip for crowns, health shown on the body (reddened sight, ragged breath, a limp), Natalie
// speaking the tutorial hints, the bell telling the hour, and the map as a sheet of paper in your hands.
// Usage: node test/e2e-ux-world.mjs [path/to/index.html]   (CHROMIUM_PATH as in e2e.mjs)
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
const until = (page, fn, arg, timeout = 15000) => page.waitForFunction(fn, arg, { timeout, polling: 100 }).then(() => true, () => false);
const frames = (page, n = 3) => G(page, (n) => new Promise((r) => { const f = () => (--n <= 0 ? r() : requestAnimationFrame(f)); requestAnimationFrame(f); }), n);

const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 } });
const page = await ctx.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
await page.route(/^https?:/, (r) => r.abort());
await page.goto('file://' + file);
await page.waitForFunction(() => window.__gametool);
await page.waitForTimeout(400);
await page.click('#begin');
await page.waitForFunction(() => window.__gametool.state === 'play');
await page.waitForTimeout(400);

// Directions from the town itself.
const town = await G(page, () => { const g = window.__gametool, f = g.world.town.fingerpost; return { f: f && [f.x, f.z], post: g.world.colliders.some((c) => c.kind === 'circle' && Math.hypot(c.x - f.x, c.z - f.z) < 0.01), chimneys: g.world.town.chimneys.length, puffs: g.world.smoke.points.geometry.attributes.position.count }; });
check('A fingerpost stands where the lane meets the green (solid, one arm per building)', !!town.f && town.post, JSON.stringify(town));
const y0 = await G(page, () => window.__gametool.world.smoke.points.geometry.attributes.position.getY(0));
const moved = await until(page, (y0) => window.__gametool.world.smoke.points.geometry.attributes.position.getY(0) !== y0, y0, 8000);
check('Chimney smoke rises from every chimney', town.chimneys >= 8 && town.puffs === town.chimneys * 7 && moved, `${town.chimneys} chimneys, ${town.puffs} puffs`);
await G(page, () => { const g = window.__gametool, f = g.world.town.fingerpost, p = g.player; p.pos.set(f.x - 1, 0, f.z - 6); p.yaw = Math.PI; p.pitch = 0.12; p.update(0); p.syncNow(); });
await frames(page, 6); await page.waitForTimeout(300);
await page.screenshot({ path: path.join(shots, 'ux-4-fingerpost-smoke.png') });

// The purse.
const p0 = await G(page, () => ({ v: window.__gametool.purse.model.visible, c: window.__gametool.purse.crowns }));
await G(page, () => window.__gametool.earn(8, 'test'));
await page.waitForTimeout(500);
const p1 = await G(page, () => ({ v: window.__gametool.purse.model.visible, s: window.__gametool.purse.model.scale.x }));
await G(page, () => window.__gametool.earn(60, 'test'));
await page.waitForTimeout(500);
const p2 = await G(page, () => window.__gametool.purse.model.scale.x);
check('Crowns show as a purse at the hip: none while empty, fuller with more', !p0.v && p0.c === 0 && p1.v && p2 > p1.s * 1.3, JSON.stringify({ p0, p1, p2 }));

// The bell tells the hour.
await G(page, () => window.__gametool.tollBell('sunset'));
const sunsetTolls = await G(page, () => window.__gametool.audio.lastBell);
await G(page, () => window.__gametool.tollBell('day'));
check('No clock: the spire bell tolls the hour (two at sunset, three in the morning)', sunsetTolls === 2 && await G(page, () => window.__gametool.audio.lastBell) === 3);

// Natalie speaks the hints when she's with you; otherwise they're a toast.
const near = await G(page, () => { const g = window.__gametool, n = g.companion.pos; g.companion.prefs.follow = true; g.player.pos.set(n.x + 2, 0, n.z); g.player.update(0); g.hint('Test line from Natalie.', 'Test toast.'); return { how: g.lastHint, line: g.companion.lastLine }; });
const far = await G(page, () => { const g = window.__gametool; g.player.pos.set(g.companion.pos.x + 30, 0, g.companion.pos.z); g.player.update(0); g.hint('Line two.', 'Plain toast.'); return { how: g.lastHint, toast: document.getElementById('toast').textContent }; });
check('Tutorial hints: Natalie says them when she\'s near, a toast when she isn\'t', near.how === 'natalie' && /Test line/.test(near.line) && far.how === 'toast' && far.toast === 'Plain toast.', JSON.stringify({ near, far }));

// The map in your hands.
await G(page, () => { const g = window.__gametool; g.player.pos.set(0, 0, 8); g.player.update(0); g.openMap(); });
await page.waitForTimeout(300);
const paper = await G(page, () => { const c = document.querySelector('.map-card'); return { tilt: getComputedStyle(c).transform !== 'none', hands: getComputedStyle(c, '::before').content !== 'none' && getComputedStyle(c, '::after').content !== 'none' }; });
check('The map is a sheet held in two hands (tilted, world showing behind)', paper.tilt && paper.hands, JSON.stringify(paper));
await page.screenshot({ path: path.join(shots, 'ux-5-map-in-hands.png') });
await G(page, () => window.__gametool.livingMap.close());
await page.waitForTimeout(200);

// Health on the body, in the dungeon.
await G(page, () => window.__gametool.enterDungeon(4242));
await page.waitForTimeout(400);
await G(page, () => { window.__gametool.goblins.clear(); window.__gametool.delveHp = 3; });
await page.waitForTimeout(500);
const body = await G(page, () => ({ hurt: parseFloat(getComputedStyle(document.body).getPropertyValue('--hurt')), mul: window.__gametool.player.speedMul, w: document.getElementById('delveHp').getBoundingClientRect().width, text: document.getElementById('delveHp').textContent }));
check('Hurt shows on the body: reddened sight and a limp; no health counter on screen (still read out)', body.hurt > 0.4 && body.mul <= 0.75 && body.w <= 1 && /♥/.test(body.text), JSON.stringify(body));
await page.screenshot({ path: path.join(shots, 'ux-6-hurt.png') });
const torn = await G(page, () => ({ open: window.__gametool.wear.open, level: window.__gametool.wear.level }));
await G(page, () => { window.__gametool.delveHp = 7; });
await page.waitForTimeout(300);
const light = await G(page, () => window.__gametool.wear.open);
await G(page, () => { window.__gametool.delveHp = 3; });
await page.waitForTimeout(300);
await G(page, () => { const g = window.__gametool; g.rig.step = Math.max(0, (g.rig.step ?? 1) - 3); g.player.yaw += Math.PI; });
await page.waitForTimeout(400);
await page.screenshot({ path: path.join(shots, 'ux-11-torn-clothes.png') });
await G(page, () => window.__gametool.exitDungeon());
await page.waitForTimeout(400);
const mended = await G(page, () => window.__gametool.wear.open);
check('Torn clothes: rips open as health drops (1 at 70%, 4 at 30%, all 6 near the end) and are mended back above ground', light === 1 && torn.open === 4 && torn.level > 0.6 && mended === 0, JSON.stringify({ light, torn, mended }));

check('UX world: no console/page errors', errors.length === 0, errors.join(' | '));
await ctx.close();
await browser.close();
const failed = results.filter((r) => !r.ok).length;
console.log(`\n${results.length - failed}/${results.length} checks passed`);
process.exit(failed ? 1 : 0);
