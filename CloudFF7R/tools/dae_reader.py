"""Collada (.dae) reader for skinned character meshes exported by Blender.

Produces numpy arrays per mesh (split into unique vertices the way a GPU wants
them) plus the joint hierarchy with rest and bind matrices.
"""
import xml.etree.ElementTree as ET

import numpy as np

NS = {"c": "http://www.collada.org/2005/11/COLLADASchema"}


def _floats(text):
    return np.array(text.split(), dtype=np.float64)


def _ints(text):
    return np.array(text.split(), dtype=np.int64)


def _mat(values):
    # Collada matrices are written row-major for column vectors.
    return np.asarray(values, dtype=np.float64).reshape(4, 4)


class Joint:
    def __init__(self, name, parent, local):
        self.name = name
        self.parent = parent  # index or -1
        self.local = local  # 4x4 rest transform relative to parent
        self.world = None


class Mesh:
    def __init__(self, name):
        self.name = name
        self.material = None
        self.positions = None  # (V,3) in skin space (bind shape applied)
        self.normals = None  # (V,3)
        self.uvs = None  # (V,2) with V flipped to top-left origin
        self.colors = None  # (V,4)
        self.joints = None  # (V,K) indices into Model.joints
        self.weights = None  # (V,K)
        self.triangles = None  # (T,3)


class Model:
    def __init__(self):
        self.joints = []
        self.joint_index = {}
        self.bind = {}  # joint name -> 4x4 bind world matrix (inverse of IBM)
        self.meshes = []
        self.armature_matrix = np.eye(4)


def _read_source(src):
    fa = src.find("c:float_array", NS)
    acc = src.find(".//c:accessor", NS)
    stride = int(acc.get("stride", "1"))
    return _floats(fa.text).reshape(-1, stride)


def load(path):
    root = ET.parse(path).getroot()
    model = Model()

    # Joint hierarchy from the visual scene.
    scene = root.find(".//c:library_visual_scenes/c:visual_scene", NS)
    mesh_nodes = {}

    def node_matrix(node):
        m = node.find("c:matrix", NS)
        return _mat(_floats(m.text)) if m is not None else np.eye(4)

    def walk(node, parent_idx, parent_world):
        local = node_matrix(node)
        world = parent_world @ local
        idx = parent_idx
        if node.get("type") == "JOINT":
            j = Joint(node.get("sid") or node.get("name"), parent_idx, local)
            j.world = world
            idx = len(model.joints)
            model.joint_index[j.name] = idx
            model.joints.append(j)
        ic = node.find("c:instance_controller", NS)
        if ic is not None:
            bm = ic.find(".//c:instance_material", NS)
            mesh_nodes[ic.get("url").lstrip("#")] = (node.get("name"), world, bm.get("target").lstrip("#") if bm is not None else None)
        for ch in node.iterfind("c:node", NS):
            walk(ch, idx, world)

    for top in scene.iterfind("c:node", NS):
        if top.get("name") == "Armature":
            model.armature_matrix = node_matrix(top)
        walk(top, -1, np.eye(4))

    geometries = {g.get("id"): g for g in root.iterfind(".//c:library_geometries/c:geometry", NS)}

    for ctrl in root.iterfind(".//c:library_controllers/c:controller", NS):
        skin = ctrl.find("c:skin", NS)
        geom = geometries[skin.get("source").lstrip("#")]
        bsm = _mat(_floats(skin.findtext("c:bind_shape_matrix", namespaces=NS)))
        srcs = {s.get("id"): s for s in skin.iterfind("c:source", NS)}
        joints_in = skin.find("c:joints", NS)
        jsrc = ibm_src = None
        for inp in joints_in.iterfind("c:input", NS):
            if inp.get("semantic") == "JOINT":
                jsrc = srcs[inp.get("source").lstrip("#")]
            elif inp.get("semantic") == "INV_BIND_MATRIX":
                ibm_src = srcs[inp.get("source").lstrip("#")]
        jnames = jsrc.find("c:Name_array", NS).text.split()
        ibms = _floats(ibm_src.find("c:float_array", NS).text).reshape(-1, 4, 4)
        for n, ibm in zip(jnames, ibms):
            if n not in model.bind:
                model.bind[n] = np.linalg.inv(ibm)
        vw = skin.find("c:vertex_weights", NS)
        wsrc = None
        offs = {}
        for inp in vw.iterfind("c:input", NS):
            offs[inp.get("semantic")] = int(inp.get("offset"))
            if inp.get("semantic") == "WEIGHT":
                wsrc = srcs[inp.get("source").lstrip("#")]
        wvals = _floats(wsrc.find("c:float_array", NS).text)
        vcount = _ints(vw.findtext("c:vcount", namespaces=NS))
        v = _ints(vw.findtext("c:v", namespaces=NS)).reshape(-1, len(offs))
        K = int(vcount.max())
        npos = len(vcount)
        pj = np.zeros((npos, K), dtype=np.int64)
        pw = np.zeros((npos, K), dtype=np.float64)
        jmap = np.array([model.joint_index[n] for n in jnames])
        cursor = 0
        for i, c in enumerate(vcount):
            seg = v[cursor:cursor + c]
            pj[i, :c] = jmap[seg[:, offs["JOINT"]]]
            pw[i, :c] = wvals[seg[:, offs["WEIGHT"]]]
            cursor += c

        mesh_el = geom.find("c:mesh", NS)
        gsrcs = {s.get("id"): s for s in mesh_el.iterfind("c:source", NS)}
        verts_el = mesh_el.find("c:vertices", NS)
        pos_src = gsrcs[verts_el.find("c:input[@semantic='POSITION']", NS).get("source").lstrip("#")]
        positions = _read_source(pos_src)[:, :3]
        tri = mesh_el.find("c:triangles", NS)
        inputs = {}
        for inp in tri.iterfind("c:input", NS):
            sem = inp.get("semantic")
            src = inp.get("source").lstrip("#")
            inputs[sem] = (int(inp.get("offset")), None if sem == "VERTEX" else _read_source(gsrcs[src]))
        stride = max(o for o, _ in inputs.values()) + 1
        p = _ints(tri.findtext("c:p", namespaces=NS)).reshape(-1, stride)
        # Unique corner keys -> GPU vertices.
        keys, inverse = np.unique(p, axis=0, return_inverse=True)
        inverse = inverse.reshape(-1)
        m = Mesh(mesh_nodes[ctrl.get("id")][0])
        m.material = tri.get("material")
        pi = keys[:, inputs["VERTEX"][0]]
        pos_h = np.c_[positions[pi], np.ones(len(pi))]
        m.positions = (pos_h @ bsm.T)[:, :3]
        n = inputs["NORMAL"][1][keys[:, inputs["NORMAL"][0]]]
        n = n @ bsm[:3, :3].T
        m.normals = n / np.linalg.norm(n, axis=1, keepdims=True).clip(1e-12)
        uv = inputs["TEXCOORD"][1][keys[:, inputs["TEXCOORD"][0]]][:, :2].copy()
        uv[:, 1] = 1.0 - uv[:, 1]
        m.uvs = uv
        if "COLOR" in inputs:
            m.colors = inputs["COLOR"][1][keys[:, inputs["COLOR"][0]]]
        else:
            m.colors = np.ones((len(pi), 4))
        m.joints = pj[pi]
        m.weights = pw[pi]
        m.triangles = inverse.reshape(-1, 3)
        model.meshes.append(m)
    return model
