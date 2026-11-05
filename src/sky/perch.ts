import * as THREE from 'three';
import { buildGlider } from './scene';

// Skyrunner: the launch perch in the meadow east of the library, where a sky run starts. A timber tower with a
// ladder and a glider resting on the deck. You use it from the foot of the ladder.
export const PERCH = { x: 36, z: 4, r: 4 };

export function buildPerch(): { group: THREE.Group; hit: THREE.Mesh } {
  const wood = new THREE.MeshLambertMaterial({ color: '#8A5A32', flatShading: true }), dark = new THREE.MeshLambertMaterial({ color: '#6B4426', flatShading: true });
  const g = new THREE.Group(); g.name = 'skyrunner-perch';
  for (const [x, z] of [[-1.6, -1.6], [1.6, -1.6], [-1.6, 1.6], [1.6, 1.6]]) {
    const leg = new THREE.Mesh(new THREE.BoxGeometry(0.28, 3.4, 0.28), dark); leg.position.set(x, 1.7, z); leg.castShadow = true; g.add(leg);
  }
  for (const y of [1.0, 2.2]) for (const [w, d, x, z] of [[3.4, 0.12, 0, -1.6], [3.4, 0.12, 0, 1.6], [0.12, 3.4, -1.6, 0], [0.12, 3.4, 1.6, 0]]) {
    const brace = new THREE.Mesh(new THREE.BoxGeometry(w, 0.12, d), dark); brace.position.set(x, y, z); g.add(brace);
  }
  const deck = new THREE.Mesh(new THREE.BoxGeometry(4, 0.25, 4), wood); deck.position.y = 3.45; deck.castShadow = deck.receiveShadow = true; g.add(deck);
  const ramp = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.16, 3), wood); ramp.position.set(0, 3.3, -3.3); ramp.rotation.x = -0.2; g.add(ramp);
  // A ladder up the +z side (the side you walk up to).
  for (const x of [-0.35, 0.35]) { const rail = new THREE.Mesh(new THREE.BoxGeometry(0.08, 3.5, 0.08), dark); rail.position.set(x, 1.75, 1.75); g.add(rail); }
  for (let y = 0.4; y < 3.4; y += 0.45) { const rung = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.06, 0.06), wood); rung.position.set(0, y, 1.75); g.add(rung); }
  const glider = buildGlider(false); glider.scale.setScalar(0.32); glider.position.set(0, 3.85, -0.2); g.add(glider);
  // A pennant so it reads from across the meadow.
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 2.2, 5), dark); pole.position.set(1.6, 4.6, 1.6); g.add(pole);
  const flag = new THREE.Mesh(new THREE.PlaneGeometry(0.9, 0.5), new THREE.MeshLambertMaterial({ color: '#7FD8FF', side: THREE.DoubleSide })); flag.position.set(2.05, 5.4, 1.6); g.add(flag);
  g.position.set(PERCH.x, 0, PERCH.z);
  const hit = new THREE.Mesh(new THREE.BoxGeometry(2.2, 2.4, 1.6), new THREE.MeshBasicMaterial({ visible: false }));
  hit.position.set(PERCH.x, 1.2, PERCH.z + 1.9); hit.name = 'skyrunner-perch-hit';
  return { group: g, hit };
}
