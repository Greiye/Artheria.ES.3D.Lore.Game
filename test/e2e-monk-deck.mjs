// B58 (Mike 2026-11-08): the Monk's combat deck. The engine rules (stamina for every fighter, stances, a deck's
// slots and strings, charging, parrying, a broken guard), Kavik's stamina sense, the fight HUD (stamina bars for
// every profession, the Monk's stance), learning a move by blocking it three times, the dojo mat editor (meditate,
// 16 slots, pick a move, the pale copy that shows a string), and an old save loading with the starter deck.
// Usage: npm run build && node test/e2e-monk-deck.mjs [path/to/index.html]
import { chromium } from 'playwright-core';
import path from 'node:path';

const file = path.resolve(process.argv[2] ?? 'dist/index.html');
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const results = [];
const check = (id, ok, detail = '') => { results.push({ id, ok }); console.log(`${ok ? 'PASS' : 'FAIL'}  ${id}${detail ? '  — ' + detail : ''}`); };
const errors = [];

async function boot(profession, extra = {}) {
  const ctx = await browser.newContext({ viewport: { width: 1100, height: 680 } });
  await ctx.addInitScript(([profession, extra]) => {
    localStorage.setItem('gametool.character', JSON.stringify({ name: 'Tamsin', motivation: '', secret: '', created: true, profession }));
    localStorage.setItem('gametool.firstday', JSON.stringify({ step: 99, done: true }));
    for (const [k, v] of Object.entries(extra)) if (localStorage.getItem(k) === null) localStorage.setItem(k, v);
  }, [profession, extra]);
  const page = await ctx.newPage();
  page.on('pageerror', (e) => errors.push(e.message));
  await page.route(/^https?:/, (r) => r.abort());
  await page.goto('file://' + file, { timeout: 180000 });
  await page.waitForFunction(() => window.__gametool, null, { timeout: 180000 });
  await page.evaluate(() => document.querySelector('#begin').click());
  await page.waitForFunction(() => window.__gametool.state === 'play', null, { timeout: 180000 });
  await page.evaluate(() => window.__gametool.endWake?.());
  await page.waitForTimeout(400);
  return { ctx, page, G: (fn, a) => page.evaluate(fn, a), until: (fn, a, timeout = 20000) => page.waitForFunction(fn, a, { timeout, polling: 100 }).then(() => true, () => false) };
}

// ---------- The engine, frame by frame ----------
let { ctx, page, G, until } = await boot('monk');
await G(() => {
  const g = window.__gametool, Fight = g.fightMode.fight.constructor, idle = { x: 0, up: false, down: false, lp: false, rp: false, lk: false, rk: false };
  window.__run = (setup, script, frames) => {
    const f = new Fight(); f.phase = 'fight'; f.a.x = -0.45; f.b.x = 0.45;
    setup?.(f, g.deckKit);
    const log = [], trace = [];
    for (let i = 0; i < frames; i++) {
      const [pa, pb] = script(i, f);
      f.step({ ...idle, ...pa }, { ...idle, ...pb });
      for (const e of f.events) log.push({ i, by: e.by.name, move: e.move.id, blocked: e.blocked, outcome: e.outcome });
      trace.push({ move: f.a.move?.id ?? null, stance: f.a.stance, st: Math.round(f.a.stamina) });
    }
    return { log, trace, a: { hp: f.a.hp, st: f.a.stamina, state: f.a.state, stance: f.a.stance }, b: { hp: f.b.hp, st: f.b.stamina, state: f.b.state } };
  };
});
let r = await G(() => window.__run(null, (i) => [{ lp: i === 0 }, {}], 30));
check('Stamina: a jab spends some of it, for any fighter', r.a.st < 100 && r.a.st >= 90 && r.log.some((e) => e.move === 'jab'), JSON.stringify(r.a));
r = await G(() => window.__run(null, (i) => [{ lp: i === 0 }, {}], 240));
check('Stamina comes back after a rest', r.a.st === 100, String(r.a.st));
const hitAt = (r, id) => r.log.find((e) => e.move === id)?.i ?? -1;
const fresh = await G(() => window.__run(null, (i) => [{ lp: i === 0 }, {}], 40));
r = await G(() => window.__run((f) => { f.a.stamina = 0; f.a.calm = -999; }, (i) => [{ lp: i === 0 }, {}], 40));
check('Out of stamina, a move comes out four frames slower', hitAt(r, 'jab') === hitAt(fresh, 'jab') + 4, `${hitAt(fresh, 'jab')} -> ${hitAt(r, 'jab')}`);
r = await G(() => window.__run((f) => { f.b.stamina = 0; f.b.calm = -999; }, (i) => [{ lk: i === 0 }, { x: 1 }], 40));
check('A guard with no stamina behind it breaks', r.log.some((e) => e.move === 'shin' && !e.blocked && e.outcome === 'guardbreak') && r.b.hp < 100, JSON.stringify(r.log));
r = await G(() => window.__run(null, (i) => [{ lk: i === 0 }, { x: 1 }], 40));
check('A guard with stamina still blocks', r.log.some((e) => e.move === 'shin' && e.blocked) && r.b.hp === 100, JSON.stringify(r.log));

