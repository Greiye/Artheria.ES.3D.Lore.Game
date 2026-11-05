import * as THREE from 'three';
import { SIZE, RES, WATER, type SkyMap } from './gen';

// Skyrunner: the meshes for a sky run. Low-poly and flat-shaded with a little colour noise (the MML + Vintage
// Story look): faceted hills in vertex colours, a flat water sheet, cone trees (one instanced mesh), rock spires,
// the launch perch, the beacon tower with its blue sacred-fire pillar, wind rings, and the two gliders.
const SKY = new THREE.Color('#8CC6EE');
/** Deck height of the launch tower above the ground (the run starts just over it). */
export const PERCH_H = 48;
export const SKY_COLOR = SKY;

const flat = (color: THREE.ColorRepresentation, extra: THREE.MeshLambertMaterialParameters = {}) => new THREE.MeshLambertMaterial({ color, flatShading: true, ...extra });
const glow = (color: THREE.ColorRepresentation, k = 1.6, extra: THREE.MeshBasicMaterialParameters = {}) => new THREE.MeshBasicMaterial({ color: new THREE.Color(color).multiplyScalar(k), ...extra });

function hash(x: number, z: number) { const s = Math.sin(x * 12.9898 + z * 78.233) * 43758.5453; return s - Math.floor(s); }

function terrain(m: SkyMap): THREE.Mesh {
  const g = new THREE.PlaneGeometry(SIZE, SIZE, RES, RES);
  g.rotateX(-Math.PI / 2);
  const pos = g.attributes.position as THREE.BufferAttribute, col = new Float32Array(pos.count * 3);
  const sand = new THREE.Color('#D9C58E'), grass = new THREE.Color('#6FA84A'), grass2 = new THREE.Color('#4F8A3C'), rock = new THREE.Color('#8A8378'), snow = new THREE.Color('#F2F4F6'), c = new THREE.Color();
  // PlaneGeometry rows run from -z (top) to +z after the rotation; the map grid runs from -z too.
  for (let k = 0; k < pos.count; k++) {
    const i = k % (RES + 1), j = Math.floor(k / (RES + 1)), y = m.h[j * (RES + 1) + i];
    pos.setY(k, y);
    const x = pos.getX(k), z = pos.getZ(k), n = hash(x, z);
    if (y < WATER + 3) c.copy(sand);
    else if (y > 200) c.copy(snow);
    else if (y > 110) c.copy(rock).lerp(snow, Math.max(0, (y - 170) / 30));
    else c.copy(grass).lerp(grass2, n * 0.8).lerp(rock, Math.max(0, (y - 85) / 25));
    c.offsetHSL(0, 0, (n - 0.5) * 0.06);
    col.set([c.r, c.g, c.b], k * 3);
  }
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  g.computeVertexNormals();
  const mesh = new THREE.Mesh(g, new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true }));
  mesh.name = 'sky-terrain';
  return mesh;
}

function trees(m: SkyMap): THREE.InstancedMesh {
  const g = new THREE.ConeGeometry(4, 14, 5); g.translate(0, 7, 0);
  const mesh = new THREE.InstancedMesh(g, flat('#ffffff'), m.trees.length);
  const o = new THREE.Object3D(), c = new THREE.Color();
  m.trees.forEach((t, k) => {
    o.position.set(t.x, t.y - 1, t.z); o.scale.setScalar(t.s); o.rotation.y = t.s * 9; o.updateMatrix();
    mesh.setMatrixAt(k, o.matrix);
    mesh.setColorAt(k, c.set('#3E7A3A').offsetHSL((hash(t.x, t.z) - 0.5) * 0.04, 0, (hash(t.z, t.x) - 0.5) * 0.1));
  });
  mesh.name = 'sky-trees';
  return mesh;
}

