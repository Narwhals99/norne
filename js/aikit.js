/* Norne: AI-made 3D models that stand in for a toy figure (Jack, 2026-11-20: "maker look -> AI model").
   How one is made: the character is designed in the figure maker, ChatGPT draws an A-pose picture of it, Tripo turns that
   into a model, and a Blender script (tools/aimodel/) cleans it up, cuts it down to about 14k triangles with a 1024px
   texture so phones load it fast, gives it a skeleton and the moves below, and writes models/<id>.glb.
   Which figure uses one: a saved figure (c.fig, n.fig, t.fig) with model:'<id>' from MODELS, or the character a model
   was made for (its `who`: that character stands as it without picking anything, and only they are offered it;
   model:'none' on their figure turns it off). The figure maker still makes
   and saves the rest of the look, and that look is what shows wherever the model can't (it hasn't loaded, or failed to).
   The moves in every model (tools/aimodel/rig.py writes them, the same for each): idle, walk, hit, down, block and
   dodge; a move for each way the toy figures use a weapon (chop, cut, poke, slam, sweep, thrust, jabs, hook, twin,
   flurry, scissor: the blow lands 0.72 s in; bow, xbow, sling, throw: let go at 1.05 s) and cast for magic (0.96 s).
   moveOf picks the one for the weapon in hand, as js/armory.js does for a toy figure.
   Only loaded when a figure with a model is about to be drawn: three.js's glTF loader (vendor/three-addons/) comes
   with the first one. Each model file loads once; every fighter using it gets its own copy of the skeleton. */
export const MODELS = [
  {id:'caelis', n:'Caelis', file:'models/caelis.glb', who:'Caelis Rethvael'},
  {id:'xira', n:'Xira', file:'models/xira.glb', who:'Xira'},
];
const BY = new Map(MODELS.map(m => [m.id, m]));
export const isModel = id => BY.has(id);
/* the model made for a character, or null: the names match, or their first words do ("Caelis Rethvael", "Caelis") */
const norm = s => String(s || '').trim().toLowerCase().replace(/\s+/g, ' ');
export const modelFor = (...names) => { const ns = names.map(norm).filter(Boolean);
  const m = MODELS.find(m => m.who && ns.some(n => n === norm(m.who) || n.split(' ')[0] === norm(m.who).split(' ')[0])); return m ? m.id : null; };

