// Mike 2026-11-05: the knight frame, a pilotable rune mech. Asleep until the descent's third floor is cleared (or ?mech).
// Usage: node test/e2e-knight-frame.mjs [path/to/index.html]   (CHROMIUM_PATH as in e2e.mjs)
import { chromium } from 'playwright-core';
import fs from 'node:fs';
import path from 'node:path';

const file = path.resolve(process.argv[2] ?? 'dist/index.html');
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const results = [];
const check = (id, ok, detail = '') => { results.push({ id, ok }); console.log(`${ok ? 'PASS' : 'FAIL'}  ${id}${detail ? '  — ' + detail : ''}`); };
const ctx = await browser.newContext({ viewport: { width: 1100, height: 680 } });
await ctx.addInitScript(() => localStorage.setItem('gametool.character', JSON.stringify({ name: 'Rowan', motivation: '', secret: '', created: true })));
const page = await ctx.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
await page.route(/^https?:/, (r) => r.abort());
const boot = async (q = '') => {
  await page.goto('file://' + file + q, { timeout: 180000 });
  await page.waitForFunction(() => window.__gametool, null, { timeout: 180000 });
  await page.evaluate(() => document.querySelector('#begin').click());
  await page.waitForFunction(() => window.__gametool.state === 'play', null, { timeout: 180000 });
  await page.evaluate(() => window.__gametool.endWake?.());
};
const G = (fn, a) => page.evaluate(fn, a);
const faceFrame = () => G(() => { const g = window.__gametool, k = g.knight.root, ry = k.rotation.y; g.player.pos.set(k.position.x + Math.sin(ry) * 2.4, k.position.y, k.position.z + Math.cos(ry) * 2.4); g.player.yaw = g.player.bodyYaw = ry; g.player.pitch = 0; });
fs.mkdirSync('test/screenshots', { recursive: true });

await boot();
await faceFrame();
await page.waitForTimeout(600);
const s0 = await G(() => { const g = window.__gametool; return { inScene: !!g.world.scene.getObjectByName('knight-frame'), awake: g.knight.awake, standing: g.knight.standing, verb: g.lookingAtVerb, tris: g.knight.root.userData.tris }; });
check('frame kneels asleep in the treeline at first (low poly)', s0.inScene && !s0.awake && !s0.standing && s0.tris < 1500, JSON.stringify(s0));
check('the prompt says it is asleep', /asleep/.test(s0.verb ?? ''), s0.verb);
await page.keyboard.press('KeyE'); await page.waitForTimeout(200);
check('E on a sleeping frame does not climb in', !(await G(() => window.__gametool.player.piloting)));
await G(() => { const g = window.__gametool, k = g.knight.root; g.player.pos.set(k.position.x - 5.5, k.position.y, k.position.z + 1.5); g.player.yaw = g.player.bodyYaw = -Math.PI / 2 - 0.3; });
await page.waitForTimeout(500);
await page.screenshot({ path: 'test/screenshots/knight-frame-asleep.png' });

// Clearing floor 3 (going down its stairs) wakes it, and the wake is saved.
await G(() => { const g = window.__gametool; g.startDescent(); });
await page.waitForFunction(() => window.__gametool.inDungeon && window.__gametool.descent, null, { timeout: 30000 });
await G(() => { const g = window.__gametool; g.descent.floor = 2; g.goDown(true); });
await page.waitForTimeout(300);
check('going down from floor 2 leaves it asleep', !(await G(() => window.__gametool.knight.awake)));
await page.waitForTimeout(2500);
await G(() => { const g = window.__gametool; g.descent.floor = 3; g.goDown(true); });
await page.waitForTimeout(300);
const s1 = await G(() => ({ awake: window.__gametool.knight.awake, saved: localStorage.getItem('gametool.frame') }));
check('clearing floor 3 wakes it, and the wake is saved', s1.awake && s1.saved === 'awake', JSON.stringify(s1));

