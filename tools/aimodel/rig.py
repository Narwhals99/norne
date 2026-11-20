# Gives the cleaned-up model (prep.py) a skeleton, skins it, and keys the moves js/aikit.js plays.
# blender -b <prep>.blend --python rig.py -- <out>.blend <joints>.json
# The moves are written a frame at a time (30 a second) from timing curves, like the toy figures' moves in js/figkit.js:
# the feet stay planted (leg IK, baked on export), the arm follows the body a beat late, and the cape swings on a spring.
import bpy, sys, math, json
from mathutils import Vector, Quaternion
argv = sys.argv[sys.argv.index('--')+1:]
out_blend = argv[0]
ob = bpy.data.objects['Body']
K = 10.0   # Blender's automatic weights fail on a model one metre tall, so everything is built ten times the size
for v in ob.data.vertices: v.co *= K
# ---------- skeleton (character faces -Y, its left is +X; metres, feet on z=0, as prep.py leaves it) ----------
# joints.json gives each bone's [head, tail] for the middle and the left side; the right side is the mirror image.
# Find the numbers from prep.py's front and side pictures (tools/aimodel/README.md).
J = json.load(open(argv[1]))
PARENT = {'hips':None, 'spine':'hips', 'chest':'spine', 'neck':'chest', 'head':'neck', 'shoulder':'chest', 'upperarm':'shoulder',
          'forearm':'upperarm', 'hand':'forearm', 'thigh':'hips', 'shin':'thigh', 'foot':'shin', 'cape1':'chest', 'cape2':'cape1'}
MID = ('hips', 'spine', 'chest', 'neck', 'head', 'cape1', 'cape2')
B = {}
for n, v in J.items():
  if n.startswith('_'): continue
  h, t = v
  if n in MID: B[n] = (h, t, PARENT[n]); continue
  for s, m in (('L', 1), ('R', -1)):
    mir = lambda p: (m * p[0], p[1], p[2])
    par = PARENT[n]; B[n + '.' + s] = (mir(h), mir(t), par if par in ('hips', 'chest') else par + '.' + s)
HAS_CAPE = 'cape1' in B
arm_d = bpy.data.armatures.new('Rig'); arm = bpy.data.objects.new('Rig', arm_d)
bpy.context.scene.collection.objects.link(arm)
bpy.context.view_layer.objects.active = arm; arm.select_set(True)
bpy.ops.object.mode_set(mode='EDIT')
for n,(h,t,p) in B.items():
  e = arm_d.edit_bones.new(n); e.head=Vector(h)*K; e.tail=Vector(t)*K
  if p: e.parent = arm_d.edit_bones[p]
for e in arm_d.edit_bones:
  e.align_roll((0,-1,0) if abs(e.vector.normalized().y) < .9 else (0,0,1))
# what the feet stand on: a handle at each ankle, shaped like the foot, that the leg reaches for (not part of the skin)
for s in 'LR':
  f = arm_d.edit_bones['foot.' + s]; e = arm_d.edit_bones.new('ik.foot.' + s)
  e.head = f.head; e.tail = f.tail; e.roll = f.roll; e.use_deform = False
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
pb = arm.pose.bones
for s in 'LR':
  c = pb['shin.' + s].constraints.new('IK'); c.target = arm; c.subtarget = 'ik.foot.' + s; c.chain_count = 2; c.use_stretch = False
  c = pb['foot.' + s].constraints.new('COPY_ROTATION'); c.target = arm; c.subtarget = 'ik.foot.' + s

