# Creatures

One page per people, beast, monster or named person, written by the **Creature Designer** in the TTRPG Session Tool (Planning › 🐉 Creatures) and read back by it. You can edit these pages on github.com too; the tool pulls your changes.

- Copy `content/templates/creature.md` to start one by hand, and save it as `content/creatures/<a-short-name>.md`.
- `kind:` is `people`, `beast`, `monster` or `person`. Sections are optional: **Details, Stats, Vitals, Skills, Abilities, Inventory, Lore**. Stats are free names and values, so any rules system fits.
- List lines look like `- **Name:** value`. An ability is `- **Name** (cost) \`roll\`: text`. An item is `- 2 × Rusty knife: note`.
- Any other heading you add is kept as part of the lore.
- This folder is not part of the library build (`npm run lore` reads only `content/lore/` and `content/artifacts/`), so a page here never breaks the deploy.
- Full format: `docs/creature-wiki-format.md` in the TTRPG Session Tool repo.
