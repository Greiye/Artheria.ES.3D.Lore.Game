import * as THREE from 'three';
import type { FigureLook } from '../world/figure';

// Faces (realistic figures, 2026-10-29): every figure has a low-poly 3D head; its face is drawn, on a quad over the
// skull's front (src/world/figure.ts, src/render/sprites.ts). A face sheet has one row per expression (neutral, blink,
// talk-a, talk-b, …); the game shows each row's front cell, and an expression change only moves the quad's UVs,
// like Mega Man Legends' face textures.
// Hand-drawn sheets go in src/art/heads/ (see README.md there): <id>-face.png with an optional Aseprite JSON
// (<id>-face.json). A look with `art: '<id>'` uses them, inlined into the build. Every other look gets a sheet in the
// same layout drawn here in code, in "head units" (1 u = one head diameter = U_PX pixels).
// (The 2D head sheets, <id>.png, belonged to the chibi look and are no longer used.)

const U_PX = 40;
export const SHEET = { w: 2.4, h: 2.6, top: 1.0 };   // frame size in head units; head centre 1.0 u below the top
// Realistic figures' face quad: the part of a face cell it shows (head units), centred FACE.drop u below the head's
// centre. The cell is 2.4 × 2.6 u, so this is its middle 1.2 × 1.2 u: eyes, brows, nose line and mouth.
export const FACE = { w: 1.2, h: 1.2, drop: 0.15 };
const FW = Math.round(SHEET.w * U_PX), FH = Math.round(SHEET.h * U_PX);   // 96 × 104 px cells
const EXPRESSIONS = ['neutral', 'blink', 'talk-a', 'talk-b'];   // face rows when a sheet has no JSON

/** A frame in UV space, ready for the billboard: uv * (sx, sy) + (ox, oy). */
export type Frame = [number, number, number, number];
export interface HeadArt {
  face: THREE.Texture | null;
  faces: Map<string, Frame>;                 // expression → its front cell
}

interface AseFrame { frame: { x: number; y: number; w: number; h: number } }
interface AseSheet { frames: Record<string, AseFrame> | AseFrame[]; meta: { size: { w: number; h: number }; frameTags?: { name: string; from: number; to: number }[] } }

const PNG = import.meta.glob('../art/heads/*-face.png', { eager: true, query: '?url', import: 'default' }) as Record<string, string>;
const JSONS = import.meta.glob('../art/heads/*-face.json', { eager: true, import: 'default' }) as Record<string, AseSheet>;
const fileOf = (name: string) => `../art/heads/${name}`;
/** Ids that have a hand-drawn face sheet in src/art/heads/. */
const drawnFaces = Object.keys(PNG).map((k) => k.split('/').pop()!.slice(0, -'-face.png'.length));

const EYE: Record<string, string[]> = {
  round:  ['kkkkkk.', 'kkkkkkk', 'kwhhiik', 'kwhddik', 'kwiddik', 'kwiddik', 'kwlddik', 'kwllilk', '.kllll.', '..kkk..'],
  sleepy: ['......', '......', '......', 'kkkkkk', 'kiddik', 'kliilk', '.kkkk.', '......'],
  slit:   ['.kkkk.', 'kkkkkk', 'khiiik', 'kiidik', 'kiidik', 'kiidik', 'kliilk', '.kllk.'],
  owl:    ['.wwww.', 'wiiiiw', 'iikkii', 'iikkhi', 'iikkii', 'iikkii', 'wiiiiw', '.wwww.'],
};

const hex = (c: THREE.Color) => '#' + c.getHexString();
const tone = (col: string, k: number) => hex(new THREE.Color(col).multiplyScalar(k));

const pixelTex = <T extends THREE.Texture>(t: T): T => {
  t.colorSpace = THREE.SRGBColorSpace;
  t.magFilter = t.minFilter = THREE.NearestFilter;
  t.generateMipmaps = false;
  return t;
};
// A pixel rect on a W × H sheet as a UV frame (textures are flipped, so v runs up from the bottom).
const uvFrame = (x: number, y: number, w: number, h: number, W: number, H: number): Frame => [w / W, h / H, x / W, 1 - (y + h) / H];
type Px = [number, number, number, number];
const cell = (f: Px, W: number, H: number) => uvFrame(f[0], f[1], f[2], f[3], W, H);

function aseFrames(j: AseSheet): Px[] {
  const list = Array.isArray(j.frames) ? j.frames : Object.values(j.frames);
  return list.map(({ frame: f }) => [f.x, f.y, f.w, f.h]);
}
function grid(W: number, row: number): Px[] {
  return Array.from({ length: Math.max(1, Math.floor(W / FW)) }, (_, i) => [i * FW, row * FH, FW, FH]);
}

const cache = new Map<string, HeadArt>();

