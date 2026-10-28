import * as THREE from 'three';
import type { FigureLook } from '../world/figure';

// Heads are flat 2D pixel art (Tree of Savior style); there is no 3D head. Each head is two sheets:
// - head: hair, skull and headwear, one frame per direction (45° apart; 0 = facing the viewer, 1–3 turn the face
//   toward screen-left, 4 = the back). With 5 frames, 5–7 are 3–1 mirrored; with 8, each is used as drawn.
// - face: eyes and mouth over the head, one row per expression (neutral, blink, talk-a, talk-b, …), with
//   columns front, three-quarter and profile (mirrored for the other side; the back shows no face).
//   Faces swap like Mega Man Legends' face textures: changing expression only moves which frame is shown.
// Hand-drawn sheets go in src/art/heads/ (see README.md there): <id>.png and <id>-face.png, each with an optional
// Aseprite JSON (<id>.json, <id>-face.json). A look with `art: '<id>'` uses them, inlined into the build. Every
// other look gets sheets in the same layout drawn here in code, in "head units" (1 u = one head diameter =
// U_PX pixels) with 3-tone fills. The billboard shader adds the 1 px ink outline.

const U_PX = 40;
export const SHEET = { w: 2.4, h: 2.6, top: 1.0 };   // frame size in head units; head centre 1.0 u below the top
const FW = Math.round(SHEET.w * U_PX), FH = Math.round(SHEET.h * U_PX);   // 96 × 104 px
const EXPRESSIONS = ['neutral', 'blink', 'talk-a', 'talk-b'];   // face rows when a sheet has no JSON

/** A frame in UV space, ready for the billboard: uv * (sx, sy) + (ox, oy). */
export type Frame = [number, number, number, number];
export interface HeadArt {
  head: THREE.Texture;
  face: THREE.Texture | null;
  headFrames: Frame[];                       // 8, one per direction
  faces: Map<string, (Frame | null)[]>;      // expression → 8 (null = no face from there)
}

interface AseFrame { frame: { x: number; y: number; w: number; h: number } }
interface AseSheet { frames: Record<string, AseFrame> | AseFrame[]; meta: { size: { w: number; h: number }; frameTags?: { name: string; from: number; to: number }[] } }

const PNG = import.meta.glob('../art/heads/*.png', { eager: true, query: '?url', import: 'default' }) as Record<string, string>;
const JSONS = import.meta.glob('../art/heads/*.json', { eager: true, import: 'default' }) as Record<string, AseSheet>;
const fileOf = (name: string) => `../art/heads/${name}`;
/** Ids that have a hand-drawn head sheet in src/art/heads/. */
const drawnHeads = Object.keys(PNG).map((k) => k.split('/').pop()!.slice(0, -4)).filter((n) => !n.endsWith('-face'));

const EYE: Record<string, string[]> = {
  round:  ['kkkkkk.', 'kkkkkkk', 'kwhhiik', 'kwhddik', 'kwiddik', 'kwiddik', 'kwlddik', 'kwllilk', '.kllll.', '..kkk..'],
  sleepy: ['......', '......', '......', 'kkkkkk', 'kiddik', 'kliilk', '.kkkk.', '......'],
  slit:   ['.kkkk.', 'kkkkkk', 'khiiik', 'kiidik', 'kiidik', 'kiidik', 'kliilk', '.kllk.'],
  owl:    ['.wwww.', 'wiiiiw', 'iikkii', 'iikkhi', 'iikkii', 'iikkii', 'wiiiiw', '.wwww.'],
};

const hex = (c: THREE.Color) => '#' + c.getHexString();
const tone = (col: string, k: number) => hex(new THREE.Color(col).multiplyScalar(k));
const lighten = (col: string, k: number) => hex(new THREE.Color(col).lerp(new THREE.Color('#FFFFFF'), k));

const pixelTex = <T extends THREE.Texture>(t: T): T => {
  t.colorSpace = THREE.SRGBColorSpace;
  t.magFilter = t.minFilter = THREE.NearestFilter;
  t.generateMipmaps = false;
  return t;
};
// A pixel rect on a W × H sheet as a UV frame (textures are flipped, so v runs up from the bottom).
const uvFrame = (x: number, y: number, w: number, h: number, W: number, H: number, flip = false): Frame =>
  flip ? [-w / W, h / H, (x + w) / W, 1 - (y + h) / H] : [w / W, h / H, x / W, 1 - (y + h) / H];
type Px = [number, number, number, number];
const mirror = (f: Px, W: number, H: number, flip: boolean) => uvFrame(f[0], f[1], f[2], f[3], W, H, flip);

