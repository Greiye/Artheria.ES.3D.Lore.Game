// v0.05 part 1 checks: boot splash → title → main menu, version notice, Extras (Inspirations, the evolution
// gallery), save and return to the menu, keyboard rebinding, and retiring at the exit gate.
// Usage: npm run build && node test/e2e-boot.mjs [path/to/index.html]
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
  localStorage.setItem('gametool.character', JSON.stringify({ name: 'Test', motivation: '', secret: '', created: true }));
  if (!localStorage.getItem('e2e.booted')) { localStorage.setItem('gametool.intro', 'on'); localStorage.removeItem('gametool.save'); localStorage.removeItem('gametool.keys'); localStorage.setItem('gametool.version', '0.04'); }
  localStorage.setItem('e2e.booted', '1');   // a fresh context starts empty; sessionStorage on file:// can drop across reloads
});
const page = await ctx.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
await page.goto('file://' + file);
await page.waitForFunction(() => window.__gametool);

// ---------- boot ----------
const titled = await until(page, () => document.querySelector('#intro')?.classList.contains('title-on'), null, 6000);
const splash = await G(page, () => { const i = document.querySelector('#intro'), log = window.__gametool.intro.log; return { text: i.querySelector('.splash').textContent.trim(), svg: !!i.querySelector('.splash svg'), ms: Math.round(log[1][1] - log[0][1]) }; });
const title = await G(page, () => { const i = document.querySelector('#intro'); return { logo: [...i.querySelectorAll('.logo span')].map((e) => e.textContent).join(' '), foot: i.querySelector('.foot').textContent, wall: /^url\("?data:image\/png/.test(getComputedStyle(i.querySelector('.wall')).backgroundImage), anim: getComputedStyle(i.querySelector('.wall')).animationName }; });
check('v0.05 §2.1 splash: book-and-sword icon, "Michael P. Go Presents:", then the title at 1 s', titled && splash.svg && splash.text === 'Michael P. Go Presents:' && splash.ms >= 950, JSON.stringify(splash) + ' (later than 1 s only when software rendering stalls the page)');
check('v0.05 §2.1 title: carved stone wall drifting (pan + zoom), the logo, the prototype notice', title.logo === 'Tales of Artheria' && title.wall && title.anim === 'wallDrift' && title.foot === 'This is a prototype, vibe coded by Michael Go. 2026, All Rights Reserved.', JSON.stringify(title));
await page.keyboard.press('KeyQ');
const menu = await until(page, () => !document.querySelector('#intro') && window.__gametool.state === 'title' && !document.querySelector('#title').classList.contains('hidden'), null, 4000);
check('v0.05 §2.1 any key leaves the title for the main menu', menu);
await G(page, () => localStorage.removeItem('gametool.intro'));   // later loads in this test skip the intro
const note = await G(page, () => document.querySelector('#versionNote').textContent);
check('v0.05 §1.1 version notice on the menu (and says it was updated)', note === 'Tales of Artheria v0.05 | Updated from v0.04', note);
check('v0.05 §2.2 main menu: Begin, Options, Extras', await page.isVisible('#begin') && (await page.textContent('#openSettingsTitle')) === 'Options' && await page.isVisible('#openExtras'));
await page.keyboard.press('ArrowDown');
const focus = await G(page, () => document.activeElement?.id);
check('v0.05 menus work from the keyboard: the arrows move between buttons', !!focus && focus !== 'begin', focus);

// ---------- extras ----------
await page.click('#openExtras');
await page.click('[data-tab="inspirations"]');
const insp = await G(page, () => [...document.querySelectorAll('#extras .insp figcaption')].map((e) => e.textContent));
check('v0.05 Extras → Inspirations: the four people', JSON.stringify(insp) === JSON.stringify(['Jason Molina', 'Vanessa Escalambre', 'Revlis Go', 'Little Miguel']), insp.join(', '));
await page.click('[data-act="back"]');
await page.click('[data-tab="evolution"]');
await until(page, () => document.querySelector('#extras .evo-count')?.textContent === '1 / ' + window.__gametool.extras.shots.length, null, 4000);
const evo = await G(page, () => ({ n: window.__gametool.extras.shots.length, first: document.querySelector('#extras .evo figcaption b').textContent }));
await page.keyboard.press('ArrowRight');
await page.keyboard.press('ArrowRight');
const two = await until(page, () => window.__gametool.extras.index === 2 && document.querySelector('#extras .evo-count').textContent.startsWith('3 /'), null, 4000);
const img = await until(page, () => { const im = document.querySelectorAll('#extras .evo img')[2]; return im && im.complete && im.naturalWidth > 0; }, null, 8000);
await G(page, () => window.__gametool.menuInput('left'));
const back1 = await G(page, () => window.__gametool.extras.index === 1);
check('v0.05 Extras → Evolution: titled screenshots, oldest first; arrows / D-pad page through them', evo.n >= 10 && /^Rebuild R2/.test(evo.first) && two && img && back1, JSON.stringify(evo));
await page.keyboard.press('Escape'); await page.keyboard.press('Escape');
const home = await until(page, () => !window.__gametool.extras.isOpen && window.__gametool.state === 'title' && !document.querySelector('#title').classList.contains('hidden'), null, 3000);
check('v0.05 Esc backs out of Extras to the main menu', home);

// ---------- save and return to the menu ----------
await page.click('#begin');
await page.waitForFunction(() => window.__gametool.state === 'play');
await G(page, () => { const g = window.__gametool; g.player.pos.set(10, 0, 9); g.player.yaw = 1.2; g.world.setTime('night'); g.inventory.give('lute', 1); });
await page.waitForTimeout(200);
await G(page, () => { document.querySelector('#quitToMenu').click(); });
const saved = await until(page, () => window.__gametool.state === 'title' && !document.querySelector('#saveNote').classList.contains('hidden'), null, 4000);
const sv = await G(page, () => JSON.parse(localStorage.getItem('gametool.save')));
check('v0.05 §3.1 pause → "Save and return to the menu" saves and shows the menu', saved && sv?.pos && Math.abs(sv.pos[0] - 10) < 0.5 && sv.time === 'night' && sv.items.some(([id]) => id === 'lute'), JSON.stringify(sv));
await page.reload();
await page.waitForFunction(() => window.__gametool);
const before = await G(page, () => ({ save: !!localStorage.getItem('gametool.save'), state: window.__gametool.state, intro: !!document.querySelector('#intro'), loader: !!document.querySelector('#loader') }));
await page.click('#begin');
await page.waitForFunction(() => window.__gametool.state === 'play');
const resumed = await G(page, () => { const g = window.__gametool; return { x: g.player.pos.x, z: g.player.pos.z, time: g.world.time, lute: g.inventory.count('lute') }; });
check('v0.05 Begin carries on from the save: the spot, the hour and the bag', Math.abs(resumed.x - 10) < 0.5 && Math.abs(resumed.z - 9) < 0.5 && resumed.time === 'night' && resumed.lute === 1, JSON.stringify({ ...resumed, before }));

// ---------- rebinding ----------
await page.keyboard.press('Escape');
await until(page, () => window.__gametool.state === 'pause', null, 3000);
await G(page, () => { document.querySelector('#controlsMap').open = true; });
await page.click('[data-bind="jump"]');
await page.keyboard.press('KeyK');
const rebound = await G(page, () => window.__gametool.binds.jump[0] === 'KeyK' && JSON.parse(localStorage.getItem('gametool.keys')).jump === 'KeyK' && document.querySelector('[data-bind="jump"] kbd').textContent === 'K');
await page.click('#resume');
await until(page, () => window.__gametool.state === 'play' || window.__gametool.state === 'resume', null, 3000);
if (await G(page, () => window.__gametool.state === 'resume')) await page.click('#relockBtn');
await until(page, () => window.__gametool.state === 'play', null, 5000);
await G(page, () => { const p = window.__gametool.player; p.pos.set(0, 0, 8); });
await page.waitForTimeout(300);
// Frame-based, not wall-clock: CI software rendering can run at a few frames a second.
await page.keyboard.down('KeyK');
const jumped = await until(page, () => window.__gametool.player.pos.y > 0.5, null, 8000);
await page.keyboard.up('KeyK');
check('v0.05 §3.1 Controls: rebind a key (Jump → K), saved, and it works in play', rebound && jumped, jumped ? 'jumped' : 'no jump');
await G(page, () => { window.__gametool.binds.jump[0] = 'Space'; localStorage.removeItem('gametool.keys'); });

// ---------- exit gate ----------
const sign = await G(page, () => !!window.__gametool.world.scene.getObjectByName('town-signs'));
const walkWest = async () => {
  await G(page, () => { const p = window.__gametool.player; p.pos.set(-39.4, 0, -4); p.yaw = Math.PI / 2; p.bodyYaw = p.yaw; });
  await page.keyboard.down('KeyW');
  const ok = await until(page, () => window.__gametool.gateOpen && !document.querySelector('#gateConfirm').classList.contains('hidden'), null, 8000);
  await page.keyboard.up('KeyW');
  return ok;
};
const asked = await walkWest();
const prompt = await G(page, () => document.querySelector('#gateConfirm').textContent.replace(/\s+/g, ' '));
await page.click('#gateNo');
const stayed = await until(page, () => !window.__gametool.gateOpen && window.__gametool.player.pos.x > -41, null, 3000);
check('v0.05 §3.2 the exit gate ("Temporary Exit - Mind the dust") asks "Leave the area? This will retire you."; No keeps you in', sign && asked && /Temporary Exit - Mind the dust/.test(prompt) && /Leave the area\?/.test(prompt) && /This will retire you\./.test(prompt) && stayed, prompt.slice(0, 120));
await until(page, () => window.__gametool.state === 'play' || window.__gametool.state === 'resume', null, 3000);
if (await G(page, () => window.__gametool.state === 'resume')) await page.click('#relockBtn');
await walkWest();
await page.click('#gateYes');
const retired = await until(page, () => window.__gametool.state === 'title', null, 3000);
const rs = await G(page, () => JSON.parse(localStorage.getItem('gametool.save')));
check('v0.05 §3.2 Yes retires: the bag is saved, the spot is not, and you are back at the menu', retired && rs && rs.pos === null && rs.items.some(([id]) => id === 'lute'), JSON.stringify(rs));

check('v0.05 boot: no console/page errors', errors.length === 0, errors.join(' | '));
await browser.close();
const failed = results.filter((r) => !r.ok).length;
console.log(`\n${results.length - failed}/${results.length} checks passed`);
process.exit(failed ? 1 : 0);
