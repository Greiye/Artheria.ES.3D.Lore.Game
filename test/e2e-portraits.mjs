// B30 (Mike 2026-11-01): Ren'Py-style portraits. The speaker's portrait stands on the left of the dialogue box; with no
// art yet it's a drawn placeholder (silhouette, initial, name). Files dropped into assets/portraits/ replace it; a line's
// `mood` picks <speaker>-<mood>.png and falls back to the plain portrait.
// Usage: node test/e2e-portraits.mjs [path/to/index.html]   (CHROMIUM_PATH as in e2e.mjs)
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

for (const [label, vp] of [['desktop', { width: 1280, height: 720 }], ['phone', { width: 844, height: 390 }]]) {
  const ctx = await browser.newContext({ viewport: vp, hasTouch: label === 'phone', isMobile: label === 'phone' });
  await ctx.addInitScript(() => localStorage.setItem('gametool.metnatalie', '1'));   // B50: the first-meeting cinematic has its own suite (e2e-first-meet)
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  await page.route(/^https?:/, (r) => r.abort());
  await page.goto('file://' + file);
  await page.waitForFunction(() => window.__gametool, null, { timeout: 90000 });
  await G(page, () => document.querySelector('#begin').click());
  await page.waitForFunction(() => window.__gametool.state === 'play', null, { timeout: 60000 });

  // Talk to Natalie (what E does when you look at her).
  await G(page, () => window.__gametool.talkToNatalie());
  await page.waitForFunction(() => window.__gametool.state === 'dialogue', null, { timeout: 15000 });
  await page.waitForTimeout(300);
  const p = await G(page, () => {
    const d = document.querySelector('#dialogue'), el = d.querySelector('.d-portrait'), r = el.getBoundingClientRect(), b = d.getBoundingClientRect(), n = d.querySelector('.d-name').getBoundingClientRect();
    return { who: window.__gametool.dialogue.who, file: window.__gametool.dialogue.portrait, ph: el.classList.contains('placeholder'), name: el.querySelector('.d-pname')?.textContent, svg: !!el.querySelector('svg'),
      left: r.left < b.left + 40, above: r.top < b.top, w: Math.round(r.width), h: Math.round(r.height), tagClear: n.left >= r.right };
  });
  check(`${label}: talking to Natalie shows her portrait on the left of the box`, p.who === 'natalie' && p.left && p.above && p.w > 60, JSON.stringify(p));
  check(`${label}: no art yet, so a placeholder card with her name`, p.file === null && p.ph && p.svg && p.name === 'Natalie Bourbon');
  check(`${label}: the portrait is 4:5 and the name tag sits beside it`, Math.abs(p.w / p.h - 0.8) < 0.03 && p.tagClear, JSON.stringify({ w: p.w, h: p.h }));
  await page.screenshot({ path: path.join(shots, `b30-${label}-natalie.png`) });

  // A line with a mood falls back to the plain portrait; another speaker gets their own placeholder.
  const other = await G(page, () => {
    const d = window.__gametool.dialogue;
    d.start({ speaker: 'the Archer', start: 'a', nodes: { a: { text: 'Keep your voice down.', mood: 'worried', end: true } } }, 'archer');
    const el = document.querySelector('#dialogue .d-portrait');
    return { who: d.who, file: d.portrait, name: el.querySelector('.d-pname')?.textContent };
  });
  check(`${label}: another speaker gets their own placeholder; a mood with no file falls back`, other.who === 'archer' && other.file === null && other.name === 'the Archer', JSON.stringify(other));
  check(`${label}: no console / page errors (no missing image requested)`, errors.length === 0, errors.join(' | '));
  await ctx.close();
}

await browser.close();
const passed = results.filter((r) => r.ok).length;
console.log(`\n${passed}/${results.length} checks passed`);
process.exit(passed === results.length ? 0 : 1);
