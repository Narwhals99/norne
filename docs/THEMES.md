# Styles and themes: the design guide

Everything we have learned about Norne's looks, in one place, so a new look can be built right the first time.
Read it before you add a style, change a colour, or build any new screen (new screens have to work in every look too).

**Words used here**

- A **style** is a whole look that people pick under Profile > **Style**: today *Storybook* (the default), *Parchment & Wax*,
  *Oak & Iron*, *Sketchbook*, *4-the-gerleez*, *Onyx & Gold* and *Liquid*.
- A **theme** is **Night** or **Day** (Profile > **Appearance**). Every style has both, so there are fourteen looks today (Liquid also has six colour schemes, see 2.11).
- Both are saved per device in `localStorage` (`norne-style`, `norne-theme`), like the text size (`norne-fz`).
  Two devices on the same account can each show a different look.

---

## 1. Jack's rules

These came straight from Jack. They are not up for debate inside a theme PR.

1. **A style changes the look, never the function.** "ABSOLUTELY NO CHANGE TO FUNCTION. I'm just talking about the vibe."
   Colours, fonts, textures, corner shapes, shadows and small ornaments only. Every button stays where it is, the same size,
   doing the same thing. No markup or JS changes beyond the one `N.STYLES` entry.
2. **The default stays exactly as it is.** Adding a style must leave Storybook pixel-identical (we checked 14 screens when
   Parchment went in; do the same). A new look is an *extra* choice in the Style picker, never a replacement.
3. **Night and Day, phone and desktop, every time.** A style is not done until all four (look × device) are designed.
4. **Show Jack screenshots before merging**, phone *and* desktop, for every look you touched (house rule for every UI change).
   Jack merges by saying "merge".
5. **Your own messages are on the right, everyone else's on the left**, like every messaging app.
6. **Meta glass (out-of-character bubbles)** must look like liquid glass in every look, and **your own and other people's
   glass must have clearly different tints** in every look and theme. A light theme's glass needs a real tint (in Storybook
   Day it is green), never near-white on a near-white page. **Any glass change applies to the wiki rows too** (they share the tokens).
7. **In-character bubbles stand apart from the glass**: solid panes tinted with the speaker's colour, NPCs with a doubled edge.
8. **It must not look AI-generated.** Jack rejected an early illuminated-book look and the "War Table" layout for feeling
   generic and clunky. What worked: a clear reference (Jack sent pictures for Storybook Night and Day), real free fonts and
   icon sets, and restraint. Simple drawings made in code (trees, castles, lanterns) came out flat and clip-art-like next to
   his painted references; if a look needs illustrations, ask Jack for reference art or use real free art.
9. **Free assets only**, with the license credited in `CREDITS.md` *and* in the in-app list (`N.creditsHtml` in `js/sheets.js`).
10. **The repo and the site are public.** No lore, GM secrets or private screenshots in the repo.

---

## 2. How a style is wired

A style is three small additions. Nothing else in the app should need to know about it.

| Where | What to add |
| --- | --- |
| `js/core.js`, `STYLES` | `{id, name, sub, night:{bg, card, ink, acc, hi}, day:{...}}`. `name` and `sub` show on the picker card; the swatch colours draw its little Night and Day preview. `N.styleOk` falls back to `storybook` for an unknown id. |
| `css/<id>.css` | The look itself. Every selector starts with `.app:where([data-style="<id>"])` (see 2.1). |
| `index.html` | A `<link rel="stylesheet" href="css/<id>.css">` **after** `css/app.css`; any new fonts added to the one Google Fonts `<link>`; and `body:has(.app[data-style="<id>"])` / `...[data-theme="day"]` backgrounds in the inline `<style>` (2.4). |
| `art/ui/` | Textures, seals and other pictures the style uses. Keep tiles small (the parchment tiles are ~640px JPGs). |
| `CREDITS.md` + `N.creditsHtml` | Every font and asset with its license. |

`render()` in `js/app.js` sets `data-style` and `data-theme` on `.app` on every draw, so the switch is instant and needs no reload.

### 2.1 Scoping and specificity

- Write every rule as `.app:where([data-style="<id>"]) .thing{...}`. `:where()` adds **zero** specificity, so the rule is exactly
  as specific as the `app.css` rule it reskins, and wins only because the style sheet loads later. That keeps the cascade
  predictable and stops a style from fighting the app.
