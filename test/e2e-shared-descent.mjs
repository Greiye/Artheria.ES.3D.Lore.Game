// Round D2 + D3 (Mike 2026-11-06, "Round d. Defaults."): a room shares its descent. One seed per floor; on a shared
// floor the player with the lowest id leads and runs the goblins, the other follows their snapshots and sends back hits.
// Runs with ?net=local (two tabs over BroadcastChannel, no network). Only the front tab gets animation frames here, so
// the test brings each tab forward when its frames have to run.
// Usage: node test/e2e-shared-descent.mjs [path/to/index.html]   (CHROMIUM_PATH as in e2e.mjs)
import { chromium } from 'playwright-core';
import path from 'node:path';

const file = path.resolve(process.argv[2] ?? 'dist/index.html');
const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH || undefined,
  args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'],
});
const results = [];
const check = (id, ok, detail = '') => { results.push({ id, ok }); console.log(`${ok ? 'PASS' : 'FAIL'}  ${id}${detail ? '  — ' + detail : ''}`); };
const ctx = await browser.newContext({ viewport: { width: 900, height: 560 } });
const errors = [];
const open = async (query = '') => {
  const page = await ctx.newPage();
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  await page.route(/^https?:/, (r) => r.abort());
  await page.goto('file://' + file + '?net=local' + query, { timeout: 180000 });
  await page.bringToFront();
  await page.waitForFunction(() => window.__gametool, null, { timeout: 180000 });
  await page.evaluate(() => document.querySelector('#begin').click());
  await page.waitForFunction(() => window.__gametool.state === 'play', null, { timeout: 180000 });
  return page;
};
const G = (page, fn, a) => page.evaluate(fn, a);
const front = async (p, ms = 1500) => { await p.bringToFront(); await p.waitForTimeout(ms); };
const down = async (p) => {
  await p.bringToFront();
  await G(p, () => window.__gametool.startDescent());
  await p.waitForFunction(() => window.__gametool.inDungeon && !window.__gametool.descendCine.active, null, { timeout: 60000 });
};

// A room of two.
const a = await open();
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
await a.waitForFunction(() => window.__gametool.friends.room?.count === 2, null, { timeout: 15000 }).catch(() => {});
await G(b, () => window.__gametool.friends.close?.());
const ids = await Promise.all([a, b].map((p) => G(p, () => window.__gametool.friends.room?.self.id)));
check('A room of two', ids.every(Boolean) && ids[0] !== ids[1], JSON.stringify(ids));

// D2: Ana goes down first; her floor-1 seed reaches Ben, and his descent uses it.
await down(a);
const aRun = await G(a, () => ({ run: window.__gametool.partyRun, seed: window.__gametool.dungeon.layout?.seed }));
check('D2: going down in a room shares the floor and its seed', aRun.run?.floor === 1 && aRun.run?.seed === aRun.seed, JSON.stringify(aRun));
await b.waitForFunction((s) => window.__gametool.partyRun?.seed === s, aRun.seed, { timeout: 8000 }).catch(() => {});
check('D2: the friend up top hears about it', (await G(b, () => window.__gametool.partyRun?.floor)) === 1);
await down(b);
const bSeed = await G(b, () => window.__gametool.dungeon.layout?.seed);
check('D2: the friend\'s floor 1 is the same dungeon', bSeed === aRun.seed, `${bSeed} vs ${aRun.seed}`);

// D3: both on floor 1. Each tab needs the other's state (with its place) once: run each tab's frames in turn.
await front(a); await front(b);
const leads = await Promise.all([a, b].map((p) => G(p, () => window.__gametool.floorLeader())));
const lowest = [...ids].sort()[0];
check('D3: both agree who leads the floor (lowest id)', leads[0] === lowest && leads[1] === lowest, JSON.stringify({ leads, lowest }));
const [L, F] = lowest === ids[0] ? [a, b] : [b, a];
await front(F, 800);
check('D3: the other player\'s goblins follow (puppet)', await G(F, () => window.__gametool.goblins.puppet) && !(await G(L, () => window.__gametool.goblins.puppet)));

