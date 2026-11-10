// Pets (Mike 2026-11-04, "Add pets. Have them be able to join the player." + "Go"): the farm dog by the inn, the cat
// by the store, the owl at the library and Shadow, the giant hedgehog by the campfire. Petting without food only gets a wag; feeding befriends a pet and it
// follows a step behind; the pets page names it and tells it to stay or come; one pet at a time; the owl is only out
// from dusk until befriended; all saved on the device. Runs on PC and on a phone held sideways.
// Usage: node test/e2e-pets.mjs [path/to/index.html]   (CHROMIUM_PATH as in e2e.mjs)
import { chromium, devices } from 'playwright-core';
import path from 'node:path';

const file = path.resolve(process.argv[2] ?? 'dist/index.html');
const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH || undefined,
  args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'],
});
const results = [];
const check = (id, ok, detail = '') => { results.push({ id, ok }); console.log(`${ok ? 'PASS' : 'FAIL'}  ${id}${detail ? '  — ' + detail : ''}`); };
const begin = async (page) => {
  await page.goto('file://' + file, { timeout: 180000 });
  await page.waitForFunction(() => window.__gametool, null, { timeout: 180000 });
  await page.waitForTimeout(400);
  await page.evaluate(() => document.querySelector('#begin').click());
  await page.waitForFunction(() => window.__gametool.state === 'play', null, { timeout: 180000 });
};
for (const [name, opts] of [['PC', { viewport: { width: 1280, height: 720 } }], ['phone', { ...devices['iPhone 13 landscape'] }]]) {
  const ctx = await browser.newContext(opts);
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  await page.route(/^https?:/, (r) => r.abort());
  await begin(page);
  const G = (fn, a) => page.evaluate(fn, a);
  const dogThing = () => window.__gametool.interactables.find((t) => t.obj === window.__gametool.dog.hit);
  const start = await G(() => { const g = window.__gametool, d = g.dog; let tris = 0; d.root.traverse((o) => { if (o.geometry) tris += (o.geometry.index ?? o.geometry.attributes.position).count / 3; });
    return { at: [+d.pos.x.toFixed(1), +d.pos.z.toFixed(1)], friend: d.friend, tris, inScene: !!g.world.scene.getObjectByName('pet:dog') }; });
  check(`${name}: the dog waits by the inn, a small low-poly model`, start.inScene && !start.friend && start.tris > 50 && start.tris < 400, JSON.stringify(start));
  const pet = await G((f) => { const g = window.__gametool, t = eval(f)(); const v = t.verb(); g.inventory.take('bread', g.inventory.count('bread')); t.act(); return { v, friend: g.dog.friend }; }, dogThing.toString());
  check(`${name}: without bread it only wags (it isn't yours yet)`, !pet.friend && pet.v === 'Pet the dog', JSON.stringify(pet));
  const fed = await G((f) => { const g = window.__gametool, t = eval(f)(); g.inventory.give('bread', 1); const v = t.verb(); t.act(); return { v, friend: g.dog.friend, following: g.dog.following, bread: g.inventory.count('bread') }; }, dogThing.toString());
  check(`${name}: bread befriends it and it joins you`, fed.v === 'Give the dog some bread' && fed.friend && fed.following && fed.bread === 0, JSON.stringify(fed));
  // Step the player 8 m out from the inn door (open ground); the dog should catch up and end near, behind them.
  await G(() => { const g = window.__gametool, ry = g.world.town.doors.inn.rotation.y; g.player.pos.set(g.dog.pos.x + Math.sin(ry) * 8, 0, g.dog.pos.z + Math.cos(ry) * 8); });
  await page.waitForFunction(() => { const g = window.__gametool; return Math.hypot(g.dog.pos.x - g.player.pos.x, g.dog.pos.z - g.player.pos.z) < 2.4; }, null, { timeout: 90000 }).catch(() => {});
  const near = await G(() => { const g = window.__gametool; return +Math.hypot(g.dog.pos.x - g.player.pos.x, g.dog.pos.z - g.player.pos.z).toFixed(2); });
  check(`${name}: it follows you`, near < 3, `${near} m`);   // it keeps ~1.6 m off your shoulder, and stops short
  await page.waitForFunction(() => window.__gametool.dog.sitting, null, { timeout: 30000 }).catch(() => {});
  const sits = await G(() => window.__gametool.dog.sitting);
  check(`${name}: it sits when you stand still`, sits);
  // The pets page: name it, and tell it to stay.
  const talk = await G((f) => { const g = window.__gametool, t = eval(f)(); const v = t.verb(); t.act(); return { v, open: g.petsPanel.isOpen, state: g.state }; }, dogThing.toString());
  check(`${name}: talking to it opens the pets page`, talk.v === 'Talk to the dog' && talk.open && talk.state === 'forge', JSON.stringify(talk));
  await page.fill('#petName', 'Biscuit');
  await page.click('#petsPanel [data-pet-act="stay"]');
  const stay = await G(() => { const g = window.__gametool; return { following: g.dog.following, at: [g.dog.pos.x, g.dog.pos.z], title: document.querySelector('#petsPanel h2').textContent }; });
  await page.click('#petsPanel [data-pet-act="close"]');
  await page.waitForFunction(() => window.__gametool.state === 'play' || window.__gametool.state === 'resume', null, { timeout: 15000 });
  if (await G(() => window.__gametool.state === 'resume')) await G(() => document.querySelector('#relockBtn')?.click());
  const named = await G(() => ({ name: window.__gametool.dog.name, verb: window.__gametool.interactables.find((t) => t.obj === window.__gametool.dog.hit).verb() }));
  check(`${name}: named on the pets page`, named.name === 'Biscuit' && named.verb === 'Talk to Biscuit' && stay.title === 'Biscuit', JSON.stringify({ ...named, title: stay.title }));
  await G(() => { const g = window.__gametool; g.player.pos.set(g.player.pos.x - 8, 0, g.player.pos.z); });
  await page.waitForTimeout(1500);
  const stayed = await G((a) => Math.hypot(window.__gametool.dog.pos.x - a[0], window.__gametool.dog.pos.z - a[1]), stay.at);
  check(`${name}: told to stay, it waits`, !stay.following && stayed < 0.2, JSON.stringify({ ...stay, moved: stayed }));
  // Saved: reload, and it is still your friend, waiting where you left it.
  await page.reload(); await begin(page);
  const after = await G(() => { const d = window.__gametool.dog; return { friend: d.friend, following: d.following, name: d.name, at: [d.pos.x, d.pos.z] }; });
  check(`${name}: saved on the device (friend, name, waiting where you left it)`, after.friend && !after.following && after.name === 'Biscuit' && Math.hypot(after.at[0] - stay.at[0], after.at[1] - stay.at[1]) < 0.1, JSON.stringify(after));
  await G((f) => eval(f)().act(), dogThing.toString());
  await page.click('#petsPanel [data-pet-act="come"]');
  const call = await G(() => window.__gametool.dog.following);
  await page.click('#petsPanel [data-pet-act="close"]');
  await page.waitForFunction(() => window.__gametool.state !== 'forge', null, { timeout: 15000 });
  if (await G(() => window.__gametool.state === 'resume')) await G(() => document.querySelector('#relockBtn')?.click());
  check(`${name}: call it from the pets page and it comes again`, call);
  // The cat: dried fish befriends it, and the dog goes to wait (one pet at a time); both listed on the pets page.
  const cat = await G(() => { const g = window.__gametool, c = g.pets.find((p) => p.id === 'cat'), t = g.interactables.find((i) => i.obj === c.hit);
    g.inventory.give('fish', 1); const v = t.verb(); t.act(); return { v, friend: c.friend, catWith: c.following, dogWith: g.dog.following, tris: (() => { let n = 0; c.root.traverse((o) => { if (o.geometry) n += (o.geometry.index ? o.geometry.index.count : o.geometry.attributes.position.count) / 3; }); return n; })() }; });
  check(`${name}: the cat takes dried fish and joins you; the dog waits (one at a time)`, cat.v === 'Give the cat some dried fish' && cat.friend && cat.catWith && !cat.dogWith && cat.tris > 50, JSON.stringify(cat));
  // Shadow (Mike: "a giant hedgehog the size of a dog named shadow"): already named, dog-sized, eats mealworms.
  const hog = await G(() => { const g = window.__gametool, h = g.pets.find((p) => p.id === 'hedgehog'), t = g.interactables.find((i) => i.obj === h.hit);
    const size = (o) => { const b = new g.Box3().setFromObject(o); return [b.max.x - b.min.x, b.max.y - b.min.y, b.max.z - b.min.z].map((v) => +v.toFixed(2)); };
    g.inventory.take('mealworms', g.inventory.count('mealworms')); const v0 = t.verb(); g.inventory.give('mealworms', 1); const v = t.verb(); t.act();
    return { name: h.name, v0, v, friend: h.friend, with: h.following, size: size(h.root), dog: size(g.dog.root) }; });
  const vol = (a) => a[0] * a[1] * a[2];
  check(`${name}: Shadow the giant hedgehog, dog-sized, takes mealworms and joins you`, hog.name === 'Shadow' && hog.v0 === 'Pet Shadow' && hog.v === 'Give Shadow some mealworms' && hog.friend && hog.with
    && vol(hog.size) > vol(hog.dog) * 0.6 && vol(hog.size) < vol(hog.dog) * 1.8, JSON.stringify(hog));
  // Mike's seven named dogs (Kona a chihuahua) and the giant hamster: each its own pet at its own spot, clear of walls.
  const pack = await G(() => { const g = window.__gametool, ids = ['princess', 'milo', 'hotdog', 'brandy', 'buster', 'peanut', 'kona', 'hamster'];
    const size = (o) => { const b = new g.Box3().setFromObject(o); return +((b.max.x - b.min.x) * (b.max.y - b.min.y) * (b.max.z - b.min.z)).toFixed(3); };
    const inWall = (p) => g.world.colliders.some((c) => c.kind === 'circle' ? Math.hypot(p.x - c.x, p.z - c.z) < c.r : c.kind === 'box' && p.x > c.minX && p.x < c.maxX && p.z > c.minZ && p.z < c.maxZ);
    const ps = ids.map((id) => g.pets.find((p) => p.id === id));
    const spots = ps.map((p) => [p.pos.x, p.pos.z]);
    const apart = spots.every((a, i) => spots.every((b, j) => i === j || Math.hypot(a[0] - b[0], a[1] - b[1]) > 2));
    return { names: ps.map((p) => p?.name), apart, walls: ps.filter((p) => inWall(p.pos)).map((p) => p.id), kona: size(ps[6].root), dog: size(g.dog.root), hamster: size(ps[7].root), konaKind: ps[6].sp.kind };
  });
  check(`${name}: seven named dogs and a giant hamster, each at its own spot`, pack.names.join() === 'Princess,Milo,Hot Dog,Brandy,Buster,Peanut,Kona,' && pack.apart && !pack.walls.length, JSON.stringify(pack));
  check(`${name}: Kona is a chihuahua (tiny), the hamster is dog-sized`, pack.konaKind === 'chihuahua' && pack.kona < pack.dog * 0.25 && pack.hamster > pack.dog * 0.6 && pack.hamster < pack.dog * 2, JSON.stringify(pack));
  const kona = await G(() => { const g = window.__gametool, k = g.pets.find((p) => p.id === 'kona'), t = g.interactables.find((i) => i.obj === k.hit);
    g.inventory.give('bread', 1); const v = t.verb(); t.act(); return { v, friend: k.friend, with: k.following }; });
  check(`${name}: Kona takes bread and joins you`, kona.v === 'Give Kona some bread' && kona.friend && kona.with, JSON.stringify(kona));
  // The owl: not out by day; at night it is, and jerky befriends it; it flies at shoulder height when you move.
  const owlDay = await G(() => { const g = window.__gametool, o = g.pets.find((p) => p.id === 'owl'); g.world.setTime('day'); return { shown: o.shown(), canTalk: g.interactables.find((i) => i.obj === o.hit).when() }; });
  await G(() => window.__gametool.world.setTime('night'));
  await page.waitForTimeout(300);
  const owl = await G(() => { const g = window.__gametool, o = g.pets.find((p) => p.id === 'owl'), t = g.interactables.find((i) => i.obj === o.hit);
    const v0 = t.verb(); g.inventory.give('jerky', 1); const v = t.verb(); const ok = t.when(); t.act(); return { v0, v, ok, friend: o.friend, with: o.following, visible: o.root.visible }; });
  check(`${name}: the owl is only out from dusk, and takes jerky`, !owlDay.shown && !owlDay.canTalk && owl.ok && owl.v0 === 'Hold out a hand to the owl' && owl.v === 'Give the owl some jerky' && owl.friend && owl.with && owl.visible, JSON.stringify({ owlDay, owl }));
  await G(() => { const g = window.__gametool, o = g.pets.find((p) => p.id === 'owl'); g.player.pos.set(o.pos.x + 6, 0, o.pos.z + 6); });
  await page.waitForFunction(() => { const o = window.__gametool.pets.find((p) => p.id === 'owl'); return o.root.position.y - window.__gametool.world.heightAt(o.pos.x, o.pos.z) > 0.8; }, null, { timeout: 60000 }).catch(() => {});
  const flies = await G(() => { const o = window.__gametool.pets.find((p) => p.id === 'owl'); return +(o.root.position.y - window.__gametool.world.heightAt(o.pos.x, o.pos.z)).toFixed(2); });
  check(`${name}: the owl flies at shoulder height while following`, flies > 0.8, `${flies} m up`);
  check(`${name}: no console / page errors`, errors.length === 0, errors.slice(0, 3).join(' | '));
  await ctx.close();
}
await browser.close();
const failed = results.filter((x) => !x.ok).length;
console.log(`\n${results.length - failed}/${results.length} passed`);
process.exit(failed ? 1 : 0);
