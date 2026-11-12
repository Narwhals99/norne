/* Toy figure maker (2026-11-07). The saved figures stand on the fight board (js/figboard.js, 2026-11-08).
   Opened from the Character tab (next to Stats) and from Profile. Every player has it since 2026-11-11 (Jack: "enable
   figurines for all players"); before that it was one account's test. The GM has it from an NPC card (Make figure) and from fight setup (Figures, with random looks for NPCs without a card).
   The figure being made is kept on this device (localStorage norne-fig-test: {spec, char, base}) until Save figure puts it
   on the player's character card (fig, figAt): that is the character's figure until they save another. The card already
   goes out with the character (game/chars or parties/<id>), so no new security rules are needed. On another device the
   saved figure wins over a draft that was started from an older save (base = the figAt it began from).
   three.js (vendor/three.module.min.js, r160) and the figure kit (js/figkit.js) load only when the maker opens,
   and each hairstyle's model (art/hair/) loads the first time it is picked; the figure is rebuilt once it has arrived,
   The Head tab picks the head's size, shape and jawline and the face's eyes, brows, nose, mouth, marks and expression
   (figkit: headWarp, faceSheet; the button pictures come from faceIcon).
   and the 3D scene is thrown away when it closes, so phones don't keep holding the memory.
   The maker is its own layer over the app (outside #app), so redraws of the app never touch its canvas. */
