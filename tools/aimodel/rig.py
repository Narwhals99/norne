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
# what the hands hold: a grip in each palm that js/aikit.js hangs the weapon on (the weapon's length runs along it),
# and a free handle that says which way the weapon points whatever the arm is doing (upright at rest, its front forward)
for s in 'LR':
  hd = arm_d.edit_bones['hand.' + s]
  g = arm_d.edit_bones.new('grip.' + s); g.head = hd.head + (hd.tail - hd.head) * .45; g.tail = g.head + Vector((0, 0, .06 * K)); g.roll = 0; g.parent = hd; g.use_deform = False
  a = arm_d.edit_bones.new('aim.' + s); a.head = Vector(((.3 if s == 'L' else -.3) * K, 0, 1.2 * K)); a.tail = a.head + Vector((0, 0, .06 * K)); a.roll = 0; a.use_deform = False
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
  c = pb['grip.' + s].constraints.new('COPY_ROTATION'); c.target = arm; c.subtarget = 'aim.' + s
  arm_d.bones['grip.' + s].use_deform = True    # so the export keeps it (it moves no skin)
print('AIM FRONT', tuple(round(x, 2) for x in arm_d.bones['aim.L'].z_axis))

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
  def aim(s, side, pitch=0, yaw=0, roll=0):
    """which way the weapon in that hand points: pitch 0 is straight up, 90 level and forward, more is downward;
    yaw + swings it to the character's left; roll tips it sideways (a bow canted)"""
    s.r['aim.' + side] = [('y', roll), ('x', pitch), ('z', yaw)]; return s
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
    for sd in 'LR': p.r.setdefault('aim.' + sd, [('x', 100)])
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
  # each foot: half the time on the ground sliding straight back, half in the air coming forward. The boots are stiff,
  # so the foot only tips a little (heel up as it leaves the ground); the knee does the lifting.
  def step(v):
    if v < .5: y = lerp(.055, -.055, v / .5); z = 0
    else: w = (v - .5) / .5; y = lerp(-.055, .055, .5 - .5 * math.cos(math.pi * w)); z = .034 * math.sin(math.pi * w) ** 1.2
    pt = 9 * max(0, math.sin(TWO_PI * (v - .38) / 1.1)) if .38 < v < .93 else 0
    return y, z + .0005 * pt, pt
  for sd, off in (('L', 0), ('R', .5)):
    y, z, pt = step((u + off) % 1); p.foot(sd, y=-y, z=z, pitch=pt, yaw=4)
    # knees always a little bent and pointing forward, so the legs never lock straight and pop
    p.rot('thigh.' + sd, ('x', -18)).rot('shin.' + sd, ('x', 34))
  c = math.cos(ph); sn = math.sin(ph); c2 = math.cos(ph * 2)
  # hips: lowest as each foot lands, over the standing leg, turning with the leading leg; the chest turns against them
  p.move('hips', x=.007 * sn, z=-.03 - .005 * c2, y=-.006).rot('hips', ('z', -5 * c), ('y', -1.5 * sn), ('x', 3))
  p.rot('spine', ('z', 3 * c), ('x', 2)).rot('chest', ('z', 6 * c), ('y', 1.5 * sn), ('x', 2 - c2))
  p.rot('head', ('z', -4 * c), ('x', -3))
  for sd, m in (('L', 1), ('R', -1)):
    sw = math.cos(ph - .2) * m; sw2 = math.cos(ph - .55) * m      # each arm swings against its own leg, the forearm a beat late
    p.arm(sd, 'upperarm', ('x', 20 * sw + 2)); p.arm(sd, 'forearm', ('x', -14 + 12 * min(.3, sw2))); p.arm(sd, 'hand', ('x', 5 * sw2))
  return p
key(walk, .8, 'walk', loop=True)

# ---------- close attacks: every one lands 0.72 s in and is over by 1.7 s, like the toy figures' (js/armory.js) ----------
def hang(p, t, sides='LR', t0=.12, t1=.4, t2=1.3, t3=1.62):
  """the arms as in idle; the ones named in `sides` let go of that pose while they work"""
  for sd in 'LR':
    k = 1 - tr(t, [(t0, 0), (t1, 1), (t2, 1), (t3, 0)]) if sd in sides else 1
    p.arm(sd, 'upperarm', ('y', 31), ('x', 3 * k), ('t', TWIST * .4)); p.arm(sd, 'forearm', ('x', -14 * k), ('t', TWIST * .6)); p.arm(sd, 'hand', ('y', 6), ('x', -6 * k))
