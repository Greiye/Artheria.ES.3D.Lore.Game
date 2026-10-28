// B6 constraint dice: roll a word, a mood and a rule to work into what you make. Faces come from
// content/rolltables/constraint-dice.json plus lore names (species, places) so rolls feel like Artheria.
import table from '../../content/rolltables/constraint-dice.json';

const SPECIES_NAMES = ['Infernling', 'Drakari', 'Owlkin', 'Emberkin', 'Stonekin', 'Titankin', 'Corvani', 'Lumari'];
export type DieKind = 'word' | 'mood' | 'rule';
export interface Roll { word: string; mood: string; rule: string }

const pick = <T>(a: readonly T[], rnd: () => number) => a[Math.floor(rnd() * a.length) % a.length];

export class ConstraintDice {
  rerolls: number;
  constructor(private loreWords: string[] = [], readonly budget = 2, private rnd: () => number = Math.random) { this.rerolls = budget; }

  faces(kind: DieKind): string[] {
    if (kind !== 'word') return table[kind];
    return [...table.word, ...this.loreWords, ...SPECIES_NAMES.map((s) => `an ${s}`.replace(/^an ([^AEIOU])/, 'a $1'))];
  }

  roll(): Roll {
    this.rerolls = this.budget;
    return { word: pick(this.faces('word'), this.rnd), mood: pick(this.faces('mood'), this.rnd), rule: pick(this.faces('rule'), this.rnd) };
  }

  // Reroll one die; returns null once the budget is spent.
  reroll(r: Roll, kind: DieKind): Roll | null {
    if (this.rerolls <= 0) return null;
    this.rerolls--;
    let face = r[kind];
    for (let i = 0; i < 8 && face === r[kind]; i++) face = pick(this.faces(kind), this.rnd);
    return { ...r, [kind]: face };
  }
}

export const rollText = (r: Roll) => `Use: ${r.word} · feeling ${r.mood} · ${r.rule}`;
