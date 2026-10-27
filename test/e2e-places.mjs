// Phase F checks: B15 seeded dungeon, B7 living map, B14 dojo (with its safety framing).
// Usage: npm run build && node test/e2e-places.mjs [path/to/index.html]
import { chromium } from 'playwright-core';
import path from 'node:path';

const file = path.resolve(process.argv[2] ?? 'dist/index.html');
const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH || undefined,
  args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--autoplay-policy=no-user-gesture-required'],
});
const results = [];
const check = (id, ok, detail = '') => { results.push({ id, ok }); console.log(`${ok ? 'PASS' : 'FAIL'}  ${id}${detail ? '  — ' + detail : ''}`); };
const G = (page, fn, arg) => page.evaluate(fn, arg);
const until = (page, fn, arg, timeout = 15000) => page.waitForFunction(fn, arg, { timeout, polling: 100 }).then(() => true, () => false);

const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
await ctx.addInitScript(() => {
  if (!localStorage.getItem('gametool.character')) localStorage.setItem('gametool.character', JSON.stringify({ name: 'Test', motivation: '', secret: '', created: true }));
  window.addEventListener('mousemove', (e) => e.stopImmediatePropagation(), true);
});
const page = await ctx.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
await page.goto('file://' + file);
await page.waitForFunction(() => window.__gametool);
await page.click('#begin');
await page.waitForFunction(() => window.__gametool.state === 'play');

const aimAt = (src, back = 1.8, side = [1, 0.4]) => G(page, ([src, back, side]) => {
  const g = window.__gametool, o = new Function('g', `return ${src}`)(g), p = g.player, c = o.position;
  const n = Math.hypot(side[0], side[1]);
  p.pos.set(c.x + side[0] / n * back, 0, c.z + side[1] / n * back);
  const d = new g.Vector3(c.x - p.pos.x, c.y - 1.7, c.z - p.pos.z);
  p.yaw = Math.atan2(-d.x, -d.z); p.pitch = Math.atan2(d.y, Math.hypot(d.x, d.z));
}, [src, back, side]);
const verbIs = (w) => until(page, (want) => document.getElementById('promptVerb').textContent === want && !document.getElementById('prompt').classList.contains('hidden'), w);
const resume = async () => { if (await G(page, () => window.__gametool.state === 'resume')) await page.click('#relockBtn'); await until(page, () => window.__gametool.state === 'play'); };
const act = (kind) => G(page, (kind) => { const g = window.__gametool, s = g.dungeon.spots.find((x) => x.kind === kind); const it = s && g.interactables.find((i) => i.obj === s.hit); if (!it) return null; const v = it.verb(); it.act(); return v; }, kind);
const toastText = () => G(page, () => document.getElementById('toast').textContent);

// ---------- B15 dungeon ----------
const sig = (seed) => G(page, (seed) => { const L = window.__gametool.dungeon.build(seed); return L.theme + ':' + L.rooms.map((r) => `${r.cx},${r.cy},${r.tag}`).join('|') + ':' + Array.from(L.grid).reduce((a, v, i) => (a * 31 + v * (i + 1)) % 1e9, 7); }, seed);
const a1 = await sig(4242), a2 = await sig(4242), b1 = await sig(777);
check('B15 the same seed always builds the same dungeon; another seed differs', a1 === a2 && a1 !== b1);
const tags = await G(page, () => { const L = window.__gametool.dungeon.build(4242); return L.rooms.map((r) => r.tag); });
check('B15 a dungeon has an entrance, treasure, a nest and a shrine', ['entrance', 'treasure', 'nest', 'shrine'].every((t) => tags.includes(t)), tags.join(','));
await aimAt('g.interactables.find((i) => i.verb() === "Open the trapdoor").obj', 2, [0.3, 1]);
check('B15 the trapdoor by the library offers "Open the trapdoor"', await verbIs('Open the trapdoor'));
await page.keyboard.press('KeyE');
check('B15 E opens the descend sheet with today\'s seed', await until(page, () => window.__gametool.state === 'forge' && !!document.getElementById('descend') && /^\d{8}$/.test(document.getElementById('dgSeed').value)));
const nCol = await G(page, () => window.__gametool.world.colliders.length);
await page.fill('#dgSeed', 'goblin');
await page.click('#descend [data-act=go]');
await resume();
const inside = await G(page, () => { const g = window.__gametool; return { in: g.inDungeon, x: g.player.pos.x, seed: g.dungeon.layout.seed, vis: g.dungeon.group.visible, delve: !!g.delves[g.dungeon.layout.seed] }; });
check('B15 Descend takes you below (built at x≈400, out of the glade\'s view), and a word works as a seed', inside.in && inside.vis && inside.x > 330 && inside.delve, JSON.stringify(inside));
check('B15 the dungeon\'s walls collide', await G(page, (n) => window.__gametool.world.colliders.length > n + 20, nCol));
check('B15 the trapdoor is not offered below', await G(page, () => !window.__gametool.interactables.find((i) => i.verb() === 'Open the trapdoor').when()));
const t0 = await G(page, () => window.__gametool.inventory.count('trinket'));
check('B15 the chest gives a trinket once', await act('chest') === 'Open the chest' && await G(page, (t0) => window.__gametool.inventory.count('trinket') === t0 + 1, t0) && await act('chest') === 'An empty chest' && await G(page, (t0) => window.__gametool.inventory.count('trinket') === t0 + 1, t0));
await act('shrine');
check('B15 a shrine carving quotes the lore with its credit', /Carved in the stone: “.+” \(.+, by .+\)/.test(await toastText()), await toastText());
await act('nest');
check('B15 the goblin\'s nest is recorded for the seed', await G(page, () => { const g = window.__gametool; return !!g.delves[g.dungeon.layout.seed].nest; }));
check('B15 "Climb back up" returns you to the glade with its colliders restored', await act('stairs') === 'Climb back up'
  && await G(page, (n) => { const g = window.__gametool; return !g.inDungeon && !g.dungeon.group.visible && g.world.colliders.length === n && Math.abs(g.player.pos.x) < 60; }, nCol));
