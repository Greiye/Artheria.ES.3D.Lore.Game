// B23 (Mike 2026-11-08): NPCs who speak only Japanese (the tea house) and only Tagalog (the market corner), the same
// kind of talk as the Spanish caravan: their lines are never translated (Japanese shows romaji too), picked or written
// replies, a reward once per person, and every line goes into the one phrasebook. A Spanish UI leaves them alone.
// Usage: node test/e2e-langfolk.mjs [path/to/index.html]   (CHROMIUM_PATH as in e2e.mjs)
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
await page.waitForTimeout(1200);
const G = (fn, a) => page.evaluate(fn, a);
await G(() => window.__gametool.firstDay.skip());
fs.mkdirSync('test/screenshots', { recursive: true });

const folk = await G(() => { const g = window.__gametool; const m = (list) => list.map((f) => ({ id: f.id, role: f.talk.role, e: g.interactables.some((i) => i.obj === f.hit) })); return { ja: m(g.teaFolk), tl: m(g.marketFolk), sights: g.livingMap.sights().map((s) => s.label) }; });
check('Three Japanese speakers at the tea house and four Tagalog speakers at the market, each one to talk to', folk.ja.length === 3 && folk.tl.length === 4 && [...folk.ja, ...folk.tl].every((f) => f.e), JSON.stringify(folk));
check('Both are on the map', folk.sights.includes('Tea house') && folk.sights.includes('Market corner'), JSON.stringify(folk.sights));

// Walk up to the tea seller: the prompt names her and the language.
await G(() => { const g = window.__gametool, f = g.teaFolk[0], at = f.hit.position; g.player.pos.set(f.stand.x, 0, f.stand.z); g.player.yaw = g.player.bodyYaw = Math.atan2(f.stand.x - at.x, f.stand.z - at.z); g.player.pitch = -0.1; });
await page.waitForFunction(() => /tea seller/.test(window.__gametool.lookingAtVerb ?? ''), null, { timeout: 8000, polling: 200 }).catch(() => {});
await page.screenshot({ path: 'test/screenshots/b23-teahouse.png' });
const v = await G(() => window.__gametool.lookingAtVerb);
check('The prompt says "Talk to the tea seller (Japanese)"', v === 'Talk to the tea seller (Japanese)', String(v));
await page.keyboard.press('KeyE');
await page.waitForTimeout(500);
const j1 = await G(() => { const el = window.__gametool.teahouse.el; return { open: window.__gametool.teahouse.isOpen, line: el.querySelector('.es-line')?.textContent, lang: el.querySelector('.es-line')?.getAttribute('lang'), romaji: el.querySelector('p.es-romaji')?.textContent, first: el.querySelector('[data-ans="0"]')?.textContent }; });
check('She speaks Japanese, with romaji under it; your name goes into a reply', j1.open && j1.line === 'こんにちは！お名前は？' && j1.lang === 'ja' && j1.romaji === 'Konnichiwa! O-namae wa?' && j1.first === 'Rowanです。Rowan desu.', JSON.stringify(j1));
await page.screenshot({ path: 'test/screenshots/b23-tea-talk.png' });
// A written reply in romaji is understood; then pick the rest; the reward is paid once.
const before = await G(() => window.__gametool.inventory.count('crown'));
const j2 = await G(() => { const p = window.__gametool.teahouse; const a = p.answer('Rowan desu'); const b = p.answer('はい、おねがいします'); const c = p.answer(0); const d = p.answer('oishii!'); return [a, b, c, d, p.st.done.join()]; });
const paid = (await G(() => window.__gametool.inventory.count('crown'))) - before;
check('Romaji and kana replies are understood; finishing pays once', j2.slice(0, 4).every(Boolean) && j2[4] === 'tea' && paid === 4, JSON.stringify({ j2, paid }));
const wrong = await G(() => { const p = window.__gametool.teahouse; p.open(window.__gametool.teaFolk[1].talk); const ok = p.answer(1); return { ok, line: p.el.querySelector('.es-line').textContent }; });
check('A wrong reply gets a puzzled answer in Japanese', !wrong.ok && /^(えっ？|すみません、わかりません。|もう一度お願いします。)$/.test(wrong.line), JSON.stringify(wrong));
await G(() => window.__gametool.teahouse.close());
await page.waitForFunction(() => window.__gametool.state === 'play', null, { timeout: 5000 }).catch(() => {});

