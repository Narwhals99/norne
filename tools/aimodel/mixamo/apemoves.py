# The dreadape's own moves, written by hand for his four arms: run by mxbuild.py (dreadape.json's _script) after Mixamo's
# moves are on, with mxbuild's names to hand (arm, pb, hips, P, TREST, rest_hips, FPS, made).
#
# A move is a list of keys (seconds, what differs from the stance, how the stretch up to it is eased). Everything is in
# shares of his height, in his own space: x to his left, y up, z the way he faces.
#   hip      where the hips are, from where they rest          hipr / chest / head   (lean forward, turn left, tip left) degrees;
#   aL aR    upper fists, from their shoulders                  chest is on top of the hips, head on top of the chest
#   gL gR ga where the upper fists are from the middle of the floor instead (ga 1), for fists planted on the ground
#   bL bR    lower fists, from theirs                           fL fR   the ankles, from the middle of the floor under him
#   paL..    which way that elbow points                        tL tR   toes down, degrees        fist  how closed the hands are
V = lambda *a: np.array(a, dtype=float)
B = arm.data.bones
def hd(n): return B[P + n].head_local.copy()
Ht = B[P + 'Head'].tail_local.y / .985
STANCE = dict(hip=V(0, -.035, -.01), hipr=V(14, 0, 0), chest=V(12, 0, 0), head=V(-22, 0, 0),
  aL=V(.13, -.37, .10), aR=V(-.13, -.37, .10), bL=V(.0, -.22, .22), bR=V(.0, -.22, .22),
  paL=V(1, -.2, -.7), paR=V(-1, -.2, -.7), pbL=V(1, 0, -.5), pbR=V(-1, 0, -.5),
  fL=V(.17, .08, .03), fR=V(-.17, .08, .03), tL=V(0), tR=V(0), kL=V(.25, 0, 1), kR=V(-.25, 0, 1), fist=V(.55, .55), tw=V(90, 90),
  gL=V(.2, .07, .3), gR=V(-.2, .07, .3), ga=V(0))
def rq(v): return Quaternion((0, 1, 0), math.radians(v[1])) @ Quaternion((1, 0, 0), math.radians(v[0])) @ Quaternion((0, 0, 1), math.radians(-v[2]))
ID = Quaternion()
def swing(a, b): return Vector(a).normalized().rotation_difference(Vector(b).normalized())
# which way a finger closes: about the line across the knuckles, toward the palm
CURL = {}
for side, sg in (('Left', 1), ('Right', -1)):
  across = (hd(side + 'HandPinky1') - hd(side + 'HandIndex1')).normalized()
  for f in ('Index', 'Middle', 'Ring', 'Pinky'):
    for i in (1, 2, 3): CURL[P + side + 'Hand' + f + str(i)] = (across * sg, side)
  for i in (1, 2, 3): CURL[P + side + 'HandThumb' + str(i)] = ((hd(side + 'HandIndex1') - hd(side + 'Hand')).normalized() * -sg, side)