// Directions from the drawn frames: 8 as drawn, or 0–4 with 5–7 mirrored from 3–1.
function headDirs(px: Px[], W: number, H: number): Frame[] {
  if (px.length >= 8) return px.slice(0, 8).map((f) => mirror(f, W, H, false));
  return Array.from({ length: 8 }, (_, d) => d <= 4 ? mirror(px[Math.min(d, px.length - 1)], W, H, false) : mirror(px[Math.min(8 - d, px.length - 1)], W, H, true));
}
// Face directions: front, ¾ and profile (mirrored for 7 and 6); none from 3–5. 8 frames are used as drawn.
function faceDirs(px: Px[], W: number, H: number): (Frame | null)[] {
  if (px.length >= 8) return px.slice(0, 8).map((f) => mirror(f, W, H, false));
  const at = (i: number) => px[Math.min(i, px.length - 1)];
  return [mirror(at(0), W, H, false), mirror(at(1), W, H, false), mirror(at(2), W, H, false), null, null, null, mirror(at(2), W, H, true), mirror(at(1), W, H, true)];
}

function aseFrames(j: AseSheet): Px[] {
  const list = Array.isArray(j.frames) ? j.frames : Object.values(j.frames);
  return list.map(({ frame: f }) => [f.x, f.y, f.w, f.h]);
}
function grid(W: number, H: number, row: number): Px[] {
  return Array.from({ length: Math.max(1, Math.floor(W / FW)) }, (_, i) => [i * FW, row * FH, FW, FH]);
}

const cache = new Map<string, HeadArt>();

/** The head art for a look: its hand-drawn sheets when `look.art` names some, otherwise drawn here. */
export function headArt(look: FigureLook): HeadArt {
  const key = look.art && drawnHeads.includes(look.art) ? 'art:' + look.art : JSON.stringify(look);
  let art = cache.get(key);
  if (!art) { art = key.startsWith('art:') ? loadArt(look.art!, generated(look)) : generated(look); cache.set(key, art); }
  return art;
}

// Hand-drawn sheets load asynchronously (inlined data URLs, so it's near-instant); the drawn head shows until then.
function loadArt(id: string, fallback: HeadArt): HeadArt {
  const art: HeadArt = { ...fallback, faces: new Map(fallback.faces) };
  const loader = new THREE.TextureLoader();
  loader.load(PNG[fileOf(id + '.png')], (t) => {
    const { width: W, height: H } = t.image as HTMLImageElement, j = JSONS[fileOf(id + '.json')];
    art.headFrames = headDirs(j ? aseFrames(j) : grid(W, H, 0), W, H);
    art.head = pixelTex(t);
  });
  const faceUrl = PNG[fileOf(id + '-face.png')];
  if (!faceUrl) { art.face = null; art.faces = new Map(); return art; }
  loader.load(faceUrl, (t) => {
    const { width: W, height: H } = t.image as HTMLImageElement, j = JSONS[fileOf(id + '-face.json')];
    const faces = new Map<string, (Frame | null)[]>();
    if (j?.meta.frameTags?.length) {
      const all = aseFrames(j);
      for (const tag of j.meta.frameTags) faces.set(tag.name, faceDirs(all.slice(tag.from, tag.to + 1), W, H));
    } else {
      for (let row = 0; row * FH < H; row++) faces.set(EXPRESSIONS[row] ?? `row${row}`, faceDirs(grid(W, H, row).slice(0, 3), W, H));
    }
    art.faces = faces;
    art.face = pixelTex(t);
  });
  return art;
}

// The drawn fallback: 5 head frames, and a face sheet with a row per expression (3 columns).
function generated(look: FigureLook): HeadArt {
  const hc = document.createElement('canvas'); hc.width = FW * 5; hc.height = FH;
  const hg = hc.getContext('2d')!;
  for (let f = 0; f <= 4; f++) drawFrame(hg, f * FW, 0, look, f * Math.PI / 4, 'head', 'neutral');
  const fc = document.createElement('canvas'); fc.width = FW * 3; fc.height = FH * EXPRESSIONS.length;
  const fg = fc.getContext('2d')!;
  EXPRESSIONS.forEach((e, row) => { for (let f = 0; f <= 2; f++) drawFrame(fg, f * FW, row * FH, look, f * Math.PI / 4, 'face', e); });
  const faces = new Map<string, (Frame | null)[]>();
  EXPRESSIONS.forEach((e, row) => faces.set(e, faceDirs(grid(fc.width, fc.height, row), fc.width, fc.height)));
  return {
    head: pixelTex(new THREE.CanvasTexture(hc)), face: pixelTex(new THREE.CanvasTexture(fc)),
    headFrames: headDirs(grid(hc.width, hc.height, 0), hc.width, hc.height), faces,
  };
}

