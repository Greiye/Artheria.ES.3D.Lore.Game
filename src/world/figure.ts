import * as THREE from 'three';
import { spriteFigure } from '../render/sprites';
import { FACE } from '../render/headArt';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { blobShadowTexture } from '../tex/pixel';
import { paintedAtlas, toTile, type PaintKind } from '../tex/paintedAtlas';

// Characters (Mike 2026-10-29, after the Kavik preview): low-poly figures at realistic proportions, about 7.5 heads
// tall, with a low-poly 3D head and a drawn face swapped like Mega Man Legends' face textures. Tapered limbs,
// soft-cornered clothes and kit. Unlit: a warm key and a cool shadow are painted into the vertex colours per face,
// so they read the same in any scene light. (Before: chibi, 2.8 heads, with flat 2D drawn heads.)
// PLACEHOLDER: replaced per slot by public/models/<id>.glb (src/models.ts).

export interface FigureLook {
  skin: string; hair: string; primary: string; secondary: string; boots: string;
  accent?: string;      // belt / trim
  eyes?: string;
  hairStyle?: 'spiky' | 'long' | 'hood' | 'short' | 'bald' | 'topknot' | 'cap' | 'flowing';
  skirt?: boolean;      // coat tails / dress below the belt
  art?: string;         // hand-drawn head sheets in src/art/heads/<art>.png (+ -face.png); drawn in code if missing
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
  // Trait rolls (src/traits/): a bigger head for small folk, and horns on any species.
  headScale?: number;
  horns?: boolean;
}

// Restyle S2d: the default hero, after Mike's Tree of Savior reference (gothic chibi, platinum hair, wings).
export const GOTHIC_LOOK: FigureLook = {
  art: 'heroine',
  skin: '#F8E2D2', hair: '#D2C6B6', primary: '#26222C', secondary: '#3C3644', boots: '#1C1820', accent: '#B8935A',
  gloves: '#26222C', scarf: '#7A2A3A', legs: '#2A2630', eyes: '#C8463A', hairStyle: 'flowing',
  dress: true, wings: '#1E1A24', headpiece: '#2A2430', platform: true, pack: false, build: 0.9,
};

// Public lore species names only (lore/Artheria-IP-Renames.md).
export type Species = 'human' | 'elf' | 'infernling' | 'drakari' | 'owlkin' | 'emberkin' | 'stonekin' | 'cinderkin' | 'titankin' | 'corvani' | 'lumari' | 'goblin';

const light = new THREE.Vector3(0.35, 0.85, 0.4).normalize();
const WARM = new THREE.Color('#FFE2B8'), COOL = new THREE.Color('#7E8CB8');

// Paint per-face light into vertex colours: a warm key from above-front, cool shade on the far side,
// plus a gentle top-down gradient (storybook painted shading, three soft steps).
export function painted(geo: THREE.BufferGeometry, color: string, yMin: number, yMax: number): THREE.BufferGeometry {
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
  stonekin: '#8A8478', cinderkin: '#FF6A20', titankin: '#7A5236', corvani: '#3A3A3A', lumari: '#FFF0B0', goblin: '#1A1418',
};

