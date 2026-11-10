/* Norne toy figures: every figure is built from parts in code, except the hairstyles, which are small models
   made by 3D artists (art/hair/, see loadHair). buildFigure(spec) -> rig; animate(rig, name, ms) poses it.
   A spec is small JSON {race, body, skin, eyes, hair, hairCol, beard, outfit, cloth, hood?, len?} plus the head's parts
   {headSize, headShape, jaw, eyeShape, eyeSize, brows, nose, mouth, expr, marks[]} (faceFix fills any left out).
   (len 0..1 = Short / Medium / Long, see HAIR_LEN). Load the hairstyle first (loadHair(spec.hair)), then build.
   Loaded as a module by js/figures.js, only when the maker opens. */
import {makeBeasts} from './beastkit.js';
export function makeKit(THREE){
const V3 = THREE.Vector3, TAU = Math.PI * 2, PI = Math.PI, DEG = PI / 180;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v)), lerp = (a, b, u) => a + (b - a) * u;
const sstep = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
const wrapA = a => { a = (a + PI) % TAU; if (a < 0) a += TAU; return a - PI; };
const tri = x => 1 - Math.abs(2 * (x - Math.floor(x)) - 1);

/* colours, worked in sRGB like the canvas */
const hx = h => { h = String(h).replace('#', ''); return [0, 2, 4].map(i => parseInt(h.substr(i, 2), 16)); };
const toHex = a => '#' + a.map(v => clamp(Math.round(v), 0, 255).toString(16).padStart(2, '0')).join('');
const shade = (h, k) => toHex(hx(h).map(v => v * k));
const mix = (a, b, k) => { const A = hx(a), B = hx(b); return toHex(A.map((v, i) => lerp(v, B[i], k))); };
const lum = h => { const [r, g, b] = hx(h); return (.299 * r + .587 * g + .114 * b) / 255; };
const lighten = (h, k) => lum(h) < .16 ? mix(h, '#9aa8c8', k * 1.1) : mix(h, '#ffffff', k);

/* ---------- ink outlines: a back-facing shell pushed out along smoothed normals ---------- */
const INK = new THREE.MeshBasicMaterial({color:0x1d130b, side:THREE.BackSide});
INK.onBeforeCompile = sh => {
  sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nattribute vec3 onormal;')
    .replace('#include <begin_vertex>', 'vec3 transformed = vec3(position) + onormal;');
};
function setInk(geo, t){
  const pos = geo.attributes.position, nor = geo.attributes.normal, n = pos.count, map = new Map(), sum = [], idx = new Int32Array(n);
  for (let i = 0; i < n; i++) {
    const k = Math.round(pos.getX(i) * 40) + ',' + Math.round(pos.getY(i) * 40) + ',' + Math.round(pos.getZ(i) * 40);
    let j = map.get(k); if (j === undefined) { j = sum.length; map.set(k, j); sum.push(new V3()); }
    idx[i] = j; sum[j].x += nor.getX(i); sum[j].y += nor.getY(i); sum[j].z += nor.getZ(i);
  }
  sum.forEach(v => v.lengthSq() > 1e-12 ? v.normalize() : v.set(0, 0, 0));
  const on = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) { const v = sum[idx[i]]; on[i * 3] = v.x * t; on[i * 3 + 1] = v.y * t; on[i * 3 + 2] = v.z * t; }
  geo.setAttribute('onormal', new THREE.BufferAttribute(on, 3));
  return geo;
}
function inked(geo, mat, t = .6){
  if (!geo.attributes.normal) geo.computeVertexNormals();
  setInk(geo, t);
  const g = new THREE.Group(), m = new THREE.Mesh(geo, mat), o = new THREE.Mesh(geo, INK);
  g.add(o, m); g.userData.m = m; return g;
}
const grad = new THREE.DataTexture(new Uint8Array([110, 110, 110, 255, 185, 185, 185, 255, 255, 255, 255, 255]), 3, 1);
grad.minFilter = grad.magFilter = THREE.NearestFilter; grad.needsUpdate = true;
/* faces get soft shading instead of the bands the rest of the figure has */
const SOFT = new THREE.DataTexture(new Uint8Array([150, 150, 150, 255, 182, 182, 182, 255, 212, 212, 212, 255, 236, 236, 236, 255, 255, 255, 255, 255]), 5, 1);
SOFT.minFilter = SOFT.magFilter = THREE.LinearFilter; SOFT.needsUpdate = true;
const toon = (c, o) => o && o.std ? new THREE.MeshStandardMaterial((({std, ...r}) => Object.assign({color:c, roughness:.6, metalness:0}, r))(o)) : new THREE.MeshToonMaterial(Object.assign({color:c, gradientMap:grad}, o || {}));
/* an ink outline in a colour of its own (hair gets a dark shade of the hair, not black) */
const inkOf = hex => { const m = new THREE.MeshBasicMaterial({color:hex, side:THREE.BackSide}); m.onBeforeCompile = INK.onBeforeCompile; return m; };
const at = (o, x, y, z) => { o.position.set(x, y, z); return o; };
const rot = (o, x, y, z) => { o.rotation.set(x, y, z); return o; };
function canvas(w, h){ const c = document.createElement('canvas'); c.width = w; c.height = h; return c; }
function ctex(cv, rep){ const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; if (rep) { t.wrapS = t.wrapT = THREE.RepeatWrapping; } return t; }
function radial(stops){
  const cv = canvas(64, 64), x = cv.getContext('2d'), g = x.createRadialGradient(32, 32, 0, 32, 32, 32);
  stops.forEach(([o, c]) => g.addColorStop(o, c)); x.fillStyle = g; x.fillRect(0, 0, 64, 64);
  return new THREE.CanvasTexture(cv);
}
const GLOW = radial([[0, 'rgba(255,255,255,1)'], [.35, 'rgba(255,255,255,.5)'], [1, 'rgba(255,255,255,0)']]);
const SHADOW = radial([[0, 'rgba(0,0,0,.55)'], [.55, 'rgba(0,0,0,.3)'], [1, 'rgba(0,0,0,0)']]);
/* metal: a stepped matcap, so armour reads as shiny toy metal from every side */
const capCache = new Map();
function metalCap(hex){
  if (capCache.has(hex)) return capCache.get(hex);
  const cv = canvas(128, 128), x = cv.getContext('2d');
  x.fillStyle = shade(hex, .42); x.fillRect(0, 0, 128, 128);
  const disc = (cx, cy, r, c) => { x.fillStyle = c; x.beginPath(); x.ellipse(cx, cy, r, r, 0, 0, TAU); x.fill(); };
  disc(64, 64, 63, shade(hex, .55)); disc(60, 58, 54, shade(hex, .8)); disc(55, 50, 40, hex);
  x.fillStyle = mix(hex, '#ffffff', .55); x.beginPath(); x.ellipse(46, 40, 24, 15, -.6, 0, TAU); x.fill();
  disc(40, 34, 7, '#ffffff');
  x.strokeStyle = mix(hex, '#ffffff', .35); x.lineWidth = 5; x.beginPath(); x.arc(64, 64, 57, .25, 1.25); x.stroke();
  const t = ctex(cv); capCache.set(hex, t); return t;
}

/* ---------- geometry builders ---------- */
/* a surface from fn(u, v, off, out): off 0 is the outside, -1 the inside, +1 only says which way is out.
   o.thick closes it into a thin solid (outside, inside and rims) so outlines and hems read right. */
function surface(nu, nv, fn, o = {}){
  const P = [], UV = [], I = [], I2 = [], cols = nu + 1, a = new V3(), b = new V3(), r = new V3();
  const A = new V3(), B = new V3(), C = new V3(), Q = new V3(), n = new V3();
  const add = (p, u, v) => { P.push(p.x, p.y, p.z); UV.push(u, v); return P.length / 3 - 1; };
  const get = (i, v) => v.set(P[i * 3], P[i * 3 + 1], P[i * 3 + 2]);
  const face = (out, i0, i1, i2, i3, ref) => {
    get(i0, A); get(i1, B); get(i2, C); get(i3, Q);
    n.subVectors(Q, A).cross(C.sub(B));
    if (n.dot(ref) >= 0) out.push(i0, i1, i3, i0, i3, i2); else out.push(i0, i3, i1, i0, i2, i3);
  };
  const refAt = (u, v, sg) => { fn(u, v, 1, a); fn(u, v, 0, b); return r.subVectors(a, b).multiplyScalar(sg); };
  const us = o.us || 1, vs = o.vs || 1;
  const sheet = (off, sg, out) => {
    const base = P.length / 3;
    for (let j = 0; j <= nv; j++) for (let i = 0; i <= nu; i++) { fn(i / nu, j / nv, off, a); add(a, i / nu * us, j / nv * vs); }
    for (let j = 0; j < nv; j++) for (let i = 0; i < nu; i++) { const q = base + j * cols + i; face(out, q, q + 1, q + cols, q + cols + 1, refAt((i + .5) / nu, (j + .5) / nv, sg)); }
    return base;
  };
  const ob = sheet(0, 1, I); let ib = -1;
  if (o.thick) {
    ib = sheet(-1, -1, I2);
    const dup = i => add(get(i, a), UV[i * 2], UV[i * 2 + 1]);
    const edgeRef = (u, v, du, dv) => { fn(u, v, 0, a); fn(u - du, v - dv, 0, b); return r.subVectors(a, b); };
    const rim = (pairs, refFn) => { for (let k = 0; k < pairs.length - 1; k++) {
      const o1 = dup(pairs[k][0]), o2 = dup(pairs[k + 1][0]), n1 = dup(pairs[k][1]), n2 = dup(pairs[k + 1][1]); face(I, o1, o2, n1, n2, refFn(k)); } };
    const row = j => [...Array(cols).keys()].map(i => [ob + j * cols + i, ib + j * cols + i]);
    const col = i => [...Array(nv + 1).keys()].map(j => [ob + j * cols + i, ib + j * cols + i]);
    if (!o.open1) rim(row(nv), k => edgeRef((k + .5) / nu, 1, 0, 1 / nv));
    if (!o.open0) rim(row(0), k => edgeRef((k + .5) / nu, 0, 0, -1 / nv));
    if (!o.wrap) { rim(col(0), k => edgeRef(0, (k + .5) / nv, -1 / nu, 0)); rim(col(nu), k => edgeRef(1, (k + .5) / nv, 1 / nu, 0)); }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(UV, 2));
  g.setIndex(I.concat(I2));
  if (I2.length) { g.addGroup(0, I.length, 0); g.addGroup(I.length, I2.length, 1); }
  g.computeVertexNormals();
  if (o.wrap) { const nr = g.attributes.normal; [ob, ib].filter(x => x >= 0).forEach(base => { for (let j = 0; j <= nv; j++) {
    const i0 = base + j * cols, i1 = i0 + nu, x = nr.getX(i0) + nr.getX(i1), y = nr.getY(i0) + nr.getY(i1), z = nr.getZ(i0) + nr.getZ(i1), l = Math.hypot(x, y, z) || 1;
    nr.setXYZ(i0, x / l, y / l, z / l); nr.setXYZ(i1, x / l, y / l, z / l); } }); }
  return g;
}
/* a lock, braid strand or snake: a tube along points; prof(t) -> [half width, half thickness]; up(p, t, out) says which way is "out" */
function tube(pts, prof, up, o = {}){
  const cv = new THREE.CatmullRomCurve3(pts, false, 'centripetal');
  const nS = o.nS || 16, nR = o.nR || 8, cols = nR + 1, P = [], UV = [], I = [];
  const p = new V3(), T = new V3(), U = new V3(), N = new V3(), B = new V3(), lastN = new V3(0, 0, 1), C = [], SC = [], SK = [], sid = o.soft ? o.soft.id || ++softIds : 0;
  for (let s = 0; s <= nS; s++) {
    const t = s / nS; cv.getPointAt(t, p); cv.getTangentAt(t, T);
    up(p, t, U); N.copy(U).addScaledVector(T, -U.dot(T));
    if (N.lengthSq() < 1e-8) N.copy(lastN); N.normalize(); lastN.copy(N);
    B.crossVectors(T, N).normalize();
    const [w, h] = prof(t); C.push([p.clone(), T.clone(), Math.max(w, h)]);
    for (let k = 0; k <= nR; k++) { const an = k / nR * TAU, ca = Math.cos(an), sa = Math.sin(an), e = o.sq || 1, c = Math.sign(ca) * Math.pow(Math.abs(ca), e) * w, sn = Math.sign(sa) * Math.pow(Math.abs(sa), e) * h;
      P.push(p.x + B.x * c + N.x * sn, p.y + B.y * c + N.y * sn, p.z + B.z * c + N.z * sn); UV.push(k / nR, t); if (o.soft) { SC.push(p.x, p.y, p.z, o.soft.r || Math.max(w, h)); SK.push(sid, (o.soft.ring || 0) + s, o.soft.follow ? 1 : 0); } }
  }
  for (let s = 0; s < nS; s++) for (let k = 0; k < nR; k++) { const a = s * cols + k; I.push(a, a + cols + 1, a + 1, a, a + cols, a + cols + 1); }
  const cap = (s, sign) => { const [c, , r] = C[s], ci = P.length / 3; P.push(c.x, c.y, c.z); UV.push(.5, s / nS); if (o.soft) { SC.push(c.x, c.y, c.z, o.soft.r || r); SK.push(sid, (o.soft.ring || 0) + s, o.soft.follow ? 1 : 0); }
    for (let k = 0; k < nR; k++) { const a = s * cols + k; if (sign < 0) I.push(ci, a + 1, a); else I.push(ci, a, a + 1); } };
  cap(0, -1); const [w1] = prof(1); if (w1 > .02) cap(nS, 1);
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(UV, 2));
  g.setIndex(I); g.computeVertexNormals(); if (o.soft) { g.setAttribute('sc', new THREE.Float32BufferAttribute(SC, 4)); g.setAttribute('sk', new THREE.Float32BufferAttribute(SK, 3)); g.userData.softId = sid; }
  const nr = g.attributes.normal;
  for (let s = 0; s <= nS; s++) { const i0 = s * cols, i1 = i0 + nR, x = nr.getX(i0) + nr.getX(i1), y = nr.getY(i0) + nr.getY(i1), z = nr.getZ(i0) + nr.getZ(i1), l = Math.hypot(x, y, z) || 1;
    nr.setXYZ(i0, x / l, y / l, z / l); nr.setXYZ(i1, x / l, y / l, z / l); }
  return g;
}
function merge(list){
  list = list.filter(Boolean); if (!list.length) return null;
  let nv = 0, ni = 0; list.forEach(g => { nv += g.attributes.position.count; ni += g.index ? g.index.count : g.attributes.position.count; });
  const pos = new Float32Array(nv * 3), nor = new Float32Array(nv * 3), uv = new Float32Array(nv * 2), idx = new Uint32Array(ni);
  const sc = list.some(g => g.attributes.sc) ? new Float32Array(nv * 4) : null, sk = sc && new Float32Array(nv * 3);
  let ov = 0, oi = 0;
  list.forEach(g => { const c = g.attributes.position.count; pos.set(g.attributes.position.array, ov * 3);
    if (sc) { if (g.attributes.sc) { sc.set(g.attributes.sc.array, ov * 4); sk.set(g.attributes.sk.array, ov * 3); } else for (let i = 0; i < c; i++) sc[(ov + i) * 4 + 3] = -1; }
    if (!g.attributes.normal) g.computeVertexNormals(); nor.set(g.attributes.normal.array, ov * 3);
    if (g.attributes.uv) uv.set(g.attributes.uv.array, ov * 2);
    if (g.index) { const a = g.index.array; for (let i = 0; i < a.length; i++) idx[oi + i] = a[i] + ov; oi += a.length; }
    else { for (let i = 0; i < c; i++) idx[oi + i] = ov + i; oi += c; }
    ov += c; g.dispose(); });
  const m = new THREE.BufferGeometry();
  m.setAttribute('position', new THREE.BufferAttribute(pos, 3)); m.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
  m.setAttribute('uv', new THREE.BufferAttribute(uv, 2)); m.setIndex(new THREE.BufferAttribute(idx, 1)); if (sc) { m.setAttribute('sc', new THREE.BufferAttribute(sc, 4)); m.setAttribute('sk', new THREE.BufferAttribute(sk, 3)); } return m;
}
let softIds = 0;
const xf = (geo, pos, q, s) => geo.applyMatrix4(new THREE.Matrix4().compose(pos, q || new THREE.Quaternion(), s || new V3(1, 1, 1)));

/* ---------- the parts lists ---------- */
const HAIRC = [
  ['black', 'Black', '#1f1a1a'], ['dark', 'Dark brown', '#3e2a1d'], ['brown', 'Brown', '#6b4629'], ['auburn', 'Auburn', '#8a3b22'],
  ['red', 'Red', '#b9472a'], ['copper', 'Copper', '#c7743a'], ['blond', 'Blond', '#e0be72'], ['platinum', 'Platinum', '#efe5c6'],
  ['grey', 'Grey', '#9a9a9a'], ['white', 'White', '#f2f0ea'], ['moss', 'Moss green', '#4f7a3a'], ['night', 'Night blue', '#2e3f7a'],
];
const EYES = [
  ['blue', 'Blue', '#4f86c6'], ['brown', 'Brown', '#5a3820'], ['green', 'Green', '#4f9a4a'], ['silver', 'Silver', '#c9d2dc'],
  ['grey', 'Grey', '#7d8794'], ['amber', 'Amber', '#e0a020'], ['red', 'Red', '#d23a3a'], ['violet', 'Violet', '#8a5ad0'],
];
const CLOTH = [
  ['crimson', 'Crimson', '#9e2b2b'], ['rust', 'Rust', '#b5562a'], ['ochre', 'Ochre', '#c4952f'], ['forest', 'Forest', '#3f6b3a'],
  ['moss', 'Moss', '#6f7f3a'], ['teal', 'Teal', '#2f6f6f'], ['royal', 'Royal blue', '#2f4f9e'], ['navy', 'Navy', '#24305e'],
  ['violet', 'Violet', '#5e3f8f'], ['plum', 'Plum', '#6f2f55'], ['charcoal', 'Charcoal', '#38383f'], ['linen', 'Linen', '#d9cfb8'],
];
/* heads: size, shape and jaw (Jack's reference sheet, 2026-11-08). Shape scales the whole head and what sits on it;
   the jaw pulls the lower face in, out or down (headWarp). Beast heads (snouts, beaks) keep a round jaw. */
const HEAD_SIZES = [['s', 'Small', .9], ['m', 'Medium', 1], ['l', 'Large', 1.1]];
const HEAD_SHAPES = [['round', 'Round', [1, 1, 1]], ['tall', 'Tall', [.96, 1.07, .99]], ['wide', 'Wide', [1.1, .96, 1.02]]];
const JAWS = [
  ['soft', 'Soft', {jaw:.17, chin:.07, cheek:.02}],
  ['round', 'Round', {jaw:0, chin:-.03, cheek:.09}],
  ['pointed', 'Pointed', {jaw:.3, chin:.16, narrow:1}],
  ['heart', 'Heart', {jaw:.27, chin:.1, cheek:.1, narrow:1}],
  ['square', 'Square', {jaw:.03, sq:.12, chin:.03, line:1}],
  ['strong', 'Strong', {sq:.17, chin:.1, fwd:.06, line:1}],
];
/* faces: eye shape, eye size, brows, nose, mouth, marks and an expression, drawn on a sheet over the front of the head (faceSheet).
   Units: 1 = the head's radius, seen from the front, +x the figure's left, +y up. */
const EYE_SHAPES = [
  ['soft', 'Soft', {w:.215, h:.18, tilt:.1, up:1.25, low:.85, lash:1}],
  ['round', 'Round', {w:.2, h:.21, tilt:0, up:1.2, low:1, lash:.9}],
  ['narrow', 'Narrow', {w:.22, h:.11, tilt:.08, up:1.15, low:.75, lash:1.1}],
  ['sharp', 'Sharp', {w:.22, h:.135, tilt:.5, up:1.2, low:.6, lash:1.3, wing:1}],
  ['droopy', 'Droopy', {w:.21, h:.16, tilt:-.4, up:1.3, low:.8, lash:1}],
  ['lashes', 'Lashes', {w:.21, h:.18, tilt:.18, up:1.25, low:.85, lash:1.15, wing:.6, lashes:1}],
  ['dot', 'Dots', {dot:1, w:.06, h:.08}],
];
const EYE_SIZES = [['s', 'Small', .84], ['m', 'Medium', 1], ['l', 'Large', 1.16]];
const BROWS = [['thin', 'Thin'], ['thick', 'Thick'], ['arched', 'Arched'], ['short', 'Short'], ['none', 'None']];
const NOSES = [['none', 'None'], ['hint', 'Hint'], ['small', 'Small']];
const MOUTHS = [['small', 'Small'], ['wide', 'Wide'], ['full', 'Full'], ['cat', 'Cat']];
/* lid: upper lid down (0 open, 1 shut), lidI / lidO: more at the inner / outer end, low: lower lid up, wide: opened wider,
   closed: 'up' (happy arcs) or 'down' (calm, lashes down), dot: shrunk to dots, pupil: size, look / lookY: where the eyes look,
   brow: + frowning, - worried, raise: brows up, browOne: one brow up, then the mouth's pose and blush, bags, sweat */
const EXPRS = [
  ['calm', 'Calm', {lid:.12, mouth:'line'}],
  ['smile', 'Smile', {lid:.06, low:.18, mouth:'smile'}],
  ['happy', 'Happy', {closed:'up', mouth:'smile', blush:.5}],
  ['laugh', 'Laughing', {closed:'up', mouth:'open', blush:.6, raise:.3}],
  ['grin', 'Grin', {low:.15, mouth:'grin', raise:.2}],
  ['surprised', 'Surprised', {wide:1.18, pupil:.72, raise:1, mouth:'o'}],
  ['shocked', 'Shocked', {dot:1, raise:1.2, mouth:'O'}],
  ['angry', 'Angry', {lid:.16, lidI:.38, brow:1, mouth:'frown'}],
  ['glare', 'Glare', {lid:.4, lidI:.16, brow:.7, look:.75, mouth:'flat'}],
  ['fierce', 'Fierce', {lidI:.28, brow:1.2, mouth:'teeth'}],
  ['sad', 'Sad', {lid:.22, lidO:.32, brow:-1, lookY:-.35, mouth:'frown'}],
  ['worried', 'Worried', {brow:-.85, raise:.3, mouth:'wavy', sweat:1}],
  ['tired', 'Tired', {lid:.46, bags:1, brow:-.2, mouth:'flat'}],
  ['sleepy', 'Sleepy', {lid:.74, brow:-.15, mouth:'small'}],
  ['smug', 'Smug', {lid:.42, low:.12, browOne:1, mouth:'smirk'}],
  ['shy', 'Shy', {lid:.1, look:-.8, lookY:-.25, brow:-.45, blush:1, mouth:'small'}],
  ['serene', 'Serene', {closed:'down', mouth:'smile', blush:.35}],
];
/* not in the list: the face a figure pulls while it is hit or knocked down */
const HURT = {closed:'squeeze', brow:.8, mouth:'teeth'};
const MARKS = [['blush', 'Blush'], ['freckles', 'Freckles'], ['bags', 'Eye bags'], ['lipstick', 'Lipstick'], ['mole', 'Beauty mark'], ['scar', 'Scar']];
/* looks saved before heads had parts used one of six faces: each becomes eyes, brows and an expression */
const OLD_FACE = {kind:{eyeShape:'soft', expr:'smile'}, bright:{eyeShape:'round', expr:'grin'}, stern:{eyeShape:'narrow', expr:'calm', brows:'thick'},
  sly:{eyeShape:'sharp', expr:'smug'}, fierce:{eyeShape:'sharp', expr:'fierce', brows:'thick'}, weary:{eyeShape:'droopy', expr:'tired'}};
