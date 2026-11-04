import * as THREE from 'three';
import { figureLight } from './figure';
import { GREEN, TOWN_LOTS, type TownId } from './town';
import { route, doorStep, clearPath } from './townsfolk';

// Town style 1 (Mike 2026-11-04, Graphics thread: "I want it to look like this. Loads of sprites", "But I still want
// 3D NPCs"): a crowd of small 2D pixel-sprite townsfolk in 8 directions fills the town. The player, named NPCs and
// the role townsfolk (band, dojo, store, gossips) stay 3D; the crowd is the background. Our own art: every frame is
// painted here, pixel by pixel, from a few palettes (16×24 px, a 3-frame walk and a standing frame).
// One instanced quad for every sprite (1 draw call) plus one for their blob shadows, so phones can carry dozens.
// Sprites stand upright and turn to the camera; the frame picks which of the 8 painted directions faces you.

const W = 16, H = 24;                 // pixels per frame
const DIRS = 8, FRAMES = 4;           // frames: 0-2 walk, 3 stand
const COLS = DIRS * FRAMES;
const HEIGHT = 1.62;                  // metres tall
const WIDTH = HEIGHT * W / H;
export const CROWD_FULL = 44, CROWD_LOW = 16;

interface Palette { skin: string; hair: string; top: string; trim: string; legs: string; shoe: string; hat?: string; hood?: boolean; apron?: string; skirt?: boolean }
const SKIN = ['#F2C8A0', '#E0AC84', '#C68A62', '#9A6444', '#7A4A30', '#F6D8BC'];
const HAIR = ['#2A1E16', '#5A3420', '#8A5A2A', '#C89A4A', '#E8E0C8', '#3A2A3A', '#A0402A'];
const TOP = ['#8A3A2A', '#2E5A7A', '#4F7A3A', '#7A5A2E', '#5A3A6A', '#B08A3A', '#3A6A6A', '#A85A3A', '#6A6A5A'];
const LEGS = ['#3A3428', '#4A3A2A', '#2A3440', '#5A4A3A', '#3A3A3A'];
const HAT = ['#5A3A22', '#2A2A2A', '#8A6A3A', '#6A2A2A'];
const INK = '#1E1612';
function palettes(n: number): Palette[] {
  const out: Palette[] = [];
  let s = 7;
  const r = () => { s = (s * 16807) % 2147483647; return s / 2147483647; };
  const pick = <T,>(a: T[]) => a[Math.floor(r() * a.length)];
  for (let i = 0; i < n; i++) {
    const top = pick(TOP);
    out.push({
      skin: pick(SKIN), hair: pick(HAIR), top, trim: shade(top, 1.35), legs: pick(LEGS), shoe: '#2A1E16',
      hat: r() < 0.35 ? pick(HAT) : undefined, hood: r() < 0.15, apron: r() < 0.25 ? '#D8CBA6' : undefined, skirt: r() < 0.4,
    });
  }
  return out;
}
function shade(hex: string, k: number) { const c = new THREE.Color(hex).multiplyScalar(k); return '#' + c.getHexString(); }

/**
 * Paint one frame. `d` is the direction the figure faces relative to you: 0 toward you, 2 to your right, 4 away,
 * 6 to your left (odd = diagonals). Left-facing frames are mirrors of right-facing ones.
 */
