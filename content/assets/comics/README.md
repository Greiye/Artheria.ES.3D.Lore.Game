# Comic panels (B47)

A lore book reads as a comic when `content/comics/<book-id>.json` exists. Each panel there may name an image with
`"art": "<file>"`; put that file in `content/assets/comics/<book-id>/` and it shows the next time the game is built.
Until then the panel draws a placeholder card with the scene written on it.

- **Names:** `01.webp`, `02.webp`, ... in panel order (any name works, as long as the JSON matches).
- **Size:** 1280 x 640 (2:1) for a normal panel, 1500 x 500 (3:1) for a `"wide": true` panel. WebP, under ~200 KB each:
  the images are built into the single-file game.
- **Text:** keep words out of the art. Captions and speech come from the JSON, and every line there is quoted from
  the book's own text in `content/lore/` (the lore text is the source of truth; the comics test checks it).
- **Speakers:** a speech line's `"who"` picks a dialogue portrait from `assets/portraits/` (B30), or a placeholder.
- Only art you made or have the rights to ship goes here: this folder is published with the game.
