// B35 (Mike 2026-11-03): fighter mode vs Kavik. Talk to Kavik at the dojo, fight side-on, best of 3 with health
// bars; four limb buttons, hold back to guard (2026-11-04). He goes easy until your first win, then fights fair for good. The fight logic itself (src/fight/engine.ts)
// is driven here through the game, with real key presses for the controls.
// Usage: node test/e2e-fight.mjs [path/to/index.html]   (CHROMIUM_PATH as in e2e.mjs)
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

// Kavik offers a spar.
const verb = await G(page, () => { const g = window.__gametool; const k = g.interactables.find((i) => /Spar with Kavik/.test(i.verb())); return k?.verb(); });
check('Kavik at the dojo offers "Spar with Kavik"', /Spar with Kavik/.test(verb ?? ''), verb);
await G(page, () => window.__gametool.openFight());
await until(page, () => document.querySelector('#fight .fx-banner').textContent !== '', null, 10000);
const open = await G(page, () => { const g = window.__gametool, f = g.fightMode; return { state: g.state, open: f.isOpen, shown: !document.getElementById('fight').classList.contains('hidden'), level: f.level, label: document.querySelector('#fight .fx-level').textContent, banner: document.querySelector('#fight .fx-banner').textContent }; });
check('The fight opens: health bars, round banner, Kavik going easy', open.open && open.shown && open.state === 'forge' && open.level === 'easy' && /easy/.test(open.label) && /Round 1|Fight/.test(open.banner), JSON.stringify(open));

// Side-on camera: from the far side of the mats, square to the line of the fight.
await until(page, () => window.__gametool.fightMode.fight.phase === 'fight', null, 30000);
const cam = await G(page, () => { const g = window.__gametool, c = g.camera.position, d = g.camera.getWorldDirection(new g.Vector3()); return { dz: d.z, dx: d.x, behind: c.z < g.player.pos.z, sameLine: Math.abs(g.player.pos.z - g.world.standees.kavik.position.z) < 0.01 }; });
check('Side-on camera, both fighters on one line', cam.dz > 0.9 && Math.abs(cam.dx) < 0.3 && cam.behind && cam.sameLine, JSON.stringify(cam));

// Tap W: a sidestep turns the line of the fight, and the camera swings round to stay side-on to it.
await G(page, () => { const f = window.__gametool.fightMode.fight; f.a.x = -0.6; f.b.x = 0.6; window.__gametool.fightMode.ai.pad = () => ({ x: 0, up: false, down: false, lp: false, rp: false, lk: false, rk: false }); });
await page.keyboard.press('KeyW');
await until(page, () => Math.abs(window.__gametool.fightMode.fight.a.z) > 0.4, null, 20000);
await page.waitForTimeout(1500);
const cam2 = await G(page, () => { const g = window.__gametool, d = g.camera.getWorldDirection(new g.Vector3()), p = g.player.pos, k = g.world.standees.kavik.position;
  const lx = k.x - p.x, lz = k.z - p.z, l = Math.hypot(lx, lz); return { z: g.fightMode.fight.a.z, dot: (d.x * lx + d.z * lz) / l / Math.hypot(d.x, d.z) }; });
check('Tap up sidesteps; the camera swings round, side-on to the fighters', Math.abs(cam2.z) > 0.4 && Math.abs(cam2.dot) < 0.35, JSON.stringify(cam2));
await G(page, () => { const fm = window.__gametool.fightMode; delete fm.ai.pad; });

// Real controls: walk in and attack until something lands on Kavik.
const hp0 = await G(page, () => window.__gametool.fightMode.fight.b.hp);
let landed = false;
for (let i = 0; i < 40 && !landed; i++) {
  const gap = await G(page, () => { const f = window.__gametool.fightMode.fight; return f.b.x - f.a.x; });
  const key = gap > 0 ? 'KeyD' : 'KeyA';
  if (Math.abs(gap) > 0.9) { await page.keyboard.down(key); await page.waitForTimeout(250); await page.keyboard.up(key); }
  await page.keyboard.press('KeyJ');
  await page.waitForTimeout(150);
  landed = await G(page, (h) => window.__gametool.fightMode.fight.b.hp < h, hp0);
}
await page.screenshot({ path: path.join(shots, 'b35-fight.png') });
check('Walking in and pressing Left foot (J) lands hits on Kavik', landed);
check('Kavik fights back (his AI moves and attacks)', await until(page, () => { const f = window.__gametool.fightMode.fight; return f.a.hp < 100 || !!f.b.move; }, null, 30000));

