// B26 (Mike 2026-11-01): the dojo's push-up drill can count real reps with the camera (opt-in, on-device pose model).
// The camera is Chromium's fake device; the pose model is a stub that plays back elbow angles, so the counting logic
// is tested without a person. With POSE_REAL=1 the real MediaPipe model is also loaded from dist/pose/ over http.
// Usage: node test/e2e-pushups.mjs [path/to/index.html]   (CHROMIUM_PATH as in e2e.mjs)
import { chromium } from 'playwright-core';
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';

const file = path.resolve(process.argv[2] ?? 'dist/index.html');
const shots = path.resolve(process.env.SHOTS_DIR ?? 'test/screenshots');
fs.mkdirSync(shots, { recursive: true });
const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH || undefined,
  args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream'],
});
const results = [];
const check = (id, ok, detail = '') => { results.push({ id, ok }); console.log(`${ok ? 'PASS' : 'FAIL'}  ${id}${detail ? '  — ' + detail : ''}`); };
const G = (page, fn, arg) => page.evaluate(fn, arg);

const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 }, permissions: ['camera'] });
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

await G(page, () => { const g = window.__gametool; g.openDojo(); document.querySelector('#djAck')?.click(); });
await page.waitForSelector('#dojo [data-drill="pushup"]');
await page.click('#dojo [data-drill="pushup"]');
const panel = await G(page, () => ({
  cam: document.querySelector('#djCam')?.textContent, totals: document.querySelector('#dojo .dj-totals')?.textContent,
  pose: window.__gametool.dojo.pose, optIn: /opt-in/.test(document.querySelector('#dojo')?.textContent ?? ''), on: !!document.querySelector('#pushCam'),
}));
check('The dojo has a Push-ups drill with an opt-in "Count with camera" button and totals', /Count with camera/.test(panel.cam ?? '') && /all time 0/.test(panel.totals ?? '') && panel.optIn, JSON.stringify(panel));
check('The camera stays off until asked', !panel.on);
check('Your character does push-ups on the mat', panel.pose === 'pushup');

await page.click('#djRep');
const honour = await G(page, () => ({ count: window.__gametool.dojo.count, totals: document.querySelector('#dojo .dj-totals')?.textContent, saved: JSON.parse(localStorage.getItem('gametool.pushups')) }));
check('"Rep done" still works and goes into today\'s and all-time totals', honour.count === 1 && /Today 1/.test(honour.totals) && honour.saved.total === 1, JSON.stringify(honour));

// A stub pose model: one person whose elbow angle is window.__elbow (null = nobody in view).
await G(page, () => {
  window.__elbow = null;
  const lm = (deg) => {
    const p = Array.from({ length: 33 }, () => ({ x: 0.5, y: 0.5, z: 0, visibility: 0.2 }));
    const r = (deg * Math.PI) / 180;
    p[11] = { x: 0.4, y: 0.3, z: 0, visibility: 0.95 }; p[13] = { x: 0.4, y: 0.45, z: 0, visibility: 0.95 };
    p[15] = { x: 0.4 + 0.15 * Math.sin(r), y: 0.45 - 0.15 * Math.cos(r), z: 0, visibility: 0.95 };
    return p;
  };
  window.__gametool.dojo.cam.loader = async () => ({ detectForVideo: () => (window.__elbow == null ? { landmarks: [] } : { landmarks: [lm(window.__elbow)] }) });
});
await page.click('#djCam');
await page.waitForFunction(() => window.__gametool.dojo.cam.status === 'looking', null, { timeout: 30000 });
const on = await G(page, () => ({ pill: getComputedStyle(document.querySelector('#pushCam .pc-pill')).display !== 'none' && document.querySelector('#pushCam .pc-pill').textContent, stop: document.querySelector('#djCam')?.textContent, live: !!document.querySelector('#pushCam video').srcObject?.active, fine: document.querySelector('#pushCam .pc-fine')?.textContent }));
check('Camera on: a preview, a visible "● Camera on" pill, and Stop in the panel', /Camera on/.test(on.pill || '') && /Stop camera/.test(on.stop ?? '') && on.live, JSON.stringify(on));
check('The overlay says nothing leaves the device', /Nothing is recorded or sent/.test(on.fine ?? ''));

const angle = async (deg) => { await G(page, (d) => { window.__elbow = d; }, deg); await page.waitForFunction((d) => { const a = window.__gametool.dojo.cam.angle; return a !== null && Math.abs(a - d) < 2; }, deg, { timeout: 20000 }); };
await angle(170);
check('Seeing the person switches to "I can see you"', await G(page, () => window.__gametool.dojo.cam.status === 'tracking'));
for (let i = 0; i < 3; i++) { await angle(80); await page.waitForTimeout(250); await angle(170); await page.waitForTimeout(250); }
const counted = await G(page, () => ({ cam: window.__gametool.dojo.cam.counter.reps, count: window.__gametool.dojo.count, shown: document.querySelector('#pushCam .pc-reps')?.textContent, total: JSON.parse(localStorage.getItem('gametool.pushups')).total }));
check('Three down-and-up elbow cycles count three reps (drill, overlay, totals)', counted.cam === 3 && counted.count === 4 && counted.shown === '3' && counted.total === 4, JSON.stringify(counted));
await angle(120); await angle(170);
check('A half rep (elbow never past 95°) does not count', await G(page, () => window.__gametool.dojo.cam.counter.reps) === 3);
await page.screenshot({ path: path.join(shots, 'b26-pushups-camera.png') });

