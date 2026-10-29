// v0.06 part 4 checks: unlimited crowns (E1), faded sundries in the store (E2), interior ceilings in the library and
// the gallery (W2) and the wider front head view (H1). The cinema (R1, R2) is covered by e2e-cinema.mjs.
// Usage: npm run build && node test/e2e-v0.06-part4.mjs [path/to/index.html]
import { chromium } from 'playwright-core';
import path from 'node:path';

const file = path.resolve(process.argv[2] ?? 'dist/index.html');
const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH || undefined,
  args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'],
});
const shots = process.env.SHOTS_DIR && path.resolve(process.env.SHOTS_DIR);
const shot = (page, name) => shots ? page.screenshot({ path: path.join(shots, name + '.png') }) : undefined;
const results = [];
const check = (id, ok, detail = '') => { results.push({ id, ok }); console.log(`${ok ? 'PASS' : 'FAIL'}  ${id}${detail ? '  — ' + detail : ''}`); };
const G = (page, fn, arg) => page.evaluate(fn, arg);
const until = (page, fn, arg, timeout = 15000) => page.waitForFunction(fn, arg, { timeout, polling: 100 }).then(() => true, () => false);

const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 } });
await ctx.addInitScript(() => localStorage.setItem('gametool.character', JSON.stringify({ name: 'Test', motivation: '', secret: '', created: true })));
const page = await ctx.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
await page.goto('file://' + file);
await page.waitForFunction(() => window.__gametool);
await page.click('#begin'); await page.mouse.move(5, 5);
await page.waitForFunction(() => window.__gametool.state === 'play', null, { timeout: 8000 });
// Let n simulated frames pass (SwiftShader can stall, so count frames rather than wall-clock time).
const frames = (n) => G(page, (n) => new Promise((done) => { let k = 0; const f = () => (++k >= n ? done() : requestAnimationFrame(f)); requestAnimationFrame(f); }), n);

// ---------- E1 + E2: the store ----------
await G(page, () => window.__gametool.openShop());
await until(page, () => window.__gametool.shop.isOpen);
const store = await G(page, () => {
  const el = window.__gametool.shop.el, rows = [...el.querySelectorAll('.shop-row[data-buy]')];
  const sundry = rows.filter((r) => r.classList.contains('sundry'));
  const firstSundry = rows.indexOf(sundry[0]), lastMain = rows.findLastIndex((r) => !r.classList.contains('sundry'));
  return { purse: el.querySelector('.shop-purse').textContent, sundries: sundry.length, below: firstSundry > lastMain, faded: sundry.length ? Number(getComputedStyle(sundry[0]).opacity) : 1, enabled: sundry.every((r) => !r.disabled) };
});
check('v0.06 E1 the store purse shows ◎ ∞', /◎\s*∞/.test(store.purse), store.purse);
check('v0.06 E2 at least 6 sundries, listed faded below the main stock and all buyable', store.sundries >= 6 && store.below && store.faded < 0.8 && store.enabled, JSON.stringify(store));
const bought = await G(page, () => { const g = window.__gametool, s = g.shop, i = s.wares.findIndex((w) => w.id === 'candle'); const c0 = g.inventory.count('crown'); const ok = s.buy(i); return { ok, candle: g.inventory.count('candle'), crowns: [c0, g.inventory.count('crown')] }; });
check('v0.06 E1/E2 buying a sundry works with an empty purse and spends nothing', bought.ok && bought.candle === 1 && bought.crowns[0] === bought.crowns[1], JSON.stringify(bought));
await shot(page, 'store-sundries');
await G(page, () => window.__gametool.shop.close());
const earned = await G(page, () => { const g = window.__gametool, c0 = g.inventory.count('crown'); g.earn(3, 'test'); return g.inventory.count('crown') - c0; });
check('v0.06 E1 earning still pays into the purse underneath', earned === 3, String(earned));
await page.keyboard.press('KeyI');
await until(page, () => window.__gametool.state === 'inventory', null, 4000);
const invCrown = await G(page, () => document.querySelector('#inventory .inv-cell[data-item="crown"] .inv-count')?.textContent);
check('v0.06 E1 the inventory shows crowns × ∞', invCrown === '× ∞', String(invCrown));
await page.keyboard.press('KeyI');
await until(page, () => window.__gametool.state !== 'inventory', null, 4000);
if (await G(page, () => window.__gametool.state === 'resume')) await page.click('#relockBtn');
await until(page, () => window.__gametool.state === 'play', null, 4000);

