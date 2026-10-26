"""Parse a Havok packfile XML skeleton (from NotAssetCc) into JSON: bone names, parents, local TRS."""
import json, re, sys
import xml.etree.ElementTree as ET

src, dst = sys.argv[1], sys.argv[2]
root = ET.parse(src).getroot()
skel = next(o for o in root.iter('hkobject') if o.get('class') == 'hkaSkeleton')
params = {p.get('name'): p for p in skel.findall('hkparam')}

parents = [int(x) for x in params['parentIndices'].text.split()]
names = [b.find("hkparam[@name='name']").text for b in params['bones'].findall('hkobject')]
groups = [[float(x) for x in g.split()] for g in re.findall(r'\(([^)]*)\)', params['referencePose'].text)]
pose = []
for i in range(len(names)):
    t, q, sc = groups[i * 3:i * 3 + 3]  # (tx ty tz)(qx qy qz qw)(sx sy sz)
    pose.append({'t': t, 'q': q, 's': sc})

bones = [{'name': n, 'parent': p, **pose[i]} for i, (n, p) in enumerate(zip(names, parents))]
json.dump(bones, open(dst, 'w'), indent=1)
print(len(bones), 'bones')
print(' '.join(names))
