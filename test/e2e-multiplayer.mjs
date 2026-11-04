// Multiplayer (Mike 2026-11-04, "Make this game multiplayer!" + "Do it"): friends-only rooms of up to 4, by code.
// Runs with ?net=local, where the rooms live inside one browser (tabs over BroadcastChannel), so no network is used.
// Usage: node test/e2e-multiplayer.mjs [path/to/index.html]   (CHROMIUM_PATH as in e2e.mjs)
import { chromium } from 'playwright-core';
import path from 'node:path';

const file = path.resolve(process.argv[2] ?? 'dist/index.html');
const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH || undefined,
  args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'],
});
const results = [];
const check = (id, ok, detail = '') => { results.push({ id, ok }); console.log(`${ok ? 'PASS' : 'FAIL'}  ${id}${detail ? '  — ' + detail : ''}`); };
const ctx = await browser.newContext({ viewport: { width: 1100, height: 680 } });
const errors = [];
// Extra players for the full-room check skip Begin and use a tiny window: on CI's software renderer six full game
// pages at once starve each other.
const open = async (query = '', { begin = true } = {}) => {
  const page = await ctx.newPage();
  if (!begin) await page.setViewportSize({ width: 160, height: 120 });
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  await page.route(/^https?:/, (r) => r.abort());
  await page.goto('file://' + file + '?net=local' + query, { timeout: 180000 });
  await page.waitForFunction(() => window.__gametool, null, { timeout: 180000 });
  await page.waitForTimeout(300);
  if (!begin) return page;
  await page.evaluate(() => document.querySelector('#begin').click());
  await page.waitForFunction(() => window.__gametool.state === 'play', null, { timeout: 180000 });
  return page;
};
const G = (page, fn, a) => page.evaluate(fn, a);

const a = await open();
// The Journal has the page; it opens the rooms panel.
await G(a, () => { document.querySelector('#pgFriends').click(); });
const panel = await G(a, () => ({ open: window.__gametool.friends.isOpen, state: window.__gametool.state, host: !!document.querySelector('#friendsPanel [data-net="host"]') }));
check('Journal: Play with friends opens the rooms panel', panel.open && panel.state === 'forge' && panel.host, JSON.stringify(panel));
await a.fill('#netName', 'Ana');
await a.click('#friendsPanel [data-net="host"]');
await a.waitForFunction(() => !!window.__gametool.friends.room, null, { timeout: 15000 });
const hosted = await G(a, () => { const r = window.__gametool.friends.room; return { code: r.code, host: r.isHost, name: r.self.name, shown: document.querySelector('.net-code')?.textContent }; });
check('Host a room: a 5-character code, shown big', /^[A-HJ-NP-Z2-9]{5}$/.test(hosted.code) && hosted.host && hosted.shown === hosted.code && hosted.name === 'Ana', JSON.stringify(hosted));
const link = await G(a, (c) => window.__gametool.friends.inviteLink(c), hosted.code);
check('Invite link carries the code', link.includes('room=' + hosted.code), link);

// A friend opens the invite link: the panel opens with the code filled in; Join.
const b = await open('&room=' + hosted.code.toLowerCase());
await b.waitForFunction(() => window.__gametool.friends.isOpen, null, { timeout: 10000 }).catch(() => {});
const pre = await G(b, () => document.querySelector('#netCode')?.value ?? null);
check('Invite link opens the panel with the code', (pre ?? '').toUpperCase() === hosted.code, String(pre));
await b.fill('#netName', 'Ben');
await b.click('#friendsPanel [data-net="join"]');
await b.waitForFunction(() => window.__gametool.friends.room?.status === 'open', null, { timeout: 15000 }).catch(() => {});
await a.waitForFunction(() => window.__gametool.friends.room?.count === 2, null, { timeout: 15000 }).catch(() => {});
const both = await Promise.all([a, b].map((p) => G(p, () => { const r = window.__gametool.friends.room; return r && { count: r.count, names: r.everyone.map((m) => m.name + (m.host ? '*' : '')), list: document.querySelectorAll('#friendsPanel .net-list li').length }; })));
check('Joined: both see each other (host marked)', both.every((x) => x && x.count === 2 && x.names.join() === 'Ana*,Ben'), JSON.stringify(both));
check('The panel lists both players', both[0]?.list === 2, JSON.stringify(both.map((x) => x?.list)));
// Renaming tells the room.
await b.fill('#netName', 'Benny'); await b.dispatchEvent('#netName', 'change');
await a.waitForFunction(() => [...window.__gametool.friends.room.members.values()].some((m) => m.name === 'Benny'), null, { timeout: 8000 }).catch(() => {});
check('A new name reaches the room', await G(a, () => [...window.__gametool.friends.room.members.values()].map((m) => m.name).join() === 'Benny'));
// Multiplayer 2: each sees the other as a figure with a name tag, placed where they are.
await a.waitForFunction(() => [...window.__gametool.remotes.values()].some((r) => r.root.visible), null, { timeout: 10000 }).catch(() => {});
const seen = await G(a, () => { const g = window.__gametool, r = [...g.remotes.values()][0]; if (!r) return null;
  let tris = 0; r.figure?.traverse((o) => { if (o.geometry?.index) tris += o.geometry.index.count / 3; });
  return { visible: r.root.visible, inScene: !!g.world.scene.getObjectByName(r.root.name), tag: !!r.root.getObjectByName('nameTag'), name: r.name, tris, puppet: g.puppets.has(r.root.name) }; });
