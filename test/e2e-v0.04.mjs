// Automated Done-when checks for v0.04 (§8): F3 dialogue + inventory, and its creativity check
// (Natalie's "I don't know what to make" gives a §6.3 prompt and still hands over the crossbow).
// Usage: npm run build && node test/e2e-v0.04.mjs [path/to/index.html]
import { chromium } from 'playwright-core';
import fs from 'node:fs';
import path from 'node:path';

const file = path.resolve(process.argv[2] ?? 'dist/index.html');
const shots = path.resolve(process.env.SHOTS_DIR ?? 'test/screenshots');
fs.mkdirSync(shots, { recursive: true });
const p = JSON.parse(fs.readFileSync(path.resolve('content/rolltables/creation-prompts.json'), 'utf8'));
const allPrompts = [...p.lore, ...p.character, ...p.song_food_art];

const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH || undefined,
  args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'],
});
const results = [];
const check = (id, ok, detail = '') => { results.push({ id, ok }); console.log(`${ok ? 'PASS' : 'FAIL'}  ${id}${detail ? '  — ' + detail : ''}`); };
const G = (page, fn, arg) => page.evaluate(fn, arg);

async function newPage() {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  await ctx.addInitScript(() => localStorage.setItem('gametool.character', JSON.stringify({ name: 'Test', motivation: '', secret: '', created: true })));
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  await page.route(/^https?:/, (r) => r.abort());
  await page.goto('file://' + file);
  await page.waitForFunction(() => window.__gametool);
  await page.click('#begin');
  await page.waitForFunction(() => window.__gametool.state === 'play', null, { timeout: 5000 });
  return { page, errors };
}
// Stand in front of Natalie, facing her.
const faceNatalie = (page) => G(page, () => {
  const g = window.__gametool, n = g.world.natalieTarget.position, pl = g.player;
  pl.pos.set(n.x + 0.2, 0, n.z + 1.4);
  pl.yaw = Math.atan2(-(n.x - pl.pos.x), -(n.z - pl.pos.z)); pl.pitch = -0.15;
});
const waitTyped = (page) => page.waitForFunction(() => !window.__gametool.dialogue.typing, null, { timeout: 8000 });
const node = (page) => G(page, () => window.__gametool.dialogue.currentId);

