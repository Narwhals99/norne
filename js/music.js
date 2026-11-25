/* =====================================================================
   NORNE — music (Jack, 2026-11-20)
   The GM (or Jack) uploads songs (mp3) into folders. The GM sets the music everyone hears: one song on a loop, or a
   whole folder one song after another (round again at the end). When the party splits up he can give any player their
   own music instead, and later send them back to everyone's. Everyone hears the same song at the same spot, inside
   Norne: no accounts, nothing to install, and it stops when Norne is closed or put away.

   Where things live:
   - music/lib: the library. dirs = JSON [{id,name}], songs = JSON [{id,name,dir,dur,n,size,t}].
   - songparts/<song id>_<i>: the song file in pieces of 700 KB (base64 text), since one database document holds at most 1 MB.
     A device downloads a song once and keeps it in its own cache (Cache Storage 'norne-music').
   - music/all: the music everyone hears. music/<seat> (p1, p2…): a player's own music, which they hear instead of
     everyone's until the GM sends them back. Each holds: {list:[song ids], durs:[ms], mode:'song'|'dir', dir, t0, pos, on, vol}.
     No device has to stay open to keep it going: where the music is comes from the clock. While playing, the spot is
     (now - t0) run through the list's lengths, round and round. Paused, it is pos. Only the GM writes it (firestore.rules).
   Browsers only let a page make sound after the person has touched it once, so the first tap anywhere in Norne
   turns sound on; if that hasn't happened yet the music strip shows "Tap to hear the music".
   ===================================================================== */
