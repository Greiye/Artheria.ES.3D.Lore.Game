// Automated Done-when checks for v0.06 (§8): F5 library + books, §6.1 types, §6.2 validation, §6.4 links.
// The §8 0.06 creativity check (a non-technical friend adds a book unaided in < 10 min) needs a real person;
// this test covers its machine-checkable parts: plain-language errors, auto-shelving, every type opens.
// Usage: npm run build && node test/e2e-v0.06.mjs [path/to/index.html]
import { chromium } from 'playwright-core';
import { spawnSync } from 'node:child_process';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const file = path.resolve(process.argv[2] ?? 'dist/index.html');
const shots = path.resolve(process.env.SHOTS_DIR ?? 'test/screenshots');
fs.mkdirSync(shots, { recursive: true });
const results = [];
const check = (id, ok, detail = '') => { results.push({ id, ok }); console.log(`${ok ? 'PASS' : 'FAIL'}  ${id}${detail ? '  — ' + detail : ''}`); };

// ---------- §6.2 validation (node only, on a scratch copy of content/) ----------
const scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'lore-'));
const runLore = () => spawnSync(process.execPath, ['scripts/build-lore.mjs'], { env: { ...process.env, LORE_ROOT: scratch }, encoding: 'utf8' });
const reset = () => { fs.rmSync(path.join(scratch, 'content'), { recursive: true, force: true }); fs.cpSync('content', path.join(scratch, 'content'), { recursive: true }); };
const exemplar = () => path.join(scratch, 'content', 'lore', 'natalies-field-note.md');
for (const field of ['title', 'contributor', 'credit_as', 'created', 'type']) {
  reset();
  fs.writeFileSync(exemplar(), fs.readFileSync(exemplar(), 'utf8').replace(new RegExp(`^${field}:.*\\r?\\n`, 'm'), ''));
  const r = runLore();
  const line = r.stderr.split('\n').find((l) => l.includes('natalies-field-note.md')) ?? '';
  const plain = new RegExp(`natalies-field-note\\.md: missing "${field}" — add `).test(line) && !/\bError\b|\n\s+at |stack trace/.test(r.stderr);
  check(`§6.2 removing "${field}" from the exemplar → one plain-language line + non-zero exit`, r.status !== 0 && plain, line.trim());
}
reset();
fs.writeFileSync(path.join(scratch, 'content', 'lore', 'tiny-fragment.md'), '---\ntitle: "Tiny"\ncontributor: "friend"\ncredit_as: "Friend"\ncreated: 2026-10-21\ntype: lore\n---\n' + 'word '.repeat(50) + '\n');
const ok = runLore();
const idx = JSON.parse(fs.readFileSync(path.join(scratch, 'content', 'lore', 'index.json'), 'utf8'));
const tiny = idx.entries.find((e) => e.id === 'tiny-fragment');
check('F5.5 a 50-word fragment is accepted (never rejected for length) and tiered "fragment"', ok.status === 0 && tiny?.tier === 'fragment' && tiny.words === 50, `${tiny?.tier} ${tiny?.words}`);
check('F5.2 a book not in shelves.json is shelved automatically', idx.shelves.some((s) => s.red.includes('tiny-fragment')));
fs.rmSync(scratch, { recursive: true, force: true });

// ---------- §6.4 links both ways; sources unchanged ----------
const hash = (f) => crypto.createHash('sha1').update(fs.readFileSync(f)).digest('hex');
const srcs = ['content/lore/natalies-field-note.md', 'content/lore/farm-beasts.md'];
const before = srcs.map(hash);
spawnSync(process.execPath, ['scripts/build-lore.mjs']);
const real = JSON.parse(fs.readFileSync('content/lore/index.json', 'utf8'));
const nf = real.entries.find((e) => e.id === 'natalies-field-note'), fb = real.entries.find((e) => e.id === 'farm-beasts');
check('§6.4 the exemplar links to farm-beasts; index lists it both ways', nf.links_out.includes('farm-beasts') && fb.links_in.includes('natalies-field-note'));
check('§6.4 neither source file changes on disk', srcs.map(hash).every((h, i) => h === before[i]));
const lorebooks = real.entries.filter((e) => e.type === 'lore').map((e) => e.id);
check('F5.2 every shelved slug resolves to an .md, every book is on a shelf', real.shelves.flatMap((s) => s.red).every((s) => lorebooks.includes(s)) && lorebooks.every((id) => real.shelves.some((s) => s.red.includes(id))));
const types = new Set(real.entries.map((e) => e.type));
check('§6.1 one entry of each type exists (lore, character, song, food, art)', ['lore', 'character', 'song', 'food', 'art'].every((t) => types.has(t)), [...types].join(', '));

