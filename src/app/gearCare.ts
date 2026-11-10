// B17: gear care at the smith's grindstone. Moved out of main.ts (2026-11-10).
// main.ts passes what it owns as getters, so nothing is read before it exists.
import * as THREE from 'three';
import { audio } from '../audio';
import { GearPanel, buildGrindstone, grindstonePos, gearCardHtml, swordSharpness, bowPower, GEAR_CARD } from '../gear/gear';
import { station } from '../stations';
import { pushupCardHtml } from '../dojo/card';
import { SkillsBook } from '../skills/skills';
import { haptics } from '../input/haptics';
import { TOWN_LOTS } from '../world/town';
import type { GearCareDeps } from '../main';

export function setupGearCare(deps: GearCareDeps) {
  const gear = station(new GearPanel(() => deps.leaveForge()));
  gear.has = { sword: () => deps.sword.owned, crossbow: () => deps.inventory.count('crossbow') > 0 };
  function applyGear() { const g = gear.st; for (const s of [deps.sword, deps.sword2]) { s.sharpness = swordSharpness(g); s.setCondition(g.sharp, g.rust); } deps.crossbow.power = deps.crossbow2.power = bowPower(g); }
  gear.onChange = applyGear;
  gear.onCard = () => deps.earn(4, 'Gear care card', 'skill:gear');
  gear.onStroke = (good) => { audio.grind(good); haptics.play(good ? 'tap' : 'jam'); };
  applyGear();
  const GRIND = grindstonePos(TOWN_LOTS.find((l) => l.id === 'smithy')!);
  const grind = buildGrindstone(deps.world.scene, deps.world.colliders, GRIND, deps.world.heightAt(GRIND.x, GRIND.z));
  function openGear() {
    if (deps.state !== 'play') return;
    deps.groups.mark('station', 'grindstone');   // B52/B53
    deps.enterForge();
    const f = new THREE.Vector3(Math.sin(GRIND.ry), 0, Math.cos(GRIND.ry)), r = new THREE.Vector3(Math.cos(GRIND.ry), 0, -Math.sin(GRIND.ry));
    const at = new THREE.Vector3(GRIND.x, 0, GRIND.z).addScaledVector(f, 0.9).addScaledVector(r, 0.3);
    deps.player.spawn(at, Math.atan2(f.x, f.z));
    deps.stationPose = 'smith';
    const look = new THREE.Vector3(GRIND.x, 0.8, GRIND.z).addScaledVector(r, 0.4);
    deps.rig.setShot(innerHeight > innerWidth ? { pos: look.clone().addScaledVector(f, 3.4).setY(2.6), look, fov: 50 }
      : { pos: look.clone().addScaledVector(f, 2.6).addScaledVector(r, -2.2).setY(2.0), look: look.clone().addScaledVector(r, -0.9), fov: 44 });
    gear.open();
  }
  deps.interactables.push({ obj: grind.hit, verb: () => 'Care for your gear', act: () => openGear(), when: () => !deps.inDungeon });
  const skillsBook = station(new SkillsBook(deps.skills, () => deps.leaveForge(), () => (gear.st.card ? gearCardHtml(gear.st)
    : `<div class="sk-card locked"><div class="sk-card-head"><span>${GEAR_CARD.icon}</span><b>${GEAR_CARD.title}</b></div><p class="fine">Not learned yet. The smith teaches it at the grindstone outside the smithy.</p></div>`)
    + pushupCardHtml(deps.dojo.st.done.includes('pushup'))));
  function openSkillsBook() { if (deps.state !== 'play' && deps.state !== 'pause') return; deps.enterForge(); skillsBook.open(); }
  return { gear, GRIND, openSkillsBook, grind, openGear, skillsBook };
}
