// v0.06 part 3 checks: moving townsfolk (T1), ambience zones (T2), positional audio (T3), the cinema band (T4),
// night lighting (W3) and the uncapped frame rate with a fixed-step simulation (W4).
// Usage: npm run build && node test/e2e-town-life.mjs [path/to/index.html]
import { chromium } from 'playwright-core';
import path from 'node:path';
import url from 'node:url';

const file = path.resolve(process.argv[2] ?? 'dist/index.html');
const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH || undefined,
  args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--autoplay-policy=no-user-gesture-required'],
});
const shots = process.env.SHOTS_DIR && path.resolve(process.env.SHOTS_DIR);
const shot = (page, name) => shots ? page.screenshot({ path: path.join(shots, name + '.png') }) : undefined;
const results = [];
const check = (id, ok, detail = '') => { results.push({ id, ok }); console.log(`${ok ? 'PASS' : 'FAIL'}  ${id}${detail ? '  — ' + detail : ''}`); };
const G = (page, fn, arg) => page.evaluate(fn, arg);
const until = (page, fn, arg, timeout = 15000) => page.waitForFunction(fn, arg, { timeout, polling: 100 }).then(() => true, () => false);

async function open(init) {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 } });
  await ctx.addInitScript((init) => {
    localStorage.setItem('gametool.character', JSON.stringify({ name: 'Test', motivation: '', secret: '', created: true }));
    if (init) localStorage.setItem('gametool.settings', init);
  }, init ?? null);
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  await page.goto('file://' + file);
  await page.waitForFunction(() => window.__gametool);
  await page.click('#begin'); await page.mouse.move(5, 5);
  await page.waitForFunction(() => window.__gametool.state === 'play', null, { timeout: 8000 });
  return { ctx, page, errors };
}
const { page, errors } = await open();

// ---------- W4 frame rate ----------
const fps = await G(page, () => { const g = window.__gametool; return { cap: g.settings.fpsCap, preset: g.settings.preset, schema: g.settings.schemaVersion }; });
check('v0.06 W4 Medium renders uncapped (∞) by default', fps.preset === 'medium' && fps.cap === 0 && fps.schema === 2, JSON.stringify(fps));
// Same walk, capped at 30 and uncapped: the fixed-step simulation keeps the speed per simulated second.
const speedAt = async (cap) => {
  await G(page, (cap) => { const g = window.__gametool; g.settings.fpsCap = cap; g.parked ??= g.world.colliders.splice(0); const p = g.player; p.pos.set(0, 0, 30); p.yaw = Math.PI / 2; p.bodyYaw = p.yaw; }, cap);
  await page.keyboard.down('KeyW'); await page.waitForTimeout(200);
  const a = await G(page, () => { const g = window.__gametool; return { x: g.player.pos.x, z: g.player.pos.z, t: g.perf.simSeconds }; });
  await page.waitForTimeout(1200);
  const b = await G(page, () => { const g = window.__gametool; return { x: g.player.pos.x, z: g.player.pos.z, t: g.perf.simSeconds }; });
  await page.keyboard.up('KeyW');
  return Math.hypot(b.x - a.x, b.z - a.z) / (b.t - a.t);
};
const s30 = await speedAt(30), sInf = await speedAt(0);
await G(page, () => { const g = window.__gametool; g.world.colliders.push(...g.parked); g.parked = null; g.settings.fpsCap = 0; });
check('v0.06 W4 movement speed is the same capped at 30 and uncapped', Math.abs(s30 - sInf) / sInf < 0.05, `${s30.toFixed(2)} vs ${sInf.toFixed(2)} m/s`);

