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
  hairStyle?: 'spiky' | 'long' | 'hood' | 'short' | 'bald' | 'topknot' | 'cap' | 'flowing';
  skirt?: boolean;      // coat tails / dress below the belt
  // Restyle S2 trims (all optional; derived from the colours above when missing):
  gloves?: string;      // leather gloves
  scarf?: string;       // neckerchief
  legs?: string;        // trousers (defaults to primary)
  pack?: boolean;       // satchel strap and pouches
  // Restyle S2d (Tree of Savior gothic look):
  dress?: boolean;      // bell skirt with a frill, puffed sleeves
  wings?: string;       // small feathered wings on the back
  headpiece?: string;   // band with little flowers
  platform?: boolean;   // platform boots with strapped stockings
  // Phase B (B4 character forge):
  species?: Species;
  build?: number;       // width multiplier, 0.85 (slim) – 1.25 (broad)
  eyeStyle?: 'round' | 'slit' | 'owl' | 'sleepy';
  marks?: string;       // freckles / war paint colour, '' for none
  feature?: string;     // horns / beak / wing / ear colour (defaults per species)
}

// Restyle S2d: the default hero, after Mike's Tree of Savior reference (gothic chibi, platinum hair, wings).
export const GOTHIC_LOOK: FigureLook = {
  skin: '#F8E2D2', hair: '#D2C6B6', primary: '#26222C', secondary: '#3C3644', boots: '#1C1820', accent: '#B8935A',
  gloves: '#26222C', scarf: '#7A2A3A', legs: '#2A2630', eyes: '#C8463A', hairStyle: 'flowing',
  dress: true, wings: '#1E1A24', headpiece: '#2A2430', platform: true, pack: false, build: 0.9,
};

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

// Restyle S2c: the face is pixel art (24 px, nearest-filtered, like Tree of Savior's 3D bodies with pixel
// faces), stamped in layers: skin, fringe, eyes (whites, iris, pupil, highlight, lashes), brows, blush, mouth.
const EYES: Record<string, string[]> = {
  round:  ['.kkkk.', 'kkkkkk', 'khhiik', 'khddik', 'kiddik', 'kiddik', 'kliilk', '.kllk.'],
  sleepy: ['......', '......', 'kkkkkk', 'kiddik', 'kliilk', '.kkkk.', '......'],
  slit:   ['.kkkk.', 'kkkkkk', 'khiiik', 'kiidik', 'kiidik', 'kiidik', 'kliilk', '.kllk.'],
  owl:    ['.wwww.', 'wiiiiw', 'iikkii', 'iikkhi', 'iikkii', 'wiiiiw', '.wwww.'],
};
function faceTexture(look: FigureLook): THREE.CanvasTexture {
  const S = 24, c = document.createElement('canvas'); c.width = c.height = S;
  const g = c.getContext('2d')!;
  const px = (x: number, y: number, col: string) => { g.fillStyle = col; g.fillRect(x, y, 1, 1); };
  g.fillStyle = look.skin; g.fillRect(0, 0, S, S);
  const style = look.eyeStyle ?? (look.species === 'owlkin' || look.species === 'corvani' ? 'owl' : look.species === 'drakari' ? 'slit' : 'round');
  const base = new THREE.Color(look.eyes ?? (style === 'owl' ? '#E0A020' : '#4A6A8A'));
  const pal: Record<string, string> = {
    k: '#2A2026', w: '#FFF8EC', h: '#FFFFFF',
    i: '#' + base.getHexString(), d: '#' + base.clone().multiplyScalar(0.5).getHexString(),
    l: '#' + base.clone().lerp(new THREE.Color('#FFFFFF'), 0.45).getHexString(),
  };
  // Fringe: a hair band with a jagged lower edge.
  g.fillStyle = look.hair; g.fillRect(0, 0, S, 3);
  for (let x = 0; x < S; x++) if (x % 3 !== 2) px(x, 3, look.hair);
  for (let x = 1; x < S; x += 3) px(x, 4, look.hair);
  const eye = EYES[style] ?? EYES.round;
  for (const side of [-1, 1]) {
    const x0 = side < 0 ? 4 : 14, y0 = 8;
    eye.forEach((row, y) => [...row].forEach((ch, x) => {
      if (ch === '.') return;
      const xx = side < 0 ? x : row.length - 1 - x;   // mirror the right eye (highlight stays outer-top)
      px(x0 + xx, y0 + y, pal[ch]);
    }));
    if (style !== 'owl') for (let x = 0; x < 5; x++) px(x0 + (side < 0 ? x : x + 1), 6 + (x === (side < 0 ? 0 : 4) ? 1 : 0), pal.k);   // brow
  }
  if (look.marks) for (const [x, y] of [[3, 16], [4, 17], [19, 16], [20, 17]]) px(x, y, look.marks);
  for (const x of [3, 4, 19, 20]) px(x, 17, '#F0A098');   // blush
  const lip = look.species === 'infernling' || look.species === 'drakari' ? '#3A1A1A' : '#8A3A34';
  px(11, 19, lip); px(12, 19, lip); px(10, 18, lip); px(13, 18, lip);   // a small smile
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.magFilter = THREE.NearestFilter;
  t.minFilter = THREE.NearestFilter;
  t.generateMipmaps = false;
  return t;
}

