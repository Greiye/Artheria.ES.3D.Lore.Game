import * as THREE from 'three';
import { spriteFigure } from '../render/sprites';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { blobShadowTexture } from '../tex/pixel';
import { paintedAtlas, toTile, type PaintKind } from '../tex/paintedAtlas';

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
  // S2f: each part is also shaded down its own height (occlusion under it, light on top), as ToS bakes
  // shading into hand-painted diffuse maps.
  g.computeBoundingBox();
  const pMin = g.boundingBox!.min.y, pSpan = Math.max(1e-3, g.boundingBox!.max.y - pMin);
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
    c.multiplyScalar((0.9 + 0.14 * h) * (0.84 + 0.18 * ((p.getY(i) - pMin) / pSpan)));
    col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b;
  }
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  return g;
}

// S2f (Tree of Savior pipeline): characters are unlit. All shading is baked into the vertex colours
// (painted()), so they read the same in any light, as ToS bakes it into hand-painted diffuse maps.
const bodyMat = new THREE.MeshBasicMaterial({ vertexColors: true });
export const figureMats = { flat: bodyMat };
const atlasMats = new Map<THREE.Texture, THREE.MeshBasicMaterial>();
function atlasMaterial(map: THREE.Texture): THREE.MeshBasicMaterial {
  let m = atlasMats.get(map);
  if (!m) { m = new THREE.MeshBasicMaterial({ vertexColors: true, map }); atlasMats.set(map, m); }
  return m;
}
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
    const place = (g: THREE.BufferGeometry, bone: BoneName, x: number, y: number, z: number, color: string, rz = 0, rx = 0, ry = 0) => {
    if (ry) g.rotateY(ry);
    if (rx) g.rotateX(rx);
    if (rz) g.rotateZ(rz);
    g.translate(x * U, y * U, z * U);
    if (bone === 'head') g.dispose();   // S2h: no 3D head; src/render/headArt.ts draws it in 2D
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
    // Long wavy hair (Tree of Savior style): crown, fringe, wavy side locks, separate strands down the back.
    hbox(0.43, 0.3, 0.36, 0, 1.52, -0.05, look.hair);                         // rounded crown
    hbox(0.38, 0.26, 0.12, 0, 1.43, -0.15, look.hair);                          // back of the head
    const shade = '#' + new THREE.Color(look.hair).multiplyScalar(0.82).getHexString();
    for (let i = -1; i <= 1; i++) hbox(0.035, 0.22, 0.02, i * 0.1, 1.44, -0.21, shade);   // strand lines over the crown
    // Thin wavy strands down the back with gaps between them: each is three segments that sway side to side,
    // alternate strands a shade darker so they read apart, and each ends in a little curl.
    for (let i = 0; i < 5; i++) {
      const x = (i - 2) * 0.09, col = i % 2 ? shade : look.hair, len = 0.13 - Math.abs(i - 2) * 0.012;
      let y = 1.32;
      for (let k = 0; k < 3; k++) {
        const sway = (k % 2 ? 1 : -1) * (i % 2 ? -1 : 1) * 0.018;
        hbox(0.065 - k * 0.006, len, 0.06, x + sway, y - len / 2, -0.19 + Math.abs(i - 2) * 0.012, col, sway * 4);
        y -= len * 0.9;
      }
      hbox(0.06, 0.05, 0.06, x + (i % 2 ? 0.02 : -0.02), y - 0.01, -0.18, col);   // curled tip
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
    hbox(0.4, 0.035, 0.05, 0, 1.63, 0.105, look.headpiece);
    for (let i = -1; i <= 1; i++) hbox(0.06, 0.06, 0.04, i * 0.1, 1.66 - Math.abs(i) * 0.015, 0.12, i ? look.headpiece : look.scarf ?? '#7A2A3A');
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
  // S2g: a painted atlas tile per colour; the vertex colours then carry only the baked light (white base).
  const kindOf = (c: string): PaintKind => c === look.skin ? 'skin' : c === look.hair ? 'hair'
    : c === look.boots || c === gloves || c === '#141218' ? 'leather' : c === look.accent || c === '#C9A23A' ? 'metal' : 'cloth';
  const colours = [...new Set(parts.map(([, c]) => c))];
  const atlas = paintedAtlas(colours.map((c) => ({ color: c, kind: kindOf(c) })));
  const mat = atlasMaterial(atlas.texture);
  for (const [g, c] of parts) toTile(g, atlas.rect(c));
  const geo = mergeGeometries(parts.map(([g, , b]) => rigged(painted(g, '#FFFFFF', 0, height), BONES.indexOf(b))));
  const mesh = new THREE.SkinnedMesh(geo, mat);
  mesh.name = 'figure-body';
  mesh.add(bones.root);
  mesh.bind(new THREE.Skeleton(BONES.map((n) => bones[n])));
  mesh.frustumCulled = false;   // small and always near; skips per-frame skinned bounds
  root.add(mesh);
  // S2h (Tree of Savior): there is no 3D head. The head is flat 2D pixel art drawn from 8 directions
  // (src/render/headArt.ts) on a billboard at this anchor, the head's centre on the head bone.
  const anchor = new THREE.Object3D();
  anchor.name = 'head-anchor';
  anchor.position.set(0, headY - RIG.head[1][1] * U, 0);
  bones.head.add(anchor);
  root.userData.head = { anchor, size: headS };
  root.userData.look = look;
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
