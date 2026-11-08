// B23 (Mike 2026-11-08): localization. A language picker in Settings > Gameplay switches the UI between English and
// Spanish; it's kept across loads, the E prompt follows it, and the Spanish caravan's own lines are never touched.
// Usage: node test/e2e-i18n.mjs [path/to/index.html]   (CHROMIUM_PATH as in e2e.mjs)
import { chromium } from 'playwright-core';
import path from 'node:path';

const file = path.resolve(process.argv[2] ?? 'dist/index.html');
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const results = [];
const check = (id, ok, detail = '') => { results.push({ id, ok }); console.log(`${ok ? 'PASS' : 'FAIL'}  ${id}${detail ? '  — ' + detail : ''}`); };
const ctx = await browser.newContext({ viewport: { width: 1100, height: 680 } });
await ctx.addInitScript(() => localStorage.setItem('gametool.character', JSON.stringify({ name: 'Rowan', motivation: '', secret: '', created: true })));
const page = await ctx.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
await page.route(/^https?:/, (r) => r.abort());
const G = (fn, a) => page.evaluate(fn, a);
const load = async () => { await page.goto('file://' + file, { timeout: 180000 }); await page.waitForFunction(() => window.__gametool, null, { timeout: 180000 }); };
await load();

const t0 = await G(() => ({ begin: document.querySelector('#begin').textContent, lang: window.__gametool.i18n.getLang(), sel: document.querySelector('#langSel')?.value }));
check('English by default, with a Language picker', t0.begin === 'Begin' && t0.lang === 'en' && t0.sel === 'en', JSON.stringify(t0));
await G(() => { const s = document.querySelector('#langSel'); s.value = 'es'; s.dispatchEvent(new Event('change')); });
await page.waitForTimeout(100);
const t1 = await G(() => ({ begin: document.querySelector('#begin').textContent, opts: document.querySelector('#openSettingsTitle').textContent, html: document.documentElement.lang,
  label: document.querySelector('#langSel').parentElement.firstChild.textContent.trim(), resume: document.querySelector('#resume').textContent }));
check('Picking Español turns the menus to Spanish', t1.begin === 'Empezar' && t1.opts === 'Opciones' && t1.html === 'es' && t1.label === 'Idioma' && t1.resume === 'Reanudar', JSON.stringify(t1));

await load();
const t2 = await G(() => ({ begin: document.querySelector('#begin').textContent, lang: window.__gametool.i18n.getLang(), sel: document.querySelector('#langSel').value }));
check('The choice is kept across a load', t2.begin === 'Empezar' && t2.lang === 'es' && t2.sel === 'es', JSON.stringify(t2));

await G(() => document.querySelector('#begin').click());
await page.waitForFunction(() => window.__gametool.state === 'play', null, { timeout: 180000 });
await G(() => window.__gametool.endWake?.());
await page.waitForTimeout(1200);
await G(() => window.__gametool.firstDay.skip());
await G(() => { const g = window.__gametool, h = g.candorHit.position; g.player.pos.set(h.x, 0, h.z + 1.6); g.player.yaw = g.player.bodyYaw = 0; g.player.pitch = -0.1; });
await page.waitForFunction(() => /Candor/.test(window.__gametool.lookingAtVerb ?? ''), null, { timeout: 8000, polling: 200 }).catch(() => {});
await page.waitForTimeout(300);
const p1 = await G(() => ({ verb: window.__gametool.lookingAtVerb, shown: document.querySelector('#promptVerb').textContent }));
check('The E prompt is in Spanish (the game still thinks in English)', p1.verb === 'Talk to Candor (archery)' && p1.shown === 'Hablar con Candor (tiro con arco)', JSON.stringify(p1));

// The caravan speaks only Spanish whatever the UI language: its lines and the English stage directions stay as written.
const c1 = await G(() => { const g = window.__gametool; g.openCaravan('cook'); const el = g.caravan.el; return { line: el.querySelector('.es-line')?.textContent, gesture: el.querySelector('.es-gesture')?.textContent?.trim() }; });
check("The caravan's lines are left alone", c1.line === '¡Hola! ¿Cómo te llamas?' && /^The cook waves a ladle/.test(c1.gesture ?? ''), JSON.stringify(c1));
await G(() => window.__gametool.caravan.close());

await G(() => window.__gametool.i18n.setLang('en'));
await page.waitForTimeout(400);
const t3 = await G(() => ({ begin: document.querySelector('#begin').textContent, resume: document.querySelector('#resume').textContent, shown: document.querySelector('#promptVerb').textContent, html: document.documentElement.lang }));
check('Switching back restores the English text', t3.begin === 'Begin' && t3.resume === 'Resume' && t3.html === 'en' && !/Hablar/.test(t3.shown), JSON.stringify(t3));
check('No page errors', errors.length === 0, errors.slice(0, 3).join(' | '));
await browser.close();
const passed = results.filter((r) => r.ok).length;
console.log(`${passed}/${results.length} checks passed`);
process.exit(passed === results.length ? 0 : 1);
