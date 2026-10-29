// v0.06 part 2 checks: the centre dais is gone (W1), station poses (S1) and the swaying station camera (S2), the
// tailor never hides you (S3), the weapon stays still and turns by drag (S4), the writing desk (S5), the campfire
// list (C1–C3) and the phone crossbow layout (U1–U2).
// Usage: npm run build && node test/e2e-stations.mjs [path/to/index.html]
import { chromium } from 'playwright-core';
import path from 'node:path';

const file = path.resolve(process.argv[2] ?? 'dist/index.html');
const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH || undefined,
  args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'],
});
// Screenshots only when SHOTS_DIR is set (v0.06 part 2 shot set).
const shots = process.env.SHOTS_DIR && path.resolve(process.env.SHOTS_DIR);
const shot = (page, name) => shots ? page.screenshot({ path: path.join(shots, name + '.png') }) : undefined;
const results = [];
const check = (id, ok, detail = '') => { results.push({ id, ok }); console.log(`${ok ? 'PASS' : 'FAIL'}  ${id}${detail ? '  — ' + detail : ''}`); };
const G = (page, fn, arg) => page.evaluate(fn, arg);
const until = (page, fn, arg, timeout = 15000) => page.waitForFunction(fn, arg, { timeout, polling: 100 }).then(() => true, () => false);
const frames = (page, n = 3) => G(page, (n) => new Promise((r) => { const f = () => (--n <= 0 ? r() : requestAnimationFrame(f)); requestAnimationFrame(f); }), n);

async function open(opts = { viewport: { width: 1280, height: 800 } }, pad = false) {
  const ctx = await browser.newContext(opts);
  await ctx.addInitScript((pad) => {
    localStorage.setItem('gametool.character', JSON.stringify({ name: 'Test', motivation: '', secret: '', created: true }));
    if (pad) {
      const p = { id: 'Test Pad (STANDARD GAMEPAD)', index: 0, connected: true, mapping: 'standard', timestamp: 0,
        axes: [0, 0, 0, 0], buttons: Array.from({ length: 17 }, () => ({ pressed: false, touched: false, value: 0 })) };
      window.__pad = p; navigator.getGamepads = () => [p, null, null, null];
    }
  }, pad);
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  await page.goto('file://' + file);
  // The first page stays open while later ones load; two software-rendered towns share the CPU.
  await page.waitForFunction(() => window.__gametool, null, { timeout: 90000 });
  if (opts.hasTouch) await page.tap('#begin'); else { await page.click('#begin'); await page.mouse.move(5, 5); }
  await page.waitForFunction(() => window.__gametool.state === 'play', null, { timeout: 60000 });
  return { ctx, page, errors };
}
// Is every point inside the frame, and (desktop) right of the panel?
const framed = (page, pts) => G(page, (pts) => {
  const g = window.__gametool, V = g.Vector3, panel = document.querySelector('.forge:not(.hidden) .forge-panel');
  const edge = panel ? (panel.getBoundingClientRect().right / innerWidth) * 2 - 1 : -1;
  return pts.map(([x, y, z]) => { const v = new V(x, y, z).project(g.camera); return { x: +v.x.toFixed(2), y: +v.y.toFixed(2), ok: v.x > edge - 0.02 && v.x < 1 && v.y > -1 && v.y < 1 && v.z < 1 }; });
}, pts);

const { page, errors } = await open();

// ---------- W1 no centre dais ----------
const dais = await G(page, () => {
  const g = window.__gametool, r = new g.Raycaster(), V = g.Vector3; r.camera = g.camera;
  const top = (x, z) => { r.set(new V(x, 4, z), new V(0, -1, 0)); const skip = (o) => { for (let q = o; q; q = q.parent) if (q.userData.rig || q.name === 'natalie' || q.isSprite) return true; return false; };
    const h = r.intersectObjects(g.world.scene.children, true).find((i) => i.object.visible && !skip(i.object)); return h ? +h.point.y.toFixed(2) + ':' + (h.object.name || h.object.type) : null; };
  return { centre: top(0.4, 0), pillars: [top(0, -2.6), top(2.6, 0), top(-2.6, 0)], target: 'bookTarget' in g.world };
});
check('v0.06 W1 the rune dais, pillars, lectern and book are gone from the centre', parseFloat(dais.centre) < 0.1 && dais.pillars.every((y) => parseFloat(y) < 0.1) && !dais.target, JSON.stringify(dais));

await shot(page, 'centre-no-dais');

