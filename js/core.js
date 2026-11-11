/* Norne: shared game state, Fate rules and the helpers every screen uses.
   N.G holds what came from Firestore (see sync.js); screens only read it and actions change it,
   then N.save() writes the changed parts back. */
(function(){
const N = window.N = {};

/* ---------- helpers ---------- */
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
/* text marks, Discord style (see N.FMT_GUIDE): **bold**, *italics* or _italics_, __underline__, ~~strike~~, ||spoiler||.
   marks() works on text that is already escaped; inl() escapes, marks and keeps line breaks */
const marks = h => h
  .replace(/\|\|([^|\n]+)\|\|/g, '<span class="spoil" tabindex="0" title="Spoiler, tap to see">$1</span>')
  .replace(/\*\*([^*\n]+)\*\*/g, '<strong>$1</strong>')
  .replace(/__([^_\n]+)__/g, '<u>$1</u>')
  .replace(/~~([^~\n]+)~~/g, '<s>$1</s>')
  .replace(/\*([^*\n]+)\*/g, '<em>$1</em>')
  .replace(/(^|[^\w:])_([^_\n]+)_(?![\w:])/g, '$1<em>$2</em>');
const inl = s => marks(esc(s)).replace(/\n/g,'<br>');
const LI = /^\s*(?:[-•*]|(\d{1,3})[.)])\s+(.*)$/;
/* splits text into plain runs, lists and > quotes; each plain run, list item and quote line goes through inline() */
const blocks = (s, inline = inl) => {
  const ls = String(s ?? '').split('\n'), out = [];
  let run = [], list = null, quote = null;
  const flushRun = () => { if (run.length) { out.push(inline(run.join('\n'))); run = []; } };
  const flushList = () => { if (list) { out.push(`<${list.tag} class="fl"${list.tag === 'ol' && list.start !== 1 ? ` start="${list.start}"` : ''}>${list.items.map(t => `<li>${inline(t)}</li>`).join('')}</${list.tag}>`); list = null; } };
  const flushQuote = () => { if (quote) { out.push(`<blockquote class="fq">${inline(quote.join('\n'))}</blockquote>`); quote = null; } };
  for (const l of ls) {
    const q = l.match(/^\s*>(?:\s(.*))?$/);
    if (q) { flushRun(); flushList(); (quote = quote || []).push(q[1] || ''); continue; }
    flushQuote();
    const m = l.match(LI);
    if (!m) { flushList(); run.push(l); continue; }
    const tag = m[1] ? 'ol' : 'ul';
    flushRun(); if (list && list.tag !== tag) flushList();
    if (!list) list = {tag, start:m[1] ? +m[1] : 1, items:[]};
    list.items.push(m[2]);
  }
  flushQuote(); flushList(); flushRun();
  return out.join('');
};
/* links the GM puts in wiki text and on cards with Insert link: [[pc:<id>|Name]], [[npc:<id>|Name]], [[wiki:<id>|Title]].
   A link keeps only the id and the name the GM typed. Whoever can't see what it points to reads the plain name, no link.
   xl() works on text that is already escaped, before marks() */
const LINK_RE = /\[\[(pc|npc|wiki):([\w-]+)\|([^\]\n]+)\]\]/g;
/* can this screen open it: a wiki entry it can read, a card the GM has, or (players) their own card or one whose name was revealed */
N.linkSees = (k, id) => { const g = N.G, gm = g.role === 'gm';
  if (k === 'wiki') return g.wiki.some(e => e.id === id && (gm || !e.gm));
  return gm ? !!(g.chars[id] || g.npcs.some(n => n.id === id)) : N.charOf(g.role)?.id === id || !!g.known?.[id]?.name; };
const xl = h => h.replace(LINK_RE, (m, k, id, lab) => N.linkSees(k, id) ? `<a class="wl" data-a="${k === 'wiki' ? 'wiki' : 'cardView'}" data-v="${id}">${lab}</a>` : lab);
/* card text with its marks and links (aspects, stunts, bio as text) */
N.linkText = s => marks(xl(esc(s)));
/* the copy a player gets: links they can't follow become the plain name (seeOk(kind, id) says which they can) */
N.linkScrub = (x, seeOk) => x == null ? x : JSON.parse(JSON.stringify(x).replace(LINK_RE, (m, k, id, lab) => seeOk(k, id) ? m : lab));
/* the link to put in text: the name loses anything that would end the link early */
N.linkTok = (k, id, name) => `[[${k}:${id}|${String(name || '').replace(/[[\]\n|]+/g, ' ').replace(/\s+/g, ' ').trim() || '…'}]]`;
/* the wiki pages the GM linked to a PC or NPC card (Wiki pages on the sheet): G.wlinks = {cardId:[entry ids]}.
   The GM keeps them in gm/misc; each player gets only the ones they can read, for cards they can see (only/<seat> l:<card>) */
N.cardWiki = id => { const g = N.G, gm = g.role === 'gm'; return ((g.wlinks || {})[id] || []).map(w => g.wiki.find(e => e.id === w && (gm || !e.gm))).filter(Boolean); };
/* the words without the marks, for notifications (a spoiler stays hidden there) */
N.plainText = t => String(t ?? '').replace(LINK_RE, '$3').replace(/\|\|[^|\n]+\|\|/g, '(spoiler)').replace(/\*\*([^*\n]+)\*\*/g, '$1').replace(/__([^_\n]+)__/g, '$1').replace(/~~([^~\n]+)~~/g, '$1').replace(/\*([^*\n]+)\*/g, '$1').replace(/(^|[^\w:])_([^_\n]+)_(?![\w:])/g, '$1$2').replace(/^\s*>\s/gm, '');
/* the formatting guide (chat's smiley button > Formatting, and the Formatting button over long forms) */
N.FMT_GUIDE = [['**bold**','Bold'],['*italics*  or  _italics_','Italics','*italics*'],['__underline__','Underline'],['~~strike~~','Strike'],['||spoiler||','Spoiler, hidden until tapped'],
  ['> a quote','Quote, chat only','> a quote',1],['- item','List, chat only','- item\n- item',1],['1. first','Numbered list, chat only','1. first\n2. second',1],[':name:','Custom emoji']];
const fmt = s => blocks(s);
let _n = 0; const uid = p => p + Date.now().toString(36) + (++_n).toString(36) + Math.random().toString(36).slice(2,6);
const clamp = (v,a,b) => Math.max(a, Math.min(b, v));
const sgn = n => (n < 0 ? '−' : '+') + Math.abs(n);
const IC = (k, cls='') => { const i = (window.ICONS||{})[k]; return i ? `<svg viewBox="${i[0]}" class="${cls}" aria-hidden="true" fill="currentColor">${i[1]}</svg>` : ''; };
const STAR = '<svg viewBox="0 0 24 24" aria-hidden="true" fill="currentColor"><path d="M12 0c.9 6.6 4.6 10.6 12 12-7.4 1.4-11.1 5.4-12 12-.9-6.6-4.6-10.6-12-12 7.4-1.4 11.1-5.4 12-12z"/></svg>';
const MARK = '<svg viewBox="0 0 48 48" aria-hidden="true"><defs><linearGradient id="mk" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ffe9b0"/><stop offset="1" stop-color="#d9973f"/></linearGradient></defs><path fill="url(#mk)" d="M24 2c1.6 11 7.6 18 20 22-12.4 4-18.4 11-20 22-1.6-11-7.6-18-20-22C16.4 20 22.4 13 24 2z"/><path fill="none" stroke="url(#mk)" stroke-width="1.2" opacity=".7" d="M24 12c.8 5.4 3.8 9 10 12-6.2 3-9.2 6.6-10 12-.8-5.4-3.8-9-10-12 6.2-3 9.2-6.6 10-12z"/></svg>';
Object.assign(N, {esc, fmt, blocks, inl, marks, xl, uid, clamp, sgn, IC, STAR, MARK});

/* ---------- styles: whole looks picked under Profile > Style, each with a Night and a Day ----------
   A new style is one entry here plus its own stylesheet scoped to .app[data-style="<id>"] (see css/parchment.css).
   docs/THEMES.md has the rules and checks a style needs.
   The swatches only draw the little preview card in the picker. */
const STYLES = [
  {id:'storybook', name:'Storybook', sub:'Starry indigo by night, green and gold by day',
    night:{bg:'#0b0e2a', card:'#232864', ink:'#efecff', acc:'#8c7cff', hi:'#f4c46e'},
    day:{bg:'#f1e9d0', card:'#fffcf2', ink:'#27301b', acc:'#5e8a2e', hi:'#d29b2a'}},
  {id:'parchment', name:'Parchment & Wax', sub:'Papyrus, old ink and red sealing wax',
    night:{bg:'#1b130c url(art/ui/vellum-night.jpg) 0 0/180px', card:'#3b2d1f', ink:'#f0e2c4', acc:'#b8322b', hi:'#e0b263'},
    day:{bg:'#dcc79d url(art/ui/parchment.jpg) 0 0/180px', card:'#fbf4e1', ink:'#2a1c0f', acc:'#9b2320', hi:'#9a6a1c'}},
  {id:'oak', name:'Oak & Iron', sub:'Wooden frames, iron corners and red ribbons',
    night:{bg:'#1e2733 url(art/ui/oak/stripes-night.svg) 0 0/24px', card:'#3a2919', ink:'#fff1d2', acc:'#b5483f', hi:'#f0bd55'},
    day:{bg:'#aabdcc url(art/ui/oak/stripes-day.svg) 0 0/24px', card:'#fff1d2', ink:'#3a2513', acc:'#c6594f', hi:'#d9a03a'}},
  {id:'sketch', name:'Sketchbook', sub:'Pencil, charcoal and pastel. Black and white only',
    night:{bg:'#141414 url(art/ui/sketch/paper-night.jpg) 0 0/180px', card:'#2a2a2a', ink:'#f3f3f3', acc:'#f0f0f0', hi:'#8c8c8c'},
    day:{bg:'#e9e9e9 url(art/ui/sketch/paper-day.jpg) 0 0/180px', card:'#ffffff', ink:'#141414', acc:'#1a1a1a', hi:'#8c8c8c'}},
  {id:'gerleez', name:'4-the-gerleez', sub:'Blush, peach and rose with plum ink. Flowers, sparkles and hearts',
    night:{bg:'#292241', card:'#483b62', ink:'#fff0f0', acc:'#FF677D', hi:'#FFC3A0'},
    day:{bg:'#ffe6e0', card:'#fff6f1', ink:'#392F5A', acc:'#a64e6d', hi:'#FFABAB'}}
];
N.STYLES = STYLES;
N.styleOk = id => STYLES.some(s => s.id === id) ? id : 'storybook';
/* text sizes under Profile > Text size, saved per device like the style; k multiplies every font size */
const FONT_SIZES = [{id:'s', name:'Small', k:.9}, {id:'m', name:'Normal', k:1}, {id:'l', name:'Large', k:1.12}, {id:'xl', name:'Larger', k:1.25}, {id:'xxl', name:'Largest', k:1.4}];
N.FONT_SIZES = FONT_SIZES;
N.fzOk = id => FONT_SIZES.some(f => f.id === id) ? id : 'm';
N.fzK = id => (FONT_SIZES.find(f => f.id === id) || FONT_SIZES[1]).k;

