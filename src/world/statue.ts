// B49 (Mike 2026-11-04): the most-kills high score, as a statue. The best goblin count in one delve under the
// library stands on the green: your own forged figure in painted stone, at the look you had when you set the record,
// with a plaque giving the count. Kept per profile ("gametool.kills" is not a shared key, src/profiles.ts).
import * as THREE from 'three';
import { buildFigure, type FigureLook } from './figure';
import { pixelTexture } from '../tex/pixel';

export interface KillRecord { total: number; best: { count: number; name: string; look: FigureLook; height: number; at: string } | null }
const KEY = 'gametool.kills';
export function loadKills(): KillRecord {
  try {
    const r = JSON.parse(localStorage.getItem(KEY) ?? 'null') as KillRecord | null;
    if (r && typeof r.total === 'number') return { total: Math.max(0, r.total | 0), best: r.best && r.best.count > 0 ? r.best : null };
  } catch { /* no record yet */ }
  return { total: 0, best: null };
}
export function saveKills(r: KillRecord) { try { localStorage.setItem(KEY, JSON.stringify(r)); } catch { /* private mode */ } }

export const plaqueText = (r: KillRecord) => r.best
  ? `${r.best.name}: ${r.best.count} goblin${r.best.count === 1 ? '' : 's'} in one delve under the library (${r.best.at})`
  : 'This plinth waits for the best goblin hunter in Aralon. Most goblins in one delve under the library.';

function plaqueTexture(r: KillRecord): THREE.CanvasTexture {
  const c = document.createElement('canvas'); c.width = 256; c.height = 128;
  const g = c.getContext('2d')!;
  const grad = g.createLinearGradient(0, 0, 0, 128); grad.addColorStop(0, '#C9A24E'); grad.addColorStop(1, '#8A6526');
  g.fillStyle = grad; g.fillRect(0, 0, 256, 128);
  g.strokeStyle = '#5A3E14'; g.lineWidth = 6; g.strokeRect(5, 5, 246, 118);
  g.fillStyle = '#2E1E08'; g.textAlign = 'center'; g.textBaseline = 'middle';
  if (r.best) {
    g.font = 'bold 54px Georgia, serif'; g.fillText(String(r.best.count), 128, 50);
    g.font = '18px Georgia, serif'; g.fillText('MOST GOBLINS IN ONE DELVE', 128, 88);
    g.font = 'italic 16px Georgia, serif'; g.fillText(r.best.name.slice(0, 24), 128, 110);
  } else {
    g.font = 'italic 20px Georgia, serif'; g.fillText('Most goblins in one delve', 128, 52);
    g.font = '16px Georgia, serif'; g.fillText('(no record yet)', 128, 82);
  }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}

const STONE = new THREE.Color('#CFC6B4');
/** The monument: plinth + plaque, and the figure once there is a record. */
export class KillStatue {
  readonly group = new THREE.Group();
  readonly hit: THREE.Mesh;
  figure: THREE.Group | null = null;
  private plaque: THREE.Mesh;
  constructor(x: number, z: number, ry: number) {
    this.group.name = 'kill-statue';
    this.group.position.set(x, 0, z); this.group.rotation.y = ry;
    const stone = new THREE.MeshLambertMaterial({ map: pixelTexture('stone'), color: '#D8D0C0' });
    const base = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.35, 1.5), stone); base.position.y = 0.175;
    const plinth = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.9, 1.1), stone); plinth.position.y = 0.35 + 0.45;
    this.plaque = new THREE.Mesh(new THREE.PlaneGeometry(0.8, 0.4), new THREE.MeshBasicMaterial());
    this.plaque.position.set(0, 0.8, 0.556); this.plaque.name = 'kill-plaque';
    this.group.add(base, plinth, this.plaque);
    this.hit = new THREE.Mesh(new THREE.BoxGeometry(1.6, 2.6, 1.6), new THREE.MeshBasicMaterial({ visible: false }));
    this.hit.position.y = 1.3; this.group.add(this.hit);
  }
  /** Rebuild the plaque, and the figure from the look at the record. */
  set(r: KillRecord) {
    const m = this.plaque.material as THREE.MeshBasicMaterial;
    m.map?.dispose(); m.map = plaqueTexture(r); m.needsUpdate = true;
    if (this.figure) { this.group.remove(this.figure); this.figure = null; }
    if (!r.best) return;
    const fig = buildFigure(r.best.look, THREE.MathUtils.clamp(r.best.height || 1.75, 1.4, 2.1));
    fig.name = 'kill-statue-figure';
    // Painted stone: every surface keeps its painted texture, tinted toward the plinth's stone.
    fig.traverse((o) => {
      const mesh = o as THREE.Mesh;
      if (!mesh.isMesh) return;
      const mats = (Array.isArray(mesh.material) ? mesh.material : [mesh.material]).map((mat) => {
        const c = mat.clone() as THREE.MeshBasicMaterial;
        if (c.color) c.color.lerp(STONE, 0.7);
        return c;
      });
      mesh.material = Array.isArray(mesh.material) ? mats : mats[0];
      mesh.raycast = () => {};
    });
    // A victor's pose: chin up, sword arm raised.
    const rig = fig.userData.rig as { bones?: Record<string, THREE.Bone> } | undefined;
    const b = rig?.bones;
    if (b?.armP) b.armP.rotation.z = 2.4;
    if (b?.foreP) b.foreP.rotation.z = 0.3;
    if (b?.armN) b.armN.rotation.z = -0.25;
    fig.position.y = 1.25;
    this.group.add(fig);
    this.figure = fig;
  }
}
