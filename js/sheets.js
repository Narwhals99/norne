/* Norne: sheets (bottom sheets on phones, dialogs on desktop). */
(function(){
const N = window.N, {esc, IC, sgn, ladderWord} = N;
const G = () => N.G;
const isGM = v => v.role === 'gm';
/* Jake: the GM's note on a roll, to remember what it was for. Only the GM sees it, unless they pick players to show it to */
function rnoteFields(v, t, see, ch, ti, sa){
  const seats = N.chSeats(ch === 'gm' ? 'table' : ch) || N.seats(), all = seats.length ? seats : N.seats();
  return `<div class="rnbox"><label class="field"><span>${IC('lock')}GM note (optional)</span><textarea class="inp" id="${ti}-${v.id}" data-i="${ti}" rows="2" placeholder="e.g. Checking if the guard spots the forged seal">${esc(t)}</textarea></label>
    ${all.length ? `<h4>Show the note to</h4><div class="forwho rnsee">${all.map(st => `<button type="button" data-a="${sa}" data-v="${st}" aria-pressed="${see.includes(st)}">${N.av(N.personObj(st), 28)}${esc(N.personObj(st).name)}</button>`).join('')}</div>
    <p class="muted" style="margin:6px 0 0;font:600 12.5px/1.4 var(--f-ui)">${see.length ? 'Only the players you picked see it, under the roll.' : 'No one picked: only you see it.'}</p>` : ''}</div>`;
}
N.rnoteFields = rnoteFields;
/* editing a scene can copy it, as it stands in the window, to another roleplay chat (Jake): a party, group or solo chat */
/* what is set up in a chat that copying its scene brings along */
const sdKit = ch => { const f = N.fightIn(ch), sh = N.shopOf(ch), out = [];
  if (f && f.state !== 'off') out.push(`the ${N.kw(f).w}${f.title ? ` “${esc(f.title)}”` : ''} (ready to start)`);
  if (sh) out.push(`the store${sh.name ? ` “${esc(sh.name)}”` : ''}${sh.state === 'open' ? ' (open)' : ''}`);
  if (N.craftOf(ch)) out.push('the crafting setup');
  return out; };
function sdCopyHtml(d, forwho){
  const to = forwho.filter(c => c !== d.ch && !N.metaOnly(c));
  if (!to.length) return '';
  const name = c => c.startsWith('grp-') ? `<span class="cic">${IC('whisper')}</span>${esc(N.chName(c, 'gm'))}` : N.av(N.personObj(c.slice(3)), 28) + esc(N.chName(c, 'gm'));
  return `<div class="sdcopy"><button type="button" class="btn" data-a="sdCopyOpen" aria-expanded="${!!d.copy}">${IC('plus')}Copy to other roleplay chat</button>
    ${d.copy ? `<p class="muted" style="margin:8px 0;font:600 12.5px/1.4 var(--f-ui)">Starts this same scene (picture, place, aspects, NPCs and one-offs, as set here) in the chat you pick. This chat's scene stays as it is.${(k => k.length ? ` It also copies ${k.join(', ')}, with the players of the chat you pick.` : '')(sdKit(d.ch))}</p>
    <div class="forwho">${to.map(c => `<button type="button" data-a="sdCopy" data-v="${c}">${name(c)}</button>`).join('')}</div>` : ''}</div>`;
}
const sheet = (title, body, foot, o={}) => `<div class="sheet${o.wide?' wide':''}" role="dialog" aria-modal="true" aria-label="${esc(title)}">
  <div class="sh-h">${o.lead||''}<h2 class="ttl">${title}</h2><button type="button" class="ibtn" data-a="closeSheet" aria-label="Close">${IC('x')}</button></div>
  <div class="sh-b scroll" data-sk="sheet">${body}</div>${foot ? `<div class="sh-f">${foot}</div>` : ''}</div>`;
const PORTRAITS = ['human-fighter','rogue-woman','elf-archer','dwarf-warrior','mage-woman','soldier-woman','noble-duelist','priest','bandit-woman','thug','innkeeper','town-guard','noble-queen','goblin-spearman','wizard-old','vampire-lady'];
N.PORTRAITS = PORTRAITS;
const pName = s => G().P[s]?.name || 'A former player';
/* the classes in Jake's weapon and armor list, in his order */
const CLS_ORDER = ['Hand-to-hand enhancers','Small one-handed weapons','Standard one-handed weapons','Two-handed weapons','Thrown weapons','Standard ranged weapons','Crossbows','Standard ranged ammo','Worn armor','Shields'];
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

/* who can this screen roll for: everyone the GM could pick */
N.allRollers = v => {
  const g = G();
  if (!isGM(v)) { const c = N.charOf(v.role); return c && c.built ? [{key:'pc:'+c.id, name:c.short, portrait:c.portrait, color:c.color, skills:c.skills}] : []; }
  const out = [];
  if (g.combat.state === 'live') g.combat.tokens.filter(t => t.kind === 'npc' && !t.out).forEach(t => out.push({key:'tok:'+t.id, name:t.name, portrait:t.portrait, color:N.tokObj(t).color, skills:t.skills || {}}));
  g.npcs.forEach(n => out.push({key:'npc:'+n.id, name:n.name, portrait:n.portrait, color:'var(--c-npc)', skills:n.skills}));
  N.extrasOf(v.ui.ch === 'gm' ? 'table' : v.ui.ch).forEach(x => out.push({key:'one:'+x.id, name:x.name, color:'var(--c-npc)', skills:x.skills || {}}));
  N.pcs().filter(c => c.built).forEach(c => out.push({key:'pc:'+c.id, name:c.short, portrait:c.portrait, color:c.color, skills:c.skills}));
  out.push({key:'other', name:'Someone else', color:'var(--line-3)', skills:{}, other:true});
  return out;
};
/* Who rolls lists only who is in this chat's scene (Jake): the fighters on the board, the scene's NPCs and one-offs, the chat's
   player characters, and whoever is picked now. No scene up lists only the player characters. ui.roll.allWho shows everyone */
N.rollers = v => {
  const all = N.allRollers(v), r = v.ui.roll || {};
  if (!isGM(v) || r.allWho) return all;
  const f = N.sceneFolk(v.ui.ch === 'gm' ? 'table' : v.ui.ch), keys = new Set([...f.pcs.map(c => 'pc:' + c.id), ...f.npcs.map(n => 'npc:' + n.id), ...f.once.map(x => 'one:' + x.id)]);
  return all.filter(o => o.other || o.key.startsWith('tok:') || keys.has(o.key) || o.key === r.who);
};
/* who a roll can be against. In a live fight, anything rolled from the fight (overcome, advantage, custom event) lists only the
   others on the board. Anywhere else, only who is in the chat's scene: its player characters, its NPCs and one-offs (no scene up:
   the player characters). r.allVs lists every character and NPC card instead.
   Ids are 'tok:<token>' for the board, 'pc:<id>' for a player character and the NPC card's own id otherwise */
N.vsCands = (v, r) => {
  const g = G(), cb = g.combat, cast = N.castOf(v.ui.ch === 'gm' ? 'table' : v.ui.ch) || [];
  const pcs = N.pcs().filter(c => c.built).map(c => ({id:'pc:' + c.id, name:c.short, portrait:c.portrait, color:c.color, skills:c.skills || {}, pc:true}));
  const cards = g.npcs.map(n => ({id:n.id, name:n.name, portrait:n.portrait, color:'var(--c-npc)', skills:n.skills || {}}))
    .sort((a, b) => cast.includes(b.name) - cast.includes(a.name));
  const once = N.extrasOf(v.ui.ch === 'gm' ? 'table' : v.ui.ch).map(x => ({id:'one:' + x.id, name:x.name, color:'var(--c-npc)', skills:x.skills || {}}));
  if (!(r.ctx === 'cb' && cb.state === 'live')) {
    const f = r.allVs ? null : N.sceneFolk(v.ui.ch === 'gm' ? 'table' : v.ui.ch), inPc = c => !f || f.pcs.some(x => 'pc:' + x.id === c.id) || c.id === r.vsNpc,
      inCard = n => !f || f.npcs.some(x => x.id === n.id) || n.id === r.vsNpc;
    return [...pcs.filter(c => c.id !== r.who && inPc(c)), ...once.filter(n => n.id !== r.who), ...cards.filter(n => 'npc:' + n.id !== r.who && inCard(n))];
  }
  /* anything rolled in the fight, custom events too, is only ever against someone in that fight */
  const onlyBoard = true;
  const self = r.who.startsWith('tok:') ? r.who.slice(4) : r.who.startsWith('pc:') ? (cb.tokens.find(t => t.kind === 'pc' && t.ref === r.who.slice(3)) || {}).id : null;
  const toks = cb.tokens.filter(t => t.zone && !t.out && t.id !== self);
  const board = toks.map(t => ({id:'tok:' + t.id, ...N.tokObj(t), name:N.tokName(t), skills:N.tokSkills(t), board:true}));
  if (onlyBoard) return board;
  return [...board,
    ...pcs.filter(c => c.id !== r.who && !cb.tokens.some(t => t.kind === 'pc' && 'pc:' + t.ref === c.id)),
    ...cards.filter(n => 'npc:' + n.id !== r.who && !cb.tokens.some(t => t.zone && !t.out && t.kind === 'npc' && t.ref === n.id))];
};
/* the fighter in another zone that an attack or a custom event in a live fight is aimed at (they take the distance debuff), or null */
N.farOf = (v, r) => {
  const cb = G().combat; if (cb.state !== 'live' || r.ctx !== 'cb' && !(r.action === 'attack' && r.target)) return null;
  const a = N.tokOfKey(r.who), d = r.event ? (r.vsNpc && r.vsNpc.startsWith('tok:') ? N.tokById(r.vsNpc.slice(4)) : null) : r.action === 'attack' && r.target ? N.tokById(r.target) : null;
  return N.isFar(a, d) ? d : null;
};
N.vsFind = (v, r, id) => id ? N.vsCands(v, r).find(n => n.id === id) || null : null;
N.rollerOf = (v, key) => N.allRollers(v).find(r => r.key === key) || N.rollers(v)[0];

N.nextDayPrev = d => `<div class="ndl n">${IC('sun')}<span><small>Narrator</small>${esc(N.dayLine(d))}</span></div><div class="ndl mt">${IC('chatL')}<span><small>Meta · ${esc(N.gmName())}</small>${esc(N.NEXT_DAY_META)}</span></div>`;
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
    const targets = inFight ? N.targetsOf(tokOfWho) : [];
    const bonus = other ? (+r.otherBonus || 0) : (who.skills[r.skill] ?? 0);
    const fightAtk = r.action === 'attack' && inFight;
    const fg = fightAtk && !other ? N.atkGear(tokOfWho, r.skill) : {roll:0, hit:0};
    /* Jake's distance debuff: aimed at someone in another zone, the GM picks how much the distance takes off the roll */
    const far = gm ? N.farOf(v, r) : null, dist = far ? (+r.dist || 0) : 0;
    const distHtml = far ? `<div class="distbox"><h4>Distance debuff</h4><p class="vsnote">${esc(N.tokName(far))} is in ${esc(N.zoneOf(far)?.name || 'another zone')}, ${esc(N.zoneOf(tokOfWho)?.name ? 'not ' + N.zoneOf(tokOfWho).name : 'another zone')}. Pick how much the distance takes off the roll.</p>
        <div class="ladder-chips">${[0,1,2,3,4,5,6].map(x => `<button type="button" class="lchip" data-a="rollDist" data-v="${x}" aria-pressed="${dist===x}"><b>${x ? '−' + x : '0'}</b>${x ? 'off the roll' : 'No drop-off'}</button>`).join('')}</div>
        ${fightAtk && r.skill === 'Fighting' ? `<p class="vsnote">${IC('info')}Fighting doesn’t reach another zone unless a stunt says so. Your call.</p>` : ''}</div>` : '';
    /* Jake's buff or debuff: the GM can put up to +6 or −6 on any roll, for whatever the moment calls for (r.mod) */
    const mod = gm ? Math.max(-6, Math.min(6, +r.mod || 0)) : 0;
    const modHtml = gm ? `<div class="modbox"><h4>Buff or debuff</h4><div class="ladder-chips modchips">${[-6,-5,-4,-3,-2,-1,0,1,2,3,4,5,6].map(x => `<button type="button" class="lchip${x < 0 ? ' deb' : x > 0 ? ' buf' : ''}" data-a="rollMod" data-v="${x}" aria-pressed="${mod===x}"><b>${x ? sgn(x) : '0'}</b>${x < 0 ? 'Debuff' : x > 0 ? 'Buff' : 'None'}</button>`).join('')}</div></div>` : '';
    /* out of a fight the GM can roll against one of their NPC cards: pick the skill it's rolled against, then the NPC,
       and the difficulty becomes that NPC's rating in it (still changeable). No NPC means the GM sets the difficulty. */
    const ev = gm && r.event && r.ctx === 'cb' && cb.state === 'live';
    /* an overcome or advantage rolled in the fight can be against someone too: another fighter's skill, like a custom event */
    const cbVs = gm && r.ctx === 'cb' && cb.state === 'live' && r.action !== 'attack';
    /* a contest roll has no difficulty: it is up against everyone else's this round */
    const contest = gm && r.contest && r.action === 'overcome' && !ev && r.ctx === 'cb' && cb.state === 'live';
    const chal = gm && r.chal && r.ctx === 'cb' && cb.state === 'live' ? (cb.tasks || []).find(x => x.id === r.chal) : null;
    const rp = gm && !fightAtk && !contest && (r.ctx !== 'cb' || ev || cbVs);
    const vsN = rp ? N.vsFind(v, r, r.vsNpc) : null, vsVal = vsN && r.vsSkill ? (vsN.skills[r.vsSkill] || 0) : null;
    const oppList = [null,-1,0,1,2,3,4,5,6,7,8,9,10,11,12]; if (r.opp != null && !oppList.includes(r.opp)) oppList.push(r.opp);
    const oppChips = `<div class="ladder-chips">${oppList.map(x => `<button type="button" class="lchip" data-a="rollOpp" data-v="${x}" aria-pressed="${r.opp===x}"><b>${x==null?'—':sgn(x)}</b>${x==null?'No target':ladderWord(x)}</button>`).join('')}</div>`;
    /* Who rolls and Against someone list only the scene; one tap shows everyone else */
    const sceneUp = !!g.scenes[v.ui.ch === 'gm' ? 'table' : v.ui.ch];
    const moreBtn = (a, on, n) => `<button type="button" class="btn sm ghost morewho" data-a="${a}" aria-pressed="${on}">${IC(on ? 'minus' : 'users')}${on ? (sceneUp ? 'Only who’s in the scene' : 'Only the player characters') : `Everyone else (${n})`}</button>`;
    const hidWho = gm ? N.allRollers(v).length - N.rollers({...v, ui:{...v.ui, roll:{...r, allWho:false}}}).length : 0;
    const moreWho = gm && (r.allWho || hidWho > 0) ? moreBtn('rollAllWho', !!r.allWho, hidWho) : '';
    const vsNpcs = rp ? N.vsCands(v, r) : [], outOfFight = !(r.ctx === 'cb' && cb.state === 'live');
    const hidVs = rp && outOfFight ? N.vsCands(v, {...r, allVs:true}).length - N.vsCands(v, {...r, allVs:false}).length : 0;
    const moreVs = rp && outOfFight && (r.allVs || hidVs > 0) ? `<div style="margin-top:6px">${moreBtn('rollAllVs', !!r.allVs, hidVs)}</div>` : '';
    const vsHtml = rp ? `<div class="vsbox"><h4>Rolled against</h4>
        <div class="vssk">${N.MUNDANE.map(k => `<button type="button" data-a="rollVsSkill" data-v="${k}" aria-pressed="${r.vsSkill===k}">${k}${vsN ? `<b>${sgn(vsN.skills[k] || 0)}</b>` : ''}</button>`).join('')}</div>
        ${vsNpcs.length || moreVs ? `<h4>Against someone (optional)</h4><div class="who-row vsnpc"><button type="button" data-a="rollVsNpc" data-v="" aria-pressed="${!vsN}"><span class="av" style="--s:44px;--c:var(--line-3);box-shadow:none;background:var(--sunk);color:var(--ink-3)">${IC('x').replace('<svg','<svg style="width:18px;height:18px"')}</span><span>No one</span></button>${vsNpcs.map(n => `<button type="button" data-a="rollVsNpc" data-v="${n.id}" aria-pressed="${!!vsN && vsN.id===n.id}">${N.av(n,44)}<span>${esc(n.name)}</span></button>`).join('')}</div>${moreVs}` : ''}
        ${r.action === 'advantage' && vsN && vsN.board ? `<p class="vsnote">If it works, the aspect goes on ${esc(vsN.name)}.</p>` : ''}
        <h4>${vsN ? 'Difficulty' : 'Set a difficulty'}</h4>${oppChips}
        <button type="button" class="toggle" data-a="rollPassive" aria-pressed="${r.passive !== false}">${IC('defend')}<span>Passive<small>${r.opp == null ? `Pick a difficulty above. On, ${vsN ? esc(vsN.name) : 'the other side'} doesn’t roll; off, they roll 4 Fate dice on top of it.` : r.passive !== false ? `${vsN ? esc(vsN.name) : 'The other side'} doesn’t roll. You roll against ${sgn(r.opp)}.` : `${vsN ? esc(vsN.name) : 'The other side'} rolls 4 Fate dice ${sgn(r.opp)} too, and you roll against their total.`}</small></span><span class="sw"></span></button>
        ${vsN ? `<p class="vsnote">${!r.vsSkill ? `Pick the skill ${esc(vsN.name)} rolls against and the difficulty follows it.` : r.opp === vsVal ? `${esc(vsN.name)}’s ${esc(r.vsSkill)} is ${sgn(vsVal)}, so that’s ${r.passive !== false ? 'the difficulty' : 'what they roll'}.` : `Set by hand. ${esc(vsN.name)}’s ${esc(r.vsSkill)} is ${sgn(vsVal)}.`}</p>` : ''}</div>` : '';
    const whoAv = o => o.other ? `<span class="av" style="--s:44px;--c:var(--line-3);box-shadow:none;background:var(--sunk);color:var(--ink-3)">${IC('person-plus').replace('<svg','<svg style="width:20px;height:20px"')}</span>` : N.av(o,44);
    const body = `
      ${gm ? `<div><h4>Who rolls</h4><div class="who-row">${N.rollers(v).map(o => `<button type="button" data-a="rollWho" data-v="${o.key}" aria-pressed="${o.key===who.key}">${whoAv(o)}<span>${esc(o.name)}</span></button>`).join('')}</div>${moreWho}</div>` : ''}
      ${other ? `<div style="display:grid;gap:10px;grid-template-columns:repeat(auto-fit,minmax(180px,1fr))"><label class="field"><span>Name</span><input class="inp" id="rother-${v.id}" data-i="rollOther" value="${esc(r.otherName)}" placeholder="e.g. City watch guard"></label>
        <div class="field"><span>Bonus</span><div class="seg" style="justify-content:space-between;width:100%"><button type="button" data-a="rollBonus" data-d="-1" aria-label="Less">${IC('minus')}</button><b style="align-self:center;font:700 18px/1 var(--f-display)">${sgn(bonus)}</b><button type="button" data-a="rollBonus" data-d="1" aria-label="More">${IC('plus')}</button></div></div></div>` : ''}
      ${chal ? `<div class="note chal-note">${IC('overcome')}<span>Part ${(cb.tasks || []).indexOf(chal) + 1} of the challenge${chal.label ? `: <b>${esc(chal.label)}</b>` : ''}. Set to roll <b>${esc(chal.skill)}</b>${r.skill !== chal.skill ? `, swapped for <b>${esc(r.skill)}</b>` : ''}. Pick another skill below to swap it (a stunt, say).</span></div>` : ''}
      ${ev ? `<label class="field"><span>What’s happening</span><input class="inp" id="rev-${v.id}" data-i="rollEv" value="${esc(r.evText||'')}" placeholder="e.g. Mind magic: reaches into the guard’s thoughts"></label>` : ''}
      <div><h4>What are you doing?</h4><div class="acts">${N.ACTIONS.filter(a => !(ev || ((r.ctx === 'cb' && cb.state === 'live') && N.cbKind() !== 'fight')) || (a[1] !== 'attack' && (ev || a[1] !== 'defend'))).map(([l,k]) => `<button type="button" class="act" data-a="rollAct" data-v="${k}" aria-pressed="${r.action===k}">${IC(k)}${l.replace('Create an advantage','Advantage')}</button>`).join('')}</div></div>
      ${r.action === 'attack' && inFight ? `<div><h4>Target</h4>${targets.length ? `<div class="tgts">${targets.map(t => { const z = t.zone !== tokOfWho.zone && N.zoneOf(t); return `<button type="button" class="tgt" data-a="rollTgt" data-v="${t.id}" aria-pressed="${r.target===t.id}">${N.av(N.tokObj(t),32)}${esc(N.tokName(t))}${N.sideOf(t) === N.sideOf(tokOfWho) ? '<small class="ff">Own side</small>' : ''}${z ? `<small class="ff fz" style="--zc:${z.col}">${esc(z.name)}</small>` : ''}</button>`; }).join('')}</div>` : `<div class="note">${IC('info')}Nobody else is on the board.</div>`}</div>` : ''}
      ${r.action === 'advantage' ? `<label class="field"><span>Aspect you’re creating</span><input class="inp" id="rasp-${v.id}" data-i="rollAsp" value="${esc(r.aspect||'')}" placeholder="e.g. Blinded by Spilled Ale"></label>` : ''}
      ${other ? '' : `<div><h4>Skill</h4><div class="skills">${skills.map(([n,x]) => `<button type="button" class="sk" data-a="rollSkill" data-v="${esc(n)}" aria-pressed="${r.skill===n}"><span><b>${esc(n)}</b><small>${ladderWord(x)}</small></span><span class="v">${sgn(x)}</span></button>`).join('')}
        ${r.all || !skills.length ? rest.map(n => `<button type="button" class="sk" data-a="rollSkill" data-v="${n}" aria-pressed="${r.skill===n}"><span><b>${n}</b><small>Mediocre</small></span><span class="v">+0</span></button>`).join('') : ''}</div>
        ${r.all || !skills.length ? '' : `<button type="button" class="btn sm ghost" data-a="rollAll" style="margin-top:8px">Show every skill (${rest.length} more at +0)</button>`}</div>`}
      ${contest ? `<div class="note">${IC('flag')}A contest roll: the highest roll this round wins it when the round is scored. Invokes still count until then.</div>` : fightAtk ? `<div class="note">${IC('defend')}Your target rolls to defend right after you. The result shows in the chat once both rolls are in.</div>` : rp ? vsHtml : `<div><h4>Against ${r.action==='attack'||r.action==='defend'?'(the other side rolls)':'(optional)'}</h4>${oppChips}</div>`}
      ${fightAtk && !other ? N.atkNotes(v, tokOfWho, r.skill) : ''}
      ${distHtml}
      ${modHtml}
      ${gm ? rnoteFields(v, r.gmNote || '', r.noteSee || [], v.ui.ch, 'rollNote', 'rollNoteSee') : ''}
      ${gm ? `<button type="button" class="toggle" data-a="rollSecret" aria-pressed="${!!r.secret}">${IC('eyeoff')}<span>Secret roll<small>${ev ? 'Only you see it, in your fight log. Players don’t.' : 'Only you see it, in GM notes.'}</small></span><span class="sw"></span></button>` : ''}
      <p class="rollsum">4 Fate dice + ${other ? 'bonus' : esc(r.skill)} ${sgn(bonus)}.${fg.roll ? ` Ranged weapon +${fg.roll} goes on the roll.` : ''}${fg.hit ? ` A hit gets +${fg.hit} shifts from the ${fg.hitL}.` : ''}${dist ? ` Distance −${dist} comes off the roll.` : ''}${mod ? ` ${mod > 0 ? `Buff +${mod} goes on` : `Debuff −${-mod} comes off`} the roll.` : ''} After you see the roll you can invoke aspects for +2 or a reroll.</p>`;
    const dis = r.action === 'attack' && inFight && !r.target;
    return sheet(ev ? 'Custom event' : 'Roll the dice', body, `<button type="button" class="btn gold lg" data-a="doRoll" ${dis?'disabled':''}>${N.fateDie}Roll ${other ? '' : esc(r.skill) + ' '}${sgn(bonus + fg.roll - dist + mod)}</button>`, {lead:other ? '' : N.av(who,36)});
  }
  /* the GM's note on a roll already in the chat: add, change or take it off */
  case 'rnote': {
    const d = v.ui.rn, m = d && g.msgs.find(x => x.id === d.id); if (!m || !isGM(v)) return '';
    return sheet('GM note on the roll', `<p class="muted" style="margin:0;font:600 13px/1.4 var(--f-ui)">${esc(m.roll.who)} · ${esc(m.roll.skill)} · ${esc(m.roll.action)}</p>${rnoteFields(v, d.t, d.see, m.ch, 'rnText', 'rnSee')}`,
      `${g.rnotes?.[m.id] ? `<button type="button" class="btn danger" data-a="rnDel" style="flex:0 0 auto">${IC('trash')}Remove</button>` : ''}<button type="button" class="btn primary lg" data-a="rnSave">${IC('check')}Save note</button>`);
  }
  /* ---------------- invoke ---------------- */
  case 'invoke': {
    const m = g.msgs.find(x => x.id === arg); if (!m) return '';
    const x = N.invokeCtx(v, m), opts = N.invokeOptions(v, m, x), sd = x.sides, pay = x.pay;
    const r = x.onto.roll, tot = N.rollTotal(r), mine = !sd || x.by === sd.me;
    const fpOf = t => { const p = N.invokePayer(v, m.roll, t); return p ? `<small class="ifp">${p.o.fp || 0} FP</small>` : ''; };
    const pick = sd && sd.opp ? `<div><h4>Who is invoking</h4><div class="forwho invwho" role="group" aria-label="Who is invoking">${[sd.me, sd.opp].map(t =>
        `<button type="button" data-a="invBy" data-v="${t.id}" aria-pressed="${x.by === t}" ${t === sd.opp && sd.wait ? 'disabled' : ''}>${N.av(N.tokObj(t), 28)}${esc(N.tokName(t))}${fpOf(t)}</button>`).join('')}</div>
      <p class="muted invwhere">${sd.wait ? `${esc(N.tokName(sd.opp))} can invoke once they have rolled to defend. ` : ''}${mine ? `Goes on ${esc(N.tokName(sd.me))}’s ${esc(r.action.toLowerCase())} roll.` : x.against ? `Adds +2 to what ${esc(N.tokName(sd.me))} has to beat. A reroll isn’t possible, ${esc(N.tokName(x.by))} has no roll of their own here.` : `Goes on ${esc(N.tokName(x.by))}’s ${esc(r.action.toLowerCase())} roll, against ${esc(N.tokName(sd.me))}.`}</p></div>` : '';
    const who = pay ? (pay.o === N.charOf(v.role) ? 'your' : `${esc(pay.name)}’s`) : '';
    const cost = pay ? `the rest cost one of ${who} fate points (${pay.o.fp || 0} left)` : gm ? `${x.by ? esc(N.tokName(x.by)) + ' keeps' : 'this roll keeps'} no fate points, so the rest are free too` : 'the rest cost a fate point (you have none)';
    const sum = x.against ? `${esc(N.tokName(sd.me))} has to beat ${sgn(r.opp)} ${ladderWord(r.opp)}. +2 makes it ${sgn(r.opp + 2)} ${ladderWord(r.opp + 2)}.`
      : `Now ${sgn(tot)} ${ladderWord(tot)}. +2 makes it ${sgn(tot + 2)} ${ladderWord(tot + 2)}. A reroll keeps ${esc(r.skill)} ${sgn(N.skillPart(r))}${r.mod ? `, the ${r.mod > 0 ? 'buff' : 'debuff'} ${sgn(r.mod)}` : ''}${N.plusInvokes(r)?` and the +${2*N.plusInvokes(r)} already invoked`:''} and rolls the dice again (they show ${sgn(N.diceSum(r))} now).`;
    const body = `${pick}<div class="note">${IC('cards')}Pick an aspect that helps, then take +2${x.against ? '' : ' or reroll all four dice'}. Free invokes cost nothing, ${cost}.</div>
      <p class="rollsum" style="margin:0">${sum}</p>
      <div style="display:grid;gap:8px">${opts.map((o,i) => { const dis = (!o.free && (pay ? (pay.o.fp || 0) < 1 : !gm)) ? 'disabled' : ''; return `<div class="invopt${o.unnamed ? ' unnamed' : ''}">${o.unnamed ? `<label class="field unasp"><span>Unnamed aspect</span><input class="inp" id="invn-${v.id}" data-i="invName" value="${esc(v.ui.invName || '')}" placeholder="Not listed? Name it if you like"></label>` : `<span class="icard" style="--rot:${i%2?.6:-.6}deg"><span>${N.emoText(N.marks(esc(o.t)))}</span></span>`}<span class="cost">${o.free ? `<b style="color:var(--gold-tx)">Free</b><small>${o.free} left · ${esc(o.from)}</small>` : `<b>${pay || !gm ? '1 fate point' : 'No cost'}</b><small>${esc(o.from)}</small>`}</span><span class="how"><button type="button" class="btn sm gold" data-a="doInvoke" data-i="${i}" data-how="plus" ${dis}>+2</button>${x.against ? '' : `<button type="button" class="btn sm" data-a="doInvoke" data-i="${i}" data-how="reroll" ${dis}>${N.fateDie}Reroll</button>`}</span></div>`; }).join('') || '<p class="muted">No aspects to invoke here yet.</p>'}</div>`;
    const addAsp = gm && g.combat.state === 'live' && m.ch === N.fightCh() ? `<button type="button" class="btn ghost" data-a="invAsp">${IC('plus')}Add situation aspect</button>` : '';
    /* the GM's buff or debuff on this roll, after the fact (defense and Notice rolls never pass the roll sheet) */
    const mr = m.roll, md = mr.mod || 0;
    const modRow = gm ? `<div class="invmod"><span class="grow"><b>Buff or debuff this roll</b><small>${md ? `${esc(mr.who)}’s roll has ${md > 0 ? 'a buff of' : 'a debuff of'} ${sgn(md)}. ` : ''}Up to +6 or −6, the total follows.</small></span><span class="seg"><button type="button" data-a="invMod" data-d="-1" aria-label="Debuff 1 more" ${md <= -6 ? 'disabled' : ''}>${IC('minus')}</button><b class="${md > 0 ? 'buf' : md < 0 ? 'deb' : ''}">${md ? sgn(md) : '0'}</b><button type="button" data-a="invMod" data-d="1" aria-label="Buff 1 more" ${md >= 6 ? 'disabled' : ''}>${IC('plus')}</button></span></div>` : '';
    const addBoost = addAsp && `<button type="button" class="btn ghost" data-a="invBoost">${IC('sparkle')}Give a boost</button>`;
    return sheet('Invoke an aspect', body + modRow, addAsp + addBoost);
  }
  /* ---------------- the GM's shifts on a result (after the roll) ---------------- */
  case 'shifts': {
    if (!gm) return '';
    /* arg is a roll's id, or 'fight' for the open attack's result card */
    const fight = arg === 'fight', q = fight && N.cbOpen(), m = !fight && g.msgs.find(x => x.id === arg);
    if (fight ? !q : !m || m.kind !== 'roll' || m.roll.opp == null) return '';
    const was = (fight ? q.shift : m.roll.shift) || 0, n = v.ui.shDraft ?? was;
    let base, who, what;
    if (fight) {
      const dm = g.msgs.find(x => x.id === q.defMsg), dt = dm ? N.rollTotal(dm.roll) : 0;
      who = `${N.tokName(N.tokById(q.att)) || 'The attacker'}`; base = q.total - dt;
      what = `${esc(who)} rolled ${sgn(q.total)} against ${esc(N.tokName(N.tokById(q.def)) || 'the defense')}’s ${sgn(dt)}`;
    } else {
      const r = m.roll; who = r.who; base = N.rollTotal(r) - r.opp;
      what = `${esc(who)} rolled ${sgn(N.rollTotal(r))} against ${sgn(r.opp)}`;
    }
    const sh = base + n;
    const word = fight ? (sh > 0 ? `Hit by ${sh}` : sh === 0 ? 'Tie' : sh <= -3 ? 'Defended with style' : 'Defended')
      : N.outcome({dice:[0], bonus:sh, opp:0, invokes:[]}).t + (sh ? ` · ${sh > 0 ? '+' : '−'}${Math.abs(sh)}` : '');
    const k = fight ? (sh > 0 ? 'fail' : sh === 0 ? 'tie' : 'succ') : (sh < 0 ? 'fail' : sh === 0 ? 'tie' : sh < 3 ? 'succ' : 'style');
    const body = `<div class="note">${IC('swap')}Change the outcome after the dice. The roll stays as rolled, the shifts move. ${fight ? 'Hit, tie or miss, damage and boosts follow, like after an invoke.' : ''}</div>
      <p class="rollsum" style="margin:0">${what}: ${base > 0 ? `${base} shift${base === 1 ? '' : 's'} up` : base < 0 ? `${-base} shift${base === -1 ? '' : 's'} short` : 'a tie'}.</p>
      <div class="invmod shmod"><span class="grow"><b>${n > 0 ? 'Add shifts' : n < 0 ? 'Take away shifts' : 'No change'}</b><small>Up to +6 or −6. Everyone sees it on the result.</small></span><span class="seg"><button type="button" data-a="shAdj" data-d="-1" aria-label="One shift less" ${n <= -6 ? 'disabled' : ''}>${IC('minus')}</button><b class="${n > 0 ? 'buf' : n < 0 ? 'deb' : ''}">${n ? sgn(n) : '0'}</b><button type="button" data-a="shAdj" data-d="1" aria-label="One shift more" ${n >= 6 ? 'disabled' : ''}>${IC('plus')}</button></span></div>
      <div class="shnow"><span>Result</span><span class="out ${k}">${esc(word)}</span></div>`;
    return sheet('Shifts on the result', body, `<button type="button" class="btn ghost" data-a="closeSheet">Cancel</button><button type="button" class="btn gold" data-a="shApply" ${n === was ? 'disabled' : ''}>${IC('check')}Apply ${n ? sgn(n) : 'no'} shift${Math.abs(n) === 1 ? '' : 's'}</button>`);
  }
  /* ---------------- one picture folder of the scene window (GM): pick a picture and go back ---------------- */
  case 'scenePics': {
    const d = v.ui.sd; if (!d) return '';
    const up = arg === 'up', pics = up ? g.pics.map(u => ({id:u.id, title:'', art:u.src, sub:'Your upload', up:true})) : N.ARTLIB.map(a => ({id:a.id, title:a.label, art:a.art, sub:'Norne art'}));
    return sheet(up ? 'Your uploads' : 'Norne art', `<p class="muted" style="margin:0;font:600 12.5px/1.4 var(--f-ui)">Tap a picture to use it for the scene.</p>
      <div class="thumbs">${pics.map(p => sdThumb(d, p)).join('')}
        ${up ? `<button type="button" class="thumb up" data-a="sdUpload"><span>${IC('upload')}Upload a picture</span></button>` : ''}
        ${up && !pics.length ? '<p class="muted" style="margin:0;font:600 13px/1.4 var(--f-ui);align-self:center">Pictures you upload land here, and on the Your pictures shelf on the GM screen.</p>' : ''}</div>`,
      `<button type="button" class="btn ghost" data-a="closeSheet">${IC("left")}Back to the scene</button>`, {wide:true});
  }
  /* ---------------- scene picker (GM) ---------------- */
  case 'scene': {
    const d = v.ui.sd, tab = d.tab;
    /* the Pictures tab has two folders: the art that comes with Norne, and the GM's own uploads (opens on the one holding the current picture) */
    /* the Pictures tab shows only its two folders (the art that comes with Norne, the GM's own uploads); tapping one opens
       it in its own window, and picking a picture there brings you back here. The folder holding the current picture shows it */
    const pf = d.art && !d.place ? (g.pics.some(u => u.src === d.art) ? 'up' : N.ARTLIB.some(a => a.art === d.art) ? 'app' : null) : null;
    const fold = (k, name, n) => `<button type="button" data-a="sdFold" data-v="${k}" class="${pf === k ? 'has' : ''}">${pf === k ? `<i class="fpic">${N.scenePic({art:d.art})}</i>` : IC('folder')}<span>${name}<small>${pf === k ? 'In use · ' : ''}${n} ${n === 1 ? 'picture' : 'pictures'}</small></span>${IC("right")}</button>`;
    const pins = g.maps.flatMap(mp => mp.pins.filter(p => ['city','town','hood','region','tavern','landmark','shop','temple','nation'].includes(p.type)).map(p => ({map:mp.id, id:p.id, rx:p.rx, ry:p.ry, label:p.label, sub:p.sub ? `${p.sub} · ${mp.name}` : mp.name})));
    const pics = tab === 'recent' ? g.recent.map(r => ({...r, sub:r.where}))
      : tab === 'maps' ? pins.map(p => ({id:`pl:${p.map}:${p.id}`, title:p.label, sub:p.sub, place:{map:p.map, rx:p.rx, ry:p.ry}}))
      : [];
    const forwho = N.channelsFor('gm').filter(c => c !== 'gm'), has = g.scenes[d.ch], edit = has && d.mode === 'edit';
    /* a scene aspect can sit on someone in the scene (like a fight's situation aspect): the chat's player characters, its NPCs and one-offs */
    const onNames = [...new Set([...N.chPcs(d.ch).map(c => c.short), ...d.cast, ...d.extras.map(x => x.name), ...d.aspects.map(a => a.on).filter(Boolean)])];
    const aspOn = (a, i) => onNames.length ? `<select class="aspon-sel" id="sdao-${v.id}-${i}" data-i="sdAspOn" data-n="${i}" aria-label="Who “${esc(a.t)}” is on"><option value="">Whole scene</option>${onNames.map(n => `<option value="${esc(n)}" ${a.on === n ? 'selected' : ''}>On ${esc(n)}</option>`).join('')}</select>` : '';
    const body = `
      ${has ? `<div class="seg sdmode" role="group" aria-label="Edit or start new"><button type="button" data-a="sdMode" data-v="edit" aria-pressed="${edit}">${IC('pen')}Edit this scene</button><button type="button" data-a="sdMode" data-v="new" aria-pressed="${!edit}">${IC('plus')}Start a new scene</button></div>
        <p class="muted" style="margin:-6px 0 0;font:600 12.5px/1.4 var(--f-ui)">${edit ? `Changes fix up “${esc(has.title)}” in place. No new scene line in the chat, and free invokes already spent stay spent.` : `“${esc(has.title)}” ends and a fresh scene starts in this chat.`}</p>` : ''}
      <div><h4>Who it’s for</h4><div class="forwho">${forwho.map(c => `<button type="button" data-a="sdFor" data-v="${c}" aria-pressed="${d.ch===c}">${c==='table'?`<span class="cic">${IC('users')}</span>Everyone`:c.startsWith('grp-')?`<span class="cic">${IC('whisper')}</span>${esc(N.chName(c,'gm'))}`:N.av(N.personObj(c.slice(3)),28)+esc(pName(c.slice(3)))+' only'}</button>`).join('')}</div></div>
      <div><div style="display:flex;align-items:center;justify-content:space-between;gap:8px;margin-bottom:8px;flex-wrap:wrap"><h4 style="margin:0">Picture</h4><div class="seg"><button type="button" data-a="sdTab" data-v="recent" aria-pressed="${tab==='recent'}">Recent</button><button type="button" data-a="sdTab" data-v="pics" aria-pressed="${tab==='pics'}">Pictures</button><button type="button" data-a="sdTab" data-v="maps" aria-pressed="${tab==='maps'}">Map places</button></div></div>
        ${tab==='pics' ? `<div class="sdfold" role="group" aria-label="Picture folders">${fold('app', 'Norne art', N.ARTLIB.length)}${fold('up', 'Your uploads', g.pics.length)}</div>` : ''}
        ${tab==='pics' ? '' : `<div class="thumbs">${pics.map(p => sdThumb(d, p)).join('')}
          ${tab==='recent' && !pics.length ? '<p class="muted" style="margin:0;font:600 13px/1.4 var(--f-ui)">Scenes you set show up here for one-tap reuse.</p>' : ''}
          ${tab==='maps' && !pics.length ? '<p class="muted" style="margin:0;font:600 13px/1.4 var(--f-ui)">No places on the maps yet.</p>' : ''}</div>`}
          ${d.art && !d.place ? `<div style="margin-top:10px"><button type="button" class="btn sm ghost fr-adj" data-a="sdFrame">${IC('fit')}Adjust framing</button></div>` : ''}</div>
      <div style="display:grid;gap:10px;grid-template-columns:repeat(auto-fit,minmax(180px,1fr))">
        <label class="field"><span>Scene name</span><input class="inp" id="sdt-${v.id}" data-i="sd" data-k="title" value="${esc(d.title)}" placeholder="e.g. A quiet back room"></label>
        <label class="field"><span>Where</span><input class="inp" id="sdw-${v.id}" data-i="sd" data-k="where" value="${esc(d.where)}" placeholder="Town or region"></label>
        <label class="field"><span>When (optional)</span><input class="inp" id="sdd-${v.id}" data-i="sd" data-k="date" value="${esc(d.date)}" placeholder="In-world day or time"></label>
      </div>
      ${(() => { /* where the scene is: players who are told see a beacon on their maps that opens country, city, then neighborhood */
        const L = d.loc || (d.loc = {c:'', t:'', n:''}), sel = (k, opts, none) => `<label class="field"><span>${N.LOCNAME[k]}${k === 'n' ? ' (optional)' : ''}</span><select class="inp" id="sdl${k}-${v.id}" data-i="sdLoc" data-k="${k}" ${opts.length ? '' : 'disabled'}><option value="">${none}</option>${opts.map(o => `<option value="${esc(N.locKey(o))}" ${L[k] === N.locKey(o) ? 'selected' : ''}>${esc(o.l)}</option>`).join('')}</select></label>`;
        const cs = N.locOpts('c', L), ts = N.locOpts('t', L), ns = N.locOpts('n', L), built = N.locBuild(L);
        const cName = cs.find(o => N.locKey(o) === L.c)?.l, tName = ts.find(o => N.locKey(o) === L.t)?.l;
        const why = !cs.length ? 'Mark the countries on a map as Nation pins to pick them here.'
          : L.c && !ts.length ? `${esc(cName)} doesn’t open a map yet. Edit the map, tap its pin and pick “Opens map”.`
          : L.t && !ns.length ? `${esc(tName)} has no neighborhood map, so it stops at the city. That’s fine.` : '';
        return `<div class="sdloc"><div style="display:flex;align-items:center;justify-content:space-between;gap:8px;margin-bottom:8px;flex-wrap:wrap"><h4 style="margin:0">Location</h4>${built ? `<button type="button" class="btn sm ghost" data-a="sdLocClear">Clear</button>` : ''}</div>
          <div style="display:grid;gap:10px;grid-template-columns:repeat(auto-fit,minmax(160px,1fr))">${sel('c', cs, 'Not set')}${sel('t', ts, L.c ? 'Pick a city' : '—')}${sel('n', ns, L.t ? 'None' : '—')}</div>
          ${why ? `<p class="muted" style="margin:6px 0 0;font:600 12.5px/1.4 var(--f-ui)">${why}</p>` : ''}
          ${built ? `<button type="button" class="toggle" data-a="sdShare" aria-pressed="${d.share !== false}" style="margin-top:10px">${IC('pinL')}<span>Share location with players<small>${d.share !== false ? `They see a blinking beacon on their map at ${esc(N.locText(built))}.` : 'They don’t know where they are. No beacon on their map.'}</small></span><span class="sw"></span></button>` : ''}</div>`; })()}
      <div><h4>Scene aspects · tap the dots for free invokes</h4><div class="icards">${d.aspects.map((a,i) => `<span class="icard sdasp" style="--rot:${i%2?.7:-.7}deg;display:inline-flex;align-items:center;gap:6px">${esc(a.t)}${aspOn(a, i)}<button type="button" class="fi fib" data-a="sdAspFree" data-i="${i}" aria-label="Free invokes: ${a.free||0}" title="Free invokes">${a.free?'<i></i>'.repeat(a.free):'<em>0</em>'}</button><button type="button" class="xb" data-a="sdAspDel" data-i="${i}" aria-label="Remove ${esc(a.t)}">${IC('x')}</button></span>`).join('')}
        <span style="display:flex;gap:6px;flex:1;min-width:200px"><input class="inp" id="sda-${v.id}" data-i="sd" data-k="newAsp" value="${esc(d.newAsp||'')}" placeholder="Add an aspect" style="min-height:36px;padding:6px 12px"><button type="button" class="btn sm" data-a="sdAspAdd">${IC('plus')}Add</button></span></div></div>
      ${(() => { /* who's here: Speak as in this chat then lists only these NPCs (the rest stay one tap away). Kept in GM-only data */
        const all = N.voices(), q = (d.castQ || '').trim().toLowerCase(), shown = all.filter(n => !q || n.toLowerCase().includes(q) || d.cast.includes(n));
        if (!all.length) return '';
        return `<div><div style="display:flex;align-items:center;justify-content:space-between;gap:8px;margin-bottom:8px;flex-wrap:wrap"><h4 style="margin:0">NPCs in this scene${d.cast.length ? ` · ${d.cast.length}` : ''}</h4>${d.cast.length ? `<button type="button" class="btn sm ghost" data-a="sdCastNone">Clear</button>` : ''}</div>
          ${all.length > 10 ? `<div class="pop-find sd-find">${IC('search')}<input class="inp" id="sdcq-${v.id}" data-i="castQ" placeholder="Find an NPC" value="${esc(d.castQ || '')}" autocomplete="off"></div>` : ''}
          ${(() => { /* the GM's NPC folders from the Cast page: loose NPCs first, then each folder, closed until opened (or while searching) */
            const chip = n => { const npc = N.npcByName(n); return `<button type="button" data-a="sdCast" data-v="${esc(n)}" aria-pressed="${d.cast.includes(n)}">${N.av({name:n, portrait:npc?.portrait, color:'var(--c-npc)'}, 28)}${esc(n)}</button>`; };
            const dirOf = n => N.nd.of(N.npcByName(n)), dirs = N.nd.list().filter(([id]) => shown.some(n => N.nd.tree(id).includes(dirOf(n))));
            if (!dirs.length) return `<div class="forwho sdcast" role="group" aria-label="NPCs in this scene">${shown.map(chip).join('') || '<p class="muted" style="margin:0;font:600 13px/1.4 var(--f-ui)">No NPC by that name.</p>'}</div>`;
            const loose = shown.filter(n => !dirOf(n)), open = d.dirOpen || {};
            return `${loose.length ? `<div class="forwho sdcast" role="group" aria-label="NPCs not in a folder">${loose.map(chip).join('')}</div>` : ''}<div class="sddirs">${dirs.map(([id, , depth]) => {
              const dir = N.nd.byId(id), here = shown.filter(n => dirOf(n) === id), all = N.nd.npcs(id).map(n => n.name.trim()).filter(Boolean), on = all.filter(n => d.cast.includes(n)).length, isOpen = q || open[id];
              return `<div class="sddir" style="--dd:${depth}"><div class="sddir-h"><button type="button" class="sddir-t" data-a="sdDirTog" data-v="${esc(id)}" aria-expanded="${!!isOpen}">${IC('folder')}<span><b>${esc(dir.name)}</b><small>${on ? `${on} of ${all.length} here` : `${all.length} ${all.length === 1 ? 'NPC' : 'NPCs'}`}</small></span>${IC(isOpen ? 'caret' : 'right')}</button><button type="button" class="btn sm ghost" data-a="sdCastDir" data-v="${esc(id)}">${on === all.length ? 'Unpick all' : `Pick all ${all.length}`}</button></div>
                ${isOpen && here.length ? `<div class="forwho sdcast" role="group" aria-label="NPCs in ${esc(dir.name)}">${here.map(chip).join('')}</div>` : ''}</div>`; }).join('')}</div>`; })()}
          <p class="muted" style="margin:6px 0 0;font:600 12.5px/1.4 var(--f-ui)">${d.cast.length ? `Speak as in this chat lists only ${d.cast.length === 1 ? 'this NPC' : `these ${d.cast.length}`} and the Narrator. Everyone else is one tap away. Players don’t see this list.` : 'Pick who is here and Speak as lists only them. None picked lists no NPC cards; everyone else is still one tap away.'}</p></div>`; })()}
      <div><h4>One-off NPCs · only for this scene${d.extras.length ? ` · ${d.extras.length}` : ''}</h4>
        ${d.extras.length ? `<div class="sdones">${d.extras.map((x, i) => `<span class="sdone">${N.av({name:x.name, color:'var(--c-npc)'}, 28)}<span><b>${esc(x.name)}</b><small>${Object.entries(x.skills || {}).map(([k, n]) => `${esc(k)} ${sgn(n)}`).join(' · ') || 'No skills'}</small></span><button type="button" class="xb" data-a="sdOneDel" data-v="${i}" aria-label="Remove ${esc(x.name)}">${IC('x')}</button></span>`).join('')}</div>` : ''}
        <div class="sdone-add"><input class="inp" id="sdon-${v.id}" data-i="sd" data-k="oneName" value="${esc(d.oneName || '')}" placeholder="Name, e.g. The innkeeper" aria-label="One-off NPC name">
          <select class="inp" id="sdos-${v.id}" data-i="sd" data-k="oneSkill" aria-label="Skill"><option value="">No skill</option>${N.MUNDANE.map(k => `<option ${d.oneSkill === k ? 'selected' : ''}>${esc(k)}</option>`).join('')}</select>
          <select class="inp" id="sdor-${v.id}" data-i="sd" data-k="oneRate" aria-label="Rating">${[-1,0,1,2,3,4,5,6,7,8].map(n => `<option value="${n}" ${(+d.oneRate || 0) === n ? 'selected' : ''}>${sgn(n)} ${ladderWord(n)}</option>`).join('')}</select>
          <button type="button" class="btn sm" data-a="sdOneAdd">${IC('plus')}Add</button></div>
        <p class="muted" style="margin:6px 0 0;font:600 12.5px/1.4 var(--f-ui)">They show in Speak as and can roll or be rolled against in this chat. No NPC card is made, and they’re gone when the scene ends. Add the same name again to give them another skill.</p></div>
      ${edit ? sdCopyHtml(d, forwho) : ''}
      ${edit ? '' : `<button type="button" class="toggle" data-a="sdPost" aria-pressed="${d.post}">${IC('scroll')}<span>Mark it in the chat<small>Adds a small “New scene” line so the log reads like chapters.</small></span><span class="sw"></span></button>`}`;
    const ok = d.title.trim() && (d.art || d.place), forName = d.ch === 'table' ? 'everyone' : esc(N.chName(d.ch, 'gm'));
    return sheet(edit ? 'Edit the scene' : has ? 'Start a new scene' : 'Set the scene', body,
      edit ? `<button type="button" class="btn danger" data-a="sheet" data-v="sceneEnd" style="flex:0 0 auto">${IC('stop')}End scene</button><button type="button" class="btn primary lg" data-a="sdSave" ${ok ? '' : 'disabled'}>${IC('check')}Save changes</button>`
           : `<button type="button" class="btn primary lg" data-a="sdApply" ${ok ? '' : 'disabled'}>${IC('image')}Start scene for ${forName}</button>`, {wide:true});
  }
  case 'sceneEnd': {
    const ch = v.ui.sd?.ch || (v.ui.ch === 'gm' ? 'table' : v.ui.ch), sc = g.scenes[ch]; if (!sc) return '';
    const n = N.extrasOf(ch).length;
    return sheet(`End “${esc(sc.title)}”?`, `<p style="margin:0;font:500 15px/1.5 var(--f-ui);color:var(--ink-2)">The scene banner comes down in ${ch === 'table' ? 'Everyone' : esc(N.chName(ch, 'gm'))} and its aspects go with it.${n ? ` Its ${n === 1 ? 'one-off NPC is' : `${n} one-off NPCs are`} removed.` : ''} The chat itself stays. You can undo it for a few seconds.</p>`,
      `<button type="button" class="btn ghost" data-a="sheet" data-v="scene">Keep it</button><button type="button" class="btn danger" data-a="sdEnd" data-v="${esc(ch)}">${IC('stop')}End scene</button>`);
  }
  /* ---------------- GM screen / my hero on phones ---------------- */
  case 'gm': return sheet('GM screen', N.gmScreen(v).replace('<div class="gs">','<div class="gs" style="padding:0">'), '', {lead:`<span class="av narrav" style="--s:34px">${N.STAR}</span>`});
  case 'hero': return sheet('My character', N.heroQuick(v).replace('<div class="gs">','<div class="gs" style="padding:0">'));
  case 'tokRm': { const t = N.tokById(arg); if (!t) return ''; const nm = esc(N.tokName(t)), npc = t.kind === 'npc' && G().npcs.some(n => n.id === t.ref);
    return sheet(`Remove ${nm}?`, `<p style="margin:0;font:500 15px/1.5 var(--f-ui);color:var(--ink-2)">${nm} leaves the battlefield and the turn order for everyone.${npc ? ' Their NPC card stays in your cards.' : t.kind === 'pc' ? ' Their character card is not touched.' : ''}</p>`,
      `<button type="button" class="btn ghost" ${v.dev === 'phone' ? `data-a="sheet" data-v="tok" data-c="${t.id}"` : 'data-a="closeSheet"'}>Keep them</button><button type="button" class="btn danger" data-a="tokRemove" data-t="${t.id}">${IC('trash')}Remove from fight</button>`); }
  case 'tok': { const t = N.tokById(arg); return t ? sheet(esc(N.tokName(t)), N.tokCard(v, t)) : ''; }
  case 'zone': { const z = g.combat.zones.find(x => x.id === arg); return z ? sheet('Edit zone', N.zoneForm(v, z), `<button type="button" class="btn primary" data-a="closeSheet">Done</button>`) : ''; }
  /* ---------------- profile ---------------- */
  case 'profile': {
    const me = N.personObj(v.role), mp = N.metaPic(v.role);
    const c = !gm && N.charOf(v.role);
    const pending = N.MEMBERS.filter(m => m.role === 'pending').length, my = N.me();
    const meta = `<div><h4>Meta picture<small>${mp ? 'Shown when you talk as yourself' : gm ? 'None yet. Your Meta messages show your initial' : 'None yet. Your Meta messages use your character’s picture'}</small></h4><div class="row" style="flex-wrap:wrap;gap:8px">
        <button type="button" class="btn sm ${mp ? 'ghost' : 'primary'}" data-a="metaUp">${IC('upload')}${mp ? 'Change' : 'Upload a picture'}</button>
        ${mp ? `<button type="button" class="btn sm ghost" data-a="metaFrame">${IC('fit')}Adjust</button><button type="button" class="btn sm ghost" data-a="metaNone">${IC('trash')}Remove</button>` : ''}</div></div>`;
    const body = `<div class="prof"><button type="button" class="facebtn" data-a="metaUp" aria-label="Change my Meta picture">${N.av(me,56)}<span class="badge">${IC('image')}</span></button><span><b>${esc(my?.name || me.name)}</b><small>${gm?'Game master':'Player'} · ${esc(my?.email || 'signed in with Google')}</small></span></div>
      ${meta}
      ${mySeats(v)}
      <div><h4>Appearance</h4><div class="seg" style="width:100%"><button type="button" style="flex:1;justify-content:center" data-a="theme" data-v="night" aria-pressed="${v.theme==='night'}">${IC('moon')}Night</button><button type="button" style="flex:1;justify-content:center" data-a="theme" data-v="day" aria-pressed="${v.theme==='day'}">${IC('sun')}Day</button></div></div>
      <div><h4>Style</h4>${stylePick(v)}</div>
      <div><h4>Edge shading<small>Darkened section edges. On this device only</small></h4><div class="seg" style="width:100%"><button type="button" style="flex:1;justify-content:center" data-a="vg" data-v="on" aria-pressed="${v.vg!==false}">On</button><button type="button" style="flex:1;justify-content:center" data-a="vg" data-v="off" aria-pressed="${v.vg===false}">Off</button></div></div>
      <div><h4>Depth<small>Raised panels, buttons and icons. On this device only</small></h4><div class="seg" style="width:100%"><button type="button" style="flex:1;justify-content:center" data-a="dp" data-v="on" aria-pressed="${v.dp!==false}">On</button><button type="button" style="flex:1;justify-content:center" data-a="dp" data-v="off" aria-pressed="${v.dp===false}">Off</button></div></div>
      <div><h4>Smooth mode<small>Turns off shadows, blur and the moving stars so the app runs lighter. On this device only</small></h4><div class="seg" style="width:100%"><button type="button" style="flex:1;justify-content:center" data-a="lite" data-v="on" aria-pressed="${v.lite}">On</button><button type="button" style="flex:1;justify-content:center" data-a="lite" data-v="off" aria-pressed="${!v.lite}">Off</button></div></div>
      <div><h4>Frame counter<small>Shows how smoothly the screen is drawing, in the top corner. On this device only</small></h4><div class="seg" style="width:100%"><button type="button" style="flex:1;justify-content:center" data-a="fps" data-v="on" aria-pressed="${v.fps}">On</button><button type="button" style="flex:1;justify-content:center" data-a="fps" data-v="off" aria-pressed="${!v.fps}">Off</button></div></div>
      <div><h4>Text size<small>On this device only</small></h4>${fzPick(v)}</div>
      ${N.figOk && N.figOk() && N.figPrefOn ? `<div><h4>Figures in fights<small>3D figures on the fight board instead of round tokens. On this device only</small></h4><div class="seg" style="width:100%"><button type="button" style="flex:1;justify-content:center" data-a="figsOn" data-v="on" aria-pressed="${N.figPrefOn()}">On</button><button type="button" style="flex:1;justify-content:center" data-a="figsOn" data-v="off" aria-pressed="${!N.figPrefOn()}">Off</button></div></div>` : ''}
      <div><h4>Notifications</h4>${notifyToggle()}</div>
      <div class="menu">
        ${gm ? `<button type="button" data-a="sheet" data-v="players">${IC('userplus')}<span>Players and sign-ins<small>Let people in, rename or remove them</small></span><span class="end">${pending?`<span class="badge">${pending}</span>`:IC('right')}</span></button>
        <button type="button" data-a="sheet" data-v="import">${IC('upload')}<span>Import lore<small>Load the wiki and maps from your lore file</small></span><span class="end">${IC('right')}</span></button>
        <button type="button" data-a="sheet" data-v="export">${IC('export')}<span>Export the log<small>Copy or save chats as text</small></span><span class="end">${IC('right')}</span></button>`
        : `<button type="button" data-a="tab" data-v="hero">${IC('hero')}<span>My character<small>${c && c.built?N.emoText(N.marks(esc(N.pcTag(c)))):'Not made yet'}</small></span><span class="end">${IC('right')}</span></button>`}
        ${!gm && N.figOk && N.figOk() ? `<button type="button" data-a="figOpen">${IC('hero')}<span>Toy figure maker<small>Your character’s figure in fights</small></span><span class="end">${IC('right')}</span></button>` : ''}
        <button type="button" data-a="sheet" data-v="credits">${IC('heart')}<span>Art credits<small>Free art used in this app</small></span><span class="end">${IC('right')}</span></button>
        <button type="button" data-a="signOut">${IC('signout')}<span>Sign out</span></button>
      </div>`;
    return sheet('You', body);
  }
  case 'players': {
    const rank = m => m.role === 'pending' ? 0 : /^p\d+$/.test(m.role) ? 1 : 2;
    const list = N.MEMBERS.filter(m => m.role !== 'gm').sort((a,b) => rank(a) - rank(b) || (a.t||0) - (b.t||0));
    const st = m => m.role === 'pending' ? 'Waiting to be let in' : m.role === 'removed' ? 'Removed' : N.seatsOf(m).length > 1 ? `${N.seatsOf(m).length} characters` : `Seat ${m.role.slice(1)}`;
    /* each of a player's characters is a seat of its own; the GM can add another or take an extra one away */
    const memSeats = m => { const ss = N.seatsOf(m);
      return `<div class="memseats">${ss.map(s => { const c = g.chars[g.P[s]?.char || 'pc' + s.slice(1)]; return `<span class="ms">${N.av({name:c?.built ? c.short : '?', portrait:c?.built ? c.portrait : null, color:g.P[s]?.color}, 24)}<b>${esc(c?.built ? c.short : 'No card yet')}</b><small>Seat ${s.slice(1)}${ss.length > 1 && s === m.role ? ' · playing now' : ''}</small>${ss.length > 1 && s !== m.role ? `<button type="button" class="ibtn sm" data-a="seatDrop" data-v="${m.uid}" data-s="${s}" aria-label="Take this character away" title="Take this character away">${IC('x')}</button>` : ''}</span>`; }).join('')}
        <button type="button" class="btn sm ghost" data-a="seatAdd" data-v="${m.uid}">${IC('plus')}Add a character</button></div>`; };
    const body = `<div class="members">${list.map(m => {
      const seated = /^p\d+$/.test(m.role), p = g.P[m.role];
      return `<div class="mem">${N.av({name:m.name,color:p?p.color:'var(--line-3)'},38)}<span style="min-width:0">${seated ? `<input class="inp" id="mem-${m.uid}-${v.id}" data-i="memName" data-v="${m.uid}" value="${esc(m.name)}" aria-label="Name the table sees" style="min-height:34px;padding:4px 10px;font-weight:800">` : `<b>${esc(m.name)}</b>`}<small>${esc(m.email || '')} · ${st(m)}</small></span>
        <div class="row">${seated ? `<button type="button" class="btn sm danger" data-a="reject" data-v="${m.uid}">${IC('trash')}Remove</button>`
          : `<button type="button" class="btn sm primary" data-a="admit" data-v="${m.uid}">${m.role==='removed'?'Let back in':'Let in'}</button>${m.role==='pending'?`<button type="button" class="btn sm ghost" data-a="reject" data-v="${m.uid}">Turn away</button>`:''}`}</div>${seated ? memSeats(m) : ''}</div>`; }).join('') || '<p class="muted" style="margin:0;font:600 14px/1.5 var(--f-ui)">No one else has signed in yet. Send your players the link to this page.</p>'}</div>
      <div class="note">${IC('info')}<span>Anyone with the link can sign in with Google, but only people you let in can see the campaign. Each gets a seat, an empty character card for you to fill, and a private chat with you. <b>Add a character</b> gives a player another one with its own card, chats and party; they switch between them from their profile.</span></div>`;
    return sheet('Players and sign-ins', body);
  }
  case 'import': return sheet('Import lore', `<div class="note">${IC('info')}Pick <b>norne-gm-lore.json</b>. It fills the World wiki and the maps, GM secrets included, and saves them for the whole table. Players only ever receive the parts they’re allowed to see.</div>
      <button type="button" class="thumb up" style="aspect-ratio:auto;min-height:120px;width:100%" data-a="importLore"><span>${IC('upload')}Choose the lore file</span></button>
      <p class="muted" style="margin:0;font:600 12.5px/1.4 var(--f-ui)">Entries and maps with the same name are replaced by the file’s version. Anything you made yourself stays. Loaded now: ${g.wiki.length} entries, ${g.maps.length} maps, ${g.maps.reduce((a,m)=>a+m.pins.filter(p=>p.type!=='party').length,0)} places.</p>`);
  case 'dms': {
    const ss = N.seats();
    const body = `<p class="muted" style="margin:0;font:600 13px/1.45 var(--f-ui)">New players start with only Everyone. Open a private chat with a player here when you need one. Closing it hides it from both of you; its messages are kept and come back if you open it again.</p>
      <div class="forwho">${ss.map(s => `<button type="button" data-a="dmSet" data-v="${s}" aria-pressed="${N.dmOn(s)}">${N.av(N.personObj(s), 28)}${esc(pName(s))}${N.dmOn(s) ? '' : `<small style="color:var(--ink-3);font-weight:600">· closed</small>`}</button>`).join('') || '<p class="muted" style="margin:0">No players yet.</p>'}</div>
      <p class="muted" style="margin:0;font:600 12.5px/1.45 var(--f-ui)">Highlighted players have a private chat with you. Automatic notes (a new character card, inventory changes, news) only go to an open one.</p>`;
    return sheet('Private chats', body, `<button type="button" class="btn primary lg" data-a="closeSheet">${IC('check')}Done</button>`);
  }
  case 'search': {
    const q = v.ui.cq || '', all = v.ui.cqAll !== false;
    const body = `<div class="srch-top"><label class="search srch-q"><span class="vh">Search for</span>${IC('search')}<input class="inp" type="search" id="cq-${v.id}" data-i="chatQ" value="${esc(q)}" placeholder="Words, a name, a skill…" autocomplete="off" enterkeyhint="search"></label>
        <div class="seg"><button type="button" data-a="cqAll" data-v="1" aria-pressed="${all}">All chats</button><button type="button" data-a="cqAll" data-v="0" aria-pressed="${!all}">${esc(N.chName(v.ui.ch, v.role))}</button></div></div>
      <div class="srch-res" id="cqr-${v.id}">${N.chatSearchHtml(v)}</div>`;
    return sheet('Search the chats', body, '', {wide:true});
  }
  case 'export': {
    const ex = v.ui.exp;
    const out = N.buildExport(ex);
    const body = `<div><h4>Chats</h4><div class="forwho">${N.channelsFor('gm', true).map(c => `<button type="button" data-a="expCh" data-v="${c}" aria-pressed="${ex.ch.has(c)}">${esc(N.chName(c,'gm'))}</button>`).join('')}</div></div>
      <div><h4>When</h4><div class="forwho">${[['all','Everything'],['day','Last 24 hours'],['week','Last 7 days'],['last','Since the last scene']].map(([k,l]) => `<button type="button" data-a="expWhen" data-v="${k}" aria-pressed="${ex.when === k}">${l}</button>`).join('')}</div>
        <div class="exrange"><label class="field"><span>From</span><input class="inp" type="datetime-local" data-i="expFrom" value="${esc(ex.from || '')}"></label><label class="field"><span>To</span><input class="inp" type="datetime-local" data-i="expTo" value="${esc(ex.to || '')}"></label></div>
        <small class="muted" id="exWhen">${esc(N.cap1(N.expRangeWords(ex)))}. Leave a box empty for no limit on that side.</small></div>
      <div><h4>Include</h4><div class="forwho">${[['rp','Roleplay'],['roll','Rolls'],['meta','Meta']].map(([k,l]) => `<button type="button" data-a="expKind" data-v="${k}" aria-pressed="${!!ex[k]}">${l}</button>`).join('')}</div></div>
      <div><h4>Format</h4><div class="forwho"><button type="button" data-a="expKind" data-v="json" aria-pressed="${!ex.json}" ${ex.json ? '' : 'disabled'}>Text (.md)</button><button type="button" data-a="expKind" data-v="json" aria-pressed="${!!ex.json}" ${ex.json ? 'disabled' : ''}>Data for an AI (.json)</button></div><small class="muted">The JSON keeps every fight as its own block with its rolls and results. Talk typed in a fight’s chat is never exported.</small></div>
      <div><h4>Preview · for your notes, or to paste into an AI for a session summary</h4><textarea id="exOut" class="inp" readonly rows="10" style="font:500 12.5px/1.5 ui-monospace,Menlo,monospace;color:var(--ink-2)">${esc(out)}</textarea></div>`;
    return sheet('Export the log', body, `<button type="button" class="btn ghost" data-a="expCopy">${IC('copy')}Copy</button><button type="button" class="btn primary lg" data-a="expDl">${IC('download')}Download ${ex.json ? '.json' : '.md'}</button>`, {wide:true});
  }
  case 'rollCard': {
    const m = G().msgs.find(x => x.id === arg); if (!m || m.kind !== 'roll') return '';
    const keep = v._lastRoll; v._lastRoll = m.id; const had = v.ui.folded.has(m.id), was = v.ui.folded.get(m.id); v.ui.folded.delete(m.id);
    const card = N.rRoll(v, m).replace(/<button type="button" class="ibtn sm" data-a="fold"[\s\S]*?<\/button>/, '');
    v._lastRoll = keep; if (had) v.ui.folded.set(m.id, was);
    return sheet(`${esc(m.roll.who)}’s roll`, `<div class="rollcard">${card}</div>`, `<button type="button" class="btn primary" data-a="closeSheet">Done</button>`);
  }
  case 'gmFight': return sheet(`${N.kw().W} controls`, N.gmFightBody(v), '');
  case 'fightRec': {
    const st = G().msgs.find(m => (m.kind === 'combat' || m.kind === 'fight') && m.cid === arg);
    return sheet(st ? `The fight: ${esc(st.text || '')}` : 'The fight', N.fightRecHtml(v, arg), `<button type="button" class="btn primary" data-a="closeSheet">Done</button>`, {wide:true});
  }
  case 'credits': return sheet('Art credits', N.creditsHtml(), '', {wide:true});
  case 'myFace': {
    const c = N.charOf(v.role); if (!c) return '';
    const cur = c.portrait, own = cur && !PORTRAITS.includes(cur) ? N.faceUrl(cur) : null;
    const face = (src, on, attrs, label, css='') => `<button type="button" ${attrs} aria-pressed="${on}"${label ? ` aria-label="${label}"` : ''}><span class="av" style="--c:var(--gold)"><img src="${esc(src)}" alt="" loading="lazy" style="${css}"></span></button>`;
    return sheet('Your picture', `<p class="muted" style="margin:0;font:600 13px/1.4 var(--f-ui)">Shown next to everything ${esc(c.short)} says and on your card. Pick one or upload your own.</p>
      <div class="facegrid">${own ? face(own, true, 'data-a="closeSheet"', 'Your current picture', N.frameCss(cur)) : ''}${PORTRAITS.map(p => face(N.FACE(p), cur === p, `data-a="myFace" data-v="${p}"`, '')).join('')}<button type="button" data-a="myFaceUp" class="up"><span class="av">${IC('upload')}</span><span>Upload</span></button></div>`,
      `${cur ? `<button type="button" class="btn ghost" data-a="myFaceNone">${IC('trash')}No picture</button>` : ''}${own ? `<button type="button" class="btn ghost" data-a="myFaceFrame">${IC('fit')}Adjust</button>` : ''}<button type="button" class="btn primary" data-a="closeSheet">Done</button>`);
  }
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
  case 'cbEnd': { const K = N.kw(), k = N.cbKind(), c = k === 'challenge' && N.chalCount();
    return sheet(`End the ${K.w}?`, `<p style="margin:0;font:500 15px/1.5 var(--f-ui);color:var(--ink-2)">${k === 'challenge' ? `${c.ok} of ${c.all} roll${c.all === 1 ? '' : 's'} succeeded${c.done < c.all ? `, ${c.all - c.done} not rolled` : ''}. That goes in the chat. ` : k === 'contest' ? `The final score goes in the chat. ` : ''}Zones and tokens are cleared for everyone. Stress and consequences stay on the character cards.</p>`,
      `<button type="button" class="btn ghost" data-a="closeSheet">${k === 'fight' ? 'Keep fighting' : 'Keep going'}</button><button type="button" class="btn danger" data-a="cbEndGo">${IC('stop')}End the ${K.w}</button>`); }
  /* the GM sets the turn order by hand: move people up and down, then save (Jake) */
  case 'cbOrder': {
    const cb = g.combat, ids = (v.ui.ordDraft || []).filter(id => N.tokById(id)), notice = cb.tokens.some(t => t.init != null);
    const row = (id, i) => { const t = N.tokById(id); return `<div class="ord-row"><span class="n">${i + 1}</span>${N.av(N.tokObj(t), 30)}<span class="nm"><b>${esc(N.tokName(t))}</b>${t.init != null ? `<small>Notice roll ${sgn(t.init)}</small>` : ''}</span>
      <button type="button" class="ibtn sm" data-a="ordMove" data-v="${id}" data-d="-1" aria-label="Move ${esc(N.tokName(t))} up" ${i ? '' : 'disabled'}>${IC('caret').replace('<svg', '<svg style="rotate:180deg"')}</button><button type="button" class="ibtn sm" data-a="ordMove" data-v="${id}" data-d="1" aria-label="Move ${esc(N.tokName(t))} down" ${i < ids.length - 1 ? '' : 'disabled'}>${IC('caret')}</button></div>`; };
    return sheet('Turn order', `<p class="muted" style="margin:0;font:600 13px/1.4 var(--f-ui)">${cb.phase === 'notice' ? 'Skip the Notice roll and put everyone in order yourself.' : 'Move people up and down. Whoever is acting now keeps the turn.'} Anyone added later goes at the end.</p>
      <div class="ord-list">${ids.map(row).join('') || '<p class="muted">Put someone on the board first.</p>'}</div>
      ${cb.ord && notice ? `<button type="button" class="btn sm ghost" data-a="ordNotice" style="justify-self:start">${IC('undo')}Back to the Notice roll order</button>` : ''}`,
      `<button type="button" class="btn ghost" data-a="closeSheet">Cancel</button><button type="button" class="btn primary" data-a="ordSave" ${ids.length ? '' : 'disabled'}>${IC('check')}Save the order</button>`);
  }
  /* teams: the two sides every fight has plus any extra the GM adds (three-way fights and contests), and who is on which */
  case 'cbTeams': {
    const cb = g.combat, tms = N.teams(), toks = cb.tokens;
    const head = tm => `<div class="team-h" style="--tc:${tm.col}"><i></i><input class="inp" id="tmn-${tm.id}-${v.id}" data-i="teamName" data-k="${tm.id}" value="${esc(tm.name)}" aria-label="Team name">${tm.extra ? `<button type="button" class="ibtn sm" data-a="teamDel" data-v="${tm.id}" aria-label="Remove ${esc(tm.name)}" title="Remove this team (its people go back to their usual side)">${IC('trash')}</button>` : ''}</div>`;
    const who = t => `<div class="team-p">${N.av(N.tokObj(t), 28)}<b>${esc(N.tokName(t))}</b><span class="tk-teams">${tms.map(tm => `<button type="button" class="tchip" style="--tc:${tm.col}" data-a="tokTeam" data-t="${t.id}" data-v="${tm.id}" aria-pressed="${N.sideOf(t) === tm.id}" aria-label="${esc(N.tokName(t))}: ${esc(tm.name)}"><i></i>${esc(tm.name)}</button>`).join('')}</span></div>`;
    return sheet('Teams', `<p class="muted" style="margin:0;font:600 13px/1.4 var(--f-ui)">Every ${N.kw().w} has the players’ side and ${N.cbKind() === 'fight' ? 'the foes' : 'the rivals'}. Add a team for a three-way ${N.kw().w} or more. Tap a name to rename it.</p>
      <div class="team-list">${tms.map(head).join('')}<button type="button" class="btn sm ghost" data-a="teamAdd" style="justify-self:start">${IC('plus')}Add a team</button></div>
      ${toks.length ? `<div><h4>Who is on which team</h4><div class="team-ps">${toks.map(who).join('')}</div></div>` : ''}`, `<button type="button" class="btn primary" data-a="closeSheet">${IC('check')}Done</button>`);
  }
  case 'addFoe': return sheet(`Add to the ${N.kw().w}`, `<p class="muted" style="margin:0;font:600 13px/1.4 var(--f-ui)">${g.combat.zones.length?'They appear in the first zone. Drag them where they belong.':'Draw a zone first, then place them.'}</p>${N.foeList(true, v)}
      <button type="button" class="btn block ghost" data-a="npcNew">${IC('plus')}Make a new NPC</button>`);
  case 'cbAspect': return sheet('Situation aspects', `<p class="muted" style="margin:0;font:600 13px/1.4 var(--f-ui)">Something true about this fight, like the weather, the ground or a fire. Shown on the board for everyone, and anyone can invoke it.${g.combat.aspects.some(a => !a.boost) ? ' Tap one to remove it.' : ''}</p>
      <div class="icards">${g.combat.aspects.map((a,i)=>a.boost ? '' : `<button type="button" class="icard" data-a="cbAspDel" data-i="${i}" title="Tap to remove">${a.on ? `<span class="k">On ${esc(a.on)}</span>` : ''}${esc(a.t)}${a.free?`<span class="fi">${'<i></i>'.repeat(a.free)}</span>`:''}</button>`).join('')}</div>
      <label class="field"><span>New aspect</span><input class="inp" id="cba-${v.id}" data-i="cbAsp" value="${esc(v.ui.cbAsp||'')}" placeholder="e.g. Fog Off the River"></label>
      ${(() => { const toks = g.combat.tokens.filter(t => t.zone && !t.out), on = v.ui.cbAspOn && toks.find(t => t.id === v.ui.cbAspOn);
        return toks.length ? `<div><h4>On someone (optional)</h4><div class="forwho aspon" role="group" aria-label="Put it on someone"><button type="button" data-a="cbAspOn" data-v="" aria-pressed="${!on}"><span class="cic">${IC('cards')}</span>The whole fight</button>${toks.map(t => `<button type="button" data-a="cbAspOn" data-v="${t.id}" aria-pressed="${on === t}">${N.av(N.tokObj(t), 28)}${esc(N.tokName(t))}</button>`).join('')}</div>
          <p class="muted" style="margin:6px 0 0;font:600 12.5px/1.4 var(--f-ui)">${on ? `Pinned to ${esc(N.tokName(on))}, like <i>On Fire</i> or <i>Pinned Under the Cart</i>. It shows on their card, and anyone can still invoke it.` : 'Leave it on the whole fight, or pin it to one fighter.'}</p></div>` : ''; })()}
      <div class="seg"><button type="button" data-a="cbAspFree" data-v="0" aria-pressed="${!v.ui.cbAspFree}">No free invoke</button><button type="button" data-a="cbAspFree" data-v="1" aria-pressed="${v.ui.cbAspFree==1}">1 free</button><button type="button" data-a="cbAspFree" data-v="2" aria-pressed="${v.ui.cbAspFree==2}">2 free</button></div>`,
      `<button type="button" class="btn primary" data-a="cbAspAdd">${IC('plus')}Add situation aspect</button>`);
  /* the GM gives a fighter a boost by hand: a free invoke for its owner that fades after their next two rolls (or lasts until used) */
  case 'cbBoost': {
    const cb = g.combat, toks = cb.tokens.filter(t => t.zone && !t.out), own = v.ui.cbBo && toks.find(t => t.id === v.ui.cbBo), on = v.ui.cbBoOn && toks.find(t => t.id === v.ui.cbBoOn);
    const bs = cb.aspects.map((a,i) => [a,i]).filter(([a]) => a.boost && a.t);
    const pick = (act, sel, list, none) => `<div class="forwho aspon" role="group">${none ? `<button type="button" data-a="${act}" data-v="" aria-pressed="${!sel}"><span class="cic">${IC('cards')}</span>${none}</button>` : ''}${list.map(t => `<button type="button" data-a="${act}" data-v="${t.id}" aria-pressed="${sel === t}">${N.av(N.tokObj(t), 28)}${esc(N.tokName(t))}</button>`).join('')}</div>`;
    return sheet('Give a boost', `<p class="muted" style="margin:0;font:600 13px/1.4 var(--f-ui)">A boost is one free invoke for one fighter. Only they can use it, and it’s gone once they do.${bs.length ? ' Tap a boost below to take it away.' : ''}</p>
      ${bs.length ? `<div class="icards">${bs.map(([a,i]) => `<button type="button" class="icard boost" data-a="cbBoDel" data-i="${i}" title="Tap to take it away"><span class="k">Boost · ${esc(a.by)}${a.on ? ` · on ${esc(a.on)}` : ''}</span><span>${N.emoText(N.marks(esc(a.t)))}</span><span class="fi"><i></i></span></button>`).join('')}</div>` : ''}
      ${toks.length ? `<div><h4>Who gets it</h4>${pick('cbBoPick', own, toks)}</div>
      <label class="field"><span>Name the boost</span><input class="inp" id="cbbn-${v.id}" data-i="cbBoName" value="${esc(v.ui.cbBoName||'')}" placeholder="e.g. Off Balance, Higher Ground"></label>
      <div><h4>On someone (optional)</h4>${pick('cbBoOn', on, toks.filter(t => t !== own), 'Nobody in particular')}
        <p class="muted" style="margin:6px 0 0;font:600 12.5px/1.4 var(--f-ui)">${on ? `It shows on ${esc(N.tokName(on))}’s card, like <i>Off Balance</i> after a shove.` : 'Pin it to the fighter it works against, or leave it loose.'}</p></div>
      <div><h4>How long it lasts</h4><div class="seg"><button type="button" data-a="cbBoLast" data-v="2" aria-pressed="${v.ui.cbBoLast !== 0}">Their next 2 rolls</button><button type="button" data-a="cbBoLast" data-v="0" aria-pressed="${v.ui.cbBoLast === 0}">Until they use it</button></div></div>`
        : `<p class="muted" style="margin:0">Put someone in a zone first.</p>`}`,
      toks.length ? `<button type="button" class="btn primary" data-a="cbBoGive" ${own ? '' : 'disabled'}>${IC('sparkle')}${own ? `Give ${esc(N.tokName(own))} the boost` : 'Pick who gets it'}</button>` : '');
  }
  /* ---------------- character editor (GM) ---------------- */
  case 'pcEdit': return sheet(v.ui.pd.isNew ? `Make ${esc(pName(v.ui.pd.player))}’s card` : `Edit ${esc(v.ui.pd.short)}’s card`, N.textTools(v, true) + pcEditor(v), `<button type="button" class="btn ghost" data-a="closeSheet" style="flex:0 0 auto">Cancel</button><button type="button" class="btn primary lg" data-a="pcSave" ${v.ui.pd.name.trim()?'':'disabled'}>${IC('check')}${v.ui.pd.isNew?'Save and send to '+esc(pName(v.ui.pd.player)):'Save card'}</button>`, {wide:true});
  case 'npcNew': return sheet(v.ui.nd.edit ? `Edit ${esc(v.ui.nd.name || 'NPC')}` : v.ui.nd.copyOf ? 'Copy as NPC' : 'New NPC', N.textTools(v, true) + (v.ui.nd.copyOf && !v.ui.nd.edit ? `<div class="note">${IC('info')}Everything from ${esc(N.G.chars[v.ui.nd.copyOf]?.short || 'the character')}’s sheet is filled in. Change anything, then Save NPC. The character’s own sheet doesn’t change.</div>` : '') + npcEditor(v), `<button type="button" class="btn ghost" data-a="closeSheet" style="flex:0 0 auto">Cancel</button><button type="button" class="btn primary lg" data-a="npcSave" ${v.ui.nd.name.trim()?'':'disabled'}>${IC('check')}Save NPC</button>`, {wide:true});
  case 'wEdit': {
    const d = v.ui.wd;
    return sheet(d.id ? 'Edit entry' : 'New wiki entry', `${N.textTools(v, true)}<div style="display:grid;gap:12px;grid-template-columns:repeat(auto-fit,minmax(220px,1fr))">
        <label class="field"><span>Title</span><input class="inp" id="wdt-${v.id}" data-i="wd" data-k="title" value="${esc(d.title)}" placeholder="Name of the person, place or thing"></label>
        <label class="field"><span>Category</span><select class="inp" id="wdc-${v.id}" data-i="wd" data-k="cat">${[...new Set([...N.catNames(g.wiki), d.cat])].filter(Boolean).map(c => `<option ${d.cat===c?'selected':''}>${esc(c)}</option>`).join('')}</select></label></div>
      <label class="field"><span>One-line summary</span><input class="inp" id="wds-${v.id}" data-i="wd" data-k="summary" value="${esc(d.summary)}" placeholder="Shown in lists and at the top"></label>
      <label class="field"><span>Facts box, one per line as “Label: value”</span><textarea class="inp" id="wdi-${v.id}" data-i="wd" data-k="info" rows="3" placeholder="Ruler: …">${esc(d.info)}</textarea></label>
      <div><h4>Pictures · a flag, a portrait, a sketch</h4><div class="wpics">${d.imgs.map((p, i) => `<div class="wpic"><button type="button" class="wpth" data-a="wdImgFrame" data-v="${i}" aria-label="Adjust framing" title="Adjust framing">${N.wikiImg(p.src)}<span>${IC('fit')}</span></button><input class="inp" id="wdp${i}-${v.id}" data-i="wd" data-k="cap" data-n="${i}" value="${esc(p.cap || '')}" placeholder="Caption (optional)" aria-label="Caption"><button type="button" class="ibtn" data-a="wdImgDel" data-v="${i}" aria-label="Remove this picture">${IC('trash')}</button></div>`).join('')}
        <button type="button" class="btn" data-a="wdImgAdd" style="justify-self:start">${IC('upload')}Add a picture from your device</button></div></div>
      <label class="field"><span>Text · blank line between paragraphs · link entries with [[Title]]</span><textarea class="inp" id="wdb-${v.id}" data-i="wd" data-k="body" rows="8">${esc(d.body)}</textarea></label>
      <div class="wparts"><h4>Sections</h4>${(d.parts || []).map((p, i) => { const to = p.to || 'all', seg = (val, ic, l) => `<button type="button" data-a="wdPartTo" data-n="${i}" data-v="${val}" aria-pressed="${to === val}">${IC(ic)}${l}</button>`;
        return `<div class="wpart${to === 'gm' ? ' gmo' : ''}">
          <div class="wpart-h"><input class="inp" id="wdph${i}-${v.id}" data-i="wd" data-k="ph" data-n="${i}" value="${esc(p.h)}" placeholder="Heading, e.g. History" aria-label="Section heading">${i ? `<button type="button" class="ibtn" data-a="wdPartUp" data-n="${i}" aria-label="Move this section up" title="Move up">${IC('caret').replace('<svg', '<svg style="transform:rotate(180deg)"')}</button>` : ''}<button type="button" class="ibtn" data-a="wdPartDel" data-v="${i}" aria-label="Remove this section">${IC('trash')}</button></div>
          <textarea class="inp" id="wdpt${i}-${v.id}" data-i="wd" data-k="pt" data-n="${i}" rows="4" placeholder="${to === 'gm' ? 'Only you will ever see this' : 'Section text · link entries with [[Title]]'}" aria-label="Section text">${esc(p.text)}</textarea>
          <div class="wpics">${(p.imgs || []).map((x, j) => `<div class="wpic"><button type="button" class="wpth" data-a="wdPartImgFrame" data-n="${i}" data-v="${j}" aria-label="Adjust framing" title="Adjust framing">${N.wikiImg(x.src)}<span>${IC('fit')}</span></button><input class="inp" id="wdpc${i}-${j}-${v.id}" data-i="wd" data-k="pcap" data-n="${i}" data-x="${j}" value="${esc(x.cap || '')}" placeholder="Caption (optional)" aria-label="Caption"><button type="button" class="ibtn" data-a="wdPartImgDel" data-n="${i}" data-v="${j}" aria-label="Remove this picture">${IC('trash')}</button></div>`).join('')}
            <button type="button" class="btn sm" data-a="wdPartImgAdd" data-n="${i}" style="justify-self:start">${IC('upload')}Add a picture to this section</button></div>
          <div class="wpart-to"><span class="lbl">Who reads it</span><div class="seg" role="group" aria-label="Who reads this section">${seg('all', 'users', 'Everybody')}${seg('some', 'eye', 'Some players')}${seg('gm', 'lock', 'GM only')}</div></div>
          ${to === 'some' ? `<div class="forwho" role="group" aria-label="Which players">${N.seats().map(st => `<button type="button" data-a="wdPartWho" data-n="${i}" data-v="${st}" aria-pressed="${p.see.includes(st)}">${N.av(N.personObj(st),28)}${esc(pName(st))}</button>`).join('')}</div>` : ''}
          <p class="muted" style="margin:0;font:600 12.5px/1.4 var(--f-ui)">${to === 'all' ? 'Everybody who can read the entry reads this section.' : to === 'gm' ? 'Only you see this section. Players never get it.' : p.see.length ? `Only ${esc(N.namesList(p.see))} ${p.see.length > 1 ? 'see' : 'sees'} this section. Everyone else reading the entry never gets it.` : 'Nobody picked yet, so only you see it.'}</p></div>`; }).join('')}
        <button type="button" class="btn" data-a="wdPartAdd" style="justify-self:start">${IC('plus')}Add a section</button></div>
      <div><h4>Who can read the entry</h4>${N.audPick('wdAud', d, 'wiki')}</div>`,
      `${d.id ? `<button type="button" class="btn danger" data-a="sheet" data-v="wDel" data-c="${esc(d.id)}" style="flex:0 0 auto" aria-label="Delete this entry">${IC('trash')}<span class="only-dt">Delete</span></button>` : ''}<button type="button" class="btn ghost" data-a="closeSheet" style="flex:0 0 auto">Cancel</button><button type="button" class="btn primary lg" data-a="wSave" ${d.title.trim()?'':'disabled'}>${IC('check')}Save entry</button>`, {wide:true});
  }
  /* a PC or NPC card opened from a link (N.xl): the GM sees the whole card, a player their own card or what was revealed to them */
  case 'card': {
    const c = g.chars[arg], n = !c && gm && g.npcs.find(x => x.id === arg), mine = N.charOf(v.role), k = !gm && !(c && c.id === mine?.id) && g.known?.[arg];
    const body = gm ? (c ? N.sheetBody(v, c) : n ? N.npcBody(v, n) : '') : c && c.id === mine?.id ? N.sheetBody(v, c) : k?.name ? N.knownBody(v, k) : '';
    if (!body) return '';
    return sheet(esc(c ? (c.built ? c.name : pName(c.player) + '’s card') : n ? n.name : k.name), `<div class="sheetv cardv">${body}</div>`, '', {wide:true});
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
      <label class="field"><span>Folder</span><div style="display:flex;gap:8px"><select class="inp" id="mpf-${v.id}" data-i="mapFolder" data-v="${esc(m.id)}" style="flex:1;min-width:0"><option value="">No folder (top of the list)</option>${N.dirList().map(([id, name]) => `<option value="${esc(id)}" ${N.mapDirOf(m) === id ? 'selected' : ''}>${esc(name)}</option>`).join('')}</select><button type="button" class="btn ghost" data-a="mdOpen" data-map="${esc(m.id)}" data-in="${esc(N.mapDirOf(m) || '')}" style="flex:0 0 auto">${IC('plus')}New folder</button></div></label>
      <label class="field"><span>Map level</span><select class="inp" id="mpl-${v.id}" data-i="mapLvl" data-v="${esc(m.id)}"><option value="" ${N.mapLvl(m) ? '' : 'selected'}>No level</option>${N.MLVLS.map(([k, l]) => `<option value="${k}" ${N.mapLvl(m) === k ? 'selected' : ''}>${l}</option>`).join('')}</select></label>
      <div class="revgrp"><button type="button" class="revrow" data-a="mapDef" data-m="${esc(m.id)}" aria-pressed="${!!m.def}"><span class="rck">${IC('check')}</span><span><b>Default map</b><small>${m.def ? 'Players open the Maps tab on this map.' + (N.audOf(m, 'map') === '*' ? '' : ` Anyone who can’t see it gets ${esc(N.G.maps.find(x => x !== m && N.audOf(x, 'map') === '*' && N.mapLvl(x) === 'world')?.name || 'the first map they can see')} instead.`) : `Players open the Maps tab on ${esc(N.defMap(false)?.name || 'the first map')}. Tick to make it this one.`}</small></span></button></div>
      <div><h4>Who sees this map</h4>${N.audPick('mapAud', m, 'map')}</div>
      <div class="note">${IC('info')}When you press Done you can choose whether to tell the players you shared it with. Places on the map have their own setting: tap a place while editing to pick who sees it.</div>`,
      `<button type="button" class="btn danger" data-a="sheet" data-v="mapDel" data-c="${esc(m.id)}" style="flex:0 0 auto">${IC('trash')}Delete map</button><button type="button" class="btn primary" data-a="closeSheet">Done</button>`);
  }
  /* ---------------- who sees one place on a map (GM) ---------------- */
  case 'pinSet': {
    const [mi, pi] = String(arg || '').split('|'), m = g.maps.find(x => x.id === mi), p = m && m.pins.find(x => x.id === pi); if (!p) return '';
    const ma = N.audOf(m, 'map'), out = N.audSeats(p, 'pin').filter(s => !N.audSeats(m, 'map').includes(s));
    return sheet(`Who sees ${esc(p.label)}`, `<div><h4>Who sees this place</h4>${N.audPick('pinAud', p, 'pin')}</div>
      ${out.length ? `<div class="note">${IC('warn')}${esc(N.namesList(out))} can’t see the ${esc(m.name)} map yet. Share the map with them too, or they won’t see this place.</div>` : ''}
      <div class="note">${IC('info')}${ma === '*' ? 'Every player sees this map.' : ma === 'gm' ? 'This map is hidden from every player.' : `This map is shared with ${esc(N.audLabel(m, 'map').replace(/^Only /, ''))}.`} When you press Done you can choose whether to tell the players who can now see this place.</div>`,
      `<button type="button" class="btn primary" data-a="closeSheet">Done</button>`);
  }
  /* ---------------- reveal parts of a card to single players (GM) ---------------- */
  case 'reveal': {
    const c = g.chars[arg], n = !c && g.npcs.find(x => x.id === arg), card = c || n; if (!card) return '';
    const seats = N.seats().filter(st => !c || st !== c.player);
    if (!seats.includes(v.ui.revSeat)) v.ui.revSeat = seats[0];
    const st = v.ui.revSeat, keys = N.revKeys(card, N.revOf(arg, st)), parts = N.revParts(card, !!c), name = c ? c.short || c.name : n.name;
    if (!st) return sheet(`Reveal ${esc(name)}`, `<div class="quiet"><div class="art"></div><p>No other players yet.</p></div>`);
    const groups = [...new Set(parts.map(p => p.g))];
    const row = p => `<button type="button" class="revrow" data-a="revTog" data-v="${esc(p.k)}" aria-pressed="${keys.includes(p.k)}"><span class="rck">${IC('check')}</span><span><b>${esc(p.l)}</b><small>${esc(p.v)}</small></span></button>`;
    const body = `<div><h4>To</h4><div class="forwho" role="group" aria-label="Player">${seats.map(s2 => `<button type="button" data-a="revSeat" data-v="${s2}" aria-pressed="${s2 === st}">${N.av(N.personObj(s2),28)}${esc(pName(s2))}${N.revCount(arg, s2) ? ` <span class="tag" style="height:16px">${N.revCount(arg, s2)}</span>` : ''}</button>`).join('')}</div></div>
      <div class="revgrp"><h4>How ${esc(pName(st))} knows them</h4><div class="seg metseg" role="group" aria-label="How they know them">${Object.entries(N.MET).map(([x, l]) => `<button type="button" data-a="revMet" data-v="${x}" aria-pressed="${N.metOf(keys) === x}">${IC(x === 'met' ? 'hand' : 'chat')}${l}</button>`).join('')}</div><small class="metnote">${N.metOf(keys) ? 'Tap it again to clear it.' : 'Not marked yet. The player sees what you pick here and can’t change it.'}</small></div>
      ${groups.map(gr => `<div class="revgrp${gr === 'Skills' || gr === 'Weapons and armor' ? ' tight' : ''}"><h4>${gr}</h4>${parts.filter(p => p.g === gr).map(row).join('')}</div>`).join('')}
      <div class="note">${IC('info')}${keys.includes('name') ? `${esc(pName(st))} sees the parts ticked here under Character.` : `${esc(pName(st))} sees nothing about ${esc(name)} until you tick Name.`} When you press Done you can choose whether to send them a note. Adding someone to a scene never reveals them. Untick a part to hide it again.</div>`;
    const all = parts.length && parts.every(p => keys.includes(p.k));
    return sheet(`Reveal ${esc(name)}`, body, `<button type="button" class="btn ghost" data-a="revAll" data-v="${all ? '' : '1'}" style="flex:0 0 auto">${all ? 'Hide everything' : 'Reveal everything'}</button><button type="button" class="btn primary" data-a="closeSheet">${IC('check')}Done</button>`);
  }
  /* ---------------- after a reveal: send the players a note (and a ping)? (GM) ---------------- */
  case 'tellAsk': {
    const t = v.ui.tellAsk; if (!t) return '';
    const n = t.items.filter(it => it.on).length;
    const row = (it, i) => `<button type="button" class="revrow" data-a="tellTog" data-v="${i}" aria-pressed="${it.on}" ${it.ok ? '' : 'disabled'}><span class="rck">${IC('check')}</span>${it.to === '*' ? '' : N.av(N.personObj(it.to), 28)}<span><b>${it.to === '*' ? 'Everyone' : esc(pName(it.to))}</b><small>${it.ok ? esc(it.text) : 'Your private chat with them is closed, so they can’t get a note.'}</small></span></button>`;
    return sheet('Send notifications?', `<p class="muted" style="margin:0;font:600 13.5px/1.45 var(--f-ui)">Saved. Should the players get a note in chat about it? Their phones ping if they have notifications on.</p>
      <div class="revgrp">${t.items.map(row).join('')}</div>`,
      `<button type="button" class="btn ghost" data-a="tellSkip">Don’t send</button><button type="button" class="btn primary" data-a="tellGo" ${n ? '' : 'disabled'}>${IC('send')}Send${n > 1 ? ` ${n} notes` : ''}</button>`);
  }
  case 'mapDir': {
    const md = v.ui.md; if (!md) return '';
    const dir = md.id && N.dirById(md.id), n = dir ? N.dirCount(dir.id, () => true) : 0;
    const body = `<label class="field"><span>Folder name</span><input class="inp" id="mdn-${v.id}" data-i="md" data-k="name" value="${esc(md.name)}" placeholder="e.g. Riverlands" autocomplete="off"></label>
      <label class="field"><span>Inside</span><select class="inp" id="mdi-${v.id}" data-i="md" data-k="in"><option value="">Nothing (top of the maps list)</option>${N.dirList(md.id).map(([id, name]) => `<option value="${esc(id)}" ${md.in === id ? 'selected' : ''}>${esc(name)}</option>`).join('')}</select></label>
      <div class="note">${IC('info')}${md.map ? 'The map goes into the new folder.' : 'Players see a folder only when it holds a map they can see.'}</div>`;
    return sheet(dir ? `The ${esc(dir.name)} folder` : 'New map folder', body,
      `${dir ? `<button type="button" class="btn danger" data-a="mdDel" data-v="${esc(dir.id)}" style="flex:0 0 auto" title="${n ? `Its ${n} ${n === 1 ? 'map moves' : 'maps move'} up a level` : ''}">${IC('trash')}Delete</button>` : ''}<button type="button" class="btn ghost" data-a="${md.map ? 'sheet' : 'closeSheet'}" ${md.map ? `data-v="mapSet" data-c="${esc(md.map)}"` : ''}>Cancel</button><button type="button" class="btn primary" data-a="mdSave" ${md.name.trim() ? '' : 'disabled'}>${IC('check')}${dir ? 'Save' : 'Make folder'}</button>`);
  }
  case 'npcDir': {
    const nf = v.ui.nf; if (!nf) return '';
    const dir = nf.id && N.nd.byId(nf.id), n = dir ? N.nd.npcs(dir.id).length : 0;
    const body = `<label class="field"><span>Folder name</span><input class="inp" id="nfn-${v.id}" data-i="nf" data-k="name" value="${esc(nf.name)}" placeholder="e.g. Drinkhold" autocomplete="off"></label>
      <label class="field"><span>Inside</span><select class="inp" id="nfi-${v.id}" data-i="nf" data-k="in"><option value="">Nothing (top of the NPC list)</option>${N.nd.list(nf.id).map(([id, name]) => `<option value="${esc(id)}" ${nf.in === id ? 'selected' : ''}>${esc(name)}</option>`).join('')}</select></label>
      <div class="note">${IC('info')}Only you see NPC folders. They show up when you pick who is in a scene, too. Move an NPC into a folder from Edit on its card.</div>`;
    return sheet(dir ? `The ${esc(dir.name)} folder` : 'New NPC folder', body,
      `${dir ? `<button type="button" class="btn danger" data-a="nfDel" data-v="${esc(dir.id)}" style="flex:0 0 auto" title="${n ? `Its ${n} ${n === 1 ? 'NPC moves' : 'NPCs move'} up a level` : ''}">${IC('trash')}Delete</button>` : ''}<button type="button" class="btn ghost" data-a="closeSheet">Cancel</button><button type="button" class="btn primary" data-a="nfSave" ${nf.name.trim() ? '' : 'disabled'}>${IC('check')}${dir ? 'Save' : 'Make folder'}</button>`);
  }
  case 'mapDel': {
    const m = g.maps.find(x => x.id === arg); if (!m) return '';
    const n = m.pins.filter(p => p.type !== 'party').length, party = m.pins.some(p => p.type === 'party');
    return sheet(`Delete the ${esc(m.name)} map?`, `<p style="margin:0;font:500 15px/1.5 var(--f-ui);color:var(--ink-2)">The map${n ? ` and its ${n} ${n>1?'places':'place'}` : ''} are removed for everyone.${party ? ' The party banner is on this map, so it goes too.' : ''} ${String(m.src||'').startsWith('fs:') ? 'Its picture is deleted after a few seconds, so you can still undo.' : ''} Importing the lore file again brings back the atlas maps.</p>`,
      `<button type="button" class="btn ghost" data-a="closeSheet">Keep it</button><button type="button" class="btn danger" data-a="mapDelGo" data-v="${esc(m.id)}">${IC('trash')}Delete map</button>`);
  }
  /* ---------------- the GM's item catalog: everything that exists in the world, ready to hand out ---------------- */
  case 'items': {
    if (!gm) return '';
    const all = g.items || [], q = (v.ui.itQ || '').trim().toLowerCase(), k = v.ui.itK || '', cl = v.ui.itC || '';
    const hit = it => !q || [it.name, it.d, it.gm, N.itemKind(it.kind)[1], N.itemPath(it)].some(x => String(x || '').toLowerCase().includes(q));
    const inK = it => !k || N.itemKind(it.kind)[0] === k;
    const list = all.filter(it => inK(it) && (!cl || (it.cls || '') === cl) && hit(it));
    const count = kk => all.filter(it => N.itemKind(it.kind)[0] === kk && hit(it)).length;
    const kinds = N.ITEMK.filter(([kk]) => count(kk) || kk === k);
    /* a kind with classes (Jake's lists) gets a second row to narrow it to one class */
    const classes = k ? [...new Set(all.filter(it => inK(it) && it.cls).map(it => it.cls))] : [];
    const row = it => { const [, kl] = N.itemKind(it.kind), gs = N.itemGears(it);
      return `<div class="itc-row"><span class="itc-ic">${IC(it.ic || N.itemKind(it.kind)[2])}</span>
        <span class="itc-t"><b>${N.emoText(N.marks(esc(it.name)))}</b><small>${esc(it.cls ? [it.sub, it.disc].filter(Boolean).join(' · ') || kl : kl)}${gs.map(([kk, l, ic]) => ` <span class="itc-g" title="${l}">${IC(ic)}+${+it[kk]}</span>`).join('')}${it.silver ? ' <span class="itc-tag">Silver</span>' : ''}</small>${it.d && !it.cls ? `<span class="itc-d">${N.emoText(N.marks(esc(it.d)))}</span>` : ''}${it.gm ? `<span class="itc-gm">${lockIc}${N.emoText(N.marks(esc(it.gm)))}</span>` : ''}${N.invPv(v, it.name)}</span>
        <span class="itc-a"><button type="button" class="btn sm" data-a="itGive" data-v="${esc(it.id)}">${IC('hand')}Give</button><button type="button" class="ibtn sm" data-a="itEdit" data-v="${esc(it.id)}" aria-label="Edit ${esc(it.name)}">${IC('pen')}</button></span></div>`; };
    /* grouped by class (then rating, then name); items without a class come last under their kind */
    const groups = new Map();
    for (const it of list) { const key = it.cls || N.itemKind(it.kind)[1]; if (!groups.has(key)) groups.set(key, []); groups.get(key).push(it); }
    const order = [...groups.keys()].sort((a, b) => { const ia = all.findIndex(x => (x.cls || N.itemKind(x.kind)[1]) === a), fa = list.find(x => (x.cls || N.itemKind(x.kind)[1]) === a), fb = list.find(x => (x.cls || N.itemKind(x.kind)[1]) === b);
      return (N.ITEMK.findIndex(x => x[0] === N.itemKind(fa.kind)[0]) - N.ITEMK.findIndex(x => x[0] === N.itemKind(fb.kind)[0])) || (!fa.cls - !fb.cls) || (CLS_ORDER.indexOf(a) + 1 || 99) - (CLS_ORDER.indexOf(b) + 1 || 99) || a.localeCompare(b) || ia; });
    const lists = order.map(key => { const its = groups.get(key).sort((a, b) => (+a.r || 0) - (+b.r || 0) || a.name.localeCompare(b.name));
      return `<section class="itc-grp"><h4>${esc(key)} <small>${its.length}</small></h4><div class="itc-list">${its.map(row).join('')}</div></section>`; }).join('');
    const body = `<p class="muted" style="margin:0;font:600 13px/1.45 var(--f-ui)">The weapons, armor, magical things and gear that exist in your world. Only you see this list. Give an item to a character or NPC and it lands in their inventory.</p>
      <div class="itc-bar"><label class="itc-q">${IC('search')}<input class="inp" id="itq-${v.id}" data-i="itQ" value="${esc(v.ui.itQ || '')}" placeholder="Search items" autocomplete="off" aria-label="Search items"></label><button type="button" class="btn sm" data-a="itImport" title="Load norne-gm-items.json">${IC('upload')}<span class="only-dt">Import</span></button><button type="button" class="btn primary sm" data-a="itNew">${IC('plus')}New item</button></div>
      ${all.length ? `<div class="chips itc-chips" role="group" aria-label="Show"><button type="button" class="cchip" data-a="itKind" data-v="" aria-current="${!k}">All <small>${all.filter(hit).length}</small></button>${kinds.map(([kk, l, ic]) => `<button type="button" class="cchip" data-a="itKind" data-v="${kk}" aria-current="${k === kk}">${IC(ic)}${l} <small>${count(kk)}</small></button>`).join('')}</div>` : ''}
      ${classes.length > 1 ? `<div class="chips itc-chips sub" role="group" aria-label="Class"><button type="button" class="cchip" data-a="itCls" data-v="" aria-current="${!cl}">Every kind</button>${classes.sort((a, b) => (CLS_ORDER.indexOf(a) + 1 || 99) - (CLS_ORDER.indexOf(b) + 1 || 99)).map(c => `<button type="button" class="cchip" data-a="itCls" data-v="${esc(c)}" aria-current="${cl === c}">${esc(c)}</button>`).join('')}</div>` : ''}
      ${list.length ? lists : `<div class="note">${IC('info')}${all.length ? 'No items match.' : 'No items yet. Press New item to add one, or Import to load an items file.'}</div>`}`;
    return sheet('Item catalog', body, `<button type="button" class="btn primary" data-a="closeSheet">Done</button>`, {wide:true});
  }
  case 'invTransfer': {
    const t = v.ui.invTransfer, from = t && (t.npc ? g.npcs.find(n => n.id === t.from) : g.chars[t.from]), row = from?.inv?.[t.i];
    if (!gm || !row) return '';
    const scenes = Object.keys(g.scenes || {}).filter(ch => g.scenes[ch]);
    const inScene = ch => { const f = N.sceneFolk(ch); return from.player ? f.pcs.some(x => x.id === from.id) : f.npcs.some(x => x.id === from.id); };
    const scene = scenes.find(ch => ch === v.ui.ch && inScene(ch)) || scenes.find(inScene);
    const f = scene && N.sceneFolk(scene);
    const pcs = (f ? f.pcs : N.pcs().filter(x => x.built)).filter(x => x.id !== from.id);
    const npcs = (f ? f.npcs : g.npcs).filter(x => x.id !== from.id);
    const q = (t.q || '').trim().toLowerCase();
    const people = [...pcs.map(x => ({id:'pc:' + x.id, name:x.short || x.name, type:'PC'})), ...npcs.map(x => ({id:'npc:' + x.id, name:x.name, type:'NPC'}))].filter(x => x.name.toLowerCase().includes(q));
    const body = `<p class="muted">Move ${esc(row[0])} from ${esc(from.short || from.name)}. ${scene ? 'Showing characters in the current scene.' : 'Showing all existing characters.'}</p>
      <label class="field"><span>Quantity</span><input class="inp" type="number" min="1" max="${row[1]}" value="${esc(t.qty)}" data-i="invTransferQty"></label>
      <label class="field"><span>Find recipient</span><input class="inp" value="${esc(t.q)}" data-i="invTransferQ" placeholder="Search PCs and NPCs"></label>
      <div class="itc-list">${people.map(x => `<button type="button" class="itc-row" data-a="invTransferTo" data-v="${esc(x.id)}" aria-pressed="${t.to === x.id}"><span class="itc-t"><b>${esc(x.name)}</b><small>${x.type}</small></span></button>`).join('') || '<p class="muted">No matching characters.</p>'}</div>`;
    return sheet('Transfer item', body, `<button type="button" class="btn primary" data-a="invTransferGo" data-v="${esc(t.to || '')}" ${t.to ? '' : 'disabled'}>Transfer</button>`, {wide:true});
  }
  /* ---------------- crafting sessions (Jake): who's involved, the crafter, the ingredients, the product, the roll ---------------- */
  case 'craft': {
    const cr = gm && N.craftOf(arg); if (!cr) return '';
    const ch = cr.ch, c = esc(ch), folk = N.sceneFolk(ch), solo = ch === 'gm';
    const pcs = [...new Set([...folk.pcs.map(p => p.id), ...cr.pcs, ...(solo ? N.pcs().filter(p => p.built).map(p => p.id) : [])])].map(id => g.chars[id]).filter(p => p && p.built);
    const npcs = [...new Set([...folk.npcs.map(n => n.id), ...cr.npcs, ...(solo && !folk.npcs.length ? g.npcs.map(n => n.id) : [])])].map(id => g.npcs.find(n => n.id === id)).filter(Boolean);
    const who = `<div class="forwho shop-who" role="group" aria-label="Who is involved">
      ${pcs.map(p => `<button type="button" data-a="craftWho" data-c="${c}" data-v="pc:${esc(p.id)}" aria-pressed="${cr.pcs.includes(p.id)}">${N.av(p, 28)}${esc(p.short)}</button>`).join('')}
      ${npcs.map(n => `<button type="button" data-a="craftWho" data-c="${c}" data-v="npc:${esc(n.id)}" aria-pressed="${cr.npcs.includes(n.id)}">${N.av({name:n.name, portrait:n.portrait, color:'var(--c-npc)'}, 28)}${esc(n.name)}<small>NPC</small></button>`).join('')}</div>
      ${pcs.length || npcs.length ? '' : `<p class="muted shop-tip">No one is in this chat’s scene yet. Add characters or NPCs to the scene in the Scene changer and they show up here.</p>`}`;
    const owners = N.craftOwners(cr), by = owners.find(w => w.roller === cr.by);
    const skOf = w => +(w.o.skills || {}).Crafting || 0;
    const crafter = owners.length ? `<div class="forwho shop-who craft-by" role="radiogroup" aria-label="Who rolls Crafting">${owners.map(w => `<button type="button" role="radio" data-a="craftBy" data-c="${c}" data-v="${esc(w.roller)}" aria-checked="${cr.by === w.roller}" aria-pressed="${cr.by === w.roller}">${N.av(w.k[0] === 'c' ? w.o : {name:w.o.name, portrait:w.o.portrait, color:'var(--c-npc)'}, 28)}${esc(w.name)}<small>Crafting ${sgn(skOf(w))}</small></button>`).join('')}</div>
      ${by && N.discOf(by.o, 'Crafting').length ? `<p class="muted shop-tip">${esc(by.name)}’s Crafting disciplines: ${esc(N.discOf(by.o, 'Crafting').join(', '))}.</p>` : ''}` : `<p class="muted shop-tip">Pick who is involved first.</p>`;
    const pool = N.craftPool(cr), used = pool.filter(x => x.use > 0);
    const row = x => { const [n, q, note, ic] = x.row;
      return `<div class="itc-row craft-row${x.use ? ' on' : ''}"><span class="itc-ic">${IC(ic || 'bag')}</span><span class="itc-t"><b>${N.emoText(N.marks(esc(n)))}</b><small>${esc(x.w.name)} has ${q}${note ? ' · ' + esc(note) : ''}</small></span>
        <span class="itc-a craft-q"><span class="seg"><button type="button" data-a="craftUse" data-c="${c}" data-v="${esc(x.key)}" data-d="-1" aria-label="Use one less ${esc(n)}" ${x.use ? '' : 'disabled'}>${IC('minus')}</button><b aria-live="polite">${x.use}</b><button type="button" data-a="craftUse" data-c="${c}" data-v="${esc(x.key)}" data-d="1" aria-label="Use one more ${esc(n)}" ${x.use >= q ? 'disabled' : ''}>${IC('plus')}</button></span>${q > 1 ? `<button type="button" class="btn sm ghost" data-a="craftAll" data-c="${c}" data-v="${esc(x.key)}">${x.use >= q ? 'None' : 'All'}</button>` : ''}</span></div>`; };
    const groups = owners.map(w => { const rows = pool.filter(x => x.w.k === w.k); return `<div class="craft-own"><h5>${esc(w.name)}</h5>${rows.length ? `<div class="itc-list">${rows.map(row).join('')}</div>` : `<p class="muted shop-tip">Nothing in their inventory.</p>`}</div>`; }).join('');
    const it = N.itemById(cr.make);
    const make = it ? `<div class="itc-row craft-make"><span class="itc-ic">${IC(it.ic || N.itemKind(it.kind)[2])}</span><span class="itc-t"><b>${N.emoText(N.marks(esc(it.name)))}</b><small>${esc(N.itemPath(it) || N.itemKind(it.kind)[1])}</small></span>
        <span class="itc-a craft-q"><span class="seg"><button type="button" data-a="craftQ" data-c="${c}" data-d="-1" aria-label="Make one less" ${cr.q > 1 ? '' : 'disabled'}>${IC('minus')}</button><b aria-live="polite">×${cr.q}</b><button type="button" data-a="craftQ" data-c="${c}" data-d="1" aria-label="Make one more">${IC('plus')}</button></span><button type="button" class="btn sm" data-a="sheet" data-v="craftMake" data-c="${c}">Change</button></span></div>`
      : `<button type="button" class="btn sm primary" data-a="sheet" data-v="craftMake" data-c="${c}">${IC('plus')}Pick from the item catalog</button>`;
    const diff = N.clamp(+cr.diff || 0, -1, 12), mod = N.clamp(+cr.mod || 0, -6, 6);
    const diffs = `<div class="ladder-chips">${[-1,0,1,2,3,4,5,6,7,8,9].map(x => `<button type="button" class="lchip" data-a="craftDiff" data-c="${c}" data-v="${x}" aria-pressed="${diff === x}"><b>${sgn(x)}</b>${ladderWord(x)}</button>`).join('')}</div>`;
    const mods = `<div class="ladder-chips modchips">${[-6,-5,-4,-3,-2,-1,0,1,2,3,4,5,6].map(x => `<button type="button" class="lchip${x < 0 ? ' deb' : x > 0 ? ' buf' : ''}" data-a="craftMod" data-c="${c}" data-v="${x}" aria-pressed="${mod === x}"><b>${x ? sgn(x) : '0'}</b>${x < 0 ? 'Debuff' : x > 0 ? 'Buff' : 'None'}</button>`).join('')}</div>`;
    const tot = by ? skOf(by) + mod : null;
    const body = `<section class="shop-sec"><h4>Who’s involved <small>${solo ? 'any character' : 'from the scene'}</small></h4>${who}<p class="muted shop-tip">Their inventories are pooled, so they can put in items together.</p></section>
      <section class="shop-sec"><h4>Who crafts <small>rolls Crafting</small></h4>${crafter}</section>
      <section class="shop-sec"><h4>Ingredients <small>${used.length ? `${used.reduce((a, x) => a + x.use, 0)} used` : 'none picked'}</small></h4>${owners.length ? groups : ''}<p class="muted shop-tip">Everything picked here is used up, whatever the roll shows.</p></section>
      <section class="shop-sec"><h4>What they make</h4>${make}<p class="muted shop-tip">On a success it goes straight into ${by ? esc(by.name) + '’s' : 'the crafter’s'} inventory.</p></section>
      <section class="shop-sec"><h4>Difficulty</h4>${diffs}</section>
      <section class="shop-sec modbox"><h4>Buff or debuff</h4>${mods}</section>
      ${by ? `<p class="rollsum">4 Fate dice + Crafting ${sgn(skOf(by))}${mod ? ` ${mod > 0 ? '+' : '−'} ${Math.abs(mod)} ${mod > 0 ? 'buff' : 'debuff'}` : ''} against ${sgn(diff)} ${ladderWord(diff)}. A tie lets you pick Success, Failure or Settle by hand.</p>` : ''}`;
    const ok = by && it;
    const foot = `<button type="button" class="btn ghost" data-a="craftEnd" data-c="${c}" style="flex:0 0 auto">${IC('trash')}Delete</button><button type="button" class="btn gold lg" data-a="craftGo" data-c="${c}" ${ok ? '' : 'disabled'}>${N.fateDie}Roll Crafting${tot != null ? ' ' + sgn(tot) : ''}</button>`;
    return sheet('Crafting', body, foot, {wide:true, lead:`<span class="shop-lead">${IC('gear')}</span>`});
  }
  case 'craftMake': {
    const cr = gm && N.craftOf(arg); if (!cr) return '';
    const c = esc(cr.ch), all = g.items || [], q = (v.ui.craftQs || '').trim().toLowerCase(), k = v.ui.craftK || '';
    const hit = it => !q || [it.name, it.d, N.itemKind(it.kind)[1], N.itemPath(it)].some(x => String(x || '').toLowerCase().includes(q));
    const list = all.filter(it => (!k || N.itemKind(it.kind)[0] === k) && hit(it));
    const count = kk => all.filter(it => N.itemKind(it.kind)[0] === kk && hit(it)).length;
    const row = it => { const on = cr.make === it.id;
      return `<div class="itc-row"><span class="itc-ic">${IC(it.ic || N.itemKind(it.kind)[2])}</span><span class="itc-t"><b>${N.emoText(N.marks(esc(it.name)))}</b><small>${esc(N.itemPath(it) || N.itemKind(it.kind)[1])}</small></span>
        <span class="itc-a"><button type="button" class="btn sm${on ? ' gold' : ''}" data-a="craftMake" data-c="${c}" data-v="${esc(it.id)}" aria-pressed="${on}">${on ? `${IC('check')}Picked` : 'Pick'}</button></span></div>`; };
    const body = `<div class="itc-bar"><label class="itc-q">${IC('search')}<input class="inp" id="cmq-${v.id}" data-i="craftQs" value="${esc(v.ui.craftQs || '')}" placeholder="Search the catalog" autocomplete="off" aria-label="Search the item catalog"></label></div>
      ${all.length ? `<div class="chips itc-chips" role="group" aria-label="Show"><button type="button" class="cchip" data-a="craftKind" data-v="" aria-current="${!k}">All <small>${all.filter(hit).length}</small></button>${N.ITEMK.filter(([kk]) => count(kk) || kk === k).map(([kk, l, ic]) => `<button type="button" class="cchip" data-a="craftKind" data-v="${kk}" aria-current="${k === kk}">${IC(ic)}${l} <small>${count(kk)}</small></button>`).join('')}</div>` : ''}
      ${list.length ? `<div class="itc-list">${list.map(row).join('')}</div>` : `<div class="note">${IC('info')}${all.length ? 'No items match.' : 'The item catalog is empty. Add items in GM tools > Item catalog first.'}</div>`}`;
    return sheet('What are they making?', body, `<button type="button" class="btn" data-a="sheet" data-v="craft" data-c="${c}">${IC('left')}Back to crafting</button>`, {wide:true});
  }
  /* ---------------- storefronts (Jake): the GM's setup, the catalog picker, and the store players browse ---------------- */
  case 'shop': {
    const sh = gm && N.shopOf(arg); if (!sh) return '';
    const ch = sh.ch, open = sh.state === 'open', c = esc(ch), folk = N.sceneFolk(ch);
    const where = ch.startsWith('dm-') ? `your chat with ${esc(N.chName(ch, 'gm'))}` : esc(N.chName(ch, 'gm')), solo = ch === 'gm';
    /* a store in GM notes (only the GM sees it) has no players' scene to pull from, so every NPC card can be its shopkeeper */
    const npcNames = [...new Set([...folk.npcs.map(n => n.name), ...folk.once.map(x => x.name), ...sh.npcs.map(n => n.name), ...(solo && !folk.npcs.length && !folk.once.length ? g.npcs.map(n => n.name) : [])])];
    const who = `<div class="forwho shop-who" role="group" aria-label="Who is there">
      ${folk.pcs.map(p => `<button type="button" data-a="shopWho" data-c="${c}" data-v="pc:${esc(p.id)}" aria-pressed="${sh.pcs.includes(p.id)}">${N.av(p, 28)}${esc(p.short)}</button>`).join('')}
      ${npcNames.map(nm => { const n = N.npcByName(nm); return `<button type="button" data-a="shopWho" data-c="${c}" data-v="npc:${esc(nm)}" aria-pressed="${sh.npcs.some(x => x.name === nm)}">${N.av({name:nm, portrait:n?.portrait, color:'var(--c-npc)'}, 28)}${esc(nm)}<small>${n ? 'NPC' : 'One-off'}</small></button>`; }).join('')}</div>
      ${npcNames.length ? '' : solo ? `<p class="muted shop-tip">No NPC cards yet. Make the shopkeeper in Cast and they show up here.</p>` : `<p class="muted shop-tip">No NPCs in this chat’s scene. Add the shopkeeper to the scene in the Scene changer and they show up here.</p>`}`;
    const row = x => `<div class="itc-row shop-row"><span class="itc-ic">${IC(x.ic || N.itemKind(x.kind)[2])}</span>
      <span class="itc-t"><b>${N.emoText(N.marks(esc(x.name)))}</b><small>${esc(x.path || N.itemKind(x.kind)[1])}${(x.gears || []).map(([k, r]) => { const gk = N.ITEM_RATE.find(y => y[0] === k); return gk ? ` <span class="itc-g" title="${gk[1]}">${IC(gk[2])}+${r}</span>` : ''; }).join('')}${x.silver ? ' <span class="itc-tag">Silver</span>' : ''}</small>${x.d ? `<span class="itc-d">${N.emoText(N.marks(esc(x.d)))}</span>` : ''}${N.invGm(v, [x.name])}</span>
      <span class="itc-a shop-price"><label><span class="coin"></span><input class="inp" id="sp-${esc(x.k)}-${v.id}" data-i="shopPrice" data-c="${c}" data-k="${esc(x.k)}" value="${x.price ? x.price : ''}" placeholder="0" inputmode="numeric" pattern="[0-9]*" enterkeyhint="done" autocomplete="off" aria-label="Price of ${esc(x.name)} in gold"></label><button type="button" class="ibtn sm" data-a="shopRm" data-c="${c}" data-v="${esc(x.k)}" aria-label="Take ${esc(x.name)} off the shelf" title="Take it off the shelf">${IC('x')}</button></span></div>`;
    const body = `<div class="note">${IC(open ? 'users' : 'lock')}${solo ? `${open ? 'Open' : 'Set up'} in GM notes. Only you see this store, even once it’s open. Use it to plan a store or try one out.` : open ? `Open in ${where}. Changes reach the players right away.` : `Only you see this until you open the store. Then everyone in ${where} sees it.`}</div>
      <label class="shop-f"><span class="eyebrow">Store name</span><input class="inp" id="sn-${v.id}" data-i="shopName" data-c="${c}" value="${esc(sh.name || '')}" placeholder="Like The Rusty Anvil" autocomplete="off" maxlength="60"></label>
      <section class="shop-sec"><h4>Who’s there <small>${solo ? 'any character' : 'from the scene'}</small></h4>${who}</section>
      <section class="shop-sec"><h4>For sale <small>${sh.items.length}</small></h4>
        <div class="shop-acts"><button type="button" class="btn sm primary" data-a="sheet" data-v="shopAdd" data-c="${c}">${IC('plus')}Add from the item catalog</button>${sh.items.length ? `<button type="button" class="btn sm" data-a="sheet" data-v="store" data-c="${c}">${IC('eye')}See what players see</button>` : ''}</div>
        ${sh.items.length ? `<div class="itc-list">${sh.items.map(row).join('')}</div><p class="muted shop-tip">Prices are in gold. An empty price shows as Free.</p>` : `<div class="note">${IC('info')}Nothing for sale yet. Add items from the item catalog, then set their prices.</div>`}</section>`;
    const foot = open ? `<button type="button" class="btn danger" data-a="shopEnd" data-c="${c}" style="flex:0 0 auto">${IC('stop')}End shopping</button><button type="button" class="btn primary" data-a="closeSheet">Done</button>`
      : `<button type="button" class="btn ghost" data-a="shopEnd" data-c="${c}" style="flex:0 0 auto">${IC('trash')}Delete</button><button type="button" class="btn primary lg" data-a="shopGo" data-c="${c}">${IC('coins')}Open the store</button>`;
    return sheet(open ? `Manage ${esc(sh.name || 'the store')}` : 'Set up a store', body, foot, {wide:true, lead:`<span class="shop-lead">${IC('coins')}</span>`});
  }
  case 'shopAdd': {
    const sh = gm && N.shopOf(arg); if (!sh) return '';
    const c = esc(sh.ch), all = g.items || [], q = (v.ui.shopQ || '').trim().toLowerCase(), k = v.ui.shopK || '';
    const hit = it => !q || [it.name, it.d, N.itemKind(it.kind)[1], N.itemPath(it)].some(x => String(x || '').toLowerCase().includes(q));
    const list = all.filter(it => (!k || N.itemKind(it.kind)[0] === k) && hit(it));
    const count = kk => all.filter(it => N.itemKind(it.kind)[0] === kk && hit(it)).length;
    const row = it => { const on = sh.items.some(x => x.it === it.id), gs = N.itemGears(it);
      return `<div class="itc-row"><span class="itc-ic">${IC(it.ic || N.itemKind(it.kind)[2])}</span><span class="itc-t"><b>${N.emoText(N.marks(esc(it.name)))}</b><small>${esc(N.itemPath(it) || N.itemKind(it.kind)[1])}${gs.map(([kk, l, ic]) => ` <span class="itc-g" title="${l}">${IC(ic)}+${+it[kk]}</span>`).join('')}</small>${N.invGm(v, [it.name])}</span>
        <span class="itc-a"><button type="button" class="btn sm${on ? ' gold' : ''}" data-a="shopAdd" data-c="${c}" data-v="${esc(it.id)}" aria-pressed="${on}">${on ? `${IC('check')}In the store` : `${IC('plus')}Add`}</button></span></div>`; };
    const body = `<div class="itc-bar"><label class="itc-q">${IC('search')}<input class="inp" id="saq-${v.id}" data-i="shopQ" value="${esc(v.ui.shopQ || '')}" placeholder="Search the catalog" autocomplete="off" aria-label="Search the item catalog"></label></div>
      ${all.length ? `<div class="chips itc-chips" role="group" aria-label="Show"><button type="button" class="cchip" data-a="shopKind" data-v="" aria-current="${!k}">All <small>${all.filter(hit).length}</small></button>${N.ITEMK.filter(([kk]) => count(kk) || kk === k).map(([kk, l, ic]) => `<button type="button" class="cchip" data-a="shopKind" data-v="${kk}" aria-current="${k === kk}">${IC(ic)}${l} <small>${count(kk)}</small></button>`).join('')}</div>` : ''}
      ${list.length ? `<div class="itc-list">${list.map(row).join('')}</div>` : `<div class="note">${IC('info')}${all.length ? 'No items match.' : 'The item catalog is empty. Add items in GM tools > Item catalog first.'}</div>`}`;
    return sheet(`Add to ${esc(sh.name || 'the store')}`, body, `<button type="button" class="btn primary" data-a="sheet" data-v="shop" data-c="${c}">${IC('check')}Done · ${sh.items.length} for sale</button>`, {wide:true});
  }
  case 'store': {
    const sh = N.shopOf(arg); if (!sh || (!gm && sh.state !== 'open')) return '';
    const items = sh.items || [], k = v.ui.storeK || '', kinds = N.ITEMK.filter(([kk]) => items.some(x => x.kind === kk));
    const shown = items.filter(x => !k || x.kind === k), me = !gm && N.charOf(v.role), pcs = N.shopPcs(sh), keep = sh.npcs || [];
    /* Jake: Purchase sends the GM a request (paid only once they confirm), greyed out without enough gold; Bargain asks for a roll */
    const purse = me && me.built ? parseInt(me.gold, 10) || 0 : 0, open = sh.state === 'open';
    const buyBtns = x => { if (!me || !me.built || !open) return '';
      const asked = N.shopAsk(sh.ch, me.id, x.k, 'buy'), haggled = N.shopAsk(sh.ch, me.id, x.k, 'haggle'), short = purse < (+x.price || 0);
      return `<span class="shop-buy"><button type="button" class="btn sm gold" data-a="shopBuy" data-c="${esc(sh.ch)}" data-v="${esc(x.k)}" ${asked || short ? 'disabled' : ''}>${IC(asked ? 'clock' : 'coins')}${asked ? 'Waiting for the GM' : 'Purchase'}</button>${short && !asked ? `<small>Not enough gold</small>` : ''}<button type="button" class="btn sm" data-a="shopHaggle" data-c="${esc(sh.ch)}" data-v="${esc(x.k)}" ${haggled ? 'disabled' : ''}>${IC('hand')}${haggled ? 'Bargain sent' : 'Bargain'}</button></span>`; };
    const card = x => `<article class="shop-it"><span class="itc-ic">${IC(x.ic || N.itemKind(x.kind)[2])}</span>
      <div class="shop-it-t"><b>${N.emoText(N.marks(esc(x.name)))}</b><small>${esc(x.path || N.itemKind(x.kind)[1])}</small>
        ${(x.gears || []).length || x.silver ? `<span class="shop-rates">${(x.gears || []).map(([kk, r]) => { const gk = N.ITEM_RATE.find(y => y[0] === kk); return gk ? `<span class="itc-g">${IC(gk[2])}${gk[1]} +${r}</span>` : ''; }).join('')}${x.silver ? '<span class="itc-tag">Silver</span>' : ''}</span>` : ''}
        ${x.d ? `<p>${N.emoText(N.marks(esc(x.d)))}</p>` : ''}${N.invPv(v, x.name)}</div>
      <span class="shop-tag${x.price ? '' : ' free'}">${x.price ? `<span class="coin"></span>${N.goldTxt(x.price)}` : 'Free'}</span>${buyBtns(x)}</article>`;
    const people = keep.length || pcs.length ? `<div class="shop-folk">${keep.length ? `<span><span class="avs">${keep.map(n => N.av({name:n.name, portrait:n.portrait, color:'var(--c-npc)'}, 32)).join('')}</span><span class="tx"><small>${keep.length > 1 ? 'Shopkeepers' : 'Shopkeeper'}</small><b>${esc(keep.map(n => n.name).join(', '))}</b></span></span>` : ''}${pcs.length ? `<span><span class="avs">${pcs.map(p => N.av(p, 32)).join('')}</span><span class="tx"><small>Shopping</small><b>${esc(pcs.map(p => p.name).join(', '))}</b></span></span>` : ''}</div>` : '';
    const body = `${gm ? `<div class="note">${IC('eye')}${sh.state === 'open' ? 'This is what the players see.' : 'This is what the players will see once you open the store.'}</div>` : ''}
      ${people}${me && me.built ? `<div class="shop-purse"><span class="coin"></span>${esc(me.short)} has <b>${N.goldTxt(me.gold)}</b></div>` : ''}
      ${kinds.length > 1 ? `<div class="chips itc-chips" role="group" aria-label="Show"><button type="button" class="cchip" data-a="storeKind" data-v="" aria-current="${!k}">All <small>${items.length}</small></button>${kinds.map(([kk, l, ic]) => `<button type="button" class="cchip" data-a="storeKind" data-v="${kk}" aria-current="${k === kk}">${IC(ic)}${l} <small>${items.filter(x => x.kind === kk).length}</small></button>`).join('')}</div>` : ''}
      ${shown.length ? `<div class="shop-grid">${shown.map(card).join('')}</div>` : `<div class="note">${IC('info')}Nothing on the shelves right now.</div>`}`;
    return sheet(esc(sh.name || 'The store'), body, gm ? `<button type="button" class="btn" data-a="sheet" data-v="shop" data-c="${esc(sh.ch)}">${IC('left')}Back to setup</button>` : `<button type="button" class="btn primary" data-a="closeSheet">Done</button>`, {wide:true, lead:`<span class="shop-lead">${IC('coins')}</span>`});
  }
  case 'itemEd': {
    const d = v.ui.itd; if (!gm || !d) return '';
    const ic = d.ic || N.itemKind(d.kind)[2], all = g.items || [];
    const opts = key => [...new Set(all.map(x => x[key]).filter(Boolean))].sort().map(x => `<option value="${esc(x)}">`).join('');
    const body = `<label class="field"><span>Name</span><input class="inp" id="itn-${v.id}" data-i="itd" data-k="name" value="${esc(d.name)}" placeholder="e.g. Silver dagger" autocomplete="off"></label>
      <div><h4>Kind</h4><div class="chips itc-chips" role="group" aria-label="Kind">${N.ITEMK.map(([kk, l, i2]) => `<button type="button" class="cchip" data-a="itdKind" data-v="${kk}" aria-current="${N.itemKind(d.kind)[0] === kk}">${IC(i2)}${l}</button>`).join('')}</div></div>
      <div class="itc-two"><label class="field"><span>Class · optional</span><input class="inp" id="itc-${v.id}" data-i="itd" data-k="cls" value="${esc(d.cls || '')}" list="itcl-${v.id}" placeholder="e.g. Small one-handed weapons" autocomplete="off"><datalist id="itcl-${v.id}">${opts('cls')}</datalist></label>
        <label class="field"><span>Discipline · optional</span><input class="inp" id="itdi-${v.id}" data-i="itd" data-k="disc" value="${esc(d.disc || '')}" list="itdl-${v.id}" placeholder="e.g. Swords & Blades" autocomplete="off"><datalist id="itdl-${v.id}">${opts('disc')}</datalist></label></div>
      <button type="button" class="wipe-ok itc-ok" data-a="itdSilver" aria-pressed="${!!d.silver}"><span class="bx">${d.silver ? IC('check') : ''}</span><span><b>Silver</b> · +1 shift on hits against vampires and werewolves</span></button>
      <div><h4>Picture</h4><div class="ied-ics itc-ics" role="group" aria-label="Picture">${N.ITEM_IC.map(x => `<button type="button" data-a="itdIc" data-v="${x}" aria-pressed="${ic === x}" aria-label="${x}">${IC(x)}</button>`).join('')}</div></div>
      <label class="field"><span>What it does · players read this when they get it</span><textarea class="inp" id="itdd-${v.id}" data-i="itd" data-k="d" rows="3" placeholder="e.g. A light blade that is easy to hide">${esc(d.d || '')}</textarea></label>
      <div class="itc-pv"><h4>${IC('eye').replace('<svg','<svg style="width:13px;height:13px;display:inline;vertical-align:-2px;margin-right:4px"')}For some players · optional</h4><p class="muted" style="margin:0 0 8px;font:600 12.5px/1.4 var(--f-ui)">Text only the players you pick can read, wherever they see this item: their inventory, a store, a fighter card. Everyone else sees the item without it.</p>
        ${(d.pv || []).map((p, i) => `<div class="pv-ed"><div class="pv-top"><span class="eyebrow">Note ${i + 1}</span><button type="button" class="ibtn sm" data-a="itdPvDel" data-v="${esc(p.id)}" aria-label="Remove note ${i + 1}" title="Remove this note">${IC('trash')}</button></div>
          <textarea class="inp" id="itpv-${esc(p.id)}-${v.id}" data-i="itdPv" data-k="${esc(p.id)}" rows="2" placeholder="e.g. You notice runes under the grip that only an Eundir scholar could read">${esc(p.text || '')}</textarea>
          ${N.seats().length ? `<div class="forwho" role="group" aria-label="Who can read note ${i + 1}">${N.seats().map(st => `<button type="button" data-a="itdPvSee" data-k="${esc(p.id)}" data-v="${st}" aria-pressed="${(p.see || []).includes(st)}">${N.av(N.personObj(st), 28)}${esc(pName(st))}</button>`).join('')}</div>
          <small class="pv-who">${(p.see || []).filter(st => G().P[st]).length ? `${esc(N.namesList((p.see || []).filter(st => G().P[st])))} can read this. Tap a player to add or remove them.` : 'Nobody picked yet, so only you see it.'}</small>` : `<small class="pv-who">No players yet.</small>`}</div>`).join('')}
        <button type="button" class="btn sm" data-a="itdPvAdd">${IC('plus')}Add a note for some players</button></div>
      <div><h4>Ratings</h4><p class="muted" style="margin:0 0 8px;font:600 12.5px/1.4 var(--f-ui)">Optional. The same ratings as on a card. When you give the item you can set them on the card too.</p>
        <div class="itc-gear">${N.ITEM_RATE.map(([kk, l]) => `<label class="field"><span>${l}</span>${N.gearSelect(`itg${kk}-${v.id}`, `data-i="itd" data-k="${kk}"`, d[kk])}</label>`).join('')}</div></div>
      <label class="field"><span>${lockIc}Your notes · only you see these</span><textarea class="inp" id="itdg-${v.id}" data-i="itd" data-k="gm" rows="3" placeholder="Where it is, who made it, rules for it…">${esc(d.gm || '')}</textarea></label>`;
    return sheet(d.id ? `Edit ${esc(d.name || 'item')}` : 'New item', body,
      `${d.id ? `<button type="button" class="btn danger" data-a="itDel" data-v="${esc(d.id)}" style="flex:0 0 auto">${IC('trash')}Delete</button>` : ''}<button type="button" class="btn ghost" data-a="sheet" data-v="items">Cancel</button><button type="button" class="btn primary" data-a="itSave" ${d.name.trim() ? '' : 'disabled'}>${IC('check')}${d.id ? 'Save' : 'Add item'}</button>`);
  }
  case 'itemGive': {
    const t = v.ui.itg, it = t && N.itemById(t.id); if (!gm || !it) return '';
    const pcs = N.pcs().filter(c => c.built), npcs = g.npcs, gs = N.itemCardGears(it);
    const who = t.to ? N.itemTo(t.to) : null;
    const body = `<div class="itc-row one"><span class="itc-ic">${IC(it.ic || N.itemKind(it.kind)[2])}</span><span class="itc-t"><b>${N.emoText(N.marks(esc(it.name)))}</b><small>${esc(N.itemKind(it.kind)[1])}</small>${N.itemNote(it) ? `<span class="itc-d">${N.emoText(N.marks(esc(N.itemNote(it))))}</span>` : ''}</span></div>
      <label class="field"><span>Give it to</span><select class="inp" id="itgt-${v.id}" data-i="itg" data-k="to"><option value="">Pick someone…</option>
        ${pcs.length ? `<optgroup label="Player characters">${pcs.map(c => `<option value="c:${esc(c.id)}" ${t.to === 'c:' + c.id ? 'selected' : ''}>${esc(c.short)} (${esc(G().P[c.player]?.name || 'player')})</option>`).join('')}</optgroup>` : ''}
        ${npcs.length ? `<optgroup label="NPCs">${npcs.map(n => `<option value="n:${esc(n.id)}" ${t.to === 'n:' + n.id ? 'selected' : ''}>${esc(n.name)}</option>`).join('')}</optgroup>` : ''}</select></label>
      <div class="field"><span>How many</span><div class="gold-ed itc-q2"><button type="button" data-a="itgQ" data-d="-1" aria-label="One fewer" ${t.q <= 1 ? 'disabled' : ''}>−</button><input class="inp" id="itgq-${v.id}" data-i="itg" data-k="q" value="${t.q}" inputmode="numeric" pattern="[0-9]*" aria-label="How many"><button type="button" data-a="itgQ" data-d="1" aria-label="One more">+</button></div></div>
      ${gs.length ? `<button type="button" class="wipe-ok itc-ok" data-a="itgGear" aria-pressed="${!!t.gear}"><span class="bx">${t.gear ? IC('check') : ''}</span><span>Also set ${who ? `${esc(who.label)}’s` : 'their'} ratings on the card: ${gs.map(([kk, l]) => `<b>${l} ${who ? `${sgn(+who.o[kk] || 0)} → ` : ''}+${+it[kk]}</b>`).join(', ')}</span></button>` : ''}
      ${who && who.pc ? `<p class="muted" style="margin:0;font:600 12.5px/1.4 var(--f-ui)">${esc(G().P[who.o.player]?.name || 'The player')} gets a note in your private chat.</p>` : ''}`;
    return sheet(`Give ${esc(it.name)}`, body, `<button type="button" class="btn ghost" data-a="sheet" data-v="items">${IC('left')}Back</button><button type="button" class="btn primary" data-a="itGiveGo" ${who ? '' : 'disabled'}>${IC('hand')}Give</button>`);
  }
  /* ---------------- Transfer gold or fate points (GM) ---------------- */
  case 'xfer': {
    const x = v.ui.xf; if (!gm || !x) return '';
    const r = N.xferInfo(x), k = r.k, fp = k === 'fp', pcs = N.pcs().filter(c => c.built), npcs = g.npcs;
    const num = n => fp ? String(n) : n.toLocaleString('en-US'), bal = o => `${num(N.xferBal(o, k))} ${fp ? 'FP' : 'gold'}`;
    const pick = (key, label) => `<label class="field"><span>${label}</span><select class="inp" id="xf${key}-${v.id}" data-i="xf" data-k="${key}"><option value="">Pick someone…</option>
        ${pcs.length ? `<optgroup label="Player characters">${pcs.map(c => `<option value="c:${esc(c.id)}" ${x[key] === 'c:' + c.id ? 'selected' : ''}>${esc(c.short)} · ${bal(c)}</option>`).join('')}</optgroup>` : ''}
        ${npcs.length ? `<optgroup label="NPCs">${npcs.map(n => `<option value="n:${esc(n.id)}" ${x[key] === 'n:' + n.id ? 'selected' : ''}>${esc(n.name)} · ${bal(n)}</option>`).join('')}</optgroup>` : ''}</select></label>`;
    const face = w => N.av(w.pc ? w.o : {name:w.o.name, portrait:w.o.portrait, color:'var(--c-npc)'}, 28);
    const ok = r.a && r.b && !r.err, unit = fp ? (r.q === 1 ? 'fate point' : 'fate points') : 'gold';
    const line = (w, h, d) => `<div class="shop-purse xf-row">${face(w)}<span class="xf-n">${esc(w.label)}</span><b>${num(h)}${ok ? ` → ${num(h + d)}` : ''}</b></div>`;
    const tells = [r.a, r.b].filter(w => w && w.pc && N.partyOf(w.o.player)).map(w => esc(w.label));
    const body = `<div class="seg" role="group" aria-label="What to transfer"><button type="button" data-a="xfK" data-v="gold" aria-pressed="${!fp}">${IC('coins')}Gold</button><button type="button" data-a="xfK" data-v="fp" aria-pressed="${fp}">${IC('star')}Fate points</button></div>
      ${pick('from', 'From')}
      <div class="xf-sw"><button type="button" class="btn sm ghost" data-a="xfSwap" ${x.from || x.to ? '' : 'disabled'}>${IC('swap')}Swap From and To</button></div>
      ${pick('to', 'To')}
      <div class="field"><span>How much</span><div class="gold-ed"><button type="button" data-a="xfQ" data-d="-1" aria-label="Less" ${r.q <= 1 ? 'disabled' : ''}>−</button><input class="inp" id="xfq-${v.id}" data-i="xf" data-k="q" value="${esc(x.qs != null ? x.qs : String(r.q))}" inputmode="numeric" pattern="[0-9]*" enterkeyhint="done" autocomplete="off" aria-label="How much ${fp ? 'fate points' : 'gold'}"><button type="button" data-a="xfQ" data-d="1" aria-label="More" ${r.q >= r.max ? 'disabled' : ''}>+</button><button type="button" class="btn sm ghost xf-all" data-a="xfAll" ${r.max > 1 && r.q !== r.max ? '' : 'disabled'}>All${r.max > 1 ? ` · ${num(r.max)}` : ''}</button></div></div>
      ${r.a && r.b && r.a.o !== r.b.o ? `<div class="xf-prev">${line(r.a, r.ha, -r.q)}${line(r.b, r.hb, r.q)}</div>` : ''}
      ${r.err ? `<div class="note">${IC('warn')}${esc(r.err)}</div>` : ''}
      ${ok ? `<p class="muted" style="margin:0;font:600 12.5px/1.4 var(--f-ui)">${tells.length ? `A line goes in the party chat for ${tells.join(' and ')}.` : 'No player gets a note.'}</p>` : ''}`;
    return sheet(fp ? 'Transfer fate points' : 'Transfer gold', body, `<button type="button" class="btn ghost" data-a="closeSheet">Cancel</button><button type="button" class="btn primary" data-a="xfGo" ${ok ? '' : 'disabled'}>${IC('swap')}${ok ? `Give ${num(r.q)} ${unit}` : 'Transfer'}</button>`);
  }
  /* ---------------- custom emoji (GM) ---------------- */
  case 'emoji': {
    const list = g.emoji, e = v.ui.emoNew, n = e ? N.emoName(e.n) : '', dup = !!n && list.some(x => x.n === n), full = list.length >= 80;
    const add = e ? `<div class="emo-new"><img src="${esc(e.d)}" alt=""><label class="field" style="flex:1;min-width:0"><span>Name</span><input class="inp" id="emn-${v.id}" data-i="emn" value="${esc(e.n)}" placeholder="e.g. dragon" autocomplete="off" autocapitalize="off"><small>${!n ? 'Letters, numbers and _ only.' : dup ? `:${esc(n)}: is already taken.` : `Type :${esc(n)}: in a message, or pick it from the emoji button.`}</small></label>
        <div class="row"><button type="button" class="btn ghost sm" data-a="emoCancel">Cancel</button><button type="button" class="btn primary sm" data-a="emoSave" ${n && !dup ? '' : 'disabled'}>${IC('check')}Add</button></div></div>`
      : `<button type="button" class="btn sm" data-a="emoAdd" style="justify-self:start" ${full ? 'disabled' : ''}>${IC('upload')}Upload a picture</button>`;
    const gifKey = `<div><h4>GIF search</h4><p class="muted" style="margin:0 0 8px;font:600 13px/1.4 var(--f-ui)">${g.gifKey ? 'On. Everyone can search GIFs from the smiley button in the chat.' : 'Off. Paste a free GIPHY key here to let everyone search GIFs. Pasting GIF links works without it.'}</p>
      <div class="gif-link"><input class="inp" id="gk-${v.id}" data-i="gifKey" value="${esc(v.ui.gifKeyD ?? g.gifKey ?? '')}" placeholder="GIPHY API key" autocomplete="off" autocapitalize="off" spellcheck="false"><button type="button" class="btn sm primary" data-a="gifKeySave">${IC('check')}Save</button></div></div>`;
    return sheet('Emoji and GIFs', `${gifKey}<h4 style="margin:6px 0 -6px">Custom emoji</h4><p class="muted" style="margin:0;font:600 13px/1.4 var(--f-ui)">Your own little pictures for reactions and messages. Everyone at the table can use them. A small square picture with a clear background works best. Animated GIF or WebP emoji (like Discord’s) keep moving.</p>
      ${add}
      ${list.length ? `<div class="emo-list">${list.map(x => `<div class="emo-it"><img src="${esc(N.emoSrc(x))}" alt=""><b>:${esc(x.n)}:</b>${x.a ? '<small class="emo-mv" title="Animated">GIF</small>' : ''}<button type="button" class="ibtn sm" data-a="emoDel" data-v="${esc(x.n)}" aria-label="Remove :${esc(x.n)}:">${IC('trash')}</button></div>`).join('')}</div>` : '<div class="note">' + IC('info') + 'No custom emoji yet.</div>'}
      ${full ? `<div class="note">${IC('info')}That’s the most Norne can keep (80). Remove one to add another.</div>` : ''}`,
      `<button type="button" class="btn primary" data-a="closeSheet">Done</button>`);
  }
  /* ---------------- a chat message (GM) ---------------- */
  case 'msgEdit': {
    const m = g.msgs.find(x => x.id === arg), d = v.ui.med; if (!m || !d) return '';
    return sheet('Edit message', `<p class="muted" style="margin:0;font:600 12.5px/1.4 var(--f-ui)">${esc(N.msgWho(m))} · ${esc(N.chName(m.ch, 'gm'))}. Everyone who can see it sees the new words, marked “edited”.</p>
      <textarea class="inp" id="med-${v.id}" data-i="med" rows="5" style="font:500 15.5px/1.45 var(--f-ui)">${esc(d.text)}</textarea>${medVoice(v, m, d)}`,
      `<button type="button" class="btn ghost" data-a="closeSheet">Cancel</button><button type="button" class="btn primary" data-a="msgSave" ${d.text.trim()?'':'disabled'}>${IC('check')}Save</button>`);
  }
  /* ---------------- group chats (GM) ---------------- */
  case 'grpEdit': {
    const d = v.ui.gd, seats = N.seats(), ready = N.groupsReady();
    const body = `${ready ? '' : `<div class="note">${IC('warn')}Group chats need the new Firebase security rules. Paste firestore.rules into Firebase &gt; Firestore &gt; Rules, press Publish, then reload.</div>`}
      <div><h4>Kind</h4><div class="seg"><button type="button" data-a="gdParty" data-v="0" aria-pressed="${!d.party}">${IC('whisper')}Group chat</button><button type="button" data-a="gdParty" data-v="1" aria-pressed="${!!d.party}">${IC('banner')}Party</button></div>
        <p class="muted" style="margin:8px 0 0;font:600 12.5px/1.4 var(--f-ui)">${d.party ? 'A party’s players only see each other’s characters, and this chat replaces Everyone for them. A player can be in one party at a time.' : 'An extra chat for a few players, like two characters running into each other. Everything else stays the same.'}</p></div>
      <div><h4>Speaking</h4><div class="seg"><button type="button" data-a="gdMeta" data-v="0" aria-pressed="${!d.meta}">${IC('mask')}In character</button><button type="button" data-a="gdMeta" data-v="1" aria-pressed="${!!d.meta}">${IC('chatL')}Meta only</button></div>
        <p class="muted" style="margin:8px 0 0;font:600 12.5px/1.4 var(--f-ui)">${d.meta ? 'Like Everyone: players show by their own name and Meta picture, never their character. Nobody speaks in character and no fights start here.' : 'Players can speak as their characters and switch to Meta, and you can narrate and start fights here.'}</p></div>
      <label class="field"><span>Name</span><input class="inp" id="gdn-${v.id}" data-i="gdName" value="${esc(d.name)}" placeholder="${d.party ? 'e.g. The river company' : 'e.g. Jack and Rachel'}" autocomplete="off"></label>
      <div><h4>Picture<small>${d.pic ? 'Shown beside the chat in the list' : 'None yet. The chat shows a ' + (d.party ? 'banner' : 'speech bubble')}</small></h4><div style="display:flex;flex-wrap:wrap;gap:8px;align-items:center">
        <button type="button" class="facebtn gdpic" data-a="gdPic" aria-label="${d.pic ? 'Change the picture' : 'Upload a picture'}">${d.pic ? N.av({name:d.name || '?', portrait:d.pic}, 52) : `<span class="av" style="--s:52px;--c:var(--line-3);background:var(--sunk);color:var(--ink-3);box-shadow:inset 0 0 0 1.5px var(--line-2)">${IC(d.party ? 'banner' : 'whisper')}</span>`}<span class="badge">${IC('image')}</span></button>
        <button type="button" class="btn sm ${d.pic ? 'ghost' : 'primary'}" data-a="gdPic">${IC('upload')}${d.pic ? 'Change' : 'Upload a picture'}</button>
        ${d.pic ? `<button type="button" class="btn sm ghost" data-a="gdPicFrame">${IC('fit')}Adjust</button><button type="button" class="btn sm ghost" data-a="gdPicNone">${IC('trash')}Remove</button>` : ''}</div></div>
      <div><h4>Who’s in it</h4><div class="forwho">${seats.map(s => { const other = d.party && (g.groups || []).find(x => x.party && x.id !== d.id && x.seats.includes(s)); return `<button type="button" data-a="gdSeat" data-v="${s}" aria-pressed="${d.seats.includes(s)}">${N.av(N.personObj(s), 28)}${esc(G().P[s]?.name || s)}${other ? `<small style="color:var(--ink-3);font-weight:600">· in ${esc(other.name)}</small>` : ''}</button>`; }).join('') || '<p class="muted" style="margin:0">No players yet.</p>'}</div>
      <p class="muted" style="margin:8px 0 0;font:600 12.5px/1.4 var(--f-ui)">Only these players and you can read the chat. Someone taken out loses it.${d.party ? ' Picking someone who is in another party moves them here.' : ''}</p></div>
      ${(() => { const was = d.id && (g.groups || []).find(x => x.id === d.id), add = was ? d.seats.filter(s => !was.seats.includes(s)) : []; if (!add.length) return '';
        return `<div><h4>${esc(N.namesOf(add))} can read</h4><div class="seg"><button type="button" data-a="gdHist" data-v="1" aria-pressed="${d.hist !== false}">${IC('scroll')}Everything so far</button><button type="button" data-a="gdHist" data-v="0" aria-pressed="${d.hist === false}">${IC('clock')}From now on</button></div>
        <p class="muted" style="margin:8px 0 0;font:600 12.5px/1.4 var(--f-ui)">${d.hist === false ? 'They won’t see anything said here before you add them, only what comes after.' : 'They can scroll back through the whole chat, from the first message.'}</p></div>`; })()}
      ${d.id ? `<button type="button" class="btn sm danger" data-a="sheet" data-v="grpDel" data-c="${esc(d.id)}" style="justify-self:start">${IC('trash')}Delete this group chat</button>` : ''}`;
    return sheet(d.id ? (d.party ? 'Edit party' : 'Edit group chat') : (d.party ? 'New party' : 'New group chat'), body, `<button type="button" class="btn ghost" data-a="closeSheet" style="flex:0 0 auto">Cancel</button><button type="button" class="btn primary lg" data-a="gdSave" ${d.name.trim() && d.seats.length && ready ? '' : 'disabled'}>${IC('check')}${d.id ? 'Save' : d.party ? 'Make the party' : 'Make the chat'}</button>`);
  }
  /* Jake: the GM ends the day in a roleplay party or group chat. A Narrator line with the new date (or "Date unknown"),
     then a Meta line saying the GM refreshes Fate points and Gold and runs Strength checks on Consequences */
  case 'nextDay': {
    const d = v.ui.nday; if (!d || !gm) return '';
    const opt = (list, cur) => list.map((t, i) => `<option value="${i}"${i === cur ? ' selected' : ''}>${esc(t)}</option>`).join('');
    const days = Array.from({length:31}, (_, i) => i + 1).map(n => `<option value="${n}"${n === d.d ? ' selected' : ''}>${n}</option>`).join('');
    const dis = d.u ? ' disabled' : '';
    const body = `<p class="muted" style="margin:0;font:600 13px/1.45 var(--f-ui)">Ends the day in <b>${esc(N.chName(v.ui.ch, 'gm'))}</b>. ${d.from ? 'Filled in with the day after the last one you posted.' : 'Pick the new date.'}</p>
      <label class="ndunk"><input type="checkbox" data-i="ndayU"${d.u ? ' checked' : ''}><span><b>Unknown</b><small>Leave the date blank. The line reads “Date unknown”.</small></span></label>
      <div class="ndgrid${d.u ? ' off' : ''}">
        <label class="field ndw"><span>Day of the week</span><select class="inp" data-i="ndayW"${dis}>${opt(N.WEEKDAYS, d.w)}</select></label>
        <label class="field ndd"><span>Date</span><select class="inp" data-i="ndayD"${dis}>${days}</select></label>
        <label class="field ndm"><span>Month</span><select class="inp" data-i="ndayM"${dis}>${opt(N.MONTHS.map(x => x[0]), d.m)}</select></label>
        <label class="field ndy"><span>Year</span><input class="inp" id="ndy-${v.id}" data-i="ndayY" value="${esc(d.y || '')}" placeholder="e.g. 1204" autocomplete="off"${dis}></label>
      </div>
      ${!d.u && d.d > N.MONTHS[d.m][1] ? `<div class="note">${IC('warn')}${esc(N.MONTHS[d.m][0])} has ${N.MONTHS[d.m][1]} days in the calendar.</div>` : ''}
      <div><h4>What the chat gets</h4><div class="ndprev" id="ndp-${v.id}">${N.nextDayPrev(d)}</div></div>`;
    return sheet('Next day', body, `<button type="button" class="btn ghost" data-a="closeSheet" style="flex:0 0 auto">Cancel</button><button type="button" class="btn primary lg" data-a="ndayGo">${IC('sun')}Post the next day</button>`);
  }
  case 'grpDel': {
    const gr = (g.groups || []).find(x => x.id === arg); if (!gr) return '';
    return sheet(`Delete ${esc(gr.name)}?`, `<p style="margin:0;font:500 15px/1.5 var(--f-ui);color:var(--ink-2)">The chat and everything said in it are deleted for everyone. This can’t be undone.</p>`,
      `<button type="button" class="btn ghost" data-a="closeSheet">Keep it</button><button type="button" class="btn danger" data-a="grpDelGo" data-v="${esc(gr.id)}">${IC('trash')}Delete</button>`);
  }
  /* a picture sent in chat, as big as the screen allows */
  case 'picView': {
    const m = g.msgs.find(x => x.id === arg); if (!m || !m.pic) return '';
    return sheet(`${esc(N.msgPerson(m).name)}’s picture`, `<img class="picbig" src="${esc(N.show(m.pic.u))}" alt="${esc(m.text || 'Picture')}">${m.text ? `<p style="margin:0;font:500 15px/1.5 var(--f-ui);color:var(--ink-2)">${N.emoText(N.fmt(m.text))}</p>` : ''}`,
      `<a class="btn ghost" href="${esc(m.pic.u)}" download="norne-picture.jpg">${IC('download')}Save</a><button type="button" class="btn primary" data-a="closeSheet">Close</button>`, {wide:true});
  }
  case 'msgDel': {
    const m = g.msgs.find(x => x.id === arg); if (!m) return '';
    const what = m.text ? `“${esc(m.text.length > 140 ? m.text.slice(0, 140) + '…' : m.text)}”` : m.kind === 'roll' ? `the ${esc(m.roll.skill)} roll` : m.kind === 'scene' ? 'this scene change' : 'this card';
    return sheet('Delete this message?', `<p style="margin:0;font:500 15px/1.5 var(--f-ui);color:var(--ink-2)">${esc(N.msgWho(m))}: ${what} is removed for everyone. You can undo it for a few seconds.</p>`,
      `<button type="button" class="btn ghost" data-a="closeSheet">Keep it</button><button type="button" class="btn danger" data-a="msgDelGo" data-v="${esc(m.id)}">${IC('trash')}Delete</button>`);
  }
  /* ---------------- wiping a whole chat (GM): pick it, read the warning, then type its name ---------------- */
  case 'wipe': {
    const w = v.ui.wipe; if (!w) return '';
    const count = c => g.msgs.filter(m => m.ch === c).length, fights = N.allFights();
    const ic = c => N.chanIcon ? N.chanIcon(v, c) : '';
    if (w.step === 1 || !w.ch) {
      const rows = N.channelsFor('gm', true).map(c => {
        const n = count(c), fight = !!fights[c], off = fight || !n;
        return `<button type="button" class="wipe-ch" data-a="wipePick" data-v="${esc(c)}" aria-pressed="${w.ch === c}" ${off ? 'disabled' : ''}>${ic(c)}<span><b>${esc(N.chName(c, 'gm'))}</b><small>${esc(N.chSub(c, 'gm'))}</small></span><span class="n">${fight ? 'Fight on: end it first' : n ? `${n} message${n > 1 ? 's' : ''}` : 'Already empty'}</span></button>`;
      }).join('');
      return sheet('Wipe a chat', `<p class="muted" style="margin:0;font:600 13.5px/1.45 var(--f-ui)">Pick the one chat whose history you want to erase. Nothing is erased yet: two more checks come after this.</p>
        <div class="wipe-list" role="group" aria-label="Chat to wipe">${rows}</div>`,
        `<button type="button" class="btn ghost" data-a="closeSheet">Cancel</button><button type="button" class="btn danger" data-a="wipeStep" data-v="2" ${w.ch ? '' : 'disabled'}>Next${IC('right')}</button>`);
    }
    const name = esc(N.chName(w.ch, 'gm')), n = count(w.ch), who = w.ch === 'table' ? 'you and every player' : w.ch === 'gm' ? 'you' : N.grpOf(w.ch) ? `you and ${esc(N.namesOf(N.grpOf(w.ch).seats))}` : `you and ${name}`;
    const banner = `<div class="wipe-who">${ic(w.ch)}<span><small>Chat to wipe</small><b>${name}</b><small>${n} message${n > 1 ? 's' : ''} · ${esc(N.chSub(w.ch, 'gm'))}</small></span></div>`;
    if (w.step === 2) {
      return sheet('This is permanent', `${banner}
        <div class="wipe-warn">${IC('warn')}<div><b>Wiping ${name} erases all ${n} message${n > 1 ? 's' : ''} in it, for ${who}, forever.</b>
          <ul><li>Every message, roll, picture, GIF and scene card in this chat is deleted.</li><li>There is no undo, no backup and no recycle bin. Not even the GM can get it back.</li><li>Other chats, characters, the wiki, maps and news are not touched.</li></ul></div></div>
        <button type="button" class="btn" data-a="wipeExp" style="align-self:flex-start">${IC('export')}Save a copy first (export this chat)</button>
        <button type="button" class="wipe-ok" data-a="wipeOk" aria-pressed="${!!w.ok}"><span class="bx">${w.ok ? IC('check') : ''}</span><span>I understand that <b>${name}</b> will be wiped permanently and cannot be brought back.</span></button>`,
        `<button type="button" class="btn ghost" data-a="wipeStep" data-v="1">${IC('left')}Back</button><button type="button" class="btn danger" data-a="wipeStep" data-v="3" ${w.ok ? '' : 'disabled'}>Continue</button>`);
    }
    const match = N.wipeMatch(w);
    return sheet('Last chance', `${banner}
      <div class="wipe-warn">${IC('warn')}<div><b>Are you absolutely sure?</b> This is permanent. Type the chat’s name, <b class="nm">${name}</b>, to wipe it.</div></div>
      <input class="inp" id="wipe-${v.id}" data-i="wipeType" value="${esc(w.typed || '')}" autocomplete="off" autocapitalize="off" spellcheck="false" placeholder="${name}" aria-label="Type ${name} to confirm">`,
      `<button type="button" class="btn ghost" data-a="wipeStep" data-v="2">${IC('left')}Back</button><button type="button" class="btn danger solid" data-a="wipeGo" ${match ? '' : 'disabled'}>${IC('trash')}Wipe ${name} forever</button>`);
  }
  /* ---------------- a news edition (GM) ---------------- */
  case 'newsSet': {
    const i = g.news.issues.find(x => x.id === arg); if (!i) return '';
    return sheet(`No. ${esc(i.no)} · ${esc(i.headline)}`, `<div><h4>Who can read this edition</h4>${N.audPick('newsAud', i, 'news')}</div>
      <p class="muted" style="margin:0;font:600 12.5px/1.4 var(--f-ui)">Players you add get a note in their chat with you, only the first time. Edits never send a new note.</p>`,
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

/* one picture tile in the scene window or one of its folders, ticked when it is the scene's picture */
function sdThumb(d, p){
  const on = p.place ? (d.place && d.place.map === p.place.map && d.place.rx === p.place.rx && d.place.ry === p.place.ry) : (d.art && d.art === p.art);
  return `<button type="button" class="thumb${on?' on':''}" ${p.up ? `data-a="sdPickUp" data-v="${esc(p.art)}"` : `data-a="sdPick" data-v="${esc(p.id)}"`} style="${N.sceneArt(p)};${p.place?'background-size:420% auto':''}">${N.scenePic(p)}<span>${esc(p.title)}<small>${esc(p.sub||'')}</small></span>${on?`<span class="ck">${IC('check')}</span>`:''}</button>`;
}
/* change the voice a message went out in: a player's line is their character or Meta, the GM's is Meta, the Narrator or an NPC */
function medVoice(v, m, d){
  if (!N.voiceFixable(m)) return '';
  const cur = d.as || N.msgVoice(m), row = inner => `<div class="field medv"><span>Sent as</span>${inner}<small class="muted">Pick the voice it should have gone out in.</small></div>`;
  if (m.by !== 'gm') {
    const nm = N.charVoiceName(m.by), b = (val, ic, label) => `<button type="button" data-a="medAs" data-v="${val}" aria-pressed="${cur === val}">${IC(ic)}${esc(label)}</button>`;
    return row(`<div class="seg medseg" role="group" aria-label="Sent as">${b('char', 'mask', nm)}${b('meta', 'chatL', 'Meta')}</div>`);
  }
  const vf = N.voicesFor(m.ch, m.as), o = n => `<option value="${esc(n)}" ${cur === n ? 'selected' : ''}>${esc(n)}</option>`;
  return row(`<select class="inp" id="medv-${v.id}" data-i="medAs" aria-label="Sent as"><option value="meta" ${cur === 'meta' ? 'selected' : ''}>Meta (you, out of character)</option>${o('Narrator')}${vf.here.length ? `<optgroup label="In this scene">${vf.here.map(o).join('')}</optgroup>` : ''}${vf.rest.length ? `<optgroup label="Everyone else">${vf.rest.map(o).join('')}</optgroup>` : ''}</select>`);
}
function notifyToggle(){
  const st = N.notifyState ? N.notifyState() : 'none';
  const sub = {on:N.notifyPush && N.notifyPush() ? 'You get a ping for new messages, rolls and news, even with Norne closed.' : 'You get a ping for new messages, rolls and news while Norne is open but not in front.', off:'Get a ping for new messages, rolls and news on this device.',
    blocked:'Your browser blocks them for this site. Allow notifications in its site settings, then try again.', install:'On iPhone, add Norne to your home screen first (Share > Add to Home Screen), then turn this on there.', none:'This browser can’t show notifications.'}[st];
  return `<button type="button" class="toggle" data-a="notify" aria-pressed="${st==='on'}">${IC(st==='on'?'herald':'clock')}<span>Notifications on this device<small>${sub}</small></span><span class="sw"></span></button>`;
}
/* every style as a card: a little Night and Day picture of it, its name, and a tick on the one in use */
function stylePick(v){
  const sw = t => `<i style="--sw-bg:${t.bg};--sw-card:${t.card};--sw-ink:${t.ink};--sw-acc:${t.acc};--sw-hi:${t.hi}"><b></b><b></b><em></em></i>`;
  return `<div class="stylepick">${N.STYLES.map(s => `<button type="button" class="stc" data-a="style" data-v="${s.id}" aria-pressed="${v.style===s.id}">
    <span class="sw" aria-hidden="true">${sw(s.night)}${sw(s.day)}</span><span class="t"><b>${esc(s.name)}</b><small>${esc(s.sub)}</small></span>${v.style===s.id?`<span class="ck">${IC('check')}</span>`:''}</button>${v.style===s.id && s.pals ? palPick(v, s) : ''}`).join('')}</div>`;
}
/* the colour schemes of the style in use, right under its card */
function palPick(v, s){
  const cur = N.palOk(s.id, v.pal);
  return `<div class="palpick" role="group" aria-label="Colour scheme">${s.pals.map(p => `<button type="button" data-a="pal" data-v="${p.id}" aria-pressed="${cur===p.id}"><i style="--pa:${p.a};--pb:${p.b}"></i><span>${esc(p.name)}</span></button>`).join('')}</div>`;
}
/* five sizes as a row of growing A's, with a line of sample text at the picked size underneath */
function fzPick(v){
  return `<div class="fzpick"><div class="seg" role="group" aria-label="Text size">${N.FONT_SIZES.map(f => `<button type="button" data-a="fz" data-v="${f.id}" aria-pressed="${v.fz===f.id}" aria-label="${f.name}" title="${f.name}"><span style="--a:${Math.round(15*f.k)}px">A</span></button>`).join('')}</div>
    <p class="fzs"><b>${esc((N.FONT_SIZES.find(f => f.id === v.fz) || {}).name || '')}</b> · The lantern gutters as the rain comes in over the river.</p></div>`;
}
function portraitPick(sel, act, up){
  const custom = sel && !PORTRAITS.includes(sel) ? N.faceUrl(sel) : null;
  /* Upload and your own picture come first, so the new picture is in view right after the framing editor closes;
     tapping your own picture opens the framing editor again */
  return `<div class="who-row"><button type="button" data-a="${up}"><span class="av" style="--s:52px;--c:var(--line-3);background:var(--sunk);color:var(--ink-3);box-shadow:inset 0 0 0 1.5px var(--line-2)">${IC('upload').replace('<svg','<svg style="width:20px;height:20px"')}</span><span>Upload</span></button>${custom ? `<button type="button" aria-pressed="true" data-a="${up.replace('Upload', 'Frame')}" title="Adjust framing"><span class="av" style="--s:52px;--c:var(--gold)"><img src="${esc(custom)}" alt="" style="${N.frameCss(sel)}"></span><span>Adjust</span></button>` : ''}${PORTRAITS.map(p => `<button type="button" data-a="${act}" data-v="${p}" aria-pressed="${sel===p}"><span class="av" style="--s:52px;--c:var(--gold)"><img src="${N.FACE(p)}" alt="" loading="lazy"></span></button>`).join('')}</div>`;
}
/* a player with several characters picks which one to play; switching reloads Norne as that character */
function mySeats(v){
  const my = N.me(); if (!my || isGM(v)) return '';
  const ss = N.seatsOf(my); if (ss.length < 2) return '';
  const g = G();
  return `<div><h4>Your characters<small>Each has its own chats, party and memory. Switching reloads this tab only, so another tab can play a different one.</small></h4><div class="seatpick">${ss.map(s => {
    const c = g.chars[g.P[s]?.char || 'pc' + s.slice(1)], cur = s === v.role;
    /* a character in a party this seat can't read: use what this device remembers from playing it */
    const k = c?.built ? {short:c.short, portrait:c.portrait} : N.seatCard(s);
    const sub = cur ? 'Playing now' : k ? 'Tap to switch' : c ? 'No card yet · tap to switch' : 'Tap to switch';
    return `<button type="button" class="seatb" data-a="seatGo" data-v="${s}" aria-pressed="${cur}" ${cur ? 'disabled' : ''}>${N.av({name:k?.short || '?', portrait:k?.portrait || null, color:g.P[s]?.color}, 40)}<span><b>${esc(k?.short || (c ? 'New character' : 'Your other character'))}</b><small>${sub}</small></span>${cur ? IC('check') : IC('swap')}</button>`; }).join('')}</div></div>`;
}
/* a skill ladder editor: rungs from top to bottom, each with a cap (or none) */
function skillLadder(v, d, sel, del, rungs){
  const used = Object.keys(d.skills);
  const free = N.MUNDANE.filter(k => !used.includes(k)), freeM = N.MAGIC.filter(k => !used.includes(k));
  const opts = free.map(k => `<option>${k}</option>`).join('') + (freeM.length ? `<optgroup label="Magic">${freeM.map(k => `<option value="${k}">${k}${k==='Enchantment Magic'?' (elves only)':''}</option>`).join('')}</optgroup>` : '');
  const mv = del.replace('Del', 'Mv'), top = rungs[0][0], low = rungs[rungs.length-1][0];
  return `<div class="lad">${rungs.map(([x,w,n]) => { const here = used.filter(k => d.skills[k] === x); return `<div class="rung"><span class="lv"><b>${sgn(x)}</b>${w}${n?` · ${here.length}/${n}`:''}</span><span class="sks">${here.map(k => `<span class="skc"><b>${esc(k)}</b><button type="button" data-a="${mv}" data-v="${esc(k)}" data-d="-1" aria-label="Lower ${esc(k)}" title="Lower" ${x<=low?'disabled':''}>${IC('minus')}</button><button type="button" data-a="${mv}" data-v="${esc(k)}" data-d="1" aria-label="Raise ${esc(k)}" title="Raise" ${x>=top?'disabled':''}>${IC('plus')}</button><button type="button" data-a="${del}" data-v="${esc(k)}" aria-label="Remove ${esc(k)}" title="Remove">${IC('x')}</button></span>`).join('')}${!n || here.length < n ? `<select class="inp" data-i="${sel}" data-x="${x}" id="${sel}${x}-${v.id}" style="width:auto;min-height:34px;padding:4px 10px;border-radius:999px;font-size:14px"><option value="">+ Add</option>${opts}</select>` : ''}</span></div>`; }).join('')}</div>`;
}
/* disciplines for the skills that need one: a magic takes exactly one, the others can take several.
   "Other" lets the GM write in a discipline that isn't on the list; ones already written in elsewhere are suggested */
function discPick(v, d, act){
  const ks = Object.keys(d.skills).filter(k => (N.DISC[k] || []).length).sort((a,b) => d.skills[b] - d.skills[a]);
  if (!ks.length) return '';
  const g = G(), all = [...Object.values(g.chars || {}), ...(g.npcs || [])], oth = v.ui.dOth || {};
  return `<div style="display:grid;gap:10px;margin-top:12px">${ks.map((k, ki) => { const mag = N.MAGIC.includes(k), have = N.discOf(d, k), list = N.DISC[k];
    const own = have.filter(x => !list.includes(x)), seen = [...new Set(all.flatMap(o => N.discOf(o, k)))].filter(x => !list.includes(x) && !have.includes(x));
    const chip = (x, on, ic) => `<button type="button" class="cchip" data-a="${act}" data-s="${esc(k)}" data-v="${esc(x)}" aria-current="${on}" style="padding:0 12px"${ic ? ` aria-label="Remove ${esc(x)}"` : ''}>${esc(x)}${ic ? IC('x') : ''}</button>`;
    const id = `dot${ki}-${act}-${v.id}`, txt = oth[act + '|' + k] || '';
    return `<div class="field"><span>${esc(k)} · ${mag ? 'pick its one discipline' : 'disciplines'}${have.length ? '' : ' <b style="color:var(--ember)">· none picked</b>'}</span><div class="dchips">${list.map(x => chip(x, have.includes(x))).join('')}${own.map(x => chip(x, true, 1)).join('')}</div>
      <div class="dother"><input class="inp" id="${id}" data-i="dOth" data-s="${esc(k)}" data-act="${act}" value="${esc(txt)}" placeholder="Other discipline" list="${id}l" autocomplete="off" maxlength="40"><datalist id="${id}l">${seen.map(x => `<option value="${esc(x)}">`).join('')}</datalist><button type="button" class="btn sm ghost" data-a="${act}Other" data-s="${esc(k)}" ${txt.trim() ? '' : 'disabled'}>${IC('plus')}Add</button></div></div>`; }).join('')}</div>`;
}
const raceList = v => `<datalist id="races-${v.id}">${N.RACES.map(r => `<option value="${r}">`).join('')}</datalist><datalist id="nats-${v.id}">${N.nations().map(r => `<option value="${esc(r)}">`).join('')}</datalist>`;
const stunts = (v, d, pre) => `<div style="display:grid;gap:8px">${d.stunts.map(([n,t],i) => `<div style="display:grid;gap:6px;padding:10px;border-radius:14px;background:var(--raise);box-shadow:inset 0 0 0 1px var(--line)"><div style="display:flex;gap:6px"><input class="inp" id="${pre}sn${i}-${v.id}" data-i="${pre}" data-k="stn" data-n="${i}" value="${esc(n)}" placeholder="Stunt name"><button type="button" class="ibtn sm" data-a="${pre}StuntDel" data-i="${i}" aria-label="Remove stunt">${IC('trash')}</button></div><textarea class="inp" id="${pre}sd${i}-${v.id}" data-i="${pre}" data-k="std" data-n="${i}" rows="2" placeholder="What it does" style="min-height:60px">${esc(t)}</textarea></div>`).join('')}
  <button type="button" class="btn sm ghost" data-a="${pre}StuntAdd" style="justify-self:start">${IC('plus')}Add a stunt</button></div>`;
const steppers = (d, pre) => `<div style="display:flex;gap:12px;flex-wrap:wrap">${[['refresh','Refresh'],['fp','Fate points now']].map(([k,l]) => `<div class="field" style="flex:1;min-width:150px"><span>${l}</span><div class="seg" style="justify-content:space-between;width:100%"><button type="button" data-a="${pre}Step" data-k="${k}" data-d="-1" aria-label="Less">${IC('minus')}</button><b style="align-self:center;font:700 18px/1 var(--f-display)">${d[k]}</b><button type="button" data-a="${pre}Step" data-k="${k}" data-d="1" aria-label="More">${IC('plus')}</button></div></div>`).join('')}</div>`;
/* any spread is allowed, up to Mythic, so the GM can build unusual characters */
/* +0 is any skill left off the card, so the ladder skips it: lowering an Average skill makes it Poor (−1) */
const RUNGS = [8,7,6,5,4,3,2,1,-1].map(x => [x, ladderWord(x), 0]);
function pcEditor(v){
  const d = v.ui.pd;
  const extra = Object.entries(d.skills).filter(([,x]) => x > 8 || x < -1 || x === 0);
  return `${raceList(v)}<div><h4>Portrait</h4>${portraitPick(d.portrait, 'pdPortrait', 'pdUpload')}</div>
    <div style="display:grid;gap:12px;grid-template-columns:repeat(auto-fit,minmax(200px,1fr))">
      <label class="field"><span>Character name</span><input class="inp" id="pdn-${v.id}" data-i="pd" data-k="name" value="${esc(d.name)}" placeholder="Full name"></label>
      <label class="field"><span>Short name (chat and tokens)</span><input class="inp" id="pds-${v.id}" data-i="pd" data-k="short" value="${esc(d.short)}" placeholder="What the table calls them"></label>
      <label class="field"><span>Race</span><input class="inp" id="pdr-${v.id}" data-i="pd" data-k="race" list="races-${v.id}" value="${esc(d.race||'')}" placeholder="e.g. Dwarf"></label>
      <label class="field"><span>Nationality</span><input class="inp" id="pdt-${v.id}" data-i="pd" data-k="nat" list="nats-${v.id}" value="${esc(d.nat||'')}" placeholder="Optional" autocomplete="off"></label>
      <label class="field"><span>Age</span><input class="inp" id="pdg-${v.id}" data-i="pd" data-k="age" value="${esc(d.age||'')}" placeholder="Optional"></label>
    </div>
    <div><h4>Aspects</h4><div style="display:grid;gap:8px">
      ${d.aspects.map((a,i) => `<label class="field"><span>Aspect ${i+1}</span><input class="inp" id="pda${i}-${v.id}" data-i="pd" data-k="asp" data-n="${i}" value="${esc(a||'')}" placeholder="Optional"></label>`).join('')}
    </div></div>
    <div><h4>Skills · a starting character usually has one Great, two Good, three Fair and four Average</h4>${skillLadder(v, d, 'pdSkill', 'pdSkillDel', RUNGS)}
      ${extra.length ? `<p class="muted" style="margin:8px 0 0;font:600 12.5px/1.4 var(--f-ui)">Also: ${extra.map(([k,x]) => `<button type="button" class="btn sm ghost" data-a="pdSkillDel" data-v="${esc(k)}" style="--h:28px">${esc(k)} ${sgn(x)} ${IC('x')}</button>`).join(' ')}</p>` : ''}
      ${discPick(v, d, 'pdDisc')}</div>
    <div style="display:grid;gap:12px;grid-template-columns:repeat(auto-fit,minmax(180px,1fr))">
      <label class="field"><span>Melee weapon rating · Fighting, shifts added to a hit</span>${N.gearSelect(`pdga-${v.id}`, 'data-i="pd" data-k="gearAtk"', d.gearAtk)}</label>
      <label class="field"><span>Ranged weapon rating · Shooting, added to the attack roll</span>${N.gearSelect(`pdgr-${v.id}`, 'data-i="pd" data-k="gearRng"', d.gearRng)}</label>
      <label class="field"><span>Ranged ammo rating · Shooting, shifts added to a hit</span>${N.gearSelect(`pdgm-${v.id}`, 'data-i="pd" data-k="gearAmmo"', d.gearAmmo)}</label>
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
      <label class="field"><span>Nationality</span><input class="inp" id="ndt-${v.id}" data-i="nd" data-k="nat" list="nats-${v.id}" value="${esc(d.nat||'')}" placeholder="Optional" autocomplete="off"></label>
      <label class="field"><span>Job or faction</span><input class="inp" id="ndj-${v.id}" data-i="nd" data-k="job" value="${esc(d.job)}" placeholder="Optional"></label>
      <label class="field"><span>Age</span><input class="inp" id="ndg-${v.id}" data-i="nd" data-k="age" value="${esc(d.age||'')}" placeholder="Optional"></label>
      ${N.nd.list().length ? `<label class="field"><span>Folder</span><select class="inp" id="ndf-${v.id}" data-i="nd" data-k="dir"><option value="">No folder</option>${N.nd.list().map(([id, name]) => `<option value="${esc(id)}" ${d.dir === id ? 'selected' : ''}>${esc(name)}</option>`).join('')}</select></label>` : ''}
    </div>
    <div><h4>Kind</h4><div class="seg"><button type="button" data-a="ndType" data-v="supporting" aria-pressed="${d.type!=='nameless'}">Supporting</button><button type="button" data-a="ndType" data-v="nameless" aria-pressed="${d.type==='nameless'}">Nameless (one hit)</button></div></div>
    <div><h4>Aspects</h4><div style="display:grid;gap:8px">
      ${d.aspects.map((a,i) => `<label class="field"><span>Aspect ${i+1}</span><input class="inp" id="nda${i}-${v.id}" data-i="nd" data-k="asp" data-n="${i}" value="${esc(a||'')}" placeholder="Optional"></label>`).join('')}
    </div></div>
    <div><h4>Skills</h4>${skillLadder(v, d, 'ndSkill', 'ndSkillDel', RUNGS)}${discPick(v, d, 'ndDisc')}</div>
    <div style="display:grid;gap:12px;grid-template-columns:repeat(auto-fit,minmax(180px,1fr))">
      <label class="field"><span>Melee weapon rating · Fighting, shifts added to a hit</span>${N.gearSelect(`ndga-${v.id}`, 'data-i="nd" data-k="gearAtk"', d.gearAtk)}</label>
      <label class="field"><span>Ranged weapon rating · Shooting, added to the attack roll</span>${N.gearSelect(`ndgr-${v.id}`, 'data-i="nd" data-k="gearRng"', d.gearRng)}</label>
      <label class="field"><span>Ranged ammo rating · Shooting, shifts added to a hit</span>${N.gearSelect(`ndgm-${v.id}`, 'data-i="nd" data-k="gearAmmo"', d.gearAmmo)}</label>
      <label class="field"><span>Armor rating · shifts taken off a hit</span>${N.gearSelect(`ndgd-${v.id}`, 'data-i="nd" data-k="gearDef"', d.gearDef)}</label>
    </div>
    <label class="field"><span>Disciplines</span><textarea class="inp" id="ndm-${v.id}" data-i="nd" data-k="magic" rows="2" placeholder="Notes on their disciplines and anything else they can do">${esc(d.magic||'')}</textarea></label>
    <div><h4>Stunts</h4>${stunts(v, d, 'nd')}</div>
    ${steppers(d, 'nd')}
    <div><h4>Inventory</h4>${N.invList(v, d, true, 'data-nd="1"')}</div>
    <label class="field"><span>Bio</span><textarea class="inp" id="ndb-${v.id}" data-i="nd" data-k="bio" rows="3" placeholder="Who they are, what they look like, how they talk…">${esc(d.bio||'')}</textarea></label>
    <label class="field"><span>${lockIc}GM notes</span><textarea class="inp" id="ndx-${v.id}" data-i="nd" data-k="notes" rows="2" placeholder="Only you see these">${esc(d.notes||'')}</textarea></label>`;
}

/* Who invokes on a fight roll. The GM picks (v.ui.invBy) the fighter who rolled or the one they face, and each side's
   invoke lands on its own roll: the defender's on the defense roll, the attacker's on the attack roll. Facing a roll
   with nothing rolled on the other side (a difficulty, an NPC's passive skill), the other side's invoke adds +2 to what
   has to be beaten (iv.opp) and can't reroll. Before the defense is rolled only the attacker can invoke.
   null outside a live fight or for players (they only invoke on their own rolls). */
N.invokeSides = function(v, m){
  const g = G(), cb = g.combat, r = m.roll;
  if (!isGM(v) || cb.state !== 'live' || m.ch !== N.fightCh()) return null;
  const me = N.tokOfKey(r.whoKey); if (!me) return null;
  let opp = null, link = null, wait = false;
  const q = [cb.pending, cb.last].find(p => p && (p.msgId === m.id || p.defMsg === m.id));
  if (q && q.msgId === m.id) { opp = N.tokById(q.def); link = q.defMsg && g.msgs.find(x => x.id === q.defMsg); wait = !link; }
  else if (q) { opp = N.tokById(q.att); link = g.msgs.find(x => x.id === q.msgId); }
  else if (r.opp != null) { const nm = r.target || r.vs?.name; opp = nm ? cb.tokens.find(t => t !== me && N.tokName(t) === nm) : null; }
  return {me, opp:opp || null, link:link || null, wait};
};
/* by: who invokes; faces: who they are up against; onto: the roll message the invoke changes; pay: whose fate points */
N.invokeCtx = function(v, m){
  const sd = N.invokeSides(v, m);
  const by = !sd ? null : sd.opp && !sd.wait && v.ui.invBy === sd.opp.id ? sd.opp : sd.me;
  const theirs = !!sd && by !== sd.me;
  return {sides:sd, by, faces:!sd ? null : theirs ? sd.me : sd.opp, onto:theirs && sd.link ? sd.link : m, against:theirs && !sd.link, pay:N.invokePayer(v, m.roll, by)};
};
/* whose fate point a paid invoke costs: a player's own; in the GM's hands, the invoker's character card or named NPC card.
   null when nobody's pool is kept (nameless NPCs, someone typed in by hand) */
N.invokePayer = function(v, r, by){
  const g = G(), pc = id => { const c = g.chars[id]; return c ? {o:c, name:c.short} : null; }, npc = id => { const n = g.npcs.find(x => x.id === id); return n ? {o:n, name:n.name} : null; };
  if (!isGM(v)) { const c = N.charOf(v.role); return c ? {o:c, name:c.short} : null; }
  if (by) return by.kind === 'pc' ? pc(by.ref) : by.type !== 'nameless' ? npc(by.ref) : null;
  const k = r.whoKey || '';
  if (k.startsWith('pc:')) return pc(k.slice(3));
  if (k.startsWith('npc:')) return npc(k.slice(4));
  const t = N.tokOfKey(k); return t ? N.invokePayer(v, r, t) : null;
};
/* what can be invoked on a roll: scene and situation aspects, the invoker's own boosts, both fighters' aspects, and consequences
   (they are aspects too) on the invoker and on whoever they face */
N.invokeOptions = function(v, m, x = N.invokeCtx(v, m)){
  const g = G(), out = [], gm = isGM(v), r = m.roll;
  const sc = g.scenes[m.ch];
  if (sc) (sc.aspects || []).forEach((a,i) => out.push({t:a.t, free:N.sceneFreeLeft(sc, i), from:`Scene${a.on ? ` · on ${a.on}` : ''}`, ref:N.sceneRef(sc, i)}));
  const cb = g.combat, me = x.by || (cb.state === 'live' && m.ch === N.fightCh() ? N.tokOfKey(r.whoKey) : null);
  if (cb.state === 'live' && m.ch === N.fightCh()) {
    /* a boost is its owner's free invoke. A player only sees their own; the GM sees every boost on the board, because
       they may let someone else use one (a friend's opening, say). It's still free, and gone once used */
    const own = a => me && a.tok === me.id;
    cb.aspects.map((a,i) => [a,i]).sort(([a],[b]) => own(b) - own(a)).forEach(([a,i]) => { if (a.boost && (!a.free || !(own(a) || gm))) return;
      out.push({t:a.t || 'Unnamed boost', free:a.free || 0, from:a.boost ? `${a.by}’s boost${own(a) || !me ? '' : ', if you allow it'}` : `Situation${a.on ? ` · on ${a.on}` : ''}`, kind:'cb', i}); });
    cb.zones.filter(z => z.aspect).forEach(z => out.push({t:z.aspect, free:z.free || 0, from:z.name, kind:'zone', z:z.id}));
  }
  const pcAsp = c => [c.hc, c.trouble, ...c.aspects].filter(Boolean).forEach(a => out.push({t:a, free:0, from:gm ? `${c.short}’s aspect` : 'Your aspect'}));
  const k = r.whoKey || '';
  /* in the GM's hands both fighters' aspects are on offer: the invoker's own, and the other side's (a weakness to play on).
     A named NPC's come from its card, so edits made mid-fight show */
  const tokAsp = t => { if (t.kind === 'pc') { const c = g.chars[t.ref]; if (c) pcAsp(c); return; }
    const n = t.type !== 'nameless' && g.npcs.find(y => y.id === t.ref);
    (n ? [n.hc, n.trouble, ...(n.aspects || [])] : t.aspects || []).filter(Boolean).forEach(a => out.push({t:a, free:0, from:`${t.name}’s aspect`})); };
  if (x.by) { tokAsp(x.by); if (x.faces) tokAsp(x.faces); }
  else if (k.startsWith('pc:')) { const c = g.chars[k.slice(3)]; if (c) pcAsp(c); }
  else if (gm && k.startsWith('tok:')) { const t = N.tokById(k.slice(4)); (t?.aspects || []).filter(Boolean).forEach(a => out.push({t:a, free:0, from:'NPC aspect'})); }
  else if (gm && k.startsWith('npc:')) { const n = g.npcs.find(x => x.id === k.slice(4)); if (n) [n.hc, n.trouble, ...n.aspects].filter(Boolean).forEach(a => out.push({t:a, free:0, from:'NPC aspect'})); }
  if (me) [me, x.faces].forEach(t => t && N.tokCons(t).filter(c => c.v).forEach(c => out.push({t:c.v, free:0, from:`${N.tokName(t)}’s ${c.l.toLowerCase()} consequence`})));
  const seen = new Set(x.onto.roll.invokes.map(i => i.aspect));
  const list = out.filter(o => !seen.has(o.t) && (seen.add(o.t), true));
  /* Jake's Unnamed aspect: the GM can invoke something that isn't on the list (named or not), as often as they like.
     It costs like any other aspect */
  if (gm) list.push({t:(v.ui.invName || '').trim() || 'Unnamed aspect', free:0, from:'Not on the list', unnamed:true});
  return list;
};

/* ---------------- the log as text ---------------- */
const hhmm = t => new Date(t).toLocaleTimeString([], {hour:'numeric', minute:'2-digit'});
function rollText(r){
  const tot = N.rollTotal(r), o = N.outcome(r);
  const pl = N.plusInvokes(r), rr = r.invokes.filter(i => i.reroll), ag = r.invokes.filter(i => i.opp), by = i => i.by ? ` by ${i.by}` : '';
  return `${r.who}, ${r.skill} ${sgn(r.bonus)}${r.gear?` incl. gear ${sgn(r.gear)}`:''}${r.dist?` incl. distance −${r.dist}`:''}${r.mod?` incl. ${r.mod > 0 ? 'buff' : 'debuff'} ${sgn(r.mod)}`:''} (${r.event ? `event${typeof r.event === 'string' ? ` “${r.event}”` : ''}, ` : ''}${r.action}${r.target?` on ${r.target}`:''}${r.oppDice?`, opposed roll ${r.oppDice.map(d => d > 0 ? '+' : d < 0 ? '−' : '0').join(' ')} ${sgn(r.oppBase)}`:''}${r.vs?` against ${r.vs.name ? r.vs.name + (r.vs.skill ? `’s ${r.vs.skill}` : '') : r.vs.skill}`:''}). Dice ${r.dice.map(d => d > 0 ? '+' : d < 0 ? '−' : '0').join(' ')}${pl?`, invoked ${r.invokes.filter(i => !i.reroll && !i.opp).map(i => '“' + i.aspect + '”' + by(i)).join(', ')} (+${2*pl})`:''}${rr.length?`, rerolled with ${rr.map(i => '“' + i.aspect + '”' + by(i)).join(', ')}`:''}${ag.length?`, the other side invoked ${ag.map(i => '“' + i.aspect + '”' + by(i)).join(', ')} (+${2*ag.length} to beat)`:''} → ${sgn(tot)} (${ladderWord(tot)})${o?` vs ${sgn(r.opp)} (${ladderWord(r.opp)}): ${o.t}${o.sh?`, ${Math.abs(o.sh)} shift${Math.abs(o.sh)===1?'':'s'}`:''}${r.shift?` (GM ${sgn(r.shift)} shift${Math.abs(r.shift)===1?'':'s'} after the roll)`:''}`:''}.`;
}
function exLine(m){
  const t = `[${hhmm(m.t)}]`;
  if (m.kind === 'sys') return `${t} — ${m.text}`;
  if (m.kind === 'meta' || m.kind === 'ooc') return `${t} (meta) ${N.personObj(m.by).name}: ${m.text}`;
  if (m.kind === 'roll') return `${t} ROLL: ${rollText(m.roll)}`;
  if (m.kind === 'combat' || m.kind === 'fight') return `${t} — A fight begins: ${m.text}`;
  if (m.kind === 'scene') return `\n### ${m.scene.title}${m.scene.where ? ` · ${m.scene.where}` : ''}${m.scene.date ? ` · ${m.scene.date}` : ''}\n`;
  if (m.kind === 'news') return `${t} — New edition of the paper: ${m.text}`;
  if (m.kind === 'note') return `${t} NOTE: ${m.text}`;
  const sp = N.speakerObj(m);
  return sp.narr ? `${t} NARRATOR: ${m.text}` : `${t} ${sp.name}${m.by === 'gm' ? ' (NPC)' : ''}: ${m.text}`;
}
/* the same log as data another AI can read: chats in order, and every fight as its own block holding its rolls,
   results and notices. A fight's own chat (fc) is never exported. */
function exEntry(m){
  const t = new Date(m.t).toISOString();
  if (m.kind === 'roll') { const r = m.roll, o = N.outcome(r); return {t, type:'roll', who:r.who, action:r.action, skill:r.skill, skillBonus:N.skillPart(r), gear:r.gear || 0, ...(r.dist ? {distance:-r.dist} : {}), ...(r.mod ? {buff:r.mod} : {}), target:r.target || null, vs:r.vs || null, opposedDice:r.oppDice || null, opposedBonus:r.oppDice ? r.oppBase : null, dice:r.dice, invokes:r.invokes.map(i => ({aspect:i.aspect, reroll:!!i.reroll, ...(i.opp ? {againstRoll:true} : {}), ...(i.by ? {by:i.by} : {})})), total:N.rollTotal(r), ladder:ladderWord(N.rollTotal(r)), against:r.opp ?? null, outcome:o ? o.t : null, shifts:o ? o.sh : null, ...(r.shift ? {gmShifts:r.shift} : {}), secret:m.ch === 'gm'}; }
  if (m.kind === 'sys' && m.res && m.res.k === 'order') return {t, type:'turn_order', order:(m.res.rows || []).map(x => ({name:x.n, notice:x.sk, total:x.tot}))};
  if (m.kind === 'sys' && m.res) { const [a, d] = m.res.rows || [], side = x => x && {name:x.n, skill:x.sk, skillBonus:x.b - (x.g||0), gear:x.g || 0, total:x.tot}; return {t, type:'attack_result', title:m.res.title, attack:side(a), defense:side(d), damage:m.res.calc || null, outcome:m.res.out?.t || null, after:m.res.after || null}; }
  if (m.kind === 'sys') return {t, type:'note', text:m.text};
  if (m.kind === 'meta' || m.kind === 'ooc') return {t, type:'out_of_character', who:N.personObj(m.by).name, text:m.text};
  if (m.kind === 'scene') return {t, type:'scene', title:m.scene.title, where:m.scene.where || null, date:m.scene.date || null};
  if (m.kind === 'news') return {t, type:'news', title:m.text};
  if (m.kind === 'note') return {t, type:'gm_note', text:m.text};
  const sp = N.speakerObj(m);
  return sp.narr ? {t, type:'narration', text:m.text} : {t, type:'speech', speaker:sp.name, npc:m.by === 'gm', text:m.text};
}
/* the export's date range: from and to are datetime-local strings ("2026-11-04T19:30") or empty for no limit; to takes its whole minute */
const expMs = (x, end) => { if (!x) return end ? Infinity : -Infinity; const t = new Date(x).getTime(); return isNaN(t) ? (end ? Infinity : -Infinity) : t + (end ? 59999 : 0); };
const inRange = (m, sel) => m.t >= expMs(sel.from) && m.t <= expMs(sel.to, true);
const rangeWords = sel => { const f = d => new Date(d).toLocaleString([], {dateStyle:'medium', timeStyle:'short'});
  return sel.from && sel.to ? `from ${f(sel.from)} to ${f(sel.to)}` : sel.from ? `from ${f(sel.from)} on` : sel.to ? `up to ${f(sel.to)}` : 'from the first message to the last'; };
N.expRangeWords = rangeWords;
N.cap1 = x => x.charAt(0).toUpperCase() + x.slice(1);
/* "2026-11-04T19:30" for a datetime-local field, in this device's time */
N.expStamp = t => { const d = new Date(t), p = n => String(n).padStart(2, '0'); return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`; };
function buildJson(sel){
  const keep = m => !m.fc && inRange(m, sel) && !(m.kind === 'scene' && (m.quiet || !m.scene)) && (((m.kind === 'rp' || m.kind === 'sys' || m.kind === 'scene' || m.kind === 'combat' || m.kind === 'fight' || m.kind === 'news' || m.kind === 'note') && sel.rp) || (m.kind === 'roll' && sel.roll) || ((m.kind === 'meta' || m.kind === 'ooc') && sel.meta));
  const chats = [];
  for (const c of N.channelsFor('gm', true)) {
    if (!sel.ch.has(c)) continue;
    const entries = []; let fight = null;
    for (const m of G().msgs.filter(x => x.ch === c && keep(x))) {
      if (m.kind === 'combat' || m.kind === 'fight') { fight = {t:new Date(m.t).toISOString(), type:'fight', title:m.text || '', ended:null, entries:[]}; entries.push(fight); continue; }
      if (m.fightEnd && fight) { fight.ended = new Date(m.t).toISOString(); fight = null; continue; }
      (fight && N.isFightAct(m) ? fight.entries : entries).push(exEntry(m));
    }
    if (entries.length) chats.push({chat:N.chName(c, 'gm'), entries});
  }
  return JSON.stringify({format:'norne-log', version:1, campaign:'Nörne', exported:new Date().toISOString(),
    ...(sel.from || sel.to ? {range:{from:sel.from ? new Date(expMs(sel.from)).toISOString() : null, to:sel.to ? new Date(expMs(sel.to, true)).toISOString() : null}} : {}),
    about:'A Fate Core campaign log. Chats are in time order. type "fight" blocks hold that fight\'s rolls (4 Fate dice, -1/0/+1 each, total = dice + skillBonus + gear + 2 per invoke that is neither a reroll nor againstRoll; an againstRoll invoke is already in "against"), attack results and notices. Typed fight chat is left out.',
    includes:{roleplay:!!sel.rp, rolls:!!sel.roll, outOfCharacter:!!sel.meta}, chats}, null, 2);
}
N.buildExport = sel => {
  if (sel.json) return buildJson(sel);
  const kinds = [sel.rp && 'roleplay', sel.roll && 'rolls', sel.meta && 'meta talk'].filter(Boolean);
  const out = ['# Nörne: session log', `Exported ${new Date().toLocaleString()} · includes ${kinds.join(', ') || 'nothing'} · ${rangeWords(sel)}`];
  for (const c of N.channelsFor('gm', true)) {
    if (!sel.ch.has(c)) continue;
    const ms = G().msgs.filter(m => m.ch === c && !m.fc && inRange(m, sel) && !(m.kind === 'scene' && (m.quiet || !m.scene)) && (((m.kind === 'rp' || m.kind === 'sys' || m.kind === 'scene' || m.kind === 'combat' || m.kind === 'fight' || m.kind === 'news' || m.kind === 'note') && sel.rp) || (m.kind === 'roll' && sel.roll) || ((m.kind === 'meta' || m.kind === 'ooc') && sel.meta)));
    if (!ms.length) continue;
    /* each real-world day the chat was used starts with its date, since the lines only carry the time */
    let lastDay = '';
    out.push('', `## ${N.chName(c, 'gm')}`, '', ms.map(m => { const dd = new Date(m.t).toLocaleDateString([], {weekday:'long', month:'long', day:'numeric', year:'numeric'}), head = m.t && dd !== lastDay ? `— ${dd} —\n\n` : ''; if (head) lastDay = dd; return head + exLine(m); }).join('\n\n'));
  }
  return out.join('\n');
};

