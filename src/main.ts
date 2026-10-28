import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { updateSprites, setSpriteCharacters } from './render/sprites';
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
import { CameraRig } from './camera/rig';
import { fillSlots, loadedModels, failedModels, animators, type ModelSlot, type AnimState } from './models';
import { FigureAnim, BodyAnim, type AnimInput } from './anim/procedural';
import { Dust } from './fx/dust';
import { CharacterForge, loadForge, type ForgeCharacter } from './forge/character';
import { WeaponForge, loadWeapon, buildCrossbowModel, type WeaponCosmetic } from './forge/weapon';
import { MarginDesk, loadStationery, saveStationery, applyStationery, loadMargins, type Stationery } from './writing/margins';
import { SketchPad, sketchById, DEFAULT_SKETCH, type Sketch } from './writing/sketch';
import { stampBanner, swayBanner, paintLecternPage, buildBookmarks } from './writing/stamps';
import { QUEST, loadQuest, saveQuest, clueById, support, ending, tagLabel, type Theory } from './quest/quest';
import { Casebook } from './quest/casebook';
import { QuestProps } from './quest/props';
import { Companion, loadCompanion, saveCompanion } from './quest/companion';
import { FolklorePanel, folkItems, pedlarScript } from './quest/folklore';
import { CampfirePanel } from './campfire/campfire';
import { loadBallads, balladEntry, decodeTune, SCALE, type Ballad } from './campfire/ballad';
import { Gallery, GALLERY, type Exhibit } from './campfire/gallery';
import { buildDojo, DojoPanel, DOJO } from './dojo/dojo';
import './dojo/dojo.css';
import { drawSketch, loadSketches } from './writing/sketch';
import { Dungeon } from './dungeon/dungeon';
import { dailySeed, seedFrom } from './dungeon/gen';
import { LivingMap, type Mark } from './map/livingmap';
import { haptics } from './input/haptics';
import { Torch } from './torch';
import { HeldBook } from './heldBook';
import { ShopPanel, CROWN } from './shop';
import { TOWN_NAMES, type TownId } from './world/town';
import { NEXT_TIME, type TimeOfDay } from './world/sky';
import { glyph, type PadFamily } from './input/glyphs';

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
const FOLIAGE = { low: 0.35, medium: 0.6, high: 1 } as const;   // R3 perf: undergrowth density per preset
world.setFoliage(FOLIAGE[settings.preset]);
post = new Post(renderer, world.scene, camera);
post.setSize(window.innerWidth, window.innerHeight);
post.setEnabled(settings.postFx);
const player = new Player(settings, world.colliders, world.bounds);
player.terrain = (x, z) => (inDungeon ? 0 : world.heightAt(x, z));   // v0.04 hills (the dungeon floor is flat)
player.spawn(world.spawn.pos, world.spawn.yaw);
// R3: the camera rig places the camera (follow / first person / framed shots); the player only moves.
const rig = new CameraRig(camera, player, world.colliders, world.bounds, () => settings.fov);
player.zoomBy = (d) => stepView(rig.zoomBy(d));   // pinch / right stick: steps through the 5 distances
rig.update(0);
world.scene.add(player.body);
const torch = new Torch(world.scene, camera, player);   // v0.04
const heldBook = new HeldBook(player);   // v0.04: the 'read' pose holds an open book (shelf reader)
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
        <tr><td>Buttons</td><td>Jump · Sneak · Sprint (hold) · View · Use · − / + camera · ☰ menu</td></tr>
        <tr><td>Book</td><td>Swipe or tap a page edge · ✕ to close</td></tr>
      </table>
      <div class="padmap only-pad" data-padmap></div>
      <table class="keys only-mouse">
        <tr><td>W A S D</td><td>Move (runs by default)</td><td>Mouse</td><td>Look</td></tr>
        <tr><td>Shift</td><td>Walk (hold)</td><td>Caps Lock</td><td>Toggle always-run</td></tr>
        <tr><td>Alt</td><td>Sprint (hold)</td><td>Space</td><td>Jump</td></tr>
        <tr><td>C</td><td>Sneak / crouch</td><td>E</td><td>Read the book</td></tr>
        <tr><td>Tab</td><td>Close book</td><td>Esc</td><td>Pause menu</td></tr>
        <tr><td>F</td><td>Third / first person</td><td>Wheel</td><td>Camera distance (5 steps)</td></tr>
        <tr><td>E at the fire</td><td>Write lore</td><td>T</td><td>Torch</td></tr>
      </table>
      <p class="fine">Private project · all rights reserved.</p>
    </div>
  </div>
  <div id="vignette"></div>
  <div id="sleepFade"></div>
  <div id="rotateHint">⟳ Turn your phone sideways to play</div>
  <div id="readHint">⟳ Turn your phone upright to scroll the pages</div>
  <div id="hud" class="hidden">
    <div id="crosshair"></div>
    <div id="prompt" class="hidden"><kbd>E</kbd> — <span id="promptVerb">Read</span></div>
    <div id="toast" class="hidden"></div>
    <div id="quick" class="hidden"></div>
    <div id="ammo" class="hidden"><span id="ammoText"></span><div id="reloadBar" class="hidden"><i class="zone"></i><i class="fill"></i></div></div>
    <div id="status"></div>
    <div id="nolock" class="hidden">Pointer lock unavailable here: hold the left mouse button and drag to look.</div>
  </div>
  <div id="pause" class="screen hidden">
    <div class="card narrow">
      <h1>Paused</h1>
      <button id="resume" class="primary">Resume</button>
      <label>Look sensitivity <output id="sensOut"></output><input id="sens" type="range" min="0.2" max="3" step="0.05"></label>
      <label>Field of view <output id="fovOut"></output><input id="fov" type="range" min="60" max="100" step="1"></label>
      <label>Camera <select id="viewSel"><option value="follow">Follow (Dark Cloud 2 style)</option><option value="first">First person</option></select></label>
      <label>Characters <select id="charsSel"><option value="hybrid">3D bodies, drawn heads</option><option value="sprite">Pixel sprites</option></select></label>
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
      <label class="check"><input id="haptics" type="checkbox"> Vibration (controller rumble, phone buzz)</label>
      <details id="controlsMap">
        <summary>Controls</summary>
        <div class="padmap" data-padmap></div>
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
      <button id="openCharacterForge" class="secondary">Character forge</button>
      <button id="openWeaponForge" class="secondary">Weapon forge</button>
      <button id="openSketchbook" class="secondary">Sketchbook</button>
      <button id="openCasebook" class="secondary">Casebook (J)</button>
      <button id="openMap" class="secondary">Map (M)</button>
      <label class="check"><input id="companionQuiet" type="checkbox"> Quiet companion (Natalie keeps her thoughts to herself)</label>
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
// Storybook restyle S1: the follow view plays with a free cursor (hover and click things, drag to turn).
// Pointer lock is only for first person (F, or aiming the crossbow) with a mouse.
const wantLock = () => inputMode === 'mouse' && !player.thirdPerson;
const cursor = { x: 0, y: 0, on: false, downX: 0, downY: 0, dragged: false };
let rightHeld = false;
let lookingAt: 'book' | 'natalie' | 'bolt' | 'library' | 'thing' | null = null;
// Phase B+: things in the world E can use (forge stations, and later quests, campfire, map...).
interface Interactable { obj: THREE.Object3D; verb: () => string; act: () => void; when?: () => boolean }
const interactables: Interactable[] = [];
let lookingAtThing: Interactable | null = null;
let libraryHit: LibraryHit | null = null;   // F3.1 / F3: what E would activate
let inputMode: InputMode = coarse ? 'touch' : 'mouse';

function setMode(m: InputMode) {
  if (m === inputMode) return;
  inputMode = m;
  document.body.dataset.input = m;
  haptics.setMode(m);
  syncGlyphs();
  show('nolock', state === 'play' && !lockSupported && m === 'mouse' && !player.thirdPerson);
}

// v0.04: the controller map, drawn from controls.gamepad with the pad's own button names.
const PAD_MAP: [side: 'l' | 'r', button: number | string, what: string][] = [
  ['l', 6, 'Aim (crossbow)'], ['l', 4, 'Camera in · page back'], ['l', 'Left stick', 'Move · click: sprint'],
  ['l', 12, 'Crossbow / hands'], ['l', 14, 'Quick swap: left hand (torch)'], ['l', 13, 'Hold: torch'], ['l', 8, 'Bag'],
  ['r', 7, 'Fire'], ['r', 15, 'Quick swap: right hand'], ['r', 5, 'Camera out · page on'], ['r', 3, 'Jump'], ['r', 2, 'Reload'], ['r', 1, 'Sneak · back'],
  ['r', 0, 'Use · talk · read'], ['r', 'Right stick', 'Look · click: first person'], ['r', 9, 'Pause'],
];
function renderPadMap(fam: PadFamily) {
  const row = ([, b, what]: (typeof PAD_MAP)[number]) =>
    `<li><kbd class="${typeof b === 'number' && b <= 3 ? 'face face' + b : ''}">${typeof b === 'number' ? glyph(fam, b) : b}</kbd><span>${what}</span></li>`;
  const html = `<ul class="l">${PAD_MAP.filter((r) => r[0] === 'l').map(row).join('')}</ul><ul class="r">${PAD_MAP.filter((r) => r[0] === 'r').map(row).join('')}</ul>`;
  document.querySelectorAll('[data-padmap]').forEach((el) => { el.innerHTML = html; });
}