CURLSIGN = -1.0
def solve(p):
  R = {}; pos = {}
  Qh = rq(p['hipr']); Qc = rq(p['chest']); Qn = rq(p['head'])
  R[P + 'Hips'] = Qh; pos[P + 'Hips'] = hd('Hips') + Vector(p['hip']) * Ht
  R[P + 'Spine'] = Qh @ ID.slerp(Qc, 1 / 3); R[P + 'Spine1'] = Qh @ ID.slerp(Qc, 2 / 3); R[P + 'Spine2'] = Qh @ Qc
  R[P + 'Neck'] = Qh @ Qc @ ID.slerp(Qn, .4); R[P + 'Head'] = Qh @ Qc @ Qn
  def place(b):
    if b.name in pos: return pos[b.name]
    pp = place(b.parent); pos[b.name] = pp + R[b.parent.name] @ (b.head_local - b.parent.head_local); return pos[b.name]
  def ik(a, b, c, target, pole, absolute, ground=None, ga=0):
    ba, bb, bc = B[P + a], B[P + b], B[P + c]
    R[ba.name] = Rc = R[ba.parent.name]; p0 = place(ba)
    v1 = bb.head_local - ba.head_local; v2 = bc.head_local - bb.head_local; l1, l2 = v1.length, v2.length
    v = (Vector(target) * Ht if absolute else p0 + Vector(target) * Ht) - p0
    if ga > 0: v = v.lerp(Vector(ground) * Ht - p0, min(1, ga))
    d = min(max(v.length, abs(l1 - l2) + 1e-4), (l1 + l2) * .995); n = v.normalized()
    proj = (l1 * l1 + d * d - l2 * l2) / (2 * d); up = math.sqrt(max(l1 * l1 - proj * proj, 0))
    pl = Vector(pole); pl = pl - n * pl.dot(n); pl = pl.normalized() if pl.length > 1e-6 else n.orthogonal().normalized()
    el = p0 + n * proj + pl * up; wr = p0 + n * d
    R[ba.name] = swing(Rc @ v1, el - p0) @ Rc; R[bb.name] = swing(R[ba.name] @ v2, wr - el) @ R[ba.name]
    pos[bb.name] = el; pos[bc.name] = wr; R[bc.name] = R[bb.name]
  for b in ORDER:
    if b.name in R or b.parent is None: continue
    n = b.name[len(P):]
    if n in ('LeftArm', 'RightArm', 'LeftArm2', 'RightArm2', 'LeftUpLeg', 'RightUpLeg'):
      s = 'L' if n.startswith('Left') else 'R'; side = 'Left' if s == 'L' else 'Right'
      if n.endswith('UpLeg'):
        ik(side + 'UpLeg', side + 'Leg', side + 'Foot', p['f' + s], p['k' + s], True)
        # the foot stays flat on the floor, turned with the hips, toes down by t
        R[P + side + 'Foot'] = Quaternion((0, 1, 0), math.radians(p['hipr'][1])) @ Quaternion((1, 0, 0), math.radians(float(p['t' + s][0])))
      elif n.endswith('Arm2'): ik(side + 'Arm2', side + 'ForeArm2', side + 'Hand2', p['b' + s], p['pb' + s], False)
      else:
        ik(side + 'Arm', side + 'ForeArm', side + 'Hand', p['a' + s], p['pa' + s], False, p['g' + s], float(p['ga'][0]))
        # the forearm turns about its own length (tw, degrees), half of it at the forearm and all of it at the hand
        fa = P + side + 'ForeArm'; ax = (pos[P + side + 'Hand'] - pos[fa]).normalized(); tw = math.radians(float(p['tw'][0 if s == 'L' else 1])) * (1 if s == 'L' else -1)
        R[P + side + 'Hand'] = Quaternion(ax, tw) @ R[fa]; R[fa] = Quaternion(ax, tw / 2) @ R[fa]
      continue
    R[b.name] = R[b.parent.name]
    if b.name in CURL:
      ax, side = CURL[b.name]; c = float(p['fist'][0 if side == 'Left' else 1]) * (.6 if 'Thumb' in b.name else 1)
      rp = R[b.parent.name]; R[b.name] = rp @ Quaternion(ax, math.radians(75 * c * CURLSIGN))
  L = {}
  for b in ORDER:
    if b.parent is None: L[b.name] = TREST[b.name].inverted() @ R[b.name] @ TREST[b.name]
    else: L[b.name] = TREST[b.name].inverted() @ R[b.parent.name].inverted() @ R[b.name] @ TREST[b.name]
  m = (R[P + 'Hips'] @ TREST[P + 'Hips']).to_matrix().to_4x4(); m.translation = pos[P + 'Hips']
  return m, L
EASE = {'s': lambda u: u * u * (3 - 2 * u), 'acc': lambda u: u ** 2.4, 'dec': lambda u: 1 - (1 - u) ** 2.4, 'lin': lambda u: u, 'pop': lambda u: 1 - (1 - u) ** 4}
def pose_at(keys, t, loop):
  full = [(k[0], {**STANCE, **{n: np.atleast_1d(np.array(v, dtype=float)) for n, v in k[1].items()}}, k[2] if len(k) > 2 else 's') for k in keys]
  n = len(full)
  for i in range(n - 1):
    if t <= full[i + 1][0] or i == n - 2:
      (ta, A, _), (tb, Bq, e) = full[i], full[i + 1]; u = min(1, max(0, (t - ta) / (tb - ta)))
      if not loop: w = EASE[e](u); return {k: A[k] + (Bq[k] - A[k]) * w for k in STANCE}
      # a move that goes round and round runs through its keys in one curve, without stopping at each
      prv = full[i - 1] if i > 0 else (full[n - 2][0] - full[n - 1][0], full[n - 2][1]); nxt = full[i + 2] if i + 2 < n else (full[n - 1][0] + full[1][0], full[1][1])
      out = {}
      for k in STANCE:
        m0 = (Bq[k] - prv[1][k]) / (tb - prv[0]) * (tb - ta); m1 = (nxt[1][k] - A[k]) / (nxt[0] - ta) * (tb - ta)
        out[k] = (2 * u ** 3 - 3 * u * u + 1) * A[k] + (u ** 3 - 2 * u * u + u) * m0 + (-2 * u ** 3 + 3 * u * u) * Bq[k] + (u ** 3 - u * u) * m1
      return out
