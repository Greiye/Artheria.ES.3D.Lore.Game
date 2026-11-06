// Mike 2026-11-06 (Round B, B5): a Monk locks on to a goblin (Z, LB on a pad, a button on touch) and meets it hand to
// hand in fight mode: one round, a smaller health bar; win and it falls, lose (or leave) and it costs you health.
// Usage: npm run build && node test/e2e-monk.mjs [path/to/index.html]
import { chromium } from 'playwright-core';
import path from 'node:path';

const file = path.resolve(process.argv[2] ?? 'dist/index.html');
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const results = [];
const check = (id, ok, detail = '') => { results.push({ id, ok }); console.log(`${ok ? 'PASS' : 'FAIL'}  ${id}${detail ? '  — ' + detail : ''}`); };
const ctx = await browser.newContext({ viewport: { width: 1100, height: 680 } });
await ctx.addInitScript(() => {
  localStorage.setItem('gametool.character', JSON.stringify({ name: 'Tamsin', motivation: '', secret: '', created: true, profession: 'monk' }));
  const p = { id: 'Test Pad (STANDARD GAMEPAD)', index: 0, connected: true, mapping: 'standard', timestamp: 0, axes: [0, 0, 0, 0], buttons: Array.from({ length: 17 }, () => ({ pressed: false, touched: false, value: 0 })) };
  window.__pad = p; navigator.getGamepads = () => [p, null, null, null];
});
const page = await ctx.newPage();
const G = (fn, a) => page.evaluate(fn, a);
const until = (fn, a, timeout = 15000) => page.waitForFunction(fn, a, { timeout, polling: 100 }).then(() => true, () => false);
const hold = (i, on) => G(([i, on]) => { window.__pad.buttons[i].pressed = on; window.__pad.buttons[i].value = on ? 1 : 0; }, [i, on]);
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
await page.route(/^https?:/, (r) => r.abort());
await page.goto('file://' + file, { timeout: 180000 });
await page.waitForFunction(() => window.__gametool, null, { timeout: 180000 });
await G(() => document.querySelector('#begin').click());
await page.waitForFunction(() => window.__gametool.state === 'play', null, { timeout: 180000 });
await G(() => window.__gametool.endWake?.());
await page.waitForTimeout(500);
check('in town: Z only says where to lock on', (await page.keyboard.press('KeyZ'), await until(() => /descent/.test(document.getElementById('toast').textContent), null, 4000)) && await G(() => !window.__gametool.fightMode.isOpen));

await G(() => window.__gametool.startDescent());
await until(() => window.__gametool.inDungeon && window.__gametool.goblins.alive.length > 0, null, 30000);
for (let i = 0; i < 20 && await G(() => window.__gametool.descendCine.active); i++) { await page.keyboard.press('Space'); await page.waitForTimeout(300); }   // the way down plays first
await page.waitForTimeout(500);
check('below, a Monk sees the Lock on button', await until(() => !document.getElementById('techHud').classList.contains('hidden') && [...document.querySelectorAll('#techHud [data-tech]')].filter((b) => getComputedStyle(b).display !== 'none').map((b) => b.dataset.tech).join() === 'lock'));
// Put a goblin two strides ahead (wake it), then lock on.
const place = () => G(() => { const g = window.__gametool, p = g.player, f = g.goblins.alive.find((x) => x.state !== 'hidden') ?? g.goblins.alive[0];
  if (f.state === 'hidden') f.state = 'idle';
  f.root.position.set(p.pos.x - Math.sin(p.bodyYaw) * 2, f.root.position.y, p.pos.z - Math.cos(p.bodyYaw) * 2); return g.goblins.alive.indexOf(f); });
await G(() => { const p = window.__gametool.player; p.thirdPerson = true; p.yaw = p.bodyYaw; });
let fi = await place();
check('with a goblin ahead, the lock finds it', await G((i) => window.__gametool.lockTarget() === window.__gametool.goblins.alive[i], fi));
const before = await G(() => ({ x: window.__gametool.player.pos.x, z: window.__gametool.player.pos.z }));
await page.keyboard.press('KeyZ');
check('Z opens fight mode against that goblin, one round', await until(() => window.__gametool.fightMode.isOpen && !!window.__gametool.duel, null, 4000)
  && await G(() => { const fm = window.__gametool.fightMode; return fm.fight.needed === 1 && fm.fight.bName === window.__gametool.duel.foe.v.display && fm.fight.bMax <= 100; }));
