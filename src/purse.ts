import * as THREE from 'three';
import type { Player } from './player';

// UX pass (Mike 2026-10-31): your crowns show on your body, not on a counter. A leather purse hangs at the hip and
// fills out as the crowns come in (hidden when empty); it bobs when coins drop in, and main jingles it.
function purseModel(): THREE.Group {
  const g = new THREE.Group();
  const leather = new THREE.MeshLambertMaterial({ color: '#7A5634' }), cord = new THREE.MeshLambertMaterial({ color: '#C8A878' });
  const bag = new THREE.Mesh(new THREE.SphereGeometry(0.07, 8, 6), leather);
  bag.scale.set(1, 1.15, 0.75); bag.position.y = -0.07;
  const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.04, 0.05, 8), leather);
  neck.position.y = 0.01;
  const tie = new THREE.Mesh(new THREE.TorusGeometry(0.03, 0.007, 4, 10), cord);
  tie.rotation.x = Math.PI / 2; tie.position.y = 0.01;
  g.add(bag, neck, tie);
  g.traverse((o) => { (o as THREE.Mesh).raycast = () => {}; });
  return g;
}

export class Purse {
  readonly model = purseModel();
  crowns = 0;
  private bob = 0;

  constructor(private player: Player) { this.model.visible = false; this.attach(); }

  /** Hang it on the hip (again after the forge swaps the figure). */
  attach() {
    const rig = this.player.body.children[0]?.userData.rig as { bones: Record<string, THREE.Bone> } | undefined;
    const bone = rig?.bones.hips;
    if (!bone) return;
    bone.add(this.model);
    this.model.position.set(0.19, -0.04, 0.05);
  }

  set(crowns: number) {
    if (crowns > this.crowns) this.bob = 0.35;
    this.crowns = crowns;
    this.model.visible = crowns > 0;
  }

  /** Fuller with more crowns (full at 60); a little bounce when coins drop in. */
  update(dt: number) {
    this.bob = Math.max(0, this.bob - dt);
    const k = 0.75 + Math.min(1, this.crowns / 60) * 0.7, pop = 1 + Math.sin((0.35 - this.bob) * 30) * this.bob * 0.4;
    this.model.scale.setScalar(k * pop);
  }
}
