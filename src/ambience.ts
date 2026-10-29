import { audio } from './audio';

// v0.06 T2: positional ambience. Each zone is a sound with a place and a reach: birdsong in the trees, the well's
// water, the smithy's hammer, chatter by the General Store. A zone only makes sound while the listener is inside
// its reach (T3 falloff does the fading), so far zones cost nothing.
export type ZoneKind = 'birds' | 'water' | 'forge' | 'chatter';
export interface Zone { name: string; kind: ZoneKind; x: number; y: number; z: number; range: number }
interface Live extends Zone { out: AudioNode | null; wait: number; stop: (() => void) | null }
// Seconds between calls, min and spread.
const EVERY: Record<Exclude<ZoneKind, 'water'>, [number, number]> = { birds: [1.4, 3.2], forge: [1.1, 1.4], chatter: [0.9, 1.6] };

export class Ambience {
  readonly zones: Live[];
  /** Calls made per zone since the start (for tests). */
  readonly heard: Record<string, number> = {};
  on = true;

  constructor(zones: Zone[]) { this.zones = zones.map((z) => ({ ...z, out: null, wait: Math.random() * 1.5, stop: null })); }

  update(dt: number): void {
    const L = audio.listener;
    for (const z of this.zones) {
      const near = this.on && Math.hypot(z.x - L.x, z.z - L.z) < z.range;
      if (z.kind === 'water') {
        if (near && !z.stop) { z.out ??= audio.spatial(z.name, z.x, z.y, z.z, z.range); if (z.out) { z.stop = audio.trickle(z.out); this.count(z); } }
        else if (!near && z.stop) { z.stop(); z.stop = null; }
        continue;
      }
      if (!near || (z.wait -= dt) > 0) continue;
      const [a, b] = EVERY[z.kind];
      z.wait = a + Math.random() * b;
      z.out ??= audio.spatial(z.name, z.x, z.y, z.z, z.range);
      if (!z.out) continue;
      if (z.kind === 'birds') audio.chirp(z.out);
      else if (z.kind === 'forge') audio.clang(z.out);
      else audio.murmur(z.out, 0.85 + Math.random() * 0.5);
      this.count(z);
    }
  }
  /** Silence everything (the dungeon, the main menu). */
  stopAll(): void { for (const z of this.zones) { z.stop?.(); z.stop = null; } }
  private count(z: Zone) { this.heard[z.name] = (this.heard[z.name] ?? 0) + 1; }
}
