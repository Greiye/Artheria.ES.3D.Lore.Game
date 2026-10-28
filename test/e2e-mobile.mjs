// Touch (phone) and gamepad checks against dist/index.html in headless Chromium.
// Usage: node test/e2e-mobile.mjs [path/to/index.html]   (CHROMIUM_PATH as in e2e.mjs)
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
const state = (p) => G(p, () => window.__gametool.state);
const pos = (p) => G(p, () => { const q = window.__gametool.player.pos; return { x: q.x, y: q.y, z: q.z }; });
// Speed measured in-page between two samples taken while the input is held (excludes press/release latency).
// Uses simulated seconds, so a slow software renderer can't skew the measurement.
const sample = (p) => G(p, () => { const gt = window.__gametool, q = gt.player.pos; return { x: q.x, z: q.z, t: gt.perf.simSeconds }; });
const speedOf = (a, b) => Math.hypot(b.x - a.x, b.z - a.z) / (b.t - a.t);
const frames = (page, n = 3) => G(page, (n) => new Promise((r) => { const f = () => (--n <= 0 ? r() : requestAnimationFrame(f)); requestAnimationFrame(f); }), n);
const teleport = async (page, x, z, yaw = 0, pitch = 0) => {
  await G(page, ([x, z, yaw, pitch]) => { const p = window.__gametool.player; p.pos.set(x, 0, z); p.yaw = yaw; p.pitch = pitch; p.update(0); }, [x, z, yaw, pitch]);
  await frames(page);
};
const clearColliders = (page) => G(page, () => { const gt = window.__gametool; gt.parked = gt.world.colliders.splice(0); });
const restoreColliders = (page) => G(page, () => { const gt = window.__gametool; gt.world.colliders.push(...gt.parked); });

// Character creation (feature promoted 2026-10-18) only gates the very first "Click to begin".
// These tests exercise movement/book/touch/gamepad behaviour, not that one-time form (which has
// its own coverage), so pre-seed a completed character before every test loads the page.
const seedCharacter = () => localStorage.setItem('gametool.character', JSON.stringify({ name: 'Test Player', motivation: '', secret: '', created: true }));

async function open(opts, init) {
  const ctx = await browser.newContext(opts);
  await ctx.addInitScript(seedCharacter);
  if (init) await ctx.addInitScript(init);
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  await page.route(/^https?:/, (r) => r.abort());
  await page.goto('file://' + file);
  await page.waitForFunction(() => window.__gametool);
  return { ctx, page, errors };
}

