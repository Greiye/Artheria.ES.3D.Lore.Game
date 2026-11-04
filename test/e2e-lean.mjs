// B41 (Mike 2026-11-04): auto-lean. Aiming with a wall edge just ahead leans out toward the open side (eyes, aim
// line and view move and tilt); crouched behind low cover, aiming rises to peek over; moving or letting go eases
// back in. Settings > Gameplay > Auto-lean turns it off.
// Usage: node test/e2e-lean.mjs [path/to/index.html]   (CHROMIUM_PATH as in e2e.mjs)
import { chromium } from 'playwright-core';
import path from 'node:path';

const file = path.resolve(process.argv[2] ?? 'dist/index.html');
const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH || undefined,
  args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'],
});
const results = [];
const check = (id, ok, detail = '') => { results.push({ id, ok }); console.log(`${ok ? 'PASS' : 'FAIL'}  ${id}${detail ? '  — ' + detail : ''}`); };
const page = await (await browser.newContext({ viewport: { width: 960, height: 540 } })).newPage();
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
// An open patch of ground with only the test's own walls; the player faces -Z with the crossbow up.
await G(() => {
  const g = window.__gametool;
  g.parked = g.world.colliders.splice(0);
  g.inventory.give('crossbow', 1); g.inventory.give('bolt', 10);
  g.player.spawn(new g.Vector3(0, 0, 8), 0); g.player.thirdPerson = false; g.crossbow.equip();
});
const X0 = 0, Z0 = 8;
async function setup(walls, o = {}) {
  await G(([walls, o]) => {
    const g = window.__gametool, p = g.player;
    g.world.colliders.splice(0, g.world.colliders.length, ...walls);
    p.pos.set(0, 0, 8); p.yaw = 0; p.pitch = 0; p.sneaking = !!o.sneak;
    g.crossbow.setADS(!!o.ads);
  }, [walls, o]);
  await page.waitForTimeout(150);
}
const lean = () => G(() => { const p = window.__gametool.player, c = window.__gametool.camera; const r = new window.__gametool.Vector3(); return { side: +p.lean.side.toFixed(2), up: +p.lean.up.toFixed(2), eye: { x: +p.eyePos.x.toFixed(2), y: +(p.eyePos.y - p.pos.y).toFixed(2) }, cam: { x: +c.position.x.toFixed(2) }, roll: +c.rotation.z.toFixed(3) }; });
const settle = (cond, arg) => page.waitForFunction(cond, arg, { timeout: 30000 }).then(() => true, () => false);
// The sim runs in fixed steps that a slow test machine falls behind on: wait in simulated seconds, not wall time.
const simWait = async (s) => { const t0 = await G(() => window.__gametool.perf.simSeconds); await settle((t) => window.__gametool.perf.simSeconds > t, t0 + s); };

// A wall ahead whose right edge is just past the player's right shoulder.
const wallRight = [{ kind: 'box', minX: X0 - 4, maxX: X0 + 0.2, minZ: Z0 - 1.2, maxZ: Z0 - 0.8 }];
await setup(wallRight, { ads: true });
const r1 = await settle(() => window.__gametool.player.lean.side > 0.95 && window.__gametool.camera.rotation.z < -0.18);
const a = await lean();
check('Aiming at a wall edge leans out to the open (right) side', r1 && a.side > 0.95, JSON.stringify(a));
check('The eyes, aim line and first-person camera move out past the edge', Math.abs(a.eye.x - (X0 + 0.5)) < 0.06 && Math.abs(a.cam.x - a.eye.x) < 0.08, JSON.stringify(a));
check('The view tilts with the lean', a.roll < -0.15, `roll ${a.roll}`);
await G(() => window.__gametool.crossbow.setADS(false));
const r2 = await settle(() => Math.abs(window.__gametool.player.lean.side) < 0.02);
check('Letting go of aim leans back in', r2, JSON.stringify(await lean()));

const wallLeft = [{ kind: 'box', minX: X0 - 0.2, maxX: X0 + 4, minZ: Z0 - 1.2, maxZ: Z0 - 0.8 }];
await setup(wallLeft, { ads: true });
const r3 = await settle(() => window.__gametool.player.lean.side < -0.95);
check('A left edge leans left', r3, JSON.stringify(await lean()));

await setup([], { ads: true });
await simWait(1.2);
const open = await lean();
check('Open ground: no lean', open.side === 0 && open.up === 0, JSON.stringify(open));

const low = [{ kind: 'box', minX: X0 - 3, maxX: X0 + 3, minZ: Z0 - 1.0, maxZ: Z0 - 0.6, top: 1.0 }];
await setup(low, { sneak: true });
await simWait(1.2);
const crouch = await lean();
await G(() => window.__gametool.crossbow.setADS(true));
const r4 = await settle(() => window.__gametool.player.lean.up > 0.95);
const peek = await lean();
check('Crouched behind low cover: aiming rises to peek over it', crouch.up === 0 && crouch.eye.y < 1.3 && r4 && peek.eye.y > 1.6, JSON.stringify([crouch, peek]));
check('Peeking doesn\'t lean sideways', Math.abs(peek.side) < 0.02, JSON.stringify(peek));

await setup(wallRight, { ads: true });
await settle(() => window.__gametool.player.lean.side > 0.95);
await G(() => window.__gametool.player.held.add('back'));
const r5 = await settle(() => Math.abs(window.__gametool.player.lean.side) < 0.05 && window.__gametool.player.hSpeed > 0.5);
await G(() => window.__gametool.player.held.delete('back'));
check('Moving off eases the lean back in', r5, JSON.stringify(await lean()));

await G(() => { const s = window.__gametool.settings; s.autoLean = false; });
await setup(wallRight, { ads: true });
await simWait(1.2);
const off = await lean();
check('Settings > Auto-lean off: no lean', off.side === 0, JSON.stringify(off));
check('The setting is in Options', await G(() => !!document.getElementById('autoLean')));
check('No page errors', errors.length === 0, errors.slice(0, 3).join(' | '));
await browser.close();
const failed = results.filter((x) => !x.ok).length;
console.log(`\n${results.length - failed}/${results.length} passed`);
process.exit(failed ? 1 : 0);
