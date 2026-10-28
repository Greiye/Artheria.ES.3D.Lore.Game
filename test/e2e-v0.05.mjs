// Automated Done-when checks for v0.05 (§8): F4 crossbow. Creativity: none (combat only, stated in §8).
// Usage: npm run build && node test/e2e-v0.05.mjs [path/to/index.html]
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

const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
await ctx.addInitScript(() => localStorage.setItem('gametool.character', JSON.stringify({ name: 'Test', motivation: '', secret: '', created: true })));
const page = await ctx.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
await page.route(/^https?:/, (r) => r.abort());
await page.goto('file://' + file);
await page.waitForFunction(() => window.__gametool);
await page.click('#begin');
await page.waitForFunction(() => window.__gametool.state === 'play', null, { timeout: 5000 });

const cb = (fn) => G(page, fn);
// No crossbow yet: 1 does nothing.
await page.keyboard.press('Digit1');
check('F4.1 1 does nothing before Natalie hands over the crossbow', await cb(() => !window.__gametool.crossbow.equipped));
// What Natalie's n4 gives (F3.4).
await cb(() => { const i = window.__gametool.inventory; i.give('crossbow', 1); i.give('bolt', 10); });
await page.keyboard.press('Digit1');
// Wait on game state, not 200 ms of wall clock: the viewmodel shows on the next rendered frame, and software frames are slow.
const equipped = await page.waitForFunction(() => window.__gametool.crossbow.equipped && window.__gametool.crossbow.viewmodel.visible, null, { timeout: 5000, polling: 100 }).then(() => true, () => false);
check('F4.1 1 equips the crossbow (viewmodel shown)', equipped, JSON.stringify(await cb(() => ({ eq: window.__gametool.crossbow.equipped, vis: window.__gametool.crossbow.viewmodel.visible, state: window.__gametool.state }))));

// F4.3 normal reload: R, wait 2 s.
const t0 = Date.now();
await page.keyboard.press('KeyR');
await page.waitForFunction(() => window.__gametool.crossbow.loaded, null, { timeout: 6000 });
const r1 = await cb(() => ({ out: window.__gametool.crossbow.lastReloadOutcome, bolts: window.__gametool.inventory.count('bolt') }));
check('F4.3 normal reload: R loads a bolt after ~2 s', r1.out === 'normal' && r1.bolts === 9 && Date.now() - t0 > 1500, JSON.stringify(r1));

// F4.1 ADS: RMB lowers FOV by 15°.
const baseFov = await cb(() => window.__gametool.settings.fov);
await page.mouse.move(640, 400);
await page.mouse.down({ button: 'right' });
await page.waitForTimeout(600);
const adsFov = await cb(() => window.__gametool.camera.fov);
await page.screenshot({ path: path.join(shots, 'v05-ads.png') });
await page.mouse.up({ button: 'right' });
check('F4.1 RMB aims down sights (FOV −15°)', Math.abs(baseFov - 15 - adsFov) < 1, `${baseFov} → ${adsFov.toFixed(1)}`);

// F4.1 / F4.2: LMB fires; bolt leaves the muzzle at 60 m/s and sticks in the library wall.
// Aim right of the door, clear of Natalie. Set it in a capture listener on the click itself: headless Chromium
// re-centres the locked pointer with stray mousemoves that would otherwise turn the view between aim and click.
await cb(() => { const p = window.__gametool.player; p.pos.set(0, 0, -5); window.addEventListener('mousedown', () => { p.yaw = -0.3; p.pitch = 0.05; }, { capture: true, once: true }); });
await page.waitForTimeout(300);   // a frame moves the eye to the new position
await page.mouse.down({ button: 'left' }); await page.mouse.up({ button: 'left' });
const shot = await cb(() => { const b = window.__gametool.crossbow.bolts[0]; return b ? { speed: b.vel.length(), d: b.origin.distanceTo(window.__gametool.player.eyePos) } : null; });
check('F4.1 LMB fires: a bolt leaves the muzzle', !!shot && shot.d < 1, JSON.stringify(shot));
check('F4.2 bolt speed 60 m/s', !!shot && Math.abs(shot.speed - 60) < 1.5, shot?.speed.toFixed(2));
await page.waitForFunction(() => window.__gametool.crossbow.bolts[0]?.stuck, null, { timeout: 4000 }).catch(() => undefined);
const stuck = await cb(() => { const b = window.__gametool.crossbow.bolts[0]; return b && { stuck: b.stuck, z: b.mesh.position.z, y: b.mesh.position.y }; });
check('F4.2 bolt sticks where it hits (library wall)', !!stuck && stuck.stuck && stuck.z > -19.5 && stuck.z < -16, JSON.stringify(stuck));
check('F4.4 a shot consumed a bolt (not reloaded yet)', await cb(() => !window.__gametool.crossbow.loaded && window.__gametool.inventory.count('bolt') === 9));
// Gravity: fire level from a height, it drops.
await page.keyboard.press('KeyR');
await page.waitForFunction(() => window.__gametool.crossbow.loaded, null, { timeout: 6000 });
await cb(() => { const p = window.__gametool.player; p.pos.set(0, 0, 8); p.yaw = Math.PI; p.pitch = 0; });
await page.waitForTimeout(200);
await page.mouse.down({ button: 'left' }); await page.mouse.up({ button: 'left' });
await page.waitForTimeout(250);
const fall = await cb(() => { const b = window.__gametool.crossbow.bolts.at(-1); return { vy: b.vel.y, stuck: b.stuck }; });
check('F4.2 bolts fall under gravity', fall.stuck || fall.vy < -0.5, JSON.stringify(fall));

