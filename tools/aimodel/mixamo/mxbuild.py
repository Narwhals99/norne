# A character rigged by Mixamo + the shared Mixamo moves -> models/<id>.glb for js/aikit.js.
# blender -b --factory-startup --python mxbuild.py -- <with skin.fbx> <moves dir> <moves.json> <prep.blend> <out.glb> [own.json] [own moves dir]
#   own.json / own moves dir: moves this character has of its own (an idle, say), in the same form as moves.json; they win
#   with skin.fbx: the cut-down model (tools/aimodel/prep.py's, uploaded to Mixamo) as Mixamo hands it back, rigged
#   moves dir:     Mixamo's moves, downloaded once Without Skin (file names as moves.json lists them)
#   prep.blend:    the same cut-down model before Mixamo, for its colour picture and its smooth shading
import bpy, sys, os, json, glob, re, time, math
import numpy as np
from mathutils import Vector, Matrix, Quaternion
argv = sys.argv[sys.argv.index('--')+1:]
skin, mdir, mjson, prep, out = argv[:5]; TEX = 1024
MOVES = {k: v for k, v in json.load(open(mjson)).items() if not k.startswith('_')}
OWN = json.load(open(argv[5])) if len(argv) > 5 else {}
MOVES.update({k: v for k, v in OWN.items() if not k.startswith('_')})
# Mixamo's moves are recorded on a slim adult: on a stocky toy figure the hanging arms sink into the body. _armSpace
# swings each upper arm out by up to that many degrees, most when it hangs straight down, not at all when it is raised.
SPACE = float(OWN.get('_armSpace', 0))
FOLLOW = {'mixamorig:' + k: 'mixamorig:' + v for k, v in OWN.get('_follow', {}).items()}
FPS = 30; t0 = time.time()
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.fbx(filepath=skin)
arm = [o for o in bpy.data.objects if o.type == 'ARMATURE'][0]; ob = [o for o in bpy.data.objects if o.type == 'MESH'][0]
for o in list(bpy.data.objects):
  if o not in (arm, ob): bpy.data.objects.remove(o, do_unlink=True)
for a in list(bpy.data.actions): bpy.data.actions.remove(a)
# Everything below takes the skeleton as Mixamo's files have it: lying in its own space with Y up, stood upright by its
# object. A rig made in Blender (apeprep.py) has Z up in its own space: turn its bones over and its object back, so it
# stands where it did.
hb = arm.data.bones['mixamorig:Hips'].head_local
if abs(hb.z) > abs(hb.y):
  keep = ob.matrix_world.copy(); T = Matrix.Rotation(-math.pi / 2, 4, 'X')
  arm.data.transform(T); arm.matrix_world = arm.matrix_world @ T.inverted()
  bpy.context.view_layer.update(); ob.matrix_world = keep; bpy.context.view_layer.update()
  print('STOOD UP', [round(x, 2) for x in arm.data.bones['mixamorig:Hips'].head_local])
sc = bpy.context.scene; sc.render.fps = FPS
P = 'mixamorig:'

# ---------- the colour picture and the smooth shading, from the model as it was before Mixamo ----------
with bpy.data.libraries.load(prep) as (src, dst): dst.objects = [n for n in src.objects if n == 'Body']
body = dst.objects[0]; sc.collection.objects.link(body)
arm.data.pose_position = 'REST'; bpy.context.view_layer.update()
def wbox(o):
  co = np.empty(len(o.data.vertices) * 3, dtype=np.float32); o.data.vertices.foreach_get('co', co); co = co.reshape(-1, 3)
  M = np.array(o.matrix_world); w = co @ M[:3, :3].T + M[:3, 3]; return w.min(axis=0), w.max(axis=0)