// The deck: the stance picks the move, whatever the stick says; each move ends in a stance; four hits at most.
const deckOf = `(f, k) => { f.a.deck = [['jab', 'straight', 'shin', 'axe'], ['hammer', 'hook', 'push', 'axe'], ['lowpalm', 'straight', 'sweep', 'axe'], ['wheel', 'straight', 'shin', 'heel']]; }`;
r = await G(`window.__run(${deckOf}, (i) => [{ rp: i === 0, x: 1 }, {}], 12)`);
check('Deck: a limb throws the stance\'s move, and the stick does not change it', r.trace[2].move === 'straight' && r.a.stance === 1, JSON.stringify(r.trace[2]));
r = await G(`window.__run(${deckOf}, (i, f) => [{ rp: i === 0 || (f.a.move?.id === 'straight' && f.a.phase === 'recovery' && !f.__p1 && (f.__p1 = true)), lk: f.a.move?.id === 'hook' && f.a.phase === 'recovery' && !f.__p2 && (f.__p2 = true) }, {}], 90)`);
{ const seq = [...new Set(r.trace.map((t) => t.move).filter(Boolean))];
  check('Deck: the next press reads the stance the last move ended in (Front Left RP, Front Right RP, Back Right LK)', seq.join(',') === 'straight,hook,shin', seq.join(',')); }
r = await G(`window.__run((f) => { f.a.deck = [0, 1, 2, 3].map(() => ['jab', 'jab', 'jab', 'jab']); f.b.x = 3; }, (i, f) => [{ lp: i === 0 || f.a.phase === 'recovery' || !f.a.move }, {}], 200)`);
{ // The stamina drops once per move start: count the drops before the first gap of idle frames.
  let n = 0, i = 0; while (i < r.trace.length && r.trace[i].move) { if (i === 0 || r.trace[i].st < r.trace[i - 1].st) n++; i++; }
  let gap = 0; while (i + gap < r.trace.length && !r.trace[i + gap].move) gap++;
  check('Deck: a string is four moves at most, then it must recover before the next', n === 4 && gap >= 10 && gap < 30 && i + gap < r.trace.length, JSON.stringify({ n, gap })); }