- Day overrides: `.app:where([data-style="<id>"])[data-theme="day"] .thing`.
- **Gotcha (found with the glass):** when `app.css` itself has a `[data-theme]` or extra-class rule for the same element, the
  zero-specificity style rule loses to it. Add `[data-theme]` (any value) to your selector to win in both themes, as
  `parchment.css` does for own Meta bubbles: `.app:where([data-style="parchment"])[data-theme] .m.ooc.mine .bub`.
- Ornaments are pseudo-elements with `pointer-events:none` so they can never block a tap.
- Keep **every** rule for a style in its own file. One Parchment rule for the attack words (`.fxt b`) ended up in `app.css`
  when the animations were built; put such rules in the style's file.

### 2.2 Paths

- Inside a CSS file, art paths are relative to the CSS file: `url("../art/ui/parchment.jpg")`.
- In the `N.STYLES` swatches (they become inline styles on the page), paths are relative to the page: `art/ui/parchment.jpg`.

### 2.3 Fonts

- All fonts load through the single Google Fonts `<link>` in `index.html`. Add families there (and to the theme kit harness,
  which copies that link automatically).
- Use OFL fonts. Set fallbacks in each `--f-*` stack.
- If a family has no real bold, set `font-synthesis-weight:none` on the style (Parchment does) so browsers don't smear a fake bold.
- Old-style and display faces run small and thin. Body text in Parchment is 16px in bubbles and 17–18.5px in narration and
  the wiki to read like the Storybook sizes. Check every text size (2.6) after choosing fonts.

### 2.4 The page behind the app

`index.html` paints `html,body` dark indigo (`#060819`) and switches it with `body:has(.app[data-theme="day"])` and
`body:has(.app[data-style="parchment"]...)`. That colour shows in the iPhone notch area, during rubber-band scrolling and for a
moment while loading. Give every new style a Night and a Day body colour that matches its `--sky-*`.

Known gap: `<meta name="theme-color">` and `manifest.webmanifest` stay `#060819` for every look (status bar tint on Android,
home-screen splash). Nothing updates them per style or theme yet.

### 2.5 Text size (per device)

Profile > **Text size** (`N.FONT_SIZES`) multiplies every font size. When it is not Normal, `fzSet` in `js/app.js` rewrites every
`px` font size and line height in every same-origin stylesheet once to `calc(px * var(--fz))`, and `fzInline` does the same to
inline styles after each draw. So:

- Write font sizes in **px** as usual; they scale for free, also in a new style sheet.
- Use **rem** only for a size that must *not* scale.
- A new stylesheet must be same-origin (in `css/`) to be rewritten.

### 2.6 Container queries, not media queries

Phone vs desktop is decided by the device frame: `@container dev (max-width: 759px)` / `(min-width: 760px)`, the same as
`app.css`. Use those, not `@media` widths, or the harness and the real app disagree.

### 2.7 Frames and buttons from a UI art pack (border-image)

Jack found that colour-only styles look like "plain panels with color schemes". *Oak & Iron* (`css/oak.css`) shows how to put
real pack art (Kenney's UI Pack: Adventure, CC0) on the existing boxes without moving anything:

- Pack panels and buttons are 9-slice pictures, so they go on with `border-image`, e.g. a button
  `border-image:url("../art/ui/oak/btn-wood.svg") 8 fill / 8px` and `background:none`. The `/ 8px` width draws the art over the
  box's padding area, so the box keeps its size and nothing reflows. Leave out `fill` for a frame whose middle should stay the
  box's own colour.
- Bigger frames that sit on top of a panel (the desktop page, the sheet, the scene and fight cards) are a pseudo-element:
  `position:absolute;inset:0;pointer-events:none`. Put it at `z-index:-1` inside a box that has `isolation:isolate`, or above
  the content when it is only an edge.
- **Safari rule:** WebKit has a history of not painting `border-image` on a box without a border style, and a bare
  `border-style` gives a default `medium` border. To be safe, every box that wears art gets `border:1px solid transparent`,
  with its padding cut by 1px so the size stays the same (art pseudo-elements get
  `box-sizing:border-box;border:1px solid transparent`). The cloud container only has Chromium, so check the live site on an
  iPhone after merging.
- `border-image` ignores `border-radius`. Pick a radius that matches the art's corners (Oak sets 6px on every rounded `app.css`
  box) so focus rings and shadows follow the same shape.
