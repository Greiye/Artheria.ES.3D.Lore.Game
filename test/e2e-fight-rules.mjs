// Fight rework (Mike 2026-11-04, "more like Tekken"): the rules of the fight engine (src/fight/engine.ts), driven
// frame by frame with set inputs inside the built game: four limb buttons, highs / mids / lows against standing and
// crouching guards, throws and throw breaks, strings, punishing a move that is unsafe on block, a launcher and a
// juggle, a wall splat and a counter hit.
// Usage: node test/e2e-fight-rules.mjs [path/to/index.html]   (CHROMIUM_PATH as in e2e.mjs)
import { chromium } from 'playwright-core';
import path from 'node:path';

const file = path.resolve(process.argv[2] ?? 'dist/index.html');
const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH || undefined,
  args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'],
});
const results = [];
const check = (id, ok, detail = '') => { results.push({ id, ok }); console.log(`${ok ? 'PASS' : 'FAIL'}  ${id}${detail ? '  — ' + detail : ''}`); };
const page = await (await browser.newContext({ viewport: { width: 800, height: 450 } })).newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
await page.route(/^https?:/, (r) => r.abort());
await page.goto('file://' + file);
await page.waitForFunction(() => window.__gametool, null, { timeout: 90000 });

// A tiny script runner in the page: a fresh fight, both fighters close, then frames of set inputs.
await page.evaluate(() => {
  const Fight = window.__gametool.fightMode.fight.constructor;
  const idle = { x: 0, up: false, down: false, lp: false, rp: false, lk: false, rk: false };
  window.__run = (setup, script, frames) => {
    const f = new Fight(); f.phase = 'fight';
    f.a.x = -0.45; f.b.x = 0.45;
    setup?.(f);
    const log = [];
    for (let i = 0; i < frames; i++) {
      const [pa, pb] = script(i, f);
      f.step({ ...idle, ...pa }, { ...idle, ...pb });
      for (const e of f.events) log.push({ i, by: e.by.name, on: e.on.name, move: e.move.id, blocked: e.blocked, outcome: e.outcome });
      if (f.__probe) f.__probe(i, f);
    }
    return { log, a: { hp: f.a.hp, state: f.a.state, x: f.a.x }, b: { hp: f.b.hp, state: f.b.state, x: f.b.x, juggles: f.b.juggles }, seen: f.__seen ?? null };
  };
});
const run = (src) => page.evaluate(src);

