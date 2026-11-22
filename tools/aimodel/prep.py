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
# the full model is kept beside the cut-down one, to take its smooth shading from afterwards
src_ob = ob.copy(); src_ob.data = ob.data.copy(); bpy.context.scene.collection.objects.link(src_ob); src_ob.name = 'Src'
# the face keeps more of its triangles than the rest: at a few hundred the chin and mouth turn into flat facets
import numpy as np
co = np.empty(len(ob.data.vertices) * 3, dtype=np.float32); ob.data.vertices.foreach_get('co', co); co = co.reshape(-1, 3)
lo = co.min(axis=0); hi = co.max(axis=0); Hh = hi[2] - lo[2]; cx = (lo[0] + hi[0]) / 2; cy = (lo[1] + hi[1]) / 2
face = (co[:, 2] - lo[2] > .69 * Hh) & (co[:, 2] - lo[2] < .90 * Hh) & (co[:, 1] - cy < -.03 * Hh) & (np.abs(co[:, 0] - cx) < .11 * Hh)
vg = ob.vertex_groups.new(name='face'); vg.add([int(i) for i in np.nonzero(face)[0]], 1.0, 'REPLACE')
# (the modifier only cuts down the vertices in its group, so it runs twice: everything but the face, then the face)
pv = np.empty(len(ob.data.loops), dtype=np.int32); ob.data.loops.foreach_get('vertex_index', pv)
face_tris = int(face[pv].reshape(-1, 3).all(axis=1).sum()) if len(pv) == n * 3 else int(face.sum() * 2)
share = float(argv[3]) if len(argv) > 3 else .22           # how much of the triangle budget the face gets
m=ob.modifiers.new('dec','DECIMATE'); m.vertex_group = 'face'; m.invert_vertex_group = True; m.use_collapse_triangulate=True
m.ratio = (face_tris + target * (1 - share)) / n
bpy.ops.object.modifier_apply(modifier='dec')
m=ob.modifiers.new('dec','DECIMATE'); m.vertex_group = 'face'; m.use_collapse_triangulate=True
m.ratio = target / len(ob.data.polygons)
bpy.ops.object.modifier_apply(modifier='dec')
co = np.empty(len(ob.data.vertices) * 3, dtype=np.float32); ob.data.vertices.foreach_get('co', co); co = co.reshape(-1, 3)
face = (co[:, 2] - lo[2] > .69 * Hh) & (co[:, 2] - lo[2] < .90 * Hh) & (co[:, 1] - cy < -.03 * Hh) & (np.abs(co[:, 0] - cx) < .11 * Hh)
print('TRIS', n, '->', len(ob.data.polygons), 'in', round(time.time()-t,1),'s', 'FACE VERTS', int(face.sum()), 'of', len(co), 'face tris before', face_tris)
ob.vertex_groups.remove(ob.vertex_groups['face'])
# shading: every corner takes the direction the full model's surface faces there, so the cut-down one shades as smoothly
bpy.ops.object.shade_smooth()
dt = ob.modifiers.new('nrm', 'DATA_TRANSFER'); dt.object = src_ob; dt.use_loop_data = True; dt.data_types_loops = {'CUSTOM_NORMAL'}; dt.loop_mapping = 'POLYINTERP_NEAREST'
bpy.ops.object.modifier_apply(modifier='nrm')
bpy.data.objects.remove(src_ob, do_unlink=True)
print('NORMALS', ob.data.has_custom_normals, round(time.time()-t,1), 's')
# ground at z=0, centred
import mathutils
vs=[v.co for v in ob.data.vertices]
mn=mathutils.Vector((min(v.x for v in vs),min(v.y for v in vs),min(v.z for v in vs)))
mx=mathutils.Vector((max(v.x for v in vs),max(v.y for v in vs),max(v.z for v in vs)))
off=mathutils.Vector(((mn.x+mx.x)/2,(mn.y+mx.y)/2,mn.z))
for v in ob.data.vertices: v.co-=off
print('BOUNDS', tuple(mn-off), tuple(mx-off))
ob.name='Body'
bpy.ops.wm.save_as_mainfile(filepath=out_blend)
