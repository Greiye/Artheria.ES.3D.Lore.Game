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
const open = async (query = '') => {
  const page = await ctx.newPage();
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  await page.route(/^https?:/, (r) => r.abort());
  await page.goto('file://' + file + '?net=local' + query, { timeout: 180000 });
  await page.waitForFunction(() => window.__gametool, null, { timeout: 180000 });
  await page.waitForTimeout(300);
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
// A bad code is refused before any network.
await G(b, () => window.__gametool.friends.leave());
await G(b, () => window.__gametool.friends.open());
await b.fill('#netCode', 'OOPS'); await b.click('#friendsPanel [data-net="join"]');
check('A bad code is refused with a hint', await G(b, () => !window.__gametool.friends.room && /5 letters/.test(document.querySelector('.net-error')?.textContent ?? '')));
await a.waitForFunction(() => window.__gametool.friends.room?.count === 1, null, { timeout: 8000 }).catch(() => {});
check('Leaving removes you from the room', await G(a, () => window.__gametool.friends.room.count === 1));

// Full room: four fit, the fifth is turned away.
const extra = [];
for (const n of ['C', 'D', 'E', 'F']) {   // (Ben left above: Ana + C, D, E make four; F is the fifth)
  const p = await open();
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
