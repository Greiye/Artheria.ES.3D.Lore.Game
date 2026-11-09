// Before/after screenshot set: the same fixed list of world views and station panels, on desktop, a phone held
// sideways and a phone held upright. Run it on main for "before" and on a branch for "after"; file names match.
// Usage: node scripts/shots.mjs <out-dir> [path/to/index.html] [--only name,name] [--view desktop,phone-wide,phone-tall]   (CHROMIUM_PATH as in the e2e suites)
import { chromium } from 'playwright-core';
import fs from 'node:fs';
import path from 'node:path';

const args = process.argv.slice(2);
const onlyAt = args.indexOf('--only');
const only = onlyAt >= 0 ? args.splice(onlyAt, 2)[1].split(',') : null;
const viewAt = args.indexOf('--view');
const views = viewAt >= 0 ? args.splice(viewAt, 2)[1].split(',') : null;
const out = path.resolve(args[0] ?? 'test/screenshots/shots');
const file = path.resolve(args[1] ?? 'dist/index.html');
fs.mkdirSync(out, { recursive: true });

// World views: `at` is evaluated in the page and returns { x, z, lookX, lookZ } (stand there, face that) or null.
const WORLD = [
  ['spawn', null],
  ['teahouse', 'const f = g.teaFolk[0]; return back(f.stand, f.hit.position, 5)'],
  ['market', 'const f = g.marketFolk[0]; return back(f.stand, f.hit.position, 5)'],
  ['caravan', 'const f = g.caravanFolk[0]; return back(f.stand, f.hit.position, 5)'],
  ['natalie', 'return from(g.natalieRoot, 4)'],
  ['kill-statue', 'return from(g.killStatue.group, 5)'],
  ['coin-table', 'return from(g.world.scene.getObjectByName("coin-table"), 4)'],
  ['wagon', 'return from(g.TOWN_WAGON, 6)'],
  ['portal', 'return from(g.world.scene.getObjectByName("portal"), 5)'],
  ['town-night', 'g.world.setTime("night"); const f = g.teaFolk[0]; return back(f.stand, f.hit.position, 8)'],
];
// Panels: `how` opens one (g = the debug hooks, q = querySelector).
const PANELS = [
  ['casebook', 'g.casebook.open(); setTimeout(() => document.querySelector(".casebook-panel .fp-tab")?.click(), 250)'],
  ['casebook-everyone', 'g.casebook.open(); setTimeout(() => document.querySelectorAll(".casebook-panel .fp-tab")[1]?.click(), 250)'],
  ['casebook-stations', 'g.casebook.open(); setTimeout(() => document.querySelectorAll(".casebook-panel .fp-tab")[2]?.click(), 250)'],
  ['map', 'g.openMap()'],
  ['character-forge', 'g.openCharacterForge()'],
  ['weapon-forge', 'g.openWeaponForge()'],
  ['campfire', 'g.openCampfire()'],
  ['dojo', 'g.openDojo()'],
  ['dojo-drill', 'g.openDojo(); q("#djAck")?.click()'],
  ['shop', 'g.openShop()'],
  ['grindstone', 'g.openGear()'],
  ['skills', 'g.openSkills()'],
  ['sketchbook', 'g.openSketchbook()'],
  ['phrasebook', 'g.openPhrasebook()'],
  ['teahouse-talk', 'g.openTeahouse(g.teaFolk[0].id)'],
  ['market-talk', 'g.openPalengke(g.marketFolk[0].id)'],
  ['caravan-talk', 'g.openCaravan(g.caravanFolk[0].id)'],
  ['coin-table', 'g.openCoinTable()'],
  ['wagon', 'g.openWagon()'],
  ['inventory', 'g.openInventory()'],
  ['wiki', 'g.openWiki()'],
  ['skills-book', 'g.openSkillsBook()'],
  ['recipe-book', 'g.openRecipeBook()'],
  ['fight', 'g.openFight()'],
  ['descend', 'g.openDescend()'],
  ['sky', 'g.openSky()'],
];
const VIEWS = [
  ['desktop', { viewport: { width: 1280, height: 720 } }, true],
  ['phone-wide', { viewport: { width: 844, height: 390 }, hasTouch: true, isMobile: true, deviceScaleFactor: 1 }, false],
  ['phone-tall', { viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true, deviceScaleFactor: 1 }, false],
];

const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH || undefined,
  args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'],
});
const log = [];
const want = (name) => !only || only.some((o) => name.includes(o));

