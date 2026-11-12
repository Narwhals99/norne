/* Norne weapons for the toy figures (Jack, 2026-11-11): every kind of weapon in the GM's item catalog has its own
   model and its own way of being used, so fighters no longer all swing the same plain sword or draw the same bow.
   Built from shapes in code in the figures' style (toon colours, ink outlines), no outside art.
   What a fighter holds is small JSON {w:'<shape>', m:'<metal>', wd:'<wood>', o:{a second one for the off hand}}; js/combat.js works it out from the
   fighter's gear when the attack is rolled (N.tokWeapon) and sends it with the attack, so every device shows the same.
   makeArmory(THREE, H) gets figkit's drawing helpers in H and gives back
     hold(rig, look)  the figure takes this weapon in hand (built the first time), or its plain one with no look
     pose(rig, kind, ms, t)  acts out the attack: kind 'sword' is a close attack, 'bow' one from a distance.
   Every close attack lands 720 ms in and every shot or throw is loosed at 1050 ms, the same beats as the plain sword
   and bow, so the fight board's effects (js/fx.js) still land on time. A weapon with several moves picks one from
   rig.var (the fight board sets it from the attack, so every device shows the same move), else they take turns. */
export function makeArmory(THREE, H){
const {inked, toon, at, rot} = H;
const PI = Math.PI;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v)), lerp = (a, b, u) => a + (b - a) * u, seg = (t, a, b) => clamp((t - a) / (b - a), 0, 1);
const eOut = u => 1 - Math.pow(1 - u, 3), eIO = u => u < .5 ? 4 * u * u * u : 1 - Math.pow(-2 * u + 2, 3) / 2, eIn = u => u * u * u;

/* ---------- what things are made of ---------- */
/* metal: [main, trim on the hilt or bands] */
const METALS = {
  iron:[0x8e939c, 0x5c4a3a], steel:[0xd3dbe6, 0xf0b93f], silver:[0xf4f7fb, 0x9fb7d6], dwarven:[0x9db6d3, 0xe0a63a], obsidian:[0x2f2838, 0x8a5fd0],
  meteorite:[0x55607a, 0xb9c6e6], dragontooth:[0xefe5c8, 0xa8322a], unicorn:[0xfbeff6, 0xe9c9f0], manticore:[0xc8742a, 0x3a2018], brass:[0xd9a441, 0x8a5a1e], stone:[0x9c978c, 0x6b665e]};
const WOODS = {oak:0x9a6a3a, willow:0xb99b5f, whitewood:0xe4d8ba, redwood:0x8f4330, ironwood:0x54453c, kapok:0xc4a77c, bamboo:0xcbb95f, pine:0xcf9f5c, palm:0xab8350};
const WOOD = 0x7b4723, WRAP = 0x4a3020, CORD = 0xf6eedb, LEATHER = 0x8a5a34;

/* ---------- small parts ---------- */
const box = (w, h, d, m, y = 0, t = .5) => at(inked(new THREE.BoxGeometry(w, h, d), m, t), 0, y, 0);
const cyl = (r1, r2, h, m, y = 0, n = 8, t = .5) => at(inked(new THREE.CylinderGeometry(r1, r2, h, n), m, t), 0, y, 0);
const ball = (r, m, y = 0, t = .5) => at(inked(new THREE.SphereGeometry(r, 10, 8), m, t), 0, y, 0);
/* a flat blade point: a four-sided cone squashed thin */
const point = (r, h, m, y, thin = .5) => { const c = inked(new THREE.ConeGeometry(r, h, 4), m, .5); c.position.y = y; c.rotation.y = PI / 4; c.scale.z = thin; return c; };
/* a flat piece cut from an outline (x is across, y is along the weapon), thick d, facing forward (the way a chop travels) */
function plate(pts, d, m, t = .5, broad){
  const s = new THREE.Shape(); pts.forEach(([x, y, c], i) => { if (!i) s.moveTo(x, y); else if (c) s.quadraticCurveTo(c[0], c[1], x, y); else s.lineTo(x, y); }); s.closePath();
  const g = new THREE.ExtrudeGeometry(s, {depth:d, bevelEnabled:false, curveSegments:6}); g.translate(0, 0, -d / 2);
  return rot(inked(g, m, t), 0, broad ? 0 : -PI / 2, 0);
}
/* the grip and what closes it: a wrapped handle from y0 to y1 with a round pommel */
function grip(g, P, y0, y1, pommel = 2){
  g.add(cyl(1.3, 1.3, y1 - y0, P.wrap, (y0 + y1) / 2));
  if (pommel) g.add(ball(pommel, P.trim, y0 - pommel * .6));
}
function blade(g, P, len, w, y0, tip = 5){
  const h = w / 2;
  g.add(at(plate([[-h, 0], [h, 0], [h * .86, len], [0, len + tip], [-h * .86, len]], 1.2, P.metal, .5, true), 0, y0, 0));
  /* the ridge down the middle */
  g.add(box(w * .22, len * .86, 1.7, P.metal, y0 + len * .46, .2));
}
function swordOf(P, len, w, guard, gripLen, tip){
  const g = new THREE.Group();
  grip(g, P, -gripLen + 3, 3, w > 4 ? 2.4 : 2);
  g.add(box(guard, 2, 2.6, P.trim, 3.6));
  blade(g, P, len, w, 4.4, tip);
  return g;
}
const AXE = k => [[0, -3 * k], [4 * k, -4 * k], [9 * k, -8 * k], [10.5 * k, 0, [12.5 * k, -4 * k]], [9 * k, 8 * k, [12.5 * k, 4 * k]], [4 * k, 4 * k], [0, 3 * k]];
function axeOf(P, haft, y0, k, both){
  const g = new THREE.Group();
  g.add(cyl(1.25, 1.4, haft, P.wood, y0 + haft / 2));
  g.add(cyl(1.5, 1.5, 5, P.wrap, y0 + 3.5));
  const hy = y0 + haft - 5 * k;
  g.add(at(plate(AXE(k), 1.3, P.metal), 0, hy, 1));
  if (both) g.add(at(rot(plate(AXE(k), 1.3, P.metal), 0, PI / 2, 0), 0, hy, -1));
  else g.add(at(box(2.6, 4.4 * k, 2.2, P.metal, 0), 0, hy, -1.6));
  g.add(cyl(1.75, 1.75, 5 * k, P.trim, hy, 8, .4));
  if (both) g.add(point(1.6, 5, P.metal, y0 + haft + 2.2, 1));
  return g;
}
function poleOf(P, len, y0, r = 1.15){
  const g = new THREE.Group();
  g.add(cyl(r, r, len, P.wood, y0 + len / 2));
  return g;
}

