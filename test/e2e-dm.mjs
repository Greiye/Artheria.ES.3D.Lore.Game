// B20 (Mike 2026-11-01): the DM view. ?dm opens it behind a passphrase; a map with pins over the town plan, and a
// quest/dialogue graph that loads the game's own dialogue and exports in its format. Saved on the device, not in a profile.
// Usage: node test/e2e-dm.mjs [path/to/index.html]   (CHROMIUM_PATH as in e2e.mjs)
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
const check = (id, ok, detail = '') => { results.push({ id, ok }); console.log(`${ok ? 'PASS' : 'FAIL'}  ${id}${detail ? '  — ' + detail : ''}`); };
const G = (page, fn, arg) => page.evaluate(fn, arg);

const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 } });
const page = await ctx.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
await page.route(/^https?:/, (r) => r.abort());

// Without ?dm there is no DM view at all.
await page.goto('file://' + file);
await page.waitForFunction(() => window.__gametool);
check('Without ?dm the game has no DM view', await G(page, () => window.__gametool.dm === null && !document.querySelector('#dmView')));

await page.goto('file://' + file + '?dm');
await page.waitForFunction(() => window.__gametool?.dm);
check('?dm opens the DM view over the game, at a passphrase gate', await G(page, () => window.__gametool.dm.isOpen && !!document.querySelector('#dmView #dmPhrase') && !document.querySelector('#dmCanvas')));
await page.fill('#dmPhrase', 'goblins');
await page.click('#dmUnlock');
await page.waitForTimeout(200);
check('A wrong phrase stays locked', await G(page, () => !window.__gametool.dm.unlocked && /isn't it/.test(document.querySelector('#dmMsg').textContent)));
const src = fs.readFileSync(file, 'utf8');
check('The passphrase itself is not in the build (only its hash)', !/ink before iron/i.test(src));
await page.fill('#dmPhrase', '  Ink Before Iron ');
await page.click('#dmUnlock');
await page.waitForFunction(() => !!document.querySelector('#dmCanvas'));
check('The right phrase (any case, trimmed) opens the map', await G(page, () => window.__gametool.dm.unlocked && window.__gametool.dm.tab === 'map'));
check('The plan shows the library, the town buildings and the fountain', await G(page, () => { const p = window.__gametool.dm.places(); return p.length >= 10 && p.some((x) => /Smithy/i.test(x.label)) && p.some((x) => x.label === 'Fountain'); }));

// Pins.
const box = await page.locator('#dmCanvas').boundingBox();
await page.mouse.click(box.x + box.width * 0.5, box.y + box.height * 0.3);
const p1 = await G(page, () => window.__gametool.dm.st.pins[0]);
check('Clicking the plan drops an NPC pin at that world spot', p1?.kind === 'npc' && Math.abs(p1.x) < 1 && Math.abs(p1.z + 20) < 1, JSON.stringify(p1));
await page.fill('[data-f="pin.label"]', 'Kavik');
await page.fill('[data-f="pin.notes"]', 'Waits by the dojo at dusk.');
await page.click('#dmView [data-kind="dungeon"]');
await page.mouse.click(box.x + box.width * 0.7, box.y + box.height * 0.6);
const pins = await G(page, () => window.__gametool.dm.st.pins);
check('Pins can be labelled and noted; a dungeon pin gets a seed', pins.length === 2 && pins[0].label === 'Kavik' && /dusk/.test(pins[0].notes) && pins[1].kind === 'dungeon' && pins[1].seed > 0, JSON.stringify(pins));
await page.screenshot({ path: path.join(shots, 'b20-map.png') });

// Quest graph.
await page.click('#dmView [data-tab="graph"]');
check('Quest graph tab starts with one node', await G(page, () => document.querySelectorAll('#dmView .dm-node').length === 1));
await page.selectOption('#dmScript', 'natalie');
await page.click('#dmLoad');
const loaded = await G(page, () => { const d = window.__gametool.dm; return { id: d.graph.id, n: Object.keys(d.graph.nodes).length, dom: document.querySelectorAll('#dmView .dm-node').length, edges: document.querySelectorAll('#dmEdges path.dm-edge').length }; });
check("Natalie's dialogue loads from the game as a graph, with its links drawn", loaded.id === 'natalie' && loaded.n > 1 && loaded.dom === loaded.n && loaded.edges > 0, JSON.stringify(loaded));
await page.screenshot({ path: path.join(shots, 'b20-graph.png') });
const round = await G(page, () => { const d = window.__gametool.dm, a = JSON.stringify(d.scripts().natalie.nodes[d.scripts().natalie.start].text); return a === JSON.stringify(JSON.parse(d.exportJson()).dialogue.natalie.nodes[d.graph.start].text); });
check('Export writes it back in the game dialogue format', round);

await page.click('#dmNewGraph');
await page.click('#dmView .dm-node[data-node="n1"]');
await page.click('#dmAddNode');
await page.fill('[data-f="node.text"]', 'Bring me the red book.');
await G(page, () => window.__gametool.dm.selNode = 'n1');
await G(page, () => window.__gametool.dm.render());
await page.click('#dmAddChoice');
await page.fill('[data-f="node.choice.0.text"]', 'I will.');
await page.fill('[data-f="node.choice.0.if"]', 'has:crossbow');
await page.selectOption('[data-f="node.choice.0.next"]', 'n2');
await G(page, () => window.__gametool.dm.selNode = 'n2');
await G(page, () => window.__gametool.dm.render());
await page.fill('[data-f="node.actions"]', 'give:sword:1\nquest:start');
const out = await G(page, () => { const d = window.__gametool.dm; return JSON.parse(d.exportJson()).dialogue[d.graph.id]; });
check('Build a quest: a choice with a condition leads to a node with actions', out?.nodes.n1.choices?.[0]?.next === 'n2' && out.nodes.n1.choices[0].if === 'has:crossbow' && out.nodes.n2.actions.join() === 'give:sword:1,quest:start' && out.nodes.n2.end === true, JSON.stringify(out));
check('Conditional links draw dashed', await G(page, () => document.querySelectorAll('#dmEdges path.dm-edge.cond').length === 1));

// Saved on device, not in a profile; import round-trip.
check('Saved on this device outside the player profiles (gametool~dm)', await G(page, () => { const v = JSON.parse(localStorage.getItem('gametool~dm')); return v.pins.length === 2 && v.graphs.length === 3; }));
const imp = await G(page, () => { const d = window.__gametool.dm, j = d.exportJson(); d.st.pins = []; return d.importJson(j) && d.st.pins.length === 2 && !d.importJson('{"nope":1}'); });
check('Import restores an export and refuses other files', imp);
await page.click('#dmView #dmClose');
check('"Back to the game" closes it', await G(page, () => !window.__gametool.dm.isOpen));
await page.reload();
await page.waitForFunction(() => window.__gametool?.dm);
check('Unlocked for the rest of the session', await G(page, () => window.__gametool.dm.unlocked && !!document.querySelector('#dmCanvas')));
check('No console / page errors', errors.length === 0, errors.join(' | '));

await browser.close();
const passed = results.filter((r) => r.ok).length;
console.log(`\n${passed}/${results.length} checks passed`);
process.exit(passed === results.length ? 0 : 1);
