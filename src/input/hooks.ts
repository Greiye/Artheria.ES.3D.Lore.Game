import type { Book } from '../book';
import type { Player } from '../player';

export type State = 'title' | 'play' | 'book' | 'pause' | 'resume' | 'editor' | 'charcreate';
export type InputMode = 'mouse' | 'touch' | 'pad';

// What the touch and gamepad layers are allowed to do to the game.
export interface GameHooks {
  state(): State;
  player: Player;
  book: Book;
  begin(): void;
  pause(): void;
  resume(): void;
  activate(): void;          // E / A / Read button: open the book if aimed at it
  lookingAtBook(): boolean;
  toggleRun(): void;
  setMode(m: InputMode): void;
}
