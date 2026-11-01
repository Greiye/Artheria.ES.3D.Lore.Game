// v0.08 (Mike 2026-11-01): "Add sword for player to swing and damage goblins". The practice sword on the stand outside
// the smithy: take it, draw it (3 / Q / D-pad right / touch weapon button), swing it (LMB / RT / Swing) at goblins.
// Usage: node test/e2e-sword.mjs [path/to/index.html]   (CHROMIUM_PATH as in e2e.mjs)
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
const until = (page, fn, arg, timeout = 15000) => page.waitForFunction(fn, arg, { timeout, polling: 50 }).then(() => true, () => false);
const sim = async (page, s) => { const t0 = await G(page, () => window.__gametool.perf.simSeconds); return until(page, ([t0, s]) => window.__gametool.perf.simSeconds > t0 + s, [t0, s], 90000); };

const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 } });
const page = await ctx.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
await page.route(/^https?:/, (r) => r.abort());
await page.goto('file://' + file);
await page.waitForFunction(() => window.__gametool);
await page.waitForTimeout(400);
await page.click('#begin');
await page.waitForFunction(() => window.__gametool.state === 'play');
await page.waitForTimeout(400);

// The stand outside the smithy.
const stand = await G(page, () => { const g = window.__gametool, i = g.interactables.find((x) => x.obj.name === 'sword-stand'); return i ? { verb: i.verb(), when: i.when() } : null; });
check('A practice sword stands outside the smithy: "Take the practice sword"', stand?.verb === 'Take the practice sword' && stand.when, JSON.stringify(stand));
await G(page, () => { const g = window.__gametool; g.sword.unequip(); });
const noSword = await G(page, () => { const g = window.__gametool; g.sword.equip(); return g.sword.equipped; });
check('Without it, 3 does nothing (no sword yet)', !noSword);
await G(page, () => { const g = window.__gametool, i = g.interactables.find((x) => x.obj.name === 'sword-stand'); const p = new g.Vector3(); i.obj.getWorldPosition(p); g.player.spawn(new g.Vector3(p.x, 0, p.z + 1.4), 0); });
await page.waitForTimeout(300);
await G(page, () => window.__gametool.interactables.find((x) => x.obj.name === 'sword-stand').act());
await sim(page, 0.1);
const took = await G(page, () => { const g = window.__gametool, s = g.world.standees.sword, shown = (s.userData.replacedBy ?? s).visible; return { n: g.inventory.count('sword'), eq: g.sword.equipped, stand: shown, held: g.sword.held.visible, st: g.state, pose: g.stationPose, when: g.interactables.find((x) => x.obj.name === 'sword-stand').when() }; });
check('Taking it: the sword is in the bag and in your hand, and the stand is empty', took.n === 1 && took.eq && !took.stand && took.held && !took.when, JSON.stringify(took));
await page.screenshot({ path: path.join(shots, 'sword-taken.png') });

