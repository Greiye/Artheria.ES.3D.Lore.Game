import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import './render/grade';   // style pass 1: global colour grade (patches a shader chunk, so it must load first)
import { updateSprites, setSpriteCharacters, faceExpression } from './render/sprites';
import './style.css';
import { buildWorld } from './world';
import { buildFigure, figureLight, updateFigureSun, GOTHIC_LOOK, type FigureLook } from './world/figure';
import { enableSeeThrough, updateSeeThrough, seeThroughUniforms } from './render/seeThrough';
import { outlineUniforms, setOutlines } from './render/outline';
import { Player } from './player';
import { Book } from './book';
import { lore, entryById } from './lore';
import { buildLibrary, type LibraryHit } from './library';
import { setLinkResolver } from './markdown';
import greyBooks from '../content/rolltables/grey-books.json';
import { controls, actionFor, binds, REBINDABLE, bindKey, resetKeys, keyLabel, type Action } from './controls';
import { loadSettings, saveSettings, flushSettings, PRESETS, isLowPreset, type Preset, type FpsCap, type View } from './settings';
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
import { SHELL_HTML } from './ui/shell';
import { buildCinemaSpot } from './world/cinema-spot';
import { renderPadMap } from './input/padmap';
import { townZones, FolkVoices } from './world/soundscape';
import { station, closeAllStations } from './stations';
import { CameraRig, OVERHEAD, type Shot } from './camera/rig';
import { fillSlots, loadedModels, failedModels, animators, type ModelSlot, type AnimState } from './models';
import { FigureAnim, BodyAnim, type AnimInput, type Pose, type Gesture } from './anim/procedural';
import { Dust } from './fx/dust';
import { activeSlot, slotInfo, slotLabel } from './profiles';
import { CharacterForge, loadForge, type ForgeCharacter } from './forge/character';
import { attachItemCards } from './ui/itemcard';
import { WeaponForge, loadWeapon, type WeaponCosmetic, type SwordCosmetic } from './forge/weapon';
import { ForgePreview } from './forge/preview';
import { MarginDesk, loadStationery, saveStationery, applyStationery, loadMargins, type Stationery } from './writing/margins';
import { SketchPad, sketchById, DEFAULT_SKETCH, type Sketch } from './writing/sketch';
import { stampBanner, buildBookmarks } from './writing/stamps';
import { QUEST, loadQuest, saveQuest, clueById, support, ending, tagLabel, type Theory } from './quest/quest';
import { Casebook } from './quest/casebook';
import { FirstDay } from './quest/firstday';
import { gatherPortfolio } from './portfolio';
import { QuestProps } from './quest/props';
import { Companion, loadCompanion, saveCompanion } from './quest/companion';
import { Pet, loadPets, SPECIES, type PetId, type PetPrefs } from './pets/pet';
import { PetsPanel } from './pets/panel';
import { FolklorePanel, folkItems, pedlarScript } from './quest/folklore';
import { CampfirePanel } from './campfire/campfire';
import { QuickDungeon, buildQuick } from './dungeon/quick';
import { TellingView } from './campfire/telling';
import { loadBallads, balladEntry, decodeTune, SCALE, type Ballad } from './campfire/ballad';
import { Gallery, GALLERY, type Exhibit } from './campfire/gallery';
import { buildCeilings, roofOver, ROOFED } from './world/ceilings';
import { buildDojo, DojoPanel, DOJO } from './dojo/dojo';
import { FightMode } from './fight/mode';
import { SkyRun } from './sky/mode';
import { buildPerch, PERCH } from './sky/perch';
import type { Fighter } from './fight/engine';
import { pushupCardHtml } from './dojo/card';
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
import { rollTownsfolk } from './traits/townsfolk';
import { dailySeed } from './dungeon/gen';
import { LivingMap, type Mark } from './map/livingmap';
import { haptics } from './input/haptics';
import { leanTarget, NO_LEAN } from './lean';
import { Crowd, CROWD_FULL, CROWD_LOW } from './world/crowd';
import { Torch } from './torch';
import { Hands, HAND_LABEL, isMelee, isThrow, type Hand, type HandItem } from './hands';
import { Thrower } from './sling';
import { Shield, BLOCK_ARC, BLOCK_LEAK, buildShield } from './shield';
import { HeldBook } from './heldBook';
import { ShopPanel, CROWN } from './shop';
import { CinemaPanel } from './cinema';
import { TOWN_NAMES, GATE, FOUNTAIN, TOWN_LOTS, type TownId } from './world/town';
import { Regions, REGIONS, TOWN_EXITS, signpost, type RegionId, type Side } from './world/regions';
import { LoadScreen } from './ui/loadscreen';
import { FLOORS, band, BAND_NOTE, budgetFor, hpMul, dmgBonus, countFor, maxFoesFor, newDescent, loadRecord, saveRecord, addFallen, addSurvivor, isCamp, fluxFor, FLUX_NOTE, GUARDIAN_NAMES, carryOff, gearNear, GIFTS, hasGift, KITS, type Descent, type Flux, type LostGear } from './delve/descent';
import { InnWalls, LastWords, buildInnBoards } from './delve/walls';
import { ScrollPicker, offerScrolls, scrollById, type ScrollSlot } from './delve/scrolls';
import { KillStatue, loadKills, saveKills, plaqueText } from './world/statue';
import { FirstMeeting, metNatalie } from './cinematic/firstmeet';
import { DmView, type Place } from './dm/dm';
import { watchPanels, setPanelTab } from './ui/fit-panel';
import { riverClear } from './world/river';
import { plantForestCards } from './world/treeCards';
import { Townsfolk } from './world/townsfolk';
import { NightLights } from './world/nightlights';
import { Ambience } from './ambience';
import { Intro } from './intro';
import { Extras } from './extras';
import { WhatsNew } from './whatsnew';
import { loadGame, saveGame, clearGame } from './save';
import { NEXT_TIME, type TimeOfDay } from './world/sky';
import { glyph } from './input/glyphs';
import { topPanel, padMove, padNudge, padPress, padBack, type PadDir } from './input/padnav';
import { storeSet } from './store';
import { FriendsPanel } from './net/panel';
import { cleanCode, cleanName, MAX_PLAYERS, type Room } from './net/room';
import { Remote, packState, SEND_HZ } from './net/remotes';
import { packLook } from './net/look';
import { EMOTES, emoteAt, Bubble } from './net/emotes';
import './ui/parchment.css';   // UI 1: parchment panels, loaded last so it skins every panel
import './ui/ribbon.css';   // UI 2: green ribbon titles with gold lettering
import './ui/readable.css';   // UI 3: larger text in the sheets, sized for phones

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

