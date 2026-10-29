// v0.04 feedback checks, part 7: the cinema NPC (the Projectionist, a placeholder) plays short clips from assets/cinema/:
// WebM only and looping (v0.06 R2), sound optional (starts muted), and the screen in town shows the reel.
// The built page ships one in-house sample reel (v0.06 R1); the test also hands it a fixture WebM with sound
// from test/fixtures/cinema/ (an ffmpeg test pattern, never shipped).
// Usage: npm run build && node test/e2e-cinema.mjs [path/to/index.html]
import { chromium } from 'playwright-core';
import path from 'node:path';
import url from 'node:url';

const file = path.resolve(process.argv[2] ?? 'dist/index.html');
const fx = (f) => url.pathToFileURL(path.resolve('test/fixtures/cinema', f)).href;
const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH || undefined,
  args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--autoplay-policy=no-user-gesture-required', '--allow-file-access-from-files'],
});
const results = [];
const check = (id, ok, detail = '') => { results.push({ id, ok }); console.log(`${ok ? 'PASS' : 'FAIL'}  ${id}${detail ? '  — ' + detail : ''}`); };
const G = (page, fn, arg) => page.evaluate(fn, arg);
const until = (page, fn, arg, timeout = 15000) => page.waitForFunction(fn, arg, { timeout, polling: 100 }).then(() => true, () => false);

const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
await ctx.addInitScript(() => localStorage.setItem('gametool.character', JSON.stringify({ name: 'Test', motivation: '', secret: '', created: true })));
const page = await ctx.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
await page.goto('file://' + file);
await page.waitForFunction(() => window.__gametool);
await page.click('#begin');
await page.waitForFunction(() => window.__gametool.state === 'play');
await page.mouse.move(5, 5);

// ---------- the Projectionist and the screen ----------
await G(page, () => { const g = window.__gametool, k = g.world.scene.getObjectByName('projectionist').position, c = g.world.town.cinema, p = g.player;
  const fx = Math.sin(c.ry), fz = Math.cos(c.ry); p.pos.set(k.x + fx * 1.4, 0, k.z + fz * 1.4); p.yaw = Math.atan2(-(k.x - p.pos.x), -(k.z - p.pos.z)); p.bodyYaw = p.yaw; p.pitch = -0.1; });
const talk = await until(page, () => window.__gametool.lookingAtVerb === "Watch the Projectionist's reels", null, 8000);
check('v0.04 cinema: the Projectionist (placeholder) stands by a screen in a gap of the town ring', talk && !!(await G(page, () => window.__gametool.world.scene.getObjectByName('cinema-screen'))));
await page.keyboard.press('KeyE');
const sample = await until(page, () => { const c = window.__gametool.cinema, v = document.querySelector('#cinema video'); return c.isOpen && c.clips.some((x) => x.id === 'sample-reel') && !!v && /sample-reel\.webm$/.test(v.src) && v.readyState >= 2; }, null, 10000);
check('v0.06 R1: a fresh build ships the sample reel (clips.json) and it plays', sample, JSON.stringify(await G(page, () => window.__gametool.cinema.clips)));
await page.click('#cinClose');
await until(page, () => window.__gametool.state === 'play');

// ---------- reels: WebM first, GIF fallback ----------
await G(page, ([webm]) => {
  window.__gametool.cinema.clips = [
    { id: 'test-reel', title: 'Test Reel', credit: 'Test', sound: true, webm },
    { id: 'silent', title: 'Silent', credit: '', sound: false, webm },
  ];
}, [fx('test-reel.webm')]);
await G(page, () => window.__gametool.openCinema());
const vid = await until(page, () => { const v = document.querySelector('#cinema video'); return !!v && v.readyState >= 2 && !v.paused; }, null, 10000);
const v0 = await G(page, () => { const g = window.__gametool, v = document.querySelector('#cinema video'), map = g.world.scene.getObjectByName('cinema-screen').material.map; return { playing: g.cinema.playing, muted: v?.muted, webm: /\.webm$/.test(v?.src ?? ''), screen: !!map?.isVideoTexture }; });
check('v0.04 cinema: a WebM reel plays (muted to start) and shows on the screen in town', vid && v0.playing === 'video' && v0.muted && v0.webm && v0.screen, JSON.stringify(v0));
await page.click('#cinSound');
check('v0.04 cinema: sound is optional and can be turned on', await G(page, () => !document.querySelector('#cinema video').muted));
const loop = await G(page, () => { const v = document.querySelector('#cinema video'); return { loop: v?.loop, img: !!document.querySelector('#cinema .cin-stage img'), pick: 'pick' in window.__gametool.cinema }; });
check('v0.06 R2: reels loop and there is no GIF path left', loop.loop === true && !loop.img && !loop.pick, JSON.stringify(loop));
await page.click('[data-clip="silent"]');
const silent = await G(page, () => ({ playing: window.__gametool.cinema.playing, muted: document.querySelector('#cinema video')?.muted, sound: !!document.getElementById('cinSound') }));
check('v0.06 R2: a silent reel (clips.json sound:false) plays muted with no sound button', silent.playing === 'video' && silent.muted && !silent.sound, JSON.stringify(silent));
const seam = await until(page, () => { const v = document.querySelector('#cinema video'); if (!v || !v.duration) return false; v.currentTime = v.duration - 0.05; return true; }, null, 6000)
  && await until(page, () => { const v = document.querySelector('#cinema video'); return v && !v.paused && v.currentTime < 1 && v.currentTime > 0; }, null, 8000);
check('v0.06 R2: at the end the reel wraps to the start and keeps playing', seam);
await page.click('#cinClose');
await until(page, () => window.__gametool.state === 'play');
const after = await G(page, () => ({ playing: window.__gametool.cinema.playing, poster: !window.__gametool.world.scene.getObjectByName('cinema-screen').material.map?.isVideoTexture }));
check('v0.04 cinema: leaving stops the reel and the screen goes back to its poster', after.playing === null && after.poster, JSON.stringify(after));

check('v0.04 cinema: no console/page errors', errors.length === 0, errors.join(' | '));
await browser.close();
const failed = results.filter((r) => !r.ok).length;
console.log(`\n${results.length - failed}/${results.length} checks passed`);
process.exit(failed ? 1 : 0);
