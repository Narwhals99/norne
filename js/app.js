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
N.msgWho = m => m.kind === 'roll' ? m.roll.who : m.kind === 'rp' ? N.speakerObj(m).name : N.personObj(m.by).name;
/* messages anyone can react to or reply to: not scene changes, fight cards or small grey lines */
/* a pasted GIF link: any https picture address */
N.gifLinkOk = u => /^https:\/\/\S+$/i.test(String(u || '').trim());
N.msgSocial = m => !['scene','fight','combat'].includes(m.kind) && !(m.kind === 'sys' && !m.res);
N.emoName = s => String(s || '').trim().toLowerCase().replace(/^:+|:+$/g, '').replace(/\s+/g, '_').replace(/[^\w-]/g, '').slice(0, 32);
N.msgColor = m => (m.kind === 'rp' ? N.speakerObj(m).color : m.kind === 'roll' ? 'var(--ink-2)' : N.personObj(m.by).color) || 'var(--ink-2)';
/* a one-line taste of a message, for the line above a reply */
N.msgSnip = m => {
  if (m.kind === 'roll') return `${m.roll.skill} roll · ${sgn(N.rollTotal(m.roll))} ${ladderWord(N.rollTotal(m.roll))}`;
  if (m.kind === 'sys' && m.res) return m.res.title || 'Turn order';
  if (m.kind === 'news') return 'News: ' + m.text;
  if (m.kind === 'gif') return 'GIF';
  const x = String(m.text || '').replace(/[*_]/g, '').replace(/\s+/g, ' ').trim();
  return x.length > 90 ? x.slice(0, 90) + '…' : x;
};
/* what Copy puts on the clipboard: typed text as written, a GIF's link, otherwise the one-line summary */
N.msgCopyText = m => m.kind === 'gif' ? (m.gif?.u || '') : (m.text && m.kind !== 'roll' && m.kind !== 'sys' ? String(m.text) : N.msgSnip(m));
/* on a computer Enter sends and Shift+Enter starts a new line; on a phone Return starts a new line and the arrow sends */
const TOUCH = matchMedia('(hover: none) and (pointer: coarse)');
N.enterSends = () => !TOUCH.matches;
const push = N.push = o => { const m = Object.assign({id:uid('m'), t:N.now(), as:''}, o); G().msgs.push(m); return m; };
/* a small grey line in the chat; players write their own (the rules only let them post as themselves) */
const sys = N.sys = (text, ch='table') => push({ch, kind:'sys', by:G().role, text});
/* a line about the fight goes to the chat the fight lives in */
const fsys = text => Object.assign(sys(text, N.fightCh()), {fight:true});
/* tell the players who can see something: in Everyone when it's for all, otherwise in each one's chat with the GM */
const tell = (x, kind, text, only) => { const a = N.audOf(x, kind); if (a === 'gm') return; if (a === '*' && !only) { sys(text); return; } for (const s of only || a) if (G().P[s]) sys(text, 'dm-' + s); };

const newUi = N.newUi = role => ({tab:'chat', ch:'table', sheet:null, sheetArg:null, pop:null, toast:null, mode:'ooc', voice:'Narrator', draft:'', sceneMin:false, folded:new Map(), fresh:null,
  fightPane:'fight', fightOpen:true, watching:false, cbTool:'move', tokSel:null, targeting:null, placing:null, zoneSel:null,
  mapId:null, mapType:'all', mapQ:'', pinSel:null, mapEdit:false, addPin:false, mapT:null,
  wikiQ:'', wikiCat:null, wikiSel:null, paper:null, newsEdit:null, newsSel:null, charSel:null, castSeg:'players', castSel:null, npcQ:'',
  roll:null, sd:null, pd:null, nd:null, wd:null, exp:null, cbAsp:'', cbAspFree:0});

