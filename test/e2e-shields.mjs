// Mike 2026-11-05: shields to equip and blocking. The smith's counter sells a buckler and a round shield; either
// goes in either hand (or both). Hold that hand's button to block: a shield turns a blow from the front, a sword
// held up after its cut turns half. Blows from behind, and snares, get through. Two shields cover a wider arc.
// Usage: node test/e2e-shields.mjs [path/to/index.html]   (CHROMIUM_PATH as in e2e.mjs)
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

// The smith's counter: walk up and buy.
const counter = await G(() => { const g = window.__gametool, c = g.smithCounter.position; const [fx, fz] = g.smithCounter.userData.front; g.player.spawn(new g.Vector3(c.x + fx * 2.2, 0, c.z + fz * 2.2), Math.atan2(fx, fz)); g.inventory.give('crown', 60); g.inventory.give('sword', 1); return [c.x, c.z]; });
await frames(8);
await G(() => { const g = window.__gametool; g.interactables.find((x) => x.obj.name === 'smith-counter').act(); });
await page.waitForFunction(() => !document.getElementById('smithShop').classList.contains('hidden'), null, { timeout: 5000 }).catch(() => {});
const wares = await G(() => [...document.querySelectorAll('#smithShop [data-buy]')].map((b) => b.textContent.trim()));
check('The smith sells a buckler and a round shield', wares.length >= 2 && /Buckler/.test(wares[0]) && /Round Shield/.test(wares[1]), JSON.stringify(wares));
await page.screenshot({ path: path.join(shots, 'shields-smith.png') });
await page.click('#smithShop [data-buy="1"]');
const bought = await G(() => { const g = window.__gametool; return { n: g.inventory.count('shield'), left: g.hands.held.left }; });
check('Buying the round shield puts it on the left hand', bought.n === 1 && bought.left === 'shield', JSON.stringify(bought));
await page.click('#smithShop [data-act="close"]');
await page.waitForFunction(() => window.__gametool.state === 'play', null, { timeout: 8000 }).catch(() => {});

// Blocking: face north (yaw 0 looks along -z); a blow from in front, then from behind.
await G(() => { const g = window.__gametool; g.player.thirdPerson = false; g.player.yaw = 0; g.player.bodyYaw = 0; g.hands.set('right', 'sword'); });
await frames(4);
const front = () => G(() => { const g = window.__gametool, p = g.player.pos; return g.blockBlow(2, new g.Vector3(p.x, 0, p.z - 1.5)); });
const back = () => G(() => { const g = window.__gametool, p = g.player.pos; return g.blockBlow(2, new g.Vector3(p.x, 0, p.z + 1.5)); });
check('Not blocking: the blow lands', !(await front()).blocked);
await page.mouse.move(640, 400);
await page.mouse.down({ button: 'right' });
await frames(10);
const up = await G(() => ({ blocking: window.__gametool.shield.blocking, vm: window.__gametool.shield.viewmodel.visible }));
check('Holding RMB raises the left-hand shield', up.blocking && up.vm, JSON.stringify(up));
await page.screenshot({ path: path.join(shots, 'shields-block-first.png') });
const f1 = await front(), b1 = await back(), snare = await G(() => window.__gametool.blockBlow(2, null));
check('Raised, the shield turns a blow from the front', f1.blocked && f1.dmg === 0, JSON.stringify(f1));
check('A blow from behind still lands', !b1.blocked && b1.dmg === 2, JSON.stringify(b1));
check('A snare (from below) can\'t be blocked', !snare.blocked);
await page.mouse.up({ button: 'right' });
await frames(4);
check('Let go, the shield comes down', await G(() => !window.__gametool.shield.blocking));

// A sword held up after its cut turns half.
await G(() => window.__gametool.handButton('right', true));
await page.waitForFunction(() => !window.__gametool.sword.swinging, null, { timeout: 8000 });
const sw = await front();
await G(() => window.__gametool.handButton('right', false));
check('A sword held up after the cut turns half the blow', sw.blocked && sw.dmg === 1, JSON.stringify(sw));

// Two shields: a wider arc. 55° off the front: one buckler misses it; two catch it.
await G(() => { const g = window.__gametool; g.inventory.give('buckler', 1); g.hands.set('right', 'buckler'); g.hands.set('left', 'none'); });
const side = () => G(() => { const g = window.__gametool, p = g.player.pos, a = 55 * Math.PI / 180; return g.blockBlow(2, new g.Vector3(p.x - Math.sin(a) * 1.5, 0, p.z - Math.cos(a) * 1.5)); });
await G(() => window.__gametool.handButton('right', true)); await frames(2);
const oneB = await side();
await G(() => { const g = window.__gametool; g.hands.set('left', 'buckler'); g.handButton('left', true); }); await frames(2);
const twoB = await side();
await G(() => { const g = window.__gametool; g.handButton('right', false); g.handButton('left', false); });
check('One buckler misses a blow 55° off; two catch it', !oneB.blocked && twoB.blocked, JSON.stringify({ oneB, twoB }));
const two = await G(() => { const g = window.__gametool; return { a: g.shield.equipped, b: g.shield2.equipped, kinds: [g.shield.kind, g.shield2.kind], sides: [g.shield.side, g.shield2.side] }; });
check('Two bucklers, one on each arm', two.a && two.b && two.kinds.join() === 'buckler,buckler' && two.sides.join() === '1,-1', JSON.stringify(two));

// Third person, shield up.
await G(() => { const g = window.__gametool; g.hands.set('left', 'shield'); g.hands.set('right', 'sword'); g.player.thirdPerson = true; const [fx, fz] = g.smithCounter.userData.front; g.player.bodyYaw = g.player.yaw = Math.atan2(-fx, -fz) + Math.PI; g.handButton('left', true); });
await frames(12);
await page.screenshot({ path: path.join(shots, 'shields-block-third.png') });
await G(() => window.__gametool.handButton('left', false));
check('No page errors', errors.length === 0, errors.slice(0, 3).join(' | '));

await browser.close();
const failed = results.filter((r) => !r.ok).length;
console.log(`\n${results.length - failed}/${results.length} passed`);
process.exit(failed ? 1 : 0);
