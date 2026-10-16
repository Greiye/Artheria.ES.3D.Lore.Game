import * as THREE from 'three';
import { mergeVertices } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { palette, swatchUV, makeSwatchCanvas, type Swatch } from './palette';

// M0 — start area. Covers D7, F1.2, F1.4, A1–A5.
// Everything here is a PLACEHOLDER asset: 3D = low-poly primitives, 2D = billboard standees.

export interface CircleCollider { kind: 'circle'; x: number; z: number; r: number }
export interface BoxCollider { kind: 'box'; minX: number; maxX: number; minZ: number; maxZ: number }
export type Collider = CircleCollider | BoxCollider;

export interface World {
  scene: THREE.Scene;
  colliders: Collider[];
  bookTarget: THREE.Object3D;   // F3.1 raycast target (forgiving hitbox around the book)
  bookCenter: THREE.Vector3;
  spawn: { pos: THREE.Vector3; yaw: number };
  bounds: number;               // half-size of the walkable square (F1.3)
  update(t: number): void;
}

const HALF = 50; // F1.2: ~100 x 100 m start area

function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// A5: point every UV of a geometry at one swatch cell.
function paint(geo: THREE.BufferGeometry, s: Swatch): THREE.BufferGeometry {
  const g = geo.index ? geo.toNonIndexed() : geo;
  const [u, v] = swatchUV(s);
  const n = g.attributes.position.count;
  const uv = new Float32Array(n * 2);
  for (let i = 0; i < n; i++) { uv[i * 2] = u; uv[i * 2 + 1] = v; }
  g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  g.computeVertexNormals();
  return g;
}

// A3: inverted hull outline — smooth-normal copy, pushed out along normals, BackSide, unlit black.
const outlineCache = new WeakMap<THREE.BufferGeometry, THREE.BufferGeometry>();
function outlineGeometry(geo: THREE.BufferGeometry): THREE.BufferGeometry {
  let og = outlineCache.get(geo);
  if (!og) {
    const tmp = new THREE.BufferGeometry();
    tmp.setAttribute('position', geo.attributes.position.clone());
    og = mergeVertices(tmp, 1e-3);
    og.computeVertexNormals();
    outlineCache.set(geo, og);
  }
  return og;
}
function outlineMaterial(width: number): THREE.MeshBasicMaterial {
  const m = new THREE.MeshBasicMaterial({ color: 0x000000, side: THREE.BackSide, fog: true });
  // Pushed along the view-space normal and scaled by depth, so the line stays ~2 px wide
  // even on non-uniformly scaled instances (a thin trunk would otherwise lose its outline).
  m.onBeforeCompile = (sh) => {
    sh.uniforms.uOutline = { value: width };
    sh.vertexShader = 'uniform float uOutline;\n' + sh.vertexShader.replace(
      '#include <project_vertex>',
      `#include <project_vertex>
      vec3 oN = normal;
      #ifdef USE_INSTANCING
        oN = mat3(instanceMatrix) * oN;
      #endif
      oN = normalize(normalMatrix * oN);
      mvPosition.xyz += oN * (uOutline * 0.08) * (-mvPosition.z);
      gl_Position = projectionMatrix * mvPosition;`
    );
  };
  m.customProgramCacheKey = () => 'outline' + width;
  return m;
}

