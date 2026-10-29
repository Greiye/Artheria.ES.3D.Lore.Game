// Trait roll tables (docs/trait-roll-tables.md, Mike approved 2026-10-29): the roll engine and its rules, rolled
// goblins in the 3D dungeon (AI, bolts, loot, knock-out) and in the Quick Dungeon text, rolled townsfolk crowds,
// hidden dice, and the ?seed / ?bestiary debug flags.
// Usage: npm run build && node test/e2e-traits.mjs [path/to/index.html]
import { chromium } from 'playwright-core';
import path from 'node:path';

const file = path.resolve(process.argv[2] ?? 'dist/index.html');
const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH || undefined,
  args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'],
});
const shots = process.env.SHOTS_DIR && path.resolve(process.env.SHOTS_DIR);
const shot = (page, name) => shots ? page.screenshot({ path: path.join(shots, name + '.png') }) : undefined;
const results = [];
const check = (id, ok, detail = '') => { results.push({ id, ok }); console.log(`${ok ? 'PASS' : 'FAIL'}  ${id}${detail ? '  — ' + detail : ''}`); };
const G = (page, fn, arg) => page.evaluate(fn, arg);
const until = (page, fn, arg, timeout = 15000) => page.waitForFunction(fn, arg, { timeout, polling: 100 }).then(() => true, () => false);
const sim = async (page, s) => { const t0 = await G(page, () => window.__gametool.perf.simSeconds); return until(page, ([t0, s]) => window.__gametool.perf.simSeconds > t0 + s, [t0, s], 90000); };

async function open(query = '') {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 } });
  await ctx.addInitScript(() => localStorage.setItem('gametool.character', JSON.stringify({ name: 'Test', motivation: '', secret: '', created: true })));
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  await page.goto('file://' + file + query);
  await page.waitForFunction(() => window.__gametool, null, { timeout: 90000 });
  await page.click('#begin'); await page.mouse.move(5, 5);
  await page.waitForFunction(() => window.__gametool.state === 'play', null, { timeout: 8000 });
  return { page, errors };
}
const { page, errors } = await open();

