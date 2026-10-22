import * as THREE from 'three';
import './style.css';
import { buildWorld } from './world';
import { Player } from './player';
import { Book } from './book';
import { lore, entryById } from './lore';
import { buildLibrary, type LibraryHit } from './library';
import { setLinkResolver } from './markdown';
import greyBooks from '../content/rolltables/grey-books.json';
import { controls, actionFor, type Action } from './controls';
import { loadSettings, saveSettings, PRESETS, type Preset, type FpsCap } from './settings';
import { audio } from './audio';
import { VERSION, AUTHOR } from './version';
import { TouchControls } from './input/touch';
import { GamepadControls } from './input/gamepad';
import type { State, InputMode, GameHooks } from './input/hooks';
import { loadGitHub, saveGitHub, loadAuthor, saveAuthor, slugify, buildMarkdown, publishToGitHub, downloadMarkdown } from './editor';
import { loadCharacter, saveCharacter, type Character } from './character';
import { promptOfTheDay } from './prompts';
import { DialogueBox, type DialogueScript } from './dialogue';
import { Inventory, ITEMS } from './inventory';
import { Crossbow, ZONE } from './crossbow';
import natalieScript from '../content/dialogue/natalie.json';
import { Post } from './render/post';
import { fillSlots, loadedModels, failedModels, type ModelSlot } from './models';

// Private, all rights reserved (D8). Not open source.


const settings = loadSettings();
const app = document.getElementById('app')!;

// Belt-and-suspenders flush: saveSettings() already writes on every change, but re-save once more
// right before the page is torn down (reload/navigate/close tab) in case a write landed just before
// a change that didn't get a chance to persist yet.
window.addEventListener('pagehide', () => saveSettings(settings));

// F1.2: prime the audio engine's cached levels before the first user gesture creates the AudioContext.
(['master', 'music', 'sfx', 'dialogue'] as const).forEach((b) => {
  audio.setLevel(b, settings.audio[b]);
  audio.setMuted(b, settings.audio[('mute' + b[0].toUpperCase() + b.slice(1)) as 'muteMaster' | 'muteMusic' | 'muteSfx' | 'muteDialogue']);
});

// ---------- renderer / camera (D2, D4) ----------
const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
renderer.outputColorSpace = THREE.SRGBColorSpace;
const coarse = matchMedia('(pointer: coarse)').matches;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
// F1.1: device pixel ratio capped (phones hold frame rate), then scaled by the render-scale setting.
const basePixelRatio = Math.min(window.devicePixelRatio, coarse ? 1.5 : 2);
function applyRenderScale() { renderer.setPixelRatio(basePixelRatio * (settings.renderScale / 100)); post?.setSize(window.innerWidth, window.innerHeight); }
let post: Post | null = null;
applyRenderScale();
renderer.setSize(window.innerWidth, window.innerHeight);
app.appendChild(renderer.domElement);
const canvas = renderer.domElement;

const camera = new THREE.PerspectiveCamera(settings.fov, window.innerWidth / window.innerHeight, 0.05, 200);
window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
  post?.setSize(window.innerWidth, window.innerHeight);
});

const loaderBar = document.querySelector<HTMLElement>('#loader i');
const progress = (pct: number) => { if (loaderBar) loaderBar.style.width = pct + '%'; };
progress(40);
const world = buildWorld();
progress(80);
renderer.shadowMap.enabled = settings.shadows;
world.setShadows(settings.shadows);
world.setFogDistance(settings.fogDistance);
post = new Post(renderer, world.scene, camera);
post.setSize(window.innerWidth, window.innerHeight);
post.setEnabled(settings.postFx);
const player = new Player(camera, settings, world.colliders, world.bounds);
player.spawn(world.spawn.pos, world.spawn.yaw);
world.scene.add(player.body);
// .glb models (public/models/<id>.glb) replace placeholders when present; never blocks loading.
const modelSlots: ModelSlot[] = [
  ...Object.entries(world.standees).map(([id, s]) => ({ id, placeholder: s, height: s.userData.height as number })),
  { id: 'player', placeholder: player.body.children[0], parent: player.body, height: controls.eyeHeight + 0.1, faceYaw: Math.PI },
];
const modelsReady = fillSlots(modelSlots).then((r) => {
  // The nub only marks "forward" on the capsule; a real model shows its own front.
  if (loadedModels.has('player')) player.body.children[1].visible = false;
  return r;
});
// F5.6: [[slug]] links resolve against the index (title) before any book is rendered.
setLinkResolver((slug) => entryById.get(slug)?.title ?? null);
// The lectern book holds the red-book lore; §6.1 artifacts live on their own objects in the library.
const book = new Book(lore.entries.filter((e) => e.type === 'lore'), settings);
// F5.4: the shelf reader — one book at a time, no contents page, doesn't touch the lectern's last page.
const reader = new Book([], settings, { id: 'reader', contents: false, persist: false });
// F5.1: the library interior, built from the lore index (shelves.json + artifacts).
const library = buildLibrary(world.scene, world.colliders, world.solids);

