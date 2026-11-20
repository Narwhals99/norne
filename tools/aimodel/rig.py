# Gives the cleaned-up model (prep.py) a skeleton, skins it, and keys the moves js/aikit.js plays.
# blender -b <prep>.blend --python rig.py -- <out>.blend <joints>.json
import bpy, sys, math
from mathutils import Vector, Quaternion
argv = sys.argv[sys.argv.index('--')+1:]
out_blend = argv[0]
ob = bpy.data.objects['Body']
K = 10.0
for v in ob.data.vertices: v.co *= K
# ---------- skeleton (character faces -Y, its left is +X; metres, feet on z=0, as prep.py leaves it) ----------
# joints.json gives each bone's [head, tail] for the middle and the left side; the right side is the mirror image.
# Find the numbers from prep.py's front and side pictures (tools/aimodel/README.md).
import json
J = json.load(open(argv[1]))
PARENT = {'hips':None, 'spine':'hips', 'chest':'spine', 'neck':'chest', 'head':'neck', 'shoulder':'chest', 'upperarm':'shoulder',
          'forearm':'upperarm', 'hand':'forearm', 'thigh':'hips', 'shin':'thigh', 'foot':'shin'}
B = {}
for n, (h, t) in J.items():
  if n in ('hips', 'spine', 'chest', 'neck', 'head'): B[n] = (h, t, PARENT[n]); continue
  for s, m in (('L', 1), ('R', -1)):
    mir = lambda p: (m * p[0], p[1], p[2])
    par = PARENT[n]; B[n + '.' + s] = (mir(h), mir(t), par if par in ('hips', 'chest') else par + '.' + s)
arm_d = bpy.data.armatures.new('Rig'); arm = bpy.data.objects.new('Rig', arm_d)
bpy.context.scene.collection.objects.link(arm)
bpy.context.view_layer.objects.active = arm; arm.select_set(True)
bpy.ops.object.mode_set(mode='EDIT')
for n,(h,t,p) in B.items():
  e = arm_d.edit_bones.new(n); e.head=Vector(h)*K; e.tail=Vector(t)*K
  if p: e.parent = arm_d.edit_bones[p]
for e in arm_d.edit_bones:
  e.align_roll((0,-1,0) if abs(e.vector.normalized().y) < .9 else (0,0,1))
bpy.ops.object.mode_set(mode='OBJECT')
# ---------- skin ----------
bpy.ops.object.select_all(action='DESELECT')
ob.select_set(True); arm.select_set(True); bpy.context.view_layer.objects.active = arm
bpy.ops.object.parent_set(type='ARMATURE_AUTO')
unw = sum(1 for v in ob.data.vertices if not v.groups)
print('UNWEIGHTED', unw, 'of', len(ob.data.vertices))
bpy.ops.object.select_all(action='DESELECT')
ob.select_set(True); bpy.context.view_layer.objects.active = ob
bpy.ops.object.vertex_group_limit_total(limit=4)
bpy.ops.object.vertex_group_normalize_all(lock_active=False)

# ---------- animation helpers ----------
D = math.radians
pb = arm.pose.bones
REST = {b.name: b.bone.matrix_local.to_quaternion() for b in pb}
AX = {'x':(1,0,0),'y':(0,1,0),'z':(0,0,1)}
def q(name, rots):
  # rotations about world axes, in the bone's rest frame
  w = Quaternion()
  for ax,deg in rots: w = Quaternion(AX[ax], D(deg)) @ w
  r = REST[name]; return r.inverted() @ w @ r
def loc(name, v): return REST[name].inverted() @ (Vector(v)*K)
FPS = 30
bpy.context.scene.render.fps = FPS
arm.animation_data_create()
for b in pb: b.rotation_mode = 'QUATERNION'
def key(poses, name):
  act = bpy.data.actions.new(name); arm.animation_data.action = act
  for t, pose in poses:
    f = 1 + round(t*FPS)
    for b in pb:
      sp = pose.get(b.name, {})
      b.rotation_quaternion = q(b.name, sp.get('r', []))
      b.location = loc(b.name, sp.get('l', (0,0,0)))
      b.keyframe_insert('rotation_quaternion', frame=f); b.keyframe_insert('location', frame=f)
  act.use_fake_user = True
  tr = arm.animation_data.nla_tracks.new(); tr.name = name; tr.strips.new(name, 1, act); tr.mute = True
  arm.animation_data.action = None
  print('ACTION', name, tuple(act.frame_range))
def merge(*ps):
  out = {}
  for p in ps:
    for k,v in p.items():
      o = out.setdefault(k, {'r':[], 'l':(0,0,0)})
      o['r'] = o['r'] + v.get('r', [])
      if 'l' in v: o['l'] = tuple(a+b for a,b in zip(o['l'], v['l']))
  return out
REL = {'upperarm.L':{'r':[('y',38),('x',6)]}, 'upperarm.R':{'r':[('y',-38),('x',6)]},
       'forearm.L':{'r':[('x',10)]}, 'forearm.R':{'r':[('x',10)]},
       'hand.L':{'r':[('y',20)]}, 'hand.R':{'r':[('y',-20)]}}
