/* Norne: every screen, rendered for the viewer (GM or player, phone or desktop). */
(function(){
const N = window.N, {esc, fmt, IC, STAR, MARK, sgn, ladderWord, rollTotal, diceSum, outcome} = N;
const G = () => N.G;
const hhmm = t => new Date(t).toLocaleTimeString([], {hour:'numeric', minute:'2-digit'});
const isGM = v => v.role === 'gm';
const pn = c => G().P[c.player]?.name || 'A former player';
const fateDie = '<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><rect x="3.5" y="3.5" width="17" height="17" rx="5"/><path d="M12 8.2v7.6M8.2 12h7.6"/></svg>';
N.fateDie = fateDie;

/* ================= shell ================= */
N.appHtml = function(v){
  const g = G(), gm = isGM(v), ph = v.dev === 'phone';
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

  return `<div class="stars" aria-hidden="true"></div>
    <div class="shell${v.dev === 'desktop' && v.ui.tab === 'chat' && N.fightAvail(v) && v.ui.fightOpen ? ' compact' : ''}${shelfOn && v.dev === 'desktop' ? ' shelved' : ''}${shelfOn && v.dev === 'desktop' && v.ui.shelfOff ? ' shelf-off' : ''}"${v.ui.shelfW ? ` style="--shelfw:${v.ui.shelfW}px"` : ''}>${nav}${shelfOn && v.dev === 'desktop' && !v.ui.shelfOff ? shelfHtml(v) : ''}${page}${tabbar}</div>
    ${shelfOn && v.dev === 'phone' && v.ui.shelf ? `<div class="scrim shelf-scrim" data-a="shelf"></div>${shelfHtml(v)}` : ''}
    ${v.ui.sheet ? `<div class="scrim" data-a="closeSheet"></div>${N.sheetHtml(v)}` : ''}
    ${v.ui.pop ? `<div class="scrim" style="background:transparent;backdrop-filter:none" data-a="closePop"></div>${popHtml(v)}` : ''}
    ${v.ui.toast ? `<div class="toast" role="status"><span class="star4"></span><span>${esc(v.ui.toast.text)}</span>${v.ui.toast.undo?'<button type="button" data-a="undo">Undo</button>':''}</div>` : ''}`;
};

function chanIcon(v, c){
  const g = G();
  if (c === 'table') return `<span class="cic">${IC('users')}</span>`;
  if (c === 'gm') return `<span class="cic">${IC('lock')}</span>`;
  if (isGM(v)) return N.av(g.P[c.slice(3)] ? N.personObj(c.slice(3)) : {name:'?'}, 24);
  return N.av(N.personObj('gm'), 24);
}
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
    if (m.kind === 'news') return 'New edition of the paper';
    if (m.kind === 'sys') return m.text || '';
    const who = m.by === v.role ? 'You' : m.kind === 'ooc' || m.kind === 'meta' ? N.personObj(m.by).name : N.speakerObj(m).name;
    return `${who}: ${m.text || ''}`;
  }
  return N.chSub(c, v.role);
}
function shelfRow(v, c){
  const n = N.unread(v.role, c), cur = v.ui.ch === c, cb = N.fightIn(c), fight = !!cb && (cb.state === 'live' || (isGM(v) && cb.state === 'setup'));
  return `<button type="button" class="shr${n&&!cur?' new':''}" data-a="ch" data-v="${c}" title="${esc(N.chName(c, v.role))}" ${cur?'aria-current="true"':''}>${chanIcon(v,c)}<span class="t"><b>${esc(N.chName(c, v.role))}</b><small>${esc(chanLast(v, c).replace(/\s+/g, ' ').slice(0, 90))}</small></span>${fight?`<span class="tag ember">${IC('swords')}</span>`:''}${n&&!cur?`<span class="badge">${n}</span>`:''}</button>`;
}
N.shelfHtml = v => shelfHtml(v);
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
      ${group(gm ? 'Private chats' : 'Just you and the GM', chs.filter(c => c.startsWith('dm-')))}
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
    return `<main class="page${sl}">${chatView(v)}${rollFx(v)}</main>`;
  }
  if (fa && v.ui.fightOpen && G().combat.state === 'live') return N.combatDesk(v);
  if (fa && v.ui.fightOpen) return `<main class="page fighting">${N.fightView(v)}${G().combat.state === 'setup' ? `<aside class="fight-chat setup-col scroll" data-sk="setup">${N.setupPanel(v)}</aside>` : `<div class="fight-chat">${chatView(v, true)}</div>`}</main>`;
  /* roleplay: the chat, the card (or GM screen) on the right, and the roleplay actions under it */
  v.ui.rpSeen = (G().msgs.findLast(m => m.ch === v.ui.ch) || {}).t || 0;
  return deskPage(v, chatView(v), `<div class="rail-a scroll" data-sk="rail">${gm ? gmScreen(v) : heroQuick(v)}</div>`, 'rp');
}
/* desktop: the big panel (C) on the left, and on the right the top panel (A) over the actions (B).
   The line on the right side's left edge drags to share the width; roleplay and combat remember their own widths. */
function deskPage(v, c, a, mode, cls){
  /* every line between panels drags and every panel beside the main one folds; roleplay and combat remember their own sizes */
  const rp = mode === 'rp', off = v.ui.recentOff, wk = rp ? 'railW' : 'railWc', hk = rp ? 'rcH' : 'rcHc', ok = rp ? 'railOff' : 'railOffc';
  const w = v.ui[wk] || (!rp && isGM(v) ? 560 : 0), h = v.ui[hk];
  if (v.ui[ok]) return `<main class="page with-rail rail-off${cls ? ' ' + cls : ''}">${c}<aside class="rail"><button type="button" class="railopen" data-a="railFold" data-v="${ok}" aria-label="Show the side panel" title="Show the side panel">${IC('left')}<span>${rp ? 'Card and actions' : 'Fight panel'}</span></button></aside></main>`;
  return `<main class="page with-rail${cls ? ' ' + cls : ''}" data-wk="${wk}" data-hk="${hk}"${w ? ` style="--railw:${w}px"` : ''}>${c}<aside class="rail${off ? ' rc-off' : ''}"${h && !off ? ` style="--rch:${h}px"` : ''}>
    <div class="railgrip" role="separator" aria-orientation="vertical" aria-label="Drag to resize the side panel" title="Drag to resize"></div>
    <button type="button" class="railx" data-a="railFold" data-v="${ok}" aria-label="Hide the side panel" title="Hide the side panel">${IC('right')}</button>
    ${a}
    <section class="rcnt">${off ? '' : '<div class="rowgrip" role="separator" aria-orientation="horizontal" aria-label="Drag to resize" title="Drag to resize"></div>'}<button type="button" class="rc-h" data-a="recentFold" aria-expanded="${!off}">${IC(rp ? 'dice' : 'swords')}<b>${rp ? 'Recent actions' : 'Fight results and chat'}</b>${IC('caret').replace('<svg', `<svg style="rotate:${off ? 0 : 180}deg"`)}</button>
      ${off ? '' : N.recentHtml(v, mode) + (mode === 'cb' ? fightComposer(v) : '')}</section>
  </aside></main>`;
}
/* desktop, when this chat has a fight: one switch between the roleplay screen and the combat screen.
   In combat a count shows talk that came in since the roleplay screen was last open. */
