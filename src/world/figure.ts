import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { blobShadowTexture } from '../tex/pixel';

// Rebuild R2 (docs/vision.md): Mega Man Legends-style placeholder characters. Boxy segmented parts,
// a big head with the face painted on, 2–3 flat colours, chunky hands and boots. Unlit: the light is
// "painted" into vertex colours (tops bright, undersides dark), so they read the same in any scene light.
// PLACEHOLDER: replaced per slot by public/models/<id>.glb (src/models.ts).

export interface FigureLook {
  skin: string; hair: string; primary: string; secondary: string; boots: string;
  accent?: string;      // belt / trim
  eyes?: string;
  hairStyle?: 'spiky' | 'long' | 'hood' | 'short' | 'bald' | 'topknot';
  skirt?: boolean;      // coat tails / dress below the belt
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

// Paint per-face light into vertex colours: a fixed key light from above-front plus a top-down gradient.
function painted(geo: THREE.BufferGeometry, color: string, yMin: number, yMax: number): THREE.BufferGeometry {
  const g = geo.index ? geo.toNonIndexed() : geo;
  g.computeVertexNormals();
  const base = new THREE.Color(color), c = new THREE.Color(), n = new THREE.Vector3();
  const p = g.attributes.position, nn = g.attributes.normal, col = new Float32Array(p.count * 3);
  for (let i = 0; i < p.count; i++) {
    n.fromBufferAttribute(nn, i);
    const lambert = Math.max(0, n.dot(light));
    const h = THREE.MathUtils.clamp((p.getY(i) - yMin) / Math.max(1e-3, yMax - yMin), 0, 1);
    // 0.62 floor so nothing goes black; three steps like a hand-painted ramp.
    const step = lambert > 0.75 ? 1.12 : lambert > 0.3 ? 0.96 : 0.74;
    c.copy(base).multiplyScalar(step * (0.86 + 0.18 * h));
    col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b;
  }
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  return g;
}

function faceTexture(look: FigureLook): THREE.CanvasTexture {
  const c = document.createElement('canvas'); c.width = c.height = 16;
  const g = c.getContext('2d')!;
  g.fillStyle = look.skin; g.fillRect(0, 0, 16, 16);
  g.fillStyle = look.hair; g.fillRect(0, 0, 16, 4); g.fillRect(0, 4, 2, 4); g.fillRect(14, 4, 2, 4);   // fringe + sideburns
  const style = look.eyeStyle ?? (look.species === 'owlkin' || look.species === 'corvani' ? 'owl' : look.species === 'drakari' ? 'slit' : 'round');
  g.fillStyle = '#2B2A24';
  if (style !== 'owl') { g.fillRect(4, 6, 3, 1); g.fillRect(9, 6, 3, 1); }                              // brows
  if (style === 'owl') {                                                                                // big round owl eyes
    g.fillStyle = '#FFFFFF'; g.fillRect(3, 5, 4, 5); g.fillRect(9, 5, 4, 5);
    g.fillStyle = look.eyes ?? '#E0A020'; g.fillRect(4, 6, 2, 3); g.fillRect(10, 6, 2, 3);
    g.fillStyle = '#1E2420'; g.fillRect(5, 7, 1, 1); g.fillRect(10, 7, 1, 1);
  } else {
    const top = style === 'sleepy' ? 8 : 7, h = style === 'sleepy' ? 2 : 3;
    g.fillStyle = '#FFFFFF'; g.fillRect(4, top, 3, h); g.fillRect(9, top, 3, h);                          // big eyes
    g.fillStyle = look.eyes ?? '#3E7A4A'; g.fillRect(5, top, 2, h); g.fillRect(10, top, 2, h);
    g.fillStyle = '#1E2420';
    if (style === 'slit') { g.fillRect(6, top, 1, h); g.fillRect(10, top, 1, h); }
    else { g.fillRect(6, top + 1, 1, h - 1); g.fillRect(11, top + 1, 1, h - 1); }
  }
  if (look.marks) {                                                                                     // freckles / paint
    g.fillStyle = look.marks; g.fillRect(3, 11, 1, 1); g.fillRect(5, 12, 1, 1); g.fillRect(12, 11, 1, 1); g.fillRect(10, 12, 1, 1);
  }
  g.fillStyle = 'rgba(0,0,0,0.25)'; g.fillRect(7, 11, 2, 1);                                            // nose shadow
  g.fillStyle = look.species === 'infernling' || look.species === 'drakari' ? '#3A1A1A' : '#9A4A3A';
  g.fillRect(6, 13, 4, 1);                                                                              // mouth
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.magFilter = t.minFilter = THREE.NearestFilter;
  t.generateMipmaps = false;
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
const RIG: Record<BoneName, [BoneName | null, [number, number, number]]> = {
  root: [null, [0, 0, 0]], hips: ['root', [0, 0.78, 0]], spine: ['hips', [0, 0.82, 0]], head: ['spine', [0, 1.19, 0]],
  armN: ['spine', [-0.25, 1.11, 0]], foreN: ['armN', [-0.27, 0.89, 0]], armP: ['spine', [0.25, 1.11, 0]], foreP: ['armP', [0.27, 0.89, 0]],
  thighN: ['hips', [-0.1, 0.76, 0]], shinN: ['thighN', [-0.11, 0.49, 0]], thighP: ['hips', [0.1, 0.76, 0]], shinP: ['thighP', [0.11, 0.49, 0]],
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
  const box = (bone: BoneName, w: number, h: number, d: number, x: number, y: number, z: number, color: string, rz = 0, rx = 0) => {
    const k = bone === 'head' ? 1 : W;
    w *= k; d *= k; x *= k;
    const g = new THREE.BoxGeometry(w * U, h * U, d * U);
    if (rx) g.rotateX(rx);
    if (rz) g.rotateZ(rz);
    g.translate(x * U, y * U, z * U);
    parts.push([g, color, bone]);
  };
  for (const s of [-1, 1]) {
    const side = s < 0 ? 'N' : 'P';
    // Boots: oversized, the Legends silhouette. Shins + thighs.
    box(`shin${side}`, 0.2, 0.16, 0.3, s * 0.11, 0.08, 0.03, look.boots);
    box(`shin${side}`, 0.13, 0.34, 0.14, s * 0.11, 0.33, 0, look.secondary);
    box(`thigh${side}`, 0.15, 0.26, 0.16, s * 0.1, 0.62, 0, look.secondary);
    // Arms: upper (primary), forearm (secondary), chunky fists (skin).
    box(`arm${side}`, 0.12, 0.22, 0.13, s * 0.25, 1.0, 0, look.primary, s * 0.08);
    box(`fore${side}`, 0.13, 0.2, 0.14, s * 0.27, 0.79, 0.01, look.secondary, s * 0.05);
    box(`fore${side}`, 0.13, 0.12, 0.14, s * 0.28, 0.64, 0.02, look.skin);
  }
  if (look.skirt) box('hips', 0.44, 0.3, 0.26, 0, 0.66, 0, look.primary);
  // Belt, torso, chest plate / shoulders, neck.
  box('hips', 0.36, 0.07, 0.22, 0, 0.78, 0, look.accent ?? look.boots);
  box('spine', 0.34, 0.32, 0.2, 0, 0.97, 0, look.primary);
  box('spine', 0.4, 0.1, 0.24, 0, 1.13, 0, look.primary);
  box('spine', 0.1, 0.06, 0.1, 0, 1.2, 0, look.skin);
  // The big head (~1/4.4 of the height) and hair masses.
  const headY = 1.4 * U, headS = 0.36 * U;
  if (look.hairStyle === 'hood') {
    box('head', 0.42, 0.42, 0.4, 0, 1.42, -0.03, look.secondary);
  } else if (look.hairStyle === 'bald') {
    // nothing on top
  } else if (look.hairStyle === 'short') {
    box('head', 0.39, 0.08, 0.39, 0, 1.6, -0.01, look.hair);
    box('head', 0.39, 0.2, 0.08, 0, 1.5, -0.16, look.hair);
  } else if (look.hairStyle === 'topknot') {
    box('head', 0.39, 0.08, 0.39, 0, 1.6, -0.01, look.hair);
    box('head', 0.14, 0.14, 0.14, 0, 1.72, -0.06, look.hair);
  } else {
    box('head', 0.4, 0.12, 0.4, 0, 1.6, -0.01, look.hair);
    box('head', 0.4, 0.3, 0.1, 0, 1.45, -0.17, look.hair);
    if (look.hairStyle === 'long') box('head', 0.38, 0.42, 0.1, 0, 1.25, -0.2, look.hair);
    else for (let i = -1; i <= 1; i++) box('head', 0.1, 0.12, 0.14, i * 0.12, 1.68, -0.06 + Math.abs(i) * 0.03, look.hair, i * -0.4);
  }
  // Species features, all rigid boxes on the bones they move with.
  const sp = look.species ?? 'human', fc = look.feature ?? FEATURE[sp];
  if (sp === 'infernling' || sp === 'drakari') {
    for (const s of [-1, 1]) {   // horns: back-swept
      box('head', 0.08, 0.2, 0.08, s * 0.14, 1.7, 0.02, fc, s * -0.35, -0.4);
      box('head', 0.06, 0.14, 0.06, s * 0.19, 1.81, -0.04, fc, s * -0.6, -0.9);
    }
    for (let i = 0; i < 4; i++) box('hips', 0.08 - i * 0.012, 0.08, 0.16, 0, 0.7 - i * 0.07, -0.18 - i * 0.13, look.skin, 0, 0.5);   // tail
  }
  if (sp === 'drakari') box('head', 0.22, 0.12, 0.12, 0, 1.32, 0.2, look.skin);   // snout
  if (sp === 'owlkin' || sp === 'corvani') {
    box('head', 0.08, 0.08, 0.1, 0, 1.36, 0.2, fc);                                 // beak
    for (const s of [-1, 1]) {
      box('head', 0.07, 0.12, 0.06, s * 0.15, 1.66, 0.02, look.hair, s * -0.4);     // ear tufts
      box(s < 0 ? 'armN' : 'armP', 0.04, 0.36, 0.22, s * 0.31, 0.92, -0.08, look.hair, s * 0.12);   // wing feathers
    }
  }
  if (sp === 'elf' || sp === 'lumari') for (const s of [-1, 1]) box('head', 0.04, 0.12, 0.06, s * 0.2, 1.46, 0, look.skin, s * -0.6);   // pointed ears
  if (sp === 'lumari') box('head', 0.34, 0.03, 0.34, 0, 1.78, 0, fc);              // halo ring (bright: bloom catches it)
  if (sp === 'emberkin' || sp === 'cinderkin') for (let i = -1; i <= 1; i++) box('head', 0.1, 0.16, 0.1, i * 0.11, 1.7, -0.02, fc, i * -0.3);   // flame crest
  if (sp === 'stonekin') { box('spine', 0.18, 0.1, 0.08, -0.08, 1.05, 0.11, fc); box('spine', 0.12, 0.08, 0.08, 0.1, 0.92, 0.11, fc); }   // rock plates
  const headBox = new THREE.BoxGeometry(headS, headS, headS * 0.95);
  headBox.translate(0, headY, 0);
  parts.push([headBox, look.skin, 'head']);

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
  const face = new THREE.Mesh(new THREE.PlaneGeometry(headS, headS), new THREE.MeshBasicMaterial({ map: faceTexture(look) }));
  face.name = 'face';
  face.position.set(0, headY - RIG.head[1][1] * U, headS * 0.475 + 0.002);
  bones.head.add(face);
  root.add(blobShadow(0.38 * U));
  root.userData.height = height;
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