(function(){
const N = window.N, {esc, IC} = N;
const G = () => N.G, isGM = v => v.role === 'gm';
const mu = N.mu = {};
const PART = 700000, MAXB = 20 * 1024 * 1024;
const ls = {get(k){ try { return localStorage.getItem(k); } catch(e) { return null; } },
  set(k, x){ try { x == null ? localStorage.removeItem(k) : localStorage.setItem(k, x); } catch(e) {} }};
const rerender = () => N.renderAll && N.renderAll();
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 6);

/* ---------- state on this device ---------- */
const S = mu.S = {
  lib:{dirs:[], songs:[]}, libReady:false,
  docs:{},                     // 'all' or a seat -> music/<that>
  hear:null,                   // whose music this device plays ('all' or a seat)
  muted:ls.get('norne-music-mute') === '1',
  myVol:+(ls.get('norne-music-vol') || 100),
  locked:true,                 // no tap yet: the browser won't let sound start
  up:null,                     // upload in progress {done, all, name}
  denied:false, note:'',
};
mu.canLib = v => isGM(v) || !!(N.isJack && N.isJack());
/* whose music: 'all' (everyone's) or a seat (that player's own) */
const tgtName = t => t === 'all' ? 'Everyone' : (G().P[t] && G().P[t].name) || 'A player';
/* what this screen hears and controls: a player hears their own music when the GM set one, else everyone's.
   The GM hears whichever he has picked in the Music window (everyone's to start with) */
mu.tgt = v => isGM(v) ? (v.ui.muT && (v.ui.muT === 'all' || N.seats().includes(v.ui.muT)) ? v.ui.muT : 'all') : (S.docs[v.role] ? v.role : 'all');
const song = id => S.lib.songs.find(s => s.id === id);
const dirName = id => (S.lib.dirs.find(d => d.id === id) || {}).name || 'No folder';
const inDir = id => S.lib.songs.filter(s => (s.dir || '') === (id || '')).sort((a, b) => a.name.localeCompare(b.name, undefined, {numeric:true}));
const mmss = ms => { const s = Math.round((ms || 0) / 1000); return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0'); };

/* ---------- where the music is, from the clock ---------- */
const elapsed = d => d.on ? Date.now() - d.t0 : (d.pos || 0);
/* -> {i, off}: which song of the list and how far into it */
function spot(d, el = elapsed(d)){
  const durs = d.durs || [], tot = durs.reduce((a, b) => a + (b || 0), 0);
  if (!tot) return {i:0, off:0};
  let x = ((el % tot) + tot) % tot, i = 0;
  while (i < durs.length - 1 && x >= durs[i]) { x -= durs[i]; i++; }
  return {i, off:x};
}
const startOf = (d, i) => (d.durs || []).slice(0, i).reduce((a, b) => a + (b || 0), 0);
mu.now = ch => { const d = S.docs[ch]; if (!d || !d.list || !d.list.length) return null; const p = spot(d); return {d, ...p, song:song(d.list[p.i]) || {name:'A song', dur:d.durs[p.i]}}; };

/* ---------- the player: one audio element for the whole page ---------- */
const A = new Audio(); A.preload = 'auto';
let CUR = null;           // song id loaded in A
const URLS = new Map();   // song id -> object URL
const LOADING = new Map();
/* a fraction of a second of silence: played inside the first tap so the browser lets this element make sound later */
const SILENT = 'data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQAAAAA=';
function unlock(){
  if (!S.locked) return;
  if (!A.src || A.src === SILENT || A.paused) {
    const was = A.src;
    if (!was) A.src = SILENT;
    A.play().then(() => { S.locked = false; if (!was || was === SILENT) A.pause(); rerender(); sync(); }).catch(() => {});
  } else { S.locked = false; }
}
document.addEventListener('pointerdown', unlock, true);
document.addEventListener('keydown', unlock, true);

async function blobOf(id){
  if (URLS.has(id)) return URLS.get(id);
  if (LOADING.has(id)) return LOADING.get(id);
  const p = (async () => {
    const key = location.pathname + '_song/' + id;
    let blob = null, cache = null;
    try { cache = await caches.open('norne-music'); const r = await cache.match(key); if (r) blob = await r.blob(); } catch(e) {}
    if (!blob) {
      const s = song(id); if (!s || !N.muPart) throw new Error('no song');
      const parts = await Promise.all(Array.from({length:s.n}, (_, i) => N.muPart(id, i)));
      const bytes = parts.map(b64 => { const bin = atob(b64 || ''); const u = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i); return u; });
      blob = new Blob(bytes, {type:s.type || 'audio/mpeg'});
      try { if (cache) await cache.put(key, new Response(blob, {headers:{'Content-Type':blob.type}})); } catch(e) {}
    }
    const u = URL.createObjectURL(blob); URLS.set(id, u);
    /* keep a handful of songs ready on this page */
    if (URLS.size > 6) { const [k, old] = URLS.entries().next().value; if (k !== CUR) { URL.revokeObjectURL(old); URLS.delete(k); } }
    return u;
  })().finally(() => LOADING.delete(id));
  LOADING.set(id, p);
  return p;
}

/* make the audio match the music this device hears: the right song, the right spot, playing or not */
let SYNCING = false, AGAIN = false;
async function sync(){
  if (SYNCING) { AGAIN = true; return; }
  SYNCING = true;
  try {
    const d = S.hear && S.docs[S.hear];
    const want = d && d.on && !document.hidden && !S.muted && d.list && d.list.length;
    if (!want) { if (!A.paused) A.pause(); return; }
    const p = spot(d), id = d.list[p.i];
    A.volume = Math.max(0, Math.min(1, (d.vol == null ? 80 : d.vol) / 100 * S.myVol / 100));
    if (CUR !== id) {
      const u = await blobOf(id);
      /* the music may have moved on while the song came down */
      const d2 = S.hear && S.docs[S.hear]; if (!d2 || !d2.on || d2.list[spot(d2).i] !== id) { AGAIN = true; return; }
      CUR = id; A.src = u;
      await new Promise(r => { if (A.readyState >= 1) r(); else { A.addEventListener('loadedmetadata', r, {once:true}); setTimeout(r, 4000); } });
      A.currentTime = spot(d2).off / 1000;
    } else if (Math.abs(A.currentTime * 1000 - p.off) > 1500) A.currentTime = p.off / 1000;
    if (A.paused) await A.play().then(() => { if (S.locked) { S.locked = false; rerender(); } }).catch(e => { if (e && e.name === 'NotAllowedError') { S.locked = true; rerender(); } });
    /* fetch the next song in the folder ahead of time */
    if (d.list.length > 1) blobOf(d.list[(p.i + 1) % d.list.length]).catch(() => {});
  } catch(e) { console.warn('music', e); }
  finally { SYNCING = false; if (AGAIN) { AGAIN = false; setTimeout(sync, 50); } }
}
mu.sync = sync; mu.A = A;
/* a song that ends: the same one again (loop) or the next one, both worked out from the clock */
A.addEventListener('ended', () => sync());
setInterval(() => { if (!document.hidden && S.hear) sync(); }, 5000);
/* put away (another app, locked phone, closed tab): silence. Back on screen: pick up where the music is now */
document.addEventListener('visibilitychange', () => { if (document.hidden) A.pause(); else sync(); });
window.addEventListener('pagehide', () => A.pause());

function pickHear(v){ const t = mu.tgt(v), h = S.docs[t] ? t : 'all'; if (h !== S.hear) { S.hear = h; sync(); } }

/* ---------- the GM's controls: each writes music/all or music/<seat> ---------- */
const W = (ch, d) => { if (d) S.docs[ch] = d; else delete S.docs[ch]; rerender(); sync(); return N.muWrite ? N.muWrite(ch, d).catch(e => { S.note = 'Norne couldn’t save the music (' + (e.code || e.message) + ').'; rerender(); }) : Promise.resolve(); };
const at = (d, el) => ({...d, t0:Date.now() - el, pos:el, at:Date.now()});
mu.playSong = (ch, id) => { const s = song(id); if (!s) return; const old = S.docs[ch]; W(ch, {mode:'song', dir:s.dir || '', list:[id], durs:[s.dur], on:true, t0:Date.now(), pos:0, vol:old ? old.vol : 80, at:Date.now()}); S.hear = ch; };
mu.playDir = (ch, dir, first) => {
  const l = inDir(dir); if (!l.length) return; const old = S.docs[ch];
  const d = {mode:'dir', dir:dir || '', list:l.map(s => s.id), durs:l.map(s => s.dur), on:true, vol:old ? old.vol : 80};
  const i = Math.max(0, d.list.indexOf(first));
  W(ch, at(d, startOf(d, i))); S.hear = ch;
};
function cmd(ch, c, x){
  const d = S.docs[ch]; if (!d) return;
  const el = elapsed(d), p = spot(d, el), n = d.list.length;
  if (c === 'pause') W(ch, {...d, on:false, pos:el, at:Date.now()});
  else if (c === 'play') { W(ch, {...at(d, d.pos || 0), on:true}); }
  else if (c === 'next') W(ch, at(d, startOf(d, (p.i + 1) % n)));
  /* back: to the start of this song, or the one before when it only just began */
  else if (c === 'prev') W(ch, at(d, p.off > 4000 ? startOf(d, p.i) : startOf(d, (p.i - 1 + n) % n)));
  else if (c === 'vol') W(ch, {...d, vol:x});
  else if (c === 'loop') { const id = d.list[p.i], s = song(id); W(ch, at({...d, mode:'song', list:[id], durs:[s ? s.dur : d.durs[p.i]]}, p.off)); }
  else if (c === 'through') { const l = inDir(d.dir); if (!l.length) return; const nd = {...d, mode:'dir', list:l.map(s => s.id), durs:l.map(s => s.dur)}; const i = Math.max(0, nd.list.indexOf(d.list[p.i])); W(ch, at(nd, startOf(nd, i) + p.off)); }
  else if (c === 'stop') W(ch, null);
}

/* ---------- the library: folders and uploads ---------- */
const saveLib = () => N.muLibWrite ? N.muLibWrite({dirs:JSON.stringify(S.lib.dirs), songs:JSON.stringify(S.lib.songs)}).catch(e => { S.note = 'Couldn’t save the music library (' + (e.code || e.message) + ').'; rerender(); }) : Promise.resolve();
let PICK = null;
/* the file box stays in the page until the files are in (iPhone can lose a loose one while its picker is open) */
function pickSongs(cb){
  if (PICK) PICK.remove();
  const inp = document.createElement('input'); inp.type = 'file'; inp.multiple = true;
  inp.accept = '.mp3,.m4a,.aac,.wav,audio/mpeg,audio/mp4,audio/aac,audio/wav,audio/x-m4a';
  inp.setAttribute('aria-hidden', 'true'); inp.tabIndex = -1;
  inp.style.cssText = 'position:fixed;left:-9999px;top:0;width:1px;height:1px;opacity:0;pointer-events:none';
  document.body.appendChild(inp); PICK = inp;
  let done = false;
  const end = () => { removeEventListener('focus', back); document.removeEventListener('visibilitychange', back); if (PICK === inp) PICK = null; inp.remove(); };
  const take = () => { const fs = [...(inp.files || [])]; if (done || !fs.length) return; done = true; end(); cb(fs); };
  const back = () => { if (document.visibilityState === 'hidden') return; setTimeout(take, 500); setTimeout(take, 1500); };
  inp.addEventListener('change', take); inp.addEventListener('input', take);
  addEventListener('focus', back); document.addEventListener('visibilitychange', back);
  inp.click();
}
const lenOf = f => new Promise(res => { const a = new Audio(), u = URL.createObjectURL(f); const fin = x => { URL.revokeObjectURL(u); res(x); };
  a.preload = 'metadata'; a.onloadedmetadata = () => fin(isFinite(a.duration) ? Math.round(a.duration * 1000) : 0); a.onerror = () => fin(0); setTimeout(() => fin(0), 8000); a.src = u; });
const b64 = u8 => { let s = ''; for (let i = 0; i < u8.length; i += 0x8000) s += String.fromCharCode.apply(null, u8.subarray(i, i + 0x8000)); return btoa(s); };
async function upload(files, dir){
  const ok = files.filter(f => f.size <= MAXB), big = files.length - ok.length;
  S.up = {done:0, all:ok.length, name:''}; S.note = big ? `${big} file${big > 1 ? 's were' : ' was'} over 20 MB and left out.` : ''; rerender();
  for (const f of ok) {
    S.up.name = f.name; rerender();
    try {
      const dur = await lenOf(f);
      if (!dur) { S.note = `“${f.name}” couldn’t be read as music.`; S.up.done++; continue; }
      const buf = new Uint8Array(await f.arrayBuffer()), id = uid(), n = Math.ceil(buf.length / PART);
      for (let i = 0; i < n; i++) { if (N.muPartWrite) await N.muPartWrite(id, i, b64(buf.subarray(i * PART, (i + 1) * PART))); S.up.part = (i + 1) / n; rerender(); }
      const name = f.name.replace(/\.[a-z0-9]{2,4}$/i, '').replace(/[_]+/g, ' ').trim().slice(0, 80) || 'Song';
      S.lib.songs.push({id, name, dir:dir || '', dur, n, size:buf.length, type:f.type || 'audio/mpeg', t:Date.now()});
      await saveLib();
    } catch(e) { S.note = `“${f.name}” didn’t upload (${e.code || e.message}).`; }
    S.up.done++; S.up.part = 0; rerender();
  }
  S.up = null; rerender();
}
function delSong(id){
  const s = song(id); if (!s) return;
  S.lib.songs = S.lib.songs.filter(x => x.id !== id); saveLib();
  if (N.muPartWrite) for (let i = 0; i < s.n; i++) N.muPartWrite(id, i, null).catch(() => {});
  try { caches.open('norne-music').then(c => c.delete(location.pathname + '_song/' + id)); } catch(e) {}
}

/* ---------- from sync.js ---------- */
mu.libLoad = d => {
  const j = (x, f) => { try { return x ? JSON.parse(x) : f; } catch(e) { return f; } };
  S.lib = {dirs:j(d && d.dirs, []), songs:j(d && d.songs, [])}; S.libReady = true; rerender(); sync();
};
mu.load = (ch, d) => { if (d) S.docs[ch] = d; else delete S.docs[ch]; rerender(); if (ch === S.hear || !S.hear) sync(); };
mu.denied = () => { S.denied = true; rerender(); };
let WKEY = '';
const prevRender = N.onRender;
N.onRender = v => {
  if (prevRender) prevRender(v);
  try {
    /* the GM listens to everyone's music and each player's own; a player to everyone's and their own */
    if (N.muWatch) { const ts = ['all', ...(isGM(v) ? N.seats() : /^p\d+$/.test(v.role || '') ? [v.role] : [])], k = ts.join(','); if (k !== WKEY && N.muWatch(ts) !== false) WKEY = k; }
    pickHear(v);
  } catch(e) { console.warn('music', e); }
};

/* ---------- drawing ---------- */
const B = (c, label, ic, extra = '') => `<button type="button" class="ibtn mu-c" data-a="mu" data-v="${c}" aria-label="${label}" title="${label}"${extra}>${IC(ic)}</button>`;
mu.topBtn = v => {
  const d = S.docs[mu.tgt(v)]; if (!isGM(v) && !d) return '';
  return `<button type="button" class="ibtn mu-btn${d && d.on ? ' playing' : ''}" data-a="mu" data-v="toggle" aria-pressed="${v.ui.sheet === 'music'}" aria-label="Music" title="Music">${IC('music')}</button>`;
};
const muteBtn = () => B('mute', S.muted ? 'Turn the music on' : 'Mute the music', S.muted ? 'mute' : 'speaker', ` aria-pressed="${S.muted}"`);
/* the strip above the chat while music plays for this person */
mu.bar = v => {
  const t = mu.tgt(v), n = mu.now(t); if (!n) return '';
  const {d, song:s} = n, gm = isGM(v), who = gm ? (t === 'all' ? 'Everyone' : esc(tgtName(t)) + ' only') + ' · ' : t !== 'all' ? 'Just for you · ' : '';
  const where = d.mode === 'dir' ? `${esc(dirName(d.dir))} · song ${n.i + 1} of ${d.list.length}` : 'On a loop';
  const tap = S.locked && d.on && !S.muted && S.hear === t;
  const sub = who + (!d.on ? 'Paused' : S.muted ? 'Muted on this device' : where);
  const ctl = gm ? `${B('prev', 'Back', 'prev')}${d.on ? B('pause', 'Pause', 'pause') : B('play', 'Play', 'play')}${B('next', 'Next song', 'next')}` : '';
  /* before the first tap the whole strip is the button that turns the sound on */
  if (tap) return `<button type="button" class="fightbar mubar on tap" data-a="mu" data-v="tap"><span class="mu-art">${IC('speaker')}</span><span class="t mu-t"><b>${esc(s.name)}</b><span>Tap here to hear the music</span></span></button>`;
  return `<div class="fightbar mubar${d.on ? ' on' : ''}"><span class="mu-art">${IC('music')}</span><button type="button" class="t mu-t" data-a="mu" data-v="toggle"><b>${esc(s.name)}</b><span>${sub}</span></button>${ctl}${muteBtn()}</div>`;
};
function libHtml(v){
  const t = mu.tgt(v), gm = isGM(v), canPlay = gm, d = S.docs[t], open = v.ui.muOpen || {};
  const cur = d && d.on ? d.list[spot(d).i] : null;
  const dirs = [...S.lib.dirs, {id:'', name:'No folder'}].filter(x => x.id || inDir('').length || !S.lib.dirs.length);
  const row = s => `<div class="mu-song${s.id === cur ? ' on' : ''}">${canPlay ? `<button type="button" class="ibtn mu-c" data-a="mu" data-v="playSong" data-k="${s.id}" aria-label="Loop “${esc(s.name)}”" title="Loop this song for ${esc(tgtName(t))}">${IC(s.id === cur ? 'speaker' : 'play')}</button>` : `<span class="mu-c">${IC('music')}</span>`}
    <span class="mu-sn"><b>${esc(s.name)}</b><small>${mmss(s.dur)}</small></span>
    ${v.ui.muEdit === s.id ? `<select class="inp mu-move" data-i="muMove" data-k="${s.id}" aria-label="Move to folder"><option value="">No folder</option>${S.lib.dirs.map(x => `<option value="${x.id}"${x.id === (s.dir || '') ? ' selected' : ''}>${esc(x.name)}</option>`).join('')}</select>
      <button type="button" class="btn sm ghost" data-a="mu" data-v="${v.ui.muArm === s.id ? 'delSongGo' : 'delSong'}" data-k="${s.id}">${IC('trash')}${v.ui.muArm === s.id ? 'Delete it' : ''}</button>`
      : `<button type="button" class="ibtn mu-c sm" data-a="mu" data-v="edit" data-k="${s.id}" aria-label="Move or delete" title="Move or delete">${IC('dots')}</button>`}</div>`;
  return `<div class="mu-lib">
    ${dirs.map(x => { const l = inDir(x.id), op = open[x.id || '_'] !== false;
      return `<div class="mu-dir"><div class="mu-dh"><button type="button" class="mu-dt" data-a="mu" data-v="fold" data-k="${x.id || '_'}" aria-expanded="${op}">${IC('folder')}<b>${esc(x.name)}</b><small>${l.length} song${l.length === 1 ? '' : 's'}</small>${IC('caret')}</button>
        ${canPlay && l.length ? `<button type="button" class="btn sm" data-a="mu" data-v="playDir" data-k="${x.id}" title="Play the whole folder for ${esc(tgtName(t))}, one song after another">${IC('play')}Play folder</button>` : ''}</div>
        ${op ? `<div class="mu-songs">${l.map(row).join('') || '<p class="muted mu-p">Empty folder.</p>'}
          ${v.ui.muRen === x.id && x.id ? `<div class="row mu-new"><input class="inp" id="muren-${v.id}" data-i="muRen" value="${esc(v.ui.muRenName ?? x.name)}" aria-label="Folder name"><button type="button" class="btn sm" data-a="mu" data-v="renGo" data-k="${x.id}">Save</button></div>` : ''}
          <div class="row mu-dirbtns"><button type="button" class="btn sm ghost" data-a="mu" data-v="up" data-k="${x.id}"${S.up ? ' disabled' : ''}>${IC('upload')}Add songs</button>
          ${x.id ? `<button type="button" class="btn sm ghost" data-a="mu" data-v="ren" data-k="${x.id}">${IC('pen')}Rename</button><button type="button" class="btn sm ghost" data-a="mu" data-v="${v.ui.muArm === 'd' + x.id ? 'delDirGo' : 'delDir'}" data-k="${x.id}">${IC('trash')}${v.ui.muArm === 'd' + x.id ? (l.length ? `Delete folder and its ${l.length} song${l.length === 1 ? '' : 's'}` : 'Delete folder') : ''}</button>` : ''}</div></div>` : ''}</div>`; }).join('')}
    <div class="row mu-new"><input class="inp" id="mudir-${v.id}" data-i="muDir" placeholder="New folder name (Tavern, Battle, Forest…)" value="${esc(v.ui.muDir || '')}" autocomplete="off"><button type="button" class="btn sm" data-a="mu" data-v="newDir">${IC('plus')}New folder</button></div>
    <p class="muted mu-p">mp3, m4a or wav, up to 20 MB each. Room for roughly 150 songs in all.</p></div>`;
}
mu.title = () => 'Music';
mu.html = v => {
  const gm = isGM(v), t = mu.tgt(v), n = mu.now(t);
  if (S.denied) return `<div class="note">${IC('warn')}<span>Music needs the new Firebase rules. Jack: paste the new firestore.rules into Firebase and press Publish.</span></div>`;
  const note = S.note ? `<div class="note mu-note">${IC('info')}<span>${esc(S.note)}</span></div>` : '';
  const up = S.up ? `<div class="mu-up"><span>Uploading ${S.up.done + 1} of ${S.up.all}: ${esc(S.up.name)}</span><i style="--p:${Math.round(((S.up.done + (S.up.part || 0)) / Math.max(1, S.up.all)) * 100)}%"></i></div>` : '';
  /* the GM picks whose music he is setting: everyone's, or one player's own (a dot marks players who have their own) */
  const who = gm ? `<div class="mu-who"><h4>Whose music</h4><div class="forwho">${['all', ...N.seats()].map(x => `<button type="button" data-a="mu" data-v="tgt" data-k="${x}" aria-pressed="${x === t}">${x === 'all' ? IC('users') : N.av(N.personObj(x), 24)}${esc(tgtName(x))}${x !== 'all' && S.docs[x] ? '<span class="mu-own" title="Has their own music"></span>' : ''}</button>`).join('')}</div>
    <p class="muted mu-p">${t === 'all' ? `Everyone hears this${N.seats().some(x => S.docs[x]) ? `, except ${N.seats().filter(x => S.docs[x]).map(tgtName).map(esc).join(', ')}, who ${N.seats().filter(x => S.docs[x]).length > 1 ? 'have' : 'has'} their own` : ''}.` : S.docs[t] ? `${esc(tgtName(t))} hears this instead of everyone’s music.` : `${esc(tgtName(t))} hears everyone’s music. Pick a song or folder to give them their own.`}</p></div>` : '';
  let now = '';
  if (n) {
    const {d, song:s} = n;
    now = `<div class="mu-now"><span class="mu-art big">${IC('music')}</span><span><b>${esc(s.name)}</b><small>${d.on ? 'Playing' : 'Paused'} · ${d.mode === 'dir' ? `${esc(dirName(d.dir))}, song ${n.i + 1} of ${d.list.length}` : 'on a loop'}</small></span></div>
      ${gm ? `<div class="mu-ctl">${B('prev', 'Back', 'prev')}${d.on ? B('pause', 'Pause for everyone', 'pause', ' style="--s:52px"') : B('play', 'Play for everyone', 'play', ' style="--s:52px"')}${B('next', 'Next song', 'next')}</div>
        ${inDir(d.dir).length > 1 ? `<div class="seg" role="group" aria-label="Repeat"><button type="button" data-a="mu" data-v="loop" aria-pressed="${d.mode === 'song'}">Loop this song</button><button type="button" data-a="mu" data-v="through" aria-pressed="${d.mode === 'dir'}">Play the folder</button></div>` : ''}
        <label class="mu-vol"><span>Volume</span><input type="range" min="0" max="100" step="5" value="${d.vol ?? 80}" data-i="muVol" aria-label="Volume"><b>${d.vol ?? 80}</b></label>
        <button type="button" class="btn sm ghost" data-a="mu" data-v="stop">${t === 'all' ? `${IC('mstop')}Stop everyone’s music` : `${IC('users')}Back to everyone’s music`}</button>` : ''}`;
  } else if (gm) now = t === 'all' ? `<p class="mu-lead">No music playing. Pick a song to loop, or play a whole folder.</p>` : '';
  else now = `<p class="mu-lead">No music right now.</p>`;
  const mine = `<div class="mu-mine"><h4>On this device</h4><div class="mu-mrow"><button type="button" class="btn sm${S.muted ? ' gold' : ''}" data-a="mu" data-v="mute" aria-pressed="${S.muted}">${IC(S.muted ? 'mute' : 'speaker')}${S.muted ? 'Muted' : 'Mute'}</button><label class="mu-vol" style="flex:1"><span>My volume</span><input type="range" min="0" max="100" step="5" value="${S.myVol}" data-i="muMyVol" aria-label="My volume"><b>${S.myVol}</b></label></div>
    <p class="muted mu-p">${N.mu.IOS ? 'iPhones set the loudness with their side buttons; mute works here.' : 'Only changes it for you.'} The music stops when you leave Norne.</p></div>`;
  return `${note}${up}${who}${now}${mine}${mu.canLib(v) ? `<div><h4>Music library<small>${gm ? 'Your songs, in folders' : 'Only you and the GM can change it'}</small></h4>${S.libReady || !N.muWatch ? libHtml(v) : '<p class="muted mu-p">Loading…</p>'}</div>` : ''}`;
};
mu.IOS = /iPhone|iPad|iPod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);

