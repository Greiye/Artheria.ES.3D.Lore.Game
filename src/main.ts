import './bootMigrate';   // must run before anything reads a saved profile
import * as THREE from 'three';
import './render/grade';   // style pass 1: global colour grade (patches a shader chunk, so it must load first)
import { updateSprites, faceExpression } from './render/sprites';
import './style.css';
import { buildWorld } from './world';
import { buildFigure, figureLight, updateFigureSun, GOTHIC_LOOK, RIG, type FigureLook } from './world/figure';
import { enableSeeThrough, updateSeeThrough, seeThroughUniforms } from './render/seeThrough';
import { outlineUniforms, setOutlines } from './render/outline';
import { Player } from './player';
import { Book } from './book';
import { lore, entryById } from './lore';
import { buildLibrary, type LibraryHit } from './library';
import { buildStairwell, STAIRS } from './world/stairs';
import { buildFloatingStones } from './world/floating';
import { buildRareMagic } from './world/magic';
import { buildRuin, buildWallBooks, buildGoblinSigns, buildGoblinLife, buildQuadPlants, buildFlood, Floor, type Keep } from './world/ruin';
import { setLinkResolver } from './markdown';
import greyBooks from '../content/rolltables/grey-books.json';
import { controls, actionFor, binds, type Action } from './controls';
import { loadSettings, saveSettings, flushSettings, isLowPreset } from './settings';
import { AutoQuality, STEPS } from './render/autoQuality';
import { audio } from './audio';
import { VERSION, AUTHOR } from './version';
import type { State, InputMode } from './input/hooks';
import { loadGitHub, saveGitHub, loadAuthor, saveAuthor, slugify, buildMarkdown, publishToGitHub, downloadMarkdown } from './editor';
import { loadCharacter, saveCharacter, type Character } from './character';
import { Purse } from './purse';
import { Wear } from './wear';
import { Coach } from './coach';
import { promptOfTheDay } from './prompts';
import { DialogueBox, type DialogueScript } from './dialogue';
import { Inventory } from './inventory';
import { Crossbow, ZONE } from './crossbow';
import { Sword } from './sword';
import './gear/gear.css';
import natalieScript from '../content/dialogue/natalie.json';
import natalieCampScript from '../content/dialogue/natalie-camp.json';   // Mike 2026-11-06: the camp welcome
import { Post } from './render/post';
import { SHELL_HTML } from './ui/shell';
import { watch as watchI18n, getLang, setLang, t, type Lang } from './i18n';
import { renderPadMap } from './input/padmap';
import { station, closeAllStations } from './stations';
import { CameraRig, type Shot } from './camera/rig';
import { fillSlots, loadedModels, failedModels, animators, type ModelSlot, type AnimState } from './models';
import { FigureAnim, BodyAnim, type AnimInput, type Pose, type Gesture } from './anim/procedural';
import { Dust } from './fx/dust';
import { activeSlot, slotInfo, slotLabel, askToKeepData } from './profiles';
import { CharacterForge, loadForge, type ForgeCharacter } from './forge/character';
import { attachItemCards } from './ui/itemcard';
import { WeaponForge, loadWeapon, type WeaponCosmetic, type SwordCosmetic } from './forge/weapon';
import { ForgePreview } from './forge/preview';
import { MarginDesk, loadStationery, saveStationery, applyStationery, loadMargins, type Stationery } from './writing/margins';
import { SketchPad, sketchById, DEFAULT_SKETCH, type Sketch } from './writing/sketch';
import { stampBanner, buildBookmarks } from './writing/stamps';
import { loadQuest } from './quest/quest';
import { QuestProps } from './quest/props';
import { Companion, loadCompanion, saveCompanion } from './quest/companion';
import { buildQuick } from './dungeon/quick';
import { GALLERY } from './campfire/gallery';
import { roofOver, ROOFED, libraryHoles } from './world/ceilings';
import './spanish/caravan.css';
import './skills/skills.css';
import './dojo/dojo.css';
import { Dungeon } from './dungeon/dungeon';
import { rollGoblin, describeGoblin, goblinStats } from './traits/goblin';
import { roll, seedOf } from './traits/roll';
import { rollTownsfolk } from './traits/townsfolk';
import { haptics } from './input/haptics';
import { setupSettingsMenu } from './ui/settingsMenu';
import { leanTarget, NO_LEAN } from './lean';
import { Crowd, CROWD_FULL, CROWD_LOW } from './world/crowd';
import { Torch } from './torch';
import { Hands, HAND_LABEL, isMelee, isThrow, type Hand } from './hands';
import { Thrower } from './sling';
import { Shield, BLOCK_ARC, BLOCK_LEAK } from './shield';
import { HeldBook } from './heldBook';
import { CROWN } from './shop';
import { STARTING_CROWNS } from './economy';
import { TOWN_NAMES, GATE, FOUNTAIN, TOWN_LOTS } from './world/town';

import { QuestGroups } from './quest/groups';   // B52/B53
import { Regions, MODERN_FRIENDS } from './world/regions';
import { loadRecord, isCamp, fluxFor, type Descent } from './delve/descent';
import { InnWalls, LastWords, buildInnBoards } from './delve/walls';
import { TRANSMOGRIFY } from './cinematic/firstmeet';
import { DmView, type Place } from './dm/dm';
import { watchPanels, setPanelTab } from './ui/fit-panel';
import { riverClear } from './world/river';
import { plantForestCards } from './world/treeCards';
import { Townsfolk, setPathObstacles } from './world/townsfolk';
import { NightLights } from './world/nightlights';
import { Intro } from './intro';
import { loadGame, saveGame, clearGame } from './save';
import { type TimeOfDay } from './world/sky';
import { glyph } from './input/glyphs';
import { storeSet } from './store';
import { SPEC_V, MORPHS, SLOTS, CATALOG, defaultSpec, validateSpec, randomCharacterSpec, specKey, specFromRoll } from './morph/spec';   // B57 morphology (PR 1: the spec)
import { partCache, PartCache } from './morph/parts';   // B57 PR 2: shared placeholder parts
import { assemble, updateLod, disposeCharacter, LOD_DIST, baseBody, outfitCount } from './morph/assemble';   // B57 PR 3: a character from a spec
import { packLook } from './net/look';
import './ui/parchment.css';   // UI 1: parchment panels, loaded last so it skins every panel
import './ui/ribbon.css';   // UI 2: green ribbon titles with gold lettering
import './ui/readable.css';
import { setupPortal } from './app/portal';
import { setupExits } from './app/exits';
import { setupSpeakers } from './app/speakers';
import { setupWagon } from './app/wagon';
import { setupMultiplayer } from './app/multiplayer';
import { setupTalk } from './app/talk';
import { setupTownStations } from './app/townStations';
import { setupWiki } from './app/wiki';
import { setupGearCare } from './app/gearCare';
import { setupSkillsTable } from './app/skillsTable';
import { loadDecks, cleanDecks, starterSlots, deckStrings, witness, DECK_KEY } from './fight/deck';
import { endStance, STAMINA, MOVES as FIGHT_MOVES } from './fight/engine';
import { setupMonkDeck, DECK_MAT } from './app/monkDeck';
import { setupMonk } from './app/monk';
import { setupMage } from './app/mage';
import { setupFighterTechniques } from './app/fighterTechniques';
import { setupCandor } from './app/candor';
import { setupSkyrunner } from './app/skyrunner';
import { setupFightMode } from './app/fightMode';
import { setupDojo } from './app/dojo';
import { setupLivingMap } from './app/livingMap';
import { setupViews } from './app/views';
import { setupBarks } from './app/barks';
import { setupStairsTimer } from './app/stairsTimer';
import { setupRolledGoblins } from './app/rolledGoblins';
import { setupKillRecord } from './app/killRecord';
import { setupDelveRewards } from './app/delveRewards';
import { setupDescentFlow } from './app/descentFlow';
import { setupCoinTable } from './app/coinTable';
import { setupCooking } from './app/cooking';
import { setupCampfire } from './app/campfire';
import { setupPets } from './app/pets';
import { setupKnightFrame } from './app/knightFrame';   // UI 3: larger text in the sheets, sized for phones

// Private, all rights reserved (D8). Not open source.


const settings = loadSettings();
let netGuests = 0;   // multiplayer 4: other players in the room (the low presets trade crowd sprites for them)
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
const renderer = new THREE.WebGLRenderer({ antialias: !coarse && !isLowPreset(settings.preset), powerPreference: 'high-performance' });
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.shadowMap.type = THREE.BasicShadowMap;   // Mike 2026-11-03: hard-edged, pixel-stepped shadows (no soft PCF blur)
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
  townsfolk.setCount(isLowPreset(settings.preset) || q.folk === 'low' ? 'low' : 'full');
  const low = isLowPreset(settings.preset) || q.folk === 'low';
  crowd.setCount(low ? Math.max(4, CROWD_LOW - 3 * netGuests) : CROWD_FULL);
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
world.openDoor(true); // Mike 2026-11-06: the Ruined Library is open from the start
progress(80);
renderer.shadowMap.enabled = settings.shadows;
world.setShadows(settings.shadows);
world.setFogDistance(settings.fogDistance);
const FOLIAGE = { lowpower: 0.2, low: 0.35, medium: 0.6, high: 1 } as const;   // R3 perf: undergrowth density per preset
const LIGHTS = { lowpower: 1, low: 2, medium: 4, high: 4 } as const;   // real lantern lights at night (B38: 1 on Low power)
world.setFoliage(FOLIAGE[settings.preset]);
// v0.06 W3: lantern halos, brighter windows and a few real lights at night.
const nightLights = new NightLights(world.scene, world.lanterns, world.town.windows, world.town.windowSpots, world.heightAt);
nightLights.setMax(LIGHTS[settings.preset]);
nightLights.setTime(world.time);
// UX pass (Mike 2026-10-31): no clock. The sky shows the hour, and the bell in the library spire tolls when it
// changes: three for morning, two for sunset, one for nightfall.
const BELL_TOLLS: Record<TimeOfDay, number> = { day: 3, sunset: 2, night: 1 };
const tollBell = (t: TimeOfDay) => { const L = TOWN_LOTS.find((l) => l.id === 'library')!; audio.bell(BELL_TOLLS[t], audio.spatial('bell', L.x, 12, L.z, 140)); };
const setWorldTime = (t: TimeOfDay, toll = false) => { world.setTime(t); nightLights.setTime(t); if (toll) tollBell(t); };
post = new Post(renderer, world.scene, camera);
post.setSize(window.innerWidth, window.innerHeight);
post.setEnabled(settings.postFx);
setOutlines(settings.inkLines);
const player = new Player(settings, world.colliders, world.bounds);
// Mike 2026-11-05: the four far maps (src/world/regions.ts) have their own ground.
const regions = new Regions(world.scene);
const groups = new QuestGroups();   // B52/B53 quest groups (casebook)
const groundY = (x: number, z: number) => (inDungeon ? 0 : regions.floor(x, z) ?? world.heightAt(x, z));
player.terrain = groundY;   // v0.04 hills (the dungeon floor is flat)
player.spawn(world.spawn.pos, world.spawn.yaw);
// R3: the camera rig places the camera (follow / first person / framed shots); the player only moves.
const rig = new CameraRig(camera, player, world.colliders, world.bounds, () => settings.fov);
player.zoomBy = (d) => stepView(rig.zoomBy(d));   // mouse drag / right stick: steps through the 5 distances (B28: touch drags never zoom)
rig.update(0);
world.scene.add(player.body);
const torch = new Torch(world.scene, camera, player);   // v0.04
const torch2 = new Torch(world.scene, camera, player, false);   // Mike 2026-11-05: a torch in each hand (one light)
const heldBook = new HeldBook(player);
const purse = new Purse(player);   // UX pass: crowns hang at the hip
const wear = new Wear(player);   // UX pass: clothes tear as you're hurt in the dungeon
let purseSteps = 0;   // every third footstep the purse clinks   // v0.04: the 'read' pose holds an open book (shelf reader)
// .glb models (public/models/<id>.glb) replace placeholders when present; never blocks loading.
const modelSlots: ModelSlot[] = [
  ...Object.entries(world.standees).map(([id, s]) => ({ id, placeholder: s, height: s.userData.height as number,
    // Mike 2026-11-03: the witch's baked face swaps for a drawn one (the hero's sheet until Mike draws hers).
    face: id === 'witch' ? { skin: 'Witch_Head_2', hide: ['Witch_Head_5'], look: { ...(s.userData.look as FigureLook), art: 'hero' } } : undefined })),
  { id: 'player', placeholder: player.body.children[0], parent: player.body, height: controls.eyeHeight + 0.1, faceYaw: Math.PI },
];
// Mike 2026-11-03: crossed-quad card trees (from the 99.Miles forest tree pack) dress the hills on every preset,
// clear of the river and the coach road out to the gate.
const forestCards = plantForestCards(world.scene, world.heightAt, (x, z) => riverClear(x, z, 1) || (x < -36 && Math.abs(z - GATE.z) < 5));
// B38: the far forest band (45–64 m) is all inside the fog on Low power, so it isn't drawn there.
const syncForest = () => { forestCards.mesh.visible = settings.fogDistance > 40; };
syncForest();
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
ui.innerHTML = SHELL_HTML;
document.body.appendChild(ui);
watchI18n(document.body);   // B23: translate the UI as it is drawn
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
let lookingAt: 'natalie' | 'bolt' | 'rock' | 'library' | 'thing' | null = null;
// Phase B+: things in the world E can use (forge stations, and later quests, campfire, map...).
export interface Interactable { obj: THREE.Object3D; verb: () => string; act: () => void; when?: () => boolean }
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

// Only a lock this handler saw taken can be "released by the browser". Drawing the crossbow and putting it away
// at once takes and drops the lock before either event is delivered, so two events arrive that both read
// "unlocked": the second used to open the pause menu (found by e2e-camera, 2026-11-09).
let sawLock = false;
document.addEventListener('pointerlockchange', () => {
  if (document.pointerLockElement === canvas) { sawLock = true; return; }
  const was = sawLock, expected = expectUnlock;
  sawLock = false; expectUnlock = false;
  if (!was || expected) return;
  if (state === 'play') { pauseFrom = 'play'; setState('pause'); }   // F2 Esc: browser released the pointer -> pause menu
});

