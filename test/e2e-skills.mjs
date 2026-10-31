// B19 (Mike 2026-10-31): real-skill mini games (knots, first aid, fire craft) at the practice table by the dojo
// mats: a safety note first, order and pick rounds, a skill card per skill in the Journal's Skills book.
// Usage: node test/e2e-skills.mjs [path/to/index.html]   (CHROMIUM_PATH as in e2e.mjs)
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
const frames = (page, n = 3) => G(page, (n) => new Promise((r) => { const f = () => (--n <= 0 ? r() : requestAnimationFrame(f)); requestAnimationFrame(f); }), n);

const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 } });
const page = await ctx.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
await page.route(/^https?:/, (r) => r.abort());
await page.goto('file://' + file);
await page.waitForFunction(() => window.__gametool);
await page.waitForTimeout(400);
await page.click('#begin');
await page.waitForFunction(() => window.__gametool.state === 'play');
await page.waitForTimeout(500);

check('A practice table stands by the dojo mats and can be used', await G(page, () => window.__gametool.interactables.some((i) => i.obj.name === 'skill-table' && i.verb() === 'Practise a real skill')));
check('The living map marks the practice table', await G(page, () => window.__gametool.livingMap.marks().some((m) => m.label === 'Practice table')));
await G(page, () => window.__gametool.openSkills());
await page.waitForTimeout(300);
check('First visit: the safety note comes before any skill', await G(page, () => window.__gametool.state === 'forge' && /emergency number/.test(document.querySelector('#skills .dj-disclaimer')?.textContent ?? '') && !document.querySelector('#skills [data-skill]')));
await page.click('#skAck');
const list = await G(page, () => [...document.querySelectorAll('#skills [data-skill]')].map((b) => b.dataset.skill));
check('Then three skills: knots, first aid, fire craft', list.join() === 'knots,firstaid,fire', list.join());

// Knots: two order rounds. A wrong step is explained and nothing is placed.
await page.click('#skills [data-skill="knots"]');
const firstWrong = await G(page, () => { const b = [...document.querySelectorAll('#skills [data-step]')].find((e) => e.dataset.step !== '0'); b.click(); return { note: document.querySelector('#skills .sk-note')?.textContent, placed: window.__gametool.skills.placed }; });
check('Order round: a step out of order gets a hint and is not placed', /Not first/.test(firstWrong.note ?? '') && firstWrong.placed === 0, JSON.stringify(firstWrong));
await frames(page, 4);
await page.screenshot({ path: path.join(shots, 'b19-knots.png') });
const solveOrder = () => G(page, () => { let i = 0; for (;;) { const b = document.querySelector(`#skills [data-step="${window.__gametool.skills.placed}"]`); if (!b || ++i > 20) break; b.click(); } });
const before = await G(page, () => window.__gametool.inventory.count('crown'));
await solveOrder(); await solveOrder();
const knots = await G(page, () => ({ card: !!window.__gametool.skills.st.cards.knots, shown: !!document.querySelector('#skills .sk-card'), crowns: window.__gametool.inventory.count('crown') }));
check('Both knot rounds in order: the Knots card is earned (and pays crowns once)', knots.card && knots.shown && knots.crowns > before, JSON.stringify({ ...knots, before }));

// First aid: an order round, then a pick round where the wrong choices explain themselves.
await page.click('#skBack');
await page.click('#skills [data-skill="firstaid"]');
await solveOrder();
const pick = await G(page, () => {
  const sk = window.__gametool.skills, r = sk.current;
  const ice = sk.options.indexOf('Put ice on it.');
  document.querySelector(`#skills [data-opt="${ice}"]`).click();
  const why = document.querySelector('#skills .sk-note')?.textContent;
  for (const t of r.right) document.querySelector(`#skills [data-opt="${sk.options.indexOf(t)}"]`)?.click();
  return { kind: r.kind, why, card: !!sk.st.cards.firstaid };
});
check('Pick round: "Put ice on it" is wrong and says why; the right three earn the First aid card', pick.kind === 'pick' && /running water/.test(pick.why ?? '') && pick.card, JSON.stringify(pick));
await page.click('#skReal');
check('"I\'ve done this for real" marks the card (honour system)', await G(page, () => window.__gametool.skills.st.cards.firstaid.real === true && /Done for real/.test(document.querySelector('#skReal').textContent)));

// Fire craft.
await page.click('#skBack');
await page.click('#skills [data-skill="fire"]');
await solveOrder(); await solveOrder();
check('Fire craft: lay it, then drown, stir, feel: the Fire craft card', await G(page, () => !!window.__gametool.skills.st.cards.fire));
await page.keyboard.press('Escape');
await page.waitForTimeout(300);
check('Esc leaves the table', await G(page, () => !window.__gametool.skills.isOpen));

// The Skills book in the Journal.
await G(page, () => document.exitPointerLock?.());
await page.waitForTimeout(150);
await page.keyboard.press('Escape');
await page.waitForFunction(() => window.__gametool.state === 'pause', null, { timeout: 3000 }).catch(() => {});
await page.click('#pgSkills');
const book = await G(page, () => ({ cards: document.querySelectorAll('#skillsBook .sk-card:not(.locked)').length, real: document.querySelectorAll('#skillsBook .sk-real').length, text: document.querySelector('#skillsBook').textContent }));
check('Journal → Skills book shows the three cards, one marked done for real', book.cards === 3 && book.real === 1 && /3 of 3 skills learned/.test(book.text), JSON.stringify({ cards: book.cards, real: book.real }));
await page.screenshot({ path: path.join(shots, 'b19-skills-book.png') });
check('Skills are kept on this device (per profile)', await G(page, () => Object.keys(JSON.parse(localStorage.getItem('gametool.skills')).cards).length === 3));
check('No console / page errors', errors.length === 0, errors.join(' | '));

await browser.close();
const passed = results.filter((r) => r.ok).length;
console.log(`\n${passed}/${results.length} checks passed`);
process.exit(passed === results.length ? 0 : 1);