// ---------- UI ----------
const ui = document.createElement('div');
ui.innerHTML = `
  <div id="title" class="screen">
    <div class="card">
      <div class="eyebrow">Artheria Lore Tool <span id="versionLabel"></span></div>
      <h1>Tales of Artheria</h1>
      <p class="lead">Walk Straphan Forest and read the lore your friends wrote, as compiled by Natalie Bourbon.</p>
      <p class="daily"><span>Today's prompt</span><span id="dailyPrompt"></span></p>
      <button id="begin" class="primary">Click to begin</button>
      <button id="writeLoreTitle" class="secondary">Write lore</button>
      <button id="openSettingsTitle" class="secondary">Settings</button>
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
        <tr><td>F</td><td>First / third person</td><td>L</td><td>Write lore</td></tr>
      </table>
      <p class="fine">Private project · all rights reserved.</p>
    </div>
  </div>
  <div id="hud" class="hidden">
    <div id="crosshair"></div>
    <div id="prompt" class="hidden"><kbd>E</kbd> — <span id="promptVerb">Read</span></div>
    <div id="toast" class="hidden"></div>
    <div id="ammo" class="hidden"><span id="ammoText"></span><div id="reloadBar" class="hidden"><i class="zone"></i><i class="fill"></i></div></div>
    <button id="writeLoreHud"><kbd>L</kbd> — Write lore</button>
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
      <details id="graphicsSettings">
        <summary>Graphics (F1.1)</summary>
        <label class="field">Preset
          <select id="preset"><option value="low">Low</option><option value="medium">Medium</option><option value="high">High</option></select>
        </label>
        <label>Render scale <output id="renderScaleOut"></output><input id="renderScale" type="range" min="50" max="100" step="5"></label>
        <label class="check"><input id="shadows" type="checkbox"> Shadows</label>
        <label class="check"><input id="postFx" type="checkbox"> Post effects (glow)</label>
        <label>Fog distance <output id="fogOut"></output><input id="fogDistance" type="range" min="20" max="120" step="5"></label>
        <label class="field">FPS cap
          <select id="fpsCap"><option value="30">30</option><option value="60">60</option><option value="0">∞</option></select>
        </label>
      </details>
      <details id="audioSettings">
        <summary>Audio (F1.2)</summary>
        <label>Master <output id="audioMasterOut"></output><input id="audioMaster" type="range" min="0" max="100" step="5"></label>
        <label class="check"><input id="muteMaster" type="checkbox"> Mute master</label>
        <label>Music <output id="audioMusicOut"></output><input id="audioMusic" type="range" min="0" max="100" step="5"></label>
        <label class="check"><input id="muteMusic" type="checkbox"> Mute music</label>
        <label>SFX <output id="audioSfxOut"></output><input id="audioSfx" type="range" min="0" max="100" step="5"></label>
        <label class="check"><input id="muteSfx" type="checkbox"> Mute SFX</label>
        <label>Dialogue <output id="audioDialogueOut"></output><input id="audioDialogue" type="range" min="0" max="100" step="5"></label>
        <label class="check"><input id="muteDialogue" type="checkbox"> Mute dialogue</label>
      </details>
      <p class="fine">Settings are saved in this browser.</p>
      <button id="editCharacter" class="secondary">Character</button>
      <button id="writeLorePause" class="secondary">Write lore</button>
    </div>
  </div>
  <div id="relock" class="screen hidden"><button class="primary" id="relockBtn">Click to continue</button></div>
  <div id="charcreate" class="screen hidden">
    <div class="card">
      <div class="eyebrow">Before you set out</div>
      <h1>Who are you?</h1>
      <p class="lead">Three quick questions. Change your answers anytime from the pause menu.</p>
      <label class="field">Character name<input id="ccName" type="text" maxlength="40" placeholder="e.g. Rill of the Dais"></label>
      <label class="field">What does your character want more than anything? <span class="hint">optional</span>
        <textarea id="ccMotivation" rows="2" placeholder="Revenge, a cure, a crown, to be forgiven..."></textarea>
      </label>
      <label class="field">What's one true thing about this world that only you know? <span class="hint">optional — makes great lore</span>
        <textarea id="ccSecret" rows="2" placeholder="A secret, a rumor, a prophecy..."></textarea>
      </label>
      <div class="row">
        <button id="ccSkip">Skip for now</button>
        <button id="ccBegin" class="primary">Begin</button>
      </div>
    </div>
  </div>
  <div id="editor" class="screen hidden">
    <div class="card editcard">
      <div class="eyebrow">Add to the campaign</div>
      <h1>Write lore</h1>
      <label class="field">Your name<input id="eAuthor" type="text" maxlength="60" placeholder="Your name"></label>
      <label class="field">Title<input id="eTitle" type="text" maxlength="80" placeholder="e.g. The Old Mill"></label>
      <label class="field">Tags <span class="hint">comma-separated</span><input id="eTags" type="text" placeholder="character, place, rumor"></label>
      <label class="field">Entry <span class="hint">Markdown: **bold**, *italic*, lists, images</span>
        <textarea id="eBody" rows="8" placeholder="Write anything: a character, a place, a poem, a rumor..."></textarea>
      </label>
      <p id="eMsg" class="fine"></p>
      <div class="row">
        <button id="eCancel">Cancel</button>
        <button id="eDownload">Download .md</button>
        <button id="ePublish" class="primary">Publish to GitHub</button>
      </div>
      <details id="eSettings">
        <summary>GitHub publish settings</summary>
        <label class="field">Repo owner<input id="ghOwner" type="text" placeholder="e.g. Greiye"></label>
        <label class="field">Repo name<input id="ghRepo" type="text" placeholder="e.g. Artheria.ES.3D.Lore.Game"></label>
        <label class="field">Branch<input id="ghBranch" type="text" placeholder="main"></label>
        <label class="field">Personal access token <span class="hint">stays only in this browser</span><input id="ghToken" type="password" placeholder="github_pat_..."></label>
        <p class="fine">Create a fine-grained token at github.com → Settings → Developer settings → Personal access tokens, scoped to this one repo, permission "Contents: Read and write".</p>
        <button id="ghSave">Save publish settings</button>
      </details>
    </div>
  </div>`;
