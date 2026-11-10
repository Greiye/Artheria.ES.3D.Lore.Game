// Mike 2026-11-05: each hand holds anything you own, in any combination (src/hands.ts). Two crossbows (R reloads both
// at 2.2x the time, no aiming down the sights), two swords, two torches, a sword and a crossbow. The crossbow only
// sways while aiming. LMB is the right hand, RMB the left. The bag's Hands row and the D-pad cycle each hand.
// Usage: node test/e2e-hands.mjs [path/to/index.html]   (CHROMIUM_PATH as in e2e.mjs)
import { chromium } from 'playwright-core';
import path from 'node:path';

const file = path.resolve(process.argv[2] ?? 'dist/index.html');
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

await G(() => { const g = window.__gametool; g.inventory.give('crossbow', 1); g.inventory.give('sword', 1); g.inventory.give('bolt', 10); g.player.pos.set(0, 0, 8); g.player.thirdPerson = false; });

// Two crossbows.
await G(() => { const h = window.__gametool.hands; h.set('right', 'crossbow'); h.set('left', 'crossbow'); });
await frames();
const two = await G(() => { const g = window.__gametool; return { a: g.crossbow.equipped, b: g.crossbow2.equipped, va: g.crossbow.viewmodel.visible, vb: g.crossbow2.viewmodel.visible, sa: g.crossbow.side, sb: g.crossbow2.side, dual: g.crossbow.dual }; });
check('Two crossbows: both held, one each side, both shown', two.a && two.b && two.va && two.vb && two.sa === 1 && two.sb === -1 && two.dual, JSON.stringify(two));
await G(() => window.__gametool.crossbow.setADS(true));
check('Two crossbows can\'t aim down the sights', await G(() => !window.__gametool.crossbow.ads));
const t0 = await G(() => { const g = window.__gametool; g.crossbow.pressReload(); return g.crossbow.reload.total; });
check('R reloads both at 2.2x the time (4.4 s)', Math.abs(t0 - 4.4) < 0.01, String(t0));
await page.waitForFunction(() => { const g = window.__gametool; return g.crossbow.loaded && g.crossbow2.loaded; }, null, { timeout: 120000 }).catch(() => {});
const loaded = await G(() => { const g = window.__gametool; return { a: g.crossbow.loaded, b: g.crossbow2.loaded, bolts: g.inventory.count('bolt') }; });
check('Both load, using a bolt each', loaded.a && loaded.b && loaded.bolts === 8, JSON.stringify(loaded));
// LMB fires the right one, RMB the left.
await page.mouse.move(640, 400);
await page.mouse.down({ button: 'right' }); await page.mouse.up({ button: 'right' });
await frames(2);
const shot1 = await G(() => { const g = window.__gametool; return { a: g.crossbow.loaded, b: g.crossbow2.loaded, bolts: g.crossbow2.bolts.length }; });
check('RMB fires the left-hand crossbow', shot1.a && !shot1.b && shot1.bolts === 1, JSON.stringify(shot1));

// Sway only while aiming: one crossbow, from the hip, the view holds still.
await G(() => { const h = window.__gametool.hands; h.set('left', 'none'); });
await page.waitForTimeout(1200);
const hip = await G(() => { const s = window.__gametool.crossbow.sway; return Math.hypot(s.yaw, s.pitch); });
check('From the hip the crossbow doesn\'t sway', hip < 1e-3, hip.toExponential(2));
await page.mouse.down({ button: 'right' });
await page.waitForTimeout(1200);
const ads = await G(() => { const c = window.__gametool.crossbow; return { ads: c.ads, sway: Math.hypot(c.sway.yaw, c.sway.pitch), fov: window.__gametool.camera.fov }; });
await page.mouse.up({ button: 'right' });
check('RMB with an empty left hand aims; aiming sways', ads.ads && ads.sway > 1e-4, JSON.stringify(ads));

// Two swords: both held; LMB cuts right, RMB cuts left.
await G(() => { const h = window.__gametool.hands; h.set('right', 'sword'); h.set('left', 'sword'); });
await frames();
const sw = await G(() => { const g = window.__gametool; return { a: g.sword.equipped, b: g.sword2.equipped, sa: g.sword.side, sb: g.sword2.side, cb: g.crossbow.equipped }; });
check('Two swords: one each hand, the crossbow put away', sw.a && sw.b && sw.sa === 1 && sw.sb === -1 && !sw.cb, JSON.stringify(sw));
await page.mouse.down({ button: 'right' }); await page.mouse.up({ button: 'right' });
check('RMB swings the left-hand sword', await G(() => window.__gametool.sword2.swinging && !window.__gametool.sword.swinging));
await page.mouse.down({ button: 'right' }); await page.mouse.up({ button: 'right' });
check('Pressing again mid-cut swings the other blade', await G(() => window.__gametool.sword.swinging));

// Sword and crossbow; two torches.
await G(() => { const h = window.__gametool.hands; h.set('right', 'crossbow'); h.set('left', 'sword'); });
await frames();
check('A crossbow in the right hand and a sword in the left', await G(() => { const g = window.__gametool; return g.crossbow.equipped && g.crossbow.side === 1 && g.sword.equipped && g.sword.side === -1 && !g.sword2.equipped; }));
await G(() => { const h = window.__gametool.hands; h.set('right', 'torch'); h.set('left', 'torch'); });
await frames();
const tt = await G(() => { const g = window.__gametool; return { a: g.torch.lit, b: g.torch2.lit, sides: [g.torch.side, g.torch2.side], cb: g.crossbow.equipped, sw: g.sword.equipped }; });
check('Two torches, one each hand, nothing else held', tt.a && tt.b && tt.sides.join() === '1,-1' && !tt.cb && !tt.sw, JSON.stringify(tt));

// The bag's Hands row.
await G(() => { const h = window.__gametool.hands; h.set('right', 'none'); h.set('left', 'none'); });
await page.keyboard.press('KeyI');
await page.waitForFunction(() => window.__gametool.state === 'inventory', null, { timeout: 5000 }).catch(() => {});
await page.click('.inv-hand[data-hand="left"]');
const row = await G(() => ({ held: window.__gametool.hands.held.left, label: document.querySelector('.inv-hand[data-hand="left"] b').textContent }));
check('The bag\'s Hands row changes the left hand', row.held === 'sword' && row.label === 'Sword', JSON.stringify(row));
check('No page errors', errors.length === 0, errors.slice(0, 3).join(' | '));

await browser.close();
const failed = results.filter((r) => !r.ok).length;
console.log(`\n${results.length - failed}/${results.length} passed`);
process.exit(failed ? 1 : 0);
