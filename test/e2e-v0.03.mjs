// Automated Done-when checks for v0.03 (§8): F2 world/camera, §5 controls, §6.3 daily creation prompt.
// Usage: npm run build && node test/e2e-v0.03.mjs [path/to/index.html]
import { chromium } from 'playwright-core';
import fs from 'node:fs';
import path from 'node:path';

const file = path.resolve(process.argv[2] ?? 'dist/index.html');
const shots = path.resolve(process.env.SHOTS_DIR ?? 'test/screenshots');
fs.mkdirSync(shots, { recursive: true });
const prompts = JSON.parse(fs.readFileSync(path.resolve('content/rolltables/creation-prompts.json'), 'utf8'));
const allPrompts = [...prompts.lore, ...prompts.character, ...prompts.song_food_art];

const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH || undefined,
  args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'],
});
const results = [];
const check = (id, ok, detail = '') => { results.push({ id, ok }); console.log(`${ok ? 'PASS' : 'FAIL'}  ${id}${detail ? '  — ' + detail : ''}`); };
const G = (page, fn, arg) => page.evaluate(fn, arg);

const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
await ctx.addInitScript(() => localStorage.setItem('gametool.character', JSON.stringify({ name: 'Test', motivation: '', secret: '', created: true })));
const page = await ctx.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
await page.route(/^https?:/, (r) => r.abort());
await page.goto('file://' + file);

// ---------- F2.1 load screen + 2 s fade-in ----------
const loaderAtStart = await G(page, () => !!document.getElementById('loader'));
await page.waitForFunction(() => window.__gametool);
const fading = await page.waitForFunction(() => document.getElementById('loader')?.classList.contains('done') ?? true, null, { timeout: 5000 }).then(() => true, () => false);
const dur = await G(page, () => { const l = document.getElementById('loader'); return l ? getComputedStyle(l).transitionDuration : 'removed'; });
await page.waitForTimeout(2400);
const loaderGone = await G(page, () => !document.getElementById('loader'));
check('F2.1 black load screen, then 2 s fade-in once the world is ready', loaderAtStart && fading && loaderGone && (dur === '2s' || dur === 'removed'), `transition ${dur}`);

// ---------- §8 0.03 creativity: daily prompt on the title screen ----------
const shown = (await page.textContent('#dailyPrompt'))?.trim();
const day = await G(page, () => { const n = new Date(); return Math.floor(Date.UTC(n.getFullYear(), n.getMonth(), n.getDate()) / 86400000); });
check('0.03 creativity: title shows one §6.3 prompt from creation-prompts.json', allPrompts.includes(shown), shown);
check('0.03 creativity: the prompt rotates daily', shown === allPrompts[day % allPrompts.length]);
const VERSION = /VERSION = '([^']+)'/.exec(fs.readFileSync(path.resolve('src/version.ts'), 'utf8'))[1];
check('Version label matches src/version.ts', (await page.textContent('#versionLabel'))?.trim() === 'v' + VERSION);
const credit = await G(page, () => { const c = document.getElementById('credit'); const r = c.getBoundingClientRect(); return { t: c.textContent, right: innerWidth - r.right, bottom: innerHeight - r.bottom }; });
check('Owner request: version + "Mike Go" shown bottom right', credit.t === `v${VERSION} · Mike Go` && credit.right < 20 && credit.bottom < 20, JSON.stringify(credit));
await page.screenshot({ path: path.join(shots, 'v03-title.png') });

// ---------- F2.2 sunset ----------
const sky = await G(page, () => {
  const w = window.__gametool.world;
  const dirLight = w.scene.children.find((o) => o.isDirectionalLight);
  const d = dirLight.position.clone().normalize();
  return { elev: Math.asin(d.y) * 180 / Math.PI, color: dirLight.color.getHexString(), declared: w.sunElevationDeg };
});
check('F2.2 orange sun below 15° elevation', sky.elev > 0 && sky.elev < 15 && sky.declared < 15, `${sky.elev.toFixed(1)}°, #${sky.color}`);

// ---------- play ----------
await page.click('#begin');
await page.waitForFunction(() => window.__gametool.state === 'play', null, { timeout: 5000 });
await page.waitForTimeout(600);

