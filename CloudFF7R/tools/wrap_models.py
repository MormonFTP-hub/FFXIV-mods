"""Wrap the slot .db files into .mdl with TexTools and verify them by unwrapping."""
import os
import sqlite3
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import tt_wrap  # noqa: E402

WORK = os.path.join(os.path.dirname(HERE), "work")

for s in ["top", "glv", "dwn", "sho"]:
    gp = f"chara/equipment/e0263/model/c0101e0263_{s}.mdl"
    src = os.path.join(WORK, "db", f"c0101e0263_{s}.db")
    mdl = os.path.join(WORK, "mdl", f"c0101e0263_{s}.mdl")
    ver = os.path.join(WORK, "verify", f"c0101e0263_{s}.db")
    os.makedirs(os.path.dirname(mdl), exist_ok=True)
    os.makedirs(os.path.dirname(ver), exist_ok=True)
    tt_wrap.wrap_model(src, mdl, gp)
    tt_wrap.unwrap(mdl, ver, gp)
    a, b = sqlite3.connect(src), sqlite3.connect(ver)
    q = ("select mat.name, (select count(*) from parts p where p.mesh=m.mesh), "
         "(select count(*) from vertices v where v.mesh=m.mesh) from meshes m "
         "join materials mat on mat.material_id=m.material_id order by m.mesh")
    def norm(rows):
        return [(n.strip("/").removesuffix(".mtrl"), parts, verts) for n, parts, verts in rows]
    ina, outb = norm(a.execute(q).fetchall()), norm(b.execute(q).fetchall())
    print(s, "OK" if ina == outb else "MISMATCH", outb, os.path.getsize(mdl), "bytes")