// ---------------- Touch: phone in landscape ----------------
{
  const { ctx, page, errors } = await open({ viewport: { width: 844, height: 390 }, hasTouch: true, isMobile: true, deviceScaleFactor: 3 });
  const cdp = await ctx.newCDPSession(page);
  const touch = (type, pts) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: pts });
  check('Touch: title says "Tap to begin" and shows touch help', (await page.textContent('#begin')) === 'Tap to begin' && await page.isVisible('.keys.only-touch') && !(await page.isVisible('.keys.only-mouse')));
  await page.tap('#begin');
  await page.waitForFunction(() => window.__gametool.state === 'play');
  await frames(page);
  check('Touch: tap starts the game in touch mode; buttons visible', (await G(page, () => window.__gametool.inputMode)) === 'touch' && await page.isVisible('.t-btn[data-act="jump"]') && await page.isVisible('.t-menu'));
  await page.screenshot({ path: path.join(shots, 'm1-phone-landscape.png') });

  // Joystick: full push forward = run, small push = walk.
  await clearColliders(page);
  const stickRun = async (dy, ms) => {
    await teleport(page, 0, 30, Math.PI / 2);
    const a = await pos(page);
    await touch('touchStart', [{ x: 150, y: 280, id: 1 }]);
    await touch('touchMove', [{ x: 150, y: 280 + dy, id: 1 }]);
    await page.waitForTimeout(150);
    const s1 = await sample(page);
    await page.waitForTimeout(ms);
    const s2 = await sample(page);
    await touch('touchEnd', []);
    void a;
    return speedOf(s1, s2);
  };
  const full = await stickRun(-80, 1000);
  const small = await stickRun(-22, 1000);
  check('Touch: joystick full push runs (~5 m/s)', full > 4 && full < 5.8, full.toFixed(2) + ' m/s');
  check('Touch: joystick small push walks (< 2.6 m/s)', small > 0.2 && small < 2.6, small.toFixed(2) + ' m/s');
  const dir = await G(page, () => window.__gametool.player.pos.x);
  check('Touch: pushing up moves forward', dir < 0, 'x ' + dir.toFixed(2) + ' (facing −X)');
  await restoreColliders(page);

  // Look: drag on the right half.
  const y0 = await G(page, () => window.__gametool.player.yaw);
  await touch('touchStart', [{ x: 600, y: 200, id: 2 }]);
  for (let i = 1; i <= 5; i++) await touch('touchMove', [{ x: 600 + i * 20, y: 200, id: 2 }]);
  await touch('touchEnd', []);
  const y1 = await G(page, () => window.__gametool.player.yaw);
  check('Touch: right-side drag turns the camera', y1 < y0 - 0.1, `yaw ${y0.toFixed(2)} → ${y1.toFixed(2)}`);

  // Two fingers at once: walk + look.
  await teleport(page, 0, 30, Math.PI / 2);
  const m0 = await pos(page), yy0 = await G(page, () => window.__gametool.player.yaw);
  await touch('touchStart', [{ x: 150, y: 280, id: 1 }, { x: 600, y: 200, id: 2 }]);
  for (let i = 1; i <= 5; i++) { await touch('touchMove', [{ x: 150, y: 210, id: 1 }, { x: 600 + i * 10, y: 200, id: 2 }]); await page.waitForTimeout(60); }
  await touch('touchEnd', []);
  const m1 = await pos(page), yy1 = await G(page, () => window.__gametool.player.yaw);
  check('Touch: move and look at the same time (multi-touch)', Math.hypot(m1.x - m0.x, m1.z - m0.z) > 0.3 && yy1 < yy0);

  // Jump + sneak buttons.
  await teleport(page, 0, 30);
  await page.tap('.t-btn[data-act="jump"]');
  let peak = 0;
  for (let i = 0; i < 12; i++) { peak = Math.max(peak, (await pos(page)).y); await page.waitForTimeout(40); }
  check('Touch: Jump button jumps', peak > 0.5, 'apex ' + peak.toFixed(2));
  await page.waitForTimeout(800);
  await page.tap('.t-btn[data-act="sneak"]');
  const sneaking = await G(page, () => window.__gametool.player.sneaking);
  await page.tap('.t-btn[data-act="sneak"]');
  check('Touch: Sneak button toggles sneak', sneaking && !(await G(page, () => window.__gametool.player.sneaking)));

  // Read button near the book.
  await teleport(page, 0, 8.5, 0);
  const farRead = await page.isVisible('.t-read');
  await teleport(page, 0, 1.4, 0, -0.45);
  const nearRead = await page.isVisible('.t-read');
  check('Touch: Read button appears only when aimed at the book', !farRead && nearRead);
  await page.screenshot({ path: path.join(shots, 'm2-phone-read-button.png') });
  await page.tap('.t-read');
  await page.waitForFunction(() => window.__gametool.state === 'book');
  await page.waitForTimeout(500);
  const lw = await G(page, () => document.querySelector('#book .page.left').getBoundingClientRect().width);
  check('Touch: landscape phone shows one wide page (readable line length)', !(await page.isVisible('#book .page.right')) && lw >= 450, Math.round(lw) + ' px wide');
  await page.screenshot({ path: path.join(shots, 'm5-phone-landscape-book.png') });
  // Swipe left = next page.
  const p0 = await G(page, () => window.__gametool.book.currentPage);
  await touch('touchStart', [{ x: 560, y: 200, id: 3 }]);
  await touch('touchMove', [{ x: 420, y: 205, id: 3 }]);
  await touch('touchMove', [{ x: 280, y: 205, id: 3 }]);
  await touch('touchEnd', []);
  await page.waitForTimeout(350);
  const p1 = await G(page, () => window.__gametool.book.currentPage);
  check('Touch: swipe turns the page', p1 > p0, `${p0} → ${p1}`);
  await page.tap('.book-close');
  await page.waitForTimeout(300);
  check('Touch: ✕ closes the book back to play', (await state(page)) === 'play');
  await page.tap('.t-menu');
  check('Touch: ☰ opens the pause menu', (await state(page)) === 'pause');
  await page.tap('#resume');
  check('Touch: Resume returns to play (no pointer-lock prompt)', (await state(page)) === 'play');
  // v0.05 §5: Natalie's telling asks for portrait on a phone held sideways.
  await G(page, () => window.__gametool.openCampfire());
  await page.waitForFunction(() => window.__gametool.campfire.isOpen);
  await G(page, () => window.__gametool.campfire.onTell('natalies-field-note'));
  const ask = await G(page, () => { const el = document.querySelector('#telling .kt-portrait'); return el && getComputedStyle(el).display !== 'none'; });
  await page.tap('#ktPortraitOk');
  const gone = await G(page, () => getComputedStyle(document.querySelector('#telling .kt-portrait')).display === 'none');
  check('Touch landscape: the telling asks for portrait, and "Carry on sideways" dismisses it', ask && gone);
  await G(page, () => { const g = window.__gametool; g.telling.close(); g.campfire.close(); });
  await page.waitForFunction(() => window.__gametool.state === 'play');
  check('Touch landscape: no page errors', errors.length === 0, errors.slice(0, 3).join(' | '));
  await ctx.close();
}