function paint(g: CanvasRenderingContext2D, ox: number, oy: number, p: Palette, d: number, frame: number) {
  const mirror = d >= 5;
  const v = mirror ? 8 - d : d;          // 0 front, 1 front-diag, 2 side, 3 back-diag, 4 back
  const px = new Map<string, string>();
  const put = (x: number, y: number, c: string) => { if (x >= 0 && x < W && y >= 0 && y < H) px.set(`${x},${y}`, c); };
  const rect = (x0: number, y0: number, w: number, h: number, c: string) => { for (let y = y0; y < y0 + h; y++) for (let x = x0; x < x0 + w; x++) put(x, y, c); };
  const walk = frame < 3, step = frame === 0 ? 1 : frame === 2 ? -1 : 0;
  const side = v === 2, narrow = v === 2 || v === 1 || v === 3;
  // Legs and shoes.
  const legTop = 16;
  if (side) {
    // Seen from the side: the legs scissor.
    const a = walk ? step : 0;
    rect(7 + a, legTop, 2, 6, p.legs); rect(7 - a, legTop, 2, 6, shade(p.legs, 0.8));
    rect(7 + a, 22, 3, 1, p.shoe); rect(7 - a, 22, 3, 1, p.shoe);
  } else {
    const lift = walk ? step : 0;
    rect(6, legTop, 2, 6 - Math.max(0, lift), p.legs); rect(8, legTop, 2, 6 - Math.max(0, -lift), shade(p.legs, 0.85));
    rect(6, 22 - Math.max(0, lift), 2, 1, p.shoe); rect(8, 22 - Math.max(0, -lift), 2, 1, p.shoe);
  }
  // Body (a skirt or tunic hem flares a pixel).
  const bx = narrow ? 5 : 4, bw = narrow ? 6 : 8;
  rect(bx, 9, bw, 7, p.top);
  if (p.skirt) rect(bx - 1, 14, bw + 2, 3, p.top);
  rect(bx, 9, bw, 1, p.trim);
  if (p.apron && v <= 2) rect(v === 2 ? 9 : 6, 11, v === 2 ? 2 : 4, 5, p.apron);
  rect(bx, 13, bw, 1, shade(p.top, 0.7));   // belt
  // Arms swing opposite the legs.
  const sw = walk ? -step : 0;
  if (side) { rect(8 + sw, 10, 2, 5, shade(p.top, 0.85)); put(8 + sw, 15, p.skin); }
  else {
    rect(bx - 1, 10 + Math.max(0, sw), 1, 5, shade(p.top, 0.85)); rect(bx + bw, 10 + Math.max(0, -sw), 1, 5, shade(p.top, 0.85));
    put(bx - 1, 15 + Math.max(0, sw), p.skin); put(bx + bw, 15 + Math.max(0, -sw), p.skin);
  }
  // Head.
  rect(5, 3, 6, 6, p.skin);
  const hair = p.hood ? p.top : p.hair;
  if (v === 4) rect(5, 2, 6, 7, hair);                         // back: all hair
  else if (v === 3) { rect(5, 2, 6, 5, hair); rect(5, 7, 4, 2, hair); }
  else {
    rect(5, 2, 6, 2, hair);                                    // fringe
    if (v === 0) { put(5, 4, hair); put(10, 4, hair); }
    if (v === 1) { rect(5, 4, 2, 3, hair); }
    if (v === 2) { rect(5, 4, 3, 4, hair); }
    // Eyes and a mouth hint.
    if (v === 0) { put(6, 5, INK); put(9, 5, INK); put(7, 7, shade(p.skin, 0.8)); put(8, 7, shade(p.skin, 0.8)); }
    if (v === 1) { put(8, 5, INK); put(10, 5, INK); put(9, 7, shade(p.skin, 0.8)); }
    if (v === 2) { put(9, 5, INK); put(10, 6, shade(p.skin, 0.85)); }
  }
  if (p.hood) { rect(4, 2, 1, 6, hair); rect(11, 2, 1, 6, hair); }
  if (p.hat) { rect(4, 2, 8, 1, p.hat); rect(5, 0, 6, 2, p.hat); }
  // Ink outline round the silhouette, then the frame (mirrored for left-facing).
  const filled = new Set(px.keys());
  for (const k of filled) {
    const [x, y] = k.split(',').map(Number);
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const n = `${x + dx},${y + dy}`; if (!filled.has(n) && x + dx >= 0 && x + dx < W && y + dy >= 0 && y + dy < H) px.set(n, INK); }
  }
  for (const [k, c] of px) {
    const [x, y] = k.split(',').map(Number);
    g.fillStyle = c; g.fillRect(ox + (mirror ? W - 1 - x : x), oy + y, 1, 1);
  }
}

export function crowdAtlas(looks: number): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = COLS * W; c.height = looks * H;
  const g = c.getContext('2d')!;
  const pals = palettes(looks);
  pals.forEach((p, row) => { for (let d = 0; d < DIRS; d++) for (let f = 0; f < FRAMES; f++) paint(g, (d * FRAMES + f) * W, row * H, p, d, f); });
  return c;
}

