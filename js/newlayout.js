/* =====================================================================
   NORNE — the new layout (2026-11-14). Only drawn while N.nlOn(v) is true (Profile > Layout > New, gated in core.js).
   Its stylesheet is css/layout.css; every theme dresses it. This file holds the parts that are new, not restyled:
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
/* a page picked under More is one step in: going back from it lands on the last of the main tabs that was open */
nl.sideMoreOn = v => !sideTabs(v).some(x => x[0] === sidePick(v));
nl.sideHome = v => { const ids = sideTabs(v).map(x => x[0]); return ids.includes(v.ui.nlSideLast) ? v.ui.nlSideLast : ids[0]; };
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
  if (!nl.sideMoreOn(v)) v.ui.nlSideLast = cur;
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

/* ---------- tips: the New layout explains itself where you are (Jack, 2026-11-14) ----------
   No tour up front. The first time someone on the New layout reaches a screen where something moved or a gesture exists,
   one small card says so. It goes away for good when they do the thing it describes, or tap Got it.
   Remembered on the device, one list for phones and one for computers, so each shows every tip once. */
const TIPKEY = v => 'norne-nltips-' + (v.dev === 'phone' ? 'phone' : 'desktop');
const tipSeen = v => { if (!v.tips || v.tips.k !== TIPKEY(v)) { let a = []; try { a = JSON.parse(localStorage.getItem(TIPKEY(v)) || '[]'); } catch(e) {} v.tips = {k:TIPKEY(v), s:new Set(Array.isArray(a) ? a : [])}; } return v.tips.s; };
nl.tipDone = (v, id) => { const s = tipSeen(v); if (s.has(id)) return; s.add(id); try { localStorage.setItem(TIPKEY(v), JSON.stringify([...s])); } catch(e) {} };
/* [id, where it shows, what counts as having done it, icon, title, text] in the order they are offered on a screen */
const TIPS = (v, page) => { const ui = v.ui, ph = v.dev === 'phone', gm = isGM(v), chat = ui.tab === 'chat', side = ph && N.sideOpen(v), more = side && nl.sideMoreOn(v);
  const tabs = gm ? 'Scene, Party and Rolls' : 'Sheet, Rolls and Inventory', open = chat && !side && !/class="cb-|data-board/.test(page);
  return [
    ['actions', gm && open && page.includes('nlplus'), ui.sheet === 'actions', 'plus', 'Your GM tools are here now', `The GM tab is gone. Tap the + left of the typing bar${ph ? '' : ', or press Ctrl K,'} for every tool it had. Try it.`],
    ['scene', open && page.includes('nl-scene'), !!ui.sceneBig, 'image', 'The scene is one line', `Tap it to see the full picture and its aspects${gm ? ', or tap Change to edit it' : ''}.`],
    ['panel', open && (ph || !ui.nlSideOff), ph ? false : ui.nlSide !== v._tipSide0, null, ph ? 'One side panel' : 'One side panel, with tabs', ph
      ? `Swipe in from the right edge, or tap the panel button at the top right, for ${tabs}.`
      : `${tabs} are tabs on the right. More adds the map, wiki and other pages, and the panel button at the top of the chat folds it away.`],
    ['tabs', side && !more, ui.nlSide !== v._tipSide0, 'swap', 'Swipe between the tabs', `Swipe left and right to move between ${tabs}. Swipe in from the far left edge to go back to the chat.`],
    ['more', more, false, 'left', 'Swipe right to step back', `A swipe to the right in the middle of the page backs up a step, and ends on the tab you came from. The far left edge still goes straight to the chat.`],
    ['world', ui.tab === 'world' && page.includes('nl-seg'), false, 'newsL', 'News lives here now', `Tap News at the top${ph ? ', or swipe left,' : ''} to read the papers.`],
    ['hero', !gm && ui.tab === 'hero' && page.includes('nl-seg') && !(ph && ui.heroInv), false, 'bag', 'Inventory lives here now', `Tap Inventory at the top${ph ? ', or swipe left,' : ''} to see what you carry.`],
  ]; };
