"""Fit Lady Loki's outfit onto Bibo+ (c0201) and split it into FFXIV gear slots."""
import pickle
import re
import sys
import numpy as np

sys.path.insert(0, 'E:/FFXIV-mods/LadyLoki/tools')
import ffskel
import fit
import retarget
import ttdb

WORK = 'E:/FFXIV-mods/LadyLoki/work/'
BIBO = {'top': WORK + 'bibo/top_nude_m.db', 'dwn': WORK + 'bibo/dwn_sfw_m.db',
        'glv': WORK + 'bibo/glv.db', 'sho': WORK + 'bibo/sho.db'}

SKIP = {'Eyes_01', 'Eyes_02', 'Head', 'Equip_08', 'Weapon_01'}
SKIN = {'Body_01', 'Body_02'}
# which Loki texture set (and so which FFXIV material) each Loki material uses
MATERIAL_OF = {'Equip_01': 'skirt', 'Equip_02': 'gold', 'Equip_05': 'gold', 'Equip_03': 'suit',
               'Equip_06': 'acc6', 'Equip_07': 'acc7', 'Hair_01': 'hair', 'Hair_02': 'hair'}


def short(name):
    return name.replace('MI_WP_1016504_', '').replace('MI_1016504_', '')


# ---------------------------------------------------------------- Loki -> FFXIV bone names
FINGER = {'index': 'hito', 'middle': 'naka', 'ring': 'kusu', 'pinky': 'ko', 'thumb': 'oya'}


def skirt_targets(J):
    """Nearest FFXIV 'a'-level skirt bone(s) for each Loki skirt chain, by retargeted root position."""
    F = ffskel.load()
    T, _, parent = retarget.build()
    cands = [n for n in F if re.match(r'j_sk_[fsb]_a_[lr]$', n)]
    cpos = np.array([F[n]['world'][:3, 3] for n in cands])
    out = {}
    for j in J:
        m = re.match(r'(\w+?)_Skirt_504_[A-C]1$', j)
        if not m:
            continue
        A, t = T['torso_lo']
        p = A @ J[j] + t
        d = np.linalg.norm((cpos - p)[:, [0, 2]], axis=1)   # horizontal distance only
        o = np.argsort(d)
        if d[o[1]] < d[o[0]] * 1.15:
            out[m.group(1)] = [(cands[o[0]], 0.5), (cands[o[1]], 0.5)]
        else:
            out[m.group(1)] = [(cands[o[0]], 1.0)]
    return out


def loki_to_ff(name, skirt):
    s = name[-1] if name[-2:] in ('_l', '_r') else None
    if name in ('pelvis', 'root', 'Skirt_504_root'):
        return [('j_kosi', 1.0)]
    if name in ('spine_01', 'spine_02'):
        return [('j_sebo_a', 1.0)]
    if name in ('spine_03', 'spine_04'):
        return [('j_sebo_b', 1.0)]
    if name == 'spine_05':
        return [('j_sebo_c', 1.0)]
    if name.startswith('neck'):
        return [('j_kubi', 1.0)]
    m = re.match(r'(\w+?)_Skirt_504_', name)
    if m:
        return skirt.get(m.group(1), [('j_kosi', 1.0)])
    if re.match(r'[LR]_Bracelet', name):
        return [('n_hte_' + name[0].lower(), 1.0)]
    if re.match(r'[LR]_(Anklet|Shell)', name):
        return [('j_asi_c_' + name[0].lower(), 1.0)]
    if re.match(r'[LR]_Earring', name) or name.startswith('hair_') or name == 'Hair_504_Root':
        return [('j_kao', 1.0)]
    if s:
        if name.startswith('clavicle'):
            return [(f'j_sako_{s}', 1.0)]
        if name.startswith('upperarm'):
            return [(f'j_ude_a_{s}', 1.0)]
        if name.startswith('lowerarm_twist_01'):
            return [(f'n_hte_{s}', 1.0)]
        if name.startswith('lowerarm'):
            return [(f'j_ude_b_{s}', 1.0)]
        if name.startswith('hand') or 'metacarpal' in name or name.startswith('weapon'):
            return [(f'j_te_{s}', 1.0)]
        for k, v in FINGER.items():
            if name.startswith(k + '_0'):
                seg = 'a' if name.startswith(k + '_01') else 'b'
                return [(f'j_{v}_{seg}_{s}', 1.0)]
        if name.startswith('thigh'):
            return [(f'j_asi_a_{s}', 1.0)]
        if name.startswith('calf'):
            return [(f'j_asi_c_{s}', 1.0)]
        if name.startswith('foot'):
            return [(f'j_asi_d_{s}', 1.0)]
        if name.startswith('ball'):
            return [(f'j_asi_e_{s}', 1.0)]
    return [('j_kao', 1.0)]   # head, face and anything else under the head


