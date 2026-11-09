// B52 + B53 (Mike 2026-11-06, defaults approved): two quest groups in the casebook. "Everyone in Aralon" has you meet
// every person you can talk to; "Every station" has you use every station on the map. A step completes on first use
// (a talk started, a station opened), the casebook shows the count and what's left, and finishing a group pays a purse.
import './groups.css';

const KEY = 'gametool.groups';

export const NPCS: { id: string; name: string; where: string }[] = [
  { id: 'natalie', name: 'Natalie', where: 'by the library' },
  { id: 'pedlar', name: 'The Curio Pedlar', where: 'his cart on the green' },
  { id: 'kavik', name: 'Kavik', where: 'by the dojo' },
  { id: 'candor', name: 'Candor', where: 'the archery range' },
  { id: 'lenju', name: 'Lenju', where: 'out in town' },
  { id: 'taitai', name: 'Taitai', where: 'out in town' },
  { id: 'cook', name: 'The caravan cook', where: 'the caravan' },
  { id: 'weaver', name: 'The caravan weaver', where: 'the caravan' },
  { id: 'muleteer', name: 'The muleteer', where: 'the caravan' },
  { id: 'shopkeeper', name: 'The shopkeeper', where: 'the shop' },
  { id: 'smith', name: 'The smith', where: 'the smithy counter' },
  { id: 'tam', name: 'Tam', where: 'the coin table by the Inn' },
  { id: 'josh', name: 'Josh', where: 'through the portal' },
  { id: 'jason', name: 'Jason', where: 'through the portal' },
  { id: 'liv', name: 'Liv', where: 'through the portal' },
  { id: 'rev', name: 'Rev', where: 'through the portal' },
];
export const STATIONS: { id: string; name: string }[] = [
  { id: 'campfire', name: 'The campfire' },
  { id: 'cooking', name: 'Cooking at the fire' },
  { id: 'mirror', name: 'The mirror (your hero)' },
  { id: 'anvil', name: 'The anvil (forge a weapon)' },
  { id: 'sketchbook', name: 'The sketchbook' },
  { id: 'grindstone', name: 'The grindstone' },
  { id: 'dojo', name: 'The dojo' },
  { id: 'skills', name: 'The practice table' },
  { id: 'map', name: "The Cartographer's map" },
  { id: 'cinema', name: 'The cinema' },
  { id: 'archery', name: "Candor's archery lesson" },
  { id: 'skyrunner', name: 'The skyrunner perch' },
  { id: 'descent', name: 'The descent' },
  { id: 'knight', name: 'The knight frame' },
];
export const GROUP_PURSE = 10;
export type GroupKind = 'npc' | 'station';

export class QuestGroups {
  npcs = new Set<string>();
  stations = new Set<string>();
  /** A step done for the first time (n of total), and whether that finished the group. */
  onStep: (kind: GroupKind, name: string, n: number, total: number, finished: boolean) => void = () => undefined;
  constructor() {
    try {
      const s = JSON.parse(localStorage.getItem(KEY) ?? 'null');
      if (s) { for (const id of s.npcs ?? []) this.npcs.add(id); for (const id of s.stations ?? []) this.stations.add(id); }
    } catch { /* private mode */ }
  }
  private save() { try { localStorage.setItem(KEY, JSON.stringify({ npcs: [...this.npcs], stations: [...this.stations] })); } catch { /* private mode */ } }
  /** Mark a step; true when it was new. Unknown ids are ignored. */
  mark(kind: GroupKind, id: string): boolean {
    const list = kind === 'npc' ? NPCS : STATIONS, set = kind === 'npc' ? this.npcs : this.stations;
    const item = list.find((x) => x.id === id);
    if (!item || set.has(id)) return false;
    set.add(id); this.save();
    this.onStep(kind, item.name, set.size, list.length, set.size === list.length);
    return true;
  }
  count(kind: GroupKind) { return kind === 'npc' ? [this.npcs.size, NPCS.length] : [this.stations.size, STATIONS.length]; }
  html(): string {
    const block = (tab: string, title: string, kind: GroupKind, items: { id: string; name: string; where?: string }[], set: Set<string>) => {
      const done = set.size === items.length;
      return `<section class="cb-group" data-group="${kind}"><h4>${tab}</h4><h3>${title} <span class="cb-count">${set.size} of ${items.length}</span>${done ? ' <span class="cb-done">done</span>' : ''}</h3>
        <ul>${items.map((x) => `<li class="${set.has(x.id) ? 'got' : ''}">${set.has(x.id) ? '✓' : '○'} ${x.name}${!set.has(x.id) && x.where ? ` <span class="fine">(${x.where})</span>` : ''}</li>`).join('')}</ul>
        <p class="fine">${done ? `Finished: ${GROUP_PURSE} ◎ paid.` : `Finish the group for ${GROUP_PURSE} ◎.`}</p></section>`;
    };
    // Each group is its own <section><h4>: the panel shows them as tabs beside the case (src/ui/fit-panel.ts), so the
    // casebook fits a phone without shrinking the text.
    return block('Everyone', 'Everyone in Aralon: meet them all', 'npc', NPCS, this.npcs) + block('Stations', 'Every station: use each once', 'station', STATIONS, this.stations);
  }
}