// Guard: holding back (away from Kavik) guards; down-back guards low.
await until(page, () => { const a = window.__gametool.fightMode.fight.a; return a.state === 'idle' || a.state === 'walk'; }, null, 15000);
const backKey = await G(page, () => { const f = window.__gametool.fightMode.fight; return f.b.x > f.a.x ? 'KeyA' : 'KeyD'; });
await page.keyboard.down(backKey);
const guarding = await until(page, () => { const s = window.__gametool.fightMode.fight.a.state; return s === 'guard' || s === 'block'; }, null, 8000);
await page.keyboard.down('KeyS');
const lowGuard = await until(page, () => { const a = window.__gametool.fightMode.fight.a; return a.state === 'lowguard' || (a.state === 'block' && a.blockLow); }, null, 8000);
await page.keyboard.up('KeyS'); await page.keyboard.up(backKey);
check('Holding back guards; down-back guards low', guarding && lowGuard);

// Win the match (the fight state is set to the last blow) and get the first-win reward.
const crowns0 = await G(page, () => window.__gametool.purse.crowns);
await G(page, () => { const f = window.__gametool.fightMode.fight; f.wins = [1, 0]; f.b.hp = 0; });
await until(page, () => !!window.__gametool.fightMode.result, null, 30000);
const res = await G(page, (c0) => { const g = window.__gametool, f = g.fightMode; return { result: f.result, beaten: f.record.beaten, saved: JSON.parse(localStorage.getItem('gametool.fight')), crowns: g.purse.crowns - c0, shown: !document.querySelector('#fight .fx-result').classList.contains('hidden'), title: document.querySelector('#fight .fx-r-title').textContent }; }, crowns0);
await page.screenshot({ path: path.join(shots, 'b35-win.png') });
check('Winning the match shows the result and pays 25 crowns the first time', res.shown && /You win/.test(res.title) && res.result.first && res.result.crowns === 25, JSON.stringify(res));
check('The save remembers you beat him', res.beaten && res.saved.beaten && res.saved.wins === 1);

// Rematch: Kavik now fights fair, for good.
await page.click('#fxRematch');
const re = await G(page, () => { const f = window.__gametool.fightMode; return { level: f.level, ai: f.ai.level, label: document.querySelector('#fight .fx-level').textContent, wins: f.fight.wins }; });
check('After the first win Kavik fights fair (and stays that way)', re.level === 'fair' && re.ai === 'fair' && /for real/.test(re.label) && re.wins[0] === 0, JSON.stringify(re));
await G(page, () => { const f = window.__gametool.fightMode.fight; f.wins = [1, 0]; f.b.hp = 0; f.phase = 'fight'; });
await until(page, () => !!window.__gametool.fightMode.result, null, 30000);
check('Later wins pay a few crowns', await G(page, () => window.__gametool.fightMode.result.crowns === 5 && !window.__gametool.fightMode.result.first));

// A lost match keeps the level (no ramp further, no drop back).
await page.click('#fxRematch');
await G(page, () => { const f = window.__gametool.fightMode.fight; f.wins = [0, 1]; f.a.hp = 0; f.phase = 'fight'; });
await until(page, () => !!window.__gametool.fightMode.result, null, 30000);
const lost = await G(page, () => { const f = window.__gametool.fightMode; return { won: f.result.won, level: f.level, title: document.querySelector('#fight .fx-r-title').textContent }; });
check('Losing shows Kavik wins; he stays at the fair level', !lost.won && lost.level === 'fair' && /Kavik wins/.test(lost.title), JSON.stringify(lost));

// Esc leaves the mat; Kavik goes back to his spot by the door.
await page.keyboard.press('Escape');
const left = await until(page, () => window.__gametool.state === 'play' && !window.__gametool.fightMode.isOpen, null, 10000);
check('Esc leaves the fight and returns to play', left);
check('No page errors', errors.length === 0, errors.slice(0, 3).join(' | '));

// Touch: the four limb buttons and Throw show for touch input.
await page.close();   // one game at a time on a slow machine
const t = await (await browser.newContext({ viewport: { width: 844, height: 390 }, hasTouch: true, isMobile: true })).newPage();
await t.route(/^https?:/, (r) => r.abort());
await t.goto('file://' + file);
await t.waitForFunction(() => window.__gametool, null, { timeout: 90000 });
await t.waitForTimeout(400);
await t.tap('#begin');
await t.waitForFunction(() => window.__gametool.state === 'play', null, { timeout: 60000 });
await G(t, () => window.__gametool.openFight());
const pad = await G(t, () => [...document.querySelectorAll('#fight .fx-b')].filter((b) => b.offsetParent).map((b) => b.dataset.b));
check('Touch: Left hand, Right hand, Left foot, Right foot and Throw buttons', ['lp', 'rp', 'lk', 'rk', 'throw'].every((b) => pad.includes(b)), pad.join());
await until(t, () => window.__gametool.fightMode.fight.phase === 'fight', null, 30000);
// A move can start and finish inside one slow frame, so watch what reaches the fight engine.
await G(t, () => { const f = window.__gametool.fightMode.fight, step = f.step.bind(f); window.__got = []; f.step = (p, q) => { for (const k of ['lp', 'rp', 'lk', 'rk']) if (p[k]) window.__got.push(k); return step(p, q); }; });
await t.tap('#fight [data-b="rk"]');
check('Touch: tapping Right foot presses it', await until(t, () => window.__got.join() === 'rk', null, 5000), await G(t, () => window.__got.join()));
await G(t, () => { window.__got = []; });
await t.tap('#fight [data-b="throw"]');
check('Touch: Throw presses both hands at once', await until(t, () => window.__got.join() === 'lp,rp', null, 5000), await G(t, () => window.__got.join()));
await t.screenshot({ path: path.join(shots, 'b35-fight-touch.png') });


