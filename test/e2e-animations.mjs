// B34 (Mike 2026-11-03): more animations. One-shot moves (wave, pick-up, hit), idle fidgets, sitting down on the
// ground after standing idle, and NPCs waving hello as you come near.
// Usage: node test/e2e-animations.mjs [path/to/index.html]   (CHROMIUM_PATH as in e2e.mjs)
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
const until = (page, fn, arg, timeout = 20000) => page.waitForFunction(fn, arg, { timeout, polling: 50 }).then(() => true, () => false);

const page = await (await browser.newContext({ viewport: { width: 1280, height: 720 } })).newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
await page.route(/^https?:/, (r) => r.abort());
await page.goto('file://' + file);
await page.waitForFunction(() => window.__gametool);
await page.waitForTimeout(400);
await page.click('#begin');
await page.waitForFunction(() => window.__gametool.state === 'play');
await G(page, () => { const p = window.__gametool.player; p.pos.set(0, 0, 8.5); p.yaw = Math.PI; });   // facing back down the path, camera on the front

const bones = 'window.__gametool.player.body.children[0].userData.rig.bones';

// Wave: the P arm goes up beside the head.
await G(page, () => window.__gametool.gesture('wave'));
const waved = await until(page, `${bones}.armP.rotation.z > 1.5`, null, 10000);
await page.screenshot({ path: path.join(shots, 'b34-wave.png') });
check('Wave: the hand goes up beside the head', waved);
check('A one-shot ends on its own', await until(page, () => window.__gametool.puppets.get('player').fig.playing === null, null, 15000));

// Pick-up: a crouch and reach (the hips drop).
const restHips = await G(page, () => window.__gametool.player.body.children[0].userData.rig.bones.hips.position.y);
await G(page, () => window.__gametool.gesture('pickup'));
check('Pick-up: bends down to reach', await until(page, (r) => window.__gametool.player.body.children[0].userData.rig.bones.hips.position.y < r - 0.15, restHips, 10000));
await until(page, () => window.__gametool.puppets.get('player').fig.playing === null, null, 15000);

// Hit: rocked back, arms up.
// (sampled every frame: the flinch is short, and the test browser draws only a few frames a second)
const hit = await G(page, () => new Promise((res) => {
  const g = window.__gametool, B = g.player.body.children[0].userData.rig.bones; let spine = 0, arm = 0;
  g.gesture('hit');
  const t0 = performance.now(), tick = () => { spine = Math.min(spine, B.spine.rotation.x); arm = Math.min(arm, B.armN.rotation.x); if (performance.now() - t0 < 2500) requestAnimationFrame(tick); else res({ spine, arm }); };
  requestAnimationFrame(tick);
}));
check('Hit: flinches back with the arms up', hit.spine < -0.08 && hit.arm < -0.4, JSON.stringify(hit));

// Idle fidgets play by themselves.
check('Standing idle, the figure fidgets on its own (look, stretch or shift)', await until(page, () => ['look', 'stretch', 'shift'].includes(window.__gametool.puppets.get('player').fig.playing), null, 40000));

// Sit down on the ground after standing still.
const sat = await until(page, () => window.__gametool.idleSit, null, 90000);
await page.waitForTimeout(1500);
const sitHips = await G(page, () => window.__gametool.player.body.children[0].userData.rig.bones.hips.position.y);
await page.screenshot({ path: path.join(shots, 'b34-sit.png') });
check('Standing still for 25 s sits you down on the ground', sat && sitHips < restHips - 0.4, `${sitHips.toFixed(2)} vs ${restHips.toFixed(2)}`);
await page.keyboard.down('KeyW');
const up = await until(page, () => !window.__gametool.idleSit, null, 5000);
await page.keyboard.up('KeyW');
check('Moving gets you up again', up);

// NPCs wave hello as you come near.
await G(page, () => { const g = window.__gametool, h = g.world.standees.hero.position; g.player.pos.set(h.x - 2.5, 0, h.z + 0.5); });
check('An NPC waves as you come near', await until(page, () => window.__gametool.puppets.get('hero')?.fig?.playing === 'wave', null, 10000));

check('No page errors', errors.length === 0, errors.slice(0, 3).join(' | '));
await browser.close();
const failed = results.filter((r) => !r.ok).length;
console.log(`${results.length - failed}/${results.length} checks passed`);
process.exit(failed ? 1 : 0);
