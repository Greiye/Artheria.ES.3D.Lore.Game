// Backlog item promoted 2026-10-18 (spec B4): a short character-creation form shown once
// before the player's first spawn. Two creativity questions, matching the original design
// doc's intent (make the campaign feel like theirs) without blocking play — both are optional
// and "Skip for now" marks the form as seen so it never nags a second time.
const KEY = 'gametool.character';

export interface Character {
  name: string;
  motivation: string;   // "What does your character want more than anything?"
  secret: string;        // "What's one true thing about this world that only you know?"
  created: boolean;      // the form has been shown and answered (or skipped) at least once
}
const defaults: Character = { name: '', motivation: '', secret: '', created: false };

export function loadCharacter(): Character {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return { ...defaults };
    const c = JSON.parse(raw) as Partial<Character>;
    return {
      name: typeof c.name === 'string' ? c.name : '',
      motivation: typeof c.motivation === 'string' ? c.motivation : '',
      secret: typeof c.secret === 'string' ? c.secret : '',
      created: !!c.created,
    };
  } catch { return { ...defaults }; }
}

export function saveCharacter(c: Character): void {
  try { localStorage.setItem(KEY, JSON.stringify(c)); } catch { /* private mode / quota */ }
}