def stance(p, t, yaw=0, lean=0, fwd=0, sink=0, step=.11, heel=0, tin=(.10, .34), tout=(1.24, 1.52), side=0):
  """feet and body for an attack: the left foot steps in and later back, the hips carry the weight (fwd in metres,
  + is back), the turn and the lean are spread up the spine, and the head keeps looking at the target"""
  ready = tr(t, [(tin[0], 0), (tin[1] - .12, 1), (tout[0] - .02, 1), (tout[1] + .1, 0)])
  sy = tr(t, [(tin[0], 0), (tin[1], step, 'io'), (tout[0], step), (tout[1], 0, 'io')])
  sz = .035 * math.sin(math.pi * tr(t, [(tin[0], 0), (tin[1], 1, 'lin')])) * (t < tin[1]) + .03 * math.sin(math.pi * tr(t, [(tout[0], 0), (tout[1], 1, 'lin')])) * (t > tout[0])
  p.foot('L', y=-sy, z=sz, pitch=tr(t, [(tin[0], 0), (tin[0] + .1, 10), (tin[1], 0)]), yaw=7 - 5 * ready)
  p.foot('R', pitch=24 * heel, z=.022 * heel, y=-.012 * heel, yaw=7 + 16 * ready)
  p.move('hips', y=-.4 * step * ready + fwd, z=-.006 - .016 * ready - sink, x=-.01 * ready + side)
  p.rot('hips', ('z', .3 * yaw - 6 * ready), ('x', 2 * ready + .3 * lean))
  p.rot('spine', ('z', .3 * yaw), ('x', 3 * ready + .32 * lean)).rot('chest', ('z', .4 * yaw), ('x', .38 * lean))
  p.rot('neck', ('z', -.25 * yaw)).rot('head', ('z', -.45 * yaw + 5 * ready), ('x', -.45 * lean))
  return ready
def W3(t, w, h, f, rest=0):
  """one number through an attack: rest, the wind-up, the blow (0.72 s), the follow-through, and back"""
  return tr(t, [(.12, rest), (.50, w, 'io'), (.60, w + (w - h) * .05), (.72, h, 'in'), (.80, f, 'out'), (1.22, f * .96 + h * .04), (1.62, rest)])
def swing(t, R, L, yaw, lean, fwd, sink, aimR, aimL=None, step=.11, both=False):
  """a one-blow attack. R and L are each arm's (up, out, sweep, elbow, wrist), every one given as (wind-up, blow,
  follow-through): up - is forward and up, out + is away from the body with the arm raised, sweep + swings a raised arm
  outward, elbow - bends it. yaw, lean, fwd and sink are (wind-up, blow). aimR/aimL: (pitch, yaw) of the weapon at each."""
  p = Pose(); hang(p, t, 'LR')
  hit = tr(t, [(.58, 0), (.70, .92, 'in'), (.79, 1.08, 'out'), (.95, 1), (1.22, 1), (1.6, 0)])
  two = lambda v: W3(t, v[0], v[1], v[1] * 1.05)
  stance(p, t, yaw=two(yaw), lean=two(lean), fwd=two(fwd), sink=two(sink), step=step, heel=hit)
  for sd, A, lagt in (('R', R, 0), ('L', L, .0)):
    up, out, sw, el, wr = [W3(t - lagt, *A[k]) for k in range(5)]
    el = W3(t - .025, *A[3]); wr = W3(t - .04, *A[4])        # the elbow opens a beat after the shoulder, the wrist after that
    p.arm(sd, 'upperarm', ('x', up), ('y', out), ('z', sw)); p.arm(sd, 'forearm', ('x', el)); p.arm(sd, 'hand', ('x', wr))
  p.aim('R', W3(t - .03, aimR[0][0], aimR[1][0], aimR[2][0], 100), W3(t - .03, aimR[0][1], aimR[1][1], aimR[2][1]))
  if aimL: p.aim('L', W3(t - .03, aimL[0][0], aimL[1][0], aimL[2][0], 100), W3(t - .03, aimL[0][1], aimL[1][1], aimL[2][1]))
  return p
