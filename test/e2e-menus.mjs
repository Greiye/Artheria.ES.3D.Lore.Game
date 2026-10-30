// v0.06 part 1 checks: What's new (M6), overhead start (M7), controller label (M8), the Skyrim-style pause menu
// (P1–P2) on keyboard and pad, gradient side panels (P3), no walk/run HUD (W5) and the lower prompt (W6).
// Usage: npm run build && node test/e2e-menus.mjs [path/to/index.html]
import { chromium } from 'playwright-core';
import path from 'node:path';

const file = path.resolve(process.argv[2] ?? 'dist/index.html');
const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH || undefined,
  args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'],
});
const results = [];
const check = (id, ok, detail = '') => { results.push({ id, ok }); console.log(`${ok ? 'PASS' : 'FAIL'}  ${id}${detail ? '  — ' + detail : ''}`); };
const G = (page, fn, arg) => page.evaluate(fn, arg);
const until = (page, fn, arg, timeout = 15000) => page.waitForFunction(fn, arg, { timeout, polling: 100 }).then(() => true, () => false);
const frames = (page, n = 3) => G(page, (n) => new Promise((r) => { const f = () => (--n <= 0 ? r() : requestAnimationFrame(f)); requestAnimationFrame(f); }), n);

const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
await ctx.addInitScript(() => {
  localStorage.setItem('gametool.character', JSON.stringify({ name: 'Test', motivation: '', secret: '', created: true }));
  localStorage.setItem('gametool.whatsnew', 'on');
  // A first-person view saved from last time: Begin must still start overhead (M7).
  const s = JSON.parse(localStorage.getItem('gametool.settings') || '{}'); s.view = 'first'; localStorage.setItem('gametool.settings', JSON.stringify(s));
  // A pad that can be plugged in and out (M8).
  const pad = { id: 'Test Pad (STANDARD GAMEPAD)', index: 0, connected: true, mapping: 'standard', timestamp: 0,
    axes: [0, 0, 0, 0], buttons: Array.from({ length: 17 }, () => ({ pressed: false, touched: false, value: 0 })) };
  window.__pad = pad; window.__plugged = false;
  navigator.getGamepads = () => [window.__plugged ? pad : null, null, null, null];
});
const page = await ctx.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
await page.goto('file://' + file);
await page.waitForFunction(() => window.__gametool);
await page.mouse.move(5, 5);

// ---------- M8 controller label ----------
const label = () => G(page, () => { const e = document.querySelector('#padStatus'); return { t: e.textContent, shown: getComputedStyle(e).display !== 'none' }; });
const l0 = await label();
await G(page, () => { window.__plugged = true; });
const plugged = await until(page, () => document.querySelector('#padStatus').textContent === 'Controller connected', null, 1500);
await G(page, () => { window.__plugged = false; });
const unplugged = await until(page, () => document.querySelector('#padStatus').textContent === 'No controller detected', null, 1500);
check('v0.06 M8 the menu says "No controller detected" / "Controller connected", live within a second', l0.shown && l0.t === 'No controller detected' && plugged && unplugged, JSON.stringify(l0));

// ---------- P1 pause from the main menu (Options) ----------
await page.click('#openSettingsTitle');
await until(page, () => window.__gametool.state === 'pause');
const side = await G(page, () => ({ items: [...document.querySelectorAll('#pause .pause-side button')].filter((b) => b.offsetParent).map((b) => b.textContent), open: [...document.querySelectorAll('#pause .pause-panel')].filter((p) => !p.classList.contains('hidden')).length, label: getComputedStyle(document.querySelector('#padStatus')).display !== 'none' }));
check('v0.06 P1 Options opens the pause panel: sidebar only, Back in place of Resume, no Quit', side.items.join() === 'Back,Gameplay,Graphics,Sound,Controls' && side.open === 0 && side.label, JSON.stringify(side));
await page.click('[data-group="graphics"]');
const gfx = await G(page, () => !document.querySelector('#graphicsSettings').classList.contains('hidden') && document.querySelector('[data-group="graphics"]').classList.contains('on'));
await page.click('[data-group="graphics"]');
const gfxShut = await G(page, () => document.querySelector('#graphicsSettings').classList.contains('hidden'));
check('v0.06 P1 picking a group opens its options to the right; picking it again closes them', gfx && gfxShut);
const groups = await G(page, () => Object.fromEntries([...document.querySelectorAll('#pause .pause-panel')].map((p) => [p.dataset.panel, [...p.querySelectorAll('input, select, [id]')].map((e) => e.id).filter(Boolean)])));
const need = { gameplay: ['viewSel', 'sens', 'invert', 'always', 'charsSel', 'haptics', 'companionQuiet', 'editCharacter'], graphics: ['preset', 'renderScale', 'shadows', 'postFx', 'fogDistance', 'fpsCap', 'fov'], sound: ['audioMaster', 'audioMusic', 'audioSfx', 'audioDialogue', 'muteMaster'], controls: ['keyBinds'] };
check('v0.06 P2 every setting has a group (Graphics has FOV and the FPS cap, Controls has the key map)', Object.entries(need).every(([g, ids]) => ids.every((i) => groups[g]?.includes(i))) && await G(page, () => !!document.querySelector('#controlsMap .keys.only-mouse') && !!document.querySelector('#controlsMap [data-padmap]')), JSON.stringify(groups).slice(0, 160));

