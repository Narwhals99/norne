/* Norne: AI-made 3D models that stand in for a toy figure (Jack, 2026-11-20: "maker look -> AI model").
   How one is made: the character is designed in the figure maker, ChatGPT draws an A-pose picture of it, Tripo turns that
   into a model, and a Blender script (tools/aimodel/) cleans it up, cuts it down to about 14k triangles with a 1024px
   texture so phones load it fast, gives it a skeleton and the moves below, and writes models/<id>.glb.
   Which figure uses one: a saved figure (c.fig, n.fig, t.fig) with model:'<id>' from MODELS, or the character a model
   was made for (its `who`: that character stands as it without picking anything, and only they are offered it;
   model:'none' on their figure turns it off). The figure maker still makes
   and saves the rest of the look, and that look is what shows wherever the model can't (it hasn't loaded, or failed to).
   The moves in every model: idle, walk, attack (the blow lands 0.72 s in), hit (struck at 0.2 s) and down (struck at
   0.2 s, lying still from about 1.1 s). The fight board's other moves are made from those (see animate).
   Only loaded when a figure with a model is about to be drawn: three.js's glTF loader (vendor/three-addons/) comes
   with the first one. Each model file loads once; every fighter using it gets its own copy of the skeleton. */
export const MODELS = [
  {id:'caelis', n:'Caelis', file:'models/caelis.glb', who:'Caelis Rethvael'},
];
const BY = new Map(MODELS.map(m => [m.id, m]));
export const isModel = id => BY.has(id);
/* the model made for a character, by its full name or the first word of it ("Caelis Rethvael", "Caelis"), or null */
const norm = s => String(s || '').trim().toLowerCase().replace(/\s+/g, ' ');
export const modelFor = (...names) => { const ns = names.map(norm).filter(Boolean);
  const m = MODELS.find(m => m.who && ns.some(n => n === norm(m.who) || n === norm(m.who).split(' ')[0])); return m ? m.id : null; };

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
    /* the hands hold weapons (js/armory.js) in toy-figure units: a holder undoes the model's scale, and tips the
       weapon forward of square to the forearm, the way a gripped sword sits */
    const holder = b => { const g = new THREE.Group(); if (b) { b.add(g); g.scale.setScalar(1 / s); g.position.y = .45; g.rotation.x = -.6; } return g; };
    rig.armR = {hand:holder(bone("hand.R"))}; rig.armL = {hand:holder(bone("hand.L"))};
    rig.w.sword = H.sword(); rig.w.sword.rotation.x = Math.PI / 2; rig.w.sword.visible = false; rig.armR.hand.add(rig.w.sword);
    rig.mixer = new THREE.AnimationMixer(body);
    rig.acts = {}; for (const k in L.clips) { const a = rig.mixer.clipAction(L.clips[k]); a.play(); a.enabled = false; rig.acts[k] = a; }
    if (opt.scale) root.scale.setScalar(opt.scale);
    return rig;
  }
  /* the board's moves from the model's five: list of [clip, seconds into it, weight] */
  function mixOf(rig, name, t){
    const dur = k => rig.acts[k] ? rig.acts[k].getClip().duration : 1, cap = (k, x) => Math.max(0, Math.min(dur(k) - 1e-4, x));
    const loop = (k, x) => ((x % dur(k)) + dur(k)) % dur(k);
    if (name === 'walk') return [['walk', loop('walk', t / 1000), 1]];
    /* the blow lands at 0.72 s in the model; the board's sword lands at 720 ms, the bow lets go at 1050, magic at 960 */
    if (name === 'sword' || name === 'bow' || name === 'magic') { const at = {sword:720, bow:1050, magic:960}[name], x = t < at ? t * 720 / at : t - at + 720; return [['attack', cap('attack', x / 1000), 1]]; }
    if (name === 'hit') return [['hit', cap('hit', t / 1000), 1]];
    /* a block or a dodge is half a flinch */
    if (name === 'block' || name === 'dodge') return [['idle', 0, .5], ['hit', cap('hit', t / 1000), .5]];
    /* knocked down; past 1900 ms it gets back up (the board plays 1900..2600 when someone is put back in) */
    if (name === 'down') { if (t <= 1900) return [['down', cap('down', t / 1000), 1]]; const u = Math.min(1, (t - 1900) / 700); return [['down', cap('down', (1 - u) * 1.5), 1]]; }
    return [['idle', loop('idle', t / 1000), 1]];
  }
  function animate(rig, name, t){
    for (const k in rig.acts) rig.acts[k].enabled = false;
    for (const [k, x, wt] of mixOf(rig, name, t)) { const a = rig.acts[k]; if (!a) continue; a.enabled = true; a.setEffectiveWeight(wt); a.time = x; }
    rig.mixer.update(0);
    /* the plain sword shows in the attack unless the fighter holds a weapon of their own (js/armory.js) */
    const atk = name === 'sword' || name === 'bow' || name === 'magic';
    for (const k in rig.w) rig.w[k].visible = false;
    if (atk) { const h = rig.held; if (h) { h.m.visible = true; if (h.l) h.l.visible = true; } else rig.w.sword.visible = true; }
  }
  function dispose(rig){
    rig.mixer.stopAllAction(); rig.mixer.uncacheRoot(rig.body);
    rig.mats.forEach(m => m.dispose());
    /* the weapons and the base are the fighter's own; the model's shapes and picture are shared by every copy */
    rig.root.traverse(o => { if (o.isSkinnedMesh || !o.geometry) return; o.geometry.dispose(); (Array.isArray(o.material) ? o.material : [o.material]).forEach(m => m && !rig.mats.includes(m) && m !== H.INK && m.dispose()); });
  }
  return {load, ready, build, animate, pose:animate, dispose, MODELS};
}
