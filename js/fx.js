/* Norne: attack animations on the fight board.
   When the GM's defense roll settles an attack, every screen showing the board plays it once: the attacker's token
   rushes in and swings a sword (melee), draws a bow and shoots (ranged) or throws a blue bolt (magic), the target
   shakes, and the result pops up over their head in its own colour. Nothing to press; the result card and the fight
   log stay as they are.
   N.cbResolve puts what to play on the result message (res.anim). Every frame is drawn from the time since the attack
   started, so when the screen is redrawn (a new chat line, a tap) the animation picks up where it was. Until the blow
   lands the board keeps showing the target as they were before it (N.fxHold, used by combat.js). */
(function(){
const N = window.N, {esc} = N;
const G = () => N.G;
const NS = 'http://www.w3.org/2000/svg';
const RMQ = matchMedia('(prefers-reduced-motion: reduce)');
let RM = RMQ.matches;

/* which animation an attack plays, from the skill it was rolled with. Anything it can't place
   (Strength, Provoke, a bonus roll, an unknown or missing skill) reads as melee, so it always has the sword to fall back on. */
const weaponFor = sk => sk === 'Shooting' ? 'bow' : N.MAGIC.includes(sk) ? 'bolt' : sk === 'Fighting' ? 'sword' : null;
N.fxWeapon = sk => weaponFor(sk) || 'sword';

/* the outcomes the result card posts, each with its own colour. sub(shifts, attacker, defender) is the small line */
const sh = n => `${n} shift${n === 1 ? '' : 's'}`;
const OUT = {
  hit:   {word:'HIT!', col:'#ff4a36', core:'#ffe680', glow:'#ff5a3c', shake:.4, hit:1, sub:n => sh(n)},
  style: {word:'WITH STYLE!', col:'#ff7a1c', core:'#fff3a6', glow:'#ffb02e', shake:.55, hit:1, big:1.2, cam:1, twinkle:'#ffd768', sub:n => `Hit · ${sh(n)}`},
  out:   {word:'TAKEN OUT!', col:'#ef2448', core:'#ffd7d7', glow:'#ff2a4a', shake:.55, hit:1, big:1.15, cam:1, out:1, sub:(n, a, d) => `${d} is down`},
  armor: {word:'CLANG!', col:'#d3dce7', core:'#ffffff', glow:'#a9b8c9', shake:.22, sub:() => 'Armor holds · no harm'},
  tie:   {word:'TIE!', col:'#ffc531', core:'#fff4c2', glow:'#ffb000', shake:.28, sub:(n, a) => `Boost for ${a}`},
  block: {word:'BLOCKED!', col:'#4ba8ff', core:'#e2f3ff', glow:'#3d8bff', shake:.18, shield:1, sub:() => 'No harm done'},
  bstyle:{word:'BLOCKED!', col:'#86d6ff', core:'#ffffff', glow:'#50b4ff', shake:.18, shield:1, big:1.12, twinkle:'#bfe9ff', sub:(n, a, d) => `With style · boost for ${d}`},
};

/* ---------- art (local units; drawn with a dark ink outline so it reads on any map) ---------- */
const INK = '#1d130b';
const DEFS = `<defs>
  <linearGradient id="fxBlade" x1="0" y1="-7" x2="0" y2="7" gradientUnits="userSpaceOnUse"><stop offset="0" stop-color="#ffffff"/><stop offset=".45" stop-color="#dbe3ec"/><stop offset="1" stop-color="#8d9bac"/></linearGradient>
  <radialGradient id="fxGlow"><stop offset="0" stop-color="#c9ecff" stop-opacity=".95"/><stop offset=".42" stop-color="#5aa8ff" stop-opacity=".5"/><stop offset="1" stop-color="#2a5cff" stop-opacity="0"/></radialGradient>
  <radialGradient id="fxOrb" cx=".38" cy=".34" r=".72"><stop offset="0" stop-color="#ffffff"/><stop offset=".34" stop-color="#d2f0ff"/><stop offset=".74" stop-color="#54a6ff"/><stop offset="1" stop-color="#2450d6"/></radialGradient>
  <radialGradient id="fxWard"><stop offset="0" stop-color="#9fd4ff" stop-opacity=".75"/><stop offset=".6" stop-color="#4b9bff" stop-opacity=".28"/><stop offset="1" stop-color="#4b9bff" stop-opacity="0"/></radialGradient>
</defs>`;
const SWORD = `<path d="M14,-6.5 L86,-6.5 L101,0 L86,6.5 L14,6.5 Z" fill="url(#fxBlade)" stroke="${INK}" stroke-width="3.4" stroke-linejoin="round"/>
  <path d="M19,0 L84,0" stroke="#8494a8" stroke-width="2" stroke-linecap="round"/>
  <path d="M19,-3.4 L85,-3.4" stroke="#fff" stroke-opacity=".85" stroke-width="1.5" stroke-linecap="round"/>
  <rect x="6.5" y="-17" width="8.5" height="34" rx="4" fill="#f0b93f" stroke="${INK}" stroke-width="3"/>
  <rect x="8.6" y="-13" width="2" height="20" rx="1" fill="#ffe7a0"/>
  <rect x="-12" y="-5.2" width="20" height="10.4" rx="3" fill="#7b4723" stroke="${INK}" stroke-width="3"/>
  <path d="M-7,-4.4 L-4,4.4 M-1,-4.4 L2,4.4" stroke="#4a2a12" stroke-width="1.6" stroke-linecap="round"/>
  <circle cx="-15" cy="0" r="6.5" fill="#f0b93f" stroke="${INK}" stroke-width="3"/>
  <circle cx="-16.6" cy="-2.1" r="1.9" fill="#fff6c8"/>`;
const LIMB = 'M-6,-46 C12,-40 17,-18 13,0 C17,18 12,40 -6,46';
const BOW = draw => `<path class="bstr" d="M-6,-46 L${-6 - draw},0 L-6,46" fill="none" stroke="#f6eedb" stroke-width="2.6" stroke-linejoin="round"/>
  <path d="${LIMB}" fill="none" stroke="${INK}" stroke-width="10" stroke-linecap="round"/>
  <path d="${LIMB}" fill="none" stroke="#a8682f" stroke-width="6" stroke-linecap="round"/>
  <path d="M-3,-42 C10,-37 14,-20 11.5,-8" fill="none" stroke="#e3ac6c" stroke-width="1.8" stroke-linecap="round"/>
  <rect x="9.5" y="-8.5" width="9" height="17" rx="3.5" fill="#5a3218" stroke="${INK}" stroke-width="2.6"/>`;
const ARROW = `<path d="M-74,0 L-14,0" stroke="${INK}" stroke-width="5.6" stroke-linecap="round"/>
  <path d="M-74,0 L-14,0" stroke="#d9a868" stroke-width="2.8" stroke-linecap="round"/>
  <path d="M-17,-6.5 L0,0 L-17,6.5 Z" fill="#aab5c3" stroke="${INK}" stroke-width="2.6" stroke-linejoin="round"/>
  <path d="M-72,0 L-80,-8.5 L-62,-8.5 L-57,0 Z" fill="#e8463a" stroke="${INK}" stroke-width="2.2" stroke-linejoin="round"/>
  <path d="M-72,0 L-80,8.5 L-62,8.5 L-57,0 Z" fill="#f4efe2" stroke="${INK}" stroke-width="2.2" stroke-linejoin="round"/>`;
const SHIELD_P = 'M-24,-30 Q0,-37 24,-30 L24,-6 Q24,22 0,34 Q-24,22 -24,-6 Z';
const SHIELD = `<ellipse class="ward" cx="0" cy="0" rx="46" ry="50" fill="url(#fxWard)" opacity="0"/>
  <path d="${SHIELD_P}" fill="#2f63c9" stroke="#14112a" stroke-width="3.6" stroke-linejoin="round"/>
  <path d="${SHIELD_P}" fill="none" stroke="#f2c14e" stroke-width="2.6" transform="scale(.8)"/>
  <path d="M0,-25 L0,24 M-16,-8 L16,-8" stroke="#f2c14e" stroke-width="5" stroke-linecap="round"/>
  <path d="M-16,-25 Q-5,-28.5 5,-27.5" stroke="#a9c8ff" stroke-width="3" stroke-linecap="round" fill="none" opacity=".85"/>`;

/* ---------- maths ---------- */
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const seg = (t, a, b) => clamp((t - a) / (b - a), 0, 1);
const lerp = (a, b, u) => a + (b - a) * u;
const eOut = u => 1 - Math.pow(1 - u, 3), eIn = u => u * u * u;
const eIO = u => u < .5 ? 4 * u * u * u : 1 - Math.pow(-2 * u + 2, 3) / 2;
const eBack = u => { const c1 = 1.70158, c3 = c1 + 1; return 1 + c3 * Math.pow(u - 1, 3) + c1 * Math.pow(u - 1, 2); };
const rnd = (s => () => { s |= 0; s = s + 0x6D2B79F5 | 0; let t = Math.imul(s ^ s >>> 15, 1 | s); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; });
/* the sparks fly the same way on every screen and after every redraw: the randomness comes from the message id */
const hash = s => { let h = 2166136261; for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619); return h >>> 0; };
const star = (x, y, ro, ri, n, rot) => { let d = ''; for (let i = 0; i < n * 2; i++) { const r = i % 2 ? ri : ro, a = rot + i * Math.PI / n; d += `${i ? 'L' : 'M'}${(x + Math.cos(a) * r).toFixed(1)},${(y + Math.sin(a) * r).toFixed(1)}`; } return d + 'Z'; };
const set = (el, attrs) => { for (const k in attrs) el.setAttribute(k, attrs[k]); };

/* ---------- the effect ---------- */
function geo(cam, id){
  const el = cam.querySelector(`.tok[data-tok="${CSS.escape(id)}"]`), av = el && el.querySelector('.av');
  if (!av) return null;
  const r = av.getBoundingClientRect(), c = cam.getBoundingClientRect();
  return {el, av, x:r.left - c.left + r.width / 2, y:r.top - c.top + r.height / 2, R:r.width / 2};
}
function build(board, s){
  const cam = board.querySelector('.cam'), bg = board.querySelector('.bg'), an = s.a, at = N.tokById(an.att), dt = N.tokById(an.def);
  if (!cam || !at || !dt) return null;
  const o = OUT[an.out] || OUT.hit, wpn = ['sword', 'bow', 'bolt'].includes(an.wpn) ? an.wpn : 'sword';
  const A = geo(cam, an.att), D = geo(cam, an.def), W = cam.clientWidth, H = cam.clientHeight;
  if (!A || !D || !W || !H || !A.R || !D.R) return null;
  const dx = D.x - A.x, dy = D.y - A.y, d = Math.hypot(dx, dy) || 1, ux = dx / d, uy = dy / d;
  let nx = uy, ny = -ux; if (ny > 0 || (ny === 0 && nx > 0)) { nx = -nx; ny = -ny; }
  const R = A.R, Rd = D.R, sg = ux >= 0 ? 1 : -1, phi = Math.atan2(uy, ux) * 180 / Math.PI;
  const fx = {cam, bg, o, A, D, W, H, d, ux, uy, nx, ny, R, Rd, s:sg, phi, wpn, out:an.out, box:an.box, rng:rnd(hash(s.id)), filled:[]};
  fx.rot0 = fx.rng() * Math.PI;
  const at2 = (al, k) => ({x:D.x - ux * Rd * al + nx * Rd * (k || 0), y:D.y - uy * Rd * al + ny * Rd * (k || 0)});
  /* where the blow lands, by outcome */
  fx.Pk = o.hit ? .55 : o.shield ? 1.2 : an.out === 'tie' ? .8 : .85;
  if (wpn === 'sword') {
    fx.TI = 490;
    fx.Dd = Math.max(0, d - R - Rd - (o.hit ? .22 : .9) * R);
    fx.P = at2(fx.Pk);
  } else if (wpn === 'bow') {
    fx.TR = 840; fx.F = clamp(170 + d * .55, 200, 380); fx.TI = fx.TR + fx.F;
    fx.kb = 2.3 * R / 92;
    const tipL = -.12 * R + R * 1.05 + (68 - 24) * fx.kb;
    fx.S = {x:A.x + ux * tipL, y:A.y + uy * tipL};
    fx.E = o.hit ? at2(.85) : o.shield ? at2(1.3) : an.out === 'tie' ? at2(.15, .95) : at2(.95);
    fx.C = {x:(fx.S.x + fx.E.x) / 2 + nx * d * .1, y:(fx.S.y + fx.E.y) / 2 + ny * d * .1};
    fx.P = fx.E;
  } else {
    fx.TF = 780; fx.F = clamp(130 + d * .45, 170, 320); fx.TI = fx.TF + fx.F;
    const cL = -.08 * R + R * 1.3;
    fx.S = {x:A.x + ux * cL, y:A.y + uy * cL};
    fx.E = o.hit ? at2(.45) : o.shield ? at2(1.25) : an.out === 'tie' ? at2(.5, .6) : at2(.8);
    fx.P = fx.E;
  }
  fx.total = fx.TI + 2350;

  const svg = document.createElementNS(NS, 'svg');
  set(svg, {class:'fxsvg', width:W, height:H, viewBox:`0 0 ${W} ${H}`, 'aria-hidden':'true'});
  const sparks = Array.from({length:8}, () => '<line stroke-linecap="round"/>').join('');
  const bolts = Array.from({length:5}, () => '<polyline class="lg" fill="none" stroke="#58b2ff" stroke-linejoin="round" stroke-linecap="round"/><polyline class="lc" fill="none" stroke="#f2fbff" stroke-linejoin="round" stroke-linecap="round"/>').join('');
  const trail = Array.from({length:9}, () => '<circle fill="#8fd0ff"/>').join('');
  const parts = Array.from({length:6}, () => '<circle fill="#e8f8ff" stroke="#5fb4ff" stroke-width="1.5"/>').join('');
  const tw = Array.from({length:4}, () => `<path d="M0,-10 C1,-2 2,-1 10,0 C2,1 1,2 0,10 C-1,2 -2,1 -10,0 C-2,-1 -1,-2 0,-10Z" fill="${o.twinkle || '#fff'}" stroke="${INK}" stroke-width="1.2" opacity="0"/>`).join('');
  svg.innerHTML = `${DEFS}<g class="g-trail" opacity="0"><path class="t1" fill="none" stroke="#ffffff" stroke-linecap="round"/><path class="t2" fill="none" stroke="#ffffff" stroke-linecap="round"/></g>
    <g class="g-tr">${trail}</g><g class="g-pt">${parts}</g>
    <g class="g-wpn" opacity="0">${wpn === 'sword' ? SWORD : wpn === 'bow' ? BOW(0) : ''}</g>
    <g class="g-proj" opacity="0">${wpn === 'bow' ? ARROW : wpn === 'bolt' ? '<circle class="og" fill="url(#fxGlow)"/><circle class="oc" fill="url(#fxOrb)" stroke="#eaf7ff"/><circle class="oh" fill="#fff"/>' : ''}</g>
    <g class="g-sh" opacity="0">${SHIELD}</g>
    <g class="g-fx"><circle class="ring" fill="none" opacity="0"/><path class="b1" opacity="0"/><path class="b2" opacity="0"/><g class="sp" stroke="${o.core}">${sparks}</g><g class="lt" opacity="0">${bolts}</g></g>
    <g class="g-tw">${tw}</g>`;
  cam.appendChild(svg);
  fx.svg = svg;
  const q = c => svg.querySelector(c);
  fx.g = {trail:q('.g-trail'), t1:q('.t1'), t2:q('.t2'), wpn:q('.g-wpn'), str:q('.bstr'), proj:q('.g-proj'), og:q('.og'), oc:q('.oc'), oh:q('.oh'), sh:q('.g-sh'), ward:q('.ward'),
    ring:q('.ring'), b1:q('.b1'), b2:q('.b2'), sp:[...svg.querySelectorAll('.sp line')], lt:q('.lt'), lg:[...svg.querySelectorAll('.lt .lg')], lc:[...svg.querySelectorAll('.lt .lc')],
    tr:[...svg.querySelectorAll('.g-tr circle')], pt:[...svg.querySelectorAll('.g-pt circle')], tw:[...svg.querySelectorAll('.g-tw path')]};
  set(fx.g.ring, {stroke:o.glow}); set(fx.g.b1, {fill:o.col, stroke:INK, 'stroke-width':Math.max(1.5, R * .09), 'stroke-linejoin':'round'}); set(fx.g.b2, {fill:o.core});
  fx.sparkA = fx.g.sp.map((_, i) => (o.shield ? phi + 180 : phi) + (-75 + i * 150 / 7) + (fx.rng() - .5) * 18);
  fx.sparkV = fx.g.sp.map(() => .8 + fx.rng() * .6);

  /* the words over the target's head */
  const tx = document.createElement('div');
  tx.className = 'fxt';
  tx.setAttribute('aria-hidden', 'true');
  tx.style.setProperty('--k', o.col);
  tx.style.setProperty('--fs', (clamp(R * 1.05, 14, 28) * (o.big || 1)).toFixed(1) + 'px');
  tx.innerHTML = `<b>${o.word}</b><small>${esc(o.sub(an.dmg || 0, N.tokName(at), N.tokName(dt)))}</small>`;
  cam.appendChild(tx);
  fx.tx = tx; fx.tw = tx.offsetWidth; fx.th = tx.offsetHeight;
  const rise = R * .9;
  /* camera: push in close (1.7x on small boards, 1.25x on big ones), never past the board's edges.
     Two fighters close together: one shot of both, as in the preview. Further apart: it starts on the attacker
     winding up, follows the rush, the arrow or the bolt across the board, and settles on the target and the words. */
  /* friendly fire: two fighters on one side stand in one column, so the attacker can be right above the target.
     Then the words go under the target's feet instead of on top of the attacker. */
  const below = uy > .5;
  const Zmax = RM ? 1 : W < 600 ? 1.7 : 1.25, top = below ? D.y - Rd - 6 : D.y - Rd - 6 - fx.th - rise;
  const fit = b => Math.min(W / Math.max(b.x1 - b.x0, b.tw || 0), H / (b.y1 - b.y0));
  const shot = (b, cx, cy) => ({TX:clamp(clamp(W / 2 - Z * cx, -Z * b.x0, W - Z * b.x1), W - Z * W, 0), TY:clamp(clamp(H / 2 - Z * cy, -Z * b.y0, H - Z * b.y1), H - Z * H, 0)});
  const foot = below ? D.y + Rd + 10 + fx.th * 1.15 : 0;
  const both = {x0:Math.min(A.x, D.x) - 3.4 * R, x1:Math.max(A.x, D.x) + 3.4 * R, y0:Math.min(A.y - 1.4 * R, top), y1:Math.max(A.y + 1.9 * R, D.y + 1.9 * R, foot), tw:fx.tw + 12};
  const atk = {x0:A.x - 3.4 * R, x1:A.x + 3.4 * R, y0:A.y - 3.2 * R, y1:A.y + 1.9 * R};
  const tgt = {x0:D.x - 3.4 * R, x1:D.x + 3.4 * R, y0:top, y1:Math.max(D.y + 1.9 * R, foot), tw:fx.tw + 12};
  /* one shot when both fit at the zoom the travelling camera would use anyway */
  const fb = fit(both), Zp = Math.min(Zmax, fit(atk), fit(tgt)), close = fb >= Zp, Z = close ? Math.min(Zmax, fb) : Zp;
  fx.Z = Z > 1.05 ? Z : 1;
  if (fx.Z === 1) fx.cA = fx.cD = {TX:0, TY:0};
  else if (close) fx.cA = fx.cD = shot(both, (A.x + D.x) / 2, (A.y + D.y) / 2 - .5 * R);
  else {
    fx.cA = shot(atk, (atk.x0 + atk.x1) / 2, (atk.y0 + atk.y1) / 2);
    fx.cD = shot(tgt, (tgt.x0 + tgt.x1) / 2, (tgt.y0 + tgt.y1) / 2);
    /* when the camera travels: with the rush, the arrow or the bolt */
    fx.pan = wpn === 'sword' ? {a:200, b:430, c:200, d:480, ease:eIn} : wpn === 'bow' ? {a:fx.TR, b:fx.TI, c:fx.TR - 100, d:fx.TI + 60, ease:u => u}
      : {a:fx.TF, b:fx.TI, c:fx.TF - 100, d:fx.TI + 60, ease:u => Math.pow(u, 1.15)};
  }
  const vx0 = -fx.cD.TX / fx.Z, vx1 = (W - fx.cD.TX) / fx.Z, vy0 = -fx.cD.TY / fx.Z;
  fx.txX = clamp(D.x, vx0 + fx.tw * .64 + 4, vx1 - fx.tw * .64 - 4);
  /* txY is the words' bottom edge before they rise by `rise` */
  fx.txY = below ? Math.min(D.y + Rd + 8 + fx.th, (H - fx.cD.TY) / fx.Z - 4) + rise : Math.max(D.y - Rd - 6, vy0 + fx.th + rise + 6);
  A.el.classList.add('fxa'); D.el.classList.add('fxd');
  board.classList.add('playing');
  fx.board = board;
  return fx;
}
/* takes the effect off the board again. end: the attack is over, so what it showed (a checked box, taken out) stays */
function clear(fx, end){
  fx.cam.style.transform = '';
  if (fx.bg) fx.bg.style.transform = '';
  fx.svg.remove(); fx.tx.remove();
  for (const el of [fx.A.el, fx.D.el]) { el.style.translate = el.style.rotate = el.style.filter = ''; el.classList.remove('fxa', 'fxd'); }
  fx.filled.forEach(f => { if (!f) return; f.b.classList.remove('fxn'); if (!end && !f.was) f.b.classList.remove('on'); });
  if (!end && fx.addedOut) fx.D.el.classList.remove('out');
  fx.board.classList.remove('playing');
}

/* moves a token along the attack line (al) and across it (pp) */
function place(fx, el, al, pp, rot, down){
  el.style.translate = `${(fx.ux * al + fx.nx * pp).toFixed(2)}px ${(fx.uy * al + fx.ny * pp + (down || 0)).toFixed(2)}px`;
  el.style.rotate = `${(rot || 0).toFixed(2)}deg`;
}
function tgtOff(fx, t){
  const TI = fx.TI, o = fx.o;
  let al = 0, pp = 0, rot = 0;
  if (o.shield && t > fx.TI - 160 && t < TI) al = -.08 * fx.Rd * seg(t, TI - 160, TI);
  if (t >= TI) {
    const u = seg(t, TI, TI + 480), A = o.shake * fx.Rd * (RM ? .3 : 1);
    al = A * (Math.sin(u * Math.PI * 7) * (1 - u) * .75 + (u < .12 ? u / .12 : 1 - (u - .12) / .88) * .55);
    pp = A * .25 * Math.sin(u * Math.PI * 11) * (1 - u);
    rot = o.shake * 12 * Math.sin(u * Math.PI * 6) * (1 - u) * fx.s;
  }
  return {al, pp, rot};
}

function swordAt(fx, t){
  const {R, s, o} = fx, TI = fx.TI, Dd = fx.Dd;
  let al;
  if (t < 200) al = -.3 * R * eOut(t / 200);
  else if (t < 430) al = lerp(-.3 * R, Dd, eIn(seg(t, 200, 430)));
  else if (o.hit) al = t < 640 ? Dd + .12 * R * eOut(seg(t, 430, 560)) : lerp(Dd + .12 * R, 0, eIO(seg(t, 640, 980)));
  else al = t < TI ? Dd : t < TI + 130 ? lerp(Dd, Dd - .55 * R, eOut(seg(t, TI, TI + 130))) : lerp(Dd - .55 * R, 0, eIO(seg(t, TI + 130, TI + 520)));
  const jf = RM ? 0 : t < 200 ? .35 : t < 600 ? 1 : 1 - seg(t, 600, 1000);
  const pp = R * .13 * jf * (Math.sin(t * .13) + .5 * Math.sin(t * .41 + 1)), rot = 7 * jf * Math.sin(t * .09 + .5);
  place(fx, fx.A.el, al, pp, rot);
  const ax = fx.A.x + fx.ux * al + fx.nx * pp, ay = fx.A.y + fx.uy * al + fx.ny * pp;
  let lam;
  if (t < 400) lam = -115 + 5 * Math.sin(t * .02);
  else if (o.hit) lam = lerp(-115, 70, eIO(seg(t, 400, 560)));
  else lam = t < TI ? lerp(-115, -8, eIn(seg(t, 400, TI))) : lerp(-8, -55, eOut(seg(t, TI, TI + 160)));
  const th = fx.phi + s * lam, rad = th * Math.PI / 180, k = 2.35 * R / 100 * (t < 180 ? eBack(seg(t, 0, 180)) : 1);
  set(fx.g.wpn, {transform:`translate(${(ax + Math.cos(rad) * R * .82).toFixed(2)} ${(ay + Math.sin(rad) * R * .82).toFixed(2)}) rotate(${th.toFixed(2)}) scale(${k.toFixed(4)})`, opacity:(1 - seg(t, 900, 1080)).toFixed(3)});
  /* the swoosh behind the blade */
  const end = o.hit ? 560 : TI;
  if (t >= 400 && t < end + 200) {
    const l0 = Math.max(-115, lam - 125), rs = R * .82 + 2.35 * R * .62, w = 2.35 * R * .38;
    const arc = (r0, from, to) => { const a0 = (fx.phi + s * from) * Math.PI / 180, a1 = (fx.phi + s * to) * Math.PI / 180; return `M${(ax + Math.cos(a0) * r0).toFixed(1)},${(ay + Math.sin(a0) * r0).toFixed(1)} A${r0.toFixed(1)},${r0.toFixed(1)} 0 0 ${s > 0 ? 1 : 0} ${(ax + Math.cos(a1) * r0).toFixed(1)},${(ay + Math.sin(a1) * r0).toFixed(1)}`; };
    set(fx.g.t1, {d:arc(rs, l0, lam), 'stroke-width':w.toFixed(1), 'stroke-opacity':.28});
    set(fx.g.t2, {d:arc(rs + w * .22, Math.max(l0, lam - 70), lam), 'stroke-width':(w * .4).toFixed(1), 'stroke-opacity':.75});
    set(fx.g.trail, {opacity:(1 - seg(t, end, end + 180)).toFixed(3)});
  } else set(fx.g.trail, {opacity:0});
}

function bowAt(fx, t){
  const {R, s, o, TR, TI, kb} = fx;
  const al = t < TR ? -.12 * R * eOut(seg(t, 260, 800)) : t < TR + 80 ? lerp(-.12 * R, -.26 * R, eOut(seg(t, TR, TR + 80))) : lerp(-.26 * R, 0, eIO(seg(t, TR + 80, TR + 420)));
  const trem = RM || t >= TR ? 0 : seg(t, 560, TR);
  const pp = R * .05 * trem * Math.sin(t * .5), rot = 2 * trem * Math.sin(t * .37);
  place(fx, fx.A.el, al, pp, rot);
  const ax = fx.A.x + fx.ux * al + fx.nx * pp, ay = fx.A.y + fx.uy * al + fx.ny * pp;
  const ang = fx.phi - s * 35 * (1 - eOut(seg(t, 0, 220))) + 1.8 * trem * Math.sin(t * .61), br = ang * Math.PI / 180;
  const bx = ax + Math.cos(br) * R * 1.05, by = ay + Math.sin(br) * R * 1.05;
  const draw = t < 260 ? 0 : t < TR ? 24 * eOut(seg(t, 260, 800)) : -7 * Math.sin((t - TR) * .075) * Math.exp(-(t - TR) / 85);
  set(fx.g.wpn, {transform:`translate(${bx.toFixed(2)} ${by.toFixed(2)}) rotate(${ang.toFixed(2)}) scale(${(kb * (t < 220 ? eBack(seg(t, 0, 220)) : 1)).toFixed(4)})`, opacity:(1 - seg(t, TR + 380, TR + 600)).toFixed(3)});
  set(fx.g.str, {d:`M-6,-46 L${(-6 - draw).toFixed(2)},0 L-6,46`});
  /* the arrow: nocked, in flight, then stuck or knocked away */
  let x, y, a, op = 1;
  if (t < TR) { const tl = (68 - draw) * kb; x = bx + Math.cos(br) * tl; y = by + Math.sin(br) * tl; a = ang; op = seg(t, 150, 260); }
  else if (t < TI) {
    const v = seg(t, TR, TI), S = fx.S, C = fx.C, E = fx.E, m = 1 - v;
    x = m * m * S.x + 2 * m * v * C.x + v * v * E.x; y = m * m * S.y + 2 * m * v * C.y + v * v * E.y;
    a = Math.atan2(2 * m * (C.y - S.y) + 2 * v * (E.y - C.y), 2 * m * (C.x - S.x) + 2 * v * (E.x - C.x)) * 180 / Math.PI;
  } else {
    const E = fx.E, C = fx.C, ta = Math.atan2(E.y - C.y, E.x - C.x), aE = ta * 180 / Math.PI, tau = t - TI;
    if (o.hit) { const g = tgtOff(fx, t); x = E.x + fx.ux * g.al + fx.nx * g.pp; y = E.y + fx.uy * g.al + fx.ny * g.pp; a = aE + g.rot; op = 1 - seg(t, TI + 700, TI + 900); }
    else if (fx.out === 'tie') { const sp = fx.d / fx.F, dx2 = Math.cos(ta) + fx.nx * .55, dy2 = Math.sin(ta) + fx.ny * .55, n = Math.hypot(dx2, dy2); x = E.x + dx2 / n * sp * tau; y = E.y + dy2 / n * sp * tau; a = Math.atan2(dy2, dx2) * 180 / Math.PI; op = 1 - seg(tau, 60, 260); }
    else {
      const k = o.shield ? 1 : .7, vx = (-fx.ux * .45 + fx.nx * .75 * k) * R * .009, vy = (-fx.uy * .45 + fx.ny * .75 * k) * R * .009, g = R * .00005;
      x = E.x + vx * tau; y = E.y + vy * tau + .5 * g * tau * tau; a = aE - s * 1.2 * tau; op = 1 - seg(tau, 220, 520);
    }
  }
  set(fx.g.proj, {transform:`translate(${x.toFixed(2)} ${y.toFixed(2)}) rotate(${a.toFixed(2)}) scale(${kb.toFixed(4)})`, opacity:op.toFixed(3)});
}

function boltAt(fx, t){
  const {R, TF, TI} = fx;
  const al = t < TF ? -.08 * R * eOut(seg(t, 0, 500)) : t < TF + 70 ? lerp(-.08 * R, -.24 * R, eOut(seg(t, TF, TF + 70))) : lerp(-.24 * R, 0, eIO(seg(t, TF + 70, TF + 420)));
  const trem = RM || t >= TF ? 0 : seg(t, 250, TF);
  const pp = R * .06 * trem * Math.sin(t * .55), rot = 3 * trem * Math.sin(t * .43);
  place(fx, fx.A.el, al, pp, rot);
  const glow = t < TF ? eOut(seg(t, 0, 650)) : 1 - seg(t, TF, TF + 320);
  fx.A.el.style.filter = glow > .01 ? `drop-shadow(0 0 ${(R * .5 * glow).toFixed(1)}px rgba(90,170,255,${(.95 * glow).toFixed(2)})) brightness(${(1 + .2 * glow).toFixed(3)})` : '';
  const ax = fx.A.x + fx.ux * al + fx.nx * pp, ay = fx.A.y + fx.uy * al + fx.ny * pp;
  const rr0 = .42 * R * eBack(seg(t, 40, 600)) * (1 + .07 * Math.sin(t * .035));
  const pos = tt => { const v = seg(tt, TF, TI), w = Math.pow(v, 1.15), wob = R * .14 * Math.sin(v * Math.PI * 2) * (1 - v); return {x:lerp(fx.S.x, fx.E.x, w) + fx.nx * wob, y:lerp(fx.S.y, fx.E.y, w) + fx.ny * wob}; };
  let p, r = rr0, op = 1;
  if (t < TF) p = {x:ax + fx.ux * R * 1.3, y:ay + fx.uy * R * 1.3};
  else if (t < TI) { p = pos(t); r = .42 * R * (1 + .15 * seg(t, TF, TI)); }
  else { p = fx.E; op = 0; }
  set(fx.g.proj, {opacity:op});
  set(fx.g.og, {cx:p.x.toFixed(2), cy:p.y.toFixed(2), r:Math.max(0, r * 2.5).toFixed(2)});
  set(fx.g.oc, {cx:p.x.toFixed(2), cy:p.y.toFixed(2), r:Math.max(0, r).toFixed(2), 'stroke-width':(R * .06).toFixed(2)});
  set(fx.g.oh, {cx:(p.x - r * .3).toFixed(2), cy:(p.y - r * .32).toFixed(2), r:Math.max(0, r * .26).toFixed(2)});
  /* comet tail while it flies */
  fx.g.tr.forEach((c, i) => {
    const tt = t - (i + 1) * 15;
    if (t < TI + 60 && tt > TF && tt < TI) { const q = pos(tt), f = 1 - (i + 1) / 10; set(c, {cx:q.x.toFixed(2), cy:q.y.toFixed(2), r:(.42 * R * f * .85).toFixed(2), opacity:(.55 * f * (1 - seg(t, TI, TI + 60))).toFixed(3)}); }
    else set(c, {opacity:0});
  });
  /* motes swirling into the orb while it charges */
  fx.g.pt.forEach((c, i) => {
    if (t < TF - 30) {
      const f = ((t / 650) + i / 6) % 1, ang = (i * 60 + t * .28) * Math.PI / 180, rad = R * (1.9 - 1.75 * f), cx = ax + fx.ux * R * 1.3, cy = ay + fx.uy * R * 1.3;
      set(c, {cx:(cx + Math.cos(ang) * rad).toFixed(2), cy:(cy + Math.sin(ang) * rad).toFixed(2), r:(R * .12).toFixed(2), opacity:(Math.sin(f * Math.PI) * Math.min(1, t / 200)).toFixed(3)});
    } else set(c, {opacity:0});
  });
  /* the zap */
  if (t >= TI && t < TI + 230) {
    const b = Math.floor((t - TI) / 45), rg = rnd(fx.rot0 * 1e6 + b * 977), P = fx.P, lw = Math.max(1.4, R * .085);
    fx.g.lg.forEach((pl, i) => {
      const a0 = (i * 72 + rg() * 30) * Math.PI / 180, L = fx.Rd * (1 + rg() * .5);
      let pts = `${P.x.toFixed(1)},${P.y.toFixed(1)}`;
      for (let j = 1; j <= 4; j++) { const dd = L * j / 4, off = (rg() - .5) * L * .32; pts += ` ${(P.x + Math.cos(a0) * dd - Math.sin(a0) * off).toFixed(1)},${(P.y + Math.sin(a0) * dd + Math.cos(a0) * off).toFixed(1)}`; }
      set(pl, {points:pts, 'stroke-width':(lw * 2.6).toFixed(2), 'stroke-opacity':.6}); set(fx.g.lc[i], {points:pts, 'stroke-width':lw.toFixed(2)});
    });
    set(fx.g.lt, {opacity:(1 - seg(t, TI + 150, TI + 230)).toFixed(3)});
  } else set(fx.g.lt, {opacity:0});
}

/* what every weapon shares when it lands: burst, sparks, shield, shake, flash, the words */
function impactAt(fx, t){
  const {o, TI, Rd, R} = fx, P = fx.P;
  /* shield */
  if (o.shield) {
    const g = tgtOff(fx, t), pop = t < TI - 150 ? 0 : eBack(seg(t, TI - 150, TI - 30)), jolt = t >= TI ? Math.sin(seg(t, TI, TI + 160) * Math.PI) * .18 * Rd : 0;
    const sx = fx.D.x - fx.ux * (Rd * 1.0 - jolt) + fx.ux * g.al + fx.nx * g.pp, sy = fx.D.y - fx.uy * (Rd * 1.0 - jolt) + fx.uy * g.al + fx.ny * g.pp, ks = 1.5 * Rd / 68 * pop;
    set(fx.g.sh, {transform:`translate(${sx.toFixed(2)} ${sy.toFixed(2)}) rotate(${(-fx.s * 8 + g.rot).toFixed(2)}) scale(${ks.toFixed(4)})`, opacity:(t < TI - 150 ? 0 : 1 - seg(t, TI + 480, TI + 680)).toFixed(3)});
    set(fx.g.ward, {opacity:t >= TI ? (1 - seg(t, TI, TI + 420)).toFixed(3) : 0});
  }
  /* burst, ring and sparks */
  if (t >= TI && t < TI + 360) {
    const u = seg(t, TI, TI + 170), f = 1 - seg(t, TI + 140, TI + 340), ro = Rd * (.35 + (o.cam ? 1.25 : 1) * eOut(u));
    set(fx.g.b1, {d:star(P.x, P.y, ro, ro * .48, 8, fx.rot0), opacity:f.toFixed(3)});
    set(fx.g.b2, {d:star(P.x, P.y, ro * .58, ro * .28, 8, fx.rot0 + .2), opacity:f.toFixed(3)});
    const ur = seg(t, TI, TI + 360);
    set(fx.g.ring, {cx:P.x.toFixed(1), cy:P.y.toFixed(1), r:(Rd * (.3 + 1.4 * eOut(ur))).toFixed(2), 'stroke-width':(Math.max(.5, R * .16 * (1 - ur))).toFixed(2), opacity:(1 - ur).toFixed(3)});
    const us = seg(t, TI, TI + 340);
    fx.g.sp.forEach((ln, i) => {
      const a = fx.sparkA[i] * Math.PI / 180, v = fx.sparkV[i], r0 = Rd * (.25 + 1.7 * v * eOut(us)), r1 = r0 + Rd * .5 * (1 - us);
      set(ln, {x1:(P.x + Math.cos(a) * r0).toFixed(1), y1:(P.y + Math.sin(a) * r0).toFixed(1), x2:(P.x + Math.cos(a) * r1).toFixed(1), y2:(P.y + Math.sin(a) * r1).toFixed(1), 'stroke-width':(Math.max(1, R * .11) * (1 - us * .6)).toFixed(2), opacity:(1 - us).toFixed(3)});
    });
  } else { set(fx.g.b1, {opacity:0}); set(fx.g.b2, {opacity:0}); set(fx.g.ring, {opacity:0}); fx.g.sp.forEach(ln => set(ln, {opacity:0})); }
  /* the target reels; a hit flashes it and lights the stress box it checked; taken out tips it over */
  const g = tgtOff(fx, t), el = fx.D.el;
  let rot = g.rot, down = 0;
  if (o.out && t >= TI + 520) { const u = seg(t, TI + 520, TI + 820); rot += fx.s * 88 * eBack(u); down = .25 * Rd * eOut(u); if (u >= 1 && !el.classList.contains('out')) { el.classList.add('out'); fx.addedOut = true; } }
  place(fx, el, g.al, g.pp, rot, down);
  const fl = t >= TI && t < TI + 320 ? 1 - seg(t, TI, TI + 320) : 0;
  el.style.filter = fl > 0 ? `brightness(${(1 + (o.hit ? .9 : .5) * fl).toFixed(3)}) drop-shadow(0 0 ${(Rd * .55 * fl).toFixed(1)}px ${o.glow})` : '';
  if (o.hit && t >= TI + 120 && !fx.filled.length) {
    /* the box the hit really checked; taken out lights every box that was left */
    const boxes = [...el.querySelectorAll('.st i')];
    (o.out ? boxes.filter(b => !b.classList.contains('on')) : fx.box != null && boxes[fx.box] ? [boxes[fx.box]] : [])
      .forEach(b => { fx.filled.push({b, was:b.classList.contains('on')}); b.classList.add('on', 'fxn'); });
    if (!fx.filled.length) fx.filled.push(null);
  }
  /* words */
  const u = (t - TI - 30) / 1900, tx = fx.tx;
  if (u < 0 || u > 1) tx.style.opacity = 0;
  else {
    const sc = u < .07 ? lerp(.2, 1.28, eOut(u / .07)) : u < .14 ? lerp(1.28, 1, eOut((u - .07) / .07)) : 1;
    const wig = o.cam && !RM ? Math.sin(u * 46) * 5 * (1 - seg(u, 0, .22)) : 0;
    const y = fx.txY - R * .9 * eOut(u);
    tx.style.opacity = (1 - seg(u, .78, 1)).toFixed(3);
    tx.style.transform = `translate(${fx.txX.toFixed(1)}px,${y.toFixed(1)}px) translate(-50%,-100%) rotate(${(-3 * fx.s + wig).toFixed(2)}deg) scale(${sc.toFixed(3)})`;
  }
  /* sparkles around the words for the "with style" results */
  if (o.twinkle) {
    const spots = [[-.58, -.62], [.6, -.82], [-.44, -1.12], [.46, -.05]];
    fx.g.tw.forEach((p, i) => {
      const lu = u - .05 - i * .06;
      if (u < 0 || lu < 0 || lu > .55) { set(p, {opacity:0}); return; }
      const k = Math.sin(seg(lu, 0, .55) * Math.PI), y = fx.txY - R * .9 * eOut(u);
      set(p, {transform:`translate(${(fx.txX + spots[i][0] * fx.tw).toFixed(1)} ${(y + spots[i][1] * fx.th).toFixed(1)}) rotate(${(lu * 160).toFixed(1)}) scale(${(k * Rd * .028).toFixed(3)})`, opacity:k.toFixed(3)});
    });
  }
}

function camAt(fx, t){
  let z = 0;
  if (fx.Z > 1) z = eIO(seg(t, 0, 320)) * (1 - eIO(seg(t, fx.total - 450, fx.total)));
  const Z = 1 + (fx.Z - 1) * z, p = fx.pan;
  /* following: halfway between where the attacker, arrow or bolt is and a smooth glide, so it keeps up without jerking */
  const u = p ? (p.ease(seg(t, p.a, p.b)) + eIO(seg(t, p.c, p.d))) / 2 : 1;
  let X = lerp(fx.cA.TX, fx.cD.TX, u) * z, Y = lerp(fx.cA.TY, fx.cD.TY, u) * z;
  if (fx.o.cam && !RM && Z > 1.01 && t >= fx.TI && t < fx.TI + 280) {
    const u = seg(t, fx.TI, fx.TI + 280);
    X = clamp(X + Math.sin(t * .21) * fx.R * .14 * Z * (1 - u), fx.W - Z * fx.W, 0);
    Y = clamp(Y + Math.cos(t * .17) * fx.R * .12 * Z * (1 - u), fx.H - Z * fx.H, 0);
  }
  const tf = Z > 1.0005 ? `translate(${X.toFixed(2)}px,${Y.toFixed(2)}px) scale(${Z.toFixed(4)})` : '';
  fx.cam.style.transform = tf;
  if (fx.bg) fx.bg.style.transform = tf;
}

function draw(fx, t){
  camAt(fx, t);
  if (fx.wpn === 'sword') swordAt(fx, t); else if (fx.wpn === 'bow') bowAt(fx, t); else boltAt(fx, t);
  impactAt(fx, t);
}

/* ---------- when it plays ----------
   v._afx is this screen's newest attack result: id, seen (when it arrived here), a (res.anim), start, TI and total
   once it is drawn, done. v._afxRun is the effect on the board drawn right now. */
const WAIT_MS = 8000, OLD_MS = 60000;
/* notes a result that arrived since the last draw. The first look at a chat only remembers what is there, so opening
   the app or another chat's fight doesn't replay an old attack */
function track(v){
  const g = G(), ch = N.fightCh(), m = g.msgs.findLast(x => x.ch === ch && x.kind === 'sys' && x.res && x.res.k === 'clash'), id = m ? m.id : null;
  if (!v._afx || v._afx.ch !== ch) { v._afx = {ch, id, done:true}; return v._afx; }
  if (id !== v._afx.id) v._afx = {ch, id, seen:Date.now(), a:m && m.res.anim && g.combat.state === 'live' && Date.now() - m.t < OLD_MS ? m.res.anim : null};
  return v._afx;
}
/* the dice of the defense roll tumble first (combat.js diceFx); the attack starts once they are gone */
const diceEnd = v => v._fx && v._fx.at ? v._fx.at + N.FX_MS : 0;
N.fxTrack = track;
/* how the board draws a fighter while an attack on them plays: as they were before the blow lands */
N.fxHold = (v, t) => {
  const s = v._afx, a = s && s.a;
  if (!a || s.done || a.def !== t.id) return null;
  const el = s.start ? Date.now() - s.start : -1;
  if (s.total && el >= s.total) return null;
  return {up:a.out === 'out', off:a.box != null && el < (s.TI != null ? s.TI + 120 : Infinity) ? a.box : null};
};
function stop(v){
  const r = v._afxRun; if (!r) return;
  cancelAnimationFrame(r.raf); clearTimeout(r.timer); v._afxRun = null;
  return r;
}
const typing = () => { const a = document.activeElement; return !!a && /^(INPUT|TEXTAREA|SELECT)$/.test(a.tagName) && !a.closest('.composer'); };
function finish(v){
  const r = stop(v), s = v._afx;
  if (r && r.fx && r.fx.board.isConnected) clear(r.fx, true);
  s.done = true;
  /* taken out: draw the board again so the target shows as the app always shows someone taken out */
  if (s.a && s.a.out === 'out' && !typing()) N.render(v);
}
function go(v){
  const s = v._afx, board = v.root.querySelector('[data-board]');
  if (!board || s.done) return;
  RM = RMQ.matches;
  const fx = build(board, s);
  if (!fx) { s.done = true; return; }
  s.TI = fx.TI; s.total = fx.total;
  const run = v._afxRun = {fx, raf:0, timer:0};
  const tick = () => {
    if (v._afxRun !== run) return;
    if (!board.isConnected) { stop(v); return; }
    const t = Date.now() - s.start;
    if (t >= fx.total) { finish(v); return; }
    draw(fx, Math.max(0, t));
    run.raf = requestAnimationFrame(tick);
  };
  tick();
}
/* after every draw of the screen: the old board is gone, so put the effect on the new one at the time it has reached */
function attach(v){
  stop(v);
  const s = track(v);
  if (!s.a || s.done) return;
  const now = Date.now(), board = v.root.querySelector('[data-board]');
  if (!s.start) {
    if (now - s.seen > WAIT_MS) { s.done = true; return; }
    if (!board) return;
    s.start = Math.max(now, diceEnd(v));
  } else if (now - s.start < 400 && diceEnd(v) > s.start) s.start = diceEnd(v);
  if (!board) return;
  const t = now - s.start;
  if (s.total && t >= s.total) { s.done = true; return; }
  if (t < 0) { v._afxRun = {timer:setTimeout(() => { v._afxRun = null; go(v); }, -t)}; return; }
  go(v);
}
const prev = N.onRender;
N.onRender = v => { if (prev) prev(v); attach(v); };
/* a new screen size moves the tokens: measure again and carry on */
let rz;
addEventListener('resize', () => { clearTimeout(rz); rz = setTimeout(() => (N.views || []).forEach(v => { const r = v._afxRun; if (r && r.fx) { stop(v); clear(r.fx, false); go(v); } }), 120); });
})();
