import * as THREE from 'three';
import { spriteFigure } from '../render/sprites';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { blobShadowTexture } from '../tex/pixel';

// Storybook restyle S2 (docs/vision.md, Mike's "Echoes of Avalon" boards): low-poly chibi characters,
// about 2.8 heads tall. Chamfered boxes and six-sided limbs, a big rounded head with a painted anime face,
// chunky gloves and boots, a cap with goggles. Unlit: a warm key and a cool shadow are painted into the
// vertex colours per face, so they read the same in any scene light.
// PLACEHOLDER: replaced per slot by public/models/<id>.glb (src/models.ts).

export interface FigureLook {
  skin: string; hair: string; primary: string; secondary: string; boots: string;
  accent?: string;      // belt / trim
  eyes?: string;
  hairStyle?: 'spiky' | 'long' | 'hood' | 'short' | 'bald' | 'topknot' | 'cap';
  skirt?: boolean;      // coat tails / dress below the belt
  // Restyle S2 trims (all optional; derived from the colours above when missing):
  gloves?: string;      // leather gloves
  scarf?: string;       // neckerchief
  legs?: string;        // trousers (defaults to primary)
  pack?: boolean;       // satchel strap and pouches
  // Phase B (B4 character forge):
  species?: Species;
  build?: number;       // width multiplier, 0.85 (slim) – 1.25 (broad)
  eyeStyle?: 'round' | 'slit' | 'owl' | 'sleepy';
  marks?: string;       // freckles / war paint colour, '' for none
  feature?: string;     // horns / beak / wing / ear colour (defaults per species)
}

// Public lore species names only (lore/Artheria-IP-Renames.md).
export type Species = 'human' | 'elf' | 'infernling' | 'drakari' | 'owlkin' | 'emberkin' | 'stonekin' | 'cinderkin' | 'titankin' | 'corvani' | 'lumari';

const light = new THREE.Vector3(0.35, 0.85, 0.4).normalize();
const WARM = new THREE.Color('#FFE2B8'), COOL = new THREE.Color('#7E8CB8');

// Paint per-face light into vertex colours: a warm key from above-front, cool shade on the far side,
// plus a gentle top-down gradient (storybook painted shading, three soft steps).
function painted(geo: THREE.BufferGeometry, color: string, yMin: number, yMax: number): THREE.BufferGeometry {
  const g = geo.index ? geo.toNonIndexed() : geo;
  g.computeVertexNormals();
  const base = new THREE.Color(color), c = new THREE.Color(), n = new THREE.Vector3();
  const p = g.attributes.position, nn = g.attributes.normal, col = new Float32Array(p.count * 3);
  for (let i = 0; i < p.count; i++) {
    n.fromBufferAttribute(nn, i);
    const lambert = Math.max(0, n.dot(light));
    const h = THREE.MathUtils.clamp((p.getY(i) - yMin) / Math.max(1e-3, yMax - yMin), 0, 1);
    c.copy(base);
    if (lambert > 0.7) c.multiplyScalar(1.1).lerp(WARM, 0.1);
    else if (lambert > 0.25) c.multiplyScalar(0.97);
    else c.multiplyScalar(0.8).lerp(COOL, 0.16);
    c.multiplyScalar(0.9 + 0.14 * h);
    col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b;
  }
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  return g;
}