/* ---------- the weapons ---------- */
/* cat: melee (a close attack), shot (a bow or the like, loosed), thrown. moves: how it is used, in turn.
   hand: which hand holds it (R unless said), two: the other hand helps. n: what the maker calls it. */
const W = {
  sword:      {n:'Sword', cat:'melee', moves:['chop', 'cut', 'poke'], make:P => swordOf(P, 26, 3, 11, 7, 5)},
  shortsword: {n:'Shortsword', cat:'melee', moves:['chop', 'cut', 'poke'], make:P => swordOf(P, 19, 3.4, 9, 6.5, 4.5)},
  dagger:     {n:'Dagger', cat:'melee', moves:['poke', 'cut', 'poke'], make:P => swordOf(P, 9.5, 2.8, 6.5, 5.5, 4)},
  hatchet:    {n:'Hatchet', cat:'melee', moves:['chop', 'cut'], make:P => axeOf(P, 17, -4, .72)},
  battleaxe:  {n:'Battleaxe', cat:'melee', moves:['chop', 'cut', 'bash'], make:P => axeOf(P, 27, -5, 1)},
  club:       {n:'Club', cat:'melee', moves:['bash', 'cut'], make:P => { const g = new THREE.Group();
    g.add(cyl(3.5, 1.5, 22, P.wood, 9, 9)); g.add(ball(3.5, P.wood, 20)); g.add(cyl(1.6, 1.6, 5, P.wrap, -1));
    /* the studs or teeth it is spiked or lined with */
    for (let i = 0; i < 8; i++) { const a = i * PI / 2 + (i > 3 ? PI / 4 : 0), y = i > 3 ? 19 : 14.5, r = i > 3 ? 3.5 : 3;
      const sp = inked(new THREE.ConeGeometry(1.1, 3.2, 4), P.metal, .4); sp.rotation.order = 'YXZ'; sp.rotation.set(PI / 2, a, 0); sp.position.set(Math.sin(a) * r, y, Math.cos(a) * r); g.add(sp); }
    return g; }},
  mace:       {n:'Mace', cat:'melee', moves:['bash', 'cut'], make:P => { const g = new THREE.Group();
    g.add(cyl(1.2, 1.3, 20, P.wood, 6)); g.add(cyl(1.5, 1.5, 5, P.wrap, -1.5)); g.add(ball(1.9, P.trim, -4.6)); g.add(cyl(1.8, 1.8, 1.6, P.trim, 14.5, 8, .4));
    g.add(at(inked(new THREE.IcosahedronGeometry(4.3, 0), P.metal, .5), 0, 19.5, 0));
    for (let i = 0; i < 6; i++) { const a = i * PI / 3, f = inked(new THREE.ConeGeometry(1.4, 3.6, 4), P.metal, .4); f.rotation.order = 'YXZ'; f.rotation.set(PI / 2, a, 0); f.position.set(Math.sin(a) * 4.6, 19.5, Math.cos(a) * 4.6); g.add(f); }
    g.add(point(1.3, 3.4, P.metal, 25, 1));
    return g; }},
  spear:      {n:'Spear', cat:'melee', two:1, moves:['thrust', 'thrust', 'sweep'], make:P => { const g = poleOf(P, 52, -20);
    g.add(cyl(1.5, 1.5, 3, P.trim, 31, 8, .4)); g.add(point(3.8, 12, P.metal, 38.5, .45)); g.add(cyl(1.4, 1.4, 6, P.wrap, 0)); return g; }},
  staff:      {n:'Fighting staff', cat:'melee', two:1, wood:1, moves:['sweep', 'thrust', 'slam'], make:P => { const g = poleOf(P, 58, -29, 1.35);
    [-27, 27].forEach(y => g.add(cyl(1.7, 1.7, 3.4, P.wrap, y, 8, .4))); [-7, 7].forEach(y => g.add(cyl(1.6, 1.6, 2.2, P.wrap, y, 8, .4))); return g; }},
  greatsword: {n:'Greatsword', cat:'melee', two:1, moves:['slam', 'sweep'], make:P => swordOf(P, 40, 4.8, 15, 13, 7)},
  waraxe:     {n:'Waraxe', cat:'melee', two:1, moves:['slam', 'sweep'], make:P => axeOf(P, 44, -12, 1.25, true)},
  warhammer:  {n:'Warhammer', cat:'melee', two:1, moves:['slam', 'sweep'], make:P => { const g = new THREE.Group();
    g.add(cyl(1.3, 1.5, 42, P.wood, 9)); g.add(cyl(1.7, 1.7, 7, P.wrap, -7)); g.add(ball(2.1, P.trim, -13));
    g.add(rot(box(8.5, 8.5, 15, P.metal, 0), 0, 0, 0).translateY(31));
    [-5.5, 5.5].forEach(z => g.add(at(box(9.6, 9.6, 2, P.trim, 0, .4), 0, 31, z)));
    return g; }},
  glaive:     {n:'Glaive', cat:'melee', two:1, moves:['sweep', 'thrust', 'slam'], make:P => { const g = poleOf(P, 48, -22);
    g.add(cyl(1.6, 1.6, 4, P.trim, 27, 8, .4)); g.add(cyl(1.4, 1.4, 6, P.wrap, 0));
    g.add(at(plate([[-1.6, 0], [1.8, 0], [4.6, 7, [3.2, 2]], [3.2, 16, [5.6, 12]], [-1.2, 21, [1.6, 20]], [-1.6, 10, [-2.4, 15]]], 1.1, P.metal), 0, 28, 0));
    return g; }},
  knuckles:   {n:'Knuckles', cat:'melee', both:1, moves:['jabs', 'hook'], make:(P, look) => { const g = new THREE.Group();
    /* worn over the fist: a bar across the knuckles with studs, or a leather band with spikes */
    g.add(at(box(7, 2.4, 4.4, look.sp ? P.wrap : P.metal, 0, .4), 0, -2.3, 0));
    for (let i = 0; i < 4; i++) { const x = -2.7 + i * 1.8;
      if (look.sp) { const sp = inked(new THREE.ConeGeometry(1, 3.2, 4), P.metal, .35); sp.position.set(x, -4.8, 0); sp.rotation.x = PI; g.add(sp); }
      else g.add(at(ball(1.1, P.metal, 0, .35), x, -3.7, 0)); }
    return g; }},
  /* from a distance */
  shortbow:   {n:'Shortbow', cat:'shot', hand:'L', wood:1, moves:['bow'], make:P => bowOf(P, 13)},
  longbow:    {n:'Longbow', cat:'shot', hand:'L', wood:1, moves:['bow'], make:P => bowOf(P, 19.5)},
  crossbow:   {n:'Crossbow', cat:'shot', two:1, proj:'quarrel', moves:['xbow'], make:P => { const g = new THREE.Group();
    g.add(box(3, 24, 3.4, P.wood, 6)); g.add(at(box(2.4, 6, 3, P.wood, 0), 0, -6, -2.2)); g.add(box(3.6, 2, 4, P.trim, 17, .4));
    const arc = inked(new THREE.TorusGeometry(15, 1.15, 6, 16, PI * .62), P.metal, .5); arc.rotation.z = PI * .19; arc.position.set(0, 1.5, 1.2); g.add(arc);
    const str = new THREE.Mesh(new THREE.BoxGeometry(24.4, .6, .6), new THREE.MeshBasicMaterial({color:CORD})); str.position.set(0, 10.4, 1.2); g.add(str);
    const q = new THREE.Group(); q.add(cyl(.6, .6, 12, P.wood, 13, 6, .35)); q.add(point(1.5, 3.4, P.metal, 20.6, 1)); q.position.z = 2.3; g.add(q); g.userData.q = q; g.userData.str = str;
    return g; }},
  sling:      {n:'Sling', cat:'shot', proj:'stone', moves:['sling'], make:P => { const g = new THREE.Group();
    const cord = new THREE.MeshBasicMaterial({color:CORD});
    [-.9, .9].forEach(x => { const c = new THREE.Mesh(new THREE.BoxGeometry(.55, 15, .55), cord); c.position.set(x, 7.5, 0); c.rotation.z = -x * .05; g.add(c); });
    const p = inked(new THREE.SphereGeometry(2.6, 10, 8), P.leather, .45); p.scale.set(1, .7, .8); p.position.y = 15.4; g.add(p);
    const st = ball(1.7, P.stone, 16.2, .35); g.add(st); g.userData.q = st;
    return g; }},
  tknife:     {n:'Throwing knives', cat:'thrown', proj:'knife', moves:['throw'], make:P => { const g = new THREE.Group();
    g.add(cyl(.95, .95, 5, P.wrap, -1)); g.add(ball(1.2, P.metal, -4, .4)); blade(g, P, 6, 2.4, 1.6, 3.6); return g; }},
  tstar:      {n:'Throwing stars', cat:'thrown', proj:'star', moves:['flick'], make:P => { const g = new THREE.Group(), pts = [];
    for (let i = 0; i < 8; i++) { const a = i * PI / 4, r = i % 2 ? 1.9 : 5.2; pts.push([Math.sin(a) * r, Math.cos(a) * r]); }
    g.add(at(rot(plate(pts, .9, P.metal, .4), 0, PI / 2, 0), 0, 3.6, 0)); return g; }},
  taxe:       {n:'Throwing axes', cat:'thrown', proj:'axe', moves:['throw'], make:P => axeOf(P, 14, -3.5, .62)},
  javelin:    {n:'Javelins', cat:'thrown', proj:'javelin', moves:['hurl'], make:P => { const g = poleOf(P, 40, -18, .85);
    g.add(point(2.2, 8, P.metal, 26, .5)); g.add(cyl(1.15, 1.15, 5, P.wrap, 0, 8, .4)); return g; }}
};
/* a bow, held by the middle of the stave: it stands upright with the string towards the archer */
function bowOf(P, r){
  const g = new THREE.Group(), b = new THREE.Group();
  const arc = inked(new THREE.TorusGeometry(r, r > 16 ? 1.2 : 1.35, 6, 20, PI), P.wood, .6); arc.rotation.z = -PI / 2; b.add(arc);
  b.add(at(cyl(1.7, 1.7, r * .34, P.wrap, 0, 8, .4), r, 0, 0));
  [-1, 1].forEach(s => b.add(at(ball(1.25, P.trim, 0, .4), 0, s * r, 0)));
  /* the string, in two halves that meet where the arrow is nocked */
  const cord = new THREE.MeshBasicMaterial({color:CORD}), half = s => { const m = new THREE.Mesh(new THREE.BoxGeometry(.6, 1, .6), cord); m.geometry.translate(0, .5, 0); m.position.set(0, s * r, 0); b.add(m); return m; };
  const st = [half(-1), half(1)];
  g.userData.draw = k => { const d = k * (r > 16 ? 7 : 5.5), len = Math.hypot(r, d), a = Math.atan2(d, r); st[0].scale.y = st[1].scale.y = len; st[0].rotation.z = a; st[1].rotation.z = PI - a; };
  g.userData.draw(0);
  b.position.x = -r; g.add(b); g.rotation.y = -PI / 2; return g;
}
const LIST = Object.keys(W);
const okLook = o => !!(o && W[o.w]);

