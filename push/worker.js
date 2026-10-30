/* Norne's push sender, a Cloudflare Worker (free plan).
   Norne posts {pushes:[{sub, title, body, ch}]} here when someone writes in a chat. The Worker encrypts each
   one for that phone or computer and hands it to the phone maker's push service (Apple, Google, Mozilla),
   which wakes the device even with Norne closed. It keeps nothing.

   Web Push (RFC 8030), message encryption (RFC 8291, aes128gcm) and VAPID sign-in (RFC 8292),
   written with the browser crypto built into Workers so the file has no other parts.

   VAPID_PRIVATE is the private half of the key pair whose public half is PUSH_KEY in js/notify.js.
   The copy pasted into Cloudflare has it filled in; this public copy never does. */
const VAPID_PRIVATE = '__VAPID_PRIVATE__';
const VAPID_PUBLIC = 'BPBQEPocVuzUeY2Gg4qvIO4lHIHL01dm3k6y8Q66WXHywkVi0emkNE6XL5xB1TO4ncJAssCUg2B1HDTA_6mep_Y';
const SUBJECT = 'https://narwhals99.github.io/norne/';
/* pages allowed to ask for a push */
const ORIGINS = ['https://narwhals99.github.io'];
const LOCAL = /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/;

const enc = new TextEncoder();
const b64u = b => btoa(String.fromCharCode(...new Uint8Array(b))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const unb64u = s => Uint8Array.from(atob(s.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - s.length % 4) % 4)), c => c.charCodeAt(0));
const cat = (...a) => { const o = new Uint8Array(a.reduce((n, x) => n + x.length, 0)); let i = 0; for (const x of a) { o.set(x, i); i += x.length; } return o; };
const subtle = crypto.subtle;

let signKey = null;
function vapidKey(){
  if (!signKey) {
    const pub = unb64u(VAPID_PUBLIC);
    signKey = subtle.importKey('jwk', {kty:'EC', crv:'P-256', d:VAPID_PRIVATE, x:b64u(pub.slice(1, 33)), y:b64u(pub.slice(33, 65)), ext:true},
      {name:'ECDSA', namedCurve:'P-256'}, false, ['sign']);
  }
  return signKey;
}
/* a signed note telling the push service who is sending, good for 12 hours */
async function vapid(endpoint){
  const head = b64u(enc.encode(JSON.stringify({typ:'JWT', alg:'ES256'})));
  const body = b64u(enc.encode(JSON.stringify({aud:new URL(endpoint).origin, exp:Math.floor(Date.now() / 1000) + 12 * 3600, sub:SUBJECT})));
  const sig = await subtle.sign({name:'ECDSA', hash:'SHA-256'}, await vapidKey(), enc.encode(head + '.' + body));
  return `vapid t=${head}.${body}.${b64u(sig)}, k=${VAPID_PUBLIC}`;
}
async function hkdf(salt, ikm, info, bytes){
  const k = await subtle.importKey('raw', ikm, 'HKDF', false, ['deriveBits']);
  return new Uint8Array(await subtle.deriveBits({name:'HKDF', hash:'SHA-256', salt, info}, k, bytes * 8));
}
/* RFC 8291: only the device that made the subscription can read the message */
async function encrypt(sub, text){
  const uaPub = unb64u(sub.keys.p256dh), auth = unb64u(sub.keys.auth);
  const mine = await subtle.generateKey({name:'ECDH', namedCurve:'P-256'}, true, ['deriveBits']);
  const asPub = new Uint8Array(await subtle.exportKey('raw', mine.publicKey));
  const theirs = await subtle.importKey('raw', uaPub, {name:'ECDH', namedCurve:'P-256'}, false, []);
  const shared = new Uint8Array(await subtle.deriveBits({name:'ECDH', public:theirs}, mine.privateKey, 256));
  const ikm = await hkdf(auth, shared, cat(enc.encode('WebPush: info\0'), uaPub, asPub), 32);
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const cek = await hkdf(salt, ikm, enc.encode('Content-Encoding: aes128gcm\0'), 16);
  const nonce = await hkdf(salt, ikm, enc.encode('Content-Encoding: nonce\0'), 12);
  const key = await subtle.importKey('raw', cek, 'AES-GCM', false, ['encrypt']);
  const sealed = new Uint8Array(await subtle.encrypt({name:'AES-GCM', iv:nonce}, key, cat(enc.encode(text), new Uint8Array([2]))));
  return cat(salt, new Uint8Array([0, 0, 16, 0]), new Uint8Array([asPub.length]), asPub, sealed);
}
async function send(p){
  const {sub} = p;
  if (!sub || typeof sub.endpoint !== 'string' || !/^https:\/\//.test(sub.endpoint) || !sub.keys?.p256dh || !sub.keys?.auth) return 'bad';
  const text = JSON.stringify({title:String(p.title || 'Norne').slice(0, 120), body:String(p.body || '').slice(0, 600), ch:String(p.ch || '').slice(0, 40)});
  const r = await fetch(sub.endpoint, {method:'POST', body:await encrypt(sub, text), headers:{
    Authorization:await vapid(sub.endpoint), 'Content-Encoding':'aes128gcm', 'Content-Type':'application/octet-stream', TTL:'86400', Urgency:'high'}});
  /* 404 and 410: that device turned notifications off or the browser was removed */
  return r.status === 404 || r.status === 410 ? 'gone' : r.ok ? 'ok' : 'err ' + r.status;
}

export default {
  async fetch(req){
    const origin = req.headers.get('Origin') || '';
    const okOrigin = ORIGINS.includes(origin) || LOCAL.test(origin);
    const cors = {'Access-Control-Allow-Origin':okOrigin ? origin : ORIGINS[0], 'Access-Control-Allow-Methods':'POST, OPTIONS', 'Access-Control-Allow-Headers':'Content-Type', Vary:'Origin'};
    const out = (body, status=200) => new Response(JSON.stringify(body), {status, headers:{...cors, 'Content-Type':'application/json'}});
    if (req.method === 'OPTIONS') return new Response(null, {status:204, headers:cors});
    if (req.method === 'GET') return out({norne:'push', ready:!VAPID_PRIVATE.startsWith('__')});
    if (req.method !== 'POST' || !okOrigin) return out({error:'not allowed'}, 403);
    let d; try { d = await req.json(); } catch(e) { return out({error:'bad request'}, 400); }
    const list = Array.isArray(d?.pushes) ? d.pushes.slice(0, 60) : [];
    const res = await Promise.all(list.map(p => send(p).catch(e => 'err ' + (e?.message || e))));
    return out({res, gone:list.filter((p, i) => res[i] === 'gone').map(p => p.sub.endpoint)});
  },
};
