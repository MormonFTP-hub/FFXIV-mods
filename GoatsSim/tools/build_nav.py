# Builds the walkable floor layers and a coarse occupancy grid for the fight area of Hanamura,
# from the cached map (.blend made by export_map.py's first pass, or by importing the FBX once).
#
#   blender -b GoatsSim/work/map/hanamura.blend --python GoatsSim/tools/build_nav.py
#
# Every triangle in the area is sampled densely. Up-facing samples are floor candidates; every
# sample marks its voxel as solid. A floor is standable where the 0.5-1.8 m above it is free.
# Output (work/map/nav.json + nav.bin):
#   floors:  NX*NY*L uint8, height = val*DZ + Z0, 255 = no floor (L layers, lowest first)
#   solid:   NX*NY*NZ bits for line of sight and projectile hits. Built from walls, roofs and ceilings
#            only: floors are left out so a shot skimming over a ledge isn't stopped by the ground.
import bpy, os, json
import numpy as np

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(os.path.dirname(HERE), "work", "map")

X0, X1, Y0, Y1 = -70.0, 110.0, -80.0, 90.0   # blender coords (z up)
Z0, Z1 = -12.0, 36.0
CELL = 0.5
DZ = 0.25
L = 4
SPACING = 0.16


def triangles():
    tris = []
    for o in bpy.data.objects:
        if o.type != "MESH" or not o.data.polygons:
            continue
        me = o.data
        nv = len(me.vertices)
        co = np.zeros(nv * 3, np.float32)
        me.vertices.foreach_get("co", co)
        M = np.array(o.matrix_world, np.float32)
        w = co.reshape(-1, 3) @ M[:3, :3].T + M[:3, 3]
        lo, hi = w.min(0), w.max(0)
        if hi[0] < X0 or lo[0] > X1 or hi[1] < Y0 or lo[1] > Y1 or hi[2] < Z0 or lo[2] > Z1:
            continue
        me.calc_loop_triangles()
        t = np.zeros(len(me.loop_triangles) * 3, np.int32)
        me.loop_triangles.foreach_get("vertices", t)
        tris.append(w[t.reshape(-1, 3)])
    return np.concatenate(tris)


def main():
    T = triangles()
    print("triangles in box", len(T))
    A, B, C = T[:, 0], T[:, 1], T[:, 2]
    n = np.cross(B - A, C - A)
    area2 = np.linalg.norm(n, axis=1)
    keep = area2 > 1e-8
    A, B, C, n, area2 = A[keep], B[keep], C[keep], n[keep], area2[keep]
    nz = n[:, 2] / area2
    up = nz > 0.65
    counts = np.clip(np.ceil(area2 * 0.5 / (SPACING ** 2)).astype(np.int64), 3, 20000)
    NX = int((X1 - X0) / CELL)
    NY = int((Y1 - Y0) / CELL)
    NZ = int((Z1 - Z0) / DZ)
    solid = np.zeros((NX, NY, NZ), bool)
    wall = np.zeros((NX, NY, NZ), bool)
    floor = np.zeros((NX, NY, NZ), bool)
    rng = np.random.default_rng(1)
    total = 0
    # process in chunks of triangles; samples = vertices + random barycentric points
    idx = np.repeat(np.arange(len(A)), counts)
    for s in range(0, len(idx), 4_000_000):
        ii = idx[s:s + 4_000_000]
        r1 = np.sqrt(rng.random(len(ii), dtype=np.float32))
        r2 = rng.random(len(ii), dtype=np.float32)
        P = (1 - r1)[:, None] * A[ii] + (r1 * (1 - r2))[:, None] * B[ii] + (r1 * r2)[:, None] * C[ii]
        ix = ((P[:, 0] - X0) / CELL).astype(np.int64)
        iy = ((P[:, 1] - Y0) / CELL).astype(np.int64)
        iz = ((P[:, 2] - Z0) / DZ).astype(np.int64)
        ok = (ix >= 0) & (ix < NX) & (iy >= 0) & (iy < NY) & (iz >= 0) & (iz < NZ)
        solid[ix[ok], iy[ok], iz[ok]] = True
        w = ok & ~up[ii]
        wall[ix[w], iy[w], iz[w]] = True
        u = ok & up[ii]
        floor[ix[u], iy[u], iz[u]] = True
        total += len(ii)
    print("samples", total)
    # standable: floor voxel with free space from +0.5 m to +1.8 m above it
    lo_k, hi_k = int(0.5 / DZ), int(1.8 / DZ)
    occ_cum = np.concatenate([np.zeros((NX, NY, 1), np.int32), np.cumsum(solid, axis=2, dtype=np.int32)], axis=2)
    k = np.arange(NZ)
    a = np.clip(k + lo_k, 0, NZ)
    b = np.clip(k + hi_k + 1, 0, NZ)
    blocked_above = (occ_cum[:, :, b] - occ_cum[:, :, a]) > 0
    stand = floor & ~blocked_above
    # keep the top voxel of each run of standable voxels (stairs/ramps sample several levels)
    top = stand & ~np.concatenate([stand[:, :, 1:], np.zeros((NX, NY, 1), bool)], axis=2)
    floors = np.full((NX, NY, L), 255, np.uint8)
    cnt = np.zeros((NX, NY), np.int32)
    for kz in range(NZ):
        m = top[:, :, kz] & (cnt < L)
        floors[m, cnt[m]] = kz
        cnt[m] += 1
    print("cells with floor", (cnt > 0).sum(), "of", NX * NY, "multi-layer", (cnt > 1).sum())
    # line-of-sight grid: walls / roofs / ceilings at full resolution
    f = 1
    cs = wall
    os.makedirs(OUT, exist_ok=True)
    meta = dict(x0=X0, y0=Y0, z0=Z0, cell=CELL, dz=DZ, nx=NX, ny=NY, nz=NZ, layers=L,
                solid=dict(cell=CELL * f, dz=DZ * f, nx=cs.shape[0], ny=cs.shape[1], nz=cs.shape[2]),
                note="blender coords: x east, y north, z up. floors[(ix*ny+iy)*L+l]; solid bits [(ix*sny+iy)*snz+iz]")
    with open(os.path.join(OUT, "nav.json"), "w") as fp:
        json.dump(meta, fp, indent=1)
    with open(os.path.join(OUT, "nav.bin"), "wb") as fp:
        fp.write(floors.tobytes())
        fp.write(np.packbits(cs.ravel()).tobytes())
    np.save(os.path.join(OUT, "floors.npy"), floors)
    # preview: lowest standable floor height, shaded
    h = np.where(cnt > 0, floors[:, :, 0].astype(np.float32) * DZ + Z0, np.nan)
    hh = np.nan_to_num((h - np.nanmin(h)) / (np.nanmax(h) - np.nanmin(h) + 1e-6), nan=0)
    rgb = np.stack([hh, 0.3 + 0.5 * hh, 1 - hh], -1) * (cnt > 0)[..., None]
    rgb[cnt > 1] *= np.array([1.0, 0.6, 0.6])
    img = bpy.data.images.new("floors", NX, NY)
    px = np.ones((NY, NX, 4), np.float32)
    px[..., :3] = rgb.transpose(1, 0, 2)
    img.pixels = px.ravel()
    img.filepath_raw = os.path.join(OUT, "floors_preview.png")
    img.file_format = "PNG"
    img.save()


main()
