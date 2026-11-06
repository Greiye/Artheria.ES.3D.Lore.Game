// Mike 2026-11-06 ("fighter: bonus attack techniques, maybe assign to LB and RB. Fighters can take a breathe and gain
// temp HP"): a Fighter's Lunge (LB / Z), Sweep (RB / X) and breath (LB + RB held / V).
// Usage: npm run build && node test/e2e-fighter.mjs [path/to/index.html]
import { chromium } from 'playwright-core';
import path from 'node:path';

const file = path.resolve(process.argv[2] ?? 'dist/index.html');
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const results = [];
const check = (id, ok, detail = '') => { results.push({ id, ok }); console.log(`${ok ? 'PASS' : 'FAIL'}  ${id}${detail ? '  — ' + detail : ''}`); };
const ctx = await browser.newContext({ viewport: { width: 1100, height: 680 } });
await ctx.addInitScript(() => {
  localStorage.setItem('gametool.character', JSON.stringify({ name: 'Brant', motivation: '', secret: '', created: true, profession: 'fighter' }));
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
check('a Fighter sees the three technique buttons', await until(() => !document.getElementById('techHud').classList.contains('hidden') && [...document.querySelectorAll('#techHud [data-tech]')].filter((b) => getComputedStyle(b).display !== 'none').length === 3));

// Z: the lunge carries you forward.
await G(() => { const p = window.__gametool.player; p.pos.set(-20, 0, 30); p.yaw = p.bodyYaw = 0; });
await page.waitForTimeout(300);
const z0 = await G(() => window.__gametool.player.pos.z);
await page.keyboard.press('KeyZ');
await page.waitForTimeout(600);
const lunge = await G((z0) => { const g = window.__gametool; return { moved: z0 - g.player.pos.z, cd: g.fighterKit.cd.lunge, log: g.techLog.length }; }, z0);
check('Z lunges about 2.6 m forward and starts its cooldown', lunge.moved > 2 && lunge.moved < 3.2 && lunge.cd > 2 && lunge.log === 1, JSON.stringify(lunge));
await page.keyboard.press('KeyZ');
check('again too soon: "ready in" and no second lunge', await until(() => /Lunge ready in/.test(document.getElementById('toast').textContent)) && await G(() => window.__gametool.techLog.length === 1));
// The pad's LB / RB are techniques for a Fighter (not the camera).
const step0 = await G(() => window.__gametool.rig.step);
await hold(5, true); await until(() => window.__gametool.techLog.at(-1)?.t === 'sweep', null, 5000); await hold(5, false); await page.waitForTimeout(200);
const sweep = await G(() => ({ step: window.__gametool.rig.step, log: window.__gametool.techLog.map((x) => x.t), cd: window.__gametool.fighterKit.cd.sweep }));
check('RB sweeps (and leaves the camera where it was)', sweep.log.at(-1) === 'sweep' && sweep.cd > 4 && sweep.step === step0, JSON.stringify({ ...sweep, st: await G(() => window.__gametool.state), menu: await G(() => document.querySelector('.coach:not(.hidden), #nolock:not(.hidden)')?.id) }));
// Both shoulders held: take a breath (still for a second), then temporary health.
await hold(4, true); await hold(5, true);
check('LB + RB held takes a breath', await until(() => window.__gametool.fighterKit.uses.breath === 1, null, 6000));
await hold(4, false); await hold(5, false);
check('…and after a moment, +4 temporary health', await until(() => window.__gametool.fighterKit.temp === 4, null, 5000));
check('the breath absorbs a blow before real health', await G(() => { const k = window.__gametool.fighterKit; const through = k.absorb(3); return through === 0 && k.temp === 1; }));

// In the descent: a sweep hits the goblin beside you.
await G(() => window.__gametool.startDescent());
await until(() => window.__gametool.inDungeon && window.__gametool.goblins.alive.length > 0, null, 30000);
const nLog = await G(() => window.__gametool.techLog.length);
const hp0 = await G(() => { const g = window.__gametool; g.fighterKit.cd.sweep = 0; const f = g.goblins.alive[0], p = g.player.pos; f.root.position.set(p.x + 1, f.root.position.y, p.z); g.technique('sweep'); return f.hp; });
await until((n) => window.__gametool.techLog.length > n, nLog, 3000);
const hit = await G(() => ({ n: window.__gametool.techLog.at(-1).n, hud: document.getElementById('delveHp')?.textContent ?? '' }));
check('X sweeps all round: the goblin beside you is hit', hit.n >= 1, JSON.stringify({ hp0, ...hit }));
await page.screenshot({ path: 'test/screenshots/fighter-sweep.png' });

// Not a Fighter: the shoulders zoom again and the buttons hide.
await G(() => { const g = window.__gametool; g.exitDungeon(); g.openCharacterForge(); g.characterForge.setProfession('ranger'); g.characterForge.close(); });
await until(() => window.__gametool.state === 'play' || window.__gametool.state === 'resume');
if (await G(() => window.__gametool.state === 'resume')) await page.click('#relockBtn');
await until(() => window.__gametool.state === 'play');
check('another profession: no technique buttons', await until(() => document.getElementById('techHud').classList.contains('hidden')));
const s1 = await G(() => window.__gametool.rig.step);
const n1 = await G(() => window.__gametool.techLog.length);
await hold(4, true); const zoomed = await until((s1) => window.__gametool.rig.step !== s1, s1, 5000); await hold(4, false);
check('…and LB zooms the camera again (no technique)', zoomed && await G((n1) => window.__gametool.techLog.length === n1, n1), String(s1));

check('no page errors', errors.length === 0, errors.join(' | '));
await browser.close();
const passed = results.filter((r) => r.ok).length;
console.log(`\n${passed}/${results.length} checks passed`);
process.exit(passed === results.length ? 0 : 1);
