import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { drawSketch, SIZE, type Sketch } from './sketch';
import { INKS, type MarginNote } from './margins';

// Phase C in the world: the sketch on the camp banner (B10) and a ribbon bookmark on every shelf book you have
// written in (B3). v0.06 W1: the lectern and its painted pages are gone.

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