// Keyboard: arrows move in the sidebar, Enter / → opens a group, ← / → change a setting, Esc steps back out.
await G(page, () => document.activeElement?.blur());
for (let i = 0; i < 4; i++) await page.keyboard.press('ArrowDown');   // Back, Gameplay, Graphics, Sound
const onSound = await G(page, () => document.activeElement?.dataset.group);
await page.keyboard.press('ArrowRight');
const inSound = await G(page, () => ({ open: !document.querySelector('#audioSettings').classList.contains('hidden'), focus: document.activeElement?.id }));
const m0 = await G(page, () => window.__gametool.settings.audio.master);
await page.keyboard.press('ArrowLeft');
const m1 = await G(page, () => window.__gametool.settings.audio.master);
await page.keyboard.press('ArrowDown');
await page.keyboard.press('Enter');
const muted = await G(page, () => window.__gametool.settings.audio.muteMaster);
await page.keyboard.press('Enter');
await page.keyboard.press('ArrowRight');
await page.keyboard.press('ArrowRight');
const m2 = await G(page, () => window.__gametool.settings.audio.master);
await page.keyboard.press('Escape');
const backOut = await G(page, () => ({ shut: document.querySelector('#audioSettings').classList.contains('hidden'), focus: document.activeElement?.dataset.group, state: window.__gametool.state }));
await page.keyboard.press('Escape');
const toTitle = await until(page, () => window.__gametool.state === 'title', null, 3000);
check('v0.06 P1 keyboard: arrows move, → opens Sound, ← / → step the slider, Enter flips a box, Esc closes the group then the menu', onSound === 'sound' && inSound.open && inSound.focus === 'audioMaster' && m1 === m0 - 5 && muted === true && m2 === m1 && backOut.shut && backOut.focus === 'sound' && backOut.state === 'pause' && toTitle,
  JSON.stringify({ onSound, inSound, m0, m1, muted, m2, backOut }));
await G(page, () => { const g = window.__gametool; g.settings.audio.muteMaster = false; g.audio.setMuted('master', false); });

// ---------- Begin goes straight in (Mike 2026-10-30), What's new from Extras, M7 overhead start ----------
const beginBig = await G(page, () => { const h = (id) => document.getElementById(id).getBoundingClientRect().height, f = (id) => parseFloat(getComputedStyle(document.getElementById(id)).fontSize);
  return f('begin') > f('openExtras') && f('begin') > f('openSettingsTitle') && h('begin') > h('openExtras'); });
check('Begin is the biggest option on the start menu', beginBig);
await page.click('#openExtras');
await page.click('#whatsNewBtn');
const wn = await until(page, () => window.__gametool.state === 'title' && !document.querySelector('#whatsNew').classList.contains('hidden'), null, 6000);
const notes = await G(page, () => [...document.querySelectorAll('#whatsNew .wn-ver')].map((d) => ({ v: d.dataset.v, open: d.open, n: d.querySelector('.wn-body').textContent.length })));
const prompt = await G(page, () => document.querySelector('#whatsNew #dailyPrompt').textContent === window.__gametool.dailyPrompt);
check('v0.06 M6 Extras → What\'s new: v0.06 open on top, v0.05…v0.01 collapsed, from CHANGELOG.md; today\'s prompt at the foot', wn && notes[0]?.v === '0.06' && notes[0].open && notes[0].n > 200 && ['0.05', '0.04', '0.03', '0.02', '0.01'].every((v) => notes.some((n) => n.v === v && !n.open)) && prompt, JSON.stringify(notes));
await page.click('#whatsNew .wn-ver[data-v="0.05"] summary');
const older = await until(page, () => /Quick Dungeon/.test(document.querySelector('#whatsNew .wn-ver[data-v="0.05"] .wn-body').textContent), null, 3000);
check('v0.06 M6 an older version opens on tap (v0.05 lists the Quick Dungeon)', older);
await G(page, () => document.querySelector('#whatsNew button.primary').focus());
await page.keyboard.press('Enter');
const backToExtras = await until(page, () => document.querySelector('#whatsNew').classList.contains('hidden') && !document.getElementById('extras').classList.contains('hidden'), null, 4000);
await page.keyboard.press('Escape');
await until(page, () => document.getElementById('extras').classList.contains('hidden'), null, 3000);
check('Closing What\'s new returns to Extras', backToExtras);
await page.click('#begin');
const played = await until(page, () => window.__gametool.state === 'play', null, 4000) && await G(page, () => document.querySelector('#whatsNew').classList.contains('hidden') && document.getElementById('extras').classList.contains('hidden'));
const view = await G(page, () => ({ view: window.__gametool.settings.view, third: window.__gametool.player.thirdPerson, step: window.__gametool.rig.step }));
check('Begin goes straight into the game (no What\'s new, no Extras); M7 it starts in the overhead camera though first person was saved', played && view.view === 'overhead' && view.third && view.step === 2, JSON.stringify(view));