// Charge: hold the limb through the wind-up.
// (The one guarding has its back to the wall, so it can't walk out of reach during the longer wind-up.)
const walled = deckOf.replace('; }', '; f.a.x = 2.5; f.b.x = 3.4; }');
const plain = await G(`window.__run(${walled}, (i) => [{ lk: i === 0 }, { x: 1 }], 70)`);
r = await G(`window.__run(${walled}, (i) => [{ lk: i === 0, hold: { lk: i < 30 } }, { x: 1 }], 70)`);
check('Charge: holding the limb makes the move slower and it breaks a guard', hitAt(r, 'shin') === hitAt(plain, 'shin') + 12 && r.log.some((e) => e.outcome === 'guardbreak') && plain.log.some((e) => e.blocked) && r.b.hp < plain.b.hp && r.a.st < plain.a.st,
  JSON.stringify({ plain: plain.log, charged: r.log, st: [plain.a.st, r.a.st] }));
r = await G(`window.__run(${deckOf}, (i) => [{ lk: i === 0, hold: { lk: i < 30 } }, {}], 70)`);
const open = await G(`window.__run(${deckOf}, (i) => [{ lk: i === 0 }, {}], 70)`);
check('Charge: a charged hit does more damage', 100 - r.b.hp > 100 - open.b.hp, `${100 - open.b.hp} -> ${100 - r.b.hp}`);
r = await G(() => window.__run(null, (i) => [{ lk: i === 0, hold: { lk: true } }, { x: 1 }], 60));
check('Charge is the deck fighter\'s: without a deck, holding changes nothing', r.log.some((e) => e.blocked), JSON.stringify(r.log));

// Parry: Kavik's side (b) jabs; the Monk taps back just before it lands.
const jabLands = hitAt(await G(() => window.__run(null, (i) => [{}, { lp: i === 0 }], 40)), 'jab');
r = await G(`window.__run((f) => { f.a.deck = [[null, null, null, null], [null, null, null, null], [null, null, null, null], [null, null, null, null]]; f.a.stamina = 50; f.a.calm = -999; }, (i) => [{ x: i >= ${jabLands} - 3 && i <= ${jabLands} + 1 ? -1 : 0 }, { lp: i === 0 }], 60)`);
check('Parry: a tap of back as the hit lands staggers the attacker and gives stamina back', r.log.some((e) => e.outcome === 'parry') && r.a.hp === 100 && r.a.st > 50 && r.trace.length > 0, JSON.stringify({ log: r.log, st: r.a.st }));
r = await G(`window.__run((f) => { f.a.deck = [[null, null, null, null], [null, null, null, null], [null, null, null, null], [null, null, null, null]]; }, (i) => [{ x: i < ${jabLands} + 2 ? -1 : 0 }, { lp: i === 0 }], 60)`);
check('Held back all along is a plain block, not a parry', r.log.some((e) => e.outcome === 'block') && !r.log.some((e) => e.outcome === 'parry'), JSON.stringify(r.log));
r = await G(`window.__run((f) => { f.a.deck = [[null, null, null, null], [null, null, null, null], [null, null, null, null], [null, null, null, null]]; f.b.x = 3; f.a.calm = -999; }, (i) => [{ x: i >= 5 && i < 8 ? -1 : 0 }, {}], 30)`);
check('A parry at nothing costs stamina', r.a.st === 90, String(r.a.st));

// Kavik reads stamina: nearly out, he backs off.
r = await G(() => {
  const g = window.__gametool, Fight = g.fightMode.fight.constructor, AI = g.fightMode.ai.constructor;
  let s = 7; const rnd = () => (s = (s * 16807) % 2147483647) / 2147483647;
  const f = new Fight(); f.phase = 'fight'; f.a.x = -0.6; f.b.x = 0.6; f.b.stamina = 5; f.b.calm = -9999;
  const ai = new AI('fair', rnd), idle = { x: 0, up: false, down: false, lp: false, rp: false, lk: false, rk: false };
  let back = 0, attacks = 0;
  for (let i = 0; i < 50; i++) { f.step(idle, ai.pad(f)); if (ai.state === 'back') back++; if (f.b.move) attacks++; }
  return { back, attacks, x: f.b.x };
});
check('Kavik backs off behind his guard when his stamina is nearly gone', r.back > 30 && r.attacks === 0 && r.x > 0.6, JSON.stringify(r));

