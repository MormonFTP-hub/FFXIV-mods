"""Empty (single degenerate triangle) models that hide the FFXIV face and
hair, plus empty Strife glove/legs models for the 'keep my own head' option."""
import json
import os
import sqlite3
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import tt_wrap  # noqa: E402

ROOT = os.path.dirname(HERE)
WORK = os.path.join(ROOT, "work", "hiders")
OUT = os.path.join(ROOT, "out")
SCHEMA = os.path.join(HERE, "tt", "converters", "fbx", "sql", "CreateDB.SQL")


def empty_db(path, root_name, material, bone):
    if os.path.exists(path):
        os.remove(path)
    db = sqlite3.connect(path)
    db.executescript(open(SCHEMA).read())
    db.executemany("insert into meta values (?,?)", [
        ("unit", "meter"), ("application", "cloud_ff7r_port"), ("version", "1.0"), ("up", "y"),
        ("front", "z"), ("handedness", "r"), ("for_3ds_max", "0"), ("root_name", root_name)])
    db.execute("insert into models values (0, ?)", (root_name,))
    db.execute("insert into materials values (0, ?, '', '', '', '', '')", (material,))
    db.execute("insert into meshes values (0, 0, 0, 'Empty', 'Standard')")
    db.execute("insert into parts values (0, 0, 'Part 0', '')")
    db.execute("insert into bones values (0, 0, ?)", (bone,))
    for vi in range(3):
        db.execute("insert into vertices values (" + ",".join(["?"] * 47) + ")", (
            0, 0, vi, 0.0, 1.6, 0.0, 0.0, 0.0, 1.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0,
            1.0, 1.0, 1.0, 1.0, 0.0, 0.0, 0.0, 1.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0,
            0, 1.0, 0, 0.0, 0, 0.0, 0, 0.0, 0, 0.0, 0, 0.0, 0, 0.0, 0, 0.0, 0.0, 0.0))
        db.execute("insert into indices values (0, 0, ?, ?)", (vi, vi))
    db.commit()
    db.close()


def make(game_path, material, bone, out_root):
    name = os.path.splitext(os.path.basename(game_path))[0]
    db = os.path.join(WORK, name + ".db")
    empty_db(db, name, material, bone)
    out = os.path.join(out_root, *game_path.split("/"))
    os.makedirs(os.path.dirname(out), exist_ok=True)
    tt_wrap.wrap_model(db, out, game_path)
    return out


def main():
    os.makedirs(WORK, exist_ok=True)
    models = json.load(open(os.path.join(ROOT, "work", "face_hair_models.json")))
    done = 0
    for kind in ("face", "hair"):
        for game_path, mats in models[kind]:
            make(game_path, mats[0], "j_kao", os.path.join(OUT, "hide"))
            done += 1
    for slot in ("glv", "dwn"):
        make(f"chara/equipment/e0263/model/c0101e0263_{slot}.mdl", f"/mt_c0101e0263_{slot}_a.mtrl", "j_kosi",
             os.path.join(OUT, "ownhead"))
        done += 1
    print("built", done, "empty models")


if __name__ == "__main__":
    main()
