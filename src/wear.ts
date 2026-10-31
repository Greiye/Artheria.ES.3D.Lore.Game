import * as THREE from 'three';
import { RIG, type BoneName } from './world/figure';
import type { Player } from './player';

// UX pass (Mike 2026-10-31, "torn clothes"): in the dungeon your clothes show how hurt you are. As health drops they
// darken with grime and blood, and rips open one by one (chest, back, thighs, sleeve, side). Back above ground they're
// mended (the camp's needle and thread), so the town always sees you whole.
// Each rip: [bone, x, y, z in figure metres for a 1.75 m figure, facing (+1 front / -1 back), size, wear it opens at].
const RIPS: [BoneName, number, number, number, number, number, number][] = [
  ['spine', 0.07, 1.24, 0.125, 1, 0.07, 0.25],
  ['thighP', 0.1, 0.66, 0.085, 1, 0.06, 0.4],
  ['spine', -0.06, 1.12, -0.12, -1, 0.08, 0.55],
  ['armN', -0.25, 1.22, 0.06, 1, 0.045, 0.65],
  ['thighN', -0.1, 0.58, 0.085, 1, 0.055, 0.75],
  ['spine', 0.13, 1.02, 0.1, 1, 0.05, 0.85],
];

/** A ragged, roughly round hole: a dark tear with a lighter frayed rim. */
function ripGeometry(r: number, seed: number): THREE.ShapeGeometry {
  const s = new THREE.Shape(), n = 9;
  for (let i = 0; i <= n; i++) {
    const a = (i / n) * Math.PI * 2, k = r * (0.55 + 0.45 * Math.abs(Math.sin(seed * 7.1 + i * 2.3)));
    const x = Math.cos(a) * k * 1.3, y = Math.sin(a) * k;
    if (i) s.lineTo(x, y); else s.moveTo(x, y);
  }
  return new THREE.ShapeGeometry(s);
}

export class Wear {
  level = 0;
  private rips: THREE.Mesh[] = [];
  private mat: THREE.MeshBasicMaterial | null = null;
  private base = new THREE.Color(1, 1, 1);
  private grime = new THREE.Color('#8E7462');

  constructor(private player: Player) { this.attach(); }

  /** Sew the rips onto the current figure (again after the forge swaps it) and give it its own material to dirty. */
  attach() {
    this.rips = [];
    const fig = this.player.body.children[0];
    const mesh = fig?.getObjectByName('figure-body') as THREE.SkinnedMesh | undefined;
    const rig = fig?.userData.rig as { bones: Record<BoneName, THREE.Bone>; rest: Record<BoneName, THREE.Vector3> } | undefined;
    if (!mesh || !rig) return;
    this.mat = (mesh.material as THREE.MeshBasicMaterial).clone();   // figures share atlas materials; only ours gets dirty
    mesh.material = this.mat;
    this.base.copy(this.mat.color);
    const U = rig.rest.hips.y / RIG.hips[1][1];
    const tear = new THREE.MeshBasicMaterial({ color: '#2A1712', side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: -4 });
    const fray = new THREE.MeshBasicMaterial({ color: '#B9A58A', side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: -3 });
    RIPS.forEach(([bone, x, y, z, face, r], i) => {
      const p = RIG[bone][1], g = new THREE.Group();
      const hole = new THREE.Mesh(ripGeometry(r * U, i + 1), tear), rim = new THREE.Mesh(ripGeometry(r * U * 1.25, i + 1), fray);
      rim.position.z = -0.001;
      g.add(rim, hole);
      g.position.set((x - p[0]) * U, (y - p[1]) * U, (z - p[2]) * U);
      if (face < 0) g.rotation.y = Math.PI;
      g.rotation.z = i * 0.7;
      g.visible = false;
      g.traverse((o) => { (o as THREE.Mesh).raycast = () => {}; });
      rig.bones[bone].add(g);
      this.rips.push(hole);
    });
  }

  /** 0 = whole, 1 = in tatters. */
  set(level: number) {
    this.level = Math.max(0, Math.min(1, level));
    RIPS.forEach(([, , , , , , at], i) => { const g = this.rips[i]?.parent; if (g) g.visible = this.level >= at; });
    this.mat?.color.copy(this.base).lerp(this.grime, this.level * 0.55);
  }
  get open() { return this.rips.filter((h) => h.parent?.visible).length; }
}
