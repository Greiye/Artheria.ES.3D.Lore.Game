import * as THREE from 'three';
// Mike 2026-11-06 ("Add to world. Have him teach Archery. Name him Candor."): Candor's archery range in the east
// meadow, between the library and the skyrunner perch. Candor (Mike's Painted Archer model, public/models/candor.glb)
// stands at the shooting line; three straw butts on stands sit 7, 10 and 13 m out, each a little further left.
export const RANGE = { x: 21, z: -8, ry: Math.PI / 2 };   // Candor's spot and facing (+x, toward the butts)
export const BUTTS: { x: number; z: number }[] = [{ x: 28, z: -7 }, { x: 31, z: -10 }, { x: 34, z: -13 }];
/** Keep trees and rocks off the range (shooting line to the last butt). */
export const rangeClear = (x: number, z: number, pad: number) => x > RANGE.x - 2 - pad && x < 36 + pad && z > -15.5 - pad && z < -4.5 + pad;

export interface Butt { root: THREE.Group; face: THREE.Mesh; centre: THREE.Vector3 }
/** The straw butts (target faces are bolt-stickable solids) and the shooting-line mark. */
export function buildRange(scene: THREE.Scene, solids: THREE.Object3D[], colliders: { kind: 'circle'; x: number; z: number; r: number }[] | unknown[], heightAt: (x: number, z: number) => number): Butt[] {
  const wood = new THREE.MeshLambertMaterial({ color: '#7A5232' }), straw = new THREE.MeshLambertMaterial({ color: '#D8B25A' });
  const ring = (r: number, color: string) => new THREE.Mesh(new THREE.CircleGeometry(r, 20), new THREE.MeshLambertMaterial({ color }));
  const butts = BUTTS.map((b, i) => {
    const g = new THREE.Group(); g.name = 'archery-butt-' + (i + 1);
    for (const s of [-1, 1]) { const leg = new THREE.Mesh(new THREE.BoxGeometry(0.08, 1.5, 0.08), wood); leg.position.set(0.25, 0.72, s * 0.45); leg.rotation.z = 0.18; g.add(leg); }
    const back = new THREE.Mesh(new THREE.BoxGeometry(0.08, 1.3, 0.08), wood); back.position.set(0.55, 0.62, 0); back.rotation.z = -0.45; g.add(back);
    const bale = new THREE.Mesh(new THREE.CylinderGeometry(0.6, 0.6, 0.3, 18), straw); bale.rotation.z = Math.PI / 2; bale.position.y = 1.25; g.add(bale);
    // The face looks back down the range (-x). Painted rings: white, black, blue, red, gold.
    const face = ring(0.58, '#EDE6D2'); face.rotation.y = -Math.PI / 2; face.position.set(-0.155, 1.25, 0); face.name = 'archery-face-' + (i + 1); g.add(face);
    [[0.46, '#2B2A24'], [0.34, '#3A6AA8'], [0.22, '#B83A2E'], [0.1, '#E8C24A']].forEach(([r, c], k) => {
      const m = ring(r as number, c as string); m.rotation.y = -Math.PI / 2; m.position.set(-0.16 - 0.002 * (k + 1), 1.25, 0); g.add(m);
    });
    g.position.set(b.x, heightAt(b.x, b.z), b.z);
    scene.add(g);
    solids.push(bale, face);
    (colliders as { kind: 'circle'; x: number; z: number; r: number }[]).push({ kind: 'circle', x: b.x, z: b.z, r: 0.65 });
    return { root: g, face, centre: new THREE.Vector3(b.x - 0.16, g.position.y + 1.25, b.z) };
  });
  // A chalk shooting line at Candor's feet.
  const line = new THREE.Mesh(new THREE.PlaneGeometry(0.12, 4), new THREE.MeshBasicMaterial({ color: '#EFE8D4' }));
  line.rotation.x = -Math.PI / 2; line.position.set(RANGE.x + 0.6, heightAt(RANGE.x + 0.6, RANGE.z) + 0.02, RANGE.z - 1.5); line.rotation.z = 0.3; line.name = 'archery-line';
  scene.add(line);
  return butts;
}
