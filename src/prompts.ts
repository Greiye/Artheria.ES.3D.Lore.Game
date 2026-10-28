// §6.3 / §8 0.03 creativity check: one creation prompt on the title screen, rotating daily.
// Imported at build time (not fetched) so the game also works opened as a local file.
import table from '../content/rolltables/creation-prompts.json';

const creationPrompts: string[] = [...table.lore, ...table.character, ...table.song_food_art];

// Same prompt all day for everyone (local calendar day), next one tomorrow.
export function promptOfTheDay(now = new Date()): string {
  const day = Math.floor(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()) / 86_400_000);
  return creationPrompts[day % creationPrompts.length];
}

// §6.7 n5: Natalie's "I don't know what to make" picks a random one (wired with F3 at 0.04).
export function randomPrompt(): string {
  return creationPrompts[Math.floor(Math.random() * creationPrompts.length)];
}