function modeSeg(v){
  const cb = v.ui.fightOpen, g = G();
  const n = cb ? g.msgs.filter(m => m.ch === v.ui.ch && m.by !== v.role && m.t > (v.ui.rpSeen || 0) && !isAction(m) && m.kind !== 'scene').length : 0;
  return `<div class="seg modeseg" role="group" aria-label="Screen"><button type="button" data-a="mode" data-v="rp" aria-pressed="${!cb}">${IC('chatL')}Roleplay${n ? `<i class="nb">${n}</i>` : ''}</button><button type="button" data-a="mode" data-v="cb" aria-pressed="${!!cb}">${IC('swords')}Combat</button></div>`;
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
  const fa = fightAvail(v);
  const topPh = `<div class="top ph">${shelfBtn(v)}${fa ? `<div style="flex:1;display:flex;justify-content:center">${fightSeg(v)}</div>` : `<button type="button" class="chname" data-a="shelf">${chanIcon(v,ch)}<span><b>${esc(N.chName(ch, v.role))}</b><small>${esc(N.chSub(ch, v.role))}</small></span></button>`}${sideBtn(v, 'chat')}</div>`;
  const topDt = side ? '' : `<header class="top dt"><div style="flex:1;min-width:0"><h1>${esc(N.chName(ch, v.role))}</h1><span class="sub">${esc(N.chSub(ch, v.role))}</span></div>
    ${gm ? `<button type="button" class="ibtn" data-a="sheet" data-v="export" aria-label="Export the log" title="Export the log">${IC('export')}</button>` : ''}
    ${fa ? (cb.state === 'setup' ? `<button type="button" class="btn sm" data-a="openFight" style="--h:36px">${IC('swords')}Back to fight setup</button>` : modeSeg(v)) : ''}</header>`;
  const fightbar = (cb.state === 'live' && ch === N.fightCh() && !N.owedTok(v) && !fa) ? (() => {
    const cur = N.curTok();
    return `<div class="fightbar">${IC('swords','sw')}<div class="t">Fight on ${esc(cb.title)}<span>${cur ? `${esc(N.tokName(cur))}’s turn · exchange ${cb.exchange}` : ''}</span></div>${fa ? `<button type="button" class="btn sm gold" data-a="openFight">Back to the fight</button>` : `<button type="button" class="btn sm" data-a="watch">Watch</button>`}</div>`;
  })() : '';
  /* an attack waiting on this screen's defense shows above the chat too, so it isn't missed with the board closed */
  const owed = N.owedTok(v), pend = cb.pending;
  const owedBar = owed ? (pend.stage === 'defend'
    ? `<div class="fightbar owed">${IC('attack','sw')}<div class="t">${esc(N.tokName(N.tokById(pend.att)))} attacks ${gm ? esc(N.tokName(owed)) : 'you'}!<span>${esc(pend.skill)} for ${sgn(pend.total)} ${ladderWord(pend.total)}. Roll the defense.</span></div>${N.defBtn(owed)}</div>`
    : `<div class="fightbar owed">${IC('warn','sw')}<div class="t">${gm ? esc(N.tokName(owed)) + ' takes' : 'You take'} ${pend.shifts} shift${pend.shifts>1?'s':''}<span>Pick a stress box or a consequence on the board.</span></div><button type="button" class="btn sm gold" data-a="openFight">Soak the hit</button></div>`) : '';
  const chipRow = (!side && fa) ? `<div class="chname-row only-ph"><button type="button" class="chname" data-a="shelf">${chanIcon(v,ch)}<span><b>${esc(N.chName(ch, v.role))}</b></span>${IC('caret')}</button></div>` : '';
  return `<section class="chat" aria-label="${esc(N.chName(ch, v.role))}">
    ${side ? '' : topPh}${chipRow}${topDt}
    ${side ? '' : sceneBanner(v, sc, ch)}
    <div class="msgs scroll" id="msgs-${v.id}" data-sk="msgs" data-bottom="1">${fightbar && side ? '' : ''}${renderMsgs(v, side)}</div>
    ${fightbar && !side ? '' : ''}
    ${composer(v)}
  </section>`.replace('<div class="msgs', (!side ? owedBar || fightbar : '') + '<div class="msgs');
}
function fightSeg(v){
  const n = N.unread(v.role, N.fightCh());
  /* the same Roleplay | Combat switch as on a computer */
  return `<div class="seg modeseg" role="group" aria-label="Screen"><button type="button" data-a="pane" data-v="chat" aria-pressed="${v.ui.fightPane==='chat'}">${IC('chatL')}Roleplay${n&&v.ui.fightPane!=='chat'?'<span class="dot"></span>':''}</button><button type="button" data-a="pane" data-v="fight" aria-pressed="${v.ui.fightPane==='fight'}">${IC('swords')}Combat</button></div>`;
}
N.sceneArt = (sc) => {
  if (!sc) return '';
  if (sc.place) { const mp = G().maps.find(m => m.id === sc.place.map), u = mp ? N.imgUrl(mp.src) : ''; return `background-image:${u ? `url(${u})` : 'none'};background-size:420% auto;background-position:${(sc.place.rx*100).toFixed(1)}% ${(sc.place.ry*100).toFixed(1)}%`; }
  return '';
};
/* a scene's own picture (not a map place) sits inside its box as a framed layer */
N.scenePic = sc => sc && !sc.place ? N.bgPic(sc.art) : '';
function sceneBanner(v, sc, ch){
  const gm = isGM(v), priv = ch.startsWith('dm-');
  if (!sc) {
    if (!gm || ch === 'gm') return '';
    return `<section class="scene empty"><div class="in" style="grid-template-columns:auto 1fr auto;display:grid;align-items:center;gap:12px"><span class="cic" style="width:34px;height:34px;border-radius:50%;display:grid;place-items:center;background:var(--sunk);color:var(--gold-tx)">${IC('image')}</span><h2>No scene in this chat yet</h2><button type="button" class="btn sm primary" data-a="sheet" data-v="scene">Set the scene</button></div></section>`;
  }
  const min = v.ui.sceneMin;
  const onlyWho = priv ? (gm ? `Only ${esc(G().P[ch.slice(3)]?.name || 'them')} sees this scene` : 'Your private scene') : '';
  return `<section class="scene${min?' min':''}" aria-label="Scene">
    <div class="art${sc.place?' map':''}" style="${N.sceneArt(sc)}">${N.scenePic(sc)}</div>
    <div class="in">
      ${min ? `<span class="star4"></span>` : `<span class="eyebrow">${STAR.replace('<svg','<svg style="width:11px;height:11px"')}<span>${priv ? onlyWho : 'Scene'}</span>${sc.date?`<span style="color:var(--ink-3);letter-spacing:.1em">· ${esc(sc.date)}</span>`:''}</span>`}
      <h2>${esc(sc.title)}</h2>
      <span class="where">${esc(sc.where||'')}</span>
      ${sc.aspects?.length ? `<div class="icards">${sc.aspects.map((a,i)=>{ const f = N.sceneFreeLeft(sc, i); return `<span class="icard" style="--rot:${i%2?.8:-.9}deg">${esc(a.t)}${f?`<span class="fi">${'<i></i>'.repeat(f)}</span>`:''}</span>`; }).join('')}</div>` : ''}
    </div>
    <div class="ctl">${gm ? `<button type="button" class="btn sm" data-a="sheet" data-v="scene">${IC('image')}<span class="only-dt">Change scene</span><span class="only-ph">Scene</span></button>` : ''}<button type="button" class="btn sm" data-a="sceneMin" aria-label="${min?'Show the scene':'Shrink the scene'}" style="padding:0 9px">${IC(min?'caret':'caret').replace('<svg', `<svg style="rotate:${min?0:180}deg"`)}</button></div>
  </section>`;
}
/* fight rolls, fight results and table notices; on a computer they live in the side panel's Recent actions instead of the chat */
function isAction(m){
  return m.kind === 'sys' || m.kind === 'fight' || m.kind === 'combat' || m.kind === 'roll';
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
/* the actions leave the chat only while Recent actions is there to show them */
const actionsOut = (v, side) => !side && v.dev === 'desktop' && v.ui.tab === 'chat' && railShown(v) && !v.ui.recentOff;
N.isAction = isAction; N.isFightAct = isFightAct; N.hhmm = hhmm;
function renderMsgs(v, side){
  const g = G(), out1 = actionsOut(v, side), ms = g.msgs.filter(m => m.ch === v.ui.ch && !(m.kind === 'scene' && (m.quiet || !m.scene)) && !m.fc && !(out1 && isAction(m)) && !(v.dev === 'phone' && isFightAct(m)));
  if (!ms.length) return `<div class="quiet"><div class="art"></div><p>${v.ui.ch.startsWith('dm-') ? 'Nothing here yet. Anything said here stays between you two.' : 'Nothing here yet.'}</p></div>`;
  let out = '', prev = null, firstNarr = true;
  /* only the newest roll in a chat starts open; a roll someone opened or closed by hand stays that way */
  v._lastRoll = (ms.findLast(m => m.kind === 'roll') || {}).id;
  const seen = (g.seen[v.role] || {})[v.ui.ch] || 0; let divDone = false;
  for (const m of ms) {
    if (!divDone && m.by !== v.role && m.t > seen && seen > 0 && v.ui.showNew) { out += `<div class="day-div" style="color:var(--ember)">New</div>`; divDone = true; }
    const h = rMsg(v, m, m.re ? null : prev, firstNarr);
    out += h ? msgWrap(v, m, h) : h;
    if (m.kind === 'rp' && m.by === 'gm' && m.as === 'Narrator') firstNarr = false;
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
  const narr = m.kind === 'rp' && !!N.speakerObj(m).narr, mine = m.by === v.role && !narr;
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
  return `<button type="button" class="rq" data-a="jumpMsg" data-v="${o.id}">${IC('reply')}<b style="--who:${N.msgColor(o)}">${esc(N.msgWho(o))}</b><span>${N.emoText(esc(N.msgSnip(o)))}</span></button>`;
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
  const g = G(), mine = m.by === v.role, time = `<time>${hhmm(m.t)}</time>`, txt = N.emoText(fmt(m.text)) + (m.ed ? ' <span class="ed">edited</span>' : '');
  if (m.kind === 'sys') return m.res ? resCard(m.res) : m.fightEnd ? `<button type="button" class="sysm fend" data-a="sheet" data-v="fightRec" data-c="${m.fightEnd}">${IC('swords')}<span>${esc(m.text)}</span><b>See what happened</b></button>` : `<div class="sysm">${IC('sparkle')}<span>${esc(m.text)}</span></div>`;
  if (m.kind === 'scene') { const sc = m.scene; if (!sc) return ''; return `<div class="scenem"><span class="th" style="${N.sceneArt(sc)}">${N.scenePic(sc)}</span><span><span>New scene</span><b>${esc(sc.title)}</b></span></div>`; }
  if (m.kind === 'note') return `<div class="m mine gmv"><div class="body"><div class="who" style="--who:var(--ink-3)">${IC('lock').replace('<svg','<svg style="width:12px;height:12px"')}Note to self ${time}</div><div class="bub" style="background:var(--raise);color:var(--ink);box-shadow:inset 0 0 0 1px var(--line-2)">${txt}</div></div></div>`;
  if (m.kind === 'fight' || m.kind === 'combat') return fightCard(v, m);
  if (m.kind === 'news') return `<div class="fightcard" style="box-shadow:0 0 0 1px color-mix(in srgb,var(--gold) 45%,transparent),0 18px 40px -18px rgba(0,0,0,.9)"><div class="in" style="padding-top:18px;grid-template-columns:auto 1fr;align-items:center"><div class="herald" style="all:unset;display:contents"><span class="np" style="width:54px;height:66px;border-radius:4px;background:#efe6cc;rotate:-4deg;display:grid;place-items:center;font:400 12px/1 var(--f-mast);color:#2a2418;box-shadow:0 6px 14px -6px rgba(0,0,0,.7)">News</span></div><div style="display:grid;gap:6px"><span class="eyebrow" style="color:var(--gold-tx)">${IC('newsL')}New edition</span><h3 style="font-size:18px">${esc(m.text)}</h3><div class="row"><button type="button" class="btn sm gold" data-a="readNews" data-id="${esc(m.nid||'')}">Read it</button></div></div></div></div>`;
  if (m.kind === 'roll' && v.dev === 'phone') return rollLine(v, m);
  if (m.kind === 'roll') {
    const pc = (m.roll.whoKey || '').startsWith('pc:') && g.chars[m.roll.whoKey.slice(3)];
    const s = pc ? {name:pc.short, portrait:pc.built ? pc.portrait : null, color:pc.color} : m.by === 'gm' ? {name:m.roll.who, color:'var(--c-npc)', portrait:m.pt || N.npcByName(m.roll.who.replace(/ \d+$/,''))?.portrait} : N.speakerObj({by:m.by, as:''});
    return `<div class="m rollm${mine?' mine':''}">${N.av(s,32)}<div class="body"><div class="who" style="--who:${s.color}">${esc(m.roll.who)}${m.ch==='gm'?'<span class="tag gold">Secret</span>':''}${time}</div>${rRoll(v, m)}</div></div>`;
  }
  const cont = prev && prev.by === m.by && prev.kind === m.kind && (prev.as||'') === (m.as||'') && m.t - prev.t < 180000 && m.kind !== 'scene';
  if (m.kind === 'gif') {
    const p = N.personObj(m.by), gf = m.gif || {};
    /* GIFs are always table talk: posted as the person, never as a character */
    return `<div class="m ooc gifm${mine?' mine':''}">${N.av(p,32)}<div class="body"><div class="who" style="--who:var(--ink-3)">${esc(p.name)}<span class="tag">Meta</span> ${time}</div><div class="gifbox"><img class="gif" src="${esc(gf.u)}" alt="GIF" loading="lazy" ${gf.w && gf.h ? `style="aspect-ratio:${+gf.w}/${+gf.h}"` : ''}></div></div></div>`;
  }
  if (m.kind === 'ooc' || m.kind === 'meta') {
    const p = N.personObj(m.by);
    const big = N.emojiOnly(m.text);
    return `<div class="m ${big ? 'emom' : 'ooc'}${mine?' mine':''}${cont?' cont':''}">${N.av(p,32)}<div class="body">${cont?'':`<div class="who" style="--who:var(--ink-3)">${esc(p.name)} ${time}</div>`}<div class="${big ? 'bigemo' : 'bub'}">${txt}</div></div></div>`;
  }
  const s = N.speakerObj(m);
  if (s.narr) return `<div class="narr${firstNarr?' first':''}"><div class="who">${STAR.replace('<svg','<svg style="width:11px;height:11px"')}Narrator ${time}</div><p>${txt}</p></div>`;
  const gmv = mine && isGM(v) ? ' gmv' : '';
  return `<div class="m say${s.npc?' npc':''}${mine?' mine':''}${gmv}${cont?' cont':''}" style="--spk:${s.color}">${N.av(s,32)}<div class="body">${cont?'':`<div class="who" style="--who:${s.color}">${esc(s.name)}${s.npc?'<span class="tag">NPC</span>':''} ${time}</div>`}<div class="bub">${N.emoText(sayFmt(m.text)) + (m.ed ? ' <span class="ed">edited</span>' : '')}</div></div></div>`;
}
/* roleplay lines: words "in quotes" are spoken and read normally, everything else is description in the story font */
const QUOTE = /"[^"]*(?:"|$)|“[^”]*(?:”|$)/g;
function sayFmt(t){
  const s = String(t ?? ''), act = x => x.trim() ? `<span class="rpd">${fmt(x)}</span>` : fmt(x);
  let out = '', at = 0;
  for (const q of s.matchAll(QUOTE)) { out += act(s.slice(at, q.index)) + fmt(q[0]); at = q.index + q[0].length; }
  return out + act(s.slice(at));
}
/* phones: a roll in the roleplay chat is one small line; tapping it opens the full card */
/* a roleplay roll the GM made against an NPC card and/or a skill: "against Brannoc (Will)" */
const vsLabel = r => r.vs ? ` against ${r.vs.name ? `<b>${esc(r.vs.name)}</b>${r.vs.skill ? ` (${esc(r.vs.skill)})` : ''}` : `<b>${esc(r.vs.skill)}</b>`}` : '';
function rollLine(v, m){
  const r = m.roll, tot = rollTotal(r), o = outcome(r), fx = v._rfx && v._rfx.id === m.id && Date.now() - v._rfx.at < RFX_MS;
  return `<button type="button" class="rl${fx ? ' fx' : ''}" ${fx ? `style="--el:-${Date.now() - v._rfx.at}ms"` : ''} data-a="sheet" data-v="rollCard" data-c="${m.id}" aria-label="${esc(r.who)} rolled ${sgn(tot)}. Open the roll">
    <span class="rld">${r.dice.map(d => `<i class="${d>0?'p':d<0?'m':'z'}">${d>0?'+':d<0?'−':''}</i>`).join('')}</span><span class="rlt"><b>${esc(r.who)}</b> ${esc(r.skill)} · ${esc(r.action.toLowerCase())}${r.vs?.name?` vs ${esc(r.vs.name)}`:''}${m.ch==='gm'?' · secret':''}</span><b class="rlv">${sgn(tot)}${r.opp!=null?`<small>vs</small>${sgn(r.opp)}`:''}</b>${o ? `<span class="out ${o.k}">${o.t}</span>` : ''}</button>`;
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
  return `<div class="rfx" style="--el:-${Date.now() - f.at}ms" aria-hidden="true"><div class="grp"><div class="rtray">${r.dice.map(cube).join('')}</div><div class="rfx-t"><small>${esc(r.who)} · ${esc(r.skill)}</small><b>${sgn(tot)} <span>${ladderWord(tot)}</span></b></div></div></div>`;
}
N.RFX_MS = RFX_MS;
function rRoll(v, m){
  const r = m.roll, tot = rollTotal(r), o = outcome(r), fold = v.ui.folded.has(m.id) ? v.ui.folded.get(m.id) : m.id !== v._lastRoll;
  const dice = r.dice.map(d => `<span class="die ${d>0?'p':d<0?'m':'z'}">${d>0?'+':d<0?'−':'·'}</span>`).join('');
  const canInv = isGM(v) || (r.whoKey === 'pc:' + (G().P[v.role]||{}).char && m.by === v.role);
  return `<div class="roll${fold?' folded':''}${m.ch==='gm'?' secret':''}">
    <div class="rh"><span class="grow"><b>${esc(r.skill)} ${sgn(r.bonus - (r.gear||0))}</b>${r.gear?` + gear ${sgn(r.gear)}`:''} · ${esc(r.action)}${r.target?` ${r.action==='Defend'?'against':'on'} <b>${esc(r.target)}</b>`:''}${vsLabel(r)}</span>${fold?`<span class="mini-tot">${sgn(tot)}${r.opp!=null?` <small>vs</small> ${sgn(r.opp)}`:''}</span>`:''}<button type="button" class="ibtn sm" data-a="fold" data-id="${m.id}" data-f="${fold?1:''}" aria-label="${fold?'Expand':'Collapse'} roll">${IC('caret').replace('<svg',`<svg style="rotate:${fold?0:180}deg"`)}</button></div>
    <div class="rb"><div class="dice${v.ui.fresh===m.id?' fresh':''}">${dice}</div>${r.opp!=null ? `<div class="tot vs"><span class="n"><b>${sgn(tot)}</b><span>${ladderWord(tot)}</span></span><i>vs</i><span class="n opp"><b>${sgn(r.opp)}</b><span>${ladderWord(r.opp)}</span></span></div>` : `<div class="tot"><b>${sgn(tot)}</b><span>${ladderWord(tot)}</span></div>`}</div>
    ${r.oppDice ? `<div class="oppd">${esc(r.vs?.name || 'The other side')} rolled <span class="od">${r.oppDice.map(d => `<span class="${d>0?'op':d<0?'om':'oz'}">${d>0?'+':d<0?'−':''}</span>`).join('')}</span> ${sgn(diceSum({dice:r.oppDice}))} on ${r.vs?.skill ? esc(r.vs.skill) + ' ' : ''}${sgn(r.oppBase)} = <b>${sgn(r.opp)}</b></div>` : ''}
    ${r.invokes.length ? `<div class="inv">${r.invokes.map(i => i.reroll ? `Rerolled with “${esc(i.aspect)}” (was ${sgn(i.was ? i.was.reduce((a,b)=>a+b,0) : 0)})` : `+2 from “${esc(i.aspect)}”`).join(' · ')}</div>` : ''}
    <div class="rf"><span class="math">Dice ${sgn(diceSum(r))} · ${esc(r.skill)} ${sgn(r.bonus - (r.gear||0))}${r.gear?` · gear ${sgn(r.gear)}`:''}${N.plusInvokes(r)?` · invokes +${2*N.plusInvokes(r)}`:''}</span>${o?`<span class="out ${o.k}">${o.t}${o.sh?` · ${o.sh>0?'+':'−'}${Math.abs(o.sh)}`:''}</span>`:''}${canInv && m.ch!=='gm' ? `<button type="button" class="btn sm" data-a="invoke" data-id="${m.id}" style="--h:28px">${IC('cards')}Invoke</button>` : ''}</div>
  </div>`;
}
/* the result of a fight step, posted once the dice are in: an attack against a defense, or the turn order */
function resCard(res){
  if (res.k === 'order') return `<div class="resm"><div class="rs-h">${IC('clock')}<b>Turn order</b><small>Notice rolls</small></div>
    <ol class="rs-rows">${(res.rows||[]).map(x => `<li><span class="nm">${esc(x.n)}</span><span class="mt">Notice ${sgn(x.sk)} · dice ${sgn((x.d||[]).reduce((a,b)=>a+b,0))}</span><b>${sgn(x.tot)}</b></li>`).join('')}</ol></div>`;
  const row = (x, lab) => `<li><span class="nm"><small>${lab}</small>${esc(x.n)}</span><span class="mt">${esc(x.sk)} ${sgn(x.b - (x.g||0))}${x.g?` · gear ${sgn(x.g)}`:''}</span><b>${sgn(x.tot)}<small>${ladderWord(x.tot)}</small></b></li>`;
  const [a, d] = res.rows || [];
  return `<div class="resm ${res.out?.k||''}"><div class="rs-h">${IC('swords')}<b>${esc(res.title)}</b></div>
    <ul class="rs-rows">${a ? row(a, 'Attack') : ''}${d ? row(d, 'Defense') : ''}</ul>
    ${res.calc ? `<div class="rs-calc">${IC('sword')}${esc(res.calc)}</div>` : ''}
    <div class="rs-out"><span class="out ${res.out?.k === 'hit' ? 'fail' : res.out?.k === 'tie' ? 'tie' : 'succ'}">${esc(res.out?.t || '')}</span><span>${esc(res.after || '')}</span></div></div>`;
}
function fightCard(v, m){
  const g = G(), cb = g.combat, live = cb.state === 'live' && cb.id === m.cid, gm = isGM(v);
  const toks = cb.tokens.filter(t => t.zone);
  const mine = !gm && !!N.myTok(v);
  return `<div class="fightcard"><div class="art">${(b => N.bgPic(N.imgUrl(b) ? b : N.FIGHTBG))(m.bg || (live ? cb.bg : ''))}</div><div class="in">
    <span class="eyebrow">${IC('swords')}${live?'A fight breaks out':'The fight is over'}</span>
    <h3>${esc(m.text)}</h3>
    ${live ? `<div class="who">${toks.slice(0,6).map(t => N.av(N.tokObj(t),28)).join('')}<span>${toks.length} in the fight · ${cb.zones.length} zones</span></div>
    <div class="row">${gm ? `<button type="button" class="btn gold" data-a="openFight">${IC('swords')}Open the fight</button>` : mine ? `<button type="button" class="btn gold" data-a="watch">${IC('swords')}Watch the fight</button>` : `<button type="button" class="btn" data-a="watch">Watch</button>`}</div>` : '<span class="muted" style="font-weight:600">This fight is over.</span>'}
  </div></div>`;
}
function composer(v){
  const g = G(), gm = isGM(v), ooc = v.ui.mode === 'ooc';
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
  return `<form class="composer${ooc?' ooc':''}" data-f="send" onsubmit="return false">
    ${re ? `<div class="replying">${IC('reply')}<span>Replying to <b>${esc(N.msgWho(re))}</b><small>${N.emoText(esc(N.msgSnip(re)))}</small></span><button type="button" class="ibtn sm" data-a="replyOff" aria-label="Stop replying">${IC('x')}</button></div>` : ''}
    <div class="box">
      ${v.ui.ch === 'gm' ? `<span class="voice">${chip}</span>` : gm ? `<button type="button" class="voice" data-a="pop" data-v="voice" aria-label="Who you speak as">${chip}${IC('caret','car')}</button>`
        : `<button type="button" class="voice flip" data-a="voice" data-v="__flip" aria-label="${ooc ? 'Speaking Meta (out of character). Tap to speak in character' : 'Speaking in character. Tap to switch to Meta'}" title="Tap to switch">${chip}${IC('swap','car')}</button>`}
      <textarea id="ta-${v.id}" rows="1" data-i="draft" placeholder="${esc(ph)}" aria-label="Message" enterkeyhint="${N.enterSends() ? 'send' : 'enter'}">${esc(v.ui.draft)}</textarea>
      <button type="button" class="emob" data-a="pop" data-v="emo" aria-label="Emoji" title="Emoji">${IC('smile')}</button>
      ${isGM(v) ? `<button type="button" class="diceb" data-a="roll" aria-label="Roll the dice" title="Roll">${fateDie}</button>` : ''}
      <button type="button" class="sendb" data-a="send" aria-label="Send">${IC('send')}</button>
    </div>
    ${N.enterSends() ? '<div class="nlhint"><b>Enter</b> sends · <b>Shift + Enter</b> for a new line</div>' : ''}
  </form>`;
}

/* ================= side panels ================= */
function gmScreen(v){
  const g = G(), ch = v.ui.ch, here = ch === 'gm' ? 'table' : ch, fights = N.allFights();
  /* one fight per chat: every running fight gets a button, and the open chat can start one if it has none */
  const where = c => c === 'table' ? 'Everyone' : `your chat with ${esc(N.chName(c,'gm'))}`;
  const fight = Object.entries(fights).sort(([a],[b]) => (a !== 'table') - (b !== 'table') || a.localeCompare(b)).map(([c, cb]) => {
    const o = N.order(cb), cur = cb.state === 'live' && cb.phase !== 'notice' && o.length ? o[cb.turn % o.length] : null;
    return `<button type="button" class="bigcta" data-a="openFight" data-v="${c}"><span class="ic">${IC('swords')}</span><span><b>${cb.state==='setup'?'Fight setup':'Fight on '+esc(cb.title)}</b><small>In ${where(c)} · ${cb.state==='setup'?'Not started yet. Players can’t see it.':`Exchange ${cb.exchange}${cur ? ` · ${esc(N.tokName(cur))}’s turn` : ''}`}</small></span></button>`;
  }).join('') + (fights[here] ? '' : `<button type="button" class="bigcta" data-a="cbBegin"><span class="ic">${IC('swords')}</span><span><b>${Object.keys(fights).length ? 'Begin another fight' : 'Begin a fight'}</b><small>In ${where(here)}. Draw zones and add enemies. Players see nothing until you start.</small></span></button>`);
  const pcs = N.pcs(), npc1 = g.npcs[0], waiting = N.MEMBERS.filter(m => m.role === 'pending').length;
  const tiles = [['roll', 'eyeoff', 'Secret roll', 'data-secret="1"'], ['roll', 'dice', 'Roll for an NPC', npc1 ? `data-npc="${npc1.id}"` : ''], ['npcNew', 'npc', 'New NPC', ''],
    ['writeNews', 'newsL', 'Write news', ''], ['wNew', 'quill', 'New wiki entry', ''], ['mapEditGo', 'map', 'Edit the map', ''],
    ['sheet', 'userplus', waiting ? `Players · ${waiting} waiting` : 'Players', 'data-v="players"'], ['sheet', 'export', 'Export the log', 'data-v="export"'], ['sheet', 'smile', 'Emoji and GIFs', 'data-v="emoji"'], ['sheet', 'upload', 'Import lore', 'data-v="import"']];
  const scenes = ['table', ...N.seats().map(x => 'dm-' + x)].filter(c => g.scenes[c]).length;
  return `<div class="gs">
    ${fight}
    <button type="button" class="bigcta scn" data-a="sheet" data-v="scene"><span class="ic">${IC('image')}</span><span><b>Scene changer</b><small>Pick who it’s for, Everyone or one player, then set the picture, name and aspects.${scenes ? ` ${scenes} chat${scenes > 1 ? 's have' : ' has'} a scene now.` : ''}</small></span></button>
    <section class="gs-sec gs-tools"><div class="gs-h"><h3>GM tools</h3></div>
      <div class="tools">${tiles.map(([a, ic, l, x]) => `<button type="button" data-a="${a}" ${x}>${IC(ic)}${l}</button>`).join('')}</div>
    </section>
    <section class="gs-sec"><div class="gs-h"><h3>Party</h3><button type="button" class="btn sm" data-a="tab" data-v="cast">Cast</button></div>
      ${pcs.map(c => c.built ? `<div class="pcrow">${N.av(c,40)}<span><b>${esc(c.short)}</b><small>${esc(N.pcTag(c))}</small></span>
        <span class="coins">${coinsHtml(c, true)}</span>
        <div class="tracks"><span>Phys</span><div class="boxes">${c.stressV.phys.map((x,i)=>`<button type="button" class="sbox${c.stress.phys[i]?' on':''}" data-a="stress" data-c="${c.id}" data-k="phys" data-i="${i}" aria-pressed="${c.stress.phys[i]}">${x}</button>`).join('')}</div>
        <span>Mind</span><div class="boxes">${c.stressV.ment.map((x,i)=>`<button type="button" class="sbox${c.stress.ment[i]?' on':''}" data-a="stress" data-c="${c.id}" data-k="ment" data-i="${i}" aria-pressed="${c.stress.ment[i]}">${x}</button>`).join('')}</div></div></div>`
        : `<div class="pcrow" style="background:transparent;box-shadow:inset 0 0 0 1.5px var(--line-2)">${N.av({name:pn(c),color:c.color},40)}<span><b>${esc(pn(c))}</b><small>No card yet</small></span><button type="button" class="btn sm primary" data-a="pcEdit" data-v="${c.id}">Make card</button></div>`).join('')}
    </section>
    <section class="gs-sec"><div class="gs-h"><h3>Speak as</h3><button type="button" class="btn sm" data-a="castNpcs">NPCs</button></div>
      <div class="voices">${['Narrator', ...N.voices()].map(n => { const npc = N.npcByName(n); return `<button type="button" data-a="voice" data-v="${esc(n)}" ${v.ui.voice===n&&v.ui.mode==='rp'?'style="background:var(--accent-soft)"':''}>${n==='Narrator'?N.narrAv(30):N.av({name:n,portrait:npc?.portrait,color:'var(--c-npc)'},30)}<span>${esc(n)}<small>${n==='Narrator'?'Story text':esc(N.npcSub(npc))}</small></span>${v.ui.voice===n&&v.ui.mode==='rp'?`<span class="go" style="color:var(--gold-tx)">${IC('check')}</span>`:''}</button>`; }).join('')}</div>
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
  const ph = v.dev === 'phone', cur = v.ui.ch === 'gm' ? 'table' : v.ui.ch;
  const chans = N.channelsFor('gm').filter(c => c !== 'gm');
  const top = ph ? `<div class="top ph">${meBtn(v)}<h1>GM screen</h1></div>` : `<div class="top dt" style="display:flex"><h1>GM screen</h1></div>`;
  const forRow = `<section class="gs-sec gm-for"><div class="gs-h"><h3>Working in</h3></div><div class="seg" role="group" aria-label="Chat">${chans.map(c => `<button type="button" data-a="gmFor" data-v="${c}" aria-pressed="${cur===c}">${c === 'table' ? IC('users') : ''}${esc(N.chName(c,'gm'))}</button>`).join('')}</div></section>`;
  return `<div class="scroll" data-sk="gmp" style="min-height:0">${top}<div class="gm-page">${gmScreen(v).replace('<div class="gs">', '<div class="gs">' + forRow)}</div></div>`;
}
function coinsHtml(c, edit){
  const n = Math.max(c.fp, c.refresh);
  return Array.from({length:n}, (_,i) => `<span class="coin${i<c.fp?'':' off'}"></span>`).join('') + (edit ? `<span class="mini"><button type="button" data-a="fp" data-c="${c.id}" data-d="-1" aria-label="Take a fate point">−</button><button type="button" data-a="fp" data-c="${c.id}" data-d="1" aria-label="Give a fate point">+</button></span>` : '');
}
N.coinsHtml = coinsHtml; N.rRoll = rRoll; N.resCard = resCard;
function heroQuick(v){
  const g = G(), c = N.charOf(v.role);
  if (!c.built) return `<div class="gs"><div class="quiet"><div class="art"></div><p>${esc(N.gmName())} hasn’t made your character card yet. It shows up here as soon as it’s ready.</p></div></div>`;
  const top = Object.entries(c.skills).sort((a,b)=>b[1]-a[1]).slice(0,6);
  return `<div class="gs">
    <div class="hero-top">${N.av(c,58)}<span><b>${esc(c.name)}</b><small>${esc(N.pcTag(c))}</small></span></div>
    <section class="gs-sec"><div class="gs-h"><h3>Fate points</h3><span class="muted" style="font-weight:700;font-size:12px">Refresh ${c.refresh}</span></div><div class="coins">${coinsHtml(c,false)}</div></section>
    <section class="gs-sec"><div class="gs-h"><h3>Aspects</h3></div><div class="icards">${N.pcAspects(c).map((a,i)=>[`Aspect ${i+1}`,a]).map(([k,a],i)=>`<span class="icard" style="--rot:${[-.8,.7,-.4][i%3]}deg"><span class="k">${k}</span>${esc(a)}</span>`).join('')}</div></section>
    <section class="gs-sec"><div class="gs-h"><h3>Top skills</h3></div><div class="quick-sk">${top.map(([n,x])=>`<span>${esc(n)}<i>${sgn(x)}</i></span>`).join('')}</div></section>
    <section class="gs-sec"><div class="gs-h"><h3>Stress</h3></div>
      <div class="pcrow" style="grid-template-columns:auto 1fr"><div class="tracks" style="grid-column:1/-1"><span>Phys</span><div class="boxes">${c.stressV.phys.map((x,i)=>`<span class="sbox${c.stress.phys[i]?' on':''}">${x}</span>`).join('')}</div><span>Mind</span><div class="boxes">${c.stressV.ment.map((x,i)=>`<span class="sbox${c.stress.ment[i]?' on':''}">${x}</span>`).join('')}</div></div></div>
    </section>
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
function popHtml(v){
  const p = v.ui.pop, g = G();
  const pos = `left:${p.x}px;${p.up ? `bottom:${p.y}px` : `top:${p.y}px`}`;
  if (p.type === 'voice') {
    const gm = isGM(v);
    let opts = '';
    if (gm) {
      const all = ['Narrator', ...N.voices()], vq = (v.ui.voiceQ || '').trim().toLowerCase();
      if (all.length > 5) opts += `<div class="pop-find">${IC('search')}<input class="inp" id="vq-${v.id}" data-i="voiceQ" placeholder="Find a voice" value="${esc(v.ui.voiceQ || '')}" autocomplete="off"></div>`;
      opts += `<div class="lbl">In character</div>` + all.filter(n => !vq || n.toLowerCase().includes(vq)).map(n => { const npc = N.npcByName(n); const sel = v.ui.mode==='rp' && v.ui.voice===n; return `<button type="button" class="opt" data-a="voice" data-v="${esc(n)}" aria-selected="${sel}">${n==='Narrator'?N.narrAv(30):N.av({name:n,portrait:npc?.portrait,color:'var(--c-npc)'},30)}<span>${esc(n)}<small>${n==='Narrator'?'Story text, shown as the book':esc(N.npcSub(npc))}</small></span>${sel?`<span class="ck">${IC('check')}</span>`:''}</button>`; }).join('')
        + `<button type="button" class="opt" data-a="newVoice"><span class="av" style="--s:30px;--c:var(--line-3);box-shadow:none;background:var(--sunk);color:var(--ink-3)">${IC('plus').replace('<svg','<svg style="width:15px;height:15px"')}</span><span>New NPC voice</span></button>`;
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
    const by = {}; for (const [who, l] of Object.entries(m.rx || {})) for (const e of l || []) (by[e] = by[e] || []).push(N.personObj(who).name);
    const whoRx = Object.keys(by).length ? `<div class="rxwho">${Object.entries(by).map(([e, w]) => `<span>${N.emj(e)} ${esc(w.join(', '))}</span>`).join('')}</div>` : '';
    return `<div class="pop msgpop${p.all?' wide':''}" style="${pos}" role="menu" aria-label="Message">${quick}${whoRx}${social ? `<button type="button" class="opt" role="menuitem" data-a="reply" data-v="${m.id}">${IC('reply')}<span>Reply</span></button>` : ''}${N.msgCopyText(m) ? `<button type="button" class="opt" role="menuitem" data-a="copyMsg" data-v="${m.id}">${IC('copy')}<span>${m.kind === 'gif' ? 'Copy GIF link' : 'Copy text'}</span></button>` : ''}${isGM(v) || N.canEdit(v, m) ? `${social ? '<div class="sep"></div>' : ''}${N.canEdit(v, m) ? `<button type="button" class="opt" role="menuitem" data-a="msgEdit" data-v="${m.id}">${IC('pen')}<span>Edit message</span></button>` : ''}${isGM(v) ? `<button type="button" class="opt danger" role="menuitem" data-a="sheet" data-v="msgDel" data-c="${m.id}">${IC('trash')}<span>Delete message</span></button>` : ''}` : ''}</div>`;
  }
  /* the composer's emoji button: puts the emoji into what you're typing */
  if (p.type === 'emo') {
    const gif = v.ui.emoTab === 'gif';
    const tabs = `<div class="seg emo-tabs" role="tablist"><button type="button" role="tab" data-a="emoTab" data-v="emo" aria-pressed="${!gif}">${IC('smile')}Emoji</button><button type="button" role="tab" data-a="emoTab" data-v="gif" aria-pressed="${gif}"><b class="gifw">GIF</b>GIFs</button></div>`;
    return `<div class="pop msgpop wide${gif ? ' gifpop' : ''}" style="${pos}" role="dialog" aria-label="${gif ? 'GIFs' : 'Emoji'}">${tabs}${gif ? gifPane(v) : emoGrid(v, e => `data-a="emoIns" data-v="${esc(e)}"`, [])}</div>`;
  }
  if (p.type === 'wnew') {
    const row = (a, ic, l, sub, x='') => `<button type="button" class="opt" data-a="${a}" ${x}><span class="av" style="--s:30px;box-shadow:none;background:var(--accent-soft);color:var(--gold-tx)">${IC(ic).replace('<svg','<svg style="width:16px;height:16px"')}</span><span>${l}<small>${sub}</small></span></button>`;
    return `<div class="pop" style="${pos}" role="menu" aria-label="New">${row('wNew', 'quill', 'Wiki entry', 'A person, place or rule')}${row('writeNews', 'newsL', 'News edition', 'Players get a ping')}<div class="sep"></div>${row('sheet', 'gear', 'Categories', 'Rename, reorder, icons', 'data-v="wCats"')}</div>`;
  }
  if (p.type === 'maps') {
    return `<div class="pop" style="${pos}" role="listbox" aria-label="Maps">${g.maps.filter(m=>isGM(v)||m.vis!==false).map(m => `<button type="button" class="opt" data-a="mapGo" data-v="${m.id}" aria-selected="${N.curMap(v)===m}"><span class="av sq" style="--s:40px;box-shadow:none;background:${N.imgUrl(m.src)?`url(${N.imgUrl(m.src)}) center/cover`:'var(--sunk)'}"></span><span>${esc(m.name)}<small>${m.pins.filter(p=>p.type!=='party'&&(isGM(v)||p.vis)).length} places${isGM(v)&&N.audOf(m,'map')!=='*'?' · '+esc(N.audOf(m,'map')==='gm'?'hidden from players':N.audLabel(m,'map')):''}</small></span>${N.curMap(v)===m?`<span class="ck">${IC('check')}</span>`:''}</button>`).join('')}
      ${isGM(v)?`<div class="sep"></div><button type="button" class="opt" data-a="mapUpload"><span class="av sq" style="--s:40px;box-shadow:inset 0 0 0 1.5px var(--line-2);background:transparent;color:var(--ink-3)">${IC('upload').replace('<svg','<svg style="width:18px;height:18px"')}</span><span>Add a map image</span></button>`:''}</div>`;
  }
  return '';
}

/* ================= map ================= */
function mapPage(v){
  const g = G(), gm = isGM(v), m = N.curMap(v);
  if (!m) return `<div class="mapv"><div class="mapov"><div class="row1">${v.dev==='phone' ? meBtn(v) : ''}<span style="flex:1"></span></div></div>
    <div class="quiet" style="position:absolute;inset:0;align-content:center"><div class="art"></div><p>${gm ? 'No maps yet. Import the lore file to add the atlases, or upload a map picture.' : 'No maps yet. The GM hasn’t shared one.'}</p>
    ${gm ? `<div style="display:flex;gap:8px;justify-content:center;flex-wrap:wrap"><button type="button" class="btn primary" data-a="sheet" data-v="import">${IC('upload')}Import lore</button><button type="button" class="btn" data-a="mapUpload">${IC('image')}Upload a map</button></div>` : ''}</div></div>`;
  const src = N.imgUrl(m.src);
  const pins = m.pins.filter(p => p.type !== 'party');
  const types = ['all', ...Object.keys(N.PINT).filter(t => t !== 'party' && pins.some(p => p.type === t && (gm || p.vis)))];
  if (!types.includes(v.ui.mapType)) v.ui.mapType = 'all';
  const pin = pins.find(p => p.id === v.ui.pinSel);
  const party = g.party.map === m.id ? g.party : null;
  const q = v.ui.mapQ.trim().toLowerCase();
  const match = p => (v.ui.mapType === 'all' || p.type === v.ui.mapType) && (!q || p.label.toLowerCase().includes(q) || (p.note || '').toLowerCase().includes(q));
  return `<div class="mapv" data-map="${m.id}">
    <div class="mapcv" data-mapcv="1"><div class="mapst" style="width:${m.w}px;height:${m.h}px">${src ? `<img src="${src}" alt="${esc(m.name)}" width="${m.w}" height="${m.h}" draggable="false">` : ''}
      <div class="pins">${pins.filter(p => (gm || p.vis) && match(p)).map(p => {
        const t = N.PINT[p.type] || N.PINT.note; return `<button type="button" class="pin${m.labeled?' dotp':''}${v.ui.pinSel===p.id?' sel':''}${p.vis?'':' hid'}" data-pin="${p.id}" style="left:${p.rx*m.w}px;top:${p.ry*m.h}px;--pc:${t.col}" aria-label="${esc(p.label)}"><span class="pm">${IC(t.ic)}</span><span class="pl">${esc(p.label)}</span></button>`; }).join('')}
        ${party ? `<button type="button" class="pin party" data-pin="__party" style="left:${party.rx*m.w}px;top:${party.ry*m.h}px" aria-label="The party is here"><span class="pm">${IC('banner')}</span><span class="pl">The party</span></button>` : ''}
      </div></div>${src ? '' : '<div class="maploading">Loading the map…</div>'}</div>
    <div class="mapov">
      <div class="row1">
        ${v.dev==='phone' ? meBtn(v) : ''}
        <button type="button" class="mapsel glass" data-a="pop" data-v="maps"><span class="th" style="${src ? `background-image:url(${src})` : ''}"></span><span style="min-width:0"><small>Map${gm && N.audOf(m,'map') !== '*' ? ' · ' + (N.audOf(m,'map') === 'gm' ? 'hidden' : esc(N.audLabel(m,'map'))) : ''}</small><b>${esc(m.name)}</b></span>${IC('caret')}</button>
        <div class="search only-dt" style="width:240px"><svg viewBox="0 0 256 256" fill="currentColor">${(window.ICONS.search||['',''])[1]}</svg><input class="inp glass" id="mapq-${v.id}" data-i="mapQ" placeholder="Find a place" value="${esc(v.ui.mapQ)}" style="border:0"></div>
        <span style="flex:1"></span>
        ${gm ? `<button type="button" class="btn ${v.ui.mapEdit?'primary':'glass'}" data-a="mapEdit">${IC('pen')}<span class="only-dt">${v.ui.mapEdit?'Done editing':'Edit map'}</span><span class="only-ph">${v.ui.mapEdit?'Done':'Edit'}</span></button>` : ''}
      </div>
      <div class="chips" role="group" aria-label="Show">${types.map(t => `<button type="button" class="cchip" data-a="mapType" data-v="${t}" aria-current="${v.ui.mapType===t}" style="padding:0 12px">${t==='all'?'Everything':IC((N.PINT[t]||N.PINT.note).ic)+esc((N.PINT[t]||N.PINT.note).name)}</button>`).join('')}${party || !g.party.map ? '' : `<button type="button" class="cchip" data-a="findParty" style="padding:0 12px">${IC('banner')}Find the party</button>`}</div>
      <span></span>
      ${gm && v.ui.mapEdit ? `<div class="mapedit glass"><button type="button" class="btn ${v.ui.addPin?'primary':'ghost'}" data-a="addPin">${IC('pinL')}${v.ui.addPin?'Tap the map…':'Add pin'}</button><button type="button" class="btn ghost" data-a="sheet" data-v="mapSet" data-c="${esc(m.id)}">${IC(N.audOf(m,'map')==='gm'?'eyeoff':'eye')}<span class="only-dt">${esc(N.audOf(m,'map')==='gm'?'Hidden':N.audLabel(m,'map'))}</span><span class="only-ph">Who sees it</span></button><button type="button" class="btn ghost" data-a="sheet" data-v="mapDel" data-c="${esc(m.id)}" aria-label="Delete this map">${IC('trash')}<span class="only-dt">Delete map</span></button><button type="button" class="btn ghost" data-a="mapUpload">${IC('upload')}<span class="only-dt">Upload map</span></button></div>` : '<span></span>'}
    </div>
    ${pin || (v.ui.pinSel === '__party' && party) ? pinCard(v, m, pin) : ''}
  </div>`;
}
const PIN_KINDS = ['town','nation','tavern','shop','temple','landmark','danger','note'];
function pinCard(v, m, p){
  const g = G(), gm = isGM(v);
  if (!p) return `<div class="pincard glass"><div class="hd"><span style="flex:1"><span class="eyebrow">Party</span><b>The party is here</b></span><button type="button" class="ibtn sm" data-a="pinClose" aria-label="Close">${IC('x')}</button></div><p>${gm?'Drag the banner while editing, or use “Move party here” on any place.':`${esc(N.gmName())} moves this banner as you travel.`}</p></div>`;
  const t = N.PINT[p.type]||N.PINT.note, wk = p.wiki && g.wiki.find(e => e.id === p.wiki && (gm || !e.gm));
  if (gm && v.ui.mapEdit) return `<div class="pincard glass"><div class="hd"><span class="av sq" style="--s:42px;--c:${t.col};box-shadow:none;background:${t.col};color:#1a1208">${IC(t.ic).replace('<svg','<svg style="width:22px;height:22px"')}</span><input class="inp" id="pinl-${v.id}" data-i="pinLabel" value="${esc(p.label)}" aria-label="Place name" style="flex:1"><button type="button" class="ibtn sm" data-a="pinClose" aria-label="Close">${IC('x')}</button></div>
    <div class="chips" style="padding:0;flex-wrap:wrap">${PIN_KINDS.map(k => `<button type="button" class="cchip" data-a="pinType" data-v="${k}" aria-current="${p.type===k}" style="padding:0 11px">${IC(N.PINT[k].ic)}${N.PINT[k].name.replace(/s$/,'')}</button>`).join('')}</div>
    <textarea class="inp" id="pinn-${v.id}" data-i="pinNote" rows="2" placeholder="A short note players see" style="min-height:60px">${esc(p.note||'')}</textarea>
    <div class="row"><button type="button" class="btn sm ${p.vis?'':'primary'}" data-a="pinVis">${IC(p.vis?'eye':'eyeoff')}${p.vis?'Players see it':'Hidden · show it'}</button><button type="button" class="btn sm" data-a="pinParty" data-v="${p.id}">${IC('banner')}Move party here</button><span style="flex:1"></span><button type="button" class="btn sm danger" data-a="pinDel" aria-label="Delete this place">${IC('trash')}</button></div>
    <p style="font-size:12px;color:var(--ink-3)">Drag the pin on the map to move it.</p></div>`;
  return `<div class="pincard glass"><div class="hd"><span class="av sq" style="--s:42px;--c:${t.col};box-shadow:none;background:${t.col};color:#1a1208">${IC(t.ic).replace('<svg','<svg style="width:22px;height:22px"')}</span><span style="flex:1;min-width:0"><span class="eyebrow">${esc(t.name.replace(/s$/,''))}</span><b>${esc(p.label)}</b></span><button type="button" class="ibtn sm" data-a="pinClose" aria-label="Close">${IC('x')}</button></div>
    ${p.note?`<p>${esc(p.note)}</p>`:''}
    <div class="row">${wk?`<button type="button" class="btn sm" data-a="wiki" data-v="${wk.id}">${IC('worldL')}Read in World</button>`:''}${gm?`<button type="button" class="btn sm primary" data-a="pinScene" data-v="${p.id}">${IC('image')}Set as scene</button><button type="button" class="btn sm" data-a="pinParty" data-v="${p.id}">${IC('banner')}Move party here</button>`:''}</div>
    ${gm?`<p style="font-size:12.5px;color:var(--ink-3);display:flex;gap:6px;align-items:center">${IC(p.vis?'eye':'eyeoff').replace('<svg','<svg style="width:15px;height:15px"')}${p.vis?'Players can see this place.':'Hidden from players.'}</p>`:''}
  </div>`;
}

/* ================= world ================= */
function worldPage(v){
  const g0 = G(), gm = isGM(v), ph = v.dev === 'phone';
  const g = Object.assign({}, g0, {wiki: g0.wiki.filter(e => gm || !e.gm)});
  const q = v.ui.wikiQ.trim().toLowerCase();
  const hit = e => !q || [e.title, e.summary, ...(e.body||[])].join(' ').toLowerCase().includes(q);
  const index = `<div class="wi scroll" data-sk="wi">
    ${ph ? `<div class="top ph" style="padding:calc(6px + var(--safe-t,0px)) 0 0">${meBtn(v)}<h1>World</h1>${gm?`<button type="button" class="btn sm primary" data-a="pop" data-v="wnew">${IC('plus')}New${IC('caret')}</button>`:''}</div>` : `<div style="display:flex;align-items:center;gap:10px"><h1 class="ttl" style="flex:1;font-size:26px">World</h1>${gm?`<button type="button" class="btn sm ghost" data-a="sheet" data-v="wCats">${IC('gear')}Categories</button><button type="button" class="btn sm primary spark" data-a="wNew">${IC('plus')}New entry</button>`:''}</div>`}
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
  return esc(s).replace(/\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/g, (m, t, lab) => { const e = g.wiki.find(x => esc(x.title).toLowerCase() === t.toLowerCase() && (gm || !x.gm)); lab = lab || t; return e ? `<a class="wl" data-a="wiki" data-v="${e.id}">${lab}</a>` : lab; });
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
  const needle = '[[' + e.title.toLowerCase() + ']]';
  const backs = g.wiki.filter(x => x.id !== e.id && (gm || !x.gm) && [x.summary, ...(x.body||[]), ...(x.info||[]).map(i=>i[1])].join(' ').toLowerCase().includes(needle)).slice(0,8);
  return `<article class="article">
    <div style="display:flex;align-items:center;gap:8px"><span class="eyebrow" style="color:var(--gold-tx);flex:1">${IC(N.catIcon(e.cat)).replace('<svg','<svg style="width:14px;height:14px;display:inline;vertical-align:-2px;margin-right:6px"')}${esc(e.cat)}${gm && N.audOf(e,'wiki') !== '*' ? ' · ' + (e.gm ? 'GM only' : esc(N.audLabel(e,'wiki'))) : ''}</span>${gm?`<button type="button" class="btn sm" data-a="wEdit" data-v="${e.id}">${IC('pen')}Edit</button>`:''}</div>
    <h1>${esc(e.title)}</h1>
    ${e.summary ? `<p class="sum">${links(e.summary)}</p>` : ''}
    <div class="rule"><span class="star4"></span></div>
    ${(() => { const ps = N.wikiPics(e); return ps.length ? `<div class="wfigs${ps.length > 1 ? ' many' : ''}">${ps.map(p => `<figure class="wfig">${N.wikiImg(p.src, p.alt || p.cap || e.title)}${p.cap?`<figcaption>${esc(p.cap)}</figcaption>`:''}</figure>`).join('')}</div>` : ''; })()}
    ${e.info?.length ? `<dl class="facts">${e.info.map(([k,x]) => `<dt>${esc(k)}</dt><dd>${links(x)}</dd>`).join('')}</dl>` : ''}
    ${(e.body||[]).map(block).join('')}
    ${e.soon || !(e.body||[]).length ? '<p class="muted" style="font-weight:700;font-size:13px">More coming soon.</p>' : ''}
    ${gm && e.secret ? `<div class="secret"><span class="seal">${IC('lock')}</span><b>GM only · players never see this</b>${e.secret.split(/\n\s*\n/).map(p => `<p>${links(p)}</p>`).join('')}</div>` : ''}
    ${backs.length ? `<p class="backs"><span class="eyebrow" style="margin-right:8px">Linked from</span>${backs.map(b => `<a class="wl" data-a="wiki" data-v="${b.id}" style="color:var(--link);cursor:pointer">${esc(b.title)}</a>`).join(', ')}</p>` : ''}
    ${e.src ? `<p class="src">From the lore notes: ${esc(e.src)}</p>` : ''}
  </article>`;
}
/* ================= news: every paper the GM runs, each with its issues in order ================= */
const npIcon = name => `<span class="np"><b>${esc(name.length > 12 ? name.split(/\s+/).map(w => w[0]).join('').slice(0, 4) : name)}</b><i></i><i class="s"></i><i></i><i></i><i class="s"></i></span>`;
function newsPage(v){
  const gm = isGM(v), ph = v.dev === 'phone', papers = N.papers();
  const seen = G().news.seen[v.role] || [], unseen = i => !gm && !seen.includes(i.id);
  const paper = papers.find(p => p.name === v.ui.paper);
  const issueBtn = i => `<button type="button" class="ent" data-a="newsSel" data-v="${i.id}" aria-current="${v.ui.newsSel===i.id}"><b>No. ${esc(i.no || '—')}${i.date ? ` <span class="nd">· ${esc(i.date)}</span>` : ''}${unseen(i) ? ' <span class="tag gold">New</span>' : ''}${gm ? audTag(i, 'news') : ''}</b><small>${esc(i.headline)}</small></button>`;
  const paperBtn = p => { const last = p.issues[p.issues.length - 1], n = p.issues.filter(unseen).length, open = paper === p;
    return `<button type="button" class="herald" data-a="newsPaper" data-v="${esc(p.name)}" aria-current="${open}">${npIcon(p.name)}<span><span class="eyebrow" style="color:var(--gold-tx)">${p.issues.length} ${p.issues.length > 1 ? 'issues' : 'issue'} ${n ? `<span class="tag gold">${n} new</span>` : ''}</span><h3>${esc(p.name)}</h3><small>Latest: No. ${esc(last.no || '—')} · ${esc(last.headline)}</small></span></button>${open && !ph ? `<div class="ents" style="padding:2px 0 8px 8px">${p.issues.map(issueBtn).join('')}</div>` : ''}`; };
  const none = `<div class="quiet"><div class="art" style="width:220px;height:180px"></div><p>${gm ? 'No papers yet. Write the first edition and give the paper a name. Players get a ping.' : `No news yet. ${esc(N.gmName())} publishes papers here.`}</p></div>`;
  const newBtn = gm ? (ph ? `<button type="button" class="btn sm primary" data-a="writeNews">${IC('plus')}New edition</button>` : `<button type="button" class="btn sm primary spark" data-a="writeNews">${IC('pen')}New edition</button>`) : '';
  const index = `<div class="wi scroll" data-sk="ni">
    ${ph ? `<div class="top ph" style="padding:calc(6px + var(--safe-t,0px)) 0 0">${meBtn(v)}<h1>News</h1>${newBtn}</div>` : `<div style="display:flex;align-items:center;gap:10px"><h1 class="ttl" style="flex:1;font-size:26px">News</h1>${newBtn}</div>`}
    ${papers.length ? `<p class="muted" style="margin:0;font:600 13px/1.4 var(--f-ui)">${papers.length > 1 ? `${papers.length} papers. ` : ''}Pick a paper to see its issues, oldest first.</p><div class="papers">${papers.map(paperBtn).join('')}</div>` : none}
  </div>`;
  const issue = paper && paper.issues.find(i => i.id === v.ui.newsSel);
  const read = gm && v.ui.newsEdit ? newsForm(v, papers) : issue ? issuePane(v, paper, issue) : paper ? `<div class="quiet" style="align-self:center"><div class="art" style="width:240px;height:200px"></div><p>Pick an issue of ${esc(paper.name)}.</p></div>` : `<div class="quiet" style="align-self:center"><div class="art" style="width:260px;height:220px"></div><p>${papers.length ? 'Pick a paper to read its issues.' : gm ? 'Write the first edition with “New edition”.' : 'Nothing printed yet.'}</p></div>`;
  if (!ph) return `<div class="world">${index}<div class="scroll" data-sk="nr" style="min-height:0;display:grid">${read}</div></div>`;
  const back = t => `<div class="top ph"><button type="button" class="ibtn" data-a="nBack" aria-label="Back">${IC('left')}</button><h1 style="font-size:16px">${esc(t)}</h1></div>`;
  if (gm && v.ui.newsEdit) return `<div class="world"><div class="scroll" data-sk="nr" style="min-height:0;padding-top:var(--safe-t,0px)">${back('New edition')}${read}</div></div>`;
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
    ${gm ? `<div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap"><span class="eyebrow" style="flex:1 1 160px">Who can read No. ${esc(issue.no || '—')}</span><button type="button" class="btn ghost" data-a="sheet" data-v="newsSet" data-c="${esc(issue.id)}">${IC(issue.see?.length?'eyeoff':'users')}${esc(N.audLabel(issue,'news'))}</button><button type="button" class="btn primary" data-a="writeNews" data-v="${esc(paper.name)}">${IC('pen')}Next issue</button></div>` : ''}
    ${paperHtml(issue)}
    ${prev || next ? `<div style="display:flex;justify-content:space-between;gap:8px">${step(prev, -1)}${step(next, 1)}</div>` : ''}
  </div>`;
}
function newsForm(v, papers){
  const d = v.ui.newsEdit;
  const f = (k, l, ph, rows) => `<label class="field"><span>${l}</span>${rows ? `<textarea class="inp" id="nd-${k}-${v.id}" data-i="news" data-k="${k}" rows="${rows}" placeholder="${esc(ph)}">${esc(d[k])}</textarea>` : `<input class="inp" id="nd-${k}-${v.id}" data-i="news" data-k="${k}" value="${esc(d[k])}" placeholder="${esc(ph)}">`}</label>`;
  return `<div class="article" style="max-width:none;grid-template-columns:1fr;gap:18px">
    <div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap"><h1 style="font-size:28px;flex:1">New edition</h1><button type="button" class="btn ghost" data-a="newsCancel">Cancel</button><button type="button" class="btn gold" data-a="newsPub">${IC('send')}Publish</button></div>
    <div style="display:grid;gap:12px;grid-template-columns:repeat(auto-fit,minmax(260px,1fr))">
      <div style="display:grid;gap:12px;align-content:start">
        ${f('paper','Paper name','Name of the paper')}
        ${papers.length ? `<div><span class="eyebrow" style="display:block;margin-bottom:8px">Or pick one of your papers</span><div class="chips" style="padding:0;flex-wrap:wrap">${papers.map(pp => `<button type="button" class="cchip" data-a="ndPaper" data-v="${esc(pp.name)}" aria-current="${pp.name === N.paperName(d)}" style="padding:0 12px">${esc(pp.name)}</button>`).join('')}</div></div>` : ''}
        <div style="display:grid;gap:12px;grid-template-columns:1fr 1fr">${f('no','Issue number','1')}${f('price','Price','Optional')}</div>
        ${f('date','In-world date','e.g. Restday, the 3rd of High Shine')}
        ${f('headline','Headline','What everyone is talking about')}
        ${f('sub','Under the headline','One line of detail')}
        ${f('lead','Lead story','Leave a blank line between paragraphs.',6)}
        ${f('s1t','Second story: title','Optional')}${f('s1b','Second story: text','',3)}
        ${f('s2t','Third story: title','Optional')}${f('s2b','Third story: text','',3)}
        ${f('notices','Notices, one per line','Wanted posters, ads, announcements…',3)}
        <div><span class="eyebrow" style="display:block;margin-bottom:8px">Who gets this edition</span>${N.audPick('ndAud', d, 'news')}</div>
      </div>
      <div><span class="eyebrow" style="display:block;margin-bottom:8px">Preview</span>${paperHtml(N.draftIssue(d), true)}</div>
    </div></div>`;
}
function paperHtml(p, prev){
  const ph = (x, f) => x ? esc(x) : prev ? `<span class="ph">${f}</span>` : '';
  const paras = t => String(t||'').split(/\n\s*\n/).map(s => s.trim()).filter(Boolean).map(s => `<p style="margin:0 0 10px">${esc(s)}</p>`).join('');
  const stories = (p.stories||[]).filter(s => s.title || s.body), notices = (p.notices||[]).filter(Boolean);
  return `<div class="paper"><h1 class="mast">${ph(p.paper,'Paper name')}</h1><div class="strip"><span>No. ${esc(p.no||'—')}</span><span>${ph(p.date,'In-world date')}</span><span>${ph(p.price, prev ? 'Price' : '')}</span></div>
    <h2 class="hl">${ph(p.headline,'Your headline here')}</h2>${p.sub || prev ? `<p class="psub">${ph(p.sub,'A line under the headline')}</p>` : ''}
    <div class="plead">${paras(p.lead) || (prev?'<p class="ph">The lead story goes here.</p>':'')}</div>
    ${stories.length ? `<div class="pstories">${stories.map(s => `<section><h3>${esc(s.title)}</h3>${paras(s.body)}</section>`).join('')}</div>` : ''}
    ${notices.length ? `<aside class="pnotices"><h3>Notices</h3><ul>${notices.map(t => `<li>${esc(t)}</li>`).join('')}</ul></aside>` : ''}</div>`;
}

/* ================= character / cast ================= */
function heroPage(v){
  const g = G(), mine = N.charOf(v.role), sel = g.chars[v.ui.charSel] || mine;
  const others = N.pcs();
  if (!sel) return `<div class="scroll" data-sk="hero" style="min-height:0">${v.dev==='phone' ? `<div class="top ph">${meBtn(v)}<h1>Character</h1></div>` : ''}<div class="quiet"><div class="art"></div><p>No character yet.</p></div></div>`;
  const bag = N.heroBag(v);
  if (bag && v.ui.heroInv) return heroInv(v, sel, mine);
  return `<div class="scroll" data-sk="hero" style="min-height:0">
    ${v.dev==='phone' ? `<div class="top ph">${meBtn(v)}<h1>${sel===mine?'My character':esc(sel.built?sel.short:pn(sel))}</h1>${bag && sel.built ? `<button type="button" class="btn sm" data-a="heroInv" data-v="1">${IC('bag')}Inventory${sel.inv?.length ? ` <span class="tag" style="height:16px">${sel.inv.length}</span>` : ''}</button>` : ''}</div>` : ''}
    <div class="sheetv">
      ${others.length > 1 ? `<div class="party-row full">${others.map(c => `<button type="button" class="pchip" data-a="charSel" data-v="${c.id}" aria-current="${c===sel}">${N.av({name:c.built?c.short:pn(c),portrait:c.built?c.portrait:null,color:c.color},36)}<span><b>${esc(c===mine?'You':c.built?c.short:pn(c))}</b><small>${c.built?esc(N.pcTag(c)):'No card yet'}</small></span></button>`).join('')}</div>` : ''}
      ${N.sheetBody(v, sel)}
    </div></div>`;
}
/* phone, player: the sheet's items open in their own view with a way back */
N.heroBag = v => v.dev === 'phone' && !isGM(v) && v.ui.tab === 'hero';
function heroInv(v, c, mine){
  const own = c === mine;
  return `<div class="scroll" data-sk="heroinv" style="min-height:0"><div class="top ph" style="display:flex"><button type="button" class="ibtn" data-a="heroInv" data-v="" aria-label="Back to the character sheet">${IC('left')}</button><h1>${own ? 'My inventory' : `${esc(c.built ? c.short : pn(c))}’s inventory`}</h1><button type="button" class="btn sm" data-a="heroInv" data-v="">${IC('x')}Close</button></div>
    <div class="sheetv">${c.built
      ? `<section class="sec"><h3>Items</h3>${invList(v, c, false)}</section>
        <section class="sec"><h3>${own ? 'Your notes' : 'Notes'}</h3>${noteBox(v, c, 'invText', own, 'What you carry, in your own words')}</section>`
      : `<section class="sec"><p class="muted">${own ? `${esc(N.gmName())} hasn’t made your character card yet.` : 'No card yet.'}</p></section>`}</div></div>`;
}
const asps = list => list.filter(x => x[1]).map(([k,a],i)=>`<span class="icard" style="--rot:${[-.6,.5,-.3][i%3]}deg"><span class="k">${k}</span>${esc(a)}</span>`).join('');
N.sheetBody = function(v, c){
  const g = G(), gm = isGM(v), mine = c.player === v.role;
  const who = `--who:${c.color}`;
  if (!c.built) return `<div class="pc-hero full" style="${who}">${N.av({name:pn(c),color:c.color},84)}<div><h2>${esc(pn(c))}’s character</h2><div class="by">${gm?'Not made yet.':mine?`${esc(N.gmName())} will make your character card.`:'Not made yet.'}</div></div></div>
    ${gm?`<div class="full" style="display:flex;justify-content:center"><button type="button" class="btn primary lg spark" data-a="pcEdit" data-v="${c.id}">${IC('pen')}Make ${esc(pn(c))}’s card</button></div>`:''}
    <div class="quiet full"><div class="art"></div><p>${gm?'Name, age, aspects, skills, stunts and fate points. The player gets a note when it’s ready.':'It shows up here as soon as it’s ready.'}</p></div>`;
  const rungs = [8,7,6,5,4,3,2,1].map(x => [x, Object.entries(c.skills).filter(([,y]) => y === x).map(([n]) => n)]).filter(r => r[1].length);
  const canRoll = gm, edit = mine || gm;
  return `<section class="pc-hero full" style="${who}">
      ${mine && !gm ? `<button type="button" class="facebtn" data-a="sheet" data-v="myFace" aria-label="Change my picture">${N.av(c,84)}<span class="badge">${IC('image')}</span></button>` : N.av(c,84)}
      <div style="min-width:0"><h2>${esc(c.name)}</h2><div class="by">${c.race?`${esc(c.race)} · `:''}${c.age?`Age ${esc(c.age)} · `:''}Played by ${esc(pn(c))}${mine?' · you':''}</div>${N.pcTag(c)?`<div class="hc">${esc(N.pcTag(c))}</div>`:''}</div>
      <div class="fp"><div><span class="eyebrow">Fate points · refresh ${c.refresh}</span><div class="coins">${coinsHtml(c, gm)}</div></div>${gm?`<div class="gmbar"><button type="button" class="btn sm" data-a="pcEdit" data-v="${c.id}">${IC('pen')}Edit card</button><button type="button" class="btn sm danger" data-a="sheet" data-v="pcDel" data-c="${c.id}">${IC('trash')}Delete</button></div>`:''}</div>
    </section>
    <section class="sec"><h3>Aspects</h3><div class="asps">${asps(N.pcAspects(c).map((a,i)=>[`Aspect ${i+1}`,a])) || '<p class="muted">None yet.</p>'}</div></section>
    <section class="sec"><h3>Skills${canRoll?' · tap one to roll':''}</h3><div class="lad">${rungs.map(([x,ns]) => `<div class="rung"><span class="lv"><b>${sgn(x)}</b>${ladderWord(x)}</span><span class="sks">${ns.map(n => canRoll ? `<button type="button" data-a="roll" data-skill="${esc(n)}" data-c="${c.id}">${esc(n)}${N.discOf(c, n).length?`<small style="color:var(--ink-3);font-weight:600">${esc(N.discOf(c, n).join(', '))}</small>`:''}${fateDie.replace('<svg','<svg style="width:14px;height:14px;color:var(--ink-4)"')}</button>` : `<button type="button" disabled>${esc(n)}</button>`).join('')}</span></div>`).join('')}<div class="rung"><span class="lv"><b>+0</b>Mediocre</span><span class="sks"><span class="muted" style="font-weight:600;font-size:13px;padding:8px 0">Everything else</span></span></div></div></section>
    <section class="sec"><h3>Stress</h3><div class="stress2">${[['phys','Physical','Strength'],['ment','Mental','Will']].map(([k,l,s]) => `<div class="trk"><span class="eyebrow">${l} <span style="letter-spacing:0;text-transform:none;font-weight:600">· from ${s}</span></span><div class="boxes">${c.stressV[k].map((x,i)=>`<button type="button" class="sbox${c.stress[k][i]?' on':''}" ${gm?`data-a="stress" data-c="${c.id}" data-k="${k}" data-i="${i}"`:'disabled'} aria-pressed="${!!c.stress[k][i]}" aria-label="${l} ${x}">${x}</button>`).join('')}</div></div>`).join('')}</div></section>
    <section class="sec"><h3>Consequences</h3><div class="cons">${N.consSlots(c.skills).map(sl => `<div class="con">${conLv(sl)}${gm?`<input class="inp" id="con-${sl.k}-${c.id}-${v.id}" data-i="con" data-c="${c.id}" data-k="${sl.k}" value="${esc(c.cons[sl.k]||'')}" placeholder="Empty">`:`<span class="slot${c.cons[sl.k]?' full':''}">${esc(c.cons[sl.k])||'Empty'}</span>`}</div>`).join('')}</div></section>
    <section class="sec"><h3>Weapon and armor</h3><p class="gearln">${IC('sword')}Weapon <b>${sgn(+c.gearAtk||0)}</b><span class="muted">shifts added to a hit</span></p><p class="gearln">${IC('shieldU')}Armor <b>${sgn(+c.gearDef||0)}</b><span class="muted">shifts taken off a hit</span></p></section>
    <section class="sec"><h3>Stunts</h3>${c.stunts.map(([n,d]) => `<div class="stunt"><b>${esc(n)}</b><p>${esc(d)}</p></div>`).join('') || '<p class="muted">None yet.</p>'}</section>
    <section class="sec full"><h3>Bio</h3>${noteBox(v, c, 'bio', edit, 'Who they are, where they come from, what they look like…')}</section>
    <section class="sec"><h3>Important people</h3>${noteBox(v, c, 'people', edit, 'Family, friends, rivals, debts… one per line')}</section>
    ${N.heroBag(v) ? '' : `<section class="sec"><h3>Inventory</h3>${noteBox(v, c, 'invText', edit, 'What you carry, in your own words')}${invList(v, c, gm)}</section>`}`;
};
const conLv = sl => `<span class="lv"><b>${sl.l}</b>${sl.lo}–${sl.hi} shifts${sl.only?`<small style="display:block;color:var(--gold-tx);margin-top:2px">${sl.only} only</small>`:''}</span>`;
N.conLv = conLv;
/* a free-text box on a card the player and GM can both write in */
const noteBox = (v, c, k, edit, ph) => edit ? `<textarea class="inp" id="cn-${k}-${c.id}-${v.id}" data-i="cnote" data-c="${c.id}" data-k="${k}" rows="3" placeholder="${ph}">${esc(c[k]||'')}</textarea>`
  : c[k] ? `<p style="margin:0;white-space:pre-line">${esc(c[k])}</p>` : '<p class="muted">Nothing yet.</p>';
/* the items the GM hands out; only the GM changes them */
function invList(v, c, gm, owner){
  /* owner: an NPC being made or edited keeps its items on the draft (data-nd) until it is saved */
  const own = owner || (c.player ? `data-c="${c.id}"` : `data-n="${c.id}"`), key = owner ? 'nd' : c.id;
  const ed = v.ui.invEdit;
  return `<div class="inv">${(c.inv || []).map(([n,q,d,ic],i) => gm && ed && ed.key === key && ed.i === i ? invEditRow(v, key, own, i, ed.n ?? n, ed.q ?? q, ed.d ?? d, ed.ic ?? ic) : `<div class="it"><span class="ii">${IC(ic||'bag')}</span><span><b>${esc(n)}</b>${d?`<small>${esc(d)}</small>`:''}</span><span class="q">×${q}</span>${gm?`<span class="mini"><button type="button" data-a="invQty" ${own} data-i="${i}" data-d="-1" aria-label="One fewer ${esc(n)}">−</button><button type="button" data-a="invQty" ${own} data-i="${i}" data-d="1" aria-label="One more ${esc(n)}">+</button><button type="button" data-a="invEdit" ${own} data-i="${i}" aria-label="Edit ${esc(n)}">${IC('pen')}</button><button type="button" data-a="invDel" ${own} data-i="${i}" aria-label="Remove ${esc(n)}">${IC('x')}</button></span>`:''}</div>`).join('') || `<p class="muted">${gm?'No items yet.':`No items yet. ${esc(N.gmName())} adds them here.`}</p>`}</div>
      ${gm?`<div class="invadd"><input class="inp" id="inv-${key}-${v.id}" placeholder="Add an item, e.g. Silver dagger" aria-label="Item name"><input class="inp" id="invq-${key}-${v.id}" data-i="invQ" type="number" min="1" value="${v.ui.invQ||1}" aria-label="How many"><button type="button" class="btn sm" data-a="invAdd" ${own}>${IC('plus')}Add</button><input class="inp" id="invd-${key}-${v.id}" placeholder="What it does (optional), e.g. Melee 1" aria-label="Item note" style="grid-column:1/-1"></div>${c.player?`<p class="muted" style="margin:6px 0 0;font:600 12px/1.4 var(--f-ui)">Changes post a note in ${esc(pn(c))}’s private chat.</p>`:''}`:''}`;
}
/* the GM changes an item in place: name, how many, what it does and its picture */
const INV_IC = ['bag','sword','helm','potion','coins','scroll','drink','boots','knuckles','skull'];
const invEditRow = (v, key, own, i, n, q, d, ic) => `<div class="it ied">
  <div class="ied-ics" role="group" aria-label="Picture">${INV_IC.map(x => `<button type="button" data-a="invIc" data-v="${x}" aria-pressed="${(ic || 'bag') === x}" aria-label="${x}">${IC(x)}</button>`).join('')}</div>
  <div class="invadd" style="margin:0"><input class="inp" id="ien-${key}-${v.id}" data-i="ie" data-k="n" value="${esc(n)}" placeholder="Item name" aria-label="Item name"><input class="inp" id="ieq-${key}-${v.id}" data-i="ie" data-k="q" type="number" min="0" value="${q}" aria-label="How many"><span></span>
  <input class="inp" id="ied-${key}-${v.id}" data-i="ie" data-k="d" value="${esc(d || '')}" placeholder="What it does (optional)" aria-label="Item note" style="grid-column:1/-1"></div>
  <div class="ied-act"><button type="button" class="btn sm ghost" data-a="invEditCancel">Cancel</button><button type="button" class="btn sm primary" data-a="invSave" ${own} data-i="${i}">${IC('check')}Save</button></div></div>`;
N.invList = invList;
function invBody(v){
  const gm = isGM(v);
  const list = gm ? N.pcs() : [N.charOf(v.role)].filter(Boolean);
  const body = list.length ? list.map(c => !c.built
      ? `<section class="sec"><h3>${esc(pn(c))}</h3><p class="muted">${gm?'No card yet. Make it in Cast first.':`${esc(N.gmName())} hasn’t made your character card yet.`}</p></section>`
      : `<section class="sec"><h3>${gm?esc(c.short):'Items'}</h3>${gm?`<div style="display:flex;gap:10px;align-items:center">${N.av(c,36)}<span class="muted" style="font:600 13px/1.3 var(--f-ui)">Played by ${esc(pn(c))}</span></div>`:''}${invList(v, c, gm)}</section>
        <section class="sec"><h3>${gm?`${esc(c.short)}’s notes`:'Your notes'}</h3>${noteBox(v, c, 'invText', gm || c.player === v.role, 'What you carry, in your own words')}</section>`).join('')
    : `<div class="quiet full"><div class="art"></div><p>${gm?'No one has a seat yet.':'Nothing here yet.'}</p></div>`;
  return `<div class="sheetv">${body}</div>`;
}
function invPage(v){
  const ph = v.dev === 'phone';
  const top = ph ? `<div class="top ph">${meBtn(v)}<h1>Inventory</h1></div>` : `<div class="top dt" style="display:flex"><h1>Inventory</h1></div>`;
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
  const npcs = g.npcs.filter(n => !q || [n.name, n.race, n.job, n.hc].join(' ').toLowerCase().includes(q));
  return `<div class="scroll" data-sk="cast" style="min-height:0"><div class="cast">
    <div style="display:flex;align-items:center;gap:10px;padding-top:var(--safe-t,0px)">${ph?meBtn(v):''}<h1 class="ttl" style="flex:1;font-size:${ph?22:28}px">Cast</h1><button type="button" class="btn sm primary spark" data-a="npcNew">${IC('plus')}New NPC</button></div>
    <div class="seg" role="group" aria-label="Show" style="justify-self:start"><button type="button" data-a="castSeg" data-v="players" aria-pressed="${seg==='players'}">${IC('users')}Players</button><button type="button" data-a="castSeg" data-v="npcs" aria-pressed="${seg==='npcs'}">${IC('npc')}NPCs <span class="tag" style="height:16px">${g.npcs.length}</span></button><button type="button" data-a="castSeg" data-v="items" aria-pressed="${seg==='items'}">${IC('bag')}Items</button></div>
    ${seg === 'items' ? invBody(v) : seg === 'players' ? `<div class="cgrid">${pcs.map(c => c.built
      ? `<button type="button" class="ccard" data-a="castSel" data-v="${c.id}">${N.av(c,52)}<span><b>${esc(c.name)}</b><small>${esc(N.pcTag(c))}</small><small>Played by ${esc(pn(c))}</small></span><span class="icon-go">${IC('right')}</span></button>`
      : `<div class="ccard empty">${N.av({name:pn(c),color:c.color},52)}<span><b>${esc(pn(c))}</b><small>Signed in · no card yet</small></span><button type="button" class="btn sm primary" data-a="pcEdit" data-v="${c.id}">Make card</button></div>`).join('')}
      <button type="button" class="ccard empty" data-a="sheet" data-v="players"><span class="av" style="--s:52px;--c:var(--line-3);box-shadow:none;background:var(--sunk);color:var(--ink-3)">${IC('userplus').replace('<svg','<svg style="width:24px;height:24px"')}</span><span><b>Players &amp; sign-ins</b><small>${pending ? `${pending} ${pending===1?'person is':'people are'} waiting to be let in` : pcs.length ? 'Let people in, rename or remove them' : 'Send your players the link to this page'}</small></span>${pending?`<span class="badge">${pending}</span>`:`<span class="icon-go">${IC('right')}</span>`}</button></div>`
    : `<div class="search">${IC('search')}<input class="inp" id="npcq-${v.id}" placeholder="Find an NPC" data-i="npcQ" value="${esc(v.ui.npcQ||'')}"></div>
      ${npcs.length ? `<div class="cgrid">${npcs.map(n => `<div class="ccard">${N.av({name:n.name,portrait:n.portrait,color:'var(--c-npc)'},52)}<span><b>${esc(n.name)}</b><small>${esc(N.npcSub(n))}</small><small style="font-style:italic;font-family:var(--f-display)">${esc(n.hc)}</small></span><button type="button" class="ibtn sm" data-a="castSel" data-v="${n.id}" aria-label="Open ${esc(n.name)}">${IC('right')}</button>
        <div class="acts2"><button type="button" class="btn sm" data-a="voice" data-v="${esc(n.name)}" data-go="1">${IC('chatL')}Speak as</button>${g.combat.state!=='off'?`<button type="button" class="btn sm" data-a="npcToFight" data-v="${n.id}">${IC('swords')}Add to fight</button>`:''}<button type="button" class="btn sm ghost" data-a="npcEdit" data-v="${n.id}">${IC('pen')}Edit</button></div></div>`).join('')}</div>`
      : `<div class="quiet"><div class="art"></div><p>${g.npcs.length ? 'No NPCs match.' : 'Your NPC cards live here, for your eyes only. Press New NPC to write the first one.'}</p></div>`}`}
  </div></div>`;
}
function npcBody(v, n){
  const rungs = [8,7,6,5,4,3,2,1].map(x => [x, Object.entries(n.skills).filter(([,y]) => y === x).map(([k]) => k)]).filter(r => r[1].length);
  const trk = (k, l) => `<div class="trk"><span class="eyebrow">${l}</span><div class="boxes">${n.stressV[k].map((x,i)=>`<button type="button" class="sbox${n.stress[k][i]?' on':''}" data-a="npcStress" data-n="${n.id}" data-k="${k}" data-i="${i}" aria-pressed="${!!n.stress[k][i]}" aria-label="${l} ${x}">${x}</button>`).join('')}</div></div>`;
  return `<section class="pc-hero full" style="--who:var(--c-npc)">${N.av({name:n.name,portrait:n.portrait,color:'var(--c-npc)'},84)}<div style="min-width:0"><h2>${esc(n.name)}</h2><div class="by">${esc(N.npcSub(n) || 'NPC')}${n.age?` · Age ${esc(n.age)}`:''} · ${n.type==='nameless'?'Nameless NPC':'Supporting NPC'}</div>${N.pcTag(n)?`<div class="hc">${esc(N.pcTag(n))}</div>`:''}</div>
    <div class="fp"><div><span class="eyebrow">Fate points · refresh ${n.refresh}</span><div class="coins">${Array.from({length:Math.max(n.fp, n.refresh)}, (_,i) => `<span class="coin${i<n.fp?'':' off'}"></span>`).join('')}</div></div><div class="gmbar"><button type="button" class="btn sm" data-a="npcEdit" data-v="${n.id}">${IC('pen')}Edit</button>${G().combat.state!=='off'?`<button type="button" class="btn sm" data-a="npcToFight" data-v="${n.id}">${IC('swords')}Add to fight</button>`:''}<button type="button" class="btn sm ghost" data-a="npcDup" data-v="${n.id}">${IC('copy')}Duplicate</button><button type="button" class="btn sm danger" data-a="sheet" data-v="npcDel" data-c="${n.id}">${IC('trash')}Delete</button></div></div></section>
    <section class="sec"><h3>Aspects</h3><div class="asps">${asps(N.pcAspects(n).map((a,i)=>[`Aspect ${i+1}`,a])) || '<p class="muted">None yet.</p>'}</div></section>
    <section class="sec"><h3>Skills · tap one to roll</h3><div class="lad">${rungs.map(([x,ns]) => `<div class="rung"><span class="lv"><b>${sgn(x)}</b>${ladderWord(x)}</span><span class="sks">${ns.map(k => `<button type="button" data-a="roll" data-skill="${esc(k)}" data-npc="${n.id}">${esc(k)}${N.discOf(n, k).length?`<small style="color:var(--ink-3);font-weight:600">${esc(N.discOf(n, k).join(', '))}</small>`:''}${fateDie.replace('<svg','<svg style="width:14px;height:14px;color:var(--ink-4)"')}</button>`).join('')}</span></div>`).join('')}<div class="rung"><span class="lv"><b>+0</b>Mediocre</span><span class="sks"><span class="muted" style="font-weight:600;font-size:13px;padding:8px 0">Everything else</span></span></div></div>
      ${n.magic ? `<p style="margin:10px 0 0"><b>Disciplines.</b> ${esc(n.magic)}</p>` : ''}<button type="button" class="btn sm ghost" data-a="npcEdit" data-v="${n.id}" style="justify-self:start">${IC('pen')}Change skills</button></section>
    <section class="sec"><h3>Stress</h3><div class="stress2">${trk('phys','Physical')}${trk('ment','Mental')}</div></section>
    <section class="sec"><h3>Consequences</h3><div class="cons">${N.consSlots(n.skills).map(sl => `<div class="con">${conLv(sl)}<input class="inp" id="ncon-${sl.k}-${n.id}-${v.id}" data-i="npcCon" data-n="${n.id}" data-k="${sl.k}" value="${esc(n.cons[sl.k]||'')}" placeholder="Empty"></div>`).join('')}</div></section>
    <section class="sec"><h3>Weapon and armor</h3><p class="gearln">${IC('sword')}Weapon <b>${sgn(+n.gearAtk||0)}</b><span class="muted">shifts added to a hit</span></p><p class="gearln">${IC('shieldU')}Armor <b>${sgn(+n.gearDef||0)}</b><span class="muted">shifts taken off a hit</span></p></section>
    <section class="sec"><h3>Stunts</h3>${n.stunts.map(([a,b]) => `<div class="stunt"><b>${esc(a)}</b><p>${esc(b)}</p></div>`).join('') || '<p class="muted">None yet.</p>'}</section>
    <section class="sec"><h3>Inventory</h3>${invList(v, n, true)}</section>
    <section class="sec full"><h3>Bio</h3><textarea class="inp" id="npcbio-${n.id}-${v.id}" data-i="npcNotes" data-n="${n.id}" data-k="bio" rows="4" placeholder="Who they are, what they look like, how they talk…">${esc(n.bio)}</textarea></section>
    <section class="sec full"><h3>GM notes</h3><textarea class="inp" id="npcnotes-${n.id}-${v.id}" data-i="npcNotes" data-n="${n.id}" data-k="notes" rows="3" placeholder="Secrets, plans, who they work for. Only you see these.">${esc(n.notes)}</textarea></section>`;
}
})();
