"""Builds js/itemglyphs.js: the shapes on the placeholder item pictures (js/itempics.js).
The shapes are game-icons.net icons (CC BY 3.0, see CREDITS.md), fetched from github.com/game-icons/icons.
Run:  python3 tools/item-glyphs.py   (needs internet)"""
import json, re, urllib.request
ICONS = {
 'delapouite': 'brass-knuckles hatchet wood-club flanged-mace spear-feather bo two-handed-sword war-axe warhammer glaive bow-arrow sling quiver leather-armor herbs-bundle mushrooms wood-pile wool bread wine-bottle jug spell-book scroll-quill diamond-ring pearl-necklace two-coins lockpicks smoking-pipe rope-coil old-lantern torch backpack light-backpack cape gloves sandal',
 'lorc': 'plain-dagger stiletto wood-axe broadsword battle-axe spiked-mace trident wizard-staff halberd thrown-daggers shuriken thrown-spear pocket-bow arrow-cluster stone-sphere breastplate scale-mail checked-shield visored-helm standing-potion potion-ball round-bottom-flask poison-bottle feather horn-internal tooth metal-bar rock anvil meat cheese-wedge beer-stein roast-chicken book-cover scroll-unfurled gem-pendant emerald crown gem-necklace hammer-nails sewing-needle scales robe leather-boot hood pointy-hat trousers crystal-wand crystal-ball rune-stone crystal-cluster magic-swirl locked-chest swap-bag',
 'skoll': 'gladius spiked-bat ham-shank', 'carl-olsen': 'crossbow', 'willdabeast': 'chain-mail round-shield gold-bar',
 'faithtoken': 'ore', 'caro-asercion': 'bowl-of-rice',
}
out = {}
for author, names in ICONS.items():
    for n in names.split():
        svg = urllib.request.urlopen(f'https://raw.githubusercontent.com/game-icons/icons/master/{author}/{n}.svg').read().decode()
        ps = [p for p in re.findall(r'<path[^>]*\sd="([^"]+)"', svg) if p != 'M0 0h512v512H0z']
        out[n] = re.sub(r'(\.\d)\d+', r'\1', ' '.join(ps))
js = ('/* the shapes on the placeholder item pictures (js/itempics.js): game-icons.net icons by ' + ', '.join(sorted(ICONS))
      + ' (CC BY 3.0, see CREDITS.md). 512x512. Made by tools/item-glyphs.py, do not edit by hand */\n'
      + 'window.ITEM_GLYPHS=' + json.dumps(dict(sorted(out.items())), separators=(',', ':')) + ';\n')
open('js/itemglyphs.js', 'w').write(js)
print(len(out), 'shapes,', len(js), 'bytes')
