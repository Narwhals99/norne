/* =====================================================================
   NORNE — the new layout (2026-11-14). Only drawn while N.nlOn(v) is true (Profile > New layout, gated in core.js).
   The look is css/plain.css. This file holds the parts that are new, not restyled:
   - the GM's Actions menu: every GM tool in one searchable list (the + in the typing bar, or Ctrl K). It replaces the GM tab
   - one side panel with tabs instead of two stacked panels (GM: Scene, Party, Rolls. Player: Sheet, Rolls, Inventory)
   - the scene as one line above the chat, which opens the full banner
   - Wiki | News and Sheet | Inventory switches, so the tab bar has four tabs
   views.js calls in here from small `if (N.nlOn(v))` hooks. The old layout does not load anything from this file.
   ===================================================================== */
(function(){
const N = window.N, {esc, IC} = N;
const G = () => N.G, isGM = v => v.role === 'gm';
const nl = N.nl = {};

/* a panel with its right side marked: the button that opens or folds the side panel */
nl.PANEL = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3.5" y="4.5" width="17" height="15" rx="3"/><path d="M14.5 4.5v15"/></svg>';
const seg = (label, rows) => `<div class="nl-seg" role="group" aria-label="${label}">${rows.map(([a, val, l, on, extra]) => `<button type="button" data-a="${a}" data-v="${val}" aria-pressed="${!!on}">${l}${extra || ''}</button>`).join('')}</div>`;

/* ---------- four tabs: News lives inside World, Inventory inside Character ---------- */
nl.worldSeg = (v, newsNew) => `<div class="nl-segbar">${seg('World', [['tab', 'world', 'Wiki', v.ui.tab === 'world'], ['tab', 'news', 'News', v.ui.tab === 'news', newsNew ? `<i class="nl-n">${newsNew}</i>` : '']])}</div>`;
nl.heroSeg = v => {
  if (isGM(v)) return '';
  const inv = v.ui.tab === 'inv' || (v.dev === 'phone' && !!v.ui.heroInv);
  return `<div class="nl-segbar">${seg('Character', [['tab', 'hero', 'Sheet', !inv], ['tab', 'inv', 'Inventory', inv]])}</div>`;
};

/* ---------- the scene as one line ---------- */
nl.sceneLine = (v, sc, ch, past) => {
  const gm = isGM(v), n = (sc.aspects || []).length;
  return `<section class="nl-scene${past ? ' past' : ''}" aria-label="${past ? 'Scene at the time' : 'Scene'}" data-scn="${sc.msg || ''}">
    <button type="button" class="nl-sc-main" data-a="sceneMin" aria-label="Show the scene" title="Show the scene">
      <span class="nl-sc-pic" style="${N.sceneArt(sc)}">${N.scenePic(sc)}</span>
      <span class="nl-sc-t"><b>${esc(sc.title)}</b>${sc.where || sc.date ? `<small>${esc([sc.where, sc.date].filter(Boolean).join(' · '))}</small>` : ''}</span>
      ${past ? '<span class="nl-chip">Earlier</span>' : ''}${n ? `<span class="nl-chip b">${n} aspect${n > 1 ? 's' : ''}</span>` : ''}
    </button>
    ${past ? `<button type="button" class="nl-sc-btn" data-a="sceneLive">Now</button>` : gm ? `<button type="button" class="nl-sc-btn" data-a="sheet" data-v="scene">Change</button>` : ''}
  </section>`;
};

/* ---------- the side panel ---------- */
const sideTabs = v => isGM(v)
  ? [['scene', 'Scene'], ['party', 'Party'], ['rolls', 'Rolls']]
  : [['sheet', 'Sheet'], ['rolls', 'Rolls'], ['inv', 'Inventory']];
/* other pages a side panel can show, the same ones the old panel pickers offered */
const sideMore = v => [['map', 'Map', 'map'], ['world', 'Wiki', 'world'], ['news', 'News', 'newsL'], ...(isGM(v) ? [['cast', 'Cast', 'cast'], ['inv', 'Inventory', 'bag']] : [['hero', 'Full sheet', 'scroll']])];
const sidePick = v => { const ids = [...sideTabs(v), ...sideMore(v)].map(x => x[0]); return ids.includes(v.ui.nlSide) ? v.ui.nlSide : ids[0]; };
/* the tab a swipe lands on: the next (1) or the one before (-1). None past either end, or from a page picked under More */
nl.sideStep = (v, d) => { const ids = sideTabs(v).map(x => x[0]), i = ids.indexOf(sidePick(v)); return i < 0 ? null : ids[i + d] || null; };
function sideHead(v){
  const cur = sidePick(v), more = sideMore(v), inMore = more.find(m => m[0] === cur);
  return `<div class="nl-tabs" role="tablist" aria-label="Side panel">${sideTabs(v).map(([id, l]) => `<button type="button" role="tab" data-a="nlSide" data-v="${id}" aria-selected="${cur === id}">${l}</button>`).join('')}
    <button type="button" class="nl-morebtn" data-a="nlMore" aria-expanded="${!!v.ui.nlMore}" aria-selected="${!!inMore}" title="More pages for this panel">${inMore ? esc(inMore[1]) : 'More'}${IC('caret')}</button></div>
    ${v.ui.nlMore ? `<div class="nl-more">${more.map(([id, l, ic]) => `<button type="button" data-a="nlSide" data-v="${id}" aria-pressed="${cur === id}">${IC(ic)}${l}</button>`).join('')}</div>` : ''}`;
}
/* what is running in the table right now, each a way in: fights, storefronts, crafting */
function running(v){
  const g = G(), out = [];
  const where = c => c === 'table' ? 'Everyone' : c === 'gm' ? 'GM notes' : N.chName(c, 'gm');
  for (const [c, cb] of Object.entries(N.allFights())) { const K = N.kw(cb); out.push(['openFight', c, K.ic, cb.state === 'setup' ? `${K.W} setup` : cb.title || K.W, where(c), '']); }
  for (const [c, s] of Object.entries(g.shops || {})) out.push(['sheet', 'shop', 'coins', s.state === 'setup' ? 'Store setup' : s.name || 'Storefront', where(c), `data-c="${esc(c)}"`]);
  for (const [c, cr] of Object.entries(g.crafts || {})) out.push(['sheet', 'craft', 'gear', 'Crafting setup', where(c), `data-c="${esc(c)}"`]);
  return out;
}
const runRows = (v, viaMenu) => running(v).map(([a, val, ic, l, sub, x]) => `<button type="button" class="nl-row live" ${viaMenu ? `data-a="nlDo" data-act="${a}" data-go="${esc(val)}"` : `data-a="${a}" data-v="${esc(val)}"`} ${x}><span class="nl-ic">${IC(ic)}</span><span class="nl-l"><b>${esc(l)}</b><small>In ${esc(sub)}</small></span><span class="nl-dot"></span></button>`).join('');
function sceneTab(v){
  const g = G(), ch = v.ui.ch, sc = g.scenes[ch];
  const card = sc ? `<div class="nl-card"><div class="nl-card-pic" style="${N.sceneArt(sc)}">${N.scenePic(sc)}</div>
      <div class="nl-card-b"><b>${esc(sc.title)}</b>${sc.where ? `<small>${esc(sc.where)}</small>` : ''}
      ${(sc.aspects || []).length ? `<div class="nl-asp">${sc.aspects.map((a, i) => { const f = N.sceneFreeLeft(sc, i); return `<span>${a.on ? `<i>On ${esc(a.on)}</i> ` : ''}${N.emoText(N.marks(esc(a.t)))}${f ? ` <em>${f} free</em>` : ''}</span>`; }).join('')}</div>` : ''}</div>
      <button type="button" class="nl-btn a" data-a="sheet" data-v="scene">Change the scene</button></div>`
    : ch === 'gm' ? '' : `<div class="nl-empty"><p>No scene in this chat yet.</p><button type="button" class="nl-btn a" data-a="sheet" data-v="scene">Set the scene</button></div>`;
  const run = runRows(v);
  return `<div class="nl-pad">${card}${run ? `<h3 class="nl-h">Running now</h3><div class="nl-list">${run}</div>` : ''}</div>${N.picShelf(v)}`;
}
function sideBody(v){
  const cur = sidePick(v);
  if (cur === 'scene') return `<div class="nl-sb scroll" data-sk="nls-scene">${sceneTab(v)}</div>`;
  if (cur === 'party') return `<div class="nl-sb scroll" data-sk="nls-party"><div class="nl-pad"><div class="nl-party">${N.partyRows(v)}</div><button type="button" class="nl-btn" data-a="tab" data-v="cast">Open the cast</button></div></div>`;
  if (cur === 'sheet') return `<div class="nl-sb scroll rail-a" data-sk="rail">${N.heroQuick(v)}</div>`;
  if (cur === 'rolls') return `<div class="nl-sb rcnt rc-in">${N.recentHtml(v, 'rp')}</div>`;
  v._paneMode = 'rp'; v._panes = [cur];
  return N.paneBody(v, cur, 'a', '', 'rp');
}
/* desktop: the chat, and one side panel beside it. The line between them drags, the button in the chat's top bar folds it */
nl.desk = (v, chat) => {
  if (v.ui.nlSideOff) return `<main class="page nl-solo">${chat}</main>`;
  const w = v.ui.railW || 0, cur = sidePick(v);
  return `<main class="page with-rail nl-desk" data-wk="railW"${w ? ` style="--railw:${w}px"` : ''}>${chat}<aside class="rail nlr">
    <div class="railgrip" role="separator" aria-orientation="vertical" aria-label="Drag to resize the side panel" title="Drag to resize"></div>
    <section class="pane pa nl-pane pane-is-${cur}">${sideHead(v)}${sideBody(v)}</section></aside></main>`;
};
/* phones: the same panel as a page of its own (swipe in from the right edge, or the panel button) */
nl.sidePhone = (v, sl) => { const cur = sidePick(v);
  return `<main class="page sidepg nl-sp${sl || ''}"><div class="sp-top"><button type="button" class="ibtn" data-a="sidePane" data-v="0" aria-label="Back to the chat">${IC('left')}</button><span><b>${esc(N.chName(v.ui.ch, v.role))}</b></span></div>
    <div class="rail sp nlr"><section class="pane pa nl-pane pane-is-${cur}">${sideHead(v)}${sideBody(v)}</section></div></main>`; };

/* ---------- the Actions menu ---------- */
/* one action: [id, label, hint, icon, action, value, extra data attributes, tone]. Sub-menus hold more of the same */
function actionList(v){
  const g = G(), ch = v.ui.ch, here = ch === 'table' ? 'Everyone' : ch === 'gm' ? 'GM notes' : N.chName(ch, 'gm');
  const fights = N.allFights(), waiting = N.MEMBERS.filter(m => m.role === 'pending').length;
  const canFight = !fights[ch] && !N.metaOnly(ch);
  const begin = [
    ...(canFight ? [['fight', 'A fight', 'Draw zones and add enemies. Players see nothing until you start', 'swords', 'cbBegin', '', ''],
      ['contest', 'A contest', 'Competing rolls in rounds, with a scoreboard', 'flag', 'cbBegin', '', 'data-k="contest"'],
      ['challenge', 'A challenge', 'Working together through two or more skill rolls', 'overcome', 'cbBegin', '', 'data-k="challenge"']] : []),
    ...(ch !== 'gm' && !fights.gm ? [['solo', 'A fight in GM notes', 'Only you see it, even once it starts', 'lock', 'cbBegin', 'gm', '']] : []),
    ...(!(g.shops || {})[ch] && N.shopOk(ch) ? [['shop', 'A storefront', 'Pick who is there and what is for sale', 'coins', 'shopBegin', '', '']] : []),
    ...(!(g.crafts || {})[ch] && N.craftOk(ch) ? [['craft', 'Crafting', 'Ingredients, what they make, then a Crafting roll', 'gear', 'craftBegin', '', '']] : []),
  ];
  const make = [
    ['npc', 'An NPC', 'A new card in the cast', 'npc', 'npcNew', '', ''],
    ['news', 'A news issue', 'Write for one of the papers', 'newsL', 'writeNews', '', ''],
    ['wiki', 'A wiki entry', '', 'quill', 'wNew', '', ''],
    ['pic', 'A picture', 'Upload a background for scenes and fights', 'upload', 'picUpload', '', ''],
  ];
  return [
    {h:`In ${here}`, rows:[
      ['roll', 'Roll', 'For anyone, against anything', 'dice', 'roll', '', ''],
      ['secret', 'Secret roll', 'Only you see the result', 'eyeoff', 'roll', '', 'data-secret="1"'],
      ['scene', 'Change the scene', 'Picture, name and aspects', 'image', 'sheet', 'scene', ''],
      ...(begin.length ? [['begin', 'Begin', 'A fight, contest, challenge, storefront or crafting', 'swords', 'sub', begin]] : []),
    ]},
    {h:'Create', rows:[['new', 'New', 'An NPC, news, a wiki entry or a picture', 'plus', 'sub', make]]},
    {h:'Table', rows:[
      ['party', 'Party', 'Fate points and stress', 'users', 'party', '', ''],
      ['cast', 'Cast', 'Characters and NPCs', 'cast', 'tab', 'cast', ''],
      ['map', 'Edit the map', 'Pins, reveals and folders', 'map', 'mapEditGo', '', ''],
      ['items', 'Item catalog', '', 'items', 'sheet', 'items', ''],
      ['players', waiting ? `Players · ${waiting} waiting` : 'Players', 'Let people in, rename or remove them', 'userplus', 'sheet', 'players', ''],
      ['emoji', 'Emoji and GIFs', '', 'smile', 'sheet', 'emoji', ''],
      ['export', 'Export the log', '', 'export', 'sheet', 'export', ''],
      ['import', 'Import lore', '', 'upload', 'sheet', 'import', ''],
    ]},
    {h:'Careful', rows:[['wipe', 'Wipe a chat', 'Deletes its messages for everyone', 'trash', 'sheet', 'wipe', '', 'red']]},
  ];
}
const RKEY = 'norne-nlrecent';
nl.recent = () => { try { return JSON.parse(localStorage.getItem(RKEY) || '[]').slice(0, 4); } catch(e) { return []; } };
nl.used = id => { if (!id) return; try { localStorage.setItem(RKEY, JSON.stringify([id, ...nl.recent().filter(x => x !== id)].slice(0, 4))); } catch(e) {} };
function row(r, chip){
  const [id, l, hint, ic, a, val, x, tone] = r;
  if (a === 'sub') return `<button type="button" class="nl-row" data-a="nlSub" data-v="${id}"><span class="nl-ic">${IC(ic)}</span><span class="nl-l"><b>${esc(l)}</b>${hint ? `<small>${esc(hint)}</small>` : ''}</span><span class="nl-go">${IC('right')}</span></button>`;
  const d = a === 'party' ? `data-a="nlDo" data-go="party" data-id="${id}"` : `data-a="nlDo" data-act="${a}" data-id="${id}"${val ? ` data-go="${esc(val)}"` : ''} ${x || ''}`;
  if (chip) return `<button type="button" class="nl-chipbtn" ${d}>${IC(ic)}${esc(l)}</button>`;
  return `<button type="button" class="nl-row${tone === 'red' ? ' red' : ''}" ${d}><span class="nl-ic">${IC(ic)}</span><span class="nl-l"><b>${esc(l)}</b>${hint ? `<small>${esc(hint)}</small>` : ''}</span></button>`;
}
nl.actions = v => {
  const groups = actionList(v), q = (v.ui.actQ || '').trim().toLowerCase();
  const flat = groups.flatMap(gr => gr.rows.flatMap(r => r[4] === 'sub' ? r[5].map(x => [x[0], `${r[1]} ${x[1].replace(/^An? /, '').toLowerCase()}`, ...x.slice(2)]) : [r]));
  const search = `<label class="nl-search">${IC('search')}<input type="search" id="actq-${v.id}" data-i="actQ" value="${esc(v.ui.actQ || '')}" placeholder="Search actions" autocomplete="off" enterkeyhint="search" aria-label="Search actions"></label>`;
  if (q) {
    const hits = flat.filter(r => (r[1] + ' ' + (r[2] || '')).toLowerCase().includes(q));
    return `<div class="nl-acts">${search}<div class="nl-list">${hits.map(r => row(r)).join('') || '<p class="nl-none">Nothing by that name.</p>'}</div></div>`;
  }
  const sub = v.ui.actSub && groups.flatMap(gr => gr.rows).find(r => r[4] === 'sub' && r[0] === v.ui.actSub);
  if (sub) return `<div class="nl-acts"><button type="button" class="nl-back" data-a="nlSub" data-v="">${IC('left')}${esc(sub[1])}</button><div class="nl-list">${sub[5].map(r => row(r)).join('')}</div></div>`;
  const rec = nl.recent().map(id => flat.find(r => r[0] === id)).filter(Boolean), run = runRows(v, true);
  return `<div class="nl-acts">${search}
    ${rec.length ? `<div class="nl-chips" aria-label="Used lately">${rec.map(r => row(r, true)).join('')}</div>` : ''}
    ${run ? `<h3 class="nl-h">Running now</h3><div class="nl-list">${run}</div>` : ''}
    ${groups.map(gr => `<h3 class="nl-h">${esc(gr.h)}</h3><div class="nl-list">${gr.rows.map(r => row(r)).join('')}</div>`).join('')}</div>`;
};
})();
