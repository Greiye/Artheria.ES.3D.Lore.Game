// UX pass (Mike 2026-10-31), part 3, flow: Continue / New game on the main menu, auto-save at doors and the
// campfire, the pause menu as a journal with the casebook, map and bag as its last pages, and the first-minute coach
// that teaches the controls by doing.
// Usage: node test/e2e-ux-flow.mjs [path/to/index.html]   (CHROMIUM_PATH as in e2e.mjs)
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
const until = (page, fn, arg, timeout = 15000) => page.waitForFunction(fn, arg, { timeout, polling: 100 }).then(() => true, () => false);
const frames = (page, n = 3) => G(page, (n) => new Promise((r) => { const f = () => (--n <= 0 ? r() : requestAnimationFrame(f)); requestAnimationFrame(f); }), n);

async function open(init) {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 } });
  if (init) await ctx.addInitScript(init);
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  await page.route(/^https?:/, (r) => r.abort());
  await page.goto('file://' + file);
  await page.waitForFunction(() => window.__gametool);
  await page.waitForTimeout(400);
  return { ctx, page, errors };
}

{
  const { ctx, page, errors } = await open();
  const fresh = await G(page, () => ({ label: document.getElementById('begin').textContent, ng: !document.getElementById('newGame').classList.contains('hidden') }));
  check('No save yet: the menu says Begin, no New game', fresh.label === 'Begin' && !fresh.ng, JSON.stringify(fresh));
  await page.click('#begin');
  await page.waitForFunction(() => window.__gametool.state === 'play');
  await page.waitForTimeout(300);

  // Auto-save at a door and at the campfire.
  await G(page, () => window.__gametool.townAct.scriptorium());
  await page.waitForTimeout(200);
  const door = await G(page, () => ({ n: window.__gametool.autosaves, save: !!localStorage.getItem('gametool.save'), mark: document.getElementById('autosaved').classList.contains('on') }));
  check('Going through a door auto-saves (a quill mark shows "Saved")', door.n === 1 && door.save && door.mark, JSON.stringify(door));
  await page.screenshot({ path: path.join(shots, 'ux-7-autosave.png') });
  await page.keyboard.press('Escape'); await page.waitForTimeout(200);
  if (await G(page, () => window.__gametool.state) !== 'play') { await page.keyboard.press('Escape'); await page.waitForTimeout(200); }
  await G(page, () => window.__gametool.openCampfire());
  await page.waitForTimeout(200);
  check('Sitting at the campfire auto-saves', await G(page, () => window.__gametool.autosaves) === 2);
  await G(page, () => window.__gametool.campfire.close());
  await page.waitForTimeout(300);

  // The pause menu is a journal.
  await G(page, () => { const g = window.__gametool; if (g.state !== 'play') return; document.exitPointerLock(); });
  await page.waitForTimeout(150);
  if (await G(page, () => window.__gametool.state) === 'play') await page.keyboard.press('Escape');
  await until(page, () => window.__gametool.state === 'pause', null, 3000);
  const j = await G(page, () => ({ h: document.querySelector('#pause h1').textContent, pages: [...document.querySelectorAll('#pause .pause-page')].map((b) => b.textContent) }));
  check('The pause menu is the journal, ending with its pages: Casebook, Map, Bag, Phrasebook (B16), Who you are (B25)', j.h === 'Journal' && j.pages.join() === 'Casebook,Map,Bag,Phrasebook,Who you are', JSON.stringify(j));
  await page.screenshot({ path: path.join(shots, 'ux-8-journal.png') });
  await page.click('#pgCasebook');
  check('Journal → Casebook opens it', await until(page, () => window.__gametool.casebook.isOpen, null, 3000));
  await G(page, () => window.__gametool.casebook.close());
  await page.waitForTimeout(200);

  // Continue / New game.
  await G(page, () => window.__gametool.earn(9, 'test'));
  await G(page, () => window.__gametool.quitToMenu());
  await until(page, () => window.__gametool.state === 'title', null, 3000);
  const cont = await G(page, () => ({ label: document.getElementById('begin').textContent, ng: !document.getElementById('newGame').classList.contains('hidden') }));
  check('With a save: the menu says Continue, with New game under it', cont.label === 'Continue' && cont.ng, JSON.stringify(cont));
  await page.waitForTimeout(1200);
  await page.screenshot({ path: path.join(shots, 'ux-9-continue.png') });
  await page.click('#newGame');
  const armed = await G(page, () => ({ t: document.getElementById('newGame').textContent, s: window.__gametool.state }));
  await page.click('#newGame');
  await until(page, () => window.__gametool.state === 'play', null, 4000);
  const fresh2 = await G(page, () => { const g = window.__gametool, s = g.world.spawn.pos; return { d: Math.hypot(g.player.pos.x - s.x, g.player.pos.z - s.z), crowns: g.inventory.count('crown'), save: !!localStorage.getItem('gametool.save') }; });
  check('New game asks twice, then starts over (spawn, empty purse, no save)', /again/.test(armed.t) && armed.s === 'title' && fresh2.d < 1 && fresh2.crowns === 0 && !fresh2.save, JSON.stringify({ armed, fresh2 }));
  check('Flow: no console/page errors', errors.length === 0, errors.join(' | '));
  await ctx.close();
}

// The first-minute coach.
{
  const { ctx, page, errors } = await open(() => localStorage.setItem('gametool.coachtest', 'on'));
  await page.click('#begin');
  await page.waitForFunction(() => window.__gametool.state === 'play');
  await page.waitForTimeout(300);
  const c = () => G(page, () => { const e = document.getElementById('coach'); return e.classList.contains('hidden') ? '' : e.textContent; });
  const first = await c();
  await page.screenshot({ path: path.join(shots, 'ux-10-coach.png') });
  await G(page, () => { const p = window.__gametool.player; p.pos.x += 4; p.update(0); });
  await frames(page, 4);
  const second = await c();
  await G(page, () => { const p = window.__gametool.player; p.yaw += 1.4; });
  await frames(page, 4);
  const third = await c();
  check('Coach: "walk" first; once you walk, "look"; once you look, quiet until something is in reach', /walk/.test(first) && /look/.test(second) && third === '', JSON.stringify([first, second, third]));
  await G(page, (back) => {
    const g = window.__gametool, cc = new g.Vector3(); g.world.town.doors.library.getWorldPosition(cc);
    const out = new g.Vector3(-cc.x, 0, -cc.z).normalize(), p = g.player;
    p.pos.set(cc.x + out.x * back, 0, cc.z + out.z * back);
    const d = cc.clone().sub(new g.Vector3(p.pos.x, 1.7, p.pos.z));
    p.yaw = Math.atan2(-d.x, -d.z); p.pitch = Math.atan2(d.y, Math.hypot(d.x, d.z)); p.update(0); p.syncNow();
  }, 1.3);
  await frames(page, 4);
  const fourth = await c();
  await page.keyboard.press('KeyE');
  await page.waitForTimeout(300);
  check('Coach: at a door it says "E to talk, read or open", and is done once you do', /^E to/.test(fourth) && await G(page, () => window.__gametool.coach.current === null && JSON.parse(localStorage.getItem('gametool.coached')).length === 3), fourth);
  check('Coach: no console/page errors', errors.length === 0, errors.join(' | '));
  await ctx.close();
}

await browser.close();
const failed = results.filter((r) => !r.ok).length;
console.log(`\n${results.length - failed}/${results.length} checks passed`);
process.exit(failed ? 1 : 0);