const bodyMat = new THREE.MeshBasicMaterial({ vertexColors: true });
// Hybrid characters (default): the 3D body is lit with a 3-step toon ramp, like Tree of Savior. The flat,
// light-painted material is used when characters are drawn as pixel sprites (src/render/sprites.ts).
const ramp = new THREE.DataTexture(new Uint8Array([150, 150, 150, 255, 215, 215, 215, 255, 255, 255, 255, 255]), 3, 1);
ramp.magFilter = ramp.minFilter = THREE.NearestFilter; ramp.needsUpdate = true;
export const figureMats = { flat: bodyMat, toon: new THREE.MeshToonMaterial({ vertexColors: true, gradientMap: ramp }) };
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
  const headParts: [THREE.BufferGeometry, string][] = [];   // S2d: the head is drawn as a pixel-art billboard
  const place = (g: THREE.BufferGeometry, bone: BoneName, x: number, y: number, z: number, color: string, rz = 0, rx = 0, ry = 0) => {
    if (ry) g.rotateY(ry);
    if (rx) g.rotateX(rx);
    if (rz) g.rotateZ(rz);
    g.translate(x * U, y * U, z * U);
    if (bone === 'head') headParts.push([g, color]);
    else parts.push([g, color, bone]);
  };
  // Pillowy rounded box and a round limb: the sprite pass (src/render/sprites.ts) pixelates them, so soft
  // shapes read as drawn pixel art rather than boxes.
  const box = (bone: BoneName, w: number, h: number, d: number, x: number, y: number, z: number, color: string, rz = 0, rx = 0, r = 0.06) => {
    const k = bone === 'head' ? 1 : W;
    w *= k; d *= k; x *= k;
    place(new RoundedBoxGeometry(w * U, h * U, d * U, 2, Math.min(Math.max(r, Math.min(w, h, d) * 0.45), w / 2.2, h / 2.2, d / 2.2) * U), bone, x, y, z, color, rz, rx);
  };
  const limb = (bone: BoneName, rTop: number, rBot: number, h: number, x: number, y: number, z: number, color: string, rz = 0) => {
    place(new THREE.CylinderGeometry(rTop * W * U, rBot * W * U, h * U, 8), bone, x * W, y, z, color, rz);
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
    if (look.platform) {
      // Platform boots: a thick sole, a rounded toe and crossed straps up the stockings.
      box(`shin${side}`, 0.2, 0.09, 0.31, s * 0.11, 0.045, 0.04, '#141218', 0, 0, 0.03);
      box(`shin${side}`, 0.18, 0.16, 0.27, s * 0.11, 0.16, 0.035, look.boots, 0, 0, 0.06);
      for (const [y, t] of [[0.3, 1], [0.4, -1], [0.5, 1]]) box(`${y > 0.38 ? 'thigh' : 'shin'}${side}` as BoneName, 0.18, 0.025, 0.19, s * 0.11, y, 0.002, look.boots, t * 0.35, 0, 0.01);
    } else {
      box(`shin${side}`, 0.19, 0.2, 0.3, s * 0.11, 0.1, 0.035, look.boots, 0, 0, 0.06);
      box(`shin${side}`, 0.21, 0.06, 0.22, s * 0.11, 0.22, 0, trim, 0, 0, 0.02);
    }
    limb(`shin${side}`, 0.075, 0.08, 0.18, s * 0.11, 0.33, 0, legs);
    limb(`thigh${side}`, 0.095, 0.085, 0.3, s * 0.11, 0.56, 0, legs);
    // Arms: short sleeve, bare forearm, a big glove.
    limb(`arm${side}`, 0.075, 0.065, 0.2, s * 0.27, 0.97, 0, look.secondary, s * 0.1);
    limb(`fore${side}`, 0.055, 0.05, 0.13, s * 0.285, 0.8, 0.005, look.skin, s * 0.05);
    box(`fore${side}`, 0.15, 0.15, 0.15, s * 0.295, 0.67, 0.01, gloves, 0, 0, 0.045);
    box(`fore${side}`, 0.16, 0.05, 0.16, s * 0.29, 0.75, 0.01, gloves, 0, 0, 0.015);   // glove cuff
  }
  if (look.dress) {
    // Bell skirt with a pale frill at the hem, puffed sleeves and a frilled collar.
    place(new THREE.CylinderGeometry(0.19 * W * U, 0.4 * W * U, 0.34 * U, 14), 'hips', 0, 0.58, 0, look.primary);
    place(new THREE.CylinderGeometry(0.4 * W * U, 0.43 * W * U, 0.06 * U, 14), 'hips', 0, 0.4, 0, look.secondary);
    place(new THREE.CylinderGeometry(0.43 * W * U, 0.41 * W * U, 0.03 * U, 14), 'hips', 0, 0.36, 0, '#E8E0D8');
    for (const s of [-1, 1]) box(s < 0 ? 'armN' : 'armP', 0.17, 0.15, 0.17, s * 0.265, 1.0, 0, look.secondary, 0, 0, 0.07);
    box('spine', 0.3, 0.05, 0.22, 0, 1.15, 0.01, '#E8E0D8', 0, 0, 0.02);
  } else if (look.skirt) box('hips', 0.46, 0.3, 0.3, 0, 0.6, 0, look.primary, 0, 0, 0.05);
  if (look.wings) {
    // Small feathered wings, three fanned feathers a side.
    for (const s of [-1, 1]) for (let i = 0; i < 3; i++) {
      box('spine', 0.06, 0.46 - i * 0.08, 0.14, s * (0.24 + i * 0.12), 1.08 + i * 0.05, -0.22 - i * 0.02, look.wings, s * -(0.75 + i * 0.35), 0, 0.02);
    }
  }
  // Belt with pouches, a vest over the shirt, a neckerchief.
  box('hips', 0.42, 0.07, 0.29, 0, 0.75, 0, trim, 0, 0, 0.02);
  box('spine', 0.4, 0.34, 0.27, 0, 0.94, 0, look.primary, 0, 0, 0.06);
  box('spine', 0.22, 0.2, 0.02, 0, 1.0, 0.135, look.secondary, 0, 0, 0.005);           // shirt showing at the open vest
  if (!look.dress) box('spine', 0.3, 0.07, 0.24, 0, 1.12, 0, look.scarf ?? '#A8423A', 0, 0, 0.03);   // neckerchief
  else box('spine', 0.08, 0.06, 0.04, 0, 1.1, 0.14, look.scarf ?? '#7A2A3A', 0, 0, 0.015);          // ribbon
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
  } else if (look.hairStyle === 'flowing') {
    // Long wavy hair to the hips (Tree of Savior style): crown, fringe, wavy side locks, a big back mass.
    hbox(0.43, 0.3, 0.36, 0, 1.52, -0.05, look.hair);                         // rounded crown
    hbox(0.42, 0.3, 0.14, 0, 1.42, -0.16, look.hair);                          // back of the head
    for (let i = -2; i <= 2; i++) {                                              // wavy strands down the back
      const len = 0.42 - Math.abs(i) * 0.07 + (i % 2 ? 0.04 : 0);
      hbox(0.1, len, 0.09, i * 0.075, 1.3 - len / 2, -0.19 + Math.abs(i) * 0.01, look.hair, i * 0.06);
      hbox(0.08, 0.08, 0.08, i * 0.075 + (i % 2 ? 0.02 : -0.02), 1.3 - len - 0.02, -0.18, look.hair);   // curled tip
    }
    for (let i = -2; i <= 2; i++) hbox(0.1, 0.11, 0.06, i * 0.085, 1.555 - Math.abs(i) * 0.012, 0.19, look.hair, i * 0.2);
    for (const s of [-1, 1]) {
      hbox(0.1, 0.24, 0.14, s * 0.2, 1.42, 0.02, look.hair);
      hbox(0.1, 0.2, 0.12, s * 0.23, 1.24, 0, look.hair, s * -0.15);
      hbox(0.09, 0.18, 0.1, s * 0.24, 1.08, -0.02, look.hair, s * 0.2);
    }
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
  if (look.headpiece) {
    // A band across the crown with three little flowers.
    hbox(0.4, 0.035, 0.06, 0, 1.6, 0.14, look.headpiece);
    for (let i = -1; i <= 1; i++) hbox(0.06, 0.06, 0.04, i * 0.1, 1.66 - Math.abs(i) * 0.015, 0.14, i ? look.headpiece : look.scarf ?? '#7A2A3A');
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
  place(new RoundedBoxGeometry(headS, headS * 0.96, headS * 0.9, 4, headS * 0.4), 'head', 0, HEAD_Y, 0, look.skin);

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
  const mesh = new THREE.SkinnedMesh(geo, figureMats.toon);
  mesh.name = 'figure-body';
  mesh.add(bones.root);
  mesh.bind(new THREE.Skeleton(BONES.map((n) => bones[n])));
  mesh.frustumCulled = false;   // small and always near; skips per-frame skinned bounds
  root.add(mesh);
  // S2d: the head (skull, hair, hats, species features, face) is its own rigid mesh on the head bone. The
  // main camera never sees it: src/render/sprites.ts draws it as a pixel-art billboard from 8 directions.
  const headGroup = new THREE.Group();
  headGroup.name = 'head-group';
  const headGeo = mergeGeometries(headParts.map(([g, c]) => painted(g, c, 0, height)));
  headGeo.translate(-RIG.head[1][0] * U, -RIG.head[1][1] * U, -RIG.head[1][2] * U);
  const headMesh = new THREE.Mesh(headGeo, figureMats.flat);
  headMesh.name = 'figure-head';
  headMesh.raycast = noRaycast;
  headGroup.add(headMesh);
  bones.head.add(headGroup);
  // Curved to follow the rounded head.
  const fs = headS * 0.76, faceGeo = new THREE.PlaneGeometry(fs, fs, 4, 4), fp = faceGeo.attributes.position;
  for (let i = 0; i < fp.count; i++) {
    const u = fp.getX(i) / (fs / 2), v = fp.getY(i) / (fs / 2);
    fp.setZ(i, -headS * (0.06 * u * u + 0.03 * v * v));
  }
  faceGeo.computeVertexNormals();
  const face = new THREE.Mesh(faceGeo, new THREE.MeshBasicMaterial({ map: faceTexture(look) }));
  face.name = 'face';
  face.raycast = noRaycast;
  face.position.set(0, headY - RIG.head[1][1] * U - headS * 0.04, headS * 0.45 + 0.01);
  headGroup.add(face);
  // Billboard frame: the head's extent around its centre, radially (it turns), plus a margin.
  const anchor = new THREE.Object3D();
  anchor.name = 'head-anchor';
  anchor.position.set(0, headY - RIG.head[1][1] * U, 0);
  bones.head.add(anchor);
  headGeo.computeBoundingBox();
  const hb = headGeo.boundingBox!.translate(new THREE.Vector3(0, -anchor.position.y, 0));
  const reach = Math.max(-hb.min.x, hb.max.x, -hb.min.z, hb.max.z, headS * 0.5) * 1.12;
  root.userData.head = { anchor, group: headGroup, w: reach * 2, h: (hb.max.y - hb.min.y) * 1.1, cy: (hb.max.y + hb.min.y) / 2 };
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