- Turn the pack's PNGs into small files: recolour, cut out middles you don't need, wrap them in SVG. The script for Oak is in
  the project files at `/mnt/project-files/asset-theme/source/make_art.py`; the whole set is about 80 KB.

---

### 2.8 A look with no colour at all (Sketchbook)

*Sketchbook* (`css/sketch.css`) is black, white and greys by Night and Day, with one exception Jack asked for on 2026-11-05:
**success is green pencil and failure is red pencil** (plus/minus dice, roll and fight outcomes, the fight log icons, a hit result card,
the attack words). Those use the tokens `--ok`/`--bad` (+ `-ink`, `-soft`) in `sketch.css`; nothing else may be coloured, so things that
used `--jade` for other meanings are restyled grey there. `onlyokbad.py` (next to `nocolour.py`) checks that every coloured pixel is red
or green. What it learned:

- **Colour carries meaning in a few places; say it another way.** Speakers get their own hatch on their in-character bubbles
  (picked with `.m[style*="c-p3)"]`, since `--spk` is set inline as `var(--c-pN)`); zones get a hatch chosen from their picked
  colour (`.zone[style*="f4c46e"]`, and `--zc` forced with `!important`); plus dice are filled in, minus dice left open, blank
  dice hatched; outcomes are a solid block (with style), a doubled line (success), dashed (tie) and dotted with cross-hatch (fail);
  the main button and your own messages are a solid block of charcoal (Day) or white pastel (Night).
- **Pictures:** `filter:grayscale(1)` on `img`, picture boxes (`.art`, `.thumb`, `.scenecard`...) and anything with an inline
  `url(` background; the attack animation layer (`.board .cam>svg`, `.fxt`) too. `--map-grade` and `--glass-filter` include `grayscale(1)`.
- **Emoji:** put `'Noto Emoji'` (Google Fonts, the black-and-white emoji font) in every `--f-*` stack, after the main font.
- **Inline colours** in the JS (map pin kinds, zone colours, the wordmark gradient) are overridden or greyed per element; there is
  no filter on the whole app (it would make every scroll repaint through a filter on iPhone).
- **Check it with pixels:** `nocolour.py` in `/mnt/project-files/sketch-theme/source/` reads every theme-kit screenshot and
  reports any pixel whose red, green and blue differ. All 56 screens came out at 0.
- The art (paper, pencil frames, charcoal blocks, hatch tiles) is drawn by `make_sketch_art.py` in the same folder and saved as
  grey-only PNG/JPG (`L`/`LA`), so it cannot carry colour. The stylesheet is written as `sketch.src.css` with short placeholders
  (`@S`, `@D`...) and expanded by `build.sh`.

### 2.9 A look from a fixed palette (4-the-gerleez)

*4-the-gerleez* (`css/gerleez.css`, id `gerleez`) was built on 2026-11-07 from a five-colour palette Jack sent as a picture:
blush `#FFABAB`, peach `#FFC3A0`, rose `#FF677D`, dusty rose `#D4A5A5` and plum `#392F5A`. What it learned:

- **Four light colours and one dark one.** Every light colour fails contrast against the others (1.2–1.8:1), so the look is
  plum against lights: Night is a plum ground with blush/peach ink, Day is blush paper with plum ink. Only shades of the five
  are used: plum with a touch of black for the Night sky, the lights with a whisper of white for Day paper, and rose mixed into
  plum (`#a64e6d`, `#92486a`, "berry") wherever Day needs a coloured text or a button dark enough for light ink.
- **Rose fails as text on Day paper** (2.8:1), so Day text uses berry (`--accent-tx`, `--gold-tx`, `--ember`), and rose is
  kept for fills. Plum ink on rose is 4.3:1, so things on rose use the darker sky plum `#1f1a32` (6:1).
- **No green in the palette:** success is peach and failure/harm is rose; dice are a peach tile for +, a rose tile for − and a
  blush tile for blank, all with plum glyphs, so the sign also reads without colour.
- **Speaker colours** are eight shades of the palette; they are closer together than in other looks, so names and avatars carry
  the difference as before.
