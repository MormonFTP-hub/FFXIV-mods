"""Place Lady Loki's head pieces (horned tiara, earrings, hair) on the FFXIV c0201 head."""
import pickle
import sys
import numpy as np

sys.path.insert(0, 'E:/FFXIV-mods/LadyLoki/tools')
import ffskel
import fit
import retarget
import ttdb
import build_outfit as bo

WORK = 'E:/FFXIV-mods/LadyLoki/work/'
FACE_DB = WORK + 'game/chara_human_c0201_obj_face_f0001_model_c0201f0001_fac.db'


def umeyama(src, dst):
    ms, md = src.mean(0), dst.mean(0)
    a, b = src - ms, dst - md
    U, S, Vt = np.linalg.svd(b.T @ a / len(src))
    D = np.eye(3)
    if np.linalg.det(U @ Vt) < 0:
        D[2, 2] = -1
    R = U @ D @ Vt
    s = np.trace(np.diag(S) @ D) / (a ** 2).sum(1).mean()
    return s, R, md - s * R @ ms


def head_transform():
    J, _ = retarget.loki_joints()
    F = ffskel.load()
    face = ttdb.read(FACE_DB)
    sk = face['skeleton']

    def world(n):
        par, m = sk[n]
        return (world(par) @ m) if par else m
    src = np.array([J['l_eye_ball'], J['r_eye_ball'], J['L_Earring_504_A1'], J['R_Earring_504_A1']])
    dst = np.array([world('j_f_eye_l')[:3, 3], world('j_f_eye_r')[:3, 3], F['n_ear_a_l']['world'][:3, 3],
                    F['n_ear_a_r']['world'][:3, 3]])
    s, R, t = umeyama(src, dst)
    err = np.linalg.norm((s * (R @ src.T)).T + t - dst, axis=1)
    print('head similarity: scale %.3f, rot angle %.2f deg, landmark err' % (s, np.degrees(np.arccos((np.trace(R) - 1) / 2))), err.round(4))
    return s, R, t


def main():
    groups, joints, _ = pickle.load(open(WORK + 'loki_groups.pkl', 'rb'))
    fitd = pickle.load(open(WORK + 'outfit_fit.pkl', 'rb'))
    s, R, t = head_transform()
    face = ttdb.read(FACE_DB)
    fparts = [(p.pos, p.nrm, p.tris, None, None) for p in face['meshes'][0].parts]
    surf = fit.Surface(fparts, spacing=0.002)
    out = []
    for sub in fitd['head_items']:
        vm = sub['vmask']
        g = [g for g in groups if g['index'] == sub['gindex']][0]
        P = (s * (R @ (retarget.CONV @ g['pos'][vm].T))).T + t
        N = (R @ (retarget.CONV @ g['nrm'][vm].T)).T / 0.01
        N /= np.linalg.norm(N, axis=1, keepdims=True) + 1e-12
        is_hair = sub['material'] == 'hair'
        margin = 0.004 if is_hair else 0.003
        if np.linalg.norm(P.max(0) - P.min(0)) < bo.RIGID_SIZE:
            P = bo.collide_rigid(P, sub['tris'], vm, surf, margin)
        else:
            P = bo.collide(P, sub['tris'], vm, surf, margin)
        remap = -np.ones(len(vm), np.int64); remap[np.flatnonzero(vm)] = np.arange(vm.sum())
        tris = remap[sub['tris']]
        bones = np.empty((len(P), 8), object); bones[:] = ''; bones[:, 0] = 'j_kao'
        weights = np.zeros((len(P), 8)); weights[:, 0] = 1.0
        out.append({'group': sub['group'], 'material': sub['material'], 'pos': P, 'nrm': N, 'uv': sub['uv'][vm],
                    'tris': tris, 'bones': bones, 'weights': weights, 'hair': is_hair})
    print('head pieces:', [(x['group'], len(x['pos']), 'hair' if x['hair'] else '') for x in out])
    fitd['slots']['met'] = out
    pickle.dump(fitd, open(WORK + 'outfit_fit.pkl', 'wb'))


if __name__ == '__main__':
    main()
