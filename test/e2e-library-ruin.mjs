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
await G(() => { const pl = window.__gametool.player; pl.pos.set(-8, 0, -38); pl.yaw = pl.bodyYaw = -2.3; pl.pitch = 0.1; pl.thirdPerson = false; });
await page.waitForTimeout(1500);
await page.screenshot({ path: 'test/screenshots/library-ruin.png' });

check('no page errors', errors.length === 0, errors.join(' | '));
await browser.close();
const passed = results.filter((r) => r.ok).length;
console.log(`\n${passed}/${results.length} checks passed`);
process.exit(passed === results.length ? 0 : 1);
