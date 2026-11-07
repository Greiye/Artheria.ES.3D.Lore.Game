// B56 (Mike 2026-11-06): a portal by the Cartographer's to the modern world, a flat where Mike's friends Josh, Jason,
// Liv and Rev are. It waits for the first day like the side games; the room is one interior with the four friends to
// talk to; the portal on its wall brings you back beside the ring in town.
// Usage: node test/e2e-portal.mjs [path/to/index.html]   (CHROMIUM_PATH as in e2e.mjs)
import { chromium } from 'playwright-core';
import fs from 'node:fs';
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
const G = (fn, a) => page.evaluate(fn, a);
fs.mkdirSync('test/screenshots', { recursive: true });
const facePortal = () => G(() => {
  const g = window.__gametool, p = g.portal.group, ry = p.rotation.y;
  g.player.pos.set(p.position.x + Math.sin(ry) * 2, p.position.y, p.position.z + Math.cos(ry) * 2); g.player.yaw = g.player.bodyYaw = ry; g.player.pitch = 0;
});

await page.waitForTimeout(1500);
await facePortal();
await page.waitForFunction(() => window.__gametool.lookingAtVerb, null, { timeout: 8000, polling: 200 }).catch(() => {});   // a busy machine draws few frames
const s0 = await G(() => { const g = window.__gametool; return { inScene: !!g.world.scene.getObjectByName('portal'), verb: g.lookingAtVerb, open: g.firstDay.sideGamesOpen }; });
check('The portal stands by the Cartographer\'s and waits for the first day', s0.inScene && (s0.open ? s0.verb === 'Step through the portal' : /after your first day/.test(s0.verb ?? '')), JSON.stringify(s0));
await page.screenshot({ path: 'test/screenshots/portal-town.png' });
await G(() => window.__gametool.firstDay.skip());
await page.waitForTimeout(300);
const v1 = await G(() => window.__gametool.lookingAtVerb);
check('After the first day it offers "Step through the portal"', v1 === 'Step through the portal', String(v1));
await page.keyboard.press('KeyE');
await page.waitForFunction(() => window.__gametool.regions.current === 'modern' && !window.__gametool.travelling, null, { timeout: 15000 }).catch(() => {});
const s1 = await G(() => {
  const g = window.__gametool, o = g.regions.region.origin;
  return { region: g.regions.current, local: [+(g.player.pos.x - o.x).toFixed(2), +(g.player.pos.z - o.z).toFixed(2)], y: +g.player.pos.y.toFixed(2),
    friends: g.modernFriends.map((f) => f.name), assembled: g.modernFriends.every((f) => f.root.userData.rig && f.root.userData.spec), puppets: g.modernFriends.every((f) => g.puppets.has('modern:' + f.id)),
    ceiling: +g.rig.ceiling(g.player.pos.x, g.player.pos.z).toFixed(2) };
});
check('E goes through to the modern flat, by the portal on its wall', s1.region === 'modern' && Math.abs(s1.local[0] + 4.6) < 0.3 && Math.abs(s1.local[1]) < 0.3 && s1.y === 0, JSON.stringify(s1));
check('Josh, Jason, Liv and Rev are there, as assembled people that animate', s1.friends.join() === 'Josh,Jason,Liv,Rev' && s1.assembled && s1.puppets, JSON.stringify(s1));
check('Indoors, the camera stays under the ceiling', s1.ceiling === 2.5, JSON.stringify(s1));
// Look round the room, then talk to each friend.
await G(() => { const g = window.__gametool, o = g.regions.region.origin; g.player.pos.set(o.x - 3.8, 0, o.z + 0.6); g.player.yaw = g.player.bodyYaw = -Math.PI / 2 - 0.2; });
await page.waitForTimeout(2500);
await page.screenshot({ path: 'test/screenshots/portal-modern-room.png' });
const talks = [];
for (const name of ['Josh', 'Jason', 'Liv', 'Rev']) {
  await G((name) => {
    const g = window.__gametool, f = g.modernFriends.find((x) => x.name === name), at = f.hit.getWorldPosition(new g.Vector3());
    const yaw = f.root.rotation.y, px = at.x + Math.sin(yaw) * 1.6, pz = at.z + Math.cos(yaw) * 1.6;
    g.player.pos.set(px, 0, pz); g.player.yaw = g.player.bodyYaw = Math.atan2(px - at.x, pz - at.z); g.player.pitch = -0.15;
  }, name);
  await page.waitForTimeout(400);
  const verb = await G(() => window.__gametool.lookingAtVerb);
  if (verb === `Talk to ${name}`) await page.keyboard.press('KeyE');
  await page.waitForTimeout(500);
  const t = await G(() => { const g = window.__gametool; return { state: g.state, text: document.querySelector('#dialogue')?.textContent?.slice(0, 80) ?? '' }; });
  talks.push({ name, verb, ...t });
  if (name === 'Josh') await page.screenshot({ path: 'test/screenshots/portal-talk-josh.png' });
  await G(() => { const d = window.__gametool.dialogue; for (let i = 0; i < 8 && d.open; i++) { if (d.typing) d.advance(); else if (d.node?.choices?.length) d.choose(d.node.choices.length - 1); else d.advance(); } });
  await page.waitForFunction(() => window.__gametool.state === 'play', null, { timeout: 5000 }).catch(() => {});
}
check('Each friend can be talked to by name', talks.every((t) => t.verb === `Talk to ${t.name}` && t.state === 'dialogue' && t.text.includes(t.name)), JSON.stringify(talks));
// Back through the portal on the wall.
await G(() => { const g = window.__gametool, o = g.regions.region.origin; g.player.pos.set(o.x - 4.3, 0, o.z); g.player.yaw = g.player.bodyYaw = Math.PI / 2; g.player.pitch = -0.1; });
await page.waitForTimeout(500);
const v2 = await G(() => window.__gametool.lookingAtVerb);
check('The portal on the wall offers the way back', v2 === 'Step back through the portal', String(v2));
await page.keyboard.press('KeyE');
await page.waitForFunction(() => window.__gametool.regions.current === 'town' && !window.__gametool.travelling, null, { timeout: 15000 }).catch(() => {});
const s2 = await G(() => { const g = window.__gametool, p = g.portal.at; return { region: g.regions.current, d: +Math.hypot(g.player.pos.x - p.x, g.player.pos.z - p.z).toFixed(2), saved: localStorage.getItem('gametool.region') }; });
check('Back in Aralon, in front of the ring', s2.region === 'town' && s2.d > 1 && s2.d < 2.2 && s2.saved === 'town', JSON.stringify(s2));
check('No page errors', errors.length === 0, errors.slice(0, 3).join(' | '));
await browser.close();
const passed = results.filter((r) => r.ok).length;
console.log(`${passed}/${results.length} checks passed`);
process.exit(passed === results.length ? 0 : 1);
