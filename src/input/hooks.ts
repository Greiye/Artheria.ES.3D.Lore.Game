import type { Book } from '../book';
import type { Player } from '../player';
import type { Crossbow } from '../crossbow';

export type State = 'title' | 'play' | 'book' | 'pause' | 'resume' | 'editor' | 'charcreate' | 'dialogue' | 'inventory';
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
  setMode(m: InputMode): void;
}