check('B15 delves are saved on this device', await G(page, () => Object.keys(JSON.parse(localStorage.getItem('gametool.delves'))).length >= 1));

// ---------- B7 living map ----------
await G(page, () => { const p = window.__gametool.player; p.pos.set(-30, 0, 30); });
check('B7 walking reveals the map around you', await until(page, () => window.__gametool.livingMap.isSeen(-30, 30) && !window.__gametool.livingMap.isSeen(40, 40), null, 5000));
await page.keyboard.press('KeyM');
check('B7 M opens the living map', await until(page, () => window.__gametool.state === 'forge' && window.__gametool.livingMap.isOpen));
await page.fill('#mpText', 'Mushrooms here');
await page.click('#mpPin');
check('B7 "Pin it here" pins a note at your spot, saved on this device', await G(page, () => { const s = JSON.parse(localStorage.getItem('gametool.map')); return s.pins.some((p) => p.text === 'Mushrooms here' && p.x === -30 && p.z === 30) && s.fog.length > 100; }));
await page.click('#mpSubmit');
const mp = await G(page, () => decodeURIComponent(document.querySelector('.submit-sheet [data-act=issue]').href));
check('B7 Submit exports the pins as a curated lore entry', mp.includes('Mushrooms here') && mp.includes('map-notes'));
await page.click('.submit-sheet [data-act=close]');
await page.click('#mpClose');
await resume();

// ---------- B14 dojo ----------
await aimAt('g.interactables.find((i) => i.verb() === "Train at the dojo").obj', 2.2, [-0.2, -1]);
check('B14 the dojo board offers "Train at the dojo"', await verbIs('Train at the dojo'));
await page.keyboard.press('KeyE');
check('B14 the dojo opens on the safety disclaimer first, with no drill shown', await until(page, () => window.__gametool.dojo.isOpen && !!document.getElementById('djAck'))
  && await G(page, () => /not medical or professional advice/.test(document.querySelector('.dj-disclaimer').textContent) && !document.querySelector('[data-drill]') && window.__gametool.dojo.pose === null));
await page.click('#djAck');
check('B14 after "I understand", your character demonstrates the drill in third person', await G(page, () => { const g = window.__gametool; return g.dojo.pose === 'stance' && g.player.thirdPerson && g.rig.inShot && Math.hypot(g.player.pos.x + 15, g.player.pos.z - 14) < 0.1; }));
await page.waitForTimeout(600);
check('B14 the pose bends the figure (horse stance knees)', await G(page, () => { const b = window.__gametool.puppets.get('player').root.userData.rig?.bones; return !b || Math.abs(b.shinN.rotation.x) > 0.6; }));
await G(page, () => window.__gametool.dojo.tick(0));
await page.click('#djStart');
await G(page, () => { for (let i = 0; i < 21; i++) window.__gametool.dojo.tick(1); });
check('B14 a hold drill counts seconds and is marked done at the target', await G(page, () => { const d = window.__gametool.dojo; return d.count === 20 && d.st.done.includes('stance') && /Horse stance ✓/i.test(document.querySelector('[data-drill=stance]').textContent); }));
await page.click('[data-drill=hang]');
check('B14 risky drills carry a "character only" badge and a safe real-life version', await G(page, () => !!document.querySelector('.dj-badge') && /seated knee tucks/.test(document.querySelector('.dj-steps').textContent) && window.__gametool.dojo.pose === 'hang'));
await page.waitForTimeout(500);
check('B14 the character hangs upside down from the bar', await G(page, () => { const r = window.__gametool.puppets.get('player').root.userData.rig?.bones.root; return !r || (r.rotation.z > 2 && r.position.y > 2); }));
for (let i = 0; i < 3; i++) await page.click('#djRep');
check('B14 rep drills count on the honour system', await G(page, () => window.__gametool.dojo.count === 3));
await page.click('.dojo-panel summary');
await page.fill('#djName', 'Wall sit');
await page.fill('#djHow', 'Your character sits against a castle wall for a whole minute.');
await page.click('#djTeach');
check('B14 "Teach a drill" needs a beginner-safe version before it submits', await G(page, () => !document.querySelector('.submit-sheet')));
await page.fill('#djSafe', 'Lean on a wall with your knees only slightly bent, 10 seconds.');
await page.click('#djTeach');
const dj = await G(page, () => decodeURIComponent(document.querySelector('.submit-sheet [data-act=issue]').href));
check('B14 a taught drill exports with both versions and the disclaimer', dj.includes('Wall sit') && dj.includes('Beginner-safe version') && dj.includes('not medical'));
await page.click('.submit-sheet [data-act=close]');
await page.keyboard.press('Escape');
check('B14 Esc leaves the mats and gives the body back', await until(page, () => !window.__gametool.dojo.isOpen && window.__gametool.dojo.pose === null && window.__gametool.state !== 'forge'));
await resume();
check('B14 drills done show on the living map', await G(page, () => { window.__gametool.openMap(); const ok = window.__gametool.livingMap.isOpen; window.__gametool.livingMap.close(); return ok; }) && await G(page, () => JSON.parse(localStorage.getItem('gametool.dojo')).done.includes('stance')));

check('Places: no console/page errors', errors.length === 0, errors.join(' | '));
await browser.close();
const failed = results.filter((r) => !r.ok).length;
console.log(`\n${results.length - failed}/${results.length} checks passed`);
process.exit(failed ? 1 : 0);