/** A glider: canvas mana-sail wings with rune stripes, a wooden hull, a gem in the nose. */
export function buildGlider(hexed: boolean): THREE.Group {
  const g = new THREE.Group();
  const hull = flat(hexed ? '#2A2230' : '#9C6B3C'), sail = flat(hexed ? '#1C1A22' : '#F1E7CF', { side: THREE.DoubleSide });
  const stripe = flat(hexed ? '#6E3FA0' : '#C9483A'), gemC = hexed ? '#B070FF' : '#7FD8FF';
  const body = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.7, 7, 6), hull); body.rotation.x = Math.PI / 2; g.add(body);
  const nose = new THREE.Mesh(new THREE.ConeGeometry(0.7, 1.4, 6), hull); nose.rotation.x = -Math.PI / 2; nose.position.z = -4.2; g.add(nose);
  const gem = new THREE.Mesh(new THREE.OctahedronGeometry(0.45, 0), glow(gemC)); gem.position.set(0, 0.1, -5); gem.name = 'gem'; g.add(gem);
  // Wings: a slight sweep and dihedral, a stripe near each tip.
  for (const s of [-1, 1]) {
    const w = new THREE.Mesh(new THREE.BoxGeometry(5.6, 0.12, 1.9), sail);
    w.position.set(s * 3.1, 0.35, -0.6); w.rotation.z = s * 0.08; w.rotation.y = -s * 0.12; g.add(w);
    const st = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.14, 1.92), stripe);
    st.position.set(s * 4.6, 0.47, -0.42); st.rotation.copy(w.rotation); g.add(st);
    const tip = new THREE.Mesh(new THREE.OctahedronGeometry(0.18, 0), glow(gemC)); tip.position.set(s * 5.9, 0.6, -0.3); tip.name = 'tip'; g.add(tip);
  }
  const tail = new THREE.Mesh(new THREE.BoxGeometry(3.2, 0.1, 1.0), sail); tail.position.set(0, 0.2, 3.3); g.add(tail);
  const fin = new THREE.Mesh(new THREE.BoxGeometry(0.1, 1.5, 1.1), stripe); fin.position.set(0, 0.9, 3.4); g.add(fin);
  // The seat and the pilot's head (a sky-raider's hood on the hexed one).
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.32, 6, 4), flat(hexed ? '#3B2A4A' : '#E0B48C')); head.position.set(0, 0.75, -1.4); head.name = 'pilot'; g.add(head);
  // First person (Mike 2026-11-05): what the pilot sees round the seat, shown only in that view. A canvas cowl in
  // front with a brass sighting ring on it, and the hull's gunwales either side.
  if (!hexed) {
    const pit = new THREE.Group(); pit.name = 'cockpit'; pit.visible = false;
    const cowl = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.12, 0.4), hull); cowl.position.set(0, 0.6, -2.5); cowl.rotation.x = 0.3; pit.add(cowl);
    const brass = glow('#E8C060', 1.1);
    const sight = new THREE.Mesh(new THREE.TorusGeometry(0.045, 0.004, 4, 16), brass); sight.position.set(0, 1.05, -2.6); pit.add(sight);
    const post = new THREE.Mesh(new THREE.BoxGeometry(0.008, 0.3, 0.008), brass); post.position.set(0, 0.8, -2.6); pit.add(post);
    for (const s of [-1, 1]) { const rail = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.1, 1.6), hull); rail.position.set(s * 0.62, 0.55, -1.35); pit.add(rail); }
    g.add(pit);
  }
  g.traverse((o) => { o.raycast = () => {}; });
  return g;
}

export interface SkyScene {
  scene: THREE.Scene;
  beacon: THREE.Group;
  rings: THREE.Mesh[];
  dispose(): void;
}

