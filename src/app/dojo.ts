// B14: the dojo. Moved out of main.ts (2026-11-10).
// main.ts passes what it owns as getters, so nothing is read before it exists.
import * as THREE from 'three';
import { station } from '../stations';
import { buildDojo, DojoPanel, DOJO } from '../dojo/dojo';
import type { DojoDeps } from '../main';

export function setupDojo(deps: DojoDeps) {
  const dojoBoard = buildDojo(deps.world.scene, deps.world.colliders);
  let dojoView: boolean | null = null;
  const dojo = station(new DojoPanel((d) => {
    if (!d) return;
    // Stand on the mats (under the bar for the hanging drill), facing the camera, panel on the left.
    const at = d.pose === 'hang' ? DOJO.bar.clone() : new THREE.Vector3(DOJO.x - 1, 0, DOJO.z);
    const low = d.pose === 'plank' || d.pose === 'pushup';
    deps.player.spawn(at, low ? Math.PI / 2 : Math.PI);   // the plank and push-ups side-on
    const up = d.pose === 'hang' ? 1.75 : low ? 0.45 : 1.0, far = d.pose === 'hang' ? 2.9 : 3.3;
    // Portrait phones put the panel along the bottom, so the figure goes in the top band instead.
    const tall = innerHeight > innerWidth;
    deps.rig.setShot(tall ? { pos: new THREE.Vector3(at.x, up + 0.2, at.z + far * 1.5), look: new THREE.Vector3(at.x, up - 1.6, at.z), fov: 50 }
      : { pos: new THREE.Vector3(at.x + (low ? -0.9 : -0.7), up + 0.45, at.z + far - (low ? 0.5 : 0)), look: new THREE.Vector3(at.x + (low ? -2.0 : -1.0), up, at.z), fov: 44 });   // the plank and push-ups lie along -x, centred ~0.9 m from where you stand; clear of the corner post and the water barrel
  }, () => { if (dojoView !== null) { deps.player.thirdPerson = dojoView; dojoView = null; } deps.leaveForge(); }, deps.forgeAuthor));
  function openDojo() {
    if (deps.state !== 'play' && deps.state !== 'pause') return;
    deps.groups.mark('station', 'dojo');   // B52/B53
    deps.enterForge();
    if (dojoView === null) { dojoView = deps.player.thirdPerson; deps.player.thirdPerson = true; }
    deps.rig.setShot({ pos: new THREE.Vector3(DOJO.x - 1.7, 1.6, DOJO.z + 3.2), look: new THREE.Vector3(DOJO.x - 2, 1, DOJO.z), fov: 44 });
    dojo.open();
  }
  deps.interactables.push({ obj: dojoBoard, verb: () => deps.sideGate('Train at the dojo'), act: () => deps.sideGo(openDojo), when: () => !deps.inDungeon });
  return { dojo, openDojo };
}
