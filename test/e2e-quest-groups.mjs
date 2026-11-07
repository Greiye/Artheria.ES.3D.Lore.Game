// B52 + B53 (Mike 2026-11-06): two quest groups in the casebook, meet everyone and use every station. A step completes
// on first use, the casebook shows the count, and finishing a group pays a purse once.
// Usage: node test/e2e-quest-groups.mjs [path/to/index.html]   (CHROMIUM_PATH as in e2e.mjs)
import { chromium } from 'playwright-core';
import path from 'node:path';

const file = path.resolve(process.argv[2] ?? 'dist/index.html');
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const results = [];
const check = (id, ok, detail = '') => { results.push({ id, ok }); console.log(`${ok ? 'PASS' : 'FAIL'}  ${id}${detail ? '  — ' + detail : ''}`); };
const ctx = await browser.newContext({ viewport: { width: 1100, height: 680 } });
await ctx.addInitScript(() => localStorage.setItem('gametool.character', JSON.stringify({ name: 'Rowan', motivation: '', secret: '', created: true })));
const page = await ctx.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
await page.route(/^https?:/, (r) => r.abort());
await page.goto('file://' + file, { timeout: 180000 });
await page.waitForFunction(() => window.__gametool, null, { timeout: 180000 });
await page.evaluate(() => document.querySelector('#begin').click());
await page.waitForFunction(() => window.__gametool.state === 'play', null, { timeout: 180000 });
await page.evaluate(() => window.__gametool.endWake?.());
await page.waitForTimeout(1500);
const G = (fn, a) => page.evaluate(fn, a);
await G(() => window.__gametool.firstDay.skip());

const g0 = await G(() => { const g = window.__gametool.groups; return { npc: g.count('npc'), st: g.count('station') }; });
check('Two groups: 16 people and 14 stations, none done yet', g0.npc.join() === '0,16' && g0.st.join() === '0,14', JSON.stringify(g0));
// Talk to Candor the usual way (E).
await G(() => { const g = window.__gametool, h = g.candorHit.position; g.player.pos.set(h.x, 0, h.z + 1.6); g.player.yaw = g.player.bodyYaw = 0; g.player.pitch = -0.1; });
await page.waitForFunction(() => /Candor/.test(window.__gametool.lookingAtVerb ?? ''), null, { timeout: 8000, polling: 200 }).catch(() => {});
await page.keyboard.press('KeyE');
await page.waitForFunction(() => window.__gametool.state === 'dialogue', null, { timeout: 5000 }).catch(() => {});
const t1 = await G(() => { const g = window.__gametool; return { state: g.state, met: [...g.groups.npcs], toast: document.querySelector('#toast')?.textContent ?? '' }; });
check('Talking to Candor counts her as met, with a toast', t1.state === 'dialogue' && t1.met.join() === 'candor' && /Met Candor: 1 of 16/.test(t1.toast), JSON.stringify(t1));
await G(() => { const d = window.__gametool.dialogue; for (let i = 0; i < 8 && d.open; i++) { if (d.typing) d.advance(); else if (d.node?.choices?.length) d.choose(d.node.choices.length - 1); else d.advance(); } });
await page.waitForFunction(() => window.__gametool.state === 'play', null, { timeout: 5000 }).catch(() => {});
// A station: the Cartographer's map.
await G(() => { window.__gametool.openMap(); });
await page.waitForTimeout(300);
const m1 = await G(() => { const g = window.__gametool; const r = { st: [...g.groups.stations] }; g.livingMap.close(); return r; });
check("Opening the Cartographer's map counts that station", m1.st.join() === 'map', JSON.stringify(m1));
await page.waitForFunction(() => window.__gametool.state === 'play', null, { timeout: 5000 }).catch(() => {});
// The casebook shows both groups and their counts.
const cb = await G(() => { const g = window.__gametool; g.casebook.open(); const el = g.casebook.el; return { npc: el.querySelector('[data-group="npc"] .cb-count')?.textContent, st: el.querySelector('[data-group="station"] .cb-count')?.textContent, got: [...el.querySelectorAll('.cb-group li.got')].map((li) => li.textContent.trim()) }; });
check('The casebook lists both groups with counts and ticks', cb.npc === '1 of 16' && cb.st === '1 of 14' && cb.got.length === 2, JSON.stringify(cb));
// Finish the people group: one purse, once.
const fin = await G(() => {
  const g = window.__gametool, before = g.inventory.count('crown');
  for (const id of ['natalie', 'pedlar', 'kavik', 'candor', 'lenju', 'taitai', 'cook', 'weaver', 'muleteer', 'shopkeeper', 'smith', 'tam', 'josh', 'jason', 'liv', 'rev']) g.groups.mark('npc', id);
  const mid = g.inventory.count('crown');
  g.groups.mark('npc', 'natalie'); g.groups.mark('npc', 'nobody');
  return { paid: mid - before, again: g.inventory.count('crown') - mid, n: g.groups.count('npc'), saved: JSON.parse(localStorage.getItem('gametool.groups')).npcs.length };
});
check('Meeting all 16 pays 15 crowns once; repeats and unknown ids do nothing', fin.paid === 15 && fin.again === 0 && fin.n.join() === '16,16' && fin.saved === 16, JSON.stringify(fin));
await page.reload();
await page.waitForFunction(() => window.__gametool, null, { timeout: 180000 });
const kept = await G(() => { const g = window.__gametool.groups; return { npc: g.count('npc'), st: g.count('station') }; });
check('Progress is kept across a reload', kept.npc.join() === '16,16' && kept.st.join() === '1,14', JSON.stringify(kept));
check('No page errors', errors.length === 0, errors.slice(0, 3).join(' | '));
await browser.close();
const passed = results.filter((r) => r.ok).length;
console.log(`${passed}/${results.length} checks passed`);
process.exit(passed === results.length ? 0 : 1);
