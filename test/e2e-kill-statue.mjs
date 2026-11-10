// B49 (Mike 2026-11-04): most goblins in one delve, as a statue of you on the green with a plaque giving the count.
// Usage: node test/e2e-kill-statue.mjs [path/to/index.html]   (CHROMIUM_PATH as in e2e.mjs)
import { chromium } from 'playwright-core';
import fs from 'node:fs';
import path from 'node:path';
import { serve, OUTSIDE } from './serve.mjs';

const file = path.resolve(process.argv[2] ?? 'dist/index.html');
const pageUrl = await serve(file);   // http, not file://: saves must survive a reload (test/serve.mjs)
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const results = [];
const check = (id, ok, detail = '') => { results.push({ id, ok }); console.log(`${ok ? 'PASS' : 'FAIL'}  ${id}${detail ? '  — ' + detail : ''}`); };
const ctx = await browser.newContext({ viewport: { width: 1100, height: 680 } });
await ctx.addInitScript(() => localStorage.setItem('gametool.character', JSON.stringify({ name: 'Rowan', motivation: '', secret: '', created: true })));
const page = await ctx.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
await page.route(OUTSIDE, (r) => r.abort());
const boot = async () => {
  await page.goto(pageUrl(), { timeout: 180000 });
  await page.waitForFunction(() => window.__gametool, null, { timeout: 180000 });
  await page.evaluate(() => document.querySelector('#begin').click());
  await page.waitForFunction(() => window.__gametool.state === 'play', null, { timeout: 180000 });
};
const G = (fn, a) => page.evaluate(fn, a);
const shared = /const SHARED = new Set\(\[([^\]]*)\]/.exec(fs.readFileSync('src/profiles.ts', 'utf8'))?.[1] ?? '';
check('B49 kills are kept per profile (not a shared device key)', !/'kills'/.test(shared));

await boot();
const s0 = await G(() => { const g = window.__gametool, st = g.killStatue; return { inScene: !!g.world.scene.getObjectByName('kill-statue'), figure: !!st.figure, best: g.kills.best, plaque: !!st.group.getObjectByName('kill-plaque') }; });
check('B49 with no record the plinth and plaque stand on the green, waiting (no figure)', s0.inScene && s0.plaque && !s0.figure && s0.best === null, JSON.stringify(s0));
// One delve, three goblins beaten.
const killN = (n) => G(async (n) => { const g = window.__gametool; let k = 0;
  for (let i = 0; i < 40 && k < n; i++) { const f = g.goblins.alive[0]; if (!f) { g.spawnGoblins(); await new Promise((r) => setTimeout(r, 100)); continue; } g.goblins.kill(f); k++; await new Promise((r) => setTimeout(r, 50)); }
  return k; }, n);
await G(() => window.__gametool.enterDungeon(99));
await page.waitForFunction(() => window.__gametool.inDungeon, null, { timeout: 30000 });
const k1 = await killN(3);
await G(() => window.__gametool.exitDungeon());
await page.waitForTimeout(300);
const s1 = await G(() => { const g = window.__gametool; return { best: g.kills.best?.count, name: g.kills.best?.name, total: g.kills.total, figure: !!g.killStatue.figure, stored: JSON.parse(localStorage.getItem('gametool.kills')).best.count }; });
check('B49 a delve sets the record: the statue gets your figure, the count is saved', k1 === 3 && s1.best === 3 && s1.stored === 3 && s1.figure && s1.name === 'Rowan' && s1.total === 3, JSON.stringify(s1));
// Look at it.
await G(() => { const g = window.__gametool, p = g.killStatue.group.position; g.player.pos.set(p.x + Math.sin(g.killStatue.group.rotation.y) * 3.2, 0, p.z + Math.cos(g.killStatue.group.rotation.y) * 3.2); g.player.yaw = g.killStatue.group.rotation.y; g.player.pitch = -0.05; });
await page.waitForTimeout(800);
fs.mkdirSync('test/screenshots', { recursive: true });
await page.screenshot({ path: 'test/screenshots/b49-statue.png' });
// A smaller delve doesn't beat it.
await G(() => window.__gametool.enterDungeon(100));
await page.waitForFunction(() => window.__gametool.inDungeon, null, { timeout: 30000 });
await killN(2);
await G(() => window.__gametool.exitDungeon());
const s2 = await G(() => ({ best: window.__gametool.kills.best.count, total: window.__gametool.kills.total }));
check('B49 a smaller delve leaves the record alone (the lifetime total still counts)', s2.best === 3 && s2.total === 5, JSON.stringify(s2));
// The plaque, read.
const plaque = await G(() => { window.__toasts = []; const el = document.getElementById('toast'); new MutationObserver(() => window.__toasts.push(el.textContent)).observe(el, { childList: true, characterData: true, subtree: true });
  const g = window.__gametool, it = g.interactables.find((x) => x.obj === g.killStatue.hit); return { verb: it.verb(), _: it.act() }; });
await page.waitForTimeout(200);
const t = await G(() => window.__toasts.join(' | '));
check('B49 E on the statue reads the plaque: name, count, and your lifetime total', plaque.verb === 'Read the plaque' && /Rowan: 3 goblins in one delve/.test(t) && /in all: 5/.test(t), t);
// After a reload the statue is still there.
await boot();
const s3 = await G(() => ({ figure: !!window.__gametool.killStatue.figure, best: window.__gametool.kills.best?.count, stored: (localStorage.getItem('gametool.kills') ?? 'none').slice(0, 40), keys: Object.keys(localStorage).join(',') }));
check('B49 the statue and record survive a reload', s3.figure && s3.best === 3, JSON.stringify(s3));
check('B49 no page errors', errors.length === 0, errors.join(' | '));

await browser.close();
const failed = results.filter((r) => !r.ok).length;
console.log(`\n${results.length - failed}/${results.length} checks passed`);
process.exit(failed ? 1 : 0);
