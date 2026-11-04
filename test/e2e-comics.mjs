// B47 (Mike 2026-11-04): lore books can be read as comics. A book with content/comics/<id>.json shows a
// Text / Comic button; panels are quoted from the lore text (the source of truth); the choice is kept per profile.
// Usage: node test/e2e-comics.mjs [path/to/index.html]   (CHROMIUM_PATH as in e2e.mjs)
import { chromium } from 'playwright-core';
import fs from 'node:fs';
import path from 'node:path';

const file = path.resolve(process.argv[2] ?? 'dist/index.html');
const results = [];
const check = (id, ok, detail = '') => { results.push({ id, ok }); console.log(`${ok ? 'PASS' : 'FAIL'}  ${id}${detail ? '  — ' + detail : ''}`); };

// ---------- the comics quote their books ----------
const norm = (t) => t.replace(/\[\[[^\]]*\]\]/g, '').replace(/[*_#>]/g, '').replace(/\s+/g, ' ').trim();
const comics = fs.readdirSync('content/comics').filter((f) => f.endsWith('.json')).map((f) => [f, JSON.parse(fs.readFileSync(path.join('content/comics', f), 'utf8'))]);
const loose = [];
for (const [f, c] of comics) {
  const md = path.join('content/lore', c.book + '.md');
  if (f !== c.book + '.json' || !fs.existsSync(md)) { loose.push(`${f}: no lore book "${c.book}"`); continue; }
  const body = norm(fs.readFileSync(md, 'utf8').replace(/^---[\s\S]*?---/, ''));
  for (const p of c.panels) for (const t of [p.caption, ...(p.say ?? []).map((s) => s.text)].filter(Boolean)) if (!body.includes(norm(t))) loose.push(`${c.book}: "${t}"`);
  for (const p of c.panels) if (p.art && !fs.existsSync(path.join('content/assets/comics', c.book, p.art))) loose.push(`${c.book}: missing art ${p.art}`);
}
check('B47 every comic belongs to a lore book and every caption and speech line is quoted from it', comics.length > 0 && !loose.length, loose.join('; ') || `${comics.length} comic(s)`);
const shared = /const SHARED = new Set\(\[([^\]]*)\]/.exec(fs.readFileSync('src/profiles.ts', 'utf8'))?.[1] ?? '';
check('B47 the Text / Comic choice is a per-profile key (not a shared device setting)', !/'bookmode'/.test(shared) && /gametool\.bookmode/.test(fs.readFileSync('src/comics.ts', 'utf8')));

// ---------- in the game ----------
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
await ctx.addInitScript(() => localStorage.setItem('gametool.character', JSON.stringify({ name: 'Test', motivation: '', secret: '', created: true })));
const page = await ctx.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
await page.route(/^https?:/, (r) => r.abort());
const boot = async () => {
  await page.goto('file://' + file, { timeout: 180000 });
  await page.waitForFunction(() => window.__gametool, null, { timeout: 180000 });
  await page.evaluate(() => document.querySelector('#begin').click());
  await page.waitForFunction(() => window.__gametool.state === 'play', null, { timeout: 180000 });
};
const open = async (id) => { if (await page.evaluate(() => window.__gametool.reader.isOpen)) { await page.keyboard.press('Tab'); await page.waitForTimeout(300); } await page.evaluate((id) => window.__gametool.openReader(id), id); };
const state = () => page.evaluate(() => {
  const r = window.__gametool.reader, b = document.querySelector('#reader .book-mode');
  return { open: r.isOpen, mode: r.mode, button: !b.classList.contains('hidden'), label: b.textContent,
    panels: r.pages.flatMap((p) => p.blocks).filter((n) => n.classList?.contains('comic-panel')).length,
    shown: document.querySelectorAll('#reader .page.left .comic-panel, #reader .page.right .comic-panel').length,
    text: !!document.querySelector('#reader .page.left p'), stored: localStorage.getItem('gametool.bookmode') };
});

await boot();
await open('natalies-field-note');
await page.waitForTimeout(300);
const t0 = await state();
check('B47 a book with a comic opens as text and offers a Comic button', t0.open && t0.mode === 'text' && t0.button && /Comic/.test(t0.label) && t0.panels === 0 && t0.text, JSON.stringify(t0));
await page.click('#reader .book-mode');
await page.waitForTimeout(400);
const t1 = await state();
const want = comics.find(([, c]) => c.book === 'natalies-field-note')[1].panels.length;
check('B47 Comic shows the book as panels (all of them, across pages) and the button flips to Text', t1.mode === 'comic' && t1.panels === want && t1.shown > 0 && /Text/.test(t1.label), JSON.stringify(t1));
const look = await page.evaluate(() => { const p = document.querySelector('#reader .comic-panel'); return { cap: !!p.querySelector('.cp-cap'), art: !!p.querySelector('.cp-art'), sketch: !!p.querySelector('.cp-sketch'),
  say: !!document.querySelector('#reader .cp-say .cp-face svg, #reader .cp-say .cp-face img'), h1: document.querySelector('#reader .page.left h1')?.textContent }; });
check('B47 panels have a caption box, art (a placeholder card until drawn) and speakers with portraits', look.cap && look.art && look.sketch && look.h1 === "Natalie's Field Note", JSON.stringify(look));
fs.mkdirSync('test/screenshots', { recursive: true });
await page.screenshot({ path: 'test/screenshots/b47-comic.png' });
for (let i = 0; i < 3; i++) { await page.keyboard.press('KeyD'); await page.waitForTimeout(350); }
check('B47 the speech lines show with a portrait in the panels', await page.evaluate(() => document.querySelectorAll('#reader .cp-say .cp-face :is(svg, img)').length > 0) || look.say);
await page.screenshot({ path: 'test/screenshots/b47-comic-2.png' });

await open('farm-beasts');
await page.waitForTimeout(300);
const t2 = await state();
check('B47 a book with no comic reads as text and hides the button, even in comic mode', !t2.button && t2.panels === 0 && t2.text && t2.mode === 'comic', JSON.stringify(t2));

await boot();
await open('natalies-field-note');
await page.waitForTimeout(300);
const t3 = await state();
check('B47 the choice is remembered after a reload', t3.stored === 'comic' && t3.panels === want, JSON.stringify(t3));
await page.keyboard.press('KeyC');
await page.waitForTimeout(400);
const t4 = await state();
check('B47 C switches back to text', t4.mode === 'text' && t4.panels === 0 && t4.text, JSON.stringify(t4));
check('B47 no page errors', errors.length === 0, errors.join(' | '));

await browser.close();
const failed = results.filter((r) => !r.ok).length;
console.log(`\n${results.length - failed}/${results.length} checks passed`);
process.exit(failed ? 1 : 0);
