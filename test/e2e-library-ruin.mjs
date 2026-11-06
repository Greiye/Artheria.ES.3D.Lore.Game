// Mike 2026-11-06 (Graphics thread, "All"): the Ruined Library looks its age: mostly ruin and goblin life, a little
// magic. Checks that each pass is there, stays cheap (one merged mesh per kind) and keeps clear of what you use.
// Usage: npm run build && node test/e2e-library-ruin.mjs [path/to/index.html]
import { chromium } from 'playwright-core';
import path from 'node:path';

const file = path.resolve(process.argv[2] ?? 'dist/index.html');
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const results = [];
const check = (id, ok, detail = '') => { results.push({ id, ok }); console.log(`${ok ? 'PASS' : 'FAIL'}  ${id}${detail ? '  — ' + detail : ''}`); };
const ctx = await browser.newContext({ viewport: { width: 1100, height: 680 } });
await ctx.addInitScript(() => localStorage.setItem('gametool.character', JSON.stringify({ name: 'Ava', motivation: '', secret: '', created: true, profession: 'ranger' })));
const page = await ctx.newPage();
const G = (fn, a) => page.evaluate(fn, a);
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
await page.route(/^https?:/, (r) => r.abort());
await page.goto('file://' + file, { timeout: 180000 });
await page.waitForFunction(() => window.__gametool, null, { timeout: 180000 });
await G(() => document.querySelector('#begin').click());
await page.waitForFunction(() => window.__gametool.state === 'play', null, { timeout: 180000 });
await G(() => window.__gametool.endWake?.());

// 1 · the ruin pass
const r1 = await G(() => { const g = window.__gametool, m = g.library.group.getObjectByName('library-ruin');
  return { mesh: !!m, merged: g.library.group.children.filter((c) => c.name === 'library-ruin').length, pieces: g.ruin.pieces, tris: m ? m.geometry.attributes.position.count / 3 : 0 }; });
check('1 · ruin: one merged mesh inside the hall, a few hundred pieces', r1.mesh && r1.merged === 1 && r1.pieces > 200 && r1.tris < 40000, JSON.stringify(r1));
const clear = await G(() => { const g = window.__gametool, bad = [];
  for (const t of g.ruinFloor.taken) for (const i of g.interactables) { const p = i.obj.getWorldPosition(new g.Vector3()); if (Math.hypot(p.x - t.x, p.z - t.z) < t.r) bad.push(i.verb()); }
  return bad; });
check('1 · nothing you use is buried under the rubble', clear.length === 0, clear.join(', '));
// The aisle walks clean from the door to the altar.
const aisle = await G(() => { const g = window.__gametool, p = g.player; let blocked = 0;
  for (let z = -19.5; z > -38; z -= 0.5) { p.pos.set(1.3, 0, z); p.update(0.016); if (Math.abs(p.pos.x - 1.3) > 0.3 || Math.abs(p.pos.z - z) > 0.3) blocked++; }
  return blocked; });
check('1 · a walk down the aisle beside the tables is clear, door to altar', aisle === 0, String(aisle));
// 2 · books on every wall
const r2 = await G(() => { const g = window.__gametool, w = g.wallBooks; return { cases: w.cases, rows: w.rows, tris: w.mesh.geometry.attributes.position.count / 3, inHall: w.mesh.parent === g.library.group, map: !!w.mesh.material.map, cases3d: !!g.library.group.getObjectByName('library-bookcases') }; });
check('2 · tall bookcases on all four walls, hundreds of shelves of books in one textured mesh', r2.cases >= 20 && r2.rows >= 150 && r2.tris < 2000 && r2.inHall && r2.map && r2.cases3d, JSON.stringify(r2));
check('2 · the lore shelves are untouched (every red book still on its shelf)', await G(() => [...window.__gametool.library.redBooks.values()].every((b) => b.parent === window.__gametool.library.group)));
await G(() => { const pl = window.__gametool.player; pl.pos.set(-5, 0, -26); pl.yaw = pl.bodyYaw = -1.4; pl.pitch = 0.45; pl.thirdPerson = false; });
await page.waitForTimeout(1500);
await page.screenshot({ path: 'test/screenshots/library-books.png' });
// 3 · goblin signs
const r3 = await G(() => { const g = window.__gametool, m = g.library.group.getObjectByName('library-goblin-signs'); return { mesh: !!m, pieces: g.goblinSigns.pieces, spots: g.goblinSigns.spots.length }; });
check('3 · goblins moved in: bedrolls, bones, a cart wheel and chalk tallies (one mesh)', r3.mesh && r3.pieces > 150 && r3.spots >= 8, JSON.stringify(r3));
// 4 · goblin life
const r4 = await G(() => { const g = window.__gametool, m = g.library.group.getObjectByName('library-goblin-life'), gl = g.library.group.getObjectByName('library-goblin-glow');
  return { mesh: !!m, glow: !!gl && gl.material.type === 'MeshBasicMaterial', pieces: g.goblinLife.pieces, spots: g.goblinLife.spots.length, glowN: g.goblinLife.glow, throne: g.goblinLife.throne }; });