def region_of(bone):
    if bone.startswith(('j_kao', 'j_kami', 'j_mimi', 'n_ear', 'j_ago', 'j_f_')):
        return 'met'
    if bone.startswith(('j_te', 'j_hito', 'j_naka', 'j_kusu', 'j_ko_', 'j_oya', 'n_hte')):
        return 'glv'
    if bone.startswith(('j_asi_d', 'j_asi_e')):
        return 'sho'
    if bone.startswith(('j_asi', 'j_sk_', 'n_hizasoubi', 'j_kosi')):
        return 'dwn'
    return 'top'


def islands(pos, tris):
    key = np.round(pos, 4)
    _, weld = np.unique(key, axis=0, return_inverse=True)
    weld = weld.reshape(-1)
    parent = np.arange(weld.max() + 1)

    def find(x):
        while parent[x] != x:
            parent[x] = parent[parent[x]]; x = parent[x]
        return x
    t = weld[tris]
    for a, b in ((0, 1), (1, 2)):
        for u, v in zip(t[:, a], t[:, b]):
            ru, rv = find(u), find(v)
            if ru != rv:
                parent[ru] = rv
    roots = np.array([find(x) for x in range(len(parent))])
    _, lab = np.unique(roots, return_inverse=True)
    return lab.reshape(-1)[weld]


MARGIN = {'suit': 0.003, 'skirt': 0.004, 'gold': 0.004, 'acc6': 0.004, 'acc7': 0.004}
RIGID_SIZE = 0.06      # islands smaller than this (bbox diagonal, m) move as one piece
MAX_DEPTH = 0.03       # deeper penetrations are treated as bad correspondences, not pushed


def _local_tris(tris_full, vm):
    remap = -np.ones(len(vm), np.int64); remap[np.flatnonzero(vm)] = np.arange(vm.sum())
    T = remap[tris_full]
    return T[(T >= 0).all(1)]


def collide_rigid(P, tris_full, vm, surf, margin, iters=4):
    T = _local_tris(tris_full, vm)
    for _ in range(iters):
        q = np.concatenate([P, P[T].mean(1)])
        s, si = surf.signed_distance(q)
        m = (s < margin) & (s > -MAX_DEPTH)
        if not m.any():
            break
        n = surf.N[si[m]].mean(0); n /= np.linalg.norm(n) + 1e-12
        P = P + n * float((margin - s[m]).max())
    return P


def collide(P, tris_full, vm, surf, margin, iters=6):
    """Push clothing out of the body. Tests vertices, triangle centroids and edge midpoints so that
    long triangles spanning convex body regions don't cut through the skin."""
    remap = -np.ones(len(vm), np.int64); remap[np.flatnonzero(vm)] = np.arange(vm.sum())
    T = remap[tris_full]
    T = T[(T >= 0).all(1)]
    P = P.copy()
    for _ in range(iters):
        moved = False
        delta = np.zeros_like(P); cnt = np.zeros(len(P))
        s, si = surf.signed_distance(P)
        m = (s < margin) & (s > -MAX_DEPTH)
        if m.any():
            moved = True
            delta[m] += (margin - s[m])[:, None] * surf.N[si[m]]; cnt[m] += 1
        samples = [P[T].mean(1)] + [(P[T[:, a]] + P[T[:, b]]) / 2 for a, b in ((0, 1), (1, 2), (2, 0))]
        owners = [T] + [T[:, [a, b]] for a, b in ((0, 1), (1, 2), (2, 0))]
        for q, own in zip(samples, owners):
            s, si = surf.signed_distance(q)
            m = (s < margin) & (s > -MAX_DEPTH)
            if not m.any():
                continue
            moved = True
            push = (margin - s[m])[:, None] * surf.N[si[m]]
            for k in range(own.shape[1]):
                np.add.at(delta, own[m, k], push)
                np.add.at(cnt, own[m, k], 1)
        if not moved:
            break
        nz = cnt > 0
        step = delta[nz] / cnt[nz, None]
        ln = np.linalg.norm(step, axis=1, keepdims=True)
        P[nz] += step * np.minimum(1.0, 0.01 / (ln + 1e-12))
    return P


