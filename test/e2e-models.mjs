// Checks for the .glb model loader (owner request 2026-10-21): a model in models/<slot>.glb replaces that
// slot's placeholder; a missing or broken file leaves the placeholder and raises no error.
// Usage: npm run build && node test/e2e-models.mjs [path/to/index.html]
// Chromium blocks file:// fetches by default, so this test allows them; on GitHub Pages models load over https.
import { chromium } from 'playwright-core';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const file = path.resolve(process.argv[2] ?? 'dist/index.html');
const dir = path.join(path.dirname(file), 'models');
fs.mkdirSync(dir, { recursive: true });
const made = [path.join(dir, 'natalie.glb'), path.join(dir, 'player.glb'), path.join(dir, 'stagecoach.glb')];
execFileSync(process.execPath, ['test/fixtures/make-box-glb.mjs', made[0]]);
fs.copyFileSync(made[0], made[1]);
fs.writeFileSync(made[2], 'not a glb');   // broken file: must fall back

const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH || undefined,
  args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--allow-file-access-from-files'],
});
const results = [];
const check = (id, ok, detail = '') => { results.push({ id, ok }); console.log(`${ok ? 'PASS' : 'FAIL'}  ${id}${detail ? '  — ' + detail : ''}`); };
try {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  await ctx.addInitScript(() => localStorage.setItem('gametool.character', JSON.stringify({ name: 'Test', motivation: '', secret: '', created: true })));
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) errors.push(m.text()); });
  await page.goto('file://' + file + '?models=natalie,player,stagecoach');
  await page.waitForFunction(() => window.__gametool);
  await page.evaluate(() => window.__gametool.modelsReady);
  const r = await page.evaluate(() => {
    const g = window.__gametool, s = g.world.standees;
    const nat = g.loadedModels.get('natalie');
    let h = 0;
    if (nat) { nat.updateWorldMatrix(true, true); const b = new g.Box3().setFromObject(nat); h = b.max.y - b.min.y; }
    return {
      loaded: [...g.loadedModels.keys()].sort(), failed: [...g.failedModels.keys()].sort(),
      natalieHidden: !s.natalie.visible, natalieH: h,
      heroShown: s.hero.visible, stagecoachShown: s.stagecoach.visible,
      nubHidden: !g.player.body.children[1].visible,
    };
  });
  check('A .glb in models/ replaces its placeholder (natalie, player)', r.loaded.join() === 'natalie,player' && r.natalieHidden && r.nubHidden, JSON.stringify(r.loaded));
  check('The model is scaled to the slot height', Math.abs(r.natalieH - 1.75) < 0.01, r.natalieH.toFixed(3) + ' m');
  check('Missing model (hero) keeps the placeholder, without requesting it', r.heroShown && !r.failed.includes('hero'));
  check('Broken model (stagecoach) keeps the placeholder', r.stagecoachShown && r.failed.includes('stagecoach'));
  check('No page errors from model loading', errors.length === 0, errors.join(' | '));
} finally {
  await browser.close();
  made.forEach((f) => fs.rmSync(f, { force: true }));
}
const failed = results.filter((r) => !r.ok).length;
console.log(`\n${results.length - failed}/${results.length} checks passed`);
process.exit(failed ? 1 : 0);
