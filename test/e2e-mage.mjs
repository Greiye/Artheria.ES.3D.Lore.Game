// Mike 2026-11-06 (Round B, B4): a Mage learns magic missile from Magister Greer; Z (LB on a pad, a button on touch)
// casts a bolt of light that carries a light, bends toward a goblin ahead and hurts it.
// Usage: npm run build && node test/e2e-mage.mjs [path/to/index.html]
import { chromium } from 'playwright-core';
import path from 'node:path';

const file = path.resolve(process.argv[2] ?? 'dist/index.html');
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const results = [];
const check = (id, ok, detail = '') => { results.push({ id, ok }); console.log(`${ok ? 'PASS' : 'FAIL'}  ${id}${detail ? '  — ' + detail : ''}`); };
const ctx = await browser.newContext({ viewport: { width: 1100, height: 680 } });
await ctx.addInitScript(() => {
  localStorage.setItem('gametool.character', JSON.stringify({ name: 'Ysolde', motivation: '', secret: '', created: true, profession: 'mage' }));
  const p = { id: 'Test Pad (STANDARD GAMEPAD)', index: 0, connected: true, mapping: 'standard', timestamp: 0, axes: [0, 0, 0, 0], buttons: Array.from({ length: 17 }, () => ({ pressed: false, touched: false, value: 0 })) };
  window.__pad = p; navigator.getGamepads = () => [p, null, null, null];
});
const page = await ctx.newPage();
const G = (fn, a) => page.evaluate(fn, a);
const until = (fn, a, timeout = 15000) => page.waitForFunction(fn, a, { timeout, polling: 100 }).then(() => true, () => false);
const hold = (i, on) => G(([i, on]) => { window.__pad.buttons[i].pressed = on; window.__pad.buttons[i].value = on ? 1 : 0; }, [i, on]);
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
await page.route(/^https?:/, (r) => r.abort());
await page.goto('file://' + file, { timeout: 180000 });
await page.waitForFunction(() => window.__gametool, null, { timeout: 180000 });
await G(() => document.querySelector('#begin').click());
await page.waitForFunction(() => window.__gametool.state === 'play', null, { timeout: 180000 });
await G(() => window.__gametool.endWake?.());
await page.waitForTimeout(500);
const T = () => window.__gametool;
check('before Greer: no spell, no button, and Z says where to learn', await G(() => !window.__gametool.missile.learned && document.getElementById('techHud').classList.contains('hidden'))
  && (await page.keyboard.press('KeyZ'), await until(() => /Magister Greer/.test(document.getElementById('toast').textContent), null, 4000))
  && await G(() => window.__gametool.missile.bolts.length === 0));

// Greer teaches it.
await G(() => { const g = window.__gametool, c = g.pedlarHit.position; g.player.pos.set(c.x, 0, c.z + 1.6); g.player.yaw = 0; });
await G(() => window.__gametool.interactables.find((i) => i.obj === window.__gametool.pedlarHit).act());
await until(() => window.__gametool.state === 'dialogue');
const choicesNow = async () => { for (let i = 0; i < 20; i++) { const c = await G(() => [...document.querySelectorAll('#dialogue .d-choice span')].map((x) => x.textContent)); if (c.length) return c; await page.waitForTimeout(200); if (i === 5) await page.keyboard.press('Space'); } return []; };
const ch = await choicesNow();
check('Greer offers a mage a spell', ch[0] === "I'm a mage. Will you teach me a spell?", JSON.stringify(ch));
await G(() => window.__gametool.dialogue.choose(0));
await until(() => window.__gametool.missile.learned, null, 15000) || await (async () => { for (let i = 0; i < 10; i++) { await page.keyboard.press('Space'); await page.waitForTimeout(250); } })();
check('…and you learn magic missile (kept on this profile)', await G(() => window.__gametool.missile.learned && localStorage.getItem('gametool.missile') === '1'));
for (let i = 0; i < 15 && await G(() => window.__gametool.state === 'dialogue'); i++) { await page.keyboard.press('Space'); await page.waitForTimeout(250); }
await until(() => window.__gametool.state !== 'dialogue', null, 5000);
await G(() => window.__gametool.interactables.find((i) => i.obj === window.__gametool.pedlarHit).act());
await until(() => window.__gametool.state === 'dialogue');
const ch2 = await choicesNow();
check('afterwards he offers advice, not the lesson', ch2.includes('Any advice on the missile?') && !ch2.some((c) => /teach me a spell/.test(c)), JSON.stringify(ch2));
await G((i) => window.__gametool.dialogue.choose(i), ch2.indexOf('Just looking.'));
for (let i = 0; i < 15 && await G(() => window.__gametool.state === 'dialogue'); i++) { await page.keyboard.press('Space'); await page.waitForTimeout(250); }
if (await G(() => window.__gametool.state === 'resume')) await page.click('#relockBtn');
await until(() => window.__gametool.state === 'play');
check('a Mage sees one Missile button', await until(() => !document.getElementById('techHud').classList.contains('hidden') && [...document.querySelectorAll('#techHud [data-tech]')].filter((b) => getComputedStyle(b).display !== 'none').map((b) => b.dataset.tech).join() === 'missile'));

