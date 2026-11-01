// B17 (Mike 2026-11-01): gear care at the smith's grindstone. Sword hits dull the edge, a delve rusts it, bolts fray the
// string; sharpen (hold the angle), clean and oil, restring. All three once = the Gear care card in the Skills book.
// Usage: node test/e2e-gear.mjs [path/to/index.html]   (CHROMIUM_PATH as in e2e.mjs)
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
const until = (page, fn, arg, timeout = 60000) => page.waitForFunction(fn, arg, { timeout, polling: 100 }).then(() => true, () => false);

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
await page.waitForTimeout(400);

check('A grindstone stands outside the smithy: "Care for your gear"', await G(page, () => window.__gametool.interactables.some((i) => i.obj.name === 'grindstone' && i.verb() === 'Care for your gear')));
check('The living map marks the grindstone', await G(page, () => window.__gametool.livingMap.marks().some((m) => m.label === 'Grindstone')));

await G(page, () => window.__gametool.openGear());
await page.waitForTimeout(200);
check('First visit: the knife-safety note comes first', await G(page, () => window.__gametool.state === 'forge' && /adult/.test(document.querySelector('#gear .dj-disclaimer')?.textContent ?? '') && /fingers behind the edge/.test(document.querySelector('#gear .dj-safety')?.textContent ?? '') && !document.querySelector('#gear [data-job]')));
await page.click('#gAck');
check('Without a sword or crossbow, every job is greyed out', await G(page, () => [...document.querySelectorAll('#gear [data-job]')].every((b) => b.disabled)));
await page.click('#gClose');
await page.waitForTimeout(200);

// Wear: hits dull the blade, and it shows.
const worn = await G(page, () => {
  const g = window.__gametool; g.inventory.give('sword', 1); g.sword.equip();
  const k0 = g.sword.sharpness;
  g.gear.wearSword(15);
  const blade = g.sword.held.getObjectByName('blade').material.color.getHexString(), edge = g.sword.held.getObjectByName('edge').visible;
  return { k0, k1: +g.sword.sharpness.toFixed(2), sharp: +g.gear.st.sharp.toFixed(2), blade, edge };
});
check('Sword hits dull the edge: it cuts for less, the steel greys and the bright edge goes', worn.k0 === 1 && worn.k1 < 0.45 && worn.sharp === 0.4 && worn.blade !== 'c4c8ce' && !worn.edge, JSON.stringify(worn));

// Sharpen: hold the angle in the band for eight strokes.
await G(page, () => window.__gametool.openGear());
await page.waitForTimeout(200);
await page.click('#gear [data-job="sharpen"]');
check('Sharpen shows the angle gauge and a Lift button', await G(page, () => !!document.querySelector('#gear .g-gauge') && !!document.querySelector('#gHold')));
// Hold it too steep for one stroke.
await G(page, () => { const g = window.__gametool.gear; const f = () => { if (g.job === 'sharpen' && g.stroke < 1) { g.angle = 32; requestAnimationFrame(f); } }; f(); });
await until(page, () => window.__gametool.gear.stroke >= 1);
check('A stroke held too steep is called out', await G(page, () => /too steep/.test(window.__gametool.gear.note)), await G(page, () => window.__gametool.gear.note));
await page.screenshot({ path: path.join(shots, 'b17-sharpen.png') });
// Seven strokes held in the band, ticked at 60 fps (the test machine renders too slowly to steer by frames).
await G(page, () => { const g = window.__gametool.gear; for (let i = 0; i < 2000 && g.job === 'sharpen'; i++) { g.angle = 17.5; g.holding = i % 2 === 0; g.update(1 / 60); } });
const sharp = await G(page, () => { const g = window.__gametool; return { good: g.gear.good, sharp: +g.gear.st.sharp.toFixed(2), k: +g.sword.sharpness.toFixed(2), done: !!g.gear.st.done.sharpen, edge: g.sword.held.getObjectByName('edge').visible }; });
check('Clean strokes in the band bring the edge back (keen, full damage, bright edge)', sharp.good >= 5 && sharp.sharp === 1 && sharp.k === 1 && sharp.done && sharp.edge, JSON.stringify(sharp));

