// Pets PR 3 (Mike 2026-11-04): the pet with you warns of goblins near you below, and sniffs out what's hidden (an
// unfound clue up top, an unopened chest below), trotting over to sit by it.
// Usage: node test/e2e-pets-sense.mjs [path/to/index.html]   (CHROMIUM_PATH as in e2e.mjs)
import { chromium } from 'playwright-core';
import path from 'node:path';

const file = path.resolve(process.argv[2] ?? 'dist/index.html');
const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH || undefined,
  args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'],
});
const results = [];
const check = (id, ok, detail = '') => { results.push({ id, ok }); console.log(`${ok ? 'PASS' : 'FAIL'}  ${id}${detail ? '  — ' + detail : ''}`); };
const page = await (await browser.newContext({ viewport: { width: 1280, height: 720 } })).newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
await page.route(/^https?:/, (r) => r.abort());
await page.goto('file://' + file, { timeout: 180000 });
await page.waitForFunction(() => window.__gametool, null, { timeout: 180000 });
await page.waitForTimeout(400);
await page.evaluate(() => document.querySelector('#begin').click());
await page.waitForFunction(() => window.__gametool.state === 'play', null, { timeout: 180000 });
const G = (fn, a) => page.evaluate(fn, a);
const toastText = () => G(() => [...document.querySelectorAll('#toast, .toast')].map((e) => e.textContent).join(' | '));

// Up top: stand near an unfound clue with the dog; it leads to the clue and says so.
const clue = await G(() => { const g = window.__gametool; g.dog.befriend(); g.dog.rename('Biscuit');
  const id = [...g.questProps.hitboxes.keys()].find((k) => !g.quest.clues.includes(k)); const hb = g.questProps.hitboxes.get(id);
  g.player.pos.set(hb.position.x + 5, 0, hb.position.z + 1); g.dog.placeNear(g.player.pos, 1, 1); return { id, at: [hb.position.x, hb.position.z] }; });
await page.waitForFunction((a) => { const d = window.__gametool.dog; return Math.hypot(d.pos.x - a[0], d.pos.z - a[1]) < 1.6; }, clue.at, { timeout: 90000 }).catch(() => {});
const led = await G((a) => { const d = window.__gametool.dog; return { lead: !!d.lead, dist: +Math.hypot(d.pos.x - a[0], d.pos.z - a[1]).toFixed(2) }; }, clue.at);
const t1 = await toastText();
check('Up top: the dog sniffs out an unfound clue and sits by it', led.lead && led.dist < 1.6 && /Biscuit has its nose down/.test(t1), JSON.stringify({ ...led, t1 }));
// Below: a goblin near you gets a growl. (Goblins have their own lines, so keep every toast shown.)
await G(() => { window.__toasts = []; const el = document.getElementById('toast'); new MutationObserver(() => window.__toasts.push(el.textContent)).observe(el, { childList: true, characterData: true, subtree: true }); });
await G(() => window.__gametool.enterDungeon(window.__gametool.dungeon.layout?.seed ?? 7));
await page.waitForFunction(() => window.__gametool.inDungeon, null, { timeout: 30000 });
const warn = await G(async () => { const g = window.__gametool; const f = g.goblins.alive[0]; if (!f) return { none: true };
  g.player.pos.set(f.root.position.x + 4, g.player.pos.y, f.root.position.z); g.dog.placeNear(g.player.pos, 1, 1);
  await new Promise((r) => setTimeout(r, 2500)); return { alerting: g.dog.alerting, following: g.dog.following }; });
const t2 = await G(() => window.__toasts.join(' | '));
check('Below: the dog growls when a goblin is near you', !warn.none && /growls low/.test(t2), JSON.stringify({ warn, t2 }));
check('No console / page errors', errors.length === 0, errors.slice(0, 3).join(' | '));
await browser.close();
const failed = results.filter((x) => !x.ok).length;
console.log(`\n${results.length - failed}/${results.length} passed`);
process.exit(failed ? 1 : 0);
