# Mixamo skeleton and moves

Since 2026-11-23 a character can use Mixamo's skeleton and its recorded moves instead of the hand-written ones in
`../rig.py` (Jack: "mixamo can do much better animations"). Xira is the first. `js/aikit.js` plays both kinds.

## Per character

1. Tripo makes the model; `..\make.ps1 -Src <tripo>.glb -Id <id>` cuts it down (step 1 is enough: it leaves
   `%TEMP%\norne-aimodel\<id>\prep.blend`).
2. Make the file to upload, the cut-down model with its colours:
   `blender -b %TEMP%\norne-aimodel\<id>\prep.blend --python tofbx.py -- <id>-for-mixamo.fbx`
   (Mixamo's rigger gave up without an error on Tripo's full 2-million-triangle Xira; the small file went through.)
3. In Mixamo: upload it, place the markers, let it rig, pick any move, Download, FBX, **With Skin**.
4. `blender -b --factory-startup --python mxbuild.py -- <with skin>.fbx <moves folder> moves.json <prep.blend> ..\..\..\models\<id>.glb`
5. List it in `MODELS` in `js/aikit.js` as before.

## The moves (once)

Downloaded once from Mixamo, FBX, **Without Skin**, into one folder (Jack's: `Downloads\norne\moves`). `moves.json`
says which file plays for each of the app's moves and how it is fitted to the fight board's clock: where the blow lands,
which stretch of the recording is used, and what to do with a move that walks off its spot. To add or swap a move,
download it, add or change its line, and rebuild.

The app's moves that have no Mixamo file yet play the nearest one that does (`ALT` in `js/aikit.js`): thrust uses
poke, flurry and scissor use twin, a crossbow uses bow, a sling or a thrown weapon uses chop.

`mxbuild.py` also gives each hand a `grip` bone for weapons (out of the thumb side of the fist), takes the colours and
the smooth shading from `prep.blend` (Mixamo's file carries neither), and keeps Mixamo's finger bones.

Moves downloaded on one character play on any other. Mixamo's Without Skin files rest in a T-pose, while the rigged
model rests in the pose it was uploaded in (Tripo's A-pose), so a bone's turn can't be copied across as it is: that put
the arms through the body. `mxbuild.py` reads each bone's direction from the move's own skeleton and lays this model's
bone along it (`fit`).

A character's own file (`<id>.json`) can name moves of its own, an idle say, and `_armSpace` (degrees) to hold the upper
arms a little further out on a stocky figure.