// ---------- T1 townsfolk ----------
const folk0 = await G(page, () => window.__gametool.townsfolk.folk.filter((f) => f.active).map((f) => ({ id: f.id, name: f.name, role: f.role, x: f.root.position.x, z: f.root.position.z })));
const roles = folk0.reduce((m, f) => (m[f.role] = (m[f.role] ?? 0) + 1, m), {});
check('v0.06 T1 at least 8 ambient townsfolk: walkers, 2–3 at the dojo, 1–2 at the store, chatting pairs', folk0.filter((f) => f.role !== 'band').length >= 8 && roles.walker >= 2 && roles.sparring + (roles.drill ?? 0) >= 2 && roles.customer >= 1 && roles.chat >= 2, JSON.stringify(roles));
check('v0.06 T1 townsfolk have role names only (placeholders, "the …")', folk0.every((f) => /^the [A-Z]/.test(f.name)), folk0.map((f) => f.name).join(', '));
// Watch the walkers for a while: they move, and never stand inside a lot, the well or a collider.
let worst = { lots: Infinity, well: Infinity, col: Infinity }, moved = 0;
const first = await G(page, () => window.__gametool.townsfolk.folk.filter((f) => f.role === 'walker').map((f) => [f.root.position.x, f.root.position.z]));
for (let i = 0; i < 16; i++) {
  await page.waitForTimeout(500);
  const w = await G(page, () => {
    const g = window.__gametool, out = { lots: Infinity, well: Infinity, col: Infinity };
    for (const f of g.townsfolk.folk) {
      if (!f.active || f.role === 'band') continue;
      const p = f.root.position, c = g.townsfolk.clearance(p.x, p.z);
      out.lots = Math.min(out.lots, c.lots); out.well = Math.min(out.well, c.well);
      for (const k of g.world.colliders) if (k.kind === 'circle' && !(k.top !== undefined && k.top < 0.35)) out.col = Math.min(out.col, Math.hypot(p.x - k.x, p.z - k.z) - k.r);
    }
    return out;
  });
  worst = { lots: Math.min(worst.lots, w.lots), well: Math.min(worst.well, w.well), col: Math.min(worst.col, w.col) };
}
const last = await G(page, () => window.__gametool.townsfolk.folk.filter((f) => f.role === 'walker').map((f) => [f.root.position.x, f.root.position.z]));
moved = first.filter((p, i) => Math.hypot(p[0] - last[i][0], p[1] - last[i][1]) > 2).length;
check('v0.06 T1 walkers walk between buildings', moved >= 2, `${moved} of ${first.length} moved > 2 m in 8 s`);
check('v0.06 T1 nobody clips a building, the well or a lamp post', worst.lots > 0 && worst.well > 0.2 && worst.col > 0.1, JSON.stringify(worst));
const acts = await G(page, () => { const f = window.__gametool.townsfolk.folk; return { spar: f.filter((x) => x.role === 'sparring').map((x) => x.pose), walking: f.filter((x) => x.role === 'walker').some((x) => x.speed > 0) }; });
let talkers = new Set();
for (let i = 0; i < 12; i++) { (await G(page, () => window.__gametool.townsfolk.folk.filter((f) => f.talking).map((f) => f.id))).forEach((id) => talkers.add(id)); await page.waitForTimeout(500); }
check('v0.06 T1 the dojo pupils spar; the chatting pairs and customers take turns to talk', acts.spar.every((p) => p === 'punch' || p === 'stance') && talkers.size >= 3, JSON.stringify({ ...acts, talkers: talkers.size }));
const verbs = await G(page, () => window.__gametool.interactables.map((t) => { try { return t.verb(); } catch { return ''; } }));
check('v0.06 T1 the interactive NPCs are untouched (shopkeeper, Projectionist)', verbs.includes('Trade with the Shopkeeper') && verbs.some((v) => /Projectionist/.test(v)));
await G(page, () => { const p = window.__gametool.player; p.pos.set(4, 0, 15); p.yaw = Math.PI; p.pitch = -0.1; });
await page.waitForTimeout(1500);
await shot(page, 'town-life-sunset');

