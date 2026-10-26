import sys, pickle; sys.path.insert(0, 'E:/FFXIV-mods/LadyLoki/tools')
import render, numpy as np
from PIL import Image
exec(open('E:/FFXIV-mods/LadyLoki/tools/preview_fit.py').read().split("X=np.array")[0])
X=np.array([1,0,0.]);Y=np.array([0,1,0.]);Z=np.array([0,0,1.])
cx, cy, half = [float(v) for v in sys.argv[1:4]]
out = sys.argv[4]
ims = [render.render(items + bibo, right=r, up=Y, size=800, bounds=(c, cy, half))[0] for r, c in ((X, cx), (Z, 0.0), (-X, -cx))]
s = Image.new('RGB', (2400, 800))
for i, im in enumerate(ims): s.paste(im, (i * 800, 0))
s.save(out)
