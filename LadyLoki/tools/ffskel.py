"""FFXIV skeleton from TexTools .skel cache (meters, Y-up, +Z forward)."""
import json
import numpy as np


def load(path='E:/FFXIV-mods/LadyLoki/tools/tt/Skeletons/c0201b0001.skel'):
    bones = {}
    for line in open(path, encoding='utf-8'):
        line = line.strip()
        if not line:
            continue
        j = json.loads(line)
        inv = np.array(j['InversePoseMatrix']).reshape(4, 4).T   # column-vector convention
        loc = np.array(j['PoseMatrix']).reshape(4, 4).T
        bones[j['BoneName']] = {'idx': j['BoneNumber'], 'parent': j['BoneParent'], 'local': loc,
                                'world': np.linalg.inv(inv)}
    names = {b['idx']: n for n, b in bones.items()}
    for n, b in bones.items():
        b['parent_name'] = names.get(b['parent'])
    return bones
