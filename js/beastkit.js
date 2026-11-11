/* Norne animal and monster figures (Jake's list, 2026-11-09): toy figures of beasts for the fight board, built from
   parts in code in the same style as the people (js/figkit.js: toon colours, ink outlines, a round base).
   A beast's look is small JSON {race:'Beast', beast:'<id>', skin:<coat number>}. makeBeasts(THREE, H) gets figkit's
   drawing helpers in H and gives back build(spec, opt) -> rig and pose(rig, move, ms). The moves are the people's
   (idle, walk, sword, bow, magic, hit, block, dodge, down), acted out the beast's way: "sword" is its close attack (a bite,
   a pounce, a rear and stomp, a claw pinch), "bow" and "magic" a roar or a breath of fire from a distance, on the same
   beats as the people's moves so the fight board's effects (js/fx.js) still land on time.
   The Giant is a person figure, only bigger, so it is built by figkit's buildFigure. */
export function makeBeasts(THREE, H){
const {inked, toon, tube, at, rot, SHADOW, GLOW, mix, shade, canvas, ctex, metalCap} = H;
const V3 = THREE.Vector3, PI = Math.PI, TAU = PI * 2;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v)), lerp = (a, b, u) => a + (b - a) * u;
const v = (x, y, z) => new V3(x, y, z);
const UPY = (p, t, o) => o.set(0, 1, 0), UPZ = (p, t, o) => o.set(0, 0, 1), UPX = (p, t, o) => o.set(1, 0, 0), UPB = (p, t, o) => o.set(0, 0, -1);

/* ---------- the list: what each beast is, its coats, how big its base is ---------- */
const C = (n, c, o = {}) => Object.assign({n, c}, o);
const BEASTS = {
  horse:    {k:1.12, n:'Horse', plan:'quad', base:25, coats:[C('Bay', '#8a5530', {mane:'#241a16', belly:'#9a6640', sock:'#2a201a'}), C('Chestnut', '#a8562c', {mane:'#7a3a1c'}), C('Grey', '#b9b5ae', {mane:'#6e6a66', belly:'#d6d2ca'}), C('Black', '#2f2a28', {mane:'#171312'}), C('White', '#ebe5d8', {mane:'#d9d0bd'})]},
  gorilla:  {k:1.12, n:'Gorilla', plan:'ape', base:23, coats:[C('Black', '#3c3a42', {skin:'#5a4c48'}), C('Silverback', '#3c3a42', {back:'#a3a3a8', skin:'#5a4c48'}), C('Brown', '#5a4636', {skin:'#4a3a32'})]},
  cat:      {k:0.85, n:'Cat', plan:'quad', base:18, coats:[C('Ginger', '#d58a3f', {belly:'#f0d2a8', pat:'tabby', dark:'#a8602a'}), C('Grey tabby', '#8d8a86', {belly:'#d8d4cc', pat:'tabby', dark:'#4f4c4a'}), C('Black', '#2a2729', {belly:'#3a3638'}), C('White', '#efeae2', {belly:'#ffffff'})], eye:'#9bd04a'},
  dog:      {n:'Dog', plan:'quad', base:20, coats:[C('Brown', '#8a5a34', {belly:'#c89a6a'}), C('Golden', '#d9a75c', {belly:'#efd2a0'}), C('Black and tan', '#2c2624', {belly:'#a8683a', sock:'#a8683a'}), C('Grey', '#8f8f94', {belly:'#d0d0d4'})]},
  wolf:     {n:'Wolf', plan:'quad', base:22, coats:[C('Grey', '#85868c', {belly:'#d6d4cf', back:'#55565c'}), C('Black', '#2b2a2e', {belly:'#4a484c'}), C('White', '#e9e6df', {belly:'#ffffff', back:'#cfcac0'}), C('Brown', '#7a5c44', {belly:'#c8ab8a', back:'#4f3a2c'})], eye:'#e8b12a'},
  werewolf: {n:'Werewolf', plan:'ape', base:24, coats:[C('Brown fur', '#5e4838', {belly:'#8f7660'}), C('Grey fur', '#7c7c82', {belly:'#b8b6b2'}), C('Black fur', '#2a2729', {belly:'#45403f'})], eye:'#ffb020'},
  fox:      {k:0.92, n:'Fox', plan:'quad', base:19, coats:[C('Red', '#d2662b', {belly:'#f6efe4', sock:'#2a2220', tip:'#f6efe4'}), C('Arctic', '#eeebe4', {belly:'#ffffff', tip:'#ffffff'}), C('Silver', '#57565c', {belly:'#d6d4d0', sock:'#222024', tip:'#f0f0f0'})], eye:'#e8a020'},
  elephant: {k:1.3, n:'Elephant', plan:'quad', base:27, coats:[C('Grey', '#8c8b93'), C('Dusty', '#a39887'), C('War paint', '#8c8b93', {paint:'#a8322a'})]},
  trex:     {k:1.32, n:'Tyrannosaurus', plan:'rex', base:27, coats:[C('Green', '#5f7f3e', {belly:'#c9c08a', back:'#3f5a2a'}), C('Brown', '#8a6a42', {belly:'#d6bf94', back:'#5a4228'}), C('Slate', '#5a6878', {belly:'#c7c7bd', back:'#3a4450'})], eye:'#f0c020'},
  dragon:   {k:1.38, n:'Dragon', plan:'quad', base:29, coats:[C('Red', '#a8342b', {belly:'#e6b45a', wing:'#c9583e'}), C('Green', '#3f7a3e', {belly:'#c9c47a', wing:'#5f9a52'}), C('Black', '#2c2a34', {belly:'#6a5a7a', wing:'#4a4258'}), C('Gold', '#c8962e', {belly:'#f0dca0', wing:'#e0b450'})], eye:'#ffcc33'},
  wyvern:   {k:1.22, n:'Wyvern', plan:'rex', base:26, coats:[C('Green', '#4f6e3a', {belly:'#b8b07a', wing:'#6f8a4f'}), C('Brown', '#7a5636', {belly:'#c8a878', wing:'#9a7450'}), C('Purple', '#5a3f74', {belly:'#b49acb', wing:'#7a5a96'})], eye:'#ff7a2a'},
  spider:   {k:1.1, n:'Large spider', plan:'spider', base:23, coats:[C('Black', '#2a2628', {mark:'#c42a2a'}), C('Brown', '#5e4630', {mark:'#c8a46a'}), C('Grey', '#77726c', {mark:'#2a2628'})], eye:'#e02a2a'},
  serpent:  {k:1.15, n:'Large serpent', plan:'snake', base:24, coats:[C('Green', '#4a7a3a', {belly:'#d6cf8a', band:'#2f5226'}), C('Black', '#2a2a2e', {belly:'#6a6a70', band:'#141416'}), C('Gold', '#c89a3a', {belly:'#f0e0b0', band:'#7a5a1e'}), C('Red bands', '#2a2426', {belly:'#e8dcc8', band:'#c43a2a'})], eye:'#f0d020'},
  crab:     {k:1.1, n:'Large crab', plan:'crab', base:24, coats:[C('Red', '#c3452c', {belly:'#efc9a0'}), C('Blue', '#3a5d8f', {belly:'#d6dce6'}), C('Sand', '#c7a46a', {belly:'#efe2c4'})]},
  tiger:    {k:1.08, n:'Tiger', plan:'quad', base:24, coats:[C('Orange', '#de8a2e', {belly:'#f6efe2', pat:'stripes', dark:'#1f1714'}), C('White', '#efe9e0', {belly:'#ffffff', pat:'stripes', dark:'#3a3436'})], eye:'#e8c02a'},
  beetle:   {n:'Large beetle', plan:'beetle', base:22, coats:[C('Green shell', '#2f7a52'), C('Black shell', '#2c2a32'), C('Bronze shell', '#a8682a'), C('Blue shell', '#2f4f9a')]},
  phoenix:  {n:'Phoenix', plan:'bird', base:22, coats:[C('Flame', '#e0492a', {belly:'#f8b03a', tip:'#ffe27a', fire:0xff7a2a}), C('Blue flame', '#2f6fd0', {belly:'#6ad0ff', tip:'#dff6ff', fire:0x4fb8ff}), C('Gold', '#e09a2a', {belly:'#ffd86a', tip:'#fff3c0', fire:0xffc040})], eye:'#ffffff'},
  troll:    {k:1.12, n:'Troll', plan:'ape', base:24, coats:[C('Moss', '#6f8a52', {cloth:'#5a4430', hair:'#3a3a2a'}), C('Stone', '#8a8a80', {cloth:'#4a3a30', hair:'#3a3330'}), C('Bog', '#5e6a4a', {cloth:'#3a3a26', hair:'#2a2a1e'})], eye:'#f0c840'},
  giant:    {n:'Giant', plan:'person', base:28, coats:[C('Hill', '#c99a70', {style:'h14', hair:'brown', cloth:'rust', outfit:'barbarian', beard:'long'}), C('Frost', '#bcd2e4', {style:'h3', hair:'white', cloth:'navy', outfit:'leather', beard:'long'}), C('Fire', '#8a4a32', {style:'h15', hair:'red', cloth:'charcoal', outfit:'plate', beard:'short'}), C('Stone', '#9a958c', {hair:'grey', cloth:'moss', outfit:'barbarian', beard:'none'})]},
  swamp:    {n:'Swamp thing', plan:'ape', base:24, coats:[C('Bog green', '#4f6a36', {moss:'#7a9a3e'}), C('Peat', '#5a4632', {moss:'#6f7a3a'}), C('Algae', '#3f6f5a', {moss:'#7aa86a'})], eye:'#e8f05a'},
  croc:     {k:1.1, n:'Crocodile', plan:'quad', base:26, coats:[C('Olive', '#5a6a3a', {belly:'#c8c08a', back:'#3f4a2a'}), C('Brown', '#6a5a3e', {belly:'#d0bf94', back:'#4a3e2a'}), C('Pale', '#8a947a', {belly:'#e0dcc0', back:'#6a725c'})], eye:'#d8c020'},
  lizard:   {n:'Large lizard', plan:'quad', base:23, coats:[C('Dusk', '#6e6a58', {belly:'#b8b08a', pat:'spots', dark:'#4a4636'}), C('Green', '#5f8f3f', {belly:'#c8d48a', pat:'spots', dark:'#3f6a2a'}), C('Red', '#9a4f3a', {belly:'#d8b08a', pat:'spots', dark:'#6a3426'})], eye:'#e0a020'},
  snowcat:  {n:'Snow cat', plan:'quad', base:22, coats:[C('Snow', '#e4e0d8', {belly:'#ffffff', pat:'rosettes', dark:'#55545a'}), C('Smoke', '#b6b2ac', {belly:'#e8e6e0', pat:'rosettes', dark:'#3f3e44'}), C('Frost blue', '#d8e2ea', {belly:'#ffffff', pat:'rosettes', dark:'#4a5a6e'})], eye:'#a8d8e0'},
};
const LIST = ['horse', 'dog', 'cat', 'wolf', 'fox', 'tiger', 'snowcat', 'elephant', 'gorilla', 'werewolf', 'troll', 'giant', 'swamp', 'trex', 'dragon', 'wyvern', 'phoenix', 'spider', 'serpent', 'crab', 'beetle', 'croc', 'lizard'];
const ANIMS = {idle:2400, walk:900, sword:1700, bow:1900, magic:1900, hit:1300, block:1300, dodge:1300, down:2600};

/* a name ("wolf", "Large spider", "T-rex") to a beast, so an NPC whose race is an animal stands as that animal */
const ALIAS = {'t-rex':'trex', 'trex':'trex', 'tyrannosaurus rex':'trex', 'dinosaur':'trex', 'snake':'serpent', 'giant snake':'serpent', 'serpent':'serpent', 'spider':'spider', 'giant spider':'spider',
  'crab':'crab', 'giant crab':'crab', 'beetle':'beetle', 'giant beetle':'beetle', 'crocodile':'croc', 'alligator':'croc', 'croc':'croc', 'lizard':'lizard', 'giant lizard':'lizard', 'snow leopard':'snowcat', 'snowcat':'snowcat', 'snow cat':'snowcat',
  'hound':'dog', 'puppy':'dog', 'kitten':'cat', 'ape':'gorilla', 'pony':'horse', 'stallion':'horse', 'mare':'horse', 'drake':'dragon', 'swamp monster':'swamp', 'swamp thing':'swamp', 'bog monster':'swamp'};
function beastOf(name){
  const s = String(name || '').trim().toLowerCase(); if (!s) return null;
  if (BEASTS[s]) return s;
  if (ALIAS[s]) return ALIAS[s];
  for (const id of LIST) if (BEASTS[id].n.toLowerCase() === s) return id;
  return null;
}
const isBeast = spec => !!(spec && spec.beast && BEASTS[spec.beast]);
/* the giant wears a person's hairstyle model, so its look names it (the fight board loads it before building) */
const defaultSpec = (id, skin = 0) => { const b = BEASTS[id] ? id : 'wolf', c = BEASTS[b].coats[skin] || BEASTS[b].coats[0]; return {race:'Beast', beast:b, skin, hair:c.style || 'bald'}; };
const randomSpec = (id, rnd = Math.random) => { const b = BEASTS[id] || BEASTS.wolf; return defaultSpec(BEASTS[id] ? id : 'wolf', Math.floor(rnd() * b.coats.length)); };

