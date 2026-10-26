"""Layout of the face's eye atlas: iris, eye whites, lashes and mouth share one material (models keep
to Penumbra's 4-material limit), each in one 512 px cell of a 2x2 texture."""
import numpy as np

CELL_PX = 512
# cell (column, row); row 0 is the top half of the image
EYE_ATLAS = {"iris": (0, 0), "eyewhite": (1, 0), "lash": (0, 1), "mouth": (1, 1)}


def to_atlas_uv(uv, cell):
    """Blender-convention UVs (v up, wrapped into 0..1) -> UVs inside one atlas cell."""
    col, row = EYE_ATLAS[cell]
    uv = np.clip(uv, 0.0, 1.0)
    return np.stack([(uv[:, 0] + col) / 2, (uv[:, 1] + (1 - row)) / 2], 1)


def cell_slice(cell):
    """(rows, cols) slices of a cell in a top-row-first atlas image."""
    col, row = EYE_ATLAS[cell]
    return slice(row * CELL_PX, (row + 1) * CELL_PX), slice(col * CELL_PX, (col + 1) * CELL_PX)