document.addEventListener('pointerlockchange', () => {
  if (document.pointerLockElement === canvas) return;
  if (expectUnlock) { expectUnlock = false; return; }
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
  lastRest = save?.rest ?? 'inn';
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
  if (firstDayOn()) firstDay.begin(!save);      // B36: a new profile's first day (or the rest of one)
  if (inviteCode) { const c = inviteCode; inviteCode = null; setTimeout(() => { if (state === 'play' && !friends.room) openFriends(c); }, 600); }
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
inventory.hands = { label: (h) => HAND_LABEL[hands.held[h]], cycle: (h) => { hands.cycle(h); if (h === 'left') beforeTorch = 'none'; } };
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
// B44: the steadiness ring replaces the crosshair while the crossbow is in hand in first person.
const steadyRing = $('steady');
let steadyShown = false;
function updateSteadyRing() {
  const on = state === 'play' && crossbow.equipped && !player.thirdPerson;
  if (on !== steadyShown) { steadyShown = on; steadyRing.classList.toggle('hidden', !on); document.body.classList.toggle('steadyAim', on); }
  if (!on) return;
  const s = crossbow.stability;
  steadyRing.style.transform = `scale(${(0.3 + 0.7 * (1 - s)).toFixed(3)})`;
  steadyRing.classList.toggle('steady', s > 0.85);
}
// Mike 2026-11-05: each hand's button uses what that hand holds: LMB / RT / Fire = right hand, RMB / LT / Aim = left
// hand. A crossbow fires and a sword swings. A hand holding nothing (or a torch) aims the crossbow while its button is
// held, as RMB always has. Two crossbows can't aim down the sights. With two swords, pressing a hand whose sword is
// mid-cut lets the other hand cut, so one button mashed alternates the blades.
const handDown: Record<Hand, boolean> = { left: false, right: false };
function handButton(h: Hand, down: boolean) {
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
  if (on && !hands.set('right', 'crossbow')) { toast('You have no crossbow yet.', 1800); return; }
  if (!on) { if (hands.held.right !== 'torch') hands.set('right', 'none'); const l = hands.held.left; if (isMelee(l) || isThrow(l) || l === 'crossbow') hands.set('left', 'none'); }
}
function equipSword() {
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
  if (quickTimer > 0 && (quickTimer -= dt) <= 0) $('quick').classList.add('hidden');
  if (player.vaults !== lastVaults) { lastVaults = player.vaults; haptics.play('jump'); }
  const rm = crossbow.reload.active ? crossbow.reload.mode : null;   // v0.04: feel the reload start and a jam
  if (rm !== lastReload) { if (rm === 'jam') haptics.play('jam'); else if (rm === 'normal') haptics.play('reload'); lastReload = rm; }
  dust.update(dt, camera);
  const idleNow = state === 'play' && !inDungeon && !waking && player.hSpeed < 0.05 && !player.airborne && !stationPose && !dojo.pose
    && !crossbow.equipped && !sword.equipped && !sword2.equipped && !MOVE_ACTIONS.some((a) => player.held.has(a)) && Math.hypot(player.analog.x, player.analog.y) < 0.05;
  idleSitT = idleNow ? idleSitT + dt : 0;
  idleSit = idleNow && idleSitT > SIT_AFTER;
  syncFight(dt);
  const fighting = fightMode.isOpen;
  const mine: AnimInput = fighting ? fightInput(fightMode.fight.a) : {
    speed: state === 'play' ? player.hSpeed : 0, talking: state === 'dialogue', aiming: crossbow.equipped,
    ...swordAnim(),
    airborne: player.airborne, landed, pose: dojo.pose ?? stationPose ?? (state === 'book' ? 'read' : idleSit ? 'sitground' : null),
    look: { yaw: wrapAngle(player.yaw - player.bodyYaw), pitch: -player.pitch * 0.6 }, lean: player.lean.side,
  };
  sword.held.visible = sword.equipped && !mine.pose;   // put away at a station or a drill
  sword2.held.visible = sword2.equipped && !mine.pose;
  shield.update(dt, !player.thirdPerson && !rig.inShot, !!mine.pose); shield2.update(dt, !player.thirdPerson && !rig.inShot, !!mine.pose);
  thrower.update(dt, !player.thirdPerson && !rig.inShot, !!mine.pose); thrower2.update(dt, !player.thirdPerson && !rig.inShot, !!mine.pose);
  Thrower.fly(dt, world.solids, (x, z) => player.terrain(x, z), rockTargets);
  // B38: characters are skinned, so three can't frustum-cull them. Off-screen ones, or ones past the fog, aren't
  // drawn and skip their animation (CPU on phones). Their meshes are hidden, never the root (others own that).
  for (const r of remotes.values()) r.update(dt, camera.position);   // other players: smooth toward their last state (multiplayer 2)
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
      if (!show) { charsCulled++; continue; }
    }
    const remote = id.startsWith('net:') ? remotes.get(id.slice(4)) : undefined;
    const input = id === 'player' ? (player.body.visible ? mine : null) : remote ? (remote.away || remote.far ? null : remote.input)
      : fighting && id === 'kavik' ? fightInput(fightMode.fight.b) : npcInput(id, p.root);
    if (!input) continue;
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
  (c) => { character = { ...character, name: c.name || character.name, ...characterForge.who, created: true }; saveCharacter(character); leaveForge(); },
  loreWords, forgeAuthor));
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
  characterForge.who = { motivation: character.motivation, secret: character.secret };   // B22: "Who you are" lives here now
  characterForge.open(loadForge(character.name));
}
/** B22: the Journal's (and Gameplay's) "Who you are" opens the Tailor & Barber-Surgeon on that tab. */
function openWhoYouAre() {
  setPanelTab('Tailor & Barber-Surgeon', 0);
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
  if (descendSheet) { descendSheet.remove(); descendSheet = null; leaveForge(); }
  closeAllStations((p) => p === wiki && state !== 'forge');   // the wiki is also a reading view from Extras
  if (galleryCard) { galleryCard.remove(); galleryCard = null; leaveForge(); }
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
($('companionQuiet') as HTMLInputElement).checked = companion.prefs.quiet;
$('companionQuiet').addEventListener('change', (e) => { companion.prefs.quiet = (e.target as HTMLInputElement).checked; saveCompanion(companion.prefs); });
// ---------- Pets (Mike 2026-11-04, "Add pets" + "Go"): a dog by the inn, a cat by the store, an owl at the library,
// and Shadow, a giant hedgehog the size of a dog, by the campfire ----------
// Feed one its food and it joins you (one at a time); talk to it after that for the pets page (src/pets/).
const petPrefs = loadPets();
const outFrom = (o: THREE.Object3D, out: number, side: number) => { const ry = o.rotation.y; return new THREE.Vector3(o.position.x + Math.sin(ry) * out + Math.cos(ry) * side, 0, o.position.z + Math.cos(ry) * out - Math.sin(ry) * side); };
const pets = ([
  ['dog', outFrom(world.town.doors.inn, 2.4, 1.8), world.town.doors.inn.rotation.y],
  ['cat', outFrom(world.town.doors.shop, 1.9, -2.2), world.town.doors.shop.rotation.y + 0.6],
  ['owl', new THREE.Vector3(3.6, 0, -16.6), Math.PI * 0.85],   // on the grass by the Ruined Library's steps
  ['hedgehog', world.stations.campfire.position.clone().add(new THREE.Vector3(3.2, 0, 2.4)), -2.2],   // Shadow, snuffling by the campfire
  // Mike 2026-11-04: seven named dogs, each by its own door, and a giant hamster by the Cartographer's.
  ['princess', outFrom(world.town.doors.gallery, 2.2, 1.6), world.town.doors.gallery.rotation.y],
  ['milo', outFrom(world.town.doors.smithy, 2.4, -1.8), world.town.doors.smithy.rotation.y + 0.5],
  ['hotdog', outFrom(world.town.doors.scriptorium, 2.2, 1.7), world.town.doors.scriptorium.rotation.y - 0.4],
  ['brandy', outFrom(world.town.doors.library, 2.6, 2.2), world.town.doors.library.rotation.y],
  ['buster', outFrom(world.town.doors.dojo, 2.6, -1.9), world.town.doors.dojo.rotation.y + 0.3],
  ['peanut', outFrom(world.town.doors.tailor, 2.0, -1.6), world.town.doors.tailor.rotation.y],
  ['kona', outFrom(world.town.doors.inn, 2.2, -1.7), world.town.doors.inn.rotation.y - 0.5],
  ['hamster', outFrom(world.town.doors.cartographer, 2.3, 1.8), world.town.doors.cartographer.rotation.y + 0.4],
] as [PetId, THREE.Vector3, number][]).map(([id, home, ry]) => {
  const p = new Pet(id, world.scene, home, ry, world.colliders, () => player.bounds, petPrefs);
  p.terrain = groundY;
  if (id === 'owl') p.shown = () => world.time !== 'day';   // out from dusk
  return p;
});
const dog = pets[0];
/** Bring a pet with you (sending any other one to wait where it is), or tell it to stay. */
function callPet(p: Pet, on: boolean) {
  if (on) for (const o of pets) if (o !== p && o.following) o.follow(false);
  p.follow(on);
  toast(on ? `${cap(p.label)} ${p.sp.fly ? 'swoops down to your shoulder' : 'bounds over to your side'}.` : `${cap(p.label)} settles down to wait for you here.`, 2200);
}
const cap = (t: string) => t[0].toUpperCase() + t.slice(1);
const petsPanel = station(new PetsPanel(pets, callPet, () => leaveForge()));
for (const p of pets) interactables.push({ obj: p.hit, when: () => (!inDungeon || p.following) && (p.friend || p.shown()),
  verb: () => !p.friend ? (inventory.count(p.sp.food) ? `Give ${p.label} some ${p.sp.foodName}` : p.id === 'owl' ? 'Hold out a hand to the owl' : `Pet ${p.label}`) : `Talk to ${p.label}`,
  act: () => {
    if (!p.friend) {
      const food = ITEMS[p.sp.food]?.name.toLowerCase() ?? p.sp.foodName;
      if (!inventory.take(p.sp.food)) {
        const who = cap(p.label);
        toast(p.sp.kind === 'cat' ? `${who} lets you scratch behind one ear, then looks at your empty hand. The General Store sells ${food}.`
          : p.sp.kind === 'owl' ? `The owl blinks at your empty hand. The General Store sells ${food}.`
            : p.sp.kind === 'hedgehog' ? `${who} huffs at your hand and raises a few spines, then snuffles your pockets for food. The General Store sells ${food}.`
              : p.sp.kind === 'hamster' ? `${who} sniffs your fingers, whiskers going, and stuffs nothing into its cheeks. The General Store sells ${food}.`
                : `${who} sniffs your hand and wags. ${p.name ? 'They look' : 'It looks'} hungry: the General Store sells ${food}.`, 3600);
        return;
      }
      for (const o of pets) if (o.following) o.follow(false);
      p.befriend(); haptics.play('pickup');
      const who = cap(p.label), nm = p.name ? '' : ' Talk to it to give it a name.';
      toast(p.sp.kind === 'cat' ? `${who} eats the fish in three bites and winds round your ankles. It's yours now.${nm}`
        : p.sp.kind === 'owl' ? `${who} takes the jerky from your fingers and settles on your shoulder. It's yours now.${nm}`
          : p.sp.kind === 'hedgehog' ? `${who} crunches through the mealworms, smooths down every spine and trundles after you. ${who} is yours now.`
            : p.sp.kind === 'hamster' ? `${who} crams every seed into its bulging cheeks and waddles after you. ${who} is yours now.${nm}`
              : `${who} wolfs the bread down and trots after you, tail going. ${p.name ? who + ' is' : "It's"} yours now.${nm}`, 4200);
      return;
    }
    enterForge();
    petsPanel.open(p);
  } });
const seen = (() => { try { return JSON.parse(localStorage.getItem('gametool.seen') ?? '[]') as string[]; } catch { return [] as string[]; } })();
function markSeen(id: string) { if (!seen.includes(id)) { seen.push(id); storeSet('gametool.seen', JSON.stringify(seen)); } }
const casebook = station(new Casebook(() => quest, (th: Theory) => {
  quest.theory = th; quest.stage = 'lead'; saveQuest(quest);
  questProps.showLead(th.where);
  companion.say(support(quest, th) >= 2 ? QUEST.natalie.supported : QUEST.natalie.leap, { force: true });
}, () => leaveForge(), loreWords, forgeAuthor));
casebook.owner = () => character.name;
function openCasebook() {
  if (state !== 'play' && state !== 'pause' && state !== 'dialogue') return;
  enterForge();
  casebook.open();
}
const folklore = station(new FolklorePanel(
  () => folkItems([...inventory.counts.keys()].filter((id) => inventory.count(id) > 0), quest.clues, seen, (id) => ITEMS[id]?.name ?? id),
  () => leaveForge(), forgeAuthor));
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
const campfire = station(new CampfirePanel(() => {
  const first = quest.clues[0] ? clueById(quest.clues[0])?.name.toLowerCase() : null;
  return [
    first ? `I remember the ${first}. I didn't want to believe it.` : 'I remember the door, and how quiet it was.',
    quest.theory ? `You said it was ${tagLabel('who', quest.theory.who).toLowerCase()}. I wrote it down.` : 'I was behind you the whole way. Mostly.',
    quest.stage === 'done' && quest.theory ? `And ${ending(quest.theory).friend} came home.` : "And the fire's still going, so it isn't over.",
  ];
}, (b: Ballad) => { toast(`"${b.title}" is on the shelf. Find it in the gallery hall.`, 4000); refreshGallery(); earn(5, 'for a ballad'); }, () => leaveForge(), forgeAuthor));
campfire.owned = () => [...inventory.counts.keys()].filter((id) => inventory.count(id) > 0);   // v0.04 instruments
campfire.onWriteLore = () => openEditor(true);   // v0.04: lore is written at the fire, Natalie holds the quill
// v0.05 §5: Natalie tells a lore page with kinetic type; the fire flares on the emphasised words and the dramatic beats.
const telling = station(new TellingView());
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
const cook = station(new CookPanel(() => { if (state === 'forge') campfire.el.classList.remove('hidden'); }));   // back to the fire
cook.author = () => forgeAuthor();
cook.onLearn = (r) => earn(3, `${r.name} recipe`, 'recipe:' + r.id);
cook.onEat = (b) => { haptics.play('pickup'); toast(`🍽 ${BUFFS[b].name}: ${BUFFS[b].text}`, 3600); };
campfire.onCook = () => { campfire.el.classList.add('hidden'); cook.open(); };
const recipeBook = station(new RecipeBook(cook, () => leaveForge()));
function openRecipeBook() { if (state !== 'play' && state !== 'pause') return; enterForge(); recipeBook.open(); }
let sturdy = false;   // B18: a "well fed" delve
// B36: the first-day guided quest. Natalie points the way; test browsers skip it unless gametool.firstdaytest = 'on'.
const firstDay = new FirstDay(world.scene, {
  write: () => world.town.doors.scriptorium.position,
  make: () => world.town.doors.tailor.position,
  fire: () => world.stations.campfire.position,
}, (text) => { companion.say(text, { force: true, ms: 5200 }); }, (skipped) => { if (!skipped) earn(10, 'for your first day', 'firstday'); });
function firstDayOn() {
  try { return !navigator.webdriver || localStorage.getItem('gametool.firstdaytest') === 'on'; } catch { return !navigator.webdriver; }
}
casebook.extra = () => firstDay.casebookHtml();
casebook.onExtra = (id) => { if (id === 'fdSkip') firstDay.skip(); };
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
  lastRest = onBedroll ? 'camp' : 'inn';   // B31: Continue wakes here
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
/** Start a run at floor 1 (from the trapdoor). */
function startDescent(from = 1) {
  descent = newDescent(from);
  record.runs++; saveRecord(record);
  enterDungeon((Math.random() * 2 ** 31) | 0, from);
  companion.say('Thirty floors, they say. Bring me what you find. Bring yourself back too.', { force: true });
  // F2: the patrons' scroll before the first step.
  const opts = hasGift(record.delivered, 'scroll') ? offerScrolls([], ownsSlot) : [];
  if (opts.length) {
    enterForge();
    scrollPicker.open(opts, from, (sc) => { leaveForge(); if (sc && descent) { (descent.scrolls ??= []).push(sc.id); applyScrolls(); toast(`${sc.name}: ${sc.boon}${sc.curse ? ` Curse: ${sc.curse}` : ''}`, 5200); } });
  }
}
// F1: the witch's scrolls on the top step, each time you go down.
const scrollPicker = station(new ScrollPicker());
const imbued = (id: string) => !!descent?.scrolls?.includes(id);
function ownsSlot(slot: ScrollSlot): boolean {
  const c = (id: string) => inventory.count(id) > 0;
  return slot === 'melee' ? ['sword', 'dagger', 'mace', 'spear'].some(c) : slot === 'crossbow' ? c('crossbow') : slot === 'shield' ? c('shield') || c('buckler')
    : slot === 'throw' ? c('rock') || c('sling') : true;
}
function applyScrolls() {
  Thrower.bonus = imbued('stone') ? 0.6 : 0;
  goblins.booksFirst = imbued('swift');
}
/** Down the stairs in the deepest room: first the scrolls (unless `skipScrolls`), then the next floor behind the load screen. */
function goDown(skipScrolls = false) {
  if (!descent || !inDungeon) return;
  const next = descent.floor + 1;
  if (!skipScrolls) {
    const opts = offerScrolls(descent.scrolls ?? [], ownsSlot);
    if (opts.length) {
      enterForge();
      scrollPicker.open(opts, next, (sc) => {
        leaveForge();
        if (sc && descent) { (descent.scrolls ??= []).push(sc.id); applyScrolls(); toast(`${sc.name}: ${sc.boon}${sc.curse ? ` Curse: ${sc.curse}` : ''}`, 5200); }
        goDown(true);
      });
      return;
    }
  }
  const B = band(next), flux = fluxFor(next, record.guardians);
  const note = flux !== 'none' ? FLUX_NOTE[flux] : record.guardians.includes(next) ? 'Something big is waiting at the bottom of these stairs.' : isCamp(next) ? 'Firelight below: a rest camp.'
    : B !== band(descent.floor) ? BAND_NOTE[B] : next === FLOORS ? BAND_NOTE[6] : 'The stairs turn the wrong way twice, then go on down.';
  descent.flux = flux;
  loadScreen.show(`Floor ${next}`, note, () => {
    descent!.floor = next; descent!.rested = false;
    clearFloor();
    enterDungeon((Math.random() * 2 ** 31) | 0, next, true);
  }, () => undefined);
}
/** Take the current floor's walls and goblins away (between floors). */
function clearFloor() {
  const set = new Set(dungeon.colliders);
  for (let i = world.colliders.length - 1; i >= 0; i--) if (set.has(world.colliders[i])) world.colliders.splice(i, 1);
  goblins.clear(); dungeon.hideSpots();
}
/** `floor` > 0: a floor of the descent (stairs down, harder goblins); 0: the old walk-about dungeon. `between`: already below. */
function enterDungeon(seed: number, floor = 0, between = false) {
  const L = dungeon.build(seed, { down: floor > 0 && floor < FLOORS, hoard: floor === FLOORS, camp: isCamp(floor) });
  if (descent && floor && descent.flux === undefined) descent.flux = fluxFor(floor, record.guardians);
  dungeon.group.visible = true;
  world.colliders.push(...dungeon.colliders);
  goblins.floor = floor; goblins.band = floor ? band(floor) : 0; goblins.hpMul = floor ? hpMul(floor) : 1; goblins.dmgBonus = floor ? dmgBonus(floor) : 0;
  goblins.maxFoes = floor ? maxFoesFor(floor) : MAX_FOES;
  if (descent) goblins.habits = { sword: descent.swordHits, bolt: descent.boltHits };
  if (between) {
    const fog = world.scene.fog as THREE.Fog;
    fog.color.set(dungeon.fog); fog.near = 4; fog.far = 34; (world.scene.background as THREE.Color).set(dungeon.fog);
    player.spawn(dungeon.entrance(), dungeon.entranceYaw());
    if (companion.prefs.follow) natalieRoot().position.copy(dungeon.entrance()).add(new THREE.Vector3(1.2, 0, 0.8));
    for (const p of pets) if (p.following) p.placeNear(dungeon.entrance());
    lastRoom = -1;
    spawnGoblins(true);
    applyFlux(descent?.flux ?? 'none');
    delves[seed] = { theme: L.theme, at: new Date().toISOString().slice(0, 10) }; pruneDelves(); saveDelves();
    const g = record.guardians.indexOf(floor), extraNote = g >= 0 ? ` ${GUARDIAN_NAMES[g % GUARDIAN_NAMES.length]} guards this floor.` : isCamp(floor) ? ' A rest camp by the stairs.' : '';
    toast(`Floor ${floor} of ${FLOORS} · ${L.theme}.${floor === FLOORS ? ' Gold glints in the deepest room.' : ' The stairs down are in the deepest room.'}${extraNote}${descent?.flux && descent.flux !== 'none' ? ' ' + FLUX_NOTE[descent.flux] : ''}`, 5200);
    return;
  }
  player.bounds = rig.bounds = companion.bounds = 2000;
  const fog = world.scene.fog as THREE.Fog;
  savedFog = { color: fog.color.clone(), near: fog.near, far: fog.far, bg: (world.scene.background as THREE.Color).clone() };
  fog.color.set(dungeon.fog); fog.near = 4; fog.far = 34; (world.scene.background as THREE.Color).set(dungeon.fog);
  player.spawn(dungeon.entrance(), dungeon.entranceYaw());
  if (companion.prefs.follow) natalieRoot().position.copy(dungeon.entrance()).add(new THREE.Vector3(1.2, 0, 0.8));
  for (const p of pets) if (p.following) p.placeNear(dungeon.entrance());
  inDungeon = true; swordHitsAtEntry = sword.hits + sword2.hits; sturdy = cook.consume('sturdy');
  run = { rooms: 0, crowns: 0, books: [] }; lastRoom = -1; runKills = 0; recordToasted = false;
  spawnGoblins();
  delves[seed] = { ...(delves[seed] ?? {}), theme: L.theme, at: new Date().toISOString().slice(0, 10) };
  if (floor) pruneDelves();
  saveDelves();
  applyFlux(descent?.flux ?? 'none');
  if (floor) toast(`Floor ${floor} of ${FLOORS} · ${L.theme}. The library has moved again. The stairs down are in the deepest room.`, 4500);
  else toast(`Under the library · seed ${seed} · ${L.theme}. Same seed, same dungeon.`, 4500);
  if (!floor) companion.say('Stay close. I can hear something chewing.', { key: 'dungeon:' + seed, force: true });
}
/** Up the stairs alive: the carried books go to Natalie (and the gallery), the deepest floor is recorded. With the
 *  hoard, it's the good ending: the hero's drawing goes up on the Inn's survivors' wall and they retire. */
function climbOut(d: Descent) {
  for (const id of d.books) markSeen('entry:' + id);
  if (d.books.length) refreshGallery();
  record.delivered += d.books.length; record.deepest = Math.max(record.deepest, d.floor); saveRecord(record);
  stolenBooks.clear();
  patronGifts();
  const n = d.books.length;
  if (d.hoard) { goodEnding(d); return; }
  toast(`Out alive from floor ${d.floor}.${n ? ` Natalie takes ${n} book${n > 1 ? 's' : ''}; they're on the gallery shelves now.` : ' No books this time.'} Deepest so far: floor ${record.deepest}.`, 6000);
  if (n) companion.say(n > 2 ? 'This many? I\'ll be up all night. Thank you.' : 'Another one for the shelf. Thank you.', { force: true });
}
/** F2: the patrons' gifts. Natalie's patron (Greer's friend) sends something as the books add up; kept from hero to hero. */
function patronGifts(announce = true) {
  smithShop.discount = hasGift(record.delivered, 'smith') ? 0.75 : 1;
  const fresh = GIFTS.filter((g) => record.delivered >= g.at && !record.gifts.includes(g.at));
  if (!fresh.length) return;
  record.gifts.push(...fresh.map((g) => g.at)); saveRecord(record);
  if (!announce) return;
  setTimeout(() => {
    toast(`Natalie's patrons send their thanks: ${fresh.map((g) => `${g.name} (${g.text})`).join(' ')}`, 7000);
    companion.say('Greer brought word from my patron. They\'re pleased, and they\'ve sent something for whoever goes down next.', { force: true });
  }, 6500);
}
/** A drawing of the hero for the survivors' wall: their newest sketch, else a drawn portrait. */
function heroArt(): string | null {
  try {
    const c = document.createElement('canvas'); c.width = c.height = 128;
    const g = c.getContext('2d')!; g.fillStyle = '#EADBB4'; g.fillRect(0, 0, 128, 128);
    const sk = loadSketches()[0];
    if (sk) { g.imageSmoothingEnabled = false; drawSketch(g, sk, 0, 0, 4); } else portrait(loadForge(character.name).look)(g, 0, 0, 128);
    return c.toDataURL('image/png');
  } catch { return null; }
}
const heroName = () => loadForge(character.name).name || character.name || 'A stranger';
/** Hero over (fallen or retired): the bag, crowns and hands go; the next hero starts at the glade and makes themself at the mirror. */
function newHero(note: string) {
  for (const [id] of [...inventory.counts]) inventory.counts.set(id, 0);
  inventory.render(); purse.set(0);
  hands.set('left', 'none'); hands.set('right', 'none'); hands.save();
  syncStandSword();
  clearGame();
  try { localStorage.removeItem(REGION_KEY); } catch { /* blocked */ }
  record.heroes++; saveRecord(record);
  character = { ...character, name: '', created: false }; saveCharacter(character);
  player.spawn(world.spawn.pos, world.spawn.yaw);
  delveHp = DELVE_HP;
  if (hasGift(record.delivered, 'purse')) inventory.give(CROWN, 20);
  toast(note, 6500);
  setTimeout(() => { if (state === 'play') openCharacterForge(); }, 600);
}
function heroFalls(by: string) {
  const d = descent!, name = heroName();
  const taken = carryOff([...inventory.counts.keys()].filter((id) => inventory.count(id) > 0), d.floor, name);
  record.lostGear = [...record.lostGear, ...taken].slice(-12); saveRecord(record);
  exitDungeon(true);
  descent = null;
  enterForge();
  lastWords.open({ name, floor: d.floor, by, books: record.delivered, lost: d.books.length }, (words) => {
    addFallen({ name, floor: d.floor, books: record.delivered, by, at: new Date().toISOString().slice(0, 10), words });
    record.deepest = Math.max(record.deepest, d.floor); saveRecord(record);
    innBoards.refresh();
    leaveForge();
    newHero(`${name} is on the tally at the Inn now. A new hero wakes at the glade; the mirror at camp will make them.`);
  });
}
function goodEnding(d: Descent) {
  const name = heroName();
  addSurvivor({ name, at: new Date().toISOString().slice(0, 10), art: heroArt(), line: `Floor ${d.floor} and back, with the hoard.` });
  innBoards.refresh();
  enterForge();
  innWalls.open('survivors', () => {
    leaveForge();
    newHero(`${name} came back from the hoard alive. Their drawing is on the Inn wall, beside Kavik's, and they've hung up their boots. A new hero wakes at the glade.`);
  });
  toast(`${name} climbs out with the dragon's hoard. The rumour was true.`, 6000);
}
// E2: flux floors. Dark (the fog closes in), flooded (water to the knee: slow), burning (fire along the walls; the
// heat bites now and then), light (you fall slowly and jump high).
let fluxNow: Flux = 'none', fluxHeat = 0;
const fluxFx = new THREE.Group(); fluxFx.name = 'flux-fx';
function applyFlux(f: Flux) {
  fluxNow = f; fluxHeat = 6;
  fluxFx.clear(); fluxFx.removeFromParent();
  player.gravityMul = f === 'light' ? 0.38 : 1;
  if (f === 'none' || !dungeon.layout) return;
  const fog = world.scene.fog as THREE.Fog, o = dungeon.entrance();
  if (f === 'dark') { fog.near = 1; fog.far = 9; fog.color.set('#020203'); (world.scene.background as THREE.Color).set('#020203'); }
  if (f === 'flooded') {
    const water = new THREE.Mesh(new THREE.PlaneGeometry(80, 80).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: '#2E5A6A', transparent: true, opacity: 0.55, depthWrite: false }));
    water.position.set(o.x, 0.28, o.z); water.raycast = () => {}; fluxFx.add(water);
    fog.color.set('#16303A'); (world.scene.background as THREE.Color).set('#16303A');
  }
  if (f === 'burning') {
    const fire = new THREE.MeshBasicMaterial({ color: '#FF7A2A' }), core = new THREE.MeshBasicMaterial({ color: '#FFD86A' });
    for (const r of dungeon.layout.rooms) for (let k = 0; k < 3; k++) {
      const at = dungeon.roomAt(r, k - 1, -Math.floor(r.h / 2));
      const c1 = new THREE.Mesh(new THREE.ConeGeometry(0.35, 1.1, 6), fire); c1.position.set(at.x, 0.55, at.z + 0.6); fluxFx.add(c1);
      const c2 = new THREE.Mesh(new THREE.ConeGeometry(0.18, 0.7, 5), core); c2.position.set(at.x, 0.5, at.z + 0.6); fluxFx.add(c2);
    }
    fluxFx.traverse((m) => { m.raycast = () => {}; });
    fog.color.set('#3A160A'); (world.scene.background as THREE.Color).set('#3A160A');
  }
  dungeon.group.add(fluxFx);
}
function fluxTick(dt: number) {
  if (!inDungeon || fluxNow !== 'burning' || state !== 'play') return;
  if ((fluxHeat -= dt) > 0) return;
  fluxHeat = 9;
  delveHp = Math.max(1, delveHp - 1); hurtFlash = 0.3; haptics.play('hurt');
  toast('The heat from the burning shelves scorches you.', 2000);
}
/** The descent makes a new layout every floor; keep only the newest few in the delves record. */
function pruneDelves() { const ks = Object.keys(delves); for (const k of ks.slice(0, Math.max(0, ks.length - 40))) delete delves[k]; }
function exitDungeon(fell = false) {
  if (!inDungeon) return;
  const run_ = descent;
  if (!fell) descent = null;
  goblins.floor = goblins.band = 0; goblins.hpMul = 1; goblins.dmgBonus = 0; goblins.maxFoes = MAX_FOES;
  applyFlux('none');
  if (!fell) { Thrower.bonus = 0; goblins.reveal = goblins.booksFirst = false; }
  runSummary();
  if (run_ && !fell) setTimeout(() => climbOut(run_), 0);
  if (statueDirty) { statueDirty = false; killStatue.set(kills); }
  if (sword.hits + sword2.hits > swordHitsAtEntry) { gear.rustSword(); toast('Goblin blood and cellar damp: your blade is spotting with rust. The smith\'s oil will fix it.', 3600); }   // B17
  inDungeon = false;
  const set = new Set(dungeon.colliders);
  for (let i = world.colliders.length - 1; i >= 0; i--) if (set.has(world.colliders[i])) world.colliders.splice(i, 1);
  player.bounds = rig.bounds = companion.bounds = world.bounds;
  const fog = world.scene.fog as THREE.Fog;
  if (savedFog) { fog.color.copy(savedFog.color); fog.near = savedFog.near; fog.far = savedFog.far; (world.scene.background as THREE.Color).copy(savedFog.bg); }
  dungeon.group.visible = false; dungeon.hideSpots();
  goblins.clear(); slowT = 0; player.speedMul = 1; sturdy = false;
  player.spawn(TRAPDOOR.clone().add(new THREE.Vector3(0, 0, 1.6)), 0);
  if (companion.prefs.follow) natalieRoot().position.copy(TRAPDOOR).add(new THREE.Vector3(1.4, 0, 1.4));
  for (const p of pets) if (p.following) p.placeNear(TRAPDOOR, -1.4, 1.4);
}
// ---------- B48 (Mike 2026-11-04): delving deeper pays, in crowns and lore books ----------
// Each room you reach pays 1 crown per room of depth (the entrance pays nothing), once per room per seed, so walking
// the same dungeon again doesn't farm. The chest and the deepest room each give a lore book you haven't read yet (an
// extra purse when you've read them all). Climbing out shows what the run paid.
let run = { rooms: 0, crowns: 0, books: [] as string[] }, lastRoom = -1;
const DEEP_PURSE = 5, READ_ALL_PURSE = 4;
function delvePay(n: number) { if (n <= 0) return; inventory.give(CROWN, n); run.crowns += n; }
function dropLoreBook(where: string, seed: number): string | null {
  const unread = lore.entries.filter((e) => e.type === 'lore' && !seen.includes('entry:' + e.id));
  if (!unread.length) { delvePay(READ_ALL_PURSE); toast(`+${READ_ALL_PURSE} ◎ ${where}: you've read every lore book, so it's a purse instead.`, 3600); return null; }
  const e = unread.filter((x) => !descent?.books.includes(x.id))[(seed + run.books.length * 7) % Math.max(1, unread.length - (descent?.books.length ?? 0))] ?? unread[0];
  if (descent) {   // below, a book is only carried: it reaches Natalie (and the gallery) when you climb out alive
    if (!descent.books.includes(e.id)) descent.books.push(e.id);
    run.books.push(e.title);
    haptics.play('pickup');
    toast(`A lore book ${where}: "${e.title}". Carry it up to Natalie (${descent.books.length} carried). Die down here and it's lost.`, 5200);
    return e.id;
  }
  markSeen('entry:' + e.id); refreshGallery();
  run.books.push(e.title);
  haptics.play('pickup');
  toast(`A lore book ${where}: "${e.title}" by ${e.credit_as}. It's on its shelf in the Ruined Library and in the gallery.`, 5200);
  return e.id;
}
function delveTick() {
  if (!inDungeon || !dungeon.layout) return;
  const i = dungeon.roomOf(player.pos.x, player.pos.z);
  if (i < 0 || i === lastRoom) return;
  lastRoom = i;
  const L = dungeon.layout, seed = L.seed, d = delves[seed], r = L.rooms[i];
  if (!d) return;
  const reached = d.rooms ?? (d.rooms = []);
  if (reached.includes(i)) return;
  reached.push(i); run.rooms++;
  const pay = Math.max(0, r.depth);
  const deepest = r.depth > 0 && r.depth === Math.max(...L.rooms.map((x) => x.depth));
  delvePay(pay);
  if (deepest && !d.deep) {
    d.deep = true; delvePay(DEEP_PURSE);
    toast(`+${pay + DEEP_PURSE} ◎ the deepest room (depth ${r.depth}).`, 2600);
    saveDelves();
    setTimeout(() => { if (inDungeon) dropLoreBook('in the deepest room', seed); }, 1400);
    return;
  }
  saveDelves();
  if (pay) { haptics.play('pickup'); toast(`+${pay} ◎ room ${r.depth} deep`, 1800); }
}
function runSummary() {
  if (!run.rooms && !run.crowns && !run.books.length) return;
  const books = run.books.length ? `, ${run.books.length} lore book${run.books.length > 1 ? 's' : ''} (${run.books.map((t) => `"${t}"`).join(', ')})` : '';
  toast(`This delve: ${run.rooms} new room${run.rooms === 1 ? '' : 's'}, ${run.crowns} ◎${books}.`, 6000);
  run = { rooms: 0, crowns: 0, books: [] };
}
// ---------- B49 (Mike 2026-11-04): most goblins in one delve, as a statue on the green near the library ----------
const kills = loadKills();
let runKills = 0, recordToasted = false, statueDirty = false;
const killStatue = (() => {
  const lib = TOWN_LOTS.find((l) => l.id === 'library')!, k = 0.42;
  const x = FOUNTAIN.x + (lib.x - FOUNTAIN.x) * k, z = FOUNTAIN.z + (lib.z - FOUNTAIN.z) * k;
  const st = new KillStatue(x, z, Math.atan2(FOUNTAIN.x - x, FOUNTAIN.z - z));   // faces the fountain
  world.scene.add(st.group);
  world.colliders.push({ kind: 'circle', x, z, r: 0.95 });
  st.set(kills);
  return st;
})();
interactables.push({ obj: killStatue.hit, verb: () => 'Read the plaque', act: () => toast(`${plaqueText(kills)}. Goblins you've beaten in all: ${kills.total}.`, 5200), when: () => !inDungeon });
function countKill() {
  kills.total++;
  if (inDungeon) {
    runKills++;
    if (runKills > (kills.best?.count ?? 0)) {
      kills.best = { count: runKills, name: character.name || 'A stranger', look: JSON.parse(JSON.stringify(wornLook.look)), height: wornLook.height, at: new Date().toISOString().slice(0, 10) };
      statueDirty = true;
      if (!recordToasted && runKills > 1) { recordToasted = true; toast('A new record for one delve! The statue on the green will show it.', 3200); }
    }
  }
  saveKills(kills);
}
let descendSheet: HTMLElement | null = null;
function openDescend() {
  enterForge();
  const el = document.createElement('div');
  el.className = 'gallery-card';
  el.id = 'descend';
  el.innerHTML = `<div class="card-in"><div class="credit">Under the Ruined Library</div><h3>Go down for the books?</h3>
    <p>The library is in flux: the witch in the ruins keeps it moving, and every floor is new each time you go down. They say it goes ${FLOORS} floors deep, with a dragon's hoard at the bottom. Each floor is harder. Climb out on any floor's stairs to hand Natalie the books you carry. <b>Die down there and this hero is gone</b>, with the bag, the crowns and the books on them.</p>
    <p class="fine">Deepest so far: floor ${record.deepest || '-'} · books handed in: ${record.delivered} · heroes lost: ${Math.max(0, record.heroes - 1)}</p>
    <div class="forge-actions"><button class="primary" data-act="go">Descend to floor 1</button>${record.ropes.map((f) => `<button class="primary" data-act="rope" data-floor="${f}">Natalie's rope to floor ${f}</button>`).join('')}<button class="secondary" data-act="quick">Quick Dungeon (practice, nobody dies)</button></div>
    ${hasGift(record.delivered, 'kit') && record.kitFor !== record.heroes ? `<p class="fine">The patrons' kit, one per hero:</p><div class="forge-actions">${KITS.map((k) => `<button class="secondary" data-act="kit" data-kit="${k.id}">${k.name}</button>`).join('')}</div>` : ''}
    ${record.delivered ? `<p class="fine">Patrons' gifts: ${GIFTS.map((g) => record.delivered >= g.at ? `<b>${g.name}</b>` : `${g.name} at ${g.at} books`).join(' · ')}</p>` : ''}
    <div class="forge-actions"><button class="secondary" data-act="close">Not yet</button></div></div>`;
  el.addEventListener('click', (ev) => {
    const a = (ev.target as HTMLElement).closest('[data-act]') as HTMLElement | null;
    if (!a) return;
    if (a.dataset.act === 'kit') {
      const k = KITS.find((x) => x.id === a.dataset.kit);
      if (k) { for (const [id, n] of k.items) inventory.give(id, n); record.kitFor = record.heroes; saveRecord(record); haptics.play('pickup'); toast(`From the patrons: ${k.name.toLowerCase()}. Choose what each hand holds in the bag.`, 3600); }
      el.remove(); descendSheet = null; leaveForge(); openDescend(); return;
    }
    const seed = dailySeed();
    el.remove(); descendSheet = null;
    if (a.dataset.act === 'quick') { openQuick(seed); return; }   // stays in the forge state until the run ends
    leaveForge();
    if (a.dataset.act === 'go') startDescent();
    if (a.dataset.act === 'rope') startDescent(Number(a.dataset.floor) || 1);
  });
  document.body.appendChild(el);
  descendSheet = el;
}
// v0.05 §6: the Quick Dungeon, a menu-only run picked from the trapdoor.
const quick = station(new QuickDungeon());
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
  colliders: world.colliders,   // B42: goblins lean at the same wall edges
  player: player.pos,
  aiming: () => crossbow.ads,
  hurt: (dmg, by, slow, from) => {
    if (!inDungeon || delveHp <= 0) return;
    const bl = blockBlow(dmg, from);
    if (bl.blocked && imbued('thorns') && from) goblins.wound(by, 2);   // F1 thorns
    if (bl.blocked) { audio.swordHit(true); haptics.play('hit'); if (bl.dmg <= 0) { toast(`You turn ${by.v.display}'s blow.`, 1400); return; } dmg = bl.dmg; slow = 0; }
    if (imbued('witchfire')) dmg += 1;   // F1 witchfire's curse
    if (sturdy) dmg = Math.max(1, dmg - 1);   // B18: well fed
    delveHp = Math.max(0, delveHp - dmg); hurtFlash = 0.35; haptics.play('hurt'); gesture('hit');
    if (slow) slowT = Math.max(slowT, slow);
    if (delveHp <= 0) {
      if (descent) { heroFalls(by.v.display); return; }
      exitDungeon();
      toast(`${by.v.display} knocks you flat. Natalie hauls you back up the stairs.`, 4500);
      companion.say('Up you get. We go back when you\'re ready.', { force: true });
    }
  },
  steal: () => { const n = Math.min(2, inventory.count('bolt')); if (n) inventory.take('bolt', n); return n; },
  loot: (f, crowns, bolts) => {
    countKill();   // B49
    if (f.role === 'guardian' && descent && !record.ropes.includes(descent.floor)) {
      record.ropes.push(descent.floor); record.ropes.sort((a, b) => a - b); saveRecord(record);
      setTimeout(() => toast(`${f.v.display} is down. Natalie will tie a rope here: next time you can start the descent at floor ${descent?.floor ?? ''}.`, 6000), 2700);
    }
    inventory.give(CROWN, crowns); if (bolts) inventory.give('bolt', bolts); haptics.play('pickup');
    toast(`${f.v.display} drops ${crowns} crown${crowns > 1 ? 's' : ''}${bolts ? ` and ${bolts} bolt${bolts > 1 ? 's' : ''}` : ''}.`, 2600);
  },
  say: (t) => toast(t, 2600),
  stealBook: () => {
    if (!descent?.books.length) return null;
    const id = descent.books.pop()!, title = lore.entries.find((e) => e.id === id)?.title ?? 'a lore book';
    stolenBooks.set(title, id);
    return title;
  },
  reclaim: (f, item) => {
    const g = carried.get(f); carried.delete(f);
    if (g) { const i = record.lostGear.indexOf(g); if (i >= 0) record.lostGear.splice(i, 1); saveRecord(record); }
    inventory.give(item, 1); haptics.play('pickup');
    toast(g ? `You take ${g.owner}'s ${ITEMS[item]?.name.toLowerCase() ?? item} back from the goblin. It's yours now.` : `You take the ${ITEMS[item]?.name.toLowerCase() ?? item} off the goblin.`, 3600);
  },
  recover: (_f, title) => { const id = stolenBooks.get(title); stolenBooks.delete(title); if (id && descent) { descent.books.push(id); toast(`You take “${title}” back.`, 2600); } },
  douse: () => { if (hands.held.left === 'torch' || hands.held.right === 'torch') { toggleTorch(); toast('A wet blow, and your torch gutters out.', 2400); } },
  hex: (kind) => {
    if (kind === 'slow') { slowT = Math.max(slowT, 2.5); return; }
    const fog = world.scene.fog as THREE.Fog, far = fog.far, near = fog.near;
    fog.far = Math.max(8, far * 0.45); fog.near = 1.5;
    setTimeout(() => { if (inDungeon) { fog.far = far; fog.near = near; } }, 4000);
  },
});
for (const s of [sword, sword2]) {
  s.foes = () => goblins.alive.map((f) => f.root.position);
  s.slash = (c) => {
    const n = goblins.slash(c.from, c.fwd, c.reach, c.arc, c.damage + (imbued('hunger') ? 1 : 0), c.heavy).length;
    if (n && descent) descent.swordHits += n;
    if (n && imbued('drink')) delveHp = Math.min(DELVE_HP, delveHp + 1);   // F1 the drinking edge
    return n;
  };
}
crossbow.targets = crossbow2.targets = (from, dir, len) => {
  const h = goblins.list.length ? goblins.hitTest(from, dir, len) : null;
  return h && { dist: h.dist, hit: (dmg, d) => {
    haptics.play('hit'); if (descent) descent.boltHits++;
    if (imbued('frost')) goblins.chill(h.foe, 3);
    return goblins.shoot(h.foe, dmg + (imbued('witchfire') ? 1 / 3 : 0), d);
  } };
};
/** Rocks hit like bolts but carry no bolt scrolls. */
const rockTargets: typeof crossbow.targets = (from, dir, len) => {
  const h = goblins.list.length ? goblins.hitTest(from, dir, len) : null;
  return h && { dist: h.dist, hit: (dmg, d) => { haptics.play('hit'); return goblins.shoot(h.foe, dmg, d); } };
};
function spawnGoblins(keepHp = false) {
  goblins.clear(); if (!keepHp) delveHp = DELVE_HP + (cook.consume('hearty') ? 3 : 0); slowT = 0;   // B18: a hearty meal (your wounds carry down the stairs)
  const L = dungeon.layout!, run = (Math.random() * 2 ** 31) | 0, fl = goblins.floor;
  // One per room by depth, two in the nest (its first with a bigger budget); deeper floors, more and tougher.
  const rooms = L.rooms.filter((r) => r.tag !== 'entrance').sort((a, b) => (a.tag === 'nest' ? -1 : b.tag === 'nest' ? 1 : a.depth - b.depth));
  let i = 0;
  for (const r of rooms) for (let k = 0, n = fl ? countFor(fl, r.tag) : r.tag === 'nest' ? 2 : 1; k < n && goblins.alive.length < goblins.maxFoes; k++, i++) {
    const seed = i === 0 && forcedGoblin ? forcedGoblin : seedOf(run, i);
    const budget = fl ? budgetFor(fl) + (r.tag === 'nest' && k === 0 ? 4 : 0) : r.tag === 'nest' && k === 0 ? 8 : undefined;
    goblins.spawn(rollGoblin(seed, budget), dungeon.roomAt(r, k, 0), Math.PI, false, fl === FLOORS && r.tag === 'nest' ? 'keeper' : undefined);
  }
  // E2: a guardian floor's boss waits in the deepest room.
  const gi = fl ? record.guardians.indexOf(fl) : -1, nest = L.rooms.find((r) => r.tag === 'nest');
  if (gi >= 0 && nest) goblins.spawn(rollGoblin(seedOf(run, 99), budgetFor(fl) + 6), dungeon.roomAt(nest, 0, 1), Math.PI, true, 'guardian', GUARDIAN_NAMES[gi % GUARDIAN_NAMES.length]);
  // F2: a fallen hero's gear, carried by the goblins near where they fell.
  carried.clear();
  if (fl) {
    const free = goblins.alive.filter((f) => f.role !== 'guardian' && f.role !== 'keeper');
    for (const g of gearNear(record.lostGear, fl)) {
      const f = free.splice(Math.floor(Math.random() * free.length), 1)[0];
      if (!f) break;
      goblins.arm(f, g.item, `${g.owner}'s ${ITEMS[g.item]?.name.toLowerCase() ?? g.item}`); carried.set(f, g);
    }
    if (carried.size) setTimeout(() => { if (inDungeon) toast(`Something down here carries ${[...carried.values()][0].owner}'s gear.`, 3600); }, 5600);
  }
}
/** F2: which goblin carries which fallen hero's piece, this floor. */
const carried = new Map<object, LostGear>();
const delveHpEl = document.getElementById('delveHp')!;
// UX pass (Mike 2026-10-31): your health shows on you, not as a counter. Below half, the edges of your sight redden
// and you breathe hard; below 40% you limp. The old line stays for screen readers (and tests), off screen.
let breathT = 0;
function updateDelve(dt: number) {
  if (!inDungeon) { delveHpEl.classList.add('hidden'); document.body.style.setProperty('--hurt', '0'); if (wear.level) wear.set(0); return; }
  if (state === 'play') { if (hitStop > 0) hitStop -= dt; else goblins.update(dt); }   // v0.08: a beat's pause on a sword hit
  const frac = Math.min(1, delveHp / DELVE_HP);
  wear.set(1 - frac);
  slowT = Math.max(0, slowT - dt); player.speedMul = (slowT > 0 ? 0.55 : 1) * (frac <= 0.4 ? 0.75 : 1) * (isBlocking() ? 0.6 : 1) * (fluxNow === 'flooded' ? 0.72 : 1) * (imbued('swift') ? 1.12 : 1);
  goblins.reveal = imbued('seeing') && (hands.held.left === 'torch' || hands.held.right === 'torch');
  fluxTick(dt);
  hurtFlash = Math.max(0, hurtFlash - dt);
  document.body.style.setProperty('--hurt', (Math.max(0, 1 - frac * 1.6) * 0.85 + hurtFlash * 1.4).toFixed(2));
  if (frac <= 0.5 && state === 'play' && (breathT -= dt) <= 0) { audio.breath(); breathT = 1.2 + frac * 2.4; }
  delveHpEl.classList.remove('hidden');
  delveHpEl.classList.toggle('hit', hurtFlash > 0);
  const t = `${descent ? `Floor ${descent.floor} · ` : ''}♥ ${delveHp}/${DELVE_HP}${slowT > 0 ? ' · slowed' : ''} · goblins ${goblins.alive.length}${descent?.books.length ? ` · ${descent.books.length} book${descent.books.length > 1 ? 's' : ''} carried` : ''}${descent?.scrolls?.length ? ` · ✦ ${descent.scrolls.map((id) => scrollById(id)?.name.replace(/^Scroll of (the )?/, '')).join(', ')}` : ''}`;
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
const livingMap = station(new LivingMap(() => {
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
}, () => ({ x: player.pos.x, z: player.pos.z, yaw: player.yaw }), () => leaveForge(), forgeAuthor));
function openMap() { if (state !== 'play' && state !== 'pause') return; enterForge(); livingMap.open(); }
let mapClock = 0;
// ---------- Phase F: B14 dojo (your character demonstrates; you follow the beginner-safe version) ----------
const dojoBoard = buildDojo(world.scene, world.colliders);
let dojoView: boolean | null = null;
const dojo = station(new DojoPanel((d) => {
  if (!d) return;
  // Stand on the mats (under the bar for the hanging drill), facing the camera, panel on the left.
  const at = d.pose === 'hang' ? DOJO.bar.clone() : new THREE.Vector3(DOJO.x - 1, 0, DOJO.z);
  const low = d.pose === 'plank' || d.pose === 'pushup';
  player.spawn(at, low ? Math.PI / 2 : Math.PI);   // the plank and push-ups side-on
  const up = d.pose === 'hang' ? 1.75 : low ? 0.45 : 1.0, far = d.pose === 'hang' ? 2.9 : 3.3;
  // Portrait phones put the panel along the bottom, so the figure goes in the top band instead.
  const tall = innerHeight > innerWidth;
  rig.setShot(tall ? { pos: new THREE.Vector3(at.x, up + 0.2, at.z + far * 1.5), look: new THREE.Vector3(at.x, up - 1.6, at.z), fov: 50 }
    : { pos: new THREE.Vector3(at.x + (low ? -0.9 : -0.7), up + 0.45, at.z + far - (low ? 0.5 : 0)), look: new THREE.Vector3(at.x + (low ? -2.0 : -1.0), up, at.z), fov: 44 });   // the plank and push-ups lie along -x, centred ~0.9 m from where you stand; clear of the corner post and the water barrel
}, () => { if (dojoView !== null) { player.thirdPerson = dojoView; dojoView = null; } leaveForge(); }, forgeAuthor));
function openDojo() {
  if (state !== 'play' && state !== 'pause') return;
  enterForge();
  if (dojoView === null) { dojoView = player.thirdPerson; player.thirdPerson = true; }
  rig.setShot({ pos: new THREE.Vector3(DOJO.x - 1.7, 1.6, DOJO.z + 3.2), look: new THREE.Vector3(DOJO.x - 2, 1, DOJO.z), fov: 44 });
  dojo.open();
}
interactables.push({ obj: dojoBoard, verb: () => 'Train at the dojo', act: () => openDojo(), when: () => !inDungeon });

// ---------- B35 (Mike 2026-11-03): fighter mode vs Kavik, side-on on the dojo mats (src/fight/) ----------
const fightMode = station(new FightMode());
const kavikRoot = world.standees.kavik;
const kavikHit = new THREE.Mesh(new THREE.BoxGeometry(0.9, 1.9, 0.9), new THREE.MeshBasicMaterial({ visible: false }));
kavikHit.position.copy(kavikRoot.position).setY(0.95);
world.scene.add(kavikHit);
interactables.push({ obj: kavikHit, verb: () => fightMode.record.beaten ? 'Spar with Kavik (no holding back)' : 'Spar with Kavik', act: () => openFight(), when: () => !inDungeon });
// The fight runs on the mats: its x along them (the world's -x), its z across (the world's +z). The camera starts on
// the -Z side, side-on, and swings round with the line between the fighters as they sidestep.
const RING = { x: DOJO.x, y: 0.24, z: DOJO.z - 0.3 };
const ringX = (f: { x: number }) => RING.x - f.x;
const ringZ = (f: { z: number }) => RING.z + f.z;
let kavikWas: { x: number; y: number; z: number; ry: number } | null = null, fightView: boolean | null = null;
const fightFx = new THREE.Group(); fightFx.name = 'fight-fx'; world.scene.add(fightFx);
// A flash where a hit lands: gold on a hit, pale on a block, red on a counter hit.
const sparkMat = new THREE.MeshBasicMaterial({ color: '#FFE08A', transparent: true, depthWrite: false });
const spark = new THREE.Mesh(new THREE.IcosahedronGeometry(0.16, 0), sparkMat); spark.visible = false; fightFx.add(spark);
let sparkT = 0;
const fightCam = { x: 0, z: 0 };
let kavikToldDeep = false;
function openFight() {
  if (state !== 'play') return;
  if (!kavikToldDeep) { kavikToldDeep = true; toast("Kavik: \"Floor thirty? I went. Gold to the ceiling, and something asleep on it. I didn't stay to ask its name.\"", 5600); }
  enterForge();
  fightView = player.thirdPerson; player.thirdPerson = true;
  kavikWas = { x: kavikRoot.position.x, y: kavikRoot.position.y, z: kavikRoot.position.z, ry: kavikRoot.rotation.y };
  fightMode.open();
}
fightMode.onClose = () => {
  if (kavikWas) { kavikRoot.position.set(kavikWas.x, kavikWas.y, kavikWas.z); kavikRoot.rotation.y = kavikWas.ry; kavikWas = null; }
  fightFx.visible = false;
  player.spawn(new THREE.Vector3(RING.x, 0, RING.z - 2.2), Math.PI);   // off the mats, facing them
  if (fightView !== null) { player.thirdPerson = fightView; fightView = null; }
  leaveForge();
};
fightMode.onResult = (won, crowns, first) => { if (crowns) earn(crowns, first ? 'your first win over Kavik' : 'a win over Kavik'); };
fightMode.onHit = (e) => {
  if (!e.blocked) gesture('hit', e.on === fightMode.fight.a ? 'player' : 'kavik');
  if (e.on === fightMode.fight.a || e.by === fightMode.fight.a) haptics.play(e.blocked ? 'tap' : 'hurt');
  if (e.outcome !== 'break') {
    const m = e.move, hy = m.level === 'low' ? 0.35 : m.level === 'high' ? 1.5 : 1.05;
    spark.position.set(ringX({ x: (e.by.x + e.on.x) / 2 }), RING.y + e.on.y + hy, ringZ({ z: (e.by.z + e.on.z) / 2 }));
    sparkMat.color.set(e.blocked ? '#CFE8FF' : e.outcome === 'counter' ? '#FF6A4A' : '#FFE08A');
    sparkT = e.blocked ? 0.12 : 0.2;
    if (!e.blocked) fightMode.hitStop = e.outcome === 'counter' || m.launch ? 0.09 : 0.05;   // a beat's pause, for weight
  }
};
// ---------- Skyrunner (Mike 2026-11-05): fly a mana-sail glider from the perch east of the library (src/sky/) ----------
// A run is its own seeded map with its own scene and camera: A (the perch) to B (the beacon) inside 60 s, and one
// run in twenty a hexed skyrunner comes for you. The world keeps its state underneath; leaving puts you back here.
const sky = station(new SkyRun());
const perch = buildPerch();
world.scene.add(perch.group, perch.hit);
world.colliders.push({ kind: 'box', minX: PERCH.x - 1.75, maxX: PERCH.x + 1.75, minZ: PERCH.z - 1.75, maxZ: PERCH.z + 1.75 });
interactables.push({ obj: perch.hit, verb: () => sky.record.wins ? `Fly a sky run (${sky.record.wins} won)` : 'Fly a sky run', act: () => openSky(), when: () => !inDungeon });
function openSky(seed?: number) {
  if (state !== 'play') return;
  enterForge();
  sky.open(seed);
}
sky.onClose = () => {
  player.spawn(new THREE.Vector3(PERCH.x, 0, PERCH.z + 3), 0);   // at the foot of the ladder, facing it
  leaveForge();
};
sky.onResult = (won, crowns, why) => { if (won && crowns) earn(crowns, why); };
/** How a fighter's state shows on its figure: fists up, walking, hopping, a crouch, the strike, down. */
function fightInput(f: Fighter): AnimInput {
  const m = f.move;
  let k = 0;
  if (m) k = f.t < m.startup ? (f.t / m.startup) * 0.5 : f.t < m.startup + m.active ? 0.5 : 0.5 + ((f.t - m.startup - m.active) / m.recovery) * 0.5;
  const thrower = !!f.holding;
  return {
    speed: f.state === 'walk' || f.state === 'guard' ? Math.hypot(f.vx, f.vz) : f.state === 'step' ? 2.4 : 0,
    airborne: !f.grounded || f.state === 'juggle' || f.state === 'thrown',
    fight: f.state !== 'ko' && f.state !== 'down',
    crouch: f.low && f.state !== 'down',
    strike: thrower ? { limb: 'throw', aim: 'grab', k: 0.5 } : m ? { limb: m.limb, aim: m.aim, k: Math.min(1, k) } : null,
    pose: f.state === 'ko' || f.state === 'down' ? 'sitground' : null, look: null,
  };
}
/** Run the fight and put both fighters, the shields, the bolts and the camera where the fight says. */
function syncFight(dt: number) {
  if (!fightMode.isOpen) return;
  fightMode.update(dt);
  const F = fightMode.fight, a = F.a, b = F.b;
  // Facing on the mat to a yaw in the world (the mat's x is the world's -x).
  player.pos.set(ringX(a), RING.y + a.y, ringZ(a)); player.yaw = player.bodyYaw = Math.atan2(a.face.x, -a.face.z); player.pitch = 0; player.syncNow();
  kavikRoot.position.set(ringX(b), RING.y + b.y, ringZ(b)); kavikRoot.rotation.y = Math.atan2(-b.face.x, b.face.z);
  fightFx.visible = true;
  sparkT -= dt; spark.visible = sparkT > 0;
  if (spark.visible) { spark.scale.setScalar(1 + (0.2 - sparkT) * 6); sparkMat.opacity = Math.min(1, sparkT * 8); }
  // Side-on to the line between the fighters, from the side the screen's right says: it swings round as they circle.
  const mx = (ringX(a) + ringX(b)) / 2, mz = (ringZ(a) + ringZ(b)) / 2, gap = F.dist(), up = Math.max(a.y, b.y) * 0.6;   // follow a jump up
  const rx = -F.right.x, rz = F.right.z, back = 4.8 + gap * 0.45;   // the screen's right in the world; the camera sits behind it
  fightCam.x = mx - rz * back; fightCam.z = mz + rx * back;
  rig.setShot({ pos: new THREE.Vector3(fightCam.x, 1.7 + up, fightCam.z), look: new THREE.Vector3(mx, 1.15 + up, mz), fov: 46 });
}

// ---------- B16: the Spanish caravan by the coach road (never translated; a phrasebook in the Journal) ----------
const caravanFolk = buildCaravan(world.scene, world.colliders, world.heightAt);
for (const f of caravanFolk) puppets.set('caravan:' + f.id, figureOf(f.root));
let caravanView: boolean | null = null;
const caravan = station(new CaravanPanel((t) => {
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
}, (t) => earn(t.reward, 'a talk in Spanish', 'es:' + t.id), () => { if (caravanView !== null) { player.thirdPerson = caravanView; caravanView = null; } leaveForge(); }, () => character.name));
function openCaravan(id: string) {
  if (state !== 'play') return;
  const f = caravanFolk.find((c) => c.id === id);
  if (!f) return;
  enterForge();
  if (caravanView === null) { caravanView = player.thirdPerson; player.thirdPerson = true; }
  caravan.open(f.talk);
}
for (const f of caravanFolk) interactables.push({ obj: f.hit, verb: () => f.talk.verb, act: () => openCaravan(f.id), when: () => !inDungeon });
const phrasebook = station(new Phrasebook(caravan, () => leaveForge()));
// ---------- Multiplayer (Mike 2026-11-04, "Make this game multiplayer!" + "Do it"): friends-only rooms, src/net/ ----------
// `?net=local` keeps rooms inside this browser (tabs talk over BroadcastChannel): tests, and trying it on one PC.
const friends = station(new FriendsPanel(() => character.name, () => (urlFlags.get('net') === 'local' ? 'local' : 'p2p'), () => leaveForge()));
friends.toast = (m) => toast(m, 3200);
function openFriends(code?: string) { if (state !== 'play' && state !== 'pause') return; enterForge(); friends.open(code); }
// Multiplayer 2: the other players in the room, as rigged figures in the puppet loop (ids 'net:<peer>').
const remotes = new Map<string, Remote>();
function syncRemotes(room: Room | null) {
  for (const [id, r] of remotes) if (!room?.members.has(id)) { r.remove(); remotes.delete(id); puppets.delete('net:' + id); setRemotePet(id, null); }
  if (netGuests !== (room?.members.size ?? 0)) { netGuests = room?.members.size ?? 0; applyQuality(); }   // phone polish: fewer crowd sprites per guest on Low
  syncRoomBtn(room);
  if (!room) return;
  for (const m of room.members.values()) {
    let r = remotes.get(m.id);
    if (!r) {
      r = new Remote(m.id, m.name, world.scene); remotes.set(m.id, r);
      const sw = sword.held.clone(), bk = heldBook.model.clone(); sw.visible = bk.visible = false;
      r.hold({ sword: sw, torch: torch.cloneHeld(), book: bk });
      room.send('pet', myPet(), m.id);                       // tell a newcomer about your pet,
      if (room.isHost) room.send('time', world.time, m.id);  // and the host sets their sky to the room's
    }
    if (r.name !== m.name) r.setName(m.name);
    if (m.look !== r.lookRaw && r.setLook(m.look)) puppets.set('net:' + m.id, { root: r.figure!, fig: r.fig ?? undefined });
  }
}
// Multiplayer 4: a small room button on the HUD while you're in a room (taps, clicks; pads use the Journal).
const roomBtn = document.createElement('button');
roomBtn.id = 'roomBtn'; roomBtn.className = 'hidden'; roomBtn.type = 'button';
$('hud').appendChild(roomBtn);
roomBtn.addEventListener('click', (e) => { e.stopPropagation(); openFriends(); });
roomBtn.addEventListener('pointerdown', (e) => e.stopPropagation());
function syncRoomBtn(room: Room | null) {
  roomBtn.classList.toggle('hidden', !room);
  if (room) roomBtn.textContent = `💬 Room ${room.code} · ${room.count}/${MAX_PLAYERS}`;
}
// Multiplayer 3: emotes (preset only), pets that come along, one sky for the room, and the host's Remove.
const myBubble = new Bubble();
player.body.add(myBubble.sprite); myBubble.sprite.position.y = controls.eyeHeight + 0.9;
const remotePets = new Map<string, Pet>();
function setRemotePet(peer: string, d: unknown) {
  const o = d && typeof d === 'object' ? d as { id?: unknown; name?: unknown } : null;
  const id = o && typeof o.id === 'string' && Object.prototype.hasOwnProperty.call(SPECIES, o.id) ? o.id as PetId : null;
  const had = remotePets.get(peer);
  if (had && had.id === id) { const n = cleanName(o?.name); if (n) had.prefs.names[id!] = n; return; }
  if (had) { world.scene.remove(had.root, had.hit); remotePets.delete(peer); }
  const r = remotes.get(peer);
  if (!id || !r) return;
  const prefs: PetPrefs = { friends: [id], withYou: id, stayAt: {}, names: {} };
  const n = cleanName(o?.name); if (n) prefs.names[id] = n;
  const p = new Pet(id, world.scene, r.root.position.clone(), r.root.rotation.y, world.colliders, () => player.bounds, prefs);
  p.terrain = (x, z) => world.heightAt(x, z);
  p.root.name = 'netpet:' + peer;
  remotePets.set(peer, p);
}
function myPet() { const p = pets.find((q) => q.following); return p ? { id: p.id, name: p.name } : null; }
function emote(i: number) {
  const e = EMOTES[i], room = friends.room;
  if (!e || !room) return;
  room.send('emote', i);
  myBubble.say(e.say);
  if (e.gesture) gesture(e.gesture);
}
friends.emote = emote;
friends.onRoom = (room) => {
  if (room) {
    room.lookOf = () => myLook;
    room.onState = (from, d) => remotes.get(from)?.apply(d);
    room.on('emote', (d, m) => {
      const e = emoteAt(d), r = remotes.get(m.id);
      if (!e || !r) return;
      r.bubble.say(e.say);
      if (e.gesture) r.fig?.play(e.gesture);
      if (r.away || r.root.position.distanceTo(player.pos) > 25) toast(`${m.name}: ${e.say}`, 2600);   // too far to see the bubble
    });
    room.on('time', (d) => { if ((d === 'day' || d === 'sunset' || d === 'night') && d !== world.time) { setWorldTime(d); netTime = d; } });
    room.on('pet', (d, m) => setRemotePet(m.id, d));
    netTime = world.time; netPet = JSON.stringify(myPet());
  }
  syncRemotes(room);
};
let netTime: TimeOfDay = 'day', netPet = 'null';
netHello = () => friends.room?.sayHello();
let netClock = 0;
function netSend(dt: number, mine: AnimInput) {
  const room = friends.room;
  myBubble.update(dt);
  for (const [peer, p] of remotePets) {
    const r = remotes.get(peer);
    if (!r) continue;
    p.update(dt, r.root.position, r.root.rotation.y, false);
    p.root.visible = !r.away;
  }
  if (!room || !inWorld || (netClock += dt) < 1 / SEND_HZ) return;
  netClock = 0;
  room.sendState(packState(player.body, mine, torch.lit));
  if (world.time !== netTime) { netTime = world.time; room.send('time', netTime); }   // you slept: the room's sky moves on with you
  const pet = JSON.stringify(myPet());
  if (pet !== netPet) { netPet = pet; room.send('pet', myPet()); }
}
let inviteCode = cleanCode(urlFlags.get('room') ?? '');   // an invite link: the panel opens with its code on the first Begin
// ---------- B19: real-skill mini games at the practice table by the dojo mats; cards go in the Skills book ----------
const skillTable = buildSkillTable(world.scene, world.colliders, world.heightAt);
const skills = station(new SkillsPanel((s) => earn(s.reward, `${s.name} card`, 'skill:' + s.id), () => leaveForge()));
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
const gear = station(new GearPanel(() => leaveForge()));
gear.has = { sword: () => sword.owned, crossbow: () => inventory.count('crossbow') > 0 };
function applyGear() { const g = gear.st; for (const s of [sword, sword2]) { s.sharpness = swordSharpness(g); s.setCondition(g.sharp, g.rust); } crossbow.power = crossbow2.power = bowPower(g); }
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
const skillsBook = station(new SkillsBook(skills, () => leaveForge(), () => (gear.st.card ? gearCardHtml(gear.st)
  : `<div class="sk-card locked"><div class="sk-card-head"><span>${GEAR_CARD.icon}</span><b>${GEAR_CARD.title}</b></div><p class="fine">Not learned yet. The smith teaches it at the grindstone outside the smithy.</p></div>`)
  + pushupCardHtml(dojo.st.done.includes('pushup'))));
function openSkillsBook() { if (state !== 'play' && state !== 'pause') return; enterForge(); skillsBook.open(); }
// ---------- B21: the GitHub wiki, pulled at build time, read at the reading room lectern in the Ruined Library ----------
const wiki = station(new WikiPanel());
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
    if (s.kind === 'down') return `Go down to floor ${(descent?.floor ?? 0) + 1}`;
    if (s.kind === 'hoard') return descent?.hoard ? 'The hoard (in your bag now)' : "Take the dragon's hoard";
    if (s.kind === 'camp') return descent?.rested ? 'The camp fire (rested)' : 'Rest at the camp';
    return s.kind === 'stairs' ? (descent ? `Climb out (floor ${descent.floor})` : 'Climb back up') : s.kind === 'chest' ? (d?.chest ? 'An empty chest' : 'Open the chest') : s.kind === 'shrine' ? 'Read the carving' : 'Search the nest';
  }, act: () => {
    const s = spotOf()!, seed = dungeon.layout!.seed, d = delves[seed];
    if (s.kind === 'stairs') { exitDungeon(); return; }
    if (s.kind === 'down') { goDown(); return; }
    if (s.kind === 'camp') {
      if (!descent || descent.rested) { toast('You have rested here already. The stairs are waiting.', 2400); return; }
      descent.rested = true; if (!imbued('hunger')) delveHp = Math.max(delveHp, DELVE_HP);
      gear.st.rust = 0; gear.st.string = 1; gear.st.sharp = Math.max(gear.st.sharp, 0.85); gear.save(); gear.onChange();
      haptics.play('pickup');
      toast(imbued('hunger') ? 'You rest by the fire, but the hungry edge keeps your wounds open. The blade is oiled, the crossbow restrung.' : `You rest by the fire: wounds bound (♥ ${DELVE_HP}/${DELVE_HP}), the blade oiled, the crossbow restrung.`, 4800);
      return;
    }
    if (s.kind === 'hoard') {
      if (!descent || descent.hoard) return;
      descent.hoard = true; inventory.give(CROWN, 250); haptics.play('pickup'); gesture('pickup');
      toast('The hoard: more gold than the whole of Aralon, and a crown on top. Now get it out alive. The stairs up are back at the start.', 6500);
      companion.say('It was true. Oh, it was all true. Go, go!', { force: true });
      return;
    }
    if (s.kind === 'chest') {
      if (d.chest) { toast('Empty. You already took what was here.'); return; }
      d.chest = true; saveDelves();
      inventory.give('trinket', 1); haptics.play('pickup'); gesture('pickup');
      hint(`A trinket from below! Into the bag with it (${keyName('bag')}). Magister Greer would love its story.`, 'A trinket from below (I: inventory). Magister Greer would love to hear its story.', 4500);
      setTimeout(() => { if (inDungeon) dropLoreBook('under the trinket', seed); }, 4700);   // B48
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
// Pets PR 3 (Mike 2026-11-04): the pet with you warns of goblins near you below, and sniffs out what's hidden: a
// clue you haven't found up top, an unopened chest below. It trots over and sits by it until you take it.
let senseClock = 0;
const warnedFoe = new WeakMap<object, number>();
const sniffed = new Set<string>();
let lastWarn = -1e9;
function petSense(dt: number) {
  senseClock += dt;
  if (senseClock < 0.4) return;
  senseClock = 0;
  const p = pets.find((q) => q.following);
  if (!p || state !== 'play') return;
  const me = player.pos, now = performance.now(), who = cap(p.label);
  let warned = false;
  if (inDungeon) {
    let near: { root: THREE.Object3D } | null = null, best = 9;
    for (const f of goblins.alive) { const d = f.root.position.distanceTo(me); if (d < best) { best = d; near = f; } }
    if (near && now - (warnedFoe.get(near) ?? -1e9) > 15000) {
      warnedFoe.set(near, now); warned = true; lastWarn = now;
      p.alert(near.root.position);
      toast(p.sp.kind === 'cat' ? `${who} arches its back and hisses.` : p.sp.kind === 'owl' ? `${who} hoots a warning.` : p.sp.kind === 'hedgehog' ? `${who} rolls into a ball of spines, huffing.` : p.sp.kind === 'hamster' ? `${who} freezes and squeaks a warning.` : `${who} growls low at the dark ahead.`, 2400);
    }
  }
  // What's still hidden near you: an unopened chest below, an unfound clue up top.
  let lead: THREE.Vector3 | null = null, key = '';
  if (inDungeon) {
    const seed = dungeon.layout?.seed, chest = dungeon.spots.find((sp) => sp.kind === 'chest');
    if (seed !== undefined && chest && !delves[seed]?.chest && chest.hit.position.distanceTo(me) < 12) { lead = chest.hit.position; key = 'chest:' + seed; }
  } else {
    for (const c of QUEST.clues) {
      const hb = questProps.hitboxes.get(c.id);
      if (!quest.clues.includes(c.id) && hb && hb.position.distanceTo(me) < 8) { lead = hb.position; key = 'clue:' + c.id; break; }
    }
  }
  p.lead = lead;
  if (lead && !warned && now - lastWarn > 3000 && !sniffed.has(key)) {   // (a warning comes first; the find is said after)
    sniffed.add(key);
    toast(p.sp.kind === 'cat' ? `${who} paws at something nearby.` : p.sp.kind === 'owl' ? `${who} circles something below.` : p.sp.kind === 'hedgehog' ? `${who} snuffles at something here.` : p.sp.kind === 'hamster' ? `${who} digs at something here.` : `${who} has its nose down: something's here.`, 2800);
  }
}
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
function turnWeapon(yaw: number, pitch: number) { forgePreview.turn(yaw, pitch); }
interactables.push(
  { obj: world.stations.mirror, verb: () => 'Change your look', act: () => openCharacterForge() },
  { obj: world.stations.banner, verb: () => 'Sketch at the writing desk', act: () => openSketchbook() },
  { obj: world.stations.anvil, verb: () => inventory.count('crossbow') > 0 ? 'Forge your crossbow' : 'Anvil (bring a crossbow)', act: () => { if (inventory.count('crossbow') > 0) openWeaponForge(); else toast('Natalie has a crossbow you could borrow.'); } },
);
// v0.04 town: one building per tool. E at a door opens it; the shopkeeper trades at the counter.
const shop = station(new ShopPanel(inventory, () => leaveForge()));
function openShop() {
  enterForge();
  const k = world.town.shopkeeper.position, top = new THREE.Vector3(k.x, 1.3, k.z);
  const ry = world.town.shopkeeper.rotation.y, c = Math.cos(ry), sn = Math.sin(ry);
  const pos = new THREE.Vector3(k.x - 2.6 * c + 3.0 * sn, 1.7, k.z + 2.6 * sn + 3.0 * c);   // from the side, past the player's shoulder
  const d = top.clone().sub(pos).normalize(), right = new THREE.Vector3().crossVectors(d, new THREE.Vector3(0, 1, 0)).normalize();
  rig.setShot({ pos, look: top.addScaledVector(right, -0.7), fov: 44 });
  shop.open();
}
// Mike 2026-11-05: the smith's counter by the smithy door sells arms (shields; more in later rounds).
const smithShop = station(new ShopPanel(inventory, () => leaveForge(), true));
smithShop.discount = hasGift(record.delivered, 'smith') ? 0.75 : 1;   // F2 the patrons' gift
smithShop.onBuy = (id) => {
  haptics.play('pickup');
  // A new shield goes straight onto a free hand (the left, unless it holds something you'd miss).
  if ((id === 'shield' || id === 'buckler') && (hands.held.left === 'none' || hands.held.left === 'torch')) { hands.set('left', id); beforeTorch = 'none'; }
};
const smithCounter = new THREE.Mesh(new THREE.BoxGeometry(1.0, 1.5, 1.0), new THREE.MeshBasicMaterial({ visible: false }));
smithCounter.name = 'smith-counter';
const SMITH_LOT = TOWN_LOTS.find((l) => l.id === 'smithy')!;
{ // in front of the smithy, between the sword stand (front left) and the grindstone (front right)
  const L = SMITH_LOT, c = Math.cos(L.ry), sn = Math.sin(L.ry), lx = -L.w / 2 + 1.9, lz = L.d / 2 + 0.9;
  smithCounter.position.set(L.x + lx * c + lz * sn, 0.75, L.z - lx * sn + lz * c);
  smithCounter.userData.front = [sn, c];   // the way out to the street (for tests and the camera)
}
world.scene.add(smithCounter);
{ // the wares on show: a rack with the round shield and the buckler hung on it
  const rack = new THREE.Group(), wood = new THREE.MeshLambertMaterial({ color: '#5A3A22' });
  const post = (x: number) => { const p = new THREE.Mesh(new THREE.BoxGeometry(0.08, 1.2, 0.08), wood); p.position.set(x, 0.6, 0); rack.add(p); };
  post(-0.45); post(0.45);
  const bar = new THREE.Mesh(new THREE.BoxGeometry(1.0, 0.08, 0.08), wood); bar.position.y = 1.15; rack.add(bar);
  const big = buildShield('shield'); big.position.set(-0.2, 0.8, 0.08); rack.add(big);
  const small = buildShield('buckler'); small.position.set(0.28, 0.82, 0.08); rack.add(small);
  rack.position.copy(smithCounter.position).setY(0);
  rack.rotation.y = SMITH_LOT.ry;   // facing the street
  rack.traverse((o) => { (o as THREE.Mesh).raycast = () => {}; });
  world.scene.add(rack);
}
// Mike 2026-11-05: rock piles about town: E gathers a handful (for throwing, or the sling).
const rockPiles: THREE.Object3D[] = [];
{
  const geo = new THREE.IcosahedronGeometry(0.11, 0), mat = new THREE.MeshLambertMaterial({ color: '#8C8780' });
  const spots: [number, number][] = [[FOUNTAIN.x + 3.2, FOUNTAIN.z + 2.6], [GATE.x + 3.5, GATE.z + 3.2], [smithCounter.position.x + smithCounter.userData.front[0] * 2 + 1.5, smithCounter.position.z + smithCounter.userData.front[1] * 2]];
  spots.forEach(([x, z], k) => {
    const pile = new THREE.Group(); pile.name = 'rock-pile';
    for (let i = 0; i < 7; i++) { const r = new THREE.Mesh(geo, mat); const a = i * 2.4 + k; r.position.set(Math.cos(a) * 0.18 * (i % 3), 0.08 + (i > 4 ? 0.12 : 0), Math.sin(a) * 0.18 * (i % 3)); r.rotation.set(a, a * 1.3, 0); r.scale.setScalar(0.8 + (i % 3) * 0.2); r.castShadow = true; pile.add(r); }
    pile.position.set(x, 0, z);
    const hit = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.6, 0.9), new THREE.MeshBasicMaterial({ visible: false })); hit.position.y = 0.3; hit.name = 'rock-pile'; pile.add(hit);
    pile.traverse((o) => { if (o !== hit) (o as THREE.Mesh).raycast = () => {}; });
    world.scene.add(pile); rockPiles.push(hit);
    interactables.push({ obj: hit, verb: () => 'Gather rocks', act: () => { inventory.give('rock', 5); haptics.play('pickup'); gesture('pickup'); toast('Five good throwing stones.', 1600); }, when: () => !inDungeon });
  });
}
interactables.push({ obj: smithCounter, verb: () => 'Buy arms from the smith', act: () => { enterForge(); smithShop.open(); }, when: () => !inDungeon });
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
const { reelScreen, projectionistHit } = buildCinemaSpot(world);
const cinema = station(new CinemaPanel(reelScreen, () => leaveForge()));
function openCinema() { enterForge(); cinema.open(); }
// v0.06 T3: the reels' sound comes from the screen; the fire's music from the fire.
cinema.onVideo = (v) => { const p = reelScreen.position; audio.attachMedia(v, 'cinema', p.x, p.y, p.z, 24); };
let fireOut: AudioNode | null = null;
campfire.out = () => (fireOut ??= audio.spatial('campfire', world.stations.campfire.position.x, 0.8, world.stations.campfire.position.z, 26, 'music'));
const ambience = new Ambience(townZones(world.trees));
const folkVoices = new FolkVoices(townsfolk, ambience);
interactables.push({ obj: projectionistHit, verb: () => 'Watch the Projectionist\'s reels', act: () => openCinema() });
interactables.push({ obj: reelScreen, verb: () => 'Watch the reels', act: () => openCinema() });
function syncCrossbowView() {
  if (crossbow.equipped && viewBeforeCrossbow === null) { viewBeforeCrossbow = player.thirdPerson; player.thirdPerson = false; syncLock(); }
  else if (!crossbow.equipped && viewBeforeCrossbow !== null) { player.thirdPerson = viewBeforeCrossbow; viewBeforeCrossbow = null; if (player.thirdPerson) player.pitch = 0; syncLock(); }
  document.body.dataset.view = player.thirdPerson ? 'follow' : 'first';
  if (rig.inShot) { crossbow.viewmodel.visible = crossbow2.viewmodel.visible = false; sword.viewmodel.visible = sword2.viewmodel.visible = false; }   // a framed dialogue/reading shot shows the player, not the held crossbow
}
// v0.04 Skyrim-style quick swap; Mike 2026-11-05: the D-pad's left / right cycle what that hand holds (nothing,
// sword, crossbow, torch: anything you own, any pair), with a short HUD line saying what's in each hand.
let quickTimer = 0;
function showQuick() {
  const el = $('quick');
  el.innerHTML = `<span>◀ ${HAND_LABEL[hands.held.left]}</span><span>${HAND_LABEL[hands.held.right]} ▶</span>`;
  el.classList.remove('hidden');
  quickTimer = 1.6;
}
// T / hold D-pad down / the 🔥 button: a torch in the left hand, or put every torch out (what that hand held before
// comes back).
let beforeTorch: HandItem = 'none';
function toggleTorch() {
  if (state !== 'play') return;
  if (hands.held.left === 'torch' || hands.held.right === 'torch') {
    for (const h of ['left', 'right'] as Hand[]) if (hands.held[h] === 'torch') hands.set(h, h === 'left' ? beforeTorch : 'none');
    beforeTorch = 'none';
  } else { beforeTorch = hands.held.left; hands.set('left', 'torch'); }
  haptics.play('tap');
  showQuick();
}
function quickSwap(hand: Hand) {
  if (state !== 'play') return;
  hands.cycle(hand);
  if (hand === 'left') beforeTorch = 'none';
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
  gesture('wave');   // B34: say hello
  setState('dialogue');   // F3.3: frees the pointer, freezes movement
  rig.setShot(rig.twoShot(at, 1.55));
  if (document.pointerLockElement) { expectUnlock = true; document.exitPointerLock(); }
  dialogue.start(script, who);   // B30: the portrait is assets/portraits/<who>.png
}
// B50: the first talk opens with a short cinematic (not on Low power or with reduced motion: straight to the box).
const firstMeet = new FirstMeeting((s) => rig.setShot(s));
function talkToNatalie() {
  if (quest.stage === 'none' && !metNatalie() && !firstMeet.active && settings.preset !== 'lowpower' && !reducedMotion.matches) {
    const n = natalieRoot();
    dialogueWith = 'natalie';
    setState('dialogue');
    if (document.pointerLockElement) { expectUnlock = true; document.exitPointerLock(); }
    // Mike 2026-11-05: Greer comes up from the coach road for the scene, a step in front of her and a little aside;
    // they face each other and the hero steps out of frame. All put back when it ends.
    const g = greerRoot(), feet = n.getWorldPosition(new THREE.Vector3()), yaw = n.rotation.y;
    const spot = feet.clone().add(new THREE.Vector3(Math.sin(yaw + 0.45), 0, Math.cos(yaw + 0.45)).multiplyScalar(1.45));
    const keep = { gp: g.position.clone(), gy: g.rotation.y, ny: n.rotation.y, body: player.body.visible };
    g.position.set(spot.x, g.position.y, spot.z); g.rotation.y = Math.atan2(feet.x - spot.x, feet.z - spot.z);
    n.rotation.y = Math.atan2(spot.x - feet.x, spot.z - feet.z);
    player.body.visible = false;
    firstMeet.play(feet, spot, () => {
      g.position.copy(keep.gp); g.rotation.y = keep.gy; n.rotation.y = keep.ny; player.body.visible = keep.body;
      talkTo('natalie', world.natalieTarget.position, natalieScript as DialogueScript);
    });
    return;
  }
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
    { text: 'What is under the library?', next: 'deep' },
  ];
  Object.assign(base.nodes, {
    hint: { text: hint, next: 'n2' },
    wait: { text: n.wait, actions: ['companion:wait'], end: true },
    follow: { text: n.follow, actions: ['companion:follow'], end: true },
    book: { text: 'Read it out to me as you go.', actions: ['casebook:open'], end: true },
    // Mike 2026-11-05: the descent's premise.
    deep: { text: `It moves. The witch in the ruins keeps the whole place in flux: the stairs are never where I left them. They say it goes ${FLOORS} floors down, with a dragon's hoard at the bottom. Bring me the books you find. ${record.deepest ? `The deepest anyone's brought me word from is floor ${record.deepest}.` : 'Nobody has brought me word from very deep yet.'}`, next: 'deep2' },
    deep2: { text: "Only Kavik ever came back from the bottom. His drawing's on the Inn wall. The names on the other wall at the Inn didn't come back at all.", next: 'n2' },
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
    const c = crossbow.boltAt(player.eyePos, lookDir, controls.activateRange) ? crossbow : crossbow2, b = c.boltAt(player.eyePos, lookDir, controls.activateRange);
    if (b) { c.pickUp(b); haptics.play('pickup'); gesture('pickup'); toast('Bolt recovered', 1200); }
  } else if (lookingAt === 'rock') {
    const r = Thrower.rockAt(player.eyePos, lookDir, controls.activateRange);
    if (r) { Thrower.pickUp(r, inventory); haptics.play('pickup'); gesture('pickup'); toast('Rock picked up', 1200); }
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
// ---------- Mike 2026-11-05: four exits, one per side, each to its own map after a load screen ----------
const loadScreen = new LoadScreen();
for (const side of Object.keys(TOWN_EXITS) as Side[]) {
  if (side === 'west') continue;   // the coach-road gate has its own sign
  const e = TOWN_EXITS[side], post = signpost(REGIONS[e.to].name);
  const [ix, iz] = e.inside;
  const sx = side === 'east' ? 0 : 2.2, sz = side === 'east' ? 2.2 : 0;   // beside the path, just inside the edge
  post.position.set(ix + sx, world.heightAt(ix + sx, iz + sz), iz + sz);
  post.rotation.y = e.yaw + Math.PI;   // the board faces you as you walk out
  post.name = 'exit-sign-' + side;
  world.scene.add(post);
}
const regionSpotsAdded = new Set<string>();
function addRegionSpots(id: RegionId) {
  if (id === 'town' || regionSpotsAdded.has(id)) return;
  regionSpotsAdded.add(id);
  for (const sp of regions.spots.get(id) ?? []) interactables.push({ obj: sp.hit, verb: () => sp.verb, when: () => regions.current === id && !travelling, act: () => {
    if (sp.kind === 'back') { travel('town'); return; }
    if (sp.kind === 'gate') haptics.play('tap');
    toast(sp.line ?? '', 5200);
  } });
}
let travelling = false;
const REGION_KEY = 'gametool.region';
const savedRegion = (): RegionId => { try { const r = localStorage.getItem(REGION_KEY) as RegionId | null; return r && (r === 'town' || r in REGIONS) ? r : 'town'; } catch { return 'town'; } };
function placeIn(to: RegionId, from: RegionId) {
  const old = from === 'town' ? null : regions.colliders.get(from);
  if (old) { const set = new Set(old); for (let i = world.colliders.length - 1; i >= 0; i--) if (set.has(world.colliders[i])) world.colliders.splice(i, 1); }
  regions.show(to);
  addRegionSpots(to);
  const fog = world.scene.fog as THREE.Fog;
  if (to === 'town') {
    player.bounds = rig.bounds = companion.bounds = world.bounds;
    world.sky.setCentre(new THREE.Vector3());
    world.setTime(world.time);   // puts the town's fog back
    const side = from === 'town' ? 'north' : REGIONS[from].side, e = TOWN_EXITS[side];
    const at = new THREE.Vector3(e.inside[0], 0, e.inside[1]);
    player.spawn(at, e.yaw);
    if (companion.prefs.follow) natalieRoot().position.copy(at).add(new THREE.Vector3(1.2, 0, 1.2));
    for (const p of pets) if (p.following) p.placeNear(at);
  } else {
    const r = REGIONS[to];
    world.colliders.push(...(regions.colliders.get(to) ?? []));
    player.bounds = rig.bounds = companion.bounds = 2000;
    world.sky.setCentre(new THREE.Vector3(r.origin.x, 0, r.origin.z));   // the dome round the map (the clifftop sees the town inside it)
    if (r.fogFar) { fog.far = r.fogFar; fog.near = r.fogFar * 0.5; }
    const at = r.origin.clone().add(r.arrive);
    player.spawn(at, r.arriveYaw);
    if (companion.prefs.follow) natalieRoot().position.copy(at).add(new THREE.Vector3(1.2, 0, 1.2));
    for (const p of pets) if (p.following) p.placeNear(at);
  }
  try { localStorage.setItem(REGION_KEY, to); } catch { /* private mode */ }
}
/** Walk out to `to` (or home): the load screen covers the move, then lifts. */
function travel(to: RegionId, instant = false) {
  if (travelling || inDungeon || to === regions.current) return;
  const from = regions.current;
  if (instant) { placeIn(to, from); return; }
  travelling = true;
  const r = to === 'town' ? null : REGIONS[to];
  player.speedMul = 0;
  loadScreen.show(r ? r.name : 'Aralon', r ? r.line : 'Back down the road, home to the glade.', () => placeIn(to, from), () => {
    travelling = false; player.speedMul = 1;
    if (r) toast(`${r.name}. The waystone by the path leads back to Aralon.`, 4200);
  });
}
function exitCheck() {
  if (state !== 'play' || inDungeon || travelling) return;
  const x = player.pos.x, z = player.pos.z;
  if (regions.current === 'town') {
    for (const side of Object.keys(TOWN_EXITS) as Side[]) if (TOWN_EXITS[side].trigger(x, z)) { travel(TOWN_EXITS[side].to); return; }
    return;
  }
  const r = REGIONS[regions.current];
  if (r.back(x - r.origin.x, z - r.origin.z)) travel('town');
}
function gateYes() {
  if (!gateOpen) return;
  gateOpen = false;
  $('gateConfirm').classList.add('hidden');
  snapshot(false);
  toMenu('You retired at the gate. Your bag is saved; Begin starts you back at the glade.');
}
$('gateYes').addEventListener('click', () => gateYes());
$('gateGo').addEventListener('click', () => {
  if (!gateOpen) return;
  gateOpen = false;
  $('gateConfirm').classList.add('hidden');
  leaveForge();
  travel('amethyst');
});
$('gateNo').addEventListener('click', () => gateNo());

const extras = new Extras(() => { setState('title'); focusMenu(1); });
extras.portfolio = () => { const author = forgeAuthor(); return { author, pieces: gatherPortfolio(author, (id) => lore.entries.find((e) => e.id === id)?.title ?? id) }; };   // B37
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
// B40: a controller in any open panel (stations, the map, the journal, the books, the lore editor, the margin desk).
// The fight with Kavik has its own controls (src/fight/mode.ts), so the panel controls leave it alone.
function panelRoot(): HTMLElement | null {
  if (state === 'editor') return $('editor');
  if (state === 'book') { const d = reader.isOpen ? readerDesk : lecternDesk; return d.isWriting ? d.deskEl : null; }
  if (state !== 'forge' || fightMode.isOpen || sky.isOpen) return null;
  return topPanel();
}
function panelInput(d: PadDir | 'ok' | 'back') {
  const root = panelRoot();
  if (!root) { if (d === 'back' && state === 'forge' && !fightMode.isOpen && !sky.isOpen) closeForges(); return; }
  if (d === 'ok') { padPress(root); return; }
  if (d === 'back') {
    if (padBack(root)) return;
    if (state === 'editor') closeEditor();
    else if (state === 'book') (reader.isOpen ? readerDesk : lecternDesk).closeDesk();
    else closeForges();
    return;
  }
  if ((d === 'left' || d === 'right') && padNudge(document.activeElement, d === 'right' ? 1 : -1)) return;
  padMove(root, d);
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
  hand: (h, down) => handButton(h, down),
  handTap: (h) => {
    if (state !== 'play') return;
    const it = hands.held[h];
    if (hands.aimsWith(h) || it === 'shield' || it === 'buckler' || it === 'sling') handButton(h, !handDown[h]);   // a latch, like the old Aim button (Block; a sling: whirl, then loose)
    else { handButton(h, true); handButton(h, false); }
  },
  handVerb: (h) => {
    const it = hands.held[h];
    return it === 'spear' ? 'Thrust' : isMelee(it) ? 'Swing' : it === 'crossbow' ? 'Fire' : it === 'shield' || it === 'buckler' ? 'Block'
      : it === 'rock' ? 'Throw' : it === 'sling' ? (handDown[h] ? 'Loose' : 'Whirl') : hands.aimsWith(h) ? 'Aim' : null;
  },
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
  quickEquip: (what) => {   // B28: tap the crossbow or sword to take it in hand; tap it again to put it away
    if (state !== 'play') return;
    if (what === 'crossbow') equip(hands.held.right !== 'crossbow'); else if (hands.held.right === 'sword') hands.set('right', 'none'); else equipSword();
    showQuick();
  },
  torchLit: () => torch.lit,
  quickSwap: (h) => quickSwap(h),
  menuActive: () => !!intro?.active || extras.isOpen || gateOpen || telling.isOpen || quick.isOpen || whatsNew.isOpen || (wiki.isOpen && state !== 'forge') || campfire.isOpen,
  menu: (d) => menuInput(d),
  bandPad: (i) => { if (campfire.isOpen && campfire.section === 'play' && !telling.isOpen) campfire.pad(i); },
  forgeStick: (x, y) => {
    if (weaponForge.isOpen) turnWeapon(x * 0.06, y * 0.04);
    else if (characterForge.isOpen) { player.bodyYaw += x * 0.06; player.body.rotation.y = player.bodyYaw; }   // B40: turn the hero too
  },
  panel: (d) => panelInput(d),
  panelHold: (on) => {
    if (!(gear.isOpen && gear.job === 'sharpen')) return false;
    if (inputMode === 'pad') gear.holding = on;   // B40: hold A to lift the blade, like holding Space
    return true;
  },
  deskOpen: () => (reader.isOpen ? readerDesk : lecternDesk).isWriting,
  bookPen: () => (reader.isOpen ? readerDesk : lecternDesk).pressPen(),
  canSwapShoulder: () => state === 'play' && player.thirdPerson && rig.step === 1 && !crossbow.equipped,
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
    storeSet('gametool.hometip', 'off');
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
    if ((hands.held.right !== 'none' || crossbow.equipped) && (e.target === canvas || document.pointerLockElement)) handButton('right', true);
  }
  if (e.button === 2) { rightHeld = true; handButton('left', true); }   // RMB: the left hand (aims with it empty); in the follow view RMB-drag turns the camera
});
window.addEventListener('mouseup', (e) => {
  if (e.button === 0) {
    mouseHeld = false;
    // S1: a click (not a drag) on something within reach uses it.
    handButton('right', false);
    if (state === 'play' && e.target === canvas && player.thirdPerson && !crossbow.equipped && !sword.equipped && !sword2.equipped && !cursor.dragged && hovering) activate();
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
  $<HTMLInputElement>('seeThrough').checked = settings.seeThrough;
  $<HTMLInputElement>('autoLean').checked = settings.autoLean;
  $<HTMLSelectElement>('cameraLead').value = settings.cameraLead;
  $<HTMLInputElement>('lefty').checked = settings.lefty;
  $<HTMLInputElement>('buttonSize').value = String(settings.buttonSize); $('buttonSizeOut').textContent = settings.buttonSize + '%';
  $<HTMLInputElement>('textSize').value = String(settings.textSize); $('textSizeOut').textContent = settings.textSize + '%';
  $<HTMLInputElement>('readSpeed').value = String(settings.readSpeed); $('readSpeedOut').textContent = settings.readSpeed + '×';
  $<HTMLSelectElement>('viewSel').value = settings.view;
  $<HTMLSelectElement>('charsSel').value = settings.chars;
  presetSel.value = settings.preset;
  renderScaleEl.value = String(settings.renderScale); $('renderScaleOut').textContent = settings.renderScale + '%';
  shadowsEl.checked = settings.shadows; postFxEl.checked = settings.postFx;
  $<HTMLInputElement>('inkLines').checked = settings.inkLines;
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
$<HTMLSelectElement>('cameraLead').addEventListener('change', (e) => { const v = (e.target as HTMLSelectElement).value; settings.cameraLead = v === 'on' || v === 'off' ? v : 'auto'; saveSettings(settings); });
$<HTMLInputElement>('autoLean').addEventListener('change', (e) => { settings.autoLean = (e.target as HTMLInputElement).checked; saveSettings(settings); });   // B41
$<HTMLInputElement>('seeThrough').addEventListener('change', (e) => { settings.seeThrough = (e.target as HTMLInputElement).checked; saveSettings(settings); });
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
  applyQuality(); post?.setEnabled(settings.postFx); world.setFogDistance(settings.fogDistance); syncForest(); nightLights.setMax(LIGHTS[p]);
});
renderScaleEl.addEventListener('input', () => { settings.renderScale = Number(renderScaleEl.value); saveSettings(settings); syncMenu(); applyRenderScale(); });
shadowsEl.addEventListener('change', () => { settings.shadows = shadowsEl.checked; saveSettings(settings); applyQuality(); });
$<HTMLInputElement>('inkLines').addEventListener('change', (e) => { settings.inkLines = (e.target as HTMLInputElement).checked; saveSettings(settings); setOutlines(settings.inkLines); });
postFxEl.addEventListener('change', () => { settings.postFx = postFxEl.checked; saveSettings(settings); post?.setEnabled(settings.postFx); });
fogDistanceEl.addEventListener('input', () => { settings.fogDistance = Number(fogDistanceEl.value); saveSettings(settings); syncMenu(); world.setFogDistance(settings.fogDistance); syncForest(); });
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
  if (waking) {   // B31: the get-up runs its course, or any pad button skips it
    waking = state === 'play' ? waking - dt : 0;
    const pad = [...(navigator.getGamepads?.() ?? [])].some((p) => p?.buttons.some((b) => b.pressed));
    if (waking <= 0 || pad) endWake();
  }
  syncCrossbowView();
  if (state === 'play') {
    simAcc += dt;
    while (simAcc >= SIM_STEP) {
      if (!waking) player.update(SIM_STEP); simAcc -= SIM_STEP; perf.simSeconds += SIM_STEP;   // B31: no moving while getting up
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
    const verb = lookingAt === 'natalie' ? 'Talk to Natalie' : lookingAt === 'bolt' ? 'Pick up bolt' : lookingAt === 'rock' ? 'Pick up rock' : lookingAt === 'thing' ? lookingAtThing!.verb()
      : lookingAt === 'library' && libraryHit ? libraryVerb(libraryHit) : 'Read';
    if (promptVerb.textContent !== verb) promptVerb.textContent = verb;
    crossbow.update(dt); crossbow2.update(dt);
    // B41: auto-lean while aiming at a wall edge, or over low cover when crouched (Settings > Gameplay).
    player.leanWant = settings.autoLean && !rig.inShot ? leanTarget(world.colliders, player.pos.x, player.pos.z, player.pos.y, player.yaw,
      { aiming: crossbow.ads, crouched: player.sneaking, speed: player.hSpeed, eye: player.eyeHeight, stand: controls.eyeHeight }) : NO_LEAN;
    if (crossbow.equipped && !player.thirdPerson && !rig.inShot && !rig.switching) crossbow.applySway();   // B44
    updateSteadyRing();
    sword.update(dt); sword2.update(dt);
    touch?.update();
    coach.update(inputMode, player.pos, player.yaw, lookingAt !== null, !inDungeon);
    if (bestiary) goblins.idle(dt);
  } else { lookingAt = null; crossbow.setADS(false); handDown.left = handDown.right = false; player.leanWant = NO_LEAN; rig.update(dt); updateSteadyRing(); $('coach').classList.add('hidden'); }
  firstDay.update(dt, { waking: waking > 0, writing: sketchPad.isOpen, making: characterForge.isOpen || weaponForge.isOpen, atFire: campfire.isOpen }, state === 'play' && inWorld && !inDungeon);
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
Object.assign(window, { __gametool: { friends, openFriends, remotes, applyQuality, dm, talkToNatalie, get state() { return state; }, get lookingAt() { return lookingAt; }, get lookingAtVerb() { return lookingAtThing?.verb() ?? null; }, get inputMode() { return inputMode; }, get character() { return character; }, dailyPrompt, dialogue, inventory, crossbow, crossbow2, hands, sword2, torch2, shield, shield2, blockBlow, handButton, thrower, thrower2, Thrower, rockPiles, reader, library, modelsReady, loadedModels, failedModels, animators, puppets, characterForge, weaponForge, forgePreview, openCharacterForge, openWeaponForge, interactables, sword, gear, openGear, cook, recipeBook, openRecipeBook, get sturdy() { return sturdy; }, sketchPad, openSketchbook, lecternDesk, readerDesk, quest, questProps, companion, dog, pets, petPrefs, petsPanel, callPet, casebook, firstDay, folklore, pedlarHit, campfire, openCampfire, telling, get satAtFire() { return satAtFire; }, readRedBook: () => townAct.library(), get stationPose() { return stationPose; }, get waking() { return waking; }, fightMode, openFight, sky, openSky, perch, gesture, figureLight, seeThroughUniforms, outlineUniforms, get charsCulled() { return charsCulled; }, get idleSit() { return idleSit; }, get lastRest() { return lastRest; }, wakeUp, endWake, get stationView() { return stationView; }, weaponDisplay, gallery, refreshGallery, openReader, dungeon, enterDungeon, exitDungeon, quick, openQuick, buildQuick, openDescend, get inDungeon() { return inDungeon; }, delves, get delveRun() { return run; }, killStatue, kills, firstMeet, greerRoot, get descent() { return descent; }, record, startDescent, goDown, heroFalls, scrollPicker, applyScrolls, patronGifts, dropLoreBook, applyFlux, get fluxNow() { return fluxNow; }, descentRules: { fluxFor, isCamp }, innWalls, lastWords, innBoards, regions, travel, loadScreen, get travelling() { return travelling; }, natalieRoot, livingMap, openMap, dojo, openDojo, caravan, caravanFolk, openCaravan, phrasebook, openPhrasebook, skills, openSkills, skillsBook, openSkillsBook, wiki, openWiki, townsfolk, crowd, ambience, nightLights, ceilings, autoQ, forestCards, ROOFED, figureKit: { buildFigure, FigureAnim, faceExpression }, goblins, traits: { rollGoblin, describeGoblin, goblinStats, roll, seedOf, rollTownsfolkLook: (seed: number) => rollTownsfolk(seed).look }, get delveHp() { return delveHp; }, get lastHint() { return lastHint; }, hint, purse, wear, tollBell, coach, get autosaves() { return autosaves; }, townAct, set delveHp(n: number) { delveHp = n; }, spawnGoblins, get stationery() { return stationery; }, setStationery, shop, openShop, smithShop, smithCounter, itemCard, openInventory, earn, cinema, openCinema, get intro() { return intro; }, extras, quitToMenu, get gateOpen() { return gateOpen; }, binds, menuInput, camera, Box3: THREE.Box3, Raycaster: THREE.Raycaster, Vector3: THREE.Vector3, player, rig, book, renderer, world, perf, settings, audio, haptics, torch, lockSupported: () => lockSupported } });