// The right hand cycles hands → sword → crossbow.
const cyc = await G(page, () => {
  const g = window.__gametool, out = [], now = () => (g.crossbow.equipped ? 'crossbow' : g.sword.equipped ? 'sword' : 'hands');
  g.inventory.give('crossbow', 1); g.sword.unequip(); g.crossbow.unequip();
  for (let i = 0; i < 4; i++) { window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyQ' })); out.push(now()); window.dispatchEvent(new KeyboardEvent('keyup', { code: 'KeyQ' })); }
  return out;
});
check('Q / D-pad right cycles the right hand: sword, crossbow, hands, sword', cyc.join() === 'sword,crossbow,hands,sword', cyc.join());
await page.keyboard.press('Digit2');
check('2 puts it away; 3 draws it', await G(page, () => !window.__gametool.sword.equipped) && (await page.keyboard.press('Digit3'), await G(page, () => window.__gametool.sword.equipped)));

// LMB swings (follow view: a click on the world).
const s0 = await G(page, () => window.__gametool.sword.swings);
await page.mouse.click(640, 400);
await sim(page, 0.05);
const mid = await G(page, () => ({ swings: window.__gametool.sword.swings, k: window.__gametool.sword.progress }));
check('A click swings the sword', mid.swings === s0 + 1, JSON.stringify(mid));
await page.waitForTimeout(600);

// In the dungeon, against a goblin that stands still.
await G(page, () => window.__gametool.enterDungeon(4242));
await until(page, () => /♥/.test(document.querySelector('#delveHp').textContent));
const seed = await G(page, () => { const T = window.__gametool.traits; for (let s = 1; s < 5000; s++) { const v = T.rollGoblin(s), st = T.goblinStats(v); if (st.behaviour === 'rusher' && !st.block && st.armour === 0 && st.hp >= 6) return s; } return 0; });
const setup = (dist, ang = 0) => G(page, ([seed, dist, ang]) => {
  const g = window.__gametool; g.goblins.clear(); g.delveHp = 99; g.player.spawn(g.dungeon.entrance(), g.dungeon.entranceYaw());
  const p = g.player.pos, yaw = g.player.bodyYaw + ang, d = new g.Vector3(-Math.sin(yaw), 0, -Math.cos(yaw));
  for (let k = dist; k > 0.4; k -= 0.1) { const x = p.x + d.x * k, z = p.z + d.z * k; if (g.dungeon.walkable(x, z) && g.dungeon.walkable(x + d.x * 1.2, z + d.z * 1.2)) {
    const f = g.goblins.spawn(g.traits.rollGoblin(seed), new g.Vector3(x, 0, z), Math.atan2(-d.x, -d.z), true); f.st.speed = 0; f.st.cooldown = 99; f.cd = 99; return +k.toFixed(2); } }
  return 0;
}, [seed, dist, ang]);
const near = await setup(1.2);
await G(page, () => { const g = window.__gametool; g.sword.equip(); g.sword.swing(); });
await sim(page, 0.2);
await page.screenshot({ path: path.join(shots, 'sword-swing-follow.png') });
await sim(page, 0.4);
const hit1 = await G(page, () => { const g = window.__gametool, f = g.goblins.list[0]; return { hp: f.hp, max: f.st.hp, d: +Math.hypot(f.root.position.x - g.player.pos.x, f.root.position.z - g.player.pos.z).toFixed(2), alerted: f.alerted, hits: g.sword.hits }; });
check('A swing that reaches a goblin hurts it (2), knocks it back and wakes it', near > 0 && hit1.hp === hit1.max - 2 && hit1.d > near + 0.2 && hit1.alerted && hit1.hits === 1, JSON.stringify({ near, ...hit1 }));

// The combo: three quick swings, the third heavier.
await setup(1.1);
const combo = await G(page, () => new Promise((done) => {
  const g = window.__gametool, f = g.goblins.list[0], hp0 = f.hp, seen = [], was = g.sword.onSwing;
  g.sword.onSwing = (h) => { seen.push(g.sword.combo); was(h); };
  let n = 0; const tick = () => { g.sword.swing(); if (++n < 160 && seen.length < 3) requestAnimationFrame(tick); else setTimeout(() => { g.sword.onSwing = was; done({ seen, lost: hp0 - f.hp, dead: f.state === 'dead' }); }, 500); };
  // Hold the goblin in reach so each cut connects.
  const keep = f.root.position.clone(); const hold = () => { if (f.state !== 'dead') f.root.position.copy(keep); if (n < 200) requestAnimationFrame(hold); }; hold();
  tick();
}));
check('Swings chain into a combo of 1, 2, 3; the third cut is heavy (2 + 2 + 3 = 7)', combo.seen.join() === '1,2,3' && (combo.lost === 7 || combo.dead), JSON.stringify(combo));

// Behind you: not hit (the cut is in front).
await setup(1.0, Math.PI);
await G(page, () => { const g = window.__gametool; g.sword.swing(); });
await sim(page, 0.6);
const behind = await G(page, () => { const f = window.__gametool.goblins.list[0]; return { hp: f.hp, max: f.st.hp }; });
check('A goblin behind you is not hit', behind.hp === behind.max, JSON.stringify(behind));

// Follow-view aim assist: a goblin off to the side within reach turns you toward it.
await setup(1.1, 1.2);
const yaw0 = await G(page, () => window.__gametool.player.bodyYaw);
await G(page, () => window.__gametool.sword.swing());
await sim(page, 0.6);
const assist = await G(page, () => { const g = window.__gametool, f = g.goblins.list[0]; return { hp: f.hp, max: f.st.hp, yaw: g.player.bodyYaw }; });
check('In the follow view a cut turns you toward a goblin beside you', assist.hp < assist.max && Math.abs(assist.yaw - yaw0) > 0.5, JSON.stringify({ yaw0, ...assist }));

// Enough cuts drop it and pay its loot.
await setup(1.1);
const kill = await G(page, () => new Promise((done) => {
  const g = window.__gametool, f = g.goblins.list[0], c0 = g.inventory.count('crown'); let n = 0;
  const keep = f.root.position.clone();
  const tick = () => { if (f.state !== 'dead') f.root.position.copy(keep); g.sword.swing(); if (f.state !== 'dead' && ++n < 600) requestAnimationFrame(tick); else setTimeout(() => done({ dead: f.state === 'dead', crowns: g.inventory.count('crown') - c0 }), 300); };
  tick();
}));
check('Enough cuts drop the goblin and it pays its loot', kill.dead && kill.crowns > 0, JSON.stringify(kill));

// First person: the sword viewmodel shows, and swings.
await setup(1.3);
for (let i = 0; i < 3 && await G(page, () => document.body.dataset.view !== 'first'); i++) { await page.keyboard.press('KeyF'); await sim(page, 0.05); }
await G(page, () => { const g = window.__gametool; g.player.yaw = g.player.bodyYaw; g.player.pitch = -0.15; g.sword.swing(); });
await sim(page, 0.12);
const fp = await G(page, () => { const g = window.__gametool; return { vm: g.sword.viewmodel.visible, k: g.sword.progress }; });
await page.screenshot({ path: path.join(shots, 'sword-swing-first.png') });
await sim(page, 0.5);
const fpHit = await G(page, () => { const f = window.__gametool.goblins.list[0]; return f.hp < f.st.hp; });
check('First person: the held sword shows on screen, sweeps, and hits what you look at', fp.vm && fpHit, JSON.stringify({ ...fp, fpHit }));
await G(page, () => window.__gametool.exitDungeon());

check('The sword is kept (per profile, in the save)', await G(page, () => window.__gametool.inventory.count('sword') === 1));
check('No console / page errors', errors.length === 0, errors.join(' | '));

await browser.close();
const passed = results.filter((r) => r.ok).length;
console.log(`\n${passed}/${results.length} checks passed`);
process.exit(passed === results.length ? 0 : 1);