// Debounce: a flicker faster than 0.4 s between reps is ignored (straight on the counter, with explicit times).
const deb = await G(page, () => { const C = window.__gametool.dojo.cam.counter.constructor; const c = new C(); const r = [c.feed(170, 0), c.feed(80, 0.3), c.feed(170, 0.6), c.feed(80, 0.7), c.feed(170, 0.8), c.feed(80, 1.2), c.feed(170, 1.5)]; return { r, reps: c.reps }; });
check('Reps closer than 0.4 s apart are ignored', deb.reps === 2 && deb.r[2] && !deb.r[4] && deb.r[6], JSON.stringify(deb));

await page.click('#pushCam #pcStop');
const off = await G(page, () => ({ el: !!document.querySelector('#pushCam'), status: window.__gametool.dojo.cam.status, btn: document.querySelector('#djCam')?.textContent }));
check('Stop turns the camera off and removes the overlay', !off.el && off.status === 'off' && /Count with camera/.test(off.btn ?? ''), JSON.stringify(off));

await page.click('#djCam');
await page.waitForFunction(() => window.__gametool.dojo.cam.on && window.__gametool.dojo.cam.status !== 'asking' && window.__gametool.dojo.cam.status !== 'loading', null, { timeout: 30000 });
await page.click('#djClose');
check('Leaving the mats also turns the camera off', await G(page, () => !document.querySelector('#pushCam') && window.__gametool.dojo.cam.status === 'off'));

// Refused permission: a plain message, and "Rep done" still works.
await G(page, () => { const o = navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices); navigator.mediaDevices.getUserMedia = () => Promise.reject(new DOMException('no', 'NotAllowedError')); window.__restoreGum = o; });
await G(page, () => { window.__gametool.openDojo(); });
await page.waitForSelector('#djCam');
await page.click('#djCam');
await page.waitForFunction(() => window.__gametool.dojo.cam.status === 'error');
check('Camera refused: says so, and you can still tap "Rep done"', await G(page, () => /refused/.test(document.querySelector('#dojo').textContent) && !!document.querySelector('#djRep') && !document.querySelector('#pushCam')));
await G(page, () => { navigator.mediaDevices.getUserMedia = window.__restoreGum; window.__gametool.dojo.close(); });

// Skills book: the push-up card shows once the drill is done (10 reps), with today's and all-time totals.
await G(page, () => { const g = window.__gametool; g.openDojo(); });
await page.click('#dojo [data-drill="pushup"]');
for (let i = 0; i < 10; i++) await page.click('#djRep');
await G(page, () => { window.__gametool.dojo.close(); window.__gametool.openSkillsBook(); });
const card = await G(page, () => [...document.querySelectorAll('#skillsBook .sk-card')].find((c) => /Push-ups/.test(c.textContent))?.outerHTML ?? '');
check('The Skills book gets a Push-ups card with form tips and totals', /all time 14/.test(card) && !/locked/.test(card) && /straight line/.test(card), card.slice(0, 160));
await G(page, () => window.__gametool.skillsBook.close());

// Optional: the real model loads from dist/pose/ (served over http) and reaches "looking" on the fake camera.
if (process.env.POSE_REAL) {
  const root = path.dirname(file);
  const types = { '.html': 'text/html', '.mjs': 'text/javascript', '.js': 'text/javascript', '.wasm': 'application/wasm', '.task': 'application/octet-stream', '.json': 'application/json' };
  const srv = http.createServer((q, s) => { const f = path.join(root, decodeURIComponent(q.url.split('?')[0]).replace(/^\/+/, '') || 'index.html'); if (!f.startsWith(root) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { s.statusCode = 404; return s.end(); } s.setHeader('Content-Type', types[path.extname(f)] ?? 'application/octet-stream'); fs.createReadStream(f).pipe(s); }).listen(0);
  const port = srv.address().port;
  await page.close();   // one game at a time on a slow machine
  const p2 = await ctx.newPage();
  await p2.route((u) => !u.href.startsWith(`http://localhost:${port}/`), (r) => r.abort());
  p2.on('pageerror', (e) => errors.push('real: ' + e.message));
  await p2.goto(`http://localhost:${port}/index.html`);
  await p2.waitForFunction(() => window.__gametool, null, { timeout: 90000 });
  await p2.waitForTimeout(800);
  await p2.click('#begin');
  await p2.waitForFunction(() => window.__gametool.state === 'play', null, { timeout: 90000 });
  await G(p2, () => { const g = window.__gametool; g.openDojo(); document.querySelector('#djAck')?.click(); });
  await p2.click('#dojo [data-drill="pushup"]');
  await p2.click('#djCam');
  const t0 = Date.now();
  await p2.waitForFunction(() => ['looking', 'tracking', 'error'].includes(window.__gametool.dojo.cam.status), null, { timeout: 240000 }).catch(() => {});
  const real = await G(p2, () => ({ status: window.__gametool.dojo.cam.status, error: window.__gametool.dojo.cam.error }));
  check('Real MediaPipe pose model loads from dist/pose/ and runs on the camera', real.status === 'looking' || real.status === 'tracking', `${JSON.stringify(real)} in ${((Date.now() - t0) / 1000).toFixed(0)} s`);
  await p2.close(); srv.close();
}

check('No page errors', errors.length === 0, errors.slice(0, 3).join(' | '));
await browser.close();
const failed = results.filter((r) => !r.ok).length;
console.log(`${results.length - failed}/${results.length} checks passed`);
process.exit(failed ? 1 : 0);