def write(name, keys, loop=False):
  dur = keys[-1][0]; n = int(round(dur * FPS))
  new = bpy.data.actions.new(name); arm.animation_data.action = new
  try: arm.animation_data.action_slot = new.slots[0]
  except Exception: pass
  prev = {}
  for i in range(n + 1):
    m, rots = solve(pose_at(keys, i / FPS, loop))
    hips.matrix_basis = rest_hips.inverted() @ m
    q = hips.rotation_quaternion.copy()
    if 'h' in prev and prev['h'].dot(q) < 0: q.negate(); hips.rotation_quaternion = q
    prev['h'] = q
    hips.keyframe_insert('location', frame=i); hips.keyframe_insert('rotation_quaternion', frame=i)
    for b in pb:
      if b is hips or b.name not in rots: continue
      q = rots[b.name]
      if b.name in prev and prev[b.name].dot(q) < 0: q = -q
      prev[b.name] = q; b.rotation_quaternion = q; b.keyframe_insert('rotation_quaternion', frame=i)
  new.use_fake_user = True; made.append(name)
  tr = arm.animation_data.nla_tracks.new(); tr.name = name; tr.strips.new(name, 0, new); tr.mute = True
  arm.animation_data.action = None
  print('OWN MOVE %-7s %3d frames' % (name, n))

S = STANCE
if os.environ.get('APE_TEST'):
  a, b, c, cs = [float(x) for x in os.environ['APE_TEST'].split(',')]; CURLSIGN = cs
  for nm, t in (('pound', a), ('punch', b), ('flurry', c)): write(nm, [(0, dict(tw=(t, t), fist=(1, 1))), (1.7, dict(tw=(t, t), fist=(1, 1)))])
  write('idle', [(0, {}), (1, {})]); write('walk', [(0, {}), (1, {})])
  write = lambda *a, **k: None
# ---------- standing: breathing, the weight going from foot to foot, the lower hands working ----------
write('idle', [
  (0.0, {}),
  (0.9, dict(hip=(.012, -.03, -.01), chest=(9, 4, 1), head=(-20, 7, 0), aL=(.14, -.37, .09), aR=(-.12, -.365, .12), bL=(.02, -.20, .24), bR=(.0, -.22, .22), fist=(.8, .5))),
  (1.8, dict(hip=(0, -.04, -.012), chest=(13, 0, 0), head=(-23, 0, 0), fist=(.5, .5))),
  (2.7, dict(hip=(-.012, -.03, -.01), chest=(9, -4, -1), head=(-20, -7, 0), aL=(.12, -.365, .12), aR=(-.14, -.37, .09), bR=(-.02, -.20, .24), fist=(.5, .8))),
  (3.6, {})], loop=True)

# ---------- running: a gorilla's gallop on his knuckles. The upper fists land in front and he vaults over them, the feet
# swing through and land by the hands, and he throws the arms forward again. The lower arms stay tucked to his belly. ----------
RUN = dict(ga=(1,), fist=(1, 1), paL=(1, .1, -.5), paR=(-1, .1, -.5), kL=(.5, 0, 1), kR=(-.5, 0, 1))
def gal(hip, hp, cp, hdp, handz, handy, footz, footy, toe, low):
  return {**RUN, 'hip': hip, 'hipr': (hp, 0, 0), 'chest': (cp, 0, 0), 'head': (hdp, 0, 0),
    'gL': (.20, handy, handz + .05), 'gR': (-.20, handy + (.02 if handy > .08 else 0), handz - .03),
    'fL': (.19, footy, footz - .04), 'fR': (-.19, footy + (.02 if footy > .09 else 0), footz + .04), 'tL': (toe,), 'tR': (toe,),
    'bL': (.06, -.27 + low, -.08), 'bR': (-.06, -.27 + low, -.08)}
