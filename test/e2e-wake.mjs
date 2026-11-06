// B31 (Mike 2026-11-03): the wake-up intro. Begin / Continue goes black, then fades in on the player getting up:
// on a new game from the camp bedroll (Mike 2026-11-06: "Spawn at the campfire, not at the inn"), then Natalie's camp
// welcome; on Continue from the bedroll if the last sleep was at camp. Any input skips it.
// Test browsers skip the intro unless localStorage gametool.waketest = 'on' (set here).
// Usage: node test/e2e-wake.mjs [path/to/index.html]   (CHROMIUM_PATH as in e2e.mjs)
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

const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 } });
await ctx.addInitScript(() => { try { localStorage.setItem('gametool.waketest', 'on'); } catch { /* blocked */ } });
const page = await ctx.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
await page.route(/^https?:/, (r) => r.abort());
await page.goto('file://' + file);
await page.waitForFunction(() => window.__gametool);
await page.waitForTimeout(400);

// New game: the camp bedroll.
await G(page, () => document.getElementById('begin').click());
const start = await G(page, () => {
  const g = window.__gametool, b = g.world.stations.bedroll.position, root = g.player.body.children[0].userData.rig.bones.root;
  return { state: g.state, pose: g.stationPose, waking: g.waking, d: Math.hypot(g.player.pos.x - b.x, g.player.pos.z - b.z), black: document.getElementById('sleepFade').classList.contains('on') || getComputedStyle(document.getElementById('sleepFade')).opacity > 0.5 };
});
check('A new game wakes at the campfire, on the bedroll, getting up', start.state === 'play' && start.pose === 'wakeroll' && start.waking > 0 && start.d < 1.5, JSON.stringify(start));
check('The screen starts black and fades in', start.black);
const lying = await until(page, () => { const r = window.__gametool.player.body.children[0].userData.rig.bones.root; return r.rotation.x < -1.2; }, null, 8000);
await page.screenshot({ path: path.join(shots, 'b31-wake-bed.png') });
check('The player starts lying on the bedroll', lying);
const p0 = await G(page, () => window.__gametool.player.pos.clone());
await until(page, () => !window.__gametool.waking, null, 30000);
const done = await G(page, (p) => { const g = window.__gametool, r = g.player.body.children[0].userData.rig.bones.root; return { pose: g.stationPose, moved: Math.hypot(g.player.pos.x - p.x, g.player.pos.z - p.z), rot: r.rotation.x, fade: document.getElementById('sleepFade').classList.contains('on') }; }, p0);
check('The get-up finishes on its own and hands back control (standing, screen clear)', done.pose === null && done.moved < 0.05, JSON.stringify(done));
// Then Natalie explains the camp, how to play and how to beat it; once, and back to play after.
const welcome = await until(page, () => window.__gametool.state === 'dialogue' && window.__gametool.dialogue.open, null, 10000);
const lines = [];
for (let i = 0; i < 30 && await G(page, () => window.__gametool.dialogue.open); i++) {
  await G(page, () => { const d = window.__gametool.dialogue; if (d.typing) d.advance(); });
  lines.push(await G(page, () => window.__gametool.dialogue.text));
  await G(page, () => { const d = window.__gametool.dialogue; if (d.node?.choices?.length) d.choose(0); else d.advance(); });
}
const said = [...new Set(lines)].join(' ');
check("Natalie's camp welcome: why the camp is at the Ruined Library, the descent, and how to win", welcome && /base camp/.test(said) && /Ruined Library/.test(said) && /Thirty floors/.test(said) && /climb back out alive/.test(said), said.slice(0, 160));
check('After the welcome you are back in play, and it is remembered', await until(page, () => window.__gametool.state === 'play', null, 8000) && await G(page, () => localStorage.getItem('gametool.campwelcome') === '1'));
check('Standing upright again', await until(page, () => Math.abs(window.__gametool.player.body.children[0].userData.rig.bones.root.rotation.x) < 0.05, null, 10000));
await page.screenshot({ path: path.join(shots, 'b31-wake-standing.png') });

// Continue after a camp sleep: the bedroll. Any key skips.
await G(page, () => { const g = window.__gametool; g.openCampfire(); });
await until(page, () => window.__gametool.satAtFire);
await G(page, () => window.__gametool.campfire.onSleep());
await until(page, () => window.__gametool.lastRest === 'camp' && !document.getElementById('sleepFade').classList.contains('on'));
await G(page, () => { const g = window.__gametool; g.campfire.close?.(); });
await page.waitForTimeout(300);
await G(page, () => window.__gametool.quitToMenu());
await until(page, () => window.__gametool.state === 'title');
const saved = await G(page, () => JSON.parse(localStorage.getItem('gametool.save'))?.rest);
check('The save remembers the last rest spot (camp)', saved === 'camp', String(saved));
await G(page, () => document.getElementById('begin').click());
const roll = await G(page, () => { const g = window.__gametool, b = g.world.stations.bedroll.position; return { pose: g.stationPose, d: Math.hypot(g.player.pos.x - b.x, g.player.pos.z - b.z), waking: g.waking }; });
check('Continue after sleeping at camp wakes on the bedroll', roll.pose === 'wakeroll' && roll.d < 1.5 && roll.waking > 0, JSON.stringify(roll));
await until(page, () => window.__gametool.player.body.children[0].userData.rig.bones.root.rotation.x < -1.2, null, 8000);
await page.screenshot({ path: path.join(shots, 'b31-wake-bedroll.png') });
await page.keyboard.press('KeyW');
const skipped = await G(page, () => ({ waking: window.__gametool.waking, pose: window.__gametool.stationPose }));
check('Any key skips the intro', skipped.waking === 0 && skipped.pose === null, JSON.stringify(skipped));

// The inn: renting a bed sets the rest spot back to the inn.
await G(page, () => window.__gametool.townAct.inn());
await until(page, () => window.__gametool.lastRest === 'inn' && !document.getElementById('sleepFade').classList.contains('on'));
check('Sleeping at the inn makes the inn the rest spot again', await G(page, () => window.__gametool.lastRest === 'inn'));

check('No page errors', errors.length === 0, errors.slice(0, 3).join(' | '));
await browser.close();
const failed = results.filter((r) => !r.ok).length;
console.log(`${results.length - failed}/${results.length} checks passed`);
process.exit(failed ? 1 : 0);
