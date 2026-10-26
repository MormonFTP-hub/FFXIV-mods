"""Pull the image assets out of a .unitypackage and summarise which textures/colours each material uses."""
import glob
import os
import re
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
        if leaf == "asset" and p.lower().endswith((".png", ".jpg")) and "Lament" not in p and "Poiyomi" not in p:
            open(os.path.join(out, os.path.basename(p)), "wb").write(t.extractfile(m).read())

mats = sorted(glob.glob(os.path.join(os.path.dirname(out), "upkg", "*.mat")))
for mp in mats:
    txt = open(mp, encoding="utf-8", errors="replace").read()
    shader = re.search(r"m_Shader: \{fileID: (\d+), guid: (\w+)", txt)
    print(f"\n== {os.path.basename(mp)[33:]}  shader={shader.group(2)[:8] if shader else None}")
    for name, guid in re.findall(r"- (_\w+):\n\s+m_Texture: \{fileID: \d+, guid: (\w+)", txt):
        print(f"   tex {name:28s} {names.get(guid, guid)}")
    for name, val in re.findall(r"- (_(?:Color|EmissionColor|EmissionStrength|Metallic|Glossiness|Smoothness|Cutoff|Mode|BumpScale|LightingMode|MainHueShift\w*|Saturation|AlphaMod|Cull|EnableEmission|EmissionMap\w*))\w*: (.+)", txt):
        print(f"   val {name:28s} {val}")
