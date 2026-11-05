// Mike 2026-11-05 (E2): guardians every 7-10 floors whose fall ties Natalie's rope there (a start point), rest camps
// every 5 floors, and flux floors (dark, flooded, burning, light) that grow commoner deeper down.
// Usage: node test/e2e-descent-extras.mjs [path/to/index.html]   (CHROMIUM_PATH as in e2e.mjs)
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
const check = (name, ok, detail = '') => { results.push({ name, ok }); console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? '  — ' + detail : ''}`); };
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
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
const frames = (n = 6) => G((n) => new Promise((done) => { let k = 0; const t = () => (++k >= n ? done() : requestAnimationFrame(t)); t(); }), n);

await G(() => { const g = window.__gametool; g.inventory.give('sword', 1); g.hands.set('right', 'sword'); });
const gs = await G(() => window.__gametool.record.guardians);
const gaps = gs.map((f, i) => f - (i ? gs[i - 1] : 0));
check('Guardian floors: each 7-10 after the last, all above the hoard', gs.length >= 2 && gaps.every((d) => d >= 7 && d <= 10) && gs.every((f) => f < 30), JSON.stringify(gs));
const stats = await G(() => {
  const r = window.__gametool.descentRules, gs = window.__gametool.record.guardians, n = {}, bad = [];
  for (let f = 1; f <= 30; f++) { n[f] = 0; for (let i = 0; i < 400; i++) { const x = r.fluxFor(f, gs); if (x !== 'none') { n[f]++; if (r.isCamp(f) || gs.includes(f) || f === 30) bad.push(f); } } }
  return { early: n[4] + n[6] + n[7], deep: n[26] + n[27] + n[28], bad: bad.length };
});
check('Flux floors: never on camps, guardians or the hoard; commoner deeper', stats.bad === 0 && stats.deep > stats.early, JSON.stringify(stats));

// A guardian.
await G(() => window.__gametool.startDescent());
await page.waitForFunction(() => window.__gametool.inDungeon && !window.__gametool.descendCine.active, null, { timeout: 20000 });
await G((g1) => { window.__gametool.descent.floor = g1 - 1; window.__gametool.goDown(true); }, gs[0]);
await page.waitForFunction((g1) => window.__gametool.descent?.floor === g1 && !window.__gametool.loadScreen.active && !window.__gametool.descendCine.active, gs[0], { timeout: 20000 });
const boss = await G(() => { const g = window.__gametool, f = g.goblins.alive.find((x) => x.role === 'guardian'); return f && { name: f.v.display, hp: f.st.hp, scale: f.root.scale.x }; });
check('A guardian waits on its floor: named, big and tough', !!boss && /Gnash|Mildew|Skreel|Varg|Margin/.test(boss.name) && boss.hp >= 8 && boss.scale > 1.2, JSON.stringify(boss));
await G(() => { const g = window.__gametool, f = g.goblins.alive.find((x) => x.role === 'guardian'), p = g.player.pos.clone(); g.player.spawn(f.root.position.clone().add(new g.Vector3(0, 0, 3)), 0); for (let i = 0; i < 20 && f.state !== 'dead'; i++) g.goblins.shoot(f, 99, new g.Vector3(0, 0, -1)); void p; });
await page.waitForTimeout(3200);
const rope = await G(() => ({ ropes: window.__gametool.record.ropes, toast: document.getElementById('toast').textContent }));
check("Beating it ties Natalie's rope on that floor", rope.ropes.includes(gs[0]), JSON.stringify(rope));
await G(() => window.__gametool.exitDungeon());
await frames(2);
await G(() => window.__gametool.openDescend());
const ropeBtn = await G(() => !!document.querySelector('#descend [data-act="rope"]'));
check('The trapdoor offers the rope as a start point', ropeBtn);
await page.click('#descend [data-act="rope"]');
await page.waitForFunction(() => window.__gametool.inDungeon && !window.__gametool.descendCine.active, null, { timeout: 20000 });
check('…and the rope starts you on that floor', await G((g1) => window.__gametool.descent.floor === g1, gs[0]));

// A rest camp on floor 5.
await G(() => { window.__gametool.descent.floor = 4; window.__gametool.goDown(true); });
await page.waitForFunction(() => window.__gametool.descent?.floor === 5 && !window.__gametool.loadScreen.active && !window.__gametool.descendCine.active, null, { timeout: 20000 });
const camp = await G(() => { const g = window.__gametool; g.delveHp = 3; const s = g.dungeon.spots.find((x) => x.kind === 'camp'); if (!s) return null; const it = g.interactables.find((i) => i.obj === s.hit); const v = it.verb(); it.act(); return { v, hp: g.delveHp, rested: g.descent.rested, v2: it.verb() }; });
check('Floor 5 has a rest camp: rest once to heal, oil and restring', !!camp && camp.v === 'Rest at the camp' && camp.hp === 10 && camp.rested && /rested/.test(camp.v2), JSON.stringify(camp));
await G(() => { const g = window.__gametool, s = g.dungeon.spots.find((x) => x.kind === 'camp'); g.player.spawn(s.hit.position.clone().setY(0).add(new g.Vector3(0, 0, 2)), 0); g.player.thirdPerson = true; g.goblins.clear(); });
await frames(8);
await page.screenshot({ path: path.join(shots, 'descent-camp.png') });

// Flux floors.
await G(() => window.__gametool.applyFlux('light'));
check('Light: you fall slowly', await G(() => window.__gametool.player.gravityMul < 0.5));
await G(() => window.__gametool.applyFlux('flooded'));
await frames(3);
check('Flooded: slow going', await G(() => window.__gametool.player.speedMul < 0.8));
await page.screenshot({ path: path.join(shots, 'descent-flooded.png') });
await G(() => window.__gametool.applyFlux('dark'));
check('Dark: the fog closes in', await G(() => window.__gametool.world.scene.fog.far <= 10));
await G(() => window.__gametool.applyFlux('burning'));
await frames(4);
await page.screenshot({ path: path.join(shots, 'descent-burning.png') });
check('Burning: fire along the walls', await G(() => !!window.__gametool.dungeon.group.getObjectByName('flux-fx')?.children.length));
await G(() => window.__gametool.exitDungeon());
check('Out again, the flux is gone', await G(() => window.__gametool.fluxNow === 'none' && window.__gametool.player.gravityMul === 1));
check('No page errors', errors.length === 0, errors.slice(0, 3).join(' | '));

await browser.close();
const failed = results.filter((r) => !r.ok).length;
console.log(`\n${results.length - failed}/${results.length} passed`);
process.exit(failed ? 1 : 0);