const RACE_JAW = {Human:'soft', 'Half-Elf':'soft', Elf:'pointed', Dwarf:'square', Gnome:'round', Goblin:'pointed', Centaur:'soft', Vampire:'pointed', Gorgon:'heart', Satyr:'soft', Ogre:'strong'};
/* fill in the head and face parts a look leaves out (older saved looks, race defaults) */
function faceFix(spec){
  if (spec.beast) return spec;
  const o = OLD_FACE[spec.face] || OLD_FACE.kind, has = (list, v) => list.some(x => x[0] === v);
  if (!has(HEAD_SIZES, spec.headSize)) spec.headSize = 'm';
  if (!has(HEAD_SHAPES, spec.headShape)) spec.headShape = 'round';
  if (!has(JAWS, spec.jaw)) spec.jaw = RACE_JAW[spec.race] || 'soft';
  if (!has(EYE_SHAPES, spec.eyeShape)) spec.eyeShape = o.eyeShape;
  if (!has(EYE_SIZES, spec.eyeSize)) spec.eyeSize = 'm';
  if (!has(BROWS, spec.brows)) spec.brows = o.brows || (spec.body === 'f' ? 'thin' : 'thick');
  if (!has(NOSES, spec.nose)) spec.nose = 'hint';
  if (!has(MOUTHS, spec.mouth)) spec.mouth = 'small';
  if (!has(EXPRS, spec.expr)) spec.expr = o.expr;
  spec.marks = Array.isArray(spec.marks) ? spec.marks.filter(m => has(MARKS, m)) : [];
  return spec;
}
/* Bald and Hairstyles 1-27 (models, see loadHair). Old saved looks used named styles: hairId turns them into the nearest number. */
const HAIR_N = 27, HAIRS = [['bald', 'Bald'], ...Array.from({length:HAIR_N}, (_, i) => ['h' + (i + 1), String(i + 1)])], HAIR_IDS = new Set(HAIRS.slice(1).map(h => h[0]));
const OLD_HAIR = {short:'h19', swept:'h21', bob:'h2', long:'h3', ponytail:'h6', bun:'h25', braids:'h9', mohawk:'h16', curly:'h12'};
const hairId = h => OLD_HAIR[h] || (h === 'bald' || HAIR_IDS.has(h) ? h : 'bald');
/* styles with a Short / Medium / Long setting (spec.len 0, .5, 1) and what it is called: hair that hangs, and the crests (Height) */
const HAIR_LEN = Object.fromEntries([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 14, 23].map(i => ['h' + i, 'Length']).concat([15, 16, 17, 18].map(i => ['h' + i, 'Height'])));
const BEARDS = [['none', 'None'], ['stubble', 'Stubble'], ['moustache', 'Moustache'], ['short', 'Short'], ['long', 'Long'], ['braided', 'Braided']];
const LEATHER = '#6b4423', DLEATHER = '#3f2817', STEEL = '#b9c3cd', IRON = '#7a828e', GOLD = '#e0ad3e', LINEN = '#e9e0c9';
const OUTFITS = [
  ['commoner', 'Commoner', {cloth:'moss'}],
  ['traveller', 'Traveller', {cloth:'ochre', hood:'down'}],
  ['noble', 'Noble', {cloth:'royal'}],
  ['mage', 'Mage robe', {cloth:'violet'}],
  ['priest', 'Priest', {cloth:'crimson'}],
  ['leather', 'Leather armour', {cloth:'rust'}],
  ['hunter', 'Hunter', {cloth:'forest', hood:'up'}],
  ['rogue', 'Rogue', {cloth:'charcoal', hood:'up'}],
  ['mail', 'Chainmail', {cloth:'navy'}],
  ['plate', 'Plate armour', {cloth:'crimson'}],
  ['barbarian', 'Barbarian', {cloth:'rust'}],
  ['sailor', 'Sailor', {cloth:'navy'}],
];

/* Humans' four peoples come from the lore (wiki: Humans). Other races have no looks in the lore yet:
   these are the usual fantasy looks, for Jake to change. */
const P = (n, c, eye, hair) => ({n, c, eye, hair});
const RACES = {
  'Human':     {h:1, w:1, head:1, ears:'round', skins:[P('Altarian', '#f0d2b6', 'blue', 'blond'), P('Daroese', '#7a4b30', 'brown', 'dark'), P('Tafagür', '#c39a6b', 'green', 'dark'), P('Darioli', '#3a2924', 'silver', 'black')], def:{hair:'short', face:'kind', outfit:'commoner'}, lore:1},
  'Half-Elf':  {h:1, w:.96, head:1, ears:'pointy', skins:[P('Fair', '#f0d6bf'), P('Tan', '#d2a77e'), P('Bronze', '#a6754e'), P('Deep', '#5e3d2a')], eye:'green', hairC:'auburn', def:{hair:'long', face:'bright', outfit:'traveller'}},
  'Elf':       {h:1.06, w:.9, head:.98, ears:'long', skins:[P('Moon', '#f4e6dc'), P('Fair', '#ecd2bb'), P('Golden', '#d9b07a'), P('Dusk', '#8a6a5a')], eye:'violet', hairC:'platinum', def:{hair:'long', face:'stern', outfit:'hunter'}},
  'Dwarf':     {h:.74, w:1.18, head:1.04, ears:'round', skins:[P('Ruddy', '#e6b896'), P('Fair', '#f0d0b4'), P('Tan', '#c4926a'), P('Deep', '#7a4e34')], eye:'brown', hairC:'copper', def:{hair:'braids', beard:'long', face:'stern', outfit:'mail'}},
  'Gnome':     {h:.66, w:.95, head:1.08, ears:'pointy', nose:true, skins:[P('Fair', '#f2d4bc'), P('Rosy', '#eab8a0'), P('Tan', '#cfa07a'), P('Brown', '#8a5e40')], eye:'blue', hairC:'white', def:{hair:'curly', beard:'short', face:'bright', outfit:'commoner'}},
  'Goblin':    {h:.7, w:.9, head:1.06, ears:'goblin', skins:[P('Leaf', '#86ad4c'), P('Moss', '#5d8a3a'), P('Olive', '#9aa45a'), P('Swamp', '#56704a')], eye:'amber', hairC:'black', def:{hair:'mohawk', face:'sly', outfit:'rogue'}},
  'Centaur':   {h:1, w:1, head:1, ears:'pointy', lower:'horse', skins:[P('Fair', '#ecd0b6'), P('Tan', '#c9996e'), P('Bronze', '#9a6a44'), P('Deep', '#5a3a28')], eye:'brown', hairC:'brown', coat:true, def:{hair:'ponytail', face:'stern', outfit:'hunter'}},
  'Werewolf':  {h:1.06, w:1.1, head:1.02, ears:'wolf', beast:'wolf', nohair:true, skins:[P('Brown fur', '#6b5444'), P('Grey fur', '#8a8a8c'), P('Black fur', '#3a3433'), P('Tawny fur', '#a7804f')], eye:'amber', hairC:'dark', def:{face:'fierce', outfit:'leather'}},
  'Vampire':   {h:1.02, w:.94, head:1, ears:'pointy', fangs:true, skins:[P('Pale', '#ece6ea'), P('Ashen', '#d4cdd6'), P('Grey', '#b9b4c2'), P('Dusky', '#8f7f88')], eye:'red', hairC:'black', def:{hair:'swept', face:'sly', outfit:'noble'}},
  'Gorgon':    {h:1, w:.96, head:1, ears:'none', lower:'serpent', snakes:true, nohairStyle:true, skins:[P('Jade', '#7aa67a'), P('Teal', '#5f9a92'), P('Olive', '#9a9a5a'), P('Bronze', '#a8865a')], eye:'amber', hairC:'moss', def:{face:'sly', outfit:'mage'}, lore:1},
  'Bugfolk':   {h:.96, w:1, head:1, ears:'none', beast:'bug', nohair:true, skins:[P('Beetle green', '#3f6b4a'), P('Amber shell', '#8a5a2a'), P('Blue shell', '#33507a'), P('Black shell', '#2c2a30')], eye:'violet', hairC:'black', def:{face:'stern', outfit:'leather'}},
  'Kenku':     {h:.9, w:.92, head:1, ears:'none', beast:'bird', nohair:true, skins:[P('Sparrow', '#6a5040'), P('Raven', '#2c2c36'), P('Dove', '#9a9aa4'), P('Jay', '#3a5a8a')], eye:'amber', hairC:'black', def:{face:'sly', outfit:'traveller'}},
  'Fishfolk':  {h:.98, w:1, head:1.02, ears:'fins', beast:'fish', nohair:true, skins:[P('Sea blue', '#5f8fb0'), P('Teal', '#4f9c8f'), P('Carp', '#d08a4a'), P('Deep', '#3a4f7a')], eye:'green', hairC:'teal', def:{face:'kind', outfit:'sailor'}},
  'Satyr':     {h:.96, w:1, head:1, ears:'goat', horns:true, lower:'goat', skins:[P('Fair', '#efd2b8'), P('Tan', '#cf9f76'), P('Bronze', '#a06e48'), P('Deep', '#5e3c2a')], eye:'amber', hairC:'brown', coat:true, def:{hair:'curly', beard:'short', face:'bright', outfit:'commoner'}},
  'Lizardfolk':{h:1.03, w:1.04, head:1, ears:'none', beast:'lizard', nohair:true, tail:true, skins:[P('Green', '#6a8f3f'), P('Sand', '#a8945a'), P('Teal', '#4f7f6f'), P('Red', '#9a4f3a')], eye:'amber', hairC:'ochre', def:{face:'fierce', outfit:'leather'}},
  'Ogre':      {h:1.24, w:1.34, head:1.14, ears:'round', tusks:true, skins:[P('Grey green', '#8f9a76'), P('Stone', '#a0927e'), P('Mud', '#8a7258'), P('Moss', '#6f8a5a')], eye:'brown', hairC:'black', def:{hair:'bald', face:'fierce', outfit:'barbarian'}},
};
const RACE_LIST = Object.keys(RACES);
const pick = (list, id) => (list.find(x => x[0] === id) || list[0]);

function defaultSpec(race, body){
  const R = RACES[race] || RACES.Human, s0 = R.skins[0], d = R.def;
  return faceFix({race, body:body || 'm', skin:0, face:d.face, eyes:s0.eye || R.eye || 'brown', hair:R.nohair || R.nohairStyle ? 'bald' : hairId(d.hair),
    hairCol:s0.hair || R.hairC || 'brown', beard:body === 'f' ? 'none' : d.beard || 'none', outfit:d.outfit, cloth:pick(OUTFITS, d.outfit)[2].cloth});
}
/* a random look for a fighter with no card (one-off NPCs, Jack 2026-11-08): the race stays as given, and a human's hair and
   eye colour come with their people (lore), like picking a people in the maker */
function randomSpec(race, rnd = Math.random){
  const bk = BK.beastOf(race); if (bk) return BK.randomSpec(bk, rnd);
  const one = a => a[Math.floor(rnd() * a.length)], R = RACES[race] ? race : 'Human', r = RACES[R], body = rnd() < .5 ? 'f' : 'm', s = defaultSpec(R, body);
  s.skin = Math.floor(rnd() * r.skins.length); const p = r.skins[s.skin];
  s.eyes = p.eye || (R === 'Human' ? s.eyes : one(EYES)[0]); s.hairCol = p.hair || (R === 'Human' || r.hairC ? s.hairCol : one(HAIRC)[0]);
  if (!r.nohair && !r.nohairStyle) { s.hair = rnd() < .08 ? 'bald' : one(HAIRS.slice(1))[0]; s.len = one([0, .5, .5, 1]); }
  s.beard = body === 'm' && !r.nohair && !r.snakes && rnd() < .45 ? one(BEARDS.slice(1))[0] : 'none';
  const o = one(OUTFITS); s.outfit = o[0]; s.cloth = rnd() < .5 ? o[2].cloth : one(CLOTH)[0]; delete s.hood;
  s.headSize = one(['s', 'm', 'm', 'l']); s.headShape = one(HEAD_SHAPES)[0]; s.jaw = one(JAWS)[0];
  s.eyeShape = one(EYE_SHAPES.slice(0, -1))[0]; s.eyeSize = one(['s', 'm', 'm', 'l']); s.brows = one(BROWS.slice(0, -1))[0];
  s.nose = one(NOSES)[0]; s.mouth = one(MOUTHS)[0]; s.expr = one(['calm', 'calm', 'smile', 'grin', 'angry', 'glare', 'fierce', 'smug', 'tired', 'worried']);
  s.marks = rnd() < .35 ? [one(MARKS.filter(m => body === 'f' || m[0] !== 'lipstick'))[0]] : [];
  delete s.face; return faceFix(s);
}
const hoodOf = spec => { const o = pick(OUTFITS, spec.outfit)[2]; return o.hood ? (spec.hood === 'up' || spec.hood === 'down' ? spec.hood : o.hood) : null; };

/* ---------- hair: models made by 3D artists (art/hair/, credits in CREDITS.md and art/hair/README.md) ----------
   Hairstyles 1-27 are the ones Jack picked (2026-11-08) from the Mozilla Hubs avatar kit (CC0) and the Decentraland avatar kit
   (Apache 2.0). Each was fitted offline onto a head of radius 1 at 0 (+z the face, +y up) and packed small (hN.bin: positions,
   UVs and normals as integers), with a greyscale shade picture the hair colour tints (hN.jpg) and for some a bumps picture (hN-n.jpg).
   A model loads the first time its style is used (loadHair), so the maker waits for it before it builds the figure. */
let hairBase = (() => { try { return new URL('../art/hair/', import.meta.url).href; } catch (e) { return 'art/hair/'; } })();
const setHairBase = u => { hairBase = u; };
const hairLoads = new Map(), hairReady = new Map();
function loadHair(id){
  id = hairId(id); if (!HAIR_IDS.has(id)) return Promise.resolve(null);
  if (hairLoads.has(id)) return hairLoads.get(id);
  const tex = f => new Promise((ok, no) => new THREE.TextureLoader().load(hairBase + f, t => { t.flipY = false; t.anisotropy = 4; t.userData.keep = true; ok(t); }, undefined, no));
  const p = fetch(hairBase + id + '.bin').then(r => { if (!r.ok) throw new Error('hair ' + id + ' ' + r.status); return r.arrayBuffer(); }).then(buf => {
    const hl = new DataView(buf).getUint32(4, true), h = JSON.parse(new TextDecoder().decode(new Uint8Array(buf, 8, hl))), pad = n => (n + 3) & ~3;
    let o = 8 + hl; const P = new Int16Array(buf, o, h.n * 3); o += pad(h.n * 6); const U = new Uint16Array(buf, o, h.n * 2); o += pad(h.n * 4);
    const Nn = new Int8Array(buf, o, h.n * 3); o += pad(h.n * 3); const I = h.i32 ? new Uint32Array(buf, o, h.t * 3) : new Uint16Array(buf, o, h.t * 3);
    const pos = Float32Array.from(P, v => v * h.qs), nrm = Float32Array.from(Nn, v => v / 127), uv = new Float32Array(h.n * 2);
    for (let i = 0; i < h.n; i++) { uv[i * 2] = h.uv[0] + U[i * 2] / 65535 * h.uv[2]; uv[i * 2 + 1] = h.uv[1] + U[i * 2 + 1] / 65535 * h.uv[3]; }
    return Promise.all([tex(h.map), h.nrm ? tex(h.nrm) : null]).then(([map, nmap]) => {
      map.colorSpace = THREE.SRGBColorSpace;
      const H = {pos, nrm, uv, idx:Uint32Array.from(I), groups:h.groups, k:h.k, map, nmap, ...scalpOf(pos)};
      hairReady.set(id, H); return H; });
  });
  p.catch(() => hairLoads.delete(id)); hairLoads.set(id, p); return p;
}
/* where the model lies close on the scalp: the face picture paints scalp in the hair's shade there (so no skin shows between locks),
   and round ears are left off when the hair covers them */
function scalpOf(pos){
  const B = 72, top = new Float32Array(B), v = new V3(), ear = [new V3(1, -.1, -.05).normalize(), new V3(-1, -.1, -.05).normalize()]; let earHits = 0;
  for (let i = 0; i < pos.length; i += 3) { v.set(pos[i], pos[i + 1], pos[i + 2]); const r = v.length(); if (r < .97 || r > 1.18 || v.y < -.45) continue;
    const th = Math.atan2(v.x, v.z), ph = Math.acos(clamp(v.y / r, -1, 1)), b = Math.min(B - 1, Math.floor((th + PI) / TAU * B)); top[b] = Math.max(top[b], ph);
    if (r < 1.3 && ear.some(e => v.angleTo(e) < 22 * DEG)) earHits++; }
  const sm = Array.from(top, (x, b) => Math.min(x, top[(b + 1) % B] || x, top[(b + B - 1) % B] || x)); /* a lone stray lock doesn't count */
  const edge = th => { const f = (wrapA(th) + PI) / TAU * B - .5, b0 = (Math.floor(f) + B) % B, b1 = (b0 + 1) % B, w = f - Math.floor(f), e = (sm[b0] * (1 - w) + sm[b1] * w) - 5 * DEG;
    return Math.max(0, Math.abs(wrapA(th)) < 60 * DEG ? Math.min(e, 68 * DEG) : e); };
  return {edge:sm.some(x => x > 20 * DEG) ? edge : null, ears:earHits >= 3};
}

/* ---------- textures drawn in code ---------- */
const hairTexCache = new Map();
function hairTex(hex, kind){
  const key = hex + kind; if (hairTexCache.has(key)) return hairTexCache.get(key);
  const W = kind === 'lock' ? 64 : 128, H = kind === 'strand' ? 64 : 128, cv = canvas(W, H), x = cv.getContext('2d'), dark = shade(hex, lum(hex) > .7 ? .84 : .74), light = lighten(hex, .38);
  let sd = 7; const rn = () => (sd = (sd * 16807) % 2147483647) / 2147483647;
  x.fillStyle = hex; x.fillRect(0, 0, W, H);
  if (kind === 'strand') {
    const g = x.createLinearGradient(0, 0, W, 0); /* u runs round the clump: 0 and .5 are its edges, .25 its top, .75 its underside */
    [[0, shade(hex, .9)], [.12, hex], [.25, lighten(hex, .07)], [.38, hex], [.5, shade(hex, .9)], [.75, shade(hex, .84)], [1, shade(hex, .9)]].forEach(([o, c]) => g.addColorStop(o, c));
    x.fillStyle = g; x.fillRect(0, 0, W, H);
    for (let i = 0; i < 10; i++) { const px = rn() * W * .5; x.globalAlpha = .06 + rn() * .08; x.strokeStyle = rn() < .5 ? dark : light; x.lineWidth = .8 + rn() * .9; x.beginPath(); x.moveTo(px, 0); x.lineTo(px + (rn() - .5) * 2, H); x.stroke(); }
    x.globalAlpha = 1; const r = x.createLinearGradient(0, 0, 0, H); r.addColorStop(0, 'rgba(0,0,0,.28)'); r.addColorStop(.12, 'rgba(0,0,0,0)'); x.fillStyle = r; x.fillRect(0, 0, W, H);
  } else if (kind === 'beard') {
    x.globalAlpha = .3; x.strokeStyle = dark; for (let i = 0; i < 9; i++) { x.lineWidth = 1.2 + rn(); const px = rn() * W; x.beginPath(); x.moveTo(px, H); x.lineTo(px + 2, 0); x.stroke(); } x.globalAlpha = 1;
  } else if (kind === 'shell') {
    x.globalAlpha = .28; x.strokeStyle = dark;
    for (let i = 0; i < 7; i++) { x.lineWidth = 1.2 + rn(); const px = rn() * W; x.beginPath(); x.moveTo(px, H); x.bezierCurveTo(px + 3, H * .6, px - 2, H * .3, px + 1, 0); x.stroke(); }
    x.globalAlpha = .85; x.fillStyle = light; x.beginPath(); x.moveTo(0, 76);
    for (let i = 0; i <= 8; i++) x.quadraticCurveTo(i * W / 8 - W / 16, 70 + rn() * 2, i * W / 8, 75);
    for (let i = 8; i >= 0; i--) x.quadraticCurveTo(i * W / 8 + W / 16, 92 + rn() * 4, i * W / 8, 84);
    x.closePath(); x.fill(); x.globalAlpha = 1;
    const g = x.createLinearGradient(0, 0, 0, 44); g.addColorStop(0, shade(hex, .82)); g.addColorStop(1, hex); x.fillStyle = g; x.fillRect(0, 0, W, 44);
  } else {
    const g = x.createLinearGradient(0, 0, W, 0); g.addColorStop(0, hex); g.addColorStop(.45, hex); g.addColorStop(.6, shade(hex, .88)); g.addColorStop(.9, shade(hex, .88)); g.addColorStop(1, hex);
    x.fillStyle = g; x.fillRect(0, 0, W, H);
    x.strokeStyle = dark; x.globalAlpha = .3; x.lineWidth = 1.4; x.beginPath(); x.moveTo(W * .25, H); x.lineTo(W * .25, 0); x.stroke(); x.globalAlpha = 1;
    x.fillStyle = light; x.globalAlpha = .55; x.beginPath(); x.moveTo(W * .22, H * .84); x.quadraticCurveTo(W * .21, H * .74, W * .23, H * .62); x.quadraticCurveTo(W * .28, H * .74, W * .27, H * .84); x.closePath(); x.fill(); x.globalAlpha = 1;
  }
  const t = ctex(cv, true); hairTexCache.set(key, t); return t;
}
function faceTex(spec, R, hair){
  const cv = canvas(512, 256), x = cv.getContext('2d'), skin = (R.skins[spec.skin] || R.skins[0]).c, hairHex = pick(HAIRC, spec.hairCol)[2];
  x.fillStyle = skin; x.fillRect(0, 0, 512, 256);
  const cx = 128, beast = R.beast;
  const X = th => 128 + th / TAU * 512, Y = ph => ph / PI * 256;
  const region = (fn, fill, stroke, lw) => { /* fill above the line ph = fn(th) all round the head */
    for (const off of [0, -512, 512]) { x.beginPath(); x.moveTo(X(-PI) + off, 0);
      for (let i = 0; i <= 240; i++) { const th = -PI + i / 240 * TAU; x.lineTo(X(th) + off, Y(fn(th))); }
      x.lineTo(X(PI) + off, 0); x.closePath(); if (fill) { x.fillStyle = fill; x.fill(); }
      if (stroke) { x.beginPath(); for (let i = 0; i <= 240; i++) { const th = -PI + i / 240 * TAU; x[i ? 'lineTo' : 'moveTo'](X(th) + off, Y(fn(th))); } x.strokeStyle = stroke; x.lineWidth = lw || 2.6; x.lineJoin = 'round'; x.stroke(); } }
  };
  if (hair && hair.edge) region(hair.edge, shade(hairHex, .78), hair.ink === false ? null : '#2a1810', 2.6);
  if (hair && hair.shave) { x.globalAlpha = .75; region(hair.shave, mix(shade(hairHex, .75), skin, .5)); x.globalAlpha = 1;
 }
  if (spec.beard === 'stubble' && !beast) { x.globalAlpha = .3; x.fillStyle = hairHex;
    x.beginPath(); x.moveTo(X(-80 * DEG), Y(96 * DEG)); x.quadraticCurveTo(X(-40 * DEG), Y(118 * DEG), X(-14 * DEG), Y(130 * DEG)); x.lineTo(X(14 * DEG), Y(130 * DEG));
    x.quadraticCurveTo(X(40 * DEG), Y(118 * DEG), X(80 * DEG), Y(96 * DEG)); x.lineTo(X(80 * DEG), 256); x.lineTo(X(-80 * DEG), 256); x.fill();
    x.beginPath(); x.ellipse(cx, 162, 16, 4, 0, 0, TAU); x.fill(); x.globalAlpha = 1; }
  if (['short', 'long', 'braided'].includes(spec.beard) && !beast && !R.nohair && !R.snakes) { /* shade under the beard, ink where it meets the cheek */
    const f = th => Math.abs(th) > 84 * DEG ? PI : beardTop(th) - .4 * DEG;
    x.save(); x.beginPath(); x.rect(X(-84 * DEG), 0, X(84 * DEG) - X(-84 * DEG), 256); x.clip();
    x.beginPath(); for (let i = 0; i <= 120; i++) { const th = (-84 + i * 168 / 120) * DEG; x[i ? 'lineTo' : 'moveTo'](X(th), Y(f(th))); } x.lineTo(X(84 * DEG), 256); x.lineTo(X(-84 * DEG), 256); x.closePath();
    x.fillStyle = shade(hairHex, .7); x.fill();
    x.beginPath(); for (let i = 0; i <= 120; i++) { const th = (-84 + i * 168 / 120) * DEG; x[i ? 'lineTo' : 'moveTo'](X(th), Y(f(th))); }
    x.strokeStyle = "#2a1810"; x.lineWidth = 3; x.lineJoin = "round"; x.stroke(); x.restore(); }
  if (beast === 'fish' || beast === 'lizard') {
    x.globalAlpha = .18; x.strokeStyle = '#000'; x.lineWidth = 2;
    for (let i = 0; i < 70; i++) { const px = (i * 53) % 512, py = 20 + ((i * 97) % 220); x.beginPath(); x.arc(px, py, 7, .2, PI - .2); x.stroke(); }
    x.globalAlpha = 1;
  }
  if (beast === 'wolf') { x.fillStyle = mix(skin, '#ffffff', .3); x.beginPath(); x.ellipse(cx, 172, 46, 40, 0, 0, 7); x.fill(); }
  return cv;
}