- **Art (Jack asked for "cutesy fonts, flowers, sparkles"):** Twemoji SVGs (CC BY 4.0, npm `@twemoji/svg`) recoloured to the palette
  by mapping each fill to the nearest palette colour by hue and lightness, saved in `art/ui/gerleez/` (~80 KB): cherry blossom
  wordmark, sparkles for every star (`.spark`, `.star4`, the open tab), hearts for fate points (`.coin`) and free invokes, a posy on
  the scene banner (`.scene::after`), a bow on top of every sheet (replaces the drag handle), and a scattered flower/sparkle/heart
  tile on the backdrop (`--g-dots`). All overlays are pseudo-elements with `pointer-events:none`; nothing moves.
- Fonts: Cherry Bomb One (titles and wordmark, one weight only, so `font-synthesis-weight:none`), Fredoka (interface),
  Playpen Sans (descriptions and aspect cards). All OFL.
- Kept out on purpose: portraits, maps, GM-picked zone and pin colours, and the fixed attack animation colours (4.5).

### 2.10 A look made of materials (Onyx & Gold)

*Onyx & Gold* (`css/lux.css`, id `lux`) was built on 2026-11-12. Jack asked for every surface to be a material and for no
plain-colour empty space, in muted black, silver, white and gold. Night is black open-pore wood, smoked glass, brushed gunmetal
and gold; Day is pale ash, frosted glass, brushed aluminium and gold. What it learned:

- **One brush tile makes every metal.** `art/ui/lux/brush.jpg` is a neutral grey hairline tile. A metal is three background
  layers, a sheen gradient, the tile and a base gradient, with `background-blend-mode:normal,overlay,normal`. The stacks live in
  the tokens `--mat-steel`, `--mat-gold` and `--mat-glass`, so Day only swaps the base colours. Restate the blend mode wherever a
  stack is used.
- **Empty space is the backdrop's job.** `--sky-art` is the wood tile under a soft overhead light, two faint reflection streaks
  and a vignette, so a short chat or an empty page still shows grain.
- **Gold is for the eye only:** the open tab, main buttons, send, your own in-character lines, titles. Titles use a metal
  gradient with `background-clip:text` (`--goldtext`, `--silvertext`).
- **Textures are generated**, not downloaded (the proxy blocks texture sites): periodic noise filtered in frequency space gives
  tileable wood and brushed metal. The script and the stylesheet source are in the project files under `premiere-theme/source/`.
- Jack's verdict: fine to keep, but not the slick, glossy, bubbly Apple-like look he wanted. That is a separate style.
- Not done yet: a contrast audit, an iPhone check of the extra `backdrop-filter` panels, and a designed desktop pass.

### 2.11 A glossy look with colour schemes (Liquid)

*Liquid* (`css/gloss.css`, id `gloss`) was built on 2026-11-12 after Jack said Onyx & Gold was not what he meant by materials:
he wanted "slick, smooth, glossy, bubbly, like Apple's UI". What it learned:

- **Glossy means convex and floating.** Every surface is a translucent pane with a bright top rim, a soft shine across the top
  (a radial gradient above the box) and a glow along the bottom edge (`--gl-bg`, `--gl-edge`, `--btn-bg`, `--au-bg`, `--au-edge`).
  The tab bar is a floating glass capsule drawn as `.tabbar::before`, so the bar's own box and buttons do not move.
- **Empty space is light, not texture:** the backdrop pictures (`art/ui/gloss/<scheme>-night.jpg` and `-day.jpg`) are black satin or
  pearl with sweeping light and big glass orbs, generated by script.
- **Colour schemes are the first style option.** A style may list `pals:[{id, name, a, b}]` in `N.STYLES`. The Style picker shows
  them under the card of the style in use, the choice is saved per device (`norne-pal`), and `render()` sets `data-pal` on `.app`
  (`N.palOk` falls back to the first scheme). `gloss.css` holds the first scheme in full and, for each other scheme, only the
  declarations that differ, as `.app:where([data-style="gloss"]):where([data-pal="<id>"]) ...` (zero extra specificity, later
  in the file, so it wins).
- **Do not write scheme blocks by hand.** `variants.py` in the project files (`premiere-theme/glossy/source/`) recolours every
  gold-ish colour of `gloss.src.css` to the scheme's accent, swaps the backdrop, and writes the whole stylesheet and the pictures.
  Change the source and run it again.
- Not done yet: a contrast audit per scheme, an iPhone check of the many `backdrop-filter` panes, and designed transitions.