// ---------- T2 / T3 sound ----------
const zones = await G(page, () => window.__gametool.ambience.zones.map((z) => ({ name: z.name, kind: z.kind, x: z.x, z: z.z, range: z.range })));
const kinds = new Set(zones.map((z) => z.kind));
check('v0.06 T2 ambience zones: birdsong in the trees, the well, the smithy, chatter at the store', ['birds', 'water', 'forge', 'chatter'].every((k) => kinds.has(k)) && zones.filter((z) => z.kind === 'birds').length >= 3, JSON.stringify([...kinds]));
const forge = zones.find((z) => z.kind === 'forge');
const heard = () => G(page, () => ({ ...window.__gametool.ambience.heard }));
await G(page, (f) => { const p = window.__gametool.player; p.pos.set(f.x + 3, 0, f.z + 1); }, forge);
const h0 = await heard(); await page.waitForTimeout(3500); const h1 = await heard();
await G(page, (f) => { const p = window.__gametool.player; p.pos.set(f.x + 40, 0, f.z - 30); }, forge);
await page.waitForTimeout(600);
const h2 = await heard(); await page.waitForTimeout(3500); const h3 = await heard();
check('v0.06 T2 the smithy\'s hammer rings near it and stops far away', (h1.forge ?? 0) > (h0.forge ?? 0) && (h3.forge ?? 0) === (h2.forge ?? 0), JSON.stringify({ near: (h1.forge ?? 0) - (h0.forge ?? 0), far: (h3.forge ?? 0) - (h2.forge ?? 0) }));
const fall = await G(page, (f) => {
  const a = window.__gametool.audio, g = [];
  for (const d of [1, 4, 8, 12, 15.5, 20]) { a.setListener(f.x + d, 1.7, f.z, 0, -1); g.push(+a.gainAt(f.x, 1.7, f.z, 16).toFixed(2)); }
  a.setListener(f.x, 1.7, f.z + 5, 0, -1);
  const right = a.panAt(f.x + 3, f.z + 5), left = a.panAt(f.x - 3, f.z + 5);
  const p = a.sources.find((s) => s.name === 'forge')?.panner;
  return { g, right, left, model: p?.distanceModel, max: p?.maxDistance };
}, forge);
check('v0.06 T3 a source fades with distance and is silent past its range', fall.g.every((v, i) => i === 0 || v <= fall.g[i - 1]) && fall.g[0] === 1 && fall.g[5] === 0 && fall.model === 'linear' && fall.max === 16, JSON.stringify(fall));
check('v0.06 T3 stereo: a source on your right pans right, on your left pans left', fall.right > 0.5 && fall.left < -0.5, JSON.stringify({ r: fall.right, l: fall.left }));
await G(page, () => { const p = window.__gametool.player; p.pos.set(6, 0, 20); });
await page.waitForTimeout(400);
const ear = await G(page, () => { const g = window.__gametool; return { a: g.audio.listener, e: g.player.eyePos }; });
check('v0.06 T3 the listener follows the player\'s head', Math.hypot(ear.a.x - ear.e.x, ear.a.z - ear.e.z) < 0.5, JSON.stringify(ear));
await G(page, () => window.__gametool.openCampfire());
await until(page, () => window.__gametool.campfire.isOpen);
const fire = await G(page, () => { const g = window.__gametool, s = g.audio.sources.find((q) => q.name === 'campfire'), f = g.world.stations.campfire.position; return s && { d: Math.hypot(s.x - f.x, s.z - f.z), range: s.range }; });
check('v0.06 T3 the campfire band plays from the fire', !!fire && fire.d < 0.5 && fire.range > 15, JSON.stringify(fire));
await G(page, () => window.__gametool.campfire.close());
await until(page, () => window.__gametool.state === 'play');

// ---------- T4 cinema band ----------
const band = await G(page, () => { const g = window.__gametool, k = g.world.scene.getObjectByName('projectionist').position; return g.townsfolk.folk.filter((f) => f.role === 'band').map((f) => ({ name: f.name, d: +Math.hypot(f.root.position.x - k.x, f.root.position.z - k.z).toFixed(1), pose: f.pose, inst: !!f.root.getObjectByName('instrument:' + f.root.userData.instrument) })); });
check('v0.06 T4 a band of three stands by the Projectionist\'s screen, idle with no reel on', band.length === 3 && band.every((b) => b.d < 7 && b.inst && b.pose === null), JSON.stringify(band));
const fx = (f) => url.pathToFileURL(path.resolve('test/fixtures/cinema', f)).href;
await G(page, (webm) => { window.__gametool.cinema.clips = [{ id: 'test-reel', title: 'Test Reel', credit: 'Test', sound: true, webm }]; }, fx('test-reel.webm'));
await G(page, () => window.__gametool.openCinema());
await until(page, () => window.__gametool.cinema.playing === 'video', null, 8000);
const quiet = await G(page, () => window.__gametool.townsfolk.folk.filter((f) => f.role === 'band').every((f) => f.pose === null));
await page.click('#cinSound');
const playing = await until(page, () => window.__gametool.townsfolk.folk.filter((f) => f.role === 'band').map((f) => f.pose).join() === 'fiddle,drum,pipe', null, 4000);
const reel = await G(page, () => { const g = window.__gametool, s = g.audio.sources.find((q) => q.name === 'cinema'), k = g.world.scene.getObjectByName('cinema-screen').position; return s && { d: Math.hypot(s.x - k.x, s.z - k.z), range: s.range }; });
check('v0.06 T4 the band plays while a reel with sound plays (not while it\'s muted)', quiet && playing, JSON.stringify({ quiet, playing }));
check('v0.06 T3/T4 the reel\'s sound comes from the screen', !!reel && reel.d < 0.5, JSON.stringify(reel));
await page.click('#cinClose');
await until(page, () => window.__gametool.state === 'play');
check('v0.06 T4 the band stops when the reel stops', await until(page, () => window.__gametool.townsfolk.folk.filter((f) => f.role === 'band').every((f) => f.pose === null), null, 3000));

