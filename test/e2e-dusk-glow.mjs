// G3 (Mike 2026-11-03, graphics batch): warm window glow and lantern light from dusk. (Characters already take the
// lantern light since B43 / PR #63, so this adds the window glows and turns the real lantern lights on at dusk.)
// Usage: node test/e2e-dusk-glow.mjs [path/to/index.html]   (CHROMIUM_PATH as in e2e.mjs)
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
await page.click('#begin');
await page.waitForFunction(() => window.__gametool.state === 'play', null, { timeout: 90000 });
async function at(t) {
  await page.evaluate((t) => { const g = window.__gametool; g.world.setTime(t); g.nightLights.setTime(t); }, t);
  await page.waitForTimeout(1200);
  return page.evaluate(() => { const n = window.__gametool.nightLights, w = n.windowHalos;
    return { spots: n.windowSpots.length, count: w.count, on: w.visible, op: w.material.opacity, lit: n.lit, lamp: n.halos.material.opacity, power: +Math.max(0, ...n.lights.map((l) => l.intensity)).toFixed(2) }; });
}
const day = await at('day'), dusk = await at('sunset'), night = await at('night');
check('Every lit window has a glow spot', day.spots >= 8 && day.count === day.spots, JSON.stringify(day));
check('Day: no glows, no lantern lights', !day.on && day.lit === 0, JSON.stringify(day));
check('Dusk: windows glow and the real lantern lights come on, softer than night', dusk.on && dusk.op > 0.2 && dusk.lit > 0 && dusk.power > 0 && dusk.power < 4, JSON.stringify(dusk));
check('Night: brighter glows and full lantern light', night.on && night.op > dusk.op && night.lamp > dusk.lamp && night.power > dusk.power, JSON.stringify(night));
check('No page or shader errors', errors.length === 0, errors.slice(0, 3).join(' | '));
await browser.close();
const failed = results.filter((x) => !x.ok).length;
console.log(`\n${results.length - failed}/${results.length} passed`);
process.exit(failed ? 1 : 0);