/* ---------- coats painted on bodies: round the body is across, along the body is down the picture ---------- */
const texCache = new Map();
function coatTex(cl, pat){
  const key = JSON.stringify([cl, pat]); if (texCache.has(key)) return texCache.get(key);
  const W = 256, Hh = 256, cv = canvas(W, Hh), x = cv.getContext('2d');
  x.fillStyle = cl.c; x.fillRect(0, 0, W, Hh);
  /* tube texture: across 0..1 goes round from the side (0), over the top (.25), the other side (.5), under the belly (.75) */
  if (cl.back) { const g = x.createLinearGradient(0, 0, W, 0); [[0, 'rgba(0,0,0,0)'], [.12, 'rgba(0,0,0,0)'], [.25, cl.back], [.38, 'rgba(0,0,0,0)'], [1, 'rgba(0,0,0,0)']].forEach(([o, c]) => g.addColorStop(o, c)); x.fillStyle = g; x.fillRect(0, 0, W, Hh); }
  if (cl.belly) { const g = x.createLinearGradient(0, 0, W, 0); const b = cl.belly, t = 'rgba(0,0,0,0)'; [[0, t], [.56, t], [.68, b], [.82, b], [.94, t], [1, t]].forEach(([o, c]) => g.addColorStop(o, c)); x.fillStyle = g; x.fillRect(0, 0, W, Hh); }
  const d = cl.dark || shade(cl.c, .45);
  let seed = 7; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  if (pat === 'stripes' || pat === 'tabby') {
    x.fillStyle = d; const n = pat === 'stripes' ? 14 : 10;
    for (let i = 0; i < n; i++) { const yy = (i + .5) / n * Hh, side = [.25, .25 - .5, .25 + .5]; /* stripes run from the spine down each side */
      [[.25, -1], [.25, 1]].forEach(([u0, dir]) => { x.beginPath(); const len = (pat === 'stripes' ? .3 : .2) * (.7 + rnd() * .5), w = (pat === 'stripes' ? 7 : 4) * (.7 + rnd() * .6);
        const pts = []; for (let k = 0; k <= 10; k++) { const u = u0 + dir * len * k / 10, wob = Math.sin(k * .9 + i) * 5; pts.push([u * W, yy + wob, w * (1 - k / 10 * .85)]); }
        x.moveTo(pts[0][0], pts[0][1] - pts[0][2]); pts.forEach(p => x.lineTo(p[0], p[1] - p[2])); for (let k = pts.length - 1; k >= 0; k--) x.lineTo(pts[k][0], pts[k][1] + pts[k][2]); x.closePath(); x.fill();
        x.save(); x.translate(dir > 0 ? 0 : W, 0); x.restore(); });
      void side; }
    /* the stripes that cross the edge of the picture wrap round */
    x.drawImage(cv, -W, 0); x.drawImage(cv, W, 0);
  }
  if (pat === 'rosettes' || pat === 'spots') {
    for (let i = 0; i < (pat === 'rosettes' ? 70 : 90); i++) { const u = rnd(), yy = rnd() * Hh; if (Math.abs(u - .75) < .12) continue; const r = (pat === 'rosettes' ? 6 : 3.5) * (.6 + rnd() * .7);
      x.strokeStyle = d; x.fillStyle = d; x.lineWidth = 2.6; x.beginPath(); x.ellipse(u * W, yy, r, r * .8, rnd() * PI, 0, TAU); pat === 'rosettes' ? x.stroke() : x.fill(); }
  }
  if (pat === 'bands') { x.fillStyle = cl.band; for (let i = 0; i < 12; i++) { const yy = (i + .5) / 12 * Hh; x.fillRect(0, yy - 6, W, 12); }
    if (cl.belly) { const g = x.createLinearGradient(0, 0, W, 0), t = 'rgba(0,0,0,0)'; [[0, t], [.6, t], [.7, cl.belly], [.8, cl.belly], [.9, t], [1, t]].forEach(([o, c]) => g.addColorStop(o, c)); x.fillStyle = g; x.fillRect(0, 0, W, Hh); } }
  if (pat === 'scales') { x.strokeStyle = 'rgba(0,0,0,.22)'; x.lineWidth = 1.6; for (let j = 0; j < 22; j++) for (let i = 0; i < 20; i++) { const cx = (i + (j % 2) * .5) / 20 * W, cy = j / 22 * Hh; x.beginPath(); x.arc(cx, cy, 6.5, .15 * PI, .85 * PI); x.stroke(); } }
  const t = ctex(cv, true); t.userData.keep = true; texCache.set(key, t); return t;
}

/* ---------- small parts ---------- */
/* a tube's last part rounded like a dome over f of its length, so its end never shows as an open ring */
const dome = (t, f) => t > 1 - f ? Math.sqrt(Math.max(0, 1 - Math.pow((t - 1 + f) / f, 2))) : 1;
const sph = (rx, ry, rz, seg = 20) => new THREE.SphereGeometry(1, seg, Math.round(seg * .7)).scale(rx, ry, rz);
const qFrom = d => new THREE.Quaternion().setFromUnitVectors(new V3(0, 1, 0), d.clone().normalize());
/* a cone from p along dir (horns, teeth, claws, spikes) */
function spike(r, len, mat, p, dir, t = .3, seg = 10){
  const g = inked(new THREE.ConeGeometry(r, len, seg).translate(0, len / 2, 0), mat, t);
  g.position.copy(p); g.quaternion.copy(qFrom(dir)); return g;
}
/* a horn that curves: a tube from p through bend points, thin at the tip */
function horn(pts, r, mat, t = .3){ return inked(tube(pts, u => [r * (1 - u * .92), r * (1 - u * .92)], UPX, {nS:12, nR:10}), mat, t); }
function limb(pts, r0, r1, mat, up = UPZ, t = .45, o = {}){
  return inked(tube(pts, u => { const r = lerp(r0, r1, u) * (o.bulge ? 1 + o.bulge * Math.sin(u * PI) : 1); return [r, r]; }, up, {nS:o.nS || 12, nR:o.nR || 12}), mat, t);
}
function eyeOn(par, p, r, col, mats, glow){
  const m = glow ? new THREE.MeshBasicMaterial({color:col}) : toon(col || '#141018'); if (!glow) mats.push(m);
  const e = inked(sph(r, r, r * .8, 14), m, .25); e.position.copy(p); par.add(e);
  const gl = new THREE.Mesh(sph(r * .32, r * .32, r * .2, 8), new THREE.MeshBasicMaterial({color:0xffffff})); gl.position.set(p.x - r * .25 * Math.sign(p.x || 1), p.y + r * .35, p.z + r * .7); par.add(gl);
  return e;
}
function baseOn(root, rig, r, opt){
  if (opt.base === false) return;
  const sh = new THREE.Mesh(new THREE.PlaneGeometry(r * 3.4, r * 3.4), new THREE.MeshBasicMaterial({map:SHADOW, transparent:true, depthWrite:false}));
  sh.rotation.x = -PI / 2; sh.position.y = .3; root.add(sh);
  root.add(at(inked(new THREE.CylinderGeometry(r, r + 1.5, 6, 44), toon(opt.baseColor || 0x2a2f55), .8), 0, 3, 0));
  root.add(at(rot(new THREE.Mesh(new THREE.TorusGeometry(r + .3, 1.2, 8, 52), toon(0xf4c46e)), PI / 2, 0, 0), 0, 6, 0));
  const ring = rot(new THREE.Mesh(new THREE.TorusGeometry(r + 7, 1.8, 6, 44), new THREE.MeshBasicMaterial({color:0xf4c46e})), PI / 2, 0, 0);
  ring.position.y = 1; ring.visible = false; root.add(ring); rig.ring = ring;
}
/* a wing: bones from the shoulder out to a wrist and three fingers, with skin stretched between them (built for the
   right side, +x; the left wing is the same group mirrored) */
function wing(span, mBone, mSkin, o = {}){
  const g = new THREE.Group(), E = v(span * .38, span * .2, -span * .05), W = v(span * .62, span * .34, -span * .12);
  const F = [v(span, span * .22, -span * .28), v(span * .9, -span * .02, -span * .48), v(span * .66, -span * .16, -span * .58)];
  const back = v(span * .1, -span * .02, -span * (o.back || .42));
  g.add(limb([v(0, 0, 0), E.clone().multiplyScalar(.5).add(v(0, span * .05, 0)), E], span * .045, span * .035, mBone, UPZ, .35, {nS:8, nR:8}));
  g.add(limb([E, W], span * .035, span * .03, mBone, UPZ, .35, {nS:6, nR:8}));
  F.forEach(f => g.add(limb([W, W.clone().lerp(f, .5).add(v(0, span * .04, 0)), f], span * .026, span * .008, mBone, UPZ, .3, {nS:8, nR:6})));
  g.add(spike(span * .03, span * .1, mBone, W, v(.2, 1, .3), .25, 8));
  /* the skin: a fan of triangles between the bones, scalloped between finger tips */
  const P = [v(0, 0, 0), E, W, ...F, back], tri = [], pos = [];
  const sc = (a, b) => { const m = a.clone().lerp(b, .5); m.lerp(W, .22); return m; };
  const S1 = sc(F[0], F[1]), S2 = sc(F[1], F[2]), S3 = sc(F[2], back);
  [[W, F[0], S1], [W, S1, F[1]], [W, F[1], S2], [W, S2, F[2]], [W, F[2], S3], [W, S3, back], [E, W, back], [P[0], E, back]].forEach(t => t.forEach(q => pos.push(q.x, q.y, q.z)));
  void tri;
  const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); geo.computeVertexNormals();
  const skin = new THREE.Mesh(geo, mSkin); g.add(skin);
  const edge = new THREE.LineSegments(new THREE.EdgesGeometry(geo, 30), new THREE.LineBasicMaterial({color:0x1d130b})); g.add(edge);
  return g;
}

