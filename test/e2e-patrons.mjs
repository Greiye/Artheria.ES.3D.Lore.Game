// Mike 2026-11-05 (F2): goblins carry off a fallen hero's gear and use it (beat the carrier to win it back), and
// Natalie's patrons send gifts as books reach her (kept from hero to hero).
// Usage: node test/e2e-patrons.mjs [path/to/index.html]   (CHROMIUM_PATH as in e2e.mjs)
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

await G(() => { const g = window.__gametool; g.inventory.give('sword', 1); g.hands.set('right', 'sword'); });

// A hero falls on floor 6 with a sword and a mace: goblins carry them off.
await G(() => { const g = window.__gametool; g.inventory.give('sword', 1); g.inventory.give('mace', 1); g.inventory.give('bread', 1); g.hands.set('right', 'sword'); });
await G(() => window.__gametool.startDescent());
await page.waitForFunction(() => window.__gametool.inDungeon && !window.__gametool.loadScreen.active && !window.__gametool.descendCine.active, null, { timeout: 20000 });
await G(() => { window.__gametool.descent.floor = 6; const R = Math.random; Math.random = () => 0.1; window.__gametool.heroFalls('Grub'); Math.random = R; });
await page.waitForFunction(() => !document.getElementById('lastWords').classList.contains('hidden'), null, { timeout: 8000 });
await page.click('#lastWords [data-act="skip"]');
await frames(3);
const lost = await G(() => window.__gametool.record.lostGear);
check("A fallen hero's arms are carried off on their floor (not their bread)", lost.length === 2 && lost.every((x) => x.floor === 6) && lost.some((x) => x.item === 'mace') && !lost.some((x) => x.item === 'bread'), JSON.stringify(lost));
await page.waitForFunction(() => window.__gametool.state === 'forge', null, { timeout: 8000 }).catch(() => {});
await G(() => window.__gametool.characterForge.close?.());
await page.waitForFunction(() => window.__gametool.state === 'play', null, { timeout: 8000 }).catch(() => {});

// The next hero, on floor 7: a goblin carries the mace and uses it.
await G(() => { window.__gametool.startDescent(7); });
await page.waitForFunction(() => window.__gametool.inDungeon && !window.__gametool.loadScreen.active && !window.__gametool.descendCine.active, null, { timeout: 20000 });
await frames(2);
const armed = await G(() => window.__gametool.goblins.alive.filter((f) => f.gear).map((f) => ({ gear: f.gear, name: f.v.display, dmg: f.gearDmg, block: f.st.block })));
const mace = armed.find((a) => a.gear === 'mace');
check('A goblin a floor away carries it, named for it, and hits harder with it', armed.length === 2 && !!mace && /'s [a-z ]*mace/.test(mace.name) && mace.dmg === 2, JSON.stringify(armed));
await G(() => { const g = window.__gametool; g.player.thirdPerson = true; const f = g.goblins.alive.find((x) => x.gear); g.player.spawn(f.root.position.clone().add(new g.Vector3(0, 0, 3)), 0); });
await frames(4);
await page.screenshot({ path: path.join(shots, 'patrons-armed-goblin.png') });
const won = await G(() => { const g = window.__gametool, f = g.goblins.alive.find((x) => x.gear === 'mace'); for (let i = 0; i < 30 && f.state !== 'dead'; i++) g.goblins.shoot(f, 99, new g.Vector3(0, 0, -1)); return { mace: g.inventory.count('mace'), lost: g.record.lostGear.map((x) => x.item), toast: document.getElementById('toast').textContent }; });
check('Beat it and the mace is yours; it leaves the lost list', won.mace === 1 && !won.lost.includes('mace') && won.lost.length === 1 && /back from the goblin/.test(won.toast), JSON.stringify(won));
await G(() => window.__gametool.exitDungeon());
await frames(2);

// The patrons' gifts.
const before = await G(() => ({ price: window.__gametool.smithShop.priceOf({ id: 'shield', n: 1, price: 28 }), gifts: window.__gametool.record.gifts.length }));
await G(() => { const g = window.__gametool; g.record.delivered = 12; g.patronGifts(false); });
const after = await G(() => ({ price: window.__gametool.smithShop.priceOf({ id: 'shield', n: 1, price: 28 }), gifts: window.__gametool.record.gifts }));
check("12 books in: every gift is sent, and the smith charges a quarter less", before.price === 28 && after.price === 21 && after.gifts.length === 4, JSON.stringify({ before, after }));
await G(() => window.__gametool.openDescend());
const panel = await G(() => ({ kits: document.querySelectorAll('#descend [data-act="kit"]').length, text: document.getElementById('descend').textContent }));
check("The trapdoor offers the patrons' kit, and lists the gifts", panel.kits === 4 && /Patrons' gifts/.test(panel.text), JSON.stringify(panel.kits));
await page.screenshot({ path: path.join(shots, 'patrons-kit.png') });
const bolts0 = await G(() => window.__gametool.inventory.count('bolt'));
await page.click('#descend [data-kit="bow"]');
await frames(2);
const kit = await G((b0) => ({ xb: window.__gametool.inventory.count('crossbow'), bolts: window.__gametool.inventory.count('bolt') - b0, again: document.querySelectorAll('#descend [data-act="kit"]').length }), bolts0);
check('Taking a kit: crossbow and 15 bolts, once per hero', kit.xb >= 1 && kit.bolts === 15 && kit.again === 0, JSON.stringify(kit));
await page.click('#descend [data-act="go"]');
await page.waitForFunction(() => window.__gametool.inDungeon && !window.__gametool.descendCine.active, null, { timeout: 20000 });
await frames(2);
check("The patrons' scroll: a choice before the first step", await G(() => window.__gametool.scrollPicker.isOpen && document.querySelectorAll('#scrolls [data-scroll]').length >= 2));
await page.click('#scrolls [data-scroll="none"]');
await G(() => window.__gametool.exitDungeon());
const crowns0 = await G(() => window.__gametool.inventory.count('crown'));
await G(() => { window.__gametool.startDescent(); });
await page.waitForFunction(() => window.__gametool.inDungeon && !window.__gametool.descendCine.active, null, { timeout: 20000 });
await G(() => { const g = window.__gametool; if (g.scrollPicker.isOpen) g.scrollPicker.close(); g.heroFalls('Grub'); });
await page.waitForFunction(() => !document.getElementById('lastWords').classList.contains('hidden'), null, { timeout: 8000 });
await page.click('#lastWords [data-act="skip"]');
await frames(3);
// Since crowns became real (PR #169) a new hero starts with 500, and the patrons' purse adds its 20 on top.
const crowns1 = await G(() => window.__gametool.inventory.count('crown'));
check('A new hero starts with 500 crowns plus the patrons\' purse (20)', crowns1 === 520, `${crowns0} before the fall, ${crowns1} after`);
check('No page errors', errors.length === 0, errors.slice(0, 3).join(' | '));

await browser.close();
const failed = results.filter((r) => !r.ok).length;
console.log(`\n${results.length - failed}/${results.length} passed`);
process.exit(failed ? 1 : 0);
