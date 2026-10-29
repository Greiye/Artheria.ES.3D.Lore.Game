// v0.04 feedback checks, part 5 (world): hills, distant mountains, the town (nine buildings scattered round a green) and the
// shopkeeper (buy / sell for crowns, earned by finds and writing).
// Usage: npm run build && node test/e2e-town.mjs [path/to/index.html]
import { chromium } from 'playwright-core';
import path from 'node:path';

const file = path.resolve(process.argv[2] ?? 'dist/index.html');
const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH || undefined,
  args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'],
});
const results = [];
const check = (id, ok, detail = '') => { results.push({ id, ok }); console.log(`${ok ? 'PASS' : 'FAIL'}  ${id}${detail ? '  — ' + detail : ''}`); };
const G = (page, fn, arg) => page.evaluate(fn, arg);
const until = (page, fn, arg, timeout = 15000) => page.waitForFunction(fn, arg, { timeout, polling: 100 }).then(() => true, () => false);

const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
await ctx.addInitScript(() => localStorage.setItem('gametool.character', JSON.stringify({ name: 'Test', motivation: '', secret: '', created: true })));
const page = await ctx.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
await page.goto('file://' + file);
await page.waitForFunction(() => window.__gametool);
await page.click('#begin');
await page.waitForFunction(() => window.__gametool.state === 'play');
await page.mouse.move(5, 5);

// ---------- hills + mountains ----------
const land = await G(page, () => { const w = window.__gametool.world; return { mid: w.heightAt(0, 0), town: w.heightAt(6, 30), edge: w.heightAt(48, 5), out: w.heightAt(70, 0) }; });
check('v0.04 hills: the middle is flat, the land rolls up toward the edge and beyond', land.mid === 0 && land.town === 0 && land.edge > 1 && land.out > land.edge, JSON.stringify(land));
await G(page, () => { const p = window.__gametool.player; p.pos.set(44, 0, 5); p.yaw = -Math.PI / 2; p.bodyYaw = p.yaw; });
await page.keyboard.down('KeyW');
const climbed = await until(page, () => { const g = window.__gametool, p = g.player.pos; return p.x > 46.5 && p.y > 0.8 && Math.abs(p.y - g.world.heightAt(p.x, p.z)) < 0.3; });
await page.keyboard.up('KeyW');
check('v0.04 hills: walking up a hillside, the feet follow the ground', climbed, JSON.stringify(await G(page, () => { const p = window.__gametool.player.pos; return { x: +p.x.toFixed(2), y: +p.y.toFixed(2) }; })));
const mtn = await G(page, () => { const m = window.__gametool.world.scene.getObjectByName('mountains'); if (!m) return null; m.geometry.computeBoundingSphere(); return { fog: m.material.fog, r: m.geometry.boundingSphere.radius }; });
check('v0.04 distant mountains ring the horizon, drawn past the fog', !!mtn && mtn.fog === false && mtn.r > 100, JSON.stringify(mtn));

// ---------- town ----------
const face = (id) => G(page, (id) => {
  const g = window.__gametool, d = g.world.town.doors[id].position, ry = g.world.town.doors[id].rotation.y, p = g.player;
  const fx = Math.sin(ry), fz = Math.cos(ry);   // out of the door, toward the street
  p.pos.set(d.x + fx * 1.6, 0, d.z + fz * 1.6);
  p.yaw = Math.atan2(-(d.x - p.pos.x), -(d.z - p.pos.z)); p.bodyYaw = p.yaw; p.pitch = -0.15;
}, id);
const doors = { library: 'Enter the Library', smithy: 'Enter the Smithy', tailor: 'Enter the Tailor', scriptorium: 'Enter the Scriptorium', cartographer: 'Enter the Cartographer', dojo: 'Enter the Dojo', gallery: 'Enter the Gallery', shop: 'Enter the General Store', inn: 'Rent a bed' };
const verbs = [];
for (const [id, v] of Object.entries(doors)) {
  await face(id);
  await until(page, (v) => (window.__gametool.lookingAtVerb ?? '').startsWith(v), v, 6000);
  verbs.push(await G(page, () => window.__gametool.lookingAtVerb));
}
check('v0.04 town: nine buildings, each door names its tool', Object.values(doors).every((v, i) => (verbs[i] ?? '').startsWith(v)), verbs.join(' | '));
const lay = await G(page, () => { const d = window.__gametool.world.town.doors; return Object.values(d).map((o) => ({ x: o.position.x, z: o.position.z, ry: o.rotation.y })); });
const yaws = new Set(lay.map((l) => Math.round(((l.ry % (Math.PI / 2)) + Math.PI / 2) % (Math.PI / 2) * 20)));
const apart = lay.every((a, i) => lay.every((b, j) => i === j || Math.hypot(a.x - b.x, a.z - b.z) > 5));
check('v0.04 town (Mike: scatter them): doors face the green at varied angles, none square to each other, all well apart', yaws.size >= 7 && apart, JSON.stringify(lay.map((l) => +(l.ry * 57.3).toFixed(0))));
await face('cartographer');
await until(page, () => window.__gametool.lookingAtVerb === 'Enter the Cartographer', null, 6000);
await page.keyboard.press('KeyE');
const mapOpen = await until(page, () => window.__gametool.livingMap.isOpen, null, 6000);
await page.keyboard.press('Escape');
await until(page, () => window.__gametool.state === 'play');
await face('tailor');
await until(page, () => window.__gametool.lookingAtVerb === 'Enter the Tailor', null, 6000);
await page.keyboard.press('KeyE');
const tailor = await until(page, () => window.__gametool.characterForge.isOpen, null, 6000);
await page.keyboard.press('Escape');
await until(page, () => window.__gametool.state === 'play');
await face('library');
await until(page, () => window.__gametool.lookingAtVerb === 'Enter the Library', null, 6000);
await page.keyboard.press('KeyE');
const lib = await until(page, () => window.__gametool.state === 'book', null, 8000);
await page.keyboard.press('Escape');
await until(page, () => window.__gametool.state === 'play', null, 8000);
await face('dojo');
await until(page, () => window.__gametool.lookingAtVerb === 'Enter the Dojo', null, 6000);
await page.keyboard.press('KeyE');
const dojo = await until(page, () => window.__gametool.dojo.isOpen, null, 6000);
await page.keyboard.press('Escape');
await until(page, () => window.__gametool.state === 'play', null, 8000);
await face('gallery');
await until(page, () => window.__gametool.lookingAtVerb === 'Enter the Gallery', null, 6000);
await page.keyboard.press('KeyE');
const gal = await until(page, () => window.__gametool.player.pos.x > 7 && window.__gametool.player.pos.x < 10 && window.__gametool.player.pos.z < 10, null, 6000);
check('v0.04 town: the Cartographer opens the living map, the Tailor the mirror, the Library the book, the Dojo its drills, the Gallery leads to the hall', mapOpen && tailor && lib && dojo && gal, JSON.stringify({ mapOpen, tailor, lib, dojo, gal }));

