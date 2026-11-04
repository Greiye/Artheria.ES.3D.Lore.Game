// B50 (Mike 2026-11-04): the first time you talk to Natalie, a cinematic plays: letterbox bars slide in to 2.39:1 over
// a wide shot, narrow to 1.85:1 as the camera pushes in on her face (with a title card), then open into her dialogue.
// Once per profile, skippable, and straight to the dialogue box on Low power.
// Usage: node test/e2e-first-meet.mjs [path/to/index.html]   (CHROMIUM_PATH as in e2e.mjs)
import { chromium } from 'playwright-core';
import fs from 'node:fs';
import path from 'node:path';

const file = path.resolve(process.argv[2] ?? 'dist/index.html');
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const results = [];
const check = (id, ok, detail = '') => { results.push({ id, ok }); console.log(`${ok ? 'PASS' : 'FAIL'}  ${id}${detail ? '  — ' + detail : ''}`); };
const errors = [];
const open = async (init) => {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 } });
  if (init) await ctx.addInitScript(init);
  const page = await ctx.newPage();
  page.on('pageerror', (e) => errors.push(e.message));
  await page.route(/^https?:/, (r) => r.abort());
  await page.goto('file://' + file, { timeout: 180000 });
  await page.waitForFunction(() => window.__gametool, null, { timeout: 180000 });
  await page.evaluate(() => document.querySelector('#begin').click());
  await page.waitForFunction(() => window.__gametool.state === 'play', null, { timeout: 180000 });
  return page;
};
const bar = (page) => page.evaluate(() => ({ on: document.getElementById('letterbox').classList.contains('on'), h: parseFloat(getComputedStyle(document.querySelector('#letterbox .top')).height) || 0,
  card: document.getElementById('meetCard').classList.contains('on'), t: window.__gametool.firstMeet.t, active: window.__gametool.firstMeet.active,
  dialogue: window.__gametool.dialogue.open, state: window.__gametool.state, shot: !!window.__gametool.rig.currentShot }));
const atT = (page, t) => page.waitForFunction((t) => window.__gametool.firstMeet.t >= t || !window.__gametool.firstMeet.active, t, { timeout: 60000, polling: 50 });

// ---------- the full cinematic ----------
const page = await open();
await page.evaluate(() => window.__gametool.talkToNatalie());
const a = await bar(page);
check('B50 talking to Natalie the first time starts the cinematic (not the dialogue box yet)', a.active && a.on && !a.dialogue && a.state === 'dialogue' && a.shot, JSON.stringify(a));
await atT(page, 1.6);
const wide = await bar(page);
check('B50 the bars slide in to a wide 2.39:1 frame over the wide shot', wide.active && Math.abs(wide.h - (720 - 1280 / 2.39) / 2) < 6, JSON.stringify(wide));
await atT(page, 3.6);
const push = await bar(page);
await page.screenshot({ path: 'test/screenshots/b50-push-in.png' });
check('B50 the bars narrow to a set height (1.85:1) as the camera pushes in, with her name as a title card', push.active && push.h < wide.h - 30 && Math.abs(push.h - (720 - 1280 / 1.85) / 2) < 6 && push.card, JSON.stringify(push));
await page.waitForFunction(() => window.__gametool.dialogue.open, null, { timeout: 60000 });
const end = await bar(page);
check('B50 then the bars open and her dialogue starts as usual', !end.active && !end.on && end.dialogue && end.state === 'dialogue', JSON.stringify(end));
check('B50 the seen flag is saved per profile', await page.evaluate(() => localStorage.getItem('gametool.metnatalie') === '1')
  && !/'metnatalie'/.test(/const SHARED = new Set\(\[([^\]]*)\]/.exec(fs.readFileSync('src/profiles.ts', 'utf8'))?.[1] ?? ''));
await page.reload();
await page.waitForFunction(() => window.__gametool, null, { timeout: 180000 });
await page.evaluate(() => document.querySelector('#begin').click());
await page.waitForFunction(() => window.__gametool.state === 'play', null, { timeout: 180000 });
await page.evaluate(() => window.__gametool.talkToNatalie());
const again = await bar(page);
check('B50 it plays once: the next talk goes straight to the dialogue box', !again.active && again.dialogue, JSON.stringify(again));
await page.context().close();

// ---------- skipping ----------
const p2 = await open();
await p2.evaluate(() => window.__gametool.talkToNatalie());
await atT(p2, 0.8);
await p2.keyboard.press('Space');
await p2.waitForFunction(() => !window.__gametool.firstMeet.active, null, { timeout: 20000 }).catch(() => {});
const sk = await bar(p2);
check('B50 any key skips it, straight into the dialogue', !sk.active && sk.dialogue && sk.t < 6.5, JSON.stringify(sk));
await p2.context().close();

// ---------- Low power ----------
const p3 = await open();
await p3.evaluate(() => { window.__gametool.settings.preset = 'lowpower'; window.__gametool.talkToNatalie(); });
const lp = await bar(p3);
check('B50 on Low power it falls back to the normal dialogue box', !lp.active && lp.dialogue, JSON.stringify(lp));
await p3.context().close();
check('B50 no page errors', errors.length === 0, errors.join(' | '));

await browser.close();
const failed = results.filter((r) => !r.ok).length;
console.log(`\n${results.length - failed}/${results.length} checks passed`);
process.exit(failed ? 1 : 0);
