// v0.04 feedback checks, part 2 (player): vault a low wall, climb the fallen rocks, torch, D-pad quick swap,
// footstep pitch variation. Part 3 (time): sunset start, bedroll sleep cycle.
// Part 4 (reading): read pose and held book, portrait scroll, landscape hint.
// Usage: npm run build && node test/e2e-player.mjs [path/to/index.html]
import { chromium } from 'playwright-core';
import path from 'node:path';

const file = path.resolve(process.argv[2] ?? 'dist/index.html');
const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH || undefined,
  args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--autoplay-policy=no-user-gesture-required'],
});
const results = [];
const check = (id, ok, detail = '') => { results.push({ id, ok }); console.log(`${ok ? 'PASS' : 'FAIL'}  ${id}${detail ? '  — ' + detail : ''}`); };
const G = (page, fn, arg) => page.evaluate(fn, arg);
const until = (page, fn, arg, timeout = 15000) => page.waitForFunction(fn, arg, { timeout, polling: 100 }).then(() => true, () => false);

const fakePad = () => {
  const pad = { id: 'Test Pad (STANDARD GAMEPAD)', index: 0, connected: true, mapping: 'standard', timestamp: 0,
    axes: [0, 0, 0, 0], buttons: Array.from({ length: 17 }, () => ({ pressed: false, touched: false, value: 0 })) };
  window.__pad = pad;
  navigator.getGamepads = () => [pad, null, null, null];
};
const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
await ctx.addInitScript(() => {
  if (!localStorage.getItem('gametool.character')) localStorage.setItem('gametool.character', JSON.stringify({ name: 'Test', motivation: '', secret: '', created: true }));
});
await ctx.addInitScript(fakePad);
const page = await ctx.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
await page.goto('file://' + file);
await page.waitForFunction(() => window.__gametool);
await page.click('#begin');
await page.waitForFunction(() => window.__gametool.state === 'play');
await page.mouse.move(5, 5);
const place = (x, z, yaw = 0) => G(page, ([x, z, yaw]) => { const p = window.__gametool.player; p.pos.set(x, 0, z); p.yaw = yaw; p.bodyYaw = yaw; p.pitch = 0; }, [x, z, yaw]);
const pos = () => G(page, () => { const p = window.__gametool.player.pos; return { x: p.x, y: p.y, z: p.z }; });

// ---------- vault a low wall ----------
await place(-6, -3.9, 0);   // facing -Z, the 1 m ruin wall at z ≈ -5 ahead
await page.waitForTimeout(300);
await page.keyboard.down('KeyW');
await until(page, () => window.__gametool.player.pos.z < -4.3, null, 3000);
await page.keyboard.press('Space');
const vaulted = await until(page, () => window.__gametool.player.vaults > 0, null, 3000);
await until(page, () => !window.__gametool.player.vaulting, null, 3000);
await page.keyboard.up('KeyW');
const v = await pos();
check('v0.04 jumping at a low wall vaults clean over it (Mirror\'s Edge style)', vaulted && v.z < -5.5 && v.y < 0.05, JSON.stringify(v));

// ---------- climb the fallen rocks ----------
const climb = await G(page, () => window.__gametool.world.colliders.filter((c) => c.top >= 3).map((c) => ({ x: (c.minX + c.maxX) / 2, z: (c.minZ + c.maxZ) / 2, top: c.top })));
await place(24, -16.6, 0);
await page.waitForTimeout(300);
await page.keyboard.down('KeyW');
let top = 0;
for (let i = 0; i < 40 && top < 3.4; i++) {
  await page.keyboard.press('Space');
  await page.waitForTimeout(250);
  top = Math.max(top, (await pos()).y);
}
await page.keyboard.up('KeyW');
await page.waitForTimeout(600);
const onTop = await pos();
check('v0.04 jump, vault and mantle up the fallen rocks to the 3.5 m lookout', top >= 3.4 && onTop.y >= 3.4, JSON.stringify({ top, onTop, climb }));
check('v0.04 standing on the rock top: grounded, not falling through', !(await G(page, () => window.__gametool.player.airborne)));

// ---------- torch ----------
await place(0, 9, 0);
await page.keyboard.press('KeyT');
const lit = await until(page, () => window.__gametool.torch.lit && window.__gametool.torch.light.intensity > 4, null, 2000);
const quickShown = await page.isVisible('#quick');
await page.keyboard.press('KeyT');
const out = await until(page, () => !window.__gametool.torch.lit && window.__gametool.torch.light.intensity === 0, null, 2000);
check('v0.04 T lights the torch (a warm light) and puts it out; the quick-swap line shows', lit && out && quickShown);
// Controller: D-pad down held 0.4 s.
const btn = (i, on) => G(page, ([i, on]) => { window.__pad.buttons[i].pressed = on; window.__pad.buttons[i].value = on ? 1 : 0; }, [i, on]);
// A tap: down for one rendered frame only. Software-rendered frames can each be 0.25 s of game time (the dt cap),
// so two frames could already pass the 0.4 s hold.
const tap = (i) => G(page, (i) => new Promise((done) => { const b = window.__pad.buttons[i]; b.pressed = true; b.value = 1;
  requestAnimationFrame(() => { b.pressed = false; b.value = 0; requestAnimationFrame(() => requestAnimationFrame(done)); }); }), i);
