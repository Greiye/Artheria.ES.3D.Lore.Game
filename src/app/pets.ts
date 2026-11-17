// Pets: a dog by the inn, a cat by the store, an owl at the library. Moved out of main.ts (2026-11-10).
// main.ts passes what it owns as getters, so nothing is read before it exists.
import * as THREE from 'three';
import { audio } from '../audio';
import { ITEMS } from '../inventory';
import { station } from '../stations';
import { QUEST, saveQuest, clueById, support, ending, type Theory } from '../quest/quest';
import { Casebook } from '../quest/casebook';
import { Pet, loadPets, type PetId } from '../pets/pet';
import { PetsPanel } from '../pets/panel';
import { FolklorePanel, folkItems, pedlarScript } from '../quest/folklore';
import { haptics } from '../input/haptics';
import { storeSet } from '../store';
import type { PetsDeps } from '../main';

export function setupPets(deps: PetsDeps) {
  // and Shadow, a giant hedgehog the size of a dog, by the campfire ----------
  // Feed one its food and it joins you (one at a time); talk to it after that for the pets page (src/pets/).
  const petPrefs = loadPets();
  const outFrom = (o: THREE.Object3D, out: number, side: number) => { const ry = o.rotation.y; return new THREE.Vector3(o.position.x + Math.sin(ry) * out + Math.cos(ry) * side, 0, o.position.z + Math.cos(ry) * out - Math.sin(ry) * side); };
  const pets = ([
    ['dog', outFrom(deps.world.town.doors.inn, 2.4, 1.8), deps.world.town.doors.inn.rotation.y],
    ['cat', outFrom(deps.world.town.doors.shop, 1.9, -2.2), deps.world.town.doors.shop.rotation.y + 0.6],
    ['owl', new THREE.Vector3(3.6, 0, -16.6), Math.PI * 0.85],   // on the grass by the Ruined Library's steps
    ['hedgehog', deps.world.stations.campfire.position.clone().add(new THREE.Vector3(3.2, 0, 2.4)), -2.2],   // Shadow, snuffling by the campfire
    // Mike 2026-11-04: seven named dogs, each by its own door, and a giant hamster by the Cartographer's.
    ['princess', outFrom(deps.world.town.doors.gallery, 2.2, 1.6), deps.world.town.doors.gallery.rotation.y],
    ['milo', outFrom(deps.world.town.doors.smithy, 2.4, -1.8), deps.world.town.doors.smithy.rotation.y + 0.5],
    ['hotdog', outFrom(deps.world.town.doors.scriptorium, 2.2, 1.7), deps.world.town.doors.scriptorium.rotation.y - 0.4],
    ['brandy', outFrom(deps.world.town.doors.library, 2.6, 2.2), deps.world.town.doors.library.rotation.y],
    ['buster', outFrom(deps.world.town.doors.dojo, 2.6, -1.9), deps.world.town.doors.dojo.rotation.y + 0.3],
    ['peanut', outFrom(deps.world.town.doors.tailor, 2.0, -1.6), deps.world.town.doors.tailor.rotation.y],
    ['kona', outFrom(deps.world.town.doors.inn, 2.2, -1.7), deps.world.town.doors.inn.rotation.y - 0.5],
    ['hamster', outFrom(deps.world.town.doors.cartographer, 2.3, 1.8), deps.world.town.doors.cartographer.rotation.y + 0.4],
  ] as [PetId, THREE.Vector3, number][]).map(([id, home, ry]) => {
    const p = new Pet(id, deps.world.scene, home, ry, deps.world.colliders, () => deps.player.bounds, petPrefs);
    p.terrain = deps.groundY;
    if (id === 'owl') p.shown = () => deps.world.time !== 'day';   // out from dusk
    return p;
  });
  const dog = pets[0];
  /** Bring a pet with you (sending any other one to wait where it is), or tell it to stay. */
  function callPet(p: Pet, on: boolean) {
    if (on) for (const o of pets) if (o !== p && o.following) o.follow(false);
    p.follow(on);
    deps.toast(on ? `${cap(p.label)} ${p.sp.fly ? 'swoops down to your shoulder' : 'bounds over to your side'}.` : `${cap(p.label)} settles down to wait for you here.`, 2200);
  }
  const cap = (t: string) => t[0].toUpperCase() + t.slice(1);
  const petsPanel = station(new PetsPanel(pets, callPet, () => deps.leaveForge()));
  for (const p of pets) deps.interactables.push({ obj: p.hit, when: () => (!deps.inDungeon || p.following) && (p.friend || p.shown()),
    verb: () => !p.friend ? (deps.inventory.count(p.sp.food) ? `Give ${p.label} some ${p.sp.foodName}` : p.id === 'owl' ? 'Hold out a hand to the owl' : `Pet ${p.label}`) : `Talk to ${p.label}`,
    act: () => {
      if (!p.friend) {
        const food = ITEMS[p.sp.food]?.name.toLowerCase() ?? p.sp.foodName;
        if (!deps.inventory.take(p.sp.food)) {
          const who = cap(p.label);
          deps.toast(p.sp.kind === 'cat' ? `${who} lets you scratch behind one ear, then looks at your empty hand. The General Store sells ${food}.`
            : p.sp.kind === 'owl' ? `The owl blinks at your empty hand. The General Store sells ${food}.`
              : p.sp.kind === 'hedgehog' ? `${who} huffs at your hand and raises a few spines, then snuffles your pockets for food. The General Store sells ${food}.`
                : p.sp.kind === 'hamster' ? `${who} sniffs your fingers, whiskers going, and stuffs nothing into its cheeks. The General Store sells ${food}.`
                  : `${who} sniffs your hand and wags. ${p.name ? 'They look' : 'It looks'} hungry: the General Store sells ${food}.`, 3600);
          return;
        }
        for (const o of pets) if (o.following) o.follow(false);
        p.befriend(); haptics.play('pickup');
        const who = cap(p.label), nm = p.name ? '' : ' Talk to it to give it a name.';
        deps.toast(p.sp.kind === 'cat' ? `${who} eats the fish in three bites and winds round your ankles. It's yours now.${nm}`
          : p.sp.kind === 'owl' ? `${who} takes the jerky from your fingers and settles on your shoulder. It's yours now.${nm}`
            : p.sp.kind === 'hedgehog' ? `${who} crunches through the mealworms, smooths down every spine and trundles after you. ${who} is yours now.`
              : p.sp.kind === 'hamster' ? `${who} crams every seed into its bulging cheeks and waddles after you. ${who} is yours now.${nm}`
                : `${who} wolfs the bread down and trots after you, tail going. ${p.name ? who + ' is' : "It's"} yours now.${nm}`, 4200);
        return;
      }
      deps.enterForge();
      petsPanel.open(p);
    } });
  const seen = (() => { try { return JSON.parse(localStorage.getItem('gametool.seen') ?? '[]') as string[]; } catch { return [] as string[]; } })();
  function markSeen(id: string) { if (!seen.includes(id)) { seen.push(id); storeSet('gametool.seen', JSON.stringify(seen)); } }
  const casebook = station(new Casebook(() => deps.quest, (th: Theory) => {
    deps.quest.theory = th; deps.quest.stage = 'lead'; saveQuest(deps.quest);
    deps.questProps.showLead(th.where);
    deps.companion.say(support(deps.quest, th) >= 2 ? QUEST.natalie.supported : QUEST.natalie.leap, { force: true });
  }, () => deps.leaveForge(), deps.loreWords, deps.forgeAuthor));
  casebook.owner = () => deps.character.name;
  function openCasebook() {
    if (deps.state !== 'play' && deps.state !== 'pause' && deps.state !== 'dialogue') return;
    deps.enterForge();
    casebook.open();
  }
  const folklore = station(new FolklorePanel(
    () => folkItems([...deps.inventory.counts.keys()].filter((id) => deps.inventory.count(id) > 0), deps.quest.clues, seen, (id) => ITEMS[id]?.name ?? id),
    () => deps.leaveForge(), deps.forgeAuthor));
  function openFolklore() { deps.enterForge(); folklore.open(); }
  function findClue(id: string) {
    const c = clueById(id);
    if (!c || deps.quest.clues.includes(id)) return;
    deps.quest.clues.push(id);
    if (deps.quest.stage === 'none') deps.quest.stage = 'clues';
    saveQuest(deps.quest);
    deps.questProps.sync(deps.quest.clues);
    audio.pageTurn();
    deps.toast(`Clue: ${c.name}. ${c.text}`, 6000);
    setTimeout(() => deps.hint(`That goes in the casebook. Look it over with ${deps.keyName('casebook')}.`, '(J: casebook)', 2600), 1800);
    setTimeout(() => deps.earn(2, 'found'), 6200);
    if (deps.companion.prefs.follow) setTimeout(() => deps.companion.say(c.natalie, { key: 'clue:' + id, force: true }), 1800);
    if (deps.quest.clues.length === QUEST.minClues && deps.quest.stage === 'clues') setTimeout(() => deps.companion.say(QUEST.natalie.hintReady, { key: 'ready', force: true }), 7000);
  }
  for (const c of QUEST.clues) {
    deps.interactables.push({ obj: deps.questProps.hitboxes.get(c.id)!, verb: () => 'Look closer', act: () => findClue(c.id), when: () => !deps.quest.clues.includes(c.id) });
  }
  deps.interactables.push({ obj: deps.questProps.leadHit, verb: () => 'Follow the blue light', when: () => deps.quest.stage === 'lead', act: () => {
    const th = deps.quest.theory!, end = ending(th);
    deps.quest.stage = 'done'; saveQuest(deps.quest);
    deps.questProps.showLead(null);
    deps.talkM.afterDialogue = () => { deps.hint(`My field note's done. It's in the casebook: ${deps.keyName('casebook')}.`, 'Natalie finished her field note. Read it in the casebook (J).', 5000); void deps.resumePlay(); };
    deps.talkTo('natalie', deps.questProps.leadHit.position, { speaker: 'Natalie Bourbon', start: 'f1', nodes: {
      f1: { text: end.find, next: 'f2' },
      f2: { text: QUEST.natalie.found, next: 'f3' },
      f3: { text: end.note, end: true },
    } });
  } });
  // B12: Magister Greer (the Curio Pedlar, Mike's pick 2026-10-28) by the coach road.
  const pedlarHit = new THREE.Mesh(new THREE.BoxGeometry(0.9, 1.7, 0.9), new THREE.MeshBasicMaterial({ visible: false }));
  pedlarHit.position.copy(deps.world.standees.pedlar.position).setY(0.85);
  deps.world.scene.add(pedlarHit);
  deps.interactables.push({ obj: pedlarHit, verb: () => 'Talk to Magister Greer', act: () => {
    if (deps.inventory.count('crossbow') > 0) markSeen('crossbow');
    deps.talkTo('pedlar', pedlarHit.position, pedlarScript(seen, deps.isMage() ? (deps.missile.learned ? 'known' : 'teach') : null));
  } });
  return { openCasebook, pets, casebook, seen, outFrom, markSeen, cap, openFolklore, dog, petPrefs, petsPanel, callPet, folklore, pedlarHit };
}
