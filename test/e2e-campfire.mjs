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
// v0.06 C1: the fire menu is an accordion; open a section before using what is in it.
const sec = (name) => G(page, (n) => window.__gametool.campfire.openSection(n), name);
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
await sec('tell');
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
await page.click('#campfire .fp-tab[data-fp="1"]');   // B27: "Your tune" and "Tell it to the bard" are two tabs
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
await sec('leave');
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
const inst0 = await G(page, () => ({ chips: [...document.querySelectorAll('#campfire [data-play]')].map((b) => b.dataset.play), band: { ...window.__gametool.audio.band } }));
check('v0.04 campfire: the camp plays while you sit; hum and clap are always yours', inst0.band.on && inst0.chips.join(',') === 'hum,clap', JSON.stringify(inst0));
check('v0.05 §4.2 band: the camp plays the six other stems and leaves yours (hum) to you', inst0.band.muted === 'hum' && inst0.band.playing.length === 6 && !inst0.band.playing.includes('hum') && ['violin', 'ocarina', 'lute', 'drum', 'clap', 'whistle'].every((k) => inst0.band.playing.includes(k)), JSON.stringify(inst0.band));
await G(page, () => { const g = window.__gametool; g.campfire.close(); g.inventory.give('lute', 1); g.openCampfire(); });
await until(page, () => window.__gametool.campfire.isOpen);
await sec('play');
await page.click('#campfire [data-play="lute"]');
await page.keyboard.press('3');
const played = await G(page, () => window.__gametool.audio.lastPlayed);
await page.click('#campfire [data-pad="5"]');
const padded = await G(page, () => window.__gametool.audio.lastPlayed);
check('v0.04 campfire: a lute from the store joins the instruments; keys 1–6 and the pads play its notes', played?.kind === 'lute' && played.midi === 64 && padded?.midi === 72, JSON.stringify({ played, padded }));
const swapped = await G(page, () => ({ ...window.__gametool.audio.band }));
check('v0.05 §4.2 band: picking the lute hands the lute stem to you; the camp picks up humming', swapped.muted === 'lute' && !swapped.playing.includes('lute') && swapped.playing.includes('hum'), JSON.stringify(swapped));
await page.click('#cfGuide');
check('v0.05 §4.2 band: "Hear your part" plays your stem softly', await G(page, () => window.__gametool.audio.band.guide && document.getElementById('cfGuide').classList.contains('on')));
await page.click('#cfGuide');
await G(page, () => { const g = window.__gametool; g.campfire.close(); g.inventory.give('violin', 1); g.inventory.give('ocarina', 1); g.openCampfire(); });
await until(page, () => window.__gametool.campfire.isOpen);
await sec('play');
await page.click('#campfire [data-play="violin"]');
await page.click('#campfire [data-pad="0"]');
const vio = await G(page, () => window.__gametool.audio.lastPlayed);
await page.click('#campfire [data-play="ocarina"]');
await page.keyboard.press('2');
const oca = await G(page, () => window.__gametool.audio.lastPlayed);
check('v0.05 §4.2 band: violin and ocarina (from the store) play', vio?.kind === 'violin' && oca?.kind === 'ocarina' && oca.midi === 62, JSON.stringify({ vio, oca }));
const wares = await G(page, () => { const g = window.__gametool; g.shop.open(); const t = g.shop.el.textContent; g.shop.close(); return t; });
check('v0.05 §4.2 band: the General Store sells a violin and an ocarina', /Violin/.test(wares) && /Ocarina/.test(wares));

