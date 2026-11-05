// B37 (Mike 2026-11-04): Extras → Portfolio lists everything this profile made; "Export portfolio" saves one
// self-contained .html; each piece saves as a framed postcard PNG. Nothing leaves the device.
// Usage: node test/e2e-portfolio.mjs [path/to/index.html]   (CHROMIUM_PATH as in e2e.mjs)
import { chromium } from 'playwright-core';
import fs from 'node:fs';
import path from 'node:path';

const file = path.resolve(process.argv[2] ?? 'dist/index.html');
const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH || undefined,
  args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'],
});
const results = [];
const check = (id, ok, detail = '') => { results.push({ id, ok }); console.log(`${ok ? 'PASS' : 'FAIL'}  ${id}${detail ? '  — ' + detail : ''}`); };
const errors = [];
const px = Array.from({ length: 1024 }, (_, i) => ((i >> 5) + (i & 31)) % 7 ? '0' : '3').join('');
const SEED = {
  'gametool.author': 'Tester',
  'gametool.sketches': JSON.stringify([{ id: 's1', name: 'Fox in the reeds', px }]),
  'gametool.forge.character': JSON.stringify({ name: 'Wren', backstory: 'Raised by the river folk.', height: 1.7, look: { primary: '#4F7A3A' } }),
  'gametool.forge.weapon': JSON.stringify({ name: 'Heron', engraving: 'Patience', legend: 'It waits.' }),
  'gametool.ballads': JSON.stringify([{ id: 'b1', title: 'The Long Night', tune: 'lute 100 0104100402082001', verses: [['The door was open', 'the fire was low']], telling: { start: 'a', middle: 'b', end: 'c' }, created: '2026-11-04' }]),
  'gametool.margins': JSON.stringify([{ id: 'm1', entryId: 'nowhere-entry', page: 0, text: 'I knew it!', ink: 'sepia', created: '2026-11-04' }]),
  'gametool.folklore': JSON.stringify({ lantern: { name: 'The Blue Lantern', history: 'Found by the gate.', rumor: 'It hums at night.' } }),
  'gametool.quest': JSON.stringify({ stage: 'lead', clues: [], theory: { text: 'They went north after the bell.', who: 'friend', where: 'north', why: 'bell', written: '2026-11-04' } }),
};
async function open(seed) {
  const ctx = await browser.newContext({ viewport: { width: 960, height: 640 }, acceptDownloads: true });
  await ctx.addInitScript((seed) => { if (sessionStorage.getItem('s')) return; sessionStorage.setItem('s', '1'); for (const [k, v] of Object.entries(seed)) localStorage.setItem(k, v); }, seed);
  const page = await ctx.newPage();
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  await page.route(/^https?:/, (r) => r.abort());
  await page.goto('file://' + file);
  await page.waitForFunction(() => window.__gametool, null, { timeout: 90000 });
  await page.waitForTimeout(400);
  await page.click('#openExtras');
  await page.click('#portfolioBtn');
  return { ctx, page };
}
{
  const { ctx, page } = await open(SEED);
  const rows = await page.$$eval('.pf', (l) => l.map((li) => li.querySelector('.pf-txt').textContent.trim().replace(/\s+/g, ' ')));
  const kinds = ['Hero', 'Crossbow', 'Sketch', 'Ballad', 'Margins', 'Folklore', 'Theory'];
  check('Portfolio lists every kind of thing you made', rows.length === 7 && kinds.every((k) => rows.some((r) => r.startsWith(k))), JSON.stringify(rows));
  check('The sketch shows its picture', await page.$eval('.pf img', (i) => i.src.startsWith('data:image/png')));
  const [dl] = await Promise.all([page.waitForEvent('download'), page.click('#pfExport')]);
  const html = fs.readFileSync(await dl.path(), 'utf8');
  check('Export saves one .html file named for you', /^artheria-portfolio-tester\.html$/.test(dl.suggestedFilename()), dl.suggestedFilename());
  check('The page holds every piece, its picture and its lore file', ['Wren', 'Heron', 'Fox in the reeds', 'The Long Night', 'I knew it!', 'The Blue Lantern', 'They went north'].every((t) => html.includes(t)) && html.includes('data:image/png') && (html.match(/<details>/g) || []).length === 7 && html.includes('credit_as'), `${html.length} bytes`);
  check('The page is self-contained (no outside links or scripts)', !/<script|src="https?:|href="https?:/.test(html));
  const [pc] = await Promise.all([page.waitForEvent('download'), page.click('.pf:nth-child(3) [data-act="pfCard"]')]);
  const png = fs.readFileSync(await pc.path());
  const w = png.readUInt32BE(16), h = png.readUInt32BE(20);
  check('A postcard saves as a 1200×800 PNG', pc.suggestedFilename() === 'artheria-sketch-fox-in-the-reeds.png' && png.slice(1, 4).toString() === 'PNG' && w === 1200 && h === 800, `${pc.suggestedFilename()} ${w}×${h}`);
  check('It tells you what it saved', /Saved the postcard/.test(await page.textContent('.prof-note')));
  await ctx.close();
}
{
  const { ctx, page } = await open({});
  const t = await page.textContent('.pf-list');
  check('An empty profile says how to start, with no Export button', /Nothing yet/.test(t) && !(await page.$('#pfExport')));
  await ctx.close();
}
// Lore-first item 5 (Mike 2026-11-05): every piece has a Send button, and Your works opens from the pause menu.
{
  const { ctx, page } = await open(SEED);
  const sends = await page.$$eval('.pf [data-act="pfSend"]', (l) => l.length);
  await page.click('.pf:nth-child(3) [data-act="pfSend"]');
  const sheet = await page.evaluate(() => { const s = document.querySelector('.submit-sheet'); return s ? { text: s.textContent, href: s.querySelector('[data-act=issue]').href } : null; });
  check('Every piece has a Send button that opens the send-to-Mike sheet with its lore file', sends === 7 && !!sheet && /Send ".+" to Mike/.test(sheet.text) && /issues\/new/.test(sheet.href), JSON.stringify({ sends, text: sheet?.text.slice(0, 60) }));
  await page.click('.submit-sheet [data-act=close]');
  await page.evaluate(() => window.__gametool.extras.close());
  await page.click('#begin');
  await page.waitForFunction(() => window.__gametool.state === 'play', null, { timeout: 90000 });
  await page.keyboard.press('Escape');
  await page.waitForFunction(() => window.__gametool.state === 'pause', null, { timeout: 10000 });
  await page.evaluate(() => document.getElementById('openWorks').click());
  const opened = await page.evaluate(() => ({ works: window.__gametool.extras.isOpen && window.__gametool.extras.tab === 'portfolio', pauseHidden: document.getElementById('pause').classList.contains('hidden') }));
  await page.click('#extras [data-act="back"]');
  const after = await page.evaluate(() => ({ state: window.__gametool.state, pause: !document.getElementById('pause').classList.contains('hidden'), extras: window.__gametool.extras.isOpen }));
  check('Pause → "Your works" opens the list, and Back returns to the pause menu', opened.works && opened.pauseHidden && after.state === 'pause' && after.pause && !after.extras, JSON.stringify({ opened, after }));
  await ctx.close();
}
check('No page errors', errors.length === 0, errors.slice(0, 3).join(' | '));
await browser.close();
const failed = results.filter((x) => !x.ok).length;
console.log(`\n${results.length - failed}/${results.length} passed`);
process.exit(failed ? 1 : 0);
