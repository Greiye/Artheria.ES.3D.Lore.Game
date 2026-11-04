// Pets PR 1 (Mike 2026-11-04, "Add pets. Have them be able to join the player." + "Go"): the farm dog by the inn.
// Petting it without bread only gets a wag; feeding it bread befriends it and it follows a step behind; told to stay
// it waits; both are saved on the device. Runs on PC and on a phone held sideways.
// Usage: node test/e2e-pets.mjs [path/to/index.html]   (CHROMIUM_PATH as in e2e.mjs)
import { chromium, devices } from 'playwright-core';
import path from 'node:path';

const file = path.resolve(process.argv[2] ?? 'dist/index.html');
const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH || undefined,
  args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'],
});
const results = [];
const check = (id, ok, detail = '') => { results.push({ id, ok }); console.log(`${ok ? 'PASS' : 'FAIL'}  ${id}${detail ? '  — ' + detail : ''}`); };
const begin = async (page) => {
  await page.goto('file://' + file, { timeout: 180000 });
  await page.waitForFunction(() => window.__gametool, null, { timeout: 180000 });
  await page.waitForTimeout(400);
  await page.evaluate(() => document.querySelector('#begin').click());
  await page.waitForFunction(() => window.__gametool.state === 'play', null, { timeout: 180000 });
};
for (const [name, opts] of [['PC', { viewport: { width: 1280, height: 720 } }], ['phone', { ...devices['iPhone 13 landscape'] }]]) {
  const ctx = await browser.newContext(opts);
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  await page.route(/^https?:/, (r) => r.abort());
  await begin(page);
  const G = (fn, a) => page.evaluate(fn, a);
  const dogThing = () => window.__gametool.interactables.find((t) => t.obj === window.__gametool.dog.hit);
  const start = await G(() => { const g = window.__gametool, d = g.dog; let tris = 0; d.root.traverse((o) => { if (o.geometry) tris += o.geometry.index.count / 3; });
    return { at: [+d.pos.x.toFixed(1), +d.pos.z.toFixed(1)], friend: d.friend, tris, inScene: !!g.world.scene.getObjectByName('pet:dog') }; });
  check(`${name}: the dog waits by the inn, a small low-poly model`, start.inScene && !start.friend && start.tris > 50 && start.tris < 400, JSON.stringify(start));
  const pet = await G((f) => { const g = window.__gametool, t = eval(f)(); const v = t.verb(); g.inventory.take('bread', g.inventory.count('bread')); t.act(); return { v, friend: g.dog.friend }; }, dogThing.toString());
  check(`${name}: without bread it only wags (it isn't yours yet)`, !pet.friend && pet.v === 'Pet the dog', JSON.stringify(pet));
  const fed = await G((f) => { const g = window.__gametool, t = eval(f)(); g.inventory.give('bread', 1); const v = t.verb(); t.act(); return { v, friend: g.dog.friend, following: g.dog.following, bread: g.inventory.count('bread') }; }, dogThing.toString());
  check(`${name}: bread befriends it and it joins you`, fed.v === 'Give the dog some bread' && fed.friend && fed.following && fed.bread === 0, JSON.stringify(fed));
  // Step the player 8 m out from the inn door (open ground); the dog should catch up and end near, behind them.
  await G(() => { const g = window.__gametool, ry = g.world.town.doors.inn.rotation.y; g.player.pos.set(g.dog.pos.x + Math.sin(ry) * 8, 0, g.dog.pos.z + Math.cos(ry) * 8); });
  await page.waitForFunction(() => { const g = window.__gametool; return Math.hypot(g.dog.pos.x - g.player.pos.x, g.dog.pos.z - g.player.pos.z) < 2.6; }, null, { timeout: 90000 }).catch(() => {});
  const near = await G(() => { const g = window.__gametool; return +Math.hypot(g.dog.pos.x - g.player.pos.x, g.dog.pos.z - g.player.pos.z).toFixed(2); });
  check(`${name}: it follows you`, near < 2.6, `${near} m`);
  await page.waitForFunction(() => window.__gametool.dog.sitting, null, { timeout: 30000 }).catch(() => {});
  const sits = await G(() => window.__gametool.dog.sitting);
  check(`${name}: it sits when you stand still`, sits);
  const stay = await G((f) => { const g = window.__gametool, t = eval(f)(); const v = t.verb(); t.act(); return { v, following: g.dog.following, at: [g.dog.pos.x, g.dog.pos.z] }; }, dogThing.toString());
  await G(() => { const g = window.__gametool; g.player.pos.set(g.player.pos.x - 8, 0, g.player.pos.z); });
  await page.waitForTimeout(1500);
  const stayed = await G((a) => Math.hypot(window.__gametool.dog.pos.x - a[0], window.__gametool.dog.pos.z - a[1]), stay.at);
  check(`${name}: told to stay, it waits`, stay.v === 'Tell the dog to stay' && !stay.following && stayed < 0.2, JSON.stringify({ ...stay, moved: stayed }));
  // Saved: reload, and it is still your friend, waiting where you left it.
  await page.reload(); await begin(page);
  const after = await G(() => { const d = window.__gametool.dog; return { friend: d.friend, following: d.following, at: [d.pos.x, d.pos.z] }; });
  check(`${name}: saved on the device (friend, waiting where you left it)`, after.friend && !after.following && Math.hypot(after.at[0] - stay.at[0], after.at[1] - stay.at[1]) < 0.1, JSON.stringify(after));
  const call = await G((f) => { const g = window.__gametool, t = eval(f)(); const v = t.verb(); t.act(); return { v, following: g.dog.following }; }, dogThing.toString());
  check(`${name}: call it and it comes again`, call.v === 'Call the dog' && call.following, JSON.stringify(call));
  check(`${name}: no console / page errors`, errors.length === 0, errors.slice(0, 3).join(' | '));
  await ctx.close();
}
await browser.close();
const failed = results.filter((x) => !x.ok).length;
console.log(`\n${results.length - failed}/${results.length} passed`);
process.exit(failed ? 1 : 0);
