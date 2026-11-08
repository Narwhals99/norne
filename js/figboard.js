/* Norne: 3D figures on the fight board (Jack, 2026-11-08: "wire them into combat").
   Every fighter on the board stands as their toy figure instead of a round token, and the attack animations
   (js/fx.js) play on the figures: the attacker swings a sword, draws a bow or casts with a staff, the target is hit,
   blocks or is knocked down, and someone taken out stays lying down. A token moved to another zone walks there.
   Shown only where the figure maker is (N.figOk: Jack and the GM), and only while Profile > Figures in fights is on
   (this device; localStorage norne-figs). Everyone else, and any device without 3D, keeps the round tokens.
   Whose figure: a character's saved figure (c.fig), an NPC card's (n.fig) or the fighter's own random look (t.fig).
   A fighter with none gets a look made from their id, so it is the same on every screen and a crowd isn't clones.
   How it is drawn: one WebGL canvas inside the board's camera layer (.cam), under the names, stress boxes and effects,
   so it zooms with the attack camera. The tokens stay where they are (they are still what you tap and drag); each
   figure stands on its token's circle, which turns invisible (.tok.fig), and follows the token as fx.js moves it.
   The camera looks down on the board at 22 degrees, so the figures read as minis on a table, the bases' tops show,
   and someone lower on the board stands in front. Idle figures redraw 24 times a second, moves and attacks at the
   screen's full rate (fx.js calls N.figFrame on its own frames so both line up exactly), nothing while the board is
   off screen, and the 3D scene is let go a minute after the board is gone, so phones get their memory back. */
