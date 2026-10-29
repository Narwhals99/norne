# Norne

The table for our Fate campaign in Nörne: chat, rolls, combat, maps, news, wiki and character sheets.
It runs on GitHub Pages and keeps everything in Firebase (Google sign-in + Firestore), on the free plan.

**Play:** https://narwhals99.github.io/norne/

## How it fits together

- `index.html` is a small shell that loads the app:
  - `js/core.js` holds the shared state and the Fate rules (ladder, dice, stress, combat helpers).
  - `js/views.js`, `js/combat.js` and `js/sheets.js` draw the screens, the fight board and the pop-up sheets.
  - `js/app.js` handles taps, typing and drags. `js/sync.js` signs people in and keeps Firestore in step.
  - `css/app.css` is every style (night and day themes; phone and desktop layouts by container query).
  - `art/` holds the scene backdrops and portraits, `img/` small decorations, `maps/` the atlas images.
- `vendor/firebase.js` is the Firebase SDK (13.0.0) bundled into one file.
- The GM's device keeps the full campaign in `gm/*` documents and writes a player-safe copy to `game/*`.
  Players can only read `game/*`, their own private chat, and the maps the GM has shared.
  Wiki entries, maps and news editions the GM shares with only some players go to `only/<seat>` instead,
  which only that player can read.
- `js/notify.js` and `sw.js` show notifications on devices where the person turned them on (You > **Notifications**).
  They work while Norne is open, also in a background tab or on an iPhone home screen; a ping with Norne
  fully closed would need a push server, which the free Firebase plan doesn't include.
- `firestore.rules` enforces that. After changing it, paste it into
  Firebase console > Firestore Database > Rules and press **Publish**.
- Anyone can sign in with Google, but only accounts the GM lets in (You > **Players and sign-ins**) can see anything.

## Lore

The lore with GM secrets is **not** in this repo, because the repo and site are public.
The GM imports it once from `norne-gm-lore.json` (You > **Import lore**), and it lives in Firestore from then on.

## Testing locally

Serve the folder (for example `python3 -m http.server`) and open `/?emu=1` with the Firebase
emulators running (`firebase emulators:start --only firestore,auth`).
In the browser console, `__emuSignIn('someone@example.com', 'Their Name')` signs in a test account
(use the GM's address to test as the GM).

## Credits

The art is free to use, and some licenses ask for credit. See [CREDITS.md](CREDITS.md); the app shows the
same list under You > **Art credits**.