document.body.appendChild(ui);
const $ = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T;
const show = (id: string, on: boolean) => $(id).classList.toggle('hidden', !on);

let state: State = 'title';
let lockSupported = true;
let expectUnlock = false;
let mouseHeld = false;
let lookingAt: 'book' | 'natalie' | 'bolt' | 'library' | null = null;
let libraryHit: LibraryHit | null = null;   // F3.1 / F3: what E would activate
let inputMode: InputMode = coarse ? 'touch' : 'mouse';

function setMode(m: InputMode) {
  if (m === inputMode) return;
  inputMode = m;
  document.body.dataset.input = m;
  $('begin').textContent = m === 'touch' ? 'Tap to begin' : m === 'pad' ? 'Press A to begin' : 'Click to begin';
  $('prompt').querySelector('kbd')!.textContent = m === 'pad' ? 'A' : 'E';
  show('nolock', state === 'play' && !lockSupported && m === 'mouse');
}

function setState(s: State) {
  state = s;
  show('title', s === 'title');
  show('hud', s === 'play');
  show('pause', s === 'pause');
  show('relock', s === 'resume');
  show('editor', s === 'editor');
  show('charcreate', s === 'charcreate');
  show('inventory', s === 'inventory');
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
  if (state === 'play') { pauseFrom = 'play'; setState('pause'); }   // F2 Esc: browser released the pointer -> pause menu
});

// F1.1: title -> pointer lock -> spawned in first person.
async function begin() {
  player.spawn(world.spawn.pos, world.spawn.yaw);
  setState('play');                             // in the world immediately, even before lock resolves
  audio.resume(); audio.startWind();            // F1.2/A7: first user gesture unlocks WebAudio
  if (inputMode === 'touch') {
    // Android: go fullscreen. iPhone Safari has no element fullscreen; Add to Home Screen does it.
    document.documentElement.requestFullscreen?.({ navigationUI: 'hide' }).catch(() => undefined);
    return;
  }
  if (inputMode !== 'mouse') return;            // gamepad: no pointer lock needed
  lockSupported = await requestLock();
  show('nolock', state === 'play' && !lockSupported && inputMode === 'mouse');
}
let character: Character = loadCharacter();
let ccFrom: State = 'title';
const ccName = $<HTMLInputElement>('ccName'), ccMotivation = $<HTMLTextAreaElement>('ccMotivation'), ccSecret = $<HTMLTextAreaElement>('ccSecret');

function openCharCreate(from: State) {
  ccFrom = from;
  ccName.value = character.name; ccMotivation.value = character.motivation; ccSecret.value = character.secret;
  setState('charcreate');
  ccName.focus();
}
function closeCharCreate() {
  character = { name: ccName.value.trim(), motivation: ccMotivation.value.trim(), secret: ccSecret.value.trim(), created: true };
  saveCharacter(character);
  if (ccFrom === 'title') void begin();
  else setState(ccFrom);
}
$('ccBegin').addEventListener('click', () => closeCharCreate());
$('ccSkip').addEventListener('click', () => {
  character = { ...character, created: true };
  saveCharacter(character);
  if (ccFrom === 'title') void begin();
  else setState(ccFrom);
});
$('editCharacter').addEventListener('click', () => openCharCreate('pause'));

$('begin').addEventListener('click', (e) => {
  if ((e as PointerEvent).pointerType === 'touch') setMode('touch');
  if (!character.created) { openCharCreate('title'); return; }
  void begin();
});

function pause() {
  if (state !== 'play') return;
  if (document.pointerLockElement) { expectUnlock = true; document.exitPointerLock(); }
  pauseFrom = 'play';
  setState('pause');
}