/* ---------- body plans ---------- */
/* four legs: a body along the floor (+z is the front), legs, a neck and head, a tail. P holds the sizes. */
function quad(rig, P, cl, M, mats){
  const {body} = rig, L = P.L, R = P.R, wR = P.wR || .9, hR = P.hR || 1, sp = P.sprawl || 0;
  const yB = P.yB != null ? P.yB : P.leg + R * .55, zH = -L / 2 + R * .7, zF = L / 2 - R * .62;
  const mCoat = M(0xffffff, {map:coatTex(cl, P.pat || cl.pat)}), mPlain = M(cl.c), mBelly = M(cl.belly || cl.c), mDark = M(cl.sock || shade(cl.c, .55));
  const mHoof = M(P.hoof || '#2a221c'), mNose = M(P.noseC || '#1e1618');
  const torso = at(new THREE.Group(), 0, yB, zH); body.add(torso); rig.torso = torso;
  const T = (x, y, z) => v(x, y - yB, z - zH);
  /* the body */
  const spine = [T(0, yB + R * .06, -L / 2), T(0, yB, -L / 4), T(0, yB + R * (P.hump || .04), L / 6), T(0, yB + R * .16, L / 2)];
  torso.add(inked(tube(spine, t => { const k = Math.pow(Math.sin(PI * t), .5) * (1 + (P.chest || .08) * (t - .5)); return [R * k * wR, R * k * hR]; }, UPY, {nS:22, nR:18}), mCoat, .6));
  /* legs: front straight, back with a hock; reptiles' legs go out to the side first */
  rig.legs = [];
  [[-1, 1], [1, 1], [-1, -1], [1, -1]].forEach(([s, f]) => {
    const z = f > 0 ? zF : zH + (P.hindIn || 0), x = s * R * wR * (sp ? .85 : .52), top = yB - R * .15;
    const g = at(new THREE.Group(), x, top - yB, z - zH); torso.add(g);
    const h = top - (P.foot === 'hoof' ? 2.2 : 0), lr = P.legR * (f > 0 ? 1 : 1.08);
    let pts;
    if (sp) pts = [v(0, R * .25, 0), v(s * P.leg * .55, -h * .2, f * 1), v(s * P.leg * .7, -h * .7, f * 1.5), v(s * P.leg * .72, -h + lr * .3, f * 2.2)];
    else if (f > 0) pts = [v(0, R * .3, 0), v(0, -h * .45, lr * .2), v(0, -h * .85, -lr * .1), v(0, -h, lr * .25)];
    else pts = [v(0, R * .3, 0), v(0, -h * .32, -lr * .9), v(0, -h * .68, -lr * 1.6), v(0, -h, -lr * .9)];
    g.add(limb(pts, lr * (P.thigh || 1.55), lr * .8, P.socks && f < 0 ? mPlain : mPlain, UPZ, .5, {nS:12, nR:12}));
    const foot = pts[pts.length - 1];
    if (P.foot === 'hoof') g.add(at(inked(new THREE.CylinderGeometry(lr * .85, lr * 1.05, 2.4, 14), mHoof, .35), foot.x, foot.y - 1.2, foot.z));
    else if (P.foot === 'pad') g.add(at(inked(new THREE.CylinderGeometry(lr * 1.05, lr * 1.12, 2.2, 16), mPlain, .4), foot.x, foot.y - .8, foot.z));
    else { const pw = at(inked(sph(lr * 1.05, lr * .7, lr * 1.35, 14), cl.sock ? mDark : mPlain, .4), foot.x, foot.y - lr * .2, foot.z + lr * .45); g.add(pw);
      if (P.claws) [-1, 0, 1].forEach(k => g.add(spike(lr * .22, lr * .9, M('#e8e0cc'), v(foot.x + k * lr * .5, foot.y - lr * .35, foot.z + lr * 1.5), v(0, -.25, 1), .2, 6))); }
    rig.legs.push({g, s, f});
  });
  /* neck and head */
  const nk = at(new THREE.Group(), 0, R * .3 + (P.neckY || 0), L / 2 - R * .3 - zH); torso.add(nk); rig.neck = nk;
  const na = P.neckAng, nl = P.neck, nEnd = P.neckPts ? P.neckPts[P.neckPts.length - 1] : v(0, Math.sin(na) * nl, Math.cos(na) * nl);
  if (nl > 0) nk.add(inked(tube(P.neckPts || [v(0, -R * .2, -R * .2), v(0, Math.sin(na) * nl * .5, Math.cos(na) * nl * .5), nEnd], t => { const r = lerp(P.neckR, P.neckR * .78, t); return [r * wR, r]; }, UPB, {nS:12, nR:14}), mCoat, .55));
  const head = at(new THREE.Group(), nEnd.x, nEnd.y, nEnd.z); nk.add(head); rig.head = head;
  headOn(rig, head, P.head, cl, M, mats, {mPlain, mNose, mBelly, mDark});
  if (P.mane) nk.add(inked(tube([v(0, R * .5, -R * .4), v(0, Math.sin(na) * nl * .5 + P.neckR * .9, Math.cos(na) * nl * .5 - P.neckR * .3), nEnd.clone().add(v(0, P.head.r * .9, -P.head.r * .3))],
    t => [P.neckR * .28, P.neckR * (.55 + .2 * Math.sin(t * PI))], UPB, {nS:12, nR:10}), M(cl.mane || '#2a221c'), .4));
  if (P.ruff) nk.add(at(inked(sph(P.neckR * 1.25 * wR, P.neckR * 1.1, P.neckR * .9, 16), mCoat, .45), 0, P.neckR * .2, P.neckR * .2));
  /* tail */
  if (P.tail) {
    const tl = P.tail, tg = at(new THREE.Group(), 0, R * (tl.y || .35), -L / 2 + R * .2 - zH); torso.add(tg);
    const t2 = new THREE.Group(); tg.add(t2);
    const pts = tl.pts, mid = Math.floor(pts.length / 2);
    t2.add(inked(tube(pts, t => { const r = tl.prof ? tl.prof(t) : lerp(tl.r, tl.r * (tl.end != null ? tl.end : .2), t); return [r, r * (tl.flat || 1)]; }, UPY, {nS:18, nR:12}), tl.mat === 'mane' ? M(cl.mane || '#2a221c') : tl.plain ? mPlain : mCoat, .45));
    if (tl.tip) t2.add(at(inked(sph(tl.tip, tl.tip * 1.1, tl.tip * 1.4, 14), M(cl.tip || cl.c), .35), pts[pts.length - 1].x, pts[pts.length - 1].y, pts[pts.length - 1].z));
    rig.tail = [tg]; void mid;
  }
  rig.dims = {yB, R, L, wR, hR, zH};
  return {torso, T, mCoat, mPlain, mBelly, mDark, mNose, yB, zH, zF, R, L, wR};
}
/* a beast's head: skull, snout and lower jaw (which opens), nose, eyes, ears, extras */
function headOn(rig, head, P, cl, M, mats, m){
  const r = P.r, mH = P.mat || m.mPlain;
  head.add(inked(sph(r * (P.w || 1), r * (P.h || .92), r * (P.d || 1.05), 22), mH, .5));
  const sl = P.snout, sr = P.snoutR, sd = P.snoutDown || 0, sy = -r * (P.snoutY != null ? P.snoutY : .2);
  if (sl > 0) {
    head.add(inked(tube([v(0, sy, r * .2), v(0, sy - sd * .4, r * .45 + sl * .5), v(0, sy - sd, r * .5 + sl)], t => { const k = lerp(1, P.snoutEnd || .8, t) * dome(t, Math.min(.45, sr * .8 / (sl + r * .3))); return [sr * k * (P.snoutW || 1), sr * k * (P.snoutH || .85)]; }, UPY, {nS:10, nR:14}), P.snoutMat || mH, .45));
    if (P.nose !== false) head.add(at(inked(sph(sr * .5 * (P.snoutW || 1), sr * .36, sr * .32, 12), m.mNose, .3), 0, sy - sd + sr * .45 * (P.snoutH || .85), r * .5 + sl + sr * .1));
  }
  const jaw = at(new THREE.Group(), 0, sy - sr * .45, r * .25); head.add(jaw); rig.jaw = jaw;
  if (P.jaw !== false) {
    const jl = (sl > 0 ? sl : r * .5) * (P.jawL || .92), jr = sr * (P.jawR || .55);
    jaw.add(inked(tube([v(0, 0, 0), v(0, -sd * .4 - jr * .2, jl * .5), v(0, -sd * .8, jl + r * .2)], t => { const k = lerp(1, .75, t) * dome(t, .3); return [jr * (P.snoutW || 1) * k, jr * .6 * k]; }, UPY, {nS:8, nR:12}), P.jawMat || m.mBelly || mH, .4));
    if (P.teeth) { const n = P.teeth, mt = M('#f4efe0'); for (let i = 0; i < n; i++) { const u = (i + .5) / n, z = lerp(r * .5, r * .3 + sl, u); [-1, 1].forEach(s => head.add(spike(sr * .1, sr * .34, mt, v(s * sr * .62 * (P.snoutW || 1) * lerp(1, .82, u), sy - sd * u - sr * .5, z), v(0, -1, 0), .15, 6))); } }
    if (P.fangs) { const mt = M('#f4efe0'); [-1, 1].forEach(s => head.add(spike(sr * .14, sr * .6, mt, v(s * sr * .45, sy - sd - sr * .45, r * .45 + sl * .88), v(0, -1, .1), .2, 8))); }
  }
  if (P.tongue) { const tg = new THREE.Group(); jaw.add(tg); rig.tongue = tg; const mt = M('#c43a4a');
    tg.add(limb([v(0, 0, 0), v(0, 0, r * .9), v(0, 0, r * 1.6)], r * .1, r * .07, mt, UPY, .15, {nS:6, nR:6}));
    [-1, 1].forEach(s => tg.add(limb([v(0, 0, r * 1.6), v(s * r * .14, 0, r * 2)], r * .06, r * .02, mt, UPY, .12, {nS:4, nR:6}))); tg.visible = false; }
  /* eyes */
  const ey = P.eyeY != null ? P.eyeY : .25, ez = P.eyeZ != null ? P.eyeZ : .72, ex = P.eyeX != null ? P.eyeX : .5;
  [-1, 1].forEach(s => eyeOn(head, v(s * r * ex * (P.w || 1), r * ey, r * ez), r * (P.eyeR || .17), P.eyeC, mats, P.glow));
  if (P.brow) [-1, 1].forEach(s => head.add(at(rot(inked(sph(r * .32, r * .1, r * .16, 10), mH, .3), 0, 0, -s * .25), s * r * .48, r * (ey + .2), r * (ez - .02))));
  /* ears */
  const ears = P.ears;
  if (ears === 'pointy' || ears === 'tall') { const h = r * (ears === 'tall' ? 1.1 : .78); [-1, 1].forEach(s => { const e = spike(r * .3, h, mH, v(s * r * .48, r * .62, -r * .12), v(s * .35, 1, -.1), .4, 10); e.scale.z = .55; head.add(e);
    if (P.earIn) { const ei = spike(r * .17, h * .6, M(P.earIn), v(s * r * .48, r * .7, -r * .02), v(s * .35, 1, -.1), .1, 8); ei.scale.z = .3; head.add(ei); } }); }
  else if (ears === 'round') [-1, 1].forEach(s => head.add(at(inked(sph(r * .28, r * .26, r * .12, 12), mH, .35), s * r * .66, r * .55, -r * .05)));
  else if (ears === 'floppy') [-1, 1].forEach(s => head.add(at(rot(inked(sph(r * .18, r * .5, r * .32, 12), m.mDark || mH, .35), 0, 0, s * .35), s * r * .82, r * .1, -r * .1)));
  else if (ears === 'horse') [-1, 1].forEach(s => { const e = spike(r * .22, r * .7, mH, v(s * r * .4, r * .7, -r * .25), v(s * .2, 1, .15), .35, 8); e.scale.z = .6; head.add(e); });
  else if (ears === 'elephant') { rig.ears = [-1, 1].map(s => { const g = at(new THREE.Group(), s * r * .75, r * .2, -r * .25); head.add(g);
      g.add(at(rot(inked(sph(r * .12, r * 1.05, r * .9, 18), mH, .45), 0, s * .5, 0), s * r * .55, -r * .2, -r * .25)); g.userData.s = s; return g; }); }
  else if (ears === 'long') [-1, 1].forEach(s => { const e = spike(r * .26, r * 1.3, mH, v(s * r * .8, r * .25, -r * .1), v(s * 1, .45, -.25), .35, 8); e.scale.z = .45; head.add(e); });
  if (P.horns) P.horns(head, r);
  if (P.extra) P.extra(head, r);
}
/* standing on two legs (apes, werewolves, trolls, swamp things): a hunched trunk, two long arms, two short legs */
function ape(rig, P, cl, M, mats){
  const {body} = rig, hip = P.hip, mFur = M(0xffffff, {map:coatTex(Object.assign({}, cl, {belly:cl.belly || null}), P.pat || null)}), mPlain = M(cl.c), mSkin = M(cl.skin || cl.c);
  const torso = at(new THREE.Group(), 0, hip, 0); body.add(torso); rig.torso = torso; torso.rotation.x = P.lean; rig.lean = P.lean;
  const Lt = P.trunk, r0 = P.waist, r1 = P.chestR;
  torso.add(inked(tube([v(0, -r0 * .6, 0), v(0, Lt * .35, r0 * .1), v(0, Lt * .75, 0), v(0, Lt, -r1 * .1)], t => { const k = lerp(r0, r1, Math.pow(t, .8)) * dome(t, .22) * (t < .12 ? Math.sqrt(1 - Math.pow((.12 - t) / .12, 2) * .75) : 1); return [k * (P.wide || 1.1), k * .9]; }, UPZ, {nS:18, nR:18}), mFur, .6));
  if (cl.back) torso.add(at(inked(sph(r1 * .9, Lt * .3, r1 * .4, 16), M(cl.back), .3), 0, Lt * .55, -r1 * .62));
  if (P.belly) torso.add(at(inked(sph(r0 * 1.02, r0 * .95, r0 * .9, 16), M(P.bellyC || cl.belly || cl.c), .4), 0, Lt * .18, r0 * .3));
  /* head on the shoulders, looking forward whatever the lean */
  const head = at(new THREE.Group(), 0, Lt + P.headUp, r1 * (P.headFwd || .4)); torso.add(head); rig.head = head; head.rotation.x = -P.lean * .85; rig.headLean = -P.lean * .85;
  headOn(rig, head, P.head, cl, M, mats, {mPlain, mNose:M(P.head.noseC || '#1e1618'), mBelly:M(cl.belly || shade(cl.c, .8)), mDark:M(shade(cl.c, .6))});
  /* arms: shoulder -> elbow -> hand, hanging toward the floor */
  rig.arms = [-1, 1].map(s => {
    const sh = at(new THREE.Group(), s * r1 * (P.wide || 1.1) * .95, Lt * .82, 0); torso.add(sh);
    sh.rotation.x = -P.lean + (P.armFwd || 0); sh.rotation.z = s * (P.armOut || .12); sh.userData.r = [sh.rotation.x, sh.rotation.z];
    sh.add(inked(sph(P.armR * 1.25, P.armR * 1.25, P.armR * 1.25, 14), mFur, .45));
    sh.add(limb([v(0, 0, 0), v(0, -P.arm1 * .5, 0), v(0, -P.arm1, P.armR * .2)], P.armR * 1.1, P.armR * .85, mFur, UPZ, .5, {bulge:.15}));
    const el = at(new THREE.Group(), 0, -P.arm1, P.armR * .2); sh.add(el); el.rotation.x = -(P.elbow || .2); el.userData.r = el.rotation.x;
    el.add(limb([v(0, 0, 0), v(0, -P.arm2 * .5, 0), v(0, -P.arm2, 0)], P.armR * .9, P.armR * .75, P.foreMat === 'skin' ? mSkin : mFur, UPZ, .5, {bulge:.1}));
    const hand = at(new THREE.Group(), 0, -P.arm2 - P.armR * .4, 0); el.add(hand);
    hand.add(inked(sph(P.armR * 1.05, P.armR * 1.15, P.armR * .9, 14), mSkin, .4));
    if (P.claws) for (let i = -1; i <= 1; i++) hand.add(spike(P.armR * .18, P.armR * .9, M('#ece4d0'), v(i * P.armR * .45, -P.armR * .8, P.armR * .4), v(0, -1, .5), .2, 6));
    return {sh, el, hand};
  });
  rig.armL = rig.arms[0]; rig.armR = rig.arms[1];
  /* legs */
  rig.legs = [-1, 1].map(s => {
    const g = at(new THREE.Group(), s * r0 * .6, hip, 0); body.add(g);
    const h = hip - 1.5, lr = P.legR;
    const pts = P.digi ? [v(0, 0, 0), v(0, -h * .38, lr * 1.6), v(0, -h * .78, -lr * 1.3), v(0, -h, lr * .2)] : [v(0, 0, 0), v(0, -h * .45, lr * .8), v(0, -h, 0)];
    g.add(limb(pts, lr * 1.25, lr * .85, mFur, UPZ, .5, {bulge:.12}));
    g.add(at(inked(sph(lr * 1.1, lr * .6, lr * 1.6, 14), mSkin, .4), 0, -h - lr * .1, lr * .7));
    if (P.claws) for (let i = -1; i <= 1; i++) g.add(spike(lr * .2, lr * .8, M('#ece4d0'), v(i * lr * .5, -h - lr * .3, lr * 2.1), v(0, -.2, 1), .2, 6));
    return {g, s, f:s};
  });
  if (P.tail) { const tg = at(new THREE.Group(), 0, hip + 1, -r0 * .8); body.add(tg);
    tg.add(inked(tube([v(0, 0, 0), v(0, -2, -5), v(0, -6, -10), v(0, -9, -13)], t => { const r = P.tail * (1 + .3 * Math.sin(t * PI)) * (1 - t * .6); return [r, r]; }, UPY, {nS:12, nR:10}), mFur, .4)); rig.tail = [tg]; }
  rig.dims = {yB:hip, R:r1, L:Lt, wR:1, hR:1};
  return {torso, head, mFur, mPlain, mSkin, Lt, r0, r1};
}
/* walking on two legs with the body level (tyrannosaurus, wyvern): the hips are the pivot, the tail balances the head */
function rex(rig, P, cl, M, mats){
  const {body} = rig, hip = P.hip, mCoat = M(0xffffff, {map:coatTex(cl, 'scales')}), mPlain = M(cl.c), mBelly = M(cl.belly || cl.c);
  const torso = at(new THREE.Group(), 0, hip, 0); body.add(torso); rig.torso = torso;
  const R = P.R;
  torso.add(inked(tube([v(0, -R * .1, -R * 1.2), v(0, R * .1, 0), v(0, R * .45, P.len * .55), v(0, R * .8, P.len)], t => { const k = R * Math.pow(Math.sin(PI * t), .45) * lerp(1, .78, t); return [k * .85, k]; }, UPY, {nS:18, nR:18}), mCoat, .6));
  /* neck and head */
  const nk = at(new THREE.Group(), 0, R * .8, P.len - R * .3); torso.add(nk); rig.neck = nk;
  const nEnd = P.neckEnd;
  nk.add(inked(tube([v(0, 0, -R * .3), nEnd.clone().multiplyScalar(.5).add(v(0, P.neckBend || 0, 0)), nEnd], t => { const r = lerp(P.neckR, P.neckR * .75, t); return [r * .9, r]; }, UPB, {nS:12, nR:14}), mCoat, .55));
  const head = at(new THREE.Group(), nEnd.x, nEnd.y, nEnd.z); nk.add(head); rig.head = head;
  headOn(rig, head, P.head, cl, M, mats, {mPlain, mNose:M('#1e1618'), mBelly, mDark:M(shade(cl.c, .6))});
  /* tail, in two parts so it can swing */
  const tg = at(new THREE.Group(), 0, 0, -R * .7); torso.add(tg);
  const tl = P.tail, t1 = tl * .5;
  tg.add(inked(tube([v(0, 0, 0), v(0, -R * .2, -t1 * .5), v(P.tailSide * .3, -R * .35, -t1)], t => { const r = R * .72 * lerp(1, .55, t); return [r * .85, r]; }, UPY, {nS:12, nR:14}), mCoat, .55));
  const tg2 = at(new THREE.Group(), P.tailSide * .3, -R * .35, -t1); tg.add(tg2);
  tg2.add(inked(tube([v(0, 0, 0), v(P.tailSide * .5, -R * .1, -t1 * .5), v(P.tailSide, R * .05, -t1)], t => { const r = R * .4 * lerp(1, .05, t); return [r * .85, r]; }, UPY, {nS:12, nR:12}), mCoat, .45));
  if (P.barb) tg2.add(spike(R * .22, R * .9, M(shade(cl.c, .5)), v(P.tailSide, R * .05, -t1), v(P.tailSide * .03, 0, -1), .3, 4));
  rig.tail = [tg, tg2];
  /* legs: big thighs, shins back, feet with claws */
  rig.legs = [-1, 1].map(s => {
    const g = at(new THREE.Group(), s * R * .7, hip, R * .1); body.add(g);
    const h = hip, lr = P.legR;
    g.add(limb([v(0, R * .1, 0), v(s * lr * .2, -h * .35, lr * 1.3), v(0, -h * .62, -lr * .8)], lr * 1.7, lr * .9, mCoat, UPZ, .55, {bulge:.15}));
    g.add(limb([v(0, -h * .62, -lr * .8), v(0, -h * .85, -lr * .6), v(0, -h + lr * .4, lr * .1)], lr * .8, lr * .6, mPlain, UPZ, .45));
    g.add(at(inked(sph(lr * .9, lr * .45, lr * 1.5, 12), mPlain, .4), 0, -h + lr * .35, lr * .9));
    for (let i = -1; i <= 1; i++) g.add(spike(lr * .2, lr * .9, M('#e8e0cc'), v(i * lr * .55, -h + lr * .2, lr * 2.1), v(0, -.25, 1), .2, 6));
    return {g, s, f:s};
  });
  /* the tyrannosaurus's tiny arms, or the wyvern's wings */
  if (P.arms) rig.arms = [-1, 1].map(s => { const sh = at(new THREE.Group(), s * R * .6, R * .2, P.len * .72); torso.add(sh);
    sh.add(limb([v(0, 0, 0), v(s * .4, -R * .35, R * .25), v(0, -R * .55, R * .55)], R * .14, R * .1, mPlain, UPZ, .3, {nS:6, nR:8}));
    [-1, 1].forEach(k => sh.add(spike(R * .05, R * .22, M('#e8e0cc'), v(k * R * .06, -R * .58, R * .6), v(0, -.5, 1), .12, 5))); return {sh}; });
  if (P.wings) rig.wings = [-1, 1].map(s => { const g = at(new THREE.Group(), s * R * .55, R * .75, P.len * .7); torso.add(g);
    const w = wing(P.wings, mPlain, M(cl.wing || cl.c, {side:THREE.DoubleSide})); g.add(w); if (s < 0) g.scale.x = -1; g.userData.s = s; return g; });
  if (P.spikes) for (let i = 0; i < P.spikes; i++) { const u = i / (P.spikes - 1), z = lerp(-R * 1.2, P.len * .9, u), y = lerp(R * .8, R * 1.55, u) * Math.sin(PI * (.15 + .7 * u)) + R * .2; torso.add(spike(R * .12, R * .45, M(shade(cl.c, .55)), v(0, y, z), v(0, 1, -.3), .25, 4)); }
  rig.dims = {yB:hip, R, L:P.len, wR:.85, hR:1};
}