/* ---------- Fate on the Nörne ladder ---------- */
const LADDER = {9:'Beyond Mythic',8:'Mythic',7:'Legendary',6:'Renowned',5:'Expert',4:'Great',3:'Good',2:'Fair',1:'Average',0:'Mediocre','-1':'Poor','-2':'Terrible'};
/* past Mythic the ladder has no more words: +9 to +12 all read Beyond Mythic */
const ladderWord = v => LADDER[clamp(v,-2,9)];
/* one step up or down a card's skill: +0 means "not on the card", so a skill goes from Average (+1) straight to Poor (−1) */
N.skillStep = (x, d) => { let y = (+x || 0) + d; if (y === 0) y += d; return clamp(y, -1, 8); };
const MUNDANE = ['Athletics','Riding','Stealth','Fighting','Shooting','Strength','Will','Crafting','Crime','Resources','Contact','Search','Empathy','Notice','Deception','Provoke','Rapport','Lore'];
/* skills that need a discipline (Skills.docx). A magic gives exactly one; the others can gather more. */
const DISC = {
  Fighting:['Hand-to-Hand','Swords & Blades','Hatchets & Axes','Maces & Hammers','Spears & Staffs'],
  Shooting:['Throwing','Bows','Crossbows','Slings','Magnetic Projectors'],
  Crafting:['Survival','Alchemy','Smithing','Leather Working','Fletching'],
  Lore:['Medicine','History','Nature','Navigation','Underworld'],
  'Elemental Magic':['Flame Casting','Earth Casting','Water Casting','Air Casting','Thunder Casting','Light Casting'],
  'Ward Magic':['Guard Warding','Cover Warding'],
  'Healing Magic':['Heal Casting'],
  'Conjuring Magic':['Necromancy','Manifestation','Summoning'],
  'Alteration Magic':['Transfiguration','Transmutation','Duplication'],
  'Illusion Magic':['Obfuscation','Hallucination'],
  'Spatial Magic':['Phase Casting','Teleportation','Portal Casting'],
  'Mind Magic':['Telepathy','Mindslaving'],
  'Divination Magic':['Omnipresence','Clairvoyance','Retrosight'],
  'Enchantment Magic':[],
};
/* magical skills can only be rolled by someone who has them */
/* the peoples of Nörne (Attributes.xlsx), offered when typing a race */
/* nationalities offered when typing one: the nation pins on the maps and the wiki's Nations entries (GM's device) */
N.nations = () => [...new Set([...(N.G.maps || []).flatMap(m => (m.pins || []).filter(p => p.type === 'nation').map(p => p.label)), ...(N.G.wiki || []).filter(e => e.cat === 'Nations').map(e => e.title || e.name)].filter(Boolean).map(x => String(x).trim()))].sort();
N.RACES = ['Human','Half-Elf','Elf','Dwarf','Goblin','Centaur','Werewolf','Vampire','Gorgon','Bugfolk','Kenku','Gnome','Fishfolk','Satyr','Lizardfolk','Ogre'];
const MAGIC = ['Elemental Magic','Ward Magic','Healing Magic','Conjuring Magic','Alteration Magic','Illusion Magic','Spatial Magic','Mind Magic','Divination Magic','Enchantment Magic'];
const discOf = (o, k) => { const x = (o.disc || {})[k]; return Array.isArray(x) ? x : x ? [x] : []; };
const stressVals = r => r <= -1 ? [2] : r === 0 ? [1,2] : r <= 2 ? [1,2,2] : [1,2,2,3];
const ACTIONS = [['Overcome','overcome'],['Create an advantage','advantage'],['Attack','attack'],['Defend','defend']];
const diceSum = r => r.dice.reduce((a,b)=>a+b,0);
/* an invoke is +2, or a reroll of all four dice (marked reroll:true, adds nothing). One made by the other side
   against a roll with nothing rolled on their side (opp:true) went onto r.opp, so it doesn't count here either */
const plusInvokes = r => (r.invokes||[]).filter(i => !i.reroll && !i.opp).length;
const rollTotal = r => diceSum(r) + r.bonus + 2*plusInvokes(r);
/* the skill's own share of r.bonus: gear, the distance debuff and the GM's buff or debuff are shown as their own parts */
N.skillPart = r => r.bonus - (r.gear||0) + (r.dist||0) - (r.mod||0);
function outcome(r){
  if (r.opp == null) return null;
  /* r.shift: the GM's shifts added to or taken off the result afterwards (−6..+6); the roll itself stays as rolled */
  const sh = rollTotal(r) - r.opp + (r.shift || 0);
  if (sh < 0) return {k:'fail', t:'Fail', sh};
  if (sh === 0) return {k:'tie', t:'Tie', sh};
  if (sh < 3) return {k:'succ', t:'Success', sh};
  return {k:'style', t:'With style', sh};
}
/* Fate dice from the browser's secure random source (crypto.getRandomValues), not Math.random.
   A byte is 0..255; 255 is thrown away so the 255 left split evenly into three faces (85 each).
   getRandomValues is captured at load, so swapping it out later from the console changes nothing. */
const getRandom = crypto.getRandomValues.bind(crypto), rbuf = new Uint8Array(64);
let rpos = rbuf.length;
const fateDie = () => { let b; do { if (rpos >= rbuf.length) { getRandom(rbuf); rpos = 0; } b = rbuf[rpos++]; } while (b === 255); return b % 3 - 1; };
const rollDice = () => [fateDie(), fateDie(), fateDie(), fateDie()];
/* consequence slots: everyone has mild, moderate and severe; Strength and Will at Expert (+5) add a
   second mild for that kind of harm only, and at Legendary (+7) a second moderate too */
const consSlots = sk => {
  sk = sk || {}; const str = sk.Strength || 0, wil = sk.Will || 0, out = [];
  const add = (k, l, lo, hi, only) => out.push({k, l, lo, hi, only});
  add('mild', 'Mild', 1, 2);
  if (str >= 5) add('mildP', 'Mild', 1, 2, 'Physical');
  if (wil >= 5) add('mildM', 'Mild', 1, 2, 'Mental');
  add('moderate', 'Moderate', 3, 4);
  if (str >= 7) add('moderateP', 'Moderate', 3, 4, 'Physical');
  if (wil >= 7) add('moderateM', 'Moderate', 3, 4, 'Mental');
  add('severe', 'Severe', 5, 6);
  return out;
};
Object.assign(N, {DISC, MAGIC, discOf, consSlots});
/* a filled consequence slot has a state (Jake): Active when it is taken, then Stable or Recovering as the GM decides.
   Kept beside the slots as o.conSt = {<slot key>: 'stable'|'recovering'}; no entry means Active, so old cards need nothing */
N.CON_ST = [['active','Active'],['stable','Stable'],['recovering','Recovering']];
N.conSt = (o, k) => o && (o.cons || {})[k] ? ((o.conSt || {})[k] || 'active') : '';
N.conStL = st => (N.CON_ST.find(x => x[0] === st) || N.CON_ST[0])[1];
N.setConSt = (o, k, st) => { if (!o) return; const m = o.conSt = {...(o.conSt || {})};
  if (st && st !== 'active' && (o.cons || {})[k]) m[k] = st; else delete m[k];
  if (!Object.keys(m).length) delete o.conSt; };
Object.assign(N, {LADDER, ladderWord, MUNDANE, stressVals, ACTIONS, diceSum, plusInvokes, rollTotal, outcome});
/* locked so N.rollDice can't be replaced from the console to load the dice */
Object.defineProperty(N, 'rollDice', {value:rollDice, enumerable:true});

/* ---------- art ---------- */
const FACE = n => `art/pt/${n}-face.png`, BG = n => `art/bg/${n}.jpg`;
N.FACE = FACE; N.BG = BG;
N.ARTLIB = [
  ['town-alley','Back alley'],['river-bridge','River crossing'],['court-intrigue','A lord’s court'],['castle-ramparts','Castle walls'],
  ['plains-great-tree','Open plains'],['dark-forest','Dark forest'],['mountain-valley','Mountain valley'],['mountain-pass-raid','Mountain pass'],
  ['dwarven-hall','Dwarven hall'],['cave-temple-deep','Deep cave'],['city-gate','City gate'],['harbor-ship','Harbor'],['storm-sea-night','Storm at sea'],['castle-hill','Hill fort'],
].map(([k,l]) => ({id:'art-'+k, art:BG(k), label:l}));
N.FIGHTBG = 'art/bg/river-bridge.jpg';

/* Images kept in Firestore (uploaded maps, scene pictures, portraits) are named "fs:<id>". sync.js loads them. */
N.imgUrl = src => {
  if (!src) return '';
  src = N.picBase(src);
  if (!src.startsWith('fs:')) return src;
  return N.loadImg ? N.loadImg(src.slice(3)) : '';
};
/* a picture's framing rides on its name: "<src>#f=x,y,zoom[,shape]". x and y (0-100) say which part stays in view
   (like background-position), zoom is 1 or more, shape is width/height for wiki pictures. Unframed pictures show as before. */
