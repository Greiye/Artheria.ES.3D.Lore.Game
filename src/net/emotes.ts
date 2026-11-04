import * as THREE from 'three';
import type { Gesture } from '../anim/procedural';

// Multiplayer 3 (defaults: no free-text chat; preset phrases and emotes only, so a room is safe for anyone).
// The wire carries only the index into this list, never text.
export interface Emote { label: string; say: string; gesture?: Gesture }
export const EMOTES: Emote[] = [
  { label: 'Wave', say: '👋', gesture: 'wave' },
  { label: 'Hello!', say: 'Hello!', gesture: 'wave' },
  { label: 'Follow me!', say: 'Follow me!' },
  { label: 'Over here!', say: 'Over here!', gesture: 'wave' },
  { label: 'Wait for me', say: 'Wait for me!' },
  { label: 'Look at this', say: 'Look at this!', gesture: 'pickup' },
  { label: 'Yes', say: 'Yes!' },
  { label: 'No', say: 'No.' },
  { label: 'Thanks!', say: 'Thanks!' },
  { label: 'Good game!', say: 'Good game!', gesture: 'stretch' },
];
export const emoteAt = (i: unknown): Emote | null => (typeof i === 'number' && Number.isInteger(i) ? EMOTES[i] ?? null : null);

/** A speech bubble over someone's head that fades after a few seconds. */
export class Bubble {
  readonly sprite: THREE.Sprite;
  private t = 0;
  private canvas = document.createElement('canvas');
  private tex: THREE.CanvasTexture;
  constructor() {
    this.canvas.width = 320; this.canvas.height = 96;
    this.tex = new THREE.CanvasTexture(this.canvas);
    this.tex.colorSpace = THREE.SRGBColorSpace;
    this.sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: this.tex, transparent: true, depthWrite: false, depthTest: false }));
    this.sprite.scale.set(1.5, 0.45, 1);
    this.sprite.visible = false;
    this.sprite.renderOrder = 6;
    this.sprite.name = 'bubble';
  }
  get text() { return this.sprite.visible ? this.sprite.userData.text as string : ''; }
  say(text: string, secs = 4) {
    const g = this.canvas.getContext('2d')!;
    g.clearRect(0, 0, 320, 96);
    g.font = '600 34px Georgia, serif';
    const w = Math.min(310, g.measureText(text).width + 40);
    g.fillStyle = '#FBF4E2'; g.strokeStyle = 'rgba(60, 40, 20, 0.7)'; g.lineWidth = 3;
    g.beginPath(); g.roundRect?.((320 - w) / 2, 6, w, 64, 20); g.fill(); g.stroke();
    g.beginPath(); g.moveTo(150, 69); g.lineTo(160, 90); g.lineTo(172, 69); g.closePath(); g.fill();
    g.fillStyle = '#2A1E12'; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillText(text, 160, 39, 290);
    this.tex.needsUpdate = true;
    this.sprite.userData.text = text;
    this.sprite.visible = true; this.t = secs;
    (this.sprite.material as THREE.SpriteMaterial).opacity = 1;
  }
  update(dt: number) {
    if (!this.sprite.visible) return;
    this.t -= dt;
    (this.sprite.material as THREE.SpriteMaterial).opacity = Math.min(1, Math.max(0, this.t / 0.5));
    if (this.t <= 0) this.sprite.visible = false;
  }
}