const vert = /* glsl */`
attribute vec2 aCell;
uniform vec2 cell;
varying vec2 vUv;
#include <common>
#include <fog_pars_vertex>
void main() {
  vec4 centre = modelMatrix * instanceMatrix * vec4(0.0, 0.0, 0.0, 1.0);
  float sx = length(instanceMatrix[0].xyz), sy = length(instanceMatrix[1].xyz);
  vec3 r = vec3(viewMatrix[0][0], viewMatrix[1][0], viewMatrix[2][0]);
  r = normalize(vec3(r.x, 0.0, r.z) + vec3(1e-5, 0.0, 0.0));   // upright: turn to the camera about the vertical only
  vec3 wp = centre.xyz + r * position.x * sx + vec3(0.0, position.y * sy, 0.0);
  vec4 mvPosition = viewMatrix * vec4(wp, 1.0);
  gl_Position = projectionMatrix * mvPosition;
  vUv = vec2((aCell.x + uv.x) * cell.x, 1.0 - (aCell.y + 1.0 - uv.y) * cell.y);
  #include <fog_vertex>
}`;
const frag = /* glsl */`
uniform sampler2D map;
uniform vec3 shade;
varying vec2 vUv;
#include <common>
#include <fog_pars_fragment>
void main() {
  vec4 c = texture2D(map, vUv);
  if (c.a < 0.5) discard;
  gl_FragColor = vec4(c.rgb * shade, 1.0);
  #include <colorspace_fragment>
  #include <fog_fragment>
}`;

interface Agent { pos: THREE.Vector3; route: THREE.Vector3[]; i: number; speed: number; look: number; phase: number; wait: number; heading: number; lane: number; at: TownId | null; stander: boolean }

export class Crowd {
  readonly mesh: THREE.InstancedMesh;
  readonly shadows: THREE.InstancedMesh;
  readonly agents: Agent[] = [];
  readonly looks: number;
  private cells: THREE.InstancedBufferAttribute;
  private t = 0;
  private m = new THREE.Matrix4();
  private q = new THREE.Quaternion();
  private s = new THREE.Vector3(WIDTH, HEIGHT, 1);
  private shadowS = new THREE.Vector3(1, 1, 1);
  count = CROWD_FULL;