await tap(13); await page.waitForTimeout(200);
const tapNoTorch = await G(page, () => !window.__gametool.torch.lit);
await btn(13, true); await page.waitForTimeout(700);
const held = await G(page, () => window.__gametool.torch.lit);
await btn(13, false); await page.waitForTimeout(200);
check('v0.04 controller: a tap of D-pad down does nothing, a hold lights the torch', tapNoTorch && held);
// Quick swap: D-pad left = left hand (torch), D-pad right = right hand (hands / crossbow).
await tap(14);
const leftOff = await G(page, () => !window.__gametool.torch.lit);
await G(page, () => window.__gametool.inventory.give('crossbow', 1));
await tap(15);
const right = await G(page, () => window.__gametool.crossbow.equipped);
const line = await page.textContent('#quick');
await tap(15);
const rightBack = await G(page, () => !window.__gametool.crossbow.equipped);
check('v0.04 D-pad quick swap: left hand torch off, right hand crossbow on and back; HUD names both hands', leftOff && right && rightBack && /Empty/.test(line) && /Crossbow/.test(line), line);

// ---------- part 3: time of day ----------
const start = await G(page, () => ({ t: window.__gametool.world.time, el: window.__gametool.world.sunElevationDeg }));
check('v0.04 the game starts at a dark sunset (sun under 15°)', start.t === 'sunset' && start.el < 15, JSON.stringify(start));
const order = [];
for (let i = 0; i < 3; i++) {
  await G(page, () => {
    const g = window.__gametool, b = g.world.stations.bedroll.getWorldPosition(new g.Vector3()), p = g.player;
    p.pos.set(b.x, 0, b.z + 1.5); p.yaw = Math.atan2(-(b.x - p.pos.x), -(b.z - p.pos.z)); p.bodyYaw = p.yaw; p.pitch = -0.6;
  });
  const seen = await until(page, () => /^Sleep until/.test(document.getElementById('promptVerb').textContent));
  const before = await G(page, () => window.__gametool.world.time);
  await page.keyboard.press('KeyE');
  await until(page, (b) => window.__gametool.world.time !== b, before);
  order.push(seen ? await G(page, () => window.__gametool.world.time) : 'no prompt');
  await page.waitForTimeout(1500);
}
check('v0.04 sleeping on the bedroll moves time on: sunset -> night -> day -> sunset', order.join(',') === 'night,day,sunset', order.join(','));

// ---------- footsteps ----------
const pitches = await G(page, () => { const a = window.__gametool.audio, r = []; for (let i = 0; i < 12; i++) { a.footstep(); r.push(a.lastStepPitch); } return r; });
const spread = Math.max(...pitches) - Math.min(...pitches);
check('v0.04 footsteps vary in pitch (±12%)', spread > 0.05 && pitches.every((p) => p >= 0.88 && p <= 1.12), pitches.map((p) => p.toFixed(2)).join(' '));

// ---------- part 4: reading ----------
await place(2, 6);
await G(page, () => { const g = window.__gametool; void g.openReader(g.book.entryIds[0]); });
await until(page, () => window.__gametool.state === 'book' && window.__gametool.reader.isOpen);
const reads = await until(page, () => { const b = window.__gametool.player.body.children[0].userData.rig.bones; return b.foreN.rotation.x < -0.8 && b.head.rotation.x > 0.2; }, null, 5000);
const holds = await G(page, () => { let v = false; window.__gametool.player.body.traverse((o) => { if (o.isMesh && o.geometry.type === 'BoxGeometry' && o.parent?.parent?.visible && o.parent.parent.parent?.isBone) v = true; }); return v; });
check('v0.04 reading: the avatar plays a read pose, head down, holding an open book', reads && holds);
await page.keyboard.press('Escape');
await until(page, () => window.__gametool.state !== 'book');
// The desktop page is done; close it so its software-rendered frames don't starve the phone pages' boot.
await page.close();

for (const [w, h, name] of [[390, 844, 'portrait'], [844, 390, 'landscape']]) {
  const c = await browser.newContext({ viewport: { width: w, height: h }, hasTouch: true, isMobile: true });
  await c.addInitScript(() => localStorage.setItem('gametool.character', JSON.stringify({ name: 'Test', motivation: '', secret: '', created: true })));
  const pg = await c.newPage();
  pg.on('pageerror', (e) => errors.push(name + ': ' + e.message));
  await pg.goto('file://' + file, { timeout: 120000 });
  await pg.waitForFunction(() => window.__gametool);
  await pg.tap('#begin');
  await pg.waitForFunction(() => window.__gametool.state === 'play');
  await pg.evaluate(() => { const g = window.__gametool; void g.openReader(g.book.entryIds[0]); });
  await pg.waitForFunction(() => window.__gametool.reader.isOpen);
  if (name === 'portrait') {
    const info = await pg.evaluate(async () => {
      const r = window.__gametool.reader, el = r.root.querySelector('.page.left .page-inner');
      const secs = el.querySelectorAll('.scroll-page').length, before = r.currentPage;
      el.scrollTop = el.scrollHeight;
      await new Promise((ok) => setTimeout(ok, 300));
      return { scroll: r.root.classList.contains('scroll'), secs, before, after: r.currentPage, pages: r.pageCount, overflow: getComputedStyle(el).overflowY };
    });
    check('v0.04 phone upright: the book is one vertical scroll; scrolling moves the current page', info.scroll && info.overflow === 'auto' && info.secs === info.pages && (info.pages < 2 || info.after > info.before), JSON.stringify(info));
  } else {
    const hint = await pg.evaluate(() => ({ shown: getComputedStyle(document.getElementById('readHint')).display !== 'none', scroll: window.__gametool.reader.root.classList.contains('scroll') }));
    check('v0.04 phone sideways: reading shows a "turn upright" hint and keeps page turning', hint.shown && !hint.scroll, JSON.stringify(hint));
  }
  await c.close();
}

check('v0.04: no console/page errors', errors.length === 0, errors.join(' | '));
await browser.close();
const failed = results.filter((r) => !r.ok).length;
console.log(`\n${results.length - failed}/${results.length} checks passed`);
process.exit(failed ? 1 : 0);
