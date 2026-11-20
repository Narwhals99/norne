/* =====================================================================
   NORNE — "Introducing the Minstrel Tool" (Jack, 2026-11-20)
   Shown once to the GM, the next time Norne opens after music arrived: a card with Close and Take a tour.
   The tour goes to one of the GM's chats, rings the music note with an arrow, and once he taps it walks through the
   Music window one ring at a time. "Skip tutorial" stays in a corner the whole way.
   Seen is kept in gm/intro (GM only), so it shows once for the account, not once per device.
   In Jack's GM test mode it shows on every load, so he can try it.
   The tour layer sits outside the app (redraws don't touch it) and follows its target on every draw, scroll and resize.
   ===================================================================== */
(function(){
const N = window.N, {esc, IC} = N;
const isGM = v => v && v.role === 'gm';
const tour = N.mtour = {};
let SEEN = null;          // null: not known yet; true/false from gm/intro
let OPEN = false;         // the intro card is showing
let STEP = -1, V = null;  // the tour: which step, on which screen
const tap = () => V && V.dev === 'phone' ? 'Tap' : 'Click';

/* sync.js hands over gm/intro (or test mode says: show it) */
tour.load = seen => { SEEN = !!seen; if (!SEEN) setTimeout(() => N.renderAll && N.renderAll(), 0); };
const markSeen = () => { SEEN = true; if (N.introMark) N.introMark().catch(() => {}); };

const STEPS = [
  {sel:'.mu-btn', t:() => `${tap()} the music note`, s:'It opens the Minstrel Tool.', wait:true},
  {sel:'.mu-who', t:() => 'Whose music', s:'Everyone hears what you set under Everyone. Pick a player to give them their own music instead, and send them back later.'},
  {sel:'.mu-new', t:() => 'Folders', s:'Make folders for your music, like Tavern, Battle or Forest.'},
  {sel:'.mu-sheet [data-a="mu"][data-v="up"]', t:() => 'Add songs', s:'Upload mp3 files into a folder, up to 20 MB each. Number them (01, 02…) to set their order.'},
  {sel:'.mu-sheet [data-v="playDir"], .mu-sheet [data-v="playSong"]', t:() => 'Play', s:'▶ on a song plays it on a loop. Play folder plays the whole folder, one song after another.'},
  {sel:'.mu-ctl', t:() => 'Controls', s:'Back, pause and next. Volume and Stop are right below. A strip above every chat shows what is playing.'},
];

/* ---------- the layer ---------- */
let L = null;
function layer(){
  if (L) return L;
  L = document.createElement('div'); L.className = 'mtour'; L.setAttribute('role', 'dialog'); L.setAttribute('aria-live', 'polite');
  L.innerHTML = '<div class="mt-dim"></div><div class="mt-ring"></div><svg class="mt-arrow" viewBox="0 0 60 60" aria-hidden="true"><path d="M30 4v44M14 34l16 18 16-18" fill="none" stroke="currentColor" stroke-width="6" stroke-linecap="round" stroke-linejoin="round"/></svg><div class="mt-tip"></div><div class="mt-card"></div><button type="button" class="mt-skip">Skip tutorial</button>';
  document.body.appendChild(L);
  L.querySelector('.mt-skip').onclick = () => end();
  L.addEventListener('click', e => {
    const b = e.target.closest('[data-mt]'); if (!b) return;
    const a = b.dataset.mt;
    if (a === 'close') { OPEN = false; markSeen(); paint(); }
    else if (a === 'tour') { OPEN = false; markSeen(); start(); }
    else if (a === 'next') next();
  });
  addEventListener('resize', () => place());
  document.addEventListener('scroll', () => place(), true);
  return L;
}
/* the app's own colours, so the card matches whichever style is on */
function colours(){
  const app = document.querySelector('.app'); if (!app || !L) return;
  const cs = getComputedStyle(app);
  for (const k of ['--gold', '--gold-tx', '--raise', '--raise-2', '--ink', '--ink-2', '--line-2', '--f-ui', '--f-title', '--on-gold']) { const x = cs.getPropertyValue(k); if (x) L.style.setProperty(k, x.trim()); }
}
function paint(){
  layer(); colours();
  const touring = STEP >= 0;
  L.classList.toggle('on', OPEN || touring);
  L.classList.toggle('intro', OPEN);
  L.classList.toggle('touring', touring);
  const card = L.querySelector('.mt-card');
  card.innerHTML = OPEN ? `<span class="mt-ic">${IC('music')}</span><h2>Introducing the Minstrel Tool</h2>
    <p>You can now upload mp3 files into folders and play music to all players or to individual players, right inside Norne.</p>
    <div class="mt-btns"><button type="button" class="mt-b ghost" data-mt="close">Close</button><button type="button" class="mt-b gold" data-mt="tour">Take a tour</button></div>` : '';
  place();
}
/* ring, arrow and words around the current target */
let FIND_T = 0, MISS = 0;
function place(){
  if (!L || STEP < 0) { if (L) L.classList.remove('has'); return; }
  const st = STEPS[STEP], el = target(st);
  const ring = L.querySelector('.mt-ring'), tip = L.querySelector('.mt-tip'), arrow = L.querySelector('.mt-arrow');
  if (!el) {
    L.classList.remove('has');
    /* not drawn yet: look again; a step whose target never shows (no folders yet, nothing playing) is passed over */
    clearTimeout(FIND_T); FIND_T = setTimeout(() => { if (STEP < 0) return; if (target(STEPS[STEP])) { MISS = 0; place(); } else if (++MISS > 6) { MISS = 0; next(); } else place(); }, 120);
    return;
  }
  MISS = 0;
  const r = el.getBoundingClientRect(), W = innerWidth, H = innerHeight;
  if (!st.wait && !st._scrolled) { st._scrolled = true; el.scrollIntoView({block:'center', behavior:'smooth'}); setTimeout(place, 380); }
  const pad = 8, cx = r.left + r.width / 2, cy = r.top + r.height / 2;
  const rw = Math.max(r.width, 36) + pad * 2, rh = Math.max(r.height, 36) + pad * 2;
  /* a ring for round buttons, a rounded box for wider things */
  const round = Math.abs(r.width - r.height) < 14;
  const s = round ? Math.max(rw, rh) : 0;
  Object.assign(ring.style, round ? {left:cx - s / 2 + 'px', top:cy - s / 2 + 'px', width:s + 'px', height:s + 'px', borderRadius:'50%'}
    : {left:r.left - pad + 'px', top:r.top - pad + 'px', width:rw + 'px', height:rh + 'px', borderRadius:'18px'});
  const last = STEP === STEPS.length - 1 || !STEPS.slice(STEP + 1).some(target);
  tip.innerHTML = `<b>${esc(st.t())}</b><p>${esc(st.s)}</p>${st.wait ? '' : `<div class="mt-row"><small>${STEP} of ${STEPS.length - 1}</small><button type="button" class="mt-b gold sm" data-mt="next">${last ? 'Done' : 'Next'}</button></div>`}`;
  /* the words go below the ring when there is room, else above; the arrow points from them to the ring */
  const tw = Math.min(300, W - 24); tip.style.width = tw + 'px';
  const th = tip.offsetHeight || 110, below = (round ? cy + s / 2 : r.bottom + pad) + 70 + th < H - 20;
  const tl = Math.max(12, Math.min(W - tw - 12, cx - tw / 2));
  const ringB = round ? cy + s / 2 : r.bottom + pad, ringT = round ? cy - s / 2 : r.top - pad;
  if (below) { tip.style.top = ringB + 56 + 'px'; arrow.style.top = ringB + 2 + 'px'; arrow.style.transform = 'rotate(180deg)'; }
  else { tip.style.top = Math.max(12, ringT - 56 - th) + 'px'; arrow.style.top = ringT - 52 + 'px'; arrow.style.transform = 'none'; }
  tip.style.left = tl + 'px'; arrow.style.left = cx - 22 + 'px';
  /* waiting for the tap on the target itself: the dimmed screen lets taps through only there */
  L.classList.toggle('wait', !!st.wait);
  L.classList.add('has');
}
const target = st => { const all = [...document.querySelectorAll(st.sel)].filter(e => e.offsetParent !== null && e.getBoundingClientRect().width > 0); return all[0] || null; };

/* ---------- moving through ---------- */
function start(){
  V = (N.views || []).find(v => v.root && v.root.isConnected && isGM(v)); if (!V) return;
  const ui = V.ui;
  /* to one of the GM's chats (not his private notes), with nothing in front of it */
  ui.sheet = null; ui.pop = null; ui.shelf = false; ui.tab = 'chat';
  if (!ui.ch || ui.ch === 'gm') ui.ch = 'table';
  if (V.dev === 'phone' && N.sideOpen && N.sideOpen(V)) ui.sidePane = false;
  STEPS.forEach(s => { s._scrolled = false; });
  STEP = 0; N.render(V); paint();
}
function next(){
  STEP++;
  if (STEP >= STEPS.length) return end();
  paint();
}
function end(){ STEP = -1; V = null; clearTimeout(FIND_T); if (L) { L.classList.remove('on', 'has', 'wait', 'touring', 'intro'); } OPEN = false; markSeen(); }
tour.end = end;

/* ---------- every draw ---------- */
const prev = N.onRender;
N.onRender = v => {
  if (prev) prev(v);
  try {
    if (!OPEN && STEP < 0 && SEEN === false && isGM(v) && N.mu && !N.gated) { OPEN = true; SEEN = true; paint(); }
    if (STEP === 0 && v === V && v.ui.sheet === 'music') { STEP = 1; }
    /* the Music window closed mid-tour: the tour ends with it */
    if (STEP > 0 && v === V && v.ui.sheet !== 'music') { end(); return; }
    if (STEP >= 0) requestAnimationFrame(place);
  } catch(e) { console.warn('tour', e); }
};
})();
