/* =====================================================================
   NORNE — personal notes (Jack, 2026-11-18)
   Each playable character has their own notebook: folders ("Story notes", "Lore", "Need to know", ...) and notes in them.
   Only that character's player reads or writes it: not other players, not the GM (firestore.rules, notes/<seat>).
   Opened from the notes button in the chat's top bar (a sheet, in and out in one tap), or picked as a side panel.
   Stored in notes/<seat>: dirs = JSON list of folders, n_<id> = JSON of one note, so two devices writing
   different notes never overwrite each other. sync.js hands this file the document (N.pn.load) and a writer (N.pnWrite).
   ===================================================================== */
(function(){
const N = window.N, {esc, IC} = N;
const G = () => N.G, isGM = v => v.role === 'gm';
const pn = N.pn = {};
const DEF = ['Story notes', 'Lore', 'Need to know'];
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
/* the notebook of one seat: {dirs:[{id,name}], notes:{id:{id,dir,title,text,c,t}}, ready} */
const BOOK = {};
const book = s => BOOK[s] || (BOOK[s] = {dirs:[], notes:{}, ready:false});
pn.on = v => !isGM(v) && /^p\d+$/.test(v.role || '');
/* without the sync (offline harness) a notebook starts with the default folders, kept on this page only */
const local = () => !N.pnWrite;
function seed(b){ if (!b.dirs.length && !Object.keys(b.notes).length) b.dirs = DEF.map((name, i) => ({id:'d' + i + uid(), name})); }

/* ---------- saving: each note is its own field, written a moment after typing stops ---------- */
const PEND = {}, TIMERS = {};
function put(s, key, val){
  if (local()) return;
  (PEND[s] = PEND[s] || {})[key] = val;
  clearTimeout(TIMERS[s]); TIMERS[s] = setTimeout(() => flush(s), 700);
}
function flush(s){
  const p = PEND[s]; if (!p || !N.pnWrite) return; delete PEND[s]; clearTimeout(TIMERS[s]);
  N.pnWrite(s, p).catch(e => { console.warn('notes', e?.code); N.toastAll && N.toastAll('Your notes could not be saved. Check your connection.'); });
}
pn.flushAll = () => Object.keys(PEND).forEach(flush);
const saveDirs = s => put(s, 'dirs', JSON.stringify(book(s).dirs));
const saveNote = (s, n) => put(s, 'n_' + n.id, n ? JSON.stringify(n) : null);
const dropNote = (s, id) => put(s, 'n_' + id, null);

/* the document came in (or changed on another device). Fields still waiting to be written here win */
pn.load = (s, data, fromServer) => {
  const b = book(s), p = PEND[s] || {}, d = data || {};
  if (!('dirs' in p)) { try { b.dirs = d.dirs ? JSON.parse(d.dirs) : b.dirs; } catch(e) {} }
  const notes = {};
  for (const [k, j] of Object.entries(d)) if (k.startsWith('n_') && typeof j === 'string') { try { const n = JSON.parse(j); if (n && n.id) notes[n.id] = n; } catch(e) {} }
  for (const [k, val] of Object.entries(p)) if (k.startsWith('n_')) { const id = k.slice(2); if (val) notes[id] = b.notes[id]; else delete notes[id]; }
  b.notes = notes;
  /* a brand new notebook gets the three folders Jack named, saved once the server says it is really empty */
  if (fromServer && !data) { seed(b); saveDirs(s); }
  b.ready = true;
  N.renderAll && N.renderAll();
};

/* the server said no: almost always the new security rules aren't published yet */
pn.denied = s => { const b = book(s); b.denied = true; N.renderAll && N.renderAll(); };

/* ---------- reading ---------- */
const sorted = arr => arr.sort((a, b) => (b.t || 0) - (a.t || 0));
const inDir = (b, id) => sorted(Object.values(b.notes).filter(n => (id === '_' ? !n.dir || !b.dirs.some(d => d.id === n.dir) : n.dir === id)));
const when = t => { if (!t) return ''; const d = new Date(t), now = new Date();
  return d.toDateString() === now.toDateString() ? d.toLocaleTimeString([], {hour:'numeric', minute:'2-digit'}) : d.toLocaleDateString([], {month:'short', day:'numeric', ...(d.getFullYear() !== now.getFullYear() ? {year:'numeric'} : {})}); };
const firstLine = t => (t || '').split('\n').map(x => x.trim()).find(Boolean) || '';
const titleOf = n => (n.title || '').trim() || firstLine(n.text).slice(0, 60) || 'Untitled note';
const dirName = (b, id) => id === '_' ? 'No folder' : (b.dirs.find(d => d.id === id) || {}).name || 'No folder';
const count = k => `${k} note${k === 1 ? '' : 's'}`;
const matches = (n, q) => { q = q.toLowerCase(); return (n.title || '').toLowerCase().includes(q) || (n.text || '').toLowerCase().includes(q); };
/* the words around the first match, for a search result */
function around(text, q){
  const t = (text || '').replace(/\s+/g, ' '), i = t.toLowerCase().indexOf(q.toLowerCase());
  if (i < 0) return esc(t.slice(0, 90));
  const a = Math.max(0, i - 36), s = t.slice(a, i + q.length + 54);
  const j = i - a;
  return (a ? '…' : '') + esc(s.slice(0, j)) + '<mark>' + esc(s.slice(j, j + q.length)) + '</mark>' + esc(s.slice(j + q.length));
}

/* ---------- drawing ---------- */
const btn = (sub, k, inner, cls = '', extra = '') => `<button type="button" class="${cls}" data-a="pn" data-v="${sub}"${k != null ? ` data-k="${esc(k)}"` : ''}${extra}>${inner}</button>`;
function noteRow(v, b, n, q){
  return btn('open', n.id, `<span class="pn-nt"><b>${esc(titleOf(n))}</b><small>${esc(when(n.t))}</small></span>
    <span class="pn-np">${q ? around(n.text || n.title, q) : esc(firstLine((n.title || '').trim() ? n.text : (n.text || '').split('\n').slice(1).join('\n')).slice(0, 110)) || '<i>Empty</i>'}</span>${q ? `<span class="pn-nd">${IC('folder')}${esc(dirName(b, n.dir && b.dirs.some(d => d.id === n.dir) ? n.dir : '_'))}</span>` : ''}`, 'pn-note', v.ui.pnNote === n.id ? ' aria-current="true"' : '');
}
function dirRow(v, b, d, open){
  const k = inDir(b, d.id).length;
  return btn('dir', d.id, `<span class="pn-di">${IC('folder')}</span><span class="pn-dt"><b>${esc(d.name)}</b><small>${count(k)}</small></span>${IC('right')}`, 'pn-dir', open ? ' aria-current="true"' : '');
}
function newDirForm(v){
  if (v.ui.pnNewDir == null) return btn('newDir', null, `${IC('plus')}New folder`, 'pn-add');
  return `<form class="pn-form" onsubmit="return false"><input class="inp" id="${P}nd-${v.id}" data-i="pnDirName" value="${esc(v.ui.pnNewDir)}" placeholder="Folder name, like Story notes" maxlength="40" autocomplete="off" enterkeyhint="done" aria-label="New folder name">
    ${btn('makeDir', null, 'Add', 'btn primary sm', v.ui.pnNewDir.trim() ? '' : ' disabled')}${btn('cancelDir', null, IC('x'), 'ibtn sm', ' aria-label="Cancel"')}</form>`;
}
/* home: search, the folders, and notes that are in no folder */
function home(v, b){
  const q = (v.ui.pnQ || '').trim();
  const find = `<label class="pn-q srch-q">${IC('search')}<input class="inp" type="search" id="${P}q-${v.id}" data-i="pnQ" value="${esc(v.ui.pnQ || '')}" placeholder="Search your notes" autocomplete="off" aria-label="Search your notes"></label>`;
  if (q) {
    const hits = sorted(Object.values(b.notes).filter(n => matches(n, q)));
    return `${find}<div class="pn-list">${hits.map(n => noteRow(v, b, n, q)).join('') || `<p class="pn-empty">No note has “${esc(q)}” in it.</p>`}</div>`;
  }
  const loose = inDir(b, '_');
  return `${find}
    <h4 class="pn-h">Folders</h4>
    <div class="pn-dirs">${b.dirs.map(d => dirRow(v, b, d, v.ui.pnDir === d.id)).join('')}${newDirForm(v)}</div>
    ${loose.length ? `<h4 class="pn-h">Not in a folder</h4><div class="pn-list">${loose.map(n => noteRow(v, b, n)).join('')}</div>` : ''}
    ${btn('new', '_', `${IC('pen')}New note`, 'btn pn-new')}`;
}
/* one folder: its notes, newest first, and its rename / delete */
function folder(v, b, id){
  const d = b.dirs.find(x => x.id === id), list = inDir(b, id);
  const ren = v.ui.pnRen === id;
  const head = ren
    ? `<form class="pn-form" onsubmit="return false"><input class="inp" id="${P}rn-${v.id}" data-i="pnRenName" value="${esc(v.ui.pnRenName ?? (d ? d.name : ''))}" maxlength="40" autocomplete="off" enterkeyhint="done" aria-label="Folder name">${btn('renDir', id, 'Save', 'btn primary sm')}${btn('cancelRen', null, IC('x'), 'ibtn sm', ' aria-label="Cancel"')}</form>`
    : `<div class="pn-bar">${btn('home', null, IC('left'), 'ibtn', ' aria-label="All folders" title="All folders"')}<h3>${IC('folder')}${esc(dirName(b, id))}</h3>
      ${d ? btn('renOpen', id, IC('pen'), 'ibtn', ' aria-label="Rename this folder" title="Rename"') + btn('delDir', id, IC('trash'), 'ibtn' + (v.ui.pnArm === 'd' + id ? ' on' : ''), ' aria-label="Delete this folder" title="Delete folder"') : ''}</div>`;
  const arm = v.ui.pnArm === 'd' + id ? `<div class="pn-warn">${IC('warn')}<span>Delete “${esc(d ? d.name : '')}”?${list.length ? ` Its ${count(list.length)} move to Not in a folder.` : ''}</span>${btn('delDirGo', id, 'Delete', 'btn sm danger')}${btn('disarm', null, 'Keep', 'btn sm ghost')}</div>` : '';
  return `${head}${arm}${btn('new', id, `${IC('pen')}New note`, 'btn pn-new')}
    <div class="pn-list">${list.map(n => noteRow(v, b, n)).join('') || `<p class="pn-empty">Nothing here yet. Tap New note to write the first one.</p>`}</div>`;
}
/* one note, being written */
function editor(v, b, n, wide){
  const dirs = [['_', 'No folder'], ...b.dirs.map(d => [d.id, d.name])], cur = n.dir && b.dirs.some(d => d.id === n.dir) ? n.dir : '_';
  return `<div class="pn-bar">${wide ? '' : btn('back', null, IC('left'), 'ibtn', ` aria-label="Back to ${esc(dirName(b, cur))}" title="Back"`)}
      <label class="pn-mv">${IC('folder')}<select class="inp" data-i="pnMove" aria-label="Folder">${dirs.map(([id, l]) => `<option value="${esc(id)}"${id === cur ? ' selected' : ''}>${esc(l)}</option>`).join('')}</select></label>
      <small class="pn-st">${n.t ? 'Saved ' + esc(when(n.t)) : ''}</small>
      ${btn('delNote', n.id, IC('trash'), 'ibtn' + (v.ui.pnArm === 'n' + n.id ? ' on' : ''), ' aria-label="Delete this note" title="Delete note"')}</div>
    ${v.ui.pnArm === 'n' + n.id ? `<div class="pn-warn">${IC('warn')}<span>Delete this note for good?</span>${btn('delNoteGo', n.id, 'Delete', 'btn sm danger')}${btn('disarm', null, 'Keep', 'btn sm ghost')}</div>` : ''}
    <input class="inp pn-title" id="${P}t-${v.id}" data-i="pnTitle" value="${esc(n.title || '')}" placeholder="Title" maxlength="120" autocomplete="off" aria-label="Title">
    <textarea class="inp pn-text" id="${P}x-${v.id}" data-i="pnText" placeholder="Write anything: what happened, names to remember, clues, plans…" aria-label="Note">${esc(n.text || '')}</textarea>`;
}
/* the whole notebook. wide (the desktop sheet): folders on the left, the open folder or note on the right */
let P = 'pn';
pn.html = (v, wide, pre) => {
  P = pre || 'pn';
  if (!pn.on(v)) return '<p class="pn-empty">Personal notes belong to the players’ characters.</p>';
  const s = v.role, b = book(s);
  if (local()) { seed(b); b.ready = true; }
  if (b.denied && !b.ready) return '<p class="pn-empty">Your notes can’t open yet. The GM needs to publish the newest Firebase rules first.</p>';
  if (!b.ready) return '<p class="pn-empty">Opening your notes…</p>';
  const n = v.ui.pnNote && b.notes[v.ui.pnNote], d = v.ui.pnDir;
  if (v.ui.pnNote && !n) v.ui.pnNote = null;
  const dOk = d === '_' || b.dirs.some(x => x.id === d);
  if (d && !dOk) v.ui.pnDir = null;
  if (!wide) return `<div class="pn">${n ? editor(v, b, n) : dOk ? folder(v, b, d) : home(v, b)}</div>`;
  const right = n ? editor(v, b, n, true) : dOk ? folder(v, b, d) : (() => { const all = sorted(Object.values(b.notes));
    return `<div class="pn-bar"><h3>${IC('clock')}Latest</h3></div>${btn('new', '_', `${IC('pen')}New note`, 'btn pn-new')}<div class="pn-list">${all.slice(0, 12).map(x => noteRow(v, b, x, null)).join('') || '<p class="pn-empty">No notes yet. Pick a folder on the left, or start a new note.</p>'}</div>`; })();
  return `<div class="pn pn-wide"><div class="pn-side scroll" data-sk="pn-side">${home(v, b)}</div><div class="pn-main scroll" data-sk="pn-main">${right}</div></div>`;
};
pn.title = v => `My notes · ${esc(N.charOf(v.role)?.short || N.charOf(v.role)?.name || 'My character')}`;

/* ---------- typing ---------- */
const autoGrow = el => { if (el && el.tagName === 'TEXTAREA' && !el.closest('.pn-wide')) { el.style.height = 'auto'; el.style.height = Math.max(220, el.scrollHeight + 2) + 'px'; } };
pn.input = (v, el, i) => {
  const s = v.role, b = book(s), val = el.value;
  if (i === 'pnQ') { v.ui.pnQ = val; N.render(v); return; }
  if (i === 'pnDirName') { v.ui.pnNewDir = val; const bt = el.parentElement.querySelector('[data-v="makeDir"]'); if (bt) bt.disabled = !val.trim(); return; }
  if (i === 'pnRenName') { v.ui.pnRenName = val; return; }
  const n = b.notes[v.ui.pnNote]; if (!n) return;
  if (i === 'pnTitle') n.title = val.slice(0, 120);
  if (i === 'pnText') { n.text = val; autoGrow(el); }
  n.t = Date.now(); saveNote(s, n);
  const st = v.root.querySelector('.pn-st'); if (st) st.textContent = 'Saving…';
  clearTimeout(v._pnT); v._pnT = setTimeout(() => { if (st && st.isConnected) st.textContent = 'Saved ' + when(n.t); }, 900);
};
pn.change = (v, el, i) => {
  if (i !== 'pnMove') return false;
  const s = v.role, b = book(s), n = b.notes[v.ui.pnNote]; if (!n) return true;
  if (el.value === '_') delete n.dir; else n.dir = el.value;
  n.t = Date.now(); saveNote(s, n); if (v.ui.pnDir) v.ui.pnDir = el.value; N.renderAll(); return true;
};
pn.enter = (v, el) => {
  const i = el.dataset.i; if (i !== 'pnDirName' && i !== 'pnRenName') return false;
  el.parentElement.querySelector('.btn.primary')?.click(); return true;
};
/* the notes can be open in the sheet and in a side panel at once: the sheet (drawn last) is the one in front */
const focus = (v, sel) => setTimeout(() => { const all = v.root.querySelectorAll(sel), f = all[all.length - 1]; if (f) { f.focus({preventScroll:true}); if (f.tagName === 'TEXTAREA') autoGrow(f); } }, 20);

/* ---------- buttons (data-a="pn" data-v=what data-k=which) ---------- */
pn.act = (v, el) => {
  const s = v.role, b = book(s), ui = v.ui, sub = el.dataset.v, k = el.dataset.k;
  if (!pn.on(v)) return;
  if (sub !== 'delNote' && sub !== 'delDir') ui.pnArm = null;
  switch (sub) {
    case 'home': ui.pnDir = null; ui.pnNote = null; ui.pnRen = null; break;
    case 'dir': ui.pnDir = k; ui.pnNote = null; ui.pnQ = ''; ui.pnRen = null; break;
    case 'back': ui.pnNote = null; break;
    case 'open': { const n = b.notes[k]; if (!n) break; ui.pnNote = k; if (ui.pnQ) { ui.pnDir = n.dir && b.dirs.some(d => d.id === n.dir) ? n.dir : '_'; } break; }
    case 'new': { const dir = k && k !== '_' ? k : (ui.pnDir && ui.pnDir !== '_' ? ui.pnDir : null);
      const n = {id:uid(), title:'', text:'', c:Date.now(), t:Date.now(), ...(dir ? {dir} : {})};
      b.notes[n.id] = n; saveNote(s, n); ui.pnNote = n.id; ui.pnDir = dir || '_'; ui.pnQ = '';
      N.renderAll(); focus(v, '[data-i="pnTitle"]'); return; }
    case 'newDir': ui.pnNewDir = ''; N.render(v); focus(v, '[data-i="pnDirName"]'); return;
    case 'cancelDir': ui.pnNewDir = null; break;
    case 'makeDir': { const name = (ui.pnNewDir || '').trim().slice(0, 40); if (!name) break;
      const d = {id:uid(), name}; b.dirs.push(d); saveDirs(s); ui.pnNewDir = null; ui.pnDir = d.id; ui.pnNote = null; N.renderAll(); return; }
    case 'renOpen': ui.pnRen = k; ui.pnRenName = null; N.render(v); focus(v, '[data-i="pnRenName"]'); return;
    case 'cancelRen': ui.pnRen = null; break;
    case 'renDir': { const d = b.dirs.find(x => x.id === k), name = (ui.pnRenName ?? (d && d.name) ?? '').trim().slice(0, 40);
      if (d && name) { d.name = name; saveDirs(s); } ui.pnRen = null; N.renderAll(); return; }
    case 'delDir': ui.pnArm = ui.pnArm === 'd' + k ? null : 'd' + k; break;
    case 'delDirGo': { b.dirs = b.dirs.filter(x => x.id !== k); saveDirs(s);
      for (const n of Object.values(b.notes)) if (n.dir === k) { delete n.dir; saveNote(s, n); }
      ui.pnDir = null; ui.pnNote = null; N.renderAll(); return; }
    case 'delNote': ui.pnArm = ui.pnArm === 'n' + k ? null : 'n' + k; break;
    case 'delNoteGo': { const n = b.notes[k]; if (!n) break; delete b.notes[k]; dropNote(s, k); ui.pnNote = null; N.renderAll(); return; }
    case 'disarm': break;
    /* the top bar button: opens the notes, or closes them when they are already open */
    case 'toggle': ui.pop = null; if (ui.sheet === 'notes') ui.sheet = null; else { ui.sheet = 'notes'; ui.pnArm = null; } break;
  }
  N.render(v);
};
/* the notes button for a chat's top bar (players only) */
pn.topBtn = v => pn.on(v) ? `<button type="button" class="ibtn pn-btn" data-a="pn" data-v="toggle" aria-pressed="${v.ui.sheet === 'notes'}" aria-label="My notes" title="My notes">${IC('notes')}</button>` : '';
})();
