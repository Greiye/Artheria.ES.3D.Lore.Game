// B15 seeded dungeon: layout only (no Three.js), so the same seed always gives the same dungeon.
// Ideas from the look of Dungeon Forge (docs/backlog.md B15: reference only, no code taken):
// scatter rooms, push them apart, connect them with a minimum spanning tree plus a few loops,
// carve L-shaped corridors, then tag rooms by their distance from the entrance.
export const N = 36;                 // grid cells per side
export const CELL = 2;               // metres per cell
export type Tag = 'entrance' | 'hall' | 'shrine' | 'treasure' | 'pool' | 'nest';
export interface Room { x: number; y: number; w: number; h: number; cx: number; cy: number; tag: Tag; depth: number }
export const THEMES = ['Ancient', 'Frost', 'Molten', 'Grim', 'Verdant'] as const;
export type Theme = typeof THEMES[number];
export interface Layout { seed: number; theme: Theme; grid: Uint8Array; rooms: Room[]; torches: [number, number][] }   // grid: 0 rock, 1 floor, 2 pool

export function mulberry32(a: number) {
  return () => { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
export const dailySeed = (d = new Date()) => d.getUTCFullYear() * 10000 + (d.getUTCMonth() + 1) * 100 + d.getUTCDate();
export function seedFrom(text: string): number {
  const n = Number(text.trim());
  if (Number.isInteger(n) && n > 0) return n;
  let h = 2166136261;
  for (const c of text) h = Math.imul(h ^ c.charCodeAt(0), 16777619);
  return (h >>> 0) || 1;
}

export function generate(seed: number): Layout {
  const R = mulberry32(seed);
  const ri = (a: number, b: number) => a + Math.floor(R() * (b - a + 1));
  const theme = THEMES[Math.floor(R() * THEMES.length)];
  // 1. Scatter rooms near the middle, then push overlapping ones apart.
  const rooms: Room[] = [];
  const count = ri(7, 10);
  for (let i = 0; i < count; i++) {
    const w = ri(3, 6), h = ri(3, 6);
    rooms.push({ x: N / 2 - w / 2 + (R() - 0.5) * 10, y: N / 2 - h / 2 + (R() - 0.5) * 10, w, h, cx: 0, cy: 0, tag: 'hall', depth: 0 });
  }
  for (let it = 0; it < 200; it++) {
    let moved = false;
    for (const a of rooms) for (const b of rooms) {
      if (a === b) continue;
      const ox = Math.min(a.x + a.w + 1, b.x + b.w + 1) - Math.max(a.x, b.x), oy = Math.min(a.y + a.h + 1, b.y + b.h + 1) - Math.max(a.y, b.y);
      if (ox > 0 && oy > 0) {
        moved = true;
        const dx = (a.x + a.w / 2) - (b.x + b.w / 2) || R() - 0.5, dy = (a.y + a.h / 2) - (b.y + b.h / 2) || R() - 0.5;
        if (ox < oy) a.x += Math.sign(dx) * 0.5; else a.y += Math.sign(dy) * 0.5;
      }
    }
    if (!moved) break;
  }
  for (const r of rooms) {
    r.x = Math.max(1, Math.min(N - r.w - 1, Math.round(r.x))); r.y = Math.max(1, Math.min(N - r.h - 1, Math.round(r.y)));
    r.cx = r.x + Math.floor(r.w / 2); r.cy = r.y + Math.floor(r.h / 2);
  }
  // 2. Minimum spanning tree (Prim) over room centres, plus ~20% extra edges for loops.
  const d2 = (a: Room, b: Room) => (a.cx - b.cx) ** 2 + (a.cy - b.cy) ** 2;
  const inTree = new Set([0]), edges: [number, number][] = [];
  while (inTree.size < rooms.length) {
    let best: [number, number] | null = null, bd = Infinity;
    for (const i of inTree) for (let j = 0; j < rooms.length; j++) if (!inTree.has(j) && d2(rooms[i], rooms[j]) < bd) { bd = d2(rooms[i], rooms[j]); best = [i, j]; }
    edges.push(best!); inTree.add(best![1]);
  }
  for (let i = 0; i < rooms.length; i++) for (let j = i + 1; j < rooms.length; j++) {
    if (R() < 0.12 && !edges.some(([a, b]) => (a === i && b === j) || (a === j && b === i))) edges.push([i, j]);
  }
  // 3. Carve rooms and L-shaped corridors.
  const grid = new Uint8Array(N * N);
  const set = (x: number, y: number, v = 1) => { if (x > 0 && y > 0 && x < N - 1 && y < N - 1) grid[y * N + x] = v; };
  for (const r of rooms) for (let y = r.y; y < r.y + r.h; y++) for (let x = r.x; x < r.x + r.w; x++) set(x, y);
  for (const [i, j] of edges) {
    const a = rooms[i], b = rooms[j], horizFirst = R() < 0.5;
    const hx = (y: number, x0: number, x1: number) => { for (let x = Math.min(x0, x1); x <= Math.max(x0, x1); x++) set(x, y); };
    const vy = (x: number, y0: number, y1: number) => { for (let y = Math.min(y0, y1); y <= Math.max(y0, y1); y++) set(x, y); };
    if (horizFirst) { hx(a.cy, a.cx, b.cx); vy(b.cx, a.cy, b.cy); } else { vy(a.cx, a.cy, b.cy); hx(b.cy, a.cx, b.cx); }
  }
  // 4. Tag by graph distance from the entrance (room 0 = the one nearest the south edge, under the trapdoor).
  const entrance = rooms.reduce((best, r, i) => (r.cy > rooms[best].cy ? i : best), 0);
  const adj = rooms.map(() => [] as number[]);
  for (const [a, b] of edges) { adj[a].push(b); adj[b].push(a); }
  const depth = rooms.map(() => -1); depth[entrance] = 0;
  const q = [entrance];
  while (q.length) { const c = q.shift()!; for (const n of adj[c]) if (depth[n] < 0) { depth[n] = depth[c] + 1; q.push(n); } }
  rooms.forEach((r, i) => { r.depth = depth[i]; });
  const order = rooms.map((_, i) => i).sort((a, b) => depth[b] - depth[a]);
  rooms[entrance].tag = 'entrance';
  rooms[order[0]].tag = 'nest';
  const rest = order.filter((i) => rooms[i].tag === 'hall');
  if (rest[0] !== undefined) rooms[rest[0]].tag = 'treasure';
  rest.slice(1).forEach((i, k) => { rooms[i].tag = k % 3 === 0 ? 'shrine' : k % 3 === 1 ? 'pool' : 'hall'; });
  // Pools: a liquid patch in the middle of pool rooms (walkable visually only, it never blocks).
  for (const r of rooms) if (r.tag === 'pool') for (let y = r.y + 1; y < r.y + r.h - 1; y++) for (let x = r.x + 1; x < r.x + r.w - 1; x++) grid[y * N + x] = 2;
  // Torches on room corners (budgeted: at most 2 per room).
  const torches: [number, number][] = [];
  for (const r of rooms) { torches.push([r.x, r.y]); if (r.tag !== 'hall') torches.push([r.x + r.w - 1, r.y + r.h - 1]); }
  return { seed, theme, grid, rooms, torches };
}

export const isFloor = (l: Layout, x: number, y: number) => x >= 0 && y >= 0 && x < N && y < N && l.grid[y * N + x] > 0;