// a: 0 = facing the viewer, π/2 = profile facing screen-left, π = back. `part`: the head sheet or the face sheet.
function drawFrame(g: CanvasRenderingContext2D, x0: number, y0: number, L: FigureLook, a: number, part: 'head' | 'face', expr: string) {
  const u = U_PX, r = u / 2, cx = x0 + FW / 2, cy = y0 + SHEET.top * u;
  const sa = Math.sin(a), ca = Math.cos(a), back = ca < -0.3, front = ca > 0.3;
  const hair = L.hair, style = L.hairStyle ?? 'short', sp = L.species ?? 'human';
  const ell = (x: number, y: number, rx: number, ry: number, col: string) => { g.fillStyle = col; g.beginPath(); g.ellipse(x, y, Math.max(0.5, rx), Math.max(0.5, ry), 0, 0, Math.PI * 2); g.fill(); };
  const rect = (x: number, y: number, w: number, h: number, col: string) => { g.fillStyle = col; g.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h)); };
  const blob = (x: number, y: number, rx: number, ry: number, col: string) => {   // 3-tone filled lump
    ell(x, y, rx, ry, tone(col, 0.72)); ell(x - rx * 0.08, y - ry * 0.1, rx * 0.9, ry * 0.85, col); ell(x - rx * 0.3, y - ry * 0.4, rx * 0.35, ry * 0.25, lighten(col, 0.25));
  };
  // A tapered lock of hair from (x, y) to its tip `len` below, bowed sideways by `bend`, with a lit stripe.
  const lock = (x: number, y: number, w: number, len: number, bend: number, col: string) => {
    g.fillStyle = col; g.beginPath(); g.moveTo(x - w / 2, y);
    g.quadraticCurveTo(x - w / 2 + bend, y + len * 0.6, x + bend * 1.4, y + len);
    g.quadraticCurveTo(x + w / 2 + bend, y + len * 0.6, x + w / 2, y); g.closePath(); g.fill();
    g.strokeStyle = lighten(col, 0.18); g.lineWidth = 1; g.beginPath(); g.moveTo(x - w * 0.12, y + 2);
    g.quadraticCurveTo(x - w * 0.12 + bend, y + len * 0.45, x + bend * 0.9, y + len * 0.7); g.stroke();
  };
  // A sheet of long hair `w` wide hanging from `top`, its lower edge cut into `n` points, with strand shading.
  const mass = (x: number, top: number, w: number, len: number, n: number, col: string) => {
    g.fillStyle = col; g.beginPath(); g.moveTo(x - w / 2, top);
    g.lineTo(x - w * 0.6, top + len * 0.75);
    for (let i = 0; i < n; i++) {
      const x1 = x - w / 2 + (w * (i + 0.5)) / n, x2 = x - w / 2 + (w * (i + 1)) / n;
      g.lineTo(x1, top + len * (i % 2 ? 0.96 : 1)); g.lineTo(x2, top + len * 0.8);
    }
    g.lineTo(x + w * 0.6, top + len * 0.75); g.lineTo(x + w / 2, top); g.closePath(); g.fill();
    for (let i = 1; i < n; i++) {   // darker strand partings with a lit edge beside each
      const sx = x - w / 2 + (w * i) / n;
      g.strokeStyle = tone(col, 0.78); g.lineWidth = 1.5; g.beginPath(); g.moveTo(sx, top + len * 0.25); g.lineTo(sx, top + len * 0.85); g.stroke();
      g.strokeStyle = lighten(col, 0.15); g.lineWidth = 1; g.beginPath(); g.moveTo(sx + 2, top + len * 0.3); g.lineTo(sx + 2, top + len * 0.7); g.stroke();
    }
  };
  const turnX = (lx: number) => cx + lx * ca - sa * r * 0.0;   // a head-local x on screen (centre stays put)
  const faceX = cx - sa * r * 0.55;                            // where the face centre sits as it turns
  const long = style === 'flowing' || style === 'long';
  const hairLen = style === 'flowing' ? 1.1 * r : style === 'long' ? 1.6 * r : 0;   // Mike 2026-10-28: the heroine's back hair shorter (was 1.9)

  if (part === 'head') {
  // 1. Hair behind the head (seen around it) and long hair falling down the back.
  if (long) {
    const top = cy - r * 0.1, dk = tone(hair, 0.86);
    // From the front the long hair is behind the body, so only the side locks (below) show.
    if (back) mass(cx, top, r * 1.85, hairLen * 0.8 + r * 0.4, 6, hair);
    else if (!front) mass(cx + sa * r * 0.4, top, r * 1.3, hairLen * 0.6 + r * 0.4, 4, dk);
  }
  if (style === 'hood') blob(cx, cy + r * 0.05, r * 1.2, r * 1.15, L.secondary);

  // 2. The head: a soft skin oval (always, so hair sits on something).
  blob(cx, cy + r * 0.05, r * 0.98, r * 0.95, L.skin);
  if (!back && Math.abs(sa) > 0.3) {   // ear on the side facing us
    const ex = cx + sa * r * 0.45;
    if (sp === 'elf' || sp === 'lumari') { g.fillStyle = L.skin; g.beginPath(); g.moveTo(ex - 3, cy); g.lineTo(ex + 10, cy - 8); g.lineTo(ex + 3, cy + 6); g.fill(); }
    else ell(ex, cy + r * 0.1, r * 0.14, r * 0.2, tone(L.skin, 0.9));
  }

  }
  // 3. Face (its own sheet): pixel eyes stamped at whole-pixel positions, then blush and mouth.
  if (part === 'face' && !back) {
    const es = L.eyeStyle ?? (sp === 'owlkin' || sp === 'corvani' ? 'owl' : sp === 'drakari' ? 'slit' : 'round');
    const base = new THREE.Color(L.eyes ?? (es === 'owl' ? '#E0A020' : '#4A6A8A'));
    const pal: Record<string, string> = { k: '#2A2026', w: '#FFF8EC', h: '#FFFFFF', i: hex(base), d: hex(base.clone().multiplyScalar(0.5)), l: hex(base.clone().lerp(new THREE.Color('#FFFFFF'), 0.45)) };
    const stamp = EYE[es] ?? EYE.round, sw = stamp[0].length, sh = stamp.length, k = Math.max(1, Math.round(u / 20));
    const eyeY = Math.round(cy + r * 0.2);
    for (const s of [-1, 1]) {
      const depth = s * sa;                  // >0: this eye turns away
      if (depth > 0.6) continue;             // hidden behind the profile
      const squeeze = depth > 0.2 ? 0.6 : 1;
      const ex = Math.round(faceX + s * r * 0.4 * ca - (sw * k) / 2);
      if (expr === 'blink') rect(ex + (squeeze < 1 ? k : 0), eyeY + k, (squeeze < 1 ? sw - 2 : sw) * k, k, pal.k);   // closed: a lash line
      else stamp.forEach((row, y) => [...row].forEach((ch, x) => {
        if (ch === '.') return;
        const xx = s < 0 ? x : sw - 1 - x;
        if (squeeze < 1 && (xx === 0 || xx === sw - 1)) return;
        rect(ex + xx * k, eyeY - (sh * k) / 2 + y * k, k, k, pal[ch]);
      }));
      if (es !== 'owl') rect(ex + (s < 0 ? 0 : k), eyeY - (sh * k) / 2 - 3 * k, (sw - 2) * k * squeeze, 1, tone(hair, 0.55));   // brow, a thin stroke
    }
    const bl = 'rgba(240,140,140,0.55)';
    rect(faceX - r * 0.6 * ca - 2 * k, eyeY + 6 * k, 3 * k, k, bl); rect(faceX + r * 0.6 * ca - k, eyeY + 6 * k, 3 * k, k, bl);
    const lip = sp === 'infernling' || sp === 'drakari' ? '#3A1A1A' : '#8A3A34';
    const mx = Math.round(faceX - sa * r * 0.1);
    if (expr === 'talk-a') rect(mx - k, eyeY + 7 * k, 2 * k, 2 * k, '#4A1E24');
    else if (expr === 'talk-b') { rect(mx - k - 1, eyeY + 7 * k, 2 * k + 2, 3 * k, '#4A1E24'); rect(mx - k + 1, eyeY + 9 * k, 2 * k - 2, k, '#C8606A'); }
    else rect(mx - k, eyeY + 8 * k, 2 * k, k, lip);
    if (sp === 'owlkin' || sp === 'corvani') { g.fillStyle = L.feature ?? '#E0A020'; g.beginPath(); g.moveTo(faceX - 4, eyeY + 4); g.lineTo(faceX + 4, eyeY + 4); g.lineTo(faceX - sa * 4, eyeY + 12); g.fill(); }
    if (sp === 'drakari') blob(faceX - sa * r * 0.3, cy + r * 0.55, r * 0.45, r * 0.25, L.skin);
    if (L.marks) for (const [dx, dy] of [[-0.55, 0.5], [-0.45, 0.58], [0.45, 0.5], [0.55, 0.58]]) rect(faceX + dx * r * ca, cy + dy * r, k, k, L.marks);
  }

  if (part === 'head') {
  // 4. Hair over the head: crown, fringe, side locks, or the full back of the head.
  if (style !== 'bald' && style !== 'hood') {
    if (back) blob(cx, cy, r * 1.05, r * 1.02, hair);
    else {
      if (!front) blob(cx + sa * r * 0.4, cy + r * 0.05, r * 0.68, r * 0.9, hair);   // back of the head beside the face
      blob(cx + sa * r * 0.15, cy - r * 0.38, r * 1.06, r * 0.66, hair);   // crown cap
      // Fringe: pointed locks across the forehead, sliding with the turn.
      const n = 6;
      for (let i = 0; i < n; i++) {
        const lx = (i - (n - 1) / 2) / ((n - 1) / 2);
        if (lx * sa > 0.7) continue;
        lock(faceX + lx * r * 0.72 * Math.max(0.45, ca), cy - r * 0.5, r * 0.5, r * (0.5 - Math.abs(lx) * 0.08 + (i % 2) * 0.1), -lx * r * 0.12, i % 2 ? tone(hair, 0.9) : hair);
      }
    }
    if (style === 'spiky') for (let i = -1; i <= 1; i++) { g.fillStyle = hair; g.beginPath(); g.moveTo(cx + i * r * 0.5 - 6, cy - r * 0.7); g.lineTo(cx + i * r * 0.7, cy - r * 1.3); g.lineTo(cx + i * r * 0.5 + 6, cy - r * 0.7); g.fill(); }
    if (style === 'topknot') blob(cx, cy - r * 1.05, r * 0.3, r * 0.28, hair);
    if (long && !back) for (const s of [-1, 1]) {   // side locks framing the face, over the shoulders
      if (s * sa > 0.6) continue;
      lock(turnX(s * r * 0.86), cy - r * 0.35, r * 0.5, r * 1.5 + hairLen * 0.25, s * r * 0.08, hair);
    }
  }

  // 5. Headwear and species extras on top.
  if (style === 'cap') {
    blob(cx + sa * r * 0.15, cy - r * 0.62, r * 1.12, r * 0.45, L.primary);
    if (!back) {
      rect(faceX - r * 0.7 * Math.max(0.5, ca), cy - r * 0.32, r * 1.4 * Math.max(0.5, ca), r * 0.16, tone(L.primary, 0.75));   // brim
      for (const s of [-1, 1]) if (s * sa < 0.6) { ell(faceX + s * r * 0.32 * ca, cy - r * 0.62, r * 0.17, r * 0.15, '#C9A23A'); ell(faceX + s * r * 0.32 * ca, cy - r * 0.62, r * 0.1, r * 0.09, '#9FD0D8'); }
    }
  }
  if (L.headpiece && style !== 'cap') {
    rect(cx - r * 0.95, cy - r * 0.62, r * 1.9, r * 0.13, L.headpiece);
    if (!back) for (let i = -1; i <= 1; i++) ell(cx + sa * r * 0.2 + i * r * 0.35, cy - r * 0.7 - (i ? 0 : 2), r * 0.13, r * 0.13, i ? lighten(L.headpiece, 0.3) : (L.scarf ?? '#7A2A3A'));
  }
  const fc = L.feature;
  if (sp === 'infernling' || sp === 'drakari') for (const s of [-1, 1]) { g.fillStyle = fc ?? '#2B2024'; g.beginPath(); g.moveTo(cx + s * r * 0.45, cy - r * 0.75); g.lineTo(cx + s * r * 0.95, cy - r * 1.35); g.lineTo(cx + s * r * 0.7, cy - r * 0.65); g.fill(); }
  if (sp === 'owlkin' || sp === 'corvani') for (const s of [-1, 1]) blob(cx + s * r * 0.7, cy - r * 0.9, r * 0.15, r * 0.25, hair);
  if (sp === 'lumari') { g.strokeStyle = fc ?? '#FFF0B0'; g.lineWidth = 3; g.beginPath(); g.ellipse(cx, cy - r * 1.25, r * 0.7, r * 0.18, 0, 0, Math.PI * 2); g.stroke(); }
  if (sp === 'emberkin' || sp === 'cinderkin') for (let i = -1; i <= 1; i++) { g.fillStyle = fc ?? '#FFB040'; g.beginPath(); g.moveTo(cx + i * r * 0.4 - 6, cy - r * 0.75); g.lineTo(cx + i * r * 0.45, cy - r * 1.4 + Math.abs(i) * 6); g.lineTo(cx + i * r * 0.4 + 6, cy - r * 0.75); g.fill(); }
  }
}
