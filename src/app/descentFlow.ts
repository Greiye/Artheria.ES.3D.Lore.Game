// The descent: starting a run, going down, scrolls, flux floors, falling, climbing out, entering and leaving the dungeon. Moved out of main.ts (2026-11-10).
// main.ts passes what it owns as getters, so nothing is read before it exists.
import * as THREE from 'three';
import { STAIRS } from '../world/stairs';
import { STARTING_CROWNS } from '../economy';
import { audio } from '../audio';
import { saveCharacter } from '../character';
import { ITEMS } from '../inventory';
import { station } from '../stations';
import { type Shot } from '../camera/rig';
import { loadForge } from '../forge/character';
import { drawSketch, loadSketches } from '../writing/sketch';
import { THEME as DUNGEON_THEME } from '../dungeon/dungeon';
import { MAX_FOES } from '../foes/goblins';
import { type Layout } from '../dungeon/gen';
import { haptics } from '../input/haptics';
import { Thrower } from '../sling';
import { CROWN } from '../shop';
import { FLOORS, band, BAND_NOTE, hpMul, dmgBonus, maxFoesFor, newDescent, saveRecord, addFallen, addSurvivor, isCamp, fluxFor, FLUX_NOTE, GUARDIAN_NAMES, carryOff, GIFTS, hasGift, type Descent, type Flux } from '../delve/descent';
import { ScrollPicker, offerScrolls, type ScrollSlot } from '../delve/scrolls';
import { DescentCine } from '../cinematic/descend';
import { floorHint, type FloorHint } from '../delve/hints';
import { clearGame } from '../save';
import type { DescentFlowDeps } from '../main';