/* ---------------- mount + render ---------------- */
N.mount = function(root, o){
  const v = {id:'v' + Math.random().toString(36).slice(2,6), root, role:o.role, dev:o.dev, theme:o.theme || 'night', style:N.styleOk(o.style), fz:N.fzOk(o.fz), ui:newUi(o.role)};
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
function render(v){
  const root = v.root;
  if (!root.isConnected) return;
  if (swBusy(v)) { v._later = true; return; }
  root.dataset.theme = v.theme; root.dataset.style = v.style; root.dataset.dev = v.dev; root.dataset.role = v.role || '';
  fzSet(v);
  if (N.gated || !v.role) { root.innerHTML = N.gateHtml(N.gated || '<p>Opening the campaign…</p>'); fzInline(v); return; }
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
  root.querySelectorAll('[data-sk]').forEach(e => {
    const s = sk[e.dataset.sk];
    if (e.dataset.bottom && (!s || s.bottom || v.ui.stick)) e.scrollTop = e.scrollHeight;
    else if (s) { e.scrollTop = s.t; e.scrollLeft = s.l; }
  });
  [...root.querySelectorAll(HS)].forEach((e,i) => { if (hs[i]) e.scrollLeft = hs[i]; });
  v.ui.stick = false;
  if (focus) { const f = root.querySelector('#' + CSS.escape(focus.id)); if (f) { f.focus({preventScroll:true}); try { if (focus.s != null) f.setSelectionRange(focus.s, focus.e); } catch(e){} } }
  const ta = root.querySelector('.composer textarea'); if (ta) grow(ta);
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
    const pin = e.target.closest('[data-pin]'); if (pin) { v.ui.pinSel = v.ui.pinSel === pin.dataset.pin ? null : pin.dataset.pin; render(v); return; }
    const zone = e.target.closest('[data-zone]'); if (zone) { zoneClick(v, zone.dataset.zone); return; }
    if (e.target.closest('[data-mapcv]') && v.ui.addPin) { addPinAt(v, e); return; }
    if (e.target.closest('[data-board]') && (v.ui.tokSel || v.ui.zoneSel)) { v.ui.tokSel = null; v.ui.zoneSel = null; render(v); }
  });
  root.addEventListener('input', e => { const el = e.target; if (el.dataset.i) input(v, el); });
  root.addEventListener('change', e => { const el = e.target; if (el.dataset.i) change(v, el); });
  root.addEventListener('keydown', e => {
    if (e.key === 'Enter' && !e.shiftKey && !e.isComposing && e.target.dataset.i === 'draft' && N.enterSends()) { e.preventDefault(); send(v); }
    if (e.key === 'Enter' && !e.isComposing && e.target.dataset.i === 'fcDraft') { e.preventDefault(); fcSend(v); }
    if (e.key === 'Escape') { if (v.ui.shelf) v.ui.shelf = false; else if (v.ui.pop) v.ui.pop = null; else if (v.ui.sheet) v.ui.sheet = null; else if (v.ui.reply) v.ui.reply = null; else { v.ui.targeting = null; v.ui.placing = null; v.ui.tokSel = null; } render(v); }
  });
  root.addEventListener('pointerdown', e => down(v, e));
  /* iPhone Safari zooms the whole page on a pinch unless its own gesture events are stopped over the map */
  root.addEventListener('gesturestart', e => { if (e.target.closest('[data-mapcv]')) e.preventDefault(); });
  root.addEventListener('wheel', e => { const cv = e.target.closest('[data-mapcv]'); if (cv) { e.preventDefault(); const r = cv.getBoundingClientRect(); zoomAt(v, Math.exp(-clamp(e.deltaMode === 1 ? e.deltaY * 16 : e.deltaY, -120, 120) * (e.ctrlKey ? .01 : .0018)), e.clientX - r.left, e.clientY - r.top); } }, {passive:false});
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
function backStep(v, home){
  const ui = v.ui;
  if (ui.shelf) return () => { ui.shelf = false; };
  if (ui.pop) return () => { ui.pop = null; };
  if (ui.sheet) return () => { ui.sheet = null; };
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
    case 'mapQ': v.ui.mapQ = val; render(v); return;
    case 'wikiQ': v.ui.wikiQ = val; render(v); return;
    case 'npcQ': v.ui.npcQ = val; render(v); return;
    case 'voiceQ': v.ui.voiceQ = val; render(v); return;
    case 'news': v.ui.newsEdit[k] = val; render(v); return;
    case 'con': g.chars[el.dataset.c].cons[k] = val; return;
    case 'cnote': { const c = g.chars[el.dataset.c]; if (c && (isGM(v) || c.player === v.role)) c[k] = val; return; }
    case 'cbTitle': g.combat.title = val; return;
    case 'zone': { const z = g.combat.zones.find(x => x.id === el.dataset.z); if (!z) return; z[k] = val; if (k === 'name') { const l = v.root.querySelector(`[data-zl="${z.id}"]`); if (l && l.firstChild) l.firstChild.textContent = val; } return; }
    case 'rollAsp': v.ui.roll.aspect = val; return;
    case 'rollEv': v.ui.roll.evText = val; return;
    case 'rollOther': v.ui.roll.otherName = val; return;
    case 'sd': v.ui.sd[k] = val; if (k === 'title' || k === 'where') { v.ui.sd.autoTitle = false; v.ui.sd.touched = true; } if (k === 'title') render(v); return;
    case 'cbAsp': v.ui.cbAsp = val; return;
    case 'emn': if (v.ui.emoNew) { v.ui.emoNew.n = val; const n = N.emoName(val), b = v.root.querySelector('[data-a="emoSave"]'), t = v.root.querySelector('.emo-new small');
      const dup = !!n && G().emoji.some(x => x.n === n); if (b) b.disabled = !n || dup; if (t) t.textContent = !n ? 'Letters, numbers and _ only.' : dup ? `:${n}: is already taken.` : `Type :${n}: in a message, or pick it from the emoji button.`; } return;
    case 'gifQ': v.ui.gifQ = val; clearTimeout(v._gq); v._gq = setTimeout(() => gifSearch(v), 700); return;
    case 'gifUrl': { v.ui.gifUrl = val; const b = v.root.querySelector('[data-a="gifLink"]'); if (b) b.disabled = !N.gifLinkOk(val); return; }
    case 'gifKey': v.ui.gifKeyD = val; return;
    case 'boostName': v.ui.boostName = val; return;
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
    case 'wd': if (k === 'cap') { v.ui.wd.imgs[+el.dataset.n].cap = val; return; } v.ui.wd[k] = val; if (k === 'title') render(v); return;
    case 'cd': v.ui.cd[+el.dataset.n].name = val; return;
    case 'mapName': { const m = G().maps.find(x => x.id === el.dataset.v); if (m) m.name = val; return; }
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
  if (i === 'memName') { N.renameMember(el.dataset.v, val); toast(v, 'Name saved.'); render(v); }
  if (i === 'invQ') { const n = parseInt(val, 10); v.ui.invQ = n > 0 ? n : 1; }
}

