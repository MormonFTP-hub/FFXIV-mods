"""List a .unitypackage and pull out its small text assets (materials, prefabs, animations) for reading."""
import os
import sys
import tarfile

src, out = sys.argv[1], sys.argv[2]
os.makedirs(out, exist_ok=True)
names = {}
with tarfile.open(src, "r:gz") as t:
    members = t.getmembers()
    for m in members:
        if m.name.endswith("/pathname"):
            names[m.name.split("/")[0]] = t.extractfile(m).read().decode("utf-8", "replace").splitlines()[0]
    for m in members:
        guid, _, leaf = m.name.partition("/")
        p = names.get(guid, "")
        if "Poiyomi" in p or "GogoLoco" in p or "VRCSDK" in p:
            continue
        if leaf == "asset" and p.endswith((".mat", ".prefab", ".anim", ".controller", ".asset")) and m.size < 3_000_000:
            open(os.path.join(out, guid + "_" + os.path.basename(p)), "wb").write(t.extractfile(m).read())
        if leaf == "asset.meta" and p.lower().endswith((".png", ".jpg", ".psd", ".tga", ".fbx")):
            open(os.path.join(out, guid + "_" + os.path.basename(p) + ".meta"), "wb").write(t.extractfile(m).read())
for g, p in sorted(names.items(), key=lambda t: t[1]):
    print(g, p)
