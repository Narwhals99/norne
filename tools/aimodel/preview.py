import bpy, sys, math
argv = sys.argv[sys.argv.index('--')+1:]
outp = argv[0]
plan = [a.split(':') for a in argv[1].split(',')]  # action:time
ang = float(argv[2]) if len(argv) > 2 else 35
sc = bpy.context.scene
sc.render.engine = 'BLENDER_WORKBENCH'
sc.display.shading.light='STUDIO'; sc.display.shading.color_type='TEXTURE'
sc.render.resolution_x=400; sc.render.resolution_y=400
cam_d = bpy.data.cameras.new('c'); cam_d.type='ORTHO'; cam_d.ortho_scale=12.5
cam = bpy.data.objects.new('cam', cam_d); sc.collection.objects.link(cam); sc.camera=cam
a = math.radians(ang)
cam.location=(30*math.sin(a), -30*math.cos(a), 12); cam.rotation_euler=(math.radians(76),0,a)
arm = bpy.data.objects['Rig']
for i,(act,t) in enumerate(plan):
  arm.animation_data.action = bpy.data.actions[act]
  sc.frame_set(1 + round(float(t)*30))
  sc.render.filepath = f'{outp}_{i:02d}.png'
  bpy.ops.render.render(write_still=True)