### 2.12 Day edges (every style)

On 2026-11-13 Jack found Day hard to read in almost every style: panels, cards, rows, chips and bubbles had no visible edge.
The cause was the Day hairline tokens (`--line*` at 9-17% ink). `css/edges.css`, loaded after every style sheet, re-sets them in
Day only from one `--edge-rgb` per style (the style's own line hue) at 36/54/74%, gives Meta glass a thin dark outline (its white
rims vanish on a pale page), makes the Depth contact shadow crisper by day and draws a line above the phone tab bar (not Oak or
Liquid, which have their own). Night is untouched. **A new style must add its `--edge-rgb` line there**, and should not set Day
`--line*` lighter than this.

On 2026-11-14 Jack also asked for thicker panel borders: on desktop the chat page edge, the side panel's left edge and the line
between the two side panels are 3px `--line-2` in every style, Night and Day (also in `css/edges.css`; Oak keeps its frame and
gets a 4px rim on the side panel). The phone chat list drawer gets a 3px edge too.

## 3. The token contract

`app.css` draws everything from custom properties on `.app`. A style mostly redefines these for Night (on
`.app:where([data-style="<id>"])`) and Day (`...[data-theme="day"]`). **Define every token below for both themes.** If you skip
one, the Storybook value leaks into your look (a violet glow on parchment, for example).

| Group | Tokens | Notes |
| --- | --- | --- |
| Backdrop | `--sky-0` `--sky-1` `--sky-2` `--sky-art` | `--sky-art` is the whole-app background (gradients, texture, vignette). Storybook Night also shows the `.stars` layer; hide it if the style has its own backdrop (`.stars{display:none}`). Storybook Night alone also gets `css/sky.css`: faint pencil doodles (`.sketchsky`, plus the desktop `.page`/`.ff-list`) and stars that glint (`.glints`), both scoped to `[data-style="storybook"]` at night. |
| Surfaces | `--page` `--page-solid` `--raise` `--raise-2` `--sunk` | Panels, cards, insets. `--page-solid` is also the ring colour around badges and avatars. Parchment adds `--page-bg` / `--paper-bg` texture stacks. |
| Lines | `--line` `--line-2` `--line-3` | Hairlines from faint to strong. |
| Ink | `--ink` `--ink-2` `--ink-3` `--ink-4` | Text from strongest to faintest. `--ink-3` and `--ink-4` are used for times, captions and labels; they are the first things to fail contrast (section 5). |
| Accent | `--accent` `--accent-2` `--accent-3` `--accent-ink` `--accent-soft` `--accent-glow` | Selection, primary buttons, own message bubble. |
| Gold | `--gold` `--gold-2` `--gold-3` `--gold-ink` `--gold-soft` | Highlights, fate points, icons. |
| Status | `--ember` `--ember-soft` `--jade` `--jade-soft` `--link` | Ember = danger/hits/unread; jade = success. |
| **Text versions** | `--gold-tx` `--accent-tx` `--ember-ink` | **Use these for text**, never `--gold`/`--accent` (those are for fills and icons). `--ember-ink` is the text on ember badges. Each look tunes them to stay readable. |
| People | `--c-p1` … `--c-p8` `--c-gm` `--c-npc` `--c-foe` | Seat colours (names, avatar rings, in-character tint, tokens). Must read as text on the page *and* tint a bubble. Night wants light pastels, Day wants deep inks. |
| In character | `--say-top` `--say-bot` | How strongly the speaker colour tints other people's in-character bubbles (percent at top/bottom of the bubble). |
| Meta glass | `--glass-tint` `--glass-tint-2` `--glass-mine` `--glass-mine-2` `--glass-mine-rim` `--glass-sheen` `--glass-rim` `--glass-rim-2` `--glass-rim-3` `--glass-shadow` `--glass-filter` | See 4.1. `tint` = other people's glass and closed wiki rows; `mine` = your own glass and the open wiki row. |
| Cards | `--card-paper` `--card-ink` `--card-rule` `--card-line` | Aspect cards (`.icard`), which stay light paper in every look. |
| Pictures | `--map-grade` `--map-tint` | A CSS filter and an overlay so the map and fight backdrops sit in the look. |
| Shape and depth | `--shadow-1` `--shadow-2` `--scrim` `--r-xs`…`--r-xl` | Radii can change; sizes and spacing cannot. |
| Type | `--f-mark` `--f-display` `--f-ui` `--f-paper` `--f-mast` (+ any of your own, Parchment adds `--f-body`) | Wordmark, titles, interface, newspaper, blackletter masthead. |
| Ornament | `--star4` `--engrave` | `--star4` is the mask used for every sparkle/star; Parchment swaps it for a cross pattée. |

