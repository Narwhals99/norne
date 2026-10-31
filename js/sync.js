/* Norne: sign-in and live sync with Firebase.
   Everything shared lives in Firestore. A document holds "units" (one character, one wiki entry, one map…)
   stored as JSON strings, so a change rewrites only the units that changed. The GM's device keeps the full
   copy in gm/* and writes a player-safe copy (no secrets, hidden maps, hidden entries or a fight being set up)
   to game/*. Players can only read game/*, their own chats and the pictures the GM has shared (firestore.rules).
   A fight started in a player's private chat goes to fights/<seat> instead of game/combat, so only that player sees it.
   Each chat can have its own fight at the same time: gm/combat keeps one unit per chat (table, dm-p1…). */
(function(){
const N = window.N, {esc, uid} = N;
const G = () => N.G;

const FB = {
  apiKey:'AIzaSyC-Cb6tsFEU16cwhDXwUkfM4ZJc3PSZheM',
  authDomain:'norne-93d1f.firebaseapp.com',
  projectId:'norne-93d1f',
  storageBucket:'norne-93d1f.firebasestorage.app',
  messagingSenderId:'356308704774',
  appId:'1:356308704774:web:69c28aeffc769cca482d87',
};
/* the GM's Google address; firestore.rules names the same one */
const GM_EMAIL = 'theusualsuspect41995@gmail.com'.toLowerCase();
const EMU = /[?&]emu=1\b/.test(location.search);
const isSeat = r => /^p\d+$/.test(r || '');
let F = null, db = null, auth = null, ME = null, started = false, live = false, V = null;
N.me = () => ME;
N.MEMBERS = [];
const isGM = () => G().role === 'gm';

/* ---------- the gate in front of the app (sign-in, waiting, loading) ---------- */
function gate(body){
  N.gated = body || null;
  if (V) N.render(V);
}
N.gateHtml = body => `<div class="stars" aria-hidden="true"></div><div class="gate" role="dialog" aria-modal="true" aria-labelledby="gateT">
  <div class="gcard"><div class="gmark">${N.MARK}</div><h1 id="gateT">N<small>ORNE</small></h1>${body}</div></div>`;
const outBtn = '<button type="button" class="btn ghost" data-a="signOut">Sign out</button>';
const signInGate = (err='') => gate(`<p>Sign in to join the table.</p><button type="button" class="btn gold lg" data-a="signIn">Sign in with Google</button>${err?`<p class="fine" role="alert">${esc(err)}</p>`:''}<p class="fine">New players wait here until the GM lets them in.</p>`);
function fail(err){
  console.error(err);
  const why = err?.code === 'permission-denied' ? 'The campaign’s database refused the request. If you set Norne up, check that the security rules are published.' : 'Something went wrong while opening the campaign. Check your connection and reload the page.';
  if (started) return syncErr(why);
  gate(`<p>${esc(why)}</p>${outBtn}`);
}
function syncErr(t){ if (V) N.toast(V, t); N.renderAll(); }

/* ---------- documents made of units ---------- */
const KNOWN = new Map(), LOADED = new Set();
const dref = path => F.doc(db, ...path.split('/'));
const track = pr => pr.catch(err => { console.error(err); syncErr(err?.code === 'permission-denied' ? 'A change wasn’t saved: you don’t have permission for it.' : 'A change wasn’t saved. Check your connection.'); });
/* write the units that differ from what the server last had; partial leaves other units alone */
function writeUnits(path, units, partial){
  if (!LOADED.has(path)) return;
  const k = KNOWN.get(path), ch = {}; let n = 0;
  for (const [key, v] of Object.entries(units)) { const j = JSON.stringify(v); if (k.units[key] !== j) { ch[key] = j; k.units[key] = j; n++; } }
  if (!partial) for (const key of Object.keys(k.units)) if (!(key in units)) { ch[key] = F.deleteField(); delete k.units[key]; n++; }
  if (n) track(F.setDoc(dref(path), ch, {merge:true}));
}
/* listen to a document; apply(units) runs only when it really changed.
   soft: a refusal (security rules not published yet) leaves it unloaded instead of stopping the app */
const DENIED = new Set();
function listenDoc(path, apply, soft){
  return new Promise(res => {
    F.onSnapshot(dref(path), snap => {
      const units = {}; for (const [key, j] of Object.entries(snap.data() || {})) if (typeof j === 'string') units[key] = j;
      const prev = KNOWN.get(path), same = prev && Object.keys(prev.units).length === Object.keys(units).length && Object.entries(units).every(([key, j]) => prev.units[key] === j);
      KNOWN.set(path, {units:{...units}});
      const first = !LOADED.has(path); LOADED.add(path);
      if (first || !same) { apply(units); if (!first) changed(); }
      res();
    }, err => { if (soft) { console.warn(path, err?.code); DENIED.add(path); res(); } else { fail(err); res(); } });
  });
}
const vals = u => Object.values(u).map(j => JSON.parse(j));
const byO = (a,b) => (a.o ?? 0) - (b.o ?? 0);
const asUnits = (arr, pub) => Object.fromEntries(arr.map((x,i) => [x.id, pub ? pub(x,i) : {...x, o:i}]).filter(e => e[1]));

/* ---------- messages: one document each, tagged with who may read them ---------- */
const MKNOWN = new Map(), MDOCS = new Map();
/* a group chat's messages are readable by its members (the GM reads everything) */
const audOf = ch => ch === 'table' ? ['*'] : ch === 'gm' ? ['gm'] : ch.startsWith('grp-') ? ((N.grpOf(ch)?.seats || []).length ? [...N.grpOf(ch).seats] : ['gm']) : [ch.slice(3)];
function syncMsgs(){
  if (!LOADED.has('msgs')) return;
  for (const m of G().msgs) {
    const j = JSON.stringify(m); if (MKNOWN.get(m.id) === j) continue;
    if (!isGM() && (m.ch === 'gm' || (m.by !== G().role && MKNOWN.has(m.id) && !m.roll))) continue;
    const fresh = !MKNOWN.has(m.id);
    /* reactions are written on their own (saveRx), so a message saved again never overwrites someone else's */
    MKNOWN.set(m.id, j); const {roll, rx, ...rest} = m;
    track(F.setDoc(dref('msgs/' + m.id), {...rest, ...(fresh && rx ? {rx} : {}), aud:audOf(m.ch), roll:roll ? JSON.stringify(roll) : null}, {merge:true})
      .then(() => { if (fresh && N.pushOut) try { N.pushOut(m); } catch(e) { console.warn('push', e); } }));
  }
}
function applyMsgDocs(ids, removed){
  const local = new Map(G().msgs.map(m => [m.id, m]));
  for (const id of removed) { local.delete(id); MKNOWN.delete(id); }
  for (const id of ids) {
    const d = MDOCS.get(id); if (!d) continue;
    const {aud, roll, ...m} = d; if (roll) m.roll = JSON.parse(roll);
    for (const k of Object.keys(m)) if (m[k] === null) delete m[k];
    const j = JSON.stringify(m), old = local.get(id);
    if (old && JSON.stringify(old) === j) { MKNOWN.set(id, j); continue; }
    local.set(id, m); MKNOWN.set(id, j);
  }
  G().msgs = [...local.values()].sort((a,b) => a.t - b.t || (a.id < b.id ? -1 : 1));
  N.invalidateScenes();
}
function listenMsgs(){
  const role = G().role;
  const qs = isGM() ? [F.collection(db, 'msgs')] : [F.query(F.collection(db, 'msgs'), F.where('aud', 'array-contains', '*')), F.query(F.collection(db, 'msgs'), F.where('aud', 'array-contains', role))];
  let waiting = qs.length;
  return new Promise(res => qs.forEach(q => F.onSnapshot(q, snap => {
    const ids = [], removed = [];
    const fresh = LOADED.has('msgs') ? snap.docChanges().filter(c => c.type === 'added' && !MKNOWN.has(c.doc.id)).map(c => c.doc.id) : [];
    snap.docChanges().forEach(c => { if (c.type === 'removed') { MDOCS.delete(c.doc.id); removed.push(c.doc.id); } else { MDOCS.set(c.doc.id, c.doc.data()); ids.push(c.doc.id); } });
    if (ids.length || removed.length) applyMsgDocs(ids, removed);
    if (fresh.length && N.notifyMsgs) N.notifyMsgs(fresh.map(id => G().msgs.find(m => m.id === id)).filter(Boolean));
    if (waiting > 0 && --waiting === 0) { LOADED.add('msgs'); res(); } else if (ids.length || removed.length) changed();
  }, err => { fail(err); res(); })));
}
/* each person's reactions on a message are their own field (rx.<seat>), so two people reacting at once both count */
N.saveRx = (m, who) => {
  if (!F || !MKNOWN.has(m.id)) return;
  MKNOWN.set(m.id, JSON.stringify(m));
  const l = (m.rx || {})[who];
  track(F.updateDoc(dref('msgs/' + m.id), new F.FieldPath('rx', who), l && l.length ? l : F.deleteField()));
};
/* only the GM can take a message back (an undone scene change) */
N.delMsg = id => {
  const g = G(), i = g.msgs.findIndex(m => m.id === id); if (i < 0) return;
  g.msgs.splice(i, 1); N.invalidateScenes();
  if (isGM() && MKNOWN.has(id)) { MKNOWN.delete(id); MDOCS.delete(id); track(F.deleteDoc(dref('msgs/' + id))); }
};

/* the GM wiping a whole chat: every message in it is deleted for good, in batches */
N.wipeChat = ch => {
  const g = G(), gone = g.msgs.filter(m => m.ch === ch); if (!gone.length) return 0;
  g.msgs = g.msgs.filter(m => m.ch !== ch); N.invalidateScenes();
  if (isGM() && F) {
    const ids = gone.map(m => m.id); ids.forEach(id => { MKNOWN.delete(id); MDOCS.delete(id); });
    for (let i = 0; i < ids.length; i += 400) { const b = F.writeBatch(db); ids.slice(i, i + 400).forEach(id => b.delete(dref('msgs/' + id))); track(b.commit()); }
  }
  return gone.length;
};

/* ---------- group chats: one document each (groups/<id>: name, seats). Players see only the groups they are in. ---------- */
let GROUPS_OK = false, GROUPS_DONE = false;
/* characters arrive from game/chars plus each party document this person can read */
const CH = {base:{}, party:{}};
function mergeChars(){
  const all = {...CH.base}; for (const u of Object.values(CH.party)) Object.assign(all, u);
  G().chars = Object.fromEntries(Object.entries(all).map(([k, j]) => [k, N.decorate(JSON.parse(j))]));
  nameSeats();
}
function listenParty(id){
  const path = 'parties/' + id;
  if (PARTY_ON.has(path)) return; PARTY_ON.add(path);
  listenDoc(path, u => { if (!G().groups.some(x => x.id === id && x.party)) return; CH.party[id] = u; mergeChars(); ensureChars(); }, true).then(() => { if (isGM()) queueSync(); });
}
const PARTY_ON = new Set();
/* the GM writes character cards only once it knows every party and has read every party's document,
   so a card is never written to the wrong place or made again from blank */
const charsReady = () => LOADED.has('game/chars') && GROUPS_DONE && G().groups.filter(x => x.party).every(x => LOADED.has('parties/' + x.id));
function listenGroups(){
  const role = G().role, q = isGM() ? F.collection(db, 'groups') : F.query(F.collection(db, 'groups'), F.where('seats', 'array-contains', role));
  return new Promise(res => F.onSnapshot(q, snap => {
    GROUPS_OK = GROUPS_DONE = true;
    G().groups = snap.docs.map(d => ({id:d.id, name:d.data().name || 'Group chat', seats:d.data().seats || [], t:d.data().t || 0, ...(d.data().party ? {party:true} : {})}));
    for (const gr of G().groups) { listenFight(gr.id); if (gr.party) listenParty(gr.id); }
    /* a party this person is no longer in takes its cards with it */
    let gone = false; for (const id of Object.keys(CH.party)) if (!G().groups.some(x => x.id === id && x.party)) { delete CH.party[id]; gone = true; }
    if (gone) mergeChars(); setCombat(); if (live) changed(); res();
  }, err => { console.warn('groups', err?.code); GROUPS_DONE = true; res(); }));
}
/* the rules that guard groups/<id> have to be published before the GM can make one */
N.groupsReady = () => GROUPS_OK;
/* the GM saves a group; members added or removed get (or lose) the chat's whole history */
N.saveGroup = (gr, before) => {
  if (!isGM()) return;
  const g = G(), i = g.groups.findIndex(x => x.id === gr.id); if (i < 0) g.groups.push(gr); else g.groups[i] = gr;
  track(F.setDoc(dref('groups/' + gr.id), {name:gr.name, seats:gr.seats, t:gr.t || Date.now(), party:!!gr.party}));
  if (gr.party) listenParty(gr.id);
  if (before && before.join() !== gr.seats.join()) for (const m of g.msgs) if (m.ch === 'grp-' + gr.id && MKNOWN.has(m.id)) track(F.updateDoc(dref('msgs/' + m.id), {aud:audOf(m.ch)}));
};
/* deleting a group deletes its messages and its fight document too */
N.dropGroup = id => {
  if (!isGM()) return;
  const g = G(); g.groups = g.groups.filter(x => x.id !== id);
  for (const m of [...g.msgs]) if (m.ch === 'grp-' + id) N.delMsg(m.id);
  /* a deleted party's cards go back to game/chars on the next save */
  const was = CH.party[id]; delete CH.party[id]; if (was) { KNOWN.delete('parties/' + id); LOADED.delete('parties/' + id); }
  track(F.deleteDoc(dref('groups/' + id))); track(F.deleteDoc(dref('fights/' + id))); track(F.deleteDoc(dref('parties/' + id)));
};

/* ---------- push addresses: one document per phone or computer that has notifications on ---------- */
N.PUSH = [];
N.pushSave = (dev, sub) => sub
  ? F.setDoc(dref('push/' + dev), {uid:ME.uid, role:G().role, sub:JSON.stringify(sub), t:Date.now()})
  : F.deleteDoc(dref('push/' + dev));
/* when this device last had Norne open on screen (0 once it goes to the background) */
N.pushSeen = (dev, at) => F.updateDoc(dref('push/' + dev), {seen:at});
/* addresses the push service says are dead (notifications turned off, app deleted) */
N.pushDrop = gone => { for (const d of N.PUSH) if (gone.includes(d.sub.endpoint)) F.deleteDoc(dref('push/' + d.id)).catch(() => {}); };
function listenPush(){
  F.onSnapshot(F.collection(db, 'push'), snap => {
    N.PUSH = snap.docs.map(d => { try { return {id:d.id, ...d.data(), sub:JSON.parse(d.data().sub)}; } catch(e) { return null; } }).filter(Boolean);
  }, err => console.warn('push', err?.code));
}

/* ---------- pictures kept in the database (maps, scene pictures, portraits) ---------- */
const MIMG = new Map(), MVIS = new Map();
/* a picture is either for everyone (vis), for some seats (aud) or for the GM only */
const visKey = (vis, aud) => (vis === true ? '*' : '') + '|' + (aud || []).join(',');
N.loadImg = id => {
  let e = MIMG.get(id);
  if (!e) {
    e = {url:'', p:null}; MIMG.set(id, e);
    if (F) e.p = F.getDoc(dref('mapimgs/' + id)).then(s => { const d = s.data(); if (!d || !d.data) throw new Error('no image'); e.url = d.data; MVIS.set(id, visKey(d.vis, d.aud)); N.renderAll(); })
      .catch(() => { setTimeout(() => MIMG.delete(id), 15000); });
  }
  return e.url;
};
/* a Firestore document holds at most 1 MB, so pictures are scaled down to fit */
N.shrink = (img, max, limit=900000) => {
  let w = img.naturalWidth, h = img.naturalHeight, k = Math.min(1, max / Math.max(w, h)), q = .85, out = '';
  for (let i = 0; i < 12; i++) {
    const c = document.createElement('canvas'); c.width = Math.round(w * k); c.height = Math.round(h * k);
    /* JPEG has no see-through parts, so they become white instead of black (flags, logos) */
    const x = c.getContext('2d'); x.fillStyle = '#fff'; x.fillRect(0, 0, c.width, c.height);
    x.drawImage(img, 0, 0, c.width, c.height); out = c.toDataURL('image/jpeg', q);
    if (out.length < limit) break;
    if (q > .6) q -= .1; else k *= .8;
  }
  return out;
};
/* custom emoji: the whole picture fitted in a small square, transparent edges kept */
N.shrinkEmoji = img => {
  const S = 96, c = document.createElement('canvas'), iw = img.naturalWidth || img.width, ih = img.naturalHeight || img.height; c.width = c.height = S;
  const k = S / Math.max(iw, ih), w = iw * k, h = ih * k;
  c.getContext('2d').drawImage(img, (S - w) / 2, (S - h) / 2, w, h);
  const png = c.toDataURL('image/png');
  return png.length < 24000 ? png : c.toDataURL('image/webp', .9).startsWith('data:image/webp') ? c.toDataURL('image/webp', .9) : png;
};
/* square crop for portraits */
N.shrinkFace = (img, S=256, q=.86) => {
  const s = Math.min(img.naturalWidth, img.naturalHeight), c = document.createElement('canvas'); c.width = c.height = S;
  c.getContext('2d').drawImage(img, (img.naturalWidth - s) / 2, (img.naturalHeight - s) / 2.6, s, s, 0, 0, S, S);
  return c.toDataURL('image/jpeg', q);
};
/* opens the file picker (call it from a click) and hands back a loaded image */
N.pickImage = cb => {
  const inp = document.createElement('input'); inp.type = 'file'; inp.accept = 'image/*';
  inp.onchange = () => { const f = inp.files?.[0]; if (!f) return; const rd = new FileReader();
    rd.onload = () => { const img = new Image(); img.onload = () => cb(img, f); img.onerror = () => V && N.toast(V, 'That file couldn’t be read as a picture.'); img.src = rd.result; };
    rd.readAsDataURL(f); };
  inp.click();
};
N.storeImg = (data, vis) => {
  const id = uid('img'); MIMG.set(id, {url:data, p:null}); MVIS.set(id, visKey(vis));
  track(F.setDoc(dref('mapimgs/' + id), {data, vis}));
  return 'fs:' + id;
};
/* a deleted map takes its picture with it */
N.dropImg = src => {
  src = N.picBase(src);
  if (!F || !src.startsWith('fs:')) return;
  const id = src.slice(3); MIMG.delete(id); MVIS.delete(id);
  track(F.deleteDoc(dref('mapimgs/' + id)));
};

/* ---------- what each person writes ---------- */
const pinOut = (m, p) => ({...p, x:Math.round((p.rx ?? 0) * m.w), y:Math.round((p.ry ?? 0) * m.h)});
function syncNow(){
  clearTimeout(_sq); if (!started) return;
  saveLocal();
  const g = G();
  if (isGM()) {
    /* characters of players in a party live in that party's document (parties/<id>), so other parties never receive them */
    if (charsReady()) {
      const inParty = new Set(g.groups.filter(x => x.party).flatMap(x => x.seats));
      writeUnits('game/chars', Object.fromEntries(Object.entries(g.chars).filter(([, c]) => !inParty.has(c.player))));
      for (const pt of g.groups.filter(x => x.party)) writeUnits('parties/' + pt.id, Object.fromEntries(Object.entries(g.chars).filter(([, c]) => pt.seats.includes(c.player))));
    }
    /* fights being set up and fights in private chats stay in gm/combat, one unit per chat */
    const all = N.allFights(), mine = Object.fromEntries(Object.entries(all).filter(([ch, cb]) => cb.state === 'setup' || (cb.state === 'live' && N.chKey(ch))));
    writeUnits('gm/combat', Object.fromEntries(Object.entries(mine).map(([ch, cb]) => [ch, combatOut(cb)])));
    /* what this device just wrote is the newest copy (its own writes don't come back as changes) */
    SC = mine;
    const tbl = all.table?.state === 'live' ? all.table : null;
    writeUnits('game/combat', {c:combatOut(tbl || N.freshCombat())}); GC = tbl;
    /* a fight in a private chat is written only to that player's own fights/<seat> document, a group chat's to fights/<group id> */
    for (const [st, ch] of [...N.seats().map(s => [s, 'dm-' + s]), ...g.groups.map(x => [x.id, 'grp-' + x.id])]) {
      const path = 'fights/' + st, f = all[ch]?.state === 'live' ? all[ch] : null;
      if (!LOADED.has(path)) { listenFight(st); continue; }
      writeUnits(path, {c:f ? combatOut(f) : null}); PF[st] = f;
    }
    for (const [ch, cb] of Object.entries(mine)) SRC[ch] = cb;
    if (tbl) SRC.table = tbl;
    /* things shared with only some players go to each of those players' own only/<seat> document */
    const only = Object.fromEntries(N.seats().map(st => [st, {}]));
    const share = (x, kind, key, pub) => { const a = N.audOf(x, kind); if (a === '*') return pub; if (a !== 'gm') for (const st of a) if (only[st]) only[st][key] = pub; return null; };
    if (LOADED.has('gm/maps')) {
      for (const m of g.maps) {
        if (!m.src?.startsWith('fs:')) continue;
        const id = m.src.slice(3), a = N.audOf(m, 'map'), vis = a === '*', aud = Array.isArray(a) ? a : [], k = visKey(vis, aud);
        if (MVIS.get(id) !== k) { MVIS.set(id, k); track(F.setDoc(dref('mapimgs/' + id), {vis, aud}, {merge:true})); }
      }
      writeUnits('gm/maps', asUnits(g.maps, (m,i) => ({...m, pins:m.pins.map(p => pinOut(m, p)), o:i})));
      writeUnits('game/maps', asUnits(g.maps, (m,i) => share(m, 'map', 'm:' + m.id, {...m, pins:m.pins.filter(p => p.vis || p.type === 'party').map(p => pinOut(m, p)), o:i})));
    }
    if (LOADED.has('gm/wiki')) {
      /* pictures in a wiki entry can be read by the same people as the entry */
      for (const e of g.wiki) for (const p of N.wikiPics(e)) {
        if (!p.src?.startsWith('fs:')) continue;
        const id = N.picBase(p.src).slice(3), a = N.audOf(e, 'wiki'), vis = a === '*', aud = Array.isArray(a) ? a : [], k = visKey(vis, aud);
        if (MVIS.get(id) !== k) { MVIS.set(id, k); track(F.setDoc(dref('mapimgs/' + id), {vis, aud}, {merge:true})); }
      }
      writeUnits('gm/wiki', asUnits(g.wiki));
      writeUnits('game/wiki', asUnits(g.wiki, (e,i) => { const {secret, ...pub} = e; return share(e, 'wiki', 'w:' + e.id, {...pub, o:i}); }));
    }
    writeUnits('gm/npcs', asUnits(g.npcs.map(n => ({...n, occ:n.job || ''}))));
    writeUnits('gm/misc', {npcs:g.quick, foes:g.foes, recent:g.recent, pics:g.pics});
    if (LOADED.has('gm/news')) {
      /* pictures in an issue can be read by the same people as the issue */
      for (const i of g.news.issues) for (const src of N.newsPics(i)) {
        if (!src.startsWith('fs:')) continue;
        const id = N.picBase(src).slice(3), a = N.audOf(i, 'news'), vis = a === '*', aud = Array.isArray(a) ? a : [], k = visKey(vis, aud);
        if (MVIS.get(id) !== k) { MVIS.set(id, k); track(F.setDoc(dref('mapimgs/' + id), {vis, aud}, {merge:true})); }
      }
      writeUnits('gm/news', Object.fromEntries(g.news.issues.map(i => [i.id, i])));
      writeUnits('game/news', Object.fromEntries(g.news.issues.map(i => [i.id, share(i, 'news', 'n:' + i.id, i)]).filter(e => e[1])));
    }
    /* wiki categories and the GIF search key; the server copy is read back into g first, so writing it all is safe */
    { const meta = {}; if (g.cats) meta.cats = g.cats; if (g.gifKey) meta.gif = g.gifKey; if (g.gmPic) meta.gmpic = g.gmPic; writeUnits('game/meta', meta); }
    writeUnits('game/emoji', asUnits(g.emoji));
    for (const [st, units] of Object.entries(only)) {
      const path = 'only/' + st;
      if (!LOADED.has(path)) { listenOnly(st); if (DENIED.has(path) && Object.keys(units).length && !RULES_WARNED) { RULES_WARNED = true; syncErr('To share things with single players, publish the new security rules: paste firestore.rules into Firebase > Firestore > Rules and press Publish, then reload.'); } continue; }
      writeUnits(path, units);
    }
  } else {
    const mine = g.P[g.role]?.char;
    const pt = N.partyOf(g.role);
    if (mine && g.chars[mine]) writeUnits(pt ? 'parties/' + pt.id : 'game/chars', {[mine]:g.chars[mine]}, true);
    for (const [ch, cb] of Object.entries(N.allFights())) if (cb.state === 'live') { const s = N.chKey(ch); writeUnits(s ? 'fights/' + s : 'game/combat', {c:combatOut(cb)}); }
  }
  syncMsgs();
}
let _sq = 0, RULES_WARNED = false;
/* the GM keeps each player's only/<seat> document in step */
function listenOnly(st){
  const path = 'only/' + st;
  if (ONLY_ON.has(path)) return; ONLY_ON.add(path);
  listenDoc(path, () => {}, true).then(() => { if (LOADED.has(path)) queueSync(); });
}
const ONLY_ON = new Set();
/* the GM follows every seat's private fight document, so a player's moves in a private fight come back */
function listenFight(st){
  const path = 'fights/' + st;
  if (FIGHT_ON.has(path)) return LOADED.has(path) ? null : FIGHT_ON.get(path);
  const p = listenDoc(path, u => { PF[st] = u.c ? JSON.parse(u.c) : null; setCombat(); }, true).then(() => { if (LOADED.has(path) && isGM()) queueSync(); });
  FIGHT_ON.set(path, p); return p;
}
const FIGHT_ON = new Map();
/* a private fight can't start until the rules that guard fights/<seat> are published */
N.fightBlocked = ch => { const s = N.chKey(ch); return !!s && isGM() && !LOADED.has('fights/' + s); };
const queueSync = () => { clearTimeout(_sq); _sq = setTimeout(syncNow, 250); };
N.syncNow = syncNow;

/* ---------- applying what arrives ---------- */
let GC = null, SC = {}; const PF = {}, SRC = {};
const OLDBG = {forest:'dark-forest', tavern:'town-alley', street:'town-alley', cave:'cave-temple-deep', castle:'castle-ramparts', swamp:'dark-forest', snow:'mountain-pass-raid', ship:'harbor-ship'};
/* Fights are also written in the old app's shape (bg key, scene, zone color), so rolling the site back keeps them working. */
const oldBg = src => ({'dark-forest':'forest', 'town-alley':'tavern', 'cave-temple-deep':'cave', 'castle-ramparts':'castle', 'mountain-pass-raid':'snow', 'harbor-ship':'ship'})[(String(src).match(/^art\/bg\/([\w-]+)\.jpg$/) || [])[1]] || 'forest';
const combatOut = c => ({...c, art:c.bg, bg:oldBg(c.bg), scene:c.aspects, zones:c.zones.map(z => ({...z, color:z.col})), tokens:c.tokens.map(npcTokOut)});
/* a named NPC's token carries a copy of its card's consequences, so players (who can't read NPC cards) see them in the fight */
const npcTokOut = t => { if (t.kind !== 'npc') return t; const n = t.type !== 'nameless' && G().npcs.find(x => x.id === t.ref); return {...t, ...(t.label == null ? {label:''} : {}), ...(n ? {cons:{...(n.cons || {})}} : {})}; };
function normCombat(c){
  if (!c) return N.freshCombat();
  const f = N.freshCombat(), legacy = !c.joined;
  c = Object.assign(f, c);
  if (c.art && oldBg(c.art) === c.bg) c.bg = c.art;
  delete c.art;
  /* the old app had no invite or join step: anyone with a token was already in */
  if (legacy) { const pcs = c.tokens.filter(t => t.kind === 'pc'); c.invited = pcs.map(t => t.ref); c.joined = pcs.map(t => G().chars[t.ref]?.player || t.ref.replace(/^pc/, 'p')); }
  if (Array.isArray(c.scene)) c.aspects = c.scene;
  delete c.scene;
  /* the old app named painted backdrops (forest, tavern…); map them onto the art library */
  if (!/^(fs:|art\/|img\/|data:|https?:)/.test(c.bg || '')) c.bg = OLDBG[c.bg] ? `art/bg/${OLDBG[c.bg]}.jpg` : N.FIGHTBG;
  const n = c.zones.length, cols = Math.min(3, Math.max(1, n)), rows = Math.ceil(n / cols) || 1;
  c.zones.forEach((z, i) => {
    z.col = z.color || z.col || N.ZCOL[i % N.ZCOL.length]; delete z.color;
    if (z.x == null) { const r = Math.floor(i / cols), k = i % cols; Object.assign(z, {x:3 + k * (94 / cols), y:8 + r * (86 / rows), w:94 / cols - 3, h:86 / rows - 6}); }
    if (z.aspect == null) z.aspect = '';
  });
  const same = {}; c.tokens.forEach(t => { if (t.kind === 'npc') same[t.name] = (same[t.name] || 0) + 1; });
  c.tokens.forEach(t => { if (t.kind === 'npc') { if (t.label && t.name && !/\d$/.test(t.name) && same[t.name] > 1) t.name = `${t.name} ${t.label.replace(/^\D+/, '')}`; if (!t.side) t.side = 'foe'; } });
  return c;
}
/* the fights this screen knows, one per chat: the one at the table (game/combat) and those in private chats
   (fights/<seat>). The GM keeps fights being set up and fights in private chats in gm/combat too, and takes the
   player's copy of a private fight when it is the same fight (it has their moves). A copy that hasn't changed
   since it last arrived keeps the fight on screen as it is. */
function setCombat(){
  const g = G(), src = {}, cur = N.allFights(), out = {};
  if (isGM()) {
    for (const [ch, x] of Object.entries(SC)) {
      if (!x?.id || !(x.state === 'setup' || (x.state === 'live' && N.chKey(ch)))) continue;
      const p = PF[N.chKey(ch)]; src[ch] = x.state === 'live' && p && p.id === x.id && p.state === 'live' ? p : x;
    }
    if (!src.table && GC?.state === 'live') src.table = GC;
    /* the GM's own fights stay until the GM ends them, even before they are saved */
    Object.assign(out, cur);
  } else {
    if (GC?.state === 'live') src.table = GC;
    if (PF[g.role]?.state === 'live') src['dm-' + g.role] = PF[g.role];
    for (const gr of g.groups || []) if (PF[gr.id]?.state === 'live') src['grp-' + gr.id] = PF[gr.id];
  }
  for (const [ch, c] of Object.entries(src)) out[ch] = SRC[ch] === c && cur[ch] ? cur[ch] : normCombat(c);
  for (const k of Object.keys(SRC)) delete SRC[k];
  Object.assign(SRC, src);
  g.fights = out;
  g.combat = out[g.fch] || Object.assign(N.freshCombat(), {ch:g.fch});
}
function normMap(m){
  m.pins = (m.pins || []).map(p => {
    if (p.x != null && m.w) { p.rx = p.x / m.w; p.ry = p.y / m.h; }
    if (p.type === 'party') p.vis = true;
    if (!N.PINT[p.type]) p.type = 'note';
    return p;
  });
  return m;
}
function setMaps(u){ G().maps = vals(u).sort(byO).map(normMap); }
/* a player's view: what everyone sees plus what the GM shared with them alone (only/<seat>, keys w: m: n:) */
const PUB = {wiki:{}, maps:{}, news:{}}, MINE = {wiki:{}, maps:{}, news:{}}, GMNEWS = {};
const KIND = {w:'wiki', m:'maps', n:'news'};
function mergeView(){
  const g = G(), all = k => vals({...PUB[k], ...MINE[k]});
  if (!isGM()) { g.wiki = all('wiki').sort(byO); g.maps = all('maps').sort(byO).map(normMap); }
  g.news.issues = vals(isGM() ? {...PUB.news, ...GMNEWS} : {...PUB.news, ...MINE.news}).sort((a,b) => (+a.no || 0) - (+b.no || 0));
}
function setMine(u){
  for (const k of Object.values(KIND)) MINE[k] = {};
  for (const [key, j] of Object.entries(u)) { const k = KIND[key[0]]; if (k && key[1] === ':') MINE[k][key.slice(2)] = j; }
  mergeView();
}
function normNpc(n){
  const v = N.stressVals(0);
  return Object.assign({race:'', job:n.occ || '', hc:'', trouble:'', aspects:[], skills:{}, magic:'', stunts:[], refresh:3, fp:3, bio:'', notes:'', type:'supporting', portrait:null,
    stressV:{phys:v, ment:v}, stress:{phys:v.map(() => false), ment:v.map(() => false)}, cons:{mild:'', moderate:'', severe:''}}, n, {job:n.job ?? n.occ ?? ''});
}
/* a character's colour follows its seat; kept off the saved copy */
N.decorate = c => {
  if (!c) return c;
  Object.defineProperty(c, 'color', {get:() => G().P[c.player]?.color || N.seatColor(c.player || 'p1'), enumerable:false, configurable:true});
  if (!c.disc) Object.defineProperty(c, 'disc', {value:{}, enumerable:false, configurable:true, writable:true});
  if (!c.inv) c.inv = [];
  if (!c.cons) c.cons = {mild:'', moderate:'', severe:''};
  return c;
};

/* a change from someone else redraws the page, but never under someone who is typing in a form */
let _rq = 0, _late = false;
const typing = () => { const a = document.activeElement; return !!a && /^(INPUT|TEXTAREA|SELECT)$/.test(a.tagName) && !a.closest('.composer') && V && V.root.contains(a); };
function changed(){ if (!live) return; clearTimeout(_rq); _rq = setTimeout(() => { if (typing()) { _late = true; return; } _late = false; if (readyCheck()) N.renderAll(); }, 40); }
document.addEventListener('focusout', () => { if (_late) setTimeout(() => { if (_late && !typing()) changed(); }, 0); });

function applyMembers(list){
  const g = G(); N.MEMBERS = list;
  const gmM = list.find(m => m.role === 'gm');
  g.P = {gm:{id:'gm', name:(gmM?.name || 'GM').trim().split(/\s+/)[0] || 'GM', color:'var(--c-gm)'}};
  /* someone with several characters has a seat for each (seats); role is the one they are playing now */
  const rows = [];
  for (const m of list.filter(m => isSeat(m.role))) for (const s of N.seatsOf(m)) rows.push([s, m]);
  for (const [s, m] of rows.sort((a, b) => a[0].slice(1) - b[0].slice(1))) {
    const who = (m.name || 'Player').trim() || 'Player';
    g.P[s] = {id:s, name:who, who, char:'pc' + s.slice(1), color:N.seatColor(s), uid:m.uid, ...(N.seatsOf(m).length > 1 ? {multi:true, on:m.role === s} : {})};
  }
  nameSeats(); ensureChars();
}
/* every seat this account holds, the one played now first */
N.seatsOf = m => [...new Set([m.role, ...(m.seats || [])])].filter(isSeat);
/* a person with several characters shows as "Jack · Brann" for each one, so their chats can be told apart */
function nameSeats(){
  const g = G();
  for (const p of Object.values(g.P)) if (p.multi) { const c = g.chars[p.char]; p.name = c?.built && c.short ? `${p.who} · ${c.short}` : `${p.who} (seat ${p.id.slice(1)})`; }
}
/* every seated player gets an empty character card, made on the GM's device */
function ensureChars(){
  const g = G();
  if (!isGM() || !charsReady()) return;
  let add = false;
  for (const s of N.seats()) { const id = g.P[s].char; if (!g.chars[id]) { g.chars[id] = N.decorate(N.blankChar(id, s)); add = true; } }
  if (add) queueSync();
}

/* ---------- this device: unread marks and appearance ---------- */
/* each character keeps its own unread marks on this device, as if it were a different person */
const LKEY = () => 'norne-seen-' + ME.uid + (ME.seats?.length > 1 && isSeat(G().role) ? '-' + G().role : '');
function loadLocal(){ const g = G(); try { const d = JSON.parse(localStorage.getItem(LKEY()) || '{}'); g.seen[g.role] = d.t || {}; g.news.seen[g.role] = d.n || []; } catch(e) { g.seen[g.role] = {}; g.news.seen[g.role] = []; } }
function saveLocal(){ const g = G(); try { localStorage.setItem(LKEY(), JSON.stringify({t:g.seen[g.role] || {}, n:g.news.seen[g.role] || []})); } catch(e) {} }

/* ---------- start-up ---------- */
async function boot(view){
  V = view;
  gate('<p class="fine">Opening the campaign book…</p>');
  try { F = await import('../vendor/firebase.js'); } catch(e) { gate('<p>Norne couldn’t load. Check your connection, then reload the page.</p>'); return; }
  const app = F.initializeApp(FB); auth = F.getAuth(app); db = F.initializeFirestore(app, {ignoreUndefinedProperties:true});
  if (EMU) {
    F.connectAuthEmulator(auth, 'http://127.0.0.1:9099', {disableWarnings:true}); F.connectFirestoreEmulator(db, '127.0.0.1', 8080);
    window.__emu = {F, db};
    window.__emuSignIn = (email, name) => F.signInWithCredential(auth, F.GoogleAuthProvider.credential(JSON.stringify({sub:email, email, name, email_verified:true})));
  }
  F.onAuthStateChanged(auth, u => { if (started) { location.reload(); return; } if (u) enter(u).catch(fail); else signInGate(); });
}
N.boot = boot;
async function enter(u){
  const email = (u.email || '').toLowerCase(), mref = dref('members/' + u.uid), gm = email === GM_EMAIL;
  gate('<p class="fine">Opening the campaign book…</p>');
  const snap = await F.getDoc(mref);
  if (!snap.exists()) await F.setDoc(mref, {name:u.displayName || email.split('@')[0], email, role:gm ? 'gm' : 'pending', t:Date.now()});
  else if (gm && snap.data().role !== 'gm') await F.updateDoc(mref, {role:'gm'});
  F.onSnapshot(mref, s => {
    const d = s.data(); if (!d || s.metadata.hasPendingWrites) return;
    ME = {uid:u.uid, email, name:d.name, role:d.role, seats:d.seats || []};
    if (started) { if (d.role !== G().role) location.reload(); else N.renderAll(); return; }
    if (d.role === 'gm' || isSeat(d.role)) start(d.role).catch(fail);
    else if (d.role === 'removed') gate(`<p>You don’t have a seat at this table any more. Ask the GM if that’s a mistake.</p>${outBtn}`);
    else gate(`<p>Hi ${esc(d.name)}, you’re signed in.</p><p class="fine">The GM still needs to let you in. Ask them to open <b>Players and sign-ins</b> in their menu. This page opens by itself once they do.</p>${outBtn}`);
  }, fail);
}
async function start(role){
  started = true;
  const g = G(); g.role = role; V.role = role; V.ui = N.newUi(role); g.me = ME;
  loadLocal();
  const docs = isGM()
    ? ['game/chars','game/combat','gm/combat','gm/maps','gm/wiki','gm/npcs','gm/misc','game/news','gm/news','game/maps','game/wiki','game/meta','game/emoji']
    : ['game/chars','game/combat','game/maps','game/wiki','game/news','game/meta','game/emoji'];
  const APPLY = {
    'game/chars': u => { CH.base = u; mergeChars(); ensureChars(); },
    'game/combat': u => { GC = u.c ? JSON.parse(u.c) : null; setCombat(); },
    /* one unit per chat; c is where the one fight lived before there could be several */
    'gm/combat': u => { SC = {}; for (const j of Object.values(u)) { const x = JSON.parse(j); if (x) SC[x.ch || 'table'] = x; } setCombat(); },
    'gm/maps': setMaps,
    'gm/wiki': u => { g.wiki = vals(u).sort(byO); },
    'gm/npcs': u => { g.npcs = vals(u).map(normNpc).sort((a,b) => a.name.localeCompare(b.name)); },
    'gm/misc': u => { g.quick = u.npcs ? JSON.parse(u.npcs) : []; g.foes = u.foes ? JSON.parse(u.foes) : []; g.recent = u.recent ? JSON.parse(u.recent) : []; g.pics = u.pics ? JSON.parse(u.pics) : []; },
    'game/news': u => { PUB.news = u; mergeView(); },
    'gm/news': u => { for (const k of Object.keys(GMNEWS)) delete GMNEWS[k]; Object.assign(GMNEWS, u); mergeView(); },
    'game/maps': u => { PUB.maps = u; mergeView(); },
    'game/wiki': u => { PUB.wiki = u; mergeView(); },
    'game/meta': u => { g.cats = u.cats ? JSON.parse(u.cats) : null; g.gifKey = u.gif ? JSON.parse(u.gif) : ''; g.gmPic = u.gmpic ? JSON.parse(u.gmpic) : null; },
    'game/emoji': u => { g.emoji = vals(u).sort(byO); },
  };
  await new Promise(res => F.onSnapshot(F.collection(db, 'members'), snap => { applyMembers(snap.docs.map(d => ({uid:d.id, ...d.data()}))); changed(); res(); }, err => { fail(err); res(); }));
  await Promise.all([...docs.map(p => listenDoc(p, APPLY[p])), listenMsgs(), listenGroups(), isGM() ? null : listenDoc('only/' + role, setMine, true), ...(isGM() ? N.seats() : [role]).map(listenFight)]);
  ensureChars();
  for (const t of ['click','change','input','submit','keydown','pointerup']) document.addEventListener(t, queueSync);
  window.addEventListener('pagehide', syncNow);
  document.addEventListener('visibilitychange', () => { if (document.hidden) syncNow(); });
  live = true;
  listenPush();
  if (N.notifyStart) N.notifyStart();
  if (g.maps[0]) V.ui.mapId = (g.maps.find(m => m.id === 'norne') || g.maps.find(m => isGM() || m.vis !== false) || g.maps[0]).id;
  if (readyCheck()) N.renderAll();
  if (isGM() && !g.wiki.length && !g.maps.length) { V.ui.sheet = 'import'; N.renderAll(); }
}
/* a new player waits for the GM's device to lay out their character card */
function readyCheck(){
  const g = G();
  if (isGM() || g.chars[g.P[g.role]?.char]) { if (N.gated) gate(null); return true; }
  gate(`<p>You’re in. Your character card appears as soon as the GM has Norne open.</p>${outBtn}`); return false;
}

/* ---------- account actions ---------- */
N.signIn = () => F.signInWithPopup(auth, new F.GoogleAuthProvider()).catch(e => { if (!/popup-closed|cancelled-popup/.test(e?.code || '')) signInGate(e?.code === 'auth/popup-blocked' ? 'Your browser blocked the sign-in window. Allow pop-ups for this page and try again.' : 'Sign-in didn’t work. Try again.'); });
N.signOut = () => { syncNow(); F.signOut(auth).then(() => location.reload()); };
N.admit = id => {
  const m = N.MEMBERS.find(x => x.uid === id); if (!m) return;
  const used = [...N.MEMBERS.map(x => +(x.seat || x.role).slice(1) || 0), ...Object.keys(G().chars).map(k => +k.slice(2) || 0)];
  const seat = m.seat || 'p' + (Math.max(0, ...used) + 1);
  track(F.updateDoc(dref('members/' + m.uid), {role:seat, seat}));
  return m.name;
};
/* the GM gives a player another character: a new seat of its own (own card, own private chat, own party) */
N.addSeat = id => {
  const m = N.MEMBERS.find(x => x.uid === id); if (!m || !isSeat(m.role)) return null;
  const used = [...N.MEMBERS.flatMap(x => [x.seat || x.role, ...(x.seats || [])]).map(s => +String(s).slice(1) || 0), ...Object.keys(G().chars).map(k => +k.slice(2) || 0)];
  const seat = 'p' + (Math.max(0, ...used) + 1);
  track(F.updateDoc(dref('members/' + m.uid), {seats:[...N.seatsOf(m), seat]}));
  return seat;
};
/* the GM takes an extra character away (not the one being played); its card stays, like a former player's */
N.dropSeat = (id, seat) => {
  const m = N.MEMBERS.find(x => x.uid === id); if (!m || m.role === seat) return;
  track(F.updateDoc(dref('members/' + m.uid), {seats:N.seatsOf(m).filter(s => s !== seat)}));
};
/* a player switches character: the app reloads as that seat, with its own chats and memory */
N.switchSeat = seat => {
  if (!ME || !N.seatsOf(ME).includes(seat) || seat === ME.role) return;
  track(F.updateDoc(dref('members/' + ME.uid), {role:seat}));
};
N.kick = id => { const m = N.MEMBERS.find(x => x.uid === id); if (m) track(F.updateDoc(dref('members/' + m.uid), {role:'removed'})); return m; };
N.renameMember = (id, name) => { name = name.trim(); if (name) track(F.updateDoc(dref('members/' + id), {name})); };

/* ---------- lore file ---------- */
N.importLore = file => file.text().then(txt => {
  const d = JSON.parse(txt);
  if (d.kind !== 'norne-lore' || !Array.isArray(d.wiki) || !Array.isArray(d.maps)) throw new Error('not lore');
  const g = G();
  /* pictures the GM added to an entry stay when the lore file replaces its text */
  for (const e of d.wiki) { const i = g.wiki.findIndex(x => x.id === e.id); if (i >= 0) { const was = g.wiki[i]; if (was.imgs && !e.imgs) { e.imgs = was.imgs; delete e.img; } g.wiki[i] = e; } else g.wiki.push(e); }
  for (const m0 of d.maps) { const m = normMap(m0), i = g.maps.findIndex(x => x.id === m.id); if (i >= 0) g.maps[i] = m; else g.maps.push(m); }
  return Promise.all(Object.entries(d.mapimgs || {}).map(([id, data]) => { const v = g.maps.find(m => m.src === 'fs:' + id)?.vis !== false; MIMG.set(id, {url:data, p:null}); MVIS.set(id, v); return F.setDoc(dref('mapimgs/' + id), {data, vis:v}); }))
    .then(() => { syncNow(); return d; });
});
})();
