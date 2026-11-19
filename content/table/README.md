# Table pages

Lore made at the table in the **TTRPG Session Tool** (Lore tab › ⤒ Push to lore repo): NPCs, places, dungeons, items and notes from play, one page each. The tool's ⤓ Pull lore repo reads them back, along with `content/lore/` and `content/artifacts/`.

- Front block: `title`, `contributor`, `credit_as`, `created`, `type: table`, `cat:` (`location`, `dungeon`, `npc`, `creature`, `item`, `book` or `note`), `tags`, `game_id`. Then `# Title` and the text.
- Edit pages here on github.com; the next pull in the tool brings the change in. DM notes are never written here.
- This folder is not part of the library build (`npm run lore` reads only `content/lore/` and `content/artifacts/`), so a page here never breaks the deploy. To make one a library book, move it to `content/lore/` and change it to `type: lore` (or to `content/artifacts/` as `type: character`).
- Full format: `docs/lore-sync.md` in the TTRPG Session Tool repo.
