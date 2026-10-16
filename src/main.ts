import * as THREE from 'three';
import './style.css';
import { buildWorld } from './world';
import { Player } from './player';
import { Book } from './book';
import { lore } from './lore';
import { controls, actionFor, type Action } from './controls';
import { loadSettings, saveSettings } from './settings';
import { TouchControls } from './input/touch';
import { GamepadControls } from './input/gamepad';
import type { State, InputMode, GameHooks } from './input/hooks';

// Private, all rights reserved (D8). Not open source.


const settings = loadSettings();
const app = document.getElementById('app')!;

// ---------- renderer / camera (D2, D4) ----------
const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
const coarse = matchMedia('(pointer: coarse)').matches;
// Phones: cap the render resolution so mid-range devices hold frame rate.
renderer.setPixelRatio(Math.min(window.devicePixelRatio, coarse ? 1.5 : 2));
renderer.setSize(window.innerWidth, window.innerHeight);
app.appendChild(renderer.domElement);
const canvas = renderer.domElement;

const camera = new THREE.PerspectiveCamera(settings.fov, window.innerWidth / window.innerHeight, 0.05, 200);
window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

const world = buildWorld();
const player = new Player(camera, settings, world.colliders, world.bounds);
player.spawn(world.spawn.pos, world.spawn.yaw);
const book = new Book(lore.entries, settings);

// ---------- UI ----------
const ui = document.createElement('div');
ui.innerHTML = `
  <div id="title" class="screen">
    <div class="card">
      <div class="eyebrow">Video Gametool Project</div>
      <h1>The Campaign Book</h1>
      <p class="lead">Walk the start area and read the lore your friends wrote.</p>
      <button id="begin" class="primary">Click to begin</button>
      <table class="keys only-touch">
        <tr><td>Left thumb</td><td>Move (small push walks, full push runs)</td></tr>
        <tr><td>Right thumb</td><td>Drag to look</td></tr>
        <tr><td>Buttons</td><td>Jump · Sneak · Sprint (hold) · Read · ☰ menu</td></tr>
        <tr><td>Book</td><td>Swipe or tap a page edge · ✕ to close</td></tr>
      </table>
      <table class="keys only-pad">
        <tr><td>Left stick</td><td>Move</td><td>Right stick</td><td>Look</td></tr>
        <tr><td>A</td><td>Read / confirm</td><td>B</td><td>Close book</td></tr>
        <tr><td>Y</td><td>Jump</td><td>LB (hold)</td><td>Sprint</td></tr>
        <tr><td>L3</td><td>Sneak</td><td>R3</td><td>Toggle always-run</td></tr>
        <tr><td>LB / RB</td><td>Turn pages</td><td>Start</td><td>Pause</td></tr>
      </table>
      <table class="keys only-mouse">
        <tr><td>W A S D</td><td>Move (runs by default)</td><td>Mouse</td><td>Look</td></tr>
        <tr><td>Shift</td><td>Walk (hold)</td><td>Caps Lock</td><td>Toggle always-run</td></tr>
        <tr><td>Alt</td><td>Sprint (hold)</td><td>Space</td><td>Jump</td></tr>
        <tr><td>C</td><td>Sneak / crouch</td><td>E</td><td>Read the book</td></tr>
        <tr><td>Tab</td><td>Close book</td><td>Esc</td><td>Pause menu</td></tr>
      </table>
      <p class="fine">Private project · all rights reserved.</p>
    </div>
  </div>
  <div id="hud" class="hidden">
    <div id="crosshair"></div>
    <div id="prompt" class="hidden"><kbd>E</kbd> — Read</div>
    <div id="status"></div>
    <div id="nolock" class="hidden">Pointer lock unavailable here: hold the left mouse button and drag to look.</div>
  </div>
  <div id="pause" class="screen hidden">
    <div class="card narrow">
      <h1>Paused</h1>
      <button id="resume" class="primary">Resume</button>
      <label>Look sensitivity <output id="sensOut"></output><input id="sens" type="range" min="0.2" max="3" step="0.05"></label>
      <label>Field of view <output id="fovOut"></output><input id="fov" type="range" min="60" max="100" step="1"></label>
      <label class="check"><input id="invert" type="checkbox"> Invert Y</label>
      <label class="check"><input id="always" type="checkbox"> Always run (Caps Lock)</label>
      <p class="fine">Settings are saved in this browser.</p>
    </div>
  </div>
  <div id="relock" class="screen hidden"><button class="primary" id="relockBtn">Click to continue</button></div>`;
document.body.appendChild(ui);
const $ = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T;
const show = (id: string, on: boolean) => $(id).classList.toggle('hidden', !on);

let state: State = 'title';
let lockSupported = true;
let expectUnlock = false;
let mouseHeld = false;
let lookingAtBook = false;
let inputMode: InputMode = coarse ? 'touch' : 'mouse';

function setMode(m: InputMode) {
  if (m === inputMode) return;
  inputMode = m;
  document.body.dataset.input = m;
  $('begin').textContent = m === 'touch' ? 'Tap to begin' : m === 'pad' ? 'Press A to begin' : 'Click to begin';
  $('prompt').innerHTML = `<kbd>${m === 'pad' ? 'A' : 'E'}</kbd> — Read`;
  show('nolock', state === 'play' && !lockSupported && m === 'mouse');
}

