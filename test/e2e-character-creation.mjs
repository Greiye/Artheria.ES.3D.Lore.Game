// Mike 2026-11-06 ("There's no character creation at new game" + "Character Creation: Give character choice of
// profession"): a new hero is made after the wake-up, starting with a profession.
// Usage: npm run build && node test/e2e-character-creation.mjs [path/to/index.html]
import { chromium } from 'playwright-core';
import path from 'node:path';

const file = path.resolve(process.argv[2] ?? 'dist/index.html');
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const results = [];
const check = (id, ok, detail = '') => { results.push({ id, ok }); console.log(`${ok ? 'PASS' : 'FAIL'}  ${id}${detail ? '  — ' + detail : ''}`); };
const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 } });
await ctx.addInitScript(() => { try { localStorage.setItem('gametool.createtest', 'on'); } catch { /* blocked */ } });
const page = await ctx.newPage();
const G = (fn, a) => page.evaluate(fn, a);
const until = (fn, a, timeout = 15000) => page.waitForFunction(fn, a, { timeout, polling: 100 }).then(() => true, () => false);
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
await page.route(/^https?:/, (r) => r.abort());
const boot = async () => {
  await page.goto('file://' + file, { timeout: 180000 });
  await page.waitForFunction(() => window.__gametool, null, { timeout: 180000 });
  await G(() => document.querySelector('#begin').click());
};

// A brand-new hero: after Begin the Tailor & Barber-Surgeon opens on Profession.
await boot();
const opened = await until(() => window.__gametool.characterForge.isOpen, null, 20000);
const first = await G(() => ({ tab: document.querySelector('#forge .fp-tab.on')?.textContent, profs: [...document.querySelectorAll('#forge [data-prof]')].map((b) => b.dataset.prof), welcome: !!document.querySelector('#forge .fg-welcome'), focus: document.activeElement?.tagName }));
check('a new game opens hero-making on the Profession tab', opened && first.tab === 'Profession' && first.welcome, JSON.stringify(first));
check('four professions: fighter, ranger, mage, monk', first.profs.join() === 'fighter,ranger,mage,monk', first.profs.join());
check('no text box grabs focus (no phone keyboard pops up)', first.focus !== 'INPUT' && first.focus !== 'TEXTAREA', first.focus);
await page.screenshot({ path: 'test/screenshots/character-creation.png' });
await page.click('#forge [data-prof="ranger"]');
const picked = await G(() => ({ on: document.querySelector('#forge .fg-prof.on')?.dataset.prof, h: document.querySelector('#forge h2').textContent, tab: document.querySelector('#forge .fp-tab.on')?.textContent }));
check('picking one marks it and names it in the heading, staying on the tab', picked.on === 'ranger' && /Ranger/.test(picked.h) && picked.tab === 'Profession', JSON.stringify(picked));
await page.click('#fgDone');
// Mike 2026-11-06: after a new hero is made, Natalie's scene plays first, then play resumes.
check('Done starts Natalie\'s scene (she watched the creation)', await until(() => window.__gametool.firstMeet.active, null, 15000));
check('Done goes into play once her scene ends', await until(() => window.__gametool.state === 'play' && !window.__gametool.characterForge.isOpen, null, 90000));
const saved = await G(() => JSON.parse(localStorage.getItem('gametool.character')));
check('the profession is saved with the hero', saved.profession === 'ranger' && saved.created, JSON.stringify(saved));
check('the game knows it', await G(() => window.__gametool.character.profession === 'ranger'));

// Next time, no hero-making (a profession is chosen); the tailor still shows it to change.
// Headless file:// pages can lose the last storage writes on a reload (docs/assumptions.md #30): put them back and retry.
const snap = await G(() => ({ ...localStorage }));
for (let attempt = 0; attempt < 5; attempt++) {
  await page.goto('file://' + file, { timeout: 180000 });
  await page.waitForFunction(() => window.__gametool, null, { timeout: 180000 });
  const lost = await G((keys) => keys.filter((k) => localStorage.getItem(k) === null), Object.keys(snap));
  if (!lost.length) break;
  await G((s) => { for (const [k, v] of Object.entries(s)) localStorage.setItem(k, v); }, snap);
}
await G(() => document.querySelector('#begin').click());
await until(() => window.__gametool.state === 'play', null, 60000);
await page.waitForTimeout(1500);
check('a hero with a profession is not asked again', await G(() => !window.__gametool.characterForge.isOpen), JSON.stringify(await G(() => ({ c: window.__gametool.character, ls: localStorage.getItem('gametool.character'), st: window.__gametool.state, creating: window.__gametool.characterForge.creating }))));
await G(() => window.__gametool.townAct.tailor());
await until(() => window.__gametool.characterForge.isOpen);
await page.locator('#forge .fp-tab', { hasText: 'Profession' }).first().click();
check('the tailor shows the chosen profession', await G(() => document.querySelector('#forge .fg-prof.on')?.dataset.prof === 'ranger'));
await page.click('#forge [data-prof="monk"]');
await page.click('#fgDone');
await until(() => !window.__gametool.characterForge.isOpen);
check('and can change it', await G(() => JSON.parse(localStorage.getItem('gametool.character')).profession === 'monk'));

check('no page errors', errors.length === 0, errors.join(' | '));
await browser.close();
const passed = results.filter((r) => r.ok).length;
console.log(`\n${passed}/${results.length} checks passed`);
process.exit(passed === results.length ? 0 : 1);