async function resumePlay() {
  setState('play');
  if (!lockSupported || inputMode !== 'mouse') return;
  const ok = await requestLock();
  // Browsers refuse a re-lock right after Esc or without a user gesture: ask for one click.
  if (!ok && state === 'play') setState('resume');
}
// F1.3: Settings is also reachable from the title screen (no play session to resume to).
let pauseFrom: State = 'play';
function closePauseMenu() { if (pauseFrom === 'title') setState('title'); else void resumePlay(); }
$('openSettingsTitle').addEventListener('click', () => { pauseFrom = 'title'; setState('pause'); });
$('resume').addEventListener('click', () => closePauseMenu());
$('relockBtn').addEventListener('click', () => void resumePlay());

// ---------- F3 dialogue + inventory ----------
const dialogue = new DialogueBox();
const inventory = new Inventory();
inventory.root.querySelector('.inv-close')!.addEventListener('click', () => closeInventory());
// ---------- F4 crossbow ----------
world.scene.add(camera);   // the first-person crossbow rides on the camera
const crossbow = new Crossbow(world.scene, camera, player, inventory, world.solids, () => settings.fov);
crossbow.onFire = () => audio.crossbowTwang();
crossbow.onReloadClick = () => audio.reloadClick();
const ammoText = $('ammoText'), reloadBar = $('reloadBar'), reloadFill = reloadBar.querySelector<HTMLElement>('.fill')!;
reloadBar.querySelector<HTMLElement>('.zone')!.style.cssText = `left:${ZONE.start * 100}%;width:${(ZONE.end - ZONE.start) * 100}%`;
function updateAmmoHud() {
  show('ammo', crossbow.equipped);
  if (!crossbow.equipped) return;
  const r = crossbow.reload;
  const st = r.active ? (r.mode === 'jam' ? 'JAMMED' : r.mode === 'fast' ? 'Perfect!' : 'Reloading… R in the bright zone') : crossbow.loaded ? (crossbow.bonusNextShot ? 'Loaded · 2× damage' : 'Loaded') : 'Empty · R to reload';
  const t = `Bolts ${inventory.count('bolt')} · ${st}`;
  if (ammoText.textContent !== t) ammoText.textContent = t;
  show('reloadBar', r.active);
  if (r.active) reloadFill.style.width = Math.min(100, (r.t / (r.mode === 'normal' ? 2 : r.total)) * 100) + '%';
  reloadBar.classList.toggle('jam', r.active && r.mode === 'jam');
}
function fire() {
  if (state !== 'play' || !crossbow.equipped) return;
  if (!crossbow.fire() && !crossbow.loaded && !crossbow.reloading) toast(inventory.count('bolt') ? 'Empty: press R to reload' : 'No bolts left. Pick spent ones up with E.', 1800);
}
function equip(on: boolean) {
  if (on && !crossbow.equip()) { toast('You have no crossbow yet.', 1800); return; }
  if (!on) crossbow.unequip();
}
let toastTimer = 0;
function toast(msg: string, ms = 3000) {
  const el = $('toast');
  el.textContent = msg;
  show('toast', true);
  clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => show('toast', false), ms);
}
// F3.4: dialogue actions. `give:<item>:<n>` happens once per session per node, so talking again is safe.
const givenOnce = new Set<string>();
dialogue.onAction = (a) => {
  const [verb, id, n] = a.split(':');
  if (verb === 'give') {
    if (givenOnce.has(a)) return;
    givenOnce.add(a);
    inventory.give(id, Number(n) || 1);
    toast(`Received ${ITEMS[id]?.name ?? id} × ${Number(n) || 1} (I: inventory)`);
  } else if (verb === 'unlock' && id === 'library_door') {
    world.openDoor();
  } else console.warn('Unknown dialogue action', a);
};
dialogue.onLine = () => audio.pageTurn();
dialogue.onEnd = () => {
  if (world.doorOpen) toast('The library door is open.');
  void resumePlay();
};
function talkToNatalie() {
  setState('dialogue');   // F3.3: frees the pointer, freezes movement
  if (document.pointerLockElement) { expectUnlock = true; document.exitPointerLock(); }
  dialogue.start(natalieScript as DialogueScript);
}
function openInventory() {
  if (state !== 'play') return;
  if (document.pointerLockElement) { expectUnlock = true; document.exitPointerLock(); }
  inventory.render();
  setState('inventory');
}
function closeInventory() { if (state === 'inventory') void resumePlay(); }
function activate() {
  if (state !== 'play') return;
  if (lookingAt === 'book') void openBook();
  else if (lookingAt === 'natalie') talkToNatalie();
  else if (lookingAt === 'library' && libraryHit) useLibrary(libraryHit);
  else if (lookingAt === 'bolt') {
    const b = crossbow.boltAt(player.eyePos, lookDir, controls.activateRange);
    if (b) { crossbow.pickUp(b); toast('Bolt recovered', 1200); }
  }
}

