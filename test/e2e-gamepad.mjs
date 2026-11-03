// B40 (Mike 2026-11-03): controller everywhere. Every panel works with a pad alone (D-pad / stick moves, A presses,
// left / right change a value, B or Start leaves), cooking over the campfire takes the pad, Y picks up the margin pen,
// hold A sharpens, hold View opens the map (tap: bag), the right stick turns the hero at the tailor, and touch gets a
// shoulder-swap button in the shoulder view.
// Usage: npm run build && node test/e2e-gamepad.mjs [path/to/index.html]   (CHROMIUM_PATH as in e2e.mjs)
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
const until = (page, fn, arg, timeout = 5000) => page.waitForFunction(fn, arg, { timeout, polling: 50 }).then(() => true, () => false);
const frames = (page, n = 3) => G(page, (n) => new Promise((r) => { const f = () => (--n <= 0 ? r() : requestAnimationFrame(f)); requestAnimationFrame(f); }), n);

const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
await ctx.addInitScript(() => {
  localStorage.setItem('gametool.character', JSON.stringify({ name: 'Test', motivation: '', secret: '', created: true }));
  const p = { id: 'Test Pad (STANDARD GAMEPAD)', index: 0, connected: true, mapping: 'standard', timestamp: 0,
    axes: [0, 0, 0, 0], buttons: Array.from({ length: 17 }, () => ({ pressed: false, touched: false, value: 0 })) };
  window.__pad = p; navigator.getGamepads = () => [p, null, null, null];
});
const page = await ctx.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
await page.goto('file://' + file);
await page.waitForFunction(() => window.__gametool, null, { timeout: 90000 });
await page.click('#begin'); await page.mouse.move(5, 5);
await page.waitForFunction(() => window.__gametool.state === 'play', null, { timeout: 60000 });
await G(page, () => window.__gametool.endWake?.());

const A = 0, B = 1, Y = 3, VIEW = 8, START = 9, UP = 12, DOWN = 13, LEFT = 14, RIGHT = 15;
const hold = (i, on) => G(page, ([i, on]) => { window.__pad.buttons[i].pressed = on; window.__pad.buttons[i].value = on ? 1 : 0; }, [i, on]);
const btn = async (i) => { await hold(i, true); await frames(page, 2); await hold(i, false); await frames(page, 2); };
const st = () => G(page, () => window.__gametool.state);
const focus = () => G(page, () => { const a = document.activeElement; let r = a; while (r?.parentElement && r.parentElement !== document.body) r = r.parentElement; return { root: a?.closest('#editor') ? 'editor' : r?.id || '', text: (a?.textContent || a?.getAttribute?.('aria-label') || a?.tagName || '').trim().slice(0, 30), ring: !!a && a !== document.body && a.matches(':focus') && document.body.dataset.input === 'pad' && getComputedStyle(a).outlineStyle !== 'none' }; });
const back2play = async () => { for (let k = 0; k < 4 && (await st()) !== 'play'; k++) { await btn(B); await frames(page, 4); } return (await st()) === 'play'; };
await btn(UP); await btn(UP);   // the pad is the input now (D-pad up in play swaps the shoulder, harmless)

// ---------- hold View = map, tap View = bag ----------
await hold(VIEW, true); await frames(page, 3);
const early = await G(page, () => window.__gametool.livingMap.isOpen);   // not before the 0.4 s
await page.waitForTimeout(500); await until(page, () => window.__gametool.livingMap.isOpen, null, 4000); await hold(VIEW, false); await frames(page, 3);
const mapOpen = await G(page, () => window.__gametool.livingMap.isOpen && window.__gametool.state === 'forge');
const bagAfterHold = await G(page, () => window.__gametool.state === 'inventory');
check('Hold View 0.4 s opens the map (and not the bag)', mapOpen && !bagAfterHold, JSON.stringify({ early, mapOpen, bagAfterHold }));
await btn(DOWN);
const mf = await focus();
check('In the map the D-pad puts the controller on a map control, outlined', mf.root === 'livingMap' && mf.ring, JSON.stringify(mf));
const onText = await G(page, () => document.activeElement?.tagName === 'INPUT');
await btn(B); await frames(page, 4);
const penDown = onText ? await G(page, () => document.activeElement?.tagName !== 'INPUT' && window.__gametool.livingMap.isOpen) : true;
if (onText) { await btn(B); await frames(page, 4); }
check('In a text box the first B only steps out of it', penDown);
const mapShut = await G(page, () => !window.__gametool.livingMap.isOpen && window.__gametool.state === 'play');
check('B leaves the map through its own Close button', mapShut, await st());
await btn(VIEW); await frames(page, 3);
check('A tap on View still opens the bag', (await st()) === 'inventory');
await btn(B); await frames(page, 3);

