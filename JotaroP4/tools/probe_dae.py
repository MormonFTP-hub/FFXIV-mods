"""Summarise a Collada rip: geometries, materials, skins and the joint tree with bind positions.

usage: python -I probe_dae.py <file.dae>
"""
import sys
import xml.etree.ElementTree as ET

import numpy as np

NS = "{http://www.collada.org/2005/11/COLLADASchema}"
root = ET.parse(sys.argv[1]).getroot()

up = root.find(f"{NS}asset/{NS}up_axis")
unit = root.find(f"{NS}asset/{NS}unit")
print("up_axis", up.text if up is not None else None, "unit", unit.attrib if unit is not None else None)

print("\n== images")
for im in root.iter(NS + "image"):
    f = im.find(NS + "init_from")
    print(" ", im.get("id"), "->", f.text if f is not None else None)

print("\n== materials -> effects")
for m in root.iter(NS + "material"):
    print(" ", m.get("id"), m.get("name"), m.find(NS + "instance_effect").get("url"))

print("\n== geometries")
for g in root.iter(NS + "geometry"):
    mesh = g.find(NS + "mesh")
    srcs = {s.get("id"): s for s in mesh.findall(NS + "source")}
    for prim in list(mesh):
        if prim.tag in (NS + "triangles", NS + "polylist"):
            ins = [(i.get("semantic"), i.get("set"), i.get("source")) for i in prim.findall(NS + "input")]
            print(f"  {g.get('id')} name={g.get('name')} mat={prim.get('material')} count={prim.get('count')} inputs={ins}")
    for sid, s in srcs.items():
        acc = s.find(f"{NS}technique_common/{NS}accessor")
        print(f"      src {sid} count={acc.get('count')} stride={acc.get('stride')}")

print("\n== controllers")
for c in root.iter(NS + "controller"):
    skin = c.find(NS + "skin")
    names = None
    for s in skin.findall(NS + "source"):
        na = s.find(NS + "Name_array")
        if na is not None:
            names = na.text.split()
    vw = skin.find(NS + "vertex_weights")
    vc = np.array(vw.find(NS + "vcount").text.split(), int)
    print(f"  {c.get('id')} -> {skin.get('source')} joints={len(names)} verts={len(vc)} max_infl={vc.max()}")

print("\n== joint tree (world bind position)")


def mat(node):
    m = np.eye(4)
    for ch in node:
        if ch.tag == NS + "matrix":
            m = m @ np.array(ch.text.split(), float).reshape(4, 4)
        elif ch.tag == NS + "translate":
            t = np.eye(4); t[:3, 3] = np.array(ch.text.split(), float); m = m @ t
    return m


def walk(node, parent_m, depth):
    m = parent_m @ mat(node)
    kind = node.get("type")
    extra = ""
    ic = node.find(NS + "instance_controller")
    ig = node.find(NS + "instance_geometry")
    if ic is not None:
        extra = f" [controller {ic.get('url')}]"
    if ig is not None:
        extra = f" [geometry {ig.get('url')}]"
    p = m[:3, 3]
    print(f"{'  ' * depth}{node.get('name')} ({kind}) pos=({p[0]:.3f}, {p[1]:.3f}, {p[2]:.3f}){extra}")
    for ch in node.findall(NS + "node"):
        walk(ch, m, depth + 1)


for vs in root.iter(NS + "visual_scene"):
    for n in vs.findall(NS + "node"):
        walk(n, np.eye(4), 0)