/* the paints of one weapon */
function paints(look){
  const def = W[look.w], mt = METALS[look.m] || (look.w === 'knuckles' ? METALS.brass : METALS.steel), wd = WOODS[look.wd];
  const metal = toon(mt[0]), trim = toon(mt[1]);
  return {metal, trim, wood:toon(wd || (def.wood && !look.wd ? 0x9a6a3a : WOOD)), wrap:toon(WRAP), leather:toon(LEATHER), stone:toon((METALS[look.m] || METALS.stone)[0])};
}
const keyOf = look => look.w + '|' + (look.m || '') + '|' + (look.wd || '') + (look.sp ? '|s' : '');
/* can this one go in the off hand, to fight with two weapons? a one-handed close weapon */
const offOk = o => okLook(o) && W[o.w].cat === 'melee' && !W[o.w].two && !W[o.w].both;

/* the figure takes a weapon in hand. Each is built once per figure, and kept hidden until an attack shows it.
   look.o is a second weapon for the off hand (two daggers, a sword and a hatchet): then it fights with both. */
function hold(rig, look){
  if (rig.beast || !rig.w) return;
  if (!okLook(look)) { rig.held = null; return; }
  const off = offOk(look) && offOk(look.o) ? look.o : null, key = keyOf(look), lkey = off ? 'L|' + keyOf(off) : key + '|L';
  if (rig.held && rig.held.key === key && rig.held.lkey === (off || W[look.w].both ? lkey : '')) return;
  const def = W[look.w];
  const mk = (d, lk) => { const m = new THREE.Group(); m.add(d.make(paints(lk), lk)); m.rotation.x = d.both ? 0 : PI / 2; m.visible = false; return m; };
  if (!rig.w[key]) { const m = mk(def, look); (def.hand === 'L' ? rig.armL : rig.armR).hand.add(m); rig.w[key] = m; }
  if ((off || def.both) && !rig.w[lkey]) { const l = off ? mk(W[off.w], off) : mk(def, look); rig.armL.hand.add(l); rig.w[lkey] = l; }
  rig.held = {key, lkey:off || def.both ? lkey : '', w:look.w, def, two:!!off, m:rig.w[key], l:off || def.both ? rig.w[lkey] : null};
}