// ---------- every station: D-pad reaches its controls, B gets you out ----------
const stations = [['openShop', 'shop'], ['openCinema', 'cinema'], ['openDojo', 'dojo'], ['openGear', 'gear'], ['openSketchbook', 'sketchpad'],
  ['openWeaponForge', 'weaponForge'], ['openCharacterForge', 'forge'], ['openRecipeBook', 'recipeBook'], ['openSkillsBook', 'skillsBook'], ['openPhrasebook', 'phrasebook']];
for (const [fn, root] of stations) {
  await G(page, (fn) => window.__gametool[fn](), fn); await frames(page, 3);
  const opened = (await st()) === 'forge';
  await btn(DOWN); await btn(DOWN);
  const f = await focus();
  const out = await back2play();
  check(`${fn}: the D-pad moves inside the panel and B leaves it`, opened && f.root === root && f.ring && out, JSON.stringify({ opened, f, out }));
}

// ---------- A presses, left / right change a value ----------
await G(page, () => window.__gametool.openShop()); await frames(page, 3);
await btn(DOWN);
const f1 = await focus();
await btn(DOWN);
const f2 = await focus();
check('The shop: two D-pad downs move between different rows', f1.root === 'shop' && f2.root === 'shop' && f1.text !== f2.text, JSON.stringify({ f1, f2 }));
await back2play();
await G(page, () => window.__gametool.openCharacterForge()); await frames(page, 3);
const yaw0 = await G(page, () => window.__gametool.player.bodyYaw);
await G(page, () => { window.__pad.axes[2] = 1; }); await frames(page, 10); await G(page, () => { window.__pad.axes[2] = 0; }); await frames(page, 2);
const yaw1 = await G(page, () => window.__gametool.player.bodyYaw);
check('The right stick turns the hero at the tailor', Math.abs(yaw1 - yaw0) > 0.1, `${yaw0.toFixed(2)} → ${yaw1.toFixed(2)}`);
const nudged = await G(page, () => {
  const s = [...document.querySelectorAll('#forge select, #forge input[type=range]')].find((e) => e.offsetParent !== null);
  if (!s) return null;
  s.focus(); return { id: s.id || s.name || s.tagName, v: s.value };
});
if (nudged) {
  await btn(RIGHT);
  const v2 = await G(page, () => document.activeElement.value);
  check('Right on a list or slider changes it', v2 !== nudged.v, JSON.stringify({ nudged, v2 }));
}
await back2play();

// ---------- A presses the focused button ----------
await G(page, () => window.__gametool.openGear()); await frames(page, 3);
await btn(DOWN);
const gf = await focus();
await btn(A); await frames(page, 3);
const gearMoved = await G(page, () => document.querySelector('#gear')?.textContent.slice(0, 60));
check('A presses the focused button (gear care: past the safety card)', gf.root === 'gear' && !/I understand/.test(await G(page, () => [...document.querySelectorAll('#gear button')].filter((b) => b.offsetParent).map((b) => b.textContent).join('|'))) || (await st()) === 'play', JSON.stringify({ gf, gearMoved }));
await back2play();

// ---------- hold A to sharpen ----------
await G(page, () => { const g = window.__gametool; g.inventory.give('sword', 1); g.openGear(); g.gear.start('sharpen'); }); await frames(page, 3);
await hold(A, true); await frames(page, 4);
const lifting = await G(page, () => window.__gametool.gear.holding);
await hold(A, false); await frames(page, 4);
const dropped = await G(page, () => window.__gametool.gear.holding);
check('Sharpening: hold A lifts the blade, letting go lowers it', lifting && !dropped, JSON.stringify({ lifting, dropped }));
await back2play();

// ---------- cooking over the campfire ----------
await G(page, () => { window.__gametool.openCampfire(); window.__gametool.campfire.onCook(); }); await frames(page, 3);
const cookUp = await G(page, () => window.__gametool.cook.isOpen && !window.__gametool.campfire.isOpen);
await btn(DOWN);
const cf = await focus();
const cookRoot = await G(page, () => window.__gametool.cook.el.id || window.__gametool.cook.el.className);
check('Cooking opened at the campfire takes the D-pad (not the hidden campfire list)', cookUp && cf.ring && cf.root === cookRoot, JSON.stringify({ cookUp, cf, cookRoot }));
await btn(B); await frames(page, 4);
const fireBack = await G(page, () => !window.__gametool.cook.isOpen && window.__gametool.campfire.isOpen);
check('B in cooking goes back to the fire', fireBack);
await btn(B); await frames(page, 4); await back2play();

