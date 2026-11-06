/* Norne: the controller. The screen is one "view" (who is looking, on what device); actions change N.G
   and sync.js writes the changed parts to Firestore a moment later. */
(function(){
const N = window.N, {clamp, uid, sgn, ladderWord, IC} = N;
const G = () => N.G;
const isGM = v => v.role === 'gm';
const views = N.views = [];

N.now = () => { const ms = G().msgs; const last = ms.length ? ms[ms.length - 1].t : 0; return Math.max(Date.now(), last + 1); };
/* messages the GM can rewrite: anything typed, not rolls, scenes or cards */
N.msgEditable = m => ['rp','ooc','meta','note'].includes(m.kind) && typeof m.text === 'string';
/* the GM can edit any typed message, a player only their own */
N.canEdit = (v, m) => N.msgEditable(m) && (isGM(v) || m.by === v.role);
N.msgWho = m => m.kind === 'roll' ? m.roll.who : m.kind === 'rp' && !N.metaRp(m) ? N.speakerObj(m).name : N.msgPerson(m).name;
/* messages anyone can react to or reply to: not scene changes, fight cards or small grey lines */
/* a pasted GIF link: any https picture address */
N.gifLinkOk = u => /^https:\/\/\S+$/i.test(String(u || '').trim());
N.msgSocial = m => !['scene','fight','combat'].includes(m.kind) && !(m.kind === 'sys' && !m.res);
N.emoName = s => String(s || '').trim().toLowerCase().replace(/^:+|:+$/g, '').replace(/\s+/g, '_').replace(/[^\w-]/g, '').slice(0, 32);
N.msgColor = m => (m.kind === 'rp' && !N.metaRp(m) ? N.speakerObj(m).color : m.kind === 'roll' ? 'var(--ink-2)' : N.msgPerson(m).color) || 'var(--ink-2)';
/* a one-line taste of a message, for the line above a reply */
N.msgSnip = m => {
  if (m.kind === 'roll') return `${m.roll.skill} roll · ${sgn(N.rollTotal(m.roll))} ${ladderWord(N.rollTotal(m.roll))}`;
  if (m.kind === 'sys' && m.res) return m.res.title || 'Turn order';
  if (m.kind === 'news') return 'News: ' + m.text;
  if (m.kind === 'gif') return 'GIF';
  if (m.kind === 'pic') return m.text ? 'Picture: ' + m.text : 'Picture';
  const x = N.plainText(m.text || '').replace(/\s+/g, ' ').trim();
  return x.length > 90 ? x.slice(0, 90) + '…' : x;
};
/* what Copy puts on the clipboard: typed text as written, a GIF's link, otherwise the one-line summary */
N.msgCopyText = m => m.kind === 'gif' ? (m.gif?.u || '') : m.kind === 'pic' ? (m.text || '') : (m.text && m.kind !== 'roll' && m.kind !== 'sys' ? String(m.text) : N.msgSnip(m));
/* on a computer Enter sends and Shift+Enter starts a new line; on a phone Return starts a new line and the arrow sends */
const TOUCH = matchMedia('(hover: none) and (pointer: coarse)');
N.enterSends = () => !TOUCH.matches;
const push = N.push = o => { const m = Object.assign({id:uid('m'), t:N.now(), as:''}, o);
  /* automatic notes (new card, inventory, news, shared wiki) skip a private chat the GM hasn't opened */
  if (typeof m.ch === 'string' && m.ch.startsWith('dm-') && !N.dmOn(m.ch.slice(3))) return m;
  G().msgs.push(m); return m; };
/* a small grey line in the chat; players write their own (the rules only let them post as themselves) */
const sys = N.sys = (text, ch='table') => push({ch, kind:'sys', by:G().role, text});
/* a line about the fight goes to the chat the fight lives in */
const fsys = text => Object.assign(sys(text, N.fightCh()), {fight:true});
/* tell the players who can see something: in Everyone when it's for all, otherwise in each one's chat with the GM */
const tell = (x, kind, text, only) => { const a = N.audOf(x, kind); if (a === 'gm') return; if (a === '*' && !only) { sys(text); return; } for (const s of only || a) if (G().P[s]) sys(text, 'dm-' + s); };

const newUi = N.newUi = role => ({tab:'chat', ch:'table', sheet:null, sheetArg:null, pop:null, toast:null, mode:'ooc', voice:'Narrator', draft:'', sceneMin:false, folded:new Map(), fresh:null,
  fightPane:'fight', fightOpen:true, watching:false, cbTool:'move', tokSel:null, targeting:null, placing:null, zoneSel:null,
  mapId:null, mapType:'all', mapQ:'', pinSel:null, mapEdit:false, addPin:false, mapT:null,
  wikiQ:'', wikiCat:null, wikiSel:null, paper:null, newsEdit:null, newsSel:null, charSel:null, castSeg:'players', castSel:null, npcQ:'', npcDir:null,
  roll:null, sd:null, pd:null, nd:null, wd:null, exp:null, cbAsp:'', cbAspFree:0, cbAspOn:null});

/* ---------------- mount + render ---------------- */
N.mount = function(root, o){
  const v = {id:'v' + Math.random().toString(36).slice(2,6), root, role:o.role, dev:o.dev, theme:o.theme || 'night', style:N.styleOk(o.style), fz:N.fzOk(o.fz), ui:newUi(o.role)};
  try { v.vg = localStorage.getItem('norne-vg') !== '0'; v.dp = localStorage.getItem('norne-dp') !== '0'; } catch(e) { v.vg = v.dp = true; }
  try { const r = localStorage.getItem('norne-rail'); if (r) v.ui.rail = r === '1'; } catch(e) {}
  try { for (const k of ['railW','railWc','rcH','rcHc','shelfW']) { const n = +localStorage.getItem('norne-' + k.toLowerCase()); if (n) v.ui[k] = n; } v.ui.recentOff = localStorage.getItem('norne-recent') === '0'; for (const k of ['railOff','railOffc','shelfOff']) v.ui[k] = localStorage.getItem('norne-' + k.toLowerCase()) === '1'; } catch(e) {}
  views.push(v); bind(v); render(v);
  return v;
};

/* ---------------- text size ----------------
   The stylesheets and the inline styles give font sizes in px. The first time a device picks a size other than Normal,
   every px font size and line height in the app's own stylesheets is rewritten once to calc(<px> * var(--fz,1)),
   so changing the size afterwards only changes --fz on the app. On Normal nothing is touched. */
const FZ_PX = /(\d*\.?\d+)px/g, fzCalc = s => s.replace(FZ_PX, 'calc($1px * var(--fz,1))');
function fzDecl(st){
  for (const k of ['font', 'font-size', 'line-height']) {
    const val = st.getPropertyValue(k);
    if (!val || !val.includes('px') || val.includes('--fz')) continue;
    st.setProperty(k, fzCalc(val), st.getPropertyPriority(k));
    if (k === 'font') break;
  }
}
let fzSheets = false;
function fzSet(v){
  const k = N.fzK(v.fz);
  if (k !== 1 && !fzSheets) {
    fzSheets = true;
    const walk = rules => { for (const r of rules) { if (r.cssRules) walk(r.cssRules); if (r.style) fzDecl(r.style); } };
    for (const sh of document.styleSheets) { let rs; try { rs = sh.cssRules; } catch(e) { continue; } walk(rs); }
  }
  v.root.dataset.fz = v.fz;
  v.root.style.setProperty('--fz', k);
}
/* inline style="font:…px" in the markup gets the same treatment after each draw */
const fzInline = v => { if (fzSheets) v.root.querySelectorAll('[style*="px"]').forEach(e => fzDecl(e.style)); };

const HS = '.hscroll,.who-row,.fight-order,.chips,.ladder-chips,.party-row,.thumbs';
/* desktop: a sideways row that doesn't fit (the character chips) gets ‹ › arrows at its ends, shown only while there is more that way */
function hsArrows(root){
  root.querySelectorAll('.hsw').forEach(w => {
    const r = w.querySelector(HS); if (!r) return;
    const max = r.scrollWidth - r.clientWidth;
    w.classList.toggle('can-l', r.scrollLeft > 2);
    w.classList.toggle('can-r', r.scrollLeft < max - 2);
  });
}
const hsEl = t => { const r = t.closest?.(HS); return r && r.scrollWidth > r.clientWidth + 1 ? r : null; };
function render(v){
  const root = v.root;
  if (!root.isConnected) return;
  if (swBusy(v)) { v._later = true; return; }
  root.dataset.theme = v.theme; root.dataset.style = v.style; root.dataset.dev = v.dev; root.dataset.role = v.role || '';
  /* shading + depth: on by default, strong at night and soft by day (css/vignette.css, css/depth.css) */
  { const k = v.theme === 'day' ? 'soft' : 'strong'; if (v.vg === false) delete root.dataset.vg; else root.dataset.vg = k; if (v.dp === false) delete root.dataset.depth; else root.dataset.depth = k; }
  fzSet(v);
  if (N.gated || !v.role) { root.innerHTML = N.gateHtml(N.gated || '<p>Opening the campaign…</p>'); fzInline(v); return; }
  /* a chat this person can't see (a deleted group, Everyone for someone in a party) falls back to their first chat */
  { const chs = N.channelsFor(v.role); if (v.ui.ch !== 'gm' && !chs.includes(v.ui.ch) && !(v.role === 'gm' && v.ui.ch === N.fightCh())) v.ui.ch = chs[0]; }
  const sk = {};
  root.querySelectorAll('[data-sk]').forEach(e => { sk[e.dataset.sk] = {t:e.scrollTop, l:e.scrollLeft, bottom:e.scrollHeight - e.scrollTop - e.clientHeight < 60}; });
  const hs = [...root.querySelectorAll(HS)].map(e => e.scrollLeft);
  const ae = document.activeElement; let focus = null;
  if (ae && root.contains(ae) && ae.id) focus = {id:ae.id, s:ae.selectionStart, e:ae.selectionEnd};
  markSeen(v);
  focusFight(v);
  /* a sheet that was already open stays put instead of sliding in again on every redraw */
  const still = v.ui.sheet && v._sheet === v.ui.sheet + ':' + v.ui.sheetArg;
  root.innerHTML = N.appHtml(v);
  fzInline(v);
  if (still) root.querySelectorAll('.sheet,.scrim').forEach(e => e.classList.add('still'));
  v._sheet = v.ui.sheet ? v.ui.sheet + ':' + v.ui.sheetArg : null;
  /* so does the phone's chat list (and one pulled out by a swipe is already in place) */
  if (v.ui.shelf && v._shelf) root.querySelectorAll('.shelf.drawer,.shelf-scrim').forEach(e => e.classList.add('still'));
  v._shelf = !!(v.ui.shelf && root.querySelector('.shelf.drawer'));
  /* the same goes for a fighter's card on the desktop board: new chat lines must not make it slide in again */
  if (v.ui.tokSel && v._tokSel === v.ui.tokSel) root.querySelectorAll('.tokpanel').forEach(e => e.classList.add('still'));
  v._tokSel = root.querySelector('.tokpanel') ? v.ui.tokSel : null;
  /* and an open dropdown (maps, Speak as, emoji, a message's menu): pictures loading in it redraw the page, which must not pop it in again */
  const pk = v.ui.pop ? [v.ui.pop.type, v.ui.pop.mid || '', v.ui.pop.x, v.ui.pop.y, !!v.ui.pop.up].join(':') : null;
  if (pk && v._pop === pk) root.querySelectorAll('.pop').forEach(e => e.classList.add('still'));
  v._pop = pk && root.querySelector('.pop') ? pk : null;
  root.querySelectorAll('[data-sk]').forEach(e => {
    const s = sk[e.dataset.sk];
    if (e.dataset.bottom && (!s || s.bottom || v.ui.stick)) e.scrollTop = e.scrollHeight;
    else if (s) { e.scrollTop = s.t; e.scrollLeft = s.l; }
  });
  [...root.querySelectorAll(HS)].forEach((e,i) => { if (hs[i]) e.scrollLeft = hs[i]; });
  v.ui.stick = false;
  if (focus) { const f = root.querySelector('#' + CSS.escape(focus.id)); if (f) { f.focus({preventScroll:true}); try { if (focus.s != null) f.setSelectionRange(focus.s, focus.e); } catch(e){} } }
  const ta = root.querySelector('.composer textarea'); if (ta) grow(ta);
  hsArrows(root);
  if (v.ui.tab === 'map') applyMap(v);
  if (v.ui.fresh) setTimeout(() => { v.ui.fresh = null; }, 900);
  if (N.onRender) N.onRender(v);
  syncBack();
}
N.render = render;
const renderAll = N.renderAll = () => views.forEach(render);
function grow(ta){ ta.style.height = 'auto'; if (ta.value) ta.style.height = Math.min(ta.scrollHeight, 140) + 'px'; }

function chatVisible(v){
  if (v.ui.tab !== 'chat' || document.hidden) return false;
  if (N.fightAvail(v)) { if (v.dev === 'phone' && v.ui.fightPane === 'fight') return false; if (v.dev === 'desktop' && v.ui.fightOpen && G().combat.state === 'setup') return false; }
  return true;
}
function markSeen(v){
  const g = G(), seen = g.seen[v.role];
  if (!seen || !chatVisible(v)) return;
  let t = 0; for (const m of g.msgs) if (m.ch === v.ui.ch && m.t > t) t = m.t;
  if (t > (seen[v.ui.ch] || 0)) seen[v.ui.ch] = t;
}
document.addEventListener('visibilitychange', () => { if (!document.hidden) renderAll(); });
/* a page the browser brings back from its back/forward memory counts as a fresh load: talk starts out of character again */
window.addEventListener('pageshow', e => { if (!e.persisted) return; for (const v of views) v.ui.mode = 'ooc'; renderAll(); });

/* ---------------- toasts ---------------- */
function toast(v, text, undo){
  v.ui.toast = {text, undo};
  clearTimeout(v._tt);
  v._tt = setTimeout(() => { v.ui.toast = null; render(v); }, undo ? 5000 : 3200);
}
N.toast = toast;

const local = (v, cx, cy) => { const r = v.root.getBoundingClientRect(); return {x:cx - r.left, y:cy - r.top, s:1}; };

/* ---------------- binding ---------------- */
function bind(v){
  const root = v.root;
  /* the speak-as picker must not close the phone keyboard: taps on it never take focus from the message box */
  const KB = '.composer .voice,.composer .emob,.composer .replying button,.pop .opt[data-a="voice"],.pop .emo,.scrim[data-a="closePop"]';
  const typing = () => document.activeElement && document.activeElement.matches('.composer textarea');
  root.addEventListener('pointerdown', e => { v.kb = typing() && !!e.target.closest(KB); });
  root.addEventListener('mousedown', e => { if (e.target.closest(KB) && typing()) e.preventDefault(); });
  /* iPhone Safari moves focus after touchend, so a plain tap there is turned into the click by hand (a drag still scrolls the list) */
  let kt = null;
  root.addEventListener('touchstart', e => { const t = e.touches[0]; kt = e.touches.length === 1 && e.target.closest(KB) ? {x:t.clientX, y:t.clientY} : null; }, {passive:true});
  root.addEventListener('touchend', e => {
    const k = kt, t = e.changedTouches[0], el = e.target.closest(KB); kt = null;
    if (!k || !el || !typing() || !e.cancelable || Math.hypot(t.clientX - k.x, t.clientY - k.y) > 10) return;
    e.preventDefault(); v.kb = true; el.click();
  });
  /* desktop: drag a line between panels to share the room (chat list | page, main panel | side panel, top | bottom of the side panel);
     double-click a line puts it back */
  const GRIPS = {
    railgrip:{box:g => g.closest('.page'), key:b => b.dataset.wk || 'railW', css:'--railw', size:(r, ev) => Math.min(r.width - 380, Math.max(260, r.right - ev.clientX))},
    rowgrip:{box:g => g.closest('.rail'), key:b => b.closest('.page').dataset.hk || 'rcH', css:'--rch', size:(r, ev) => Math.min(r.height - 140, Math.max(120, r.bottom - ev.clientY))},
    shelfgrip:{box:g => g.closest('.shelf'), key:() => 'shelfW', css:'--shelfw', host:b => b.closest('.shell'), size:(r, ev) => Math.min(420, Math.max(190, ev.clientX - r.left))}
  };
  const gripOf = t => { for (const c in GRIPS) { const g = t.closest('.' + c); if (g) return [g, GRIPS[c]]; } return []; };
  root.addEventListener('pointerdown', e => {
    const [grip, G2] = gripOf(e.target), box = grip && G2.box(grip);
    if (!box || e.button !== 0) return;
    e.preventDefault(); grip.setPointerCapture(e.pointerId);
    const page = grip.closest('.page') || grip.closest('.shell'); page.classList.add('resizing'); grip.classList.add('on');
    const r = box.getBoundingClientRect(), k = G2.key(box), host = G2.host ? G2.host(box) : box;
    const move = ev => { v.ui[k] = Math.round(G2.size(r, ev)); host.style.setProperty(G2.css, v.ui[k] + 'px'); };
    const up = () => { grip.removeEventListener('pointermove', move); page.classList.remove('resizing'); grip.classList.remove('on'); try { localStorage.setItem('norne-' + k.toLowerCase(), v.ui[k]); } catch(err) {} };
    grip.addEventListener('pointermove', move); grip.addEventListener('pointerup', up, {once:true}); grip.addEventListener('pointercancel', up, {once:true});
  });
  root.addEventListener('dblclick', e => {
    const [grip, G2] = gripOf(e.target), box = grip && G2.box(grip); if (!box) return;
    const k = G2.key(box); v.ui[k] = null; try { localStorage.removeItem('norne-' + k.toLowerCase()); } catch(err) {} render(v);
  });
  /* long-press a message on a phone to react, reply or (GM) edit it; a right-click does the same on a computer */
  let lp = null;
  root.addEventListener('pointerdown', () => { if (!lp) v.lpHold = false; }, true);
  const lpOpen = id => { if (v.ui.pop?.mid === id || !v.root.querySelector(`[data-mid="${CSS.escape(id)}"]`)) return; v.ui.sheet = null; act(v, 'msgMenu', {dataset:{v:id, lp:1}}); render(v); };
  root.addEventListener('touchstart', e => {
    clearTimeout(lp?.tm); lp = null;
    const w = e.touches.length === 1 && e.target.closest('.msgs [data-mid]');
    if (!w || e.target.closest('button,a,input,textarea,.roll .rh')) return;
    const t = e.touches[0], id = w.dataset.mid;
    lp = {x:t.clientX, y:t.clientY, id, tm:setTimeout(() => { lp.fired = true; v.lpHold = true; try { getSelection()?.removeAllRanges(); } catch(err) {} try { navigator.vibrate?.(12); } catch(err) {} lpOpen(id); }, 480)};
  }, {passive:true});
  root.addEventListener('touchmove', e => { if (!lp || lp.fired) return; const t = e.touches[0]; if (Math.hypot(t.clientX - lp.x, t.clientY - lp.y) > 10) { clearTimeout(lp.tm); lp = null; } }, {passive:true});
  root.addEventListener('touchend', e => { if (!lp) return; clearTimeout(lp.tm); if (lp.fired && e.cancelable) e.preventDefault(); lp = null; });
  root.addEventListener('touchcancel', () => { if (lp) { clearTimeout(lp.tm); lp = null; } });
  root.addEventListener('selectstart', e => { const t = e.target.nodeType === 1 ? e.target : e.target.parentElement; if (TOUCH.matches && !t?.closest('input,textarea,[contenteditable]')) e.preventDefault(); });
  root.addEventListener('contextmenu', e => {
    const w = e.target.closest('.msgs [data-mid]'); if (!w || e.target.closest('textarea,input')) return;
    e.preventDefault(); if (lp?.fired || v.ui.pop?.mid === w.dataset.mid) return; lpOpen(w.dataset.mid);
  });
  root.addEventListener('click', e => {
    if (v.suppress) { v.suppress = false; e.preventDefault(); e.stopPropagation(); return; }
    /* lifting the finger after a long-press must not also tap the menu that opened under it
       (the pressed message was redrawn, so its touchend never reaches us) */
    if (v.lpHold) { v.lpHold = false; e.preventDefault(); return; }
    const ha = e.target.closest('[data-hs]');
    if (ha) { const r = ha.parentElement.querySelector(HS); if (r) r.scrollBy({left:+ha.dataset.hs * Math.max(120, r.clientWidth * .7), behavior:'smooth'}); return; }
    const a = e.target.closest('[data-a]');
    if (a && root.contains(a)) {
      if (a.disabled) return; e.preventDefault();
      /* phones, GM: picking anything in the pulled-up fight controls drops them back down to the board and results */
      if (v.ui.sheet === 'gmFight' && a.closest('.gmfs')) v.ui.sheet = null;
      act(v, a.dataset.a, a, e);
      if (v.kb) { v.kb = false; const ta = root.querySelector('.composer textarea'); if (ta && !typing()) ta.focus({preventScroll:true}); }
      return;
    }
    const tok = e.target.closest('[data-tok]'); if (tok) { tokClick(v, tok.dataset.tok); return; }
    const pin = e.target.closest('[data-pin]'); if (pin && !(isGM(v) && v.ui.mapEdit) && pinGo(v, pin.dataset.pin)) return;
    if (pin) { v.ui.pinSel = v.ui.pinSel === pin.dataset.pin ? null : pin.dataset.pin; render(v); return; }
    const zone = e.target.closest('[data-zone]'); if (zone) { zoneClick(v, zone.dataset.zone); return; }
    if (e.target.closest('[data-mapcv]') && v.ui.addPin) { addPinAt(v, e); return; }
    if (e.target.closest('[data-board]') && (v.ui.tokSel || v.ui.zoneSel)) { v.ui.tokSel = null; v.ui.zoneSel = null; render(v); }
  });
  root.addEventListener('input', e => { const el = e.target; if (el.dataset.i) input(v, el); });
  root.addEventListener('focusin', e => { const el = e.target; if (el.id && el.matches('textarea, input.inp:not([type]), input.inp[type=text]') && el.dataset.i !== 'draft') v._fld = el.id; });
  root.addEventListener('change', e => { const el = e.target; if (el.dataset.i) change(v, el); });
  root.addEventListener('keydown', e => {
    if (e.key === 'Enter' && !e.shiftKey && !e.isComposing && e.target.dataset.i === 'draft' && N.enterSends()) { e.preventDefault(); send(v); }
    if (e.key === 'Enter' && !e.isComposing && e.target.dataset.i === 'fcDraft') { e.preventDefault(); fcSend(v); }
    if (e.key === 'Enter' && e.target.dataset.i === 'gold') { e.preventDefault(); e.target.blur(); }
    if (e.key === 'Escape') { if (v.ui.shelf) v.ui.shelf = false; else if (v.ui.pop) v.ui.pop = null; else if (v.ui.sheet) v.ui.sheet = null; else if (v.ui.reply) v.ui.reply = null; else { v.ui.targeting = null; v.ui.placing = null; v.ui.tokSel = null; } render(v); }
  });
  root.addEventListener('pointerdown', e => { hsDrag(v, e); down(v, e); });
  /* mouse wheel over a sideways row that doesn't fit scrolls it sideways (until its end, then the page scrolls as usual) */
  root.addEventListener('wheel', e => {
    if (e.ctrlKey || TOUCH.matches) return;
    const r = hsEl(e.target); if (!r || Math.abs(e.deltaX) > Math.abs(e.deltaY)) return;
    const d = e.deltaMode === 1 ? e.deltaY * 16 : e.deltaY, max = r.scrollWidth - r.clientWidth;
    if ((d < 0 && r.scrollLeft <= 0) || (d > 0 && r.scrollLeft >= max - 1)) return;
    e.preventDefault(); r.scrollLeft += d;
  }, {passive:false});
  root.addEventListener('scroll', e => { if (e.target.matches?.(HS) && e.target.parentElement?.classList.contains('hsw')) hsArrows(root); }, true);
  /* iPhone Safari zooms the whole page on a pinch unless its own gesture events are stopped over the map */
  root.addEventListener('gesturestart', e => { if (e.target.closest('[data-mapcv]')) e.preventDefault(); });
  root.addEventListener('wheel', e => { const cv = e.target.closest('[data-mapcv]'); if (cv) { e.preventDefault(); const r = cv.getBoundingClientRect(); mapWheel(v, Math.exp(-clamp(e.deltaMode === 1 ? e.deltaY * 16 : e.deltaY, -120, 120) * (e.ctrlKey ? .01 : .0018)), e.clientX - r.left, e.clientY - r.top); } }, {passive:false});
  /* phones: swipes that follow the finger (see "swipes" below).
     In from the left edge, or across a page that has its own back arrow: one step back. At the top of a chat: the chat list,
     and pushing the list left puts it away. With a fight in this chat, swipe left for combat and right for roleplay. */
  /* things that are dragged themselves (the map, the fight board, the picture framer) never start a swipe, not even at the edge */
  const DRAGS = 'input,textarea,select,.tok,[data-rs],[data-zl],[data-mapcv],.fr-stage';
  const NOSWIPE = HS + ',' + DRAGS + ',.pop,.sheet';
  let sw = null;
  root.addEventListener('touchstart', e => {
    if (swBusy(v)) return;
    sw = null;
    const ui = v.ui, t = e.touches[0];
    if (v.dev !== 'phone' || e.touches.length > 1) return;
    const fa = ui.tab === 'chat' && N.fightAvail(v), inFight = fa && ui.fightPane === 'fight';
    const s = {x:t.clientX, y:t.clientY, pts:[[t.clientX, e.timeStamp]]};
    if (ui.shelf) { if (e.target.closest('.shelf,.shelf-scrim')) sw = Object.assign(s, {k:'shelf'}); return; }
    if (t.clientX < SW_EDGE && !inFight && !e.target.closest(DRAGS)) { sw = Object.assign(s, {k:'back', edge:true}); return; }
    if (ui.sheet || ui.pop || e.target.closest(NOSWIPE)) return;
    if (!fa) { if (ui.tab !== 'map' && pageBack(v) && !hScroll(e.target, root)) sw = Object.assign(s, {k:'back'}); return; }
    /* the GM drawing zones drags on the board, so the board doesn't swipe then */
    if (inFight && isGM(v) && ui.cbTool === 'zone' && e.target.closest('[data-board]')) return;
    sw = Object.assign(s, {k:'pane'});
  }, {passive:true});
  /* the first few pixels decide: mostly sideways takes the swipe (and stops the list scrolling), otherwise it's a scroll */
  root.addEventListener('touchmove', e => {
    if (!sw) return;
    const t = e.touches[0], dx = t.clientX - sw.x, dy = t.clientY - sw.y;
    if (!sw.on) {
      if (Math.abs(dx) < 10 && Math.abs(dy) < 10) return;
      if (e.touches.length > 1 || Math.abs(dx) < Math.abs(dy) * (sw.edge ? .9 : 1.5) || v.suppress || !swStart(v, sw, dx)) { sw = null; return; }
      sw.on = true; v.swiping = performance.now();
    }
    if (e.cancelable) e.preventDefault();
    sw.pts.push([t.clientX, e.timeStamp]); if (sw.pts.length > 6) sw.pts.shift();
    sw.draw(sw.g = sw.at(dx));
  }, {passive:false});
  root.addEventListener('touchend', e => {
    const s = sw; sw = null;
    if (!s?.on) return;
    const t = e.changedTouches[0]; s.pts.push([t.clientX, e.timeStamp]);
    /* how fast the finger was going at the end, in px per ms, towards the goal */
    const a = s.pts.find(p => e.timeStamp - p[1] < 90) || s.pts[0], dt = Math.max(1, e.timeStamp - a[1]);
    const vel = (t.clientX - a[0]) / dt * s.dir, g = s.g = s.at(t.clientX - s.x);
    swEnd(v, s, vel > -.2 && (g > .4 || (vel > .3 && g > .04)), vel);
  });
  root.addEventListener('touchcancel', () => { const s = sw; sw = null; if (s?.on) swEnd(v, s, false, 0); });
}

/* ---------------- swipes ----------------
   A swipe drags something with the finger and, when let go, glides on to the end (or back) from the speed it had.
   Going back: the page slides off to the right and the page it goes back to shows underneath, a little behind, the way
   an iPhone app does it. Popups and sheets slide away alone; the chat list slides in and out by its edge. */
const SW_EDGE = 32;
/* while a swipe is under way, redraws wait for it to end (a stuck one stops counting after a few seconds) */
const swBusy = v => !!v.swiping && performance.now() - v.swiping < 3000;
/* a wide table or picture row that scrolls sideways keeps its own swipe */
const hScroll = (el, root) => { for (let e = el; e && e !== root; e = e.parentElement) if (e.scrollWidth > e.clientWidth + 1 && /(auto|scroll)/.test(getComputedStyle(e).overflowX)) return true; return false; };
const pageBack = v => v.root.querySelector('.page [data-a][aria-label^="Back"]');
function swStart(v, s, dx){
  const ui = v.ui, root = v.root;
  s.W = root.clientWidth; s.dir = dx < 0 ? -1 : 1;
  if (s.k === 'shelf') {
    const d = root.querySelector('.shelf.drawer'); if (dx > 0 || !d) return false;
    return swDrawer(v, s, d, root.querySelector('.shelf-scrim'), true);
  }
  if (s.k === 'pane') {
    const to = dx < 0 ? 'fight' : 'chat'; if (ui.fightPane === to) return false;
    s.go = () => { ui.fightPane = to; ui.targeting = null; ui.stick = to === 'chat'; render(v); };
    return swPage(v, s, fv => { fv.ui.fightPane = to; fv.ui.targeting = null; });
  }
  if (dx < 0) return false;
  const lay = ui.pop ? '.pop' : ui.sheet ? '.sheet' : ui.tab === 'map' && ui.pinSel ? '.pincard' : null;
  if (lay) {
    const el = root.querySelector(lay); if (!el) return false;
    s.go = () => goBack(v);
    return swLayer(v, s, el, ui.pop || ui.sheet ? root.querySelector('.scrim:not(.shelf-scrim)') : null);
  }
  if (!backStep(v)) {
    /* nothing to go back to: at the top of a chat this pulls out the chat list */
    if (ui.tab !== 'chat' || !N.shelfHtml) return false;
    root.insertAdjacentHTML('beforeend', `<div class="scrim shelf-scrim still swtmp" data-a="shelf"></div>${N.shelfHtml(v)}`);
    const d = root.lastElementChild; d.classList.add('swtmp'); fzInline(v);
    return swDrawer(v, s, d, d.previousElementSibling, false);
  }
  s.go = () => goBack(v);
  return swPage(v, s, fv => { const f = backStep(fv); fv.root = document.createElement('div'); if (f) f(); });
}
/* the page underneath: the app drawn for a copy of this view with the step already taken */
function swPage(v, s, take){
  const shell = v.root.querySelector('.shell'), pg = shell && shell.querySelector(':scope > .page'); if (!pg) return false;
  const peek = document.createElement('div'); peek.className = 'swpeek'; peek.setAttribute('aria-hidden', 'true'); peek.inert = true;
  peek.style.cssText = `left:${pg.offsetLeft}px;top:${pg.offsetTop}px;width:${pg.offsetWidth}px;height:${pg.offsetHeight}px`;
  try {
    const fv = Object.assign({}, v, {ui:Object.assign({}, v.ui, {folded:new Map(v.ui.folded), wikiPrev:[...(v.ui.wikiPrev || [])], toast:null})});
    take(fv);
    const tpl = document.createElement('template'); tpl.innerHTML = N.appHtml(fv);
    const np = tpl.content.querySelector('.shell > .page'); if (np) peek.appendChild(np);
  } catch(err) { console.warn('swipe preview', err); }
  peek.insertAdjacentHTML('beforeend', '<i class="swdim"></i>');
  shell.insertBefore(peek, pg);
  if (fzSheets) peek.querySelectorAll('[style*="px"]').forEach(e => fzDecl(e.style));
  /* lists start where the redraw will put them: chats on their newest line, the rest where they are now */
  peek.querySelectorAll('[data-sk]').forEach(e => { const o = pg.querySelector(`[data-sk="${CSS.escape(e.dataset.sk)}"]`); if (e.dataset.bottom) e.scrollTop = e.scrollHeight; else if (o) e.scrollTop = o.scrollTop; });
  /* the moving page carries the sky behind it, so the page underneath doesn't show through */
  const app = getComputedStyle(v.root), stars = v.root.querySelector('.stars'), lit = stars && +getComputedStyle(stars).opacity > .05;
  const n = app.backgroundSize.split(',').length, wh = `${v.root.clientWidth}px ${v.root.clientHeight}px`;
  Object.assign(pg.style, {backgroundImage:(lit ? getComputedStyle(document.documentElement).getPropertyValue('--stars') + ',' : '') + app.backgroundImage,
    backgroundSize:(lit ? '520px 520px,' : '') + Array(n).fill(wh).join(','), backgroundRepeat:'repeat', backgroundPosition:`${-pg.offsetLeft}px ${-pg.offsetTop}px`, backgroundColor:app.backgroundColor});
  pg.classList.add('swfront');
  const dim = peek.lastElementChild;
  s.at = dx => clamp(dx * s.dir / s.W, 0, 1);
  s.draw = g => {
    pg.style.transform = `translate3d(${(g * s.W * s.dir).toFixed(1)}px,0,0)`;
    peek.style.transform = `translate3d(${((1 - g) * -s.dir * .3 * s.W).toFixed(1)}px,0,0)`;
    dim.style.opacity = (1 - g).toFixed(3);
  };
  s.back = () => { peek.remove(); pg.classList.remove('swfront'); for (const k of ['transform', 'backgroundImage', 'backgroundSize', 'backgroundRepeat', 'backgroundPosition', 'backgroundColor']) pg.style[k] = ''; };
  return true;
}
/* a popup, a sheet or a map place card slides off to the right on its own, its dimmed backdrop clearing as it goes */
function swLayer(v, s, el, scrim){
  el.classList.add('swdrag'); if (scrim) scrim.classList.add('swdrag');
  s.at = dx => clamp(dx / s.W, 0, 1);
  s.draw = g => { el.style.transform = `translate3d(${(g * s.W).toFixed(1)}px,0,0)`; el.style.opacity = (1 - g * .4).toFixed(3); if (scrim) scrim.style.opacity = (1 - g).toFixed(3); };
  s.back = () => { el.classList.remove('swdrag'); el.style.transform = el.style.opacity = ''; if (scrim) { scrim.classList.remove('swdrag'); scrim.style.opacity = ''; } };
  return true;
}
/* the chat list: pulled out by its edge from the left (open=false), or pushed back in (open=true) */
function swDrawer(v, s, d, scrim, open){
  const w = d.offsetWidth || s.W * .86;
  d.classList.add('swdrag'); if (scrim) scrim.classList.add('swdrag');
  s.dir = open ? -1 : 1;
  s.at = dx => clamp(open ? -dx / w : dx / w, 0, 1);
  s.draw = g => { const shown = open ? 1 - g : g; d.style.transform = `translate3d(${((shown - 1) * w).toFixed(1)}px,0,0)`; if (scrim) scrim.style.opacity = shown.toFixed(3); };
  s.span = w;
  if (open) { s.go = () => { v.ui.shelf = false; render(v); }; s.back = () => { d.classList.remove('swdrag'); d.style.transform = ''; if (scrim) { scrim.classList.remove('swdrag'); scrim.style.opacity = ''; } }; }
  else { s.go = () => { v.ui.shelf = true; v._shelf = true; render(v); }; s.back = () => v.root.querySelectorAll('.swtmp').forEach(e => e.remove()); }
  s.draw(0);
  return true;
}
/* let go: glide the rest of the way (or back) from the finger's speed, then make the change for real */
function swEnd(v, s, go, vel){
  v.swiping = performance.now();
  const g0 = s.g ?? 0, g1 = go ? 1 : 0, span = s.span || s.W;
  const px = Math.abs(g1 - g0) * span, speed = Math.max(Math.abs(vel), 1.1);
  const dur = matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : clamp(px / speed * 1.6, 120, 300), t0 = performance.now();
  const ease = t => 1 - Math.pow(1 - t, 3);
  const fin = () => { const later = v._later; v.swiping = 0; v._later = false; if (go) s.go(); else { s.back(); if (later) render(v); } };
  if (!dur) { fin(); return; }
  const tick = now => {
    const k = Math.min(1, (now - t0) / dur);
    s.draw(g0 + (g1 - g0) * ease(k));
    if (k < 1) requestAnimationFrame(tick); else fin();
  };
  requestAnimationFrame(tick);
}

/* ---------------- going back ----------------
   Phones step back one level at a time with a swipe in from the left edge or the Android back button:
   the chat list, a popup or sheet, a pick in the fight, the open page (wiki entry, category, news issue, cast card…),
   the fight pane, a map place. The back button alone then returns any other tab to Chat. */
/* closing the Reveal or Map settings sheet after revealing something asks the GM whether to send notes (and so pings).
   Returns true when it opened that question instead of closing. */
function askTell(v){
  const ui = v.ui, g = G(), gm = N.gmName(), items = [];
  const add = (to, text) => items.push({to, text, on:true, ok:to === '*' || (!!g.P[to] && N.dmOn(to))});
  if (ui.sheet === 'reveal' && ui.askRev?.id === ui.sheetArg) {
    const id = ui.askRev.id, c = g.chars[id], card = c || g.npcs.find(x => x.id === id), base = ui.askRev.base; ui.askRev = null;
    if (card) {
      const name = c ? c.short || c.name : card.name;
      for (const [st, l] of Object.entries((g.rev || {})[id] || {})) {
        const now = N.revKeys(card, l), was = N.revKeys(card, base[st] || []);
        if (!now.includes('name') || !now.some(k => !k.startsWith('met:') && !was.includes(k))) continue;
        add(st, was.includes('name') ? `${gm} revealed more about ${name}. Open Character to see it.` : `${gm} revealed ${name} to you. Open Character to see them.`);
      }
    }
  } else if (ui.sheet === 'mapSet' && ui.askMap?.id === ui.sheetArg) {
    const m = g.maps.find(x => x.id === ui.askMap.id), q = ui.askMap; ui.askMap = null;
    if (m) {
      const all = N.audOf(m, 'map') === '*';
      if (all && !q.wasAll) add('*', `${gm} shared the ${m.name} map.`);
      else if (!all) for (const st of N.audSeats(m, 'map').filter(s => !q.before.includes(s))) add(st, `${gm} shared the ${m.name} map with you.`);
    }
  } else if (ui.sheet === 'pinSet' && ui.askPin?.key === ui.sheetArg) {
    const [mi, pi] = ui.askPin.key.split('|'), m = g.maps.find(x => x.id === mi), p = m && m.pins.find(x => x.id === pi), q = ui.askPin; ui.askPin = null;
    if (p) {
      const mapName = m.name.replace(/ \(.*\)$/, ''), now = N.audSeats(p, 'pin').filter(s => N.audSeats(m, 'map').includes(s)), fresh = now.filter(s => !q.before.includes(s));
      const text = `${gm} revealed ${p.label} on the ${mapName} map.`;
      /* a place shown to every player of a map everyone sees goes to Everyone; otherwise each new player gets a private note */
      if (fresh.length && N.audOf(p, 'pin') === '*' && N.audOf(m, 'map') === '*' && !q.before.length) add('*', text);
      else for (const st of fresh) add(st, `${gm} revealed ${p.label} to you on the ${mapName} map.`);
    }
  }
  if (!items.length) return false;
  for (const it of items) if (!it.ok) it.on = false;
  ui.tellAsk = {items}; ui.sheet = 'tellAsk'; ui.sheetArg = null;
  return true;
}
function backStep(v, home){
  const ui = v.ui;
  if (ui.shelf) return () => { ui.shelf = false; };
  if (ui.pop) return () => { ui.pop = null; };
  if (ui.sheet === 'itemEd' || ui.sheet === 'itemGive') return () => { ui.sheet = 'items'; ui.itd = null; };
  if (ui.sheet) return () => { if (!askTell(v)) ui.sheet = null; };
  if (ui.tab === 'chat' && (ui.targeting || ui.placing)) return () => { ui.targeting = null; ui.placing = null; };
  /* any page with its own back arrow (wiki, news, cast card, inventory) goes back the way that arrow does */
  const b = v.root.querySelector('.page [data-a][aria-label^="Back"]');
  if (b) return () => act(v, b.dataset.a, b);
  if (ui.tab === 'chat' && N.fightAvail(v) && ui.fightPane === 'fight') return () => { ui.fightPane = 'chat'; ui.targeting = null; ui.slide = 'r'; ui.stick = true; };
  if (ui.tab === 'map' && ui.pinSel) return () => { ui.pinSel = null; };
  if (home && ui.tab !== 'chat') return () => { ui.tab = 'chat'; ui.stick = true; };
  return null;
}
/* iPhones have their own swipe back from the edge, which uses up the history entry below as well as firing our own swipe,
   so the second of the two within a moment is ignored (otherwise one swipe went back two steps) */
let lastBack = 0;
const backTwice = () => Date.now() - lastBack < 1000;
function goBack(v, home){
  const f = backStep(v, home); if (!f) return false;
  lastBack = Date.now();
  f(); render(v); v.ui.slide = null;
  return true;
}
/* the browser and Android's back button walk the same steps: while there is a step to go back, one extra
   history entry is kept for them to use up; when there is none it is dropped, so back leaves the app as usual */
const phoneView = () => views.find(x => x.dev === 'phone' && x.root.isConnected);
let backEntry = false, dropping = false;
/* iPhones and iPads have no back button, and their own edge swipe treats a kept entry as a page to leave
   (Jack's swipe in a wiki entry reloaded Norne into Everyone), so they get no history entries: the edge swipe above does it all */
const APPLE = /iP(hone|od|ad)/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
function syncBack(){
  const v = phoneView(); if (APPLE || !v || dropping || !v.role || N.gated) return;
  const need = !!backStep(v, true);
  if (need && !backEntry) { history.pushState({norne:'back'}, ''); backEntry = true; }
  else if (!need && backEntry && history.state?.norne === 'back') { backEntry = false; dropping = true; history.back(); }
}
window.addEventListener('popstate', () => {
  if (dropping) { dropping = false; syncBack(); return; }
  backEntry = false;
  const v = phoneView(); if (!v) return;
  if (backTwice() || !goBack(v, true)) syncBack();
});

/* ---------------- inputs ---------------- */
function input(v, el){
  const g = G(), i = el.dataset.i, k = el.dataset.k, val = el.value;
  switch (i) {
    case 'draft': v.ui.draft = val; grow(el); return;
    case 'fcDraft': v.ui.fcDraft = val; return;
    case 'ie': if (v.ui.invEdit) v.ui.invEdit[k] = val; return;
    case 'itQ': v.ui.itQ = val; render(v); return;
    case 'itd': { const d = v.ui.itd; if (!d) return; d[k] = N.ITEM_RATE.some(([x]) => x === k) ? +val || 0 : val;
      if (k === 'name') { const b = v.root.querySelector('[data-a="itSave"]'); if (b) b.disabled = !val.trim(); } return; }
    case 'itg': { const t = v.ui.itg; if (!t) return;
      if (k === 'q') { const n = val.replace(/[^0-9]/g, '').slice(0, 4); if (n !== val) el.value = n; t.q = Math.max(1, parseInt(n, 10) || 1); return; }
      t.to = val; render(v); return; }
    case 'mapQ': v.ui.mapQ = val; render(v); return;
    case 'wikiQ': v.ui.wikiQ = val; render(v); return;
    case 'npcQ': v.ui.npcQ = val; render(v); return;
    case 'voiceQ': v.ui.voiceQ = val; render(v); return;
    case 'castQ': v.ui.sd.castQ = val; render(v); return;
    case 'expFrom': case 'expTo': { const ex = v.ui.exp; if (!ex) return; ex[i === 'expFrom' ? 'from' : 'to'] = val; ex.when = !ex.from && !ex.to ? 'all' : null;
      const o = v.root.querySelector('#exOut'), w = v.root.querySelector('#exWhen'); if (o) o.value = N.buildExport(ex); if (w) w.textContent = N.cap1(N.expRangeWords(ex)) + '. Leave a box empty for no limit on that side.';
      v.root.querySelectorAll('[data-a="expWhen"]').forEach(b => b.setAttribute('aria-pressed', b.dataset.v === ex.when)); return; }
    case 'chatQ': { v.ui.cq = val; clearTimeout(v._cqT); v._cqT = setTimeout(() => { const r = v.root.querySelector(`#cqr-${v.id}`); if (r) r.innerHTML = N.chatSearchHtml(v); }, 120); return; }
    case 'gdName': { v.ui.gd.name = val; const b = v.root.querySelector('[data-a="gdSave"]'); if (b) b.disabled = !val.trim() || !v.ui.gd.seats.length || !N.groupsReady(); return; }
    case 'news': { const d = v.ui.newsEdit, n = +el.dataset.n; if (k === 'stt' || k === 'stb') d.stories[n][k === 'stt' ? 'title' : 'body'] = val; else if (k === 'cap') { if (n < 0) d.lcap = val; else d.stories[n].cap = val; } else d[k] = val; render(v); return; }
    case 'con': g.chars[el.dataset.c].cons[k] = val; return;
    case 'gold': { const t = val.replace(/[^0-9]/g, '').slice(0, 7); if (t !== val) el.value = t; return; }
    case 'cnote': { const c = g.chars[el.dataset.c]; if (c && (isGM(v) || (c.player === v.role && k !== 'invText'))) c[k] = val; return; }
    case 'cbTitle': g.combat.title = val; return;
    case 'zone': { const z = g.combat.zones.find(x => x.id === el.dataset.z); if (!z) return; z[k] = val; if (k === 'name') { const l = v.root.querySelector(`[data-zl="${z.id}"]`); if (l && l.firstChild) l.firstChild.textContent = val; } return; }
    case 'rollAsp': v.ui.roll.aspect = val; return;
    case 'rollEv': v.ui.roll.evText = val; return;
    case 'invName': v.ui.invName = val; return;
    case 'rollOther': v.ui.roll.otherName = val; return;
    /* picking a country clears the city under it, and so on down */
    case 'sdLoc': { const L = v.ui.sd.loc; L[k] = val; if (k === 'c') { L.t = ''; L.n = ''; } if (k === 't') L.n = ''; v.ui.sd.touched = true;
      if (k === 't' && val && !v.ui.sd.where.trim()) v.ui.sd.where = N.locText(N.locBuild(L)); render(v); return; }
    case 'pinTo': { const pin = N.curMap(v)?.pins.find(x => x.id === v.ui.pinSel); if (!pin) return; if (val) pin.to = val; else delete pin.to; N.renderAll(); return; }
    case 'sd': v.ui.sd[k] = val; if (k === 'title' || k === 'where') { v.ui.sd.autoTitle = false; v.ui.sd.touched = true; } if (k === 'title') render(v); return;
    case 'cbAsp': v.ui.cbAsp = val; return;
    case 'emn': if (v.ui.emoNew) { v.ui.emoNew.n = val; const n = N.emoName(val), b = v.root.querySelector('[data-a="emoSave"]'), t = v.root.querySelector('.emo-new small');
      const dup = !!n && G().emoji.some(x => x.n === n); if (b) b.disabled = !n || dup; if (t) t.textContent = !n ? 'Letters, numbers and _ only.' : dup ? `:${n}: is already taken.` : `Type :${n}: in a message, or pick it from the emoji button.`; } return;
    case 'gifQ': v.ui.gifQ = val; clearTimeout(v._gq); v._gq = setTimeout(() => gifSearch(v), 700); return;
    case 'gifUrl': { v.ui.gifUrl = val; const b = v.root.querySelector('[data-a="gifLink"]'); if (b) b.disabled = !N.gifLinkOk(val); return; }
    case 'gifKey': v.ui.gifKeyD = val; return;
    case 'boostName': v.ui.boostName = val; return;
    case 'wipeType': if (v.ui.wipe) { v.ui.wipe.typed = val; const b = v.root.querySelector('[data-a="wipeGo"]'); if (b) b.disabled = !N.wipeMatch(v.ui.wipe); } return;
    case 'med': if (v.ui.med) v.ui.med.text = val; { const b = v.root.querySelector('[data-a="msgSave"]'); if (b) b.disabled = !val.trim(); } return;
    case 'pinLabel': { const pin = N.curMap(v)?.pins.find(x => x.id === v.ui.pinSel); if (!pin) return; pin.label = val; const lab = v.root.querySelector(`[data-pin="${pin.id}"] .pl`); if (lab) lab.textContent = val; return; }
    case 'pinNote': { const pin = N.curMap(v)?.pins.find(x => x.id === v.ui.pinSel); if (pin) pin.note = val; return; }
    case 'pd': {
      const d = v.ui.pd, n = +el.dataset.n;
      if (k === 'asp') d.aspects[n] = val; else if (k === 'stn') d.stunts[n][0] = val; else if (k === 'std') d.stunts[n][1] = val; else d[k] = val;
      if (k === 'name' || k === 'hc') render(v); return;
    }
    case 'nd': {
      const d = v.ui.nd, n = +el.dataset.n;
      if (k === 'asp') d.aspects[n] = val; else if (k === 'stn') d.stunts[n][0] = val; else if (k === 'std') d.stunts[n][1] = val; else d[k] = val;
      if (k === 'name') render(v); return;
    }
    case 'wd': if (k === 'cap') { v.ui.wd.imgs[+el.dataset.n].cap = val; return; } if (k === 'ph' || k === 'pt') { v.ui.wd.parts[+el.dataset.n][k === 'ph' ? 'h' : 'text'] = val; return; } v.ui.wd[k] = val; if (k === 'title') render(v); return;
    case 'cd': v.ui.cd[+el.dataset.n].name = val; return;
    case 'mapName': { const m = G().maps.find(x => x.id === el.dataset.v); if (m) m.name = val; return; }
    case 'mapLvl': { const m = G().maps.find(x => x.id === el.dataset.v); if (!m) return; m.lvl = val; N.renderAll(); return; }
    case 'mapFolder': { const m = G().maps.find(x => x.id === el.dataset.v); if (!m) return; if (val) m.dir = val; else delete m.dir; N.renderAll(); return; }
    case 'nf': if (v.ui.nf) { v.ui.nf[k] = val; if (k === 'name') { const b = v.root.querySelector('[data-a="nfSave"]'); if (b) b.disabled = !val.trim(); } else render(v); } return;
    case 'md': if (v.ui.md) { v.ui.md[k] = val; if (k === 'name') { const b = v.root.querySelector('[data-a="mdSave"]'); if (b) b.disabled = !val.trim(); } else render(v); } return;
    case 'npcNotes': { const n = g.npcs.find(x => x.id === el.dataset.n); if (n) n[k || 'notes'] = val; return; }
    case 'npcCon': { const n = g.npcs.find(x => x.id === el.dataset.n); if (n) n.cons[k] = val; return; }
    case 'tokCon': { const t = N.tokById(el.dataset.t); if (t) { t.cons = t.cons || {mild:t.mild || ''}; t.cons[k] = val; } return; }
    case 'tokGear': { const t = N.tokById(el.dataset.t); if (!t) return; const o = t.kind === 'pc' ? g.chars[t.ref] : t; if (o) { o[k] = +val || 0; renderAll(); } return; }
  }
}
function change(v, el){
  const i = el.dataset.i, val = el.value;
  if (i === 'pdSkill' && val) { v.ui.pd.skills[val] = +el.dataset.x; render(v); }
  if (i === 'ndSkill' && val) { v.ui.nd.skills[val] = +el.dataset.x; render(v); }
  if (i === 'wd' && el.dataset.k !== 'cap') v.ui.wd[el.dataset.k] = val;
  if (i === 'cd') render(v);
  if (i === 'cdTo') v.ui.cd[+el.dataset.n].to = val;
  if (i === 'mapName') renderAll();
  if (i === 'gold' && isGM(v)) { const g = G(), o = el.dataset.c ? g.chars[el.dataset.c] : g.npcs.find(x => x.id === el.dataset.n);
    if (o) { o.gold = clamp(parseInt(val, 10) || 0, 0, N.GOLD_MAX); renderAll(); } }
  if (i === 'memName') { N.renameMember(el.dataset.v, val); toast(v, 'Name saved.'); render(v); }
  if (i === 'sdAspOn') { const a = v.ui.sd.aspects[+el.dataset.n]; if (a) { if (val) a.on = val; else delete a.on; } render(v); }
  if (i === 'invQ') { const n = parseInt(val, 10); v.ui.invQ = n > 0 ? n : 1; }
}

/* ---------------- chat ---------------- */
function send(v){
  const text = v.ui.draft.trim(); if (!text) return;
  const ch = v.ui.ch, gm = isGM(v), g = G(), c = N.charOf(v.role);
  let m;
  if (ch === 'gm') m = {kind:'note'};
  /* emoji on their own are table talk, never part of the story */
  /* Everyone is Meta only: whatever the toggle says, it goes out as the person, not their character */
  else if (v.ui.mode === 'ooc' || N.metaOnly(ch) || N.emojiOnly(text)) m = {kind:'meta'};
  else if (gm) { const n = N.npcByName(v.ui.voice); m = {kind:'rp', as:v.ui.voice}; if (n?.portrait) m.pt = n.portrait; }
  else m = {kind:'rp', as:c && c.built ? c.short : g.P[v.role].name};
  if (v.ui.reply && g.msgs.some(x => x.id === v.ui.reply && x.ch === ch)) m.re = v.ui.reply;
  push(Object.assign(m, {ch, by:v.role, text}));
  v.ui.draft = ''; v.ui.stick = true; v.ui.reply = null;
  renderAll();
  const ta = v.root.querySelector('.composer textarea'); if (ta) ta.focus({preventScroll:true});
}
N.send = send;
/* the fight's own chat: table talk that stays with the fight (fc = the fight's id) and out of the roleplay chat and exports */
function fcSend(v){
  const text = (v.ui.fcDraft || '').trim(), cb = G().combat; if (!text || cb.state !== 'live') return;
  push({ch:N.fightCh(), kind:'meta', by:v.role, text, fc:cb.id});
  v.ui.fcDraft = ''; v.ui.stick = true; renderAll();
  const el = v.root.querySelector(`#fc-${v.id}`); if (el) el.focus({preventScroll:true});
}
/* a picture from the device, kept in the message itself (players can't write the picture store), so it is scaled to
   at most 1280px and about 260 KB. Whatever is typed in the box goes with it as a caption. Posted as the person, like a GIF. */
function sendPic(v){
  N.pickImage(img => {
    const ch = v.ui.ch, u = N.shrink(img, 1280, 260000), k = Math.min(1, 1280 / Math.max(img.naturalWidth, img.naturalHeight));
    const m = {kind:'pic', ch, by:v.role, text:(v.ui.draft || '').trim(), pic:{u, w:Math.round(img.naturalWidth * k), h:Math.round(img.naturalHeight * k)}};
    if (v.ui.reply && G().msgs.some(x => x.id === v.ui.reply && x.ch === ch)) m.re = v.ui.reply;
    push(m); v.ui.draft = ''; v.ui.reply = null; v.ui.pop = null; v.ui.stick = true; renderAll();
  });
}
function sendGif(v, gif){
  const ch = v.ui.ch, m = {kind:'gif', ch, by:v.role, text:'', gif};
  if (v.ui.reply && G().msgs.some(x => x.id === v.ui.reply && x.ch === ch)) m.re = v.ui.reply;
  push(m); v.ui.pop = null; v.ui.reply = null; v.ui.stick = true; renderAll();
}
/* GIPHY's GIF search (Tenor's API closed in 2026); with nothing typed it shows what's trending.
   A free GIPHY key allows 100 searches an hour, so answers are kept for the session and a search waits for a pause in typing.
   GIPHY can answer a bad key or a spent quota with an empty list, so the status is checked before "nothing found". */
const gifCache = new Map();
function gifSearch(v){
  const ui = v.ui, key = G().gifKey; if (!key) return;
  const q = (ui.gifQ || '').trim().toLowerCase(), n = (v._gn = (v._gn || 0) + 1), ck = key + '|' + q;
  if (gifCache.has(ck)) { ui.gifRes = gifCache.get(ck); ui.gifErr = ''; ui.gifBusy = false; if (ui.pop?.type === 'emo') render(v); return; }
  const url = `https://api.giphy.com/v1/gifs/${q ? 'search' : 'trending'}?api_key=${encodeURIComponent(key.trim())}&limit=24&rating=pg-13${q ? '&q=' + encodeURIComponent(q) : ''}`;
  ui.gifBusy = true; ui.gifErr = '';
  fetch(url).then(r => r.json().catch(() => ({})).then(d => {
    if (n !== v._gn) return;
    const st = +(d.meta?.status || r.status);
    if (!r.ok || st >= 400 || !Array.isArray(d.data)) { const e = new Error(d.meta?.msg || d.message || 'refused'); e.st = st; throw e; }
    ui.gifRes = d.data.map(x => { const f = x.images || {}, big = f.downsized || f.fixed_width || f.original, sm = f.fixed_width_downsampled || f.fixed_width || big; return big?.url && sm?.url ? {u:big.url, p:sm.url, w:+big.width || 1, h:+big.height || 1, t:x.title || ''} : null; }).filter(Boolean);
    gifCache.set(ck, ui.gifRes);
  })).catch(err => { if (n === v._gn) { ui.gifRes = []; const st = err?.st;
    ui.gifErr = st === 429 ? 'GIPHY’s free key is out of searches for this hour. Try again later, or paste a GIF link below.'
      : st === 401 || st === 403 ? 'GIPHY refused the key. The GM can check it in GM tools > Emoji and GIFs (it must be the API key, not an SDK key).'
      : st ? `GIPHY said no (${st}${err.message && err.message !== 'refused' ? ': ' + err.message : ''}).` : 'GIF search didn’t answer. Check your connection.'; } })
    .finally(() => { if (n !== v._gn) return; ui.gifBusy = false; if (ui.pop?.type === 'emo') render(v); });
}

/* the skill the GM last rolled each skill against, so Provoke comes back already set against Will (say) */
const vsSkillMem = (() => { try { return JSON.parse(localStorage.getItem('norne-vsskill')) || {}; } catch(e) { return {}; } })();
const vsSkillSave = () => { try { localStorage.setItem('norne-vsskill', JSON.stringify(vsSkillMem)); } catch(e) {} };
function openRoll(v, o={}){
  if (!isGM(v)) return; /* the GM rolls everything, in a fight and out of one */
  const g = G();
  let who = o.who;
  if (!who) {
    if (!isGM(v)) who = 'pc:' + g.P[v.role].char;
    else { const n = N.npcByName(v.ui.voice), x = !n && N.extraByName(v.ui.ch === 'gm' ? 'table' : v.ui.ch, v.ui.voice); who = n ? 'npc:' + n.id : x ? 'one:' + x.id : (N.rollers(v)[0] || {}).key; }
  }
  const r = N.rollerOf(v, who);
  const best = r ? Object.entries(r.skills).sort((a,b)=>b[1]-a[1])[0]?.[0] : 'Notice';
  v.ui.roll = {who:r ? r.key : who, skill:o.skill || best || 'Notice', action:o.action || 'overcome', opp:o.opp ?? null, target:o.target || null, secret:!!o.secret || v.ui.ch === 'gm', all:false, ctx:o.ctx || null, aspect:'', otherName:'', otherBonus:2, vsNpc:null, vsSkill:null, passive:true, event:!!o.event, evText:'', dist:g.combat.distLast ?? 0, mod:0};
  { const r = v.ui.roll; if (r.skill in vsSkillMem) r.vsSkill = vsSkillMem[r.skill]; }
  v.ui.sheet = 'roll'; v.ui.pop = null;
}
N.openRoll = openRoll;
function doRoll(v){
  const g = G(), r = v.ui.roll, who = N.rollerOf(v, r.who); if (!who) return;
  const other = who.key === 'other';
  const tgt = r.target && N.tokById(r.target);
  const skill = other ? 'Bonus' : r.skill, bonus = other ? clamp(+r.otherBonus || 0, -4, 10) : (who.skills[r.skill] || 0);
  const label = (N.ACTIONS.find(a => a[1] === r.action) || ['Roll'])[0];
  const name = other ? (r.otherName.trim() || 'Someone') : who.name;
  /* a GM attack on someone in a live fight always goes to the fight's chat and asks for a defense, wherever it was rolled from.
     Players' own rolls never move the fight: the GM rolls for everyone in it. */
  const fight = isGM(v) && g.combat.state === 'live' && (r.ctx === 'cb' || (r.action === 'attack' && !!tgt));
  const roll = {who:name, whoKey:who.key, skill, bonus, action:label, target:tgt ? N.tokName(tgt) : null, opp:fight && r.action === 'attack' && tgt ? null : r.opp, dice:N.rollDice(), invokes:[]};
  if (fight) roll.fight = true;
  /* a ranged weapon helps the Shooting attack itself: its rating goes on the roll (shown as its own part of the total) */
  const rg = fight && r.action === 'attack' && tgt && !other ? N.atkGear(N.tokOfKey(who.key), skill) : null;
  if (rg && rg.roll) { roll.bonus += rg.roll; roll.gear = rg.roll; roll.gearL = rg.rollL; }
  /* Jake's distance debuff: an attack or a custom event aimed at someone in another zone loses what the GM picked (r.dist)
     off the roll, shown as its own part of the total. The pick is remembered for the rest of the fight. */
  const far = N.farOf(v, r);
  if (fight && far) { g.combat.distLast = +r.dist || 0; if (r.dist > 0) { roll.bonus -= r.dist; roll.dist = +r.dist; roll.distZ = N.zoneOf(far)?.name || ''; } }
  /* Jake's buff or debuff: the GM's own +1..+6 or −1..−6 on the roll, shown as its own part of the total. Not remembered */
  const mod = isGM(v) ? clamp(+r.mod || 0, -6, 6) : 0;
  if (mod) { roll.bonus += mod; roll.mod = mod; }
  /* a custom event (mind magic, a spell, anything the four actions don't cover) is a fight roll built like a roleplay roll:
     a skill against a skill and/or someone, a difficulty, passive or not, and it can be secret */
  const ev = fight && r.event, rp = isGM(v) && (ev || (!fight && r.ctx !== 'cb') || (fight && r.ctx === 'cb' && r.action !== 'attack'));
  if (ev) roll.event = (r.evText || '').trim() || true;
  if (rp && (r.vsSkill || r.vsNpc)) { const n = N.vsFind(v, r, r.vsNpc); roll.vs = {name:n ? n.name : null, skill:r.vsSkill || null}; }
  /* not passive: the other side rolls 4dF on top of the difficulty / the NPC's skill, and that total is what you beat */
  if (rp && r.passive === false && r.opp != null) { roll.oppBase = r.opp; roll.oppDice = N.rollDice(); roll.opp = r.opp + roll.oppDice.reduce((a, b) => a + b, 0); }
  /* a secret event stays in GM notes, marked with the fight so the GM's fight log and its record still show it */
  const secret = isGM(v) && (ev ? !!r.secret : !fight && (r.secret || v.ui.ch === 'gm'));
  if (ev && secret) roll.cid = g.combat.id;
  const ch = secret ? 'gm' : fight ? N.fightCh() : v.ui.ch === 'gm' ? 'table' : v.ui.ch;
  const m = push({ch, kind:'roll', by:v.role, roll});
  if (isGM(v) && who.portrait) m.pt = who.portrait;
  if (v.dev === 'phone' && !fight) { v._rfx = {id:m.id, at:Date.now(), own:true}; setTimeout(() => render(v), N.RFX_MS + 60); }
  v.ui.fresh = m.id; v.ui.sheet = null; v.ui.targeting = null; v.ui.stick = true;
  if (fight) { if (secret) g.combat.acted = true; else afterFightRoll(v, r, m); }
  if (ev && secret) toast(v, 'Secret roll saved in your fight log. Players don’t see it.');
  else if (secret && v.ui.ch !== 'gm') toast(v, 'Secret roll saved in GM notes.');
  else if (ch !== v.ui.ch || v.ui.tab !== 'chat') toast(v, `${name} rolled ${sgn(N.rollTotal(roll))} ${ladderWord(N.rollTotal(roll))}.`);
  renderAll();
}
function afterFightRoll(v, r, m){
  const cb = G().combat, a = N.tokOfKey(m.roll.whoKey), tot = N.rollTotal(m.roll);
  if (!a || cb.state !== 'live') return;
  if (r.action === 'attack' && r.target) {
    const d = N.tokById(r.target);
    N.boostTick(a);
    cb.pending = {att:a.id, def:r.target, total:tot, skill:m.roll.skill, msgId:m.id, stage:'defend'}; cb.last = null; cb.acted = true;
    if (m.roll.skill === 'Shooting' && !(cb.shot || []).includes(a.id)) (cb.shot = cb.shot || []).push(a.id);
    fsys(`${N.tokName(a)} attacks ${d ? N.tokName(d) : 'someone'} with ${m.roll.skill}: ${sgn(tot)} ${ladderWord(tot)}. ${d ? N.tokName(d) : 'They'} rolls to defend next.`);
    return;
  }
  /* m.roll.opp, not r.opp: when the other side rolled too (not passive) it holds their total */
  if (r.action === 'advantage') {
    const opp = m.roll.opp ?? 2; m.roll.opp = opp;
    const sh = tot - opp, name = (r.aspect || '').trim() || 'An Opening';
    /* made against someone on the board: the aspect (or the boost) is put on them */
    const on = r.vsNpc && r.vsNpc.startsWith('tok:') ? N.tokById(r.vsNpc.slice(4)) : null;
    if (sh === 0) {
      N.addBoost(a, on, name);
      fsys(`${N.tokName(a)} ties: not a lasting aspect, but they get a boost, “${name}”${on ? ` on ${N.tokName(on)}` : ''}, good for one free invoke.`);
    } else if (sh > 0) {
      const z = N.zoneOf(a), free = sh >= 3 ? 2 : 1;
      if (on) cb.aspects.push({t:name, free, onTok:on.id, on:N.tokName(on)});
      else if (z && !z.aspect) { z.aspect = name; z.free = free; } else cb.aspects.push({t:name, free});
      fsys(`${N.tokName(a)} creates “${name}”${on ? ` on ${N.tokName(on)}` : ''} with ${free} free invoke${free>1?'s':''}.`);
    } else fsys(`${N.tokName(a)} tries to create “${name}”${on ? ` on ${N.tokName(on)}` : ''}, but it doesn’t come together.`);
  }
  if (r.action === 'overcome' && !r.event) { const opp = m.roll.opp ?? 2; m.roll.opp = opp; }
  cb.acted = true;
}
function cbDefend(v){
  const g = G(), cb = g.combat, p = cb.pending; if (!p || p.stage !== 'defend') return;
  const d = N.tokById(p.def), a = N.tokById(p.att); if (!d || !a) { cb.pending = null; renderAll(); return; }
  N.boostTick(d);
  const [skill, x] = N.defSkill(d);
  const key = d.kind === 'pc' ? 'pc:' + d.ref : 'tok:' + d.id;
  const roll = {who:N.tokName(d), whoKey:key, skill, bonus:x, action:'Defend', target:N.tokName(a), opp:p.total, dice:N.rollDice(), invokes:[], fight:true};
  /* Jake's rule: any shield adds +1 to a Defend roll, whatever its rating */
  if (N.tokGear(d, 'shield')) { roll.bonus += 1; roll.gear = 1; roll.gearL = 'shield'; }
  const m = push({ch:N.fightCh(), kind:'roll', by:v.role, roll});
  if (d.kind === 'npc' && d.portrait) m.pt = d.portrait;
  /* defending counts as joining the fight */
  if (!isGM(v) && N.isMine(d, v.role) && !cb.joined.includes(v.role)) cb.joined.push(v.role);
  v.ui.fresh = m.id; v.ui.stick = true;
  p.defMsg = m.id;
  N.cbResolve();
  renderAll();
}
function cbAbsorb(v, k, i){ if (N.cbAbsorb(k, i)) renderAll(); }

/* ---------------- tokens and zones ---------------- */
function tokClick(v, id){
  const g = G(), cb = g.combat, t = N.tokById(id); if (!t) return;
  if (v.ui.targeting === 'attack') {
    const a = N.actorTok(v) || (isGM(v) ? N.curTok() : null);
    if (!a || t === a) return;
    if (t.out) return;
    /* across zones Shooting is the usual reach (Fighting needs a stunt, the GM's call), so it is picked first there */
    const far = t.zone !== a.zone, best = far ? 'Shooting' : ['Fighting','Shooting'].map(s => [s, N.tokSkills(a)[s]||0]).sort((x,y)=>y[1]-x[1])[0][0];
    openRoll(v, {who: a.kind === 'pc' ? 'pc:' + a.ref : 'tok:' + a.id, action:'attack', target:t.id, skill:best, ctx:'cb'});
    render(v); return;
  }
  if (cb.state === 'setup' && !t.zone && isGM(v)) { v.ui.placing = v.ui.placing === id ? null : id; render(v); return; }
  if (v.ui.placing) { v.ui.placing = null; }
  if (v.dev === 'phone') { v.ui.sheet = 'tok'; v.ui.sheetArg = id; }
  else v.ui.tokSel = v.ui.tokSel === id ? null : id;
  render(v);
}
function zoneClick(v, zid){
  const g = G(), cb = g.combat;
  if (v.ui.placing) { const t = N.tokById(v.ui.placing); if (t) t.zone = zid; v.ui.placing = null; renderAll(); return; }
  if (v.ui.targeting === 'move') {
    const a = N.actorTok(v) || (isGM(v) ? N.curTok() : null);
    if (a && N.cbMove(a, zid)) { cb.moved = true; }
    v.ui.targeting = null; renderAll(); return;
  }
  if (isGM(v) && v.ui.cbTool === 'zone') {
    v.ui.zoneSel = zid;
    if (v.dev === 'phone' || cb.state === 'live') { v.ui.sheet = 'zone'; v.ui.sheetArg = zid; }
    render(v); return;
  }
  if (v.ui.tokSel) { v.ui.tokSel = null; render(v); }
}
const zoneAt = (px, py) => { const zs = G().combat.zones; for (let i = zs.length - 1; i >= 0; i--) { const z = zs[i]; if (px >= z.x && px <= z.x + z.w && py >= z.y && py <= z.y + z.h) return z; } return null; };

/* ---------------- pointer: drag tokens, draw zones, pan the map ---------------- */
/* desktop: grab a sideways row with the mouse and drag it; a real drag doesn't also click the chip under the mouse */
function hsDrag(v, e){
  if (e.pointerType !== 'mouse' || e.button !== 0) return;
  const r = hsEl(e.target); if (!r || e.target.closest('input,textarea,select,.tok,[data-hs]')) return;
  const x0 = e.clientX, l0 = r.scrollLeft; let moved = false;
  const move = ev => { const dx = ev.clientX - x0; if (!moved && Math.abs(dx) < 6) return; if (!moved) { moved = true; r.classList.add('grabbing'); } r.scrollLeft = l0 - dx; };
  const up = () => {
    window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', up); window.removeEventListener('pointercancel', up);
    r.classList.remove('grabbing');
    if (moved) { v.suppress = true; setTimeout(() => { v.suppress = false; }, 0); }
  };
  window.addEventListener('pointermove', move); window.addEventListener('pointerup', up); window.addEventListener('pointercancel', up);
}
function down(v, e){
  if (e.button && e.button !== 0) return;
  const g = G(), cb = g.combat, gm = isGM(v);
  const board = e.target.closest('[data-board]');
  const tokEl = e.target.closest('.tok[data-tok]');
  const mapcv = e.target.closest('[data-mapcv]');
  if (tokEl && !e.target.closest('.fight-order')) {
    const t = N.tokById(tokEl.dataset.tok); if (!t) return;
    const mine = N.isMine(t, v.role) && cb.state === 'live' && N.curTok() === t && !cb.moved;
    const can = (gm && (cb.state === 'setup' || (v.ui.cbTool || 'move') === 'move') && !v.ui.targeting) || (mine && !v.ui.targeting);
    if (!can) return;
    track(v, e, {kind:'tok', t, el:tokEl});
    return;
  }
  if (board && gm && v.ui.cbTool === 'zone') {
    const rs = e.target.closest('[data-rs]'), zl = e.target.closest('[data-zl]');
    const br = board.getBoundingClientRect();
    const pt = ev => ({x:(ev.clientX - br.left) / br.width * 100, y:(ev.clientY - br.top) / br.height * 100});
    if (rs) { const z = cb.zones.find(x => x.id === rs.dataset.rs); track(v, e, {kind:'rs', z, pt, z0:{...z}, p0:pt(e)}); return; }
    if (zl) { const z = cb.zones.find(x => x.id === zl.dataset.zl); track(v, e, {kind:'zmove', z, pt, z0:{...z}, p0:pt(e)}); return; }
    if (!e.target.closest('.fight-tools,.hint-chip,.tokpanel,button')) { track(v, e, {kind:'draw', pt, p0:pt(e), board}); return; }
  }
  if (mapcv) {
    const pinEl = e.target.closest('[data-pin]');
    if (pinEl && isGM(v) && v.ui.mapEdit) { track(v, e, {kind:'pin', id:pinEl.dataset.pin, el:pinEl}); return; }
    mapDown(v, e);
  }
}
function track(v, e, d){
  const sx = e.clientX, sy = e.clientY; let started = false, ghost = null, drop = null;
  const move = ev => {
    if (!started && Math.hypot(ev.clientX - sx, ev.clientY - sy) < 6) return;
    if (!started) { started = true; startDrag(); }
    ev.preventDefault();
    if (d.kind === 'tok') {
      const p = local(v, ev.clientX, ev.clientY);
      ghost.style.left = p.x + 'px'; ghost.style.top = p.y + 'px';
      const board = v.root.querySelector('[data-board]');
      if (drop) drop.classList.remove('drop'); drop = null;
      if (board) { const br = board.getBoundingClientRect(); const z = zoneAt((ev.clientX - br.left)/br.width*100, (ev.clientY - br.top)/br.height*100); if (z) { drop = board.querySelector(`[data-zone="${z.id}"]`); drop && drop.classList.add('drop'); } d.zone = z; }
    } else if (d.kind === 'rs' || d.kind === 'zmove') {
      const p = d.pt(ev), dx = p.x - d.p0.x, dy = p.y - d.p0.y, z = d.z;
      if (d.kind === 'rs') { z.w = clamp(d.z0.w + dx, 8, 100 - z.x); z.h = clamp(d.z0.h + dy, 10, 100 - z.y); }
      else { z.x = clamp(d.z0.x + dx, 0, 100 - z.w); z.y = clamp(d.z0.y + dy, 0, 100 - z.h); }
      const el = v.root.querySelector(`[data-zone="${z.id}"]`); if (el) Object.assign(el.style, {left:z.x+'%', top:z.y+'%', width:z.w+'%', height:z.h+'%'});
    } else if (d.kind === 'draw') {
      const p = d.pt(ev), x = clamp(Math.min(p.x, d.p0.x), 0, 100), y = clamp(Math.min(p.y, d.p0.y), 0, 100);
      d.r = {x, y, w:Math.min(Math.abs(p.x - d.p0.x), 100 - x), h:Math.min(Math.abs(p.y - d.p0.y), 100 - y)};
      Object.assign(ghost.style, {left:d.r.x+'%', top:d.r.y+'%', width:d.r.w+'%', height:d.r.h+'%'});
    } else if (d.kind === 'pin') {
      const m = curMap(v), T = v.ui.mapT, cv = v.root.querySelector('[data-mapcv]').getBoundingClientRect();
      d.rx = clamp(((ev.clientX - cv.left) - T.x) / T.k / m.w, 0, 1); d.ry = clamp(((ev.clientY - cv.top) - T.y) / T.k / m.h, 0, 1);
      d.el.style.left = d.rx * m.w + 'px'; d.el.style.top = d.ry * m.h + 'px';
    }
  };
  const startDrag = () => {
    if (d.kind === 'tok') {
      ghost = document.createElement('div'); ghost.className = 'tok ghost'; ghost.innerHTML = d.el.innerHTML;
      ghost.style.position = 'absolute'; v.root.appendChild(ghost); d.el.classList.add('dragging');
    }
    if (d.kind === 'draw') { ghost = document.createElement('div'); ghost.className = 'zone ghost'; d.board.appendChild(ghost); }
  };
  const up = () => {
    window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', up); window.removeEventListener('pointercancel', up);
    if (!started) return;
    v.suppress = true; setTimeout(() => { v.suppress = false; }, 0);
    const cb = G().combat;
    if (d.kind === 'tok') {
      ghost && ghost.remove();
      const t = d.t;
      if (d.zone) {
        if (cb.state === 'live') { if (N.cbMove(t, d.zone.id) && !isGM(v)) cb.moved = true; }
        else t.zone = d.zone.id;
      } else if (cb.state === 'setup') t.zone = null;
      v.ui.placing = null;
    }
    if (d.kind === 'draw') {
      ghost && ghost.remove();
      if (d.r && d.r.w > 6 && d.r.h > 8) {
        const z = {id:uid('z'), name:`Zone ${cb.zones.length + 1}`, ...d.r, col:N.ZCOL[cb.zones.length % N.ZCOL.length], aspect:''};
        cb.zones.push(z); v.ui.zoneSel = z.id;
        if (cb.zones.length === 1) N.cbPlacePcs();
        if (v.dev === 'phone') { v.ui.sheet = 'zone'; v.ui.sheetArg = z.id; }
        setTimeout(() => { const f = v.root.querySelector(`#zn-${z.id}-${v.id}`); if (f) { f.focus(); f.select(); } }, 30);
      }
    }
    if (d.kind === 'pin' && d.rx != null) {
      const m = curMap(v);
      if (d.id === '__party') moveParty(m, d.rx, d.ry);
      else { const p = m.pins.find(x => x.id === d.id); if (p) { p.rx = d.rx; p.ry = d.ry; } }
    }
    renderAll();
  };
  window.addEventListener('pointermove', move, {passive:false}); window.addEventListener('pointerup', up); window.addEventListener('pointercancel', up);
}

/* ---------------- map ---------------- */
const seeMap = (v, m) => isGM(v) || m.vis !== false;
const curMap = v => { const ms = G().maps.filter(m => seeMap(v, m)); return ms.find(m => m.id === v.ui.mapId) || ms[0]; };
function moveParty(m, rx, ry){
  const g = G(); let p = null;
  for (const x of g.maps) { const i = x.pins.findIndex(q => q.type === 'party'); if (i >= 0) { p = p || x.pins[i]; x.pins.splice(i, 1); } }
  p = Object.assign(p || {id:'party', type:'party', label:'Your party', note:''}, {rx, ry, vis:true});
  m.pins.push(p);
}
function mapBox(v){ const cv = v.root.querySelector('[data-mapcv]'); return cv ? {cv, w:cv.clientWidth, h:cv.clientHeight} : null; }
/* any map, whatever its shape: zooming out stops at the whole map in view (centred), and it opens filling the screen,
   or for a long, thin map (a wide one on a phone) a little bigger than the whole map so it isn't a thin strip */
function kMin(v){ const m = curMap(v), b = mapBox(v); return Math.min(b.w / m.w, b.h / m.h); }
function kOpen(v){ const m = curMap(v), b = mapBox(v); return Math.min(Math.max(b.w / m.w, b.h / m.h) * 1.05, kMin(v) * 2.2); }
function clampT(v){
  const m = curMap(v), b = mapBox(v), T = v.ui.mapT, k0 = kMin(v);
  T.k = clamp(T.k, k0, Math.max(k0 * 10, 1.6));
  const W = m.w * T.k, H = m.h * T.k;
  T.x = W <= b.w ? (b.w - W) / 2 : clamp(T.x, b.w - W, 0);
  T.y = H <= b.h ? (b.h - H) / 2 : clamp(T.y, b.h - H, 0);
}
function centerOn(v, rx, ry, k){
  const m = curMap(v), b = mapBox(v); const T = v.ui.mapT = {id:m.id, k:k || v.ui.mapT?.k || kMin(v), x:0, y:0};
  T.x = b.w / 2 - rx * m.w * T.k; T.y = b.h / 2 - ry * m.h * T.k; clampT(v);
}
function applyMap(v){
  const b = mapBox(v); if (!b || !b.w) return;
  const m = curMap(v), g = G(); if (!m || !m.w) return;
  if (!v.ui.mapT || v.ui.mapT.id !== m.id || v.ui.mapT.bw !== b.w || v.ui.mapT.bh !== b.h) {
    const keep = v.ui.mapT && v.ui.mapT.id === m.id;
    /* a map with your location beacon opens on the beacon */
    const loc = keep ? null : N.myLoc(isGM(v) ? 'gm' : v.role, v.ui.ch), bk = loc && N.LOCK.find(k => loc[k] && loc[k].m === m.id);
    if (keep) clampT(v);
    else if (bk) centerOn(v, loc[bk].rx, loc[bk].ry, kOpen(v) * 1.5);
    else if (g.party.map === m.id) centerOn(v, g.party.rx, g.party.ry, kOpen(v) * 1.5);
    else centerOn(v, .5, .5, kOpen(v));
    v.ui.mapT.bw = b.w; v.ui.mapT.bh = b.h;
  }
  clampT(v);
  const st = b.cv.querySelector('.mapst'), T = v.ui.mapT;
  b.cv.classList.toggle('moving', !!(v._mapG || v._mapWheel));
  st.style.transform = `translate(${T.x}px,${T.y}px) scale(${T.k})`;
  /* pins and beacons keep their size on screen. Set on each one (not as a --k variable on the map, which restyled every
     element inside every pin on every frame) */
  /* first time this map shows in this style: make its copy with the colours painted in (js/mappic.js), so the big
     picture needs no CSS filter, which on a phone took a full-size extra copy in memory and crashed the page */
  const im = st.querySelector('img');
  if (im && !im._bk && !im.classList.contains('baked')) { im._bk = 1; N.mapBake(m.src, v.style + '/' + v.theme, getComputedStyle(im).filter, im); }
  if (st._k !== T.k) { st._k = T.k; const s = `scale(${1 / T.k})`; for (const el of st.querySelectorAll('.pin,.beacon')) el.style.transform = s; }
}
/* smooth zooming: a pinch or wheel sends many moves per frame. Each one used to restyle every pin and redraw the whole
   map picture (with its colour filter) at the new size, so phones managed only a few frames a second. Now moves only
   change the numbers and the map is drawn once per frame. (It also made the picture and pins GPU layers while moving; that
   made iPhones run out of memory and reload the page, so it was taken out on 2026-11-06, see .mapcv.moving in app.css.) */
function mapFrame(v){
  if (v._mapRaf) return;
  v._mapRaf = requestAnimationFrame(() => { v._mapRaf = 0; applyMap(v); });
}
function mapStill(v){
  if (v._mapRaf) { cancelAnimationFrame(v._mapRaf); v._mapRaf = 0; }
  applyMap(v);
}
function zoomAt(v, f, px, py){
  const T = v.ui.mapT; if (!T) return;
  const k1 = T.k; T.k = clamp(T.k * f, kMin(v), Math.max(kMin(v) * 10, 1.6)); const r = T.k / k1;
  T.x = px - (px - T.x) * r; T.y = py - (py - T.y) * r; mapFrame(v);
}
function mapWheel(v, f, px, py){
  clearTimeout(v._mapWheel); v._mapWheel = setTimeout(() => { v._mapWheel = 0; mapStill(v); }, 200);
  zoomAt(v, f, px, py);
}
/* one gesture at a time. A finger whose "up" never arrives (iPhone drops it when the map is redrawn under the finger,
   e.g. by live sync) used to stay in the list for good, so the next one-finger drag was read as a pinch against
   that ghost finger and zoomed. A new first finger (isPrimary) now always starts a fresh gesture. */
function mapDown(v, e){
  let g = v._mapG;
  if (e.isPrimary || !g) { if (g) g.end(); g = null; }
  if (g) { g.pts.set(e.pointerId, {x:e.clientX, y:e.clientY}); g.pinch = null; return; }
  const pts = new Map([[e.pointerId, {x:e.clientX, y:e.clientY}]]);
  const cvr = () => v.root.querySelector('[data-mapcv]').getBoundingClientRect();
  let moved = 0, last = {x:e.clientX, y:e.clientY};
  const move = ev => {
    if (!pts.has(ev.pointerId)) return;
    pts.set(ev.pointerId, {x:ev.clientX, y:ev.clientY});
    const T = v.ui.mapT; if (!T) return;
    if (pts.size >= 2) {
      const [a, b] = [...pts.values()], dist = Math.hypot(a.x - b.x, a.y - b.y), mid = {x:(a.x + b.x)/2, y:(a.y + b.y)/2};
      const p = g.pinch;
      if (p && p.d > 0) { const r = cvr(); zoomAt(v, dist / p.d, mid.x - r.left, mid.y - r.top); T.x += mid.x - p.mx; T.y += mid.y - p.my; mapFrame(v); }
      g.pinch = {d:dist, mx:mid.x, my:mid.y}; moved += 10; return;
    }
    g.pinch = null;
    const dx = ev.clientX - last.x, dy = ev.clientY - last.y; last = {x:ev.clientX, y:ev.clientY};
    moved += Math.abs(dx) + Math.abs(dy);
    T.x += dx; T.y += dy; mapFrame(v);
  };
  const end = () => {
    window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', up); window.removeEventListener('pointercancel', up);
    if (v._mapG === g) { v._mapG = null; mapStill(v); }
  };
  const up = ev => {
    if (!pts.delete(ev.pointerId)) return;
    g.pinch = null;
    if (pts.size) { const [q] = [...pts.values()]; last = {x:q.x, y:q.y}; return; }
    end();
    if (moved > 6) { v.suppress = true; setTimeout(() => { v.suppress = false; }, 0); }
  };
  g = v._mapG = {pts, pinch:null, end};
  v.root.querySelector('[data-mapcv]')?.classList.add('moving');
  window.addEventListener('pointermove', move); window.addEventListener('pointerup', up); window.addEventListener('pointercancel', up);
}
/* a place that opens a map (a country, a city, a neighborhood) goes straight to it; Back returns to the map it was on */
function openMapFrom(v, id){ const cur = curMap(v); if (cur && cur.id !== id) (v.ui.mapBack = v.ui.mapBack || []).push(cur.id); v.ui.mapId = id; }
function pinGo(v, pid){
  const m = curMap(v), p = m && m.pins.find(x => x.id === pid), to = p && N.pinTo(m, p), mp = to && G().maps.find(x => x.id === to && seeMap(v, x));
  if (!mp) return false;
  openMapFrom(v, mp.id); Object.assign(v.ui, {pinSel:null, mapT:null, mapType:'all', pop:null}); render(v); return true;
}
function addPinAt(v, e){
  const m = curMap(v), T = v.ui.mapT, cv = v.root.querySelector('[data-mapcv]').getBoundingClientRect();
  const rx = ((e.clientX - cv.left) - T.x) / T.k / m.w, ry = ((e.clientY - cv.top) - T.y) / T.k / m.h;
  const p = {id:uid('pin'), type:'note', label:'New place', note:'', rx, ry, vis:false};
  m.pins.push(p); v.ui.pinSel = p.id; v.ui.addPin = false;
  renderAll();
  setTimeout(() => { const f = v.root.querySelector(`#pinl-${v.id}`); if (f) { f.focus(); f.select(); } }, 30);
}
N.curMap = curMap;
window.addEventListener('resize', () => { clearTimeout(window._mr); window._mr = setTimeout(() => views.forEach(v => { hsArrows(v.root); if (v.ui.tab === 'map') applyMap(v); }), 120); });

/* ---------------- popovers ---------------- */
function openPop(v, type, el){
  const r = el.getBoundingClientRect(), R = v.root.getBoundingClientRect();
  const W = v.root.offsetWidth, H = v.root.offsetHeight;
  const x = clamp(r.left - R.left, 8, Math.max(8, W - 330));
  const top = r.top - R.top, bot = r.bottom - R.top;
  v.ui.pop = top > H / 2 ? {type, x, y:H - top + 8, up:true} : {type, x, y:bot + 8};
}

/* ---------------- pictures ---------------- */
/* portraits and scene pictures are shared with players, so they are stored as visible */
/* every upload opens the framing editor first; the picture is kept whole and its frame rides on its name (core.js) */
function pickFramed(v, kind, cb){ N.pickImage((img, file) => N.frameEdit(v, {url:img.src, kind, save:'Use this picture', onSave:f => cb(img, f, file)})); }
/* Adjust: reframe a picture that is already in place */
function reframe(v, kind, src, cb){ const url = N.faceUrl(src); if (url) N.frameEdit(v, {url, kind, frame:N.picFrame(src), onSave:f => cb(N.withFrame(src, f))}); }
const samePic = (a, b) => N.picBase(a) === N.picBase(b);
function uploadFace(v, cb){ pickFramed(v, 'face', (img, f) => { cb(N.withFrame(N.storeImg(N.shrink(img, 720, 300000), true), f)); render(v); }); }
/* every background the GM uploads is kept on the GM screen shelf until it is deleted */
/* a player's own picture lives on their card (players can't save pictures elsewhere), so it is kept small */
function myFace(v, c, p){ c.portrait = p; v.ui.sheet = null; toast(v, p ? 'Picture changed.' : 'Picture removed.'); renderAll(); N.syncNow && N.syncNow(); }
/* a Meta picture: the person out of character. A player's sits on their card (the one thing they may write), the GM's on game/meta */
function metaPic(v, p){
  const g = G();
  if (isGM(v)) g.gmPic = p || null; else { const c = N.charOf(v.role); if (!c) return; if (p) c.mpic = p; else delete c.mpic; }
  toast(v, p ? 'Meta picture saved.' : 'Meta picture removed.'); renderAll(); N.syncNow && N.syncNow();
}
function keepPic(src){ const p = {id:uid('pic'), src}; G().pics = [p, ...G().pics]; return p; }
function uploadPicture(v, cb){ pickFramed(v, 'bg', (img, f) => { const src = N.withFrame(N.storeImg(N.shrink(img, 1600, 700000), true), f); keepPic(src); cb(src); render(v); }); }
/* a reframed background changes everywhere it is in use right now */
function reframePic(v, src){ reframe(v, 'bg', src, nu => {
  const g = G(); g.pics.forEach(p => { if (samePic(p.src, src)) p.src = nu; }); g.recent.forEach(r => { if (r.art && samePic(r.art, src)) r.art = nu; });
  if (g.combat.bg && samePic(g.combat.bg, src)) g.combat.bg = nu;
  if (v.ui.sd?.art && samePic(v.ui.sd.art, src)) v.ui.sd.art = nu;
  toast(v, 'Framing saved.'); renderAll();
}); }

/* ---------------- actions ---------------- */
/* the fight on screen is the one in the open chat; picks made in another chat's fight don't carry over */
function focusFight(v){
  const was = G().fch; N.focusFight(v.ui.ch);
  if (G().fch !== was) Object.assign(v.ui, {tokSel:null, targeting:null, placing:null, zoneSel:null});
}
function act(v, a, el, e){
  focusFight(v);
  const g = G(), ui = v.ui, d = el.dataset, val = d.v, cb = g.combat, gm = isGM(v);
  const close = () => { ui.sheet = null; ui.pop = null; };
  /* anything tapped in the phone's chat drawer closes it */
  if (ui.shelf && a !== 'shelf') ui.shelf = false;
  switch (a) {
  /* account */
  case 'signIn': N.signIn(); return;
  case 'signOut': N.signOut(); return;
  /* navigation */
  /* players always land on the default map when they come to the Maps tab (the GM keeps the map they were on) */
  case 'tab': close(); if (val === 'map' && ui.tab !== 'map' && !gm) { const dm = N.defMap(false); if (dm) Object.assign(ui, {mapId:dm.id, mapBack:[], mapDir:null, pinSel:null, mapT:null, mapType:'all'}); } ui.tab = val; if (val === 'cast') ui.castSel = null; if (val === 'hero') { ui.charSel = null; ui.heroInv = false; } if (val === 'world' && v.dev === 'phone') { ui.wikiSel = null; ui.wikiPrev = []; } if (val === 'news') newsTab(v); break;
  case 'heroInv': ui.heroInv = !!val; break;
  case 'ch': close(); if (ui.ch !== val) ui.reply = null; ui.tab = 'chat'; ui.ch = val; ui.stick = true; focusFight(v); if (v.dev === 'phone' && N.fightAvail(v)) ui.fightPane = 'chat'; break;
  case 'shelf': ui.shelf = !ui.shelf; ui.pop = null; break;
  case 'mode': if (val === 'cb') { ui.fightOpen = true; ui.fightPane = 'fight'; } else { ui.fightOpen = false; ui.fightPane = 'chat'; ui.tokSel = null; ui.targeting = null; ui.stick = true; } break;
  case 'railFold': ui[d.v] = !ui[d.v]; try { localStorage.setItem('norne-' + d.v.toLowerCase(), ui[d.v] ? '1' : '0'); } catch(e) {} break;
  case 'shelfDt': ui.shelfOff = !ui.shelfOff; try { localStorage.setItem('norne-shelfoff', ui.shelfOff ? '1' : '0'); } catch(e) {} break;
  case 'recentFold': ui.recentOff = !ui.recentOff; try { localStorage.setItem('norne-recent', ui.recentOff ? '0' : '1'); } catch(e) {} break;
  case 'rail': ui.rail = !v.root.querySelector('.page .rail'); try { localStorage.setItem('norne-rail', ui.rail ? '1' : '0'); } catch(e) {} break;
  case 'sheet': ui.pop = null; ui.invBack = null; openSheet(v, val, d); if (val === 'search') { render(v); const f = v.root.querySelector(`#cq-${v.id}`); if (f) { f.focus({preventScroll:true}); f.select(); } return; } break;
  case 'closeSheet': if (!askTell(v)) { ui.sheet = null; ui.tellAsk = null; } break;
  /* the GM's answer to "Send notifications?" after revealing something */
  case 'tellTog': { const it = ui.tellAsk?.items[+val]; if (it) it.on = !it.on; break; }
  case 'tellGo': case 'tellSkip': {
    const t = ui.tellAsk; ui.tellAsk = null; ui.sheet = null; if (!t) break;
    const go = a === 'tellGo' ? t.items.filter(it => it.on && it.ok) : [];
    for (const it of go) sys(it.text, it.to === '*' ? 'table' : 'dm-' + it.to);
    toast(v, go.length ? `Sent a note to ${go.some(it => it.to === '*') ? 'Everyone' : N.namesOf(go.map(it => it.to))}.` : 'Saved. Nobody got a note.');
    renderAll(); return;
  }
  case 'closePop': ui.pop = null; break;
  case 'pop': if (ui.pop && ui.pop.type === val) ui.pop = null; else { if (val === 'maps') ui.mapDir = N.mapDirOf(curMap(v)); openPop(v, val, el);
    /* the emoji button over a form remembers which box to fill: the last one typed in there, else its first text box */
    if (val === 'emof') { const box = el.closest('.sheet, .page') || v.root, last = v._fld && box.querySelector('#' + CSS.escape(v._fld)); const f = last || box.querySelector('textarea[id], input.inp[id]:not([type]), input.inp[id][type=text]');
      /* where the caret was: the box is drawn again before the emoji is picked, which would lose it */
      ui.pop.fld = f?.id; ui.pop.sel = f && last ? [f.selectionStart ?? f.value.length, f.selectionEnd ?? f.value.length] : f ? [f.value.length, f.value.length] : null; } if (val === 'emo' && ui.emoTab === 'gif' && !ui.gifRes?.length && g.gifKey) gifSearch(v); } break;
  case 'toast': toast(v, val); break;
  case 'undo': if (ui.toast && ui.toast.undo) { ui.toast.undo(); ui.toast = null; renderAll(); return; } break;
  case 'notify': N.toggleNotify(v); return;
  case 'theme': v.theme = val; try { localStorage.setItem('norne-theme', val); } catch(e) {} if (N.onTheme) N.onTheme(v); break;
  case 'fz': v.fz = N.fzOk(val); try { localStorage.setItem('norne-fz', v.fz); } catch(e) {} break;
  case 'vg': v.vg = val === 'on'; try { localStorage.setItem('norne-vg', v.vg ? '1' : '0'); } catch(e) {} break;
  case 'dp': v.dp = val === 'on'; try { localStorage.setItem('norne-dp', v.dp ? '1' : '0'); } catch(e) {} break;
  case 'style': v.style = N.styleOk(val); try { localStorage.setItem('norne-style', v.style); } catch(e) {} break;
  /* chat */
  case 'sceneMin': ui.sceneMin = !ui.sceneMin; break;
  case 'fold': ui.folded.set(d.id, !d.f); break;
  case 'send': send(v); return;
  case 'fcSend': fcSend(v); return;
  case 'roll': openRoll(v, {skill:d.skill, who: d.who || (d.c ? 'pc:' + d.c : d.npc ? 'npc:' + d.npc : null), secret:!!d.secret}); break;
  case 'voiceAll': ui.voiceAll = !ui.voiceAll; return render(v);
  case 'voice': { ui.voiceQ = ''; ui.voiceAll = false;
    if (val === '__ooc') ui.mode = 'ooc';
    else if (val === '__me') ui.mode = 'rp';
    else if (val === '__flip') ui.mode = ui.mode === 'ooc' ? 'rp' : 'ooc';
    else { ui.mode = 'rp'; ui.voice = val; }
    ui.pop = null;
    if (d.go) { ui.sheet = null; ui.tab = 'chat'; if (ui.ch === 'gm') ui.ch = 'table'; if (d.go === 'side') { ui.tokSel = null; if (v.dev === 'phone') ui.fightPane = 'chat'; } toast(v, `Speaking as ${val}`); setTimeout(() => { const t = v.root.querySelector('.composer textarea'); t && t.focus(); }, 20); }
    if (ui.sheet === 'gm') ui.sheet = null;
    break;
  }
  case 'newVoice': ui.pop = null; openSheet(v, 'npcNew', {from:'voice'}); break;
  case 'invoke': ui.sheet = 'invoke'; ui.sheetArg = d.id; ui.invBy = null; ui.invName = ''; break;
  case 'invMod': invMod(v, +d.d); return;
  case 'invBy': ui.invBy = val; break;
  /* add a situation aspect from the invoke sheet, then come back to it */
  case 'invAsp': ui.invBack = ui.sheetArg; ui.sheet = 'cbAspect'; break;
  case 'doInvoke': doInvoke(v, +d.i, d.how === 'reroll'); return;
  case 'readNews': case 'herald': { close(); ui.tab = 'news'; ui.newsEdit = null; const i = g.news.issues.find(x => x.id === d.id); if (i) openIssue(v, i); else newsTab(v); break; }
  case 'newsSel': { const i = g.news.issues.find(x => x.id === val); if (i) openIssue(v, i); const r = v.root.querySelector('[data-sk="nr"]'); if (r) r.scrollTop = 0; break; }
  case 'newsPaper': {
    ui.newsEdit = null;
    if (v.dev === 'phone') { ui.paper = val; ui.newsSel = null; break; }
    if (ui.paper === val) { ui.paper = null; ui.newsSel = null; break; }
    const p = N.papers().find(x => x.name === val); if (!p) break;
    const s = g.news.seen[v.role] || [];
    openIssue(v, p.issues.find(i => !s.includes(i.id)) || p.issues[p.issues.length - 1]); break;
  }
  case 'nBack': if (ui.newsEdit) ui.newsEdit = null; else if (ui.newsSel) ui.newsSel = null; else ui.paper = null; break;
  case 'writeNews': {
    close(); ui.tab = 'news';
    const ps = N.papers(), p = ps.find(x => x.name === (d.v || ui.paper)) || ps[0];
    dropDraftPics(ui.newsEdit);
    ui.newsEdit = Object.assign(blankIssue(), p ? nextIssue(p) : {});
    break;
  }
  /* a published issue opens in the same form; saving changes it in place */
  case 'newsEditIssue': { const i = g.news.issues.find(x => x.id === val); if (!gm || !i) break; close(); ui.tab = 'news';
    ui.newsEdit = Object.assign(blankIssue(), JSON.parse(JSON.stringify({paper:i.paper || '', no:String(i.no || ''), date:i.date || '', price:i.price || '', headline:i.headline || '', sub:i.sub || '', lead:i.lead || '', limg:i.limg || '', lcap:i.lcap || '',
      stories:(i.stories || []).map(st => ({title:st.title || '', body:st.body || '', img:st.img || '', cap:st.cap || ''})), notices:(i.notices || []).join('\n')})), {edit:i.id});
    const r = v.root.querySelector('[data-sk="nr"]'); if (r) r.scrollTop = 0; break; }
  case 'ndStoryAdd': ui.newsEdit.stories.push({title:'', body:'', img:'', cap:''}); break;
  case 'ndStoryDel': { const [st] = ui.newsEdit.stories.splice(+d.n, 1); if (st?.img) dropDraftPic(ui.newsEdit, st.img); break; }
  /* pictures start as GM only; publishing shares them with whoever can read the issue */
  case 'ndImgAdd': { const n = +d.n; pickFramed(v, 'wiki', (img, f) => { const ne = ui.newsEdit; if (!ne) return; const src = N.withFrame(N.storeImg(N.shrink(img, 1400, 600000), false), f);
    if (n < 0) ne.limg = src; else if (ne.stories[n]) ne.stories[n].img = src; render(v); }); return; }
  case 'ndImgFrame': { const ne = ui.newsEdit, n = +d.n, src = n < 0 ? ne.limg : ne.stories[n]?.img; if (src) reframe(v, 'wiki', src, nu => { if (n < 0) ne.limg = nu; else ne.stories[n].img = nu; render(v); }); return; }
  case 'ndImgDel': { const ne = ui.newsEdit, n = +d.n; if (n < 0) { dropDraftPic(ne, ne.limg); ne.limg = ''; ne.lcap = ''; } else if (ne.stories[n]) { dropDraftPic(ne, ne.stories[n].img); ne.stories[n].img = ''; ne.stories[n].cap = ''; } break; }
  case 'ndPaper': { const p = N.papers().find(x => x.name === val); if (p) Object.assign(ui.newsEdit, nextIssue(p)); break; }
  case 'newsCancel': dropDraftPics(ui.newsEdit); ui.newsEdit = null; break;
  case 'newsPub': {
    const n = ui.newsEdit; if (!n.headline.trim()) { toast(v, 'Add a headline first.'); break; }
    if (n.edit) {
      const i = g.news.issues.find(x => x.id === n.edit); if (!i) { ui.newsEdit = null; break; }
      const nu = N.draftIssue(n), gone = N.newsPics(i).filter(a => !N.newsPics(nu).some(b => samePic(a, b)));
      for (const k of ['limg', 'lcap']) delete i[k];
      Object.assign(i, nu, {ed:N.now()}); gone.forEach(N.dropImg);
      g.news.issues.sort((a, b) => (+a.no || 0) - (+b.no || 0));
      ui.newsEdit = null; ui.paper = N.paperName(i); ui.newsSel = i.id; toast(v, 'Saved. Readers see the new version.'); renderAll(); return;
    }
    const issue = Object.assign({id:uid('ed'), t:N.now()}, N.draftIssue(n));
    if (n.see?.length) issue.see = [...n.see];
    g.news.issues.push(issue); (g.news.seen.gm = g.news.seen.gm || []).push(issue.id);
    const to = N.audOf(issue, 'news');
    /* who has had the "issue delivered" note: later edits or reader changes never ping them again */
    issue.told = N.audSeats(issue, 'news');
    for (const ch of to === '*' ? ['table'] : to.map(s => 'dm-' + s)) push({ch, kind:'news', by:'gm', text:issue.headline, nid:issue.id});
    ui.newsEdit = null; ui.paper = N.paperName(issue); ui.newsSel = issue.id; toast(v, to === '*' ? 'Published. Everyone got a note in chat.' : `Published for ${N.audLabel(issue, 'news').replace(/^Only /, '')}. They got a note.`); renderAll(); return;
  }
  case 'ndAud': N.audSet(ui.newsEdit, 'news', val); break;
  case 'newsAud': {
    const i = g.news.issues.find(x => x.id === ui.sheetArg); if (!i) break;
    /* only a reader who has never had this issue gets a note; ticking someone off and on again, or
       switching between readers and Everyone, never sends the same issue twice */
    const told = new Set(i.told || N.audSeats(i, 'news')); N.audSet(i, 'news', val);
    const added = N.audSeats(i, 'news').filter(s => !told.has(s));
    for (const s of added) { push({ch:'dm-' + s, kind:'news', by:'gm', text:i.headline, nid:i.id}); told.add(s); }
    i.told = [...told].sort((a, b) => a.slice(1) - b.slice(1));
    renderAll(); return;
  }
  /* a message's menu: reactions and reply for everyone, edit and delete for the GM */
  case 'msgMenu': { const w = v.root.querySelector(`[data-mid="${CSS.escape(val)}"]`); if (ui.pop?.mid === val) ui.pop = null; else if (w) { openPop(v, 'msg', d.lp ? (w.querySelector('.m,.narr,.resm,.roll') || w) : el); ui.pop.mid = val; } break; }
  case 'emoMore': if (ui.pop) ui.pop.all = !ui.pop.all; break;
  case 'emoTab': ui.emoTab = val; if (val === 'gif' && !ui.gifRes && g.gifKey) gifSearch(v); break;
  /* group chats: the GM makes, renames, fills and deletes them */
  case 'dmSet': {
    if (!gm || !g.P[val]) break; const on = !N.dmOn(val); N.setDm(val, on);
    if (on) sys(`${N.gmName()} opened this private chat. Only the two of you can read it.`, 'dm-' + val);
    else if (ui.ch === 'dm-' + val) ui.ch = 'table';
    toast(v, on ? `Private chat with ${g.P[val].name} is open.` : `Private chat with ${g.P[val].name} is closed. Its messages are kept.`); renderAll(); return;
  }
  case 'grpNew': if (!gm) break; openSheet(v, 'grpEdit', {party:d.party === '1'}); break;
  case 'grpEdit': if (!gm) break; openSheet(v, 'grpEdit', {v:val}); break;
  case 'gdParty': ui.gd.party = val === '1'; break;
  case 'gdMeta': ui.gd.meta = val === '1'; break;
  case 'gdHist': ui.gd.hist = val === '1'; break;
  case 'gdSeat': { const ss = ui.gd.seats, i = ss.indexOf(val); if (i < 0) ss.push(val); else ss.splice(i, 1); break; }
  case 'gdSave': {
    const d = ui.gd, name = d.name.trim(); if (!gm || !name || !d.seats.length) break;
    const old = d.id && g.groups.find(x => x.id === d.id), seats = N.seats().filter(s => d.seats.includes(s));
    const gr = {id:d.id || uid('g'), name, seats, t:old?.t || N.now(), ...(d.party ? {party:true} : {}), ...(d.meta ? {meta:true} : {})};
    /* a player is in one party at a time: putting them in this one takes them out of any other */
    if (gr.party) for (const o of g.groups.filter(x => x.party && x.id !== gr.id && x.seats.some(s => seats.includes(s)))) { const was = [...o.seats]; N.saveGroup({...o, seats:o.seats.filter(s => !seats.includes(s))}, was); }
    const added = old ? seats.filter(s => !old.seats.includes(s)) : [], hist = d.hist !== false;
    N.saveGroup(gr, old ? old.seats : null, hist);
    if (!old) sys(`${N.gmName()} made this group chat for ${N.namesOf(seats)}.`, 'grp-' + gr.id);
    else if (added.length) sys(`${N.gmName()} added ${N.namesOf(added)} to the chat${hist ? '' : '. They see only what is said from here on'}.`, 'grp-' + gr.id);
    if (!old ? gr.meta : !!old.meta !== !!gr.meta) sys(gr.meta ? `${N.gmName()} made this chat Meta only: everyone shows as themselves, no characters and no fights.` : `${N.gmName()} turned Meta only off: characters can speak here again.`, 'grp-' + gr.id);
    close(); ui.tab = 'chat'; ui.ch = 'grp-' + gr.id; ui.shelf = false; toast(v, old ? 'Saved.' : `Made ${name}. Only ${N.namesOf(seats)} and you can read it.`); renderAll(); return;
  }
  case 'grpDelGo': { if (!gm) break; const gr = g.groups.find(x => x.id === val); if (!gr) break; N.dropGroup(gr.id); close(); if (ui.ch === 'grp-' + gr.id) ui.ch = 'table'; toast(v, `${gr.name} deleted.`); renderAll(); return; }
  /* several characters per player: the GM adds or removes seats, the player switches (a reload, like signing in as someone else) */
  case 'seatAdd': { if (!gm) break; const m = N.MEMBERS.find(x => x.uid === val), s = N.addSeat(val); if (s) toast(v, `${m?.name || 'They'} got another character (seat ${s.slice(1)}). Fill in its card in Cast.`); break; }
  case 'seatDrop': if (gm) { N.dropSeat(val, d.s); toast(v, 'Character taken away. Its card stays in Cast.'); } break;
  case 'seatGo': { const c = g.chars[g.P[val]?.char || 'pc' + String(val).slice(1)], k = c?.built ? c : N.seatCard(val); toast(v, `Switching to ${k?.short || 'your other character'}…`); N.switchSeat(val); return; }
  case 'picSend': sendPic(v); return;
  case 'picView': openSheet(v, 'picView', {v:val}); break;
  case 'gifSend': { const r = (ui.gifRes || [])[+d.i]; if (r) sendGif(v, {u:r.u, w:r.w, h:r.h}); return; }
  case 'gifLink': { const u = (ui.gifUrl || '').trim(); if (!N.gifLinkOk(u)) break; ui.gifUrl = ''; sendGif(v, {u}); return; }
  case 'gifKeySave': if (!gm) break; g.gifKey = (ui.gifKeyD ?? g.gifKey ?? '').trim(); ui.gifKeyD = undefined; ui.gifRes = null; toast(v, g.gifKey ? 'GIF search is on.' : 'GIF search is off.'); renderAll(); return;
  case 'react': { const m = g.msgs.find(x => x.id === d.id); if (!m || !val || !N.msgSocial(m)) break;
    const rx = m.rx || (m.rx = {}), l = (rx[v.role] || []).slice(), at = l.indexOf(val);
    if (at >= 0) l.splice(at, 1); else if (l.length < 12) l.push(val);
    if (l.length) rx[v.role] = l; else delete rx[v.role];
    if (!Object.keys(rx).length) delete m.rx;
    ui.pop = null; if (N.saveRx) N.saveRx(m, v.role); renderAll(); return; }
  case 'reply': { const m = g.msgs.find(x => x.id === val); ui.pop = null; if (!m) break; ui.reply = m.id; if (v.dev === 'phone' && N.fightAvail(v)) ui.fightPane = 'chat'; render(v); const ta = v.root.querySelector('.composer textarea'); if (ta) ta.focus({preventScroll:true}); return; }
  case 'replyOff': ui.reply = null; break;
  case 'moreMsgs': {
    /* draw more of the chat's history, keeping the view where it was */
    const box = el.closest('.msgs'), h0 = box ? box.scrollHeight : 0, t0 = box ? box.scrollTop : 0;
    (ui.more = ui.more || {})[ui.ch] = N.msgWin(v) + 200; render(v);
    const nb = v.root.querySelector(`#${CSS.escape(box?.id || 'none')}`); if (nb) nb.scrollTop = t0 + nb.scrollHeight - h0;
    return; }
  case 'cqAll': ui.cqAll = val === '1'; render(v); { const f = v.root.querySelector(`#cq-${v.id}`); if (f && v.dev !== 'phone') f.focus({preventScroll:true}); } return;
  case 'cqGo': {
    /* a search result: open its chat, close the search and land on the message */
    const ch = el.dataset.c; if (!N.channelsFor(v.role).includes(ch)) return;
    if (ui.ch !== ch) { ui.ch = ch; ui.reply = null; }
    close(); ui.tab = 'chat'; ui.shelf = false; focusFight(v); if (v.dev === 'phone' && N.fightAvail(v)) ui.fightPane = 'chat'; renderAll();
    setTimeout(() => act(v, 'jumpMsg', {dataset:{v:val}}), 60); return;
  }
  case 'nearMsg': {
    /* a roll or note in Recent actions: land the chat on what was said closest to when it happened */
    const a = g.msgs.find(m => m.id === val); if (!a) break;
    const said = g.msgs.filter(m => m.ch === a.ch && !N.isAction(m) && !m.fc && !(m.kind === 'scene' && (m.quiet || !m.scene)));
    let best = null; for (const m of said) if (!best || Math.abs(m.t - a.t) < Math.abs(best.t - a.t)) best = m;
    if (!best) { toast(v, 'Nothing was said in this chat around then.'); break; }
    act(v, 'jumpMsg', {dataset:{v:best.id}}); return; }
  case 'jumpMsg': { let w = v.root.querySelector(`.msgs [data-mid="${CSS.escape(val)}"]`);
    /* an answered message older than what is drawn: draw back to it first */
    if (!w && g.msgs.some(m => m.id === val && m.ch === ui.ch)) { const i = g.msgs.filter(m => m.ch === ui.ch).findIndex(m => m.id === val), n = g.msgs.filter(m => m.ch === ui.ch).length; (ui.more = ui.more || {})[ui.ch] = Math.max(N.msgWin(v), n - i + 20); render(v); w = v.root.querySelector(`.msgs [data-mid="${CSS.escape(val)}"]`); }
    if (!w) { toast(v, 'That message isn’t in this chat any more.'); break; }
    w.scrollIntoView({block:'center', behavior:'smooth'}); w.classList.remove('flash'); void w.offsetWidth; w.classList.add('flash'); setTimeout(() => w.classList.remove('flash'), 2400); return; }
  case 'emoIns': { const ta = v.root.querySelector('.composer textarea'), t = val.startsWith(':') ? val + ' ' : val;
    const a = ta ? ta.selectionStart ?? ui.draft.length : ui.draft.length, b = ta ? ta.selectionEnd ?? a : a;
    ui.draft = ui.draft.slice(0, a) + t + ui.draft.slice(b); ui.pop = null; render(v);
    const f = v.root.querySelector('.composer textarea'); if (f) { f.focus({preventScroll:true}); f.setSelectionRange(a + t.length, a + t.length); } return; }
  /* the GM's own emoji pictures */
  case 'emoField': { const id = ui.pop?.fld, sel = ui.pop?.sel, t = val.startsWith(':') ? val + ' ' : val; ui.pop = null;
    const f = id && v.root.querySelector('#' + CSS.escape(id)); if (!f) { render(v); return; }
    const a = Math.min(sel ? sel[0] : f.value.length, f.value.length), b = Math.min(sel ? sel[1] : a, f.value.length);
    f.value = f.value.slice(0, a) + t + f.value.slice(b);
    /* the form keeps its own copy of each box, so it hears about the change the way it hears typing */
    f.dispatchEvent(new Event('input', {bubbles:true})); f.dispatchEvent(new Event('change', {bubbles:true}));
    render(v);
    const g2 = v.root.querySelector('#' + CSS.escape(id)); if (g2) { g2.focus({preventScroll:true}); try { g2.setSelectionRange(a + t.length, a + t.length); } catch(e) {} } return; }
  case 'emoAdd': if (!gm) break; {
    const named = () => { render(v); setTimeout(() => v.root.querySelector(`#emn-${v.id}`)?.focus(), 30); };
    /* a moving GIF/WebP/PNG is kept exactly as it came (redrawing it would freeze it), so it skips the framer */
    N.pickImage((img, file) => {
      if (N.isAnimated(img.src)) {
        if (img.src.length > 900000) { toast(v, 'That animated emoji is too big. Use one under 650 KB (Discord’s are under 256 KB).'); return; }
        ui.emoNew = {d:img.src, n:N.emoName((file?.name || '').replace(/\.\w+$/, '')) || '', anim:true}; named(); return;
      }
      N.frameEdit(v, {url:img.src, kind:'emoji', save:'Use this picture', onSave:f => { ui.emoNew = {d:N.shrinkEmoji(N.cropToFrame(img, f)), n:''}; named(); }});
    }); return; }
  case 'emoCancel': ui.emoNew = null; break;
  case 'emoSave': { const e = ui.emoNew, n = N.emoName(e?.n); if (!gm || !e || !n || g.emoji.some(x => x.n === n)) break;
    /* animated ones are too big to share one document with the rest, so each goes in the picture store, readable by everyone */
    g.emoji.push({id:n, n, d:e.anim ? N.storeImg(e.d, true) : e.d, ...(e.anim ? {a:1} : {})}); ui.emoNew = null; toast(v, `Added :${n}:. Everyone can use it now.`); renderAll(); return; }
  case 'emoDel': { const at = g.emoji.findIndex(x => x.n === val); if (!gm || at < 0) break; const x = g.emoji.splice(at, 1)[0];
    /* an animated one's picture goes once the undo has passed */
    let undone = false; if (x.a) setTimeout(() => { if (!undone && !g.emoji.some(y => y.d === x.d)) N.dropImg(x.d); }, 9000);
    toast(v, `Removed :${x.n}:.`, () => { undone = true; if (!g.emoji.some(y => y.n === x.n)) g.emoji.splice(at, 0, x); }); renderAll(); return; }
  /* the GM editing or deleting a chat message */
  case 'msgEdit': { const m = g.msgs.find(x => x.id === val); ui.pop = null; if (!m || !N.canEdit(v, m)) break; ui.med = {id:m.id, text:m.text}; openSheet(v, 'msgEdit', {v:m.id}); setTimeout(() => { const f = v.root.querySelector(`#med-${v.id}`); if (f) { f.focus(); f.setSelectionRange(f.value.length, f.value.length); } }, 30); break; }
  case 'msgSave': {
    const m = g.msgs.find(x => x.id === ui.med?.id), t = (ui.med?.text || '').trim(); if (!m || !t || !N.canEdit(v, m)) break;
    if (t !== m.text) { m.text = t; m.ed = 1; }
    ui.sheet = null; ui.med = null; toast(v, 'Message edited.'); renderAll(); return;
  }
  case 'msgDelGo': {
    const m = g.msgs.find(x => x.id === val); ui.sheet = null; if (!gm || !m) break;
    N.delMsg(m.id);
    toast(v, 'Message deleted.', () => { if (!g.msgs.some(x => x.id === m.id)) { g.msgs.push(m); g.msgs.sort((a,b) => a.t - b.t || (a.id < b.id ? -1 : 1)); N.invalidateScenes(); } });
    renderAll(); return;
  }
  /* the GM wiping a whole chat's history: pick, warning + tick, type the name, then gone for good */
  case 'wipePick': if (gm && ui.wipe) { ui.wipe.ch = val; ui.wipe.ok = false; ui.wipe.typed = ''; } break;
  case 'wipeStep': if (gm && ui.wipe && ui.wipe.ch) { ui.wipe.step = +val; if (+val < 3) ui.wipe.typed = ''; if (+val === 3) setTimeout(() => { const f = v.root.querySelector(`#wipe-${v.id}`); f && f.focus(); }, 30); } break;
  case 'wipeOk': if (ui.wipe) ui.wipe.ok = !ui.wipe.ok; break;
  case 'wipeExp': { const w = ui.wipe; if (!gm || !w || !w.ch) break; openSheet(v, 'export'); ui.exp.ch = new Set([w.ch]); ui.exp.meta = true; ui.wipe = null; break; }
  case 'wipeGo': {
    const w = ui.wipe; if (!gm || !w || !N.wipeMatch(w) || N.allFights()[w.ch]) break;
    const name = N.chName(w.ch, 'gm'), n = N.wipeChat(w.ch);
    ui.sheet = null; ui.wipe = null;
    if (w.ch !== 'gm') sys(`${N.gmName()} wiped this chat’s history.`, w.ch);
    toast(v, `Wiped ${name}: ${n} message${n === 1 ? '' : 's'} deleted for good.`); renderAll(); return;
  }
  case 'newsDelGo': {
    const at = g.news.issues.findIndex(x => x.id === val), i = g.news.issues[at]; if (!i) break;
    g.news.issues.splice(at, 1); ui.sheet = null; if (ui.newsSel === val) ui.newsSel = null;
    toast(v, `Deleted No. ${i.no}.`, () => g.news.issues.splice(at, 0, i)); renderAll(); return;
  }
  /* GM screen */
  case 'applyScene': { const r = g.recent.find(x => x.id === val); if (!r) break; setScene(v, ui.ch === 'gm' ? 'table' : ui.ch, {title:r.title, where:r.where, art:r.art, place:r.place, aspects:[]}, true); if (ui.sheet === 'gm') ui.sheet = null; renderAll(); return; }
  case 'stress': { const c = g.chars[d.c], on = c.stress[d.k][+d.i] = !c.stress[d.k][+d.i];
    /* a box the GM ticks by hand goes in the open chat's actions, so the table can see what happened */
    sys(`${N.gmName()} ${on ? 'checked' : 'cleared'} ${c.short}’s ${c.stressV[d.k][+d.i]}-point ${d.k === 'phys' ? 'physical' : 'mental'} stress box.`, ui.ch === 'gm' ? 'table' : ui.ch).act = 'stress';
    renderAll(); return; }
  case 'fp': { const c = g.chars[d.c], before = c.fp; c.fp = clamp(c.fp + (+d.d), 0, 10); if (c.fp !== before) sys(+d.d > 0 ? `${N.gmName()} gave ${c.short} a fate point.` : `${c.short} spent a fate point.`, N.homeCh(c.player)); renderAll(); return; }
  case 'gmFor': ui.ch = val; break;
  case 'mapEditGo': close(); ui.tab = 'map'; ui.mapEdit = true; ui.addPin = false; break;
  case 'castNpcs': close(); ui.tab = 'cast'; ui.castSeg = 'npcs'; ui.castSel = null; break;
  /* map */
  case 'mapBack': { const b = ui.mapBack || [], to = b.pop(); if (!to) break; ui.mapId = to; ui.pinSel = null; ui.mapT = null; ui.mapType = 'all'; break; }
  case 'mapGo': ui.mapBack = []; ui.mapId = val; ui.pop = null; ui.pinSel = null; ui.mapT = null; ui.mapType = 'all'; break;
  case 'mapEdit': ui.mapEdit = !ui.mapEdit; ui.addPin = false; break;
  /* map folders: open one in the maps dropdown, make, rename, move or delete one (GM) */
  case 'mapDirGo': ui.mapDir = N.dirById(val) ? val : null; break;
  case 'mdOpen': { const dir = N.dirById(val); ui.pop = null; ui.md = dir ? {id:dir.id, name:dir.name, in:N.dirById(dir.in) ? dir.in : ''} : {id:null, name:'', in:d.in || '', map:d.map || ''}; ui.sheet = 'mapDir'; ui.sheetArg = null; break; }
  case 'mdSave': {
    const md = ui.md, name = (md?.name || '').trim(); if (!name) break;
    g.mapDirs = g.mapDirs || [];
    let dir = md.id && N.dirById(md.id);
    if (!dir) { dir = {id:uid('dir'), name, in:null}; g.mapDirs.push(dir); }
    dir.name = name; dir.in = md.in && md.in !== dir.id && !N.dirTree(dir.id).includes(md.in) ? md.in : null;
    const m = md.map && g.maps.find(x => x.id === md.map);
    if (m) { m.dir = dir.id; ui.md = null; ui.sheet = 'mapSet'; ui.sheetArg = m.id; }
    else { ui.md = null; ui.sheet = null; ui.mapDir = dir.id; openPop(v, 'maps', v.root.querySelector('.mapsel') || el); }
    toast(v, md.id ? `Saved the ${name} folder.` : `Made the ${name} folder.`); renderAll(); return;
  }
  case 'mdDel': {
    /* a deleted folder's maps and folders move up into the folder it sat in */
    const dir = N.dirById(val); if (!dir) break;
    const up = N.dirById(dir.in) ? dir.in : null, at = g.mapDirs.indexOf(dir);
    const maps = g.maps.filter(m => m.dir === dir.id), kids = g.mapDirs.filter(x => x.in === dir.id);
    maps.forEach(m => { if (up) m.dir = up; else delete m.dir; }); kids.forEach(x => { x.in = up; });
    g.mapDirs.splice(at, 1); ui.md = null; ui.sheet = null; if (ui.mapDir === dir.id) ui.mapDir = up;
    toast(v, `Deleted the ${dir.name} folder. What was in it moved up a level.`, () => { g.mapDirs.splice(at, 0, dir); maps.forEach(m => { m.dir = dir.id; }); kids.forEach(x => { x.in = dir.id; }); });
    renderAll(); return;
  }
  /* NPC folders on the Cast page: open one, make, rename, move or delete one (GM only, like the NPCs) */
  case 'npcDirGo': ui.npcDir = N.nd.byId(val) ? val : null; ui.npcQ = ''; break;
  case 'nfOpen': { const dir = N.nd.byId(val); ui.nf = dir ? {id:dir.id, name:dir.name, in:N.nd.byId(dir.in) ? dir.in : ''} : {id:null, name:'', in:N.nd.byId(ui.npcDir) ? ui.npcDir : ''}; ui.sheet = 'npcDir'; ui.sheetArg = null; break; }
  case 'nfSave': {
    const nf = ui.nf, name = (nf?.name || '').trim(); if (!name) break;
    g.npcDirs = g.npcDirs || [];
    let dir = nf.id && N.nd.byId(nf.id);
    if (!dir) { dir = {id:uid('nd'), name, in:null}; g.npcDirs.push(dir); }
    dir.name = name; dir.in = nf.in && nf.in !== dir.id && !N.nd.tree(dir.id).includes(nf.in) ? nf.in : null;
    ui.nf = null; ui.sheet = null; ui.npcDir = dir.id; ui.npcQ = '';
    toast(v, nf.id ? `Saved the ${name} folder.` : `Made the ${name} folder.`); renderAll(); return;
  }
  case 'nfDel': {
    /* a deleted folder's NPCs and folders move up into the folder it sat in */
    const dir = N.nd.byId(val); if (!dir) break;
    const up = N.nd.byId(dir.in) ? dir.in : null, at = g.npcDirs.indexOf(dir);
    const npcs = g.npcs.filter(n => n.dir === dir.id), kids = g.npcDirs.filter(x => x.in === dir.id);
    npcs.forEach(n => { n.dir = up; }); kids.forEach(x => { x.in = up; });
    g.npcDirs.splice(at, 1); ui.nf = null; ui.sheet = null; if (ui.npcDir === dir.id) ui.npcDir = up;
    toast(v, `Deleted the ${dir.name} folder. What was in it moved up a level.`, () => { g.npcDirs.splice(at, 0, dir); npcs.forEach(n => { n.dir = dir.id; }); kids.forEach(x => { x.in = dir.id; }); });
    renderAll(); return;
  }
  case 'mapType': ui.mapType = val; break;
  case 'addPin': ui.addPin = !ui.addPin; if (ui.addPin) toast(v, 'Tap the map where the new place goes.'); break;
  case 'mapDef': { const m = g.maps.find(x => x.id === d.m); if (!m) break; const on = !m.def; for (const x of g.maps) delete x.def; if (on) m.def = true; toast(v, on ? `Players now open the Maps tab on ${m.name}.` : `No default map. Players open the Maps tab on ${N.defMap(false)?.name || 'the first map'}.`); renderAll(); return; }
  case 'mapAud': {
    const m = g.maps.find(x => x.id === ui.sheetArg); if (!m) break;
    /* who saw it before the first change; the GM is asked on Done whether to tell the new ones */
    if (ui.askMap?.id !== m.id) ui.askMap = {id:m.id, before:N.audSeats(m, 'map'), wasAll:N.audOf(m, 'map') === '*'};
    N.audSet(m, 'map', val);
    renderAll(); return;
  }
  case 'mapDelGo': {
    const at = g.maps.findIndex(x => x.id === val), m = g.maps[at]; if (!m) break;
    g.maps.splice(at, 1); ui.sheet = null; ui.pinSel = null; ui.mapT = null; ui.mapEdit = false;
    if (ui.mapId === m.id) ui.mapId = g.maps[0]?.id || null;
    const drop = setTimeout(() => N.dropImg(m.src), 6000);
    toast(v, `Deleted the ${m.name} map.`, () => { clearTimeout(drop); g.maps.splice(at, 0, m); ui.mapId = m.id; ui.mapT = null; });
    renderAll(); return;
  }
  case 'mapUpload': ui.pop = null; N.pickImage((img, f) => {
      const id = uid('map'), src = N.storeImg(N.shrink(img, 2400), false);
      g.maps.push({id, name:f.name.replace(/\.[^.]+$/, ''), src, w:img.naturalWidth, h:img.naturalHeight, vis:false, pins:[], ...(N.dirById(ui.mapDir) ? {dir:ui.mapDir} : {})});
      ui.mapId = id; ui.mapT = null; ui.mapEdit = true; ui.sheet = 'mapSet'; ui.sheetArg = id; toast(v, 'Map added. It stays hidden until you pick who sees it.'); renderAll();
    }); return;
  case 'findParty': ui.mapId = g.party.map; ui.mapT = null; ui.pinSel = '__party'; render(v); return;
  case 'pinClose': ui.pinSel = null; break;
  case 'pinScene': { const m = curMap(v), p = m.pins.find(x => x.id === val); setScene(v, ui.ch === 'gm' ? 'table' : ui.ch, {title:p.label, where:m.name, place:{map:m.id, rx:p.rx, ry:p.ry}, aspects:[]}, true); renderAll(); return; }
  case 'pinParty': { const m = curMap(v), p = m.pins.find(x => x.id === val); moveParty(m, p.rx, p.ry + .002); sys(`The party heads to ${p.label}.`); toast(v, `The party is now at ${p.label}. A note went to Everyone.`); renderAll(); return; }
  case 'pinType': { const p = curMap(v).pins.find(x => x.id === ui.pinSel); if (p) { if (val === 'here' && p.label === 'New place') p.label = 'You are here'; else if (p.type === 'here' && val !== 'here' && p.label === 'You are here') p.label = 'New place'; p.type = val; } renderAll(); return; }
  case 'pinAud': {
    const [mi, pi] = String(ui.sheetArg || '').split('|'), m = g.maps.find(x => x.id === mi), p = m && m.pins.find(x => x.id === pi); if (!p) break;
    /* who could see the place before the first change; the GM is asked on Done whether to tell the new ones */
    const sees = () => N.audSeats(p, 'pin').filter(s => N.audSeats(m, 'map').includes(s));
    if (ui.askPin?.key !== ui.sheetArg) ui.askPin = {key:ui.sheetArg, before:sees()};
    N.audSet(p, 'pin', val);
    renderAll(); return;
  }
  case 'pinDel': { const m = curMap(v), i = m.pins.findIndex(x => x.id === ui.pinSel), p = m.pins[i]; if (!p) break; m.pins.splice(i, 1); ui.pinSel = null; toast(v, `Removed ${p.label}.`, () => m.pins.splice(i, 0, p)); renderAll(); return; }
  /* world */
  case 'wiki': { const en = g.wiki.find(x => x.id === val); if (!en || (!gm && en.gm)) break; close();
    /* phones remember the entries a link was followed from, so back returns to them one by one */
    ui.wikiPrev = v.dev === 'phone' && ui.tab === 'world' && ui.wikiSel && ui.wikiSel !== val ? [...(ui.wikiPrev || []), ui.wikiSel] : [];
    ui.tab = 'world'; ui.wikiSel = val; if (v.dev === 'desktop') ui.wikiCat = en.cat; ui.wikiQ = ui.wikiQ && v.dev === 'desktop' ? ui.wikiQ : ''; const r = v.root.querySelector('[data-sk="wr"]'); if (r) r.scrollTop = 0; break; }
  case 'wCat': ui.wikiCat = ui.wikiCat === val ? null : val; if (v.dev === 'phone') ui.wikiSel = null; break;
  case 'wBack': if (ui.wikiSel && ui.wikiPrev?.length) { ui.wikiSel = ui.wikiPrev.pop(); const r = v.root.querySelector('[data-sk="wr"]'); if (r) r.scrollTop = 0; } else if (ui.wikiSel) ui.wikiSel = null; else ui.wikiCat = null; break;
  case 'wNew': openSheet(v, 'wEdit', {}); break;
  case 'wEdit': openSheet(v, 'wEdit', {v:val}); break;
  case 'wdAud': N.audSet(ui.wd, 'wiki', val); break;
  /* sections only some players read */
  case 'wdPartAdd': ui.wd.parts.push({id:uid('s'), h:'', text:'', see:[]}); break;
  case 'wdPartDel': ui.wd.parts.splice(+val, 1); break;
  case 'wdPartWho': { const p = ui.wd.parts[+d.n]; if (!p) break; const i = p.see.indexOf(val); if (i >= 0) p.see.splice(i, 1); else p.see.push(val); p.see.sort((a,b) => a.slice(1) - b.slice(1)); break; }
  /* pictures start as GM only; saving the entry shares them with whoever can read it */
  case 'wdImgAdd': pickFramed(v, 'wiki', (img, f) => { if (!ui.wd) return; ui.wd.imgs.push({src:N.withFrame(N.storeImg(N.shrink(img, 1400, 600000), false), f), cap:''}); render(v); }); return;
  case 'wdImgFrame': { const p = ui.wd?.imgs[+val]; if (p) reframe(v, 'wiki', p.src, nu => { p.src = nu; render(v); }); return; }
  case 'wdImgDel': {
    /* a picture added in this edit and removed again is deleted now; saved ones go when the entry is saved */
    const [p] = ui.wd.imgs.splice(+val, 1), old = ui.wd.id && g.wiki.find(x => x.id === ui.wd.id);
    if (p && !(old && N.wikiPics(old).some(x => samePic(x.src, p.src)))) N.dropImg(p.src);
    break;
  }
  case 'wDelGo': {
    const at = g.wiki.findIndex(x => x.id === val), en = g.wiki[at]; if (!en) break;
    g.wiki.splice(at, 1); ui.sheet = null; if (ui.wikiSel === val) ui.wikiSel = null;
    toast(v, `Deleted ${en.title}.`, () => g.wiki.splice(at, 0, en)); renderAll(); return;
  }
  case 'wCats': openSheet(v, 'wCats'); break;
  case 'cdIcon': ui.cdIc = ui.cdIc === +d.i ? null : +d.i; break;
  case 'cdIc': ui.cd[+d.i].ic = val; ui.cdIc = null; break;
  case 'cdMove': { const i = +d.i, j = i + (+d.d), r = ui.cd; if (j < 0 || j >= r.length) break; [r[i], r[j]] = [r[j], r[i]]; ui.cdIc = null; break; }
  case 'cdAdd': ui.cd.push({from:null, name:'', ic:'globe'}); ui.cdIc = null; setTimeout(() => { const f = v.root.querySelector(`#cdn${ui.cd.length - 1}-${v.id}`); if (f) f.focus(); }, 30); break;
  case 'cdDel': { const r = ui.cd[+d.i]; if (!r.from) { ui.cd.splice(+d.i, 1); break; } r.del = !r.del; if (r.del) r.to = (ui.cd.find(x => !x.del && x.name.trim()) || {}).name?.trim() || ''; ui.cdIc = null; break; }
  case 'cdSave': {
    const keep = ui.cd.filter(r => !r.del), names = keep.map(r => r.name.trim());
    if (!names.length || names.some((n, i) => !n || names.indexOf(n) !== i)) break;
    const move = {};
    for (const r of ui.cd) if (r.from) move[r.from] = r.del ? (r.to && names.includes(r.to) ? r.to : names[0]) : r.name.trim();
    for (const e of g.wiki) if (move[e.cat] && move[e.cat] !== e.cat) e.cat = move[e.cat];
    g.cats = keep.map(r => ({name:r.name.trim(), ic:r.ic}));
    if (ui.wikiCat && move[ui.wikiCat]) ui.wikiCat = move[ui.wikiCat];
    ui.sheet = null; toast(v, 'Categories saved.'); renderAll(); return;
  }
  case 'wSave': {
    const w = ui.wd, old = w.id && g.wiki.find(x => x.id === w.id);
    const en = {id:w.id || uid('w'), cat:w.cat, title:w.title.trim(), summary:w.summary.trim(),
      info:w.info.split('\n').map(l => l.trim()).filter(Boolean).map(l => { const i = l.indexOf(':'); return i > 0 ? [l.slice(0,i).trim(), l.slice(i+1).trim()] : [l, '']; }),
      body:w.body.split(/\n\s*\n/).map(s => s.trim()).filter(Boolean), secret:w.secret.trim()};
    if (w.gm) en.gm = true;
    if (!w.gm && w.see?.length) en.see = [...w.see];
    if (old) for (const k of ['src','soon']) if (old[k]) en[k] = old[k];
    /* the lore's own picture joins the list, so it can be captioned or removed like the others */
    const parts = (w.parts || []).map(p => ({id:p.id, h:(p.h || '').trim(), text:(p.text || '').trim(), see:[...(p.see || [])]})).filter(p => p.h || p.text);
    if (parts.length) en.parts = parts;
    en.imgs = w.imgs.map(p => { const o = {src:p.src}; if (p.alt) o.alt = p.alt; if (p.cap?.trim()) o.cap = p.cap.trim(); return o; });
    if (old) for (const p of N.wikiPics(old)) if (!en.imgs.some(x => samePic(x.src, p.src))) N.dropImg(p.src);
    const i = g.wiki.findIndex(x => x.id === en.id); if (i >= 0) g.wiki[i] = en; else g.wiki.push(en);
    ui.sheet = null; ui.tab = 'world'; ui.wikiSel = en.id; ui.wikiCat = en.cat; const aud = N.audOf(en, 'wiki'); toast(v, aud === 'gm' ? 'Saved. Only you can see it.' : aud === '*' ? 'Saved. Players can read it.' : `Saved. ${N.audLabel(en, 'wiki')} can read it.`); renderAll(); return;
  }
  /* character + cast */
  case 'charSel': ui.charSel = val; render(v); v.root.querySelector('.party-row [aria-current="true"]')?.scrollIntoView({block:'nearest', inline:'nearest', behavior:'smooth'}); return;
  /* sheet reveals (GM) */
  case 'revOpen': ui.pop = null; ui.sheet = 'reveal'; ui.sheetArg = val; ui.askRev = {id:val, base:JSON.parse(JSON.stringify((g.rev || {})[val] || {}))}; break;
  case 'revSeat': ui.revSeat = val; break;
  case 'revTog': case 'revAll': case 'revMet': {
    const id = ui.sheetArg, st = ui.revSeat; if (!id || !st) break;
    g.rev = g.rev || {}; const by = g.rev[id] = g.rev[id] || {};
    const c = g.chars[id], card = c || g.npcs.find(x => x.id === id); if (!card) break;
    let keys = N.revKeys(card, by[st] || []);
    const mt = keys.filter(k => k.startsWith('met:')); keys = keys.filter(k => !k.startsWith('met:'));
    /* Met / Heard of: the GM decides how this player's character knows them (tap again to clear) */
    if (a === 'revMet') keys = [...keys, ...(val && mt[0] !== 'met:' + val ? ['met:' + val] : [])];
    else if (a === 'revAll') keys = [...(val ? N.revParts(card, !!c).map(p => p.k) : []), ...mt];
    else keys = [...(keys.includes(val) ? keys.filter(k => k !== val) : [...keys, val]), ...mt];
    if (keys.length) by[st] = keys; else delete by[st];
    if (!Object.keys(by).length) delete g.rev[id];
    renderAll(); return;
  }
  case 'castSeg': ui.castSeg = val; ui.castSel = null; break;
  case 'castSel': ui.castSel = val; break;
  case 'castBack': ui.castSel = null; break;
  case 'pcEdit': openSheet(v, 'pcEdit', {v:val}); break;
  case 'pdPortrait': ui.pd.portrait = val; break;
  case 'pdUpload': uploadFace(v, src => { ui.pd.portrait = src; }); return;
  case 'pdFrame': if (ui.pd?.portrait) reframe(v, 'face', ui.pd.portrait, nu => { ui.pd.portrait = nu; render(v); }); return;
  case 'pdSkillDel': delete ui.pd.skills[val]; break;
  case 'pdSkillMv': ui.pd.skills[val] = N.skillStep(ui.pd.skills[val], +d.d); break;
  case 'pdStuntAdd': ui.pd.stunts.push(['','']); break;
  case 'pdStuntDel': ui.pd.stunts.splice(+d.i, 1); break;
  case 'pdDisc': pickDisc(ui.pd, d.s, val); break;
  case 'pdStep': ui.pd[d.k] = clamp(ui.pd[d.k] + (+d.d), 0, 10); break;
  case 'pcSave': savePc(v); return;
  case 'pcDelete': {
    const old = g.chars[val]; g.chars[val] = N.decorate(N.blankChar(val, old.player));
    if (old.mpic) g.chars[val].mpic = old.mpic; /* the player's Meta picture is theirs, not the card's */
    ui.sheet = null; toast(v, `${old.short}’s card is empty again.`, () => { g.chars[val] = old; }); renderAll(); return;
  }
  case 'invAdd': {
    const c = invOwner(d, v), key = d.nd ? 'nd' : c.id, inp = v.root.querySelector(`#inv-${key}-${v.id}`), n = (inp?.value || '').trim(), q = ui.invQ || 1;
    let note = (v.root.querySelector(`#invd-${key}-${v.id}`)?.value || '').trim();
    if (!n) { toast(v, 'Type an item name first.'); break; }
    if (!c.inv) c.inv = [];
    /* a name from the GM's item catalog brings its description and picture along */
    const cat = N.itemByName(n), ic = cat && cat.ic && cat.ic !== 'bag' ? cat.ic : null;
    if (cat && !note) note = N.itemNote(cat);
    const ex = c.inv.find(x => x[0].toLowerCase() === n.toLowerCase()); if (ex) { ex[1] += q; if (note) ex[2] = note; } else c.inv.push(ic ? [cat.name, q, note, ic] : note ? [cat ? cat.name : n, q, note] : [cat ? cat.name : n, q]);
    const nr = ex || c.inv[c.inv.length - 1]; if (cat && N.itemSlot(cat)) N.invSetX(nr, {w:1, ...(cat.ammo && N.invX(nr).am == null ? {am:N.AMMO_MAX} : {})});
    if (d.nd) { ui.invQ = 1; renderAll(); return; }
    if (!d.c) { ui.invQ = 1; toast(v, `Added to ${c.name}’s inventory.`); renderAll(); return; }
    sys(`${N.gmName()} added ${n} ×${q} to ${c.short}’s inventory.`, 'dm-' + c.player); ui.invQ = 1;
    toast(v, `Added to ${c.short}’s inventory. They got a note.`); renderAll(); return;
  }
  case 'invQty': { const c = invOwner(d, v), it = c?.inv?.[+d.i]; if (!it) break; it[1] += +d.d; if (it[1] <= 0) { c.inv.splice(+d.i, 1); if (N.invX(it).eq && !d.nd) N.applyGear(c); if (d.c) sys(`${N.gmName()} removed ${it[0]} from ${c.short}’s inventory.`, 'dm-' + c.player); } renderAll(); return; }
  case 'invEdit': ui.invEdit = {key:d.nd ? 'nd' : invOwner(d, v)?.id, i:+d.i}; break;
  case 'invEditCancel': ui.invEdit = null; break;
  case 'invIc': if (ui.invEdit) ui.invEdit.ic = val; break;
  case 'invSave': {
    const c = invOwner(d, v), it = c?.inv?.[+d.i], key = d.nd ? 'nd' : c?.id; if (!it) { ui.invEdit = null; break; }
    const get = k => (v.root.querySelector(`#ie${k}-${key}-${v.id}`)?.value || '').trim();
    const n = get('n'), q = parseInt(get('q'), 10), note = get('d'), ic = ui.invEdit?.ic ?? it[3];
    if (!n) { toast(v, 'An item needs a name.'); break; }
    ui.invEdit = null;
    if (q === 0) { c.inv.splice(+d.i, 1); if (d.c) sys(`${N.gmName()} removed ${it[0]} from ${c.short}’s inventory.`, 'dm-' + c.player); renderAll(); return; }
    const was = it[0], x = it[4]; c.inv[+d.i] = [n, q > 0 ? q : it[1], note, ...(ic && ic !== 'bag' || x ? [ic || 'bag'] : []), ...(x ? [x] : [])];
    if (d.c) sys(`${N.gmName()} changed ${was === n ? n : `${was} to ${n}`} in ${c.short}’s inventory.`, 'dm-' + c.player);
    renderAll(); return;
  }
  /* Jake's weapon rules: equip a weapon or armor (fills the card's ratings), and step an ammo count */
  case 'invEquip': { const c = invOwner(d, v); if (!c) break; const r = N.equipRow(c, +d.i); if (!r) break;
    if (r.no) { toast(v, r.no); break; }
    if (d.c) sys(`${N.gmName()}: ${c.short} ${N.invX(c.inv[+d.i]).eq ? 'equipped' : 'put away'} ${c.inv[+d.i][0]}.`, 'dm-' + c.player);
    toast(v, r.ok); renderAll(); return; }
  case 'invAmmo': { const c = invOwner(d, v), row = c?.inv?.[+d.i]; if (!row) break; const x = N.invX(row);
    N.invSetX(row, {am:Math.max(0, Math.min(N.AMMO_MAX, (x.am || 0) + +d.d))}); renderAll(); return; }
  case 'invDel': { ui.invEdit = null; const c = invOwner(d, v), it = c?.inv?.splice(+d.i, 1)[0]; if (it && N.invX(it).eq && !d.nd) N.applyGear(c); if (it && d.c) sys(`${N.gmName()} removed ${it[0]} from ${c.short}’s inventory.`, 'dm-' + c.player); renderAll(); return; }
  /* the GM's item catalog (GM tools > Item catalog): add, edit, delete, and give an item to a character or NPC */
  case 'itKind': ui.itK = val || ''; ui.itC = ''; break;
  case 'itCls': ui.itC = val || ''; break;
  case 'itdSilver': if (ui.itd) ui.itd.silver = ui.itd.silver ? 0 : 1; break;
  case 'itImport': {
    const inp = document.createElement('input'); inp.type = 'file'; inp.accept = '.json,application/json';
    inp.onchange = () => { const f = inp.files?.[0]; if (!f) return;
      f.text().then(t => { const j = JSON.parse(t), list = Array.isArray(j) ? j : j.items; if (!Array.isArray(list)) throw new Error('no items');
        const r = N.importItems(list); toast(v, `Imported ${r.add} new item${r.add === 1 ? '' : 's'}${r.rep ? `, updated ${r.rep}` : ''}.`); renderAll(); })
        .catch(err => { console.error(err); toast(v, 'That isn’t a Norne items file.'); }); };
    inp.click(); return;
  }
  case 'itNew': ui.itd = {id:null, name:'', kind:ui.itK || 'weapon', ic:'', d:'', gm:'', gearAtk:0, gearRng:0, gearAmmo:0, gearDef:0}; ui.sheet = 'itemEd'; break;
  case 'itEdit': { const it = N.itemById(val); if (!it) break; ui.itd = {ic:'', d:'', gm:'', ...JSON.parse(JSON.stringify(it))}; ui.sheet = 'itemEd'; break; }
  case 'itdKind': if (ui.itd) ui.itd.kind = val; break;
  case 'itdIc': if (ui.itd) ui.itd.ic = val; break;
  case 'itSave': {
    const d = ui.itd, name = (d?.name || '').trim(); if (!name) break;
    if (!g.items) g.items = [];
    const dup = g.items.find(x => x.id !== d.id && x.name.toLowerCase() === name.toLowerCase());
    if (dup) { toast(v, `There is already an item called ${dup.name}.`); break; }
    /* fields this sheet doesn't show (Jake's rule flags from an items file) are kept as they were */
    const it = {...d, id:d.id || uid('it'), name, kind:N.itemKind(d.kind)[0], ic:d.ic && d.ic !== N.itemKind(d.kind)[2] ? d.ic : '', d:(d.d || '').trim(), gm:(d.gm || '').trim(), cls:(d.cls || '').trim(), disc:(d.disc || '').trim()};
    for (const k of ['cls', 'disc', 'silver']) if (!it[k]) delete it[k];
    for (const [k] of N.ITEM_RATE) if (+d[k] > 0) it[k] = +d[k]; else delete it[k];
    const at = g.items.findIndex(x => x.id === it.id); if (at >= 0) g.items[at] = it; else g.items.push(it);
    g.items.sort((a, b) => a.name.localeCompare(b.name));
    ui.itd = null; ui.sheet = 'items'; if (ui.itK && ui.itK !== it.kind) ui.itK = it.kind;
    toast(v, at >= 0 ? `Saved ${name}.` : `Added ${name} to the catalog.`); renderAll(); return;
  }
  case 'itDel': {
    const at = (g.items || []).findIndex(x => x.id === val); if (at < 0) break;
    const [it] = g.items.splice(at, 1); ui.itd = null; ui.sheet = 'items';
    toast(v, `Deleted ${it.name} from the catalog. Inventories that have it keep it.`, () => { g.items.splice(at, 0, it); });
    renderAll(); return;
  }
  case 'itGive': { const it = N.itemById(val); if (!it) break; ui.itg = {id:it.id, to:ui.itg?.to && N.itemTo(ui.itg.to) ? ui.itg.to : '', q:1, gear:N.itemCardGears(it).length > 0}; ui.sheet = 'itemGive'; break; }
  case 'itgQ': if (ui.itg) ui.itg.q = Math.max(1, Math.min(9999, ui.itg.q + +d.d)); break;
  case 'itgGear': if (ui.itg) ui.itg.gear = !ui.itg.gear; break;
  case 'itGiveGo': {
    const t = ui.itg, it = t && N.itemById(t.id), who = t && N.itemTo(t.to); if (!it || !who) break;
    const o = who.o, q = Math.max(1, t.q || 1), note = N.itemNote(it), ic = it.ic || N.itemKind(it.kind)[2];
    if (!o.inv) o.inv = [];
    const ex = o.inv.find(x => x[0].toLowerCase() === it.name.toLowerCase());
    let row = ex;
    if (ex) { ex[1] += q; if (note) ex[2] = note; if (ic !== 'bag') ex[3] = ic; } else { row = ic !== 'bag' ? [it.name, q, note, ic] : [it.name, q, note]; o.inv.push(row); }
    /* weapons and armor go on the weapons list; ammo and thrown weapons start full */
    if (N.itemSlot(it)) N.invSetX(row, {w:1, ...(it.ammo && N.invX(row).am == null ? {am:N.AMMO_MAX} : {})});
    const gs = t.gear ? N.itemCardGears(it) : [];
    for (const [k] of gs) o[k] = +it[k];
    if (who.pc) sys(`${N.gmName()} gave ${o.short} ${it.name} ×${q}.${gs.length ? ` ${gs.map(([k, l]) => `${l} rating is now +${+it[k]}`).join(', ').replace(/^./, c => c.toUpperCase())}.` : ''}`, 'dm-' + o.player);
    ui.sheet = 'items';
    toast(v, `Gave ${it.name} ×${q} to ${who.label}.${who.pc ? ' They got a note.' : ''}`); renderAll(); return;
  }
  case 'npcNew': openSheet(v, 'npcNew', d); break;
  case 'npcEdit': openSheet(v, 'npcNew', {edit:val}); break;
  case 'myFace': { const c = N.charOf(v.role); if (c) myFace(v, c, val); return; }
  case 'myFaceNone': { const c = N.charOf(v.role); if (c) myFace(v, c, null); return; }
  case 'myFaceUp': pickFramed(v, 'face', (img, f) => { const c = N.charOf(v.role); if (c) myFace(v, c, N.withFrame(N.shrink(img, 360, 60000), f)); }); return;
  case 'metaUp': pickFramed(v, 'face', (img, f) => metaPic(v, N.withFrame(N.shrink(img, 360, 60000), f))); return;
  case 'metaFrame': { const p = N.metaPic(v.role); if (p) reframe(v, 'face', p, nu => metaPic(v, nu)); return; }
  case 'metaNone': metaPic(v, null); return;
  case 'myFaceFrame': { const c = N.charOf(v.role); if (c?.portrait) reframe(v, 'face', c.portrait, nu => myFace(v, c, nu)); return; }
  case 'ndPortrait': ui.nd.portrait = val; break;
  case 'ndUpload': uploadFace(v, src => { ui.nd.portrait = src; }); return;
  case 'ndFrame': if (ui.nd?.portrait) reframe(v, 'face', ui.nd.portrait, nu => { ui.nd.portrait = nu; render(v); }); return;
  case 'ndType': ui.nd.type = val; break;
  case 'ndSkillDel': delete ui.nd.skills[val]; break;
  case 'ndSkillMv': ui.nd.skills[val] = N.skillStep(ui.nd.skills[val], +d.d); break;
  case 'ndDisc': pickDisc(ui.nd, d.s, val); break;
  case 'ndStuntAdd': ui.nd.stunts.push(['','']); break;
  case 'ndStuntDel': ui.nd.stunts.splice(+d.i, 1); break;
  case 'ndStep': ui.nd[d.k] = clamp(ui.nd[d.k] + (+d.d), 0, 10); break;
  case 'npcSave': saveNpc(v); return;
  case 'npcDup': { const n = g.npcs.find(x => x.id === val); if (!n) break; const c = JSON.parse(JSON.stringify(n)); c.id = uid('n'); c.name = n.name + ' (copy)'; g.npcs.push(c); ui.castSel = c.id; toast(v, 'Duplicated.'); renderAll(); return; }
  case 'npcDelGo': { const i = g.npcs.findIndex(x => x.id === val), n = g.npcs[i]; if (!n) break; g.npcs.splice(i, 1); ui.sheet = null; ui.castSel = null; toast(v, `${n.name} deleted.`, () => g.npcs.splice(i, 0, n)); renderAll(); return; }
  /* an NPC's fate points change right on its card, without opening Edit. Secret, so nothing is posted */
  case 'npcFp': { const n = g.npcs.find(x => x.id === d.n); if (!n || !gm) break; n.fp = clamp((+n.fp || 0) + (+d.d), 0, 10); renderAll(); return; }
  /* Gold on a character (data-c) or NPC (data-n) card, whole numbers only, GM only */
  case 'gold': { if (!gm) break; const o = d.c ? g.chars[d.c] : g.npcs.find(x => x.id === d.n); if (!o) break; o.gold = clamp((parseInt(o.gold, 10) || 0) + (+d.d), 0, N.GOLD_MAX); renderAll(); return; }
  case 'npcStress': { const n = g.npcs.find(x => x.id === d.n); n.stress[d.k][+d.i] = !n.stress[d.k][+d.i]; renderAll(); return; }
  case 'npcToFight': { if (cb.state === 'off') { toast(v, 'Begin a fight first.'); break; } const t = N.cbAddNpc(val, 'foe', cb.zones[0]?.id); toast(v, `${t.name} joins the fight${cb.zones[0] ? ' in ' + cb.zones[0].name : ''}.`); renderAll(); return; }
  /* players and sign-ins */
  case 'admit': { const n = N.admit(val); if (n) toast(v, `${n} is in. Their seat has an empty card for you to fill.`); break; }
  case 'reject': { const m = N.kick(val); if (m) toast(v, /^p\d+$/.test(m.role) ? `${m.name} no longer has a seat. You can let them back in any time.` : `Turned ${m.name} away.`); ui.sheet = 'players'; break; }
  case 'importLore': {
    const inp = document.createElement('input'); inp.type = 'file'; inp.accept = '.json,application/json';
    inp.onchange = () => { const f = inp.files?.[0]; if (!f) return; toast(v, 'Importing…');
      N.importLore(f).then(dd => { ui.sheet = null; toast(v, `Imported ${dd.wiki.length} wiki entries and ${dd.maps.length} maps.`); if (!ui.mapId) ui.mapId = (g.maps.find(m => m.id === 'norne') || g.maps[0])?.id; renderAll(); })
        .catch(err => { console.error(err); toast(v, 'That isn’t the Norne lore file.'); }); };
    inp.click(); return;
  }
  /* export */
  case 'expCh': { const s = ui.exp.ch; s.has(val) ? s.delete(val) : s.add(val); break; }
  case 'expKind': ui.exp[val] = !ui.exp[val]; break;
  case 'expWhen': {
    const ex = ui.exp, now = Date.now(); ex.when = val; ex.to = '';
    if (val === 'all') ex.from = '';
    else if (val === 'day') ex.from = N.expStamp(now - 864e5);
    else if (val === 'week') ex.from = N.expStamp(now - 7 * 864e5);
    else { const sc = [...g.msgs].reverse().find(m => m.kind === 'scene' && m.scene && !m.quiet && ex.ch.has(m.ch)); ex.from = sc ? N.expStamp(sc.t) : ''; if (!sc) toast(v, 'No scene in the picked chats yet, so this is everything.'); }
    break;
  }
  case 'copyMsg': {
    const m = g.msgs.find(x => x.id === val); ui.pop = null; render(v); if (!m) return;
    const t = N.msgCopyText(m), old = () => { const ta = document.createElement('textarea'); ta.value = t; ta.setAttribute('readonly', ''); ta.style.cssText = 'position:fixed;top:0;left:0;opacity:0'; document.body.appendChild(ta); ta.select(); let ok = false; try { ok = document.execCommand('copy'); } catch(err) {} ta.remove(); toast(v, ok ? 'Copied.' : 'Could not copy on this device.'); };
    try { navigator.clipboard.writeText(t).then(() => toast(v, 'Copied.'), old); } catch(err) { old(); }
    return;
  }
  case 'expCopy': {
    const t = v.root.querySelector('#exOut'); if (!t) return;
    const sel = () => { t.select(); toast(v, 'Text selected. Copy it with your keyboard.'); };
    try { navigator.clipboard.writeText(t.value).then(() => toast(v, 'Copied. Paste it wherever you keep notes.'), sel); } catch(err) { sel(); }
    return;
  }
  case 'expDl': {
    const t = v.root.querySelector('#exOut'); if (!t) return;
    const dt = new Date(), p = n => String(n).padStart(2, '0');
    const js = !!ui.exp.json, url = URL.createObjectURL(new Blob([t.value], {type:js ? 'application/json' : 'text/markdown'})), aEl = document.createElement('a');
    aEl.href = url; aEl.download = `norne-log-${dt.getFullYear()}-${p(dt.getMonth()+1)}-${p(dt.getDate())}.${js ? 'json' : 'md'}`; document.body.appendChild(aEl); aEl.click(); aEl.remove();
    setTimeout(() => URL.revokeObjectURL(url), 2000); return;
  }
  /* roll sheet */
  case 'rollWho': { ui.roll.who = val; if (ui.roll.vsNpc && 'npc:' + ui.roll.vsNpc === val) ui.roll.vsNpc = null; const r = N.rollerOf(v, val); ui.roll.skill = Object.entries(r.skills).sort((a,b)=>b[1]-a[1])[0]?.[0] || 'Notice'; ui.roll.target = null; break; }
  case 'rollAct': ui.roll.action = val; if (val === 'defend') { ui.roll.skill = 'Athletics'; } if (val === 'attack') { const r = N.rollerOf(v, ui.roll.who); ui.roll.skill = (r.skills.Shooting||0) > (r.skills.Fighting||0) ? 'Shooting' : 'Fighting'; } break;
  case 'rollTgt': ui.roll.target = val; ui.roll.ctx = 'cb'; break;
  case 'rollDist': ui.roll.dist = +val || 0; break;
  case 'rollMod': ui.roll.mod = clamp(+val || 0, -6, 6); break;
  case 'rollSkill': { const r = ui.roll; r.skill = val; if (val in vsSkillMem) { r.vsSkill = vsSkillMem[val]; const n = r.vsNpc && g.npcs.find(x => x.id === r.vsNpc); if (n && r.vsSkill) r.opp = n.skills[r.vsSkill] || 0; } break; }
  case 'rollAll': ui.roll.all = true; break;
  case 'rollOpp': ui.roll.opp = val === 'null' ? null : +val; break;
  case 'rollVsSkill': { const r = ui.roll; r.vsSkill = r.vsSkill === val ? null : val; vsSkillMem[r.skill] = r.vsSkill; vsSkillSave(); const n = N.vsFind(v, r, r.vsNpc); if (n && r.vsSkill) r.opp = n.skills[r.vsSkill] || 0; break; }
  case 'rollAllWho': ui.roll.allWho = !ui.roll.allWho; break;
  case 'rollAllVs': ui.roll.allVs = !ui.roll.allVs; break;
  case 'rollVsNpc': { const r = ui.roll; r.vsNpc = val || null; const n = N.vsFind(v, r, r.vsNpc); if (n && r.vsSkill) r.opp = n.skills[r.vsSkill] || 0; break; }
  case 'rollPassive': ui.roll.passive = ui.roll.passive === false; break;
  case 'rollSecret': ui.roll.secret = !ui.roll.secret; break;
  case 'rollBonus': ui.roll.otherBonus = clamp((+ui.roll.otherBonus || 0) + (+d.d), -4, 10); break;
  case 'doRoll': doRoll(v); return;
  /* scene sheet */
  case 'sdFor': { const sd = ui.sd; sd.ch = val;
    /* another chat: open its scene to edit, unless the GM is already building a new one */
    if (g.scenes[val] && !(sd.mode === 'new' && sd.touched)) sdLoad(sd, 'edit');
    else { const keep = {title:sd.title, where:sd.where, date:sd.date, art:sd.art, place:sd.place, aspects:sd.aspects, loc:sd.loc, share:sd.share, touched:sd.touched}; sdLoad(sd, 'new'); if (keep.touched) Object.assign(sd, keep); }
    break; }
  case 'sdMode': sdLoad(ui.sd, val); break;
  case 'sdOneAdd': { const sd = ui.sd, name = (sd.oneName || '').trim(); if (!name) { toast(v, 'Give them a name first.'); break; }
    let x = sd.extras.find(e => e.name.toLowerCase() === name.toLowerCase());
    if (!x) { if (N.npcByName(name)) { toast(v, `${name} already has an NPC card. Pick them under NPCs in this scene.`); break; } x = {id:uid('o'), name, skills:{}}; sd.extras.push(x); }
    if (sd.oneSkill) x.skills[sd.oneSkill] = +sd.oneRate || 0;
    sd.oneName = ''; sd.oneSkill = ''; break; }
  case 'sdOneDel': ui.sd.extras.splice(+val, 1); break;
  case 'sdSave': { const s = ui.sd; sdKeep(s); if (!editScene(v, s)) { toast(v, 'That scene has ended. Start a new one instead.'); sdLoad(s, 'new'); break; } ui.sheet = null; renderAll(); return; }
  case 'sdTab': ui.sd.tab = val; break;
  case 'sdPick': {
    let p = null;
    if (val.startsWith('pl:')) { const [, map, pid] = val.split(':'); const mp = g.maps.find(m => m.id === map), pin = mp && mp.pins.find(x => x.id === pid); if (pin) p = {title:pin.label, where:mp.name, place:{map, rx:pin.rx, ry:pin.ry}}; }
    else { const r = g.recent.find(x => x.id === val); if (r) p = {title:r.title, where:r.where, art:r.art, place:r.place}; else { const al = N.ARTLIB.find(x => x.id === val); if (al) p = {title:'', where:'', art:al.art, place:null}; } }
    if (!p) break;
    ui.sd.art = p.art || null; ui.sd.place = p.place || null; ui.sd.touched = true;
    if (p.title && (!ui.sd.title || ui.sd.autoTitle)) { ui.sd.title = p.title; ui.sd.where = p.where || ui.sd.where; ui.sd.autoTitle = true; }
    break;
  }
  case 'sdPickUp': ui.sd.art = val; ui.sd.place = null; ui.sd.touched = true; break;
  case 'sdFrame': if (ui.sd?.art) reframePic(v, ui.sd.art); return;
  case 'sdUpload': uploadPicture(v, src => { ui.sd.art = src; ui.sd.place = null; ui.sd.touched = true; ui.sd.tab = 'pics'; }); return;
  case 'sdAspAdd': { const t = (ui.sd.newAsp || '').trim(); if (t) { ui.sd.aspects.push({t, free:0, k:uid('a')}); ui.sd.newAsp = ''; } break; }
  case 'sdAspFree': { const a = ui.sd.aspects[+d.i]; a.free = ((a.free || 0) + 1) % 3; break; }
  case 'sdAspDel': ui.sd.aspects.splice(+d.i, 1); break;
  case 'sdCast': { const c = ui.sd.cast, i = c.indexOf(val); if (i >= 0) c.splice(i, 1); else c.push(val); break; }
  case 'sdCastNone': ui.sd.cast = []; break;
  /* NPC folders in the scene's cast picker: open or close one, or pick everyone in it (and the folders inside it) */
  case 'sdDirTog': { const o = ui.sd.dirOpen = ui.sd.dirOpen || {}; o[val] = !o[val]; break; }
  case 'sdCastDir': {
    const names = N.nd.npcs(val).map(n => n.name.trim()).filter(Boolean), c = ui.sd.cast, all = names.every(n => c.includes(n));
    ui.sd.cast = all ? c.filter(n => !names.includes(n)) : [...c, ...names.filter(n => !c.includes(n))];
    (ui.sd.dirOpen = ui.sd.dirOpen || {})[val] = true; break;
  }
  case 'sdPost': ui.sd.post = !ui.sd.post; break;
  case 'sdShare': ui.sd.share = !ui.sd.share; break;
  case 'sdLocClear': ui.sd.loc = {c:'', t:'', n:''}; break;
  /* the beacon: tap it to open the next map down */
  case 'locGo': { const loc = N.myLoc(v.role, ui.ch), o = loc && loc[val]; if (!o) break;
    const to = o.to && g.maps.find(m => m.id === o.to && seeMap(v, m));
    if (to) { openMapFrom(v, to.id); ui.pop = null; ui.pinSel = null; ui.mapT = null; ui.mapType = 'all'; break; }
    toast(v, o.to ? `You’re in ${o.l}. ${N.gmName()} hasn’t shared that map yet.` : `You’re in ${o.l}.`); return; }
  case 'locHere': { const loc = N.myLoc(v.role, ui.ch); if (!loc) break;
    const k = N.LOCK.find(k => loc[k] && g.maps.some(m => m.id === loc[k].m && seeMap(v, m))); if (!k) { toast(v, `You’re in ${N.locText(loc)}.`); return; }
    ui.mapId = loc[k].m; ui.pop = null; ui.pinSel = null; ui.mapT = null; ui.mapType = 'all'; break; }
  case 'sdApply': { const s = ui.sd; sdKeep(s); setScene(v, s.ch, {title:s.title.trim(), where:s.where.trim(), date:s.date.trim(), art:s.art, place:s.place, aspects:s.aspects, loc:s.loc, share:s.share}, s.post); ui.sheet = null; renderAll(); return; }
  /* ending a scene takes its banner down and lets its one-off NPCs and NPC list go (Undo brings them back) */
  case 'sdEnd': { const ch = val || ui.sd?.ch; if (!ch || !g.scenes[ch]) { ui.sheet = null; break; }
    const cast = g.casts[ch], once = g.extras[ch]; delete g.casts[ch]; delete g.extras[ch];
    const title = g.scenes[ch].title, m = push({ch, kind:'scene', by:'gm', scene:null, quiet:true});
    /* Jake: the log shows where a scene ended, like it shows where one started */
    const note = push({ch, kind:'sys', by:'gm', text:title ? `Scene ended: ${title}.` : 'Scene ended.', sceneEnd:true, sceneTitle:title || ''}); ui.sheet = null;
    toast(v, 'Scene ended.', () => { N.delMsg(note.id); N.delMsg(m.id); if (cast) g.casts[ch] = cast; if (once) g.extras[ch] = once; N.renderAll(); }); renderAll(); return; }
  /* fight */
  case 'cbBegin': if (N.metaOnly(val || ui.ch)) { toast(v, `No fights in ${ (val || ui.ch) === 'table' ? 'Everyone' : N.chName(val || ui.ch, 'gm')}, it’s Meta only. Open a chat that isn’t Meta only to begin one.`); break; } N.cbBegin(val || ui.ch); close(); ui.tab = 'chat'; ui.ch = N.fightCh(); ui.fightOpen = true; ui.fightPane = 'fight'; ui.cbTool = 'zone'; ui.tokSel = null; renderAll(); return;
  case 'openFight': close(); ui.tab = 'chat'; ui.ch = val || N.fightCh(); focusFight(v); ui.fightOpen = true; ui.fightPane = 'fight'; break;
  case 'closeFight': ui.fightOpen = false; ui.fightPane = 'chat'; ui.tokSel = null; ui.targeting = null; break;
  case 'pane': ui.fightPane = val; ui.targeting = null; break;
  case 'fightTools': ui.fightTools = !ui.fightTools; break;
  case 'watch': ui.watching = true; ui.fightOpen = true; ui.fightPane = 'fight'; ui.tab = 'chat'; ui.ch = N.fightCh(); close(); break;
  case 'join': {
    const c = N.charOf(v.role); if (!c || cb.state !== 'live') break;
    if (!cb.joined.includes(v.role)) cb.joined.push(v.role);
    let t = cb.tokens.find(x => x.kind === 'pc' && x.ref === c.id);
    if (!t) { t = N.tokFromPc(c); cb.tokens.push(t); }
    N.cbLateInit(t);
    if (!t.zone) t.zone = cb.zones[0]?.id;
    if (!cb.invited.includes(c.id)) cb.invited.push(c.id);
    fsys(`${c.short} joins the fight.`);
    close(); ui.tab = 'chat'; ui.ch = N.fightCh(); ui.fightOpen = true; ui.fightPane = 'fight'; renderAll(); return;
  }
  case 'cbTool': ui.cbTool = val; ui.targeting = null; ui.placing = null; if (val !== 'zone') ui.zoneSel = null; break;
  case 'cbNext': N.cbNext(); ui.targeting = null; renderAll(); return;
  case 'cbNotice': N.cbNotice(); renderAll(); return;
  case 'cbFirst': N.cbFirst(d.t); renderAll(); return;
  case 'cbGo': N.cbGo(); ui.targeting = null; renderAll(); return;
  case 'cbCancel': ui.targeting = null; ui.placing = null; break;
  case 'cbAct': {
    const a2 = N.actorTok(v) || (gm ? N.curTok() : null); if (!a2) break;
    const key = a2.kind === 'pc' ? 'pc:' + a2.ref : 'tok:' + a2.id;
    if (val === 'attack' || val === 'move') { ui.targeting = ui.targeting === val ? null : val; ui.tokSel = null; break; }
    if (val === 'event') { openRoll(v, {who:key, action:'overcome', ctx:'cb', event:true}); break; }
    const sk = N.tokSkills(a2), pick = list => list.map(s => [s, sk[s]||0]).sort((x,y) => y[1]-x[1])[0][0];
    openRoll(v, {who:key, action:val, ctx:'cb', opp:2, skill: val === 'advantage' ? pick(['Notice','Provoke','Athletics','Deception','Fighting']) : pick(['Athletics','Strength','Will','Notice'])});
    break;
  }
  case 'cbDefend': cbDefend(v); return;
  case 'cbStyle': N.cbStyle(val); renderAll(); return;
  case 'cbBoostName': { const b = cb.aspects.find(x => x.boost && !x.t), t = (ui.boostName || '').trim(); if (!b) break; if (!t) { toast(v, 'Give the boost a short name first.'); break; } b.t = t; ui.boostName = ''; fsys(`${b.by}’s boost${b.on ? ` on ${b.on}` : ''}: “${t}”.`); renderAll(); return; }
  case 'cbDrop': if (cb.pending) { const t = N.tokById(cb.pending.def); cb.pending = null; fsys(`${N.gmName()} settles the hit on ${t ? N.tokName(t) : 'them'} by hand.`); } renderAll(); return;
  case 'cbAbsorb': cbAbsorb(v, d.k, +d.i); return;
  case 'tokClose': ui.tokSel = null; break;
  case 'tokFp': { const t = N.tokById(d.t), pool = t && N.tokFpPool(t); if (!pool) return; const o = pool.o, before = o.fp || 0; o.fp = clamp(before + (+d.d), 0, 10);
    /* a PC's change goes in the fight chat; an NPC's pool stays the GM's secret */
    if (o.fp !== before && pool.pc) Object.assign(N.sys(+d.d > 0 ? `${N.gmName()} gave ${pool.name} a fate point.` : `${N.gmName()} took a fate point from ${pool.name}.`, N.fightCh()), {fight:true});
    renderAll(); return; }
  case 'tokStress': { const t = N.tokById(d.t), s = N.tokStress(t); s.s[+d.i] = !s.s[+d.i]; renderAll(); return; }
  case 'tokTurn': { const o = N.order(), i = o.findIndex(t => t.id === d.t); if (i >= 0) { cb.turn = i; cb.acted = false; cb.moved = false; cb.pending = null; } ui.tokSel = null; ui.sheet = null; renderAll(); return; }
  case 'tokOut': { const t = N.tokById(d.t); t.out = !t.out; if (t.out && cb.state === 'live') fsys(`${N.tokName(t)} is taken out.`); ui.sheet = null; renderAll(); return; }
  case 'tokRemove': { const t = N.cbRemove(d.t); ui.tokSel = null; ui.sheet = null; if (t) toast(v, `${N.tokName(t)} removed from the fight.`); renderAll(); return; }
  case 'cbBg': cb.bg = val; renderAll(); return;
  /* picture shelf on the GM screen */
  case 'picSel': ui.picSel = ui.picSel === val ? null : val; break;
  case 'picUpload': uploadPicture(v, src => { ui.picSel = g.pics[0].id; }); return;
  case 'picFight': { const p = g.pics.find(x => x.id === val); if (!p || cb.state === 'off') break; cb.bg = p.src; ui.picSel = null; toast(v, `Fight background changed for ${cb.title}.`); renderAll(); return; }
  case 'picScene': { const p = g.pics.find(x => x.id === val); if (!p) break; ui.picSel = null; openSheet(v, 'scene'); Object.assign(ui.sd, {art:p.src, place:null, touched:true, tab:'pics'}); render(v); return; }
  case 'picDel': {
    const i = g.pics.findIndex(x => x.id === val); if (i < 0) break;
    const p = g.pics[i]; let kept = false;
    g.pics.splice(i, 1); ui.picSel = null;
    /* the picture itself is only removed once the Undo has run out */
    toast(v, 'Picture deleted.', () => { kept = true; g.pics.splice(Math.min(i, g.pics.length), 0, p); });
    setTimeout(() => { if (!kept && !g.pics.some(x => x.src === p.src) && N.dropImg) N.dropImg(p.src); }, 5500);
    renderAll(); return;
  }
  case 'cbBgUpload': uploadPicture(v, src => { cb.bg = src; }); return;
  case 'picFrame': { const p = g.pics.find(x => x.id === val); if (p) reframePic(v, p.src); else if (val === 'fight' && cb.bg) reframePic(v, cb.bg); return; }
  case 'zoneEdit': ui.zoneSel = ui.zoneSel === val && v.dev === 'desktop' ? null : val; ui.cbTool = 'zone'; if (v.dev === 'phone') { ui.sheet = 'zone'; ui.sheetArg = val; } break;
  case 'zoneCol': cb.zones.find(z => z.id === d.z).col = val; renderAll(); return;
  case 'zoneDel': { const i = cb.zones.findIndex(z => z.id === d.z), z = cb.zones[i]; cb.zones.splice(i, 1); const moved = cb.tokens.filter(t => t.zone === z.id); moved.forEach(t => t.zone = null); ui.zoneSel = null; ui.sheet = null; toast(v, `Deleted ${z.name}.`, () => { cb.zones.splice(i, 0, z); moved.forEach(t => t.zone = z.id); }); renderAll(); return; }
  case 'cbQuickZones': N.cbQuickZones(); ui.cbTool = 'move'; renderAll(); return;
  case 'cbInvite': { const i = cb.invited.indexOf(val); if (i >= 0) { cb.invited.splice(i, 1); cb.tokens = cb.tokens.filter(t => !(t.kind === 'pc' && t.ref === val)); } else { cb.invited.push(val); cb.tokens.push(N.tokFromPc(g.chars[val])); N.cbPlacePcs(); } renderAll(); return; }
  case 'cbAddNpc': { const t = N.cbAddNpc(val, d.side, d.place ? cb.zones[0]?.id : null); if (!t) break; if (d.place) { ui.sheet = null; toast(v, `${t.name} added${t.zone ? ' to ' + N.zoneOf(t).name : ''}.`); } renderAll(); return; }
  case 'cbAddOnce': { const t = N.cbAddOnce(val, d.side, d.place ? cb.zones[0]?.id : null); if (!t) break; if (d.place) { ui.sheet = null; toast(v, `${t.name} added${t.zone ? ' to ' + N.zoneOf(t).name : ''}.`); } renderAll(); return; }
  case 'foeAll': ui.foeAll = !ui.foeAll; break;
  case 'cbAddFoe': { const t = N.cbAddFoe(+val, d.side, d.place ? cb.zones[0]?.id : null); if (!t) break; if (d.place) { ui.sheet = null; toast(v, `${t.name} added${t.zone ? ' to ' + N.zoneOf(t).name : ''}.`); } renderAll(); return; }
  case 'cbStart': if (N.fightBlocked && N.fightBlocked(cb.ch)) { toast(v, 'To run a fight in a private chat, publish the new security rules first: paste firestore.rules into Firebase > Firestore > Rules, press Publish, then reload.'); break; } N.cbStart(); ui.cbTool = 'move'; ui.zoneSel = null; ui.placing = null; toast(v, 'The fight is on. Roll Notice to see who goes first.'); renderAll(); return;
  case 'cbCancelSetup': g.combat = N.freshCombat(); ui.fightPane = 'chat'; ui.fightOpen = true; ui.zoneSel = null; toast(v, 'Fight setup thrown away.'); renderAll(); return;
  case 'cbEndGo': N.cbEnd(); ui.sheet = null; ui.tokSel = null; ui.targeting = null; ui.watching = false; renderAll(); return;
  case 'cbAspAdd': { const t = (ui.cbAsp || '').trim(); if (t) { const on = ui.cbAspOn && N.tokById(ui.cbAspOn);
    cb.aspects.push(Object.assign({t, free:+ui.cbAspFree || 0}, on ? {onTok:on.id, on:N.tokName(on)} : {}));
    fsys(`${N.gmName()} adds a situation aspect${on ? ` on ${N.tokName(on)}` : ''}: “${t}”${ui.cbAspFree ? `, ${ui.cbAspFree} free invoke${ui.cbAspFree > 1 ? 's' : ''}` : ''}.`); ui.cbAsp = ''; ui.cbAspFree = 0; ui.cbAspOn = null; if (ui.invBack) { ui.sheet = 'invoke'; ui.sheetArg = ui.invBack; ui.invBack = null; } else ui.sheet = null; renderAll(); return; } break; }
  case 'cbAspDel': cb.aspects.splice(+d.i, 1); renderAll(); return;
  case 'cbAspFree': ui.cbAspFree = +val; break;
  case 'cbAspOn': ui.cbAspOn = val || null; break;
  }
  render(v);
}

function openSheet(v, s, d={}){
  const g = G(), ui = v.ui;
  ui.sheet = s; ui.sheetArg = d.c || d.v || null;
  if (s === 'grpEdit') { const gr = d.v && g.groups.find(x => x.id === d.v); ui.gd = gr ? {id:gr.id, name:gr.name, seats:[...gr.seats], party:!!gr.party, meta:!!gr.meta, hist:true} : {id:null, name:'', seats:[], party:!!d.party, meta:false, hist:true}; }
  if (s === 'scene') {
    const ch = ui.ch === 'gm' ? 'table' : ui.ch;
    ui.sd = {ch, post:true, tab:g.recent.length ? 'recent' : 'pics', newAsp:'', castQ:'', oneName:'', oneSkill:'', oneRate:'2'};
    sdLoad(ui.sd, g.scenes[ch] ? 'edit' : 'new');
  }
  if (s === 'pcEdit') {
    const c = g.chars[d.v];
    ui.pd = JSON.parse(JSON.stringify(c));
    ui.pd.isNew = !c.built;
    if (!c.built) Object.assign(ui.pd, {name:'', short:'', portrait:null, hc:'', trouble:''});
    /* older cards had a high concept and trouble; they become Aspect 1 and 2 */
    ui.pd.aspects = N.pcAspects(ui.pd); ui.pd.hc = ''; ui.pd.trouble = '';
    ui.pd.disc = JSON.parse(JSON.stringify(c.disc || {}));
    while (ui.pd.aspects.length < 3) ui.pd.aspects.push('');
    ui.sheetArg = d.v;
  }
  if (s === 'npcNew') {
    const n = d.edit && g.npcs.find(x => x.id === d.edit);
    ui.nd = n ? Object.assign(JSON.parse(JSON.stringify(n)), {edit:n.id}) : {name:'', race:'', job:'', age:'', disc:{}, hc:'', trouble:'', aspects:[], type:'supporting', skills:{}, stunts:[], magic:'', bio:'', notes:'', refresh:3, fp:3, portrait:null, from:d.from || null, dir:ui.tab === 'cast' && N.nd.byId(ui.npcDir) ? ui.npcDir : null};
    ui.nd.from = d.from || null;
    /* NPC aspects are Aspect 1, 2, 3 too; an old high concept and trouble become the first two */
    ui.nd.aspects = N.pcAspects(ui.nd); ui.nd.hc = ''; ui.nd.trouble = '';
    while (ui.nd.aspects.length < 3) ui.nd.aspects.push('');
  }
  if (s === 'wEdit') {
    const e = d.v && g.wiki.find(x => x.id === d.v);
    ui.wd = e ? {id:e.id, title:e.title, cat:e.cat, summary:e.summary || '', info:(e.info||[]).map(i => i.join(': ')).join('\n'), body:(e.body||[]).join('\n\n'), secret:e.secret || '', gm:!!e.gm, see:[...(e.see || [])], imgs:N.wikiPics(e).map(p => ({...p})), parts:(e.parts || []).map(p => ({...p, see:[...(p.see || [])]}))}
              : {id:null, title:'', cat:ui.wikiCat || (N.cats().find(c => c.name === 'People') || N.cats()[0] || {name:'People'}).name, summary:'', info:'', body:'', secret:'', gm:false, imgs:[], parts:[]};
  }
  if (s === 'wCats') { ui.cd = N.catNames(g.wiki).map(name => ({from:name, name, ic:N.catIcon(name)})); ui.cdIc = null; }
  if (s === 'wipe') ui.wipe = {ch:null, step:1, ok:false, typed:''};
  if (s === 'export') ui.exp = {ch:new Set(N.channelsFor('gm').filter(c => c !== 'gm')), rp:true, roll:true, meta:false, when:'all', from:'', to:''};
}
N.openSheet = openSheet;
/* the typed name has to match the chat's name exactly (any capitals) before a wipe is allowed */
N.wipeMatch = w => !!(w && w.ch) && (w.typed || '').trim().toLowerCase() === N.chName(w.ch, 'gm').trim().toLowerCase();

/* the scene sheet edits the chat's scene in place (edit) or starts a fresh one (new) */
function sdLoad(sd, mode){
  const g = G(), cur = g.scenes[sd.ch];
  sd.mode = cur ? mode : 'new'; sd.touched = false; sd.autoTitle = false;
  /* the location: an edit shows the scene's own; a new scene starts where the last one was */
  const curLoc = cur ? cur.loc || g.hlocs[cur.msg] || null : null;
  sd.loc = N.locKeys(curLoc); sd.share = cur ? !!cur.loc || !curLoc : true;
  if (sd.mode === 'edit') Object.assign(sd, {msg:cur.msg, title:cur.title, where:cur.where || '', date:cur.date || '', art:cur.art || null, place:cur.place || null,
    aspects:(cur.aspects || []).map((a, i) => ({...a, k:a.k ?? String(i)})), cast:[...(N.castOf(sd.ch) || [])], extras:N.extrasOf(sd.ch).map(x => ({...x, skills:{...x.skills}}))});
  else Object.assign(sd, {msg:null, title:'', where:'', date:'', art:null, place:null, aspects:[], cast:cur ? [] : [...(N.castOf(sd.ch) || [])], extras:cur ? [] : N.extrasOf(sd.ch).map(x => ({...x, skills:{...x.skills}}))});
}
function sdKeep(s){
  const g = G();
  if (s.cast.length) g.casts[s.ch] = [...s.cast]; else delete g.casts[s.ch];
  if (s.extras.length) g.extras[s.ch] = s.extras.map(x => ({id:x.id, name:x.name, skills:{...x.skills}})); else delete g.extras[s.ch];
}
function sceneRecent(sc){
  const g = G(); if (!sc.title) return;
  const key = sc.title.toLowerCase();
  g.recent = [{id:uid('r'), title:sc.title, where:sc.where, art:sc.art, place:sc.place}, ...g.recent.filter(r => r.title.toLowerCase() !== key)].slice(0, 6);
}
/* fixing up a scene changes its own message: no new scene line, nobody is pinged, and spent free invokes stay spent */
function editScene(v, s){
  const g = G(), m = g.msgs.find(x => x.id === s.msg && x.kind === 'scene'); if (!m) return false;
  const loc = N.locBuild(s.loc || {});
  if (loc && !s.share) G().hlocs[m.id] = loc; else delete G().hlocs[m.id];
  m.scene = {title:s.title.trim(), where:s.where.trim(), date:s.date.trim(), art:s.art || null, place:s.place || null, ...(loc && s.share ? {loc} : {}), aspects:s.aspects.map(a => ({t:a.t, free:a.free || 0, k:a.k ?? uid('a'), ...(a.on ? {on:a.on} : {})}))};
  N.invalidateScenes(); sceneRecent(m.scene);
  toast(v, `Scene updated: ${m.scene.title}`);
  return true;
}
function setScene(v, ch, s, post){
  const g = G();
  /* a location the players aren't told stays in the GM's own data, so it never reaches their devices */
  const loc = s.loc ? N.locBuild(s.loc) : null, share = s.share !== false;
  const sc = {title:s.title, where:s.where || '', date:s.date || '', art:s.art || null, place:s.place || null, ...(loc && share ? {loc} : {}), aspects:(s.aspects || []).map(a => ({t:a.t, free:a.free || 0, ...(a.on ? {on:a.on} : {})}))};
  const m = push({ch, kind:'scene', by:'gm', scene:sc, quiet:!post});
  if (loc && !share) g.hlocs[m.id] = loc;
  sceneRecent(sc);
  const who = ch === 'table' ? 'everyone' : (g.P[ch.slice(3)]?.name || 'them');
  toast(v, `Scene set for ${who}: ${sc.title}`, () => N.delMsg(m.id));
}
function savePc(v){
  const g = G(), d = v.ui.pd, c = g.chars[d.id], first = !c.built;
  const sv = N.stressVals;
  const pv = [...sv(d.skills.Strength || 0), ...(c.gearBox || [])], mv = sv(d.skills.Will || 0);
  Object.assign(c, {name:d.name.trim(), short:(d.short.trim() || d.name.trim().split(' ')[0]), portrait:d.portrait || null, hc:'', trouble:'',
    aspects:d.aspects.map(a => (a||'').trim()).filter(Boolean), race:(d.race || '').trim(), age:(d.age || '').trim(), bio:d.bio || '', people:d.people || '', invText:d.invText || '', skills:{...d.skills}, stunts:d.stunts.filter(s => s[0].trim()), refresh:d.refresh, fp:d.fp, built:true,
    stressV:{phys:pv, ment:mv}, stress:{phys:pv.map((x,i) => !!c.stress.phys[i]), ment:mv.map((x,i) => !!c.stress.ment[i])}, gearAtk:+d.gearAtk || 0, gearDef:+d.gearDef || 0, gearRng:+d.gearRng || 0, gearAmmo:+d.gearAmmo || 0});
  delete c.disc; c.disc = keepDisc(d);
  v.ui.sheet = null;
  if (first) { sys(`${N.gmName()} made your character card: ${c.name}. Open Character to see it.`, 'dm-' + c.player); toast(v, `Saved. ${g.P[c.player]?.name || 'They'} got a note.`); }
  else toast(v, 'Card saved.');
  renderAll();
}
/* items belong to a player's character (data-c) or an NPC (data-n) */
const invOwner = (d, v) => d.nd ? v.ui.nd : d.c ? G().chars[d.c] : G().npcs.find(x => x.id === d.n);
/* disciplines only for skills still on the card */
const keepDisc = d => Object.fromEntries(Object.keys(d.skills).map(k => [k, N.discOf(d, k)]).filter(([k, x]) => x.length && (N.DISC[k] || []).length));
function pickDisc(d, k, x){
  const have = N.discOf(d, k);
  d.disc = d.disc || {};
  d.disc[k] = have.includes(x) ? have.filter(y => y !== x) : N.MAGIC.includes(k) ? [x] : [...have, x];
}
function saveNpc(v){
  const g = G(), d = v.ui.nd, old = d.edit && g.npcs.find(x => x.id === d.edit);
  const base = {name:d.name.trim(), race:d.race.trim(), job:d.job.trim(), hc:'', trouble:'', aspects:d.aspects.map(a => (a||'').trim()).filter(Boolean), type:d.type, portrait:d.portrait || null, age:(d.age || '').trim(),
    skills:{...d.skills}, disc:keepDisc(d), stunts:d.stunts.filter(s => s[0].trim()), magic:d.magic || '', bio:d.bio || '', notes:d.notes || '', refresh:d.refresh, fp:d.fp, gearAtk:+d.gearAtk || 0, gearDef:+d.gearDef || 0, gearRng:+d.gearRng || 0, gearAmmo:+d.gearAmmo || 0,
    inv:(d.inv || []).map(x => [...x]), dir:N.nd.byId(d.dir) ? d.dir : null};
  let n;
  if (old) {
    n = Object.assign(old, base);
    for (const [tr, sk] of [['phys','Strength'],['ment','Will']]) { const sv = [...N.stressVals(n.skills[sk] || 0), ...(tr === 'phys' ? n.gearBox || [] : [])]; if (sv.join() !== (n.stressV[tr] || []).join()) { n.stressV[tr] = sv; n.stress[tr] = sv.map(() => false); } }
  } else { n = N.npcCard(base); g.npcs.push(n); }
  g.npcs.sort((a,b) => a.name.localeCompare(b.name));
  v.ui.sheet = null;
  if (d.from === 'voice') { v.ui.voice = n.name; v.ui.mode = 'rp'; const ch = v.ui.ch === 'gm' ? 'table' : v.ui.ch, cast = N.castOf(ch) || []; if (!cast.includes(n.name)) g.casts[ch] = [...cast, n.name]; }
  toast(v, old ? 'NPC saved.' : `${n.name} saved. Pick them in “Speak as”.`); renderAll();
}
/* the GM's buff or debuff on a roll that's already made (a defense, a Notice roll, or one rolled without it): −6..+6,
   the total and any fight result follow it */
function invMod(v, d){
  const g = G(), m = g.msgs.find(x => x.id === v.ui.sheetArg); if (!isGM(v) || !m || m.kind !== 'roll') return;
  const r = m.roll, was = r.mod || 0, now = clamp(was + d, -6, 6); if (now === was) return;
  r.bonus += now - was; if (now) r.mod = now; else delete r.mod;
  const p = g.combat.pending; if (p && p.msgId === m.id) p.total = N.rollTotal(r);
  N.cbReresolve(m);
  renderAll();
}
function doInvoke(v, i, reroll){
  const g = G(), m = g.msgs.find(x => x.id === v.ui.sheetArg), x = m && N.invokeCtx(v, m), o = x && N.invokeOptions(v, m, x)[i];
  if (!o || (reroll && x.against)) return;
  let how = 'gm';
  if (o.free) {
    how = 'free';
    if (o.kind === 'cb') { const asp = g.combat.aspects[o.i]; asp.free--; if (asp.boost && asp.free <= 0) g.combat.aspects.splice(o.i, 1); }
    if (o.kind === 'zone') g.combat.zones.find(z => z.id === o.z).free--;
  } else if (x.pay) { if ((x.pay.o.fp || 0) < 1) { toast(v, x.pay.o === N.charOf(v.role) ? 'No fate points left.' : `${x.pay.name} has no fate points left.`); return; } x.pay.o.fp--; how = 'fp'; }
  else if (!isGM(v)) { toast(v, 'No fate points left.'); return; }
  /* the invoke goes on the invoker's own roll (see N.invokeSides); by names them when that roll isn't theirs */
  const t = x.onto, iv = Object.assign({aspect:o.t, how}, o.ref ? {ref:o.ref} : {}, x.by && N.tokName(x.by) !== t.roll.who ? {by:N.tokName(x.by)} : {});
  if (x.against) { iv.opp = true; t.roll.opp += 2; }
  else if (reroll) { iv.reroll = true; iv.was = t.roll.dice; t.roll.dice = N.rollDice(); v.ui.fresh = t.id; }
  t.roll.invokes.push(iv);
  const p = g.combat.pending; if (p && p.msgId === t.id) p.total = N.rollTotal(t.roll);
  N.cbReresolve(t);
  v.ui.sheet = null; v.ui.invBy = null;
  const cost = o.free ? ' (free)' : how === 'fp' ? `, 1 fate point spent${x.pay.o === N.charOf(v.role) ? '' : ` from ${x.pay.name}`}` : '';
  const who = x.by && x.by !== x.sides.me ? `${N.tokName(x.by)}: ` : '';
  toast(v, x.against ? `${who}+2 to beat from “${o.t}”${cost}. ${N.tokName(x.sides.me)} now needs ${sgn(t.roll.opp)}.`
    : reroll ? `${who}Rerolled with “${o.t}”${cost}: now ${sgn(N.rollTotal(t.roll))} ${ladderWord(N.rollTotal(t.roll))}.` : `${who}+2 from “${o.t}”${cost}.`);
  renderAll();
}
/* news: open one issue (and mark it read), or land on the paper with the newest issue */
function openIssue(v, i){ const g = G(), s = g.news.seen[v.role] || (g.news.seen[v.role] = []); v.ui.paper = N.paperName(i); v.ui.newsSel = i.id; if (!s.includes(i.id)) s.push(i.id); }
function newsTab(v){
  if (v.dev === 'phone') { v.ui.paper = null; v.ui.newsSel = null; return; }
  const ps = N.papers(), p = ps.find(x => x.name === v.ui.paper) || ps[0]; if (!p) return;
  const s = G().news.seen[v.role] || [];
  openIssue(v, p.issues.find(i => i.id === v.ui.newsSel) || p.issues.find(i => !s.includes(i.id)) || p.issues[p.issues.length - 1]);
}
/* the next issue of a paper: its name, number and price carried over */
const nextIssue = p => { const last = p.issues[p.issues.length - 1]; return {paper:p.name, no:String(Math.max(0, ...p.issues.map(i => +i.no || 0)) + 1), price:last.price || ''}; };
const blankIssue = () => ({paper:'', no:'1', date:'', price:'', headline:'', sub:'', lead:'', limg:'', lcap:'', stories:[{title:'', body:'', img:'', cap:''}], notices:''});
/* the form as an issue: as many stories as the GM wrote, each with an optional picture, and an optional picture over the lead */
N.draftIssue = d => { const o = {paper:d.paper.trim(), no:parseInt(d.no, 10) || 0, date:d.date.trim(), price:d.price.trim(), headline:d.headline.trim(), sub:d.sub.trim(), lead:d.lead,
  stories:d.stories.map(st => { const x = {title:st.title.trim(), body:st.body}; if (st.img) { x.img = st.img; if (st.cap?.trim()) x.cap = st.cap.trim(); } return x; }).filter(st => st.title || st.body.trim() || st.img),
  notices:d.notices.split('\n').map(s => s.trim()).filter(Boolean)};
  if (d.limg) { o.limg = d.limg; if (d.lcap?.trim()) o.lcap = d.lcap.trim(); }
  return o; };
/* uploads in a draft that never got saved are deleted; pictures the saved issue still uses stay */
function dropDraftPic(d, src){ if (!d || !src) return; const old = d.edit && G().news.issues.find(x => x.id === d.edit); if (!(old && N.newsPics(old).some(x => samePic(x, src)))) N.dropImg(src); }
function dropDraftPics(d){ if (d) N.newsPics(N.draftIssue(d)).forEach(src => dropDraftPic(d, src)); }

/* ---------------- phones: keep the composer on top of the keyboard ----------------
   The app is sized to the part of the screen above the keyboard (visualViewport). When that size changes, the height glides
   to the new one over about a quarter of a second, the way the keyboard itself slides, while the tab bar tucks away under it
   and the chat stays on its newest line. (The app used to jump to the new size in one frame, and the tab bar vanished at once.)
   iPhones also scrolled the whole page up to show a typing box and the app then snapped back down: a box that is being focused
   is lifted out of sight for that one moment (see focus below), so Safari finds nothing to scroll. */
const KB_FIELD = el => !!el && (el.tagName === 'TEXTAREA' || el.tagName === 'SELECT' || (el.tagName === 'INPUT' && !/^(button|checkbox|radio|range|file|color|submit|reset|image|hidden)$/i.test(el.type)));
N.kbInit = function(){
  const vv = window.visualViewport, dev = document.querySelector('.device');
  if (!vv || !dev) return;
  const calm = matchMedia('(prefers-reduced-motion: reduce)');
  const ease = t => 1 - Math.pow(1 - t, 3);
  /* cur: the app's height now; tuck: how far the tab bar is tucked away (0 shown, 1 gone); tb: its height and bottom padding when shown */
  let raf = 0, base = window.innerHeight, wide = window.innerWidth, cur = 0, kbOn = false, tuck = 0, tb = {h:0, pad:0}, tw = null;
  const setH = h => { cur = h; dev.style.height = h + 'px'; };
  const bars = () => views.map(v => v.root.querySelector('.tabbar')).filter(Boolean);
  const tuckBars = () => bars().forEach(b => {
    if (tuck <= 0 || tuck >= 1 && kbOn) { b.style.display = b.style.paddingBottom = b.style.marginBottom = ''; return; }
    b.style.display = 'grid'; b.style.paddingBottom = tb.pad + 'px'; b.style.marginBottom = -(tuck * tb.h).toFixed(1) + 'px';
  });
  /* chats that sat on their newest line stay there while the height changes */
  const pinned = new Set();
  const pin = () => views.forEach(v => pinned.forEach(k => { const e = v.root.querySelector(`[data-sk="${k}"]`); if (e) e.scrollTop = e.scrollHeight; }));
  /* a typing box away from the composer (a search, a sheet) is scrolled into view inside its own list, never by moving the page */
  const reveal = el => {
    for (let p = el.parentElement; p && p !== document.body; p = p.parentElement) {
      if (!/(auto|scroll)/.test(getComputedStyle(p).overflowY) || p.scrollHeight <= p.clientHeight) continue;
      const r = el.getBoundingClientRect(), b = p.getBoundingClientRect();
      if (r.bottom > b.bottom - 12) p.scrollTop += r.bottom - b.bottom + 12; else if (r.top < b.top + 12) p.scrollTop -= b.top + 12 - r.top;
      return;
    }
  };
  const settle = () => {
    tw = null; pinned.clear(); tuckBars();
    const a = document.activeElement;
    if (kbOn && KB_FIELD(a) && a.closest('.app') && !a.closest('.composer')) reveal(a);
    if (window.scrollY) window.scrollTo(0, 0);
  };
  const step = now => {
    const k = Math.min(1, (now - tw.t0) / tw.dur), e = ease(k);
    setH(Math.round(tw.h0 + (tw.h1 - tw.h0) * e));
    tuck = tw.u0 + (tw.u1 - tw.u0) * e; tuckBars(); pin();
    if (k < 1) tw.raf = requestAnimationFrame(step); else settle();
  };
  const glide = (h, kb) => {
    if (tw) cancelAnimationFrame(tw.raf);
    const flip = kb !== kbOn;
    views.forEach(v => v.root.querySelectorAll('[data-sk][data-bottom]').forEach(e => { if (flip || e.scrollHeight - e.scrollTop - e.clientHeight < 60) pinned.add(e.dataset.sk); }));
    if (flip) {
      /* measure the tab bar while it shows, before .kb hides it */
      if (!kb) views.forEach(v => v.root.classList.remove('kb'));
      const b = bars()[0]; if (b && !b.style.display) { tb = {h:b.offsetHeight, pad:parseFloat(getComputedStyle(b).paddingBottom) || 0}; }
      kbOn = kb; views.forEach(v => v.root.classList.toggle('kb', kb));
    }
    const snap = !cur || calm.matches || !TOUCH.matches || window.innerWidth !== wide;
    wide = window.innerWidth;
    if (snap) { setH(h); tuck = kb ? 1 : 0; pin(); settle(); return; }
    /* a small change (Android can resize in several steps while its keyboard slides) glides for less time */
    tw = {h0:cur, h1:h, u0:tuck, u1:kb ? 1 : 0, t0:performance.now(), dur:clamp(Math.abs(h - cur) * .85, 100, kb ? 260 : 240)};
    tuckBars(); tw.raf = requestAnimationFrame(step);
  };
  const apply = () => { raf = 0;
    if (window.innerWidth !== wide) base = 0;
    const h = Math.round(vv.height);
    if (vv.offsetTop || window.scrollY) window.scrollTo(0, 0);
    base = Math.max(base, window.innerHeight);
    const kb = base - h > 120 && KB_FIELD(document.activeElement);
    if (h === (tw ? tw.h1 : cur) && kb === kbOn) return;
    glide(h, kb);
  };
  const sched = () => { if (!raf) raf = requestAnimationFrame(apply); };
  vv.addEventListener('resize', sched); vv.addEventListener('scroll', sched);
  window.addEventListener('orientationchange', () => { base = 0; setTimeout(() => { base = window.innerHeight; sched(); }, 300); });
  apply();
  /* iPhone: lift a box out of sight while it takes focus, so Safari doesn't scroll the page up to it; it is back before the next paint */
  if (APPLE) document.addEventListener('focus', e => {
    const el = e.target;
    if (!KB_FIELD(el) || el.tagName === 'SELECT' || !el.closest('.app')) return;
    el.style.transform = 'translateY(-2000px)';
    requestAnimationFrame(() => { el.style.transform = ''; });
  }, true);
  /* Safari's prev/next bar shows while other fields can take focus: park them while typing in the chat */
  const isDraft = el => el && el.dataset && el.dataset.i === 'draft';
  const park = on => document.querySelectorAll('.app input,.app select,.app textarea,.app button').forEach(el => {
    if (isDraft(el) || el.closest('.composer')) return;
    if (on) { if (el.tabIndex !== -1 && !el.dataset.ti) { el.dataset.ti = '1'; el.tabIndex = -1; } }
    else if (el.dataset.ti) { delete el.dataset.ti; el.removeAttribute('tabindex'); }
  });
  document.addEventListener('focusin', e => { if (isDraft(e.target)) { park(true); sched(); setTimeout(sched, 300); } else sched(); });
  document.addEventListener('focusout', e => {
    if (isDraft(e.target)) park(false); setTimeout(sched, 50);
    /* iPhone home-screen app: the first keyboard can leave the screen measured short after it closes (a dark band at the bottom);
       hiding and showing the app in one go makes Safari measure it again */
    if (APPLE && navigator.standalone) setTimeout(() => {
      if (KB_FIELD(document.activeElement) || vv.height >= base - 4) return;
      dev.style.display = 'none'; void dev.offsetHeight; dev.style.display = ''; sched();
    }, 450);
  });
};
})();
