import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { paintedAtlas, toTile, type PaintKind } from '../tex/paintedAtlas';
import { painted, rigged, faceMaterial, blobShadow, BONES, type BoneName, type FigureLook, type FigureRig } from './figure';
import { spriteFigure } from '../render/sprites';
import { FACE } from '../render/headArt';

// Kavik (Mike's character, from his reference sheet and the 2026-10-29 realistic-proportions preview): an NPC with
// his own outfit (purple skin, horns, pointed ears, a wrap top, an obi with a big back bow, bracers, hakama, leg
// wraps and rope sandals). Same pipeline as every figure (src/world/figure.ts): painted atlas, baked vertex light,
// unlit, one skinned mesh on the 12-bone rig so FigureAnim drives it, and a drawn face on his 3D head.

const SKIN = '#8C5EC4', CLOTH = '#D6C29A', DARK = '#4A3448', OBI = '#8A3A7A', LEATHER = '#3E2A3A',
  HAIR = '#5A3A2A', HORN = '#C8A8E0', SOLE = '#6A4A38', WRAP = '#352838';
/** The look his drawn face is made from (glowing pink eyes; infernling: dark lips). */
export const KAVIK_LOOK: FigureLook = { skin: SKIN, hair: HAIR, primary: CLOTH, secondary: CLOTH, boots: WRAP, eyes: '#FF8AE8', species: 'infernling' };

// Bone pivots in metres for a 1.85 m figure (realistic: hips at 0.95, knees at 0.52, shoulders at 1.49).
const RIG: Record<BoneName, [BoneName | null, [number, number, number]]> = {
  root: [null, [0, 0, 0]], hips: ['root', [0, 1.0, 0]], spine: ['hips', [0, 1.05, 0]], head: ['spine', [0, 1.58, 0]],
  armN: ['spine', [-0.2, 1.49, 0]], foreN: ['armN', [-0.235, 1.18, 0]], armP: ['spine', [0.2, 1.49, 0]], foreP: ['armP', [0.235, 1.18, 0]],
  thighN: ['hips', [-0.095, 0.95, 0]], shinN: ['thighN', [-0.1, 0.52, 0]], thighP: ['hips', [0.095, 0.95, 0]], shinP: ['thighP', [0.1, 0.52, 0]],
};