export function buildWorld(): World {
  const scene = new THREE.Scene();
  const colliders: Collider[] = [];
  const R = rng(20261016);

  // F1.4: palette-tinted sky + distance fog, hemisphere + directional sun.
  scene.background = new THREE.Color(palette.sky);
  scene.fog = new THREE.Fog(palette.sky, 28, 85);
  scene.add(new THREE.HemisphereLight(palette.sky, palette.hemiGround, 1.6));
  const sun = new THREE.DirectionalLight(palette.sun, 1.9);
  sun.position.set(30, 50, 18);
  scene.add(sun);

  // A5: the one 256 px swatch texture, shared by every toon mesh.
  const swatchTex = new THREE.CanvasTexture(makeSwatchCanvas());
  swatchTex.colorSpace = THREE.SRGBColorSpace;
  swatchTex.magFilter = THREE.NearestFilter;
  swatchTex.minFilter = THREE.NearestFilter;
  swatchTex.generateMipmaps = false;

  // D7 / A2: flat toon shading with a 3-step ramp (no step reaches black — F1.4).
  const ramp = new THREE.DataTexture(new Uint8Array([150, 205, 255]), 3, 1, THREE.RedFormat);
  ramp.magFilter = ramp.minFilter = THREE.NearestFilter;
  ramp.needsUpdate = true;
  const toon = new THREE.MeshToonMaterial({ map: swatchTex, gradientMap: ramp }) // flat look: paint() gives faceted (per-face) normals;
  const glow = new THREE.MeshBasicMaterial({ map: swatchTex });          // rune glow, unlit
  const outlines = new Map<number, THREE.MeshBasicMaterial>();
  const oMat = (w: number) => outlines.get(w) ?? (outlines.set(w, outlineMaterial(w)), outlines.get(w)!);

  // A1: one geometry per silhouette family; variety = swatch + scale.
  const BASE = {
    blob: new THREE.IcosahedronGeometry(1, 1),          // canopy, bush, cloud-like shapes
    rock: new THREE.DodecahedronGeometry(1, 0),         // rocks, pebbles
    post: new THREE.CylinderGeometry(1, 1, 1, 6),       // trunks, pillars, lectern post
    box: new THREE.BoxGeometry(1, 1, 1),                // walls, slabs, book parts
  };
  const painted = new Map<string, THREE.BufferGeometry>();
  const geo = (shape: keyof typeof BASE, s: Swatch) => {
    const k = shape + ':' + s;
    if (!painted.has(k)) painted.set(k, paint(BASE[shape].clone(), s));
    return painted.get(k)!;
  };

  // Instanced placement helper: one draw call per (silhouette, swatch) + one for its outline.
  type Inst = { p: THREE.Vector3; s: THREE.Vector3; ry: number };
  const groups = new Map<string, { shape: keyof typeof BASE; sw: Swatch; ow: number; items: Inst[] }>();
  const place = (shape: keyof typeof BASE, sw: Swatch, p: THREE.Vector3, s: THREE.Vector3, ry = 0, ow = 0.04) => {
    const k = shape + ':' + sw + ':' + ow;
    if (!groups.has(k)) groups.set(k, { shape, sw, ow, items: [] });
    groups.get(k)!.items.push({ p, s, ry });
  };
  const flush = () => {
    const d = new THREE.Object3D();
    groups.forEach(({ shape, sw, ow, items }) => {
      const g = geo(shape, sw);
      const body = new THREE.InstancedMesh(g, sw === 'rune' ? glow : toon, items.length);
      const line = ow > 0 ? new THREE.InstancedMesh(outlineGeometry(g), oMat(ow), items.length) : null;
      items.forEach((it, i) => {
        d.position.copy(it.p); d.scale.copy(it.s); d.rotation.set(0, it.ry, 0); d.updateMatrix();
        body.setMatrixAt(i, d.matrix);
        line?.setMatrixAt(i, d.matrix);
      });
      body.computeBoundingSphere();
      scene.add(body);
      if (line) { line.computeBoundingSphere(); scene.add(line); }
    });
  };
  const V = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);

  // Ground (no outline: it would only draw a seam at the horizon).
  const ground = new THREE.Mesh(paint(new THREE.PlaneGeometry(HALF * 2 + 60, HALF * 2 + 60, 1, 1).rotateX(-Math.PI / 2), 'moss'), toon);
  scene.add(ground);

  // Paved path spawn -> lectern, echoing the reference's broken paving.
  for (let z = 1.6; z <= 9; z += 0.7) {
    for (const x of [-0.36, 0.36]) {
      if (R() < 0.14) continue;
      place('box', R() < 0.5 ? 'stoneLight' : 'stone', V(x + (R() - 0.5) * 0.06, 0.02, z), V(0.62, 0.05, 0.62), (R() - 0.5) * 0.12, 0);
    }
  }

  // Rune dais under the lectern (low, walkable) + four rune pillars (F1.2 landmark).
  const dais = new THREE.Mesh(paint(new THREE.CylinderGeometry(2.2, 2.35, 0.08, 10), 'stoneLight'), toon);
  dais.position.y = 0.04;
  scene.add(dais);
  [[0, -2.6], [2.6, 0], [-2.6, 0], [0, 2.6]].forEach(([x, z], i) => {
    if (i === 3) return; // leave the path side open
    place('post', 'stone', V(x, 0.55, z), V(0.32, 1.1, 0.32), 0, 0.03);
    place('box', 'rune', V(x, 1.2, z), V(0.3, 0.2, 0.3), Math.PI / 4, 0.02);
    colliders.push({ kind: 'circle', x, z, r: 0.38 });
  });

  // Lectern (3D placeholder): post + slanted top. Book sits on it.
  const lectern = new THREE.Group();
  const post = new THREE.Mesh(geo('post', 'wood'), toon); post.scale.set(0.12, 1.0, 0.12); post.position.y = 0.5;
  const foot = new THREE.Mesh(geo('box', 'woodDark'), toon); foot.scale.set(0.6, 0.08, 0.5); foot.position.y = 0.04;
  const top = new THREE.Mesh(geo('box', 'woodDark'), toon); top.scale.set(0.7, 0.06, 0.5); top.position.set(0, 1.05, 0); top.rotation.x = -0.35;
  lectern.add(post, foot, top);
  [post, foot, top].forEach((m) => {
    const o = new THREE.Mesh(outlineGeometry(m.geometry), oMat(0.03));
    o.position.copy(m.position); o.scale.copy(m.scale); o.rotation.copy(m.rotation);
    lectern.add(o);
  });
  scene.add(lectern);
  colliders.push({ kind: 'circle', x: 0, z: 0, r: 0.45 });

  // The lore book (3D placeholder): open pages + cover, tilted with the lectern top.
  const book = new THREE.Group();
  const cover = new THREE.Mesh(geo('box', 'clay'), toon); cover.scale.set(0.62, 0.03, 0.42);
  const pageL = new THREE.Mesh(geo('box', 'parchment'), toon); pageL.scale.set(0.29, 0.04, 0.38); pageL.position.set(-0.155, 0.03, 0); pageL.rotation.z = 0.06;
  const pageR = new THREE.Mesh(geo('box', 'parchment'), toon); pageR.scale.set(0.29, 0.04, 0.38); pageR.position.set(0.155, 0.03, 0); pageR.rotation.z = -0.06;
  const ribbon = new THREE.Mesh(geo('box', 'rune'), glow); ribbon.scale.set(0.02, 0.01, 0.46); ribbon.position.set(0, 0.055, 0.02);
  book.add(cover, pageL, pageR, ribbon);
  book.position.set(0, 1.11, 0.02);
  book.rotation.x = -0.35;
  scene.add(book);
  // Floating rune ring above the book so it reads from spawn (F1.2).
  const ring = new THREE.Mesh(paint(new THREE.TorusGeometry(0.28, 0.025, 4, 12).rotateX(Math.PI / 2), 'rune'), glow);
  ring.position.set(0, 1.62, 0);
  scene.add(ring);
  // F3.1: invisible, slightly larger hitbox so aiming at the book is forgiving.
  const bookTarget = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.45, 0.6), new THREE.MeshBasicMaterial({ visible: false }));
  bookTarget.position.set(0, 1.12, 0);
  scene.add(bookTarget);

  // Keep-out zone for scattered props: dais + path + spawn.
  const clear = (x: number, z: number, pad: number) => Math.hypot(x, z) < 4.5 + pad || (Math.abs(x) < 2 + pad && z > 0 && z < 12 + pad);

  // Trees: trunk (post) + canopy (blob) — canopy is the same mesh as the bushes (A1).
  const trees: [number, number][] = [];
  for (let i = 0; i < 220 && trees.length < 70; i++) {
    const x = (R() * 2 - 1) * (HALF - 2), z = (R() * 2 - 1) * (HALF - 2);
    if (clear(x, z, 3) || trees.some(([a, b]) => Math.hypot(a - x, b - z) < 4.5)) continue;
    trees.push([x, z]);
    const h = 2.4 + R() * 1.8, c = 1.4 + R() * 0.9;
    place('post', 'bark', V(x, h / 2, z), V(0.16, h, 0.16), R() * 6, 0.025);
    place('blob', R() < 0.5 ? 'leaf' : 'leafDark', V(x, h + c * 0.55, z), V(c, c * 0.85, c), R() * 6, 0.05);
    colliders.push({ kind: 'circle', x, z, r: 0.3 });
  }
  // Bushes: same blob, smaller, darker (A1). Walk-through (soft foliage) — see assumptions.
  for (let i = 0; i < 90; i++) {
    const x = (R() * 2 - 1) * (HALF - 1), z = (R() * 2 - 1) * (HALF - 1);
    if (clear(x, z, 1)) continue;
    const s = 0.45 + R() * 0.5;
    place('blob', R() < 0.5 ? 'mossLight' : 'leafDark', V(x, s * 0.5, z), V(s * 1.3, s, s * 1.3), R() * 6, 0.04);
  }
  // Rocks: one dodecahedron, three greys, many scales (A1). All rocks collide (F1.3).
  for (let i = 0; i < 70; i++) {
    const x = (R() * 2 - 1) * (HALF - 1), z = (R() * 2 - 1) * (HALF - 1);
    if (clear(x, z, 1.5)) continue;
    const s = 0.35 + R() * R() * 1.6, sw: Swatch = (['stone', 'stoneLight', 'stoneDark'] as const)[Math.floor(R() * 3)];
    place('rock', sw, V(x, s * 0.45, z), V(s * (1 + R() * 0.4), s * 0.8, s), R() * 6, 0.04);
    colliders.push({ kind: 'circle', x, z, r: s * 1.05 });
  }
  // Two rocks flanking the path near spawn so collision is easy to test (F1.3 Done-when).
  [[-2.4, 6.5, 0.8], [2.6, 8.5, 0.95]].forEach(([x, z, s]) => {
    place('rock', 'stone', V(x, s * 0.45, z), V(s * 1.2, s * 0.8, s), 0.4, 0.04);
    colliders.push({ kind: 'circle', x, z, r: s * 1.1 });
  });
  // Ruined low walls (box, recolored) around the dais — reference-image ruins.
  const walls: [number, number, number, number][] = [[-6, -5, 4, 0.5], [5.5, -6, 3, 0.5], [-8, 2, 0.5, 3.5], [8, 1, 0.5, 4]];
  walls.forEach(([x, z, w, d]) => {
    place('box', 'stone', V(x, 0.45, z), V(w, 0.9, d), 0, 0.03);
    place('box', 'stoneLight', V(x, 0.95, z), V(w + 0.15, 0.12, d + 0.15), 0, 0.02);
    colliders.push({ kind: 'box', minX: x - w / 2 - 0.05, maxX: x + w / 2 + 0.05, minZ: z - d / 2 - 0.05, maxZ: z + d / 2 + 0.05 });
  });
  flush();

  // 2D placeholders: billboard standees for characters that have no model yet.
  const standee = (label: string, sub: string, w: number, h: number, body: string, x: number, z: number) => {
    const c = document.createElement('canvas'); c.width = 128; c.height = Math.round(128 * h / w);
    const g = c.getContext('2d')!, W = c.width, H = c.height;
    g.fillStyle = body;
    g.beginPath(); g.arc(W / 2, H * 0.17, W * 0.15, 0, Math.PI * 2); g.fill();                      // head
    g.beginPath(); g.ellipse(W / 2, H * 0.55, W * 0.38, H * 0.3, 0, 0, Math.PI * 2); g.fill();       // body
    g.fillRect(W * 0.3, H * 0.7, W * 0.14, H * 0.28); g.fillRect(W * 0.56, H * 0.7, W * 0.14, H * 0.28); // legs
    g.lineWidth = 4; g.strokeStyle = '#000'; g.strokeRect(2, 2, W - 4, H - 4);
    g.fillStyle = palette.shadow; g.fillRect(0, H * 0.42, W, 34);
    g.fillStyle = palette.rune; g.font = 'bold 13px monospace'; g.textAlign = 'center';
    g.fillText('PLACEHOLDER', W / 2, H * 0.42 + 14);
    g.fillStyle = palette.parchment; g.font = 'bold 12px monospace';
    g.fillText(label, W / 2, H * 0.42 + 28);
    g.fillStyle = palette.parchment; g.font = '10px monospace'; g.fillText(sub, W / 2, H - 8);
    const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace;
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, alphaTest: 0.5 }));
    s.center.set(0.5, 0); s.scale.set(w, h, 1); s.position.set(x, 0, z);
    scene.add(s);
    colliders.push({ kind: 'circle', x, z, r: Math.max(0.35, w * 0.3) });
  };
  standee('THE STAGECOACH', 'BBEG · 2D standee', 2.4, 3.4, '#C9A36B', -4.2, -2.2);
  standee('HERO', 'player · 2D standee', 1.0, 1.8, '#5C8AA0', 3.8, 3.2);

  return {
    scene,
    colliders,
    bookTarget,
    bookCenter: new THREE.Vector3(0, 1.12, 0),
    spawn: { pos: new THREE.Vector3(0, 0, 8.5), yaw: 0 },  // yaw 0 looks toward -Z: the lectern
    bounds: HALF,
    update(t: number) {
      ring.rotation.y = t * 0.8;
      ring.position.y = 1.62 + Math.sin(t * 1.6) * 0.05;
    },
  };
}
