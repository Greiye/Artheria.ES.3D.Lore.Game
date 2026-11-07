// B54 (Mike 2026-11-06): a wagon between Aralon and the far maps. Ride it from its stop by the coach road, pick where
// to go, arrive by the wagon there, and ride it back. In a room, friends standing at the same stop ride along.
// Usage: node test/e2e-wagon.mjs [path/to/index.html]   (CHROMIUM_PATH as in e2e.mjs; ?net=local: two tabs)
import { chromium } from 'playwright-core';
import fs from 'node:fs';
import path from 'node:path';

const file = path.resolve(process.argv[2] ?? 'dist/index.html');
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const results = [];
const check = (id, ok, detail = '') => { results.push({ id, ok }); console.log(`${ok ? 'PASS' : 'FAIL'}  ${id}${detail ? '  — ' + detail : ''}`); };
const ctx = await browser.newContext({ viewport: { width: 900, height: 560 } });
await ctx.addInitScript(() => localStorage.setItem('gametool.character', JSON.stringify({ name: 'Rowan', motivation: '', secret: '', created: true })));
const errors = [];
const open = async (query = '') => {
  const page = await ctx.newPage();
  page.on('pageerror', (e) => errors.push(e.message));
  await page.route(/^https?:/, (r) => r.abort());
  await page.goto('file://' + file + '?net=local' + query, { timeout: 180000 });
  await page.bringToFront();
  await page.waitForFunction(() => window.__gametool, null, { timeout: 180000 });
  await page.evaluate(() => document.querySelector('#begin').click());
  await page.waitForFunction(() => window.__gametool.state === 'play', null, { timeout: 180000 });
  await page.evaluate(() => window.__gametool.endWake?.());
  return page;
};
const G = (page, fn, a) => page.evaluate(fn, a);
fs.mkdirSync('test/screenshots', { recursive: true });
const toStop = (p) => G(p, () => { const g = window.__gametool, s = g.wagonStop(g.regions.current); g.player.pos.copy(s.at); g.player.yaw = g.player.bodyYaw = s.yaw; g.player.pitch = -0.1; });
const settled = (p, region) => p.waitForFunction((region) => window.__gametool.regions.current === region && !window.__gametool.travelling && window.__gametool.state === 'play', region, { timeout: 20000, polling: 200 }).catch(() => {});

const a = await open();
await a.waitForTimeout(1200);
await toStop(a);
await a.waitForFunction(() => window.__gametool.lookingAtVerb === 'Ride the wagon', null, { timeout: 8000, polling: 200 }).catch(() => {});
const v0 = await G(a, () => ({ verb: window.__gametool.lookingAtVerb, inScene: !!window.__gametool.TOWN_WAGON.group.parent }));
check('A wagon waits at its stop by the coach road', v0.verb === 'Ride the wagon' && v0.inScene, JSON.stringify(v0));
await a.screenshot({ path: 'test/screenshots/wagon-town.png' });
await a.keyboard.press('KeyE');
await a.waitForFunction(() => window.__gametool.state === 'dialogue', null, { timeout: 5000 }).catch(() => {});
await G(a, () => { const d = window.__gametool.dialogue; for (let i = 0; i < 4 && d.typing; i++) d.advance(); });
const menu = await G(a, () => [...document.querySelectorAll('#dialogue .d-choice')].map((b) => b.textContent.trim()));
check('The wagoner offers the far maps', ['Aralon Edge', 'The Beach', 'The Ranlean Gates', 'The Amethyst Peak Gates'].every((n) => menu.some((m) => m.includes(n))) && !menu.some((m) => m.includes('Aralon') && !m.includes('Edge')), JSON.stringify(menu));
await G(a, () => { const d = window.__gametool.dialogue, i = [...document.querySelectorAll('#dialogue .d-choice')].findIndex((b) => /The Beach/.test(b.textContent)); d.choose(i); for (let k = 0; k < 6 && d.open; k++) d.advance(); });
await a.waitForFunction(() => window.__gametool.loadScreen.active, null, { timeout: 5000 }).catch(() => {});
const ls = await G(a, () => document.querySelector('#loadScreen .ls-line')?.textContent ?? '');
await settled(a, 'beach');
const s1 = await G(a, () => { const g = window.__gametool, s = g.wagonStop('beach'); return { region: g.regions.current, d: +g.player.pos.distanceTo(s.at).toFixed(2), wagon: !!g.regions.groups.get('beach').getObjectByName('wagon') }; });
check('Riding to the beach: a load screen, then you step off by the beach wagon', /By wagon from Aralon/.test(ls) && s1.region === 'beach' && s1.d < 0.6 && s1.wagon, JSON.stringify({ ls, ...s1 }));
await toStop(a);
await a.waitForFunction(() => window.__gametool.lookingAtVerb === 'Ride the wagon', null, { timeout: 8000, polling: 200 }).catch(() => {});
await a.screenshot({ path: 'test/screenshots/wagon-beach.png' });
await G(a, () => { const g = window.__gametool; g.openWagon(); });
await a.waitForFunction(() => window.__gametool.state === 'dialogue', null, { timeout: 5000 }).catch(() => {});
await G(a, () => { const d = window.__gametool.dialogue; for (let i = 0; i < 4 && d.typing; i++) d.advance(); const i = [...document.querySelectorAll('#dialogue .d-choice')].findIndex((b) => /^\d*Aralon$/.test(b.textContent.trim())); d.choose(i); for (let k = 0; k < 6 && d.open; k++) d.advance(); });
await settled(a, 'town');
const s2 = await G(a, () => { const g = window.__gametool, s = g.wagonStop('town'); return { region: g.regions.current, d: +g.player.pos.distanceTo(s.at).toFixed(2) }; });
check('…and back to Aralon, by the town wagon', s2.region === 'town' && s2.d < 0.6, JSON.stringify(s2));