/* ---------- chat search: every message this person can read, newest first ---------- */
const srchText = m => { const t = N.msgCopyText(m); return m.kind === 'roll' ? `${m.roll.who || ''} ${m.roll.skill} ${m.roll.action || ''} ${m.roll.target || ''} ${t}` : m.kind === 'scene' ? `${m.scene?.title || ''} ${m.scene?.where || ''}` : t; };
const srchWho = m => m.kind === 'roll' ? (m.roll.who || 'Roll') : m.kind === 'scene' ? 'New scene' : m.kind === 'sys' || m.kind === 'news' ? '' : m.kind === 'rp' && !N.metaRp(m) ? N.speakerObj(m).name || 'Narrator' : N.msgPerson(m).name;
const fold = x => String(x).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
const mark = (txt, words) => { let h = esc(txt); for (const w of words) h = h.replace(new RegExp('(' + esc(w).replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + ')', 'gi'), '<mark>$1</mark>'); return h; };
N.chatSearch = (v, q, all) => {
  const words = fold(q).split(/\s+/).filter(Boolean); if (!words.length) return [];
  const chs = new Set(all ? N.channelsFor(v.role) : [v.ui.ch]);
  const hits = [];
  for (let i = G().msgs.length - 1; i >= 0 && hits.length < 200; i--) {
    const m = G().msgs[i];
    if (!chs.has(m.ch) || m.fc || (m.kind === 'scene' && (m.quiet || !m.scene))) continue;
    const hay = fold(srchText(m) + ' ' + srchWho(m));
    if (words.every(w => hay.includes(w))) hits.push(m);
  }
  return hits;
};
N.chatSearchHtml = v => {
  const q = (v.ui.cq || '').trim(), all = v.ui.cqAll !== false;
  if (!q) return `<p class="muted srch-none">Type to search ${all ? 'every chat you’re in' : 'this chat'}: words someone said, a character’s name, a skill. Tap a result to jump to it.</p>`;
  const hits = N.chatSearch(v, q, all), words = q.split(/\s+/).filter(Boolean);
  if (!hits.length) return `<p class="muted srch-none">Nothing found for “${esc(q)}”.</p>`;
  const day = t => new Date(t).toLocaleDateString([], {month:'short', day:'numeric', year:new Date(t).getFullYear() === new Date().getFullYear() ? undefined : 'numeric'});
  return `<p class="muted srch-n">${hits.length >= 200 ? 'The newest 200 matches' : `${hits.length} match${hits.length > 1 ? 'es' : ''}`}</p><ul class="srch-list">${hits.map(m => {
    const t = srchText(m).replace(/\s+/g, ' ').trim(), lo = fold(t), first = Math.min(...words.map(w => { const k = lo.indexOf(fold(w)); return k < 0 ? Infinity : k; }));
    /* start the snippet a few words before the first match, on a word boundary */
    let at = first === Infinity || first < 50 ? 0 : t.indexOf(' ', first - 45) + 1; if (at <= 0 || at > first) at = first === Infinity ? 0 : Math.min(first, at);
    const snip = (at > 0 ? '…' : '') + t.slice(at, at + 180) + (t.length > at + 180 ? '…' : ''), who = srchWho(m);
    return `<li><button type="button" data-a="cqGo" data-v="${m.id}" data-c="${esc(m.ch)}"><span class="srch-h">${all ? `<b>${esc(N.chName(m.ch, v.role))}</b>` : ''}${who ? `<span style="color:${N.msgColor(m)}">${esc(who)}</span>` : ''}<time>${day(m.t)} · ${hhmm(m.t)}</time></span><span class="srch-t">${mark(snip, words)}</span></button></li>`; }).join('')}</ul>`;
};