function setState(s: State) {
  state = s;
  show('title', s === 'title');
  show('hud', s === 'play');
  show('pause', s === 'pause');
  show('relock', s === 'resume');
  show('nolock', s === 'play' && !lockSupported && inputMode === 'mouse');
  if (s !== 'play') {
    player.held.clear(); mouseHeld = false; show('prompt', false);
    player.analog.x = player.analog.y = player.analogLook.x = player.analogLook.y = 0;
    touch?.reset();
  }
  document.body.dataset.state = s;
}

// ---------- pointer lock ----------
function requestLock(): Promise<boolean> {
  return new Promise((resolve) => {
    let done = false;
    const finish = (ok: boolean) => {
      if (done) return;
      done = true;
      document.removeEventListener('pointerlockchange', onChange);
      document.removeEventListener('pointerlockerror', onError);
      resolve(ok);
    };
    const onChange = () => finish(document.pointerLockElement === canvas);
    const onError = () => finish(false);
    document.addEventListener('pointerlockchange', onChange);
    document.addEventListener('pointerlockerror', onError);
    try {
      const p = canvas.requestPointerLock() as unknown as Promise<void> | undefined;
      if (p && typeof p.catch === 'function') p.catch(() => finish(false));
    } catch { finish(false); }
    setTimeout(() => finish(document.pointerLockElement === canvas), 1200);
  });
}

document.addEventListener('pointerlockchange', () => {
  if (document.pointerLockElement === canvas) return;
  if (expectUnlock) { expectUnlock = false; return; }
  if (state === 'play') setState('pause');   // F2 Esc: browser released the pointer -> pause menu
});

// F1.1: title -> pointer lock -> spawned in first person.
async function begin() {
  player.spawn(world.spawn.pos, world.spawn.yaw);
  setState('play');                             // in the world immediately, even before lock resolves
  if (inputMode === 'touch') {
    // Android: go fullscreen. iPhone Safari has no element fullscreen; Add to Home Screen does it.
    document.documentElement.requestFullscreen?.({ navigationUI: 'hide' }).catch(() => undefined);
    return;
  }
  if (inputMode !== 'mouse') return;            // gamepad: no pointer lock needed
  lockSupported = await requestLock();
  show('nolock', state === 'play' && !lockSupported && inputMode === 'mouse');
}
$('begin').addEventListener('click', (e) => {
  if ((e as PointerEvent).pointerType === 'touch') setMode('touch');
  void begin();
});

function pause() {
  if (state !== 'play') return;
  if (document.pointerLockElement) { expectUnlock = true; document.exitPointerLock(); }
  setState('pause');
}

async function resumePlay() {
  setState('play');
  if (!lockSupported || inputMode !== 'mouse') return;
  const ok = await requestLock();
  // Browsers refuse a re-lock right after Esc or without a user gesture: ask for one click.
  if (!ok && state === 'play') setState('resume');
}
$('resume').addEventListener('click', () => void resumePlay());
$('relockBtn').addEventListener('click', () => void resumePlay());

// ---------- book open / close (F3.2, F3.6) ----------
async function openBook() {
  setState('book');
  if (document.pointerLockElement) { expectUnlock = true; document.exitPointerLock(); }
  await book.open();
}
book.onClose = () => void resumePlay();
$('prompt').addEventListener('click', () => { if (lookingAtBook) void openBook(); });

// ---------- touch + gamepad ----------
const hooks: GameHooks = {
  state: () => state,
  player,
  book,
  begin: () => void begin(),
  pause,
  resume: () => void resumePlay(),
  activate: () => { if (state === 'play' && lookingAtBook) void openBook(); },
  lookingAtBook: () => lookingAtBook,
  toggleRun: () => toggleRun(),
  setMode,
};
const touch: TouchControls | null = new TouchControls(hooks);
const gamepad = new GamepadControls(hooks, () => settings.sensitivity);
document.body.dataset.input = inputMode;
$('begin').textContent = inputMode === 'touch' ? 'Tap to begin' : 'Click to begin';

// ---------- keyboard (F2.1) ----------
const MOVE: Action[] = ['forward', 'left', 'back', 'right', 'walk', 'sprint'];
const ALL: Action[] = ['forward', 'left', 'back', 'right', 'walk', 'toggleRun', 'sprint', 'jump', 'sneak', 'activate', 'close', 'pause'];
let capsToggledAt = -1e9;

function toggleRun() {
  settings.alwaysRun = !settings.alwaysRun;
  saveSettings(settings);
  ($('always') as HTMLInputElement).checked = settings.alwaysRun;
}