// ---------- S5 writing desk ----------
const deskVerb = await G(page, () => window.__gametool.interactables.find((t) => t.obj === window.__gametool.world.stations.banner).verb());
const page3d = await G(page, () => { const c = window.__gametool.world.bannerCloth; const n = new window.__gametool.Vector3(0, 0, 1).applyQuaternion(c.quaternion); return { y: +c.position.y.toFixed(2), up: +n.y.toFixed(2), sketch: !!c.userData.sketch }; });
check('v0.06 S5 the sketchbook station is a writing desk; your sketch lies on its page', deskVerb === 'Sketch at the writing desk' && page3d.y < 1.1 && page3d.up > 0.8 && page3d.sketch, JSON.stringify({ deskVerb, page3d }));

// ---------- S1 + S2 per station ----------
const station = async (name, openFn, pose, pts) => {
  await G(page, openFn);
  await until(page, () => window.__gametool.state === 'forge');
  await until(page, () => window.__gametool.stationView?.t > 0.7, null, 15000);   // past the blend in (and any first-use shader compile)
  const p = await G(page, () => window.__gametool.stationPose);
  const pos = await G(page, () => { const p = window.__gametool.player.pos; return [p.x, p.z]; });
  const f = await framed(page, [...pts, [pos[0], 0.1, pos[1]], [pos[0], 1.6, pos[1]]]);
  const c0 = await G(page, () => window.__gametool.camera.position.clone());
  const t1 = await G(page, () => window.__gametool.stationView.t);
  await until(page, (t1) => window.__gametool.stationView?.t > t1 + 1, t1, 15000);
  const moved = await G(page, (c0) => window.__gametool.camera.position.distanceTo(c0), c0);
  await shot(page, 'station-' + name.replace(/ /g, '-'));
  check(`v0.06 S1–S2 ${name}: pose "${pose}", the whole station and you in frame, the camera sways`, p === pose && f.every((q) => q.ok) && moved > 0.005, JSON.stringify({ p, f: f.filter((q) => !q.ok), moved: +moved.toFixed(3) }));
};
await station('campfire', () => window.__gametool.openCampfire(), 'sit', await G(page, () => { const f = window.__gametool.world.stations.campfire.position; return [[f.x, 0.1, f.z], [f.x, 1.0, f.z], [f.x - 0.7, 1.5, f.z - 2.3]]; }));
await G(page, () => window.__gametool.campfire.close());
await until(page, () => window.__gametool.state === 'play');
check('v0.06 S1 leaving the station drops the pose', await until(page, () => window.__gametool.stationPose === null && !window.__gametool.rig.inShot, null, 3000));
await G(page, () => window.__gametool.inventory.give('crossbow', 1));
await station('anvil', () => window.__gametool.openWeaponForge(), 'smith', await G(page, () => { const a = window.__gametool.world.stations.anvil.position; return [[a.x, 0.1, a.z], [a.x, 2.0, a.z]]; }));

// ---------- S4 weapon stays still, turns by drag ----------
const r0 = await G(page, () => window.__gametool.weaponDisplay.rotation.y);
await page.waitForTimeout(800);
const still = await G(page, (r0) => window.__gametool.weaponDisplay.rotation.y === r0, r0);
await page.mouse.move(1000, 400); await page.mouse.down({ button: 'right' }); await page.mouse.move(1080, 420, { steps: 4 }); await page.mouse.up({ button: 'right' });
const r1 = await G(page, () => window.__gametool.weaponDisplay.rotation.y);
await page.waitForTimeout(600);
const kept = await G(page, (r1) => window.__gametool.weaponDisplay.rotation.y === r1, r1);
check('v0.06 S4 the weapon does not spin; a right-drag turns it and it stays at that angle', still && Math.abs(r1 - r0) > 0.5 && kept, JSON.stringify({ r0, r1 }));
await page.keyboard.press('Escape');
await until(page, () => window.__gametool.state === 'play');

await station('mirror', () => { const g = window.__gametool, m = g.world.stations.mirror.position; g.player.pos.set(m.x + 1, 0, m.z + 1); g.openCharacterForge(); }, 'mirror', await G(page, () => { const m = window.__gametool.world.stations.mirror.position; return [[m.x, 0.1, m.z], [m.x, 1.9, m.z]]; }));
await page.keyboard.press('Escape');
await until(page, () => window.__gametool.state === 'play');
await station('writing desk', () => window.__gametool.openSketchbook(), 'write', await G(page, () => { const d = window.__gametool.world.stations.banner.position; return [[d.x, 0.1, d.z], [d.x, 1.2, d.z]]; }));
await page.keyboard.press('Escape');
await until(page, () => window.__gametool.state === 'play');

