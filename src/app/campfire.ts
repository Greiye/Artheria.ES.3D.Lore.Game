// B8 campfire telling, B11 bard tunes, B9 gallery hall. Moved out of main.ts (2026-11-10).
// main.ts passes what it owns as getters, so nothing is read before it exists.
import * as THREE from 'three';
import { lore, entryById } from '../lore';
import { station } from '../stations';
import { clueById, ending, tagLabel } from '../quest/quest';
import { CampfirePanel } from '../campfire/campfire';
import { TellingView } from '../campfire/telling';
import { type Ballad } from '../campfire/ballad';
import type { CampfireDeps } from '../main';

export function setupCampfire(deps: CampfireDeps) {
  const campfire = station(new CampfirePanel(() => {
    const first = deps.quest.clues[0] ? clueById(deps.quest.clues[0])?.name.toLowerCase() : null;
    return [
      first ? `I remember the ${first}. I didn't want to believe it.` : 'I remember the door, and how quiet it was.',
      deps.quest.theory ? `You said it was ${tagLabel('who', deps.quest.theory.who).toLowerCase()}. I wrote it down.` : 'I was behind you the whole way. Mostly.',
      deps.quest.stage === 'done' && deps.quest.theory ? `And ${ending(deps.quest.theory).friend} came home.` : "And the fire's still going, so it isn't over.",
    ];
  }, (b: Ballad) => { deps.toast(`"${b.title}" is on the shelf. Find it in the gallery hall.`, 4000); deps.refreshGallery(); deps.earn(5, 'for a ballad'); }, () => deps.leaveForge(), deps.forgeAuthor));
  campfire.owned = () => [...deps.inventory.counts.keys()].filter((id) => deps.inventory.count(id) > 0);   // v0.04 instruments
  campfire.onWriteLore = () => deps.openEditor(true);   // v0.04: lore is written at the fire, Natalie holds the quill
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
    const f = deps.world.stations.campfire.position, n = deps.natalieRoot().position, pos = new THREE.Vector3(f.x + 2.4, 1.5, f.z + 1.2);
    const mid = new THREE.Vector3((f.x + n.x) / 2, 0.6, (f.z + n.z) / 2);
    const d = mid.clone().sub(pos).setY(0).normalize(), right = new THREE.Vector3().crossVectors(d, new THREE.Vector3(0, 1, 0));
    const tall = innerHeight > innerWidth;
    if (tall) {   // straight down Natalie's line of sight, so she faces the camera across the flames
      const dn = new THREE.Vector3(f.x - n.x, 0, f.z - n.z).normalize();
      pos.copy(mid).addScaledVector(dn, 6).addScaledVector(right, 1.2).setY(2.8); mid.y -= 1.2;
    } else mid.addScaledVector(right, 1.1);
    deps.rig.setShot({ pos, look: mid, fov: tall ? 62 : 46 });
  }
  telling.onBeat = (b) => { if (b.tone === 'drama') fireFlare = Math.max(fireFlare, 0.7); else if (b.tone === 'em') fireFlare = Math.max(fireFlare, 0.25); };
  telling.onClose = () => { campfire.el.classList.remove('telling-on'); if (campfire.isOpen) deps.frameForge('fire'); };
  // v0.04: Natalie the bard comes to the fire while you sit there (across the flames from you), then goes back.
  let natalieWas: { x: number; z: number; ry: number } | null = null;
  // v0.05 §4.1: the bedroll is part of the camp. It unlocks once you've sat by the fire, and locks again when you leave camp.
  let satAtFire = false;
  function openCampfire() {
    deps.groups.mark('station', 'campfire');   // B52/B53
    satAtFire = true;
    deps.autoSave();   // UX pass: sitting at the fire saves
    deps.enterForge();
    const f0 = deps.world.stations.campfire.position;
    deps.takeStation(new THREE.Vector3(f0.x + 1.5, 0, f0.z + 0.3).addScaledVector(new THREE.Vector3(1, 0, 0.2).normalize(), -0.05), f0, 'sit');   // v0.06 S1: on the log seat
    deps.frameForge('fire');
    const n = deps.natalieRoot(), f = deps.world.stations.campfire.position;
    natalieWas = { x: n.position.x, z: n.position.z, ry: n.rotation.y };
    n.position.set(f.x - 0.7, 0, f.z - 2.3); n.rotation.y = Math.atan2(f.x - n.position.x, f.z - n.position.z);
    campfire.open();
  }
  return { campfire, get fireFlare() { return fireFlare; }, set fireFlare(v) { fireFlare = v; }, get satAtFire() { return satAtFire; }, set satAtFire(v) { satAtFire = v; }, get natalieWas() { return natalieWas; }, set natalieWas(v) { natalieWas = v; }, openCampfire, telling };
}
