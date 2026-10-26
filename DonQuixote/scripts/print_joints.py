import sys
import bpy

sys.path.insert(0, r'E:\FFXIV-mods\DonQuixote\scripts')
from xiv_skeleton import build_armature

bpy.ops.wm.read_factory_settings(use_empty=True)
obj, mats = build_armature(sys.argv[sys.argv.index('--') + 1])
for name, m in mats.items():
    if name.startswith(('j_', 'n_hara', 'n_root')) and not name.endswith('_r'):
        p = m.to_translation()
        print('JOINT %-14s %7.3f %7.3f %7.3f' % (name, p.x, p.y, p.z))
