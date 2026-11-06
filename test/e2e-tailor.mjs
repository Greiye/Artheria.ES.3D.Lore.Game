// B22 (Mike 2026-11-01): the tailor is the Tailor & Barber-Surgeon. Since Mike 2026-11-04 ("The extra tabs") the character
// forge has nine tabs so each fits a phone: Who you are, Secret, Backstory, Body, Barber (hair), Face (skin, eyes), Tailor
// (colours), Outfit (cut, wings, headpiece) and Surgeon (markings, plus the first-aid card).
// The Journal's "Who you are" opens it on that tab; the town sign and door say the new name.
// Usage: node test/e2e-tailor.mjs [path/to/index.html]   (CHROMIUM_PATH as in e2e.mjs)
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
const tab = async (name) => { await page.waitForSelector('#forge .fp-tab'); await page.locator('#forge .fp-tab', { hasText: name }).first().click(); };

const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 } });
const page = await ctx.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
await page.route(/^https?:/, (r) => r.abort());
await page.goto('file://' + file);
await page.waitForFunction(() => window.__gametool, null, { timeout: 90000 });
await G(page, () => document.querySelector('#begin').click());
await page.waitForFunction(() => window.__gametool.state === 'play', null, { timeout: 60000 });

check('The town calls it the Tailor & Barber-Surgeon', await G(page, () => window.__gametool.interactables.some((i) => { try { return i.verb() === 'Enter the Tailor & Barber-Surgeon'; } catch { return false; } })));
await G(page, () => window.__gametool.townAct.tailor());
await page.waitForSelector('#forge .fp-tab');
const tabs = await G(page, () => ({ eyebrow: document.querySelector('#forge .eyebrow').textContent, tabs: [...document.querySelectorAll('#forge .fp-tab')].map((b) => b.textContent) }));
check('Ten tabs: Profession (Mike 2026-11-06), Who you are, Secret, Backstory, Body, Barber, Face, Tailor, Outfit, Surgeon', tabs.eyebrow === 'Tailor & Barber-Surgeon' && tabs.tabs.join() === 'Profession,Who you are,Secret,Backstory,Body,Barber,Face,Tailor,Outfit,Surgeon', JSON.stringify(tabs));
await tab('Barber');
check('Barber: hair styles and colours', await G(page, () => !!document.querySelector('#forge section:not(.fp-hide) [data-f="hairStyle"]') && !!document.querySelector('#forge section:not(.fp-hide) [data-f="hair"]') && !document.querySelector('#forge section:not(.fp-hide) [data-f="primary"]')));
await page.click('#forge [data-f="hairStyle"][data-v="topknot"]');
await tab('Face');
check('Face: skin and eyes', await G(page, () => !!document.querySelector('#forge section:not(.fp-hide) [data-f="skin"]') && !!document.querySelector('#forge section:not(.fp-hide) [data-f="eyeStyle"]')));
await tab('Tailor');
check('Tailor: the clothes colours', await G(page, () => !!document.querySelector('#forge section:not(.fp-hide) [data-f="primary"]') && !!document.querySelector('#forge section:not(.fp-hide) [data-f="boots"]')));
await tab('Outfit');
check('Outfit: the cut, wings and headpiece', await G(page, () => !!document.querySelector('#forge section:not(.fp-hide) #fgDress') && !!document.querySelector('#forge section:not(.fp-hide) [data-f="wings"]')));
await tab('Surgeon');
const surg = await G(page, () => { const s = document.querySelector('#forge section:not(.fp-hide)'); return { marks: !!s.querySelector('[data-f="marks"]'), aid: s.querySelectorAll('.fg-aid li').length, text: s.textContent }; });
check('Surgeon: markings, and the first-aid card with its safety line', surg.marks && surg.aid === 2 && /cool running water/i.test(surg.text) && /emergency number/.test(surg.text), JSON.stringify({ ...surg, text: surg.text.slice(0, 80) }));
await page.click('#forge [data-f="marks"][data-v="#3A8AC8"]');
await page.screenshot({ path: path.join(shots, 'b22-surgeon.png') });
await tab('Who you are');
await page.fill('#fgName', 'Rill');
await page.fill('#fgMotivation', 'To hear the bell again.');
await tab('Secret');
await page.fill('#fgSecret', 'The bell was never cast here.');
await page.screenshot({ path: path.join(shots, 'b22-who.png') });
await page.click('#fgDone');
await page.waitForFunction(() => window.__gametool.state !== 'forge', null, { timeout: 10000 });
const ch = await G(page, () => ({ c: window.__gametool.character, f: JSON.parse(localStorage.getItem('gametool.forge.character')) }));
check('Done keeps "Who you are" on your character, and the look in the forge save', ch.c.name === 'Rill' && ch.c.motivation === 'To hear the bell again.' && ch.c.secret === 'The bell was never cast here.' && ch.f.look.hairStyle === 'topknot' && ch.f.look.marks === '#3A8AC8', JSON.stringify(ch.c));

// The Journal's "Who you are" opens it on that tab, with the answers filled in.
await page.keyboard.press('Escape');
await page.waitForFunction(() => window.__gametool.state === 'pause' || window.__gametool.state === 'resume', null, { timeout: 5000 }).catch(() => {});
if (await G(page, () => window.__gametool.state !== 'pause')) { await G(page, () => document.querySelector('#relockBtn')?.click()); await page.keyboard.press('Escape'); await page.waitForTimeout(300); }
await page.click('#pgSelf');
const who = await page.waitForFunction(() => window.__gametool.characterForge.isOpen && document.querySelector('#forge .fp-tab.on')?.textContent === 'Who you are' && document.querySelector('#fgMotivation')?.value === 'To hear the bell again.', null, { timeout: 8000 }).then(() => true, () => false);
check('Journal → Who you are opens the tailor on that tab, answers filled in', who);
check('The old pop-up form is gone', await G(page, () => !document.getElementById('charcreate')));
check('No console / page errors', errors.length === 0, errors.join(' | '));

await browser.close();
const passed = results.filter((r) => r.ok).length;
console.log(`\n${passed}/${results.length} checks passed`);
process.exit(passed === results.length ? 0 : 1);
