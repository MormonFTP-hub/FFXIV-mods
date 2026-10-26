"""Round-trip game tagfiles through havok_tag: parse, re-write with our own object order, compare bytes."""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))
import havok_tag  # noqa: E402
from dump_havok import havok_of  # noqa: E402

GAME = Path(__file__).resolve().parents[1] / "work/game/chara/demihuman/d0001"
FILES = [
    GAME / "skeleton/base/b0001/skl_d0001b0001.sklb",
    GAME / "animation/a0001/bt_common/resident/idle.pap",
    GAME / "animation/a0001/bt_common/resident/demihuman.pap",
    GAME / "animation/a0001/bt_common/resident/mount.pap",
]


def main():
    ok = True
    for f in FILES + [Path(p) for p in sys.argv[1:]]:
        data = havok_of(f)
        tf = havok_tag.read(data)
        same_order = havok_tag.write_order(tf.root) == tf.objects
        out = havok_tag.write(tf)
        same = out == data
        ok &= same and same_order
        first = next((i for i, (a, b) in enumerate(zip(out, data)) if a != b), None)
        print(f"{f.name}: objects={len(tf.objects)} order_match={same_order} bytes_match={same} "
              f"len {len(out)} vs {len(data)} first_diff={first}")
    sys.exit(0 if ok else 1)


if __name__ == "__main__":
    main()