/* ---------- heads and faces ----------
   The head is a ball pulled into shape (headWarp: size, shape, jaw). Hair, hood, ears and beard follow the same pull (warpHead),
   so nothing pokes through. The face is drawn on a sheet that lies over the front of the head (faceSheet), sharper than the
   head's own picture, which keeps the skin, the scalp under the hair and beard shading (faceTex). */
function headWarp(spec, R, HR){
  const [sx, sy, sz] = pick(HEAD_SHAPES, spec.headShape)[2], J = R.beast ? {} : pick(JAWS, spec.jaw)[2], man = spec.body === 'm' && !R.beast;
  /* a man's jaw is broader and longer whichever jawline is picked: less taper, less cheek, a squarer and lower chin */
  const jaw = (J.jaw || 0) * (man ? .5 : 1), chin = (J.chin || 0) + (man ? .035 : 0), cheek = (J.cheek || 0) * (man ? .35 : 1),
    sq = (J.sq || 0) + (man ? .05 : 0), fwd = (J.fwd || 0) + (man ? .015 : 0), cw = J.narrow ? .3 : man ? .7 : .55;
  if (sx === 1 && sy === 1 && sz === 1 && !jaw && !chin && !cheek && !sq && !fwd) return null;
  return p => {
    const L = p.length(); if (L < 1e-6) return p;
    const l = L / HR, dx = p.x / L, dy = p.y / L, dz = p.z / L;
    const f = 1 - sstep(1.35, 1.9, l), wf = sstep(-.55, .15, dz) * (1 - sstep(1.12, 1.5, l)), t = sstep(-.12, -.92, dy);
    const kx = 1 - jaw * wf * Math.pow(t, 1.3) + cheek * wf * Math.exp(-Math.pow((dy + .28) / .22, 2)) + sq * wf * Math.exp(-Math.pow((dy + .6) / .17, 2));
    const cz = wf * t * t * Math.exp(-Math.pow(dx / cw, 2));
    p.x *= lerp(1, sx, f) * kx; p.y = p.y * lerp(1, sy, f) - chin * HR * cz; p.z = p.z * lerp(1, sz, f) + fwd * HR * cz;
    return p;
  };
}
/* average the normals of points that sit together (seams, poles), so the shading has no lines */
function weldNormals(geo){
  const P = geo.attributes.position, N = geo.attributes.normal, map = new Map(), keys = [];
  for (let i = 0; i < P.count; i++) { const k = Math.round(P.getX(i) * 200) + ',' + Math.round(P.getY(i) * 200) + ',' + Math.round(P.getZ(i) * 200);
    let s = map.get(k); if (!s) { s = new V3(); map.set(k, s); } s.x += N.getX(i); s.y += N.getY(i); s.z += N.getZ(i); keys.push(s); }
  for (let i = 0; i < P.count; i++) { const s = keys[i], l = s.length() || 1; N.setXYZ(i, s.x / l, s.y / l, s.z / l); }
  N.needsUpdate = true; return geo;
}
function headGeo(HR, warp){
  const geo = new THREE.SphereGeometry(HR, 64, 44);
  if (warp) { const P = geo.attributes.position, v = new V3(); for (let i = 0; i < P.count; i++) { v.fromBufferAttribute(P, i); warp(v); P.setXYZ(i, v.x, v.y, v.z); }
    geo.computeVertexNormals(); weldNormals(geo); }
  geo.userData.warped = true; return geo;
}
/* move everything on the head (ears, hood, beard, snouts) with the head's shape; hair models are moved as they are built */
function warpHead(head, warp){
  head.updateMatrixWorld(true);
  const inv = new THREE.Matrix4().copy(head.matrixWorld).invert(), m = new THREE.Matrix4(), mi = new THREE.Matrix4(), v = new V3(), seen = new Set();
  head.traverse(o => { const geo = o.geometry; if (!geo || seen.has(geo) || geo.userData.warped) return; seen.add(geo);
    m.multiplyMatrices(inv, o.matrixWorld); mi.copy(m).invert(); const P = geo.attributes.position;
    for (let i = 0; i < P.count; i++) { v.fromBufferAttribute(P, i).applyMatrix4(m); warp(v); v.applyMatrix4(mi); P.setXYZ(i, v.x, v.y, v.z); }
    P.needsUpdate = true; geo.computeBoundingSphere(); });
}

/* the face sheet: 512 x 416 pixels over x -.8..8, y .44..-.86 of the head seen from the front (FS.K pixels a unit) */
const FS = {W:512, H:416, K:320, X0:.8, Y0:.44};
const bez = (a, b, c, d, t) => { const u = 1 - t; return [u * u * u * a[0] + 3 * u * u * t * b[0] + 3 * u * t * t * c[0] + t * t * t * d[0], u * u * u * a[1] + 3 * u * u * t * b[1] + 3 * u * t * t * c[1] + t * t * t * d[1]]; };
const lerp2 = (a, b, k) => [lerp(a[0], b[0], k), lerp(a[1], b[1], k)];
function faceSheet(spec, R){
  const cv = canvas(FS.W, FS.H), x = cv.getContext('2d'), K = FS.K, beast = R.beast;
  if (beast === 'bug') return cv;
  const X = u => (u + FS.X0) * K, Y = v => (FS.Y0 - v) * K;
  const skin = (R.skins[spec.skin] || R.skins[0]).c, hairHex = pick(HAIRC, spec.hairCol)[2], irisC = pick(EYES, spec.eyes)[2];
  const E = spec.expr === 'hurt' ? HURT : pick(EXPRS, spec.expr)[2], marks = new Set(spec.marks || []), sz = pick(EYE_SIZES, spec.eyeSize)[2];
  const P = Object.assign({}, pick(EYE_SHAPES, E.dot ? 'dot' : spec.eyeShape)[2]); P.w *= sz; P.h *= sz;
  /* a man's eyes: lower and flatter, a thin lash line with no flick or lashes, heavier straight brows (see brows) */
  const man = spec.body === 'm' && !beast;
  if (man && !P.dot) { P.h *= .72; P.w *= .97; P.up *= .86; P.lash *= .5; P.wing = (P.wing || 0) * .3; P.lashes = 0; }
  const cx0 = beast === 'wolf' ? .4 : beast ? .47 : .36 + (sz - 1) * .12, cy = beast ? -.08 : -.13;
  const ink = '#221820', line = (pts, col, lw, a = 1) => { x.save(); x.globalAlpha = a; x.strokeStyle = col; x.lineWidth = lw * K; x.lineCap = x.lineJoin = 'round';
    x.beginPath(); pts.forEach((p, i) => x[i ? 'lineTo' : 'moveTo'](X(p[0]), Y(p[1]))); x.stroke(); x.restore(); };
  const curve = (a, b, c, d, n = 20, t0 = 0, t1 = 1) => { const o = []; for (let i = 0; i <= n; i++) o.push(bez(a, b, c, d, lerp(t0, t1, i / n))); return o; };
  const ell = (cxu, cyu, rx, ry, fill, rotA = 0) => { x.beginPath(); x.ellipse(X(cxu), Y(cyu), Math.max(.1, rx * K), Math.max(.1, ry * K), rotA, 0, TAU); if (fill) { x.fillStyle = fill; x.fill(); } };
  /* a band along a curve, th(t) thick on one side (side +1: towards +y) */
  const band = (pts, th, col, side = 1) => { const top = [], n = pts.length - 1;
    for (let i = 0; i <= n; i++) { const a = pts[Math.max(0, i - 1)], b = pts[Math.min(n, i + 1)], tx = b[0] - a[0], ty = b[1] - a[1], l = Math.hypot(tx, ty) || 1;
      let nx = -ty / l, ny = tx / l; if (ny * side < 0 || (Math.abs(ny) < 1e-3 && nx * side < 0)) { nx = -nx; ny = -ny; } const w = th(i / n); top.push([pts[i][0] + nx * w, pts[i][1] + ny * w]); }
    x.beginPath(); pts.forEach((p, i) => x[i ? 'lineTo' : 'moveTo'](X(p[0]), Y(p[1]))); for (let i = n; i >= 0; i--) x.lineTo(X(top[i][0]), Y(top[i][1])); x.closePath(); x.fillStyle = col; x.fill(); };
  const blushK = Math.max(marks.has('blush') ? .8 : 0, (E.blush || 0) * (man ? .35 : 1));
  if (blushK && !beast) [-1, 1].forEach(s => { const g = x.createRadialGradient(X(s * .4), Y(-.4), 0, X(s * .4), Y(-.4), .13 * K);
    g.addColorStop(0, `rgba(238,100,112,${.5 * blushK})`); g.addColorStop(1, 'rgba(238,100,112,0)'); x.save(); x.fillStyle = g; x.translate(X(s * .4), Y(-.4)); x.scale(1, .55); x.translate(-X(s * .4), -Y(-.4));
    x.fillRect(X(s * .4) - .13 * K, Y(-.4) - .13 * K, .26 * K, .26 * K); x.restore();
    if (blushK >= .9) for (let i = 0; i < 3; i++) line([[s * .35 + i * .035 - .015, -.38], [s * .35 + i * .035 - .035, -.42]], 'rgba(214,80,96,.7)', .006); });
  if (marks.has('freckles') && !beast) { x.fillStyle = shade(skin, .62); x.globalAlpha = .7;
    for (let i = 0; i < 18; i++) { const s = i % 2 ? 1 : -1, k = (i * 0.618) % 1, k2 = (i * 0.382 + .2) % 1; ell(s * (.14 + k * .26), -.27 - k2 * .12, .009, .009, shade(skin, .62)); }
    x.globalAlpha = 1; }
  if ((marks.has('bags') || E.bags) && !P.dot && !beast) [-1, 1].forEach(s => { const cx = s * cx0, w = P.w, h = P.h;
    x.save(); x.globalAlpha = .22; ell(cx + s * w * .1, cy - h * .95, w * .78, h * .5, '#7a5a8a'); x.restore();
    line(curve([cx - s * w * .55, cy - h - .03], [cx - s * w * .2, cy - h - .08], [cx + s * w * .3, cy - h - .08], [cx + s * w * .78, cy - h - .025]), shade(skin, .62), .007, .8); });
  if (pick(JAWS, spec.jaw)[2].line && !beast) [-1, 1].forEach(s => line(curve([s * .58, -.3], [s * .58, -.4], [s * .55, -.5], [s * .47, -.6]), shade(skin, .66), .007, .75));
  /* nose */
  if (!beast && !R.nose) {
    if (spec.nose === 'hint' && man) { line([[.03, -.22], [.026, -.31], [.01, -.355], [-.012, -.37]], shade(skin, .68), .008, .85); line([[-.03, -.36], [-.042, -.352]], shade(skin, .68), .006, .6); }
    else if (spec.nose === 'hint') { line([[.016, -.31], [.004, -.35], [-.008, -.365]], shade(skin, .66), .008, .85); }
    else if (spec.nose === 'small' && man) { line(curve([-.042, -.35], [-.022, -.395], [.022, -.395], [.042, -.35]), shade(skin, .64), .009); line([[.02, -.2], [.026, -.33]], shade(skin, .7), .007, .7); }
    else if (spec.nose === 'small') { line(curve([-.03, -.35], [-.015, -.39], [.015, -.39], [.03, -.35]), shade(skin, .64), .009); line([[.012, -.28], [.018, -.33]], shade(skin, .72), .006, .6); }
  }
  /* mouth: its shape (size, lips) in the pose the expression gives it */
  if (!beast) {
    const my = -.57, ms = spec.mouth, MW = ({small:.05, wide:.08, full:.06, cat:.055}[ms] || .05) * (man ? 1.18 : 1), pose = E.mouth || 'line', mc = man ? '#4e2620' : '#5a2620', lw = man ? .012 : .011;
    const lips = marks.has('lipstick') ? '#a3283f' : ms === 'full' ? mix(skin, '#c4505a', man ? .22 : .45) : null;
    if (lips && !['o', 'O', 'open', 'grin', 'teeth'].includes(pose)) { const up = pose === 'smile' ? .012 : pose === 'frown' ? -.01 : 0;
      x.beginPath(); const pts = curve([-MW * 1.05, my + up], [-MW * .5, my - .045], [MW * .5, my - .045], [MW * 1.05, my + up]); pts.forEach((p, i) => x[i ? 'lineTo' : 'moveTo'](X(p[0]), Y(p[1])));
      curve([MW * 1.05, my + up], [MW * .4, my + .03], [-MW * .4, my + .03], [-MW * 1.05, my + up]).forEach(p => x.lineTo(X(p[0]), Y(p[1]))); x.closePath(); x.fillStyle = lips; x.fill();
      x.save(); x.globalAlpha = .45; ell(MW * .25, my - .022, MW * .3, .008, '#ffffff'); x.restore(); }
    const filled = (pts, fill, stroke) => { x.beginPath(); pts.forEach((p, i) => x[i ? 'lineTo' : 'moveTo'](X(p[0]), Y(p[1]))); x.closePath(); x.fillStyle = fill; x.fill(); if (stroke) { x.strokeStyle = stroke; x.lineWidth = .008 * K; x.lineJoin = 'round'; x.stroke(); } };
    if (ms === 'cat' && ['line', 'smile', 'small', 'flat'].includes(pose)) { const w = MW * .55, d = pose === 'smile' ? .02 : .013;
      line(curve([-w * 2, my + .006], [-w * 1.6, my - d], [-w * .4, my - d], [0, my + .004]), mc, lw); line(curve([0, my + .004], [w * .4, my - d], [w * 1.6, my - d], [w * 2, my + .006]), mc, lw); }
    else if (pose === 'line') line(curve([-MW, my], [-MW * .3, my - .008], [MW * .3, my - .008], [MW, my]), mc, lw);
    else if (pose === 'flat') line([[-MW * .8, my], [MW * .8, my - .003]], mc, lw);
    else if (pose === 'small') line([[-MW * .5, my], [MW * .5, my]], mc, lw);
    else if (pose === 'smile') line(curve([-MW, my + .014], [-MW * .45, my - .025], [MW * .45, my - .025], [MW, my + .014]), mc, lw);
    else if (pose === 'frown') line(curve([-MW * .9, my - .013], [-MW * .4, my + .018], [MW * .4, my + .018], [MW * .9, my - .013]), mc, lw);
    else if (pose === 'smirk') line(curve([-MW * .8, my - .002], [-MW * .1, my - .012], [MW * .5, my - .008], [MW, my + .022]), mc, lw);
    else if (pose === 'wavy') { const o = []; for (let i = 0; i <= 24; i++) { const t = i / 24; o.push([lerp(-MW, MW, t), my + .008 * Math.sin(t * TAU * 1.5)]); } line(o, mc, lw * .9); }
    else if (pose === 'o' || pose === 'O') { const r = pose === 'O' ? 1.35 : 1; ell(0, my - .005, MW * .42 * r, MW * .55 * r, '#4a1a1c'); x.strokeStyle = mc; x.lineWidth = .008 * K; x.stroke();
      x.save(); x.clip(); ell(0, my - MW * .5 * r, MW * .4 * r, MW * .25 * r, '#c45a62'); x.restore(); }
    else if (pose === 'open' || pose === 'grin') { const w = MW * (pose === 'open' ? 1.15 : 1.25), d = pose === 'open' ? .075 : .055;
      const pts = [[-w, my + .012]].concat(curve([-w, my + .012], [-w * .7, my - d], [w * .7, my - d], [w, my + .012], 18)); filled(pts, '#4a1a1c', mc);
      x.save(); x.clip(); ell(0, my - d * .75, w * .55, d * .4, '#d0646c'); if (pose === 'grin') { x.fillStyle = '#fbf7ef'; x.fillRect(X(-w), Y(my + .012), w * 2 * K, .018 * K); } x.restore(); }
    else if (pose === 'teeth') { const w = MW * 1.15, pts = curve([-w, my - .004], [-w * .4, my + .02], [w * .4, my + .02], [w, my - .004], 12).concat(curve([w, my - .004], [w * .4, my - .03], [-w * .4, my - .03], [-w, my - .004], 12));
      filled(pts, '#fbf7ef', mc); x.save(); x.clip(); line([[-w, my], [w, my]], '#b7a99a', .005); for (let i = -2; i <= 2; i++) line([[i * w * .3, my + .02], [i * w * .3, my - .03]], '#b7a99a', .004); x.restore(); }
    if (R.fangs) [-1, 1].forEach(s => filled([[s * .012, my - .002], [s * .028, my - .002], [s * .02, my - .03]], '#ffffff', '#7a5a5a'));
  }
  /* eyes */
  const eye = s => {
    const cx = s * cx0, w = P.w, h = P.h * (E.wide || 1), tilt = P.tilt || 0;
    if (E.closed === 'squeeze') { line([[cx + s * w * .75, cy + h * .7], [cx - s * w * .45, cy + h * .05], [cx + s * w * .75, cy - h * .55]], ink, .024); return; }
    if (E.closed === 'up') { line(curve([cx - s * w * .85, cy - h * .2], [cx - s * w * .35, cy + h * 1.05], [cx + s * w * .35, cy + h * 1.05], [cx + s * w * .9, cy - h * .15]), ink, .022); return; }
    if (E.closed === 'down') { const pts = curve([cx - s * w * .9, cy + h * .15], [cx - s * w * .35, cy - h * .75], [cx + s * w * .4, cy - h * .75], [cx + s * w * .95, cy + h * .2]);
      line(pts, ink, .018); [.62, .78, .92].forEach((t, i) => { const p = bez(...[[cx - s * w * .9, cy + h * .15], [cx - s * w * .35, cy - h * .75], [cx + s * w * .4, cy - h * .75], [cx + s * w * .95, cy + h * .2]], t); line([p, [p[0] + s * .012 * (i + 1), p[1] - .03]], ink, .008); }); return; }
    if (P.dot) { ell(cx + (E.look || 0) * .015, cy + (E.lookY || 0) * .015, w * (E.wide || 1), h * (E.wide || 1), '#1d1418'); ell(cx - .014, cy + .022, w * .3, w * .3, '#ffffff'); return; }
    const I = [cx - s * w, cy - tilt * h * .3], O = [cx + s * w, cy + tilt * h * .7];
    const U1 = [cx - s * w * .45, cy + h * P.up], U2 = [cx + s * w * .45, cy + h * P.up * .95 + tilt * h * .3];
    const L1 = [cx - s * w * .4, cy - h * P.low], L2 = [cx + s * w * .45, cy - h * P.low * .95 + tilt * h * .2];
    const kI = clamp((E.lid || 0) + (E.lidI || 0), 0, .95), kO = clamp((E.lid || 0) + (E.lidO || 0), 0, .95), kb = E.low || 0;
    const A1 = lerp2(U1, L1, kI), A2 = lerp2(U2, L2, kO), B1 = lerp2(L1, U1, kb * .6), B2 = lerp2(L2, U2, kb);
    const lid = curve(I, A1, A2, O, 24), low = curve(O, B2, B1, I, 24);
    x.beginPath(); lid.concat(low).forEach((p, i) => x[i ? 'lineTo' : 'moveTo'](X(p[0]), Y(p[1]))); x.closePath();
    x.fillStyle = '#fbf8f3'; x.fill(); x.save(); x.clip();
    const ix = cx + (E.look || 0) * w * .38, iy = cy + (E.lookY || 0) * h * .45 - h * .04, rI = w * (man ? .5 : .55), ry = rI * 1.12;
    const g = x.createLinearGradient(0, Y(iy + ry), 0, Y(iy - ry)); g.addColorStop(0, shade(irisC, .22)); g.addColorStop(.55, shade(irisC, .85)); g.addColorStop(1, mix(irisC, '#ffffff', .5));
    ell(ix, iy, rI, ry, g); x.strokeStyle = shade(irisC, .28); x.lineWidth = .008 * K; x.stroke();
    ell(ix, iy - ry * .04, rI * .42 * (E.pupil || 1), ry * .5 * (E.pupil || 1), shade(irisC, .14));
    x.save(); x.globalAlpha = man ? .14 : .22; x.strokeStyle = man ? '#3a2a24' : '#3c2448'; x.lineWidth = h * .38 * K; x.beginPath(); lid.forEach((p, i) => x[i ? 'lineTo' : 'moveTo'](X(p[0]), Y(p[1]))); x.stroke(); x.restore();
    const hl = man ? .62 : 1; ell(ix - rI * .34, iy + ry * .36, rI * .3 * hl, ry * .27 * hl, '#ffffff'); if (!man) ell(ix + rI * .32, iy - ry * .42, rI * .12, rI * .12, 'rgba(255,255,255,.85)');
    x.restore();
    /* lash line along the lid, thicker towards the outer end, with a wing for sharp eyes */
    band(lid, t => P.lash * .05 * (.3 + .7 * sstep(0, .5, t)) * (1 - .4 * sstep(.88, 1, t)), ink);
    if (P.wing) { const e = lid[lid.length - 1], q = lid[lid.length - 4]; x.beginPath(); x.moveTo(X(q[0]), Y(q[1] + .02 * P.lash)); x.lineTo(X(e[0] + s * w * .3 * P.wing), Y(e[1] + h * .45 * P.wing)); x.lineTo(X(e[0]), Y(e[1] - .004)); x.closePath(); x.fillStyle = ink; x.fill(); }
    line(curve(O, B2, B1, I, 16, .05, .55), '#5a4048', .007, .8);
    if (kI < .5 && kO < .5) line(curve(I, [U1[0], U1[1] + h * .4], [U2[0], U2[1] + h * .38], O, 16, .22, .85), shade(skin, .66), .005, man ? .4 : .7);
    if (P.lashes) [.72, .84, .95].forEach((t, i) => { const p = bez(I, A1, A2, O, t); line([p, [p[0] + s * (.018 + i * .01), p[1] + .03 - i * .004]], ink, .009); });
  };
  [-1, 1].forEach(eye);
  /* brows: hair-coloured, frowning or worried with the expression */
  if (spec.brows !== 'none') [-1, 1].forEach(s => {
    const cx = s * cx0, bw = P.dot ? .1 : P.w * (man ? 1.14 : 1.05), a = E.brow || 0, by = cy + (P.dot ? .13 : P.h * .9) + (man ? .04 : .045) + (E.raise || 0) * .04 + (E.browOne && s > 0 ? .05 : 0);
    const col = beast ? shade(skin, .6) : lum(hairHex) > .6 ? shade(hairHex, .58) : lum(hairHex) < .2 ? hairHex : shade(hairHex, .82);
    const inr = [cx - s * bw * .8, by - a * .045], out = [cx + s * bw, by - .015 + a * .02];
    if (spec.brows === 'short') { x.save(); x.translate(X(cx - s * bw * .3), Y(by + .02 - a * .02)); x.rotate(s * a * .25); x.beginPath(); x.ellipse(0, 0, .045 * K, .022 * K, 0, 0, TAU); x.fillStyle = col; x.fill(); x.restore(); return; }
    const arch = (spec.brows === 'arched' ? .045 : spec.brows === 'thick' ? .018 : .028) * (man ? .45 : 1), th = (spec.brows === 'thick' ? .038 : spec.brows === 'arched' ? .022 : .021) * (man ? 1.3 : 1);
    const m1 = [lerp(inr[0], out[0], .33), lerp(inr[1], out[1], .33) + arch], m2 = [lerp(inr[0], out[0], .7), lerp(inr[1], out[1], .7) + arch * .9];
    band(curve(inr, m1, m2, out, 18), t => th * (1 - (man ? .38 : .62) * t), col, 1);
  });
  if (marks.has('scar') && !beast) { const cx = -cx0; line([[cx - .07, cy + .25], [cx + .06, cy - .22]], mix(skin, '#b0505a', .55), .013);
    [.25, .5, .75].forEach(t => { const p = [lerp(cx - .07, cx + .06, t), lerp(cy + .25, cy - .22, t)]; line([[p[0] - .022, p[1] - .006], [p[0] + .022, p[1] + .006]], mix(skin, '#b0505a', .4), .006); }); }
  if (marks.has('mole') && !beast) ell(-.13, -.63, .011, .011, '#4a2a22');
  if (E.sweat) { const sx = .52, sy = .16; x.beginPath(); x.moveTo(X(sx), Y(sy + .06)); x.quadraticCurveTo(X(sx + .04), Y(sy - .01), X(sx), Y(sy - .025)); x.quadraticCurveTo(X(sx - .04), Y(sy - .01), X(sx), Y(sy + .06));
    x.fillStyle = '#bfe4ff'; x.fill(); x.strokeStyle = '#3a6a9a'; x.lineWidth = .006 * K; x.stroke(); }
  return cv;
}
function faceSheetMesh(HR, warp, map, M){
  const nu = 40, nv = 33, pos = [], uv = [], idx = [], p = new V3(), yb = FS.Y0 - FS.H / FS.K;
  for (let j = 0; j <= nv; j++) for (let i = 0; i <= nu; i++) {
    const u = i / nu, v = j / nv; let X = lerp(-FS.X0, FS.X0, u), Y = lerp(FS.Y0, yb, v); const r2 = X * X + Y * Y;
    if (r2 > .97) { const k = Math.sqrt(.97 / r2); X *= k; Y *= k; }
    p.set(X, Y, Math.sqrt(Math.max(0, 1 - X * X - Y * Y))).multiplyScalar(HR * 1.004); if (warp) warp(p);
    pos.push(p.x, p.y, p.z); uv.push(u, 1 - v); }
  for (let j = 0; j < nv; j++) for (let i = 0; i < nu; i++) { const a = j * (nu + 1) + i, b = a + 1, c = a + nu + 1, d = c + 1; idx.push(a, c, b, b, c, d); }
  const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  geo.setIndex(idx); geo.computeVertexNormals(); geo.userData.warped = true;
  const mesh = new THREE.Mesh(geo, M(0xffffff, {map, gradientMap:SOFT, transparent:true, depthWrite:false, polygonOffset:true, polygonOffsetFactor:-1, polygonOffsetUnits:-4}));
  mesh.renderOrder = 1; return mesh;
}
/* small pictures for the Head tab's buttons: the whole head from the front, or close on the eyes or the mouth */
const iconCache = new Map();
function faceIcon(spec, over, mode = 'face'){
  const s = faceFix(Object.assign({}, spec, over || {}, {beard:'none'})), R = RACES[s.race] || RACES.Human, skin = (R.skins[s.skin] || R.skins[0]).c;
  const key = mode + JSON.stringify([s.race, s.body, s.skin, s.hair, s.hairCol, s.eyes, s.headSize, s.headShape, s.jaw, s.eyeShape, s.eyeSize, s.brows, s.nose, s.mouth, s.expr, s.marks]);
  if (iconCache.has(key)) return iconCache.get(key); if (iconCache.size > 400) iconCache.clear();
  const o = canvas(112, 112), x = o.getContext('2d'), sheet = faceSheet(s, R), warp = headWarp(s, R, 1);
  const r0 = mode === 'eyes' ? 92 : mode === 'mouth' ? 280 : mode === 'expr' ? 78 : 48 * pick(HEAD_SIZES, s.headSize)[2], cx = 56,
    cy = mode === 'eyes' ? 56 - .12 * r0 : mode === 'mouth' ? 56 - .5 * r0 : mode === 'expr' ? 58 - .33 * r0 : 54;
  const pts = [];
  for (let k = 0; k < 72; k++) { const a = k / 72 * TAU, ca = Math.cos(a), sa = Math.sin(a); let best = null, bd = -1;
    for (let j = 0; j <= 12; j++) { const e = j / 12 * PI / 2, p = new V3(Math.sin(e) * ca, Math.sin(e) * sa, Math.cos(e)); if (warp) warp(p); const d = p.x * ca + p.y * sa; if (d > bd) { bd = d; best = p; } }
    pts.push(best); }
  const outline = () => { x.beginPath(); pts.forEach((p, i) => x[i ? 'lineTo' : 'moveTo'](cx + p.x * r0, cy - p.y * r0)); x.closePath(); };
  outline(); x.fillStyle = skin; x.fill(); x.save(); outline(); x.clip();
  x.drawImage(sheet, cx - FS.X0 * r0, cy - FS.Y0 * r0, FS.W / FS.K * r0, FS.H / FS.K * r0);
  if ((mode === 'face' || mode === 'expr') && s.hair !== 'bald' && !R.nohair && !R.snakes) { x.fillStyle = pick(HAIRC, s.hairCol)[2]; x.beginPath(); x.moveTo(0, 0); x.lineTo(112, 0); x.lineTo(112, cy - .32 * r0);
    x.quadraticCurveTo(cx, cy - .22 * r0, 0, cy - .32 * r0); x.closePath(); x.fill(); }
  x.restore(); outline(); x.strokeStyle = '#1d130b'; x.lineWidth = mode === 'face' ? 2.4 : 3; x.stroke();
  const url = o.toDataURL(); iconCache.set(key, url); return url;
}

