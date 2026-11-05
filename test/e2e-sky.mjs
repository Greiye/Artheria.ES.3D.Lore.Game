// Skyrunner (Mike 2026-11-05): fly a mana-sail glider from the perch east of the library, A to B inside 60 s on a
// seeded map, wind rings +2 s, and one run in twenty a hexed skyrunner to fight. Driven through the game with real
// key presses for the controls; the encounter is forced for the dogfight checks.
// Usage: node test/e2e-sky.mjs [path/to/index.html]   (CHROMIUM_PATH as in e2e.mjs)
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
const until = (page, fn, arg, timeout = 20000) => page.waitForFunction(fn, arg, { timeout, polling: 50 }).then(() => true, () => false);

const page = await (await browser.newContext({ viewport: { width: 1280, height: 720 } })).newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
await page.route(/^https?:/, (r) => r.abort());
await page.goto('file://' + file);
await page.waitForFunction(() => window.__gametool);
await page.waitForTimeout(400);
await page.click('#begin');
await page.waitForFunction(() => window.__gametool.state === 'play');

// The perch stands in the meadow and offers a run.
const verb = await G(page, () => { const g = window.__gametool; return g.interactables.find((i) => i.obj === g.perch.hit)?.verb(); });
check('The perch offers "Fly a sky run"', /Fly a sky run/.test(verb ?? ''), verb);
await G(page, () => { const g = window.__gametool; g.player.spawn(new g.Vector3(36, 0, 11), 0); });
await page.waitForTimeout(800);
await page.screenshot({ path: path.join(shots, 'sky-perch.png') });

// Same seed, same map.
await G(page, () => { window.__gametool.sky.forceFoe = false; window.__gametool.openSky(424242); });
const open = await G(page, () => { const g = window.__gametool, s = g.sky; return { state: g.state, open: s.isOpen, seed: s.map.seed, dist: s.map.dist, phase: s.phase, rings: s.map.rings.length, clock: document.querySelector('#skyRun .sk-clock').textContent }; });
check('A run opens on its own map: 60 s clock, 4 wind rings, A to B 1.6 to 2 km', open.open && open.state === 'forge' && open.seed === 424242 && open.dist >= 1600 && open.dist <= 2000 && open.rings === 4 && open.clock === '60', JSON.stringify(open));
check('Ready count before the clock runs', open.phase === 'ready');
await until(page, () => window.__gametool.sky.phase === 'fly', null, 10000);
await page.waitForTimeout(1500);
const fly = await G(page, () => { const s = window.__gametool.sky; return { time: s.time, speed: s.me.speed, y: s.me.pos.y }; });
check('Go: the clock runs and the glider flies', fly.time < 59.5 && fly.speed > 20, JSON.stringify(fly));
await page.screenshot({ path: path.join(shots, 'sky-flight.png') });

// Real keys: W dives, D banks right.
const y0 = await G(page, () => window.__gametool.sky.me.forward(new window.__gametool.Vector3()).y);
await page.keyboard.down('KeyW'); await page.waitForTimeout(500); await page.keyboard.up('KeyW');
const y1 = await G(page, () => window.__gametool.sky.me.forward(new window.__gametool.Vector3()).y);
check('W pushes the nose down', y1 < y0 - 0.1, `${y0.toFixed(2)} -> ${y1.toFixed(2)}`);
await page.keyboard.down('KeyS'); await page.waitForTimeout(500); await page.keyboard.up('KeyS');
await page.keyboard.down('KeyD'); await page.waitForTimeout(400); await page.keyboard.up('KeyD');
const bank = await G(page, () => window.__gametool.sky.me.bank());
check('D banks right', bank > 0.3, bank.toFixed(2));
await page.waitForTimeout(1500);
const level = await G(page, () => window.__gametool.sky.me.bank());
check('Let go and the wings level out', Math.abs(level) < Math.abs(bank) * 0.5, level.toFixed(2));

// A wind ring adds 2 s.
const ring = await G(page, async () => { const s = window.__gametool.sky, r = s.sky.rings[0], t0 = s.time; s.me.pos.copy(r.position); await new Promise((ok) => setTimeout(ok, 200)); return { gained: s.time - t0, taken: s.ringsTaken, hidden: !r.visible }; });
check('Flying through a wind ring: +2 s', ring.taken === 1 && ring.hidden && ring.gained > 1.5, JSON.stringify(ring));