check('Players: the host sees the friend as a figure with a name tag', !!seen && seen.visible && seen.inScene && seen.tag && seen.name === 'Benny' && seen.tris > 200 && seen.puppet, JSON.stringify(seen));
await b.click('#friendsPanel [data-net="close"]');
await b.waitForFunction(() => window.__gametool.state !== 'forge', null, { timeout: 10000 });
const to = await G(b, () => { const g = window.__gametool; g.player.pos.set(g.player.pos.x + 3, g.player.pos.y, g.player.pos.z - 2); g.player.syncNow(); return [g.player.body.position.x, g.player.body.position.z]; });
await a.waitForFunction((t) => { const r = [...window.__gametool.remotes.values()][0]; return r && Math.hypot(r.root.position.x - t[0], r.root.position.z - t[1]) < 0.15; }, to, { timeout: 10000 }).catch(() => {});
const at = await G(a, () => { const r = [...window.__gametool.remotes.values()][0]; return [r.root.position.x, r.root.position.z]; });
check('Players: moving on one screen moves them on the other', Math.hypot(at[0] - to[0], at[1] - to[1]) < 0.15, JSON.stringify({ to, at }));
const walk = await G(a, () => { const r = [...window.__gametool.remotes.values()][0]; const w = [r.root.position.x, r.root.position.y, r.root.position.z, 0, 1, 4.2, 1, -1, -1, 0, 0, 0, 0];
  r.apply(w); return { speed: r.input.speed, airborne: r.input.airborne, pose: r.input.pose }; });
check('Players: their state drives the walk / jump animation', walk.speed === 4.2 && walk.airborne && walk.pose === null, JSON.stringify(walk));
const bad = await G(a, () => { const r = [...window.__gametool.remotes.values()][0], before = r.root.position.x; r.apply([1e9, 0, 0]); r.apply('x'); r.apply([NaN, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]); return { ok: Number.isFinite(r.root.position.x) && Math.abs(r.root.position.x - before) < 50 }; });
check('Players: junk from a peer is ignored', bad.ok, JSON.stringify(bad));
// Multiplayer 3: preset phrases, held things, pets, one sky, and the host's Remove.
await G(b, () => window.__gametool.openFriends());
const says = await G(b, () => document.querySelectorAll('#friendsPanel [data-emote]').length);
await b.click('#friendsPanel [data-emote="1"]');   // "Hello!"
await a.waitForFunction(() => [...window.__gametool.remotes.values()][0]?.bubble.text === 'Hello!', null, { timeout: 8000 }).catch(() => {});
const bub = await G(a, () => [...window.__gametool.remotes.values()][0].bubble.text);
check('Say: a preset phrase shows over the friend\'s head', says >= 8 && bub === 'Hello!', JSON.stringify({ says, bub }));
check('Say: no free-text box in the room panel', await G(b, () => { window.__gametool.openFriends(); const n = document.querySelectorAll('#friendsPanel input[type=text]').length; window.__gametool.friends.close(); return n === 1; }));   // just your name
await G(b, () => window.__gametool.torch.set(true));
await a.waitForFunction(() => [...window.__gametool.remotes.values()][0]?.torch, null, { timeout: 8000 }).catch(() => {});
check('Held: a lit torch shows in the friend\'s hand', await G(a, () => { const r = [...window.__gametool.remotes.values()][0]; let vis = false; r.figure.traverse((o) => { if (o.parent?.isBone && o.visible && o.type === 'Group') vis = true; }); return r.torch && vis; }));
await G(b, () => window.__gametool.torch.set(false));
await G(b, () => { const g = window.__gametool; g.dog.befriend(); g.callPet(g.dog, true); g.dog.rename('Biscuit'); });
await a.waitForFunction(() => !!window.__gametool.world.scene.children.find((o) => o.name.startsWith('netpet:')), null, { timeout: 8000 }).catch(() => {});
check('Pets: the friend\'s pet comes along on your screen', await G(a, () => !!window.__gametool.world.scene.children.find((o) => o.name.startsWith('netpet:'))));
await G(b, () => window.__gametool.world.setTime('night'));
await a.waitForFunction(() => window.__gametool.world.time === 'night', null, { timeout: 8000 }).catch(() => {});
check('Sky: one time of day for the room (a friend slept)', await G(a, () => window.__gametool.world.time === 'night'));
await G(a, () => window.__gametool.world.setTime('day'));
await b.waitForFunction(() => window.__gametool.world.time === 'day', null, { timeout: 8000 }).catch(() => {});
await G(a, () => window.__gametool.openFriends());
const kickBtns = await G(a, () => document.querySelectorAll('#friendsPanel [data-kick]').length);
const bKick = await G(b, () => { window.__gametool.openFriends(); const n = document.querySelectorAll('#friendsPanel [data-kick]').length; window.__gametool.friends.close(); return n; });
await a.click('#friendsPanel [data-kick]');
await b.waitForFunction(() => !window.__gametool.friends.room, null, { timeout: 8000 }).catch(() => {});
await a.waitForFunction(() => window.__gametool.remotes.size === 0, null, { timeout: 8000 }).catch(() => {});
check('Remove: only the host can; the friend leaves the room', kickBtns === 1 && bKick === 0 && await G(b, () => !window.__gametool.friends.room) && await G(a, () => window.__gametool.remotes.size === 0 && !window.__gametool.world.scene.children.some((o) => o.name.startsWith('netpet:'))), JSON.stringify({ kickBtns, bKick }));
await G(a, () => window.__gametool.friends.close());
await G(b, (c) => window.__gametool.friends.start(c), hosted.code);   // back in, for the checks below
await a.waitForFunction(() => window.__gametool.friends.room?.count === 2, null, { timeout: 8000 }).catch(() => {});
// Multiplayer 4: phone polish. The room button, fewer crowd sprites per guest on Low, far players as a name tag.
const btn = await G(a, () => { const e = document.querySelector('#roomBtn'); return { shown: !!e && !e.classList.contains('hidden'), text: e?.textContent ?? '' }; });
check('Polish: a room button on the HUD shows the code and the count', btn.shown && btn.text.includes(hosted.code) && btn.text.includes('2/4'), JSON.stringify(btn));
const crowdN = await G(a, () => { const g = window.__gametool, was = g.settings.preset; g.settings.preset = 'low';
  const r = g.friends.room;
  g.applyQuality(); const before = g.crowd.count; g.settings.preset = was; g.applyQuality(); return { before, guests: r.members.size }; });
