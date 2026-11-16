/* Earth zoom (a test, 2026-11-16): the maps as one continuous zoom, like Google Earth.

   The maps already hang together: a place pinned on one map opens the next map down (the world > a nation > a city,
   see N.pinTo). With Earth zoom on, each of those next maps is also DRAWN on its parent, as a small picture sitting on
   its pin. Zoom in on it and it grows and sharpens until it fills the screen and becomes the map you are on; zoom out
   past the edge of a map and you are back on the map above it, with this one shrinking into its place.

   Nothing is saved to the table and nothing is sent: where a map sits on its parent is worked out on the device.
   A map that is a closer drawing of part of its parent (every nation map is a piece of the world map) is FOUND on the
   parent by comparing the two pictures (earthMatch), so it lies exactly over the land it shows and detail simply
   sharpens as you zoom. A map in another style (a city plan) can't be found that way: it sits on its pin as a small
   framed picture, sized by how close the neighbouring places are. It is behind a switch in Profile that only
   Jack's account sees; everyone else has the maps exactly as before.

   This file is the arithmetic (which map hangs under which, and where). The moving parts are in js/app.js (earthStep,
   earthFly, clampT) and the pictures in mapPage (js/views.js). */
(function(){
  const N = window.N, clamp = N.clamp;
  let pref = false; try { pref = localStorage.getItem('norne-earth') === '1'; } catch(e) {}
/* when a map drawn on the open one takes over, and when it hands back, as how much of the screen it fills (1 = it
     just fits). A map found on its parent (fit) is the same land drawn closer, so the parent stays until you are well
     inside it and comes back as soon as you can see all of it. A framed city plan takes over while still inside the
     screen, and hands back once it is small again. */
  N.earthIn = c => c.fit ? 1.5 : .72;
  N.earthOutAt = c => c.fit ? .95 : .45;
  N.earthOk = () => !!N.EARTH_ALL || N.isJack();
  N.earthOn = () => pref && N.earthOk();
  N.earthSet = on => { pref = !!on; cache = null; try { if (pref) localStorage.setItem('norne-earth', '1'); else localStorage.removeItem('norne-earth'); } catch(e) {} };

  /* ---- the comparison ----
     find find where picture C (a smaller map) lies on picture P (the map above), near pin (px,py in 0..1).
     P, C: {w, h, d: Uint8 RGBA}. Returns {x, y, w, h, s} in fractions of P, s = likeness -1..1 */
  function earthMatch(P, C, rx, ry){
    const gray = (I) => { const o = new Float32Array(I.w * I.h * 3); for (let i = 0, j = 0; i < I.w * I.h; i++, j += 3) { o[j] = I.d[i*4]; o[j+1] = I.d[i*4+1]; o[j+2] = I.d[i*4+2]; } return o; };
    const Pd = gray(P), Cd = gray(C);
    /* C shrunk to cw x ch by averaging */
    const shrink = (cw, ch) => {
      const o = new Float32Array(cw * ch * 3);
      for (let y = 0; y < ch; y++) { const y0 = Math.floor(y * C.h / ch), y1 = Math.max(y0 + 1, Math.floor((y + 1) * C.h / ch));
        for (let x = 0; x < cw; x++) { const x0 = Math.floor(x * C.w / cw), x1 = Math.max(x0 + 1, Math.floor((x + 1) * C.w / cw));
          let r = 0, g = 0, b = 0, n = 0;
          for (let v = y0; v < y1; v++) for (let u = x0; u < x1; u++) { const k = (v * C.w + u) * 3; r += Cd[k]; g += Cd[k+1]; b += Cd[k+2]; n++; }
          const k = (y * cw + x) * 3; o[k] = r / n; o[k+1] = g / n; o[k+2] = b / n; } }
      return o;
    };
    let best = {s:-2};
    const tryAt = (cw, ch, xs, ys) => {
      if (cw < 6 || ch < 6 || cw > P.w || ch > P.h) return;
      const c = shrink(cw, ch), n = cw * ch * 3, st = Math.max(1, Math.floor(Math.sqrt(cw * ch / 500)));
      /* sample points and the small map's own mean and spread over them */
      const idx = []; for (let y = 0; y < ch; y += st) for (let x = 0; x < cw; x += st) idx.push(x, y);
      const m = idx.length / 2; let cm = [0,0,0];
      for (let i = 0; i < idx.length; i += 2) { const k = (idx[i+1] * cw + idx[i]) * 3; cm[0] += c[k]; cm[1] += c[k+1]; cm[2] += c[k+2]; }
      cm = cm.map(v => v / m); let cv = 0;
      for (let i = 0; i < idx.length; i += 2) { const k = (idx[i+1] * cw + idx[i]) * 3; for (let q = 0; q < 3; q++) cv += (c[k+q] - cm[q]) ** 2; }
      if (cv < 1) return;
      for (const y of ys) for (const x of xs) {
        if (x < 0 || y < 0 || x + cw > P.w || y + ch > P.h) continue;
        let pm0 = 0, pm1 = 0, pm2 = 0;
        for (let i = 0; i < idx.length; i += 2) { const k = ((y + idx[i+1]) * P.w + x + idx[i]) * 3; pm0 += Pd[k]; pm1 += Pd[k+1]; pm2 += Pd[k+2]; }
        pm0 /= m; pm1 /= m; pm2 /= m;
        let pv = 0, pc = 0;
        for (let i = 0; i < idx.length; i += 2) { const k = ((y + idx[i+1]) * P.w + x + idx[i]) * 3, j = (idx[i+1] * cw + idx[i]) * 3;
          const a0 = Pd[k] - pm0, a1 = Pd[k+1] - pm1, a2 = Pd[k+2] - pm2, b0 = c[j] - cm[0], b1 = c[j+1] - cm[1], b2 = c[j+2] - cm[2];
          pv += a0*a0 + a1*a1 + a2*a2; pc += a0*b0 + a1*b1 + a2*b2; }
        const s = pv < 1 ? -1 : pc / Math.sqrt(pv * cv);
        if (s > best.s) best = {s, x, y, cw, ch};
      }
    };
    const range = (a, b, st = 1) => { const o = []; for (let i = Math.ceil(a); i <= b; i += st) o.push(i); return o; };
    const px = rx * P.w, py = ry * P.h, asp = C.h / C.w;
    /* every size from a speck to most of the map, wherever the pin stays inside the picture */
    for (let f = .05; f <= .8; f *= 1.07) { const cw = Math.round(P.w * f), ch = Math.round(cw * asp), st = Math.max(1, Math.round(cw / 24));
      tryAt(cw, ch, range(px - cw * .92, px - cw * .08, st), range(py - ch * .92, py - ch * .08, st)); }
    if (best.s < -1) return null;
    /* then finer around the best */
    const b0 = {...best};
    for (let d = -3; d <= 3; d++) { const cw = b0.cw + d, ch = Math.round(cw * asp); const st0 = Math.max(1, Math.round(b0.cw / 24)); tryAt(cw, ch, range(b0.x - st0 - 2, b0.x + st0 + 2), range(b0.y - st0 - 2, b0.y + st0 + 2)); }
    return {x:best.x / P.w, y:best.y / P.h, w:best.cw / P.w, h:best.ch / P.h, s:best.s};
  }

  /* ---- finding a map on its parent, once per device ----
     Both pictures are read small (the parent 240 px, the map 96 px), compared, and the answer kept on the device.
     One at a time, and never while a finger is on the map. */
  const FIT_OK = .8;                 /* likeness needed to trust the place found (nation maps score .9 and up) */
  const fits = new Map(), asked = new Set(), pix = new Map(), jobs = [];
  let working = false, soon = false, cache = null;
  const fitKey = (m, k) => 'norne-ef1:' + N.picBase(m.src) + '>' + N.picBase(k.map.src) + '@' + k.pin.rx.toFixed(3) + ',' + k.pin.ry.toFixed(3);
  function pixels(src, max){
    const id = N.picBase(src) + '/' + max; if (pix.has(id)) return Promise.resolve(pix.get(id));
    const u = N.imgUrl(src); if (!u) return Promise.reject(new Error('not loaded'));
    return new Promise((ok, no) => { const im = new Image(); im.decoding = 'async'; im.onerror = no;
      im.onload = () => { const k = max / Math.max(im.naturalWidth, im.naturalHeight), c = document.createElement('canvas');
        c.width = Math.max(1, Math.round(im.naturalWidth * k)); c.height = Math.max(1, Math.round(im.naturalHeight * k));
        const x = c.getContext('2d', {willReadFrequently:true}); x.fillStyle = '#fff'; x.fillRect(0, 0, c.width, c.height); x.drawImage(im, 0, 0, c.width, c.height);
        const o = {w:c.width, h:c.height, d:x.getImageData(0, 0, c.width, c.height).data}; c.width = c.height = 0;
        if (max > 100) pix.set(id, o);   /* the parent's is used again for each of its maps */
        ok(o); };
      im.src = u; });
  }
  function work(){
    if (working || !jobs.length) return;
    if ((N.views || []).some(v => v._mapG || v._fly)) { setTimeout(work, 400); return; }
    working = true; const j = jobs.shift();
    Promise.all([pixels(j.m.src, 240), pixels(j.k.map.src, 96)]).then(([P, C]) => {
      const r = earthMatch(P, C, j.k.pin.rx, j.k.pin.ry), val = r && r.s >= FIT_OK ? {x:+r.x.toFixed(4), y:+r.y.toFixed(4), w:+r.w.toFixed(4)} : 0;
      fits.set(j.key, val); try { localStorage.setItem(j.key, JSON.stringify(val)); } catch(e) {}
      cache = null; clearTimeout(work.t); work.t = setTimeout(() => N.renderAll && N.renderAll(), 80);
    }).catch(() => { asked.delete(j.key); /* a picture not here yet: asked again on a later look */ })
      .then(() => { working = false; setTimeout(work, 60); });
  }
  /* where map k was found on m: {x, y, w} in fractions of m, 0 = looked and not found, undefined = not known yet */
  function fitOf(m, k){
    const key = fitKey(m, k); if (fits.has(key)) return fits.get(key);
    let have = null; try { have = localStorage.getItem(key); } catch(e) {}
    if (have != null) { let val = 0; try { val = JSON.parse(have) || 0; } catch(e) {} fits.set(key, val); return val; }
    if (!asked.has(key) && N.imgUrl(m.src) && N.imgUrl(k.map.src)) { asked.add(key); jobs.push({key, m, k}); setTimeout(work, 300); }
    else if (!asked.has(key)) soon = true;   /* pictures still loading: look again shortly */
    return undefined;
  }

  /* where each next map sits on its parent, in the parent's own pixels. Found by its picture if it can be (above);
     else centred on its pin, its longest side most of
     the way to the nearest neighbouring place that also has a map, within limits (a nation or region is a big piece of
     its map, a city or anything smaller a small one) */
  function place(m, list){
    const mn = Math.min(m.w, m.h);
    for (const k of list) {
      const f = fitOf(m, k), c = k.map;
      k.wait = f === undefined;
      if (f) { k.fit = true; k.w = f.w * m.w; k.s = k.w / c.w; k.h = c.h * k.s; k.x = f.x * m.w; k.y = f.y * m.h; }
    }
    for (const k of list) {
      if (k.fit) continue;
      const big = k.pin.type === 'nation' || k.pin.type === 'region';
      let near = Infinity;
      for (const o of list) if (o !== k && !o.fit) near = Math.min(near, Math.hypot((o.pin.rx - k.pin.rx) * m.w, (o.pin.ry - k.pin.ry) * m.h));
      const L = clamp(near === Infinity ? mn * (big ? .3 : .06) : near * .85, mn * (big ? .1 : .035), mn * (big ? .34 : .08));
      const c = k.map, s = L / Math.max(c.w, c.h);
      k.s = s; k.w = c.w * s; k.h = c.h * s; k.x = k.pin.rx * m.w - k.w / 2; k.y = k.pin.ry * m.h - k.h / 2;
    }
  }
  /* the maps as a tree, from the default (world) map down. Each map hangs under one map only: the first that reaches it */
  function tree(gm){
    const maps = N.G.maps.filter(m => (gm || m.vis !== false) && m.w && m.h);
    const sig = (gm ? 'g' : 'p') + maps.map(m => m.id + ':' + m.pins.length + ':' + m.w).join(',');
    if (cache && cache.sig === sig && Date.now() - cache.t < 4000) return cache;
    const up = new Map(), kids = new Map(), seen = new Set(), root = N.defMap(gm);
    for (const r of [root, ...maps]) {
      if (!r || !r.w || seen.has(r.id)) continue;
      seen.add(r.id); const q = [r];
      while (q.length) {
        const m = q.shift(), list = [];
        for (const p of m.pins) {
          if (p.type === 'party' || !(gm || p.vis)) continue;
          const to = N.pinTo(m, p), c = to && maps.find(x => x.id === to);
          if (!c || seen.has(c.id)) continue;
          seen.add(c.id); list.push({map:c, pin:p}); q.push(c);
        }
        place(m, list); kids.set(m.id, list);
        for (const k of list) up.set(k.map.id, {map:m, fp:k});
      }
    }
    cache = {sig, t:Date.now() - (soon ? 3400 : 0), up, kids}; soon = false;
    return cache;
  }
  /* the maps drawn on map m: [{map, pin, x, y, w, h, s, fit}] (s = parent pixels per pixel of the smaller map, fit = found
     by its picture). One whose place is still being looked for is left out until it is known */
  N.earthKids = (gm, m) => ((m && N.earthOn() && tree(gm).kids.get(m.id)) || []).filter(k => !k.wait);
  /* of the maps drawn on m, the one the middle of the screen is on (the nearest pin wins where they overlap), with how
     much of the screen it fills (1 = it just fits). T = the view {k, x, y}, b = the screen {w, h} */
  N.earthLead = (gm, m, T, b) => {
    let best = null, bd = Infinity;
    for (const c of N.earthKids(gm, m)) {
      const W = c.w * T.k, H = c.h * T.k, sx = T.x + c.x * T.k, sy = T.y + c.y * T.k;
      if (b.w / 2 < sx || b.w / 2 > sx + W || b.h / 2 < sy || b.h / 2 > sy + H) continue;
      const d = Math.hypot(T.x + c.pin.rx * m.w * T.k - b.w / 2, T.y + c.pin.ry * m.h * T.k - b.h / 2);
      if (d < bd) { bd = d; best = {c, fill:Math.max(W / b.w, H / b.h), sx, sy}; }
    }
    return best;
  };
  /* the map above m and where m sits on it: {map, fp:{x, y, w, h, s}}, or null for the top map */
  N.earthUp = (gm, m) => (m && N.earthOn() && tree(gm).up.get(m.id)) || null;
  /* how see-through a map drawn on its parent is, from its longest side on screen in px: nothing while it is a speck */
  N.earthFade = px => { const t = clamp((px - 30) / 110, 0, 1); return t * t * (3 - 2 * t); };
  /* its picture: the 160 px copy until it is big on screen (sharp = true), then the 1280 px one. Never the full map */
  N.earthPic = (src, sharp) => (sharp && N.mapMid(src)) || N.mapThumb(src);
})();