check('4 · goblin life: fires, loot, hammocks, drawings, a book throne, a rope bridge, pages, chandeliers, a smashed rose window, rugs, dens', r4.mesh && r4.glow && r4.pieces > 400 && r4.spots >= 6 && r4.glowN > 20 && !!r4.throne, JSON.stringify(r4));
const still = await G(() => { const g = window.__gametool, bad = [];
  for (const t of [...g.goblinSigns.spots, ...g.goblinLife.spots]) for (const i of g.interactables) { const p = i.obj.getWorldPosition(new g.Vector3()); if (Math.hypot(p.x - t.x, p.z - t.z) < t.r) bad.push(i.verb()); }
  return bad; });
check('4 · still nothing you use is crowded out', still.length === 0, still.join(', '));
await G(() => { const pl = window.__gametool.player; pl.pos.set(0, 0, -30); pl.yaw = pl.bodyYaw = Math.PI; pl.pitch = 0.2; pl.thirdPerson = false; });
await page.waitForTimeout(1500);
await page.screenshot({ path: 'test/screenshots/library-goblin-life.png' });
// 5 · the trapdoor is now stone stairs down
const r5 = await G(() => { const g = window.__gametool, S = g.STAIRS, i = g.interactables.find((x) => x.verb() === 'Go down the stairs');
  const p = g.player; p.pos.set(S.x, 0, S.top + 1.2); p.yaw = p.bodyYaw = 0; p.held.add('forward'); for (let k = 0; k < 90; k++) p.update(1 / 30); p.held.delete('forward');
  const pushed = p.pos.z > S.top - 0.05;   // walked forward 15 m worth, stopped at the edge
  return { verb: !!i, steps: S.steps, mesh: !!g.library.group.getObjectByName('library-stairwell'), pushed, noHatch: !g.world.scene.getObjectByName('trapdoor') }; });
check('5 · stone stairs go down where the trapdoor was ("Go down the stairs"), and you cannot fall in', r5.verb && r5.mesh && r5.pushed && r5.noHatch, JSON.stringify(r5));
await G(() => { const g = window.__gametool, S = g.STAIRS, pl = g.player; pl.pos.set(S.x, 0, S.top + 1.4); pl.yaw = pl.bodyYaw = 0; pl.pitch = -0.6; pl.thirdPerson = false; });
await page.waitForTimeout(1500);
await page.screenshot({ path: 'test/screenshots/library-stairs.png' });
// 6 · 2D quad ivy and plants
const r6 = await G(() => { const g = window.__gametool, inside = g.library.group.children.filter((c) => c.name.startsWith('library-plants-')), outside = g.world.scene.children.filter((c) => c.name.startsWith('library-plants-outside'));
  return { quads: g.quadPlants, inside: inside.length, outside: outside.length, cut: inside.every((m) => m.material.alphaTest > 0 && m.material.side === 2) }; });
check('6 · cut-out ivy and plants: curtains, vines through the holes, tufts in the cracks, a fringe outside (3 + 3 meshes)', r6.quads.inside > 250 && r6.quads.outside > 100 && r6.inside === 3 && r6.outside === 3 && r6.cut, JSON.stringify(r6));
// 7 · flooding
const r7 = await G(() => { const g = window.__gametool, f = g.flood, wet = g.library.group.getObjectByName('library-flood-wet');
  // You can wade: walk across the biggest pool and nothing stops you.
  const P0 = f.pools[0], p = g.player; p.pos.set(P0.x + P0.r + 0.6, 0, P0.z); p.yaw = p.bodyYaw = Math.PI / 2; p.held.add('forward'); for (let k = 0; k < 40; k++) p.update(1 / 30); p.held.delete('forward');
  // Nothing from the goblins' camp sits in the water (fires, beds).
  const wetCamp = [...g.goblinLife.spots, ...g.goblinSigns.spots].filter((s) => f.pools.some((q) => Math.hypot(s.x - q.x, s.z - q.z) < q.r * 0.7)).length;
  return { pools: f.pools.length, water: f.water.parent === g.library.group && f.water.material.transparent, wet: !!wet, waded: p.pos.x < P0.x, wetCamp }; });
check('7 · shallow flood: pools of still water with wet edges and half-sunk bookcases; you can wade; the camp stays dry', r7.pools >= 3 && r7.water && r7.wet && r7.waded && r7.wetCamp === 0, JSON.stringify(r7));
// 8 · floating broken stone outside
const r8a = await G(() => window.__gametool.floating.stones.map((s) => s.mesh.position.y + s.mesh.rotation.y));
await page.waitForTimeout(800);
const r8 = await G((before) => { const g = window.__gametool, f = g.floating;
  return { n: f.stones.length, outside: f.stones.every((s) => s.mesh.parent === g.world.scene && s.base.y > 8), shadows: f.shadows.parent === g.world.scene,
    moved: f.stones.filter((s, i) => Math.abs(s.mesh.position.y + s.mesh.rotation.y - before[i]) > 1e-4).length }; }, r8a);
check('8 · floating broken stone (wall, arch, stair, column) above the library, drifting slowly, with soft shadows', r8.n === 7 && r8.outside && r8.shadows && r8.moved === 7, JSON.stringify(r8));
await G(() => { const pl = window.__gametool.player; pl.pos.set(-8, 0, -38); pl.yaw = pl.bodyYaw = -2.3; pl.pitch = 0.1; pl.thirdPerson = false; });
await page.waitForTimeout(1500);
await page.screenshot({ path: 'test/screenshots/library-ruin.png' });

check('no page errors', errors.length === 0, errors.join(' | '));
await browser.close();
const passed = results.filter((r) => r.ok).length;
console.log(`\n${passed}/${results.length} checks passed`);
process.exit(passed === results.length ? 0 : 1);