Z3 = (0, 0, 0)
FREE = ((-30, 30, 22), Z3, Z3, (-62, -34, -34), Z3)          # the empty hand: forward for balance, thrown back with the blow
MELEE = {
  # an overhead cut, the plain sword's swing (also the one-handed bash of a club or mace)
  'chop': dict(R=((-164, -86, -62), (46, 6, 2), Z3, (-38, -16, -10), (-28, 16, 22)), L=FREE, yaw=(-36, 33), lean=(-14, 19), fwd=(.03, -.06), sink=(.012, .024),
               aimR=((-35, 0), (78, 0), (104, 0))),
  # a flat cut across the body
  'cut': dict(R=((-88, -84, -78), Z3, (72, -28, -52), (-58, -12, -22), Z3), L=((-40, 20, 14), Z3, Z3, (-70, -40, -40), Z3), yaw=(-42, 40), lean=(-4, 10), fwd=(.02, -.05), sink=(.02, .03),
              aimR=((88, -115), (92, 25), (96, 75))),
  # a straight stab
  'poke': dict(R=((28, -82, -80), Z3, (10, -6, -6), (-100, -6, -10), Z3), L=((-50, 24, 18), Z3, Z3, (-60, -40, -40), Z3), yaw=(-24, 20), lean=(-4, 12), fwd=(.03, -.08), sink=(.02, .035),
               aimR=((86, 0), (90, 0), (92, 0)), step=.13),
  # both hands, up over the head and down hard
  'slam': dict(R=((-168, -78, -50), (18, 0, 0), (-12, -14, -14), (-40, -14, -8), (-20, 14, 20)), L=((-168, -78, -50), (18, 0, 0), (-12, -14, -14), (-40, -14, -8), Z3), yaw=(0, 0), lean=(-16, 26), fwd=(.03, -.06), sink=(-.01, .04),
               aimR=((-42, 0), (84, 0), (112, 0))),
  # both hands, a wide flat swing from the hip
  'sweep': dict(R=((-82, -80, -76), Z3, (64, -30, -55), (-50, -14, -20), Z3), L=((-78, -80, -74), Z3, (-62, 10, 45), (-30, -20, -40), Z3), yaw=(-46, 42), lean=(-2, 10), fwd=(.02, -.05), sink=(.022, .03),
                aimR=((90, -110), (92, 20), (96, 80))),
  # both hands on the shaft, a long thrust with a step
  'thrust': dict(R=((24, -72, -70), Z3, (8, -10, -10), (-96, -10, -14), Z3), L=((-58, -86, -84), Z3, (-22, -12, -12), (-46, -6, -8), Z3), yaw=(-30, 16), lean=(-2, 14), fwd=(.035, -.09), sink=(.02, .04),
                 aimR=((88, 6), (90, 0), (91, 0)), step=.14),
  # fists: the right hand comes round in a hook
  'hook': dict(R=((-78, -84, -80), Z3, (66, -42, -60), (-84, -78, -70), Z3), L=((-58, -50, -52), Z3, (-10, -10, -10), (-104, -100, -100), Z3), yaw=(-34, 46), lean=(2, 10), fwd=(.02, -.05), sink=(.02, .03),
               aimR=((90, 0), (90, 30), (90, 50)), aimL=((90, 0), (90, 0), (90, 0))),
  # a weapon in each hand: both arms flung wide, then both cut inwards together
  'scissor': dict(R=((-84, -82, -80), Z3, (74, -30, -36), (-30, -20, -24), Z3), L=((-84, -82, -80), Z3, (74, -30, -36), (-30, -20, -24), Z3), yaw=(0, 0), lean=(-10, 16), fwd=(.02, -.06), sink=(-.012, .035),
                  aimR=((90, -80), (90, 28), (92, 36)), aimL=((90, 80), (90, -28), (92, -36))),
}
for name, m in MELEE.items(): key(lambda t, m=m: swing(t, **m), 1.7, name)