export const BONES = ['root', 'hips', 'spine', 'head', 'armN', 'foreN', 'armP', 'foreP', 'thighN', 'shinN', 'thighP', 'shinP'] as const;
export type BoneName = typeof BONES[number];
// [parent, pivot] per bone, in metres for a 1.75 m figure. N = the figure's -X side, P = its +X side.
// Realistic proportions (Mike 2026-10-29, after the Kavik preview): about 7.5 heads tall, hips at 0.93, knees at 0.49,
// shoulders at 1.42, the neck pivot at 1.5.
const RIG: Record<BoneName, [BoneName | null, [number, number, number]]> = {
  root: [null, [0, 0, 0]], hips: ['root', [0, 0.93, 0]], spine: ['hips', [0, 0.98, 0]], head: ['spine', [0, 1.5, 0]],
  armN: ['spine', [-0.19, 1.42, 0]], foreN: ['armN', [-0.22, 1.13, 0]], armP: ['spine', [0.19, 1.42, 0]], foreP: ['armP', [0.22, 1.13, 0]],
  thighN: ['hips', [-0.09, 0.9, 0]], shinN: ['thighN', [-0.095, 0.49, 0]], thighP: ['hips', [0.09, 0.9, 0]], shinP: ['thighP', [0.095, 0.49, 0]],
};
/** Hips height as a fraction of the figure's height (poses scale their offsets by it). */
export const HIPS_AT = RIG.hips[1][1] / 1.75;
/** The head in metres for a 1.75 m figure: centre height and skull size. */
export const HEAD = { y: 1.625, w: 0.165, h: 0.215, d: 0.195 };
export interface FigureRig { bones: Record<BoneName, THREE.Bone>; rest: Record<BoneName, THREE.Vector3>; mesh: THREE.SkinnedMesh }
/** Named attach points that ride the bones (trait props, later .glb props). Positions in metres for a 1.75 m figure. */
export const SOCKETS: Record<string, [BoneName, number, number, number]> = {
  head_top: ['head', 0, 1.74, 0], face: ['head', 0, 1.64, 0.1], neck: ['spine', 0, 1.47, 0.05], chest: ['spine', 0, 1.3, 0.11],
  back: ['spine', 0, 1.25, -0.12], hip_l: ['hips', 0.15, 0.95, 0], hip_r: ['hips', -0.15, 0.95, 0], hand_r: ['foreN', -0.24, 0.84, 0], hand_l: ['foreP', 0.24, 0.84, 0],
};
/** Builders for extra parts, passed to buildFigure's `extras`: each part is merged into the body (no extra draw call). */
export interface PropKit {
  /** A soft box on a bone; figure metres (x, width and depth scale with the build). */
  box(bone: BoneName, w: number, h: number, d: number, x: number, y: number, z: number, color: string, rz?: number, rx?: number, r?: number): void;
  /** A tapered limb in the figure's XY plane. */
  seg(bone: BoneName, x1: number, y1: number, x2: number, y2: number, r1: number, r2: number, color: string, z?: number, sides?: number, sz?: number): void;
  ball(bone: BoneName, r: number, x: number, y: number, z: number, color: string, sx?: number, sy?: number, sz?: number): void;
  /** Head-space parts (a 0.36 m head centred at y 1.4): a box, an open shell, a tapered lock through points. */
  hbox(w: number, h: number, d: number, x: number, y: number, z: number, color: string, rz?: number, rx?: number): void;
  shell(rx: number, ry: number, rz: number, x: number, y: number, z: number, color: string, top?: number, open?: number, tilt?: number): void;
  lock(pts: [number, number, number][], r1: number, r2: number, color: string, sides?: number): void;
  /** A tapered rod between two points in figure metres on a bone (handles, shafts, straps). */
  rod(bone: BoneName, a: [number, number, number], b: [number, number, number], r1: number, r2: number, color: string, sides?: number): void;
  look: FigureLook;
}

export function rigged(geo: THREE.BufferGeometry, bone: number): THREE.BufferGeometry {
  const n = geo.attributes.position.count, idx = new Uint16Array(n * 4), w = new Float32Array(n * 4);
  for (let i = 0; i < n; i++) { idx[i * 4] = bone; w[i * 4] = 1; }
  geo.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(idx, 4));
  geo.setAttribute('skinWeight', new THREE.Float32BufferAttribute(w, 4));
  return geo;
}