// ---------- F2.3 library + door visible from spawn ----------
const door = await G(page, () => {
  const d = window.__gametool.world.libraryDoor;
  d.geometry.computeBoundingBox();
  const box = d.geometry.boundingBox.clone().applyMatrix4(d.matrixWorld);
  return { h: box.max.y - box.min.y, z: d.getWorldPosition(new window.__gametool.Vector3()).z };
});
check('F2.3 door is 3.4 m (2x player)', Math.abs(door.h - 3.4) < 0.01, `${door.h.toFixed(2)} m`);
// Cast from the spawn eyes toward the door (slightly off the lectern's line); the first solid hit must be the door.
const sight = await G(page, () => {
  const g = window.__gametool, w = g.world;
  const a = new g.Vector3(1.2, 1.7, 8.5), b = w.libraryDoor.getWorldPosition(new g.Vector3()).add(new g.Vector3(0.4, 0.6, 0));
  const ray = new g.Raycaster(a, b.clone().sub(a).normalize(), 0, a.distanceTo(b) + 0.5);
  ray.camera = g.camera;   // sprites need a camera to raycast
  // Front-facing solids only: skips outline hulls and the sky dome (BackSide).
  const hits = ray.intersectObjects(w.scene.children, true).filter((h) => h.object.visible && !h.object.isSprite && h.object.material && h.object.material.side === 0 && h.object.material.visible !== false);
  return hits[0]?.object.name || hits[0]?.object.type || 'none';
});
check('F2.3 library door visible from spawn (nothing solid in between)', sight === 'library_door', `first hit: ${sight}`);
await page.screenshot({ path: path.join(shots, 'v03-spawn-sunset.png') });

// Door is locked (F3.4 unlocks at 0.04): walking at it stops in front of it.
await G(page, () => { const p = window.__gametool.player; p.pos.set(0, 0, -15); p.yaw = 0; });
await page.keyboard.down('KeyW'); await page.waitForTimeout(1500); await page.keyboard.up('KeyW');
const stopZ = await G(page, () => window.__gametool.player.pos.z);
check('F2.3 locked door blocks the player', stopZ > door.z, `stopped at z ${stopZ.toFixed(2)}, door at ${door.z.toFixed(2)}`);

// ---------- F2.4 POV toggle (rebuild R3: third-person follow is the default) ----------
await G(page, () => { const p = window.__gametool.player; p.pos.set(0, 0, 8.5); p.yaw = 0; p.pitch = 0; });
await page.keyboard.down('KeyW'); await page.waitForTimeout(500);
const tp = await G(page, () => { const g = window.__gametool; return { third: g.player.thirdPerson, body: g.player.body.visible, cam: g.player.eyePos.distanceTo(g.camera.position) }; });
await page.keyboard.up('KeyW');
await page.screenshot({ path: path.join(shots, 'v03-third-person.png') });
check('F2.4 default view is the follow camera (body shown, camera behind and above, S1) while moving', tp.third && tp.body && tp.cam > 3 && tp.cam < 11, `camera ${tp.cam.toFixed(2)} m from eyes`);
// Wall collision: back the player up against the library, looking away from it.
await G(page, () => { const p = window.__gametool.player; p.pos.set(6, 0, -16.4); p.yaw = Math.PI; p.pitch = 0; });
await page.waitForTimeout(300);
const wallCam = await G(page, () => window.__gametool.camera.position.z);
check('F2.4 third-person camera never goes through the library wall', wallCam > -16.8, `camera z ${wallCam.toFixed(2)}`);
await G(page, () => { const p = window.__gametool.player; p.pos.set(0, 0, 8.5); p.yaw = 0; p.pitch = 0; });
await page.keyboard.press('KeyF');
await page.waitForFunction(() => { const g = window.__gametool; return g.camera.position.distanceTo(g.player.eyePos) < 0.01 && !g.rig.switching; }, null, { timeout: 8000 }).catch(() => undefined);   // S1: the camera glides into the eyes
await page.waitForTimeout(100);
const fp = await G(page, () => { const g = window.__gametool; return { first: !g.player.thirdPerson, cam: g.player.eyePos.distanceTo(g.camera.position), body: g.player.body.visible }; });
check('F2.4 F switches to first person: camera at the eyes, body hidden', fp.first && fp.cam < 0.01 && !fp.body, JSON.stringify(fp));
await page.keyboard.press('KeyF');
await page.waitForTimeout(300);
check('F2.4 F again returns to third person', await G(page, () => window.__gametool.player.thirdPerson && window.__gametool.player.body.visible));
check('v0.03: no console/page errors', errors.length === 0, errors.join(' | '));
await browser.close();
const failed = results.filter((r) => !r.ok).length;
console.log(`\n${results.length - failed}/${results.length} checks passed`);
process.exit(failed ? 1 : 0);
