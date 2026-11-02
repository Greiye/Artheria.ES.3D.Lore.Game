// Every station panel registers here when it's built, so "close everything" (leaving a station, opening the pause
// menu, going back to the main menu) can't miss a new one. Closing runs newest first, like a stack: a panel opened on
// top of another (cooking over the campfire, the telling over the campfire) closes before the one under it.
export interface Closable { close(): void }
const all: Closable[] = [];

/** Register a station panel; returns it, so `const x = station(new XPanel(...))`. */
export function station<T extends Closable>(s: T): T { all.push(s); return s; }

/** Close every registered panel, newest first. Each panel's close() is a no-op when it isn't open. */
export function closeAllStations(skip?: (s: Closable) => boolean): void {
  for (let i = all.length - 1; i >= 0; i--) if (!skip?.(all[i])) all[i].close();
}
