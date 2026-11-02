// B27 + B29 (Mike 2026-11-01): station panels sit on the right, are compact, and show everything without scrolling
// (desktop 1280x720 and a phone held sideways); panels split into sections become tabs; the camera slides the station
// into the space on the left. Reading pages (the Skills book, Recipe book) may scroll; they are reported, not failed.
// Usage: node test/e2e-panels.mjs [path/to/index.html]   (CHROMIUM_PATH as in e2e.mjs)
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

// Each scenario opens a station (and maybe steps into it); `reading` pages are allowed to scroll.
const SCENARIOS = [
  ['character forge', 'g.openCharacterForge()', 'tabs'],
  ['weapon forge', 'g.openWeaponForge()', 'tabs'],
  ['campfire', 'g.openCampfire()', 'secs'],
  ['camp kitchen', 'g.openCampfire(); g.campfire.openSection("cook"); q("#cfCook").click(); q("#ckAck")?.click(); q("#cook [data-recipe]").click()'],
  ['camp kitchen: the fire', 'g.openCampfire(); g.campfire.openSection("cook"); q("#cfCook").click(); q("#ckAck")?.click(); q("#cook [data-recipe]").click(); for (let i = 0; i < 9; i++) q(`#cook [data-step="${g.cook.placed}"]`)?.click()'],
  ['dojo', 'g.openDojo()'],
  ['dojo: a drill', 'g.openDojo(); q("#djAck")?.click()'],
  ['caravan', 'g.openCaravan(g.caravanFolk[0].id)'],
  ['skills table', 'g.openSkills()'],
  ['skills table: a card', 'g.openSkills(); q("#skAck")?.click(); q("[data-skill]").click()'],
  ['grindstone', 'g.openGear()'],
  ['general store', 'g.openShop()'],
  ['sketchbook', 'g.openSketchbook()'],
  ['phrasebook', 'g.openPhrasebook()'],
  ['skills book', 'g.openSkillsBook()', 'reading'],
  ['recipe book', 'g.openRecipeBook()', 'reading'],
];

async function run(label, opts) {
  const ctx = await browser.newContext(opts);
  await ctx.addInitScript(() => localStorage.setItem('gametool.character', JSON.stringify({ name: 'Test', motivation: '', secret: '', created: true })));
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  await page.route(/^https?:/, (r) => r.abort());
  await page.goto('file://' + file);
  await page.waitForFunction(() => window.__gametool, null, { timeout: 90000 });
  await G(page, () => document.querySelector('#begin').click());
  await page.waitForFunction(() => window.__gametool.state === 'play', null, { timeout: 60000 });
  const W = opts.viewport.width;
  const over = [], reading = [];
  for (const [name, how, kind] of SCENARIOS) {
    const r = await G(page, async ({ how, kind }) => {
      const g = window.__gametool, q = (s) => document.querySelector(s);
      // eslint-disable-next-line no-new-func
      new Function('g', 'q', how)(g, q);
      await new Promise((res) => setTimeout(res, 120));
      const panel = () => [...document.querySelectorAll('.forge-panel')].find((p) => p.getClientRects().length);
      const m = (tag) => { const p = panel(); if (!p) return { tag, none: true }; const b = p.getBoundingClientRect(); return { tag, over: p.scrollHeight - p.clientHeight, left: Math.round(b.left), right: Math.round(b.right), w: Math.round(b.width) }; };
      const out = [m('')];
      if (kind === 'tabs') {
        const n = panel()?.querySelectorAll('.fp-tab').length ?? 0;
        for (let i = 0; i < n; i++) { panel().querySelectorAll('.fp-tab')[i].click(); await new Promise((res) => setTimeout(res, 30)); out.push(m(panel().querySelectorAll('.fp-tab')[i].textContent)); }
        panel()?.querySelectorAll('.fp-tab')[0]?.click();
      }
      if (kind === 'secs') {
        for (const b of [...document.querySelectorAll('#campfire [data-sec]')].map((x) => x.dataset.sec)) { g.campfire.openSection(b); await new Promise((res) => setTimeout(res, 30)); out.push(m(b)); }
        g.campfire.openSection(null);
      }
      return { state: g.state, tabs: panel()?.querySelectorAll('.fp-tab').length ?? 0, out };
    }, { how, kind });
    for (const o of r.out) {
      if (o.none) { check(`${label}: ${name} opens a panel`, false); continue; }
      const id = `${name}${o.tag ? ' › ' + o.tag : ''}`;
      if (kind === 'reading') { if (o.over > 1) reading.push(`${id} (+${o.over}px)`); }
      else if (o.over > 1) over.push(`${id} (+${o.over}px)`);
    }
    if (name === 'character forge') {
      check(`${label}: the character forge is split into tabs (Species, Body, Face, Hair, Outfit, Extras, Story)`, r.tabs === 7, String(r.tabs));
      const side = r.out[0];
      check(`${label}: panels sit on the right edge`, W <= 600 || (side.right === W && side.left > W / 2), JSON.stringify(side));
      await page.waitForFunction((w) => Math.abs((window.__gametool.camera.view?.enabled ? window.__gametool.camera.view.offsetX : 0) - w) <= 2, W <= 600 ? 0 : side.w, { timeout: 15000 }).catch(() => {});
      const shift = await G(page, () => { const g = window.__gametool; return g.camera.view?.enabled ? Math.round(g.camera.view.offsetX) : 0; });
      check(`${label}: the camera slides the station left of the panel`, W <= 600 ? shift === 0 : Math.abs(shift - side.w) <= 2, `offset ${shift}, panel ${side.w}`);
      await page.screenshot({ path: path.join(shots, `b27-${label}-forge.png`) });
    }
    if (name === 'general store') await page.screenshot({ path: path.join(shots, `b27-${label}-shop.png`) });
    if (name === 'dojo: a drill') await page.screenshot({ path: path.join(shots, `b27-${label}-dojo.png`) });
    await G(page, () => { const g = window.__gametool; g.cook.close?.(); g.campfire.close?.(); window.dispatchEvent(new KeyboardEvent('keydown', { code: 'Escape', key: 'Escape' })); });
    await page.waitForTimeout(150);
    await G(page, async () => { const g = window.__gametool; for (let i = 0; i < 30 && g.state !== 'play'; i++) { if (g.state === 'forge') window.dispatchEvent(new KeyboardEvent('keydown', { code: 'Escape', key: 'Escape' })); if (g.state === 'pause') document.querySelector('#resume')?.click(); await new Promise((r) => setTimeout(r, 120)); } });
  }
  check(`${label}: every station panel fits without scrolling`, over.length === 0, over.join(', '));
  if (reading.length) console.log(`      (${label} reading pages that scroll: ${reading.join(', ')})`);
  const back = await page.waitForFunction(() => window.__gametool.state === 'play' && !window.__gametool.camera.view?.enabled, null, { timeout: 15000 }).then(() => true, () => false);
  check(`${label}: back in play, the camera is centred again`, back);
  check(`${label}: no console / page errors`, errors.length === 0, errors.join(' | '));
  await ctx.close();
}

await run('desktop', { viewport: { width: 1280, height: 720 } });
await run('phone', { viewport: { width: 844, height: 390 }, hasTouch: true, isMobile: true, deviceScaleFactor: 1 });

await browser.close();
const passed = results.filter((r) => r.ok).length;
console.log(`\n${passed}/${results.length} checks passed`);
process.exit(passed === results.length ? 0 : 1);
