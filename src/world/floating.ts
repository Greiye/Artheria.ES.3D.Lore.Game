import * as THREE from 'three';
import { Painter } from './decor';
import { rng } from '../tex/pixel';

// Mike 2026-11-06 (Graphics thread): "Exterior has floating broken stone structures to really emphasize the magic of
// the place." Broken pieces of the old library hang in the air round it: each an upturned crag of rock with a
// fragment on top (a wall with a window, an arch, a column stump, a stair going nowhere), drifting slowly up and down
// and turning a little. Their undersides are lit from below with a soft cool glow (vertex colour), and each casts a
// faint soft shadow on the ground. One mesh each (they move), plus one for the shadows.
export interface FloatingStone { mesh: THREE.Mesh; base: THREE.Vector3; phase: number; bob: number; spin: number }
const V = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);

export function buildFloatingStones(scene: THREE.Scene, heightAt: (x: number, z: number) => number): { stones: FloatingStone[]; shadows: THREE.Mesh; update: (t: number) => void } {
  const R = rng(3131), stones: FloatingStone[] = [];
  const ROCK = ['#6E665E', '#7A7168', '#625B54'], BRICK = ['#8A7F74', '#7C7268', '#968A7E'];
  // A cool light from below: the lower a face sits on the crag, the more it takes the glow.
  const under = (base: string, glowAt: number) => (c: THREE.Vector3) => {
    const k = THREE.MathUtils.clamp((glowAt - c.y) / 2.2, 0, 1);
    return '#' + new THREE.Color(base).lerp(new THREE.Color('#9FC8E8'), k * 0.55).getHexString();
  };
  const SPOTS: [number, number, number, number, string][] = [
    [-17.5, 10, -15, 1.4, 'wall'], [17.5, 11.5, -22, 1.3, 'arch'], [-4, 15.5, -46, 1.8, 'stair'],
    [21, 8.5, -11, 1.0, 'column'], [5, 13.5, -27, 1.1, 'wall'], [-22, 8.5, -33, 1.2, 'column'], [13, 14.5, -47, 1.4, 'arch'],
  ];
  const shadowGeo: THREE.BufferGeometry[] = [];
  for (const [x, y, z, s, kind] of SPOTS) {
    const P = new Painter(Math.floor(R() * 1e6));
    // The crag: an upturned cone of rock, broken top, jagged underside.
    const crag = new THREE.ConeGeometry(2.2 * s, 3.4 * s, 7, 2).rotateX(Math.PI);
    const p = crag.attributes.position as THREE.BufferAttribute;
    for (let i = 0; i < p.count; i++) { const py = p.getY(i); if (py < 1.6 * s) p.setXYZ(i, p.getX(i) * (0.85 + R() * 0.3), py + (R() - 0.5) * 0.4 * s, p.getZ(i) * (0.85 + R() * 0.3)); }
    crag.computeVertexNormals();
    P.add(crag, under(ROCK[Math.floor(R() * 3)], 1.2 * s), V(0, -1.7 * s, 0));
    P.add(new THREE.CylinderGeometry(2.25 * s, 2.25 * s, 0.25, 7), '#5E7A3E', V(0, 0.02, 0));   // grass on the broken top
    for (let k = 0; k < 4; k++) P.add(new THREE.DodecahedronGeometry((0.25 + R() * 0.35) * s, 0), under(ROCK[k % 3], 0), V((R() - 0.5) * 3 * s, -2.6 * s - R() * 0.8 * s, (R() - 0.5) * 3 * s));   // loose stones hanging under it
    const brick = BRICK[Math.floor(R() * 3)];
    if (kind === 'wall') {   // a wall with a window, its top broken in steps
      for (let k = 0; k < 5; k++) { const h = 3.2 - Math.abs(k - 1.5) * 0.7 + R() * 0.4; P.add(new THREE.BoxGeometry(0.75 * s, h * s, 0.6 * s), brick, V((-1.5 + k * 0.75) * s, h * s / 2, 0)); }
      P.add(new THREE.BoxGeometry(0.62 * s, 1.1 * s, 0.7 * s), '#2A2622', V(0, 1.6 * s, 0));   // the window
    } else if (kind === 'arch') {
      for (const e of [-1, 1]) P.add(new THREE.BoxGeometry(0.6 * s, 2.6 * s, 0.6 * s), brick, V(e * 1.1 * s, 1.3 * s, 0));
      for (let k = 0; k < 5; k++) { const a = Math.PI * (k / 4); if (k === 4) continue; P.add(new THREE.BoxGeometry(0.62 * s, 0.4 * s, 0.6 * s), brick, V(Math.cos(a) * 1.1 * s, (2.6 + Math.sin(a) * 1.0) * s, 0), 0, 0, a + Math.PI / 2); }
    } else if (kind === 'column') {
      P.add(new THREE.CylinderGeometry(0.42 * s, 0.48 * s, 2.4 * s, 8), brick, V(0, 1.2 * s, 0));
      P.add(new THREE.BoxGeometry(1.2 * s, 0.3 * s, 1.2 * s), brick, V(0, 0.15 * s, 0));
      P.add(new THREE.CylinderGeometry(0.42 * s, 0.42 * s, 1.1 * s, 8), brick, V(0.9 * s, 0.35 * s, 0.3 * s), 0.6, 0, Math.PI / 2);   // its fallen drum
    } else {   // a stair going up to nothing
      for (let k = 0; k < 6; k++) P.add(new THREE.BoxGeometry(1.4 * s, 0.32 * s * (k + 1), 0.45 * s), brick, V(0, 0.16 * s * (k + 1), (-1.2 + k * 0.45) * s));
    }
    const mesh = P.mesh(scene, 'floating-stone')!;
    mesh.position.set(x, y, z); mesh.rotation.y = R() * Math.PI * 2;
    stones.push({ mesh, base: mesh.position.clone(), phase: R() * Math.PI * 2, bob: 0.25 + R() * 0.35, spin: (R() - 0.5) * 0.04 });
    // A faint, soft shadow on the ground below (a dark disc fading out at the rim).
    const sh = new THREE.CircleGeometry(2.6 * s, 16).rotateX(-Math.PI / 2);
    const cnt = (sh.attributes.position as THREE.BufferAttribute).count, a = new Float32Array(cnt * 4);
    for (let i = 0; i < cnt; i++) { a[i * 4] = a[i * 4 + 1] = a[i * 4 + 2] = 0; a[i * 4 + 3] = i === 0 ? 0.28 : 0; }
    sh.setAttribute('color', new THREE.BufferAttribute(a, 4));
    sh.translate(x, heightAt(x, z) + 0.06, z);
    shadowGeo.push(sh);
  }
  const shadows = new THREE.Mesh(mergeShadows(shadowGeo), new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, depthWrite: false }));
  shadows.name = 'floating-stone-shadows'; shadows.raycast = () => {}; shadows.renderOrder = 1;
  scene.add(shadows);
  const update = (t: number) => {
    for (const s of stones) {
      s.mesh.position.y = s.base.y + Math.sin(t * 0.35 + s.phase) * s.bob;
      s.mesh.rotation.y += s.spin * 0.016;
      s.mesh.rotation.z = Math.sin(t * 0.21 + s.phase) * 0.03;
    }
  };
  return { stones, shadows, update };
}

function mergeShadows(gs: THREE.BufferGeometry[]): THREE.BufferGeometry {
  const parts = gs.map((g) => (g.index ? g.toNonIndexed() : g));
  let n = 0; for (const g of parts) n += g.attributes.position.count;
  const pos = new Float32Array(n * 3), col = new Float32Array(n * 4);
  let o = 0;
  for (const g of parts) { pos.set(g.attributes.position.array as Float32Array, o * 3); col.set(g.attributes.color.array as Float32Array, o * 4); o += g.attributes.position.count; }
  const out = new THREE.BufferGeometry();
  out.setAttribute('position', new THREE.BufferAttribute(pos, 3)); out.setAttribute('color', new THREE.BufferAttribute(col, 4));
  return out;
}