export function buildKavik(height = 1.85): THREE.Group {
  const U = height / 1.85;
  const parts: [THREE.BufferGeometry, string, BoneName][] = [];
  const put = (g: THREE.BufferGeometry, bone: BoneName, x: number, y: number, z: number, color: string,
    rot: [number, number, number] = [0, 0, 0], scale: [number, number, number] = [1, 1, 1]) => {
    g.scale(...scale);
    if (rot[1]) g.rotateY(rot[1]);
    if (rot[0]) g.rotateX(rot[0]);
    if (rot[2]) g.rotateZ(rot[2]);
    g.scale(U, U, U);
    g.translate(x * U, y * U, z * U);
    parts.push([g, color, bone]);
  };
  // A tapered limb from (x1,y1) to (x2,y2) in the XY plane, 7 sides.
  const seg = (bone: BoneName, x1: number, y1: number, x2: number, y2: number, r1: number, r2: number, color: string, z = 0, sides = 7, sz = 1) => {
    const len = Math.hypot(x2 - x1, y2 - y1), ang = Math.atan2(x2 - x1, y1 - y2);
    put(new THREE.CylinderGeometry(r1, r2, len, sides), bone, (x1 + x2) / 2, (y1 + y2) / 2, z, color, [0, 0, ang], [1, 1, sz]);
  };
  const box = (bone: BoneName, w: number, h: number, d: number, x: number, y: number, z: number, color: string, rot: [number, number, number] = [0, 0, 0]) =>
    put(new THREE.BoxGeometry(w, h, d), bone, x, y, z, color, rot);
  const ball = (bone: BoneName, r: number, x: number, y: number, z: number, color: string, scale: [number, number, number] = [1, 1, 1], w = 7, h = 5) =>
    put(new THREE.SphereGeometry(r, w, h), bone, x, y, z, color, [0, 0, 0], scale);

  for (const s of [-1, 1]) {
    const side = s < 0 ? 'N' : 'P', thigh = `thigh${side}` as BoneName, shin = `shin${side}` as BoneName;
    const arm = `arm${side}` as BoneName, fore = `fore${side}` as BoneName;
    // Hakama: baggy thighs, ballooning over the knee, gathered into the leg wraps.
    seg(thigh, s * 0.095, 0.97, s * 0.105, 0.55, 0.095, 0.115, CLOTH, 0, 8);
    seg(shin, s * 0.1, 0.56, s * 0.1, 0.4, 0.118, 0.085, CLOTH, 0.005, 8);
    // Knee-high leg wraps with a tie, tabi feet in rope sandals.
    seg(shin, s * 0.1, 0.42, s * 0.1, 0.1, 0.058, 0.045, WRAP, 0, 7);
    seg(shin, s * 0.1, 0.415, s * 0.1, 0.395, 0.064, 0.064, '#6A4A6A', 0, 7);
    box(shin, 0.03, 0.05, 0.02, s * 0.1, 0.39, 0.065, '#6A4A6A');
    box(shin, 0.085, 0.07, 0.22, s * 0.1, 0.055, 0.045, WRAP);
    box(shin, 0.1, 0.018, 0.27, s * 0.1, 0.009, 0.045, SOLE);
    box(shin, 0.1, 0.012, 0.02, s * 0.1, 0.07, 0.1, SOLE, [0.3, 0, 0]);
    // Upper arm: the robe's sleeve on his right (-X), bare skin with an arm band on his left (+X).
    seg(arm, s * 0.2, 1.5, s * 0.235, 1.2, 0.055, 0.044, SKIN, 0, 7);
    if (s < 0) seg(arm, -0.2, 1.53, -0.225, 1.32, 0.078, 0.07, CLOTH, 0, 8);
    else seg(arm, 0.215, 1.39, 0.22, 1.35, 0.06, 0.058, CLOTH, 0, 8);
    ball(arm, 0.072, s * 0.18, 1.475, 0, s < 0 ? CLOTH : SKIN, [1, 0.85, 0.9]);   // shoulder
    // Forearm in a leather bracer, a long hand.
    seg(fore, s * 0.235, 1.19, s * 0.25, 0.93, 0.044, 0.034, SKIN, 0, 7);
    seg(fore, s * 0.238, 1.14, s * 0.25, 0.94, 0.052, 0.041, LEATHER, 0, 7);
    box(fore, 0.04, 0.1, 0.075, s * 0.252, 0.87, 0.005, SKIN, [0, 0, s * -0.05]);
    box(fore, 0.03, 0.07, 0.06, s * 0.254, 0.79, 0.01, SKIN, [0, 0, s * -0.05]);
    box(fore, 0.022, 0.05, 0.025, s * 0.238, 0.86, 0.04, SKIN);                      // thumb
  }

  // Torso: V-taper, bare chest and abdomen, pecs.
  seg('spine', 0, 1.1, 0, 1.52, 0.135, 0.19, SKIN, 0, 8, 0.62);
  for (const s of [-1, 1]) ball('spine', 0.085, s * 0.07, 1.39, 0.06, SKIN, [1.1, 0.7, 0.5]);
  ball('spine', 0.13, 0, 1.495, 0, SKIN, [1.45, 0.4, 0.72]);   // trapezius / shoulder line
  seg('spine', 0, 1.56, 0, 1.64, 0.05, 0.056, SKIN, 0, 7);     // neck
  // The wrap top over his right side and the back, open on his left chest; a dark lapel along the edge.
  put(new THREE.CylinderGeometry(0.205, 0.148, 0.44, 12, 1, true, Math.PI * 0.55, Math.PI * 1.45), 'spine', 0, 1.31, 0, CLOTH, [0, 0, 0], [1, 1, 0.68]);
  box('spine', 0.035, 0.46, 0.02, -0.01, 1.31, 0.125, DARK, [0, 0, 0.42]);
  box('spine', 0.035, 0.5, 0.02, 0.0, 1.3, -0.128, DARK, [0, 0, -0.5]);   // strap across the back

  // Obi sash with a hanging front knot and the big looped bow at the back.
  seg('hips', 0, 1.0, 0, 1.12, 0.158, 0.15, OBI, 0, 10, 0.72);
  box('hips', 0.06, 0.06, 0.04, 0.02, 1.05, 0.12, OBI);
  box('hips', 0.04, 0.2, 0.02, 0.0, 0.93, 0.125, OBI, [0, 0, 0.08]);
  box('hips', 0.04, 0.24, 0.02, 0.045, 0.91, 0.125, OBI, [0, 0, -0.1]);
  for (const [x, y, rz] of [[-0.07, 1.08, 0.5], [0.07, 1.08, -0.5], [-0.06, 1.01, -0.6], [0.06, 1.01, 0.6]]) {
    put(new THREE.TorusGeometry(0.045, 0.016, 4, 7), 'hips', x, y, -0.13, OBI, [0, 0, rz], [1.2, 0.8, 0.7]);
  }
  ball('hips', 0.03, 0, 1.05, -0.13, OBI);
  // Robe skirt to the knee, open at the front over a dark apron panel.
  put(new THREE.CylinderGeometry(0.158, 0.235, 0.46, 12, 1, true, Math.PI * 0.12, Math.PI * 1.76), 'hips', 0, 0.78, 0, CLOTH, [0, 0, 0], [1, 1, 0.8]);
  box('hips', 0.17, 0.4, 0.015, 0, 0.8, 0.135, DARK, [-0.12, 0, 0]);

  // Head (~0.245 m, 1/7.5 of his height): a low-poly skull, jaw, nose, pointed ears, horns, hair and bun.
  // His eyes, brows and mouth are the drawn face (below).
  ball('head', 0.1, 0, 1.75, -0.005, SKIN, [0.92, 1.08, 1.05], 10, 7);
  box('head', 0.12, 0.07, 0.11, 0, 1.655, 0.03, SKIN, [0.15, 0, 0]);            // jaw
  box('head', 0.03, 0.04, 0.03, 0, 1.715, 0.105, SKIN, [-0.3, 0, 0]);          // nose
  for (const s of [-1, 1]) {
    put(new THREE.ConeGeometry(0.022, 0.11, 4), 'head', s * 0.1, 1.76, -0.01, SKIN, [0.2, 0, s * -1.05], [1, 1, 0.45]);   // pointed ear
    put(new THREE.ConeGeometry(0.02, 0.09, 5), 'head', s * 0.05, 1.86, 0.03, HORN, [-0.25, 0, s * -0.3]);
    put(new THREE.ConeGeometry(0.012, 0.06, 5), 'head', s * 0.07, 1.92, 0.015, HORN, [-0.55, 0, s * -0.15]);
  }
  ball('head', 0.104, 0, 1.775, -0.02, HAIR, [0.95, 0.9, 1.05], 8, 5);           // hair, swept back
  box('head', 0.15, 0.03, 0.03, 0, 1.83, 0.075, HAIR, [-0.5, 0, 0]);
  ball('head', 0.045, 0, 1.83, -0.11, HAIR, [1, 1, 0.9]);                        // bun
  ball('head', 0.02, 0, 1.83, -0.155, '#8A3A7A');

  // Skeleton (as buildFigure, on its own pivots).
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
  const kindOf = (c: string): PaintKind => c === SKIN ? 'skin' : c === HAIR ? 'hair' : c === LEATHER || c === SOLE || c === WRAP ? 'leather' : c === HORN ? 'metal' : 'cloth';
  const colours = [...new Set(parts.map(([, c]) => c))];
  const atlas = paintedAtlas(colours.map((c) => ({ color: c, kind: kindOf(c) })));
  for (const [g, c] of parts) toTile(g, atlas.rect(c));
  const geo = mergeGeometries(parts.map(([g, , b]) => rigged(painted(g, '#FFFFFF', 0, height), BONES.indexOf(b))));
  const mesh = new THREE.SkinnedMesh(geo, new THREE.MeshBasicMaterial({ vertexColors: true, map: atlas.texture, side: THREE.DoubleSide }));   // open robe shells
  mesh.name = 'figure-body';
  mesh.add(bones.root);
  mesh.bind(new THREE.Skeleton(BONES.map((n) => bones[n])));
  mesh.frustumCulled = false;
  const root = new THREE.Group();
  root.add(mesh);
  // The drawn face over the front of his skull (0.184 m wide), as on every figure.
  const headW = 0.184, face = new THREE.Mesh(new THREE.PlaneGeometry(FACE.w * headW * U, FACE.h * headW * U), faceMaterial());
  face.name = 'figure-face';
  face.position.set(0, (1.75 - FACE.drop * headW - RIG.head[1][1]) * U, 0.104 * U);
  face.raycast = () => {};
  bones.head.add(face);
  root.userData.face = face;
  root.userData.look = KAVIK_LOOK;
  root.add(blobShadow(0.32 * U));
  root.userData.height = height;
  root.userData.tris = geo.attributes.position.count / 3;
  spriteFigure(root);
  root.userData.rig = { bones, rest, mesh } satisfies FigureRig;
  return root;
}
