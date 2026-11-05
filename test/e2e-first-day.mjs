// B36 (Mike 2026-11-04): the first-day guided quest. Get up → Scriptorium → Tailor or Smithy → campfire, once per
// profile, skippable from the casebook. Test browsers skip it unless localStorage gametool.firstdaytest = 'on'.
// Usage: node test/e2e-first-day.mjs [path/to/index.html]   (CHROMIUM_PATH as in e2e.mjs)
import { chromium } from 'playwright-core';
import path from 'node:path';

const file = path.resolve(process.argv[2] ?? 'dist/index.html');
const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH || undefined,
  args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'],
});
const results = [];
const check = (id, ok, detail = '') => { results.push({ id, ok }); console.log(`${ok ? 'PASS' : 'FAIL'}  ${id}${detail ? '  — ' + detail : ''}`); };
const errors = [];
async function boot(flag = true, seed = null) {
  const ctx = await browser.newContext({ viewport: { width: 960, height: 540 } });
  await ctx.addInitScript(([flag, seed]) => {
    if (sessionStorage.getItem('booted')) return;
    sessionStorage.setItem('booted', '1');
    if (flag) localStorage.setItem('gametool.firstdaytest', 'on');
    if (seed) for (const [k, v] of Object.entries(seed)) localStorage.setItem(k, v);
  }, [flag, seed]);
  const page = await ctx.newPage();
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  await page.route(/^https?:/, (r) => r.abort());
  await page.goto('file://' + file);
  await page.waitForFunction(() => window.__gametool, null, { timeout: 90000 });
  await page.waitForTimeout(400);
  await page.click('#begin');
  await page.waitForFunction(() => window.__gametool.state === 'play', null, { timeout: 90000 });
  return { ctx, page };
}
const day = (page) => page.evaluate(() => { const f = window.__gametool.firstDay; return { step: f.step, state: f.state, marker: f.marker.visible, hud: !document.getElementById('firstDay').classList.contains('hidden'), text: document.getElementById('firstDay').textContent }; });
const stepIs = (page, s) => page.waitForFunction((s) => window.__gametool.firstDay.step === s, s, { timeout: 30000 }).then(() => true, () => false);

// 1) A new profile walks the whole day.
{
  const { ctx, page } = await boot();
  const up = await stepIs(page, 'read');
  const d1 = await day(page);
  check('New profile: the day starts and "Get up" ticks off', up && d1.state?.step === 1, JSON.stringify(d1));
  const near = await page.evaluate(() => { const g = window.__gametool, m = g.firstDay.marker.position, d = g.world.town.doors.library.position; return Math.hypot(m.x - d.x, m.z - d.z); });
  check('Lore first: the goal card and gold marker point at the Library', d1.hud && d1.marker && /Library/.test(d1.text) && near < 0.5, `${d1.text} · ${near.toFixed(2)}`);
  const line = await page.evaluate(() => window.__gametool.companion.lastLine);
  check('Natalie points the way to the stories', /Library/.test(line), line);
  // The side games wait: the prompt says so, and using it doesn't start the game.
  const gated = await page.evaluate(() => { const g = window.__gametool, it = g.interactables.find((i) => /Spar with Kavik/.test(i.verb())); const v = it.verb(); it.act(); return { v, state: g.state }; });
  check('Side games wait for the first day (spar shows "after your first day" and stays shut)', /after your first day/.test(gated.v) && gated.state === 'play', JSON.stringify(gated));
  await page.evaluate(() => window.__gametool.townAct.library());
  const r = await stepIs(page, 'write');
  await page.evaluate(() => window.__gametool.book.close());
  await page.waitForFunction(() => window.__gametool.state === 'play', null, { timeout: 20000 });
  check('Reading in the Library moves on to the Scriptorium', r && /Scriptorium/.test((await day(page)).text));
  await page.evaluate(() => window.__gametool.townAct.scriptorium());
  const w = await stepIs(page, 'make');
  await page.evaluate(() => window.__gametool.sketchPad.close());
  await page.waitForFunction(() => window.__gametool.state === 'play', null, { timeout: 20000 });
  check('Opening the Scriptorium moves on to Tailor or Smithy', w && /Tailor/.test((await day(page)).text));
  await page.evaluate(() => window.__gametool.openCharacterForge());
  const m = await stepIs(page, 'fire');
  await page.evaluate(() => window.__gametool.characterForge.close());
  await page.waitForFunction(() => window.__gametool.state === 'play', null, { timeout: 20000 });
  check('The Tailor moves on to the campfire, marker at the fire', m && await page.evaluate(() => { const g = window.__gametool, a = g.firstDay.marker.position, b = g.world.stations.campfire.position; return Math.hypot(a.x - b.x, a.z - b.z) < 0.5; }));
  const coins0 = await page.evaluate(() => window.__gametool.purse.crowns);
  await page.evaluate(() => window.__gametool.openCampfire());
  await page.waitForFunction(() => window.__gametool.firstDay.state.done, null, { timeout: 20000 }).catch(() => {});
  const d4 = await day(page);
  const coins1 = await page.evaluate(() => window.__gametool.purse.crowns);
  check('The campfire ends the day: done, marker and card gone, a reward', d4.state.done && !d4.state.skipped && !d4.marker && d4.step === null && (coins0 === null || coins1 > coins0), `${JSON.stringify(d4.state)} coins ${coins0}→${coins1}`);
  const open = await page.evaluate(() => window.__gametool.interactables.find((i) => /Spar with Kavik/.test(i.verb())).verb());
  check('After the first day the side games open', !/after your first day/.test(open), open);
  await page.evaluate(() => window.__gametool.campfire.close());
  await page.reload();
  await page.waitForFunction(() => window.__gametool, null, { timeout: 90000 });
  await page.waitForTimeout(400);
  await page.click('#begin');
  await page.waitForFunction(() => window.__gametool.state === 'play', null, { timeout: 90000 });
  await page.waitForTimeout(1500);
  const again = await day(page);
  check('Runs once per profile: not again after a reload', again.state.done && !again.hud && !again.marker, JSON.stringify(again));
  await ctx.close();
}
// 2) Skip from the casebook.
{
  const { ctx, page } = await boot();
  await stepIs(page, 'read');
  await page.evaluate(() => { const g = window.__gametool; g.casebook.open(); });
  const listed = await page.evaluate(() => document.querySelectorAll('#casebook .fd-steps li').length);
  await page.click('#fdSkip');
  const d = await day(page);
  check('The casebook lists the five steps and Skip ends it', listed === 5 && d.state.done && d.state.skipped && d.step === null, `${listed} ${JSON.stringify(d.state)}`);
  await ctx.close();
}
// 3) An old profile (a save, no first-day key) doesn't get it.
{
  const save = JSON.stringify({ v: 1, at: Date.now(), time: 'day', items: [], pos: [0, 0, 6], yaw: 0 });
  const { ctx, page } = await boot(true, { 'gametool.save': save });
  await page.waitForTimeout(1500);
  const d = await day(page);
  check('A profile that already has a save skips the first day', d.state === null && !d.hud, JSON.stringify(d));
  await ctx.close();
}
check('No page errors', errors.length === 0, errors.slice(0, 3).join(' | '));
await browser.close();
const failed = results.filter((x) => !x.ok).length;
console.log(`\n${results.length - failed}/${results.length} passed`);
process.exit(failed ? 1 : 0);
