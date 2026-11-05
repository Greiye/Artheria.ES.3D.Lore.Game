// Mike 2026-11-05: the stair cinematic: through the trapdoor and down each floor, a ride down a spiral stair with
// "Leaving Floor N / Floor N+1 of 30" and a felt hint of what is below (damp for a flooded floor, and so on). Skippable.
// Usage: node test/e2e-descent-cinematic.mjs [path/to/index.html]   (CHROMIUM_PATH as in e2e.mjs)
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
const check = (name, ok, detail = '') => { results.push({ name, ok }); console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? '  — ' + detail : ''}`); };
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
await page.route(/^https?:/, (r) => r.abort());
await page.goto('file://' + file);
await page.waitForFunction(() => window.__gametool, null, { timeout: 90000 });
await page.waitForTimeout(400);
await page.click('#begin');
await page.waitForFunction(() => window.__gametool.state === 'play', null, { timeout: 90000 });
const G = (fn, a) => page.evaluate(fn, a);
const frames = (n = 6) => G((n) => new Promise((done) => { let k = 0; const t = () => (++k >= n ? done() : requestAnimationFrame(t)); t(); }), n);
const cine = () => G(() => { const c = window.__gametool.descendCine, card = document.getElementById('descendCard');
  return { active: c.active, cls: card.className, eyebrow: card.querySelector('.dc-eyebrow').textContent, title: card.querySelector('.dc-title').textContent,
    lines: [...card.querySelectorAll('.dc-lines div')].map((d) => d.textContent), shaft: window.__gametool.world.scene.getObjectByName('stair-shaft').visible }; });

await G(() => { const g = window.__gametool; g.inventory.give('sword', 1); g.hands.set('right', 'sword'); });
// Through the trapdoor.
await G(() => window.__gametool.startDescent());
const e0 = await cine();
check('The trapdoor starts the cinematic: "Under the Ruined Library", the floor not built yet', e0.active && /Under the Ruined Library/.test(e0.eyebrow) && !(await G(() => window.__gametool.inDungeon)), JSON.stringify(e0));
await page.waitForFunction(() => document.getElementById('descendCard').classList.contains('dc-full'), null, { timeout: 20000 });
await frames(10);
const e1 = await cine();
check('Down the stairs: the shaft shows, "Floor 1 of 30" and a hint line, the floor built behind it', e1.shaft && e1.title === 'Floor 1 of 30' && e1.lines.length >= 1 && await G(() => window.__gametool.inDungeon && window.__gametool.descent.floor === 1), JSON.stringify(e1));
await page.screenshot({ path: path.join(shots, 'descent-cine-enter.png') });
await page.waitForFunction(() => !window.__gametool.descendCine.active, null, { timeout: 20000 });
const after = await G(() => { const g = window.__gametool, f = g.world.scene.fog; return { shot: g.rig.inShot, shaft: g.world.scene.getObjectByName('stair-shaft').visible, fog: '#' + f.color.getHexString(), want: g.dungeon.fog, cut: document.body.classList.contains('cutscene') }; });
check('At the bottom: camera back on the hero, the shaft hidden, the floor\'s fog back', !after.shot && !after.shaft && !after.cut && after.fog.toLowerCase() === String(after.want).toLowerCase(), JSON.stringify(after));
await G(() => { const g = window.__gametool; if (g.scrollPicker.isOpen) g.scrollPicker.close(); });
// A flooded floor: the hint is damp.
await G(() => { const g = window.__gametool; g.record.guardians = []; g.descent.floor = 20; const R = Math.random; Math.random = () => 0.3; try { g.goDown(true); } finally { Math.random = R; } });
const d0 = await cine();
check('Each floor down: "Leaving Floor 20"', d0.active && d0.eyebrow === 'Leaving Floor 20', JSON.stringify(d0));
await page.waitForFunction(() => document.getElementById('descendCard').classList.contains('dc-full'), null, { timeout: 20000 });
await frames(16);
const d1 = await cine();
check('A flooded floor below: the hint says the air is damp', d1.title === 'Floor 21 of 30' && /damp/.test(d1.lines[0] ?? '') && await G(() => window.__gametool.descent.flux === 'flooded'), JSON.stringify(d1));
await page.screenshot({ path: path.join(shots, 'descent-cine-flooded.png') });
await page.waitForFunction(() => !window.__gametool.descendCine.active, null, { timeout: 20000 });
// A dark floor: the torch gutters.
await G(() => { const g = window.__gametool; g.descent.floor = 20; const R = Math.random; Math.random = () => 0.05; try { g.goDown(true); } finally { Math.random = R; } });
await page.waitForFunction(() => document.getElementById('descendCard').classList.contains('dc-full'), null, { timeout: 20000 });
await frames(16);
const k1 = await cine();
check('A dark floor below: the torch gutters', /gutters/.test(k1.lines[0] ?? '') && await G(() => window.__gametool.descent.flux === 'dark'), JSON.stringify(k1));
await page.screenshot({ path: path.join(shots, 'descent-cine-dark.png') });
await page.waitForFunction(() => !window.__gametool.descendCine.active, null, { timeout: 20000 });
// Skipping: a key during the ride ends it early.
await G(() => { const g = window.__gametool; g.descent.floor = 2; g.goDown(true); });
await page.waitForFunction(() => document.getElementById('descendCard').classList.contains('dc-full'), null, { timeout: 20000 });
const t0 = await G(() => window.__gametool.descendCine.t);
await page.keyboard.press('x');
await page.waitForFunction(() => !window.__gametool.descendCine.active, null, { timeout: 5000 });
const fl = await G(() => ({ floor: window.__gametool.descent.floor, inD: window.__gametool.inDungeon }));
check('Any key skips the ride; the floor is still there', fl.floor === 3 && fl.inD, JSON.stringify({ t0, fl }));
check('No page errors', errors.length === 0, errors.slice(0, 3).join(' | '));

await browser.close();
const failed = results.filter((r) => !r.ok).length;
console.log(`\n${results.length - failed}/${results.length} passed`);
process.exit(failed ? 1 : 0);