/* ---------------- chat ---------------- */
function send(v){
  const text = v.ui.draft.trim(); if (!text) return;
  const ch = v.ui.ch, gm = isGM(v), g = G(), c = N.charOf(v.role);
  let m;
  if (ch === 'gm') m = {kind:'note'};
  /* emoji on their own are table talk, never part of the story */
  else if (v.ui.mode === 'ooc' || N.emojiOnly(text)) m = {kind:'meta'};
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
    else { const n = N.npcByName(v.ui.voice); who = n ? 'npc:' + n.id : (N.rollers(v)[0] || {}).key; }
  }
  const r = N.rollerOf(v, who);
  const best = r ? Object.entries(r.skills).sort((a,b)=>b[1]-a[1])[0]?.[0] : 'Notice';
  v.ui.roll = {who:r ? r.key : who, skill:o.skill || best || 'Notice', action:o.action || 'overcome', opp:o.opp ?? null, target:o.target || null, secret:!!o.secret || v.ui.ch === 'gm', all:false, ctx:o.ctx || null, aspect:'', otherName:'', otherBonus:2, vsNpc:null, vsSkill:null, passive:true, event:!!o.event, evText:''};
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
  /* a custom event (mind magic, a spell, anything the four actions don't cover) is a fight roll built like a roleplay roll:
     a skill against a skill and/or someone, a difficulty, passive or not, and it can be secret */
  const ev = fight && r.event, rp = isGM(v) && (ev || (!fight && r.ctx !== 'cb'));
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
function actorTokOfKey(key){
  const cb = G().combat;
  if (key.startsWith('tok:')) return N.tokById(key.slice(4));
  if (key.startsWith('pc:')) return cb.tokens.find(t => t.kind === 'pc' && t.ref === key.slice(3));
  return null;
}
function afterFightRoll(v, r, m){
  const cb = G().combat, a = actorTokOfKey(m.roll.whoKey), tot = N.rollTotal(m.roll);
  if (!a || cb.state !== 'live') return;
  if (r.action === 'attack' && r.target) {
    const d = N.tokById(r.target);
    N.boostTick(a);
    cb.pending = {att:a.id, def:r.target, total:tot, skill:m.roll.skill, msgId:m.id, stage:'defend'}; cb.last = null; cb.acted = true;
    fsys(`${N.tokName(a)} attacks ${d ? N.tokName(d) : 'someone'} with ${m.roll.skill}: ${sgn(tot)} ${ladderWord(tot)}. ${d ? N.tokName(d) : 'They'} rolls to defend next.`);
    return;
  }
  if (r.action === 'advantage') {
    const opp = r.opp ?? 2; m.roll.opp = opp;
    const sh = tot - opp, name = (r.aspect || '').trim() || 'An Opening';
    if (sh === 0) {
      N.addBoost(a, null, name);
      fsys(`${N.tokName(a)} ties: not a lasting aspect, but they get a boost, “${name}”, good for one free invoke.`);
    } else if (sh > 0) {
      const z = N.zoneOf(a), free = sh >= 3 ? 2 : 1;
      if (z && !z.aspect) { z.aspect = name; z.free = free; } else cb.aspects.push({t:name, free});
      fsys(`${N.tokName(a)} creates “${name}” with ${free} free invoke${free>1?'s':''}.`);
    } else fsys(`${N.tokName(a)} tries to create “${name}”, but it doesn’t come together.`);
  }
  if (r.action === 'overcome' && !r.event) { const opp = r.opp ?? 2; m.roll.opp = opp; }
  cb.acted = true;
}
function cbDefend(v){
  const g = G(), cb = g.combat, p = cb.pending; if (!p || p.stage !== 'defend') return;
  const d = N.tokById(p.def), a = N.tokById(p.att); if (!d || !a) { cb.pending = null; renderAll(); return; }
  N.boostTick(d);
  const [skill, x] = N.defSkill(d);
  const key = d.kind === 'pc' ? 'pc:' + d.ref : 'tok:' + d.id;
  const roll = {who:N.tokName(d), whoKey:key, skill, bonus:x, action:'Defend', target:N.tokName(a), opp:p.total, dice:N.rollDice(), invokes:[], fight:true};
  const m = push({ch:N.fightCh(), kind:'roll', by:v.role, roll});
  if (d.kind === 'npc' && d.portrait) m.pt = d.portrait;
  /* defending counts as joining the fight */
  if (!isGM(v) && N.isMine(d, v.role) && !cb.joined.includes(v.role)) cb.joined.push(v.role);
  v.ui.fresh = m.id; v.ui.stick = true;
  p.defMsg = m.id;
  N.cbResolve();
  renderAll();
}
function cbAbsorb(v, k, i){
  const g = G(), cb = g.combat, p = cb.pending; if (!p) return;
  const t = N.tokById(p.def), c = t && g.chars[t.ref]; if (!c) return;
  const sh = `${p.shifts} shift${p.shifts>1?'s':''}`;
  (p.fx = p.fx || {}).pc = {k, i};
  if (k === 'box') { c.stress.phys[i] = true; fsys(`${c.short} soaks the ${sh} with their ${c.stressV.phys[i]}-stress box.`); }
  else if (k === 'out') { t.out = true; fsys(`${c.short} can’t soak the ${sh} and is taken out.`); }
  else { c.cons[k] = 'Hurt in the fight'; const sl = N.consSlots(c.skills).find(x => x.k === k); fsys(`${c.short} soaks the ${sh} with a ${(sl ? sl.l : k).toLowerCase()} consequence. ${N.gmName()} will name it.`); }
  N.cbSettled(p); renderAll();
}

