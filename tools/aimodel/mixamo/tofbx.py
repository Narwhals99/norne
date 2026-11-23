# the cut-down model (prep.blend) as an FBX to upload to Mixamo: blender -b <prep.blend> --python tofbx.py -- <out.fbx>
import bpy, sys
out = sys.argv[sys.argv.index('--')+1]
ob = bpy.data.objects['Body']
for o in list(bpy.data.objects):
  if o is not ob: bpy.data.objects.remove(o, do_unlink=True)
mat = ob.data.materials[0]; nt = mat.node_tree
bsdf = [n for n in nt.nodes if n.type == 'BSDF_PRINCIPLED'][0]
base = bsdf.inputs['Base Color'].links[0].from_node
for name in ('Normal', 'Metallic', 'Roughness'):
  for l in list(bsdf.inputs[name].links): nt.links.remove(l)
for n in list(nt.nodes):
  if n.type in ('NORMAL_MAP', 'SEPARATE_COLOR') or (n.type == 'TEX_IMAGE' and n != base): nt.nodes.remove(n)
base.image.scale(1024, 1024); base.image.pack()
ob.select_set(True); bpy.context.view_layer.objects.active = ob
bpy.ops.export_scene.fbx(filepath=out, use_selection=True, apply_scale_options='FBX_SCALE_ALL', path_mode='COPY', embed_textures=True, mesh_smooth_type='OFF', add_leaf_bones=False)
print('WROTE', out, len(ob.data.polygons), 'tris')
