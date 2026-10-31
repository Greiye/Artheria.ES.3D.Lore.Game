// B24 (Mike 2026-10-31): three profiles on this device, switched from the main menu, with export / import of one
// JSON file per profile. Settings stay shared; the GitHub token never goes into a profile or a file.
// Usage: node test/e2e-profiles.mjs [path/to/index.html]   (CHROMIUM_PATH as in e2e.mjs)
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
const ready = (page) => page.waitForFunction(() => window.__gametool).then(() => page.waitForTimeout(400));

const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 }, acceptDownloads: true });
const page = await ctx.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
await page.route(/^https?:/, (r) => r.abort());
await page.goto('file://' + file);
await ready(page);

// Profile 1: a named hero with a save, plus device settings and a GitHub token.
await G(page, () => {
  localStorage.setItem('gametool.character', JSON.stringify({ name: 'Rill', motivation: '', secret: '', created: true }));
  localStorage.setItem('gametool.save', JSON.stringify({ v: 1, at: Date.now(), pos: null, yaw: 0, time: 'day', items: [['lute', 1]] }));
  localStorage.setItem('gametool.github', JSON.stringify({ token: 'secret-token' }));
});
await page.reload(); await ready(page);
check('Main menu names the loaded profile', (await page.textContent('#openProfiles')) === 'Profile: Rill');
await page.click('#openProfiles');
const rows = await G(page, () => [...document.querySelectorAll('#extras .prof')].map((li) => ({ on: li.classList.contains('on'), head: li.querySelector('.prof-head').textContent })));
check('Profiles page lists three profiles, the first one playing', rows.length === 3 && rows[0].on && /Rill/.test(rows[0].head) && /Playing now/.test(rows[0].head) && /Empty/.test(rows[1].head), JSON.stringify(rows));
await page.screenshot({ path: path.join(shots, 'b24-profiles.png') });

// Export profile 1.
const [dl] = await Promise.all([page.waitForEvent('download'), page.click('.prof[data-slot="0"] [data-act="pexport"]')]);
const exported = JSON.parse(fs.readFileSync(await dl.path(), 'utf8'));
check('Export gives one JSON file with the hero and the save', dl.suggestedFilename() === 'artheria-profile-rill.json' && exported.kind === 'profile' && !!exported.data['gametool.save'] && /Rill/.test(exported.data['gametool.character']), dl.suggestedFilename());
check('Export leaves out device settings and the GitHub token', !('gametool.github' in exported.data) && !('gametool.settings' in exported.data) && !JSON.stringify(exported).includes('secret-token'));

// Switch to the empty profile 2: a fresh start, settings and token kept.
await Promise.all([page.waitForEvent('load'), page.click('.prof[data-slot="1"] [data-act="pplay"]')]);
await ready(page);
const p2 = await G(page, () => ({ label: document.getElementById('openProfiles').textContent, begin: document.getElementById('begin').textContent, save: localStorage.getItem('gametool.save'), gh: localStorage.getItem('gametool.github'), stash: !!localStorage.getItem('gametool~slot.0') }));
check('Switching to an empty profile starts fresh (Begin, no save), keeps the device token, files profile 1 away', p2.label === 'Profile: Profile 2' && p2.begin === 'Begin' && !p2.save && !!p2.gh && p2.stash, JSON.stringify(p2));

// Import profile 1's file into profile 3, then play it.
await page.click('#openProfiles');
// The Import button picks the slot, then opens the file chooser; set the slot the same way here.
await G(page, () => { document.querySelector('#profFile').dataset.slot = '2'; });
await page.setInputFiles('#profFile', { name: 'p.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(exported)) });
await page.waitForFunction(() => /Imported into Rill/.test(document.querySelector('#extras .prof-note')?.textContent ?? ''), null, { timeout: 4000 }).catch(() => {});
check('Import fills another profile from the file', /Rill/.test(await page.textContent('.prof[data-slot="2"] .prof-head')));
await G(page, () => { document.querySelector('#profFile').dataset.slot = '1'; });
await page.setInputFiles('#profFile', { name: 'bad.json', mimeType: 'application/json', buffer: Buffer.from('{"hello":1}') });
await page.waitForTimeout(300);
check('A file that is not a profile is refused with a note', /isn't a Tales of Artheria profile/.test(await page.textContent('#extras .prof-note').catch(() => '')));

await Promise.all([page.waitForEvent('load'), page.click('.prof[data-slot="0"] [data-act="pplay"]')]);
await ready(page);
const back = await G(page, () => ({ label: document.getElementById('openProfiles').textContent, begin: document.getElementById('begin').textContent }));
check('Switching back to profile 1 restores the hero and Continue', back.label === 'Profile: Rill' && back.begin === 'Continue', JSON.stringify(back));

// Clear needs two taps.
await page.click('#openProfiles');
await page.click('.prof[data-slot="2"] [data-act="pclear"]');
const armed = await page.textContent('.prof[data-slot="2"] [data-act="pclear"]');
await page.click('.prof[data-slot="2"] [data-act="pclear"]');
check('Clear asks for a second tap, then empties the profile', armed === 'Tap again to clear' && /Empty/.test(await page.textContent('.prof[data-slot="2"] .prof-head')));
await page.keyboard.press('Escape');
await page.waitForTimeout(200);
check('Esc from Profiles goes back to the main menu', await G(page, () => document.getElementById('extras').classList.contains('hidden') && !document.getElementById('title').classList.contains('hidden')));
check('No console / page errors', errors.length === 0, errors.join(' | '));

await browser.close();
const passed = results.filter((r) => r.ok).length;
console.log(`\n${passed}/${results.length} checks passed`);
process.exit(passed === results.length ? 0 : 1);