/* doing the thing is as good as Got it: the tip for a place is done once you have been where it points */
function tipAuto(v){
  const ui = v.ui, ph = v.dev === 'phone', s = tipSeen(v), side = ph && N.sideOpen(v);
  if (v._tipSide0 === undefined) v._tipSide0 = ui.nlSide;
  if (ui.sheet === 'actions') nl.tipDone(v, 'actions');
  if (ui.sceneBig) nl.tipDone(v, 'scene');
  if (side) nl.tipDone(v, 'panel');
  if (ui.nlSide !== v._tipSide0 && (side || !ph) && !nl.sideMoreOn(v)) { if (ph) nl.tipDone(v, 'tabs'); else nl.tipDone(v, 'panel'); }
  if (side && nl.sideMoreOn(v)) v._tipMore = true; else if (v._tipMore) { v._tipMore = false; if (side) nl.tipDone(v, 'more'); }
  if (ui.tab === 'news') nl.tipDone(v, 'world');
  if (ui.tab === 'inv' || (ui.tab === 'hero' && ui.heroInv)) nl.tipDone(v, 'hero');
  return s;
}
nl.tipHtml = (v, page) => {
  const ui = v.ui; if (v.peek || !N.nlOn(v)) return '';
  const s = tipAuto(v); if (ui.sheet || ui.pop || ui.shelf || ui.figs) return '';
  const t = TIPS(v, page).find(x => x[1] && !s.has(x[0])); if (!t) return '';
  return `<aside class="nl-tip" role="status" data-tip="${t[0]}"><span class="nl-tip-ic">${t[3] ? IC(t[3]) : nl.PANEL}</span><div><b>${esc(t[4])}</b><p>${esc(t[5])}</p></div><button type="button" data-a="nlTip" data-v="${t[0]}">Got it</button></aside>`;
};

/* ---------- Jake's first-time tour of the Black & White theme on the layout he knows (N.nlTourOk) ----------
   remembered on the device, one mark for phones and one for computers, so each shows it once */
const TKEY = v => 'norne-nltour-' + (v.dev === 'phone' ? 'phone' : 'desktop');
nl.tourDone = v => { try { return localStorage.getItem(TKEY(v)) === '1'; } catch(e) { return false; } };
nl.tourEnd = v => { try { localStorage.setItem(TKEY(v), '1'); } catch(e) {} };
nl.tourTitle = () => 'The new look';
nl.tourSteps = () => [
    ['image', 'Same layout, new look', 'Every button and panel is where it was. Only the look changed: black or white pages, plain shapes, and colour only where it means something.'],
    ['gear', 'Colours and the way back', 'Blue means tap here, green means happening now, red means harm or delete. You can pick another colour pair under Theme in your Profile, or pick another theme there at any time.'],
  ];
nl.tour = v => { const steps = nl.tourSteps(v), i = Math.min(v.ui.tourStep || 0, steps.length - 1), [ic, h, t] = steps[i], last = i === steps.length - 1;
  return {body:`<div class="nl-tour"><span class="nl-tour-ic">${ic ? IC(ic) : nl.PANEL}</span><h3>${esc(h)}</h3><p>${esc(t)}</p>
      <div class="nl-tour-dots" aria-label="Step ${i + 1} of ${steps.length}">${steps.map((_, k) => `<i${k === i ? ' class="on"' : ''}></i>`).join('')}</div></div>`,
    foot:`${i ? `<button type="button" class="btn ghost" data-a="nlTour" data-v="back">Back</button>` : `<button type="button" class="btn ghost" data-a="nlTour" data-v="end">Skip</button>`}<button type="button" class="btn primary" style="flex:1" data-a="nlTour" data-v="next">${last ? 'Done' : 'Next'}</button>`}; };

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