# ---------- how a pose is written ----------
# Turns are in degrees about the world's axes as the character stands at rest, whatever way the bone points:
#   x: + leans a bone that points up forward (and swings one that hangs down, an arm or a leg, backward)
#   y: + tips the top of a bone to the character's left
#   z: + turns to the character's left
#   t: twists a bone about its own length
# Arms are written for the left side; the right side mirrors y, z and t.
D = math.radians
REST = {b.name: b.bone.matrix_local.to_quaternion() for b in pb}
AX = {'x':(1,0,0),'y':(0,1,0),'z':(0,0,1)}
def quat(name, rots):
  w = Quaternion(); tw = 0
  for ax, deg in rots:
    if ax == 't': tw += deg
    else: w = Quaternion(AX[ax], D(deg)) @ w
  r = REST[name]; return (r.inverted() @ w @ r) @ Quaternion((0,1,0), D(tw))
def loc(name, v): return REST[name].inverted() @ (Vector(v)*K)
clamp = lambda x, a, b: max(a, min(b, x))
lerp = lambda a, b, u: a + (b - a) * u
EASE = {'lin': lambda u: u, 'io': lambda u: u*u*(3-2*u), 'in': lambda u: u**2.4, 'out': lambda u: 1-(1-u)**3,
        'back': lambda u: 1 + 2.4*(u-1)**3 + 1.4*(u-1)**2, 'snap': lambda u: 1-(1-u)**5}
def tr(t, keys):
  """a value over time: keys are (time, value[, ease into this key])"""
  if t <= keys[0][0]: return keys[0][1]
  for a, b in zip(keys, keys[1:]):
    if t <= b[0]: return lerp(a[1], b[1], EASE[b[2] if len(b) > 2 else 'io']((t - a[0]) / (b[0] - a[0])))
  return keys[-1][1]
class Pose:
  def __init__(s): s.r = {}; s.l = {}; s.ik = 1.0; s.hang = .7; s.cape = 0.0
  def rot(s, bone, *ops): s.r.setdefault(bone, []).extend(ops); return s
  def arm(s, side, part, *ops):
    m = 1 if side == 'L' else -1
    return s.rot(part + '.' + side, *[(a, d if a == 'x' else d * m) for a, d in ops])
  def move(s, bone, x=0, y=0, z=0): o = s.l.get(bone, (0,0,0)); s.l[bone] = (o[0]+x, o[1]+y, o[2]+z); return s
  def foot(s, side, x=0, y=0, z=0, pitch=0, yaw=0):
    """where the ankle is (metres from where it stands at rest); pitch + lifts the heel, yaw + turns the toes out"""
    m = 1 if side == 'L' else -1
    s.move('ik.foot.' + side, x * m, y, z); return s.rot('ik.foot.' + side, ('x', pitch), ('z', yaw * m))
TWO_PI = 2 * math.pi
def relaxed(p, sway=0):
  """arms hanging by the sides with soft elbows and the palms turned in (the model is built in an A-pose, palms forward)"""
  for sd in 'LR':
    p.arm(sd, 'upperarm', ('y', 31), ('x', 3), ('t', TWIST * .4))
    p.arm(sd, 'forearm', ('x', -14), ('t', TWIST * .6))
    p.arm(sd, 'hand', ('y', 6), ('x', -6))
  return p
TWIST = float(J.get('_palmTwist', 80))   # how far the arms turn to bring the palms in

