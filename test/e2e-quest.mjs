// Phase D checks: B2 companion + detective quest (clues, theory, lead, ending), B12 folklore + Curio Pedlar.
// Usage: npm run build && node test/e2e-quest.mjs [path/to/index.html]
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
await ctx.addInitScript(() => {
  if (!localStorage.getItem('gametool.character')) localStorage.setItem('gametool.character', JSON.stringify({ name: 'Test', motivation: '', secret: '', created: true }));
  window.addEventListener('mousemove', (e) => e.stopImmediatePropagation(), true);   // aim by yaw/pitch only (see e2e-v0.06)
});
const page = await ctx.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
await page.goto('file://' + file);
await page.waitForFunction(() => window.__gametool);
await page.click('#begin');
await page.waitForFunction(() => window.__gametool.state === 'play');

const S = () => G(page, () => window.__gametool.state);
// Stand `back` metres off an object (on its +x/+z side unless told) and look at it.
const aimAt = (getter, back = 1.6, side = [0.8, 0.6]) => G(page, ([src, back, side]) => {
  const g = window.__gametool, o = new Function('g', `return ${src}`)(g), p = g.player, c = o.position;
  const n = Math.hypot(side[0], side[1]);
  p.pos.set(c.x + side[0] / n * back, 0, c.z + side[1] / n * back);
  const d = new g.Vector3(c.x - p.pos.x, c.y - 1.7, c.z - p.pos.z);
  p.yaw = Math.atan2(-d.x, -d.z); p.pitch = Math.atan2(d.y, Math.hypot(d.x, d.z));
}, [getter, back, side]);
const verbIs = (w) => until(page, (want) => document.getElementById('promptVerb').textContent === want && !document.getElementById('prompt').classList.contains('hidden'), w);
const node = () => G(page, () => window.__gametool.dialogue.currentId);
const resume = async () => { if (await S() === 'resume') await page.click('#relockBtn'); await until(page, () => window.__gametool.state === 'play'); };
const through = async () => { for (let i = 0; i < 12 && await S() === 'dialogue'; i++) { await page.keyboard.press('Space'); await page.waitForTimeout(120); } };
const toN2 = async () => { for (let i = 0; i < 8 && (await node()) !== 'n2'; i++) { await page.keyboard.press('Space'); await page.waitForTimeout(120); } await page.keyboard.press('Space'); await page.waitForTimeout(100); };

// ---------- B2: Natalie starts the quest ----------
await aimAt('g.world.natalieTarget', 1.6, [0.2, 1]);
await verbIs('Talk to Natalie');
await page.keyboard.press('KeyE');
await until(page, () => window.__gametool.state === 'dialogue');
await toN2();
await page.keyboard.press('Digit2');   // "I'll find them." -> n4 (crossbow, door, quest)
await page.waitForTimeout(150);
await through();
check('B2 Natalie\'s crossbow talk starts the quest', await G(page, () => window.__gametool.quest.stage === 'clues'));
await resume();
await aimAt('g.world.natalieTarget', 1.6, [0.2, 1]);
await verbIs('Talk to Natalie');
await page.keyboard.press('KeyE');
await until(page, () => window.__gametool.state === 'dialogue');
await toN2();
const choices = await G(page, () => [...document.querySelectorAll('#dialogue .d-choice span')].map((s) => s.textContent));
check('B2 talking again keeps her three choices and adds the companion ones', choices.length === 6 && choices[0] === 'Is it dangerous?' && choices.includes('Come with me.'), JSON.stringify(choices));
await page.keyboard.press(`Digit${choices.indexOf('Come with me.') + 1}`);
await page.waitForTimeout(150);
await through();
check('B2 "Come with me." makes Natalie follow', await G(page, () => window.__gametool.companion.prefs.follow === true));
await resume();
const nat0 = await G(page, () => ({ ...window.__gametool.companion.pos }));
await G(page, () => { const p = window.__gametool.player; p.pos.set(-1, 0, -8); p.yaw = 0; p.pitch = 0; });
let maxSpeed = 0;
for (let i = 0; i < 30; i++) { await page.waitForTimeout(200); maxSpeed = Math.max(maxSpeed, await G(page, () => window.__gametool.companion.speed)); if (await G(page, () => { const g = window.__gametool; return g.companion.pos.distanceTo(g.player.pos) < 3.5; })) break; }
const nat1 = await G(page, () => { const g = window.__gametool; return { d: g.companion.pos.distanceTo(g.player.pos), x: g.companion.pos.x, z: g.companion.pos.z, t: g.world.natalieTarget.position.z }; });
check('B2 Natalie walks after you and stops a step away', nat1.d < 3.5 && Math.hypot(nat1.x - nat0.x, nat1.z - nat0.z) > 3 && Math.abs(nat1.t - nat1.z) < 0.01, JSON.stringify({ ...nat1, maxSpeed }));
check('B2 her figure animates while she walks (speed fed to her rig)', maxSpeed > 1);

