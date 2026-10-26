import pickle, sys, time
sys.path.insert(0, "tools")
import numpy as np
import dae_reader
t = time.time()
m = dae_reader.load("source/Cloud Strife.dae")
print("loaded in", round(time.time() - t, 1), "s; joints", len(m.joints), "bind joints", len(m.bind))
pickle.dump(m, open("work/cloud_model.pkl", "wb"))
np.set_printoptions(precision=4, suppress=True)
print("armature matrix\n", m.armature_matrix)
for name in ["Trans", "C_Hip_a", "C_Spine_a", "C_Spine_d", "C_Neck_a", "C_Head_a", "L_Shoulder_a", "L_UpperArm_a", "L_Forearm_a", "L_Hand_a", "L_Middle_a", "L_UpperLeg_a", "L_Foreleg_a", "L_Foot_a", "L_Toe_a", "L_Toe_End", "C_KDIRoot", "C_HipWOsKdi", "L_TopBeltOsKdi"]:
    j = m.joints[m.joint_index[name]]
    b = m.bind.get(name)
    diff = None if b is None else np.abs(b - j.world).max()
    print(f"{name:16s} rest {j.world[:3,3]}  bind {None if b is None else b[:3,3]} maxdiff {diff}")
allp = np.concatenate([x.positions for x in m.meshes])
print("mesh bounds", allp.min(0), allp.max(0))
for x in m.meshes:
    used = np.unique(x.joints[x.weights > 0])
    print(f"{x.name:10s} mat={x.material:22s} V={len(x.positions):6d} T={len(x.triangles):6d} K={x.joints.shape[1]} wsum[{x.weights.sum(1).min():.3f},{x.weights.sum(1).max():.3f}] uv[{x.uvs.min(0)},{x.uvs.max(0)}] joints={len(used)}")
