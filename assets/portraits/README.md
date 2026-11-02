# Dialogue portraits (B30)

Drop a portrait here and it shows on the left of the dialogue box, Ren'Py style, the next time the game is built.
Until a speaker has a file, the game draws a placeholder card (a silhouette with their initial and name).

- **Name:** the speaker's id, lower case: `natalie.png`, `pedlar.png`. A dialogue script can name another file with `"portrait": "<id>"`.
- **Expressions (optional):** `<id>-<mood>.png`, e.g. `natalie-worried.png`. A dialogue line picks it with `"mood": "worried"`; a line with no mood (or a mood with no file) shows the plain `<id>.png`.
- **Size:** 512 x 640 (4:5), transparent PNG or WebP, head and shoulders, facing right (toward the box). Keep each under ~300 KB.
- **Types:** `.png`, `.webp`, `.jpg`.
- Only art you made or have the rights to ship goes here: this folder is published with the game. (Reference images stay in `references/`.)

Speakers using the dialogue box today: `natalie` (Natalie Bourbon), `pedlar` (the Curio Pedlar).
