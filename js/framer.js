/* Norne: the framing editor.
   Every picture a player or the GM uploads (portraits, backgrounds, wiki pictures, emoji) opens here first: drag to
   move it, pinch / wheel / the slider to zoom, so it fits the box it is shown in. Adjust buttons open it again later.
   The answer is a frame {x, y, z[, r]} (see N.picFrame in core.js). Only emoji are cut to it; every other picture is
   kept whole and shown through the frame, so it can be reframed any time.
   It lives outside the app's own markup, so a redraw (a new chat line, a sync) can't close it halfway through a drag. */
(function(){
const N = window.N, {esc, IC} = N;
const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
const ZMAX = 5;
/* the box each kind of picture is shown in */
const KINDS = {
  face:  {r:1, round:true, title:'Frame the portrait', hint:'Drag to move, pinch or scroll to zoom. The circle is what everyone sees.'},
  emoji: {r:1, title:'Frame the emoji', hint:'Drag to move, pinch or scroll to zoom. The square becomes the emoji.'},
  bg:    {r:3/2, title:'Frame the background', hint:'Drag to move, pinch or scroll to zoom. The box is the battle board; the scene banner shows the middle strip.'},
  wiki:  {title:'Frame the picture', hint:'Pick a shape, then drag to move and pinch or scroll to zoom.'},
};
const WSHAPES = [['whole', 'Whole picture'], ['1', 'Square'], ['1.6', 'Wide'], ['0.75', 'Tall']];
/* where the image sits inside a w×h box for frame f: the same maths the browser does for
   object-fit/background-size:cover + position x% y% + scale(z) around x% y% */
const place = (iw, ih, w, h, f) => {
  const s = Math.max(w / iw, h / ih), W = iw * s * f.z, H = ih * s * f.z;
  return {W, H, l:f.x / 100 * (w - W), t:f.y / 100 * (h - H)};
};
/* which x keeps the picture point under p (box px) in place when the zoom changes */
const keep = (p, l, W, W2, w, x) => { const q = (p - l) / W, d = w - W2; return Math.abs(d) < .5 ? x : clamp((p - q * W2) / d * 100, 0, 100); };

N.frameEdit = (v, o) => {
  /* o: {url, kind, frame, onSave(frame), save:'Use this picture'} */
  const K = KINDS[o.kind] || KINDS.bg, img = new Image();
  img.onload = () => open(v, o, K, img);
  img.onerror = () => N.toast(v, 'That picture couldn’t be opened.');
  img.src = o.url;
};
function open(v, o, K, img){
  const iw = img.naturalWidth, ih = img.naturalHeight, whole = iw / ih;
  const f0 = o.frame || {x:50, y:o.kind === 'face' ? 30 : 50, z:1};
  const f = {x:f0.x, y:f0.y, z:f0.z, r:o.kind === 'wiki' ? (f0.r || whole) : K.r};
  const shapeOf = r => (WSHAPES.find(([k]) => k !== 'whole' && Math.abs(+k - r) < .01) || ['whole'])[0];
  let shape = o.kind === 'wiki' ? shapeOf(f.r) : null;
  const host = document.createElement('div');
  host.className = 'app frhost';
  for (const k of ['theme', 'style', 'dev', 'role']) if (v.root.dataset[k] != null) host.dataset[k] = v.root.dataset[k];
  const prev = o.kind === 'face' ? `<div class="fr-prev"><span>Chat</span><span class="av" style="--s:36px;--c:var(--gold)"><img alt=""></span><span>Card</span><span class="av" style="--s:72px;--c:var(--gold)"><img alt=""></span></div>`
    : o.kind === 'bg' ? `<div class="fr-prev wide"><span>Scene banner</span><div class="fr-ban"><i class="pic"></i></div><span>Chip</span><div class="fr-chip"><i class="pic"></i></div></div>` : '';
  host.innerHTML = `<div class="scrim"></div><div class="sheet framer" role="dialog" aria-modal="true" aria-label="${esc(K.title)}">
    <div class="sh-h"><h2 class="ttl">${esc(K.title)}</h2><button type="button" class="ibtn" data-f="x" aria-label="Close">${IC('x')}</button></div>
    <div class="sh-b">
      ${o.kind === 'wiki' ? `<div class="seg fr-shapes" role="group" aria-label="Shape">${WSHAPES.map(([k, l]) => `<button type="button" data-f="shape" data-v="${k}" aria-pressed="${shape === k}">${l}</button>`).join('')}</div>` : ''}
      <div class="fr-stage" tabindex="0" aria-label="Picture. Drag to move it, use the arrow keys to nudge and plus or minus to zoom."><img class="fr-img" alt="" draggable="false"><div class="fr-win${K.round ? ' round' : ''}"></div></div>
      <div class="fr-zoom"><button type="button" class="ibtn sm" data-f="out" aria-label="Zoom out">${IC('minus')}</button><input type="range" min="1" max="${ZMAX}" step="0.01" value="${f.z}" aria-label="Zoom"><button type="button" class="ibtn sm" data-f="in" aria-label="Zoom in">${IC('plus')}</button></div>
      <p class="fr-hint">${esc(K.hint)}</p>
      ${prev}
    </div>
    <div class="sh-f"><button type="button" class="btn ghost" data-f="reset" style="flex:0 0 auto">${IC('undo')}Reset</button><button type="button" class="btn ghost" data-f="x">Cancel</button><button type="button" class="btn primary" data-f="ok">${IC('check')}${esc(o.save || 'Save framing')}</button></div>
  </div>`;
  (v.root.parentElement || document.body).appendChild(host);
  const $ = s => host.querySelector(s), stage = $('.fr-stage'), win = $('.fr-win'), pic = $('.fr-img'), range = $('input[type=range]');
  pic.src = img.src;
  host.querySelectorAll('.fr-prev img').forEach(e => e.src = img.src);
  host.querySelectorAll('.fr-prev .pic').forEach(e => e.style.backgroundImage = `url(${img.src})`);
  let box = {w:1, h:1, ox:0, oy:0};
  const layout = () => {
    const sw = stage.clientWidth, sh = stage.clientHeight, pad = 22;
    const w = Math.min(sw - pad * 2, (sh - pad * 2) * f.r), h = w / f.r;
    box = {w, h, ox:(sw - w) / 2, oy:(sh - h) / 2};
    Object.assign(win.style, {left:box.ox + 'px', top:box.oy + 'px', width:w + 'px', height:h + 'px'});
    draw();
  };
  const draw = () => {
    const p = place(iw, ih, box.w, box.h, f);
    Object.assign(pic.style, {left:box.ox + p.l + 'px', top:box.oy + p.t + 'px', width:p.W + 'px', height:p.H + 'px'});
    range.value = f.z;
    const css = `object-position:${f.x}% ${f.y}%;transform:scale(${f.z});transform-origin:${f.x}% ${f.y}%`;
    host.querySelectorAll('.fr-prev img').forEach(e => e.style.cssText = css);
    host.querySelectorAll('.fr-prev .pic').forEach(e => Object.assign(e.style, {backgroundPosition:`${f.x}% ${f.y}%`, transform:`scale(${f.z})`, transformOrigin:`${f.x}% ${f.y}%`}));
  };
  /* move the picture by dx, dy screen px */
  const pan = (dx, dy) => {
    const p = place(iw, ih, box.w, box.h, f), ox = p.W - box.w, oy = p.H - box.h;
    if (ox > .5) f.x = clamp(f.x - dx / ox * 100, 0, 100);
    if (oy > .5) f.y = clamp(f.y - dy / oy * 100, 0, 100);
  };
  /* zoom to z, keeping the picture point under (px, py) (box px) where it is */
  const zoomTo = (z, px = box.w / 2, py = box.h / 2) => {
    z = clamp(z, 1, ZMAX); const a = place(iw, ih, box.w, box.h, f), b = place(iw, ih, box.w, box.h, {...f, z});
    f.x = keep(px, a.l, a.W, b.W, box.w, f.x); f.y = keep(py, a.t, a.H, b.H, box.h, f.y); f.z = z;
  };
  const local = e => { const r = stage.getBoundingClientRect(); return [e.clientX - r.left - box.ox, e.clientY - r.top - box.oy]; };
  const pts = new Map(); let pinch = null;
  stage.addEventListener('pointerdown', e => {
    stage.setPointerCapture(e.pointerId); pts.set(e.pointerId, [e.clientX, e.clientY]);
    if (pts.size === 2) { const [a, b] = [...pts.values()]; pinch = {d:Math.hypot(a[0] - b[0], a[1] - b[1]), z:f.z, m:[(a[0] + b[0]) / 2, (a[1] + b[1]) / 2]}; }
  });
  stage.addEventListener('pointermove', e => {
    const was = pts.get(e.pointerId); if (!was) return;
    pts.set(e.pointerId, [e.clientX, e.clientY]);
    if (pts.size === 1) pan(e.clientX - was[0], e.clientY - was[1]);
    else if (pinch && pts.size === 2) {
      const [a, b] = [...pts.values()], m = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
      pan(m[0] - pinch.m[0], m[1] - pinch.m[1]); pinch.m = m;
      const [px, py] = local({clientX:m[0], clientY:m[1]});
      zoomTo(pinch.z * Math.hypot(a[0] - b[0], a[1] - b[1]) / (pinch.d || 1), px, py);
    }
    draw();
  });
  const up = e => { pts.delete(e.pointerId); if (pts.size < 2) pinch = null; };
  stage.addEventListener('pointerup', up); stage.addEventListener('pointercancel', up);
  stage.addEventListener('wheel', e => { e.preventDefault(); const [px, py] = local(e); zoomTo(f.z * Math.exp(-e.deltaY * (e.ctrlKey ? .01 : .0015)), px, py); draw(); }, {passive:false});
  stage.addEventListener('keydown', e => {
    const st = e.shiftKey ? 40 : 10, k = e.key;
    if (k === 'ArrowLeft') pan(st, 0); else if (k === 'ArrowRight') pan(-st, 0); else if (k === 'ArrowUp') pan(0, st); else if (k === 'ArrowDown') pan(0, -st);
    else if (k === '+' || k === '=') zoomTo(f.z * 1.1); else if (k === '-') zoomTo(f.z / 1.1); else return;
    e.preventDefault(); draw();
  });
  range.addEventListener('input', () => { zoomTo(+range.value); draw(); });
  const close = () => { removeEventListener('resize', layout); removeEventListener('keydown', esc_); host.remove(); };
  const esc_ = e => { if (e.key === 'Escape') { e.stopPropagation(); close(); } };
  addEventListener('resize', layout); addEventListener('keydown', esc_);
  host.addEventListener('click', e => {
    const b = e.target.closest('[data-f]'); if (!b) { if (e.target.classList.contains('scrim')) close(); return; }
    const a = b.dataset.f;
    if (a === 'x') close();
    else if (a === 'in') { zoomTo(f.z * 1.25); draw(); }
    else if (a === 'out') { zoomTo(f.z / 1.25); draw(); }
    else if (a === 'reset') { Object.assign(f, {x:50, y:o.kind === 'face' ? 30 : 50, z:1}); draw(); }
    else if (a === 'shape') {
      shape = b.dataset.v; f.r = shape === 'whole' ? whole : +shape;
      host.querySelectorAll('[data-f="shape"]').forEach(x => x.setAttribute('aria-pressed', x === b));
      layout();
    }
    else if (a === 'ok') { close(); o.onSave({x:f.x, y:f.y, z:f.z, ...(o.kind === 'wiki' ? {r:f.r} : {})}); }
  });
  requestAnimationFrame(layout);
}
/* emoji are tiny and shown inline, so they are cut to their frame: the square, at up to 512px, transparent edges kept */
N.cropToFrame = (img, f, S=512) => {
  const iw = img.naturalWidth, ih = img.naturalHeight, n = Math.min(S, Math.max(iw, ih)), c = document.createElement('canvas'); c.width = c.height = n;
  const p = place(iw, ih, n, n, f); c.getContext('2d').drawImage(img, p.l, p.t, p.W, p.H);
  return c;
};
})();