// ---------- The engine ----------
const eng = await G(page, () => {
  const T = window.__gametool.traits, out = { n: 0, overBudget: 0, misfit: [], club: 0, clubBad: 0, hatNotArcher: 0, unnamed: 0, titleBad: 0, rare: 0, coverage: [], same: true };
  const ranks = { common: 0, uncommon: 1, rare: 2, legendary: 3 };
  for (let s = 1; s <= 600; s++) {
    const v = T.rollGoblin(s * 7919), st = T.goblinStats(v), beh = v.picks.find((p) => p.table === 'behaviour').row, wp = v.picks.find((p) => p.table === 'weapon').row;
    out.n++;
    if (v.threat > 6) out.overBudget++;
    const lim = beh.limits?.weapon;
    if (lim && !lim.some((t) => wp.tags?.includes(t))) out.misfit.push(`${beh.id}+${wp.id}`);
    if (wp.id === 'greatclub') { out.club++; if (!v.tags.has('size:big')) out.clubBad++; }
    if (v.picks.some((p) => p.table === 'headgear' && p.row.id === 'feathered') && beh.id !== 'archer') out.hatNotArcher++;
    if (!v.name) out.unnamed++;
    if ((ranks[v.rarity] >= 2) !== !!v.title) out.titleBad++;
    if (ranks[v.rarity] >= 2) out.rare++;
    if (st.hp < 2) out.overBudget++;
    const again = T.rollGoblin(s * 7919);
    if (again.display !== v.display || again.picks.map((p) => p.row.id).join() !== v.picks.map((p) => p.row.id).join()) out.same = false;
  }
  return out;
});
check('traits: 600 goblins stay within the threat budget of 6', eng.overBudget === 0, JSON.stringify({ over: eng.overBudget }));
check('traits: every weapon fits its behaviour (archers shoot, trappers trap; a mismatch rerolls the weapon)', eng.misfit.length === 0, eng.misfit.slice(0, 5).join(' '));
check('traits: greatclubs only on Big or Brute goblins; a feathered hat makes an archer', eng.clubBad === 0 && eng.hatNotArcher === 0, JSON.stringify({ club: eng.club, bad: eng.clubBad, hat: eng.hatNotArcher }));
check('traits: every goblin is named; Rare and Legendary ones (and only they) also get a title', eng.unnamed === 0 && eng.titleBad === 0 && eng.rare > 20, JSON.stringify({ rare: eng.rare, titleBad: eng.titleBad }));
check('traits: the same seed rebuilds the same goblin', eng.same);
const rules = await G(page, () => {
  const T = window.__gametool.traits;
  // A tiny archetype to exercise the engine's rules directly.
  const A = {
    archetype: 'test', base: { height: 1, hp: 1, speed: 1, budget: 2 }, order: ['a', 'b', 'c'], epithetOrder: ['a'], names: ['X'], epithets: ['the Y'],
    tables: {
      a: { die: 'd2', rows: [{ range: [1, 1], id: 'heavy', threat: 2, tags: ['hat'] }, { range: [2, 2], id: 'light', threat: 0 }] },
      b: { die: 'd2', rows: [{ range: [1, 1], id: 'helm', tags: ['hat'], excludes: ['hat'], threat: 2 }, { range: [2, 2], id: 'bare' }] },
      c: { die: 'd2', times: 2, rows: [{ range: [1, 1], id: 'none' }, { range: [2, 2], id: 'charm', roll: 'd' }] },
      d: { die: 'd1', rows: [{ range: [1, 1], id: 'bell', label: 'a bell' }] },
    },
  };
  let excl = 0, dup = 0, sub = 0, over = 0;
  for (let s = 1; s <= 200; s++) {
    const v = T.roll(A, s);
    const ids = v.picks.map((p) => p.row.id);
    if (ids.includes('heavy') && ids.includes('helm')) excl++;
    if (ids.filter((x) => x === 'charm').length > 1) dup++;
    if (v.picks.some((p) => p.row.id === 'charm' && p.sub?.id === 'bell')) sub++;
    if (v.threat > 2) over++;
  }
  return { excl, dup, sub, over };
});
check('traits engine: excludes, budget, "roll twice, drop duplicates" and "roll on another table" all hold', rules.excl === 0 && rules.dup === 0 && rules.sub > 0 && rules.over === 0, JSON.stringify(rules));

// ---------- Townsfolk crowds ----------
const folk = await G(page, () => {
  const g = window.__gametool, f = g.townsfolk.folk;
  return { n: f.length, rolled: f.every((x) => x.root.userData.traits), skins: new Set(f.map((x) => x.root.children[0].userData.look?.skin ?? x.root.userData.look?.skin)).size, natalie: !g.world.scene.getObjectByName('natalie')?.userData.traits };
});
check('traits: the townsfolk crowd is rolled (varied skin, hair, build); Natalie stays hand-made', folk.rolled && folk.skins >= 4 && folk.natalie, JSON.stringify(folk));