window.addEventListener('keydown', (e) => {
  setMode('mouse');
  // Keys the browser would otherwise act on (focus change, menu bar, scrolling).
  if (['Tab', 'AltLeft', 'AltRight', 'Space', 'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(e.code) && state !== 'pause') e.preventDefault();
  if (e.code === 'CapsLock') {
    // Some platforms (macOS) send only a keyup when Caps Lock turns off; see keyup below.
    if (state === 'play' && !e.repeat) { toggleRun(); capsToggledAt = performance.now(); }
    return;
  }
  if (state === 'book') { if (!e.repeat) book.handleKey(e.code); return; }   // F3.2: world input ignored
  if (state === 'pause' && e.code === 'Escape' && !lockSupported) { void resumePlay(); return; }
  if (state !== 'play') return;
  const a = actionFor(e.code, ALL);
  if (!a) return;
  if (MOVE.includes(a)) { player.held.add(a); return; }
  if (e.repeat) return;
  if (a === 'jump') player.jump();
  else if (a === 'sneak') player.toggleSneak();
  else if (a === 'toggleRun') toggleRun();
  else if (a === 'activate' && lookingAtBook) void openBook();
  else if (a === 'pause') setState('pause');               // only reaches here when the pointer isn't locked
});
window.addEventListener('keyup', (e) => {
  if (e.code === 'AltLeft' || e.code === 'AltRight') e.preventDefault();
  if (e.code === 'CapsLock' && state === 'play' && performance.now() - capsToggledAt > 400) toggleRun();
  const a = actionFor(e.code, MOVE);
  if (a) player.held.delete(a);
});
window.addEventListener('blur', () => player.held.clear());

// ---------- mouse look ----------
window.addEventListener('pointerdown', (e) => { if (e.pointerType === 'mouse') setMode('mouse'); });
window.addEventListener('mousedown', (e) => { if (e.button === 0 && state === 'play') mouseHeld = true; });
window.addEventListener('mouseup', (e) => { if (e.button === 0) mouseHeld = false; });
window.addEventListener('mousemove', (e) => {
  if (state !== 'play') return;
  const locked = document.pointerLockElement === canvas;
  if (inputMode !== 'mouse') return;
  if (locked || (!lockSupported && mouseHeld)) player.look(e.movementX, e.movementY);
});

// ---------- pause menu (F2.3) ----------
const sens = $<HTMLInputElement>('sens'), fov = $<HTMLInputElement>('fov');
const inv = $<HTMLInputElement>('invert'), always = $<HTMLInputElement>('always');
function syncMenu() {
  sens.value = String(settings.sensitivity); $('sensOut').textContent = settings.sensitivity.toFixed(2);
  fov.value = String(settings.fov); $('fovOut').textContent = settings.fov + '°';
  inv.checked = settings.invertY; always.checked = settings.alwaysRun;
}
sens.addEventListener('input', () => { settings.sensitivity = Number(sens.value); saveSettings(settings); syncMenu(); });
fov.addEventListener('input', () => {
  settings.fov = Number(fov.value); saveSettings(settings); syncMenu();
  camera.fov = settings.fov; camera.updateProjectionMatrix();
});
inv.addEventListener('change', () => { settings.invertY = inv.checked; saveSettings(settings); });
always.addEventListener('change', () => { settings.alwaysRun = always.checked; saveSettings(settings); });
syncMenu();

// ---------- frame loop ----------
const ray = new THREE.Raycaster();
ray.far = controls.activateRange;
const centre = new THREE.Vector2(0, 0);
const clock = new THREE.Clock();
const statusEl = $('status');
let lastStatus = '';
const perf = { frames: 0, cpuMs: 0, worstMs: 0, simSeconds: 0 };
const SIM_STEP = 1 / 120;
let simAcc = 0;

function frame() {
  requestAnimationFrame(frame);
  const t0 = performance.now();
  // Fixed 120 Hz simulation steps: speeds and jump height stay exact even when frames are slow.
  // Long stalls (tab in background) are capped at 0.25 s so the player doesn't teleport.
  const dt = Math.min(clock.getDelta(), 0.25);
  world.update(clock.elapsedTime);
  gamepad.update();
  if (state === 'play') {
    simAcc += dt;
    while (simAcc >= SIM_STEP) { player.update(SIM_STEP); simAcc -= SIM_STEP; perf.simSeconds += SIM_STEP; }
    // F3.1: centre-screen ray, 2 m reach.
    ray.setFromCamera(centre, camera);
    lookingAtBook = ray.intersectObject(world.bookTarget, false).length > 0;
    show('prompt', lookingAtBook);
    const s = (player.sneaking ? 'SNEAK' : player.speed() === controls.speeds.sprint ? 'SPRINT' : player.speed() === controls.speeds.run ? 'RUN' : 'WALK')
      + (settings.alwaysRun ? '' : ' · always-run off');
    if (s !== lastStatus) { statusEl.textContent = s; lastStatus = s; }
    touch?.update();
  } else lookingAtBook = false;
  renderer.render(world.scene, camera);
  const ms = performance.now() - t0;
  perf.frames++; perf.cpuMs += ms; perf.worstMs = Math.max(perf.worstMs, ms);
}
setState('title');
frame();

// Debug/test hook (read-only use in automated checks; harmless in play).
Object.assign(window, { __gametool: { get state() { return state; }, get inputMode() { return inputMode; }, player, book, renderer, world, perf, settings, lockSupported: () => lockSupported } });