/* ---------- weapons ---------- */
function sword(){
  const g = new THREE.Group(), blade = toon(0xdbe3ec);
  g.add(at(inked(new THREE.BoxGeometry(3, 26, 1), blade, .5), 0, 17, 0));
  const tip = inked(new THREE.ConeGeometry(2.1, 5, 4), blade, .5); at(tip, 0, 32.5, 0); tip.rotation.y = PI / 4; tip.scale.z = .5; g.add(tip);
  g.add(at(inked(new THREE.BoxGeometry(11, 2, 2.6), toon(0xf0b93f), .5), 0, 3.5, 0));
  g.add(at(inked(new THREE.CylinderGeometry(1.3, 1.3, 7, 8), toon(0x7b4723), .5), 0, -.5, 0));
  g.add(at(inked(new THREE.SphereGeometry(2, 10, 8), toon(0xf0b93f), .5), 0, -4.6, 0));
  return g;
}
function bow(){
  const g = new THREE.Group();
  const arc = inked(new THREE.TorusGeometry(15, 1.3, 6, 20, PI), toon(0xa8682f), .6); arc.rotation.z = -PI / 2; g.add(arc);
  const str = new THREE.Mesh(new THREE.BoxGeometry(.6, 30, .6), new THREE.MeshBasicMaterial({color:0xf6eedb})); g.add(str);
  g.userData.str = str; return g;
}
function staff(){
  const g = new THREE.Group();
  g.add(at(inked(new THREE.CylinderGeometry(1.2, 1.4, 44, 8), toon(0x6b4423), .5), 0, 10, 0));
  const orb = at(new THREE.Mesh(new THREE.IcosahedronGeometry(4.4, 1), new THREE.MeshBasicMaterial({color:0xbfe6ff})), 0, 34, 0); g.add(orb);
  const gl = new THREE.Sprite(new THREE.SpriteMaterial({map:GLOW, color:0x5aa8ff, blending:THREE.AdditiveBlending, depthWrite:false, transparent:true}));
  gl.scale.setScalar(18); at(gl, 0, 34, 0); g.add(gl); g.userData.glow = gl; return g;
}
function arrowMesh(){
  const g = new THREE.Group();
  g.add(rot(inked(new THREE.CylinderGeometry(.8, .8, 26, 6), toon(0xd9a868), .5), PI / 2, 0, 0));
  g.add(at(rot(inked(new THREE.ConeGeometry(2.2, 6, 4), toon(0xaab5c3), .5), PI / 2, 0, 0), 0, 0, 15));
  [[0xe8463a, 1], [0xf4efe2, -1]].forEach(([c, s]) => g.add(at(new THREE.Mesh(new THREE.BoxGeometry(.5, 5, 6), new THREE.MeshBasicMaterial({color:c})), 0, s * 2.2, -11)));
  return g;
}
function boltMesh(){
  const g = new THREE.Group();
  g.add(new THREE.Mesh(new THREE.IcosahedronGeometry(5, 1), new THREE.MeshBasicMaterial({color:0xe2f3ff})));
  const gl = new THREE.Sprite(new THREE.SpriteMaterial({map:GLOW, color:0x5aa8ff, blending:THREE.AdditiveBlending, depthWrite:false, transparent:true})); gl.scale.setScalar(30); g.add(gl);
  return g;
}

/* ---------- the figure ---------- */
function buildFigure(spec, opt = {}){
  if (spec.beast) return BK.build(spec, opt, API);
  const R = RACES[spec.race] || RACES.Human;
  const fem = spec.body === 'f', H = R.h, Wd = R.w, D = .9;
  const skinHex = (R.skins[spec.skin] || R.skins[0]).c, hairHex = pick(HAIRC, spec.hairCol)[2], main = pick(CLOTH, spec.cloth)[2];
  const mats = [], M = (c, o) => { const m = toon(c, o); mats.push(m); return m; };
  const MM = (hex, map) => { const m = new THREE.MeshMatcapMaterial({matcap:metalCap(hex), map:map || null}); m.userData.base = m.color.clone(); mats.push(m); return m; };
  const mSkin = M(skinHex), mHair = M(hairHex), coatM = R.coat ? mHair : mSkin;
  const root = new THREE.Group(), rig = {root, spec, mats, fx:{}};
  if (opt.base !== false) {
    const sh = new THREE.Mesh(new THREE.PlaneGeometry(70, 70), new THREE.MeshBasicMaterial({map:SHADOW, transparent:true, depthWrite:false}));
    sh.rotation.x = -PI / 2; sh.position.y = .3; root.add(sh);
    const baseR = R.lower === 'horse' ? 25 : 21;
    root.add(at(inked(new THREE.CylinderGeometry(baseR, baseR + 1.5, 6, 40), toon(opt.baseColor || 0x2a2f55), .8), 0, 3, 0));
    root.add(at(rot(new THREE.Mesh(new THREE.TorusGeometry(baseR + .3, 1.2, 8, 48), toon(0xf4c46e)), PI / 2, 0, 0), 0, 6, 0));
    const ring = rot(new THREE.Mesh(new THREE.TorusGeometry(baseR + 7, 1.8, 6, 40), new THREE.MeshBasicMaterial({color:0xf4c46e})), PI / 2, 0, 0);
    ring.position.y = 1; ring.visible = false; root.add(ring); rig.ring = ring;
  }
  const body = new THREE.Group(); body.position.y = 6; root.add(body); rig.body = body;

  /* torso shape: a lathe profile, plus a bust or a breastplate keel, so clothes can follow it */
  const TH = 19 * (.62 + .38 * H);
  const prof = fem ? [[.1, 0], [9.2, 0], [9.8, 2.5], [7.7, 9], [8.1, 13], [8.3, 16.5], [7.4, 19.4], [4, 21], [.1, 21.2]]
                   : [[.1, 0], [8.2, 0], [8.8, 2], [8.6, 8], [9.6, 14], [10.2, 17.5], [8.8, 19.6], [4.3, 21], [.1, 21.2]];
  const spl = new THREE.SplineCurve(prof.map(p => new THREE.Vector2(p[0], p[1] * TH / 21)));
  const tbl = []; for (let i = 0; i <= 160; i++) tbl.push(spl.getPoint(i / 160));
  const yTop = tbl[160].y;
  const rY = y => { if (y <= tbl[2].y) return tbl[2].x; for (let i = 3; i <= 160; i++) if (tbl[i].y >= y) { const a = tbl[i - 1], b = tbl[i]; return lerp(a.x, b.x, (y - a.y) / ((b.y - a.y) || 1)); } return 0; };
  const O = {id:spec.outfit}, plateChest = spec.outfit === 'plate';
  const extra = (y, ph) => {
    let e = 0;
    if (fem) e += 1.7 * Math.exp(-Math.pow((y - TH * .66) / (TH * .13), 2)) * (Math.exp(-Math.pow((ph - .38) / .36, 2)) + Math.exp(-Math.pow((ph + .38) / .36, 2)));
    if (plateChest) e += .9 * Math.exp(-Math.pow(ph / .2, 2)) * sstep(TH * .2, TH * .5, y) * (1 - sstep(TH * .82, TH * .97, y)) + (fem ? 0 : .4 * Math.exp(-Math.pow((y - TH * .62) / (TH * .2), 2)));
    return e;
  };
  const Tp = (y, ph, off, out = new V3()) => { const r = Math.max(0, rY(y) + extra(y, wrapA(ph)) + off); return out.set(r * Wd * Math.sin(ph), y, r * Wd * D * Math.cos(ph)); };
  const _a = new V3(), _b = new V3(), _c = new V3();
  const Tn = (y, ph, out = new V3()) => { Tp(y, ph + .01, 0, _a); Tp(y, ph - .01, 0, _b); _a.sub(_b); Tp(y + .05, ph, 0, _b); Tp(y - .05, ph, 0, _c); _b.sub(_c);
    out.crossVectors(_a, _b).normalize(); if (out.x * Math.sin(ph) + out.z * Math.cos(ph) < 0) out.negate(); return out; };
  const Pn = (y, ph, d, out = new V3()) => { Tp(y, ph, 0, out); return out.addScaledVector(Tn(y, ph, _c.clone()), d); };

  /* lower body */
  const legH = 13 * H;
  let hipY = legH, hipZ = 0;
  rig.legs = []; rig.robe = false;
  const torso = new THREE.Group(); rig.torso = torso;
  const g = {fem, H, Wd, D, TH, yTop, main, skinHex, hairHex, M, MM, mSkin, rY, Tp, Tn, Pn, torso, mats, rig, R, spec,
    back:[], front:[], sleeve:{type:'full'}, legs:{pants:'#4a3a2c', boots:{col:DLEATHER, h:5}}, hood:hoodOf(spec)};
  OUTFIT_BUILD[spec.outfit] ? OUTFIT_BUILD[spec.outfit](g) : OUTFIT_BUILD.commoner(g);
  rig.robe = !!g.robe;
  if (!R.lower || R.lower === 'goat') {
    [-1, 1].forEach(s => {
      const lg = at(new THREE.Group(), s * 4 * Wd, legH, 0); body.add(lg);
      if (R.lower === 'goat') {
        lg.add(at(rot(inked(new THREE.CapsuleGeometry(3.4 * Wd, legH * .32, 4, 10), mHair), .45, 0, 0), 0, -legH * .25, 1.6));
        lg.add(at(rot(inked(new THREE.CapsuleGeometry(2.4 * Wd, legH * .3, 4, 10), mHair), -.5, 0, 0), 0, -legH * .66, 1.2));
        lg.add(at(inked(new THREE.CylinderGeometry(2.4, 2.8, 3, 10), M('#2a221c')), 0, -legH + 1.5, -.5));
      } else legParts(lg, s, legH, g);
      rig.legs.push(lg);
    });
  } else if (R.lower === 'horse') {
    hipY = 25; hipZ = 5;
    body.add(at(rot(inked(new THREE.CapsuleGeometry(9.5, 20, 6, 14), coatM, .7), PI / 2, 0, 0), 0, 19, -8));
    [[-1, 1], [1, 1], [-1, -1], [1, -1]].forEach(([s, f]) => {
      const lg = at(new THREE.Group(), s * 5.6, 16, -8 + f * 11); body.add(lg);
      lg.add(at(inked(new THREE.CapsuleGeometry(2.7, 9, 4, 10), coatM), 0, -6.5, 0));
      lg.add(at(inked(new THREE.CylinderGeometry(2.6, 3, 3, 10), M('#2a221c')), 0, -14.5, 0));
      rig.legs.push(lg);
    });
    const tail = at(new THREE.Group(), 0, 23, -21); body.add(tail);
    tail.add(inked(tube([new V3(0, 0, 0), new V3(0, -1, -4), new V3(0, -7, -7), new V3(0, -14, -6)], t => [2.6 * (1 - t * .7), 2.2 * (1 - t * .7)], (p, t, o) => o.set(1, 0, 0)), M(hairHex, {map:hairTex(hairHex, 'lock')}), .5));
    rig.tail = tail;
  } else if (R.lower === 'serpent') {
    hipY = 19;
    body.add(at(rot(inked(new THREE.TorusGeometry(10, 4.6, 10, 26), mSkin), PI / 2, 0, 0), 0, 4.6, -1));
    body.add(at(rot(inked(new THREE.TorusGeometry(7.4, 4.2, 10, 24), mSkin), PI / 2, 0, 0), 1, 11.5, -.5));
    body.add(at(inked(new THREE.CylinderGeometry(7.6, 7.6, 8, 18), mSkin), 0, 16, 0));
    const tail = at(new THREE.Group(), 9, 3, 6); body.add(tail);
    tail.add(rot(inked(new THREE.ConeGeometry(3.6, 14, 10), mSkin), PI / 2, .8, 0));
    rig.tail = tail;
  }
  if (R.tail) {
    const tail = at(new THREE.Group(), 0, hipY - 2, -6); body.add(tail);
    tail.add(at(rot(inked(new THREE.ConeGeometry(3.6 * Wd, 18, 10), mSkin), -1.2, 0, 0), 0, -4, -7));
    rig.tail = tail;
  }
  at(torso, 0, hipY, hipZ); body.add(torso);

  /* the torso itself, painted by the outfit */
  {
    const geo = surface(40, 30, (u, v, off, out) => { const ph = (u - .5) * TAU, q = spl.getPoint(v); const r = Math.max(0, q.x + extra(q.y, ph) + off * .3);
      out.set(r * Wd * Math.sin(ph), q.y, r * Wd * D * Math.cos(ph)); }, {wrap:true});
    const pos = geo.attributes.position, uv = geo.attributes.uv; for (let i = 0; i < pos.count; i++) uv.setY(i, clamp(pos.getY(i) / yTop, 0, 1));
    torso.add(inked(geo, g.torsoMat || M(main), .6));
  }
  const shY = TH - 2.6, shX = (fem ? 8.2 : 9.8) * Wd;
  /* neck and head */
  torso.add(at(new THREE.Mesh(new THREE.CylinderGeometry(3.1, 3.4, 4, 12), mSkin), 0, TH + .5, 0));
  faceFix(spec);
  const HR = 11.5 * R.head * pick(HEAD_SIZES, spec.headSize)[2], headY = TH + HR - .8, warp = headWarp(spec, R, HR);
  const head = at(new THREE.Group(), 0, headY, 0); torso.add(head); rig.head = head;
  const env = {
    back:yH => { const y = yH + headY; let z = -(rY(Math.min(y, yTop - 1.2)) + .2) * Wd * D; /* above the shoulders, keep clear of the shoulder top */ g.back.forEach(f => { const v = f(y); if (v != null) z = Math.min(z, v); }); return z; },
    front:yH => { const y = yH + headY; let z = (rY(y) + extra(y, 0) + .2) * Wd * D; g.front.forEach(f => { const v = f(y); if (v != null) z = Math.max(z, v); }); return z; },
    lowY:shY + 4.5 - headY, xMax:6.6 * Wd,
    clear:(p, gap, w = 0) => { /* push a head-space point (and a flat lock w wide either side) outside the torso shell */
      const y = p.y + headY; if (y > yTop - .3 || y < 0) return p;
      const Rw = rY(y) * Wd, dip = w > 0 ? Rw - Math.sqrt(Math.max(0, Rw * Rw - w * w)) : 0;
      const nx = p.x / Wd, nz = p.z / (Wd * D), r = Math.hypot(nx, nz), need = rY(y) + .35 + (gap + dip) / Wd;
      if (r < need && r > 1e-3) { p.x *= need / r; p.z *= need / r; }
      return p; },
    clearX:(p, gap, w = 0) => { /* like clear, counting the outfit's extra shape too (used by hair the arms push about) */
      const y = p.y + headY; if (y > yTop - .3 || y < 0) return p;
      const Rw = rY(y) * Wd, dip = w > 0 ? Rw - Math.sqrt(Math.max(0, Rw * Rw - w * w)) : 0;
      const nx = p.x / Wd, nz = p.z / (Wd * D), r = Math.hypot(nx, nz), need = rY(y) + extra(y, Math.atan2(p.x, p.z / D)) + .35 + (gap + dip) / Wd;
      if (r < need && r > 1e-3) { p.x *= need / r; p.z *= need / r; }
      return p; },
  };
  const hood = g.hood === 'up';
  if (hood) { /* the raised hood's cowl over the shoulders: falling hair has to go over it */
    const cowl = y => y > g.TH + 1.6 ? null : (lerp(5.6, rY(Math.min(y, yTop - .3)) + 1.3, sstep(g.TH + 1.2, g.TH - 4.2, y)) + 1) * Wd * D;
    g.front.push(cowl); g.back.push(y => { const v = cowl(y); return v == null ? (y > g.TH - 6 ? -(rY(Math.min(y, yTop - .3)) + 2.2) * Wd * D : null) : -v; });
  }
  head.userData.front = env.front;
  const hairInfo = R.nohair ? null : buildHair(head, HR, spec, R, M, env, hood, hairHex, warp);
  const ft = ctex(faceTex(spec, R, hairInfo && !hood ? hairInfo : null));
  const mFace = M(0xffffff, {map:ft, gradientMap:SOFT}); rig.face = mFace;
  head.add(inked(headGeo(HR, warp), mFace, .65));
  if (R.beast !== 'bug') { const fm = faceSheetMesh(HR, warp, ctex(faceSheet(spec, R)), M); head.add(fm); rig.faceSheet = fm; }
  headExtras(head, HR, R, spec, M, mSkin, hairHex, hairInfo, hood);
  if (g.hood) hoodParts(head, HR, g, headY);
  if (g.after) g.after(head, HR, headY);
  if (warp) warpHead(head, warp);
  /* arms */
  rig.arms = [-1, 1].map(s => {
    const sh = at(new THREE.Group(), s * shX, shY, 0); torso.add(sh);
    const hand = armParts(sh, s, g); sh.rotation.z = s * .2;
    return {sh, hand};
  });
  rig.armL = rig.arms[0]; rig.armR = rig.arms[1];
  rig.w = {sword:sword(), bow:bow(), staff:staff()};
  rig.armR.hand.add(rot(rig.w.sword, PI / 2 - .25, 0, 0));
  rig.armL.hand.add(rot(rig.w.bow, PI / 2, 0, 0));
  rig.armR.hand.add(at(rot(rig.w.staff, PI / 2, 0, 0), 0, 0, -4));
  Object.values(rig.w).forEach(w => w.visible = false);
  rig.h = hipY + TH + HR * 2 + 6;
  rig.dbg = {rY, extra, Wd, D, yTop, HR, AL:9 * (.7 + .3 * H), ar:2.9 * Wd};
  /* hair that the arms can push aside (locks, braids, ringlets): keep the rest shape to start from each frame */
  softSetup(rig, head, env);
  if (opt.scale) root.scale.setScalar(opt.scale);
  return rig;
}

