import type { Collider } from '../world';

// A grid over the world's 2D colliders, for code that asks "what is at this point?" many times a frame (the follow
// camera walks ~120 points along its boom; scanning all ~580 colliders for each cost about 0.25 ms a frame).
// The collider list is shared and edited in place by many builders (doors open, maps swap, the dungeon comes and goes),
// so the grid does not try to hear about edits: sync() compares the list with the one it was built from, entry by
// entry, and rebuilds on any difference. Call it once a frame before asking. It assumes a collider's own numbers are
// never changed after it is added (true today: they are only added and removed).

const PAD = 0.6;   // colliders are filed with this margin, so a point query may use a pad up to it

export class ColliderGrid {
  private cells = new Map<number, Collider[]>();
  private seen: Collider[] = [];
  private static readonly NONE: readonly Collider[] = [];
  rebuilds = 0;

  constructor(private colliders: Collider[], private size = 4) {}

  private key(ix: number, iz: number): number { return (ix + 4096) * 8192 + (iz + 4096); }

  /** Bring the grid up to date with the list (cheap when nothing changed). */
  sync(): void {
    const list = this.colliders, seen = this.seen;
    let same = list.length === seen.length;
    for (let i = 0; same && i < list.length; i++) same = list[i] === seen[i];
    if (same) return;
    this.rebuilds++;
    this.cells.clear();
    this.seen = list.slice();
    const s = this.size;
    for (const c of list) {
      const minX = (c.kind === 'circle' ? c.x - c.r : c.minX) - PAD, maxX = (c.kind === 'circle' ? c.x + c.r : c.maxX) + PAD;
      const minZ = (c.kind === 'circle' ? c.z - c.r : c.minZ) - PAD, maxZ = (c.kind === 'circle' ? c.z + c.r : c.maxZ) + PAD;
      for (let ix = Math.floor(minX / s); ix <= Math.floor(maxX / s); ix++) for (let iz = Math.floor(minZ / s); iz <= Math.floor(maxZ / s); iz++) {
        const k = this.key(ix, iz);
        let cell = this.cells.get(k);
        if (!cell) this.cells.set(k, cell = []);
        cell.push(c);
      }
    }
  }

  /** Every collider that could touch the point (x, z) padded by up to 0.6 m. May include some that don't. */
  at(x: number, z: number): readonly Collider[] {
    return this.cells.get(this.key(Math.floor(x / this.size), Math.floor(z / this.size))) ?? ColliderGrid.NONE;
  }
}
