// B38 (Mike 2026-11-03): iPhone performance pass. iPhones start on a Low power preset; characters off-screen or
// past the fog aren't drawn or animated; ?perf shows a frame-time readout for measuring on a real phone.
// Usage: node test/e2e-lowpower.mjs [path/to/index.html]   (CHROMIUM_PATH as in e2e.mjs)
import { chromium, devices } from 'playwright-core';
import path from 'node:path';

const file = path.resolve(process.argv[2] ?? 'dist/index.html');
const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH || undefined,
  args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'],
});
const results = [];
const check = (id, ok, detail = '') => { results.push({ id, ok }); console.log(`${ok ? 'PASS' : 'FAIL'}  ${id}${detail ? '  — ' + detail : ''}`); };
const G = (page, fn, arg) => page.evaluate(fn, arg);
async function open(opts, query = '') {
  const ctx = await browser.newContext(opts);
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  await page.route(/^https?:/, (r) => r.abort());
  await page.goto('file://' + file + query);
  await page.waitForFunction(() => window.__gametool, null, { timeout: 90000 });
  await page.waitForTimeout(400);
  return { ctx, page, errors };
}

// ---------- iPhone: Low power by default ----------
{
  const { ctx, page, errors } = await open(devices['iPhone 13 landscape'], '?perf');
  const s = await G(page, () => { const g = window.__gametool; return { preset: g.settings.preset, scale: g.settings.renderScale, fog: g.settings.fogDistance, cap: g.settings.fpsCap, shadows: g.settings.shadows, opt: [...document.querySelectorAll('#preset option')].map((o) => o.value) }; });
  check('A new iPhone player starts on Low power (render scale 40, fog 35 m, 30 fps, no shadows)', s.preset === 'lowpower' && s.scale === 40 && s.fog === 35 && s.cap === 30 && !s.shadows, JSON.stringify(s));
  check('The graphics menu offers Low power', s.opt[0] === 'lowpower' && s.opt.includes('low'), s.opt.join());
  await page.tap('#begin');
  await page.waitForFunction(() => window.__gametool.state === 'play', null, { timeout: 90000 });
  const q = await G(page, () => { const g = window.__gametool; return { folk: g.townsfolk.activeCount, forest: g.forestCards.mesh.visible, lit: g.nightLights.max ?? null }; });
  check('Low power: fewer townsfolk, and the far forest (all in fog) is not drawn', q.folk < 8 && q.forest === false, JSON.stringify(q));
  await page.waitForFunction(() => /fps · .* ms · cpu .* calls/.test(document.getElementById('perfHud')?.textContent ?? ''), null, { timeout: 30000 }).catch(() => {});
  const hud = await G(page, () => document.getElementById('perfHud')?.textContent ?? '');
  check('?perf shows the frame-time readout (fps, ms, CPU ms, draw calls, preset)', /\d+ fps · [\d.]+ ms · cpu [\d.]+ ms · \d+ calls · \d+k tris · lowpower/.test(hud), hud);
  check('iPhone: no console/page errors', errors.length === 0, errors.slice(0, 3).join(' | '));
  await ctx.close();
}

// ---------- Desktop: Medium stays the default; off-screen characters aren't drawn ----------
{
  const { ctx, page, errors } = await open({ viewport: { width: 1280, height: 720 } });
  const s = await G(page, () => ({ preset: window.__gametool.settings.preset, hud: !!document.getElementById('perfHud') }));
  check('Desktop still starts on Medium, with no readout unless asked', s.preset === 'medium' && !s.hud, JSON.stringify(s));
  await page.click('#begin');
  await page.waitForFunction(() => window.__gametool.state === 'play', null, { timeout: 60000 });
  // Stand by the hero standee: facing it, it's drawn; facing away, it's culled and its meshes are hidden.
  const face = (away) => G(page, (away) => {
    const g = window.__gametool, h = g.world.standees.hero.position, p = g.player;
    p.thirdPerson = false; p.pos.set(h.x + 3, 0, h.z + 3);
    p.yaw = p.bodyYaw = Math.atan2(3, 3) + (away ? Math.PI : 0); p.pitch = 0;
  }, away);
  const heroShown = () => G(page, () => { let any = false; window.__gametool.world.standees.hero.traverse((o) => { if (o.isMesh && o.visible) any = true; }); return any; });
  await face(false); await page.waitForTimeout(800); await face(false); await page.waitForTimeout(800);
  const near = { shown: await heroShown(), culled: await G(page, () => window.__gametool.charsCulled) };
  await face(true); await page.waitForTimeout(800); await face(true); await page.waitForTimeout(800);
  const away = { shown: await heroShown(), culled: await G(page, () => window.__gametool.charsCulled) };
  await face(false); await page.waitForTimeout(800); await face(false); await page.waitForTimeout(800);
  const back = await heroShown();
  check('Off-screen characters are not drawn or animated, and come back on screen', near.shown && !away.shown && back && away.culled > 0, JSON.stringify({ near, away, back }));
  check('Desktop: no console/page errors', errors.length === 0, errors.slice(0, 3).join(' | '));
  await ctx.close();
}

await browser.close();
const failed = results.filter((r) => !r.ok).length;
console.log(`${results.length - failed}/${results.length} checks passed`);
process.exit(failed ? 1 : 0);