export function setupDescentFlow(deps: DescentFlowDeps) {
  /** Start a run at floor 1 (from the trapdoor). */
  function startDescent(from = 1) {
    deps.groups.mark('station', 'descent');   // B52/B53
    deps.descent = newDescent(from);
    // B51: the very first run is the tutorial: you always come back from it, and there's no timer.
    if (!deps.record.tutorialDone && deps.record.runs === 0 && deps.tutorialOn()) deps.descent.tutorial = true;
    deps.record.runs++; saveRecord(deps.record);
    // Mike 2026-11-05: through the trapdoor and down the stairs (src/cinematic/descend.ts); the floor is built under black.
    const yaw = deps.player.yaw, fx = -Math.sin(yaw), fz = -Math.cos(yaw), p = deps.player.pos;
    const opening = { pos: new THREE.Vector3(p.x - fx * 1.6 + fz * 0.7, p.y + 2.3, p.z - fz * 1.6 - fx * 0.7), look: new THREE.Vector3(p.x + fx * 1.2, p.y, p.z + fz * 1.2), fov: 52 };
    playDescent('enter', 0, from, opening, () => enterDungeon(deps.sharedSeed(from), from), () => {
      deps.companion.say(deps.descent?.tutorial ? "Your first time down. I'll keep watch: whatever happens, you come back up from this one. After today, each floor gives you eight minutes to reach the stairs." : 'Thirty floors, they say. Bring me what you find. Bring yourself back too.', { force: true });
      // F2: the patrons' scroll before the first step.
      const opts = hasGift(deps.record.delivered, 'scroll') ? offerScrolls([], ownsSlot) : [];
      if (opts.length) {
        deps.enterForge();
        scrollPicker.open(opts, from, (sc) => { deps.leaveForge(); if (sc && deps.descent) { (deps.descent.scrolls ??= []).push(sc.id); applyScrolls(); deps.toast(`${sc.name}: ${sc.boon}${sc.curse ? ` Curse: ${sc.curse}` : ''}`, 5200); } });
      }
    });
  }
  /** Mike 2026-11-05: the stair cinematic. `build` makes the floor (under black) and returns its layout; `after` runs
   *  when the ride is over. The floor card and the hint lines come from what was actually built. */
  const descendCine = new DescentCine(deps.world.scene, (s, cut) => deps.rig.setShot(s, cut));
  function playDescent(kind: 'enter' | 'down', from: number, to: number, opening: Shot | undefined, build: () => Layout, after: () => void) {
    deps.player.held.clear(); deps.mouseHeld = false;
    descendCine.play({
      kind, opening, reduced: deps.reducedMotion.matches, light: deps.settings.preset === 'lowpower',
      eyebrow: kind === 'enter' ? 'Under the Ruined Library' : `Leaving Floor ${from}`,
      title: `Floor ${to} of ${FLOORS}`,
      mid: () => {
        const L = build();
        const hint = floorHint(floorInfo(L, to, from));
        const T = DUNGEON_THEME[L.theme];
        return { hint, palette: { wall: T.wall, floor: T.floor, torch: T.torch, fog: T.fog } };
      },
      sound: (h) => audio.stairs(h.fx, h.rumble, kind === 'enter' ? 2.6 : 2.2),
      done: (h: FloorHint | null) => {
        if (kind === 'down' && h && deps.companion.prefs.follow) deps.companion.say(h.natalie, { force: true });
        const B = band(to);
        if (from > 0 && B !== band(from) && BAND_NOTE[B]) deps.toast(BAND_NOTE[B], 4200);
        else if (deps.descent?.flux && deps.descent.flux !== 'none') deps.toast(FLUX_NOTE[deps.descent.flux], 4200);
        after();
      },
    });
  }
  /** What the hint reads off a freshly built floor (src/delve/hints.ts). */
  function floorInfo(L: Layout, floor: number, from: number) {
    let tiles = 0, pools = 0;
    for (const v of L.grid) { if (v) tiles++; if (v === 2) pools++; }
    const g = deps.record.guardians.indexOf(floor), lost = [...deps.carried.values()][0];
    return {
      floor, flux: deps.descent?.flux ?? 'none', theme: L.theme, poolShare: tiles ? pools / tiles : 0,
      guardian: g >= 0 ? GUARDIAN_NAMES[g % GUARDIAN_NAMES.length] : null, camp: isCamp(floor),
      newBand: from > 0 && band(floor) !== band(from) ? band(floor) : -1,
      lostItem: lost ? `${lost.owner}'s ${ITEMS[lost.item]?.name.toLowerCase() ?? lost.item}` : null, hoard: floor === FLOORS,
    } as const;
  }
  // F1: the witch's scrolls on the top step, each time you go down.
  const scrollPicker = station(new ScrollPicker());
  const imbued = (id: string) => !!deps.descent?.scrolls?.includes(id);
  function ownsSlot(slot: ScrollSlot): boolean {
    const c = (id: string) => deps.inventory.count(id) > 0;
    return slot === 'melee' ? ['sword', 'dagger', 'mace', 'spear'].some(c) : slot === 'crossbow' ? c('crossbow') : slot === 'shield' ? c('shield') || c('buckler')
      : slot === 'throw' ? c('rock') || c('sling') : true;
  }
  function applyScrolls() {
    Thrower.bonus = imbued('stone') ? 0.6 : 0;
    deps.goblins.booksFirst = imbued('swift');
  }
  /** Down the stairs in the deepest room: first the scrolls (unless `skipScrolls`), then the next floor behind the load screen. */
  function goDown(skipScrolls = false) {
    if (!deps.descent || !deps.inDungeon) return;
    const next = deps.descent.floor + 1;
    if (!skipScrolls) {
      const opts = offerScrolls(deps.descent.scrolls ?? [], ownsSlot);
      if (opts.length) {
        deps.enterForge();
        scrollPicker.open(opts, next, (sc) => {
          deps.leaveForge();
          if (sc && deps.descent) { (deps.descent.scrolls ??= []).push(sc.id); applyScrolls(); deps.toast(`${sc.name}: ${sc.boon}${sc.curse ? ` Curse: ${sc.curse}` : ''}`, 5200); }
          goDown(true);
        });
        return;
      }
    }
    const from = deps.descent.floor;
    deps.descent.flux = fluxFor(next, deps.record.guardians);
    // Mike 2026-11-05: down the spiral stairs, with a hint of what's below (src/cinematic/descend.ts).
    playDescent('down', from, next, undefined, () => {
      deps.descent!.floor = next; deps.descent!.rested = false;
      clearFloor();
      return enterDungeon(deps.sharedSeed(next), next, true);
    }, () => undefined);
  }
  /** Take the current floor's walls and goblins away (between floors). */
  function clearFloor() {
    const set = new Set(deps.dungeon.colliders);
    for (let i = deps.world.colliders.length - 1; i >= 0; i--) if (set.has(deps.world.colliders[i])) deps.world.colliders.splice(i, 1);
    deps.goblins.clear(); deps.dungeon.hideSpots();
  }
  /** `floor` > 0: a floor of the descent (stairs down, harder goblins); 0: the old walk-about dungeon. `between`: already below. */
  function enterDungeon(seed: number, floor = 0, between = false): Layout {
    const L = deps.dungeon.build(seed, { down: floor > 0 && floor < FLOORS, hoard: floor === FLOORS, camp: isCamp(floor) });
    if (deps.descent && floor) { deps.descent.stairsLeft = deps.descent.tutorial ? undefined : deps.STAIRS_TIME; deps.stairsTimerM.stairsWarned = 0; }   // B51
    if (deps.descent && floor && deps.descent.flux === undefined) deps.descent.flux = fluxFor(floor, deps.record.guardians);
    deps.dungeon.group.visible = true;
    deps.world.colliders.push(...deps.dungeon.colliders);
    deps.goblins.floor = floor; deps.goblins.band = floor ? band(floor) : 0; deps.goblins.hpMul = floor ? hpMul(floor) : 1; deps.goblins.dmgBonus = floor ? dmgBonus(floor) : 0;
    deps.goblins.maxFoes = floor ? maxFoesFor(floor) : MAX_FOES;
    if (deps.descent) deps.goblins.habits = { sword: deps.descent.swordHits, bolt: deps.descent.boltHits };
    if (between) {
      const fog = deps.world.scene.fog as THREE.Fog;
      fog.color.set(deps.dungeon.fog); fog.near = 4; fog.far = 34; (deps.world.scene.background as THREE.Color).set(deps.dungeon.fog);
      deps.player.spawn(deps.dungeon.entrance(), deps.dungeon.entranceYaw());
      if (deps.companion.prefs.follow) deps.natalieRoot().position.copy(deps.dungeon.entrance()).add(new THREE.Vector3(1.2, 0, 0.8));
      for (const p of deps.pets) if (p.following) p.placeNear(deps.dungeon.entrance());
      deps.delveRewardsM.lastRoom = -1;
      deps.spawnGoblins(true);
      applyFlux(deps.descent?.flux ?? 'none');
      deps.delves[seed] = { theme: L.theme, at: new Date().toISOString().slice(0, 10) }; pruneDelves(); deps.saveDelves();
      const g = deps.record.guardians.indexOf(floor), extraNote = g >= 0 ? ` ${GUARDIAN_NAMES[g % GUARDIAN_NAMES.length]} guards this floor.` : isCamp(floor) ? ' A rest camp by the stairs.' : '';
      if (!descendCine.active) deps.toast(`Floor ${floor} of ${FLOORS} · ${L.theme}.${floor === FLOORS ? ' Gold glints in the deepest room.' : ' The stairs down are in the deepest room.'}${extraNote}${deps.descent?.flux && deps.descent.flux !== 'none' ? ' ' + FLUX_NOTE[deps.descent.flux] : ''}`, 5200);
      return L;
    }
    deps.player.bounds = deps.rig.bounds = deps.companion.bounds = 2000;
    const fog = deps.world.scene.fog as THREE.Fog;
    deps.savedFog = { color: fog.color.clone(), near: fog.near, far: fog.far, bg: (deps.world.scene.background as THREE.Color).clone() };
    fog.color.set(deps.dungeon.fog); fog.near = 4; fog.far = 34; (deps.world.scene.background as THREE.Color).set(deps.dungeon.fog);
    deps.player.spawn(deps.dungeon.entrance(), deps.dungeon.entranceYaw());
    if (deps.companion.prefs.follow) deps.natalieRoot().position.copy(deps.dungeon.entrance()).add(new THREE.Vector3(1.2, 0, 0.8));
    for (const p of deps.pets) if (p.following) p.placeNear(deps.dungeon.entrance());
    deps.inDungeon = true; deps.swordHitsAtEntry = deps.sword.hits + deps.sword2.hits; deps.sturdy = deps.cook.consume('sturdy');
    deps.delveRewardsM.run = { rooms: 0, crowns: 0, books: [] }; deps.delveRewardsM.lastRoom = -1; deps.killRecordM.runKills = 0; deps.killRecordM.recordToasted = false;
    deps.spawnGoblins();
    deps.delves[seed] = { ...(deps.delves[seed] ?? {}), theme: L.theme, at: new Date().toISOString().slice(0, 10) };
    if (floor) pruneDelves();
    deps.saveDelves();
    applyFlux(deps.descent?.flux ?? 'none');
    if (floor) { if (!descendCine.active) deps.toast(`Floor ${floor} of ${FLOORS} · ${L.theme}. The library has moved again. The stairs down are in the deepest room.`, 4500); }
    else deps.toast(`Under the library · seed ${seed} · ${L.theme}. Same seed, same dungeon.`, 4500);
    if (!floor) deps.companion.say('Stay close. I can hear something chewing.', { key: 'dungeon:' + seed, force: true });
    return L;
  }
  /** Up the stairs alive: the carried books go to Natalie (and the gallery), the deepest floor is recorded. With the
   *  hoard, it's the good ending: the hero's drawing goes up on the Inn's survivors' wall and they retire. */
  function climbOut(d: Descent) {
    for (const id of d.books) deps.markSeen('entry:' + id);
    if (d.books.length) deps.refreshGallery();
    deps.record.delivered += d.books.length; deps.record.deepest = Math.max(deps.record.deepest, d.floor); saveRecord(deps.record);
    deps.stolenBooks.clear();
    patronGifts();
    const n = d.books.length;
    if (d.hoard) { goodEnding(d); return; }
    deps.toast(`Out alive from floor ${d.floor}.${n ? ` Natalie takes ${n} book${n > 1 ? 's' : ''}; they're on the gallery shelves now.` : ' No books this time.'} Deepest so far: floor ${deps.record.deepest}.`, 6000);
    if (n) deps.companion.say(n > 2 ? 'This many? I\'ll be up all night. Thank you.' : 'Another one for the shelf. Thank you.', { force: true });
  }
  /** F2: the patrons' gifts. Natalie's patron (Greer's friend) sends something as the books add up; kept from hero to hero. */
  function patronGifts(announce = true) {
    deps.smithShop.discount = hasGift(deps.record.delivered, 'smith') ? 0.75 : 1;
    const fresh = GIFTS.filter((g) => deps.record.delivered >= g.at && !deps.record.gifts.includes(g.at));
    if (!fresh.length) return;
    deps.record.gifts.push(...fresh.map((g) => g.at)); saveRecord(deps.record);
    if (!announce) return;
    setTimeout(() => {
      deps.toast(`Natalie's patrons send their thanks: ${fresh.map((g) => `${g.name} (${g.text})`).join(' ')}`, 7000);
      deps.companion.say('Greer brought word from my patron. They\'re pleased, and they\'ve sent something for whoever goes down next.', { force: true });
    }, 6500);
  }
  /** A drawing of the hero for the survivors' wall: their newest sketch, else a drawn portrait. */
  function heroArt(): string | null {
    try {
      const c = document.createElement('canvas'); c.width = c.height = 128;
      const g = c.getContext('2d')!; g.fillStyle = '#EADBB4'; g.fillRect(0, 0, 128, 128);
      const sk = loadSketches()[0];
      if (sk) { g.imageSmoothingEnabled = false; drawSketch(g, sk, 0, 0, 4); } else deps.portrait(loadForge(deps.character.name).look)(g, 0, 0, 128);
      return c.toDataURL('image/png');
    } catch { return null; }
  }
  const heroName = () => loadForge(deps.character.name).name || deps.character.name || 'A stranger';
  /** Hero over (fallen or retired): the bag, crowns and hands go; the next hero starts at the glade and makes themself at the mirror. */
  function newHero(note: string) {
    for (const [id] of [...deps.inventory.counts]) deps.inventory.counts.set(id, 0);
    deps.inventory.render(); deps.purse.set(0);
    deps.hands.set('left', 'none'); deps.hands.set('right', 'none'); deps.hands.save();
    deps.syncStandSword();
    clearGame();
    try { localStorage.removeItem(deps.REGION_KEY); } catch { /* blocked */ }
    deps.record.heroes++; saveRecord(deps.record);
    deps.character = { ...deps.character, name: '', created: false, profession: '' }; saveCharacter(deps.character);
    deps.player.spawn(deps.world.spawn.pos, deps.world.spawn.yaw);
    deps.rolledGoblinsM.delveHp = deps.DELVE_HP;
    deps.inventory.give(CROWN, STARTING_CROWNS + (hasGift(deps.record.delivered, 'purse') ? 20 : 0));   // Mike 2026-11-09: a new hero starts with 500
    deps.toast(note, 6500);
    setTimeout(() => { if (deps.state === 'play') deps.openCharacterForge(); }, 600);
  }
  function heroFalls(by: string) {
    const d = deps.descent!, name = heroName();
    deps.friends.room?.send('fell', d.floor);   // Round D4: the room hears; your place goes back up top, so your goblins pass on
    const taken = carryOff([...deps.inventory.counts.keys()].filter((id) => deps.inventory.count(id) > 0), d.floor, name);
    deps.record.lostGear = [...deps.record.lostGear, ...taken].slice(-12); saveRecord(deps.record);
    exitDungeon(true);
    deps.descent = null;
    deps.enterForge();
    deps.lastWords.open({ name, floor: d.floor, by, books: deps.record.delivered, lost: d.books.length }, (words) => {
      addFallen({ name, floor: d.floor, books: deps.record.delivered, by, at: new Date().toISOString().slice(0, 10), words });
      deps.record.deepest = Math.max(deps.record.deepest, d.floor); saveRecord(deps.record);
      deps.innBoards.refresh();
      deps.leaveForge();
      newHero(`${name} is on the tally at the Inn now. A new hero wakes at the glade; the mirror at camp will make them.`);
    });
  }
  function goodEnding(d: Descent) {
    const name = heroName();
    addSurvivor({ name, at: new Date().toISOString().slice(0, 10), art: heroArt(), line: `Floor ${d.floor} and back, with the hoard.` });
    deps.innBoards.refresh();
    deps.enterForge();
    deps.innWalls.open('survivors', () => {
      deps.leaveForge();
      newHero(`${name} came back from the hoard alive. Their drawing is on the Inn wall, beside Kavik's, and they've hung up their boots. A new hero wakes at the glade.`);
    });
    deps.toast(`${name} climbs out with the dragon's hoard. The rumour was true.`, 6000);
  }
  // E2: flux floors. Dark (the fog closes in), flooded (water to the knee: slow), burning (fire along the walls; the
  // heat bites now and then), light (you fall slowly and jump high).
  let fluxNow: Flux = 'none', fluxHeat = 0;
  const fluxFx = new THREE.Group(); fluxFx.name = 'flux-fx';
  function applyFlux(f: Flux) {
    fluxNow = f; fluxHeat = 6;
    fluxFx.clear(); fluxFx.removeFromParent();
    deps.player.gravityMul = f === 'light' ? 0.38 : 1;
    if (f === 'none' || !deps.dungeon.layout) return;
    const fog = deps.world.scene.fog as THREE.Fog, o = deps.dungeon.entrance();
    if (f === 'dark') { fog.near = 1; fog.far = 9; fog.color.set('#020203'); (deps.world.scene.background as THREE.Color).set('#020203'); }
    if (f === 'flooded') {
      const water = new THREE.Mesh(new THREE.PlaneGeometry(80, 80).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: '#2E5A6A', transparent: true, opacity: 0.55, depthWrite: false }));
      water.position.set(o.x, 0.28, o.z); water.raycast = () => {}; fluxFx.add(water);
      fog.color.set('#16303A'); (deps.world.scene.background as THREE.Color).set('#16303A');
    }
    if (f === 'burning') {
      const fire = new THREE.MeshBasicMaterial({ color: '#FF7A2A' }), core = new THREE.MeshBasicMaterial({ color: '#FFD86A' });
      for (const r of deps.dungeon.layout.rooms) for (let k = 0; k < 3; k++) {
        const at = deps.dungeon.roomAt(r, k - 1, -Math.floor(r.h / 2));
        const c1 = new THREE.Mesh(new THREE.ConeGeometry(0.35, 1.1, 6), fire); c1.position.set(at.x, 0.55, at.z + 0.6); fluxFx.add(c1);
        const c2 = new THREE.Mesh(new THREE.ConeGeometry(0.18, 0.7, 5), core); c2.position.set(at.x, 0.5, at.z + 0.6); fluxFx.add(c2);
      }
      fluxFx.traverse((m) => { m.raycast = () => {}; });
      fog.color.set('#3A160A'); (deps.world.scene.background as THREE.Color).set('#3A160A');
    }
    deps.dungeon.group.add(fluxFx);
  }
  function fluxTick(dt: number) {
    if (!deps.inDungeon || fluxNow !== 'burning' || deps.state !== 'play' || descendCine.active) return;
    if ((fluxHeat -= dt) > 0) return;
    fluxHeat = 9;
    deps.rolledGoblinsM.delveHp = Math.max(1, deps.rolledGoblinsM.delveHp - 1); deps.rolledGoblinsM.hurtFlash = 0.3; haptics.play('hurt');
    deps.toast('The heat from the burning shelves scorches you.', 2000);
  }
  /** The descent makes a new layout every floor; keep only the newest few in the delves record. */
  function pruneDelves() { const ks = Object.keys(deps.delves); for (const k of ks.slice(0, Math.max(0, ks.length - 40))) delete deps.delves[k]; }
  function exitDungeon(fell = false) {
    if (!deps.inDungeon) return;
    const run_ = deps.descent;
    if (run_?.tutorial && !deps.record.tutorialDone) { deps.record.tutorialDone = true; saveRecord(deps.record); setTimeout(() => deps.toast('That was your first descent. From now on each floor gives you 8 minutes to reach a staircase, down or back up. Run out and the dark takes you.', 7000), 2600); }   // B51
    if (!fell) deps.descent = null;
    deps.goblins.floor = deps.goblins.band = 0; deps.goblins.hpMul = 1; deps.goblins.dmgBonus = 0; deps.goblins.maxFoes = MAX_FOES;
    applyFlux('none');
    if (!fell) { Thrower.bonus = 0; deps.goblins.reveal = deps.goblins.booksFirst = false; }
    deps.runSummary();
    if (run_ && !fell) setTimeout(() => climbOut(run_), 0);
    if (deps.killRecordM.statueDirty) { deps.killRecordM.statueDirty = false; deps.killStatue.set(deps.kills); }
    if (deps.sword.hits + deps.sword2.hits > deps.swordHitsAtEntry) { deps.gear.rustSword(); deps.toast('Goblin blood and cellar damp: your blade is spotting with rust. The smith\'s oil will fix it.', 3600); }   // B17
    deps.inDungeon = false;
    const set = new Set(deps.dungeon.colliders);
    for (let i = deps.world.colliders.length - 1; i >= 0; i--) if (set.has(deps.world.colliders[i])) deps.world.colliders.splice(i, 1);
    deps.player.bounds = deps.rig.bounds = deps.companion.bounds = deps.world.bounds;
    const fog = deps.world.scene.fog as THREE.Fog;
    if (deps.savedFog) { fog.color.copy(deps.savedFog.color); fog.near = deps.savedFog.near; fog.far = deps.savedFog.far; (deps.world.scene.background as THREE.Color).copy(deps.savedFog.bg); }
    deps.dungeon.group.visible = false; deps.dungeon.hideSpots();
    deps.goblins.clear(); deps.rolledGoblinsM.slowT = 0; deps.player.speedMul = 1; deps.sturdy = false;
    deps.player.spawn(new THREE.Vector3(STAIRS.x, 0, STAIRS.top + 1.2), 0);
    if (deps.companion.prefs.follow) deps.natalieRoot().position.set(STAIRS.x + 1.4, 0, STAIRS.top + 1.6);
    for (const p of deps.pets) if (p.following) p.placeNear(new THREE.Vector3(STAIRS.x, 0, STAIRS.top), -1.4, 1.8);
  }
  return { startDescent, imbued, heroFalls, exitDungeon, descendCine, get fluxNow() { return fluxNow; }, fluxTick, goDown, enterDungeon, scrollPicker, applyScrolls, patronGifts, applyFlux };
}