write('walk', [
  (0.00, gal((0, -.12, -.02), 44, 26, -58, .42, .07, -.22, .10, 40, -.04)),      # fists down in front, feet pushing off behind
  (0.14, gal((0, -.08, .02), 50, 24, -60, .16, .07, -.02, .20, 20, .0)),         # over the fists, feet tucked up and coming through
  (0.28, gal((0, -.15, .0), 36, 22, -48, .30, .24, .14, .08, -8, -.06)),         # feet down by where the hands were, arms off the ground
  (0.42, gal((0, -.12, -.02), 38, 24, -52, .48, .16, -.06, .08, 12, -.02)),      # legs driving, arms reaching for the ground
  (0.56, gal((0, -.12, -.02), 44, 26, -58, .42, .07, -.22, .10, 40, -.04))], loop=True)

# ---------- the pound: he rears up with all four fists over his head and brings them down together (lands at 0.72 s) ----------
UP = dict(hip=(0, .0, -.03), hipr=(-6, 0, 0), chest=(-20, 0, 0), head=(-8, 0, 0), aL=(.09, .40, .0), aR=(-.09, .40, .0), paL=(1, 0, -.2), paR=(-1, 0, -.2),
  bL=(.16, .22, .12), bR=(-.16, .22, .12), pbL=(1, -.5, -.3), pbR=(-1, -.5, -.3), fL=(.17, .08, .03), fR=(-.17, .08, .03), fist=(1, 1))
DOWN = dict(hip=(0, -.13, .03), hipr=(30, 0, 0), chest=(36, 0, 0), head=(-34, 0, 0), aL=(.03, -.33, .25), aR=(-.03, -.33, .25), paL=(1, .3, -.4), paR=(-1, .3, -.4),
  bL=(.10, -.20, .26), bR=(-.10, -.20, .26), fist=(1, 1))
write('pound', [
  (0.0, {}),
  (0.24, dict(hip=(0, -.09, .0), hipr=(22, 0, 0), chest=(22, 0, 0), head=(-26, 0, 0), aL=(.10, -.30, .05), aR=(-.10, -.30, .05), bL=(.10, -.22, .10), bR=(-.10, -.22, .10), fist=(1, 1))),
  (0.52, UP, 'dec'),
  (0.60, {**UP, 'hip': (0, .01, -.04), 'chest': (-24, 0, 0), 'aL': (.09, .41, -.04), 'aR': (-.09, .41, -.04)}, 'lin'),
  (0.72, DOWN, 'acc'),
  (0.80, {**DOWN, 'hip': (0, -.15, .03), 'chest': (39, 0, 0)}, 'dec'),
  (1.15, {**DOWN, 'hip': (0, -.11, .02), 'chest': (30, 0, 0), 'head': (-30, 0, 0)}),
  (1.7, {})])

# ---------- the punch: a straight right from the upper arm, the lower right fist driving in under it a beat later ----------
WIND = dict(hip=(-.02, -.06, -.03), hipr=(12, -14, 0), chest=(8, -30, 0), head=(-18, 34, 0), aR=(-.14, -.06, -.14), paR=(-1, -.3, -.6), aL=(.02, -.06, .26), paL=(1, -.8, -.2),
  bR=(-.12, -.10, -.02), bL=(.04, -.14, .24), fL=(.15, .08, .12), fR=(-.19, .08, -.06), tR=(12,), fist=(1, 1))
HIT1 = dict(hip=(.03, -.07, .07), hipr=(18, 16, 0), chest=(12, 34, 0), head=(-20, -40, 0), aR=(.16, -.03, .41), paR=(-1, -.2, -.1), aL=(.10, -.12, .02), paL=(1, -.6, -.6),
  bR=(-.10, -.12, .10), bL=(.10, -.16, .10), fL=(.15, .08, .15), fR=(-.19, .10, -.10), tR=(30,), fist=(1, 1))
HIT2 = {**HIT1, 'hip': (.035, -.08, .08), 'chest': (16, 40, 0), 'aR': (.08, -.10, .30), 'bR': (.12, .02, .32), 'pbR': (-1, -.6, -.2)}
write('punch', [
  (0.0, {}), (0.34, WIND), (0.50, {**WIND, 'chest': (8, -34, 0), 'aR': (-.15, -.05, -.16)}, 'lin'),
  (0.72, HIT1, 'acc'), (0.78, {**HIT1, 'aR': (.15, -.04, .40)}, 'dec'), (0.94, HIT2, 'acc'), (1.02, {**HIT2, 'bR': (.11, .01, .31)}, 'dec'),
  (1.7, {})])

