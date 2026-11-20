import bpy, sys, bmesh, time
argv = sys.argv[sys.argv.index('--')+1:]
src, out_blend, target = argv[0], argv[1], int(argv[2])
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=src)
ob = [o for o in bpy.data.objects if o.type=='MESH'][0]
bpy.context.view_layer.objects.active = ob; ob.select_set(True)
bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
t=time.time()
bpy.ops.object.mode_set(mode='EDIT'); bpy.ops.mesh.select_all(action='SELECT')
bpy.ops.mesh.remove_doubles(threshold=0.0001)
bpy.ops.object.mode_set(mode='OBJECT')
# drop tiny loose islands
bm = bmesh.new(); bm.from_mesh(ob.data)
seen=set(); islands=[]
for f in bm.faces:
    if f.index in seen: continue
    st=[f]; isl=[]; seen.add(f.index)
    while st:
        g=st.pop(); isl.append(g)
        for e in g.edges:
            for h in e.link_faces:
                if h.index not in seen: seen.add(h.index); st.append(h)
    islands.append(isl)
islands.sort(key=len, reverse=True)
print('ISLANDS', len(islands), [len(i) for i in islands[:10]])
kill=[f for isl in islands if len(isl)<200 for f in isl]
bmesh.ops.delete(bm, geom=kill, context='FACES'); bm.to_mesh(ob.data); bm.free()
n=len(ob.data.polygons)
m=ob.modifiers.new('dec','DECIMATE'); m.ratio=target/n; m.use_collapse_triangulate=True
bpy.ops.object.modifier_apply(modifier='dec')
print('TRIS', n, '->', len(ob.data.polygons), 'in', round(time.time()-t,1),'s')
# ground at z=0, centred
import mathutils
vs=[v.co for v in ob.data.vertices]
mn=mathutils.Vector((min(v.x for v in vs),min(v.y for v in vs),min(v.z for v in vs)))
mx=mathutils.Vector((max(v.x for v in vs),max(v.y for v in vs),max(v.z for v in vs)))
off=mathutils.Vector(((mn.x+mx.x)/2,(mn.y+mx.y)/2,mn.z))
for v in ob.data.vertices: v.co-=off
print('BOUNDS', tuple(mn-off), tuple(mx-off))
bpy.ops.object.shade_smooth()
ob.name='Body'
bpy.ops.wm.save_as_mainfile(filepath=out_blend)
