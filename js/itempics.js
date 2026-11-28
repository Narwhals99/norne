/* ---------- item pictures (Jack, 2026-11-28) ----------
   Every item shows a picture wherever it appears: the catalog, stores, inventories, crafting, selling.
   The GM can upload one per catalog item (it.pic, an "fs:" picture everyone may load, framed square like an emoji).
   Inventory rows carry it as x.pic and store items as pic, because players' devices have no catalog.
   An item without one gets a placeholder made here on any device from its name and kind: a game-icons.net shape
   (js/itemglyphs.js, CC BY 3.0) picked by words in the name (dagger, longbow, potion...), coloured by the material
   it is made of (silver, obsidian, oak...) on a tile tinted by its kind. Nothing is stored for a placeholder. */
(function(){
const N = window.N, {esc} = N;
/* [kind, words in the name, shape]. The item's own kind is tried first, then every kind (a "Silver dagger" filed as a
   trinket still gets a dagger), then the kind's own shape. Order matters: "throwing axes" before "axe", "shield" before "scale" */
const RULES = [
  ['weapon', /knuckle|knuckle-?duster/, 'brass-knuckles'], ['weapon', /throwing kni|throwing dagger/, 'thrown-daggers'], ['weapon', /throwing star|shuriken/, 'shuriken'],
  ['weapon', /javelin/, 'thrown-spear'], ['weapon', /throwing ax|hatchet|tomahawk/, 'hatchet'], ['weapon', /crossbow/, 'crossbow'], ['weapon', /longbow|greatbow/, 'bow-arrow'],
  ['weapon', /\bbow\b|shortbow/, 'pocket-bow'], ['weapon', /sling\b/, 'sling'], ['weapon', /quiver/, 'quiver'], ['weapon', /arrow|\bbolts?\b/, 'arrow-cluster'],
  ['weapon', /\bshot\b|bullet|sling ?stone/, 'stone-sphere'], ['weapon', /greatsword|great sword|claymore|zweihander/, 'two-handed-sword'],
  ['weapon', /shortsword|short sword|gladius/, 'gladius'], ['weapon', /sword|blade|sabre|saber|rapier|scimitar|katana|cutlass/, 'broadsword'],
  ['weapon', /stiletto|dirk/, 'stiletto'], ['weapon', /dagger|knife|knives/, 'plain-dagger'], ['weapon', /waraxe|war axe|greataxe|great axe/, 'war-axe'],
  ['weapon', /battleaxe|battle axe|\baxe/, 'battle-axe'], ['weapon', /warhammer|war hammer|maul/, 'warhammer'], ['weapon', /\bpick\b|war pick/, 'hammer-nails'],
  ['weapon', /morning ?star|flail|spiked mace/, 'spiked-mace'], ['weapon', /mace/, 'flanged-mace'], ['weapon', /(spik|stinger|tooth|lined).*club/, 'spiked-bat'],
  ['weapon', /club|cudgel|bludgeon/, 'wood-club'], ['weapon', /glaive|scythe/, 'glaive'], ['weapon', /halberd|polearm|poleaxe/, 'halberd'], ['weapon', /trident/, 'trident'],
  ['weapon', /spear|pike|lance/, 'spear-feather'], ['weapon', /staff|quarterstaff|\bbo\b/, 'bo'],
  ['armor', /shield|buckler/, 'checked-shield'], ['armor', /helm|helmet|coif/, 'visored-helm'], ['armor', /scale/, 'scale-mail'], ['armor', /mail|chain/, 'chain-mail'],
  ['armor', /leather|hide|padded|gambeson/, 'leather-armor'],
  ['clothing', /cloak|cape|mantle/, 'cape'], ['clothing', /robe|gown|dress/, 'robe'], ['clothing', /boot/, 'leather-boot'], ['clothing', /sandal|shoe/, 'sandal'],
  ['clothing', /glove|gauntlet|mitten/, 'gloves'], ['clothing', /hood/, 'hood'], ['clothing', /\bhat\b|cap\b/, 'pointy-hat'], ['clothing', /trouser|pants|breeches|leggings/, 'trousers'],
  ['magic', /wand/, 'crystal-wand'], ['magic', /orb|crystal ball|scrying/, 'crystal-ball'], ['magic', /rune|talisman/, 'rune-stone'], ['magic', /staff/, 'wizard-staff'],
  ['magic', /crystal|shard/, 'crystal-cluster'],
  ['potion', /poison|venom|toxin/, 'poison-bottle'], ['potion', /flask|vial|tincture/, 'round-bottom-flask'], ['potion', /potion|elixir|tonic|draught|brew/, 'standing-potion'],
  ['book', /scroll/, 'scroll-unfurled'], ['book', /spell|grimoire|tome|codex/, 'spell-book'], ['book', /letter|note|map|deed|contract/, 'scroll-quill'],
  ['food', /ale|beer|mead|stout/, 'beer-stein'], ['food', /wine/, 'wine-bottle'], ['food', /water|milk|juice|jug|flagon/, 'jug'], ['food', /bread|loaf|bun|biscuit|cake/, 'bread'],
  ['food', /cheese/, 'cheese-wedge'], ['food', /chicken|fowl|goose|duck|pheasant/, 'roast-chicken'], ['food', /ham|pork|bacon|leg of/, 'ham-shank'],
  ['food', /stew|soup|porridge|rice|broth|bowl/, 'bowl-of-rice'], ['food', /meat|jerky|steak|venison|ration/, 'meat'],
  ['trinket', /ring\b/, 'diamond-ring'], ['trinket', /pearl/, 'pearl-necklace'], ['trinket', /amulet|pendant|locket/, 'gem-pendant'], ['trinket', /necklace|chain/, 'gem-necklace'],
  ['trinket', /crown|circlet|tiara/, 'crown'], ['trinket', /coin|token/, 'two-coins'], ['trinket', /gem|jewel|emerald|ruby|sapphire|diamond/, 'emerald'],
  ['illicit', /poison|venom/, 'poison-bottle'], ['illicit', /lockpick|picks\b|thieves/, 'lockpicks'], ['illicit', /pipe|smoke|weed|leaf|dust|powder/, 'smoking-pipe'],
  ['gear', /rope|cord/, 'rope-coil'], ['gear', /lantern|lamp/, 'old-lantern'], ['gear', /torch/, 'torch'], ['gear', /backpack|rucksack|\bpack\b|satchel/, 'backpack'],
  ['gear', /hammer|nail|tool|chisel|saw\b/, 'hammer-nails'], ['gear', /needle|sewing|thread/, 'sewing-needle'], ['gear', /scales\b/, 'scales'],
  ['ingredient', /mushroom|fungus|toadstool/, 'mushrooms'], ['ingredient', /feather|plume/, 'feather'], ['ingredient', /horn/, 'horn-internal'],
  ['ingredient', /tooth|teeth|fang|claw/, 'tooth'], ['ingredient', /herb|leaf|leaves|flower|root|petal|moss|weed/, 'herbs-bundle'],
  ['craft', /\bore\b/, 'ore'], ['craft', /gold/, 'gold-bar'], ['craft', /ingot|\bbar\b|bars\b/, 'metal-bar'], ['craft', /log|plank|timber|lumber|wood/, 'wood-pile'],
  ['craft', /stone|rock|marble|granite|obsidian/, 'rock'], ['craft', /wool|cloth|linen|silk|fabric|hide|pelt|fur/, 'wool'],
  ['other', /chest|coffer|strongbox/, 'locked-chest'],
];
const KIND_GLYPH = {weapon:'broadsword', armor:'breastplate', clothing:'cape', magic:'magic-swirl', potion:'potion-ball', ingredient:'herbs-bundle', craft:'anvil',
  food:'bread', book:'book-cover', trinket:'gem-necklace', illicit:'lockpicks', gear:'light-backpack', other:'swap-bag'};
/* the kind's colour, at the tile's edge and on shapes not made of a known material */
const KIND_TONE = {weapon:'#7d3a2c', armor:'#365a78', clothing:'#6d4a7e', magic:'#4a3f96', potion:'#2c7360', ingredient:'#4f6e2c', craft:'#73592f',
  food:'#94592a', book:'#5c3e29', trinket:'#93721a', illicit:'#3c3c44', gear:'#5d4b38', other:'#5a5a5a'};
/* the material in the name colours the shape. The first one named wins ("Iron and oak crossbow" is iron) */
const MATS = [
  ['dwarven steel', '#8fa8c4'], ['dragon tooth', '#eadfc2'], ['dragon scale', '#3f8152'], ['unicorn horn', '#f4eefb'], ['unicorn', '#f4eefb'], ['manticore', '#9a3d2a'], ['manicore', '#9a3d2a'],
  ['mammoth ivory', '#efe5cb'], ['ivory', '#efe5cb'], ['moonstone', '#c6d3ee'], ['meteorite', '#6e5b86'], ['obsidian', '#2e2838'], ['weevil', '#7a6a3c'], ['silver', '#dfe4ec'],
  ['steel', '#b4bfca'], ['iron', '#868d96'], ['bronze', '#b07a3a'], ['brass', '#c9a24a'], ['copper', '#b8673a'], ['gold', '#e0b43c'], ['stone', '#9a948c'],
  ['ironwood', '#4f4943'], ['redwood', '#94402c'], ['whitewood', '#e6dcc4'], ['kapok', '#c8a673'], ['bamboo', '#9db46a'], ['willow', '#ab8e5b'], ['oak', '#9c6b3a'],
  ['pine', '#7d6a43'], ['palm', '#a67c49'], ['bone', '#e8dfc8'], ['leather', '#8d5a32'], ['phoenix', '#e0662c'], ['owlbear', '#7c5b3b'], ['kenku', '#3c3c4c'],
  ['crystal', '#a9d6ec'], ['emerald', '#2f9a5c'], ['ruby', '#c0283c'], ['sapphire', '#2f5fc0'],
].sort((a, b) => b[0].length - a[0].length);
const low = s => String(s || '').toLowerCase();
N.itemGlyph = (name, kind) => {
  const n = low(name), k = N.itemKind(kind)[0];
  const hit = RULES.find(r => r[0] === k && r[1].test(n)) || RULES.find(r => r[1].test(n));
  return hit ? hit[2] : KIND_GLYPH[k] || 'swap-bag';
};
N.itemMat = name => { const n = low(name); let best = null, at = 1e9;
  for (const [w, c] of MATS) { const re = new RegExp('\\b' + w + '\\b'), m = re.exec(n); if (m && m.index < at) { at = m.index; best = c; } } return best; };
/* a dark colour gets a light outline so it still reads on the tile */
const dark = hex => { const v = parseInt(hex.slice(1), 16); return ((v >> 16) * .3 + ((v >> 8) & 255) * .59 + (v & 255) * .11) < 70; };
const PH = new Map();
N.itemPh = (name, kind) => {
  const k = N.itemKind(kind)[0], gl = N.itemGlyph(name, k), fill = N.itemMat(name) || KIND_TONE[k], key = gl + fill + k;
  if (PH.has(key)) return PH.get(key);
  const tone = KIND_TONE[k] || '#5a5a5a', d = (window.ITEM_GLYPHS || {})[gl] || '', edge = dark(fill) ? '#efe6d2' : '#221b16';
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512"><defs><radialGradient id="g" cx="50%" cy="42%" r="70%"><stop offset="0" stop-color="#f6efdd"/><stop offset=".62" stop-color="#e6d8b8"/><stop offset="1" stop-color="${tone}"/></radialGradient></defs>`
    + `<rect width="512" height="512" fill="url(#g)"/><rect width="512" height="512" fill="${tone}" opacity=".10"/><ellipse cx="256" cy="452" rx="150" ry="22" fill="#000" opacity=".16"/>`
    + `<g transform="translate(76 66) scale(.703)"><path d="${d}" fill="${fill}" stroke="${edge}" stroke-width="18" stroke-linejoin="round" paint-order="stroke"/></g></svg>`;
  /* a short blob: address shared by every copy on screen (like N.show). One that dies (an iPhone clearing memory in the
     background) is made again on the next redraw; one that keeps failing becomes a data: address */
  let url;
  try { if ((BAD.get(key) || 0) >= 2) throw 0; url = URL.createObjectURL(new Blob([svg], {type:'image/svg+xml'})); PHK.set(url, key); }
  catch(e) { url = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg); }
  PH.set(key, url); return url;
};
const PHK = new Map(), BAD = new Map();
let _phR = 0;
if (typeof document !== 'undefined') document.addEventListener('error', e => {
  const t = e.target, u = t && t.tagName === 'IMG' ? String(t.getAttribute('src') || '') : '', key = PHK.get(u); if (!key) return;
  PHK.delete(u); PH.delete(key); BAD.set(key, (BAD.get(key) || 0) + 1);
  clearTimeout(_phR); _phR = setTimeout(() => N.renderAll && N.renderAll(), 60);
}, true);
/* what an item looks like: a catalog item, a store item or an inventory row ([name, qty, note, icon, x]) */
const facts = x => {
  if (Array.isArray(x)) { const xx = N.invX(x), it = N.rowItem(x); return {name:x[0], kind:N.rowKind(x), pic:(it && it.pic) || xx.pic || ''}; }
  const it = x && x.it && typeof x.it === 'string' && N.itemById(x.it);
  return {name:x && x.name, kind:x && x.kind, pic:(x && x.pic) || (it && it.pic) || ''};
};
N.itemPicOf = x => facts(x).pic || '';
/* the picture as an <img> in a square box. size: '' (the small square in lists), 'big' (store cards, the editor) */
N.itemPic = (x, size) => {
  const f = facts(x), up = f.pic ? N.show(N.imgUrl(f.pic)) : '';
  const src = up || N.itemPh(f.name, f.kind);
  return `<span class="ipic${size ? ' ' + size : ''}${up ? ' up' : ''}"><img src="${esc(src)}" alt="" loading="lazy" decoding="async"${up ? ` style="${N.frameCss(f.pic)}"` : ''}></span>`;
};
})();
