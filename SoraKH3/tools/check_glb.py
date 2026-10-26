"""Sanity-check exported .glb files against what Penumbra's glTF model import expects."""
import json
import re
import struct
import sys

GROUPING = re.compile(r"[_ ^](?P<mesh>[0-9]+)[.-]?(?P<sub>[0-9]+)?$")
ok = True
for path in sys.argv[1:]:
    data = open(path, "rb").read()
    jlen = struct.unpack_from("<I", data, 12)[0]
    g = json.loads(data[20:20 + jlen])
    print(f"== {path.rsplit(chr(92), 1)[-1]}")
    skins = g.get("skins", [])
    for node in g["nodes"]:
        if "mesh" not in node:
            continue
        name = node.get("name", "")
        m = GROUPING.search(name)
        mesh = g["meshes"][node["mesh"]]
        prims = mesh["primitives"]
        mat = g["materials"][prims[0]["material"]]["name"] if "material" in prims[0] else None
        attrs = sorted(prims[0]["attributes"])
        verts = g["accessors"][prims[0]["attributes"]["POSITION"]]["count"]
        joints = [g["nodes"][j]["name"] for j in skins[node["skin"]]["joints"]] if "skin" in node else []
        problems = []
        if not m:
            problems.append("name does not match Penumbra's 'name N.M' grouping")
        if len(prims) != 1:
            problems.append(f"{len(prims)} primitives (needs 1)")
        if verts > 65535:
            problems.append(f"{verts} vertices (max 65535)")
        if "skin" not in node:
            problems.append("no skin")
        if len(joints) > 64:
            problems.append(f"{len(joints)} joints in skin")
        for need in ("POSITION", "NORMAL", "TEXCOORD_0", "JOINTS_0", "WEIGHTS_0"):
            if need not in attrs:
                problems.append(f"missing {need}")
        ok &= not problems
        print(f"  {name!r}: material {mat} verts {verts} joints {len(joints)} attrs {attrs} {'OK' if not problems else problems}")
print("ALL OK" if ok else "PROBLEMS FOUND")