// Gamepad (mocked standard-mapping pad): the stick moves, hops and guards, X/Y/A/B are the limbs, RB throws, Start leaves.
await t.close();
const gctx = await browser.newContext({ viewport: { width: 1280, height: 720 } });
await gctx.addInitScript(() => {
  const pad = { id: 'Test Pad (STANDARD GAMEPAD)', index: 0, connected: true, mapping: 'standard', timestamp: 0,
    axes: [0, 0, 0, 0], buttons: Array.from({ length: 17 }, () => ({ pressed: false, touched: false, value: 0 })) };
  window.__pad = pad;
  navigator.getGamepads = () => [pad, null, null, null];
});
const gp = await gctx.newPage();
await gp.route(/^https?:/, (r) => r.abort());
await gp.goto('file://' + file);
await gp.waitForFunction(() => window.__gametool, null, { timeout: 90000 });
await gp.waitForTimeout(400);
await gp.click('#begin');
await gp.waitForFunction(() => window.__gametool.state === 'play', null, { timeout: 60000 });
await G(gp, () => window.__gametool.openFight());
await until(gp, () => window.__gametool.fightMode.fight.phase === 'fight', null, 30000);
const btn = (i, on) => G(gp, ([i, on]) => { const b = window.__pad.buttons[i]; b.pressed = on; b.value = on ? 1 : 0; }, [i, on]);
const x0 = await G(gp, () => window.__gametool.fightMode.fight.a.x);
await G(gp, () => { window.__pad.axes[0] = 1; });
const moved = await until(gp, (x0) => window.__gametool.fightMode.fight.a.x > x0 + 0.3, x0, 10000);
await G(gp, () => { window.__pad.axes[0] = 0; });
check('Pad: left stick walks', moved);
await G(gp, () => { window.__pad.axes[1] = -1; });
check('Pad: stick up hops', await until(gp, () => window.__gametool.fightMode.fight.a.y > 0.1, null, 5000));
await G(gp, () => { window.__pad.axes[1] = 0; });
await until(gp, () => window.__gametool.fightMode.fight.a.grounded, null, 5000);
const back = await G(gp, () => { const f = window.__gametool.fightMode.fight; return f.b.x > f.a.x ? -1 : 1; });
await G(gp, (b) => { window.__pad.axes[0] = b; }, back);
check('Pad: holding the stick back guards', await until(gp, () => { const s = window.__gametool.fightMode.fight.a.state; return s === 'guard' || s === 'block'; }, null, 5000));
await G(gp, () => { window.__pad.axes[0] = 0; });
// A move can start and finish inside one slow frame, so watch what reaches the fight engine instead.
await G(gp, () => { const f = window.__gametool.fightMode.fight, step = f.step.bind(f); window.__got = []; f.step = (p, q) => { for (const k of ['lp', 'rp', 'lk', 'rk']) if (p[k]) window.__got.push(k); return step(p, q); }; });
await btn(0, true);
check('Pad: A is the left foot (one press, one kick)', await until(gp, () => window.__got.join() === 'lk', null, 5000) && await G(gp, () => new Promise((r) => setTimeout(() => r(window.__got.join() === 'lk'), 500))));
await btn(0, false);
await btn(2, true); await until(gp, () => window.__got.length > 1, null, 5000); await btn(2, false);
await btn(5, true); await until(gp, () => window.__got.length > 3, null, 5000); await btn(5, false);
check('Pad: X is the left hand, RB throws (both hands)', await G(gp, () => window.__got.join()) === 'lk,lp,lp,rp', await G(gp, () => window.__got.join()));
const help = await G(gp, () => { const v = (s) => !!document.querySelector(s).offsetParent; return { pad: v('#fight .fx-help-pad'), keys: v('#fight .fx-help-keys'), mode: document.body.dataset.input }; });
check('Pad: the controls line shows pad buttons', help.pad && !help.keys, JSON.stringify(help));
await btn(9, true);
check('Pad: Start leaves the mat', await until(gp, () => window.__gametool.state === 'play' && !window.__gametool.fightMode.isOpen, null, 10000));
await btn(9, false);

await browser.close();
const failed = results.filter((r) => !r.ok).length;
console.log(`${results.length - failed}/${results.length} checks passed`);
process.exit(failed ? 1 : 0);