(a0, a1), (b0, b1) = wbox(ob), wbox(body)
k = float((a1[2] - a0[2]) / (b1[2] - b0[2])); body.scale = (k, k, k); bpy.context.view_layer.update(); b0, b1 = wbox(body)
body.location = Vector(((a0[0] + a1[0]) / 2 - (b0[0] + b1[0]) / 2, (a0[1] + a1[1]) / 2 - (b0[1] + b1[1]) / 2, a0[2] - b0[2])); bpy.context.view_layer.update()
print('FIT', 'scale', round(k, 4), 'model size', np.round(a1 - a0, 3), 'verts', len(ob.data.vertices), len(body.data.vertices))
bpy.context.view_layer.objects.active = ob; ob.select_set(True)
# a model that went to Mixamo at full size (Egrot, before the small upload files) is cut down here the way prep.py does it:
# doubled points merged first (left apart, the seams tear open into dark cracks), then everything but the face, then the
# face, which keeps about a fifth of the triangles. The skin weights come along.
TARGET = 14000
if len(ob.data.polygons) > TARGET * 1.5:
  def face_of(o):
    co = np.empty(len(o.data.vertices) * 3, dtype=np.float32); o.data.vertices.foreach_get('co', co); co = co.reshape(-1, 3)
    M = np.array(o.matrix_world); w = co @ M[:3, :3].T + M[:3, 3]; lo = w.min(axis=0); hi = w.max(axis=0); Hh = hi[2] - lo[2]
    return (w[:, 2] - lo[2] > .69 * Hh) & (w[:, 2] - lo[2] < .90 * Hh) & (w[:, 1] - (lo[1] + hi[1]) / 2 < -.03 * Hh) & (np.abs(w[:, 0] - (lo[0] + hi[0]) / 2) < .11 * Hh)
  v0 = len(ob.data.vertices)
  bpy.ops.object.mode_set(mode='EDIT'); bpy.ops.mesh.select_all(action='SELECT')
  bpy.ops.mesh.remove_doubles(threshold=1e-4 * (a1[2] - a0[2]) / max(ob.matrix_world.to_scale()[2], 1e-9)); bpy.ops.object.mode_set(mode='OBJECT')
  n0 = len(ob.data.polygons); face = face_of(ob)
  vg = ob.vertex_groups.new(name='_face'); vg.add([int(i) for i in np.nonzero(face)[0]], 1.0, 'REPLACE')
  pv = np.empty(len(ob.data.loops), dtype=np.int32); ob.data.loops.foreach_get('vertex_index', pv)
  ls = np.empty(n0, dtype=np.int32); ob.data.polygons.foreach_get('loop_total', ls)
  face_tris = int(face[pv].reshape(-1, 3).all(axis=1).sum()) if (ls == 3).all() else int(face.sum() * 2)
  m = ob.modifiers.new('dec', 'DECIMATE'); m.vertex_group = '_face'; m.invert_vertex_group = True; m.use_collapse_triangulate = True; m.ratio = (face_tris + TARGET * .78) / n0
  bpy.ops.object.modifier_move_to_index(modifier='dec', index=0); bpy.ops.object.modifier_apply(modifier='dec')
  m = ob.modifiers.new('dec', 'DECIMATE'); m.vertex_group = '_face'; m.use_collapse_triangulate = True; m.ratio = TARGET / len(ob.data.polygons)
  bpy.ops.object.modifier_move_to_index(modifier='dec', index=0); bpy.ops.object.modifier_apply(modifier='dec')
  ob.vertex_groups.remove(ob.vertex_groups['_face'])
  print('CUT DOWN', n0, '->', len(ob.data.polygons), 'points merged', v0 - len(ob.data.vertices) if False else v0)
SWAP = False
bpy.ops.object.shade_smooth()
dt = ob.modifiers.new('nrm', 'DATA_TRANSFER'); dt.object = body; dt.use_loop_data = True; dt.data_types_loops = {'CUSTOM_NORMAL'}; dt.loop_mapping = 'POLYINTERP_NEAREST'
bpy.ops.object.modifier_move_to_index(modifier='nrm', index=0); bpy.ops.object.modifier_apply(modifier='nrm')
bmat = body.data.materials[0]; img = [n for n in bmat.node_tree.nodes if n.type == 'BSDF_PRINCIPLED'][0].inputs['Base Color'].links[0].from_node.image
img.scale(TEX, TEX); img.pack()
mat = bpy.data.materials.new('skin'); mat.use_nodes = True; nt = mat.node_tree; bsdf = [n for n in nt.nodes if n.type == 'BSDF_PRINCIPLED'][0]
tex = nt.nodes.new('ShaderNodeTexImage'); tex.image = img; nt.links.new(tex.outputs['Color'], bsdf.inputs['Base Color'])
bsdf.inputs['Metallic'].default_value = 0; bsdf.inputs['Roughness'].default_value = .72
ob.data.materials.clear(); ob.data.materials.append(mat)
if not SWAP: bpy.data.objects.remove(body, do_unlink=True)
bpy.ops.object.vertex_group_limit_total(limit=4); bpy.ops.object.vertex_group_normalize_all(lock_active=False)
print('SKIN', 'unweighted', sum(1 for v in ob.data.vertices if not v.groups), 'custom normals', ob.data.has_custom_normals)

