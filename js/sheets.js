/* Norne: sheets (bottom sheets on phones, dialogs on desktop). */
(function(){
const N = window.N, {esc, IC, sgn, ladderWord} = N;
const G = () => N.G;
const isGM = v => v.role === 'gm';
const sheet = (title, body, foot, o={}) => `<div class="sheet${o.wide?' wide':''}" role="dialog" aria-modal="true" aria-label="${esc(title)}">
  <div class="sh-h">${o.lead||''}<h2 class="ttl">${title}</h2><button type="button" class="ibtn" data-a="closeSheet" aria-label="Close">${IC('x')}</button></div>
  <div class="sh-b scroll" data-sk="sheet">${body}</div>${foot ? `<div class="sh-f">${foot}</div>` : ''}</div>`;
const PORTRAITS = ['human-fighter','rogue-woman','elf-archer','dwarf-warrior','mage-woman','soldier-woman','noble-duelist','priest','bandit-woman','thug','innkeeper','town-guard','noble-queen','goblin-spearman','wizard-old','vampire-lady'];
N.PORTRAITS = PORTRAITS;
const pName = s => G().P[s]?.name || 'A former player';
const lockIc = IC('lock').replace('<svg','<svg style="width:13px;height:13px;display:inline;vertical-align:-2px;margin-right:4px"');
/* who sees a wiki entry, map or edition: Everyone, single players, or (wiki and maps) only the GM */
N.audPick = (act, x, kind) => {
  const a = N.audOf(x, kind), on = s => Array.isArray(a) && a.includes(s);
  return `<div class="forwho" role="group" aria-label="Who sees it">
    <button type="button" data-a="${act}" data-v="*" aria-pressed="${a==='*'}"><span class="cic">${IC('users')}</span>Everyone</button>
    ${N.seats().map(s => `<button type="button" data-a="${act}" data-v="${s}" aria-pressed="${on(s)}">${N.av(N.personObj(s),28)}${esc(pName(s))}</button>`).join('')}
    ${kind === 'news' ? '' : `<button type="button" data-a="${act}" data-v="gm" aria-pressed="${a==='gm'}"><span class="cic">${IC('eyeoff')}</span>Only me</button>`}</div>
    <p class="muted" style="margin:6px 0 0;font:600 12.5px/1.4 var(--f-ui)">${a === '*' ? 'Every player sees it.' : a === 'gm' ? 'Hidden from every player until you share it.' : `${esc(N.audLabel(x, kind).replace(/^Only /, ''))} ${a.length > 1 ? 'see' : 'sees'} it. Tap more players to add them.`}</p>`;
};

/* who can this screen roll for */
N.rollers = v => {
  const g = G();
  if (!isGM(v)) { const c = N.charOf(v.role); return c && c.built ? [{key:'pc:'+c.id, name:c.short, portrait:c.portrait, color:c.color, skills:c.skills}] : []; }
  const out = [];
  if (g.combat.state === 'live') g.combat.tokens.filter(t => t.kind === 'npc' && !t.out).forEach(t => out.push({key:'tok:'+t.id, name:t.name, portrait:t.portrait, color:t.side==='ally'?'var(--c-npc)':'var(--c-foe)', skills:t.skills || {}}));
  g.npcs.forEach(n => out.push({key:'npc:'+n.id, name:n.name, portrait:n.portrait, color:'var(--c-npc)', skills:n.skills}));
  N.pcs().filter(c => c.built).forEach(c => out.push({key:'pc:'+c.id, name:c.short, portrait:c.portrait, color:c.color, skills:c.skills}));
  out.push({key:'other', name:'Someone else', color:'var(--line-3)', skills:{}, other:true});
  return out;
};
N.rollerOf = (v, key) => N.rollers(v).find(r => r.key === key) || N.rollers(v)[0];

N.sheetHtml = function(v){
  const g = G(), gm = isGM(v), s = v.ui.sheet, arg = v.ui.sheetArg;
  switch (s) {
  /* ---------------- roll ---------------- */
  case 'roll': {
    const r = v.ui.roll, who = N.rollerOf(v, r.who);
    if (!who) return sheet('Roll the dice', `<div class="quiet"><div class="art"></div><p>You can roll once ${esc(N.gmName())} has made your character card.</p></div>`);
    const other = who.key === 'other';
    const skills = Object.entries(who.skills).sort((a,b) => b[1]-a[1]);
    const rest = N.MUNDANE.filter(k => !(k in who.skills));
    const cb = g.combat, tokOfWho = r.who.startsWith('tok:') ? N.tokById(r.who.slice(4)) : r.who.startsWith('pc:') ? cb.tokens.find(t => t.kind==='pc' && t.ref === r.who.slice(3)) : null;
    const inFight = isGM(v) && cb.state === 'live' && tokOfWho && tokOfWho.zone && !tokOfWho.out;
    const targets = inFight ? N.foesOf(tokOfWho) : [];
    const bonus = other ? (+r.otherBonus || 0) : (who.skills[r.skill] ?? 0);
    const fightAtk = r.action === 'attack' && inFight;
    const whoAv = o => o.other ? `<span class="av" style="--s:44px;--c:var(--line-3);box-shadow:none;background:var(--sunk);color:var(--ink-3)">${IC('person-plus').replace('<svg','<svg style="width:20px;height:20px"')}</span>` : N.av(o,44);
    const body = `
      ${gm ? `<div><h4>Who rolls</h4><div class="who-row">${N.rollers(v).map(o => `<button type="button" data-a="rollWho" data-v="${o.key}" aria-pressed="${o.key===who.key}">${whoAv(o)}<span>${esc(o.name)}</span></button>`).join('')}</div></div>` : ''}
      ${other ? `<div style="display:grid;gap:10px;grid-template-columns:repeat(auto-fit,minmax(180px,1fr))"><label class="field"><span>Name</span><input class="inp" id="rother-${v.id}" data-i="rollOther" value="${esc(r.otherName)}" placeholder="e.g. City watch guard"></label>
        <div class="field"><span>Bonus</span><div class="seg" style="justify-content:space-between;width:100%"><button type="button" data-a="rollBonus" data-d="-1" aria-label="Less">${IC('minus')}</button><b style="align-self:center;font:700 18px/1 var(--f-display)">${sgn(bonus)}</b><button type="button" data-a="rollBonus" data-d="1" aria-label="More">${IC('plus')}</button></div></div></div>` : ''}
      <div><h4>What are you doing?</h4><div class="acts">${N.ACTIONS.map(([l,k]) => `<button type="button" class="act" data-a="rollAct" data-v="${k}" aria-pressed="${r.action===k}">${IC(k)}${l.replace('Create an advantage','Advantage')}</button>`).join('')}</div></div>
      ${r.action === 'attack' && inFight ? `<div><h4>Target · same zone only</h4>${targets.length ? `<div class="tgts">${targets.map(t => `<button type="button" class="tgt" data-a="rollTgt" data-v="${t.id}" aria-pressed="${r.target===t.id}">${N.av(N.tokObj(t),32)}${esc(N.tokName(t))}</button>`).join('')}</div>` : `<div class="note">${IC('info')}Nobody to attack in ${esc(N.zoneOf(tokOfWho)?.name||'this zone')}. Move first.</div>`}</div>` : ''}
      ${r.action === 'advantage' ? `<label class="field"><span>Aspect you’re creating</span><input class="inp" id="rasp-${v.id}" data-i="rollAsp" value="${esc(r.aspect||'')}" placeholder="e.g. Blinded by Spilled Ale"></label>` : ''}
      ${other ? '' : `<div><h4>Skill</h4><div class="skills">${skills.map(([n,x]) => `<button type="button" class="sk" data-a="rollSkill" data-v="${esc(n)}" aria-pressed="${r.skill===n}"><span><b>${esc(n)}</b><small>${ladderWord(x)}</small></span><span class="v">${sgn(x)}</span></button>`).join('')}
        ${r.all || !skills.length ? rest.map(n => `<button type="button" class="sk" data-a="rollSkill" data-v="${n}" aria-pressed="${r.skill===n}"><span><b>${n}</b><small>Mediocre</small></span><span class="v">+0</span></button>`).join('') : ''}</div>
        ${r.all || !skills.length ? '' : `<button type="button" class="btn sm ghost" data-a="rollAll" style="margin-top:8px">Show every skill (${rest.length} more at +0)</button>`}</div>`}
      ${fightAtk ? `<div class="note">${IC('defend')}Your target rolls to defend right after you. The result shows in the chat once both rolls are in.</div>` : `<div><h4>Against ${r.action==='attack'||r.action==='defend'?'(the other side rolls)':'(optional)'}</h4><div class="ladder-chips">${[null,0,1,2,3,4,5,6].map(x => `<button type="button" class="lchip" data-a="rollOpp" data-v="${x}" aria-pressed="${r.opp===x}"><b>${x==null?'—':sgn(x)}</b>${x==null?'No target':ladderWord(x)}</button>`).join('')}</div></div>`}
      ${gm ? `<button type="button" class="toggle" data-a="rollSecret" aria-pressed="${!!r.secret}">${IC('eyeoff')}<span>Secret roll<small>Only you see it, in GM notes.</small></span><span class="sw"></span></button>` : ''}
      <p class="rollsum">4 Fate dice + ${other ? 'bonus' : esc(r.skill)} ${sgn(bonus)}.${fightAtk && tokOfWho && N.tokGear(tokOfWho, 'gearAtk') ? ` A hit gets +${N.tokGear(tokOfWho, 'gearAtk')} shifts from the weapon.` : ''} After you see the roll you can invoke aspects for +2 or a reroll.</p>`;
    const dis = r.action === 'attack' && inFight && !r.target;
    return sheet('Roll the dice', body, `<button type="button" class="btn gold lg" data-a="doRoll" ${dis?'disabled':''}>${N.fateDie}Roll ${other ? '' : esc(r.skill) + ' '}${sgn(bonus)}</button>`, {lead:other ? '' : N.av(who,36)});
  }
  /* ---------------- invoke ---------------- */
  case 'invoke': {
    const m = g.msgs.find(x => x.id === arg); if (!m) return '';
    const opts = N.invokeOptions(v, m);
    const c = N.charOf(v.role);
    const r = m.roll, tot = N.rollTotal(r);
    const body = `<div class="note">${IC('cards')}Pick an aspect that helps, then take +2 or reroll all four dice. Free invokes cost nothing, the rest cost a fate point${gm?' from your own pool':` (you have ${c ? c.fp : 0})`}.</div>
      <p class="rollsum" style="margin:0">Now ${sgn(tot)} ${ladderWord(tot)}. +2 makes it ${sgn(tot + 2)} ${ladderWord(tot + 2)}. A reroll keeps ${esc(r.skill)} ${sgn(r.bonus)}${N.plusInvokes(r)?` and the +${2*N.plusInvokes(r)} already invoked`:''} and rolls the dice again (they show ${sgn(N.diceSum(r))} now).</p>
      <div style="display:grid;gap:8px">${opts.map((o,i) => { const dis = (!o.free && !gm && (!c || c.fp < 1)) ? 'disabled' : ''; return `<div class="invopt"><span class="icard" style="--rot:${i%2?.6:-.6}deg">${esc(o.t)}</span><span class="cost">${o.free ? `<b style="color:var(--gold)">Free</b><small>${o.free} left · ${esc(o.from)}</small>` : `<b>1 fate point</b><small>${esc(o.from)}</small>`}</span><span class="how"><button type="button" class="btn sm gold" data-a="doInvoke" data-i="${i}" data-how="plus" ${dis}>+2</button><button type="button" class="btn sm" data-a="doInvoke" data-i="${i}" data-how="reroll" ${dis}>${N.fateDie}Reroll</button></span></div>`; }).join('') || '<p class="muted">No aspects to invoke here yet.</p>'}</div>`;
    return sheet('Invoke an aspect', body);
  }
  /* ---------------- scene picker (GM) ---------------- */
  case 'scene': {
    const d = v.ui.sd, tab = d.tab;
    const pins = g.maps.flatMap(mp => mp.pins.filter(p => ['town','tavern','landmark','shop','temple','nation'].includes(p.type)).map(p => ({map:mp.id, id:p.id, rx:p.rx, ry:p.ry, label:p.label, sub:mp.name})));
    const pics = tab === 'recent' ? g.recent.map(r => ({...r, sub:r.where}))
      : tab === 'maps' ? pins.map(p => ({id:`pl:${p.map}:${p.id}`, title:p.label, sub:p.sub, place:{map:p.map, rx:p.rx, ry:p.ry}}))
      : [...(d.uploads||[]).map((u,i) => ({id:'up'+i, title:'', art:u, sub:'Your picture', up:true})), ...N.ARTLIB.map(a => ({id:a.id, title:a.label, art:a.art, sub:'Picture'}))];
    const isOn = p => p.place ? (d.place && d.place.map === p.place.map && d.place.rx === p.place.rx && d.place.ry === p.place.ry) : (d.art && d.art === p.art);
    const forwho = ['table', ...N.seats().map(x => 'dm-' + x)];
    const body = `
      <div><h4>Who it’s for</h4><div class="forwho">${forwho.map(c => `<button type="button" data-a="sdFor" data-v="${c}" aria-pressed="${d.ch===c}">${c==='table'?`<span class="cic">${IC('users')}</span>Everyone`:N.av(N.personObj(c.slice(3)),28)+esc(pName(c.slice(3)))+' only'}</button>`).join('')}</div></div>
      <div><div style="display:flex;align-items:center;justify-content:space-between;gap:8px;margin-bottom:8px;flex-wrap:wrap"><h4 style="margin:0">Picture</h4><div class="seg"><button type="button" data-a="sdTab" data-v="recent" aria-pressed="${tab==='recent'}">Recent</button><button type="button" data-a="sdTab" data-v="pics" aria-pressed="${tab==='pics'}">Pictures</button><button type="button" data-a="sdTab" data-v="maps" aria-pressed="${tab==='maps'}">Map places</button></div></div>
        <div class="thumbs">${pics.map(p => `<button type="button" class="thumb${isOn(p)?' on':''}" ${p.up ? `data-a="sdPickUp" data-v="${esc(p.art)}"` : `data-a="sdPick" data-v="${esc(p.id)}"`} style="${N.sceneArt(p)};${p.place?'background-size:420% auto':''}"><span>${esc(p.title)}<small>${esc(p.sub||'')}</small></span>${isOn(p)?`<span class="ck">${IC('check')}</span>`:''}</button>`).join('')}
          ${tab==='pics'?`<button type="button" class="thumb up" data-a="sdUpload"><span>${IC('upload')}Upload a picture</span></button>`:''}
          ${tab==='recent' && !pics.length ? '<p class="muted" style="margin:0;font:600 13px/1.4 var(--f-ui)">Scenes you set show up here for one-tap reuse.</p>' : ''}
          ${tab==='maps' && !pics.length ? '<p class="muted" style="margin:0;font:600 13px/1.4 var(--f-ui)">No places on the maps yet.</p>' : ''}</div></div>
      <div style="display:grid;gap:10px;grid-template-columns:repeat(auto-fit,minmax(180px,1fr))">
        <label class="field"><span>Scene name</span><input class="inp" id="sdt-${v.id}" data-i="sd" data-k="title" value="${esc(d.title)}" placeholder="e.g. A quiet back room"></label>
        <label class="field"><span>Where</span><input class="inp" id="sdw-${v.id}" data-i="sd" data-k="where" value="${esc(d.where)}" placeholder="Town or region"></label>
        <label class="field"><span>When (optional)</span><input class="inp" id="sdd-${v.id}" data-i="sd" data-k="date" value="${esc(d.date)}" placeholder="In-world day or time"></label>
      </div>
      <div><h4>Scene aspects · tap the dots for free invokes</h4><div class="icards">${d.aspects.map((a,i) => `<span class="icard" style="--rot:${i%2?.7:-.7}deg;display:inline-flex;align-items:center;gap:6px">${esc(a.t)}<button type="button" class="fi fib" data-a="sdAspFree" data-i="${i}" aria-label="Free invokes: ${a.free||0}" title="Free invokes">${a.free?'<i></i>'.repeat(a.free):'<em>0</em>'}</button><button type="button" class="xb" data-a="sdAspDel" data-i="${i}" aria-label="Remove ${esc(a.t)}">${IC('x')}</button></span>`).join('')}
        <span style="display:flex;gap:6px;flex:1;min-width:200px"><input class="inp" id="sda-${v.id}" data-i="sd" data-k="newAsp" value="${esc(d.newAsp||'')}" placeholder="Add an aspect" style="min-height:36px;padding:6px 12px"><button type="button" class="btn sm" data-a="sdAspAdd">${IC('plus')}Add</button></span></div></div>
      <button type="button" class="toggle" data-a="sdPost" aria-pressed="${d.post}">${IC('scroll')}<span>Mark it in the chat<small>Adds a small “New scene” line so the log reads like chapters.</small></span><span class="sw"></span></button>`;
    const has = g.scenes[d.ch];
    return sheet(has ? 'Change the scene' : 'Set the scene', body, `${has?`<button type="button" class="btn ghost" data-a="sdClear" style="flex:0 0 auto">Clear</button>`:''}<button type="button" class="btn primary lg" data-a="sdApply" ${d.title.trim() && (d.art||d.place) ? '' : 'disabled'}>${IC('image')}Change scene for ${d.ch==='table'?'everyone':esc(pName(d.ch.slice(3)))}</button>`, {wide:true});
  }
  /* ---------------- GM screen / my hero on phones ---------------- */
  case 'gm': return sheet('GM screen', N.gmScreen(v).replace('<div class="gs">','<div class="gs" style="padding:0">'), '', {lead:`<span class="av narrav" style="--s:34px">${N.STAR}</span>`});
  case 'hero': return sheet('My character', N.heroQuick(v).replace('<div class="gs">','<div class="gs" style="padding:0">'));
  case 'tok': { const t = N.tokById(arg); return t ? sheet(esc(N.tokName(t)), N.tokCard(v, t)) : ''; }
  case 'zone': { const z = g.combat.zones.find(x => x.id === arg); return z ? sheet('Edit zone', N.zoneForm(v, z), `<button type="button" class="btn primary" data-a="closeSheet">Done</button>`) : ''; }
  /* ---------------- profile ---------------- */
  case 'profile': {
    const me = gm ? {name:N.gmName(), color:'var(--c-gm)'} : N.personObj(v.role);
    const c = !gm && N.charOf(v.role);
    const pending = N.MEMBERS.filter(m => m.role === 'pending').length, my = N.me();
    const body = `<div class="prof">${N.av(me,56)}<span><b>${esc(my?.name || me.name)}</b><small>${gm?'Game master':'Player'} · ${esc(my?.email || 'signed in with Google')}</small></span></div>
      <div><h4>Appearance</h4><div class="seg" style="width:100%"><button type="button" style="flex:1;justify-content:center" data-a="theme" data-v="night" aria-pressed="${v.theme==='night'}">${IC('moon')}Night</button><button type="button" style="flex:1;justify-content:center" data-a="theme" data-v="day" aria-pressed="${v.theme==='day'}">${IC('sun')}Day</button></div></div>
      <div><h4>Notifications</h4>${notifyToggle()}</div>
      <div class="menu">
        ${gm ? `<button type="button" data-a="sheet" data-v="players">${IC('userplus')}<span>Players and sign-ins<small>Let people in, rename or remove them</small></span><span class="end">${pending?`<span class="badge">${pending}</span>`:IC('right')}</span></button>
        <button type="button" data-a="sheet" data-v="import">${IC('upload')}<span>Import lore<small>Load the wiki and maps from your lore file</small></span><span class="end">${IC('right')}</span></button>
        <button type="button" data-a="sheet" data-v="export">${IC('export')}<span>Export the log<small>Copy or save chats as text</small></span><span class="end">${IC('right')}</span></button>`
        : `<button type="button" data-a="tab" data-v="hero">${IC('hero')}<span>My character<small>${c && c.built?esc(N.pcTag(c)):'Not made yet'}</small></span><span class="end">${IC('right')}</span></button>`}
        <button type="button" data-a="sheet" data-v="credits">${IC('heart')}<span>Art credits<small>Free art used in this app</small></span><span class="end">${IC('right')}</span></button>
        <button type="button" data-a="signOut">${IC('signout')}<span>Sign out</span></button>
      </div>`;
    return sheet('You', body);
  }
  case 'players': {
    const rank = m => m.role === 'pending' ? 0 : /^p\d+$/.test(m.role) ? 1 : 2;
    const list = N.MEMBERS.filter(m => m.role !== 'gm').sort((a,b) => rank(a) - rank(b) || (a.t||0) - (b.t||0));
    const st = m => m.role === 'pending' ? 'Waiting to be let in' : m.role === 'removed' ? 'Removed' : `Seat ${m.role.slice(1)}`;
    const body = `<div class="members">${list.map(m => {
      const seated = /^p\d+$/.test(m.role), p = g.P[m.role];
      return `<div class="mem">${N.av({name:m.name,color:p?p.color:'var(--line-3)'},38)}<span style="min-width:0">${seated ? `<input class="inp" id="mem-${m.uid}-${v.id}" data-i="memName" data-v="${m.uid}" value="${esc(m.name)}" aria-label="Name the table sees" style="min-height:34px;padding:4px 10px;font-weight:800">` : `<b>${esc(m.name)}</b>`}<small>${esc(m.email || '')} · ${st(m)}</small></span>
        <div class="row">${seated ? `<button type="button" class="btn sm danger" data-a="reject" data-v="${m.uid}">${IC('trash')}Remove</button>`
          : `<button type="button" class="btn sm primary" data-a="admit" data-v="${m.uid}">${m.role==='removed'?'Let back in':'Let in'}</button>${m.role==='pending'?`<button type="button" class="btn sm ghost" data-a="reject" data-v="${m.uid}">Turn away</button>`:''}`}</div></div>`; }).join('') || '<p class="muted" style="margin:0;font:600 14px/1.5 var(--f-ui)">No one else has signed in yet. Send your players the link to this page.</p>'}</div>
      <div class="note">${IC('info')}Anyone with the link can sign in with Google, but only people you let in can see the campaign. Each gets a seat, an empty character card for you to fill, and a private chat with you.</div>`;
    return sheet('Players and sign-ins', body);
  }
  case 'import': return sheet('Import lore', `<div class="note">${IC('info')}Pick <b>norne-gm-lore.json</b>. It fills the World wiki and the maps, GM secrets included, and saves them for the whole table. Players only ever receive the parts they’re allowed to see.</div>
      <button type="button" class="thumb up" style="aspect-ratio:auto;min-height:120px;width:100%" data-a="importLore"><span>${IC('upload')}Choose the lore file</span></button>
      <p class="muted" style="margin:0;font:600 12.5px/1.4 var(--f-ui)">Entries and maps with the same name are replaced by the file’s version. Anything you made yourself stays. Loaded now: ${g.wiki.length} entries, ${g.maps.length} maps, ${g.maps.reduce((a,m)=>a+m.pins.filter(p=>p.type!=='party').length,0)} places.</p>`);
  case 'export': {
    const ex = v.ui.exp;
    const out = N.buildExport(ex);
    const body = `<div><h4>Chats</h4><div class="forwho">${N.channelsFor('gm').map(c => `<button type="button" data-a="expCh" data-v="${c}" aria-pressed="${ex.ch.has(c)}">${esc(N.chName(c,'gm'))}</button>`).join('')}</div></div>
      <div><h4>Include</h4><div class="forwho">${[['rp','Roleplay'],['roll','Rolls'],['meta','Out of character']].map(([k,l]) => `<button type="button" data-a="expKind" data-v="${k}" aria-pressed="${!!ex[k]}">${l}</button>`).join('')}</div></div>
      <div><h4>Preview · for your notes, or to paste into an AI for a session summary</h4><textarea id="exOut" class="inp" readonly rows="10" style="font:500 12.5px/1.5 ui-monospace,Menlo,monospace;color:var(--ink-2)">${esc(out)}</textarea></div>`;
    return sheet('Export the log', body, `<button type="button" class="btn ghost" data-a="expCopy">${IC('copy')}Copy</button><button type="button" class="btn primary lg" data-a="expDl">${IC('download')}Download .md</button>`, {wide:true});
  }
  case 'credits': return sheet('Art credits', N.creditsHtml(), '', {wide:true});
  case 'pcDel': {
    const c = g.chars[arg];
    return sheet(`Delete ${esc(c.short)}’s card?`, `<p style="margin:0;font:500 15px/1.5 var(--f-ui);color:var(--ink-2)">The card goes back to empty. ${esc(pName(c.player))} keeps their seat and you can make a new card any time.</p>`,
      `<button type="button" class="btn ghost" data-a="closeSheet">Keep it</button><button type="button" class="btn danger" data-a="pcDelete" data-v="${c.id}">${IC('trash')}Delete card</button>`);
  }
  case 'npcDel': {
    const n = g.npcs.find(x => x.id === arg); if (!n) return '';
    return sheet(`Delete ${esc(n.name)}?`, `<p style="margin:0;font:500 15px/1.5 var(--f-ui);color:var(--ink-2)">The card is removed. Tokens already in a fight stay.</p>`,
      `<button type="button" class="btn ghost" data-a="closeSheet">Keep it</button><button type="button" class="btn danger" data-a="npcDelGo" data-v="${n.id}">${IC('trash')}Delete</button>`);
  }
  case 'cbEnd': return sheet('End the fight?', `<p style="margin:0;font:500 15px/1.5 var(--f-ui);color:var(--ink-2)">Zones and tokens are cleared for everyone. Stress and consequences stay on the character cards.</p>`,
      `<button type="button" class="btn ghost" data-a="closeSheet">Keep fighting</button><button type="button" class="btn danger" data-a="cbEndGo">${IC('stop')}End the fight</button>`);
  case 'addFoe': return sheet('Add to the fight', `<p class="muted" style="margin:0;font:600 13px/1.4 var(--f-ui)">${g.combat.zones.length?'They appear in the first zone. Drag them where they belong.':'Draw a zone first, then place them.'}</p>${N.foeList(true)}
      <button type="button" class="btn block ghost" data-a="npcNew">${IC('plus')}Make a new NPC</button>`);
  case 'cbAspect': return sheet('Fight aspect', `<p class="muted" style="margin:0;font:600 13px/1.4 var(--f-ui)">Shown on the board for everyone. Anyone can invoke it.</p>
      <div class="icards">${g.combat.aspects.map((a,i)=>`<button type="button" class="icard" data-a="cbAspDel" data-i="${i}" title="Tap to remove">${esc(a.t)}${a.free?`<span class="fi">${'<i></i>'.repeat(a.free)}</span>`:''}</button>`).join('')}</div>
      <label class="field"><span>New aspect</span><input class="inp" id="cba-${v.id}" data-i="cbAsp" value="${esc(v.ui.cbAsp||'')}" placeholder="e.g. Fog Off the River"></label>
      <div class="seg"><button type="button" data-a="cbAspFree" data-v="0" aria-pressed="${!v.ui.cbAspFree}">No free invoke</button><button type="button" data-a="cbAspFree" data-v="1" aria-pressed="${v.ui.cbAspFree==1}">1 free</button><button type="button" data-a="cbAspFree" data-v="2" aria-pressed="${v.ui.cbAspFree==2}">2 free</button></div>`,
      `<button type="button" class="btn primary" data-a="cbAspAdd">${IC('plus')}Add aspect</button>`);
  /* ---------------- character editor (GM) ---------------- */
  case 'pcEdit': return sheet(v.ui.pd.isNew ? `Make ${esc(pName(v.ui.pd.player))}’s card` : `Edit ${esc(v.ui.pd.short)}’s card`, pcEditor(v), `<button type="button" class="btn ghost" data-a="closeSheet" style="flex:0 0 auto">Cancel</button><button type="button" class="btn primary lg" data-a="pcSave" ${v.ui.pd.name.trim()?'':'disabled'}>${IC('check')}${v.ui.pd.isNew?'Save and send to '+esc(pName(v.ui.pd.player)):'Save card'}</button>`, {wide:true});
  case 'npcNew': return sheet(v.ui.nd.edit ? `Edit ${esc(v.ui.nd.name || 'NPC')}` : 'New NPC', npcEditor(v), `<button type="button" class="btn ghost" data-a="closeSheet" style="flex:0 0 auto">Cancel</button><button type="button" class="btn primary lg" data-a="npcSave" ${v.ui.nd.name.trim()?'':'disabled'}>${IC('check')}Save NPC</button>`, {wide:true});
  case 'wEdit': {
    const d = v.ui.wd;
    return sheet(d.id ? 'Edit entry' : 'New wiki entry', `<div style="display:grid;gap:12px;grid-template-columns:repeat(auto-fit,minmax(220px,1fr))">
        <label class="field"><span>Title</span><input class="inp" id="wdt-${v.id}" data-i="wd" data-k="title" value="${esc(d.title)}" placeholder="Name of the person, place or thing"></label>
        <label class="field"><span>Category</span><select class="inp" id="wdc-${v.id}" data-i="wd" data-k="cat">${[...new Set([...N.catNames(g.wiki), d.cat])].filter(Boolean).map(c => `<option ${d.cat===c?'selected':''}>${esc(c)}</option>`).join('')}</select></label></div>
      <label class="field"><span>One-line summary</span><input class="inp" id="wds-${v.id}" data-i="wd" data-k="summary" value="${esc(d.summary)}" placeholder="Shown in lists and at the top"></label>
      <label class="field"><span>Facts box, one per line as “Label: value”</span><textarea class="inp" id="wdi-${v.id}" data-i="wd" data-k="info" rows="3" placeholder="Ruler: …">${esc(d.info)}</textarea></label>
      <label class="field"><span>Text · blank line between paragraphs · link entries with [[Title]]</span><textarea class="inp" id="wdb-${v.id}" data-i="wd" data-k="body" rows="8">${esc(d.body)}</textarea></label>
      <label class="field"><span>${lockIc}Secret notes, only you see these</span><textarea class="inp" id="wdx-${v.id}" data-i="wd" data-k="secret" rows="3" placeholder="What the players don’t know yet">${esc(d.secret)}</textarea></label>
      <div><h4>Who can read it · secret notes always stay with you</h4>${N.audPick('wdAud', d, 'wiki')}</div>`,
      `${d.id ? `<button type="button" class="btn danger" data-a="sheet" data-v="wDel" data-c="${esc(d.id)}" style="flex:0 0 auto" aria-label="Delete this entry">${IC('trash')}<span class="only-dt">Delete</span></button>` : ''}<button type="button" class="btn ghost" data-a="closeSheet" style="flex:0 0 auto">Cancel</button><button type="button" class="btn primary lg" data-a="wSave" ${d.title.trim()?'':'disabled'}>${IC('check')}Save entry</button>`, {wide:true});
  }
  case 'wDel': {
    const e = g.wiki.find(x => x.id === arg); if (!e) return '';
    return sheet(`Delete “${esc(e.title)}”?`, `<p style="margin:0;font:500 15px/1.5 var(--f-ui);color:var(--ink-2)">The entry is removed for everyone, secret notes included. Links to it turn back into plain text. You can undo it for a few seconds.</p>`,
      `<button type="button" class="btn ghost" data-a="closeSheet">Keep it</button><button type="button" class="btn danger" data-a="wDelGo" data-v="${esc(e.id)}">${IC('trash')}Delete entry</button>`);
  }
  /* ---------------- wiki categories (GM) ---------------- */
  case 'wCats': {
    const rows = v.ui.cd, names = rows.filter(r => !r.del).map(r => r.name.trim());
    const dup = names.some((n, i) => !n || names.indexOf(n) !== i);
    const body = `<p class="muted" style="margin:0;font:600 13px/1.4 var(--f-ui)">Rename, reorder or remove categories, and pick an icon for each. Renaming moves its entries along with it.</p>
      <div class="catsed">${rows.map((r, i) => {
        const n = r.from ? g.wiki.filter(e => e.cat === r.from).length : 0;
        if (r.del) return `<div class="catrow del"><span class="ci">${IC(r.ic)}</span><span style="flex:1;min-width:0"><b>${esc(r.from || r.name)}</b><small>${n ? `Removed. Its ${n} ${n>1?'entries move':'entry moves'} to` : 'Removed'}</small>${n ? `<select class="inp" id="cdto${i}-${v.id}" data-i="cdTo" data-n="${i}" style="min-height:34px;padding:4px 10px;margin-top:6px">${rows.filter(x => !x.del && x.name.trim()).map(x => `<option ${r.to===x.name.trim()?'selected':''}>${esc(x.name.trim())}</option>`).join('')}</select>` : ''}</span><button type="button" class="btn sm ghost" data-a="cdDel" data-i="${i}">${IC('undo')}Keep</button></div>`;
        return `<div class="catrow"><button type="button" class="ci" data-a="cdIcon" data-i="${i}" aria-label="Change icon" aria-expanded="${v.ui.cdIc===i}">${IC(r.ic)}</button>
          <span style="flex:1;min-width:0"><input class="inp" id="cdn${i}-${v.id}" data-i="cd" data-n="${i}" value="${esc(r.name)}" aria-label="Category name" placeholder="Category name" style="min-height:38px;padding:6px 12px"><small>${n ? `${n} ${n>1?'entries':'entry'}` : 'No entries yet'}</small></span>
          <button type="button" class="ibtn sm" data-a="cdMove" data-i="${i}" data-d="-1" aria-label="Move up" ${i?'':'disabled'}>${IC('caret').replace('<svg','<svg style="rotate:180deg"')}</button><button type="button" class="ibtn sm" data-a="cdMove" data-i="${i}" data-d="1" aria-label="Move down" ${i<rows.length-1?'':'disabled'}>${IC('caret')}</button><button type="button" class="ibtn sm" data-a="cdDel" data-i="${i}" aria-label="Remove category">${IC('trash')}</button>
          ${v.ui.cdIc===i ? `<div class="icgrid">${N.CATICONS.map(k => `<button type="button" data-a="cdIc" data-i="${i}" data-v="${k}" aria-pressed="${r.ic===k}" aria-label="${k}">${IC(k)}</button>`).join('')}</div>` : ''}</div>`;
      }).join('')}</div>
      <button type="button" class="btn sm ghost" data-a="cdAdd" style="justify-self:start">${IC('plus')}Add a category</button>
      ${dup ? `<div class="note">${IC('info')}Every category needs its own name.</div>` : ''}`;
    return sheet('Wiki categories', body, `<button type="button" class="btn ghost" data-a="closeSheet" style="flex:0 0 auto">Cancel</button><button type="button" class="btn primary lg" data-a="cdSave" ${dup||!names.length?'disabled':''}>${IC('check')}Save categories</button>`);
  }
  /* ---------------- map settings (GM) ---------------- */
  case 'mapSet': {
    const m = g.maps.find(x => x.id === arg); if (!m) return '';
    return sheet('Map settings', `<label class="field"><span>Map name</span><input class="inp" id="mpn-${v.id}" data-i="mapName" data-v="${esc(m.id)}" value="${esc(m.name)}"></label>
      <div><h4>Who sees this map</h4>${N.audPick('mapAud', m, 'map')}</div>
      <div class="note">${IC('info')}Places on the map have their own switch: tap a place while editing to show or hide it.</div>`,
      `<button type="button" class="btn danger" data-a="sheet" data-v="mapDel" data-c="${esc(m.id)}" style="flex:0 0 auto">${IC('trash')}Delete map</button><button type="button" class="btn primary" data-a="closeSheet">Done</button>`);
  }
  case 'mapDel': {
    const m = g.maps.find(x => x.id === arg); if (!m) return '';
    const n = m.pins.filter(p => p.type !== 'party').length, party = m.pins.some(p => p.type === 'party');
    return sheet(`Delete the ${esc(m.name)} map?`, `<p style="margin:0;font:500 15px/1.5 var(--f-ui);color:var(--ink-2)">The map${n ? ` and its ${n} ${n>1?'places':'place'}` : ''} are removed for everyone.${party ? ' The party banner is on this map, so it goes too.' : ''} ${String(m.src||'').startsWith('fs:') ? 'Its picture is deleted after a few seconds, so you can still undo.' : ''} Importing the lore file again brings back the atlas maps.</p>`,
      `<button type="button" class="btn ghost" data-a="closeSheet">Keep it</button><button type="button" class="btn danger" data-a="mapDelGo" data-v="${esc(m.id)}">${IC('trash')}Delete map</button>`);
  }
  /* ---------------- a chat message (GM) ---------------- */
  case 'msgEdit': {
    const m = g.msgs.find(x => x.id === arg), d = v.ui.med; if (!m || !d) return '';
    return sheet('Edit message', `<p class="muted" style="margin:0;font:600 12.5px/1.4 var(--f-ui)">${esc(N.msgWho(m))} · ${esc(N.chName(m.ch, 'gm'))}. Everyone who can see it sees the new words, marked “edited”.</p>
      <textarea class="inp" id="med-${v.id}" data-i="med" rows="5" style="font:500 15.5px/1.45 var(--f-ui)">${esc(d.text)}</textarea>`,
      `<button type="button" class="btn ghost" data-a="closeSheet">Cancel</button><button type="button" class="btn primary" data-a="msgSave" ${d.text.trim()?'':'disabled'}>${IC('check')}Save</button>`);
  }
  case 'msgDel': {
    const m = g.msgs.find(x => x.id === arg); if (!m) return '';
    const what = m.text ? `“${esc(m.text.length > 140 ? m.text.slice(0, 140) + '…' : m.text)}”` : m.kind === 'roll' ? `the ${esc(m.roll.skill)} roll` : m.kind === 'scene' ? 'this scene change' : 'this card';
    return sheet('Delete this message?', `<p style="margin:0;font:500 15px/1.5 var(--f-ui);color:var(--ink-2)">${esc(N.msgWho(m))}: ${what} is removed for everyone. You can undo it for a few seconds.</p>`,
      `<button type="button" class="btn ghost" data-a="closeSheet">Keep it</button><button type="button" class="btn danger" data-a="msgDelGo" data-v="${esc(m.id)}">${IC('trash')}Delete</button>`);
  }
  /* ---------------- a news edition (GM) ---------------- */
  case 'newsSet': {
    const i = g.news.issues.find(x => x.id === arg); if (!i) return '';
    return sheet(`No. ${esc(i.no)} · ${esc(i.headline)}`, `<div><h4>Who can read this edition</h4>${N.audPick('newsAud', i, 'news')}</div>
      <p class="muted" style="margin:0;font:600 12.5px/1.4 var(--f-ui)">Players you add get a note in their chat with you.</p>`,
      `<button type="button" class="btn danger" data-a="sheet" data-v="newsDel" data-c="${esc(i.id)}" style="flex:0 0 auto">${IC('trash')}Delete edition</button><button type="button" class="btn primary" data-a="closeSheet">Done</button>`);
  }
  case 'newsDel': {
    const i = g.news.issues.find(x => x.id === arg); if (!i) return '';
    return sheet('Delete this edition?', `<p style="margin:0;font:500 15px/1.5 var(--f-ui);color:var(--ink-2)">No. ${esc(i.no)}, “${esc(i.headline)}”, is removed for everyone. You can undo it for a few seconds.</p>`,
      `<button type="button" class="btn ghost" data-a="closeSheet">Keep it</button><button type="button" class="btn danger" data-a="newsDelGo" data-v="${esc(i.id)}">${IC('trash')}Delete edition</button>`);
  }
  }
  return '';
};

function notifyToggle(){
  const st = N.notifyState ? N.notifyState() : 'none';
  const sub = {on:N.notifyPush && N.notifyPush() ? 'You get a ping for new messages, rolls and news, even with Norne closed.' : 'You get a ping for new messages, rolls and news while Norne is open but not in front.', off:'Get a ping for new messages, rolls and news on this device.',
    blocked:'Your browser blocks them for this site. Allow notifications in its site settings, then try again.', install:'On iPhone, add Norne to your home screen first (Share > Add to Home Screen), then turn this on there.', none:'This browser can’t show notifications.'}[st];
  return `<button type="button" class="toggle" data-a="notify" aria-pressed="${st==='on'}">${IC(st==='on'?'herald':'clock')}<span>Notifications on this device<small>${sub}</small></span><span class="sw"></span></button>`;
}
function portraitPick(sel, act, up){
  const custom = sel && !PORTRAITS.includes(sel) ? N.faceUrl(sel) : null;
  return `<div class="who-row">${custom ? `<button type="button" aria-pressed="true"><span class="av" style="--s:52px;--c:var(--gold)"><img src="${esc(custom)}" alt=""></span><span>Yours</span></button>` : ''}${PORTRAITS.map(p => `<button type="button" data-a="${act}" data-v="${p}" aria-pressed="${sel===p}"><span class="av" style="--s:52px;--c:var(--gold)"><img src="${N.FACE(p)}" alt="" loading="lazy"></span></button>`).join('')}<button type="button" data-a="${up}"><span class="av" style="--s:52px;--c:var(--line-3);background:var(--sunk);color:var(--ink-3);box-shadow:inset 0 0 0 1.5px var(--line-2)">${IC('upload').replace('<svg','<svg style="width:20px;height:20px"')}</span><span>Upload</span></button></div>`;
}
/* a skill ladder editor: rungs from top to bottom, each with a cap (or none) */
function skillLadder(v, d, sel, del, rungs){
  const used = Object.keys(d.skills);
  const free = N.MUNDANE.filter(k => !used.includes(k)), freeM = N.MAGIC.filter(k => !used.includes(k));
  const opts = free.map(k => `<option>${k}</option>`).join('') + (freeM.length ? `<optgroup label="Magic">${freeM.map(k => `<option value="${k}">${k}${k==='Enchantment Magic'?' (elves only)':''}</option>`).join('')}</optgroup>` : '');
  const mv = del.replace('Del', 'Mv'), top = rungs[0][0], low = rungs[rungs.length-1][0];
  return `<div class="lad">${rungs.map(([x,w,n]) => { const here = used.filter(k => d.skills[k] === x); return `<div class="rung"><span class="lv"><b>${sgn(x)}</b>${w}${n?` · ${here.length}/${n}`:''}</span><span class="sks">${here.map(k => `<span class="skc"><b>${esc(k)}</b><button type="button" data-a="${mv}" data-v="${esc(k)}" data-d="-1" aria-label="Lower ${esc(k)}" title="Lower" ${x<=low?'disabled':''}>${IC('minus')}</button><button type="button" data-a="${mv}" data-v="${esc(k)}" data-d="1" aria-label="Raise ${esc(k)}" title="Raise" ${x>=top?'disabled':''}>${IC('plus')}</button><button type="button" data-a="${del}" data-v="${esc(k)}" aria-label="Remove ${esc(k)}" title="Remove">${IC('x')}</button></span>`).join('')}${!n || here.length < n ? `<select class="inp" data-i="${sel}" data-x="${x}" id="${sel}${x}-${v.id}" style="width:auto;min-height:34px;padding:4px 10px;border-radius:999px;font-size:14px"><option value="">+ Add</option>${opts}</select>` : ''}</span></div>`; }).join('')}</div>`;
}
/* disciplines for the skills that need one: a magic takes exactly one, the others can take several */
function discPick(d, act){
  const ks = Object.keys(d.skills).filter(k => (N.DISC[k] || []).length).sort((a,b) => d.skills[b] - d.skills[a]);
  if (!ks.length) return '';
  return `<div style="display:grid;gap:10px;margin-top:12px">${ks.map(k => { const mag = N.MAGIC.includes(k), have = N.discOf(d, k);
    return `<div class="field"><span>${esc(k)} · ${mag ? 'pick its one discipline' : 'disciplines'}${have.length ? '' : ' <b style="color:var(--ember)">· none picked</b>'}</span><div class="dchips">${N.DISC[k].map(x => `<button type="button" class="cchip" data-a="${act}" data-s="${esc(k)}" data-v="${esc(x)}" aria-current="${have.includes(x)}" style="padding:0 12px">${esc(x)}</button>`).join('')}</div></div>`; }).join('')}</div>`;
}
const raceList = v => `<datalist id="races-${v.id}">${N.RACES.map(r => `<option value="${r}">`).join('')}</datalist>`;
const stunts = (v, d, pre) => `<div style="display:grid;gap:8px">${d.stunts.map(([n,t],i) => `<div style="display:grid;gap:6px;padding:10px;border-radius:14px;background:var(--raise);box-shadow:inset 0 0 0 1px var(--line)"><div style="display:flex;gap:6px"><input class="inp" id="${pre}sn${i}-${v.id}" data-i="${pre}" data-k="stn" data-n="${i}" value="${esc(n)}" placeholder="Stunt name"><button type="button" class="ibtn sm" data-a="${pre}StuntDel" data-i="${i}" aria-label="Remove stunt">${IC('trash')}</button></div><textarea class="inp" id="${pre}sd${i}-${v.id}" data-i="${pre}" data-k="std" data-n="${i}" rows="2" placeholder="What it does" style="min-height:60px">${esc(t)}</textarea></div>`).join('')}
  <button type="button" class="btn sm ghost" data-a="${pre}StuntAdd" style="justify-self:start">${IC('plus')}Add a stunt</button></div>`;
const steppers = (d, pre) => `<div style="display:flex;gap:12px;flex-wrap:wrap">${[['refresh','Refresh'],['fp','Fate points now']].map(([k,l]) => `<div class="field" style="flex:1;min-width:150px"><span>${l}</span><div class="seg" style="justify-content:space-between;width:100%"><button type="button" data-a="${pre}Step" data-k="${k}" data-d="-1" aria-label="Less">${IC('minus')}</button><b style="align-self:center;font:700 18px/1 var(--f-display)">${d[k]}</b><button type="button" data-a="${pre}Step" data-k="${k}" data-d="1" aria-label="More">${IC('plus')}</button></div></div>`).join('')}</div>`;
/* any spread is allowed, up to Mythic, so the GM can build unusual characters */
const RUNGS = [8,7,6,5,4,3,2,1].map(x => [x, ladderWord(x), 0]);
function pcEditor(v){
  const d = v.ui.pd;
  const extra = Object.entries(d.skills).filter(([,x]) => x > 8 || x < 1);
  return `${raceList(v)}<div><h4>Portrait</h4>${portraitPick(d.portrait, 'pdPortrait', 'pdUpload')}</div>
    <div style="display:grid;gap:12px;grid-template-columns:repeat(auto-fit,minmax(200px,1fr))">
      <label class="field"><span>Character name</span><input class="inp" id="pdn-${v.id}" data-i="pd" data-k="name" value="${esc(d.name)}" placeholder="Full name"></label>
      <label class="field"><span>Short name (chat and tokens)</span><input class="inp" id="pds-${v.id}" data-i="pd" data-k="short" value="${esc(d.short)}" placeholder="What the table calls them"></label>
      <label class="field"><span>Race</span><input class="inp" id="pdr-${v.id}" data-i="pd" data-k="race" list="races-${v.id}" value="${esc(d.race||'')}" placeholder="e.g. Dwarf"></label>
      <label class="field"><span>Age</span><input class="inp" id="pdg-${v.id}" data-i="pd" data-k="age" value="${esc(d.age||'')}" placeholder="Optional"></label>
    </div>
    <div><h4>Aspects</h4><div style="display:grid;gap:8px">
      ${d.aspects.map((a,i) => `<label class="field"><span>Aspect ${i+1}</span><input class="inp" id="pda${i}-${v.id}" data-i="pd" data-k="asp" data-n="${i}" value="${esc(a||'')}" placeholder="Optional"></label>`).join('')}
    </div></div>
    <div><h4>Skills · a starting character usually has one Great, two Good, three Fair and four Average</h4>${skillLadder(v, d, 'pdSkill', 'pdSkillDel', RUNGS)}
      ${extra.length ? `<p class="muted" style="margin:8px 0 0;font:600 12.5px/1.4 var(--f-ui)">Also: ${extra.map(([k,x]) => `<button type="button" class="btn sm ghost" data-a="pdSkillDel" data-v="${esc(k)}" style="--h:28px">${esc(k)} ${sgn(x)} ${IC('x')}</button>`).join(' ')}</p>` : ''}
      ${discPick(d, 'pdDisc')}</div>
    <div style="display:grid;gap:12px;grid-template-columns:repeat(auto-fit,minmax(180px,1fr))">
      <label class="field"><span>Weapon rating · shifts added to a hit</span>${N.gearSelect(`pdga-${v.id}`, 'data-i="pd" data-k="gearAtk"', d.gearAtk)}</label>
      <label class="field"><span>Armor rating · shifts taken off a hit</span>${N.gearSelect(`pdgd-${v.id}`, 'data-i="pd" data-k="gearDef"', d.gearDef)}</label>
    </div>
    <div><h4>Stunts</h4>${stunts(v, d, 'pd')}</div>
    ${steppers(d, 'pd')}
    <p class="muted" style="margin:0;font:600 12.5px/1.4 var(--f-ui)">Stress boxes and extra consequence slots come from Strength and Will automatically.</p>
    <label class="field"><span>Bio</span><textarea class="inp" id="pdb-${v.id}" data-i="pd" data-k="bio" rows="3" placeholder="Who they are, where they come from, what they look like…">${esc(d.bio||'')}</textarea></label>
    <label class="field"><span>Important people</span><textarea class="inp" id="pdp-${v.id}" data-i="pd" data-k="people" rows="3" placeholder="Family, friends, rivals, debts… one per line">${esc(d.people||'')}</textarea></label>
    <label class="field"><span>Inventory notes</span><textarea class="inp" id="pdv-${v.id}" data-i="pd" data-k="invText" rows="3" placeholder="What they carry. Items you hand out go in the Inventory menu.">${esc(d.invText||'')}</textarea></label>`;
}
function npcEditor(v){
  const d = v.ui.nd;
  return `${raceList(v)}<div><h4>Portrait</h4>${portraitPick(d.portrait, 'ndPortrait', 'ndUpload')}</div>
    <div style="display:grid;gap:12px;grid-template-columns:repeat(auto-fit,minmax(180px,1fr))">
      <label class="field"><span>Name</span><input class="inp" id="ndn-${v.id}" data-i="nd" data-k="name" value="${esc(d.name)}" placeholder="Name or role"></label>
      <label class="field"><span>Race</span><input class="inp" id="ndr-${v.id}" data-i="nd" data-k="race" list="races-${v.id}" value="${esc(d.race)}" placeholder="Optional"></label>
      <label class="field"><span>Job or faction</span><input class="inp" id="ndj-${v.id}" data-i="nd" data-k="job" value="${esc(d.job)}" placeholder="Optional"></label>
      <label class="field"><span>Age</span><input class="inp" id="ndg-${v.id}" data-i="nd" data-k="age" value="${esc(d.age||'')}" placeholder="Optional"></label>
    </div>
    <div><h4>Kind</h4><div class="seg"><button type="button" data-a="ndType" data-v="supporting" aria-pressed="${d.type!=='nameless'}">Supporting</button><button type="button" data-a="ndType" data-v="nameless" aria-pressed="${d.type==='nameless'}">Nameless (one hit)</button></div></div>
    <div><h4>Aspects</h4><div style="display:grid;gap:8px">
      ${d.aspects.map((a,i) => `<label class="field"><span>Aspect ${i+1}</span><input class="inp" id="nda${i}-${v.id}" data-i="nd" data-k="asp" data-n="${i}" value="${esc(a||'')}" placeholder="Optional"></label>`).join('')}
    </div></div>
    <div><h4>Skills</h4>${skillLadder(v, d, 'ndSkill', 'ndSkillDel', RUNGS)}${discPick(d, 'ndDisc')}</div>
    <div style="display:grid;gap:12px;grid-template-columns:repeat(auto-fit,minmax(180px,1fr))">
      <label class="field"><span>Weapon rating · shifts added to a hit</span>${N.gearSelect(`ndga-${v.id}`, 'data-i="nd" data-k="gearAtk"', d.gearAtk)}</label>
      <label class="field"><span>Armor rating · shifts taken off a hit</span>${N.gearSelect(`ndgd-${v.id}`, 'data-i="nd" data-k="gearDef"', d.gearDef)}</label>
    </div>
    <label class="field"><span>Disciplines</span><textarea class="inp" id="ndm-${v.id}" data-i="nd" data-k="magic" rows="2" placeholder="Notes on their disciplines and anything else they can do">${esc(d.magic||'')}</textarea></label>
    <div><h4>Stunts</h4>${stunts(v, d, 'nd')}</div>
    ${steppers(d, 'nd')}
    <div><h4>Inventory</h4>${N.invList(v, d, true, 'data-nd="1"')}</div>
    <label class="field"><span>Bio</span><textarea class="inp" id="ndb-${v.id}" data-i="nd" data-k="bio" rows="3" placeholder="Who they are, what they look like, how they talk…">${esc(d.bio||'')}</textarea></label>
    <label class="field"><span>${lockIc}GM notes</span><textarea class="inp" id="ndx-${v.id}" data-i="nd" data-k="notes" rows="2" placeholder="Only you see these">${esc(d.notes||'')}</textarea></label>`;
}

/* what can be invoked on a roll */
N.invokeOptions = function(v, m){
  const g = G(), out = [], gm = isGM(v);
  const sc = g.scenes[m.ch];
  if (sc) (sc.aspects || []).forEach((a,i) => out.push({t:a.t, free:N.sceneFreeLeft(sc, i), from:'Scene', ref:`scene:${sc.msg}:${i}`}));
  const cb = g.combat;
  if (cb.state === 'live' && m.ch === N.fightCh()) {
    cb.aspects.forEach((a,i) => out.push({t:a.t, free:a.free || 0, from:'Fight', kind:'cb', i}));
    cb.zones.filter(z => z.aspect).forEach(z => out.push({t:z.aspect, free:z.free || 0, from:z.name, kind:'zone', z:z.id}));
  }
  const k = m.roll.whoKey || '';
  if (k.startsWith('pc:')) { const c = g.chars[k.slice(3)]; if (c) [c.hc, c.trouble, ...c.aspects].filter(Boolean).forEach(a => out.push({t:a, free:0, from:gm ? `${c.short}’s aspect` : 'Your aspect'})); }
  else if (gm && k.startsWith('tok:')) { const t = N.tokById(k.slice(4)); (t?.aspects || []).filter(Boolean).forEach(a => out.push({t:a, free:0, from:'NPC aspect'})); }
  else if (gm && k.startsWith('npc:')) { const n = g.npcs.find(x => x.id === k.slice(4)); if (n) [n.hc, n.trouble, ...n.aspects].filter(Boolean).forEach(a => out.push({t:a, free:0, from:'NPC aspect'})); }
  return out.filter(o => !m.roll.invokes.some(i => i.aspect === o.t));
};

/* ---------------- the log as text ---------------- */
const hhmm = t => new Date(t).toLocaleTimeString([], {hour:'numeric', minute:'2-digit'});
function rollText(r){
  const tot = N.rollTotal(r), o = N.outcome(r);
  const pl = N.plusInvokes(r), rr = r.invokes.filter(i => i.reroll);
  return `${r.who}, ${r.skill} ${sgn(r.bonus)}${r.gear?` incl. gear ${sgn(r.gear)}`:''} (${r.action}${r.target?` on ${r.target}`:''}). Dice ${r.dice.map(d => d > 0 ? '+' : d < 0 ? '−' : '0').join(' ')}${pl?`, invoked ${r.invokes.filter(i => !i.reroll).map(i => '“' + i.aspect + '”').join(', ')} (+${2*pl})`:''}${rr.length?`, rerolled with ${rr.map(i => '“' + i.aspect + '”').join(', ')}`:''} → ${sgn(tot)} ${ladderWord(tot)}${o?` vs ${ladderWord(r.opp)} (${sgn(r.opp)}): ${o.t}${o.sh?`, ${Math.abs(o.sh)} shift${Math.abs(o.sh)===1?'':'s'}`:''}`:''}.`;
}
function exLine(m){
  const t = `[${hhmm(m.t)}]`;
  if (m.kind === 'sys') return `${t} — ${m.text}`;
  if (m.kind === 'meta' || m.kind === 'ooc') return `${t} (out of character) ${N.personObj(m.by).name}: ${m.text}`;
  if (m.kind === 'roll') return `${t} ROLL: ${rollText(m.roll)}`;
  if (m.kind === 'combat' || m.kind === 'fight') return `${t} — A fight begins: ${m.text}`;
  if (m.kind === 'scene') return `\n### ${m.scene.title}${m.scene.where ? ` · ${m.scene.where}` : ''}${m.scene.date ? ` · ${m.scene.date}` : ''}\n`;
  if (m.kind === 'news') return `${t} — New edition of the paper: ${m.text}`;
  if (m.kind === 'note') return `${t} NOTE: ${m.text}`;
  const sp = N.speakerObj(m);
  return sp.narr ? `${t} NARRATOR: ${m.text}` : `${t} ${sp.name}${m.by === 'gm' ? ' (NPC)' : ''}: ${m.text}`;
}
N.buildExport = sel => {
  const kinds = [sel.rp && 'roleplay', sel.roll && 'rolls', sel.meta && 'out-of-character talk'].filter(Boolean);
  const out = ['# Nörne: session log', `Exported ${new Date().toLocaleString()} · includes ${kinds.join(', ') || 'nothing'}`];
  for (const c of N.channelsFor('gm')) {
    if (!sel.ch.has(c)) continue;
    const ms = G().msgs.filter(m => m.ch === c && !(m.kind === 'scene' && (m.quiet || !m.scene)) && (((m.kind === 'rp' || m.kind === 'sys' || m.kind === 'scene' || m.kind === 'combat' || m.kind === 'fight' || m.kind === 'news' || m.kind === 'note') && sel.rp) || (m.kind === 'roll' && sel.roll) || ((m.kind === 'meta' || m.kind === 'ooc') && sel.meta)));
    if (!ms.length) continue;
    out.push('', `## ${N.chName(c, 'gm')}`, '', ms.map(exLine).join('\n\n'));
  }
  return out.join('\n');
};

N.creditsHtml = () => `<div class="note">${IC('heart')}Everything here is free to use. Some licenses ask for credit, so here it is.</div>
  <div class="menu" style="background:transparent;box-shadow:none;padding:0;gap:8px">${[
    ['Battle for Wesnoth art','Portraits and scene backdrops','GNU GPL 2.0 or later · wesnoth.org'],
    ['WTactics card art','Scene backdrops · by Santiago Iborra and others (edges trimmed)','CC BY-SA 4.0 · wtactics.org'],
    ['Flare game art','Backdrops','CC BY-SA 3.0 · flarerpg.org'],
    ['game-icons.net','Combat, item and category icons · by Lorc, Delapouite and others','CC BY 3.0'],
    ['Phosphor Icons','Interface icons','MIT'],
    ['Nörne maps and lore','Maps and wiki text','The GM’s own campaign notes'],
    ['Fonts','Cinzel, Fraunces, Nunito Sans, IM Fell English, UnifrakturMaguntia','SIL Open Font License · Google Fonts'],
  ].map(([a,b,c]) => `<div class="mem" style="grid-template-columns:1fr"><span><b>${a}</b><small>${b}</small><small style="display:block;color:var(--gold)">${c}</small></span></div>`).join('')}</div>`;
})();