// Build a figure `height` m tall, feet at y = 0, facing +Z. root.userData.rig holds the bones.
export function buildFigure(look: FigureLook, height: number, extras?: (kit: PropKit) => void): THREE.Group {
  const U = height / 1.75;   // proportions authored for a 1.75 m figure
  const W = THREE.MathUtils.clamp(look.build ?? (look.species === 'titankin' ? 1.2 : 1), 0.8, 1.3);   // body width
  const root = new THREE.Group();
  const parts: [THREE.BufferGeometry, string, BoneName][] = [];
  const place = (g: THREE.BufferGeometry, bone: BoneName, x: number, y: number, z: number, color: string, rz = 0, rx = 0, ry = 0) => {
    if (ry) g.rotateY(ry);
    if (rx) g.rotateX(rx);
    if (rz) g.rotateZ(rz);
    g.translate(x * U, y * U, z * U);
    parts.push([g, color, bone]);
  };
  // Soft-cornered boxes for clothes, hair and kit; tapered low-poly limbs (six to ten sides) for the body.
  const box = (bone: BoneName, w: number, h: number, d: number, x: number, y: number, z: number, color: string, rz = 0, rx = 0, r = 0.02) => {
    const k = bone === 'head' ? 1 : W;
    w *= k; d *= k; x *= k;
    place(new RoundedBoxGeometry(w * U, h * U, d * U, 1, Math.min(r, w / 2.2, h / 2.2, d / 2.2) * U), bone, x, y, z, color, rz, rx);
  };
  // A tapered limb from (x1, y1) to (x2, y2), in the figure's XY plane; sz flattens it front to back.
  const seg = (bone: BoneName, x1: number, y1: number, x2: number, y2: number, r1: number, r2: number, color: string, z = 0, sides = 7, sz = 1) => {
    x1 *= W; x2 *= W;
    const len = Math.hypot(x2 - x1, y2 - y1), ang = Math.atan2(x2 - x1, y1 - y2);
    const g = new THREE.CylinderGeometry(r1 * W * U, r2 * W * U, len * U, sides);
    g.scale(1, 1, sz);
    place(g, bone, (x1 + x2) / 2, (y1 + y2) / 2, z, color, ang);
  };
  const ball = (bone: BoneName, r: number, x: number, y: number, z: number, color: string, sx = 1, sy = 1, sz = 1) => {
    const g = new THREE.SphereGeometry(r * W * U, 7, 5);
    g.scale(sx, sy, sz);
    place(g, bone, x * W, y, z, color);
  };
  // Head-space parts (hair, hats, species features) were authored for a 0.36 m head centred at y 1.4;
  // they are mapped onto the skull, axis by axis.
  const hx = HEAD.w / 0.36, hy = HEAD.h / 0.36, hz = HEAD.d / 0.36;
  const hbox = (w: number, h: number, d: number, x: number, y: number, z: number, color: string, rz = 0, rx = 0) =>
    box('head', w * hx, h * hy, d * hz, x * hx, HEAD.y + (y - 1.4) * hy, z * hz, color, rz, rx, 0.012);
  const legs = look.legs ?? look.primary, gloves = look.gloves ?? look.boots, trim = look.accent ?? look.boots;
  for (const s of [-1, 1]) {
    const side = s < 0 ? 'N' : 'P', thigh = `thigh${side}` as BoneName, shin = `shin${side}` as BoneName;
    const arm = `arm${side}` as BoneName, fore = `fore${side}` as BoneName;
    seg(thigh, s * 0.09, 0.95, s * 0.095, 0.49, 0.078, 0.056, legs, 0, 8);
    seg(shin, s * 0.095, 0.5, s * 0.095, 0.1, 0.054, 0.038, legs, 0, 7);
    if (look.platform) {
      // Platform boots: a thick sole, a rounded toe and strapped stockings up the thigh.
      box(shin, 0.1, 0.06, 0.26, s * 0.095, 0.03, 0.045, '#141218', 0, 0, 0.015);
      seg(shin, s * 0.095, 0.44, s * 0.095, 0.08, 0.052, 0.046, look.boots, 0, 7);
      box(shin, 0.09, 0.07, 0.2, s * 0.095, 0.1, 0.05, look.boots, 0, 0, 0.025);
      for (const y of [0.56, 0.64, 0.72]) { const r = 0.062 + (y - 0.49) * 0.048; seg(thigh, s * 0.093, y + 0.012, s * 0.093, y - 0.012, r, r, look.boots, 0, 7); }
    } else {
      // Calf boots with a turned-down cuff.
      seg(shin, s * 0.095, 0.3, s * 0.095, 0.06, 0.05, 0.047, look.boots, 0, 7);
      box(shin, 0.09, 0.07, 0.24, s * 0.095, 0.035, 0.05, look.boots, 0, 0, 0.025);
      seg(shin, s * 0.095, 0.32, s * 0.095, 0.27, 0.058, 0.058, trim, 0, 7);
    }
    // Arms: sleeve, bare forearm, a glove.
    ball(arm, 0.058, s * 0.175, 1.415, 0, look.secondary, 1, 0.85, 0.9);
    seg(arm, s * 0.19, 1.43, s * 0.22, 1.13, 0.047, 0.04, look.secondary, 0, 7);
    seg(fore, s * 0.22, 1.13, s * 0.235, 0.9, 0.037, 0.03, look.skin, 0, 7);
    seg(fore, s * 0.228, 0.99, s * 0.236, 0.9, 0.041, 0.035, gloves, 0, 7);
    box(fore, 0.045, 0.1, 0.075, s * 0.24, 0.84, 0.005, gloves, 0, 0, 0.018);
  }
  // Pelvis, torso (a V-taper, flattened front to back), neck.
  seg('hips', 0, 0.86, 0, 1.0, 0.135, 0.14, legs, 0, 10, 0.72);
  seg('spine', 0, 0.98, 0, 1.44, 0.135, 0.175, look.primary, 0, 10, 0.62);
  seg('spine', 0, 1.43, 0, 1.54, 0.045, 0.048, look.skin, 0, 7);
  box('spine', 0.12, 0.22, 0.012, 0, 1.3, 0.103, look.secondary, 0, 0, 0.004);   // shirt showing at the open vest
  if (look.dress) {
    // Bell skirt with a pale frill at the hem, puffed sleeves and a frilled collar.
    place(new THREE.CylinderGeometry(0.14 * W * U, 0.32 * W * U, 0.53 * U, 14), 'hips', 0, 0.715, 0, look.primary);
    place(new THREE.CylinderGeometry(0.32 * W * U, 0.335 * W * U, 0.05 * U, 14), 'hips', 0, 0.47, 0, look.secondary);
    place(new THREE.CylinderGeometry(0.335 * W * U, 0.325 * W * U, 0.025 * U, 14), 'hips', 0, 0.435, 0, '#E8E0D8');
    for (const s of [-1, 1]) ball(s < 0 ? 'armN' : 'armP', 0.075, s * 0.19, 1.39, 0, look.secondary);
    seg('spine', 0, 1.44, 0, 1.47, 0.085, 0.07, '#E8E0D8', 0, 10, 0.8);
  } else if (look.skirt) place(new THREE.CylinderGeometry(0.15 * W * U, 0.22 * W * U, 0.38 * U, 12), 'hips', 0, 0.79, 0, look.primary);
  if (look.wings) {
    // Small feathered wings, three fanned feathers a side.
    for (const s of [-1, 1]) for (let i = 0; i < 3; i++) {
      box('spine', 0.035, 0.3 - i * 0.05, 0.09, s * (0.12 + i * 0.08), 1.3 + i * 0.03, -0.13 - i * 0.012, look.wings, s * -(0.75 + i * 0.35), 0, 0.012);
    }
  }
  // Belt, neckerchief (or the dress's ribbon), pouches and a satchel strap.
  seg('hips', 0, 0.95, 0, 1.01, 0.143, 0.143, trim, 0, 10, 0.72);
  if (!look.dress) seg('spine', 0, 1.42, 0, 1.475, 0.078, 0.066, look.scarf ?? '#A8423A', 0, 8, 0.85);
  else box('spine', 0.05, 0.04, 0.025, 0, 1.425, 0.075, look.scarf ?? '#7A2A3A', 0, 0, 0.01);
  if (look.pack !== false) {
    for (const s of [-1, 1]) box('hips', 0.06, 0.07, 0.05, s * 0.11, 0.93, 0.1, trim, 0, 0, 0.012);
    box('spine', 0.035, 0.5, 0.012, 0.0, 1.2, 0.107, trim, 0.62, 0, 0.004);
  }
  // The head: a low-poly skull, jaw, nose and ears. The face is a drawn texture over its front (below).
  place(new RoundedBoxGeometry(HEAD.w * U, HEAD.h * U, HEAD.d * U, 2, 0.035 * U), 'head', 0, HEAD.y, 0, look.skin);
  box('head', HEAD.w * 0.72, 0.06, HEAD.d * 0.74, 0, HEAD.y - HEAD.h * 0.43, 0.012, look.skin, 0, 0, 0.022);   // jaw
  box('head', 0.024, 0.04, 0.026, 0, HEAD.y - 0.025, HEAD.d / 2 + 0.006, look.skin, 0, -0.25, 0.008);           // nose
  const sp = look.species ?? 'human', fc = look.feature ?? FEATURE[sp];
  if (sp !== 'elf' && sp !== 'lumari' && sp !== 'goblin') for (const s of [-1, 1]) box('head', 0.022, 0.05, 0.035, s * HEAD.w / 2, HEAD.y - 0.005, -0.005, look.skin, 0, 0, 0.008);
  // Hair (sculpted, after the realistic switch): a shell over the skull, open at the face and tilted so the
  // hairline sits high at the front and low at the nape, plus tapered locks with rounded ends.
  const shade = '#' + new THREE.Color(look.hair).multiplyScalar(0.84).getHexString();
  const hp = (x: number, y: number, z: number) => new THREE.Vector3(x * hx, HEAD.y + (y - 1.4) * hy, z * hz);
  // An ellipsoid shell around (x, y, z): `top` is how far down it reaches (0.5 = to its middle), `open` the half
  // width of the gap at the front in radians, `tilt` lifts its front edge.
  const shell = (rx: number, ry: number, rz: number, x: number, y: number, z: number, color: string, top = 0.6, open = 0, tilt = 0) => {
    const g = new THREE.SphereGeometry(1, 14, 9, Math.PI / 2 + open, Math.PI * 2 - 2 * open, 0, Math.PI * top);
    // Squared off toward a box (a superellipsoid), so it hugs the skull's corners rather than cutting through them.
    if (tilt) g.rotateX(-tilt);
    const pos = g.attributes.position.array as Float32Array;
    for (let i = 0; i < pos.length; i++) pos[i] = Math.sign(pos[i]) * Math.abs(pos[i]) ** 0.6;
    g.scale(rx * hx * U, ry * hy * U, rz * hz * U);
    g.computeVertexNormals();
    const c = hp(x, y, z);
    place(g, 'head', c.x, c.y, c.z, color);
  };
  // A lock through the given head-space points, tapering from r1 to r2, each joint rounded off.
  const lock = (pts: [number, number, number][], r1: number, r2: number, color: string, sides = 6) => {
    const P = pts.map(([x, y, z]) => hp(x, y, z)), up = new THREE.Vector3(0, 1, 0);
    for (let i = 0; i < P.length - 1; i++) {
      const a = P[i], b = P[i + 1], d = b.clone().sub(a), len = d.length();
      const ra = (r1 + (r2 - r1) * i / (P.length - 1)) * hx, rb = (r1 + (r2 - r1) * (i + 1) / (P.length - 1)) * hx;
      const g = new THREE.CylinderGeometry(rb * U, ra * U, len * U, sides, 1, true);
      g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(up, d.normalize()));
      const m = a.clone().add(b).multiplyScalar(0.5);
      place(g, 'head', m.x, m.y, m.z, color);
      const k = new THREE.SphereGeometry(rb * U, sides, 4);
      place(k, 'head', b.x, b.y, b.z, color);
    }
  };
  // Every style but the hood and bald starts from the same cap: down to the ears, nape covered.
  const cap = (reach = 0.6) => shell(0.205, 0.2, 0.205, 0, 1.43, -0.012, look.hair, reach, 0, 0.5);
  const fringe = (n: number, len: number, sweep = 0) => {
    for (let i = 0; i < n; i++) {
      const x = (i - (n - 1) / 2) * (0.3 / n), k = Math.abs(x) / 0.15;
      lock([[x, 1.6, 0.11], [x + sweep * 0.5, 1.56 - k * 0.02, 0.19], [x + sweep, 1.56 - len - k * 0.03, 0.2]], 0.045, 0.02, i % 2 ? shade : look.hair);
    }
  };
  if (look.hairStyle === 'hood') {
    shell(0.24, 0.24, 0.235, 0, 1.4, -0.02, look.secondary, 0.72, 0, 0.85);
    lock([[0, 1.56, -0.2], [0, 1.4, -0.27], [0, 1.24, -0.26]], 0.08, 0.05, look.secondary);   // the hood's fall at the back
  } else if (look.hairStyle === 'bald') {
    // nothing on top
  } else if (look.hairStyle === 'short') {
    cap(0.62);
    fringe(4, 0.05, 0.03);
  } else if (look.hairStyle === 'flowing') {
    // Long wavy hair (Tree of Savior style): crown, a parted fringe, wavy side locks and strands down the back.
    cap(0.66);
    shell(0.19, 0.2, 0.1, 0, 1.36, -0.13, look.hair, 0.75);                                    // fullness at the back
    for (let i = 0; i < 6; i++) {
      const x = (i - 2.5) * 0.065, w = (i % 2 ? 1 : -1) * 0.025, col = i % 2 ? shade : look.hair;
      lock([[x * 0.8, 1.42, -0.17], [x + w, 1.25, -0.22], [x - w, 1.08, -0.21], [x + w * 0.6, 0.94, -0.18]], 0.05, 0.022, col);
    }
    for (const s of [-1, 1]) {
      lock([[s * 0.06, 1.6, 0.12], [s * 0.13, 1.55, 0.19], [s * 0.18, 1.44, 0.17]], 0.05, 0.03, look.hair);   // parted fringe
      lock([[s * 0.19, 1.5, 0.06], [s * 0.23, 1.32, 0.05], [s * 0.21, 1.16, 0.02], [s * 0.24, 1.02, -0.01]], 0.055, 0.025, s < 0 ? shade : look.hair);
    }
  } else if (look.hairStyle === 'topknot') {
    cap(0.6);
    shell(0.075, 0.075, 0.075, 0, 1.69, -0.08, look.hair, 1);                                    // the knot
    lock([[0, 1.62, -0.06], [0, 1.66, -0.08]], 0.04, 0.035, shade);                                // its tie
  } else {
    cap(look.hairStyle === 'long' ? 0.66 : 0.6);
    for (const s of [-1, 1]) lock([[s * 0.19, 1.52, 0.04], [s * 0.2, 1.4, 0.06]], 0.04, 0.025, look.hair);   // sideburns
    if (look.hairStyle === 'long') {
      fringe(3, 0.06, -0.02);
      for (let i = 0; i < 5; i++) {
        const x = (i - 2) * 0.075;
        lock([[x * 0.9, 1.45, -0.17], [x, 1.3, -0.21], [x * 1.05, 1.12, -0.2]], 0.06, 0.035, i % 2 ? shade : look.hair);
      }
    } else if (look.hairStyle !== 'cap') {
      // Spiky: swept-up points over the crown and a jagged fringe.
      for (let i = -2; i <= 2; i++) lock([[i * 0.07, 1.6, -0.03 + Math.abs(i) * 0.01], [i * 0.1, 1.73 - Math.abs(i) * 0.025, -0.09]], 0.06, 0.012, i % 2 ? shade : look.hair);
      for (const s of [-1, 1]) lock([[s * 0.1, 1.55, -0.16], [s * 0.15, 1.6, -0.25]], 0.055, 0.012, look.hair);
      fringe(5, 0.07, 0.02);
    }
    if (look.hairStyle === 'cap') {
      fringe(3, 0.04);
      // Newsboy cap with a brim and goggles strapped on (the board's adventurer).
      shell(0.225, 0.17, 0.225, 0, 1.55, -0.01, look.primary, 0.5);
      shell(0.2, 0.03, 0.12, 0, 1.56, 0.17, look.primary, 0.5, 0, 0.3);                             // brim
      lock([[-0.22, 1.56, -0.01], [0.22, 1.56, -0.01]], 0.022, 0.022, trim, 10);                  // band
      for (const s of [-1, 1]) lock([[s * 0.04, 1.63, 0.19], [s * 0.12, 1.63, 0.19]], 0.04, 0.04, '#C9A23A', 8);
      for (const s of [-1, 1]) shell(0.03, 0.03, 0.012, s * 0.08, 1.63, 0.225, '#9FD0D8', 1);
    }
  }
  if (look.headpiece) {
    // A band across the crown with three little flowers.
    hbox(0.4, 0.035, 0.05, 0, 1.63, 0.105, look.headpiece);
    for (let i = -1; i <= 1; i++) hbox(0.06, 0.06, 0.04, i * 0.1, 1.66 - Math.abs(i) * 0.015, 0.12, i ? look.headpiece : look.scarf ?? '#7A2A3A');
  }
  // Species features, all rigid to the bones they move with.
  if (sp === 'infernling' || sp === 'drakari') {
    for (const s of [-1, 1]) {   // horns: back-swept
      hbox(0.08, 0.2, 0.08, s * 0.14, 1.7, 0.02, fc, s * -0.35, -0.4);
      hbox(0.06, 0.14, 0.06, s * 0.19, 1.81, -0.04, fc, s * -0.6, -0.9);
    }
    for (let i = 0; i < 4; i++) box('hips', 0.06 - i * 0.01, 0.06, 0.13, 0, 0.88 - i * 0.07, -0.13 - i * 0.11, look.skin, 0, 0.5, 0.012);   // tail
  }
  if (sp === 'drakari') hbox(0.22, 0.12, 0.12, 0, 1.32, 0.2, look.skin);   // snout
  if (sp === 'owlkin' || sp === 'corvani') {
    hbox(0.08, 0.08, 0.1, 0, 1.33, 0.2, fc);                                 // beak
    for (const s of [-1, 1]) {
      hbox(0.07, 0.12, 0.06, s * 0.15, 1.66, 0.02, look.hair, s * -0.4);     // ear tufts
      box(s < 0 ? 'armN' : 'armP', 0.03, 0.26, 0.13, s * 0.23, 1.27, -0.05, look.hair, s * 0.12, 0, 0.01);   // wing feathers
    }
  }
  if (sp === 'elf' || sp === 'lumari') for (const s of [-1, 1]) hbox(0.04, 0.12, 0.06, s * 0.2, 1.46, 0, look.skin, s * -0.6);   // pointed ears
  if (sp === 'goblin') {
    // Long ears swept out and up, a hooked nose and a heavy brow.
    for (const s of [-1, 1]) lock([[s * 0.17, 1.42, -0.02], [s * 0.3, 1.49, -0.05], [s * 0.42, 1.58, -0.09]], 0.07, 0.012, look.skin);
    lock([[0, 1.43, 0.19], [0, 1.36, 0.25], [0, 1.31, 0.23]], 0.045, 0.02, look.skin);
    hbox(0.34, 0.05, 0.06, 0, 1.47, 0.17, look.skin);
  }
  if (look.horns && sp !== 'infernling' && sp !== 'drakari') for (const s of [-1, 1]) lock([[s * 0.1, 1.55, 0], [s * 0.16, 1.7, -0.04], [s * 0.2, 1.8, -0.14]], 0.05, 0.012, fc);
  if (sp === 'lumari') hbox(0.34, 0.03, 0.34, 0, 1.8, 0, fc);              // halo ring (bright: bloom catches it)
  if (sp === 'emberkin' || sp === 'cinderkin') for (let i = -1; i <= 1; i++) hbox(0.1, 0.16, 0.1, i * 0.11, 1.7, -0.02, fc, i * -0.3);   // flame crest
  if (sp === 'stonekin') { box('spine', 0.11, 0.06, 0.04, -0.06, 1.28, 0.1, fc); box('spine', 0.08, 0.05, 0.04, 0.07, 1.15, 0.1, fc); }   // rock plates

  if (extras) {
    const rod: PropKit['rod'] = (bone, a, b, r1, r2, color, sides = 6) => {
      const A = new THREE.Vector3(a[0] * W, a[1], a[2]), B = new THREE.Vector3(b[0] * W, b[1], b[2]), d = B.clone().sub(A), len = d.length();
      const g = new THREE.CylinderGeometry(r2 * U, r1 * U, len * U, sides);
      g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.normalize()));
      const m = A.add(B).multiplyScalar(0.5);
      place(g, bone, m.x, m.y, m.z, color);
    };
    extras({ box, seg, ball, hbox, shell, lock, rod, look });
  }
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
  // The face (Mega Man Legends style): the look's drawn face sheet (src/render/headArt.ts, Mike's hand-drawn
  // sheets where they exist) on a quad over the front of the skull. Expressions swap by moving its UVs
  // (src/render/sprites.ts), so blinking and talking cost nothing.
  const face = new THREE.Mesh(new THREE.PlaneGeometry(FACE.w * HEAD.w * U, FACE.h * HEAD.w * U), faceMaterial());
  face.name = 'figure-face';
  face.position.set(0, (HEAD.y - FACE.drop * HEAD.w - RIG.head[1][1]) * U, (HEAD.d / 2 + 0.004) * U);
  face.raycast = noRaycast;
  bones.head.add(face);
  root.userData.face = face;
  if (look.headScale) bones.head.scale.setScalar(look.headScale);
  const sockets: Record<string, THREE.Object3D> = {};
  for (const [name, [bone, x, y, z]] of Object.entries(SOCKETS)) {
    const o = new THREE.Object3D(), pv = RIG[bone][1];
    o.name = 'socket:' + name;
    o.position.set((x * W - pv[0]) * U, (y - pv[1]) * U, (z - pv[2]) * U);
    bones[bone].add(o); sockets[name] = o;
  }
  root.userData.sockets = sockets;
  root.userData.look = look;
  root.add(blobShadow(0.3 * U));
  root.userData.height = height;
  spriteFigure(root);
  root.userData.rig = { bones, rest, mesh } satisfies FigureRig;
  return root;
}

// One face material per figure: its map is the look's face sheet once loaded (src/render/sprites.ts).
export function faceMaterial() { return new THREE.MeshBasicMaterial({ alphaTest: 0.5, visible: false }); }

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