# ---------- a grip in each hand for js/aikit.js to hang weapons on ----------
# A held weapon's length runs out of the thumb side of the fist, square to the hand; the grip's front (its local Z) is the
# way the fingers point, which is the way a bow in that hand shoots.
bpy.context.view_layer.objects.active = arm; ob.select_set(False); arm.select_set(True)
bpy.ops.object.mode_set(mode='EDIT')
eb = arm.data.edit_bones
for side, s in (('Right', 'R'), ('Left', 'L')):
  hand = eb[P + side + 'Hand']; idx = eb.get(P + side + 'HandIndex1') or eb.get(P + side + 'HandMiddle1'); th = eb.get(P + side + 'HandThumb1')
  along = (hand.tail - hand.head).normalized()
  if idx is not None: along = (idx.head - hand.head).normalized()
  palm = hand.head + along * ((idx.head - hand.head).length * .75 if idx is not None else hand.length * .5)
  if th is not None: rad = (th.head - hand.head); rad = (rad - along * rad.dot(along)).normalized()
  else: rad = hand.x_axis.copy()
  g = eb.new('grip.' + s); g.head = palm; g.tail = palm + rad * hand.length * .6; g.parent = hand; g.align_roll(along); g.use_deform = True
bpy.ops.object.mode_set(mode='OBJECT')
arm.data.pose_position = 'POSE'

# ---------- the moves ----------
pb = arm.pose.bones; hips = pb[P + 'Hips']; rest_hips = arm.data.bones[P + 'Hips'].matrix_local.copy()
for b in pb: b.rotation_mode = 'QUATERNION'
arm.animation_data_create()
def norm(s): return re.sub(r'[^a-z0-9]', '', s.lower())
FILES = {norm(os.path.basename(f)[:-4]): f for f in glob.glob(mdir + '/*.fbx')}
if len(argv) > 6: FILES.update({norm(os.path.basename(f)[:-4]): f for f in glob.glob(argv[6] + '/*.fbx') if os.path.abspath(f) != os.path.abspath(skin)})
SRC = {}
def source(name):
  """a move's file: its own skeleton, kept to read the move from (Mixamo's Without Skin files rest in a T-pose, the rigged
  model in the pose it was uploaded in, so a bone's turn can't be copied across as it is: see fit)"""
  if name in SRC: return SRC[name]
  f = FILES.get(norm(name))
  if not f: return None
  before = set(bpy.data.objects); acts = set(bpy.data.actions)
  bpy.ops.import_scene.fbx(filepath=f)
  act = [x for x in bpy.data.actions if x not in acts][0]
  sarm = None
  for o in [o for o in bpy.data.objects if o not in before]:
    if o.type == 'ARMATURE' and sarm is None: sarm = o
    else: bpy.data.objects.remove(o, do_unlink=True)
  sarm.animation_data.action = act
  SRC[name] = (sarm, act, fit(sarm)); return SRC[name]
ORDER = [b for b in arm.data.bones if not b.name.startswith('grip.')]     # parents come before their children
TREST = {b.name: b.matrix_local.to_quaternion() for b in arm.data.bones}
def fit(sarm):
  """for each bone, what turns the move's skeleton's pose into this one's: undo its rest, swing this model's resting bone
  onto the direction the move's bone rests in, then this model's rest. Same body, different resting pose."""
  C = {}
  for b in ORDER:
    sb = sarm.data.bones.get(b.name)
    if sb is None: continue
    ds = (sb.tail_local - sb.head_local).normalized(); dtv = (b.tail_local - b.head_local).normalized()
    C[b.name] = sb.matrix_local.to_quaternion().inverted() @ dtv.rotation_difference(ds) @ TREST[b.name]
  k = arm.data.bones[P + 'Hips'].head_local.y / max(sarm.data.bones[P + 'Hips'].head_local.y, 1e-9)
  return C, k
def src_frame(m, t):
  for (ta, fa), (tb, fb) in zip(m, m[1:]):
    if t <= tb: return fa + (fb - fa) * ((t - ta) / (tb - ta) if tb > ta else 0)
  return m[-1][1]