/* ---------- each beast ---------- */
const BUILD = {
  horse(rig, cl, M, mats){
    const q = quad(rig, {L:30, R:7.6, wR:.82, hR:1.05, leg:19, legR:1.75, thigh:1.7, foot:'hoof', neck:15, neckAng:1.02, neckR:3.6, mane:1,
      head:{r:3.9, w:.85, snout:8.5, snoutR:2.6, snoutDown:4.2, snoutY:.05, snoutEnd:.92, snoutW:.8, ears:'horse', eyeX:.62, eyeZ:.45, eyeY:.25, jawR:.6, eyeC:'#1b1414'},
      tail:{pts:[v(0, 0, 0), v(0, -1, -3.5), v(0, -8, -6), v(0, -15, -5.5)], r:2.2, end:.6, mat:'mane'}}, cl, M, mats);
    void q;
  },
  dog(rig, cl, M, mats){
    quad(rig, {L:20, R:5.2, wR:.85, leg:9.5, legR:1.25, neck:6, neckAng:.85, neckR:2.9,
      head:{r:3.7, snout:3.6, snoutR:1.8, snoutDown:.5, ears:'floppy', eyeX:.5, eyeY:.3, eyeZ:.75, tongue:1, eyeC:'#1b1414'},
      tail:{pts:[v(0, 0, 0), v(0, 2.5, -3), v(0, 5.5, -4.5), v(0, 7.5, -3.5)], r:1.1, end:.45}}, cl, M, mats);
  },
  cat(rig, cl, M, mats){
    quad(rig, {L:17, R:4.3, wR:.82, leg:7.6, legR:1.05, neck:3.5, neckAng:.95, neckR:2.4, pat:cl.pat,
      head:{r:3.6, w:1.05, h:.9, snout:1.2, snoutR:1.5, snoutEnd:.9, snoutW:1.2, ears:'pointy', earIn:'#e8a0a0', eyeX:.46, eyeY:.25, eyeZ:.8, eyeR:.22, eyeC:cl.eyeC || BEASTS.cat.eye, noseC:'#c8707a', jawR:.6, jawL:.8,
        extra:(h, r) => { const mw = M('#f4f0e8'); [-1, 1].forEach(s => [-.1, .1].forEach(k => h.add(at(rot(new THREE.Mesh(new THREE.CylinderGeometry(.06, .06, r * 1.3, 4), mw), 0, 0, PI / 2 + s * k * 2), s * r * .75, -r * .25 + k * r, r * .95)))); }},
      tail:{pts:[v(0, 0, 0), v(0, 3, -3), v(0, 7, -3.5), v(0, 10, -1.5), v(0, 11.5, .5)], r:.95, end:.75}}, cl, M, mats);
  },
  wolf(rig, cl, M, mats){
    quad(rig, {L:24, R:5.8, wR:.82, leg:11.5, legR:1.3, neck:6.5, neckAng:.6, neckR:3.3, ruff:1,
      head:{r:3.9, snout:5.4, snoutR:1.9, snoutDown:.8, snoutEnd:.7, ears:'pointy', eyeX:.5, eyeY:.3, eyeZ:.72, eyeC:BEASTS.wolf.eye, fangs:1, jawR:.6},
      tail:{pts:[v(0, 0, 0), v(0, -2, -3.5), v(0, -6.5, -6), v(0, -10, -6.5)], r:1.7, end:.5, prof:t => 1.5 + 1.2 * Math.sin(PI * t * .9)}}, cl, M, mats);
  },
  fox(rig, cl, M, mats){
    quad(rig, {L:18, R:4.3, wR:.82, leg:8, legR:.95, neck:4.5, neckAng:.75, neckR:2.3,
      head:{r:3.4, w:1.02, snout:4.6, snoutR:1.35, snoutEnd:.5, snoutDown:.3, ears:'tall', earIn:'#2a2220', eyeX:.5, eyeY:.3, eyeZ:.72, eyeC:BEASTS.fox.eye, jawMat:M(cl.belly)},
      tail:{pts:[v(0, 0, 0), v(0, -1, -3), v(0, -2, -7), v(0, 0, -11), v(0, 2.5, -13)], prof:t => 1.2 + 2.6 * Math.sin(PI * Math.min(1, t * 1.05)), tip:1.6, r:2}}, cl, M, mats);
  },
  tiger(rig, cl, M, mats){
    quad(rig, {L:30, R:6.9, wR:.85, leg:11.5, legR:1.7, neck:4.5, neckAng:.5, neckR:4, pat:'stripes', claws:1,
      head:{r:5.1, w:1.05, h:.9, snout:2.2, snoutR:2.4, snoutEnd:.92, snoutW:1.15, ears:'round', eyeX:.46, eyeY:.25, eyeZ:.78, eyeR:.16, eyeC:BEASTS.tiger.eye, noseC:'#c8707a', fangs:1, jawMat:M(cl.belly), mat:M(0xffffff, {map:coatTex(cl, 'stripes')})},
      tail:{pts:[v(0, 0, 0), v(0, -2, -4), v(0, -6, -8), v(0, -6, -13), v(0, -3, -16)], r:1.3, end:.85}}, cl, M, mats);
  },
  snowcat(rig, cl, M, mats){
    quad(rig, {L:26, R:6, wR:.85, leg:9.2, legR:1.55, neck:4, neckAng:.55, neckR:3.6, pat:'rosettes', claws:1,
      head:{r:4.5, w:1.05, h:.88, snout:1.8, snoutR:2.1, snoutEnd:.92, snoutW:1.15, ears:'round', eyeX:.46, eyeY:.25, eyeZ:.78, eyeR:.17, eyeC:BEASTS.snowcat.eye, noseC:'#c8808a', fangs:1, jawMat:M(cl.belly), mat:M(0xffffff, {map:coatTex(cl, 'rosettes')})},
      tail:{pts:[v(0, 0, 0), v(0, -2, -4), v(0, -5, -9), v(0, -4, -14), v(0, -1, -18)], r:2.2, end:.95}}, cl, M, mats);
  },
  elephant(rig, cl, M, mats){
    const ivory = M('#f4ecd6');
    quad(rig, {L:32, R:11.5, wR:.85, hR:1.02, leg:14, legR:3.3, thigh:1.2, foot:'pad', neck:2.5, neckAng:.2, neckR:7, hump:.12, noseC:'#5a5a62',
      head:{r:7.2, w:1, h:1.02, snout:0, snoutR:3, jawL:.5, jawR:.5, ears:'elephant', eyeX:.6, eyeY:.15, eyeZ:.72, eyeR:.12, eyeC:'#1b1414', nose:false,
        extra:(h, r) => { const tr = new THREE.Group(); at(tr, 0, -r * .15, r * .78); h.add(tr); rig.trunk = tr;
          tr.add(inked(tube([v(0, 0, 0), v(0, -r * .5, r * .55), v(0, -r * 1.35, r * .6), v(0, -r * 2, r * .85), v(0, -r * 2.25, r * 1.2)], t => { const k = lerp(r * .38, r * .17, t); return [k, k]; }, UPZ, {nS:18, nR:12}), M(cl.c), .45));
          [-1, 1].forEach(s => h.add(horn([v(s * r * .4, -r * .45, r * .6), v(s * r * .48, -r * 1.0, r * 1.05), v(s * r * .4, -r * 1.05, r * 1.6)], r * .15, ivory)));
          if (cl.paint) { const mp = M(cl.paint); h.add(at(inked(sph(r * .7, r * .5, r * .2, 14), mp, .2), 0, r * .5, r * .8)); } }},
      tail:{pts:[v(0, 0, 0), v(0, -3, -1.5), v(0, -8, -1.5)], r:.8, end:.7, tip:.9}}, cl, M, mats);
  },
  croc(rig, cl, M, mats){
    const q = quad(rig, {L:24, R:5.6, wR:1.05, hR:.62, yB:4.6, leg:6.5, legR:1.25, sprawl:1, claws:1, neck:3, neckAng:.05, neckR:3.6, pat:'scales',
      head:{r:3.4, w:1.05, h:.7, snout:11, snoutR:2.3, snoutW:1.1, snoutH:.6, snoutEnd:.6, snoutY:.15, ears:'none', eyeX:.5, eyeY:.62, eyeZ:.35, eyeR:.24, eyeC:BEASTS.croc.eye, nose:false, teeth:7, jawR:.62, jawL:.95, noseC:'#2a2a1e', mat:M(cl.c)},
      tail:{pts:[v(0, -1, 0), v(2, -2, -7), v(7, -2.5, -13), v(13, -2.6, -15)], r:4.3, end:.08, flat:.7}}, cl, M, mats);
    for (let i = 0; i < 9; i++) [-1, 1].forEach(s => q.torso.add(spike(.7, 1.6, M(cl.back || shade(cl.c, .7)), q.T(s * 1.8, q.yB + q.R * .55, lerp(-q.L / 2 + 2, q.L / 2 - 3, i / 8)), v(0, 1, -.2), .2, 4)));
  },
  lizard(rig, cl, M, mats){
    quad(rig, {L:20, R:4.6, wR:1, hR:.7, yB:5, leg:6.5, legR:1.1, sprawl:1, claws:1, neck:4.5, neckAng:.3, neckR:2.7, pat:'spots',
      head:{r:3, w:1, h:.75, snout:4.2, snoutR:2, snoutW:1, snoutH:.7, snoutEnd:.7, snoutY:.1, ears:'none', eyeX:.6, eyeY:.4, eyeZ:.45, eyeR:.2, eyeC:BEASTS.lizard.eye, nose:false, tongue:1, jawR:.7, mat:M(0xffffff, {map:coatTex(cl, 'spots')})},
      tail:{pts:[v(0, -.5, 0), v(-1.5, -1.5, -6), v(-6, -2.5, -11), v(-12, -3, -12)], r:3.2, end:.06}}, cl, M, mats);
  },
  dragon(rig, cl, M, mats){
    const horns = M('#efe4c8'), dark = M(shade(cl.c, .55));
    const q = quad(rig, {L:28, R:8, wR:.85, leg:12, legR:2.2, claws:1, neck:20, neckR:3.5, pat:'scales', chest:.25,
      neckPts:[v(0, -1, -2), v(0, 6, 4), v(0, 14, 4.5), v(0, 18.5, 8.5)],
      head:{r:4.4, w:.95, h:.85, snout:6, snoutR:2.4, snoutEnd:.75, snoutW:1, snoutH:.75, snoutY:.15, ears:'none', eyeX:.55, eyeY:.4, eyeZ:.55, eyeR:.18, eyeC:BEASTS.dragon.eye, nose:false, teeth:4, fangs:1, jawR:.62, jawMat:M(cl.belly), brow:1,
        horns:(h, r) => [-1, 1].forEach(s => { h.add(horn([v(s * r * .45, r * .55, -r * .2), v(s * r * .75, r * 1.05, -r * .9), v(s * r * .7, r * 1.15, -r * 1.9)], r * .26, horns)); h.add(spike(r * .12, r * .55, horns, v(s * r * .85, -r * .1, -r * .1), v(s, .2, -.6), .2, 6)); })},
      tail:{pts:[v(0, 0, 0), v(0, -3, -7), v(-3, -6, -14), v(-10, -7.5, -18), v(-17, -7.2, -15)], r:4, end:.08}}, cl, M, mats);
    /* spikes down the back and neck, and the tail's spade */
    for (let i = 0; i < 7; i++) q.torso.add(spike(.9, 2.6, dark, q.T(0, q.yB + q.R * (.95 - Math.abs(i - 3) * .03), lerp(-q.L / 2 + 3, q.L / 2 - 3, i / 6)), v(0, 1, -.35), .2, 4));
    [[0, 3.5, 2.5], [0, 10, 5.5], [0, 16, 5.5]].forEach(p => rig.neck.add(spike(.8, 2.2, dark, v(p[0], p[1], p[2] - 3.2), v(0, .3, -1), .2, 4)));
    const tp = rig.tail[0]; const spade = new THREE.Shape(); spade.moveTo(0, 0); spade.quadraticCurveTo(3.4, 1.2, 0, 5.2); spade.quadraticCurveTo(-3.4, 1.2, 0, 0);
    const sg = new THREE.ExtrudeGeometry(spade, {depth:.8, bevelEnabled:false}); sg.translate(0, 0, -.4);
    const sp = inked(sg, dark, .25); sp.position.set(-17, -7.2, -15); sp.rotation.set(-PI / 2, 0, -1.2); tp.children[0].add(sp);
    rig.wings = [-1, 1].map(s => { const g = at(new THREE.Group(), s * q.R * .55, q.R * .7, q.L * .62); q.torso.add(g); const w = wing(30, M(cl.c), M(cl.wing || cl.c, {side:THREE.DoubleSide}), {back:.4}); g.add(w); if (s < 0) g.scale.x = -1; g.userData.s = s; return g; });
  },
  trex(rig, cl, M, mats){
    rex(rig, {hip:21, R:8.2, len:15, legR:2.6, neckR:4.6, neckEnd:v(0, 4.5, 6), neckBend:2.5, tail:30, tailSide:-9, arms:1, spikes:0,
      head:{r:5.6, w:.95, h:.95, d:1.15, snout:8, snoutR:3.5, snoutW:1, snoutH:.9, snoutEnd:.85, snoutY:.1, ears:'none', eyeX:.62, eyeY:.4, eyeZ:.35, eyeR:.15, eyeC:BEASTS.trex.eye, nose:false, teeth:6, jawR:.75, jawL:1, brow:1}}, cl, M, mats);
  },
  wyvern(rig, cl, M, mats){
    const horns = M('#efe4c8');
    rex(rig, {hip:15, R:6, len:11, legR:1.8, neckR:2.6, neckEnd:v(0, 17, 6), neckBend:-2, tail:30, tailSide:7, barb:1, wings:34, spikes:6,
      head:{r:3.4, w:.95, h:.85, snout:5, snoutR:1.8, snoutEnd:.65, snoutH:.75, snoutY:.15, ears:'none', eyeX:.58, eyeY:.4, eyeZ:.5, eyeR:.18, eyeC:BEASTS.wyvern.eye, nose:false, teeth:4, jawR:.6, brow:1,
        horns:(h, r) => [-1, 1].forEach(s => h.add(horn([v(s * r * .4, r * .5, -r * .3), v(s * r * .55, r * .8, -r * 1.1), v(s * r * .45, r * .7, -r * 2)], r * .22, horns)))}}, cl, M, mats);
  },
  gorilla(rig, cl, M, mats){
    ape(rig, {hip:13, lean:.62, trunk:18, waist:8, chestR:10.5, wide:1.12, headUp:2.5, headFwd:.55, armR:2.9, arm1:13, arm2:12.5, armFwd:.62, armOut:.1, elbow:.05, legR:3, belly:1, bellyC:cl.skin, foreMat:'fur',
      head:{r:5.6, w:1, h:1, snout:2.6, snoutR:3, snoutW:1.15, snoutH:.85, snoutY:.3, snoutEnd:.95, snoutMat:M(cl.skin), noseC:'#141012', ears:'round', eyeX:.4, eyeY:.12, eyeZ:.78, eyeR:.14, eyeC:'#3a2416', brow:1, jawMat:M(cl.skin), jawR:.75,
        extra:(h, r) => h.add(at(inked(sph(r * .7, r * .45, r * .6, 14), M(cl.c), .35), 0, r * .75, -r * .15))}}, cl, M, mats);
  },
  werewolf(rig, cl, M, mats){
    ape(rig, {hip:20, lean:.35, trunk:21, waist:6.5, chestR:9, wide:1.1, headUp:3.2, headFwd:.75, armR:2.2, arm1:12.5, arm2:12, armFwd:.25, armOut:.18, elbow:.45, legR:2.4, digi:1, claws:1, tail:2, foreMat:'fur',
      head:{r:4.6, snout:5.8, snoutR:2.2, snoutDown:.6, snoutEnd:.7, ears:'pointy', eyeX:.5, eyeY:.3, eyeZ:.72, eyeC:BEASTS.werewolf.eye, glow:1, fangs:1, teeth:3, jawR:.62, brow:1,
        extra:(h, r) => h.add(at(inked(sph(r * 1.25, r * 1, r * .9, 16), M(cl.c), .4), 0, -r * .7, -r * .55))}}, cl, M, mats);
  },
  troll(rig, cl, M, mats){
    const q = ape(rig, {hip:21, lean:.38, trunk:20, waist:7.5, chestR:8.6, wide:1.05, headUp:3, headFwd:.8, armR:2.4, arm1:15, arm2:15, armFwd:.4, armOut:.14, elbow:.2, legR:2.6, belly:1, bellyC:shade(cl.c, 1.1), foreMat:'skin',
      head:{r:5, w:.95, h:1.02, snout:0, snoutR:2.4, jawR:.95, jawL:1.1, ears:'long', eyeX:.36, eyeY:.25, eyeZ:.8, eyeR:.15, eyeC:BEASTS.troll.eye, glow:1, brow:1, jawMat:M(cl.c), mat:M(cl.c),
        extra:(h, r) => { h.add(limb([v(0, r * .1, r * .8), v(0, -r * .25, r * 1.4), v(0, -r * .7, r * 1.6)], r * .3, r * .24, M(shade(cl.c, 1.05)), UPY, .4));
          [-1, 1].forEach(s => h.add(spike(r * .13, r * .5, M('#ece2c4'), v(s * r * .4, -r * .62, r * .82), v(s * .2, 1, .2), .2, 7)));
          for (let i = 0; i < 5; i++) h.add(horn([v((i - 2) * r * .18, r * .82, -r * .1), v((i - 2) * r * .3, r * 1.35, -r * .35), v((i - 2) * r * .4, r * 1.5, -r * .9)], r * .12, M(cl.hair)));
        }}}, cl, M, mats);
    /* a loincloth */
    q.torso.add(at(inked(new THREE.CylinderGeometry(q.r0 * 1.12, q.r0 * 1.3, 6, 18, 1, true).scale(1.1, 1, .95), M(cl.cloth, {side:THREE.DoubleSide}), .4), 0, -1.2, .3));
  },
  swamp(rig, cl, M, mats){
    const q = ape(rig, {hip:16, lean:.25, trunk:22, waist:9.5, chestR:11, wide:1.12, headUp:1, headFwd:.7, armR:3, arm1:13, arm2:12.5, armFwd:.3, armOut:.16, elbow:.3, legR:3.3, foreMat:'fur',
      head:{r:5.8, w:1.05, h:.9, snout:0, snoutR:2.4, jawR:.8, jawL:.9, ears:'none', eyeX:.36, eyeY:.12, eyeZ:.82, eyeR:.17, eyeC:BEASTS.swamp.eye, glow:1, mat:M(cl.c), jawMat:M(shade(cl.c, .7))}}, cl, M, mats);
    /* moss and weeds hang from the shoulders, arms and head */
    const moss = M(cl.moss);
    let seed = 3; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
    const drip = (par, x, y, z, len, r) => par.add(inked(tube([v(x, y, z), v(x + (rnd() - .5) * 1.5, y - len * .5, z + .6), v(x + (rnd() - .5) * 2, y - len, z + .3)], t => [r * (1 - t * .7), r * (1 - t * .7)], UPZ, {nS:8, nR:6}), moss, .25));
    for (let i = 0; i < 14; i++) { const a = rnd() * TAU, rr = q.r1 * .95; drip(q.torso, Math.cos(a) * rr * 1.1, q.Lt * (.55 + rnd() * .4), Math.sin(a) * rr * .9, 5 + rnd() * 8, 1 + rnd() * .7); }
    rig.arms.forEach(a => { for (let i = 0; i < 3; i++) drip(a.el, (rnd() - .5) * 3, -2 - rnd() * 6, (rnd() - .5) * 3, 4 + rnd() * 4, .8); });
    for (let i = 0; i < 6; i++) drip(rig.head, (rnd() - .5) * 8, 4 + rnd() * 1.5, -1 + rnd() * 3, 3 + rnd() * 4, .7);
    for (let i = 0; i < 9; i++) q.torso.add(at(inked(sph(1.6 + rnd() * 1.4, 1.2 + rnd(), 1.4 + rnd(), 10), moss, .3), (rnd() - .5) * q.r1 * 1.8, q.Lt * (.25 + rnd() * .7), (rnd() > .5 ? 1 : -1) * q.r1 * .75));
  },
  spider(rig, cl, M, mats){
    const {body} = rig, mB = M(cl.c), mL = M(shade(cl.c, .85)), mk = M(cl.mark);
    const torso = at(new THREE.Group(), 0, 9, 0); body.add(torso); rig.torso = torso;
    torso.add(at(inked(sph(5.6, 4, 6.6, 20), mB, .5), 0, 0, 4));
    const abd = at(rot(inked(sph(9.5, 8.2, 11, 24), mB, .6), -.3, 0, 0), 0, 4, -10); torso.add(abd); rig.abd = abd;
    abd.add(at(inked(sph(3, 1, 4, 14), mk, .15), 0, 8.1, 0)); abd.add(at(inked(sph(2.2, .8, 2.2, 12), mk, .15), 0, 7.4, -5.5));
    const head = at(new THREE.Group(), 0, 1, 9.6); torso.add(head); rig.head = head;
    [[-1.6, 1.5, 1.6, .9], [1.6, 1.5, 1.6, .9], [-.6, 2.1, 1.9, .65], [.6, 2.1, 1.9, .65], [-2.6, 1, .9, .55], [2.6, 1, .9, .55]].forEach(([x, y, z, r]) => eyeOn(head, v(x, y, z - 1.5), r, BEASTS.spider.eye, mats, true));
    const jaw = new THREE.Group(); head.add(jaw); rig.jaw = jaw; rig.fangs = [-1, 1].map(s => { const f = at(new THREE.Group(), s * 1.3, -1.6, 1); jaw.add(f); f.add(spike(.7, 2.8, M('#1a1416'), v(0, 0, 0), v(-s * .2, -1, .5), .2, 8)); return f; });
    rig.legs = [];
    [[.75, 6.8], [.25, 5.2], [-.3, 3.4], [-.85, 1.8]].forEach(([yaw, z], i) => [-1, 1].forEach(s => {
      const g = at(new THREE.Group(), s * 4.4, 0, z); torso.add(g); g.rotation.y = s * (PI / 2 - (PI / 2 - Math.abs(yaw)) * Math.sign(yaw) * 0) + 0; g.rotation.y = s > 0 ? PI / 2 - yaw : -PI / 2 + yaw;
      /* in the leg's frame +z runs out from the body */
      g.add(limb([v(0, 0, 0), v(0, 6, 5.5), v(0, 7.5, 9.5)], 1.15, .85, mL, UPX, .4, {nS:8, nR:8}));
      g.add(limb([v(0, 7.5, 9.5), v(0, 2, 15), v(0, -8.2, 18.5 - i * .3)], .85, .4, mL, UPX, .35, {nS:10, nR:8}));
      rig.legs.push({g, s, f:i % 2 ? -1 : 1, spider:1, y0:g.rotation.y});
    }));
    rig.dims = {yB:9, R:8, L:20, wR:1, hR:1};
  },
  crab(rig, cl, M, mats){
    const {body} = rig, mS = M(cl.c), mB = M(cl.belly), mt = M(shade(cl.c, 1.08));
    const torso = at(new THREE.Group(), 0, 10, 0); body.add(torso); rig.torso = torso;
    torso.add(inked(sph(13, 5.4, 10.5, 28), mS, .6));
    torso.add(at(inked(sph(12.4, 3, 10, 24), mB, .4), 0, -2.6, 0));
    for (let i = -2; i <= 2; i++) torso.add(spike(.55, 1.4, mt, v(i * 2.6, 3.4 - Math.abs(i) * .5, 8.7 - Math.abs(i) * .6), v(0, .4, 1), .15, 5));
    const head = at(new THREE.Group(), 0, 3, 8.8); torso.add(head); rig.head = head;
    [-1, 1].forEach(s => { head.add(limb([v(s * 2.2, 0, 0), v(s * 2.5, 3, .5), v(s * 2.7, 5, .3)], .55, .45, mS, UPZ, .25, {nS:6, nR:8})); eyeOn(head, v(s * 2.7, 5.6, .4), 1, '#141018', mats); });
    const jaw = new THREE.Group(); head.add(jaw); rig.jaw = jaw;
    rig.legs = [];
    [[.35, 1.5], [.0, -2], [-.4, -5.5]].forEach(([yaw, z], i) => [-1, 1].forEach(s => {
      const g = at(new THREE.Group(), s * 11, -1, z); torso.add(g); g.rotation.y = s > 0 ? PI / 2 - yaw - .2 : -PI / 2 + yaw + .2;
      g.add(limb([v(0, 0, 0), v(0, 2.6, 4.5), v(0, 3.2, 8)], 1.15, .9, mS, UPX, .4, {nS:8, nR:8}));
      g.add(limb([v(0, 3.2, 8), v(0, -.5, 11), v(0, -7.7, 12.5)], .9, .3, mS, UPX, .35, {nS:8, nR:8}));
      rig.legs.push({g, s, f:i % 2 ? -1 : 1, spider:1, y0:g.rotation.y});
    }));
    /* claws: an arm, a palm, a fixed finger and one that snaps */
    rig.claws = [-1, 1].map(s => {
      const sh = at(new THREE.Group(), s * 10, 0, 6); torso.add(sh);
      sh.add(limb([v(0, 0, 0), v(s * 3.4, 2.2, 3.4), v(s * 4, 3.4, 7.4)], 1.5, 1.25, mS, UPY, .4, {nS:8, nR:10}));
      const pw = at(new THREE.Group(), s * 4, 3.4, 7.6); sh.add(pw);
      const big = s > 0 ? 1.2 : 1;
      pw.add(inked(sph(2.6 * big, 2.2 * big, 3.6 * big, 16), mS, .45));
      pw.add(inked(tube([v(-s * .4, -.6, 2.2 * big), v(-s * .6, -.9, 5.2 * big), v(-s * .2, -.4, 7.4 * big)], t => [1.25 * big * (1 - t * .8), .9 * big * (1 - t * .8)], UPY, {nS:8, nR:10}), mS, .35));
      const fin = at(new THREE.Group(), s * .5, .9, 2.4 * big); pw.add(fin);
      fin.add(inked(tube([v(0, 0, 0), v(s * .2, .7, 3 * big), v(-s * .2, -.3, 5 * big)], t => [1.05 * big * (1 - t * .8), .8 * big * (1 - t * .8)], UPY, {nS:8, nR:10}), mS, .35));
      return {sh, pw, fin};
    });
    rig.dims = {yB:10, R:6, L:22, wR:1, hR:1};
  },
  beetle(rig, cl, M, mats){
    const {body} = rig, shell = new THREE.MeshMatcapMaterial({matcap:metalCap(cl.c)}); shell.userData.base = shell.color.clone(); mats.push(shell);
    const mL = M(shade(cl.c, .35)), dark = M('#1a1618');
    const torso = at(new THREE.Group(), 0, 9.5, 0); body.add(torso); rig.torso = torso;
    torso.add(at(inked(sph(9.6, 6.6, 13, 28), shell, .6), 0, 1, -4));
    torso.add(at(inked(new THREE.CylinderGeometry(.35, .35, 25, 6).rotateX(PI / 2), dark, .1), 0, 7.4, -4.2));
    torso.add(at(inked(sph(9.4, 3.2, 12.4, 24), mL, .3), 0, -2.6, -4));
    torso.add(at(inked(sph(7.4, 5.2, 5.6, 22), shell, .5), 0, 1.6, 8));
    const head = at(new THREE.Group(), 0, .2, 12.2); torso.add(head); rig.head = head;
    head.add(inked(sph(3.6, 2.8, 3.4, 16), mL, .4));
    head.add(horn([v(0, .6, 2.4), v(0, 3.6, 6), v(0, 9, 6.6), v(0, 11, 4.5)], 1.5, shell, .35));
    [-1, 1].forEach(s => { eyeOn(head, v(s * 2.6, .8, 1.8), .65, '#141018', mats); head.add(limb([v(s * 2, 1.8, 2), v(s * 3.6, 4.4, 4), v(s * 4.6, 5.6, 2.6)], .3, .18, dark, UPZ, .15, {nS:6, nR:6})); });
    const jaw = new THREE.Group(); head.add(jaw); rig.jaw = jaw;
    rig.legs = [];
    [[.5, 7], [.0, 2], [-.5, -3.5]].forEach(([yaw, z], i) => [-1, 1].forEach(s => {
      const g = at(new THREE.Group(), s * 6.5, -2.4, z); torso.add(g); g.rotation.y = s > 0 ? PI / 2 - yaw : -PI / 2 + yaw;
      g.add(limb([v(0, 0, 0), v(0, 3, 4.5), v(0, 3.5, 7.5)], .9, .7, mL, UPX, .3, {nS:8, nR:8}));
      g.add(limb([v(0, 3.5, 7.5), v(0, -1, 10.5), v(0, -7, 12)], .7, .35, mL, UPX, .3, {nS:8, nR:8}));
      rig.legs.push({g, s, f:i % 2 ? -1 : 1, spider:1, y0:g.rotation.y});
    }));
    rig.dims = {yB:9.5, R:7, L:24, wR:1, hR:1};
  },
  serpent(rig, cl, M, mats){
    const {body} = rig, mC = M(0xffffff, {map:coatTex(Object.assign({}, cl, {pat:'bands'}), 'bands')});
    const torso = new THREE.Group(); body.add(torso); rig.torso = torso;
    /* the coils on the base: from the tail tip in the middle outward, then round to the front where the neck rises */
    const coil = []; for (let i = 0; i <= 40; i++) { const u = i / 40, a = -PI * .5 + u * TAU * 1.55, rr = lerp(4, 15, u); coil.push(v(Math.cos(a) * rr, lerp(5, 3.6, u) + Math.max(0, 1 - u * 3) * 3, Math.sin(a) * rr)); }
    torso.add(inked(tube(coil, t => { const r = lerp(.2, 4.2, Math.pow(Math.min(1, t * 1.6), .7)); return [r, r * .85]; }, UPY, {nS:70, nR:14}), mC, .55));
    const end = coil[40].clone();
    /* the neck in three parts, so it can draw back and strike */
    const segs = [], lens = [9, 9, 8], dirs = [v(.15, 1, .5), v(0, 1, .25), v(0, .5, 1)];
    let par = torso, p = end;
    lens.forEach((l, i) => { const g = at(new THREE.Group(), p.x, p.y, p.z); par.add(g); const d = dirs[i].clone().normalize().multiplyScalar(l), r0 = lerp(4.2, 2.6, i / 3), r1 = lerp(4.2, 2.6, (i + 1) / 3);
      g.add(inked(tube([v(0, 0, 0), d.clone().multiplyScalar(.5), d], t => { const r = lerp(r0, r1, t); return [r, r * .9]; }, UPB, {nS:8, nR:14}), mC, .5));
      g.add(at(inked(sph(r1 * .98, r1 * .9, r1 * .98, 14), mC, .4), d.x, d.y, d.z));
      segs.push(g); par = g; p = d; });
    rig.neck = segs[0]; rig.segs = segs;
    const head = at(new THREE.Group(), p.x, p.y, p.z); par.add(head); rig.head = head;
    headOn(rig, head, {r:3.6, w:1.15, h:.68, d:1.2, snout:2.6, snoutR:2.4, snoutW:1.25, snoutH:.55, snoutEnd:.7, snoutY:.05, ears:'none', eyeX:.58, eyeY:.4, eyeZ:.55, eyeR:.18, eyeC:BEASTS.serpent.eye, nose:false, tongue:1, fangs:1, jawR:.7, mat:M(cl.c), jawMat:M(cl.belly)}, cl, M, mats, {mPlain:M(cl.c), mNose:M('#1e1618'), mBelly:M(cl.belly)});
    rig.dims = {yB:16, R:4, L:30, wR:1, hR:1};
  },
  phoenix(rig, cl, M, mats){
    const {body} = rig, mB = M(cl.c), mY = M(cl.belly), mT = M(cl.tip), gold = M('#f4c046');
    /* a column of flame holds the bird up over its base */
    const fire = new THREE.Group(); body.add(fire); rig.fire = fire;
    const fm = (c, o) => new THREE.MeshBasicMaterial({color:c, transparent:true, opacity:o, depthWrite:false, blending:THREE.AdditiveBlending});
    [[6, 22, cl.fire, .55], [4, 18, 0xffd27a, .6], [2.2, 14, 0xffffff, .5]].forEach(([r, h, c, o]) => fire.add(at(new THREE.Mesh(new THREE.ConeGeometry(r, h, 18, 1, true), fm(c, o)), 0, h / 2, 0)));
    const glow = new THREE.Sprite(new THREE.SpriteMaterial({map:GLOW, color:cl.fire, transparent:true, opacity:.75, depthWrite:false, blending:THREE.AdditiveBlending})); glow.scale.setScalar(46); glow.position.y = 26; fire.add(glow); rig.glow = glow;
    const torso = at(new THREE.Group(), 0, 25, 0); body.add(torso); rig.torso = torso;
    torso.add(at(rot(inked(sph(5, 5.6, 8, 22), mB, .5), -.35, 0, 0), 0, 0, 0));
    torso.add(at(rot(inked(sph(4, 4.6, 5.4, 18), mY, .35), -.35, 0, 0), 0, -.6, 3));
    const nk = at(new THREE.Group(), 0, 4.2, 5); torso.add(nk); rig.neck = nk;
    nk.add(limb([v(0, -2, -1), v(0, 1.5, .5), v(0, 4, 1.5)], 2.6, 2.1, mB, UPB, .4));
    const head = at(new THREE.Group(), 0, 5.5, 2); nk.add(head); rig.head = head;
    head.add(inked(sph(3.2, 3, 3.4, 18), mB, .45));
    head.add(spike(1.25, 4, gold, v(0, -.3, 2.6), v(0, -.35, 1), .3, 10));
    const jaw = at(new THREE.Group(), 0, -.9, 2.4); head.add(jaw); rig.jaw = jaw; jaw.add(spike(.85, 2.6, gold, v(0, 0, 0), v(0, -.5, 1), .25, 8));
    [-1, 1].forEach(s => eyeOn(head, v(s * 1.9, .9, 2), .55, '#141018', mats));
    for (let i = 0; i < 5; i++) head.add(horn([v(0, 2, -1 + i * .3), v((i - 2) * .6, 5 + i * .3, -3 - i * .6), v((i - 2) * 1.1, 6.5 + i * .4, -6 - i * .9)], .55, i % 2 ? mT : mY, .2));
    /* wings of long feathers, red to gold to pale */
    rig.wings = [-1, 1].map(s => { const g = at(new THREE.Group(), s * 3.5, 2, 1); torso.add(g);
      const fe = (len, ang, w, m) => { const f = inked(sph(w, .5, len / 2, 12).translate(0, 0, -len / 2), m, .25); const o = new THREE.Group(); o.add(f); o.rotation.set(0, PI / 2 + ang, 0); return o; };
      for (let i = 0; i < 7; i++) { const u = i / 6, f = fe(lerp(9, 17, Math.sin(u * PI * .8 + .3)), lerp(.5, -.6, u), lerp(2.6, 1.6, u), u < .3 ? mB : u < .7 ? mY : mT); f.position.set(u * 4, u * 2.5, -u * 1); g.add(f); }
      for (let i = 0; i < 5; i++) { const f = fe(7, lerp(.4, -.4, i / 4), 1.8, mB); f.position.set(i * .6, .8, .5); g.add(f); }
      if (s < 0) g.scale.x = -1; g.userData.s = s; return g; });
    /* the tail: long ribbons trailing down and back, gold tips */
    const tg = at(new THREE.Group(), 0, -2, -6); torso.add(tg);
    for (let i = 0; i < 5; i++) { const sx = (i - 2) * 1.6, pts = [v(0, 0, 0), v(sx * .5, -3, -5), v(sx, -8, -8), v(sx * 1.4, -15, -7)];
      tg.add(inked(tube(pts, t => [1.4 * (1 - t * .5), .4], UPZ, {nS:12, nR:8}), i % 2 ? mY : mB, .25));
      tg.add(at(inked(sph(1.6, 1, 2.4, 10), mT, .2), pts[3].x, pts[3].y, pts[3].z)); }
    rig.tail = [tg];
    rig.legs = [-1, 1].map(s => { const g = at(new THREE.Group(), s * 1.8, -4, 1); torso.add(g); g.add(limb([v(0, 0, 0), v(0, -2.5, -.5), v(0, -4, .6)], .5, .4, gold, UPZ, .2, {nS:6, nR:6})); return {g, s, f:s}; });
    rig.dims = {yB:25, R:5, L:16, wR:1, hR:1};
  },
};