// A new boot: awake and standing from the save (give the storage write a moment to land before navigating).
await page.waitForTimeout(1500);
await boot();
await faceFrame();
await page.waitForTimeout(600);
const s2 = await G(() => { const g = window.__gametool; return { standing: g.knight.standing, verb: g.lookingAtVerb, saved: localStorage.getItem('gametool.frame'), url: location.search, awake: g.knight.awake }; });
check('after a reload it stands, ready to climb into', s2.standing && /Climb into/.test(s2.verb ?? ''), JSON.stringify(s2));
await page.keyboard.press('KeyE');
await page.waitForFunction(() => window.__gametool.lookingAtVerb === 'Climb out' && !window.__gametool.player.body.visible, null, { timeout: 10000 }).catch(() => {});
const s3 = await G(() => { const g = window.__gametool; return { piloting: g.player.piloting, body: g.player.body.visible, verb: g.lookingAtVerb, col: g.world.colliders.some((c) => c.kind === 'circle' && c.r === 1 && Math.hypot(c.x - g.knight.root.position.x, c.z - g.knight.root.position.z) < 0.01) }; });
check('E climbs in: the pilot hides, "Climb out" is offered, its own collider is lifted', s3.piloting && !s3.body && s3.verb === 'Climb out' && !s3.col, JSON.stringify(s3));
// Walk: the frame moves with the pilot, slower than a run.
const x0 = await G(() => window.__gametool.knight.root.position.clone());
await page.keyboard.down('KeyW');
await page.waitForFunction((p) => { const k = window.__gametool.knight.root.position; return Math.hypot(k.x - p.x, k.z - p.z) > 0.6; }, x0, { timeout: 8000 }).catch(() => {});   // slow software GL: hold until it has moved
await page.keyboard.up('KeyW');
const moved = await G((p) => { const g = window.__gametool, k = g.knight.root.position; return { d: Math.hypot(k.x - p.x, k.z - p.z), same: k.distanceTo(g.player.pos) < 0.01, speed: g.player.speed() }; }, x0);
check('W walks the frame (it follows the pilot, slower than a run)', moved.d > 0.6 && moved.same && moved.speed < 5, JSON.stringify(moved));
// Space = slam (no jump); Q = rune pulse; LMB = strike; a goblin in reach gets hit.
const y0 = await G(() => window.__gametool.player.pos.y);
await page.keyboard.press('Space'); await page.waitForTimeout(100);
const slam = await G((y0) => { const g = window.__gametool; return { busy: g.knight.busy, airborne: g.player.airborne, dy: g.player.pos.y - y0 }; }, y0);
check('Space is a ground-slam, not a jump', slam.busy && !slam.airborne, JSON.stringify(slam));
await page.waitForFunction(() => !window.__gametool.knight.busy, null, { timeout: 10000 });
await page.keyboard.press('KeyQ'); await page.waitForTimeout(100);
check('Q starts a rune pulse', await G(() => window.__gametool.knight.busy && window.__gametool.knight.pulseWait > 0));
await page.waitForFunction(() => !window.__gametool.knight.busy, null, { timeout: 10000 });
await page.keyboard.press('KeyF'); await page.waitForTimeout(200);
await page.keyboard.press('KeyF'); await page.waitForTimeout(200);
await page.keyboard.press('KeyF'); await page.waitForTimeout(200);
check('no first person inside the frame', await G(() => window.__gametool.player.thirdPerson));
const strikes = await G(async () => { const g = window.__gametool, seen = []; const prev = g.knight.onStrike; g.knight.onStrike = (k, a, f) => { seen.push(k); prev?.(k, a, f); }; g.handButton('right', true); g.handButton('right', false); for (let i = 0; i < 50 && !seen.length; i++) await new Promise((r) => setTimeout(r, 100)); g.knight.onStrike = prev; return seen; });
check('the right hand (LMB / RT / Strike) throws a punch', strikes.includes('swing'), JSON.stringify(strikes));
await page.screenshot({ path: 'test/screenshots/knight-frame-pilot.png' });
// Climb out: back on foot behind it, collider back.
await page.keyboard.press('KeyE'); await page.waitForTimeout(300);
const s4 = await G(() => { const g = window.__gametool, k = g.knight.root.position; return { piloting: g.player.piloting, d: g.player.pos.distanceTo(k), col: g.world.colliders.some((c) => c.kind === 'circle' && c.r === 1 && Math.hypot(c.x - k.x, c.z - k.z) < 0.01) }; });
check('E climbs out behind it; it stays where you left it, solid again', !s4.piloting && s4.d > 1.2 && s4.col, JSON.stringify(s4));

// ?mech wakes it for testing without the save.
await G(() => localStorage.removeItem('gametool.frame'));
await boot('?mech');
check('?mech wakes it straight away (testing)', await G(() => window.__gametool.knight.awake && window.__gametool.knight.standing));

check('no page errors', errors.length === 0, errors.join(' | '));
const passed = results.filter((r) => r.ok).length;
console.log(`\n${passed}/${results.length} checks passed`);
await browser.close();
process.exit(passed === results.length ? 0 : 1);