check('Polish: on Low, the crowd thins by 3 for a guest', crowdN.before === 13, JSON.stringify(crowdN));
const far = await G(a, () => { const g = window.__gametool, r = [...g.remotes.values()][0], p = g.camera.position;
  const w = [p.x + 80, 0, p.z, 0, 1, 0, 0, -1, -1, 0, 0, 0, 0]; r.apply(w); r.root.position.set(p.x + 80, 0, p.z); r.update(0.016, p);
  const res = { figure: r.figure.visible, root: r.root.visible, tag: r.root.getObjectByName('nameTag').visible, far: r.far };
  const n = [p.x + 2, 0, p.z, 0, 1, 0, 0, -1, -1, 0, 0, 0, 0]; r.apply(n); r.root.position.set(p.x + 2, 0, p.z); r.update(0.016, p);
  return { ...res, nearFigure: r.figure.visible }; });
check('Polish: a player far away is just their name tag', !far.figure && far.root && far.tag && far.far && far.nearFigure, JSON.stringify(far));
// A bad code is refused before any network.
await G(b, () => window.__gametool.friends.leave());
await G(b, () => window.__gametool.friends.open());
await b.fill('#netCode', 'OOPS'); await b.click('#friendsPanel [data-net="join"]');
check('A bad code is refused with a hint', await G(b, () => !window.__gametool.friends.room && /5 letters/.test(document.querySelector('.net-error')?.textContent ?? '')));
await a.waitForFunction(() => window.__gametool.friends.room?.count === 1, null, { timeout: 8000 }).catch(() => {});
check('Leaving removes you from the room (and their figure)', await G(a, () => window.__gametool.friends.room.count === 1 && window.__gametool.remotes.size === 0 && !window.__gametool.world.scene.children.some((o) => o.name.startsWith('net:'))));

// Full room: four fit, the fifth is turned away.
await b.close();   // Ben is done (and already out of the room)
const extra = [];
for (const n of ['C', 'D', 'E', 'F']) {   // (Ben left above: Ana + C, D, E make four; F is the fifth)
  const p = await open('', { begin: false });
  await G(p, ([code, name]) => { localStorage.setItem('gametool.net.name', name); return window.__gametool.friends.start(code); }, [hosted.code, n]);
  await p.waitForTimeout(600);
  extra.push(p);
}
await a.waitForFunction(() => window.__gametool.friends.room.count === 4, null, { timeout: 15000 }).catch(() => {});
await extra[3].waitForFunction(() => !window.__gametool.friends.room, null, { timeout: 15000 }).catch(() => {});
const full = await Promise.all(extra.map((p) => G(p, () => ({ inRoom: !!window.__gametool.friends.room, err: document.querySelector('.net-error')?.textContent ?? '' }))));
const hostCount = await G(a, () => window.__gametool.friends.room.count);
check('Room holds 4; the 5th is turned away', hostCount === 4 && full.slice(0, 3).every((f) => f.inRoom) && !full[3].inRoom, JSON.stringify({ hostCount, full }));
check('No page errors', errors.length === 0, errors.slice(0, 3).join(' | '));

await browser.close();
const passed = results.filter((r) => r.ok).length;
console.log(`\n${passed}/${results.length} checks passed`);
process.exit(passed === results.length ? 0 : 1);