// The painted face (64 px, smooth): big anime eyes with a highlight, brows, a small mouth, blush.
function faceTexture(look: FigureLook): THREE.CanvasTexture {
  const S = 64, c = document.createElement('canvas'); c.width = c.height = S;
  const g = c.getContext('2d')!;
  g.fillStyle = look.skin; g.fillRect(0, 0, S, S);
  const style = look.eyeStyle ?? (look.species === 'owlkin' || look.species === 'corvani' ? 'owl' : look.species === 'drakari' ? 'slit' : 'round');
  const iris = look.eyes ?? '#4A6A8A', ink = '#2A2026';
  const ell = (x: number, y: number, rx: number, ry: number, col: string) => { g.fillStyle = col; g.beginPath(); g.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2); g.fill(); };
  // Fringe shadow across the top, so the hair mass reads over the forehead.
  g.fillStyle = look.hair; g.fillRect(0, 0, S, 9);
  for (let x = 0; x < S; x += 8) { g.beginPath(); g.moveTo(x, 9); g.lineTo(x + 4, 15); g.lineTo(x + 8, 9); g.fill(); }
  for (const side of [-1, 1]) {
    const ex = 32 + side * 12.5, ey = 34;
    if (style === 'owl') {
      ell(ex, ey, 9, 9, '#FFF8EC'); ell(ex, ey, 6, 6, look.eyes ?? '#E0A020'); ell(ex, ey, 3, 3, ink); ell(ex - 2, ey - 2, 1.6, 1.6, '#FFFFFF');
      continue;
    }
    const sleepy = style === 'sleepy';
    const eh = sleepy ? 6 : 11;
    ell(ex, ey, 8, eh, '#FFFFFF');                                  // white
    ell(ex + side * 0.5, ey + (sleepy ? 1 : 2), 6.5, sleepy ? 5 : 9, iris);
    if (!sleepy) ell(ex + side * 0.5, ey + 6, 5, 3.5, 'rgba(255,255,255,0.22)');   // lower iris glow   // iris
    if (style === 'slit') { g.fillStyle = ink; g.fillRect(ex - 0.8, ey - 5, 1.6, 12); }
    else ell(ex + side * 0.5, ey + 2.5, 3.2, sleepy ? 2.5 : 4.6, ink);    // pupil
    ell(ex - 2.4, ey - 3, 2.4, 2.6, '#FFFFFF'); ell(ex + 2.2, ey + 4, 1.1, 1.1, '#FFFFFF');                       // highlight
    g.fillStyle = ink; g.fillRect(ex - 8.5, ey - eh - 1, 17, 2.6);       // upper lash line
    g.fillRect(ex - side * 1 - 5, ey - eh - 5, 10, 1.6);               // brow
  }
  if (look.marks) { g.fillStyle = look.marks; for (const [x, y] of [[16, 44], [19, 46], [45, 44], [48, 46]]) g.fillRect(x, y, 2, 2); }
  g.fillStyle = 'rgba(232,120,110,0.28)'; ell(13, 49, 5, 2.5, 'rgba(232,120,110,0.3)'); ell(51, 49, 5, 2.5, 'rgba(232,120,110,0.3)');   // blush
  g.fillStyle = look.species === 'infernling' || look.species === 'drakari' ? '#3A1A1A' : '#8A3A34';
  g.beginPath(); g.moveTo(29, 54); g.quadraticCurveTo(32, 56.5, 35, 54); g.lineWidth = 1.6; g.strokeStyle = g.fillStyle as string; g.stroke();   // mouth
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

const bodyMat = new THREE.MeshBasicMaterial({ vertexColors: true });
const noRaycast = () => {};

export function blobShadow(radius: number): THREE.Mesh {
  const m = new THREE.Mesh(new THREE.CircleGeometry(radius, 16).rotateX(-Math.PI / 2),
    new THREE.MeshBasicMaterial({ map: blobShadowTexture(), transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 }));
  m.position.y = 0.015;
  m.raycast = noRaycast;
  m.name = 'blob-shadow';
  return m;
}

// Phase A (B1): the figure is one skinned mesh (still one draw call) on a 12-bone rig, so the procedural
// animator (src/anim/procedural.ts) can swing limbs. Each box is rigid to one bone.
// Default horn / beak / crest colours per species (the forge can override).
export const FEATURE: Record<Species, string> = {
  human: '#7A5236', elf: '#7A5236', infernling: '#2B2024', drakari: '#C9B48A', owlkin: '#E0A020', emberkin: '#FFB040',
  stonekin: '#8A8478', cinderkin: '#FF6A20', titankin: '#7A5236', corvani: '#3A3A3A', lumari: '#FFF0B0',
};

