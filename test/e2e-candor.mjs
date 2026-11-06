// Mike 2026-11-06 ("Add to world. Have him teach Archery. Name him Candor."): Candor (Mike's Painted Archer model)
// teaches archery at his range: three straw butts, one bolt in each.
// Usage: npm run build && node test/e2e-candor.mjs [path/to/index.html]
import { chromium } from 'playwright-core';
import path from 'node:path';
import fs from 'node:fs';
import http from 'node:http';

const file = path.resolve(process.argv[2] ?? 'dist/index.html');
// Models load over http (file:// can't fetch them).
const root = path.dirname(file);
const server = http.createServer((req, res) => {
  const p = path.join(root, decodeURIComponent(new URL(req.url, 'http://x').pathname));
  if (!p.startsWith(root) || !fs.existsSync(p) || fs.statSync(p).isDirectory()) { res.writeHead(404); res.end(); return; }
  res.writeHead(200, { 'Content-Type': p.endsWith('.html') ? 'text/html' : p.endsWith('.js') ? 'text/javascript' : 'application/octet-stream' });
  fs.createReadStream(p).pipe(res);
});
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const base = `http://127.0.0.1:${server.address().port}/`;
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const results = [];
const check = (id, ok, detail = '') => { results.push({ id, ok }); console.log(`${ok ? 'PASS' : 'FAIL'}  ${id}${detail ? '  — ' + detail : ''}`); };
const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 } });
const page = await ctx.newPage();
const G = (fn, a) => page.evaluate(fn, a);
const until = (fn, a, timeout = 15000) => page.waitForFunction(fn, a, { timeout, polling: 100 }).then(() => true, () => false);
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
await page.route(/^https?:\/\/(?!127\.0\.0\.1)/, (r) => r.abort());
await page.goto(base + path.basename(file) + '?models=candor', { timeout: 180000 });
await page.waitForFunction(() => window.__gametool, null, { timeout: 180000 });
await G(() => document.querySelector('#begin').click());
await page.waitForFunction(() => window.__gametool.state === 'play', null, { timeout: 180000 });
await G(() => window.__gametool.endWake?.());

const loaded = await G(() => window.__gametool.modelsReady.then(() => window.__gametool.loadedModels.has('candor')));
check("Candor stands at his range in Mike's Painted Archer model", loaded, String(loaded));
check('three straw butts down the range', await G(() => window.__gametool.world.archery.length === 3 && window.__gametool.world.archery.every((b) => b.root.visible)));
check('the map lists his range', await G(() => window.__gametool.livingMap.sights().some((s) => /Candor/.test(s.label))));
// A look down the range from behind the shooting line.
await G(() => { const g = window.__gametool, c = g.candorHit.position; g.player.pos.set(c.x - 3, 0, c.z + 2.2); g.player.yaw = g.player.bodyYaw = -Math.PI / 2 + 0.45; g.player.pitch = -0.08; g.player.thirdPerson = false; });
await page.waitForTimeout(1500);
await page.screenshot({ path: 'test/screenshots/candor-range.png' });
await G(() => { const g = window.__gametool, c = g.candorHit.position; g.player.pos.set(c.x + 2.2, 0, c.z + 0.3); g.player.yaw = g.player.bodyYaw = Math.PI / 2 - 0.1; g.player.pitch = -0.05; });
await page.waitForTimeout(1200);
await page.screenshot({ path: 'test/screenshots/candor.png' });
await G(() => { window.__gametool.player.thirdPerson = true; });