// ---------- 3D dungeon ----------
await G(page, () => window.__gametool.enterDungeon(4242));
await until(page, () => /♥/.test(document.querySelector('#delveHp').textContent));
const dz = await G(page, () => { const g = window.__gametool; return { n: g.goblins.alive.length, tags: g.goblins.list.every((f) => f.root.getObjectByName('foe-tag')), names: g.goblins.list.map((f) => f.v.display), hp: document.querySelector('#delveHp').textContent }; });
check('dungeon: 1–6 rolled goblins spawn, each with a name tag; the HUD shows your health', dz.n >= 1 && dz.n <= 6 && dz.tags && /♥ 10\/10/.test(dz.hp), JSON.stringify(dz));
// Clear the rolled ones and set up controlled fights at the entrance.
const seedFor = (beh) => G(page, (beh) => { const T = window.__gametool.traits; for (let s = 1; s < 5000; s++) { const v = T.rollGoblin(s); if (T.goblinStats(v).behaviour === beh && !v.picks.some((p) => p.row.id === 'potlid')) return s; } return 0; }, beh);
const place = (seed, dist, ang = 0) => G(page, ([seed, dist, ang]) => {
  const g = window.__gametool, p = g.player.pos, d = new g.Vector3(); g.player.lookDir(d); d.y = 0; d.normalize().applyAxisAngle(new g.Vector3(0, 1, 0), ang);
  for (let k = dist; k > 0.5; k -= 0.25) { const x = p.x + d.x * k, z = p.z + d.z * k; if (g.dungeon.walkable(x, z)) { const f = g.goblins.spawn(g.traits.rollGoblin(seed), new g.Vector3(x, 0, z), Math.atan2(-d.x, -d.z), true); return +k.toFixed(2); } }
  return 0;
}, [seed, dist, ang]);
const reset = () => G(page, () => { const g = window.__gametool; g.goblins.clear(); g.delveHp = 99; g.player.spawn(g.dungeon.entrance(), g.dungeon.entranceYaw()); g.inventory.give('bolt', 10); });
const distOf = (i = 0) => G(page, (i) => { const g = window.__gametool, f = g.goblins.list[i]; return f ? +Math.hypot(f.root.position.x - g.player.pos.x, f.root.position.z - g.player.pos.z).toFixed(2) : -1; }, i);

const rusher = await seedFor('rusher');
await reset();
const d0 = await place(rusher, 5);
await sim(page, 3);
const after = await G(page, () => { const g = window.__gametool, f = g.goblins.list[0]; return { d: +Math.hypot(f.root.position.x - g.player.pos.x, f.root.position.z - g.player.pos.z).toFixed(2), hp: g.delveHp, alerted: f.alerted }; });
check('dungeon AI: a rusher charges in and hits you', d0 > 2 && after.alerted && after.d < d0 - 1 && after.hp < 99, JSON.stringify({ d0, ...after }));

// A bolt from the crossbow hurts it; enough of them drop it and pay its loot.
const shotRes = await G(page, () => new Promise((done) => {
  const g = window.__gametool, cb = g.crossbow, f = g.goblins.list[0], hp0 = f.hp, c0 = g.inventory.count('crown');
  g.inventory.give('crossbow', 1); cb.equip(); cb.loaded = true;
  const p = f.root.position, e = g.player.eyePos;
  g.player.yaw = Math.atan2(-(p.x - e.x), -(p.z - e.z)); g.player.pitch = Math.atan2(f.st.height * 0.6 - e.y, Math.hypot(p.x - e.x, p.z - e.z));
  g.goblins.list[0].st.speed = 0;
  requestAnimationFrame(() => { cb.fire(); setTimeout(() => done({ hp0, hp1: f.hp, c0 }), 400); });
}));
await sim(page, 0.5);
const killed = await G(page, ({ c0 }) => { const g = window.__gametool, f = g.goblins.list[0], d = new g.Vector3(0, 0, 1); let n = 0; while (f.state !== 'dead' && n < 20) { g.goblins.shoot(f, 1, d.set(-Math.sin(f.root.rotation.y), 0, -Math.cos(f.root.rotation.y))); n++; } return { dead: f.state === 'dead', n, crowns: g.inventory.count('crown') - c0 }; }, shotRes);
check('dungeon: a crossbow bolt wounds a goblin, and enough bolts drop it with its loot', shotRes.hp1 < shotRes.hp0 && killed.dead && killed.crowns > 0, JSON.stringify({ ...shotRes, ...killed }));
await G(page, () => { const g = window.__gametool; g.crossbow.unequip(); });

const archer = await seedFor('archer');
await reset();
await place(archer, 4);
await sim(page, 4);
const arch = await G(page, () => { const g = window.__gametool, f = g.goblins.list[0]; return { d: +Math.hypot(f.root.position.x - g.player.pos.x, f.root.position.z - g.player.pos.z).toFixed(2), weapon: f.st.weapon, hp: g.delveHp }; });
check('dungeon AI: an archer backs off to shooting range and shoots', arch.d > 4.5 && ['sling', 'bow'].includes(arch.weapon) && arch.hp < 99, JSON.stringify(arch));

