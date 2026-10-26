"""Print a structural summary of a Collada file: geometries, skins, joint tree."""
import sys
import xml.etree.ElementTree as ET

NS = {"c": "http://www.collada.org/2005/11/COLLADASchema"}


def main(path):
    root = ET.parse(path).getroot()
    print("== materials")
    for m in root.iterfind(".//c:library_materials/c:material", NS):
        print(" ", m.get("id"), m.get("name"))
    print("== images")
    for im in root.iterfind(".//c:library_images/c:image", NS):
        print(" ", im.get("id"), im.findtext("c:init_from", namespaces=NS))
    print("== geometries")
    for g in root.iterfind(".//c:library_geometries/c:geometry", NS):
        mesh = g.find("c:mesh", NS)
        srcs = {s.get("id"): s for s in mesh.iterfind("c:source", NS)}
        pos_count = None
        for s in srcs.values():
            fa = s.find("c:float_array", NS)
            acc = s.find(".//c:accessor", NS)
            if s.get("id").endswith("positions"):
                pos_count = int(acc.get("count"))
        prims = []
        for p in mesh:
            tag = p.tag.split("}")[1]
            if tag in ("triangles", "polylist", "polygons"):
                inputs = [(i.get("semantic"), i.get("set"), i.get("offset")) for i in p.iterfind("c:input", NS)]
                prims.append((tag, p.get("material"), int(p.get("count")), inputs))
        print(f"  {g.get('id')} name={g.get('name')} positions={pos_count}")
        for s in srcs:
            print("     src", s, srcs[s].find('.//c:accessor', NS).get('count'), srcs[s].find('.//c:accessor', NS).get('stride'))
        for pr in prims:
            print("     prim", pr[0], pr[1], pr[2], pr[3])
    print("== controllers")
    for c in root.iterfind(".//c:library_controllers/c:controller", NS):
        skin = c.find("c:skin", NS)
        names = skin.find(".//c:Name_array", NS)
        n = int(names.get("count"))
        print(f"  {c.get('id')} source={skin.get('source')} joints={n}")
    print("== visual scene")

    def walk(node, depth):
        t = node.get("type")
        name = node.get("name")
        extra = ""
        ic = node.find("c:instance_controller", NS)
        ig = node.find("c:instance_geometry", NS)
        if ic is not None:
            extra = " ctrl=" + ic.get("url")
        if ig is not None:
            extra = " geom=" + ig.get("url")
        if t == "JOINT" and depth > 14:
            pass
        print("  " * depth + f"{name} [{t}] sid={node.get('sid')}{extra}")
        for ch in node.iterfind("c:node", NS):
            walk(ch, depth + 1)

    for vs in root.iterfind(".//c:library_visual_scenes/c:visual_scene", NS):
        for n in vs.iterfind("c:node", NS):
            walk(n, 0)


if __name__ == "__main__":
    main(sys.argv[1])