FPS = 30
bpy.context.scene.render.fps = FPS
arm.animation_data_create()
for b in pb: b.rotation_mode = 'QUATERNION'
def key(fn, dur, name, loop=False):
  act = bpy.data.actions.new(name); arm.animation_data.action = act
  n = round(dur * FPS); a = v = a2 = v2 = 0.0; h = 1 / FPS / 4
  pitch_of = lambda p: sum(d for b in ('hips', 'spine', 'chest') for ax, d in p.r.get(b, []) if ax == 'x')
  # the cape is a pendulum on a soft spring: it hangs straight while the body leans, and trails what the hips do
  frames = list(range(-n, n + 1)) if loop else list(range(-8, n + 1))
  prev = None
  for f in frames:
    t = f / FPS; p = fn(t % dur if loop else max(0, t))
    hy = p.l.get('hips', (0,0,0))[1]; vy = 0 if prev is None else (hy - prev) * FPS; prev = hy
    target = clamp(-pitch_of(p) * p.hang + p.cape - vy * 22, -24, 30)
    for _ in range(4):
      v += (160 * (target - a) - 7 * v) * h; a += v * h
      v2 += (110 * (a - a2) - 6 * v2) * h; a2 += v2 * h
    if f < 0: continue
    if HAS_CAPE: p.rot('cape1', ('x', a)); p.rot('cape2', ('x', clamp(a2 - a, -30, 40)))
    fr = f
    for b in pb:
      b.rotation_quaternion = quat(b.name, p.r.get(b.name, [])); b.location = loc(b.name, p.l.get(b.name, (0,0,0)))
      b.keyframe_insert('rotation_quaternion', frame=fr); b.keyframe_insert('location', frame=fr)
    for s in 'LR':
      for bn in ('shin.', 'foot.'):
        c = pb[bn + s].constraints[0]; c.influence = p.ik; c.keyframe_insert('influence', frame=fr)
  act.use_fake_user = True
  tr_ = arm.animation_data.nla_tracks.new(); tr_.name = name; tr_.strips.new(name, 0, act); tr_.mute = True
  arm.animation_data.action = None
  print('ACTION', name, tuple(act.frame_range))

# ---------- idle: breathing, the weight drifting from foot to foot, the head looking about (4 s, loops) ----------
def idle(t, p=None):
  p = relaxed(p or Pose()); u = t / 4 * TWO_PI
  br = math.sin(u * 2); sh = math.sin(u); look = math.sin(u + 1.1)
  p.move('hips', x=.012 * sh, z=-.006 - .003 * br - .004 * abs(sh)).rot('hips', ('y', -1.6 * sh), ('z', 1.5 * sh))
  p.rot('spine', ('y', 1.2 * sh), ('x', 1 + .8 * br)).rot('chest', ('x', -1.8 * br), ('y', 1.0 * sh), ('z', -2 * sh))
  p.rot('neck', ('x', .8 * br)).rot('head', ('z', 5 * look - 1.5 * sh), ('x', 1.2 * math.sin(u * 2 + .8)), ('y', -1.2 * sh))
  for sd, m in (('L', 1), ('R', -1)):
    lag = math.sin(u - .5)
    p.arm(sd, 'upperarm', ('y', -1.6 * br + 1.2 * lag * m), ('x', 1.5 * math.sin(u * 2 - .6)))
    p.arm(sd, 'forearm', ('x', -2 - 2 * math.sin(u * 2 - 1.1)))
  p.foot('L', yaw=7).foot('R', yaw=7)
  return p
key(idle, 4.0, 'idle', loop=True)
I0 = lambda: idle(0)

# ---------- walk: two steps in 0.8 s, on the spot (the board moves the figure) ----------
def walk(t):
  p = relaxed(Pose()); u = (t / .8) % 1; ph = u * TWO_PI
  def step(v):   # v 0..1: 0-.5 on the ground sliding back, .5-1 in the air coming forward
    if v < .5: w = v / .5; return (.075 - .15 * w, 0, lerp(-10, 14, w) if w > .6 else lerp(-8, 0, min(1, w / .25)) if w < .25 else 0)
    w = (v - .5) / .5; e = w * w * (3 - 2 * w)
    return (-.075 + .15 * e, .042 * math.sin(w * math.pi) ** .9, lerp(26, -12, e))
  for sd, off in (('L', 0), ('R', .5)):
    y, z, pt = step((u + off) % 1); p.foot(sd, y=-y, z=z + (abs(pt) * .0006 if pt > 0 else 0), pitch=pt, yaw=4)
  s = math.sin(ph); c2 = math.cos(ph * 2)
  p.move('hips', x=-.012 * math.sin(ph + .4), z=-.016 + .010 * c2, y=-.008).rot('hips', ('z', 7 * math.cos(ph)), ('y', 2.5 * math.sin(ph + .4)), ('x', 3))
  p.rot('spine', ('z', -5 * math.cos(ph)), ('x', 2)).rot('chest', ('z', -8 * math.cos(ph)), ('y', -2 * math.sin(ph + .4)), ('x', 2 + 1.2 * c2))
  p.rot('head', ('z', 6 * math.cos(ph)), ('x', -3 - 1.2 * math.cos(ph * 2 - .5)))
  for sd, m in (('L', 1), ('R', -1)):
    sw = math.cos(ph - .25) * m; sw2 = math.cos(ph - .6) * m
    p.arm(sd, 'upperarm', ('x', -24 * sw + 2)); p.arm(sd, 'forearm', ('x', -16 - 16 * max(-.2, sw2))); p.arm(sd, 'hand', ('x', -8 * sw2))
  return p
