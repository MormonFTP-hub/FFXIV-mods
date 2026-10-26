"""Print each skin joint's bind-pose world position (from inverse bind matrices) and mesh bounds."""
import sys
import xml.etree.ElementTree as ET
import numpy as np
NS = "{http://www.collada.org/2005/11/COLLADASchema}"
root = ET.parse(sys.argv[1]).getroot()
c = next(root.iter(NS + "controller"))
skin = c.find(NS + "skin")
bsm = np.array(skin.find(NS + "bind_shape_matrix").text.split(), float).reshape(4, 4)
print("bind_shape_matrix\n", bsm)
names = ibm = None
for s in skin.findall(NS + "source"):
    na = s.find(NS + "Name_array")
    if na is not None:
        names = na.text.split()
    elif s.find(NS + "float_array").get("count") and int(s.find(NS + "float_array").get("count")) == 16 * 157:
        ibm = np.array(s.find(NS + "float_array").text.split(), float).reshape(-1, 4, 4)
for n, m in zip(names, ibm):
    w = np.linalg.inv(m)
    if any(k in n for k in ("eye_0", "lip", "cheek", "mayu", "brow")):
        continue
    print(f"{n:32s} pos=({w[0,3]:8.3f},{w[1,3]:8.3f},{w[2,3]:8.3f})  x=({w[0,0]:.2f},{w[1,0]:.2f},{w[2,0]:.2f})")
for g in root.iter(NS + "geometry"):
    src = g.find(NS + "mesh").find(NS + "source")
    p = np.array(src.find(NS + "float_array").text.split(), float).reshape(-1, 3)
    print(g.get("id"), "min", p.min(0).round(2), "max", p.max(0).round(2))