/* ---------- build ---------- */
function build(spec, opt = {}, K){
  const id = BEASTS[spec.beast] ? spec.beast : 'wolf', B = BEASTS[id], cl = Object.assign({}, B.coats[spec.skin] || B.coats[0]);
  if (B.plan === 'person') return giant(spec, opt, K, B, cl);
  const mats = [], M = (c, o) => { const m = toon(c, o); mats.push(m); return m; };
  const root = new THREE.Group(), rig = {root, spec, mats, fx:{}, w:{}, beast:id, plan:B.plan};
  baseOn(root, rig, B.base, opt);
  /* big beasts stand taller than people on the board, small ones smaller; the base keeps its size */
  const size = at(new THREE.Group(), 0, 6, 0); size.scale.setScalar(B.k || 1); root.add(size);
  const body = new THREE.Group(); size.add(body); rig.body = body;
  BUILD[id](rig, cl, M, mats);
  /* how tall it stands (for the name over its head and the camera) */
  root.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(body); rig.h = Math.max(30, box.max.y + 2); rig.len = Math.max(box.max.z - box.min.z, box.max.x - box.min.x);
  rig.joints = [];
  body.traverse(o => { if (o.isGroup && o !== body && !o.userData.m && o.children.length && !(o.parent && o.parent.userData.m)) rig.joints.push(o); });
  rig.joints.unshift(body);
  rig.rest = rig.joints.map(o => ({p:o.position.clone(), r:o.rotation.clone(), s:o.scale.clone()}));
  if (opt.scale) root.scale.setScalar(opt.scale);
  return rig;
}
/* the giant: a person figure half again as big, on a wide base */
function giant(spec, opt, K, B, cl){
  const s = K.defaultSpec('Human', 'm');
  Object.assign(s, {outfit:cl.outfit, cloth:cl.cloth, hairCol:cl.hair, beard:cl.beard, hair:K.hairId(cl.style || 'bald'), expr:'fierce', headSize:'l', jaw:'strong'});
  const rig = K.buildFigure(K.faceFix(s), Object.assign({}, opt, {base:false}));
  const skin = new THREE.Color(cl.c); rig.mats.forEach(m => { if (m.color && m.color.getHexString() === new THREE.Color(K.RACES.Human.skins[0].c).getHexString()) { m.color.copy(skin); if (m.userData.base) m.userData.base.copy(skin); } });
  const S = 1.28, root = new THREE.Group(), inner = rig.root; root.add(inner); inner.scale.setScalar(S);
  baseOn(root, rig, B.base, opt);
  rig.root = root; rig.h = rig.h * S; rig.spec = spec; rig.giant = true;
  if (opt.scale) root.scale.setScalar(opt.scale);
  return rig;
}

