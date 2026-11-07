// B55 (Mike 2026-11-06, "Do it!"): Tam's coin table beside the Inn. Waits for the first day; a stake in crowns, call
// heads or tails; a right call pays the stake back doubled (fair coin, 1:1, shown on the table); stakes 1 to 20 and
// never more than you carry; the tally is kept.
// Usage: node test/e2e-coinflip.mjs [path/to/index.html]   (CHROMIUM_PATH as in e2e.mjs)
import { chromium } from 'playwright-core';
import fs from 'node:fs';
import path from 'node:path';

const file = path.resolve(process.argv[2] ?? 'dist/index.html');
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const results = [];
const check = (id, ok, detail = '') => { results.push({ id, ok }); console.log(`${ok ? 'PASS' : 'FAIL'}  ${id}${detail ? '  — ' + detail : ''}`); };
const ctx = await browser.newContext({ viewport: { width: 1100, height: 680 } });
await ctx.addInitScript(() => localStorage.setItem('gametool.character', JSON.stringify({ name: 'Rowan', motivation: '', secret: '', created: true })));
const page = await ctx.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
await page.route(/^https?:/, (r) => r.abort());
await page.goto('file://' + file, { timeout: 180000 });
await page.waitForFunction(() => window.__gametool, null, { timeout: 180000 });
await page.evaluate(() => document.querySelector('#begin').click());
await page.waitForFunction(() => window.__gametool.state === 'play', null, { timeout: 180000 });
await page.evaluate(() => window.__gametool.endWake?.());
await page.waitForTimeout(1500);
const G = (fn, a) => page.evaluate(fn, a);
fs.mkdirSync('test/screenshots', { recursive: true });
await G(() => { const g = window.__gametool, t = g.COIN_AT.group, ry = t.rotation.y; g.player.pos.set(t.position.x + Math.sin(ry) * 1.8, t.position.y, t.position.z + Math.cos(ry) * 1.8); g.player.yaw = g.player.bodyYaw = ry; g.player.pitch = -0.2; });
await page.waitForFunction(() => window.__gametool.lookingAtVerb, null, { timeout: 8000, polling: 200 }).catch(() => {});   // a busy machine draws few frames
const s0 = await G(() => { const g = window.__gametool; return { inScene: !!g.world.scene.getObjectByName('coin-table'), verb: g.lookingAtVerb, open: g.firstDay.sideGamesOpen }; });
check("Tam's table stands by the Inn and waits for the first day", s0.inScene && (s0.open ? s0.verb === "Flip a coin at Tam's table" : /after your first day/.test(s0.verb ?? '')), JSON.stringify(s0));
await page.screenshot({ path: 'test/screenshots/coinflip-table.png' });
await G(() => { const g = window.__gametool; g.firstDay.skip(); const n = g.inventory.count('crown'); if (n) g.inventory.take('crown', n); g.inventory.give('crown', 12); g.coinTable.spinMs = 150; });
await page.waitForFunction(() => window.__gametool.lookingAtVerb === "Flip a coin at Tam's table", null, { timeout: 8000, polling: 200 }).catch(() => {});
await page.keyboard.press('KeyE');
await page.waitForFunction(() => window.__gametool.coinTable.isOpen, null, { timeout: 5000 }).catch(() => {});
const s1 = await G(() => { const t = window.__gametool.coinTable, el = t.el; return { open: t.isOpen, odds: el.querySelector('.coin-odds')?.textContent, off: [...el.querySelectorAll('[data-act="stake"]')].filter((b) => b.disabled).map((b) => b.dataset.n) }; });
check('E opens the table with the odds shown', s1.open && /1 in 2/.test(s1.odds) && /1:1/.test(s1.odds) && /1 to 20/.test(s1.odds), JSON.stringify(s1));
check('Stakes above what you carry are off (12 carried: 20 is off)', s1.off.join() === '20', JSON.stringify(s1));
// A win: stake 5, the coin lands heads, call heads.
const flip = async (stake, call, r) => {
  await G(({ stake, r }) => { const t = window.__gametool.coinTable; t.rng = () => r; t.el.querySelector(`[data-act="stake"][data-n="${stake}"]`).click(); }, { stake, r });
  const mid = await G((call) => { const g = window.__gametool; g.coinTable.el.querySelector(`[data-act="${call}"]`).click(); return { crowns: g.inventory.count('crown'), spinning: g.coinTable.spinning }; }, call);
  await page.waitForFunction(() => !window.__gametool.coinTable.spinning, null, { timeout: 5000 });
  return { mid, after: await G(() => { const g = window.__gametool; return { crowns: g.inventory.count('crown'), last: g.coinTable.last, line: g.coinTable.el.querySelector('.coin-line').textContent }; }) };
};
const w = await flip(5, 'heads', 0.2);
check('A right call: the stake goes on the table, then comes back doubled', w.mid.crowns === 7 && w.mid.spinning && w.after.crowns === 17 && w.after.last.won && /pays you 10/.test(w.after.line), JSON.stringify(w));
await page.screenshot({ path: 'test/screenshots/coinflip-win.png' });
const l = await flip(10, 'heads', 0.8);
check('A wrong call: Tam keeps the stake', l.after.crowns === 7 && !l.after.last.won && l.after.last.landed === 'tails' && /keeps your 10/.test(l.after.line), JSON.stringify(l));
const cap = await G(() => { const g = window.__gametool, t = g.coinTable; t.stake = 20; const before = g.inventory.count('crown'); t.flip('heads'); return { before, after: g.inventory.count('crown'), spinning: t.spinning, auto: t.stake }; });
check("Can't stake more than you carry", cap.before === 7 && cap.after === 7 && !cap.spinning, JSON.stringify(cap));
const st = await G(() => JSON.parse(localStorage.getItem('gametool.coinflip')));
check('The tally is kept (2 flips, 1 won, -5 net)', st.flips === 2 && st.won === 1 && st.net === -5, JSON.stringify(st));
await G(() => window.__gametool.coinTable.el.querySelector('[data-act="close"]').click());
await page.waitForTimeout(400);
const s2 = await G(() => ({ open: window.__gametool.coinTable.isOpen, state: window.__gametool.state }));
check('Leaving the table goes back to play', !s2.open && s2.state === 'play', JSON.stringify(s2));
const fair = await G(() => { const t = window.__gametool.coinTable; t.rng = Math.random; let h = 0; for (let i = 0; i < 4000; i++) if (t.rng() < 0.5) h++; return h / 4000; });
check('The coin is fair (about half heads)', Math.abs(fair - 0.5) < 0.04, String(fair));
check('No page errors', errors.length === 0, errors.slice(0, 3).join(' | '));
await browser.close();
const passed = results.filter((r) => r.ok).length;
console.log(`${passed}/${results.length} checks passed`);
process.exit(passed === results.length ? 0 : 1);
