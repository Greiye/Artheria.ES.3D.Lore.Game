// Mike 2026-11-06: "When players start the game, they go right into character creation. Then a cinematic plays of
// Natalie talking to the player" (she saw the whole creation; it bothers her a little). Plays once a new hero is made.
// Usage: npm run build && node test/e2e-natalie-creation.mjs [path/to/index.html]
import { chromium } from 'playwright-core';
import path from 'node:path';

const file = path.resolve(process.argv[2] ?? 'dist/index.html');
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const results = [];
const check = (id, ok, detail = '') => { results.push({ id, ok }); console.log(`${ok ? 'PASS' : 'FAIL'}  ${id}${detail ? '  — ' + detail : ''}`); };
const ctx = await browser.newContext({ viewport: { width: 1100, height: 680 } });
await ctx.addInitScript(() => { localStorage.setItem('gametool.firstdaytest', 'off'); });
const page = await ctx.newPage();
const G = (fn, a) => page.evaluate(fn, a);
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
await page.route(/^https?:/, (r) => r.abort());
await page.goto('file://' + file, { timeout: 180000 });
await page.waitForFunction(() => window.__gametool, null, { timeout: 180000 });
await G(() => document.querySelector('#begin').click());
await page.waitForFunction(() => window.__gametool.state === 'play', null, { timeout: 180000 });
await page.waitForTimeout(400);

// A brand-new hero (no profession yet): the creation's Done runs the scene.
const before = await G(() => ({ created: window.__gametool.character.created, active: window.__gametool.firstMeet.active }));
check('a new game has no hero made yet, and no scene running', !before.created && !before.active, JSON.stringify(before));
await G(() => window.__gametool.natalieSawCreation());
await page.waitForTimeout(300);
const mid = await G(() => ({ active: window.__gametool.firstMeet.active, state: window.__gametool.state, lines: window.__gametool.firstMeet.scene?.lines?.length ?? null, first: window.__gametool.firstMeet.scene?.first }));
check('after creation, Natalie\'s scene plays (state held in dialogue)', mid.active && mid.state === 'dialogue' && mid.first === false, JSON.stringify(mid));
const said = await G(() => new Promise((done) => { const f = window.__gametool.firstMeet, seen = new Set(); const t0 = performance.now();
  const tick = () => { if (f.line >= 0) seen.add(f.line); if (f.active && performance.now() - t0 < 90000) setTimeout(tick, 100); else done([...seen]); }; tick(); }));
check('she says her lines in order (the watching, the change, the witch, the bother)', JSON.stringify(said) === '[0,1,2,3]', JSON.stringify(said));
await page.waitForFunction(() => !window.__gametool.firstMeet.active, null, { timeout: 90000 }).catch(() => {});
const after = await G(() => ({ active: window.__gametool.firstMeet.active, state: window.__gametool.state, body: window.__gametool.player.body.visible }));
check('it ends and play resumes', !after.active && after.state === 'play' && after.body, JSON.stringify(after));
check('no page errors', errors.length === 0, errors.join(' | '));
await browser.close();
const passed = results.filter((r) => r.ok).length;
console.log(`\n${passed}/${results.length} checks passed`);
process.exit(passed === results.length ? 0 : 1);
