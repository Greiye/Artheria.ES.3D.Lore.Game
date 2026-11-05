import * as THREE from 'three';
import type { Player } from './player';

// v0.04: a hand torch. Lit, it carries a warm flickering point light with the player: in the left hand of
// the figure in third person, at the lower left of the view in first person. D-pad down (held), T, or the
// phone's torch button lights it; the D-pad quick swap (left hand) does too.
const FLAME = new THREE.Color('#FF9448');

function flameTexture(): THREE.CanvasTexture {
  const c = document.createElement('canvas'); c.width = c.height = 32;
  const g = c.getContext('2d')!;
  const grad = g.createRadialGradient(16, 20, 1, 16, 18, 15);
  grad.addColorStop(0, 'rgba(255,250,210,1)'); grad.addColorStop(0.35, 'rgba(255,180,70,0.95)'); grad.addColorStop(1, 'rgba(255,90,20,0)');
  g.fillStyle = grad; g.beginPath(); g.moveTo(16, 1); g.quadraticCurveTo(30, 20, 16, 31); g.quadraticCurveTo(2, 20, 16, 1); g.fill();
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function torchModel(tex: THREE.Texture): { group: THREE.Group; flame: THREE.Sprite } {
  const group = new THREE.Group();
  const stick = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.03, 0.42, 6), new THREE.MeshBasicMaterial({ color: '#5A3A22' }));
  const wrap = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.035, 0.09, 6), new THREE.MeshBasicMaterial({ color: '#3A2A20' }));
  wrap.position.y = 0.2;
  const flame = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true }));
  flame.scale.set(0.16, 0.24, 1); flame.position.y = 0.33;
  group.add(stick, wrap, flame);
  group.traverse((o) => { (o as THREE.Mesh).raycast = () => {}; });
  return { group, flame };
}

export class Torch {
  lit = false;
  /** Which hand holds it: -1 left (the usual), 1 right. Mike 2026-11-05: any item in either hand. */
  side: 1 | -1 = -1;
  /** Two torches: the first one's light burns brighter; the second carries none (one light keeps phones fast). */
  boost = 1;
  readonly light = new THREE.PointLight(FLAME, 0, 11, 1.6);
  private held: { group: THREE.Group; flame: THREE.Sprite };     // in the figure's hand
  private view: { group: THREE.Group; flame: THREE.Sprite };     // first-person viewmodel
  private t = 0;
  private tmp = new THREE.Vector3();

  constructor(scene: THREE.Scene, camera: THREE.Camera, private player: Player, private ownLight = true) {
    const tex = flameTexture();
    this.held = torchModel(tex); this.view = torchModel(tex);
    this.held.group.visible = this.view.group.visible = false;
    this.placeView();
    camera.add(this.view.group);
    this.light.castShadow = false;
    if (ownLight) scene.add(this.light);
    this.attach();
  }

  /** Put the torch in the player figure's hand (again after the forge swaps the figure). */
  attach() {
    const rig = this.player.body.children[0]?.userData.rig as { bones: Record<string, THREE.Bone> } | undefined;
    const bone = this.side < 0 ? rig?.bones.foreP : rig?.bones.foreN;
    if (!bone) return;
    bone.add(this.held.group);
    this.held.group.position.set(-0.03 * this.side, -0.3, 0.06);
    this.held.group.rotation.set(0.35, 0, 0);
  }

  set(on: boolean) { this.lit = on; }
  setSide(side: 1 | -1) { if (side === this.side) return; this.side = side; this.attach(); this.placeView(); }
  private placeView() { this.view.group.position.set(0.32 * this.side, -0.3, -0.55); this.view.group.rotation.set(0.25, 0, -0.18 * this.side); }
  /** A copy of the hand-held torch (shared geometry) for another player's figure (multiplayer). */
  cloneHeld() { const g = this.held.group.clone(); g.visible = false; return g; }
  toggle() { this.lit = !this.lit; }

  update(dt: number, firstPerson: boolean) {
    this.t += dt;
    const fl = 1 + Math.sin(this.t * 13) * 0.06 + Math.sin(this.t * 31.7) * 0.04 + Math.sin(this.t * 5.3) * 0.05;
    this.light.intensity = this.lit && this.ownLight ? 8 * fl * this.boost : 0;
    this.light.visible = this.lit && this.ownLight;
    this.held.group.visible = this.lit && !firstPerson && this.player.body.visible;
    this.view.group.visible = this.lit && firstPerson;
    for (const m of [this.held, this.view]) m.flame.scale.set(0.16 * fl, 0.24 * (2 - fl), 1);
    // The light sits at the flame, a little out from the body so it lights the player too.
    const src = this.held.group.visible ? this.held.flame : this.view.flame;
    if (this.lit && (this.held.group.visible || this.view.group.visible)) src.getWorldPosition(this.tmp);
    else this.tmp.copy(this.player.pos).setY(this.player.pos.y + 1.4);
    this.light.position.copy(this.tmp);
  }
}