def cull_covered_skin(bibo_parts, cover_pos, cover_tris):
    """Drop Bibo skin triangles that sit fully under opaque clothing (keeps a band near clothing edges)."""
    cs = fit.Surface([(cover_pos, np.zeros_like(cover_pos), cover_tris, None, None)], spacing=0.002)
    # clothing boundary (open edges after welding) -> keep skin near it
    key = np.round(cover_pos, 4)
    _, weld = np.unique(key, axis=0, return_inverse=True); weld = weld.reshape(-1)
    t = weld[cover_tris]
    e = np.sort(np.concatenate([t[:, [0, 1]], t[:, [1, 2]], t[:, [2, 0]]]), 1)
    ue, cnt = np.unique(e, axis=0, return_counts=True)
    first = {}
    for i, w in enumerate(weld):
        first.setdefault(w, i)
    bverts = np.array(sorted({first[v] for v in ue[cnt == 1].reshape(-1)}))
    bpts = cover_pos[bverts] if len(bverts) else np.zeros((1, 3)) + 1e3
    out = []
    for slot, mesh, p in bibo_parts:
        d, i = fit.knn(p.pos, cs.P, k=24)
        v = cs.P[i] - p.pos[:, None, :]
        along = (v * p.nrm[:, None, :]).sum(2)
        lateral = np.linalg.norm(v - along[:, :, None] * p.nrm[:, None, :], axis=2)
        covered = ((along > -0.002) & (along < 0.03) & (lateral < 0.004)).any(1)
        db, _ = fit.knn(p.pos, bpts, k=1)
        covered &= db[:, 0] > 0.015
        keep = ~covered[p.tris].all(1)
        out.append((slot, mesh, p, keep))
        print('  cull', slot, mesh.material, p.attributes, 'removed %d / %d tris' % ((~keep).sum(), len(keep)))
    return out


def load_bibo():
    parts = []; bones = set()
    for slot, path in BIBO.items():
        d = ttdb.read(path)
        for m in d['meshes']:
            for p in m.parts:
                parts.append((slot, m, p))
                bones.update(b for b in np.unique(p.bones) if b)
    return parts, sorted(bones)