// ---------- W3 night ----------
const dusk = await G(page, () => { const g = window.__gametool; return { far: g.world.scene.fog.far, win: g.world.town.windows.color.r }; });
await G(page, () => { const g = window.__gametool; g.world.setTime('night'); g.nightLights.setTime('night'); const p = g.player; p.pos.set(4, 0, 15); p.yaw = Math.PI; p.pitch = -0.1; });
await page.waitForTimeout(2500);
const night = await G(page, () => { const g = window.__gametool, n = g.nightLights; return { lit: n.lit, halos: n.halos.visible && n.halos.material.opacity > 0.5, count: n.halos.count, lanterns: g.world.lanterns.length, far: g.world.scene.fog.far, win: g.world.town.windows.color.r, near: n.lights.filter((l) => l.visible).map((l) => +Math.hypot(l.position.x - g.player.pos.x, l.position.z - g.player.pos.z).toFixed(1)) }; });
check('v0.06 W3 at night every lantern glows (halos) and 4 warm lights burn at the lanterns nearest you', night.lit === 4 && night.halos && night.count === night.lanterns && night.lanterns >= 20 && night.near.every((d) => d < 16), JSON.stringify(night));
check('v0.06 W3 lit windows burn brighter and the night fog closes in', night.win > dusk.win && night.far < dusk.far, JSON.stringify({ dusk, night: { win: night.win, far: night.far } }));
// Read the frame right after it's drawn (the WebGL buffer isn't kept): a rAF queued now runs after the game's.
const px = await G(page, () => new Promise((done) => requestAnimationFrame(() => { const c = document.querySelector('canvas'), g = document.createElement('canvas'); g.width = 64; g.height = 36; const x = g.getContext('2d'); x.drawImage(c, 0, 0, 64, 36); const d = x.getImageData(0, 0, 64, 36).data; let sum = 0, max = 0; for (let i = 0; i < d.length; i += 4) { const l = (d[i] + d[i + 1] + d[i + 2]) / 3; sum += l; max = Math.max(max, l); } done({ mean: sum / (d.length / 4), max }); })));
check('v0.06 W3 night reads (lanterns bright) but stays dark overall', px.mean > 8 && px.mean < 90 && px.max > 150, JSON.stringify(px));
await shot(page, 'town-life-night');
await G(page, () => { document.getElementById('preset').value = 'low'; document.getElementById('preset').dispatchEvent(new Event('change')); });
const low = await G(page, () => { const g = window.__gametool; return { lit: g.nightLights.lit, folk: g.townsfolk.activeCount, cap: g.settings.fpsCap }; });
check('v0.06 T1/W3/W4 Low preset: fewer townsfolk, 2 real lights, 30 fps cap', low.lit === 2 && low.folk < 8 && low.folk >= 4 && low.cap === 30, JSON.stringify(low));
check('v0.06 town life: no console/page errors', errors.length === 0, errors.join(' | '));

// ---------- W4 migration: a v0.05 save with Medium's old 60 cap opens uncapped ----------
{
  const old = JSON.stringify({ schemaVersion: 1, preset: 'medium', fpsCap: 60, renderScale: 75 });
  const { ctx, page: p2 } = await open(old);
  const cap = await G(p2, () => window.__gametool.settings.fpsCap);
  check('v0.06 W4 an older save on Medium (60) moves to the uncapped default', cap === 0, String(cap));
  await ctx.close();
}

await browser.close();
const failed = results.filter((r) => !r.ok).length;
console.log(`\n${results.length - failed}/${results.length} checks passed`);
process.exit(failed ? 1 : 0);