// v0.04: button names follow the input in use (and the pad's family: Xbox, PlayStation, Nintendo).
function syncGlyphs() {
  const fam = gamepad?.family ?? 'xbox', A = glyph(fam, controls.gamepad.buttons.activate);
  $('begin').textContent = inputMode === 'touch' ? 'Tap to begin' : inputMode === 'pad' ? `Press ${A} to begin` : 'Click to begin';
  $('prompt').querySelector('kbd')!.textContent = inputMode === 'pad' ? A : 'E';
  document.body.dataset.pad = fam;
  renderPadMap(fam);
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
  show('nolock', s === 'play' && !lockSupported && wantLock());
  cursor.on = false;   // a stale cursor never picks a target after a menu closes
  if (s !== 'play') {
    player.held.clear(); mouseHeld = false; show('prompt', false);
    player.analog.x = player.analog.y = player.analogLook.x = player.analogLook.y = 0;
    touch?.reset();
  }
  document.body.dataset.state = s;
  if (s !== 'dialogue' && s !== 'book' && s !== 'forge') rig.setShot(null);   // R3: framed shots only while reading or talking
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
  player.thirdPerson = settings.view !== 'first';
  document.body.dataset.view = settings.view;
  setState('play');                             // in the world immediately, even before lock resolves
  audio.resume(); audio.startWind();            // F1.2/A7: first user gesture unlocks WebAudio
  if (inputMode === 'touch') {
    // Android: go fullscreen. iPhone Safari has no element fullscreen; Add to Home Screen does it.
    // v0.04: landscape first. Orientation lock only works in fullscreen (Android); elsewhere a hint asks.
    document.documentElement.requestFullscreen?.({ navigationUI: 'hide' })
      .then(() => (screen.orientation as ScreenOrientation & { lock?: (o: string) => Promise<void> }).lock?.('landscape'))
      .catch(() => undefined);
    return;
  }
  if (!wantLock()) return;                       // follow view / gamepad: no pointer lock needed
  lockSupported = await requestLock();
  show('nolock', state === 'play' && !lockSupported && wantLock());
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
$('openCharacterForge').addEventListener('click', () => openCharacterForge());
$('openWeaponForge').addEventListener('click', () => openWeaponForge());
$('openSketchbook').addEventListener('click', () => openSketchbook());
$('openCasebook').addEventListener('click', () => openCasebook());
$('openMap').addEventListener('click', () => openMap());

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
  if (!lockSupported || !wantLock()) return;
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
const crossbow = new Crossbow(world.scene, camera, player, inventory, world.solids, () => rig.playFov);
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
  if (crossbow.fire()) { haptics.play('fire'); return; }
  if (!crossbow.loaded && !crossbow.reloading) toast(inventory.count('bolt') ? 'Empty: press R to reload' : 'No bolts left. Pick spent ones up with E.', 1800);
}
function equip(on: boolean) {
  if (on && !crossbow.equip()) { toast('You have no crossbow yet.', 1800); return; }
  if (!on) crossbow.unequip();
}
// R3: the crossbow is aimed in first person (viewmodel); putting it away restores the previous view.
// Watched per frame so keyboard, touch and gamepad equips all behave the same.
let viewBeforeCrossbow: boolean | null = null;
// Phase A (B1): every character animates. A .glb with clips plays them (src/models.ts Animator); a
// .glb without clips moves as a whole (BodyAnim); the built-in rigged figures run the procedural rig.
interface Puppet { root: THREE.Object3D; fig?: FigureAnim; body?: BodyAnim }
const puppets = new Map<string, Puppet>();
const figureOf = (o: THREE.Object3D): Puppet => ({ root: o, fig: o.userData.rig ? new FigureAnim(o.userData.rig) : undefined });
for (const [id, o] of Object.entries(world.standees)) puppets.set(id, figureOf(o));
puppets.set('player', figureOf(player.body.children[0]));
let libNpc = 0;
library.group.traverse((o) => { if (o.userData.rig) puppets.set(`library:${libNpc++}`, figureOf(o)); });
modelsReady.then(() => {
  for (const [id, holder] of loadedModels) {
    const p = puppets.get(id);
    if (p) puppets.set(id, { root: holder, body: animators.has(id) ? undefined : new BodyAnim(holder.children[0]) });
  }
});
const wrapAngle = (a: number) => Math.atan2(Math.sin(a), Math.cos(a));
const npcPos = new THREE.Vector3(), npcQ = new THREE.Quaternion(), npcE = new THREE.Euler();
function npcInput(id: string, root: THREE.Object3D): AnimInput | null {
  root.getWorldPosition(npcPos);
  const dx = player.pos.x - npcPos.x, dz = player.pos.z - npcPos.z, d = Math.hypot(dx, dz);
  if (d > 40) return null;   // too far to see: skip the work
  npcE.setFromQuaternion(root.getWorldQuaternion(npcQ), 'YXZ');
  // Figures face +Z: turn the head toward the player when they come close.
  const rel = wrapAngle(Math.atan2(dx, dz) - npcE.y);
  const look = d < 6 && Math.abs(rel) < 1.7 ? { yaw: rel, pitch: -Math.atan2(player.eyePos.y - 1.5, d) * 0.5 } : null;
  return { speed: id === 'natalie' ? companion.speed : 0, talking: ((id === 'natalie' || id === 'pedlar') && state === 'dialogue' && dialogueWith === id) || (id === 'natalie' && campfire.isOpen), look: id === 'natalie' && companion.speed > 0.3 ? null : look };
}
function clipState(i: AnimInput): AnimState {
  return i.talking ? 'talk' : i.aiming ? 'aim' : i.speed > controls.speeds.walk + 0.5 ? 'run' : i.speed > 0.3 ? 'walk' : 'idle';
}
// Phase A: dust at the trailing foot on running steps, a ring of it on landing.
const dust = new Dust(world.scene);
let footSide = 1;
const footAt = () => {
  footSide = -footSide;
  const s = Math.sin(player.bodyYaw), c = Math.cos(player.bodyYaw);
  return new THREE.Vector3(player.pos.x + c * 0.12 * footSide + s * 0.15, player.pos.y, player.pos.z - s * 0.12 * footSide + c * 0.15);
};
let bannerT = 0;
let lastReload: string | null = null;
let lastVaults = 0;
function animate(dt: number) {
  player.faceView = crossbow.equipped || !player.thirdPerson;
  const landed = player.consumeLanded();
  if (landed && player.thirdPerson) dust.burst(player.pos, 6, 0.35);
  if (landed) haptics.play('land');
  torch.update(dt, !player.thirdPerson);
  heldBook.set(state === 'book' && reader.isOpen);
  if (player.pos.y > 3.3 && !player.airborne) earn(5, 'a purse left on the lookout', 'lookout');
  if (quickTimer > 0 && (quickTimer -= dt) <= 0) $('quick').classList.add('hidden');
  if (player.vaults !== lastVaults) { lastVaults = player.vaults; haptics.play('jump'); }
  const rm = crossbow.reload.active ? crossbow.reload.mode : null;   // v0.04: feel the reload start and a jam
  if (rm !== lastReload) { if (rm === 'jam') haptics.play('jam'); else if (rm === 'normal') haptics.play('reload'); lastReload = rm; }
  dust.update(dt, camera);
  const mine: AnimInput = {
    speed: state === 'play' ? player.hSpeed : 0, talking: state === 'dialogue', aiming: crossbow.equipped,
    airborne: player.airborne, landed, pose: dojo.pose ?? (state === 'book' ? 'read' : null),
    look: { yaw: wrapAngle(player.yaw - player.bodyYaw), pitch: -player.pitch * 0.6 },
  };
  for (const [id, p] of puppets) {
    const input = id === 'player' ? (player.body.visible ? mine : null) : npcInput(id, p.root);
    if (!input) continue;
    p.root.userData.talking = !!input.talking;   // the 2D head's face moves its mouth (src/render/sprites.ts)
    const clips = animators.get(id);
    if (clips) clips.set(clipState(input));
    else if (p.body) p.body.update(dt, input);
    else if (p.fig) p.fig.update(dt, input);
  }
  for (const a of animators.values()) a.update(dt);
  if (weaponDisplay.visible) weaponDisplay.rotation.y += dt * 0.5;
  bannerT += dt; swayBanner(world.bannerCloth, bannerT);
  companion.update(dt, player.pos, player.bodyYaw, state !== 'play');
  questProps.update(bannerT);
  barkTick(dt);
  dungeon.update(bannerT);
  dojo.tick(dt);
  mapClock += dt; if (mapClock > 0.5) { mapClock = 0; if (!inDungeon) livingMap.reveal(player.pos.x, player.pos.z); }
  const fl = world.campfireFlame;
  fl.scale.set(1 + Math.sin(bannerT * 13) * 0.06, 1 + Math.sin(bannerT * 9.3) * 0.14 + Math.sin(bannerT * 21) * 0.06, 1 + Math.cos(bannerT * 11) * 0.06);
  fl.rotation.y = bannerT * 0.8;
  const inside = player.pos.x > GALLERY.minX - 3 && player.pos.x < GALLERY.maxX && player.pos.z > GALLERY.minZ && player.pos.z < GALLERY.maxZ;
  if (inside && !inGallery) refreshGallery();
  inGallery = inside;
}
// ---------- Phase B: forges (B4 character, B5 weapon) with B6 dice; saved on this device ----------
const loreWords = lore.entries.filter((e) => e.type === 'lore').map((e) => e.title.split(':')[0]).filter((t) => t.length < 28);
const forgeAuthor = () => loadAuthor() || character.name;
let forgeFrom: State = 'play';
function setPlayerLook(c: ForgeCharacter) {
  const fig = player.setLook(c.look, c.height);
  torch.attach();
  heldBook.attach();
  puppets.set('player', { ...puppets.get('player')!, root: fig, fig: new FigureAnim(fig.userData.rig) });
  if (loadedModels.has('player')) puppets.set('player', { root: loadedModels.get('player')!, body: animators.has('player') ? undefined : new BodyAnim(loadedModels.get('player')!.children[0]) });
}
try { if (localStorage.getItem('gametool.forge.character')) setPlayerLook(loadForge(character.name)); } catch { /* storage blocked: default look */ }
// The forge camera: a front three-quarter view of the player, with the figure in the right half of the screen.
function frameForge(target: 'body' | 'crossbow' | 'banner' | 'fire') {
  if (target === 'fire') {
    const f = world.stations.campfire.position, pos = new THREE.Vector3(f.x + 2.4, 1.5, f.z + 1.2);
    const d = new THREE.Vector3(f.x - pos.x, 0, f.z - pos.z).normalize(), right = new THREE.Vector3().crossVectors(d, new THREE.Vector3(0, 1, 0));
    rig.setShot({ pos, look: new THREE.Vector3(f.x, 0.5, f.z).addScaledVector(right, -0.9), fov: 46 });
    return;
  }
  if (target === 'banner') {
    // The banner in the right half of the screen, seen from the side it faces.
    const c = world.bannerCloth, n = new THREE.Vector3(Math.sin(c.rotation.y), 0, Math.cos(c.rotation.y));
    const pos = c.position.clone().addScaledVector(n, 2.6).add(new THREE.Vector3(0, -0.1, 0));
    const right = new THREE.Vector3().crossVectors(n.clone().negate(), new THREE.Vector3(0, 1, 0)).normalize();
    rig.setShot({ pos, look: c.position.clone().addScaledVector(right, -0.45), fov: 42 });
    return;
  }
  if (target === 'crossbow') {
    // Close on the anvil, the crossbow in the right half of the screen (the panel takes the left).
    const a = anvilSpot, top = new THREE.Vector3(a.x, 1.3, a.z);
    const pos = new THREE.Vector3(a.x + 2.1, 1.65, a.z + 0.5);
    const d = top.clone().sub(pos).normalize(), right = new THREE.Vector3().crossVectors(d, new THREE.Vector3(0, 1, 0)).normalize();
    rig.setShot({ pos, look: top.addScaledVector(right, -0.32), fov: 42 });
    return;
  }
  const fx = -Math.sin(player.bodyYaw), fz = -Math.cos(player.bodyYaw);   // body forward
  const pos = new THREE.Vector3(player.pos.x + fx * 3.0 - fz * 0.9, 1.35, player.pos.z + fz * 3.0 + fx * 0.9);
  const look = new THREE.Vector3(player.pos.x - fz * 0.75, 0.95, player.pos.z + fx * 0.75);
  rig.setShot({ pos, look, fov: 40 });
}
function enterForge() {
  forgeFrom = state === 'pause' ? 'pause' : 'play';
  if (document.pointerLockElement) { expectUnlock = true; document.exitPointerLock(); }
  setState('forge');
}
function leaveForge() {
  rig.setShot(null);
  if (forgeFrom === 'pause') setState('pause'); else void resumePlay();
}
const characterForge = new CharacterForge(
  (c) => setPlayerLook(c),
  (c) => { character = { ...character, name: c.name || character.name, created: true }; saveCharacter(character); leaveForge(); },
  loreWords, forgeAuthor);