def main():
    groups, joints, _ = pickle.load(open(WORK + 'loki_groups.pkl', 'rb'))
    ret = pickle.load(open(WORK + 'retargeted.pkl', 'rb'))
    J, parent = retarget.loki_joints()
    skirt = skirt_targets(J)
    print('skirt chains ->', skirt)

    bibo_parts, bibo_bones = load_bibo()
    surf = fit.Surface([(p.pos, p.nrm, p.tris, p.bones, p.weights) for _, _, p in bibo_parts],
                       spacing=0.003, bone_list=bibo_bones)
    print('bibo samples', len(surf.P), 'bones', len(bibo_bones))

    # ---- displacement field: Loki skin -> Bibo skin
    skin = [g for g in groups if short(g['name']) in SKIN]
    sp = np.concatenate([ret[g['index']][0] for g in skin])
    sn = np.concatenate([ret[g['index']][1] for g in skin])
    off = np.cumsum([0] + [len(g['pos']) for g in skin])
    st = np.concatenate([g['tris'] + o for g, o in zip(skin, off[:-1])])
    d, i = surf.closest(sp, k=12)
    ok = (surf.N[i] * sn[:, None, :]).sum(2) > 0.25
    first = np.where(ok.any(1), ok.argmax(1), 0)
    tgt = surf.P[i[np.arange(len(sp)), first]]
    disp = tgt - sp
    disp = fit.smooth_field(disp, st, len(sp), iters=25, alpha=0.6, weld_pos=sp)
    print('skin displacement mean %.4f max %.4f' % (np.linalg.norm(disp, axis=1).mean(), np.linalg.norm(disp, axis=1).max()))

    ff_bones = set(bibo_bones)
    out = {s: [] for s in ('met', 'top', 'glv', 'dwn', 'sho')}
    head_items = []
    for g in groups:
        key = short(g['name'])
        if key in SKIP or key in SKIN:
            continue
        p0, n0 = ret[g['index']]
        lab = islands(g['pos'], g['tris'])
        # Loki-mapped FFXIV weights
        lw = {}
        for k in range(g['J'].shape[1]):
            for v in np.flatnonzero(g['W'][:, k] > 0):
                for b, f in loki_to_ff(joints[g['J'][v, k]], skirt):
                    lw.setdefault(b, np.zeros(len(p0)))[v] += g['W'][v, k] * f
        # which islands follow the head
        seg = np.array([retarget.segment_of(joints[j], parent) for j in g['J'][:, 0]])
        for isl in np.unique(lab):
            vm = lab == isl
            tm = vm[g['tris']].all(1)
            if not tm.any():
                continue
            if key == 'Equip_06' and g['pos'][vm, 2].max() < 12.0:
                continue   # toe chain + toe ring: Bibo's toes are too different for it to sit right
            head_frac = (seg[vm] == 'head').mean()
            sub = {'group': key, 'gindex': g['index'], 'material': MATERIAL_OF.get(key, key), 'vmask': vm, 'tris': g['tris'][tm],
                   'uv': g['uv2'] if key == 'Hair_01' else g['uv'], 'pos': p0, 'nrm': n0, 'lw': lw}
            if head_frac > 0.5:
                head_items.append(sub)
            else:
                out.setdefault('_body', []).append(sub)

    # ---- fit body islands
    body = out.pop('_body')
    for sub in body:
        vm = sub['vmask']
        P = sub['pos'][vm].copy(); N = sub['nrm'][vm].copy()
        dd, ii = fit.knn(P, sp, k=6)
        w = 1.0 / (dd ** 2 + 1e-6); w /= w.sum(1, keepdims=True)
        dv = (disp[ii] * w[:, :, None]).sum(1)
        margin = MARGIN.get(sub['material'], 0.003)
        if np.linalg.norm(P.max(0) - P.min(0)) < RIGID_SIZE:
            P = collide_rigid(P + dv.mean(0), sub['tris'], vm, surf, margin)
        else:
            P = collide(P + dv, sub['tris'], vm, surf, margin)
        s, si = surf.signed_distance(P)
        dist = np.abs(s)
        # weights: Bibo skin weights near the body, Loki's own (mapped) weights further out
        t = np.clip((dist - 0.008) / (0.035 - 0.008), 0, 1)
        names = sorted(set(bibo_bones) | set(sub['lw']))
        col = {b: k for k, b in enumerate(names)}
        Wd = np.zeros((len(P), len(names)))
        Wb = surf.W[si]
        for k, b in enumerate(bibo_bones):
            Wd[:, col[b]] += (1 - t) * Wb[:, k]
        for b, arr in sub['lw'].items():
            Wd[:, col[b]] += t * arr[vm]
        top = np.argsort(-Wd, 1)[:, :4]
        tw = np.take_along_axis(Wd, top, 1)
        tw /= tw.sum(1, keepdims=True) + 1e-12
        bones = np.empty((len(P), 8), object); bones[:] = ''
        weights = np.zeros((len(P), 8))
        bones[:, :4] = np.array(names, object)[top]; weights[:, :4] = tw
        bones[weights == 0] = ''
        # slot vote
        votes = {}
        for b, wv in zip(bones[:, 0], P[:, 1]):
            r = 'sho' if wv < 0.13 else region_of(b)
            votes[r] = votes.get(r, 0) + 1
        slot = max(votes, key=votes.get)
        remap = -np.ones(len(vm), np.int64); remap[np.flatnonzero(vm)] = np.arange(vm.sum())
        out[slot].append({'group': sub['group'], 'material': sub['material'], 'pos': P, 'nrm': N,
                          'uv': sub['uv'][vm], 'tris': remap[sub['tris']], 'bones': bones, 'weights': weights})
        ff_bones.update(names)
    for s, lst in out.items():
        print(s, [(x['group'], len(x['pos'])) for x in lst])

    # ---- hide Bibo skin under the opaque swimsuit
    suit = [x for lst in out.values() for x in lst if x['material'] == 'suit']
    cpos = np.concatenate([x['pos'] for x in suit])
    coff = np.cumsum([0] + [len(x['pos']) for x in suit])
    ctris = np.concatenate([x['tris'] + o for x, o in zip(suit, coff[:-1])])
    body_out = {}
    for slot, mesh, p, keep in cull_covered_skin(bibo_parts, cpos, ctris):
        body_out.setdefault(slot, []).append({'material': mesh.material, 'part': p, 'keep': keep})
    pickle.dump({'slots': out, 'head_items': head_items, 'bibo': body_out}, open(WORK + 'outfit_fit.pkl', 'wb'))


if __name__ == '__main__':
    main()
