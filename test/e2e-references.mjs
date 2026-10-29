// References review (docs references-review-2026-10-29.md, Mike: "implement references into the game tool"): eye + mouth
// strip faces with six expressions, goblins on one swatch atlas, the Willowbrook-style town (river, bridges, windmill,
// fountain, spire, seven colours), the mobile budget (≤5k tris a character, ≤512² textures) and auto quality.
// Usage: npm run build && node test/e2e-references.mjs [path/to/index.html]
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
const sim = async (page, s) => { const t0 = await G(page, () => window.__gametool.perf.simSeconds); return until(page, ([t0, s]) => window.__gametool.perf.simSeconds > t0 + s, [t0, s], 90000); };

const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 } });
await ctx.addInitScript(() => localStorage.setItem('gametool.character', JSON.stringify({ name: 'Test', motivation: '', secret: '', created: true })));
const page = await ctx.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
await page.goto('file://' + file + '?bestiary');
await page.waitForFunction(() => window.__gametool, null, { timeout: 90000 });
await page.click('#begin'); await page.mouse.move(5, 5);
await page.waitForFunction(() => window.__gametool.state === 'play', null, { timeout: 8000 });

// ---------- Faces: eye strip + mouth strip, six expressions ----------
// A goblin (its face is the generated sheet, with every state; Mike's drawn sheets fall back to neutral for some).
// Sampled three times, keeping the reading seen twice, so a blink mid-read can't skew it.
const face = async (expr) => {
  await G(page, (e) => { window.__gametool.goblins.list[0].root.userData.expression = e; }, expr);
  await until(page, (e) => { const g = window.__gametool; return g.figureKit.faceExpression(g.goblins.list[0].root) === e; }, expr, 5000);
  const reads = [];
  for (let i = 0; i < 3; i++) {
    reads.push(await G(page, () => [...window.__gametool.goblins.list[0].root.userData.face.geometry.attributes.uv.array].map((v) => v.toFixed(4))));
    await page.waitForTimeout(150);
  }
  return reads.find((r, i) => reads.some((q, j) => j !== i && q.join() === r.join())) ?? reads[0];
};
const EXPR = ['neutral', 'happy', 'angry', 'surprised', 'sad', 'wink'];
const uvs = {};
for (const e of EXPR) uvs[e] = await face(e);
const eyes = (u) => u?.slice(0, 8).join(), mouth = (u) => u?.slice(8, 16).join();
check('Faces are two strips (eyes over mouth): 8 UV corners on the face quad', uvs.neutral?.length === 16, String(uvs.neutral?.length));
check('Six expressions, each a distinct eye + mouth pair', new Set(EXPR.map((e) => eyes(uvs[e]) + '|' + mouth(uvs[e]))).size === 6);
check('Strips swap on their own (happy and wink share the smile, differ in the eyes)', mouth(uvs.happy) === mouth(uvs.wink) && eyes(uvs.happy) !== eyes(uvs.wink));
await G(page, () => { delete window.__gametool.goblins.list[0].root.userData.expression; });

// ---------- Goblins: one swatch atlas ----------
const gob = await G(page, () => { const g = window.__gametool, maps = new Map();
  for (const f of g.goblins.list) f.root.traverse((o) => { if (o.name === 'figure-body') maps.set(o.material.map.uuid, o.material.map.image.width); });
  return { n: g.goblins.list.length, maps: [...maps.values()] }; });
check('Every goblin paints from one shared swatch atlas (≤256²)', gob.n >= 6 && gob.maps.length === 1 && gob.maps[0] <= 256, JSON.stringify(gob));

// ---------- The town ----------
const town = await G(page, () => { const g = window.__gametool, w = g.world, n = (name) => { let k = 0; w.scene.traverse((o) => { if (o.name === name) k++; }); return k; };
  return { river: n('river'), bank: n('river-bank'), fountain: n('fountain-water'), sails: n('windmill-sails'), sail0: w.river.sails.rotation.x, zones: g.ambience.zones.filter((z) => z.kind === 'water').map((z) => z.name) }; });