// Snapshots: the leader's frames send them; the follower takes them.
await G(L, () => { const g = window.__gametool.goblins.alive[0]; if (g) g.root.position.x += 1.5; });
await front(L);
const snap = await Promise.all([G(L, () => window.__gametool.goblins.list.map((f) => [f.root.position.x, f.root.position.z, f.state])),
  G(F, () => window.__gametool.goblins.list.map((f) => f.net ? [f.net.x, f.net.z, f.state] : null))]);
const near = snap[0].length > 0 && snap[0].length === snap[1].length && snap[0].every((l, i) => l[2] === 'dead' || (snap[1][i] && Math.hypot(l[0] - snap[1][i][0], l[1] - snap[1][i][1]) < 1.2));
check('D3: the follower\'s goblins are where the leader has them', near, JSON.stringify({ n: snap[0].length, lead: snap[0].slice(0, 2), follow: snap[1].slice(0, 2) }));

// Hit claims: a cut on the follower's screen reaches the leader's goblin.
const k = await G(L, () => window.__gametool.goblins.list.findIndex((f) => f.state !== 'dead' && f.hp > 2));
const before = await G(L, (i) => window.__gametool.goblins.list[i]?.hp, k);
await F.bringToFront();
await G(F, (i) => { const g = window.__gametool.goblins; g.wound(g.list[i], 1); }, k);
await L.waitForFunction(([i, h]) => window.__gametool.goblins.list[i]?.hp <= h - 1 + 1e-6, [k, before], { timeout: 6000, polling: 200 }).catch(() => {});
const after = await G(L, (i) => window.__gametool.goblins.list[i]?.hp, k);
check('D3: the follower\'s hit counts on the leader\'s goblin', k >= 0 && Math.abs(before - 1 - after) < 1e-6, JSON.stringify({ k, before, after }));

// D4: the leader's goblins go for whoever is nearest, and a blow on the friend lands on the friend's screen.
const fId = lowest === ids[0] ? ids[1] : ids[0];
await front(F, 800);   // fresh state from the friend first, then the leader's frames pick its goblins' targets
await L.bringToFront();
await L.waitForFunction(() => window.__gametool.goblins.friends.length === 1, null, { timeout: 6000 }).catch(() => {});
const targets = await G(L, () => window.__gametool.goblins.friends.map((f) => f.id));
check('D4: the leader\'s goblins can go for the friend too', targets.length === 1 && targets[0] === fId, JSON.stringify(targets));
const hp0 = await G(F, () => window.__gametool.delveHp);
await G(L, ([i, id]) => window.__gametool.friends.room.send('ouch', [i, 2], id), [k, fId]);
await F.waitForFunction((h) => window.__gametool.delveHp < h, hp0, { timeout: 6000, polling: 200 }).catch(() => {});
const hp1 = await G(F, () => window.__gametool.delveHp);
check('D4: a goblin\'s blow on the friend hurts them on their screen', hp1 < hp0, `${hp0} -> ${hp1}`);

// Hand-off: the leader climbs out; the follower's game runs its own goblins again.
await G(L, () => window.__gametool.exitDungeon());
await front(L);
await front(F);
await F.waitForFunction(() => !window.__gametool.goblins.puppet, null, { timeout: 8000 }).catch(() => {});
check('D3: when the leader leaves the floor, the other takes over', !(await G(F, () => window.__gametool.goblins.puppet)) && (await G(F, () => window.__gametool.floorLeader())) === null);

check('No page errors', errors.length === 0, errors.slice(0, 3).join(' | '));
await browser.close();
const failed = results.filter((r) => !r.ok).length;
console.log(`\n${results.length - failed}/${results.length} checks passed`);
process.exit(failed ? 1 : 0);
