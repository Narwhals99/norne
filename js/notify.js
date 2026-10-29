/* Norne: notifications on this device. Each person turns them on in You > Notifications.
   They fire for new messages, rolls and news while Norne is open in a tab or on the home screen but not in front.
   (A ping with Norne fully closed would need a push server, which the free Firebase plan doesn't include.) */
(function(){
const N = window.N;
const G = () => N.G;
const KEY = 'norne-notify';
const ios = /iP(hone|ad|od)/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
const standalone = () => matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
let reg = null;

const pref = () => { try { return localStorage.getItem(KEY) === '1'; } catch(e) { return false; } };
const setPref = on => { try { on ? localStorage.setItem(KEY, '1') : localStorage.removeItem(KEY); } catch(e) {} };
/* off, on, blocked (the browser said no), install (iPhone: add to the home screen first) or none (not supported) */
N.notifyState = () => {
  if (!('Notification' in window)) return ios && !standalone() ? 'install' : 'none';
  if (Notification.permission === 'denied') return 'blocked';
  return pref() && Notification.permission === 'granted' ? 'on' : 'off';
};
function worker(){
  if (reg || !('serviceWorker' in navigator)) return Promise.resolve(reg);
  return navigator.serviceWorker.register('sw.js').then(r => (reg = r)).catch(() => null);
}
if (pref()) worker();

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
  if (st === 'on') { setPref(false); N.toast(v, 'Notifications are off on this device.'); N.render(v); return; }
  if (st === 'install') { N.toast(v, 'On iPhone, tap Share > Add to Home Screen, open Norne from there, then turn this on.'); N.render(v); return; }
  if (st === 'none') { N.toast(v, 'This browser can’t show notifications.'); N.render(v); return; }
  if (st === 'blocked') { N.toast(v, 'Notifications are blocked for this site. Allow them in your browser’s site settings.'); N.render(v); return; }
  Notification.requestPermission().then(p => {
    if (p !== 'granted') { N.toast(v, 'Notifications weren’t allowed.'); N.render(v); return; }
    setPref(true);
    show('Norne', 'Notifications are on. You’ll get a ping when something happens at the table.', 'table');
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
N.notifyMsgs = list => {
  if (N.notifyState() !== 'on' || (!document.hidden && document.hasFocus())) return;
  const role = G().role;
  const mine = list.filter(m => m.by !== role && !(m.kind === 'scene' && m.quiet) && N.channelsFor(role).includes(m.ch));
  const byCh = {};
  for (const m of mine) { const t = line(m); if (t) (byCh[m.ch] = byCh[m.ch] || []).push(t); }
  for (const [ch, ts] of Object.entries(byCh)) show(`Norne · ${N.chName(ch, role)}`, ts.length > 1 ? `${ts[ts.length - 1]} (+${ts.length - 1} more)` : ts[0], ch);
};
})();
