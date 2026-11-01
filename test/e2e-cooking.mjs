// B18 (Mike 2026-11-01): cooking at the campfire. Prep in order, the right heat, take it off in the gold band, finish;
// a meal buff; the real recipe in the Journal's Recipe book; write and submit your own recipe.
// Usage: node test/e2e-cooking.mjs [path/to/index.html]   (CHROMIUM_PATH as in e2e.mjs)
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
const until = (page, fn, arg, timeout = 20000) => page.waitForFunction(fn, arg, { timeout, polling: 100 }).then(() => true, () => false);

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

await G(page, () => window.__gametool.openCampfire());
await until(page, () => window.__gametool.campfire.isOpen);
await G(page, () => window.__gametool.campfire.openSection('cook'));
check('The campfire has a Cook item with "Cook a meal"', await G(page, () => !!document.querySelector('#campfire #cfCook')));
await page.click('#cfCook');
check('Cooking opens the camp kitchen over the fire, kitchen-safety note first', await G(page, () => window.__gametool.cook.isOpen && !window.__gametool.campfire.isOpen && /adult/.test(document.querySelector('#cook .dj-disclaimer')?.textContent ?? '') && !document.querySelector('#cook [data-recipe]')));
await page.click('#ckAck');
const list = await G(page, () => [...document.querySelectorAll('#cook [data-recipe]')].map((b) => b.dataset.recipe));
check('Three real recipes: lentejas, pan flatbread, baked apples', list.join() === 'lentejas,flatbread,apples', list.join());

// Lentejas: prep in order (a wrong step is explained), then the fire.
await page.click('#cook [data-recipe="lentejas"]');
const wrong = await G(page, () => { const b = [...document.querySelectorAll('#cook [data-step]')].find((e) => e.dataset.step !== '0'); b.click(); return { note: window.__gametool.cook.note, placed: window.__gametool.cook.placed }; });
check('Prep: a step out of order gets a hint and is not placed', /Not first/.test(wrong.note) && wrong.placed === 0, JSON.stringify(wrong));
await G(page, () => { let i = 0; for (;;) { const b = document.querySelector(`#cook [data-step="${window.__gametool.cook.placed}"]`); if (!b || ++i > 20) break; b.click(); } });
check('Prep done: on to the fire, with a heat choice and a doneness bar', await G(page, () => window.__gametool.cook.stage === 'fire' && document.querySelectorAll('#cook [data-heat]').length === 3 && !!document.querySelector('#cook .ck-bar')));

// Too hot: it burns, and the right heat is explained.
await page.click('#cook [data-heat="high"]');
await G(page, () => { const c = window.__gametool.cook; for (let i = 0; i < 600 && !c.result; i++) c.update(1 / 60); });
const burnt = await G(page, () => ({ r: window.__gametool.cook.result, note: document.querySelector('#cook .sk-note')?.textContent }));
check('Left on a roaring fire, lentils burn, and the note says why (a gentle simmer)', burnt.r === 'burnt' && /gentle simmer/.test(burnt.note ?? ''), JSON.stringify(burnt));
await page.click('#ckRetry');
await page.click('#cook [data-heat="low"]');
await G(page, () => { const c = window.__gametool.cook; for (let i = 0; i < 2000 && c.done < 45; i++) c.update(1 / 60); });
await page.screenshot({ path: path.join(shots, 'b18-fire.png') });
const c0 = await G(page, () => window.__gametool.inventory.count('crown'));
// Ticked at 60 fps and taken off in the same step (the test machine renders too slowly to time it by frames).
await G(page, () => { const c = window.__gametool.cook; for (let i = 0; i < 2000 && c.done < 70; i++) c.update(1 / 60); document.querySelector('#ckOff').click(); });
check('On embers, taken off in the gold band: cooked just right', await G(page, () => window.__gametool.cook.result === 'good' && window.__gametool.cook.rightHeat && /just right/.test(document.querySelector('#cook .ck-good')?.textContent ?? '')));
await page.click('#ckFinish');
const ate = await G(page, () => { const g = window.__gametool; return { buff: g.cook.buff, learned: !!g.cook.st.learned.lentejas, crowns: g.inventory.count('crown') }; });
check('Finishing it: eaten with the camp (Hearty), the recipe learned, crowns once', ate.buff === 'hearty' && ate.learned && ate.crowns > c0, JSON.stringify({ ...ate, c0 }));
await page.screenshot({ path: path.join(shots, 'b18-eaten.png') });

