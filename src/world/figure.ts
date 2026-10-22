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
  hairStyle?: 'spiky' | 'long' | 'hood';
  skirt?: boolean;      // coat tails / dress below the belt
}

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
  g.fillStyle = '#2B2A24'; g.fillRect(4, 6, 3, 1); g.fillRect(9, 6, 3, 1);                              // brows
  g.fillStyle = '#FFFFFF'; g.fillRect(4, 7, 3, 3); g.fillRect(9, 7, 3, 3);                              // big eyes
  g.fillStyle = look.eyes ?? '#3E7A4A'; g.fillRect(5, 7, 2, 3); g.fillRect(10, 7, 2, 3);
  g.fillStyle = '#1E2420'; g.fillRect(6, 8, 1, 2); g.fillRect(11, 8, 1, 2);
  g.fillStyle = 'rgba(0,0,0,0.25)'; g.fillRect(7, 11, 2, 1);                                            // nose shadow
  g.fillStyle = '#9A4A3A'; g.fillRect(6, 13, 4, 1);                                                     // mouth
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

// Build a figure `height` m tall, feet at y = 0, facing +Z.
export function buildFigure(look: FigureLook, height: number): THREE.Group {
  const U = height / 1.75;   // proportions authored for a 1.75 m figure
  const root = new THREE.Group();
  const parts: [THREE.BufferGeometry, string][] = [];
  const box = (w: number, h: number, d: number, x: number, y: number, z: number, color: string, rz = 0) => {
    const g = new THREE.BoxGeometry(w * U, h * U, d * U);
    if (rz) g.rotateZ(rz);
    g.translate(x * U, y * U, z * U);
    parts.push([g, color]);
  };
  // Boots: oversized, the Legends silhouette.
  box(0.2, 0.16, 0.3, -0.11, 0.08, 0.03, look.boots); box(0.2, 0.16, 0.3, 0.11, 0.08, 0.03, look.boots);
  // Shins + thighs.
  box(0.13, 0.34, 0.14, -0.11, 0.33, 0, look.secondary); box(0.13, 0.34, 0.14, 0.11, 0.33, 0, look.secondary);
  box(0.15, 0.26, 0.16, -0.1, 0.62, 0, look.secondary); box(0.15, 0.26, 0.16, 0.1, 0.62, 0, look.secondary);
  if (look.skirt) box(0.44, 0.3, 0.26, 0, 0.66, 0, look.primary);
  // Belt, torso, chest plate / shoulders.
  box(0.36, 0.07, 0.22, 0, 0.78, 0, look.accent ?? look.boots);
  box(0.34, 0.32, 0.2, 0, 0.97, 0, look.primary);
  box(0.4, 0.1, 0.24, 0, 1.13, 0, look.primary);
  // Arms: upper (primary), forearm (secondary), chunky fists (skin).
  for (const s of [-1, 1]) {
    box(0.12, 0.22, 0.13, s * 0.25, 1.0, 0, look.primary, s * 0.08);
    box(0.13, 0.2, 0.14, s * 0.27, 0.79, 0.01, look.secondary, s * 0.05);
    box(0.13, 0.12, 0.14, s * 0.28, 0.64, 0.02, look.skin);
  }
  // Neck + the big head (~1/4.4 of the height).
  box(0.1, 0.06, 0.1, 0, 1.2, 0, look.skin);
  const headY = 1.4 * U, headS = 0.36 * U;
  // Hair masses on top/back.
  if (look.hairStyle === 'hood') {
    box(0.42, 0.42, 0.4, 0, 1.42, -0.03, look.secondary);
  } else {
    box(0.4, 0.12, 0.4, 0, 1.6, -0.01, look.hair);
    box(0.4, 0.3, 0.1, 0, 1.45, -0.17, look.hair);
    if (look.hairStyle === 'long') box(0.38, 0.42, 0.1, 0, 1.25, -0.2, look.hair);
    else for (let i = -1; i <= 1; i++) box(0.1, 0.12, 0.14, i * 0.12, 1.68, -0.06 + Math.abs(i) * 0.03, look.hair, i * -0.4);
  }
  // Head: a skin box merged with the body (one draw call), plus the painted face as a thin plane on its front.
  const headBox = new THREE.BoxGeometry(headS, headS, headS * 0.95);
  headBox.translate(0, headY, 0);
  parts.push([headBox, look.skin]);
  root.add(new THREE.Mesh(mergeGeometries(parts.map(([g, c]) => painted(g, c, 0, height))), bodyMat));
  const face = new THREE.Mesh(new THREE.PlaneGeometry(headS, headS), new THREE.MeshBasicMaterial({ map: faceTexture(look) }));
  face.position.set(0, headY, headS * 0.475 + 0.002);
  root.add(face);
  root.add(blobShadow(0.38 * U));
  root.userData.height = height;
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
