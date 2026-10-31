/* Norne: the fight. One board, two ends: the GM rolls for everyone, players watch it play out. */
(function(){
const N = window.N, {esc, IC, sgn, ladderWord} = N;
const G = () => N.G;
const isGM = v => v.role === 'gm';

/* who is acting from this screen right now: the GM acts for whoever's turn it is, players only watch */
N.actorTok = v => {
  const cb = G().combat, cur = N.curTok();
  if (cb.state !== 'live' || cb.phase || !cur) return null;
  return isGM(v) ? cur : null;
};
N.myTok = v => isGM(v) ? null : G().combat.tokens.find(t => N.isMine(t, v.role));

function tokHtml(v, t, size){
  const g = G(), cb = g.combat, o = N.tokObj(t), st = N.tokStress(t), cur = N.curTok(), name = N.tokName(t);
  /* while an attack on them plays (js/fx.js) they stand as they were until the blow lands */
  const hold = N.fxHold && N.fxHold(v, t), out = t.out && !(hold && hold.up), on = i => st.s[i] && !(hold && hold.off === i);
  const cls = ['tok'];
  if (cb.state === 'live' && cur === t) cls.push('now');
  if (v.ui.tokSel === t.id || v.ui.placing === t.id) cls.push('sel');
  if (out) cls.push('out');
  const actor = N.actorTok(v) || (isGM(v) && v.ui.targeting ? cur : null);
  if (v.ui.targeting === 'attack' && actor && t !== actor && !t.out) cls.push(actor.zone === t.zone && N.sideOf(t) !== N.sideOf(actor) ? 'target' : 'nope');
  const p = cb.pending;
  const hit = p && (p.def === t.id) ? ' style="--ring:var(--ember)"' : '';
  const mine = N.isMine(t, v.role);
  if (mine) cls.push('me');
  return `<button type="button" class="${cls.join(' ')}" data-tok="${t.id}" aria-label="${esc(name)}${out?' (taken out)':''}"${hit}>${N.av(o, size)}<span class="nm">${mine?'You':esc(name)}</span>${out?'':`<span class="st">${st.v.map((x,i)=>`<i class="${on(i)?'on':''}"></i>`).join('')}</span>`}${t.kind==='npc'&&t.side==='ally'?`<span class="ji" title="Ally">${IC('heart')}</span>`:''}</button>`;
}
N.tokHtml = tokHtml;

function boardHtml(v){
  const g = G(), cb = g.combat, gm = isGM(v);
  const tool = gm ? (v.ui.cbTool || 'move') : 'move';
  const actor = N.actorTok(v) || (gm && v.ui.targeting ? N.curTok() : null);
  const edit = gm && tool === 'zone';
  if (N.fxTrack) N.fxTrack(v);
  /* in a zone with both sides in it, players and allies line up on the left edge and foes on the right */
  const grp = (arr, c) => `<div class="zs ${c}" style="--cols:${arr.length > 6 ? 3 : arr.length > 2 ? 2 : 1}">${arr.map(t => tokHtml(v, t)).join('')}</div>`;
  const zones = cb.zones.map(z => {
    const cls = ['zone'];
    if (v.ui.targeting === 'attack' && actor) cls.push(z.id === actor.zone ? 'reach' : 'dim');
    if (v.ui.targeting === 'move' && actor) cls.push(z.id === actor.zone ? 'sel' : 'reach');
    if (v.ui.placing) cls.push('reach');
    if (gm && v.ui.zoneSel === z.id && edit) cls.push('sel');
    const toks = cb.tokens.filter(t => t.zone === z.id), L = toks.filter(t => N.sideOf(t) !== 'foe'), R = toks.filter(t => N.sideOf(t) === 'foe');
    return `<div class="${cls.join(' ')}" data-zone="${z.id}" style="left:${z.x}%;top:${z.y}%;width:${z.w}%;height:${z.h}%;--zc:${z.col}">
      <span class="zl" data-zl="${z.id}">${esc(z.name)}${toks.length?` <i>${toks.filter(t=>!t.out || N.fxHold?.(v, t)?.up).length}</i>`:''}</span>
      ${L.length && R.length ? `<div class="ztoks sides">${grp(L, 'l')}${grp(R, 'r')}</div>` : `<div class="ztoks">${toks.map(t => tokHtml(v, t)).join('')}</div>`}
      ${z.aspect ? `<div class="za"><span class="icard" style="--rot:-1deg">${esc(z.aspect)}${z.free?`<span class="fi">${'<i></i>'.repeat(z.free)}</span>`:''}</span></div>` : ''}
      ${edit ? `<span class="rs" data-rs="${z.id}" aria-label="Resize ${esc(z.name)}"></span>` : ''}
    </div>`;
  }).join('');
  let hint = '';
  if (v.ui.targeting === 'attack') hint = `<div class="hint-chip">${IC('crosshair')}Pick someone in ${actor?esc(N.zoneOf(actor)?.name||'your zone'):'the same zone'}<button type="button" class="btn sm ghost" data-a="cbCancel" style="--h:26px">Cancel</button></div>`;
  else if (v.ui.targeting === 'move') hint = `<div class="hint-chip">${IC('boots')}Tap the zone to move to<button type="button" class="btn sm ghost" data-a="cbCancel" style="--h:26px">Cancel</button></div>`;
  else if (v.ui.placing) hint = `<div class="hint-chip">${IC('pinL')}Tap a zone to place ${esc(N.tokName(N.tokById(v.ui.placing)))}<button type="button" class="btn sm ghost" data-a="cbCancel" style="--h:26px">Cancel</button></div>`;
  else if (edit && !cb.zones.length) hint = `<div class="hint-chip" style="padding-right:14px">${IC('zone')}Drag on the map to draw a zone</div>`;
  else if (edit) hint = `<div class="hint-chip" style="padding-right:14px">${IC('zone')}Drag to draw · drag a name to move · corner to resize</div>`;
  const sasp = cb.aspects.length ? `<div class="sasp">${cb.aspects.map((a,i) => `<span class="icard${a.boost?' boost':''}" style="--rot:${i%2?.8:-.8}deg">${a.boost?`<span class="k">Boost · ${esc(a.by)}${a.left!=null?` · ${a.left>0?a.left+' left':'last action'}`:''}</span>`:''}${esc(a.t || 'Unnamed boost')}${a.free?`<span class="fi">${'<i></i>'.repeat(a.free)}</span>`:''}</span>`).join('')}</div>` : '';
  return `<div class="boardwrap"><div class="board${edit?' edit drawing':''}" data-board="1" aria-label="Battlefield: ${esc(cb.title)}">
    <div class="bg">${N.bgPic(N.imgUrl(cb.bg) ? cb.bg : N.FIGHTBG)}</div>
    <div class="cam">${zones}</div>${sasp}${hint}${diceFx(v)}
  </div></div>`;
}

/* the newest roll in the fight tumbles across the board on every screen, once, as it arrives.
   Each redraw restarts the animation with a negative delay, so it carries on where it was. */
const FX_MS = N.FX_MS = 2600;
function diceFx(v){
  const g = G(), cb = g.combat, ch = N.fightCh();
  if (cb.state !== 'live') return '';
  const m = g.msgs.findLast(x => x.ch === ch && x.kind === 'roll'), id = m ? m.id : null;
  if (!v._fx) { v._fx = {id, at:0}; return ''; }
  if (id && id !== v._fx.id) v._fx = {id, at:Date.now()};
  const el = Date.now() - v._fx.at;
  if (!id || el > FX_MS) return '';
  const r = m.roll, tot = N.rollTotal(r);
  return `<div class="dicefx" style="--el:-${el}ms" aria-hidden="true"><div class="dice">${r.dice.map(d => `<span class="die ${d>0?'p':d<0?'m':'z'}">${d>0?'+':d<0?'−':'·'}</span>`).join('')}</div>
    <div class="dfx-t"><small>${esc(r.who)} · ${esc(r.skill)} ${esc(r.action.toLowerCase())}</small><b>${sgn(tot)} <span>${ladderWord(tot)}</span></b></div></div>`;
}

/* turn order: one line of faces, the one acting is named and lit gold */
function orderStrip(v, ph){
  const cb = G().combat, ord = N.order(), cur = N.curTok(), outs = cb.tokens.filter(t => t.out);
  const nm = t => N.isMine(t, v.role) ? 'You' : esc(N.tokName(t));
  return `<div class="fight-order" aria-label="Turn order"><span class="ex">Exch.<b>${cb.exchange}</b></span>
    ${ord.map((t,i) => `<button type="button" class="ot${t===cur?' now':''}" data-tok="${t.id}" aria-label="${esc(N.tokName(t))}${t===cur?', acting now':''}">${N.av(N.tokObj(t), t===cur ? (ph?40:44) : (ph?28:30))}${t===cur || !ph ? `<span>${nm(t)}</span>` : ''}</button>${i < ord.length-1 ? '<i class="ar"></i>' : ''}`).join('')}
    ${outs.map(t => `<button type="button" class="ot out" data-tok="${t.id}" aria-label="${esc(N.tokName(t))} (taken out)">${N.av(N.tokObj(t), ph?24:26)}</button>`).join('')}
  </div>`;
}

/* GM tools: a rail beside the board on desktop, one button on the board on phones that opens them */
function toolList(v){
  const cb = G().combat, tool = v.ui.cbTool || 'move';
  return [[`data-a="cbTool" data-v="move" aria-pressed="${tool==='move'}"`, 'hand', 'Move'], [`data-a="cbTool" data-v="zone" aria-pressed="${tool==='zone'}"`, 'zone', 'Zones'],
    [`data-a="sheet" data-v="addFoe"`, 'person-plus', 'Add'], [`data-a="sheet" data-v="cbAspect"`, 'cards', 'Situation aspect'], cb.state === 'live' ? [`data-a="sheet" data-v="cbEnd"`, 'stop', 'End fight', 1] : null].filter(Boolean)
    .map(([a, ic, l, end]) => `${end ? '<span class="sep"></span>' : ''}<button type="button" ${a}${end ? ' class="end"' : ''}>${IC(ic)}<span class="lab">${l}</span></button>`).join('');
}
function toolsHtml(v, ph){
  if (!isGM(v)) return '';
  if (ph) return `<div class="fight-tools ph${v.ui.fightTools?' open':''}" role="toolbar" aria-label="GM tools"><button type="button" class="tg" data-a="fightTools" aria-pressed="${!!v.ui.fightTools}" aria-label="${v.ui.fightTools?'Close the GM tools':'GM tools'}">${IC(v.ui.fightTools ? 'x' : 'crown')}<span class="lab">GM tools</span></button>${v.ui.fightTools ? toolList(v) : ''}</div>`;
  return `<div class="fight-tools" role="toolbar" aria-label="GM tools">${toolList(v)}</div>`;
}

/* ---------- the command bar under the board: whose turn it is and what this screen can do now ----------
   tone: turn (gold, you act), alert (ember, you must defend or soak), wait (quiet) */
const pl = n => n > 1 ? 's' : '';
/* how a player character can soak a hit: a stress box big enough, the first free consequence that fits, or taken out */
function soakBtns(c, p){
  const opts = c.stressV.phys.map((x,i) => (!c.stress.phys[i] && x >= p.shifts) ? `<button type="button" class="btn sm" data-a="cbAbsorb" data-k="box" data-i="${i}"><span class="sbox" style="width:20px;height:20px">${x}</span>Stress box</button>` : '').join('');
  const cons = N.consSlots(c.skills).filter(sl => sl.only !== 'Mental' && !c.cons[sl.k] && sl.hi >= p.shifts).slice(0,1).map(sl => `<button type="button" class="btn sm" data-a="cbAbsorb" data-k="${sl.k}">${IC('cards')}${sl.l} consequence</button>`).join('');
  return `${opts}${cons}<button type="button" class="btn sm danger" data-a="cbAbsorb" data-k="out">Taken out</button>`;
}
/* right after Start: everyone's Notice roll, highest first. The GM taps whoever should go first. */
function noticeChips(){
  const cb = G().combat, lead = N.order()[0];
  const ord = cb.tokens.filter(t => !t.out && t.zone).sort((a,b) => (b.init ?? 0) - (a.init ?? 0) || N.tokNotice(b) - N.tokNotice(a));
  return `<div class="nchips" role="group" aria-label="Notice rolls">${ord.map(t => `<button type="button" data-a="cbFirst" data-t="${t.id}" aria-pressed="${t === lead}">${N.av(N.tokObj(t), 26)}<span>${esc(N.tokName(t))}</span><b>${sgn(t.init ?? 0)}</b></button>`).join('')}</div>`;
}
function nowState(v){
  const g = G(), cb = g.combat, gm = isGM(v), cur = N.curTok(), p = cb.pending, me = N.myTok(v), c = N.charOf(v.role), gmN = N.gmName();
  const pa = p && N.tokById(p.att), pd = p && N.tokById(p.def);
  const nextBtn = (lab, primary) => `<button type="button" class="btn${primary?' primary':''}" data-a="cbNext">${lab}${IC('next')}</button>`;
  if (gm) {
    if (cb.phase === 'notice') return {tone:'turn', eye:'The fight is on', title:'Notice roll', sub:'Rolls Notice for everyone in the fight to see who goes first.', acts:`<button type="button" class="btn gold" data-a="cbNotice">${N.fateDie}Notice roll</button>`};
    if (cb.phase === 'pick') return {tone:'turn', eye:'Notice roll', title:'Who goes first?', sub:'Highest roll goes first. Tap someone else to start with them.', acts:noticeChips(), cls:'pick', end:`<button type="button" class="btn primary" data-a="cbGo">Start${IC('next')}</button>`};
    if (p && p.stage === 'defend' && pa && pd)
      return {tok:pd, tone:'alert', eye:'Defend', title:`${N.tokName(pa)} attacks ${N.tokName(pd)}`, sub:`${p.skill} for ${sgn(p.total)} ${ladderWord(p.total)}. Roll ${N.tokName(pd)}’s defense.`, acts:defBtn(pd)};
    if (p && p.stage === 'style' && pa && pd) {
      const less = Math.max(0, p.dmg - 2);
      return {tok:pa, tone:'alert', eye:'Succeeded with style', title:`${N.tokName(pa)} hits ${N.tokName(pd)} with style`, sub:`Do the full ${p.dmg} shift${pl(p.dmg)}, or ${less} and put a boost on ${N.tokName(pd)}.`,
        acts:`<button type="button" class="btn gold" data-a="cbStyle" data-v="full">${IC('attack')}Full damage · ${p.dmg}</button><button type="button" class="btn" data-a="cbStyle" data-v="boost">${IC('sparkle')}${less} shift${less===1?'':'s'} + boost</button>`};
    }
    const nb = cb.aspects.find(a => a.boost && !a.t);
    if (nb && !(p && p.stage === 'defend'))
      return {tone:'turn', eye:'Name the boost', title:`${nb.by}’s boost${nb.on ? ` on ${nb.on}` : ''}`, sub:'A boost is gone once it’s invoked, or after its owner’s next two attacks or defenses.',
        acts:`<input class="inp" id="bname-${v.id}" data-i="boostName" value="${esc(v.ui.boostName||'')}" placeholder="e.g. Off Balance" style="flex:1;min-width:160px"><button type="button" class="btn gold" data-a="cbBoostName">${IC('check')}Name it</button>`};
    if (p && p.stage === 'absorb' && pd && g.chars[pd.ref])
      return {tok:pd, tone:'alert', eye:'Soak the hit', title:`${N.tokName(pd)} takes ${p.shifts} shift${pl(p.shifts)}`, sub:`Pick how ${N.tokName(pd)} soaks it. An invoke on the defense roll can still lower it.`,
        acts:soakBtns(g.chars[pd.ref], p) + `<button type="button" class="btn sm ghost" data-a="cbDrop">Settle it by hand</button>`};
    if (cur) return {tok:cur, tone:'turn', eye:cb.acted ? 'You act for · action done' : 'You act for', title:N.tokName(cur),
      acts:cb.acted ? moveBtn(v) + evBtn('btn sm') : actBar(v, cur), end:nextBtn('Next turn', cb.acted)};
    return {tone:'wait', eye:'Waiting', title:'Nobody on the board', sub:'Add someone and place them in a zone.'};
  }
  if (cb.phase) return {tone:'wait', eye:'The fight is on', title:'Rolling for turn order', sub:`${gmN} rolls Notice for everyone.`};
  if (p && me && p.def === me.id && p.stage === 'defend' && pa)
    return {tok:pa, tone:'alert', eye:'You’re attacked', title:`${N.tokName(pa)} attacks you!`, sub:`${p.skill} for ${sgn(p.total)} ${ladderWord(p.total)}. ${gmN} rolls your defense.`};
  if (p && me && p.def === me.id && p.stage === 'absorb')
    return {tok:me, tone:'alert', eye:'You’re hit', title:`You take ${p.shifts} shift${pl(p.shifts)}`, sub:`${gmN} picks how ${c ? c.short : 'you'} soak${c ? 's' : ''} it.`};
  if (cur && N.isMine(cur, v.role)) return {tok:cur, tone:'turn', eye:'Your turn', title:N.tokName(cur), sub:`${gmN} rolls for you. Say what ${c ? c.short : 'you'} do${c ? 'es' : ''} in the chat.`};
  const pw = p && p.stage === 'defend' && pa && pd ? `${N.tokName(pa)} attacks ${N.tokName(pd)}, ${gmN} rolls the defense.` : p && p.stage === 'style' && pa && pd ? `${N.tokName(pa)} hit ${N.tokName(pd)} with style. ${gmN} picks full damage or a boost.` : p && p.stage === 'absorb' && pd ? `${N.tokName(pd)} is soaking ${p.shifts} shift${pl(p.shifts)}.` : null;
  return {tok:cur, tone:'wait', eye:'Watching', title:cur ? `${N.tokName(cur)}’s turn` : 'Waiting', sub:pw || `${gmN} rolls for everyone. Watch the board.`};
}
const smallStress = t => { const st = N.tokStress(t); return `<span class="nb-st">${st.v.map((x,i) => `<i class="${st.s[i]?'on':''}"></i>`).join('')}</span>`; };
/* a fighter's consequence slots with what is in them. A player character and a named NPC use the slots on their card
   (src says where to write); nameless copies like "Bandit 2" keep their own on the token, starting from the card's */
N.tokConsSrc = t => {
  if (t.kind === 'pc') { const c = G().chars[t.ref]; return c ? {o:c, i:`data-i="con" data-c="${c.id}"`} : null; }
  const n = t.type !== 'nameless' && G().npcs.find(x => x.id === t.ref);
  if (n) return {o:n, i:`data-i="npcCon" data-n="${n.id}"`};
  return {o:{skills:t.skills, cons:t.cons || {mild:t.mild || ''}}, i:`data-i="tokCon" data-t="${t.id}"`};
};
N.tokCons = t => { const s = N.tokConsSrc(t); return s ? N.consSlots(s.o.skills).map(sl => Object.assign({v:(s.o.cons || {})[sl.k] || ''}, sl)) : []; };
const smallCons = t => { const cs = N.tokCons(t).filter(x => x.v); return cs.length ? `<small class="cq-ln">${IC('cards')}${cs.map(x => esc(x.v)).join(' · ')}</small>` : ''; };
const zoneTag = t => { const z = N.zoneOf(t); return z ? `<span class="nb-zt" style="--zc:${z.col}">${esc(z.name)}</span>` : ''; };
const gearTag = t => (N.tokGear(t, 'gearAtk') || N.tokGear(t, 'gearDef')) ? `<span class="nb-gear" title="Weapon and armor">${IC('sword')}${sgn(N.tokGear(t, 'gearAtk'))} ${IC('shieldU')}${sgn(N.tokGear(t, 'gearDef'))}</span>` : '';
function myStress(v){
  const c = N.charOf(v.role); if (!c || !c.built) return '';
  return `<div class="mine"><span class="lab">Phys</span>${c.stressV.phys.map((x,i)=>`<span class="sbox${c.stress.phys[i]?' on':''}">${x}</span>`).join('')}${(() => { const f = N.consSlots(c.skills).filter(sl => (c.cons || {})[sl.k]); return f.length ? `<span class="lab">Hurt</span>${f.map(sl => `<span class="cqt" title="${sl.l} consequence">${esc(c.cons[sl.k])}</span>`).join('')}` : ''; })()}<span class="lab">Fate</span><span class="coins">${N.coinsHtml(c,false)}</span></div>`;
}
function nowBar(v, ph){
  const n = nowState(v), t = n.tok, gm = isGM(v), c = N.charOf(v.role), s = ph ? 42 : 50;
  const who = t ? N.av(N.tokObj(t), s) : `<span class="av" style="--s:${s}px;--c:var(--ink-3)">${IC('eye')}</span>`;
  const line = t && n.tone === 'turn' && !n.sub ? `<span class="ln">${zoneTag(t)}${smallStress(t)}${gearTag(t)}${!gm && c ? `<span class="fp">${N.coinsHtml(c, false)}</span>` : ''}</span>` : `<small>${esc(n.sub || '')}</small>`;
  const eye = (n.tone === 'turn' ? N.STAR : n.tone === 'alert' ? IC('attack') : '') + esc(n.eye);
  return `<div class="nowbar ${n.tone}${n.cls ? ' ' + n.cls : ''}">
    <div class="who">${who}<div class="txt"><span class="eyebrow">${eye}</span><b>${esc(n.title)}</b>${line}</div>${ph && n.end ? `<div class="end">${n.end}</div>` : ''}</div>
    ${n.acts ? `<div class="acts">${n.acts}</div>` : ''}
    ${!ph && n.end ? `<div class="end">${n.end}</div>` : ''}
    ${!gm ? myStress(v) : ''}
  </div>`;
}
/* phones: the last result card and the last roll (open, with its Invoke button) under the board */
function latestHtml(v){
  const g = G(), ch = N.fightCh(), cb = g.combat, start = g.msgs.find(m => (m.kind === 'combat' || m.kind === 'fight') && m.cid === cb.id);
  const ms = g.msgs.filter(m => m.ch === ch && (!start || m.t >= start.t));
  const res = ms.findLast(m => m.kind === 'sys' && m.res && m.res.k === 'clash'), roll = ms.findLast(m => m.kind === 'roll');
  if (!res && !roll) return '';
  const keep = v._lastRoll; if (roll) v._lastRoll = roll.id;
  const rh = roll ? N.rRoll(v, roll) : ''; v._lastRoll = keep;
  return `<div class="fight-latest"><span class="eyebrow">Last in the fight<button type="button" class="lnk" data-a="pane" data-v="chat">Whole chat${IC('right')}</button></span>${res && (!roll || res.t > roll.t) ? N.resCard(res.res) + rh : rh + (res ? N.resCard(res.res) : '')}</div>`;
}
/* a GM's secret custom event in this fight: it lives in GM notes (players never get it) but shows in the GM's fight log */
const secretEv = (m, cid) => m.ch === 'gm' && m.kind === 'roll' && !!m.roll.cid && m.roll.cid === cid;
/* GM, phones: everything that happened in this fight as small lines in their own scroll, newest at the bottom */
function feedHtml(v){
  const g = G(), ch = N.fightCh(), cb = g.combat, start = g.msgs.find(m => (m.kind === 'combat' || m.kind === 'fight') && m.cid === cb.id);
  const ms = g.msgs.filter(m => (m.ch === ch || secretEv(m, cb.id)) && (!start || m.t >= start.t));
  const last = ms.findLast(m => m.kind === 'roll'), p = cb.pending;
  const live = m => isGM(v) && (m === last || (p && (m.id === p.msgId || m.id === p.defMsg)));
  /* only the fight: its rolls, results, notices and fight chat. Roleplay talk stays in the roleplay chat */
  const rows = ms.filter(m => (m === start || N.isFightAct(m)) && (!m.fc || m.fc === cb.id)).map(m => feedRow(m, live(m))).filter(Boolean).join('');
  return `<div class="ffeed"><span class="eyebrow">Fight log and chat<button type="button" class="lnk" data-a="pane" data-v="chat">Roleplay${IC('right')}</button></span>
    <div class="ff-list scroll" data-sk="ffeed" data-bottom="1">${rows || '<p class="muted">Rolls, results and fight chat show up here.</p>'}</div>${N.fightComposer(v)}</div>`;
}
/* desktop: the actions panel (B). Roleplay shows the chat's rolls and notices outside fights; combat shows this fight's
   rolls, results and notices. They are left out of the chat, so they show here as full cards (the newest roll open, with Invoke) */
function recentHtml(v, mode){
  const g = G(), cb = g.combat, start = mode === 'cb' && g.msgs.find(m => (m.kind === 'combat' || m.kind === 'fight') && m.cid === cb.id);
  const ms = g.msgs.filter(m => (m.ch === v.ui.ch || (mode === 'cb' && secretEv(m, cb.id))) && (mode === 'cb' ? N.isFightAct(m) && (!m.fc || m.fc === cb.id) && (!start || m.t >= start.t) : N.isAction(m) && !N.isFightAct(m))).slice(-60);
  const rows = actRows(v, ms);
  return `<div class="ff-list scroll" data-sk="recent-${mode}" data-bottom="1">${rows || `<p class="muted">${mode === 'cb' ? 'Rolls and results in this fight show up here.' : 'Rolls, stress, inventory and other notes from this chat show up here.'}</p>`}</div>`;
}
/* one action as it shows in the side panel or a fight's record: rolls and results as cards, fight chat as small bubbles, the rest as lines */
function actRows(v, ms, past){
  const g = G(), cb = g.combat, keep = v._lastRoll; v._lastRoll = past ? null : (ms.findLast(m => m.kind === 'roll') || {}).id;
  const live = m => (m.kind === 'fight' || m.kind === 'combat') && cb.state !== 'off' && m.cid === cb.id;
  const rows = ms.map(m => m.kind === 'roll' ? `<div class="rc-roll" data-mid="${m.id}"><div class="who">${esc(m.roll.who)}${m.ch === 'gm' ? '<span class="tag gold">Secret</span>' : ''}<time>${N.hhmm(m.t)}</time></div>${past ? N.rRoll(v, m).replace(/<button type="button" class="btn sm" data-a="invoke"[\s\S]*?<\/button>/, '') : N.rRoll(v, m)}</div>`
    : m.kind === 'sys' && m.res ? N.resCard(m.res).replace('<div class="resm', `<div data-mid="${m.id}" class="resm`)
    : m.fc ? `<div class="fcm${m.by === v.role ? ' mine' : ''}"><b>${esc(N.personObj(m.by).name)}</b><span>${N.emoText(esc(m.text))}</span><time>${N.hhmm(m.t)}</time></div>`
    : m.fightEnd ? `<div data-a="sheet" data-v="fightRec" data-c="${m.fightEnd}" title="See what happened" class="go ff end"><span class="ffi">${IC('swords')}</span><span class="fft">${esc(m.text)} <b>See what happened</b></span></div>`
    : live(m) ? feedRow(m, false).replace('<div class="ff', `<div data-a="mode" data-v="cb" title="Open the fight" class="go ff`)
    : feedRow(m, false)).join('');
  v._lastRoll = keep;
  return rows;
}
/* everything that belonged to one fight, from its start card to the note that it ended: rolls, results, notices and its chat */
N.fightMsgs = cid => {
  const g = G(), st = g.msgs.find(m => (m.kind === 'combat' || m.kind === 'fight') && m.cid === cid); if (!st) return [];
  const end = g.msgs.find(m => m.fightEnd === cid);
  return g.msgs.filter(m => (m.ch === st.ch || secretEv(m, cid)) && m.t >= st.t && (!end || m.t <= end.t) && (m === st || (N.isFightAct(m) && (!m.fc || m.fc === cid))));
};
N.fightRecHtml = (v, cid) => `<div class="ff-list fight-rec">${actRows(v, N.fightMsgs(cid), true) || '<p class="muted">Nothing was rolled in this fight.</p>'}</div>`;
N.recentHtml = recentHtml;
function feedRow(m, live){
  const line = (ic, body, cls='', end='') => `<div class="ff${cls}"><span class="ffi">${ic}</span><span class="fft">${body}</span>${end}</div>`;
  if (m.kind === 'roll') {
    const r = m.roll, tot = N.rollTotal(r), dice = r.dice.map(d => `<i class="${d>0?'p':d<0?'m':'z'}">${d>0?'+':d<0?'−':''}</i>`).join('');
    const inv = r.invokes.length ? ` · ${r.invokes.length} invoke${pl(r.invokes.length)}` : '';
    if (r.event) return line(`<span class="ffd">${dice}</span>`, `<b>${esc(r.who)}</b> ${esc(r.skill)} event${N.evText(r) ? `: ${esc(N.evText(r))}` : ''}${r.vs ? ` against ${esc(r.vs.name || r.vs.skill)}` : ''}${m.ch === 'gm' ? ' · secret' : ''}${inv}`, ' roll ev',
      `<b class="ffv">${sgn(tot)}${r.opp != null ? `<small> vs ${sgn(r.opp)}</small>` : ''}</b>${live && m.ch !== 'gm' ? `<button type="button" class="ffb" data-a="invoke" data-id="${m.id}">${IC('cards')}Invoke</button>` : ''}`);
    return line(`<span class="ffd">${dice}</span>`, `<b>${esc(r.who)}</b> ${esc(r.skill)} ${esc(r.action.toLowerCase())}${r.target ? ` ${r.action === 'Defend' ? 'against' : 'on'} ${esc(r.target)}` : ''}${inv}`, ' roll',
      `<b class="ffv">${sgn(tot)}</b>${live && m.ch !== 'gm' ? `<button type="button" class="ffb" data-a="invoke" data-id="${m.id}">${IC('cards')}Invoke</button>` : ''}`);
  }
  if (m.kind === 'sys' && m.res && m.res.k === 'clash') return line(IC('swords'), `<b>${esc(m.res.out?.t || '')}</b> ${esc(m.res.after || '')}`, ` res ${m.res.out?.k || ''}`);
  if (m.kind === 'sys' && m.res && m.res.k === 'order') return line(IC('clock'), `<b>Turn order</b> ${(m.res.rows || []).map(x => `${esc(x.n)} ${sgn(x.tot)}`).join(' · ')}`);
  if (m.kind === 'sys') return line(IC('info'), esc(m.text || ''));
  if (m.kind === 'combat' || m.kind === 'fight') return line(IC('swords'), `<b>The fight begins</b> ${esc(m.text || '')}`);
  if ((m.kind === 'rp' || m.kind === 'ooc' || m.kind === 'meta') && m.text) {
    const s = m.kind === 'rp' ? N.speakerObj(m) : N.personObj(m.by), x = m.text.replace(/[*_]/g, ''), t = x.length > 90 ? x.slice(0, 90) + '…' : x;
    return line(IC('chatL'), `<b>${esc(s.name || '')}</b> ${esc(t)}`, ' talk');
  }
  return '';
}

function moveBtn(v){
  return G().combat.moved ? '' : `<button type="button" class="btn sm" data-a="cbAct" data-v="move" aria-pressed="${v.ui.targeting==='move'}">${IC('boots')}Move</button>`;
}
/* GM only: a roll the four actions don't cover, like mind magic. Built like a roleplay roll, it lands in the fight log */
const evBtn = cls => `<button type="button" class="${cls} ev" data-a="cbAct" data-v="event" title="Custom event: a skill roll like mind magic">${IC('magic')}${cls === 'abtn' ? 'Event' : 'Custom event'}</button>`;
function actBar(v, t){
  const cb = G().combat, inZone = N.foesOf(t).length, owed = cb.pending;
  const tg = v.ui.targeting;
  return `<div class="actbar">
    <button type="button" class="abtn atk" data-a="cbAct" data-v="attack" aria-pressed="${tg==='attack'}" ${owed?'disabled title="Finish the last attack first"':inZone?'':'disabled title="Nobody to attack in this zone"'}>${IC('attack')}Attack</button>
    <button type="button" class="abtn" data-a="cbAct" data-v="advantage">${IC('advantage')}Advantage</button>
    <button type="button" class="abtn" data-a="cbAct" data-v="overcome">${IC('overcome')}Overcome</button>
    <button type="button" class="abtn" data-a="cbAct" data-v="move" aria-pressed="${tg==='move'}" ${cb.moved?'disabled title="Already moved this turn"':''}>${IC('boots')}Move</button>
    ${evBtn('abtn')}
  </div>`;
}
function gmRow(v){
  const cb = G().combat, tool = v.ui.cbTool || 'move';
  return `<div class="gmrow" role="toolbar" aria-label="GM tools">
    <button type="button" data-a="cbTool" data-v="move" aria-pressed="${tool==='move'}">${IC('hand')}Move</button>
    <button type="button" data-a="cbTool" data-v="zone" aria-pressed="${tool==='zone'}">${IC('zone')}Zones</button>
    <button type="button" data-a="sheet" data-v="addFoe">${IC('person-plus')}Add</button>
    <button type="button" data-a="sheet" data-v="cbAspect">${IC('cards')}Situation aspect</button>
    ${cb.state==='live'?`<button type="button" class="end" data-a="sheet" data-v="cbEnd">${IC('stop')}End fight</button>`:''}
  </div>`;
}
/* the defense skill: [skill, skill value]. Every defense is Athletics (Jake's rule), whatever the attack was.
   Armor doesn't change the roll. */
function defSkill(t){ return ['Athletics', N.tokSkills(t).Athletics || 0]; }
N.defSkill = defSkill;
const defBtn = t => { const [sk, x] = defSkill(t); return `<button type="button" class="btn gold" data-a="cbDefend">${N.fateDie}Defend: ${esc(sk)} ${sgn(x)}</button>`; };
N.defBtn = defBtn;
/* the token the GM has to defend or soak for right now (players never roll in a fight) */
N.owedTok = v => {
  const cb = G().combat, p = cb.pending; if (cb.state !== 'live' || !p) return null;
  const d = N.tokById(p.def); if (!d) return null;
  return isGM(v) ? d : null;
};
N.GEAR = [0,1,2,3,4,5,6,7,8,9];
N.gearSelect = (id, attrs, val) => `<select class="inp" id="${id}" ${attrs}>${N.GEAR.map(x => `<option value="${x}" ${(+val||0)===x?'selected':''}>${x?'+'+x:'None'}</option>`).join('')}</select>`;

/* token detail: side panel on desktop, sheet on phone */
N.tokCard = function(v, t){
  const g = G(), gm = isGM(v), o = N.tokObj(t), z = N.zoneOf(t), st = N.tokStress(t);
  const sk = Object.entries(N.tokSkills(t)).sort((a,b)=>b[1]-a[1]).slice(0,5);
  const asp = t.kind === 'pc' ? (() => { const c = g.chars[t.ref] || {aspects:[]}; return [c.hc, c.trouble, ...c.aspects]; })() : (t.aspects || []);
  const role = t.kind === 'pc' ? `Played by ${esc(g.P[g.chars[t.ref]?.player]?.name || 'a former player')}` : t.side === 'ally' ? 'Ally' : (t.type === 'nameless' ? 'Nameless foe' : 'Foe');
  return `<div class="tokcard">
    <div class="hd">${N.av(o,54)}<span style="flex:1;min-width:0"><b>${esc(N.tokName(t))}</b><small>${role} · ${z?esc(z.name):'Not placed'}${t.out?' · taken out':''}</small></span>${v.dev==='desktop'?`<button type="button" class="ibtn sm" data-a="tokClose" aria-label="Close">${IC('x')}</button>`:''}</div>
    ${asp.filter(Boolean).length ? `<div class="icards">${asp.filter(Boolean).map((a,i)=>`<span class="icard" style="--rot:${i%2?.6:-.6}deg">${esc(a)}</span>`).join('')}</div>` : ''}
    <div class="kv"><span>Stress</span><span class="boxes">${st.v.map((x,i)=>`<button type="button" class="sbox${st.s[i]?' on':''}" ${gm?`data-a="tokStress" data-t="${t.id}" data-i="${i}"`:'disabled'} aria-pressed="${st.s[i]}">${x}</button>`).join('')}</span>
      ${(() => {
        const cs = N.tokCons(t); if (!gm && t.kind !== 'pc' && !cs.some(x => x.v)) return '';
        const ed = sl => `<label class="cq-ed"><small>${sl.l}${sl.only ? ` · ${sl.only}` : ''}<i>${sl.lo}–${sl.hi}</i></small><input class="inp" id="tcon-${sl.k}-${t.id}-${v.id}" ${N.tokConsSrc(t).i} data-k="${sl.k}" value="${esc(sl.v)}" placeholder="Empty"></label>`;
        return `<span class="kv-w">Consequences</span><span class="kv-w cq-list${gm ? ' ed' : ''}">${cs.map(sl => gm ? ed(sl) : N.cqChip(sl)).join('')}</span>`;
      })()}
      ${gm || t.kind==='pc' ? `<span>Skills</span><span>${sk.map(([n,x])=>`${esc(n)} ${sgn(x)}`).join(' · ')}</span>` : ''}
      ${t.init != null ? `<span>Turn roll</span><span>Notice ${sgn(N.tokNotice(t))}, rolled ${sgn(t.init)} ${ladderWord(t.init)}</span>` : ''}
      ${gm ? `<span>Gear</span><span style="display:flex;gap:8px;flex-wrap:wrap"><label class="field" style="flex:1;min-width:110px"><span>Weapon</span>${N.gearSelect(`tga-${t.id}-${v.id}`, `data-i="tokGear" data-k="gearAtk" data-t="${t.id}" style="min-height:32px;padding:4px 10px"`, N.tokGear(t, 'gearAtk'))}</label><label class="field" style="flex:1;min-width:110px"><span>Armor</span>${N.gearSelect(`tgd-${t.id}-${v.id}`, `data-i="tokGear" data-k="gearDef" data-t="${t.id}" style="min-height:32px;padding:4px 10px"`, N.tokGear(t, 'gearDef'))}</label></span>` : (N.tokGear(t, 'gearAtk') || N.tokGear(t, 'gearDef')) ? `<span>Gear</span><span>Weapon ${sgn(N.tokGear(t, 'gearAtk'))} · Armor ${sgn(N.tokGear(t, 'gearDef'))}</span>` : ''}
    </div>
    ${gm ? `<div style="display:flex;gap:8px;flex-wrap:wrap">
      ${t.kind==='npc'?`<button type="button" class="btn sm" data-a="voice" data-v="${esc(t.name.replace(/ \d+$/,''))}" data-go="side">${IC('chatL')}Speak as</button><button type="button" class="btn sm" data-a="roll" data-who="tok:${t.id}">${N.fateDie}Roll</button>`:''}
      ${G().combat.state==='live' && !t.out ? `<button type="button" class="btn sm" data-a="tokTurn" data-t="${t.id}">${IC('play')}Give them the turn</button>`:''}
      <button type="button" class="btn sm ${t.out?'':'danger'}" data-a="tokOut" data-t="${t.id}">${t.out?IC('undo')+'Back in':IC('skull')+'Taken out'}</button>
      <button type="button" class="btn sm ghost" data-a="tokRemove" data-t="${t.id}">${IC('trash')}Remove</button>
    </div>` : ''}
  </div>`;
};

/* ---------- the whole fight view ---------- */
N.fightView = function(v){
  const g = G(), cb = g.combat, gm = isGM(v), ph = v.dev === 'phone';
  if (cb.state === 'setup') {
    const top = ph ? `<div class="top ph">${N.meBtn(v)}<h1>Fight setup</h1><button type="button" class="btn sm" data-a="pane" data-v="chat">${IC('chatL')}Chat</button></div>` : '';
    return `<section class="fight setup-mode" aria-label="Fight setup">${top}<div class="setup-head">${!ph?`<div><span class="eyebrow" style="color:var(--ember)">${IC('lock').replace('<svg','<svg style="width:12px;height:12px;display:inline;vertical-align:-1px;margin-right:5px"')}Only you see this until you start</span><h1 class="ttl" style="font-size:24px">${esc(cb.title)}</h1></div><span style="flex:1"></span>${gmRow(v)}<button type="button" class="btn sm ghost" data-a="closeFight">${IC('chatL')}Back to chat</button>`:''}</div>${boardHtml(v)}${ph ? `<div class="dock scroll setup-dock" data-sk="setupph"><div style="padding:0 12px">${gmRow(v)}</div>${N.setupPanel(v)}</div>` : ''}</section>`;
  }
  const sel = v.ui.tokSel && N.tokById(v.ui.tokSel);
  if (ph) {
    const board = boardHtml(v);
    return `<section class="fight cmd ph" aria-label="Fight on ${esc(cb.title)}">
      <div class="top ph">${N.meBtn(v)}<div style="flex:1;display:flex;justify-content:center">${N.fightSeg(v)}</div>${N.sideBtn(v)}</div>
      ${orderStrip(v, true)}
      <div class="fight-scroll scroll" data-sk="fightph">${board}${feedHtml(v)}</div>
      ${isGM(v) ? gmBanner(v) : pcMini(v)}
    </section>`;
  }
  return `<section class="fight cmd dt" aria-label="Fight on ${esc(cb.title)}">
    <header class="fight-h"><div class="tt"><span class="eyebrow">${IC('swords')}Fight · Exchange ${cb.exchange}</span><h1 class="ttl">${esc(cb.title)}</h1></div>
      ${orderStrip(v, false)}
      <button type="button" class="btn sm ghost" data-a="closeFight">${IC('chatL')}${gm?'Chat only':'Hide the board'}</button></header>
    <div class="fight-mid">${toolsHtml(v, false)}${boardHtml(v)}</div>
    ${nowBar(v, false)}
    ${sel ? `<div class="tokpanel glass" data-sk="tokpanel">${N.tokCard(v, sel)}</div>` : ''}
  </section>`;
};

/* phones, players: just what matters in a fight, your picture and name, stress, consequences and fate points */
function pcMini(v){
  const c = N.charOf(v.role); if (!c || !c.built) return '';
  const boxes = (k, l) => `<span class="pm-st"><small>${l}</small>${c.stressV[k].map((x,i) => `<span class="sbox${c.stress[k][i]?' on':''}">${x}</span>`).join('')}</span>`;
  const cs = N.consSlots(c.skills).map(sl => Object.assign({v:(c.cons || {})[sl.k] || ''}, sl)), full = cs.filter(x => x.v);
  const marks = `<span class="pm-st"><small>Cons</small>${cs.map(sl => `<span class="cqb${sl.v ? ' on' : ''}" title="${sl.l}${sl.v ? ': ' + esc(sl.v) : ', empty'}">${sl.hi}</span>`).join('')}</span>`;
  return `<div class="pcmini">${N.av(c, 38)}<b>${esc(c.short)}</b>${boxes('phys', 'Phys')}${boxes('ment', 'Mind')}${marks}<span class="coins">${N.coinsHtml(c, false)}</span>${full.length ? `<span class="pm-cq">${full.map(N.cqChip).join('')}</span>` : ''}</div>`;
}
/* phones, GM: a slim banner says what is up now; tapping it pulls up the fight controls */
function gmBanner(v){
  const n = nowState(v), t = n.tok;
  return `<button type="button" class="gmban ${n.tone}" data-a="sheet" data-v="gmFight">${t ? N.av(N.tokObj(t), 32) : `<span class="av" style="--s:32px;--c:var(--ink-3)">${IC('crown')}</span>`}<span class="t"><small>${esc(n.eye)}</small><b>${esc(n.title)}</b></span><span class="go">Controls${IC('caret').replace('<svg', '<svg style="rotate:180deg"')}</span></button>`;
}
/* the controls the banner pulls up: the turn's actions, then the GM tools. Any of them closes the sheet again */
N.gmFightBody = v => `<div class="gmfs">${nowBar(v, true)}${gmRow(v)}</div>`;

/* ---------- desktop combat screen ----------
   players: the battlefield big (C), their card (A), the fight results (B).
   GM: the fight controls big (C), the battlefield (A), the fight results (B). */
N.combatDesk = function(v){
  const g = G(), cb = g.combat, gm = isGM(v), sel = v.ui.tokSel && N.tokById(v.ui.tokSel);
  const head = `<header class="fight-h"><div class="tt"><span class="eyebrow">${IC('swords')}Fight · Exchange ${cb.exchange}</span><h1 class="ttl">${esc(cb.title)}</h1></div>${gm ? '<span style="flex:1"></span>' : orderStrip(v, false)}${N.modeSeg(v)}</header>`;
  const board = `<div class="fight-mid">${boardHtml(v)}</div>`;
  if (!gm) return N.deskPage(v, `<section class="fight cmd dt" aria-label="Fight on ${esc(cb.title)}">${head}${board}${nowBar(v, false)}${sel ? `<div class="tokpanel glass" data-sk="tokpanel">${N.tokCard(v, sel)}</div>` : ''}</section>`,
    `<div class="rail-a scroll" data-sk="rail">${N.heroQuick(v)}</div>`, 'cb');
  const toks = cb.tokens.filter(t => t.zone).sort((a, b) => (a.kind === 'pc' ? 0 : a.side === 'ally' ? 1 : 2) - (b.kind === 'pc' ? 0 : b.side === 'ally' ? 1 : 2));
  const fighters = toks.map(t => `<button type="button" class="cm-f${t.out ? ' out' : ''}${sel === t ? ' on' : ''}" data-tok="${t.id}">${N.av(N.tokObj(t), 34)}<span class="nm"><b>${esc(N.tokName(t))}</b><small>${t.kind === 'pc' ? 'Player' : t.side === 'ally' ? 'Ally' : 'Foe'}${t.out ? ' · taken out' : ''}</small>${smallCons(t)}</span>${zoneTag(t)}${smallStress(t)}</button>`).join('');
  const ctl = `<section class="fight cmd dt cm-gm" aria-label="Fight controls">${head}
    <div class="cm-ctl scroll" data-sk="cmctl">
      ${orderStrip(v, false)}
      ${nowBar(v, false)}
      <div class="cm-cols">
        <section class="gs-sec"><div class="gs-h"><h3>GM tools</h3></div><div class="fight-tools cm-tools">${toolList(v)}</div>
          ${sel ? `<div class="cm-tok">${N.tokCard(v, sel)}</div>` : '<p class="muted cm-hint">Click someone on the battlefield or in the list to see their card here.</p>'}</section>
        <section class="gs-sec"><div class="gs-h"><h3>Fighters</h3></div><div class="cm-fl">${fighters}</div></section>
      </div>
    </div></section>`;
  return N.deskPage(v, ctl, `<div class="rail-a"><section class="fight cmd dt cm-bf" aria-label="Battlefield">${board}</section></div>`, 'cb', 'cm-gmpage');
};

/* ---------- GM setup panel ---------- */
N.setupPanel = function(v){
  const g = G(), cb = g.combat, tray = cb.tokens.filter(t => !t.zone), placed = cb.tokens.filter(t => t.zone);
  const pcs = N.pcsIn(cb.ch);
  const sc = g.scenes[N.fightCh()];
  const bgs = [...(sc && sc.art ? [{src:sc.art, label:sc.title, sub:'Current scene'}] : []), ...(cb.bg && cb.bg.startsWith('fs:') ? [{src:cb.bg, label:'Your picture', sub:'Uploaded'}] : []), ...g.pics.map(p => ({src:p.src, label:'Your picture', sub:'Uploaded'})),
    {src:'img/bf-eastfork.jpg', label:'East Fork Road', sub:'Drinkhold map'}, ...N.ARTLIB.map(a => ({src:a.art, label:a.label, sub:'Picture'}))].filter((x,i,arr) => arr.findIndex(y => y.src === x.src) === i);
  const step = (n, done, title, body) => `<div class="step${done?' done':''}"><span class="n">${done?IC('check'):n}</span><b>${title}</b><div class="c">${body}</div></div>`;
  const zs = v.ui.zoneSel && cb.zones.find(z => z.id === v.ui.zoneSel);
  return `<div class="setup">
    ${v.dev==='phone' ? `<p class="muted" style="margin:0;font:600 12.5px/1.4 var(--f-ui);display:flex;gap:6px;align-items:center">${IC('lock').replace('<svg','<svg style="width:14px;height:14px;flex:none"')}Players see nothing until you press Start.</p>` : ''}
    <div class="steps">
      ${step(1, cb.invited.length > 0, 'Players', `<div class="inv-chips">${pcs.map(c => c.built
          ? `<button type="button" data-a="cbInvite" data-v="${c.id}" aria-pressed="${cb.invited.includes(c.id)}">${N.av(c,30)}${esc(c.short)}${cb.invited.includes(c.id)?IC('check'):''}</button>`
          : `<button type="button" disabled style="opacity:.55">${N.av({name:g.P[c.player]?.name||'?',color:c.color},30)}${esc(g.P[c.player]?.name||'?')} · no card</button>`).join('') || '<span class="muted" style="font:600 13px/1.4 var(--f-ui)">Nobody has a seat yet.</span>'}</div>
          <small>They stand in the first zone you draw. You roll for everyone; players watch.</small>`)}
      ${step(2, true, 'Battlefield', `<label class="field"><span class="vh">Name of the fight</span><input class="inp" id="cbt-${v.id}" data-i="cbTitle" value="${esc(cb.title)}" placeholder="Where the fight happens"></label>
        <div class="hscroll"><button type="button" class="thumb up" data-a="cbBgUpload" style="width:128px"><span>${IC('upload')}Upload</span></button>${bgs.map(b => `<button type="button" class="thumb${cb.bg===b.src?' on':''}" data-a="cbBg" data-v="${esc(b.src)}" style="width:128px">${N.bgPic(b.src)}<span>${esc(b.label)}<small>${esc(b.sub)}</small></span>${cb.bg===b.src?`<span class="ck">${IC('check')}</span>`:''}</button>`).join('')}</div>${cb.bg ? `<div><button type="button" class="btn sm ghost fr-adj" data-a="picFrame" data-v="fight">${IC('fit')}Adjust framing</button></div>` : ''}`)}
      ${step(3, cb.zones.length > 0, 'Zones', `<small>${(v.ui.cbTool||'move')==='zone' ? 'Drag on the map to draw a zone. Drag a name to move it, the corner to resize.' : 'Zones are what matter: people can only attack inside their own zone.'}</small>
        ${cb.zones.length ? `<div class="zlist">${cb.zones.map(z => `<div class="zi" style="--zc:${z.col}${v.ui.zoneSel===z.id?';box-shadow:inset 0 0 0 1.5px var(--gold)':''}"><i></i><span>${esc(z.name)}${z.aspect?`<small>${esc(z.aspect)}</small>`:''}</span><button type="button" class="ibtn sm" data-a="zoneEdit" data-v="${z.id}" aria-label="Edit ${esc(z.name)}">${IC('pen')}</button></div>`).join('')}</div>` : ''}
        ${zs && v.dev==='desktop' ? zoneForm(v, zs) : ''}
        <div style="display:flex;gap:8px;flex-wrap:wrap"><button type="button" class="btn sm ${(v.ui.cbTool||'move')==='zone'?'primary':''}" data-a="cbTool" data-v="${(v.ui.cbTool||'move')==='zone'?'move':'zone'}">${IC('zone')}${(v.ui.cbTool||'move')==='zone'?'Done drawing':'Draw zones'}</button>${cb.zones.length?'':`<button type="button" class="btn sm ghost" data-a="cbQuickZones">${IC('sparkle')}Quick: 3 zones</button>`}</div>`)}
      ${step(4, cb.tokens.some(t => t.kind === 'npc'), 'Enemies and allies', `${N.foeList(false)}<button type="button" class="btn sm ghost" data-a="npcNew">${IC('plus')}Make a new NPC</button>`)}
      ${step(5, tray.length === 0 && placed.length > 0, 'Place everyone', `<small>${tray.length ? 'Drag onto a zone, or tap a token and then a zone.' : placed.length ? 'Everyone is on the board. Drag tokens to rearrange.' : 'Invite players or add foes first.'}</small>
        <div class="tray" data-tray="1">${tray.length ? tray.map(t => tokHtml(v, t)).join('') : '<span class="empty">Nobody waiting</span>'}</div>`)}
    </div>
    <div style="display:grid;gap:8px;position:sticky;bottom:0;padding:12px 0 2px;background:linear-gradient(0deg,var(--page-solid) 70%,transparent)">
      <button type="button" class="btn gold lg block" data-a="cbStart" ${cb.zones.length && placed.length ? '' : 'disabled'}>${IC('swords')}Start the fight</button>
      <button type="button" class="btn sm ghost block" data-a="cbCancelSetup">Cancel this fight</button>
    </div>
  </div>`;
};
function zoneForm(v, z){
  return `<div class="zform" style="display:grid;gap:8px;padding:10px;border-radius:14px;background:var(--sunk);box-shadow:inset 0 0 0 1px var(--line)">
    <label class="field"><span>Zone name</span><input class="inp" id="zn-${z.id}-${v.id}" data-i="zone" data-k="name" data-z="${z.id}" value="${esc(z.name)}"></label>
    <label class="field"><span>Zone aspect (optional)</span><input class="inp" id="za-${z.id}-${v.id}" data-i="zone" data-k="aspect" data-z="${z.id}" value="${esc(z.aspect||'')}" placeholder="e.g. Slick Wet Planks"></label>
    <div style="display:flex;gap:6px;align-items:center">${N.ZCOL.map(c => `<button type="button" data-a="zoneCol" data-z="${z.id}" data-v="${c}" aria-label="Colour" style="width:26px;height:26px;border-radius:8px;background:${c};box-shadow:${z.col===c?'0 0 0 2px var(--page-solid),0 0 0 4px '+c:'none'}"></button>`).join('')}<span style="flex:1"></span><button type="button" class="btn sm danger" data-a="zoneDel" data-z="${z.id}">${IC('trash')}Delete</button></div>
  </div>`;
}
N.zoneForm = zoneForm;

/* ---------- state changes ---------- */
const sys = text => Object.assign(N.sys(text, N.fightCh()), {fight:true});
/* NPC cards and the enemies built in the old "Add enemies" form, ready to drop into a fight */
N.foeList = place => {
  const g = G(), row = (av, name, sub, a, id) => `<div class="zi" style="padding:5px 5px 5px 6px">${av}<span>${esc(name)}<small style="font-style:normal;font-family:var(--f-ui)">${esc(sub)}</small></span><button type="button" class="btn sm" data-a="${a}" data-v="${id}" data-side="foe"${place?' data-place="1"':''} style="--h:30px">${IC('plus')}Foe</button><button type="button" class="btn sm ghost" data-a="${a}" data-v="${id}" data-side="ally"${place?' data-place="1"':''} style="--h:30px">Ally</button></div>`;
  const list = g.npcs.map(n => row(N.av({name:n.name,portrait:n.portrait,color:'var(--c-npc)'},30), n.name, n.type==='nameless'?'Nameless':(N.pcTag(n) || 'Supporting'), 'cbAddNpc', n.id))
    .concat(g.foes.map((f,i) => row(N.av({name:f.name,color:'var(--c-foe)'},30), f.name, `${f.type==='nameless'?'Nameless':'Supporting'} · built earlier`, 'cbAddFoe', i)));
  return list.length ? `<div class="zlist">${list.join('')}</div>` : '<p class="muted" style="margin:0;font:600 13px/1.4 var(--f-ui)">No NPC cards yet.</p>';
};
N.cbBegin = function(ch){
  ch = ch && ch !== 'gm' ? ch : 'table'; N.focusFight(ch);
  const g = G(), cb = g.combat = N.freshCombat();
  cb.state = 'setup'; cb.id = N.uid('f'); cb.ch = ch;
  const built = N.pcsIn(cb.ch).filter(c => c.built);
  cb.invited = built.map(c => c.id);
  built.forEach(c => cb.tokens.push(N.tokFromPc(c)));
};
N.cbQuickZones = function(){
  const cb = G().combat;
  [['West bank',3,18,31,48],['The bridge',36,24,24,50],['East bank',62,14,35,58]].forEach(([name,x,y,w,h],i) => cb.zones.push({id:N.uid('z'), name, x, y, w, h, col:N.ZCOL[i], aspect:''}));
  N.cbPlacePcs();
};
/* the players picked for a fight stand in the first zone as soon as there is one */
N.cbPlacePcs = () => { const cb = G().combat, z = cb.zones[0]; if (z) cb.tokens.forEach(t => { if (t.kind === 'pc' && !t.zone) t.zone = z.id; }); };
N.cbAddNpc = function(nid, side, zone){
  const g = G(), cb = g.combat, n = g.npcs.find(x => x.id === nid); if (!n) return null;
  const same = cb.tokens.filter(t => t.ref === nid).length;
  const t = N.tokFromNpc(n, side, same ? `${n.name} ${same+1}` : null);
  if (same === 1) { const first = cb.tokens.find(x => x.ref === nid); if (first && first.name === n.name) first.name = n.name + ' 1'; }
  t.zone = zone || null;
  cb.tokens.push(t); N.cbLateInit(t); return t;
};
N.cbAddFoe = function(i, side, zone){
  const g = G(), cb = g.combat, f = g.foes[i]; if (!f) return null;
  const same = cb.tokens.filter(t => t.ref === 'foe:' + f.name).length;
  const t = N.tokFromNpc({id:'foe:' + f.name, name:f.name, type:f.type, skills:f.skills, aspects:f.aspects || [], gearAtk:f.gearAtk, gearDef:f.gearDef}, side, `${f.name} ${same + 1}`);
  t.zone = zone || null; cb.tokens.push(t); N.cbLateInit(t); return t;
};
/* turn order comes from a Notice roll: 4 Fate dice + Notice. The fight starts in the 'notice' phase, the GM
   presses Notice roll ('pick' phase: everyone's result shows and he can choose who goes first), then Start. */
N.rollInit = t => { const dice = N.rollDice(); t.initDice = dice; t.init = dice.reduce((a,b) => a+b, 0) + N.tokNotice(t); return t; };
N.cbStart = function(){
  const g = G(), cb = g.combat;
  if (!cb.title.trim()) cb.title = 'A fight';
  cb.state = 'live'; cb.phase = 'notice'; cb.lead = null; cb.turn = 0; cb.exchange = 1; cb.joined = []; cb.acted = false; cb.moved = false;
  N.push({ch:cb.ch, kind:'combat', by:'gm', cid:cb.id, text:cb.title, bg:cb.bg});
};
N.cbNotice = function(){
  const cb = G().combat; if (cb.state !== 'live' || cb.phase !== 'notice') return;
  cb.tokens.forEach(N.rollInit);
  cb.phase = 'pick'; cb.lead = null; cb.turn = 0;
  const ord = N.order();
  if (ord.length) N.push({ch:cb.ch, kind:'sys', by:'gm', text:'Turn order by Notice roll: ' + ord.map((t,i) => `${i+1}. ${N.tokName(t)} ${sgn(t.init)}`).join(', ') + '.',
    res:{k:'order', rows:ord.map(t => ({n:N.tokName(t), sk:N.tokNotice(t), d:t.initDice, tot:t.init}))}});
};
/* the GM picks who goes first: they lead the turn order for the rest of the fight */
N.cbFirst = id => { const cb = G().combat; cb.lead = id; cb.turn = 0; };
N.cbGo = function(){
  const cb = G().combat; if (cb.phase !== 'pick') return;
  cb.phase = null; cb.turn = 0; cb.acted = false; cb.moved = false;
  const cur = N.curTok(); if (cur) sys(`${N.tokName(cur)} goes first.`);
};
/* someone added once the turn order is rolled rolls Notice right away */
N.cbLateInit = t => { const cb = G().combat; if (cb.state !== 'live' || cb.phase === 'notice' || t.init != null) return; N.rollInit(t); sys(`${N.tokName(t)} rolls Notice for their turn: ${sgn(t.init)} ${ladderWord(t.init)}.`); };
N.cbNext = function(){
  const cb = G().combat, n = N.order().length;
  cb.turn++; if (n && cb.turn % n === 0) { cb.exchange++; cb.turn = 0; }
  cb.acted = false; cb.moved = false;
  /* an attack still waiting on its defense or its soak stays open into the next turn */
  if (n && cb.turn === 0) sys(`Exchange ${cb.exchange} begins.`);
};
N.cbEnd = function(){
  const g = G();
  /* the end note stays in the roleplay actions; tapping it opens everything that happened in the fight */
  const cb = g.combat; Object.assign(N.sys(`The fight on ${cb.title || 'the field'} is over. Stress stays on your cards until the scene ends.`, N.fightCh()), {fightEnd:cb.id});
  g.combat = N.freshCombat();
};
N.cbMove = function(t, zid){
  const z = G().combat.zones.find(x => x.id === zid);
  if (!z || t.zone === zid) return false;
  t.zone = zid;
  if (G().combat.state === 'live') sys(`${N.tokName(t)} moves to ${z.name}.`);
  return true;
};
N.applyHit = function(t, shifts, fx){
  /* GM side: put shifts on an NPC the simple way. fx (optional) remembers what changed so it can be taken back. */
  if (t.kind === 'npc') {
    const i = t.stressV.findIndex((x,k) => !t.stress[k] && x >= shifts);
    if (i >= 0) { t.stress[i] = true; if (fx) fx.box = i; return `${N.tokName(t)} checks their ${t.stressV[i]}-stress box.`; }
    t.out = true; if (fx) fx.out = true; return `${N.tokName(t)} can’t soak ${shifts} shift${shifts>1?'s':''} and is taken out!`;
  }
  return '';
};

/* A boost: a very short-lived fight aspect. Its owner (tok) can invoke it once for free; then it is gone.
   The GM names it (t is '' until then). It lasts for its owner's next two attacks or defenses (left counts
   down at the start of each one) and fades if it isn't invoked by then. on = who it was put on. */
N.addBoost = (owner, on, t) => { const b = {id:N.uid('b'), t:t || '', free:1, boost:true, by:N.tokName(owner), tok:owner.id, on:on ? N.tokName(on) : '', left:2}; G().combat.aspects.push(b); return b; };
N.boostTick = t => {
  const cb = G().combat; if (!t) return;
  cb.aspects = cb.aspects.filter(a => {
    if (!a.boost || a.tok !== t.id) return true;
    if ((a.left ?? 2) <= 0) { sys(`${a.by}’s boost${a.t ? ` “${a.t}”` : ''} fades unused.`); return false; }
    a.left = (a.left ?? 2) - 1; return true;
  });
};

/* After both rolls: compare them, post one clear result line, and hit the defender.
   The rolls decide hit, tie or miss. On a hit the attacker's weapon adds its rating to the shifts and the
   defender's armor takes its rating off (never below 0). A tie does no harm (gear doesn't count) and gives the
   attacker a boost on the defender; defending with style (3+) gives the defender one.
   Attacking with style (3+ on the rolls, with damage left after armor) lets the GM pick full damage or 2 less
   plus a boost on the defender (pending.stage 'style', then N.cbStyle).
   An NPC soaks automatically; a player character picks a stress box or consequence (pending.stage 'absorb'). */
const rollLine = (name, r) => ({n:name, sk:r.skill, b:r.bonus, g:r.gear || 0, tot:N.rollTotal(r)});
N.cbResolve = function(again){
  const g = G(), cb = g.combat, p = cb.pending; if (!p || !p.defMsg) return;
  const a = N.tokById(p.att), d = N.tokById(p.def), am = g.msgs.find(m => m.id === p.msgId), dm = g.msgs.find(m => m.id === p.defMsg);
  if (!a || !d || !dm) { cb.pending = null; return; }
  const an = N.tokName(a), dn = N.tokName(d), dt = N.rollTotal(dm.roll), sh = p.total - dt;
  const wpn = sh > 0 ? N.tokGear(a, 'gearAtk') : 0, arm = sh > 0 ? N.tokGear(d, 'gearDef') : 0;
  const dmg = Math.max(0, sh + wpn - arm - (p.boosted ? 2 : 0)), fx = p.fx = p.fx || {};
  const boost = (o, on) => { (fx.boosts = fx.boosts || []).push(N.addBoost(o, on).id); };
  let out, after, calc = null, fo;
  if (sh > 0) {
    if (wpn || arm || p.boosted) calc = `Hit by ${sh}${wpn ? ` · weapon +${wpn}` : ''}${arm ? ` · armor −${arm}` : ''}${p.boosted ? ' · traded −2 for a boost' : ''} = ${dmg} shift${dmg===1?'':'s'}`;
    const style = sh >= 3 && dmg > 0 && !p.boosted;
    out = {k:'hit', t:dmg ? `Hit${style ? ' with style' : ''} · ${dmg} shift${dmg>1?'s':''}` : 'Hit · armor holds'};
    if (!dmg) { after = `${dn}’s armor takes the whole blow. No harm done.`; N.cbSettled(p); fo = 'armor'; }
    else if (style) { p.stage = 'style'; p.dmg = dmg; after = `${N.gmName()} picks: the full ${dmg} shift${dmg>1?'s':''}, or ${Math.max(0, dmg - 2)} and a boost on ${dn}.`; fo = 'style'; }
    else if (d.kind === 'npc') { after = N.applyHit(d, dmg, fx); N.cbSettled(p); fo = fx.out ? 'out' : 'hit'; }
    else { p.stage = 'absorb'; p.shifts = dmg; after = `${dn} must soak ${dmg} shift${dmg>1?'s':''}: check a stress box or take a consequence.`; fo = 'hit'; }
  } else if (sh === 0) { out = {k:'tie', t:'Tie'}; after = `No harm done. ${an} gets a boost on ${dn}.`; N.cbSettled(p); boost(a, d); fo = 'tie'; }
  else { out = {k:'miss', t:sh <= -3 ? 'Defended with style' : 'Defended'}; after = `${dn} turns the attack aside${sh <= -3 ? ` and gets a boost on ${an}` : ''}. No harm done.`; N.cbSettled(p); if (sh <= -3) boost(d, a); fo = sh <= -3 ? 'bstyle' : 'block'; }
  const att = am ? rollLine(an, am.roll) : {n:an, sk:p.skill, b:0, g:0, tot:p.total}; att.tot = p.total;
  const title = `${an} attacks ${dn}${again ? ', after invokes' : ''}`;
  const res = {k:'clash', title, rows:[att, rollLine(dn, dm.roll)], out, after};
  if (calc) res.calc = calc;
  /* what every screen's board plays (js/fx.js): the weapon from the attack skill, the outcome, and the box the hit checked */
  res.anim = {att:a.id, def:d.id, wpn:N.fxWeapon ? N.fxWeapon(p.skill) : 'sword', out:fo, dmg};
  if (fx.box != null) res.anim.box = fx.box;
  N.push({ch:N.fightCh(), kind:'sys', by:g.role, text:`${title}: ${sgn(p.total)} against ${sgn(dt)}. ${calc ? calc + '. ' : ''}${out.t}. ${after}`, res});
};
/* the GM's pick after an attack with style: the full damage, or 2 less and a boost on the defender */
N.cbStyle = function(choice){
  const cb = G().combat, p = cb.pending; if (!p || p.stage !== 'style') return;
  const a = N.tokById(p.att), d = N.tokById(p.def); if (!a || !d) { cb.pending = null; return; }
  const an = N.tokName(a), dn = N.tokName(d);
  let dmg = p.dmg;
  const fx = p.fx = p.fx || {};
  if (choice === 'boost') { dmg = Math.max(0, dmg - 2); p.boosted = true; (fx.boosts = fx.boosts || []).push(N.addBoost(a, d).id); }
  const how = choice === 'boost' ? `${an} takes 2 off the damage and puts a boost on ${dn}.` : `${an} goes for the full damage.`;
  if (!dmg) { N.cbSettled(p); sys(`${how} No harm done.`); return; }
  if (d.kind === 'npc') { N.cbSettled(p); sys(`${how} ${dmg} shift${dmg>1?'s':''}: ${N.applyHit(d, dmg, fx)}`); return; }
  p.stage = 'absorb'; p.shifts = dmg; sys(`${how} ${dn} must soak ${dmg} shift${dmg>1?'s':''}.`);
};
/* An attack is settled once its harm is on the cards. It stays as combat.last until the next attack, so an invoke
   on either of its rolls can still change the outcome: N.cbReresolve takes back what it did (stress box, taken out,
   consequence, boosts, the style pick) and settles it again with the new totals. */
N.cbSettled = p => { const cb = G().combat; cb.pending = null; cb.last = p; };
N.cbUndo = function(p){
  const g = G(), cb = g.combat, fx = p.fx || {}, d = N.tokById(p.def);
  if (d && d.kind === 'npc') { if (fx.box != null) d.stress[fx.box] = false; if (fx.out) d.out = false; }
  const c = d && d.kind === 'pc' && g.chars[d.ref];
  if (c && fx.pc) {
    if (fx.pc.k === 'box') c.stress.phys[fx.pc.i] = false;
    else if (fx.pc.k === 'out') d.out = false;
    else if (c.cons[fx.pc.k] === 'Hurt in the fight') c.cons[fx.pc.k] = '';
  }
  if (fx.boosts) cb.aspects = cb.aspects.filter(a => !fx.boosts.includes(a.id));
  p.fx = {}; p.boosted = false; delete p.shifts; delete p.dmg; p.stage = 'defend';
};
N.cbReresolve = function(m){
  const g = G(), cb = g.combat, p = cb.pending, l = cb.last;
  let q = null;
  if (p && p.defMsg && (m.id === p.msgId || m.id === p.defMsg)) q = p;
  else if (!p && l && (m.id === l.msgId || m.id === l.defMsg)) q = l;
  if (!q) return;
  /* the defense roll's card shows the attack it faced: keep it in step */
  if (m.id === q.msgId) { q.total = N.rollTotal(m.roll); const dm = g.msgs.find(x => x.id === q.defMsg); if (dm) dm.roll.opp = q.total; }
  N.cbUndo(q); cb.pending = q; cb.last = null;
  N.cbResolve(true);
};
})();
