// Phase E checks: B8 campfire telling + ballad, B11 bard tunes, B9 gallery hall.
// Usage: npm run build && node test/e2e-campfire.mjs [path/to/index.html]
import { chromium } from 'playwright-core';
import path from 'node:path';

const file = path.resolve(process.argv[2] ?? 'dist/index.html');
const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH || undefined,
  args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--autoplay-policy=no-user-gesture-required'],
});
const results = [];
const check = (id, ok, detail = '') => { results.push({ id, ok }); console.log(`${ok ? 'PASS' : 'FAIL'}  ${id}${detail ? '  — ' + detail : ''}`); };
const G = (page, fn, arg) => page.evaluate(fn, arg);
const until = (page, fn, arg, timeout = 15000) => page.waitForFunction(fn, arg, { timeout, polling: 100 }).then(() => true, () => false);

const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
await ctx.addInitScript(() => {
  if (!localStorage.getItem('gametool.character')) localStorage.setItem('gametool.character', JSON.stringify({ name: 'Test', motivation: '', secret: '', created: true }));
  window.addEventListener('mousemove', (e) => e.stopImmediatePropagation(), true);
});
const page = await ctx.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
await page.goto('file://' + file);
await page.waitForFunction(() => window.__gametool);
await page.click('#begin');
await page.waitForFunction(() => window.__gametool.state === 'play');

const aimAt = (src, back = 1.8, side = [1, 0.4]) => G(page, ([src, back, side]) => {
  const g = window.__gametool, o = new Function('g', `return ${src}`)(g), p = g.player, c = o.position;
  const n = Math.hypot(side[0], side[1]);
  p.pos.set(c.x + side[0] / n * back, 0, c.z + side[1] / n * back);
  const d = new g.Vector3(c.x - p.pos.x, c.y - 1.7, c.z - p.pos.z);
  p.yaw = Math.atan2(-d.x, -d.z); p.pitch = Math.atan2(d.y, Math.hypot(d.x, d.z));
}, [src, back, side]);
const verbIs = (w) => until(page, (want) => document.getElementById('promptVerb').textContent === want && !document.getElementById('prompt').classList.contains('hidden'), w);
const resume = async () => { if (await G(page, () => window.__gametool.state === 'resume')) await page.click('#relockBtn'); await until(page, () => window.__gametool.state === 'play'); };

// ---------- B8 campfire ----------
await aimAt('g.world.stations.campfire', 2.2, [1, 0.6]);
check('B8 the campfire offers "Sit by the fire"', await verbIs('Sit by the fire'));
const f0 = await G(page, () => window.__gametool.world.campfireFlame.scale.y);
// Wait on frames, not wall time: SwiftShader can stall a frame for longer than a fixed wait.
check('B8 the flame flickers', await until(page, (f0) => Math.abs(f0 - window.__gametool.world.campfireFlame.scale.y) > 1e-3, f0, 5000));
await page.keyboard.press('KeyE');
check('B8 E opens the campfire panel, framed on the fire', await until(page, () => window.__gametool.state === 'forge' && window.__gametool.campfire.isOpen && window.__gametool.rig.inShot));

// ---------- B11 tune ----------
await page.click('#cfClearTune');
await page.click('#campfire .cf-cell[data-step="0"][data-row="0"]');
await page.click('#campfire .cf-cell[data-step="3"][data-row="4"]');
await page.click('#campfire .cf-cell[data-step="3"][data-row="7"]');
const steps = await G(page, () => window.__gametool.campfire.tune.steps);
check('B11 clicking the 8×8 grid writes notes (chords allowed)', steps[0] === 1 && steps[3] === (16 | 128) && steps.filter((m) => m).length === 2, JSON.stringify(steps));
await page.click('#campfire [data-inst="bells"]');
check('B11 picking an instrument is saved with the tune', await G(page, () => /^bells \d+ 01000090/.test(localStorage.getItem('gametool.tune'))), await G(page, () => localStorage.getItem('gametool.tune')));
const secs = await G(page, () => window.__gametool.campfire.play());
check('B11 Play schedules the tune on the music bus', secs > 1, `${secs} s`);

