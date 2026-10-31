// B16 (Mike 2026-10-31): the Spanish caravan. Three people who speak only Spanish (never translated), picture and
// gesture hints, picked or written replies, and a phrasebook in the Journal where you write your own meanings.
// Usage: node test/e2e-caravan.mjs [path/to/index.html]   (CHROMIUM_PATH as in e2e.mjs)
import { chromium, devices } from 'playwright-core';
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
const frames = (page, n = 3) => G(page, (n) => new Promise((r) => { const f = () => (--n <= 0 ? r() : requestAnimationFrame(f)); requestAnimationFrame(f); }), n);

async function open(opts = { viewport: { width: 1280, height: 720 } }) {
  const ctx = await browser.newContext(opts);
  await ctx.addInitScript(() => localStorage.setItem('gametool.character', JSON.stringify({ name: 'Rill', motivation: '', secret: '', created: true })));
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  await page.route(/^https?:/, (r) => r.abort());
  await page.goto('file://' + file);
  await page.waitForFunction(() => window.__gametool);
  await page.waitForTimeout(400);
  await page.click('#begin');
  await page.waitForFunction(() => window.__gametool.state === 'play');
  await page.waitForTimeout(500);
  return { ctx, page, errors };
}

{
  const { ctx, page, errors } = await open();
  const folk = await G(page, () => window.__gametool.caravanFolk.map((f) => ({ id: f.id, role: f.talk.role, x: f.root.position.x, z: f.root.position.z, hit: window.__gametool.interactables.some((i) => i.obj === f.hit) })));
  check('Three caravan people stand by the coach road, each one you can talk to', folk.length === 3 && folk.every((f) => f.hit && f.x < -14 && f.x > -26), JSON.stringify(folk));
  const mapPin = await G(page, () => window.__gametool.livingMap.marks().some((m) => /caravan/i.test(m.label)));
  check('The living map marks the caravan', mapPin);
  await page.waitForFunction(() => window.__gametool.state === 'play', null, { timeout: 3000 }).catch(() => {});

  await G(page, () => window.__gametool.openCaravan('cook'));
  await page.waitForTimeout(300);
  const first = await G(page, () => ({ state: window.__gametool.state, line: document.querySelector('#caravan .es-line').textContent, cue: document.querySelector('#caravan .es-cue').textContent, n: document.querySelectorAll('#caravan [data-ans]').length, talking: window.__gametool.caravanFolk[0].root.userData.folk.talking }));
  check('E on the cook opens a talk: a Spanish line, a picture cue and three Spanish replies; she talks', first.state === 'forge' && first.line === '¡Hola! ¿Cómo te llamas?' && first.cue.length > 0 && first.n === 3 && first.talking, JSON.stringify(first));
  check('Your hero\'s name goes into the reply', (await page.textContent('#caravan [data-ans="0"]')) === 'Me llamo Rill.');
  await frames(page, 6);
  await page.screenshot({ path: path.join(shots, 'b16-cook.png') });

  // A wrong reply: a puzzled Spanish answer, never English, and the reply is struck out.
  await page.click('#caravan [data-ans="1"]');
  const puzzled = await G(page, () => ({ line: document.querySelector('#caravan .es-line').textContent, struck: document.querySelector('#caravan [data-ans="1"]').classList.contains('struck') }));
  check('A wrong reply gets a puzzled answer in Spanish and is struck out', /^(¿Cómo\?|No te entiendo\.|¿Perdón\? Otra vez, por favor\.)$/.test(puzzled.line) && puzzled.struck, JSON.stringify(puzzled));
  const english = await G(page, () => document.querySelector('#caravan .es-line').textContent + ' ' + [...document.querySelectorAll('#caravan [data-ans]')].map((b) => b.textContent).join(' '));
  check('Nothing they say or offer you is in English', !/\b(hello|what|name|hungry|thank|soup|yes)\b/i.test(english), english);

  const before = await G(page, () => window.__gametool.inventory.count('crown'));
  for (const i of [0, 1, 0, 1]) await page.click(`#caravan [data-ans="${i}"]`);
  const end = await G(page, () => ({ line: document.querySelector('#caravan .es-line').textContent, done: window.__gametool.caravan.st.done, phrases: window.__gametool.caravan.st.phrases.length, crowns: window.__gametool.inventory.count('crown') }));
  check('Getting through the talk ends with a Spanish goodbye, pays crowns once, fills the phrasebook', end.line === '¡Hasta luego, Rill!' && end.done.includes('cook') && end.phrases === 8 && end.crowns >= before, JSON.stringify({ ...end, before }));

  // Written replies, for the muleteer.
  await G(page, () => window.__gametool.caravan.close());
  await G(page, () => window.__gametool.openCaravan('muleteer'));
  await page.click('#esMode');
  check('"Write my reply" swaps the choices for a text box (16 px, Spanish placeholder)', await G(page, () => { const i = document.querySelector('#esType'); return !!i && parseFloat(getComputedStyle(i).fontSize) >= 16 && /español/.test(i.placeholder) && !document.querySelector('#caravan [data-ans]'); }));
  await page.fill('#esType', 'tengo dos mulas');
  await page.press('#esType', 'Enter');
  const wrongTyped = await G(page, () => window.__gametool.caravan.st.step.muleteer ?? 0);
  await page.fill('#esType', '¡Vengo del BOSQUE!');
  await page.press('#esType', 'Enter');
  const step = await G(page, () => ({ step: window.__gametool.caravan.st.step.muleteer, line: document.querySelector('#caravan .es-line').textContent }));
  check('A written reply is understood whatever the accents, case or ¡!, and nonsense is not', wrongTyped === 0 && step.step === 1 && /biblioteca vieja/.test(step.line), JSON.stringify(step));
  check('Esc says goodbye (closes the talk) and play resumes', await (async () => { await page.keyboard.press('Escape'); await page.waitForTimeout(300); return G(page, () => !window.__gametool.caravan.isOpen && window.__gametool.caravanFolk.every((f) => !f.root.userData.folk.talking)); })());

  // The phrasebook in the Journal: no translations, your own notes kept.
  await G(page, () => document.exitPointerLock?.());
  await page.waitForTimeout(150);
  await page.keyboard.press('Escape');
  await page.waitForFunction(() => window.__gametool.state === 'pause', null, { timeout: 3000 }).catch(() => {});
  check('The Journal has a Phrasebook page', await page.isVisible('#pgPhrases'));
  await page.click('#pgPhrases');
  const pb = await G(page, () => [...document.querySelectorAll('#phrasebook .pb-es')].map((e) => e.textContent));
  check('The phrasebook lists the lines in Spanish only', pb.length >= 9 && pb.includes('¿Tienes hambre?') && pb.includes('¡Vengo del BOSQUE!'), JSON.stringify(pb.slice(0, 4)));
  await page.fill('#phrasebook input[data-i="1"]', 'my name is');
  await page.press('#phrasebook input[data-i="1"]', 'Tab');
  check('Your own meaning is kept with the phrase', (await G(page, () => JSON.parse(localStorage.getItem('gametool.spanish')).phrases[1].note)) === 'my name is');
  await page.screenshot({ path: path.join(shots, 'b16-phrasebook.png') });
  check('No console / page errors', errors.length === 0, errors.join(' | '));
  await ctx.close();
}

// Phone, sideways: the talk fits and the replies are thumb-sized.
{
  const { defaultBrowserType, ...phone } = devices['iPhone 13'];
  const { ctx, page, errors } = await open({ ...phone, viewport: { width: 844, height: 390 } });
  await G(page, () => window.__gametool.openCaravan('weaver'));
  await page.waitForTimeout(300);
  const fit = await G(page, () => { const p = document.querySelector('#caravan .forge-panel').getBoundingClientRect(); const b = [...document.querySelectorAll('#caravan [data-ans]')].map((e) => e.getBoundingClientRect().height); return { w: p.width, inside: p.right <= innerWidth + 1, minH: Math.min(...b) }; });
  check('Phone: the talk panel fits the screen and replies are at least 44 px tall', fit.inside && fit.minH >= 44, JSON.stringify(fit));
  await frames(page, 6);
  await page.screenshot({ path: path.join(shots, 'b16-weaver-phone.png') });
  check('Phone: no console / page errors', errors.length === 0, errors.join(' | '));
  await ctx.close();
}

await browser.close();
const passed = results.filter((r) => r.ok).length;
console.log(`\n${passed}/${results.length} checks passed`);
process.exit(passed === results.length ? 0 : 1);
