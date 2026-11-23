# Test: a Mixamo-rigged FBX (model + one move) -> a GLB for the app, keeping Mixamo's skeleton, weights and move.
# blender -b --factory-startup --python mxprep.py -- <mixamo.fbx> <tripo.glb, for its colour texture> <out.glb> <tris> <clip name>
import bpy, sys, time
import numpy as np
from mathutils import Vector
argv = sys.argv[sys.argv.index('--')+1:]
fbx, glb, out, target, clip = argv[0], argv[1], argv[2], int(argv[3]), argv[4]
t = time.time()
bpy.ops.wm.read_factory_settings(use_empty=True)
# the colour texture comes from Tripo's own file (Mixamo's FBX only points at files that aren't there)
bpy.ops.import_scene.gltf(filepath=glb)
img = [i for i in bpy.data.images if 'basecolor' in i.name.lower()][0]; img.pack(); img.use_fake_user = True
for o in list(bpy.data.objects): bpy.data.objects.remove(o, do_unlink=True)
bpy.ops.import_scene.fbx(filepath=fbx)
arm = [o for o in bpy.data.objects if o.type == 'ARMATURE'][0]; ob = [o for o in bpy.data.objects if o.type == 'MESH'][0]
for o in list(bpy.data.objects):
  if o not in (arm, ob): bpy.data.objects.remove(o, do_unlink=True)
arm.data.pose_position = 'REST'; bpy.context.view_layer.update()
n = len(ob.data.polygons)
src = ob.copy(); src.data = ob.data.copy(); bpy.context.scene.collection.objects.link(src); src.name = 'Src'
for m in list(src.modifiers): src.modifiers.remove(m)
src.parent = None; src.matrix_world = ob.matrix_world.copy()
def face_mask(o):
  co = np.empty(len(o.data.vertices) * 3, dtype=np.float32); o.data.vertices.foreach_get('co', co); co = co.reshape(-1, 3)
  M = np.array(o.matrix_world); w = co @ M[:3, :3].T + M[:3, 3]
  lo = w.min(axis=0); hi = w.max(axis=0); H = hi[2] - lo[2]; cx = (lo[0] + hi[0]) / 2; cy = (lo[1] + hi[1]) / 2
  return (w[:, 2] - lo[2] > .69 * H) & (w[:, 2] - lo[2] < .90 * H) & (w[:, 1] - cy < -.03 * H) & (np.abs(w[:, 0] - cx) < .11 * H), (lo, hi)
face, bounds = face_mask(ob); print('BOUNDS', bounds)
vg = ob.vertex_groups.new(name='_face'); vg.add([int(i) for i in np.nonzero(face)[0]], 1.0, 'REPLACE')
pv = np.empty(len(ob.data.loops), dtype=np.int32); ob.data.loops.foreach_get('vertex_index', pv)
ls = np.empty(len(ob.data.polygons), dtype=np.int32); ob.data.polygons.foreach_get('loop_total', ls)
face_tris = int(face[pv].reshape(-1, 3).all(axis=1).sum()) if (ls == 3).all() else int(face.sum() * 2)
bpy.context.view_layer.objects.active = ob; ob.select_set(True)
m = ob.modifiers.new('dec', 'DECIMATE'); m.vertex_group = '_face'; m.invert_vertex_group = True; m.use_collapse_triangulate = True
m.ratio = (face_tris + target * .78) / n
bpy.ops.object.modifier_apply(modifier='dec')
m = ob.modifiers.new('dec', 'DECIMATE'); m.vertex_group = '_face'; m.use_collapse_triangulate = True; m.ratio = target / len(ob.data.polygons)
bpy.ops.object.modifier_apply(modifier='dec')
ob.vertex_groups.remove(ob.vertex_groups['_face'])
print('TRIS', n, '->', len(ob.data.polygons), round(time.time() - t, 1), 's', 'groups', len(ob.vertex_groups))
bpy.ops.object.shade_smooth()
dt = ob.modifiers.new('nrm', 'DATA_TRANSFER'); dt.object = src; dt.use_loop_data = True; dt.data_types_loops = {'CUSTOM_NORMAL'}; dt.loop_mapping = 'POLYINTERP_NEAREST'
bpy.ops.object.modifier_apply(modifier='nrm')
bpy.data.objects.remove(src, do_unlink=True)
bpy.ops.object.vertex_group_limit_total(limit=4); bpy.ops.object.vertex_group_normalize_all(lock_active=False)
print('MODS', [md.type for md in ob.modifiers], 'unweighted', sum(1 for v in ob.data.vertices if not v.groups))
# material: just the colour picture, matte
mat = ob.data.materials[0]; nt = mat.node_tree
bsdf = [x for x in nt.nodes if x.type == 'BSDF_PRINCIPLED'][0]
for x in list(nt.nodes):
  if x.type in ('TEX_IMAGE', 'NORMAL_MAP'): nt.nodes.remove(x)
tex = nt.nodes.new('ShaderNodeTexImage'); img.scale(1024, 1024); tex.image = img
nt.links.new(tex.outputs['Color'], bsdf.inputs['Base Color'])
bsdf.inputs['Metallic'].default_value = 0; bsdf.inputs['Roughness'].default_value = .72; mat.name = 'skin'
arm.data.pose_position = 'POSE'
act = bpy.data.actions[0]; act.name = clip; print('ACTION', clip, tuple(act.frame_range))
for o in bpy.data.objects: o.select_set(o in (arm, ob))
bpy.ops.export_scene.gltf(filepath=out, export_format='GLB', use_selection=True, export_image_format='JPEG', export_image_quality=82,
  export_animations=True, export_animation_mode='ACTIONS', export_force_sampling=True, export_optimize_animation_size=True,
  export_skins=True, export_all_influences=False, export_morph=False, export_yup=True, export_normals=True, export_tangents=False, export_materials='EXPORT')
print('EXPORTED', out, round(time.time() - t, 1), 's')