def breathe(u):
  s = math.sin(u*2*math.pi)
  return merge(REL, {'chest':{'r':[('x',-2*s)]}, 'head':{'r':[('x',1.5*s),('z',2*math.sin(u*2*math.pi+1))]},
     'hips':{'l':(0,0,.003*s)}, 'upperarm.L':{'r':[('y',-2*s)]}, 'upperarm.R':{'r':[('y',2*s)]}})
STANCE = merge(REL, {'hips':{'l':(0,0,-.012)}, 'thigh.L':{'r':[('x',8),('y',-4)]}, 'thigh.R':{'r':[('x',-6),('y',4)]},
   'shin.L':{'r':[('x',-12)]}, 'shin.R':{'r':[('x',-4)]}, 'spine':{'r':[('x',4)]}})
key([(i/8*2.0, breathe(i/8)) for i in range(9)], 'idle')
def walk(u):
  s = math.sin(u*2*math.pi); c = math.cos(u*4*math.pi)
  return merge(REL, {'thigh.L':{'r':[('x',-24*s)]}, 'thigh.R':{'r':[('x',24*s)]},
    'shin.L':{'r':[('x',20*max(0,s))]}, 'shin.R':{'r':[('x',20*max(0,-s))]},
    'upperarm.L':{'r':[('x',18*s)]}, 'upperarm.R':{'r':[('x',-18*s)]}, 'hips':{'l':(0,0,.008*c),'r':[('z',4*s)]}, 'chest':{'r':[('z',-5*s)]}})
key([(i/8*.8, walk(i/8)) for i in range(9)], 'walk')
WIND = merge(STANCE, {'upperarm.R':{'r':[('y',125),('x',-35)]}, 'forearm.R':{'r':[('x',-55)]}, 'hand.R':{'r':[('x',-20)]},
   'chest':{'r':[('z',-18),('x',-8)]}, 'spine':{'r':[('z',-8)]}, 'upperarm.L':{'r':[('x',-30)]}, 'head':{'r':[('x',-6)]}, 'hips':{'l':(0,.01,0)}})
STRIKE = merge(STANCE, {'upperarm.R':{'r':[('x',-80),('z',-25)]}, 'forearm.R':{'r':[('x',-10)]}, 'hand.R':{'r':[('x',25)]},
   'chest':{'r':[('z',16),('x',16)]}, 'spine':{'r':[('z',8),('x',8)]}, 'upperarm.L':{'r':[('x',22)]}, 'head':{'r':[('x',-10)]},
   'thigh.R':{'r':[('x',-22)]}, 'shin.R':{'r':[('x',-10)]}, 'hips':{'l':(0,-.03,-.025)}})
FOLLOW = merge(STANCE, {'upperarm.R':{'r':[('x',-55),('z',-40)]}, 'forearm.R':{'r':[('x',-5)]}, 'chest':{'r':[('z',22),('x',20)]},
   'spine':{'r':[('z',10),('x',10)]}, 'thigh.R':{'r':[('x',-22)]}, 'hips':{'l':(0,-.035,-.03)}})
key([(0, breathe(0)), (.18, STANCE), (.5, WIND), (.62, WIND), (.72, STRIKE), (.9, FOLLOW), (1.2, FOLLOW), (1.7, breathe(0))], 'attack')
REEL = merge(STANCE, {'chest':{'r':[('x',-22),('z',8)]}, 'spine':{'r':[('x',-10)]}, 'head':{'r':[('x',-18),('z',-10)]},
   'upperarm.L':{'r':[('x',-30),('y',8)]}, 'upperarm.R':{'r':[('x',-30),('y',-8)]}, 'forearm.L':{'r':[('x',-60)]}, 'forearm.R':{'r':[('x',-60)]},
   'hips':{'l':(0,.035,-.01)}, 'thigh.L':{'r':[('x',14)]}, 'shin.L':{'r':[('x',-10)]}})
key([(0, breathe(0)), (.2, breathe(0)), (.32, REEL), (.55, merge(REEL, {'chest':{'r':[('x',6)]}})), (1.3, breathe(0))], 'hit')
FALL = merge(REEL, {'hips':{'r':[('x',-35)], 'l':(0,.06,-.06)}, 'thigh.L':{'r':[('x',30)]}, 'thigh.R':{'r':[('x',20)]}, 'shin.L':{'r':[('x',-30)]}})
LIE = merge(REL, {'hips':{'r':[('x',-88)], 'l':(0,.20,-.335)}, 'head':{'r':[('x',10),('z',-25)]}, 'chest':{'r':[('x',4)]},
   'upperarm.L':{'r':[('y',30),('x',-10)]}, 'upperarm.R':{'r':[('y',-55),('x',-20)]}, 'forearm.R':{'r':[('x',-25)]},
   'thigh.L':{'r':[('x',12),('y',-6)]}, 'thigh.R':{'r':[('x',2),('y',8)]}, 'shin.L':{'r':[('x',-14)]}})
key([(0, breathe(0)), (.2, breathe(0)), (.32, REEL), (.6, FALL), (.95, merge(LIE, {'hips':{'l':(0,0,.02)}})), (1.08, LIE), (1.5, LIE)], 'down')
bpy.context.scene.frame_set(1)
bpy.ops.wm.save_as_mainfile(filepath=out_blend)