export const BONES = ['root', 'hips', 'spine', 'head', 'armN', 'foreN', 'armP', 'foreP', 'thighN', 'shinN', 'thighP', 'shinP'] as const;
export type BoneName = typeof BONES[number];
// [parent, pivot] per bone, in metres for a 1.75 m figure. N = the figure's -X side, P = its +X side.
// Chibi proportions (S2): short legs (hips at 0.72, knees at 0.4), a head about 0.6 m tall.
export const RIG: Record<BoneName, [BoneName | null, [number, number, number]]> = {
  root: [null, [0, 0, 0]], hips: ['root', [0, 0.72, 0]], spine: ['hips', [0, 0.76, 0]], head: ['spine', [0, 1.13, 0]],
  armN: ['spine', [-0.24, 1.07, 0]], foreN: ['armN', [-0.28, 0.87, 0]], armP: ['spine', [0.24, 1.07, 0]], foreP: ['armP', [0.28, 0.87, 0]],
  thighN: ['hips', [-0.11, 0.7, 0]], shinN: ['thighN', [-0.11, 0.4, 0]], thighP: ['hips', [0.11, 0.7, 0]], shinP: ['thighP', [0.11, 0.4, 0]],
};
export interface FigureRig { bones: Record<BoneName, THREE.Bone>; rest: Record<BoneName, THREE.Vector3>; mesh: THREE.SkinnedMesh }

function rigged(geo: THREE.BufferGeometry, bone: number): THREE.BufferGeometry {
  const n = geo.attributes.position.count, idx = new Uint16Array(n * 4), w = new Float32Array(n * 4);
  for (let i = 0; i < n; i++) { idx[i * 4] = bone; w[i * 4] = 1; }
  geo.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(idx, 4));
  geo.setAttribute('skinWeight', new THREE.Float32BufferAttribute(w, 4));
  return geo;
}