// ---------- S3 tailor ----------
await G(page, () => { const g = window.__gametool, d = g.world.town.doors.tailor, ry = d.rotation.y; g.player.pos.set(d.position.x + Math.sin(ry) * 1.6, 0, d.position.z + Math.cos(ry) * 1.6); g.openCharacterForge(); });
await until(page, () => window.__gametool.characterForge.isOpen);
await page.waitForTimeout(900);
const tailor = await G(page, () => {
  const g = window.__gametool, c = g.camera.position, p = g.player.pos, head = new g.Vector3(p.x, 1.4, p.z), r = new g.Raycaster(); r.camera = g.camera;
  r.set(c, head.clone().sub(c).normalize()); r.far = c.distanceTo(head) - 0.6;
  const block = r.intersectObjects(g.world.scene.children, true).find((i) => i.object.visible && !i.object.material?.transparent);
  const d = g.world.town.doors.tailor, out = (c.x - d.position.x) * Math.sin(d.rotation.y) + (c.z - d.position.z) * Math.cos(d.rotation.y);
  return { blocked: block ? block.object.name || block.object.type : null, out: +out.toFixed(2) };
});
check('v0.06 S3 at the tailor the camera stays out on the street and nothing stands between it and you', !tailor.blocked && tailor.out > 1, JSON.stringify(tailor));
await page.keyboard.press('Escape');
await until(page, () => window.__gametool.state === 'play');

// ---------- C1–C2 campfire list ----------
await G(page, () => window.__gametool.openCampfire());
await until(page, () => window.__gametool.campfire.isOpen);
await shot(page, 'campfire-list');
const list = await G(page, () => ({ items: [...document.querySelectorAll('#campfire .cf-sec')].map((b) => b.textContent.trim()), open: [...document.querySelectorAll('#campfire .cf-item.open')].length, icons: document.querySelectorAll('#campfire .cf-sec .cf-ico').length }));
check('v0.06 C1 the campfire is a list of big icon buttons: Sleep, Play along, Hear a tale, Tell a tale, Leave; one open', list.items.map((t) => t.slice(1).trim()).join() === 'Sleep,Play along,Hear a tale,Tell a tale,Leave' && list.open === 1 && list.icons === 5, JSON.stringify(list));
await G(page, () => { document.activeElement?.blur(); window.__gametool.menuInput('down'); });   // focus Sleep
await G(page, () => window.__gametool.menuInput('ok'));
const sleepOpen = await G(page, () => ({ sec: window.__gametool.campfire.section, open: document.querySelectorAll('#campfire .cf-item.open').length, btn: document.querySelector('#cfSleep')?.textContent, focus: document.activeElement?.id }));
await G(page, () => window.__gametool.menuInput('back'));
const collapsed = await G(page, () => ({ sec: window.__gametool.campfire.section, focus: document.activeElement?.dataset.sec, open: window.__gametool.campfire.isOpen }));
check('v0.06 C1 D-pad: A opens Sleep (closing Play along) and steps in; B collapses it', sleepOpen.sec === 'sleep' && sleepOpen.open === 1 && sleepOpen.focus === 'cfSleep' && collapsed.sec === null && collapsed.focus === 'sleep' && collapsed.open, JSON.stringify({ sleepOpen, collapsed }));
const t0 = await G(page, () => window.__gametool.world.time);
await G(page, () => { window.__gametool.campfire.openSection('sleep'); });
await page.click('#cfSleep');
const slept = await until(page, (t0) => window.__gametool.world.time !== t0, t0, 4000);
const kneel = await G(page, () => window.__gametool.stationPose);
check('v0.06 C2 Sleep is open as soon as you sit; it kneels you on the bedroll and the hour moves on', !!sleepOpen.btn && /^Sleep until/.test(sleepOpen.btn) && slept && kneel === null, JSON.stringify({ btn: sleepOpen.btn, kneel }));
await G(page, () => window.__gametool.openCampfire());
await until(page, () => window.__gametool.campfire.isOpen);
await G(page, () => { const g = window.__gametool; g.campfire.openSection(null); document.activeElement?.blur(); g.menuInput('back'); });
check('v0.06 C1 B with nothing open leaves the fire', await until(page, () => !window.__gametool.campfire.isOpen && window.__gametool.state === 'play', null, 3000));