function openCharacterForge() {
  enterForge();
  player.thirdPerson = true;
  frameForge('body');
  characterForge.open(loadForge(character.name));
}
// B5: the forged crossbow hovers over the anvil at twice size while you work on it, turning slowly.
const weaponDisplay = new THREE.Group();
weaponDisplay.position.set(world.stations.anvil.position.x, 1.3, world.stations.anvil.position.z);   // hovers over the anvil
weaponDisplay.scale.setScalar(2.2);
weaponDisplay.visible = false;
world.scene.add(weaponDisplay);
const weaponForge = new WeaponForge(
  (c: WeaponCosmetic) => { weaponDisplay.clear(); weaponDisplay.add(buildCrossbowModel(c)); },
  (c: WeaponCosmetic) => { crossbow.applyCosmetic(c); weaponDisplay.visible = false; leaveForge(); },
  loreWords, forgeAuthor);
// v0.04: the weapon forge opens at the camp anvil or at the town smithy, wherever you asked for it.
const anvilSpot = world.stations.anvil.position.clone();
function openWeaponForge(at: THREE.Vector3 = world.stations.anvil.position) {
  anvilSpot.copy(at);
  weaponDisplay.position.set(at.x, 1.3, at.z);
  enterForge();
  frameForge('crossbow');
  weaponDisplay.visible = true;
  weaponForge.open(loadWeapon());
}
function closeForges() { if (descendSheet) { descendSheet.remove(); descendSheet = null; leaveForge(); } characterForge.close(); weaponForge.close(); sketchPad.close(); casebook.close(); folklore.close(); campfire.close(); livingMap.close(); dojo.close(); shop.close(); if (galleryCard) { galleryCard.remove(); galleryCard = null; leaveForge(); } }
// ---------- Phase C: B13 ink and paper, B3 margin notes, B10 sketch-to-world; saved on this device ----------
// v0.04 crowns: finds and writing pay; spent at the General Store (src/shop.ts). Session-only, like the bag.
const paidFor = new Set<string>();
function earn(n: number, why: string, once?: string) {
  if (once) { if (paidFor.has(once)) return; paidFor.add(once); }
  inventory.give(CROWN, n);
  toast(`+${n} ◎ ${why}`, 2400);
}
let marginCount = loadMargins().length;
let stationery: Stationery = loadStationery();
const setStationery = (s: Stationery) => { stationery = s; saveStationery(s); applyStationery(s); refreshMarginsInWorld(); };
applyStationery(stationery);
const bookmarks = new THREE.Group();
world.scene.add(bookmarks);
function refreshMarginsInWorld() {
  const all = loadMargins();
  const lect = all.filter((n) => entryById.get(n.entryId)?.type === 'lore');
  world.lecternPages.forEach((m, i) => paintLecternPage(m, lect.filter((_, k) => k % 2 === i), stationery.paper, sketchById));
  buildBookmarks(library.redBooks, all, bookmarks);
}
const deskFor = (b: Book) => {
  const d = new MarginDesk(b, () => stationery, setStationery, (id) => entryById.get(id), forgeAuthor);
  d.onChange = () => {
    const n = loadMargins().length;
    if (n > marginCount) earn(2, 'for a margin note');
    marginCount = n;
    otherDesks(d); refreshMarginsInWorld();
  };
  return d;
};
const lecternDesk = deskFor(book), readerDesk = deskFor(reader);
const otherDesks = (d: MarginDesk) => { (d === lecternDesk ? readerDesk : lecternDesk).reload(); };
refreshMarginsInWorld();
const sketchPad = new SketchPad(
  (s: Sketch) => { stampBanner(world.bannerCloth, s); try { localStorage.setItem('gametool.banner', s.id); } catch { /* blocked */ } toast(`"${s.name}" hangs on the banner.`); earn(3, 'for a banner sketch', 'sketch:' + s.id); },
  () => leaveForge(), forgeAuthor);
stampBanner(world.bannerCloth, (() => { try { return sketchById(localStorage.getItem('gametool.banner') ?? '') ?? DEFAULT_SKETCH; } catch { return DEFAULT_SKETCH; } })());
function openSketchbook(frame: 'banner' | 'body' = 'banner') {
  enterForge();
  frameForge(frame);
  sketchPad.open(sketchById(world.bannerCloth.userData.sketch));
}
// ---------- Phase D: B2 companion + detective quest, B12 item folklore; saved on this device ----------
const quest = loadQuest();
const questProps = new QuestProps(world.scene);
questProps.sync(quest.clues);
questProps.showLead(quest.stage === 'lead' ? quest.theory?.where ?? null : null);
const natalieRoot = () => (world.standees.natalie.userData.replacedBy as THREE.Object3D | undefined) ?? world.standees.natalie;
const companion = new Companion(natalieRoot, world.natalieTarget, world.colliders, world.bounds, loadCompanion());
($('companionQuiet') as HTMLInputElement).checked = companion.prefs.quiet;
$('companionQuiet').addEventListener('change', (e) => { companion.prefs.quiet = (e.target as HTMLInputElement).checked; saveCompanion(companion.prefs); });
const seen = (() => { try { return JSON.parse(localStorage.getItem('gametool.seen') ?? '[]') as string[]; } catch { return [] as string[]; } })();
function markSeen(id: string) { if (!seen.includes(id)) { seen.push(id); try { localStorage.setItem('gametool.seen', JSON.stringify(seen)); } catch { /* blocked */ } } }
const casebook = new Casebook(() => quest, (th: Theory) => {
  quest.theory = th; quest.stage = 'lead'; saveQuest(quest);
  questProps.showLead(th.where);
  companion.say(support(quest, th) >= 2 ? QUEST.natalie.supported : QUEST.natalie.leap, { force: true });
}, () => leaveForge(), loreWords, forgeAuthor);
function openCasebook() {
  if (state !== 'play' && state !== 'pause' && state !== 'dialogue') return;
  enterForge();
  casebook.open();
}
const folklore = new FolklorePanel(
  () => folkItems([...inventory.counts.keys()].filter((id) => inventory.count(id) > 0), quest.clues, seen, (id) => ITEMS[id]?.name ?? id),
  () => leaveForge(), forgeAuthor);
