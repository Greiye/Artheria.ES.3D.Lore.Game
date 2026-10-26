// Phase C checks: B10 sketchbook + banner, B3 margin notes (HTML book + 3D book), B13 ink and paper.
// Usage: npm run build && node test/e2e-writing.mjs [path/to/index.html]
import { chromium } from 'playwright-core';
import path from 'node:path';

const file = path.resolve(process.argv[2] ?? 'dist/index.html');
const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH || undefined,
  args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'],
});
const results = [];
const check = (id, ok, detail = '') => { results.push({ id, ok }); console.log(`${ok ? 'PASS' : 'FAIL'}  ${id}${detail ? '  — ' + detail : ''}`); };
const G = (page, fn, arg) => page.evaluate(fn, arg);
const until = (page, fn, arg, timeout = 15000) => page.waitForFunction(fn, arg, { timeout, polling: 100 }).then(() => true, () => false);

const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
await ctx.addInitScript(() => {
  if (!localStorage.getItem('gametool.character')) localStorage.setItem('gametool.character', JSON.stringify({ name: 'Test', motivation: '', secret: '', created: true }));
  window.addEventListener('mousemove', (e) => e.stopImmediatePropagation(), true);   // aim by yaw/pitch only (see e2e-v0.06)
});
const page = await ctx.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
await page.goto('file://' + file);
await page.waitForFunction(() => window.__gametool);
await page.click('#begin');
await page.waitForFunction(() => window.__gametool.state === 'play');

const aimAt = (name) => G(page, (n) => {
  const g = window.__gametool, o = g.world.stations[n], p = g.player, c = o.position;
  p.pos.set(c.x + 1.6, 0, c.z + 0.3);
  const d = new g.Vector3(c.x - p.pos.x, c.y - 1.7, c.z - p.pos.z);
  p.yaw = Math.atan2(-d.x, -d.z); p.pitch = Math.atan2(d.y, Math.hypot(d.x, d.z));
}, name);
const verbIs = (w) => until(page, (want) => document.getElementById('promptVerb').textContent === want && !document.getElementById('prompt').classList.contains('hidden'), w);
const px = () => G(page, () => window.__gametool.sketchPad.pixels);

// ---------- B10 sketchbook and banner ----------
await aimAt('banner');
check('B10 the camp banner offers "Paint the banner"', await verbIs('Paint the banner'));
await page.keyboard.press('KeyE');
check('B10 E opens the sketchbook, framed on the banner', await until(page, () => window.__gametool.state === 'forge' && !document.getElementById('sketchpad').classList.contains('hidden') && window.__gametool.rig.inShot));
await page.click('#skClear');
check('B10 Clear empties the 32×32 canvas', /^0{1024}$/.test(await px()));
// Pen: click pixel (4, 6) with colour 3 (red), mirror on.
await page.click('#sketchpad [data-c="3"]');
await page.click('#skMirror');
const box = await page.locator('#skCanvas').boundingBox();
const at = (x, y) => [box.x + (x + 0.5) * box.width / 32, box.y + (y + 0.5) * box.height / 32];
await page.mouse.click(...at(4, 6));
let p = await px();
check('B10 the pen paints a pixel, and Mirror paints its twin', p[6 * 32 + 4] === '3' && p[6 * 32 + 27] === '3', `${p[6 * 32 + 4]} ${p[6 * 32 + 27]}`);
// A stroke: drag across row 10.
await page.mouse.move(...at(2, 10)); await page.mouse.down(); await page.mouse.move(...at(12, 10), { steps: 12 }); await page.mouse.up();
p = await px();
check('B10 dragging draws a stroke', [...p.slice(10 * 32 + 2, 10 * 32 + 13)].filter((c) => c === '3').length >= 9);
await page.click('#sketchpad [data-tool="fill"]');
await page.click('#sketchpad [data-c="7"]');
await page.mouse.click(...at(20, 25));
p = await px();
check('B10 Fill floods the empty area', [...p].filter((c) => c === '7').length > 700);
await page.click('#skUndo');
check('B10 Undo takes the fill back', [...(await px())].filter((c) => c === '7').length === 0);
await page.fill('#skName', 'Test Crest');
await page.click('#skStamp');
const stamped = await G(page, () => { const s = JSON.parse(localStorage.getItem('gametool.sketches')); const b = window.__gametool.world.bannerCloth; return { n: s.length, id: s[0].id, name: s[0].name, banner: b.userData.sketch, map: !!b.material.map }; });
check('B10 "Hang on the banner" saves the sketch and stamps it on the cloth', stamped.n === 1 && stamped.name === 'Test Crest' && stamped.banner === stamped.id && stamped.map, JSON.stringify(stamped));
await page.click('#skSubmit');
const sk = await G(page, () => decodeURIComponent(document.querySelector('.submit-sheet [data-act=issue]').href));
check('B10 Submit exports the sketch as a lore file (pixels in front matter)', sk.includes('[sketch] Test Crest') && /pixels: "[0-9a-f]{1024}"/.test(sk));
await page.click('.submit-sheet [data-act=close]');
const sway0 = await G(page, () => window.__gametool.world.bannerCloth.geometry.attributes.position.getZ(60));
await page.waitForTimeout(300);
check('B10 the banner sways in the wind', Math.abs(sway0 - await G(page, () => window.__gametool.world.bannerCloth.geometry.attributes.position.getZ(60))) > 1e-4);
await page.click('#skDone');
check('B10 Done closes the sketchbook', await until(page, () => window.__gametool.state !== 'forge'));
if (await G(page, () => window.__gametool.state === 'resume')) await page.click('#relockBtn');
await until(page, () => window.__gametool.state === 'play');