/* ---------- arms, legs ---------- */
function armParts(sh, s, g){
  const {H, Wd, M, MM, mSkin} = g, AL = 9 * (.7 + .3 * H), ar = 2.9 * Wd, sl = g.sleeve, col = c => c === 'skin' ? mSkin : typeof c === 'string' ? M(c) : c;
  const sMat = sl.mat || (sl.col ? col(sl.col) : M(g.main));
  const cap = (r, len, mat, y, t = .55) => sh.add(at(inked(new THREE.CapsuleGeometry(r, Math.max(.1, len), 6, 14), mat, t), 0, y, 0));
  const ring = (r, tube, y, mat, sc = 1) => sh.add(at(rot(inked(new THREE.TorusGeometry(r, tube, 8, 22), mat, .4), PI / 2, 0, 0), 0, y, 0));
  if (sl.type === 'rolled' || sl.type === 'short') {
    cap(ar * 1.02, AL * .34, sMat, -1 - AL * .2);
    cap(ar * .86, AL * .6, mSkin, -1 - AL * .68);
    ring(ar * 1.02, ar * .34, -1 - AL * .48, sl.cuffMat || sMat);
  } else if (sl.type === 'bell') {
    cap(ar, AL * .7, sMat, -1 - AL * .4);
    const bellLen = AL * .78, y0 = -1 - AL * .36, rb = ar * 1.75;
    sh.add(inked(surface(28, 8, (u, v, off, out) => { const a = u * TAU, r = lerp(ar * 1.05, rb, Math.pow(v, 1.5)) + .25 * Math.sin(a * 5) * v + off * .45; out.set(r * Math.sin(a), y0 - v * bellLen - Math.max(0, -Math.cos(a)) * v * 1.2, r * Math.cos(a)); }, {thick:true, wrap:true, open0:true}), [sMat, sl.lining || sMat], .45));
    if (sl.trim) sh.add(inked(surface(28, 2, (u, v, off, out) => { const a = u * TAU, vv = 1 - v * .1, r = lerp(ar * 1.05, rb, Math.pow(vv, 1.5)) + .25 * Math.sin(a * 5) * vv + .1 + off * .6; out.set(r * Math.sin(a), y0 - vv * bellLen - Math.max(0, -Math.cos(a)) * vv * 1.2, r * Math.cos(a)); }, {thick:true, wrap:true}), M(sl.trim), .35));
  } else if (sl.type === 'puff') {
    sh.add(at(inked(new THREE.SphereGeometry(ar * 1.42, 18, 14), sMat, .55), 0, -1.6, 0));
    if (sl.slash) for (let i = 0; i < 5; i++) { const a = i / 5 * TAU; sh.add(at(rot(new THREE.Mesh(new THREE.CapsuleGeometry(.45, ar * 1.6, 3, 6), M(sl.slash)), 0, 0, 0), Math.sin(a) * ar * 1.4, -1.6, Math.cos(a) * ar * 1.4)); }
    cap(ar * .86, AL * .62, sl.lower ? col(sl.lower) : sMat, -1 - AL * .62);
  } else if (sl.type === 'plate') {
    const m = MM(sl.metal || STEEL);
    cap(ar * .88, AL * .9, M(sl.under || '#3a3a40'), -1 - AL * .5);
    sh.add(at(inked(new THREE.CylinderGeometry(ar * 1.08, ar * 1.0, AL * .36, 16), m, .45), 0, -1 - AL * .2, 0));
    sh.add(at(inked(new THREE.SphereGeometry(ar * 1.02, 14, 10), m, .45), 0, -1 - AL * .48, .3));
    sh.add(at(rot(inked(new THREE.CylinderGeometry(ar * .2, ar * 1.25, 1.4, 14), m, .35), PI / 2, 0, 0), 0, -1 - AL * .48, ar * .9));
    sh.add(at(inked(new THREE.CylinderGeometry(ar * .98, ar * 1.1, AL * .38, 16), m, .45), 0, -1 - AL * .78, 0));
  } else cap(ar, AL, sl.type === 'bare' ? mSkin : sMat, -AL / 2 - 1);
  if (g.bracer) { const bm = col(g.bracer); sh.add(at(inked(new THREE.CylinderGeometry(ar * 1.12, ar * 1.2, AL * .36, 16), bm, .45), 0, -1 - AL * .8, 0));
    [-.1, .1].forEach(k => sh.add(at(rot(new THREE.Mesh(new THREE.TorusGeometry(ar * 1.2, .28, 6, 20), M(g.bracerStrap || DLEATHER)), PI / 2, 0, 0), 0, -1 - AL * (.8 + k * 1.2), 0))); }
  const hand = at(new THREE.Group(), 0, -AL - 5, 0); sh.add(hand);
  const gl = g.glove, handMat = g.R.beast === 'bird' ? M('#c9a24a') : gl === 'gauntlet' ? MM(g.sleeve.metal || STEEL) : gl ? col(gl) : mSkin;
  hand.add(inked(new THREE.SphereGeometry(3.1 * Wd, 16, 12), handMat, .5));
  if (gl === 'gauntlet') hand.add(at(inked(new THREE.CylinderGeometry(ar * 1.15, ar * .95, 2.6, 14), handMat, .4), 0, 2.6, 0));
  else if (gl && g.gloveCuff) hand.add(at(inked(new THREE.CylinderGeometry(ar * 1.12, ar * .95, 2.2, 14), col(gl), .4), 0, 2.4, 0));
  const pd = g.pauld && (!g.pauld.one || g.pauld.one === s) ? g.pauld : null;
  if (pd) {
    const pm = pd.metal ? MM(pd.metal) : col(pd.col), n = pd.layers || 1;
    for (let i = n - 1; i >= 0; i--) {
      const r = (5.3 - i * .25) * Wd, capA = (i ? .36 : .44) * PI, y = 1.4 - i * 2.1, th = .55;
      const geo = surface(28, 7, (u, v, off, out) => { const a = u * TAU, p = v * capA, rr = r + off * th; out.set(rr * Math.sin(p) * Math.sin(a), rr * Math.cos(p) - r * .55, rr * Math.sin(p) * Math.cos(a) * 1.04); }, {thick:true, wrap:true, open0:true});
      const m = inked(geo, pm, .45); m.scale.set(1, .78, 1); m.rotation.z = -s * (.22 + i * .12); at(m, s * (.9 + i * .5), y, 0); sh.add(m);
    }
    if (pd.trim) { const t = rot(inked(new THREE.TorusGeometry(5.3 * Wd * Math.sin(.44 * PI) * .98, .45, 6, 30), M(pd.trim), .3), PI / 2, 0, 0); t.scale.set(1, 1.04, 1); const w = new THREE.Group(); w.add(at(t, 0, 5.3 * Wd * Math.cos(.44 * PI) - 5.3 * Wd * .55, 0)); w.scale.set(1, .78, 1); w.rotation.z = -s * .22; at(w, s * .9, 1.4, 0); sh.add(w); }
  }
  return hand;
}
function legParts(lg, s, legH, g){
  const {Wd, M, MM, H} = g, L = g.legs, b = L.boots || {}, pr = 3.3 * Wd;
  const pm = L.metal ? MM(L.metal) : M(L.pants);
  const bootH = (b.h || 5) * (.75 + .25 * H), floor = -legH;
  lg.add(at(inked(new THREE.CapsuleGeometry(pr, Math.max(.5, legH - bootH - 1.5), 6, 14), pm, .55), 0, -(legH - bootH) / 2 + .6, 0));
  if (L.rolled) lg.add(at(rot(inked(new THREE.TorusGeometry(pr * 1.02, .9, 8, 20), M(L.rolled), .4), PI / 2, 0, 0), 0, floor + bootH + 1.4, 0));
  if (L.metal) { lg.add(at(inked(new THREE.SphereGeometry(pr * .92, 14, 10), MM(L.metal), .4), 0, -legH * .44, 1.1));
    lg.add(at(rot(inked(new THREE.CylinderGeometry(pr * .25, pr * 1.1, 1.2, 14), MM(L.metal), .3), PI / 2 - .2, 0, 0), 0, -legH * .44, pr * .95)); }
  const bm = b.metal ? MM(b.metal) : M(b.col || DLEATHER);
  lg.add(at(inked(new THREE.CylinderGeometry(pr * 1.1, pr * 1.16, bootH, 16), bm, .5), 0, floor + .9 + bootH / 2, 0));
  const foot = inked(new THREE.SphereGeometry(pr * 1.05, 16, 12), bm, .5); foot.scale.set(1, .6, 1.5); at(foot, 0, floor + 1.9, 1.7); lg.add(foot);
  const sole = inked(new THREE.CylinderGeometry(pr * 1.12, pr * 1.12, 1.1, 16), M(b.sole || '#2a1c12'), .4); sole.scale.set(1, 1, 1.42); at(sole, 0, floor + .55, 1.3); lg.add(sole);
  if (b.cuff) lg.add(at(inked(new THREE.CylinderGeometry(pr * 1.34, pr * 1.18, 2.2, 16), M(b.cuff === true ? shade(b.col || DLEATHER, 1.25) : b.cuff), .45), 0, floor + .9 + bootH - .3, 0));
  if (b.fur) { const fm = M(b.fur); for (let i = 0; i < 9; i++) { const a = i / 9 * TAU; lg.add(at(inked(new THREE.SphereGeometry(1.7 * Wd, 10, 8), fm, .35), Math.sin(a) * pr * 1.22, floor + bootH + .4 + (i % 2) * .6, Math.cos(a) * pr * 1.22)); } }
  if (b.buckle) lg.add(at(inked(new THREE.BoxGeometry(1.8, 1.2, .5), MM(b.buckle), .25), 0, floor + bootH * .7, pr * 1.18));
}

/* ---------- head extras, hair, beards, hoods ---------- */
function buildHair(head, HR, spec, R, M, env, hood, hairHex, warp){
  if (R.snakes) return {snakes:true};
  const id = hairId(spec.hair), H = hairReady.get(id), info = {style:id, edge:null, shave:null, roundEars:true, ink:false};
  if (!H) return info;
  info.roundEars = !H.ears; info.edge = H.edge;
  const kind = HAIR_LEN[id], L = clamp(spec.len ?? .5, 0, 1), step = L < .34 ? 0 : L < .67 ? 1 : 2;
  const stretch = kind === 'Length' ? [.55, 1, 1.5][step] : 1, lift = kind === 'Height' ? [.6, 1, 1.4][step] : 1;
  const n = H.pos.length / 3, pos = new Float32Array(n * 3), nrm = new Float32Array(H.nrm), yN = -.55 * HR, p = new V3(), vis = new Uint8Array(n).fill(1);
  /* with a hood up: how far inside the hood's face opening a point is (radians, below 0 it's under the hood); same opening as hoodParts */
  const opening = q => { const l = q.length() || 1, psi = Math.acos(clamp(q.z / l, -1, 1)), chi = Math.atan2(q.y, q.x), c = Math.cos(chi), s = Math.sin(chi), b = s > 0 ? 62 : 84;
    return 1 / Math.sqrt(c * c / (58 * 58) + s * s / (b * b)) * DEG - psi; };
  for (let i = 0; i < n; i++) {
    p.fromArray(H.pos, i * 3).multiplyScalar(HR);
    if (lift !== 1 && p.y > -.2 * HR) { const l = p.length(); if (l > HR) p.multiplyScalar((HR + (l - HR) * lift) / l); } /* Height: crests stand taller or lower */
    if (p.y < yN) { p.y = yN + (p.y - yN) * stretch; nrm[i * 3 + 1] /= stretch; } /* Length: what hangs below the jaw */
    if (warp) warp(p); /* the head's shape */
    if (hood) { /* only what shows at the hood's opening; near its rim the hair tucks under it */
      const op = opening(p); vis[i] = op > 1.5 * DEG ? 1 : 0;
      if (p.y > -HR * .25) { const rm = HR * (op < 4 * DEG ? .95 : 1.02 + .1 * sstep(4 * DEG, 24 * DEG, op)), l = p.length(); if (l > rm) p.multiplyScalar(rm / l); }
      else if (vis[i]) { const zf = env.front(p.y) + .4; if (p.z < zf && Math.abs(p.x) < env.xMax * 1.3) p.z = zf; }
    } else if (p.y < -.4 * HR) env.clearX(p, .3);
    p.toArray(pos, i * 3);
    const nl = Math.hypot(nrm[i * 3], nrm[i * 3 + 1], nrm[i * 3 + 2]) || 1; nrm[i * 3] /= nl; nrm[i * 3 + 1] /= nl; nrm[i * 3 + 2] /= nl;
  }
  /* triangles: with a hood, keep those that show at the opening (or tuck under its rim) */
  const keep = (a, b, c) => !hood || (vis[a] && vis[b] && vis[c]) || ((vis[a] || vis[b] || vis[c]) && pos[a * 3 + 1] > -HR * .25 && pos[b * 3 + 1] > -HR * .25 && pos[c * 3 + 1] > -HR * .25);
  const idx = [], mats = [], geo = new THREE.BufferGeometry();
  const mHair = M(0xffffff, {std:true, map:H.map, normalMap:H.nmap || null, roughness:.5}); mHair.color.set(hairHex).multiplyScalar(H.k); mHair.userData.base = mHair.color.clone();
  H.groups.forEach(g => { const start = idx.length;
    for (let t = g.s; t < g.s + g.c; t += 3) { const a = H.idx[t], b = H.idx[t + 1], c = H.idx[t + 2]; if (keep(a, b, c)) idx.push(a, b, c); }
    if (idx.length === start) return; geo.addGroup(start, idx.length - start, mats.length); mats.push(g.tie ? M(g.tie, {std:true, roughness:.45}) : mHair); });
  if (!idx.length) return info;
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3)); geo.setAttribute('normal', new THREE.BufferAttribute(nrm, 3));
  geo.setAttribute('uv', new THREE.BufferAttribute(H.uv, 2)); geo.setIndex(idx);
  geo.userData.warped = true; /* already shaped with the head (warp above) */
  const mesh = new THREE.Mesh(geo, mats); mesh.userData.hair = 1;
  const lat = hairLattice(pos, HR); if (lat) { mesh.userData.lattice = lat; mesh.frustumCulled = false; }
  head.add(mesh);
  return info;
}
/* arms push hanging hair aside: what hangs below the jaw is split into columns round the head (12) and bands down it (1.6 units);
   each column is a chain of rings like a lock (see softHair), and every vertex follows the four rings around it, blended,
   so the hair bends smoothly round an arm instead of tearing between columns */
