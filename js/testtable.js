/* =====================================================================
   NORNE — the pretend table for GM test mode (Jack only, Profile > GM test mode).
   Loaded only when test mode starts. Made-up people and a made-up scene, none of the campaign:
   sync.js fills the table with this instead of reading the real one, and saves nothing.
   ===================================================================== */
(function(){
const N = window.N;
N.testTable = function(me){
const g = N.G;
g.role = 'gm';
g.P = {gm:{id:'gm', name:me.name || 'Jack', color:'var(--c-gm)'},
  p1:{id:'p1', name:'Ana', color:N.seatColor('p1'), char:'c1'},
  p2:{id:'p2', name:'Mia', color:N.seatColor('p2'), char:'c2'},
  p3:{id:'p3', name:'Theo', color:N.seatColor('p3'), char:'c3'}};
const mk = (id, player, name, portrait, sk, asp) => { const c = N.blankChar(id, player); Object.assign(c, {name, short:name, built:true, portrait, skills:sk, aspects:asp, color:g.P[player].color, fp:3, refresh:3,
  stressV:{phys:N.stressVals(sk.Strength||0), ment:N.stressVals(sk.Will||0)}}); c.stress = {phys:c.stressV.phys.map(()=>false), ment:c.stressV.ment.map(()=>false)}; return c; };
g.chars = {c1:mk('c1','p1','Brann','dwarf-warrior',{Fighting:3,Athletics:2,Notice:1,Strength:3,Will:1,Provoke:2,Crafting:2,Lore:1},['Stubborn as the mountain','Owes the wrong people','Axe of my father']),
  c2:mk('c2','p2','Isolde','elf-archer',{Shooting:3,Athletics:2,Notice:3,Stealth:2},['Eyes like a hawk','Too proud to retreat']),
  c3:mk('c3','p3','Wren','rogue-woman',{Stealth:3,Fighting:2,Athletics:1,Notice:2,Deception:2},['Quick hands, quicker lies','Wanted in three towns'])};
g.chars.c1.stress.phys[0] = true;
g.chars.c1.inv = [['Rope',1,'Fifty feet, a little frayed'],['Torch',3,''],['Waterskin',1,'']];
g.npcs = [N.npcCard({id:'n1', name:'Bandit', type:'nameless', portrait:'bandit-woman', skills:{Fighting:2, Athletics:1, Notice:1}}),
  N.npcCard({id:'n2', name:'Thug captain', portrait:'thug', skills:{Fighting:3, Athletics:2, Notice:2, Strength:2}, hc:'Scarred veteran of the roads', gearAtk:1, gearDef:1}),
  N.npcCard({id:'n3', name:'Innkeeper', portrait:'innkeeper', skills:{Rapport:2, Notice:2, Will:1}}),
  N.npcCard({id:'n4', name:'Town guard', portrait:'town-guard', skills:{Fighting:2, Notice:2}}),
  N.npcCard({id:'n5', name:'Priest', portrait:'priest', skills:{Will:3, Lore:2}}),
  N.npcCard({id:'n6', name:'Noble duelist', portrait:'noble-duelist', skills:{Fighting:3, Rapport:2}})];
g.seen = {gm:{}, p1:{}, p2:{}, p3:{}};
N.MEMBERS = [{uid:me.uid, name:me.name, email:me.email, role:'gm'},{uid:'t1', name:'Ana', email:'ana@example.com', role:'p1', seat:'p1'},{uid:'t2', name:'Mia', email:'mia@example.com', role:'p2', seat:'p2'},{uid:'t3', name:'Theo', email:'theo@example.com', role:'p3', seat:'p3'}];
g.wiki = []; g.maps = []; g.msgs = [];
g.recent = [{id:'r1', title:'Ambush at the river crossing', where:'', art:'art/bg/river-bridge.jpg'},{id:'r2', title:'A quiet night at the inn', where:'', art:'art/bg/town-alley.jpg'},{id:'r3', title:'The mountain pass', where:'', art:'art/bg/mountain-valley.jpg'}];
const cb = g.combat;
const T = Date.now() - 3600e3; let t = T; const at = () => (t += 45e3);
const msg = o => { const m = Object.assign({id:N.uid('m'), t:at(), as:''}, {ch:'grp-road'}, o); g.msgs.push(m); return m; };
/* Everyone is Meta only, so the story and its fights happen in a group chat with all three players */
g.groups = [{id:'road', name:'The road east', seats:['p1','p2','p3'], t:T}];
msg({kind:'ooc', by:'gm', ch:'table', text:'This is the pretend table. Nothing here is saved or sent.'});
msg({kind:'scene', by:'gm', scene:{title:'Ambush at the river crossing', where:'', date:'', art:'art/bg/river-bridge.jpg', place:null, aspects:[{t:'Thick river fog', free:1},{t:'Rotten bridge rails', free:0}]}});
msg({kind:'rp', by:'gm', as:'Narrator', text:'Fog rolls off the river. Halfway across the old bridge, shapes rise from the reeds on the far bank.'});
msg({kind:'rp', by:'p1', text:'*Brann hefts his axe.* Nobody crosses this bridge but us.'});
msg({kind:'ooc', by:'p2', text:'can I shoot from here or do I need to be on the bridge?'});
msg({kind:'ooc', by:'gm', text:'You can shoot from there. This is the pretend table, so try anything.'});
msg({kind:'roll', by:'p2', roll:{who:'Isolde', whoKey:'pc:c2', action:'Overcome', skill:'Notice', bonus:3, dice:[1,0,1,0], invokes:[], opp:2}});
msg({kind:'rp', by:'gm', as:'Thug captain', text:'Cut them down before they reach the bank!'});
msg({kind:'rp', by:'p1', ch:'dm-p1', text:'Can Brann recognise the captain?'});
msg({kind:'rp', by:'gm', as:'Narrator', ch:'dm-p1', text:'You’ve seen that scar before, on a wanted poster.'});
msg({kind:'rp', by:'p2', text:'Isolde nocks an arrow. "Stay low, they have bows too."'});
msg({kind:'rp', by:'gm', as:'Thug captain', text:'"Drop the axe, dwarf, and nobody drowns today."'});
msg({kind:'ooc', by:'p1', text:'Brann is not dropping anything'});
msg({kind:'rp', by:'p3', text:'*Wren slips along the rail, out of the torchlight.*'});
};
})();
