// B18: cooking at the campfire; the Recipe book in the Journal. Moved out of main.ts (2026-11-10).
// main.ts passes what it owns as getters, so nothing is read before it exists.
import * as THREE from 'three';
import { entryById } from '../lore';
import { controls } from '../controls';
import { audio } from '../audio';
import { CookPanel, RecipeBook } from '../cooking/cooking';
import { BUFFS } from '../cooking/recipes';
import { station } from '../stations';
import { loadForge } from '../forge/character';
import { loadWeapon } from '../forge/weapon';
import { FirstDay } from '../quest/firstday';
import { loadBallads, balladEntry, decodeTune, SCALE, type Ballad } from '../campfire/ballad';
import { Gallery, type Exhibit } from '../campfire/gallery';
import { buildCeilings } from '../world/ceilings';
import { drawSketch, loadSketches } from '../writing/sketch';
import { haptics } from '../input/haptics';
import { GROUP_PURSE } from '../quest/groups';
import { NEXT_TIME, type TimeOfDay } from '../world/sky';
import { glyph } from '../input/glyphs';
import type { CookingDeps } from '../main';

export function setupCooking(deps: CookingDeps) {
  const cook = station(new CookPanel(() => { if (deps.state === 'forge') deps.campfire.el.classList.remove('hidden'); }));   // back to the fire
  cook.author = () => deps.forgeAuthor();
  cook.onLearn = (r) => deps.earn(3, `${r.name} recipe`, 'recipe:' + r.id);
  cook.onEat = (b) => { haptics.play('pickup'); deps.toast(`🍽 ${BUFFS[b].name}: ${BUFFS[b].text}`, 3600); };
  deps.campfire.onCook = () => { deps.campfire.el.classList.add('hidden'); deps.groups.mark('station', 'cooking'); cook.open(); };
  const recipeBook = station(new RecipeBook(cook, () => deps.leaveForge()));
  function openRecipeBook() { if (deps.state !== 'play' && deps.state !== 'pause') return; deps.enterForge(); recipeBook.open(); }
  let sturdy = false;   // B18: a "well fed" delve
  // B36: the first-day guided quest. Natalie points the way; test browsers skip it unless gametool.firstdaytest = 'on'.
  const firstDay = new FirstDay(deps.world.scene, {
    read: () => deps.world.town.doors.library.position,
    write: () => deps.world.town.doors.scriptorium.position,
    make: () => deps.world.town.doors.tailor.position,
    fire: () => deps.world.stations.campfire.position,
  }, (text) => { deps.companion.say(text, { force: true, ms: 5200 }); }, (skipped) => { if (!skipped) deps.earn(10, 'for your first day', 'firstday'); });
  function firstDayOn() {
    try { return !navigator.webdriver || localStorage.getItem('gametool.firstdaytest') === 'on'; } catch { return !navigator.webdriver; }
  }
  deps.casebook.extra = () => firstDay.casebookHtml();
  deps.casebook.tabs = () => deps.groups.html();   // B52/B53: the quest groups under the first day
  deps.groups.onStep = (kind, name, n, total, finished) => {
    if (finished) { deps.earn(GROUP_PURSE, kind === 'npc' ? 'for meeting everyone in Aralon' : 'for using every station', 'group:' + kind); return; }
    deps.toast(kind === 'npc' ? `Met ${name}: ${n} of ${total} people (casebook).` : `${name}: ${n} of ${total} stations used (casebook).`, 2600);
  };
  // Lore-first item 4: the side games (dojo, spar, sky run, trapdoor) wait until a new friend's first day is done, so the
  // first thing they meet is the lore. The prompt still shows, so they know it's there for later.
  function sideGate(verb: string) { return firstDay.sideGamesOpen ? verb : `${verb} (after your first day)`; }
  function sideGo(open: () => void) {
    if (firstDay.sideGamesOpen) { open(); return; }
    deps.companion.say('That can wait for tomorrow. Today is for stories: follow the gold light. (Or skip the first day in the casebook.)', { force: true, ms: 4800 });
  }
  deps.casebook.onExtra = (id) => { if (id === 'fdSkip') firstDay.skip(); };
  const campfireClosed = deps.campfire.onClose;
  // v0.06 C3: the band's note keys show pad buttons while a controller is in use, and swap back live.
  const NOTE_BUTTONS = (() => { const B = controls.gamepad.buttons; return [B.reload, B.jump, B.zoomIn, B.zoomOut, B.aim, B.fire]; })();
  document.addEventListener('glyphs', () => deps.campfire.setPadGlyphs(deps.inputMode === 'pad' ? (i) => glyph(deps.gamepad?.family ?? 'xbox', NOTE_BUTTONS[i]) : null));
  // v0.06 C1–C2: Sleep is the first item at the fire; sitting down is what unlocks it, so it is always open here.
  deps.campfire.sleepLabel = () => `Sleep until ${WAKE_AT[NEXT_TIME[deps.world.time]]}`;
  deps.campfire.onSleep = () => sleep(true);
  deps.campfire.onClose = () => {
    if (deps.natalieWas && !deps.companion.prefs.follow) { const n = deps.natalieRoot(); n.position.set(deps.natalieWas.x, 0, deps.natalieWas.z); n.rotation.y = deps.natalieWas.ry; }
    deps.natalieWas = null;
    campfireClosed();
  };
  deps.interactables.push({ obj: deps.world.stations.campfire, verb: () => 'Sit by the fire', act: () => deps.openCampfire() });
  // v0.04: sleep on the bedroll. The view fades out, the time of day moves on (day -> sunset -> night -> day),
  // and it fades back in.
  const WAKE_AT: Record<TimeOfDay, string> = { day: 'morning', sunset: 'sunset', night: 'nightfall' };
  let sleeping = false;
  function sleep(onBedroll = false) {
    if (sleeping) return;
    sleeping = true;
    if (onBedroll) {   // v0.06 S1: kneel on the bedroll while the view fades
      const b = deps.world.stations.bedroll.position;
      deps.takeStation(new THREE.Vector3(b.x - 0.6, 0, b.z + 0.2), b, 'kneel');
    }
    deps.lastRest = onBedroll ? 'camp' : 'inn';   // B31: Continue wakes here
    const fade = deps.$('sleepFade');
    fade.classList.add('on');
    setTimeout(() => {
      const next = NEXT_TIME[deps.world.time];
      deps.setWorldTime(next, true);
      deps.autoSave();
      fade.classList.remove('on');
      sleeping = false;
      if (deps.stationPose === 'kneel') deps.stationPose = null;
      if (next === 'night') deps.hint(`Nightfall already. Light your torch: ${deps.keyName('torch')}.`, 'You wake at nightfall. Light your torch (T).', 2600);
      else deps.toast(`You wake at ${WAKE_AT[next]}.`, 2600);
    }, 1100);
  }
  deps.interactables.push({ obj: deps.world.stations.bedroll, verb: () => deps.satAtFire ? `Sleep until ${WAKE_AT[NEXT_TIME[deps.world.time]]}` : 'Bedroll (sit by the fire first)',
    act: () => { if (deps.satAtFire) sleep(true); else deps.toast('Sit by the fire first. Rest comes after the camp has settled.', 2600); }, when: () => !deps.inDungeon });
  async function openBallad(b: Ballad) {
    deps.setState('book');
    if (document.pointerLockElement) { deps.expectUnlock = true; document.exitPointerLock(); }
    const t = decodeTune(b.tune);
    audio.tune(t.steps, SCALE, t.instrument, t.bpm, 2);
    await deps.reader.openEntries([balladEntry(b, deps.forgeAuthor())]);
  }
  const gallery = new Gallery(deps.world.scene, deps.world.colliders);
  const ceilings = buildCeilings(deps.world.scene);
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
    const me = deps.forgeAuthor() || 'you', out: Exhibit[] = [];
    let forged = false, weapon = false;
    try { forged = !!localStorage.getItem('gametool.forge.character'); weapon = !!localStorage.getItem('gametool.forge.weapon'); } catch { /* blocked */ }
    const f = loadForge(deps.character.name), w = loadWeapon();
    out.push({ id: 'me', title: f.name || deps.character.name || 'Your hero', credit: me, kind: 'hero', text: f.backstory || 'A traveller with no story written yet.', discovered: forged, hint: 'Forge your hero at the camp mirror.', paint: portrait(f.look) });
    out.push({ id: 'weapon', title: w.name || 'Your crossbow', credit: me, kind: 'weapon', text: w.legend || w.engraving || 'Forged at the camp anvil.', discovered: weapon, hint: 'Forge a crossbow at the camp anvil.', paint: textTile([w.name || 'A crossbow', '', ...(w.legend || '').match(/.{1,24}(\s|$)/g) ?? []]) });
    const sk = loadSketches()[0];
    out.push({ id: 'banner', title: sk?.name || 'Your crest', credit: me, kind: 'sketch', text: 'Painted in the sketchbook.', discovered: !!sk, hint: 'Sketch at the writing desk in camp.',
      paint: sk ? (g, x, y, size) => { g.imageSmoothingEnabled = false; drawSketch(g, sk, x + (size - 192) / 2, y + 2, 6); } : undefined });
    const bd = loadBallads()[0];
    out.push({ id: 'ballad', title: bd?.title || 'Your ballad', credit: me, kind: 'song', text: bd ? bd.verses.slice(0, 2).map((v) => v.join(' / ')).join('\n') : '', discovered: !!bd, hint: 'Tell your story to the bard at the campfire.',
      paint: bd ? textTile(bd.verses[0] ?? []) : undefined, open: bd ? () => { deps.leaveForge(); void openBallad(bd); } : undefined });
    out.push({ id: 'theory', title: 'Your theory', credit: me, kind: 'theory', text: deps.quest.theory?.text ?? '', discovered: !!deps.quest.theory, hint: "Write what you think happened to Natalie's party.",
      paint: deps.quest.theory ? textTile((deps.quest.theory.text.match(/.{1,24}(\s|$)/g) ?? []).map((l) => l.trim())) : undefined });
    for (const id of ['natalie-bourbon', 'straphan-at-sunset', 'song-of-the-paved-road']) {
      const e = entryById.get(id);
      if (!e) continue;
      const plain = e.body.replace(/^#.*$/m, '').replace(/[*_#>[\]]|chords:.*$/gm, '').trim();
      out.push({ id, title: e.title, credit: e.credit_as, kind: e.type, text: plain.slice(0, 400), discovered: deps.seen.includes('entry:' + id), hint: 'Find it in the Ruined Library.',
        open: () => { deps.leaveForge(); void deps.openReader(id); } });
    }
    return out;
  }
  function refreshGallery() { gallery.paint(galleryExhibits()); }
  refreshGallery();
  gallery.hitboxes.forEach((hb, i) => deps.interactables.push({ obj: hb, verb: () => { const e = gallery.exhibits[i]; return e?.discovered ? `Look at "${e.title}"` : 'Look at the empty frame'; }, act: () => {
    const e = gallery.exhibits[i];
    if (!e) return;
    deps.enterForge();
    galleryCard = gallery.showCard(e, () => { galleryCard = null; deps.leaveForge(); });
    galleryCard.querySelector('[data-act=open]')?.addEventListener('click', () => { galleryCard = null; });
  } }));
  let inGallery = false;
  return { firstDayOn, firstDay, get inGallery() { return inGallery; }, set inGallery(v) { inGallery = v; }, refreshGallery, get galleryCard() { return galleryCard; }, set galleryCard(v) { galleryCard = v; }, sideGate, sideGo, get sturdy() { return sturdy; }, set sturdy(v) { sturdy = v; }, cook, portrait, sleep, WAKE_AT, openRecipeBook, recipeBook, gallery, ceilings };
}
