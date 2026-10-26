import data from '../../content/quest/missing-party.json';

// B2 story seed: "Where did Natalie's party go?". Clues are found in the world; the player writes a
// theory (free text + who / where / why tags) and the theory decides where the lead appears and how
// the story ends. No theory is wrong: every combination has an ending. Saved on this device only.
export const QUEST = data;
export type Axis = 'who' | 'where' | 'why';
export const AXES: Axis[] = ['who', 'where', 'why'];
export type Stage = 'none' | 'clues' | 'lead' | 'done';
export interface Theory { text: string; who: string; where: string; why: string; roll?: { word: string; mood: string; rule: string }; written: string }
export interface QuestState { stage: Stage; clues: string[]; theory?: Theory }
export type Clue = typeof data.clues[number];
const KEY = 'gametool.quest';

export function loadQuest(): QuestState {
  try {
    const s = JSON.parse(localStorage.getItem(KEY) ?? 'null');
    if (s && typeof s.stage === 'string' && Array.isArray(s.clues)) return s;
  } catch { /* blocked or corrupt */ }
  return { stage: 'none', clues: [] };
}
export function saveQuest(s: QuestState) { try { localStorage.setItem(KEY, JSON.stringify(s)); } catch { /* blocked */ } }

export const clueById = (id: string) => data.clues.find((c) => c.id === id);
export const tagLabel = (axis: Axis, v: string) => (data.tags[axis] as Record<string, string>)[v] ?? v;

// The free text is read by keywords, only to suggest tags; the player's own tag choice always wins.
export function readTags(text: string): Partial<Record<Axis, string>> {
  const t = ' ' + text.toLowerCase().replace(/[^a-z\s]/g, ' ') + ' ';
  const best: Partial<Record<Axis, [string, number]>> = {};
  for (const [tag, words] of Object.entries(data.keywords)) {
    const [axis, v] = tag.split(':') as [Axis, string];
    const n = words.reduce((k, w) => k + (t.includes(' ' + w + ' ') || (w.includes(' ') && t.includes(w)) ? 1 : 0), 0);
    if (n && n > (best[axis]?.[1] ?? 0)) best[axis] = [v, n];
  }
  return Object.fromEntries(Object.entries(best).map(([a, [v]]) => [a, v]));
}

// How many of the chosen tags a found clue backs up (0–3).
export function support(s: QuestState, th: Pick<Theory, Axis>): number {
  const backed = new Set(s.clues.flatMap((id) => clueById(id)?.supports ?? []));
  return AXES.filter((a) => backed.has(`${a}:${th[a]}`)).length;
}

export function ending(th: Theory): { friend: string; find: string; note: string } {
  const lead = (data.leads as Record<string, { friend: string; find: string }>)[th.where] ?? data.leads.library;
  const cap = lead.friend[0].toUpperCase() + lead.friend.slice(1);
  const who = ((data.whyLine as Record<string, string>)[th.who] ?? '').replace('%FRIEND%', cap);
  return { friend: lead.friend, find: lead.find, note: data.endingNote.replace('%FRIEND%', cap).replace('%WHO_LINE%', who) };
}