# ---------- the flurry: all four fists one after another, upper left, upper right (0.72 s), then both lower fists together ----------
def jab(s, lowers=False):   # s = 1: the left upper fist is out
  A, Bk = ('L', 'R') if s > 0 else ('R', 'L')
  d = {'hip': (0, -.07, .04), 'hipr': (18, -10 * s, 0), 'chest': (12, -24 * s, 0), 'head': (-20, 30 * s, 0),
    'a' + A: (-.12 * s, -.04, .40), 'pa' + A: (s, -.3, -.1), 'a' + Bk: (-.04 * s, -.08, .14), 'pa' + Bk: (-s, -.7, -.5),
    'bL': (.04, -.14, .22), 'bR': (-.04, -.14, .22), 'fL': (.17, .08, .08), 'fR': (-.17, .08, -.02), 'fist': (1, 1)}
  return d
BOTH = dict(hip=(0, -.05, .07), hipr=(10, 0, 0), chest=(4, 0, 0), head=(-12, 0, 0), aL=(.06, -.06, .12), aR=(-.06, -.06, .12), paL=(1, -.7, -.5), paR=(-1, -.7, -.5),
  bL=(-.06, .10, .30), bR=(.06, .10, .30), pbL=(1, -.6, -.2), pbR=(-1, -.6, -.2), fL=(.17, .08, .08), fR=(-.17, .08, -.02), fist=(1, 1))
write('flurry', [
  (0.0, {}), (0.26, {**jab(-1), 'aR': (-.06, -.08, .12), 'chest': (12, 20, 0), 'hip': (0, -.07, -.01)}),
  (0.42, jab(1), 'acc'), (0.57, {**jab(1), 'aL': (.02, -.08, .2)}, 'dec'),
  (0.72, jab(-1), 'acc'), (0.86, {**jab(-1), 'aR': (-.04, -.08, .2), 'bL': (.06, -.2, .1), 'bR': (-.06, -.2, .1)}, 'dec'),
  (1.02, BOTH, 'acc'), (1.12, {**BOTH, 'bL': (-.05, .09, .29), 'bR': (.05, .09, .29)}, 'dec'),
  (1.7, {})])

# ---------- the roar (for an attack from a distance): he rears up and drums his chest with the upper fists, lower arms spread, then
# throws all four arms wide and roars forward (1.0 s) ----------
def drum(s):   # s = 1: the left fist is on the chest
  A, Bk = ('L', 'R') if s > 0 else ('R', 'L')
  return {'hip': (0, -.01, -.03), 'hipr': (-4, 0, 0), 'chest': (-14, 5 * s, 0), 'head': (-2, 0, 0),
    'a' + A: (-.13 * s, -.10, .25), 'a' + Bk: (-.04 * s, -.04, .36), 'paL': (1, -.2, -.2), 'paR': (-1, -.2, -.2),
    'bL': (.22, -.14, .08), 'bR': (-.22, -.14, .08), 'pbL': (1, .2, -.4), 'pbR': (-1, .2, -.4), 'fist': (1, 1)}
WIDE = dict(hip=(0, -.08, .04), hipr=(20, 0, 0), chest=(16, 0, 0), head=(-34, 0, 0), aL=(.34, .02, .10), aR=(-.34, .02, .10), paL=(0, -1, -.5), paR=(0, -1, -.5),
  bL=(.28, -.12, .12), bR=(-.28, -.12, .12), pbL=(0, -1, -.5), pbR=(0, -1, -.5), fist=(.1, .1))
write('drum', [
  (0.0, {}), (0.30, drum(1)), (0.42, drum(-1), 'lin'), (0.54, drum(1), 'lin'), (0.66, drum(-1), 'lin'), (0.78, drum(1), 'lin'),
  (0.86, {**drum(-1), 'hip': (0, -.0, -.05), 'chest': (-20, 0, 0)}, 'lin'),
  (1.0, WIDE, 'acc'), (1.08, {**WIDE, 'hip': (0, -.09, .05), 'head': (-38, 0, 0)}, 'dec'), (1.4, {**WIDE, 'chest': (14, 0, 0), 'head': (-32, 0, 0)}),
  (1.9, {})])
