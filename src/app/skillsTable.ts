// B19: real-skill mini games at the practice table. Moved out of main.ts (2026-11-10).
// main.ts passes what it owns as getters, so nothing is read before it exists.
import * as THREE from 'three';
import { station } from '../stations';
import { buildSkillTable, SkillsPanel, SKILL_TABLE } from '../skills/skills';
import type { SkillsTableDeps } from '../main';

export function setupSkillsTable(deps: SkillsTableDeps) {
  const skillTable = buildSkillTable(deps.world.scene, deps.world.colliders, deps.world.heightAt);
  const skills = station(new SkillsPanel((s) => deps.earn(s.reward, `${s.name} card`, 'skill:' + s.id), () => deps.leaveForge()));
  function openSkills() {
    if (deps.state !== 'play') return;
    deps.groups.mark('station', 'skills');   // B52/B53
    deps.enterForge();
    const { x, z } = SKILL_TABLE;
    deps.player.spawn(new THREE.Vector3(x - 1.1, 0, z), Math.PI / 2);
    deps.stationPose = 'read';
    deps.rig.setShot(innerHeight > innerWidth ? { pos: new THREE.Vector3(x - 3.2, 2.6, z), look: new THREE.Vector3(x, 0.6, z), fov: 50 }
      : { pos: new THREE.Vector3(x - 3.4, 2.1, z + 1.6), look: new THREE.Vector3(x - 0.6, 0.8, z - 0.9), fov: 44 });
    skills.open();
  }
  deps.interactables.push({ obj: skillTable, verb: () => 'Practise a real skill', act: () => openSkills(), when: () => !deps.inDungeon });
  return { skills, openSkills };
}