/* ---------------- tokens and zones ---------------- */
function tokClick(v, id){
  const g = G(), cb = g.combat, t = N.tokById(id); if (!t) return;
  if (v.ui.targeting === 'attack') {
    const a = N.actorTok(v) || (isGM(v) ? N.curTok() : null);
    if (!a || t === a) return;
    if (t.zone !== a.zone) { toast(v, `Too far. You can only attack someone in ${N.zoneOf(a)?.name || 'your zone'}.`); render(v); return; }
    if (t.out || N.sideOf(t) === N.sideOf(a)) return;
    const best = ['Fighting','Shooting'].map(s => [s, N.tokSkills(a)[s]||0]).sort((x,y)=>y[1]-x[1])[0][0];
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
    if (keep) clampT(v);
    else if (g.party.map === m.id) centerOn(v, g.party.rx, g.party.ry, kOpen(v) * 1.5);
    else centerOn(v, .5, .5, kOpen(v));
    v.ui.mapT.bw = b.w; v.ui.mapT.bh = b.h;
  }
  clampT(v);
  const st = b.cv.querySelector('.mapst'), T = v.ui.mapT;
  st.style.transform = `translate(${T.x}px,${T.y}px) scale(${T.k})`;
  st.style.setProperty('--k', T.k);
}
function zoomAt(v, f, px, py){
  const T = v.ui.mapT; if (!T) return;
  const k1 = T.k; T.k = clamp(T.k * f, kMin(v), Math.max(kMin(v) * 10, 1.6)); const r = T.k / k1;
  T.x = px - (px - T.x) * r; T.y = py - (py - T.y) * r; applyMap(v);
}
function mapDown(v, e){
  const pts = v._pts || (v._pts = new Map());
  pts.set(e.pointerId, {x:e.clientX, y:e.clientY});
  const cvr = () => v.root.querySelector('[data-mapcv]').getBoundingClientRect();
  let moved = 0, last = {x:e.clientX, y:e.clientY}, pinch = null;
  const move = ev => {
    if (!pts.has(ev.pointerId)) return;
    pts.set(ev.pointerId, {x:ev.clientX, y:ev.clientY});
    const T = v.ui.mapT; if (!T) return;
    if (pts.size >= 2) {
      const [a, b] = [...pts.values()], dist = Math.hypot(a.x - b.x, a.y - b.y), mid = {x:(a.x + b.x)/2, y:(a.y + b.y)/2};
      if (pinch) { const r = cvr(); zoomAt(v, dist / pinch.d, mid.x - r.left, mid.y - r.top); T.x += mid.x - pinch.mx; T.y += mid.y - pinch.my; applyMap(v); }
      pinch = {d:dist, mx:mid.x, my:mid.y}; moved += 10; return;
    }
    pinch = null;
    const dx = ev.clientX - last.x, dy = ev.clientY - last.y; last = {x:ev.clientX, y:ev.clientY};
    moved += Math.abs(dx) + Math.abs(dy);
    T.x += dx; T.y += dy; applyMap(v);
  };
  const up = ev => {
    pts.delete(ev.pointerId);
    if (pts.size) { const [q] = [...pts.values()]; last = {x:q.x, y:q.y}; pinch = null; return; }
    window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', up); window.removeEventListener('pointercancel', up);
    if (moved > 6) { v.suppress = true; setTimeout(() => { v.suppress = false; }, 0); }
  };
  if (pts.size === 1) { window.addEventListener('pointermove', move); window.addEventListener('pointerup', up); window.addEventListener('pointercancel', up); }
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
window.addEventListener('resize', () => { clearTimeout(window._mr); window._mr = setTimeout(() => views.forEach(v => { if (v.ui.tab === 'map') applyMap(v); }), 120); });

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
  case 'tab': close(); ui.tab = val; if (val === 'cast') ui.castSel = null; if (val === 'hero') { ui.charSel = null; ui.heroInv = false; } if (val === 'world' && v.dev === 'phone') { ui.wikiSel = null; ui.wikiPrev = []; } if (val === 'news') newsTab(v); break;
  case 'heroInv': ui.heroInv = !!val; break;
  case 'ch': close(); if (ui.ch !== val) ui.reply = null; ui.tab = 'chat'; ui.ch = val; ui.stick = true; focusFight(v); if (v.dev === 'phone' && N.fightAvail(v)) ui.fightPane = 'chat'; break;
  case 'shelf': ui.shelf = !ui.shelf; ui.pop = null; break;
  case 'mode': if (val === 'cb') { ui.fightOpen = true; ui.fightPane = 'fight'; } else { ui.fightOpen = false; ui.fightPane = 'chat'; ui.tokSel = null; ui.targeting = null; ui.stick = true; } break;
  case 'railFold': ui[d.v] = !ui[d.v]; try { localStorage.setItem('norne-' + d.v.toLowerCase(), ui[d.v] ? '1' : '0'); } catch(e) {} break;
  case 'shelfDt': ui.shelfOff = !ui.shelfOff; try { localStorage.setItem('norne-shelfoff', ui.shelfOff ? '1' : '0'); } catch(e) {} break;
  case 'recentFold': ui.recentOff = !ui.recentOff; try { localStorage.setItem('norne-recent', ui.recentOff ? '0' : '1'); } catch(e) {} break;
  case 'rail': ui.rail = !v.root.querySelector('.page .rail'); try { localStorage.setItem('norne-rail', ui.rail ? '1' : '0'); } catch(e) {} break;
  case 'sheet': ui.pop = null; openSheet(v, val, d); break;
  case 'closeSheet': ui.sheet = null; break;
  case 'closePop': ui.pop = null; break;
  case 'pop': if (ui.pop && ui.pop.type === val) ui.pop = null; else { openPop(v, val, el); if (val === 'emo' && ui.emoTab === 'gif' && !ui.gifRes?.length && g.gifKey) gifSearch(v); } break;
  case 'toast': toast(v, val); break;
  case 'undo': if (ui.toast && ui.toast.undo) { ui.toast.undo(); ui.toast = null; renderAll(); return; } break;
  case 'notify': N.toggleNotify(v); return;
  case 'theme': v.theme = val; try { localStorage.setItem('norne-theme', val); } catch(e) {} if (N.onTheme) N.onTheme(v); break;
  case 'fz': v.fz = N.fzOk(val); try { localStorage.setItem('norne-fz', v.fz); } catch(e) {} break;
  case 'style': v.style = N.styleOk(val); try { localStorage.setItem('norne-style', v.style); } catch(e) {} break;
  /* chat */
  case 'sceneMin': ui.sceneMin = !ui.sceneMin; break;
  case 'fold': ui.folded.set(d.id, !d.f); break;
  case 'send': send(v); return;
  case 'fcSend': fcSend(v); return;
  case 'roll': openRoll(v, {skill:d.skill, who: d.who || (d.c ? 'pc:' + d.c : d.npc ? 'npc:' + d.npc : null), secret:!!d.secret}); break;
  case 'voice': { ui.voiceQ = '';
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
  case 'invoke': ui.sheet = 'invoke'; ui.sheetArg = d.id; break;
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
    ui.newsEdit = Object.assign({paper:'', no:'1', date:'', price:'', headline:'', sub:'', lead:'', s1t:'', s1b:'', s2t:'', s2b:'', notices:''}, p ? nextIssue(p) : {});
    break;
  }
  case 'ndPaper': { const p = N.papers().find(x => x.name === val); if (p) Object.assign(ui.newsEdit, nextIssue(p)); break; }
  case 'newsCancel': ui.newsEdit = null; break;
  case 'newsPub': {
    const n = ui.newsEdit; if (!n.headline.trim()) { toast(v, 'Add a headline first.'); break; }
    const issue = Object.assign({id:uid('ed'), t:N.now()}, N.draftIssue(n));
    if (n.see?.length) issue.see = [...n.see];
    g.news.issues.push(issue); (g.news.seen.gm = g.news.seen.gm || []).push(issue.id);
    const to = N.audOf(issue, 'news');
    for (const ch of to === '*' ? ['table'] : to.map(s => 'dm-' + s)) push({ch, kind:'news', by:'gm', text:issue.headline, nid:issue.id});
    ui.newsEdit = null; ui.paper = N.paperName(issue); ui.newsSel = issue.id; toast(v, to === '*' ? 'Published. Everyone got a note in chat.' : `Published for ${N.audLabel(issue, 'news').replace(/^Only /, '')}. They got a note.`); renderAll(); return;
  }
  case 'ndAud': N.audSet(ui.newsEdit, 'news', val); break;
  case 'newsAud': {
    const i = g.news.issues.find(x => x.id === ui.sheetArg); if (!i) break;
    const before = N.audSeats(i, 'news'); N.audSet(i, 'news', val);
    const added = N.audSeats(i, 'news').filter(s => !before.includes(s));
    for (const s of added) push({ch:'dm-' + s, kind:'news', by:'gm', text:i.headline, nid:i.id});
    renderAll(); return;
  }
  /* a message's menu: reactions and reply for everyone, edit and delete for the GM */
  case 'msgMenu': { const w = v.root.querySelector(`[data-mid="${CSS.escape(val)}"]`); if (ui.pop?.mid === val) ui.pop = null; else if (w) { openPop(v, 'msg', d.lp ? (w.querySelector('.m,.narr,.resm,.roll') || w) : el); ui.pop.mid = val; } break; }
  case 'emoMore': if (ui.pop) ui.pop.all = !ui.pop.all; break;
  case 'emoTab': ui.emoTab = val; if (val === 'gif' && !ui.gifRes && g.gifKey) gifSearch(v); break;
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
  case 'jumpMsg': { const w = v.root.querySelector(`.msgs [data-mid="${CSS.escape(val)}"]`); if (!w) { toast(v, 'That message isn’t in this chat any more.'); break; }
    w.scrollIntoView({block:'center', behavior:'smooth'}); w.classList.remove('flash'); void w.offsetWidth; w.classList.add('flash'); setTimeout(() => w.classList.remove('flash'), 1600); return; }
  case 'emoIns': { const ta = v.root.querySelector('.composer textarea'), t = val.startsWith(':') ? val + ' ' : val;
    const a = ta ? ta.selectionStart ?? ui.draft.length : ui.draft.length, b = ta ? ta.selectionEnd ?? a : a;
    ui.draft = ui.draft.slice(0, a) + t + ui.draft.slice(b); ui.pop = null; render(v);
    const f = v.root.querySelector('.composer textarea'); if (f) { f.focus({preventScroll:true}); f.setSelectionRange(a + t.length, a + t.length); } return; }
  /* the GM's own emoji pictures */
  case 'emoAdd': if (!gm) break; pickFramed(v, 'emoji', (img, f) => { ui.emoNew = {d:N.shrinkEmoji(N.cropToFrame(img, f)), n:''}; render(v); setTimeout(() => v.root.querySelector(`#emn-${v.id}`)?.focus(), 30); }); return;
  case 'emoCancel': ui.emoNew = null; break;
  case 'emoSave': { const e = ui.emoNew, n = N.emoName(e?.n); if (!gm || !e || !n || g.emoji.some(x => x.n === n)) break;
    g.emoji.push({id:n, n, d:e.d}); ui.emoNew = null; toast(v, `Added :${n}:. Everyone can use it now.`); renderAll(); return; }
  case 'emoDel': { const at = g.emoji.findIndex(x => x.n === val); if (!gm || at < 0) break; const x = g.emoji.splice(at, 1)[0];
    toast(v, `Removed :${x.n}:.`, () => { if (!g.emoji.some(y => y.n === x.n)) g.emoji.splice(at, 0, x); }); renderAll(); return; }
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
  case 'fp': { const c = g.chars[d.c], before = c.fp; c.fp = clamp(c.fp + (+d.d), 0, 10); if (c.fp !== before) sys(+d.d > 0 ? `${N.gmName()} gave ${c.short} a fate point.` : `${c.short} spent a fate point.`); renderAll(); return; }
  case 'gmFor': ui.ch = val; break;
  case 'mapEditGo': close(); ui.tab = 'map'; ui.mapEdit = true; ui.addPin = false; break;
  case 'castNpcs': close(); ui.tab = 'cast'; ui.castSeg = 'npcs'; ui.castSel = null; break;
  /* map */
  case 'mapGo': ui.mapId = val; ui.pop = null; ui.pinSel = null; ui.mapT = null; ui.mapType = 'all'; break;
  case 'mapEdit': ui.mapEdit = !ui.mapEdit; ui.addPin = false; break;
  case 'mapType': ui.mapType = val; break;
  case 'addPin': ui.addPin = !ui.addPin; if (ui.addPin) toast(v, 'Tap the map where the new place goes.'); break;
  case 'mapAud': {
    const m = g.maps.find(x => x.id === ui.sheetArg); if (!m) break;
    const before = N.audSeats(m, 'map'), wasAll = N.audOf(m, 'map') === '*'; N.audSet(m, 'map', val);
    const added = N.audSeats(m, 'map').filter(s => !before.includes(s));
    if (N.audOf(m, 'map') === '*' && !wasAll) tell(m, 'map', `${N.gmName()} shared the ${m.name} map.`);
    else if (added.length) tell(m, 'map', `${N.gmName()} shared the ${m.name} map with you.`, added);
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
      g.maps.push({id, name:f.name.replace(/\.[^.]+$/, ''), src, w:img.naturalWidth, h:img.naturalHeight, vis:false, pins:[]});
      ui.mapId = id; ui.mapT = null; ui.mapEdit = true; ui.sheet = 'mapSet'; ui.sheetArg = id; toast(v, 'Map added. It stays hidden until you pick who sees it.'); renderAll();
    }); return;
  case 'findParty': ui.mapId = g.party.map; ui.mapT = null; ui.pinSel = '__party'; render(v); return;
  case 'pinClose': ui.pinSel = null; break;
  case 'pinScene': { const m = curMap(v), p = m.pins.find(x => x.id === val); setScene(v, ui.ch === 'gm' ? 'table' : ui.ch, {title:p.label, where:m.name, place:{map:m.id, rx:p.rx, ry:p.ry}, aspects:[]}, true); renderAll(); return; }
  case 'pinParty': { const m = curMap(v), p = m.pins.find(x => x.id === val); moveParty(m, p.rx, p.ry + .002); sys(`The party heads to ${p.label}.`); toast(v, `The party is now at ${p.label}. A note went to Everyone.`); renderAll(); return; }
  case 'pinType': { const p = curMap(v).pins.find(x => x.id === ui.pinSel); if (p) p.type = val; renderAll(); return; }
  case 'pinVis': { const m = curMap(v), p = m.pins.find(x => x.id === ui.pinSel); if (!p) break; p.vis = !p.vis; if (p.vis) tell(m, 'map', `${N.gmName()} revealed ${p.label} on the ${m.name.replace(/ \(.*\)$/, '')} map.`); renderAll(); return; }
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
    en.imgs = w.imgs.map(p => { const o = {src:p.src}; if (p.alt) o.alt = p.alt; if (p.cap?.trim()) o.cap = p.cap.trim(); return o; });
    if (old) for (const p of N.wikiPics(old)) if (!en.imgs.some(x => samePic(x.src, p.src))) N.dropImg(p.src);
    const i = g.wiki.findIndex(x => x.id === en.id); if (i >= 0) g.wiki[i] = en; else g.wiki.push(en);
    ui.sheet = null; ui.tab = 'world'; ui.wikiSel = en.id; ui.wikiCat = en.cat; const aud = N.audOf(en, 'wiki'); toast(v, aud === 'gm' ? 'Saved. Only you can see it.' : aud === '*' ? 'Saved. Players can read it.' : `Saved. ${N.audLabel(en, 'wiki')} can read it.`); renderAll(); return;
  }
  /* character + cast */
  case 'charSel': ui.charSel = val; break;
  case 'castSeg': ui.castSeg = val; ui.castSel = null; break;
  case 'castSel': ui.castSel = val; break;
  case 'castBack': ui.castSel = null; break;
  case 'pcEdit': openSheet(v, 'pcEdit', {v:val}); break;
  case 'pdPortrait': ui.pd.portrait = val; break;
  case 'pdUpload': uploadFace(v, src => { ui.pd.portrait = src; }); return;
  case 'pdFrame': if (ui.pd?.portrait) reframe(v, 'face', ui.pd.portrait, nu => { ui.pd.portrait = nu; render(v); }); return;
  case 'pdSkillDel': delete ui.pd.skills[val]; break;
  case 'pdSkillMv': ui.pd.skills[val] = clamp(ui.pd.skills[val] + (+d.d), 1, 8); break;
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
    const note = (v.root.querySelector(`#invd-${key}-${v.id}`)?.value || '').trim();
    if (!n) { toast(v, 'Type an item name first.'); break; }
    if (!c.inv) c.inv = [];
    const ex = c.inv.find(x => x[0].toLowerCase() === n.toLowerCase()); if (ex) { ex[1] += q; if (note) ex[2] = note; } else c.inv.push(note ? [n, q, note] : [n, q]);
    if (d.nd) { ui.invQ = 1; renderAll(); return; }
    if (!d.c) { ui.invQ = 1; toast(v, `Added to ${c.name}’s inventory.`); renderAll(); return; }
    sys(`${N.gmName()} added ${n} ×${q} to ${c.short}’s inventory.`, 'dm-' + c.player); ui.invQ = 1;
    toast(v, `Added to ${c.short}’s inventory. They got a note.`); renderAll(); return;
  }
  case 'invQty': { const c = invOwner(d, v), it = c?.inv?.[+d.i]; if (!it) break; it[1] += +d.d; if (it[1] <= 0) { c.inv.splice(+d.i, 1); if (d.c) sys(`${N.gmName()} removed ${it[0]} from ${c.short}’s inventory.`, 'dm-' + c.player); } renderAll(); return; }
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
    const was = it[0]; c.inv[+d.i] = [n, q > 0 ? q : it[1], note, ...(ic && ic !== 'bag' ? [ic] : [])];
    if (d.c) sys(`${N.gmName()} changed ${was === n ? n : `${was} to ${n}`} in ${c.short}’s inventory.`, 'dm-' + c.player);
    renderAll(); return;
  }
  case 'invDel': { ui.invEdit = null; const c = invOwner(d, v), it = c?.inv?.splice(+d.i, 1)[0]; if (it && d.c) sys(`${N.gmName()} removed ${it[0]} from ${c.short}’s inventory.`, 'dm-' + c.player); renderAll(); return; }
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
  case 'ndSkillMv': ui.nd.skills[val] = clamp(ui.nd.skills[val] + (+d.d), 1, 8); break;
  case 'ndDisc': pickDisc(ui.nd, d.s, val); break;
  case 'ndStuntAdd': ui.nd.stunts.push(['','']); break;
  case 'ndStuntDel': ui.nd.stunts.splice(+d.i, 1); break;
  case 'ndStep': ui.nd[d.k] = clamp(ui.nd[d.k] + (+d.d), 0, 10); break;
  case 'npcSave': saveNpc(v); return;
  case 'npcDup': { const n = g.npcs.find(x => x.id === val); if (!n) break; const c = JSON.parse(JSON.stringify(n)); c.id = uid('n'); c.name = n.name + ' (copy)'; g.npcs.push(c); ui.castSel = c.id; toast(v, 'Duplicated.'); renderAll(); return; }
  case 'npcDelGo': { const i = g.npcs.findIndex(x => x.id === val), n = g.npcs[i]; if (!n) break; g.npcs.splice(i, 1); ui.sheet = null; ui.castSel = null; toast(v, `${n.name} deleted.`, () => g.npcs.splice(i, 0, n)); renderAll(); return; }
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
  case 'rollSkill': { const r = ui.roll; r.skill = val; if (val in vsSkillMem) { r.vsSkill = vsSkillMem[val]; const n = r.vsNpc && g.npcs.find(x => x.id === r.vsNpc); if (n && r.vsSkill) r.opp = n.skills[r.vsSkill] || 0; } break; }
  case 'rollAll': ui.roll.all = true; break;
  case 'rollOpp': ui.roll.opp = val === 'null' ? null : +val; break;
  case 'rollVsSkill': { const r = ui.roll; r.vsSkill = r.vsSkill === val ? null : val; vsSkillMem[r.skill] = r.vsSkill; vsSkillSave(); const n = N.vsFind(v, r, r.vsNpc); if (n && r.vsSkill) r.opp = n.skills[r.vsSkill] || 0; break; }
  case 'rollVsNpc': { const r = ui.roll; r.vsNpc = val || null; const n = N.vsFind(v, r, r.vsNpc); if (n && r.vsSkill) r.opp = n.skills[r.vsSkill] || 0; break; }
  case 'rollPassive': ui.roll.passive = ui.roll.passive === false; break;
  case 'rollSecret': ui.roll.secret = !ui.roll.secret; break;
  case 'rollBonus': ui.roll.otherBonus = clamp((+ui.roll.otherBonus || 0) + (+d.d), -4, 10); break;
  case 'doRoll': doRoll(v); return;
  /* scene sheet */
  case 'sdFor': ui.sd.ch = val; { const s = g.scenes[val]; if (s && !ui.sd.touched) Object.assign(ui.sd, {title:s.title, where:s.where || '', date:s.date || '', art:s.art || null, place:s.place || null, aspects:(s.aspects||[]).map(a => ({...a}))}); } break;
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
  case 'sdAspAdd': { const t = (ui.sd.newAsp || '').trim(); if (t) { ui.sd.aspects.push({t, free:0}); ui.sd.newAsp = ''; } break; }
  case 'sdAspFree': { const a = ui.sd.aspects[+d.i]; a.free = ((a.free || 0) + 1) % 3; break; }
  case 'sdAspDel': ui.sd.aspects.splice(+d.i, 1); break;
  case 'sdPost': ui.sd.post = !ui.sd.post; break;
  case 'sdApply': { const s = ui.sd; setScene(v, s.ch, {title:s.title.trim(), where:s.where.trim(), date:s.date.trim(), art:s.art, place:s.place, aspects:s.aspects}, s.post); ui.sheet = null; renderAll(); return; }
  case 'sdClear': { const ch = ui.sd.ch, m = push({ch, kind:'scene', by:'gm', scene:null, quiet:true}); ui.sheet = null; toast(v, 'Scene cleared.', () => N.delMsg(m.id)); renderAll(); return; }
  /* fight */
  case 'cbBegin': N.cbBegin(ui.ch); close(); ui.tab = 'chat'; ui.ch = N.fightCh(); ui.fightOpen = true; ui.fightPane = 'fight'; ui.cbTool = 'zone'; ui.tokSel = null; renderAll(); return;
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
  case 'cbAddFoe': { const t = N.cbAddFoe(+val, d.side, d.place ? cb.zones[0]?.id : null); if (!t) break; if (d.place) { ui.sheet = null; toast(v, `${t.name} added${t.zone ? ' to ' + N.zoneOf(t).name : ''}.`); } renderAll(); return; }
  case 'cbStart': if (N.fightBlocked && N.fightBlocked(cb.ch)) { toast(v, 'To run a fight in a private chat, publish the new security rules first: paste firestore.rules into Firebase > Firestore > Rules, press Publish, then reload.'); break; } N.cbStart(); ui.cbTool = 'move'; ui.zoneSel = null; ui.placing = null; toast(v, 'The fight is on. Roll Notice to see who goes first.'); renderAll(); return;
  case 'cbCancelSetup': g.combat = N.freshCombat(); ui.fightPane = 'chat'; ui.fightOpen = true; ui.zoneSel = null; toast(v, 'Fight setup thrown away.'); renderAll(); return;
  case 'cbEndGo': N.cbEnd(); ui.sheet = null; ui.tokSel = null; ui.targeting = null; ui.watching = false; renderAll(); return;
  case 'cbAspAdd': { const t = (ui.cbAsp || '').trim(); if (t) { cb.aspects.push({t, free:+ui.cbAspFree || 0}); ui.cbAsp = ''; ui.sheet = null; renderAll(); return; } break; }
  case 'cbAspDel': cb.aspects.splice(+d.i, 1); renderAll(); return;
  case 'cbAspFree': ui.cbAspFree = +val; break;
  }
  render(v);
}