await page.waitForTimeout(1800);
const near = await G((b) => { const g = window.__gametool, p = g.player.pos, f = g.duel.foe.root.position; return { me: Math.hypot(p.x - b.x, p.z - b.z), gap: Math.hypot(p.x - f.x, p.z - f.z) }; }, before);
check('the mat is laid where you stood (both stay close)', near.me < 3 && near.gap < 4.5, JSON.stringify(near));
await page.screenshot({ path: 'test/screenshots/monk-duel.png' });
// Win: knock its health out.
await G(() => { const fm = window.__gametool.fightMode; fm.fight.b.hp = 0; });
await until(() => !!window.__gametool.fightMode.result, null, 8000);
check('a win shows the result', await G(() => window.__gametool.fightMode.result?.won === true && /is down/.test(document.querySelector('.fx-r-title').textContent)));
const foe = await G(() => window.__gametool.goblins.list.indexOf(window.__gametool.duel.foe));
await G(() => document.getElementById('fxLeave').click());
await until(() => window.__gametool.state === 'play' || window.__gametool.state === 'resume');
if (await G(() => window.__gametool.state === 'resume')) await page.click('#relockBtn');
check('…and back in the descent the goblin is down', await until((i) => window.__gametool.goblins.list[i].state === 'dead' && !window.__gametool.duel && window.__gametool.inDungeon, foe, 5000));

// Lose: it costs 3 health and the goblin lives.
await G(() => { window.__gametool.delveHp = 10; });
fi = await place();
await G(() => window.__gametool.lockOn());
await until(() => window.__gametool.fightMode.isOpen, null, 4000);
await page.waitForTimeout(500);
await G(() => { window.__gametool.fightMode.fight.a.hp = 0; });
await until(() => !!window.__gametool.fightMode.result, null, 8000);
await G(() => document.getElementById('fxLeave').click());
await until(() => window.__gametool.state === 'play' || window.__gametool.state === 'resume');
if (await G(() => window.__gametool.state === 'resume')) await page.click('#relockBtn');
check('a loss costs health and the goblin stays up', await until((i) => window.__gametool.delveHp === 7 && window.__gametool.goblins.alive.length > 0, fi, 5000), String(await G(() => window.__gametool.delveHp)));
// The pad: LB locks on.
await page.waitForTimeout(300);
await place();
await hold(4, true); const padLock = await until(() => window.__gametool.fightMode.isOpen, null, 5000); await hold(4, false);
check('LB locks on with a pad', padLock);
await page.waitForTimeout(400);
await G(() => document.getElementById('fxQuit').click());
check('leaving the mat early counts as breaking away', await until(() => !window.__gametool.fightMode.isOpen && window.__gametool.delveHp === 4, null, 5000), String(await G(() => window.__gametool.delveHp)));
// Kavik's spar is unchanged: best of 3 on the dojo mat.
await G(() => window.__gametool.exitDungeon());
await until(() => !window.__gametool.inDungeon);
if (await G(() => window.__gametool.state === 'resume')) await page.click('#relockBtn');
await until(() => window.__gametool.state === 'play');
await G(() => window.__gametool.openFight());
check('Kavik is still best of three', await until(() => window.__gametool.fightMode.isOpen, null, 4000) && await G(() => window.__gametool.fightMode.fight.needed === 2 && window.__gametool.fightMode.fight.bName === 'Kavik' && !window.__gametool.duel));
await G(() => document.getElementById('fxQuit').click());

check('no page errors', errors.length === 0, errors.join(' | '));
await browser.close();
const passed = results.filter((r) => r.ok).length;
console.log(`\n${passed}/${results.length} checks passed`);
process.exit(passed === results.length ? 0 : 1);
