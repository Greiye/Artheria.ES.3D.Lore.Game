// Mike 2026-11-05: the weapon forge customises the sword too (blade, guard, pommel, colours, engraving, name, legend),
// and the weapon being forged shows large in the middle of the free screen, not over the anvil. Drag or arrows turn it.
// Usage: node test/e2e-sword-forge.mjs [path/to/index.html]   (CHROMIUM_PATH as in e2e.mjs)
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

await G(() => { const g = window.__gametool; g.inventory.give('crossbow', 1); g.inventory.give('sword', 1); g.openWeaponForge(); });
await page.waitForFunction(() => window.__gametool.weaponForge.isOpen, null, { timeout: 8000 });
await frames(6);
const pv = await G(() => { const g = window.__gametool, p = g.forgePreview; return { active: p.active, inScene: !!g.weaponDisplay.parent && g.weaponDisplay.parent === p.scene, kids: g.weaponDisplay.children[0].children.length }; });
check('The crossbow shows in the forge preview, its own scene (not over the anvil)', pv.active && pv.inScene && pv.kids === 1, JSON.stringify(pv));
await page.screenshot({ path: path.join(shots, 'forge-crossbow-centre.png') });
// Drag turns it; arrows too.
const r0 = await G(() => window.__gametool.weaponDisplay.rotation.y);
await page.mouse.move(400, 400); await page.mouse.down(); await page.mouse.move(520, 400, { steps: 4 }); await page.mouse.up();
await page.keyboard.press('ArrowRight');
const r1 = await G(() => window.__gametool.weaponDisplay.rotation.y);
check('Dragging and the arrow keys turn it', r1 - r0 > 1, `${r0.toFixed(2)} → ${r1.toFixed(2)}`);

// The Sword tab.
await page.click('#weaponForge [data-kind="sword"]');
await frames(3);
check('A Sword tab: blade, hilt and story', await G(() => { const t = document.querySelector('#weaponForge .forge-panel').textContent; return /Blade/.test(t) && /Guard/.test(t) && /Pommel/.test(t) && /Grip wrap/.test(t); }));
// The panel may split into fit-panel tabs, so set the parts through the forge (a chip click calls the same set()).
await G(() => { const f = window.__gametool.weaponForge; f.set('blade', 'broad'); f.set('guard', 'swept'); f.set('pommel', 'ring'); });
await G(() => { const s = (id, v) => { const e = document.getElementById(id); e.value = v; e.dispatchEvent(new Event('change')); }; s('wfName', 'Last Word'); s('wfEngrave', 'Not today'); });
await frames(4);
await page.screenshot({ path: path.join(shots, 'forge-sword-centre.png') });
await G(() => document.getElementById('wfDone').click());
await page.waitForFunction(() => window.__gametool.state === 'play', null, { timeout: 8000 }).catch(() => {});
const look = await G(() => { const g = window.__gametool; return { look: g.sword.look, saved: JSON.parse(localStorage.getItem('gametool.forge.sword') || '{}'), pv: g.forgePreview.active, eng: !!g.sword.held.getObjectByName('engraving') }; });
check('Done: the sword in hand takes the new look (and it is saved)', look.look.blade === 'broad' && look.look.guard === 'swept' && look.look.pommel === 'ring' && look.saved.name === 'Last Word' && look.eng && !look.pv, JSON.stringify(look));
check('No page errors', errors.length === 0, errors.slice(0, 3).join(' | '));

await browser.close();
const failed = results.filter((r) => !r.ok).length;
console.log(`\n${results.length - failed}/${results.length} passed`);
process.exit(failed ? 1 : 0);