function openSheet(v, s, d={}){
  const g = G(), ui = v.ui;
  ui.sheet = s; ui.sheetArg = d.c || d.v || null;
  if (s === 'scene') {
    const ch = ui.ch === 'gm' ? 'table' : ui.ch, cur = g.scenes[ch];
    ui.sd = cur ? {ch, title:cur.title, where:cur.where || '', date:cur.date || '', art:cur.art || null, place:cur.place || null, aspects:(cur.aspects||[]).map(a => ({...a})), post:true, tab:g.recent.length ? 'recent' : 'pics', newAsp:''}
                : {ch, title:'', where:'', date:'', art:null, place:null, aspects:[], post:true, tab:g.recent.length ? 'recent' : 'pics', newAsp:''};
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
    ui.nd = n ? Object.assign(JSON.parse(JSON.stringify(n)), {edit:n.id}) : {name:'', race:'', job:'', age:'', disc:{}, hc:'', trouble:'', aspects:[], type:'supporting', skills:{}, stunts:[], magic:'', bio:'', notes:'', refresh:3, fp:3, portrait:null, from:d.from || null};
    ui.nd.from = d.from || null;
    /* NPC aspects are Aspect 1, 2, 3 too; an old high concept and trouble become the first two */
    ui.nd.aspects = N.pcAspects(ui.nd); ui.nd.hc = ''; ui.nd.trouble = '';
    while (ui.nd.aspects.length < 3) ui.nd.aspects.push('');
  }
  if (s === 'wEdit') {
    const e = d.v && g.wiki.find(x => x.id === d.v);
    ui.wd = e ? {id:e.id, title:e.title, cat:e.cat, summary:e.summary || '', info:(e.info||[]).map(i => i.join(': ')).join('\n'), body:(e.body||[]).join('\n\n'), secret:e.secret || '', gm:!!e.gm, see:[...(e.see || [])], imgs:N.wikiPics(e).map(p => ({...p}))}
              : {id:null, title:'', cat:ui.wikiCat || (N.cats().find(c => c.name === 'People') || N.cats()[0] || {name:'People'}).name, summary:'', info:'', body:'', secret:'', gm:false, imgs:[]};
  }
  if (s === 'wCats') { ui.cd = N.catNames(g.wiki).map(name => ({from:name, name, ic:N.catIcon(name)})); ui.cdIc = null; }
  if (s === 'export') ui.exp = {ch:new Set(N.channelsFor('gm').filter(c => c !== 'gm')), rp:true, roll:true, meta:false};
}
N.openSheet = openSheet;