key(walk, .8, 'walk', loop=True)

# ---------- attack: a step in, a wind-up over the shoulder, a chop that lands 0.72 s in, and back (1.7 s) ----------
def attack(t):
  p = Pose()
  ready = tr(t, [(0, 0), (.22, 1), (1.22, 1), (1.62, 0)])
  wind = tr(t, [(.10, 0), (.52, 1, 'out'), (.60, 1.06), (.70, 0, 'in'), (1.7, 0)])           # torso coiled back
  hit = tr(t, [(.58, 0), (.70, .92, 'in'), (.79, 1.08, 'out'), (.95, 1, 'io'), (1.22, 1), (1.6, 0)])  # weight thrown in
  # the arms hang as in idle, minus the sword arm once it is up
  for sd in 'LR':
    k = 1 if sd == 'L' else 1 - tr(t, [(.12, 0), (.4, 1), (1.3, 1), (1.62, 0)])
    p.arm(sd, 'upperarm', ('y', 31), ('x', 3 * k), ('t', TWIST * .4)); p.arm(sd, 'forearm', ('x', -14 * k), ('t', TWIST * .6)); p.arm(sd, 'hand', ('y', 6), ('x', -6 * k))
  # feet: the left steps in before the blow and back after it; the right heel comes up as the weight goes over
  sy = tr(t, [(.10, 0), (.34, .11, 'io'), (1.24, .11), (1.52, 0, 'io')])
  sz = .035 * math.sin(math.pi * tr(t, [(.10, 0), (.34, 1, 'lin')])) * (t < .34) + .03 * math.sin(math.pi * tr(t, [(1.24, 0), (1.52, 1, 'lin')])) * (t > 1.24)
  p.foot('L', y=-sy, z=sz, pitch=tr(t, [(.10, 0), (.2, 10), (.34, 0)]), yaw=7 - 5 * ready)
  p.foot('R', pitch=24 * hit, z=.022 * hit, y=-.012 * hit, yaw=7 + 16 * ready)
  # hips and spine: sink back while winding, drive forward and down into the blow, a little bounce, then up
  p.move('hips', y=-.045 * ready + .03 * wind - .06 * hit, z=-.02 * ready - .012 * wind - .024 * hit, x=-.01 * ready)
  p.rot('hips', ('z', -10 * wind + 12 * hit - 6 * ready), ('x', 2 * ready - 3 * wind + 6 * hit))
  p.rot('spine', ('z', -11 * wind + 9 * hit), ('x', 3 * ready - 5 * wind + 6 * hit), ('y', -3 * wind))
  p.rot('chest', ('z', -15 * wind + 12 * hit), ('x', -6 * wind + 7 * hit), ('y', -4 * wind + 3 * hit))
  p.rot('neck', ('z', 9 * wind - 8 * hit)).rot('head', ('z', 22 * wind - 14 * hit + 5 * ready), ('x', -3 * wind - 9 * hit))
  # the sword arm: up and back with the elbow bent, then the shoulder leads, the elbow opens and the wrist snaps
  up = tr(t, [(.12, 0), (.50, -160, 'io'), (.61, -168), (.72, -86, 'in'), (.80, -62, 'out'), (.98, -66), (1.25, -62), (1.62, 0)])
  out = tr(t, [(.12, 0), (.5, 48), (.61, 44), (.72, 6, 'in'), (1.25, 2), (1.62, 0)])
  el = tr(t, [(.12, 0), (.5, -30), (.63, -42), (.74, -16, 'in'), (.83, -6, 'out'), (1.25, -18), (1.62, 0)])
  wr = tr(t, [(.3, 0), (.58, -22), (.65, -26), (.72, 16, 'in'), (.8, 24, 'out'), (.95, 10), (1.25, 2), (1.62, 0)])
  p.arm('R', 'shoulder', ('y', tr(t, [(.12, 0), (.5, -14), (.72, 0), (1.7, 0)])))
  p.arm('R', 'upperarm', ('x', up), ('y', out)); p.arm('R', 'forearm', ('x', el)); p.arm('R', 'hand', ('x', wr))
  # the other arm: forward for balance in the wind-up, thrown back as the blow lands
  la = tr(t, [(.12, 0), (.5, -28), (.62, -32), (.74, 30, 'in'), (.92, 22), (1.25, 14), (1.62, 0)])
  p.arm('L', 'upperarm', ('x', la), ('y', tr(t, [(.12, 0), (.5, -14), (.76, -10), (1.62, 0)])))
  p.arm('L', 'forearm', ('x', tr(t, [(.12, 0), (.5, -62), (.8, -34), (1.62, 0)])))
  # ease out of and back into the idle's first frame
  if t > 1.5: p.move('hips', z=-.006 * tr(t, [(1.5, 0), (1.7, 1)]))
  elif t < .15: p.move('hips', z=-.006 * (1 - t / .15))
  return p