// ---------- F5 shelves: grey books (roll table), red books + artifacts (reader) ----------
function useLibrary(h: LibraryHit) {
  if (h.kind === 'relic') { toast('A shard of the Noctavel Portal hums in its cradle. The fire never reached it.', 4000); return; }
  if (h.kind === 'grey') { toast(greyBooks.lines[Math.floor(Math.random() * greyBooks.lines.length)], 3000); audio.pageTurn(); return; }   // F5.3
  const e = entryById.get(h.slug);
  if (!e) return;
  if (e.type === 'song') {
    // §6.1: the music box plays the chord line (first "chords:" line of the lyrics).
    const chords = /^\s*chords:\s*(.+)$/mi.exec(e.body)?.[1] ?? 'C G Am F';
    audio.arpeggio(chords);
  }
  void openReader(e.id);
}
async function openReader(slug: string) {
  const e = entryById.get(slug);
  if (!e) return;
  setState('book');
  if (document.pointerLockElement) { expectUnlock = true; document.exitPointerLock(); }
  await reader.openEntries([e]);
}
reader.onClose = () => void resumePlay();
// F5.6: following a link closes the current book and opens the linked one; a broken link is plain text.
const followLink = (slug: string) => { if (entryById.has(slug)) void reader.openEntries([entryById.get(slug)!]); };
reader.onLink = followLink;
book.onLink = (slug) => { book.close(); void openReader(slug); };

// ---------- book open / close (F3.2, F3.6) ----------
async function openBook() {
  setState('book');
  if (document.pointerLockElement) { expectUnlock = true; document.exitPointerLock(); }
  await book.open();
}
book.onClose = () => void resumePlay();
$('prompt').addEventListener('click', () => activate());

// ---------- lore editor (backlog item promoted 2026-10-18) ----------
let editorFrom: State = 'title';
const eAuthor = $<HTMLInputElement>('eAuthor'), eTitle = $<HTMLInputElement>('eTitle');
const eTags = $<HTMLInputElement>('eTags'), eBody = $<HTMLTextAreaElement>('eBody'), eMsg = $('eMsg');
const ghOwner = $<HTMLInputElement>('ghOwner'), ghRepo = $<HTMLInputElement>('ghRepo');
const ghBranch = $<HTMLInputElement>('ghBranch'), ghToken = $<HTMLInputElement>('ghToken');

function openEditor() {
  editorFrom = state;
  if (state === 'play' && document.pointerLockElement) { expectUnlock = true; document.exitPointerLock(); }
  const gh = loadGitHub();
  ghOwner.value = gh.owner; ghRepo.value = gh.repo; ghBranch.value = gh.branch; ghToken.value = gh.token;
  eAuthor.value = loadAuthor();
  eMsg.textContent = '';
  setState('editor');
  eTitle.focus();
}
function closeEditor() {
  if (editorFrom === 'play') void resumePlay();
  else setState(editorFrom);
}
$('writeLoreTitle').addEventListener('click', () => openEditor());
$('writeLorePause').addEventListener('click', () => openEditor());
$('writeLoreHud').addEventListener('click', () => { if (state === 'play') openEditor(); });
$('eCancel').addEventListener('click', () => closeEditor());
$('ghSave').addEventListener('click', () => {
  saveGitHub({ owner: ghOwner.value.trim(), repo: ghRepo.value.trim(), branch: ghBranch.value.trim() || 'main', token: ghToken.value.trim() });
  eMsg.textContent = 'Publish settings saved in this browser.';
});

function entryFromForm(): { title: string; tags: string[]; slug: string; markdown: string } | null {
  const title = eTitle.value.trim(), author = eAuthor.value.trim();
  if (!title || !author) { eMsg.textContent = 'Title and your name are both required.'; return null; }
  const tags = eTags.value.split(',').map((t) => t.trim()).filter(Boolean);
  saveAuthor(author);
  return { title, tags, slug: slugify(title), markdown: buildMarkdown(title, author, tags, eBody.value) };
}
$('eDownload').addEventListener('click', () => {
  const e = entryFromForm();
  if (!e) return;
  downloadMarkdown(e.slug, e.markdown);
  eMsg.textContent = `Downloaded ${e.slug}.md — upload it into content/lore/ on github.com (Add file → Upload files), then commit.`;
});
$('ePublish').addEventListener('click', () => {
  const e = entryFromForm();
  if (!e) return;
  saveGitHub({ owner: ghOwner.value.trim(), repo: ghRepo.value.trim(), branch: ghBranch.value.trim() || 'main', token: ghToken.value.trim() });
  eMsg.textContent = 'Publishing…';
  void publishToGitHub(loadGitHub(), e.slug, e.markdown, e.title).then((r) => {
    if (r.ok) {
      eMsg.textContent = `Published. The site rebuilds in ~1–2 min — check ${r.actionsUrl}`;
      eTitle.value = ''; eTags.value = ''; eBody.value = '';
    } else {
      eMsg.textContent = `Couldn't publish: ${r.error} You can still use "Download .md" instead.`;
    }
  });
});

// ---------- touch + gamepad ----------
const hooks: GameHooks = {
  state: () => state,
  player,
  get book() { return reader.isOpen ? reader : book; },
  begin: () => void begin(),
  pause,
  resume: () => void resumePlay(),
  activate,
  lookingAtBook: () => lookingAt !== null,
  advanceDialogue: () => dialogue.advance(),
  closeInventory,
  openInventory,
  crossbow,
  fire,
  hasCrossbow: () => inventory.count('crossbow') > 0,
  toggleRun: () => toggleRun(),
  setMode,
};
const touch: TouchControls | null = new TouchControls(hooks);
const gamepad = new GamepadControls(hooks, () => settings.sensitivity);
document.body.dataset.input = inputMode;
$('begin').textContent = inputMode === 'touch' ? 'Tap to begin' : 'Click to begin';

