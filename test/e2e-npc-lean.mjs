// B42 (Mike 2026-11-04): NPCs use the player's lean (B41). A goblin shooter with you out of sight behind a wall
// edge holds the corner, leans out (upper body tilts), and shoots from the lean; with no edge to lean past it
// keeps moving to find you. Runs a separate goblin pack in a test arena so the dungeon's layout doesn't matter.
// Usage: node test/e2e-npc-lean.mjs [path/to/index.html]   (CHROMIUM_PATH as in e2e.mjs)
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
const run = (wall) => page.evaluate((wall) => {
  const g = window.__gametool;
  const cs = [{ kind: 'box', ...wall }];
  const inside = (x, z) => cs.some((c) => x > c.minX && x < c.maxX && z > c.minZ && z < c.maxZ);
  const player = new g.Vector3(0, 0, -6);
  let hurts = 0;
  const pack = new g.goblins.constructor(g.world.scene, {
    walkable: (x, z) => !inside(x, z), colliders: cs, player, aiming: () => false,
    hurt: () => { hurts++; }, steal: () => 0, loot: () => {}, say: () => {},
  });
  // A ranged goblin that isn't a thief.
  let f = null;
  for (let s = 1; s < 4000 && !f; s++) {
    const v = g.traits.rollGoblin(s), st = g.traits.goblinStats(v);
    if (st.range > 6 && st.behaviour !== 'thief' && st.behaviour !== 'coward' && st.behaviour !== 'mimic' && st.weapon !== 'bomb') f = pack.spawn(v, new g.Vector3(0, 0, 0), Math.PI, true);
  }
  f.alerted = true; f.state = 'chase';
  const start = f.root.position.clone();
  let maxSpine = 0, maxSide = 0, shots = 0;
  const spine = f.root.userData.rig.bones.spine;
  for (let i = 0; i < 160; i++) {
    const before = pack.shots?.length ?? 0;
    pack.update(0.05);
    if ((pack.shots?.length ?? 0) > before) shots++;
    maxSide = Math.max(maxSide, f.lean.side); maxSpine = Math.max(maxSpine, spine.rotation.z);
  }
  const moved = f.root.position.distanceTo(start);
  const out = { behaviour: f.st.behaviour, side: +f.lean.side.toFixed(2), maxSide: +maxSide.toFixed(2), spine: +maxSpine.toFixed(2), shots, hurts, moved: +moved.toFixed(2) };
  pack.clear?.(); g.world.scene.remove(pack.group);
  return out;
}, wall);
// A wall between the goblin and you, its right edge just past the goblin's right shoulder.
const edge = await run({ minX: -4, maxX: 0.2, minZ: -1.2, maxZ: -0.8 });
check('Out of sight at a wall edge, a shooter leans out', edge.maxSide > 0.95, JSON.stringify(edge));
check('Its upper body tilts with the lean', edge.spine > 0.25, JSON.stringify(edge));
check('It holds the corner instead of walking round', edge.moved < 0.3, JSON.stringify(edge));
check('It shoots from the lean', edge.shots > 0, JSON.stringify(edge));
// A wide wall: no edge to lean past, so it moves to find you.
const wide = await run({ minX: -4, maxX: 4, minZ: -1.2, maxZ: -0.8 });
check('No edge to lean past: no lean, and it moves to find you', wide.maxSide < 0.05 && wide.moved > 0.5, JSON.stringify(wide));
check('No page errors', errors.length === 0, errors.slice(0, 3).join(' | '));
await browser.close();
const failed = results.filter((x) => !x.ok).length;
console.log(`\n${results.length - failed}/${results.length} passed`);
process.exit(failed ? 1 : 0);
