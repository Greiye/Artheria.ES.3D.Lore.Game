// Mike 2026-11-05: four exits, one per side, each to its own map after a load screen: north to Aralon Edge (over the
// town), south to the beach, east to the Ranlean gates, west (past the coach-road gate) to the Amethyst Peak gates.
// Usage: node test/e2e-exits.mjs [path/to/index.html]   (CHROMIUM_PATH as in e2e.mjs)
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
const check = (name, ok, detail = '') => { results.push({ name, ok }); console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? '  — ' + detail : ''}`); };
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
await page.route(/^https?:/, (r) => r.abort());
await page.goto('file://' + file);
await page.waitForFunction(() => window.__gametool, null, { timeout: 90000 });
await page.waitForTimeout(400);
await page.click('#begin');
await page.waitForFunction(() => window.__gametool.state === 'play', null, { timeout: 90000 });
const G = (fn, a) => page.evaluate(fn, a);
const frames = (n = 6) => G((n) => new Promise((done) => { let k = 0; const t = () => (++k >= n ? done() : requestAnimationFrame(t)); t(); }), n);

const toast = () => G(() => document.getElementById('toast')?.textContent ?? '');
const where = () => G(() => { const g = window.__gametool; return { region: g.regions.current, pos: g.player.pos.toArray().map((v) => +v.toFixed(1)), loading: g.travelling }; });

const signs = await G(() => ['north', 'south', 'east'].map((s) => !!window.__gametool.world.scene.getObjectByName('exit-sign-' + s)));
check('Signposts mark the north, south and east ways out', signs.every(Boolean), JSON.stringify(signs));

// North: walk out the top of town.
await G(() => { const g = window.__gametool; g.player.thirdPerson = true; g.player.spawn(new g.Vector3(0, 0, -45.6), 0); });
await frames(2);
await page.keyboard.down('KeyW');
await page.waitForFunction(() => window.__gametool.travelling || window.__gametool.regions.current !== 'town', null, { timeout: 20000 }).catch(() => {});
await page.keyboard.up('KeyW');
const ls = await G(() => ({ on: !document.getElementById('loadScreen').classList.contains('hidden'), name: document.querySelector('#loadScreen .ls-name').textContent, line: document.querySelector('#loadScreen .ls-line').textContent }));
await page.screenshot({ path: path.join(shots, 'exits-load-screen.png') });
check('Walking out the north side brings up a load screen: Aralon Edge', ls.on && ls.name === 'Aralon Edge' && ls.line.length > 10, JSON.stringify(ls));
await page.waitForFunction(() => !window.__gametool.travelling, null, { timeout: 20000 });
const edge = await where();
check('…and you arrive up on the clifftop', edge.region === 'edge' && Math.abs(edge.pos[1] - 28) < 0.6, JSON.stringify(edge));
await G(() => { const g = window.__gametool; g.player.spawn(new g.Vector3(0, 28, -96), Math.PI); g.player.thirdPerson = false; g.player.pitch = -0.25; });
await frames(10);
await page.screenshot({ path: path.join(shots, 'exits-aralon-edge.png') });
// Back by the waystone.
await G(() => { const g = window.__gametool; g.interactables.find((i) => (!i.when || i.when()) && i.verb() === 'Head back to Aralon').act(); });
await page.waitForFunction(() => !window.__gametool.travelling && window.__gametool.regions.current === 'town', null, { timeout: 20000 }).catch(() => {});
const home = await where();
check('The waystone takes you back, in at the north edge of town', home.region === 'town' && home.pos[2] < -40 && Math.abs(home.pos[0]) < 3, JSON.stringify(home));

// South: the beach.
await G(() => { const g = window.__gametool; g.player.spawn(new g.Vector3(-6, 0, 46.6), Math.PI); });
await page.waitForFunction(() => window.__gametool.regions.current === 'beach' && !window.__gametool.travelling, null, { timeout: 20000 }).catch(() => {});
const beach = await where();
check('South: the beach', beach.region === 'beach' && beach.pos[2] > 600, JSON.stringify(beach));
await G(() => { const g = window.__gametool; g.player.thirdPerson = true; g.player.yaw = g.player.bodyYaw = Math.PI; g.player.pitch = -0.1; });
await frames(10);
await page.screenshot({ path: path.join(shots, 'exits-beach.png') });
await G(() => window.__gametool.travel('town'));
await page.waitForFunction(() => window.__gametool.regions.current === 'town' && !window.__gametool.travelling, null, { timeout: 20000 });

// East: the Ranlean gates, shut.
await G(() => { const g = window.__gametool; g.player.spawn(new g.Vector3(46.6, 0, 25), -Math.PI / 2); });
await page.waitForFunction(() => window.__gametool.regions.current === 'ranlean' && !window.__gametool.travelling, null, { timeout: 20000 }).catch(() => {});
check('East: the Ranlean gates', (await where()).region === 'ranlean');
await G(() => { const g = window.__gametool; g.interactables.find((i) => i.when?.() && i.verb() === 'Knock at the gate').act(); });
await frames(2);
const knock = await toast();
check('…shut: knocking gets nothing', /shut/i.test(knock), knock);
await G(() => { const g = window.__gametool, o = g.regions.region.origin; g.player.spawn(new g.Vector3(o.x - 8, 0, o.z), -Math.PI / 2); g.player.thirdPerson = true; g.player.pitch = -0.05; });
await frames(10);
await page.screenshot({ path: path.join(shots, 'exits-ranlean.png') });
await G(() => window.__gametool.travel('town'));
await page.waitForFunction(() => window.__gametool.regions.current === 'town' && !window.__gametool.travelling, null, { timeout: 20000 });
const backE = await where();
check('…and home again at the east edge', backE.pos[0] > 40 && Math.abs(backE.pos[2] - 25) < 3, JSON.stringify(backE));

// West: the coach-road gate asks; walk on to the Amethyst Peak gates.
await G(() => { const g = window.__gametool; g.player.spawn(new g.Vector3(-41.4, 0, -4), Math.PI / 2); });
await page.waitForFunction(() => window.__gametool.gateOpen, null, { timeout: 10000 }).catch(() => {});
await page.click('#gateGo');
await page.waitForFunction(() => window.__gametool.regions.current === 'amethyst' && !window.__gametool.travelling, null, { timeout: 20000 }).catch(() => {});
check('West: past the coach-road gate, the Amethyst Peak gates', (await where()).region === 'amethyst');
await G(() => { const g = window.__gametool, o = g.regions.region.origin; g.player.spawn(new g.Vector3(o.x + 6, 0, o.z), Math.PI / 2); g.player.thirdPerson = true; g.player.pitch = -0.05; });
await frames(10);
await page.screenshot({ path: path.join(shots, 'exits-amethyst.png') });

// The save remembers the map.
await G(() => window.__gametool.quitToMenu?.());
await page.reload();
await page.waitForFunction(() => window.__gametool, null, { timeout: 90000 });
await page.waitForTimeout(400);
await page.click('#begin');
await page.waitForFunction(() => window.__gametool.state === 'play', null, { timeout: 90000 });
await frames(2);
const again = await where();
check('Reloading and continuing puts you back on the Amethyst Peak map', again.region === 'amethyst' && again.pos[0] < -600, JSON.stringify(again));
check('No page errors', errors.length === 0, errors.slice(0, 3).join(' | '));

await browser.close();
const failed = results.filter((r) => !r.ok).length;
console.log(`\n${results.length - failed}/${results.length} passed`);
process.exit(failed ? 1 : 0);
