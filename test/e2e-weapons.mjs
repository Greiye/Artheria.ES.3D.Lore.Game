// Mike 2026-11-05: daggers, maces, spears, rocks and slings, in either hand. The smith sells the dagger, mace and
// spear; the store sells the sling; rock piles about town give rocks. Each hand weapon has its own speed, reach and
// weight; rocks are thrown from the hand; the sling whirls while held and looses on release (longer = harder).
// Usage: node test/e2e-weapons.mjs [path/to/index.html]   (CHROMIUM_PATH as in e2e.mjs)
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

// Wares.
const smith = await G(() => window.__gametool.smithShop.wares.map((w) => w.id));
check('The smith sells dagger, mace and spear (with the shields)', ['buckler', 'shield', 'dagger', 'mace', 'spear'].every((id) => smith.includes(id)), smith.join());
check('The store sells a sling', await G(() => window.__gametool.shop.wares.some((w) => w.id === 'sling')));

// A rock pile.
await G(() => { const g = window.__gametool, h = g.rockPiles[0], p = new g.Vector3(); h.getWorldPosition(p); g.player.spawn(new g.Vector3(p.x, 0, p.z + 1.6), 0); g.player.thirdPerson = false; g.player.pitch = -0.6; });
await frames(8);
const verb = await G(() => window.__gametool.lookingAtVerb);
await G(() => window.__gametool.interactables.find((x) => x.obj === window.__gametool.rockPiles[0]).act());
check('A rock pile gives five rocks', (await G(() => window.__gametool.inventory.count('rock'))) === 5, String(verb));

// Each melee kind: its own speed, reach and weight.
await G(() => { const i = window.__gametool.inventory; for (const id of ['dagger', 'mace', 'spear', 'sling']) i.give(id, 1); });
const kinds = await G(() => {
  const g = window.__gametool, out = {};
  for (const k of ['dagger', 'mace', 'spear']) {
    g.hands.set('right', k); g.hands.set('left', 'none');
    let got = null; const prev = g.sword.slash; g.sword.slash = (c) => { got = c; return 0; };
    g.sword.swing(); for (let t = 0; t < 1; t += 0.02) g.sword.update(0.02);
    g.sword.slash = prev;
    out[k] = { kind: g.sword.kind, reach: got?.reach, arc: got?.arc, dmg: got?.damage, heavy: got?.heavy };
  }
  return out;
});
check('The dagger is short and light; the spear reaches far and narrow; the mace hits heavy', kinds.dagger.reach < 1.5 && kinds.dagger.dmg === 1 && kinds.spear.reach > 2.4 && kinds.spear.arc < 0.5 && kinds.mace.heavy && kinds.mace.dmg >= 3, JSON.stringify(kinds));
await G(() => { const h = window.__gametool.hands; h.set('right', 'dagger'); h.set('left', 'mace'); });
await frames(4);
const pair = await G(() => { const g = window.__gametool; return [g.sword.kind, g.sword.side, g.sword2.kind, g.sword2.side, g.sword.held.visible, g.sword2.held.visible]; });
check('A dagger in the right hand and a mace in the left', pair.slice(0, 4).join() === 'dagger,1,mace,-1', JSON.stringify(pair));
await G(() => { const h = window.__gametool.hands; h.set('left', 'spear'); window.__gametool.player.thirdPerson = true; });
await frames(10);
await page.screenshot({ path: path.join(shots, 'weapons-dagger-spear.png') });

// Throwing a rock.
await G(() => { const g = window.__gametool; g.player.thirdPerson = false; g.player.pitch = 0; g.hands.set('right', 'rock'); g.hands.set('left', 'sling'); });
await frames(4);
const r0 = await G(() => window.__gametool.inventory.count('rock'));
await page.mouse.move(640, 400);
await page.mouse.down(); await page.mouse.up();
await frames(3);
const thrown = await G(() => ({ rocks: window.__gametool.inventory.count('rock'), flying: window.__gametool.Thrower.rocks.length }));
check('LMB throws a rock from the right hand', thrown.rocks === r0 - 1 && thrown.flying === 1, JSON.stringify(thrown));
// The sling: hold to whirl, let go to loose; a long whirl flies faster than a short one.
await page.mouse.down({ button: 'right' });
await frames(2);
const whirl = await G(() => window.__gametool.thrower2.spin >= 0 || window.__gametool.thrower.spin >= 0);
await page.waitForTimeout(1300);
const pw = await G(() => { const g = window.__gametool; return Math.max(g.thrower.power, g.thrower2.power); });
await page.screenshot({ path: path.join(shots, 'weapons-sling-whirl.png') });
await page.mouse.up({ button: 'right' });
await frames(1);
const slung = await G(() => { const R = window.__gametool.Thrower.rocks, r = R[R.length - 1]; return { n: R.length, speed: r.vel.length(), dmg: r.damage }; });
check('RMB held whirls the left-hand sling; letting go looses a rock, fast and hard when fully wound', whirl && pw > 0.3 && slung.n === 2 && slung.speed > 25 && slung.dmg > 1, JSON.stringify({ whirl, pw, slung }));
// Landed rocks can be picked back up.
await page.waitForFunction(() => window.__gametool.Thrower.rocks.some((r) => r.landed), null, { timeout: 20000 }).catch(() => {});
const back = await G(() => { const g = window.__gametool, r = g.Thrower.rocks.find((x) => x.landed); if (!r) return null; const n = g.inventory.count('rock'); g.Thrower.pickUp(r, g.inventory); return g.inventory.count('rock') - n; });
check('A landed rock can be picked up again', back === 1, String(back));
check('No page errors', errors.length === 0, errors.slice(0, 3).join(' | '));

await browser.close();
const failed = results.filter((r) => !r.ok).length;
console.log(`\n${results.length - failed}/${results.length} passed`);
process.exit(failed ? 1 : 0);