// Talk: no crossbow yet, so he lends one with the lesson.
await G(() => { const g = window.__gametool, c = g.candorHit.position; g.player.pos.set(c.x, 0, c.z + 1.6); g.player.yaw = 0; });
check('his prompt says archery', await G(() => window.__gametool.interactables.find((i) => i.obj === window.__gametool.candorHit).verb() === 'Talk to Candor (archery)'));
await G(() => window.__gametool.interactables.find((i) => i.obj === window.__gametool.candorHit).act());
await until(() => window.__gametool.state === 'dialogue');
const choicesNow = async () => { for (let i = 0; i < 20; i++) { const c = await G(() => [...document.querySelectorAll('#dialogue .d-choice span')].map((x) => x.textContent)); if (c.length) return c; await page.waitForTimeout(200); if (i === 5) await page.keyboard.press('Space'); } return []; };
const ch = await choicesNow();
check('he offers a lesson and how to aim', ch.includes('Teach me archery.') && ch.includes('How do I aim?'), JSON.stringify(ch));
await G(() => window.__gametool.dialogue.choose(0));
for (let i = 0; i < 15 && await G(() => window.__gametool.state === 'dialogue'); i++) { await page.keyboard.press('Space'); await page.waitForTimeout(150); }
if (await G(() => window.__gametool.state === 'resume')) await page.click('#relockBtn');
await until(() => window.__gametool.state === 'play');
check('with no crossbow he lends one (and bolts), and the lesson starts', await G(() => window.__gametool.inventory.count('crossbow') === 1 && window.__gametool.inventory.count('bolt') >= 10 && !!window.__gametool.lesson));

// Shoot each butt from the line (aimed at its gold, allowing for the drop), plus one into the hay beyond.
const shoot = (i) => G((i) => { const g = window.__gametool, t = g.world.archery[i].centre, p = g.player, c = g.candorHit.position;
  p.pos.set(c.x + 0.8, 0, c.z); p.update(0); p.syncNow(); const e = p.eyePos, dx = t.x - e.x, dz = t.z - e.z, d = Math.hypot(dx, dz), tt = d / 60;
  p.yaw = Math.atan2(-dx, -dz); p.pitch = Math.atan2(t.y - e.y, d) + Math.atan2(0.5 * 9.8 * tt * tt, d);
  if (!g.crossbow.equipped) g.crossbow.equip(); g.crossbow.loaded = true; g.crossbow.stability = 1; return g.crossbow.fire(); }, i);
for (const i of [0, 1]) { check(`bolt ${i + 1} looses`, await shoot(i)); await until(() => window.__gametool.crossbow.bolts.at(-1)?.stuck, null, 8000); await page.waitForTimeout(300); }
const mid = await G(() => ({ hit: window.__gametool.lesson?.hit, toast: document.getElementById('toast').textContent }));
check('he calls each hit by its ring and counts what is left', JSON.stringify(mid.hit) === '[true,true,false]' && /Candor: "(Gold|Red|Blue|Black|White).*1 to go/.test(mid.toast), JSON.stringify(mid));
const c0 = await G(() => window.__gametool.purse?.crowns ?? window.__gametool.inventory.count('crown'));
await shoot(2); await until(() => window.__gametool.crossbow.bolts.at(-1)?.stuck, null, 8000);
check('all three: the lesson ends', await until(() => !window.__gametool.lesson, null, 5000));
check('the first lesson pays 15 crowns and saves his record', await until((c0) => (window.__gametool.purse?.crowns ?? window.__gametool.inventory.count('crown')) >= c0 + 15, c0, 6000)
  && await G(() => { const a = JSON.parse(localStorage.getItem('gametool.archery')); return a.lessons === 1 && a.best === 3; }));
await page.screenshot({ path: 'test/screenshots/candor-lesson.png' });
// Next talk: he remembers the best.
await G(() => window.__gametool.interactables.find((i) => i.obj === window.__gametool.candorHit).act());
await until(() => window.__gametool.state === 'dialogue');
await choicesNow();
check('next time he remembers your best', await G(() => { const d = window.__gametool.dialogue; return /best is all three butts in 3 bolts/.test(d.script?.nodes.hi.text ?? ''); }));

check('no page errors', errors.length === 0, errors.join(' | '));
await browser.close();
server.close();
const passed = results.filter((r) => r.ok).length;
console.log(`\n${passed}/${results.length} checks passed`);
process.exit(passed === results.length ? 0 : 1);