Storybook's values are the top of `css/app.css` (`.app{...}` and `.app[data-theme="day"]{...}`), with a few more further down
(`--say-*`, `--glass-*`, `--c-p3`…`--c-p8` under "Live site additions"). `css/parchment.css` is the worked example of a full set.

---

## 4. Surfaces that need special care

Go through each of these in all four combinations of Night/Day × phone/desktop.

### 4.1 Meta bubbles: liquid glass (`.m.ooc .bub`)

- Built in `app.css` from the `--glass-*` tokens: a translucent tint, `backdrop-filter:var(--glass-filter)` so it blurs and
  brightens what is behind it, a curved top sheen (radial gradient) and a 1px rim (`::after`, masked) that is bright at the
  top-left and fades. A style should normally only set the tokens.
- **Others vs mine:** pick two clearly different hues per look. Today: Storybook Night blue-silver / violet, Storybook Day sage /
  leaf green, Parchment Night candle amber / wax red, Parchment Day cream / sepia.
- **Keep the blur at 5–6px.** More looks nicer but makes long chats stutter on iPhone.
- GIFs and emoji-only messages have no bubble and stay plain.
- **The wiki category and entry rows (`.cat`, `.ent`) use the same glass and tokens.** Check them whenever the glass changes.
- If your style restyles own bubbles (`.m.mine .bub`), make sure the own Meta bubble still gets glass (2.1 gotcha). Parchment
  once showed a second own Meta message as an in-character scrap because of exactly this.

### 4.2 In-character bubbles

- Other players' and NPC lines (`.m.say:not(.mine) .bub`) are **solid** panes tinted with the speaker colour (`--spk`, set inline
  from the speaker) via `--say-top/--say-bot`, with a 3px lit left edge. NPCs (`.npc`) get a doubled edge.
- Your own bubble and the narrator are not speaker-tinted.
- Text inside quotes is speech in the normal font; everything else is wrapped in `.rpd` and set in the italic description
  font (`--f-display` in Storybook, `--f-body` in Parchment). Style `.rpd` and `em` together. Don't reuse the class name
  `.act`, it is a button.
- **Own bubble text is hard-coded white** in `app.css` (`.m.mine .bub{color:#fff}`), so `--accent-2`/`--accent-3` must be dark
  enough for white text in both themes, or the style must restyle `.m.mine .bub` completely (Parchment does: light paper by
  night, dark ink-wash by day, with a wax edge).

### 4.3 Narration, rolls and results

- Narrator text (`.narr`) reads like a printed page with a drop cap (`.narr.first p::first-letter`).
- Roll cards (`.roll`, `.die`, `.out`) and result cards (`.resm`) carry numbers that must be readable at a glance: the total in
  `--gold-tx`, dice faces with clear + / − colours.
- Desktop fight rolls and results live in the Recent actions rail (`.rcnt`, `.rc-roll`); phone rolls show as one-line `.rl` rows.

### 4.4 Pictures under text

Scene banners (`.scene`), fight cards (`.fightcard`), picture thumbnails (`.thumb`) and token names on the board (`.tok .nm`)
all put text or buttons on a photo. Each needs a glaze or gradient (`::before`/`::after`) in **both** themes, and white text on
photos needs a text-shadow. The "Change scene" button once went white-on-white in Day because its glaze was missing (see 6).

### 4.5 Combat board and attack animations

- `--map-grade` / `--map-tint` tone the fight backdrop; zones (`.zone`), token names, the current-turn highlight and the
  "taken out" cross must still stand out.
- The attack animation colours (sword, bow, bolt, HIT!/BLOCKED! words in `js/fx.js`) are fixed and outlined in near-black, so
  they read on any look. A style may change the word font (`.fxt b`), not the colours.
- Always check with wide zones as well as narrow ones.

### 4.6 Things that keep their own look

