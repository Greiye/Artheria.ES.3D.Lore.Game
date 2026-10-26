// F5.1 / §6.1 — the inside of the Ruined Library (roadmap 0.06). Built from content/lore/index.json:
// 12 shelves (6 per side wall) with red books from shelves.json and grey filler, tables with clutter,
// one in-world object per §6.1 artifact, and the small exit door at the far end (F9, 0.12).
// Rebuild R4: restyled to the new look: pixel-textured wood and stone (world-metre UVs, batched), a
// flagstone floor, Legends-style figures for character artifacts. PLACEHOLDER: a .glb pass comes later.
import * as THREE from 'three';
import { pixelTexture, type TexName } from './tex/pixel';
import { Batch } from './world/batch';
import { buildFigure } from './world/figure';
import { lore, entryById, resolveImage, type LoreEntry } from './lore';
import type { Collider } from './world';

export type LibraryHit = { kind: 'red'; slug: string } | { kind: 'grey'; shelf: string } | { kind: 'artifact'; slug: string } | { kind: 'relic' };

export interface Library {
  group: THREE.Group;                 // everything inside the hall (phase A: NPC figures are found here)
  targets: THREE.Object3D[];            // raycast targets; userData.hit is a LibraryHit
  redBooks: Map<string, THREE.Mesh>;    // slug -> the book's mesh (F5.2: every slug is on a shelf)
  artifacts: Map<string, THREE.Object3D>;
  shelfOf: Map<string, string>;         // slug -> shelf id
  exitDoor: THREE.Mesh;
  relic: THREE.Mesh;                    // the Noctavel shard; it turns slowly (main.ts)
}

const HALL = { minX: -12.6, maxX: 12.6, front: -18.4, back: -41.6 };   // inner faces of the walls (world.ts LIB)
const SHELF = { len: 3.0, h: 2.6, d: 0.45, rows: [0.3, 0.9, 1.5, 2.1] };
const TIER_LOOK = { fragment: { color: 0xC98A5A, w: 0.05, h: 0.24 }, note: { color: 0xA8322B, w: 0.08, h: 0.29 }, work: { color: 0x7A1F1C, w: 0.12, h: 0.33 } };