/* ---------- moves ---------- */
const seg = (t, a, b) => clamp((t - a) / (b - a), 0, 1);
const eOut = u => 1 - Math.pow(1 - u, 3), eIO = u => u < .5 ? 4 * u * u * u : 1 - Math.pow(-2 * u + 2, 3) / 2;
const eBack = u => { const c1 = 1.70158, c3 = c1 + 1; return 1 + c3 * Math.pow(u - 1, 3) + c1 * Math.pow(u - 1, 2); };
const _fc = new THREE.Color();
function flash(rig, k, hex){ _fc.setHex(hex); rig.mats.forEach(m => { if (m.emissive) m.emissive.setHex(hex).multiplyScalar(k * .7); else if (m.userData.base) m.color.copy(m.userData.base).lerp(_fc, k * .55); }); }
function rest(rig){
  rig.joints.forEach((o, i) => { const r = rig.rest[i]; o.position.copy(r.p); o.rotation.copy(r.r); o.scale.copy(r.s); });
  rig.mats.forEach(m => { if (m.emissive) m.emissive.setRGB(0, 0, 0); else if (m.userData.base) m.color.copy(m.userData.base); });
  if (rig.tongue) rig.tongue.visible = false;
}
/* the close attack's beat: wind up 150-650, land at 720, back by 1500 (the people's sword swing) */
const MELEE = ms => { const wind = seg(ms, 150, 650), strike = seg(ms, 640, 760), rec = seg(ms, 1050, 1500); return {wind:eIO(wind), strike:eOut(strike), back:1 - eIO(rec), w0:wind}; };
function pose(rig, name, t){
  rest(rig);
  const D = ANIMS[name] || 2000, ms = t % D, u = ms / D, plan = rig.plan, d = rig.dims, id = rig.beast;
  const {body, torso, head, jaw} = rig, br = Math.sin(t / 380) * .5 + .5;
  const legs = rig.legs || [], tail = rig.tail || [], wings = rig.wings || [];
  const many = legs.length > 4, two = legs.length === 2 && plan !== 'bird';
  /* always: breathing, a tail that sways, a head that looks about a little */
  torso.scale.y *= 1 + br * .012;
  tail.forEach((g, i) => { g.rotation.y += Math.sin(t / 520 - i * .7) * (id === 'serpent' ? 0 : .16); });
  if (rig.trunk) rig.trunk.rotation.x += Math.sin(t / 700) * .08;
  if (rig.ears) rig.ears.forEach(e => { e.rotation.y += e.userData.s * Math.sin(t / 600) * .12; });
  if (rig.fire) { const f = 1 + Math.sin(t / 90) * .06 + Math.sin(t / 37) * .04; rig.fire.scale.set(1, f, 1); if (rig.glow) rig.glow.material.opacity = .6 + .15 * Math.sin(t / 120); }
  if (plan === 'bird') { const fl = Math.sin(t / 260); wings.forEach(w => { w.rotation.z += w.userData.s * fl * .35; w.rotation.y += -w.userData.s * .1; }); torso.position.y += Math.sin(t / 520) * 1.4; }
  else if (wings.length) wings.forEach(w => { w.rotation.z += -w.userData.s * .35; w.rotation.y += w.userData.s * .55; w.rotation.x += .15 + Math.sin(t / 900) * .04; }); /* half folded, held up off the back */
  if (rig.segs) rig.segs.forEach((g, i) => { g.rotation.z += Math.sin(t / 700 + i) * .06; g.rotation.x += Math.sin(t / 900 + i * .5) * .03; });
  if (name === 'idle') {
    if (head) { head.rotation.y += Math.sin(t / 1700) * .12; head.rotation.x += Math.sin(t / 1100) * .04; }
    if (rig.tongue && (t % 2400) > 1500 && (t % 2400) < 1900) { rig.tongue.visible = true; rig.tongue.scale.z = .6 + .4 * Math.sin((t % 2400 - 1500) / 400 * PI); }
    if (rig.arms && plan === 'ape') rig.arms.forEach((a, i) => { a.sh.rotation.x += Math.sin(t / 900 + i * PI) * .03; });
    if (rig.fangs) rig.fangs.forEach((f, i) => { f.rotation.z += Math.sin(t / 300 + i * PI) * .1; });
    if (many) legs.forEach((l, i) => { l.g.rotation.x += Math.sin(t / 500 + i) * .03; });
    return;
  }
  if (name === 'walk') {
    const p = u * TAU;
    if (many) legs.forEach((l, i) => { const ph = p + (((i >> 1) + (l.s > 0 ? 1 : 0)) % 2) * PI; l.g.rotation.y += Math.sin(ph) * .22 * l.s; l.g.rotation.z += -l.s * Math.max(0, Math.cos(ph)) * .25; });
    else if (two) legs.forEach((l, i) => { l.g.rotation.x += Math.sin(p + i * PI) * .55; });
    else if (legs.length === 4) legs.forEach(l => { const ph = p + ((l.s > 0) === (l.f > 0) ? 0 : PI); l.g.rotation.x += Math.sin(ph) * (d.L > 25 ? .4 : .55) * (l.f > 0 ? 1 : -1) * -1; });
    if (rig.arms && plan === 'ape') rig.arms.forEach((a, i) => { a.sh.rotation.x += Math.sin(p + i * PI) * .5; });
    if (id === 'serpent') { body.rotation.y += Math.sin(p) * .08; rig.segs.forEach((g, i) => { g.rotation.z += Math.sin(p - i) * .12; }); }
    body.position.y += Math.abs(Math.cos(p)) * (plan === 'bird' ? 1 : 1.4);
    if (head) head.rotation.x += Math.sin(p * 2) * .04;
    if (plan === 'bird') wings.forEach(w => { w.rotation.z += w.userData.s * Math.sin(t / 120) * .3; });
    return;
  }
  if (name === 'sword') {
    const m = MELEE(ms), lunge = m.strike * m.back, open = Math.min(1, m.w0 * 1.5) * (1 - seg(ms, 700, 800)) * m.back + seg(ms, 760, 900) * 0;
    if (plan === 'quad' && (id === 'horse' || id === 'elephant')) {
      /* rears up on the hind legs and stamps down */
      const up = m.wind * (1 - m.strike);
      torso.rotation.x -= (id === 'horse' ? .55 : .38) * up * m.back;
      legs.forEach(l => { if (l.f > 0) l.g.rotation.x -= 1.0 * up * m.back; else l.g.rotation.x += (id === 'horse' ? .55 : .38) * up * m.back; });
      body.position.z += 6 * lunge;
      if (head) head.rotation.x += .4 * up * m.back - .2 * lunge;
      if (rig.trunk) rig.trunk.rotation.x -= 1.4 * up * m.back;
      if (rig.ears) rig.ears.forEach(e => { e.rotation.y += e.userData.s * .7 * up; });
    } else if (plan === 'quad') {
      /* crouches, then springs forward and bites */
      torso.rotation.x += .12 * m.wind * (1 - m.strike) - .08 * lunge;
      body.position.y -= 2 * m.wind * (1 - m.strike) * m.back;
      body.position.z += -3 * m.wind * (1 - m.strike) + 13 * lunge;
      legs.forEach(l => { if (l.f > 0) l.g.rotation.x -= .7 * lunge; else l.g.rotation.x += .45 * lunge; });
      if (rig.neck) rig.neck.rotation.x += .25 * lunge - .15 * m.wind * (1 - m.strike);
      if (wings.length) wings.forEach(w => { w.rotation.z += w.userData.s * .9 * m.wind * m.back; w.rotation.y -= w.userData.s * .7 * m.wind * m.back; });
      if (tail[0]) tail[0].rotation.x += -.3 * lunge;
    } else if (plan === 'ape') {
      /* both arms up over the head, then smashed down */
      const arms = rig.arms, up = m.wind * (1 - m.strike);
      arms.forEach(a => { a.sh.rotation.x += (-2.6 * up + .4 * lunge) * m.back; a.el.rotation.x += -.5 * up * m.back; a.sh.rotation.z += a.sh.position.x > 0 ? -.2 * up : .2 * up; });
      torso.rotation.x += (-.25 * up + .35 * lunge) * m.back;
      body.position.z += 7 * lunge; body.position.y -= 1.5 * lunge;
      legs.forEach((l, i) => { l.g.rotation.x += (i ? .35 : -.4) * lunge; });
    } else if (plan === 'rex') {
      torso.rotation.x += (-.18 * m.wind * (1 - m.strike) + .22 * lunge) * m.back;
      if (rig.neck) rig.neck.rotation.x += (-.3 * m.wind * (1 - m.strike) + .45 * lunge) * m.back;
      body.position.z += 9 * lunge;
      tail.forEach(g => { g.rotation.x += -.2 * lunge; });
      if (wings.length) wings.forEach(w => { w.rotation.z += w.userData.s * 1.0 * m.wind * m.back; w.rotation.y -= w.userData.s * .9 * m.wind * m.back; });
    } else if (id === 'serpent') {
      const [s0, s1, s2] = rig.segs, back = m.wind * (1 - m.strike);
      s0.rotation.x += (-.5 * back + .55 * lunge) * m.back; s1.rotation.x += (-.6 * back + .5 * lunge) * m.back; s2.rotation.x += (.5 * back - .2 * lunge) * m.back;
      body.position.z += 5 * lunge;
    } else if (id === 'crab') {
      const c = rig.claws[1], o = rig.claws[0], up = m.wind * (1 - m.strike);
      c.sh.rotation.x += (-.9 * up + .1 * lunge) * m.back; c.sh.rotation.y += -.3 * up; c.fin.rotation.x += -.7 * Math.min(1, m.w0 * 1.6) * (1 - m.strike) * m.back;
      o.sh.rotation.x += -.3 * up * m.back; body.position.z += 6 * lunge; torso.rotation.x += .1 * lunge;
    } else if (id === 'beetle') {
      torso.rotation.x += (.2 * m.wind * (1 - m.strike) - .35 * lunge) * m.back; body.position.z += -2 * m.wind + 10 * lunge;
    } else if (id === 'spider') {
      legs.slice(0, 2).forEach(l => { l.g.rotation.x += -.9 * m.wind * (1 - m.strike) * m.back; });
      torso.rotation.x += -.25 * m.wind * (1 - m.strike) * m.back + .15 * lunge; body.position.z += 11 * lunge;
      rig.fangs.forEach(f => { f.rotation.x += -.6 * m.wind * (1 - m.strike); });
    } else if (plan === 'bird') {
      wings.forEach(w => { w.rotation.z += w.userData.s * (.9 * m.wind * (1 - m.strike) - .8 * lunge); });
      torso.rotation.x += .5 * lunge; body.position.z += 12 * lunge; body.position.y += 3 * m.wind * (1 - m.strike) - 4 * lunge;
    }
    if (jaw) jaw.rotation.x += .7 * open;
    return;
  }
  if (name === 'bow' || name === 'magic') {
    /* a roar or a breath from a distance: draws back, then thrusts its head forward on the release */
    const R0 = name === 'bow' ? 1050 : 960, draw = eIO(seg(ms, 100, R0 - 80)), rel = eOut(seg(ms, R0 - 80, R0 + 60)), low = eIO(seg(ms, R0 + 450, R0 + 820));
    const back = draw * (1 - rel), push = rel * (1 - low), open = Math.max(draw * .5, push) * (1 - low);
    if (plan === 'quad' || plan === 'rex') { torso.rotation.x += (-.12 * back + .08 * push); if (rig.neck) rig.neck.rotation.x += -.35 * back + .3 * push; body.position.z += -3 * back + 3 * push; }
    if (plan === 'ape') { torso.rotation.x += -.3 * back + .15 * push; rig.arms.forEach(a => { a.sh.rotation.x += -1.1 * back - .3 * push; a.sh.rotation.z += (a.sh.position.x > 0 ? 1 : -1) * .7 * (back + push); }); }
    if (id === 'serpent') { rig.segs[0].rotation.x += -.35 * back + .3 * push; rig.segs[1].rotation.x += -.3 * back + .2 * push; }
    if (many) { torso.rotation.x += -.25 * back + .1 * push; if (rig.claws) rig.claws.forEach(c => { c.sh.rotation.x += -.9 * (back + push * .6); c.fin.rotation.x += -.6 * open; }); }
    if (plan === 'bird') { torso.position.y += 3 * back; wings.forEach(w => { w.rotation.z += w.userData.s * (1.1 * back - .6 * push); }); }
    if (wings.length && plan !== 'bird') wings.forEach(w => { w.rotation.z += w.userData.s * 1.1 * (back + push) * (1 - low); w.rotation.y -= w.userData.s * .9 * (back + push) * (1 - low); });
    if (head) head.rotation.x += -.25 * back + .12 * push;
    if (jaw) jaw.rotation.x += .85 * open;
    if (rig.tongue && id === 'serpent') rig.tongue.visible = open > .3;
    if (rig.trunk) rig.trunk.rotation.x += -1.6 * (back + push * .8);
    if (name === 'magic') flash(rig, .5 * Math.sin(Math.min(1, ms / (R0 + 200)) * PI), rig.plan === 'bird' ? 0xffb030 : 0xff7a2a);
    if (rig.fx.bolt && ms > R0 - 10 && ms < R0 + 540 && head) { const k = seg(ms, R0 - 10, R0 + 540); rig.fx.bolt.visible = true; head.updateMatrixWorld(true); const hp = head.getWorldPosition(new V3()); rig.root.worldToLocal(hp); rig.fx.bolt.position.set(hp.x, hp.y - k * 10, hp.z + 10 + k * 160); }
    return;
  }
  if (name === 'hit') {
    const k = seg(ms, 200, 260), r = seg(ms, 260, 900);
    body.position.z += -9 * eOut(k) * (1 - eIO(r));
    body.rotation.x += (plan === 'ape' || plan === 'bird' ? -.3 : -.15) * Math.sin(Math.min(1, r * 1.4) * PI);
    body.position.x += Math.sin(ms * .09) * 3 * (1 - r) * (ms > 200 ? 1 : 0);
    if (head) head.rotation.x += -.35 * Math.sin(r * PI);
    if (jaw) jaw.rotation.x += .5 * Math.sin(r * PI);
    if (rig.arms && plan === 'ape') rig.arms.forEach(a => { a.sh.rotation.z += (a.sh.position.x > 0 ? 1 : -1) * .8 * Math.sin(r * PI); });
    wings.forEach(w => { w.rotation.z += w.userData.s * .6 * Math.sin(r * PI); });
    flash(rig, ms > 200 ? 1 - seg(ms, 200, 600) : 0, 0xff3a28);
    return;
  }
  if (name === 'block') {
    const up = eOut(seg(ms, 100, 350)) * (1 - eIO(seg(ms, 850, 1200)));
    body.position.y -= 1.8 * up; body.position.z -= 2 * up;
    if (plan === 'quad') { torso.rotation.x += .1 * up; if (head) head.rotation.x += .35 * up; if (rig.neck) rig.neck.rotation.x += .2 * up; legs.forEach(l => { l.g.rotation.x += (l.f > 0 ? -.25 : .2) * up; }); }
    if (plan === 'ape') rig.arms.forEach(a => { a.sh.rotation.x += -1.5 * up; a.el.rotation.x += -1.2 * up; a.sh.rotation.z += (a.sh.position.x > 0 ? -.5 : .5) * up; });
    if (plan === 'rex' && rig.neck) rig.neck.rotation.x += -.35 * up;
    if (wings.length) wings.forEach(w => { w.rotation.z += w.userData.s * (plan === 'bird' ? .6 : 1.2) * up; w.rotation.y += w.userData.s * -1.2 * up; });
    if (rig.claws) rig.claws.forEach(c => { c.sh.rotation.x += -.7 * up; c.sh.rotation.y += (c.sh.position.x > 0 ? 1 : -1) * .5 * up; });
    if (many && !rig.claws) { torso.position.y -= 3 * up; legs.forEach(l => { l.g.rotation.z += l.s * .25 * up; }); }
    if (id === 'serpent') { rig.segs[0].rotation.x += -.4 * up; rig.segs[1].rotation.x += -.4 * up; rig.segs[2].rotation.x += .6 * up; }
    flash(rig, ms > 330 ? .5 * (1 - seg(ms, 330, 700)) : 0, 0x3d8bff);
    return;
  }
  if (name === 'dodge') {
    /* crouches and sways its whole body aside, then settles back */
    const k = eOut(seg(ms, 0, 200)) * (1 - eIO(seg(ms, 600, 1000)));
    body.rotation.z += .26 * k; body.position.y -= 2.5 * k;
    if (head) head.rotation.z += -.18 * k;
    if (wings.length) wings.forEach(w => { w.rotation.z += w.userData.s * .5 * k; });
    if (id === 'serpent') { rig.segs[0].rotation.y += .5 * k; rig.segs[1].rotation.y += -.3 * k; }
    return;
  }
  if (name === 'down') {
    const f = seg(ms, 250, 750), upp = seg(ms, 1900, 2450), k = eBack(f) * (1 - eIO(upp)), kk = Math.min(1, k);
    if (plan === 'quad' || plan === 'rex') { /* rolls onto its side, legs out */
      const a = PI / 2 * .9 * k; body.rotation.z += a; body.position.x += d.yB * Math.sin(a) * .95; body.position.y += (d.R * d.wR * .95 - d.yB * Math.cos(a)) * kk;
      legs.forEach(l => { l.g.rotation.x += (l.f > 0 ? -.3 : .3) * kk; });
      if (head) head.rotation.x += .2 * kk; if (jaw) jaw.rotation.x += .35 * kk;
      if (wings.length) wings.forEach(w => { w.rotation.z += w.userData.s * .5 * kk; });
    } else if (plan === 'ape') { /* falls on its back */
      const a = PI / 2 * .88 * k; body.rotation.x += -a; body.position.z += (d.yB + d.L * .35) * Math.sin(a) * .75; body.position.y += (d.R * .75 - d.yB * Math.cos(a)) * kk;
      if (rig.arms && plan === 'ape') rig.arms.forEach(a => { a.sh.rotation.x += -1.2 * kk; a.sh.rotation.z += (a.sh.position.x > 0 ? 1 : -1) * .6 * kk; });
      if (jaw) jaw.rotation.x += .4 * kk;
      wings.forEach(w => { w.rotation.z += w.userData.s * .6 * kk; });
    } else if (id === 'serpent') {
      rig.segs[0].rotation.x += 1.05 * kk; rig.segs[1].rotation.x += .55 * kk; rig.segs[2].rotation.x += .1 * kk;
      if (jaw) jaw.rotation.x += .5 * kk; if (rig.tongue) rig.tongue.visible = kk > .5;
    } else if (many) { /* flips onto its back, legs curled */
      const H = (rig.claws ? 10 : rig.beast === 'beetle' ? 15 : 16);
      body.rotation.z += PI * .96 * k; body.position.y += H * kk;
      legs.forEach((l, i) => { l.g.rotation.x += Math.sin(t / 140 + i) * .1 * kk * (ms < 1800 ? 1 : 0); });
    } else if (plan === 'bird') {
      torso.position.y += -20 * kk; torso.rotation.z += .9 * kk; wings.forEach(w => { w.rotation.z += w.userData.s * -.6 * kk; });
      if (rig.fire) rig.fire.scale.multiplyScalar(Math.max(.05, 1 - kk * .95));
    }
    flash(rig, ms > 200 ? 1 - seg(ms, 200, 500) : 0, 0xff2a4a);
    return;
  }
}
return {BEASTS, LIST, build, pose, isBeast, beastOf, defaultSpec, randomSpec, flash};
}
