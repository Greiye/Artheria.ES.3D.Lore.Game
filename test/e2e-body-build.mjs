// B46 (Mike 2026-11-04): body build from attributes. Strength 20 looks like a bodybuilder, strength 2 frail and
// skinny; endurance thickens the torso. Sliders at the Tailor (Body tab); townsfolk roll their own.
// Usage: node test/e2e-body-build.mjs [path/to/index.html]   (CHROMIUM_PATH as in e2e.mjs)
import { chromium } from 'playwright-core';
import path from 'node:path';

const file = path.resolve(process.argv[2] ?? 'dist/index.html');
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const results = [];
const check = (id, ok, detail = '') => { results.push({ id, ok }); console.log(`${ok ? 'PASS' : 'FAIL'}  ${id}${detail ? '  — ' + detail : ''}`); };
const page = await (await browser.newContext({ viewport: { width: 1100, height: 680 } })).newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
await page.route(/^https?:/, (r) => r.abort());
await page.goto('file://' + file, { timeout: 180000 });
await page.waitForFunction(() => window.__gametool, null, { timeout: 180000 });
await page.waitForTimeout(300);
await page.evaluate(() => document.querySelector('#begin').click());
await page.waitForFunction(() => window.__gametool.state === 'play', null, { timeout: 180000 });

// Measure a figure built at each strength: shoulder width, upper-arm girth, chest depth.
const m = await page.evaluate(() => {
  const g = window.__gametool, base = { skin: '#E0B890', hair: '#3A2A1E', primary: '#4A5A3A', secondary: '#C9B48A', boots: '#3A2A1E', hairStyle: 'short' };
  // The body's own skinned mesh (the face plane and props are separate meshes); measured at chest height.
  const size = (look) => { const f = g.figureKit.buildFigure(look, 1.75), geo = f.userData.rig.mesh.geometry, p = geo.attributes.position;
    let x0 = 1e9, x1 = -1e9, z0 = 1e9, z1 = -1e9;
    for (let i = 0; i < p.count; i++) { const y = p.getY(i); if (y < 1.0 || y > 1.45) continue; x0 = Math.min(x0, p.getX(i)); x1 = Math.max(x1, p.getX(i)); z0 = Math.min(z0, p.getZ(i)); z1 = Math.max(z1, p.getZ(i)); }
    return { w: +(x1 - x0).toFixed(3), d: +(z1 - z0).toFixed(3) }; };
  return { s2: size({ ...base, strength: 2 }), s10: size({ ...base, strength: 10 }), s20: size({ ...base, strength: 20 }),
    e2: size({ ...base, endurance: 2 }), e20: size({ ...base, endurance: 20 }), none: size(base) };
});
check('Strength 20 is much broader than 10, and 2 much narrower', m.s20.w > m.s10.w * 1.12 && m.s2.w < m.s10.w * 0.95, JSON.stringify(m));
check('Strength 10 is the same as no strength set (old saves unchanged)', m.s10.w === m.none.w && m.s10.d === m.none.d);
check('Endurance thickens the body front to back', m.e20.d > m.e2.d * 1.05, JSON.stringify({ e2: m.e2, e20: m.e20 }));

// The Tailor's Body tab has the sliders, and they change your figure.
await page.evaluate(() => window.__gametool.openCharacterForge());
await page.waitForTimeout(400);
const sliders = await page.evaluate(() => ({ s: !!document.querySelector('#fgStrength'), e: !!document.querySelector('#fgEndurance') }));
check('Tailor: Strength and Endurance sliders on the Body tab', sliders.s && sliders.e, JSON.stringify(sliders));
const w = await page.evaluate(() => { const g = window.__gametool, widthOf = () => { const p = g.player.body.children[0].userData.rig.mesh.geometry.attributes.position; let a = 1e9, b = -1e9;
    for (let i = 0; i < p.count; i++) { const y = p.getY(i); if (y < 1.0 || y > 1.45) continue; a = Math.min(a, p.getX(i)); b = Math.max(b, p.getX(i)); } return b - a; };
  g.characterForge.set('wings', undefined);   // the default heroine's wings are wider than her shoulders
  g.characterForge.set('strength', 20); const strong = widthOf(); g.characterForge.set('strength', 2); const frail = widthOf();
  return { strong: +strong.toFixed(3), frail: +frail.toFixed(3), word: document.querySelector('#fgStrength')?.nextElementSibling?.textContent }; });
check('Tailor: the slider reshapes your character live', w.strong > w.frail * 1.2 && /frail/.test(w.word ?? ''), JSON.stringify(w));

// Townsfolk roll their own attributes: not all the same, mostly near average.
const folk = await page.evaluate(() => window.__gametool.townsfolk.folk.map((f) => f.root.userData.look?.strength ?? null));
const rolled = await page.evaluate(() => { const vals = []; for (let s = 1; s <= 200; s++) vals.push(window.__gametool.traits.rollTownsfolkLook?.(s)?.strength); return vals; });
const vals = rolled.filter((v) => typeof v === 'number');
const mid = vals.filter((v) => v >= 6 && v <= 14).length / Math.max(1, vals.length);
check('Townsfolk: strengths vary, most near average', vals.length === 200 && new Set(vals).size >= 6 && mid > 0.6 && vals.every((v) => v >= 1 && v <= 20), JSON.stringify({ n: vals.length, distinct: new Set(vals).size, mid: +mid.toFixed(2), folk: folk.slice(0, 4) }));
check('No page errors', errors.length === 0, errors.slice(0, 3).join(' | '));
await browser.close();
const passed = results.filter((r) => r.ok).length;
console.log(`\n${passed}/${results.length} checks passed`);
process.exit(passed === results.length ? 0 : 1);