// The market: Lola speaks Tagalog.
await G(() => { const g = window.__gametool, f = g.marketFolk.find((x) => x.id === 'lola'), at = f.hit.position; g.player.pos.set(f.stand.x, 0, f.stand.z); g.player.yaw = g.player.bodyYaw = Math.atan2(f.stand.x - at.x, f.stand.z - at.z); g.player.pitch = -0.1; });
await page.waitForFunction(() => /Lola/.test(window.__gametool.lookingAtVerb ?? ''), null, { timeout: 8000, polling: 200 }).catch(() => {});
await page.screenshot({ path: 'test/screenshots/b23-market.png' });
await page.keyboard.press('KeyE');
await page.waitForTimeout(500);
const t1 = await G(() => { const el = window.__gametool.palengke.el; return { open: window.__gametool.palengke.isOpen, line: el.querySelector('.es-line')?.textContent, lang: el.querySelector('.es-line')?.getAttribute('lang'), role: el.querySelector('h2')?.textContent }; });
check('Lola speaks Tagalog', t1.open && t1.line === 'Halika, apo. Upo ka.' && t1.lang === 'tl' && t1.role === 'Si Lola', JSON.stringify(t1));
await page.screenshot({ path: 'test/screenshots/b23-lola-talk.png' });
const t2 = await G(() => { const p = window.__gametool.palengke; return [p.answer('salamat po'), p.answer(0)]; });
check('Written and picked Tagalog replies are understood', t2.every(Boolean), JSON.stringify(t2));
await G(() => window.__gametool.palengke.close());
await page.waitForFunction(() => window.__gametool.state === 'play', null, { timeout: 5000 }).catch(() => {});

// One phrasebook, a section per language.
const pb = await G(() => { const g = window.__gametool; g.openPhrasebook(); const el = g.phrasebook.el; const r = { heads: [...el.querySelectorAll('.pb-lang')].map((h) => h.textContent), ja: el.querySelectorAll('[data-lang="ja"] li').length, tl: el.querySelectorAll('[data-lang="tl"] li').length, rom: el.querySelector('.pb-romaji')?.textContent }; g.phrasebook.close(); return r; });
check('The phrasebook keeps the Japanese (with romaji) and Tagalog lines in their own sections', pb.heads.join('|') === 'Japanese · the tea house|Tagalog · the market' && pb.ja >= 8 && pb.tl >= 3 && pb.rom === 'Konnichiwa! O-namae wa?', JSON.stringify(pb));

// In Spanish, their own words stay Japanese and Tagalog; only the game's buttons change.
await G(() => window.__gametool.i18n.setLang('es'));
await G(() => window.__gametool.openTeahouse('potter'));
await page.waitForTimeout(200);   // the translator runs just after the panel is drawn
const es = await G(() => { const g = window.__gametool; const el = g.teahouse.el; const r = { line: el.querySelector('.es-line').textContent, mode: el.querySelector('#esMode')?.textContent, bye: el.querySelector('#esClose').textContent }; g.teahouse.close(); return r; });
check('With the UI in Spanish, the speakers keep their own language', es.line === 'いらっしゃいませ。' && es.mode === 'Escribir mi respuesta' && es.bye === 'さようなら', JSON.stringify(es));
await G(() => window.__gametool.i18n.setLang('en'));
check('No page errors', errors.length === 0, errors.slice(0, 3).join(' | '));
await browser.close();
const passed = results.filter((r) => r.ok).length;
console.log(`${passed}/${results.length} checks passed`);
process.exit(passed === results.length ? 0 : 1);
