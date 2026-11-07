// B57 morphology, PR 2 (Mike 2026-11-06, option 1): the shared parts. Every slot and id has a procedural placeholder on
// real bones of the shared skeleton, in sensible places, small; the cache builds each part once and one material per colour.
// Usage: node test/e2e-morph-parts.mjs [path/to/index.html]   (CHROMIUM_PATH as in e2e.mjs)
import { chromium } from 'playwright-core';
import path from 'node:path';

const file = path.resolve(process.argv[2] ?? 'dist/index.html');
const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH || undefined,
  args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'],
});
const results = [];
const check = (id, ok, detail = '') => { results.push({ id, ok }); console.log(`${ok ? 'PASS' : 'FAIL'}  ${id}${detail ? '  — ' + detail : ''}`); };
const page = await browser.newPage({ viewport: { width: 800, height: 500 } });
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
await page.route(/^https?:/, (r) => r.abort());
await page.goto('file://' + file, { timeout: 180000 });
await page.waitForFunction(() => window.__gametool?.morph?.PartCache, null, { timeout: 180000 });
const G = (fn, a) => page.evaluate(fn, a);

const all = await G(() => {
  const m = window.__gametool.morph, c = new m.PartCache(), out = [];
  const HEADS = ['hair', 'brows', 'eyes', 'nose', 'mouth', 'beard', 'hat'];
  for (const slot of m.SLOTS) for (const id of m.CATALOG[slot].ids) {
    const ps = c.pieces(slot, id);
    let tris = 0, lo = [9, 9, 9], hi = [-9, -9, -9], badBone = false;
    for (const p of ps) {
      if (!m.RIG[p.bone]) { badBone = true; continue; }
      p.geometry.computeBoundingBox();
      const b = p.geometry.boundingBox, pv = m.RIG[p.bone][1];
      tris += p.geometry.attributes.position.count / 3;
      for (let i = 0; i < 3; i++) { lo[i] = Math.min(lo[i], b.min.getComponent(i) + pv[i]); hi[i] = Math.max(hi[i], b.max.getComponent(i) + pv[i]); }
    }
    const cy = (lo[1] + hi[1]) / 2;
    out.push({ slot, id, n: ps.length, tris, badBone, lo, hi, head: HEADS.includes(slot), cy });
  }
  c.dispose();
  return out;
});
check('Every slot and id has a placeholder', all.length >= 50 && all.every((p) => p.n > 0), `${all.length} parts, empty: ${all.filter((p) => !p.n).map((p) => p.slot + p.id).join(',')}`);
check('Each piece rides a real bone of the shared skeleton', all.every((p) => !p.badBone));
const maxTris = Math.max(...all.map((p) => p.tris));
check('Low-poly: no part over 1000 triangles', maxTris <= 1000, `max ${maxTris}`);
const out = all.filter((p) => p.lo[0] < -0.65 || p.hi[0] > 0.65 || p.lo[1] < -0.02 || p.hi[1] > 2.25 || p.lo[2] < -0.5 || p.hi[2] > 0.5);
check('Every part sits on a 1.75 m figure (inside its box)', out.length === 0, out.map((p) => `${p.slot}${p.id} ${p.lo.map((v) => v.toFixed(2))}..${p.hi.map((v) => v.toFixed(2))}`).join(' | '));
const misplaced = all.filter((p) => p.head ? p.cy < 1.35 : p.slot === 'shoes' ? p.cy > 0.3 : false);
check('Head parts are on the head, shoes on the feet', misplaced.length === 0, misplaced.map((p) => `${p.slot}${p.id} y ${p.cy.toFixed(2)}`).join(', '));

const cache = await G(() => {
  const m = window.__gametool.morph, c = new m.PartCache();
  const a = c.pieces('hair', '03'), b = c.pieces('hair', '03');
  const ma = c.material('#aa3322'), mb = c.material('#AA3322');
  const r = { samePart: a === b && a[0].geometry === b[0].geometry, sameMat: ma === mb, empty: c.pieces('hat', '').length, unknown: c.pieces('hat', '77').length, s: c.stats };
  c.dispose();
  r.after = c.stats;
  return r;
});
check('Cache: a part is built once and shared', cache.samePart);
check('Cache: one material per colour', cache.sameMat && cache.s.materials === 1, JSON.stringify(cache.s));
check('An empty slot or an unknown id has no pieces', cache.empty === 0 && cache.unknown === 0);
check('Dispose empties the cache', cache.after.parts === 0 && cache.after.materials === 0, JSON.stringify(cache.after));

const crowd = await G(() => {
  const m = window.__gametool.morph, c = new m.PartCache(), colours = new Set();
  let wanted = 0;
  for (let i = 1; i <= 50; i++) {
    const s = m.randomCharacterSpec(i * 104729);
    for (const slot of m.SLOTS) { const p = s.parts[slot]; if (!p.id) continue; wanted++; c.pieces(slot, p.id); c.material(p.color); colours.add(p.color.toUpperCase()); }
  }
  const total = m.SLOTS.reduce((n, s) => n + m.CATALOG[s].ids.length, 0), st = c.stats;
  c.dispose();
  return { wanted, total, ...st, colours: colours.size };
});
check('50 random people share parts: at most one build per catalog id', crowd.parts <= crowd.total && crowd.parts < crowd.wanted / 5, JSON.stringify(crowd));
check('50 random people: one material per distinct colour', crowd.materials === crowd.colours, JSON.stringify(crowd));

check('No page errors', errors.length === 0, errors.slice(0, 3).join(' | '));
await browser.close();
const failed = results.filter((x) => !x.ok).length;
console.log(`\n${results.length - failed}/${results.length} checks passed`);
process.exit(failed ? 1 : 0);