def blows(t, hits, kind):
  """several quick blows: hits are (which hand, when it lands); the last lands at 0.72 s. kind: 'jab' (straight
  punches or stabs from a guard) or 'chop' (each arm lifts and cuts down in turn)"""
  p = Pose(); hang(p, t, 'LR', .0, .18, 1.12, 1.5)
  g = tr(t, [(0, 0), (.18, 1, 'out'), (1.1, 1), (1.5, 0)])
  P = {'L': 0, 'R': 0}; C = {'L': (0, 0, 0), 'R': (0, 0, 0)}; last = hits[-1][1]
  for sd, a in hits:
    fin = a == last
    if kind == 'jab':
      P[sd] = max(P[sd], tr(t, [(a - .1, 0), (a, 1, 'snap'), (a + (.28 if fin else .03), 1), (a + (.5 if fin else .2), 0)]))
    elif a - .32 <= t:
      C[sd] = (tr(t, [(a - .32, 0), (a - .1, -160, 'io'), (a, -80, 'in'), (a + .08, -56, 'out'), (1.1, -56), (1.5, 0)]),
               tr(t, [(a - .32, 0), (a - .1, 40), (a, 4), (1.5, 0)]), tr(t, [(a - .3, 0), (a - .08, -44), (a + .02, -14, 'in'), (1.1, -12), (1.5, 0)]))
  sR = max((tr(t, [(a - .1, 0), (a, 1, 'snap'), (a + .25, 1), (a + .5, 0)]) for sd, a in hits if sd == 'R'), default=0)
  sL = max((tr(t, [(a - .1, 0), (a, 1, 'snap'), (a + .12, 0)]) for sd, a in hits if sd == 'L'), default=0)
  fin = tr(t, [(last - .1, 0), (last, 1, 'in'), (last + .08, 1.08, 'out'), (1.1, 1), (1.5, 0)])
  stance(p, t, yaw=(-12 * g + 26 * sR - 22 * sL) if kind == 'jab' else (30 * sR - 26 * sL), lean=6 * g + 8 * fin, fwd=-.02 * (sR + sL) - .04 * fin, sink=.014 * g + .016 * fin,
         step=.10, heel=fin, tin=(.02, .22), tout=(1.14, 1.42))
  for sd in 'LR':
    if kind == 'jab':
      p.arm(sd, 'upperarm', ('x', lerp(-56, -88, P[sd]) * g), ('z', -8 * g)); p.arm(sd, 'forearm', ('x', lerp(-104, -8, P[sd]) * g)); p.aim(sd, 90, 0)
    else:
      up, out, el = C[sd]; p.arm(sd, 'upperarm', ('x', up), ('y', out)); p.arm(sd, 'forearm', ('x', el))
      p.aim(sd, lerp(-35, 100, clamp((up + 160) / 100, 0, 1)) if up < -1 else 100, 0)
  return p
# fists: a quick left, then the right hand through the target
key(lambda t: blows(t, [('L', .46), ('R', .72)], 'jab'), 1.7, 'jabs')
# two weapons: quick stabs, left, right, left, and the right again to finish
key(lambda t: blows(t, [('L', .33), ('R', .45), ('L', .57), ('R', .72)], 'jab'), 1.7, 'flurry')
# two weapons: the off hand cuts first, the main hand follows through the target
key(lambda t: blows(t, [('L', .46), ('R', .72)], 'chop'), 1.7, 'twin')

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
# ---------- from a distance: loosed or thrown 1.05 s in, over by 1.9 s; magic lets go at 0.96 s ----------
FAR = dict(tin=(.10, .40), tout=(1.46, 1.74))
def bow(t):
  p = Pose(); hang(p, t, 'LR', .1, .42, 1.45, 1.85)
  r = tr(t, [(.1, 0), (.45, 1, 'io'), (1.42, 1), (1.85, 0)])                       # turned side-on, the bow up
  d = tr(t, [(.45, 0), (.95, 1, 'out'), (1.05, 1.03), (1.09, 0, 'snap')])           # the string drawn to the cheek
  rl = tr(t, [(1.05, 0), (1.12, 1, 'snap'), (1.4, 1), (1.8, 0)])                    # the hand flying back off the string
  stance(p, t, yaw=-52 * r - 6 * d, lean=-5 * d + 3 * rl, fwd=.012 * d, sink=.006 * r, step=.08, **FAR)
  p.rot('head', ('z', 30 * r))
  p.arm('L', 'upperarm', ('x', -88 * r), ('z', 54 * r + 5 * d)); p.arm('L', 'forearm', ('x', -4 * r))
  p.arm('R', 'upperarm', ('x', -84 * r), ('z', (-50 + 78 * d + 26 * rl) * r)); p.arm('R', 'forearm', ('x', -10 * r), ('y', (112 * d + 128 * rl * (1 - d)) * r))   # the elbow folds level, the hand coming back to the cheek
  p.aim('L', pitch=lerp(100, -2 * d, r), roll=7 * r); return p