// ---------- clues ----------
const glints0 = await G(page, () => window.__gametool.world.scene.getObjectByName('clueGlints').geometry.attributes.position.count);
for (const id of ['string', 'lantern', 'ration']) {
  await aimAt(`g.questProps.hitboxes.get('${id}')`, 1.5, [1, 0.3]);
  const ok = await verbIs('Look closer');
  await page.keyboard.press('KeyE');
  await until(page, (i) => window.__gametool.quest.clues.includes(i), id, 4000);
  if (!ok) console.log('  (no verb for', id, ')');
}
check('B2 E on things out of place collects clues', await G(page, () => window.__gametool.quest.clues.join() === 'string,lantern,ration'), await G(page, () => window.__gametool.quest.clues.join()));
check('B2 found clues lose their rune glint', (await G(page, () => window.__gametool.world.scene.getObjectByName('clueGlints').geometry.attributes.position.count)) < glints0);
check('B2 Natalie comments on what you find', await until(page, () => /Natalie: “/.test(document.getElementById('companionLine').textContent) && !document.getElementById('companionLine').classList.contains('hidden'), null, 6000));

// ---------- casebook + theory ----------
await page.keyboard.press('KeyJ');
check('B2 J opens the casebook with the clues', await until(page, () => window.__gametool.state === 'forge' && document.querySelectorAll('#casebook .cb-clue').length === 3));
await page.fill('#cbTheory', 'They ran down the road with the lantern, half starved and hungry.');
check('B2 the free text is read for tags (Natalie reads: …)', await G(page, () => /Down the road/.test(document.querySelector('#casebook .cb-reading').textContent) && /Hunger/.test(document.querySelector('#casebook .cb-reading').textContent)));
await page.click('#casebook [data-axis="who"][data-v="stagecoach"]');
check('B2 picking a tag overrides the reading and keeps the text', await G(page, () => document.querySelector('#casebook [data-axis="who"][data-v="stagecoach"]').classList.contains('on') && document.getElementById('cbTheory').value.startsWith('They ran')));
await page.click('#cbRoll');
check('B6 constraint dice are offered for the theory', await G(page, () => document.querySelectorAll('#casebook .die').length === 3));
await page.click('#cbCommit');
const lead = await G(page, () => { const g = window.__gametool; return { stage: g.quest.stage, where: g.quest.theory?.where, who: g.quest.theory?.who, vis: g.questProps.lead.visible, x: g.questProps.lead.position.x }; });
check('B2 committing the theory sets the lead where you said (road)', lead.stage === 'lead' && lead.where === 'road' && lead.who === 'stagecoach' && lead.vis && lead.x === -16, JSON.stringify(lead));
check('B2 Natalie judges it against the clues (all three backed)', await G(page, () => /evidence says/.test(document.querySelector('#casebook .cb-hint').textContent)));
await page.keyboard.press('Escape');
await until(page, () => window.__gametool.state !== 'forge');
await resume();

// ---------- lead + ending ----------
await aimAt('g.questProps.leadHit', 2.2, [1, 0.2]);
check('B2 the blue light offers "Follow the blue light"', await verbIs('Follow the blue light'));
await page.keyboard.press('KeyE');
await until(page, () => window.__gametool.state === 'dialogue');
const find = await G(page, () => window.__gametool.dialogue.text);
await through();
check('B2 the lead finds a friend (the Swordsman, for the road)', /Swordsman/.test(find) && await G(page, () => window.__gametool.quest.stage === 'done'), find.slice(0, 60));
await resume();
await page.keyboard.press('KeyJ');
await until(page, () => window.__gametool.casebook.isOpen);
check('B2 the casebook holds Natalie\'s finished field note, shaped by the theory', await G(page, () => { const t = document.querySelector('#casebook .cb-ending')?.textContent ?? ''; return /The Swordsman is found/.test(t) && /ground shaking/.test(t); }));
await page.click('#cbSubmit');
const th = await G(page, () => decodeURIComponent(document.querySelector('.submit-sheet [data-act=issue]').href));
check('B2 Submit exports the theory as a reply to Natalie\'s field note', th.includes('type: theory') && th.includes('reply_to: "natalies-field-note"') && th.includes('They ran down the road'));
await page.click('.submit-sheet [data-act=close]');
await page.click('#cbClose');
await until(page, () => window.__gametool.state !== 'forge');
await resume();

