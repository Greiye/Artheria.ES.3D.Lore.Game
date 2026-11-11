// Skyrunner: the mana-sail glider from the perch east of the library (src/sky/). Moved out of main.ts (2026-11-10).
// main.ts passes what it owns as getters, so nothing is read before it exists.
import * as THREE from 'three';
import { station } from '../stations';
import { SkyRun } from '../sky/mode';
import { buildPerch, PERCH } from '../sky/perch';
import type { SkyrunnerDeps } from '../main';

export function setupSkyrunner(deps: SkyrunnerDeps) {
  // A run is its own seeded map with its own scene and camera: A (the perch) to B (the beacon) inside 60 s, and one
  // run in twenty a hexed skyrunner comes for you. The world keeps its state underneath; leaving puts you back here.
  const sky = station(new SkyRun());
  const perch = buildPerch();
  deps.world.scene.add(perch.group, perch.hit);
  deps.world.colliders.push({ kind: 'box', minX: PERCH.x - 1.75, maxX: PERCH.x + 1.75, minZ: PERCH.z - 1.75, maxZ: PERCH.z + 1.75 });
  deps.interactables.push({ obj: perch.hit, verb: () => deps.sideGate(sky.record.wins ? `Fly a sky run (${sky.record.wins} won)` : 'Fly a sky run'), act: () => deps.sideGo(() => openSky()), when: () => !deps.inDungeon });
  function openSky(seed?: number) {
    if (deps.state !== 'play') return;
    deps.groups.mark('station', 'skyrunner');   // B52/B53
    deps.enterForge();
    sky.open(seed);
  }
  sky.onClose = () => {
    deps.player.spawn(new THREE.Vector3(PERCH.x, 0, PERCH.z + 3), 0);   // at the foot of the ladder, facing it
    deps.leaveForge();
  };
  sky.onResult = (won, crowns, why) => { if (won && crowns) deps.earn(crowns, why); };
  // Mike 2026-11-05: Lenju the pilot (he flies the skyrunner) and Taitai the carpenter, his close friend, who helped
  // him build the perch, the ramp and the beacon towers. Talk to either at the foot of the perch.
  const skyFolk = (['lenju', 'taitai'] as const).map((id) => {
    const hit = new THREE.Mesh(new THREE.BoxGeometry(0.9, 1.8, 0.9), new THREE.MeshBasicMaterial({ visible: false }));
    hit.position.copy(deps.world.standees[id].position).setY(0.9); hit.name = id + '-hit';
    deps.world.scene.add(hit);
    deps.interactables.push({ obj: hit, verb: () => `Talk to ${id === 'lenju' ? 'Lenju' : 'Taitai'}`, act: () => deps.talkTo(id, hit.position, id === 'lenju' ? deps.lenjuScript() : deps.taitaiScript()), when: () => !deps.inDungeon });
    return hit;
  });
  return { sky, openSky, perch, skyFolk };
}
