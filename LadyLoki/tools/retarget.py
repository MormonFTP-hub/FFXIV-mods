"""Pose/proportion retarget of Lady Loki's mesh from her UE skeleton onto the FFXIV c0201 skeleton."""
import pickle
import numpy as np

import ffskel

WORK = 'E:/FFXIV-mods/LadyLoki/work/'

# Loki world (cm, Z-up, -Y forward) -> FFXIV (m, Y-up, +Z forward)
CONV = np.array([[1, 0, 0], [0, 0, 1], [0, -1, 0]], float) * 0.01


def loki_joints():
    nodes = pickle.load(open(WORK + 'nodes.pkl', 'rb'))
    byid = {n[0]: n for n in nodes}
    world = {}

    def W(i):
        if i not in world:
            n = byid[i]
            world[i] = (W(n[4]) @ n[5]) if n[4] is not None else n[5]
        return world[i]
    out = {}
    parent = {}
    for n in nodes:
        if n[3] == 'JOINT':
            out[n[1]] = CONV @ W(n[0])[:3, 3]
            parent[n[1]] = byid[n[4]][1] if n[4] in byid else None
    return out, parent


def _rot_between(a, b):
    a = a / np.linalg.norm(a); b = b / np.linalg.norm(b)
    v = np.cross(a, b); c = float(np.dot(a, b))
    if np.linalg.norm(v) < 1e-9:
        return np.eye(3)
    vx = np.array([[0, -v[2], v[1]], [v[2], 0, -v[0]], [-v[1], v[0], 0]])
    return np.eye(3) + vx + vx @ vx * (1.0 / (1.0 + c))


# segment: (loki head, loki tail, ff head, ff tail)
SEGMENTS = {
    'torso_lo': ('pelvis', 'spine_03', 'j_kosi', 'j_sebo_b'),
    'torso_up': ('spine_03', 'neck_01', 'j_sebo_b', 'j_kubi'),
    'neck': ('neck_01', 'head', 'j_kubi', 'j_kao'),
}
for s in 'lr':
    SEGMENTS.update({
        f'clav_{s}': (f'clavicle_{s}', f'upperarm_{s}', f'j_sako_{s}', f'j_ude_a_{s}'),
        f'uarm_{s}': (f'upperarm_{s}', f'lowerarm_{s}', f'j_ude_a_{s}', f'j_ude_b_{s}'),
        f'farm_{s}': (f'lowerarm_{s}', f'hand_{s}', f'j_ude_b_{s}', f'j_te_{s}'),
        f'hand_{s}': (f'hand_{s}', f'middle_01_{s}', f'j_te_{s}', f'j_naka_a_{s}'),
        f'thigh_{s}': (f'thigh_{s}', f'calf_{s}', f'j_asi_a_{s}', f'j_asi_b_{s}'),
        f'calf_{s}': (f'calf_{s}', f'foot_{s}', f'j_asi_b_{s}', f'j_asi_d_{s}'),
        f'foot_{s}': (f'foot_{s}', f'ball_{s}', f'j_asi_d_{s}', f'j_asi_e_{s}'),
    })


def segment_of(bone, parent):
    """Which retarget segment drives a Loki bone (walk up the hierarchy)."""
    b = bone
    while b is not None:
        s = b[-2:] if b[-2:] in ('_l', '_r') else None
        base = b
        if base in ('pelvis', 'spine_01', 'spine_02') or 'Skirt' in base:
            return 'torso_lo'
        if base in ('spine_03', 'spine_04', 'spine_05'):
            return 'torso_up'
        if base in ('neck_01', 'neck_02'):
            return 'neck'
        if base == 'head':
            return 'head'
        if s:
            for key, seg in (('clavicle', 'clav'), ('upperarm', 'uarm'), ('lowerarm', 'farm'), ('hand', 'hand'),
                             ('thigh', 'thigh'), ('calf', 'calf'), ('foot', 'foot'), ('ball', 'foot')):
                if base.startswith(key):
                    return f'{seg}{s}'
        b = parent.get(b)
    return 'torso_lo'


def build(head_scale=None, head_offset=np.zeros(3)):
    """Returns {segment: (A 3x3, t 3)} so that x_ff = A @ x_loki_ff + t, plus helpers."""
    J, parent = loki_joints()
    F = ffskel.load()
    fpos = {n: b['world'][:3, 3] for n, b in F.items()}
    T = {}
    for seg, (lh, lt, fh, ft) in SEGMENTS.items():
        dl = J[lt] - J[lh]; df = fpos[ft] - fpos[fh]
        R = _rot_between(dl, df)
        k = np.linalg.norm(df) / np.linalg.norm(dl)
        A = R * k
        T[seg] = (A, fpos[fh] - A @ J[lh])
    # head: rigid follow of the neck tip with its own uniform scale (fit later against the FFXIV face)
    An, tn = T['neck']
    R = An / np.linalg.norm(An[:, 0])
    hs = head_scale if head_scale is not None else np.linalg.norm(An[:, 0])
    A = R * hs
    T['head'] = (A, fpos['j_kao'] + head_offset - A @ J['head'])
    return T, J, parent


def apply(T, J, parent, joint_names, pos_loki_cm, nrm_loki, Jidx, W, override_segment=None):
    """Linear-blend the per-segment affine maps using Loki skin weights."""
    p = (CONV @ pos_loki_cm.T).T
    n = (CONV @ nrm_loki.T).T / 0.01
    out_p = np.zeros_like(p); out_n = np.zeros_like(n)
    seg_of_joint = {}
    for j, name in enumerate(joint_names):
        seg_of_joint[j] = override_segment or segment_of(name, parent)
    for k in range(Jidx.shape[1]):
        w = W[:, k]
        for seg in set(seg_of_joint[j] for j in np.unique(Jidx[:, k])):
            mask = np.array([seg_of_joint[j] == seg for j in Jidx[:, k]]) & (w > 0)
            if not mask.any():
                continue
            A, t = T[seg]
            out_p[mask] += w[mask, None] * ((A @ p[mask].T).T + t)
            out_n[mask] += w[mask, None] * (A @ n[mask].T).T
    out_n /= np.linalg.norm(out_n, axis=1, keepdims=True) + 1e-12
    return out_p, out_n