// Z casts: a bolt flies with a light, then cools down (out over the open road).
await G(() => { const g = window.__gametool, c = g.pedlarHit.position; g.player.pos.set(c.x, 0, c.z + 3); g.player.yaw = g.player.bodyYaw = Math.PI; g.player.pitch = 0.05; });
await page.waitForTimeout(300);
await page.keyboard.press('KeyZ');
const c1 = await G(() => { const m = window.__gametool.missile; return { n: m.bolts.length, cd: m.cd, light: m.light.intensity, inScene: !!m.light.parent }; });
const lit = await G(async () => { let best = 0; for (let i = 0; i < 60 && best < 1; i++) { best = Math.max(best, window.__gametool.missile.light.intensity); await new Promise((r) => requestAnimationFrame(r)); } return best; });
await page.screenshot({ path: 'test/screenshots/mage-cast.png' });
check('Z casts a bolt that carries a light, and the spell cools', c1.n === 1 && c1.cd > 0.6 && c1.inScene && lit > 1, JSON.stringify({ ...c1, lit }));
// The light check above can outlast the real cooldown on a slow machine: put the spell mid-cooldown, then try.
const before = await G(() => { const m = window.__gametool.missile; m.cd = Math.max(m.cd, 0.5); return m.bolts.length; });
await page.keyboard.press('KeyZ');
check('…no second bolt while it cools', await G((n) => window.__gametool.missile.bolts.length <= n, before));
check('the bolt fades out by itself', await until(() => window.__gametool.missile.bolts.length === 0 && window.__gametool.missile.light.intensity === 0, null, 6000));

// In the descent: aimed a little wide of a goblin, it bends in and hits.
await G(() => window.__gametool.startDescent());
await until(() => window.__gametool.inDungeon && window.__gametool.goblins.alive.length > 0, null, 30000);
await page.waitForTimeout(500);
const shot = await G(() => { const g = window.__gametool, f = g.goblins.alive[0], p = g.player;
  f.root.position.set(p.pos.x - Math.sin(p.yaw) * 5, f.root.position.y, p.pos.z - Math.cos(p.yaw) * 5);
  const e = p.eyePos, dx = f.root.position.x - e.x, dz = f.root.position.z - e.z;
  p.yaw = Math.atan2(-dx, -dz) + 0.12; p.pitch = Math.atan2(f.root.position.y + 0.6 - e.y, Math.hypot(dx, dz)); g.missile.cd = 0;
  return { d: Math.hypot(dx, dz), hp: f.hp }; });
await hold(4, true); await until(() => window.__gametool.missile.bolts.length > 0, null, 3000); await hold(4, false);
check('LB casts on a pad', await G(() => window.__gametool.missile.bolts.length > 0 || window.__gametool.missile.hits > 0));
check('it bends toward the goblin and hurts it', await until(() => window.__gametool.missile.hits > 0, null, 6000), JSON.stringify(shot));
await page.screenshot({ path: 'test/screenshots/mage-missile.png' });

check('no page errors', errors.length === 0, errors.join(' | '));
await browser.close();
const passed = results.filter((r) => r.ok).length;
console.log(`\n${passed}/${results.length} checks passed`);
process.exit(passed === results.length ? 0 : 1);