/* ---------- taps and typing ---------- */
mu.act = (v, el) => {
  const ui = v.ui, c = el.dataset.v, k = el.dataset.k, ch = mu.tgt(v);
  switch (c) {
    case 'toggle': ui.pop = null; ui.sheet = ui.sheet === 'music' ? null : 'music'; S.note = ''; break;
    case 'tap': unlock(); sync(); return;
    case 'tgt': ui.muT = k; S.hear = null; break;
    case 'mute': S.muted = !S.muted; ls.set('norne-music-mute', S.muted ? '1' : null); sync(); break;
    case 'play': case 'pause': case 'next': case 'prev': case 'stop': case 'loop': case 'through': cmd(ch, c); return;
    case 'playSong': mu.playSong(ch, k); return;
    case 'playDir': mu.playDir(ch, k); return;
    case 'fold': { const o = ui.muOpen = ui.muOpen || {}; o[k] = o[k] === false; break; }
    case 'up': pickSongs(fs => upload(fs, k)); return;
    case 'newDir': { const name = String(ui.muDir || '').trim(); if (!name) return; S.lib.dirs.push({id:'d' + uid(), name:name.slice(0, 40)}); ui.muDir = ''; saveLib(); break; }
    case 'ren': ui.muRen = ui.muRen === k ? null : k; ui.muRenName = null; break;
    case 'renGo': { const x = S.lib.dirs.find(d => d.id === k), name = String(ui.muRenName ?? '').trim(); if (x && name) { x.name = name.slice(0, 40); saveLib(); } ui.muRen = null; break; }
    case 'delDir': ui.muArm = 'd' + k; break;
    case 'delDirGo': { inDir(k).forEach(s => delSong(s.id)); S.lib.dirs = S.lib.dirs.filter(d => d.id !== k); ui.muArm = null; saveLib(); break; }
    case 'edit': ui.muEdit = ui.muEdit === k ? null : k; ui.muArm = null; break;
    case 'delSong': ui.muArm = k; break;
    case 'delSongGo': delSong(k); ui.muArm = null; ui.muEdit = null; break;
  }
  N.render(v);
};
mu.input = (v, el, i) => {
  if (i === 'muDir') v.ui.muDir = el.value;
  else if (i === 'muRen') v.ui.muRenName = el.value;
  else if (i === 'muVol' || i === 'muMyVol') { const b = el.parentNode.querySelector('b'); if (b) b.textContent = el.value; if (i === 'muMyVol') { S.myVol = +el.value; const d = S.hear && S.docs[S.hear]; if (d) A.volume = Math.max(0, Math.min(1, (d.vol ?? 80) / 100 * S.myVol / 100)); } }
};
mu.change = (v, el, i) => {
  if (i === 'muVol') cmd(mu.tgt(v), 'vol', +el.value);
  else if (i === 'muMyVol') { S.myVol = +el.value; ls.set('norne-music-vol', String(S.myVol)); sync(); }
  else if (i === 'muMove') { const s = song(el.dataset.k); if (s) { s.dir = el.value; saveLib(); v.ui.muEdit = null; N.render(v); } }
};
})();
