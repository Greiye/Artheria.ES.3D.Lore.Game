import type { Book } from '../book';
import type { Player } from '../player';
import type { Crossbow } from '../crossbow';

export type State = 'title' | 'play' | 'book' | 'pause' | 'resume' | 'editor' | 'charcreate' | 'dialogue' | 'inventory' | 'forge';
export type InputMode = 'mouse' | 'touch' | 'pad';

// What the touch and gamepad layers are allowed to do to the game.
export interface GameHooks {
  state(): State;
  player: Player;
  book: Book;
  crossbow: Crossbow;
  fire(): void;
  hasCrossbow(): boolean;
  begin(): void;
  pause(): void;
  resume(): void;
  activate(): void;          // E / A / Read button: open the book if aimed at it
  lookingAtBook(): boolean;   // true when E would do something (book or Natalie)
  advanceDialogue(): void;    // F3.1 (gamepad A)
  closeInventory(): void;
  openInventory(): void;
  toggleRun(): void;
  toggleView(): void;            // v0.05: cycle first person / shoulder / overhead
  shoulderSwap(): void;          // v0.05: swap shoulder, or the weapon outside the shoulder view
  dialogueMove(d: number): void; // v0.05: move the highlighted dialogue choice
  stepCamera(n: number): void;  // v0.04: one camera distance out (+1) or in (-1)
  toggleTorch(): void;          // v0.04
  quickSwap(hand: 'left' | 'right'): void;   // v0.04 D-pad quick swap
  menuActive(): boolean;   // v0.05: a menu that takes the D-pad is up (intro, main menu, Extras, gate prompt)
  menu(dir: 'up' | 'down' | 'left' | 'right' | 'ok' | 'back'): boolean;   // v0.05: menus with the D-pad
  setMode(m: InputMode): void;
}