check('A river with muddy banks, a fountain on the plaza and a windmill', town.river === 1 && town.bank === 1 && town.fountain === 3 && town.sails === 1, JSON.stringify(town));
check('Water ambience at the fountain and both bridges', town.zones.includes('fountain') && town.zones.filter((z) => z.startsWith('river:')).length === 2, town.zones.join());
await sim(page, 1);
const sail1 = await G(page, () => window.__gametool.world.river.sails.rotation.x);
check('The windmill turns', sail1 !== town.sail0);
// Walk west at the river away from a bridge: the water stops you. Walk west on the coach road: the bridge takes you over.
const walkWest = async (z) => {
  await G(page, (z) => { const g = window.__gametool; g.player.spawn(new g.Vector3(-26, 0, z), Math.PI / 2); }, z);   // yaw π/2 faces -X (west)
  await G(page, () => { const g = window.__gametool; g.player.analog.x = 0; g.player.analog.y = 1; });
  await sim(page, 4);
  const x = await G(page, () => { const g = window.__gametool; g.player.analog.x = 0; g.player.analog.y = 0; return g.player.pos.x; });
  return x;
};
const atBank = await walkWest(10), overBridge = await walkWest(-4);
check('The river blocks the way, the stone bridge crosses it', atBank > -30 && overBridge < -34, JSON.stringify({ atBank, overBridge }));

// ---------- Mobile budget ----------
const budget = await G(page, () => { const g = window.__gametool, over = [], big = [];
  const tri = (o) => { let n = 0; o.traverse((m) => { if (m.isMesh) { const q = m.geometry; n += (q.index ? q.index.count : q.attributes.position.count) / 3; } }); return n; };
  let figs = 0;
  g.world.scene.traverse((o) => { if (o.userData.rig) { figs++; const n = tri(o); if (n > 5000) over.push(o.name + ':' + n); } });
  const K = g.figureKit, worst = tri(K.buildFigure({ skin: '#F0C8A0', hair: '#6B3E22', primary: '#3E6FA8', secondary: '#7FA8D0', boots: '#2E4A6E', accent: '#F2C94C', hairStyle: 'flowing', dress: true, wings: '#111', headpiece: '#222' }, 1.75));
  if (worst > 5000) over.push('worst:' + worst);
  const seen = new Set();
  g.world.scene.traverse((o) => { for (const m of o.material ? [].concat(o.material) : []) for (const k of Object.keys(m)) { const t = m[k]; if (t?.isTexture && t.image && !seen.has(t.uuid)) { seen.add(t.uuid); const w = t.image.width || t.image.videoWidth, h = t.image.height || t.image.videoHeight; if (w > 512 || h > 512) big.push(`${o.name}.${k} ${w}x${h}`); } } });
  return { figs, over, big, textures: seen.size }; });
check('Every character is ≤5k triangles (the fullest heroine too)', budget.figs > 20 && budget.over.length === 0, JSON.stringify(budget.over));
check('Every texture in the world is ≤512²', budget.textures > 20 && budget.big.length === 0, budget.big.join(' | '));

// ---------- Auto quality ----------
const aq = await G(page, () => { const g = window.__gametool, A = g.autoQ, out = { off: !A.enabled };
  A.enabled = true; A.set(0);
  const pr0 = g.renderer.getPixelRatio();
  for (let i = 0; i < 50; i++) A.frame(50, 60);   // 2.5 s at 20 fps against a 60 target
  out.down = A.level; out.pr = g.renderer.getPixelRatio() < pr0;
  for (let i = 0; i < 800; i++) A.frame(12, 60);   // 9.6 s of headroom
  out.up = A.level;
  A.set(0); A.enabled = false; out.pr0 = g.renderer.getPixelRatio() === pr0;
  return out; });
check('Auto quality is off in test browsers unless asked', aq.off);
check('Auto quality steps down when frames run long (lower render scale) and back up with headroom', aq.down >= 1 && aq.pr && aq.up < aq.down && aq.pr0, JSON.stringify(aq));
const menu = await G(page, () => !!document.getElementById('autoQuality'));
check('Graphics settings have an Auto quality switch', menu);

check('No page errors', errors.length === 0, errors.slice(0, 3).join(' | '));
await browser.close();
const failed = results.filter((r) => !r.ok).length;
console.log(`\n${results.length - failed}/${results.length} checks passed`);
process.exit(failed ? 1 : 0);