  constructor(scene: THREE.Scene, looks = 12) {
    this.looks = looks;
    const tex = new THREE.CanvasTexture(crowdAtlas(looks));
    tex.magFilter = THREE.NearestFilter; tex.minFilter = THREE.NearestFilter; tex.generateMipmaps = false; tex.colorSpace = THREE.SRGBColorSpace;
    const geo = new THREE.PlaneGeometry(1, 1).translate(0, 0.5, 0);
    this.cells = new THREE.InstancedBufferAttribute(new Float32Array(CROWD_FULL * 2), 2);
    this.cells.setUsage(THREE.DynamicDrawUsage);
    geo.setAttribute('aCell', this.cells);
    const mat = new THREE.ShaderMaterial({
      uniforms: THREE.UniformsUtils.merge([THREE.UniformsLib.fog, { map: { value: tex }, cell: { value: new THREE.Vector2(1 / COLS, 1 / looks) } }]),
      vertexShader: vert, fragmentShader: frag, fog: true,
    });
    mat.uniforms.map.value = tex;
    mat.uniforms.shade = figureLight.shade;   // the hour dims them like the 3D characters (B43)
    this.mesh = new THREE.InstancedMesh(geo, mat, CROWD_FULL);
    this.mesh.name = 'crowd'; this.mesh.frustumCulled = false; this.mesh.raycast = () => {};
    this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    const sh = new THREE.CircleGeometry(0.32, 10).rotateX(-Math.PI / 2).translate(0, 0.02, 0).scale(1, 1, 0.6);
    this.shadows = new THREE.InstancedMesh(sh, new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.28, depthWrite: false }), CROWD_FULL);
    this.shadows.name = 'crowdShadows'; this.shadows.frustumCulled = false; this.shadows.raycast = () => {};
    this.shadows.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    scene.add(this.mesh, this.shadows);
    // Walkers spread over the green on lanes either side of the 3D walkers' loop; a few stand about.
    for (let n = 0; n < CROWD_FULL; n++) {
      const a = (n / CROWD_FULL) * Math.PI * 2 + Math.random() * 0.2, stander = n % 4 === 3;
      // Lanes inside the 3D walkers' loop (outside it the lots come close on the south side).
      const lane = stander ? -1.2 - Math.random() * 2.4 : -0.2 - Math.random() * 2.2;
      const pos = this.onLoop(a, lane);
      const at = TOWN_LOTS[n % TOWN_LOTS.length].id;
      this.agents.push({ pos, route: [], i: 0, speed: 1.05 + Math.random() * 0.5, look: n % looks, phase: Math.random() * 3, wait: Math.random() * 3, heading: Math.random() * Math.PI * 2, lane, at, stander });
    }
    this.setCount(CROWD_FULL);
  }

  private onLoop(a: number, lane: number) {
    const rx = 15 + lane, rz = 3.6 + lane * 0.4;
    return new THREE.Vector3(GREEN.x + rx * Math.sin(a), 0, GREEN.z - rz * Math.cos(a));
  }
  /** Fewer on the Low preset. */
  setCount(n: number) { this.count = Math.max(0, Math.min(CROWD_FULL, n)); this.mesh.count = this.shadows.count = this.count; }

  /** The direction cell (0 toward the camera … 7) for a heading seen from `cam`. */
  static dirFor(heading: number, x: number, z: number, cam: THREE.Vector3) {
    const toCam = Math.atan2(cam.x - x, cam.z - z);
    const rel = Math.atan2(Math.sin(heading - toCam), Math.cos(heading - toCam));
    return ((Math.round(rel / (Math.PI / 4)) % 8) + 8) % 8;
  }

  update(dt: number, cam: THREE.Vector3) {
    this.t += dt;
    for (let k = 0; k < this.count; k++) {
      const a = this.agents[k];
      let moving = false;
      if (a.stander) {
        // Standing about: turn now and then to look around.
        if ((a.wait -= dt) <= 0) { a.heading += (Math.random() - 0.5) * 2.4; a.wait = 2 + Math.random() * 4; }
      } else if (a.i >= a.route.length) {
        if ((a.wait -= dt) <= 0) {
          const others = TOWN_LOTS.filter((l) => l.id !== a.at), next = others[Math.floor(Math.random() * others.length)].id;
          // The 3D walkers' path (it bends round the buildings' corners), pushed in onto this walker's lane.
          a.route = route(a.pos, doorStep(next)).map((p, i, all) => {
            if (i === all.length - 1) return p;
            const dx = GREEN.x - p.x, dz = GREEN.z - p.z, d = Math.hypot(dx, dz) || 1, k = Math.min(-a.lane, d * 0.5);
            return new THREE.Vector3(p.x + dx / d * k, 0, p.z + dz / d * k);
          });
          clearPath(a.route.slice(0, -1));   // the lane may bring a step close to a building or the well again
          a.i = 0; a.at = next; a.wait = 1.5 + Math.random() * 5;
        }
      } else {
        const goal = a.route[a.i], dx = goal.x - a.pos.x, dz = goal.z - a.pos.z, d = Math.hypot(dx, dz), step = a.speed * dt;
        a.heading = Math.atan2(dx, dz);
        if (d <= step) { a.pos.set(goal.x, 0, goal.z); a.i++; } else { a.pos.x += dx / d * step; a.pos.z += dz / d * step; }
        moving = true;
      }
      const dir = Crowd.dirFor(a.heading, a.pos.x, a.pos.z, cam);
      const frame = moving ? Math.floor(this.t * 7 * a.speed + a.phase) % 4 : 3;
      const walkFrame = frame === 3 ? 1 : frame;   // 0,1,2,1: step, pass, step, pass
      this.cells.setXY(k, dir * FRAMES + (moving ? walkFrame : 3), a.look);
      this.m.compose(a.pos, this.q, this.s); this.mesh.setMatrixAt(k, this.m);
      this.m.compose(a.pos, this.q, this.shadowS); this.shadows.setMatrixAt(k, this.m);
    }
    this.cells.needsUpdate = true;
    this.mesh.instanceMatrix.needsUpdate = true;
    this.shadows.instanceMatrix.needsUpdate = true;
  }
}
