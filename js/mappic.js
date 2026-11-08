/* Map pictures that are kind to a phone's memory.

   iPhones close a page that uses too much memory ("A problem repeatedly occurred", or a quiet reload to the loading
   screen). The map tab used to be the worst of it:
   - every row of the maps dropdown and the little picture on the map button showed the WHOLE map picture
     (up to 3200 px) in a 40 px box, so opening the dropdown decoded every map at full size at once;
   - the map itself carried a colour filter (night, Parchment, Sketchbook). A filter on a picture that big is drawn into
     an extra full-size copy, and while the map moves it is its own GPU layer, so a drag or pinch made more full-size
     copies on top;
   - each picture was a data: address about a megabyte long, written into the page again on every redraw.

   Now each map gets small copies made once, one at a time:
   - N.mapThumb(src): a 160 px picture for the dropdown and the map button (kept on the device, so later visits skip it);
   - N.mapMid(src):   a 1280 px picture for a scene's place art in the chat;
   - N.mapBaked(src, key) / N.mapBake(src, key, filter, img): the full map with the style's colour already painted in, so the
     map on screen needs no filter at all. Until it is ready the map shows as before (with the filter). */
(function(){
  const LRU = 10;                  /* full-size baked maps kept (about 1 MB each as a file, decoded only while shown) */
  const THUMB = 160, MID = 1280;   /* longest side in px */
  const MAXPX = 8.4e6;             /* the biggest lore map is 7.5 million pixels; bigger ones are painted a little smaller */
  const thumbs = new Map(), mids = new Map(), baked = new Map(), want = new Set(), fails = new Map();
  const queue = []; let busy = false, redraw = 0;
  const idOf = src => N.picBase(src);
  const later = () => { clearTimeout(redraw); redraw = setTimeout(() => N.renderAll && N.renderAll(), 60); };
  const lsGet = k => { try { return localStorage.getItem(k); } catch(e) { return null; } };
  const lsSet = (k, val) => { try { localStorage.setItem(k, val); } catch(e) {} };
  /* a short name for a picture, for keys on the device: its id for database pictures, else a hash of its address */
  const tag = s => { if (s.startsWith('fs:')) return s.slice(3); let h = 0; for (let i = 0; i < s.length; i += Math.max(1, s.length >> 10)) h = (h * 31 + s.charCodeAt(i)) | 0; return s.length + '.' + (h >>> 0).toString(36); };

  function load(url){
    return new Promise((ok, no) => { const im = new Image(); im.decoding = 'async'; im.onload = () => ok(im); im.onerror = no; im.src = url; });
  }
  /* one picture at a time, so two big maps are never open in memory together */
  function run(){
    if (busy || !queue.length) return;
    busy = true; const job = queue.shift();
    Promise.resolve().then(job).catch(e => console.warn('map picture', e)).then(() => { busy = false; later(); setTimeout(run, 0); });
  }
  /* a small copy that fails is tried once more, then left alone for this visit: every try ends in a redraw, so a picture
     that can't be opened (a dead link, a broken file) used to be tried again after every redraw, for ever */
  const tries = new Map();
  function add(key, job){
    if (want.has(key) || (tries.get(key) || 0) >= 2) return;
    want.add(key); queue.push(() => job().catch(e => { tries.set(key, (tries.get(key) || 0) + 1); throw e; }).finally(() => want.delete(key))); run();
  }
  const free = c => { c.width = c.height = 0; };
  const blobOf = (c, q) => new Promise(ok => c.toBlob(b => ok(b), 'image/jpeg', q));

  function small(im, max){
    const k = Math.min(1, max / Math.max(im.naturalWidth, im.naturalHeight));
    const c = document.createElement('canvas'); c.width = Math.max(1, Math.round(im.naturalWidth * k)); c.height = Math.max(1, Math.round(im.naturalHeight * k));
    const x = c.getContext('2d'); x.fillStyle = '#fff'; x.fillRect(0, 0, c.width, c.height); x.drawImage(im, 0, 0, c.width, c.height);
    return c;
  }

  N.mapThumb = src => {
    if (!src) return '';
    const id = idOf(src); if (thumbs.has(id)) return thumbs.get(id);
    const u = N.imgUrl(src); if (!u) return '';
    const lk = 'norne-th:' + tag(id) + ':' + (u.length || 0), have = lsGet(lk);
    if (have) { thumbs.set(id, have); return have; }
    add('t' + id, () => load(u).then(im => { const c = small(im, THUMB), d = c.toDataURL('image/jpeg', .8); free(c); thumbs.set(id, d); lsSet(lk, d); }));
    return '';
  };

  N.mapMid = src => {
    if (!src) return '';
    const id = idOf(src); if (mids.has(id)) return mids.get(id);
    const u = N.imgUrl(src); if (!u) return '';
    add('m' + id, () => load(u).then(im => { const c = small(im, MID); return blobOf(c, .85).then(b => { free(c); if (b) mids.set(id, URL.createObjectURL(b)); }); }));
    return '';
  };

  /* CSS colour filters as colour matrices (the Filter Effects spec), combined into one: rgb' = M·rgb + o */
  const I = () => ({m:[1,0,0, 0,1,0, 0,0,1], o:[0,0,0]});
  function step(fn, a){
    const s = 1 - a;
    switch (fn) {
      case 'grayscale': return {m:[.2126+.7874*s,.7152-.7152*s,.0722-.0722*s, .2126-.2126*s,.7152+.2848*s,.0722-.0722*s, .2126-.2126*s,.7152-.7152*s,.0722+.9278*s], o:[0,0,0]};
      case 'sepia':     return {m:[.393+.607*s,.769-.769*s,.189-.189*s, .349-.349*s,.686+.314*s,.168-.168*s, .272-.272*s,.534-.534*s,.131+.869*s], o:[0,0,0]};
      case 'saturate':  return {m:[.213+.787*a,.715-.715*a,.072-.072*a, .213-.213*a,.715+.285*a,.072-.072*a, .213-.213*a,.715-.715*a,.072+.928*a], o:[0,0,0]};
      case 'brightness':return {m:[a,0,0, 0,a,0, 0,0,a], o:[0,0,0]};
      case 'contrast':  { const t = (.5 - .5 * a) * 255; return {m:[a,0,0, 0,a,0, 0,0,a], o:[t,t,t]}; }
    }
    return null;
  }
  /* B after A */
  function then(A, B){
    const m = [], o = [];
    for (let r = 0; r < 3; r++) {
      for (let c = 0; c < 3; c++) m[r*3+c] = B.m[r*3]*A.m[c] + B.m[r*3+1]*A.m[3+c] + B.m[r*3+2]*A.m[6+c];
      o[r] = B.m[r*3]*A.o[0] + B.m[r*3+1]*A.o[1] + B.m[r*3+2]*A.o[2] + B.o[r];
    }
    return {m, o};
  }
  /* "saturate(0.85) brightness(0.88)" -> one matrix, or null if the filter has anything else in it (a blur...) */
  N.mapMatrix = f => {
    f = String(f || '').trim(); if (!f || f === 'none') return I();
    let M = I(), ok = true;
    f.replace(/([a-z-]+)\(([^)]*)\)|(\S+)/g, (all, fn, arg) => {
      if (!fn) { ok = false; return all; }
      let a = parseFloat(arg); if (/%/.test(arg)) a /= 100; if (!isFinite(a)) a = 1;
      if (fn === 'grayscale' || fn === 'sepia') a = Math.min(1, Math.max(0, a));
      const S = step(fn, a); if (!S) ok = false; else M = then(M, S);
      return all;
    });
    return ok ? M : null;
  };
  N.mapBaked = (src, key) => baked.get(idOf(src) + '|' + key) || '';
  N.mapBake = (src, key, filter, el) => {
    const id = idOf(src), k = id + '|' + key; if (baked.has(k) || (fails.get(k) || 0) >= 2) return;
    const u = N.imgUrl(src), M = N.mapMatrix(filter); if (!u || !M) return;
    const plain = M.m.join() === '1,0,0,0,1,0,0,0,1' && !M.o[0] && !M.o[1] && !M.o[2];
    /* no colour change: a picture file stays as it is; a data: picture just becomes a short blob: address */
    if (plain && !u.startsWith('data:')) { baked.set(k, u); return; }
    if (plain) { add('b' + k, () => fetch(u).then(r => r.blob()).then(b => keep(k, b)).catch(e => { failed(k); throw e; })); return; }
    /* the picture already on screen is used when it has loaded, so the map isn't opened a second time */
    add('b' + k, () => (el && el.complete && el.naturalWidth && el.src === u ? Promise.resolve(el) : load(u)).then(im => {
      const w = im.naturalWidth, h = im.naturalHeight, f = Math.min(1, Math.sqrt(MAXPX / (w * h)));
      const c = document.createElement('canvas'); c.width = Math.round(w * f); c.height = Math.round(h * f);
      const x = c.getContext('2d', {willReadFrequently:true}); x.drawImage(im, 0, 0, c.width, c.height);
      /* an iPhone short of memory (often just after the app comes back from the background) can hand over a picture that
         draws as nothing. Saved as a JPEG, nothing is solid black, and the map showed black under its pins (Jack,
         2026-11-07). So look at a few spots first and keep the map as it was if the copy came out empty */
      if (empty(x, c.width, c.height)) { free(c); throw new Error('map drew empty'); }
      /* a band of rows at a time, so the pixels being changed are a few MB, not a second copy of the whole map */
      const m = M.m, o = M.o, W = c.width, H = c.height;
      for (let y = 0; y < H; y += 128) {
        const bh = Math.min(128, H - y), band = x.getImageData(0, y, W, bh), p = band.data;
        for (let i = 0; i < p.length; i += 4) {
          const r = p[i], g = p[i+1], b = p[i+2];
          p[i]   = m[0]*r + m[1]*g + m[2]*b + o[0];
          p[i+1] = m[3]*r + m[4]*g + m[5]*b + o[1];
          p[i+2] = m[6]*r + m[7]*g + m[8]*b + o[2];
        }
        x.putImageData(band, 0, y);
      }
      return blobOf(c, .9).then(b => { free(c); keep(k, b); });
    }).catch(e => { failed(k); throw e; }));
  };
  function empty(x, W, H){
    for (let i = 1; i < 6; i++) for (let j = 1; j < 6; j++) {
      if (x.getImageData(Math.floor(W * i / 6), Math.floor(H * j / 6), 1, 1).data[3]) return false;
    }
    return true;
  }
  /* a copy that failed is tried once more, then the map just keeps its CSS colour filter for this visit. (Without this a
     failed copy was tried again after every redraw, and every try redraws the page.) */
  function failed(k){ fails.set(k, (fails.get(k) || 0) + 1); }

  /* blob: copies live only in memory. When iOS clears memory while the app sits in the background, an address can die
     while the page lives on, and the map picture then fails to load and shows black. Any copy that fails to load, or
     no longer reads back when the app comes to the front, is dropped, so the next redraw shows the original map */
  function drop(url){
    let hit = false;
    for (const [k, u] of baked) if (u === url) { baked.delete(k); failed(k); hit = true; }
    for (const [k, u] of mids) if (u === url) { mids.delete(k); hit = true; }
    if (hit) later();
    return hit;
  }
  document.addEventListener('error', e => {
    const t = e.target;
    if (t && t.tagName === 'IMG' && String(t.getAttribute('src') || '').startsWith('blob:')) drop(t.getAttribute('src'));
  }, true);
  N.mapCheck = () => {
    const urls = [...new Set([...baked.values(), ...mids.values()])].filter(u => u.startsWith('blob:'));
    return Promise.all(urls.map(u => fetch(u).then(r => r.blob()).then(b => { if (!b || !b.size) throw 0; }).catch(() => drop(u))));
  };
  document.addEventListener('visibilitychange', () => { if (!document.hidden) N.mapCheck(); });
  addEventListener('pageshow', e => { if (e.persisted) N.mapCheck(); });
  function keep(k, b){
    if (!b) return;
    baked.set(k, URL.createObjectURL(b));
    /* keep only the newest few; an old style's copy is let go */
    while (baked.size > LRU) { const [old, url] = baked.entries().next().value; baked.delete(old); if (url.startsWith('blob:')) setTimeout(() => URL.revokeObjectURL(url), 5000); }
  }
})();
