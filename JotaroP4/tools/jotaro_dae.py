"""Read the Eyes of Heaven Jotaro (Part 4) Collada rip: meshes, skins and the joint tree.

Source space: centimetres, Z up, character faces -Y, character's left is +X.
Skin joints are named by node sid ("joint12"); they are resolved to node names here.
"""
import xml.etree.ElementTree as ET

import numpy as np

NS = "{http://www.collada.org/2005/11/COLLADASchema}"
PREFIX = "_jtr01t0_"


def _floats(el):
    return np.array(el.text.split(), np.float64)


def short(name):
    return name[len(PREFIX):] if name.startswith(PREFIX) else name


def parse(path):
    root = ET.parse(path).getroot()

    # joint tree: short name -> parent short name, sid -> short name
    parents, sid_name = {}, {}

    def walk(node, parent):
        if node.get("type") == "JOINT":
            name = short(node.get("name"))
            parents[name] = parent
            sid_name[node.get("sid")] = name
            parent = name
        for ch in node.findall(NS + "node"):
            walk(ch, parent)

    for vs in root.iter(NS + "visual_scene"):
        for n in vs.findall(NS + "node"):
            walk(n, None)

    geoms = {}
    for g in root.iter(NS + "geometry"):
        mesh = g.find(NS + "mesh")
        sources = {}
        for s in mesh.findall(NS + "source"):
            acc = s.find(f"{NS}technique_common/{NS}accessor")
            sources[s.get("id")] = _floats(s.find(NS + "float_array")).reshape(-1, int(acc.get("stride")))
        vert_src = {v.get("id"): v.find(NS + "input").get("source")[1:] for v in mesh.findall(NS + "vertices")}
        tris = mesh.find(NS + "triangles")
        inputs = {i.get("semantic"): (i.get("source")[1:], int(i.get("offset"))) for i in tris.findall(NS + "input")}
        stride = max(o for _, o in inputs.values()) + 1
        p = np.array(tris.find(NS + "p").text.split(), np.int64).reshape(-1, stride)
        vs, vo = inputs["VERTEX"]
        ns, no = inputs["NORMAL"]
        us, uo = inputs["TEXCOORD"]
        geoms[g.get("id")] = dict(
            name=short(g.get("name")), id=g.get("id"), material=tris.get("material"),
            pos=sources[vert_src[vs]], nrm=sources[ns], uv=sources[us][:, :2],
            c_pos=p[:, vo].reshape(-1, 3), c_nrm=p[:, no].reshape(-1, 3), c_uv=p[:, uo].reshape(-1, 3))

    skins = {}
    for c in root.iter(NS + "controller"):
        skin = c.find(NS + "skin")
        bsm = np.array(skin.find(NS + "bind_shape_matrix").text.split(), float).reshape(4, 4)
        srcs = {}
        for s in skin.findall(NS + "source"):
            na = s.find(NS + "Name_array")
            srcs[s.get("id")] = na.text.split() if na is not None else _floats(s.find(NS + "float_array"))
        joints_in = {i.get("semantic"): i.get("source")[1:] for i in skin.find(NS + "joints").findall(NS + "input")}
        vw = skin.find(NS + "vertex_weights")
        vin = {i.get("semantic"): (i.get("source")[1:], int(i.get("offset"))) for i in vw.findall(NS + "input")}
        names = [sid_name.get(n, n) for n in srcs[joints_in["JOINT"]]]
        ibm = srcs[joints_in["INV_BIND_MATRIX"]].reshape(-1, 4, 4)
        wsrc = srcs[vin["WEIGHT"][0]]
        vcount = np.array(vw.find(NS + "vcount").text.split(), np.int64)
        v = np.array(vw.find(NS + "v").text.split(), np.int64).reshape(-1, 2)
        jo, wo = vin["JOINT"][1], vin["WEIGHT"][1]
        weights, k = [], 0
        for n in vcount:
            weights.append([(names[int(v[k + i, jo])], float(wsrc[v[k + i, wo]])) for i in range(n)])
            k += n
        skins[skin.get("source")[1:]] = dict(joints=names, ibm=ibm, bsm=bsm, weights=weights)
    return geoms, skins, parents


def bind_pose(skins):
    """Joint name -> 4x4 bind-pose world matrix (source space), from the inverse bind matrices."""
    bind = {}
    for s in skins.values():
        for n, m in zip(s["joints"], s["ibm"]):
            bind.setdefault(n, np.linalg.inv(m))
    return bind