/* ---------- the moves ---------- */
/* keeps the weapon pointing the same way (eps above level, forward) however the arm that holds it swings */
let LEAN = null;
const level = (w, arm, eps) => { w.rotation.x = PI / 2 - eps - arm.sh.rotation.x - LEAN.torso.rotation.x - LEAN.body.rotation.x; };
const MOVES = {
  /* overhead cut, the plain sword's swing */
  chop(c){ const {ms, armL, armR, torso, w} = c, wind = seg(ms, 150, 650), strike = seg(ms, 650, 800), back = 1 - eIO(seg(ms, 1050, 1500));
    armR.sh.rotation.x = lerp(lerp(0, -2.6, eIO(wind)), -.15, eOut(strike)) * back;
    armR.sh.rotation.z = .2 + .85 * eOut(Math.min(1, wind * 1.6)) * (1 - eOut(strike)) * back;
    torso.rotation.y = lerp(.35 * eOut(wind), -.4, eOut(strike)) * back; torso.rotation.x = .18 * eOut(strike) * back;
    c.step(eOut(strike) * back); armL.sh.rotation.x = -.5 * eOut(wind) * back;
    w.rotation.x = PI / 2 - .25; },
  /* a flat cut across the body, from the shoulder */
  cut(c){ const {ms, armL, armR, torso, body, w} = c, wind = seg(ms, 120, 600), strike = seg(ms, 610, 800), back = 1 - eIO(seg(ms, 1050, 1500)), s = eOut(strike);
    torso.rotation.y = lerp(1.05 * eIO(wind), -.95, s) * back;
    armR.sh.rotation.x = -1.35 * eOut(Math.min(1, wind * 1.5)) * back;
    armR.sh.rotation.z = .2 + lerp(.75 * eOut(wind), -.25, s) * back;
    armL.sh.rotation.x = -.7 * eOut(wind) * back; armL.sh.rotation.z = -.2 - .5 * eOut(wind) * (1 - s) * back;
    body.position.z = 4 * s * back; c.step(s * back);
    level(w, armR, .1 + .25 * (1 - back)); w.rotation.z = lerp(-.5 * eOut(wind), .35, s) * back; },
  /* a straight thrust from the hip */
  poke(c){ const {ms, armL, armR, torso, body, w} = c, wind = seg(ms, 150, 580), strike = seg(ms, 620, 760), back = 1 - eIO(seg(ms, 1000, 1450)), s = eOut(strike);
    armR.sh.rotation.x = lerp(.75 * eIO(wind), -1.6, s) * back; armR.sh.rotation.z = .2 - .1 * s * back;
    torso.rotation.y = lerp(.6 * eOut(wind), -.5, s) * back; torso.rotation.x = .22 * s * back;
    body.position.z = lerp(-2 * eOut(wind), 8, s) * back; c.step(s * back * 1.2);
    armL.sh.rotation.x = lerp(-.9 * eOut(wind), .4, s) * back;
    level(w, armR, .04 + .3 * (1 - eOut(Math.min(1, wind * 2))) + .3 * (1 - back)); },
  /* a heavy overhead blow with a hop into it */
  bash(c){ const {ms, armL, armR, torso, body, w} = c, wind = seg(ms, 100, 610), strike = seg(ms, 630, 790), back = 1 - eIO(seg(ms, 1080, 1520)), s = eOut(strike);
    armR.sh.rotation.x = lerp(lerp(0, -2.95, eIO(wind)), .05, s) * back;
    armR.sh.rotation.z = .2 + .6 * eOut(Math.min(1, wind * 1.6)) * (1 - s) * back;
    torso.rotation.y = lerp(.45 * eOut(wind), -.45, s) * back; torso.rotation.x = lerp(-.14 * eOut(wind), .34, s) * back;
    body.position.y = 6 + 4.5 * Math.sin(seg(ms, 380, 700) * PI) - 2.4 * s * back; body.position.z = 5 * s * back;
    c.step(s * back * 1.1); armL.sh.rotation.x = -.8 * eOut(wind) * back; armL.sh.rotation.z = -.2 - .4 * eOut(wind) * back;
    w.rotation.x = PI / 2 - .2 + .45 * s * back; },
  /* both hands, up over the head and down hard */
  slam(c){ const {ms, armL, armR, torso, body, w} = c, wind = seg(ms, 90, 600), strike = seg(ms, 620, 790), back = 1 - eIO(seg(ms, 1100, 1560)), s = eOut(strike), k = eOut(Math.min(1, wind * 2.2)) * back;
    const th = lerp(lerp(0, -2.85, eIO(wind)), -.5, s) * back;
    armR.sh.rotation.x = th; armL.sh.rotation.x = th + .16 * k;
    armR.sh.rotation.z = .2 - .62 * k; armL.sh.rotation.z = -.2 + .62 * k;
    torso.rotation.x = lerp(-.2 * eOut(wind), .42, s) * back; body.rotation.x = lerp(-.08 * eOut(wind), .1, s) * back;
    body.position.y = 6 + 3.2 * Math.sin(seg(ms, 300, 660) * PI) - 3.2 * s * back; body.position.z = 4 * s * back;
    c.step(s * back * .9, true);
    w.rotation.x = PI / 2 - .12 + .38 * s * back; w.rotation.z = .5 * k; },
  /* both hands, a wide flat swing from the hip */
  sweep(c){ const {ms, armL, armR, torso, body, w} = c, wind = seg(ms, 90, 590), strike = seg(ms, 600, 800), back = 1 - eIO(seg(ms, 1080, 1540)), s = eOut(strike), k = eOut(Math.min(1, wind * 2.2)) * back;
    torso.rotation.y = lerp(1.25 * eIO(wind), -1.1, s) * back; torso.rotation.x = .1 * k;
    armR.sh.rotation.x = -1.2 * k; armL.sh.rotation.x = -1.02 * k;
    armR.sh.rotation.z = .2 - .55 * k; armL.sh.rotation.z = -.2 + .6 * k;
    body.position.z = 3 * s * back; body.position.y = 6 - 1.6 * k; c.step(s * back * .8, true);
    level(w, armR, .06); w.rotation.z = .5 * k + lerp(-.35 * eOut(wind), .3, s) * back; },
  /* both hands on the shaft, a long thrust with a step */
  thrust(c){ const {ms, armL, armR, torso, body, w} = c, wind = seg(ms, 120, 590), strike = seg(ms, 620, 770), back = 1 - eIO(seg(ms, 1050, 1500)), s = eOut(strike), k = eOut(Math.min(1, wind * 2)) * back;
    torso.rotation.y = lerp(.75 * eOut(wind), .25, s) * back; torso.rotation.x = .2 * s * back;
    armR.sh.rotation.x = lerp(.55 * eIO(wind), -1.15, s) * back; armR.sh.rotation.z = .2 - .2 * k;
    armL.sh.rotation.x = lerp(-1.0 * eOut(wind), -1.45, s) * back; armL.sh.rotation.z = -.2 + .5 * k;
    body.position.z = lerp(-3 * eOut(wind), 10, s) * back; body.position.y = 6 - 2 * s * back; c.step(s * back * 1.4);
    level(w, armR, .05 + .5 * (1 - k)); w.rotation.z = .2 * k; },
  /* fists: a quick left, then the right hand through the target */
  jabs(c){ const {ms, armL, armR, torso, body, w, l} = c, up = eOut(seg(ms, 0, 180)), back = 1 - eIO(seg(ms, 1050, 1480)), g = up * back;
    const j = eOut(seg(ms, 250, 360)) * (1 - eIO(seg(ms, 380, 540))), wind = seg(ms, 430, 610), s = eOut(seg(ms, 620, 745));
    armL.sh.rotation.x = (-.95 - .65 * j) * g; armL.sh.rotation.z = -.2 + .3 * g;
    armR.sh.rotation.x = lerp(-.95 + 1.25 * eIO(wind), -1.6, s) * g; armR.sh.rotation.z = .2 - .32 * g;
    torso.rotation.y = (-.3 * j + lerp(.62 * eOut(wind), -.7, s)) * back; torso.rotation.x = .16 * s * back;
    body.position.z = (2.5 * j + 7.5 * s) * back; body.position.y = 6 - 1.5 * g; c.step(s * back * 1.1);
    w.rotation.x = 0; if (l) l.rotation.x = 0; },
  /* fists: a wide swinging right, then an uppercut from the left */
  hook(c){ const {ms, armL, armR, torso, body, w, l} = c, up = eOut(seg(ms, 0, 180)), back = 1 - eIO(seg(ms, 1100, 1500)), g = up * back;
    const wind = seg(ms, 180, 470), s1 = eOut(seg(ms, 470, 590)), w2 = seg(ms, 520, 660), s = eOut(seg(ms, 650, 760));
    torso.rotation.y = (lerp(.85 * eOut(wind), -.75, s1) * (1 - s) + .35 * s) * back;
    armR.sh.rotation.x = -1.3 * g; armR.sh.rotation.z = .2 + lerp(.95 * eOut(wind), -.55, s1) * back;
    armL.sh.rotation.x = lerp(-.95 + 1.2 * eIO(w2), -2.25, s) * g; armL.sh.rotation.z = -.2 + .34 * g;
    body.position.y = 6 + lerp(-3.2 * eOut(w2), 3.4, s) * back * (1 - seg(ms, 760, 1000)); body.position.z = (3 * s1 + 4 * s) * back;
    c.step(s * back * .7);
    w.rotation.x = 0; if (l) l.rotation.x = 0; },
  /* a bow: raised, drawn, loosed at 1050 */
  bow(c){ const {ms, armL, armR, torso, w, rig} = c, raise = seg(ms, 100, 450), draw = seg(ms, 450, 1050), rel = seg(ms, 1050, 1150), low = 1 - eIO(seg(ms, 1500, 1850));
    armL.sh.rotation.x = -1.57 * eOut(raise) * low; armL.sh.rotation.z = -.2 + .2 * eOut(raise) * low;
    armR.sh.rotation.x = lerp(-1.5 * eOut(raise), -.9, eOut(draw) * (1 - eOut(rel))) * low;
    armR.sh.rotation.z = .2 - .36 * eOut(draw) * (1 - eOut(rel)) * low;
    w.children[0].userData.draw(eOut(draw) * (1 - eOut(rel)));
    torso.rotation.y = -.25 * eOut(raise) * low;
    w.rotation.x = PI / 2;
    c.arrow(1050, 1700, .62); },
  /* a crossbow: brought up in both hands, aimed, the trigger pulled at 1050 */
  xbow(c){ const {ms, armL, armR, torso, body, head, w} = c, raise = eOut(seg(ms, 100, 520)), low = 1 - eIO(seg(ms, 1450, 1850)), k = raise * low;
    const kick = ms > 1050 ? Math.exp(-(ms - 1050) / 110) : 0, aim = seg(ms, 520, 1050);
    armR.sh.rotation.x = (-1.32 + .16 * kick) * k; armR.sh.rotation.z = .2 - .5 * k;
    armL.sh.rotation.x = (-1.52 + .12 * kick) * k; armL.sh.rotation.z = -.2 + .46 * k;
    torso.rotation.y = .3 * k; head.rotation.z = -.14 * k * aim; head.rotation.y = -.2 * k;
    body.rotation.x = -.1 * kick * k; body.position.z = -2.5 * kick;
    level(w, armR, .02 + .12 * kick + .5 * (1 - k)); w.rotation.z = .35 * k; w.position.set(-1.5 * k, 0, 2.5 * k);
    const m = w.children[0]; m.userData.q.visible = ms < 1050; m.userData.str.position.y = ms < 1050 ? 10.4 - 5 * raise : 10.4;
    c.arrow(1050, 1600, .56); },
  /* a sling: whirled overhead, let go at 1050 */
  sling(c){ const {ms, armL, armR, torso, body, w} = c, up = eOut(seg(ms, 80, 400)), rel = eOut(seg(ms, 1030, 1150)), low = 1 - eIO(seg(ms, 1450, 1850));
    armR.sh.rotation.x = lerp(-2.75 * up, -1.15, rel) * low; armR.sh.rotation.z = .2 + .25 * up * (1 - rel) * low;
    armL.sh.rotation.x = -.6 * up * low; armL.sh.rotation.z = -.2 - .45 * up * low;
    torso.rotation.y = lerp(.3 * up, -.4, rel) * low; body.position.z = 3 * rel * low;
    /* the cord flies out level and goes round faster and faster; let go, it hangs from the hand again */
    const turns = Math.pow(seg(ms, 200, 1050), 1.7) * 3.5 * PI * 2, out = up * (1 - rel);
    w.rotation.order = 'YXZ'; w.rotation.set(lerp(PI, PI / 2 - .12, out) + armR.sh.rotation.x * (1 - out), turns * (ms < 1050 ? 1 : 0), 0);
    w.children[0].userData.q.visible = ms < 1050; },
  /* a throw from over the shoulder (knives, axes), gone from the hand at 1050 */
  throw(c){ const {ms, armL, armR, torso, body, w} = c, wind = seg(ms, 150, 820), strike = seg(ms, 930, 1080), low = 1 - eIO(seg(ms, 1400, 1850)), s = eOut(strike);
    armR.sh.rotation.x = lerp(-2.95 * eIO(wind), -.75, s) * low; armR.sh.rotation.z = .2 + .5 * eOut(wind) * (1 - s) * low;
    armL.sh.rotation.x = lerp(-1.25 * eOut(wind), .3, s) * low;
    torso.rotation.y = lerp(.6 * eOut(wind), -.55, s) * low; torso.rotation.x = lerp(-.12 * eOut(wind), .26, s) * low;
    body.position.z = lerp(-2 * eOut(wind), 5, s) * low; c.step(s * low);
    w.rotation.x = PI / 2 - .3; w.visible = ms < 1050; },
  /* a flick from across the body (throwing stars) */
  flick(c){ const {ms, armL, armR, torso, body, w} = c, wind = seg(ms, 150, 820), strike = seg(ms, 940, 1070), low = 1 - eIO(seg(ms, 1400, 1850)), s = eOut(strike);
    torso.rotation.y = lerp(-.75 * eOut(wind), .7, s) * low;
    armR.sh.rotation.x = -1.25 * eOut(Math.min(1, wind * 1.6)) * low; armR.sh.rotation.z = .2 + lerp(-.85 * eOut(wind), .7, s) * low;
    armL.sh.rotation.x = -.5 * eOut(wind) * low; body.position.z = 3 * s * low; c.step(s * low * .7);
    level(w, armR, 0); w.rotation.z = PI / 2; w.visible = ms < 1050; },
  /* a javelin: carried level over the shoulder, a step and a long throw */
  hurl(c){ const {ms, armL, armR, torso, body, w} = c, wind = seg(ms, 120, 820), strike = seg(ms, 920, 1070), low = 1 - eIO(seg(ms, 1400, 1850)), s = eOut(strike);
    armR.sh.rotation.x = lerp(-2.45 * eIO(wind), -1.2, s) * low; armR.sh.rotation.z = .2 + .35 * eOut(wind) * (1 - s) * low;
    armL.sh.rotation.x = lerp(-1.45 * eOut(wind), .35, s) * low;
    torso.rotation.y = lerp(.8 * eOut(wind), -.5, s) * low; torso.rotation.x = lerp(-.2 * eOut(wind), .25, s) * low;
    body.position.z = lerp(-4 * eOut(wind), 7, s) * low; c.step(s * low * 1.3);
    level(w, armR, .22 * (1 - s) + 1.2 * (1 - eOut(Math.min(1, wind * 2.4)))); w.visible = ms < 1050; }
};
/* a weapon in each hand */
Object.assign(MOVES, {
  /* the off hand cuts first, the main hand follows through the target */
  twin(c){ const {ms, armL, armR, torso, body, w, l} = c, wl = seg(ms, 120, 400), sl = eOut(seg(ms, 400, 520)), wind = seg(ms, 360, 640), s = eOut(seg(ms, 640, 790)), back = 1 - eIO(seg(ms, 1050, 1500));
    armL.sh.rotation.x = lerp(lerp(0, -2.5, eIO(wl)), -.35, sl) * back; armL.sh.rotation.z = -.2 - .7 * eOut(Math.min(1, wl * 1.6)) * (1 - sl) * back;
    armR.sh.rotation.x = lerp(lerp(0, -2.6, eIO(wind)), -.15, s) * back; armR.sh.rotation.z = .2 + .85 * eOut(Math.min(1, wind * 1.6)) * (1 - s) * back;
    torso.rotation.y = lerp(lerp(-.5 * eOut(wl), .5, sl), -.55, s) * back; torso.rotation.x = (.1 * sl + .14 * s) * back;
    body.position.z = (2 * sl + 3.5 * s) * back; c.step(s * back);
    w.rotation.x = l.rotation.x = PI / 2 - .25; },
  /* quick stabs, left, right, left, and the right again to finish */
  flurry(c){ const {ms, armL, armR, torso, body, w, l} = c, g = eOut(seg(ms, 0, 180)) * (1 - eIO(seg(ms, 1050, 1480))), back = 1 - eIO(seg(ms, 1050, 1480));
    const pk = (a, b) => eOut(seg(ms, a, a + 90)) * (1 - eIO(seg(ms, a + 110, b))), L = pk(280, 470) + pk(520, 690), R = pk(400, 580), s = eOut(seg(ms, 640, 745));
    armL.sh.rotation.x = (-.85 - .75 * L) * g; armL.sh.rotation.z = -.2 + .28 * g;
    armR.sh.rotation.x = (-.85 - .75 * Math.max(R, s)) * g; armR.sh.rotation.z = .2 - .28 * g;
    torso.rotation.y = (-.4 * L + .4 * R - .55 * s) * back + .15 * g; torso.rotation.x = .14 * g;
    body.position.z = (2.5 * (L + R) + 7 * s) * back; body.position.y = 6 - 1.6 * g; c.step(s * back * 1.1);
    level(w, armR, .05 + .9 * (1 - g)); level(l, armL, .05 + .9 * (1 - g)); },
  /* both arms flung wide, then both blades cut inwards together */
  scissor(c){ const {ms, armL, armR, torso, body, w, l} = c, wind = seg(ms, 120, 600), s = eOut(seg(ms, 620, 780)), back = 1 - eIO(seg(ms, 1050, 1500)), k = eOut(Math.min(1, wind * 1.8)) * back;
    const sp = lerp(1.0 * eOut(wind), -.5, s) * back;
    armR.sh.rotation.x = armL.sh.rotation.x = -1.35 * k; armR.sh.rotation.z = .2 + sp; armL.sh.rotation.z = -.2 - sp;
    torso.rotation.x = lerp(-.16 * eOut(wind), .24, s) * back; body.position.y = 6 + 3 * Math.sin(seg(ms, 380, 700) * PI) - 2 * s * back; body.position.z = 5 * s * back; c.step(s * back * .9, true);
    level(w, armR, .1 + .8 * (1 - k)); level(l, armL, .1 + .8 * (1 - k)); w.rotation.z = -sp * .6; l.rotation.z = sp * .6; }
});
const DUAL = ['twin', 'flurry', 'scissor'];
const DUR = {melee:1700, shot:1900, thrown:1900};