// Build a figure `height` m tall, feet at y = 0, facing +Z. root.userData.rig holds the bones.
export function buildFigure(look: FigureLook, height: number): THREE.Group {
  const U = height / 1.75;   // proportions authored for a 1.75 m figure
  const W = THREE.MathUtils.clamp(look.build ?? (look.species === 'titankin' ? 1.2 : 1), 0.8, 1.3);   // body width
  const root = new THREE.Group();
  const parts: [THREE.BufferGeometry, string, BoneName][] = [];
  const place = (g: THREE.BufferGeometry, bone: BoneName, x: number, y: number, z: number, color: string, rz = 0, rx = 0) => {
    if (rx) g.rotateX(rx);
    if (rz) g.rotateZ(rz);
    g.translate(x * U, y * U, z * U);
    parts.push([g, color, bone]);
  };
  // Pillowy rounded box and a round limb: the sprite pass (src/render/sprites.ts) pixelates them, so soft
  // shapes read as drawn pixel art rather than boxes.
  const box = (bone: BoneName, w: number, h: number, d: number, x: number, y: number, z: number, color: string, rz = 0, rx = 0, r = 0.06) => {
    const k = bone === 'head' ? 1 : W;
    w *= k; d *= k; x *= k;
    place(new RoundedBoxGeometry(w * U, h * U, d * U, 3, Math.min(Math.max(r, Math.min(w, h, d) * 0.35), w / 2.2, h / 2.2, d / 2.2) * U), bone, x, y, z, color, rz, rx);
  };
  const limb = (bone: BoneName, rTop: number, rBot: number, h: number, x: number, y: number, z: number, color: string, rz = 0) => {
    place(new THREE.CylinderGeometry(rTop * W * U, rBot * W * U, h * U, 12), bone, x * W, y, z, color, rz);
  };
  // Head-space parts (hair, hats, species features) were authored for a 0.36 m head centred at y 1.4;
  // map them onto the big chibi head.
  const HEAD_Y = 1.42, HEAD = 0.58, HK = HEAD / 0.36;
  const hbox = (w: number, h: number, d: number, x: number, y: number, z: number, color: string, rz = 0, rx = 0) =>
    box('head', w * HK, h * HK, d * HK, x * HK, HEAD_Y + (y - 1.4) * HK, z * HK, color, rz, rx, 0.04);
  const legs = look.legs ?? look.primary, gloves = look.gloves ?? look.boots, trim = look.accent ?? look.boots;
  for (const s of [-1, 1]) {
    const side = s < 0 ? 'N' : 'P';
    // Chunky boots with a turned-down cuff, short legs.
    box(`shin${side}`, 0.19, 0.2, 0.3, s * 0.11, 0.1, 0.035, look.boots, 0, 0, 0.06);
    box(`shin${side}`, 0.21, 0.06, 0.22, s * 0.11, 0.22, 0, trim, 0, 0, 0.02);
    limb(`shin${side}`, 0.075, 0.08, 0.18, s * 0.11, 0.33, 0, legs);
    limb(`thigh${side}`, 0.095, 0.085, 0.3, s * 0.11, 0.56, 0, legs);
    // Arms: short sleeve, bare forearm, a big glove.
    limb(`arm${side}`, 0.075, 0.065, 0.2, s * 0.27, 0.97, 0, look.secondary, s * 0.1);
    limb(`fore${side}`, 0.055, 0.05, 0.13, s * 0.285, 0.8, 0.005, look.skin, s * 0.05);
    box(`fore${side}`, 0.15, 0.15, 0.15, s * 0.295, 0.67, 0.01, gloves, 0, 0, 0.045);
    box(`fore${side}`, 0.16, 0.05, 0.16, s * 0.29, 0.75, 0.01, gloves, 0, 0, 0.015);   // glove cuff
  }
  if (look.skirt) box('hips', 0.46, 0.3, 0.3, 0, 0.6, 0, look.primary, 0, 0, 0.05);
  // Belt with pouches, a vest over the shirt, a neckerchief.
  box('hips', 0.42, 0.07, 0.29, 0, 0.75, 0, trim, 0, 0, 0.02);
  box('spine', 0.4, 0.34, 0.27, 0, 0.94, 0, look.primary, 0, 0, 0.06);
  box('spine', 0.22, 0.2, 0.02, 0, 1.0, 0.135, look.secondary, 0, 0, 0.005);           // shirt showing at the open vest
  box('spine', 0.3, 0.07, 0.24, 0, 1.12, 0, look.scarf ?? '#A8423A', 0, 0, 0.03);       // neckerchief
  if (look.pack !== false) {
    for (const s of [-1, 1]) box('hips', 0.1, 0.1, 0.08, s * 0.17, 0.71, 0.13, trim, 0, 0, 0.02);   // pouches
    box('spine', 0.05, 0.5, 0.02, 0.02, 0.95, 0.14, trim, 0.62);                                       // satchel strap
  }
  // The big head and hair masses.
  if (look.hairStyle === 'hood') {
    hbox(0.42, 0.42, 0.4, 0, 1.43, -0.03, look.secondary);
  } else if (look.hairStyle === 'bald') {
    // nothing on top
  } else if (look.hairStyle === 'short') {
    hbox(0.39, 0.08, 0.39, 0, 1.6, -0.01, look.hair);
    hbox(0.39, 0.2, 0.08, 0, 1.5, -0.16, look.hair);
  } else if (look.hairStyle === 'topknot') {
    hbox(0.39, 0.08, 0.39, 0, 1.6, -0.01, look.hair);
    hbox(0.14, 0.14, 0.14, 0, 1.72, -0.06, look.hair);
  } else {
    hbox(0.4, 0.1, 0.4, 0, 1.6, -0.01, look.hair);
    hbox(0.4, 0.3, 0.1, 0, 1.45, -0.17, look.hair);
    for (const s of [-1, 1]) hbox(0.06, 0.18, 0.12, s * 0.19, 1.47, 0.02, look.hair);   // sideburns
    if (look.hairStyle === 'long') hbox(0.38, 0.42, 0.1, 0, 1.25, -0.2, look.hair);
    else for (let i = -1; i <= 1; i++) hbox(0.1, 0.12, 0.14, i * 0.12, 1.66, -0.06 + Math.abs(i) * 0.03, look.hair, i * -0.4);
    if (look.hairStyle === 'cap') {
      // Newsboy cap with a brim and goggles strapped on (the board's adventurer).
      hbox(0.43, 0.13, 0.43, 0, 1.64, -0.01, look.primary);
      hbox(0.36, 0.05, 0.14, 0, 1.585, 0.2, look.primary, 0, 0.25);
      hbox(0.44, 0.04, 0.44, 0, 1.585, -0.01, trim);
      for (const s of [-1, 1]) hbox(0.11, 0.08, 0.05, s * 0.08, 1.62, 0.2, '#C9A23A');
      for (const s of [-1, 1]) hbox(0.07, 0.05, 0.02, s * 0.08, 1.62, 0.23, '#9FD0D8');
    }
  }
  // Species features, all rigid boxes on the bones they move with.
  const sp = look.species ?? 'human', fc = look.feature ?? FEATURE[sp];
  if (sp === 'infernling' || sp === 'drakari') {
    for (const s of [-1, 1]) {   // horns: back-swept
      hbox(0.08, 0.2, 0.08, s * 0.14, 1.7, 0.02, fc, s * -0.35, -0.4);
      hbox(0.06, 0.14, 0.06, s * 0.19, 1.81, -0.04, fc, s * -0.6, -0.9);
    }
    for (let i = 0; i < 4; i++) box('hips', 0.08 - i * 0.012, 0.08, 0.16, 0, 0.66 - i * 0.07, -0.18 - i * 0.13, look.skin, 0, 0.5, 0.02);   // tail
  }
  if (sp === 'drakari') hbox(0.22, 0.12, 0.12, 0, 1.32, 0.2, look.skin);   // snout
  if (sp === 'owlkin' || sp === 'corvani') {
    hbox(0.08, 0.08, 0.1, 0, 1.33, 0.2, fc);                                 // beak
    for (const s of [-1, 1]) {
      hbox(0.07, 0.12, 0.06, s * 0.15, 1.66, 0.02, look.hair, s * -0.4);     // ear tufts
      box(s < 0 ? 'armN' : 'armP', 0.04, 0.32, 0.2, s * 0.32, 0.9, -0.08, look.hair, s * 0.12, 0, 0.015);   // wing feathers
    }
  }
  if (sp === 'elf' || sp === 'lumari') for (const s of [-1, 1]) hbox(0.04, 0.12, 0.06, s * 0.2, 1.46, 0, look.skin, s * -0.6);   // pointed ears
  if (sp === 'lumari') hbox(0.34, 0.03, 0.34, 0, 1.8, 0, fc);              // halo ring (bright: bloom catches it)
  if (sp === 'emberkin' || sp === 'cinderkin') for (let i = -1; i <= 1; i++) hbox(0.1, 0.16, 0.1, i * 0.11, 1.7, -0.02, fc, i * -0.3);   // flame crest
  if (sp === 'stonekin') { box('spine', 0.18, 0.1, 0.08, -0.08, 1.02, 0.14, fc); box('spine', 0.12, 0.08, 0.08, 0.1, 0.9, 0.14, fc); }   // rock plates
  const headY = HEAD_Y * U, headS = HEAD * U;
  place(new RoundedBoxGeometry(headS, headS * 0.96, headS * 0.9, 4, headS * 0.2), 'head', 0, HEAD_Y, 0, look.skin);

  // Skeleton: bone positions are relative to the parent's pivot.
  const bones = {} as Record<BoneName, THREE.Bone>, rest = {} as Record<BoneName, THREE.Vector3>;
  for (const name of BONES) {
    const [parent, [x, y, z]] = RIG[name], b = new THREE.Bone();
    b.name = name;
    const pp = parent ? RIG[parent][1] : [0, 0, 0];
    b.position.set((x - pp[0]) * U, (y - pp[1]) * U, (z - pp[2]) * U);
    rest[name] = b.position.clone();
    if (parent) bones[parent].add(b);
    bones[name] = b;
  }
  const geo = mergeGeometries(parts.map(([g, c, b]) => rigged(painted(g, c, 0, height), BONES.indexOf(b))));
  const mesh = new THREE.SkinnedMesh(geo, bodyMat);
  mesh.add(bones.root);
  mesh.bind(new THREE.Skeleton(BONES.map((n) => bones[n])));
  mesh.frustumCulled = false;   // small and always near; skips per-frame skinned bounds
  root.add(mesh);
  // The painted face rides the head bone.
  const face = new THREE.Mesh(new THREE.PlaneGeometry(headS * 0.68, headS * 0.68), new THREE.MeshBasicMaterial({ map: faceTexture(look) }));
  face.name = 'face';
  face.position.set(0, headY - RIG.head[1][1] * U - headS * 0.04, headS * 0.45 + 0.003);
  bones.head.add(face);
  root.add(blobShadow(0.36 * U));
  root.userData.height = height;
  spriteFigure(root);
  root.userData.rig = { bones, rest, mesh } satisfies FigureRig;
  return root;
}

