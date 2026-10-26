"""Print the mean RGB of two images (e.g. source PNG vs BC7 round-trip), to catch gamma shifts."""
import sys
import bpy
import numpy as np

for path in sys.argv[sys.argv.index('--') + 1:]:
    img = bpy.data.images.load(path)
    img.colorspace_settings.name = 'Non-Color'
    px = np.zeros(img.size[0] * img.size[1] * 4, dtype=np.float32)
    img.pixels.foreach_get(px)
    print('MEAN', path.rsplit('\\', 1)[-1].rsplit('/', 1)[-1], (px.reshape(-1, 4)[:, :3].mean(0) * 255).round(1))
