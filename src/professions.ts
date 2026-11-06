// Mike 2026-11-06 ("Character Creation: Give character choice of profession"): four professions, picked when a new
// hero is made (and changeable at the tailor or the camp mirror). Each gives one way of fighting its own:
//   fighter: bonus techniques on LB / RB and a steadying breath that gives temporary health
//   ranger:  a real crosshair (much better aim); everyone else aims down the crossbow's iron sights
//   mage:    Magister Greer teaches magic missile, a bolt that lights its way
//   monk:    locks on to a foe and fights them in fight mode
// `soon` marks a perk that is not in the game yet (it arrives in its own update); the pick is saved either way.
export type Profession = 'fighter' | 'ranger' | 'mage' | 'monk';
export interface ProfessionInfo { id: Profession; label: string; icon: string; blurb: string; soon?: boolean }
export const PROFESSIONS: ProfessionInfo[] = [
  { id: 'fighter', label: 'Fighter', icon: '⚔', blurb: 'Trained techniques on the shoulder buttons (LB / RB), and a steadying breath that gives temporary health.', soon: true },
  { id: 'ranger', label: 'Ranger', icon: '➶', blurb: 'A true crosshair: far better aim with the crossbow. Everyone else aims down the iron sights.' },
  { id: 'mage', label: 'Mage', icon: '✦', blurb: 'Magister Greer will teach you magic missile, a bolt of light that lights the way as it flies.', soon: true },
  { id: 'monk', label: 'Monk', icon: '☯', blurb: 'Locks on to a foe and meets them hand to hand, in fight mode.', soon: true },
];
export const isProfession = (v: unknown): v is Profession => PROFESSIONS.some((p) => p.id === v);
export const professionInfo = (id: string | undefined) => PROFESSIONS.find((p) => p.id === id);
