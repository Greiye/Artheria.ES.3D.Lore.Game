# Head art templates

- `head-template.png` (480×104): 5 head frames with guides: frame edge (dotted), head circle (40 px, blue),
  centre line, eye line (orange), chin (green).
- `face-template.png` (288×416): 4 expression rows × 3 columns, same guides.
- `starters/`: the heads the game draws now, in the same layout, to paint over.

In Aseprite: File > Import Sprite Sheet, grid 96×104. Put the guides on their own layer and hide it before
export. Finished sheets go in `src/art/heads/` (see the README there). This folder is not loaded by the game.