// ---------- in the game ----------
const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH || undefined,
  args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'],
});
const G = (page, fn, arg) => page.evaluate(fn, arg);
const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
await ctx.addInitScript(() => localStorage.setItem('gametool.character', JSON.stringify({ name: 'Test', motivation: '', secret: '', created: true })));
const page = await ctx.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
await page.route(/^https?:/, (r) => r.abort());
await page.goto('file://' + file);
await page.waitForFunction(() => window.__gametool);
await page.click('#begin');
await page.waitForFunction(() => window.__gametool.state === 'play', null, { timeout: 5000 });
await G(page, () => window.__gametool.world.openDoor());   // as after Natalie (F3.4)

const lib = await G(page, () => {
  const L = window.__gametool.library;
  const g = window.__gametool.world.scene.getObjectByName('library-interior');
  return { books: [...L.redBooks.keys()].length, arts: [...L.artifacts.keys()], exit: !!L.exitDoor, furniture: g.children.filter((c) => c.name === 'library-furniture').length, tris: g.children.filter((c) => c.name === 'library-furniture').reduce((n, c) => n + c.geometry.index.count / 3, 0) };
});
check('F5.1 12 shelves, clutter and a small exit door inside', lib.exit && lib.furniture > 0 && lib.tris >= 12 * 8 * 12 && real.shelves.length === 12, JSON.stringify(lib));
check('F5.2 every red book on the shelves is in the scene', lib.books === lorebooks.length, `${lib.books}/${lorebooks.length}`);

// Aim at something: put the player 1.2 m in front of it, looking at its centre.
const aimAt = (page, getter) => G(page, (src) => {
  const g = window.__gametool, o = new Function('g', 'return ' + src)(g);
  const c = new g.Vector3(); o.getWorldPosition(c);
  const p = g.player, wallLeft = c.x < 0;
  const side = Math.abs(c.x) > 9 ? new g.Vector3(wallLeft ? 1.3 : -1.3, 0, 0) : new g.Vector3(0, 0, 1.3);
  p.pos.set(c.x + side.x, 0, c.z + side.z);
  const d = c.clone().sub(new g.Vector3(p.pos.x, 1.7, p.pos.z));
  p.yaw = Math.atan2(-d.x, -d.z); p.pitch = Math.atan2(d.y, Math.hypot(d.x, d.z));
}, getter);
const verb = () => G(page, () => !document.getElementById('prompt').classList.contains('hidden') && document.getElementById('promptVerb').textContent);
const closeBook = async () => { await page.keyboard.press('Tab'); await page.waitForTimeout(300); if (await G(page, () => window.__gametool.state === 'resume')) await page.click('#relockBtn'); await page.waitForTimeout(200); };

// F5.4 red book → reader
await aimAt(page, "g.library.redBooks.get('farm-beasts')");
await page.waitForTimeout(400);
const v1 = await verb();
await page.screenshot({ path: path.join(shots, 'v06-shelf.png') });
await page.keyboard.press('KeyE');
await page.waitForFunction(() => window.__gametool.reader.isOpen, null, { timeout: 4000 }).catch(() => undefined);
const r1 = await G(page, () => ({ open: window.__gametool.reader.isOpen, ids: window.__gametool.reader.entryIds, h1: document.querySelector('#reader .page.left h1')?.textContent, spread: !!document.querySelector('#reader .page.right') }));
check('F5.4 E on a red book opens it in the parchment reader', v1 === 'Read "Farm Beasts: The Goblin Plague"' && r1.open && r1.ids.join() === 'farm-beasts' && r1.h1 === 'Farm Beasts: The Goblin Plague', `${v1} / ${JSON.stringify(r1)}`);
await page.keyboard.press('KeyD'); await page.keyboard.press('ArrowLeft');
await closeBook();
check('F5.4 Tab closes the reader and play resumes', await G(page, () => !window.__gametool.reader.isOpen && window.__gametool.state === 'play'));