function rng(seed: number) {
  let a = seed >>> 0;
  return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

export function buildLibrary(scene: THREE.Scene, colliders: Collider[], solids: THREE.Object3D[]): Library {
  const R = rng(1214);   // L1214: the Library of the Wise
  // Known palette colours map to pixel textures; anything else is a flat lit colour.
  const TEX: Record<number, TexName> = { 0x553823: 'planks', 0x7A5236: 'wood', 0x6B5F58: 'bricks', 0x4A4240: 'stone', 0xEFE3C4: 'parchment' };
  const mats = new Map<number, THREE.MeshLambertMaterial>();
  const mat = (c: number) => mats.get(c) ?? (mats.set(c, TEX[c] ? new THREE.MeshLambertMaterial({ map: pixelTexture(TEX[c]) }) : new THREE.MeshLambertMaterial({ color: c })), mats.get(c)!);
  const unit = new THREE.BoxGeometry(1, 1, 1);
  const group = new THREE.Group(); group.name = 'library-interior';
  scene.add(group);
  const box = (w: number, h: number, d: number, c: number, x: number, y: number, z: number, ry = 0, solid = true) => {
    const m = new THREE.Mesh(unit, mat(c)); m.scale.set(w, h, d); m.position.set(x, y, z); m.rotation.y = ry;
    group.add(m); if (solid) solids.push(m); return m;
  };
  // F5.1 budget: static furniture (frames, tables, crates) is batched into one mesh per material at the end,
  // so ~120 boxes cost a handful of draw calls. Books and the exit door stay separate meshes (raycast targets).
  const baked = new Batch();
  const staticBox = (w: number, h: number, d: number, c: number, x: number, y: number, z: number, ry = 0) =>
    baked.add(mat(c), unit, new THREE.Vector3(x, y, z), new THREE.Vector3(w, h, d), ry);
  const hitbox = (w: number, h: number, d: number, x: number, y: number, z: number, hit: LibraryHit) => {
    const m = new THREE.Mesh(unit, new THREE.MeshBasicMaterial({ visible: false }));
    m.scale.set(w, h, d); m.position.set(x, y, z); m.userData.hit = hit; group.add(m); return m;
  };
  const targets: THREE.Object3D[] = [];
  const redBooks = new Map<string, THREE.Mesh>();
  const shelfOf = new Map<string, string>();

  // ---------- F5.1 shelves: 1-6 left wall (door → back), 7-12 right wall ----------
  const greyGeo: THREE.Matrix4[] = [];
  const greyCol: THREE.Color[] = [];
  const GREYS = [0x6E6A66, 0x7E7A74, 0x5C5956, 0x8A857C];
  lore.shelves.forEach((shelf, i) => {
    const left = i < 6;
    const k = i % 6;
    const zc = HALL.front - 2.4 - k * 3.6;
    const xWall = left ? HALL.minX : HALL.maxX;
    const xc = xWall + (left ? 1 : -1) * SHELF.d / 2;
    const faceX = xWall + (left ? 1 : -1) * SHELF.d;        // the side the books face
    // frame: back, sides, shelves
    staticBox(0.06, SHELF.h, SHELF.len, 0x553823, xWall + (left ? 0.03 : -0.03), SHELF.h / 2, zc);
    for (const s of [-1, 1]) staticBox(SHELF.d, SHELF.h, 0.06, 0x553823, xc, SHELF.h / 2, zc + s * SHELF.len / 2);
    for (const y of [0.02, ...SHELF.rows.slice(1).map((r) => r - 0.03), SHELF.h]) staticBox(SHELF.d, 0.05, SHELF.len, 0x7A5236, xc, y, zc);
    colliders.push({ kind: 'box', minX: Math.min(xWall, faceX), maxX: Math.max(xWall, faceX), minZ: zc - SHELF.len / 2, maxZ: zc + SHELF.len / 2 });
    // Label plate (F5.2 shelf names are optional).
    if (shelf.label) {
      const c = document.createElement('canvas'); c.width = 256; c.height = 40;
      const g = c.getContext('2d')!; g.fillStyle = '#EFE3C4'; g.fillRect(0, 0, 256, 40); g.fillStyle = '#2B2A24';
      g.font = 'bold 20px Georgia, serif'; g.textAlign = 'center'; g.fillText(shelf.label, 128, 27);
      const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace;
      const plate = new THREE.Mesh(new THREE.PlaneGeometry(0.9, 0.14), new THREE.MeshBasicMaterial({ map: tex }));
      plate.position.set(faceX + (left ? 0.01 : -0.01), SHELF.h + 0.12, zc);
      plate.rotation.y = left ? Math.PI / 2 : -Math.PI / 2;
      group.add(plate);
    }
    // Books: red ones on the two eye-level rows first, grey everywhere else.
    const reds = shelf.red.map((s) => entryById.get(s)).filter((e): e is LoreEntry => !!e);
    let redLeft = [...reds];
    let greyLeft = shelf.grey;
    for (const row of [2, 1, 3, 0]) {
      let z = zc - SHELF.len / 2 + 0.1;
      const end = zc + SHELF.len / 2 - 0.1;
      while (z < end) {
        const red = (row === 2 || row === 1) && redLeft.length && (R() < 0.45 || greyLeft <= 0) ? redLeft.shift()! : null;
        if (!red && greyLeft <= 0) break;
        const y = SHELF.rows[row];
        if (red) {
          const look = TIER_LOOK[red.tier] ?? TIER_LOOK.note;
          if (z + look.w > end) break;
          const b = box(SHELF.d * 0.8, look.h, look.w, look.color, faceX - (left ? 1 : -1) * (SHELF.d * 0.4 - 0.02), y + look.h / 2, z + look.w / 2, 0, false);
          if (red.tier === 'fragment') b.rotation.x = 0.12;   // F5.5: a loose, unfinished binding
          b.name = 'book:' + red.id;
          b.userData.hit = { kind: 'red', slug: red.id } satisfies LibraryHit;
          redBooks.set(red.id, b); shelfOf.set(red.id, shelf.id); targets.push(b);
          z += look.w + 0.01;
        } else {
          const w = 0.05 + R() * 0.06, h = 0.22 + R() * 0.1;
          if (z + w > end) break;
          const m = new THREE.Matrix4().compose(new THREE.Vector3(faceX - (left ? 1 : -1) * (SHELF.d * 0.4 + 0.01), y + h / 2, z + w / 2),
            new THREE.Quaternion().setFromEuler(new THREE.Euler(R() < 0.1 ? 0.2 : 0, 0, 0)), new THREE.Vector3(SHELF.d * 0.78, h, w));
          greyGeo.push(m); greyCol.push(new THREE.Color(GREYS[Math.floor(R() * GREYS.length)]));
          greyLeft--;
          z += w + 0.008;
        }
      }
      if (!redLeft.length && greyLeft <= 0) break;
    }
    // Anything that didn't fit on the eye-level rows still gets a place (F5.2: every slug resolves to a book).
    redLeft.forEach((red, j) => {
      const look = TIER_LOOK[red.tier] ?? TIER_LOOK.note;
      const b = box(SHELF.d * 0.8, look.h, look.w, look.color, faceX - (left ? 1 : -1) * (SHELF.d * 0.4 - 0.02), SHELF.rows[3] + look.h / 2, zc - SHELF.len / 2 + 0.15 + j * 0.14, 0, false);
      b.userData.hit = { kind: 'red', slug: red.id } satisfies LibraryHit;
      redBooks.set(red.id, b); shelfOf.set(red.id, shelf.id); targets.push(b);
    });
    redLeft = [];
    // F5.3: one hitbox over the whole shelf face for the grey books, just behind the red spines.
    targets.push(hitbox(0.1, SHELF.h - 0.1, SHELF.len - 0.1, faceX - (left ? 1 : -1) * 0.1, SHELF.h / 2, zc, { kind: 'grey', shelf: shelf.id }));
  });
  if (greyGeo.length) {
    const inst = new THREE.InstancedMesh(unit, new THREE.MeshLambertMaterial({ color: 0xffffff }), greyGeo.length);
    greyGeo.forEach((m, i) => { inst.setMatrixAt(i, m); inst.setColorAt(i, greyCol[i]); });
    inst.computeBoundingSphere();
    group.add(inst);
  }

  // ---------- clutter: three tables down the aisle, candles, scrolls, crates ----------
  const tables = [-24, -30, -36].map((z) => {
    staticBox(1.8, 0.08, 1.0, 0x7A5236, 0, 0.78, z);
    for (const [dx, dz] of [[-0.8, -0.4], [0.8, -0.4], [-0.8, 0.4], [0.8, 0.4]]) staticBox(0.08, 0.76, 0.08, 0x553823, dx, 0.38, z + dz);
    colliders.push({ kind: 'box', minX: -0.95, maxX: 0.95, minZ: z - 0.55, maxZ: z + 0.55 });
    return z;
  });
  const glow = new THREE.MeshBasicMaterial({ color: 0xF2B36B });
  tables.forEach((z, i) => {
    const candle = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.16, 6), mat(0xEFE3C4)); candle.position.set(0.7, 0.9, z + 0.3); group.add(candle);
    const flame = new THREE.Mesh(new THREE.SphereGeometry(0.025, 6, 4), glow); flame.position.set(0.7, 1.0, z + 0.3); group.add(flame);
    if (i !== 1) { const sc = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.35, 8), mat(0xEFE3C4)); sc.rotation.z = Math.PI / 2; sc.position.set(-0.6, 0.86, z - 0.25); group.add(sc); }
  });
  for (const [x, z, s] of [[-10.6, -40.4, 0.7], [-9.8, -40.6, 0.5], [10.4, -40.3, 0.8], [10.5, -19.6, 0.6]]) {
    staticBox(s, s, s, 0x7A5236, x, s / 2, z, R());
    colliders.push({ kind: 'circle', x, z, r: s * 0.7 });
  }

  // ---------- §6.1 artifacts: one object type per creative type ----------
  const artifacts = new Map<string, THREE.Object3D>();
  const all = lore.entries.filter((e) => e.type !== 'lore');
  const slotsOnTables = tables.flatMap((z) => [[-0.35, z + 0.15], [0.25, z - 0.2]]);   // music boxes, scrolls + dishes
  let tableSlot = 0, standSlot = 0, wallSlot = 0;
  for (const e of all) {
    const hit: LibraryHit = { kind: 'artifact', slug: e.id };
    let obj: THREE.Object3D;
    if (e.type === 'character') {
      // capsule + facing nub + nameplate, standing in the aisle by the shelves (A6)
      const x = (standSlot % 2 ? 1 : -1) * 10.6, z = HALL.front - 4 - Math.floor(standSlot / 2) * 5;
      standSlot++;
      obj = new THREE.Group();
      // Legends-style figure in the contributor's colour (A6); faces +Z, turned to the aisle below.
      const col = e.color ?? '#9A9A9A';
      (obj as THREE.Group).add(buildFigure({ skin: '#E8C0A0', hair: '#3A2A1C', primary: col, secondary: '#C9B48A', boots: '#4A3020', accent: '#2B2A24', hairStyle: 'hood' }, 1.7));
      const c = document.createElement('canvas'); c.width = 256; c.height = 48;
      const g = c.getContext('2d')!; g.fillStyle = 'rgba(30,36,32,.85)'; g.fillRect(0, 0, 256, 48); g.fillStyle = '#EFE3C4'; g.font = 'bold 22px sans-serif'; g.textAlign = 'center'; g.fillText(e.title, 128, 31);
      const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace;
      const plate = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex })); plate.scale.set(1.2, 0.22, 1); plate.position.y = 1.95;
      (obj as THREE.Group).add(plate);
      obj.position.set(x, 0, z);
      obj.rotation.y = x < 0 ? Math.PI / 2 : -Math.PI / 2;   // facing the aisle
      colliders.push({ kind: 'circle', x, z, r: 0.35 });
      targets.push(hitbox(0.8, 1.7, 0.8, x, 0.85, z, hit));
    } else if (e.type === 'song' || e.type === 'food') {
      const [x, z] = slotsOnTables[tableSlot++ % slotsOnTables.length];
      obj = new THREE.Group();
      if (e.type === 'song') {
        const base = new THREE.Mesh(unit, mat(0x553823)); base.scale.set(0.3, 0.14, 0.22); base.position.y = 0.07;
        const lid = new THREE.Mesh(unit, mat(0x7A5236)); lid.scale.set(0.3, 0.03, 0.22); lid.position.set(0, 0.2, -0.08); lid.rotation.x = -0.9;
        const comb = new THREE.Mesh(unit, mat(0xC9A36B)); comb.scale.set(0.2, 0.02, 0.05); comb.position.set(0, 0.15, 0.03);
        (obj as THREE.Group).add(base, lid, comb);
      } else {
        const dish = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.12, 0.04, 12), mat(0xA4A7A6)); dish.position.y = 0.02;
        const food = new THREE.Mesh(new THREE.SphereGeometry(0.07, 8, 6), mat(0x3F6FB0)); food.position.set(-0.03, 0.08, 0);   // blue fruit
        const scroll = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.3, 8), mat(0xEFE3C4)); scroll.rotation.z = Math.PI / 2; scroll.position.set(0, 0.03, 0.2);
        (obj as THREE.Group).add(dish, food, scroll);
      }
      obj.position.set(x, 0.82, z);
      targets.push(hitbox(0.5, 0.4, 0.5, x, 1.0, z, hit));
    } else {
      // art: a framed plane on the back wall (contributor image, or a palette-striped placeholder, A8/H8)
      const x = -6 + (wallSlot++ % 4) * 4, y = 2.4, z = HALL.back + 0.06;
      obj = new THREE.Group();
      const frame = new THREE.Mesh(unit, mat(0x553823)); frame.scale.set(2.2, 1.6, 0.08);
      const img = /!\[[^\]]*\]\(([^)\s]+)\)/.exec(e.body)?.[1];
      const url = img ? resolveImage(img) : null;
      const pic = new THREE.MeshBasicMaterial({ color: 0xffffff });
      if (url) new THREE.TextureLoader().load(url, (t) => { t.colorSpace = THREE.SRGBColorSpace; pic.map = t; pic.needsUpdate = true; });
      else {
        const c = document.createElement('canvas'); c.width = 64; c.height = 48;
        const g = c.getContext('2d')!; ['#5B3A6B', '#E8833A', '#F2B36B', '#4F6B3A', '#3A5230'].forEach((col, i) => { g.fillStyle = col; g.fillRect(0, i * 10, 64, 10); });
        const t = new THREE.CanvasTexture(c); t.magFilter = THREE.NearestFilter; pic.map = t;
      }
      const canvasPlane = new THREE.Mesh(new THREE.PlaneGeometry(2.0, 1.4), pic); canvasPlane.position.z = 0.05;
      (obj as THREE.Group).add(frame, canvasPlane);
      obj.position.set(x, y, z);
      targets.push(hitbox(2.2, 1.6, 0.3, x, y, z + 0.15, hit));
    }
    obj.name = 'artifact:' + e.id;
    obj.userData.hit = hit;
    group.add(obj);
    artifacts.set(e.id, obj);
  }

  // ---------- The Ruined Library's relic: a shard of the Noctavel Portal, still here after the fire ----------
  // Public lore: "The Library of the Wise … holds an artifact that comes from the Noctavel Portal. The artifact is still there."
  const altarZ = HALL.back + 3.2;
  box(1.6, 0.9, 1.0, 0x6B5F58, 0, 0.45, altarZ);                      // stone altar, scorched
  box(1.8, 0.1, 1.2, 0x4A4240, 0, 0.95, altarZ);                      // slab top
  colliders.push({ kind: 'box', minX: -0.9, maxX: 0.9, minZ: altarZ - 0.6, maxZ: altarZ + 0.6 });
  const shard = new THREE.Mesh(new THREE.OctahedronGeometry(0.22, 0), new THREE.MeshBasicMaterial({ color: 0x3FE0E8 }));   // rune cyan (A5)
  shard.position.set(0, 1.4, altarZ); shard.name = 'noctavel_shard';
  group.add(shard);
  targets.push(hitbox(0.9, 1.1, 0.9, 0, 1.3, altarZ, { kind: 'relic' }));

  // ---------- F9 (0.12): the small exit door at the far end ----------
  const exitDoor = box(1.1, 2.0, 0.12, 0x553823, 0, 1.0, HALL.back + 0.06);
  exitDoor.name = 'exit_door';
  staticBox(1.4, 0.15, 0.2, 0x6B5F58, 0, 2.08, HALL.back + 0.1);

  // Flagstone floor over the grass inside the hall (the roof burned away; the floor survived).
  baked.add(new THREE.MeshLambertMaterial({ map: pixelTexture('paving') }), new THREE.BoxGeometry(1, 1, 1),
    new THREE.Vector3(0, 0.005, (HALL.front + HALL.back) / 2), new THREE.Vector3(HALL.maxX - HALL.minX, 0.01, HALL.front - HALL.back));
  for (const m of baked.flush(scene, 'library-furniture')) { scene.remove(m); group.add(m); solids.push(m); m.receiveShadow = true; }

  return { group, targets, redBooks, artifacts, shelfOf, exitDoor, relic: shard };
}
