import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import './render/grade';   // style pass 1: global colour grade (patches a shader chunk, so it must load first)
import { updateSprites, setSpriteCharacters, faceExpression } from './render/sprites';
import './style.css';
import { buildWorld } from './world';
import { buildFigure } from './world/figure';
import { Player } from './player';
import { Book } from './book';
import { lore, entryById } from './lore';
import { buildLibrary, type LibraryHit } from './library';
import { setLinkResolver } from './markdown';
import greyBooks from '../content/rolltables/grey-books.json';
import { controls, actionFor, binds, REBINDABLE, bindKey, resetKeys, keyLabel, type Action } from './controls';
import { loadSettings, saveSettings, flushSettings, PRESETS, type Preset, type FpsCap, type View } from './settings';
import { AutoQuality, STEPS } from './render/autoQuality';
import { audio } from './audio';
import { VERSION, AUTHOR } from './version';
import { TouchControls } from './input/touch';
import { GamepadControls } from './input/gamepad';
import type { State, InputMode, GameHooks } from './input/hooks';
import { loadGitHub, saveGitHub, loadAuthor, saveAuthor, slugify, buildMarkdown, publishToGitHub, downloadMarkdown } from './editor';
import { loadCharacter, saveCharacter, type Character } from './character';
import { reading } from './reading';
import { Purse } from './purse';
import { Wear } from './wear';
import { Coach } from './coach';
import { promptOfTheDay } from './prompts';
import { DialogueBox, type DialogueScript } from './dialogue';
import { Inventory, ITEMS } from './inventory';
import { Crossbow, ZONE } from './crossbow';
import { Sword } from './sword';
import { GearPanel, buildGrindstone, grindstonePos, gearCardHtml, swordSharpness, bowPower, GEAR_CARD } from './gear/gear';
import './gear/gear.css';
import { CookPanel, RecipeBook } from './cooking/cooking';
import { BUFFS } from './cooking/recipes';
import natalieScript from '../content/dialogue/natalie.json';
import { Post } from './render/post';
import { CameraRig, OVERHEAD, type Shot } from './camera/rig';
import { fillSlots, loadedModels, failedModels, animators, type ModelSlot, type AnimState } from './models';
import { FigureAnim, BodyAnim, type AnimInput, type Pose } from './anim/procedural';
import { Dust } from './fx/dust';
import { activeSlot, slotInfo, slotLabel } from './profiles';
import { CharacterForge, loadForge, renameForge, type ForgeCharacter } from './forge/character';
import { WeaponForge, loadWeapon, buildCrossbowModel, type WeaponCosmetic } from './forge/weapon';
import { MarginDesk, loadStationery, saveStationery, applyStationery, loadMargins, type Stationery } from './writing/margins';
import { SketchPad, sketchById, DEFAULT_SKETCH, type Sketch } from './writing/sketch';
import { stampBanner, buildBookmarks } from './writing/stamps';
import { QUEST, loadQuest, saveQuest, clueById, support, ending, tagLabel, type Theory } from './quest/quest';
import { Casebook } from './quest/casebook';
import { QuestProps } from './quest/props';
import { Companion, loadCompanion, saveCompanion } from './quest/companion';
import { FolklorePanel, folkItems, pedlarScript } from './quest/folklore';
import { CampfirePanel } from './campfire/campfire';
import { QuickDungeon, buildQuick } from './dungeon/quick';
import { TellingView } from './campfire/telling';
import { loadBallads, balladEntry, decodeTune, SCALE, type Ballad } from './campfire/ballad';
import { Gallery, GALLERY, type Exhibit } from './campfire/gallery';
import { buildCeilings, roofOver, ROOFED } from './world/ceilings';
import { buildDojo, DojoPanel, DOJO } from './dojo/dojo';
import { buildCaravan, CaravanPanel, Phrasebook, CARAVAN } from './spanish/caravan';
import './spanish/caravan.css';
import { WikiPanel, buildWikiLectern } from './wiki';
import { buildSkillTable, SkillsPanel, SkillsBook, SKILL_TABLE } from './skills/skills';
import './skills/skills.css';
import './dojo/dojo.css';
import { drawSketch, loadSketches } from './writing/sketch';
import { Dungeon } from './dungeon/dungeon';
import { Goblins, MAX_FOES } from './foes/goblins';
import { rollGoblin, describeGoblin, goblinStats } from './traits/goblin';
import { roll, seedOf } from './traits/roll';
import { dailySeed, seedFrom } from './dungeon/gen';
import { LivingMap, type Mark } from './map/livingmap';
import { haptics } from './input/haptics';
import { Torch } from './torch';
import { HeldBook } from './heldBook';
import { ShopPanel, CROWN } from './shop';
import { CinemaPanel, buildScreen } from './cinema';
import { TOWN_NAMES, GATE, FOUNTAIN, TOWN_LOTS, type TownId } from './world/town';
import { DmView, type Place } from './dm/dm';
import { BRIDGES, riverX, riverClear } from './world/river';
import { plantForestPack } from './world/forestPack';
import { Townsfolk } from './world/townsfolk';
import { NightLights } from './world/nightlights';
import { Ambience, type Zone } from './ambience';
import { Intro } from './intro';
import { Extras } from './extras';
import { WhatsNew } from './whatsnew';
import { loadGame, saveGame, clearGame } from './save';
import { NEXT_TIME, type TimeOfDay } from './world/sky';
import { glyph, type PadFamily } from './input/glyphs';

// Private, all rights reserved (D8). Not open source.


const settings = loadSettings();
const app = document.getElementById('app')!;

// Belt-and-suspenders flush: saveSettings() already writes on every change, but re-save once more
// right before the page is torn down (reload/navigate/close tab) in case a write landed just before
// a change that didn't get a chance to persist yet.
window.addEventListener('pagehide', () => flushSettings(settings));

// F1.2: prime the audio engine's cached levels before the first user gesture creates the AudioContext.
(['master', 'music', 'sfx', 'dialogue'] as const).forEach((b) => {
  audio.setLevel(b, settings.audio[b]);
  audio.setMuted(b, settings.audio[('mute' + b[0].toUpperCase() + b.slice(1)) as 'muteMaster' | 'muteMusic' | 'muteSfx' | 'muteDialogue']);
});

// ---------- renderer / camera (D2, D4) ----------
const coarse = matchMedia('(pointer: coarse)').matches;
// MSAA costs fill rate on phones and on Low; it is set once, when the canvas is made (a preset change applies next load).
const renderer = new THREE.WebGLRenderer({ antialias: !coarse && settings.preset !== 'low', powerPreference: 'high-performance' });
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
// F1.1: device pixel ratio capped (phones hold frame rate), then scaled by the render-scale setting.
const basePixelRatio = Math.min(window.devicePixelRatio, coarse ? 1.5 : 2);
// References review: auto quality scales these down when the frame rate drops (settings stay as picked).
// Automated test browsers keep it off unless a test asks (localStorage gametool.autoq = 'on').
const autoQ = new AutoQuality(() => applyQuality());
autoQ.enabled = settings.autoQuality && (() => { try { return !navigator.webdriver || localStorage.getItem('gametool.autoq') === 'on'; } catch { return !navigator.webdriver; } })();
function applyRenderScale() { renderer.setPixelRatio(basePixelRatio * Math.max(0.35, (settings.renderScale / 100) * autoQ.step.scale)); post?.setSize(window.innerWidth, window.innerHeight); }
/** Everything auto quality touches, from the settings and its current step. */
function applyQuality() {
  const q = autoQ.step, shadows = settings.shadows && q.shadows;
  applyRenderScale();
  renderer.shadowMap.enabled = shadows; world.setShadows(shadows);
  world.setFoliage(FOLIAGE[settings.preset] * q.foliage);
  townsfolk.setCount(settings.preset === 'low' || q.folk === 'low' ? 'low' : 'full');
  const out = document.getElementById('autoQualityOut');
  if (out) out.textContent = autoQ.enabled && autoQ.level ? `(easing off: step ${autoQ.level} of ${STEPS.length - 1})` : '';
}
let post: Post | null = null;
applyRenderScale();
renderer.setSize(window.innerWidth, window.innerHeight);
app.appendChild(renderer.domElement);
const canvas = renderer.domElement;

const camera = new THREE.PerspectiveCamera(settings.fov, window.innerWidth / window.innerHeight, 0.05, 200);
// iPhone (Mike 2026-10-31): Safari's address bar grows and shrinks without always firing a window resize, so the
// canvas also follows the visual viewport, the part of the page that's actually on screen.
const fitView = () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
  post?.setSize(window.innerWidth, window.innerHeight);
};
window.addEventListener('resize', fitView);
window.visualViewport?.addEventListener('resize', fitView);

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
// v0.06 W3: lantern halos, brighter windows and a few real lights at night.
const nightLights = new NightLights(world.scene, world.lanterns, world.town.windows);
nightLights.setMax(settings.preset === 'low' ? 2 : 4);
nightLights.setTime(world.time);
// UX pass (Mike 2026-10-31): no clock. The sky shows the hour, and the bell in the library spire tolls when it
// changes: three for morning, two for sunset, one for nightfall.
const BELL_TOLLS: Record<TimeOfDay, number> = { day: 3, sunset: 2, night: 1 };
const tollBell = (t: TimeOfDay) => { const L = TOWN_LOTS.find((l) => l.id === 'library')!; audio.bell(BELL_TOLLS[t], audio.spatial('bell', L.x, 12, L.z, 140)); };
const setWorldTime = (t: TimeOfDay, toll = false) => { world.setTime(t); nightLights.setTime(t); if (toll) tollBell(t); };
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
const heldBook = new HeldBook(player);
const purse = new Purse(player);   // UX pass: crowns hang at the hip
const wear = new Wear(player);   // UX pass: clothes tear as you're hurt in the dungeon
let purseSteps = 0;   // every third footstep the purse clinks   // v0.04: the 'read' pose holds an open book (shelf reader)
// .glb models (public/models/<id>.glb) replace placeholders when present; never blocks loading.
const modelSlots: ModelSlot[] = [
  ...Object.entries(world.standees).map(([id, s]) => ({ id, placeholder: s, height: s.userData.height as number })),
  { id: 'player', placeholder: player.body.children[0], parent: player.body, height: controls.eyeHeight + 0.1, faceYaw: Math.PI },
];
// References review: the 99.Miles forest tree pack (public/models/forest-trees.glb) dresses the hills, clear of
// the river and the coach road out to the gate.
const forestPack = plantForestPack(world.scene, world.heightAt, (x, z) => riverClear(x, z, 1) || (x < -36 && Math.abs(z - GATE.z) < 5));
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
    <nav class="menu-list" aria-label="Main menu">
      <button id="begin" class="menu-item">Begin</button>
      <button id="newGame" class="menu-item hidden">New game</button>
      <button id="openProfiles" class="menu-item">Profiles</button>
      <button id="openExtras" class="menu-item">Extras</button>
      <button id="openSettingsTitle" class="menu-item">Options</button>
    </nav>
    <p id="saveNote" class="fine hidden"></p>
    <p id="homeTip" class="hidden">For fullscreen with no address bar: tap Share <b>⬆</b>, then <b>Add to Home Screen</b>, and play from the new icon.<button id="homeTipClose" aria-label="Hide this tip">✕</button></p>
    <span id="versionLabel" class="menu-version"></span>
  </div>
  <div id="padStatus" aria-live="polite"></div>
  <div id="versionNote"></div>
  <div id="gateConfirm" class="screen hidden">
    <div class="card narrow">
      <div class="eyebrow">Temporary Exit - Mind the dust</div>
      <h1>Leave the area?</h1>
      <p>This will retire you. Your bag and the hour are saved; next time you begin back at the glade.</p>
      <button id="gateYes" class="primary">Yes, retire</button>
      <button id="gateNo" class="secondary">No, stay</button>
    </div>
  </div>
  <div id="vignette"></div>
  <div id="sleepFade"></div>
  <div id="rotateAsk" role="dialog" aria-label="Turn your phone sideways">
    <div class="ra-phone" aria-hidden="true"></div>
    <p>Turn your phone sideways</p>
    <span>Artheria plays in landscape.</span>
    <span id="rotateIos" class="hidden">If it doesn't turn, swipe down from the top-right corner and switch off Rotation Lock.</span>
    <button id="rotateTurn" class="primary hidden">Turn it for me</button>
    <button id="rotateOk" class="secondary">Play upright anyway</button>
  </div>
  <div id="readHint">⟳ Turn your phone upright to scroll the pages</div>
  <div id="hud" class="hidden">
    <div id="crosshair"></div>
    <div id="prompt" class="hidden"><kbd>E</kbd> — <span id="promptVerb">Read</span></div>
    <div id="toast" class="hidden"></div>
    <div id="quick" class="hidden"></div>
    <div id="delveHp" class="hidden sr-only" aria-live="polite"></div>
    <div id="hurtEdge" aria-hidden="true"></div>
    <div id="ammo" class="hidden"><span id="ammoText"></span><div id="reloadBar" class="hidden"><i class="zone"></i><i class="fill"></i></div></div>
    <div id="autosaved" aria-live="polite">✒ Saved</div>
    <div id="coach" class="hidden" aria-live="polite"></div>
    <div id="nolock" class="hidden">Pointer lock unavailable here: hold the left mouse button and drag to look.</div>
  </div>
  <div id="pause" class="screen hidden">
    <nav class="pause-side side-panel" aria-label="Pause menu">
      <h1>Journal</h1>
      <button id="resume" class="pause-item">Resume</button>
      <button class="pause-item" data-group="gameplay">Gameplay</button>
      <button class="pause-item" data-group="graphics">Graphics</button>
      <button class="pause-item" data-group="sound">Sound</button>
      <button class="pause-item" data-group="controls">Controls</button>
      <span class="pause-rule" aria-hidden="true"></span>
      <button id="pgCasebook" class="pause-item pause-page">Casebook</button>
      <button id="pgMap" class="pause-item pause-page">Map</button>
      <button id="pgBag" class="pause-item pause-page">Bag</button>
      <button id="pgPhrases" class="pause-item pause-page">Phrasebook</button>
      <button id="pgSkills" class="pause-item pause-page">Skills book</button>
      <button id="pgRecipes" class="pause-item pause-page">Recipe book</button>
      <button id="pgSelf" class="pause-item pause-page">Who you are</button>
      <button id="quitToMenu" class="pause-item">Quit to Main Menu</button>
      <p class="fine">Settings are saved in this browser.</p>
    </nav>
    <section id="gameplaySettings" class="pause-panel side-panel hidden" data-panel="gameplay">
      <h2>Gameplay</h2>
      <label class="field">Camera <select id="viewSel"><option value="overhead">Overhead (Dark Cloud 2 style)</option><option value="shoulder">Over the shoulder</option><option value="first">First person</option></select></label>
      <label>Look sensitivity <output id="sensOut"></output><input id="sens" type="range" min="0.2" max="3" step="0.05"></label>
      <label class="check"><input id="invert" type="checkbox"> Invert Y</label>
      <label class="check"><input id="always" type="checkbox"> Always run (Caps Lock)</label>
      <label class="field">Characters <select id="charsSel"><option value="hybrid">3D bodies, drawn heads</option><option value="sprite">Pixel sprites</option></select></label>
      <label class="check"><input id="haptics" type="checkbox"> Vibration (controller rumble, phone buzz)</label>
      <label class="check"><input id="companionQuiet" type="checkbox"> Quiet companion (Natalie keeps her thoughts to herself)</label>
      <h4>Comfort</h4>
      <label>Text size <output id="textSizeOut"></output><input id="textSize" type="range" min="85" max="150" step="5"></label>
      <label>Reading speed <output id="readSpeedOut"></output><input id="readSpeed" type="range" min="0.5" max="2" step="0.25"></label>
      <label class="check"><input id="lefty" type="checkbox"> Left-handed (touch: move on the right, buttons on the left)</label>
      <label>Touch button size <output id="buttonSizeOut"></output><input id="buttonSize" type="range" min="75" max="150" step="5"></label>
      <h4>Your hero</h4>
      <button id="editCharacter" class="secondary">Who you are (optional)</button>
      <button id="openCharacterForge" class="secondary">Character forge</button>
      <button id="openWeaponForge" class="secondary">Weapon forge</button>
      <button id="openSketchbook" class="secondary">Sketchbook</button>
      <button id="openCasebook" class="secondary">Casebook (J)</button>
      <button id="openMap" class="secondary">Map (M)</button>
    </section>
    <section id="graphicsSettings" class="pause-panel side-panel hidden" data-panel="graphics">
      <h2>Graphics</h2>
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
      <label class="check"><input id="autoQuality" type="checkbox"> Auto quality (eases off when the frame rate drops) <output id="autoQualityOut"></output></label>
      <label>Field of view <output id="fovOut"></output><input id="fov" type="range" min="60" max="100" step="1"></label>
    </section>
    <section id="audioSettings" class="pause-panel side-panel hidden" data-panel="sound">
      <h2>Sound</h2>
      <label>Master <output id="audioMasterOut"></output><input id="audioMaster" type="range" min="0" max="100" step="5"></label>
      <label class="check"><input id="muteMaster" type="checkbox"> Mute master</label>
      <label>Music <output id="audioMusicOut"></output><input id="audioMusic" type="range" min="0" max="100" step="5"></label>
      <label class="check"><input id="muteMusic" type="checkbox"> Mute music</label>
      <label>SFX <output id="audioSfxOut"></output><input id="audioSfx" type="range" min="0" max="100" step="5"></label>
      <label class="check"><input id="muteSfx" type="checkbox"> Mute SFX</label>
      <label>Dialogue <output id="audioDialogueOut"></output><input id="audioDialogue" type="range" min="0" max="100" step="5"></label>
      <label class="check"><input id="muteDialogue" type="checkbox"> Mute dialogue</label>
    </section>
    <section id="controlsMap" class="pause-panel side-panel hidden" data-panel="controls">
      <h2>Controls</h2>
      <table class="keys only-touch">
        <tr><td>Left thumb</td><td>Move (small push walks, full push runs)</td></tr>
        <tr><td>Right thumb</td><td>Drag to look</td></tr>
        <tr><td>Buttons</td><td>Jump · Sneak · Sprint (hold) · View · Use · − / + camera · ☰ menu</td></tr>
        <tr><td>Book</td><td>Swipe or tap a page edge · ✕ to close</td></tr>
      </table>
      <table class="keys only-mouse">
        <tr><td>W A S D</td><td>Move (runs by default)</td><td>Mouse</td><td>Look</td></tr>
        <tr><td>Shift</td><td>Walk (hold)</td><td>Caps Lock</td><td>Toggle always-run</td></tr>
        <tr><td>Alt</td><td>Sprint (hold)</td><td>Space</td><td>Jump</td></tr>
        <tr><td>C</td><td>Sneak / crouch</td><td>E</td><td>Use · read · talk</td></tr>
        <tr><td>Tab</td><td>Close book</td><td>Esc</td><td>Pause menu</td></tr>
        <tr><td>F</td><td>Camera: first person / shoulder / overhead</td><td>Wheel</td><td>Camera in / out</td></tr>
        <tr><td>Q</td><td>Swap shoulder (or weapon)</td><td>T</td><td>Torch</td></tr>
        <tr><td>1 · 2 · 3</td><td>Crossbow · hands · sword</td><td>Click</td><td>Fire · swing the sword</td></tr>
      </table>
      <div class="padmap" data-padmap></div>
      <div id="keyBinds"></div>
    </section>
  </div>
  <div id="relock" class="screen hidden"><button class="primary" id="relockBtn">Click to continue</button></div>
  <div id="charcreate" class="screen hidden">
    <div class="card">
      <div class="eyebrow">Journal · optional</div>
      <h1>Who are you?</h1>
      <p class="lead">Nothing here is needed to play. Your name shows on your casebook, your hero and the credits. Change it anytime from the Journal or the tailor's mirror.</p>
      <label class="field">Character name<input id="ccName" type="text" maxlength="40" placeholder="e.g. Rill of the Dais"></label>
      <label class="field">What does your character want more than anything? <span class="hint">optional</span>
        <textarea id="ccMotivation" rows="2" placeholder="Revenge, a cure, a crown, to be forgiven..."></textarea>
      </label>
      <label class="field">What's one true thing about this world that only you know? <span class="hint">optional — makes great lore</span>
        <textarea id="ccSecret" rows="2" placeholder="A secret, a rumor, a prophecy..."></textarea>
      </label>
      <div class="row">
        <button id="ccSkip">Close</button>
        <button id="ccBegin" class="primary">Save</button>
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
let lookingAt: 'natalie' | 'bolt' | 'library' | 'thing' | null = null;
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
  ['l', 12, 'Swap shoulder · weapon'], ['l', 14, 'Quick swap: left hand (torch)'], ['l', 13, 'Hold: torch'], ['l', 8, 'Bag'],
  ['r', 7, 'Fire · swing'], ['r', 15, 'Quick swap: right hand'], ['r', 5, 'Camera out · page on'], ['r', 3, 'Jump'], ['r', 2, 'Reload'], ['r', 1, 'Sneak · back'],
  ['r', 0, 'Use · talk · read'], ['r', 'Right stick', 'Look · click: change camera'], ['r', 9, 'Pause'],
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
  $('prompt').querySelector('kbd')!.textContent = inputMode === 'pad' ? A : 'E';
  document.body.dataset.pad = fam;
  renderPadMap(fam);
  // v0.06 C3: the band's note keys show pad buttons while a controller is in use.
  document.dispatchEvent(new Event('glyphs'));
}