key(attack, 1.7, 'attack')

# ---------- hit: struck at 0.2 s, knocked back onto the back foot, and back up (1.3 s) ----------
def hit(t, big=1.0, back=True, fade=1.0):
  p = Pose()
  k = tr(t, [(.2, 0), (.29, 1, 'snap'), (.5, .62, 'io'), (.78, -.12, 'io'), (1.02, .03), (1.3, 0)]) * big * fade      # the body thrown back, then over-correcting
  kh = tr(t, [(.23, 0), (.34, 1, 'snap'), (.56, .5, 'io'), (.84, -.15, 'io'), (1.1, .03), (1.3, 0)]) * big * fade    # the head a beat later
  ka = tr(t, [(.22, 0), (.36, 1, 'out'), (.62, .55, 'io'), (.95, -.08, 'io'), (1.3, 0)]) * big * fade                # the arms later still
  for sd in 'LR':
    p.arm(sd, 'upperarm', ('y', 31 - 20 * ka), ('x', 3 - 14 * ka), ('t', TWIST * .4)); p.arm(sd, 'forearm', ('x', -14 - 30 * ka), ('t', TWIST * .6)); p.arm(sd, 'hand', ('y', 6), ('x', -6 - 14 * ka))
  p.arm('L', 'upperarm', ('x', -10 * ka)); p.arm('R', 'upperarm', ('x', 12 * ka))
  p.move('hips', y=.07 * k, z=-.006 - .03 * abs(k), x=.012 * k).rot('hips', ('x', -7 * k), ('z', 9 * k))
  p.rot('spine', ('x', -10 * k), ('z', 5 * k)).rot('chest', ('x', -14 * k), ('z', 8 * k), ('y', 4 * k))
  p.rot('neck', ('x', -8 * kh)).rot('head', ('x', -20 * kh), ('z', -12 * kh), ('y', 6 * kh))
  if back:
    # the right foot is knocked back a step to catch the weight, and comes home once it is steady again
    sy = tr(t, [(.24, 0), (.42, .12, 'out'), (.8, .12), (1.12, 0, 'io')]) * big
    sz = .03 * (math.sin(math.pi * tr(t, [(.24, 0), (.42, 1, 'lin')])) * (t < .42) + math.sin(math.pi * tr(t, [(.8, 0), (1.12, 1, 'lin')])) * (t > .8)) * big
    p.foot('R', y=sy, z=sz, pitch=tr(t, [(.24, 0), (.32, 14), (.42, 0), (.8, 0), (.95, 12), (1.12, 0)]) * big, yaw=7 + 8 * abs(k))
    p.foot('L', yaw=7)
  else: p.foot('L', yaw=7).foot('R', yaw=7)
  return p
