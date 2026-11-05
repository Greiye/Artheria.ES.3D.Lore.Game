import type { Book } from '../book';
import type { Player } from '../player';
import type { Crossbow } from '../crossbow';
import type { Sword } from '../sword';

export type State = 'title' | 'play' | 'book' | 'pause' | 'resume' | 'editor' | 'dialogue' | 'inventory' | 'forge';
export type InputMode = 'mouse' | 'touch' | 'pad';

// What the touch and gamepad layers are allowed to do to the game.
export interface GameHooks {
  state(): State;
  player: Player;
  book: Book;
  crossbow: Crossbow;
  fire(): void;
  /** Mike 2026-11-05: a hand's button went down or up (LMB / RT = right, RMB / LT = left). */
  hand(h: 'left' | 'right', down: boolean): void;
  /** A touch tap on a hand's button: uses what it holds, or latches aiming when it aims. */
  handTap(h: 'left' | 'right'): void;
  /** What a hand's button does now ('Fire', 'Swing', 'Aim'), or null when it does nothing. */
  handVerb(h: 'left' | 'right'): string | null;
  hasCrossbow(): boolean;
  sword: Sword;               // v0.08
  hasSword(): boolean;
  weaponSwap(): void;         // v0.08: right hand: hands → sword → crossbow
  begin(): void;
  pause(): void;
  resume(): void;
  activate(): void;          // E / A / Read button: open the book if aimed at it
  lookingAtBook(): boolean;   // true when E would do something (book or Natalie)
  useVerb(): string | null;   // UX pass: what E / the touch Use button would do here ("Talk to Natalie", "Read", ...)
  openMap(): void;
  openJournal(): void;
  advanceDialogue(): void;    // F3.1 (gamepad A)
  closeInventory(): void;
  openInventory(): void;
  toggleRun(): void;
  toggleView(): void;            // v0.05: cycle first person / shoulder / overhead
  shoulderSwap(): void;          // v0.05: swap shoulder, or the weapon outside the shoulder view
  dialogueMove(d: number): void; // v0.05: move the highlighted dialogue choice
  stepCamera(n: number): void;  // v0.04: one camera distance out (+1) or in (-1)
  toggleTorch(): void;          // v0.04
  quickEquip(what: 'crossbow' | 'sword'): void;   // B28: the touch quick-equip buttons (tap again to put it away)
  torchLit(): boolean;          // B28: lights the torch button
  quickSwap(hand: 'left' | 'right'): void;   // v0.04 D-pad quick swap
  menuActive(): boolean;   // v0.05: a menu that takes the D-pad is up (intro, main menu, Extras, gate prompt)
  menu(dir: 'up' | 'down' | 'left' | 'right' | 'ok' | 'back'): boolean;   // v0.05: menus with the D-pad
  setMode(m: InputMode): void;
  bandPad?(i: number): void;              // v0.06 C3: play note pad i at the campfire
  forgeStick?(x: number, y: number): void;   // v0.06 S4: the right stick turns the weapon on the anvil
  panel?(d: 'up' | 'down' | 'left' | 'right' | 'ok' | 'back'): void;   // B40: the open panel with a controller
  panelHold?(on: boolean): boolean;   // B40: A held in a panel job that needs holding (sharpening); true while one is running
  deskOpen?(): boolean;               // B40: the margin-note desk is open in the book
  bookPen?(): void;                   // B40: pick up the pen in the open book
  canSwapShoulder(): boolean;         // B40 (and the rune pulse while piloting the knight frame)
  piloting?(): boolean;               // Mike 2026-11-05: in the knight frame         // B40: the touch shoulder button shows only in the shoulder view
}