/** The face art for a look: its hand-drawn sheet when `look.art` names one, otherwise drawn here. */
export function headArt(look: FigureLook): HeadArt {
  const key = look.art && drawnFaces.includes(look.art) ? 'art:' + look.art : JSON.stringify(look);
  let art = cache.get(key);
  if (!art) { art = key.startsWith('art:') ? loadArt(look.art!, generated(look)) : generated(look); cache.set(key, art); }
  return art;
}

// Hand-drawn sheets load asynchronously (inlined data URLs, so it's near-instant); the drawn face shows until then.
function loadArt(id: string, fallback: HeadArt): HeadArt {
  const art: HeadArt = { ...fallback, faces: new Map(fallback.faces) };
  new THREE.TextureLoader().load(PNG[fileOf(id + '-face.png')], (t) => {
    const { width: W, height: H } = t.image as HTMLImageElement, j = JSONS[fileOf(id + '-face.json')];
    const faces = new Map<string, Frame>();
    if (j?.meta.frameTags?.length) {
      const all = aseFrames(j);
      for (const tag of j.meta.frameTags) faces.set(tag.name, cell(all[tag.from], W, H));
    } else {
      for (let row = 0; row * FH < H; row++) faces.set(EXPRESSIONS[row] ?? `row${row}`, cell(grid(W, row)[0], W, H));
    }
    art.faces = faces;
    art.face = pixelTex(t);
  });
  return art;
}

// The drawn fallback: a face sheet with a row per expression (the front cell only; the 3D head does the turning).
function generated(look: FigureLook): HeadArt {
  const fc = document.createElement('canvas'); fc.width = FW; fc.height = FH * EXPRESSIONS.length;
  const fg = fc.getContext('2d')!;
  EXPRESSIONS.forEach((e, row) => drawFace(fg, 0, row * FH, look, e));
  const faces = new Map<string, Frame>();
  EXPRESSIONS.forEach((e, row) => faces.set(e, cell(grid(fc.width, row)[0], fc.width, fc.height)));
  return { face: pixelTex(new THREE.CanvasTexture(fc)), faces };
}

// The front face cell: pixel eyes stamped at whole-pixel positions, brows, blush and mouth, plus species details.
function drawFace(g: CanvasRenderingContext2D, x0: number, y0: number, L: FigureLook, expr: string) {
  const u = U_PX, r = u / 2, cx = x0 + FW / 2, cy = y0 + SHEET.top * u, sp = L.species ?? 'human';
  const rect = (x: number, y: number, w: number, h: number, col: string) => { g.fillStyle = col; g.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h)); };
  const es = L.eyeStyle ?? (sp === 'owlkin' || sp === 'corvani' ? 'owl' : sp === 'drakari' ? 'slit' : 'round');
  const base = new THREE.Color(L.eyes ?? (es === 'owl' ? '#E0A020' : '#4A6A8A'));
  const pal: Record<string, string> = { k: '#2A2026', w: '#FFF8EC', h: '#FFFFFF', i: hex(base), d: hex(base.clone().multiplyScalar(0.5)), l: hex(base.clone().lerp(new THREE.Color('#FFFFFF'), 0.45)) };
  const stamp = EYE[es] ?? EYE.round, sw = stamp[0].length, sh = stamp.length, k = Math.max(1, Math.round(u / 20));
  const eyeY = Math.round(cy + r * 0.2);
  for (const s of [-1, 1]) {
    const ex = Math.round(cx + s * r * 0.4 - (sw * k) / 2);
    if (expr === 'blink') rect(ex, eyeY + k, sw * k, k, pal.k);   // closed: a lash line
    else stamp.forEach((row, y) => [...row].forEach((ch, x) => {
      if (ch !== '.') rect(ex + (s < 0 ? x : sw - 1 - x) * k, eyeY - (sh * k) / 2 + y * k, k, k, pal[ch]);
    }));
    if (es !== 'owl') rect(ex + (s < 0 ? 0 : k), eyeY - (sh * k) / 2 - 3 * k, (sw - 2) * k, 1, tone(L.hair, 0.55));   // brow, a thin stroke
  }
  const bl = 'rgba(240,140,140,0.55)';
  rect(cx - r * 0.6 - 2 * k, eyeY + 6 * k, 3 * k, k, bl); rect(cx + r * 0.6 - k, eyeY + 6 * k, 3 * k, k, bl);
  const lip = sp === 'infernling' || sp === 'drakari' ? '#3A1A1A' : '#8A3A34';
  if (expr === 'talk-a') rect(cx - k, eyeY + 7 * k, 2 * k, 2 * k, '#4A1E24');
  else if (expr === 'talk-b') { rect(cx - k - 1, eyeY + 7 * k, 2 * k + 2, 3 * k, '#4A1E24'); rect(cx - k + 1, eyeY + 9 * k, 2 * k - 2, k, '#C8606A'); }
  else rect(cx - k, eyeY + 8 * k, 2 * k, k, lip);
  if (L.marks) for (const [dx, dy] of [[-0.55, 0.5], [-0.45, 0.58], [0.45, 0.5], [0.55, 0.58]]) rect(cx + dx * r, cy + dy * r, k, k, L.marks);
}