// 1. A jab hits a fighter standing still; held back (away from the other fighter) blocks it; crouching ducks it.
let r = await run(() => window.__run(null, (i) => [{ lp: i === 0 }, {}], 40));
check('Left hand: a jab hits a fighter standing still', r.b.hp < 100 && r.log.some((e) => e.move === 'jab' && !e.blocked), JSON.stringify(r.log));
r = await run(() => window.__run(null, (i) => [{ lp: i === 0 }, { x: 1 }], 40));
check('Holding back blocks a high', r.b.hp === 100 && r.log.some((e) => e.move === 'jab' && e.blocked), JSON.stringify(r.log));
r = await run(() => window.__run(null, (i) => [{ lp: i === 0 }, { down: true }], 40));
check('Crouching ducks a high (it whiffs)', r.b.hp === 100 && r.log.length === 0, JSON.stringify(r.log));
// 2. Lows and mids.
r = await run(() => window.__run(null, (i) => [{ lk: i === 0, down: i < 3 }, { x: 1 }], 50));
check('A low (down + left foot) hits through a standing guard', r.b.hp < 100 && r.log.some((e) => e.move === 'sweep' && !e.blocked), JSON.stringify(r.log));
r = await run(() => window.__run(null, (i) => [{ lk: i === 0, down: i < 3 }, { x: 1, down: true }], 50));
check('Down-back blocks the low', r.b.hp === 100 && r.log.some((e) => e.move === 'sweep' && e.blocked), JSON.stringify(r.log));
r = await run(() => window.__run(null, (i) => [{ lk: i === 0, x: i < 3 ? 1 : 0 }, { x: 1, down: true }], 50));
check('A mid (forward + left foot) hits a crouching guard', r.b.hp < 100 && r.log.some((e) => e.move === 'snap' && !e.blocked), JSON.stringify(r.log));
r = await run(() => window.__run(null, (i) => [{ lk: i === 0, x: i < 3 ? 1 : 0 }, { x: 1 }], 50));
check('A standing guard blocks the mid', r.b.hp === 100 && r.log.some((e) => e.move === 'snap' && e.blocked), JSON.stringify(r.log));
// 3. Throws.
r = await run(() => window.__run(null, (i) => [{ lp: i === 0, rp: i === 0 }, { x: 1 }], 90));
check('Both hands throw, through a guard', r.b.hp === 82 && r.log.some((e) => e.outcome === 'throw'), JSON.stringify({ hp: r.b.hp, log: r.log }));
r = await run(() => window.__run(null, (i) => [{ lp: i === 0, rp: i === 1 }, {}], 90));
check('The second hand a frame later still throws', r.log.some((e) => e.outcome === 'throw'), JSON.stringify(r.log));
r = await run(() => window.__run(null, (i, f) => [{ lp: i === 0, rp: i === 0 }, { lp: f.b.state === 'thrown' && !f.__p ? (f.__p = true) : false }], 90));
check('Pressing a hand while caught breaks the throw', r.b.hp === 100 && r.log.some((e) => e.outcome === 'break'), JSON.stringify(r.log));
r = await run(() => window.__run(null, (i) => [{ lp: i === 0, rp: i === 0 }, { down: true }], 90));
check('A throw whiffs on a crouch', r.b.hp === 100 && !r.log.some((e) => e.outcome === 'throw'), JSON.stringify(r.log));
// 4. A string: jab, then the right hand pressed during it, goes on into the cross.
r = await run(() => window.__run(null, (i) => [{ lp: i === 0, rp: i === 6 }, {}], 60));
check('Strings: left hand then right hand chains a jab into a cross (two hits)', r.log.filter((e) => e.by === 'player' && !e.blocked).map((e) => e.move).join() === 'jab,jab2', JSON.stringify(r.log));
// 5. Unsafe on block: the long sweep blocked low leaves the sweeper open; a jab right after punishes it.
r = await page.evaluate(() => {
  const res = window.__run((f) => { f.__probe = (i, f) => { if (f.b.state === 'block') f.__blocked = true; else if (f.__blocked && f.a.move && !f.__freeAt) f.__freeAt = i; }; }, (i, f) => [{ rk: i === 0, down: i < 3 }, f.__freeAt ? { lp: !f.__jab && (f.__jab = true) } : { x: 1, down: true }], 120);
  return res;
});
check('Unsafe on block: the low guard is free before the long sweep recovers, and a jab punishes it', r.a.hp < 100 && r.log.some((e) => e.by === 'kavik' && e.move === 'jab' && !e.blocked), JSON.stringify(r.log));
// 6. Launcher and juggle.
r = await page.evaluate(() => window.__run((f) => { f.__seen = { air: 0 }; f.__probe = (i, f) => { if (f.b.state === 'juggle') f.__seen.air++; }; }, (i, f) => [{ rp: i === 0, x: i < 3 ? 1 : 0, lp: f.b.state === 'juggle' && f.b.y > 0.6 && !f.a.move && !f.__j && (f.__j = true) }, {}], 160));
check('Forward + right hand launches; a jab juggles; then down', r.log.filter((e) => e.by === 'player' && !e.blocked).length >= 2 && r.log[0].move === 'palm' && r.seen.air > 20 && (r.b.state === 'down' || r.b.state === 'idle'), JSON.stringify({ log: r.log, b: r.b, seen: r.seen }));
// 7. Wall splat: a heavy hit near the wall sticks the other fighter to it.
r = await page.evaluate(() => window.__run((f) => { f.b.x = 3.1; f.a.x = 2.2; f.__seen = { splat: false }; f.__probe = (i, f) => { if (f.b.state === 'splat') f.__seen.splat = true; }; }, (i) => [{ rk: i === 0, x: i < 3 ? 1 : 0 }, {}], 80));
check('A heavy hit near the wall (forward + right foot) splats on it', r.seen.splat && r.log.some((e) => e.outcome === 'splat'), JSON.stringify({ log: r.log, b: r.b }));
// 8. Counter hit: a jab that lands while the other fighter is starting a slow kick does more.
r = await run(() => window.__run(null, (i) => [{ lp: i === 2 }, { rk: i === 0 }], 30));
check('Counter hit: hitting a move as it starts', r.log.some((e) => e.by === 'player' && e.outcome === 'counter') && r.b.hp === 94, JSON.stringify({ log: r.log, hp: r.b.hp }));
// 9. Kavik's AI drives the same buttons and lands something within a short spar.
r = await page.evaluate(() => {
  const g = window.__gametool, Fight = g.fightMode.fight.constructor, AI = g.fightMode.ai.constructor;
  const f = new Fight(); f.phase = 'fight'; const ai = new AI('fair', () => Math.random());
  const idle = { x: 0, up: false, down: false, lp: false, rp: false, lk: false, rk: false };
  let moves = 0, hits = 0;
  for (let i = 0; i < 60 * 20; i++) { f.step(idle, ai.pad(f)); if (f.b.move && f.b.t === 1) moves++; hits += f.events.filter((e) => e.by === f.b).length; }
  return { moves, hits, hp: f.a.hp };
});
check('Kavik walks in and attacks with the limb moves', r.moves >= 3 && r.hits >= 1, JSON.stringify(r));
check('No page errors', errors.length === 0, errors.slice(0, 3).join(' | '));

await browser.close();
const failed = results.filter((x) => !x.ok).length;
console.log(`${results.length - failed}/${results.length} checks passed`);
process.exit(failed ? 1 : 0);