// ---------------- Touch: phone in portrait — the book scrolls (v0.04) ----------------
{
  const { ctx, page, errors } = await open({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true, deviceScaleFactor: 3 });
  await page.screenshot({ path: path.join(shots, 'm3-phone-portrait-title.png') });
  await page.tap('#begin');
  await page.waitForFunction(() => window.__gametool.state === 'play');
  await teleport(page, 0, 1.4, 0, -0.5);
  await page.tap('.t-read');
  await page.waitForFunction(() => window.__gametool.state === 'book');
  await page.waitForTimeout(500);
  await G(page, () => window.__gametool.book.goto(window.__gametool.book.entryStart.get('the-stagecoach'))); await page.waitForTimeout(350);
  // v0.04: a phone held upright reads the book as one vertical scroll (see test/e2e-player.mjs for scrolling).
  const scroll = await G(page, () => document.getElementById('book').classList.contains('scroll') && getComputedStyle(document.querySelector('#book .page.right')).display === 'none');
  const pageBox = await G(page, () => { const r = document.querySelector('#book .page.left').getBoundingClientRect(); return { w: r.width, h: r.height, left: r.left, right: r.right }; });
  check('Touch portrait: the book is one scrolling column that fits the screen', scroll && pageBox.left >= 0 && pageBox.right <= 390, `page ${Math.round(pageBox.w)}×${Math.round(pageBox.h)} px`);
  const c0 = await G(page, () => window.__gametool.book.currentPage);
  await G(page, () => window.__gametool.book.next());
  const c1ok = await page.waitForFunction((c0) => window.__gametool.book.currentPage === c0 + 1, c0, { timeout: 5000 }).then(() => true, () => false);
  const c1 = await G(page, () => window.__gametool.book.currentPage);
  check('Touch portrait: next page scrolls down one page', c1ok, `${c0} → ${c1}`);
  const sections = await G(page, () => document.querySelectorAll('#book .scroll-page').length === window.__gametool.book.pageCount);
  check('Touch portrait: every page is in the scroll', sections);
  await page.screenshot({ path: path.join(shots, 'm4-phone-portrait-book.png') });
  await G(page, () => window.__gametool.book.close());
  await page.waitForFunction(() => window.__gametool.state === 'play');
  await G(page, () => window.__gametool.openCampfire());
  await page.waitForFunction(() => window.__gametool.campfire.isOpen);
  await G(page, () => window.__gametool.campfire.onTell('natalies-field-note'));
  await page.waitForFunction(() => window.__gametool.telling.shown >= 12, null, { timeout: 15000 }).catch(() => {});
  const tall = await G(page, () => { const k = document.querySelector('#telling .kt-portrait'), st = document.querySelector('#telling .kt-stage').getBoundingClientRect(); return { ask: getComputedStyle(k).display !== 'none', top: st.top, w: st.width }; });
  check('Touch portrait: the telling fills the lower part of the screen, no prompt', !tall.ask && tall.top > 844 * 0.3 && tall.w >= 380, JSON.stringify(tall));
  await page.screenshot({ path: path.join(shots, 'm5-phone-portrait-telling.png') });
  check('Touch portrait: no page errors', errors.length === 0, errors.slice(0, 3).join(' | '));
  await ctx.close();
}