function setState(s: State) {
  if (s === 'pause' && state !== 'pause') openGroup(null);   // v0.06 P1: the pause menu opens on its sidebar
  state = s;
  intro?.backdrop(!inWorld);   // v0.06 M3: the title wall stays behind every menu screen until Begin
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
  if (s === 'pause' && inputMode !== 'mouse') focusMenu(0);
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
  // v0.05: pick up where the last save left off (the spot only if you saved, not if you retired at the gate).
  const save = loadGame();
  if (save?.pos) player.spawn(new THREE.Vector3(...save.pos), save.yaw); else player.spawn(world.spawn.pos, world.spawn.yaw);
  if (save && !begun) {
    setWorldTime(save.time);
    for (const [id, n] of save.items) if (inventory.count(id) < n) inventory.give(id, n - inventory.count(id));
  }
  begun = true;
  inWorld = true;
  audio.water(false);
  setView('overhead');                          // v0.06 M7: every Begin starts in the overhead camera
  setState('play');                             // in the world immediately, even before lock resolves
  // Mike 2026-10-30: Begin goes straight into the game. What's new moved to Extras (it read as a menu in the way).
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
let inWorld = false;   // v0.06: false at the main menu (and the screens opened from it), true from Begin until back at the menu
let begun = false;   // v0.05: a save's bag and hour are restored once per page load (later Begins keep the live ones)
let character: Character = loadCharacter();
let ccFrom: State = 'title';
const ccName = $<HTMLInputElement>('ccName'), ccMotivation = $<HTMLTextAreaElement>('ccMotivation'), ccSecret = $<HTMLTextAreaElement>('ccSecret');

function openCharCreate(from: State) {
  ccFrom = from;
  ccName.value = character.name; ccMotivation.value = character.motivation; ccSecret.value = character.secret;
  setState('charcreate');
  if (inputMode !== 'touch') ccName.focus();   // B25: never pop the phone keyboard uninvited
}
function closeCharCreate() {
  character = { name: ccName.value.trim(), motivation: ccMotivation.value.trim(), secret: ccSecret.value.trim(), created: true };
  saveCharacter(character);
  renameForge(character.name);   // B25: the forge and the form share one name
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
  // 2026-10-31 (Mike): character creation is rolled back (backlog B25). Begin always goes straight into play;
  // the form and its Pause > Character button stay in the code, hidden, until it returns as its own step.
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

// v0.06 P1: Skyrim-style pause. A sidebar of groups; picking a group opens its options to the right, picking it
// again (or B / Esc) closes them. From the main menu (Options) the same panel opens, with Back instead of Resume.
let pauseGroup: string | null = null;
function openGroup(g: string | null) {
  pauseGroup = g;
  document.querySelectorAll<HTMLElement>('#pause .pause-panel').forEach((p) => p.classList.toggle('hidden', p.dataset.panel !== g));
  document.querySelectorAll<HTMLElement>('#pause [data-group]').forEach((b) => b.classList.toggle('on', b.dataset.group === g));
  $('resume').textContent = pauseFrom === 'title' ? 'Back' : 'Resume';
  show('quitToMenu', pauseFrom !== 'title');
  document.querySelectorAll<HTMLElement>('#pause .pause-page, #pause .pause-rule').forEach((e) => e.classList.toggle('hidden', pauseFrom === 'title'));   // UX pass: no journal pages before a game
}
document.querySelectorAll<HTMLButtonElement>('#pause [data-group]').forEach((b) => b.addEventListener('click', () => {
  openGroup(pauseGroup === b.dataset.group ? null : b.dataset.group!);
  if (pauseGroup && b.matches(':focus-visible')) focusMenu(0, 'panel');
}));
function pauseBack() {
  if (!pauseGroup) { closePauseMenu(); return; }
  const g = pauseGroup;
  openGroup(null);
  document.querySelector<HTMLButtonElement>(`#pause [data-group="${g}"]`)?.focus({ preventScroll: true });
}
/** Left / right on a focused setting: step a slider, cycle a list, flip a box. */
function nudge(el: Element, d: number) {
  if (el instanceof HTMLInputElement && el.type === 'range') {
    const v = Math.min(Number(el.max), Math.max(Number(el.min), Number(el.value) + d * Number(el.step || 1)));
    el.value = String(v); el.dispatchEvent(new Event('input', { bubbles: true }));
  } else if (el instanceof HTMLInputElement && el.type === 'checkbox') {
    el.checked = !el.checked; el.dispatchEvent(new Event('change', { bubbles: true }));
  } else if (el instanceof HTMLSelectElement) {
    el.selectedIndex = (el.selectedIndex + d + el.options.length) % el.options.length; el.dispatchEvent(new Event('change', { bubbles: true }));
  }
}
$('resume').addEventListener('click', () => closePauseMenu());
// v0.06 M8: is a controller plugged in? Shown at the side of the main menu and the pause menu.
function syncPadStatus() {
  const on = [...(navigator.getGamepads?.() ?? [])].some((p) => !!p && p.connected);
  const t = on ? 'Controller connected' : 'No controller detected';
  const el = $('padStatus');
  if (el.textContent !== t) { el.textContent = t; el.classList.toggle('on', on); }
}
window.addEventListener('gamepadconnected', syncPadStatus);
window.addEventListener('gamepaddisconnected', syncPadStatus);
setInterval(syncPadStatus, 500);
syncPadStatus();
$('relockBtn').addEventListener('click', () => void resumePlay());

// ---------- F3 dialogue + inventory ----------
const dialogue = new DialogueBox();
const inventory = new Inventory();
// UX pass: the purse at the hip shows the crowns; coins jingle as they drop in.
inventory.onChange = () => { const c = inventory.count(CROWN); if (c > purse.crowns && begun) audio.coins(Math.min(6, 2 + c - purse.crowns)); purse.set(c); };
inventory.root.querySelector('.inv-close')!.addEventListener('click', () => closeInventory());
// ---------- F4 crossbow ----------
world.scene.add(camera);   // the first-person crossbow rides on the camera
const crossbow = new Crossbow(world.scene, camera, player, inventory, world.solids, () => rig.playFov);
crossbow.onFire = () => { audio.crossbowTwang(); gear.wearString(); };
crossbow.onReloadClick = () => audio.reloadClick();
// v0.08 (Mike 2026-11-01): the smith's practice sword. Swing it at goblins (src/sword.ts).
const sword = new Sword(camera, player, inventory);
sword.onSwing = (heavy) => { audio.swordSwish(heavy); haptics.play('tap'); };
sword.onHit = (n, heavy) => { gear.wearSword(n); audio.swordHit(heavy); haptics.play('hit'); hitStop = heavy ? 0.09 : 0.05; };
sword.onChange = () => { if (sword.equipped && crossbow.equipped) crossbow.unequip(); };
let hitStop = 0, swordHitsAtEntry = 0;   // a few frames' pause on a hit, for weight
const ammoText = $('ammoText'), reloadBar = $('reloadBar'), reloadFill = reloadBar.querySelector<HTMLElement>('.fill')!;
reloadBar.querySelector<HTMLElement>('.zone')!.style.cssText = `left:${ZONE.start * 100}%;width:${(ZONE.end - ZONE.start) * 100}%`;
function updateAmmoHud() {
  show('ammo', crossbow.equipped);
  if (!crossbow.equipped) return;
  const r = crossbow.reload;
  const st = r.active ? (r.mode === 'jam' ? 'JAMMED' : r.mode === 'fast' ? 'Perfect!' : 'Reloading… R in the bright zone') : crossbow.loaded ? (crossbow.bonusNextShot ? 'Loaded · 2× damage' : 'Loaded') : 'Empty · R to reload';
  const t = `Bolts ${inventory.count('bolt')} · ${st}${crossbow.power < 1 ? ' · string frayed' : ''}`;
  if (ammoText.textContent !== t) ammoText.textContent = t;
  show('reloadBar', r.active);
  if (r.active) reloadFill.style.width = Math.min(100, (r.t / (r.mode === 'normal' ? 2 : r.total)) * 100) + '%';
  reloadBar.classList.toggle('jam', r.active && r.mode === 'jam');
}
function fire() {
  if (state === 'play' && sword.equipped) { sword.swing(); return; }
  if (state !== 'play' || !crossbow.equipped) return;
  if (crossbow.fire()) { haptics.play('fire'); return; }
  if (!crossbow.loaded && !crossbow.reloading) toast(inventory.count('bolt') ? 'Empty: press R to reload' : 'No bolts left. Pick spent ones up with E.', 1800);
}
function equip(on: boolean) {
  if (on && !crossbow.equip()) { toast('You have no crossbow yet.', 1800); return; }
  if (on && sword.equipped) sword.unequip();
  if (!on) { crossbow.unequip(); if (sword.equipped) sword.unequip(); }
}
function equipSword() {
  if (!sword.equip()) { toast('No sword yet. The smith keeps a practice sword on the stand outside the smithy.', 2600); return; }
  if (crossbow.equipped) crossbow.unequip();
}
// The practice sword on its stand in front of the smithy: take it once; the stand stays empty after.
const standSword = world.standees.sword;
const swordHit = new THREE.Mesh(new THREE.BoxGeometry(0.8, 1.4, 0.8), new THREE.MeshBasicMaterial({ visible: false }));
swordHit.position.copy(standSword.position).setY(0.7); swordHit.name = 'sword-stand';
world.scene.add(swordHit);
interactables.push({ obj: swordHit, verb: () => 'Take the practice sword', act: () => takeSword(), when: () => !sword.owned && !inDungeon });
function syncStandSword() {
  const r = standSword.userData.replacedBy as THREE.Object3D | undefined, here = !sword.owned;
  if (r) r.visible = here; else standSword.visible = here;
}
function takeSword() {
  if (sword.owned) return;
  inventory.give('sword', 1); haptics.play('pickup'); syncStandSword();
  equipSword(); showQuick();
  const how = inputMode === 'mouse' ? 'Click to swing, and keep clicking for a three-cut combo. 3 or Q draws it, 2 puts it away.'
    : inputMode === 'pad' ? 'RT swings, and keep pressing for a three-cut combo. D-pad right changes weapon.'
    : 'Tap Swing, and keep tapping for a three-cut combo. The weapon button changes what you hold.';
  hint(`The smith won't miss that practice sword for a night. ${how}`, `Practice sword taken. ${how}`, 5200);
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
// v0.06 T1/T4: townsfolk and the cinema band walk, spar, trade, chat and play on the procedural rig.
const townsfolk = new Townsfolk(world.scene);
townsfolk.setCount(settings.preset === 'low' ? 'low' : 'full');
for (const f of townsfolk.folk) puppets.set(f.id, figureOf(f.root));
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
  const folk = root.userData.folk as import('./world/townsfolk').Folk | undefined;
  if (folk) return folk.active ? { speed: folk.speed, talking: folk.talking, pose: folk.pose, look: folk.speed > 0.3 || folk.pose ? null : look } : null;
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
  purse.update(dt);
  syncStandSword();
  if (player.pos.y > 3.3 && !player.airborne) earn(5, 'a purse left on the lookout', 'lookout');
  if (quickTimer > 0 && (quickTimer -= dt) <= 0) $('quick').classList.add('hidden');
  if (player.vaults !== lastVaults) { lastVaults = player.vaults; haptics.play('jump'); }
  const rm = crossbow.reload.active ? crossbow.reload.mode : null;   // v0.04: feel the reload start and a jam
  if (rm !== lastReload) { if (rm === 'jam') haptics.play('jam'); else if (rm === 'normal') haptics.play('reload'); lastReload = rm; }
  dust.update(dt, camera);
  const mine: AnimInput = {
    speed: state === 'play' ? player.hSpeed : 0, talking: state === 'dialogue', aiming: crossbow.equipped,
    sword: sword.equipped, swing: sword.progress, combo: sword.combo,
    airborne: player.airborne, landed, pose: dojo.pose ?? stationPose ?? (state === 'book' ? 'read' : null),
    look: { yaw: wrapAngle(player.yaw - player.bodyYaw), pitch: -player.pitch * 0.6 },
  };
  sword.held.visible = sword.equipped && !mine.pose;   // put away at a station or a drill
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
  townsfolk.bandPlaying = cinema.withSound;
  townsfolk.update(dt, camera);
  folkVoices(dt);
  bannerT += dt;
  swayStation(dt);
  companion.update(dt, player.pos, player.bodyYaw, state !== 'play');
  questProps.update(bannerT);
  barkTick(dt);
  gateCheck();
  // The library's interior (shelves, books, furniture: ~18 draw calls) only draws once the camera is near its door.
  library.group.visible = !inDungeon && camera.position.z < -4;
  dungeon.update(bannerT);
  dojo.tick(dt);
  mapClock += dt; if (mapClock > 0.5) { mapClock = 0; if (!inDungeon) livingMap.reveal(player.pos.x, player.pos.z); }
  const fl = world.campfireFlame, flare = 1 + fireFlare;
  fireFlare *= Math.exp(-dt * 2.5);
  fl.scale.set((1 + Math.sin(bannerT * 13) * 0.06) * flare, (1 + Math.sin(bannerT * 9.3) * 0.14 + Math.sin(bannerT * 21) * 0.06) * flare * flare, (1 + Math.cos(bannerT * 11) * 0.06) * flare);
  if (satAtFire && player.pos.distanceTo(world.stations.campfire.position) > 25) satAtFire = false;   // left camp: the bedroll waits for the next sit
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
  torch.attach(); sword.attach();
  heldBook.attach(); purse.attach(); wear.attach(); wear.set(wear.level);
  puppets.set('player', { ...puppets.get('player')!, root: fig, fig: new FigureAnim(fig.userData.rig) });
  if (loadedModels.has('player')) puppets.set('player', { root: loadedModels.get('player')!, body: animators.has('player') ? undefined : new BodyAnim(loadedModels.get('player')!.children[0]) });
}
try { if (localStorage.getItem('gametool.forge.character')) setPlayerLook(loadForge(character.name)); } catch { /* storage blocked: default look */ }
// v0.06 S1–S2: at a station the avatar takes the station's pose, and the camera frames the whole station and the
// avatar, then sways slowly a few degrees clockwise and back (none with reduced motion). The panel covers the left
// of the screen (the bottom on a narrow phone, src/forge/forge.css), so the station is fitted into the rest.
let stationPose: Pose | null = null;
let stationView: { focus: THREE.Vector3; pos: THREE.Vector3; look: THREE.Vector3; fov: number; t: number; shot: Shot | null } | null = null;
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
const UP = new THREE.Vector3(0, 1, 0);
function frameStation(focus: THREE.Vector3, radius: number, from: THREE.Vector3, fov = 44, elev = 0.3) {
  const v = THREE.MathUtils.degToRad(fov / 2), h = Math.atan(Math.tan(v) * (innerWidth / innerHeight));
  const narrow = innerWidth <= 600;
  const fitH = narrow ? h : Math.atan(Math.tan(h) * 0.5), fitV = narrow ? Math.atan(Math.tan(v) * 0.4) : v;
  const dist = (radius / Math.sin(Math.min(fitH, fitV))) * 1.06;
  const d = from.clone().setY(0).normalize();
  const pos = focus.clone().addScaledVector(d, dist * Math.cos(elev)).addScaledVector(UP, dist * Math.sin(elev));
  const fwd = focus.clone().sub(pos).normalize(), right = new THREE.Vector3().crossVectors(fwd, UP).normalize(), up = new THREE.Vector3().crossVectors(right, fwd);
  const look = focus.clone();
  if (narrow) look.addScaledVector(up, -dist * 0.6 * Math.tan(v)); else look.addScaledVector(right, -dist * 0.5 * Math.tan(h));
  stationView = { focus: focus.clone(), pos, look, fov, t: 0, shot: null };
  swayStation(0);
}
function swayStation(dt: number) {
  const sv = stationView;
  if (!sv || state !== 'forge' || (sv.shot && rig.currentShot !== sv.shot)) return;   // another shot (a telling) took over
  sv.t += dt;
  const a = reducedMotion.matches ? 0 : THREE.MathUtils.degToRad(4) * Math.sin((sv.t / 10) * Math.PI * 2);
  const turn = (p: THREE.Vector3) => p.clone().sub(sv.focus).applyAxisAngle(UP, a).add(sv.focus);
  sv.shot = { pos: turn(sv.pos), look: turn(sv.look), fov: sv.fov };
  rig.setShot(sv.shot);
}
/** Stand the avatar at `spot`, facing `face`, in a station pose. */
function takeStation(spot: THREE.Vector3, face: THREE.Vector3, pose: Pose) {
  player.spawn(new THREE.Vector3(spot.x, 0, spot.z), Math.atan2(-(face.x - spot.x), -(face.z - spot.z)));
  player.thirdPerson = true;
  stationPose = pose;
}
// The forge camera for the character forge: a front three-quarter view of the player, figure in the right half.
function frameForge(target: 'body' | 'fire') {
  if (target === 'fire') {
    const f = world.stations.campfire.position;
    frameStation(new THREE.Vector3(f.x + 0.2, 0.6, f.z - 0.5), 2.4, new THREE.Vector3(1, 0, 0.75));
    return;
  }
  const fx = -Math.sin(player.bodyYaw), fz = -Math.cos(player.bodyYaw);   // body forward
  frameStation(new THREE.Vector3(player.pos.x, 0.95, player.pos.z), 1.05, new THREE.Vector3(fx - fz * 0.3, 0, fz + fx * 0.3), 40, 0.12);
}
function enterForge() {
  forgeFrom = state === 'pause' ? 'pause' : 'play';
  if (document.pointerLockElement) { expectUnlock = true; document.exitPointerLock(); }
  setState('forge');
}
function leaveForge() {
  rig.setShot(null);
  stationView = null; stationPose = null;
  if (forgeFrom === 'pause') setState('pause'); else void resumePlay();
}
const characterForge = new CharacterForge(
  (c) => setPlayerLook(c),
  (c) => { character = { ...character, name: c.name || character.name, created: true }; saveCharacter(character); leaveForge(); },
  loreWords, forgeAuthor);
function openCharacterForge() {
  enterForge();
  // v0.06 S3: at the tailor, turn to face the street so the camera (in front of you) is never inside the building;
  // at the camp mirror, stand in front of the glass.
  const door = world.town.doors.tailor, m = world.stations.mirror.position;
  const dd = Math.hypot(player.pos.x - door.position.x, player.pos.z - door.position.z), dm = Math.hypot(player.pos.x - m.x, player.pos.z - m.z);
  if (dd < 5) {
    const out = outOfDoor('tailor', 2.2);
    takeStation(out, outOfDoor('tailor', 6), 'mirror');
  } else if (dm < 4) {
    const n = new THREE.Vector3(Math.sin(world.stations.mirror.rotation.y), 0, Math.cos(world.stations.mirror.rotation.y)), side = player.pos.clone().sub(m).dot(n) >= 0 ? 1 : -1;
    const spot = m.clone().addScaledVector(n, side * 1.3), face = m.clone().addScaledVector(n, side * 4);
    takeStation(spot, face, 'mirror');   // back to the glass, facing the camera
  } else { player.thirdPerson = true; stationPose = 'mirror'; }
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
  weaponDisplay.rotation.set(0, -0.6, 0);   // v0.06 S4: it stays still; drag (right mouse or a finger) or the right stick turns it
  enterForge();
  // S1: you stand at the anvil's near side with the hammer; the camera takes in the anvil, the crossbow and you.
  const from = new THREE.Vector3(2.1, 0, 0.5), side = new THREE.Vector3(-0.35, 0, 1).normalize();
  takeStation(at.clone().addScaledVector(side, 0.85), at, 'smith');
  frameStation(new THREE.Vector3(at.x, 1.0, at.z).addScaledVector(side, 0.35), 1.75, from, 42);
  weaponDisplay.visible = true;
  weaponForge.open(loadWeapon());
}
function closeForges() { if (gateOpen) gateNo(); if (descendSheet) { descendSheet.remove(); descendSheet = null; leaveForge(); } characterForge.close(); weaponForge.close(); sketchPad.close(); casebook.close(); folklore.close(); telling.close(); quick.close(); cook.close(); campfire.close(); recipeBook.close(); livingMap.close(); dojo.close(); caravan.close(); phrasebook.close(); skills.close(); skillsBook.close(); gear.close(); if (state === 'forge') wiki.close(); shop.close(); cinema.close(); if (galleryCard) { galleryCard.remove(); galleryCard = null; leaveForge(); } }
// ---------- Phase C: B13 ink and paper, B3 margin notes, B10 sketch-to-world; saved on this device ----------
// v0.04 crowns: finds and writing pay; spent at the General Store (src/shop.ts). Session-only, like the bag.
const paidFor = new Set<string>();
function earn(n: number, why: string, once?: string) {
  if (once) { if (paidFor.has(once)) return; paidFor.add(once); }
  inventory.give(CROWN, n);
  haptics.play('pickup');
  toast(`+${n} ◎ ${why}`, 2400);
}
let marginCount = loadMargins().length;
let stationery: Stationery = loadStationery();
const setStationery = (s: Stationery) => { stationery = s; saveStationery(s); applyStationery(s); refreshMarginsInWorld(); };
applyStationery(stationery);
const bookmarks = new THREE.Group();
world.scene.add(bookmarks);
function refreshMarginsInWorld() {
  buildBookmarks(library.redBooks, loadMargins(), bookmarks);
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
  (s: Sketch) => { stampBanner(world.bannerCloth, s); try { localStorage.setItem('gametool.banner', s.id); } catch { /* blocked */ } toast(`"${s.name}" is pinned to the writing desk.`); earn(3, 'for a banner sketch', 'sketch:' + s.id); },
  () => leaveForge(), forgeAuthor);
stampBanner(world.bannerCloth, (() => { try { return sketchById(localStorage.getItem('gametool.banner') ?? '') ?? DEFAULT_SKETCH; } catch { return DEFAULT_SKETCH; } })());
function openSketchbook(frame: 'banner' | 'body' = 'banner') {
  enterForge();
  if (frame === 'banner') {
    // v0.06 S5: the writing desk at camp. Stand at it with the quill; the camera takes in the desk and you.
    const d = world.stations.banner.position, n = new THREE.Vector3(-d.x, 0, -d.z).normalize();
    takeStation(d.clone().addScaledVector(n, 0.72), d, 'write');
    frameStation(new THREE.Vector3(d.x, 0.9, d.z).addScaledVector(n, 0.35), 1.35, n.clone().applyAxisAngle(UP, 0.9), 42);
  } else { stationPose = 'write'; player.thirdPerson = true; frameForge('body'); }
  sketchPad.open(sketchById(world.bannerCloth.userData.sketch));
}
// ---------- Phase D: B2 companion + detective quest, B12 item folklore; saved on this device ----------
const quest = loadQuest();
const questProps = new QuestProps(world.scene);
questProps.sync(quest.clues);
questProps.showLead(quest.stage === 'lead' ? quest.theory?.where ?? null : null);
const natalieRoot = () => (world.standees.natalie.userData.replacedBy as THREE.Object3D | undefined) ?? world.standees.natalie;
const companion = new Companion(natalieRoot, world.natalieTarget, world.colliders, world.bounds, loadCompanion());
companion.terrain = (x, z) => (inDungeon ? 0 : world.heightAt(x, z));
($('companionQuiet') as HTMLInputElement).checked = companion.prefs.quiet;
$('companionQuiet').addEventListener('change', (e) => { companion.prefs.quiet = (e.target as HTMLInputElement).checked; saveCompanion(companion.prefs); });
const seen = (() => { try { return JSON.parse(localStorage.getItem('gametool.seen') ?? '[]') as string[]; } catch { return [] as string[]; } })();
function markSeen(id: string) { if (!seen.includes(id)) { seen.push(id); try { localStorage.setItem('gametool.seen', JSON.stringify(seen)); } catch { /* blocked */ } } }
const casebook = new Casebook(() => quest, (th: Theory) => {
  quest.theory = th; quest.stage = 'lead'; saveQuest(quest);
  questProps.showLead(th.where);
  companion.say(support(quest, th) >= 2 ? QUEST.natalie.supported : QUEST.natalie.leap, { force: true });
}, () => leaveForge(), loreWords, forgeAuthor);
casebook.owner = () => character.name;
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
  toast(`Clue: ${c.name}. ${c.text}`, 6000);
  setTimeout(() => hint(`That goes in the casebook. Look it over with ${keyName('casebook')}.`, '(J: casebook)', 2600), 1800);
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
  afterDialogue = () => { hint(`My field note's done. It's in the casebook: ${keyName('casebook')}.`, 'Natalie finished her field note. Read it in the casebook (J).', 5000); void resumePlay(); };
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
// v0.05 §5: Natalie tells a lore page with kinetic type; the fire flares on the emphasised words and the dramatic beats.
const telling = new TellingView();
let fireFlare = 0;
campfire.tales = () => lore.entries.filter((e) => e.type === 'lore' || e.type === 'character' || e.type === 'song').map((e) => ({ id: e.id, title: e.title }));
campfire.onTell = (id) => {
  const e = entryById.get(id);
  if (!e) return;
  campfire.el.classList.add('telling-on');
  telling.open(e.title, `Written by ${e.credit_as}`, e.body);
  frameTelling();
};
// Natalie and the fire in the open part of the screen: the left half on a wide screen, the top on a tall one.
function frameTelling() {
  const f = world.stations.campfire.position, n = natalieRoot().position, pos = new THREE.Vector3(f.x + 2.4, 1.5, f.z + 1.2);
  const mid = new THREE.Vector3((f.x + n.x) / 2, 0.6, (f.z + n.z) / 2);
  const d = mid.clone().sub(pos).setY(0).normalize(), right = new THREE.Vector3().crossVectors(d, new THREE.Vector3(0, 1, 0));
  const tall = innerHeight > innerWidth;
  if (tall) {   // straight down Natalie's line of sight, so she faces the camera across the flames
    const dn = new THREE.Vector3(f.x - n.x, 0, f.z - n.z).normalize();
    pos.copy(mid).addScaledVector(dn, 6).addScaledVector(right, 1.2).setY(2.8); mid.y -= 1.2;
  } else mid.addScaledVector(right, 1.1);
  rig.setShot({ pos, look: mid, fov: tall ? 62 : 46 });
}
telling.onBeat = (b) => { if (b.tone === 'drama') fireFlare = Math.max(fireFlare, 0.7); else if (b.tone === 'em') fireFlare = Math.max(fireFlare, 0.25); };
telling.onClose = () => { campfire.el.classList.remove('telling-on'); if (campfire.isOpen) frameForge('fire'); };
// v0.04: Natalie the bard comes to the fire while you sit there (across the flames from you), then goes back.
let natalieWas: { x: number; z: number; ry: number } | null = null;
// v0.05 §4.1: the bedroll is part of the camp. It unlocks once you've sat by the fire, and locks again when you leave camp.
let satAtFire = false;
function openCampfire() {
  satAtFire = true;
  autoSave();   // UX pass: sitting at the fire saves
  enterForge();
  const f0 = world.stations.campfire.position;
  takeStation(new THREE.Vector3(f0.x + 1.5, 0, f0.z + 0.3).addScaledVector(new THREE.Vector3(1, 0, 0.2).normalize(), -0.05), f0, 'sit');   // v0.06 S1: on the log seat
  frameForge('fire');
  const n = natalieRoot(), f = world.stations.campfire.position;
  natalieWas = { x: n.position.x, z: n.position.z, ry: n.rotation.y };
  n.position.set(f.x - 0.7, 0, f.z - 2.3); n.rotation.y = Math.atan2(f.x - n.position.x, f.z - n.position.z);
  campfire.open();
}
// ---------- B18: cooking at the campfire; the Recipe book in the Journal ----------
const cook = new CookPanel(() => { if (state === 'forge') campfire.el.classList.remove('hidden'); });   // back to the fire
cook.author = () => forgeAuthor();
cook.onLearn = (r) => earn(3, `${r.name} recipe`, 'recipe:' + r.id);
cook.onEat = (b) => { haptics.play('pickup'); toast(`🍽 ${BUFFS[b].name}: ${BUFFS[b].text}`, 3600); };
campfire.onCook = () => { campfire.el.classList.add('hidden'); cook.open(); };
const recipeBook = new RecipeBook(cook, () => leaveForge());
function openRecipeBook() { if (state !== 'play' && state !== 'pause') return; enterForge(); recipeBook.open(); }
let sturdy = false;   // B18: a "well fed" delve
const campfireClosed = campfire.onClose;
// v0.06 C3: the band's note keys show pad buttons while a controller is in use, and swap back live.
const NOTE_BUTTONS = (() => { const B = controls.gamepad.buttons; return [B.reload, B.jump, B.zoomIn, B.zoomOut, B.aim, B.fire]; })();
document.addEventListener('glyphs', () => campfire.setPadGlyphs(inputMode === 'pad' ? (i) => glyph(gamepad?.family ?? 'xbox', NOTE_BUTTONS[i]) : null));
// v0.06 C1–C2: Sleep is the first item at the fire; sitting down is what unlocks it, so it is always open here.
campfire.sleepLabel = () => `Sleep until ${WAKE_AT[NEXT_TIME[world.time]]}`;
campfire.onSleep = () => sleep(true);
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
function sleep(onBedroll = false) {
  if (sleeping) return;
  sleeping = true;
  if (onBedroll) {   // v0.06 S1: kneel on the bedroll while the view fades
    const b = world.stations.bedroll.position;
    takeStation(new THREE.Vector3(b.x - 0.6, 0, b.z + 0.2), b, 'kneel');
  }
  const fade = $('sleepFade');
  fade.classList.add('on');
  setTimeout(() => {
    const next = NEXT_TIME[world.time];
    setWorldTime(next, true);
    autoSave();
    fade.classList.remove('on');
    sleeping = false;
    if (stationPose === 'kneel') stationPose = null;
    if (next === 'night') hint(`Nightfall already. Light your torch: ${keyName('torch')}.`, 'You wake at nightfall. Light your torch (T).', 2600);
    else toast(`You wake at ${WAKE_AT[next]}.`, 2600);
  }, 1100);
}
interactables.push({ obj: world.stations.bedroll, verb: () => satAtFire ? `Sleep until ${WAKE_AT[NEXT_TIME[world.time]]}` : 'Bedroll (sit by the fire first)',
  act: () => { if (satAtFire) sleep(true); else toast('Sit by the fire first. Rest comes after the camp has settled.', 2600); }, when: () => !inDungeon });
async function openBallad(b: Ballad) {
  setState('book');
  if (document.pointerLockElement) { expectUnlock = true; document.exitPointerLock(); }
  const t = decodeTune(b.tune);
  audio.tune(t.steps, SCALE, t.instrument, t.bpm, 2);
  await reader.openEntries([balladEntry(b, forgeAuthor())]);
}
const gallery = new Gallery(world.scene, world.colliders);
const ceilings = buildCeilings(world.scene);
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
  out.push({ id: 'banner', title: sk?.name || 'Your crest', credit: me, kind: 'sketch', text: 'Painted in the sketchbook.', discovered: !!sk, hint: 'Sketch at the writing desk in camp.',
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
// The follow camera stays under the dungeon ceiling, and (v0.06 W2) under the library's and gallery's while the player is inside.
rig.ceiling = (x, z) => { if (inDungeon) return 2.9; const r = roofOver(player.pos.x, player.pos.z); return r && roofOver(x, z, 1) === r ? r.y - 0.3 : Infinity; };
const delves = (() => { try { return JSON.parse(localStorage.getItem('gametool.delves') ?? '{}') as Record<string, { theme: string; chest?: boolean; nest?: boolean; quick?: 'won' | 'lost'; at: string }>; } catch { return {}; } })();
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
  inDungeon = true; swordHitsAtEntry = sword.hits; sturdy = cook.consume('sturdy');
  spawnGoblins();
  delves[seed] = { ...(delves[seed] ?? {}), theme: L.theme, at: new Date().toISOString().slice(0, 10) };
  saveDelves();
  toast(`Under the library · seed ${seed} · ${L.theme}. Same seed, same dungeon.`, 4500);
  companion.say('Stay close. I can hear something chewing.', { key: 'dungeon:' + seed, force: true });
}
function exitDungeon() {
  if (!inDungeon) return;
  if (sword.hits > swordHitsAtEntry) { gear.rustSword(); toast('Goblin blood and cellar damp: your blade is spotting with rust. The smith\'s oil will fix it.', 3600); }   // B17
  inDungeon = false;
  const set = new Set(dungeon.colliders);
  for (let i = world.colliders.length - 1; i >= 0; i--) if (set.has(world.colliders[i])) world.colliders.splice(i, 1);
  player.bounds = rig.bounds = world.bounds;
  const fog = world.scene.fog as THREE.Fog;
  if (savedFog) { fog.color.copy(savedFog.color); fog.near = savedFog.near; fog.far = savedFog.far; (world.scene.background as THREE.Color).copy(savedFog.bg); }
  dungeon.group.visible = false; dungeon.hideSpots();
  goblins.clear(); slowT = 0; player.speedMul = 1; sturdy = false;
  player.spawn(TRAPDOOR.clone().add(new THREE.Vector3(0, 0, 1.6)), 0);
  if (companion.prefs.follow) natalieRoot().position.copy(TRAPDOOR).add(new THREE.Vector3(1.4, 0, 1.4));
}
let descendSheet: HTMLElement | null = null;
function openDescend() {
  enterForge();
  const el = document.createElement('div');
  el.className = 'gallery-card';
  el.id = 'descend';
  el.innerHTML = `<div class="card-in"><div class="credit">Under the Ruined Library</div><h3>Enter Normal Dungeon or Run Quick Dungeon?</h3>
    <p>The normal dungeon is a place to walk. The quick dungeon is a map you pick through: four choices, then the goblin's nest. Every seed makes a different one, and the same seed always makes the same one, so you can send a seed to a friend. Today's seed is ${dailySeed()}.</p>
    <label class="field">Seed<input id="dgSeed" type="text" maxlength="24" value="${dailySeed()}"></label>
    <div class="forge-actions"><button class="primary" data-act="go">Normal Dungeon</button><button class="primary" data-act="quick">Quick Dungeon</button></div>
    <div class="forge-actions"><button class="secondary" data-act="close">Not yet</button></div></div>`;
  el.addEventListener('click', (ev) => {
    const a = (ev.target as HTMLElement).closest('[data-act]') as HTMLElement | null;
    if (!a) return;
    const seed = seedFrom((el.querySelector('#dgSeed') as HTMLInputElement).value || String(dailySeed()));
    el.remove(); descendSheet = null;
    if (a.dataset.act === 'quick') { openQuick(seed); return; }   // stays in the forge state until the run ends
    leaveForge();
    if (a.dataset.act === 'go') enterDungeon(seed);
  });
  document.body.appendChild(el);
  descendSheet = el;
}
// v0.05 §6: the Quick Dungeon, a menu-only run picked from the trapdoor.
const quick = new QuickDungeon();
quick.carvings = () => shrineLines.map((e) => ({ line: e.body.replace(/^#.*$/gm, '').replace(/[*_>[\]]/g, '').trim().split(/(?<=[.!?])\s+/)[0], title: e.title, credit: e.credit_as }));
quick.onReward = (r) => { if (r.crowns) inventory.give(CROWN, r.crowns); for (const [id, n] of r.items) inventory.give(id, n); haptics.play('pickup'); };
quick.onFinish = (seed, end) => {
  const d = delves[seed] ?? (delves[seed] = { theme: quick.graph!.theme, at: new Date().toISOString().slice(0, 10) });
  if (end !== 'fled' && d.quick !== 'won') { d.quick = end; saveDelves(); }
  toast(end === 'won' ? 'The nest is cleared. Quick Dungeon done.' : end === 'lost' ? 'Back at the trapdoor. Rest up and try again.' : 'Back at the trapdoor.', 3200);
};
quick.onClose = () => leaveForge();
function openQuick(seed: number) { if (state !== 'forge') enterForge(); quick.open(seed); }
// ---------- Trait roll tables: rolled goblins (docs/trait-roll-tables.md, Mike approved 2026-10-29) ----------
// New goblins every run; `?seed=N` forces the first one (debug), `?bestiary` lines up 12 on the green (dev only).
const urlFlags = new URLSearchParams(location.search);
const forcedGoblin = Number(urlFlags.get('seed')) || 0;
quick.forcedGoblin = forcedGoblin;
const DELVE_HP = 10;
let delveHp = DELVE_HP, slowT = 0, hurtFlash = 0;
const goblins = new Goblins(world.scene, {
  walkable: (x, z) => dungeon.walkable(x, z),
  player: player.pos,
  aiming: () => crossbow.ads,
  hurt: (dmg, by, slow) => {
    if (!inDungeon || delveHp <= 0) return;
    if (sturdy) dmg = Math.max(1, dmg - 1);   // B18: well fed
    delveHp = Math.max(0, delveHp - dmg); hurtFlash = 0.35; haptics.play('hurt');
    if (slow) slowT = Math.max(slowT, slow);
    if (delveHp <= 0) {
      exitDungeon();
      toast(`${by.v.display} knocks you flat. Natalie hauls you back up the stairs.`, 4500);
      companion.say('Up you get. We go back when you\'re ready.', { force: true });
    }
  },
  steal: () => { const n = Math.min(2, inventory.count('bolt')); if (n) inventory.take('bolt', n); return n; },
  loot: (f, crowns, bolts) => {
    inventory.give(CROWN, crowns); if (bolts) inventory.give('bolt', bolts); haptics.play('pickup');
    toast(`${f.v.display} drops ${crowns} crown${crowns > 1 ? 's' : ''}${bolts ? ` and ${bolts} bolt${bolts > 1 ? 's' : ''}` : ''}.`, 2600);
  },
  say: (t) => toast(t, 2600),
});
sword.foes = () => goblins.alive.map((f) => f.root.position);
sword.slash = (c) => goblins.slash(c.from, c.fwd, c.reach, c.arc, c.damage, c.heavy).length;
crossbow.targets = (from, dir, len) => {
  const h = goblins.list.length ? goblins.hitTest(from, dir, len) : null;
  return h && { dist: h.dist, hit: (dmg, d) => { haptics.play('hit'); return goblins.shoot(h.foe, dmg, d); } };
};
function spawnGoblins() {
  goblins.clear(); delveHp = DELVE_HP + (cook.consume('hearty') ? 3 : 0); slowT = 0;   // B18: a hearty meal
  const L = dungeon.layout!, run = (Math.random() * 2 ** 31) | 0;
  // One per room by depth, two in the nest (its first with a bigger budget); at most MAX_FOES.
  const rooms = L.rooms.filter((r) => r.tag !== 'entrance').sort((a, b) => (a.tag === 'nest' ? -1 : b.tag === 'nest' ? 1 : a.depth - b.depth));
  let i = 0;
  for (const r of rooms) for (let k = 0; k < (r.tag === 'nest' ? 2 : 1) && goblins.alive.length < MAX_FOES; k++, i++) {
    const seed = i === 0 && forcedGoblin ? forcedGoblin : seedOf(run, i);
    goblins.spawn(rollGoblin(seed, r.tag === 'nest' && k === 0 ? 8 : undefined), dungeon.roomAt(r, k, 0), Math.PI);
  }
}
const delveHpEl = document.getElementById('delveHp')!;
// UX pass (Mike 2026-10-31): your health shows on you, not as a counter. Below half, the edges of your sight redden
// and you breathe hard; below 40% you limp. The old line stays for screen readers (and tests), off screen.
let breathT = 0;
function updateDelve(dt: number) {
  if (!inDungeon) { delveHpEl.classList.add('hidden'); document.body.style.setProperty('--hurt', '0'); if (wear.level) wear.set(0); return; }
  if (state === 'play') { if (hitStop > 0) hitStop -= dt; else goblins.update(dt); }   // v0.08: a beat's pause on a sword hit
  const frac = Math.min(1, delveHp / DELVE_HP);
  wear.set(1 - frac);
  slowT = Math.max(0, slowT - dt); player.speedMul = (slowT > 0 ? 0.55 : 1) * (frac <= 0.4 ? 0.75 : 1);
  hurtFlash = Math.max(0, hurtFlash - dt);
  document.body.style.setProperty('--hurt', (Math.max(0, 1 - frac * 1.6) * 0.85 + hurtFlash * 1.4).toFixed(2));
  if (frac <= 0.5 && state === 'play' && (breathT -= dt) <= 0) { audio.breath(); breathT = 1.2 + frac * 2.4; }
  delveHpEl.classList.remove('hidden');
  delveHpEl.classList.toggle('hit', hurtFlash > 0);
  const t = `♥ ${delveHp}/${DELVE_HP}${slowT > 0 ? ' · slowed' : ''} · goblins ${goblins.alive.length}`;
  if (delveHpEl.textContent !== t) delveHpEl.textContent = t;
}
// Dev: a lineup of 12 rolled goblins on the green, frozen, with their name tags.
const bestiary = urlFlags.has('bestiary') ? (() => {
  const run = (Math.random() * 2 ** 31) | 0, out: THREE.Group[] = [];
  for (let i = 0; i < 12; i++) {
    const v = rollGoblin(i === 0 && forcedGoblin ? forcedGoblin : seedOf(run, i));
    const f = goblins.spawn(v, new THREE.Vector3(2 + (i - 5.5) * 0.75, 0, 19.5), 0, true)!;
    out.push(f.root);
  }
  return out;
})() : null;
// ---------- B20: the DM view (?dm, behind a passphrase; same app, nothing private shipped) ----------
const dm = urlFlags.has('dm') ? (() => {
  const v = new DmView();
  v.places = (): Place[] => [
    { x: 0, z: -30, w: 26, d: 24, ry: 0, label: 'The library (glade)' },
    ...TOWN_LOTS.map((l) => ({ x: l.x, z: l.z, w: l.w, d: l.d, ry: l.ry, label: TOWN_NAMES[l.id] })),
    { x: FOUNTAIN.x, z: FOUNTAIN.z, w: FOUNTAIN.r * 2, d: FOUNTAIN.r * 2, ry: 0, label: 'Fountain' },
  ];
  v.scripts = () => ({ natalie: natalieScript as DialogueScript });
  v.open();
  return v;
})() : null;
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
  const nCards = Object.keys(skills.st.cards).length;
  m.push({ x: GRIND.x, z: GRIND.z, label: 'Grindstone', kind: 'place' });   // B17
  m.push({ x: SKILL_TABLE.x, z: SKILL_TABLE.z, label: nCards ? `${nCards} skill card${nCards > 1 ? 's' : ''}` : 'Practice table', kind: 'place' });
  m.push({ x: CARAVAN.x, z: CARAVAN.z - 3, label: caravan.st.done.length ? `Caravan: ${caravan.st.phrases.length} phrases` : 'A caravan camps here', kind: 'place' });
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

// ---------- B16: the Spanish caravan by the coach road (never translated; a phrasebook in the Journal) ----------
const caravanFolk = buildCaravan(world.scene, world.colliders, world.heightAt);
for (const f of caravanFolk) puppets.set('caravan:' + f.id, figureOf(f.root));
let caravanView: boolean | null = null;
const caravan = new CaravanPanel((t) => {
  for (const f of caravanFolk) f.root.userData.folk.talking = !!t && f.id === t.id;
  const f = t && caravanFolk.find((c) => c.id === t.id);
  if (!f) return;
  // Stand in front of them, face to face; the camera looks past your shoulder at their face.
  const at = f.root.position, yaw = Math.atan2(at.x - f.stand.x, at.z - f.stand.z);
  player.spawn(f.stand.clone(), yaw);
  const tall = innerHeight > innerWidth, back = new THREE.Vector3(f.stand.x - at.x, 0, f.stand.z - at.z).normalize();
  const side = new THREE.Vector3(back.z, 0, -back.x);
  rig.setShot(tall ? { pos: at.clone().addScaledVector(back, 3.6).setY(at.y + 2.2), look: at.clone().setY(at.y + 0.6), fov: 50 }
    : { pos: at.clone().addScaledVector(back, 3.4).addScaledVector(side, 0.9).setY(at.y + 1.8), look: at.clone().addScaledVector(side, -1.3).setY(at.y + 1.35), fov: 44 });   // side = camera right: they sit right of the panel
}, (t) => earn(t.reward, 'a talk in Spanish', 'es:' + t.id), () => { if (caravanView !== null) { player.thirdPerson = caravanView; caravanView = null; } leaveForge(); }, () => character.name);
function openCaravan(id: string) {
  if (state !== 'play') return;
  const f = caravanFolk.find((c) => c.id === id);
  if (!f) return;
  enterForge();
  if (caravanView === null) { caravanView = player.thirdPerson; player.thirdPerson = true; }
  caravan.open(f.talk);
}
for (const f of caravanFolk) interactables.push({ obj: f.hit, verb: () => f.talk.verb, act: () => openCaravan(f.id), when: () => !inDungeon });
const phrasebook = new Phrasebook(caravan, () => leaveForge());
// ---------- B19: real-skill mini games at the practice table by the dojo mats; cards go in the Skills book ----------
const skillTable = buildSkillTable(world.scene, world.colliders, world.heightAt);
const skills = new SkillsPanel((s) => earn(s.reward, `${s.name} card`, 'skill:' + s.id), () => leaveForge());
function openSkills() {
  if (state !== 'play') return;
  enterForge();
  const { x, z } = SKILL_TABLE;
  player.spawn(new THREE.Vector3(x - 1.1, 0, z), Math.PI / 2);
  stationPose = 'read';
  rig.setShot(innerHeight > innerWidth ? { pos: new THREE.Vector3(x - 3.2, 2.6, z), look: new THREE.Vector3(x, 0.6, z), fov: 50 }
    : { pos: new THREE.Vector3(x - 3.4, 2.1, z + 1.6), look: new THREE.Vector3(x - 0.6, 0.8, z - 0.9), fov: 44 });
  skills.open();
}
interactables.push({ obj: skillTable, verb: () => 'Practise a real skill', act: () => openSkills(), when: () => !inDungeon });
// ---------- B17: gear care at the smith's grindstone (sharpen, clean and oil, restring) ----------
const gear = new GearPanel(() => leaveForge());
gear.has = { sword: () => sword.owned, crossbow: () => inventory.count('crossbow') > 0 };
function applyGear() { const g = gear.st; sword.sharpness = swordSharpness(g); sword.setCondition(g.sharp, g.rust); crossbow.power = bowPower(g); }
gear.onChange = applyGear;
gear.onCard = () => earn(4, 'Gear care card', 'skill:gear');
gear.onStroke = (good) => { audio.grind(good); haptics.play(good ? 'tap' : 'jam'); };
applyGear();
const GRIND = grindstonePos(TOWN_LOTS.find((l) => l.id === 'smithy')!);
const grind = buildGrindstone(world.scene, world.colliders, GRIND, world.heightAt(GRIND.x, GRIND.z));
function openGear() {
  if (state !== 'play') return;
  enterForge();
  const f = new THREE.Vector3(Math.sin(GRIND.ry), 0, Math.cos(GRIND.ry)), r = new THREE.Vector3(Math.cos(GRIND.ry), 0, -Math.sin(GRIND.ry));
  const at = new THREE.Vector3(GRIND.x, 0, GRIND.z).addScaledVector(f, 0.9).addScaledVector(r, 0.3);
  player.spawn(at, Math.atan2(f.x, f.z));
  stationPose = 'smith';
  const look = new THREE.Vector3(GRIND.x, 0.8, GRIND.z).addScaledVector(r, 0.4);
  rig.setShot(innerHeight > innerWidth ? { pos: look.clone().addScaledVector(f, 3.4).setY(2.6), look, fov: 50 }
    : { pos: look.clone().addScaledVector(f, 2.6).addScaledVector(r, -2.2).setY(2.0), look: look.clone().addScaledVector(r, -0.9), fov: 44 });
  gear.open();
}
interactables.push({ obj: grind.hit, verb: () => 'Care for your gear', act: () => openGear(), when: () => !inDungeon });
const skillsBook = new SkillsBook(skills, () => leaveForge(), () => gear.st.card ? gearCardHtml(gear.st)
  : `<div class="sk-card locked"><div class="sk-card-head"><span>${GEAR_CARD.icon}</span><b>${GEAR_CARD.title}</b></div><p class="fine">Not learned yet. The smith teaches it at the grindstone outside the smithy.</p></div>`);
function openSkillsBook() { if (state !== 'play' && state !== 'pause') return; enterForge(); skillsBook.open(); }
// ---------- B21: the GitHub wiki, pulled at build time, read at the reading room lectern in the Ruined Library ----------
const wiki = new WikiPanel();
const wikiLectern = buildWikiLectern(library.group, world.colliders);
function openWiki() { if (state !== 'play') return; enterForge(); wiki.open(() => leaveForge(), 'library'); }
interactables.push({ obj: wikiLectern, verb: () => 'Read the wiki', act: () => openWiki(), when: () => !inDungeon });
function openPhrasebook() { if (state !== 'play' && state !== 'pause') return; enterForge(); phrasebook.open(); }
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
      inventory.give('trinket', 1); haptics.play('pickup');
      hint(`A trinket from below! Into the bag with it (${keyName('bag')}). Magister Greer would love its story.`, 'A trinket from below (I: inventory). Magister Greer would love to hear its story.', 4500);
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
  if (stillFor > 20) { companion.say(any(b.idle)); stillFor = 0; }
}
// Drag on the scene to turn the hero (character forge).
let forgeDrag: number | null = null, forgeDragY = 0;
canvas.addEventListener('pointerdown', (e) => { if (state === 'forge') { forgeDrag = e.clientX; forgeDragY = e.clientY; } });
window.addEventListener('pointerup', () => { forgeDrag = null; });
canvas.addEventListener('contextmenu', (e) => { if (state === 'forge') e.preventDefault(); });
window.addEventListener('pointermove', (e) => {
  if (state !== 'forge' || forgeDrag === null) return;
  const dx = e.clientX - forgeDrag, dy = e.clientY - forgeDragY;
  forgeDrag = e.clientX; forgeDragY = e.clientY;
  if (weaponForge.isOpen) turnWeapon(dx * 0.012, dy * 0.008);   // v0.06 S4: let go and it stays at that angle
  else if (characterForge.isOpen) { player.bodyYaw += dx * 0.012; player.body.rotation.y = player.bodyYaw; }
});
function turnWeapon(yaw: number, pitch: number) {
  weaponDisplay.rotation.y += yaw;
  weaponDisplay.rotation.x = THREE.MathUtils.clamp(weaponDisplay.rotation.x + pitch, -0.9, 0.9);
}
interactables.push(
  { obj: world.stations.mirror, verb: () => 'Change your look', act: () => openCharacterForge() },
  { obj: world.stations.banner, verb: () => 'Sketch at the writing desk', act: () => openSketchbook() },
  { obj: world.stations.anvil, verb: () => inventory.count('crossbow') > 0 ? 'Forge your crossbow' : 'Anvil (bring a crossbow)', act: () => { if (inventory.count('crossbow') > 0) openWeaponForge(); else toast('Natalie has a crossbow you could borrow.'); } },
);
// v0.04 town: one building per tool. E at a door opens it; the shopkeeper trades at the counter.
const shop = new ShopPanel(inventory, () => leaveForge());
function openShop() {
  enterForge();
  const k = world.town.shopkeeper.position, top = new THREE.Vector3(k.x, 1.3, k.z);
  const ry = world.town.shopkeeper.rotation.y, c = Math.cos(ry), sn = Math.sin(ry);
  const pos = new THREE.Vector3(k.x - 2.6 * c + 3.0 * sn, 1.7, k.z + 2.6 * sn + 3.0 * c);   // from the side, past the player's shoulder
  const d = top.clone().sub(pos).normalize(), right = new THREE.Vector3().crossVectors(d, new THREE.Vector3(0, 1, 0)).normalize();
  rig.setShot({ pos, look: top.addScaledVector(right, -0.7), fov: 44 });
  shop.open();
}
/** A point `ahead` metres out of a town door, on the ground. */
const outOfDoor = (id: TownId, ahead: number) => { const d = world.town.doors[id]; return new THREE.Vector3(d.position.x + Math.sin(d.rotation.y) * ahead, 0, d.position.z + Math.cos(d.rotation.y) * ahead); };
const townAct: Record<TownId, () => void> = {
  library: () => { const p = player.pos; void openBook(new THREE.Vector3(p.x - Math.sin(player.yaw) * 0.45, 1.25, p.z - Math.cos(player.yaw) * 0.45)); },
  smithy: () => { if (inventory.count('crossbow') > 0) openWeaponForge(outOfDoor('smithy', 0.8)); else toast('The smith works on crossbows. Natalie has one you could borrow.'); },
  tailor: () => openCharacterForge(),
  scriptorium: () => openSketchbook('body'),
  cartographer: () => openMap(),
  dojo: () => openDojo(),
  gallery: () => { player.spawn(new THREE.Vector3(GALLERY.minX - 1.2, 0, GALLERY.z), -Math.PI / 2); toast('Through the back door and down the lane: the gallery hall.'); },
  shop: () => openShop(),
  inn: () => { if (!inDungeon) sleep(); },
};
// UX pass: every door you go through saves the game.
for (const id of Object.keys(townAct) as TownId[]) { const go = townAct[id]; townAct[id] = () => { go(); autoSave(); }; }
for (const id of Object.keys(townAct) as TownId[]) {
  interactables.push({ obj: world.town.doors[id], verb: () => id === 'inn' ? `Rent a bed until ${WAKE_AT[NEXT_TIME[world.time]]}` : `Enter the ${TOWN_NAMES[id]}`, act: () => townAct[id]() });
}
interactables.push({ obj: world.town.shopkeeperHit, verb: () => 'Trade with the Shopkeeper', act: () => openShop() });
// v0.04 cinema: the Projectionist (a placeholder, never in the lore) shows short reels by Mike and friends
// (assets/cinema/) on a screen in a gap of the town ring.
const cin = world.town.cinema, cc = Math.cos(cin.ry), cs = Math.sin(cin.ry);
const cinAt = (lx: number, lz: number) => new THREE.Vector3(cin.x + lx * cc + lz * cs, 0, cin.z - lx * cs + lz * cc);
const reelScreen = buildScreen();
reelScreen.position.copy(cinAt(0, 0.02)).setY(1.95); reelScreen.rotation.y = cin.ry;
world.scene.add(reelScreen);
const projectionist = buildFigure({ skin: '#E0B890', hair: '#2A2A30', primary: '#2E3A5A', secondary: '#C9A36B', boots: '#2A221C', accent: '#F2C27A', hairStyle: 'cap', scarf: '#B8463A', build: 1.0 }, 1.75);
const pj = cinAt(1.9, 1.0);
projectionist.position.copy(pj); projectionist.rotation.y = cin.ry - 0.5; projectionist.name = 'standee:projectionist';
world.scene.add(projectionist);
world.colliders.push({ kind: 'circle', x: pj.x, z: pj.z, r: 0.35 });
const projectionistHit = new THREE.Mesh(new THREE.BoxGeometry(1.0, 1.8, 1.0), new THREE.MeshBasicMaterial({ visible: false }));
projectionistHit.position.copy(pj).setY(0.9); projectionistHit.name = 'projectionist'; world.scene.add(projectionistHit);
const cinema = new CinemaPanel(reelScreen, () => leaveForge());
function openCinema() { enterForge(); cinema.open(); }
// v0.06 T3: the reels' sound comes from the screen; the fire's music from the fire.
cinema.onVideo = (v) => { const p = reelScreen.position; audio.attachMedia(v, 'cinema', p.x, p.y, p.z, 24); };
let fireOut: AudioNode | null = null;
campfire.out = () => (fireOut ??= audio.spatial('campfire', world.stations.campfire.position.x, 0.8, world.stations.campfire.position.z, 26, 'music'));
// v0.06 T2: ambience zones. Birdsong in a spread of trees, the fountain's and the river's water, the smithy's hammer, chatter at the store.
const lotFront = (id: TownId, out: number) => { const L = TOWN_LOTS.find((l) => l.id === id)!; return { x: L.x + Math.sin(L.ry) * (L.d / 2 + out), z: L.z + Math.cos(L.ry) * (L.d / 2 + out) }; };
const zones: Zone[] = [];
for (const [x, z] of world.trees) if (zones.length < 8 && Math.hypot(x, z) < 46 && zones.every((q) => Math.hypot(q.x - x, q.z - z) > 18)) zones.push({ name: `birds:${zones.length}`, kind: 'birds', x, y: 5, z, range: 15 });
zones.push({ name: 'fountain', kind: 'water', x: FOUNTAIN.x, y: 0.8, z: FOUNTAIN.z, range: 9 });
for (const b of BRIDGES) zones.push({ name: `river:${b.z}`, kind: 'water', x: riverX(b.z), y: 0.2, z: b.z, range: 14 });
{ const s = lotFront('smithy', 0.5); zones.push({ name: 'forge', kind: 'forge', x: s.x, y: 1, z: s.z, range: 16 }); }
{ const s = lotFront('shop', 2.3); zones.push({ name: 'chatter', kind: 'chatter', x: s.x, y: 1.5, z: s.z, range: 11 }); }
const ambience = new Ambience(zones);
// T3 NPC voices: townsfolk who are talking murmur from where they stand (only near enough to hear).
const voiceNodes = new Map<string, AudioNode | null>();
let voiceT = 0;
function folkVoices(dt: number) {
  if ((voiceT -= dt) > 0) return;
  voiceT = 0.7;
  if (!ambience.on) return;
  for (const f of townsfolk.folk) {
    if (!f.active || !f.talking) continue;
    const p = f.root.position;
    if (Math.hypot(p.x - audio.listener.x, p.z - audio.listener.z) > 14 || Math.random() < 0.35) continue;
    if (!voiceNodes.has(f.id)) voiceNodes.set(f.id, audio.spatial('voice:' + f.id, p.x, 1.5, p.z, 14, 'dialogue'));
    const out = voiceNodes.get(f.id);
    if (out) audio.murmur(out, f.role === 'customer' ? 1.1 : 0.95);
  }
}
interactables.push({ obj: projectionistHit, verb: () => 'Watch the Projectionist\'s reels', act: () => openCinema() });
interactables.push({ obj: reelScreen, verb: () => 'Watch the reels', act: () => openCinema() });
function syncCrossbowView() {
  if (crossbow.equipped && viewBeforeCrossbow === null) { viewBeforeCrossbow = player.thirdPerson; player.thirdPerson = false; syncLock(); }
  else if (!crossbow.equipped && viewBeforeCrossbow !== null) { player.thirdPerson = viewBeforeCrossbow; viewBeforeCrossbow = null; if (player.thirdPerson) player.pitch = 0; syncLock(); }
  document.body.dataset.view = player.thirdPerson ? 'follow' : 'first';
  if (rig.inShot) { crossbow.viewmodel.visible = false; sword.viewmodel.visible = false; }   // a framed dialogue/reading shot shows the player, not the held crossbow
}
// v0.04 Skyrim-style quick swap: the D-pad's left / right cycle what each hand holds (left: nothing or the
// torch; right: hands or the crossbow), with a short HUD line saying what's in each hand.
let quickTimer = 0;
function showQuick() {
  const el = $('quick');
  el.innerHTML = `<span>◀ ${torch.lit ? 'Torch' : 'Empty'}</span><span>${crossbow.equipped ? 'Crossbow' : sword.equipped ? 'Sword' : 'Hands'} ▶</span>`;
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
  // v0.08: the right hand cycles hands → sword → crossbow → hands, skipping what you don't have.
  if (crossbow.equipped) crossbow.unequip();
  else if (sword.equipped) { sword.unequip(); if (inventory.count('crossbow') > 0) crossbow.equip(); }
  else if (sword.owned) equipSword();
  else if (inventory.count('crossbow') > 0) crossbow.equip();
  haptics.play('tap');
  showQuick();
}
// v0.05: three perspectives, first person <-> over the shoulder <-> overhead. One step out (+1) or in (-1).
const VIEWS: View[] = ['first', 'shoulder', 'overhead'];
const currentView = (): View => (!player.thirdPerson ? 'first' : rig.step === 1 ? 'shoulder' : 'overhead');
function stepView(n: number) {
  if (!n || crossbow.equipped) return;
  const i = THREE.MathUtils.clamp(VIEWS.indexOf(currentView()) + Math.sign(n), 0, VIEWS.length - 1);
  setView(VIEWS[i]);
}
/** F / R3 / the touch eye button: cycle first person -> shoulder -> overhead -> first person. */
function cycleView() { setView(VIEWS[(VIEWS.indexOf(currentView()) + 1) % VIEWS.length]); }
// The pause menu's Camera list sets the same thing (and is how phones pick it).
function setView(v: View, save = true) {
  if (v !== 'first') rig.setStep(v === 'shoulder' ? 1 : OVERHEAD);
  if (save && settings.view !== v) { settings.view = v; saveSettings(settings); }
  if (crossbow.equipped) { viewBeforeCrossbow = v !== 'first'; return; }   // applies when the crossbow is put away
  player.thirdPerson = v !== 'first';
  if (player.thirdPerson) player.pitch = 0;
  document.body.dataset.view = player.thirdPerson ? 'follow' : 'first';
  syncLock();
}
// v0.05 shoulder swap (Q / D-pad up): in the shoulder view it swaps the shoulder; in the other views it
// doubles as the weapon switch (hands <-> crossbow), like the shoulder / stance swap in other action games.
function shoulderSwap() {
  if (state !== 'play') return;
  if (player.thirdPerson && rig.step === 1 && !crossbow.equipped) { rig.swapShoulder(); haptics.play('tap'); return; }
  quickSwap('right');
}
// First person locks the pointer (from the key press that switched to it); the follow view frees it.
function syncLock() {
  if (state !== 'play') return;
  if (wantLock() && lockSupported && !document.pointerLockElement) void requestLock().then((ok) => { if (!ok && !document.pointerLockElement) { lockSupported = false; show('nolock', state === 'play' && wantLock()); } });
  else if (!wantLock() && document.pointerLockElement) { expectUnlock = true; document.exitPointerLock(); }
  show('nolock', !lockSupported && wantLock());
}
let toastTimer = 0;
// UX pass (Mike 2026-10-31): tutorial hints are spoken by Natalie when she's with you, in her own words, naming the
// key or button for how you're playing. Without her near (or with her quiet), the hint is the usual toast.
const KEY_NAMES: Record<'casebook' | 'bag' | 'torch', Record<InputMode, string>> = {
  casebook: { mouse: 'J', touch: 'the Journal button', pad: 'Menu, then Gameplay' },
  bag: { mouse: 'I', touch: 'the Bag button', pad: 'View' },
  torch: { mouse: 'T', touch: 'the flame button', pad: 'hold the D-pad down' },
};
const keyName = (k: keyof typeof KEY_NAMES) => KEY_NAMES[k][inputMode];
let lastHint = '';
function hint(natalie: string, plain: string, ms = 3600) {
  const near = companion.prefs.follow && !companion.prefs.quiet && !inDungeon && companion.pos.distanceTo(player.pos) < 14;
  if (near && companion.say(natalie, { force: true })) { lastHint = 'natalie'; return; }
  lastHint = 'toast';
  toast(plain, ms);
}
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
    toast(`Received ${ITEMS[id]?.name ?? id} × ${Number(n) || 1}`);
    setTimeout(() => hint(`It's in your bag now. ${keyName('bag')} opens it.`, '(I: inventory)', 2600), 1800);
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
  if (lookingAt !== null) coach.used();
  if (lookingAt === 'natalie') talkToNatalie();
  else if (lookingAt === 'thing') lookingAtThing?.act();
  else if (lookingAt === 'library' && libraryHit) useLibrary(libraryHit);
  else if (lookingAt === 'bolt') {
    const b = crossbow.boltAt(player.eyePos, lookDir, controls.activateRange);
    if (b) { crossbow.pickUp(b); haptics.play('pickup'); toast('Bolt recovered', 1200); }
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
async function openBook(b: THREE.Vector3) {
  setState('book');
  // v0.04: face the book in hand to read (v0.06 W1: the lectern is gone; the red book is read in the town library)
  player.bodyYaw = Math.atan2(-(b.x - player.pos.x), -(b.z - player.pos.z));
  rig.setShot(rig.readingShot(b));
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

// ---------- v0.05: save and return to the menu, the exit gate, Extras, rebinding ----------
function snapshot(keepSpot: boolean) {
  return saveGame({
    pos: keepSpot && !inDungeon ? [player.pos.x, player.pos.y, player.pos.z] : null, yaw: player.yaw,
    time: world.time, items: [...inventory.counts].filter(([, n]) => n > 0),
  });
}
function toMenu(note: string) {
  closeForges();
  if (inDungeon) exitDungeon();
  if (document.pointerLockElement) { expectUnlock = true; document.exitPointerLock(); }
  rig.setShot(null);
  inWorld = false;
  setState('title');
  audio.water(true);
  const n = $('saveNote'); n.textContent = note; n.classList.remove('hidden');
  refreshTitle();
  focusMenu(0);
}
// UX pass (Mike 2026-10-31): auto-save at every door and campfire (and after a sleep), so quitting never loses
// much. A quill mark in the corner says so.
let autosaves = 0, autosaveTimer = 0;
function autoSave() {
  if (!inWorld || inDungeon || !snapshot(true)) return;
  autosaves++;
  const el = $('autosaved'); el.classList.add('on');
  clearTimeout(autosaveTimer); autosaveTimer = window.setTimeout(() => el.classList.remove('on'), 1600);
  refreshTitle();
}
// UX pass: a save shows "Continue" on the main menu, with "New game" under it (tap twice to start over).
function refreshTitle() {
  const has = !!loadGame();
  $('begin').textContent = has ? 'Continue' : 'Begin';
  $('newGame').classList.toggle('hidden', !has);
  $('newGame').textContent = 'New game';
  const p = slotInfo(activeSlot());
  $('openProfiles').textContent = `Profile: ${slotLabel(p)}`;   // B24: which of the three is loaded
}
let newGameArmed = 0;
$('newGame').addEventListener('click', () => {
  if (Date.now() - newGameArmed > 4000) { newGameArmed = Date.now(); $('newGame').textContent = 'Tap again to start over'; return; }
  newGameArmed = 0;
  clearGame();
  for (const [id] of [...inventory.counts]) inventory.counts.set(id, 0);
  inventory.render(); purse.set(0);
  begun = false;
  refreshTitle();
  void begin();
});
refreshTitle();
// UX pass: the first-minute coach. Test browsers skip it unless localStorage gametool.coachtest = 'on'.
const coach = new Coach($('coach'));
try { if (navigator.webdriver && localStorage.getItem('gametool.coachtest') !== 'on') coach.enabled = false; } catch { if (navigator.webdriver) coach.enabled = false; }
function quitToMenu() { const ok = snapshot(true); toMenu(ok ? 'Saved. Continue carries on where you left off.' : "Couldn't save on this device (storage is blocked)."); }
$('quitToMenu').addEventListener('click', () => quitToMenu());
// UX pass: the pause menu is your journal; its last pages are the casebook, the map and the bag.
$('pgCasebook').addEventListener('click', () => openCasebook());
$('pgPhrases').addEventListener('click', () => openPhrasebook());   // B16
$('pgSkills').addEventListener('click', () => openSkillsBook());   // B19
$('pgRecipes').addEventListener('click', () => openRecipeBook());   // B18
$('pgSelf').addEventListener('click', () => openCharCreate('pause'));   // B25: optional, reached only from the Journal
$('pgMap').addEventListener('click', () => openMap());
$('pgBag').addEventListener('click', () => { setState('play'); openInventory(); });
// The exit gate: walking through asks whether to retire (save the bag and hour, then back to the menu).
let gateOpen = false;
function gateCheck() {
  if (state !== 'play' || inDungeon || gateOpen) return;
  if (player.pos.x < GATE.x - 0.1 && Math.abs(player.pos.z - GATE.z) < GATE.half) {
    gateOpen = true;
    enterForge();
    $('gateConfirm').classList.remove('hidden');
    focusMenu(0);
  }
}
function gateNo() {
  if (!gateOpen) return;
  gateOpen = false;
  $('gateConfirm').classList.add('hidden');
  player.spawn(new THREE.Vector3(GATE.x + 1.6, 0, GATE.z), -Math.PI / 2);   // a step back inside, facing the camp
  leaveForge();
}
function gateYes() {
  if (!gateOpen) return;
  gateOpen = false;
  $('gateConfirm').classList.add('hidden');
  snapshot(false);
  toMenu('You retired at the gate. Your bag is saved; Begin starts you back at the glade.');
}
$('gateYes').addEventListener('click', () => gateYes());
$('gateNo').addEventListener('click', () => gateNo());

const extras = new Extras(() => { setState('title'); focusMenu(1); });
extras.onWrite = () => { extras.el.classList.add('hidden'); openEditor(); };   // v0.06: Write lore moved from the main menu to Extras
// v0.06 M6: What's new, once per session on Begin. Automated test browsers skip it unless a test asks.
const whatsNew = new WhatsNew(promptOfTheDay());
extras.onWhatsNew = () => { extras.el.classList.add('hidden'); whatsNew.open(() => { extras.open(); focusMenu(0); }); };
extras.onWiki = () => { extras.el.classList.add('hidden'); wiki.open(() => { extras.open(); focusMenu(0); }, 'menu'); focusMenu(0); };   // B21
$('openExtras').addEventListener('click', () => { show('title', false); extras.open(); focusMenu(0); });
$('openProfiles').addEventListener('click', () => { show('title', false); extras.open('profiles'); focusMenu(0); });   // B24

// Pause → Controls: rebind the keyboard. Click a key, then press the new one (Esc cancels).
let rebinding: Action | null = null;
function renderKeyBinds() {
  $('keyBinds').innerHTML = `<p class="fine">Keyboard: click an action, then press its new key. Esc cancels.</p><div class="binds">${REBINDABLE.map(([a, label]) =>
    `<button class="bind${rebinding === a ? ' on' : ''}" data-bind="${a}"><span>${label}</span><kbd>${rebinding === a ? '…' : keyLabel(binds[a][0])}</kbd></button>`).join('')}</div><button class="secondary" data-bind="reset">Reset keys</button>`;
}
$('keyBinds').addEventListener('click', (e) => {
  const b = (e.target as HTMLElement).closest('button') as HTMLButtonElement | null;
  if (!b) return;
  if (b.dataset.bind === 'reset') { resetKeys(); rebinding = null; }
  else rebinding = b.dataset.bind as Action;
  renderKeyBinds();
});
window.addEventListener('keydown', (e) => {
  if (!rebinding) return;
  e.preventDefault(); e.stopImmediatePropagation();
  if (e.code !== 'Escape') bindKey(rebinding, e.code);
  rebinding = null;
  renderKeyBinds();
}, true);
renderKeyBinds();

// Menus without a mouse: arrow keys / D-pad move between buttons, Enter / A presses, Esc / B goes back.
function menuButtons(where: 'side' | 'panel' = 'side'): HTMLElement[] {
  if (whatsNew.isOpen) return [...whatsNew.el.querySelectorAll<HTMLElement>('summary, button.primary')];
  if (wiki.isOpen) return [...wiki.el.querySelectorAll<HTMLElement>('button')];
  if (state === 'pause' && !gateOpen) {
    const root = where === 'panel' && pauseGroup ? $('pause').querySelector(`[data-panel="${pauseGroup}"]`) : $('pause').querySelector('.pause-side');
    return root ? [...root.querySelectorAll<HTMLElement>('button, input, select')].filter((b) => b.offsetParent !== null && !(b as HTMLButtonElement).disabled) : [];
  }
  const root = gateOpen ? $('gateConfirm') : extras.isOpen ? extras.el : state === 'title' ? $('title') : null;
  return root ? [...root.querySelectorAll<HTMLButtonElement>('button')].filter((b) => b.offsetParent !== null && !b.disabled) : [];
}
function focusMenu(i: number, where: 'side' | 'panel' = 'side') { const bs = menuButtons(where); bs[Math.max(0, Math.min(bs.length - 1, i))]?.focus({ preventScroll: true }); }
function menuInput(dir: 'up' | 'down' | 'left' | 'right' | 'ok' | 'back'): boolean {
  if (intro?.active) { intro.input(); return true; }
  if (telling.isOpen) { if (dir === 'ok') telling.press(); else if (dir === 'back') telling.close(); return true; }
  if (campfire.isOpen) { campfire.input(dir); return true; }   // v0.06 C1
  if (quick.isOpen) { quick.input(dir); return true; }
  if (extras.isOpen && extras.tab === 'evolution' && (dir === 'left' || dir === 'right')) { extras.go(extras.index + (dir === 'right' ? 1 : -1)); return true; }
  if (extras.isOpen && dir === 'back') { extras.back(); if (extras.isOpen) focusMenu(0); return true; }
  if (gateOpen && dir === 'back') { gateNo(); return true; }
  if (whatsNew.isOpen && dir === 'back') { whatsNew.close(); return true; }
  if (wiki.isOpen && state !== 'forge' && dir === 'back') { wiki.back(); if (wiki.isOpen) focusMenu(0); return true; }
  if (state === 'pause' && !gateOpen) return pauseInput(dir);
  const bs = menuButtons();
  if (!bs.length) return false;
  const at = bs.indexOf(document.activeElement as HTMLButtonElement);
  if (dir === 'up' || dir === 'down' || dir === 'left' || dir === 'right') { focusMenu(at < 0 ? 0 : (at + (dir === 'down' || dir === 'right' ? 1 : -1) + bs.length) % bs.length); return true; }
  if (dir === 'ok') { (at < 0 ? bs[0] : bs[at]).click(); return true; }
  return false;
}
// v0.06 P1: the pause menu without a mouse. In the sidebar: up / down move, A / right opens a group, B resumes.
// In a group: up / down move between settings, left / right change one, A presses or flips it, B goes back.
function pauseInput(dir: 'up' | 'down' | 'left' | 'right' | 'ok' | 'back'): boolean {
  if (dir === 'back') { pauseBack(); return true; }
  const active = document.activeElement as HTMLElement | null;
  const inPanel = !!pauseGroup && !!active?.closest('.pause-panel');
  const bs = menuButtons(inPanel ? 'panel' : 'side');
  const at = bs.indexOf(active as HTMLElement);
  if (dir === 'up' || dir === 'down') { focusMenu(at < 0 ? 0 : (at + (dir === 'down' ? 1 : -1) + bs.length) % bs.length, inPanel ? 'panel' : 'side'); return true; }
  const el = bs[at < 0 ? 0 : at];
  if (!el) return true;
  if (inPanel) {
    if (dir === 'left' && !(el instanceof HTMLInputElement || el instanceof HTMLSelectElement)) { pauseBack(); return true; }
    if (dir === 'left' || dir === 'right') { nudge(el, dir === 'right' ? 1 : -1); return true; }
    if (el instanceof HTMLButtonElement) el.click(); else nudge(el, 1);
    return true;
  }
  if (dir === 'left') return true;
  if (dir === 'right' && !el.dataset.group) return true;
  if (el.dataset.group && pauseGroup === el.dataset.group) { focusMenu(0, 'panel'); return true; }
  el.click();
  if (el.dataset.group && pauseGroup) focusMenu(0, 'panel');
  return true;
}
window.addEventListener('keydown', (e) => {
  if (e.repeat || state !== 'pause' || gateOpen || rebinding || (e.target as HTMLElement)?.closest?.('textarea, input[type=text]')) return;
  const dir = ({ ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right', Enter: 'ok', Escape: 'back' } as Record<string, 'up' | 'down' | 'left' | 'right' | 'ok' | 'back'>)[e.code];
  if (!dir || (dir === 'ok' && (e.target as HTMLElement)?.tagName === 'BUTTON')) return;   // Enter on a button clicks it natively
  if (dir === 'back' && pauseFrom === 'play' && lockSupported && wantLock() && !pauseGroup) return;   // locked first person: the browser's own Esc
  e.preventDefault(); e.stopImmediatePropagation();
  pauseInput(dir);
}, true);
// v0.06 C1: the campfire list from the keyboard (arrows; Esc closes the open item first, then leaves).
window.addEventListener('keydown', (e) => {
  if (e.repeat || !campfire.isOpen || telling.isOpen || (e.target as HTMLElement)?.closest?.('input, textarea')) return;
  const dir = ({ ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right', Escape: 'back' } as Record<string, 'up' | 'down' | 'left' | 'right' | 'back'>)[e.code];
  if (!dir) return;
  e.preventDefault(); e.stopImmediatePropagation();
  campfire.input(dir);
}, true);
window.addEventListener('keydown', (e) => {
  if (e.repeat || !(state === 'title' || extras.isOpen || gateOpen || whatsNew.isOpen || (wiki.isOpen && state !== 'forge')) || (e.target as HTMLElement)?.closest?.('input, textarea')) return;
  if (extras.isOpen && extras.handleKey(e.code)) { e.preventDefault(); if (extras.isOpen) focusMenu(0); return; }
  const dir = ({ ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right', Escape: 'back' } as const)[e.code as 'ArrowUp'];
  if (dir && menuInput(dir)) e.preventDefault();
});

// v0.05 §1.1: say which version this is when the menu first shows (and whether it's new since the last visit).
function versionNote() {
  let last: string | null = null;
  try { last = localStorage.getItem('gametool.version'); localStorage.setItem('gametool.version', VERSION); } catch { /* blocked */ }
  const el = $('versionNote');
  el.textContent = last && last !== VERSION ? `Tales of Artheria v${VERSION} | Updated from v${last}` : `Tales of Artheria v${VERSION} | System up to date`;
  el.classList.add('on');
  setTimeout(() => el.classList.remove('on'), 4500);
}

// ---------- touch + gamepad ----------
const hooks: GameHooks = {
  state: () => state,
  player,
  get book() { return reader.isOpen ? reader : book; },
  begin: () => void begin(),
  pause,
  resume: () => { if (state === 'pause') closePauseMenu(); else void resumePlay(); },
  activate,
  lookingAtBook: () => lookingAt !== null,
  useVerb: () => (lookingAt !== null ? promptVerb.textContent : null),
  openMap: () => openMap(),
  openJournal: () => openCasebook(),
  advanceDialogue: () => dialogue.press(),
  closeInventory,
  openInventory,
  crossbow,
  fire,
  hasCrossbow: () => inventory.count('crossbow') > 0,
  sword,
  hasSword: () => sword.owned,
  weaponSwap: () => quickSwap('right'),
  toggleRun: () => toggleRun(),
  toggleView: () => cycleView(),
  shoulderSwap: () => shoulderSwap(),
  dialogueMove: (d: number) => dialogue.move(d),
  stepCamera: (n) => stepView(n),
  toggleTorch: () => toggleTorch(),
  quickSwap: (h) => quickSwap(h),
  menuActive: () => !!intro?.active || extras.isOpen || gateOpen || telling.isOpen || quick.isOpen || whatsNew.isOpen || (wiki.isOpen && state !== 'forge') || campfire.isOpen,
  menu: (d) => menuInput(d),
  bandPad: (i) => { if (campfire.isOpen && campfire.section === 'play' && !telling.isOpen) campfire.pad(i); },
  forgeStick: (x, y) => { if (weaponForge.isOpen) turnWeapon(x * 0.06, y * 0.04); },
  setMode,
};
const touch: TouchControls | null = new TouchControls(hooks);
const gamepad = new GamepadControls(hooks, () => settings.sensitivity);
gamepad.onFamily = () => syncGlyphs();
document.body.dataset.input = inputMode;
// Mike 2026-10-30: from the very first screen, a phone held upright is asked to turn sideways. The card goes away
// by itself in landscape; "Play upright anyway" keeps it away for this session. Where the browser can lock the
// orientation (Android, in fullscreen), "Turn it for me" does it.
{
  type Lockable = ScreenOrientation & { lock?: (o: string) => Promise<void> };
  const canLock = !!document.documentElement.requestFullscreen && typeof (screen.orientation as Lockable | undefined)?.lock === 'function';
  if (canLock) $('rotateTurn').classList.remove('hidden');
  else $('rotateIos').classList.remove('hidden');   // iPhone: no lock, so point at Control Centre's rotation lock
  // Automated test browsers skip it (their phone viewports are upright) unless a test asks: localStorage gametool.rotateask = 'on'.
  try { if (sessionStorage.getItem('gametool.upright') === 'ok' || (navigator.webdriver && localStorage.getItem('gametool.rotateask') !== 'on')) document.body.dataset.upright = 'ok'; }
  catch { if (navigator.webdriver) document.body.dataset.upright = 'ok'; }
  $('rotateOk').addEventListener('click', (e) => {
    e.stopPropagation();
    document.body.dataset.upright = 'ok';
    try { sessionStorage.setItem('gametool.upright', 'ok'); } catch { /* private mode */ }
  });
  $('rotateTurn').addEventListener('click', (e) => {
    e.stopPropagation();
    document.documentElement.requestFullscreen({ navigationUI: 'hide' })
      .then(() => (screen.orientation as Lockable).lock?.('landscape'))
      .catch(() => undefined);
  });
}

// iPhone (Mike 2026-10-31): Safari won't let a page hide its address bar, but a Home Screen icon opens the game
// fullscreen (manifest display: fullscreen). iPhone/iPad Safari outside that gets a one-line tip on the title screen
// until it's closed. Test browsers skip it unless localStorage gametool.hometip = 'on'.
{
  const ios = /iPhone|iPad|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  const installed = (navigator as Navigator & { standalone?: boolean }).standalone === true || matchMedia('(display-mode: standalone), (display-mode: fullscreen)').matches;
  let show = ios && !installed;
  try { if (localStorage.getItem('gametool.hometip') === 'off' || (navigator.webdriver && localStorage.getItem('gametool.hometip') !== 'on')) show = false; }
  catch { if (navigator.webdriver) show = false; }
  if (show) $('homeTip').classList.remove('hidden');
  $('homeTipClose').addEventListener('click', (e) => {
    e.stopPropagation();
    $('homeTip').classList.add('hidden');
    try { localStorage.setItem('gametool.hometip', 'off'); } catch { /* private mode */ }
  });
}

// ---------- keyboard (F2.1) ----------
const MOVE: Action[] = ['forward', 'left', 'back', 'right', 'walk', 'sprint'];
const ALL: Action[] = ['forward', 'left', 'back', 'right', 'walk', 'toggleRun', 'sprint', 'jump', 'sneak', 'activate', 'pov', 'shoulder', 'close', 'pause'];
let capsToggledAt = -1e9;

function toggleRun() {
  settings.alwaysRun = !settings.alwaysRun;
  saveSettings(settings);
  ($('always') as HTMLInputElement).checked = settings.alwaysRun;
  toast(settings.alwaysRun ? 'Always run: on' : 'Always run: off', 1400);   // v0.06 W5: no walk/run label on the HUD any more
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
  if (actionFor(e.code, ['torch']) && !e.repeat) { toggleTorch(); return; }   // v0.04
  // v0.04: no L hotkey; in the world, lore is written at the campfire with Natalie (the title screen keeps its button).
  if (actionFor(e.code, ['inventory']) && !e.repeat) { openInventory(); return; }
  if (actionFor(e.code, ['journal']) && !e.repeat) { openCasebook(); return; }
  if (actionFor(e.code, ['map']) && !e.repeat) { openMap(); return; }
  if (!e.repeat) {
    const w = actionFor(e.code, ['equipCrossbow', 'equipHands', 'equipSword', 'reload']);
    if (w === 'equipCrossbow') { equip(true); return; }
    if (w === 'equipSword') { if (state === 'play') { equipSword(); showQuick(); } return; }
    if (w === 'equipHands') { equip(false); return; }
    if (w === 'reload') { crossbow.pressReload(); return; }
  }
  const a = actionFor(e.code, ALL);
  if (!a) return;
  if (MOVE.includes(a)) { player.held.add(a); return; }
  if (e.repeat) return;
  if (a === 'jump') player.jump();
  else if (a === 'sneak') player.toggleSneak();
  else if (a === 'pov') cycleView();
  else if (a === 'shoulder') shoulderSwap();
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
    if ((crossbow.equipped || sword.equipped) && (e.target === canvas || document.pointerLockElement)) fire();   // F4.1 LMB fires; v0.08 LMB swings
  }
  if (e.button === 2) { rightHeld = true; crossbow.setADS(true); }   // F4.1 RMB aims; in the follow view RMB-drag turns the camera
});
window.addEventListener('mouseup', (e) => {
  if (e.button === 0) {
    mouseHeld = false;
    // S1: a click (not a drag) on something within reach uses it.
    if (state === 'play' && e.target === canvas && player.thirdPerson && !crossbow.equipped && !sword.equipped && !cursor.dragged && hovering) activate();
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
const sens = $<HTMLInputElement>('sens'), fov = $<HTMLInputElement>('fov');
const inv = $<HTMLInputElement>('invert'), always = $<HTMLInputElement>('always');
const presetSel = $<HTMLSelectElement>('preset'), renderScaleEl = $<HTMLInputElement>('renderScale');
const shadowsEl = $<HTMLInputElement>('shadows'), postFxEl = $<HTMLInputElement>('postFx');
const fogDistanceEl = $<HTMLInputElement>('fogDistance'), fpsCapSel = $<HTMLSelectElement>('fpsCap'), autoQualityEl = $<HTMLInputElement>('autoQuality');
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
  $<HTMLInputElement>('lefty').checked = settings.lefty;
  $<HTMLInputElement>('buttonSize').value = String(settings.buttonSize); $('buttonSizeOut').textContent = settings.buttonSize + '%';
  $<HTMLInputElement>('textSize').value = String(settings.textSize); $('textSizeOut').textContent = settings.textSize + '%';
  $<HTMLInputElement>('readSpeed').value = String(settings.readSpeed); $('readSpeedOut').textContent = settings.readSpeed + '×';
  $<HTMLSelectElement>('viewSel').value = settings.view;
  $<HTMLSelectElement>('charsSel').value = settings.chars;
  presetSel.value = settings.preset;
  renderScaleEl.value = String(settings.renderScale); $('renderScaleOut').textContent = settings.renderScale + '%';
  shadowsEl.checked = settings.shadows; postFxEl.checked = settings.postFx;
  fogDistanceEl.value = String(settings.fogDistance); $('fogOut').textContent = settings.fogDistance + ' m';
  fpsCapSel.value = String(settings.fpsCap); autoQualityEl.checked = settings.autoQuality;
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
viewSel.addEventListener('change', () => setView(VIEWS.includes(viewSel.value as View) ? viewSel.value as View : 'overhead'));
$<HTMLInputElement>('haptics').addEventListener('change', (e) => {
  settings.haptics = (e.target as HTMLInputElement).checked; saveSettings(settings);
  haptics.setEnabled(settings.haptics);
  haptics.play('tap');
});
haptics.setEnabled(settings.haptics);
haptics.setMode(inputMode);
// UX pass (Mike 2026-10-31): comfort settings take effect at once.
function applyComfort() {
  const root = document.documentElement.style;
  root.setProperty('--tb', String(settings.buttonSize / 100));
  root.setProperty('--text-k', String(settings.textSize / 100));
  reading.speed = settings.readSpeed;
  if (touch) touch.lefty = settings.lefty;
  if (settings.lefty) document.body.dataset.lefty = '1'; else delete document.body.dataset.lefty;
}
applyComfort();
for (const id of ['lefty', 'buttonSize', 'textSize', 'readSpeed'] as const) {
  $<HTMLInputElement>(id).addEventListener(id === 'lefty' ? 'change' : 'input', (e) => {
    const el = e.target as HTMLInputElement;
    if (id === 'lefty') settings.lefty = el.checked; else settings[id] = Number(el.value);
    saveSettings(settings); applyComfort(); syncMenu();
  });
}
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
  applyQuality(); post?.setEnabled(settings.postFx); world.setFogDistance(settings.fogDistance); nightLights.setMax(p === 'low' ? 2 : 4);
});
renderScaleEl.addEventListener('input', () => { settings.renderScale = Number(renderScaleEl.value); saveSettings(settings); syncMenu(); applyRenderScale(); });
shadowsEl.addEventListener('change', () => { settings.shadows = shadowsEl.checked; saveSettings(settings); applyQuality(); });
postFxEl.addEventListener('change', () => { settings.postFx = postFxEl.checked; saveSettings(settings); post?.setEnabled(settings.postFx); });
fogDistanceEl.addEventListener('input', () => { settings.fogDistance = Number(fogDistanceEl.value); saveSettings(settings); syncMenu(); world.setFogDistance(settings.fogDistance); });
fpsCapSel.addEventListener('change', () => { settings.fpsCap = Number(fpsCapSel.value) as FpsCap; saveSettings(settings); });
autoQualityEl.addEventListener('change', () => { settings.autoQuality = autoQualityEl.checked; saveSettings(settings); autoQ.setEnabled(settings.autoQuality); });

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
  const targets = [world.natalieTarget, ...library.targets, ...things.map((t) => t.obj)];
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
    const near = nearestAhead([world.natalieTarget, ...things.map((t) => t.obj)]);
    if (near) hit = { object: near, distance: 0, point: near.position } as unknown as THREE.Intersection;
  }
  canvas.style.cursor = hovering ? 'pointer' : '';
  libraryHit = (hit?.object.userData.hit as LibraryHit | undefined) ?? null;
  lookingAtThing = (hit && things.find((t) => t.obj === hit!.object)) ?? null;
  lookingAt = !hit ? null : hit.object === world.natalieTarget ? 'natalie' : lookingAtThing ? 'thing' : 'library';
  if (!lookingAt && crossbow.boltAt(player.eyePos, lookDir, controls.activateRange)) lookingAt = 'bolt';   // F4.4
}
const clock = new THREE.Clock();
function libraryVerb(h: LibraryHit): string {
  if (h.kind === 'relic') return 'Look at the Noctavel shard';
  if (h.kind === 'grey') return 'Read a grey book';
  const e = entryById.get(h.slug);
  if (!e) return 'Read';
  const t = e.title.length > 34 ? e.title.slice(0, 33) + '…' : e.title;
  return e.type === 'song' ? `Play "${t}"` : e.type === 'character' ? `Meet ${t}` : e.type === 'art' ? `Look at "${t}"` : `Read "${t}"`;
}
const promptVerb = $('promptVerb');
const perf = { frames: 0, cpuMs: 0, worstMs: 0, simSeconds: 0 };
const SIM_STEP = 1 / 120;
let simAcc = 0;
let stepTimer = 0;
let lastFrameAt = 0;
const MOVE_ACTIONS: Action[] = ['forward', 'left', 'back', 'right'];
const earDir = new THREE.Vector3();

function frame() {
  requestAnimationFrame(frame);
  // F1.1 FPS cap: 30/60/∞. Skipping the whole body (not just the render call) also skips
  // clock.getDelta() here, so the sim still advances correctly in bigger steps next time.
  const now = performance.now();
  const minFrameMs = settings.fpsCap > 0 ? 1000 / settings.fpsCap : 0;
  if (minFrameMs > 0 && now - lastFrameAt < minFrameMs) return;
  if (state === 'play') autoQ.frame(now - lastFrameAt, settings.fpsCap || 60);
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
        if (stepTimer <= 0) { audio.footstep(); if (purse.crowns > 0 && ++purseSteps % 3 === 0) audio.coins(1); stepTimer = 2.2 / Math.max(1, player.speed()); if (player.thirdPerson && player.speed() > controls.speeds.walk) dust.burst(footAt()); }
      } else stepTimer = 0;
    }
    rig.update(dt);   // R3: camera follows this frame's simulation before anything aims along it
    updateTarget();
    show('prompt', lookingAt !== null);
    const verb = lookingAt === 'natalie' ? 'Talk to Natalie' : lookingAt === 'bolt' ? 'Pick up bolt' : lookingAt === 'thing' ? lookingAtThing!.verb()
      : lookingAt === 'library' && libraryHit ? libraryVerb(libraryHit) : 'Read';
    if (promptVerb.textContent !== verb) promptVerb.textContent = verb;
    crossbow.update(dt);
    sword.update(dt);
    touch?.update();
    coach.update(inputMode, player.pos, player.yaw, lookingAt !== null, !inDungeon);
    if (bestiary) goblins.idle(dt);
  } else { lookingAt = null; crossbow.setADS(false); rig.update(dt); $('coach').classList.add('hidden'); }
  // v0.06 T3: the ears are at the player's eyes, facing where the camera looks.
  camera.getWorldDirection(earDir);
  audio.setListener(player.eyePos.x, player.eyePos.y, player.eyePos.z, earDir.x, earDir.z);
  nightLights.update(dt, player.pos.x, player.pos.z, clock.elapsedTime, camera);
  ambience.on = state !== 'title' && !inDungeon;
  if (ambience.on) ambience.update(dt); else ambience.stopAll();
  gear.update(dt); cook.update(dt); player.buffMul = cook.buff === 'quick' ? 1.1 : 1; if (gear.isOpen && gear.job === 'sharpen') grind.wheel.rotation.z += dt * 7;   // B17
  animate(dt);
  updateAmmoHud();
  updateDelve(dt);
  updateSprites(renderer, world.scene, camera, dt);
  post!.render(world.scene, camera);
  const ms = performance.now() - t0;
  perf.frames++; perf.cpuMs += ms; perf.worstMs = Math.max(perf.worstMs, ms);
}
// v0.05 boot: splash → title → main menu. Automated test browsers go straight to the menu unless a test asks
// for the intro (localStorage gametool.intro = 'on').
let intro: Intro | null = null;   // starts once loading is done (below), so its 2 s splash isn't eaten by the build
setState('title');
const wantIntro = (() => { try { return !navigator.webdriver || localStorage.getItem('gametool.intro') === 'on'; } catch { return !navigator.webdriver; } })();
if (!wantIntro) { intro = new Intro(() => undefined, true); versionNote(); }
// F2.1: everything is built; compile every shader before the first frame (hidden things too: player body, held
// crossbow, dust, so they don't stutter the first time they show), then fade in from black over 2 s (no pop-in).
// compileAsync lets the browser compile in the background (KHR_parallel_shader_compile) while the loader bar shows.
void (async () => {
  const hidden = [player.body, crossbow.viewmodel].filter((o) => !o.visible);
  hidden.forEach((o) => { o.visible = true; });
  dust.mesh.count = 1;
  try { await renderer.compileAsync(world.scene, camera); } catch { renderer.compile(world.scene, camera); }
  hidden.forEach((o) => { o.visible = false; });
  dust.mesh.count = 0;
  frame();
  progress(100);
  requestAnimationFrame(() => requestAnimationFrame(() => {
    if (wantIntro) intro = new Intro(() => { versionNote(); focusMenu(0); });
    const loader = document.getElementById('loader');
    if (!loader) return;
    loader.classList.add('done');
    setTimeout(() => loader.remove(), 2100);
  }));
})();

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
Object.assign(window, { __gametool: { dm, get state() { return state; }, get lookingAt() { return lookingAt; }, get lookingAtVerb() { return lookingAtThing?.verb() ?? null; }, get inputMode() { return inputMode; }, get character() { return character; }, dailyPrompt, dialogue, inventory, crossbow, reader, library, modelsReady, loadedModels, failedModels, animators, puppets, characterForge, weaponForge, openCharacterForge, openWeaponForge, interactables, sword, gear, openGear, cook, recipeBook, openRecipeBook, get sturdy() { return sturdy; }, sketchPad, openSketchbook, lecternDesk, readerDesk, quest, questProps, companion, casebook, folklore, pedlarHit, campfire, openCampfire, telling, get satAtFire() { return satAtFire; }, readRedBook: () => townAct.library(), get stationPose() { return stationPose; }, get stationView() { return stationView; }, weaponDisplay, gallery, refreshGallery, openReader, dungeon, enterDungeon, exitDungeon, quick, openQuick, buildQuick, openDescend, get inDungeon() { return inDungeon; }, delves, livingMap, openMap, dojo, openDojo, caravan, caravanFolk, openCaravan, phrasebook, openPhrasebook, skills, openSkills, skillsBook, openSkillsBook, wiki, openWiki, townsfolk, ambience, nightLights, ceilings, autoQ, forestPack, ROOFED, figureKit: { buildFigure, FigureAnim, faceExpression }, goblins, traits: { rollGoblin, describeGoblin, goblinStats, roll, seedOf }, get delveHp() { return delveHp; }, get lastHint() { return lastHint; }, hint, purse, wear, tollBell, coach, get autosaves() { return autosaves; }, townAct, set delveHp(n: number) { delveHp = n; }, spawnGoblins, get stationery() { return stationery; }, setStationery, shop, openShop, earn, cinema, openCinema, get intro() { return intro; }, extras, quitToMenu, get gateOpen() { return gateOpen; }, binds, menuInput, camera, Box3: THREE.Box3, Raycaster: THREE.Raycaster, Vector3: THREE.Vector3, player, rig, book, renderer, world, perf, settings, audio, haptics, torch, lockSupported: () => lockSupported } });
