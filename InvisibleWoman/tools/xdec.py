"""ctypes wrapper for tools/native/xdec.dll: KTX2 (UASTC/ETC1S, zstd) -> RGBA and meshopt buffer decoding."""
import ctypes as C
from pathlib import Path

import numpy as np

_dll = C.CDLL(str(Path(__file__).resolve().parent / 'native' / 'xdec.dll'))
_dll.ktx2_rgba.argtypes = [C.c_char_p, C.c_uint32, C.POINTER(C.c_uint32), C.POINTER(C.c_uint32), C.c_void_p]
_dll.ktx2_info.argtypes = [C.c_char_p, C.c_uint32, C.c_void_p]
for f in (_dll.mo_vertex, _dll.mo_index, _dll.mo_index_seq):
    f.argtypes = [C.c_void_p, C.c_size_t, C.c_size_t, C.c_char_p, C.c_size_t]
_dll.mo_filter.argtypes = [C.c_int, C.c_void_p, C.c_size_t, C.c_size_t]

FILTERS = {'NONE': 0, 'OCTAHEDRAL': 1, 'QUATERNION': 2, 'EXPONENTIAL': 3, 'COLOR': 4}


def ktx2_info(data: bytes):
    info = (C.c_uint32 * 8)()
    if _dll.ktx2_info(data, len(data), info):
        raise ValueError('bad ktx2')
    return dict(zip(['w', 'h', 'levels', 'layers', 'faces', 'uastc', 'alpha', 'transfer'], list(info)))


def ktx2_rgba(data: bytes) -> np.ndarray:
    w, h = C.c_uint32(), C.c_uint32()
    if _dll.ktx2_rgba(data, len(data), C.byref(w), C.byref(h), None):
        raise ValueError('bad ktx2')
    out = np.zeros((h.value, w.value, 4), np.uint8)
    r = _dll.ktx2_rgba(data, len(data), C.byref(w), C.byref(h), out.ctypes.data)
    if r:
        raise ValueError(f'ktx2 transcode failed ({r})')
    return out


def meshopt(src: bytes, count: int, stride: int, mode: str, filt: str = 'NONE') -> bytes:
    dst = np.zeros(count * stride + 16, np.uint8)
    fn = {'ATTRIBUTES': _dll.mo_vertex, 'TRIANGLES': _dll.mo_index, 'INDICES': _dll.mo_index_seq}[mode]
    r = fn(dst.ctypes.data, count, stride, src, len(src))
    if r:
        raise ValueError(f'meshopt {mode} decode failed ({r})')
    if FILTERS.get(filt, 0):
        _dll.mo_filter(FILTERS[filt], dst.ctypes.data, count, stride)
    return dst[:count * stride].tobytes()
