// G2 (Mike 2026-11-03, graphics batch): thin ink outlines on characters, buildings and props (inverted hull).
// Usage: node test/e2e-ink-lines.mjs [path/to/index.html]   (CHROMIUM_PATH as in e2e.mjs)
import { chromium } from 'playwright-core';
import path from 'node:path';

const file = path.resolve(process.argv[2] ?? 'dist/index.html');
const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH || undefined,
  args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'],
});
const results = [];
const check = (id, ok, detail = '') => { results.push({ id, ok }); console.log(`${ok ? 'PASS' : 'FAIL'}  ${id}${detail ? '  — ' + detail : ''}`); };
const page = await (await browser.newContext({ viewport: { width: 960, height: 540 } })).newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
await page.route(/^https?:/, (r) => r.abort());
await page.goto('file://' + file);
await page.waitForFunction(() => window.__gametool, null, { timeout: 90000 });
await page.waitForTimeout(400);
const box = await page.evaluate(() => ({ def: window.__gametool.settings.inkLines, box: !!document.getElementById('inkLines') }));
check('Ink outlines are on by default, with a Graphics checkbox', box.def === true && box.box, JSON.stringify(box));
await page.click('#begin');
await page.waitForFunction(() => window.__gametool.state === 'play', null, { timeout: 90000 });
await page.waitForTimeout(1500);
const scan = () => page.evaluate(() => {
  const g = window.__gametool, s = g.world.scene; let bodies = 0, lines = 0, statics = 0, visible = true;
  s.traverse((o) => { if (o.name === 'figure-body') bodies++; if (o.name === 'figure-outline') { lines++; visible = visible && o.material.visible; } if (/^outline-(static|camp)$/.test(o.name)) statics++; });
  const lineSkin = []; s.traverse((o) => { if (o.name === 'figure-outline') lineSkin.push(o.skeleton === o.parent.getObjectByName('figure-body')?.skeleton); });
  return { bodies, lines, statics, visible, sameSkeleton: lineSkin.every(Boolean), res: g.outlineUniforms.outlineRes.value.toArray(), calls: g.renderer.info.render.calls };
});
const on = await scan();
check('Every character has an outline on its own skeleton', on.bodies > 5 && on.lines === on.bodies && on.sameSkeleton, JSON.stringify(on));
check('Buildings and props share one outline mesh each (town, camp)', on.statics === 2, JSON.stringify(on));
check('The line width tracks the real drawing-buffer size', on.res[0] > 100 && on.res[1] > 100, JSON.stringify(on.res));
await page.evaluate(() => { document.getElementById('menuBtn')?.click(); });
await page.evaluate(() => { const el = document.getElementById('inkLines'); el.checked = false; el.dispatchEvent(new Event('change')); });
await page.waitForTimeout(800);
const off = await scan();
check('Turning them off hides every outline and saves the setting', !off.visible && (await page.evaluate(() => JSON.parse(localStorage.getItem('gametool.settings') || '{}').inkLines)) === false, JSON.stringify({ visible: off.visible }));
check('No page or shader errors', errors.length === 0, errors.slice(0, 3).join(' | '));
await browser.close();
const failed = results.filter((x) => !x.ok).length;
console.log(`\n${results.length - failed}/${results.length} passed`);
process.exit(failed ? 1 : 0);
