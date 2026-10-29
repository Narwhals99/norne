# Norne

The table for our Fate campaign in Nörne: chat, rolls, combat, maps, news, wiki and character sheets.
It runs on GitHub Pages and keeps everything in Firebase (Google sign-in + Firestore), on the free plan.

**Play:** https://narwhals99.github.io/norne/

## How it fits together

- `index.html` is the whole app. `vendor/firebase.js` is the Firebase SDK (13.0.0) bundled into one file.
- The GM's device keeps the full campaign in `gm/*` documents and writes a player-safe copy to `game/*`.
  Players can only read `game/*`, their own private chat, and the maps the GM has shared.
- `firestore.rules` enforces that. After changing it, paste it into
  Firebase console > Firestore Database > Rules and press **Publish**.
- Anyone can sign in with Google, but only accounts the GM lets in (menu > **Players**) can see anything.

## Lore

The lore with GM secrets is **not** in this repo, because the repo and site are public.
The GM imports it once from `norne-gm-lore.json` (menu > **Import lore**), and it lives in Firestore from then on.

## Testing locally

Serve the folder (for example `python3 -m http.server`) and open `/?emu=1` with the Firebase
emulators running (`firebase emulators:start --only firestore,auth`).