// ---------- W2: ceilings in the library and gallery, from all three cameras ----------
// Rays through the top corners, top centre and centre of the view: any that rise must meet the hall's ceiling inside
// its walls, and the camera itself must stay under the ceiling.
const views = [['first person', false, 1, 1.3], ['shoulder', true, 1, 0], ['overhead', true, 2, 0]];
for (const hall of ['library', 'gallery']) {
  for (const [name, tp, step, pitch] of views) {
    await G(page, ([hall, tp, step, pitch]) => {
      const g = window.__gametool, r = g.ROOFED[hall], p = g.player;
      g.player.spawn(hall === 'gallery' ? new g.Vector3((r.minX + r.maxX) / 2 + 1, 0, (r.minZ + r.maxZ) / 2) : new g.Vector3(5, 0, -26), hall === 'gallery' ? -Math.PI / 2 : 0);   // the library's aisle (its centre holds the relic)
      p.thirdPerson = tp; g.rig.setStep(step); p.pitch = pitch;
    }, [hall, tp, step, pitch]);
    await frames(5);
    const t0 = await G(page, () => window.__gametool.perf.simSeconds);
    await until(page, (t0) => window.__gametool.perf.simSeconds > t0 + 1.5, t0, 60000);   // the view glides and zooms over ~1 s
    const v = await G(page, (hall) => {
      const g = window.__gametool, r = g.ROOFED[hall], cam = g.camera, ray = new g.Raycaster(), bad = [];
      g.player.pitch = g.player.thirdPerson ? 0 : 1.3;
      let up = 0;
      for (const [x, y] of [[-1, 1], [0, 1], [1, 1], [0, 0]]) {
        ray.setFromCamera({ x, y }, cam);
        const o = ray.ray.origin, d = ray.ray.direction;
        if (d.y <= 0.02) continue;
        up++;
        // Where the ray leaves the hall's footprint sideways: below the ceiling, that's a wall (or the gallery's
        // open side under its lintel), not sky.
        const out = (lo, hi, o, d) => (d > 0 ? (hi - o) / d : d < 0 ? (lo - o) / d : Infinity);
        const tSide = Math.min(out(r.minX, r.maxX, o.x, d.x), out(r.minZ, r.maxZ, o.z, d.z)), tRoof = (r.y - o.y) / d.y;
        if (tRoof > tSide) continue;
        const hx = o.x + d.x * tRoof, hz = o.z + d.z * tRoof;
        if (!(hx > r.minX - 0.5 && hx < r.maxX + 0.5 && hz > r.minZ - 0.5 && hz < r.maxZ + 0.5)) bad.push([x, y, +hx.toFixed(1), +hz.toFixed(1)]);
      }
      return { camY: +cam.position.y.toFixed(2), roof: r.y, up, bad };
    }, hall);
    check(`v0.06 W2 ${hall}, ${name}: no sky overhead (camera under the ceiling, every rising view ray meets it)`, v.camY < v.roof && v.bad.length === 0, JSON.stringify(v));
    if (!tp) {
      // The ceiling really draws: hide it and the top of the view changes (that was sky).
      const diff = await G(page, () => new Promise((done) => {
        const g = window.__gametool, read = () => { const c = document.querySelector('canvas'), x = document.createElement('canvas'); x.width = 32; x.height = 8; const k = x.getContext('2d'); k.drawImage(c, 0, 0, c.width, c.height / 4, 0, 0, 32, 8); return k.getImageData(0, 0, 32, 8).data; };
        requestAnimationFrame(() => { const a = read(); g.ceilings.forEach((m) => { m.visible = false; });
          requestAnimationFrame(() => requestAnimationFrame(() => { const b = read(); g.ceilings.forEach((m) => { m.visible = true; }); let s = 0; for (let i = 0; i < a.length; i += 4) s += Math.abs(a[i] - b[i]) + Math.abs(a[i + 1] - b[i + 1]) + Math.abs(a[i + 2] - b[i + 2]); done(s / (a.length / 4)); })); });
      }));
      check(`v0.06 W2 ${hall}: looking up shows the ceiling, not sky`, diff > 20, diff.toFixed(1));
      await shot(page, `ceiling-${hall}-fp`);
    } else if (step === 1) await shot(page, `ceiling-${hall}-shoulder`);
  }
}
const roofs = await G(page, () => { const g = window.__gametool; return g.ceilings.every((m) => !m.castShadow && (m.material.side ?? 0) === 0); });
check('v0.06 W2 ceilings cast no shadow and are one-sided (the overview still looks in; outside unchanged)', roofs);

// ---------- H1: the wider front head ----------
await G(page, () => { const g = window.__gametool; g.player.thirdPerson = false; g.player.pitch = 0; });
const head = await G(page, async () => {
  // A figure that stands still and never turns to the viewer: a character artifact in the library.
  const g = window.__gametool, V = g.Vector3;
  let fig = null;
  g.library.group.traverse((o) => { if (!fig && o.userData.head && o.userData.look) fig = o; });
  const p = new V(); fig.getWorldPosition(p);
  const fwd = new V(0, 0, 1).applyQuaternion(fig.getWorldQuaternion(fig.quaternion.clone())); fwd.y = 0; fwd.normalize();
  const sideways = new V(fwd.z, 0, -fwd.x);
  const measure = async (dir, d) => {
    g.player.spawn(new V(p.x + dir.x * d, 0, p.z + dir.z * d), Math.atan2(dir.x, dir.z));
    await new Promise((r) => { let k = 0; const f = () => (++k >= 30 ? r() : requestAnimationFrame(f)); requestAnimationFrame(f); });
    let board = null; fig.traverse((o) => { if (o.name === 'head-sprite') board = o; });
    const e = board.matrixWorld.elements, sx = Math.hypot(e[0], e[1], e[2]), sy = Math.hypot(e[4], e[5], e[6]);
    return +(sx / sy).toFixed(2);
  };
  const side = await measure(sideways, 1.8);
  return { front: await measure(fwd, 1.8), side };
});
check('v0.06 H1 a head seen from the front is drawn wider (no crop: the frame keeps clear margin), narrower from the side', head.front >= 1.15 && head.side < head.front, JSON.stringify(head));
await shot(page, 'head-front-fp');

check('v0.06 part 4: no console/page errors', errors.length === 0, errors.join(' | '));
await browser.close();
const failed = results.filter((r) => !r.ok).length;
console.log(`\n${results.length - failed}/${results.length} checks passed`);
process.exit(failed ? 1 : 0);