// ---------- shop ----------
await G(page, () => { const g = window.__gametool, h = g.world.town.shopkeeperHit, k = h.position, ry = h.rotation.y, p = g.player; p.pos.set(k.x + Math.sin(ry) * 1.4, 0, k.z + Math.cos(ry) * 1.4); p.yaw = ry; p.bodyYaw = ry; p.pitch = -0.1; });
const talk = await until(page, () => window.__gametool.lookingAtVerb === 'Trade with the Shopkeeper', null, 8000);
await page.keyboard.press('KeyE');
const shopOpen = await until(page, () => window.__gametool.shop.isOpen && window.__gametool.state === 'forge', null, 6000);
check('v0.04 shopkeeper: E at the counter opens the General Store', talk && shopOpen);
const broke = await G(page, () => window.__gametool.shop.buy(0));
await G(page, () => { const g = window.__gametool; g.inventory.give('trinket', 1); g.shop.render(); });
await page.click('[data-sell="trinket"]');
const afterSell = await G(page, () => ({ crowns: window.__gametool.inventory.count('crown'), trinket: window.__gametool.inventory.count('trinket') }));
await page.click('[data-buy="0"]');
const afterBuy = await G(page, () => ({ crowns: window.__gametool.inventory.count('crown'), bolts: window.__gametool.inventory.count('bolt') }));
// v0.06 E1: DEBUG_UNLIMITED_CROWNS is on, so buying is free (the purse shows ∞) while selling and earning still pay.
const purseText = await G(page, () => document.querySelector('#shop .shop-purse').textContent);
check('v0.04/v0.06 E1 shop: unlimited crowns (◎ ∞) buy without spending; sell a curio for 10, buy 5 bolts', broke && /∞/.test(purseText) && afterSell.crowns === 10 && afterSell.trinket === 0 && afterBuy.crowns === 10 && afterBuy.bolts >= 5, JSON.stringify({ broke, purseText, afterSell, afterBuy }));
await page.click('[data-act="close"]');
await until(page, () => window.__gametool.state === 'play');

// ---------- crowns from finds ----------
const c0 = await G(page, () => window.__gametool.inventory.count('crown'));
await G(page, () => { const p = window.__gametool.player; p.pos.set(24, 3.5, -24.55); });
const purse = await until(page, (c0) => window.__gametool.inventory.count('crown') === c0 + 5, c0, 6000);
await G(page, () => { const p = window.__gametool.player; p.pos.set(0, 0, 8.5); });
await page.waitForTimeout(300);
await G(page, () => { const p = window.__gametool.player; p.pos.set(24, 3.5, -24.55); });
await page.waitForTimeout(800);
const once = await G(page, (c0) => window.__gametool.inventory.count('crown') === c0 + 5, c0);
check('v0.04 crowns: the rock lookout holds a purse of 5, found once', purse && once);

check('v0.04 town: no console/page errors', errors.length === 0, errors.join(' | '));
await browser.close();
const failed = results.filter((r) => !r.ok).length;
console.log(`\n${results.length - failed}/${results.length} checks passed`);
process.exit(failed ? 1 : 0);
