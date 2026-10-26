"""Print the string table (bones, attributes, materials) of a .mdl file."""
import struct
import sys

data = open(sys.argv[1], "rb").read()
version, stack, runtime, n_vdecl, n_mat = struct.unpack_from("<IIIHH", data, 0)
p = 0x44 + n_vdecl * 136
n_str, _, str_size = struct.unpack_from("<HHI", data, p)
strings = data[p + 8:p + 8 + str_size].split(b"\0")
print(f"version {version:#x} materials {n_mat} vertex decls {n_vdecl}")
for s in strings:
    if s:
        print("  ", s.decode())