// Rust: a delve where the sword was used leaves rust; clean and oil takes it off.
await page.click('#gClose');
await page.waitForTimeout(200);
await G(page, () => { const g = window.__gametool; g.enterDungeon(4242); g.sword.hits++; g.exitDungeon(); });
const rust = await G(page, () => { const g = window.__gametool; return { rust: g.gear.st.rust, k: +g.sword.sharpness.toFixed(2), blade: g.sword.held.getObjectByName('blade').material.color.getHexString() }; });
check('Using the sword below leaves it rusty (browner, cuts for less)', rust.rust === 0.25 && rust.k < 1 && rust.blade !== 'c4c8ce', JSON.stringify(rust));
await G(page, () => window.__gametool.openGear());
await page.waitForTimeout(200);
await page.click('#gear [data-job="oil"]');
const wrong = await G(page, () => { const b = [...document.querySelectorAll('#gear [data-step]')].find((e) => e.dataset.step !== '0'); b.click(); return window.__gametool.gear.note; });
check('Clean and oil: a step out of order gets a hint', /Not first/.test(wrong), wrong);
const solve = () => G(page, () => { let i = 0; for (;;) { const b = document.querySelector(`#gear [data-step="${window.__gametool.gear.placed}"]`); if (!b || ++i > 20) break; b.click(); } });
await solve();
check('In order: the rust is gone', await G(page, () => window.__gametool.gear.st.rust === 0 && window.__gametool.sword.sharpness === 1 && !!window.__gametool.gear.st.done.oil));

// String: bolts fray it; a frayed string throws slower; restring fixes it.
await page.click('#gClose');
await page.waitForTimeout(200);
const fray = await G(page, () => { const g = window.__gametool; g.inventory.give('crossbow', 1); for (let i = 0; i < 20; i++) g.gear.wearString(); return { s: +g.gear.st.string.toFixed(2), p: g.crossbow.power }; });
await G(page, () => window.__gametool.crossbow.equip());
await until(page, () => /Bolts/.test(document.querySelector('#ammoText').textContent), null, 20000);
const hud = await G(page, () => document.querySelector('#ammoText').textContent);
check('Loosed bolts fray the string: less power, and the ammo line says so', fray.s < 0.5 && fray.p === 0.75 && /string frayed/.test(hud), JSON.stringify({ ...fray, hud }));
await G(page, () => window.__gametool.crossbow.unequip());
const c0 = await G(page, () => window.__gametool.inventory.count('crown'));
await G(page, () => window.__gametool.openGear());
await page.waitForTimeout(200);
await page.click('#gear [data-job="string"]');
await solve();
const card = await G(page, () => { const g = window.__gametool; return { s: g.gear.st.string, p: g.crossbow.power, card: !!g.gear.st.card, shown: !!document.querySelector('#gear .gear-card'), crowns: g.inventory.count('crown') }; });
check('Restring: full power; all three jobs done earn the Gear care card (and crowns, once)', card.s === 1 && card.p === 1 && card.card && card.shown && card.crowns > c0, JSON.stringify({ ...card, c0 }));
await page.screenshot({ path: path.join(shots, 'b17-card.png') });
await page.keyboard.press('Escape');
await page.waitForTimeout(300);
check('Esc leaves the grindstone', await G(page, () => !window.__gametool.gear.isOpen && window.__gametool.state !== 'forge'));

// The Skills book shows the card.
await G(page, () => window.__gametool.openSkillsBook());
await page.waitForTimeout(200);
check('Journal → Skills book shows the Gear care card', await G(page, () => !!document.querySelector('#skillsBook .gear-card')));
await G(page, () => window.__gametool.skillsBook.close());
check('Gear condition is kept on this device (per profile)', await G(page, () => { const v = JSON.parse(localStorage.getItem('gametool.gear')); return v.sharp === 1 && v.rust === 0 && v.string === 1 && !!v.card; }));
check('No console / page errors', errors.length === 0, errors.join(' | '));

await browser.close();
const passed = results.filter((r) => r.ok).length;
console.log(`\n${passed}/${results.length} checks passed`);
process.exit(passed === results.length ? 0 : 1);