// ---------- B3 margin notes in the lectern book ----------
await G(page, () => { const p = window.__gametool.player; p.pos.set(0, 0, 1.4); p.yaw = 0; p.pitch = -0.45; p.update(0); });
await verbIs('Read');
await page.keyboard.press('KeyE');
check('B3 the lectern book opens', await until(page, () => window.__gametool.state === 'book'));
await G(page, () => window.__gametool.book.goto(2));
await page.waitForTimeout(400);
const page0 = await G(page, () => window.__gametool.book.currentPage);
await page.click('#book .book-pen');
check('B3 the pen opens the margin desk', await page.isVisible('#book .margin-desk'));
await page.click('#book .margin-desk textarea');
await page.keyboard.type('Dad said the door was here.');
check('B3 typing a note does not turn pages or close the book', (await G(page, () => window.__gametool.book.currentPage)) === page0 && (await G(page, () => window.__gametool.state)) === 'book');
await page.click('#book .margin-desk [data-ink="cinnabar"]');
check('B13 picking an ink keeps the typed text and saves the ink', (await page.inputValue('#book .margin-desk textarea')) === 'Dad said the door was here.' && await G(page, () => JSON.parse(localStorage.getItem('gametool.stationery')).ink === 'cinnabar'), `${await page.inputValue('#book .margin-desk textarea')} ${await G(page, () => localStorage.getItem('gametool.stationery'))}`);
await page.click('#book .margin-desk [data-paper="aged"]');
check('B13 picking a paper restyles the book pages', await G(page, () => document.getElementById('book').classList.contains('paper-aged') && document.getElementById('reader').classList.contains('paper-aged')));
const sealId = await G(page, () => JSON.parse(localStorage.getItem('gametool.sketches'))[0].id);
await page.click(`#book .margin-desk [data-seal="${sealId}"]`);
await page.click('#book .margin-desk [data-act="pin"]');
const note = await G(page, () => { const n = document.querySelector('#book .margin-note'); return n && { text: n.textContent, ink: n.style.getPropertyValue('--ink'), seal: !!n.querySelector('.mn-seal') }; });
check('B3 the pinned note shows on the page in its ink, with the wax seal', !!note && note.text.includes('Dad said the door') && note.ink === '#B3362C' && note.seal, JSON.stringify(note));
const world3d = await G(page, () => { const g = window.__gametool; return { lect: g.world.lecternPages.some((m) => !!m.userData.marginMat), marks: g.world.scene.getObjectByName('bookmarks') ? 1 : 0 }; });
check('B3 the note is drawn onto the 3D lectern pages and ribbons a shelf book', world3d.lect && world3d.marks === 1, JSON.stringify(world3d));
await page.click('#book .book-pen');
const sub = await page.isVisible('#book .margin-desk [data-act="submit"]');
if (sub) await page.click('#book .margin-desk [data-act="submit"]');
const mm = sub ? await G(page, () => decodeURIComponent(document.querySelector('.submit-sheet [data-act=issue]').href)) : '';
check('B3 "Submit my notes" exports a margin file that replies to the entry', mm.includes('type: margin') && mm.includes('reply_to:') && mm.includes('Dad said the door'));
await page.click('.submit-sheet [data-act=close]').catch(() => {});
await page.click('#book .margin-desk [data-act="cancel"]');
await page.click('#book .margin-note .mn-text');
check('B3 tapping a note unfolds it', await G(page, () => document.querySelector('#book .margin-note').classList.contains('open')));
await page.keyboard.press('Escape');
check('B3 Esc still closes the book', await until(page, () => window.__gametool.state !== 'book'));

// ---------- persistence ----------
// docs/assumptions.md #30: this container's headless Chromium sometimes drops a key across a file:// reload.
// Snapshot first; if a key is gone after the reload, put it back and reload again (as e2e.mjs does).
const snap = await G(page, () => ({ ...localStorage }));
for (let attempt = 0; attempt < 5; attempt++) {
  await page.reload();
  await page.waitForFunction(() => window.__gametool);
  const lost = await G(page, (keys) => keys.filter((k) => localStorage.getItem(k) === null), Object.keys(snap));
  if (!lost.length) break;
  await G(page, (s) => { for (const [k, v] of Object.entries(s)) localStorage.setItem(k, v); }, snap);
}
const kept = await G(page, () => ({ banner: window.__gametool.world.bannerCloth.userData.sketch, notes: JSON.parse(localStorage.getItem('gametool.margins')).length, lect: window.__gametool.world.lecternPages.some((m) => !!m.userData.marginMat) }));
check('B3/B10 notes, banner and 3D pages come back after a reload', kept.banner === sealId && kept.notes === 1 && kept.lect, JSON.stringify(kept));

check('Writing: no console/page errors', errors.length === 0, errors.join(' | '));
await browser.close();
const failed = results.filter((r) => !r.ok).length;
console.log(`\n${results.length - failed}/${results.length} checks passed`);
process.exit(failed ? 1 : 0);