function openFolklore() { enterForge(); folklore.open(); }
function findClue(id: string) {
  const c = clueById(id);
  if (!c || quest.clues.includes(id)) return;
  quest.clues.push(id);
  if (quest.stage === 'none') quest.stage = 'clues';
  saveQuest(quest);
  questProps.sync(quest.clues);
  audio.pageTurn();
  toast(`Clue: ${c.name}. ${c.text} (J: casebook)`, 6000);
  setTimeout(() => earn(2, 'found'), 6200);
  if (companion.prefs.follow) setTimeout(() => companion.say(c.natalie, { key: 'clue:' + id, force: true }), 1800);
  if (quest.clues.length === QUEST.minClues && quest.stage === 'clues') setTimeout(() => companion.say(QUEST.natalie.hintReady, { key: 'ready', force: true }), 7000);
}
for (const c of QUEST.clues) {
  interactables.push({ obj: questProps.hitboxes.get(c.id)!, verb: () => 'Look closer', act: () => findClue(c.id), when: () => !quest.clues.includes(c.id) });
}
interactables.push({ obj: questProps.leadHit, verb: () => 'Follow the blue light', when: () => quest.stage === 'lead', act: () => {
  const th = quest.theory!, end = ending(th);
  quest.stage = 'done'; saveQuest(quest);
  questProps.showLead(null);
  afterDialogue = () => { toast("Natalie finished her field note. Read it in the casebook (J).", 5000); void resumePlay(); };
  talkTo('natalie', questProps.leadHit.position, { speaker: 'Natalie Bourbon', start: 'f1', nodes: {
    f1: { text: end.find, next: 'f2' },
    f2: { text: QUEST.natalie.found, next: 'f3' },
    f3: { text: end.note, end: true },
  } });
} });
// B12: Magister Greer (the Curio Pedlar, Mike's pick 2026-10-28) by the coach road.
const pedlarHit = new THREE.Mesh(new THREE.BoxGeometry(0.9, 1.7, 0.9), new THREE.MeshBasicMaterial({ visible: false }));
pedlarHit.position.copy(world.standees.pedlar.position).setY(0.85);
world.scene.add(pedlarHit);
interactables.push({ obj: pedlarHit, verb: () => 'Talk to Magister Greer', act: () => {
  if (inventory.count('crossbow') > 0) markSeen('crossbow');
  talkTo('pedlar', pedlarHit.position, pedlarScript(seen));
} });
// ---------- Phase E: B8 campfire telling + B11 bard tunes, B9 gallery hall ----------
const campfire = new CampfirePanel(() => {
  const first = quest.clues[0] ? clueById(quest.clues[0])?.name.toLowerCase() : null;
  return [
    first ? `I remember the ${first}. I didn't want to believe it.` : 'I remember the door, and how quiet it was.',
    quest.theory ? `You said it was ${tagLabel('who', quest.theory.who).toLowerCase()}. I wrote it down.` : 'I was behind you the whole way. Mostly.',
    quest.stage === 'done' && quest.theory ? `And ${ending(quest.theory).friend} came home.` : "And the fire's still going, so it isn't over.",
  ];
}, (b: Ballad) => { toast(`"${b.title}" is on the shelf. Find it in the gallery hall.`, 4000); refreshGallery(); earn(5, 'for a ballad'); }, () => leaveForge(), forgeAuthor);
campfire.owned = () => [...inventory.counts.keys()].filter((id) => inventory.count(id) > 0);   // v0.04 instruments
campfire.onWriteLore = () => openEditor(true);   // v0.04: lore is written at the fire, Natalie holds the quill
// v0.04: Natalie the bard comes to the fire while you sit there (across the flames from you), then goes back.
let natalieWas: { x: number; z: number; ry: number } | null = null;
function openCampfire() {
  enterForge(); frameForge('fire');
  const n = natalieRoot(), f = world.stations.campfire.position;
  natalieWas = { x: n.position.x, z: n.position.z, ry: n.rotation.y };
  n.position.set(f.x - 0.7, 0, f.z - 2.3); n.rotation.y = Math.atan2(f.x - n.position.x, f.z - n.position.z);
  campfire.open();
}
const campfireClosed = campfire.onClose;
campfire.onClose = () => {
  if (natalieWas && !companion.prefs.follow) { const n = natalieRoot(); n.position.set(natalieWas.x, 0, natalieWas.z); n.rotation.y = natalieWas.ry; }
  natalieWas = null;
  campfireClosed();
};
interactables.push({ obj: world.stations.campfire, verb: () => 'Sit by the fire', act: () => openCampfire() });
// v0.04: sleep on the bedroll. The view fades out, the time of day moves on (day -> sunset -> night -> day),
// and it fades back in.
const WAKE_AT: Record<TimeOfDay, string> = { day: 'morning', sunset: 'sunset', night: 'nightfall' };
let sleeping = false;
function sleep() {
  if (sleeping) return;
  sleeping = true;
  const fade = $('sleepFade');
  fade.classList.add('on');
  setTimeout(() => {
    const next = NEXT_TIME[world.time];
    world.setTime(next);
    fade.classList.remove('on');
    sleeping = false;
    toast(next === 'night' ? 'You wake at nightfall. Light your torch (T).' : `You wake at ${WAKE_AT[next]}.`, 2600);
  }, 1100);
}
interactables.push({ obj: world.stations.bedroll, verb: () => `Sleep until ${WAKE_AT[NEXT_TIME[world.time]]}`, act: () => sleep(), when: () => !inDungeon });
async function openBallad(b: Ballad) {
  setState('book');
  if (document.pointerLockElement) { expectUnlock = true; document.exitPointerLock(); }
  const t = decodeTune(b.tune);
  audio.tune(t.steps, SCALE, t.instrument, t.bpm, 2);
  await reader.openEntries([balladEntry(b, forgeAuthor())]);
}
const gallery = new Gallery(world.scene, world.colliders);
let galleryCard: HTMLElement | null = null;
const portrait = (look: ReturnType<typeof loadForge>['look']) => (g: CanvasRenderingContext2D, x: number, y: number, size: number) => {
  // A Legends-style bust: shoulders, a big square head, hair cap, two eyes.
  const u = size / 16;
  g.fillStyle = '#6E8FA8'; g.fillRect(x, y, size, size - 50);
  g.fillStyle = look.primary; g.fillRect(x + 3 * u, y + 10 * u, 10 * u, 3.6 * u);
  g.fillStyle = look.skin; g.fillRect(x + 4.5 * u, y + 3 * u, 7 * u, 7 * u);
  g.fillStyle = look.hair; g.fillRect(x + 4.2 * u, y + 2.4 * u, 7.6 * u, 2.2 * u);
  g.fillStyle = look.eyes ?? '#2B2A24'; g.fillRect(x + 6 * u, y + 6 * u, 1.1 * u, 1.3 * u); g.fillRect(x + 8.9 * u, y + 6 * u, 1.1 * u, 1.3 * u);
};
const textTile = (lines: string[]) => (g: CanvasRenderingContext2D, x: number, y: number, size: number) => {
  g.fillStyle = '#EFE3C4'; g.fillRect(x, y, size, size - 50);
  g.fillStyle = '#2B2A24'; g.font = 'italic 17px Georgia, serif'; g.textAlign = 'center';
  lines.slice(0, 7).forEach((l, i) => g.fillText(l.length > 26 ? l.slice(0, 25) + '…' : l, x + size / 2, y + 30 + i * 22));
};
function galleryExhibits(): Exhibit[] {
  const me = forgeAuthor() || 'you', out: Exhibit[] = [];
  let forged = false, weapon = false;
  try { forged = !!localStorage.getItem('gametool.forge.character'); weapon = !!localStorage.getItem('gametool.forge.weapon'); } catch { /* blocked */ }
  const f = loadForge(character.name), w = loadWeapon();
  out.push({ id: 'me', title: f.name || character.name || 'Your hero', credit: me, kind: 'hero', text: f.backstory || 'A traveller with no story written yet.', discovered: forged, hint: 'Forge your hero at the camp mirror.', paint: portrait(f.look) });
  out.push({ id: 'weapon', title: w.name || 'Your crossbow', credit: me, kind: 'weapon', text: w.legend || w.engraving || 'Forged at the camp anvil.', discovered: weapon, hint: 'Forge a crossbow at the camp anvil.', paint: textTile([w.name || 'A crossbow', '', ...(w.legend || '').match(/.{1,24}(\s|$)/g) ?? []]) });
  const sk = loadSketches()[0];
  out.push({ id: 'banner', title: sk?.name || 'Your banner', credit: me, kind: 'sketch', text: 'Painted in the sketchbook.', discovered: !!sk, hint: 'Paint a banner at the camp.',
    paint: sk ? (g, x, y, size) => { g.imageSmoothingEnabled = false; drawSketch(g, sk, x + (size - 192) / 2, y + 2, 6); } : undefined });
  const bd = loadBallads()[0];
  out.push({ id: 'ballad', title: bd?.title || 'Your ballad', credit: me, kind: 'song', text: bd ? bd.verses.slice(0, 2).map((v) => v.join(' / ')).join('\n') : '', discovered: !!bd, hint: 'Tell your story to the bard at the campfire.',
    paint: bd ? textTile(bd.verses[0] ?? []) : undefined, open: bd ? () => { leaveForge(); void openBallad(bd); } : undefined });
  out.push({ id: 'theory', title: 'Your theory', credit: me, kind: 'theory', text: quest.theory?.text ?? '', discovered: !!quest.theory, hint: "Write what you think happened to Natalie's party.",
    paint: quest.theory ? textTile((quest.theory.text.match(/.{1,24}(\s|$)/g) ?? []).map((l) => l.trim())) : undefined });
  for (const id of ['natalie-bourbon', 'straphan-at-sunset', 'song-of-the-paved-road']) {
    const e = entryById.get(id);
    if (!e) continue;
    const plain = e.body.replace(/^#.*$/m, '').replace(/[*_#>[\]]|chords:.*$/gm, '').trim();
    out.push({ id, title: e.title, credit: e.credit_as, kind: e.type, text: plain.slice(0, 400), discovered: seen.includes('entry:' + id), hint: 'Find it in the Ruined Library.',
      open: () => { leaveForge(); void openReader(id); } });
  }
  return out;
}
function refreshGallery() { gallery.paint(galleryExhibits()); }
refreshGallery();
gallery.hitboxes.forEach((hb, i) => interactables.push({ obj: hb, verb: () => { const e = gallery.exhibits[i]; return e?.discovered ? `Look at "${e.title}"` : 'Look at the empty frame'; }, act: () => {
  const e = gallery.exhibits[i];
  if (!e) return;
  enterForge();
  galleryCard = gallery.showCard(e, () => { galleryCard = null; leaveForge(); });
  galleryCard.querySelector('[data-act=open]')?.addEventListener('click', () => { galleryCard = null; });
} }));
let inGallery = false;
// ---------- Phase F: B15 seeded dungeon under the library ----------
const dungeon = new Dungeon(world.scene);
const TRAPDOOR = new THREE.Vector3(6.5, 0, -33);
{
  const hatch = new THREE.Mesh(mergeGeometries([
    new THREE.BoxGeometry(1.4, 0.06, 1.4).translate(0, 0.03, 0),
    new THREE.BoxGeometry(1.5, 0.04, 0.12).translate(0, 0.07, -0.4), new THREE.BoxGeometry(1.5, 0.04, 0.12).translate(0, 0.07, 0.4),
    new THREE.TorusGeometry(0.1, 0.02, 4, 8).rotateX(Math.PI / 2).translate(0.45, 0.08, 0).deleteAttribute('uv') as THREE.BufferGeometry,
  ].map((g) => (g.index ? g.toNonIndexed() : g)).map((g) => { g.deleteAttribute('uv'); return g; })), new THREE.MeshLambertMaterial({ color: 0x5A3E26 }));
  hatch.position.copy(TRAPDOOR); hatch.name = 'trapdoor'; hatch.raycast = () => {};
  world.scene.add(hatch);
}
const trapHit = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.6, 1.6), new THREE.MeshBasicMaterial({ visible: false }));
trapHit.position.copy(TRAPDOOR).setY(0.3); world.scene.add(trapHit);
let inDungeon = false, savedFog: { color: THREE.Color; near: number; far: number; bg: THREE.Color } | null = null;
rig.ceiling = () => (inDungeon ? 2.9 : Infinity);   // the follow camera stays under the dungeon ceiling
const delves = (() => { try { return JSON.parse(localStorage.getItem('gametool.delves') ?? '{}') as Record<string, { theme: string; chest?: boolean; nest?: boolean; at: string }>; } catch { return {}; } })();
const saveDelves = () => { try { localStorage.setItem('gametool.delves', JSON.stringify(delves)); } catch { /* blocked */ } };
function enterDungeon(seed: number) {
  const L = dungeon.build(seed);
  dungeon.group.visible = true;
  world.colliders.push(...dungeon.colliders);
  player.bounds = rig.bounds = 2000;
  const fog = world.scene.fog as THREE.Fog;
  savedFog = { color: fog.color.clone(), near: fog.near, far: fog.far, bg: (world.scene.background as THREE.Color).clone() };
  fog.color.set(dungeon.fog); fog.near = 4; fog.far = 34; (world.scene.background as THREE.Color).set(dungeon.fog);
  player.spawn(dungeon.entrance(), dungeon.entranceYaw());
  if (companion.prefs.follow) natalieRoot().position.copy(dungeon.entrance()).add(new THREE.Vector3(1.2, 0, 0.8));
  inDungeon = true;
  delves[seed] = { ...(delves[seed] ?? {}), theme: L.theme, at: new Date().toISOString().slice(0, 10) };
  saveDelves();
  toast(`Under the library · seed ${seed} · ${L.theme}. Same seed, same dungeon.`, 4500);
  companion.say('Stay close. I can hear something chewing.', { key: 'dungeon:' + seed, force: true });
}
function exitDungeon() {
  if (!inDungeon) return;
  inDungeon = false;
  const set = new Set(dungeon.colliders);
  for (let i = world.colliders.length - 1; i >= 0; i--) if (set.has(world.colliders[i])) world.colliders.splice(i, 1);
  player.bounds = rig.bounds = world.bounds;
  const fog = world.scene.fog as THREE.Fog;
  if (savedFog) { fog.color.copy(savedFog.color); fog.near = savedFog.near; fog.far = savedFog.far; (world.scene.background as THREE.Color).copy(savedFog.bg); }
  dungeon.group.visible = false; dungeon.hideSpots();
  player.spawn(TRAPDOOR.clone().add(new THREE.Vector3(0, 0, 1.6)), 0);
  if (companion.prefs.follow) natalieRoot().position.copy(TRAPDOOR).add(new THREE.Vector3(1.4, 0, 1.4));
}
let descendSheet: HTMLElement | null = null;
function openDescend() {
  enterForge();
  const el = document.createElement('div');
  el.className = 'gallery-card';
  el.id = 'descend';
  el.innerHTML = `<div class="card-in"><div class="credit">Under the Ruined Library</div><h3>A trapdoor, and stairs going down</h3>
    <p>Every seed makes a different dungeon, and the same seed always makes the same one, so you can send a seed to a friend. Today's seed is ${dailySeed()}.</p>
    <label class="field">Seed<input id="dgSeed" type="text" maxlength="24" value="${dailySeed()}"></label>
    <div class="forge-actions"><button class="primary" data-act="go">Descend</button><button class="secondary" data-act="close">Not yet</button></div></div>`;
  el.addEventListener('click', (ev) => {
    const a = (ev.target as HTMLElement).closest('[data-act]') as HTMLElement | null;
    if (!a) return;
    const seed = seedFrom((el.querySelector('#dgSeed') as HTMLInputElement).value || String(dailySeed()));
    el.remove(); descendSheet = null;
    leaveForge();
    if (a.dataset.act === 'go') enterDungeon(seed);
  });
  document.body.appendChild(el);
  descendSheet = el;
}
// ---------- Phase F: B7 living map ----------
const livingMap = new LivingMap(() => {
  const m: Mark[] = [];
  for (const id of quest.clues) { const c = clueById(id); if (c) m.push({ x: c.at[0], z: c.at[2], label: '', kind: 'clue' }); }
  if (quest.theory) {
    const l = (QUEST.leads as Record<string, { at: number[]; friend: string }>)[quest.theory.where];
    if (l) m.push({ x: l.at[0], z: l.at[2], label: quest.stage === 'done' ? `${l.friend} found here` : 'your lead', kind: quest.stage === 'done' ? 'found' : 'lead' });
  }
  const bd = loadBallads();
  if (bd.length) m.push({ x: world.stations.campfire.position.x, z: world.stations.campfire.position.z + 1.6, label: `“${bd[0].title}” sung here`, kind: 'song' });
  const n = Object.keys(delves).length;
  if (n) m.push({ x: TRAPDOOR.x, z: TRAPDOOR.z, label: `${n} seed${n > 1 ? 's' : ''} delved`, kind: 'delve' });
  if (dojo.st.done.length) m.push({ x: DOJO.x, z: DOJO.z + 3.4, label: `${dojo.st.done.length} drill${dojo.st.done.length > 1 ? 's' : ''} done`, kind: 'place' });
  return m;
}, () => ({ x: player.pos.x, z: player.pos.z, yaw: player.yaw }), () => leaveForge(), forgeAuthor);
function openMap() { if (state !== 'play' && state !== 'pause') return; enterForge(); livingMap.open(); }
let mapClock = 0;
// ---------- Phase F: B14 dojo (your character demonstrates; you follow the beginner-safe version) ----------
const dojoBoard = buildDojo(world.scene, world.colliders);
let dojoView: boolean | null = null;
const dojo = new DojoPanel((d) => {
  if (!d) return;
  // Stand on the mats (under the bar for the hanging drill), facing the camera, panel on the left.
  const at = d.pose === 'hang' ? DOJO.bar.clone() : new THREE.Vector3(DOJO.x - 1, 0, DOJO.z);
  player.spawn(at, d.pose === 'plank' ? Math.PI / 2 : Math.PI);   // the plank side-on
  const up = d.pose === 'hang' ? 1.75 : d.pose === 'plank' ? 0.45 : 1.0, far = d.pose === 'hang' ? 2.9 : 3.3;
  // Portrait phones put the panel along the bottom, so the figure goes in the top band instead.
  const tall = innerHeight > innerWidth;
  rig.setShot(tall ? { pos: new THREE.Vector3(at.x, up + 0.2, at.z + far * 1.5), look: new THREE.Vector3(at.x, up - 1.6, at.z), fov: 50 }
    : { pos: new THREE.Vector3(at.x - 0.7, up + 0.45, at.z + far), look: new THREE.Vector3(at.x - 1.0, up, at.z), fov: 44 });
}, () => { if (dojoView !== null) { player.thirdPerson = dojoView; dojoView = null; } leaveForge(); }, forgeAuthor);
function openDojo() {
  if (state !== 'play' && state !== 'pause') return;
  enterForge();
  if (dojoView === null) { dojoView = player.thirdPerson; player.thirdPerson = true; }
  rig.setShot({ pos: new THREE.Vector3(DOJO.x - 1.7, 1.6, DOJO.z + 3.2), look: new THREE.Vector3(DOJO.x - 2, 1, DOJO.z), fov: 44 });
  dojo.open();
}
interactables.push({ obj: dojoBoard, verb: () => 'Train at the dojo', act: () => openDojo(), when: () => !inDungeon });
interactables.push({ obj: trapHit, verb: () => 'Open the trapdoor', act: () => openDescend(), when: () => !inDungeon });
const shrineLines = lore.entries.filter((e) => e.type === 'lore' && e.body.length > 80);
for (const hit of (dungeon as unknown as { hits: THREE.Mesh[] }).hits) {
  const spotOf = () => dungeon.spots.find((s) => s.hit === hit);
  interactables.push({ obj: hit, when: () => inDungeon && !!spotOf(), verb: () => {
    const s = spotOf()!, d = delves[dungeon.layout!.seed];
    return s.kind === 'stairs' ? 'Climb back up' : s.kind === 'chest' ? (d?.chest ? 'An empty chest' : 'Open the chest') : s.kind === 'shrine' ? 'Read the carving' : 'Search the nest';
  }, act: () => {
    const s = spotOf()!, seed = dungeon.layout!.seed, d = delves[seed];
    if (s.kind === 'stairs') { exitDungeon(); return; }
    if (s.kind === 'chest') {
      if (d.chest) { toast('Empty. You already took what was here.'); return; }
      d.chest = true; saveDelves();
      inventory.give('trinket', 1);
      toast(`A trinket from below (I: inventory). Magister Greer would love to hear its story.`, 4500);
      return;
    }
    if (s.kind === 'shrine') {
      const e = shrineLines[(seed + s.room.cx * 7 + s.room.cy) % shrineLines.length];
      const line = e.body.replace(/^#.*$/gm, '').replace(/[*_>[\]]/g, '').trim().split(/(?<=[.!?])\s+/)[0];
      toast(`Carved in the stone: “${line}” (${e.title}, by ${e.credit_as})`, 7000);
      return;
    }
    d.nest = true; saveDelves();
    toast('The goblin\'s nest: a heap of red-book covers, gnawed at the corners, and four tally marks scratched by the door. A fifth is crossed out.', 7000);
    companion.say('This is where it sleeps. It keeps them like treasure.', { force: true });
  } });
}
// Natalie thinks out loud: one line per place, then the odd idle thought (25 s cooldown, mutable).
let barkClock = 0, stillFor = 0;
const lastPos = new THREE.Vector3();
function barkTick(dt: number) {
  barkClock += dt;
  if (barkClock < 1 || !companion.prefs.follow || state !== 'play') return;
  stillFor = player.pos.distanceTo(lastPos) < 0.2 ? stillFor + barkClock : 0;
  lastPos.copy(player.pos); barkClock = 0;
  const b = QUEST.barks, p = player.pos, any = (l: string[]) => l[Math.floor(Math.random() * l.length)];
  if (p.z < -18.6) companion.say(any(b.library), { key: 'zone:library' }) || (Math.random() < 0.08 && companion.say(any(b.library)));
  else if (Math.hypot(p.x + 9.2, p.z - 1) < 3) companion.say(any(b.banner), { key: 'zone:banner' });
  else if (Math.hypot(p.x + 7.6, p.z - 0.5) < 4) companion.say(any(b.camp), { key: 'zone:camp' });
  else if (Math.hypot(p.x, p.z) < 3) companion.say(any(b.dais), { key: 'zone:dais' });
  if (stillFor > 20) { companion.say(any(b.idle)); stillFor = 0; }
}
// Drag on the scene to turn the hero (character forge).
let forgeDrag: number | null = null;
canvas.addEventListener('pointerdown', (e) => { if (state === 'forge') forgeDrag = e.clientX; });
window.addEventListener('pointerup', () => { forgeDrag = null; });
window.addEventListener('pointermove', (e) => {
  if (state !== 'forge' || forgeDrag === null || !characterForge.isOpen) return;
  player.bodyYaw += (e.clientX - forgeDrag) * 0.012; forgeDrag = e.clientX;
  player.body.rotation.y = player.bodyYaw;
});
interactables.push(
  { obj: world.stations.mirror, verb: () => 'Change your look', act: () => openCharacterForge() },
  { obj: world.stations.banner, verb: () => 'Paint the banner', act: () => openSketchbook() },
  { obj: world.stations.anvil, verb: () => inventory.count('crossbow') > 0 ? 'Forge your crossbow' : 'Anvil (bring a crossbow)', act: () => { if (inventory.count('crossbow') > 0) openWeaponForge(); else toast('Natalie has a crossbow you could borrow.'); } },
);
// v0.04 town: one building per tool. E at a door opens it; the shopkeeper trades at the counter.
const shop = new ShopPanel(inventory, () => leaveForge());
function openShop() {
  enterForge();
  const k = world.town.shopkeeper.position, top = new THREE.Vector3(k.x, 1.3, k.z);
  const pos = new THREE.Vector3(k.x + 2.6, 1.7, k.z - 3.0);   // from the side, past the player's shoulder
  const d = top.clone().sub(pos).normalize(), right = new THREE.Vector3().crossVectors(d, new THREE.Vector3(0, 1, 0)).normalize();
  rig.setShot({ pos, look: top.addScaledVector(right, -0.7), fov: 44 });
  shop.open();
}
const townAct: Record<TownId, () => void> = {
  smithy: () => { if (inventory.count('crossbow') > 0) openWeaponForge(world.town.doors.smithy.position.clone().setY(0).add(new THREE.Vector3(0, 0, 1.4))); else toast('The smith works on crossbows. Natalie has one you could borrow.'); },
  tailor: () => openCharacterForge(),
  scriptorium: () => openSketchbook('body'),
  cartographer: () => openMap(),
  shop: () => openShop(),
  inn: () => { if (!inDungeon) sleep(); },
};
for (const id of Object.keys(townAct) as TownId[]) {
  interactables.push({ obj: world.town.doors[id], verb: () => id === 'inn' ? `Rent a bed until ${WAKE_AT[NEXT_TIME[world.time]]}` : `Enter the ${TOWN_NAMES[id]}`, act: () => townAct[id]() });
}
interactables.push({ obj: world.town.shopkeeperHit, verb: () => 'Trade with the Shopkeeper', act: () => openShop() });
function syncCrossbowView() {
  if (crossbow.equipped && viewBeforeCrossbow === null) { viewBeforeCrossbow = player.thirdPerson; player.thirdPerson = false; syncLock(); }
  else if (!crossbow.equipped && viewBeforeCrossbow !== null) { player.thirdPerson = viewBeforeCrossbow; viewBeforeCrossbow = null; if (player.thirdPerson) player.pitch = 0; syncLock(); }
  document.body.dataset.view = player.thirdPerson ? 'follow' : 'first';
  if (rig.inShot) crossbow.viewmodel.visible = false;   // a framed dialogue/reading shot shows the player, not the held crossbow
}
// v0.04 Skyrim-style quick swap: the D-pad's left / right cycle what each hand holds (left: nothing or the
// torch; right: hands or the crossbow), with a short HUD line saying what's in each hand.
let quickTimer = 0;
function showQuick() {
  const el = $('quick');
  el.innerHTML = `<span>◀ ${torch.lit ? 'Torch' : 'Empty'}</span><span>${crossbow.equipped ? 'Crossbow' : 'Hands'} ▶</span>`;
  el.classList.remove('hidden');
  quickTimer = 1.6;
}
function toggleTorch() {
  if (state !== 'play') return;
  torch.toggle();
  haptics.play('tap');
  showQuick();
}
function quickSwap(hand: 'left' | 'right') {
  if (state !== 'play') return;
  if (hand === 'left') { toggleTorch(); return; }
  if (crossbow.equipped) crossbow.unequip();
  else if (inventory.count('crossbow') > 0) crossbow.equip();
  haptics.play('tap');
  showQuick();
}
// One camera step out (+1) or in (-1): first person <-> shoulder <-> follow <-> high <-> overhead.
function stepView(n: number) {
  if (!n || crossbow.equipped) return;
  if (!player.thirdPerson) { if (n > 0) { rig.setStep(1); setView('follow'); } return; }
  if (n < 0 && rig.step <= 1) { setView('first'); return; }
  rig.setStep(rig.step + n);
}
// S1: follow (default) or first person. Stepping in past the shoulder view goes first person;
// stepping out leaves it. The pause menu's Camera list sets the same thing (and is how phones pick it).
function setView(v: 'follow' | 'first', save = true) {
  if (crossbow.equipped) { viewBeforeCrossbow = v === 'follow'; return; }   // applies when the crossbow is put away
  player.thirdPerson = v === 'follow';
  if (player.thirdPerson) player.pitch = 0;
  document.body.dataset.view = v;
  if (save && settings.view !== v) { settings.view = v; saveSettings(settings); }
  syncLock();
}
// First person locks the pointer (from the key press that switched to it); the follow view frees it.
function syncLock() {
  if (state !== 'play') return;
  if (wantLock() && lockSupported && !document.pointerLockElement) void requestLock().then((ok) => { if (!ok && !document.pointerLockElement) { lockSupported = false; show('nolock', state === 'play' && wantLock()); } });
  else if (!wantLock() && document.pointerLockElement) { expectUnlock = true; document.exitPointerLock(); }
  show('nolock', !lockSupported && wantLock());
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
  } else if (verb === 'quest' && id === 'start') {
    if (quest.stage === 'none') { quest.stage = 'clues'; saveQuest(quest); setTimeout(() => toast(`New: ${QUEST.title} (J: casebook)`, 4500), 600); }
  } else if (verb === 'companion') {
    companion.prefs.follow = id === 'follow'; saveCompanion(companion.prefs);
  } else if (verb === 'folklore' && id === 'open') afterDialogue = openFolklore;
  else if (verb === 'casebook' && id === 'open') afterDialogue = openCasebook;
  else console.warn('Unknown dialogue action', a);
};
dialogue.onLine = () => audio.pageTurn();
let afterDialogue: (() => void) | null = null;
let dialogueWith = '';
dialogue.onEnd = () => {
  const next = afterDialogue; afterDialogue = null;
  if (next) { next(); return; }
  if (world.doorOpen && dialogueWith === 'natalie' && quest.stage === 'clues' && quest.clues.length === 0) toast('The library door is open.');
  void resumePlay();
};
function talkTo(who: string, at: THREE.Vector3, script: DialogueScript) {
  dialogueWith = who;
  setState('dialogue');   // F3.3: frees the pointer, freezes movement
  rig.setShot(rig.twoShot(at, 1.55));
  if (document.pointerLockElement) { expectUnlock = true; document.exitPointerLock(); }
  dialogue.start(script);
}
function talkToNatalie() {
  talkTo('natalie', world.natalieTarget.position, quest.stage === 'none' ? natalieScript as DialogueScript : natalieCompanionScript());
}
// B2: once the quest has started, the same talk gains companion choices after the original three
// (follow / wait, what she thinks, the casebook). Node ids and the first choices stay as they were.
function natalieCompanionScript(): DialogueScript {
  const base = structuredClone(natalieScript) as DialogueScript, n = QUEST.natalie, c = quest.clues.length;
  const hint = quest.stage === 'lead' ? `${support(quest, quest.theory!) >= 2 ? n.supported : n.leap} Follow the blue light.`
    : quest.stage === 'done' ? n.found : c === 0 ? n.hintNone : c < QUEST.minClues ? n.hintMore : n.hintReady;
  base.nodes.n1.text = companion.prefs.follow ? "I'm right behind you." : 'You came back. Any sign of them?';
  base.nodes.n2.choices = [...(base.nodes.n2.choices ?? []),
    { text: 'What do you think?', next: 'hint' },
    companion.prefs.follow ? { text: 'Wait here.', next: 'wait' } : { text: 'Come with me.', next: 'follow' },
    { text: 'Let me check the casebook.', next: 'book' },
  ];
  Object.assign(base.nodes, {
    hint: { text: hint, next: 'n2' },
    wait: { text: n.wait, actions: ['companion:wait'], end: true },
    follow: { text: n.follow, actions: ['companion:follow'], end: true },
    book: { text: 'Read it out to me as you go.', actions: ['casebook:open'], end: true },
  });
  return base;
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
  player.syncNow(); camera.updateMatrixWorld(); updateTarget();
  if (lookingAt === 'book') void openBook();
  else if (lookingAt === 'natalie') talkToNatalie();
  else if (lookingAt === 'thing') lookingAtThing?.act();
  else if (lookingAt === 'library' && libraryHit) useLibrary(libraryHit);
  else if (lookingAt === 'bolt') {
    const b = crossbow.boltAt(player.eyePos, lookDir, controls.activateRange);
    if (b) { crossbow.pickUp(b); toast('Bolt recovered', 1200); }
  }
}