// The stagecoach (D13 BBEG placeholder): a black coach with lit lanterns. Feet at y = 0, faces +Z.
export function buildCoach(height: number): THREE.Group {
  const root = new THREE.Group();
  const U = height / 3.4;
  const parts: [THREE.BufferGeometry, string][] = [];
  const box = (w: number, h: number, d: number, x: number, y: number, z: number, color: string) => {
    const g = new THREE.BoxGeometry(w * U, h * U, d * U); g.translate(x * U, y * U, z * U); parts.push([g, color]);
  };
  box(2.0, 1.7, 1.5, 0, 1.75, 0, '#2E2A2E');       // cab
  box(2.2, 0.16, 1.7, 0, 2.66, 0, '#1E1A1E');      // roof lip
  box(1.4, 0.5, 1.1, 0, 2.98, 0, '#553823');       // luggage
  box(2.3, 0.18, 1.2, 0, 0.92, 0, '#1E1A1E');      // chassis
  box(0.5, 0.5, 0.05, 0, 1.95, 0.76, '#F2B36B');   // lit window
  box(0.6, 0.06, 1.0, 1.3, 1.25, 0, '#553823');    // driver's step
  for (const x of [-0.8, 0.8]) for (const z of [-0.78, 0.78]) {
    const w = new THREE.CylinderGeometry(0.55 * U, 0.55 * U, 0.12 * U, 8).rotateX(Math.PI / 2);
    w.translate(x * U, 0.55 * U, z * U); parts.push([w, '#3A2A1C']);
  }
  root.add(new THREE.Mesh(mergeGeometries(parts.map(([g, c]) => painted(g, c, 0, height))), bodyMat));
  // Lanterns glow (bloom picks these up).
  const lamp = new THREE.MeshBasicMaterial({ color: new THREE.Color('#FFD08A').multiplyScalar(1.6) });
  for (const x of [-1.05, 1.05]) {
    const l = new THREE.Mesh(new THREE.BoxGeometry(0.16 * U, 0.24 * U, 0.16 * U), lamp);
    l.position.set(x * U, 2.2 * U, 0.7 * U); root.add(l);
  }
  root.add(blobShadow(1.5 * U));
  root.userData.height = height;
  return root;
}