// ---------- Path A: "Is it dangerous?" ----------
{
  const { page, errors } = await newPage();
  await faceNatalie(page);
  await page.waitForTimeout(300);
  const prompt = await G(page, () => ({ shown: !document.getElementById('prompt').classList.contains('hidden'), verb: document.getElementById('promptVerb').textContent }));
  check('F3: aiming at Natalie shows "E — Talk to Natalie"', prompt.shown && prompt.verb === 'Talk to Natalie', JSON.stringify(prompt));
  const before = await G(page, () => window.__gametool.player.pos.clone());
  await page.keyboard.press('KeyE');
  await page.waitForFunction(() => window.__gametool.state === 'dialogue', null, { timeout: 3000 });
  await page.waitForTimeout(250);
  const box = await G(page, () => { const r = document.getElementById('dialogue').getBoundingClientRect(); return { bottom: innerHeight - r.bottom, name: document.querySelector('#dialogue .d-name').textContent }; });
  check('F3.1 bottom panel with name tag', box.bottom < 80 && box.name === 'Natalie Bourbon', JSON.stringify(box));
  // F3.3 frees pointer, freezes movement
  await page.keyboard.down('KeyW'); await page.waitForTimeout(400); await page.keyboard.up('KeyW');
  const after = await G(page, () => window.__gametool.player.pos.clone());
  check('F3.3 dialogue frees the pointer and freezes movement', after.x === before.x && after.z === before.z && !(await G(page, () => !!document.pointerLockElement)));
  // Advance to n2 (a 78-character line), then: first Space completes the line, the node stays n2.
  for (let i = 0; i < 3 && (await node(page)) !== 'n2'; i++) { await page.keyboard.press('Space'); await page.waitForTimeout(30); }
  const mid = await G(page, () => { const d = window.__gametool.dialogue; return { typing: d.typing, shown: d.shown, secs: (performance.now() - d.startedAt) / 1000 }; });
  // F3.1 rate: characters shown per second of real time (measured in the page, not by the test's clock).
  if (mid.typing) {
    await page.keyboard.press('Space');
    const full = await G(page, () => { const d = window.__gametool.dialogue; return !d.typing && document.querySelector('#dialogue .d-text').textContent === d.text && d.currentId === 'n2'; });
    check('F3.1 Space completes the line first (stays on the node)', full);
  } else console.log(`SKIP  F3.1 Space-completes check: this machine rendered too slowly to catch n2 mid-line (${mid.secs.toFixed(2)} s)`);
  check('F3.1 Space advances n1 -> n2', (await node(page)) === 'n2');
  const choices = await G(page, () => [...document.querySelectorAll('#dialogue .d-choice span')].map((s) => s.textContent));
  check('F3.2 n2 shows three choice buttons', choices.length === 3, choices.join(' | '));
  await page.screenshot({ path: path.join(shots, 'v04-dialogue-choices.png') });
  await page.keyboard.press('Space');
  check('F3.2 advance is ignored while choices are up', (await node(page)) === 'n2');
  await page.click('#dialogue .d-choice >> nth=0');            // "Is it dangerous?" -> n3
  await waitTyped(page);
  check('F3.2 choice 1 changes the next node (n3)', (await node(page)) === 'n3');
  await page.mouse.click(640, 740);                            // LMB on the box advances
  await waitTyped(page);
  check('F3.1 LMB advances (n3 -> n4)', (await node(page)) === 'n4');
  const inv = await G(page, () => ({ crossbow: window.__gametool.inventory.count('crossbow'), bolt: window.__gametool.inventory.count('bolt'), door: window.__gametool.world.doorOpen }));
  check('F3.4 give:crossbow:1 + give:bolt:10 + unlock:library_door', inv.crossbow === 1 && inv.bolt === 10 && inv.door, JSON.stringify(inv));
  for (let i = 0; i < 4 && await G(page, () => window.__gametool.state === 'dialogue'); i++) { await page.keyboard.press('KeyE'); await page.waitForTimeout(150); }
  check('F3.1 Natalie script completes and play resumes', ['play', 'resume'].includes(await G(page, () => window.__gametool.state)));
  if (await G(page, () => window.__gametool.state === 'resume')) await page.click('#relockBtn');
  // Talking again does not duplicate items.
  await faceNatalie(page); await page.waitForTimeout(200);
  await page.keyboard.press('KeyE');
  await page.waitForFunction(() => window.__gametool.state === 'dialogue');
  for (let i = 0; i < 6 && (await node(page)) !== 'n2'; i++) { await page.keyboard.press('Space'); await page.waitForTimeout(150); }
  await waitTyped(page);
  await page.keyboard.press('Digit2');                         // "I'll find them." -> n4
  await page.waitForTimeout(100);
  check('F3.2 number keys pick a choice (2 -> n4)', (await node(page)) === 'n4');
  for (let i = 0; i < 6 && await G(page, () => window.__gametool.state === 'dialogue'); i++) { await page.keyboard.press('Space'); await page.waitForTimeout(150); }
  check('F3.4 talking again does not duplicate items', await G(page, () => window.__gametool.inventory.count('crossbow') === 1 && window.__gametool.inventory.count('bolt') === 10));
  if (await G(page, () => window.__gametool.state === 'resume')) await page.click('#relockBtn');
  await page.waitForFunction(() => window.__gametool.state === 'play', null, { timeout: 8000 });
  // F3.4 inventory (I)
  await page.keyboard.press('KeyI');
  await page.waitForFunction(() => window.__gametool.state === 'inventory', null, { timeout: 3000 });
  const cells = await G(page, () => [...document.querySelectorAll('#inventory .inv-cell')].map((c) => c.querySelector('.inv-name').textContent + ' ' + c.querySelector('.inv-count').textContent));
  check('F3.4 I opens a grid with name + count', cells.includes("Scout's Crossbow × 1") && cells.includes('Crossbow Bolt × 10'), cells.join(' | '));
  await page.screenshot({ path: path.join(shots, 'v04-inventory.png') });
  await page.keyboard.press('KeyI');
  await page.waitForFunction(() => window.__gametool.state !== 'inventory', null, { timeout: 3000 });
  if (await G(page, () => window.__gametool.state === 'resume')) await page.click('#relockBtn');
  // The door is open: walk through it into the library.
  await page.waitForTimeout(1200);
  await G(page, () => { const pl = window.__gametool.player; pl.pos.set(0, 0, -14); pl.yaw = 0; pl.pitch = 0; });
  await page.keyboard.down('KeyW'); await page.waitForTimeout(1600); await page.keyboard.up('KeyW');
  const z = await G(page, () => window.__gametool.player.pos.z);
  check('F3.4 door opens: the player can walk into the library', z < -20, `z ${z.toFixed(2)}`);
  check('v0.04 path A: no console/page errors', errors.length === 0, errors.join(' | '));
  await page.context().close();
}

// ---------- Path B: creativity check ----------
{
  const { page, errors } = await newPage();
  await faceNatalie(page); await page.waitForTimeout(250);
  await page.keyboard.press('KeyE');
  await page.waitForFunction(() => window.__gametool.state === 'dialogue');
  await page.keyboard.press('Space'); await page.keyboard.press('Space');
  await waitTyped(page);
  await page.keyboard.press('Digit3');                         // "I don't know what to make." -> n5
  await waitTyped(page);
  const said = await G(page, () => window.__gametool.dialogue.text);
  const ok = said.startsWith('Try this: ') && allPrompts.includes(said.slice('Try this: '.length));
  check('0.04 creativity: "I don\'t know what to make" gives a §6.3 prompt', (await node(page)) === 'n5' && ok, said);
  await page.keyboard.press('Space');
  await waitTyped(page);
  check('0.04 creativity: ...and still receives the crossbow (n5 -> n4)', (await node(page)) === 'n4' && await G(page, () => window.__gametool.inventory.count('crossbow') === 1));
  // F3.1 typewriter rate, measured inside the page on a long synthetic line (independent of frame rate).
  const rate = await G(page, async () => {
    const d = window.__gametool.dialogue;
    d.start({ speaker: 'Test', start: 'a', nodes: { a: { text: 'x'.repeat(400), end: true } } });
    const t0 = performance.now();
    await new Promise((r) => setTimeout(r, 1500));
    const out = { shown: document.querySelector('#dialogue .d-text').textContent.length, secs: (performance.now() - t0) / 1000 };
    d.advance(); d.advance();
    return out;
  });
  check('F3.1 typewriter ~40 ch/s', rate.shown / rate.secs > 32 && rate.shown / rate.secs < 48, `${rate.shown} chars in ${rate.secs.toFixed(2)} s`);
  check('v0.04 path B: no console/page errors', errors.length === 0, errors.join(' | '));
}

await browser.close();
const failed = results.filter((r) => !r.ok).length;
console.log(`\n${results.length - failed}/${results.length} checks passed`);
process.exit(failed ? 1 : 0);
