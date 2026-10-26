"""Copy one game file out of SqPack: dump_game_file.py <game_dir> <game_path> <out_file>"""
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from sqpack import Repo

repo = Repo(sys.argv[1])
data = repo.read(sys.argv[2])
os.makedirs(os.path.dirname(os.path.abspath(sys.argv[3])), exist_ok=True)
with open(sys.argv[3], "wb") as f:
    f.write(data)
print(sys.argv[2], len(data), "bytes")