// A room of two: Ben at the stop rides along when Ana sets off.
await G(a, () => window.__gametool.openFriends());
await a.fill('#netName', 'Ana');
await a.click('#friendsPanel [data-net="host"]');
await a.waitForFunction(() => !!window.__gametool.friends.room, null, { timeout: 15000 });
const code = await G(a, () => window.__gametool.friends.room.code);
await G(a, () => window.__gametool.friends.close?.());
const b = await open('&room=' + code.toLowerCase());
await b.waitForFunction(() => window.__gametool.friends.isOpen, null, { timeout: 10000 }).catch(() => {});
await b.fill('#netName', 'Ben');
await b.click('#friendsPanel [data-net="join"]');
await b.waitForFunction(() => window.__gametool.friends.room?.status === 'open', null, { timeout: 15000 }).catch(() => {});
await G(b, () => window.__gametool.friends.close?.());
await b.waitForFunction(() => window.__gametool.state === 'play', null, { timeout: 8000 }).catch(() => {});
await b.waitForTimeout(800);
await toStop(b);
await a.bringToFront();
await a.waitForFunction(() => window.__gametool.friends.room?.count === 2, null, { timeout: 15000 }).catch(() => {});
await G(a, () => window.__gametool.rideWagon('edge'));
await settled(a, 'edge');
await b.bringToFront();
await settled(b, 'edge');
const s3 = await G(b, () => { const g = window.__gametool, s = g.wagonStop('edge'); return { region: g.regions.current, d: +g.player.pos.distanceTo(s.at).toFixed(2), toast: document.querySelector('#toast').textContent }; });
check('In a room, a friend at the stop rides along', s3.region === 'edge' && s3.d < 0.6, JSON.stringify(s3));
// A friend away from the stop stays put.
await G(b, () => { const g = window.__gametool, s = g.wagonStop('edge'); g.player.pos.set(s.at.x + 14, s.at.y, s.at.z); });
await a.bringToFront();
await toStop(a);
await G(a, () => window.__gametool.rideWagon('town'));
await settled(a, 'town');
await b.bringToFront(); await b.waitForTimeout(2500);
const s4 = await G(b, () => window.__gametool.regions.current);
check('A friend away from the stop stays where they are', s4 === 'edge', s4);
check('No page errors', errors.length === 0, errors.slice(0, 3).join(' | '));
await browser.close();
const passed = results.filter((r) => r.ok).length;
console.log(`${passed}/${results.length} checks passed`);
process.exit(passed === results.length ? 0 : 1);