// F1.1: title -> pointer lock -> spawned in first person.
async function begin() {
  // v0.05: pick up where the last save left off (the spot only if you saved, not if you retired at the gate).
  const save = loadGame();
  // Mike 2026-11-05: the save remembers which map you were on; you come back in at its waystone.
  const wantRegion = savedRegion();
  if (regions.current !== 'town') placeIn('town', regions.current);
  if (save?.pos && wantRegion === 'town') player.spawn(new THREE.Vector3(...save.pos), save.yaw); else player.spawn(world.spawn.pos, world.spawn.yaw);
  if (wantRegion !== 'town') placeIn(wantRegion, 'town');
  // Mike 2026-11-06: "Spawn at the campfire, not at the inn." A new game wakes on the camp bedroll, and Natalie
  // explains the camp and how the game is played and beaten (content/dialogue/natalie-camp.json). Old saves wake
  // where they last slept, as before.
  lastRest = save ? (save.rest ?? 'inn') : 'camp';
  if (!save && !campWelcomed()) welcomePending = true;
  if (!save && !begun && inventory.count(CROWN) < STARTING_CROWNS) inventory.give(CROWN, STARTING_CROWNS - inventory.count(CROWN));   // Mike 2026-11-09: a new game starts with 500
  if (save && !begun) {
    setWorldTime(save.time);
    for (const [id, n] of save.items) if (inventory.count(id) < n) inventory.give(id, n - inventory.count(id));
    hands.load();   // Mike 2026-11-05: what each hand held
  }
  begun = true;
  inWorld = true;
  audio.water(false);
  setView('overhead');                          // v0.06 M7: every Begin starts in the overhead camera
  setState('play');                             // in the world immediately, even before lock resolves
  if (wakeIntro()) wakeUp(lastRest);            // B31: fade in on the player getting up from the bed or bedroll
  if (!save && !character.profession && createIntro()) { createPending = true; if (!waking) setTimeout(openCreation, 300); }
  else if (save && !character.profession && createIntro()) {
    let told = false; try { told = !!localStorage.getItem('gametool.proftip'); } catch { /* blocked */ }
    if (!told) { storeSet('gametool.proftip', '1'); setTimeout(() => toast('New: pick a profession for your hero (Fighter, Ranger, Mage or Monk) at the camp mirror or the tailor.', 6500), 2600); }
  }
  if (firstDayOn()) firstDay.begin();            // B36: the rest of a first day begun before Mike 2026-11-06 (new games start with no quest)
  if (multiplayerM.inviteCode) { const c = multiplayerM.inviteCode; multiplayerM.inviteCode = null; setTimeout(() => { if (state === 'play' && !friends.room) openFriends(c); }, 600); }
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
// ---------- B31 (Mike 2026-11-03): the wake-up intro ----------
// Every Begin / Continue: the screen goes black, then fades in on the player getting up. A new game wakes in the
// inn's guest bed; Continue wakes where you last slept (the bedroll if that was at camp, otherwise the inn).
// Any key, click, touch or pad button skips it. Test browsers skip it unless localStorage gametool.waketest = 'on'
// (like the coach), so the suites still start at the glade spawn.
let lastRest: 'inn' | 'camp' = 'inn';
// The camp welcome: once per profile, after the get-up, on a new game. Test browsers skip it unless the wake-up test
// flag is on (like the get-up itself).
const CAMP_WELCOME = 'gametool.campwelcome';
let welcomePending = false;
function campWelcomed() { try { return !!localStorage.getItem(CAMP_WELCOME); } catch { return true; } }
function campWelcome() {
  welcomePending = false;
  storeSet(CAMP_WELCOME, '1');
  talkTo('natalie', world.stations.campfire.position, natalieCampScript as DialogueScript);
}
let waking = 0;   // seconds left of the get-up; 0 = not waking
const WAKE_TIME = 2.0;
function wakeIntro() {
  try { return !navigator.webdriver || localStorage.getItem('gametool.waketest') === 'on'; } catch { return !navigator.webdriver; }
}
function wakeUp(where: 'inn' | 'camp') {
  if (where === 'camp') {
    const b = world.stations.bedroll.position, a = 0.35;   // the bedroll's pillow end points along (sin a, cos a)
    player.spawn(new THREE.Vector3(b.x - Math.sin(a) * 1.05, 0, b.z - Math.cos(a) * 1.05), a);
  } else {
    const t = world.town.bed;
    player.spawn(new THREE.Vector3(t.x, 0, t.z), t.yaw);
  }
  player.thirdPerson = true;
  stationPose = where === 'camp' ? 'wakeroll' : 'wake';
  // A three-quarter shot from beside the foot of the bed, looking back along it at the sleeper.
  const fx = -Math.sin(player.yaw), fz = -Math.cos(player.yaw), p = player.pos;
  rig.setShot({ pos: new THREE.Vector3(p.x + fx * 1.7 - fz * 1.5, 1.7, p.z + fz * 1.7 + fx * 1.5), look: new THREE.Vector3(p.x - fx * 0.7, 0.55, p.z - fz * 0.7), fov: 50 });
  waking = WAKE_TIME;
  const fade = $('sleepFade');
  fade.style.transition = 'none'; fade.classList.add('on');
  void fade.offsetWidth;   // commit the black before fading in
  fade.style.transition = ''; requestAnimationFrame(() => fade.classList.remove('on'));
}
function endWake() {
  waking = 0;
  if (stationPose === 'wake' || stationPose === 'wakeroll') { stationPose = null; rig.setShot(null); }
  $('sleepFade').classList.remove('on');
  if (createPending) setTimeout(openCreation, 300);
}
for (const ev of ['keydown', 'pointerdown'] as const) window.addEventListener(ev, () => { if (waking && state === 'play') endWake(); }, true);
let inWorld = false;   // v0.06: false at the main menu (and the screens opened from it), true from Begin until back at the menu
let begun = false;   // v0.05: a save's bag and hour are restored once per page load (later Begins keep the live ones)
let character: Character = loadCharacter();
let myLook: unknown = packLook(GOTHIC_LOOK, controls.eyeHeight + 0.1);   // what other players see (multiplayer 2)
let netHello = () => {};   // (set once the rooms panel exists: the saved look is applied before it's built)
$('editCharacter').addEventListener('click', () => openWhoYouAre());   // B22: the tailor's "Who you are" tab
$('openCharacterForge').addEventListener('click', () => openCharacterForge());
$('openWeaponForge').addEventListener('click', () => openWeaponForge());
$('openSketchbook').addEventListener('click', () => openSketchbook());
$('openCasebook').addEventListener('click', () => openCasebook());
// Lore-first item 5: everything you made, one tap from the pause menu, each piece with a Send button.
$('openWorks').addEventListener('click', () => { show('pause', false); extras.open('portfolio', () => { if (state === 'pause') { show('pause', true); focusMenu(0); } }); focusMenu(0); });
$('openMap').addEventListener('click', () => openMap());

$('begin').addEventListener('click', (e) => {
  if ((e as PointerEvent).pointerType === 'touch') setMode('touch');
  // 2026-10-31 (Mike): character creation is rolled back (backlog B25). Begin always goes straight into play;
  // the form and its Pause > Character button stay in the code, hidden, until it returns as its own step.
  void askToKeepData();   // lore-first item 3: ask the browser to keep this device's saves when space runs low
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
// Mike 2026-11-05: a second crossbow, for when both hands hold one (src/hands.ts).
const crossbow2 = new Crossbow(world.scene, camera, player, inventory, world.solids, () => rig.playFov);
for (const c of [crossbow, crossbow2]) { c.onFire = () => { audio.crossbowTwang(); gear.wearString(); }; c.onReloadClick = () => audio.reloadClick(); }
// v0.08 (Mike 2026-11-01): the smith's practice sword. Swing it at goblins (src/sword.ts).
const sword = new Sword(camera, player, inventory);
const sword2 = new Sword(camera, player, inventory);   // Mike 2026-11-05: a sword in each hand
sword2.held.name = 'held-sword-2';
for (const s of [sword, sword2]) {
  s.onSwing = (heavy) => { audio.swordSwish(heavy); haptics.play('tap'); };
  s.onHit = (n, heavy) => { gear.wearSword(n); audio.swordHit(heavy); haptics.play('hit'); hitStop = heavy ? 0.09 : 0.05; };
}
// Mike 2026-11-05: what each hand holds, in any combination (src/hands.ts).
// Mike 2026-11-05: shields (src/shield.ts), one per hand.
const shield = new Shield(camera, player), shield2 = new Shield(camera, player);
// Mike 2026-11-05: rocks and slings (src/sling.ts), one per hand.
const thrower = new Thrower(world.scene, camera, player, inventory), thrower2 = new Thrower(world.scene, camera, player, inventory);
for (const t of [thrower, thrower2]) t.onThrow = (kind, p) => { (kind === 'sling' ? audio.swordSwish(p > 0.7) : audio.swordSwish(false)); haptics.play(kind === 'sling' && p > 0.7 ? 'fire' : 'tap'); };
const hands = new Hands([crossbow, crossbow2], [sword, sword2], [torch, torch2], [shield, shield2], [thrower, thrower2], (item) =>
  item === 'torch' ? true : item === 'sword' ? sword.owned : item === 'none' ? true : inventory.count(item) > 0);
hands.onChange = () => syncCrossbowView();
inventory.hands = { label: (h) => HAND_LABEL[hands.held[h]], cycle: (h) => { hands.cycle(h); if (h === 'left') viewsM.beforeTorch = 'none'; } };
// Mike 2026-11-05: Diablo-style item cards on hover, focus or long-press in the bag.
const itemCard = attachItemCards(inventory.root, (id) => inventory.count(id), () => ({
  heldIn: (id) => (['left', 'right'] as const).filter((h) => hands.held[h] === id),
  forged: (id) => { const c = id === 'crossbow' ? loadWeapon() : id === 'sword' ? sword.look : null; return c && (c.name || c.legend || c.engraving) ? { name: c.name, legend: c.legend, engraving: c.engraving } : null; },
}));
let hitStop = 0, swordHitsAtEntry = 0;   // a few frames' pause on a hit, for weight
const ammoText = $('ammoText'), reloadBar = $('reloadBar'), reloadFill = reloadBar.querySelector<HTMLElement>('.fill')!;
reloadBar.querySelector<HTMLElement>('.zone')!.style.cssText = `left:${ZONE.start * 100}%;width:${(ZONE.end - ZONE.start) * 100}%`;
function updateAmmoHud() {
  const slinger = thrower.equipped || thrower2.equipped;
  show('ammo', crossbow.equipped || slinger);
  if (!crossbow.equipped) {
    if (!slinger) return;
    const w = [thrower, thrower2].find((t) => t.spin >= 0), t = `Rocks ${inventory.count('rock')}${w ? ` · whirling ${Math.round(w.power * 100)}%` : ''}`;
    if (ammoText.textContent !== t) ammoText.textContent = t;
    show('reloadBar', false);
    return;
  }
  const r = crossbow.reload;
  const dual = crossbow.dual, loaded = dual ? [crossbow, crossbow2].filter((c) => c.loaded).length : crossbow.loaded ? 1 : 0;
  const full = dual ? loaded === 2 : loaded === 1;
  const st = r.active ? (r.mode === 'jam' ? 'JAMMED' : r.mode === 'fast' ? 'Perfect!' : 'Reloading… R in the bright zone') : full ? (crossbow.bonusNextShot ? 'Loaded · 2× damage' : 'Loaded') + (dual ? ' ×2' : '') : loaded ? 'One loaded · R to reload' : 'Empty · R to reload';
  const t = `Bolts ${inventory.count('bolt')} · ${st}${crossbow.power < 1 ? ' · string frayed' : ''}`;
  if (ammoText.textContent !== t) ammoText.textContent = t;
  show('reloadBar', r.active);
  if (r.active) reloadFill.style.width = Math.min(100, (r.t / r.total) * 100) + '%';
  reloadBar.classList.toggle('jam', r.active && r.mode === 'jam');
}
// B44: the steadiness ring replaced the crosshair while the crossbow is in hand in first person.
// Mike 2026-11-06 ("ranger: has better crosshairs ... Everyone else does not have crosshairs and must use iron sights"):
// a Ranger gets a true crosshair (a reticle that opens and closes with their steadiness, any view); everyone else gets
// no crosshair at all with a crossbow in hand, and aims down the iron sights on the bow (first person).
const steadyRing = $('steady'), reticle = $('reticle');
let steadyShown = '';
function updateSteadyRing() {
  const ranger = character.profession === 'ranger';
  crossbow.ranger = crossbow2.ranger = ranger;
  const armed = state === 'play' && crossbow.equipped;
  const mode = !armed ? '' : ranger ? 'reticle' : 'sights';
  if (mode !== steadyShown) {
    steadyShown = mode;
    steadyRing.classList.add('hidden');
    reticle.classList.toggle('hidden', mode !== 'reticle');
    document.body.classList.toggle('steadyAim', mode !== '');   // hides the plain dot
  }
  if (mode !== 'reticle') return;
  const s = crossbow.stability;
  reticle.style.setProperty('--gap', `${(4 + 10 * (1 - s)).toFixed(1)}px`);
  reticle.classList.toggle('steady', s > 0.85);
}
// Mike 2026-11-05: each hand's button uses what that hand holds: LMB / RT / Fire = right hand, RMB / LT / Aim = left
// hand. A crossbow fires and a sword swings. A hand holding nothing (or a torch) aims the crossbow while its button is
// held, as RMB always has. Two crossbows can't aim down the sights. With two swords, pressing a hand whose sword is
// mid-cut lets the other hand cut, so one button mashed alternates the blades.
const handDown: Record<Hand, boolean> = { left: false, right: false };
function handButton(h: Hand, down: boolean) {
  if (player.piloting) { pilotHand(h, down); return; }
  if (handDown[h] === down) return;
  handDown[h] = down;
  if (down && state === 'play') useHand(h);
  if (!down) hands.throwerIn(h)?.release();   // a whirling sling looses as you let go
  syncAim();
}
function syncAim() {
  const aim = (['left', 'right'] as Hand[]).some((h) => handDown[h] && hands.aimsWith(h));
  if (aim !== crossbow.ads) crossbow.setADS(aim);
}
function useHand(h: Hand) {
  const item = hands.held[h];
  if (isThrow(item)) {
    const t = hands.throwerIn(h);
    if (t && !t.press()) toast('No rocks. Pick some up from a rock pile, or where they landed.', 2200);
    return;
  }
  if (isMelee(item)) {
    const s = hands.swordIn(h), o = hands.swordIn(h === 'left' ? 'right' : 'left');
    if (s && s.swinging && o && !o.swinging) o.swing(); else s?.swing();
    return;
  }
  if (item !== 'crossbow') return;
  const c = hands.bowIn(h);
  if (!c) return;
  if (c.fire()) { haptics.play('fire'); return; }
  const other = hands.bowIn(h === 'left' ? 'right' : 'left');
  if (other?.fire()) { haptics.play('fire'); return; }   // one hand empty: the other one shoots
  if (!c.loaded && !crossbow.reloading) toast(inventory.count('bolt') ? 'Empty: press R to reload' : 'No bolts left. Pick spent ones up with E.', 1800);
}
// Mike 2026-11-05: blocking. A shield is up while its hand's button is held; a sword is up while its button is
// still held after the cut ends. A blow from inside the arc in front of you is turned (a sword lets half through).
// Two shields cover a wider arc. Snares (from below) can't be blocked. A heavy blow still pushes you back a step.
function blockingWith(h: Hand): 'shield' | 'buckler' | 'sword' | null {
  if (state !== 'play' || !handDown[h]) return null;
  const it = hands.held[h];
  if (it === 'shield' || it === 'buckler') return it;
  if (isMelee(it)) { const s = hands.swordIn(h); return s && !s.swinging ? 'sword' : null; }
  return null;
}
const isBlocking = () => !!(blockingWith('left') || blockingWith('right'));
/** What gets through a blow of `dmg` from `from`: the damage left, and whether a block took it. */
function blockBlow(dmg: number, from: THREE.Vector3 | null | undefined): { dmg: number; blocked: boolean } {
  if (!from) return { dmg, blocked: false };
  const P = player.pos, yaw = player.thirdPerson ? player.bodyYaw : player.yaw;
  const a = Math.atan2(-(from.x - P.x), -(from.z - P.z)), off = Math.abs(Math.atan2(Math.sin(a - yaw), Math.cos(a - yaw)));
  const two = hands.both('shield') || hands.both('buckler') || (blockingWith('left') && blockingWith('right') && hands.shieldIn('left') && hands.shieldIn('right'));
  let leak = 1;
  for (const h of ['left', 'right'] as Hand[]) {
    const b = blockingWith(h);
    if (b && off <= BLOCK_ARC[b] + (two ? THREE.MathUtils.degToRad(20) : 0)) { leak = Math.min(leak, BLOCK_LEAK[b]); if (b !== 'sword') hands.shieldIn(h)?.struck(); }
  }
  if (leak >= 1) return { dmg, blocked: false };
  if (dmg >= 3) { const d = new THREE.Vector3(P.x - from.x, 0, P.z - from.z).normalize().multiplyScalar(0.45); player.pos.add(d); }   // a heavy blow still shoves you
  return { dmg: Math.floor(dmg * leak), blocked: true };
}
/** A tap of the main (right) hand: fires or swings what's held there, or else whatever's in the left hand. */
function fire() {
  if (state !== 'play') return;
  const r = hands.held.right, h: Hand = isMelee(r) || isThrow(r) || r === 'crossbow' ? 'right' : 'left';
  useHand(h);
}
function equip(on: boolean) {
  if (player.piloting && on) return;
  if (on && !hands.set('right', 'crossbow')) { toast('You have no crossbow yet.', 1800); return; }
  if (!on) { if (hands.held.right !== 'torch') hands.set('right', 'none'); const l = hands.held.left; if (isMelee(l) || isThrow(l) || l === 'crossbow') hands.set('left', 'none'); }
}
function equipSword() {
  if (player.piloting) return;
  if (!hands.set('right', 'sword')) { toast('No sword yet. The smith keeps a practice sword on the stand outside the smithy.', 2600); return; }
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
  inventory.give('sword', 1); haptics.play('pickup'); gesture('pickup'); syncStandSword();
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
const cullFrustum = new THREE.Frustum(), cullPV = new THREE.Matrix4(), cullSphere = new THREE.Sphere(new THREE.Vector3(), 1.3);
const cullMeshes = new WeakMap<THREE.Object3D, THREE.Object3D[]>();
let charsCulled = 0;
const figureOf = (o: THREE.Object3D): Puppet => ({ root: o, fig: o.userData.rig ? new FigureAnim(o.userData.rig) : undefined });
for (const [id, o] of Object.entries(world.standees)) puppets.set(id, figureOf(o));
puppets.set('player', figureOf(player.body.children[0]));
// v0.06 T1/T4: townsfolk and the cinema band walk, spar, trade, chat and play on the procedural rig.
const townsfolk = new Townsfolk(world.scene);
setPathObstacles(world.colliders);   // walkers go round whatever stands on the green (the kill statue)
townsfolk.setCount(isLowPreset(settings.preset) ? 'low' : 'full');
// Town style 1: the background crowd, small pixel sprites in 8 directions (the 3D townsfolk and NPCs stay).
const crowd = new Crowd(world.scene);
crowd.setCount(isLowPreset(settings.preset) ? CROWD_LOW : CROWD_FULL);
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
  if (root.userData.friend) return { speed: 0, talking: state === 'dialogue' && talkM.dialogueWith === id, pose: root.userData.pose, look: root.userData.pose ? null : look };   // B56
  return { speed: id === 'natalie' ? companion.speed : 0, talking: ((id === 'natalie' || id === 'pedlar' || id === 'lenju' || id === 'taitai' || id === 'kavik' || id === 'candor') && state === 'dialogue' && talkM.dialogueWith === id) || (id === 'natalie' && campfire.isOpen), look: id === 'natalie' && companion.speed > 0.3 ? null : look };
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
// ---------- B34 (Mike 2026-11-03): one-shot moves, sitting down when idle, NPCs waving hello ----------
function gesture(kind: Gesture, who = 'player') { puppets.get(who)?.fig?.play(kind); }
let idleSitT = 0, idleSit = false;   // stand still in play for SIT_AFTER seconds and you sit down on the ground
const SIT_AFTER = 25;
const waved = new Map<string, number>();   // when each NPC last waved (once a minute at most)
let bannerT = 0;
let lastReload: string | null = null;
let lastVaults = 0;
/** The animator's sword inputs: the N (right) arm and the P (left) arm, by which hand each sword is in. */
function swordAnim(): Partial<AnimInput> {
  const r = hands.swordIn('right'), l = hands.swordIn('left');
  return { sword: !!r, swing: r?.progress ?? null, combo: r?.combo ?? 0, swordP: !!l, swingP: l?.progress ?? null, comboP: l?.combo ?? 0,
    blockN: !!blockingWith('right'), blockP: !!blockingWith('left') };
}
function animate(dt: number) {
  player.faceView = crossbow.equipped || !player.thirdPerson;
  const landed = player.consumeLanded();
  if (landed && player.thirdPerson) dust.burst(player.pos, 6, 0.35);
  if (landed) haptics.play('land');
  torch.update(dt, !player.thirdPerson); torch2.update(dt, !player.thirdPerson);
  for (const [sh, h] of [[shield, shield.side > 0 ? 'right' : 'left'], [shield2, shield2.side > 0 ? 'right' : 'left']] as const) sh.blocking = sh.equipped && !!blockingWith(h);
  heldBook.set(state === 'book' && reader.isOpen);
  purse.update(dt);
  syncStandSword();
  if (player.pos.y > 3.3 && !player.airborne) earn(5, 'a purse left on the lookout', 'lookout');
  if (viewsM.quickTimer > 0 && (viewsM.quickTimer -= dt) <= 0) $('quick').classList.add('hidden');
  if (player.vaults !== lastVaults) { lastVaults = player.vaults; haptics.play('jump'); }
  const rm = crossbow.reload.active ? crossbow.reload.mode : null;   // v0.04: feel the reload start and a jam
  if (rm !== lastReload) { if (rm === 'jam') haptics.play('jam'); else if (rm === 'normal') haptics.play('reload'); lastReload = rm; }
  dust.update(dt, camera);
  const idleNow = state === 'play' && !inDungeon && !waking && player.hSpeed < 0.05 && !player.airborne && !stationPose && !dojo.pose && !monkDeckM.deckPose
    && !crossbow.equipped && !sword.equipped && !sword2.equipped && !MOVE_ACTIONS.some((a) => player.held.has(a)) && Math.hypot(player.analog.x, player.analog.y) < 0.05;
  idleSitT = idleNow ? idleSitT + dt : 0;
  idleSit = idleNow && idleSitT > SIT_AFTER;
  syncFight(dt);
  const fighting = fightMode.isOpen;
  const mine: AnimInput = fighting ? fightInput(fightMode.fight.a) : {
    speed: state === 'play' ? player.hSpeed : 0, talking: state === 'dialogue', aiming: crossbow.equipped,
    ...swordAnim(),
    airborne: player.airborne, landed, pose: monkDeckM.deckPose ?? dojo.pose ?? stationPose ?? (state === 'book' ? 'read' : idleSit ? 'sitground' : null),
    look: { yaw: wrapAngle(player.yaw - player.bodyYaw), pitch: -player.pitch * 0.6 }, lean: player.lean.side,
  };
  sword.held.visible = sword.equipped && !mine.pose;   // put away at a station or a drill
  sword2.held.visible = sword2.equipped && !mine.pose;
  shield.update(dt, !player.thirdPerson && !rig.inShot, !!mine.pose); shield2.update(dt, !player.thirdPerson && !rig.inShot, !!mine.pose);
  thrower.update(dt, !player.thirdPerson && !rig.inShot, !!mine.pose); thrower2.update(dt, !player.thirdPerson && !rig.inShot, !!mine.pose);
  Thrower.fly(dt, world.solids, (x, z) => player.terrain(x, z), rockTargets);
  // B38: characters are skinned, so three can't frustum-cull them. Off-screen ones, or ones past the fog, aren't
  // drawn and skip their animation (CPU on phones). Their meshes are hidden, never the root (others own that).
  for (const r of remotes.values()) r.update(dt, camera.position, placeNow());   // other players: smooth toward their last state (multiplayer 2)
  netSend(dt, mine);
  camera.updateMatrixWorld();
  cullFrustum.setFromProjectionMatrix(cullPV.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse));
  const cullDist = Math.min(70, settings.fogDistance + 6);
  charsCulled = 0;
  for (const [id, p] of puppets) {
    if (id !== 'player') {
      p.root.getWorldPosition(cullSphere.center).y += 0.9;
      const show = fighting || (cullSphere.center.distanceTo(camera.position) < cullDist && cullFrustum.intersectsSphere(cullSphere));
      let ms = cullMeshes.get(p.root);
      if (!ms) { ms = []; p.root.traverse((o) => { if ((o as THREE.Mesh).isMesh && o.visible) ms!.push(o); }); cullMeshes.set(p.root, ms); }
      if (ms.length && ms[0].visible !== show) for (const m of ms) m.visible = show;
      if (!show) { charsCulled++; p.root.userData.talking = false; continue; }   // no stale moving mouth when they come back into view
    }
    const remote = id.startsWith('net:') ? remotes.get(id.slice(4)) : undefined;
    const input = id === 'player' ? (player.body.visible ? mine : null) : remote ? (remote.away || remote.far || remote.place !== placeNow() ? null : remote.input)
      : fighting && id === 'kavik' ? fightInput(fightMode.fight.b) : npcInput(id, p.root);
    if (!input) { p.root.userData.talking = false; continue; }
    if (id !== 'player' && !remote && p.fig && state === 'play' && !input.talking && !input.pose) {   // B34: hello as you come near (npcPos: npcInput's)
      const d = Math.hypot(player.pos.x - npcPos.x, player.pos.z - npcPos.z);
      if (d < 4.5 && clock.elapsedTime - (waved.get(id) ?? -1e9) > 60) { waved.set(id, clock.elapsedTime); p.fig.play('wave'); }
    }
    p.root.userData.talking = !!input.talking;   // the 2D head's face moves its mouth (src/render/sprites.ts)
    const clips = animators.get(id);
    if (clips) clips.set(clipState(input));
    else if (p.body) p.body.update(dt, input);
    else if (p.fig) p.fig.update(dt, input);
  }
  for (const a of animators.values()) a.update(dt);
  townsfolk.bandPlaying = cinema.withSound;
  townsfolk.update(dt, camera);
  if (!inDungeon) crowd.update(dt, camera.position);
  folkVoices.update(dt);
  bannerT += dt;
  swayStation(dt);
  companion.update(dt, player.pos, player.bodyYaw, state !== 'play');
  for (const p of pets) p.update(dt, player.pos, player.bodyYaw, state !== 'play');
  questProps.update(bannerT);
  barkTick(dt);
  petSense(dt);
  delveTick();   // B48
  gateCheck();
  exitCheck();   // Mike 2026-11-05: the four ways out
  regions.update(bannerT);
  if (regions.current === 'town') PORTAL.swirl.rotation = -bannerT * 0.8;   // B56
  // The library's interior (shelves, books, furniture: ~18 draw calls) only draws once the camera is near its door.
  library.group.visible = !inDungeon && camera.position.z < -4;
  dungeon.update(bannerT);
  dojo.tick(dt);
  monkDeckM.tickDeck(dt);
  livingMapM.mapClock += dt; if (livingMapM.mapClock > 0.5) { livingMapM.mapClock = 0; if (!inDungeon) livingMap.reveal(player.pos.x, player.pos.z); }
  const fl = world.campfireFlame, flare = 1 + campfireM.fireFlare;
  campfireM.fireFlare *= Math.exp(-dt * 2.5);
  fl.scale.set((1 + Math.sin(bannerT * 13) * 0.06) * flare, (1 + Math.sin(bannerT * 9.3) * 0.14 + Math.sin(bannerT * 21) * 0.06) * flare * flare, (1 + Math.cos(bannerT * 11) * 0.06) * flare);
  if (campfireM.satAtFire && player.pos.distanceTo(world.stations.campfire.position) > 25) campfireM.satAtFire = false;   // left camp: the bedroll waits for the next sit
  fl.rotation.y = bannerT * 0.8;
  const inside = player.pos.x > GALLERY.minX - 3 && player.pos.x < GALLERY.maxX && player.pos.z > GALLERY.minZ && player.pos.z < GALLERY.maxZ;
  if (inside && !cookingM.inGallery) refreshGallery();
  cookingM.inGallery = inside;
}
// ---------- Phase B: forges (B4 character, B5 weapon) with B6 dice; saved on this device ----------
const loreWords = lore.entries.filter((e) => e.type === 'lore').map((e) => e.title.split(':')[0]).filter((t) => t.length < 28);
const forgeAuthor = () => loadAuthor() || character.name;
let forgeFrom: State = 'play';
let wornLook: { look: FigureLook; height: number } = { look: GOTHIC_LOOK, height: controls.eyeHeight + 0.1 };   // B49: the statue copies it
function setPlayerLook(c: ForgeCharacter) {
  wornLook = { look: c.look, height: c.height };
  myLook = packLook(c.look, c.height); netHello();   // multiplayer: the room sees the new look
  const fig = player.setLook(c.look, c.height);
  torch.attach(); torch2.attach(); sword.attach(); sword2.attach(); shield.attach(); shield2.attach(); thrower.attach(); thrower2.attach();
  heldBook.attach(); purse.attach(); wear.attach(); wear.set(wear.level);
  puppets.set('player', { ...puppets.get('player')!, root: fig, fig: new FigureAnim(fig.userData.rig) });
  if (loadedModels.has('player')) puppets.set('player', { root: loadedModels.get('player')!, body: animators.has('player') ? undefined : new BodyAnim(loadedModels.get('player')!.children[0]) });
}
try { if (localStorage.getItem('gametool.forge.character')) setPlayerLook(loadForge(character.name)); } catch { /* storage blocked: default look */ }
// v0.06 S1–S2: at a station the avatar takes the station's pose, and the camera frames the whole station and the
// avatar, then sways slowly a few degrees clockwise and back (none with reduced motion). The panel covers the right (B29; framed as if on the left, then panelShift slides the view)
// of the screen (the bottom on a narrow phone, src/forge/forge.css), so the station is fitted into the rest.
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
let stationPose: Pose | null = null;
// B29 (Mike 2026-11-01): station panels sit on the right. Every station shot was framed with the subject centred in
// the space beside the panel; the camera's view window slides right by the panel's width so that space is on the left.
// Narrow phones put the panel along the bottom, so there's no shift there.
watchPanels();
let panelOff = 0;
function panelShift(dt: number) {
  let want = 0;
  if (state === 'forge' && innerWidth > 600) {
    const p = [...document.querySelectorAll<HTMLElement>('.forge-panel')].find((e) => e.getClientRects().length);
    if (p) want = p.getBoundingClientRect().width;
  }
  panelOff = reducedMotion.matches || Math.abs(want - panelOff) < 0.5 ? want : THREE.MathUtils.lerp(panelOff, want, 1 - Math.pow(0.0005, Math.min(dt, 0.25)));
  if (panelOff < 0.5) { if (camera.view?.enabled) camera.clearViewOffset(); return; }
  camera.setViewOffset(innerWidth, innerHeight, panelOff, 0, innerWidth, innerHeight);
}
let stationView: { focus: THREE.Vector3; pos: THREE.Vector3; look: THREE.Vector3; fov: number; t: number; shot: Shot | null } | null = null;
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
const characterForge = station(new CharacterForge(
  (c) => setPlayerLook(c),
  (c) => {
    const brandNew = !character.created;
    character = { ...character, name: c.name || character.name, ...characterForge.who, created: true }; saveCharacter(character); leaveForge();
    if (brandNew) natalieSawCreation();
  },
  loreWords, forgeAuthor));
// Mike 2026-11-06: right after a new hero is made, Natalie watches it happen (her lines in TRANSMOGRIFY). The hero is the
// listener; Natalie stays where she stands. Once it ends, the camp welcome waits its turn if it was still to come.
function natalieSawCreation() {
  if (state !== 'play' || inDungeon || firstMeet.active) return;
  const n = natalieRoot(), feet = n.getWorldPosition(new THREE.Vector3()), keepRot = n.rotation.y;
  n.rotation.y = Math.atan2(player.pos.x - feet.x, player.pos.z - feet.z);
  setState('dialogue');
  if (document.pointerLockElement) { expectUnlock = true; document.exitPointerLock(); }
  firstMeet.play(feet, player.pos.clone(), () => {
    n.rotation.y = keepRot;
    setState('play');
    if (welcomePending && !waking && wakeIntro()) campWelcome();
  }, TRANSMOGRIFY);
}
function openCharacterForge() {
  groups.mark('station', 'mirror');   // B52/B53
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
  characterForge.who = { motivation: character.motivation, secret: character.secret, profession: character.profession };   // B22: "Who you are" lives here now
  characterForge.open(loadForge(character.name));
}
/** B22: the Journal's (and Gameplay's) "Who you are" opens the Tailor & Barber-Surgeon on that tab. */
function openWhoYouAre() {
  setPanelTab('Tailor & Barber-Surgeon', 1);
  openCharacterForge();
}
// Mike 2026-11-06 ("There's no character creation at new game" + "Give character choice of profession"): a new hero
// (no save, no profession yet) gets the Tailor & Barber-Surgeon on its Profession tab once the wake-up ends. Only the
// profession is asked for; Done leaves everything else as it is. Test browsers skip it unless gametool.createtest = 'on'.
let createPending = false;
function createIntro() {
  try { return !navigator.webdriver || localStorage.getItem('gametool.createtest') === 'on'; } catch { return !navigator.webdriver; }
}
function openCreation() {
  createPending = false;
  if (state !== 'play' || character.profession) return;
  // Step up to the camp mirror first, so the hero stands in view while you make them.
  const m = world.stations.mirror.position, ry = world.stations.mirror.rotation.y;
  player.spawn(new THREE.Vector3(m.x + Math.sin(ry) * 1.6, 0, m.z + Math.cos(ry) * 1.6), ry + Math.PI);
  setPanelTab('Tailor & Barber-Surgeon', 0);
  characterForge.creating = true;
  openCharacterForge();
}
// B5; Mike 2026-11-05: the weapon you're forging shows large in the middle of the free screen (src/forge/preview.ts),
// not over the anvil. Drag, the right stick or the arrow keys turn it. `weaponDisplay` is its turntable.
const forgePreview = new ForgePreview();
const weaponDisplay = forgePreview.turntable;
const weaponForge = station(new WeaponForge(
  (model, kind) => forgePreview.set(model, kind),
  (c: WeaponCosmetic, sw: SwordCosmetic) => { crossbow.applyCosmetic(c); crossbow2.applyCosmetic(c); sword.applyCosmetic(sw); sword2.applyCosmetic(sw); forgePreview.active = false; leaveForge(); },
  loreWords, forgeAuthor));
/** Where the forge preview draws: the screen minus the panel (to its left on a wide screen, above it on a tall one). */
function forgePreviewRect() {
  const W = window.innerWidth, H = window.innerHeight, p = weaponForge.el.querySelector('.forge-panel')?.getBoundingClientRect();
  if (!p || p.width === 0) return { x: 0, y: 0, w: W, h: H };
  if (p.left > W * 0.3) return { x: 0, y: 0, w: p.left, h: H };   // panel on the right
  return { x: 0, y: 0, w: W, h: Math.max(80, p.top) };            // panel along the bottom
}
// v0.04: the weapon forge opens at the camp anvil or at the town smithy, wherever you asked for it.
const anvilSpot = world.stations.anvil.position.clone();
function openWeaponForge(at: THREE.Vector3 = world.stations.anvil.position) {
  groups.mark('station', 'anvil');   // B52/B53
  anvilSpot.copy(at);
  forgePreview.reset();   // v0.06 S4: it stays still; drag (a mouse or a finger) or the right stick turns it
  enterForge();
  // S1: you stand at the anvil's near side with the hammer; the camera takes in the anvil, the crossbow and you.
  const from = new THREE.Vector3(2.1, 0, 0.5), side = new THREE.Vector3(-0.35, 0, 1).normalize();
  takeStation(at.clone().addScaledVector(side, 0.85), at, 'smith');
  frameStation(new THREE.Vector3(at.x, 1.0, at.z).addScaledVector(side, 0.35), 1.75, from, 42);
  forgePreview.active = true;
  weaponForge.open(loadWeapon());
}
function closeForges() {
  if (gateOpen) gateNo();
  if (killRecordM.descendSheet) { killRecordM.descendSheet.remove(); killRecordM.descendSheet = null; leaveForge(); }
  closeAllStations((p) => p === wiki && state !== 'forge');   // the wiki is also a reading view from Extras
  if (cookingM.galleryCard) { cookingM.galleryCard.remove(); cookingM.galleryCard = null; leaveForge(); }
}
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
const sketchPad = station(new SketchPad(
  (s: Sketch) => { stampBanner(world.bannerCloth, s); storeSet('gametool.banner', s.id); toast(`"${s.name}" is pinned to the writing desk.`); earn(3, 'for a banner sketch', 'sketch:' + s.id); },
  () => leaveForge(), forgeAuthor));
stampBanner(world.bannerCloth, (() => { try { return sketchById(localStorage.getItem('gametool.banner') ?? '') ?? DEFAULT_SKETCH; } catch { return DEFAULT_SKETCH; } })());
function openSketchbook(frame: 'banner' | 'body' = 'banner') {
  groups.mark('station', 'sketchbook');   // B52/B53
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
const greerRoot = () => (world.standees.pedlar.userData.replacedBy as THREE.Object3D | undefined) ?? world.standees.pedlar;
const natalieRoot = () => (world.standees.natalie.userData.replacedBy as THREE.Object3D | undefined) ?? world.standees.natalie;
const companion = new Companion(natalieRoot, world.natalieTarget, world.colliders, world.bounds, loadCompanion());
companion.terrain = groundY;
// B23: the language picker (Gameplay).
const langSel = $<HTMLSelectElement>('langSel');
langSel.value = getLang();
langSel.addEventListener('change', () => setLang(langSel.value === 'es' ? 'es' : 'en' as Lang));
($('companionQuiet') as HTMLInputElement).checked = companion.prefs.quiet;
$('companionQuiet').addEventListener('change', (e) => { companion.prefs.quiet = (e.target as HTMLInputElement).checked; saveCompanion(companion.prefs); });
// ---------- Pets (Mike 2026-11-04, "Add pets" + "Go"): a dog by the inn, a cat by the store, an owl at the library,   // -> src/app/pets.ts
const petsDeps = { get world() { return world; }, get player() { return player; }, get groundY() { return groundY; }, get toast() { return toast; }, get leaveForge() { return leaveForge; }, get interactables() { return interactables; }, get inDungeon() { return inDungeon; }, get inventory() { return inventory; }, get enterForge() { return enterForge; }, get quest() { return quest; }, get questProps() { return questProps; }, get companion() { return companion; }, get loreWords() { return loreWords; }, get forgeAuthor() { return forgeAuthor; }, get character() { return character; }, get state() { return state; }, get hint() { return hint; }, get keyName() { return keyName; }, get earn() { return earn; }, get talkM() { return talkM; }, get resumePlay() { return resumePlay; }, get talkTo() { return talkTo; }, get isMage() { return isMage; }, get missile() { return missile; } };
export type PetsDeps = typeof petsDeps;
const { openCasebook, pets, casebook, seen, outFrom, markSeen, cap, openFolklore, dog, petPrefs, petsPanel, callPet, folklore, pedlarHit } = setupPets(petsDeps);
// ---------- Phase E: B8 campfire telling + B11 bard tunes, B9 gallery hall ----------   // -> src/app/campfire.ts
const campfireDeps = { get quest() { return quest; }, get toast() { return toast; }, get refreshGallery() { return refreshGallery; }, get earn() { return earn; }, get leaveForge() { return leaveForge; }, get forgeAuthor() { return forgeAuthor; }, get inventory() { return inventory; }, get openEditor() { return openEditor; }, get world() { return world; }, get natalieRoot() { return natalieRoot; }, get rig() { return rig; }, get frameForge() { return frameForge; }, get groups() { return groups; }, get autoSave() { return autoSave; }, get enterForge() { return enterForge; }, get takeStation() { return takeStation; } };
export type CampfireDeps = typeof campfireDeps;
const campfireM = setupCampfire(campfireDeps);
const { campfire, openCampfire, telling } = campfireM;
// ---------- B18: cooking at the campfire; the Recipe book in the Journal ----------   // -> src/app/cooking.ts
const cookingDeps = { get state() { return state; }, get campfire() { return campfire; }, get forgeAuthor() { return forgeAuthor; }, get earn() { return earn; }, get toast() { return toast; }, get groups() { return groups; }, get leaveForge() { return leaveForge; }, get enterForge() { return enterForge; }, get world() { return world; }, get companion() { return companion; }, get casebook() { return casebook; }, get inputMode() { return inputMode; }, get gamepad() { return gamepad; }, get natalieWas() { return campfireM.natalieWas; }, set natalieWas(v) { campfireM.natalieWas = v; }, get natalieRoot() { return natalieRoot; }, get interactables() { return interactables; }, get openCampfire() { return openCampfire; }, get takeStation() { return takeStation; }, get lastRest() { return lastRest; }, set lastRest(v) { lastRest = v; }, get $() { return $; }, get setWorldTime() { return setWorldTime; }, get autoSave() { return autoSave; }, get stationPose() { return stationPose; }, set stationPose(v) { stationPose = v; }, get hint() { return hint; }, get keyName() { return keyName; }, get satAtFire() { return campfireM.satAtFire; }, get inDungeon() { return inDungeon; }, get setState() { return setState; }, get expectUnlock() { return expectUnlock; }, set expectUnlock(v) { expectUnlock = v; }, get reader() { return reader; }, get character() { return character; }, get quest() { return quest; }, get seen() { return seen; }, get openReader() { return openReader; } };
export type CookingDeps = typeof cookingDeps;
const cookingM = setupCooking(cookingDeps);
const { firstDayOn, firstDay, refreshGallery, sideGate, sideGo, cook, portrait, sleep, WAKE_AT, openRecipeBook, recipeBook, gallery, ceilings } = cookingM;
// ---------- Phase F: B15 seeded dungeon under the library ----------
const dungeon = new Dungeon(world.scene);
const TRAPDOOR = new THREE.Vector3(STAIRS.x, 0, STAIRS.top - 1.0);   // the head of the stairs (the old trapdoor's spot)
// Mike 2026-11-06 (library item 5): the trapdoor is now a stone stairwell down (src/world/stairs.ts).
const stairwell = buildStairwell(library.group as unknown as THREE.Scene, world.colliders);
const trapHit = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.6, 1.6), new THREE.MeshBasicMaterial({ visible: false }));
trapHit.position.set(STAIRS.x, 0.3, STAIRS.top - 0.4); trapHit.scale.set(1.2, 1, 1); world.scene.add(trapHit);
let inDungeon = false, savedFog: { color: THREE.Color; near: number; far: number; bg: THREE.Color } | null = null;
// The follow camera stays under the dungeon ceiling, and (v0.06 W2) under the library's and gallery's while the player is inside.
rig.ceiling = (x, z) => { if (inDungeon) return 2.9; const rc = regions.region?.ceiling; if (rc) return regions.region!.origin.y + rc; const r = roofOver(player.pos.x, player.pos.z); return r && roofOver(x, z, 1) === r ? r.y - 0.3 : Infinity; };
const delves = (() => { try { return JSON.parse(localStorage.getItem('gametool.delves') ?? '{}') as Record<string, { theme: string; chest?: boolean; nest?: boolean; quick?: 'won' | 'lost'; at: string; rooms?: number[]; deep?: boolean }>; } catch { return {}; } })();
const saveDelves = () => { storeSet('gametool.delves', JSON.stringify(delves)); };
// ---------- Mike 2026-11-05: the descent (src/delve/descent.ts). Floors 1-30, a new layout each time; permadeath ----------
let descent: Descent | null = null;
const record = loadRecord();
const innWalls = station(new InnWalls());
const lastWords = new LastWords();
const stolenBooks = new Map<string, string>();   // title -> book id, while a thief has it
const innBoards = buildInnBoards();
{
  const door = world.town.doors.inn, ry = door.rotation.y;
  for (const [g, side] of [[innBoards.tally, -1.9], [innBoards.wall, 2.1]] as const) {
    const at = outFrom(door, 0.12, side);
    g.position.set(at.x, 0, at.z); g.rotation.y = ry;
    world.scene.add(g);
  }
  const hit = (g: THREE.Group) => { const m = new THREE.Mesh(new THREE.BoxGeometry(1.4, 1.6, 0.6), new THREE.MeshBasicMaterial({ visible: false })); m.position.y = 1.5; g.add(m); return m; };
  interactables.push({ obj: hit(innBoards.tally), verb: () => 'Read the death tally', when: () => !inDungeon, act: () => { enterForge(); innWalls.open('tally', () => leaveForge()); } });
  interactables.push({ obj: hit(innBoards.wall), verb: () => "Look at the survivors' wall", when: () => !inDungeon, act: () => { enterForge(); innWalls.open('survivors', () => leaveForge()); } });
}
// ---------- B55 (Mike 2026-11-06): Tam's coin table beside the Inn, a coin-flip wager (src/coinflip.ts) ----------   // -> src/app/coinTable.ts
const coinTableDeps = { get world() { return world; }, get outFrom() { return outFrom; }, get groups() { return groups; }, get enterForge() { return enterForge; }, get inventory() { return inventory; }, get leaveForge() { return leaveForge; }, get interactables() { return interactables; }, get sideGate() { return sideGate; }, get inDungeon() { return inDungeon; }, get sideGo() { return sideGo; } };
export type CoinTableDeps = typeof coinTableDeps;
const { COIN_AT, coinTable, openCoinTable } = setupCoinTable(coinTableDeps);
const descentFlowDeps = { get groups() { return groups; }, get descent() { return descent; }, set descent(v) { descent = v; }, get record() { return record; }, get tutorialOn() { return tutorialOn; }, get player() { return player; }, get sharedSeed() { return sharedSeed; }, get companion() { return companion; }, get enterForge() { return enterForge; }, get leaveForge() { return leaveForge; }, get toast() { return toast; }, get world() { return world; }, get rig() { return rig; }, get mouseHeld() { return mouseHeld; }, set mouseHeld(v) { mouseHeld = v; }, get reducedMotion() { return reducedMotion; }, get settings() { return settings; }, get carried() { return carried; }, get inventory() { return inventory; }, get goblins() { return goblins; }, get inDungeon() { return inDungeon; }, set inDungeon(v) { inDungeon = v; }, get dungeon() { return dungeon; }, get STAIRS_TIME() { return STAIRS_TIME; }, get stairsTimerM() { return stairsTimerM; }, get natalieRoot() { return natalieRoot; }, get pets() { return pets; }, get delveRewardsM() { return delveRewardsM; }, get spawnGoblins() { return spawnGoblins; }, get delves() { return delves; }, get saveDelves() { return saveDelves; }, get savedFog() { return savedFog; }, set savedFog(v) { savedFog = v; }, get swordHitsAtEntry() { return swordHitsAtEntry; }, set swordHitsAtEntry(v) { swordHitsAtEntry = v; }, get sword() { return sword; }, get sword2() { return sword2; }, get sturdy() { return cookingM.sturdy; }, set sturdy(v) { cookingM.sturdy = v; }, get cook() { return cook; }, get killRecordM() { return killRecordM; }, get markSeen() { return markSeen; }, get refreshGallery() { return refreshGallery; }, get stolenBooks() { return stolenBooks; }, get smithShop() { return smithShop; }, get portrait() { return portrait; }, get character() { return character; }, set character(v) { character = v; }, get purse() { return purse; }, get hands() { return hands; }, get syncStandSword() { return syncStandSword; }, get REGION_KEY() { return REGION_KEY; }, get rolledGoblinsM() { return rolledGoblinsM; }, get DELVE_HP() { return DELVE_HP; }, get state() { return state; }, get openCharacterForge() { return openCharacterForge; }, get friends() { return friends; }, get lastWords() { return lastWords; }, get innBoards() { return innBoards; }, get innWalls() { return innWalls; }, get runSummary() { return runSummary; }, get killStatue() { return killStatue; }, get kills() { return kills; }, get gear() { return gear; } };
export type DescentFlowDeps = typeof descentFlowDeps;
const descentFlowM = setupDescentFlow(descentFlowDeps);
const { startDescent, imbued, heroFalls, exitDungeon, descendCine, fluxTick, goDown, enterDungeon, scrollPicker, applyScrolls, patronGifts, applyFlux } = descentFlowM;
// ---------- B48 (Mike 2026-11-04): delving deeper pays, in crowns and lore books ----------   // -> src/app/delveRewards.ts
const delveRewardsDeps = { get inventory() { return inventory; }, get seen() { return seen; }, get toast() { return toast; }, get descent() { return descent; }, get markSeen() { return markSeen; }, get refreshGallery() { return refreshGallery; }, get inDungeon() { return inDungeon; }, get dungeon() { return dungeon; }, get player() { return player; }, get delves() { return delves; }, get saveDelves() { return saveDelves; } };
export type DelveRewardsDeps = typeof delveRewardsDeps;
const delveRewardsM = setupDelveRewards(delveRewardsDeps);
const { delveTick, runSummary, dropLoreBook } = delveRewardsM;
// ---------- B49 (Mike 2026-11-04): most goblins in one delve, as a statue on the green near the library ----------   // -> src/app/killRecord.ts
const killRecordDeps = { get world() { return world; }, get interactables() { return interactables; }, get toast() { return toast; }, get inDungeon() { return inDungeon; }, get character() { return character; }, get wornLook() { return wornLook; }, get enterForge() { return enterForge; }, get record() { return record; }, get friends() { return friends; }, get multiplayerM() { return multiplayerM; }, get inventory() { return inventory; }, get leaveForge() { return leaveForge; }, get startDescent() { return startDescent; }, get shrineLines() { return shrineLines; }, get delves() { return delves; }, get saveDelves() { return saveDelves; }, get state() { return state; } };
export type KillRecordDeps = typeof killRecordDeps;
const killRecordM = setupKillRecord(killRecordDeps);
const { killStatue, kills, quick, countKill, openDescend, openQuick } = killRecordM;
// ---------- Trait roll tables: rolled goblins (docs/trait-roll-tables.md, Mike approved 2026-10-29) ----------   // -> src/app/rolledGoblins.ts
const rolledGoblinsDeps = { get quick() { return quick; }, get dungeon() { return dungeon; }, get world() { return world; }, get player() { return player; }, get crossbow() { return crossbow; }, get inDungeon() { return inDungeon; }, get blockBlow() { return blockBlow; }, get imbued() { return imbued; }, get toast() { return toast; }, get sturdy() { return cookingM.sturdy; }, get fighterKit() { return fighterKit; }, get gesture() { return gesture; }, get descent() { return descent; }, get tutorialSaved() { return tutorialSaved; }, get heroFalls() { return heroFalls; }, get exitDungeon() { return exitDungeon; }, get companion() { return companion; }, get inventory() { return inventory; }, get countKill() { return countKill; }, get record() { return record; }, get stolenBooks() { return stolenBooks; }, get hands() { return hands; }, get toggleTorch() { return toggleTorch; }, get friends() { return friends; }, get sword() { return sword; }, get sword2() { return sword2; }, get crossbow2() { return crossbow2; }, get cook() { return cook; } };
export type RolledGoblinsDeps = typeof rolledGoblinsDeps;
const rolledGoblinsM = setupRolledGoblins(rolledGoblinsDeps);
const { rockTargets, carried, goblins, spawnGoblins, DELVE_HP, delveHpEl, urlFlags, forcedGoblin, goblinWorld } = rolledGoblinsM;
// ---------- B51 (Mike 2026-11-06): after the tutorial run, each floor gives you 8 minutes to reach a staircase ----------   // -> src/app/stairsTimer.ts
const stairsTimerDeps = { get exitDungeon() { return exitDungeon; }, get toast() { return toast; }, get companion() { return companion; }, get descent() { return descent; }, get state() { return state; }, get descendCine() { return descendCine; }, get delveHp() { return rolledGoblinsM.delveHp; }, set delveHp(v) { rolledGoblinsM.delveHp = v; }, get heroFalls() { return heroFalls; }, get inDungeon() { return inDungeon; }, get delveHpEl() { return delveHpEl; }, get wear() { return wear; }, get hitStop() { return hitStop; }, set hitStop(v) { hitStop = v; }, get goblins() { return goblins; }, get DELVE_HP() { return DELVE_HP; }, get slowT() { return rolledGoblinsM.slowT; }, set slowT(v) { rolledGoblinsM.slowT = v; }, get player() { return player; }, get isBlocking() { return isBlocking; }, get fluxNow() { return descentFlowM.fluxNow; }, get imbued() { return imbued; }, get hands() { return hands; }, get fluxTick() { return fluxTick; }, get hurtFlash() { return rolledGoblinsM.hurtFlash; }, set hurtFlash(v) { rolledGoblinsM.hurtFlash = v; }, get fighterKit() { return fighterKit; }, get urlFlags() { return urlFlags; }, get forcedGoblin() { return forcedGoblin; } };
export type StairsTimerDeps = typeof stairsTimerDeps;
const stairsTimerM = setupStairsTimer(stairsTimerDeps);
const { tutorialOn, STAIRS_TIME, tutorialSaved, bestiary, updateDelve } = stairsTimerM;
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
// ---------- Phase F: B7 living map ----------   // -> src/app/livingMap.ts
const livingMapDeps = { get quest() { return quest; }, get world() { return world; }, get delves() { return delves; }, get TRAPDOOR() { return TRAPDOOR; }, get skills() { return skills; }, get caravan() { return caravan; }, get dojo() { return dojo; }, get player() { return player; }, get leaveForge() { return leaveForge; }, get forgeAuthor() { return forgeAuthor; }, get natalieRoot() { return natalieRoot; }, get kavikRoot() { return kavikRoot; }, get knight() { return knight; }, get GRIND() { return GRIND; }, get reelScreen() { return reelScreen; }, get killStatue() { return killStatue; }, get COIN_AT() { return COIN_AT; }, get firstDay() { return firstDay; }, get PORTAL() { return PORTAL; }, get state() { return state; }, get groups() { return groups; }, get enterForge() { return enterForge; } };
export type LivingMapDeps = typeof livingMapDeps;
const livingMapM = setupLivingMap(livingMapDeps);
const { openMap, livingMap } = livingMapM;
// ---------- Phase F: B14 dojo (your character demonstrates; you follow the beginner-safe version) ----------   // -> src/app/dojo.ts
const dojoDeps = { get world() { return world; }, get player() { return player; }, get rig() { return rig; }, get leaveForge() { return leaveForge; }, get forgeAuthor() { return forgeAuthor; }, get state() { return state; }, get groups() { return groups; }, get enterForge() { return enterForge; }, get interactables() { return interactables; }, get sideGate() { return sideGate; }, get sideGo() { return sideGo; }, get inDungeon() { return inDungeon; } };
export type DojoDeps = typeof dojoDeps;
const { dojo, openDojo } = setupDojo(dojoDeps);
// ---------- B35 (Mike 2026-11-03): fighter mode vs Kavik, side-on on the dojo mats (src/fight/) ----------   // -> src/app/fightMode.ts
const fightModeDeps = { get world() { return world; }, get toast() { return toast; }, get interactables() { return interactables; }, get sideGate() { return sideGate; }, get sideGo() { return sideGo; }, get inDungeon() { return inDungeon; }, get state() { return state; }, get talkTo() { return talkTo; }, get monkM() { return monkM; }, get enterForge() { return enterForge; }, get player() { return player; }, get endDuel() { return endDuel; }, get leaveForge() { return leaveForge; }, get earn() { return earn; }, get gesture() { return gesture; } };
export type FightModeDeps = typeof fightModeDeps;
const fightModeM = setupFightMode(fightModeDeps);
const { fightMode, kavikRoot, DOJO_RING, fightFx, ringPt, spark, sparkMat, fightCam, openFight, talkToKavik } = fightModeM;
// ---------- Skyrunner (Mike 2026-11-05): fly a mana-sail glider from the perch east of the library (src/sky/) ----------   // -> src/app/skyrunner.ts
const skyrunnerDeps = { get world() { return world; }, get interactables() { return interactables; }, get sideGate() { return sideGate; }, get sideGo() { return sideGo; }, get inDungeon() { return inDungeon; }, get state() { return state; }, get groups() { return groups; }, get enterForge() { return enterForge; }, get player() { return player; }, get leaveForge() { return leaveForge; }, get earn() { return earn; }, get talkTo() { return talkTo; }, get lenjuScript() { return lenjuScript; }, get taitaiScript() { return taitaiScript; } };
export type SkyrunnerDeps = typeof skyrunnerDeps;
const { sky, openSky, perch, skyFolk } = setupSkyrunner(skyrunnerDeps);
// ---------- Mike 2026-11-06: Candor the archer (Mike's Painted Archer model) teaches archery at his range ----------   // -> src/app/candor.ts
const candorDeps = { get world() { return world; }, get interactables() { return interactables; }, get talkTo() { return talkTo; }, get inDungeon() { return inDungeon; }, get character() { return character; }, get inventory() { return inventory; }, get groups() { return groups; }, get crossbow() { return crossbow; }, get crossbow2() { return crossbow2; }, get toast() { return toast; }, get player() { return player; }, get earn() { return earn; } };
export type CandorDeps = typeof candorDeps;
const candorM = setupCandor(candorDeps);
const { startLesson, updateLesson, candorHit, archery } = candorM;
// ---------- Mike 2026-11-06: the Fighter's techniques (src/fighter.ts) ----------   // -> src/app/fighterTechniques.ts
const fighterTechniquesDeps = { get character() { return character; }, get state() { return state; }, get player() { return player; }, get toast() { return toast; }, get sword() { return sword; }, get sword2() { return sword2; }, get hitStop() { return hitStop; }, set hitStop(v) { hitStop = v; }, get gesture() { return gesture; }, get isMage() { return isMage; }, get missile() { return missile; }, get isMonk() { return isMonk; }, get inDungeon() { return inDungeon; }, get lockTarget() { return lockTarget; }, get castMissile() { return castMissile; }, get lockOn() { return lockOn; } };
export type FighterTechniquesDeps = typeof fighterTechniquesDeps;
const { fighterKit, techHud, isFighter, technique, breathe, updateFighter, techLog } = setupFighterTechniques(fighterTechniquesDeps);
// ---------- Mike 2026-11-06 (B4): the Mage's magic missile, taught by Magister Greer (src/missile.ts) ----------   // -> src/app/mage.ts
const mageDeps = { get world() { return world; }, get player() { return player; }, get character() { return character; }, get goblins() { return goblins; }, get toast() { return toast; }, get state() { return state; }, get gesture() { return gesture; }, get techHud() { return techHud; } };
export type MageDeps = typeof mageDeps;
const { isMage, missile, castMissile, learnMissile } = setupMage(mageDeps);
// ---------- Mike 2026-11-06 (B5): the Monk locks on to a goblin and meets it hand to hand, in fight mode ----------   // -> src/app/monk.ts
const monkDeps = { get character() { return character; }, get player() { return player; }, get goblins() { return goblins; }, get state() { return state; }, get fightMode() { return fightMode; }, get toast() { return toast; }, get inDungeon() { return inDungeon; }, get RING() { return fightModeM.RING; }, set RING(v) { fightModeM.RING = v; }, get enterForge() { return enterForge; }, get DOJO_RING() { return DOJO_RING; }, get fightFx() { return fightFx; }, get leaveForge() { return leaveForge; }, get dungeon() { return dungeon; }, get goblinWorld() { return goblinWorld; }, get sky() { return sky; }, get ringPt() { return ringPt; }, get kavikRoot() { return kavikRoot; }, get sparkT() { return fightModeM.sparkT; }, set sparkT(v) { fightModeM.sparkT = v; }, get spark() { return spark; }, get sparkMat() { return sparkMat; }, get fightCam() { return fightCam; }, get rig() { return rig; } };
export type MonkDeps = typeof monkDeps;
const monkM = setupMonk(monkDeps);
const monkDeckDeps = { get world() { return world; }, get fightMode() { return fightMode; }, get player() { return player; }, get rig() { return rig; }, get state() { return state; }, get enterForge() { return enterForge; }, get leaveForge() { return leaveForge; }, get interactables() { return interactables; }, get sideGate() { return sideGate; }, get sideGo() { return sideGo; }, get inDungeon() { return inDungeon; }, get toast() { return toast; }, get isMonk() { return monkM.isMonk; }, get wornLook() { return wornLook; } };
export type MonkDeckDeps = typeof monkDeckDeps;
const monkDeckM = setupMonkDeck(monkDeckDeps);
const { syncFight, fightInput, endDuel, lenjuScript, taitaiScript, isMonk, lockTarget, lockOn } = monkM;
// ---------- B16: the Spanish caravan by the coach road (never translated; a phrasebook in the Journal) ----------   // -> src/app/speakers.ts
const speakersDeps = { get world() { return world; }, get puppets() { return puppets; }, get figureOf() { return figureOf; }, get player() { return player; }, get rig() { return rig; }, get leaveForge() { return leaveForge; }, get earn() { return earn; }, get character() { return character; }, get state() { return state; }, get groups() { return groups; }, get enterForge() { return enterForge; }, get interactables() { return interactables; }, get inDungeon() { return inDungeon; } };
export type SpeakersDeps = typeof speakersDeps;
const { caravan, phrasebook, caravanFolk, openCaravan, teahouse, teaFolk, openTeahouse, palengke, marketFolk, openPalengke } = setupSpeakers(speakersDeps);
// ---------- Multiplayer (Mike 2026-11-04, "Make this game multiplayer!" + "Do it"): friends-only rooms, src/net/ ----------   // -> src/app/multiplayer.ts
const multiplayerDeps = { get character() { return character; }, get urlFlags() { return urlFlags; }, get leaveForge() { return leaveForge; }, get toast() { return toast; }, get state() { return state; }, get enterForge() { return enterForge; }, get inDungeon() { return inDungeon; }, get puppets() { return puppets; }, get netGuests() { return netGuests; }, set netGuests(v) { netGuests = v; }, get applyQuality() { return applyQuality; }, get world() { return world; }, get sword() { return sword; }, get heldBook() { return heldBook; }, get torch() { return torch; }, get descent() { return descent; }, get $() { return $; }, get player() { return player; }, get pets() { return pets; }, get gesture() { return gesture; }, get goblins() { return goblins; }, get dungeon() { return dungeon; }, get goblinWorld() { return goblinWorld; }, get regions() { return regions; }, get portalM() { return portalM; }, get wagonStop() { return wagonStop; }, get placeName() { return placeName; }, get travel() { return travel; }, get myLook() { return myLook; }, get setWorldTime() { return setWorldTime; }, get netHello() { return netHello; }, set netHello(v) { netHello = v; }, get inWorld() { return inWorld; } };
export type MultiplayerDeps = typeof multiplayerDeps;
const multiplayerM = setupMultiplayer(multiplayerDeps);
const { friends, openFriends, remotes, placeNow, netSend, sharedSeed, floorLeader } = multiplayerM;
// ---------- B19: real-skill mini games at the practice table by the dojo mats; cards go in the Skills book ----------   // -> src/app/skillsTable.ts
const skillsTableDeps = { get world() { return world; }, get earn() { return earn; }, get leaveForge() { return leaveForge; }, get state() { return state; }, get groups() { return groups; }, get enterForge() { return enterForge; }, get player() { return player; }, get stationPose() { return stationPose; }, set stationPose(v) { stationPose = v; }, get rig() { return rig; }, get interactables() { return interactables; }, get inDungeon() { return inDungeon; } };
export type SkillsTableDeps = typeof skillsTableDeps;
const { skills, openSkills } = setupSkillsTable(skillsTableDeps);
// ---------- B17: gear care at the smith's grindstone (sharpen, clean and oil, restring) ----------   // -> src/app/gearCare.ts
const gearCareDeps = { get leaveForge() { return leaveForge; }, get sword() { return sword; }, get inventory() { return inventory; }, get sword2() { return sword2; }, get crossbow() { return crossbow; }, get crossbow2() { return crossbow2; }, get earn() { return earn; }, get world() { return world; }, get state() { return state; }, get groups() { return groups; }, get enterForge() { return enterForge; }, get player() { return player; }, get stationPose() { return stationPose; }, set stationPose(v) { stationPose = v; }, get rig() { return rig; }, get interactables() { return interactables; }, get inDungeon() { return inDungeon; }, get skills() { return skills; }, get dojo() { return dojo; } };
export type GearCareDeps = typeof gearCareDeps;
const { gear, GRIND, openSkillsBook, grind, openGear, skillsBook } = setupGearCare(gearCareDeps);
// ---------- B21: the GitHub wiki, pulled at build time, read at the reading room lectern in the Ruined Library ----------   // -> src/app/wiki.ts
const wikiDeps = { get library() { return library; }, get world() { return world; }, get state() { return state; }, get enterForge() { return enterForge; }, get leaveForge() { return leaveForge; }, get interactables() { return interactables; }, get inDungeon() { return inDungeon; }, get phrasebook() { return phrasebook; }, get trapHit() { return trapHit; }, get sideGate() { return sideGate; }, get sideGo() { return sideGo; }, get openDescend() { return openDescend; }, get dungeon() { return dungeon; }, get delves() { return delves; }, get descent() { return descent; }, get exitDungeon() { return exitDungeon; }, get goDown() { return goDown; }, get toast() { return toast; }, get imbued() { return imbued; }, get delveHp() { return rolledGoblinsM.delveHp; }, set delveHp(v) { rolledGoblinsM.delveHp = v; }, get DELVE_HP() { return DELVE_HP; }, get gear() { return gear; }, get inventory() { return inventory; }, get gesture() { return gesture; }, get companion() { return companion; }, get saveDelves() { return saveDelves; }, get hint() { return hint; }, get keyName() { return keyName; }, get dropLoreBook() { return dropLoreBook; } };
export type WikiDeps = typeof wikiDeps;
const { wiki, shrineLines, openPhrasebook, openWiki } = setupWiki(wikiDeps);
const barksDeps = { get pets() { return pets; }, get state() { return state; }, get player() { return player; }, get cap() { return cap; }, get inDungeon() { return inDungeon; }, get goblins() { return goblins; }, get toast() { return toast; }, get dungeon() { return dungeon; }, get delves() { return delves; }, get questProps() { return questProps; }, get quest() { return quest; }, get companion() { return companion; } };
export type BarksDeps = typeof barksDeps;
const { barkTick, petSense } = setupBarks(barksDeps);
const townStationsDeps = { get canvas() { return canvas; }, get state() { return state; }, get weaponForge() { return weaponForge; }, get characterForge() { return characterForge; }, get player() { return player; }, get forgePreview() { return forgePreview; }, get interactables() { return interactables; }, get world() { return world; }, get openCharacterForge() { return openCharacterForge; }, get openSketchbook() { return openSketchbook; }, get inventory() { return inventory; }, get openWeaponForge() { return openWeaponForge; }, get toast() { return toast; }, get leaveForge() { return leaveForge; }, get groups() { return groups; }, get enterForge() { return enterForge; }, get rig() { return rig; }, get record() { return record; }, get hands() { return hands; }, get beforeTorch() { return viewsM.beforeTorch; }, set beforeTorch(v) { viewsM.beforeTorch = v; }, get gesture() { return gesture; }, get inDungeon() { return inDungeon; }, get openBook() { return openBook; }, get openMap() { return openMap; }, get openDojo() { return openDojo; }, get sleep() { return sleep; }, get autoSave() { return autoSave; }, get WAKE_AT() { return WAKE_AT; }, get campfire() { return campfire; }, get townsfolk() { return townsfolk; } };
export type TownStationsDeps = typeof townStationsDeps;
const { cinema, folkVoices, outOfDoor, smithShop, reelScreen, turnWeapon, ambience, rockPiles, townAct, shop, openShop, smithCounter, openCinema } = setupTownStations(townStationsDeps);
const viewsDeps = { get crossbow() { return crossbow; }, get viewBeforeCrossbow() { return viewBeforeCrossbow; }, set viewBeforeCrossbow(v) { viewBeforeCrossbow = v; }, get player() { return player; }, get rig() { return rig; }, get crossbow2() { return crossbow2; }, get sword() { return sword; }, get sword2() { return sword2; }, get $() { return $; }, get hands() { return hands; }, get state() { return state; }, get settings() { return settings; }, get pilotPulse() { return pilotPulse; }, get wantLock() { return wantLock; }, get lockSupported() { return lockSupported; }, set lockSupported(v) { lockSupported = v; }, get requestLock() { return requestLock; }, get show() { return show; }, get expectUnlock() { return expectUnlock; }, set expectUnlock(v) { expectUnlock = v; } };
export type ViewsDeps = typeof viewsDeps;
const viewsM = setupViews(viewsDeps);
const { stepView, setView, syncCrossbowView, showQuick, toggleTorch, currentView, quickSwap, cycleView, shoulderSwap, VIEWS } = viewsM;
const talkDeps = { get inputMode() { return inputMode; }, get companion() { return companion; }, get inDungeon() { return inDungeon; }, get player() { return player; }, get $() { return $; }, get show() { return show; }, get dialogue() { return dialogue; }, get resumePlay() { return resumePlay; }, get rideWagon() { return rideWagon; }, get inventory() { return inventory; }, get world() { return world; }, get quest() { return quest; }, get openFolklore() { return openFolklore; }, get openCasebook() { return openCasebook; }, get setState() { return setState; }, get openFight() { return openFight; }, get startLesson() { return startLesson; }, get lesson() { return candorM.lesson; }, set lesson(v) { candorM.lesson = v; }, get learnMissile() { return learnMissile; }, get openSky() { return openSky; }, get groups() { return groups; }, get gesture() { return gesture; }, get rig() { return rig; }, get expectUnlock() { return expectUnlock; }, set expectUnlock(v) { expectUnlock = v; }, get settings() { return settings; }, get reducedMotion() { return reducedMotion; }, get natalieRoot() { return natalieRoot; }, get greerRoot() { return greerRoot; }, get record() { return record; }, get state() { return state; }, get exitFrame() { return exitFrame; }, get camera() { return camera; }, get updateTarget() { return updateTarget; }, get lookingAt() { return lookingAt; }, get coach() { return coach; }, get lookingAtThing() { return lookingAtThing; }, get libraryHit() { return libraryHit; }, get useLibrary() { return useLibrary; }, get crossbow() { return crossbow; }, get lookDir() { return lookDir; }, get crossbow2() { return crossbow2; } };
export type TalkDeps = typeof talkDeps;
const talkM = setupTalk(talkDeps);
const { toast, talkTo, closeInventory, hint, firstMeet, keyName, activate, openInventory, talkToNatalie } = talkM;
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
    time: world.time, items: [...inventory.counts].filter(([, n]) => n > 0), rest: lastRest,
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
  try { localStorage.removeItem(REGION_KEY); } catch { /* blocked */ }
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
$('pgFriends').addEventListener('click', () => openFriends());
$('pgSkills').addEventListener('click', () => openSkillsBook());   // B19
$('pgRecipes').addEventListener('click', () => openRecipeBook());   // B18
$('pgSelf').addEventListener('click', () => openWhoYouAre());   // B25 / B22: optional; the form now lives at the tailor
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
// ---------- Mike 2026-11-05: four exits, one per side, each to its own map after a load screen ----------   // -> src/app/exits.ts
const exitsDeps = { get world() { return world; }, get addFriends() { return addFriends; }, get regions() { return regions; }, get interactables() { return interactables; }, get portalM() { return portalM; }, get travel() { return travel; }, get openWagon() { return openWagon; }, get toast() { return toast; } };
export type ExitsDeps = typeof exitsDeps;
const { addRegionSpots, loadScreen } = setupExits(exitsDeps);
// ---------- B56 (Mike 2026-11-06): a portal to the modern world, where Mike's friends are ----------   // -> src/app/portal.ts
const portalDeps = { get world() { return world; }, get outFrom() { return outFrom; }, get interactables() { return interactables; }, get sideGate() { return sideGate; }, get inDungeon() { return inDungeon; }, get regions() { return regions; }, get sideGo() { return sideGo; }, get puppets() { return puppets; }, get figureOf() { return figureOf; }, get talkTo() { return talkTo; }, get addRegionSpots() { return addRegionSpots; }, get player() { return player; }, get rig() { return rig; }, get companion() { return companion; }, get natalieRoot() { return natalieRoot; }, get pets() { return pets; }, get atWagon() { return atWagon; }, get placeName() { return placeName; }, get loadScreen() { return loadScreen; }, get toast() { return toast; } };
export type PortalDeps = typeof portalDeps;
const portalM = setupPortal(portalDeps);
const { savedRegion, placeIn, PORTAL, REGION_KEY, travel, addFriends, modernFriends } = portalM;
// ---------- B54 (Mike 2026-11-06): the wagon between Aralon and the far maps; friends at the stop ride along ----------   // -> src/app/wagon.ts
const wagonDeps = { get world() { return world; }, get player() { return player; }, get companion() { return companion; }, get natalieRoot() { return natalieRoot; }, get pets() { return pets; }, get interactables() { return interactables; }, get regions() { return regions; }, get inDungeon() { return inDungeon; }, get portalM() { return portalM; }, get friends() { return friends; }, get remotes() { return remotes; }, get talkTo() { return talkTo; }, get travel() { return travel; }, get state() { return state; }, get tooBigForRoad() { return tooBigForRoad; }, get gateOpen() { return gateOpen; }, set gateOpen(v) { gateOpen = v; }, get $() { return $; }, get snapshot() { return snapshot; }, get toMenu() { return toMenu; }, get leaveForge() { return leaveForge; }, get gateNo() { return gateNo; }, get setState() { return setState; }, get forgeAuthor() { return forgeAuthor; }, get openEditor() { return openEditor; }, get wiki() { return wiki; }, get show() { return show; }, get pauseGroup() { return pauseGroup; }, get reader() { return reader; }, get readerDesk() { return readerDesk; }, get lecternDesk() { return lecternDesk; }, get fightMode() { return fightMode; }, get sky() { return sky; }, get closeForges() { return closeForges; }, get closeEditor() { return closeEditor; }, get intro() { return intro; }, get telling() { return telling; }, get campfire() { return campfire; }, get quick() { return quick; }, get pauseBack() { return pauseBack; }, get nudge() { return nudge; }, get pauseFrom() { return pauseFrom; }, get lockSupported() { return lockSupported; }, get wantLock() { return wantLock; } };
export type WagonDeps = typeof wagonDeps;
const { focusMenu, extras, exitCheck, wagonStop, placeName, rideWagon, openWagon, atWagon, whatsNew, menuInput, panelInput, versionNote, TOWN_WAGON } = setupWagon(wagonDeps);
// ---------- touch + gamepad ----------

// ---------- Mike 2026-11-05: the knight frame, a pilotable rune mech (src/mech/frame.ts) ----------   // -> src/app/knightFrame.ts
const knightFrameDeps = { get player() { return player; }, get world() { return world; }, get interactables() { return interactables; }, get inDungeon() { return inDungeon; }, get regions() { return regions; }, get toast() { return toast; }, get groups() { return groups; }, get crossbow() { return crossbow; }, get equip() { return equip; }, get handDown() { return handDown; }, get syncAim() { return syncAim; }, get torch() { return torch; }, get toggleTorch() { return toggleTorch; }, get currentView() { return currentView; }, get setView() { return setView; }, get inputMode() { return inputMode; }, get state() { return state; }, get goblins() { return goblins; }, get dust() { return dust; }, get reader() { return reader; }, get book() { return book; }, get begin() { return begin; }, get pause() { return pause; }, get closePauseMenu() { return closePauseMenu; }, get resumePlay() { return resumePlay; }, get activate() { return activate; }, get lookingAt() { return lookingAt; }, get promptVerb() { return promptVerb; }, get openMap() { return openMap; }, get openCasebook() { return openCasebook; }, get dialogue() { return dialogue; }, get closeInventory() { return closeInventory; }, get openInventory() { return openInventory; }, get fire() { return fire; }, get handButton() { return handButton; }, get hands() { return hands; }, get inventory() { return inventory; }, get sword() { return sword; }, get quickSwap() { return quickSwap; }, get toggleRun() { return toggleRun; }, get cycleView() { return cycleView; }, get shoulderSwap() { return shoulderSwap; }, get stepView() { return stepView; }, get equipSword() { return equipSword; }, get showQuick() { return showQuick; }, get intro() { return intro; }, get extras() { return extras; }, get gateOpen() { return gateOpen; }, get telling() { return telling; }, get quick() { return quick; }, get whatsNew() { return whatsNew; }, get wiki() { return wiki; }, get campfire() { return campfire; }, get menuInput() { return menuInput; }, get weaponForge() { return weaponForge; }, get turnWeapon() { return turnWeapon; }, get characterForge() { return characterForge; }, get panelInput() { return panelInput; }, get gear() { return gear; }, get readerDesk() { return readerDesk; }, get lecternDesk() { return lecternDesk; }, get isFighter() { return isFighter; }, get isMage() { return isMage; }, get isMonk() { return isMonk; }, get lockOn() { return lockOn; }, get castMissile() { return castMissile; }, get technique() { return technique; }, get breathe() { return breathe; }, get rig() { return rig; }, get setMode() { return setMode; }, get settings() { return settings; }, get syncGlyphs() { return syncGlyphs; }, get $() { return $; } };
export type KnightFrameDeps = typeof knightFrameDeps;
const { gamepad, touch, pilotHand, knight, pilotPulse, exitFrame, tooBigForRoad, frameExit, enterFrame, wakeFrame } = setupKnightFrame(knightFrameDeps);
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
  if (['Tab', 'AltLeft', 'AltRight', 'Space', 'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(e.code) && !['pause', 'editor', 'forge'].includes(state) && !typing) e.preventDefault();
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
  if (state === 'forge') {
    if (e.code === 'Escape' && !e.repeat) closeForges();
    else if (weaponForge.isOpen && e.code.startsWith('Arrow')) turnWeapon(e.code === 'ArrowLeft' ? -0.15 : e.code === 'ArrowRight' ? 0.15 : 0, e.code === 'ArrowUp' ? -0.1 : e.code === 'ArrowDown' ? 0.1 : 0);   // Mike 2026-11-05
    return;
  }
  if (state === 'dialogue') { if (!e.repeat) dialogue.handleKey(e.code); return; }   // F3.3: movement frozen
  if (state === 'inventory') { if (!e.repeat && ['KeyI', 'Tab', 'Escape'].includes(e.code)) closeInventory(); return; }
  if (state === 'pause' && e.code === 'Escape' && (!lockSupported || !wantLock())) { closePauseMenu(); return; }
  if (state !== 'play') return;
  if (actionFor(e.code, ['torch']) && !e.repeat) { toggleTorch(); return; }   // v0.04
  if (isFighter() && !e.repeat) {   // Mike 2026-11-06: a Fighter's techniques and breath
    if (actionFor(e.code, ['lunge'])) { technique('lunge'); return; }
    if (actionFor(e.code, ['sweep'])) { technique('sweep'); return; }
    if (actionFor(e.code, ['breath'])) { breathe(); return; }
  }
  if (isMage() && !e.repeat && actionFor(e.code, ['lunge'])) { castMissile(); return; }   // B4: the Mage casts on the same key
  if (isMonk() && !e.repeat && actionFor(e.code, ['lunge'])) { lockOn(); return; }   // B5: the Monk locks on
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
window.addEventListener('pointerdown', (e) => { if (e.pointerType === 'mouse') setMode('mouse'); else if (e.pointerType === 'touch') setMode('touch'); });
// Mike 2026-11-04: every button buzzes under a finger, not just the touch HUD's (which buzz from src/input/touch.ts):
// menus, panels, chips, toggles and sliders. Same short "tap" as the HUD.
const TAPPABLE = 'button, [role="button"], .chip, a[href], select, label.check, input[type="checkbox"], input[type="radio"], input[type="range"], summary';
window.addEventListener('pointerdown', (e) => {
  if (e.pointerType !== 'touch') return;
  const t = e.target as HTMLElement | null;
  const hit = t?.closest?.(TAPPABLE) as HTMLElement | null;
  if (!hit || hit.closest('.t-btn') || (hit as HTMLButtonElement).disabled) return;
  haptics.play('tap');
});   // B32: a touch after a key press brings the touch buttons back
window.addEventListener('mousedown', (e) => {
  if (state !== 'play') return;
  if (e.button === 0) {
    mouseHeld = true;
    cursor.downX = e.clientX; cursor.downY = e.clientY; cursor.dragged = false;
    if (wantLock() && lockSupported && !document.pointerLockElement && e.target === canvas) void requestLock();   // first person: a click takes the pointer
    // F4.1 LMB fires; v0.08 LMB swings; Mike 2026-11-05: LMB is the right hand
    if ((player.piloting || hands.held.right !== 'none' || crossbow.equipped) && (e.target === canvas || document.pointerLockElement)) handButton('right', true);
  }
  if (e.button === 2) { rightHeld = true; handButton('left', true); }   // RMB: the left hand (aims with it empty); in the follow view RMB-drag turns the camera
});
window.addEventListener('mouseup', (e) => {
  if (e.button === 0) {
    mouseHeld = false;
    // S1: a click (not a drag) on something within reach uses it.
    handButton('right', false);
    if (state === 'play' && !player.piloting && e.target === canvas && player.thirdPerson && !crossbow.equipped && !sword.equipped && !sword2.equipped && !cursor.dragged && hovering) activate();
  }
  if (e.button === 2) { rightHeld = false; handButton('left', false); }
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
setupSettingsMenu({ settings, camera, setView, VIEWS, inputMode, touch, applyQuality, applyRenderScale, syncForest, post: () => post, world, nightLights, LIGHTS, autoQ, audio });   // src/ui/settingsMenu.ts

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
  if (!lookingAt && (crossbow.boltAt(player.eyePos, lookDir, controls.activateRange) || crossbow2.boltAt(player.eyePos, lookDir, controls.activateRange))) lookingAt = 'bolt';   // F4.4
  if (!lookingAt && Thrower.rocks.length && Thrower.rockAt(player.eyePos, lookDir, controls.activateRange)) lookingAt = 'rock';
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
const stChest = new THREE.Vector3();
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
  if (sky.isOpen) {   // a sky run draws its own scene with its own camera; the world waits underneath
    sky.update(dt);
    sky.render(renderer);
    const ms = performance.now() - t0;
    perf.frames++; perf.cpuMs += ms; perf.worstMs = Math.max(perf.worstMs, ms);
    if (perfHud) perfTick(now, ms);
    return;
  }
  if (firstMeet.active) firstMeet.update(dt, [...(navigator.getGamepads?.() ?? [])].some((p) => p?.buttons.some((b) => b.pressed)));   // B50
  if (descendCine.active) descendCine.update(dt, [...(navigator.getGamepads?.() ?? [])].some((p) => p?.buttons.some((b) => b.pressed)));
  if (waking) {   // B31: the get-up runs its course, or any pad button skips it
    waking = state === 'play' ? waking - dt : 0;
    const pad = [...(navigator.getGamepads?.() ?? [])].some((p) => p?.buttons.some((b) => b.pressed));
    if (waking <= 0 || pad) endWake();
  }
  syncCrossbowView();
  if (state === 'play') {
    simAcc += dt;
    while (simAcc >= SIM_STEP) {
      if (!waking && !descendCine.active) player.update(SIM_STEP); simAcc -= SIM_STEP; perf.simSeconds += SIM_STEP;   // B31: no moving while getting up
      // A7: footsteps while actually moving (not just holding a speed modifier) and not sneaking.
      const moving = MOVE_ACTIONS.some((a) => player.held.has(a)) || Math.hypot(player.analog.x, player.analog.y) > 0.05;
      if (moving && !player.sneaking) {
        stepTimer -= SIM_STEP;
        if (stepTimer <= 0) { audio.footstep(); if (purse.crowns > 0 && ++purseSteps % 3 === 0) audio.coins(1); stepTimer = 2.2 / Math.max(1, player.speed()); if (player.thirdPerson && player.speed() > controls.speeds.walk) dust.burst(footAt()); }
      } else stepTimer = 0;
    }
    if (knight.piloted) { knight.root.position.copy(player.pos); knight.root.rotation.y = player.bodyYaw + Math.PI; }
    knight.update(dt, knight.piloted ? player.hSpeed : 0);
    rig.update(dt);   // R3: camera follows this frame's simulation before anything aims along it
    updateTarget();
    if (player.piloting) { lookingAt = 'thing'; lookingAtThing = frameExit; }
    show('prompt', lookingAt !== null);
    const verb = lookingAt === 'natalie' ? 'Talk to Natalie' : lookingAt === 'bolt' ? 'Pick up bolt' : lookingAt === 'rock' ? 'Pick up rock' : lookingAt === 'thing' ? lookingAtThing!.verb()
      : lookingAt === 'library' && libraryHit ? libraryVerb(libraryHit) : 'Read';
    const shownVerb = t(verb); if (promptVerb.textContent !== shownVerb) promptVerb.textContent = shownVerb;   // B23
    crossbow.update(dt); crossbow2.update(dt);
    // B41: auto-lean while aiming at a wall edge, or over low cover when crouched (Settings > Gameplay).
    player.leanWant = settings.autoLean && !rig.inShot ? leanTarget(world.colliders, player.pos.x, player.pos.z, player.pos.y, player.yaw,
      { aiming: crossbow.ads, crouched: player.sneaking, speed: player.hSpeed, eye: player.eyeHeight, stand: controls.eyeHeight }) : NO_LEAN;
    if (crossbow.equipped && !player.thirdPerson && !rig.inShot && !rig.switching) crossbow.applySway();   // B44
    updateSteadyRing();
    updateLesson();
    updateFighter(dt);
    missile.update(dt);
    floating.update(clock.elapsedTime);
    magic.update(clock.elapsedTime);
    sword.update(dt); sword2.update(dt);
    touch?.update();
    coach.update(inputMode, player.pos, player.yaw, lookingAt !== null, !inDungeon);
    if (bestiary) goblins.idle(dt);
  } else { lookingAt = null; crossbow.setADS(false); handDown.left = handDown.right = false; player.leanWant = NO_LEAN; rig.update(dt); updateSteadyRing(); $('coach').classList.add('hidden'); }
  if (welcomePending && !waking && state === 'play' && inWorld && !inDungeon && wakeIntro()) campWelcome();
  firstDay.update(dt, { waking: waking > 0, reading: state === 'book', writing: sketchPad.isOpen, making: characterForge.isOpen || weaponForge.isOpen, atFire: campfire.isOpen }, state === 'play' && inWorld && !inDungeon);
  // v0.06 T3: the ears are at the player's eyes, facing where the camera looks.
  camera.getWorldDirection(earDir);
  audio.setListener(player.eyePos.x, player.eyePos.y, player.eyePos.z, earDir.x, earDir.z);
  panelShift(dt);
  nightLights.update(dt, player.pos.x, player.pos.z, clock.elapsedTime, camera);
  ambience.on = state !== 'title' && !inDungeon;
  if (ambience.on) ambience.update(dt); else ambience.stopAll();
  gear.update(dt); cook.update(dt); player.buffMul = cook.buff === 'quick' ? 1.1 : 1; if (gear.isOpen && gear.job === 'sharpen') grind.wheel.rotation.z += dt * 7;   // B17
  animate(dt);
  updateAmmoHud();
  updateDelve(dt);
  updateSprites(renderer, world.scene, camera, dt);
  // B45: walls between the follow camera and the player open up (the rig no longer pulls in for them).
  rig.seeThrough = settings.seeThrough && !inDungeon;
  // B39: the follow camera leads toward where you walk (by default only for touch and controller players).
  rig.lead = state === 'play' && (settings.cameraLead === 'on' || (settings.cameraLead === 'auto' && inputMode !== 'mouse'));
  renderer.getDrawingBufferSize(outlineUniforms.outlineRes.value);   // G2: outline width in real pixels
  camera.updateMatrixWorld();
  updateSeeThrough(rig.seeThrough && player.thirdPerson && state === 'play', camera, stChest.copy(player.pos).setY(player.pos.y + 1.1));
  updateFigureSun(camera);   // cel shading: the characters' light bands follow the sun as the camera turns
  post!.render(world.scene, camera);
  if (forgePreview.active && weaponForge.isOpen) forgePreview.render(renderer, forgePreviewRect());
  const ms = performance.now() - t0;
  perf.frames++; perf.cpuMs += ms; perf.worstMs = Math.max(perf.worstMs, ms);
  if (perfHud) perfTick(now, ms);
}
// B38: an on-screen frame-time readout for measuring on a real phone. Add ?perf to the address (or set
// localStorage gametool.perf = 'on'). Twice a second: frames per second, frame-to-frame ms, CPU ms, draw calls.
const perfHud: HTMLDivElement | null = (() => {
  let on = new URLSearchParams(location.search).has('perf');
  try { on ||= localStorage.getItem('gametool.perf') === 'on'; } catch { /* storage blocked */ }
  if (!on) return null;
  const d = document.createElement('div'); d.id = 'perfHud'; document.body.appendChild(d);
  return d;
})();
let perfWin = { at: 0, frames: 0, gap: 0, cpu: 0, prev: 0 };
function perfTick(now: number, cpu: number) {
  const w = perfWin;
  if (w.prev) { w.gap += now - w.prev; w.frames++; w.cpu += cpu; }
  w.prev = now;
  if (now - w.at < 500 || !w.frames) return;
  const info = renderer.info.render;
  perfHud!.textContent = `${Math.round(1000 * w.frames / (now - w.at))} fps · ${(w.gap / w.frames).toFixed(1)} ms · cpu ${(w.cpu / w.frames).toFixed(1)} ms · ${info.calls} calls · ${Math.round(info.triangles / 1000)}k tris · ${settings.preset}`;
  perfWin = { at: now, frames: 0, gap: 0, cpu: 0, prev: now };
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
  enableSeeThrough(world.scene);   // B45: before compiling, so the cut is in the first shaders
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
// Mike 2026-11-06 (Graphics thread, "All"): the Ruined Library looks its age (src/world/ruin.ts). Built last, so it
// keeps clear of everything you use in the hall: interactables, lore targets and the trapdoor.
const ruinKeep: Keep[] = [
  ...interactables.map((i) => { const p = i.obj.getWorldPosition(new THREE.Vector3()); return { x: p.x, z: p.z, r: 1.4 }; }),
  ...library.targets.map((t) => { const p = t.getWorldPosition(new THREE.Vector3()); return { x: p.x, z: p.z, r: 0.9 }; }),
  { x: STAIRS.x, z: STAIRS.top - STAIRS.len / 2, r: 3.6 },
];
const ruinFloor = new Floor(world.colliders, ruinKeep);
const floating = buildFloatingStones(world.scene, world.heightAt);   // Mike 2026-11-06: the magic of the place
const flood = buildFlood(library.group, ruinFloor);   // first: the pools keep fires and beds out of the water
const ruin = buildRuin(library.group, world.colliders, ruinFloor);
const wallBooks = buildWallBooks(library.group);
const goblinSigns = buildGoblinSigns(library.group, world.colliders, ruinFloor);
const goblinLife = buildGoblinLife(library.group, world.colliders, ruinFloor);
const quadPlants = buildQuadPlants(library.group, world.scene, ruinFloor, libraryHoles());
const magic = buildRareMagic(library.group, ruinFloor, libraryHoles(), floating.stones);   // Mike 2026-11-06: "occasional magic", rare and quiet
Object.assign(window, { __gametool: { ruin, ruinFloor, wallBooks, knight, enterFrame, exitFrame, wakeFrame, friends, openFriends, remotes, applyQuality, dm, talkToNatalie, natalieSawCreation, get state() { return state; }, get lookingAt() { return lookingAt; }, get lookingAtVerb() { return lookingAtThing?.verb() ?? null; }, get inputMode() { return inputMode; }, get character() { return character; }, dailyPrompt, dialogue, inventory, crossbow, crossbow2, hands, sword2, torch2, shield, shield2, blockBlow, handButton, thrower, thrower2, Thrower, rockPiles, reader, library, modelsReady, loadedModels, failedModels, animators, puppets, characterForge, weaponForge, forgePreview, openCharacterForge, openWeaponForge, interactables, sword, gear, openGear, cook, recipeBook, openRecipeBook, get sturdy() { return cookingM.sturdy; }, sketchPad, openSketchbook, lecternDesk, readerDesk, quest, questProps, companion, dog, pets, petPrefs, petsPanel, callPet, casebook, firstDay, folklore, pedlarHit, campfire, openCampfire, telling, get satAtFire() { return campfireM.satAtFire; }, readRedBook: () => townAct.library(), get stationPose() { return stationPose; }, get waking() { return waking; }, fightMode, openFight, talkToKavik, monkDeck: monkDeckM, deckKit: { loadDecks, cleanDecks, starterSlots, deckStrings, witness, endStance, STAMINA, MOVES: FIGHT_MOVES, DECK_KEY, DECK_MAT }, candorHit, startLesson, get lesson() { return candorM.lesson; }, archery, sky, openSky, perch, skyFolk, gesture, figureLight, seeThroughUniforms, outlineUniforms, get charsCulled() { return charsCulled; }, get idleSit() { return idleSit; }, get lastRest() { return lastRest; }, wakeUp, endWake, get stationView() { return stationView; }, weaponDisplay, gallery, refreshGallery, openReader, dungeon, enterDungeon, exitDungeon, quick, openQuick, buildQuick, openDescend, get inDungeon() { return inDungeon; }, delves, get delveRun() { return delveRewardsM.run; }, killStatue, kills, firstMeet, descendCine, greerRoot, get descent() { return descent; }, record, startDescent, goDown, heroFalls, scrollPicker, applyScrolls, patronGifts, dropLoreBook, applyFlux, get fluxNow() { return descentFlowM.fluxNow; }, descentRules: { fluxFor, isCamp }, innWalls, lastWords, innBoards, regions, travel, loadScreen, get travelling() { return portalM.travelling; }, natalieRoot, livingMap, openMap, dojo, openDojo, caravan, caravanFolk, openCaravan, teahouse, teaFolk, openTeahouse, palengke, marketFolk, openPalengke, phrasebook, openPhrasebook, skills, openSkills, skillsBook, openSkillsBook, wiki, openWiki, townsfolk, crowd, ambience, nightLights, ceilings, autoQ, forestCards, ROOFED, figureKit: { buildFigure, FigureAnim, faceExpression }, goblins, traits: { rollGoblin, describeGoblin, goblinStats, roll, seedOf, rollTownsfolkLook: (seed: number) => rollTownsfolk(seed).look }, get delveHp() { return rolledGoblinsM.delveHp; }, get lastHint() { return talkM.lastHint; }, hint, purse, wear, tollBell, coach, get autosaves() { return autosaves; }, townAct, set delveHp(n: number) { rolledGoblinsM.delveHp = n; }, spawnGoblins, get stationery() { return stationery; }, setStationery, shop, openShop, smithShop, smithCounter, itemCard, openInventory, earn, cinema, openCinema, get intro() { return intro; }, extras, quitToMenu, get gateOpen() { return gateOpen; }, binds, menuInput, camera, Box3: THREE.Box3, Raycaster: THREE.Raycaster, Vector3: THREE.Vector3, player, rig, book, renderer, world, perf, settings, audio, haptics, torch, lockSupported: () => lockSupported, fighterKit, technique, breathe, techLog, missile, castMissile, learnMissile, lockOn, lockTarget, get duel() { return monkM.duel; }, goblinSigns, goblinLife, stairwell, STAIRS, quadPlants, flood, floating, magic, floorLeader, get partyRun() { return multiplayerM.partyRun; }, portal: PORTAL, modernFriends, MODERN_FRIENDS, coinTable, COIN_AT, openCoinTable, groups, TOWN_WAGON, openWagon, rideWagon, wagonStop, STAIRS_TIME, get stairsLeft() { return descent?.stairsLeft; }, set stairsLeft(n: number | undefined) { if (descent) descent.stairsLeft = n; }, i18n: { getLang, setLang, t }, morph: { SPEC_V, MORPHS, SLOTS, CATALOG, defaultSpec, validateSpec, randomCharacterSpec, specKey, partCache, PartCache, RIG, assemble, updateLod, disposeCharacter, LOD_DIST, baseBody, outfitCount, specFromRoll } } });
