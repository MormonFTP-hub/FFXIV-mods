"""Check the built .pmp: every redirect points at a file in the pack, every material a model
names resolves (in the pack or the game) for each imc variant of its set, every texture a
material names resolves, and the skeleton / animation packs parse and bind in range."""
import json
import re
import shutil
import subprocess
import sys
import zipfile
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))
import havok_tag  # noqa: E402
from dump_havok import havok_of  # noqa: E402
from package import PMP, imc_material_variants  # noqa: E402
from pap import Pap  # noqa: E402
from wowsrc import ROOT  # noqa: E402

XIVTOOL = ROOT / "apps/xivtool/xivtool.exe"


def tool(*args):
    return subprocess.run([str(XIVTOOL), *map(str, args)], capture_output=True, text=True).stdout


def main():
    tmp = ROOT / "work/validate"
    shutil.rmtree(tmp, ignore_errors=True)
    z = zipfile.ZipFile(PMP)
    z.extractall(tmp)
    names = {n.replace("\\", "/") for n in z.namelist()}
    files = json.loads((tmp / "default_mod.json").read_text())["Files"]
    problems = []
    for gp, inner in files.items():
        if inner.replace("\\", "/") not in names:
            problems.append(f"missing in pack: {inner}")
    local = {gp: tmp / inner.replace("\\", "/") for gp, inner in files.items()}

    def resolves(gp):
        return gp in files or "YES" in tool("exists", gp)

    # models -> materials
    mats_checked = 0
    for gp, path in local.items():
        if not gp.endswith(".mdl"):
            continue
        info = tool("mdlinfo", path)
        mats = re.search(r"materials: (.*)", info).group(1).split(", ")
        set_id = int(re.search(r"/e(\d{4})/", gp).group(1))
        part = {"met": 0, "top": 1, "glv": 2, "dwn": 3, "sho": 4}[gp[-7:-4]]
        for v in imc_material_variants(set_id, part):
            for m in mats:
                mp = f"chara/demihuman/d0001/obj/equipment/e{set_id:04d}/material/v{v:04d}/{m.lstrip('/')}"
                mats_checked += 1
                if not resolves(mp):
                    problems.append(f"{gp}: material {mp} not found")
    # materials -> textures
    for gp, path in local.items():
        if gp.endswith(".mtrl"):
            for t in re.findall(r"tex (\S+)", tool("mtrlinfo", path)):
                if not resolves(t):
                    problems.append(f"{gp}: texture {t} not found")
    # skeleton + animations
    sk = havok_tag.read(havok_of(local["chara/demihuman/d0001/skeleton/base/b0001/skl_d0001b0001.sklb"]))
    nbones = len(next(o for o in sk.objects if o.klass.name == "hkaSkeleton")["bones"])
    for gp, path in local.items():
        if gp.endswith(".pap"):
            p = Pap.read(path.read_bytes())
            c = next(o for o in havok_tag.read(p.havok).objects if o.klass.name == "hkaAnimationContainer")
            for e in p.anims:
                b = c["bindings"][e.havok_index]
                if max(b["transformTrackToBoneIndices"]) >= nbones:
                    problems.append(f"{gp}:{e.name} binds bone index past the skeleton")
                a = b["animation"]
                if a.klass.name == "hkaInterleavedUncompressedAnimation":
                    frames = len(a["transforms"]) / a["numberOfTransformTracks"]
                    if frames != int(frames):
                        problems.append(f"{gp}:{e.name} transform count not a multiple of tracks")
    print(f"{len(files)} redirects, {mats_checked} model materials checked, skeleton {nbones} bones")
    print("\n".join(problems) if problems else "OK: no problems")
    sys.exit(1 if problems else 0)


if __name__ == "__main__":
    main()
