/* Norne: every screen, rendered for the viewer (GM or player, phone or desktop). */
(function(){
const N = window.N, {esc, fmt, IC, STAR, MARK, sgn, ladderWord, rollTotal, diceSum, outcome} = N;
const G = () => N.G;
/* Formatting a time through the browser's locale code is slow, and a redraw asks for every message's time and date again
   (it was over a third of every redraw). The formatters are made once and each minute's text is kept. */
const DTF = {}, dtf = (k, o) => DTF[k] || (DTF[k] = new Intl.DateTimeFormat([], o));
const TXT = new Map(), txt = (k, t, o) => { const key = k + Math.floor(t / 60000); let r = TXT.get(key);
  if (r === undefined) { if (TXT.size > 6000) TXT.clear(); r = dtf(k, o).format(new Date(t)); TXT.set(key, r); } return r; };
const hhmm = t => txt('t', t, {hour:'numeric', minute:'2-digit'});
/* Jake: the real-world day a message was sent. Chats get a divider line wherever the day changes, and every time shows its full date on hover */
const dayKey = t => { const d = new Date(t); return d.getFullYear() * 400 + d.getMonth() * 32 + d.getDate(); };
const fullDate = t => txt('d', t, {weekday:'long', month:'long', day:'numeric', year:'numeric'});
const dayName = t => { const d = new Date(t), now = new Date(), y = new Date(now); y.setDate(now.getDate() - 1);
  if (dayKey(d) === dayKey(now)) return 'Today';
  if (dayKey(d) === dayKey(y)) return 'Yesterday';
  return d.toLocaleDateString([], {weekday:'short', month:'short', day:'numeric', ...(d.getFullYear() === now.getFullYear() ? {} : {year:'numeric'})}); };
const timeTag = t => `<time datetime="${new Date(t).toISOString()}" title="${esc(fullDate(t))} · ${hhmm(t)}">${hhmm(t)}</time>`;
const isGM = v => v.role === 'gm';
/* Storybook Night: a few real stars of the star tile (same seeded maths as index.html) glint now and then.
   Made once; css/sky.css shows them only in Storybook Night with motion allowed. */
let glintsCache = '', glintsKey = '';
const glintsHtml = () => {
  /* only the stars this device's screen can show: every glint is an animation the browser keeps running, seen or not
     (a phone ran 80 of them, about a dozen on screen) */
  const sw = Math.max(screen.width || 0, innerWidth || 0) + 20, sh = Math.max(screen.height || 0, innerHeight || 0) + 20, key = sw + 'x' + sh;
  if (glintsCache && glintsKey === key) return glintsCache;
  glintsKey = key;
  let seed = 7; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647, st = [];
  for (let i = 0; i < 210; i++) { const r = rnd() * 1.05 + .25; rnd(); const a = rnd() * .6 + .2; st.push({x:rnd() * 520, y:rnd() * 520, ok:r > 1.05 && a > .6}); }
  for (let i = 0; i < 4; i++) { const x = rnd() * 500 + 10, y = rnd() * 500 + 10; rnd(); st.push({x, y, ok:true, gold:true}); }
  const pick = st.filter(o => o.ok), out = [];
  let k = 0;
  for (let ty = 0; ty < 1040; ty += 520) for (let tx = 0; tx < 2080; tx += 520) pick.forEach((o, i) => {
    if (!o.gold && (i + tx / 520 + ty / 260) % 4) return;
    const t = 9 + (k * 7.3) % 13, d = -((k * 4.1) % t);
    if (o.x + tx < sw && o.y + ty < sh) out.push(`<i class="gl${o.gold ? ' g' : ''}" style="left:${(o.x + tx).toFixed(1)}px;top:${(o.y + ty).toFixed(1)}px;--t:${t.toFixed(1)}s;--d:${d.toFixed(1)}s"></i>`);
    k++;
  });
  return (glintsCache = `<div class="sketchsky" aria-hidden="true"></div><div class="glints" aria-hidden="true">${out.join('')}</div>`);
};
const pn = c => G().P[c.player]?.name || 'A former player';
const fateDie = '<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><rect x="3.5" y="3.5" width="17" height="17" rx="5"/><path d="M12 8.2v7.6M8.2 12h7.6"/></svg>';
N.fateDie = fateDie;

/* ================= shell ================= */
N.appHtml = function(v){
  const g = G(), gm = isGM(v), ph = v.dev === 'phone';
  v._panes = null; /* deskPage fills in what the desktop side panels show this time */
  /* phone players open their inventory from the character sheet, so no Inventory tab there */
  if (ph && !gm && v.ui.tab === 'inv') { v.ui.tab = 'hero'; v.ui.charSel = null; v.ui.heroInv = true; }
  const tabs = [['chat','Chat','chat'],['map','Map','map'],['world','World','world'],['news','News','newsL'], ...(gm ? [['cast','Cast','cast'], ['gm','GM','crown']] : [['hero','Character','hero'], ...(ph ? [] : [['inv','Inventory','bag']])])];
  const otherUnread = N.channelsFor(v.role).some(c => !(v.ui.tab === 'chat' && v.ui.ch === c) && N.unread(v.role, c));
  const fightLive = Object.values(N.allFights()).some(f => f.state === 'live');
  const newsNew = gm ? 0 : N.newsUnseen(v.role).length;
  const me = N.personObj(v.role);

  const shelfOn = v.ui.tab === 'chat';
  const nav = `<nav class="nav" aria-label="Sections">
    <div class="mark">${MARK}<b>N<small>ORNE</small></b></div>
    <div class="navl scroll">
      ${shelfOn && v.dev === 'desktop' && v.ui.shelfOff ? `<button type="button" class="ni shopen" data-a="shelfDt" title="Show the chat list" aria-label="Show the chat list">${IC('list')}<span>Chats</span></button>` : ''}
      ${tabs.map(([id,l,ic]) => `<button type="button" class="ni" title="${l}" data-a="tab" data-v="${id}" ${v.ui.tab===id?'aria-current="page"':''}>${IC(ic)}<span>${l}</span><span class="end">${id==='chat'&&fightLive?`<span class="tag ember">${IC('swords')}Fight</span>`:''}${id==='chat'&&(shelfOn||gm)&&otherUnread?'<span class="dot"></span>':''}${id==='news'&&newsNew?`<span class="badge gold">${newsNew}</span>`:''}</span></button>
        ${id==='chat' && !shelfOn && !gm ? `<div class="sub" role="group" aria-label="Chats">${N.channelsFor(v.role).map(c => chanBtn(v,c)).join('')}</div>` : ''}`).join('')}
    </div>
    <div class="art" aria-hidden="true"></div>
    <button type="button" class="who" data-a="sheet" data-v="profile">${N.av(me,38)}<span><b>${esc(me.name)}</b><small>${gm?'Game master':'Player'}</small></span><span class="end">${IC('gear')}</span></button>
  </nav>`;

  const tabbar = `<nav class="tabbar" aria-label="Sections">${tabs.map(([id,l,ic]) => `<button type="button" data-a="tab" data-v="${id}" ${v.ui.tab===id?'aria-current="page"':''}><span class="ti">${IC(ic)}</span>${l}${id==='chat'&&fightLive?`<span class="fightdot">${IC('swords')}</span>`:id==='chat'&&otherUnread?'<span class="dot"></span>':''}${id==='news'&&newsNew?'<span class="dot"></span>':''}</button>`).join('')}</nav>`;

  let page = '';
  if (v.ui.tab === 'chat') page = chatPage(v);
  else if (v.ui.tab === 'map') page = `<main class="page">${mapPage(v)}</main>`;
  else if (v.ui.tab === 'world') page = `<main class="page">${worldPage(v)}</main>`;
  else if (v.ui.tab === 'news') page = `<main class="page">${newsPage(v)}</main>`;
  else if (v.ui.tab === 'hero') page = `<main class="page">${heroPage(v)}</main>`;
  else if (v.ui.tab === 'cast') page = `<main class="page">${castPage(v)}</main>`;
  else if (v.ui.tab === 'inv') page = `<main class="page">${invPage(v)}</main>`;
  else if (v.ui.tab === 'gm') page = `<main class="page">${gmPage(v)}</main>`;

  return `<div class="stars" aria-hidden="true"></div>${glintsHtml()}
    <div class="shell${v.dev === 'desktop' && v.ui.tab === 'chat' && N.fightAvail(v) && v.ui.fightOpen ? ' compact' : ''}${shelfOn && v.dev === 'desktop' ? ' shelved' : ''}${shelfOn && v.dev === 'desktop' && v.ui.shelfOff ? ' shelf-off' : ''}"${v.ui.shelfW ? ` style="--shelfw:${v.ui.shelfW}px"` : ''}>${nav}${shelfOn && v.dev === 'desktop' && !v.ui.shelfOff ? shelfHtml(v) : ''}${page}${tabbar}</div>
    ${shelfOn && v.dev === 'phone' && v.ui.shelf ? `<div class="scrim shelf-scrim" data-a="shelf"></div>${shelfHtml(v)}` : ''}
    ${v.ui.sheet ? `<div class="scrim" data-a="closeSheet"></div>${N.sheetHtml(v)}` : ''}
    ${v.ui.pop ? `<div class="scrim" style="background:transparent;backdrop-filter:none" data-a="closePop"></div>${popHtml(v)}` : ''}
    ${N.updReady && !v.ui.toast ? `<div class="toast upd" role="status"><span class="star4"></span><span>Norne was updated.</span><button type="button" data-a="appReload">Reload</button><button type="button" data-a="appLater" aria-label="Not now">${IC('x')}</button></div>` : ''}
    ${v.ui.toast ? `<div class="toast" role="status"><span class="star4"></span><span>${esc(v.ui.toast.text)}</span>${v.ui.toast.undo?'<button type="button" data-a="undo">Undo</button>':''}</div>` : ''}`;
};

function chanIcon(v, c){
  const g = G();
  if (c === 'table') return `<span class="cic">${IC('users')}</span>`;
  if (c === 'gm') return `<span class="cic">${IC('lock')}</span>`;
  if (c.startsWith('grp-') && N.grpOf(c)?.pic) return N.av({name:N.grpOf(c).name, portrait:N.grpOf(c).pic}, 24, 'grpav');
  if (c.startsWith('grp-')) return `<span class="cic grp">${IC(N.grpOf(c)?.party ? 'banner' : 'whisper')}</span>`;
  if (isGM(v)) return N.av(g.P[c.slice(3)] ? N.personObj(c.slice(3)) : {name:'?'}, 24);
  return N.av(N.personObj('gm'), 24);
}
N.chanIcon = chanIcon;
function chanBtn(v, c){
  const n = N.unread(v.role, c), cur = v.ui.tab === 'chat' && v.ui.ch === c;
  return `<button type="button" data-a="ch" data-v="${c}" ${cur?'aria-current="true"':''} class="${n&&!cur?'new':''}">${chanIcon(v,c)}<span>${esc(N.chName(c, v.role))}</span>${n&&!cur?`<span class="badge">${n}</span>`:''}</button>`;
}
/* the Discord-style list of chats: always beside the chat on desktop, a drawer from the left on phones */
function chanLast(v, c){
  const ms = G().msgs;
  for (let i = ms.length - 1; i >= 0; i--) {
    const m = ms[i];
    if (m.ch !== c || m.fc || (m.kind === 'scene' && (m.quiet || !m.scene))) continue;
    if (m.kind === 'scene') return 'New scene: ' + m.scene.title;
    if (m.kind === 'roll') return `${m.roll.who} rolled`;
    if (m.kind === 'fight' || m.kind === 'combat') return 'A fight';
    if (m.kind === 'pic') return `${isMe(v, m) ? 'You' : metaObj(m).name} sent a picture`;
    if (m.kind === 'news') return 'New edition of the paper';
    if (m.kind === 'sys') return m.text || '';
    const who = isMe(v, m) ? 'You' : m.kind === 'ooc' || m.kind === 'meta' || N.metaRp(m) ? metaObj(m).name : N.speakerObj(m).name;
    return `${who}: ${N.plainText(m.text || '')}`;
  }
  return N.chSub(c, v.role);
}
/* a person out of character; in Everyone they show by their own name on every character */
const metaObj = m => N.msgPerson(m);
/* in Everyone, what you wrote on another of your characters is still yours */
const isMe = (v, m) => m.by === v.role || (N.metaOnly(m.ch) && N.sameUser(m.by, v.role));
function shelfRow(v, c){
  const n = N.unread(v.role, c), cur = v.ui.ch === c, cb = N.fightIn(c), fight = !!cb && (cb.state === 'live' || (isGM(v) && cb.state === 'setup'));
  return `<button type="button" class="shr${n&&!cur?' new':''}" data-a="ch" data-v="${c}" title="${esc(N.chName(c, v.role))}" ${cur?'aria-current="true"':''}>${chanIcon(v,c)}<span class="t"><b>${esc(N.chName(c, v.role))}</b><small>${esc(chanLast(v, c).replace(/\s+/g, ' ').slice(0, 90))}</small></span>${fight?`<span class="tag ember">${IC('swords')}</span>`:''}${n&&!cur?`<span class="badge">${n}</span>`:''}</button>`;
}
N.shelfHtml = v => shelfHtml(v);
/* Group chats (Jake): the roleplay ones together first, then the Meta-only ones, each under its own small label */
function grpGroup(v, list){
  if (!list.length) return '';
  const rp = list.filter(c => !N.metaOnly(c)), meta = list.filter(c => N.metaOnly(c));
  const sub = (t, l) => l.length ? `<h4 class="shsub">${IC(t === 'Roleplay' ? 'mask' : 'chatL')}${t}</h4>${l.map(c => shelfRow(v, c)).join('')}` : '';
  return `<div class="shg" role="group" aria-label="Group chats"><h3>Group chats</h3>${meta.length ? sub('Roleplay', rp) + sub('Meta only', meta) : list.map(c => shelfRow(v, c)).join('')}</div>`;
}
function shelfHtml(v){
  const gm = isGM(v), chs = N.channelsFor(v.role), ph = v.dev === 'phone';
  const group = (t, list) => list.length ? `<div class="shg" role="group" aria-label="${t}"><h3>${t}</h3>${list.map(c => shelfRow(v, c)).join('')}</div>` : '';
  const me = N.personObj(v.role);
  /* beside an open fight on desktop the list shrinks to just the chat pictures, so the board keeps its room */
  const mini = !ph && fightAvail(v) && v.ui.fightOpen;
  return `<aside class="shelf${ph?' drawer':''}${mini?' mini':''}" aria-label="Chats">
    <header class="shh">${STAR.replace('<svg','<svg class="st"')}<h2>Chats</h2>${ph ? `<button type="button" class="ibtn" data-a="shelf" aria-label="Close the chat list">${IC('x')}</button>` : `<button type="button" class="ibtn sm shx" data-a="shelfDt" aria-label="Hide the chat list" title="Hide the chat list">${IC('left')}</button>`}</header>
    <div class="shl scroll" data-sk="shelf">
      ${group('The table', chs.filter(c => c === 'table'))}
      ${gm ? '' : group('Your party', chs.filter(c => N.grpOf(c)?.party))}
      ${gm ? group('Parties', chs.filter(c => N.grpOf(c)?.party)) : ''}
      ${group(gm ? 'Private chats' : 'Just you and the GM', chs.filter(c => c.startsWith('dm-')))}
      ${gm && N.seats().length ? `<button type="button" class="shr shnew" data-a="sheet" data-v="dms" title="Private chats"><span class="cic">${IC('whisper')}</span><span class="t"><b>Private chats</b><small>${N.seats().some(s => !N.dmOn(s)) ? 'Open one with a player' : 'Pick who has one with you'}</small></span></button>` : ''}
      ${grpGroup(v, chs.filter(c => c.startsWith('grp-') && !N.grpOf(c)?.party))}
      ${gm ? `<button type="button" class="shr shnew" data-a="grpNew" title="New group chat"><span class="cic">${IC('plus')}</span><span class="t"><b>New group chat</b><small>A few players in one chat, or a party</small></span></button>` : ''}
      ${group('Only you', chs.filter(c => c === 'gm'))}
    </div>
    ${ph ? `<button type="button" class="who" data-a="sheet" data-v="profile">${N.av(me,38)}<span><b>${esc(me.name)}</b><small>${gm?'Game master':'Player'}</small></span><span class="end">${IC('gear')}</span></button>` : mini ? '' : '<div class="shelfgrip" role="separator" aria-orientation="vertical" aria-label="Drag to resize the chat list" title="Drag to resize"></div>'}
  </aside>`;
}
function shelfBtn(v){
  const other = N.channelsFor(v.role).some(c => c !== v.ui.ch && N.unread(v.role, c));
  return `<button type="button" class="ibtn shelfb" data-a="shelf" aria-label="All chats">${IC('list')}${other?'<span class="dot"></span>':''}</button>`;
}
function meBtn(v){
  const me = N.personObj(v.role);
  return `<button type="button" class="me-btn" data-a="sheet" data-v="profile" aria-label="You and settings">${N.av(me,34)}</button>`;
}
function sideBtn(v, where){
  if (isGM(v)) return where === 'chat' ? meBtn(v) : '<span class="ibtn" style="visibility:hidden" aria-hidden="true"></span>';
  const c = N.charOf(v.role);
  return `<button type="button" class="me-btn" data-a="sheet" data-v="hero" aria-label="My character">${N.av({name:c.short, portrait:c.built?c.portrait:null, color:c.color},34)}</button>`;
}

/* ================= chat ================= */
/* the fight board only opens in the chat the fight lives in */
function fightAvail(v){
  const cb = G().combat;
  if (v.ui.ch !== N.fightCh()) return false;
  if (isGM(v)) return cb.state !== 'off';
  return cb.state === 'live' && (cb.joined.includes(v.role) || v.ui.watching || !!N.myTok(v));
}
function chatPage(v){
  const gm = isGM(v), fa = fightAvail(v);
  if (v.dev === 'phone') {
    const sl = v.ui.slide ? ` slide-${v.ui.slide}` : '';
    if (fa && v.ui.fightPane === 'fight') return `<main class="page${sl}">${N.fightView(v)}</main>`;
    if (sideOpen(v)) return sidePage(v, sl);
    return `<main class="page${sl}">${chatView(v)}${rollFx(v)}<button type="button" class="sidetab" data-a="sidePane" data-v="1" aria-label="Open the side panels" title="Side panels (or swipe in from the right edge)">${IC('left')}</button></main>`;
  }
  if (fa && v.ui.fightOpen && G().combat.state === 'live') return N.combatDesk(v);
  if (fa && v.ui.fightOpen) return `<main class="page fighting">${N.fightView(v)}${G().combat.state === 'setup' ? `<aside class="fight-chat setup-col scroll" data-sk="setup">${N.setupPanel(v)}</aside>` : `<div class="fight-chat">${chatView(v, true)}</div>`}</main>`;
  /* roleplay: the chat, the card (or GM screen) on the right, and the roleplay actions under it */
  v.ui.rpSeen = (G().msgs.findLast(m => m.ch === v.ui.ch) || {}).t || 0;
  return deskPage(v, chatView(v), `<div class="rail-a scroll" data-sk="rail">${gm ? gmScreen(v) : heroQuick(v)}</div>`, 'rp');
}
/* desktop: the big panel (C) on the left, and on the right the top panel (A) over the actions (B).
   The line on the right side's left edge drags to share the width; roleplay and combat remember their own widths.
   Jack (2026-11-12): each of the two right-hand panels has a picker in its header, so anyone can swap in another page
   (map, wiki, news, inventory, ...). Picked per device (localStorage), roleplay and combat each remember their own. */
const PANE_KEYS = {rp:['paneA', 'paneB'], cb:['paneAc', 'paneBc']};
/* what a side panel can show here: [id, label, icon]. 'def' is the panel the screen came with on top, 'recent' the one under it */
function paneOpts(v, mode){
  const gm = isGM(v), rp = mode === 'rp';
  return [
    ['def', rp ? (gm ? 'GM screen' : 'Character card') : (gm ? 'Battlefield' : 'Character card'), rp ? (gm ? 'crown' : 'hero') : (gm ? 'swords' : 'hero')],
    ['recent', rp ? 'Recent actions' : N.cbKind() === 'fight' ? 'Fight results and chat' : 'Results and chat', rp ? 'dice' : 'swords'],
    ...(gm && !rp ? [['gms', 'GM screen', 'crown']] : []),
    ['map', 'Map', 'map'], ['world', 'World', 'world'], ['news', 'News', 'newsL'],
    ...(gm ? [['cast', 'Cast', 'cast']] : [['hero', 'Character sheet', 'scroll']]), ['inv', 'Inventory', 'bag']];
}
/* the two panels' picks for this screen, falling back to the panels it came with */
function panePicks(v, mode){
  const ids = paneOpts(v, mode).map(o => o[0]), [ka, kb] = PANE_KEYS[mode];
  let a = ids.includes(v.ui[ka]) ? v.ui[ka] : 'def', b = ids.includes(v.ui[kb]) ? v.ui[kb] : 'recent';
  if (a === b) b = a === 'recent' ? 'def' : 'recent';
  return [a, b];
}
N.paneOpts = paneOpts; N.panePicks = panePicks; N.PANE_KEYS = PANE_KEYS;
/* one page drawn into a side panel: pages read v._pane to lay themselves out narrow (one column, back buttons) */
function paneBody(v, id, slot, a, mode){
  if (id === 'def') return a;
  if (id === 'recent') return `<div class="rcnt rc-in">${N.recentHtml(v, mode)}${mode === 'cb' ? fightComposer(v) : ''}</div>`;
  if (id === 'gms') return `<div class="rail-a scroll" data-sk="rail-${slot}">${gmScreen(v)}</div>`;
  v._pane = id;
  try {
    const page = id === 'map' ? mapPage(v) : id === 'world' ? worldPage(v) : id === 'news' ? newsPage(v) : id === 'hero' ? heroPage(v) : id === 'cast' ? castPage(v) : id === 'inv' ? invPage(v) : '';
    return `<div class="pane-c pane-${id}">${page}</div>`;
  } finally { v._pane = null; }
}
function paneHead(v, slot, id, mode, fold){
  const o = paneOpts(v, mode).find(x => x[0] === id), off = v.ui.recentOff;
  return `<div class="pane-h"><button type="button" class="pane-pick" data-a="pop" data-v="pane${slot.toUpperCase()}" aria-haspopup="menu" title="Pick what this panel shows">${IC(o[2])}<b>${esc(o[1])}</b>${IC('caret')}</button>${fold ? `<button type="button" class="pane-fold" data-a="recentFold" aria-expanded="${!off}" aria-label="${off ? 'Open' : 'Fold'} this panel" title="${off ? 'Open' : 'Fold'} this panel">${IC('caret').replace('<svg', `<svg style="rotate:${off ? 0 : 180}deg"`)}</button>` : ''}</div>`;
}
/* phones (Jack, 2026-11-12): swipe in from the right edge of a chat for the same two panels the desktop has on its right
   (Panel A over Panel B, each with its picker); swipe back to the right, or use the arrow, to return to the chat */
const sideOpen = v => v.dev === 'phone' && v.ui.tab === 'chat' && !!v.ui.sidePane && !(fightAvail(v) && v.ui.fightPane === 'fight');
N.sideOpen = sideOpen;
function sidePage(v, sl){
  const gm = isGM(v), mode = 'rp', off = v.ui.recentOff, [pa, pb] = panePicks(v, mode);
  const a = `<div class="rail-a scroll" data-sk="rail">${gm ? gmScreen(v) : heroQuick(v)}</div>`;
  v._paneMode = mode; v._panes = off ? [pa] : [pa, pb];
  return `<main class="page sidepg${sl || ''}"><div class="sp-top"><button type="button" class="ibtn" data-a="sidePane" data-v="0" aria-label="Close the side panels and go back to the chat">${IC('left')}</button><span><b>${esc(N.chName(v.ui.ch, v.role))}</b><small>Side panels</small></span></div>
    <div class="rail sp${off ? ' rc-off' : ''}">
    <section class="pane pa pane-is-${pa}">${paneHead(v, 'a', pa, mode)}${paneBody(v, pa, 'a', a, mode)}</section>
    <section class="pane pb rcnt pane-is-${pb}">${paneHead(v, 'b', pb, mode, true)}${off ? '' : paneBody(v, pb, 'b', a, mode)}</section></div></main>`;
}
function deskPage(v, c, a, mode, cls){
  /* every line between panels drags and every panel beside the main one folds; roleplay and combat remember their own sizes */
  const rp = mode === 'rp', off = v.ui.recentOff, wk = rp ? 'railW' : 'railWc', hk = rp ? 'rcH' : 'rcHc', ok = rp ? 'railOff' : 'railOffc';
  const w = v.ui[wk] || (!rp && isGM(v) ? 560 : 0), h = v.ui[hk];
  const [pa, pb] = panePicks(v, mode), plain = pa === 'def' && pb === 'recent';
  v._paneMode = mode;
  if (v.ui[ok]) return `<main class="page with-rail rail-off${cls ? ' ' + cls : ''}">${c}<aside class="rail"><button type="button" class="railopen" data-a="railFold" data-v="${ok}" aria-label="Show the side panel" title="Show the side panel">${IC('left')}<span>${!plain ? 'Side panels' : rp ? 'Card and actions' : N.cbKind() === 'fight' ? 'Fight panel' : 'Side panel'}</span></button></aside></main>`;
  v._panes = off ? [pa] : [pa, pb];
  return `<main class="page with-rail${cls ? ' ' + cls : ''}" data-wk="${wk}" data-hk="${hk}"${w ? ` style="--railw:${w}px"` : ''}>${c}<aside class="rail${off ? ' rc-off' : ''}"${h && !off ? ` style="--rch:${h}px"` : ''}>
    <div class="railgrip" role="separator" aria-orientation="vertical" aria-label="Drag to resize the side panel" title="Drag to resize"></div>
    <button type="button" class="railx" data-a="railFold" data-v="${ok}" aria-label="Hide the side panel" title="Hide the side panel">${IC('reply')}</button>
    <section class="pane pa pane-is-${pa}">${paneHead(v, 'a', pa, mode)}${paneBody(v, pa, 'a', a, mode)}</section>
    <section class="pane pb rcnt pane-is-${pb}">${off ? '' : '<div class="rowgrip" role="separator" aria-orientation="horizontal" aria-label="Drag to resize" title="Drag to resize"></div>'}${paneHead(v, 'b', pb, mode, true)}
      ${off ? '' : paneBody(v, pb, 'b', a, mode)}</section>
  </aside></main>`;
}
/* desktop, when this chat has a fight: one switch between the roleplay screen and the combat screen.
   In combat a count shows talk that came in since the roleplay screen was last open. */
function modeSeg(v){
  const cb = v.ui.fightOpen, g = G();
  const n = cb ? g.msgs.filter(m => m.ch === v.ui.ch && m.by !== v.role && m.t > (v.ui.rpSeen || 0) && !isAction(m) && m.kind !== 'scene').length : 0;
  return `<div class="seg modeseg" role="group" aria-label="Screen"><button type="button" data-a="mode" data-v="rp" aria-pressed="${!cb}">${IC('chatL')}Roleplay${n ? `<i class="nb">${n}</i>` : ''}</button><button type="button" data-a="mode" data-v="cb" aria-pressed="${!!cb}">${IC(N.kw().ic)}${N.cbKind() === 'fight' ? 'Combat' : N.kw().W}</button></div>`;
}
/* the chat that belongs to one fight: questions, what you'd like to do next. It stays with the fight, never in the roleplay chat */
function fightComposer(v){
  return `<form class="fc-comp" onsubmit="return false"><input class="inp" id="fc-${v.id}" data-i="fcDraft" value="${esc(v.ui.fcDraft || '')}" placeholder="Talk about the fight…" autocomplete="off" enterkeyhint="send"><button type="button" class="ibtn" data-a="fcSend" aria-label="Send to the fight chat">${IC('send')}</button></form>`;
}
N.deskPage = deskPage; N.modeSeg = modeSeg; N.fightComposer = fightComposer; N.rMsg = rMsg;
/* the GM screen / character panel beside the chat: on by default when there is room, the viewer can flip it */
function railShown(v){
  return v.dev === 'desktop';
}
function chatView(v, side){
  const g = G(), gm = isGM(v), ch = v.ui.ch, sc = g.scenes[ch], cb = g.combat;
  const fa = fightAvail(v), grpBtn = gm && !!N.grpOf(ch);
  /* Jake: the GM ends the day in a party or group chat where people roleplay (not a Meta-only one) */
  const dayBtn = grpBtn && !N.metaOnly(ch);
  const topPh = `<div class="top ph${dayBtn && !fa ? ' busy' : ''}">${shelfBtn(v)}${fa ? `<div style="flex:1;display:flex;justify-content:center">${fightSeg(v)}</div>` : `<button type="button" class="chname" data-a="shelf">${chanIcon(v,ch)}<span><b>${esc(N.chName(ch, v.role))}</b><small>${esc(N.chSub(ch, v.role))}</small></span></button>`}${dayBtn && !fa ? `<button type="button" class="ibtn" data-a="sheet" data-v="nextDay" aria-label="Next day" title="Next day">${IC('sun')}</button>` : ''}${grpBtn && !fa ? `<button type="button" class="ibtn${N.chPaused(ch) ? ' on' : ''}" data-a="grpPause" data-v="${ch.slice(4)}" aria-label="${N.chPaused(ch) ? 'Resume the chat' : 'Pause the chat'}" title="${N.chPaused(ch) ? 'Resume the chat' : 'Pause the chat'}">${IC(N.chPaused(ch) ? 'play' : 'lock')}</button>` : ''}${grpBtn && !fa ? `<button type="button" class="ibtn" data-a="grpEdit" data-v="${ch.slice(4)}" aria-label="Edit this group chat" title="Edit this group chat">${IC('gear')}</button>` : ''}<button type="button" class="ibtn" data-a="sheet" data-v="search" aria-label="Search the chats" title="Search the chats">${IC('search')}</button>${sideBtn(v, 'chat')}</div>`;
  const topDt = side ? '' : `<header class="top dt"><div style="flex:1;min-width:0"><h1>${esc(N.chName(ch, v.role))}</h1><span class="sub">${esc(N.chSub(ch, v.role))}</span></div>
    ${dayBtn && !fa ? `<button type="button" class="btn sm" data-a="sheet" data-v="nextDay" style="--h:36px" title="End the day and start the next one">${IC('sun')}Next day</button>` : ''}
    ${grpBtn ? `<button type="button" class="btn sm${N.chPaused(ch) ? ' gold' : ''}" data-a="grpPause" data-v="${ch.slice(4)}" style="--h:36px" title="${N.chPaused(ch) ? 'Let the players talk again' : 'Stop the players from sending messages'}">${IC(N.chPaused(ch) ? 'play' : 'lock')}${N.chPaused(ch) ? 'Resume chat' : 'Pause chat'}</button>` : ''}
    ${grpBtn ? `<button type="button" class="btn sm" data-a="grpEdit" data-v="${ch.slice(4)}" style="--h:36px">${IC('gear')}Edit group</button>` : ''}
    <button type="button" class="ibtn" data-a="sheet" data-v="search" aria-label="Search the chats" title="Search the chats">${IC('search')}</button>
    ${gm ? `<button type="button" class="ibtn" data-a="sheet" data-v="export" aria-label="Export the log" title="Export the log">${IC('export')}</button>` : ''}
    ${fa ? (cb.state === 'setup' ? `<button type="button" class="btn sm" data-a="openFight" style="--h:36px">${IC(N.kw().ic)}Back to ${N.kw().w} setup</button>` : modeSeg(v)) : ''}</header>`;
  const fightbar = (cb.state === 'live' && ch === N.fightCh() && !N.owedTok(v) && !fa) ? (() => {
    const cur = N.curTok(), k = N.cbKind(), K = N.kw();
    const sub = k === 'challenge' ? (c => `${c.done} of ${c.all} rolled · ${c.ok} succeeded`)(N.chalCount()) : k === 'contest' ? N.ctKeys().map(x => `${esc(N.ctName(x, v))} ${cb.score?.[x] || 0}`).join(' · ') + (cur ? ` · ${esc(N.tokName(cur))}’s turn` : '') : cur ? `${esc(N.tokName(cur))}’s turn · exchange ${cb.exchange}` : '';
    return `<div class="fightbar">${IC(K.ic,'sw')}<div class="t">${k === 'fight' ? 'Fight on' : K.W + ':'} ${esc(cb.title)}<span>${sub}</span></div>${fa ? `<button type="button" class="btn sm gold" data-a="openFight">Back to the fight</button>` : `<button type="button" class="btn sm" data-a="watch">Watch</button>`}</div>`;
  })() : '';
  /* an attack waiting on this screen's defense shows above the chat too, so it isn't missed with the board closed */
  const owed = N.owedTok(v), pend = cb.pending;
  const owedBar = owed ? (pend.stage === 'defend'
    ? `<div class="fightbar owed">${IC('attack','sw')}<div class="t">${esc(N.tokName(N.tokById(pend.att)))} attacks ${gm ? esc(N.tokName(owed)) : 'you'}!<span>${esc(pend.skill)} for ${sgn(pend.total)} ${ladderWord(pend.total)}. Roll the defense.</span></div>${N.defBtn(owed)}</div>`
    : `<div class="fightbar owed">${IC('warn','sw')}<div class="t">${gm ? esc(N.tokName(owed)) + ' takes' : 'You take'} ${pend.shifts} shift${pend.shifts>1?'s':''}<span>Pick a stress box or a consequence on the board.</span></div><button type="button" class="btn sm gold" data-a="openFight">Soak the hit</button></div>`) : '';
  /* an open store in this chat: players browse it; the GM also sees one being set up */
  const craft = !side && gm && N.craftOf(ch), craftIt = craft && N.itemById(craft.make);
  const craftBar = craft ? `<div class="fightbar shopbar craftbar">${IC('gear','sw')}<div class="t">Crafting setup${craftIt ? ': ' + esc(craftIt.name) : ''}<span>Only you see it until you roll.</span></div><button type="button" class="btn sm gold" data-a="sheet" data-v="craft" data-c="${esc(ch)}">Continue</button></div>` : '';
  const shop = N.shopOf(ch), shopOn = shop && shop.state === 'open';
  const shopBar = !side && shop && (gm || shopOn) ? (() => {
    const keep = (shop.npcs || []).map(n => n.name), n = (shop.items || []).length;
    return `<div class="fightbar shopbar">${IC('coins','sw')}<div class="t">${shopOn ? `Shopping at ${esc(shop.name || 'the store')}` : `Store setup${shop.name ? ': ' + esc(shop.name) : ''}`}<span>${shopOn ? `${n} item${n === 1 ? '' : 's'} for sale${keep.length ? ' · ' + esc(keep.join(', ')) : ''}` : 'Only you see it until you open the store.'}</span></div>${gm ? `<button type="button" class="btn sm${shopOn ? '' : ' gold'}" data-a="sheet" data-v="shop" data-c="${esc(ch)}">${shopOn ? 'Manage' : 'Continue setup'}</button>` : ''}${shopOn ? `<button type="button" class="btn sm gold" data-a="sheet" data-v="store" data-c="${esc(ch)}">Browse</button>` : ''}</div>`;
  })() : '';
  const chipRow = (!side && fa) ? `<div class="chname-row only-ph"><button type="button" class="chname" data-a="shelf">${chanIcon(v,ch)}<span><b>${esc(N.chName(ch, v.role))}</b></span>${IC('caret')}</button></div>` : '';
  return `<section class="chat" aria-label="${esc(N.chName(ch, v.role))}">
    ${side ? '' : topPh}${chipRow}${topDt}
    ${side ? '' : N.sceneNow(v)}
    <div class="msgs scroll" id="msgs-${v.id}" data-sk="msgs" data-bottom="1">${fightbar && side ? '' : ''}${renderMsgs(v, side)}</div>
    ${fightbar && !side ? '' : ''}
    ${composer(v)}
  </section>`.replace('<div class="msgs', (!side ? (owedBar || fightbar) + shopBar + craftBar : '') + '<div class="msgs');
}
function fightSeg(v){
  const n = N.unread(v.role, N.fightCh());
  /* the same Roleplay | Combat switch as on a computer */
  return `<div class="seg modeseg" role="group" aria-label="Screen"><button type="button" data-a="pane" data-v="chat" aria-pressed="${v.ui.fightPane==='chat'}">${IC('chatL')}Roleplay${n&&v.ui.fightPane!=='chat'?'<span class="dot"></span>':''}</button><button type="button" data-a="pane" data-v="fight" aria-pressed="${v.ui.fightPane==='fight'}">${IC(N.kw().ic)}${N.cbKind() === 'fight' ? 'Combat' : N.kw().W}</button></div>`;
}
N.sceneArt = (sc) => {
  if (!sc) return '';
  if (sc.place) { const mp = G().maps.find(m => m.id === sc.place.map), u = mp ? N.mapMid(mp.src) : ''; return `background-image:${u ? `url(${u})` : 'none'};background-size:420% auto;background-position:${(sc.place.rx*100).toFixed(1)}% ${(sc.place.ry*100).toFixed(1)}%`; }
  return '';
};
/* a scene's own picture (not a map place) sits inside its box as a framed layer */
N.scenePic = sc => sc && !sc.place ? N.bgPic(sc.art) : '';
/* the scene that was up when a message was said: the newest scene line at or before it in its chat.
   Before the chat's first scene, or after one ended, there was none (null). Scenes have always been chat lines, so old chats work too */
N.sceneAt = (ch, id) => {
  const ms = G().msgs, i = ms.findIndex(m => m.id === id); if (i < 0) return undefined;
  for (let j = i; j >= 0; j--) { const m = ms[j]; if (m.ch === ch && m.kind === 'scene') return m.scene ? Object.assign({msg:m.id}, m.scene) : null; }
  return null;
};
/* the banner over the chat: the live scene, or while scrolled back through older messages the scene they were said in */
N.sceneNow = v => {
  const ch = v.ui.ch, p = v.ui.past && v.ui.past.ch === ch ? v.ui.past : null;
  if (p) { const sc = N.sceneAt(ch, p.ref); if (sc !== undefined) return sceneBanner(v, sc, ch, true); }
  return sceneBanner(v, G().scenes[ch], ch);
};
function sceneBanner(v, sc, ch, past){
  const gm = isGM(v), priv = ch.startsWith('dm-') || ch.startsWith('grp-');
  if (!sc && past) return '';
  if (!sc) {
    if (!gm || ch === 'gm') return '';
    return `<section class="scene empty"><div class="in" style="grid-template-columns:auto 1fr auto;display:grid;align-items:center;gap:12px"><span class="cic" style="width:34px;height:34px;border-radius:50%;display:grid;place-items:center;background:var(--sunk);color:var(--gold-tx)">${IC('image')}</span><h2>No scene in this chat yet</h2><button type="button" class="btn sm primary" data-a="sheet" data-v="scene">Set the scene</button></div></section>`;
  }
  const min = v.ui.sceneMin;
  const onlyWho = !priv ? '' : ch.startsWith('grp-') ? `${esc(N.chName(ch, v.role))} scene` : gm ? `Only ${esc(G().P[ch.slice(3)]?.name || 'them')} sees this scene` : 'Your private scene';
  return `<section class="scene${min?' min':''}${past?' past':''}" aria-label="${past ? 'Scene at the time' : 'Scene'}" data-scn="${sc.msg || ''}">
    <div class="art${sc.place?' map':''}" style="${N.sceneArt(sc)}">${N.scenePic(sc)}</div>
    <div class="in">
      ${min ? `<span class="star4"></span>` : `<span class="eyebrow">${STAR.replace('<svg','<svg style="width:11px;height:11px"')}<span>${priv ? onlyWho : 'Scene'}</span>${past ? `<span class="then">· Earlier</span>` : ''}${sc.date?`<span style="color:var(--ink-3);letter-spacing:.1em">· ${esc(sc.date)}</span>`:''}</span>`}
      <h2>${esc(sc.title)}</h2>
      <span class="where">${esc(sc.where||'')}</span>
      ${sc.aspects?.length ? `<div class="icards">${sc.aspects.map((a,i)=>{ const f = N.sceneFreeLeft(sc, i); return `<span class="icard" style="--rot:${i%2?.8:-.9}deg">${a.on?`<span class="k">On ${esc(a.on)}</span>`:''}<span>${N.emoText(N.marks(esc(a.t)))}</span>${f?`<span class="fi">${'<i></i>'.repeat(f)}</span>`:''}</span>`; }).join('')}</div>` : ''}
    </div>
    <div class="ctl">${past ? `<button type="button" class="btn sm" data-a="sceneLive" aria-label="Back to the newest messages and the scene now">${IC('caret')}<span>Now</span></button>` : gm ? `<button type="button" class="btn sm" data-a="sheet" data-v="scene">${IC('image')}<span class="only-dt">Edit scene</span><span class="only-ph">Scene</span></button>` : ''}<button type="button" class="btn sm" data-a="sceneMin" aria-label="${min?'Show the scene':'Shrink the scene'}" style="padding:0 9px">${IC(min?'caret':'caret').replace('<svg', `<svg style="rotate:${min?0:180}deg"`)}</button></div>
  </section>`;
}
/* fight rolls, fight results and table notices; on a computer they live in the side panel's Recent actions instead of the chat */
function isAction(m){
  return m.kind === 'sys' && !m.sceneEnd && !m.shop && !m.buy && !m.haggle && !m.purse && !m.craft || m.kind === 'fight' || m.kind === 'combat' || m.kind === 'roll';
}
/* the part of the actions that belongs to a fight: fight rolls, results, and the fight's own notices */
function isFightAct(m){
  return !!m.fc || (m.kind === 'roll' && !!(m.roll.fight || m.roll.target || m.roll.action === 'Attack' || m.roll.action === 'Defend')) || (m.kind === 'sys' && !!(m.res || m.fight))
    || (m.t < FLAGS_T && (m.kind === 'roll' || (m.kind === 'sys' && !m.fightEnd && !m.act && !TABLE_NOTE.test(m.text || ''))) && inOldFight(m));
}
/* rolls and notices saved before fights marked their own messages (31 Oct 2026) carry no mark: one that falls between a fight's
   start card and its end note belongs to that fight, except the table notes the GM makes anyway (stress, fate points, inventory).
   FLAGS_T is when that marking went live (PR #37 merged 01:27 UTC); anything newer is judged by its own marks only */
const FLAGS_T = Date.UTC(2026, 9, 31, 1, 28), TABLE_NOTE = /stress box\.$|fate point|inventory|The party heads|character card/;
let OLDW = {key:'', w:{}};
function inOldFight(m){
  const ms = G().msgs, key = ms.length + ':' + (ms[ms.length - 1] || {}).id;
  if (OLDW.key !== key) {
    const w = {}, open = {};
    for (const x of ms) {
      if (x.t >= FLAGS_T) break;
      if (x.kind === 'combat' || x.kind === 'fight') { if (open[x.ch]) open[x.ch][1] = x.t; open[x.ch] = [x.t, Infinity]; (w[x.ch] = w[x.ch] || []).push(open[x.ch]); }
      else if (open[x.ch] && x.kind === 'sys' && (x.fightEnd || /^The fight on .* is over/.test(x.text || ''))) { open[x.ch][1] = x.t; open[x.ch] = null; }
    }
    OLDW = {key, w};
  }
  return (OLDW.w[m.ch] || []).some(([a, b]) => m.t > a && m.t < b);
}
/* on desktop the actions always live in Recent actions, folded or not; they never spill into the chat */
const actionsOut = (v, side) => !side && v.dev === 'desktop' && v.ui.tab === 'chat' && railShown(v);
N.isAction = isAction; N.isFightAct = isFightAct; N.hhmm = hhmm; N.timeTag = timeTag; N.dayName = dayName;
/* how many of a chat's newest messages are drawn; "Show earlier messages" adds more */
N.MSGWIN = 150;
N.msgWin = v => (v.ui.more || {})[v.ui.ch] || N.MSGWIN;
function renderMsgs(v, side){
  const g = G(), out1 = actionsOut(v, side), ms = g.msgs.filter(m => m.ch === v.ui.ch && !(m.kind === 'scene' && (m.quiet || !m.scene)) && !m.fc && !(out1 && isAction(m)) && !(v.dev === 'phone' && isFightAct(m)));
  if (!ms.length) return `<div class="quiet"><div class="art"></div><p>${v.ui.ch.startsWith('dm-') ? 'Nothing here yet. Anything said here stays between you two.' : v.ui.ch.startsWith('grp-') ? 'Nothing here yet. Only the people in this group see what’s said here.' : 'Nothing here yet.'}</p></div>`;
  let out = '', prev = null, firstNarr = true;
  /* only the newest roll in a chat starts open; a roll someone opened or closed by hand stays that way */
  v._lastRoll = (ms.findLast(m => m.kind === 'roll') || {}).id;
  const seen = (g.seen[v.role] || {})[v.ui.ch] || 0; let divDone = false;
  /* a long chat draws only its newest messages (drawing hundreds made every start and every new line slow); older ones on request */
  const cut = Math.max(0, ms.length - N.msgWin(v));
  if (cut) out += `<button type="button" class="more-msgs" data-a="moreMsgs">Show earlier messages <small>(${cut})</small></button>`;
  for (const [i, m] of ms.entries()) {
    if (i < cut) { if (m.kind === 'rp' && m.by === 'gm' && m.as === 'Narrator' && !m.day) firstNarr = false; if (m.kind === 'scene') firstNarr = true; prev = m; continue; }
    /* a new real-world day (and the first message drawn) gets a date line, and starts a fresh speaker group */
    const newDay = m.t && (i === cut || !prev || !prev.t || dayKey(prev.t) !== dayKey(m.t));
    if (newDay) out += `<div class="day-div date-div" role="separator"><span title="${esc(fullDate(m.t))}">${esc(dayName(m.t))}</span></div>`;
    if (!divDone && m.by !== v.role && m.t > seen && seen > 0 && v.ui.showNew) { out += `<div class="day-div" style="color:var(--ember)">New</div>`; divDone = true; }
    const h = rMsg(v, m, m.re || newDay ? null : prev, firstNarr);
    out += h ? msgWrap(v, m, h) : h;
    if (m.kind === 'rp' && m.by === 'gm' && m.as === 'Narrator' && !m.day) firstNarr = false;
    if (m.kind === 'scene') firstNarr = true;
    prev = m;
  }
  return out;
}
/* Everyone can react to a message or reply to it: long-press on a phone, the buttons beside it on a computer.
   The GM can also edit or delete any message from the same menu. */
function msgWrap(v, m, h){
  const social = N.msgSocial(m), gm = isGM(v);
  if (!social && !gm) return h;
  const narr = m.kind === 'rp' && !!N.speakerObj(m).narr, mine = isMe(v, m) && !narr;
  const tools = `<span class="mtools">${social ? `<button type="button" data-a="msgMenu" data-v="${m.id}" data-emo="1" aria-label="React" title="React">${IC('smile')}</button><button type="button" data-a="reply" data-v="${m.id}" aria-label="Reply" title="Reply">${IC('reply')}</button>` : ''}${gm || N.canEdit(v, m) ? `<button type="button" class="mdots" data-a="msgMenu" data-v="${m.id}" aria-label="${gm ? 'Edit or delete this message' : 'Edit this message'}" title="More">${IC('dots')}</button>` : ''}</span>`;
  /* the hover buttons sit beside the message itself where there is one, otherwise at the row's corner */
  const rx = social ? rxPill(v, m) : '', ins = (s, at, x) => s.slice(0, at) + x + s.slice(at);
  let inner;
  const at = h.indexOf('<div class="body">');
  if (at >= 0) inner = ins(h, at + 18, tools + rx);
  /* narrator text: the buttons follow the "Narrator" line, so they sit by the words, not at the column's far edge */
  else if (h.startsWith('<div class="narr')) { const w = h.indexOf('</div>', h.indexOf('<div class="who">')); inner = ins(ins(h, h.indexOf('>') + 1, rx), w + rx.length, tools); }
  /* a result card: the buttons sit just outside its right edge */
  else if (h.startsWith('<div class="resm')) inner = ins(h, h.indexOf('>') + 1, tools + rx);
  else inner = `<div class="mwb">${h}${tools}${rx}</div>`;
  return `<div class="mw${mine ? ' mine' : ''}${narr ? ' nw' : ''}${rx ? ' hasrx' : ''}${v.ui.pop?.mid === m.id || v.ui.reply === m.id ? ' on' : ''}" data-mid="${m.id}">${m.re ? replyQuote(v, m.re) : ''}${inner}</div>`;
}
/* the line above a reply that shows what it answers; tapping it jumps to that message */
function replyQuote(v, id){
  const o = G().msgs.find(x => x.id === id);
  if (!o) return `<div class="rq gone">${IC('reply')}<span>The message this answers was deleted</span></div>`;
  return `<button type="button" class="rq" data-a="jumpMsg" data-v="${o.id}">${IC('reply')}<b style="--who:${N.msgColor(o)}">${esc(N.msgWho(o))}</b><span>${N.emoText(esc(N.plainText(N.msgSnip(o))))}</span></button>`;
}
/* reactions: a little bubble on the message's inner bottom corner (the most used emoji and a count).
   Tapping it opens the message menu, where your own reactions are lit and can be taken back.
   It pops in only when the reactions changed, not on every redraw. */
function rxPill(v, m){
  const by = {}, order = [];
  for (const [who, list] of Object.entries(m.rx || {})) for (const e of list || []) { if (!by[e]) { by[e] = []; order.push(e); } by[e].push(who); }
  order.sort((a, b) => by[b].length - by[a].length);
  const sig = order.map(e => e + by[e].length).join(','), seen = v._rxSig || (v._rxSig = new Map()), fresh = seen.has(m.id) && seen.get(m.id) !== sig;
  seen.set(m.id, sig);
  if (!order.length) return '';
  const n = order.reduce((s, e) => s + by[e].length, 0), me = order.some(e => by[e].includes(v.role));
  const who = order.map(e => `${e} ${by[e].map(x => N.personObj(x).name).join(', ')}`).join(' · ');
  return `<button type="button" class="rxp${me ? ' me' : ''}${fresh ? ' rxnew' : ''}" data-a="msgMenu" data-v="${m.id}" title="${esc(who)}" aria-label="Reactions: ${esc(who)}">${order.slice(0, 3).map(e => `<span>${N.emj(e)}</span>`).join('')}${n > 1 ? `<b>${n}</b>` : ''}</button>`;
}
function rMsg(v, m, prev, firstNarr){
  const g = G(), mine = isMe(v, m), time = timeTag(m.t), txt = N.emoText(fmt(m.text)) + (m.ed ? ' <span class="ed">edited</span>' : '');
  if (m.kind === 'dev') return `<div class="dev-note"><div class="dev-note-label">Dev Note ${time}</div><div class="dev-note-body">${txt}</div></div>`;
  /* a store opening or closing is a line in the chat like a scene, with Browse while that store is still open */
  if (m.kind === 'sys' && m.shop) { const live = N.shopOpen(m.ch), on = m.shop === 'open' && live && live.id === m.shopId;
    return `<div class="scenem shopm${m.shop === 'end' ? ' end' : ''}"><span class="th">${IC('coins')}</span><span><span>${m.shop === 'open' ? 'Store open' : 'Shopping over'}</span><b>${esc(m.shopName || 'The store')}</b></span>${on ? `<button type="button" class="btn sm gold" data-a="sheet" data-v="store" data-c="${esc(m.ch)}">Browse</button>` : ''}</div>`; }
  /* a store request (Jake): Purchase waits for the GM's Confirm, Bargain asks the GM for a roll */
  if (m.kind === 'sys' && (m.buy || m.haggle)) { const b = m.buy || m.haggle, gm = isGM(v), ask = b.st === 'ask', buy = !!m.buy;
    const lab = buy ? {ask:'Purchase · waiting for the GM', ok:'Bought', no:'Purchase turned down'}[b.st] : {ask:'Bargain', roll:'Bargain', done:'Bargain'}[b.st];
    const btns = !gm ? '' : buy ? (ask ? `<span class="askb"><button type="button" class="btn sm gold" data-a="buyOk" data-v="${m.id}">${IC('check')}Confirm</button><button type="button" class="btn sm" data-a="buyNo" data-v="${m.id}">Decline</button></span>` : '')
      : b.st !== 'done' ? `<span class="askb"><button type="button" class="btn sm gold" data-a="haggleRoll" data-v="${m.id}">${IC('dice')}Roll</button>${N.shopOpen(m.ch) ? `<button type="button" class="btn sm" data-a="sheet" data-v="shop" data-c="${esc(m.ch)}">${IC('coins')}Prices</button>` : ''}<button type="button" class="btn sm ghost" data-a="buyNo" data-v="${m.id}">Done</button></span>` : '';
    return `<div class="scenem shopm askm ${buy ? 'buy' : 'haggle'} st-${esc(b.st)}"><span class="th">${IC(buy ? (b.st === 'ok' ? 'check' : b.st === 'no' ? 'x' : 'coins') : 'hand')}</span><span class="tx"><span>${lab}</span><b>${esc(b.who)} · ${N.emoText(N.marks(esc(b.name)))}</b><small>${buy && b.st === 'ok' ? 'Paid ' : buy ? '' : 'Price now '}${b.price ? N.goldTxt(b.price) : 'Free'}${buy ? '' : ' · wants to talk it down with a roll'}</small></span>${btns}</div>`; }
  /* a crafting card (Jake): what was used up and what came of it. The GM picks a tie's end here, and is told when an invoke
     or shifts after the roll changed its result */
  if (m.kind === 'sys' && m.craft) { const c = m.craft, gm = isGM(v), r = g.msgs.find(x => x.id === c.roll);
    const lo = r && N.outcome(r.roll), live = lo ? (lo.k === 'fail' ? 'fail' : lo.k === 'tie' ? 'tie' : 'ok') : c.st;
    const lab = {ok:c.style ? 'Crafted with style' : 'Crafted', fail:'Crafting failed', tie:'Crafting · tie', hand:'Crafting · settled by hand'}[c.st] || 'Crafting';
    const used = (c.used || []).map(([n, q, w]) => `${n} ×${q}${w && w !== c.who ? ` (${w})` : ''}`).join(', ');
    const sub = `${c.st === 'ok' ? 'Now in their inventory' : c.st === 'fail' ? 'Nothing made' : c.st === 'tie' ? 'Waiting for the GM' : 'The GM gives what they made'}${used ? ` · Used up: ${esc(used)}` : ' · No ingredients'}`;
    let btns = '';
    if (gm && c.st === 'tie') btns = `<span class="askb"><button type="button" class="btn sm gold" data-a="craftTie" data-m="${m.id}" data-v="ok">${IC('check')}Success</button><button type="button" class="btn sm" data-a="craftTie" data-m="${m.id}" data-v="fail">Failure</button><button type="button" class="btn sm" data-a="craftTie" data-m="${m.id}" data-v="hand">${IC('hand')}Settle by hand</button></span>`;
    else if (gm && !c.pick && live !== c.st) btns = `<span class="askb"><span class="craft-gm">The roll is now ${{ok:'a success', fail:'a failure', tie:'a tie'}[live]}.</span><button type="button" class="btn sm gold" data-a="craftRe" data-m="${m.id}">${IC('swap')}Update</button></span>`;
    const note = gm && c.st === 'ok' && c.style ? `<span class="craft-gm">${IC('lock')}Either grant additional products, or return some consumed ingredients.</span>`
      : gm && c.st === 'hand' ? `<span class="craft-gm">${IC('lock')}Give ${esc(c.who)} what they made from the Item catalog or their inventory.<button type="button" class="btn sm" data-a="sheet" data-v="items">${IC('items')}Item catalog</button></span>` : '';
    return `<div class="scenem shopm askm craftm st-${esc(c.st === 'ok' ? 'ok' : c.st === 'fail' ? 'no' : c.st)}"><span class="th">${IC(c.st === 'ok' ? 'check' : c.st === 'fail' ? 'x' : 'gear')}</span><span class="tx"><span>${lab}</span><b>${esc(c.who)} · ${N.emoText(N.marks(esc(c.name)))} ×${c.q}</b><small>${sub}</small></span>${btns}${note}</div>`; }
  if (m.kind === 'sys' && m.purse) return `<div class="sysm purse">${IC(m.purse.k === 'fp' ? 'star' : 'coins')}<span>${esc(m.text)}</span></div>`;
  if (m.kind === 'sys' && m.sceneEnd) return `<div class="scenem end"><span class="th">${IC('stop')}</span><span><span>Scene ended</span><b>${esc(m.sceneTitle || (m.text || '').replace(/^Scene ended:? ?|\.$/g, '') || 'The scene')}</b></span></div>`;
  if (m.kind === 'sys') return m.res ? resCard(m.res, v) : m.fightEnd ? `<button type="button" class="sysm fend" data-a="sheet" data-v="fightRec" data-c="${m.fightEnd}">${IC('swords')}<span>${esc(m.text)}</span><b>See what happened</b></button>` : `<div class="sysm">${IC('sparkle')}<span>${esc(m.text)}</span></div>`;
  if (m.kind === 'scene') { const sc = m.scene; if (!sc) return ''; return `<div class="scenem" data-scn="${m.id}"><span class="th" style="${N.sceneArt(sc)}">${N.scenePic(sc)}</span><span><span>New scene</span><b>${esc(sc.title)}</b></span></div>`; }
  if (m.kind === 'note') return `<div class="m mine gmv"><div class="body"><div class="who" style="--who:var(--ink-3)">${IC('lock').replace('<svg','<svg style="width:12px;height:12px"')}Note to self ${time}</div><div class="bub" style="background:var(--raise);color:var(--ink);box-shadow:inset 0 0 0 1px var(--line-2)">${txt}</div></div></div>`;
  if (m.kind === 'fight' || m.kind === 'combat') return fightCard(v, m);
  if (m.kind === 'news') return `<div class="fightcard" style="box-shadow:0 0 0 1px color-mix(in srgb,var(--gold) 45%,transparent),0 18px 40px -18px rgba(0,0,0,.9)"><div class="in" style="padding-top:18px;grid-template-columns:auto 1fr;align-items:center"><div class="herald" style="all:unset;display:contents"><span class="np" style="width:54px;height:66px;border-radius:4px;background:#efe6cc;rotate:-4deg;display:grid;place-items:center;font:400 12px/1 var(--f-mast);color:#2a2418;box-shadow:0 6px 14px -6px rgba(0,0,0,.7)">News</span></div><div style="display:grid;gap:6px"><span class="eyebrow" style="color:var(--gold-tx)">${IC('newsL')}New edition</span><h3 style="font-size:18px">${esc(m.text)}</h3><div class="row"><button type="button" class="btn sm gold" data-a="readNews" data-id="${esc(m.nid||'')}">Read it</button></div></div></div></div>`;
  if (m.kind === 'roll' && v.dev === 'phone') { const rn = rnoteRow(v, m); return rn ? `<div class="rlwrap">${rollLine(v, m)}<div class="rlnote">${rn}</div></div>` : rollLine(v, m); }
  if (m.kind === 'roll') {
    const pc = (m.roll.whoKey || '').startsWith('pc:') && g.chars[m.roll.whoKey.slice(3)];
    const s = pc ? {name:pc.short, portrait:pc.built ? pc.portrait : null, color:pc.color} : m.by === 'gm' ? {name:m.roll.who, color:'var(--c-npc)', portrait:m.pt || N.npcByName(m.roll.who.replace(/ \d+$/,''))?.portrait} : N.speakerObj({by:m.by, as:''});
    return `<div class="m rollm${mine?' mine':''}">${N.av(s,32)}<div class="body"><div class="who" style="--who:${s.color}">${esc(m.roll.who)}${m.ch==='gm'?'<span class="tag gold">Secret</span>':''}${time}</div>${rRoll(v, m)}</div></div>`;
  }
  const cont = prev && prev.by === m.by && prev.kind === m.kind && (prev.as||'') === (m.as||'') && m.t - prev.t < 180000 && m.kind !== 'scene';
  if (m.kind === 'gif') {
    const p = metaObj(m), gf = m.gif || {}, src = N.gifSrc(gf.u);
    /* GIFs are always table talk: posted as the person, never as a character */
    return `<div class="m ooc gifm${mine?' mine':''}">${N.av(p,32)}<div class="body"><div class="who" style="--who:var(--ink-3)">${esc(p.name)}<span class="tag">Meta</span> ${time}</div>${N.gifBad.has(src) ? `<div class="gifbox gifbad">${IC('image')}<span>This GIF didn’t load</span>${N.gifLinkOk(gf.u) ? `<a href="${esc(gf.u)}" target="_blank" rel="noopener noreferrer">Open link</a>` : ''}</div>` : `<div class="gifbox"><img class="gif" src="${esc(src)}" alt="GIF" loading="lazy" ${gf.w && gf.h ? `style="aspect-ratio:${+gf.w}/${+gf.h}"` : ''}></div>`}</div></div>`;
  }
  if (m.kind === 'pic') {
    const p = metaObj(m), pc = m.pic || {};
    /* a picture someone sent: tap it to see it big */
    return `<div class="m ooc gifm picm${mine?' mine':''}">${N.av(p,32)}<div class="body"><div class="who" style="--who:var(--ink-3)">${esc(p.name)}<span class="tag">Meta</span> ${time}</div><button type="button" class="gifbox" data-a="picView" data-v="${m.id}" aria-label="Open the picture"><img class="gif" src="${esc(N.show(pc.u))}" alt="${esc(m.text || 'Picture')}" loading="lazy" ${pc.w && pc.h ? `style="aspect-ratio:${+pc.w}/${+pc.h}"` : ''}></button>${m.text ? `<div class="bub">${N.emoText(fmt(m.text))}${m.ed ? ' <span class="ed">edited</span>' : ''}</div>` : ''}</div></div>`;
  }
  if (m.kind === 'ooc' || m.kind === 'meta' || N.metaRp(m)) {
    const p = metaObj(m);
    const big = N.emojiOnly(m.text);
    return `<div class="m ${big ? 'emom' : 'ooc'}${mine?' mine':''}${cont?' cont':''}">${N.av(p,32)}<div class="body">${cont?'':`<div class="who" style="--who:var(--ink-3)">${esc(p.name)} ${time}</div>`}<div class="${big ? 'bigemo' : 'bub'}">${txt}</div></div></div>`;
  }
  const s = N.speakerObj(m);
  if (s.narr && m.day) return `<div class="narr dayl"><div class="who">${IC('sun')}Narrator<span class="tag gold">Next day</span> ${time}</div><p>${txt}</p></div>`;
  if (s.narr) return `<div class="narr${firstNarr?' first':''}"><div class="who">${STAR.replace('<svg','<svg style="width:11px;height:11px"')}Narrator ${time}</div><p>${txt}</p></div>`;
  const gmv = mine && isGM(v) ? ' gmv' : '';
  return `<div class="m say${s.npc?' npc':''}${mine?' mine':''}${gmv}${cont?' cont':''}" style="--spk:${s.color}">${N.av(s,32)}<div class="body">${cont?'':`<div class="who" style="--who:${s.color}">${esc(s.name)}${s.npc?'<span class="tag">NPC</span>':''} ${time}</div>`}<div class="bub">${N.emoText(sayFmt(m.text)) + (m.ed ? ' <span class="ed">edited</span>' : '')}</div></div></div>`;
}
/* roleplay lines: words "in quotes" are spoken and read normally, everything else is description in the story font */
const QUOTE = /"[^"]*(?:"|$)|“[^”]*(?:”|$)/g;
function sayFmt(t){
  /* lists first, then inside each part: words in quotes are speech, the rest is action */
  /* **bold** can wrap speech ("**"Now."**"), so it is marked before the split and reopened in each piece it spans */
  return N.blocks(t, s => {
    let bold = false;
    const piece = x => { const pre = bold ? '<strong>' : ''; const h = N.inl(x).replace(/\u0001/g, () => (bold = !bold) ? '<strong>' : '</strong>'); return pre + h + (bold ? '</strong>' : ''); };
    const act = x => x.trim() ? `<span class="rpd">${piece(x)}</span>` : piece(x);
    s = s.replace(/\*\*([^*\n]+)\*\*/g, '\u0001$1\u0001');
    let out = '', at = 0;
    for (const q of s.matchAll(QUOTE)) { out += act(s.slice(at, q.index)) + piece(q[0]); at = q.index + q[0].length; }
    return out + act(s.slice(at));
  });
}
/* phones: a roll in the roleplay chat is one small line; tapping it opens the full card */
/* a roleplay roll the GM made against an NPC card and/or a skill: "against Brannoc (Will)" */
/* a custom fight event: what was happening, as the GM wrote it */
const evText = r => typeof r.event === 'string' ? r.event : '';
N.evText = evText;
const vsLabel = r => r.vs ? ` against ${r.vs.name ? `<b>${esc(r.vs.name)}</b>${r.vs.skill ? ` (${esc(r.vs.skill)})` : ''}` : `<b>${esc(r.vs.skill)}</b>`}` : '';
function rollLine(v, m){
  const r = m.roll, tot = rollTotal(r), o = outcome(r), seen = r.skill === 'Bonus' || skSeen(v, r.skill, r.whoKey, r.who), fx = v._rfx && v._rfx.id === m.id && Date.now() - v._rfx.at < RFX_MS;
  return `<button type="button" class="rl${fx ? ' fx' : ''}" ${fx ? `style="--el:-${Date.now() - v._rfx.at}ms"` : ''} data-a="sheet" data-v="rollCard" data-c="${m.id}" aria-label="${esc(r.who)} rolled ${sgn(tot)}. Open the roll">
    ${seen ? `<span class="rld">${r.dice.map(d => `<i class="${d>0?'p':d<0?'m':'z'}">${d>0?'+':d<0?'−':''}</i>`).join('')}</span>` : ''}<span class="rlt"><b>${esc(r.who)}</b> ${esc(r.skill)} · ${r.event ? 'event' : esc(r.action.toLowerCase())}${r.vs?.name?` vs ${esc(r.vs.name)}`:''}${m.ch==='gm'?' · secret':''}</span><b class="rlv">${sgn(tot)}${r.opp!=null?`<small>vs</small>${sgn(r.opp)}`:''}</b>${o ? `<span class="out ${o.k}">${o.t}</span>` : ''}</button>`;
}
/* phones: right after you roll, the dice tumble across the screen, show the total, then shrink into the line in the chat.
   Like the board's dice it keeps its place across redraws (a negative delay), so a new message doesn't restart it. */
const RFX_MS = 2700;
function rollFx(v){
  /* a roll someone else makes in this chat plays here too, once, as it arrives (the newest roll per chat is remembered;
     the first look at a chat only notes it). GM secret rolls never reach players, so only the GM sees those. */
  const ch = v.ui.ch, last = G().msgs.findLast(x => x.ch === ch && x.kind === 'roll' && !isFightAct(x)), seen = v._rl || (v._rl = {});
  if (last && seen[ch] !== last.id) {
    if (ch in seen && (!v._rfx || v._rfx.id !== last.id) && Date.now() - (last.t || 0) < 20000) { v._rfx = {id:last.id, at:Date.now()}; setTimeout(() => N.render(v), RFX_MS + 60); }
    seen[ch] = last.id;
  }
  const f = v._rfx; if (!f || Date.now() - f.at > RFX_MS) return '';
  const m = G().msgs.find(x => x.id === f.id); if (!m || (m.ch !== ch && !f.own)) return '';
  const r = m.roll, tot = rollTotal(r), face = d => d > 0 ? '+' : d < 0 ? '−' : '';
  const cube = (d, i) => `<span class="cube" style="--i:${i}"><i class="f fr ${d>0?'p':d<0?'m':'z'}">${face(d)}</i><i class="f bk">−</i><i class="f rt p">+</i><i class="f lf"></i><i class="f tp m">−</i><i class="f bt p">+</i></span>`;
  return `<div class="rfx" style="--el:-${Date.now() - f.at}ms" aria-hidden="true"><div class="grp">${r.skill === 'Bonus' || skSeen(v, r.skill, r.whoKey, r.who) ? `<div class="rtray">${r.dice.map(cube).join('')}</div>` : ''}<div class="rfx-t"><small>${esc(r.who)} · ${esc(r.skill)}</small><b>${sgn(tot)} <span>${ladderWord(tot)}</span></b></div></div></div>`;
}
N.RFX_MS = RFX_MS;
/* Jake: on rolls, a player sees a character's skill level only when it is their own character or the GM revealed that skill
   to them (Sheet reveals). The total and the result always show. card: the card id behind a roll's roller, or by name */
const cardOfKey = key => { const [k, id] = String(key || '').split(/:(.*)/s);
  if (k === 'pc' || k === 'npc') return id;
  if (k === 'tok') { const t = N.tokById(id); return t && (t.kind === 'pc' || t.kind === 'npc') ? t.ref : null; }
  return null; };
function skSeen(v, skill, key, name){
  if (isGM(v)) return true;
  const g = G(), mine = N.charOf(v.role), base = String(name || '').replace(/ \d+$/, '');
  let id = cardOfKey(key);
  if (!id && name) {
    if (mine && (mine.short === name || mine.name === name)) return true;
    const t = (g.combat?.tokens || []).find(x => N.tokName(x) === name); if (t && (t.kind === 'pc' || t.kind === 'npc')) id = t.ref;
  }
  if (mine && id && id === mine.id) return true;
  const kn = (id && g.known?.[id]) || (!id && name ? Object.values(g.known || {}).find(x => x.name === name || x.name === base) : null);
  return !!(kn && (kn.skills || []).some(([n]) => n === skill));
}
N.skSeen = skSeen;
const skHid = '<span class="skh" title="Not revealed to you">?</span>';
/* Jake: the GM's note on a roll. The GM sees it (and who it's shown to) and can change it; a picked player sees just the words */
function rnoteRow(v, m){
  const g = G();
  if (isGM(v)) { const n = (g.rnotes || {})[m.id]; if (!n || !n.t) return '';
    const who = (n.see || []).map(st => N.personObj(st).name).join(', ');
    return `<button type="button" class="rnote gm" data-a="rnOpen" data-v="${m.id}">${IC('lock')}<span><small>GM note · ${who ? 'shown to ' + esc(who) : 'only you'}</small>${N.emoText(N.marks(esc(n.t)))}</span>${IC('pen')}</button>`; }
  const t = (g.rnMine || {})[m.id]; if (!t) return '';
  return `<div class="rnote">${IC('scroll')}<span><small>Note from ${esc(N.gmName())}</small>${N.emoText(N.marks(esc(t)))}</span></div>`;
}
function rRoll(v, m){
  const r = m.roll, tot = rollTotal(r), o = outcome(r), fold = v.ui.folded.has(m.id) ? v.ui.folded.get(m.id) : m.id !== v._lastRoll;
  const dice = r.dice.map(d => `<span class="die ${d>0?'p':d<0?'m':'z'}">${d>0?'+':d<0?'−':'·'}</span>`).join('');
  const canInv = isGM(v) || (r.whoKey === 'pc:' + (G().P[v.role]||{}).char && m.by === v.role);
  /* GM notes hold secret rolls, unless the fight itself is kept there (then its rolls are the fight's own and can be invoked on) */
  const secret = m.ch === 'gm' && N.fightCh() !== 'gm';
  /* the GM's shifts on the result: roleplay rolls and custom events with a difficulty; an attack's result is changed on its result card */
  const seen = r.skill === 'Bonus' || skSeen(v, r.skill, r.whoKey, r.who), oppSeen = !r.vs?.name || !r.vs.skill || skSeen(v, r.vs.skill, null, r.vs.name);
  const canShift = isGM(v) && r.opp != null && !(isFightAct(m) && (r.target || r.action === 'Attack' || r.action === 'Defend'));
  return `<div class="roll${fold?' folded':''}${secret?' secret':''}">
    <div class="rh"><span class="grow"><b>${esc(r.skill)} ${seen ? sgn(N.skillPart(r)) : skHid}</b>${r.gear?` + ${r.gearL || 'gear'} ${sgn(r.gear)}`:''}${r.dist?` − distance ${r.dist}`:''}${r.mod?` ${r.mod > 0 ? '+ buff' : '− debuff'} ${Math.abs(r.mod)}`:''} · ${esc(r.action)}${r.target?` ${r.action==='Defend'?'against':'on'} <b>${esc(r.target)}</b>`:''}${vsLabel(r)}</span>${r.event ? '<span class="tag gold evtag">Event</span>' : ''}${fold?`<span class="mini-tot">${sgn(tot)}${r.opp!=null?` <small>vs</small> ${sgn(r.opp)}`:''}</span>`:''}<button type="button" class="ibtn sm" data-a="fold" data-id="${m.id}" data-f="${fold?1:''}" aria-label="${fold?'Expand':'Collapse'} roll">${IC('caret').replace('<svg',`<svg style="rotate:${fold?0:180}deg"`)}</button></div>
    ${evText(r) ? `<div class="evt">${IC('magic')}<span>${esc(evText(r))}</span></div>` : ''}
    ${rnoteRow(v, m)}
    <div class="rb">${seen ? `<div class="dice${v.ui.fresh===m.id?' fresh':''}">${dice}</div>` : ''}${r.opp!=null ? `<div class="tot vs"><span class="n"><b>${sgn(tot)}</b><span>${ladderWord(tot)}</span></span><i>vs</i><span class="n opp"><b>${sgn(r.opp)}</b><span>${ladderWord(r.opp)}</span></span></div>` : `<div class="tot"><b>${sgn(tot)}</b><span>${ladderWord(tot)}</span></div>`}</div>
    ${r.oppDice && seen && oppSeen ? `<div class="oppd">${esc(r.vs?.name || 'The other side')} rolled <span class="od">${r.oppDice.map(d => `<span class="${d>0?'op':d<0?'om':'oz'}">${d>0?'+':d<0?'−':''}</span>`).join('')}</span> ${sgn(diceSum({dice:r.oppDice}))} on ${r.vs?.skill ? esc(r.vs.skill) + ' ' : ''}${oppSeen ? sgn(r.oppBase) : skHid}${r.invokes.some(i => i.opp) ? ` + ${2*r.invokes.filter(i => i.opp).length} invoked` : ''} = <b>${sgn(r.opp)}</b></div>` : ''}
    ${r.invokes.length ? `<div class="inv">${r.invokes.map(i => (i.opp ? `+2 to beat from “${esc(i.aspect)}”` : i.reroll ? `Rerolled with “${esc(i.aspect)}” (was ${sgn(i.was ? i.was.reduce((a,b)=>a+b,0) : 0)})` : `+2 from “${esc(i.aspect)}”`) + (i.by ? `, ${esc(i.by)}` : '')).join(' · ')}</div>` : ''}
    <div class="rf">${seen ? `<span class="math">Dice ${sgn(diceSum(r))} · ${esc(r.skill)} ${seen ? sgn(N.skillPart(r)) : skHid}${r.gear?` · ${r.gearL || 'gear'} ${sgn(r.gear)}`:''}${r.dist?` · <span class="dist">distance −${r.dist}</span>`:''}${r.mod?` · <span class="${r.mod > 0 ? 'buf' : 'dist'}">${r.mod > 0 ? 'buff' : 'debuff'} ${sgn(r.mod)}</span>`:''}${N.plusInvokes(r)?` · invokes +${2*N.plusInvokes(r)}`:''}${r.shift?` · <span class="gsh ${r.shift > 0 ? 'buf' : 'dist'}">${esc(N.gmName())} ${sgn(r.shift)} shift${Math.abs(r.shift) === 1 ? '' : 's'}</span>`:''}</span>` : '<span class="math"></span>'}${o?`<span class="out ${o.k}">${o.t}${o.sh?` · ${o.sh>0?'+':'−'}${Math.abs(o.sh)}`:''}</span>`:''}${canShift ? `<button type="button" class="btn sm shbtn" data-a="shifts" data-id="${m.id}" style="--h:28px" title="Add or take away shifts from the result">${IC('swap')}Shifts</button>` : ''}${canInv && !secret ? `<button type="button" class="btn sm" data-a="invoke" data-id="${m.id}" style="--h:28px">${IC('cards')}Invoke</button>` : ''}</div>
  </div>`;
}
/* GM only: the catalog items behind an attack's gear (N.atkItems) with the GM's notes on them. Built when shown,
   never saved into a message, so players' devices never get the notes. '' when nothing is equipped behind it */
function atkNotes(v, t, sk){
  const xs = v && isGM(v) ? N.atkItems(t, sk) : []; if (!xs.length) return '';
  const lock = IC('lock').replace('<svg', '<svg aria-hidden="true"');
  return `<div class="atkgm"><span class="atkgm-h">${lock}${xs.some(x => x.it.gm) ? 'Your gear notes · only you see these' : 'Gear in this attack'}</span>${xs.map(({l, it}) => `<p><b>${N.emoText(N.marks(esc(it.name)))}</b> <small>${l} ${sgn(N.itemRating(it))}</small>${it.gm ? `<span>${N.emoText(N.marks(esc(it.gm)))}</span>` : ''}</p>`).join('')}</div>`;
}
N.atkNotes = atkNotes;
/* the result of a fight step, posted once the dice are in: an attack against a defense, or the turn order */
/* vw: who is looking (for hidden skill levels); v is left out on a past fight's card to hide the GM's buttons */
function resCard(res, v, vw = v){
  if (res.k === 'order' && res.hand) return `<div class="resm"><div class="rs-h">${IC('clock')}<b>Turn order</b><small>Set by ${esc(N.gmName())}</small></div>
    <ol class="rs-rows">${(res.rows||[]).map((x, i) => `<li><span class="nm">${esc(x.n)}</span><b>${i + 1}</b></li>`).join('')}</ol></div>`;
  /* a contest round: everyone's best roll, who won it, and the score after it */
  if (res.k === 'round') return `<div class="resm round ${res.out?.k === 'tie' ? 'tie' : 'miss'}"><div class="rs-h">${IC('flag')}<b>Round ${res.n}</b><small>Contest · first to ${res.goal || 3}</small></div>
    <ul class="rs-rows">${(res.rows||[]).map(x => `<li${x.win ? ' class="win"' : ''}><span class="nm"><small>${esc(x.n)}</small>${esc(x.who)}</span><span class="mt">${esc(x.sk)}</span><b>${sgn(x.tot)}<small>${ladderWord(x.tot)}</small></b></li>`).join('')}</ul>
    <div class="rs-out"><span class="out ${res.out?.k === 'tie' ? 'tie' : 'succ'}">${esc(res.out?.t || '')}</span><span>${esc(res.after || '')}</span></div>
    <div class="rs-score">${(res.score || []).map(x => `<span><b>${x.p}</b>${esc(x.n)}</span>`).join('')}</div></div>`;
  if (res.k === 'order') return `<div class="resm"><div class="rs-h">${IC('clock')}<b>Turn order</b><small>Notice rolls</small></div>
    <ol class="rs-rows">${(res.rows||[]).map(x => `<li><span class="nm">${esc(x.n)}</span><span class="mt">Notice ${!vw || skSeen(vw, 'Notice', null, x.n) ? sgn(x.sk) : skHid} · dice ${sgn((x.d||[]).reduce((a,b)=>a+b,0))}</span><b>${sgn(x.tot)}</b></li>`).join('')}</ol></div>`;
  const row = (x, lab) => `<li><span class="nm"><small>${lab}</small>${esc(x.n)}</span><span class="mt">${esc(x.sk)} ${!vw || skSeen(vw, x.sk, null, x.n) ? sgn(x.b - (x.g||0) + (x.dist||0) - (x.mod||0)) : skHid}${x.g?` · ${x.gl || 'gear'} ${sgn(x.g)}`:''}${x.dist?` · distance −${x.dist}`:''}${x.mod?` · ${x.mod > 0 ? 'buff' : 'debuff'} ${sgn(x.mod)}`:''}</span><b>${sgn(x.tot)}<small>${ladderWord(x.tot)}</small></b></li>`;
  const [a, d] = res.rows || [];
  return `<div class="resm ${res.out?.k||''}"><div class="rs-h">${IC('swords')}<b>${esc(res.title)}</b></div>
    <ul class="rs-rows">${a ? row(a, 'Attack') : ''}${d ? row(d, 'Defense') : ''}</ul>
    ${res.calc ? `<div class="rs-calc">${IC('sword')}${esc(res.calc)}</div>` : ''}
    ${res.k === 'clash' && res.anim?.att && a ? atkNotes(v, N.tokById(res.anim.att), a.sk) : ''}
    <div class="rs-out"><span class="out ${res.out?.k === 'hit' ? 'fail' : res.out?.k === 'tie' ? 'tie' : 'succ'}">${esc(res.out?.t || '')}</span><span>${esc(res.after || '')}</span>${v && isGM(v) && res.rid && N.cbOpen()?.resId === res.rid ? `<button type="button" class="btn sm shbtn" data-a="shifts" data-id="fight" style="--h:28px" title="Add or take away shifts from this result">${IC('swap')}Shifts</button>` : ''}</div></div>`;
}
function fightCard(v, m){
  const g = G(), cb = g.combat, live = cb.state === 'live' && cb.id === m.cid, gm = isGM(v);
  const toks = cb.tokens.filter(t => t.zone);
  const mine = !gm && !!N.myTok(v), K = N.KIND[m.ck || 'fight'];
  return `<div class="fightcard"><div class="art">${(b => N.bgPic(N.imgUrl(b) ? b : N.FIGHTBG))(m.bg || (live ? cb.bg : ''))}</div><div class="in">
    <span class="eyebrow">${IC(K.ic)}${live ? (m.ck ? `A ${K.w} begins` : 'A fight breaks out') : `The ${K.w} is over`}</span>
    <h3>${esc(m.text)}</h3>
    ${live ? `<div class="who">${toks.slice(0,6).map(t => N.av(N.tokObj(t),28)).join('')}<span>${toks.length} in the ${K.w} · ${cb.zones.length} zone${cb.zones.length === 1 ? '' : 's'}</span></div>
    <div class="row">${gm ? `<button type="button" class="btn gold" data-a="openFight">${IC(K.ic)}Open the ${K.w}</button>` : mine ? `<button type="button" class="btn gold" data-a="watch">${IC(K.ic)}Watch the ${K.w}</button>` : `<button type="button" class="btn" data-a="watch">Watch</button>`}</div>` : `<span class="muted" style="font-weight:600">This ${K.w} is over.</span>`}
  </div></div>`;
}
function composer(v){
  const g = G(), gm = isGM(v), meta = N.metaOnly(v.ui.ch), ooc = v.ui.mode === 'ooc' || meta;
  let chip, ph;
  if (ooc) { chip = `<span class="ooc-ic">${IC('chatL')}</span><b>Meta</b>`; ph = 'Rules talk, questions, snacks…'; }
  else if (gm) {
    const n = g.npcs.find(x => x.name === v.ui.voice);
    chip = (v.ui.voice === 'Narrator' ? N.narrAv(30) : N.av({name:v.ui.voice, portrait:n?.portrait, color:'var(--c-npc)'},30)) + `<b class="only-dt">${esc(v.ui.voice)}</b>`;
    ph = v.ui.voice === 'Narrator' ? 'Narrate what happens…' : `As ${v.ui.voice}…`;
  } else {
    const c = N.charOf(v.role);
    chip = N.av({name:c.short, portrait:c.built?c.portrait:null, color:c.color},30) + `<b class="only-dt">${esc(c.short)}</b>`;
    ph = `Speak or act as ${c.short}. *Asterisks* for actions.`;
  }
  if (v.ui.ch === 'gm') { chip = `<span class="ooc-ic">${IC('lock')}</span><b class="only-dt">Note</b>`; ph = 'A note only you can see…'; }
  const re = v.ui.reply && g.msgs.find(x => x.id === v.ui.reply);
  /* a party chat the GM paused: players read along but can't send; the GM sees why it's quiet and can resume */
  const paused = N.chPaused(v.ui.ch), grp = paused && v.ui.ch.slice(4);
  if (paused && !gm) return `<div class="composer paused" role="status">${IC('lock')}<span><b>The GM paused this chat</b><small>You can read along. Sending opens again when they resume it.</small></span></div>`;
  return `${paused ? `<div class="pausebar" role="status">${IC('lock')}<span><b>Chat paused</b><small>Players can read but not send.</small></span><button type="button" class="btn sm gold" data-a="grpPause" data-v="${esc(grp)}">${IC('play')}Resume</button></div>` : ''}<form class="composer${ooc?' ooc':''}" data-f="send" onsubmit="return false">
    ${re ? `<div class="replying">${IC('reply')}<span>Replying to <b>${esc(N.msgWho(re))}</b><small>${N.emoText(esc(N.plainText(N.msgSnip(re))))}</small></span><button type="button" class="ibtn sm" data-a="replyOff" aria-label="Stop replying">${IC('x')}</button></div>` : ''}
    <div class="box">
      ${v.ui.ch === 'gm' || meta ? `<span class="voice"${meta ? ' title="This chat is Meta only: you show by your own name"' : ''}>${chip}</span>` : gm ? `<button type="button" class="voice" data-a="pop" data-v="voice" aria-label="Who you speak as">${chip}${IC('caret','car')}</button>`
        : `<button type="button" class="voice flip" data-a="voice" data-v="__flip" aria-label="${ooc ? 'Speaking Meta (out of character). Tap to speak in character' : 'Speaking in character. Tap to switch to Meta'}" title="Tap to switch">${chip}${IC('swap','car')}</button>`}
      <textarea id="ta-${v.id}" rows="1" data-i="draft" placeholder="${esc(ph)}" aria-label="Message" enterkeyhint="${N.enterSends() ? 'send' : 'enter'}">${esc(v.ui.draft)}</textarea>
      <button type="button" class="emob picb" data-a="picSend" aria-label="Send a picture" title="Send a picture">${IC('image')}</button>
      <button type="button" class="emob" data-a="pop" data-v="emo" aria-label="Emoji" title="Emoji">${IC('smile')}</button>
      ${isGM(v) ? `<button type="button" class="diceb" data-a="roll" aria-label="Roll the dice" title="Roll">${fateDie}</button>` : ''}
      <button type="button" class="sendb" data-a="send" aria-label="Send">${IC('send')}</button>
    </div>
    ${N.enterSends() ? '<div class="nlhint"><b>Enter</b> sends · <b>Shift + Enter</b> for a new line</div>' : ''}
  </form>`;
}

/* ================= side panels ================= */
function gmScreen(v){
  const g = G(), ch = v.ui.ch, here = ch, fights = N.allFights();
  /* one fight per chat: every running fight gets a button, and the open chat can start one if it has none */
  const where = c => c === 'table' ? 'Everyone' : c === 'gm' ? 'GM notes' : c.startsWith('grp-') ? `${N.grpOf(c)?.party ? 'the party' : 'the group chat'} ${esc(N.chName(c,'gm'))}` : `your chat with ${esc(N.chName(c,'gm'))}`;
  const fight = Object.entries(fights).sort(([a],[b]) => (a !== 'table') - (b !== 'table') || a.localeCompare(b)).map(([c, cb]) => {
    const o = N.order(cb), cur = cb.state === 'live' && cb.phase !== 'notice' && o.length ? o[cb.turn % o.length] : null;
    const K = N.kw(cb), k = N.cbKind(cb);
    return `<button type="button" class="bigcta" data-a="openFight" data-v="${c}"><span class="ic">${IC(K.ic)}</span><span><b>${cb.state==='setup'?`${K.W} setup`:(k === 'fight' ? 'Fight on ' : K.W + ': ')+esc(cb.title)}</b><small>In ${where(c)} · ${cb.state==='setup'?(c === 'gm' ? 'Not started yet. Only you see it.' : 'Not started yet. Players can’t see it.'):k === 'challenge' ? 'Working through the rolls' : `${k === 'contest' ? 'Round' : 'Exchange'} ${cb.exchange}${cur && k !== 'challenge' ? ` · ${esc(N.tokName(cur))}’s turn` : ''}`}</small></span></button>`;
  }).join('') + (fights[here] ? '' : N.metaOnly(here) ? `<p class="muted gm-nofight">${IC('swords')}No fights in ${here === 'table' ? 'Everyone' : esc(N.chName(here, 'gm'))}, it’s Meta only. Open a chat that isn’t Meta only to begin one.</p>` : `<button type="button" class="bigcta" data-a="cbBegin"><span class="ic">${IC('swords')}</span><span><b>${Object.keys(fights).length ? 'Begin another fight' : 'Begin a fight'}</b><small>In ${where(here)}. ${here === 'gm' ? 'A fight only you see, even once it starts. Add NPCs on both sides.' : 'Draw zones and add enemies. Players see nothing until you start.'}</small></span></button>
      <div class="kindrow"><button type="button" class="btn sm" data-a="cbBegin" data-k="contest" title="Competing overcome rolls in rounds, with a scoreboard">${IC('flag')}Begin a contest</button><button type="button" class="btn sm" data-a="cbBegin" data-k="challenge" title="Characters work together through two or more skill rolls">${IC('overcome')}Begin a challenge</button></div>`)
    /* a fight only the GM sees: practice runs and fights the players aren't part of */
    + (here === 'gm' || fights.gm ? '' : `<button type="button" class="btn sm ghost block gm-solo" data-a="cbBegin" data-v="gm">${IC('lock')}Begin a fight in GM notes · only you see it</button>`);
  /* storefronts: one per chat, like fights */
  const shopBtns = Object.entries(g.shops || {}).map(([c, s]) => `<button type="button" class="bigcta shopcta" data-a="sheet" data-v="shop" data-c="${esc(c)}"><span class="ic">${IC('coins')}</span><span><b>${s.state === 'setup' ? 'Store setup' + (s.name ? ': ' + esc(s.name) : '') : 'Shopping at ' + esc(s.name || 'the store')}</b><small>In ${where(c)} · ${s.state === 'setup' ? 'Not open yet. Players can’t see it.' : `${s.items.length} item${s.items.length === 1 ? '' : 's'} for sale`}</small></span></button>`).join('')
    + ((g.shops || {})[here] || !N.shopOk(here) ? '' : `<button type="button" class="bigcta shopcta" data-a="shopBegin"><span class="ic">${IC('coins')}</span><span><b>Open a storefront</b><small>In ${where(here)}. Pick who is there and what is for sale. Players see nothing until you open it.</small></span></button>`);
  /* crafting sessions (Jake): one being set up per chat; the GM only, until the roll */
  const craftBtns = Object.entries(g.crafts || {}).map(([c, cr]) => { const it = N.itemById(cr.make); return `<button type="button" class="bigcta shopcta craftcta" data-a="sheet" data-v="craft" data-c="${esc(c)}"><span class="ic">${IC('gear')}</span><span><b>Crafting setup${it ? ': ' + esc(it.name) : ''}</b><small>In ${where(c)} · Not rolled yet. Players can’t see it.</small></span></button>`; }).join('')
    + ((g.crafts || {})[here] || !N.craftOk(here) ? '' : `<button type="button" class="bigcta shopcta craftcta" data-a="craftBegin"><span class="ic">${IC('gear')}</span><span><b>Begin crafting</b><small>In ${where(here)}. Pick who’s involved, the ingredients and what they make, then roll Crafting.</small></span></button>`);
  const pcs = N.pcs(), npc1 = g.npcs[0], waiting = N.MEMBERS.filter(m => m.role === 'pending').length;
  const tiles = [['roll', 'eyeoff', 'Secret roll', 'data-secret="1"'], ['roll', 'dice', 'Roll for an NPC', npc1 ? `data-npc="${npc1.id}"` : ''], ['npcNew', 'npc', 'New NPC', ''],
    ['writeNews', 'newsL', 'Write news', ''], ['wNew', 'quill', 'New wiki entry', ''], ['mapEditGo', 'map', 'Edit the map', ''],
    ['sheet', 'items', 'Item catalog', 'data-v="items"'],
    ['sheet', 'userplus', waiting ? `Players · ${waiting} waiting` : 'Players', 'data-v="players"'], ['sheet', 'export', 'Export the log', 'data-v="export"'], ['sheet', 'smile', 'Emoji and GIFs', 'data-v="emoji"'], ['sheet', 'upload', 'Import lore', 'data-v="import"'], ['sheet', 'trash', 'Wipe a chat', 'data-v="wipe"']];
  const scenes = N.channelsFor('gm').filter(c => c !== 'gm' && g.scenes[c]).length;
  return `<div class="gs">
    ${fight}${shopBtns}${craftBtns}
    <button type="button" class="bigcta scn" data-a="sheet" data-v="scene"><span class="ic">${IC('image')}</span><span><b>Scene changer</b><small>Pick who it’s for, Everyone or one player, then set the picture, name and aspects.${scenes ? ` ${scenes} chat${scenes > 1 ? 's have' : ' has'} a scene now.` : ''}</small></span></button>
    <section class="gs-sec gs-tools"><div class="gs-h"><h3>GM tools</h3></div>
      <div class="tools">${tiles.map(([a, ic, l, x]) => `<button type="button" data-a="${a}" ${x}>${IC(ic)}${l}</button>`).join('')}</div>
    </section>
    <section class="gs-sec"><div class="gs-h"><h3>Party</h3><button type="button" class="btn sm" data-a="tab" data-v="cast">Cast</button></div>
      ${pcs.map(c => c.built ? `<div class="pcrow">${N.av(c,40)}<span><b>${esc(c.short)}</b><small>${N.emoText(N.marks(esc(N.pcTag(c))))}</small></span>
        <span class="coins">${coinsHtml(c, true)}</span>
        <div class="tracks"><span>Phys</span><div class="boxes">${c.stressV.phys.map((x,i)=>`<button type="button" class="sbox${c.stress.phys[i]?' on':''}" data-a="stress" data-c="${c.id}" data-k="phys" data-i="${i}" aria-pressed="${c.stress.phys[i]}">${x}</button>`).join('')}</div>
        <span>Mind</span><div class="boxes">${c.stressV.ment.map((x,i)=>`<button type="button" class="sbox${c.stress.ment[i]?' on':''}" data-a="stress" data-c="${c.id}" data-k="ment" data-i="${i}" aria-pressed="${c.stress.ment[i]}">${x}</button>`).join('')}</div></div></div>`
        : `<div class="pcrow" style="background:transparent;box-shadow:inset 0 0 0 1.5px var(--line-2)">${N.av({name:pn(c),color:c.color},40)}<span><b>${esc(pn(c))}</b><small>No card yet</small></span><button type="button" class="btn sm primary" data-a="pcEdit" data-v="${c.id}">Make card</button></div>`).join('')}
    </section>
    <section class="gs-sec"><div class="gs-h"><h3>Speak as</h3><button type="button" class="btn sm" data-a="castNpcs">NPCs</button></div>
      ${(() => { const vf = N.voicesFor(v.ui.ch === 'gm' ? 'table' : v.ui.ch, v.ui.voice); return `<div class="voices">${['Narrator', ...vf.here].map(n => { const npc = N.npcByName(n); return `<button type="button" data-a="voice" data-v="${esc(n)}" ${v.ui.voice===n&&v.ui.mode==='rp'?'style="background:var(--accent-soft)"':''}>${n==='Narrator'?N.narrAv(30):N.av({name:n,portrait:npc?.portrait,color:'var(--c-npc)'},30)}<span>${esc(n)}<small>${n==='Narrator'?'Story text':esc(N.npcSub(npc))}</small></span>${v.ui.voice===n&&v.ui.mode==='rp'?`<span class="go" style="color:var(--gold-tx)">${IC('check')}</span>`:''}</button>`; }).join('')}</div>${vf.rest.length ? `<p class="muted" style="margin:6px 0 0;font:600 12.5px/1.4 var(--f-ui)">${vf.here.length ? 'Only this scene’s NPCs are listed.' : 'No NPCs picked for this scene.'} The other ${vf.rest.length} are in Speak as under Everyone else.</p>` : ''}`; })()}
    </section>
    ${picShelf(v)}
  </div>`;
}
/* backgrounds the GM uploaded, kept for scenes and fights until deleted */
function picShelf(v){
  const g = G(), cb = g.combat, sel = g.pics.find(p => p.id === v.ui.picSel);
  const acts = sel ? `<div class="pic-acts">${cb.state !== 'off' ? `<button type="button" class="btn sm primary" data-a="picFight" data-v="${sel.id}">${IC('swords')}Use for the fight</button>` : ''}<button type="button" class="btn sm" data-a="picScene" data-v="${sel.id}">${IC('image')}Use as scene</button><button type="button" class="btn sm" data-a="picFrame" data-v="${sel.id}">${IC('fit')}Adjust framing</button><button type="button" class="btn sm danger" data-a="picDel" data-v="${sel.id}">${IC('trash')}Delete</button></div>` : '';
  return `<section class="gs-sec gs-pics"><div class="gs-h"><h3>Your pictures</h3>${g.pics.length ? `<small class="muted">${g.pics.length}</small>` : ''}</div>
      <p class="muted gs-note">Backgrounds you upload for scenes and fights stay here. Tap one to use it or delete it.</p>
      <div class="thumbs"><button type="button" class="thumb up" data-a="picUpload"><span>${IC('upload')}Upload a picture</span></button>${g.pics.map(p => `<button type="button" class="thumb${sel === p ? ' on' : ''}" data-a="picSel" data-v="${p.id}" aria-pressed="${sel === p}" aria-label="Your picture">${N.bgPic(p.src)}${cb.bg === p.src && cb.state !== 'off' ? '<span><small>In the fight</small></span>' : ''}${sel === p ? `<span class="ck">${IC('check')}</span>` : ''}</button>`).join('')}</div>
      ${acts}
    </section>`;
}
function gmPage(v){
  const ph = v.dev === 'phone', cur = v.ui.ch;
  const chans = N.gmWorkChans();
  const top = ph ? `<div class="top ph">${meBtn(v)}<h1>GM screen</h1></div>` : `<div class="top dt" style="display:flex"><h1>GM screen</h1></div>`;
  const forRow = `<section class="gs-sec gm-for"><div class="gs-h"><h3>Working in</h3></div><div class="seg" role="group" aria-label="Chat">${chans.map(c => `<button type="button" data-a="gmFor" data-v="${c}" aria-pressed="${cur===c}">${c === 'table' ? IC('users') : c === 'gm' ? IC('lock') : ''}${esc(N.chName(c,'gm'))}</button>`).join('')}</div></section>`;
  return `<div class="scroll" data-sk="gmp" style="min-height:0">${top}<div class="gm-page">${gmScreen(v).replace('<div class="gs">', '<div class="gs">' + forRow)}</div></div>`;
}
function coinsHtml(c, edit){
  const n = Math.max(c.fp, c.refresh);
  return Array.from({length:n}, (_,i) => `<span class="coin${i<c.fp?'':' off'}"></span>`).join('') + (edit ? `<span class="mini"><button type="button" data-a="fp" data-c="${c.id}" data-d="-1" aria-label="Take a fate point">−</button><button type="button" data-a="fp" data-c="${c.id}" data-d="1" aria-label="Give a fate point">+</button></span>` : '');
}
/* one consequence slot as a small read-only card: its name when filled, Empty otherwise */
N.cqChip = sl => `<span class="cq${sl.v ? ' full' : ''}"><b>${sl.l}${sl.only ? ` · ${sl.only}` : ''} <i>${sl.lo}–${sl.hi}</i></b>${sl.v ? esc(sl.v) : 'Empty'}${sl.v && sl.st ? N.conTag(sl.st) : ''}</span>`;
/* a filled consequence's state (Active / Stable / Recovering): a small tag everyone sees, and the GM's three buttons.
   own says whose slot it is (data-c a player's card, data-n an NPC card, data-t a nameless fighter) */
N.conTag = st => st ? `<span class="cst-tag st-${st}">${N.conStL(st)}</span>` : '';
N.conStEd = (own, sl, st) => `<div class="cst" role="group" aria-label="State of the ${sl.l.toLowerCase()}${sl.only ? ' ' + sl.only.toLowerCase() : ''} consequence">${N.CON_ST.map(([k, l]) => `<button type="button" class="st-${k}" data-a="conSt" ${own} data-k="${sl.k}" data-v="${k}" aria-pressed="${st === k}">${l}</button>`).join('')}</div>`;
/* Gold: a whole number next to the fate points. The GM types a new amount or steps it with − and +; everyone else only reads it.
   kind 'c' = a player's character (g.chars), 'n' = an NPC card */
function goldHtml(o, kind, edit){
  const n = Math.max(0, parseInt(o.gold, 10) || 0), who = esc(o.short || o.name || 'them');
  return `<div class="goldf"><span class="eyebrow">Gold</span>${edit
    ? `<div class="gold-ed"><button type="button" data-a="gold" data-${kind}="${o.id}" data-d="-1" aria-label="Take 1 gold from ${who}" ${n<1?'disabled':''}>−</button><input class="inp" id="gold-${kind}-${o.id}" data-i="gold" data-${kind}="${o.id}" value="${n}" inputmode="numeric" pattern="[0-9]*" enterkeyhint="done" autocomplete="off" aria-label="Gold for ${who}"><button type="button" data-a="gold" data-${kind}="${o.id}" data-d="1" aria-label="Give ${who} 1 gold">+</button></div>`
    : `<div class="gold-ro"><span class="coin"></span><b>${n.toLocaleString('en-US')}</b></div>`}</div>`;
}
N.goldHtml = goldHtml;
/* the GM's Transfer button next to Gold and Fate points: opens the Transfer sheet with this card as the giver */
N.xferBtn = (kind, id, k) => `<button type="button" class="btn sm ghost xfer-btn" data-a="xfer" data-v="${kind}:${esc(id)}"${k ? ` data-k="${k}"` : ''} title="Give gold or fate points to another character">${IC('swap')}Transfer</button>`;
N.coinsHtml = coinsHtml; N.rRoll = rRoll; N.resCard = resCard;
function heroQuick(v){
  const g = G(), c = N.charOf(v.role);
  if (!c.built) return `<div class="gs"><div class="quiet"><div class="art"></div><p>${esc(N.gmName())} hasn’t made your character card yet. It shows up here as soon as it’s ready.</p></div></div>`;
  const top = Object.entries(c.skills).sort((a,b)=>b[1]-a[1]).slice(0,6);
  return `<div class="gs">
    <div class="hero-top">${N.av(c,58)}<span><b>${esc(c.name)}</b><small>${N.emoText(N.marks(esc(N.pcTag(c))))}</small></span></div>
    <section class="gs-sec"><div class="gs-h"><h3>Fate points</h3><span class="muted" style="font-weight:700;font-size:12px">Refresh ${c.refresh}</span></div><div class="coins">${coinsHtml(c,false)}</div><div class="gs-gold"><span class="coin"></span>Gold <b>${(Math.max(0, parseInt(c.gold, 10) || 0)).toLocaleString('en-US')}</b></div></section>
    <section class="gs-sec"><div class="gs-h"><h3>Aspects</h3></div><div class="icards">${N.pcAspects(c).map((a,i)=>[`Aspect ${i+1}`,a]).map(([k,a],i)=>`<span class="icard" style="--rot:${[-.8,.7,-.4][i%3]}deg"><span class="k">${k}</span><span>${N.emoText(N.marks(esc(a)))}</span></span>`).join('')}</div></section>
    <section class="gs-sec"><div class="gs-h"><h3>Top skills</h3></div><div class="quick-sk">${top.map(([n,x])=>`<span>${esc(n)}<i>${sgn(x)}</i></span>`).join('')}</div></section>
    <section class="gs-sec"><div class="gs-h"><h3>Stress</h3></div>
      <div class="pcrow" style="grid-template-columns:auto 1fr"><div class="tracks" style="grid-column:1/-1"><span>Phys</span><div class="boxes">${c.stressV.phys.map((x,i)=>`<span class="sbox${c.stress.phys[i]?' on':''}">${x}</span>`).join('')}</div><span>Mind</span><div class="boxes">${c.stressV.ment.map((x,i)=>`<span class="sbox${c.stress.ment[i]?' on':''}">${x}</span>`).join('')}</div></div></div>
    </section>
    <section class="gs-sec"><div class="gs-h"><h3>Consequences</h3></div><div class="cq-list">${N.consSlots(c.skills).map(sl => N.cqChip(Object.assign({v:(c.cons || {})[sl.k] || '', st:N.conSt(c, sl.k)}, sl))).join('')}</div></section>
    <button type="button" class="btn block" data-a="tab" data-v="hero">${IC('hero')}Open my full card</button>
  </div>`;
}
N.gmScreen = gmScreen; N.heroQuick = heroQuick; N.meBtn = meBtn; N.sideBtn = sideBtn; N.fightSeg = fightSeg; N.chatView = chatView; N.fightAvail = fightAvail;

/* ================= popovers ================= */
/* GIFs: search GIPHY (once the GM has saved a key) or paste a link to any GIF */
function gifPane(v){
  const ui = v.ui, key = G().gifKey, res = ui.gifRes || [];
  const search = key ? `<div class="pop-find">${IC('search')}<input class="inp" id="gq-${v.id}" data-i="gifQ" placeholder="Search GIFs" value="${esc(ui.gifQ || '')}" autocomplete="off" enterkeyhint="search"></div>
    <div class="gif-grid">${ui.gifErr ? `<p class="muted gif-msg">${esc(ui.gifErr)}</p>` : !res.length ? `<p class="muted gif-msg">${ui.gifBusy ? 'Looking…' : 'Nothing found.'}</p>` : res.map((r, i) => `<button type="button" class="gifb" data-a="gifSend" data-i="${i}" aria-label="${esc(r.t || 'GIF')}"><img src="${esc(r.p)}" alt="" loading="lazy" style="aspect-ratio:${r.w}/${r.h}"></button>`).join('')}</div>
    <p class="gif-by">Powered by GIPHY</p>`
    : `<div class="note" style="margin:4px 2px 8px">${IC('info')}${isGM(v) ? 'GIF search needs a free GIPHY key. Add it in GM tools &gt; Emoji and GIFs.' : `GIF search isn’t switched on yet. ${esc(N.gmName())} can turn it on.`} Pasting a link works already.</div>`;
  return `${search}<div class="gif-link"><input class="inp" id="gl-${v.id}" data-i="gifUrl" placeholder="…or paste a GIF link" value="${esc(ui.gifUrl || '')}" autocomplete="off" inputmode="url"><button type="button" class="btn sm primary" data-a="gifLink" ${N.gifLinkOk(ui.gifUrl) ? '' : 'disabled'}>Send</button></div>`;
}
function emoGrid(v, attrs, mine){
  const cus = G().emoji || [];
  const b = (e, label) => `<button type="button" class="emo${mine.includes(e)?' me':''}" ${attrs(e)} aria-label="${esc(label || e)}">${N.emj(e)}</button>`;
  return `<div class="emo-grid">${cus.length ? `<div class="lbl">Norne</div>${cus.map(x => b(':' + x.n + ':', x.n)).join('')}<div class="lbl">Emoji</div>` : ''}${N.EMO_ALL.map(e => b(e)).join('')}</div>${isGM(v) ? `<button type="button" class="opt" data-a="sheet" data-v="emoji">${IC('plus')}<span>${cus.length ? 'Manage custom emoji' : 'Add custom emoji'}</span></button>` : ''}`;
}
/* how to format text: what you type, and what it looks like */
function fmtGuide(chat){
  const e0 = G().emoji?.[0];
  const rows = N.FMT_GUIDE.filter(r => chat || !r[3]).map(([t, l, ex]) => {
    const look = t === ':name:' ? (e0 ? N.emj(':' + e0.n + ':') + `<small>:${esc(e0.n)}:</small>` : '<small>Your table’s own emoji</small>') : N.blocks(ex || t);
    return `<div class="fg-r"><code>${esc(t)}</code><span class="fg-l">${chat ? l.replace(', chat only', '') : l}</span><span class="fg-x">${look}</span></div>`;
  }).join('');
  /* the GM's narrator can move the scene to a map place */
  const move = chat && G().role === 'gm' ? `<div class="fg-r"><code>{{Little Eundir, Prince City}}</code><span class="fg-l">Narrator only: moves the scene's map location there. Add the city after a comma when two places share a name.</span><span class="fg-x">Little Eundir</span></div>` : '';
  return `<div class="fguide"><p>Type the marks around your words. ${chat ? 'Works in every chat.' : 'Works in wiki entries, the news and character cards.'}</p>${rows}${move}</div>`;
}
function popHtml(v){
  const p = v.ui.pop, g = G();
  const pos = `left:${p.x}px;${p.up ? `bottom:${p.y}px` : `top:${p.y}px`}`;
  if (p.type === 'voice') {
    const gm = isGM(v);
    let opts = '';
    if (gm) {
      /* a chat whose scene names its NPCs lists only them (and the fight's NPCs); everyone else is one tap or a search away */
      const vch = v.ui.ch === 'gm' ? 'table' : v.ui.ch, vf = N.voicesFor(vch, v.ui.voice), vq = (v.ui.voiceQ || '').trim().toLowerCase();
      const all = ['Narrator', ...vf.here, ...(vf.rest || [])];
      const one = n => { const npc = N.npcByName(n); const sel = v.ui.mode==='rp' && v.ui.voice===n; return `<button type="button" class="opt" data-a="voice" data-v="${esc(n)}" aria-selected="${sel}">${n==='Narrator'?N.narrAv(30):N.av({name:n,portrait:npc?.portrait,color:'var(--c-npc)'},30)}<span>${esc(n)}<small>${n==='Narrator'?'Story text, shown as the book':!npc && N.extraByName(vch, n)?'One-off, only in this scene':esc(N.npcSub(npc))}</small></span>${sel?`<span class="ck">${IC('check')}</span>`:''}</button>`; };
      if (all.length > 5) opts += `<div class="pop-find">${IC('search')}<input class="inp" id="vq-${v.id}" data-i="voiceQ" placeholder="Find a voice" value="${esc(v.ui.voiceQ || '')}" autocomplete="off"></div>`;
      if (vq) opts += `<div class="lbl">In character</div>` + all.filter(n => n.toLowerCase().includes(vq)).map(one).join('');
      else if (!vf.rest) opts += `<div class="lbl">In character</div>` + all.map(one).join('');
      else opts += `<div class="lbl">In this scene</div>` + ['Narrator', ...vf.here].map(one).join('')
        + (vf.rest.length ? (v.ui.voiceAll ? `<div class="lbl">Everyone else</div>` + vf.rest.map(one).join('') + `<button type="button" class="opt more" data-a="voiceAll"><span class="av" style="--s:30px;--c:var(--line-3);box-shadow:none;background:var(--sunk);color:var(--ink-3)">${IC('undo').replace('<svg','<svg style="width:15px;height:15px"')}</span><span>Only this scene</span></button>`
          : `<button type="button" class="opt more" data-a="voiceAll"><span class="av" style="--s:30px;--c:var(--line-3);box-shadow:none;background:var(--sunk);color:var(--ink-3)">${IC('users').replace('<svg','<svg style="width:15px;height:15px"')}</span><span>Everyone else<small>${vf.rest.length} more NPC${vf.rest.length > 1 ? 's' : ''} not in this scene</small></span></button>`) : '');
      opts += `<button type="button" class="opt" data-a="newVoice"><span class="av" style="--s:30px;--c:var(--line-3);box-shadow:none;background:var(--sunk);color:var(--ink-3)">${IC('plus').replace('<svg','<svg style="width:15px;height:15px"')}</span><span>New NPC voice</span></button>`;
    } else {
      const c = N.charOf(v.role), sel = v.ui.mode === 'rp';
      opts += `<button type="button" class="opt" data-a="voice" data-v="__me" aria-selected="${sel}">${N.av({name:c.short,portrait:c.built?c.portrait:null,color:c.color},30)}<span>As ${esc(c.short)}<small>In character</small></span>${sel?`<span class="ck">${IC('check')}</span>`:''}</button>`;
    }
    opts += `<div class="sep"></div><button type="button" class="opt" data-a="voice" data-v="__ooc" aria-selected="${v.ui.mode==='ooc'}"><span class="av" style="--s:30px;--c:var(--line-3);box-shadow:none;background:var(--accent-soft);color:var(--ink-2)">${IC('chatL').replace('<svg','<svg style="width:15px;height:15px"')}</span><span>Meta<small>Questions and table talk</small></span>${v.ui.mode==='ooc'?`<span class="ck">${IC('check')}</span>`:''}</button>`;
    return `<div class="pop" style="${pos}" role="listbox" aria-label="Speak as">${opts}</div>`;
  }
  if (p.type === 'msg') {
    const m = g.msgs.find(x => x.id === p.mid); if (!m) return '';
    const social = N.msgSocial(m), mine = (m.rx || {})[v.role] || [];
    const quick = social ? `<div class="emo-quick">${N.EMO_QUICK.map(e => `<button type="button" class="emo${mine.includes(e)?' me':''}" data-a="react" data-id="${m.id}" data-v="${e}" aria-label="React ${e}">${e}</button>`).join('')}<button type="button" class="emo more" data-a="emoMore" aria-label="More emoji" aria-expanded="${!!p.all}">${IC(p.all ? 'minus' : 'plus')}</button></div>${p.all ? emoGrid(v, e => `data-a="react" data-id="${m.id}" data-v="${esc(e)}"`, mine) : ''}` : '';
    const by = {}; for (const [who, l] of Object.entries(m.rx || {})) for (const e of l || []) (by[e] = by[e] || []).push(N.metaOnly(m.ch) ? N.metaName(who) : N.personObj(who).name);
    const whoRx = Object.keys(by).length ? `<div class="rxwho">${Object.entries(by).map(([e, w]) => `<span>${N.emj(e)} ${esc(w.join(', '))}</span>`).join('')}</div>` : '';
    return `<div class="pop msgpop${p.all?' wide':''}" style="${pos}" role="menu" aria-label="Message">${quick}${whoRx}${social ? `<button type="button" class="opt" role="menuitem" data-a="reply" data-v="${m.id}">${IC('reply')}<span>Reply</span></button>` : ''}${N.msgCopyText(m) ? `<button type="button" class="opt" role="menuitem" data-a="copyMsg" data-v="${m.id}">${IC('copy')}<span>${m.kind === 'gif' ? 'Copy GIF link' : 'Copy text'}</span></button>` : ''}${isGM(v) || N.canEdit(v, m) ? `${social ? '<div class="sep"></div>' : ''}${N.canEdit(v, m) ? `<button type="button" class="opt" role="menuitem" data-a="msgEdit" data-v="${m.id}">${IC('pen')}<span>Edit message</span></button>` : ''}${isGM(v) && m.kind === 'roll' ? `<button type="button" class="opt" role="menuitem" data-a="rnOpen" data-v="${m.id}">${IC('lock')}<span>${(g.rnotes || {})[m.id] ? 'Edit GM note' : 'Add GM note'}</span></button>` : ''}${isGM(v) ? `<button type="button" class="opt danger" role="menuitem" data-a="sheet" data-v="msgDel" data-c="${m.id}">${IC('trash')}<span>Delete message</span></button>` : ''}` : ''}</div>`;
  }
  /* the composer's emoji button: puts the emoji into what you're typing */
  if (p.type === 'emo') {
    const gif = v.ui.emoTab === 'gif', aa = v.ui.emoTab === 'fmt';
    const tabs = `<div class="seg emo-tabs" role="tablist"><button type="button" role="tab" data-a="emoTab" data-v="emo" aria-pressed="${!gif && !aa}">${IC('smile')}Emoji</button><button type="button" role="tab" data-a="emoTab" data-v="gif" aria-pressed="${gif}"><b class="gifw">GIF</b>GIFs</button><button type="button" role="tab" data-a="emoTab" data-v="fmt" aria-pressed="${aa}"><b class="gifw aaw">Aa</b>Format</button></div>`;
    return `<div class="pop msgpop wide${gif ? ' gifpop' : ''}" style="${pos}" role="dialog" aria-label="${gif ? 'GIFs' : aa ? 'Formatting' : 'Emoji'}">${tabs}${gif ? gifPane(v) : aa ? fmtGuide(true) : emoGrid(v, e => `data-a="emoIns" data-v="${esc(e)}"`, [])}</div>`;
  }
  /* the formatting guide over a form (wiki, news, cards): no quotes or lists there, those have their own rules */
  if (p.type === 'fmtg') return `<div class="pop msgpop wide" style="${pos}" role="dialog" aria-label="Formatting">${fmtGuide(false)}</div>`;
  /* the emoji button over a form: puts the emoji into the box typed in last */
  if (p.type === 'emof') return `<div class="pop msgpop wide" style="${pos}" role="dialog" aria-label="Emoji">${emoGrid(v, e => `data-a="emoField" data-v="${esc(e)}"`, [])}</div>`;
  /* the GM's Insert link over a form: a character, an NPC or a wiki entry goes in where they were typing (as N.linkTok) */
  if (p.type === 'linkf' || p.type === 'wlAdd') {
    const q = (v.ui.linkQ || '').trim().toLowerCase(), hit = t => !q || String(t || '').toLowerCase().includes(q), cap = q ? 20 : 6;
    const tile = ic => `<span class="av sq" style="--s:36px;box-shadow:none;background:var(--accent-soft);color:var(--gold-tx)">${IC(ic).replace('<svg','<svg style="width:18px;height:18px"')}</span>`;
    const more = (n, l) => n > cap ? `<p class="muted" style="margin:2px 10px 8px;font:600 12.5px/1.4 var(--f-ui)">${n - cap} more ${l}. Type to find them.</p>` : '';
    const ents = g.wiki.filter(e => hit(e.title) || (q && hit(e.cat))), wl = p.type === 'wlAdd' ? (g.wlinks || {})[p.card] || [] : null;
    const went = e => wl ? `<button type="button" class="opt" role="option" data-a="wlTog" data-c="${esc(p.card)}" data-v="${e.id}" aria-selected="${wl.includes(e.id)}">${tile(N.catIcon(e.cat))}<span>${esc(e.title)}<small>${esc(e.cat)}${audTag(e, 'wiki')}</small></span>${wl.includes(e.id) ? `<span class="ck">${IC('check')}</span>` : ''}</button>`
      : `<button type="button" class="opt" data-a="emoField" data-v="${esc(N.linkTok('wiki', e.id, e.title))}">${tile(N.catIcon(e.cat))}<span>${esc(e.title)}<small>${esc(e.cat)}${audTag(e, 'wiki')}</small></span></button>`;
    const wiki = `<div class="lbl">Wiki entries</div>${ents.slice(0, cap).map(went).join('') || `<p class="muted" style="margin:2px 10px 8px;font:600 12.5px/1.4 var(--f-ui)">No entry by that name.</p>`}${more(ents.length, 'entries')}`;
    const find = `<div class="pop-find">${IC('search')}<input class="inp" id="lkq-${v.id}" data-i="linkQ" placeholder="${wl ? 'Find a wiki entry' : 'Find a character or entry'}" value="${esc(v.ui.linkQ || '')}" autocomplete="off" enterkeyhint="search"></div>`;
    if (wl) return `<div class="pop charpop" style="${pos}" role="listbox" aria-label="Link a wiki page">${find}${wiki}</div>`;
    const pcs = N.pcs().filter(c => c.built && hit(c.name + ' ' + c.short)), npcs = g.npcs.filter(n => hit(n.name));
    const crow = (k, c, sub) => `<button type="button" class="opt" data-a="emoField" data-v="${esc(N.linkTok(k, c.id, k === 'pc' ? c.short || c.name : c.name))}">${N.av(k === 'pc' ? c : {name:c.name, portrait:c.portrait, color:'var(--c-npc)'}, 36)}<span>${esc(c.name)}<small>${esc(sub)}</small></span></button>`;
    const people = `${pcs.length ? `<div class="lbl">Characters</div>${pcs.map(c => crow('pc', c, 'Played by ' + (g.P[c.player]?.name || 'a former player'))).join('')}` : ''}<div class="lbl">NPCs</div>${npcs.slice(0, cap).map(n => crow('npc', n, [N.npcSub(n), N.nd.of(n) ? N.nd.name(n.dir) : ''].filter(Boolean).join(' · ') || 'NPC')).join('') || `<p class="muted" style="margin:2px 10px 8px;font:600 12.5px/1.4 var(--f-ui)">No NPC by that name.</p>`}${more(npcs.length, 'NPCs')}`;
    const tip = `<p class="muted" style="margin:2px 10px 6px;font:600 12.5px/1.4 var(--f-ui)">Players can follow it only to what they can see; anyone else reads the plain name.</p>`;
    return `<div class="pop charpop" style="${pos}" role="dialog" aria-label="Insert link">${find}${tip}${v.ui.sheet === 'wEdit' ? people + wiki : wiki + people}</div>`;
  }
  if (p.type === 'paneA' || p.type === 'paneB') {
    /* a side panel's picker: every page it can show; picking the one the other panel shows swaps the two */
    const mode = v._paneMode || 'rp', slot = p.type === 'paneA' ? 0 : 1, picks = panePicks(v, mode);
    const row = ([id, l, ic]) => `<button type="button" class="opt" role="menuitemradio" aria-checked="${picks[slot] === id}" data-a="pane" data-v="${slot}:${id}"><span class="av" style="--s:30px;box-shadow:none;background:var(--accent-soft);color:var(--gold-tx)">${IC(ic).replace('<svg','<svg style="width:16px;height:16px"')}</span><span>${esc(l)}${picks[1 - slot] === id ? `<small>Swaps with the ${slot ? 'top' : 'bottom'} panel</small>` : ''}</span>${picks[slot] === id ? `<span class="ck">${IC('check')}</span>` : ''}</button>`;
    return `<div class="pop pane-pop" style="${pos}" role="menu" aria-label="Show in the ${slot ? 'bottom' : 'top'} panel"><div class="lbl">Show in the ${slot ? 'bottom' : 'top'} panel</div>${paneOpts(v, mode).map(row).join('')}</div>`;
  }
  if (p.type === 'wnew') {
    const row = (a, ic, l, sub, x='') => `<button type="button" class="opt" data-a="${a}" ${x}><span class="av" style="--s:30px;box-shadow:none;background:var(--accent-soft);color:var(--gold-tx)">${IC(ic).replace('<svg','<svg style="width:16px;height:16px"')}</span><span>${l}<small>${sub}</small></span></button>`;
    return `<div class="pop" style="${pos}" role="menu" aria-label="New">${row('wNew', 'quill', 'Wiki entry', 'A person, place or rule')}${row('writeNews', 'newsL', 'News edition', 'Players get a ping')}<div class="sep"></div>${row('sheet', 'gear', 'Categories', 'Rename, reorder, icons', 'data-v="wCats"')}</div>`;
  }
  if (p.type === 'chars') {
    /* the Character tab's dropdown: you, then every revealed character; a search box once the list gets long */
    const list = heroList(v), mine = N.charOf(v.role), q = (v.ui.charQ || '').trim().toLowerCase();
    const selId = v.ui.charSel && g.known?.[v.ui.charSel]?.name ? v.ui.charSel : mine?.id;
    const me = list.filter(c => c.me), others = list.filter(c => !c.me), hit = others.filter(c => !q || c.b.toLowerCase().includes(q));
    const row = c => `<button type="button" class="opt" role="option" data-a="charSel" data-v="${esc(c.id)}" aria-selected="${c.id === selId}">${N.av(c.av, 36)}<span style="min-width:0">${esc(c.me ? c.av.name : c.b)}<small>${c.me ? 'You · ' + c.sm : c.sm}</small></span>${c.id === selId ? `<span class="ck">${IC('check')}</span>` : ''}</button>`;
    const find = others.length > 6 ? `<div class="pop-find">${IC('search')}<input class="inp" id="chq-${v.id}" data-i="charQ" placeholder="Find a character" value="${esc(v.ui.charQ || '')}" autocomplete="off" enterkeyhint="search"></div>` : '';
    return `<div class="pop charpop" style="${pos}" role="listbox" aria-label="Characters">${me.map(row).join('')}${me.length && others.length ? '<div class="sep"></div>' : ''}${others.length ? `<div class="lbl">Characters you know</div>${find}${hit.map(row).join('') || `<p class="muted" style="margin:6px 10px 8px;font:600 13px/1.4 var(--f-ui)">No one by that name.</p>`}` : ''}</div>`;
  }
  if (p.type === 'maps') {
    /* maps sit in folders; the dropdown opens one folder at a time, players only see folders that hold a map they can see */
    const gm = isGM(v), see = m => gm || m.vis !== false, here = N.dirById(v.ui.mapDir) ? v.ui.mapDir : null;
    const dirs = N.dirKids(here).map(d => [d, N.dirCount(d.id, see)]).filter(([, n]) => gm || n);
    const maps = g.maps.filter(m => see(m) && N.mapDirOf(m) === here).map((m, i) => [m, i]).sort((a, b) => N.mapLvlRank(a[0]) - N.mapLvlRank(b[0]) || a[1] - b[1]).map(a => a[0]);
    const tile = (ic, x = '') => `<span class="av sq" style="--s:40px;box-shadow:none;background:var(--accent-soft);color:var(--gold-tx)${x}">${IC(ic).replace('<svg','<svg style="width:20px;height:20px"')}</span>`;
    const up = here ? N.dirById(here).in : null, path = N.dirPath(here);
    const head = here ? `<div class="mdhead"><button type="button" class="opt" data-a="mapDirGo" data-v="${esc(N.dirById(up) ? up : '')}" aria-label="Back to ${esc(N.dirById(up)?.name || 'all maps')}">${IC('left')}<span><small>${esc(['All maps', ...path.slice(0, -1).map(d => d.name)].join(' › '))}</small>${esc(path[path.length - 1].name)}</span></button>${gm ? `<button type="button" class="ibtn sm" data-a="mdOpen" data-v="${esc(here)}" aria-label="Rename, move or delete this folder" title="Folder settings">${IC('pen')}</button>` : ''}</div><div class="sep"></div>` : '';
    const dirRow = ([d, n]) => `<button type="button" class="opt" data-a="mapDirGo" data-v="${esc(d.id)}">${tile('folder')}<span>${esc(d.name)}<small>${n} ${n === 1 ? 'map' : 'maps'}${gm && N.dirKids(d.id).length ? ` · ${N.dirKids(d.id).length} ${N.dirKids(d.id).length === 1 ? 'folder' : 'folders'}` : ''}</small></span><span class="ck" style="color:var(--ink-3)">${IC('right')}</span></button>`;
    const mapRow = m => `<button type="button" class="opt" data-a="mapGo" data-v="${m.id}" aria-selected="${N.curMap(v)===m}"><span class="av sq" style="--s:40px;box-shadow:none;background:${N.mapThumb(m.src)?`url(${N.mapThumb(m.src)}) center/cover`:'var(--sunk)'}"></span><span>${esc(m.name)}${m.def ? ` <span class="tag" style="height:16px" title="Players open the Maps tab here">Default</span>` : ''}<small>${N.mapLvlName(m) ? esc(N.mapLvlName(m)) + ' · ' : ''}${m.pins.filter(p=>p.type!=='party'&&(gm||p.vis)).length} places${gm&&N.audOf(m,'map')!=='*'?' · '+esc(N.audOf(m,'map')==='gm'?'hidden from players':N.audLabel(m,'map')):''}</small></span>${N.curMap(v)===m?`<span class="ck">${IC('check')}</span>`:''}</button>`;
    const empty = !dirs.length && !maps.length ? `<p class="muted" style="margin:6px 10px 8px;font:600 13px/1.4 var(--f-ui)">${gm ? 'This folder is empty. Move a map in from its settings while editing the map.' : 'No maps here yet.'}</p>` : '';
    return `<div class="pop mapspop" style="${pos}" role="listbox" aria-label="Maps">${head}${dirs.map(dirRow).join('')}${maps.map(mapRow).join('')}${empty}
      ${gm?`<div class="sep"></div><button type="button" class="opt" data-a="mdOpen" data-in="${esc(here || '')}">${tile('folder', ';background:transparent;box-shadow:inset 0 0 0 1.5px var(--line-2);color:var(--ink-3)')}<span>New folder${here ? ' here' : ''}</span></button><button type="button" class="opt" data-a="mapUpload"><span class="av sq" style="--s:40px;box-shadow:inset 0 0 0 1.5px var(--line-2);background:transparent;color:var(--ink-3)">${IC('upload').replace('<svg','<svg style="width:18px;height:18px"')}</span><span>Add a map image${here ? ' here' : ''}</span></button>`:''}</div>`;
  }
  return '';
}

/* ================= map ================= */
function mapPage(v){
  const g = G(), gm = isGM(v), m = N.curMap(v);
  if (!m) return `<div class="mapv"><div class="mapov"><div class="row1">${v.dev==='phone' ? meBtn(v) : ''}<span style="flex:1"></span></div></div>
    <div class="quiet" style="position:absolute;inset:0;align-content:center"><div class="art"></div><p>${gm ? 'No maps yet. Import the lore file to add the atlases, or upload a map picture.' : 'No maps yet. The GM hasn’t shared one.'}</p>
    ${gm ? `<div style="display:flex;gap:8px;justify-content:center;flex-wrap:wrap"><button type="button" class="btn primary" data-a="sheet" data-v="import">${IC('upload')}Import lore</button><button type="button" class="btn" data-a="mapUpload">${IC('image')}Upload a map</button></div>` : ''}</div></div>`;
  /* the map with its style's colours painted in (js/mappic.js); until that copy is ready, the picture with a CSS filter */
  const bk = N.mapBaked(m.src, v.style + '/' + v.theme), src = bk || N.imgUrl(m.src);
  const pins = m.pins.filter(p => p.type !== 'party');
  const types = ['all', ...Object.keys(N.PINT).filter(t => t !== 'party' && pins.some(p => p.type === t && (gm || p.vis)))];
  if (!types.includes(v.ui.mapType)) v.ui.mapType = 'all';
  const pin = pins.find(p => p.id === v.ui.pinSel);
  const party = g.party.map === m.id ? g.party : null;
  /* where the scene is: a blinking beacon on each map of the way down (country, city, neighborhood). Tap it for the next map */
  const loc = N.myLoc(gm ? 'gm' : v.role, v.ui.ch), beacons = loc ? N.LOCK.filter(k => loc[k] && loc[k].m === m.id) : [];
  const q = v.ui.mapQ.trim().toLowerCase();
  const match = p => (v.ui.mapType === 'all' || p.type === v.ui.mapType) && (!q || p.label.toLowerCase().includes(q) || (p.sub || '').toLowerCase().includes(q) || (p.note || '').toLowerCase().includes(q));
  return `<div class="mapv" data-map="${m.id}">
    <div class="mapcv" data-mapcv="1"><div class="mapst" style="width:${m.w}px;height:${m.h}px">${src ? `<img${bk ? ' class="baked"' : ''} src="${src}" alt="${esc(m.name)}" width="${m.w}" height="${m.h}" draggable="false">` : ''}
      <div class="pins">${pins.filter(p => (gm || p.vis) && match(p)).map(p => {
        const t = N.PINT[p.type] || N.PINT.note, go = !(gm && v.ui.mapEdit) && N.pinTo(m, p), gm2 = go && g.maps.find(x => x.id === go && (gm || x.vis !== false)), wk = !(gm && v.ui.mapEdit) && N.pinWiki(p, gm); return `<button type="button" class="pin${gm2 || wk?' go':''}${wk?' wk':''}${m.labeled?' dotp':''}${v.ui.pinSel===p.id?' sel':''}${!gm||p.vis?'':N.audOf(p,'pin')==='gm'?' hid':' some'}${p.type==='here'?' here':''}" data-pin="${p.id}" style="left:${p.rx*m.w}px;top:${p.ry*m.h}px;--pc:${t.col}" aria-label="${esc(p.label)}${p.sub ? `, ${esc(p.sub)}` : ''}${gm2 ? `. Open ${esc(gm2.name)}` : ''}${wk ? `. Article: ${esc(wk.title)}` : ''}"${gm2 || wk ? ` title="${gm2 ? `Open ${esc(gm2.name)}` : ''}${gm2 && wk ? ' or read ' : wk ? 'Read ' : ''}${wk ? esc(wk.title) : ''}"` : ''}><span class="pm">${IC(t.ic)}</span><span class="pl${p.sub ? ' two' : ''}"><span class="pw"><span class="plt">${esc(p.label)}</span>${p.sub ? `<small class="psub">${esc(p.sub)}</small>` : ''}</span>${wk ? IC('scroll') : ''}${gm2 ? IC('right') : ''}</span></button>`; }).join('')}
        ${beacons.map(k => { const o = loc[k], next = o.to && g.maps.find(x => x.id === o.to && (gm || x.vis !== false)); return `<button type="button" class="beacon" data-a="locGo" data-v="${k}" style="left:${o.rx*m.w}px;top:${o.ry*m.h}px" aria-label="${gm ? 'The scene is' : 'You are'} in ${esc(o.l)}${next ? `. Open ${esc(next.name)}` : ''}"><span class="bd"></span><span class="bl">${gm ? 'Scene' : 'You'} · ${esc(o.l)}${next ? IC('right') : ''}</span></button>`; }).join('')}
        ${party ? `<button type="button" class="pin party" data-pin="__party" style="left:${party.rx*m.w}px;top:${party.ry*m.h}px" aria-label="The party is here"><span class="pm">${IC('banner')}</span><span class="pl">The party</span></button>` : ''}
      </div></div>${src ? '' : '<div class="maploading">Loading the map…</div>'}</div>
    <div class="mapov">
      <div class="row1">
        ${v.dev==='phone' ? meBtn(v) : ''}
        <button type="button" class="mapsel glass" data-a="pop" data-v="maps"><span class="th" style="${N.mapThumb(m.src) ? `background-image:url(${N.mapThumb(m.src)})` : ''}"></span><span style="min-width:0"><small>${N.mapDirOf(m) ? esc(N.dirName(m.dir)) : 'Map'}${gm && N.audOf(m,'map') !== '*' ? ' · ' + (N.audOf(m,'map') === 'gm' ? 'hidden' : esc(N.audLabel(m,'map'))) : ''}</small><b>${esc(m.name)}</b></span>${IC('caret')}</button>
        <div class="search only-dt" style="width:240px"><svg viewBox="0 0 256 256" fill="currentColor">${(window.ICONS.search||['',''])[1]}</svg><input class="inp glass" id="mapq-${v.id}" data-i="mapQ" placeholder="Find a place" value="${esc(v.ui.mapQ)}" style="border:0"></div>
        <span style="flex:1"></span>
        ${gm ? `<button type="button" class="btn ${v.ui.mapEdit?'primary':'glass'}" data-a="mapEdit">${IC('pen')}<span class="only-dt">${v.ui.mapEdit?'Done editing':'Edit map'}</span><span class="only-ph">${v.ui.mapEdit?'Done':'Edit'}</span></button>` : ''}
      </div>
      <div class="chips" role="group" aria-label="Show">${(() => { const b = v.ui.mapBack || [], up = b.length && g.maps.find(x => x.id === b[b.length - 1]); return up ? `<button type="button" class="cchip mapup" data-a="mapBack" aria-label="Back to ${esc(up.name)}" style="padding:0 12px">${IC('left')}${esc(up.name.replace(/ \(.*\)$/, ''))}</button>` : ''; })()}${types.map(t => `<button type="button" class="cchip" data-a="mapType" data-v="${t}" aria-current="${v.ui.mapType===t}" style="padding:0 12px">${t==='all'?'Everything':IC((N.PINT[t]||N.PINT.note).ic)+esc((N.PINT[t]||N.PINT.note).name)}</button>`).join('')}${loc && !beacons.length ? `<button type="button" class="cchip here" data-a="locHere" style="padding:0 12px"><i class="bdot"></i>${gm ? 'Scene' : 'You’re'} in ${esc(N.locText(loc))}</button>` : ''}${party || !g.party.map ? '' : `<button type="button" class="cchip" data-a="findParty" style="padding:0 12px">${IC('banner')}Find the party</button>`}</div>
      <span></span>
      ${gm && v.ui.mapEdit ? `<div class="mapedit glass"><button type="button" class="btn ${v.ui.addPin?'primary':'ghost'}" data-a="addPin">${IC('pinL')}${v.ui.addPin?'Tap the map…':'Add pin'}</button><button type="button" class="btn ghost" data-a="sheet" data-v="mapSet" data-c="${esc(m.id)}">${IC(N.audOf(m,'map')==='gm'?'eyeoff':'eye')}<span class="only-dt">${esc(N.audOf(m,'map')==='gm'?'Hidden':N.audLabel(m,'map'))}</span><span class="only-ph">Who sees it</span></button><button type="button" class="btn ghost" data-a="sheet" data-v="mapDel" data-c="${esc(m.id)}" aria-label="Delete this map">${IC('trash')}<span class="only-dt">Delete map</span></button><button type="button" class="btn ghost" data-a="mapUpload">${IC('upload')}<span class="only-dt">Upload map</span></button></div>` : '<span></span>'}
    </div>
    ${pin || (v.ui.pinSel === '__party' && party) ? pinCard(v, m, pin) : ''}
  </div>`;
}
const PIN_KINDS = ['here','nation','region','city','town','hood','tavern','shop','temple','landmark','danger','note'];
function pinCard(v, m, p){
  const g = G(), gm = isGM(v);
  if (!p) return `<div class="pincard glass"><div class="hd"><span style="flex:1"><span class="eyebrow">Party</span><b>The party is here</b></span><button type="button" class="ibtn sm" data-a="pinClose" aria-label="Close">${IC('x')}</button></div><p>${gm?'Drag the banner while editing, or use “Move party here” on any place.':`${esc(N.gmName())} moves this banner as you travel.`}</p></div>`;
  const t = N.PINT[p.type]||N.PINT.note, wk = N.pinWiki(p, gm);
  if (gm && v.ui.mapEdit) return `<div class="pincard glass"><div class="hd"><span class="av sq" style="--s:42px;--c:${t.col};box-shadow:none;background:${t.col};color:#1a1208">${IC(t.ic).replace('<svg','<svg style="width:22px;height:22px"')}</span><input class="inp" id="pinl-${v.id}" data-i="pinLabel" value="${esc(p.label)}" aria-label="Place name" style="flex:1"><button type="button" class="ibtn sm" data-a="pinClose" aria-label="Close">${IC('x')}</button></div>
    <input class="inp" id="pins-${v.id}" data-i="pinSub" value="${esc(p.sub||'')}" placeholder="Subheading (optional), shown under the name" aria-label="Subheading" maxlength="60">
    <div class="chips" style="padding:0;flex-wrap:wrap">${PIN_KINDS.map(k => `<button type="button" class="cchip" data-a="pinType" data-v="${k}" aria-current="${p.type===k}" style="padding:0 11px">${IC(N.PINT[k].ic)}${N.pinOne(N.PINT[k])}</button>`).join('')}</div>
    ${(() => { const auto = N.pinAutoTo(m, p), an = auto && g.maps.find(x => x.id === auto)?.name; return `<label class="field pinto"><span>Opens map · for scene locations</span><select class="inp" id="pint-${v.id}" data-i="pinTo"><option value="" ${!p.to ? 'selected' : ''}>${an ? `Same name: ${esc(an)}` : 'No map'}</option>${an ? `<option value="-" ${p.to === '-' ? 'selected' : ''}>No map</option>` : ''}${g.maps.filter(x => x.id !== m.id).map(x => `<option value="${esc(x.id)}" ${p.to === x.id ? 'selected' : ''}>${esc(x.name)}</option>`).join('')}</select></label>`; })()}
    <label class="field pinto"><span>Wiki article · tapping the place opens it</span><select class="inp" id="pinw-${v.id}" data-i="pinWiki"><option value="" ${!p.wiki || !g.wiki.some(e => e.id === p.wiki) ? 'selected' : ''}>No article</option>${N.catNames(g.wiki).map(c => { const es = g.wiki.filter(e => e.cat === c).sort((a, b) => a.title.localeCompare(b.title)); return es.length ? `<optgroup label="${esc(c)}">${es.map(e => `<option value="${esc(e.id)}" ${p.wiki === e.id ? 'selected' : ''}>${esc(e.title)}${N.audOf(e, 'wiki') === 'gm' ? ' (GM only)' : ''}</option>`).join('')}</optgroup>` : ''; }).join('')}</select></label>
    ${(() => { const e = p.wiki && g.wiki.find(x => x.id === p.wiki); if (!e) return ''; const ea = N.audOf(e, 'wiki'), pa = N.audSeats(p, 'pin'), miss = pa.filter(st => !N.audSeats(e, 'wiki').includes(st)); return miss.length ? `<p class="pinwarn">${IC('warn')}${ea === 'gm' ? 'This article is GM only, so players see the place without it.' : `${esc(miss.map(st => N.G.P[st]?.name || st).join(', '))} can't read this article yet, so they get the place without it.`}</p>` : ''; })()}
    <textarea class="inp" id="pinn-${v.id}" data-i="pinNote" rows="2" placeholder="A short note players see" style="min-height:60px">${esc(p.note||'')}</textarea>
    <div class="row">${(() => { const a = N.audOf(p,'pin'); return `<button type="button" class="btn sm ${a==='gm'?'primary':''}" data-a="sheet" data-v="pinSet" data-c="${esc(m.id+'|'+p.id)}">${IC(a==='gm'?'eyeoff':'eye')}${a==='gm'?'Hidden · show it':a==='*'?'Everyone sees it':esc(N.audLabel(p,'pin'))}</button>`; })()}<button type="button" class="btn sm" data-a="pinParty" data-v="${p.id}">${IC('banner')}Move party here</button><span style="flex:1"></span><button type="button" class="btn sm danger" data-a="pinDel" aria-label="Delete this place">${IC('trash')}</button></div>
    <p style="font-size:12px;color:var(--ink-3)">Drag the pin on the map to move it.</p></div>`;
  const to = N.pinTo(m, p), mp = to && g.maps.find(x => x.id === to && (gm || x.vis !== false));
  return `<div class="pincard glass"><div class="hd"><span class="av sq" style="--s:42px;--c:${t.col};box-shadow:none;background:${t.col};color:#1a1208">${IC(t.ic).replace('<svg','<svg style="width:22px;height:22px"')}</span><span style="flex:1;min-width:0"><span class="eyebrow">${esc(N.pinOne(t))}</span><b>${esc(p.label)}</b>${p.sub ? `<span class="pcsub">${esc(p.sub)}</span>` : ''}</span><button type="button" class="ibtn sm" data-a="pinClose" aria-label="Close">${IC('x')}</button></div>
    ${p.note?`<p>${esc(p.note)}</p>`:''}
    ${mp && wk ? `<div class="pinpick"><button type="button" class="btn primary" data-a="pinMap" data-v="${p.id}">${IC('mapL')}<span><small>Open map</small>${esc(mp.name.replace(/ \(.*\)$/, ''))}</span></button><button type="button" class="btn" data-a="wiki" data-v="${wk.id}">${IC('scroll')}<span><small>Open article</small>${esc(wk.title)}</span></button></div>` : ''}
    <div class="row">${wk && !mp?`<button type="button" class="btn sm" data-a="wiki" data-v="${wk.id}">${IC('scroll')}Read ${esc(wk.title)}</button>`:''}${gm?`<button type="button" class="btn sm primary" data-a="pinScene" data-v="${p.id}">${IC('image')}Set as scene</button><button type="button" class="btn sm" data-a="pinParty" data-v="${p.id}">${IC('banner')}Move party here</button>`:''}</div>
    ${gm?`<p style="font-size:12.5px;color:var(--ink-3);display:flex;gap:6px;align-items:center">${(() => { const a = N.audOf(p,'pin'); return `${IC(a==='gm'?'eyeoff':'eye').replace('<svg','<svg style="width:15px;height:15px"')}${a==='*'?'Players can see this place.':a==='gm'?'Hidden from players.':esc(N.audLabel(p,'pin').replace(/^Only /,''))+' can see this place.'}`; })()}</p>`:''}
  </div>`;
}

/* ================= world ================= */
function worldPage(v){
  /* in a desktop side panel (v._pane) the wiki steps through one column like a phone: categories, entries, the entry */
  const g0 = G(), gm = isGM(v), ph = v.dev === 'phone' || v._pane === 'world';
  const g = Object.assign({}, g0, {wiki: g0.wiki.filter(e => gm || !e.gm)});
  const q = v.ui.wikiQ.trim().toLowerCase();
  const hit = e => !q || [e.title, e.summary, ...(e.body||[])].join(' ').toLowerCase().includes(q);
  const index = `<div class="wi scroll" data-sk="wi">
    ${v._pane ? (gm ? `<div class="top ph" style="padding:0;justify-content:flex-end"><button type="button" class="btn sm primary" data-a="pop" data-v="wnew">${IC('plus')}New${IC('caret')}</button></div>` : '') : ph ? `<div class="top ph" style="padding:calc(6px + var(--safe-t,0px)) 0 0">${meBtn(v)}<h1>World</h1>${gm?`<button type="button" class="btn sm primary" data-a="pop" data-v="wnew">${IC('plus')}New${IC('caret')}</button>`:''}</div>` : `<div style="display:flex;align-items:center;gap:10px"><h1 class="ttl" style="flex:1;font-size:26px">World</h1>${gm?`<button type="button" class="btn sm ghost" data-a="sheet" data-v="wCats">${IC('gear')}Categories</button><button type="button" class="btn sm primary spark" data-a="wNew">${IC('plus')}New entry</button>`:''}</div>`}
    <div class="search">${IC('search')}<input class="inp" id="wq-${v.id}" data-i="wikiQ" placeholder="Search ${g.wiki.length} entries" value="${esc(v.ui.wikiQ)}"></div>
    ${q ? `<div class="ents">${g.wiki.filter(hit).slice(0,40).map(e => entBtn(v,e)).join('') || '<p class="muted" style="font-weight:600">Nothing matches.</p>'}</div>`
      : `<div class="cats">${N.catNames(g.wiki).map(c => { const es = g.wiki.filter(e => e.cat === c); if (!es.length) return ''; const open = v.ui.wikiCat === c; return `<button type="button" class="cat" data-a="wCat" data-v="${esc(c)}" aria-current="${open}"><span class="ci">${IC(N.catIcon(c))}</span><b>${esc(c)}</b><span class="n">${es.length}</span>${IC('right','car')}</button>${open && !ph ? `<div class="ents" style="padding:2px 0 8px 8px">${es.map(e => entBtn(v,e)).join('')}</div>` : ''}`; }).join('')}</div>`}
  </div>`;
  const read = v.ui.wikiSel ? articleHtml(v, g.wiki.find(e => e.id === v.ui.wikiSel)) : `<div class="quiet" style="align-self:center"><div class="art" style="width:260px;height:220px"></div><p>Pick a category, or search for a person, place or rule.<br>Everything here comes from Nörne’s lore.</p></div>`;
  if (!ph) return `<div class="world">${index}<div class="scroll" data-sk="wr" style="min-height:0;display:grid">${read}</div></div>`;
  if (v.ui.wikiSel) return `<div class="world"><div class="scroll" data-sk="wr" style="min-height:0;padding-top:var(--safe-t,0px)"><div class="top ph"><button type="button" class="ibtn" data-a="wBack" aria-label="Back">${IC('left')}</button><h1 style="font-size:16px">${esc(g.wiki.find(e=>e.id===v.ui.wikiSel)?.cat||'')}</h1></div>${read}</div></div>`;
  if (v.ui.wikiCat) { const es = g.wiki.filter(e => e.cat === v.ui.wikiCat); return `<div class="world"><div class="wi scroll" data-sk="wc"><div class="top ph" style="padding-left:0;padding-right:0"><button type="button" class="ibtn" data-a="wBack" aria-label="Back">${IC('left')}</button><h1>${esc(v.ui.wikiCat)}</h1><span class="tag">${es.length}</span></div><div class="ents">${es.map(e=>entBtn(v,e)).join('')}</div></div></div>`; }
  return `<div class="world">${index}</div>`;
}
const audTag = (x, kind) => { const a = N.audOf(x, kind); return a === '*' ? '' : a === 'gm' ? ' <span class="tag gold">GM</span>' : ` <span class="tag">${esc(N.audLabel(x, kind).replace(/^Only /, ''))}</span>`; };
function entBtn(v, e){ return `<button type="button" class="ent" data-a="wiki" data-v="${e.id}" aria-current="${v.ui.wikiSel===e.id}"><b>${esc(e.title)}${isGM(v)?audTag(e,'wiki'):''}</b><small>${esc(e.summary)}</small></button>`; }
function links(s){
  const g = G(), gm = g.role === 'gm';
  /* [[Entry]] links, the GM's links to cards and entries (N.xl), and the GM's custom emoji (:name:) */
  return N.emoText(N.marks(N.xl(esc(s))).replace(/\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/g, (m, t, lab) => { const e = g.wiki.find(x => esc(x.title).toLowerCase() === t.toLowerCase() && (gm || !x.gm)); lab = lab || t; return e ? `<a class="wl" data-a="wiki" data-v="${e.id}">${lab}</a>` : lab; }));
}
function block(p){
  const ls = p.split('\n');
  if (ls.length && ls.every(l => l.startsWith('- '))) return `<ul>${ls.map(l => `<li>${links(l.slice(2))}</li>`).join('')}</ul>`;
  if (p.length < 60 && p.endsWith(':') && !p.includes('\n')) return `<h3>${links(p.slice(0,-1))}</h3>`;
  if (ls.length > 1 && ls[0].endsWith(':') && ls.slice(1).every(l => l.startsWith('- '))) return `<h3>${links(ls[0].slice(0,-1))}</h3><ul>${ls.slice(1).map(l => `<li>${links(l.slice(2))}</li>`).join('')}</ul>`;
  return `<p class="b">${links(p)}</p>`;
}
function articleHtml(v, e){
  if (!e) return '';
  const g = G(), gm = isGM(v);
  const needle = '[[' + e.title.toLowerCase() + ']]', needle2 = '[[wiki:' + e.id.toLowerCase() + '|';
  const backs = g.wiki.filter(x => x.id !== e.id && (gm || !x.gm) && (t => t.includes(needle) || t.includes(needle2))([x.summary, ...(x.body||[]), ...(x.info||[]).map(i=>i[1]), ...(x.parts||[]).map(p => p.text)].join(' ').toLowerCase())).slice(0,8);
  return `<article class="article">
    <div style="display:flex;align-items:center;gap:8px"><span class="eyebrow" style="color:var(--gold-tx);flex:1">${IC(N.catIcon(e.cat)).replace('<svg','<svg style="width:14px;height:14px;display:inline;vertical-align:-2px;margin-right:6px"')}${esc(e.cat)}${gm && N.audOf(e,'wiki') !== '*' ? ' · ' + (e.gm ? 'GM only' : esc(N.audLabel(e,'wiki'))) : ''}</span>${gm?`<button type="button" class="btn sm" data-a="wEdit" data-v="${e.id}">${IC('pen')}Edit</button>`:''}</div>
    <h1>${esc(e.title)}</h1>
    ${e.summary ? `<p class="sum">${links(e.summary)}</p>` : ''}
    <div class="rule"><span class="star4"></span></div>
    ${(() => { const ps = N.wikiPics(e); return ps.length ? `<div class="wfigs${ps.length > 1 ? ' many' : ''}">${ps.map(p => `<figure class="wfig">${N.wikiImg(p.src, p.alt || p.cap || e.title)}${p.cap?`<figcaption>${N.emoText(N.marks(esc(p.cap)))}</figcaption>`:''}</figure>`).join('')}</div>` : ''; })()}
    ${e.info?.length ? `<dl class="facts">${e.info.map(([k,x]) => `<dt>${esc(k)}</dt><dd>${links(x)}</dd>`).join('')}</dl>` : ''}
    ${(e.body||[]).map(block).join('')}
    ${e.soon || !(e.body||[]).length ? '<p class="muted" style="font-weight:700;font-size:13px">More coming soon.</p>' : ''}
    ${N.wikiParts(e).map(p => { const to = N.partTo(p), ps = p.imgs || [];
      const tag = to === 'all' ? '' : to === 'gm' ? `<span class="eyebrow">${IC('lock').replace('<svg','<svg style="width:13px;height:13px"')}GM only · players never see this</span>` : `<span class="eyebrow">${IC('eye').replace('<svg','<svg style="width:13px;height:13px"')}${gm ? (p.see?.length ? `Only ${esc(N.namesList(p.see))}` : 'Nobody picked yet') : 'Not every player can read this'}</span>`;
      return `<section class="wsect${to === 'all' ? ' open' : to === 'gm' ? ' gmo' : ''}">${tag}${p.h ? `<h3>${links(p.h)}</h3>` : ''}${ps.length ? `<div class="wfigs${ps.length > 1 ? ' many' : ''}">${ps.map(x => `<figure class="wfig">${N.wikiImg(x.src, x.cap || p.h || e.title)}${x.cap ? `<figcaption>${N.emoText(N.marks(esc(x.cap)))}</figcaption>` : ''}</figure>`).join('')}</div>` : ''}${(p.text || '').split(/\n\s*\n/).map(x => x.trim()).filter(Boolean).map(block).join('')}</section>`; }).join('')}
    ${backs.length ? `<p class="backs"><span class="eyebrow" style="margin-right:8px">Linked from</span>${backs.map(b => `<a class="wl" data-a="wiki" data-v="${b.id}" style="color:var(--link);cursor:pointer">${esc(b.title)}</a>`).join(', ')}</p>` : ''}
    ${e.src ? `<p class="src">From the lore notes: ${esc(e.src)}</p>` : ''}
  </article>`;
}
/* ================= news: every paper the GM runs, each with its issues in order ================= */
const npIcon = name => `<span class="np"><b>${esc(name.length > 12 ? name.split(/\s+/).map(w => w[0]).join('').slice(0, 4) : name)}</b><i></i><i class="s"></i><i></i><i></i><i class="s"></i></span>`;
function newsPage(v){
  const gm = isGM(v), ph = v.dev === 'phone' || v._pane === 'news', papers = N.papers();
  const seen = G().news.seen[v.role] || [], unseen = i => !gm && !seen.includes(i.id);
  const paper = papers.find(p => p.name === v.ui.paper);
  const issueBtn = i => `<button type="button" class="ent" data-a="newsSel" data-v="${i.id}" aria-current="${v.ui.newsSel===i.id}"><b>No. ${esc(i.no || '—')}${i.date ? ` <span class="nd">· ${esc(i.date)}</span>` : ''}${unseen(i) ? ' <span class="tag gold">New</span>' : ''}${gm ? audTag(i, 'news') : ''}</b><small>${N.emoText(N.marks(esc(i.headline)))}</small></button>`;
  const paperBtn = p => { const last = p.issues[p.issues.length - 1], n = p.issues.filter(unseen).length, open = paper === p;
    return `<button type="button" class="herald" data-a="newsPaper" data-v="${esc(p.name)}" aria-current="${open}">${npIcon(p.name)}<span><span class="eyebrow" style="color:var(--gold-tx)">${p.issues.length} ${p.issues.length > 1 ? 'issues' : 'issue'} ${n ? `<span class="tag gold">${n} new</span>` : ''}</span><h3>${esc(p.name)}</h3><small>Latest: No. ${esc(last.no || '—')} · ${N.emoText(N.marks(esc(last.headline)))}</small></span></button>${open && !ph ? `<div class="ents" style="padding:2px 0 8px 8px">${p.issues.map(issueBtn).join('')}</div>` : ''}`; };
  const none = `<div class="quiet"><div class="art" style="width:220px;height:180px"></div><p>${gm ? 'No papers yet. Write the first edition and give the paper a name. Players get a ping.' : `No news yet. ${esc(N.gmName())} publishes papers here.`}</p></div>`;
  const newBtn = gm ? (ph ? `<button type="button" class="btn sm primary" data-a="writeNews">${IC('plus')}New edition</button>` : `<button type="button" class="btn sm primary spark" data-a="writeNews">${IC('pen')}New edition</button>`) : '';
  const index = `<div class="wi scroll" data-sk="ni">
    ${v._pane ? (gm ? `<div class="top ph" style="padding:0;justify-content:flex-end">${newBtn}</div>` : '') : ph ? `<div class="top ph" style="padding:calc(6px + var(--safe-t,0px)) 0 0">${meBtn(v)}<h1>News</h1>${newBtn}</div>` : `<div style="display:flex;align-items:center;gap:10px"><h1 class="ttl" style="flex:1;font-size:26px">News</h1>${newBtn}</div>`}
    ${papers.length ? `<p class="muted" style="margin:0;font:600 13px/1.4 var(--f-ui)">${papers.length > 1 ? `${papers.length} papers. ` : ''}Pick a paper to see its issues, oldest first.</p><div class="papers">${papers.map(paperBtn).join('')}</div>` : none}
  </div>`;
  const issue = paper && paper.issues.find(i => i.id === v.ui.newsSel);
  const read = gm && v.ui.newsEdit ? newsForm(v, papers) : issue ? issuePane(v, paper, issue) : paper ? `<div class="quiet" style="align-self:center"><div class="art" style="width:240px;height:200px"></div><p>Pick an issue of ${esc(paper.name)}.</p></div>` : `<div class="quiet" style="align-self:center"><div class="art" style="width:260px;height:220px"></div><p>${papers.length ? 'Pick a paper to read its issues.' : gm ? 'Write the first edition with “New edition”.' : 'Nothing printed yet.'}</p></div>`;
  if (!ph) return `<div class="world">${index}<div class="scroll" data-sk="nr" style="min-height:0;display:grid">${read}</div></div>`;
  const back = t => `<div class="top ph"><button type="button" class="ibtn" data-a="nBack" aria-label="Back">${IC('left')}</button><h1 style="font-size:16px">${esc(t)}</h1></div>`;
  if (gm && v.ui.newsEdit) return `<div class="world"><div class="scroll" data-sk="nr" style="min-height:0;padding-top:var(--safe-t,0px)">${back(v.ui.newsEdit.edit ? 'Edit issue' : 'New edition')}${read}</div></div>`;
  if (issue) return `<div class="world"><div class="scroll" data-sk="nr" style="min-height:0;padding-top:var(--safe-t,0px)">${back(paper.name)}${read}</div></div>`;
  if (paper) return `<div class="world"><div class="wi scroll" data-sk="np"><div class="top ph" style="padding-left:0;padding-right:0;padding-top:var(--safe-t,0px)"><button type="button" class="ibtn" data-a="nBack" aria-label="Back">${IC('left')}</button><h1>${esc(paper.name)}</h1><span class="tag">${paper.issues.length}</span></div>
    <p class="muted" style="margin:0;font:600 13px/1.4 var(--f-ui)">Oldest first. Tap an issue to read it.</p><div class="ents">${paper.issues.map(issueBtn).join('')}</div>
    ${gm ? `<button type="button" class="btn primary" data-a="writeNews" data-v="${esc(paper.name)}">${IC('pen')}Write the next issue</button>` : ''}</div></div>`;
  return `<div class="world">${index}</div>`;
}
function issuePane(v, paper, issue){
  const gm = isGM(v), at = paper.issues.indexOf(issue), prev = paper.issues[at - 1], next = paper.issues[at + 1];
  const step = (i, dir) => i ? `<button type="button" class="btn sm ghost" data-a="newsSel" data-v="${i.id}">${dir < 0 ? IC('left') : ''}No. ${esc(i.no || '—')}${dir > 0 ? IC('right') : ''}</button>` : '<span></span>';
  return `<div class="article" style="max-width:760px">
    ${gm ? `<div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap"><span class="eyebrow" style="flex:1 1 160px">Who can read No. ${esc(issue.no || '—')}</span><button type="button" class="btn ghost" data-a="sheet" data-v="newsSet" data-c="${esc(issue.id)}">${IC(issue.see?.length?'eyeoff':'users')}${esc(N.audLabel(issue,'news'))}</button><button type="button" class="btn" data-a="newsEditIssue" data-v="${esc(issue.id)}">${IC('pen')}Edit</button><button type="button" class="btn primary" data-a="writeNews" data-v="${esc(paper.name)}">${IC('plus')}Next issue</button></div>` : ''}
    ${paperHtml(issue)}
    ${prev || next ? `<div style="display:flex;justify-content:space-between;gap:8px">${step(prev, -1)}${step(next, 1)}</div>` : ''}
  </div>`;
}
function newsForm(v, papers){
  const d = v.ui.newsEdit, ed = !!d.edit;
  const f = (k, l, ph, rows) => `<label class="field"><span>${l}</span>${rows ? `<textarea class="inp" id="nd-${k}-${v.id}" data-i="news" data-k="${k}" rows="${rows}" placeholder="${esc(ph)}">${esc(d[k])}</textarea>` : `<input class="inp" id="nd-${k}-${v.id}" data-i="news" data-k="${k}" value="${esc(d[k])}" placeholder="${esc(ph)}">`}</label>`;
  /* one picture slot: the lead's (n = -1) or a story's */
  const pic = (n, src, cap) => src
    ? `<div class="wpic"><button type="button" class="wpth" data-a="ndImgFrame" data-n="${n}" aria-label="Adjust framing" title="Adjust framing">${N.wikiImg(src)}<span>${IC('fit')}</span></button><input class="inp" id="nd-cap${n}-${v.id}" data-i="news" data-k="cap" data-n="${n}" value="${esc(cap || '')}" placeholder="Caption (optional)" aria-label="Caption"><button type="button" class="ibtn" data-a="ndImgDel" data-n="${n}" aria-label="Remove this picture">${IC('trash')}</button></div>`
    : `<button type="button" class="btn sm ghost" data-a="ndImgAdd" data-n="${n}" style="justify-self:start">${IC('image')}Add a picture</button>`;
  const story = (st, i) => `<div class="ndst"><div style="display:flex;gap:6px;align-items:center"><span class="eyebrow" style="flex:1">Story ${i + 2}</span><button type="button" class="ibtn sm" data-a="ndStoryDel" data-n="${i}" aria-label="Remove story ${i + 2}" title="Remove this story">${IC('trash')}</button></div>
    <input class="inp" id="nd-stt${i}-${v.id}" data-i="news" data-k="stt" data-n="${i}" value="${esc(st.title)}" placeholder="Title" aria-label="Story ${i + 2} title">
    <textarea class="inp" id="nd-stb${i}-${v.id}" data-i="news" data-k="stb" data-n="${i}" rows="3" placeholder="Text. Leave a blank line between paragraphs." aria-label="Story ${i + 2} text">${esc(st.body)}</textarea>
    ${pic(i, st.img, st.cap)}</div>`;
  return `<div class="article" style="max-width:none;grid-template-columns:1fr;gap:18px">
    ${N.textTools(v)}
    <div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap"><h1 style="font-size:28px;flex:1">${ed ? `Edit No. ${esc(d.no || '—')}` : 'New edition'}</h1><button type="button" class="btn ghost" data-a="newsCancel">Cancel</button><button type="button" class="btn gold" data-a="newsPub">${ed ? IC('check') + 'Save changes' : IC('send') + 'Publish'}</button></div>
    ${ed ? `<div class="note">${IC('info')}Readers see the changes straight away. Nobody gets a new note in chat.</div>` : ''}
    <div style="display:grid;gap:12px;grid-template-columns:repeat(auto-fit,minmax(260px,1fr))">
      <div style="display:grid;gap:12px;align-content:start">
        ${f('paper','Paper name','Name of the paper')}
        ${papers.length && !ed ? `<div><span class="eyebrow" style="display:block;margin-bottom:8px">Or pick one of your papers</span><div class="chips" style="padding:0;flex-wrap:wrap">${papers.map(pp => `<button type="button" class="cchip" data-a="ndPaper" data-v="${esc(pp.name)}" aria-current="${pp.name === N.paperName(d)}" style="padding:0 12px">${esc(pp.name)}</button>`).join('')}</div></div>` : ''}
        <div style="display:grid;gap:12px;grid-template-columns:1fr 1fr">${f('no','Issue number','1')}${f('price','Price','Optional')}</div>
        ${f('date','In-world date','e.g. Restday, the 3rd of High Shine')}
        ${f('headline','Headline','What everyone is talking about')}
        ${f('sub','Under the headline','One line of detail')}
        ${f('lead','Lead story','Leave a blank line between paragraphs.',6)}
        ${pic(-1, d.limg, d.lcap)}
        ${d.stories.map(story).join('')}
        <button type="button" class="btn" data-a="ndStoryAdd" style="justify-self:start">${IC('plus')}Add a story</button>
        ${f('notices','Notices, one per line','Wanted posters, ads, announcements…',3)}
        ${ed ? '' : `<div><span class="eyebrow" style="display:block;margin-bottom:8px">Who gets this edition</span>${N.audPick('ndAud', d, 'news')}</div>`}
      </div>
      <div><span class="eyebrow" style="display:block;margin-bottom:8px">Preview</span>${paperHtml(N.draftIssue(d), true)}</div>
    </div></div>`;
}
function paperHtml(p, prev){
  /* the GM's custom emoji (:name:) work in every part of the paper */
  const tx = x => N.emoText(N.marks(esc(x)));
  const ph = (x, f) => x ? tx(x) : prev ? `<span class="ph">${f}</span>` : '';
  const paras = t => String(t||'').split(/\n\s*\n/).map(s => s.trim()).filter(Boolean).map(s => `<p style="margin:0 0 10px">${tx(s).replace(/\n/g, '<br>')}</p>`).join('');
  const fig = (src, cap) => src ? `<figure class="pfig">${N.wikiImg(src, cap || '')}${cap ? `<figcaption>${tx(cap)}</figcaption>` : ''}</figure>` : '';
  const stories = (p.stories||[]).filter(s => s.title || s.body || s.img), notices = (p.notices||[]).filter(Boolean);
  return `<div class="paper"><h1 class="mast">${ph(p.paper,'Paper name')}</h1><div class="strip"><span>No. ${esc(p.no||'—')}</span><span>${ph(p.date,'In-world date')}</span><span>${ph(p.price, prev ? 'Price' : '')}</span></div>
    <h2 class="hl">${ph(p.headline,'Your headline here')}</h2>${p.sub || prev ? `<p class="psub">${ph(p.sub,'A line under the headline')}</p>` : ''}
    ${fig(p.limg, p.lcap)}
    <div class="plead">${paras(p.lead) || (prev?'<p class="ph">The lead story goes here.</p>':'')}</div>
    ${stories.length ? `<div class="pstories">${stories.map(s => `<section>${s.title ? `<h3>${tx(s.title)}</h3>` : ''}${fig(s.img, s.cap)}${paras(s.body)}</section>`).join('')}</div>` : ''}
    ${notices.length ? `<aside class="pnotices"><h3>Notices</h3><ul>${notices.map(t => `<li>${tx(t)}</li>`).join('')}</ul></aside>` : ''}</div>`;
}

/* ================= character / cast ================= */
/* who the Character tab can show: your own card first, then everyone the GM revealed a name for (PCs and NPCs alike), by name */
function heroList(v){
  const g = G(), mine = N.charOf(v.role);
  const known = Object.values(g.known || {}).filter(k => k.name).sort((a, b) => a.name.localeCompare(b.name));
  return [...(mine ? [{id:mine.id, me:true, av:{name:mine.built ? mine.short : pn(mine), portrait:mine.built ? mine.portrait : null, color:mine.color}, b:'You', sm:mine.built ? N.emoText(N.marks(esc(N.pcTag(mine)))) : 'No card yet'}] : []),
    ...known.map(k => ({id:k.id, av:{name:k.name, portrait:k.portrait, color:'var(--c-npc)'}, b:k.name, sm:N.MET[k.met] || 'Not marked', met:k.met}))];
}
function heroPage(v){
  const g = G(), mine = N.charOf(v.role);
  /* a player sees their own card in full, and other characters (PCs and NPCs alike) only once the GM revealed their name */
  const known = Object.values(g.known || {}).filter(k => k.name).sort((a, b) => a.name.localeCompare(b.name));
  const selId = v.ui.charSel && g.known?.[v.ui.charSel]?.name ? v.ui.charSel : mine?.id;
  const sel = selId === mine?.id ? mine : null, kn = !sel ? g.known?.[selId] : null;
  if (!sel && !kn) return `<div class="scroll" data-sk="hero" style="min-height:0">${v.dev==='phone' ? `<div class="top ph">${meBtn(v)}<h1>Character</h1></div>` : ''}<div class="quiet"><div class="art"></div><p>No character yet.</p></div></div>`;
  const bag = N.heroBag(v) && !!sel;
  if (bag && v.ui.heroInv) return heroInv(v, sel, mine);
  if (sel && sel.built && !isGM(v) && sel.player === v.role && v.ui.heroStats === sel.id) return heroStats(v, sel, mine);
  const list = heroList(v), cur = list.find(c => c.id === selId) || list[0];
  return `<div class="scroll" data-sk="hero" style="min-height:0">
    ${v.dev==='phone' ? `<div class="top ph">${meBtn(v)}<h1>${sel ? 'My character' : esc(kn.name)}</h1>${bag && sel.built ? `<button type="button" class="btn sm" data-a="heroInv" data-v="1">${IC('bag')}Inventory${sel.inv?.length ? ` <span class="tag" style="height:16px">${sel.inv.length}</span>` : ''}</button>` : ''}</div>` : ''}
    <div class="sheetv">
      ${list.length > 1 ? `<div class="charbar full"><button type="button" class="pchip charsel" data-a="pop" data-v="chars" aria-haspopup="listbox" aria-expanded="${v.ui.pop?.type === 'chars'}" aria-label="Pick a character to look at">${N.av(cur.av, 36)}<span><small>${cur.id === mine?.id ? 'Your character' : 'Viewing'}</small><b>${esc(cur.id === mine?.id ? cur.av.name : cur.b)}</b></span><span class="cnt">${list.length - (mine ? 1 : 0)} known</span>${IC('caret')}</button></div>` : ''}
      ${sel ? N.sheetBody(v, sel) : knownBody(v, kn)}
    </div></div>`;
}
/* someone else's card as a player sees it: only the parts the GM revealed. PCs and NPCs look exactly alike here */
function knownBody(v, k){
  const sub = [k.race, k.nat, k.job, k.age ? `Age ${k.age}` : ''].filter(Boolean).map(esc).join(' · ');
  const hero = `<section class="pc-hero full" style="--who:var(--c-npc)">${N.av({name:k.name, portrait:k.portrait || null, color:'var(--c-npc)'}, 84)}<div style="min-width:0"><h2>${esc(k.name)}</h2>${sub ? `<div class="by">${sub}</div>` : ''}
    ${k.met ? `<div class="metbadge">${IC(k.met === 'met' ? 'hand' : 'chat')}${N.MET[k.met]}</div>` : ''}</div></section>`;
  const sec = (h, body, full) => `<section class="sec${full ? ' full' : ''}"><h3>${h}</h3>${body}</section>`;
  const tx = t => N.emoText(N.linkText(t));
  const rungs = k.skills ? [...new Set(k.skills.map(x => x[1]))].sort((a, b) => b - a).map(x => [x, k.skills.filter(y => y[1] === x)]) : [];
  const body = (k.aspects ? sec('Aspects', `<div class="asps">${asps(k.aspects.map(([i, a]) => [`Aspect ${i + 1}`, a]))}</div>`) : '')
    + (k.skills ? sec('Skills', `<div class="lad">${rungs.map(([x, ns]) => `<div class="rung${x < 0 ? ' neg' : ''}"><span class="lv"><b>${sgn(x)}</b>${ladderWord(x)}</span><span class="sks">${ns.map(([n, , d]) => `<button type="button" disabled>${esc(n)}${d?.length ? `<small style="color:var(--ink-3);font-weight:600">${esc(d.join(', '))}</small>` : ''}</button>`).join('')}</span></div>`).join('')}</div>`) : '')
    + (k.cons ? sec('Consequences', `<div class="cons">${k.cons.map(([l, r, val, st]) => `<div class="con"><span class="lv"><b>${esc(l)}</b>${esc(r)} shifts</span><span class="slot${val ? ' full' : ''}">${esc(val) || 'Empty'}${val ? N.conTag(st || 'active') : ''}</span></div>`).join('')}</div>`) : '')
    + (k.gear ? sec('Weapons and armor', k.gear.map(([gk, x]) => { const [, l, ic] = N.GEARK.find(y => y[0] === gk) || [gk, gk, 'sword']; return `<p class="gearln">${IC(ic)}${l} <b>${sgn(x)}</b></p>`; }).join('')) : '')
    + (k.stunts ? sec('Stunts', k.stunts.map(([n, d]) => `<div class="stunt"><b>${tx(n)}</b><p>${tx(d)}</p></div>`).join('')) : '')
    + (k.inv ? sec('Inventory', `<div class="inv">${k.inv.map(([n, q, d, ic, cl]) => `<div class="it"><span class="ii">${IC(ic)}</span><span><b>${esc(n)}</b>${cl ? `<span class="icl">${esc(cl)}</span>` : ''}${d ? `<small>${esc(d)}</small>` : ''}</span><span class="q">×${q}</span></div>`).join('')}</div>`) : '')
    + (k.bio ? sec('Bio', `<p style="margin:0;white-space:pre-line">${tx(k.bio)}</p>`, true) : '')
    + (k.people ? sec('Important people', `<p style="margin:0;white-space:pre-line">${tx(k.people)}</p>`) : '');
  return hero + wikiSec(v, k.id) + (body || `<div class="quiet full"><div class="art"></div><p>That’s all you know about ${esc(k.name)} so far.</p></div>`);
}
/* A character's lifetime stats, counted from the chat history the app already keeps: nothing new is saved and the GM does
   nothing. Only chats the character's player can read count (Everyone, their DM, their group chats and parties). */
N.charStats = function(c){
  const g = G(), key = 'pc:' + c.id, names = new Set([c.short, c.name].filter(Boolean)), seat = c.player;
  const sees = m => m.ch === 'table' || m.ch === 'dm-' + seat || (N.grpOf(m.ch)?.seats || []).includes(seat);
  const mineRoll = r => r.whoKey ? r.whoKey === key : names.has(r.who);
  const st = {rolls:0, succ:0, style:0, tie:0, fail:0, open:0, best:null, skills:{}, invokes:0, fp:0,
    fights:0, attacks:0, hits:0, hitStyle:0, hitBy:0, defended:0, kills:0, killed:[], out:0, cons:0,
    scenes:0, ic:0, places:{c:new Map(), t:new Map(), n:new Map()}, wheres:new Set(), npcs:new Map(), met:0, heard:0, first:null};
  const lastClash = {}, fightIds = new Set();
  const ms = g.msgs.filter(sees).sort((a, b) => a.t - b.t);
  for (const m of ms) {
    if (m.kind === 'roll' && m.roll && mineRoll(m.roll)) {
      const r = m.roll, o = N.outcome(r), tot = N.rollTotal(r);
      st.rolls++; st.skills[r.skill] = (st.skills[r.skill] || 0) + 1;
      st.invokes += r.invokes.filter(x => !x.by).length; st.fp += r.invokes.filter(x => !x.by && x.how === 'fp').length;
      if (!o) st.open++; else if (o.k === 'style') { st.succ++; st.style++; } else st[o.k]++;
      if (!st.best || tot > st.best.tot) st.best = {tot, skill:r.skill, t:m.t};
      if (r.fight && m.fc) fightIds.add(m.fc);
      st.first = st.first ?? m.t;
    }
    if (m.kind === 'sys' && m.res && m.res.k === 'clash') {
      const [a, d] = m.res.rows || [], k = m.res.out?.k; lastClash[m.ch] = m.res;
      if (a && names.has(a.n)) { st.attacks++; if (k === 'hit') { st.hits++; if (/with style/.test(m.res.out.t)) st.hitStyle++; } }
      if (d && names.has(d.n)) { if (k === 'hit') st.hitBy++; else st.defended++; }
    }
    if (m.kind === 'sys' && !m.res && m.text) {
      const t = m.text, who = [...names].find(n => t.startsWith(n + ' '));
      const outM = /^(.+?) (?:can’t soak the \d+ shifts? and )?is taken out\.$/.exec(t);
      if (outM) {
        if (names.has(outM[1])) st.out++;
        else { const cl = /can’t soak/.test(t) && lastClash[m.ch]; if (cl && names.has(cl.rows?.[0]?.n) && cl.rows?.[1]?.n === outM[1]) { st.kills++; st.killed.push(outM[1].replace(/ \d+$/, '')); } }
      }
      if (who && / consequence\./.test(t) && / soaks the /.test(t)) st.cons++;
    }
    if ((m.kind === 'combat' || m.kind === 'fight') && !m.ck) {
      /* a fight counts when the character rolled in it or was attacked in it */
      const all = N.fightMsgs(m.cid);
      if (all.some(x => (x.kind === 'roll' && x.roll && mineRoll(x.roll)) || (x.kind === 'sys' && x.res?.k === 'clash' && (x.res.rows || []).some(r => names.has(r.n))))) st.fights++;
    }
    if (m.kind === 'scene' && m.scene) {
      st.scenes++;
      const L = m.scene.loc; if (L) for (const k of N.LOCK) if (L[k]?.l) st.places[k].set(L[k].l, (st.places[k].get(L[k].l) || 0) + 1);
      if (m.scene.where) st.wheres.add(m.scene.where.trim());
    }
    if (m.kind === 'rp' && m.by === 'gm' && m.as && m.as !== 'Narrator') st.npcs.set(m.as, (st.npcs.get(m.as) || 0) + 1);
    if (m.kind === 'rp' && m.by === seat) st.ic++;
  }
  for (const k of Object.values(g.known || {})) { if (k.met === 'met') st.met++; else if (k.met === 'heard') st.heard++; }
  return st;
};
function heroStats(v, c, mine){
  const s = N.charStats(c), own = c === mine, nm = esc(c.short || c.name);
  const pct = (a, b) => b ? Math.round(a / b * 100) + '%' : '–';
  const tile = (n, l, ic, tone='') => `<div class="stile${tone ? ' ' + tone : ''}">${IC(ic)}<b>${n}</b><span>${l}</span></div>`;
  const row = (l, n, sub='') => `<div class="srow"><span>${l}${sub ? `<small>${sub}</small>` : ''}</span><b>${n}</b></div>`;
  const decided = s.succ + s.tie + s.fail;
  const bar = decided ? `<div class="sbar" role="img" aria-label="${s.succ} successes, ${s.tie} ties, ${s.fail} fails">${[['succ', s.succ], ['tie', s.tie], ['fail', s.fail]].filter(x => x[1]).map(([k, n]) => `<i class="${k}" style="flex:${n}"></i>`).join('')}</div>
    <div class="skey"><span><i class="succ"></i>Success ${s.succ}${s.style ? ` <small>(${s.style} with style)</small>` : ''}</span><span><i class="tie"></i>Tie ${s.tie}</span><span><i class="fail"></i>Fail ${s.fail}</span></div>` : '<p class="muted">No rolls against a difficulty yet.</p>';
  const topSk = Object.entries(s.skills).sort((a, b) => b[1] - a[1]).slice(0, 3);
  const chips = (map, ic) => map.size ? `<div class="schips">${[...map].sort((a, b) => b[1] - a[1]).map(([n, x]) => `<span class="schip">${IC(ic)}${esc(n)}${x > 1 ? ` <small>×${x}</small>` : ''}</span>`).join('')}</div>` : '<p class="muted">None yet.</p>';
  const npcs = [...s.npcs].sort((a, b) => b[1] - a[1]);
  const kills = [...s.killed.reduce((m, n) => m.set(n, (m.get(n) || 0) + 1), new Map())];
  const head = `<div class="top ph" style="display:flex"><button type="button" class="ibtn" data-a="heroStats" data-v="" aria-label="Back to the character sheet">${IC('left')}</button><h1>${own ? 'My stats' : `${nm}’s stats`}</h1><button type="button" class="btn sm" data-a="heroStats" data-v="">${IC('x')}Close</button></div>`;
  return `<div class="scroll" data-sk="herostats" style="min-height:0">${head}
    <div class="sheetv stats">
      <section class="pc-hero full stathero" style="--who:${c.color}">${N.av(c, 64)}<div style="min-width:0"><h2>${esc(c.name)}</h2><div class="by">Lifetime stats${s.first ? ` · since ${new Date(s.first).toLocaleDateString(undefined, {month:'short', day:'numeric'})}` : ''}</div></div></section>
      <div class="full stiles">${tile(s.fights, 'Fights', 'swords')}${tile(s.kills, 'Foes taken out', 'skull', 'hot')}${tile(s.rolls, 'Rolls', 'dice')}${tile(pct(s.succ, decided), 'Success rate', 'check', 'good')}</div>
      <section class="sec"><h3>Rolls</h3>${bar}
        ${row('Rolls made', s.rolls, s.open ? `${s.open} with no difficulty to beat` : '')}
        ${s.best ? row('Best roll', sgn(s.best.tot), esc(s.best.skill)) : ''}
        ${topSk.length ? row('Most used skill', esc(topSk[0][0]), topSk.map(([k, n]) => `${esc(k)} ${n}`).join(' · ')) : ''}
        ${row('Aspects invoked', s.invokes, s.fp ? `${s.fp} paid with a fate point` : '')}</section>
      <section class="sec"><h3>Fights</h3>
        ${row('Fights joined', s.fights)}
        ${row('Attacks made', s.attacks, s.attacks ? `${pct(s.hits, s.attacks)} landed` : '')}
        ${row('Hits landed', s.hits, s.hitStyle ? `${s.hitStyle} with style` : '')}
        ${row('Foes taken out', s.kills, kills.map(([n, x]) => esc(n) + (x > 1 ? ` ×${x}` : '')).join(' · '))}
        ${row('Attacks turned aside', s.defended)}
        ${row('Times hit', s.hitBy, s.cons ? `${s.cons} consequence${s.cons === 1 ? '' : 's'} taken` : '')}
        ${row('Times taken out', s.out)}</section>
      <section class="sec"><h3>Travels</h3>
        ${row('Scenes played', s.scenes)}
        <div class="ssub"><span class="eyebrow">Countries · ${s.places.c.size}</span>${chips(s.places.c, 'flag')}</div>
        <div class="ssub"><span class="eyebrow">Cities and towns · ${s.places.t.size}</span>${chips(s.places.t, 'castle')}</div>
        ${s.places.n.size ? `<div class="ssub"><span class="eyebrow">Neighborhoods · ${s.places.n.size}</span>${chips(s.places.n, 'pin')}</div>` : ''}</section>
      <section class="sec"><h3>People</h3>
        ${row('NPCs who spoke with you', npcs.length)}
        ${row('Characters met', s.met, s.heard ? `${s.heard} more heard of` : '')}
        ${npcs.length ? `<div class="snpcs">${npcs.slice(0, 6).map(([n, x]) => { const o = N.npcByName(n); return `<div class="snpc">${N.av({name:n, portrait:o?.portrait || null, color:'var(--c-npc)'}, 30)}<span>${esc(n)}</span><small>${x} line${x === 1 ? '' : 's'}</small></div>`; }).join('')}</div>` : ''}
        ${row('Lines said in character', s.ic)}</section>
      <p class="full muted sfoot">${IC('info')}Counted automatically from the chat history. Wins and losses aren’t counted, because the app doesn’t record who won a fight.</p>
    </div></div>`;
}
/* phone, player: the sheet's items open in their own view with a way back */
N.heroBag = v => v.dev === 'phone' && !isGM(v) && v.ui.tab === 'hero';
function heroInv(v, c, mine){
  const own = c === mine;
  return `<div class="scroll" data-sk="heroinv" style="min-height:0"><div class="top ph" style="display:flex"><button type="button" class="ibtn" data-a="heroInv" data-v="" aria-label="Back to the character sheet">${IC('left')}</button><h1>${own ? 'My inventory' : `${esc(c.built ? c.short : pn(c))}’s inventory`}</h1><button type="button" class="btn sm" data-a="heroInv" data-v="">${IC('x')}Close</button></div>
    <div class="sheetv invv">${c.built
      ? N.invTab(v, c, false)
      : `<section class="sec"><p class="muted">${own ? `${esc(N.gmName())} hasn’t made your character card yet.` : 'No card yet.'}</p></section>`}</div></div>`;
}
const asps = list => list.filter(x => x[1]).map(([k,a],i)=>`<span class="icard" style="--rot:${[-.6,.5,-.3][i%3]}deg"><span class="k">${k}</span><span>${N.emoText(N.linkText(a))}</span></span>`).join('');
N.sheetBody = function(v, c){
  const g = G(), gm = isGM(v), mine = c.player === v.role;
  const who = `--who:${c.color}`;
  if (!c.built) return `<div class="pc-hero full" style="${who}">${N.av({name:pn(c),color:c.color},84)}<div><h2>${esc(pn(c))}’s character</h2><div class="by">${gm?'Not made yet.':mine?`${esc(N.gmName())} will make your character card.`:'Not made yet.'}</div></div></div>
    ${gm?`<div class="full" style="display:flex;justify-content:center"><button type="button" class="btn primary lg spark" data-a="pcEdit" data-v="${c.id}">${IC('pen')}Make ${esc(pn(c))}’s card</button></div>`:''}
    <div class="quiet full"><div class="art"></div><p>${gm?'Name, age, aspects, skills, stunts and fate points. The player gets a note when it’s ready.':'It shows up here as soon as it’s ready.'}</p></div>`;
  const rungs = [8,7,6,5,4,3,2,1,-1].map(x => [x, Object.entries(c.skills).filter(([,y]) => y === x).map(([n]) => n)]).filter(r => r[1].length);
  const canRoll = gm, edit = mine || gm;
  return `<section class="pc-hero full" style="${who}">
      ${mine && !gm ? `<button type="button" class="facebtn" data-a="sheet" data-v="myFace" aria-label="Change my picture">${N.av(c,84)}<span class="badge">${IC('image')}</span></button>` : N.av(c,84)}
      <div style="min-width:0"><h2>${esc(c.name)}</h2><div class="by">${c.race?`${esc(c.race)} · `:''}${c.nat?`${esc(c.nat)} · `:''}${c.age?`Age ${esc(c.age)} · `:''}Played by ${esc(pn(c))}${mine?' · you':''}</div>${N.pcTag(c)?`<div class="hc">${N.emoText(N.marks(esc(N.pcTag(c))))}</div>`:''}</div>
      <div class="fp"><div class="res"><div><span class="eyebrow">Fate points · refresh ${c.refresh}</span><div class="coins">${coinsHtml(c, gm)}</div></div>${goldHtml(c, 'c', gm)}${gm ? N.xferBtn('c', c.id) : ''}</div>${gm?`<div class="gmbar"><button type="button" class="btn sm" data-a="pcEdit" data-v="${c.id}">${IC('pen')}Edit card</button>${revBtn(c.id)}<button type="button" class="btn sm" data-a="pcToNpc" data-v="${c.id}" title="Make a new NPC card from this sheet">${IC('npc')}Copy as NPC</button><button type="button" class="btn sm danger" data-a="sheet" data-v="pcDel" data-c="${c.id}">${IC('trash')}Delete</button></div>`:''}</div>
    </section>
    ${(v.ui.tab === 'hero' || v._pane === 'hero') && mine && !gm ? `<div class="full statrow"><button type="button" class="btn statbtn" data-a="heroStats" data-v="${c.id}">${IC('scroll')}Stats</button>${N.figOk && N.figOk() ? `<button type="button" class="btn statbtn" data-a="figOpen">${IC('hero')}Figure</button>` : ''}</div>` : ''}
    ${wikiSec(v, c.id)}
    <section class="sec"><h3>Aspects</h3><div class="asps">${asps(N.pcAspects(c).map((a,i)=>[`Aspect ${i+1}`,a])) || '<p class="muted">None yet.</p>'}</div></section>
    <section class="sec"><h3>Skills${canRoll?' · tap one to roll':''}</h3><div class="lad">${rungs.map(([x,ns]) => `<div class="rung${x < 0 ? ' neg' : ''}"><span class="lv"><b>${sgn(x)}</b>${ladderWord(x)}</span><span class="sks">${ns.map(n => canRoll ? `<button type="button" data-a="roll" data-skill="${esc(n)}" data-c="${c.id}">${esc(n)}${N.discOf(c, n).length?`<small style="color:var(--ink-3);font-weight:600">${esc(N.discOf(c, n).join(', '))}</small>`:''}${fateDie.replace('<svg','<svg style="width:14px;height:14px;color:var(--ink-4)"')}</button>` : `<button type="button" disabled>${esc(n)}${N.discOf(c, n).length?`<small style="color:var(--ink-3);font-weight:600">${esc(N.discOf(c, n).join(', '))}</small>`:''}</button>`).join('')}</span></div>`).join('')}<div class="rung"><span class="lv"><b>+0</b>Mediocre</span><span class="sks"><span class="muted" style="font-weight:600;font-size:13px;padding:8px 0">Everything else</span></span></div></div></section>
    <section class="sec"><h3>Stress</h3><div class="stress2">${[['phys','Physical','Strength'],['ment','Mental','Will']].map(([k,l,s]) => `<div class="trk"><span class="eyebrow">${l} <span style="letter-spacing:0;text-transform:none;font-weight:600">· from ${s}</span></span><div class="boxes">${c.stressV[k].map((x,i)=>`<button type="button" class="sbox${c.stress[k][i]?' on':''}" ${gm?`data-a="stress" data-c="${c.id}" data-k="${k}" data-i="${i}"`:'disabled'} aria-pressed="${!!c.stress[k][i]}" aria-label="${l} ${x}">${x}</button>`).join('')}</div></div>`).join('')}</div></section>
    <section class="sec"><h3>Consequences</h3><div class="cons">${N.consSlots(c.skills).map(sl => `<div class="con">${conLv(sl)}${gm?`<div class="con-v"><input class="inp" id="con-${sl.k}-${c.id}-${v.id}" data-i="con" data-c="${c.id}" data-k="${sl.k}" value="${esc(c.cons[sl.k]||'')}" placeholder="Empty">${c.cons[sl.k] ? N.conStEd(`data-c="${c.id}"`, sl, N.conSt(c, sl.k)) : ''}</div>`:`<span class="slot${c.cons[sl.k]?' full':''}">${esc(c.cons[sl.k])||'Empty'}${N.conTag(N.conSt(c, sl.k))}</span>`}</div>`).join('')}</div></section>
    <section class="sec"><h3>Weapons and armor</h3><p class="gearln">${IC('sword')}Melee weapon <b>${sgn(+c.gearAtk||0)}</b><span class="muted">Fighting, shifts added to a hit</span></p><p class="gearln">${IC('target')}Ranged weapon <b>${sgn(+c.gearRng||0)}</b><span class="muted">Shooting, added to the roll</span></p><p class="gearln">${IC('arrowR')}Ranged ammo <b>${sgn(+c.gearAmmo||0)}</b><span class="muted">Shooting, shifts added to a hit</span></p><p class="gearln">${IC('shieldU')}Armor <b>${sgn(+c.gearDef||0)}</b><span class="muted">shifts taken off a hit</span></p></section>
    <section class="sec"><h3>Stunts</h3>${c.stunts.map(([n,d]) => `<div class="stunt"><b>${N.emoText(N.linkText(n))}</b><p>${N.emoText(N.linkText(d))}</p></div>`).join('') || '<p class="muted">None yet.</p>'}</section>
    <section class="sec full"><h3>Bio</h3>${noteBox(v, c, 'bio', edit, 'Who they are, where they come from, what they look like…')}</section>
    <section class="sec"><h3>Important people</h3>${noteBox(v, c, 'people', edit, 'Family, friends, rivals, debts… one per line')}</section>
    ${N.heroBag(v) ? '' : `<section class="sec"><h3>Inventory</h3>${gm || c.invText ? noteBox(v, c, 'invText', gm, 'What they carry. The player can read this.') : ''}${invList(v, c, gm)}</section>`}`;
};
/* the wiki pages the GM linked to a card, as a row of links. The GM links and unlinks them here; players see the ones they can read */
const wikiSec = (v, id) => { const es = N.cardWiki(id), gm = isGM(v); if (!es.length && !gm) return '';
  return `<section class="sec full"><h3>Wiki pages</h3><div class="wlinks">${es.map(e => `<span class="wlk"><a class="wl" data-a="wiki" data-v="${e.id}">${IC(N.catIcon(e.cat))}${esc(e.title)}</a>${gm ? `<button type="button" class="ibtn sm" data-a="wlTog" data-c="${esc(id)}" data-v="${e.id}" aria-label="Unlink ${esc(e.title)}" title="Unlink">${IC('x')}</button>` : ''}</span>`).join('')}${gm ? `<button type="button" class="btn sm" data-a="pop" data-v="wlAdd" data-c="${esc(id)}">${IC('link')}Link a wiki page</button>` : ''}</div>${gm && !es.length ? '<p class="muted" style="margin:8px 0 0;font:600 12.5px/1.4 var(--f-ui)">Entries about them. Players see the ones they can read.</p>' : ''}</section>`; };
/* GM: show single parts of this card to chosen players */
const revBtn = id => { const n = N.revSeats(id).length; return `<button type="button" class="btn sm" data-a="revOpen" data-v="${esc(id)}">${IC('eye')}Reveal${n ? ` <span class="tag" style="height:16px">${n}</span>` : ''}</button>`; };
const conLv = sl => `<span class="lv"><b>${sl.l}</b>${sl.lo}–${sl.hi} shifts${sl.only?`<small style="display:block;color:var(--gold-tx);margin-top:2px">${sl.only} only</small>`:''}</span>`;
N.conLv = conLv;
/* a free-text box on a card the player and GM can both write in (inventory notes: GM only) */
const noteBox = (v, c, k, edit, ph) => edit ? `<textarea class="inp" id="cn-${k}-${c.id}-${v.id}" data-i="cnote" data-c="${c.id}" data-k="${k}" rows="3" placeholder="${ph}">${esc(c[k]||'')}</textarea>`
  : c[k] ? `<p style="margin:0;white-space:pre-line">${N.emoText(N.linkText(c[k]))}</p>` : '<p class="muted">Nothing yet.</p>';
/* the items the GM hands out; only the GM changes them */
function invList(v, c, gm, owner){
  const {own, key, rowHtml} = invRows(v, c, gm, owner);
  const rows = (c.inv || []).map((r, i) => [r, i]), wpn = rows.filter(([r]) => N.isWeaponRow(r)), rest = rows.filter(([r]) => !N.isWeaponRow(r));
  const list = rs => rs.map(([r, i]) => rowHtml(r, i)).join('');
  return `${wpn.length ? `<div class="inv-h">${IC('sword')}Weapons and armor</div><div class="inv">${list(wpn)}</div>${rest.length ? `<div class="inv-h">${IC('bag')}Other items</div>` : ''}` : ''}<div class="inv">${list(rest) || (wpn.length ? '' : `<p class="muted">${gm?'No items yet.':`No items yet. ${esc(N.gmName())} adds them here.`}</p>`)}</div>
      ${invAddBox(v, c, gm, own, key)}`;
}
const invAddBox = (v, c, gm, own, key) => gm?`<div class="invadd"><input class="inp" id="inv-${key}-${v.id}" placeholder="Add an item, e.g. Silver dagger" aria-label="Item name"${G().items?.length ? ` list="itcat-${v.id}" autocomplete="off"` : ''}>${G().items?.length ? `<datalist id="itcat-${v.id}">${G().items.map(it => `<option value="${esc(it.name)}">${esc(N.itemKind(it.kind)[1])}</option>`).join('')}</datalist>` : ''}<input class="inp" id="invq-${key}-${v.id}" data-i="invQ" type="number" min="1" value="${v.ui.invQ||1}" aria-label="How many"><button type="button" class="btn sm" data-a="invAdd" ${own}>${IC('plus')}Add</button><input class="inp" id="invd-${key}-${v.id}" placeholder="What it does (optional), e.g. Melee 1" aria-label="Item note" style="grid-column:1/-1"></div>${c.player?`<p class="muted" style="margin:6px 0 0;font:600 12px/1.4 var(--f-ui)">Changes post a note in ${esc(pn(c))}’s private chat.</p>`:''}`:'';
/* one inventory row, with the GM's buttons (equip, −/+, transfer, edit, remove) */
function invRows(v, c, gm, owner, inCat){
  /* owner: an NPC being made or edited keeps its items on the draft (data-nd) until it is saved */
  const own = owner || (c.player ? `data-c="${c.id}"` : `data-n="${c.id}"`), key = owner ? 'nd' : c.id;
  const ed = v.ui.invEdit;
  /* Jake's rule: weapons and armor get their own list, each with an Equipped switch (GM) and, for ammo and thrown weapons, an ammo count */
  const rowHtml = ([n,q,d,ic],i) => { const row = c.inv[i], x = N.invX(row), canEq = gm && !owner && !!N.itemSlot(N.rowItem(row));
    return gm && ed && ed.key === key && ed.i === i ? invEditRow(v, key, own, i, ed.n ?? n, ed.q ?? q, ed.d ?? d, ed.ic ?? ic, N.rowItem(row) ? null : ed.k ?? (x.k || '')) : `<div class="it${x.eq ? ' eq' : ''}"><span class="ii">${IC(ic||'bag')}</span><span><b>${N.emoText(N.marks(esc(n)))}</b>${(cl => cl && !(inCat && cl === N.itemKind(N.rowKind(row))[1]) ? `<span class="icl">${esc(cl)}</span>` : '')(N.rowClass(row))}${x.eq ? ' <span class="eqtag">Equipped</span>' : ''}${d?`<small>${N.emoText(N.marks(esc(d)))}</small>`:''}${N.invGm(v, row)}${x.am != null ? `<span class="ammo"><span class="eyebrow">Ammo</span>${gm ? `<button type="button" data-a="invAmmo" ${own} data-i="${i}" data-d="-1" aria-label="One less ammo" ${x.am <= 0 ? 'disabled' : ''}>−</button>` : ''}<b>${x.am}</b><small>of ${N.AMMO_MAX}</small>${gm ? `<button type="button" data-a="invAmmo" ${own} data-i="${i}" data-d="1" aria-label="One more ammo" ${x.am >= N.AMMO_MAX ? 'disabled' : ''}>+</button>` : ''}</span>` : ''}</span><span class="q">×${q}</span>${gm?`<span class="mini">${canEq ? `<button type="button" class="eqb" data-a="invEquip" ${own} data-i="${i}" aria-pressed="${!!x.eq}" aria-label="${x.eq ? 'Unequip' : 'Equip'} ${esc(n)}" title="${x.eq ? 'Unequip' : 'Equip'}">${IC(x.eq ? 'check' : 'hand')}</button>` : ''}<button type="button" data-a="invQty" ${own} data-i="${i}" data-d="-1" aria-label="One fewer ${esc(n)}">−</button><button type="button" data-a="invQty" ${own} data-i="${i}" data-d="1" aria-label="One more ${esc(n)}">+</button>${!owner ? `<button type="button" data-a="invTransfer" ${own} data-i="${i}" aria-label="Transfer ${esc(n)}">${IC('right')}</button>` : ''}<button type="button" data-a="invEdit" ${own} data-i="${i}" aria-label="Edit ${esc(n)}">${IC('pen')}</button><button type="button" data-a="invDel" ${own} data-i="${i}" aria-label="Remove ${esc(n)}">${IC('x')}</button></span>`:''}</div>`; };
  return {own, key, rowHtml};
}
/* the GM changes an item in place: name, how many, what it does and its picture */
const INV_IC = ['bag','sword','helm','potion','coins','scroll','drink','boots','knuckles','skull'];
const invEditRow = (v, key, own, i, n, q, d, ic, k) => `<div class="it ied">
  <div class="ied-ics" role="group" aria-label="Picture">${INV_IC.map(x => `<button type="button" data-a="invIc" data-v="${x}" aria-pressed="${(ic || 'bag') === x}" aria-label="${x}">${IC(x)}</button>`).join('')}</div>
  ${k != null ? `<label class="ied-k"><span class="eyebrow">Kind</span><select class="inp" id="iek-${key}-${v.id}" data-i="ie" data-k="k" aria-label="Kind"><option value="">From its picture</option>${N.ITEMK.map(([kk, l]) => `<option value="${kk}"${k === kk ? ' selected' : ''}>${esc(l)}</option>`).join('')}</select></label>` : ''}
  <div class="invadd" style="margin:0"><input class="inp" id="ien-${key}-${v.id}" data-i="ie" data-k="n" value="${esc(n)}" placeholder="Item name" aria-label="Item name"><input class="inp" id="ieq-${key}-${v.id}" data-i="ie" data-k="q" type="number" min="0" value="${q}" aria-label="How many"><span></span>
  <input class="inp" id="ied-${key}-${v.id}" data-i="ie" data-k="d" value="${esc(d || '')}" placeholder="What it does (optional)" aria-label="Item note" style="grid-column:1/-1"></div>
  <div class="ied-act"><button type="button" class="btn sm ghost" data-a="invEditCancel">Cancel</button><button type="button" class="btn sm primary" data-a="invSave" ${own} data-i="${i}">${IC('check')}Save</button></div></div>`;
N.invList = invList;
/* GM only (Jake): the catalog's GM notes on an inventory item, looked up live by its name and never saved on the row,
   so players' devices never get them. '' for players, items not in the catalog, and catalog items without notes */
N.invGm = (v, row) => { const it = v && isGM(v) && N.rowItem(row); return (it && (it.gm || '').trim() ? `<span class="inv-gm" title="Only you see this">${IC('lock').replace('<svg', '<svg aria-hidden="true"')}<span><b>GM notes</b>${N.emoText(N.marks(esc(it.gm.trim())))}</span></span>` : '') + N.invPv(v, row && row[0]); };
/* the catalog's notes for some players only (N.itemPvFor), by item name. The GM sees every note with who it is for;
   a player sees only the ones sent to them (G.ivMine, from their own only/<seat>) */
N.invPv = (v, name) => {
  if (!v || !name) return '';
  const box = (who, t) => `<span class="inv-gm inv-pv" title="${esc(who)}">${IC('eye').replace('<svg', '<svg aria-hidden="true"')}<span><b>${esc(who)}</b>${N.emoText(N.marks(esc(t)))}</span></span>`;
  if (isGM(v)) { const it = N.itemByName(name); return it ? N.itemPvOk(it).map(p => { const ss = (p.see || []).filter(s => G().P[s]); return box(ss.length ? `Only ${N.namesList(ss)} ${ss.length > 1 ? 'see' : 'sees'} this` : 'Nobody picked yet · only you see it', p.text.trim()); }).join('') : ''; }
  return ((G().ivMine || {})[N.pvKey(name)] || []).map(t => box('Only you see this', t)).join('');
};
/* ---------- the Inventory tab (Jack, 2026-11-13): the character's figure, what they have equipped, then every item in
   bubbles by Jake's item kinds (N.ITEMK). Kinds with nothing in them are greyed out at the end. The rows and the GM's
   buttons are the same as on the sheet (invRows). ---------- */
const INV_SLOTS = [['melee','Melee weapon','sword','gearAtk','Fighting · shifts added to a hit'],['ranged','Ranged weapon','target','gearRng','Shooting · added to the roll'],
  ['ammo','Ranged ammo','arrowR','gearAmmo','Shooting · shifts added to a hit'],['armor','Armor','shieldU','gearDef','shifts taken off a hit'],['shield','Shield','shieldU','shield','+1 when defending']];
function invFig(v, c){
  const mine = c.player === v.role && !isGM(v), src = c.fig && N.figPic ? N.figPic(c.fig, 'big') : null;
  const pic = src ? `<img src="${src}" alt="${esc(c.short || c.name)}’s figure">` : c.fig ? '<i class="wait" aria-hidden="true"></i>' : `<span class="nofig" aria-hidden="true">${IC('hero')}</span>`;
  const btn = mine && N.figOk && N.figOk() ? `<button type="button" class="btn sm" data-a="figOpen">${IC(c.fig ? 'pen' : 'plus')}${c.fig ? 'Change figure' : 'Make my figure'}</button>` : '';
  const n = (c.inv || []).length, eq = (c.inv || []).filter(r => N.invX(r).eq || N.invX(r).eq2).length;
  return `<section class="sec inv-me"><div class="inv-fig">${pic}</div><div class="inv-who"><span class="eyebrow">${mine ? 'Carrying' : esc(pn(c))}</span><h2>${esc(c.short || c.name)}</h2>
    <p class="inv-count">${n ? `${n} item${n === 1 ? '' : 's'}` : 'No items'}${eq ? ` · ${eq} equipped` : ''}</p>${goldHtml(c, 'c', false)}${btn}</div></section>`;
}
function invGear(v, c){
  const eqRows = (c.inv || []).filter(r => N.invX(r).eq || N.invX(r).eq2), used = new Set();
  const tiles = INV_SLOTS.map(([sl, l, ic, rk, how]) => {
    const rs = eqRows.filter(r => N.rowSlot(r) === sl); rs.forEach(r => used.add(r));
    const rate = +c[rk] || 0, am = rs.map(r => N.invX(r).am).find(a => a != null);
    if (sl === 'shield' && !rs.length && !rate) return '';
    return `<div class="gslot${rs.length ? ' on' : rate ? ' bare' : ''}"><span class="gi">${IC(ic)}</span><span class="gt"><span class="eyebrow">${l}</span>
      <b>${rs.length ? rs.map(r => N.emoText(N.marks(esc(r[0])))).join(' <i>&amp;</i> ') : rate ? 'Set on the card' : '<span class="none">Nothing equipped</span>'}</b>
      <small>${how}${sl === 'melee' && +c.gearAtk2 ? ` · second weapon ${sgn(+c.gearAtk2)}` : ''}</small>${am != null ? `<span class="gpips" aria-label="${am} of ${N.AMMO_MAX} ammo">${Array.from({length:N.AMMO_MAX}, (_, i) => `<i class="${i < am ? 'on' : ''}"></i>`).join('')}</span>` : ''}</span>
      <span class="gr${rate ? '' : ' z'}">${sgn(rate)}</span></div>`; }).join('');
  const other = eqRows.filter(r => !used.has(r));
  return `<section class="sec inv-gear"><h3>${IC('swords')}Weapons and armor</h3><div class="gslots">${tiles}</div>
    ${other.length ? `<p class="gmore">${IC('check')}Also equipped: ${other.map(r => `<b>${N.emoText(N.marks(esc(r[0])))}</b>`).join(', ')}</p>` : ''}
    ${c.silverAtk || c.silverAmmo ? `<p class="gmore">${IC('sparkle')}Silver ${c.silverAtk && c.silverAmmo ? 'weapon and ammo' : c.silverAtk ? 'weapon' : 'ammo'}: bites vampires and werewolves</p>` : ''}</section>`;
}
function invCats(v, c, gm){
  const {own, key, rowHtml} = invRows(v, c, gm, null, true);
  const by = {}; (c.inv || []).forEach((r, i) => { const k = N.rowKind(r); (by[k] = by[k] || []).push([r, i]); });
  const full = N.ITEMK.filter(([k]) => by[k]), empty = N.ITEMK.filter(([k]) => !by[k]);
  const n = k => by[k].length;
  return `<section class="sec full inv-cats-sec"><h3>${IC('bag')}Items</h3>
    ${full.length ? `<div class="inv-cats${gm ? ' gmv' : ''}">${full.map(([k, l, ic]) => { const id = c.id + ':' + k, open = !!(v.ui.invOpen || {})[id], rs = by[k];
      /* collapsed (the default): the first few names as a preview, so 30 potions stay one line until opened */
      const peek = rs.slice(0, 3).map(([r]) => esc(r[0])).join(', ') + (rs.length > 3 ? ` +${rs.length - 3} more` : '');
      return `<div class="icat${open ? ' open' : ''}" data-k="${k}"><button type="button" class="icat-h" data-a="invCat" data-v="${esc(id)}" aria-expanded="${open}"><span class="ci">${IC(ic)}</span><span class="ct"><b>${esc(l)}</b>${open ? '' : `<small>${peek}</small>`}</span><span class="cn">${n(k)}</span><span class="cv">${IC('caret')}</span></button>${open ? `<div class="inv">${rs.map(([r, i]) => rowHtml(r, i)).join('')}</div>` : ''}</div>`; }).join('')}</div>`
      : `<p class="muted">${gm ? 'No items yet.' : `No items yet. ${esc(N.gmName())} adds them here.`}</p>`}
    ${empty.length ? `<div class="inv-cats none" aria-label="Kinds with nothing in them">${empty.map(([k, l, ic]) => `<div class="icat off" data-k="${k}"><div class="icat-h"><span class="ci">${IC(ic)}</span><b>${esc(l)}</b><span class="cn">0</span></div></div>`).join('')}</div>` : ''}
    ${invAddBox(v, c, gm, own, key)}</section>`;
}
N.invTab = (v, c, gm) => `${invFig(v, c)}${invGear(v, c)}${invCats(v, c, gm)}${gm || c.invText ? `<section class="sec full"><h3>Notes</h3>${noteBox(v, c, 'invText', gm, 'What they carry. The player can read this.')}</section>` : ''}`;
function invBody(v){
  const gm = isGM(v);
  const list = gm ? N.pcs() : [N.charOf(v.role)].filter(Boolean);
  const body = list.length ? list.map(c => !c.built
      ? `<section class="sec"><h3>${esc(pn(c))}</h3><p class="muted">${gm?'No card yet. Make it in Cast first.':`${esc(N.gmName())} hasn’t made your character card yet.`}</p></section>`
      : N.invTab(v, c, gm)).join(gm ? '<hr class="inv-sep full">' : '')
    : `<div class="quiet full"><div class="art"></div><p>${gm?'No one has a seat yet.':'Nothing here yet.'}</p></div>`;
  return `<div class="sheetv invv">${body}</div>`;
}
function invPage(v){
  const ph = v.dev === 'phone';
  const top = v._pane ? '' : ph ? `<div class="top ph">${meBtn(v)}<h1>Inventory</h1></div>` : `<div class="top dt" style="display:flex"><h1>Inventory</h1></div>`;
  return `<div class="scroll" data-sk="inv" style="min-height:0">${top}${invBody(v)}</div>`;
}

function castPage(v){
  const g = G(), seg = v.ui.castSeg, ph = v.dev === 'phone';
  if (v.ui.castSel) {
    const c = g.chars[v.ui.castSel], n = g.npcs.find(x => x.id === v.ui.castSel);
    if (!c && !n) { v.ui.castSel = null; return castPage(v); }
    return `<div class="scroll" data-sk="cast2" style="min-height:0"><div class="top ${ph?'ph':'dt'}" style="display:flex"><button type="button" class="ibtn" data-a="castBack" aria-label="Back">${IC('left')}</button><h1>${esc(c ? (c.built?c.name:pn(c)+'’s card') : n.name)}</h1>${n?`<button type="button" class="btn sm" data-a="voice" data-v="${esc(n.name)}" data-go="1">${IC('chatL')}Speak as</button>`:''}</div>
      <div class="sheetv">${c ? N.sheetBody(v, c) : npcBody(v, n)}</div></div>`;
  }
  const pcs = N.pcs(), pending = N.MEMBERS.filter(m => m.role === 'pending').length;
  const q = (v.ui.npcQ || '').trim().toLowerCase();
  /* NPC folders: one folder open at a time (v.ui.npcDir); a search looks through every folder */
  const here = N.nd.byId(v.ui.npcDir) ? v.ui.npcDir : null, path = N.nd.path(here), up = here ? N.nd.byId(N.nd.byId(here).in)?.id || '' : '';
  const npcs = g.npcs.filter(n => q ? [n.name, n.race, n.nat, n.job, n.hc].join(' ').toLowerCase().includes(q) : N.nd.of(n) === here);
  const dirs = q ? [] : N.nd.kids(here);
  const dirCard = d => { const n = N.nd.npcs(d.id).length, k = N.nd.kids(d.id).length; return `<button type="button" class="ccard ndir" data-a="npcDirGo" data-v="${esc(d.id)}"><span class="av sq" style="--s:52px;box-shadow:none;background:var(--accent-soft);color:var(--gold-tx)">${IC('folder').replace('<svg','<svg style="width:24px;height:24px"')}</span><span><b>${esc(d.name)}</b><small>${n} ${n === 1 ? 'NPC' : 'NPCs'}${k ? ` · ${k} ${k === 1 ? 'folder' : 'folders'}` : ''}</small></span><span class="icon-go">${IC('right')}</span></button>`; };
  const dirHead = here ? `<div class="ndhead"><button type="button" class="ibtn" data-a="npcDirGo" data-v="${esc(up)}" aria-label="Back to ${esc(N.nd.byId(up)?.name || 'all NPCs')}">${IC('left')}</button><span>${IC('folder')}<span><small>${esc(['All NPCs', ...path.slice(0, -1).map(d => d.name)].join(' › '))}</small><b>${esc(path[path.length - 1].name)}</b></span></span><button type="button" class="ibtn sm" data-a="nfOpen" data-v="${esc(here)}" aria-label="Rename, move or delete this folder" title="Folder settings">${IC('pen')}</button></div>` : '';
  return `<div class="scroll" data-sk="cast" style="min-height:0"><div class="cast">
    <div style="display:flex;align-items:center;gap:10px;padding-top:var(--safe-t,0px)">${ph?meBtn(v):''}<h1 class="ttl" style="flex:1;font-size:${ph?22:28}px">Cast</h1><button type="button" class="btn sm primary spark" data-a="npcNew">${IC('plus')}New NPC</button></div>
    <div class="seg" role="group" aria-label="Show" style="justify-self:start"><button type="button" data-a="castSeg" data-v="players" aria-pressed="${seg==='players'}">${IC('users')}Players</button><button type="button" data-a="castSeg" data-v="npcs" aria-pressed="${seg==='npcs'}">${IC('npc')}NPCs <span class="tag" style="height:16px">${g.npcs.length}</span></button><button type="button" data-a="castSeg" data-v="items" aria-pressed="${seg==='items'}">${IC('bag')}Items</button></div>
    ${seg === 'items' ? invBody(v) : seg === 'players' ? `<div class="cgrid">${pcs.map(c => c.built
      ? `<button type="button" class="ccard" data-a="castSel" data-v="${c.id}">${N.av(c,52)}<span><b>${esc(c.name)}</b><small>${N.emoText(N.marks(esc(N.pcTag(c))))}</small><small>Played by ${esc(pn(c))}</small></span><span class="icon-go">${IC('right')}</span></button>`
      : `<div class="ccard empty">${N.av({name:pn(c),color:c.color},52)}<span><b>${esc(pn(c))}</b><small>Signed in · no card yet</small></span><button type="button" class="btn sm primary" data-a="pcEdit" data-v="${c.id}">Make card</button></div>`).join('')}
      <button type="button" class="ccard empty" data-a="sheet" data-v="players"><span class="av" style="--s:52px;--c:var(--line-3);box-shadow:none;background:var(--sunk);color:var(--ink-3)">${IC('userplus').replace('<svg','<svg style="width:24px;height:24px"')}</span><span><b>Players &amp; sign-ins</b><small>${pending ? `${pending} ${pending===1?'person is':'people are'} waiting to be let in` : pcs.length ? 'Let people in, rename or remove them' : 'Send your players the link to this page'}</small></span>${pending?`<span class="badge">${pending}</span>`:`<span class="icon-go">${IC('right')}</span>`}</button></div>`
    : `<div class="ndbar"><div class="search">${IC('search')}<input class="inp" id="npcq-${v.id}" placeholder="${here ? 'Find an NPC in any folder' : 'Find an NPC'}" data-i="npcQ" value="${esc(v.ui.npcQ||'')}"></div><button type="button" class="btn sm" data-a="nfOpen" data-v="">${IC('folder')}New folder</button></div>
      ${q ? '' : dirHead}
      ${dirs.length ? `<div class="cgrid">${dirs.map(dirCard).join('')}</div>` : ''}
      ${npcs.length ? `<div class="cgrid">${npcs.map(n => `<div class="ccard">${N.av({name:n.name,portrait:n.portrait,color:'var(--c-npc)'},52)}<span><b>${esc(n.name)}</b><small>${esc(N.npcSub(n))}</small>${q && N.nd.of(n) ? `<small class="ndwhere">${IC('folder')}${esc(N.nd.name(n.dir))}</small>` : ''}<small style="font-style:italic;font-family:var(--f-display)">${esc(n.hc)}</small></span><button type="button" class="ibtn sm" data-a="castSel" data-v="${n.id}" aria-label="Open ${esc(n.name)}">${IC('right')}</button>
        <div class="acts2"><button type="button" class="btn sm" data-a="voice" data-v="${esc(n.name)}" data-go="1">${IC('chatL')}Speak as</button>${g.combat.state!=='off'?`<button type="button" class="btn sm" data-a="npcToFight" data-v="${n.id}">${IC('swords')}Add to fight</button>`:''}<button type="button" class="btn sm ghost" data-a="npcEdit" data-v="${n.id}">${IC('pen')}Edit</button></div></div>`).join('')}</div>`
      : dirs.length ? '' : `<div class="quiet"><div class="art"></div><p>${q ? 'No NPCs match.' : here ? 'This folder is empty. Press New NPC to write one here, or move an NPC in from Edit on its card.' : g.npcs.length ? 'Every NPC is in a folder.' : 'Your NPC cards live here, for your eyes only. Press New NPC to write the first one.'}</p></div>`}`}
  </div></div>`;
}
N.knownBody = knownBody;
N.npcBody = (v, n) => npcBody(v, n);
function npcBody(v, n){
  const rungs = [8,7,6,5,4,3,2,1,-1].map(x => [x, Object.entries(n.skills).filter(([,y]) => y === x).map(([k]) => k)]).filter(r => r[1].length);
  const trk = (k, l) => `<div class="trk"><span class="eyebrow">${l}</span><div class="boxes">${n.stressV[k].map((x,i)=>`<button type="button" class="sbox${n.stress[k][i]?' on':''}" data-a="npcStress" data-n="${n.id}" data-k="${k}" data-i="${i}" aria-pressed="${!!n.stress[k][i]}" aria-label="${l} ${x}">${x}</button>`).join('')}</div></div>`;
  return `<section class="pc-hero full" style="--who:var(--c-npc)">${N.av({name:n.name,portrait:n.portrait,color:'var(--c-npc)'},84)}<div style="min-width:0"><h2>${esc(n.name)}</h2><div class="by">${esc(N.npcSub(n) || 'NPC')}${n.nat?` · ${esc(n.nat)}`:''}${n.age?` · Age ${esc(n.age)}`:''} · ${n.type==='nameless'?'Nameless NPC':'Supporting NPC'}${N.nd.of(n) ? ` · ${IC('folder').replace('<svg','<svg style="width:13px;height:13px;vertical-align:-2px"')} ${esc(N.nd.name(n.dir))}` : ''}</div>${N.pcTag(n)?`<div class="hc">${esc(N.pcTag(n))}</div>`:''}</div>
    <div class="fp"><div class="res"><div><span class="eyebrow">Fate points · refresh ${n.refresh}</span><div class="coins">${Array.from({length:Math.max(n.fp, n.refresh)}, (_,i) => `<span class="coin${i<n.fp?'':' off'}"></span>`).join('')}<span class="mini"><button type="button" data-a="npcFp" data-n="${n.id}" data-d="-1" aria-label="Take a fate point from ${esc(n.name)}">−</button><button type="button" data-a="npcFp" data-n="${n.id}" data-d="1" aria-label="Give ${esc(n.name)} a fate point">+</button></span></div></div>${goldHtml(n, 'n', true)}${N.xferBtn('n', n.id)}</div><div class="gmbar"><button type="button" class="btn sm" data-a="npcEdit" data-v="${n.id}">${IC('pen')}Edit</button>${revBtn(n.id)}${N.figOk && N.figOk() ? `<button type="button" class="btn sm" data-a="figOpen" data-v="npc:${n.id}">${IC('hero')}${n.fig ? 'Figure' : 'Make figure'}</button>` : ''}${G().combat.state!=='off'?`<button type="button" class="btn sm" data-a="npcToFight" data-v="${n.id}">${IC('swords')}Add to fight</button>`:''}<button type="button" class="btn sm ghost" data-a="npcDup" data-v="${n.id}">${IC('copy')}Duplicate</button><button type="button" class="btn sm danger" data-a="sheet" data-v="npcDel" data-c="${n.id}">${IC('trash')}Delete</button></div></div></section>
    ${wikiSec(v, n.id)}
    <section class="sec"><h3>Aspects</h3><div class="asps">${asps(N.pcAspects(n).map((a,i)=>[`Aspect ${i+1}`,a])) || '<p class="muted">None yet.</p>'}</div></section>
    <section class="sec"><h3>Skills · tap one to roll</h3><div class="lad">${rungs.map(([x,ns]) => `<div class="rung${x < 0 ? ' neg' : ''}"><span class="lv"><b>${sgn(x)}</b>${ladderWord(x)}</span><span class="sks">${ns.map(k => `<button type="button" data-a="roll" data-skill="${esc(k)}" data-npc="${n.id}">${esc(k)}${N.discOf(n, k).length?`<small style="color:var(--ink-3);font-weight:600">${esc(N.discOf(n, k).join(', '))}</small>`:''}${fateDie.replace('<svg','<svg style="width:14px;height:14px;color:var(--ink-4)"')}</button>`).join('')}</span></div>`).join('')}<div class="rung"><span class="lv"><b>+0</b>Mediocre</span><span class="sks"><span class="muted" style="font-weight:600;font-size:13px;padding:8px 0">Everything else</span></span></div></div>
      ${n.magic ? `<p style="margin:10px 0 0"><b>Disciplines.</b> ${N.emoText(N.marks(esc(n.magic)))}</p>` : ''}<button type="button" class="btn sm ghost" data-a="npcEdit" data-v="${n.id}" style="justify-self:start">${IC('pen')}Change skills</button></section>
    <section class="sec"><h3>Stress</h3><div class="stress2">${trk('phys','Physical')}${trk('ment','Mental')}</div></section>
    <section class="sec"><h3>Consequences</h3><div class="cons">${N.consSlots(n.skills).map(sl => `<div class="con">${conLv(sl)}<div class="con-v"><input class="inp" id="ncon-${sl.k}-${n.id}-${v.id}" data-i="npcCon" data-n="${n.id}" data-k="${sl.k}" value="${esc(n.cons[sl.k]||'')}" placeholder="Empty">${n.cons[sl.k] ? N.conStEd(`data-n="${n.id}"`, sl, N.conSt(n, sl.k)) : ''}</div></div>`).join('')}</div></section>
    <section class="sec"><h3>Weapons and armor</h3><p class="gearln">${IC('sword')}Melee weapon <b>${sgn(+n.gearAtk||0)}</b><span class="muted">Fighting, shifts added to a hit</span></p><p class="gearln">${IC('target')}Ranged weapon <b>${sgn(+n.gearRng||0)}</b><span class="muted">Shooting, added to the roll</span></p><p class="gearln">${IC('arrowR')}Ranged ammo <b>${sgn(+n.gearAmmo||0)}</b><span class="muted">Shooting, shifts added to a hit</span></p><p class="gearln">${IC('shieldU')}Armor <b>${sgn(+n.gearDef||0)}</b><span class="muted">shifts taken off a hit</span></p></section>
    <section class="sec"><h3>Stunts</h3>${n.stunts.map(([a,b]) => `<div class="stunt"><b>${N.emoText(N.linkText(a))}</b><p>${N.emoText(N.linkText(b))}</p></div>`).join('') || '<p class="muted">None yet.</p>'}</section>
    <section class="sec"><h3>Inventory</h3>${invList(v, n, true)}</section>
    <section class="sec full"><h3>Bio</h3><textarea class="inp" id="npcbio-${n.id}-${v.id}" data-i="npcNotes" data-n="${n.id}" data-k="bio" rows="4" placeholder="Who they are, what they look like, how they talk…">${esc(n.bio)}</textarea></section>
    <section class="sec full"><h3>GM notes</h3><textarea class="inp" id="npcnotes-${n.id}-${v.id}" data-i="npcNotes" data-n="${n.id}" data-k="notes" rows="3" placeholder="Secrets, plans, who they work for. Only you see these.">${esc(n.notes)}</textarea></section>`;
}
})();