function hairLattice(pos, HR){
  const yA = -.35 * HR, hb = 1.6, S = 12, n = pos.length / 3, cells = new Map(), v = new V3();
  const cellOf = (s, b) => s * 1000 + b;
  for (let i = 0; i < n; i++) { v.fromArray(pos, i * 3); if (v.y >= yA) continue;
    const s = Math.floor((Math.atan2(v.x, v.z) + PI) / TAU * S) % S, b = Math.floor((yA - v.y) / hb), k = cellOf(s, b);
    let c = cells.get(k); if (!c) { c = {s, b, sum:new V3(), q:0, cnt:0}; cells.set(k, c); } c.sum.add(v); c.q += v.lengthSq(); c.cnt++; }
  if (!cells.size) return null;
  const list = [...cells.values()], index = new Map();
  list.forEach((c, i) => { c.c = c.sum.clone().divideScalar(c.cnt); c.r = clamp(Math.sqrt(Math.max(0, c.q / c.cnt - c.c.lengthSq())), .8, 2.4); c.n = c.c.clone(); c.refs = []; index.set(cellOf(c.s, c.b), i); });
  const vc = new Int32Array(n * 4).fill(-1), vw = new Float32Array(n * 4);
  for (let i = 0; i < n; i++) { v.fromArray(pos, i * 3); if (v.y >= yA + hb / 2) continue;
    const sc = (Math.atan2(v.x, v.z) + PI) / TAU * S - .5, s0f = Math.floor(sc), ws = sc - s0f, s0 = (s0f % S + S) % S, s1 = (s0 + 1) % S;
    const bc = (yA - v.y) / hb - .5, b0 = Math.floor(bc), wb = bc - b0;
    [[s0, b0, (1 - ws) * (1 - wb)], [s1, b0, ws * (1 - wb)], [s0, b0 + 1, (1 - ws) * wb], [s1, b0 + 1, ws * wb]].forEach(([s, b, w], j) => {
      const ci = b < 0 ? undefined : index.get(cellOf(s, b)); if (ci !== undefined) { vc[i * 4 + j] = ci; vw[i * 4 + j] = w; } }); }
  const locks = []; for (let s = 0; s < S; s++) { const rings = list.filter(c => c.s === s).sort((a, b) => a.b - b.b); if (rings.length) locks.push(rings); }
  return {cells:list, locks, vc, vw};
}
function headExtras(head, HR, R, spec, M, mSkin, hairHex, hair, hood){
  let ears = R.ears; const skin = mSkin;
  if (hood) ears = 'none';
  if (ears === 'round' && (!hair || hair.roundEars)) [-1, 1].forEach(s => { const e = inked(new THREE.SphereGeometry(2.8, 16, 12), skin, .45); e.scale.set(.5, 1, .78); e.rotation.y = s * .25; head.add(at(e, s * HR * .96, -1.2, -.6));
    const c = new THREE.Mesh(new THREE.SphereGeometry(1.6, 12, 10), M(shade((R.skins[spec.skin] || R.skins[0]).c, .82))); c.scale.set(.3, 1, .7); head.add(at(c, s * (HR * .96 + 1.05), -1.2, -.35)); });
  if (ears === 'pointy' || ears === 'long' || ears === 'goblin') [-1, 1].forEach(s => {
    const L = ears === 'long' ? 11 : ears === 'goblin' ? 12 : 6.5, r = ears === 'goblin' ? 4.6 : 2.5;
    const e = inked(new THREE.ConeGeometry(r, L, 12), skin, .5); e.scale.z = .45;
    e.rotation.z = -s * (PI / 2 - (ears === 'goblin' ? .15 : .55)); at(e, s * (HR * .9 + L * .35), 1.5, -1); head.add(e); });
  if (ears === 'wolf' || ears === 'goat') [-1, 1].forEach(s => { const e = inked(new THREE.ConeGeometry(3.6, 8, 4), skin, .5); e.rotation.z = -s * .45; at(e, s * HR * .62, HR * .82, -1.5); if (ears === 'goat') { e.rotation.z = -s * 1.3; at(e, s * HR * .98, 2, 0); } head.add(e); });
  if (ears === 'fins') [-1, 1].forEach(s => { const f = new THREE.Mesh(new THREE.CircleGeometry(8, 12, -.9, 1.8), toon(mix(R.skins[spec.skin].c, '#ffffff', .25), {side:THREE.DoubleSide})); f.rotation.y = s * PI / 2; f.rotation.z = s > 0 ? 0 : PI; at(f, s * HR * .95, 1, -1); head.add(f); });
  if (R.nose) head.add(at(inked(new THREE.SphereGeometry(3.1, 14, 10), skin, .45), 0, -2.2, HR * .98));
  if (R.tusks) [-1, 1].forEach(s => head.add(at(rot(inked(new THREE.ConeGeometry(1.4, 5, 8), M('#f2ead2'), .4), -.3, 0, s * -.2), s * 4.6, -HR * .52, HR * .82)));
  if (R.horns && !hood) [-1, 1].forEach(s => { const h = inked(new THREE.TorusGeometry(5.4, 1.9, 8, 16, PI * 1.25), M('#d8ccb0'), .45); h.rotation.set(0, s * PI / 2, s > 0 ? .3 : PI - .3); at(h, s * 6.2, HR * .92, -1.5); head.add(h); });
  if (R.beast === 'wolf') { const sn = inked(new THREE.CapsuleGeometry(4.6, 6, 6, 12), skin, .5); sn.rotation.x = PI / 2; head.add(at(sn, 0, -3.2, HR * .82));
    head.add(at(new THREE.Mesh(new THREE.SphereGeometry(1.8, 10, 8), M('#1a1414')), 0, -2, HR + 5.2)); }
  if (R.beast === 'bird') { const b = inked(new THREE.ConeGeometry(3.4, 9, 10), M('#d9a83a'), .5); b.rotation.x = PI / 2; at(b, 0, -2.5, HR + 3.2); head.add(b);
    for (let i = 0; i < 3; i++) { const f = inked(new THREE.ConeGeometry(1.8, 8, 6), M(hairHex), .4); f.rotation.x = -.9 - i * .25; at(f, (i - 1) * 2.5, HR * .9, -2 - i); head.add(f); } }
  if (R.beast === 'lizard') { const sn = inked(new THREE.SphereGeometry(5.2, 16, 12), skin, .5); sn.scale.set(1, .62, 1.3); at(sn, 0, -3.5, HR * .78); head.add(sn);
    for (let i = 0; i < 4; i++) { const c = inked(new THREE.ConeGeometry(1.6, 5, 6), M(hairHex), .35); c.rotation.x = -.5; at(c, 0, HR * (.98 - i * .1), 3 - i * 4); head.add(c); } }
  if (R.beast === 'fish') { head.add(at(inked(new THREE.TorusGeometry(2, 1, 8, 14), M('#e08a7a'), .35), 0, -5, HR * .95));
    const d = new THREE.Mesh(new THREE.CircleGeometry(8, 12, 0, PI), toon(mix(R.skins[spec.skin].c, '#ffffff', .25), {side:THREE.DoubleSide})); d.rotation.y = PI / 2; at(d, 0, HR * .8, -2); head.add(d); }
  if (R.beast === 'bug') { const em = M(pick(EYES, spec.eyes)[2]);
    [-1, 1].forEach(s => { head.add(at(inked(new THREE.SphereGeometry(4.4, 16, 12), em, .5), s * 5.2, 1, HR * .78));
      head.add(at(new THREE.Mesh(new THREE.SphereGeometry(1.4, 8, 6), new THREE.MeshBasicMaterial({color:0xffffff})), s * 4.4 + 1, 3, HR * .78 + 3.4));
      const a = new THREE.Group(); at(a, s * 3, HR * .85, 2); a.rotation.set(-.5, 0, -s * .5); head.add(a);
      a.add(at(new THREE.Mesh(new THREE.CylinderGeometry(.5, .5, 11, 6), M('#1a1a1a')), 0, 5.5, 0)); a.add(at(new THREE.Mesh(new THREE.SphereGeometry(1.4, 8, 6), M('#1a1a1a')), 0, 11, 0));
      head.add(at(rot(inked(new THREE.ConeGeometry(1.1, 5, 6), M('#2a2a2a'), .35), PI * .6, 0, s * .4), s * 2.4, -HR * .6, HR * .75)); }); }
  if (R.snakes && !hood) snakes(head, HR, M, hairHex);
  if (!R.nohair && !R.snakes) beard(head, HR, spec, M, hairHex);
}
function snakes(head, HR, M, hex){
  const mS = M(0xffffff, {map:hairTex(hex, 'lock')}), geos = [], heads = [], eyes = [];
  const list = [];
  for (let i = 0; i < 7; i++) list.push([lerp(48, 312, i / 6), 34]);
  for (let i = 0; i < 6; i++) list.push([lerp(70, 290, i / 5), 66]);
  list.push([0, 8]);
  list.forEach(([a, pDeg], i) => {
    const th = a * DEG, ph = pDeg * DEG, n = new V3(Math.sin(ph) * Math.sin(th), Math.cos(ph), Math.sin(ph) * Math.cos(th)), side = new V3(Math.cos(th), 0, -Math.sin(th)), upv = new V3(0, 1, 0);
    const k = (i * 37 % 7) / 7 - .5, len = pDeg > 50 ? 1.15 : 1;
    const p0 = n.clone().multiplyScalar(HR * .93), p1 = p0.clone().addScaledVector(n, 3.6 * len).addScaledVector(side, k * 2);
    const p2 = p1.clone().addScaledVector(n, 2.6 * len).addScaledVector(upv, -2.6).addScaledVector(side, -k * 3);
    const p3 = p2.clone().addScaledVector(n, 2 * len).addScaledVector(upv, 1.4).addScaledVector(side, k * 2);
    geos.push(tube([p0, p1, p2, p3], t => [1.55 * (1 - t * .25), 1.45 * (1 - t * .25)], (p, t, o) => o.copy(n), {nS:18, nR:10}));
    const dir = p3.clone().sub(p2).normalize().addScaledVector(n, .6).normalize(), hp = p3.clone().addScaledVector(dir, 1.3);
    const q = new THREE.Quaternion().setFromUnitVectors(new V3(0, 0, 1), dir);
    const hd = new THREE.SphereGeometry(1, 14, 10); xf(hd, hp, q, new V3(1.75, 1.35, 2.5)); heads.push(hd);
    [-1, 1].forEach(sx => { const e = new THREE.SphereGeometry(.42, 8, 6); xf(e, hp.clone().add(new V3(sx * 1.25, .55, .5).applyQuaternion(q)), q); eyes.push(e); });
  });
  head.add(inked(merge(geos.concat(heads)), mS, .4));
  head.add(new THREE.Mesh(merge(eyes), M('#1a1010')));
}
const beardTop = th => lerp(131, 92, sstep(8, 70, Math.abs(th) / DEG)) * DEG;
function beard(head, HR, spec, M, hairHex){
  const b = spec.beard; if (!b || b === 'none' || b === 'stubble') return;
  const mB = M(0xffffff, {map:hairTex(hairHex, 'lock')}), geos = [];
  const sp = (th, ph, r) => new V3(r * Math.sin(ph) * Math.sin(th), r * Math.cos(ph), r * Math.sin(ph) * Math.cos(th));
  const up = (p, t, o) => o.set(p.x, p.y * .25, p.z);
  const must = (W, Ht) => t => { const f = t < .25 ? lerp(.7, 1, t / .25) : Math.pow(Math.cos((t - .25) / .75 * PI / 2), .8); return [W * f, Ht * (.5 + .5 * f) * Math.min(1, (1 - t) * 8)]; };
  [-1, 1].forEach(s => geos.push(tube([sp(s * 1 * DEG, 111 * DEG, HR + .1), sp(s * 10 * DEG, 112 * DEG, HR + .55), sp(s * 19 * DEG, 116 * DEG, HR + .55), sp(s * 25 * DEG, 124 * DEG, HR + .35)], must(1.25, .62), up, {nS:12, nR:8})));
  if (b !== 'moustache') {
    const lift = (th, ph) => .1 + .08 * Math.exp(-Math.pow(th / .55, 2)) + .05 * Math.exp(-Math.pow(th / .4, 2)) * sstep(140 * DEG, 160 * DEG, ph);
    const top = beardTop;
    const geo = surface(72, 18, (u, v, off, out) => {
      const th = (u - .5) * 2 * 84 * DEG, t0 = top(th), ph = lerp(t0, 172 * DEG, v);
      const eu = Math.min(u, 1 - u) / .12, ev = (ph - t0) / (12 * DEG), k = Math.sqrt(Math.max(0, 1 - Math.pow(1 - Math.min(1, eu), 2))) * Math.sqrt(Math.max(0, 1 - Math.pow(1 - Math.min(1, ev), 2)));
      const gr = 1 - .3 * Math.pow(1 - Math.abs(Math.cos(th * 6.5)), 4) * sstep(.1, .45, v); /* clumps running down the beard */
      const r = HR * (1 + lift(th, ph) * k * gr) - .25 + off * .3; out.set(r * Math.sin(ph) * Math.sin(th), r * Math.cos(ph), r * Math.sin(ph) * Math.cos(th));
    }, {us:3});
    head.add(inked(geo, M(0xffffff, {map:hairTex(hairHex, 'beard')}), .45));
  }
  if (b === 'long' || b === 'braided') {
    const chin = sp(0, 150 * DEG, HR * 1.06), yEnd = -HR * (b === 'long' ? 1.85 : 1.7);
    const fz = y => Math.max(head.userData.front ? head.userData.front(y) : 0, 0);
    const chest = (k, x0, x1, y1, cl) => { const pts = [], n = 7; let zPrev = chin.z; for (let i = 1; i <= n; i++) { const t = i / n, y = lerp(-HR * 1.02, y1, t);
      let z = fz(y) + cl; for (let j = 0; j <= 4; j++) z = Math.max(z, fz(y + j * .6) + cl); zPrev = Math.max(z, zPrev - 1.2); pts.push(new V3(lerp(x0, x1, t), y, zPrev)); } return pts; };
    if (b === 'long') [[0, 4.6, 0], [-1, 3, -.5], [1, 3, -.5]].forEach(([k, w, dy]) => {
      const pts = [sp(k * 18 * DEG, 140 * DEG, HR * .98), chin.clone().add(new V3(k * 3, 0, 0))].concat(chest(k, k * 4, k * 1.2, yEnd + Math.abs(k) * 2.5, 2));
      geos.push(tube(pts, t => { const f = t < .2 ? 1 : Math.pow(Math.cos((t - .2) / .8 * PI / 2), .7); return [w * f, 1.8 * (.5 + .5 * f) * Math.min(1, (1 - t) * 8)]; }, (p, t, o) => o.set(0, 0, 1), {nS:18, nR:8}));
    });
    else {
      const pts = [chin.clone()].concat(chest(0, 0, 0, yEnd, 2.4));
      const cv = new THREE.CatmullRomCurve3(pts), lob = [];
      for (let i = 0; i < 6; i++) { const t = (i + .5) / 7, p = cv.getPointAt(t), r = lerp(2.3, 1.5, t); const q = new THREE.Quaternion().setFromUnitVectors(new V3(0, 1, 0), cv.getTangentAt(t)).multiply(new THREE.Quaternion().setFromAxisAngle(new V3(0, 0, 1), i % 2 ? .5 : -.5));
        const l = new THREE.SphereGeometry(1, 12, 10); xf(l, p.clone().add(new V3((i % 2 ? 1 : -1) * r * .3, 0, 0)), q, new V3(r, r * 1.3, r * .8)); lob.push(l); }
      head.add(inked(merge(lob), mB, .4));
      head.add(at(inked(new THREE.CylinderGeometry(1.3, 1.3, 1.4, 12), M('#c9a24a'), .3), 0, yEnd + 1.2, pts[pts.length - 1].z));
    }
  }
  const bm = inked(merge(geos), mB, .4); bm.userData.hair = 1; head.add(bm);
}
function hoodParts(head, HR, g, headY){
  const {M, main} = g, hc = g.hoodCol || main, mOut = M(hc), mIn = M(shade(hc, .55));
  if (g.hood === 'up') {
    const tip = new V3(0, .22, -1).normalize(), tip2 = new V3(0, -.35, -1).normalize();
    const geo = surface(56, 22, (u, v, off, out) => {
      const chi = u * TAU, c = Math.cos(chi), s = Math.sin(chi), b = s > 0 ? 62 : 84;
      const po = 1 / Math.sqrt(c * c / (58 * 58) + s * s / (b * b)) * DEG, psi = lerp(po, PI, v);
      const d = new V3(Math.sin(psi) * c, Math.sin(psi) * s, Math.cos(psi));
      const pk = Math.exp(-Math.pow(d.angleTo(tip) / .34, 2)) * HR * .5 + Math.exp(-Math.pow(d.angleTo(tip2) / .5, 2)) * HR * .12;
      const ridge = Math.exp(-Math.pow(d.x / .07, 2)) * Math.max(0, -d.z) * Math.max(0, d.y + .3) * .5;
      const fold = Math.max(0, -d.z) * sstep(.25, .7, v) * Math.pow(Math.abs(Math.sin(Math.atan2(d.x, -d.z) * 3.5)), 2) * HR * .03; /* soft folds falling down the back */
      const rim = (1 - sstep(0, .1, v)) * HR * .05; /* the opening's edge rolls outward a little */
      const thk = .65 + .8 * (1 - sstep(0, .14, v));
      const r = HR * 1.1 + HR * .13 * Math.pow(Math.max(0, -d.z), 1.5) + pk + ridge + fold + rim + off * thk;
      out.copy(d).multiplyScalar(r);
    }, {thick:true, wrap:true, open1:true});
    head.add(inked(geo, [mOut, mIn], .55));
    { /* the hood's point droops down the back of the head */
      const p0 = tip.clone().multiplyScalar(HR * 1.62), p1 = new V3(0, -HR * .02, -HR * 1.74), p2 = new V3(0, -HR * .5, -HR * 1.6), p3 = new V3(0, -HR * .95, -HR * 1.38);
      const st = tube([tip.clone().multiplyScalar(HR * 1.3), p0, p1, p2, p3], t => [lerp(4.2, .5, Math.pow(t, .9)), lerp(2.8, .45, t)], (p, t, o) => o.set(0, .25, -1), {nS:24, nR:10});
      head.add(inked(st, mOut, .5)); }
    const y0 = g.TH + 1.2, y1 = g.TH - 4.2;
    g.torso.add(inked(surface(48, 6, (u, v, off, out) => { const ph = (u - .5) * TAU, f = Math.cos(ph), yb = y1 - 1.6 * Math.pow(Math.max(0, f), 6) - .8 * Math.pow(Math.max(0, -f), 4);
      const y = lerp(y0, yb, v), r0 = 5.6, r1 = g.rY(y) + 1.3, r = lerp(r0, r1, sstep(0, 1, v)) + off * .55;
      out.set(r * g.Wd * Math.sin(ph), y, r * g.Wd * g.D * Math.cos(ph)); }, {thick:true, wrap:true}), [mOut, mIn], .5));
  } else {
    const backAt = y => { let z = -(g.rY(y) * g.Wd * g.D + .3); g.back.forEach(f => { const v = f(y); if (v != null) z = Math.min(z, v); }); return z; };
    const lift = Math.max(0, -backAt(g.TH - 2) - (g.rY(g.TH - 2) * g.Wd * g.D + .3));
    const geo = surface(40, 10, (u, v, off, out) => { const a = lerp(-1.35, 1.35, u) + PI, ry = 6.2 + lift * .6 + 1.8 * Math.cos(u * PI - PI / 2), tubeR = 2 + 1.1 * Math.sin(u * PI);
      const cx = ry * Math.sin(a), cz = ry * Math.cos(a) * 1.02, b = v * TAU, rr = tubeR + off * .2;
      out.set(cx + Math.sin(a) * Math.cos(b) * rr, g.TH + .4 + Math.sin(b) * rr * .8, cz + Math.cos(a) * Math.cos(b) * rr); }, {wrap:false});
    g.torso.add(inked(geo, mOut, .5));
    const pouch = surface(24, 10, (u, v, off, out) => { const a = (u - .5) * 2.2, y = g.TH - .5 - v * 8, w = 6.4 * Math.sin(Math.min(1, (1 - v * .7)) * PI / 2) * (1 - v * .35), d = 2.6 * Math.sin(v * PI * .8 + .25) + off * .5;
      out.set(Math.sin(a) * w, y, backAt(y) - .2 - d * Math.cos(a)); }, {thick:true});
    g.torso.add(inked(pouch, [mOut, mIn], .5));
    const bz = y => backAt(y) - 3.4; g.back.push(y => y > g.TH - 9 && y < g.TH + 3 ? bz(y) : null);
  }
}