for (const [label, opts, world] of VIEWS) {
  if (views && !views.includes(label)) continue;
  const ctx = await browser.newContext(opts);
  await ctx.addInitScript(() => localStorage.setItem('gametool.character', JSON.stringify({ name: 'Test', motivation: '', secret: '', created: true })));
  const page = await ctx.newPage();
  page.on('pageerror', (e) => log.push(`${label}: page error: ${e.message}`));
  await page.route(/^https?:/, (r) => r.abort());
  await page.goto('file://' + file);
  await page.waitForFunction(() => window.__gametool, null, { timeout: 90000 });
  await page.evaluate(() => document.querySelector('#begin').click());
  await page.waitForFunction(() => window.__gametool.state === 'play', null, { timeout: 60000 });
  await page.evaluate(() => window.__gametool.world.setTime?.('day'));
  await page.waitForTimeout(1500);
  const shot = async (name) => { await page.screenshot({ path: path.join(out, `${label}_${name}.png`) }); console.log(`shot  ${label}_${name}`); };
  const toPlay = () => page.evaluate(async () => {
    const g = window.__gametool, esc = () => window.dispatchEvent(new KeyboardEvent('keydown', { code: 'Escape', key: 'Escape' }));
    g.cook?.close?.(); g.campfire?.close?.(); esc();
    for (let i = 0; i < 40 && g.state !== 'play'; i++) {
      if (g.state === 'pause') document.querySelector('#resume')?.click(); else esc();
      await new Promise((r) => setTimeout(r, 100));
    }
    return g.state;
  });

  for (const [name, at] of world ? WORLD : [WORLD[0]]) {
    if (!want(`world-${name}`)) continue;
    try {
      if (at) {
        const ok = await page.evaluate((src) => {
          const g = window.__gametool;
          const back = (stand, look, d) => { const dx = stand.x - look.x, dz = stand.z - look.z, n = Math.hypot(dx, dz) || 1; return { x: stand.x + (dx / n) * d, z: stand.z + (dz / n) * d, lookX: look.x, lookZ: look.z }; };
          // A spot d metres south-east of a thing (an Object3D, a {x, z}, an [x, z] or something holding one).
          const from = (v, d) => { const p = v?.position ?? v?.root?.position ?? v?.group?.position ?? (Array.isArray(v) ? { x: v[0], z: v[1] } : Array.isArray(v?.at) ? { x: v.at[0], z: v.at[1] } : v?.at ?? v); return p ? { x: p.x + d * 0.7, z: p.z + d * 0.7, lookX: p.x, lookZ: p.z } : null; };
          // eslint-disable-next-line no-new-func
          const p = new Function('g', 'back', 'from', src)(g, back, from);
          if (!p || ![p.x, p.z, p.lookX, p.lookZ].every(Number.isFinite)) return false;
          g.player.pos.set(p.x, 0, p.z);
          g.player.yaw = g.player.bodyYaw = Math.atan2(p.x - p.lookX, p.z - p.lookZ); g.player.pitch = -0.1;
          return true;
        }, at);
        if (!ok) { log.push(`${label}: world-${name}: no position`); continue; }
        await page.waitForTimeout(1800);
      }
      await shot(`world-${name}`);
      if (name === 'town-night') await page.evaluate(() => window.__gametool.world.setTime('day'));
    } catch (e) { log.push(`${label}: world-${name}: ${String(e.message).split('\n')[0]}`); }
  }
  for (const [name, how] of PANELS) {
    if (!want(`panel-${name}`)) continue;
    try {
      await page.evaluate((src) => {
        // eslint-disable-next-line no-new-func
        new Function('g', 'q', src)(window.__gametool, (s) => document.querySelector(s));
      }, how);
      await page.waitForTimeout(900);
      await shot(`panel-${name}`);
    } catch (e) { log.push(`${label}: panel-${name}: ${String(e.message).split('\n')[0]}`); }
    const state = await toPlay().catch(() => '?');
    if (state !== 'play') {   // a mode that Escape doesn't leave (a fight, a flight): reload for a clean start
      await page.reload();
      await page.waitForFunction(() => window.__gametool, null, { timeout: 90000 });
      await page.evaluate(() => (document.querySelector('#continue') ?? document.querySelector('#begin')).click());
      await page.waitForFunction(() => window.__gametool.state === 'play', null, { timeout: 60000 }).catch(() => log.push(`${label}: could not get back to play after ${name}`));
      await page.evaluate(() => window.__gametool.world.setTime?.('day'));
    }
  }
  await ctx.close();
}
await browser.close();
if (log.length) console.log('\nNotes:\n' + log.join('\n'));