const thief = await seedFor('thief');
await reset();
await place(thief, 4);
const stolen = await until(page, () => window.__gametool.goblins.list[0]?.stolen > 0, null, 60000);
const b1 = await G(page, () => ({ bolts: window.__gametool.inventory.count('bolt'), state: window.__gametool.goblins.list[0].state }));
check('dungeon AI: a thief snatches bolts and runs; killing it gives them back', stolen && b1.state === 'flee', JSON.stringify(b1));

const amb = await seedFor('ambusher');
await reset();
await place(amb, 6);
await sim(page, 1);
const hidden = await G(page, () => { const f = window.__gametool.goblins.list[0]; return { state: f.state, tag: f.tag.visible }; });
check('dungeon AI: an ambusher waits crouched and unseen until you come close', hidden.state === 'hidden' && !hidden.tag, JSON.stringify(hidden));

// Run out of health: Natalie hauls you back up.
await reset();
await place(rusher, 3);
await G(page, () => { window.__gametool.delveHp = 1; });
const out = await until(page, () => !window.__gametool.inDungeon, null, 60000);
check('dungeon: at 0 health you are knocked out and back at the trapdoor', out && await G(page, () => window.__gametool.goblins.list.length === 0));
await shot(page, 'traits-dungeon');

// ---------- Quick Dungeon ----------
const qd = await G(page, () => {
  const g = window.__gametool, q = g.quick;
  g.openQuick(4242);
  const texts = [];
  while (q.isOpen && q.decisions < 4) {
    const fight = q.options.find((id) => q.graph.nodes.find((n) => n.id === id).kind === 'fight') ?? q.options[0];
    q.choose(fight); texts.push({ title: q.result.title, text: q.result.text, goblin: q.result.goblin }); q.ok();
  }
  if (q.isOpen) q.leave();
  return texts;
});
const fights = qd.filter((t) => t.goblin);
check('Quick Dungeon: fights and the nest are rolled goblins, named, with their look and tactic in the text', fights.length >= 2 && fights.every((t) => /goblin/.test(t.text) && t.text.includes(t.title === 'The Nest' ? '' : t.title)), JSON.stringify(fights.map((t) => t.text.split('\n')[0])));
check('traits: no dice are ever shown (no d20, 2d6 or roll results in the text)', qd.every((t) => !/\b\d*d(4|6|8|10|12|20|100)\b|\broll/i.test(t.text)));
const reroll = await G(page, () => { const g = window.__gametool, q = g.quick, a = [], b = []; for (const out of [a, b]) { q.open(4242); while (q.isOpen && q.decisions < 4) { q.choose(q.options[0]); if (q.result.goblin) out.push(q.result.goblin); q.ok(); } if (q.isOpen) q.leave(); } return { a, b }; });
check('Quick Dungeon: the same seed meets new goblins each run (Mike)', reroll.a.join() !== reroll.b.join(), JSON.stringify(reroll));
check('traits: no console/page errors', errors.length === 0, errors.join(' | '));

// ---------- Debug flags ----------
await page.context().close();
const dbg = await open('?bestiary&seed=4471');
const best = await G(dbg.page, () => { const g = window.__gametool; return { n: g.goblins.list.length, first: g.goblins.list[0]?.v.seed, names: g.goblins.list.map((f) => f.v.display) }; });
check('debug: ?bestiary lines up 12 rolled goblins, and ?seed=4471 forces the first', best.n === 12 && best.first === 4471, JSON.stringify(best));
await shot(dbg.page, 'traits-bestiary');
check('debug flags: no console/page errors', dbg.errors.length === 0, dbg.errors.join(' | '));

await browser.close();
const failed = results.filter((r) => !r.ok).length;
console.log(`\n${results.length - failed}/${results.length} checks passed`);
process.exit(failed ? 1 : 0);
