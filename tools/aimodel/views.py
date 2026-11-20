import bpy, sys, math
argv = sys.argv[sys.argv.index('--')+1:]
outp = argv[0]; views = argv[1].split(',')
sc = bpy.context.scene
sc.render.engine = 'BLENDER_WORKBENCH'
sc.display.shading.light='STUDIO'; sc.display.shading.color_type='TEXTURE'
sc.render.resolution_x=800; sc.render.resolution_y=800
sc.render.film_transparent=False
sc.world = sc.world or bpy.data.worlds.new('w')
cam_d = bpy.data.cameras.new('c'); cam_d.type='ORTHO'; cam_d.ortho_scale=1.05
cam = bpy.data.objects.new('cam', cam_d); sc.collection.objects.link(cam); sc.camera=cam
frames = [int(x) for x in argv[2].split(',')] if len(argv)>2 else [sc.frame_current]
for fr in frames:
  sc.frame_set(fr)
  for vname in views:
    ang = {'front':0,'side':90,'back':180,'q':35}[vname]
    a=math.radians(ang)
    cam.location=(3*math.sin(a), -3*math.cos(a), .49); cam.rotation_euler=(math.radians(90),0,a)
    sc.render.filepath=f'{outp}_{vname}_{fr}.png'
    bpy.ops.render.render(write_still=True)
