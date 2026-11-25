"""Build the standalone website copy of the calculator into ArknightsCalc/build/site.

index.html in the project is written for a claude.ai artifact, which adds the page's outer skeleton itself.
A normal web host needs that skeleton in the file, so this adds it and copies the two data files.
Usage: python tools/build_site.py
"""
import os, shutil

here = os.path.dirname(os.path.abspath(__file__))
root = os.path.dirname(here)
site = os.path.join(root, "build", "site")
os.makedirs(site, exist_ok=True)

HEAD = """<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<meta name="description" content="Fan-made Arknights calculator: damage per second, headhunting odds, Sanity and farming.">
<style>:root{color-scheme:light;padding:env(safe-area-inset-top,0px) 0 env(safe-area-inset-bottom,0px)}body{margin:0;font:14px system-ui,sans-serif}img{max-width:100%}[hidden]{display:none!important}</style>
"""

with open(os.path.join(root, "index.html"), encoding="utf-8") as f:
    page = f.read()
with open(os.path.join(site, "index.html"), "w", encoding="utf-8", newline="\n") as f:
    f.write(HEAD + page + "\n</html>\n")
for name in ("operators.json", "enemies.json", "baseskills.json", "workshop.json"):
    shutil.copyfile(os.path.join(root, name), os.path.join(site, name))
for name in sorted(os.listdir(site)):
    p = os.path.join(site, name)
    if os.path.isfile(p):
        print(name, os.path.getsize(p), "bytes")
