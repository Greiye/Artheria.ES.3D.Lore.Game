import * as THREE from 'three';
import { Batch } from '../world/batch';
import { pixelTexture } from '../tex/pixel';
import type { Collider } from '../world/index';
import { escapeHtml } from '../submit';

// B9 gallery hall: an open-air hall east of the dais. Eight framed exhibits, each credited: your own
// creations (on this device) and lore from the library once you have discovered it. All eight pictures
// share one canvas atlas, so the hall is a handful of draw calls; it is repainted when you walk in.
export interface Exhibit {
  id: string; title: string; credit: string; kind: string; text: string;
  discovered: boolean; hint?: string;
  paint?: (g: CanvasRenderingContext2D, x: number, y: number, size: number) => void;
  image?: string;   // data URL for the card
  open?: () => void;
}
export const GALLERY = { x: 15, z: 6, minX: 10, maxX: 20, minZ: 2.5, maxZ: 9.5 };
// Tiles are laid out at 256 px but stored at half size (512 × 256 atlas, the mobile texture budget); the
// exhibit card (E on a frame) shows the full text.
const TILE = 256, COLS = 4, STORE = 0.5;

export class Gallery {
  readonly hitboxes: THREE.Mesh[] = [];
  private atlas = document.createElement('canvas');
  private tex: THREE.CanvasTexture;
  exhibits: Exhibit[] = [];