N.picBase = src => String(src || '').split('#f=')[0];
N.picFrame = src => { const m = /#f=([\d.]+),([\d.]+),([\d.]+)(?:,([\d.]+))?$/.exec(src || ''); return m ? {x:+m[1], y:+m[2], z:+m[3], r:m[4] ? +m[4] : 0} : null; };
N.withFrame = (src, f) => N.picBase(src) + (f ? `#f=${+f.x.toFixed(1)},${+f.y.toFixed(1)},${+f.z.toFixed(2)}${f.r ? ',' + (+f.r.toFixed(3)) : ''}` : '');
const frameRule = f => f ? `;transform:scale(${f.z});transform-origin:${f.x}% ${f.y}%` : '';
/* style for an <img> that fills its box (object-fit:cover) */
N.frameCss = src => { const f = N.picFrame(src); return f ? `object-position:${f.x}% ${f.y}%` + frameRule(f) : ''; };
/* a background picture as its own layer, so it can be zoomed without zooming what sits on it */
N.bgPic = src => { const u = N.imgUrl(src); if (!u) return ''; const f = N.picFrame(src);
  return `<i class="pic" style="background-image:url(${esc(u)})${f ? `;background-position:${f.x}% ${f.y}%` + frameRule(f) : ''}"></i>`; };
/* a wiki picture: shown whole, or through its frame in the shape picked for it */
/* every picture in a news issue: the one over the lead, then one per story */
N.newsPics = i => [i.limg, ...(i.stories || []).map(st => st.img)].filter(Boolean);
N.wikiImg = (src, alt='') => { const u = esc(N.imgUrl(src)), f = N.picFrame(src);
  return f && f.r ? `<span class="wfr" style="--r:${f.r}"><img src="${u}" alt="${esc(alt)}" loading="lazy" style="${N.frameCss(src)}"></span>` : `<img src="${u}" alt="${esc(alt)}" loading="lazy">`; };
/* a portrait is a built-in key (art/pt/<key>-face.png), an "fs:" upload or nothing */
N.faceUrl = p => !p ? null : /^(fs:|data:|https?:|art\/|img\/)/.test(p) ? (N.imgUrl(p) || null) : FACE(N.picBase(p));

/* ---------- wiki and map vocab ---------- */
N.WCATS = ['World','Nations','Places','People','Races','Religions','Magic','Factions','History','Prophecies','Food & Drink','Items','Rules','Storylines'];
N.CATICON = {'World':'globe','Nations':'flag','Places':'places','People':'person','Races':'races','Religions':'religion','Magic':'magic','Factions':'faction','History':'history','Prophecies':'prophecy','Food & Drink':'drink','Items':'items','Rules':'rules','Storylines':'story'};
N.CATICONS = ['globe','flag','places','person','races','religion','magic','faction','history','prophecy','drink','items','rules','story','castle','tavern','crown','sword','helm','dwarf','potion','spellbook','skull','coins','scroll','mask','herald','campfire','star','heart'];
/* the GM can rename, add, remove and reorder categories (game/meta); until then the built-in list is used */
/* ---------- map folders: the GM sorts maps into folders (folders can sit in folders) ---------- */
/* G.mapDirs = [{id, name, in}] (in = the folder it sits in, null at the top); a map's folder is m.dir */
N.dirById = id => (N.G.mapDirs || []).find(d => d.id === id) || null;
N.mapDirOf = m => (m && N.dirById(m.dir)) ? m.dir : null;
N.dirKids = id => (N.G.mapDirs || []).filter(d => (N.dirById(d.in) ? d.in : null) === (id || null)).sort((a, b) => a.name.localeCompare(b.name));
N.dirPath = id => { const out = []; for (let d = N.dirById(id), n = 0; d && n < 20; d = N.dirById(d.in), n++) out.unshift(d); return out; };
N.dirName = id => N.dirPath(id).map(d => d.name).join(' › ');
/* the folder and every folder inside it */
N.dirTree = id => [id, ...N.dirKids(id).flatMap(d => N.dirTree(d.id))];
/* how many of the maps this person can see sit in the folder or below it */
N.dirCount = (id, see) => { const ids = new Set(N.dirTree(id)); return N.G.maps.filter(m => see(m) && ids.has(N.mapDirOf(m))).length; };
/* every folder as [id, "Riverlands › Drinkhold"], for pickers */
N.dirList = (skip) => { const out = [], walk = (id, d) => { for (const k of N.dirKids(id)) { if (k.id === skip) continue; out.push([k.id, N.dirName(k.id), d]); walk(k.id, d + 1); } }; walk(null, 0); return out; };
/* ---------- map levels and the default map ---------- */
/* the GM tags each map World, Nation, Region or City/Town (m.lvl); the lore's Nörne map counts as World until the GM says otherwise */
N.MLVLS = [['world', 'World'], ['nation', 'Nation'], ['region', 'Region'], ['city', 'City/Town']];
N.mapLvl = m => (m && m.lvl != null ? m.lvl : m && m.id === 'norne' ? 'world' : '') || '';
N.mapLvlName = m => (N.MLVLS.find(([k]) => k === N.mapLvl(m)) || [, ''])[1];
N.mapLvlRank = m => { const i = N.MLVLS.findIndex(([k]) => k === N.mapLvl(m)); return i < 0 ? 9 : i; };
/* the map someone lands on when they open the Maps tab: the GM's default (m.def) if they can see it, else a World map, else the first one */
N.defMap = gm => { const ms = N.G.maps.filter(m => gm || m.vis !== false); return ms.find(m => m.def) || ms.find(m => N.mapLvl(m) === 'world') || ms[0] || null; };
/* ---------- NPC folders: the GM sorts NPC cards into folders on the Cast page (folders can sit in folders) ----------
   G.npcDirs = [{id, name, in}] (GM-only, gm/misc); an NPC's folder is n.dir. Same shape as the map folders above */
N.nd = {
  byId: id => (N.G.npcDirs || []).find(d => d.id === id) || null,
  of: n => (n && N.nd.byId(n.dir)) ? n.dir : null,
  kids: id => (N.G.npcDirs || []).filter(d => (N.nd.byId(d.in) ? d.in : null) === (id || null)).sort((a, b) => a.name.localeCompare(b.name)),
  path: id => { const out = []; for (let d = N.nd.byId(id), n = 0; d && n < 20; d = N.nd.byId(d.in), n++) out.unshift(d); return out; },
  name: id => N.nd.path(id).map(d => d.name).join(' › '),
  tree: id => [id, ...N.nd.kids(id).flatMap(d => N.nd.tree(d.id))],
  /* the NPC cards in the folder or any folder inside it */
  npcs: id => { const ids = new Set(N.nd.tree(id)); return N.G.npcs.filter(n => ids.has(N.nd.of(n))); },
  /* every folder as [id, "Drinkhold › The Copper Tankard", depth], for pickers */
  list: skip => { const out = [], walk = (id, d) => { for (const k of N.nd.kids(id)) { if (k.id === skip) continue; out.push([k.id, N.nd.name(k.id), d]); walk(k.id, d + 1); } }; walk(null, 0); return out; },
};
N.cats = () => N.G.cats || N.WCATS.map(name => ({name, ic:N.CATICON[name] || 'globe'}));
N.catIcon = name => (N.cats().find(c => c.name === name) || {}).ic || N.CATICON[name] || 'globe';
/* every category with entries in it: the GM's list in order, then any an entry still names */
N.catNames = wiki => { const names = N.cats().map(c => c.name); for (const e of wiki) if (e.cat && !names.includes(e.cat)) names.push(e.cat); return names; };

/* ---------- who sees a wiki entry, a map or a news edition ----------
   Hidden (wiki gm:true, map vis:false) is GM only. Otherwise see:['p1',…] limits it to those seats; no see is everyone.
   A place on a map (kind 'pin') is hidden unless vis is true; see:['p1',…] with vis false shows it to those seats only. */
const hiddenOf = (x, kind) => kind === 'wiki' ? !!x.gm : kind === 'map' ? x.vis === false : kind === 'pin' ? x.type !== 'party' && !x.vis && !(Array.isArray(x.see) && x.see.length) : false;
/* a wiki entry's pictures: the lore's own picture (img) and any the GM added (imgs) */
N.wikiPics = e => { const seen = new Set(); return [...(e.img ? [e.img] : []), ...(e.imgs || [])].filter(p => p?.src && !seen.has(p.src) && seen.add(p.src)); };
/* wiki sections: each one is for everybody who can read the entry ('all'), some players ('some', see:[seats]) or the GM only ('gm').
   Old sections had no `to`: picked players made them 'some', nobody picked meant only the GM saw them */
N.partTo = p => p.to || (p.see?.length ? 'some' : 'gm');
/* the entry's sections in order. The lore's old GM notes (e.secret) show as a GM-only section until the GM saves the entry
   (sec:1 marks the section they became, so a lore re-import doesn't show them twice) */
N.wikiParts = e => { const ps = e.parts || []; return e.secret && !ps.some(p => p.sec) ? [...ps, {id:'sec', h:'GM notes', text:e.secret, to:'gm', sec:1}] : ps; };
/* every picture in an entry: its own, then each section's */
N.wikiAllPics = e => [...N.wikiPics(e), ...(e.parts || []).flatMap(p => p.imgs || [])];
N.audOf = (x, kind) => hiddenOf(x, kind) ? 'gm' : kind === 'pin' && (x.vis || x.type === 'party') ? '*' : (Array.isArray(x.see) && x.see.length ? x.see : '*');
N.audSet = (x, kind, val) => {
  const hide = h => { if (kind === 'wiki') { if (h) x.gm = true; else delete x.gm; } else if (kind === 'map') x.vis = !h; else if (kind === 'pin') x.vis = !h; };
  const cur = N.audOf(x, kind);
  if (val === '*' || val === 'gm') { hide(val === 'gm'); delete x.see; return; }
  const s = new Set(Array.isArray(cur) ? cur : []);
  s.has(val) ? s.delete(val) : s.add(val);
  if (s.size) { hide(false); x.see = [...s].sort((a,b) => a.slice(1) - b.slice(1)); if (kind === 'pin') x.vis = false; }
  else { delete x.see; hide(kind !== 'news'); }
};
/* the seats that can see it right now */
N.audSeats = (x, kind) => { const a = N.audOf(x, kind); return a === 'gm' ? [] : a === '*' ? N.seats() : a.filter(s => N.G.P[s]); };
/* "Mara", "Mara and Bryn", "Mara, Bryn and Tor" from seats */
N.namesList = seats => { const names = seats.map(s => N.G.P[s]?.name || 'a former player'); return names.length > 1 ? names.slice(0, -1).join(', ') + ' and ' + names[names.length - 1] : names[0] || ''; };
N.audLabel = (x, kind) => {
  const a = N.audOf(x, kind);
  if (a === 'gm') return 'Only you';
  if (a === '*') return 'Everyone';
  const names = a.map(s => N.G.P[s]?.name || 'a former player');
  return 'Only ' + (names.length > 1 ? names.slice(0, -1).join(', ') + ' and ' + names[names.length - 1] : names[0]);
};
/* ---------- the GM's papers: issues grouped by paper name, each paper's issues oldest first ---------- */
N.paperName = i => String(i.paper || '').trim() || 'The paper';
N.papers = () => {
  const by = {};
  for (const i of N.G.news.issues) (by[N.paperName(i)] = by[N.paperName(i)] || {name:N.paperName(i), issues:[]}).issues.push(i);
  const ps = Object.values(by);
  for (const p of ps) p.issues.sort((a, b) => ((+a.no || 0) - (+b.no || 0)) || ((a.t || 0) - (b.t || 0)));
  /* the paper with the newest issue first */
  const newest = p => Math.max(...p.issues.map(i => i.t || 0));
  return ps.sort((a, b) => (newest(b) - newest(a)) || a.name.localeCompare(b.name));
};
N.newsUnseen = role => { const s = N.G.news.seen[role] || []; return N.G.news.issues.filter(i => !s.includes(i.id)); };
N.PINT = {
  here:{name:'You are here',one:'You are here',col:'#ff6b5a',ic:'crosshair'},
  nation:{name:'Nations',col:'#f4c46e',ic:'flag'}, region:{name:'Regions',col:'#e8c9a0',ic:'mapL'}, city:{name:'Cities',one:'City',col:'#ffd27a',ic:'castle'},
  town:{name:'Towns',col:'#efd9a0',ic:'house'}, hood:{name:'Neighborhoods',col:'#d9c3f0',ic:'houses'}, landmark:{name:'Landmarks',col:'#c9bdff',ic:'star'},
  tavern:{name:'Taverns',col:'#f2b25c',ic:'tavern'}, shop:{name:'Shops',col:'#a3d6b4',ic:'bag'}, temple:{name:'Temples',col:'#f4e38d',ic:'religion'},
  danger:{name:'Danger',col:'#ff8a6e',ic:'warn'}, note:{name:'Notes',col:'#cfd8d3',ic:'pen'}, party:{name:'Party',col:'#8c7cff',ic:'banner'},
};

/* one place of a kind: "City", "Town", "You are here" */
N.pinOne = t => t.one || t.name.replace(/s$/, '');

/* ---------- the shared game (filled in by sync.js) ---------- */
const SEATCOL = 8;
N.G = {
  me:null, role:'gm',
  P:{gm:{id:'gm', name:'GM', color:'var(--c-gm)'}},
  chars:{}, npcs:[], quick:[], casts:{}, extras:{}, foes:[], recent:[], pics:[], msgs:[], combat:null, maps:[], wiki:[], cats:null, news:{issues:[], seen:{}}, seen:{}, emoji:[], groups:[], gifKey:'', gmPic:null, mapDirs:[], npcDirs:[], items:[], rev:{}, known:{}, wlinks:{}, hlocs:{}, shops:{},
};
/* ---------- emoji: reactions on messages, and the GM's own pictures (custom emoji, written :name:) ---------- */
N.EMO_QUICK = ['👍','❤️','😂','😮','😢','🔥'];
N.EMO_ALL = ['👍','👎','❤️','😂','🤣','😮','😢','😡','🔥','🎉','👏','🙏','💀','😱','🤔','😏','😎','🥲','😬','🙄','🤯','😴','🤝','✨','⚔️','🛡️','🏹','🗡️','🪓','🍺','🎲','🐉','👑','🕯️','🌙','☀️','💰','🧪','📜','🗺️','✅','❌','❓','❗'];
N.emoById = n => (N.G.emoji || []).find(e => e.n === n);
/* one reaction or emoji as html: a custom one is :name:, anything else is a plain emoji character */
/* an emoji's picture: a still one is kept inline (d is a data URL), an animated one in the picture store (d is "fs:<id>") */
const BLANK = 'data:image/gif;base64,R0lGODlhAQABAAAAACH5BAEAAAAALAAAAAABAAEAAAIBAAA=';
N.emoSrc = x => (x && N.imgUrl(x.d)) || BLANK;
N.emj = (e, cls='cemo') => { const c = /^:([\w-]+):$/.exec(e || ''); if (!c) return esc(e); const x = N.emoById(c[1]); return x ? `<img class="${cls}" src="${esc(N.emoSrc(x))}" alt=":${esc(x.n)}:" title=":${esc(x.n)}:" draggable="false">` : esc(e); };
/* a row over a long form (wiki entry, news edition, character card): the emoji go into whichever box was typed in last */
/* link: the GM's Insert link button too, for a wiki entry, a character, an NPC or another entry */
N.textTools = (v, link) => `<div class="ttools${link ? ' lk' : ''}"><span>Emoji${link ? ' and links' : ''} go where you were typing.</span><button type="button" class="btn sm ghost" data-a="pop" data-v="fmtg"><b class="aaw">Aa</b>Formatting</button><button type="button" class="btn sm" data-a="pop" data-v="emof">${IC('smile')}Emoji</button>${link && v.role === 'gm' ? `<button type="button" class="btn sm" data-a="pop" data-v="linkf">${IC('link')}Link</button>` : ''}</div>`;
/* does this picture file move? GIF with more than one frame, WebP with an ANIM chunk, PNG with acTL (APNG) */
N.isAnimated = dataUrl => {
  const m = /^data:image\/(gif|webp|png|apng);base64,(.*)$/.exec(dataUrl || ''); if (!m) return false;
  let b; try { b = atob(m[2]); } catch(e){ return false; }
  if (m[1] === 'gif') { let n = 0, i = -1; while ((i = b.indexOf('\x21\xF9\x04', i + 1)) >= 0) if (++n > 1) return true; return false; }
  if (m[1] === 'webp') return b.slice(0, 4) === 'RIFF' && b.indexOf('ANIM') > 0 && b.indexOf('ANIM') < 200;
  const at = b.indexOf('acTL'), dat = b.indexOf('IDAT'); return at > 0 && (dat < 0 || at < dat);
};
/* custom emoji typed into a message, after fmt() */
N.emoText = h => (N.G.emoji || []).length ? h.replace(/:([\w-]{1,32}):/g, (all, n) => N.emoById(n) ? N.emj(all) : all) : h;
/* a message that is nothing but emoji (up to 12, custom :name: ones included) shows big, without a bubble */
N.emojiOnly = t => {
  t = String(t || '').trim(); if (!t || t.length > 200) return false;
  let n = 0;
  const rest = t.replace(/:([\w-]{1,32}):/g, (all, id) => N.emoById(id) ? (n++, ' ') : all).replace(/\s+/g, '');
  if (rest && !/^(?:\p{Extended_Pictographic}|\p{Emoji_Modifier}|\p{Regional_Indicator}|[‍️⃣#*0-9])+$/u.test(rest)) return false;
  if (rest && !/\p{Extended_Pictographic}|\p{Regional_Indicator}/u.test(rest)) return false;
  n += rest ? (typeof Intl !== 'undefined' && Intl.Segmenter ? [...new Intl.Segmenter().segment(rest)].length : [...rest.matchAll(/\p{Extended_Pictographic}/gu)].length) : 0;
  return n > 0 && n <= 12;
};
N.seatColor = seat => `var(--c-p${((+seat.slice(1) - 1) % SEATCOL) + 1})`;

function blankChar(id, player){
  const P = N.G.P[player] || {name:'Player'};
  return {id, player, name:`${P.name}’s character`, short:P.name, built:false, portrait:null,
    hc:'', trouble:'', aspects:[], race:'', age:'', people:'', invText:'', skills:{}, disc:{}, stunts:[], refresh:3, fp:3,
    stressV:{phys:stressVals(0), ment:stressVals(0)}, stress:{phys:[false,false], ment:[false,false]}, cons:{mild:'',moderate:'',severe:''}, inv:[]};
}
function npcCard(o){
  const str = (o.skills||{}).Strength||0, wil = (o.skills||{}).Will||0, pv = stressVals(str), mv = stressVals(wil);
  return Object.assign({id:uid('n'), name:'', race:'', job:'', age:'', hc:'', trouble:'', aspects:[], skills:{}, disc:{}, magic:'', stunts:[], refresh:3, fp:3, bio:'', notes:'', type:'supporting', portrait:null,
    stressV:{phys:pv, ment:mv}, stress:{phys:pv.map(()=>false), ment:mv.map(()=>false)}, cons:{mild:'',moderate:'',severe:''}, gearAtk:0, gearDef:0, gearRng:0, gearAmmo:0}, o);
}
function freshCombat(){
  return {state:'off', id:null, ch:'table', title:'', bg:N.FIGHTBG, zones:[], tokens:[], turn:0, exchange:1, aspects:[], invited:[], joined:[], pending:null, last:null, acted:false, moved:false, phase:null, lead:null, kind:'fight', teams:[], tn:{}, ord:null};
}
N.freshCombat = freshCombat; N.npcCard = npcCard; N.blankChar = blankChar;
N.G.combat = freshCombat();

/* scenes live in the chat as "scene" messages; the newest one in a chat is its scene */
let _scV = null, _scC = {};
Object.defineProperty(N.G, 'scenes', {get(){
  const ms = N.G.msgs, key = ms.length + ':' + (ms.length ? ms[ms.length-1].id : '');
  if (key !== _scV) { _scC = {}; _scV = key; for (const m of ms) if (m.kind === 'scene') _scC[m.ch] = m.scene ? Object.assign({msg:m.id}, m.scene) : null; }
  return _scC;
}});
N.invalidateScenes = () => { _scV = null; };
/* the party banner is a "party" pin on one of the maps */
Object.defineProperty(N.G, 'party', {get(){
  for (const m of N.G.maps) { const p = (m.pins||[]).find(x => x.type === 'party'); if (p && (N.G.role === 'gm' || m.vis !== false)) return {map:m.id, rx:p.rx, ry:p.ry, pin:p}; }
  return {map:null};
}});

/* ---------- where a scene is: country > city > neighborhood, each one a place pinned on a map ----------
   A place opens the next map down: the GM can pick it on the pin (p.to, '-' = none), else a map with the same name opens */
const placeName = s => (s || '').toLowerCase().replace(/\(.*?\)/g, ' ').replace(/[^\p{L}\p{N}]+/gu, ' ').trim().replace(/^the /, '');
N.pinAutoTo = (m, p) => {
  const a = placeName(p.label); if (!a) return null;
  const has = (x, y) => ` ${x} `.includes(` ${y} `);
  let best = null, bl = 0;
  for (const x of N.G.maps) { if (x.id === m.id) continue; const b = placeName(x.name); if (!b) continue;
    const sc = a === b ? 999 : (has(a, b) || has(b, a)) ? Math.min(a.length, b.length) : 0;
    if (sc > bl) { best = x.id; bl = sc; } }
  return best;
};
/* the wiki article a place opens (p.wiki), if this viewer can read it (a player's G.wiki only holds what they may read) */
N.pinWiki = (p, gm) => (p && p.wiki && N.G.wiki.find(e => e.id === p.wiki && (gm || !e.gm))) || null;
N.pinTo = (m, p) => { if (!m || !p) return null; if (p.to === '-') return null; if (p.to && N.G.maps.some(x => x.id === p.to)) return p.to; return N.pinAutoTo(m, p); };
N.LOCK = ['c', 't', 'n'];
N.LOCNAME = {c:'Country', t:'City or town', n:'Neighborhood'};
const locPins = m => m ? m.pins.filter(p => p.type !== 'party').map(p => ({m:m.id, p:p.id, l:p.label, rx:p.rx, ry:p.ry, to:N.pinTo(m, p)})).sort((a, b) => a.l.localeCompare(b.l)) : [];
/* the places the GM can pick at each step: countries are the Nation pins, then the pins on the map the step above opens */
N.locOpts = (k, sel) => {
  const g = N.G, at = key => { const [mi, pi] = (key || '').split('|'), m = g.maps.find(x => x.id === mi), p = m && m.pins.find(x => x.id === pi); return p ? {m, p} : null; };
  if (k === 'c') return g.maps.flatMap(m => locPins(m).filter(o => m.pins.find(p => p.id === o.p).type === 'nation'));
  const up = at(sel[k === 't' ? 'c' : 't']); if (!up) return [];
  return locPins(g.maps.find(x => x.id === N.pinTo(up.m, up.p)));
};
N.locKey = o => o ? o.m + '|' + o.p : '';
/* picked keys -> what the scene keeps: each step's map, spot and name, and the map it opens (players may not have the pins) */
N.locBuild = sel => {
  const out = {};
  for (const k of N.LOCK) { const o = N.locOpts(k, sel).find(x => N.locKey(x) === sel[k]); if (!o) break; out[k] = o; }
  return out.c ? out : null;
};
N.locKeys = loc => ({c:N.locKey(loc?.c), t:N.locKey(loc?.t), n:N.locKey(loc?.n)});
N.locText = loc => loc ? N.LOCK.map(k => loc[k]?.l).filter(Boolean).reverse().join(', ') : '';
/* where you are: a player sees the newest shared location of a scene in their chats; the GM sees the open chat's (shared or not) */
N.myLoc = (role, ch) => {
  const g = N.G, sc = g.scenes;
  if (role === 'gm') { const c = !ch || ch === 'gm' ? 'table' : ch, s = sc[c]; return s ? s.loc || g.hlocs[s.msg] || null : null; }
  let best = null, bt = -1;
  for (const c of N.channelsFor(role)) { const s = sc[c]; if (!s || !s.loc) continue; const m = g.msgs.find(x => x.id === s.msg), t = m ? m.t : 0; if (t > bt) { bt = t; best = s.loc; } }
  return best;
};

/* free invokes on a scene aspect are spent by the rolls that used them. An aspect keeps its key (k) when the scene is edited,
   so its spent invokes stay spent; older aspects without one are known by their place in the list */
N.sceneRef = (sc, i) => `scene:${sc.msg}:${sc.aspects[i]?.k ?? i}`;
N.sceneFreeLeft = (sc, i) => {
  const a = sc.aspects[i]; if (!a || !a.free) return 0;
  const ref = N.sceneRef(sc, i);
  let used = 0; for (const m of N.G.msgs) if (m.kind === 'roll') for (const iv of (m.roll.invokes||[])) if (iv.ref === ref) used++;
  return Math.max(0, a.free - used);
};

/* ---------- people and chats ---------- */
N.seats = () => Object.keys(N.G.P).filter(k => k !== 'gm').sort((a,b) => a.slice(1) - b.slice(1));
N.gmName = () => N.G.P.gm.name;
/* ---------- group chats: the GM puts several players in one chat (groups/<id>, chat id "grp-<id>") ---------- */
N.grpOf = ch => /^grp-/.test(ch || '') ? (N.G.groups || []).find(x => x.id === ch.slice(4)) || null : null;
/* a party is a group chat marked party: its players see only each other's characters, and its chat stands in for Everyone */
N.partyOf = seat => (N.G.groups || []).find(x => x.party && (x.seats || []).includes(seat)) || null;
/* where table-wide notes about a player's character go: their party's chat, or Everyone */
N.homeCh = seat => { const pt = N.partyOf(seat); return pt ? 'grp-' + pt.id : 'table'; };
N.grpsFor = role => (N.G.groups || []).filter(x => role === 'gm' || (x.seats || []).includes(role)).sort((a, b) => (a.t || 0) - (b.t || 0));
/* "Mia and Theo", "Jack, Mia and Theo" */
N.namesOf = (seats, skip) => { const ns = seats.filter(s => s !== skip).map(s => N.G.P[s]?.name || 'a former player'); return ns.length > 1 ? ns.slice(0, -1).join(', ') + ' and ' + ns[ns.length - 1] : ns[0] || 'nobody yet'; };
const andList = a => a.length > 1 ? a.slice(0, -1).join(', ') + ' and ' + a[a.length - 1] : a[0];
const grpSub = (ss, role) => { const nm = x => N.G.P[x]?.name || 'a former player';
  return role === 'gm' ? `Only ${andList(['you', ...ss.map(nm)])} see this` : `Only ${andList(['you', ...ss.filter(x => x !== role).map(nm), 'the GM'])} see this`; };
N.chName = (id, role) => {
  if (id === 'table') return 'Everyone';
  if (id === 'gm') return 'GM notes';
  if (id.startsWith('grp-')) return N.grpOf(id)?.name || 'Group chat';
  const pr = id.slice(3);
  return role === 'gm' ? (N.G.P[pr]?.name || 'A former player') : `${N.gmName()} · GM`;
};
N.chSub = (id, role) => id.startsWith('grp-') ? grpSub(N.grpOf(id)?.seats || [], role) + (N.grpOf(id)?.meta ? ', Meta only' : '') : id === 'table' ? 'Everyone at the table, Meta only' : id === 'gm' ? 'Only you see this. Secret rolls land here.' : role === 'gm' ? `Only you and ${N.G.P[id.slice(3)]?.name || 'them'} see this` : 'Only you and the GM see this';
/* A player has a private chat with the GM only once the GM opens one (new players start with just Everyone).
   A closed one keeps its messages; shut = true also lists closed ones that have messages (export, wipe). */
N.dmOn = s => N.G.P[s]?.dm !== false;
N.channelsFor = (role, shut) => {
  const grs = N.grpsFor(role), pts = grs.filter(x => x.party).map(x => 'grp-' + x.id), gs = grs.filter(x => !x.party).map(x => 'grp-' + x.id);
  const dmOk = s => N.dmOn(s) || (shut && N.G.msgs.some(m => m.ch === 'dm-' + s));
  if (role === 'gm') return ['table', ...pts, ...N.seats().filter(dmOk).map(s => 'dm-' + s), ...gs, 'gm'];
  /* Everyone is the Meta chat: every player has it on every character, party or not */
  return ['table', ...pts, ...(N.dmOn(role) ? ['dm-' + role] : []), ...gs];
};
/* Everyone is table talk only: no speaking in character and no fights there. The GM can make a group chat or party Meta only too */
N.metaOnly = ch => ch === 'table' || !!N.grpOf(ch)?.meta;
/* Jake: the GM screen's "Working in" row lists only chats where roleplay happens (group chats, parties and private chats that aren't Meta only), then GM notes */
N.gmWorkChans = () => N.channelsFor('gm').filter(c => c === 'gm' || !N.metaOnly(c));
/* a party or group chat the GM paused: players read it but can't send (Jake) */
N.chPaused = ch => { const gr = N.grpOf(ch); return !!(gr && gr.paused); };
/* Jake's calendar (Calendar_Seasons_Weather): the week's days and the months with their lengths, for the GM's Next day line */
N.WEEKDAYS = ['First Market', 'Second Market', 'Third Market', 'Fourth Market', 'Freeday', 'Restday', 'Readyday'];
N.MONTHS = [['First Rain', 30], ['Seed Sow', 29], ['Sun’s Show', 30], ['First Heat', 31], ['High Shine', 31], ['Last Heat', 31],
  ['First Fall', 30], ['Harvest Hour', 29], ['Sun’s Leave', 30], ['First Frost', 31], ['Hearth Fire', 31], ['Last Frost', 31]];
N.ordinal = n => { const t = n % 100, e = n % 10; return n + (t > 10 && t < 14 ? 'th' : e === 1 ? 'st' : e === 2 ? 'nd' : e === 3 ? 'rd' : 'th'); };
/* d: {w, d, m, y} (indexes into the lists, the date, the year as typed) or {u:true}. "Freeday, 3rd of Seed Sow, 1204" */
N.dayLine = d => d.u ? 'Date unknown' : `${N.WEEKDAYS[d.w]}, ${N.ordinal(d.d)} of ${N.MONTHS[d.m][0]}${String(d.y || '').trim() ? ', ' + String(d.y).trim() : ''}`;
/* the day after d, by Jake's month lengths; a year that is a plain number goes up after Last Frost */
N.dayAfter = d => { if (!d || d.u) return null; let {w, d:n, m, y} = d; w = (w + 1) % 7; n++;
  if (n > N.MONTHS[m][1]) { n = 1; m++; if (m > 11) { m = 0; const t = String(y || '').trim(); if (/^\d+$/.test(t)) y = String(+t + 1); } }
  return {w, d:n, m, y:y || ''}; };
N.NEXT_DAY_META = 'GM will now refresh Fate points and Gold, and will run Strength checks on Consequences.';
/* in a Meta-only chat a person shows by their own name, not "Jack · Brann" */
N.metaName = by => N.metaPerson(by).name;
/* the same person on another of their characters counts as "you" in Everyone */
N.sameUser = (a, b) => a === b || (a !== 'gm' && b !== 'gm' && !!N.G.P[a]?.uid && N.G.P[a]?.uid === N.G.P[b]?.uid);
N.unread = (role, ch) => { const s = (N.G.seen[role] || {})[ch] || 0; let n = 0; for (const m of N.G.msgs) if (m.ch === ch && m.by !== role && m.t > s && !(m.kind === 'scene' && m.quiet)) n++; return n; };

/* the characters of the people seated now, in seat order */
N.pcs = () => N.seats().map(s => N.G.chars[N.G.P[s].char]).filter(Boolean);
/* names the GM can speak as: NPC cards first, then quick voices without a card */
/* the NPCs the GM said are in a chat's scene (GM only, kept in gm/misc): Speak as lists them first. null = no list for that chat */
N.castOf = ch => { const c = N.G.casts && N.G.casts[ch]; return Array.isArray(c) && c.length ? c : null; };
/* Speak as for a chat: the scene's NPCs, the NPCs on the board of a fight in that chat, and whoever is picked now.
   rest: everyone else (null when the chat has no scene list, so every voice is shown as before) */
/* one-off NPCs: made in the scene sheet for one chat's scene only, never a card; gone when that scene ends. {ch:[{id,name,skills}]} in gm/misc */
N.extrasOf = ch => { const x = N.G.extras && N.G.extras[ch]; return Array.isArray(x) ? x : []; };
N.extraByName = (ch, name) => N.extrasOf(ch).find(x => x.name === name) || null;
/* Speak as for a chat lists only who is in its scene: the NPCs the GM picked, its one-off NPCs, the NPCs on the board of a fight
   in that chat, and whoever is picked now. None picked lists none of them. rest: every other NPC, one tap away */
N.voicesFor = (ch, cur) => {
  const all = N.voices(), cast = N.castOf(ch) || [], once = N.extrasOf(ch).map(x => x.name);
  const cb = N.G.combat, fight = cb && cb.state === 'live' && N.fightCh() === ch ? cb.tokens.filter(t => t.kind === 'npc' && !t.out).map(t => t.name.replace(/ \d+$/, '')) : [];
  const here = [...new Set([...all.filter(n => cast.includes(n) || fight.includes(n) || n === cur), ...once])];
  return {here, rest:all.filter(n => !here.includes(n))};
};
/* the player characters in a chat: a player's own chat has theirs, a group chat or party its players', Everyone and GM notes every one */
N.chPcs = ch => (ch === 'gm' ? N.pcs() : N.pcsIn(ch)).filter(c => c.built);
/* who is in a chat's scene: its player characters, plus (while a scene is up) the NPC cards the GM picked for it and its one-off NPCs.
   With no scene up, only the player characters */
N.sceneFolk = ch => {
  const g = N.G, up = !!g.scenes[ch], cast = up ? N.castOf(ch) || [] : [];
  return {pcs:N.chPcs(ch), npcs:g.npcs.filter(n => cast.includes(n.name)), once:up ? N.extrasOf(ch) : []};
};
N.voices = () => { const names = N.G.npcs.map(n => n.name.trim()).filter(Boolean); return [...new Set([...names, ...N.G.quick.filter(Boolean)])]; };
N.npcSub = n => n ? [n.race, n.job].filter(Boolean).join(' · ') : 'Quick voice';

/* who can roll / be shown */
N.charOf = role => role === 'gm' ? null : N.G.chars[N.G.P[role]?.char];
N.av = (o, s, extra='') => {
  /* o: {name, portrait|face, color} */
  const face = o.face || N.faceUrl(o.portrait);
  const style = `${s ? `--s:${s}px;` : ''}--c:${o.color || 'var(--accent)'}`;
  return `<span class="av ${extra}" style="${style}">${face ? `<img src="${esc(face)}" alt="" loading="lazy" draggable="false" style="${N.frameCss(o.portrait)}">` : esc(((o.short||o.name||'?').trim()[0]||'?'))}</span>`;
};
N.narrAv = s => `<span class="av narrav" style="--s:${s||32}px">${STAR}</span>`;
N.npcByName = name => N.G.npcs.find(x => x.name === name);
N.speakerObj = (m) => {
  const G = N.G;
  if (m.by === 'gm') {
    if (m.as === 'Narrator' || !m.as) return {name:'Narrator', narr:true, color:'var(--c-gm)'};
    const n = N.npcByName(m.as);
    return {name:m.as, portrait:m.pt || n?.portrait, color:'var(--c-npc)', npc:true};
  }
  const p = G.P[m.by], c = p && G.chars[p.char];
  return {name:m.as || p?.name || 'A former player', portrait:c?.built ? c.portrait : null, color:p?.color || 'var(--ink-3)'};
};
/* a person out of character: their own Meta picture, else their character's portrait.
   A player's Meta picture rides on their card (mpic), the GM's on game/meta (gmPic), so no new security rules are needed */
N.personObj = by => {
  const G = N.G, p = G.P[by];
  if (by === 'gm') return {name:N.gmName(), portrait:G.gmPic || null, color:'var(--c-gm)'};
  if (!p) return {name:'A former player', color:'var(--ink-3)'};
  const c = G.chars[p.char]; return {name:p.name, portrait:c?.mpic || (c?.built ? c.portrait : null), color:p.color};
};
/* in Everyone (Meta only) a person is just themselves: their own name and their Meta picture, never their character's
   name or portrait, so players whose characters haven't met learn nothing from it. No Meta picture = their initial */
N.metaPerson = by => {
  if (by === 'gm') return N.personObj('gm');
  const p = N.G.P[by]; if (!p) return {name:'A former player', color:'var(--ink-3)'};
  const c = N.G.chars[p.char]; return {name:p.who || (p.multi ? 'Player' : p.name), portrait:c?.mpic || null, color:p.color};
};
/* who wrote a message, as that chat shows them. Older Everyone messages said in character still show as the person */
N.msgPerson = m => N.metaOnly(m.ch) ? N.metaPerson(m.by) : N.personObj(m.by);
N.metaRp = m => m.kind === 'rp' && m.by !== 'gm' && N.metaOnly(m.ch);
N.metaPic = role => role === 'gm' ? N.G.gmPic || null : N.charOf(role)?.mpic || null;

/* a player card's aspects: older cards kept a high concept and trouble, newer ones just Aspect 1, 2, 3 */
N.pcAspects = c => [c.hc, c.trouble, ...(c.aspects || [])].filter(Boolean);
/* ---------- sheet reveals: the GM shows single parts of a PC's or NPC's card to chosen players ----------
   G.rev = {cardId: {seat: [part keys]}} (GM only, gm/misc unit rev2). Each player gets just what was revealed to them,
   in their own only/<seat> as unit r:<cardId> (N.revealed), read back into G.known. A player sees a character only once
   its name is revealed. Keys: name, pic, race, nat (nationality), age, a:<n> aspect n, sk:<skill> (also +0 skills), st:<stunt name>,
   cn:<slot> one consequence, g:<gear key> one rating, it:<item name> one inventory item, bio, people.
   PCs and NPCs reach players in the same shape, so their cards look alike.
   How the player's character knows them is set by the GM too, as one more key: met:met (Met) or met:heard (Heard of). */
N.GEARK = [['gearAtk','Melee weapon','sword'],['gearRng','Ranged weapon','target'],['gearAmmo','Ranged ammo','arrowR'],['gearDef','Armor','shieldU']];
/* ---------- the GM's item catalog: the weapons, armor and magical things that exist in the world ----------
   G.items = [{id, name, kind, ic, d, gm, gearAtk, gearRng, gearAmmo, gearDef}] (GM only, its own doc gm/items, one unit per item).
   d is what it does (copied into an inventory when the GM gives it), gm is the GM's own notes (never copied).
   The ratings match the ones on a card (N.GEARK); giving the item can set them on the card too. */
/* item kinds, in the order the catalog lists them. Ids are kept forever (old items keep theirs): potion was "Potions and food" */
N.ITEMK = [['weapon','Weapons','sword'],['armor','Armor','shieldU'],['clothing','Clothing','boots'],['magic','Magical','magic'],['potion','Potions','potion'],
  ['ingredient','Potion ingredients','sparkle'],['craft','Crafting ingredients','gear'],['food','Food & drink','drink'],['book','Books','spellbook'],['trinket','Trinkets','coins'],['gear','Gear and tools','bag'],['other','Other','items']];
N.ITEM_IC = ['bag','sword','target','arrowR','shieldU','helm','boots','knuckles','magic','sparkle','spellbook','potion','drink','scroll','coins','skull','items'];
N.itemKind = k => N.ITEMK.find(x => x[0] === k) || N.ITEMK[N.ITEMK.length - 1];
N.itemById = id => (N.G.items || []).find(x => x.id === id) || null;
N.itemByName = n => { const k = String(n || '').trim().toLowerCase(); return k ? (N.G.items || []).find(x => x.name.toLowerCase() === k) || null : null; };
/* ---------- equipped gear (Jake's weapon and armor rules) ----------
   An inventory row is [name, qty, note, icon, x]; x = {eq:1 equipped, eq2:1 second dual-wield weapon, am:ammo 0..4, w:1 weapon or armor}.
   Players' devices have no catalog, so what they need to see (equipped, ammo, weapon) lives on the row itself.
   Equipping (GM only) fills the card from the equipped items' catalog entries, one slot each:
   melee -> gearAtk (two dual-wield weapons: gearAtk + gearAtk2), ranged -> gearRng, ammo/thrown -> gearAmmo, armor -> gearDef,
   shield -> shield. Silver melee/ammo -> silverAtk/silverAmmo, a crossbow -> reload, two-handed weapon and shield ->
   extra stress boxes of (rating - 1) in gearBox. */
N.AMMO_MAX = 4;
N.invX = row => (row && row[4] && typeof row[4] === 'object') ? row[4] : {};
N.invSetX = (row, patch) => { const x = {...N.invX(row), ...patch}; for (const k of Object.keys(x)) if (x[k] == null || x[k] === 0 && k !== 'am') delete x[k];
  while (row.length < 4) row.push(row.length === 2 ? '' : 'bag'); if (!row[3]) row[3] = 'bag'; if (Object.keys(x).length) row[4] = x; else row.length = 4; };
const SLOT_OF = {gearAtk:'melee', gearRng:'ranged', gearAmmo:'ammo', gearDef:'armor', shield:'shield'};
N.SLOTS = {melee:['gearAtk','Melee weapon'], ranged:['gearRng','Ranged weapon'], ammo:['gearAmmo','Ranged ammo'], armor:['gearDef','Armor'], shield:['shield','Shield']};
/* which slot a catalog item takes when equipped: its class first, else its first rating */
N.itemSlot = it => { if (!it) return null;
  const c = it.cls || '';
  if (c === 'Thrown weapons' || c === 'Standard ranged ammo') return 'ammo';
  if (c === 'Standard ranged weapons' || c === 'Crossbows') return 'ranged';
  if (c === 'Worn armor') return 'armor'; if (c === 'Shields') return 'shield';
  if (it.grp === 'Fighting') return 'melee';
  const k = N.ITEM_RATE.map(([k]) => k).find(k => k in it); return k ? SLOT_OF[k] : null; };
N.itemRating = it => { const sl = N.itemSlot(it); return sl ? (+it[N.SLOTS[sl][0]] || +it.r || 0) : 0; };
/* the catalog item behind an inventory row (GM device only) */
N.rowItem = row => N.itemByName(row && row[0]);
N.isWeaponRow = row => !!(N.invX(row).w || N.itemSlot(N.rowItem(row)));
/* recompute the card from what is equipped */
/* o's equipped catalog items in one slot, best rating first (GM device only) */
N.eqOf = (o, sl) => (o.inv || []).filter(r => N.invX(r).eq).map(r => N.rowItem(r)).filter(it => it && N.itemSlot(it) === sl).sort((a, b) => N.itemRating(b) - N.itemRating(a));
N.applyGear = o => {
  const of = sl => N.eqOf(o, sl);
  const mel = of('melee'), rng = of('ranged')[0], am = of('ammo')[0], arm = of('armor')[0], sh = of('shield')[0];
  o.gearAtk = mel[0] ? N.itemRating(mel[0]) : 0;
  o.gearAtk2 = mel[1] && mel[0].dual && mel[1].dual ? N.itemRating(mel[1]) : 0;
  o.gearRng = rng ? N.itemRating(rng) : 0; o.gearAmmo = am ? N.itemRating(am) : 0; o.gearDef = arm ? N.itemRating(arm) : 0; o.shield = sh ? N.itemRating(sh) : 0;
  o.silverAtk = mel.some(it => it.silver) ? 1 : 0; o.silverAmmo = am && am.silver ? 1 : 0; o.reload = rng && rng.reload ? 1 : 0;
  o.gearBox = [...mel.filter(it => it.twoHand).slice(0, 1).map(it => N.itemRating(it) - 1), ...(sh ? [N.itemRating(sh) - 1] : [])].filter(x => x > 0);
  for (const k of ['gearAtk2','shield','silverAtk','silverAmmo','reload']) if (!o[k]) delete o[k];
  if (!o.gearBox.length) delete o.gearBox;
  N.fitBoxes(o);
  /* NPC fighters on the board carry their own copy of the card's gear */
  if (!o.player) for (const t of (N.G.combat?.tokens || [])) if (t.kind === 'npc' && t.ref === o.id) { Object.assign(t, N.tokGearOf(o)); const v = N.physBoxes(o, t.type === 'nameless'); t.stress = v.map((x, i) => !!t.stress[i]); t.stressV = v; }
};
N.TOK_GEAR = ['gearAtk','gearDef','gearRng','gearAmmo','gearAtk2','shield','silverAtk','silverAmmo','reload'];
N.tokGearOf = n => { const o = {}; for (const k of N.TOK_GEAR) o[k] = +n[k] || 0; o.gearBox = [...(n.gearBox || [])]; return o; };
/* physical stress: from Strength, plus the extra boxes gear gives */
N.physBoxes = (o, nameless) => [...(nameless ? [1] : N.stressVals((o.skills || {}).Strength || 0)), ...(o.gearBox || [])];
N.fitBoxes = o => { if (!o.stressV) return; const v = N.physBoxes(o); if (v.join() === (o.stressV.phys || []).join()) return;
  o.stress.phys = v.map((x, i) => !!(o.stress.phys || [])[i]); o.stressV.phys = v; };
/* equip or unequip inventory row i of o. Returns a message for the GM, or null when it can't be done */
N.equipRow = (o, i) => {
  const row = (o.inv || [])[i], it = N.rowItem(row), sl = N.itemSlot(it); if (!row || !sl) return null;
  const x = N.invX(row);
  if (x.eq) { N.invSetX(row, {eq:0}); N.applyGear(o); return {ok:`${row[0]} unequipped.`}; }
  const eqd = () => (o.inv || []).map((r, j) => ({r, j, it:N.rowItem(r)})).filter(e => e.j !== i && N.invX(e.r).eq && e.it);
  /* arrows need a bow or crossbow, shot needs a sling (Jake's rule) */
  if (it.needs) { const rng = eqd().find(e => N.itemSlot(e.it) === 'ranged')?.it, d = rng ? rng.disc || '' : '';
    const ok = /sling/i.test(it.needs) ? d === 'Slings' : (d === 'Bows' || d === 'Crossbows');
    if (!ok) return {no:`${row[0]} needs a ${it.needs.toLowerCase()} equipped first.`}; }
  /* one item per slot, except two small one-handed weapons to dual-wield */
  const same = eqd().filter(e => N.itemSlot(e.it) === sl);
  const keep = sl === 'melee' && it.dual && same.length === 1 && same[0].it.dual ? same : [];
  for (const e of same) if (!keep.includes(e)) N.invSetX(e.r, {eq:0});
  N.invSetX(row, {eq:1, w:1});
  const warn = [];
  const all = eqd().map(e => e.it).concat(it);
  if (all.some(y => N.itemSlot(y) === 'shield') && all.some(y => y.noShield)) warn.push('Jake’s note: that weapon isn’t meant to go with a shield.');
  N.applyGear(o);
  return {ok:`${row[0]} equipped${keep.length ? ', dual-wielding' : ''}.${warn.length ? ' ' + warn.join(' ') : ''}`};
};
/* a fighter's race, for silver against vampires and werewolves */
N.tokRace = t => { if (!t) return ''; if (t.kind === 'pc') return N.G.chars[t.ref]?.race || ''; return (N.G.npcs.find(n => n.id === t.ref) || {}).race || t.race || ''; };
N.silverFoe = t => /vampire|werewolf|lycan/i.test(N.tokRace(t));
/* who an item is given to: 'c:<char id>' (a player character) or 'n:<npc id>' */
N.itemTo = to => { const [t, id] = String(to || '').split(/:(.*)/s); const o = t === 'c' ? N.G.chars[id] : t === 'n' ? N.G.npcs.find(x => x.id === id) : null;
  return o && (t === 'n' || o.built) ? {o, pc:t === 'c', label:t === 'c' ? o.short : o.name} : null; };
/* an item's ratings: the four a card has, plus Shield (a shield's rating; no card field yet) */
N.ITEM_RATE = [...N.GEARK, ['shield','Shield','shieldU']];
N.itemGears = it => N.ITEM_RATE.filter(([k]) => +it[k] > 0);
N.itemCardGears = it => N.GEARK.filter(([k]) => +it[k] > 0);
/* where an item sits in Jake's lists: class (e.g. Small one-handed weapons), then sub-type and discipline */
N.itemPath = it => [it.cls, it.sub, it.disc].filter(Boolean).join(' · ');
/* merge an items file (norne-gm-items.json) into the catalog: same name = replaced, keeping its id */
N.importItems = list => {
  const g = N.G; if (!g.items) g.items = []; let add = 0, rep = 0;
  for (const raw of list) {
    const name = String(raw?.name || '').trim(); if (!name) continue;
    const it = {...raw, name, kind:N.itemKind(raw.kind)[0]}; delete it.o;
    const at = g.items.findIndex(x => x.name.toLowerCase() === name.toLowerCase());
    if (at >= 0) { it.id = g.items[at].id; g.items[at] = it; rep++; } else { it.id = N.uid('it'); g.items.push(it); add++; }
  }
  g.items.sort((a, b) => a.name.localeCompare(b.name)); return {add, rep};
};
/* the line an inventory gets: its ratings, then what it does */
N.itemNote = it => [N.itemGears(it).map(([k, l]) => `${l} +${+it[k]}`).join(', '), (it.d || '').trim()].filter(Boolean).join(' · ');
/* ---------- storefronts (Jake): a store the GM sets up in a chat, like a fight ----------
   G.shops = {<chat>: {id, ch, state:'setup'|'open', name, pcs:[char ids], npcs:[{name, portrait}], items:[shop item], t}}
   One store per chat, only in a player's private chat, a group chat / party that isn't Meta only, or GM notes (Jake: a store only the GM sees).
   The GM keeps every store in gm/shops; an open one is also written to that chat's fights/<seat or group> document (unit s),
   so only the players of that chat receive it. A store being set up never leaves the GM's device.
   A shop item is a copy of the catalog item's player-safe parts (never the GM's notes) plus its price in gold:
   {k, it:catalog id, name, kind, ic, d, path, gears:[[rating key, value]], silver, price} */
N.shopOf = ch => (N.G.shops || {})[ch] || null;
N.shopOpen = ch => { const s = N.shopOf(ch); return s && s.state === 'open' ? s : null; };
N.shopOk = ch => ch === 'gm' || (!!N.chKey(ch) && !N.metaOnly(ch));
/* a player's open request in a store chat: kind 'buy' (Purchase, waits for the GM to confirm) or 'haggle' (Bargain) */
N.shopAsk = (ch, cid, k, kind) => N.G.msgs.find(m => m.ch === ch && m[kind] && m[kind].c === cid && m[kind].k === k && m[kind].st === 'ask') || null;
N.shopItem = it => ({k:N.uid('si'), it:it.id, name:it.name, kind:N.itemKind(it.kind)[0], ic:it.ic || '',
  /* items from Jake's lists carry their class as the description, so like the catalog they show only the class line */
  d:it.cls ? '' : String(it.d || '').trim(), path:[...new Set([it.cls, it.sub, it.disc].filter(Boolean))].join(' · '),
  gears:N.itemGears(it).map(([k]) => [k, +it[k]]), ...(it.silver ? {silver:1} : {}), price:0});
/* what the players of the chat receive: names and pictures instead of card ids */
N.shopOut = s => ({id:s.id, ch:s.ch, state:s.state, name:s.name || '', t:s.t || 0,
  pcs:(s.pcs || []).map(id => { const c = N.G.chars[id]; return c && c.built ? {id, name:c.short || c.name, portrait:c.portrait || null, color:c.color || ''} : null; }).filter(Boolean),
  npcs:(s.npcs || []).map(n => ({name:n.name, portrait:n.portrait || null})), items:(s.items || []).map(x => { const {it, ...o} = x; return o; })});
/* the people of a store as {name, portrait, color}: on the GM's device from the cards, on a player's from the copy */
N.shopPcs = s => (s.pcs || []).map(x => typeof x === 'string' ? (c => c && c.built ? {id:x, name:c.short || c.name, portrait:c.portrait, color:c.color} : null)(N.G.chars[x]) : x).filter(Boolean);
N.goldTxt = n => `${Math.max(0, parseInt(n, 10) || 0).toLocaleString('en-US')} gold`;
N.GOLD_MAX = 9999999; /* Gold on a card: whole numbers 0 to this, 7 digits like the box allows */
N.revSkills = c => { const sk = Object.entries(c.skills || {}); for (const k of MUNDANE) if (!(k in (c.skills || {}))) sk.push([k, 0]); return sk.sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])); };
N.revParts = (c, pc) => {
  const out = [], add = (k, grp, l, v) => out.push({k, g:grp, l, v});
  add('name', 'Who they are', 'Name', (c.name || c.short || '') + ' · needed before they see anything');
  add('pic', 'Who they are', 'Picture', c.portrait ? 'Their portrait' : 'No picture yet');
  add('race', 'Who they are', 'Race', c.race || 'Not set');
  add('nat', 'Who they are', 'Nationality', c.nat || 'Not set');
  if (!pc) add('job', 'Who they are', 'Job or faction', c.job || 'Not set');
  add('age', 'Who they are', 'Age', c.age ? 'Age ' + c.age : 'Not set');
  N.pcAspects(c).forEach((a, i) => add('a:' + i, 'Aspects', `Aspect ${i + 1}`, a));
  N.revSkills(c).forEach(([n, x]) => add('sk:' + n, 'Skills', n, sgn(x) + ' ' + ladderWord(x)));
  (c.stunts || []).filter(([n, d]) => n || d).forEach(([n, d]) => add('st:' + (n || d), 'Stunts', n || 'Unnamed stunt', d));
  consSlots(c.skills || {}).forEach(sl => add('cn:' + sl.k, 'Consequences', `${sl.l} (${sl.lo}–${sl.hi} shifts)`, (c.cons || {})[sl.k] ? `${c.cons[sl.k]} · ${N.conStL(N.conSt(c, sl.k))}` : 'Empty right now'));
  N.GEARK.forEach(([k, l]) => add('g:' + k, 'Weapons and armor', l, sgn(+c[k] || 0)));
  (c.inv || []).forEach(([n, q, d]) => add('it:' + n, 'Inventory', n, ['×' + q, d].filter(Boolean).join(' · ')));
  add('bio', 'More', 'Bio', c.bio || 'Empty');
  if (pc) add('people', 'More', 'Important people', c.people || 'Empty');
  return out;
};
/* older reveal lists (before names were their own part) used about, cons and gear for whole groups */
N.revKeys = (c, keys) => keys.flatMap(k => k === 'about' ? ['race', 'nat', 'age'] : k === 'cons' ? consSlots(c.skills || {}).map(sl => 'cn:' + sl.k) : k === 'gear' ? N.GEARK.map(g => 'g:' + g[0]) : [k]);
/* what one player is told about a card: only the parts in keys, nothing at all without the name */
N.revealed = (c, pc, keys0) => {
  const keys = N.revKeys(c, keys0), has = k => keys.includes(k);
  if (!has('name')) return null;
  const r = {id:c.id, name:c.name || c.short || ''};
  if (has('pic') && c.portrait) r.portrait = c.portrait;
  if (has('race') && c.race) r.race = c.race;
  if (has('nat') && c.nat) r.nat = c.nat;
  if (!pc && has('job') && c.job) r.job = c.job;
  if (has('age') && c.age) r.age = c.age;
  const asp = N.pcAspects(c).map((a, i) => [i, a]).filter(([i]) => has('a:' + i)); if (asp.length) r.aspects = asp;
  const sk = N.revSkills(c).filter(([n]) => has('sk:' + n)).map(([n, x]) => [n, x, discOf(c, n)]); if (sk.length) r.skills = sk;
  const st = (c.stunts || []).filter(([n, d]) => has('st:' + (n || d))); if (st.length) r.stunts = st;
  const cn = consSlots(c.skills || {}).filter(sl => has('cn:' + sl.k)).map(sl => [sl.l, sl.lo + '–' + sl.hi, (c.cons || {})[sl.k] || '', N.conSt(c, sl.k)]); if (cn.length) r.cons = cn;
  const gr = N.GEARK.filter(([k]) => has('g:' + k)).map(([k]) => [k, +c[k] || 0]); if (gr.length) r.gear = gr;
  const it = (c.inv || []).filter(([n]) => has('it:' + n)).map(([n, q, d, ic]) => [n, q, d || '', ic || 'bag']); if (it.length) r.inv = it;
  if (has('bio') && c.bio) r.bio = c.bio;
  if (pc && has('people') && c.people) r.people = c.people;
  const mt = N.metOf(keys); if (mt) r.met = mt;
  return r;
};
N.revOf = (id, seat) => ((N.G.rev || {})[id] || {})[seat] || [];
/* Met / Heard of lives in the same list; it is not a card part, so counts and Reveal everything leave it alone */
N.MET = {met:'Met', heard:'Heard of'};
N.metOf = keys => { const k = (keys || []).find(x => x.startsWith('met:')); return k ? k.slice(4) : ''; };
N.revCount = (id, seat) => N.revOf(id, seat).filter(k => !k.startsWith('met:')).length;
N.revSeats = id => Object.entries((N.G.rev || {})[id] || {}).filter(([, l]) => l.some(k => !k.startsWith('met:'))).map(([s]) => s);
N.pcTag = c => N.pcAspects(c)[0] || '';

/* ---------- combat helpers ---------- */
N.cb = () => N.G.combat;
/* a fight lives in the chat it was started in: Everyone, a private or group chat, or GM notes (only the GM ever sees that one) */
N.fightCh = () => N.G.combat.state === 'off' ? N.G.fch : N.G.combat.ch || 'table';
/* several fights can run at once, one per chat. N.G.combat is always the fight in the chat on screen (N.G.fch),
   so the fight code only ever deals with one; the others wait in N.G.fights until their chat is opened. */
N.G.fights = {}; N.G.fch = 'table';
N.allFights = () => { const g = N.G, all = {...g.fights}; delete all[g.fch]; if (g.combat.state !== 'off') all[g.fch] = g.combat; return all; };
N.fightIn = ch => N.allFights()[ch] || null;
N.focusFight = ch => {
  const g = N.G; if (!ch || ch === g.fch) return;
  g.fights = N.allFights(); g.fch = ch;
  g.combat = g.fights[ch] || Object.assign(freshCombat(), {ch});
};
N.chSeat = ch => /^dm-p\d+$/.test(ch || '') ? ch.slice(3) : null;
/* a fight outside the table chat has its own document fights/<key>: the seat for a private chat, the group's id for a group chat */
N.chKey = ch => N.chSeat(ch) || (N.grpOf(ch) ? ch.slice(4) : null);
/* the seats that can read a chat, or null for the whole table */
N.chSeats = ch => { const s = N.chSeat(ch); if (s) return [s]; const gr = N.grpOf(ch); return gr ? (gr.seats || []) : null; };
/* the characters whose players can see a chat (none for GM notes: a fight there is the GM's own, players are never in it) */
N.pcsIn = ch => { if (ch === 'gm') return []; const ss = N.chSeats(ch); return N.pcs().filter(c => !ss || ss.includes(c.player)); };
N.tokById = id => N.G.combat.tokens.find(t => t.id === id);
/* the fighter behind a roll's whoKey ('tok:<id>' or 'pc:<char id>'), if they are in this fight */
N.tokOfKey = (key = '') => key.startsWith('tok:') ? N.tokById(key.slice(4)) : key.startsWith('pc:') ? N.G.combat.tokens.find(t => t.kind === 'pc' && t.ref === key.slice(3)) : null;
N.zoneOf = t => N.G.combat.zones.find(z => z.id === t.zone);
/* teams: every fighter is on one. 'ally' (the players' side) and 'foe' are always there; the GM can add more for a
   three-way (or bigger) fight or contest (combat.teams, Jake). A token's side holds its team; player characters start on 'ally'
   and the GM can move anyone, players too. A team that was deleted puts its people back on their usual side. */
N.sideOf = t => { const s = t.side, def = t.kind === 'pc' ? 'ally' : 'foe';
  return !s ? def : s === 'ally' || s === 'foe' ? s : (N.G.combat.teams || []).some(x => x.id === s) ? s : def; };
N.TEAMCOL = ['#9cd36b','#f4c46e','#f39ad0','#6fd6c0','#a99bff'];
/* a fight, a contest (competing overcome rolls scored by rounds) or a challenge (people working together through set skill rolls) */
N.cbKind = (cb = N.G.combat) => cb && (cb.kind === 'contest' || cb.kind === 'challenge') ? cb.kind : 'fight';
N.KIND = {fight:{w:'fight', W:'Fight', ic:'swords', ppl:'fighters'}, contest:{w:'contest', W:'Contest', ic:'flag', ppl:'people in the contest'}, challenge:{w:'challenge', W:'Challenge', ic:'overcome', ppl:'people in the challenge'}};
N.kw = (cb = N.G.combat) => N.KIND[N.cbKind(cb)];
N.teams = (cb = N.G.combat) => {
  const k = N.cbKind(cb), tn = cb.tn || {};
  return [{id:'ally', name:tn.ally || (k === 'fight' ? 'Players and allies' : 'Players’ side'), col:'var(--accent)'}, {id:'foe', name:tn.foe || (k === 'fight' ? 'Foes' : 'Rivals'), col:'var(--c-foe)'},
    ...(cb.teams || []).map((x, i) => ({id:x.id, name:x.name || `Team ${i + 3}`, col:x.col || N.TEAMCOL[i % N.TEAMCOL.length], extra:true}))];
};
N.teamOf = (t, cb = N.G.combat) => N.teams(cb).find(x => x.id === N.sideOf(t)) || N.teams(cb)[0];
N.sameZone = t => N.G.combat.tokens.filter(o => o !== t && !o.out && t.zone && o.zone === t.zone);
N.foesOf = t => N.sameZone(t).filter(o => N.sideOf(o) !== N.sideOf(t));
/* who an attack can hit: anyone on the board, own side too (friendly fire for plot twists, mind control), and in any zone
   (Jake's rule: it's the GM who keeps Fighting to the same zone, unless a stunt says otherwise).
   Same zone first (foes, then own side), then the other zones (foes, then own side). */
N.targetsOf = t => { if (!t.zone) return []; const all = N.G.combat.tokens.filter(o => o !== t && !o.out && o.zone), near = all.filter(o => o.zone === t.zone), far = all.filter(o => o.zone !== t.zone);
  const foe = o => N.sideOf(o) !== N.sideOf(t); return [...near.filter(foe), ...near.filter(o => !foe(o)), ...far.filter(foe), ...far.filter(o => !foe(o))]; };
/* true when a fight roll from a aims at d standing in another zone: the GM can put a distance debuff on it */
N.isFar = (a, d) => !!(a && d && a.zone && d.zone && a.zone !== d.zone);
N.tokSkills = t => t.kind === 'pc' ? (N.G.chars[t.ref]?.skills || {}) : (t.skills || {});
N.tokNotice = t => N.tokSkills(t).Notice || 0;
/* turn order: the Notice roll made when the fight started (t.init), Notice itself breaks ties.
   Fights saved before Notice was rolled have no t.init and fall back to plain Notice.
   If the GM picked someone else to go first (combat.lead), they head the order. */
const initOf = t => t.init ?? N.tokNotice(t);
/* the GM can set the order by hand instead (combat.ord, Jake): those ids go in that order, anyone added later after them by Notice */
N.order = (cb = N.G.combat) => {
  const ord = Array.isArray(cb.ord) && cb.ord.length ? cb.ord : null, pos = t => { const i = ord ? ord.indexOf(t.id) : -1; return i < 0 ? 1e6 : i; };
  const o = cb.tokens.filter(t => !t.out && t.zone).map((t,i)=>({t,i})).sort((a,b)=>pos(a.t)-pos(b.t)||initOf(b.t)-initOf(a.t)||N.tokNotice(b.t)-N.tokNotice(a.t)||a.i-b.i).map(x=>x.t);
  const i = cb.lead ? o.findIndex(t => t.id === cb.lead) : -1;
  if (i > 0) o.unshift(o.splice(i, 1)[0]);
  return o;
};
/* gear ratings (0 to 9). gearAtk is the melee weapon (the field kept its old name so every card's rating carries over),
   gearDef the armor, gearAmmo the ranged ammo, gearRng the ranged weapon.
   Melee weapon (Fighting attacks) and ammo (Shooting attacks) add shifts to a hit, armor takes shifts off it
   (see N.cbResolve). The ranged weapon is the only one that changes a roll: it is added to a Shooting attack roll.
   NPC tokens carry their own; a player's character card holds theirs. */
N.tokGear = (t, k) => !t ? 0 : t.kind === 'npc' ? (+t[k] || 0) : (+(N.G.chars[t.ref] || {})[k] || 0);
/* what an attacker's gear does for an attack with this skill: roll = added to the attack roll, hit = shifts added to a hit */
N.atkGear = (t, sk) => sk === 'Fighting' ? {roll:0, hit:N.tokGear(t, 'gearAtk'), hitL:'melee weapon'}
  : sk === 'Shooting' ? {roll:N.tokGear(t, 'gearRng'), rollL:'ranged weapon', hit:N.tokGear(t, 'gearAmmo'), hitL:'ammo'} : {roll:0, hit:0};
/* the catalog items behind an attacker's gear for an attack with this skill (GM device only: players have no catalog):
   the melee weapon(s) for Fighting, the ranged weapon and ammo for Shooting. [{l, it}], it.gm is the GM's note.
   A rating set by hand with nothing equipped behind it gives nothing. Looked up live, so an edited note shows at once. */
N.atkItems = (t, sk) => {
  if (!t || !(N.G.items || []).length) return [];
  const o = t.kind === 'pc' ? N.G.chars[t.ref] : (N.G.npcs || []).find(n => n.id === t.ref);
  if (!o) return [];
  const out = [], add = (l, it) => { if (it) out.push({l, it}); };
  if (sk === 'Fighting') { const mel = N.eqOf(o, 'melee'), two = mel[1] && mel[0].dual && mel[1].dual;
    add(two ? 'Melee weapon 1' : 'Melee weapon', mel[0]); if (two) add('Melee weapon 2', mel[1]); }
  if (sk === 'Shooting') { add('Ranged weapon', N.eqOf(o, 'ranged')[0]); add('Ammo', N.eqOf(o, 'ammo')[0]); }
  return out;
};
N.curTok = () => { if (N.G.combat.phase === 'notice' || N.cbKind() === 'challenge') return null; const o = N.order(); return o.length ? o[N.G.combat.turn % o.length] : null; };
N.tokObj = t => { if (t.kind === 'pc') { const c = N.G.chars[t.ref] || {}; const p = N.G.P[c.player]; return {name:c.short || '?', portrait:c.built ? c.portrait : null, color:p?.color || 'var(--accent)'}; }
  const s = N.sideOf(t), tm = s !== 'ally' && s !== 'foe' && N.teams().find(x => x.id === s);
  return {name:t.name, portrait:t.portrait, color:tm ? tm.col : s === 'ally' ? 'var(--c-npc)' : 'var(--c-foe)'}; };
N.tokName = t => t.kind === 'pc' ? (N.G.chars[t.ref]?.short || 'Someone') : t.name;
N.tokStress = t => { if (t.kind === 'pc') { const c = N.G.chars[t.ref]; return c ? {v:c.stressV.phys, s:c.stress.phys} : {v:[], s:[]}; } return {v:t.stressV || [], s:t.stress || []}; };
N.isMine = (t, role) => !!t && t.kind === 'pc' && role !== 'gm' && N.G.P[role]?.char === t.ref;
N.ZCOL = ['#f4c46e','#6fd6c0','#ff9a7e','#a99bff','#9cd36b','#f39ad0'];
N.tokFromNpc = (n, side, label) => {
  const nameless = n.type === 'nameless', v = N.physBoxes(n, nameless);
  return {id:uid('t'), kind:'npc', ref:n.id, name:label || n.name, portrait:n.portrait || null, side, type:n.type || 'supporting', skills:{...(n.skills||{})},
    aspects:[n.hc, ...(n.aspects||[])].filter(Boolean), stressV:v, stress:v.map(()=>false), cons:{...(n.cons||{})}, zone:null, out:false, ...N.tokGearOf(n)};
};
N.tokFromPc = c => ({id:uid('t'), kind:'pc', ref:c.id, zone:null, out:false});
})();
