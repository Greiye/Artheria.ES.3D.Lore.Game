import { audio } from '../audio';
import type { Ambience, Zone } from '../ambience';
import type { Townsfolk } from './townsfolk';
import { FOUNTAIN, TOWN_LOTS, type TownId } from './town';
import { BRIDGES, riverX } from './river';

// v0.06 T2: ambience zones. Birdsong in a spread of trees, the fountain's and the river's water, the smithy's hammer,
// chatter at the store.
export function townZones(trees: [number, number][]): Zone[] {
  const lotFront = (id: TownId, out: number) => { const L = TOWN_LOTS.find((l) => l.id === id)!; return { x: L.x + Math.sin(L.ry) * (L.d / 2 + out), z: L.z + Math.cos(L.ry) * (L.d / 2 + out) }; };
  const zones: Zone[] = [];
  for (const [x, z] of trees) if (zones.length < 8 && Math.hypot(x, z) < 46 && zones.every((q) => Math.hypot(q.x - x, q.z - z) > 18)) zones.push({ name: `birds:${zones.length}`, kind: 'birds', x, y: 5, z, range: 15 });
  zones.push({ name: 'fountain', kind: 'water', x: FOUNTAIN.x, y: 0.8, z: FOUNTAIN.z, range: 9 });
  for (const b of BRIDGES) zones.push({ name: `river:${b.z}`, kind: 'water', x: riverX(b.z), y: 0.2, z: b.z, range: 14 });
  { const s = lotFront('smithy', 0.5); zones.push({ name: 'forge', kind: 'forge', x: s.x, y: 1, z: s.z, range: 16 }); }
  { const s = lotFront('shop', 2.3); zones.push({ name: 'chatter', kind: 'chatter', x: s.x, y: 1.5, z: s.z, range: 11 }); }
  return zones;
}

// T3 NPC voices: townsfolk who are talking murmur from where they stand (only near enough to hear).
export class FolkVoices {
  private nodes = new Map<string, AudioNode | null>();
  private t = 0;
  constructor(private townsfolk: Townsfolk, private ambience: Ambience) {}
  update(dt: number) {
    if ((this.t -= dt) > 0) return;
    this.t = 0.7;
    if (!this.ambience.on) return;
    for (const f of this.townsfolk.folk) {
      if (!f.active || !f.talking) continue;
      const p = f.root.position;
      if (Math.hypot(p.x - audio.listener.x, p.z - audio.listener.z) > 14 || Math.random() < 0.35) continue;
      if (!this.nodes.has(f.id)) this.nodes.set(f.id, audio.spatial('voice:' + f.id, p.x, 1.5, p.z, 14, 'dialogue'));
      const out = this.nodes.get(f.id);
      if (out) audio.murmur(out, f.role === 'customer' ? 1.1 : 0.95);
    }
  }
}