key(bow, 1.9, 'bow')
def xbow(t):
  p = Pose(); hang(p, t, 'LR', .1, .42, 1.45, 1.85)
  r = tr(t, [(.1, 0), (.45, 1, 'out'), (1.42, 1), (1.85, 0)])
  k = tr(t, [(1.05, 0), (1.1, 1, 'snap'), (1.3, 0, 'io')])                          # the kick as it shoots
  stance(p, t, yaw=-18 * r, lean=8 * r - 9 * k, fwd=.02 * k, sink=.012 * r, step=.09, **FAR)
  p.rot('head', ('y', -7 * r), ('x', 5 * r))
  p.arm('R', 'upperarm', ('x', -62 * r + 6 * k), ('z', -12 * r)); p.arm('R', 'forearm', ('x', -72 * r))
  p.arm('L', 'upperarm', ('x', -74 * r + 5 * k), ('z', -26 * r)); p.arm('L', 'forearm', ('x', -34 * r))
  p.aim('R', pitch=lerp(100, 90 - 9 * k, r)); return p
key(xbow, 1.9, 'xbow')
def sling(t):
  p = Pose(); hang(p, t, 'R', .08, .36, 1.4, 1.8)
  r = tr(t, [(.08, 0), (.4, 1, 'out'), (1.02, 1), (1.08, 0, 'snap')])               # the arm up, the sling going round
  u = clamp((t - .3) / .74, 0, 1); th = TWO_PI * 3 * u * u                         # three turns, faster and faster
  s = tr(t, [(1.0, 0), (1.07, 1, 'snap'), (1.4, 1), (1.8, 0)])                      # let go
  stance(p, t, yaw=-16 * r + 22 * s + 5 * math.sin(th) * r, lean=-6 * r + 12 * s, fwd=.02 * r - .05 * s, sink=.012 * s, step=.10, heel=s, **FAR)
  p.arm('R', 'upperarm', ('x', -158 * r - 64 * s + 12 * math.sin(th) * r), ('y', (26 + 14 * math.cos(th)) * r)); p.arm('R', 'forearm', ('x', -28 * r - 8 * s))
  p.arm('L', 'upperarm', ('x', -34 * r + 22 * s)); p.arm('L', 'forearm', ('x', -40 * r))
  p.aim('R', pitch=tr(t, [(.08, 100), (.4, 96), (1.0, 96), (1.07, 68, 'snap'), (1.8, 100)]), yaw=math.degrees(th) * (1 - s)); return p
key(sling, 1.9, 'sling')
def throw(t):
  p = Pose(); hang(p, t, 'LR', .12, .5, 1.42, 1.82)
  w = tr(t, [(.15, 0), (.78, 1, 'io'), (.86, 1.05), (1.05, 0, 'in')])               # drawn back over the shoulder
  s = tr(t, [(.86, 0), (1.05, .95, 'in'), (1.13, 1.08, 'out'), (1.4, 1), (1.8, 0)]) # thrown
  stance(p, t, yaw=-34 * w + 30 * s, lean=-10 * w + 16 * s, fwd=.03 * w - .06 * s, sink=.01 * w + .022 * s, step=.12, heel=s, tin=(.5, .8), tout=(1.46, 1.74))
  p.arm('R', 'upperarm', ('x', tr(t, [(.15, 0), (.6, -150), (.84, -172), (1.05, -80, 'in'), (1.14, -38, 'out'), (1.4, -32), (1.8, 0)])), ('y', tr(t, [(.15, 0), (.84, 36), (1.05, 4), (1.8, 0)])))
  p.arm('R', 'forearm', ('x', tr(t, [(.15, 0), (.84, -78), (1.04, -8, 'in'), (1.4, -14), (1.8, 0)]))); p.arm('R', 'hand', ('x', tr(t, [(.5, 0), (.86, -30), (1.06, 26, 'in'), (1.4, 6), (1.8, 0)])))
  p.arm('L', 'upperarm', ('x', -66 * w + 26 * s)); p.arm('L', 'forearm', ('x', -30 * w - 24 * s))
  p.aim('R', pitch=tr(t, [(.15, 100), (.84, -50), (1.05, 72, 'in'), (1.8, 100)])); return p
