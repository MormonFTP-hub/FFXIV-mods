"""Summarise psylocke.gg GLBs: asset extras, meshes/primitives, materials, skins, images."""
import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import glb  # noqa: E402

for p in sys.argv[1:]:
    g = glb.Glb(p).g
    print("==", Path(p).name[:16], "asset", json.dumps(g.get("asset", {}))[:300])
    print("  scene extras", json.dumps(g.get("scenes", [{}])[0].get("extras", {}))[:300])
    print("  nodes", len(g.get("nodes", [])), "meshes", len(g.get("meshes", [])), "skins",
          [len(s["joints"]) for s in g.get("skins", [])], "images", len(g.get("images", [])),
          "anims", len(g.get("animations", [])))
    for m in g.get("meshes", []):
        print("  mesh", m.get("name"), [(g["materials"][pr["material"]]["name"] if "material" in pr else None,
                                         g["accessors"][pr["attributes"]["POSITION"]]["count"]) for pr in m["primitives"]],
              "targets", len(m.get("extras", {}).get("targetNames", [])))
    for mt in g.get("materials", [])[:40]:
        ex = mt.get("extras", {})
        print("   mat", mt["name"], mt.get("alphaMode", ""), ex.get("parentMaterial"), ex.get("recipeKey"))