// Reach the beacon: a win, crowns, a best time for this map.
const crowns0 = await G(page, () => window.__gametool.purse.crowns);
await G(page, () => { const s = window.__gametool.sky, m = s.map; s.me.pos.set(m.goal.x, m.goal.y + 70, m.goal.z); });
await until(page, () => window.__gametool.sky.phase === 'done', null, 5000);
await page.waitForTimeout(300);
const won = await G(page, () => { const s = window.__gametool.sky; return { end: s.end, title: document.querySelector('#skyRun .sk-r-title').textContent, map: document.querySelector('#skyRun .sk-r-map').textContent, best: s.record.best['424242'], crowns: window.__gametool.purse.crowns }; });
check('Reaching the beacon wins: +20 crowns, best time saved for the map', won.end === 'won' && /Beacon/.test(won.title) && won.best > 0 && won.crowns - crowns0 === 20 && /Map #424242/.test(won.map), JSON.stringify(won) + ' from ' + crowns0);
await page.screenshot({ path: path.join(shots, 'sky-win.png') });

// Again (same map): back on the perch, same terrain.
const h0 = await G(page, () => Array.from(window.__gametool.sky.map.h.slice(0, 50)).join());
await page.click('#skAgain');
const again = await G(page, (h) => { const s = window.__gametool.sky; return { phase: s.phase, same: Array.from(s.map.h.slice(0, 50)).join() === h, time: s.time }; }, h0);
check('Again flies the same map from the start', again.phase === 'ready' && again.same && again.time === 60, JSON.stringify(again));
await until(page, () => window.__gametool.sky.phase === 'fly', null, 10000);

// Into the ground: crashed.
await G(page, () => { const s = window.__gametool.sky; s.me.pos.y = -20; });
await until(page, () => window.__gametool.sky.phase === 'done', null, 5000);
check('Hitting the ground ends the run: Crashed', await G(page, () => window.__gametool.sky.end === 'crashed'));

// Out of time.
await page.click('#skNew');
const newMap = await G(page, () => window.__gametool.sky.map.seed);
check('New map rolls a different seed', newMap !== 424242, String(newMap));
await until(page, () => window.__gametool.sky.phase === 'fly', null, 10000);
await G(page, () => { window.__gametool.sky.time = 0.05; });
await until(page, () => window.__gametool.sky.phase === 'done', null, 5000);
check('The clock running out ends the run: Out of time', await G(page, () => window.__gametool.sky.end === 'late' && /Out of time/.test(document.querySelector('#skyRun .sk-r-title').textContent)));

// The 1 in 20: roughly 5% over many rolls (the roll itself, not flown).
const rate = await G(page, () => { const s = window.__gametool.sky; s.forceFoe = null; let n = 0; for (let i = 0; i < 4000; i++) { s.start(s.map.seed); if (s.foeRolled) n++; } return n / 4000; });
check('The hexed skyrunner turns up about one run in twenty', rate > 0.035 && rate < 0.065, rate.toFixed(3));

// Dogfight: forced; it shows up 10 s in, fights back, and can be shot down for +30.
await G(page, () => { const s = window.__gametool.sky; s.forceFoe = true; s.start(s.map.seed); });
await until(page, () => window.__gametool.sky.phase === 'fly', null, 10000);
await G(page, () => { window.__gametool.sky.flown = 9.9; });
const foeIn = await until(page, () => !!window.__gametool.sky.foe, null, 5000);
const foe = await G(page, () => { const s = window.__gametool.sky; return { hp: s.foe?.hp, mark: !document.querySelector('#skyRun .sk-foe').classList.contains('hidden'), banner: document.querySelector('#skyRun .sk-banner').textContent }; });
check('Forced encounter: the hexed skyrunner arrives 10 s in, marked on screen', foeIn && foe.hp === 4 && foe.mark && /Hexed/.test(foe.banner), JSON.stringify(foe));
await page.waitForTimeout(2500);
await page.screenshot({ path: path.join(shots, 'sky-dogfight.png') });
const fought = await G(page, async () => {
  const s = window.__gametool.sky, V = window.__gametool.Vector3;
  // Park the foe ahead of the nose and hold the trigger.
  s.ai.ctl = () => ({ pitch: 0, roll: 0, throttle: 0.5, fire: false, surge: false });
  for (let i = 0; i < 80 && s.foe.alive; i++) {
    s.me.pos.y = 300; s.time = 50;
    s.foe.pos.copy(s.me.pos).addScaledVector(s.me.forward(new V()), 60); s.foe.q.copy(s.me.q); s.foe.speed = s.me.speed;
    s.me.heat = 0; s.me.jammed = 0;
    await new Promise((ok) => setTimeout(ok, 50));
    window.dispatchEvent(new KeyboardEvent('keydown', { code: 'Space' }));
  }
  window.dispatchEvent(new KeyboardEvent('keyup', { code: 'Space' }));
  return { alive: s.foe.alive, kill: s.kill, hp: s.foe.hp };
});
check('Mana bolts shoot the hexed skyrunner down (4 hits)', !fought.alive && fought.kill && fought.hp <= 0, JSON.stringify(fought));
const crowns1 = await G(page, () => window.__gametool.purse.crowns);
await G(page, () => { const s = window.__gametool.sky, m = s.map; s.me.pos.set(m.goal.x, m.goal.y + 70, m.goal.z); });
await until(page, () => window.__gametool.sky.phase === 'done', null, 5000);
await page.waitForTimeout(200);
check('A win with a kill pays 20 + 30 crowns', await G(page, (c) => window.__gametool.purse.crowns - c === 50, crowns1), String(await G(page, (c) => window.__gametool.purse.crowns - c, crowns1)));

// Its bolts hurt you, and five hits brings you down.
await G(page, () => { const s = window.__gametool.sky; s.start(s.map.seed); });
await until(page, () => window.__gametool.sky.phase === 'fly', null, 10000);
await G(page, () => { window.__gametool.sky.flown = 9.9; });
await until(page, () => !!window.__gametool.sky.foe, null, 5000);
const downed = await G(page, async () => {
  const s = window.__gametool.sky, V = window.__gametool.Vector3;
  s.me.pos.y = 300; s.ai.ctl = () => ({ pitch: 0, roll: 0, throttle: 0.5, fire: false, surge: false });
  for (let i = 0; i < 5; i++) s.hit(s.me);
  await new Promise((ok) => setTimeout(ok, 2500));
  return { end: s.end, hp: s.me.hp };
});
check('Five hits and you are shot down', downed.end === 'downed' && downed.hp === 0, JSON.stringify(downed));

// Esc leaves: back at the foot of the perch, playing.
await page.keyboard.press('Escape');
const left = await until(page, () => window.__gametool.state === 'play' && !window.__gametool.sky.isOpen, null, 5000);
const at = await G(page, () => { const p = window.__gametool.player.pos; return Math.hypot(p.x - 36, p.z - 7); });
check('Esc leaves the run, back by the perch', left && at < 1.5, at.toFixed(2));
check('Record saved (runs, wins, kills)', await G(page, () => { const r = JSON.parse(localStorage.getItem('gametool.sky')); return r.runs >= 5 && r.wins >= 2 && r.kills >= 1; }));

// Touch: the stick and buttons show on a phone.
const t = await (await browser.newContext({ viewport: { width: 844, height: 390 }, hasTouch: true, isMobile: true })).newPage();
await t.route(/^https?:/, (r) => r.abort());
await t.goto('file://' + file);
await t.waitForFunction(() => window.__gametool, null, { timeout: 90000 });
await t.waitForTimeout(400);
await t.tap('#begin');
await t.waitForFunction(() => window.__gametool.state === 'play', null, { timeout: 60000 });
await G(t, () => { document.body.dataset.input = 'touch'; window.__gametool.sky.forceFoe = false; window.__gametool.openSky(777777); });
await until(t, () => window.__gametool.sky.phase === 'fly', null, 10000);
const tc = await G(t, () => { const v = (s) => !!document.querySelector(s)?.offsetParent; return { pad: v('#skyRun .sk-pad'), fire: v('#skyRun .sk-fire'), help: v('#skyRun .sk-help-keys') }; });
check('Touch: Fire, Surge and Look back buttons; no key help', tc.pad && tc.fire && !tc.help, JSON.stringify(tc));
const fireBox = await t.locator('#skyRun .sk-fire').boundingBox();
await t.touchscreen.tap(fireBox.x + fireBox.width / 2, fireBox.y + fireBox.height / 2);
await t.waitForTimeout(800);
await t.screenshot({ path: path.join(shots, 'sky-touch.png') });

check('No page errors', errors.length === 0, errors.slice(0, 3).join(' | '));
await browser.close();
const failed = results.filter((r) => !r.ok).length;
console.log(`${results.length - failed}/${results.length} checks passed`);
process.exit(failed ? 1 : 0);
