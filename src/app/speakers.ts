// B16 and B23: the Spanish caravan, the tea house and the market corner, and the phrasebook. Moved out of main.ts (2026-11-10).
// main.ts passes what it owns as getters, so nothing is read before it exists.
import * as THREE from 'three';
import { station } from '../stations';
import { buildCaravan, CaravanPanel, Phrasebook, type CaravanFolk } from '../spanish/caravan';
import { buildTeahouse, JA_PACK } from '../langs/japanese';
import { buildPalengke, TL_PACK } from '../langs/tagalog';
import type { SpeakersDeps } from '../main';

export function setupSpeakers(d: SpeakersDeps) {
  // B23 (Mike 2026-11-08): the same kind of talk in Japanese (the tea house) and Tagalog (the market corner).
  const caravanFolk = buildCaravan(d.world.scene, d.world.colliders, d.world.heightAt);
  const teaFolk = buildTeahouse(d.world.scene, d.world.colliders, d.world.heightAt);
  const marketFolk = buildPalengke(d.world.scene, d.world.colliders, d.world.heightAt);
  for (const f of caravanFolk) d.puppets.set('caravan:' + f.id, d.figureOf(f.root));
  for (const f of teaFolk) d.puppets.set('teahouse:' + f.id, d.figureOf(f.root));
  for (const f of marketFolk) d.puppets.set('palengke:' + f.id, d.figureOf(f.root));
  let caravanView: boolean | null = null;
  /** Stand face to face with whoever is talking; the camera looks past your shoulder at their face. */
  const faceFolk = (folk: CaravanFolk[]) => (t: { id: string } | null) => {
    for (const f of folk) f.root.userData.folk.talking = !!t && f.id === t.id;
    const f = t && folk.find((c) => c.id === t.id);
    if (!f) return;
    const at = f.root.position, yaw = Math.atan2(at.x - f.stand.x, at.z - f.stand.z);
    d.player.spawn(f.stand.clone(), yaw);
    const tall = innerHeight > innerWidth, back = new THREE.Vector3(f.stand.x - at.x, 0, f.stand.z - at.z).normalize();
    const side = new THREE.Vector3(back.z, 0, -back.x);
    d.rig.setShot(tall ? { pos: at.clone().addScaledVector(back, 3.6).setY(at.y + 2.2), look: at.clone().setY(at.y + 0.6), fov: 50 }
      : { pos: at.clone().addScaledVector(back, 3.4).addScaledVector(side, 0.9).setY(at.y + 1.8), look: at.clone().addScaledVector(side, -1.3).setY(at.y + 1.35), fov: 44 });   // side = camera right: they sit right of the panel
  };
  const talkClosed = () => { if (caravanView !== null) { d.player.thirdPerson = caravanView; caravanView = null; } d.leaveForge(); };
  const caravan = station(new CaravanPanel(faceFolk(caravanFolk), (t) => d.earn(t.reward, 'a talk in Spanish', 'es:' + t.id), talkClosed, () => d.character.name));
  const teahouse = station(new CaravanPanel(faceFolk(teaFolk), (t) => d.earn(t.reward, 'a talk in Japanese', 'ja:' + t.id), talkClosed, () => d.character.name, JA_PACK));
  const palengke = station(new CaravanPanel(faceFolk(marketFolk), (t) => d.earn(t.reward, 'a talk in Tagalog', 'tl:' + t.id), talkClosed, () => d.character.name, TL_PACK));
  function openTalk(panel: CaravanPanel, folk: CaravanFolk[], id: string, group: boolean) {
    if (d.state !== 'play') return;
    const f = folk.find((c) => c.id === id);
    if (!f) return;
    if (group) d.groups.mark('npc', id);   // B52
    d.enterForge();
    if (caravanView === null) { caravanView = d.player.thirdPerson; d.player.thirdPerson = true; }
    panel.open(f.talk);
  }
  const openCaravan = (id: string) => openTalk(caravan, caravanFolk, id, true);
  const openTeahouse = (id: string) => openTalk(teahouse, teaFolk, id, false);
  const openPalengke = (id: string) => openTalk(palengke, marketFolk, id, false);
  for (const f of caravanFolk) d.interactables.push({ obj: f.hit, verb: () => f.talk.verb, act: () => openCaravan(f.id), when: () => !d.inDungeon });
  for (const f of teaFolk) d.interactables.push({ obj: f.hit, verb: () => f.talk.verb, act: () => openTeahouse(f.id), when: () => !d.inDungeon });
  for (const f of marketFolk) d.interactables.push({ obj: f.hit, verb: () => f.talk.verb, act: () => openPalengke(f.id), when: () => !d.inDungeon });
  const phrasebook = station(new Phrasebook([caravan, teahouse, palengke], () => d.leaveForge()));
  return { caravan, phrasebook, caravanFolk, openCaravan, teahouse, teaFolk, openTeahouse, palengke, marketFolk, openPalengke };
}
