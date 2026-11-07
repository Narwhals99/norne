/* Toy figure maker: a test to explore, not wired into fights yet (2026-11-07).
   Opened from the Character tab (next to Stats) and from Profile, and shown to one account only while it is tried out:
   N.figOk() compares a SHA-256 hash of the signed-in email, so the address itself is not in this public code.
   Nothing goes to the database: the figure being made is kept on this device (localStorage norne-fig-test).
   three.js (vendor/three.module.min.js, r160) and the figure kit (js/figkit.js) load only when the maker opens,
   and the 3D scene is thrown away when it closes, so phones don't keep holding the memory.
   The maker is its own layer over the app (outside #app), so redraws of the app never touch its canvas. */
(function(){
const N = window.N;
const ALLOW = ['b5253f6572ed46d2835da08cf45e30be033423abbc64525079af9632bd1bc952'];
let hashFor = null, allowed = false;
N.figOk = () => {
  const e = ((N.me && N.me()) || {}).email; if (!e) return false;
  if (hashFor !== e) {
    hashFor = e; allowed = false;
    if (window.crypto && crypto.subtle) crypto.subtle.digest('SHA-256', new TextEncoder().encode(String(e).trim().toLowerCase())).then(b => {
      const h = Array.from(new Uint8Array(b), x => x.toString(16).padStart(2, '0')).join('');
      if (hashFor === e && ALLOW.includes(h)) { allowed = true; if (N.renderAll) N.renderAll(); }
    }).catch(() => {});
  }
  return allowed;
};

const esc = s => String(s).replace(/[&<>"]/g, c => ({'&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;'}[c]));
const CSS = `
.figx{--sky-0:#060819;--sky-1:#0b0e2a;--raise:#1a1e4d;--raise-2:#262b6a;--sunk:#0c0f2e;--line:rgba(178,170,255,.14);--line-2:rgba(178,170,255,.28);
  --ink:#efecff;--ink-2:#c3bfe8;--ink-3:#a19dd0;--gold:#f4c46e;--gold-2:#e0a04a;--gold-ink:#341f06;--jade:#62d6a8;
  --f-mark:'Cinzel','Trajan Pro',Georgia,serif;--f-ui:'Nunito Sans','Segoe UI',system-ui,-apple-system,sans-serif;
  position:absolute;inset:0;z-index:95;overflow-y:auto;overflow-x:hidden;overscroll-behavior:contain;-webkit-overflow-scrolling:touch;color-scheme:dark;
  color:var(--ink);font:400 15px/1.5 var(--f-ui);-webkit-text-size-adjust:100%;
  background:radial-gradient(120% 60% at 85% -10%,rgba(126,92,255,.28),transparent 55%),radial-gradient(90% 50% at -10% 100%,rgba(40,90,200,.22),transparent 60%),linear-gradient(180deg,var(--sky-1),var(--sky-0))}
.figx *{box-sizing:border-box}
.figx .fx-bar{position:sticky;top:0;z-index:2;display:flex;align-items:center;gap:12px;padding:calc(10px + env(safe-area-inset-top,0px)) max(16px,env(safe-area-inset-right,0px)) 10px max(16px,env(safe-area-inset-left,0px));
  background:rgba(8,10,32,.86);-webkit-backdrop-filter:blur(10px);backdrop-filter:blur(10px);box-shadow:0 1px 0 var(--line)}
.figx .fx-bar h1{margin:0;flex:1;min-width:0;font:800 clamp(18px,3.4vw,24px)/1.1 var(--f-mark);letter-spacing:.02em}
.figx .fx-bar h1 small{display:block;margin-top:3px;font:800 10.5px/1.2 var(--f-ui);letter-spacing:.14em;text-transform:uppercase;color:var(--gold)}
.figx .fx-x{flex:none;min-height:44px;padding:0 16px;border:0;border-radius:12px;background:var(--raise);color:var(--ink);font:900 14px/1 var(--f-ui);cursor:pointer;box-shadow:0 0 0 1px var(--line-2)}
.figx .wrap{max-width:1180px;margin:0 auto;display:grid;gap:16px;padding:16px max(16px,env(safe-area-inset-right,0px)) calc(40px + env(safe-area-inset-bottom,0px)) max(16px,env(safe-area-inset-left,0px))}
.figx .lede{margin:0;max-width:70ch;color:var(--ink-2)}
.figx .lede b{color:var(--ink)}
.figx .main{display:grid;gap:16px;grid-template-columns:minmax(0,1fr)}
@media (min-width:920px){.figx .main{grid-template-columns:minmax(0,1.1fr) minmax(0,1fr);align-items:start}.figx .stagecol{position:sticky;top:84px}}
.figx .stagecol{display:grid;gap:10px;min-width:0}
.figx .stage{position:relative;height:clamp(300px,52vh,560px);border-radius:24px;overflow:hidden;
  background:radial-gradient(70% 60% at 50% 38%,#343a86 0%,#1a1e4d 55%,#0d1030 100%);box-shadow:0 24px 60px -20px rgba(0,0,0,.75),0 0 0 1px var(--line-2);touch-action:pan-y;cursor:grab}
.figx .stage.all{height:clamp(300px,42vh,400px)}
@media (max-width:560px){.figx .stage.all{height:540px}}
.figx .stage canvas{position:absolute;inset:0;width:100%;height:100%;display:block}
.figx .labels{position:absolute;inset:0;pointer-events:none}
.figx .labels span{position:absolute;transform:translate(-50%,0);padding:2px 7px;border-radius:999px;background:rgba(8,8,26,.82);color:#fff;font:800 10px/1.2 var(--f-ui);white-space:nowrap}
.figx .tag{position:absolute;left:12px;top:12px;padding:4px 10px;border-radius:999px;background:rgba(8,8,26,.7);color:var(--ink-2);font:800 10px/1.2 var(--f-ui);letter-spacing:.08em;text-transform:uppercase;pointer-events:none}
.figx .spin{position:absolute;right:12px;top:12px;color:var(--ink-3);font:700 11px/1.2 var(--f-ui);pointer-events:none}
.figx .load{position:absolute;inset:0;display:grid;place-items:center;padding:24px;text-align:center;color:var(--ink-2);font:800 14px/1.4 var(--f-ui)}
.figx .bar{display:flex;flex-wrap:wrap;gap:6px}
.figx .chip{min-height:38px;padding:0 13px;border:0;border-radius:999px;background:var(--raise);color:var(--ink-2);font:800 13px/1 var(--f-ui);cursor:pointer;box-shadow:0 0 0 1px var(--line)}
.figx .chip[aria-pressed="true"]{background:var(--gold);color:var(--gold-ink);box-shadow:none}
.figx button:focus-visible{outline:2px solid var(--gold);outline-offset:2px}
.figx .panel{display:grid;gap:14px;padding:14px;border-radius:24px;background:rgba(16,19,52,.82);box-shadow:0 0 0 1px var(--line),0 10px 30px -12px rgba(0,0,0,.6);min-width:0}
.figx .tabs{display:grid;grid-template-columns:repeat(4,1fr);gap:4px;padding:4px;border-radius:16px;background:var(--sunk);box-shadow:inset 0 0 0 1px var(--line)}
.figx .tab{min-height:42px;border:0;border-radius:12px;background:none;color:var(--ink-2);font:900 13.5px/1 var(--f-ui);cursor:pointer}
.figx .tab[aria-selected="true"]{background:var(--raise-2);color:var(--ink);box-shadow:0 0 0 1px var(--line-2)}
.figx .opts{display:grid;gap:16px}
.figx .grp{display:grid;gap:8px;min-width:0}
.figx .grp>.k{display:flex;justify-content:space-between;gap:8px;font:800 10.5px/1.2 var(--f-ui);letter-spacing:.14em;text-transform:uppercase;color:var(--ink-3)}
.figx .grp>.k b{letter-spacing:.02em;text-transform:none;color:var(--ink);font-size:12.5px}
.figx .grid{display:grid;gap:6px;grid-template-columns:repeat(auto-fill,minmax(98px,1fr))}
.figx .grid.faces{grid-template-columns:repeat(auto-fill,minmax(84px,1fr))}
.figx .opt{display:grid;justify-items:center;align-content:center;gap:4px;min-height:44px;padding:6px 8px;border:0;border-radius:12px;background:var(--raise);color:var(--ink-2);font:800 13px/1.15 var(--f-ui);cursor:pointer;box-shadow:0 0 0 1px var(--line);text-align:center}
.figx .opt img{width:56px;height:56px;border-radius:50%;box-shadow:0 0 0 2px rgba(0,0,0,.35)}
.figx .opt[aria-pressed="true"]{background:var(--raise-2);color:var(--ink);box-shadow:0 0 0 2px var(--gold)}
.figx .sws{display:flex;flex-wrap:wrap;gap:8px}
.figx .sw{display:grid;justify-items:center;gap:4px;width:64px;padding:0;border:0;background:none;color:var(--ink-3);font:700 11px/1.15 var(--f-ui);cursor:pointer;text-align:center}
.figx .sw i{display:block;width:38px;height:38px;border-radius:50%;background:var(--c);box-shadow:0 0 0 2px rgba(0,0,0,.4),inset 0 -6px 10px rgba(0,0,0,.25)}
.figx .sw[aria-pressed="true"]{color:var(--ink)}
.figx .sw[aria-pressed="true"] i{box-shadow:0 0 0 2px var(--sky-0),0 0 0 4px var(--gold)}
.figx .note{margin:0;color:var(--ink-3);font:600 12.5px/1.45 var(--f-ui)}
.figx .note b{color:var(--ink-2)}
.figx .foot{display:flex;flex-wrap:wrap;gap:8px;align-items:center;justify-content:space-between}
.figx .btn{min-height:42px;padding:0 16px;border:0;border-radius:12px;font:900 13.5px/1 var(--f-ui);cursor:pointer;background:var(--raise);color:var(--ink);box-shadow:0 0 0 1px var(--line-2)}
.figx .toast{color:var(--jade);font:800 12.5px/1.2 var(--f-ui)}
@media (prefers-reduced-motion:reduce){.figx *{scroll-behavior:auto}}
`;
const HTML = `
<header class="fx-bar"><h1><small>Test · only you can see this</small>Toy figure maker</h1><button type="button" class="fx-x" data-x>Close</button></header>
<div class="wrap">
  <p class="lede"><b>Build a figure from parts.</b> Pick a race, body, face, hair and outfit, then try the moves under the picture. Drag the figure to turn it. This is a test: the figure is kept on this device only, and nothing else in Norne changes.</p>
  <div class="main">
    <section class="stagecol" aria-label="Figure preview">
      <div class="stage" data-r="stage"><canvas aria-hidden="true"></canvas><div class="labels" data-r="labels"></div><span class="tag" data-r="tag">Your figure</span><span class="spin" data-r="spin">Drag to turn</span><div class="load" data-r="load">Loading the figure maker…</div></div>
      <div class="bar" data-r="anims" role="group" aria-label="Moves"></div>
      <div class="bar" data-r="views" role="group" aria-label="View">
        <button type="button" class="chip" data-v="one" aria-pressed="true">My figure</button>
        <button type="button" class="chip" data-v="all" aria-pressed="false">Every race's default</button>
      </div>
    </section>
    <section class="panel" aria-label="Figure maker">
      <div class="tabs" role="tablist" data-r="tabs">
        <button type="button" class="tab" role="tab" data-t="body" aria-selected="true">Body</button>
        <button type="button" class="tab" role="tab" data-t="face" aria-selected="false">Face</button>
        <button type="button" class="tab" role="tab" data-t="hair" aria-selected="false">Hair</button>
        <button type="button" class="tab" role="tab" data-t="outfit" aria-selected="false">Outfit</button>
      </div>
      <div class="opts" data-r="opts"></div>
      <div class="foot"><button type="button" class="btn" data-r="reset">Back to the race default</button><span class="toast" data-r="toast" aria-live="polite"></span></div>
      <p class="note">Humans' looks come from the lore (the four peoples). The other races' default looks are the usual fantasy ones for now, so <b>Jake can change any of them</b>.</p>
    </section>
  </div>
</div>`;

let box = null, stop = null, cssDone = false, openV = null;
const shut = () => { if (stop) { stop(); stop = null; } if (box) { box.remove(); box = null; } };
N.figOpen = v => {
  if (box || !N.figOk()) return;
  if (!cssDone) { const st = document.createElement('style'); st.textContent = CSS; document.head.appendChild(st); cssDone = true; }
  openV = v;
  box = document.createElement('div'); box.className = 'figx'; box.setAttribute('role', 'dialog'); box.setAttribute('aria-modal', 'true'); box.setAttribute('aria-label', 'Toy figure maker');
  box.innerHTML = HTML;
  (document.querySelector('.device') || document.body).appendChild(box);
  const leave = () => { const w = openV; shut(); if (w && w.ui.figs) { w.ui.figs = false; N.render(w); } };
  box.querySelector('[data-x]').addEventListener('click', leave);
  box.addEventListener('keydown', e => { if (e.key === 'Escape') leave(); });
  box.querySelector('[data-x]').focus({preventScroll:true});
  const me = box, url = f => new URL(f, document.baseURI).href;
  Promise.all([import(url('vendor/three.module.min.js')), import(url('js/figkit.js'))]).then(([THREE, kit]) => {
    if (box !== me) return;
    stop = start(me, THREE, kit.makeKit(THREE));
  }).catch(() => { if (box === me) me.querySelector('[data-r=load]').textContent = 'The figure maker could not load. Check the connection, close it and try again.'; });
};
/* the app's back step (Android back, phone edge swipe) closes it too, see backStep in js/app.js */
N.figClose = shut;

function start(box, THREE, K){
  const $ = r => box.querySelector(`[data-r="${r}"]`);
  const stage = $('stage'), cvs = stage.querySelector('canvas'), labels = $('labels');
  let renderer = null;
  try { renderer = new THREE.WebGLRenderer({canvas:cvs, antialias:true, alpha:true, powerPreference:'low-power'}); } catch (e) {}
  if (!renderer) { $('load').textContent = 'This device can’t show 3D right now.'; return () => {}; }
  $('load').remove();
  renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 2)); renderer.outputColorSpace = THREE.SRGBColorSpace;
  const scene = new THREE.Scene(), camera = new THREE.PerspectiveCamera(28, 1, 1, 5000), ortho = new THREE.OrthographicCamera(-1, 1, 1, -1, 1, 6000), ZG = 200;
  scene.add(new THREE.HemisphereLight(0xfff0dc, 0x40386a, 1.9));
  const sun = new THREE.DirectionalLight(0xffffff, 2.5); sun.position.set(-300, 700, 600); scene.add(sun);

  const ANIM_NAMES = [['idle', 'Stand'], ['walk', 'Walk'], ['sword', 'Sword'], ['bow', 'Bow'], ['magic', 'Magic'], ['hit', 'Hit'], ['block', 'Block'], ['down', 'Knocked down']];
  let spec = null, rig = null, all = [], view = 'one', tab = 'body', anim = 'idle', t0 = performance.now(), spin = .35, frozen = null, running = true;
  try { const s = JSON.parse(localStorage.getItem('norne-fig-test') || 'null'); if (s && K.RACES[s.race]) spec = s; } catch (e) {}
  if (!spec) spec = K.defaultSpec('Human', 'm');
  const save = () => { try { localStorage.setItem('norne-fig-test', JSON.stringify(spec)); } catch (e) {} };

  function rebuild(){
    if (rig) { scene.remove(rig.root); K.dispose(rig); }
    rig = K.buildFigure(spec); K.addFx(scene, rig); scene.add(rig.root);
    rig.root.visible = view === 'one';
    frame(); save();
  }
  function buildAll(){
    all.forEach(r => { scene.remove(r.root); K.dispose(r); }); all = [];
    K.RACE_LIST.forEach((race, i) => { const r = K.buildFigure(K.defaultSpec(race, i % 2 ? 'f' : 'm')); r.race = race; all.push(r); scene.add(r.root); });
    layoutAll();
  }
  function layoutAll(){
    const W = stage.clientWidth, cols = W < 560 ? 4 : 8, gap = 62, rows = Math.ceil(all.length / cols);
    all.forEach((r, i) => { const c = i % cols, ro = Math.floor(i / cols);
      r.root.position.set((c - (cols - 1) / 2) * gap, 0, (ro - (rows - 1) / 2) * ZG); r.root.rotation.y = 0; r.root.visible = view === 'all'; });
    labels.innerHTML = view === 'all' ? all.map(r => `<span>${esc(r.race)}</span>`).join('') : '';
    frame();
  }
  function frame(){
    const W = stage.clientWidth, H = stage.clientHeight; if (!W || !H) return;
    renderer.setSize(W, H, false);
    camera.aspect = W / H;
    if (view === 'one') {
      const h = rig ? rig.h + 8 : 90, tan = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
      let d = (h * .62) / tan; if (camera.aspect < .8) d /= camera.aspect / .8;
      camera.position.set(0, h * .5 + d * .22, d); camera.lookAt(0, h * .44, 0);
    } else {
      const cols = W < 560 ? 4 : 8, rows = Math.ceil(K.RACE_LIST.length / cols), A = THREE.MathUtils.degToRad(22);
      const needW = cols * 62 + 24, needH = (rows - 1) * ZG * Math.sin(A) + 118;
      const hh = Math.max(needH / 2, needW / 2 / (W / H)), hw = hh * W / H;
      ortho.left = -hw; ortho.right = hw; ortho.top = hh; ortho.bottom = -hh;
      ortho.position.set(0, 36 + 2000 * Math.sin(A), 2000 * Math.cos(A)); ortho.lookAt(0, 28, 0); ortho.updateProjectionMatrix();
    }
    camera.updateProjectionMatrix();
  }
  const v3 = new THREE.Vector3();
  function tick(now){
    if (!running) return;
    requestAnimationFrame(tick);
    if (document.hidden) return;
    const t = frozen != null ? frozen : now - t0;
    if (view === 'one' && rig) {
      K.animate(rig, anim, t);
      rig.root.rotation.y = spin + (['sword', 'bow', 'magic'].includes(anim) ? .55 : 0);
    } else {
      all.forEach(r => K.animate(r, anim, t + r.root.position.x * 3));
      const W = stage.clientWidth, H = stage.clientHeight, sp = labels.children;
      all.forEach((r, i) => { if (!sp[i]) return; v3.set(r.root.position.x, 0, r.root.position.z + 24).project(ortho);
        sp[i].style.left = ((v3.x + 1) / 2 * W).toFixed(1) + 'px'; sp[i].style.top = ((1 - v3.y) / 2 * H + 2).toFixed(1) + 'px'; });
    }
    renderer.render(scene, view === 'all' ? ortho : camera);
  }
  /* drag sideways to turn the figure; up and down still scroll the page */
  let drag = null;
  stage.addEventListener('pointerdown', e => { if (view !== 'one') return; drag = {x:e.clientX, s:spin}; try { stage.setPointerCapture(e.pointerId); } catch (x) {} stage.style.cursor = 'grabbing'; });
  stage.addEventListener('pointermove', e => { if (drag) spin = drag.s + (e.clientX - drag.x) * .012; });
  const endDrag = () => { drag = null; stage.style.cursor = ''; };
  stage.addEventListener('pointerup', endDrag); stage.addEventListener('pointercancel', endDrag);

  const R = () => K.RACES[spec.race];
  const sw = (id, label, color, on, key) => `<button type="button" class="sw" data-k="${key}" data-v="${id}" aria-pressed="${on}"><i style="--c:${color}"></i>${esc(label)}</button>`;
  const opt = (id, label, on, key, extra = '') => `<button type="button" class="opt" data-k="${key}" data-v="${id}" aria-pressed="${on}">${extra}${esc(label)}</button>`;
  const hairWord = () => { const r = R(); return spec.race === 'Kenku' ? 'Feather colour' : spec.race === 'Lizardfolk' ? 'Crest colour' : spec.race === 'Gorgon' ? 'Snake colour' : spec.race === 'Fishfolk' ? 'Fin colour' : r.coat ? 'Hair and coat colour' : 'Hair colour'; };
  function opts(){
    const r = R(), o = [];
    const grp = (k, val, body, cls = 'grid') => o.push(`<div class="grp"><span class="k">${k}${val ? `<b>${esc(val)}</b>` : ''}</span><div class="${cls}">${body}</div></div>`);
    if (tab === 'body') {
      grp('Race', spec.race, K.RACE_LIST.map(x => opt(x, x, x === spec.race, 'race')).join(''));
      grp('Body shape', '', opt('f', 'Female', spec.body === 'f', 'body') + opt('m', 'Male', spec.body === 'm', 'body'));
      grp(spec.race === 'Human' ? 'People' : r.beast === 'bird' ? 'Feathers' : r.beast ? 'Skin, scales or fur' : 'Skin', r.skins[spec.skin].n, r.skins.map((s, i) => sw(i, s.n, s.c, i === +spec.skin, 'skin')).join(''), 'sws');
      if (spec.race === 'Human') o.push(`<p class="note">Picking a people also sets the hair and eye colour the lore gives them. You can still change both.</p>`);
    } else if (tab === 'face') {
      grp('Face', K.pick(K.FACES, spec.face)[1], K.FACES.map(([id, n]) => opt(id, n, id === spec.face, 'face', `<img alt="" src="${K.faceIcon(spec, id)}">`)).join(''), 'grid faces');
      grp('Eye colour', K.pick(K.EYES, spec.eyes)[1], K.EYES.map(([id, n, c]) => sw(id, n, c, id === spec.eyes, 'eyes')).join(''), 'sws');
    } else if (tab === 'hair') {
      if (r.nohair || r.nohairStyle) o.push(`<p class="note">${spec.race === 'Gorgon' ? 'Gorgons have serpent locks instead of hair (from the lore). Pick the snakes\' colour below.' : `${esc(spec.race)} have no hair, so only the colour below changes.`}</p>`);
      else grp('Hairstyle', K.pick(K.HAIRS, spec.hair)[1], K.HAIRS.map(([id, n]) => opt(id, n, id === spec.hair, 'hair')).join(''));
      grp(hairWord(), K.pick(K.HAIRC, spec.hairCol)[1], K.HAIRC.map(([id, n, c]) => sw(id, n, c, id === spec.hairCol, 'hairCol')).join(''), 'sws');
      if (!r.nohair && !r.snakes) grp('Beard', '', K.BEARDS.map(([id, n]) => opt(id, n, id === spec.beard, 'beard')).join(''));
    } else {
      grp('Outfit or armour', K.pick(K.OUTFITS, spec.outfit)[1], K.OUTFITS.map(([id, n]) => opt(id, n, id === spec.outfit, 'outfit')).join(''));
      const hd = K.hoodOf(spec);
      if (hd) grp('Hood', '', opt('up', 'Up', hd === 'up', 'hood') + opt('down', 'Down', hd === 'down', 'hood'));
      grp('Main colour', K.pick(K.CLOTH, spec.cloth)[1], K.CLOTH.map(([id, n, c]) => sw(id, n, c, id === spec.cloth, 'cloth')).join(''), 'sws');
    }
    $('opts').innerHTML = o.join('');
    $('tabs').querySelectorAll('.tab').forEach(b => b.setAttribute('aria-selected', String(b.dataset.t === tab)));
  }
  $('opts').addEventListener('click', e => {
    const b = e.target.closest('[data-k]'); if (!b) return;
    const k = b.dataset.k, val = b.dataset.v;
    if (k === 'race') spec = K.defaultSpec(val, spec.body);
    else if (k === 'body') { spec.body = val; if (val === 'f') spec.beard = 'none'; }
    else if (k === 'skin') { spec.skin = +val; const p = R().skins[+val]; if (p.eye) spec.eyes = p.eye; if (p.hair) spec.hairCol = p.hair; }
    else if (k === 'outfit') { spec.outfit = val; spec.cloth = K.pick(K.OUTFITS, val)[2].cloth; delete spec.hood; }
    else spec[k] = val;
    rebuild(); opts();
  });
  $('tabs').addEventListener('click', e => { const b = e.target.closest('[data-t]'); if (!b) return; tab = b.dataset.t; opts(); });
  let toastT = 0;
  $('reset').addEventListener('click', () => { spec = K.defaultSpec(spec.race, spec.body); rebuild(); opts(); $('toast').textContent = `Back to the ${spec.race} default`; clearTimeout(toastT); toastT = setTimeout(() => { $('toast').textContent = ''; }, 2200); });
  const animBar = $('anims');
  animBar.innerHTML = ANIM_NAMES.map(([id, n]) => `<button type="button" class="chip" data-a="${id}" aria-pressed="${id === anim}">${n}</button>`).join('');
  const markAnim = () => animBar.querySelectorAll('.chip').forEach(c => c.setAttribute('aria-pressed', String(c.dataset.a === anim)));
  animBar.addEventListener('click', e => { const b = e.target.closest('[data-a]'); if (!b) return; anim = b.dataset.a; t0 = performance.now(); frozen = null; markAnim(); });
  $('views').addEventListener('click', e => { const b = e.target.closest('[data-v]'); if (b) setView(b.dataset.v); });
  function setView(w){
    view = w; stage.classList.toggle('all', w === 'all');
    $('views').querySelectorAll('.chip').forEach(c => c.setAttribute('aria-pressed', String(c.dataset.v === w)));
    $('tag').textContent = w === 'all' ? 'Every race, default look' : 'Your figure'; $('spin').hidden = w === 'all';
    if (w === 'all' && !all.length) buildAll();
    if (rig) rig.root.visible = w === 'one'; all.forEach(r => { r.root.visible = w === 'all'; });
    requestAnimationFrame(() => { layoutAll(); frame(); });
  }
  const ro = new ResizeObserver(() => { if (view === 'all') layoutAll(); else frame(); }); ro.observe(stage);
  rebuild(); opts(); requestAnimationFrame(tick);
  /* test hook for screenshots: set a look, freeze a move */
  N.figTest = {set(s, o){ spec = Object.assign(K.defaultSpec(s.race || spec.race, s.body || spec.body), s); rebuild(); if (o && o.tab) tab = o.tab; opts(); },
    pose(a, ms, sp){ anim = a; frozen = ms; if (sp != null) spin = sp; markAnim(); }, view:setView};
  return () => {
    running = false; ro.disconnect(); N.figTest = null;
    if (rig) { scene.remove(rig.root); K.dispose(rig); rig = null; }
    all.forEach(r => { scene.remove(r.root); K.dispose(r); }); all = [];
    renderer.dispose(); try { renderer.forceContextLoss(); } catch (e) {}
  };
}
})();