// Hearty: the next delve starts with 3 extra hearts, then it's used up.
await page.click('#ckClose');
check('"Back to the fire" returns to the campfire', await G(page, () => !window.__gametool.cook.isOpen && window.__gametool.campfire.isOpen));
await G(page, () => window.__gametool.campfire.close());
await page.waitForTimeout(300);
await G(page, () => window.__gametool.enterDungeon(4242));
const hearty = await G(page, () => ({ hp: window.__gametool.delveHp, buff: window.__gametool.cook.buff }));
check('Hearty: the next trip below starts with 13 hearts, and the meal is used up', hearty.hp === 13 && hearty.buff === null, JSON.stringify(hearty));
await G(page, () => window.__gametool.exitDungeon());

// Flatbread: quick feet for 3 minutes.
const quick = await G(page, () => {
  const g = window.__gametool, c = g.cook; c.open(); c.start('flatbread');
  for (let i = 0; i < c.recipe.prep.length; i++) c.tapStep(i);
  c.setHeat('high'); for (let i = 0; i < 2000 && c.done < 77; i++) c.update(1 / 60); c.takeOff(); c.finish(); c.close();
  return { buff: c.buff, learned: !!c.st.learned.flatbread };
});
await until(page, () => window.__gametool.player.buffMul > 1, null, 10000);
check('Pan flatbread: light on your feet (10% faster)', quick.buff === 'quick' && quick.learned && await G(page, () => Math.abs(window.__gametool.player.buffMul - 1.1) < 1e-6), JSON.stringify(quick));

// Baked apples: well fed below (goblin hits do 1 less).
const sturdy = await G(page, () => {
  const g = window.__gametool, c = g.cook; c.open(); c.start('apples');
  for (let i = 0; i < c.recipe.prep.length; i++) c.tapStep(i);
  c.setHeat('medium'); for (let i = 0; i < 2000 && c.done < 75; i++) c.update(1 / 60); c.takeOff(); c.finish(); c.close();
  g.enterDungeon(4242); const s = g.sturdy; g.exitDungeon(); return { s, after: g.sturdy };
});
check('Baked apples: well fed on the next trip below, then it wears off', sturdy.s === true && sturdy.after === false, JSON.stringify(sturdy));
check('One meal at a time: the newest replaces the last', await G(page, () => window.__gametool.cook.buff === null));

// The Recipe book (Journal).
await G(page, () => window.__gametool.openRecipeBook());
await page.waitForTimeout(200);
const book = await G(page, () => ({ cards: document.querySelectorAll('#recipeBook .ck-card').length, text: document.querySelector('#recipeBook').textContent }));
check('Journal → Recipe book writes out all three recipes in full (ingredients, method, safety)', book.cards === 3 && /3 of 3 recipes cooked/.test(book.text) && /red lentils/.test(book.text) && /oven glove/.test(book.text), JSON.stringify({ cards: book.cards }));
await page.screenshot({ path: path.join(shots, 'b18-recipe-book.png') });
await page.click('#rbWrite');
await page.fill('#rbTitle', 'Oat cakes');
await page.fill('#rbIng', 'Oats\nWater\nSalt');
await page.fill('#rbMethod', 'Mix, press flat and cook on a griddle until crisp.');
await page.click('#rbSubmit');
const sheet = await G(page, () => { const s = document.querySelector('.submit-sheet'); return s ? s.textContent : null; });
check('"Write your own recipe" turns it into a lore file to submit', !!sheet && /Oat cakes/.test(sheet), (sheet ?? '').slice(0, 120));
await G(page, () => document.querySelector('.submit-sheet')?.remove());
await G(page, () => window.__gametool.recipeBook.close());
check('Cooking is kept on this device (per profile)', await G(page, () => Object.keys(JSON.parse(localStorage.getItem('gametool.cooking')).learned).length === 3));
check('No console / page errors', errors.length === 0, errors.join(' | '));

await browser.close();
const passed = results.filter((r) => r.ok).length;
console.log(`\n${passed}/${results.length} checks passed`);
process.exit(passed === results.length ? 0 : 1);