- The **newspaper** (`.paper`) always looks like paper (a style may give it its own paper texture).
- **Aspect cards** (`.icard`) are always light paper, also at night.
- Game-icons and portraits stay as they are; a style may tone them (Parchment adds a light sepia filter).

### 4.7 The Style picker card

Check that your style's card (`.stc`) and its little Night/Day swatch look right in *every* style, since the picker is drawn in
the look currently in use.

---

## 5. Contrast and readability

Jack asked for this pass after text and buttons were hard to read in some looks. The measured audit found 736 hard-to-read
texts on main before the fix (239 very bad, mostly Storybook Day) and brought the very bad ones to 14 false alarms.

**Targets:** WCAG AA, **4.5:1** for body text and **3:1** for large text (24px+, or 18.7px+ bold) and for icons. Measure against
what is really behind the text (texture, glass, picture), not the token colour.

**What went wrong before, and the rule that came out of it**

- Gold and accent used as text colours on pale Day backgrounds nearly vanished. **Text uses `--gold-tx` / `--accent-tx`.**
- Grey labels (`--ink-3`, `--ink-4`) were too light in Day and too dark at Night. **Make the faint inks darker in Day, lighter at Night.**
- White text on ember badges was unreadable. **Text on ember uses `--ember-ink`** (dark at Night, white in Day).
- Own bubbles were too light for their white text. Keep the own-bubble gradient deep (4.2).
- Picture labels needed a text-shadow (4.4).
- Inline styles in the JS markup must use tokens (`color:var(--gold-tx)`), never hex: a style sheet cannot override an inline
  colour without `!important`.

**Drift since then (baseline run on 2026-10-31, theme kit):** a few later features went back to `var(--gold)` or `#fff` for text,
e.g. `.gmban .t small`, `.modeseg .nb` (white on ember), `.rl .rlv`, `.rcnt .rc-h svg`, `.sysm.fend b`, `.ff.end .fft b`,
`.top.dt .ibtn[aria-pressed="true"]`. Other spots under target: message times (`.who time`) and wiki row captions (`.ent small`)
in Parchment, the GM desk's stress labels in Storybook Day. Fix these the next time someone touches them, and don't add more.

---

## 6. CSS gotchas we hit

- **A colour can only be the last background layer.** `background: <color> padding-box, <gradient> border-box` is invalid and
  the whole declaration is dropped (that is how the scene buttons went white-on-white). Wrap the colour in a gradient:
  `linear-gradient(c, c) padding-box, <gradient> border-box`.
- `backdrop-filter` needs the `-webkit-` prefix too for Safari/iPhone.
- **iPhone zooms into any text box under 16px** and then the page slides sideways. `.inp` and the composer `textarea` are 16px;
  a style must never make an input's font smaller on phones.
- Nothing may push the page wider than the screen on phones (long words in bubbles, roll lines). `overflow-wrap:anywhere` is set
  on bubbles and narration; keep it if you restyle them.
- `:where(.app,.app *){touch-action:manipulation}` stops double-tap zoom; don't add `touch-action` rules in a style.
- Respect `prefers-reduced-motion` for any new animation (ornament shimmer, glow pulses).
- Don't wipe app.css shapes you didn't mean to: a style that sets `background` on an element also replaces its gradient border
  trick (`padding-box`/`border-box`), so restate both.

---

## 7. Making a new style, step by step

1. **Get the direction from Jack:** a name, a one-line vibe, reference pictures if he has them, and what Night and Day should feel
   like. Write the picker `sub` line from that.
2. **Collect assets** (OFL fonts, CC/MIT icons, free textures). The cloud container's proxy blocks many art sites (ambientCG,
   OpenGameArt and Poly Haven were blocked); Google Fonts and generating textures yourself (Python + Pillow) work.
   When a site is blocked, Jack can download the zip and share the folder from his computer (that is how the Kenney pack came
   in). Note every license as you go.
3. **Branch from main** and add the `N.STYLES` entry, `css/<id>.css`, the `<link>`, fonts and `body:has` backgrounds (section 2).
4. **Tokens first** for Night and Day (section 3), then per-component touches (section 4). Start by copying `parchment.css`'s
   structure; it is ordered by screen.
5. **Run the theme kit** (below) for every screen × Night/Day × phone/desktop. Look at every picture, then run the contrast audit
   and fix what it flags (section 5).