// ---------- the margin-note desk in a book ----------
await G(page, () => window.__gametool.readRedBook()); await frames(page, 6);
const inBook = (await st()) === 'book';
await btn(Y); await frames(page, 3);
const desk = await G(page, () => { const g = window.__gametool; return (g.reader.isOpen ? g.readerDesk : g.lecternDesk).isWriting; });
await btn(DOWN);
const df = await focus();
await btn(B); await frames(page, 3);   // the D-pad left the text box, so B presses the desk's Close
const deskShut = await G(page, () => { const g = window.__gametool; return !(g.reader.isOpen ? g.readerDesk : g.lecternDesk).isWriting; });
check('In a book Y picks up the pen; the desk takes the D-pad; B puts it away (still in the book)', inBook && desk && df.ring && deskShut && (await st()) === 'book', JSON.stringify({ inBook, desk, df, deskShut, st: await st() }));
await btn(B); await frames(page, 4); await back2play();

// ---------- Start also leaves a panel ----------
await G(page, () => window.__gametool.openMap()); await frames(page, 3);
await btn(START); await frames(page, 4);
check('Start leaves a panel too', (await st()) === 'play' && !(await G(page, () => window.__gametool.livingMap.isOpen)));

// ---------- the lore editor ----------
await G(page, () => window.__gametool.quitToMenu()); await frames(page, 6);
await until(page, () => window.__gametool.state === 'title', null, 8000);
await G(page, () => { if (!document.querySelector('#writeLoreTitle')?.offsetParent) document.querySelector('#openExtras')?.click(); document.querySelector('#writeLoreTitle')?.click(); });
await frames(page, 3);
const inEditor = (await st()) === 'editor';
await btn(DOWN); await btn(DOWN);
const ef = await focus();
for (let k = 0; k < 3 && (await st()) === 'editor'; k++) { await btn(B); await frames(page, 3); }
check('The lore editor: the D-pad moves through its fields and B leaves it', inEditor && ef.root === 'editor' && (await st()) !== 'editor', JSON.stringify({ inEditor, ef, st: await st() }));
await ctx.close();

// ---------- touch: shoulder swap ----------
const tctx = await browser.newContext({ viewport: { width: 844, height: 390 }, hasTouch: true, isMobile: true, deviceScaleFactor: 1 });
await tctx.addInitScript(() => localStorage.setItem('gametool.character', JSON.stringify({ name: 'Test', created: true })));
const tp = await tctx.newPage();
tp.on('pageerror', (e) => errors.push(e.message));
await tp.goto('file://' + file);
await tp.waitForFunction(() => window.__gametool, null, { timeout: 90000 });
await tp.tap('#begin');
await tp.waitForFunction(() => window.__gametool.state === 'play', null, { timeout: 60000 });
await G(tp, () => window.__gametool.endWake?.());
const shBtn = () => G(tp, () => { const b = document.querySelector('#touch [data-act="shoulder"]'); return !!b && !b.classList.contains('hidden') && b.offsetParent !== null; });
// Step to the shoulder view with 🎥 until the button shows (first person and overhead hide it).
let shown = false, hiddenSomewhere = false;
for (let k = 0; k < 4 && !shown; k++) { if (!(await shBtn())) hiddenSomewhere = true; else { shown = true; break; } await tp.tap('#touch [data-act="pov"]'); await G(tp, () => new Promise((r) => setTimeout(r, 250))); }
shown = await shBtn();
const side0 = await G(tp, () => window.__gametool.rig.shoulderSide);
if (shown) await tp.tap('#touch [data-act="shoulder"]');
await G(tp, () => new Promise((r) => setTimeout(r, 250)));
const side1 = await G(tp, () => window.__gametool.rig.shoulderSide);
check('Touch: a ⇄ shoulder button shows in the shoulder view only, and swaps the shoulder', shown && hiddenSomewhere && side0 !== side1, JSON.stringify({ shown, hiddenSomewhere, side0, side1 }));
await tctx.close();

check('No page errors', errors.length === 0, errors.slice(0, 3).join(' | '));
await browser.close();
const passed = results.filter((r) => r.ok).length;
console.log(`\n${passed}/${results.length} checks passed`);
process.exit(passed === results.length ? 0 : 1);
