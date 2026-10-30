/* Norne: shared game state, Fate rules and the helpers every screen uses.
   N.G holds what came from Firestore (see sync.js); screens only read it and actions change it,
   then N.save() writes the changed parts back. */
(function(){
const N = window.N = {};

/* ---------- helpers ---------- */
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const fmt = s => esc(s).replace(/\*([^*\n]+)\*/g,'<em>$1</em>').replace(/\n/g,'<br>');
let _n = 0; const uid = p => p + Date.now().toString(36) + (++_n).toString(36) + Math.random().toString(36).slice(2,6);
const clamp = (v,a,b) => Math.max(a, Math.min(b, v));
const sgn = n => (n < 0 ? '−' : '+') + Math.abs(n);
const IC = (k, cls='') => { const i = (window.ICONS||{})[k]; return i ? `<svg viewBox="${i[0]}" class="${cls}" aria-hidden="true" fill="currentColor">${i[1]}</svg>` : ''; };
const STAR = '<svg viewBox="0 0 24 24" aria-hidden="true" fill="currentColor"><path d="M12 0c.9 6.6 4.6 10.6 12 12-7.4 1.4-11.1 5.4-12 12-.9-6.6-4.6-10.6-12-12 7.4-1.4 11.1-5.4 12-12z"/></svg>';
const MARK = '<svg viewBox="0 0 48 48" aria-hidden="true"><defs><linearGradient id="mk" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ffe9b0"/><stop offset="1" stop-color="#d9973f"/></linearGradient></defs><path fill="url(#mk)" d="M24 2c1.6 11 7.6 18 20 22-12.4 4-18.4 11-20 22-1.6-11-7.6-18-20-22C16.4 20 22.4 13 24 2z"/><path fill="none" stroke="url(#mk)" stroke-width="1.2" opacity=".7" d="M24 12c.8 5.4 3.8 9 10 12-6.2 3-9.2 6.6-10 12-.8-5.4-3.8-9-10-12 6.2-3 9.2-6.6 10-12z"/></svg>';
Object.assign(N, {esc, fmt, uid, clamp, sgn, IC, STAR, MARK});

/* ---------- Fate on the Nörne ladder ---------- */
const LADDER = {8:'Mythic',7:'Legendary',6:'Renowned',5:'Expert',4:'Great',3:'Good',2:'Fair',1:'Average',0:'Mediocre','-1':'Poor','-2':'Terrible'};
const ladderWord = v => LADDER[clamp(v,-2,8)];
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
N.RACES = ['Human','Half-Elf','Elf','Dwarf','Goblin','Centaur','Werewolf','Vampire','Gorgon','Bugfolk','Kenku','Gnome','Fishfolk','Satyr','Lizardfolk','Ogre'];
const MAGIC = ['Elemental Magic','Ward Magic','Healing Magic','Conjuring Magic','Alteration Magic','Illusion Magic','Spatial Magic','Mind Magic','Divination Magic','Enchantment Magic'];
const discOf = (o, k) => { const x = (o.disc || {})[k]; return Array.isArray(x) ? x : x ? [x] : []; };
const stressVals = r => r <= -1 ? [2] : r === 0 ? [1,2] : r <= 2 ? [1,2,2] : [1,2,2,3];
const ACTIONS = [['Overcome','overcome'],['Create an advantage','advantage'],['Attack','attack'],['Defend','defend']];
const diceSum = r => r.dice.reduce((a,b)=>a+b,0);
/* an invoke is +2, or a reroll of all four dice (marked reroll:true, adds nothing) */
const plusInvokes = r => (r.invokes||[]).filter(i => !i.reroll).length;
const rollTotal = r => diceSum(r) + r.bonus + 2*plusInvokes(r);
function outcome(r){
  if (r.opp == null) return null;
  const sh = rollTotal(r) - r.opp;
  if (sh < 0) return {k:'fail', t:'Fail', sh};
  if (sh === 0) return {k:'tie', t:'Tie', sh};
  if (sh < 3) return {k:'succ', t:'Success', sh};
  return {k:'style', t:'With style', sh};
}
const rollDice = () => [0,0,0,0].map(() => Math.floor(Math.random()*3) - 1);
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
Object.assign(N, {LADDER, ladderWord, MUNDANE, stressVals, ACTIONS, diceSum, plusInvokes, rollTotal, outcome, rollDice});

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
  if (!String(src).startsWith('fs:')) return src;
  return N.loadImg ? N.loadImg(src.slice(3)) : '';
};
/* a portrait is a built-in key (art/pt/<key>-face.png), an "fs:" upload or nothing */
N.faceUrl = p => !p ? null : /^(fs:|data:|https?:|art\/|img\/)/.test(p) ? (N.imgUrl(p) || null) : FACE(p);

/* ---------- wiki and map vocab ---------- */
N.WCATS = ['World','Nations','Places','People','Races','Religions','Magic','Factions','History','Prophecies','Food & Drink','Items','Rules','Storylines'];
N.CATICON = {'World':'globe','Nations':'flag','Places':'places','People':'person','Races':'races','Religions':'religion','Magic':'magic','Factions':'faction','History':'history','Prophecies':'prophecy','Food & Drink':'drink','Items':'items','Rules':'rules','Storylines':'story'};
N.CATICONS = ['globe','flag','places','person','races','religion','magic','faction','history','prophecy','drink','items','rules','story','castle','tavern','crown','sword','helm','dwarf','potion','spellbook','skull','coins','scroll','mask','herald','campfire','star','heart'];
/* the GM can rename, add, remove and reorder categories (game/meta); until then the built-in list is used */
N.cats = () => N.G.cats || N.WCATS.map(name => ({name, ic:N.CATICON[name] || 'globe'}));
N.catIcon = name => (N.cats().find(c => c.name === name) || {}).ic || N.CATICON[name] || 'globe';
/* every category with entries in it: the GM's list in order, then any an entry still names */
N.catNames = wiki => { const names = N.cats().map(c => c.name); for (const e of wiki) if (e.cat && !names.includes(e.cat)) names.push(e.cat); return names; };

/* ---------- who sees a wiki entry, a map or a news edition ----------
   Hidden (wiki gm:true, map vis:false) is GM only. Otherwise see:['p1',…] limits it to those seats; no see is everyone. */
const hiddenOf = (x, kind) => kind === 'wiki' ? !!x.gm : kind === 'map' ? x.vis === false : false;
/* a wiki entry's pictures: the lore's own picture (img) and any the GM added (imgs) */
N.wikiPics = e => { const seen = new Set(); return [...(e.img ? [e.img] : []), ...(e.imgs || [])].filter(p => p?.src && !seen.has(p.src) && seen.add(p.src)); };
N.audOf = (x, kind) => hiddenOf(x, kind) ? 'gm' : (Array.isArray(x.see) && x.see.length ? x.see : '*');
N.audSet = (x, kind, val) => {
  const hide = h => { if (kind === 'wiki') { if (h) x.gm = true; else delete x.gm; } else if (kind === 'map') x.vis = !h; };
  const cur = N.audOf(x, kind);
  if (val === '*' || val === 'gm') { hide(val === 'gm'); delete x.see; return; }
  const s = new Set(Array.isArray(cur) ? cur : []);
  s.has(val) ? s.delete(val) : s.add(val);
  if (s.size) { hide(false); x.see = [...s].sort((a,b) => a.slice(1) - b.slice(1)); }
  else { delete x.see; hide(kind !== 'news'); }
};
/* the seats that can see it right now */
N.audSeats = (x, kind) => { const a = N.audOf(x, kind); return a === 'gm' ? [] : a === '*' ? N.seats() : a.filter(s => N.G.P[s]); };
N.audLabel = (x, kind) => {
  const a = N.audOf(x, kind);
  if (a === 'gm') return 'Only you';
  if (a === '*') return 'Everyone';
  const names = a.map(s => N.G.P[s]?.name || 'a former player');
  return 'Only ' + (names.length > 1 ? names.slice(0, -1).join(', ') + ' and ' + names[names.length - 1] : names[0]);
};
N.PINT = {
  town:{name:'Towns',col:'#efd9a0',ic:'castle'}, nation:{name:'Nations',col:'#f4c46e',ic:'flag'}, landmark:{name:'Landmarks',col:'#c9bdff',ic:'star'},
  tavern:{name:'Taverns',col:'#f2b25c',ic:'tavern'}, shop:{name:'Shops',col:'#a3d6b4',ic:'bag'}, temple:{name:'Temples',col:'#f4e38d',ic:'religion'},
  danger:{name:'Danger',col:'#ff8a6e',ic:'warn'}, note:{name:'Notes',col:'#cfd8d3',ic:'pen'}, party:{name:'Party',col:'#8c7cff',ic:'banner'},
};

/* ---------- the shared game (filled in by sync.js) ---------- */
const SEATCOL = 8;
N.G = {
  me:null, role:'gm',
  P:{gm:{id:'gm', name:'GM', color:'var(--c-gm)'}},
  chars:{}, npcs:[], quick:[], foes:[], recent:[], pics:[], msgs:[], combat:null, maps:[], wiki:[], cats:null, news:{issues:[], seen:{}}, seen:{}, emoji:[], gifKey:'',
};
/* ---------- emoji: reactions on messages, and the GM's own pictures (custom emoji, written :name:) ---------- */
N.EMO_QUICK = ['👍','❤️','😂','😮','😢','🔥'];
N.EMO_ALL = ['👍','👎','❤️','😂','🤣','😮','😢','😡','🔥','🎉','👏','🙏','💀','😱','🤔','😏','😎','🥲','😬','🙄','🤯','😴','🤝','✨','⚔️','🛡️','🏹','🗡️','🪓','🍺','🎲','🐉','👑','🕯️','🌙','☀️','💰','🧪','📜','🗺️','✅','❌','❓','❗'];
N.emoById = n => (N.G.emoji || []).find(e => e.n === n);
/* one reaction or emoji as html: a custom one is :name:, anything else is a plain emoji character */
N.emj = (e, cls='cemo') => { const c = /^:([\w-]+):$/.exec(e || ''); if (!c) return esc(e); const x = N.emoById(c[1]); return x ? `<img class="${cls}" src="${esc(x.d)}" alt=":${esc(x.n)}:" title=":${esc(x.n)}:" draggable="false">` : esc(e); };
/* custom emoji typed into a message, after fmt() */
N.emoText = h => (N.G.emoji || []).length ? h.replace(/:([\w-]{1,32}):/g, (all, n) => N.emoById(n) ? N.emj(all) : all) : h;
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
    stressV:{phys:pv, ment:mv}, stress:{phys:pv.map(()=>false), ment:mv.map(()=>false)}, cons:{mild:'',moderate:'',severe:''}, gearAtk:0, gearDef:0}, o);
}
function freshCombat(){
  return {state:'off', id:null, ch:'table', title:'', bg:N.FIGHTBG, zones:[], tokens:[], turn:0, exchange:1, aspects:[], invited:[], joined:[], pending:null, acted:false, moved:false, phase:null, lead:null};
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

/* free invokes on a scene aspect are spent by the rolls that used them */
N.sceneFreeLeft = (sc, i) => {
  const a = sc.aspects[i]; if (!a || !a.free) return 0;
  const ref = `scene:${sc.msg}:${i}`;
  let used = 0; for (const m of N.G.msgs) if (m.kind === 'roll') for (const iv of (m.roll.invokes||[])) if (iv.ref === ref) used++;
  return Math.max(0, a.free - used);
};

/* ---------- people and chats ---------- */
N.seats = () => Object.keys(N.G.P).filter(k => k !== 'gm').sort((a,b) => a.slice(1) - b.slice(1));
N.gmName = () => N.G.P.gm.name;
N.chName = (id, role) => {
  if (id === 'table') return 'Everyone';
  if (id === 'gm') return 'GM notes';
  const pr = id.slice(3);
  return role === 'gm' ? (N.G.P[pr]?.name || 'A former player') : `${N.gmName()} · GM`;
};
N.chSub = (id, role) => id === 'table' ? 'The whole table sees this chat' : id === 'gm' ? 'Only you see this. Secret rolls land here.' : role === 'gm' ? `Only you and ${N.G.P[id.slice(3)]?.name || 'them'} see this` : 'Only you and the GM see this';
N.channelsFor = role => role === 'gm' ? ['table', ...N.seats().map(s => 'dm-' + s), 'gm'] : ['table', 'dm-' + role];
N.unread = (role, ch) => { const s = (N.G.seen[role] || {})[ch] || 0; let n = 0; for (const m of N.G.msgs) if (m.ch === ch && m.by !== role && m.t > s && !(m.kind === 'scene' && m.quiet)) n++; return n; };

/* the characters of the people seated now, in seat order */
N.pcs = () => N.seats().map(s => N.G.chars[N.G.P[s].char]).filter(Boolean);
/* names the GM can speak as: NPC cards first, then quick voices without a card */
N.voices = () => { const names = N.G.npcs.map(n => n.name.trim()).filter(Boolean); return [...new Set([...names, ...N.G.quick.filter(Boolean)])]; };
N.npcSub = n => n ? [n.race, n.job].filter(Boolean).join(' · ') : 'Quick voice';

/* who can roll / be shown */
N.charOf = role => role === 'gm' ? null : N.G.chars[N.G.P[role]?.char];
N.av = (o, s, extra='') => {
  /* o: {name, portrait|face, color} */
  const face = o.face || N.faceUrl(o.portrait);
  const style = `${s ? `--s:${s}px;` : ''}--c:${o.color || 'var(--accent)'}`;
  return `<span class="av ${extra}" style="${style}">${face ? `<img src="${esc(face)}" alt="" loading="lazy" draggable="false">` : esc(((o.short||o.name||'?').trim()[0]||'?'))}</span>`;
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
N.personObj = by => {
  const G = N.G, p = G.P[by];
  if (by === 'gm') return {name:N.gmName(), color:'var(--c-gm)'};
  if (!p) return {name:'A former player', color:'var(--ink-3)'};
  const c = G.chars[p.char]; return {name:p.name, portrait:c?.built ? c.portrait : null, color:p.color};
};

/* a player card's aspects: older cards kept a high concept and trouble, newer ones just Aspect 1, 2, 3 */
N.pcAspects = c => [c.hc, c.trouble, ...(c.aspects || [])].filter(Boolean);
N.pcTag = c => N.pcAspects(c)[0] || '';

/* ---------- combat helpers ---------- */
N.cb = () => N.G.combat;
/* a fight lives in the chat it was started in: Everyone, or one player's private chat with the GM */
N.fightCh = () => N.G.combat.state === 'off' ? N.G.fch : N.G.combat.ch || 'table';
/* several fights can run at once, one per chat. N.G.combat is always the fight in the chat on screen (N.G.fch),
   so the fight code only ever deals with one; the others wait in N.G.fights until their chat is opened. */
N.G.fights = {}; N.G.fch = 'table';
N.allFights = () => { const g = N.G, all = {...g.fights}; delete all[g.fch]; if (g.combat.state !== 'off') all[g.fch] = g.combat; return all; };
N.fightIn = ch => N.allFights()[ch] || null;
N.focusFight = ch => {
  const g = N.G; if (!ch || ch === 'gm' || ch === g.fch) return;
  g.fights = N.allFights(); g.fch = ch;
  g.combat = g.fights[ch] || Object.assign(freshCombat(), {ch});
};
N.chSeat = ch => /^dm-p\d+$/.test(ch || '') ? ch.slice(3) : null;
/* the characters whose players can see a chat */
N.pcsIn = ch => { const s = N.chSeat(ch); return N.pcs().filter(c => !s || c.player === s); };
N.tokById = id => N.G.combat.tokens.find(t => t.id === id);
N.zoneOf = t => N.G.combat.zones.find(z => z.id === t.zone);
N.sideOf = t => t.kind === 'pc' ? 'ally' : (t.side || 'foe');
N.sameZone = t => N.G.combat.tokens.filter(o => o !== t && !o.out && t.zone && o.zone === t.zone);
N.foesOf = t => N.sameZone(t).filter(o => N.sideOf(o) !== N.sideOf(t));
N.tokSkills = t => t.kind === 'pc' ? (N.G.chars[t.ref]?.skills || {}) : (t.skills || {});
N.tokNotice = t => N.tokSkills(t).Notice || 0;
/* turn order: the Notice roll made when the fight started (t.init), Notice itself breaks ties.
   Fights saved before Notice was rolled have no t.init and fall back to plain Notice.
   If the GM picked someone else to go first (combat.lead), they head the order. */
const initOf = t => t.init ?? N.tokNotice(t);
N.order = (cb = N.G.combat) => {
  const o = cb.tokens.filter(t => !t.out && t.zone).map((t,i)=>({t,i})).sort((a,b)=>initOf(b.t)-initOf(a.t)||N.tokNotice(b.t)-N.tokNotice(a.t)||a.i-b.i).map(x=>x.t);
  const i = cb.lead ? o.findIndex(t => t.id === cb.lead) : -1;
  if (i > 0) o.unshift(o.splice(i, 1)[0]);
  return o;
};
/* gear ratings (0 to 9): gearAtk is the weapon, gearDef the armor. They never change a roll:
   the weapon adds shifts to a hit and the armor takes shifts off it (see N.cbResolve).
   NPC tokens carry their own; a player's character card holds theirs. */
N.tokGear = (t, k) => !t ? 0 : t.kind === 'npc' ? (+t[k] || 0) : (+(N.G.chars[t.ref] || {})[k] || 0);
N.curTok = () => { if (N.G.combat.phase === 'notice') return null; const o = N.order(); return o.length ? o[N.G.combat.turn % o.length] : null; };
N.tokObj = t => { if (t.kind === 'pc') { const c = N.G.chars[t.ref] || {}; const p = N.G.P[c.player]; return {name:c.short || '?', portrait:c.built ? c.portrait : null, color:p?.color || 'var(--accent)'}; }
  return {name:t.name, portrait:t.portrait, color:t.side === 'ally' ? 'var(--c-npc)' : 'var(--c-foe)'}; };
N.tokName = t => t.kind === 'pc' ? (N.G.chars[t.ref]?.short || 'Someone') : t.name;
N.tokStress = t => { if (t.kind === 'pc') { const c = N.G.chars[t.ref]; return c ? {v:c.stressV.phys, s:c.stress.phys} : {v:[], s:[]}; } return {v:t.stressV || [], s:t.stress || []}; };
N.isMine = (t, role) => !!t && t.kind === 'pc' && role !== 'gm' && N.G.P[role]?.char === t.ref;
N.ZCOL = ['#f4c46e','#6fd6c0','#ff9a7e','#a99bff','#9cd36b','#f39ad0'];
N.tokFromNpc = (n, side, label) => {
  const nameless = n.type === 'nameless', v = nameless ? [1] : stressVals((n.skills||{}).Strength||0);
  return {id:uid('t'), kind:'npc', ref:n.id, name:label || n.name, portrait:n.portrait || null, side, type:n.type || 'supporting', skills:{...(n.skills||{})},
    aspects:[n.hc, ...(n.aspects||[])].filter(Boolean), stressV:v, stress:v.map(()=>false), mild:'', zone:null, out:false, gearAtk:+n.gearAtk || 0, gearDef:+n.gearDef || 0};
};
N.tokFromPc = c => ({id:uid('t'), kind:'pc', ref:c.id, zone:null, out:false});
})();