// ---------- The spar as a Monk: HUD, deck, learning ----------
await G(() => window.__gametool.openFight());
await until(() => window.__gametool.fightMode.isOpen && window.__gametool.fightMode.fight.phase === 'fight');
r = await G(() => { const m = window.__gametool.fightMode, vis = (s) => { const e = document.querySelector(s); return !!e && getComputedStyle(e).display !== 'none' && e.getBoundingClientRect().width > 0; };
  return { deck: !!m.fight.a.deck, kavikDeck: !!m.fight.b.deck, bars: document.querySelectorAll('#fight .fx-stam').length, barsVis: vis('#fight .fx-stam'), stance: vis('#fight .fx-stance'), name: document.querySelector('#fight .fx-stance-name').textContent, help: vis('#fight .fx-help-monk') }; });
check('Monk spar: the deck is in hand, both sides show stamina, the stance shows', r.deck && !r.kavikDeck && r.bars === 2 && r.barsVis && r.stance && r.name === 'Front Left' && r.help, JSON.stringify(r));
// Block Kavik's Front Snap three times (events fed through the fight's own hook).
r = await G(() => { const m = window.__gametool.fightMode, k = window.__gametool.deckKit, f = m.fight, got = [];
  const before = k.loadDecks().learned.includes('snap');
  for (let i = 0; i < 3; i++) { f.onHit({ by: f.b, on: f.a, move: k.MOVES.snap, blocked: true, outcome: i === 2 ? 'parry' : 'block' }); got.push(k.loadDecks().seen.snap ?? null); }
  f.onHit({ by: f.a, on: f.b, move: k.MOVES.wheel, blocked: true, outcome: 'block' });   // your own move, blocked by him: nothing learned
  f.onHit({ by: f.b, on: f.a, move: k.MOVES.heel, blocked: false, outcome: 'hit' });     // a hit you ate: nothing learned
  const s = k.loadDecks();
  return { before, got, learned: s.learned.includes('snap'), wheel: s.seen.wheel ?? 0, heel: s.seen.heel ?? 0, toast: document.getElementById('toast').textContent }; });
check('Blocking or parrying a foe\'s move three times learns it, with a toast, and it is saved', !r.before && r.got[0] === 1 && r.got[1] === 2 && r.learned && r.wheel === 0 && r.heel === 0 && /learned Front Snap/.test(r.toast), JSON.stringify(r));
await G(() => window.__gametool.fightMode.close());
await page.waitForTimeout(600);
for (let i = 0; i < 6 && await G(() => window.__gametool.state === 'dialogue'); i++) { await page.keyboard.press('Escape'); await page.waitForTimeout(300); }
await until(() => window.__gametool.state === 'play');

// ---------- The dojo mat ----------
r = await G(() => { const g = window.__gametool, it = g.interactables.find((x) => x.obj.name === 'deck-mat'); return { verb: it?.verb(), at: it ? [it.obj.position.x, it.obj.position.z] : null }; });
check('The dojo has a meditation mat a Monk can use', /Meditate/.test(r.verb ?? ''), JSON.stringify(r));
await G(() => window.__gametool.interactables.find((x) => x.obj.name === 'deck-mat').act());
await until(() => window.__gametool.monkDeck.deckPanel.isOpen);
await page.waitForTimeout(900);
r = await G(() => { const g = window.__gametool, k = g.deckKit, p = g.player.pos, el = document.querySelector('#deck .forge-panel').getBoundingClientRect();
  return { state: g.state, pose: g.monkDeck.deckPose, near: Math.hypot(p.x - k.DECK_MAT.x, p.z - k.DECK_MAT.z) < 0.2, slots: document.querySelectorAll('#deck .dk-slot').length, cards: document.querySelectorAll('#deck .dk-card').length,
    right: el.right >= innerWidth - 2 && el.left > innerWidth / 2, strings: document.querySelectorAll('#deck .dk-strings li').length, shot: g.rig.inShot, lib: document.querySelector('#deck .dk-lib').textContent }; });
