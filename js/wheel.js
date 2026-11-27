/* Norne: the Encounter Wheel (Jake). The GM keeps one or more wheels of possible encounters (G.wheels, GM-only in gm/misc:
   [{id, name, items:[{id, t, w}]}], w = how many slices' worth it gets, 1 to 5) and spins one: secretly (the result goes to
   GM notes) or for the players (a spinning wheel card in the chat they're in). The card carries its own copy of the slices
   (m.wheel = {n, it:[[text, weight]], i:index won, r:degrees turned}), so later edits to the wheel don't change old spins. */
(function(){
const N = window.N, {esc, IC} = N;
const getRandom = crypto.getRandomValues.bind(crypto);
N.WHEEL_MS = 4200;
const rnd = () => { const a = new Uint32Array(1); getRandom(a); return a[0] / 4294967296; };
/* slice colours: hues spread round the circle, the same on every screen */
const hue = (i, n) => Math.round((i * 360 / Math.max(n, 1) + 18) % 360);
const pt = (r, deg) => { const a = (deg - 90) * Math.PI / 180; return [(r * Math.cos(a)).toFixed(2), (r * Math.sin(a)).toFixed(2)]; };
/* the wheel as an SVG: slices clockwise from the top, sized by weight, each with its words along the middle */
N.wheelSvg = (items, sz = 220) => {
  const L = items.filter(x => x[0]); const tot = L.reduce((a, x) => a + x[1], 0) || 1, R = 100;
  let a = 0;
  const parts = L.map(([t, w], i) => {
    const s = a, e = a + w / tot * 360; a = e; const mid = (s + e) / 2, big = e - s > 180 ? 1 : 0, [x0, y0] = pt(R, s), [x1, y1] = pt(R, e);
    const path = L.length === 1 ? `<circle r="${R}"/>` : `<path d="M0 0L${x0} ${y0}A${R} ${R} 0 ${big} 1 ${x1} ${y1}Z"/>`;
    const words = t.length > 18 ? t.slice(0, 17) + '…' : t, flip = mid > 180;
    return `<g class="wsl" style="--h:${hue(i, L.length)}">${path}<text transform="rotate(${(mid - 90 + (flip ? 180 : 0)).toFixed(1)}) translate(${flip ? -58 : 58} 0)" text-anchor="middle" dominant-baseline="middle">${esc(words)}</text></g>`;
  }).join('');
  return `<svg class="whsvg" viewBox="-104 -104 208 208" width="${sz}" height="${sz}" aria-hidden="true">${parts}<circle class="whrim" r="101"/><circle class="whhub" r="11"/></svg>`;
};
/* pick a slice by weight, and how far to turn so its middle (give or take) stops under the pointer at the top */
N.wheelSpin = items => {
  const L = items.filter(x => x[0]), tot = L.reduce((a, x) => a + x[1], 0); if (!L.length) return null;
  let k = rnd() * tot, i = 0; for (; i < L.length - 1; i++) { if (k < L[i][1]) break; k -= L[i][1]; }
  const s = L.slice(0, i).reduce((a, x) => a + x[1], 0) / tot * 360, e = s + L[i][1] / tot * 360, at = s + (e - s) * (.2 + rnd() * .6);
  return {i, r:Math.round((5 * 360 + 360 - at) * 10) / 10, it:L};
};
/* the card in the chat: it turns once when it arrives (each redraw carries the turn on from where it is) */
N.wheelCard = (m, gm) => {
  const w = m.wheel, it = w.it || [], won = it[w.i] ? it[w.i][0] : '?', age = Date.now() - (m.t || 0), spin = age < N.WHEEL_MS;
  const sty = `--r:${w.r}deg${spin ? `;animation-delay:-${Math.max(0, age)}ms` : ''}`;
  return `<div class="wheelm${spin ? ' spin' : ''}${m.ch === 'gm' ? ' secret' : ''}"><div class="wh-h">${IC('wheel')}<span><small>${m.ch === 'gm' ? 'Encounter wheel · secret spin' : 'Encounter wheel'}</small><b>${esc(w.n || 'Encounters')}</b></span></div>
    <div class="wh-w"><span class="wh-ptr"></span><div class="wh-rot" style="${sty}">${N.wheelSvg(it, 200)}</div></div>
    <div class="wh-res" style="${spin ? `animation-delay:${N.WHEEL_MS - age}ms` : ''}"><small>It lands on</small><b>${N.emoText ? N.emoText(N.marks(esc(won))) : esc(won)}</b></div></div>`;
};
})();
