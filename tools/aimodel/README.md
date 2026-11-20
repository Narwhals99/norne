# AI models for fights

A figure's look can have an AI-made model (`fig.model`, see `js/aikit.js`). In fights the figure stands as the model;
the figure maker still builds the look it was made from, and that look shows wherever the model can't load.

## Making one

1. Build the character in the figure maker (Character > Figure) and save it.
2. Have ChatGPT draw that look in an A-pose (front, and a back view if it helps), plain background.
3. Make the model in Tripo from the picture and download the GLB.
4. Run the first step. It cuts the model down and writes a front and a side picture:
   ```powershell
   .\tools\aimodel\make.ps1 -Src C:\Users\jackh\Downloads\norne\<tripo>.glb -Id <id>
   ```
5. Copy `caelis.json` to `<id>.json` and move the joints to match the pictures (metres, feet at 0, the
   character faces -Y and its left is +X; the pictures are 800 px wide over 1.05 m, centred on x = 0, z = 0.49).
   Only the middle and the left side are listed; the right side is mirrored.
6. Run the same command again. It rigs and animates the model, writes `models/<id>.glb`, and pictures of the poses.
7. Add `{id, n, file, who}` to `MODELS` in `js/aikit.js` (`who` is the character's name: they stand as the model
   without picking anything, and only they are offered it; leave it out for a model anyone may pick), and check it next to its toy figure with
   `tools/aimodel/preview.html?model=<id>` (serve the repo with `python -m http.server`).
8. In the figure maker, pick it under **Body > AI model** and save the figure.

What the scripts do:

| Script | Does |
|---|---|
| `prep.py` | Imports the GLB, merges doubled points, drops loose bits, decimates to 14k triangles, stands it on the floor |
| `views.py` | Front and side pictures, for finding the joints |
| `rig.py` | Skeleton from `<id>.json` (19 bones, plus two for a cape if the file lists `cape1` and `cape2`), automatic skin weights, and every move (below) |
| `export.py` | Keeps only the colour texture (1024 px JPEG), writes the GLB with each move as its own animation |
| `preview.py` | Pictures of the poses, to check the moves before trying them in the app |

Xira's model has no cape, so `xira.json` leaves the cape bones out. The first model (Caelis, from Tripo) went from 2 million triangles, three 4K textures and 62 MB to 14k triangles,
one 1024 px texture and 0.8 MB.

Every model gets the same moves, so a new figure can use any weapon the toy figures can (`js/armory.js`):

| For | Moves |
|---|---|
| Standing, moving, being hit | idle, walk, hit, down, block, dodge |
| Swords, daggers, axes, clubs | chop, cut, poke |
| Two-handed weapons | slam, sweep, thrust |
| Fists | jabs, hook |
| A weapon in each hand | twin, flurry, scissor |
| From a distance | bow, xbow, sling, throw |
| Magic | cast |

`js/aikit.js` picks the move for the weapon in hand, the same way a toy figure does; with no weapon it is the plain
sword (chop), bow or staff. Each hand has a grip bone the weapon hangs on, and each pose says which way that weapon
points (`p.aim`), so a weapon never depends on how the wrist happens to be turned.

The moves are written a frame at a time from timing curves in `rig.py`, the same for every model: the feet stay
planted (the legs reach for a handle at each ankle, baked into plain bone turns on export), the arm follows the body
a beat late, and the cape swings on a spring. Leave `cape1` and `cape2` out of `<id>.json` for a character with no cape.
`_palmTwist` is how far the arms turn so the palms face the legs (Tripo's A-pose has them facing forward).
To watch a move, open `preview.html?model=<id>&solo=1`.

Tripo's own rig wasn't used: its export had no skeleton. If a later export has one, the moves in `rig.py` still
need our bone names, so it's simpler to keep using this skeleton.

Blender's automatic weights fail on a model this small (every point came out unweighted), so `rig.py` scales it up 10 times
first. `js/aikit.js` sizes it back to the toy figure of its race.

## Notes for later: Tripo's parts mode and a clothing kit

The idea: one base body per race, plus outfit parts made to fit it, all on the same skeleton.

- Tripo can split a model into parts two ways: a `generate parts` option at generation time, and a segment step on a
  finished model (v1 by shape, v2 by meaning, which is in beta and has a coarse or fine setting).
  At least one platform's docs say generating in parts **can't be combined with textures**, so parts may come back
  untextured and need a texture pass of their own. Check that in Tripo's own app before planning around it.
- For parts to swap, every outfit has to be skinned to the same skeleton as the base body. `rig.py` could weight each part
  separately from the same `<id>.json`, so a race's body and its outfits share one set of joints.
- Parts made from separate pictures won't line up by themselves. Making the outfit from a picture of the base body
  wearing it, then cutting the outfit out with the segment step, is more likely to fit.
- Where parts overlap (a coat over a shirt), the hidden body under the clothes should be deleted or it pokes through
  when the figure moves.