// ---------------- Gamepad (mocked standard-mapping pad) ----------------
{
  const fakePad = () => {
    const pad = { id: 'Test Pad (STANDARD GAMEPAD)', index: 0, connected: true, mapping: 'standard', timestamp: 0,
      axes: [0, 0, 0, 0], buttons: Array.from({ length: 17 }, () => ({ pressed: false, touched: false, value: 0 })) };
    window.__pad = pad;
    navigator.getGamepads = () => [pad, null, null, null];
  };
  const { ctx, page, errors } = await open({ viewport: { width: 1280, height: 800 } }, fakePad);
  const btn = async (i, ms = 120) => {
    await G(page, (i) => { window.__pad.buttons[i].pressed = true; window.__pad.buttons[i].value = 1; }, i);
    await page.waitForTimeout(ms); await frames(page, 2);
    await G(page, (i) => { window.__pad.buttons[i].pressed = false; window.__pad.buttons[i].value = 0; }, i);
    await frames(page, 2);
  };
  const axes = (a) => G(page, (a) => { window.__pad.axes = a; }, a);
  await page.waitForTimeout(300);
  await btn(0);
  await page.waitForFunction(() => window.__gametool.state === 'play', null, { timeout: 3000 }).catch(() => undefined);
  check('Gamepad: A on the title starts the game (pad mode, no pointer lock)', (await state(page)) === 'play' && (await G(page, () => window.__gametool.inputMode)) === 'pad' && !(await page.isVisible('#nolock')));
  await clearColliders(page);
  const stickRun = async (y, ms = 1000) => {
    await teleport(page, 0, 30, Math.PI / 2);
    const a = await pos(page);
    await axes([0, y, 0, 0]); await page.waitForTimeout(150);
    const s1 = await sample(page); await page.waitForTimeout(ms); const s2 = await sample(page);
    await axes([0, 0, 0, 0]);
    const b = await pos(page);
    return { v: speedOf(s1, s2), dx: b.x - a.x };
  };
  const full = await stickRun(-1);
  const half = await stickRun(-0.45);
  check('Gamepad: left stick full = run, forward', full.v > 4 && full.v < 5.8 && full.dx < 0, full.v.toFixed(2) + ' m/s');
  check('Gamepad: left stick partial = walk', half.v > 0.3 && half.v < 2.6, half.v.toFixed(2) + ' m/s');
  await axes([0, -1, 0, 0]); await btn(10);   // L3 click while moving: sprint until the stick is let go
  const spr = await stickRun(-1);
  await frames(page, 3);
  const sprintOff = await G(page, () => !window.__gametool.player.held.has('sprint'));
  check('v0.04 Gamepad: L3 sprints until the stick is let go', sprintOff && spr.v > 6.8 && spr.v < 8.8, spr.v.toFixed(2) + ' m/s');
  await restoreColliders(page);
  const y0 = await G(page, () => window.__gametool.player.yaw);
  await axes([0, 0, 1, 0]); await frames(page, 12); await axes([0, 0, 0, 0]);   // frame-based: slow SwiftShader frames
  const y1 = await G(page, () => window.__gametool.player.yaw);
  check('Gamepad: right stick looks', y1 < y0 - 0.3, `yaw ${y0.toFixed(2)} → ${y1.toFixed(2)}`);
  await teleport(page, 0, 30);
  await frames(page, 3);
  // Watch for the apex while Y is held: under slow SwiftShader frames the whole jump can be over by release.
  await G(page, () => { window.__pad.buttons[3].pressed = true; window.__pad.buttons[3].value = 1; });
  let peak = 0;
  for (let i = 0; i < 20; i++) { peak = Math.max(peak, (await pos(page)).y); await page.waitForTimeout(40); }
  await G(page, () => { window.__pad.buttons[3].pressed = false; window.__pad.buttons[3].value = 0; });
  await frames(page, 2);
  check('Gamepad: Y jumps', peak > 0.5, 'apex ' + peak.toFixed(2));
  await page.waitForTimeout(800);
  await btn(1);
  const sn = await G(page, () => window.__gametool.player.sneaking);
  await btn(1);
  check('v0.04 Gamepad: B toggles sneak', sn && !(await G(page, () => window.__gametool.player.sneaking)));
  const h0 = await G(page, () => window.__gametool.haptics.played);
  await btn(3, 60); await page.waitForTimeout(900);
  check('v0.04 Gamepad: haptics fire on jump and landing', (await G(page, () => window.__gametool.haptics.played)) >= h0 + 2);
  // v0.05: three perspectives. LB steps in (overhead -> shoulder -> first person), RB steps out.
  const view = () => G(page, () => window.__gametool.settings.view);
  const v0 = await view();
  await btn(4); const v1 = await view();
  await btn(4); const v2 = await view();
  await btn(5); await btn(5); const v3 = await view();
  check('v0.05 Gamepad: LB / RB step between overhead, shoulder and first person', [v0, v1, v2, v3].join('→') === 'overhead→shoulder→first→overhead', [v0, v1, v2, v3].join('→'));
  const r3 = [];
  for (let i = 0; i < 3; i++) { await btn(11); r3.push(await view()); }
  check('v0.05 Gamepad: R3 cycles the three perspectives', r3.join(',') === 'first,shoulder,overhead', r3.join(','));
  await btn(4);
  const sh0 = await G(page, () => window.__gametool.rig.shoulderSide);
  await btn(12); const sh1 = await G(page, () => window.__gametool.rig.shoulderSide);
  await btn(12);
  check('v0.05 Gamepad: D-pad up swaps the shoulder in the shoulder view', sh0 === 1 && sh1 === -1 && (await G(page, () => window.__gametool.rig.shoulderSide)) === 1);
  await btn(5);
  await G(page, () => { window.__pad.id = 'DualSense Wireless Controller (STANDARD GAMEPAD Vendor: 054c)'; }); await frames(page);
  const ps = await G(page, () => ({ pad: document.body.dataset.pad, map: document.querySelector('#pause [data-padmap]').textContent }));
  check('v0.04 Gamepad: a PlayStation pad shows its own button names in the controls map', ps.pad === 'playstation' && ps.map.includes('✕') && ps.map.includes('R2'), JSON.stringify(ps).slice(0, 120));
  await G(page, () => { window.__pad.id = 'Test Pad (STANDARD GAMEPAD)'; }); await frames(page);
  await teleport(page, 0, 1.4, 0, -0.45);
  check('Gamepad: prompt shows "A — Read"', (await page.textContent('#prompt')).includes('A'));
  await btn(0);
  await page.waitForFunction(() => window.__gametool.state === 'book', null, { timeout: 3000 }).catch(() => undefined);
  await page.waitForTimeout(400);
  check('Gamepad: A opens the book', (await state(page)) === 'book');
  const p0 = await G(page, () => window.__gametool.book.currentPage);
  await btn(5); await page.waitForTimeout(300);
  const p1 = await G(page, () => window.__gametool.book.currentPage);
  await btn(4); await page.waitForTimeout(300);
  const p2 = await G(page, () => window.__gametool.book.currentPage);
  await btn(15); await page.waitForTimeout(300);
  const p3 = await G(page, () => window.__gametool.book.currentPage);
  await axes([-1, 0, 0, 0]); await frames(page, 3); await axes([0, 0, 0, 0]); await page.waitForTimeout(300);
  const p4 = await G(page, () => window.__gametool.book.currentPage);
  check('Gamepad: RB / LB / D-pad / stick flick turn pages', p1 > p0 && p2 === p0 && p3 > p0 && p4 === p0, [p0, p1, p2, p3, p4].join('→'));
  await btn(1); await page.waitForTimeout(300);
  check('Gamepad: B closes the book back to play', (await state(page)) === 'play');
  await btn(9);
  const paused = (await state(page)) === 'pause';
  await btn(9);
  check('Gamepad: Start pauses and resumes', paused && (await state(page)) === 'play');
  check('Gamepad: no page errors', errors.length === 0, errors.slice(0, 3).join(' | '));
  await ctx.close();
}

await browser.close();
const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} checks passed`);
process.exit(failed.length ? 1 : 0);