(function(){
const N = window.N;
const TILT = 22 * Math.PI / 180, SIN = Math.sin(TILT), COS = Math.cos(TILT), IDLE_MS = 1000 / 24;
/* world units to pixels: a figure's base (radius 21) is a little wider than the token's circle */
const PX = 38, BASE_R = 21, DROP = .2;
const RMQ = matchMedia('(prefers-reduced-motion: reduce)');
let pref = true; try { pref = localStorage.getItem('norne-figs') !== '0'; } catch (e) {}
N.figPrefOn = () => pref;
N.figPref = on => { pref = !!on; try { localStorage.setItem('norne-figs', pref ? '1' : '0'); } catch (e) {} };
let kit = null, kitBusy = false, no3d = false;
const on = v => pref && !no3d && !!(N.figOk && N.figOk()) && !!v && !!v.role;
/* the board lays out for figures once the first one stands there */
N.figOn = v => { const S = v && v._fig; if (!S || !on(v)) return false; for (const F of S.figs.values()) if (F.rig) return true; return false; };
/* the token hides its circle only once its figure is really standing there */
const ELF = new WeakMap();
/* (S.v === v: a phone swipe's preview of the fight pane is a copy of the screen with no 3D in it, so it shows circles) */
N.figHas = (v, t) => { const S = v && v._fig, F = S && S.v === v && S.figs.get(t.id); return !!(F && F.rig && on(v)); };

const clamp = (x, a, b) => Math.max(a, Math.min(b, x)), seg = (t, a, b) => clamp((t - a) / (b - a), 0, 1), lerp = (a, b, u) => a + (b - a) * u;
const eOut = u => 1 - Math.pow(1 - u, 3), eIO = u => u < .5 ? 4 * u * u * u : 1 - Math.pow(-2 * u + 2, 3) / 2;
const hash = s => { let h = 2166136261; for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619); return h >>> 0; };
const rng = seed => () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
const angTo = (a, b) => { let d = (b - a) % (Math.PI * 2); if (d > Math.PI) d -= Math.PI * 2; if (d < -Math.PI) d += Math.PI * 2; return d; };

/* ---------- which figure a fighter is ---------- */
const BASES = {pc:0x2b3f8f, ally:0x1f5c45, foe:0x6e2029};
function wantOf(t){
  const g = N.G, K = kit.K, copy = s => JSON.parse(JSON.stringify(s));
  let fig = null, race = '';
  if (t.kind === 'pc') { const c = g.chars[t.ref]; fig = c && c.fig; race = c && c.race; }
  else { const n = g.npcs.find(x => x.id === t.ref); fig = (n && n.fig) || t.fig; race = (n && n.race) || (t.fig && t.fig.race); }
  const side = t.kind === 'pc' ? 'pc' : N.sideOf(t) === 'ally' ? 'ally' : 'foe';
  let spec = fig && K.RACES[fig.race] ? copy(fig) : null;
  if (!spec) { const r = K.RACE_LIST.find(x => x.toLowerCase() === String(race || '').trim().toLowerCase()) || 'Human'; spec = K.randomSpec(r, rng(hash(t.id))); }
  spec = K.faceFix(spec); spec.hair = K.hairId(spec.hair || 'bald');
  return {spec, base:BASES[side], key:side + '|' + JSON.stringify(spec)};
}

/* ---------- the 3D scene of one screen ---------- */
function init(v){
  const {THREE} = kit, cv = document.createElement('canvas');
  cv.className = 'figcv'; cv.setAttribute('aria-hidden', 'true'); cv.dataset.keep = '1';
  let r = null;
  try { r = new THREE.WebGLRenderer({canvas:cv, antialias:true, alpha:true, powerPreference:'default'}); } catch (e) {}
  if (!r) { no3d = true; if (N.renderAll) N.renderAll(); return null; }
  r.outputColorSpace = THREE.SRGBColorSpace; r.setClearColor(0, 0);
  const scene = new THREE.Scene();
  scene.add(new THREE.HemisphereLight(0xfff0dc, 0x40386a, 1.9));
  const sun = new THREE.DirectionalLight(0xffffff, 2.5); sun.position.set(-300, 700, 600); scene.add(sun);
  /* pixels on the board are world units: x to the right, the floor runs away from the camera, so a floor point at
     depth z shows z*sin(tilt) pixels down the board */
  const camera = new THREE.OrthographicCamera(0, 1, 0, -1, 1, 60000), D = 20000;
  camera.position.set(0, D * SIN, D * COS); camera.rotation.set(-TILT, 0, 0);
  const S = v._fig = {v, r, scene, camera, cv, figs:new Map(), q:[], W:0, H:0, pr:0, raf:0, last:0, cols:{}};
  cv.addEventListener('webglcontextlost', e => { e.preventDefault(); S.lost = true; });
  cv.addEventListener('webglcontextrestored', () => { S.lost = false; draw(S, performance.now()); });
  S.ro = new ResizeObserver(() => { if (S.cam && S.cam.isConnected) { measure(S, true); draw(S, performance.now()); } });
  return S;
}
function teardown(v){
  const S = v._fig; if (!S) return;
  S.dead = true; cancelAnimationFrame(S.raf); clearTimeout(S.park); S.ro.disconnect();
  for (const F of S.figs.values()) if (F.rig) { S.scene.remove(F.rig.root); kit.K.dispose(F.rig); }
  S.figs.clear(); S.cv.remove();
  S.r.dispose(); try { S.r.forceContextLoss(); } catch (e) {}
  v._fig = null;
}
/* the board went away (another tab, the phone's chat pane): stop drawing, and let the scene go if it stays away */
function park(v){
  const S = v._fig; if (!S) return;
  cancelAnimationFrame(S.raf); S.raf = 0;
  if (!S.park) S.park = setTimeout(() => { if (v._fig === S && !(S.cam && S.cam.isConnected)) teardown(v); else S.park = 0; }, 60000);
}

/* after every redraw of the screen */
function attach(v){
  const board = v.root.querySelector('[data-board]'), cam = board && board.querySelector('.cam');
  if (!on(v)) { if (v._fig) teardown(v); return; }
  if (!cam) { park(v); return; }
  if (!kit) { if (!kitBusy && N.figKit) { kitBusy = true; N.figKit().then(k => { kit = k; }).catch(() => { no3d = true; }).then(() => { kitBusy = false; if (N.renderAll) N.renderAll(); }); } return; }
  const S = v._fig || init(v); if (!S) return;
  clearTimeout(S.park); S.park = 0;
  if (S.board !== board) { S.ro.disconnect(); S.ro.observe(board); S.board = board; }
  S.cam = cam;
  /* last in the camera layer, after the zones, so redraws still match the zones one for one (data-keep: redraws leave it) */
  if (S.cv.parentNode !== cam) cam.appendChild(S.cv);
  colours(S);
  sync(S);
  draw(S, performance.now());
  loop(S);
}

function colours(S){
  const {THREE} = kit, cs = getComputedStyle(S.board), c = (k, d) => { const o = new THREE.Color(d); try { const s = cs.getPropertyValue(k).trim(); if (/^(#|rgb|hsl)/.test(s)) o.setStyle(s); } catch (e) {} return o; };
  S.cols = {now:c('--gold', 0xf4c46e), sel:c('--accent', 0x8f7bff), target:c('--ember', 0xff6a3d)};
}

/* which tokens are on the board, which figures to build or drop, and where each one stands */
function sync(S){
  const g = N.G, cb = g.combat, els = new Map();
  S.cam.querySelectorAll('.tok[data-tok]').forEach(e => els.set(e.dataset.tok, e));
  const keep = new Set();
  for (const t of cb.tokens || []) {
    const el = els.get(t.id); if (!el) continue;
    keep.add(t.id);
    let F = S.figs.get(t.id);
    if (!F) { F = {id:t.id, phase:hash(t.id) % 2400, yaw:null}; S.figs.set(t.id, F); }
    F.t = t; F.el = el; F.av = el.querySelector('.av'); ELF.set(el, F);
    const w = wantOf(t);
    if (w.key !== F.key && w.key !== F.want) { F.want = w.key; S.q.push([F, w]); }
  }
  for (const [id, F] of S.figs) if (!keep.has(id)) { if (F.rig) { S.scene.remove(F.rig.root); kit.K.dispose(F.rig); } S.figs.delete(id); }
  measure(S, false);
  pump(S);
}
function camXY(el, cam){
  let x = 0, y = 0, e = el;
  while (e && e !== cam) { x += e.offsetLeft; y += e.offsetTop; const p = e.offsetParent; if (p && p !== cam) { x += p.clientLeft; y += p.clientTop; } e = p; }
  return e === cam ? {x, y} : null;
}
function measure(S, snap){
  const W = S.cam.offsetWidth, H = S.cam.offsetHeight, now = performance.now();
  if (W !== S.W || H !== S.H) { S.W = W; S.H = H; snap = true; }
  for (const F of S.figs.values()) {
    const av = F.av; if (!av || !av.isConnected) continue;
    const p = camXY(av, S.cam); if (!p) continue;
    F.R = av.offsetWidth / 2;
    const x = p.x + F.R, y = p.y + F.R;
    /* how far over the circle's middle the figure's head reaches: its name floats just above it (css: .tok.fig .nm) */
    if (F.rig) F.el.style.setProperty('--fh', (F.rig.h * 1.06 * F.R * 2 / PX * COS - F.R * DROP + 3).toFixed(1) + 'px');
    const zoneMoved = F.zone != null && F.zone !== F.t.zone;
    F.zone = F.t.zone;
    if (F.x == null || snap || !F.rig) { F.x = x; F.y = y; F.tw = null; continue; }
    const at = F.tw ? tweenAt(F, now) : {x:F.x, y:F.y};
    if (Math.hypot(x - (F.tw ? F.tw.x1 : F.x), y - (F.tw ? F.tw.y1 : F.y)) < .5) continue;
    const d = Math.hypot(x - at.x, y - at.y), walk = zoneMoved && d > F.R;
    F.tw = {x0:at.x, y0:at.y, x1:x, y1:y, t0:now, dur:walk ? clamp(d / (F.R * 7) * 1000, 500, 1400) : 260, walk};
  }
  /* idle figures face the nearest fighter of the other side, left or right */
  const figs = [...S.figs.values()];
  for (const F of figs) {
    const me = N.sideOf(F.t) === 'foe'; let best = null, bd = 1e9;
    for (const O of figs) { if (O === F || O.x == null || O.t.out || (N.sideOf(O.t) === 'foe') === me) continue; const d = Math.hypot(O.x - F.x, O.y - F.y); if (d < bd) { bd = d; best = O; } }
    F.face = best ? (best.x >= F.x ? 1 : -1) : me ? -1 : 1;
  }
}
const tweenAt = (F, now) => { const w = F.tw, u = seg(now, w.t0, w.t0 + w.dur), e = w.walk ? u : eIO(u); return {x:lerp(w.x0, w.x1, e), y:lerp(w.y0, w.y1, e), u}; };

/* figures are built one at a time, each after its hairstyle's model has arrived, so a crowd doesn't freeze the page.
   When the last one is in, the screen is drawn again and the tokens swap their circles for the figures. */
function pump(S){
  if (S.pumping) return;
  S.pumping = true;
  const next = () => {
    if (S.dead) return;
    const job = S.q.shift();
    if (!job) { S.pumping = false; if (S.built) { S.built = false; N.render(S.v); } return; }
    const [F, w] = job;
    if (F.want !== w.key || S.figs.get(F.id) !== F) { next(); return; }
    kit.K.loadHair(w.spec.hair).catch(() => {}).then(() => {
      if (S.dead) return;
      if (F.want === w.key && S.figs.get(F.id) === F) { build(S, F, w); S.built = true; }
      setTimeout(next, 0);
    });
  };
  next();
}
function build(S, F, w){
  const K = kit.K;
  if (F.rig) { S.scene.remove(F.rig.root); K.dispose(F.rig); }
  const rig = K.buildFigure(w.spec, {baseColor:w.base});
  if (rig.ring) { rig.ring.material.transparent = true; rig.ring.material.depthWrite = false; }
  /* the colours the figure is painted in, so a taken-out figure can be greyed and given back its colours */
  F.paint = rig.mats.map(m => m.color.clone());
  S.scene.add(rig.root);
  F.rig = rig; F.key = w.key; F.last = null; F.blend = null; F.grey = 0; F.warm = null;
  F.wasOut = !!F.t.out; F.getup = 0;
}

/* where the effects should aim on a figure (fx.js): its chest, how far up its head is and down its base */
N.figGeo = el => {
  const F = ELF.get(el); if (!F || !F.rig || !el.classList.contains('fig')) return null;
  const s = F.R * 2 / PX, k = s * COS, dy = F.R * DROP;
  const lift = F.rig.h * .55 * k - dy;
  return {lift, up:F.rig.h * .51 * k + 4, dn:lift + dy + BASE_R * s * SIN + 2};
};

/* ---------- poses ---------- */
/* the attacker's move, on the attack's own clock (ms since it started): the swing, the release or the cast land
   on fx.js's impact and release times */
function atkPose(run, ft){
  if (run.wpn === 'sword') { const t = ft < run.TI ? ft * 720 / run.TI : ft - run.TI + 720; return t < 1700 ? ['sword', t] : null; }
  if (run.wpn === 'bow') { const t = ft < run.TR ? ft * 1050 / run.TR : ft - run.TR + 1050; return t < 1900 ? ['bow', t] : null; }
  const t = ft < run.TF ? ft * 960 / run.TF : ft - run.TF + 960; return t < 1900 ? ['magic', t] : null;
}
function defPose(run, ft){
  const d = ft - run.TI, out = run.out;
  if (out === 'out') return d >= 250 ? ['down', Math.min(d, 1500)] : d >= -200 ? ['hit', d + 200] : null;
  if (out === 'block' || out === 'bstyle' || out === 'tie') return d >= -330 && d < 970 ? ['block', d + 330] : null;
  return d >= -200 && d < 1100 ? ['hit', d + 200] : null;
}
/* the joints a pose moves, so one move can blend into the next instead of jumping */
function joints(rig){
  if (rig._j) return rig._j;
  const list = [rig.body, rig.torso, rig.head, rig.armL.sh, rig.armR.sh, ...rig.legs, rig.tail].filter(Boolean);
  return rig._j = {list, snap:list.map(() => ({p:[0, 0, 0], r:[0, 0, 0], s:[1, 1, 1]})), w:{}};
}
function snapJ(rig){
  const J = joints(rig);
  J.list.forEach((o, i) => { const s = J.snap[i]; s.p[0] = o.position.x; s.p[1] = o.position.y; s.p[2] = o.position.z; s.r[0] = o.rotation.x; s.r[1] = o.rotation.y; s.r[2] = o.rotation.z; s.s[0] = o.scale.x; s.s[1] = o.scale.y; s.s[2] = o.scale.z; });
  for (const k in rig.w) J.w[k] = rig.w[k].visible;
}
function mixJ(rig, u){
  const J = joints(rig), m = 1 - u;
  J.list.forEach((o, i) => { const s = J.snap[i];
    o.position.set(s.p[0] * m + o.position.x * u, s.p[1] * m + o.position.y * u, s.p[2] * m + o.position.z * u);
    o.rotation.set(s.r[0] * m + o.rotation.x * u, s.r[1] * m + o.rotation.y * u, s.r[2] * m + o.rotation.z * u);
    o.scale.set(s.s[0] * m + o.scale.x * u, s.s[1] * m + o.scale.y * u, s.s[2] * m + o.scale.z * u); });
  /* a sword or bow being put away stays in the hand for the first half of the blend */
  if (u < .5) for (const k in rig.w) if (J.w[k]) rig.w[k].visible = true;
}
function tint(F, grey){
  const rig = F.rig;
  rig.mats.forEach((m, i) => { const p = m.userData.base || F.paint[i]; if (!p) return; m.color.copy(p); if (grey) { const l = m.color.r * .3 + m.color.g * .59 + m.color.b * .11; m.color.setRGB(lerp(m.color.r, l, grey) * (1 - .3 * grey), lerp(m.color.g, l, grey) * (1 - .3 * grey), lerp(m.color.b, l, grey) * (1 - .3 * grey)); } });
}

/* ---------- drawing ---------- */
function draw(S, now){
  if (S.dead || S.lost || !S.cam || !S.cam.isConnected || !S.W || !S.H) return;
  if (N.figMakerOpen && N.figMakerOpen()) return;
  const v = S.v, K = kit.K, a = v._afx, run = v._afxRun && v._afxRun.fx, RM = RMQ.matches;
  const ft = run && a && a.start && !a.done ? Date.now() - a.start : null;
  /* sharp while the attack camera zooms in: the canvas zooms with the board, so it draws more pixels then */
  const dpr = devicePixelRatio || 1, pr = Math.min(4, dpr * Math.max(run && run.Z > 1 ? run.Z : 1, dpr < 2 ? 1.25 : 1));
  if (pr !== S.pr || S.W !== S.cw || S.H !== S.ch) {
    S.pr = pr; S.cw = S.W; S.ch = S.H; S.r.setPixelRatio(pr); S.r.setSize(S.W, S.H, false);
    Object.assign(S.camera, {left:0, right:S.W, top:0, bottom:-S.H}); S.camera.updateProjectionMatrix();
  }
  let busy = false;
  for (const F of S.figs.values()) {
    const rig = F.rig, el = F.el; if (!rig) continue;
    const vis = el.isConnected && el.classList.contains('fig') && !el.classList.contains('dragging') && F.x != null;
    rig.root.visible = vis; if (!vis) continue;
    const t = F.t, s = F.R * 2 / PX;
    /* where: the token's place, gliding or walking to a new one, plus how fx.js moves the token */
    let x = F.x, y = F.y, walking = false;
    if (F.tw) { const p = tweenAt(F, now); x = p.x; y = p.y; walking = F.tw.walk; if (p.u >= 1) { F.x = F.tw.x1; F.y = F.tw.y1; F.tw = null; walking = false; } else busy = true; }
    if (el.classList.contains('fxa') || el.classList.contains('fxd')) { const tr = el.style.translate; if (tr) { const p = tr.split(' '); x += parseFloat(p[0]) || 0; y += parseFloat(p[1] || '0') || 0; } }
    const target = el.classList.contains('target');
    rig.root.scale.setScalar(s);
    rig.root.position.set(x, target && !RM ? (1.5 + 1.5 * Math.sin(now / 175)) / COS : 0, (y + F.R * DROP) / SIN);
    /* what it is doing */
    const out = el.classList.contains('out');
    if (F.wasOut && !out) F.getup = now;
    F.wasOut = out;
    let name = 'idle', pt = RM ? 0 : now + F.phase, yaw = (F.face || 1) * .62, ring = el.classList.contains('now') ? 'now' : el.classList.contains('sel') ? 'sel' : target ? 'target' : null;
    let glow = 0, clang = 0;
    /* someone taken out lies on their side across the board, so they read as a fallen figure, not a pair of boots */
    if (out) { name = 'down'; pt = 1500; yaw = (F.face || 1) * 1.35; ring = el.classList.contains('sel') ? 'sel' : null; }
    else if (F.getup && now - F.getup < 700) { name = 'down'; pt = 1900 + (now - F.getup); busy = true; }
    else if (walking) { name = 'walk'; pt = now - F.tw.t0; yaw = Math.atan2(F.tw.x1 - F.tw.x0, (F.tw.y1 - F.tw.y0) / SIN); }
    if (ft != null && ft >= 0 && ft < run.total && (t.id === a.a.att || t.id === a.a.def)) {
      const att = t.id === a.a.att, O = S.figs.get(att ? a.a.def : a.a.att);
      const p = att ? atkPose(run, ft) : defPose(run, ft);
      if (p) { [name, pt] = p; busy = true; }
      else if (!att && run.out === 'out' && ft - run.TI >= 250) { name = 'down'; pt = 1500; }
      /* they turn toward each other, three-quarter on: someone further up the board is faced as if level, so a fight
         never shows the back of a head */
      if (p || !att) if (O && O.x != null) yaw = clamp(Math.atan2(O.x - F.x, Math.abs(O.y - F.y) / SIN), -1.05, 1.05);
      if (att && run.wpn === 'bolt') glow = .65 * (ft < run.TF ? eOut(seg(ft, 0, 650)) : 1 - seg(ft, run.TF, run.TF + 320));
      if (!att && run.out === 'armor') clang = ft >= run.TI ? 1 - seg(ft, run.TI, run.TI + 420) : 0;
    }
    /* the hurt face is drawn as soon as the result arrives (the dice are still rolling), so making it can't stall the attack */
    if (a && a.a && !a.done && t.id === a.a.def && F.warm !== a.id && ['hit', 'style', 'out'].includes(a.a.out)) {
      F.warm = a.id;
      setTimeout(() => { if (S.dead || F.rig !== rig) return; K.animate(rig, 'hit', 300); if (rig.faces && rig.faces.hurt) S.r.initTexture(rig.faces.hurt); F.last = null; }, 0);
    }
    if (F.getup && now - F.getup >= 700) F.getup = 0;
    /* turn smoothly to face where it is going or who it is fighting */
    if (F.yaw == null) F.yaw = yaw;
    const dt = Math.min(100, now - (F.tLast || now)); F.tLast = now;
    const dy = angTo(F.yaw, yaw); if (Math.abs(dy) > .002) { F.yaw += dy * (1 - Math.exp(-dt / 90)); busy = true; } else F.yaw = yaw;
    rig.root.rotation.y = F.yaw;
    /* a new move blends in from the last one over a sixth of a second */
    const L = F.last;
    if (L && L.name !== name) { F.blend = {name:L.name, t:L.t, t0:now}; }
    const still = L && L.name === name && L.t === pt && !F.blend && !glow && !clang;
    F.last = {name, t:pt};
    if (!still) {
      if (F.blend) {
        const u = seg(now, F.blend.t0, F.blend.t0 + 160);
        K.pose(rig, F.blend.name, F.blend.t); snapJ(rig); K.animate(rig, name, pt);
        if (u < 1) { mixJ(rig, eIO(u)); busy = true; } else F.blend = null;
      } else K.animate(rig, name, pt);
      if (glow > .01) K.flash(rig, glow * .7, 0x4f9dff);
      if (clang > .01) K.flash(rig, clang * .5, 0xe4ecf7);
      const grey = out ? .7 : 0;
      if (grey || F.grey) { tint(F, grey); F.grey = grey; }
    }
    if (rig.ring) {
      rig.ring.visible = !!ring;
      if (ring) { rig.ring.material.color.copy(S.cols[ring]); rig.ring.material.opacity = ring === 'sel' ? .95 : .6 + .4 * Math.sin(now / (ring === 'now' ? 350 : 160)); }
    }
  }
  S.r.render(S.scene, S.camera);
  S.last = now; S.busy = busy;
}
function loop(S){
  if (S.raf) return;
  const tick = now => {
    S.raf = 0;
    if (S.dead || !S.cam || !S.cam.isConnected) return;
    S.raf = requestAnimationFrame(tick);
    if (document.hidden) return;
    /* while an attack plays, its own frames draw the figures (N.figFrame) */
    if (S.v._afxRun && S.v._afxRun.fx) return;
    if (!S.busy && (RMQ.matches || now - S.last < IDLE_MS)) return;
    draw(S, now);
  };
  S.raf = requestAnimationFrame(tick);
}
N.figFrame = v => { const S = v && v._fig; if (S && kit) draw(S, performance.now()); };

const prev = N.onRender;
N.onRender = v => { if (prev) prev(v); try { attach(v); } catch (e) { console.error(e); } };
})();
