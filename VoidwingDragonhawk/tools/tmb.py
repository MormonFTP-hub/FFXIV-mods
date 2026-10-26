"""Minimal TMB timelines for pap animations: one track that plays the animation (C009).

Layout copied from vanilla cbnm_jump_1: TMLB, TMDH (length), TMAL -> TMAC -> TMTR -> C009,
then the id lists and the animation name. Offsets inside entries are relative to the
entry start + 8, so only the name and the two lengths change between animations.
"""
import struct

TEMPLATE = bytes.fromhex(
    "544d4c428a000000050000005"
    "44d444810000000010000000300030054"
    "4d414c10000000540000000100000054"
    "4d41431c000000020000000000000000"
    "00000046000000010000005"
    "44d5452180000000300000"
    "02c00000001000000000000004330303918000000040000000300000000000000160000000200030004"
    "00".replace(" ", "")
)


def build(name, frames):
    """frames = number of frames - 1 (the length FFXIV stores)."""
    t = bytearray(TEMPLATE[:0x7e])
    struct.pack_into("<H", t, 0x18, frames)     # TMDH length
    struct.pack_into("<I", t, 0x6c, frames)     # C009 length
    t += name.encode() + b"\0"
    struct.pack_into("<I", t, 4, len(t))        # TMLB size
    return bytes(t)
