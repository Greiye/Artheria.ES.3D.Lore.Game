// B57 morphology, PR 4 (Mike 2026-11-06: "phone perf check at 50 NPCs"): fifty assembled people walking round the
// player on a phone-sized screen, against the same scene without them. Budgets: about 4 draw calls a person, a couple
// of geometries a person (shared parts, merged outfits), and frames that still come. The old hand-built figures are
// measured the same way for comparison (printed, not judged).
// Usage: node test/e2e-morph-perf.mjs [path/to/index.html]   (CHROMIUM_PATH as in e2e.mjs)
import { chromium, devices } from 'playwright-core';
import path from 'node:path';

const file = path.resolve(process.argv[2] ?? 'dist/index.html');
const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH || undefined,
  args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'],
});
const results = [];
const check = (id, ok, detail = '') => { results.push({ id, ok }); console.log(`${ok ? 'PASS' : 'FAIL'}  ${id}${detail ? '  — ' + detail : ''}`); };
const { defaultBrowserType: _, ...phone } = devices['iPhone 13'];
const ctx = await browser.newContext({ ...phone, deviceScaleFactor: 1 });
const page = await ctx.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
await page.route(/^https?:/, (r) => r.abort());
await page.goto('file://' + file, { timeout: 180000 });
await page.waitForFunction(() => window.__gametool, null, { timeout: 180000 });
await page.evaluate(() => document.querySelector('#begin').click());
await page.waitForFunction(() => window.__gametool.state === 'play', null, { timeout: 180000 });
await page.waitForTimeout(1500);
const G = (fn, a) => page.evaluate(fn, a);

// Average over n frames: frame time and the main pass's draw calls and triangles.
const sample = (n = 40) => G((n) => new Promise((done) => {
  const r = window.__gametool.renderer, out = { ms: 0, calls: 0, tris: 0 };
  let k = 0, last = performance.now();
  const step = () => {
    const now = performance.now();
    if (k > 4) { out.ms += now - last; out.calls += r.info.render.calls; out.tris += r.info.render.triangles; }
    last = now;
    if (++k < n + 5) requestAnimationFrame(step);
    else done({ ms: +(out.ms / n).toFixed(1), calls: Math.round(out.calls / n), tris: Math.round(out.tris / n), geos: r.info.memory.geometries });
  };
  requestAnimationFrame(step);
}), n);

// Fifty people in a ring 3–9 m round the player, all in view of the overhead camera, walking on the spot.
const crowd = (kind) => G((kind) => {
  const g = window.__gametool, m = g.morph, p = g.player.pos, list = [];
  for (let i = 0; i < 50; i++) {
    const a = (i / 50) * Math.PI * 2, d = 3 + (i % 4) * 2;
    const root = kind === 'old' ? g.figureKit.buildFigure(g.traits.rollTownsfolkLook(7000 + i), 1.6 + (i % 5) * 0.06)
      : m.assemble(m.randomCharacterSpec(7000 + i));
    root.position.set(p.x + Math.sin(a) * d, p.y, p.z + Math.cos(a) * d); root.rotation.y = a;
    g.world.scene.add(root);
    g.puppets.set(`perf:${kind}:${i}`, { root, fig: new g.figureKit.FigureAnim(root.userData.rig) });
    list.push(root);
  }
  window.__perfCrowd = list;
  return list.length;
}, kind);
const clear = (kind) => G((kind) => {
  const g = window.__gametool;
  for (const [i, root] of window.__perfCrowd.entries()) { g.puppets.delete(`perf:${kind}:${i}`); if (kind === 'new') g.morph.disposeCharacter(root); else root.removeFromParent(); }
  window.__perfCrowd = [];
}, kind);

const base = await sample();
const outfits0 = await G(() => window.__gametool.morph.outfitCount());
await crowd('new'); await page.waitForTimeout(600);
const withNew = await sample();
const outfits = await G(() => window.__gametool.morph.outfitCount()) - outfits0;
await clear('new'); await page.waitForTimeout(400);
await crowd('old'); await page.waitForTimeout(600);
const withOld = await sample();
await clear('old');
const perNew = (withNew.calls - base.calls) / 50, perOld = (withOld.calls - base.calls) / 50;
console.log(`      base ${JSON.stringify(base)}\n      +50 assembled ${JSON.stringify(withNew)}  (${perNew.toFixed(1)} calls each)\n      +50 old figures ${JSON.stringify(withOld)}  (${perOld.toFixed(1)} calls each)`);
check('50 assembled people: at most about 4 draw calls each', perNew <= 4.5, `${perNew.toFixed(1)} calls each (old figures: ${perOld.toFixed(1)})`);
check('50 assembled people: a couple of new geometries each (shared parts, merged outfits)', withNew.geos - base.geos <= 50 * 2 + 10 && outfits <= 50, `+${withNew.geos - base.geos} geometries, ${outfits} new outfits`);
check('50 assembled people: triangles stay low-poly', (withNew.tris - base.tris) / 50 < 3000, `${Math.round((withNew.tris - base.tris) / 50)} tris each`);
check('50 assembled people: no slower than 50 of the old figures (with room for noise)', withNew.ms <= withOld.ms * 1.25 + 2, `${withNew.ms} ms vs ${withOld.ms} ms a frame (base ${base.ms})`);
check('No page errors', errors.length === 0, errors.slice(0, 3).join(' | '));
await browser.close();
const failed = results.filter((x) => !x.ok).length;
console.log(`\n${results.length - failed}/${results.length} checks passed`);
process.exit(failed ? 1 : 0);