// ---------- C3 controller band ----------
{
  const { ctx, page: pp, errors: pe } = await open(undefined, true);
  const btn = async (i) => {
    await G(pp, (i) => { window.__pad.buttons[i].pressed = true; window.__pad.buttons[i].value = 1; }, i); await frames(pp, 2);
    await G(pp, (i) => { window.__pad.buttons[i].pressed = false; window.__pad.buttons[i].value = 0; }, i); await frames(pp, 2);
  };
  await btn(12); await btn(12);   // any button: the pad is the input now
  await G(pp, () => { const g = window.__gametool; g.inventory.give('lute', 1); g.openCampfire(); });
  await until(pp, () => window.__gametool.campfire.isOpen);
  await G(pp, () => document.querySelector('#campfire [data-play="lute"]').click());
  const labels = await G(pp, () => [...document.querySelectorAll('#campfire .cf-pad kbd')].map((k) => k.textContent));
  const hits0 = await G(pp, () => window.__gametool.audio.ctx?.currentTime ?? 0);
  await btn(2);
  const hit = await G(pp, () => document.querySelector('#campfire [data-pad="0"]').classList.contains('hit'));
  await btn(7);
  const hit5 = await G(pp, () => document.querySelector('#campfire [data-pad="5"]').classList.contains('hit'));
  check('v0.06 C3 with a controller the note keys show pad buttons (X Y LB RB LT RT) and the pad plays them', labels.join() === 'X,Y,LB,RB,LT,RT' && hit && hit5, JSON.stringify({ labels, hits0 }));
  await pp.mouse.move(300, 300); await pp.mouse.move(320, 310);
  await pp.keyboard.press('Shift');
  const keys = await until(pp, () => [...document.querySelectorAll('#campfire .cf-pad kbd')].map((k) => k.textContent).join() === '1,2,3,4,5,6', null, 3000);
  check('v0.06 C3 the labels swap back to number keys live when the keyboard is used', keys);
  check('v0.06 C3: no console/page errors', pe.length === 0, pe.join(' | '));
  await ctx.close();
}

// ---------- U1–U2 phone crossbow layout ----------
for (const vp of [{ width: 640, height: 360 }, { width: 844, height: 390 }, { width: 1280, height: 800 }]) {
  const { ctx, page: tp, errors: te } = await open({ viewport: vp, hasTouch: true, isMobile: true });
  await G(tp, () => { const g = window.__gametool; g.inventory.give('crossbow', 1); g.inventory.give('bolt', 5); });
  await tp.keyboard.press('Digit2').catch(() => undefined);
  await G(tp, () => document.querySelector('[data-act="bow"]')?.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true })));
  await until(tp, () => window.__gametool.crossbow.equipped, null, 4000);
  await frames(tp, 4);
  await shot(tp, `phone-crossbow-${vp.width}x${vp.height}`);
  const lay = await G(tp, () => {
    const bs = [...document.querySelectorAll('#touch .t-btn')].filter((b) => b.offsetParent !== null).map((b) => ({ a: b.dataset.act, r: b.getBoundingClientRect() }));
    const over = [];
    for (let i = 0; i < bs.length; i++) for (let j = i + 1; j < bs.length; j++) {
      const a = bs[i].r, b = bs[j].r;
      if (a.left < b.right - 1 && b.left < a.right - 1 && a.top < b.bottom - 1 && b.top < a.bottom - 1) over.push(bs[i].a + '/' + bs[j].a);
    }
    const out = bs.filter(({ r }) => r.left < 0 || r.top < 0 || r.right > innerWidth || r.bottom > innerHeight).map((b) => b.a);
    const small = bs.filter(({ r }) => r.width < 44 || r.height < 44).map((b) => b.a);
    return { n: bs.length, fire: bs.some((b) => b.a === 'fire'), over, out, small };
  });
  check(`v0.06 U1–U2 ${vp.width}×${vp.height} crossbow out: every button tappable (no overlap, on screen, ≥ 44 px)`, lay.fire && !lay.over.length && !lay.out.length && !lay.small.length, JSON.stringify(lay));
  if (shots && vp.width === 844) {
    await G(tp, () => window.__gametool.openCampfire());
    await until(tp, () => window.__gametool.stationView?.t > 0.7, null, 15000);
    await shot(tp, 'phone-campfire-844x390');
    await G(tp, () => window.__gametool.campfire.close());
  }
  check(`v0.06 ${vp.width}×${vp.height}: no console/page errors`, te.length === 0, te.join(' | '));
  await ctx.close();
}

check('v0.06 stations: no console/page errors', errors.length === 0, errors.join(' | '));
await browser.close();
const failed = results.filter((r) => !r.ok).length;
console.log(`\n${results.length - failed}/${results.length} checks passed`);
process.exit(failed ? 1 : 0);