check('Meditating: you sit on the mat, the panel opens on the right with 4 stances x 4 limbs', r.state === 'forge' && r.pose === 'meditate' && r.near && r.slots === 16 && r.cards === 4 && r.right && r.shot, JSON.stringify(r));
check('The panel lists the deck\'s strings and the library (9 of 22 after learning one)', r.strings >= 2 && /9 of 22/.test(r.lib), JSON.stringify({ strings: r.strings, lib: r.lib }));
{ const cam0 = await G(() => window.__gametool.camera.position.toArray()); await page.waitForTimeout(1500); const cam1 = await G(() => window.__gametool.camera.position.toArray());
  check('The camera circles slowly while you meditate', Math.hypot(cam1[0] - cam0[0], cam1[2] - cam0[2]) > 0.02, JSON.stringify([cam0, cam1])); }
await page.screenshot({ path: 'test/screenshots/monk-deck.png' }).catch(() => {});
// Pick the learned Front Snap for Front Right · Left foot.
await page.click('#deck .dk-slot[data-slot="1:2"]');
r = await G(() => ({ moves: [...document.querySelectorAll('#deck .dk-move')].map((b) => b.dataset.move), stats: document.querySelector('#deck .dk-move .dk-stats')?.textContent ?? '' }));
check('A slot lists the learned moves for that limb, with speed, damage, reach, height and end stance', r.moves.includes('snap') && r.moves.includes('shin') && !r.moves.includes('jab') && r.moves.includes('') && /wind-up \d+f · dmg \d+ · reach [\d.]+ m · (high|mid|low) · stamina \d+ · ends (Front|Back) (Left|Right)/.test(r.stats), JSON.stringify(r));
await page.click('#deck .dk-move[data-move="snap"]');
r = await G(() => { const k = window.__gametool.deckKit, s = k.loadDecks(); return { slot: s.decks[s.active].slots[1][2], shown: document.querySelector('#deck .dk-move.on')?.dataset.move }; });
check('Choosing a move fills the slot and saves the deck', r.slot === 'snap' && r.shown === 'snap', JSON.stringify(r));
await page.click('#dkShow');
check('"Show it": a pale copy of you stands by the mat and performs the string', await until(() => { const g = window.__gametool, gh = g.world.scene.getObjectByName('deck-ghost'); let pale = false; gh?.traverse((o) => { if (o.isMesh && [o.material].flat()[0].transparent && [o.material].flat()[0].opacity < 0.6) pale = true; }); return !!gh && gh.visible && pale && g.monkDeck.deckPreview?.move === 'snap'; }, null, 8000));
await page.screenshot({ path: 'test/screenshots/monk-deck-preview.png' }).catch(() => {});
check('The copy goes away when the string is done', await until(() => !window.__gametool.world.scene.getObjectByName('deck-ghost').visible, null, 20000));
// A second deck, renamed.
await page.click('#dkBack'); await page.click('#dkNew');
await page.fill('#dkName', 'River hands'); await page.dispatchEvent('#dkName', 'change');
r = await G(() => { const s = window.__gametool.deckKit.loadDecks(); return { n: s.decks.length, active: s.active, name: s.decks[s.active].name, first: s.decks[0].slots[1][2] }; });
check('Up to three named decks; the first keeps its slots', r.n === 2 && r.active === 1 && r.name === 'River hands' && r.first === 'snap', JSON.stringify(r));
await page.click('#deck [data-deck="0"]');
await page.click('#dkClose');
await until(() => window.__gametool.state === 'play');
r = await G(() => ({ pose: window.__gametool.monkDeck.deckPose, shot: window.__gametool.rig.inShot, ghost: window.__gametool.world.scene.getObjectByName('deck-ghost').visible }));
check('Standing up gives the game back', r.pose === null && !r.shot && !r.ghost, JSON.stringify(r));
// The deck you built is the one you fight with.
await G(() => window.__gametool.openFight());
await until(() => window.__gametool.fightMode.isOpen);
check('The spar uses the deck you built', await G(() => window.__gametool.fightMode.fight.a.deck?.[1][2] === 'snap'));
await G(() => window.__gametool.fightMode.close());
await ctx.close();