// ---------- v0.05 §5: Natalie's telling (kinetic type) ----------
await G(page, () => { const g = window.__gametool; if (!g.campfire.isOpen) g.openCampfire(); });
await until(page, () => window.__gametool.campfire.isOpen);
await sec('hear');
await page.selectOption('#cfTale', 'natalies-field-note');
await page.click('#cfTell');
const kt = await G(page, () => { const t = window.__gametool.telling; return { open: t.isOpen, panelHidden: getComputedStyle(document.getElementById('campfire')).display === 'none', tones: [...new Set(t.beats.map((b) => b.tone))].sort(), words: t.beats.length, title: document.querySelector('#telling h2').textContent }; });
check('v0.05 §5 "Ask Natalie to tell it" opens the telling over the fire', kt.open && kt.panelHidden && kt.title === "Natalie's Field Note", JSON.stringify(kt));
check('v0.05 §5 markdown tags become tones: *whisper*, **emphasis**, ***dramatic beat***', kt.tones.join(',') === 'drama,em,plain,whisper', JSON.stringify(kt.tones));
const pace = await G(page, () => {
  const b = window.__gametool.telling.beats, i = b.findIndex((x) => x.tone === 'drama'), w = b.find((x) => x.tone === 'whisper'), p = b.find((x) => x.tone === 'plain' && !/[.,;:!?]$/.test(x.word) && x.word.length < 6 && x.wait < 400);
  return { dramaWait: b[i].wait, whisper: w.wait, plain: p.wait };
});
check('v0.05 §5 pacing: a breath before the dramatic beat, whispers slower than plain words', pace.dramaWait > 1000 && pace.whisper > pace.plain, JSON.stringify(pace));
const grow = await until(page, () => window.__gametool.telling.shown >= 3, null, 6000);
const css = await G(page, () => { const s = (c) => getComputedStyle(document.querySelector('#telling .kt-' + c)); return { plain: parseFloat(s('plain').fontSize), whisper: parseFloat(s('whisper').fontSize), drama: parseFloat(s('drama').fontSize), em: s('em').fontWeight }; });
check('v0.05 §5 words appear one by one; whispers are smaller, emphasis bold, dramatic beats big', grow && css.whisper < css.plain && css.drama > css.plain && Number(css.em) >= 700, JSON.stringify(css));
const flared = await until(page, () => { const t = window.__gametool.telling; if (t.shown < t.beats.length) t.press(); return window.__gametool.world.campfireFlame.scale.y > 1.5; }, null, 4000);
await until(page, () => { const t = window.__gametool.telling; if (!t.done) t.press(); return t.done; }, null, 6000);
check('v0.05 §5 A / tap hurries her paragraph by paragraph to the end', await G(page, () => window.__gametool.telling.done));
await page.keyboard.press('Space');
check('v0.05 §5 when she\'s done, A / Space goes back to the fire', await until(page, () => !window.__gametool.telling.isOpen && window.__gametool.campfire.isOpen && getComputedStyle(document.getElementById('campfire')).display !== 'none', null, 3000));
await page.click('#cfTell');
await until(page, () => window.__gametool.telling.isOpen);
await page.keyboard.press('Escape');
check('v0.05 §5 Esc leaves the telling, not the fire', await until(page, () => !window.__gametool.telling.isOpen && window.__gametool.campfire.isOpen, null, 3000));
await page.click('#cfTell');
await until(page, () => window.__gametool.telling.isOpen);
const padOk = await G(page, () => { const g = window.__gametool, n = g.telling.shown; g.menuInput('ok'); const m = g.telling.shown; g.menuInput('back'); return { n, m, open: g.telling.isOpen, fire: g.campfire.isOpen }; });
check('v0.05 §5 controller: A hurries her along, B goes back to the fire', padOk.m > padOk.n && !padOk.open && padOk.fire, JSON.stringify(padOk));
check('v0.05 §5 the fire flares on the dramatic beat', flared);
await sec('leave');
await page.click('#cfClose');
await until(page, () => window.__gametool.state === 'play');
check('v0.04 campfire: leaving the fire stops the band', !(await G(page, () => window.__gametool.audio.band.on)));

check('Campfire: no console/page errors', errors.length === 0, errors.join(' | '));
await browser.close();
const failed = results.filter((r) => !r.ok).length;
console.log(`\n${results.length - failed}/${results.length} checks passed`);
process.exit(failed ? 1 : 0);