// ---------- keyboard (F2.1) ----------
const MOVE: Action[] = ['forward', 'left', 'back', 'right', 'walk', 'sprint'];
const ALL: Action[] = ['forward', 'left', 'back', 'right', 'walk', 'toggleRun', 'sprint', 'jump', 'sneak', 'activate', 'pov', 'close', 'pause'];
let capsToggledAt = -1e9;

function toggleRun() {
  settings.alwaysRun = !settings.alwaysRun;
  saveSettings(settings);
  ($('always') as HTMLInputElement).checked = settings.alwaysRun;
}

window.addEventListener('keydown', (e) => {
  setMode('mouse');
  // Keys the browser would otherwise act on (focus change, menu bar, scrolling).
  if (['Tab', 'AltLeft', 'AltRight', 'Space', 'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(e.code) && !['pause', 'editor', 'charcreate'].includes(state)) e.preventDefault();
  if (e.code === 'CapsLock') {
    // Some platforms (macOS) send only a keyup when Caps Lock turns off; see keyup below.
    if (state === 'play' && !e.repeat) { toggleRun(); capsToggledAt = performance.now(); }
    return;
  }
  if (state === 'book') { if (!e.repeat) (reader.isOpen ? reader : book).handleKey(e.code); return; }   // F3.2: world input ignored
  if (state === 'editor') { if (e.code === 'Escape' && !e.repeat) closeEditor(); return; }  // text fields handle their own typing
  if (state === 'charcreate') { if (e.code === 'Escape' && !e.repeat) closeCharCreate(); return; }
  if (state === 'dialogue') { if (!e.repeat) dialogue.handleKey(e.code); return; }   // F3.3: movement frozen
  if (state === 'inventory') { if (!e.repeat && ['KeyI', 'Tab', 'Escape'].includes(e.code)) closeInventory(); return; }
  if (state === 'pause' && e.code === 'Escape' && !lockSupported) { closePauseMenu(); return; }
  if (state !== 'play') return;
  if (e.code === 'KeyL' && !e.repeat) { openEditor(); return; }
  if (actionFor(e.code, ['inventory']) && !e.repeat) { openInventory(); return; }
  if (!e.repeat) {
    const w = actionFor(e.code, ['equipCrossbow', 'equipHands', 'reload']);
    if (w === 'equipCrossbow') { equip(true); return; }
    if (w === 'equipHands') { equip(false); return; }
    if (w === 'reload') { crossbow.pressReload(); return; }
  }
  const a = actionFor(e.code, ALL);
  if (!a) return;
  if (MOVE.includes(a)) { player.held.add(a); return; }
  if (e.repeat) return;
  if (a === 'jump') player.jump();
  else if (a === 'sneak') player.toggleSneak();
  else if (a === 'pov') player.togglePOV();
  else if (a === 'toggleRun') toggleRun();
  else if (a === 'activate') activate();
  else if (a === 'pause') { pauseFrom = 'play'; setState('pause'); }   // only reaches here when the pointer isn't locked
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
window.addEventListener('mousedown', (e) => {
  if (state !== 'play') return;
  if (e.button === 0) { mouseHeld = true; if (crossbow.equipped && (e.target === canvas || document.pointerLockElement)) fire(); }   // F4.1 LMB fires
  if (e.button === 2) crossbow.setADS(true);                                // F4.1 RMB aims
});
window.addEventListener('mouseup', (e) => { if (e.button === 0) mouseHeld = false; if (e.button === 2) crossbow.setADS(false); });
canvas.addEventListener('contextmenu', (e) => e.preventDefault());
canvas.addEventListener('click', () => { if (state === 'dialogue') dialogue.advance(); });
window.addEventListener('mousemove', (e) => {
  if (state !== 'play') return;
  const locked = document.pointerLockElement === canvas;
  if (inputMode !== 'mouse') return;
  if (locked || (!lockSupported && mouseHeld)) player.look(e.movementX, e.movementY);
});

// ---------- pause menu (F1.1 / F1.2 / F2.3) ----------
$('versionLabel').textContent = 'v' + VERSION;
$('credit').textContent = `v${VERSION} · ${AUTHOR}`;
const dailyPrompt = promptOfTheDay();
$('dailyPrompt').textContent = dailyPrompt;   // §8 0.03 creativity check
const sens = $<HTMLInputElement>('sens'), fov = $<HTMLInputElement>('fov');
const inv = $<HTMLInputElement>('invert'), always = $<HTMLInputElement>('always');
const presetSel = $<HTMLSelectElement>('preset'), renderScaleEl = $<HTMLInputElement>('renderScale');
const shadowsEl = $<HTMLInputElement>('shadows'), postFxEl = $<HTMLInputElement>('postFx');
const fogDistanceEl = $<HTMLInputElement>('fogDistance'), fpsCapSel = $<HTMLSelectElement>('fpsCap');
const audioEls = {
  master: $<HTMLInputElement>('audioMaster'), muteMaster: $<HTMLInputElement>('muteMaster'),
  music: $<HTMLInputElement>('audioMusic'), muteMusic: $<HTMLInputElement>('muteMusic'),
  sfx: $<HTMLInputElement>('audioSfx'), muteSfx: $<HTMLInputElement>('muteSfx'),
  dialogue: $<HTMLInputElement>('audioDialogue'), muteDialogue: $<HTMLInputElement>('muteDialogue'),
};
function syncMenu() {
  sens.value = String(settings.sensitivity); $('sensOut').textContent = settings.sensitivity.toFixed(2);
  fov.value = String(settings.fov); $('fovOut').textContent = settings.fov + '°';
  inv.checked = settings.invertY; always.checked = settings.alwaysRun;
  presetSel.value = settings.preset;
  renderScaleEl.value = String(settings.renderScale); $('renderScaleOut').textContent = settings.renderScale + '%';
  shadowsEl.checked = settings.shadows; postFxEl.checked = settings.postFx;
  fogDistanceEl.value = String(settings.fogDistance); $('fogOut').textContent = settings.fogDistance + ' m';
  fpsCapSel.value = String(settings.fpsCap);
  audioEls.master.value = String(settings.audio.master); $('audioMasterOut').textContent = settings.audio.master + '%';
  audioEls.muteMaster.checked = settings.audio.muteMaster;
  audioEls.music.value = String(settings.audio.music); $('audioMusicOut').textContent = settings.audio.music + '%';
  audioEls.muteMusic.checked = settings.audio.muteMusic;
  audioEls.sfx.value = String(settings.audio.sfx); $('audioSfxOut').textContent = settings.audio.sfx + '%';
  audioEls.muteSfx.checked = settings.audio.muteSfx;
  audioEls.dialogue.value = String(settings.audio.dialogue); $('audioDialogueOut').textContent = settings.audio.dialogue + '%';
  audioEls.muteDialogue.checked = settings.audio.muteDialogue;
}
sens.addEventListener('input', () => { settings.sensitivity = Number(sens.value); saveSettings(settings); syncMenu(); });
fov.addEventListener('input', () => {
  settings.fov = Number(fov.value); saveSettings(settings); syncMenu();
  camera.fov = settings.fov; camera.updateProjectionMatrix();
});
inv.addEventListener('change', () => { settings.invertY = inv.checked; saveSettings(settings); });
always.addEventListener('change', () => { settings.alwaysRun = always.checked; saveSettings(settings); });

// F1.1 graphics — a preset fills every slider below it; each slider then applies live on its own.
presetSel.addEventListener('change', () => {
  const p = presetSel.value as Preset;
  settings.preset = p;
  Object.assign(settings, PRESETS[p]);
  saveSettings(settings); syncMenu();
  applyRenderScale(); renderer.shadowMap.enabled = settings.shadows; world.setShadows(settings.shadows);
  post?.setEnabled(settings.postFx); world.setFogDistance(settings.fogDistance);
});
renderScaleEl.addEventListener('input', () => { settings.renderScale = Number(renderScaleEl.value); saveSettings(settings); syncMenu(); applyRenderScale(); });
shadowsEl.addEventListener('change', () => { settings.shadows = shadowsEl.checked; saveSettings(settings); renderer.shadowMap.enabled = settings.shadows; world.setShadows(settings.shadows); });
postFxEl.addEventListener('change', () => { settings.postFx = postFxEl.checked; saveSettings(settings); post?.setEnabled(settings.postFx); });
fogDistanceEl.addEventListener('input', () => { settings.fogDistance = Number(fogDistanceEl.value); saveSettings(settings); syncMenu(); world.setFogDistance(settings.fogDistance); });
fpsCapSel.addEventListener('change', () => { settings.fpsCap = Number(fpsCapSel.value) as FpsCap; saveSettings(settings); });

// F1.2 audio — one GainNode per bus; a slider/mute only ever touches its own bus (src/audio.ts).
(['master', 'music', 'sfx', 'dialogue'] as const).forEach((b) => {
  audioEls[b].addEventListener('input', () => { settings.audio[b] = Number(audioEls[b].value); saveSettings(settings); syncMenu(); audio.setLevel(b, settings.audio[b]); });
  const muteKey = ('mute' + b[0].toUpperCase() + b.slice(1)) as 'muteMaster' | 'muteMusic' | 'muteSfx' | 'muteDialogue';
  audioEls[muteKey].addEventListener('change', () => { settings.audio[muteKey] = audioEls[muteKey].checked; saveSettings(settings); audio.setMuted(b, settings.audio[muteKey]); });
});
syncMenu();

// ---------- frame loop ----------
const ray = new THREE.Raycaster();
ray.far = controls.activateRange;
const lookDir = new THREE.Vector3();
const clock = new THREE.Clock();
const statusEl = $('status');
function libraryVerb(h: LibraryHit): string {
  if (h.kind === 'relic') return 'Look at the Noctavel shard';
  if (h.kind === 'grey') return 'Read a grey book';
  const e = entryById.get(h.slug);
  if (!e) return 'Read';
  const t = e.title.length > 34 ? e.title.slice(0, 33) + '…' : e.title;
  return e.type === 'song' ? `Play "${t}"` : e.type === 'character' ? `Meet ${t}` : e.type === 'art' ? `Look at "${t}"` : `Read "${t}"`;
}
const promptVerb = $('promptVerb');
let lastStatus = '';
const perf = { frames: 0, cpuMs: 0, worstMs: 0, simSeconds: 0 };
const SIM_STEP = 1 / 120;
let simAcc = 0;
let stepTimer = 0;
let lastFrameAt = 0;
const MOVE_ACTIONS: Action[] = ['forward', 'left', 'back', 'right'];

function frame() {
  requestAnimationFrame(frame);
  // F1.1 FPS cap: 30/60/∞. Skipping the whole body (not just the render call) also skips
  // clock.getDelta() here, so the sim still advances correctly in bigger steps next time.
  const now = performance.now();
  const minFrameMs = settings.fpsCap > 0 ? 1000 / settings.fpsCap : 0;
  if (minFrameMs > 0 && now - lastFrameAt < minFrameMs) return;
  lastFrameAt = now;
  const t0 = now;
  // Fixed 120 Hz simulation steps: speeds and jump height stay exact even when frames are slow.
  // Long stalls (tab in background) are capped at 0.25 s so the player doesn't teleport.
  const dt = Math.min(clock.getDelta(), 0.25);
  world.update(clock.elapsedTime, camera);
  library.relic.rotation.y = clock.elapsedTime * 0.6;   // the Noctavel shard turns slowly
  gamepad.update();
  if (state === 'play') {
    simAcc += dt;
    while (simAcc >= SIM_STEP) {
      player.update(SIM_STEP); simAcc -= SIM_STEP; perf.simSeconds += SIM_STEP;
      // A7: footsteps while actually moving (not just holding a speed modifier) and not sneaking.
      const moving = MOVE_ACTIONS.some((a) => player.held.has(a)) || Math.hypot(player.analog.x, player.analog.y) > 0.05;
      if (moving && !player.sneaking) {
        stepTimer -= SIM_STEP;
        if (stepTimer <= 0) { audio.footstep(); stepTimer = 2.2 / Math.max(1, player.speed()); }
      } else stepTimer = 0;
    }
    // F3.1: 2 m reach from the eyes along the view direction (same in 1st and 3rd person, F2.4).
    camera.getWorldDirection(lookDir);
    ray.set(player.eyePos, lookDir);
    const hit = ray.intersectObjects([world.bookTarget, world.natalieTarget, ...library.targets], false)[0];
    libraryHit = (hit?.object.userData.hit as LibraryHit | undefined) ?? null;
    lookingAt = !hit ? null : hit.object === world.bookTarget ? 'book' : hit.object === world.natalieTarget ? 'natalie' : 'library';
    if (!lookingAt && crossbow.boltAt(player.eyePos, lookDir, controls.activateRange)) lookingAt = 'bolt';   // F4.4
    show('prompt', lookingAt !== null);
    const verb = lookingAt === 'natalie' ? 'Talk to Natalie' : lookingAt === 'bolt' ? 'Pick up bolt'
      : lookingAt === 'library' && libraryHit ? libraryVerb(libraryHit) : 'Read';
    if (promptVerb.textContent !== verb) promptVerb.textContent = verb;
    const s = (player.sneaking ? 'SNEAK' : player.speed() === controls.speeds.sprint ? 'SPRINT' : player.speed() === controls.speeds.run ? 'RUN' : 'WALK')
      + (settings.alwaysRun ? '' : ' · always-run off');
    if (s !== lastStatus) { statusEl.textContent = s; lastStatus = s; }
    crossbow.update(dt);
    touch?.update();
  } else { lookingAt = null; crossbow.setADS(false); }
  updateAmmoHud();
  post!.render(world.scene, camera);
  const ms = performance.now() - t0;
  perf.frames++; perf.cpuMs += ms; perf.worstMs = Math.max(perf.worstMs, ms);
}
setState('title');
frame();
// F2.1: everything is built and the first frame is drawn; fade in from black over 2 s (no pop-in).
renderer.compile(world.scene, camera);
progress(100);
requestAnimationFrame(() => requestAnimationFrame(() => {
  const loader = document.getElementById('loader');
  if (!loader) return;
  loader.classList.add('done');
  setTimeout(() => loader.remove(), 2100);
}));

// Debug/test hook (read-only use in automated checks; harmless in play).
Object.assign(window, { __gametool: { get state() { return state; }, get inputMode() { return inputMode; }, get character() { return character; }, dailyPrompt, dialogue, inventory, crossbow, reader, library, modelsReady, loadedModels, failedModels, camera, Box3: THREE.Box3, Raycaster: THREE.Raycaster, Vector3: THREE.Vector3, player, book, renderer, world, perf, settings, audio, lockSupported: () => lockSupported } });
