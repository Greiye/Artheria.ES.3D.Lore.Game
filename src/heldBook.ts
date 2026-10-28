import * as THREE from 'three';
import type { Player } from './player';

// v0.04: the open book the player figure holds while reading a shelf book (the 'read' pose in
// src/anim/procedural.ts). At the lectern the book lies on the stand, so none is held there.
function bookModel(): THREE.Group {
  const g = new THREE.Group();
  const cover = new THREE.MeshBasicMaterial({ color: '#6B3A2A' });
  const paper = new THREE.MeshBasicMaterial({ color: '#EADDB8' });
  for (const s of [-1, 1]) {
    const half = new THREE.Group();
    const c = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.006, 0.15), cover);
    const p = new THREE.Mesh(new THREE.BoxGeometry(0.094, 0.012, 0.142), paper);
    c.position.x = p.position.x = s * 0.05; p.position.y = 0.008;
    half.add(c, p);
    half.rotation.z = -s * 0.22;   // the two halves open in a shallow V
    g.add(half);
  }
  g.traverse((o) => { (o as THREE.Mesh).raycast = () => {}; });
  return g;
}

export class HeldBook {
  readonly model = bookModel();

  constructor(private player: Player) { this.model.visible = false; this.attach(); }

  /** Hold it in front of the chest (again after the forge swaps the figure). */
  attach() {
    const rig = this.player.body.children[0]?.userData.rig as { bones: Record<string, THREE.Bone> } | undefined;
    const bone = rig?.bones.spine;
    if (!bone) return;
    bone.add(this.model);
    this.model.position.set(0, 0.22, 0.3);
    this.model.rotation.set(-0.75, 0, 0);   // tipped up toward the face
    this.model.scale.setScalar(1.4);
  }

  set(on: boolean) { this.model.visible = on; }
}
