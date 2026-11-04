// Town style 2 (Mike 2026-11-04): the town's buildings and street as pixel art (32 px a metre, a few tones per
// channel, hard texels up close), and a warm pool of light on the ground under every lantern from dusk.
// The countryside keeps its painted textures; the 3D named NPCs and the player are untouched.
// Usage: node test/e2e-town-pixel.mjs [path/to/index.html]   (CHROMIUM_PATH as in e2e.mjs)
import { chromium } from 'playwright-core';
import path from 'node:path';

const file = path.resolve(process.argv[2] ?? 'dist/index.html');
const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH || undefined,
  args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'],
});
const results = [];
const check = (id, ok, detail = '') => { results.push({ id, ok }); console.log(`${ok ? 'PASS' : 'FAIL'}  ${id}${detail ? '  — ' + detail : ''}`); };
const page = await (await browser.newContext({ viewport: { width: 960, height: 540 } })).newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
await page.route(/^https?:/, (r) => r.abort());
await page.goto('file://' + file);
await page.waitForFunction(() => window.__gametool, null, { timeout: 90000 });
await page.waitForTimeout(400);
await page.click('#begin');
await page.waitForFunction(() => window.__gametool.state === 'play', null, { timeout: 90000 });
const G = (fn, a) => page.evaluate(fn, a);

// Which textures are on screen in the town, and how they are filtered.
const tex = await G(() => {
  const g = window.__gametool, inn = g.world.town.doors.inn.position, seen = new Map();
  g.world.scene.traverse((o) => {
    if (!o.isMesh || !o.material?.map?.image) return;
    const m = o.material, t = m.map, img = t.image;
    if (!(img instanceof HTMLCanvasElement)) return;
    o.geometry.computeBoundingBox?.();
    const b = o.geometry.boundingBox; if (!b) return;
    const c = b.getCenter(new g.Vector3()).applyMatrix4(o.matrixWorld);
    seen.set(t.uuid, { w: img.width, art: !!t.userData.pixelArt, nearest: t.magFilter === 1003, town: Math.hypot(c.x - inn.x, c.z - inn.z) < 45, img });
  });
  const town = [...seen.values()].filter((s) => s.art), painted = [...seen.values()].filter((s) => !s.art && s.w === 64);
  // Posterized: few distinct tones per channel.
  let maxTones = 0;
  for (const s of town) {
    const d = s.img.getContext('2d').getImageData(0, 0, s.img.width, s.img.height).data, tones = new Set();
    for (let i = 0; i < d.length; i += 4) tones.add(d[i] << 16 | d[i + 1] << 8 | d[i + 2]);
    maxTones = Math.max(maxTones, tones.size);
  }
  return { nearest: town.every((s) => s.nearest), inTown: town.every((s) => s.town), town: town.length, sizes: [...new Set(town.map((s) => s.w))], painted: painted.length, maxTones };
});
check('Town buildings and street use pixel-art textures (32 px a metre, hard texels)', tex.town >= 7 && tex.sizes.every((w) => w === 32) && tex.nearest, JSON.stringify(tex));
check('Pixel-art textures use a small palette (6 colours each)', tex.maxTones > 1 && tex.maxTones <= 6, JSON.stringify(tex));
check('The countryside keeps its painted textures', tex.painted >= 3, JSON.stringify(tex));

// Lamp pools: one per lantern, on the ground, dark by day, warm from dusk, brighter at night.
const pools = await G(() => {
  const g = window.__gametool, nl = g.nightLights, p = nl.pools;
  const out = { count: p.count, lanterns: nl.anchors.length, inst: p.isInstancedMesh, nearest: p.material.map.magFilter === 1003, ys: [] , states: {} };
  const M = new p.matrixWorld.constructor(), v = new g.Vector3();
  for (let i = 0; i < p.count; i++) { p.getMatrixAt(i, M); v.setFromMatrixPosition(M); out.ys.push(+(v.y - g.world.heightAt(v.x, v.z)).toFixed(3)); }
  for (const t of ['day', 'sunset', 'night']) { g.world.setTime(t); g.nightLights.setTime(t); out.states[t] = { vis: p.visible, op: p.material.opacity }; }
  out.additive = p.material.blending === 2 && !p.material.depthWrite;
  return out;
});
check('A light pool under every lantern, in one instanced draw', pools.inst && pools.count === pools.lanterns && pools.count >= 8, JSON.stringify({ c: pools.count, l: pools.lanterns }));
check('Pools sit just above the ground', pools.ys.every((y) => y > 0 && y < 0.1), JSON.stringify(pools.ys.slice(0, 6)));
check('Pools are pixel-art rings (hard texels), additive, no depth write', pools.nearest && pools.additive);
const st = pools.states;
check('Off by day, warm at dusk, brighter at night', !st.day.vis && st.sunset.vis && st.night.vis && st.night.op > st.sunset.op && st.sunset.op > 0, JSON.stringify(st));

// At night the ground under a lantern is lit: render one frame from above it, with and without the pools.
const bright = (on) => G((on) => {
  const g = window.__gametool, r = g.renderer, a = g.nightLights.anchors[g.nightLights.anchors.length - 1], gy = g.world.heightAt(a.x, a.z);
  g.nightLights.pools.visible = on;
  const cam = g.camera.clone(); cam.position.set(a.x + 3, gy + 2.6, a.z + 0.5); cam.lookAt(a.x, gy, a.z); cam.updateMatrixWorld();
  r.render(g.world.scene, cam);
  const gl = r.getContext(), px = new Uint8Array(4 * 32 * 32);
  gl.readPixels(Math.floor(gl.drawingBufferWidth / 2) - 16, Math.floor(gl.drawingBufferHeight / 2) - 16, 32, 32, gl.RGBA, gl.UNSIGNED_BYTE, px);
  let s = 0; for (let i = 0; i < px.length; i += 4) s += px[i] + px[i + 1] + px[i + 2];
  return s / (32 * 32 * 3);
}, on);
const off = await bright(false), on = await bright(true);
await G(() => { window.__gametool.nightLights.pools.visible = true; });
check('At night the ground under a lantern is lit by its pool', on > off + 4, `${off.toFixed(1)} → ${on.toFixed(1)}`);
check('No page errors', errors.length === 0, errors.slice(0, 3).join(' | '));
await browser.close();
const failed = results.filter((x) => !x.ok).length;
console.log(`\n${results.length - failed}/${results.length} passed`);
process.exit(failed ? 1 : 0);