/* ---------- outfits: each paints the torso and adds its own pieces ---------- */
function painter(g, base){
  const cv = canvas(512, 256), x = cv.getContext('2d');
  const X = ph => 256 + ph / TAU * 512, Y = y => (1 - y / g.yTop) * 256;
  if (base) { x.fillStyle = base; x.fillRect(0, 0, 512, 256); }
  const p = {cv, x, X, Y,
    seams(c){ x.strokeStyle = c; x.lineWidth = 2; [-PI / 2, PI / 2].forEach(a => { x.beginPath(); x.moveTo(X(a), 0); x.lineTo(X(a), 256); x.stroke(); }); },
    vneck(dep, w, fill, edge, laces){
      x.fillStyle = fill; x.beginPath(); x.moveTo(256 - w, 0); x.quadraticCurveTo(256 - w * .3, dep * .6, 256, dep); x.quadraticCurveTo(256 + w * .3, dep * .6, 256 + w, 0); x.fill();
      x.strokeStyle = edge; x.lineWidth = 3; x.beginPath(); x.moveTo(256 - w, 0); x.quadraticCurveTo(256 - w * .3, dep * .6, 256, dep); x.quadraticCurveTo(256 + w * .3, dep * .6, 256 + w, 0); x.stroke();
      if (laces) { x.strokeStyle = laces; x.lineWidth = 1.8; for (let i = 0; i < 3; i++) { const yy = dep * (.2 + i * .25), hw = w * (1 - yy / dep) * .8 + 3; x.beginPath(); x.moveTo(256 - hw, yy); x.lineTo(256 + hw, yy + dep * .18); x.moveTo(256 + hw, yy); x.lineTo(256 - hw, yy + dep * .18); x.stroke(); } }
    },
    stitch(pts, c, w = 1.6){ x.strokeStyle = c; x.lineWidth = w; x.setLineDash([4, 3]); x.beginPath(); pts.forEach(([a, b], i) => x[i ? 'lineTo' : 'moveTo'](a, b)); x.stroke(); x.setLineDash([]); },
    dot(px, py, r, c, hl){ x.fillStyle = c; x.beginPath(); x.arc(px, py, r, 0, TAU); x.fill(); if (hl) { x.fillStyle = hl; x.beginPath(); x.arc(px - r * .35, py - r * .35, r * .4, 0, TAU); x.fill(); } },
    band(y0, y1, c){ x.fillStyle = c; x.fillRect(0, Y(y1), 512, Y(y0) - Y(y1)); },
  };
  return p;
}
const ptex = p => ctex(p.cv);
function addTo(g, obj){ g.torso.add(obj); return obj; }
function beltOn(g, y, w, col, o = {}){
  const th = o.th || .8;
  addTo(g, inked(surface(64, 2, (u, v, off, out) => { const ph = u * TAU; g.Pn(y + (v - .5) * w, ph, .15 + th + off * th, out); }, {thick:true, wrap:true}), g.M(col), .45));
  if (o.buckle) { const bk = g.Pn(y, 0, th + .5), m = g.MM(o.buckle);
    const fr = new THREE.Group(); at(fr, bk.x, bk.y, bk.z);
    if (o.round) fr.add(rot(inked(new THREE.TorusGeometry(w * .55, .45, 8, 20), m, .3), 0, 0, 0));
    else [[0, w * .42, w * 1.3, .5], [0, -w * .42, w * 1.3, .5], [-w * .6, 0, .5, w * .9], [w * .6, 0, .5, w * .9]].forEach(([a, b, c, d]) => fr.add(at(inked(new THREE.BoxGeometry(c, d, .55), m, .25), a, b, 0)));
    addTo(g, fr); }
  g.front.push(yy => Math.abs(yy - y) < w ? (g.rY(y) * g.Wd * g.D + th + 1) : null);
}
function strapOn(g, yc, amp, w, col, o = {}){ /* a strap round the body: high on one side, low on the other */
  const th = o.th || .55, sgn = o.flip ? -1 : 1, yF = ph => yc + sgn * amp * Math.sin(ph), q = new V3(), q2 = new V3(), n = new V3(), sd = new V3();
  const geo = surface(72, 2, (u, v, off, out) => { const ph = u * TAU; g.Pn(yF(ph), ph, 0, q); g.Pn(yF(ph + .02), ph + .02, 0, q2); g.Tn(yF(ph), ph, n);
    sd.subVectors(q2, q).cross(n).normalize(); if (sd.y < 0) sd.negate();
    const yy = yF(ph) + (v - .5) * w * Math.abs(sd.y) * 1.2; g.Pn(yy, ph, .2 + th + off * th, out); }, {thick:true, wrap:true});
  addTo(g, inked(geo, g.M(col), .45));
  g.front.push(y => Math.abs(y - yc) < amp ? g.rY(y) * g.Wd * g.D + th + 1 : null);
  g.back.push(y => Math.abs(y - yc) < amp ? -(g.rY(y) * g.Wd * g.D + th + 1) : null);
}
function skirtOn(g, y0, len, flare, mat, o = {}){
  const th = o.th || .5, n = o.folds || 10, fd = o.fold ?? .35;
  const hemY = (ph, v) => y0 - v * len * (1 + (o.dip ? o.dip * Math.pow(Math.max(0, Math.cos(ph)), 4) : 0) + (o.strips ? .06 * Math.sign(Math.sin(ph * o.strips)) : 0));
  const geo = surface(80, 8, (u, v, off, out) => { const ph = (u - .5) * TAU, base = g.rY(y0) + g.extra0 + .35, r = base + flare * Math.pow(v, 1.15) + fd * Math.sin(ph * n) * v + off * th;
    out.set(r * g.Wd * Math.sin(ph), hemY(ph, v), r * g.Wd * g.D * Math.cos(ph)); }, {thick:true, wrap:true});
  const m = inked(geo, Array.isArray(mat) ? mat : [mat, o.lining || mat], .5); addTo(g, m);
  g.skirtR = y => y < y0 && y > y0 - len ? g.rY(y0) + .35 + flare * Math.pow((y0 - y) / len, 1.15) + th : null;
  if (o.trim) { const tm = g.M(o.trim); addTo(g, inked(surface(80, 2, (u, v, off, out) => { const ph = (u - .5) * TAU, vv = 1 - v * .09, base = g.rY(y0) + g.extra0 + .35, r = base + flare * Math.pow(vv, 1.15) + fd * Math.sin(ph * n) * vv + .12 + off * (th + .2);
    out.set(r * g.Wd * Math.sin(ph), hemY(ph, vv), r * g.Wd * g.D * Math.cos(ph)); }, {thick:true, wrap:true}), tm, .4)); }
  return m;
}
function panelOn(g, phC, span, yTop, yBot, yBelt, mat, o = {}){ /* tabard, stole or loincloth: follows the body, then hangs straight */
  const th = o.th || .5, q = new V3();
  const geo = surface(o.nu || 10, o.nv || 16, (u, v, off, out) => {
    const ph = phC + (u - .5) * span * (o.taper ? lerp(1, o.taper, v) : 1), y = lerp(yTop, yBot, v), d = (o.off ?? .7) + th + off * th;
    if (y >= yBelt) g.Pn(y, ph, d, out);
    else { g.Pn(yBelt, ph, d, out); const sk = g.skirtR ? (g.skirtR(y) || 0) : 0, need = Math.max(0, sk - g.rY(yBelt) + .4) + (yBelt - y) * (o.slope || .06);
      out.x += Math.sin(ph) * need * g.Wd; out.z += Math.cos(ph) * need * g.Wd * g.D; out.y = y; }
  }, {thick:true});
  const m = inked(geo, mat, .45); addTo(g, m); return m;
}
function cloakOn(g, len, mat, o = {}){
  const {TH, Wd} = g, pts = [[5.6, TH + .9], [9.2, TH + .2], [11.4 * Wd + .6, TH - 2.4], [12.2 * Wd + .8, TH - 7], [13 * Wd + 1 + len * .06, TH - len]];
  const sp2 = new THREE.SplineCurve(pts.map(p => new THREE.Vector2(p[0], p[1])));
  const geo = surface(40, 20, (u, v, off, out) => { const q = sp2.getPoint(v), span = lerp(250, 150, sstep(0, .3, v)) * DEG, ph = PI + (u - .5) * span;
    const fold = .7 * Math.sin((u - .5) * span * 7) * sstep(.2, 1, v), r = q.x + fold + off * .6; out.set(r * Math.sin(ph), q.y, r * Math.cos(ph) * .96); }, {thick:true});
  addTo(g, inked(geo, mat, .5));
  g.back.push(y => { if (y > TH + 1 || y < TH - len) return null; let lo = 0, hi = 1; for (let i = 0; i < 18; i++) { const m = (lo + hi) / 2; if (sp2.getPoint(m).y > y) lo = m; else hi = m; } return -(sp2.getPoint(lo).x + 1.2) * .96; });
  if (o.clasp) [-1, 1].forEach(s => { const a = PI + s * 118 * DEG; addTo(g, at(inked(new THREE.CylinderGeometry(1.3, 1.3, .7, 14), g.MM(o.clasp), .3), 5.9 * Math.sin(a), TH + .9, 5.9 * Math.cos(a) * .96)).rotation.x = PI / 2; });
}
function buttonsOn(g, n, y0, y1, hex, r = .75){ const m = g.MM(hex); for (let i = 0; i < n; i++) { const y = lerp(y0, y1, n > 1 ? i / (n - 1) : 0), p = g.Pn(y, 0, .45); const b = inked(new THREE.SphereGeometry(r, 10, 8), m, .25); b.scale.z = .6; addTo(g, at(b, p.x, p.y, p.z)); } }
function pouchOn(g, ph, y, col, s = 1){
  const p = g.Pn(y, ph, 1.6 * s), grp = at(new THREE.Group(), p.x, p.y, p.z); grp.rotation.y = ph;
  const bx = inked(new THREE.CapsuleGeometry(1.8 * s, 1.4 * s, 4, 10), g.M(col), .4); bx.scale.set(1.2, 1, .7); grp.add(bx);
  grp.add(at(inked(new THREE.BoxGeometry(4.1 * s, 2 * s, 2.6 * s), g.M(shade(col, .8)), .35), 0, 1.6 * s, .1));
  grp.add(at(inked(new THREE.SphereGeometry(.45 * s, 8, 6), g.MM(GOLD), .2), 0, .9 * s, 1.35 * s));
  addTo(g, grp);
}
function quiverOn(g){
  const {TH, Wd, D} = g, grp = at(new THREE.Group(), -2.2, TH * .52, -(g.rY(TH * .52) * Wd * D + 2.6)); grp.rotation.set(.32, 0, .38);
  const qm = g.M(LEATHER); grp.add(inked(new THREE.CylinderGeometry(2.9, 2.4, 15, 16), qm, .45));
  [6.2, -5.8].forEach(y => grp.add(at(inked(new THREE.CylinderGeometry(3.05, 3.05, 1, 16), g.M(DLEATHER), .3), 0, y, 0)));
  for (let i = 0; i < 4; i++) { const a = i / 4 * TAU + .4, ax = Math.sin(a) * 1.2, az = Math.cos(a) * 1.2;
    grp.add(at(new THREE.Mesh(new THREE.CylinderGeometry(.35, .35, 6, 6), g.M('#d9b07a')), ax, 9, az));
    const f = inked(new THREE.ConeGeometry(1.1, 3.4, 3), g.M(i % 2 ? '#f4efe2' : '#c8453a'), .25); grp.add(at(f, ax, 12.4, az)); }
  addTo(g, grp);
  g.back.push(y => y > TH * .52 - 9 && y < TH * .52 + 12 ? -(g.rY(y) * Wd * D + 7) : null);
}
function collarOn(g, h, rIn, rOut, mat, o = {}){
  const {TH} = g, open = o.open || 0;
  addTo(g, inked(surface(36, 3, (u, v, off, out) => { const ph = lerp(open, TAU - open, u) + PI, r = lerp(rIn, rOut, v) + off * .45; out.set(r * Math.sin(ph), TH - .2 + v * h, r * Math.cos(ph) * .96); }, {thick:true, wrap:!open}), mat, .45));
}
const OUTFIT_BUILD = {
  commoner(g){
    const p = painter(g, g.main); p.seams(shade(g.main, .8)); p.vneck(46, 26, LINEN, shade(g.main, .7), '#7a5a3a');
    p.stitch([[150, 150], [190, 150], [190, 190], [150, 190], [150, 150]], shade(g.main, .7)); p.x.fillStyle = shade(g.main, .88); p.x.fillRect(152, 152, 36, 36);
    g.torsoMat = g.M('#ffffff', {map:ptex(p)}); g.extra0 = 0;
    g.sleeve = {type:'rolled', col:g.main, cuffMat:g.M(shade(g.main, .85))};
    skirtOn(g, 2.6, 7.5, 1.6, g.M(g.main), {fold:.3, lining:g.M(shade(g.main, .6))});
    beltOn(g, 2.8, 2, '#8a6a42', {buckle:'#c9b07a'}); pouchOn(g, .9, .2, LEATHER);
    g.legs = {pants:'#5a4632', boots:{col:'#4a3020', h:4.2, cuff:true}};
  },
  traveller(g){
    const p = painter(g, g.main), vest = '#5a3d26';
    p.x.fillStyle = vest; p.x.fillRect(0, 0, 512, 256); p.x.fillStyle = g.main; p.x.beginPath(); p.x.moveTo(216, 0); p.x.lineTo(296, 0); p.x.lineTo(270, 256); p.x.lineTo(242, 256); p.x.fill();
    p.stitch([[216, 0], [242, 256]], '#c9a87a'); p.stitch([[296, 0], [270, 256]], '#c9a87a'); p.vneck(36, 18, LINEN, shade(g.main, .7));
    for (let i = 0; i < 4; i++) { p.x.strokeStyle = '#2a1a10'; p.x.lineWidth = 2; const yy = 60 + i * 34; p.x.beginPath(); p.x.moveTo(236 + i * 2, yy); p.x.lineTo(276 - i * 2, yy + 8); p.x.stroke(); }
    g.torsoMat = g.M('#ffffff', {map:ptex(p)}); g.extra0 = 0;
    g.sleeve = {type:'full', col:g.main}; g.bracer = LEATHER;
    skirtOn(g, 2.6, 7, 1.7, g.M(shade(g.main, .9)), {lining:g.M(shade(g.main, .55))});
    beltOn(g, 2.8, 2, LEATHER, {buckle:'#b9c3cd'});
    strapOn(g, g.TH * .45, g.TH * .5, 1.6, '#4a3020', {flip:true});
    { const sp = g.Pn(1.6, 1.25, 2.4), grp = at(new THREE.Group(), sp.x, sp.y, sp.z); grp.rotation.y = 1.25;
      grp.add(inked(new THREE.BoxGeometry(6.4, 5.2, 3), g.M('#6b4a2c'), .4)); grp.add(at(rot(inked(new THREE.BoxGeometry(6.6, 3, .8), g.M('#553820'), .3), -.15, 0, 0), 0, 1.6, 1.4)); addTo(g, grp); }
    cloakOn(g, (g.TH + 13 * g.H) * .78, [g.M('#5a3b26'), g.M('#3a2618')], {clasp:'#c9a24a'}); g.hoodCol = '#5a3b26';
    g.legs = {pants:'#4a4038', boots:{col:DLEATHER, h:7, cuff:'#6b4a2c'}};
  },
  noble(g){
    const p = painter(g, g.main), gold = GOLD, dk = shade(g.main, .8);
    p.x.strokeStyle = dk; p.x.lineWidth = 2; for (let i = -8; i < 16; i++) { p.x.beginPath(); p.x.moveTo(i * 32, 256); p.x.lineTo(i * 32 + 256, 0); p.x.moveTo(i * 32, 0); p.x.lineTo(i * 32 + 256, 256); p.x.stroke(); }
    p.x.fillStyle = shade(g.main, 1.12); p.x.fillRect(244, 0, 24, 256); p.x.fillStyle = gold; p.x.fillRect(242, 0, 3, 256); p.x.fillRect(267, 0, 3, 256);
    g.torsoMat = g.M('#ffffff', {map:ptex(p)}); g.extra0 = 0;
    g.sleeve = {type:'puff', col:g.main, slash:gold, lower:shade(g.main, .85)}; g.glove = '#e9e0c9'; g.gloveCuff = true;
    skirtOn(g, 2.6, 5, 2.2, g.M(g.main), {folds:12, fold:.45, trim:gold, lining:g.M(shade(g.main, .6))});
    beltOn(g, 2.8, 1.8, '#2a2030', {buckle:gold}); buttonsOn(g, 4, 6, g.TH * .78, gold);
    collarOn(g, 3.2, 5.2, 6.4, [g.M(g.main), g.M(shade(g.main, .7))], {open:.5});
    addTo(g, at(rot(inked(new THREE.TorusGeometry(5.4, .5, 6, 30, TAU - 1), g.M(gold), .3), PI / 2, 0, PI / 2 + .5), 0, g.TH + 3, 0));
    strapOn(g, g.TH * .5, g.TH * .45, 2.4, gold, {th:.45});
    cloakOn(g, (g.TH + 13 * g.H) * .5, [g.M('#7a1f2a'), g.M('#e8d9b0')], {clasp:gold});
    g.legs = {pants:'#2a2a33', boots:{col:'#1f1a1a', h:8, cuff:gold}};
  },
  mage(g){
    const p = painter(g, g.main), gold = '#e8c25a';
    p.x.fillStyle = shade(g.main, .82); p.x.fillRect(238, 0, 36, 256); p.x.fillStyle = gold; p.x.fillRect(236, 0, 3, 256); p.x.fillRect(273, 0, 3, 256);
    for (let i = 0; i < 6; i++) p.dot(256, 30 + i * 36, 4, gold);
    const star = (sx, sy, r) => { p.x.fillStyle = gold; p.x.beginPath(); for (let k = 0; k < 8; k++) { const a = k / 8 * TAU, rr = k % 2 ? r * .35 : r; p.x.lineTo(sx + Math.sin(a) * rr, sy - Math.cos(a) * rr); } p.x.fill(); };
    [[150, 80, 7], [360, 120, 6], [180, 190, 5], [330, 200, 7], [60, 100, 6], [450, 70, 6]].forEach(s => star(...s));
    g.torsoMat = g.M('#ffffff', {map:ptex(p)}); g.extra0 = 0; g.robe = true;
    g.sleeve = {type:'bell', col:g.main, trim:gold, lining:g.M(shade(g.main, .55))};
    const rp = painter(g, g.main); rp.x.fillStyle = shade(g.main, .82); rp.x.fillRect(238, 0, 36, 256); rp.x.fillStyle = gold; rp.x.fillRect(236, 0, 3, 256); rp.x.fillRect(273, 0, 3, 256);
    [[100, 60, 6], [400, 90, 7], [160, 170, 6], [350, 200, 5]].forEach(([sx, sy, r]) => { rp.x.fillStyle = gold; rp.x.beginPath(); for (let k = 0; k < 8; k++) { const a = k / 8 * TAU, rr = k % 2 ? r * .35 : r; rp.x.lineTo(sx + Math.sin(a) * rr, sy - Math.cos(a) * rr); } rp.x.fill(); });
    const rt = ptex(rp); rt.flipY = true;
    skirtOn(g, 3, 3 + 13 * g.H - .6, 4.2, [g.M('#ffffff', {map:rt}), g.M(shade(g.main, .5))], {folds:9, fold:.5, trim:gold, dip:-.04});
    beltOn(g, 3.2, 2.2, gold, {th:.7});
    [[-1.4, .3], [1.6, -.2]].forEach(([dx, r]) => panelOn(g, dx / 8.6, .22, 3, -6.5, 3.4, g.M(gold), {th:.35, nv:6, nu:3, slope:.12}));
    collarOn(g, 4, 5.4, 7, [g.M(g.main), g.M(shade(g.main, .55))], {open:.8});
    g.legs = {pants:g.main, boots:{col:DLEATHER, h:3}};
  },
  priest(g){
    const white = '#ece6d6', p = painter(g, white); p.x.strokeStyle = '#d6cfbd'; p.x.lineWidth = 3; [200, 230, 282, 312].forEach(xx => { p.x.beginPath(); p.x.moveTo(xx, 120); p.x.lineTo(xx + (xx - 256) * .1, 256); p.x.stroke(); });
    g.torsoMat = g.M('#ffffff', {map:ptex(p)}); g.extra0 = 0; g.robe = true;
    g.sleeve = {type:'bell', col:white, trim:g.main, lining:g.M('#cfc6b2')};
    skirtOn(g, 3, 3 + 13 * g.H - .6, 3.4, [g.M(white), g.M('#cfc6b2')], {folds:8, fold:.45, trim:g.main});
    const sp = painter(g, g.main); sp.x.fillStyle = GOLD; for (let i = 0; i < 3; i++) { const yy = 40 + i * 70; sp.x.fillRect(0, yy, 512, 4); sp.x.beginPath(); sp.x.arc(256, yy + 26, 12, 0, TAU); sp.x.fill(); }
    const st = ptex(sp); [-1, 1].forEach(s => panelOn(g, s * .24, .26, g.TH * .97, -10 * g.H, 3, g.M('#ffffff', {map:st}), {th:.4, nu:3, nv:18, slope:.02}));
    beltOn(g, 3.1, 1.2, '#cdbb8a', {th:.7});
    { const kn = g.Pn(3.1, .5, 1.2); addTo(g, at(inked(new THREE.SphereGeometry(1, 10, 8), g.M('#cdbb8a'), .3), kn.x, kn.y, kn.z));
      addTo(g, inked(tube([kn.clone(), kn.clone().add(new V3(.8, -3, 1.4)), kn.clone().add(new V3(1.2, -7, 1.6))], t => [.55, .55 * (1 - t * .3)], (q, t, o) => o.set(0, 0, 1), {nS:10, nR:6}), g.M('#cdbb8a'), .3)); }
    collarOn(g, 2.2, 5, 6, [g.M(g.main), g.M(shade(g.main, .6))], {open:.4});
    g.legs = {pants:white, boots:{col:'#5a4632', h:3}};
  },
  leather(g){
    const lc = LEATHER, p = painter(g, lc);
    p.x.fillStyle = shade(lc, .82); p.x.fillRect(0, 150, 512, 106);
    p.stitch([[0, 150], [512, 150]], '#c9a87a'); p.stitch([[200, 0], [200, 256]], '#c9a87a'); p.stitch([[312, 0], [312, 256]], '#c9a87a');
    for (let r = 0; r < 5; r++) for (let c = 0; c < 18; c++) p.dot(c * 28.4 + (r % 2) * 14, 30 + r * 46, 3.4, '#b9b0a0', '#fff');
    g.torsoMat = g.M('#ffffff', {map:ptex(p)}); g.extra0 = 0;
    g.sleeve = {type:'full', col:g.main}; g.bracer = DLEATHER; g.bracerStrap = '#b9b0a0'; g.glove = DLEATHER;
    g.pauld = {col:lc, layers:2};
    skirtOn(g, 2.6, 6.5, 1.5, g.M(shade(lc, .9)), {strips:9, fold:.15, lining:g.M(DLEATHER)});
    beltOn(g, 2.8, 2.2, DLEATHER, {buckle:'#c9c3b5'}); pouchOn(g, -1, .4, DLEATHER); pouchOn(g, 1.05, .4, DLEATHER, .85);
    g.legs = {pants:'#4a3a2c', boots:{col:DLEATHER, h:7, cuff:true, buckle:'#c9c3b5'}};
  },
  hunter(g){
    const jk = '#5e4128', p = painter(g, jk);
    p.x.fillStyle = g.main; p.x.beginPath(); p.x.moveTo(230, 0); p.x.lineTo(282, 0); p.x.lineTo(262, 120); p.x.lineTo(250, 120); p.x.fill();
    for (let i = 0; i < 4; i++) { p.x.strokeStyle = '#d8c39a'; p.x.lineWidth = 2; const yy = 16 + i * 26; p.x.beginPath(); p.x.moveTo(238 + i * 3, yy); p.x.lineTo(274 - i * 3, yy + 10); p.x.moveTo(274 - i * 3, yy); p.x.lineTo(238 + i * 3, yy + 10); p.x.stroke(); }
    p.stitch([[0, 200], [512, 200]], '#c9a87a'); p.seams(shade(jk, .8));
    g.torsoMat = g.M('#ffffff', {map:ptex(p)}); g.extra0 = 0;
    g.sleeve = {type:'full', col:g.main}; g.bracer = LEATHER; g.glove = LEATHER; g.gloveCuff = true;
    g.pauld = {col:LEATHER, layers:2, one:-1};
    skirtOn(g, 2.6, 7, 1.6, g.M(g.main), {fold:.3, dip:.25, lining:g.M(shade(g.main, .55))});
    beltOn(g, 2.8, 2, DLEATHER, {buckle:'#c9c3b5'});
    strapOn(g, g.TH * .5, g.TH * .45, 1.5, DLEATHER, {});
    { const kp = g.Pn(1.6, -1.15, 1.6), grp = at(new THREE.Group(), kp.x, kp.y, kp.z); grp.rotation.set(0, -1.15, .2);
      grp.add(at(inked(new THREE.BoxGeometry(1.8, 6, 1.2), g.M(DLEATHER), .3), 0, -2, 0)); grp.add(at(inked(new THREE.CylinderGeometry(.6, .6, 3, 8), g.M('#8a6a42'), .25), 0, 2.4, 0)); addTo(g, grp); }
    quiverOn(g); g.hoodCol = g.main;
    g.legs = {pants:'#4a3a2c', boots:{col:DLEATHER, h:8, cuff:true}};
  },
  rogue(g){
    const p = painter(g, g.main), dk = shade(g.main, .75);
    p.x.strokeStyle = dk; p.x.lineWidth = 2.5; for (let i = 0; i < 9; i++) { p.x.beginPath(); p.x.moveTo(0, 30 + i * 26); p.x.lineTo(512, 30 + i * 26); p.x.stroke(); }
    p.x.fillStyle = shade(g.main, 1.2); p.x.beginPath(); p.x.moveTo(250, 0); p.x.lineTo(300, 0); p.x.lineTo(252, 256); p.x.lineTo(240, 256); p.x.fill();
    p.stitch([[300, 0], [252, 256]], '#8a8a95');
    g.torsoMat = g.M('#ffffff', {map:ptex(p)}); g.extra0 = 0;
    g.sleeve = {type:'full', col:g.main}; g.glove = '#1f1f24'; g.gloveCuff = true; g.bracer = '#2a2a30'; g.bracerStrap = '#8a8a95';
    skirtOn(g, 2.6, 5.5, 1.4, g.M(shade(g.main, .9)), {fold:.25, dip:-.2, lining:g.M('#1a1a1f')});
    beltOn(g, 2.8, 1.8, '#2a2020', {buckle:'#a8a8b5'});
    strapOn(g, g.TH * .5, g.TH * .42, 1.3, '#2a2020', {}); strapOn(g, g.TH * .5, g.TH * .42, 1.3, '#2a2020', {flip:true});
    [-1, 1].forEach(s => { const kp = g.Pn(1.2, s * 1.05, 1.6), grp = at(new THREE.Group(), kp.x, kp.y, kp.z); grp.rotation.set(0, s * 1.05, -s * .25);
      grp.add(at(inked(new THREE.ConeGeometry(1, 6, 8), g.M('#1a1a1f'), .3), 0, -2.2, 0)).rotation.x = PI;
      grp.add(at(inked(new THREE.CylinderGeometry(.55, .55, 2.6, 8), g.M('#5a3a3a'), .25), 0, 2, 0)); grp.add(at(inked(new THREE.BoxGeometry(3, .7, .9), g.MM('#a8a8b5'), .2), 0, .7, 0)); addTo(g, grp); });
    g.hoodCol = g.main;
    g.after = (head, HR) => { const sc = '#5a2a2a'; addTo(g, inked(surface(36, 4, (u, v, off, out) => { const ph = (u - .5) * TAU, y = g.TH - 2.6 + v * 4.4, r = g.rY(Math.min(y, g.TH * .97)) * (1 - v * .25) + 1.6 + (1 - Math.cos(ph)) * .3 + off * .5;
      out.set(r * g.Wd * Math.sin(ph), y, r * g.Wd * g.D * Math.cos(ph)); }, {thick:true, wrap:true}), [g.M(sc), g.M(shade(sc, .6))], .45)); };
    g.legs = {pants:'#24242a', boots:{col:'#1a1a1f', h:8, cuff:'#2a2a30', buckle:'#a8a8b5'}};
  },
  mail(g){
    const p = painter(g, '#8f99a4');
    p.x.strokeStyle = '#5d6672'; p.x.lineWidth = 1.6; for (let r = 0; r < 40; r++) for (let c = 0; c < 72; c++) { p.x.beginPath(); p.x.arc(c * 7.2 + (r % 2) * 3.6, r * 6.6, 3.4, .2, PI - .2); p.x.stroke(); }
    const mt = ptex(p);
    g.torsoMat = g.M('#ffffff', {map:mt}); g.extra0 = 0;
    const sm = g.M('#ffffff', {map:mt}); g.sleeve = {type:'full', mat:sm}; g.glove = DLEATHER; g.gloveCuff = true;
    skirtOn(g, 2.6, 8.5, 1.5, g.M('#ffffff', {map:mt}), {fold:.12, lining:g.M('#4d5560')});
    const tp = painter(g, g.main); tp.x.fillStyle = GOLD; tp.x.fillRect(0, 0, 512, 14); tp.x.fillRect(0, 242, 512, 14);
    tp.x.beginPath(); tp.x.moveTo(140, 60); tp.x.lineTo(256, 120); tp.x.lineTo(372, 60); tp.x.lineTo(372, 84); tp.x.lineTo(256, 144); tp.x.lineTo(140, 84); tp.x.fill();
    const tt = ptex(tp); [0, PI].forEach(a => panelOn(g, a, .95, g.TH * .97, -8 * g.H, 2.6, [g.M('#ffffff', {map:tt}), g.M(shade(g.main, .6))], {th:.45, nu:8, nv:18, slope:.08}));
    beltOn(g, 2.8, 2, LEATHER, {buckle:'#c9c3b5'});
    collarOn(g, 2.4, 5, 6.6, g.M('#ffffff', {map:mt}));
    g.legs = {pants:'#3a3a40', boots:{col:DLEATHER, h:7, cuff:true}};
  },
  plate(g){
    const p = painter(g, '#ffffff');
    p.x.strokeStyle = '#8a9099'; p.x.lineWidth = 3; [175, 205].forEach(yy => { p.x.beginPath(); p.x.moveTo(0, yy); p.x.lineTo(512, yy); p.x.stroke(); });
    for (let c = 0; c < 16; c++) [182, 212].forEach(yy => p.dot(c * 32 + 16, yy + 6, 2.6, '#7a808a'));
    p.x.strokeStyle = '#a0a8b2'; p.x.lineWidth = 2; p.x.beginPath(); p.x.moveTo(256, 20); p.x.lineTo(256, 170); p.x.stroke();
    g.torsoMat = g.MM(STEEL, ptex(p)); g.extra0 = 0;
    g.sleeve = {type:'plate', metal:STEEL, under:'#4a4a52'}; g.glove = 'gauntlet';
    g.pauld = {metal:STEEL, layers:3, trim:GOLD};
    const fm = g.MM(STEEL);
    for (let i = 0; i < 3; i++) skirtOn(g, 3.2 - i * 2.3, 2.9, .9 + i * .55, fm, {fold:0, th:.5}), g.extra0 = (g.extra0 || 0) + .9;
    g.extra0 = 0;
    const tp = painter(g, g.main); tp.x.fillStyle = GOLD; tp.x.fillRect(0, 0, 512, 12); tp.x.fillRect(0, 244, 512, 12); tp.x.fillRect(240, 40, 32, 150); tp.x.fillRect(190, 90, 132, 30);
    const tt = ptex(tp); panelOn(g, 0, .8, g.TH * .55, -8.5 * g.H, 2.6, [g.M('#ffffff', {map:tt}), g.M(shade(g.main, .6))], {th:.45, nu:6, nv:16, off:1.4, slope:.1});
    beltOn(g, 2.8, 2, DLEATHER, {buckle:GOLD, th:1.6});
    collarOn(g, 2.6, 5, 7.2, g.MM(STEEL));
    g.legs = {pants:'#4a4a52', metal:STEEL, boots:{metal:IRON, h:8}};
  },
  barbarian(g){
    const p = painter(g, g.skinHex), ln = shade(g.skinHex, .82);
    p.x.strokeStyle = ln; p.x.lineWidth = 2.5; p.x.lineCap = 'round';
    if (!g.fem) { [-1, 1].forEach(s => { p.x.beginPath(); p.x.arc(256 + s * 30, 66, 30, PI * .15, PI * .85); p.x.stroke(); });
      [120, 150].forEach(yy => { p.x.beginPath(); p.x.moveTo(236, yy); p.x.lineTo(276, yy); p.x.stroke(); }); p.x.beginPath(); p.x.moveTo(256, 100); p.x.lineTo(256, 175); p.x.stroke(); }
    else { p.x.fillStyle = shade(g.main, .9); p.x.fillRect(0, 40, 512, 60); p.stitch([[0, 44], [512, 44]], '#e8d2a8'); p.stitch([[0, 96], [512, 96]], '#e8d2a8'); }
    g.torsoMat = g.M('#ffffff', {map:ptex(p)}); g.extra0 = 0;
    g.sleeve = {type:'bare'}; g.bracer = LEATHER; g.bracerStrap = '#c9c3b5';
    const fur = '#7a5a3a', fm = g.M(fur);
    for (let i = 0; i < 16; i++) { const a = i / 16 * TAU, y = g.TH - .6 + (i % 2) * .7, r = 7.4 * g.Wd + (i % 3) * .3;
      addTo(g, at(inked(new THREE.SphereGeometry(2.7 + (i % 3) * .35, 12, 10), fm, .4), Math.sin(a) * r, y, Math.cos(a) * r * .95)); }
    g.back.push(y => y > g.TH - 4 ? -(7.4 * g.Wd + 4) : null); g.front.push(y => y > g.TH - 4 ? 7.4 * g.Wd + 3.5 : null);
    strapOn(g, g.TH * .5, g.TH * .45, 1.8, LEATHER, {});
    beltOn(g, 2.8, 3, LEATHER, {buckle:'#c9c3b5', round:true, th:1});
    [0, PI].forEach(a => panelOn(g, a, .62, 2.8, -8.5 * g.H, 2.2, [g.M(shade(g.main, .8)), g.M(shade(g.main, .5))], {th:.4, nu:6, nv:10, taper:.7, slope:.05}));
    g.legs = {pants:shade(g.main, .7), boots:{col:'#5a4632', h:6, fur:fur}};
  },
  sailor(g){
    const p = painter(g, '#efe9dc'); for (let i = 0; i < 14; i++) if (i % 2) p.band(g.yTop * (1 - (i + 1) / 14), g.yTop * (1 - i / 14), g.main);
    g.torsoMat = g.M('#ffffff', {map:ptex(p)}); g.extra0 = 0;
    const sp = painter(g, '#efe9dc'); for (let i = 0; i < 8; i++) if (i % 2) { sp.x.fillStyle = g.main; sp.x.fillRect(0, i * 32, 512, 32); }
    g.sleeve = {type:'rolled', mat:g.M('#ffffff', {map:ptex(sp)}), cuffMat:g.M('#efe9dc')};
    const sash = '#a8322c'; beltOn(g, 2.6, 2.8, sash, {th:.8});
    { const kp = g.Pn(2.6, -.9, 1.6); [[-.6, 0], [.6, .3]].forEach(([dx, r]) => addTo(g, inked(tube([kp.clone(), kp.clone().add(new V3(dx - .8, -3, .8)), kp.clone().add(new V3(dx - 1.6, -6.5, 1))], t => [1.2 * (1 - t * .3), .4], (q, t, o) => o.set(-Math.sin(.9), 0, Math.cos(.9)), {nS:10, nR:6}), g.M(sash), .35))); }
    g.after = () => { const nk = g.M(g.main); addTo(g, inked(surface(30, 3, (u, v, off, out) => { const ph = (u - .5) * TAU, y = g.TH - 1.8 + v * 2.4, r = g.rY(Math.min(y, g.TH * .96)) + 1 + off * .6; out.set(r * g.Wd * Math.sin(ph), y, r * g.Wd * g.D * Math.cos(ph)); }, {thick:true, wrap:true}), nk, .45));
      const kp = g.Pn(g.TH - 2.4, 0, 1.4); addTo(g, at(inked(new THREE.SphereGeometry(1.5, 10, 8), nk, .3), kp.x, kp.y, kp.z));
      addTo(g, inked(tube([kp.clone(), kp.clone().add(new V3(0, -3, .6)), kp.clone().add(new V3(0, -6, .5))], t => [2.6 * (1 - t), .45], (q, t, o) => o.set(0, 0, 1), {nS:8, nR:6}), nk, .35)); };
    g.legs = {pants:'#d9cfb8', rolled:'#cfc4ab', boots:{col:DLEATHER, h:3.4}};
  },
};

