/* Norne: notifications on this device. Each person turns them on in You > Notifications.
   With push (iPhone home-screen app, Android, computers): the device gives Norne a push address, kept in
   Firestore push/<device>. Whoever writes a message asks the push Worker (push/worker.js, on Cloudflare)
   to ping everyone else who can read it, so the ping arrives even with Norne closed.
   Without push (the Worker isn't set up yet, or an old browser), Norne pings itself for new messages,
   rolls and news while it is open but not in front. */
(function(){
const N = window.N;
const G = () => N.G;
const KEY = 'norne-notify';
/* the push Worker's address on Cloudflare, and the public half of its key (the private half lives only there) */
const PUSH_URL = '';
const PUSH_KEY = 'BPBQEPocVuzUeY2Gg4qvIO4lHIHL01dm3k6y8Q66WXHywkVi0emkNE6XL5xB1TO4ncJAssCUg2B1HDTA_6mep_Y';
const ios = /iP(hone|ad|od)/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
const standalone = () => matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
const canPush = () => !!PUSH_URL && 'serviceWorker' in navigator && 'PushManager' in window;
let reg = null, pushed = false;

const pref = () => { try { return localStorage.getItem(KEY) === '1'; } catch(e) { return false; } };
const setPref = on => { try { on ? localStorage.setItem(KEY, '1') : localStorage.removeItem(KEY); } catch(e) {} };
/* one id per browser, so each phone or computer keeps its own push address */
function devId(){
  let id = ''; try { id = localStorage.getItem('norne-dev') || ''; } catch(e) {}
  if (!id) { id = N.uid(); try { localStorage.setItem('norne-dev', id); } catch(e) {} }
  return id;
}
/* off, on, blocked (the browser said no), install (iPhone: add to the home screen first) or none (not supported) */
N.notifyState = () => {
  if (!('Notification' in window)) return ios && !standalone() ? 'install' : 'none';
  if (Notification.permission === 'denied') return 'blocked';
  return pref() && Notification.permission === 'granted' ? 'on' : 'off';
};
/* true once this device gets pings through push, even with Norne closed */
N.notifyPush = () => pushed;
function worker(){
  if (reg || !('serviceWorker' in navigator)) return Promise.resolve(reg);
  return navigator.serviceWorker.register('sw.js').then(r => (reg = r)).catch(() => null);
}
if (pref()) worker();

/* ask the browser for this device's push address and keep it where the others can find it */
async function subscribe(){
  if (!canPush() || !N.pushSave) return false;
  try {
    await worker(); const r = await navigator.serviceWorker.ready;
    const sub = await r.pushManager.getSubscription() || await r.pushManager.subscribe({userVisibleOnly:true, applicationServerKey:PUSH_KEY});
    await N.pushSave(devId(), sub.toJSON());
    return (pushed = true);
  } catch(e) { console.warn('push', e); return (pushed = false); }
}
async function unsubscribe(){
  pushed = false;
  try { const r = reg && await navigator.serviceWorker.ready, sub = r && await r.pushManager.getSubscription(); if (sub) await sub.unsubscribe(); } catch(e) {}
  if (N.pushSave) N.pushSave(devId(), null).catch(() => {});
}
/* once signed in: renew this device's push address, and open the chat a tapped notification pointed at */
N.notifyStart = () => {
  if (N.notifyState() === 'on') subscribe().then(() => N.renderAll());
  const ch = new URLSearchParams(location.search).get('open');
  if (ch) { openCh(ch); history.replaceState(null, '', location.pathname + location.search.replace(/[?&]open=[^&]*/, '').replace(/^&/, '?') + location.hash); }
};

function show(title, body, ch){
  const o = {body, tag:'norne-' + ch, icon:'img/icon-192.png', badge:'img/icon-192.png', data:{ch}};
  return worker().then(r => {
    if (r && r.showNotification) return r.showNotification(title, o);
    const n = new Notification(title, o); n.onclick = () => { window.focus(); openCh(ch); n.close(); };
  }).catch(() => {});
}
function openCh(ch){
  const v = N.views[0]; if (!v || !v.role || !ch) return;
  if (!N.channelsFor(v.role).includes(ch)) return;
  v.ui.tab = 'chat'; v.ui.ch = ch; v.ui.sheet = null; v.ui.stick = true; N.renderAll();
}
if ('serviceWorker' in navigator) navigator.serviceWorker.addEventListener('message', e => { if (e.data?.open) openCh(e.data.open); });

N.toggleNotify = v => {
  const st = N.notifyState();
  if (st === 'on') { setPref(false); unsubscribe(); N.toast(v, 'Notifications are off on this device.'); N.render(v); return; }
  if (st === 'install') { N.toast(v, 'On iPhone, tap Share > Add to Home Screen, open Norne from there, then turn this on.'); N.render(v); return; }
  if (st === 'none') { N.toast(v, 'This browser can’t show notifications.'); N.render(v); return; }
  if (st === 'blocked') { N.toast(v, 'Notifications are blocked for this site. Allow them in your browser’s site settings.'); N.render(v); return; }
  Notification.requestPermission().then(async p => {
    if (p !== 'granted') { N.toast(v, 'Notifications weren’t allowed.'); N.render(v); return; }
    setPref(true);
    const push = await subscribe();
    show('Norne', push ? 'Notifications are on. You’ll get a ping when something happens at the table, even with Norne closed.' : 'Notifications are on. You’ll get a ping when something happens at the table.', 'table');
    N.toast(v, 'Notifications are on for this device.'); N.render(v);
  });
};

/* what a new message says in a notification */
function line(m){
  const who = N.speakerObj(m).name;
  if (m.kind === 'roll') { const r = m.roll || {}; return `${r.who || who} rolled ${r.skill || 'the dice'}: ${N.sgn(N.rollTotal(r))} ${N.ladderWord(N.rollTotal(r))}`; }
  if (m.kind === 'news') return `New edition of the paper: ${m.text}`;
  if (m.kind === 'combat') return `A fight has begun: ${m.text}`;
  if (m.kind === 'scene') return m.scene?.title ? `New scene: ${m.scene.title}` : '';
  if (m.kind === 'sys') return m.text || '';
  return m.text ? `${who}: ${m.text}` : '';
}
const pings = ms => ms.length > 1 ? `${ms[ms.length - 1]} (+${ms.length - 1} more)` : ms[0];
const worth = m => !(m.kind === 'scene' && m.quiet);
/* without push: ping this device for messages from others while Norne is open but not in front */
N.notifyMsgs = list => {
  if (pushed || N.notifyState() !== 'on' || (!document.hidden && document.hasFocus())) return;
  const role = G().role;
  const mine = list.filter(m => m.by !== role && worth(m) && N.channelsFor(role).includes(m.ch));
  const byCh = {};
  for (const m of mine) { const t = line(m); if (t) (byCh[m.ch] = byCh[m.ch] || []).push(t); }
  for (const [ch, ts] of Object.entries(byCh)) show(`Norne · ${N.chName(ch, role)}`, pings(ts), ch);
};

/* with push: messages written on this device ping every other person who can read them.
   A roll and the line after it go out together, a moment after they are saved. */
let out = [], outT = 0;
N.pushOut = m => {
  if (!PUSH_URL || !worth(m)) return;
  out.push(m); clearTimeout(outT); outT = setTimeout(flush, 700);
};
function flush(){
  const list = out; out = [];
  const role = G().role, pushes = [];
  for (const d of N.PUSH || []) {
    const who = N.MEMBERS.find(x => x.uid === d.uid);
    if (d.role === role || !who || who.role !== d.role) continue;
    const byCh = {};
    for (const m of list) { if (!N.channelsFor(d.role).includes(m.ch)) continue; const t = line(m); if (t) (byCh[m.ch] = byCh[m.ch] || []).push(t); }
    for (const [ch, ts] of Object.entries(byCh)) pushes.push({sub:d.sub, title:`Norne · ${N.chName(ch, d.role)}`, body:pings(ts), ch});
  }
  if (!pushes.length) return;
  fetch(PUSH_URL, {method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({pushes})})
    .then(r => r.json()).then(r => { if (r.gone?.length && N.pushDrop) N.pushDrop(r.gone); })
    .catch(e => console.warn('push', e));
}
})();