6. **Prove nothing else moved:** shoot Storybook and Parchment on main and on your branch and compare (pixel-identical, apart from
   clocks; the kit freezes motion).
7. **Credits:** `CREDITS.md` and `N.creditsHtml`.
8. **Open the PR** with side-by-side sheets of the new look (phone and desktop, Night and Day) and the Style picker. Say there is
   no Firebase rules change. Wait for Jack's "merge".
9. **After merging:** GitHub Pages takes about a minute to deploy and browsers may keep old files; `sw.js` makes every load check
   for fresh `.html/.js/.css`, but tell Jack to press Ctrl+Shift+R (Cmd+Shift+R) on desktop or close and reopen Norne on the
   phone if it looks unchanged. Then check the live site in every look.

## 8. Changing an existing look, or building any new screen

- A change to a shared surface (glass, bubbles, buttons) must be designed and screenshotted for **every style × Night/Day**,
  not just the one you're looking at.
- New UI: use the tokens (section 3), `--gold-tx`/`--accent-tx` for text, `--ember-ink` on ember, no hex colours in inline
  styles, px font sizes. Then check it in all four looks; if a style needs a special touch for it, put that rule in the
  style's own file.

---

## 9. The theme kit

An offline copy of the app with a fake table, plus scripts to screenshot every look and measure contrast. It lives in the
project's shared files at `/mnt/project-files/theme-kit/` (not in this repo, because it carries a copy of the lore). Its README
has the details; the short version:

```sh
cp -r /mnt/project-files/theme-kit $SCRATCH/kit
sh $SCRATCH/kit/setup.sh /home/user/norne                       # offline app at http://localhost:8765/harness.html
node $SCRATCH/kit/shots.js $SCRATCH/out --styles storybook,<id>  # 14 screens × looks × phone/desktop
python3 -I $SCRATCH/kit/sheet.py $SCRATCH/out                    # side-by-side sheets for Jack
node $SCRATCH/kit/shots.js $SCRATCH/audit --audit --styles <id> && python3 -I $SCRATCH/kit/contrast.py $SCRATCH/audit
```

`baseline/` in the kit holds the contrast report and chat sheets for main on 2026-10-31 to compare against.

Quirk: the kit's `roll` screen does not open the roll sheet for a player (`role=p1`). To see the roll sheet, open
`harness.html?role=gm&run=document.querySelector(".diceb").click()`.

---

## 10. History, for context

- **2026-10-28** First look: an illuminated campaign book (leather, vellum, blackletter, wax seals). Jack later called it
  "AI-looking".
- **2026-10-29** Three directions mocked up (Guild Hall, War Table, Chronicle). Jack picked War Table, then rejected it after
  testing ("clunky" on iPhone and desktop): the old layout was fine, only the UI assets were ugly. Jack sent a reference picture
  and Storybook Night was built from it (deep indigo, violet glow, gold sparkles, pill buttons); a second reference gave the green
  and gold Storybook Day. Own messages moved to the right.
- **2026-10-30** Parchment & Wax (papyrus, iron-gall ink, red wax, IM Fell and Alegreya) as a preview with "absolutely no change to
  function"; Jack asked for it as an alternate, which created the Style picker (PR #38).
- **2026-10-31** Text size per device and the contrast tokens (PR #40). Liquid glass Meta bubbles (PR #49), then own/others tints,
  glass on wiki rows, speaker-coloured in-character bubbles, quotes as speech, and OOC renamed to Meta (PR #51).
- **2026-10-31** Oak & Iron, the first style built from a real UI art pack (Kenney UI Pack: Adventure, CC0): wooden and iron
  frames, wooden/red/gold buttons, a red ribbon on sheet titles, Vollkorn, Nunito and Grenze. Jack picked the pack from a few
  free options because the earlier styles looked like "plain panels with color schemes".
- **2026-11-05** Sketchbook: Jack asked for a black and white look, "black coloured pencil, black pastel", artsy and notebook-like,
  with no colour anywhere. Kalam, Caveat and Fredericka the Great, Noto Emoji for emoji, and pencil art drawn by script.
- **2026-11-07** 4-the-gerleez: Jack sent a five-colour palette (blush, peach, rose, dusty rose, plum) as the only colours allowed.
  Plum velvet by night, blush paper by day, recoloured Twemoji flowers, sparkles, hearts and a bow; Cherry Bomb One, Fredoka, Playpen Sans.