/* acts out the attack with the weapon in hand; false when this figure has none for that kind of attack */
function pose(rig, kind, ms, t){
  const h = rig.held; if (!h) return false;
  const cat = h.def.cat; if ((kind === 'sword') !== (cat === 'melee')) return false;
  const mv = h.two ? DUAL : h.def.moves, i = rig.var != null ? rig.var : Math.floor(t / DUR[cat]);
  const w = h.m, l = h.l, legs = rig.legs, legK = rig.robe ? .45 : 1;
  [w, l].forEach(o => { if (!o) return; o.visible = true; o.rotation.order = 'XYZ'; o.rotation.set(PI / 2, 0, 0); o.position.set(0, 0, 0); });
  LEAN = rig;
  MOVES[mv[i % mv.length]]({rig, ms, w, l, body:rig.body, torso:rig.torso, head:rig.head, armL:rig.armL, armR:rig.armR,
    /* the front foot steps into the blow (two-legged figures) */
    step:(k, wide) => { if (legs.length !== 2) return; legs[0].rotation.x = -.38 * k * legK; legs[1].rotation.x = .32 * k * legK; if (wide) { legs[0].rotation.z = -.12 * k; legs[1].rotation.z = .12 * k; } },
    /* the maker shows the arrow or quarrel flying off; on the fight board js/fx.js draws what flies */
    arrow:(a, b, hgt) => { const f = rig.fx && rig.fx.arrow; if (f && ms > a && ms < b) { const k = seg(ms, a, b); f.visible = true; f.position.set(0, rig.h * hgt, 18 + k * 160); f.rotation.set(0, 0, 0); } }});
  return true;
}
return {W, LIST, METALS, WOODS, DUAL, okLook, offOk, hold, pose};
}
