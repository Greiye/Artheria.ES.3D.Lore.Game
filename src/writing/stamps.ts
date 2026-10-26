import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { drawSketch, SIZE, type Sketch } from './sketch';
import { INKS, type MarginNote, type Paper } from './margins';

// Phase C in the world: the sketch on the camp banner (B10), margin scribbles on the lectern book's
// pages (B3) and a ribbon bookmark on every shelf book you have written in.

const nearest = (c: HTMLCanvasElement) => {
  const t = new THREE.CanvasTexture(c);
  t.magFilter = THREE.NearestFilter; t.minFilter = THREE.NearestFilter; t.generateMipmaps = false;
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
};

// Banner cloth: the sketch over undyed linen, with a stitched hem.
export function stampBanner(cloth: THREE.Mesh, s: Sketch) {
  const c = document.createElement('canvas');
  c.width = SIZE; c.height = SIZE + 8;
  const g = c.getContext('2d')!;
  g.fillStyle = '#E4D6B0'; g.fillRect(0, 0, c.width, c.height);
  for (let i = 0; i < 90; i++) { g.fillStyle = `rgba(120,90,50,${0.05 + Math.random() * 0.06})`; g.fillRect(Math.random() * SIZE | 0, Math.random() * c.height | 0, 1, 1); }
  drawSketch(g, s, 0, 2);
  g.fillStyle = '#8A5A2E';
  for (let x = 0; x < SIZE; x += 2) { g.fillRect(x, 0, 1, 1); g.fillRect(x + 1, c.height - 2, 1, 2); }
  const m = cloth.material as THREE.MeshLambertMaterial;
  m.map?.dispose();
  m.map = nearest(c);
  m.needsUpdate = true;
  cloth.userData.sketch = s.id;
}

// Wind: the free edge moves most, the top edge (tied to the crossbar) not at all.
export function swayBanner(cloth: THREE.Mesh, t: number) {
  const p = cloth.geometry.attributes.position as THREE.BufferAttribute;
  const base: Float32Array = cloth.userData.base ?? (cloth.userData.base = (p.array as Float32Array).slice());
  for (let i = 0; i < p.count; i++) {
    const x = base[i * 3], y = base[i * 3 + 1];
    const free = (0.6 - y) / 1.2;   // 0 at the top, 1 at the bottom
    p.setZ(i, (Math.sin(t * 2.1 + x * 4 + y * 2) * 0.05 + Math.sin(t * 3.3 + x * 7) * 0.02) * free);
  }
  p.needsUpdate = true;
}

const PAPER: Record<Paper, string> = { fresh: '#EFE3C4', aged: '#E2CD9C', vellum: '#F4ECD8', charred: '#E4D2A4' };

// One lectern page: paper, faint text lines, and a scribble + seal for each note (up to 4 shown).
export function paintLecternPage(mesh: THREE.Mesh, notes: MarginNote[], paper: Paper, seals: (id?: string) => Sketch | undefined) {
  const W = 64, H = 88;
  const c = document.createElement('canvas'); c.width = W; c.height = H;
  const g = c.getContext('2d')!;
  g.fillStyle = PAPER[paper]; g.fillRect(0, 0, W, H);
  if (paper === 'charred') { g.strokeStyle = '#5a3a20'; g.lineWidth = 3; g.strokeRect(0, 0, W, H); }
  g.fillStyle = 'rgba(60,50,35,.28)';
  for (let y = 10; y < H - 8; y += 4) g.fillRect(8, y, W - 16 - ((y * 7) % 11), 1);
  notes.slice(-4).forEach((n, i) => {
    const y0 = 14 + i * 18;
    g.strokeStyle = INKS[n.ink] ?? '#2B2A24'; g.lineWidth = 1;
    g.beginPath();
    for (let x = 0; x < 12; x++) { const px = W - 15 + x, py = y0 + Math.sin(x * 1.7 + i) * 2; x ? g.lineTo(px, py) : g.moveTo(px, py); }
    g.stroke();
    g.beginPath(); g.moveTo(W - 15, y0 + 5); g.lineTo(W - 6, y0 + 4); g.stroke();
    const seal = seals(n.seal);
    if (seal) {
      g.fillStyle = '#A8322A'; g.beginPath(); g.arc(W - 10, y0 + 11, 4.5, 0, Math.PI * 2); g.fill();
      g.save(); g.beginPath(); g.arc(W - 10, y0 + 11, 3.5, 0, Math.PI * 2); g.clip();
      drawSketch(g, seal, W - 14, y0 + 7, 8 / SIZE); g.restore();
    }
  });
  const old = mesh.userData.marginMat as THREE.MeshLambertMaterial | undefined;
  if (old) { old.map?.dispose(); old.dispose(); }
  const m = new THREE.MeshLambertMaterial({ map: nearest(c) });
  mesh.userData.marginMat = m;
  mesh.material = m;
}

// Ribbons: one merged mesh, one draw call, rebuilt whenever notes change.
export function buildBookmarks(books: Map<string, THREE.Mesh>, notes: MarginNote[], into: THREE.Object3D) {
  into.clear();
  const byEntry = new Map<string, MarginNote>();
  for (const n of notes) byEntry.set(n.entryId, n);
  const parts: THREE.BufferGeometry[] = [];
  const box = new THREE.Box3(), col = new THREE.Color();
  for (const [id, n] of byEntry) {
    const b = books.get(id);
    if (!b) continue;
    b.updateWorldMatrix(true, false);
    box.setFromObject(b);
    const g = new THREE.BoxGeometry(0.018, 0.16, 0.012).toNonIndexed();
    g.translate((box.min.x + box.max.x) / 2, box.max.y + 0.02, (box.min.z + box.max.z) / 2);
    col.set(INKS[n.ink] ?? '#B3362C');
    const cols = new Float32Array(g.attributes.position.count * 3);
    for (let i = 0; i < cols.length; i += 3) { cols[i] = col.r; cols[i + 1] = col.g; cols[i + 2] = col.b; }
    g.setAttribute('color', new THREE.BufferAttribute(cols, 3));
    g.deleteAttribute('uv'); g.deleteAttribute('normal');
    parts.push(g);
  }
  if (!parts.length) return;
  const mesh = new THREE.Mesh(mergeGeometries(parts), new THREE.MeshBasicMaterial({ vertexColors: true }));
  mesh.name = 'bookmarks';
  mesh.raycast = () => {};
  into.add(mesh);
}