function setScene(v, ch, s, post){
  const g = G();
  const sc = {title:s.title, where:s.where || '', date:s.date || '', art:s.art || null, place:s.place || null, aspects:(s.aspects || []).map(a => ({t:a.t, free:a.free || 0}))};
  const m = push({ch, kind:'scene', by:'gm', scene:sc, quiet:!post});
  if (sc.title) {
    const key = sc.title.toLowerCase();
    g.recent = [{id:uid('r'), title:sc.title, where:sc.where, art:sc.art, place:sc.place}, ...g.recent.filter(r => r.title.toLowerCase() !== key)].slice(0, 6);
  }
  const who = ch === 'table' ? 'everyone' : (g.P[ch.slice(3)]?.name || 'them');
  toast(v, `Scene set for ${who}: ${sc.title}`, () => N.delMsg(m.id));
}
function savePc(v){
  const g = G(), d = v.ui.pd, c = g.chars[d.id], first = !c.built;
  const sv = N.stressVals;
  const pv = sv(d.skills.Strength || 0), mv = sv(d.skills.Will || 0);
  Object.assign(c, {name:d.name.trim(), short:(d.short.trim() || d.name.trim().split(' ')[0]), portrait:d.portrait || null, hc:'', trouble:'',
    aspects:d.aspects.map(a => (a||'').trim()).filter(Boolean), race:(d.race || '').trim(), age:(d.age || '').trim(), bio:d.bio || '', people:d.people || '', invText:d.invText || '', skills:{...d.skills}, stunts:d.stunts.filter(s => s[0].trim()), refresh:d.refresh, fp:d.fp, built:true,
    stressV:{phys:pv, ment:mv}, stress:{phys:pv.map((x,i) => !!c.stress.phys[i]), ment:mv.map((x,i) => !!c.stress.ment[i])}, gearAtk:+d.gearAtk || 0, gearDef:+d.gearDef || 0});
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
    skills:{...d.skills}, disc:keepDisc(d), stunts:d.stunts.filter(s => s[0].trim()), magic:d.magic || '', bio:d.bio || '', notes:d.notes || '', refresh:d.refresh, fp:d.fp, gearAtk:+d.gearAtk || 0, gearDef:+d.gearDef || 0,
    inv:(d.inv || []).map(x => [...x])};
  let n;
  if (old) {
    n = Object.assign(old, base);
    for (const [tr, sk] of [['phys','Strength'],['ment','Will']]) { const sv = N.stressVals(n.skills[sk] || 0); if (sv.join() !== (n.stressV[tr] || []).join()) { n.stressV[tr] = sv; n.stress[tr] = sv.map(() => false); } }
  } else { n = N.npcCard(base); g.npcs.push(n); }
  g.npcs.sort((a,b) => a.name.localeCompare(b.name));
  v.ui.sheet = null;
  if (d.from === 'voice') { v.ui.voice = n.name; v.ui.mode = 'rp'; }
  toast(v, old ? 'NPC saved.' : `${n.name} saved. Pick them in “Speak as”.`); renderAll();
}
function doInvoke(v, i, reroll){
  const g = G(), m = g.msgs.find(x => x.id === v.ui.sheetArg), o = m && N.invokeOptions(v, m)[i];
  if (!o) return;
  let how = 'gm';
  if (o.free) {
    how = 'free';
    if (o.kind === 'cb') { const asp = g.combat.aspects[o.i]; asp.free--; if (asp.boost && asp.free <= 0) g.combat.aspects.splice(o.i, 1); }
    if (o.kind === 'zone') g.combat.zones.find(z => z.id === o.z).free--;
  } else if (!isGM(v)) { const c = N.charOf(v.role); if (!c || c.fp < 1) { toast(v, 'No fate points left.'); return; } c.fp--; how = 'fp'; }
  const iv = Object.assign({aspect:o.t, how}, o.ref ? {ref:o.ref} : {});
  if (reroll) { iv.reroll = true; iv.was = m.roll.dice; m.roll.dice = N.rollDice(); v.ui.fresh = m.id; }
  m.roll.invokes.push(iv);
  const p = g.combat.pending; if (p && p.msgId === m.id) p.total = N.rollTotal(m.roll);
  N.cbReresolve(m);
  v.ui.sheet = null;
  const cost = o.free ? ' (free)' : isGM(v) ? '' : ', 1 fate point spent';
  toast(v, reroll ? `Rerolled with “${o.t}”${cost}: now ${sgn(N.rollTotal(m.roll))} ${ladderWord(N.rollTotal(m.roll))}.` : `+2 from “${o.t}”${cost}.`);
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
N.draftIssue = d => ({paper:d.paper.trim(), no:parseInt(d.no, 10) || 0, date:d.date.trim(), price:d.price.trim(), headline:d.headline.trim(), sub:d.sub.trim(), lead:d.lead,
  stories:[{title:d.s1t.trim(), body:d.s1b}, {title:d.s2t.trim(), body:d.s2b}].filter(s => s.title || s.body.trim()), notices:d.notices.split('\n').map(s => s.trim()).filter(Boolean)});

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