// ---------- telling + ballad ----------
await page.fill('#campfire [data-turn=start]', 'We came up the paved road at dusk, and Natalie would not go in.');
await page.fill('#campfire [data-turn=middle]', 'Inside, a bitten string. A page with a tooth hole.');
await page.fill('#campfire [data-turn=end]', 'The blue light led to the ditch, and the Swordsman was alive.');
check('B8 Natalie takes a turn between yours (solo play)', await G(page, () => document.querySelectorAll('#campfire .cf-natalie').length === 3));
await page.fill('#cfTitle', 'The Ditch Song');
await page.click('#cfBard');
const ballad = await G(page, () => { const b = window.__gametool.campfire.ballad; return b && { title: b.title, verses: b.verses, tune: b.tune }; });
check('B8 the bard turns the telling into a ballad in your words, with a refrain', !!ballad && ballad.title === 'The Ditch Song' && ballad.verses.some((v) => v.includes('The blue light led to the ditch')) && ballad.verses.filter((v) => v[0].startsWith('Sing it low')).length === 2 && ballad.verses.some((v) => v[0].startsWith('(Natalie:)')), JSON.stringify(ballad?.verses?.slice(0, 3)));
check('B8 the ballad carries your tune', ballad?.tune.startsWith('bells '));
await page.click('#cfShelf');
check('B8 "Put it on the shelf" saves the ballad', await G(page, () => JSON.parse(localStorage.getItem('gametool.ballads'))[0].title === 'The Ditch Song'));
await page.click('#cfSubmit');
const md = await G(page, () => decodeURIComponent(document.querySelector('.submit-sheet [data-act=issue]').href));
check('B8 Submit exports a song with chords and the tune line', md.includes('type: song') && /chords: [A-G]/.test(md) && /tune: "bells \d+ [0-9a-f]{16}"/.test(md));
await page.click('.submit-sheet [data-act=close]');
// Chain: tell another, picking up where the first left off.
await page.click('#cfAgain');
await page.selectOption('#cfChain', { index: 1 });
await page.fill('#campfire [data-turn=start]', 'The next morning we went back.');
await page.fill('#campfire [data-turn=middle]', 'Two were still missing.');
await page.fill('#campfire [data-turn=end]', 'We kept walking.');
await page.click('#cfBard');
check('B8 a new ballad can pick up where another left off (chain)', await G(page, () => window.__gametool.campfire.ballad.verses[0][0] === 'Where The Ditch Song left off,' && /Swordsman was alive/i.test(window.__gametool.campfire.ballad.verses[0][1])));
await page.click('#cfClose');
await until(page, () => window.__gametool.state !== 'forge');
await resume();

// ---------- B9 gallery ----------
await G(page, () => { const p = window.__gametool.player; p.pos.set(12, 0, 6); });
await page.waitForTimeout(400);
const ex = await G(page, () => window.__gametool.gallery.exhibits.map((e) => ({ id: e.id, d: e.discovered, c: e.credit, t: e.title })));
check('B9 the gallery hall has eight credited exhibits', ex.length === 8 && ex.every((e) => e.c), JSON.stringify(ex.map((e) => e.id)));
check('B9 your ballad is on display; unread lore waits to be discovered', ex.find((e) => e.id === 'ballad')?.d && ex.find((e) => e.id === 'ballad')?.t === 'The Ditch Song' && ex.find((e) => e.id === 'natalie-bourbon')?.d === false);
await aimAt('g.gallery.hitboxes[3]', 1.6, [-1, 0]);
check('B9 E on a frame names the exhibit', await verbIs('Look at "The Ditch Song"'));
await page.keyboard.press('KeyE');
check('B9 the exhibit card credits its maker', await until(page, () => /song · by/i.test(document.querySelector('.gallery-card .credit')?.textContent ?? '')));
await page.click('.gallery-card [data-act=open]');
check('B9 "Open" reads the ballad as a book and plays its tune', await until(page, () => window.__gametool.state === 'book' && /Ditch Song/.test(document.querySelector('#reader .chapter h1')?.textContent ?? '')));
await page.keyboard.press('Escape');
await until(page, () => window.__gametool.state !== 'book');
await resume();
// Reading a library artifact discovers it.
await G(page, () => window.__gametool.openReader('natalie-bourbon'));
await until(page, () => window.__gametool.state === 'book');
await page.keyboard.press('Escape');
await until(page, () => window.__gametool.state !== 'book');
await G(page, () => window.__gametool.refreshGallery());
check('B9 reading Natalie\'s page in the library puts her portrait in the gallery', await G(page, () => window.__gametool.gallery.exhibits.find((e) => e.id === 'natalie-bourbon').discovered));

// ---------- v0.04: playable instruments, Natalie's backing ----------
await G(page, () => window.__gametool.openCampfire());
await until(page, () => window.__gametool.campfire.isOpen);
const inst0 = await G(page, () => ({ chips: [...document.querySelectorAll('#campfire [data-play]')].map((b) => b.dataset.play), backing: window.__gametool.audio.backingOn }));
check('v0.04 campfire: Natalie strums while you sit; hum and clap are always yours', inst0.backing && inst0.chips.join(',') === 'hum,clap', JSON.stringify(inst0));
await G(page, () => { const g = window.__gametool; g.campfire.close(); g.inventory.give('lute', 1); g.openCampfire(); });
await until(page, () => window.__gametool.campfire.isOpen);
await page.click('#campfire [data-play="lute"]');
await page.keyboard.press('3');
const played = await G(page, () => window.__gametool.audio.lastPlayed);
await page.click('#campfire [data-pad="5"]');
const padded = await G(page, () => window.__gametool.audio.lastPlayed);
check('v0.04 campfire: a lute from the store joins the instruments; keys 1–6 and the pads play its notes', played?.kind === 'lute' && played.midi === 64 && padded?.midi === 72, JSON.stringify({ played, padded }));
await page.click('#cfClose');
await until(page, () => window.__gametool.state === 'play');
check('v0.04 campfire: leaving the fire stops the backing', !(await G(page, () => window.__gametool.audio.backingOn)));

check('Campfire: no console/page errors', errors.length === 0, errors.join(' | '));
await browser.close();
const failed = results.filter((r) => !r.ok).length;
console.log(`\n${results.length - failed}/${results.length} checks passed`);
process.exit(failed ? 1 : 0);