// ---------- F5 shelves: grey books (roll table), red books + artifacts (reader) ----------
function useLibrary(h: LibraryHit) {
  if (h.kind === 'relic') { markSeen('noctavel_shard'); toast('A shard of the Noctavel Portal hums in its cradle. The fire never reached it. (Magister Greer might know more.)', 4500); return; }
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
  markSeen('entry:' + slug);   // B9: read once = discovered for the gallery
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
  const b = world.bookCenter;   // v0.04: face the lectern to read
  player.bodyYaw = Math.atan2(-(b.x - player.pos.x), -(b.z - player.pos.z));
  rig.setShot(rig.readingShot(world.bookCenter));
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

function openEditor(withNatalie = false) {
  editorFrom = state;
  if (state === 'play' && document.pointerLockElement) { expectUnlock = true; document.exitPointerLock(); }
  const gh = loadGitHub();
  ghOwner.value = gh.owner; ghRepo.value = gh.repo; ghBranch.value = gh.branch; ghToken.value = gh.token;
  eAuthor.value = loadAuthor();
  eMsg.textContent = withNatalie ? 'Natalie dips her quill: "Go on. Who, where, what happened. I\'ll write it down for the library."' : '';
  setState('editor');
  eTitle.focus();
}
function closeEditor() {
  if (editorFrom === 'play') void resumePlay();
  else setState(editorFrom);
}
$('writeLoreTitle').addEventListener('click', () => openEditor());
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
  earn(10, 'for a lore page', 'lore:' + e.slug);
  eMsg.textContent = `Downloaded ${e.slug}.md — upload it into content/lore/ on github.com (Add file → Upload files), then commit.`;
});
$('ePublish').addEventListener('click', () => {
  const e = entryFromForm();
  if (!e) return;
  saveGitHub({ owner: ghOwner.value.trim(), repo: ghRepo.value.trim(), branch: ghBranch.value.trim() || 'main', token: ghToken.value.trim() });
  eMsg.textContent = 'Publishing…';
  void publishToGitHub(loadGitHub(), e.slug, e.markdown, e.title).then((r) => {
    if (r.ok) {
      earn(10, 'for a lore page', 'lore:' + e.slug);
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
  toggleView: () => setView(player.thirdPerson ? 'first' : 'follow'),
  stepCamera: (n) => stepView(n),
  toggleTorch: () => toggleTorch(),
  quickSwap: (h) => quickSwap(h),
  setMode,
};
const touch: TouchControls | null = new TouchControls(hooks);
const gamepad = new GamepadControls(hooks, () => settings.sensitivity);
gamepad.onFamily = () => syncGlyphs();
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
  const typing = !!(e.target as HTMLElement)?.closest?.('input, textarea');   // a text field gets its spaces and arrows
  if (['Tab', 'AltLeft', 'AltRight', 'Space', 'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(e.code) && !['pause', 'editor', 'charcreate', 'forge'].includes(state) && !typing) e.preventDefault();
  if (e.code === 'CapsLock') {
    // Some platforms (macOS) send only a keyup when Caps Lock turns off; see keyup below.
    if (state === 'play' && !e.repeat) { toggleRun(); capsToggledAt = performance.now(); }
    return;
  }
  if (state === 'book') {
    // B3: typing a margin note: keys belong to the text box; Esc puts the pen down.
    if (typing) { if (e.code === 'Escape') (reader.isOpen ? readerDesk : lecternDesk).closeDesk(); return; }
    if (!e.repeat) (reader.isOpen ? reader : book).handleKey(e.code);
    return;
  }   // F3.2: world input ignored
  if (state === 'editor') { if (e.code === 'Escape' && !e.repeat) closeEditor(); return; }  // text fields handle their own typing
  if (state === 'charcreate') { if (e.code === 'Escape' && !e.repeat) closeCharCreate(); return; }
  if (state === 'forge') { if (e.code === 'Escape' && !e.repeat) closeForges(); return; }
  if (state === 'dialogue') { if (!e.repeat) dialogue.handleKey(e.code); return; }   // F3.3: movement frozen
  if (state === 'inventory') { if (!e.repeat && ['KeyI', 'Tab', 'Escape'].includes(e.code)) closeInventory(); return; }
  if (state === 'pause' && e.code === 'Escape' && (!lockSupported || !wantLock())) { closePauseMenu(); return; }
  if (state !== 'play') return;
  if (e.code === 'KeyT' && !e.repeat) { toggleTorch(); return; }   // v0.04
  // v0.04: no L hotkey; in the world, lore is written at the campfire with Natalie (the title screen keeps its button).
  if (actionFor(e.code, ['inventory']) && !e.repeat) { openInventory(); return; }
  if (actionFor(e.code, ['journal']) && !e.repeat) { openCasebook(); return; }
  if (actionFor(e.code, ['map']) && !e.repeat) { openMap(); return; }
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
  else if (a === 'pov') setView(player.thirdPerson ? 'first' : 'follow');
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
  if (e.button === 0) {
    mouseHeld = true;
    cursor.downX = e.clientX; cursor.downY = e.clientY; cursor.dragged = false;
    if (wantLock() && lockSupported && !document.pointerLockElement && e.target === canvas) void requestLock();   // first person: a click takes the pointer
    if (crossbow.equipped && (e.target === canvas || document.pointerLockElement)) fire();   // F4.1 LMB fires
  }
  if (e.button === 2) { rightHeld = true; crossbow.setADS(true); }   // F4.1 RMB aims; in the follow view RMB-drag turns the camera
});
window.addEventListener('mouseup', (e) => {
  if (e.button === 0) {
    mouseHeld = false;
    // S1: a click (not a drag) on something within reach uses it.
    if (state === 'play' && e.target === canvas && player.thirdPerson && !crossbow.equipped && !cursor.dragged && hovering) activate();
  }
  if (e.button === 2) { rightHeld = false; crossbow.setADS(false); }
});
canvas.addEventListener('contextmenu', (e) => e.preventDefault());
canvas.addEventListener('click', () => { if (state === 'dialogue') dialogue.advance(); });
// Only a real move counts: browsers also send zero-movement moves when a panel vanishes under a still cursor.
canvas.addEventListener('pointermove', (e) => { if (e.pointerType === 'mouse' && (e.movementX || e.movementY)) { cursor.x = e.clientX; cursor.y = e.clientY; cursor.on = true; } });
canvas.addEventListener('pointerleave', () => { cursor.on = false; });
// v0.04: the wheel steps through the 5 camera distances (first person, shoulder, follow, high, overhead).
// One step per notch; a trackpad's burst of small events counts once per 100 ms.
let lastStep = 0;
canvas.addEventListener('wheel', (e) => {
  if (state !== 'play' || crossbow.equipped) return;
  e.preventDefault();
  if (!e.deltaY || performance.now() - lastStep < 100) return;
  lastStep = performance.now();
  stepView(Math.sign(e.deltaY));
}, { passive: false });
window.addEventListener('mousemove', (e) => {
  if (state !== 'play') return;
  const locked = document.pointerLockElement === canvas;
  if (inputMode !== 'mouse') return;
  // Chromium sometimes sends one bogus huge delta under pointer lock (on lock, or re-centring the cursor);
  // a real hand never moves 350 px in a single event, so drop it instead of snapping the view.
  if (Math.abs(e.movementX) > 350 || Math.abs(e.movementY) > 350) return;
  if (locked) { player.look(e.movementX, e.movementY); return; }
  if (player.thirdPerson) {
    // Follow view: drag (either button) turns the camera around the player.
    if (mouseHeld && Math.hypot(e.clientX - cursor.downX, e.clientY - cursor.downY) > 5) cursor.dragged = true;
    if ((mouseHeld && cursor.dragged) || rightHeld) player.look(e.movementX * 1.4, 0);
  } else if (mouseHeld || rightHeld) player.look(e.movementX, e.movementY);   // first person, pointer not locked: drag to look
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
  $<HTMLInputElement>('haptics').checked = settings.haptics;
  $<HTMLSelectElement>('viewSel').value = settings.view;
  $<HTMLSelectElement>('charsSel').value = settings.chars;
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
const viewSel = $<HTMLSelectElement>('viewSel');
viewSel.addEventListener('change', () => setView(viewSel.value === 'first' ? 'first' : 'follow'));
$<HTMLInputElement>('haptics').addEventListener('change', (e) => {
  settings.haptics = (e.target as HTMLInputElement).checked; saveSettings(settings);
  haptics.setEnabled(settings.haptics);
  haptics.play('tap');
});
haptics.setEnabled(settings.haptics);
haptics.setMode(inputMode);
document.body.dataset.pad = 'xbox';
renderPadMap('xbox');
const charsSel = $<HTMLSelectElement>('charsSel');
charsSel.addEventListener('change', () => {
  settings.chars = charsSel.value === 'sprite' ? 'sprite' : 'hybrid'; saveSettings(settings);
  setSpriteCharacters(settings.chars === 'sprite');
});
setSpriteCharacters(settings.chars === 'sprite');
always.addEventListener('change', () => { settings.alwaysRun = always.checked; saveSettings(settings); });

// F1.1 graphics — a preset fills every slider below it; each slider then applies live on its own.
presetSel.addEventListener('change', () => {
  const p = presetSel.value as Preset;
  settings.preset = p;
  Object.assign(settings, PRESETS[p]);
  saveSettings(settings); syncMenu();
  applyRenderScale(); renderer.shadowMap.enabled = settings.shadows; world.setShadows(settings.shadows);
  post?.setEnabled(settings.postFx); world.setFogDistance(settings.fogDistance); world.setFoliage(FOLIAGE[p]);
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
const hoverRay = new THREE.Raycaster(), ndc = new THREE.Vector2();
let hovering = false;
// S1: with no aim, E uses the nearest thing within reach in front of the body (keyboard / pad / touch).
const nearBox = new THREE.Box3(), nearC = new THREE.Vector3();
function nearestAhead(objs: THREE.Object3D[]): THREE.Object3D | null {
  const fx = -Math.sin(player.bodyYaw), fz = -Math.cos(player.bodyYaw);
  let best: THREE.Object3D | null = null, bestD = Infinity;
  for (const o of objs) {
    nearBox.setFromObject(o).getCenter(nearC);
    const dx = nearC.x - player.pos.x, dz = nearC.z - player.pos.z, d = Math.hypot(dx, dz);
    if (d > controls.activateRange + 0.4 || nearC.y > player.eyePos.y + 1.2) continue;
    if (d > 0.6 && (dx * fx + dz * fz) / d < 0.35) continue;   // within ~70° of where the body faces
    if (d < bestD) { bestD = d; best = o; }
  }
  return best;
}
// F3.1 / S1: recomputed every frame, and again on E / click so a slow frame never uses a stale target.
function updateTarget() {
  // F3.1 / S1: what E (or a click) would use. In order: the thing under the mouse cursor (follow view,
  // within reach), then the 2 m ray from the eyes along the view, then the nearest thing ahead of the body.
  player.lookDir(lookDir);
  const things = interactables.filter((t) => !t.when || t.when());
  const targets = [world.bookTarget, world.natalieTarget, ...library.targets, ...things.map((t) => t.obj)];
  let hit: THREE.Intersection | undefined;
  hovering = false;
  if (cursor.on && player.thirdPerson && inputMode === 'mouse' && !crossbow.equipped) {
    ndc.set((cursor.x / innerWidth) * 2 - 1, -(cursor.y / innerHeight) * 2 + 1);
    hoverRay.setFromCamera(ndc, camera);
    hit = hoverRay.intersectObjects(targets, false).find((h) => h.point.distanceTo(player.eyePos) <= controls.activateRange + 1.2);
    hovering = !!hit;
  }
  if (!hit) { ray.set(player.eyePos, lookDir); hit = ray.intersectObjects(targets, false)[0]; }
  if (!hit && player.thirdPerson) {
    const near = nearestAhead([world.bookTarget, world.natalieTarget, ...things.map((t) => t.obj)]);
    if (near) hit = { object: near, distance: 0, point: near.position } as unknown as THREE.Intersection;
  }
  canvas.style.cursor = hovering ? 'pointer' : '';
  libraryHit = (hit?.object.userData.hit as LibraryHit | undefined) ?? null;
  lookingAtThing = (hit && things.find((t) => t.obj === hit!.object)) ?? null;
  lookingAt = !hit ? null : hit.object === world.bookTarget ? 'book' : hit.object === world.natalieTarget ? 'natalie' : lookingAtThing ? 'thing' : 'library';
  if (!lookingAt && crossbow.boltAt(player.eyePos, lookDir, controls.activateRange)) lookingAt = 'bolt';   // F4.4
}
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
  syncCrossbowView();
  if (state === 'play') {
    simAcc += dt;
    while (simAcc >= SIM_STEP) {
      player.update(SIM_STEP); simAcc -= SIM_STEP; perf.simSeconds += SIM_STEP;
      // A7: footsteps while actually moving (not just holding a speed modifier) and not sneaking.
      const moving = MOVE_ACTIONS.some((a) => player.held.has(a)) || Math.hypot(player.analog.x, player.analog.y) > 0.05;
      if (moving && !player.sneaking) {
        stepTimer -= SIM_STEP;
        if (stepTimer <= 0) { audio.footstep(); stepTimer = 2.2 / Math.max(1, player.speed()); if (player.thirdPerson && player.speed() > controls.speeds.walk) dust.burst(footAt()); }
      } else stepTimer = 0;
    }
    rig.update(dt);   // R3: camera follows this frame's simulation before anything aims along it
    updateTarget();
    show('prompt', lookingAt !== null);
    const verb = lookingAt === 'natalie' ? 'Talk to Natalie' : lookingAt === 'bolt' ? 'Pick up bolt' : lookingAt === 'thing' ? lookingAtThing!.verb()
      : lookingAt === 'library' && libraryHit ? libraryVerb(libraryHit) : 'Read';
    if (promptVerb.textContent !== verb) promptVerb.textContent = verb;
    const s = (player.sneaking ? 'SNEAK' : player.speed() === controls.speeds.sprint ? 'SPRINT' : player.speed() === controls.speeds.run ? 'RUN' : 'WALK')
      + (settings.alwaysRun ? '' : ' · always-run off');
    if (s !== lastStatus) { statusEl.textContent = s; lastStatus = s; }
    crossbow.update(dt);
    touch?.update();
  } else { lookingAt = null; crossbow.setADS(false); rig.update(dt); }
  animate(dt);
  updateAmmoHud();
  updateSprites(renderer, world.scene, camera, dt);
  post!.render(world.scene, camera);
  const ms = performance.now() - t0;
  perf.frames++; perf.cpuMs += ms; perf.worstMs = Math.max(perf.worstMs, ms);
}
setState('title');
frame();
// F2.1: everything is built and the first frame is drawn; fade in from black over 2 s (no pop-in).
// Compile hidden things too (player body, held crossbow, dust), so they don't stutter the first time they show.
{
  const hidden = [player.body, crossbow.viewmodel].filter((o) => !o.visible);
  hidden.forEach((o) => { o.visible = true; });
  dust.mesh.count = 1;
  renderer.compile(world.scene, camera);
  hidden.forEach((o) => { o.visible = false; });
  dust.mesh.count = 0;
}
progress(100);
requestAnimationFrame(() => requestAnimationFrame(() => {
  const loader = document.getElementById('loader');
  if (!loader) return;
  loader.classList.add('done');
  setTimeout(() => loader.remove(), 2100);
}));

// Installed app / long-open tab: offer a reload when the live site has a newer build (vite.config.ts buildStamp).
declare const __BUILD_ID__: string;
async function checkForUpdate() {
  if (!location.protocol.startsWith('http')) return;
  try {
    const r = await fetch('./build.json', { cache: 'no-store' });
    if (!r.ok) return;
    const { build } = await r.json() as { build?: string };
    if (build && build !== __BUILD_ID__ && !document.getElementById('updateBar')) {
      const bar = document.createElement('div');
      bar.id = 'updateBar';
      bar.innerHTML = 'A new version of the game is out. <button class="primary">Reload</button>';
      bar.querySelector('button')!.addEventListener('click', () => location.reload());
      document.body.appendChild(bar);
    }
  } catch { /* offline: keep playing the copy we have */ }
}
void checkForUpdate();
setInterval(() => void checkForUpdate(), 10 * 60 * 1000);
document.addEventListener('visibilitychange', () => { if (!document.hidden) void checkForUpdate(); });

// Debug/test hook (read-only use in automated checks; harmless in play).
Object.assign(window, { __gametool: { get state() { return state; }, get lookingAt() { return lookingAt; }, get lookingAtVerb() { return lookingAtThing?.verb() ?? null; }, get inputMode() { return inputMode; }, get character() { return character; }, dailyPrompt, dialogue, inventory, crossbow, reader, library, modelsReady, loadedModels, failedModels, animators, puppets, characterForge, weaponForge, openCharacterForge, openWeaponForge, interactables, sketchPad, openSketchbook, lecternDesk, readerDesk, quest, questProps, companion, casebook, folklore, pedlarHit, campfire, openCampfire, gallery, refreshGallery, openReader, dungeon, enterDungeon, exitDungeon, get inDungeon() { return inDungeon; }, delves, livingMap, openMap, dojo, openDojo, get stationery() { return stationery; }, setStationery, shop, openShop, earn, camera, Box3: THREE.Box3, Raycaster: THREE.Raycaster, Vector3: THREE.Vector3, player, rig, book, renderer, world, perf, settings, audio, haptics, torch, lockSupported: () => lockSupported } });