  constructor(scene: THREE.Scene, colliders: Collider[]) {
    const V = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);
    const B = new Batch();
    const stone = new THREE.MeshLambertMaterial({ map: pixelTexture('stone') }), moss = new THREE.MeshLambertMaterial({ map: pixelTexture('mossStone') }), wood = new THREE.MeshLambertMaterial({ map: pixelTexture('planks') });
    const G = GALLERY, W = G.maxX - G.minX, D = G.maxZ - G.minZ;
    B.add(stone, new THREE.BoxGeometry(W, 0.12, D), V(G.x, 0.06, G.z));
    B.box(moss, V(G.maxX - 0.2, 1.5, G.z), 0.4, 3, D);               // back wall (east)
    B.box(moss, V(G.x + 1, 1.5, G.minZ + 0.2), W - 2, 3, 0.4);       // south wall
    B.box(moss, V(G.x + 1, 1.5, G.maxZ - 0.2), W - 2, 3, 0.4);       // north wall
    for (const z of [G.minZ + 0.3, G.maxZ - 0.3]) { B.box(stone, V(G.minX + 0.4, 1.6, z), 0.6, 3.2, 0.6); B.box(stone, V(G.minX + 0.4, 3.3, z), 0.8, 0.2, 0.8); }
    B.box(wood, V(G.minX + 0.4, 3.35, G.z), 0.3, 0.25, D);            // lintel over the open west side
    colliders.push({ kind: 'box', minX: G.maxX - 0.4, maxX: G.maxX, minZ: G.minZ, maxZ: G.maxZ },
      { kind: 'box', minX: G.minX + 1, maxX: G.maxX, minZ: G.minZ, maxZ: G.minZ + 0.4 },
      { kind: 'box', minX: G.minX + 1, maxX: G.maxX, minZ: G.maxZ - 0.4, maxZ: G.maxZ },
      { kind: 'circle', x: G.minX + 0.4, z: G.minZ + 0.3, r: 0.4 }, { kind: 'circle', x: G.minX + 0.4, z: G.maxZ - 0.3, r: 0.4 });
    // Frames: [x, z, facing yaw]. Back wall faces west (-x), the side walls face into the hall.
    const slots: [number, number, number][] = [
      [G.maxX - 0.42, 3.6, -Math.PI / 2], [G.maxX - 0.42, 5.2, -Math.PI / 2], [G.maxX - 0.42, 6.8, -Math.PI / 2], [G.maxX - 0.42, 8.4, -Math.PI / 2],
      [13.4, G.maxZ - 0.42, Math.PI], [16.4, G.maxZ - 0.42, Math.PI], [13.4, G.minZ + 0.42, 0], [16.4, G.minZ + 0.42, 0],
    ];
    const pics: THREE.BufferGeometry[] = [];
    const hidden = new THREE.MeshBasicMaterial({ visible: false });
    slots.forEach(([x, z, yaw], i) => {
      const n = V(Math.sin(yaw), 0, Math.cos(yaw));
      B.box(wood, V(x - n.x * 0.03, 1.75, z - n.z * 0.03), Math.abs(n.x) > 0.5 ? 0.06 : 1.36, 1.5, Math.abs(n.x) > 0.5 ? 1.36 : 0.06);
      const g = new THREE.PlaneGeometry(1.2, 1.2);
      const u0 = (i % COLS) / COLS, v0 = 1 - (Math.floor(i / COLS) + 1) / 2;
      const uv = g.attributes.uv as THREE.BufferAttribute;
      for (let k = 0; k < uv.count; k++) uv.setXY(k, u0 + uv.getX(k) / COLS, v0 + uv.getY(k) / 2);
      g.rotateY(yaw).translate(x + n.x * 0.02, 1.8, z + n.z * 0.02);
      pics.push(g);
      const hb = new THREE.Mesh(new THREE.BoxGeometry(1.3, 1.4, 1.3), hidden);
      hb.position.set(x + n.x * 0.5, 1.8, z + n.z * 0.5); hb.name = 'exhibit:' + i; hb.userData.slot = i;
      scene.add(hb);
      this.hitboxes.push(hb);
    });
    B.flush(scene, 'gallery').forEach((m) => { m.castShadow = m.receiveShadow = true; });
    this.atlas.width = TILE * COLS * STORE; this.atlas.height = TILE * 2 * STORE;
    this.tex = new THREE.CanvasTexture(this.atlas);
    this.tex.colorSpace = THREE.SRGBColorSpace;
    const merged = new THREE.Mesh(mergeAll(pics), new THREE.MeshBasicMaterial({ map: this.tex }));
    merged.name = 'gallery-pictures'; merged.raycast = () => {};
    scene.add(merged);
  }

  // Repaint every exhibit into the atlas (cheap: eight small tiles).
  paint(list: Exhibit[]) {
    this.exhibits = list.slice(0, 8);
    const g = this.atlas.getContext('2d')!;
    g.setTransform(STORE, 0, 0, STORE, 0, 0);
    this.exhibits.forEach((e, i) => {
      const x = (i % COLS) * TILE, y = Math.floor(i / COLS) * TILE;
      g.fillStyle = e.discovered ? '#2A2620' : '#1C1A17'; g.fillRect(x, y, TILE, TILE);
      if (e.discovered && e.paint) e.paint(g, x + 16, y + 12, TILE - 32);
      else {
        g.fillStyle = e.discovered ? '#EFE3C4' : '#3A352C'; g.fillRect(x + 16, y + 12, TILE - 32, TILE - 80);
        g.fillStyle = e.discovered ? '#2B2A24' : '#6B6250'; g.font = `${e.discovered ? 'italic ' : ''}20px Georgia, serif`; g.textAlign = 'center';
        wrap(g, e.discovered ? e.text : (e.hint ?? 'Not yet discovered'), x + TILE / 2, y + 48, TILE - 56, 24, 6);
      }
      // Plaque.
      g.fillStyle = '#C9A86A'; g.fillRect(x + 20, y + TILE - 62, TILE - 40, 50);
      g.fillStyle = '#2B2418'; g.textAlign = 'center';
      g.font = 'bold 17px Georgia, serif'; g.fillText(clip(g, e.discovered ? e.title : '?', TILE - 52), x + TILE / 2, y + TILE - 40);
      g.font = '13px Georgia, serif'; g.fillText(clip(g, `${e.kind} · ${e.credit}`, TILE - 52), x + TILE / 2, y + TILE - 21);
    });
    for (let i = this.exhibits.length; i < 8; i++) { g.fillStyle = '#1C1A17'; g.fillRect((i % COLS) * TILE, Math.floor(i / COLS) * TILE, TILE, TILE); }
    this.tex.needsUpdate = true;
  }

  // The exhibit card (E on a frame).
  showCard(e: Exhibit, onClose: () => void) {
    const el = document.createElement('div');
    el.className = 'gallery-card';
    el.innerHTML = `<div class="card-in"><div class="credit">${escapeHtml(e.kind)} · by ${escapeHtml(e.credit)}</div><h3>${escapeHtml(e.discovered ? e.title : 'Not yet discovered')}</h3>
      ${e.discovered && e.image ? `<img alt="" src="${e.image}">` : ''}<p>${escapeHtml(e.discovered ? e.text : e.hint ?? '')}</p>
      <div class="forge-actions">${e.discovered && e.open ? '<button class="primary" data-act="open">Open</button>' : ''}<button class="secondary" data-act="close">Close</button></div></div>`;
    el.addEventListener('click', (ev) => {
      const a = (ev.target as HTMLElement).closest('[data-act]') as HTMLElement | null;
      if (!a) return;
      el.remove();
      if (a.dataset.act === 'open') e.open!(); else onClose();
    });
    document.body.appendChild(el);
    return el;
  }
}

function mergeAll(gs: THREE.BufferGeometry[]) {
  const pos: number[] = [], uv: number[] = [], idx: number[] = [];
  for (const g of gs) {
    const base = pos.length / 3;
    pos.push(...g.attributes.position.array); uv.push(...g.attributes.uv.array);
    idx.push(...Array.from(g.index!.array, (i) => i + base));
  }
  const m = new THREE.BufferGeometry();
  m.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  m.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  m.setIndex(idx);
  m.computeBoundingSphere();
  return m;
}
function clip(g: CanvasRenderingContext2D, s: string, w: number) {
  if (g.measureText(s).width <= w) return s;
  while (s.length > 1 && g.measureText(s + '…').width > w) s = s.slice(0, -1);
  return s + '…';
}
function wrap(g: CanvasRenderingContext2D, text: string, cx: number, y: number, w: number, lh: number, max: number) {
  const words = text.split(/\s+/);
  let line = '', n = 0;
  for (const word of words) {
    const t = line ? line + ' ' + word : word;
    if (g.measureText(t).width > w && line) { g.fillText(line, cx, y + n * lh); line = word; if (++n >= max) return; }
    else line = t;
  }
  if (line) g.fillText(n === max - 1 ? clip(g, line, w) : line, cx, y + n * lh);
}
