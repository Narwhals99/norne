/* =====================================================================
   NORNE — music from Spotify (Jack, 2026-11-20)
   The GM picks a Spotify playlist (or album, or one song) for a chat and plays, pauses and skips it from Norne.
   Everyone in that chat who taps Join hears the same song at the same spot, each on their own Spotify Premium account.

   How it hangs together:
   - Each person links Spotify once (Profile > Spotify music). That is Spotify's sign-in with PKCE: no secret anywhere,
     only the app's Client ID, which is public by design. The sign-in is kept on this device (localStorage norne-spotify).
   - The Client ID(s) live in Firestore music/cfg, pasted in by Jack or the GM, so a new Spotify app needs no code change.
     Spotify lets an app in Development Mode have only 5 people on its list (2026), so several IDs may be listed:
     each person links with the one their email was added to.
   - music/<chat> is what is playing in that chat: playlist, song, where it was and when, playing or paused, volume.
     Only the GM writes it (firestore.rules). The GM's device reads the GM's own Spotify every few seconds while Norne
     is open and writes a new copy only when something really changed (another song, pause, a jump).
   - Each listener's device reads music/<chat> and tells their own Spotify to match it: same playlist, same song,
     same spot (within a few seconds), playing or paused.
   - Computers play inside the page (Spotify's Web Playback SDK, a "Norne" speaker in Spotify). Phone browsers can't
     run that, so on phones Norne drives the person's Spotify app instead (Spotify Connect). Spotify has to be open on
     the phone once for it to show up. A locked phone keeps playing the playlist, and catches up with the GM's
     pauses and skips the next time Norne is opened.
   ===================================================================== */