// ---------- Other professions, and saves ----------
({ ctx, page, G, until } = await boot('fighter', { 'gametool.monkdeck': '{"v":1,"decks":[{"name":"","slots":[["nope","throw","leap","hook"]]}],"active":7,"learned":["hook","bogus","throw"],"seen":{"heel":2,"bogus":9}}' }));
r = await G(() => { const k = window.__gametool.deckKit, s = k.loadDecks(); return { slots: s.decks[0].slots, active: s.active, learned: s.learned.length, hook: s.learned.includes('hook'), seen: s.seen, name: s.decks[0].name }; });
check('A damaged deck save is mended, not thrown away (unknown moves dropped, the rest kept)', r.slots.length === 4 && r.slots[0].join() === ',,,hook' && r.slots[3].join() === ',,,' && r.active === 0 && r.learned === 9 && r.hook && r.seen.heel === 2 && !('bogus' in r.seen) && r.name === 'Deck 1', JSON.stringify(r));
r = await G(() => { const k = window.__gametool.deckKit; localStorage.removeItem(k.DECK_KEY); const s = k.loadDecks(); return { decks: s.decks.length, row: s.decks[0].slots[0].join(), learned: s.learned.length, strings: k.deckStrings(s.decks[0].slots).length }; });
check('A save from before the deck opens with the starter deck (8 moves, a string from every stance)', r.decks === 1 && r.row === 'jab,straight,shin,axe' && r.learned === 8 && r.strings >= 4, JSON.stringify(r));
r = await G(() => { const g = window.__gametool; return Object.keys(g.extras?.exportProfile?.() ?? {}).length; }).catch(() => 0);
await G(() => window.__gametool.interactables.find((x) => x.obj.name === 'deck-mat').act());
await page.waitForTimeout(500);
r = await G(() => ({ open: window.__gametool.monkDeck.deckPanel.isOpen, toast: document.getElementById('toast').textContent, verb: window.__gametool.interactables.find((x) => x.obj.name === 'deck-mat').verb() }));
check('Other professions see the mat but it is the Monk\'s', !r.open && /Monks sit here/.test(r.toast) && !/combat deck/.test(r.verb), JSON.stringify(r));
await G(() => window.__gametool.openFight());
await until(() => window.__gametool.fightMode.isOpen && window.__gametool.fightMode.fight.phase === 'fight');
r = await G(() => { const m = window.__gametool.fightMode, e = document.querySelector('#fight .fx-stam'), s = document.querySelector('#fight .fx-stance');
  m.fight.a.stamina = 0; m.fight.a.calm = -999; return { deck: !!m.fight.a.deck, bar: getComputedStyle(e).display !== 'none' && e.getBoundingClientRect().height > 3, stance: getComputedStyle(s).display }; });
await page.waitForTimeout(400);
r.empty = await G(() => document.querySelector('#fight .fx-stam').classList.contains('empty'));
check('A Fighter spars as before (no deck, no stance) but sees stamina, and the bar flags empty', !r.deck && r.bar && r.stance === 'none' && r.empty, JSON.stringify(r));
await ctx.close();

check('no page errors', errors.length === 0, errors.slice(0, 3).join(' | '));
const bad = results.filter((x) => !x.ok).length;
console.log(`\n${results.length - bad}/${results.length} checks passed`);
await browser.close();
process.exit(bad ? 1 : 0);
