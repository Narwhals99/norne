# The dreadape: a four-armed ape from Tripo that came with a two-armed Mixamo-style skeleton whose head bone starts at the
# top of the skull (and pokes out above it) and whose lower pair of arms hangs off the upper arms and thighs.
# This refits the neck and head, gives the lower arms bones of their own, redoes the skin weights, and writes
#   <out>/prep.blend   the model alone ('Body'), for mxbuild.py to take the colours and shading from
#   <out>/rigged.fbx   the model on its skeleton, in the form Mixamo's With Skin files have, for mxbuild.py
# blender -b --factory-startup --python apeprep.py -- <tripo.glb> <out dir>
import bpy, sys, os
import numpy as np
from mathutils import Vector, Matrix
argv = sys.argv[sys.argv.index('--')+1:]
src, out = argv[0], argv[1]
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=src)
arm = [o for o in bpy.data.objects if o.type == 'ARMATURE'][0]
ob = max([o for o in bpy.data.objects if o.type == 'MESH'], key=lambda o: len(o.data.vertices))
# free both of the file's helper nodes and stand them in the world as they are (facing -Y, feet near the floor)
for o in (arm, ob):
  M = o.matrix_world.copy(); o.parent = None; o.matrix_world = M
for o in list(bpy.data.objects):
  if o not in (arm, ob): bpy.data.objects.remove(o, do_unlink=True)
for m in list(ob.modifiers): ob.modifiers.remove(m)
ob.vertex_groups.clear()
bpy.ops.object.select_all(action='DESELECT')
for o in (arm, ob): o.select_set(True)
bpy.context.view_layer.objects.active = ob
bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
co = np.array([v.co[:] for v in ob.data.vertices]); lo = co.min(axis=0); hi = co.max(axis=0)
off = Vector(((lo[0] + hi[0]) / 2, (lo[1] + hi[1]) / 2, lo[2]))
for v in ob.data.vertices: v.co -= off
H = float(hi[2] - lo[2]); print('SIZE', np.round(hi - lo, 3), 'faces', len(ob.data.polygons))
ob.name = 'Body'
# ---------- the model alone ----------
mat = ob.data.materials[0]; nt = mat.node_tree; bsdf = [n for n in nt.nodes if n.type == 'BSDF_PRINCIPLED'][0]
base = bsdf.inputs['Base Color'].links[0].from_node
for name in ('Normal', 'Metallic', 'Roughness'):
  for l in list(bsdf.inputs[name].links): nt.links.remove(l)
for n in list(nt.nodes):
  if n.type in ('NORMAL_MAP', 'SEPARATE_COLOR') or (n.type == 'TEX_IMAGE' and n != base): nt.nodes.remove(n)
base.image.pack()
bpy.ops.object.select_all(action='DESELECT'); ob.select_set(True); bpy.context.view_layer.objects.active = ob
bpy.ops.object.shade_smooth()
arm.hide_set(True)
bpy.ops.wm.save_as_mainfile(filepath=os.path.join(out, 'prep.blend'))
arm.hide_set(False)
# ---------- the skeleton ----------
K = 10.0     # Blender's automatic weights fail at this size, so both go up ten times while the skin is made
for v in ob.data.vertices: v.co *= K
bpy.context.view_layer.objects.active = arm; ob.select_set(False); arm.select_set(True)
bpy.ops.object.mode_set(mode='EDIT')
eb = arm.data.edit_bones; P = 'mixamorig:'
for e in eb: e.head = (e.head - off) * K; e.tail = (e.tail - off) * K
def put(name, head, tail):
  e = eb[P + name]; e.use_connect = False; e.head = Vector(head) * H * K; e.tail = Vector(tail) * H * K
