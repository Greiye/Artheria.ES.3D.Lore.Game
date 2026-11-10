// Lore-first round, item 3 (Mike 2026-11-05): friends come back to this for years, so their saves must keep
// opening. A profile saved by v0.16 (test/fixtures/profile-v0.16.json, never edit it: add a newer fixture instead)
// must load and carry on; every profile is stamped with the data version; a full backup restores everything.
// Usage: node test/e2e-longevity.mjs [path/to/index.html]   (CHROMIUM_PATH as in e2e.mjs)
import { chromium } from 'playwright-core';
import path from 'node:path';
import fs from 'node:fs';

const file = path.resolve(process.argv[2] ?? 'dist/index.html');
const fixtureText = fs.readFileSync(new URL('./fixtures/profile-v0.16.json', import.meta.url), 'utf8');
const fixture = JSON.parse(fixtureText);
const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH || undefined,
  args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'],
});
const results = [];
const check = (id, ok, detail = '') => { results.push({ id, ok }); console.log(`${ok ? 'PASS' : 'FAIL'}  ${id}${detail ? '  — ' + detail : ''}`); };
const ctx = await browser.newContext({ viewport: { width: 960, height: 540 }, acceptDownloads: true });
const page = await ctx.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
await page.route(/^https?:/, (r) => r.abort());
const boot = async () => { await page.waitForFunction(() => window.__gametool, null, { timeout: 90000 }); await page.waitForTimeout(300); };

// An old device: the v0.16 profile is live, another waits in slot 2, and there is no data-version stamp yet.
await page.goto('file://' + file);
await boot();
await page.evaluate((d) => {
  localStorage.clear();
  for (const [k, v] of Object.entries(d)) localStorage.setItem(k, v);
  localStorage.setItem('gametool~slot.1', JSON.stringify(d));
  // A friend part-way through the first day under the old four steps (step 2 was "make").
  localStorage.setItem('gametool~slot.2', JSON.stringify({ ...d, 'gametool.firstday': JSON.stringify({ step: 2, done: false }) }));
  localStorage.setItem('gametool.intro', '1');
}, fixture.data);
await page.reload();
await boot();
const stamp = await page.evaluate(() => localStorage.getItem('gametool~datav'));
const mid = await page.evaluate(() => JSON.parse(JSON.parse(localStorage.getItem('gametool~slot.2'))['gametool.firstday']));
check('Old saves are upgraded on boot and stamped with the data version', Number(stamp) >= 2, `datav=${stamp}`);
check('Upgrade 1→2: a first day part-way through keeps its place after the new "read" step', mid.step === 3 && !mid.done, JSON.stringify(mid));
const label = await page.textContent('#begin');
check('A v0.16 save still offers Continue', /Continue/.test(label ?? ''), label);
await page.click('#begin');
await page.waitForFunction(() => window.__gametool.state === 'play', null, { timeout: 90000 });
const back = await page.evaluate(() => { const g = window.__gametool; return { x: g.player.pos.x, z: g.player.pos.z, time: g.world.time, lute: g.inventory.count('lute'), crowns: g.inventory.count('crown') }; });
check('A v0.16 save carries on: the spot, the hour and the bag', Math.abs(back.x - 6) < 0.5 && Math.abs(back.z - 7) < 0.5 && back.time === 'sunset' && back.lute === 1, JSON.stringify(back));
const pieces = await page.evaluate(() => window.__gametool.extras.portfolio().pieces.map((p) => p.title));
check('Upgrade 2→3: an old purse is topped up to the starting 500 crowns (Mike 2026-11-09)', back.crowns === 500, JSON.stringify(back));
check("A v0.16 profile's works are all still there", pieces.includes('Old map of the glade'), JSON.stringify(pieces));

// The backup: one file, all three profiles and the settings, never the GitHub token.
await page.evaluate(() => { window.__gametool.quitToMenu?.(); localStorage.setItem('gametool.github', 'secret-token'); });
await page.evaluate(() => { const x = window.__gametool.extras; x.open('profiles'); });
const hasButtons = await page.evaluate(() => !!document.querySelector('#backupAll') && !!document.querySelector('#restoreAll'));
check('Extras → Profiles offers "Back up everything" and "Restore a backup"', hasButtons);
const [dl] = await Promise.all([page.waitForEvent('download'), page.click('#backupAll')]);
const backup = JSON.parse(fs.readFileSync(await dl.path(), 'utf8'));
check('The backup holds every profile and the settings, but not the GitHub token', backup.kind === 'backup' && backup.profiles.length === 3 && backup.profiles[1]['gametool.sketches'] && !JSON.stringify(backup).includes('secret-token') && /^artheria-backup-\d{4}-\d\d-\d\d\.json$/.test(dl.suggestedFilename()), dl.suggestedFilename());
const line = await page.textContent('#backupInfo');
check('The page says when the last backup was', /Last full backup: today/.test(line ?? ''), line);

// Lose everything, then restore the file: every profile comes back.
await page.evaluate(() => { localStorage.clear(); });
await page.reload();
await boot();
await page.evaluate(() => window.__gametool.extras.open('profiles'));
await Promise.all([page.waitForEvent('load'), page.setInputFiles('#backupFile', { name: 'b.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(backup)) })]);
await boot();
const restored = await page.evaluate(() => ({ save: JSON.parse(localStorage.getItem('gametool.save') ?? 'null')?.pos, slot: !!localStorage.getItem('gametool~slot.1'), dv: localStorage.getItem('gametool~datav') }));
check('Restoring the backup brings back every profile', restored.save?.[0] === 6 && restored.save?.[2] === 7 && restored.slot && Number(restored.dv) >= 1, JSON.stringify(restored));

// A profile file exported by v0.16 (no data version inside) imports into an empty slot.
await page.evaluate(() => { localStorage.removeItem('gametool~slot.2'); window.__gametool.extras.open('profiles'); });
await page.evaluate(() => { const f = document.querySelector('#profFile'); f.dataset.slot = '2'; });
await page.setInputFiles('#profFile', { name: 'p.json', mimeType: 'application/json', buffer: Buffer.from(fixtureText) });
await page.waitForFunction(() => !!localStorage.getItem('gametool~slot.2'), null, { timeout: 5000 }).catch(() => {});
const imported = await page.evaluate(() => JSON.parse(localStorage.getItem('gametool~slot.2') ?? '{}')['gametool.sketches']);
check('A v0.16 profile file still imports', !!imported && imported.includes('Old map of the glade'));
check('Longevity: no page errors', errors.length === 0, errors.join(' | '));

await browser.close();
const passed = results.filter((r) => r.ok).length;
console.log(`\n${passed}/${results.length} passed`);
process.exit(passed === results.length ? 0 : 1);