(function(){
const N = window.N;
/* everyone at the table: players make their character's figure, the GM makes NPCs' (Jack, 2026-11-11) */
N.figOk = () => true;

const esc = s => String(s).replace(/[&<>"]/g, c => ({'&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;'}[c]));
const CSS = `
.figx{--sky-0:#060819;--sky-1:#0b0e2a;--raise:#1a1e4d;--raise-2:#262b6a;--sunk:#0c0f2e;--line:rgba(178,170,255,.14);--line-2:rgba(178,170,255,.28);
  --ink:#efecff;--ink-2:#c3bfe8;--ink-3:#a19dd0;--gold:#f4c46e;--gold-2:#e0a04a;--gold-ink:#341f06;--jade:#62d6a8;
  --f-mark:'Cinzel','Trajan Pro',Georgia,serif;--f-ui:'Nunito Sans','Segoe UI',system-ui,-apple-system,sans-serif;
  position:absolute;inset:0;z-index:95;overflow-y:auto;overflow-x:hidden;overscroll-behavior:contain;-webkit-overflow-scrolling:touch;color-scheme:dark;
  color:var(--ink);font:400 15px/1.5 var(--f-ui);-webkit-text-size-adjust:100%;
  background:radial-gradient(120% 60% at 85% -10%,rgba(126,92,255,.28),transparent 55%),radial-gradient(90% 50% at -10% 100%,rgba(40,90,200,.22),transparent 60%),linear-gradient(180deg,var(--sky-1),var(--sky-0))}
.figx *{box-sizing:border-box}
.figx [hidden]{display:none!important}
.figx .fx-bar{position:sticky;top:0;z-index:2;display:flex;align-items:center;gap:12px;padding:calc(10px + env(safe-area-inset-top,0px)) max(16px,env(safe-area-inset-right,0px)) 10px max(16px,env(safe-area-inset-left,0px));
  background:rgba(8,10,32,.86);-webkit-backdrop-filter:blur(10px);backdrop-filter:blur(10px);box-shadow:0 1px 0 var(--line)}
.figx .fx-bar h1{margin:0;flex:1;min-width:0;font:800 clamp(18px,3.4vw,24px)/1.1 var(--f-mark);letter-spacing:.02em}
.figx .fx-bar h1 small{display:block;margin-top:3px;font:800 10.5px/1.2 var(--f-ui);letter-spacing:.14em;text-transform:uppercase;color:var(--gold)}
.figx .fx-bar{flex-wrap:wrap}
.figx .fx-x{flex:none;min-height:44px;padding:0 16px;border:0;border-radius:12px;background:var(--raise);color:var(--ink);font:900 14px/1 var(--f-ui);cursor:pointer;box-shadow:0 0 0 1px var(--line-2)}
.figx .fx-save{flex:none;display:inline-flex;align-items:center;gap:6px;min-height:44px;padding:0 16px;border:0;border-radius:12px;background:var(--gold);color:var(--gold-ink);font:900 14px/1 var(--f-ui);cursor:pointer;box-shadow:0 6px 18px -8px rgba(244,196,110,.7)}
.figx .fx-save.done{background:var(--raise);color:var(--jade);box-shadow:0 0 0 1px var(--line-2)}
.figx .fx-save svg{width:16px;height:16px;flex:none}
.figx .fx-ask{flex:1 0 100%;display:flex;flex-wrap:wrap;align-items:center;gap:8px;padding:10px 12px;border-radius:14px;background:var(--raise);box-shadow:0 0 0 1px var(--gold)}
.figx .fx-ask span{flex:1 1 180px;font:800 14px/1.3 var(--f-ui)}
.figx .fx-ask .fx-x{min-height:40px;padding:0 13px;font-size:13.5px}
.figx .fx-ask .fx-save{min-height:40px;padding:0 13px;font-size:13.5px}
.figx .saved{display:flex;flex-wrap:wrap;align-items:center;gap:4px 10px;padding:10px 14px;border-radius:16px;background:rgba(16,19,52,.82);box-shadow:0 0 0 1px var(--line);color:var(--ink-2);font:600 13px/1.4 var(--f-ui);min-width:0}
.figx .saved>span{flex:1 1 200px;min-width:0}
.figx .saved b{color:var(--ink)}
.figx .saved i{flex:none;width:10px;height:10px;border-radius:50%;background:var(--jade);box-shadow:0 0 0 3px rgba(98,214,168,.18)}
.figx .saved.dirty i{background:var(--gold);box-shadow:0 0 0 3px rgba(244,196,110,.18)}
.figx .saved button{min-height:36px;padding:0 12px;border:0;border-radius:10px;background:var(--raise);color:var(--ink);font:800 12.5px/1 var(--f-ui);cursor:pointer;box-shadow:0 0 0 1px var(--line-2)}
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
/* phones and narrow windows: the figure stays in view under the top bar while the options scroll, so changes (like the hair length) show as you make them */
@media (max-width:919px){.figx .stagecol{display:contents}.figx .stage{position:sticky;top:var(--barh,64px);z-index:1;height:clamp(250px,40vh,380px)}.figx .stage.all{position:relative;top:auto}}
.figx .stage canvas{position:absolute;inset:0;width:100%;height:100%;display:block}
.figx .labels{position:absolute;inset:0;pointer-events:none}
.figx .labels span{position:absolute;transform:translate(-50%,0);padding:2px 7px;border-radius:999px;background:rgba(8,8,26,.82);color:#fff;font:800 10px/1.2 var(--f-ui);white-space:nowrap}
.figx .tag{position:absolute;left:12px;top:12px;padding:4px 10px;border-radius:999px;background:rgba(8,8,26,.7);color:var(--ink-2);font:800 10px/1.2 var(--f-ui);letter-spacing:.08em;text-transform:uppercase;pointer-events:none}
.figx .spin{position:absolute;right:12px;top:12px;color:var(--ink-3);font:700 11px/1.2 var(--f-ui);pointer-events:none}
.figx .load{position:absolute;inset:0;display:grid;place-items:center;padding:24px;text-align:center;color:var(--ink-2);font:800 14px/1.4 var(--f-ui)}
.figx .bar{display:flex;flex-wrap:wrap;gap:6px}
.figx .chip{min-height:38px;padding:0 13px;border:0;border-radius:999px;background:var(--raise);color:var(--ink-2);font:800 13px/1 var(--f-ui);cursor:pointer;box-shadow:0 0 0 1px var(--line)}
.figx .wpn{display:flex;align-items:center;gap:8px;color:var(--ink-2);font:800 13px/1.2 var(--f-ui)}
.figx .wpn select{flex:1;min-width:0;max-width:260px;min-height:38px;padding:0 10px;border:0;border-radius:12px;background:var(--raise);color:var(--ink);font:800 16px/1 var(--f-ui);box-shadow:0 0 0 1px var(--line)}
.figx .wpn small{flex-basis:100%;color:var(--ink-3);font:700 11.5px/1.3 var(--f-ui)}
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
.figx .grid.hairs{grid-template-columns:repeat(auto-fill,minmax(66px,1fr))}
.figx .grid.hairs .opt{padding:5px 4px 6px}
.figx .hthumb{display:block;width:56px;height:56px;border-radius:10px;background:var(--sunk) url(art/hair/thumbs.jpg) no-repeat;background-size:1568px 56px;background-position:calc(var(--i) * -56px) 0}
.figx .grid.steps{grid-template-columns:repeat(3,minmax(0,1fr))}
.figx .kind{display:grid;grid-template-columns:1fr 1fr;gap:4px;padding:4px;border-radius:16px;background:var(--sunk);box-shadow:inset 0 0 0 1px var(--line)}
.figx .kind .tab[aria-pressed="true"]{background:var(--gold);color:var(--gold-ink)}
.figx .grid.beasts{grid-template-columns:repeat(auto-fill,minmax(92px,1fr))}
.figx .grid.beasts .opt{padding:6px 4px 8px;font-size:12.5px}
.figx .bthumb{display:block;width:72px;height:72px;border-radius:12px;background:var(--sunk);object-fit:contain}
.figx .bthumb.wait{background:linear-gradient(90deg,var(--sunk),var(--raise),var(--sunk));background-size:200% 100%;animation:figwait 1.2s linear infinite}
@keyframes figwait{to{background-position:-200% 0}}
.figx .note{margin:0;color:var(--ink-3);font:600 12.5px/1.45 var(--f-ui)}
.figx .note b{color:var(--ink-2)}
.figx .foot{display:flex;flex-wrap:wrap;gap:8px;align-items:center;justify-content:space-between}
.figx .btn{min-height:42px;padding:0 16px;border:0;border-radius:12px;font:900 13.5px/1 var(--f-ui);cursor:pointer;background:var(--raise);color:var(--ink);box-shadow:0 0 0 1px var(--line-2)}
.figx .toast{color:var(--jade);font:800 12.5px/1.2 var(--f-ui)}
@media (prefers-reduced-motion:reduce){.figx *{scroll-behavior:auto}}
`;
const HTML = `
<header class="fx-bar"><h1><small>Your figure for fights</small>Toy figure maker</h1><button type="button" class="fx-save" data-r="save" hidden>Save figure</button><button type="button" class="fx-x" data-x>Close</button>
  <div class="fx-ask" data-r="ask" role="alertdialog" aria-label="Unsaved figure" hidden><span>Your changes to the figure aren’t saved.</span><button type="button" class="fx-save" data-r="askSave">Save and close</button><button type="button" class="fx-x" data-r="askDrop">Close without saving</button><button type="button" class="fx-x" data-r="askKeep">Keep editing</button></div></header>
<div class="wrap">
  <p class="lede" data-r="lede"><b>Build a figure from parts.</b> Pick a race, body, head, hair and outfit, then try the moves under the picture. Drag the figure to turn it.</p>
  <div class="main">
    <section class="stagecol" aria-label="Figure preview">
      <div class="stage" data-r="stage"><canvas aria-hidden="true"></canvas><div class="labels" data-r="labels"></div><span class="tag" data-r="tag"></span><span class="spin" data-r="spin">Drag to turn</span><div class="load" data-r="load">Loading the figure maker…</div></div>
      <div class="bar" data-r="anims" role="group" aria-label="Moves"></div>
      <label class="wpn" data-r="wpnRow"><span>Try a weapon</span><select data-r="wpn" aria-label="Weapon to try"></select></label>
      <div class="bar" data-r="views" role="group" aria-label="View">
        <button type="button" class="chip" data-v="one" aria-pressed="true">My figure</button>
        <button type="button" class="chip" data-v="all" aria-pressed="false">Every race's default</button>
        <button type="button" class="chip" data-v="beasts" aria-pressed="false">Every animal</button>
      </div>
      <div class="saved" data-r="saved" aria-live="polite"></div>
    </section>
    <section class="panel" aria-label="Figure maker">
      <div class="kind" role="group" aria-label="Kind of figure" data-r="kind"><button type="button" class="tab" data-kind="person" aria-pressed="true">Person</button><button type="button" class="tab" data-kind="beast" aria-pressed="false">Animal or monster</button></div>
      <div class="tabs" role="tablist" data-r="tabs">
        <button type="button" class="tab" role="tab" data-t="body" aria-selected="true">Body</button>
        <button type="button" class="tab" role="tab" data-t="head" aria-selected="false">Head</button>
        <button type="button" class="tab" role="tab" data-t="hair" aria-selected="false">Hair</button>
        <button type="button" class="tab" role="tab" data-t="outfit" aria-selected="false">Outfit</button>
      </div>
      <div class="opts" data-r="opts"></div>
      <div class="foot"><button type="button" class="btn" data-r="reset">Back to the race default</button><span class="toast" data-r="toast" aria-live="polite"></span></div>
      <p class="note" data-r="racenote">Humans' looks come from the lore (the four peoples). The other races' default looks are the usual fantasy ones for now, so <b>Jake can change any of them</b>.</p>
    </section>
  </div>
</div>`;

let box = null, stop = null, cssDone = false, openV = null, openT = null;
/* who the figure is for: the player's own character (no target), an NPC card ('npc:<id>') or a fighter in the fight being
   set up ('tok:<id>'). get() reads it fresh each time, since a sync can swap the object. */
function targetOf(v, tg){
  const g = N.G, at = s => String(s || '').trim();
  if (tg && tg.startsWith('npc:')) { const id = tg.slice(4), get = () => g.npcs.find(n => n.id === id), n = get(); return n ? {kind:'npc', id, get, name:n.name || 'This NPC', race:n.race} : null; }
  if (tg && tg.startsWith('tok:')) { const id = tg.slice(4), get = () => (g.combat.tokens || []).find(t => t.id === id), t = get();
    const n = t && g.npcs.find(x => x.id === t.ref); return t ? {kind:'tok', id, get, name:t.name || 'This fighter', race:n && n.race} : null; }
  const role = v && v.role, get = () => role && role !== 'gm' ? N.charOf(role) : null, c = get();
  return c ? {kind:'pc', id:c.id, get, name:at(c.short) || at(c.name) || 'your character', race:c.race} : null;
}
const shut = () => { if (stop) { stop(); stop = null; } if (box) { box.remove(); box = null; } };
N.figOpen = (v, tg) => {
  if (box || !N.figOk()) return;
  openT = targetOf(v, tg);
  if (!cssDone) { const st = document.createElement('style'); st.textContent = CSS; document.head.appendChild(st); cssDone = true; }
  openV = v;
  box = document.createElement('div'); box.className = 'figx'; box.setAttribute('role', 'dialog'); box.setAttribute('aria-modal', 'true'); box.setAttribute('aria-label', 'Toy figure maker');
  box.innerHTML = HTML;
  if (v && v.role === 'gm') box.querySelector('.fx-bar h1 small').textContent = 'Figures for fights';
  /* animals and monsters are the GM's (Jack, 2026-11-11): players only build people */
  else { box.querySelector('[data-r="kind"]').hidden = true; box.querySelector('[data-v="beasts"]').hidden = true; }
  (document.querySelector('.device') || document.body).appendChild(box);
  const leave = leaveNow;
  /* with changes that aren't saved, Close asks first (box.ask, set up in start) */
  const tryLeave = () => { if (box && box.ask && box.ask(leave)) return; leave(); };
  box.querySelector('[data-x]').addEventListener('click', tryLeave);
  box.addEventListener('keydown', e => { if (e.key === 'Escape') tryLeave(); });
  box.querySelector('[data-x]').focus({preventScroll:true});
  const me = box, url = f => new URL(f, document.baseURI).href;
  Promise.all([import(url('vendor/three.module.min.js')), import(url('js/figkit.js'))]).then(([THREE, kit]) => {
    if (box !== me) return;
    stop = start(me, THREE, kit.makeKit(THREE));
  }).catch(() => { if (box === me) me.querySelector('[data-r=load]').textContent = 'The figure maker could not load. Check the connection, close it and try again.'; });
};
/* the app's back step (Android back, phone edge swipe) closes it too, see backStep in js/app.js; with changes that
   aren't saved it asks first, like Close, and the maker stays open until that is answered */
function leaveNow(){ const w = openV; shut(); if (w && w.ui.figs) { w.ui.figs = false; N.render(w); } }
N.figClose = () => { if (box && box.ask && box.ask(leaveNow)) { if (openV) openV.ui.figs = true; return; } shut(); };

/* ---------- figures outside the maker: random looks and small pictures for the GM's fight setup ---------- */
const url = f => new URL(f, document.baseURI).href;
let kitP = null;
const kitLoad = () => kitP || (kitP = Promise.all([import(url('vendor/three.module.min.js')), import(url('js/figkit.js'))])
  .then(([THREE, kit]) => ({THREE, K:kit.makeKit(THREE)})).catch(e => { kitP = null; throw e; }));
N.figKit = kitLoad;
/* the fight board's figures (js/figboard.js) stop drawing while the maker covers the screen */
N.figMakerOpen = () => !!box;
/* a still picture of a figure, made once per look and kept while the app is open. One small renderer does them all,
   one at a time, and lets go of its 3D context when it has had nothing to do for a while (phones have few). */
const PICS = new Map(), PEND = new Set();
let shotQ = Promise.resolve(), shotR = null, shotIdle = 0;
N.figPic = spec => {
  if (!spec || !spec.race) return null;
  const key = JSON.stringify(spec);
  if (PICS.has(key)) return PICS.get(key);
  if (!PEND.has(key)) { PEND.add(key);
    shotQ = shotQ.then(() => shoot(spec)).then(src => { PICS.set(key, src); if (PICS.size > 80) PICS.delete(PICS.keys().next().value); })
      .catch(() => { PICS.set(key, null); }).then(() => { PEND.delete(key); if (N.renderAll) N.renderAll(); }); }
  return null;
};
function shoot(spec){
  return kitLoad().then(({THREE, K}) => K.loadHair(K.hairId(spec.hair || 'bald')).catch(() => {}).then(() => {
    const W = 96, H = 120;
    if (!shotR) { shotR = new THREE.WebGLRenderer({antialias:true, alpha:true, preserveDrawingBuffer:true, powerPreference:'low-power'});
      shotR.setPixelRatio(2); shotR.setSize(W, H, false); shotR.outputColorSpace = THREE.SRGBColorSpace; }
    const sc = new THREE.Scene(); sc.add(new THREE.HemisphereLight(0xfff0dc, 0x40386a, 1.9));
    const sun = new THREE.DirectionalLight(0xffffff, 2.5); sun.position.set(-300, 700, 600); sc.add(sun);
    const s = K.faceFix(JSON.parse(JSON.stringify(spec))); s.hair = K.hairId(s.hair || 'bald');
    const rig = K.buildFigure(s, {fine:true}); sc.add(rig.root); rig.root.rotation.y = .35; rig.root.updateMatrixWorld(true); K.animate(rig, 'idle', 0);
    const cam = new THREE.PerspectiveCamera(28, W / H, 1, 5000), h = Math.max(rig.h, (rig.len || 0) * .7) + 8;
    const d = h * .6 / Math.tan(THREE.MathUtils.degToRad(14)) / (W / H < .8 ? (W / H) / .8 : 1);
    cam.position.set(0, h * .5 + d * .2, d); cam.lookAt(0, Math.min(h, rig.h + 8) * .47, 0);
    shotR.render(sc, cam); const src = shotR.domElement.toDataURL('image/png');
    sc.remove(rig.root); K.dispose(rig);
    clearTimeout(shotIdle); shotIdle = setTimeout(() => { if (shotR) { shotR.dispose(); try { shotR.forceContextLoss(); } catch (e) {} shotR = null; } }, 20000);
    return src;
  }));
}
/* the GM's fight setup (step 4): every NPC in the fight with its figure. A card NPC uses the figure saved on its card;
   a one-off or an enemy built earlier has no card, so it gets a random look for this fight, which can be rolled again
   or changed in the maker. */
const RAND = new Set();
N.figRand = id => {
  const cb = N.G.combat, t0 = (cb.tokens || []).find(x => x.id === id); if (!t0) return;
  RAND.add(id); if (N.renderAll) N.renderAll();
  kitLoad().then(({K}) => { const t = (N.G.combat.tokens || []).find(x => x.id === id); if (!t) return;
    const n = N.G.npcs.find(x => x.id === t.ref); t.fig = K.randomSpec(t.fig ? t.fig.beast || t.fig.race : (n && n.race) || 'Human'); t.figAt = Date.now(); if (N.syncNow) N.syncNow(); })
    .catch(() => {}).then(() => { RAND.delete(id); if (N.renderAll) N.renderAll(); });
};
N.figRows = v => {
  if (!N.figOk() || !v || v.role !== 'gm') return '';
  const g = N.G, toks = (g.combat.tokens || []).filter(t => t.kind === 'npc'); if (!toks.length) return '';
  const IC = N.IC || (() => '');
  const pic = f => { const src = f && N.figPic(f); return `<span class="figpic" aria-hidden="true">${src ? `<img src="${src}" alt="">` : f ? '<i class="wait"></i>' : '<i></i>'}</span>`; };
  const rows = toks.map(t => {
    const card = g.npcs.find(n => n.id === t.ref), f = card ? card.fig : t.fig, busy = RAND.has(t.id);
    const sub = card ? (f ? 'Figure from the card' : 'No figure on the card yet') : busy ? 'Making a look…' : f ? 'Random look · this fight only' : 'No card, so no figure yet';
    const btns = card ? `<span class="figbtns"><button type="button" class="btn sm" data-a="figOpen" data-v="npc:${esc(card.id)}" style="--h:30px">${IC('hero')}${f ? 'Change' : 'Make figure'}</button></span>`
      : `<span class="figbtns"><button type="button" class="btn sm" data-a="figRand" data-v="${esc(t.id)}" style="--h:30px"${busy ? ' disabled' : ''}>${IC('sparkle')}${f ? 'Another look' : 'Random look'}</button>${f ? `<button type="button" class="btn sm ghost" data-a="figOpen" data-v="tok:${esc(t.id)}" style="--h:30px">Change</button>` : ''}</span>`;
    return `<div class="zi figrow">${pic(f)}<span>${esc(t.name)}<small style="font-style:normal;font-family:var(--f-ui)">${esc(sub)}</small></span>${btns}</div>`;
  }).join('');
  return `<div class="figrows"><small class="foe-sc">${IC('hero')}Figures</small><div class="zlist">${rows}</div><small>Each fighter stands on the board as their figure. A card NPC’s figure is made from its card.</small></div>`;
};

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

  const ANIM_NAMES = [['idle', 'Stand'], ['walk', 'Walk'], ['sword', 'Attack'], ['bow', 'Shoot'], ['magic', 'Magic'], ['hit', 'Hit'], ['block', 'Block'], ['dodge', 'Dodge'], ['down', 'Knocked down']];
  let spec = null, rig = null, all = [], view = 'one', tab = 'body', anim = 'idle', wpn = '', t0 = performance.now(), spin = .35, frozen = null, running = true;
  /* whose figure this is (targetOf); with none (the GM from Profile) there is nothing to save */
  const T = openT, mine = () => T ? T.get() : null, who = mine(), cname = T ? T.name : '', pc = T && T.kind === 'pc';
  const DRAFT = 'norne-fig-test', copy = s => JSON.parse(JSON.stringify(s));
  const fix = s => { if (!K.okSpec(s)) return null; const o = K.faceFix(copy(s)); o.hair = K.hairId(o.hair || 'bald'); return o; };
  const canon = s => s ? JSON.stringify(Object.keys(s).sort().map(k => [k, s[k]])) : '';
  const race0 = K.RACE_LIST.find(r => r.toLowerCase() === String(T && T.race || '').trim().toLowerCase()) || 'Human';
  /* only a player's own figure keeps a draft on the device; NPCs and fighters start from what is saved on them */
  let draft = null; try { draft = pc || !T ? JSON.parse(localStorage.getItem(DRAFT) || 'null') : null; } catch (e) {}
  if (draft && draft.race) draft = {spec:draft, char:null, base:0}; /* a look kept before figures could be saved */
  if (who && who.fig) spec = fix(pc && draft && draft.char === who.id && draft.base === (who.figAt || 0) ? draft.spec : who.fig) || fix(who.fig);
  else if (draft && (!draft.char || (who && draft.char === who.id))) spec = fix(draft.spec);
  const notGm = !(openV && openV.role === 'gm'), beast0 = notGm ? null : K.beastOf(T && T.race);
  if (spec && spec.beast && notGm) spec = null;
  if (!spec) spec = beast0 ? K.beastSpec(beast0) : K.defaultSpec(race0, 'm');
  const saveDraft = () => { if (T && !pc) return; try { const c = mine(); localStorage.setItem(DRAFT, JSON.stringify({spec, char:c ? c.id : null, base:c && c.figAt || 0})); } catch (e) {} };
  const savedNow = () => { const c = mine(); return c && c.fig ? fix(c.fig) : null; };
  const dirty = () => canon(spec) !== canon(savedNow());
  const TICK = '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M3 8.5l3.2 3.2L13 4.8" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg>';
  const n = esc(cname), tagText = T ? `${cname}’s figure` : 'Your figure';
  $('tag').textContent = tagText;
  $('lede').innerHTML = '<b>Build a figure from parts.</b> Pick a race, body, head, hair and outfit, then try the moves under the picture. Drag the figure to turn it. '
    + (!who ? 'Only a character, an NPC card or a fighter can keep a figure, so nothing you make here is saved.'
      : T.kind === 'npc' ? `Press <b>Save figure</b> to put it on ${n}’s card. It stays until you save a new one, and ${n} stands as it on the board in every fight.`
      : T.kind === 'tok' ? `Press <b>Save figure</b> to use it for ${n} in this fight only.`
      : `Press <b>Save figure</b> to make it ${n}’s figure for fights. It stays theirs until you save a new one, and ${n} stands as it on the fight board.`);
  /* the Save button in the top bar and the line under the moves say whether this is the saved figure */
  function mark(){
    const c = mine(), b = $('save'), line = $('saved'), d = c && dirty();
    b.hidden = !c; if (!c) { line.hidden = true; return; }
    b.classList.toggle('done', !d); b.innerHTML = d ? 'Save figure' : TICK + 'Saved';
    b.setAttribute('aria-label', d ? `Save as ${cname}’s figure` : `Saved as ${cname}’s figure`);
    line.classList.toggle('dirty', !!d);
    line.innerHTML = d ? `<i></i><span><b>Not saved yet.</b> ${c.fig ? `${n} still has the figure saved before.` : `${n} has no figure yet.`}</span>${c.fig ? '<button type="button" data-r="undo">Back to the saved figure</button>' : ''}`
      : `<i></i><span><b>${n}’s figure is saved.</b> ${T.kind === 'tok' ? 'It is used in this fight.' : 'It stays until you save a new one.'}</span>`;
  }
  function keep(){
    const c = mine(); if (!c) return false;
    c.fig = copy(spec); c.figAt = Date.now(); saveDraft(); mark();
    toast(`Saved as ${cname}’s figure`); if (N.syncNow) N.syncNow(); if (!pc && N.renderAll) N.renderAll(); return true;
  }
  $('save').addEventListener('click', () => { if (dirty()) keep(); else toast(`This is already ${cname}’s saved figure`); });
  $('saved').addEventListener('click', e => { if (e.target.closest('[data-r="undo"]')) { const s = savedNow(); if (s) { spec = s; rebuild(); opts(); toast('Back to the saved figure'); } } });
  let afterAsk = null;
  const ask = $('ask'), askDone = () => { ask.hidden = true; afterAsk = null; };
  box.ask = go => { if (!mine() || !dirty()) return false; afterAsk = go; ask.hidden = false; $('askSave').focus({preventScroll:true}); return true; };
  $('askSave').addEventListener('click', () => { const go = afterAsk; askDone(); keep(); if (go) go(); });
  $('askDrop').addEventListener('click', () => { const go = afterAsk; askDone(); if (pc) try { localStorage.removeItem(DRAFT); } catch (e) {} if (go) go(); });
  $('askKeep').addEventListener('click', askDone);

  /* the hairstyle's model loads first (once per style); the figure on show stays until the new one is ready */
  let want = 0, ready = Promise.resolve(), toastT = 0;
  const toast = msg => { $('toast').textContent = msg; clearTimeout(toastT); toastT = setTimeout(() => { $('toast').textContent = ''; }, 2600); };
  function rebuild(){
    const my = ++want; saveDraft(); mark();
    return ready = K.loadHair(spec.hair).catch(() => { toast('That hairstyle could not load. Check the connection and pick it again.'); }).then(() => {
      if (my !== want || !running) return;
      if (rig) { scene.remove(rig.root); K.dispose(rig); }
      rig = K.buildFigure(spec, {fine:true}); K.addFx(scene, rig); scene.add(rig.root);
      K.hold(rig, wpn ? {w:wpn} : null); $('wpnRow').hidden = !!spec.beast;
      rig.root.visible = view === 'one';
      frame();
    });
  }
  /* every race's default look, or every animal and monster */
  let allKind = '';
  function buildAll(kind){
    const specs = kind === 'beasts' ? K.BEAST_LIST.map(id => K.beastSpec(id)) : K.RACE_LIST.map((race, i) => K.defaultSpec(race, i % 2 ? 'f' : 'm'));
    allKind = kind;
    return Promise.all(specs.map(s => K.loadHair(s.hair).catch(() => null))).then(() => { if (!running || allKind !== kind) return;
      all.forEach(r => { scene.remove(r.root); K.dispose(r); }); all = [];
      specs.forEach(s => { const r = K.buildFigure(s); r.race = s.beast ? K.BEASTS[s.beast].n : s.race; all.push(r); scene.add(r.root); });
      layoutAll(); });
  }
  function layoutAll(){
    const W = stage.clientWidth, cols = W < 560 ? 4 : 8, gap = allKind === 'beasts' ? 72 : 62, rows = Math.ceil(all.length / cols);
    all.forEach((r, i) => { const c = i % cols, ro = Math.floor(i / cols);
      r.root.position.set((c - (cols - 1) / 2) * gap, 0, (ro - (rows - 1) / 2) * ZG); r.root.rotation.y = allKind === 'beasts' ? .75 : 0; r.root.visible = view !== 'one'; });
    labels.innerHTML = view !== 'one' ? all.map(r => `<span>${esc(r.race)}</span>`).join('') : '';
    frame();
  }
  function frame(){
    const W = stage.clientWidth, H = stage.clientHeight; if (!W || !H) return;
    renderer.setSize(W, H, false);
    camera.aspect = W / H;
    if (view === 'one') {
      const h = rig ? Math.max(rig.h, (rig.len || 0) * (rig.beast ? .9 : .62)) + 8 : 90, tan = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
      let d = (h * .62) / tan; if (camera.aspect < .8) d /= camera.aspect / .8;
      const hy = rig ? Math.min(h, rig.h + 8) : h; camera.position.set(0, hy * .5 + d * .22, d); camera.lookAt(0, hy * .44, 0);
    } else {
      const cols = W < 560 ? 4 : 8, rows = Math.ceil(all.length / cols), A = THREE.MathUtils.degToRad(22);
      const needW = cols * (allKind === 'beasts' ? 72 : 62) + 24, needH = (rows - 1) * ZG * Math.sin(A) + 118;
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
      all.forEach((r, i) => { if (!sp[i]) return; v3.set(r.root.position.x, 0, r.root.position.z + (allKind === 'beasts' ? 31 : 24)).project(ortho);
        sp[i].style.left = ((v3.x + 1) / 2 * W).toFixed(1) + 'px'; sp[i].style.top = ((1 - v3.y) / 2 * H + 2).toFixed(1) + 'px'; });
    }
    renderer.render(scene, view !== 'one' ? ortho : camera);
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
  const lenWords = () => K.HAIR_LEN[spec.hair] === 'Height' ? ['Low', 'Medium', 'Tall'] : ['Short', 'Medium', 'Long'];
  const lenStep = () => { const L = spec.len ?? .5; return L < .34 ? 0 : L < .67 ? 1 : 2; };
  /* the animal buttons show each beast's figure (made one at a time by N.figPic; the list redraws as they arrive) */
  let thumbT = 0;
  const beastPic = id => { const src = N.figPic(K.beastSpec(id)); if (!src && !thumbT) thumbT = setTimeout(() => { thumbT = 0; if (running && spec.beast) opts(); }, 500);
    return src ? `<img class="bthumb" alt="" src="${src}">` : '<i class="bthumb wait" aria-hidden="true"></i>'; };
  function opts(){
    const beast = !!spec.beast, r = beast ? null : R(), o = [];
    $('kind').querySelectorAll('[data-kind]').forEach(b => b.setAttribute('aria-pressed', String((b.dataset.kind === 'beast') === beast)));
    $('tabs').hidden = beast; $('racenote').hidden = beast;
    $('reset').textContent = beast ? 'Back to the first coat' : 'Back to the race default';
    const grp = (k, val, body, cls = 'grid') => o.push(`<div class="grp"><span class="k">${k}${val ? `<b>${esc(val)}</b>` : ''}</span><div class="${cls}">${body}</div></div>`);
    if (beast) {
      const B = K.BEASTS[spec.beast];
      grp('Animal or monster', B.n, K.BEAST_LIST.map(id => opt(id, K.BEASTS[id].n, id === spec.beast, 'beast', beastPic(id))).join(''), 'grid beasts');
      grp(spec.beast === 'giant' ? 'Kind of giant' : 'Coat, scales or shell', B.coats[spec.skin] ? B.coats[spec.skin].n : '', B.coats.map((c, i) => sw(i, c.n, c.c, i === +spec.skin, 'coat')).join(''), 'sws');
      o.push(spec.beast === 'dreadape' ? `<p class="note">The dreadape fights with its four fists only. <b>Sword</b> is one of five attacks (a leaping hammer blow, a haymaker and uppercut, a chest drum and four-fist ram, a spinning backfist, a four-fist flurry and an overhand); leave it playing to see them all. A fight picks one each attack. <b>Hit</b> and <b>Dodge</b> have two ways each, and <b>Bow</b> and <b>Magic</b> are a chest-drumming roar.</p>`
        : `<p class="note">Animals and monsters come as they are: pick one and its colours. In a fight, <b>Sword</b> is its bite, pounce or smash, and <b>Bow</b> and <b>Magic</b> are a roar or a breath from a distance.</p>`);
      $('opts').innerHTML = o.join('');
      return;
    }
    if (tab === 'body') {
      grp('Race', spec.race, K.RACE_LIST.map(x => opt(x, x, x === spec.race, 'race')).join(''));
      grp('Body shape', '', opt('f', 'Female', spec.body === 'f', 'body') + opt('m', 'Male', spec.body === 'm', 'body'));
      grp(spec.race === 'Human' ? 'People' : r.beast === 'bird' ? 'Feathers' : r.beast ? 'Skin, scales or fur' : 'Skin', r.skins[spec.skin].n, r.skins.map((s, i) => sw(i, s.n, s.c, i === +spec.skin, 'skin')).join(''), 'sws');
      if (spec.race === 'Human') o.push(`<p class="note">Picking a people also sets the hair and eye colour the lore gives them. You can still change both.</p>`);
    } else if (tab === 'head') {
      const ic = (over, mode) => `<img alt="" src="${K.faceIcon(spec, over, mode)}">`, nm = (list, v) => K.pick(list, v)[1], beast = r.beast;
      grp('Head size', nm(K.HEAD_SIZES, spec.headSize), K.HEAD_SIZES.map(([id, n]) => opt(id, n, id === spec.headSize, 'headSize')).join(''), 'grid steps');
      grp('Head shape', nm(K.HEAD_SHAPES, spec.headShape), K.HEAD_SHAPES.map(([id, n]) => opt(id, n, id === spec.headShape, 'headShape', ic({headShape:id}))).join(''), 'grid faces');
      if (beast) o.push(`<p class="note">${beast === 'bug' ? 'Bugfolk have big round eyes instead of a drawn face, so only the head\'s size and shape change.' : `${esc(spec.race)} keep their own snout or beak, so there is no jawline, nose or mouth to pick.`}</p>`);
      else grp('Jawline', nm(K.JAWS, spec.jaw), K.JAWS.map(([id, n]) => opt(id, n, id === spec.jaw, 'jaw', ic({jaw:id}))).join(''), 'grid faces');
      if (beast !== 'bug') {
        grp('Eyes', nm(K.EYE_SHAPES, spec.eyeShape), K.EYE_SHAPES.map(([id, n]) => opt(id, n, id === spec.eyeShape, 'eyeShape', ic({eyeShape:id, expr:'calm'}, 'eyes'))).join(''), 'grid faces');
        grp('Eye size', nm(K.EYE_SIZES, spec.eyeSize), K.EYE_SIZES.map(([id, n]) => opt(id, n, id === spec.eyeSize, 'eyeSize')).join(''), 'grid steps');
        grp('Eye colour', K.pick(K.EYES, spec.eyes)[1], K.EYES.map(([id, n, c]) => sw(id, n, c, id === spec.eyes, 'eyes')).join(''), 'sws');
        grp('Brows', nm(K.BROWS, spec.brows), K.BROWS.map(([id, n]) => opt(id, n, id === spec.brows, 'brows', ic({brows:id, expr:'calm'}, 'eyes'))).join(''), 'grid faces');
        if (!beast) {
          grp('Nose', nm(K.NOSES, spec.nose), K.NOSES.map(([id, n]) => opt(id, n, id === spec.nose, 'nose')).join(''), 'grid steps');
          grp('Mouth', nm(K.MOUTHS, spec.mouth), K.MOUTHS.map(([id, n]) => opt(id, n, id === spec.mouth, 'mouth', ic({mouth:id, expr:'smile'}, 'mouth'))).join(''), 'grid faces');
        }
        grp('Expression', nm(K.EXPRS, spec.expr), K.EXPRS.map(([id, n]) => opt(id, n, id === spec.expr, 'expr', ic({expr:id}, 'expr'))).join(''), 'grid faces');
        if (!beast) grp('Marks', (spec.marks || []).length ? '' : 'None', K.MARKS.map(([id, n]) => opt(id, n, (spec.marks || []).includes(id), 'mark')).join(''));
      }
    } else if (tab === 'hair') {
      if (r.nohair || r.nohairStyle) o.push(`<p class="note">${spec.race === 'Gorgon' ? 'Gorgons have serpent locks instead of hair (from the lore). Pick the snakes\' colour below.' : `${esc(spec.race)} have no hair, so only the colour below changes.`}</p>`);
      else {
        grp('Hairstyle', spec.hair === 'bald' ? 'Bald' : 'Hairstyle ' + K.pick(K.HAIRS, spec.hair)[1],
          K.HAIRS.map(([id, n], i) => opt(id, n, id === spec.hair, 'hair', `<i class="hthumb" style="--i:${i}" aria-hidden="true"></i>`)).join(''), 'grid hairs');
        const lw = K.HAIR_LEN[spec.hair];
        if (lw) grp(lw, lenWords()[lenStep()], lenWords().map((w, i) => opt(String(i / 2), w, i === lenStep(), 'len')).join(''), 'grid steps');
      }
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
    if (k === 'beast') spec = K.beastSpec(val);
    else if (k === 'coat') spec = K.beastSpec(spec.beast, +val);
    else if (k === 'race') spec = K.defaultSpec(val, spec.body || 'm');
    else if (k === 'body') { spec.body = val; if (val === 'f') spec.beard = 'none'; }
    else if (k === 'skin') { spec.skin = +val; const p = R().skins[+val]; if (p.eye) spec.eyes = p.eye; if (p.hair) spec.hairCol = p.hair; }
    else if (k === 'outfit') { spec.outfit = val; spec.cloth = K.pick(K.OUTFITS, val)[2].cloth; delete spec.hood; }
    else if (k === 'len') spec.len = +val;
    else if (k === 'mark') { const m = new Set(spec.marks || []); m.has(val) ? m.delete(val) : m.add(val); spec.marks = K.MARKS.map(x => x[0]).filter(x => m.has(x)); }
    else spec[k] = val;
    rebuild(); opts();
  });
  /* person or animal: switching back to a person starts from the race the figure is for */
  let lastPerson = spec.beast ? null : spec, lastBeast = spec.beast ? spec : null;
  $('kind').addEventListener('click', e => { const b = e.target.closest('[data-kind]'); if (!b) return; const want = b.dataset.kind === 'beast'; if (want === !!spec.beast) return;
    if (want) { lastPerson = spec; spec = lastBeast || K.beastSpec(beast0 || 'wolf'); } else { lastBeast = spec; spec = lastPerson || K.defaultSpec(race0, 'm'); tab = 'body'; }
    rebuild(); opts(); });
  $('tabs').addEventListener('click', e => { const b = e.target.closest('[data-t]'); if (!b) return; tab = b.dataset.t; opts(); });
  $('reset').addEventListener('click', () => { if (spec.beast) { spec = K.beastSpec(spec.beast); rebuild(); opts(); toast(`Back to the first ${K.BEASTS[spec.beast].n.toLowerCase()} coat`); return; }
    spec = K.defaultSpec(spec.race, spec.body); rebuild(); opts(); toast(`Back to the ${spec.race} default`); });
  const animBar = $('anims');
  animBar.innerHTML = ANIM_NAMES.map(([id, n]) => `<button type="button" class="chip" data-a="${id}" aria-pressed="${id === anim}">${n}</button>`).join('');
  const markAnim = () => animBar.querySelectorAll('.chip').forEach(c => c.setAttribute('aria-pressed', String(c.dataset.a === anim)));
  animBar.addEventListener('click', e => { const b = e.target.closest('[data-a]'); if (!b) return; anim = b.dataset.a; t0 = performance.now(); frozen = null; markAnim(); });
  /* try a weapon: only a look at how the figure uses each kind. In a fight the weapon comes from the fighter's gear. */
  const wpnSel = $('wpn');
  wpnSel.innerHTML = '<option value="">Plain sword and bow</option>' + K.WEAPON_LIST.filter(id => id !== 'sword').map(id => `<option value="${id}">${K.WEAPONS[id].n}</option>`).join('');
  wpnSel.addEventListener('change', () => { wpn = wpnSel.value; if (rig) K.hold(rig, wpn ? {w:wpn} : null);
    if (wpn) anim = K.WEAPONS[wpn].cat === 'melee' ? 'sword' : 'bow'; t0 = performance.now(); frozen = null; markAnim(); });
  $('views').addEventListener('click', e => { const b = e.target.closest('[data-v]'); if (b) setView(b.dataset.v); });
  function setView(w){
    view = w;
    $('views').querySelectorAll('.chip').forEach(c => c.setAttribute('aria-pressed', String(c.dataset.v === w)));
    const many = w !== 'one'; stage.classList.toggle('all', many);
    $('tag').textContent = w === 'all' ? 'Every race, default look' : w === 'beasts' ? 'Every animal and monster' : tagText; $('spin').hidden = many;
    if (many && allKind !== w) { all.forEach(r => { scene.remove(r.root); K.dispose(r); }); all = []; labels.innerHTML = ''; buildAll(w); }
    if (rig) rig.root.visible = !many; all.forEach(r => { r.root.visible = many; });
    requestAnimationFrame(() => { layoutAll(); frame(); });
  }
  const bar = box.querySelector('.fx-bar'), barH = () => box.style.setProperty('--barh', bar.offsetHeight + 'px');
  const ro = new ResizeObserver(() => { barH(); if (view !== 'one') layoutAll(); else frame(); }); ro.observe(stage); ro.observe(bar); barH();
  rebuild(); opts(); requestAnimationFrame(tick);
  /* test hook for screenshots: set a look, freeze a move */
  N.figTest = {dirty, set(s, o){ spec = s.beast ? K.beastSpec(s.beast, s.skin || 0) : Object.assign(K.defaultSpec(s.race || spec.race, s.body || spec.body || 'm'), s); const p = rebuild(); if (o && o.tab) tab = o.tab; opts(); return p; }, ready:() => ready,
    pose(a, ms, sp){ anim = a; frozen = ms; if (sp != null) spin = sp; markAnim(); }, view:setView};
  return () => {
    running = false; ro.disconnect(); N.figTest = null;
    if (rig) { scene.remove(rig.root); K.dispose(rig); rig = null; }
    all.forEach(r => { scene.remove(r.root); K.dispose(r); }); all = [];
    renderer.dispose(); try { renderer.forceContextLoss(); } catch (e) {}
  };
}
})();