(function(){
const N = window.N, {esc, IC} = N;
const G = () => N.G, isGM = v => v.role === 'gm';
const mu = N.mu = {};
const API = 'https://api.spotify.com/v1', ACC = 'https://accounts.spotify.com';
const SCOPES = 'streaming user-read-email user-read-private user-read-playback-state user-modify-playback-state user-read-currently-playing playlist-read-private playlist-read-collaborative';
const LS = 'norne-spotify', LS_PK = 'norne-spotify-pkce', LS_DEV = 'norne-spotify-dev', LS_JOIN = 'norne-music-join', LS_MYVOL = 'norne-music-myvol', LS_LIVE = 'norne-music-live';
/* phones and tablets: the Web Playback SDK doesn't play in their browsers (Spotify's own list), so Norne drives the Spotify app */
const MOBILE = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
mu.MOBILE = MOBILE;
const ls = {get(k){ try { return localStorage.getItem(k); } catch(e) { return null; } },
  set(k, x){ try { x == null ? localStorage.removeItem(k) : localStorage.setItem(k, x); } catch(e) {} }};
const jget = k => { try { return JSON.parse(ls.get(k) || 'null'); } catch(e) { return null; } };
/* Spotify must be told this exact address once (Redirect URI): the app's own page without index.html or anything after it */
mu.redirect = () => location.origin + location.pathname.replace(/index\.html$/, '');
const rerender = () => N.renderAll && N.renderAll();
const msg = t => { S.note = t; S.noteT = Date.now(); rerender(); };

/* ---------- state on this device ---------- */
const S = mu.S = {
  cfg:null,            // {ids:[{id,label}]} from music/cfg
  tok:jget(LS),        // {cid, at, rt, exp}
  me:null,             // Spotify profile {name, premium}
  docs:{},             // chat -> music/<chat> as last read
  denied:false,
  join:ls.get(LS_JOIN) || null,    // the chat this device listens to
  live:ls.get(LS_LIVE) || null,    // GM: the chat the GM's music goes to
  dev:ls.get(LS_DEV) || null,      // the Spotify device picked on this device (null = automatic)
  devs:null,           // last device list
  sdkDev:null, sdkFail:'', sdkOn:false,
  myVol:+(ls.get(LS_MYVOL) || 100),
  lists:null, listsBusy:false,
  note:'', noteT:0, busy:false, need:'',  // need: 'device' | 'tap' | ''
};
const saveTok = () => ls.set(LS, S.tok ? JSON.stringify(S.tok) : null);
mu.linked = () => !!(S.tok && S.tok.rt);
mu.ids = () => (S.cfg && Array.isArray(S.cfg.ids) ? S.cfg.ids : []).filter(x => x && /^[0-9a-f]{32}$/i.test(x.id || ''));
mu.doc = ch => S.docs[ch] || null;
mu.on = (v, ch) => !!ch && ch !== 'gm';

/* ---------- linking: Spotify's sign-in page and back (PKCE) ---------- */
const b64u = buf => btoa(String.fromCharCode(...new Uint8Array(buf))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const rnd = n => { const a = new Uint8Array(n); crypto.getRandomValues(a); return b64u(a).slice(0, n); };
mu.link = async cid => {
  if (!cid) { msg('Spotify isn’t set up yet: the Client ID is missing.'); return; }
  const ver = rnd(64), state = rnd(16);
  const ch = b64u(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(ver)));
  ls.set(LS_PK, JSON.stringify({ver, state, cid, t:Date.now()}));
  const q = new URLSearchParams({response_type:'code', client_id:cid, scope:SCOPES, redirect_uri:mu.redirect(), code_challenge_method:'S256', code_challenge:ch, state});
  /* a whole-page trip, not a pop-up: an iPhone home-screen app keeps it inside the app and comes back to the same storage */
  location.assign(ACC + '/authorize?' + q);
};
mu.unlink = () => {
  if (S.join) leave(true);
  if (PLAYER) { try { PLAYER.disconnect(); } catch(e) {} PLAYER = null; S.sdkDev = null; S.sdkOn = false; }
  S.tok = null; S.me = null; S.lists = null; S.devs = null; saveTok(); msg('Spotify unlinked on this device.');
};
async function tokenPost(body){
  const r = await fetch(ACC + '/api/token', {method:'POST', headers:{'Content-Type':'application/x-www-form-urlencoded'}, body:new URLSearchParams(body)});
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw Object.assign(new Error(j.error_description || j.error || 'Spotify said no'), {status:r.status, code:j.error});
  return j;
}
/* coming back from Spotify's page: ?code=...&state=... (or ?error=access_denied). Take them off the address at once */
(function back(){
  const q = new URLSearchParams(location.search);
  if (!q.has('state') || !(q.has('code') || q.has('error'))) return;
  const pk = jget(LS_PK);
  if (!pk || pk.state !== q.get('state')) return;
  const code = q.get('code'), err = q.get('error');
  ['code', 'state', 'error'].forEach(k => q.delete(k));
  history.replaceState(null, '', location.pathname + (q.toString() ? '?' + q : '') + location.hash);
  ls.set(LS_PK, null);
  S.openSheet = true;
  if (err) { S.note = err === 'access_denied' ? 'Spotify linking was cancelled.' : 'Spotify said: ' + err; return; }
  S.busy = true;
  tokenPost({grant_type:'authorization_code', code, redirect_uri:mu.redirect(), client_id:pk.cid, code_verifier:pk.ver})
    .then(j => { S.tok = {cid:pk.cid, at:j.access_token, rt:j.refresh_token, exp:Date.now() + j.expires_in * 1000}; saveTok(); S.busy = false; msg('Spotify is linked.'); hello(); })
    .catch(e => { S.busy = false; msg('Linking Spotify didn’t work (' + e.message + '). Try again.'); });
})();

/* ---------- the Web API, with the sign-in kept fresh ---------- */
let REFRESHING = null;
function refresh(){
  if (!S.tok) return Promise.resolve(null);
  return REFRESHING || (REFRESHING = tokenPost({grant_type:'refresh_token', refresh_token:S.tok.rt, client_id:S.tok.cid})
    .then(j => { S.tok = {...S.tok, at:j.access_token, rt:j.refresh_token || S.tok.rt, exp:Date.now() + j.expires_in * 1000}; saveTok(); return S.tok.at; })
    /* Spotify's sign-ins run out six months after linking: link again */
    .catch(e => { if (e.status === 400) { S.tok = null; saveTok(); msg('Your Spotify link ran out. Link Spotify again in Profile.'); } return null; })
    .finally(() => { REFRESHING = null; }));
}
const token = () => !S.tok ? Promise.resolve(null) : Date.now() < S.tok.exp - 60000 ? Promise.resolve(S.tok.at) : refresh();
let HOLD = 0;
async function api(method, path, body, again){
  if (Date.now() < HOLD) throw Object.assign(new Error('Spotify asked Norne to slow down'), {status:429});
  const t = await token(); if (!t) throw Object.assign(new Error('Spotify isn’t linked'), {status:401});
  const r = await fetch(API + path, {method, headers:{Authorization:'Bearer ' + t, ...(body ? {'Content-Type':'application/json'} : {})}, body:body ? JSON.stringify(body) : undefined});
  if (r.status === 401 && !again) { await refresh(); return api(method, path, body, true); }
  if (r.status === 429) { HOLD = Date.now() + (+(r.headers.get('Retry-After')) || 5) * 1000; }
  const tx = await r.text(); let j = null; try { j = tx ? JSON.parse(tx) : null; } catch(e) {}
  if (!r.ok) { const e = (j && j.error) || {}; throw Object.assign(new Error(e.message || 'Spotify error ' + r.status), {status:r.status, reason:e.reason || ''}); }
  return j;
}
/* what went wrong, said plainly */
function why(e){
  const m = String(e && e.message || ''), s = e && e.status;
  if (/may not be registered|not registered/i.test(m) || (s === 403 && !e.reason && /dashboard|developer/i.test(m))) return 'Your Spotify account isn’t on Norne’s list yet. Ask Jack to add your Spotify email in the Spotify dashboard (User Management).';
  if (e && e.reason === 'PREMIUM_REQUIRED' || /premium/i.test(m)) return 'Spotify says this account needs Premium to play music here.';
  if (e && e.reason === 'NO_ACTIVE_DEVICE' || (s === 404 && /device/i.test(m))) return MOBILE ? 'Open the Spotify app on this phone and play any song for a second, then come back to Norne.' : 'No Spotify player found. Pick one under “Play on”.';
  if (s === 429) return 'Spotify asked Norne to slow down. It tries again in a moment.';
  if (s === 401) return 'Spotify isn’t linked on this device.';
  return 'Spotify: ' + m;
}
async function hello(){
  try { const p = await api('GET', '/me'); S.me = {name:p.display_name || p.id, premium:p.product === 'premium'}; rerender(); sdkLoad();
    /* opened again while listening (or while the GM's music plays): pick up where things are */
    if (S.join) soon(follow, 300); if (S.live) soon(gmPoll, 300); }
  catch(e) { S.me = {err:why(e)}; rerender(); }
}

/* ---------- this computer as a Spotify speaker (Web Playback SDK) ---------- */
let PLAYER = null, SDK_ASKED = false;
function sdkLoad(){
  if (MOBILE || SDK_ASKED || !mu.linked()) return; SDK_ASKED = true;
  window.onSpotifyWebPlaybackSDKReady = () => {
    PLAYER = new window.Spotify.Player({name:'Norne', getOAuthToken:cb => token().then(t => t && cb(t)), volume:.8});
    PLAYER.addListener('ready', ({device_id}) => { S.sdkDev = device_id; S.sdkFail = ''; rerender(); if (S.join) follow(); });
    PLAYER.addListener('not_ready', () => { S.sdkDev = null; rerender(); });
    PLAYER.addListener('initialization_error', ({message}) => { S.sdkFail = 'This browser can’t play Spotify inside Norne (' + message + '). Pick your Spotify app under “Play on”.'; rerender(); });
    PLAYER.addListener('authentication_error', () => { refresh(); });
    PLAYER.addListener('account_error', () => { S.sdkFail = 'Spotify says this account needs Premium to play music in Norne.'; rerender(); });
    PLAYER.addListener('autoplay_failed', () => { S.need = 'tap'; rerender(); });
    PLAYER.addListener('player_state_changed', () => { if (S.live && N.G && N.G.role === 'gm') soon(gmPoll, 500); });
    PLAYER.connect();
  };
  const s = document.createElement('script'); s.src = 'https://sdk.scdn.co/spotify-player.js'; s.async = true;
  s.onerror = () => { S.sdkFail = 'Spotify’s player didn’t load. Check the connection, or pick your Spotify app under “Play on”.'; rerender(); };
  document.head.appendChild(s);
}
/* browsers only let a page make sound after a tap: call this inside the tap */
function wake(){ if (PLAYER && PLAYER.activateElement) { try { PLAYER.activateElement(); } catch(e) {} S.sdkOn = true; if (S.need === 'tap') S.need = ''; } }

/* ---------- which Spotify speaker plays ---------- */
async function devices(){ const j = await api('GET', '/me/player/devices'); S.devs = (j && j.devices || []).filter(d => d.id); return S.devs; }
async function device(){
  if (S.dev === 'sdk' || (!S.dev && !MOBILE && S.sdkDev)) { if (S.sdkDev) return {id:S.sdkDev, name:'Norne (this computer)', sdk:true, supports_volume:true}; if (S.dev === 'sdk') return null; }
  const list = await devices().catch(() => S.devs || []);
  const pick = (S.dev && S.dev !== 'sdk' && list.find(d => d.id === S.dev))
    || list.find(d => d.is_active && !d.is_restricted)
    || (MOBILE && list.find(d => d.type === 'Smartphone' && !d.is_restricted))
    || list.find(d => !d.is_restricted && d.id !== S.sdkDev) || null;
  return pick;
}
const playBody = (d, pos) => d.ctx && !/:artist:/.test(d.ctx) ? {context_uri:d.ctx, offset:{uri:d.track}, position_ms:Math.max(0, Math.round(pos))} : {uris:[d.track], position_ms:Math.max(0, Math.round(pos))};
/* where the GM's song is now, by the clock */
const posNow = d => d.on ? d.pos + Math.max(0, Date.now() - d.t) : d.pos;

/* ---------- listening: make this device's Spotify match music/<chat> ---------- */
let FOLLOWING = false, FOLLOWED = false, LAST_VOL = null, SHUF_DONE = '';
async function follow(){
  if (FOLLOWING || !S.join || !mu.linked() || document.hidden) return;
  const d = S.docs[S.join];
  FOLLOWING = true;
  try {
    const dev = await device();
    if (!dev) { if (d && d.on) { S.need = 'device'; rerender(); } return; }
    if (S.need === 'device') { S.need = ''; rerender(); }
    const st = await api('GET', '/me/player').catch(() => null);
    const here = st && st.device && st.device.id === dev.id ? st : null;
    if (!d || !d.track) { if (here && here.is_playing && FOLLOWED) await api('PUT', '/me/player/pause?device_id=' + dev.id).catch(() => {}); FOLLOWED = false; return; }
    if (!d.on) { if (here && here.is_playing) await api('PUT', '/me/player/pause?device_id=' + dev.id); FOLLOWED = true; return; }
    const want = posNow(d), same = here && here.item && here.item.uri === d.track;
    /* progress_ms is where the song was when Spotify answered (timestamp is only when it last changed) */
    const theirs = here ? here.progress_ms || 0 : 0;
    /* the GM's copy is older than the song: the playlist moved on by itself, and so did everyone else's */
    const ran = d.dur && want > d.dur + 1500;
    if (ran && here && here.is_playing && here.context && here.context.uri === d.ctx) return;
    if (!(same && here.is_playing && Math.abs(theirs - want) < 3500)) {
      if (SHUF_DONE !== dev.id) { SHUF_DONE = dev.id; await api('PUT', '/me/player/shuffle?state=false&device_id=' + dev.id).catch(() => {}); }
      await api('PUT', '/me/player/play?device_id=' + dev.id, playBody(d, ran ? 0 : want));
    }
    FOLLOWED = true;
    vol(dev, d);
    if (S.note && Date.now() - S.noteT > 4000 && /Spotify|Open the Spotify/.test(S.note)) { S.note = ''; rerender(); }
  } catch(e) { msg(why(e)); }
  finally { FOLLOWING = false; }
}
/* the GM's volume, times this person's own */
function vol(dev, d){
  const want = Math.round((d.vol == null ? 100 : d.vol) * S.myVol / 100), k = dev.id + ':' + want;
  if (LAST_VOL === k) return; LAST_VOL = k;
  if (dev.sdk && PLAYER) PLAYER.setVolume(want / 100).catch(() => {});
  else if (dev.supports_volume) api('PUT', '/me/player/volume?volume_percent=' + want + '&device_id=' + dev.id).catch(() => {});
}
function join(ch){
  wake();
  S.join = ch; ls.set(LS_JOIN, ch); FOLLOWED = false; LAST_VOL = null;
  if (!MOBILE) sdkLoad();
  rerender(); follow();
}
function leave(quiet){
  const was = S.join; S.join = null; ls.set(LS_JOIN, null);
  if (was && FOLLOWED) device().then(dev => dev && api('PUT', '/me/player/pause?device_id=' + dev.id)).catch(() => {});
  FOLLOWED = false; if (!quiet) rerender();
}

/* ---------- the GM: play, pause, skip, and tell everyone ---------- */
const W = (ch, d) => N.muWrite ? N.muWrite(ch, d) : (S.docs[ch] = d, Promise.resolve());
let LAST_PUB = null;
/* read the GM's own Spotify and write music/<live chat> if something really changed */
async function gmPoll(force){
  if (!S.live || !mu.linked() || !N.G || N.G.role !== 'gm') return;
  const st = await api('GET', '/me/player').catch(e => { if (force) msg(why(e)); return undefined; });
  if (st === undefined) return;
  const cur = S.docs[S.live];
  if (!st || !st.item) return;
  const it = st.item, now = Date.now(), pos = st.progress_ms || 0;
  const ctx = st.context && st.context.uri || (cur && cur.ctx) || '';
  const next = {
    ctx, cn:ctx === (cur && cur.ctx) ? cur.cn || '' : ctxName(ctx), cp:ctx === (cur && cur.ctx) ? cur.cp || '' : '',
    track:it.uri, tn:it.name || '', ta:(it.artists || []).map(a => a.name).join(', '), art:(it.album && it.album.images && (it.album.images[it.album.images.length - 1] || {}).url) || '',
    dur:it.duration_ms || 0, pos:Math.round(pos), t:now, on:!!st.is_playing, vol:cur && cur.vol != null ? cur.vol : 70, by:'gm',
  };
  const moved = !cur || cur.track !== next.track || cur.on !== next.on || cur.ctx !== next.ctx || Math.abs(posNow(cur) - pos) > 2500;
  if (!force && !moved) return;
  if (next.ctx !== (cur && cur.ctx) && !next.cn) next.cn = await ctxLookup(next.ctx);
  LAST_PUB = next; S.docs[S.live] = next; rerender();
  W(S.live, next).catch(e => msg('Norne couldn’t share the music (' + (e.code || e.message) + ').'));
}
const ctxName = ctx => { const l = (S.lists || []).find(p => p.uri === ctx); return l ? l.name : ''; };
async function ctxLookup(ctx){
  const m = /^spotify:(playlist|album):([A-Za-z0-9]+)$/.exec(ctx || ''); if (!m) return '';
  try { const j = await api('GET', `/${m[1]}s/${m[2]}?fields=name,images`); return j && j.name || ''; } catch(e) { return ''; }
}
/* a Spotify link or spotify: address -> {kind, id, uri} */
mu.parse = s => {
  const x = String(s || '').trim();
  const m = /^spotify:(playlist|album|track|artist):([A-Za-z0-9]{10,})$/.exec(x) || /^https?:\/\/open\.spotify\.com\/(?:intl-[a-z-]+\/)?(?:user\/[^/]+\/)?(playlist|album|track|artist)\/([A-Za-z0-9]{10,})/i.exec(x);
  return m ? {kind:m[1].toLowerCase(), id:m[2], uri:`spotify:${m[1].toLowerCase()}:${m[2]}`} : null;
};
async function gmStart(v, ch, it){
  try {
    if (S.live && S.live !== ch) { const old = S.live; W(old, null).catch(() => {}); delete S.docs[old]; }
    S.live = ch; ls.set(LS_LIVE, ch);
    wake();
    const dev = await device();
    if (!dev) { S.need = 'device'; msg(why({reason:'NO_ACTIVE_DEVICE'})); return; }
    await api('PUT', '/me/player/shuffle?state=false&device_id=' + dev.id).catch(() => {});
    await api('PUT', '/me/player/play?device_id=' + dev.id, it.kind === 'track' ? {uris:[it.uri]} : {context_uri:it.uri});
    if (it.name) S.docs[ch] = {...(S.docs[ch] || {}), cn:it.name, cp:it.pic || '', ctx:it.kind === 'track' ? '' : it.uri};
    vol(dev, {vol:(S.docs[ch] && S.docs[ch].vol) ?? 70});
    msg('');
    setTimeout(() => gmPoll(true), 900);
  } catch(e) { msg(why(e)); }
}
async function gmCmd(cmd){
  const d = S.docs[S.live];
  try {
    const dev = await device(); if (!dev) { S.need = 'device'; msg(why({reason:'NO_ACTIVE_DEVICE'})); return; }
    const q = '?device_id=' + dev.id;
    if (cmd === 'pause') await api('PUT', '/me/player/pause' + q);
    else if (cmd === 'play') { wake(); if (d && d.track) await api('PUT', '/me/player/play' + q, playBody(d, posNow(d))); else await api('PUT', '/me/player/play' + q); }
    else if (cmd === 'next') await api('POST', '/me/player/next' + q);
    else if (cmd === 'prev') await api('POST', '/me/player/previous' + q);
    setTimeout(() => gmPoll(true), 700);
  } catch(e) { msg(why(e)); }
}
function gmVol(x){
  const d = S.docs[S.live]; if (!d) return;
  const n = {...d, vol:Math.max(0, Math.min(100, Math.round(x)))};
  S.docs[S.live] = n; LAST_VOL = null; rerender();
  device().then(dev => dev && vol(dev, n)).catch(() => {});
  W(S.live, n).catch(() => {});
}
function gmStop(){
  const ch = S.live; if (!ch) return;
  device().then(dev => dev && api('PUT', '/me/player/pause?device_id=' + dev.id)).catch(() => {});
  delete S.docs[ch]; S.live = null; ls.set(LS_LIVE, null); W(ch, null).catch(() => {}); rerender();
}
async function loadLists(){
  if (S.listsBusy) return; S.listsBusy = true; rerender();
  try {
    let url = '/me/playlists?limit=50', all = [];
    for (let i = 0; url && i < 4; i++) { const j = await api('GET', url); all = all.concat((j.items || []).filter(Boolean)); url = j.next ? j.next.replace(API, '') : null; }
    S.lists = all.map(p => ({uri:p.uri, name:p.name, pic:(p.images && p.images.length ? (p.images[p.images.length - 1] || p.images[0]).url : ''), n:p.items ? p.items.total : p.tracks ? p.tracks.total : null}));
  } catch(e) { msg(why(e)); }
  S.listsBusy = false; rerender();
}

/* ---------- timers: listeners re-check every 15 s, the GM's device reads its Spotify every 4 s, both only on screen ---------- */
const T = {};
function soon(f, ms){ clearTimeout(T[f.name]); T[f.name] = setTimeout(f, ms); }
setInterval(() => { if (!document.hidden && S.join) follow(); }, 15000);
setInterval(() => { if (!document.hidden && S.live) gmPoll(); }, 4000);
document.addEventListener('visibilitychange', () => { if (!document.hidden) { if (S.join) soon(follow, 400); if (S.live) soon(gmPoll, 400); } });

/* ---------- from sync.js ---------- */
mu.cfgLoad = d => { S.cfg = d || {ids:[]}; rerender(); };
mu.load = (ch, d) => {
  const was = S.docs[ch];
  if (d) S.docs[ch] = d; else delete S.docs[ch];
  if (ch === S.join && JSON.stringify(was) !== JSON.stringify(d)) soon(follow, 250);
  rerender();
};
mu.denied = () => { S.denied = true; rerender(); };
/* every draw: listen to the music of the chats this person is in (cheap when nothing changed) */
let WKEY = '';
mu.tick = v => {
  if (!N.muWatch || !N.channelsFor) return;
  const chs = N.channelsFor(v.role).filter(c => c !== 'gm');
  const k = v.role + '|' + chs.join(',');
  if (k === WKEY) return;
  if (N.muWatch(chs) !== false) WKEY = k;
  if (S.openSheet && !v.ui.sheet) { S.openSheet = false; v.ui.sheet = 'music'; setTimeout(() => N.render(v), 0); }
};
const prevRender = N.onRender;
N.onRender = v => { if (prevRender) prevRender(v); try { mu.tick(v); } catch(e) { console.warn('music', e); } };
if (mu.linked()) setTimeout(hello, 1500);

/* ---------- drawing ---------- */
const nowLine = d => d && d.track ? `<b>${esc(d.tn || 'A song')}</b>${d.ta ? ` <span class="mu-a">· ${esc(d.ta)}</span>` : ''}` : '<b>Music</b>';
const art = (d, big) => d && d.art ? `<img class="mu-art${big ? ' big' : ''}" src="${esc(d.art)}" alt="" loading="lazy">` : `<span class="mu-art${big ? ' big' : ''} none">${IC('music')}</span>`;
const B = (cmd, label, ic, extra = '', k = '') => `<button type="button" class="ibtn mu-c" data-a="mu" data-v="${cmd}"${k ? ` data-k="${esc(k)}"` : ''} aria-label="${label}" title="${label}"${extra}>${IC(ic)}</button>`;
/* the chat's top bar button: everyone sees it where music is set; the GM sees it in every chat */
mu.topBtn = v => {
  const ch = v.ui.ch; if (!mu.on(v, ch)) return '';
  const d = S.docs[ch]; if (!isGM(v) && !d && S.join !== ch) return '';
  return `<button type="button" class="ibtn mu-btn${d && d.on ? ' playing' : ''}" data-a="mu" data-v="toggle" aria-pressed="${v.ui.sheet === 'music'}" aria-label="Music" title="Music">${IC('music')}</button>`;
};
/* the strip above the chat while music is set for it */
mu.bar = v => {
  const ch = v.ui.ch, d = S.docs[ch]; if (!d || !d.track || !mu.on(v, ch)) return '';
  const gm = isGM(v), me = S.join === ch;
  const sub = gm ? (S.live === ch ? (d.cn ? 'From ' + esc(d.cn) : 'Your music for this chat') : 'Set from another device') : me ? (d.on ? 'You’re listening' : 'Paused by the GM') : 'The GM is playing music here';
  const ctl = gm && S.live === ch
    ? `${B('prev', 'Previous song', 'prev')}${d.on ? B('pause', 'Pause for everyone', 'pause') : B('play', 'Play for everyone', 'play')}${B('next', 'Next song', 'next')}`
    : gm ? `<button type="button" class="btn sm" data-a="mu" data-v="take">Control here</button>`
    : !mu.linked() ? `<button type="button" class="btn sm gold" data-a="mu" data-v="toggle">Listen</button>`
    : me && S.need === 'tap' ? `<button type="button" class="btn sm gold" data-a="mu" data-v="join" data-k="${esc(ch)}">${IC('play')}Tap to hear it</button>`
    : me ? `<button type="button" class="btn sm" data-a="mu" data-v="leave" title="Stop listening">${IC('check')}Listening</button>`
    : `<button type="button" class="btn sm gold" data-a="mu" data-v="join" data-k="${esc(ch)}">${IC('play')}Join</button>`;
  const warn = (me || (gm && S.live === ch)) && S.need === 'device' ? `<span class="mu-warn">${MOBILE ? 'Open Spotify on this phone once' : 'Pick a player under Music'}</span>` : '';
  return `<div class="fightbar mubar${d.on ? ' on' : ''}">${art(d)}<button type="button" class="t mu-t" data-a="mu" data-v="toggle">${nowLine(d)}<span>${sub}${warn ? ' · ' + warn : ''}</span></button>${ctl}</div>`;
};
const devName = d => d.sdk ? 'Norne on this computer' : d.name + (d.type ? ` · ${d.type === 'Smartphone' ? 'phone' : d.type === 'Computer' ? 'computer' : d.type.toLowerCase()}` : '');
function devPick(){
  const list = (S.devs || []).filter(d => d.id !== S.sdkDev);
  const opts = [...(!MOBILE && S.sdkDev ? [{id:'sdk', sdk:true}] : []), ...list];
  const cur = S.dev || (MOBILE ? '' : S.sdkDev ? 'sdk' : '');
  return `<div class="mu-devs">${opts.length ? opts.map(d => `<button type="button" class="mu-dev" data-a="mu" data-v="dev" data-k="${esc(d.id)}" aria-pressed="${cur === d.id || (!cur && d.is_active)}">${IC(d.sdk || d.type === 'Computer' ? 'monitor' : d.type === 'Smartphone' ? 'phone' : 'music')}<span>${esc(devName(d))}${d.is_active && !d.sdk ? '<small>Playing now</small>' : ''}</span></button>`).join('')
    : `<p class="muted mu-p">${MOBILE ? 'No Spotify found yet. Open the Spotify app on this phone, play any song for a second, then tap Look again.' : S.sdkFail ? esc(S.sdkFail) : 'Starting the Norne player…'}</p>`}
    <div class="row" style="gap:8px;flex-wrap:wrap"><button type="button" class="btn sm ghost" data-a="mu" data-v="devs">${IC('undo')}Look again</button>${MOBILE ? `<a class="btn sm ghost" href="spotify:" rel="noopener">${IC('music')}Open Spotify</a>` : ''}</div></div>`;
}
function setupHtml(v){
  const ids = mu.ids();
  return `<div class="mu-setup"><h4>Spotify setup<small>${isGM(v) ? 'Only you and Jack see this' : 'Only you and the GM see this'}</small></h4>
    <p class="muted mu-p">Paste the <b>Client ID</b> from the Spotify app in the Spotify dashboard. Spotify lets one app have only 5 people, so a second app can be added for more people.</p>
    ${ids.map((x, i) => `<div class="row mu-id"><code>${esc(x.id.slice(0, 6))}…${esc(x.id.slice(-4))}</code><span>${esc(x.label || 'Spotify app ' + (i + 1))}</span><button type="button" class="btn sm ghost" data-a="mu" data-v="cidDel" data-k="${i}">${IC('trash')}Remove</button></div>`).join('')}
    <div class="row" style="gap:8px"><input class="inp" id="mucid-${v.id}" data-i="muCid" placeholder="Client ID (32 letters and numbers)" value="${esc(v.ui.muCid || '')}" autocomplete="off" spellcheck="false" style="flex:1;min-width:0"><button type="button" class="btn sm" data-a="mu" data-v="cidAdd">${IC('plus')}Add</button></div>
    <p class="muted mu-p">Redirect URI to paste into the Spotify app: <code class="mu-uri">${esc(mu.redirect())}</code> <button type="button" class="btn sm ghost" data-a="mu" data-v="copyUri">${IC('copy')}Copy</button></p></div>`;
}
let DEVS_ASKED = false;
mu.title = () => 'Music';
mu.html = v => {
  const gm = isGM(v), ch = v.ui.ch, d = mu.on(v, ch) ? S.docs[ch] : null, ids = mu.ids(), canSet = gm || (N.isJack && N.isJack());
  const note = S.note ? `<div class="note mu-note">${IC('info')}<span>${esc(S.note)}</span></div>` : '';
  if (S.denied) return `<div class="note">${IC('warn')}<span>Music needs the new Firebase rules. Jack: paste the new firestore.rules into Firebase and press Publish.</span></div>`;
  /* not linked yet */
  if (!mu.linked()) {
    const link = ids.length ? (ids.length === 1 ? `<button type="button" class="btn primary lg" data-a="mu" data-v="link" data-k="${esc(ids[0].id)}"${S.busy ? ' disabled' : ''}>${IC('link')}${S.busy ? 'Linking…' : 'Link Spotify'}</button>`
      : `<p class="muted mu-p">Pick the one Jack added your Spotify email to:</p><div class="row" style="gap:8px;flex-wrap:wrap">${ids.map((x, i) => `<button type="button" class="btn primary" data-a="mu" data-v="link" data-k="${esc(x.id)}">${IC('link')}${esc(x.label || 'Spotify app ' + (i + 1))}</button>`).join('')}</div>`)
      : `<p class="muted mu-p">${canSet ? 'Add the Spotify Client ID below first.' : 'Jack hasn’t finished setting up Spotify yet.'}</p>`;
    return `${note}${d && d.track ? `<div class="mu-now">${art(d, true)}<span>${nowLine(d)}<small>${d.cn ? 'From ' + esc(d.cn) : ''}</small></span></div>` : ''}
      <p class="mu-lead">Hear the GM’s music while you play. Link your Spotify Premium once, then tap <b>Join</b> in a chat with music.</p>
      ${link}
      <p class="muted mu-p">${MOBILE ? 'On a phone the music plays in your Spotify app, so keep Spotify installed. Norne tells it what to play.' : 'On a computer the music plays right here in Norne.'}</p>
      ${canSet ? setupHtml(v) : ''}`;
  }
  if (!S.devs && !DEVS_ASKED) { DEVS_ASKED = true; devices().then(rerender).catch(() => {}); }
  const meLine = S.me ? (S.me.err ? `<span class="mu-err">${esc(S.me.err)}</span>` : `Linked as <b>${esc(S.me.name)}</b>${S.me.premium ? '' : ' · <span class="mu-err">not Premium</span>'}`) : 'Linked';
  const playing = d && d.track ? `<div class="mu-now">${art(d, true)}<span>${nowLine(d)}<small>${d.on ? 'Playing' : 'Paused'}${d.cn ? ' · from ' + esc(d.cn) : ''}</small></span></div>` : '';
  /* the GM's controls */
  let gmPart = '';
  if (gm && mu.on(v, ch)) {
    const mine = S.live === ch, q = v.ui.muLink || '', lists = S.lists;
    gmPart = `<div class="mu-gm"><h4>Music in ${esc(N.chName(ch, v.role))}<small>Everyone in this chat who joins hears it</small></h4>
      ${d && mine ? `<div class="mu-ctl">${B('prev', 'Previous song', 'prev')}${d.on ? B('pause', 'Pause for everyone', 'pause', ' style="--s:52px"') : B('play', 'Play for everyone', 'play', ' style="--s:52px"')}${B('next', 'Next song', 'next')}</div>
        <label class="mu-vol"><span>Volume for everyone</span><input type="range" min="0" max="100" step="5" value="${d.vol ?? 70}" data-i="muVol" aria-label="Volume for everyone"><b>${d.vol ?? 70}</b></label>
        <button type="button" class="btn sm ghost" data-a="mu" data-v="stop">${IC('mstop')}Stop the music in this chat</button>`
        : d && !mine ? `<button type="button" class="btn sm" data-a="mu" data-v="take">Control it from this device</button>` : ''}
      ${S.live && S.live !== ch ? `<p class="muted mu-p">Your music is playing in ${esc(N.chName(S.live, v.role))}. Starting it here stops it there.</p>` : ''}
      <div class="row mu-paste" style="gap:8px"><input class="inp" id="mul-${v.id}" data-i="muLink" placeholder="Paste a Spotify playlist, album or song link" value="${esc(q)}" autocomplete="off" spellcheck="false" style="flex:1;min-width:0"><button type="button" class="btn sm gold" data-a="mu" data-v="playLink"${mu.parse(q) && mu.parse(q).kind !== 'artist' ? '' : ' disabled'}>${IC('play')}Play</button></div>
      <h4>Your playlists</h4>
      ${lists ? (lists.length ? `<div class="mu-lists">${lists.map((p, i) => `<button type="button" class="mu-pl${d && d.ctx === p.uri ? ' on' : ''}" data-a="mu" data-v="playList" data-k="${i}">${p.pic ? `<img src="${esc(p.pic)}" alt="" loading="lazy">` : `<span class="none">${IC('music')}</span>`}<span><b>${esc(p.name)}</b>${p.n != null ? `<small>${p.n} songs</small>` : ''}</span>${IC('play')}</button>`).join('')}</div>` : '<p class="muted mu-p">No playlists on this Spotify account yet.</p>')
        : `<button type="button" class="btn sm" data-a="mu" data-v="lists"${S.listsBusy ? ' disabled' : ''}>${S.listsBusy ? 'Loading…' : 'Show my playlists'}</button>`}
    </div>`;
  }
  /* a player's part */
  const me = S.join === ch;
  const listen = !gm && d && d.track ? `<div class="row" style="gap:8px;flex-wrap:wrap">${me ? `<button type="button" class="btn" data-a="mu" data-v="leave">${IC('mstop')}Stop listening</button>` : `<button type="button" class="btn primary" data-a="mu" data-v="join" data-k="${esc(ch)}">${IC('play')}Join the music</button>`}</div>` : !gm && !d ? `<p class="muted mu-p">No music in this chat right now.${S.join ? ` You’re listening in ${esc(N.chName(S.join, v.role))}.` : ''}</p>` : '';
  const myVol = `<label class="mu-vol"><span>My volume</span><input type="range" min="0" max="100" step="5" value="${S.myVol}" data-i="muMyVol" aria-label="My volume"><b>${S.myVol}</b></label>`;
  return `${note}${playing}${listen}${gmPart}
    <div><h4>Play on<small>Which Spotify plays the music on this device</small></h4>${devPick()}</div>
    ${!MOBILE || (S.devs || []).some(x => x.supports_volume) ? myVol : `<p class="muted mu-p">Use your phone’s volume buttons for the loudness.</p>`}
    <div class="mu-acct"><span>${meLine}</span><button type="button" class="btn sm ghost" data-a="mu" data-v="unlink">Unlink</button></div>
    ${canSet ? `<details class="mu-more"><summary>Spotify setup</summary>${setupHtml(v)}</details>` : ''}`;
};

/* ---------- taps and typing ---------- */
mu.act = (v, el) => {
  const ui = v.ui, c = el.dataset.v, k = el.dataset.k;
  switch (c) {
    case 'toggle': ui.pop = null; if (ui.sheet === 'music') ui.sheet = null; else { ui.sheet = 'music'; if (mu.linked() && !S.devs) devices().then(rerender).catch(() => {}); } break;
    case 'link': mu.link(k); return;
    case 'unlink': mu.unlink(); break;
    case 'join': join(k || ui.ch); return;
    case 'leave': leave(); return;
    case 'devs': S.devs = null; devices().then(() => { rerender(); if (S.join) follow(); }).catch(e => msg(why(e))); break;
    case 'dev': S.dev = k; ls.set(LS_DEV, k); LAST_VOL = null; SHUF_DONE = ''; if (k === 'sdk') wake(); if (S.join) { FOLLOWED = false; follow(); } if (S.live) gmCmd('play'); break;
    case 'lists': loadLists(); return;
    case 'playList': { const p = (S.lists || [])[+k]; if (p) gmStart(v, ui.ch, {kind:'playlist', uri:p.uri, name:p.name, pic:p.pic}); break; }
    case 'playLink': { const p = mu.parse(ui.muLink); if (p && p.kind !== 'artist') { gmStart(v, ui.ch, p); ui.muLink = ''; } break; }
    case 'play': case 'pause': case 'next': case 'prev': gmCmd(c); break;
    case 'stop': gmStop(); break;
    case 'take': { const old = S.live; S.live = ui.ch; ls.set(LS_LIVE, ui.ch); if (old && old !== ui.ch) { W(old, null).catch(() => {}); delete S.docs[old]; } wake(); gmPoll(true); break; }
    case 'cidAdd': { const id = String(ui.muCid || '').trim(); if (!/^[0-9a-f]{32}$/i.test(id)) { msg('That doesn’t look like a Client ID. It is 32 letters and numbers, shown under the app’s name in the Spotify dashboard.'); return; }
      const ids = mu.ids().filter(x => x.id !== id).concat([{id, label:'Spotify app ' + (mu.ids().length + 1)}]);
      ui.muCid = ''; S.cfg = {ids}; (N.muCfgWrite ? N.muCfgWrite({ids}) : Promise.resolve()).then(() => msg('Saved. Everyone can link Spotify now.')).catch(e => msg('Couldn’t save it (' + (e.code || e.message) + ').')); break; }
    case 'cidDel': { const ids = mu.ids().filter((x, i) => i !== +k).map((x, i) => ({...x, label:'Spotify app ' + (i + 1)})); S.cfg = {ids}; if (N.muCfgWrite) N.muCfgWrite({ids}).catch(() => {}); break; }
    case 'copyUri': try { navigator.clipboard.writeText(mu.redirect()); msg('Copied the Redirect URI.'); } catch(e) {} return;
  }
  N.render(v);
};
mu.input = (v, el, i) => {
  if (i === 'muLink') { v.ui.muLink = el.value; const b = v.root.querySelector('[data-a="mu"][data-v="playLink"]'); if (b) { const p = mu.parse(el.value); b.disabled = !(p && p.kind !== 'artist'); } return; }
  if (i === 'muCid') { v.ui.muCid = el.value; return; }
  if (i === 'muVol' || i === 'muMyVol') { const b = el.parentNode.querySelector('b'); if (b) b.textContent = el.value; }
};
mu.change = (v, el, i) => {
  if (i === 'muVol') gmVol(+el.value);
  if (i === 'muMyVol') { S.myVol = +el.value; ls.set(LS_MYVOL, String(S.myVol)); LAST_VOL = null; const d = S.docs[S.join || S.live]; if (d) device().then(dev => dev && vol(dev, d)).catch(() => {}); }
};
})();