N.creditsHtml = () => `<div class="note">${IC('heart')}Everything here is free to use. Some licenses ask for credit, so here it is.</div>
  <div class="menu" style="background:transparent;box-shadow:none;padding:0;gap:8px">${[
    ['Battle for Wesnoth art','Portraits and scene backdrops','GNU GPL 2.0 or later · wesnoth.org'],
    ['WTactics card art','Scene backdrops · by Santiago Iborra and others (edges trimmed)','CC BY-SA 4.0 · wtactics.org'],
    ['Flare game art','Backdrops','CC BY-SA 3.0 · flarerpg.org'],
    ['game-icons.net','Combat, item and category icons, and the triquetra on the Parchment & Wax seal · by Lorc, Delapouite and others','CC BY 3.0'],
    ['Phosphor Icons','Interface icons','MIT'],
    ['Nörne maps and lore','Maps and wiki text','The GM’s own campaign notes'],
    ['Kenney UI Pack: Adventure','Frames, buttons, the ribbon, rings and the star of the Oak & Iron style, some recoloured · by Kenney','CC0 (public domain) · kenney.nl'],
    ['Fonts','Cinzel, Fraunces, Nunito Sans, Nunito, IM Fell English, IM Fell DW Pica, Alegreya, UnifrakturMaguntia, Vollkorn, Grenze, Grenze Gotisch, Kalam, Caveat, Fredericka the Great, Noto Emoji, Fredoka, Cherry Bomb One, Playpen Sans, Marcellus, Hanken Grotesk, Newsreader, Outfit','SIL Open Font License · Google Fonts'],
    ['Parchment & Wax textures','Papyrus, vellum and the wax seal were drawn for Norne','Free to use'],
    ['Sketchbook art','Drawing paper, black pastel paper, pencil frames, charcoal blocks and hatching were drawn for Norne','Free to use'],
    ['Twemoji','Flowers, sparkles, hearts and the bow in the 4-the-gerleez style · by Twitter and contributors (recoloured)','CC BY 4.0 · github.com/jdecked/twemoji'],
  ].map(([a,b,c]) => `<div class="mem" style="grid-template-columns:1fr"><span><b>${a}</b><small>${b}</small><small style="display:block;color:var(--gold-tx)">${c}</small></span></div>`).join('')}</div>`;
})();
