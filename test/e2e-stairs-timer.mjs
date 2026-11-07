// B51 (Mike 2026-11-06): the first descent is the tutorial: you always come back from it and there's no timer. After
// it, each floor gives you 8 minutes to reach a staircase (down, or back up); a warning at a minute; at zero the dark
// takes you, the same fall as a knock-out.
// Usage: node test/e2e-stairs-timer.mjs [path/to/index.html]   (CHROMIUM_PATH as in e2e.mjs)
import { chromium } from 'playwright-core';
import fs from 'node:fs';
import path from 'node:path';

const file = path.resolve(process.argv[2] ?? 'dist/index.html');
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const results = [];
const check = (id, ok, detail = '') => { results.push({ id, ok }); console.log(`${ok ? 'PASS' : 'FAIL'}  ${id}${detail ? '  — ' + detail : ''}`); };
const ctx = await browser.newContext({ viewport: { width: 1100, height: 680 } });
await ctx.addInitScript(() => {
  if (sessionStorage.getItem('seeded')) return;
  sessionStorage.setItem('seeded', '1');
  localStorage.setItem('gametool.character', JSON.stringify({ name: 'Rowan', motivation: '', secret: '', created: true }));
  localStorage.setItem('gametool.tutorialtest', 'on');
});
const page = await ctx.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
await page.route(/^https?:/, (r) => r.abort());
await page.goto('file://' + file, { timeout: 180000 });
await page.waitForFunction(() => window.__gametool, null, { timeout: 180000 });
await page.evaluate(() => document.querySelector('#begin').click());
await page.waitForFunction(() => window.__gametool.state === 'play', null, { timeout: 180000 });
await page.evaluate(() => window.__gametool.endWake?.());
await page.waitForTimeout(1000);
const G = (fn, a) => page.evaluate(fn, a);
fs.mkdirSync('test/screenshots', { recursive: true });
await G(() => window.__gametool.firstDay.skip());
const down = async () => {
  await G(() => window.__gametool.startDescent());
  await page.waitForFunction(() => { const g = window.__gametool; return g.inDungeon && !g.descendCine.active && g.state === 'play'; }, null, { timeout: 30000, polling: 200 }).catch(() => {});
  await page.waitForTimeout(400);
};
await down();
const t0 = await G(() => { const g = window.__gametool; return { tut: g.descent?.tutorial, left: g.stairsLeft, shown: !document.querySelector('#stairsTimer').classList.contains('hidden'), runs: g.record.runs }; });
check('The first descent is the tutorial: no stairs timer', t0.tut === true && t0.left === undefined && !t0.shown && t0.runs === 1, JSON.stringify(t0));
const ko = await G(() => {
  const g = window.__gametool, tally = JSON.parse(localStorage.getItem('gametool.tally') ?? '[]').length, foe = g.goblins.alive[0];
  g.delveHp = 1; g.goblins.w.hurt(5, foe, 0, null);
  return { inDungeon: g.inDungeon, descent: g.descent, words: g.lastWords.isOpen, tallyBefore: tally, tallyAfter: JSON.parse(localStorage.getItem('gametool.tally') ?? '[]').length, done: g.record.tutorialDone, toast: document.querySelector('#toast').textContent };
});
check('Knocked out on the tutorial run, Natalie hauls you up: no fall, no tally line', !ko.inDungeon && ko.descent === null && !ko.words && ko.tallyAfter === ko.tallyBefore && ko.done === true && /doesn't let you fall/.test(ko.toast), JSON.stringify(ko));
await page.waitForTimeout(800);
await down();
const t1 = await G(() => { const g = window.__gametool, el = document.querySelector('#stairsTimer'); return { tut: !!g.descent?.tutorial, left: g.stairsLeft, shown: !el.classList.contains('hidden'), text: el.textContent }; });
check('The next run has the 8-minute stairs timer, shown on screen', !t1.tut && t1.left > 470 && t1.left <= 480 && t1.shown && /⏳ [78]:\d\d to the stairs/.test(t1.text), JSON.stringify(t1));
await page.waitForTimeout(1500);
const t2 = await G(() => window.__gametool.stairsLeft);
check('It counts down while you play', t2 < t1.left - 0.5, `${t1.left} -> ${t2}`);
await G(() => { window.__gametool.stairsLeft = 61; });
await page.waitForFunction(() => document.querySelector('#stairsTimer').classList.contains('warn'), null, { timeout: 8000, polling: 200 }).catch(() => {});
const w = await G(() => ({ cls: document.querySelector('#stairsTimer').className, toast: document.querySelector('#toast').textContent }));
check('A warning at a minute left', /warn/.test(w.cls) && /A minute left/.test(w.toast), JSON.stringify(w));
await page.screenshot({ path: 'test/screenshots/stairs-timer-warn.png' });
await G(() => { window.__gametool.stairsLeft = 0.4; });
await page.waitForFunction(() => window.__gametool.lastWords.isOpen, null, { timeout: 8000, polling: 200 }).catch(() => {});
const f = await G(() => { const g = window.__gametool; return { words: g.lastWords.isOpen, inDungeon: g.inDungeon, descent: g.descent, text: g.lastWords.el.textContent.slice(0, 160) }; });
check('Out of time: the dark takes you, the same fall as a knock-out', f.words && !f.inDungeon && f.descent === null && /The dark got the last blow in/.test(f.text), JSON.stringify(f));
check('No page errors', errors.length === 0, errors.slice(0, 3).join(' | '));
await browser.close();
const passed = results.filter((r) => r.ok).length;
console.log(`${passed}/${results.length} checks passed`);
process.exit(passed === results.length ? 0 : 1);