export function makeAI(THREE, H){
  const loads = new Map(), done = new Map();
  let libs = null;
  /* model files are found from this file's place, so pages in other folders (tools/aimodel/preview.html) find them too */
  const url = f => new URL('../' + f, import.meta.url).href;
  /* the model file, once; resolves to null for an id that isn't in MODELS */
  function load(id){
    const m = BY.get(id); if (!m) return Promise.resolve(null);
    if (loads.has(id)) return loads.get(id);
    libs = libs || Promise.all([import('../vendor/three-addons/GLTFLoader.js'), import('../vendor/three-addons/SkeletonUtils.js')]).catch(e => { libs = null; throw e; });
    const p = libs.then(([G, S]) => new Promise((ok, no) => new G.GLTFLoader().load(url(m.file), ok, undefined, no)).then(g => {
      g.scene.updateMatrixWorld(true);
      const box = new THREE.Box3().setFromObject(g.scene, true);
      g.scene.traverse(o => { if (o.isMesh) { const old = o.material;
        /* a matte paint like the toy figures, which also costs phones less than the file's PBR material */
        o.material = new THREE.MeshLambertMaterial({map:old.map || null}); if (o.material.map) o.material.map.colorSpace = THREE.SRGBColorSpace; old.dispose(); } });
      const clips = {}; g.animations.forEach(c => { clips[c.name] = c; });
      done.set(id, {m, scene:g.scene, clips, S, h:box.max.y - box.min.y, y0:box.min.y});
      return done.get(id);
    })).catch(e => { loads.delete(id); throw e; });
    loads.set(id, p);
    return p;
  }
  const ready = id => done.has(id);

  /* a figure: the same base and rings as a toy figure, the model standing on it at the height the race's figure would be */
  function build(spec, opt = {}){
    const L = done.get(spec.model);
    const root = new THREE.Group(), mats = [], rig = {root, spec, mats, fx:{}, ai:true, w:{}};
    if (opt.base !== false) H.addBase(root, rig, opt);
    const body = L.S.clone(L.scene), tall = H.figH(spec), s = tall / L.h;
    body.scale.setScalar(s); body.position.y = (opt.base !== false ? 6 : 0) - L.y0 * s;
    body.traverse(o => { if (o.isMesh) { o.material = o.material.clone(); o.material.userData.base = o.material.color.clone(); mats.push(o.material); o.frustumCulled = false; } });
    root.add(body);
    rig.body = body; rig.h = body.position.y + L.y0 * s + tall; rig.k = s;
    rig.joints = []; body.traverse(o => { if (o.isBone) rig.joints.push(o); });
    const bone = n => rig.joints.find(b => b.name === n || b.name === n.replace('.', ''));
    /* the hands hold weapons (js/armory.js) in toy-figure units, on the model's grip bones: a holder undoes the
       model's scale. A weapon's length runs along the grip, and the model's moves say which way each grip points. */
    const holder = b => { const g = new THREE.Group(); if (b) { b.add(g); g.scale.setScalar(1 / s); } return g; };
    rig.armR = {hand:holder(bone('grip.R') || bone('hand.R'))}; rig.armL = {hand:holder(bone('grip.L') || bone('hand.L'))};
    /* the plain sword, bow and staff, for a fighter with no weapon of their own */
    rig.w.sword = H.sword(); rig.armR.hand.add(rig.w.sword);
    rig.w.bow = H.bow(); rig.w.bow.rotation.y = -Math.PI / 2; rig.armL.hand.add(rig.w.bow);
    rig.w.staff = H.staff(); rig.armR.hand.add(rig.w.staff);
    for (const k in rig.w) rig.w[k].visible = false;
    rig.mixer = new THREE.AnimationMixer(body);
    rig.acts = {}; for (const k in L.clips) { const a = rig.mixer.clipAction(L.clips[k]); a.play(); a.enabled = false; rig.acts[k] = a; }
    if (opt.scale) root.scale.setScalar(opt.scale);
    return rig;
  }
  /* which of the model's moves plays for each of the toy figures' weapon moves (js/armory.js MOVES) */
  const MOVE = {chop:'chop', bash:'chop', cut:'cut', poke:'poke', slam:'slam', sweep:'sweep', thrust:'thrust', jabs:'jabs', hook:'hook',
    twin:'twin', flurry:'flurry', scissor:'scissor', bow:'bow', xbow:'xbow', sling:'sling', throw:'throw', flick:'throw', hurl:'throw'};
  /* what the board asks for -> {clip, seconds into it, the weapons to show}. An attack is acted with the weapon in hand,
     like the toy figures: its moves in turn (rig.var picks one on the fight board, so every device shows the same),
     or the plain sword, bow or staff with none. */
  function moveOf(rig, name, t){
    const has = k => !!rig.acts[k], dur = k => rig.acts[k].getClip().duration, cap = (k, x) => Math.max(0, Math.min(dur(k) - 1e-4, x));
    const loop = (k, x) => ((x % dur(k)) + dur(k)) % dur(k), one = (k, show) => ({clip:k, at:cap(k, (t % (H.ANIMS[name] || 1e9)) / 1000), show:show || []});
    if (name === 'walk') return {clip:'walk', at:loop('walk', t / 1000), show:[]};
    if (name === 'sword' || name === 'bow') {
      const h = rig.held, D = H.ANIMS[name], ms = t % D;
      if (h && (name === 'sword') === (h.def.cat === 'melee')) {
        const mv = h.two ? H.DUAL : h.def.moves, i = rig.var != null ? rig.var : Math.floor(t / D), k = MOVE[mv[i % mv.length]];
        /* something thrown has left the hand by 1050 ms */
        const gone = h.def.cat === 'thrown' && ms >= 1050;
        if (has(k)) return one(k, gone ? [] : [h.m, h.l].filter(Boolean));
      }
      return name === 'sword' ? one(has('chop') ? 'chop' : 'attack', [rig.w.sword]) : one(has('bow') ? 'bow' : 'attack', [rig.w.bow]);
    }
    if (name === 'magic') return one(has('cast') ? 'cast' : 'attack', [rig.w.staff]);
    if (name === 'hit') return one('hit');
    if ((name === 'block' || name === 'dodge') && has(name)) return one(name);
    /* knocked down; past 1900 ms it gets back up (the board plays 1900..2600 when someone is put back in) */
    if (name === 'down') { if (t <= 1900) return {clip:'down', at:cap('down', t / 1000), show:[]}; const u = Math.min(1, (t - 1900) / 700); return {clip:'down', at:cap('down', (1 - u) * 1.5), show:[]}; }
    return {clip:'idle', at:loop('idle', t / 1000), show:[]};
  }
  function animate(rig, name, t){
    const m = moveOf(rig, name, t);
    for (const k in rig.acts) rig.acts[k].enabled = false;
    const a = rig.acts[m.clip]; if (a) { a.enabled = true; a.setEffectiveWeight(1); a.time = m.at; }
    rig.mixer.update(0);
    for (const k in rig.w) rig.w[k].visible = false;
    for (const w of m.show) { w.visible = true;
      /* a weapon of the fighter's own was built for a toy figure's hand: stand it along the grip (a bow with its belly forward) */
      if (rig.held && (w === rig.held.m || w === rig.held.l)) w.rotation.set(0, rig.held.def.moves[0] === 'bow' ? -Math.PI / 2 : 0, 0); }
    /* the maker shows the arrow or the bolt flying off; on the fight board js/fx.js draws what flies */
    const fx = rig.fx, ms = t % (H.ANIMS[name] || 1e9); for (const k in fx) fx[k].visible = false;
    if (name === 'bow' && fx.arrow && ms > 1050 && ms < 1700 && (m.clip === 'bow' || m.clip === 'xbow')) { const k = (ms - 1050) / 650; fx.arrow.visible = true; fx.arrow.position.set(0, rig.h * .64, 18 + k * 160); fx.arrow.rotation.set(0, 0, 0); }
    if (name === 'magic' && fx.bolt && ms > 960 && ms < 1500) { const k = (ms - 960) / 540; fx.bolt.visible = true; fx.bolt.position.set(-4, rig.h * .8 - k * 16, 22 + k * 170); }
  }
  function dispose(rig){
    rig.mixer.stopAllAction(); rig.mixer.uncacheRoot(rig.body);
    rig.mats.forEach(m => m.dispose());
    /* the weapons and the base are the fighter's own; the model's shapes and picture are shared by every copy */
    rig.root.traverse(o => { if (o.isSkinnedMesh || !o.geometry) return; o.geometry.dispose(); (Array.isArray(o.material) ? o.material : [o.material]).forEach(m => m && !rig.mats.includes(m) && m !== H.INK && m.dispose()); });
  }
  return {load, ready, build, animate, pose:animate, dispose, MODELS};
}
