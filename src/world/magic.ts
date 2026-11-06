import * as THREE from 'three';
import { Painter } from './decor';
import { rng } from '../tex/pixel';
import { HALL, type Floor } from './ruin';
import type { FloatingStone } from './floating';

// Mike 2026-11-06 (Graphics thread): "Ruin and goblin life. But also occasional magic. This is good too, 10% of the
// time." So the library is mostly rubble and goblin mess, and the magic is rare and quiet: a few fallen stones with a
// rune still glowing on them, a half-scuffed rune circle on the floor, one book on a stand that turns its own pages,
// a few motes of light drifting down through the roof holes, and a hum of blue light under one floating stone outside.
// No new lights: every glow is an unlit additive surface, so it costs next to nothing on a phone.

const RUNE = 0x8fc4ff;

/** Our own made-up glyphs: short strokes and arcs on a 64px cell. */
function drawGlyph(g: CanvasRenderingContext2D, R: () => number, cx: number, cy: number, s: number) {
  g.beginPath();
  g.moveTo(cx, cy - s); g.lineTo(cx, cy + s);   // every rune has a stem
  const n = 1 + Math.floor(R() * 3);
  for (let k = 0; k < n; k++) {
    const y = cy + (R() - 0.5) * 1.4 * s, side = R() < 0.5 ? -1 : 1;
    if (R() < 0.5) { g.moveTo(cx, y); g.lineTo(cx + side * s * 0.7, y - s * 0.45); }
    else { g.moveTo(cx + side * s * 0.05, y); g.arc(cx + side * s * 0.4, y, s * 0.35, side < 0 ? 0 : Math.PI, side < 0 ? Math.PI : Math.PI * 2, side < 0); }
  }
  if (R() < 0.4) { g.moveTo(cx - s * 0.3, cy + s); g.lineTo(cx + s * 0.3, cy + s); }
  g.stroke();
}