export function buildSkyScene(m: SkyMap): SkyScene {
  const scene = new THREE.Scene();
  scene.background = SKY;
  scene.fog = new THREE.Fog(SKY, 500, 2300);
  scene.add(new THREE.HemisphereLight('#DDEEFF', '#5B6B3A', 1.25));
  const sun = new THREE.DirectionalLight('#FFF1D6', 1.7); sun.position.set(0.5, 1, 0.3); scene.add(sun);
  scene.add(terrain(m));
  const water = new THREE.Mesh(new THREE.PlaneGeometry(SIZE * 1.6, SIZE * 1.6), new THREE.MeshLambertMaterial({ color: '#4C8FBF' }));
  water.rotation.x = -Math.PI / 2; water.position.y = WATER; scene.add(water);
  scene.add(trees(m));
  const rockM = flat('#9A8F80');
  for (const s of m.spires) {
    const sp = new THREE.Mesh(new THREE.CylinderGeometry(s.r * 0.55, s.r, s.h + (0 - s.base), 7), rockM);
    sp.position.set(s.x, s.base + (s.h - s.base) / 2, s.z); sp.rotation.y = s.r; scene.add(sp);
    const cap = new THREE.Mesh(new THREE.ConeGeometry(s.r * 0.6, s.r * 1.2, 7), flat('#5E8C46')); cap.position.set(s.x, s.h + s.r * 0.5, s.z); scene.add(cap);
  }
  // The launch perch (A): a timber tower with a ramp.
  const wood = flat('#8A5A32'), wood2 = flat('#6B4426');
  const perch = new THREE.Group();
  for (const [x, z] of [[-4, -4], [4, -4], [-4, 4], [4, 4]]) { const leg = new THREE.Mesh(new THREE.BoxGeometry(1, PERCH_H, 1), wood2); leg.position.set(x, PERCH_H / 2, z); perch.add(leg); }
  const deck = new THREE.Mesh(new THREE.BoxGeometry(10, 0.8, 10), wood); deck.position.y = PERCH_H; perch.add(deck);
  const ramp = new THREE.Mesh(new THREE.BoxGeometry(4, 0.5, 14), wood); ramp.position.set(0, PERCH_H - 1, -11); ramp.rotation.x = -0.18; perch.add(ramp);
  perch.position.set(m.start.x, m.start.y, m.start.z); perch.rotation.y = m.start.yaw + Math.PI; scene.add(perch);
  // The beacon (B): a stone tower and a pillar of blue fire you can see from anywhere.
  const beacon = new THREE.Group();
  const stone = new THREE.Mesh(new THREE.CylinderGeometry(6, 8, 40, 8), flat('#B9AE9A')); stone.position.y = 20; beacon.add(stone);
  const bowl = new THREE.Mesh(new THREE.CylinderGeometry(9, 6, 4, 8), flat('#7A6E5E')); bowl.position.y = 42; beacon.add(bowl);
  const fire = new THREE.Mesh(new THREE.CylinderGeometry(12, 16, 260, 8, 1, true), glow('#5FB8FF', 1.4, { transparent: true, opacity: 0.55, depthWrite: false, side: THREE.DoubleSide, fog: false }));
  fire.position.y = 44 + 130; fire.name = 'beacon-fire'; beacon.add(fire);
  const ring = new THREE.Mesh(new THREE.TorusGeometry(45, 1.4, 6, 24), glow('#BFE6FF', 1.3, { transparent: true, opacity: 0.8 }));
  ring.rotation.x = Math.PI / 2; ring.position.y = 70; ring.name = 'beacon-ring'; beacon.add(ring);
  beacon.position.set(m.goal.x, m.goal.y, m.goal.z); scene.add(beacon);
  // Wind rings: +2 s each.
  const ringMat = glow('#FFE08A', 1.3, { transparent: true, opacity: 0.85 });
  const rings = m.rings.map((r) => {
    const t = new THREE.Mesh(new THREE.TorusGeometry(16, 1.1, 6, 20), ringMat);
    t.position.set(r.x, r.y, r.z); t.rotation.y = r.yaw; scene.add(t);
    return t;
  });
  scene.traverse((o) => { o.raycast = () => {}; });
  return {
    scene, beacon, rings,
    dispose() {
      scene.traverse((o) => {
        const mesh = o as THREE.Mesh;
        if (mesh.geometry) mesh.geometry.dispose();
        const mat = mesh.material as THREE.Material | THREE.Material[] | undefined;
        if (Array.isArray(mat)) mat.forEach((x) => x.dispose()); else mat?.dispose();
      });
    },
  };
}