key(throw, 1.9, 'throw')
def cast(t):
  p = Pose(); hang(p, t, 'LR', .1, .4, 1.45, 1.85)
  r = tr(t, [(.1, 0), (.4, 1, 'out'), (1.42, 1), (1.85, 0)])                        # the staff planted in front
  g = tr(t, [(.14, 0), (.8, 1, 'io'), (.86, 1.04), (.96, 0, 'in')])                 # gathering: up on the toes, the free hand raised
  s = tr(t, [(.86, 0), (.96, .95, 'in'), (1.04, 1.08, 'out'), (1.4, 1), (1.82, 0)]) # the push that lets it go
  stance(p, t, yaw=-14 * g + 10 * s, lean=-10 * g + 14 * s, fwd=.025 * g - .05 * s, sink=-.01 * g + .02 * s, step=.10, heel=s, **FAR)
  p.arm('R', 'upperarm', ('x', -50 * r - 62 * g - 40 * s), ('z', 10 * g)); p.arm('R', 'forearm', ('x', -44 * r - 24 * g + 52 * s))
  p.arm('L', 'upperarm', ('x', -30 * r - 110 * g - 56 * s), ('y', 30 * g)); p.arm('L', 'forearm', ('x', -52 * g - 10 * r)); p.arm('L', 'hand', ('x', -20 * g + 24 * s))
  p.aim('R', pitch=lerp(100, 6 - 22 * g + 52 * s, r)); return p
key(cast, 1.9, 'cast')

# ---------- defending: the blow comes 0.33 s in (1.3 s) ----------
def block(t):
  p = Pose(); hang(p, t, 'LR', .06, .28, .9, 1.25)
  u = tr(t, [(.06, 0), (.3, 1, 'out'), (.9, 1), (1.25, 0)])                         # the guard up
  k = tr(t, [(.33, 0), (.39, 1, 'snap'), (.72, 0, 'io')])                           # shoved back as it lands
  p.move('hips', y=.035 * k, z=-.006 - .028 * u - .01 * k, x=-.008 * u).rot('hips', ('z', 6 * u), ('x', 3 * u - 4 * k))
  p.rot('spine', ('z', 5 * u), ('x', 5 * u - 6 * k)).rot('chest', ('z', 7 * u), ('x', 4 * u - 8 * k)).rot('head', ('z', -14 * u), ('x', 9 * u - 6 * k))
  p.arm('R', 'upperarm', ('x', -80 * u + 8 * k), ('z', -36 * u)); p.arm('R', 'forearm', ('x', -98 * u - 8 * k))
  p.arm('L', 'upperarm', ('x', -64 * u + 8 * k), ('z', -30 * u)); p.arm('L', 'forearm', ('x', -104 * u - 8 * k))
  sy = tr(t, [(.33, 0), (.46, .07, 'out'), (.85, .07), (1.12, 0, 'io')])
  sz = .02 * (math.sin(math.pi * tr(t, [(.33, 0), (.46, 1, 'lin')])) * (t < .46) + math.sin(math.pi * tr(t, [(.85, 0), (1.12, 1, 'lin')])) * (t > .85))
  p.foot('R', y=sy, z=sz, yaw=7 + 10 * u).foot('L', yaw=7)
  p.aim('R', pitch=lerp(100, 20, u), yaw=40 * u); return p
key(block, 1.3, 'block')
def dodge(t):
  p = Pose(); hang(p, t, '', 0, 0, 0, 0)
  d = tr(t, [(.08, 0), (.3, 1, 'out'), (.36, 1.06), (.62, 1, 'io'), (1.02, 0, 'io'), (1.3, 0)])   # out of the way, to its left and back
  p.move('hips', x=.06 * d, y=.05 * d, z=-.006 - .034 * d).rot('hips', ('y', 9 * d), ('x', -4 * d), ('z', 8 * d))
  p.rot('spine', ('y', 8 * d), ('x', -5 * d)).rot('chest', ('y', 9 * d), ('x', -7 * d), ('z', 6 * d)).rot('neck', ('y', -8 * d)).rot('head', ('y', -12 * d), ('z', -12 * d), ('x', 6 * d))
  for sd, m in (('L', 1), ('R', -1)):
    p.arm(sd, 'upperarm', ('y', -18 * d), ('x', (-16 if sd == 'R' else 10) * d)); p.arm(sd, 'forearm', ('x', -34 * d))
  sx = tr(t, [(.08, 0), (.28, .075, 'out'), (.7, .075), (1.0, 0, 'io')]); up = lambda a, b: math.sin(math.pi * tr(t, [(a, 0), (b, 1, 'lin')])) * (a < t < b)
  p.foot('L', x=sx, y=.6 * sx, z=.028 * (up(.08, .28) + up(.7, 1.0)), yaw=7 + 10 * d).foot('R', yaw=7, pitch=10 * d, z=.008 * d)
  return p
key(dodge, 1.3, 'dodge')
bpy.context.scene.frame_set(1)
bpy.ops.wm.save_as_mainfile(filepath=out_blend)