# neck and head, as shares of his height: the neck from between the shoulders to the base of the skull, the head through
# the skull to its crown (they were a third of his height too high)
put('Neck', (0, -.02, .745), (0, -.035, .80)); put('Head', (0, -.035, .80), (0, -.05, .985))
for c in list(eb[P + 'Head'].children): eb.remove(c)
# the lower pair of arms: shoulder under the upper arm's, elbow, wrist, fingertips (left side; the right is its mirror)
LOW = [('Arm2', (.18, .0, .62), (.30, .0, .405)), ('ForeArm2', (.30, .0, .405), (.35, -.01, .31)), ('Hand2', (.35, -.01, .31), (.39, -.02, .195))]
for side, sg in (('Left', 1), ('Right', -1)):
  par = eb[P + 'Spine1']
  for nm, h, t in LOW:
    e = eb.new(P + side + nm); e.head = Vector((h[0] * sg, h[1], h[2])) * H * K; e.tail = Vector((t[0] * sg, t[1], t[2])) * H * K; e.parent = par; e.use_connect = False; par = e
    ref = eb[P + side + nm[:-1]]; e.roll = ref.roll
bpy.ops.object.mode_set(mode='OBJECT')
print('BONES', len(arm.data.bones))
# The fur is hundreds of separate tufts, which the automatic weights can't solve. A stand-in is made instead: the model
# re-skinned as one sealed surface. That is weighted, and each point of the real model takes the weights of the stand-in
# next to it.
proxy = ob.copy(); proxy.data = ob.data.copy(); bpy.context.scene.collection.objects.link(proxy); proxy.name = 'Proxy'
bpy.ops.object.select_all(action='DESELECT'); proxy.select_set(True); bpy.context.view_layer.objects.active = proxy
rm = proxy.modifiers.new('rm', 'REMESH'); rm.mode = 'VOXEL'; rm.voxel_size = .0075 * H * K; bpy.ops.object.modifier_apply(modifier='rm')
print('PROXY faces', len(proxy.data.polygons))
bpy.ops.object.select_all(action='DESELECT'); proxy.select_set(True); arm.select_set(True); bpy.context.view_layer.objects.active = arm
bpy.ops.object.parent_set(type='ARMATURE_AUTO')
print('PROXY UNWEIGHTED', sum(1 for v in proxy.data.vertices if not v.groups), 'of', len(proxy.data.vertices))
arm.data.pose_position = 'REST'
bpy.ops.object.select_all(action='DESELECT'); ob.select_set(True); bpy.context.view_layer.objects.active = ob
dt = ob.modifiers.new('w', 'DATA_TRANSFER'); dt.object = proxy; dt.use_vert_data = True; dt.data_types_verts = {'VGROUP_WEIGHTS'}
dt.vert_mapping = 'POLYINTERP_NEAREST'; dt.layers_vgroup_select_src = 'ALL'; dt.layers_vgroup_select_dst = 'NAME'
bpy.ops.object.datalayout_transfer(modifier='w'); bpy.ops.object.modifier_apply(modifier='w')
bpy.data.objects.remove(proxy, do_unlink=True); arm.data.pose_position = 'POSE'
ob.parent = arm; ob.matrix_parent_inverse = arm.matrix_world.inverted(); am = ob.modifiers.new('Armature', 'ARMATURE'); am.object = arm
unw = [v.index for v in ob.data.vertices if not v.groups]
print('UNWEIGHTED', len(unw), 'of', len(ob.data.vertices))
bpy.ops.object.select_all(action='DESELECT'); ob.select_set(True); bpy.context.view_layer.objects.active = ob
bpy.ops.object.vertex_group_limit_total(limit=4); bpy.ops.object.vertex_group_normalize_all(lock_active=False)
# back to life size
for v in ob.data.vertices: v.co /= K
bpy.context.view_layer.objects.active = arm
bpy.ops.object.mode_set(mode='EDIT')
for e in arm.data.edit_bones: e.head = e.head / K; e.tail = e.tail / K
bpy.ops.object.mode_set(mode='OBJECT')
bpy.ops.object.select_all(action='DESELECT'); ob.select_set(True); arm.select_set(True); bpy.context.view_layer.objects.active = arm
bpy.ops.export_scene.fbx(filepath=os.path.join(out, 'rigged.fbx'), use_selection=True, add_leaf_bones=False, bake_anim=False, mesh_smooth_type='OFF', path_mode='STRIP')
bpy.ops.wm.save_as_mainfile(filepath=os.path.join(out, 'rigged.blend'))
print('WROTE', out)