LIMIT = .28   # how far a move may carry the figure off its base, as a share of its height
made = []
for name, spec in MOVES.items():
  act = source(spec['file'])
  if act is None: print('MISSING', name, spec['file']); continue
  sarm, act, (C, kh) = act
  f0, f1 = act.frame_range
  if spec.get('loop'): n = int(round(f1 - f0)); frames = [f0 + i for i in range(n + 1)]
  else: dur = spec['map'][-1][0]; n = int(round(dur * FPS)); frames = [f0 + src_frame(spec['map'], i / FPS) for i in range(n + 1)]
  spb = sarm.pose.bones; ships = spb[P + 'Hips']
  S = []
  for fr in frames:
    sc.frame_set(int(fr), subframe=fr - int(fr))
    W = {}; L = {}
    for b in ORDER:
      if b.name not in C: continue
      w = spb[b.name].matrix.to_quaternion() @ C[b.name]
      if SPACE and b.name in (P + 'LeftArm', P + 'RightArm'):
        d = w @ Vector((0, 1, 0)); k = max(0.0, -d.y) ** 1.5      # the armature stands Y-up: -y is straight down
        w = Quaternion((0, 0, 1), math.radians(SPACE * k * (1 if 'Left' in b.name else -1))) @ w
      W[b.name] = w
    # a bone the moves know nothing of (the dreadape's second pair of arms) turns as the bone it follows turns, keeping
    # the angle it rests at from it
    for nb, fb in FOLLOW.items():
      if fb in W and nb in TREST: W[nb] = W[fb] @ TREST[fb].inverted() @ TREST[nb]
    for b in ORDER:
      if b.name not in W: continue
      w = W[b.name]
      if b.parent is None or b.parent.name not in W: L[b.name] = TREST[b.name].inverted() @ w
      else: L[b.name] = (W[b.parent.name] @ TREST[b.parent.name].inverted() @ TREST[b.name]).inverted() @ w
    m = W[P + 'Hips'].to_matrix().to_4x4(); m.translation = ships.matrix.translation * kh
    S.append((m, L))
  # where the hips go, measured across the floor (the armature stands Y-up: x and z are the floor)
  H = [m.translation.copy() for m, _ in S]; h0 = H[0].copy(); drift = spec.get('drift', 'none'); tall = (a1[2] - a0[2]) / max(arm.scale[2], 1e-9)
  D = [Vector((h.x - h0.x, 0, h.z - h0.z)) for h in H]
  if drift == 'strip': D2 = [Vector((0, 0, 0)) for d in D]
  else:
    D2 = [d.copy() for d in D]
    if drift == 'ramp': D2 = [d - D[-1] * (i / n) for i, d in enumerate(D)]
    far = max(d.length for d in D2) or 1e-9; lim = LIMIT * tall
    if far > lim: D2 = [d * (lim / far) for d in D2]
    if drift == 'back':
      back = max(1, int(.3 * FPS)); D2 = [d * (1 if i <= n - back else (n - i) / back) for i, d in enumerate(D2)]
    if drift == 'none': D2 = [d - D2[0] for d in D2]
  new = bpy.data.actions.new(name); arm.animation_data.action = new
  try: arm.animation_data.action_slot = new.slots[0]
  except Exception: pass
  prev = {}
  for i, (m, rots) in enumerate(S):
    m2 = m.copy(); m2.translation = Vector((h0.x + D2[i].x, m.translation.y, h0.z + D2[i].z))
    hips.matrix_basis = rest_hips.inverted() @ m2
    q = hips.rotation_quaternion.copy()
    if 'h' in prev and prev['h'].dot(q) < 0: q.negate(); hips.rotation_quaternion = q
    prev['h'] = q
    hips.keyframe_insert('location', frame=i); hips.keyframe_insert('rotation_quaternion', frame=i)
    for b in pb:
      if b is hips or b.name not in rots: continue
      q = rots[b.name]
      if b.name in prev and prev[b.name].dot(q) < 0: q = -q
      prev[b.name] = q; b.rotation_quaternion = q; b.keyframe_insert('rotation_quaternion', frame=i)
  new.use_fake_user = True; made.append(name)
  tr = arm.animation_data.nla_tracks.new(); tr.name = name; tr.strips.new(name, 0, new); tr.mute = True
  arm.animation_data.action = None
  print('MOVE %-6s %-36s %3d frames  travel %.2f -> %.2f of height' % (name, spec['file'], n, max(d.length for d in D) / tall, max(d.length for d in D2) / tall))
for sarm, a, _ in list(SRC.values()): bpy.data.objects.remove(sarm, do_unlink=True); bpy.data.actions.remove(a)
for b in pb: b.matrix_basis = Matrix()
sc.frame_set(0)
for o in bpy.data.objects: o.select_set(o in (arm, ob))
bpy.ops.export_scene.gltf(filepath=out, export_format='GLB', use_selection=True, export_image_format='JPEG', export_image_quality=82,
  export_animations=True, export_animation_mode='ACTIONS', export_force_sampling=True, export_optimize_animation_size=True,
  export_skins=True, export_all_influences=False, export_morph=False, export_yup=True, export_normals=True, export_tangents=False, export_materials='EXPORT')
print('EXPORTED', out, round(os.path.getsize(out) / 1e6, 2), 'MB', len(made), 'moves', round(time.time() - t0, 1), 's')
