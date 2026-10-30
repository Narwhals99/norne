/* Norne: the fight. One board, two ends: the GM runs it, players act on their turn. */
(function(){
const N = window.N, {esc, IC, sgn, ladderWord} = N;
const G = () => N.G;
const isGM = v => v.role === 'gm';

/* who is acting from this screen right now */
N.actorTok = v => {
  const cb = G().combat, cur = N.curTok();
  if (cb.state !== 'live' || !cur) return null;
  if (isGM(v)) return cur.kind === 'npc' ? cur : null;
  return N.isMine(cur, v.role) ? cur : null;
};
N.myTok = v => isGM(v) ? null : G().combat.tokens.find(t => N.isMine(t, v.role));

function tokHtml(v, t, size){
  const g = G(), cb = g.combat, o = N.tokObj(t), st = N.tokStress(t), cur = N.curTok(), name = N.tokName(t);
  const cls = ['tok'];
  if (cb.state === 'live' && cur === t) cls.push('now');
  if (v.ui.tokSel === t.id || v.ui.placing === t.id) cls.push('sel');
  if (t.out) cls.push('out');
  if (t.kind === 'pc' && cb.state === 'live' && !cb.joined.includes(g.chars[t.ref]?.player)) cls.push('wait');
  const actor = N.actorTok(v) || (isGM(v) && v.ui.targeting ? cur : null);
  if (v.ui.targeting === 'attack' && actor && t !== actor && !t.out) cls.push(actor.zone === t.zone && N.sideOf(t) !== N.sideOf(actor) ? 'target' : 'nope');
  const p = cb.pending;
  const hit = p && (p.def === t.id) ? ' style="--ring:var(--ember)"' : '';
  const mine = N.isMine(t, v.role);
  if (mine) cls.push('me');
  return `<button type="button" class="${cls.join(' ')}" data-tok="${t.id}" aria-label="${esc(name)}${t.out?' (taken out)':''}"${hit}>${N.av(o, size)}<span class="nm">${mine?'You':esc(name)}</span>${t.out?'':`<span class="st">${st.v.map((x,i)=>`<i class="${st.s[i]?'on':''}"></i>`).join('')}</span>`}${t.kind==='npc'&&t.side==='ally'?`<span class="ji" title="Ally">${IC('heart')}</span>`:''}</button>`;
}
N.tokHtml = tokHtml;

function boardHtml(v){
  const g = G(), cb = g.combat, gm = isGM(v);
  const tool = gm ? (v.ui.cbTool || 'move') : 'move';
  const actor = N.actorTok(v) || (gm && v.ui.targeting ? N.curTok() : null);
  const edit = gm && tool === 'zone';
  const zones = cb.zones.map(z => {
    const cls = ['zone'];
    if (v.ui.targeting === 'attack' && actor) cls.push(z.id === actor.zone ? 'reach' : 'dim');
    if (v.ui.targeting === 'move' && actor) cls.push(z.id === actor.zone ? 'sel' : 'reach');
    if (v.ui.placing) cls.push('reach');
    if (gm && v.ui.zoneSel === z.id && edit) cls.push('sel');
    const toks = cb.tokens.filter(t => t.zone === z.id);
    return `<div class="${cls.join(' ')}" data-zone="${z.id}" style="left:${z.x}%;top:${z.y}%;width:${z.w}%;height:${z.h}%;--zc:${z.col}">
      <span class="zl" data-zl="${z.id}">${esc(z.name)}${toks.length?` <i>${toks.filter(t=>!t.out).length}</i>`:''}</span>
      <div class="ztoks">${toks.map(t => tokHtml(v, t)).join('')}</div>
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
  const sasp = cb.aspects.length ? `<div class="sasp">${cb.aspects.map((a,i) => `<span class="icard" style="--rot:${i%2?.8:-.8}deg">${esc(a.t)}${a.free?`<span class="fi">${'<i></i>'.repeat(a.free)}</span>`:''}</span>`).join('')}</div>` : '';
  return `<div class="boardwrap"><div class="board${edit?' edit drawing':''}" data-board="1" aria-label="Battlefield: ${esc(cb.title)}">
    <div class="bg" style="background-image:url(${esc(N.imgUrl(cb.bg) || N.FIGHTBG)})"></div>
    ${zones}${sasp}${hint}
  </div></div>`;
}

/* turn order: one line of faces, the one acting is named and lit gold */
function orderStrip(v, ph){
  const cb = G().combat, ord = N.order(), cur = N.curTok(), outs = cb.tokens.filter(t => t.out);
  const nm = t => N.isMine(t, v.role) ? 'You' : esc(N.tokName(t));
  return `<div class="fight-order" aria-label="Turn order"><span class="ex">Exch.<b>${cb.exchange}</b></span>
    ${ord.map((t,i) => `<button type="button" class="ot${t===cur?' now':''}" data-tok="${t.id}" aria-label="${esc(N.tokName(t))}${t===cur?', acting now':''}">${N.av(N.tokObj(t), t===cur ? (ph?34:36) : (ph?28:30))}${t===cur || !ph ? `<span>${nm(t)}</span>` : ''}</button>${i < ord.length-1 ? '<i class="ar"></i>' : ''}`).join('')}
    ${outs.map(t => `<button type="button" class="ot out" data-tok="${t.id}" aria-label="${esc(N.tokName(t))} (taken out)">${N.av(N.tokObj(t), ph?24:26)}</button>`).join('')}
  </div>`;
}

/* GM tools: a rail beside the board on desktop, one button on the board on phones that opens them */
function toolList(v){
  const cb = G().combat, tool = v.ui.cbTool || 'move';
  return [[`data-a="cbTool" data-v="move" aria-pressed="${tool==='move'}"`, 'hand', 'Move'], [`data-a="cbTool" data-v="zone" aria-pressed="${tool==='zone'}"`, 'zone', 'Zones'],
    [`data-a="sheet" data-v="addFoe"`, 'person-plus', 'Add'], [`data-a="sheet" data-v="cbAspect"`, 'cards', 'Aspect'], cb.state === 'live' ? [`data-a="sheet" data-v="cbEnd"`, 'stop', 'End fight', 1] : null].filter(Boolean)
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
function nowState(v){
  const g = G(), cb = g.combat, gm = isGM(v), cur = N.curTok(), p = cb.pending, me = N.myTok(v), c = N.charOf(v.role);
  const nextBtn = (lab, primary) => `<button type="button" class="btn${primary?' primary':''}" data-a="cbNext">${lab}${IC('next')}</button>`;
  if (gm) {
    if (p && p.stage === 'defend' && N.tokById(p.def).kind === 'npc') { const d = N.tokById(p.def), a = N.tokById(p.att);
      return {tok:d, tone:'alert', eye:'Defend', title:`${N.tokName(a)} attacks ${N.tokName(d)}`, sub:`${p.skill} for ${sgn(p.total)} ${ladderWord(p.total)}. Roll their defense.`, acts:defBtn(d)}; }
    if (p && p.stage === 'defend') { const d = N.tokById(p.def);
      return {tok:d, tone:'wait', eye:'Waiting on a defense', title:`${N.tokName(d)} is defending`, sub:`${N.tokName(N.tokById(p.att))} rolled ${sgn(p.total)} ${ladderWord(p.total)}. If their player is away, roll it for them.`, acts:`<button type="button" class="btn" data-a="cbDefend">${N.fateDie}Roll for them</button>`}; }
    if (p && p.stage === 'absorb') { const d = N.tokById(p.def);
      return {tok:d, tone:'wait', eye:'Taking the hit', title:`${N.tokName(d)} soaks ${p.shifts} shift${pl(p.shifts)}`, sub:'Their player picks a stress box or a consequence.', acts:`<button type="button" class="btn ghost" data-a="cbDrop">Settle it by hand</button>`}; }
    if (cur && cur.kind === 'npc') return {tok:cur, tone:'turn', eye:cb.acted ? 'You act for · action done' : 'You act for', title:N.tokName(cur),
      acts:cb.acted ? moveBtn(v) : actBar(v, cur), end:nextBtn('Next turn', cb.acted)};
    if (cur) { const pp = g.chars[cur.ref]?.player, joined = cb.joined.includes(pp), who = g.P[pp]?.name || 'Their player';
      return {tok:cur, tone:'wait', eye:'Player’s turn', title:`${N.tokName(cur)} is up`, sub:joined ? `${who} picks an action on their screen.` : `${who} hasn’t joined yet. Skip with Next turn, or wait.`, end:nextBtn('Next turn')}; }
    return {tone:'wait', eye:'Waiting', title:'Nobody on the board', sub:'Add someone and place them in a zone.'};
  }
  if (!cb.joined.includes(v.role) && !(p && me && p.def === me.id)) { const inv = c && cb.invited.includes(c.id);
    return {tone:'wait', eye:'Watching', title:'You’re watching', sub:inv ? `${N.gmName()} added you to this fight.` : 'You’re not in this fight.', acts:inv ? `<button type="button" class="btn gold" data-a="join">${IC('swords')}Join</button>` : ''}; }
  if (p && me && p.def === me.id && p.stage === 'defend') { const a = N.tokById(p.att);
    return {tok:a, tone:'alert', eye:'You’re attacked', title:`${N.tokName(a)} attacks you!`, sub:`${p.skill} for ${sgn(p.total)} ${ladderWord(p.total)}. Roll your defense to beat it.`, acts:defBtn(me)}; }
  if (p && me && p.def === me.id && p.stage === 'absorb') {
    const opts = c.stressV.phys.map((x,i) => (!c.stress.phys[i] && x >= p.shifts) ? `<button type="button" class="btn sm" data-a="cbAbsorb" data-k="box" data-i="${i}"><span class="sbox" style="width:20px;height:20px">${x}</span>Stress box</button>` : '').join('');
    const cons = N.consSlots(c.skills).filter(sl => sl.only !== 'Mental' && !c.cons[sl.k] && sl.hi >= p.shifts).slice(0,1).map(sl => `<button type="button" class="btn sm" data-a="cbAbsorb" data-k="${sl.k}">${IC('cards')}${sl.l} consequence</button>`).join('');
    return {tok:me, tone:'alert', eye:'Soak the hit', title:`You take ${p.shifts} shift${pl(p.shifts)}`, sub:`Pick how ${c.short} soaks it. You can still invoke an aspect on your defense roll to lower it.`,
      acts:`${opts}${cons}<button type="button" class="btn sm danger" data-a="cbAbsorb" data-k="out">Taken out</button>`}; }
  if (cur && N.isMine(cur, v.role)) return {tok:cur, tone:'turn', eye:cb.acted ? 'Your turn · action done' : 'Your turn', title:cb.acted ? 'Anything else?' : N.tokName(cur),
    sub:cb.acted ? 'You can still move one zone, or end your turn.' : '', acts:cb.acted ? moveBtn(v) : actBar(v, cur), end:nextBtn('End my turn', cb.acted)};
  const pw = p && p.stage === 'defend' ? `${N.tokName(N.tokById(p.att))} attacks ${N.tokName(N.tokById(p.def))}, waiting for the defense roll.` : p && p.stage === 'absorb' ? `${N.tokName(N.tokById(p.def))} is soaking ${p.shifts} shift${pl(p.shifts)}.` : null;
  return {tok:cur, tone:'wait', eye:'Waiting', title:cur ? `${N.tokName(cur)}’s turn` : 'Waiting', sub:pw || (cur && cur.kind === 'npc' ? `${N.gmName()} is deciding what they do.` : 'Their player is choosing.')};
}
const smallStress = t => { const st = N.tokStress(t); return `<span class="nb-st">${st.v.map((x,i) => `<i class="${st.s[i]?'on':''}"></i>`).join('')}</span>`; };
const zoneTag = t => { const z = N.zoneOf(t); return z ? `<span class="nb-zt" style="--zc:${z.col}">${esc(z.name)}</span>` : ''; };
const gearTag = t => t.kind === 'npc' && (t.gearAtk || t.gearDef) ? `<span class="nb-gear" title="Gear">${IC('sword')}${sgn(t.gearAtk||0)} ${IC('shieldU')}${sgn(t.gearDef||0)}</span>` : '';
function myStress(v){
  const c = N.charOf(v.role); if (!c || !c.built) return '';
  return `<div class="mine"><span class="lab">Phys</span>${c.stressV.phys.map((x,i)=>`<span class="sbox${c.stress.phys[i]?' on':''}">${x}</span>`).join('')}<span class="lab">Fate</span><span class="coins">${N.coinsHtml(c,false)}</span></div>`;
}
function nowBar(v, ph){
  const n = nowState(v), t = n.tok, gm = isGM(v), c = N.charOf(v.role), s = ph ? 42 : 50;
  const who = t ? N.av(N.tokObj(t), s) : `<span class="av" style="--s:${s}px;--c:var(--ink-3)">${IC('eye')}</span>`;
  const line = t && n.tone === 'turn' && !n.sub ? `<span class="ln">${zoneTag(t)}${smallStress(t)}${gearTag(t)}${!gm && c ? `<span class="fp">${N.coinsHtml(c, false)}</span>` : ''}</span>` : `<small>${esc(n.sub || '')}</small>`;
  const eye = (n.tone === 'turn' ? N.STAR : n.tone === 'alert' ? IC('attack') : '') + esc(n.eye);
  return `<div class="nowbar ${n.tone}">
    <div class="who">${who}<div class="txt"><span class="eyebrow">${eye}</span><b>${esc(n.title)}</b>${line}</div>${ph && n.end ? `<div class="end">${n.end}</div>` : ''}</div>
    ${n.acts ? `<div class="acts">${n.acts}</div>` : ''}
    ${!ph && n.end ? `<div class="end">${n.end}</div>` : ''}
    ${!gm && n.tone !== 'turn' ? myStress(v) : ''}
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

function moveBtn(v){
  return G().combat.moved ? '' : `<button type="button" class="btn sm" data-a="cbAct" data-v="move" aria-pressed="${v.ui.targeting==='move'}">${IC('boots')}Move</button>`;
}
function actBar(v, t){
  const cb = G().combat, inZone = N.foesOf(t).length, owed = cb.pending;
  const tg = v.ui.targeting;
  return `<div class="actbar">
    <button type="button" class="abtn atk" data-a="cbAct" data-v="attack" aria-pressed="${tg==='attack'}" ${owed?'disabled title="Finish the last attack first"':inZone?'':'disabled title="Nobody to attack in this zone"'}>${IC('attack')}Attack</button>
    <button type="button" class="abtn" data-a="cbAct" data-v="advantage">${IC('advantage')}Advantage</button>
    <button type="button" class="abtn" data-a="cbAct" data-v="overcome">${IC('overcome')}Overcome</button>
    <button type="button" class="abtn" data-a="cbAct" data-v="move" aria-pressed="${tg==='move'}" ${cb.moved?'disabled title="Already moved this turn"':''}>${IC('boots')}Move</button>
  </div>`;
}
function gmRow(v){
  const cb = G().combat, tool = v.ui.cbTool || 'move';
  return `<div class="gmrow" role="toolbar" aria-label="GM tools">
    <button type="button" data-a="cbTool" data-v="move" aria-pressed="${tool==='move'}">${IC('hand')}Move</button>
    <button type="button" data-a="cbTool" data-v="zone" aria-pressed="${tool==='zone'}">${IC('zone')}Zones</button>
    <button type="button" data-a="sheet" data-v="addFoe">${IC('person-plus')}Add</button>
    <button type="button" data-a="sheet" data-v="cbAspect">${IC('cards')}Aspect</button>
    ${cb.state==='live'?`<button type="button" class="end" data-a="sheet" data-v="cbEnd">${IC('stop')}End fight</button>`:''}
  </div>`;
}
/* the better of Athletics and Fighting, plus any gear defense bonus: [skill, skill value, gear] */
function defSkill(t){
  const s = N.tokSkills(t);
  const opts = [['Athletics', s.Athletics||0], ['Fighting', s.Fighting||0]];
  return [...opts.sort((a,b) => b[1]-a[1])[0], N.tokGear(t, 'gearDef')];
}
N.defSkill = defSkill;
const defBtn = t => { const [sk, x, gear] = defSkill(t); return `<button type="button" class="btn gold" data-a="cbDefend">${N.fateDie}Defend: ${esc(sk)} ${sgn(x + gear)}${gear?`<small style="font-weight:600;opacity:.8">&nbsp;incl. gear</small>`:''}</button>`; };
N.defBtn = defBtn;
/* the token this screen has to defend or soak for right now (a player's own character, or any NPC for the GM) */
N.owedTok = v => {
  const cb = G().combat, p = cb.pending; if (cb.state !== 'live' || !p) return null;
  const d = N.tokById(p.def); if (!d) return null;
  return (isGM(v) ? d.kind === 'npc' : N.isMine(d, v.role)) ? d : null;
};
/* gear bonus a roll gets: attack rolls use gearAtk, defend rolls gearDef (NPC tokens and NPC cards only) */
N.rollGear = (key, action) => {
  const k = action === 'attack' ? 'gearAtk' : action === 'defend' ? 'gearDef' : null;
  if (!k || !key) return 0;
  if (key.startsWith('tok:')) return N.tokGear(N.tokById(key.slice(4)), k);
  if (key.startsWith('npc:')) { const n = G().npcs.find(x => x.id === key.slice(4)); return +(n && n[k]) || 0; }
  return 0;
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
      ${gm || t.kind==='pc' ? `<span>Skills</span><span>${sk.map(([n,x])=>`${esc(n)} ${sgn(x)}`).join(' · ')}</span>` : ''}
      ${t.init != null ? `<span>Turn roll</span><span>Notice ${sgn(N.tokNotice(t))}, rolled ${sgn(t.init)} ${ladderWord(t.init)}</span>` : ''}
      ${t.kind==='npc' && gm ? `<span>Gear</span><span style="display:flex;gap:8px;flex-wrap:wrap"><label class="field" style="flex:1;min-width:110px"><span>Attack</span>${N.gearSelect(`tga-${t.id}-${v.id}`, `data-i="tokGear" data-k="gearAtk" data-t="${t.id}" style="min-height:32px;padding:4px 10px"`, t.gearAtk)}</label><label class="field" style="flex:1;min-width:110px"><span>Defense</span>${N.gearSelect(`tgd-${t.id}-${v.id}`, `data-i="tokGear" data-k="gearDef" data-t="${t.id}" style="min-height:32px;padding:4px 10px"`, t.gearDef)}</label></span>` : t.kind==='npc' && (t.gearAtk || t.gearDef) ? `<span>Gear</span><span>Attack ${sgn(t.gearAtk||0)} · Defense ${sgn(t.gearDef||0)}</span>` : ''}
      ${t.kind==='npc' && gm ? `<span>Mild</span><span><input class="inp" id="tmild-${t.id}-${v.id}" data-i="tokMild" data-t="${t.id}" value="${esc(t.mild||'')}" placeholder="Empty" style="min-height:32px;padding:4px 10px"></span>` : t.kind==='npc' && t.mild ? `<span>Mild</span><span>${esc(t.mild)}</span>` : ''}
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
    const board = boardHtml(v) + (isGM(v) ? gmRow(v) : '');
    return `<section class="fight cmd ph" aria-label="Fight on ${esc(cb.title)}">
      <div class="top ph">${N.meBtn(v)}<div style="flex:1;display:flex;justify-content:center">${N.fightSeg(v)}</div>${N.sideBtn(v)}</div>
      ${orderStrip(v, true)}
      <div class="fight-scroll scroll" data-sk="fightph">${board}${latestHtml(v)}</div>
      ${nowBar(v, true)}
    </section>`;
  }
  return `<section class="fight cmd dt" aria-label="Fight on ${esc(cb.title)}">
    <header class="fight-h"><div class="tt"><span class="eyebrow">${IC('swords')}Fight · Exchange ${cb.exchange}</span><h1 class="ttl">${esc(cb.title)}</h1></div>
      ${orderStrip(v, false)}
      <button type="button" class="btn sm ghost" data-a="closeFight">${IC('chatL')}${gm?'Chat only':'Hide the board'}</button></header>
    <div class="fight-mid">${toolsHtml(v, false)}${boardHtml(v)}</div>
    ${nowBar(v, false)}
    ${sel ? `<div class="tokpanel glass">${N.tokCard(v, sel)}</div>` : ''}
  </section>`;
};

/* ---------- GM setup panel ---------- */
N.setupPanel = function(v){
  const g = G(), cb = g.combat, tray = cb.tokens.filter(t => !t.zone), placed = cb.tokens.filter(t => t.zone);
  const pcs = N.pcsIn(cb.ch);
  const sc = g.scenes[N.fightCh()];
  const bgs = [...(sc && sc.art ? [{src:sc.art, label:sc.title, sub:'Current scene'}] : []), ...(cb.bg && cb.bg.startsWith('fs:') ? [{src:cb.bg, label:'Your picture', sub:'Uploaded'}] : []),
    {src:'img/bf-eastfork.jpg', label:'East Fork Road', sub:'Drinkhold map'}, ...N.ARTLIB.map(a => ({src:a.art, label:a.label, sub:'Picture'}))].filter((x,i,arr) => arr.findIndex(y => y.src === x.src) === i);
  const step = (n, done, title, body) => `<div class="step${done?' done':''}"><span class="n">${done?IC('check'):n}</span><b>${title}</b><div class="c">${body}</div></div>`;
  const zs = v.ui.zoneSel && cb.zones.find(z => z.id === v.ui.zoneSel);
  return `<div class="setup">
    ${v.dev==='phone' ? `<p class="muted" style="margin:0;font:600 12.5px/1.4 var(--f-ui);display:flex;gap:6px;align-items:center">${IC('lock').replace('<svg','<svg style="width:14px;height:14px;flex:none"')}Players see nothing until you press Start.</p>` : ''}
    <div class="steps">
      ${step(1, true, 'Battlefield', `<label class="field"><span class="vh">Name of the fight</span><input class="inp" id="cbt-${v.id}" data-i="cbTitle" value="${esc(cb.title)}" placeholder="Where the fight happens"></label>
        <div class="hscroll">${bgs.map(b => `<button type="button" class="thumb${cb.bg===b.src?' on':''}" data-a="cbBg" data-v="${esc(b.src)}" style="background-image:url(${esc(N.imgUrl(b.src))});width:128px"><span>${esc(b.label)}<small>${esc(b.sub)}</small></span>${cb.bg===b.src?`<span class="ck">${IC('check')}</span>`:''}</button>`).join('')}<button type="button" class="thumb up" data-a="cbBgUpload" style="width:128px"><span>${IC('upload')}Upload</span></button></div>`)}
      ${step(2, cb.zones.length > 0, 'Zones', `<small>${(v.ui.cbTool||'move')==='zone' ? 'Drag on the map to draw a zone. Drag a name to move it, the corner to resize.' : 'Zones are what matter: people can only attack inside their own zone.'}</small>
        ${cb.zones.length ? `<div class="zlist">${cb.zones.map(z => `<div class="zi" style="--zc:${z.col}${v.ui.zoneSel===z.id?';box-shadow:inset 0 0 0 1.5px var(--gold)':''}"><i></i><span>${esc(z.name)}${z.aspect?`<small>${esc(z.aspect)}</small>`:''}</span><button type="button" class="ibtn sm" data-a="zoneEdit" data-v="${z.id}" aria-label="Edit ${esc(z.name)}">${IC('pen')}</button></div>`).join('')}</div>` : ''}
        ${zs && v.dev==='desktop' ? zoneForm(v, zs) : ''}
        <div style="display:flex;gap:8px;flex-wrap:wrap"><button type="button" class="btn sm ${(v.ui.cbTool||'move')==='zone'?'primary':''}" data-a="cbTool" data-v="${(v.ui.cbTool||'move')==='zone'?'move':'zone'}">${IC('zone')}${(v.ui.cbTool||'move')==='zone'?'Done drawing':'Draw zones'}</button>${cb.zones.length?'':`<button type="button" class="btn sm ghost" data-a="cbQuickZones">${IC('sparkle')}Quick: 3 zones</button>`}</div>`)}
      ${step(3, cb.invited.length > 0, 'Players', `<div class="inv-chips">${pcs.map(c => c.built
          ? `<button type="button" data-a="cbInvite" data-v="${c.id}" aria-pressed="${cb.invited.includes(c.id)}">${N.av(c,30)}${esc(c.short)}${cb.invited.includes(c.id)?IC('check'):''}</button>`
          : `<button type="button" disabled style="opacity:.55">${N.av({name:g.P[c.player]?.name||'?',color:c.color},30)}${esc(g.P[c.player]?.name||'?')} · no card</button>`).join('') || '<span class="muted" style="font:600 13px/1.4 var(--f-ui)">Nobody has a seat yet.</span>'}</div>
          <small>Invited players get a Join button when you start.</small>`)}
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
const sys = text => N.sys(text, N.fightCh());
/* NPC cards and the enemies built in the old "Add enemies" form, ready to drop into a fight */
N.foeList = place => {
  const g = G(), row = (av, name, sub, a, id) => `<div class="zi" style="padding:5px 5px 5px 6px">${av}<span>${esc(name)}<small style="font-style:normal;font-family:var(--f-ui)">${esc(sub)}</small></span><button type="button" class="btn sm" data-a="${a}" data-v="${id}" data-side="foe"${place?' data-place="1"':''} style="--h:30px">${IC('plus')}Foe</button><button type="button" class="btn sm ghost" data-a="${a}" data-v="${id}" data-side="ally"${place?' data-place="1"':''} style="--h:30px">Ally</button></div>`;
  const list = g.npcs.map(n => row(N.av({name:n.name,portrait:n.portrait,color:'var(--c-npc)'},30), n.name, n.type==='nameless'?'Nameless':(N.pcTag(n) || 'Supporting'), 'cbAddNpc', n.id))
    .concat(g.foes.map((f,i) => row(N.av({name:f.name,color:'var(--c-foe)'},30), f.name, `${f.type==='nameless'?'Nameless':'Supporting'} · built earlier`, 'cbAddFoe', i)));
  return list.length ? `<div class="zlist">${list.join('')}</div>` : '<p class="muted" style="margin:0;font:600 13px/1.4 var(--f-ui)">No NPC cards yet.</p>';
};
N.cbBegin = function(ch){
  const g = G(), cb = g.combat = N.freshCombat();
  cb.state = 'setup'; cb.id = N.uid('f'); cb.ch = ch && ch !== 'gm' ? ch : 'table';
  const built = N.pcsIn(cb.ch).filter(c => c.built);
  cb.invited = built.map(c => c.id);
  built.forEach(c => cb.tokens.push(N.tokFromPc(c)));
};
N.cbQuickZones = function(){
  const cb = G().combat;
  [['West bank',3,18,31,48],['The bridge',36,24,24,50],['East bank',62,14,35,58]].forEach(([name,x,y,w,h],i) => cb.zones.push({id:N.uid('z'), name, x, y, w, h, col:N.ZCOL[i], aspect:''}));
};
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
/* turn order comes from a Notice roll: 4 Fate dice + Notice, made once when the fight starts */
N.rollInit = t => { const dice = N.rollDice(); t.initDice = dice; t.init = dice.reduce((a,b) => a+b, 0) + N.tokNotice(t); return t; };
N.cbStart = function(){
  const g = G(), cb = g.combat;
  if (!cb.title.trim()) cb.title = 'A fight';
  cb.state = 'live'; cb.turn = 0; cb.exchange = 1; cb.joined = []; cb.acted = false; cb.moved = false;
  cb.tokens.forEach(N.rollInit);
  N.push({ch:cb.ch, kind:'combat', by:'gm', cid:cb.id, text:cb.title, bg:cb.bg});
  const ord = N.order();
  if (ord.length) N.push({ch:cb.ch, kind:'sys', by:'gm', text:'Turn order by Notice roll: ' + ord.map((t,i) => `${i+1}. ${N.tokName(t)} ${sgn(t.init)}`).join(', ') + '.',
    res:{k:'order', rows:ord.map(t => ({n:N.tokName(t), sk:N.tokNotice(t), d:t.initDice, tot:t.init}))}});
};
/* someone added once the fight is live rolls Notice right away */
N.cbLateInit = t => { if (G().combat.state !== 'live' || t.init != null) return; N.rollInit(t); sys(`${N.tokName(t)} rolls Notice for their turn: ${sgn(t.init)} ${ladderWord(t.init)}.`); };
N.cbNext = function(){
  const cb = G().combat, n = N.order().length;
  cb.turn++; if (n && cb.turn % n === 0) { cb.exchange++; cb.turn = 0; }
  cb.acted = false; cb.moved = false;
  /* an attack still waiting on its defense or its soak stays open into the next turn */
  if (n && cb.turn === 0) sys(`Exchange ${cb.exchange} begins.`);
};
N.cbEnd = function(){
  const g = G();
  sys('The fight is over. Stress stays on your cards until the scene ends.');
  g.combat = N.freshCombat();
};
N.cbMove = function(t, zid){
  const z = G().combat.zones.find(x => x.id === zid);
  if (!z || t.zone === zid) return false;
  t.zone = zid;
  if (G().combat.state === 'live') sys(`${N.tokName(t)} moves to ${z.name}.`);
  return true;
};
N.applyHit = function(t, shifts){
  /* GM side: put shifts on an NPC the simple way */
  if (t.kind === 'npc') {
    const i = t.stressV.findIndex((x,k) => !t.stress[k] && x >= shifts);
    if (i >= 0) { t.stress[i] = true; return `${N.tokName(t)} checks their ${t.stressV[i]}-stress box.`; }
    t.out = true; return `${N.tokName(t)} can’t soak ${shifts} shift${shifts>1?'s':''} and is taken out!`;
  }
  return '';
};

/* After both rolls: compare them, post one clear result line, and hit the defender.
   An NPC soaks automatically; a player character picks a stress box or consequence (pending.stage 'absorb'). */
const rollLine = (name, r) => ({n:name, sk:r.skill, b:r.bonus, g:r.gear || 0, tot:N.rollTotal(r)});
N.cbResolve = function(again){
  const g = G(), cb = g.combat, p = cb.pending; if (!p || !p.defMsg) return;
  const a = N.tokById(p.att), d = N.tokById(p.def), am = g.msgs.find(m => m.id === p.msgId), dm = g.msgs.find(m => m.id === p.defMsg);
  if (!a || !d || !dm) { cb.pending = null; return; }
  const an = N.tokName(a), dn = N.tokName(d), dt = N.rollTotal(dm.roll), sh = p.total - dt;
  if (again && sh > 0 && sh === p.shifts) return;
  let out, after;
  if (sh > 0) {
    out = {k:'hit', t:`Hit · ${sh} shift${sh>1?'s':''}`};
    if (d.kind === 'npc') { after = N.applyHit(d, sh); cb.pending = null; }
    else { p.stage = 'absorb'; p.shifts = sh; after = `${dn} must soak ${sh} shift${sh>1?'s':''}: check a stress box or take a consequence.`; }
  } else if (sh === 0) { out = {k:'tie', t:'Tie'}; after = `${dn} is grazed: no harm done, but ${an} gets a boost.`; cb.pending = null; }
  else { out = {k:'miss', t:sh <= -3 ? 'Defended with style' : 'Defended'}; after = `${dn} turns the attack aside${sh <= -3 ? ' and gets a boost' : ''}. No harm done.`; cb.pending = null; }
  const att = am ? rollLine(an, am.roll) : {n:an, sk:p.skill, b:0, g:0, tot:p.total}; att.tot = p.total;
  const title = `${an} attacks ${dn}${again ? ', after invokes' : ''}`;
  N.push({ch:N.fightCh(), kind:'sys', by:g.role, text:`${title}: ${sgn(p.total)} against ${sgn(dt)}. ${out.t}. ${after}`,
    res:{k:'clash', title, rows:[att, rollLine(dn, dm.roll)], out, after}});
};
/* an invoke on either roll while the defender is still soaking changes the result: post it again */
N.cbReresolve = function(m){
  const p = G().combat.pending;
  if (p && p.stage === 'absorb' && (m.id === p.msgId || m.id === p.defMsg)) N.cbResolve(true);
};
})();