key(hit, 1.3, 'hit')

# ---------- down: struck at 0.2 s, the knees give and it sits back, rolls onto its back by 1 s with a bounce (1.5 s) ----------
def down(t):
  sit = tr(t, [(.3, 0), (.64, 1, 'in'), (1.5, 1)])                                # the knees giving, hips dropping back
  roll = tr(t, [(.52, 0), (.94, 1, 'in'), (1.5, 1)])                              # the back going over onto the ground
  land = tr(t, [(.94, 0), (1.0, 1, 'out'), (1.14, 0, 'io'), (1.5, 0)])            # the bounce off the ground
  p = hit(min(t, .36), 1.2, back=False, fade=1 - .85 * tr(t, [(.36, 0), (.9, 1)]))
  p.ik = tr(t, [(.6, 1), (.86, 0, 'io')])
  p.hang = .7 * (1 - roll); p.cape = -6 * roll
  p.rot('hips', ('x', -22 * sit - 58 * roll + 3 * land)).move('hips', y=.06 * sit + .05 * roll, z=-.20 * sit - .125 * roll + .02 * land)
  curl = math.sin(math.pi * roll)                                                 # chin tucked and back rounded while going over
  p.rot('spine', ('x', 14 * sit * (1 - roll) + 8 * curl - 4 * land)).rot('chest', ('x', 12 * sit * (1 - roll) + 8 * curl - 5 * land))
  p.rot('neck', ('x', 12 * curl)).rot('head', ('x', 10 * sit * (1 - roll) + 22 * curl + 12 * land), ('z', -20 * roll))
  # the legs: planted while it sits back, then they kick up as the back lands and drop, one a little bent
  kick = tr(t, [(.6, 0), (.92, 1, 'io'), (1.2, 0, 'io'), (1.5, 0)])
  for sd, m, bent in (('L', 1, 1), ('R', -1, 0)):
    p.rot('thigh.' + sd, ('x', -70 * sit * (1 - roll) - 30 * kick - 14 * bent * roll), ('y', (5 + 4 * bent) * roll * m), ('z', 12 * bent * roll))
    p.rot('shin.' + sd, ('x', 80 * sit * (1 - roll) + 22 * kick + 28 * bent * roll)).rot('foot.' + sd, ('x', 16 * roll), ('y', 10 * roll * m))
  # the arms reach as it goes, trail behind the body, then fall open on the ground
  reach = math.sin(math.pi * tr(t, [(.3, 0), (1.12, 1, 'lin')])) ** 1.3
  open_ = tr(t, [(.8, 0), (1.12, 1, 'io')])
  p.arm('L', 'upperarm', ('x', -50 * reach + 6 * open_), ('y', -18 * reach - 16 * open_)); p.arm('R', 'upperarm', ('x', -42 * reach + 6 * open_), ('y', -14 * reach - 40 * open_))
  p.arm('L', 'forearm', ('x', -24 * reach + 12 * open_)); p.arm('R', 'forearm', ('x', -30 * reach + 4 * open_))
  return p
key(down, 1.5, 'down')
bpy.context.scene.frame_set(1)
bpy.ops.wm.save_as_mainfile(filepath=out_blend)
