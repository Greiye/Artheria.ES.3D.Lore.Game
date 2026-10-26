// Phase B checks: B4 character forge, B5 weapon forge, B6 constraint dice, curated submit sheet.
// Usage: npm run build && node test/e2e-forge.mjs [path/to/index.html]
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
  p.pos.set(c.x + 1.3, 0, c.z + 0.4);
  const d = new g.Vector3(c.x - p.pos.x, c.y - 1.7, c.z - p.pos.z);
  p.yaw = Math.atan2(-d.x, -d.z); p.pitch = Math.atan2(d.y, Math.hypot(d.x, d.z));
}, name);
const verbIs = (w) => until(page, (want) => document.getElementById('promptVerb').textContent === want && !document.getElementById('prompt').classList.contains('hidden'), w);
const vcount = () => G(page, () => window.__gametool.player.body.children[0].userData.rig.mesh.geometry.attributes.position.count);

// ---------- B4 character forge ----------
await aimAt('mirror');
check('B4 the camp mirror offers "Change your look"', await verbIs('Change your look'));
await page.keyboard.press('KeyE');
check('B4 E on the mirror opens the character forge', await until(page, () => window.__gametool.state === 'forge' && !document.getElementById('forge').classList.contains('hidden')));
check('B4 the forge frames the player (camera shot, body shown)', await until(page, () => window.__gametool.rig.inShot && window.__gametool.player.body.visible));
const humanVerts = await vcount();
await page.click('#forge [data-f="species"][data-v="infernling"]');
const inf = await until(page, (h) => window.__gametool.player.body.children[0].userData.rig.mesh.geometry.attributes.position.count > h, humanVerts);
check('B4 picking Infernling rebuilds the live figure with horns and a tail', inf);
await page.click('#forge [data-f="hairStyle"][data-v="topknot"]');
await page.click('#forge [data-f="primary"][data-v="#A8423A"]');
await page.fill('#fgName', 'Kazka Test');
await page.fill('#fgStory', 'Born under a grey sky.');

// ---------- B6 constraint dice ----------
await page.click('#fgRoll');
const dice = await G(page, () => [...document.querySelectorAll('#forge .die')].map((d) => d.textContent));
check('B6 rolling shows three dice: a word, a mood and a rule', dice.length === 3 && /^word/.test(dice[0]) && /^mood/.test(dice[1]) && /^rule/.test(dice[2]), JSON.stringify(dice));
await page.click('#forge [data-die="word"]'); await page.click('#forge [data-die="mood"]');
const before = await G(page, () => document.querySelector('#forge .dice-row .fine').textContent);
await page.click('#forge [data-die="rule"]');
const after = await G(page, () => [...document.querySelectorAll('#forge .die')].map((d) => d.textContent).join('|'));
const after2 = await G(page, () => { document.querySelector('#forge [data-die="rule"]').click(); return [...document.querySelectorAll('#forge .die')].map((d) => d.textContent).join('|'); });
check('B6 two rerolls, then the dice are fixed', /0 left/.test(before) && after === after2, before);
check('B6 typed name and story survive re-rendering the panel', await G(page, () => document.getElementById('fgName').value === 'Kazka Test' && document.getElementById('fgStory').value === 'Born under a grey sky.'));

// ---------- curated submit ----------
await page.click('#fgSubmit');
const sheet = await G(page, () => {
  const a = document.querySelector('.submit-sheet [data-act=issue]');
  const body = decodeURIComponent(new URL(a.href).searchParams.get('body'));
  return { host: new URL(a.href).host, path: new URL(a.href).pathname, body };
});
check('Submit opens a pre-filled GitHub issue for review (nothing is published directly)', sheet.host === 'github.com' && sheet.path === '/Greiye/Artheria.ES.3D.Lore.Game/issues/new', sheet.path);
check('Submit carries a valid character entry with the forged look', /type: character/.test(sheet.body) && /title: "Kazka Test"/.test(sheet.body) && /look: "species=infernling; /.test(sheet.body) && /hairStyle=topknot/.test(sheet.body) && /Forged under the dice/.test(sheet.body));
await page.click('.submit-sheet [data-act=close]');
await page.click('#fgDone');
check('B4 Done closes the forge and returns to play', await until(page, () => window.__gametool.state === 'play' || window.__gametool.state === 'resume'));
check('B4 the forged character is saved on this device', await G(page, () => { const c = JSON.parse(localStorage.getItem('gametool.forge.character')); return c.look.species === 'infernling' && c.name === 'Kazka Test' && JSON.parse(localStorage.getItem('gametool.character')).name === 'Kazka Test'; }));
const infVerts = await vcount();

// ---------- B5 weapon forge ----------
if (await G(page, () => window.__gametool.state === 'resume')) await page.click('#relockBtn');
await until(page, () => window.__gametool.state === 'play');
await aimAt('anvil');
check('B5 the anvil asks for a crossbow first', await verbIs('Anvil (bring a crossbow)'));
await G(page, () => window.__gametool.inventory.give('crossbow', 1));
check('B5 with a crossbow, the anvil offers the forge', await verbIs('Forge your crossbow'));
await page.keyboard.press('KeyE');
check('B5 E on the anvil opens the weapon forge', await until(page, () => window.__gametool.state === 'forge' && window.__gametool.weaponForge.isOpen));
await page.click('#weaponForge [data-k="limbs"][data-v="recurve"]');
await page.click('#weaponForge [data-k="stockMat"][data-v="bone"]');
await page.fill('#wfEngrave', 'Aim twice'); await page.dispatchEvent('#wfEngrave', 'change');
await page.fill('#wfName', 'Second Thoughts');
await page.keyboard.press('Escape');
check('B5 Esc closes the weapon forge', await until(page, () => window.__gametool.state !== 'forge'));
check('B5 the held crossbow now has the forged parts and engraving', await G(page, () => { const v = window.__gametool.crossbow.viewmodel; return !!v.getObjectByName('engraving') && !!v.getObjectByName('loadedBolt') && JSON.parse(localStorage.getItem('gametool.forge.weapon')).limbs === 'recurve'; }));

// ---------- persistence across a reload ----------
await page.reload();
await page.waitForFunction(() => window.__gametool);
check('B4/B5 the forged look and crossbow come back after a reload', (await vcount()) === infVerts && await G(page, () => !!window.__gametool.crossbow.viewmodel.getObjectByName('engraving')), `${await vcount()} vs ${infVerts}`);

check('Forge: no console/page errors', errors.length === 0, errors.join(' | '));
await browser.close();
const failed = results.filter((r) => !r.ok).length;
console.log(`\n${results.length - failed}/${results.length} checks passed`);
process.exit(failed ? 1 : 0);
