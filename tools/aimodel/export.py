import bpy, sys
argv = sys.argv[sys.argv.index('--')+1:]
out, size = argv[0], int(argv[1])
ob = bpy.data.objects['Body']
mat = ob.data.materials[0]; nt = mat.node_tree
bsdf = [n for n in nt.nodes if n.type == 'BSDF_PRINCIPLED'][0]
base = bsdf.inputs['Base Color'].links[0].from_node
for name in ('Normal', 'Metallic', 'Roughness'):
  for l in list(bsdf.inputs[name].links): nt.links.remove(l)
bsdf.inputs['Metallic'].default_value = 0.0
bsdf.inputs['Roughness'].default_value = 0.72
for n in list(nt.nodes):
  if n.type in ('NORMAL_MAP', 'SEPARATE_COLOR') or (n.type == 'TEX_IMAGE' and n != base): nt.nodes.remove(n)
img = base.image; img.scale(size, size)
mat.name = 'skin'
for o in bpy.data.objects: o.select_set(o.name in ('Body', 'Rig'))
bpy.ops.export_scene.gltf(filepath=out, export_format='GLB', use_selection=True,
  export_image_format='JPEG', export_image_quality=82, export_animations=True, export_animation_mode='ACTIONS',
  export_force_sampling=True, export_optimize_animation_size=True, export_skins=True, export_all_influences=False,
  export_morph=False, export_yup=True, export_apply=False, export_texcoords=True, export_normals=True,
  export_tangents=False, export_materials='EXPORT')
print('EXPORTED', out)