function runeTexture(seed: number, kind: 'strip' | 'circle'): THREE.CanvasTexture {
  const R = rng(seed), c = document.createElement('canvas');
  c.width = c.height = kind === 'circle' ? 256 : 128;
  const g = c.getContext('2d')!;
  g.strokeStyle = '#fff'; g.lineCap = 'round'; g.lineJoin = 'round'; g.shadowColor = '#fff'; g.shadowBlur = 6;
  if (kind === 'strip') {
    g.lineWidth = 5;
    for (let i = 0; i < 3; i++) drawGlyph(g, R, 22 + i * 42, 64, 22);
  } else {
    g.lineWidth = 4;
    g.beginPath(); g.arc(128, 128, 118, 0, Math.PI * 2); g.stroke();
    g.beginPath(); g.arc(128, 128, 84, 0, Math.PI * 2); g.stroke();
    for (let i = 0; i < 9; i++) {
      const a = (i / 9) * Math.PI * 2;
      g.save(); g.translate(128 + Math.cos(a) * 101, 128 + Math.sin(a) * 101); g.rotate(a + Math.PI / 2); g.lineWidth = 3; drawGlyph(g, R, 0, 0, 11); g.restore();
    }
    g.beginPath(); for (let i = 0; i < 3; i++) { const a = (i / 3) * Math.PI * 2 - Math.PI / 2; g[i ? 'lineTo' : 'moveTo'](128 + Math.cos(a) * 84, 128 + Math.sin(a) * 84); } g.closePath(); g.stroke();
    // Goblin feet have scuffed a third of it away.
    g.globalCompositeOperation = 'destination-out'; g.shadowBlur = 0;
    for (let k = 0; k < 26; k++) { g.beginPath(); g.ellipse(40 + R() * 90, 150 + R() * 90, 10 + R() * 18, 5 + R() * 8, R() * 3, 0, Math.PI * 2); g.fill(); }
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

/** A soft round spot (for motes and halos: no hard square edges). */
let softTex: THREE.CanvasTexture | null = null;
function soft(): THREE.CanvasTexture {
  if (softTex) return softTex;
  const c = document.createElement('canvas'); c.width = c.height = 64;
  const g = c.getContext('2d')!, gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.35, 'rgba(255,255,255,0.5)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = gr; g.fillRect(0, 0, 64, 64);
  return (softTex = new THREE.CanvasTexture(c));
}

const glowMat = (map: THREE.Texture | null, opacity: number) => new THREE.MeshBasicMaterial({ color: RUNE, map, transparent: true, opacity, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide });

export interface RareMagic {
  runes: THREE.Mesh[]; circle: THREE.Mesh | null; book: { group: THREE.Group; page: THREE.Object3D } | null;
  motes: THREE.Points; hum: THREE.Sprite | null; update: (t: number) => void;
}

export function buildRareMagic(group: THREE.Object3D, floor: Floor, holes: { x: number; z: number }[], floating: FloatingStone[]): RareMagic {
  const R = rng(9091);
  const place = (r: number): [number, number, number] | null => {
    for (let i = 0; i < 400; i++) {
      const x = HALL.minX + 1 + R() * (HALL.maxX - HALL.minX - 2), z = HALL.back + 1 + R() * (HALL.front - HALL.back - 2);
      if (floor.free(x, z, r)) { floor.take(x, z, r); return [x, z, r]; }
    }
    return null;
  };

  // 1 · Three fallen blocks that still carry a glowing rune.
  const P = new Painter(9092), runes: THREE.Mesh[] = [];
  for (let i = 0; i < 3; i++) {
    const at = place(0.9); if (!at) continue;
    const [x, z] = at, ry = R() * Math.PI;
    P.add(new THREE.BoxGeometry(1.3, 0.55, 0.8), ['#77706A', '#6A645F', '#827B73'][i], new THREE.Vector3(x, 0.26, z), ry);
    const rune = new THREE.Mesh(new THREE.PlaneGeometry(1.05, 0.5).rotateX(-Math.PI / 2), glowMat(runeTexture(500 + i, 'strip'), 0.85));
    rune.rotation.y = ry;
    rune.position.set(x, 0.56, z); rune.name = 'library-rune'; rune.raycast = () => {};
    group.add(rune); runes.push(rune);
  }

  // 2 · A rune circle on the floor, a third of it scuffed away.
  let circle: THREE.Mesh | null = null;
  const cAt = place(1.15) ?? place(0.95) ?? place(0.8);   // the hall is crowded; it shrinks to fit
  if (cAt) {
    circle = new THREE.Mesh(new THREE.CircleGeometry(1, 40).rotateX(-Math.PI / 2), glowMat(runeTexture(777, 'circle'), 0.55));
    circle.position.set(cAt[0], 0.035, cAt[1]); circle.scale.setScalar(cAt[2] + 0.1); circle.rotation.y = R() * Math.PI; circle.name = 'library-rune-circle'; circle.raycast = () => {};
    circle.renderOrder = 2; group.add(circle);
  }

  // 3 · A book on a stand that turns its own pages.
  let book: RareMagic['book'] = null;
  const bAt = place(0.6);
  if (bAt) {
    const g = new THREE.Group(); g.name = 'library-turning-book';
    const S = new Painter(9093);
    S.add(new THREE.CylinderGeometry(0.06, 0.09, 0.95, 6), '#4A321F', new THREE.Vector3(0, 0.47, 0));
    S.add(new THREE.BoxGeometry(0.42, 0.04, 0.3), '#3A2A1A', new THREE.Vector3(0, 0.96, 0));
    S.add(new THREE.BoxGeometry(0.2, 0.025, 0.28), '#E8DCC0', new THREE.Vector3(-0.1, 0.995, 0));   // left page block
    S.add(new THREE.BoxGeometry(0.2, 0.025, 0.28), '#E8DCC0', new THREE.Vector3(0.1, 0.995, 0));    // right page block
    S.mesh(g as unknown as THREE.Scene, 'library-turning-book-stand');
    const pivot = new THREE.Object3D(); pivot.position.set(0, 1.01, 0);
    const leaf = new THREE.Mesh(new THREE.PlaneGeometry(0.2, 0.27).rotateX(-Math.PI / 2).translate(0.1, 0, 0), new THREE.MeshLambertMaterial({ color: 0xf2e8d0, side: THREE.DoubleSide, emissive: 0x2a4a6a }));
    leaf.raycast = () => {}; pivot.add(leaf);
    const halo = new THREE.Mesh(new THREE.PlaneGeometry(0.9, 0.9).rotateX(-Math.PI / 2), glowMat(soft(), 0.5)); halo.position.y = 1.02; halo.raycast = () => {};
    g.add(pivot, halo);
    g.position.set(bAt[0], 0, bAt[1]); g.rotation.y = R() * Math.PI * 2;
    group.add(g); book = { group: g, page: pivot };
  }
  P.mesh(group as THREE.Scene, 'library-rune-stones');

  // 4 · Motes of pale light drifting down through two of the roof holes.
  const MOTES = 40, pos = new Float32Array(MOTES * 3), seeds: { x: number; z: number; ph: number; sp: number }[] = [];
  const shafts = holes.slice(0, 2);
  for (let i = 0; i < MOTES; i++) {
    const h = shafts[i % Math.max(1, shafts.length)] ?? { x: 4, z: -30 };
    seeds.push({ x: h.x + (R() - 0.5) * 1.6, z: h.z + (R() - 0.5) * 1.6, ph: R() * 8, sp: 0.18 + R() * 0.2 });
  }
  const mg = new THREE.BufferGeometry(); mg.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const motes = new THREE.Points(mg, new THREE.PointsMaterial({ color: 0xcfe4ff, map: soft(), size: 0.16, transparent: true, opacity: 0.8, depthWrite: false, blending: THREE.AdditiveBlending }));
  motes.name = 'library-motes'; motes.frustumCulled = false; motes.raycast = () => {};
  group.add(motes);

  // 5 · A blue hum under one floating stone outside (the broken wall nearest the path).
  let hum: THREE.Sprite | null = null;
  const host = floating[0];
  if (host) {
    hum = new THREE.Sprite(new THREE.SpriteMaterial({ map: soft(), color: RUNE, transparent: true, opacity: 0.4, depthWrite: false, blending: THREE.AdditiveBlending }));
    hum.position.set(0, -3.4, 0); hum.scale.set(7, 5, 1); hum.name = 'floating-stone-hum'; hum.raycast = () => {};
    host.mesh.add(hum);
  }

  const update = (t: number) => {
    const breathe = 0.5 + 0.5 * Math.sin(t * 1.3);
    runes.forEach((r, i) => { (r.material as THREE.MeshBasicMaterial).opacity = 0.45 + 0.45 * (0.5 + 0.5 * Math.sin(t * 0.9 + i * 2.1)); });
    if (circle) (circle.material as THREE.MeshBasicMaterial).opacity = 0.3 + 0.3 * breathe;
    if (hum) hum.material.opacity = 0.35 + 0.3 * breathe;
    if (book) {   // a page every 7 s: lift, turn, settle
      const k = (t % 7) / 1.6;
      book.page.rotation.z = k < 1 ? Math.PI * (0.5 - 0.5 * Math.cos(Math.PI * k)) : 0;
    }
    if (!group.visible) return;
    for (let i = 0; i < MOTES; i++) {
      const s = seeds[i], f = ((t * s.sp + s.ph) % 8) / 8;   // 0 at the roof, 1 at the floor
      pos[i * 3] = s.x + Math.sin(t * 0.6 + s.ph) * 0.25; pos[i * 3 + 1] = HALL.h - f * (HALL.h - 0.2); pos[i * 3 + 2] = s.z + Math.cos(t * 0.5 + s.ph) * 0.25;
    }
    mg.attributes.position.needsUpdate = true;
  };
  update(0);
  return { runes, circle, book, motes, hum, update };
}