// ---------- B12 pedlar + folklore ----------
await aimAt('g.pedlarHit', 1.7, [1, 0.4]);
check('B12 Magister Greer (the curio trader) stands by the coach road', await verbIs('Talk to Magister Greer'));
await page.keyboard.press('KeyE');
await until(page, () => window.__gametool.state === 'dialogue');
for (let i = 0; i < 6 && await G(page, () => document.querySelectorAll('#dialogue .d-choice').length === 0); i++) { await page.keyboard.press('Space'); await page.waitForTimeout(150); }
const pch = await G(page, () => [...document.querySelectorAll('#dialogue .d-choice span')].map((s) => s.textContent));
check('B12 the pedlar tells the canon of legendary things you have seen', pch.includes("Tell me about the Archer's Crossbow."), JSON.stringify(pch));
await page.keyboard.press(`Digit${pch.indexOf('I want to tell you about something I found.') + 1}`);
await page.waitForTimeout(150);
await through();
check('B12 "something I found" opens the folklore panel', await until(page, () => window.__gametool.folklore.isOpen && window.__gametool.state === 'forge'));
const items = await G(page, () => [...document.querySelectorAll('#folklore [data-item]')].map((b) => b.textContent + (b.classList.contains('legendary') ? '*' : '')));
check('B12 you can tell stories about legendary items and your clues', items.includes("Archer's Crossbow*") && items.includes('Dropped lantern'), JSON.stringify(items));
check('B12 a legendary item shows its credited canon', await G(page, () => /bit through its string/.test(document.querySelector('#folklore .fl-canon').textContent) && /by Mike/.test(document.querySelector('#folklore .fl-canon cite').textContent)));
await page.fill('#flName', 'Second Thoughts');
await page.fill('#flHistory', 'It has been dropped in three libraries.');
await page.fill('#flRumor', 'It misses on purpose when you lie.');
await page.click('#flSubmit');
const fk = await G(page, () => decodeURIComponent(document.querySelector('.submit-sheet [data-act=issue]').href));
check('B12 Submit exports the item folklore', fk.includes('type: folklore') && fk.includes('item: "crossbow"') && fk.includes('misses on purpose'));
await page.click('.submit-sheet [data-act=close]');
await page.click('#flDone');
check('B12 your names and rumors are saved on this device', await G(page, () => JSON.parse(localStorage.getItem('gametool.folklore')).crossbow?.name === 'Second Thoughts'));
await until(page, () => window.__gametool.state !== 'forge');
await resume();

// ---------- quiet companion ----------
await G(page, () => { const q = document.getElementById('companionQuiet'); q.checked = true; q.dispatchEvent(new Event('change')); });
check('B2 the quiet toggle silences ambient lines', await G(page, () => window.__gametool.companion.say('test line') === false));

// ---------- persistence ----------
const snap = await G(page, () => ({ ...localStorage }));
for (let attempt = 0; attempt < 5; attempt++) {   // docs/assumptions.md #30
  await page.reload();
  await page.waitForFunction(() => window.__gametool);
  const lost = await G(page, (keys) => keys.filter((k) => localStorage.getItem(k) === null), Object.keys(snap));
  if (!lost.length) break;
  await G(page, (s) => { for (const [k, v] of Object.entries(s)) localStorage.setItem(k, v); }, snap);
}
const kept = await G(page, () => { const g = window.__gametool; return { stage: g.quest.stage, clues: g.quest.clues.length, follow: g.companion.prefs.follow, quiet: g.companion.prefs.quiet }; });
check('B2 quest, clues and companion settings come back after a reload', kept.stage === 'done' && kept.clues === 3 && kept.follow && kept.quiet, JSON.stringify(kept));

check('Quest: no console/page errors', errors.length === 0, errors.join(' | '));
await browser.close();
const failed = results.filter((r) => !r.ok).length;
console.log(`\n${results.length - failed}/${results.length} checks passed`);
process.exit(failed ? 1 : 0);
