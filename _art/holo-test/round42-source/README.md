# Round 42 image sources

These are the reviewed built-in imagegen outputs, copied into this worktree.
Original references remain unchanged in `../source-4.0/`.
`../prepare_round42.py` crops/resamples these files into the production research
layers. No CLI image API or external key was used.

- `a-subject.png`: sheep + sandcastle + flag + shovel + shared contact shadow,
  extracted together. First output mistakenly painted checkerboard RGB; rejected.
  Correction explicitly requested real RGBA alpha, preserving all subject contours.
- `a-background.png`: remove the sheep, castle, shovel, flag and their shadow;
  inpaint clean turquoise sky and pale sand, retain horizon and peripheral shells.
- `c-background.png`: recompose the original botanical sticker sheet to portrait
  5:7 with the same sheep/backpack identity and at least eight complete plant
  stickers; then remove only sheep/backpack, repairing the kraft-paper background.
- `c-subject.png`: extract sheep/backpack/white sticker edge with real alpha,
  requesting 44% canvas height centered horizontally around 55% canvas height.
  Actual packaged sheep height is measured by the checker, not assumed from prompt.
  The import crop removes disconnected alpha 1–7 generator dust outside the
  complete sheep box `(176,540,895,1134)`; it does not erode the sheep contour.

The images are generated edits/recomposition, not a claim of byte-identical
RGB extraction from the original illustrations. The A contour audit tests crop
retention against the reviewed master cutout and explicitly records that reference.
