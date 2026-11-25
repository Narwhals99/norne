/* Norne: read the text out of a document the GM picks (Jake, 2026-11-25: "Import lore" inside one wiki entry).
   Word files (.docx) are zip files; the text sits in word/document.xml. The browser unzips it itself (DecompressionStream),
   so nothing is sent anywhere. Plain .txt and .md files are read as they are.
   N.readDoc(file) gives the document as sections: [{h, text}], a new section at each heading (Word's Heading/Title
   styles, or # lines in Markdown). Text before the first heading is a section without a heading. */
(function(){
  const u16 = (b, i) => b[i] | b[i + 1] << 8, u32 = (b, i) => (b[i] | b[i + 1] << 8 | b[i + 2] << 16 | b[i + 3] << 24) >>> 0;
  async function unzipOne(buf, want){
    const b = new Uint8Array(buf);
    let e = b.length - 22; while (e >= 0 && u32(b, e) !== 0x06054b50) e--;
    if (e < 0) throw new Error('not a zip');
    let p = u32(b, e + 16); const n = u16(b, e + 10), dec = new TextDecoder();
    for (let k = 0; k < n; k++) {
      if (u32(b, p) !== 0x02014b50) break;
      const how = u16(b, p + 10), size = u32(b, p + 20), nl = u16(b, p + 28), xl = u16(b, p + 30), cl = u16(b, p + 32), at = u32(b, p + 42);
      const name = dec.decode(b.subarray(p + 46, p + 46 + nl));
      if (name === want) {
        const start = at + 30 + u16(b, at + 26) + u16(b, at + 28), raw = b.subarray(start, start + size);
        if (how === 0) return dec.decode(raw);
        const s = new Blob([raw]).stream().pipeThrough(new DecompressionStream('deflate-raw'));
        return await new Response(s).text();
      }
      p += 46 + nl + xl + cl;
    }
    throw new Error('no ' + want);
  }
  const W = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main';
  function docxSections(xml){
    const d = new DOMParser().parseFromString(xml, 'application/xml'), out = [{h:'', lines:[]}];
    for (const p of d.getElementsByTagNameNS(W, 'p')) {
      const st = p.getElementsByTagNameNS(W, 'pStyle')[0]?.getAttributeNS(W, 'val') || p.getElementsByTagNameNS(W, 'pStyle')[0]?.getAttribute('w:val') || '';
      let t = '';
      const walk = el => { for (const c of el.childNodes) { if (c.nodeType !== 1) continue; const ln = c.localName;
        if (ln === 't') t += c.textContent; else if (ln === 'tab') t += ' '; else if (ln === 'br' || ln === 'cr') t += '\n'; else if (ln !== 'pPr' && ln !== 'rPr') walk(c); } };
      walk(p); t = t.replace(/[ \t]+/g, ' ').trim();
      if (!t) { out[out.length - 1].lines.push(''); continue; }
      if (/^(heading|title|subtitle)/i.test(st) || /^berschrift|^titre/i.test(st)) { out.push({h:t.slice(0, 80), lines:[]}); continue; }
      const np = p.getElementsByTagNameNS(W, 'numPr')[0], lv = np ? +(np.getElementsByTagNameNS(W, 'ilvl')[0]?.getAttributeNS(W, 'val') || np.getElementsByTagNameNS(W, 'ilvl')[0]?.getAttribute('w:val') || 0) : -1;
      out[out.length - 1].lines.push(lv < 0 ? t : {lv, t});
    }
    for (const x of out) x.lines = flatLists(x.lines);
    return out;
  }
  /* Jake's notes are nested bullet lists. A top-level bullet with bullets under it reads as a small heading ("Boroughs:"),
     the next level as a bullet, and anything deeper joins its bullet after a colon ("District 6: Forkborough; ...") */
  function flatLists(ls){
    const out = [];
    for (let i = 0; i < ls.length; i++) {
      const l = ls[i]; if (typeof l === 'string') { out.push(l); continue; }
      const kids = []; let j = i + 1; while (j < ls.length && typeof ls[j] === 'object' && ls[j].lv > l.lv) kids.push(ls[j++]);
      const base = Math.min(...[l.lv, ...ls.slice(0, i).filter(x => typeof x === 'object').map(x => x.lv)]);
      if (l.lv === base && kids.length) { out.push('', l.t.replace(/:$/, '') + ':'); continue; }
      const deep = l.lv > base;
      if (deep && kids.length) { out.push('- ' + l.t.replace(/:$/, '') + ': ' + kids.map(k => k.t).join('; ')); i = j - 1; continue; }
      out.push('- ' + l.t);
    }
    return out;
  }
  function textSections(s){
    const out = [{h:'', lines:[]}];
    for (const l of String(s).replace(/\r\n?/g, '\n').split('\n')) { const m = l.match(/^#{1,4}\s+(.+)/);
      if (m) out.push({h:m[1].trim().slice(0, 80), lines:[]}); else out[out.length - 1].lines.push(l.replace(/^\s*[*•]\s+/, '- ').trimEnd()); }
    return out;
  }
  /* list lines stay together; other lines become their own paragraphs (a blank line between) */
  const tidy = secs => secs.map(x => ({h:x.h, text:x.lines.reduce((a, l, i, all) => { if (!l) return a.endsWith('\n\n') || !a ? a : a.replace(/\n?$/, '\n\n');
    const sep = !a || a.endsWith('\n\n') ? '' : l.startsWith('- ') && (all[i - 1]?.startsWith('- ') || /:$/.test(all[i - 1] || '')) ? '\n' : '\n\n'; return a + sep + l; }, '').trim()})).filter(x => x.h || x.text);
  N.readDoc = async f => {
    const name = String(f.name || ''), buf = await f.arrayBuffer();
    if (/\.docx$/i.test(name) || (new Uint8Array(buf)[0] === 0x50 && new Uint8Array(buf)[1] === 0x4b)) return tidy(docxSections(await unzipOne(buf, 'word/document.xml')));
    return tidy(textSections(new TextDecoder().decode(buf)));
  };
})();