/* ---------- animations: each is a pure function of time, so a redraw never restarts it ---------- */
const seg = (t, a, b) => clamp((t - a) / (b - a), 0, 1);
const eOut = u => 1 - Math.pow(1 - u, 3), eIO = u => u < .5 ? 4 * u * u * u : 1 - Math.pow(-2 * u + 2, 3) / 2;
const eBack = u => { const c1 = 1.70158, c3 = c1 + 1; return 1 + c3 * Math.pow(u - 1, 3) + c1 * Math.pow(u - 1, 2); };
const ANIMS = {idle:2400, walk:900, sword:1700, bow:1900, magic:1900, hit:1300, block:1300, down:2600};
function rest(rig){
  const {body, torso, head, armL, armR, legs} = rig;
  body.position.set(0, 6, 0); body.rotation.set(0, 0, 0); body.scale.set(1, 1, 1);
  torso.rotation.set(0, 0, 0); head.rotation.set(0, 0, 0);
  armL.sh.rotation.set(0, 0, -.2); armR.sh.rotation.set(0, 0, .2);
  legs.forEach(l => l.rotation.set(0, 0, 0));
  if (rig.tail) rig.tail.rotation.set(0, 0, 0);
  Object.values(rig.w).forEach(w => { w.visible = false; w.scale.setScalar(1); });
  rig.mats.forEach(m => { if (m.emissive) m.emissive.setRGB(0, 0, 0); else if (m.userData.base) m.color.copy(m.userData.base); });
}
const _fc = new THREE.Color();
function flash(rig, k, hex){ _fc.setHex(hex); rig.mats.forEach(m => { if (m.emissive) m.emissive.setHex(hex).multiplyScalar(k * .7); else if (m.userData.base) m.color.copy(m.userData.base).lerp(_fc, k * .55); }); }
function animate(rig, name, t){ if (rig.beast) return BK.pose(rig, name, t); pose(rig, name, t); faceFor(rig, name === 'hit' || name === 'down' ? 'hurt' : null); softHair(rig); }
/* the face sheet's picture for a move (made the first time it is needed) */
function faceFor(rig, expr){
  const fm = rig.faceSheet; if (!fm || rig.faceNow === expr) return; rig.faceNow = expr; const F = rig.faces || (rig.faces = {base:fm.material.map});
  if (expr && !F[expr]) F[expr] = ctex(faceSheet(Object.assign({}, rig.spec, {expr}), RACES[rig.spec.race] || RACES.Human));
  fm.material.map = expr ? F[expr] : F.base; fm.material.needsUpdate = true;
}
/* arms push soft hair out of the way. Each lock is a chain of rings from the root down: a ring that an arm reaches is pushed
   out of the arm, the rings below hang on from it and ease back towards where they rest, so hair drapes round an arm
   instead of going through it. Vertices only move with their ring, so every lock keeps its shape. */
function softSetup(rig, head, env){
  const geos = [], locks = new Map();
  head.children.forEach(c => { const m = c.userData.hair && c.userData.m, geo = m && m.geometry; if (!geo || !geo.attributes.sk) return;
    const sc = geo.attributes.sc.array, sk = geo.attributes.sk.array, G = {geo, rest:geo.attributes.position.array.slice(), dirty:false}; let used = false;
    const by = new Map();
    for (let i = 0, n = geo.attributes.position.count; i < n; i++) { if (sc[i * 4 + 3] <= 0) continue;
      const id = sk[i * 3], ring = sk[i * 3 + 1], fol = sk[i * 3 + 2], key = id * 10000 + ring;
      let L = locks.get(id); if (!L) { L = {rings:new Map(), bent:false}; locks.set(id, L); }
      let R = L.rings.get(ring); if (!R) { R = {c:null, r:0, refs:[]}; L.rings.set(ring, R); }
      if (!fol && !R.c) { R.c = new V3(sc[i * 4], sc[i * 4 + 1], sc[i * 4 + 2]); R.r = sc[i * 4 + 3]; }
      let list = by.get(key); if (!list) { list = []; by.set(key, list); R.refs.push([G, list]); } list.push(i); used = true; }
    if (used) { geos.push(G); c.children.forEach(o => o.frustumCulled = false); } });
  const lats = [], latLocks = [];
  head.children.forEach(c => { const lat = c.userData.lattice; if (!lat) return; const geo = c.geometry; geo.computeBoundingSphere();
    const T = {geo, rest:geo.attributes.position.array.slice(), lat, locks:[], ctr:geo.boundingSphere.center.clone(), rad:geo.boundingSphere.radius, dirty:false};
    lat.locks.forEach(rings => { rings.forEach(R => R.lock = null); latLocks.push([T, rings]); }); lats.push(T); });
  const lock = rings => { const ctr = new V3(); rings.forEach(R => ctr.add(R.c)); ctr.divideScalar(rings.length || 1); let rad = 0; rings.forEach(R => rad = Math.max(rad, R.c.distanceTo(ctr) + R.r));
    rings.forEach(R => R.n = R.c.clone()); return {rings, ctr, rad, bent:false, front:ctr.z > 2 ? 1 : ctr.z < -2 ? -1 : 0}; };
  rig.soft = {geos, lats, locks:[...locks.values()].map(L => { const rings = [...L.rings.entries()].sort((a, b) => a[0] - b[0]).map(e => e[1]).filter(R => R.c);
    const ctr = new V3(); rings.forEach(R => ctr.add(R.c)); ctr.divideScalar(rings.length || 1); let rad = 0; rings.forEach(R => rad = Math.max(rad, R.c.distanceTo(ctr) + R.r));
    rings.forEach(R => R.n = R.c.clone()); return {rings, ctr, rad, bent:false, front:ctr.z > 2 ? 1 : ctr.z < -2 ? -1 : 0}; }).filter(L => L.rings.length),
    env, AL:rig.dbg.AL, ar:rig.dbg.ar};
  latLocks.forEach(([T, rings]) => { const L = lock(rings); rings.forEach(R => R.lock = L); T.locks.push(L); rig.soft.locks.push(L); });
}
const _m4 = new THREE.Matrix4(), _a = new V3(), _b = new V3(), _d = new V3(), _q = new V3(), _e = new V3();
function softHair(rig){
  const S = rig.soft; if (!S || !S.locks.length) return;
  rig.root.updateMatrixWorld(true);
  const {AL, ar, env} = S, inv = _m4.copy(rig.head.matrixWorld).invert(), GAP = .45, PULL = .35;
  const caps = rig.arms.map(A => { const s0 = new V3(0, -1, 0).applyMatrix4(A.sh.matrixWorld).applyMatrix4(inv), s1 = new V3(0, -AL - 5, 0).applyMatrix4(A.sh.matrixWorld).applyMatrix4(inv);
    const ax = s1.clone().sub(s0), len = ax.length(); ax.divideScalar(len || 1); return {s0, ax, len}; });
  const push = (p, r, side) => { let hit = false;
    for (const C of caps) {
      _a.copy(p).sub(C.s0); const t = _a.dot(C.ax), tc = clamp(t, 0, C.len); _q.copy(C.s0).addScaledVector(C.ax, tc);
      _d.copy(p).sub(_q); const dist = _d.length(), need = ar + r + GAP; if (dist >= need) continue;
      if (dist < 1e-4) _d.set(Math.sign(p.x) || 1, 0, 0); else _d.divideScalar(dist);
      if (side > 0 && _d.z < 0) _d.z = 0; else if (side < 0 && _d.z > 0) _d.z = 0; /* never into the body */
      if (_d.lengthSq() < 1e-6) _d.set(Math.sign(p.x - _q.x) || 1, 0, 0); _d.normalize();
      /* move along d until the ring is need away from the arm's axis (or its end) */
      if (t > 0 && t < C.len) { _b.copy(_a).addScaledVector(C.ax, -t); _e.copy(_d).addScaledVector(C.ax, -_d.dot(C.ax)); } else { _b.copy(p).sub(_q); _e.copy(_d); }
      const A2 = _e.lengthSq(), B2 = 2 * _b.dot(_e), C2 = _b.lengthSq() - need * need;
      const s = A2 > 1e-4 ? (-B2 + Math.sqrt(Math.max(0, B2 * B2 - 4 * A2 * C2))) / (2 * A2) : need - dist;
      if (s > 0) { p.addScaledVector(_d, Math.min(s, need * 2)); hit = true; } }
    return hit; };
  for (const L of S.locks) {
    const near = caps.some(C => { _a.copy(L.ctr).sub(C.s0); const t = clamp(_a.dot(C.ax), 0, C.len); return _a.addScaledVector(C.ax, -t).length() < L.rad + ar + GAP + 1; });
    L.was = L.bent; L.bent = false; if (!near) continue;
    const R = L.rings; let moved = false;
    for (let k = 0; k < R.length; k++) { const g = R[k], n = g.n;
      if (k === 0) n.copy(g.c);
      else { const pr = R[k - 1], len = g.c.distanceTo(pr.c);
        n.copy(pr.n).add(_b.copy(g.c).sub(pr.c)).lerp(g.c, PULL); _a.copy(n).sub(pr.n); const l = _a.length(); if (l > 1e-5) n.copy(pr.n).addScaledVector(_a, len / l); }
      push(n, g.r, L.front);
      if (n.distanceToSquared(g.c) > 1e-6) { env.clearX(n, g.r + .3); moved = true; } }
    L.bent = moved; }
  for (const G of S.geos) G.touch = false;
  for (const L of S.locks) if (L.bent || L.was) L.rings.forEach(g => g.refs.forEach(([G]) => G.touch = true));
  for (const G of S.geos) { if (!G.touch && !G.dirty) continue; const pos = G.geo.attributes.position; pos.array.set(G.rest); pos.needsUpdate = true; G.dirty = false; }
  for (const T of S.lats) { /* hair models: each vertex follows the four column rings around it (hairLattice), then any vertex still in an arm steps out of it */
    const bent = T.locks.some(L => L.bent), near = caps.some(C => { _a.copy(T.ctr).sub(C.s0); const t = clamp(_a.dot(C.ax), 0, C.len); return _a.addScaledVector(C.ax, -t).length() < T.rad + ar + GAP; });
    const pos = T.geo.attributes.position, P = pos.array;
    if (!bent && !near) { if (T.dirty) { P.set(T.rest); pos.needsUpdate = true; T.dirty = false; } continue; }
    P.set(T.rest); pos.needsUpdate = true; T.dirty = true; const {cells, vc, vw} = T.lat, need = ar + GAP;
    for (let i = 0, n = P.length / 3; i < n; i++) {
      if (bent) for (let j = 0; j < 4; j++) { const ci = vc[i * 4 + j]; if (ci < 0) continue; const c = cells[ci]; if (!c.lock || !c.lock.bent) continue;
        const w = vw[i * 4 + j]; P[i * 3] += w * (c.n.x - c.c.x); P[i * 3 + 1] += w * (c.n.y - c.c.y); P[i * 3 + 2] += w * (c.n.z - c.c.z); }
      if (!near) continue; _e.fromArray(P, i * 3); let hit = false;
      for (const C of caps) { _a.copy(_e).sub(C.s0); const t = clamp(_a.dot(C.ax), 0, C.len); _q.copy(C.s0).addScaledVector(C.ax, t); _d.copy(_e).sub(_q); const dist = _d.length();
        if (dist >= need) continue; if (dist < 1e-4) _d.set(Math.sign(_e.x) || 1, 0, 0); else _d.divideScalar(dist); _e.addScaledVector(_d, need - dist); hit = true; }
      if (hit || bent) env.clearX(_e, .3);
      for (const C of caps) { /* squeezed between the arm and the body: go round the arm's outer side instead */
        _a.copy(_e).sub(C.s0); const t = clamp(_a.dot(C.ax), 0, C.len); _q.copy(C.s0).addScaledVector(C.ax, t); if (_e.distanceTo(_q) >= need - .05) continue;
        _d.set(_q.x, 0, _q.z).addScaledVector(C.ax, -_q.x * C.ax.x - _q.z * C.ax.z); if (_d.lengthSq() < .01) _d.set(0, 1, 0).addScaledVector(C.ax, -C.ax.y);
        _d.normalize(); _e.copy(_q).addScaledVector(_d, need); hit = true; }
      if (hit || bent) _e.toArray(P, i * 3); } }
  for (const L of S.locks) { if (!L.bent) continue;
    for (const g of L.rings) { const dx = g.n.x - g.c.x, dy = g.n.y - g.c.y, dz = g.n.z - g.c.z; if (!dx && !dy && !dz) continue;
      for (const [G, list] of g.refs) { const P = G.geo.attributes.position.array; for (const i of list) { P[i * 3] += dx; P[i * 3 + 1] += dy; P[i * 3 + 2] += dz; } G.dirty = true; } } }
}
function pose(rig, name, t){
  if (rig.beast) return BK.pose(rig, name, t);
  rest(rig);
  const {body, torso, head, armL, armR, legs} = rig, D = ANIMS[name] || 2000, u = (t % D) / D, ms = t % D;
  const fx = rig.fx; Object.values(fx).forEach(o => o.visible = false);
  const breathe = Math.sin(t / 380) * .5 + .5, legK = rig.robe ? .45 : 1;
  torso.scale.set(1, 1 + breathe * .012, 1);
  if (rig.tail) rig.tail.rotation.y = Math.sin(t / 420) * .25;
  if (name === 'idle') { head.rotation.z = Math.sin(t / 900) * .05; armL.sh.rotation.z = -.2 - breathe * .05; armR.sh.rotation.z = .2 + breathe * .05; return; }
  if (name === 'walk') { const p = u * PI * 2, s = Math.sin(p);
    if (legs.length === 4) legs.forEach((l, i) => l.rotation.x = Math.sin(p + (i === 0 || i === 3 ? 0 : PI)) * .5);
    else if (legs.length === 2) { legs[0].rotation.x = s * .6 * legK; legs[1].rotation.x = -s * .6 * legK; }
    armL.sh.rotation.x = -s * .45; armR.sh.rotation.x = s * .45;
    body.position.y = 6 + Math.abs(Math.cos(p)) * 2.4; torso.rotation.y = s * .08;
    if (!legs.length) body.rotation.z = s * .08;
    return; }
  if (name === 'sword') { const w = rig.w.sword; w.visible = true;
    const wind = seg(ms, 150, 650), strike = seg(ms, 650, 800), rec = seg(ms, 1050, 1500), back = 1 - eIO(rec);
    armR.sh.rotation.x = lerp(lerp(0, -2.6, eIO(wind)), -.15, eOut(strike)) * back;
    armR.sh.rotation.z = .2 + .85 * eOut(Math.min(1, wind * 1.6)) * (1 - eOut(strike)) * back;
    torso.rotation.y = (lerp(.35 * eOut(wind), -.4, eOut(strike))) * back;
    torso.rotation.x = .18 * eOut(strike) * back;
    if (legs.length === 2) { legs[0].rotation.x = -.35 * eOut(strike) * back * legK; legs[1].rotation.x = .3 * eOut(strike) * back * legK; }
    armL.sh.rotation.x = -.5 * eOut(wind) * back;
    return; }
  if (name === 'bow') { const w = rig.w.bow; w.visible = true;
    const raise = seg(ms, 100, 450), draw = seg(ms, 450, 1050), rel = seg(ms, 1050, 1150), low = seg(ms, 1500, 1850);
    armL.sh.rotation.x = -1.57 * eOut(raise) * (1 - eIO(low)); armL.sh.rotation.z = -.2 + .2 * eOut(raise) * (1 - eIO(low));
    armR.sh.rotation.x = lerp(-1.5 * eOut(raise), -.9, eOut(draw) * (1 - eOut(rel))) * (1 - eIO(low));
    armR.sh.rotation.z = .2 - .36 * eOut(draw) * (1 - eOut(rel)) * (1 - eIO(low));
    w.userData.str.position.z = -3.5 * eOut(draw) * (1 - eOut(rel));
    torso.rotation.y = -.25 * eOut(raise) * (1 - eIO(low));
    if (fx.arrow && ms > 1050 && ms < 1700) { const k = seg(ms, 1050, 1700); fx.arrow.visible = true; fx.arrow.position.set(0, rig.h * .62, 18 + k * 160); fx.arrow.rotation.set(0, 0, 0); }
    return; }
  if (name === 'magic') { const w = rig.w.staff; w.visible = true;
    const raise = seg(ms, 100, 900), rel = seg(ms, 900, 1050), low = seg(ms, 1350, 1800);
    const pre = eOut(seg(ms, 0, 160));
    armR.sh.rotation.x = lerp(lerp(-1.25 * pre, -1.95, eOut(raise)), -1.05, eOut(rel)) * (1 - eIO(low));
    armR.sh.rotation.z = .2 + .4 * eOut(raise) * (1 - eIO(low));
    w.scale.setScalar(Math.max(.001, pre * (1 - seg(ms, 1550, 1800))));
    armL.sh.rotation.x = -1.2 * eOut(raise) * (1 - eOut(rel)); armL.sh.rotation.z = -.2 - .5 * eOut(raise) * (1 - eOut(rel));
    w.userData.glow.scale.setScalar(18 + 30 * eOut(raise) * (1 - rel));
    body.position.y = 6 + 2 * Math.sin(raise * PI) * (1 - rel);
    if (fx.bolt && ms > 950 && ms < 1500) { const k = seg(ms, 950, 1500); fx.bolt.visible = true; fx.bolt.position.set(4, rig.h * .82 - k * 20, 18 + k * 170); }
    return; }
  if (name === 'hit') { const k = seg(ms, 200, 260), r = seg(ms, 260, 900);
    body.position.z = -10 * eOut(k) * (1 - eIO(r)); body.rotation.x = -.35 * Math.sin(Math.min(1, r * 1.4) * PI);
    body.position.x = Math.sin(ms * .09) * 3 * (1 - r) * (ms > 200 ? 1 : 0);
    armL.sh.rotation.z = -.2 - .8 * Math.sin(r * PI); armR.sh.rotation.z = .2 + .8 * Math.sin(r * PI);
    flash(rig, ms > 200 ? 1 - seg(ms, 200, 600) : 0, 0xff3a28);
    return; }
  if (name === 'block') { const up = seg(ms, 100, 350), dn = seg(ms, 850, 1200);
    armL.sh.rotation.x = -1.7 * eOut(up) * (1 - eIO(dn)); armR.sh.rotation.x = -1.4 * eOut(up) * (1 - eIO(dn));
    armL.sh.rotation.z = -.2 + .12 * eOut(up) * (1 - eIO(dn)); armR.sh.rotation.z = .2 - .12 * eOut(up) * (1 - eIO(dn));
    body.rotation.x = -.12 * Math.sin(seg(ms, 350, 700) * PI);
    if (fx.ward) { const k = seg(ms, 300, 900); fx.ward.visible = k > 0 && k < 1; fx.ward.position.set(0, rig.h * .5, 6); fx.ward.scale.setScalar(.7 + .5 * eOut(k)); fx.ward.material.opacity = .4 * (1 - k); }
    flash(rig, ms > 330 ? .5 * (1 - seg(ms, 330, 700)) : 0, 0x3d8bff);
    return; }
  if (name === 'down') { const f = seg(ms, 250, 750), up = seg(ms, 1900, 2450);
    const k = eBack(f) * (1 - eIO(up));
    body.rotation.x = -PI / 2 * .92 * k; body.position.y = 6 + 7 * Math.min(1, k); body.position.z = -4 * k;
    armL.sh.rotation.x = armR.sh.rotation.x = -2.4 * k;
    flash(rig, ms > 200 ? 1 - seg(ms, 200, 500) : 0, 0xff2a4a);
    return; }
}
function addFx(scene, rig){
  rig.fx.arrow = arrowMesh(); rig.fx.bolt = boltMesh();
  rig.fx.ward = new THREE.Mesh(new THREE.SphereGeometry(34, 24, 16), new THREE.MeshBasicMaterial({color:0x5aa8ff, transparent:true, opacity:.3, depthWrite:false}));
  Object.values(rig.fx).forEach(o => { o.visible = false; rig.root.add(o); });
}
function dispose(rig){
  const seen = new Set();
  rig.root.traverse(o => { if (o.geometry && !seen.has(o.geometry)) { seen.add(o.geometry); o.geometry.dispose(); }
    if (o.material && o.material !== INK) (Array.isArray(o.material) ? o.material : [o.material]).forEach(m => { if (seen.has(m)) return; seen.add(m);
      if (m.map && m.map !== GLOW && m.map !== SHADOW && !m.map.userData.keep && ![...hairTexCache.values()].includes(m.map)) m.map.dispose(); m.dispose(); }); });
  if (rig.faces) Object.values(rig.faces).forEach(t => t.dispose());
}
/* animals and monsters (js/beastkit.js) are drawn with the same helpers */
const BK = makeBeasts(THREE, {inked, toon, tube, at, rot, SHADOW, GLOW, mix, shade, canvas, ctex, metalCap});
/* a look figkit can build: a person of a known race, or a known beast */
const okSpec = s => !!(s && (s.beast ? BK.isBeast(s) : RACES[s.race]));
const API = {RACES, RACE_LIST, HAIRC, EYES, CLOTH, HEAD_SIZES, HEAD_SHAPES, JAWS, EYE_SHAPES, EYE_SIZES, BROWS, NOSES, MOUTHS, EXPRS, MARKS, HAIRS, HAIR_LEN, BEARDS, OUTFITS, randomSpec,
  defaultSpec, faceFix, buildFigure, animate, pose, flash, addFx, dispose, faceIcon, ANIMS, pick, hoodOf, loadHair, hairId, setHairBase,
  BEASTS:BK.BEASTS, BEAST_LIST:BK.LIST, beastOf:BK.beastOf, beastSpec:BK.defaultSpec, isBeast:BK.isBeast, okSpec};
return API;
}