// ---------- W5, W6, P3 ----------
const hud = await G(page, () => ({ status: !!document.querySelector('#status'), top: (() => { const e = document.querySelector('#prompt'), h = e.classList.contains('hidden'); e.classList.remove('hidden'); const t = e.getBoundingClientRect().top / innerHeight; if (h) e.classList.add('hidden'); return t; })() }));
check('v0.06 W5 no walk/run label on the HUD', !hud.status);
check('v0.06 W6 the prompt sits between the middle and the bottom (about 65–70% down)', hud.top > 0.64 && hud.top < 0.71, hud.top.toFixed(3));
await G(page, () => window.__gametool.openShop());
await until(page, () => window.__gametool.shop.isOpen);
const grad = await G(page, () => [document.querySelector('.shop-panel'), document.querySelector('#pause .pause-side')].map((e) => getComputedStyle(e).backgroundImage));
check('v0.06 P3 side panels (shop, pause sidebar) share the edge-to-centre opacity gradient', grad.every((g) => /linear-gradient\(90deg, rgba\(36, 25, 15, 0\.97\), rgba\(36, 25, 15, 0\.62\)\)/.test(g)), grad[0].slice(0, 90));
await page.click('[data-act="close"]');
await until(page, () => window.__gametool.state === 'play');

// ---------- P1 on a pad ----------
await G(page, () => { window.__plugged = true; });
const btn = async (i) => {
  await G(page, (i) => { window.__pad.buttons[i].pressed = true; window.__pad.buttons[i].value = 1; }, i);
  await frames(page, 2);
  await G(page, (i) => { window.__pad.buttons[i].pressed = false; window.__pad.buttons[i].value = 0; }, i);
  await frames(page, 2);
};
await btn(9);
const padPause = await until(page, () => window.__gametool.state === 'pause', null, 3000);
const focus0 = await G(page, () => document.activeElement?.id);
await btn(13); await btn(13);   // D-pad down twice: Graphics
await btn(0);                   // A opens it and steps in
const padIn = await G(page, () => ({ open: !document.querySelector('#graphicsSettings').classList.contains('hidden'), focus: document.activeElement?.id }));
const p0 = await G(page, () => window.__gametool.settings.preset);
await btn(15);                  // D-pad right: next preset
const p1 = await G(page, () => window.__gametool.settings.preset);
await btn(14);                  // and back
await btn(1);                   // B: out of the group
const padOut = await G(page, () => ({ shut: document.querySelector('#graphicsSettings').classList.contains('hidden'), focus: document.activeElement?.dataset.group }));
await btn(1);                   // B on the sidebar: resume
const padResume = await until(page, () => window.__gametool.state === 'play', null, 3000);
check('v0.06 P1 pad: Start pauses on Resume, D-pad moves, A opens Graphics, D-pad right changes the preset, B closes it, B again resumes',
  padPause && focus0 === 'resume' && padIn.open && padIn.focus === 'preset' && p1 !== p0 && padOut.shut && padOut.focus === 'graphics' && padResume, JSON.stringify({ focus0, padIn, p0, p1, padOut }));
await page.keyboard.press('Escape');
await until(page, () => window.__gametool.state === 'pause');
const frozen = await G(page, async () => { const g = window.__gametool; const t = g.perf.simSeconds; await new Promise((r) => setTimeout(r, 400)); const d = g.perf.simSeconds - t; g.menuInput('back'); return d; });
check('v0.06 P1 the game is frozen while the pause menu is open', frozen === 0, String(frozen));

check('v0.06 menus: no console/page errors', errors.length === 0, errors.join(' | '));
await browser.close();
const failed = results.filter((r) => !r.ok).length;
console.log(`\n${results.length - failed}/${results.length} checks passed`);
process.exit(failed ? 1 : 0);