// F4.3 perfect reload: second R inside the zone → 0.5 s, 2× next shot.
const perfect = await G(page, async () => {
  const c = window.__gametool.crossbow;
  c.pressReload();
  const t0 = performance.now();
  await new Promise((r) => { const tick = () => (c.reload.active && c.reload.t >= 0.4 ? r() : requestAnimationFrame(tick)); tick(); });
  c.pressReload();   // 0.4 s into a 2 s bar = 20%: inside the 15–30% zone
  await new Promise((r) => { const tick = () => (c.loaded ? r() : requestAnimationFrame(tick)); tick(); });
  return { out: c.lastReloadOutcome, secs: (performance.now() - t0) / 1000, bonus: c.bonusNextShot };
});
check('F4.3 R in the 15% zone = 0.5 s reload + 2× damage next shot', perfect.out === 'fast' && perfect.bonus && perfect.secs < 1.0, JSON.stringify(perfect));
await page.mouse.down({ button: 'left' }); await page.mouse.up({ button: 'left' });
check('F4.3 the bonus shot carries 2× damage', await cb(() => window.__gametool.crossbow.bolts.at(-1).damage === 2));
// F4.3 miss → 3 s jam.
const jam = await G(page, async () => {
  const c = window.__gametool.crossbow;
  c.pressReload();
  const t0 = performance.now();
  await new Promise((r) => { const tick = () => (c.reload.t >= 1.2 ? r() : requestAnimationFrame(tick)); tick(); });
  c.pressReload();   // 60%: outside the zone
  await new Promise((r) => { const tick = () => (c.loaded ? r() : requestAnimationFrame(tick)); tick(); });
  return { out: c.lastReloadOutcome, secs: (performance.now() - t0) / 1000 };
});
check('F4.3 R outside the zone = 3 s jam', jam.out === 'jam' && jam.secs > 2.7 && jam.secs < 4.5, JSON.stringify(jam));
await page.screenshot({ path: path.join(shots, 'v05-crossbow.png') });

// F4.4: E on a stuck bolt picks it up.
const before = await cb(() => window.__gametool.inventory.count('bolt'));
const target = await cb(() => { const b = window.__gametool.crossbow.bolts.find((x) => x.stuck); return b && b.mesh.position.toArray(); });
await cb((t) => {}, target);
await G(page, (t) => {
  const g = window.__gametool, p = g.player;
  p.pos.set(t[0], 0, t[2] + 1.2);
  const dy = t[1] - 1.7, dz = -1.2;
  p.yaw = 0; p.pitch = Math.atan2(dy, -dz);
}, target);
await page.waitForTimeout(300);
const verb = await cb(() => document.getElementById('promptVerb').textContent);
await page.keyboard.press('KeyE');
await page.waitForTimeout(200);
const afterPick = await cb(() => window.__gametool.inventory.count('bolt'));
check('F4.4 E picks up a stuck bolt → count restores', verb === 'Pick up bolt' && afterPick === before + 1, `${verb}: ${before} → ${afterPick}`);

// F4.2: stuck bolts vanish after 30 s (fast-forwarded).
await cb(() => window.__gametool.crossbow.bolts.forEach((b) => { if (b.stuck) b.age = 31; }));
// Wait on frames, not wall time: SwiftShader can stall a frame for longer than a fixed wait.
const gone = await page.waitForFunction(() => window.__gametool.crossbow.bolts.every((b) => !b.stuck), null, { timeout: 5000 }).then(() => true, () => false);
check('F4.2 stuck bolts disappear after 30 s', gone);

await page.keyboard.press('Digit2'); await page.waitForTimeout(150);   // visibility follows on the next frame
check('§5 2 = hands (crossbow away)', await cb(() => !window.__gametool.crossbow.equipped && !window.__gametool.crossbow.viewmodel.visible));
check('v0.05: no console/page errors', errors.length === 0, errors.join(' | '));
await browser.close();
const failed = results.filter((r) => !r.ok).length;
console.log(`\n${results.length - failed}/${results.length} checks passed`);
process.exit(failed ? 1 : 0);