// F5.5 + F5.6 in the exemplar: tier shown, link followed, missing link is plain text
await G(page, () => window.__gametool.reader.openEntries([window.__gametool.library && { ...JSON.parse(JSON.stringify(window.__gametool.book.entries.find((e) => e.id === 'natalies-field-note'))) }]));
await page.waitForTimeout(300);
const tier = await G(page, () => ({ byline: document.querySelector('#reader .page.left .byline')?.textContent, note: document.querySelector('#reader .tier-note')?.textContent, link: !!document.querySelector('#reader a.wikilink[data-link="farm-beasts"]') }));
check('F5.5 a fragment shows its tier (visibly unfinished)', /fragment/.test(tier.byline ?? '') && /unfinished/.test(tier.note ?? ''), JSON.stringify(tier));
await page.screenshot({ path: path.join(shots, 'v06-fragment-reader.png') });
let linkClicked = false;
for (let i = 0; i < 3 && !linkClicked; i++) {
  // A real click on the visible link (dispatched on the element: the page-edge buttons overlap the margins).
  linkClicked = await G(page, () => { const a = document.querySelector('#reader .page.left a.wikilink[data-link="farm-beasts"], #reader .page.right a.wikilink[data-link="farm-beasts"]'); if (a) a.click(); return !!a; });
  if (!linkClicked) {
  await page.keyboard.press('KeyD'); }
}
await page.waitForTimeout(300);
check('F5.6 [[farm-beasts]] is a tappable link that opens the linked book', linkClicked && await G(page, () => window.__gametool.reader.entryIds.join() === 'farm-beasts'));
await G(page, () => { const e = { ...window.__gametool.book.entries[0], id: 'x', title: 'Broken', body: 'See [[no-such-book]].', replyTo: [], tier: 'fragment' }; return window.__gametool.reader.openEntries([e]); });
await page.waitForTimeout(200);
check('F5.6 a broken link is plain text with a "missing page" note', await G(page, () => /no-such-book \(missing page\)/.test(document.querySelector('#reader .missing-link')?.textContent ?? '') && !document.querySelector('#reader a[data-link="no-such-book"]')));
await closeBook();

// F5.3 grey books → roll-table toast for ~3 s
const greyLines = JSON.parse(fs.readFileSync('content/rolltables/grey-books.json', 'utf8')).lines;
await aimAt(page, "g.library.targets.find((t) => t.userData.hit?.kind === 'grey' && t.userData.hit.shelf === 'shelf-9')");
await page.waitForTimeout(400);
const v2 = await verb();
await page.keyboard.press('KeyE');
await page.waitForTimeout(200);
const toast = await G(page, () => ({ shown: !document.getElementById('toast').classList.contains('hidden'), text: document.getElementById('toast').textContent }));
await page.waitForTimeout(3200);
const gone = await G(page, () => document.getElementById('toast').classList.contains('hidden'));
check('F5.3 E on a grey book shows a random roll-table line for 3 s', v2 === 'Read a grey book' && toast.shown && greyLines.includes(toast.text) && gone, `${v2}: ${toast.text}`);

// §6.1 artifacts: character, song (plays), food, art each open in the reader
const arp = await G(page, () => { const a = window.__gametool.audio; window.__arp = 0; const orig = a.arpeggio.bind(a); a.arpeggio = (c) => { window.__arp++; window.__chords = c; return orig(c); }; return true; });
for (const [slug, expectVerb] of [['natalie-bourbon', 'Meet Natalie Bourbon'], ['song-of-the-paved-road', 'Play "Song of the Paved Road"'], ['ranlean-rhambutan', 'Read "Ranlean Rhambutan"'], ['straphan-at-sunset', 'Look at "Straphan at Sunset"']]) {
  await aimAt(page, `g.library.targets.find((t) => t.userData.hit?.slug === '${slug}')`);
  await page.waitForTimeout(400);
  const v = await verb();
  await page.keyboard.press('KeyE');
  await page.waitForFunction(() => window.__gametool.reader.isOpen, null, { timeout: 4000 }).catch(() => undefined);
  const opened = await G(page, (s) => window.__gametool.reader.isOpen && window.__gametool.reader.entryIds.join() === s, slug);
  if (slug === 'song-of-the-paved-road') await page.screenshot({ path: path.join(shots, 'v06-music-box.png') });
  check(`§6.1 ${slug}: in-world object opens its page`, v === expectVerb && opened, String(v));
  await closeBook();
}
check('§6.1 E on the music box plays its chord line (Music bus)', arp && await G(page, () => window.__arp === 1 && window.__chords === 'Am F C G'));
await G(page, () => { const p = window.__gametool.player; p.pos.set(0, 0, -20); p.yaw = 0; p.pitch = 0.05; });
await page.waitForTimeout(400);
await page.screenshot({ path: path.join(shots, 'v06-library.png') });
check('v0.06: no console/page errors', errors.length === 0, errors.join(' | '));
await browser.close();
const failed = results.filter((r) => !r.ok).length;
console.log(`\n${results.length - failed}/${results.length} checks passed`);
process.exit(failed ? 1 : 0);
