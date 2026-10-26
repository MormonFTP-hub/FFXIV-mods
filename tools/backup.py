"""Back the whole FFXIV-mods folder up to GitHub.

Rebuilds the mod gallery in README.md (thumbnails in docs/thumbs), commits and pushes everything
.gitignore lets through, then uploads each .pmp to the rolling "mods" release and the app .exe files
to the "apps" release. Only files that are new or changed since their last upload go up again.

    python tools/backup.py             # gallery + commit + push + release uploads
    python tools/backup.py --readme    # only rebuild the gallery
    python tools/backup.py --no-push   # gallery + local commit, nothing sent to GitHub
"""
import argparse
import datetime as dt
import json
import os
import re
import shutil
import subprocess
import sys
import tempfile
import zipfile
from pathlib import Path

from PIL import Image, ImageChops

ROOT = Path(__file__).resolve().parents[1]
README = ROOT / 'README.md'
THUMBS = ROOT / 'docs' / 'thumbs'
START, END = '<!-- mods:start -->', '<!-- mods:end -->'
APPS = ['PmpViewer/PMP Viewer.exe', 'Authenticator/Authenticator.exe', 'InstaViewer/Insta Viewer.exe']
THUMB_SIZE = (800, 400)
COLUMNS = 3
# The repo is public and commits go up unattended, so anything that looks like a live credential stops the commit
SECRET_PATTERNS = {
    'Discord bot token': r'[MN][A-Za-z\d]{23,25}\.[\w-]{6}\.[\w-]{27,}',
    'Discord webhook URL': r'discord(?:app)?\.com/api/webhooks/\d+/[\w-]{20,}',
    'GitHub token': r'\bgh[pousr]_[A-Za-z0-9]{36,}',
    'API key (sk-)': r'\bsk-(?:ant-)?[A-Za-z0-9_-]{32,}',
    'Google API key': r'\bAIza[0-9A-Za-z_-]{35}\b',
    'AWS access key': r'\bAKIA[0-9A-Z]{16}\b',
    'Slack token': r'\bxox[baprs]-[A-Za-z0-9-]{10,}',
    'private key': r'-----BEGIN [A-Z ]*PRIVATE KEY-----',
}


def gh_exe():
    for found in (shutil.which('gh'), Path(os.environ.get('LOCALAPPDATA', '')) / 'Programs/GitHub CLI/gh.exe',
                  r'C:\Program Files\GitHub CLI\gh.exe'):
        if found and Path(found).exists():
            return str(found)
    sys.exit('GitHub CLI not found: winget install --id GitHub.cli, then gh auth login')


def run(*cmd, check=True, capture=False):
    r = subprocess.run(cmd, cwd=ROOT, text=True, encoding='utf-8', errors='replace', capture_output=capture)
    if check and r.returncode:
        sys.exit(f'failed ({r.returncode}): {" ".join(cmd)}\n{r.stderr or ""}')
    return r.stdout if capture else r.returncode


def staged_secrets():
    """Added lines in the staged diff that look like a credential: [(file, kind)]."""
    diff = run('git', 'diff', '--cached', '-U0', '--no-color', '--diff-filter=AM', capture=True)
    hits, current = set(), None
    for line in diff.splitlines():
        if line.startswith('+++ '):
            current = line[6:] if line.startswith('+++ b/') else None
        elif line.startswith('+') and current:
            hits.update((current, kind) for kind, pat in SECRET_PATTERNS.items() if re.search(pat, line))
    return sorted(hits)


def slug(text):
    return re.sub(r'[^A-Za-z0-9]+', '-', text).strip('-')


def find_mods():
    """Every finished .pmp: <Project>/out*/x.pmp or <Project>/x.pmp, with its meta.json."""
    paths = sorted(set(ROOT.glob('*/out*/*.pmp')) | set(ROOT.glob('*/*.pmp')))
    mods = []
    for p in paths:
        with zipfile.ZipFile(p) as z:
            meta = json.loads(z.read('meta.json').decode('utf-8-sig'))
        project = p.relative_to(ROOT).parts[0]
        desc = (meta.get('Description') or '').replace('\r', '')
        blurb = ' '.join(desc.split('\n\n')[0].split())
        mods.append(dict(path=p, project=project, name=meta.get('Name') or p.stem,
                         version=meta.get('Version') or '', blurb=blurb, asset=slug(p.stem) + '.pmp'))
    # Two projects can ship the same file name (Loki and LadyLoki): keep their assets apart
    for m in mods:
        if sum(o['asset'] == m['asset'] for o in mods) > 1:
            m['clash'] = True
    for m in mods:
        if m.pop('clash', False):
            m['asset'] = f"{m['project']}-{m['asset']}"
    return mods


def preview_for(pmp):
    project_out = ROOT / pmp.relative_to(ROOT).parts[0] / 'out'
    for folder in (pmp.parent, project_out):
        for pick in ('preview.png', '*preview.png', 'preview_races.png', '*preview*.png'):
            hits = sorted(folder.glob(pick))
            if hits:
                return hits[0]
    return None


def make_thumb(src, dst):
    """Trim the plain backdrop, then letterbox into a 2:1 card on the same backdrop colour."""
    im = Image.open(src).convert('RGB')
    bg = im.getpixel((2, 2))
    diff = ImageChops.difference(im, Image.new('RGB', im.size, bg)).convert('L').point(lambda v: 255 if v > 12 else 0)
    box = diff.getbbox()
    if box:
        pad = int(0.04 * max(im.size))
        box = (max(0, box[0] - pad), max(0, box[1] - pad), min(im.width, box[2] + pad), min(im.height, box[3] + pad))
        im = im.crop(box)
    im.thumbnail(THUMB_SIZE, Image.LANCZOS)
    card = Image.new('RGB', THUMB_SIZE, bg)
    card.paste(im, ((THUMB_SIZE[0] - im.width) // 2, (THUMB_SIZE[1] - im.height) // 2))
    dst.parent.mkdir(parents=True, exist_ok=True)
    card.save(dst, 'JPEG', quality=84, optimize=True, progressive=True)


def build_gallery(mods):
    cells = []
    for m in mods:
        folder = m['project']
        readme = next((r for r in (f'{folder}/README.md', f'{folder}/out/README.md') if (ROOT / r).exists()), folder)
        src = preview_for(m['path'])
        thumb = ''
        if src:
            dst = THUMBS / (Path(m['asset']).stem + '.jpg')
            if not dst.exists() or dst.stat().st_mtime < src.stat().st_mtime:
                make_thumb(src, dst)
            thumb = f'<a href="{readme}"><img src="docs/thumbs/{dst.name}" width="100%" alt="{m["name"]}"></a><br>'
        ver = f' <sub>v{m["version"]}</sub>' if m['version'] else ''
        cells.append(f'<td width="33%" valign="top">{thumb}<b>{m["name"]}</b>{ver}<br>'
                     f'<sub>{m["blurb"]}</sub><br>'
                     f'<a href="../../releases/download/mods/{m["asset"]}">⬇ Download</a> · <a href="{readme}">Readme</a></td>')
    rows = ['<tr>' + ''.join(cells[i:i + COLUMNS]) + '</tr>' for i in range(0, len(cells), COLUMNS)]
    return '<table>\n' + '\n'.join(rows) + '\n</table>'


def update_readme(mods):
    text = README.read_text(encoding='utf-8')
    head, rest = text.split(START, 1)
    _, tail = rest.split(END, 1)
    body = f'\n{len(mods)} mods. Each one has its own readme with what to wear and how it was made.\n\n{build_gallery(mods)}\n'
    new = f'{head}{START}{body}{END}{tail}'
    if new != text:
        README.write_text(new, encoding='utf-8', newline='\n')
        print('README gallery updated')


def release_notes(mods):
    lines = ['Every finished mod as a Penumbra `.pmp`. In Penumbra: **Import Mod**, pick the file, enable it.',
             'Each mod\'s readme in the repo says which gear to wear.', '', '| Mod | Version | File |', '|---|---|---|']
    lines += [f'| {m["name"]} | {m["version"]} | `{m["asset"]}` |' for m in mods]
    return '\n'.join(lines) + '\n'


def sync_release(gh, tag, title, notes, files, latest):
    """files: {asset name: local path}. Uploads the ones GitHub doesn't have yet or that changed since."""
    if subprocess.run([gh, 'release', 'view', tag], cwd=ROOT, capture_output=True).returncode:
        run(gh, 'release', 'create', tag, '--title', title, '--notes', notes, f'--latest={str(latest).lower()}')
    else:
        run(gh, 'release', 'edit', tag, '--title', title, '--notes', notes)
    have = json.loads(run(gh, 'release', 'view', tag, '--json', 'assets', capture=True))['assets']
    have = {a['name']: a for a in have}
    todo = {}
    for name, path in files.items():
        a = have.get(name)
        stamp = dt.datetime.fromtimestamp(path.stat().st_mtime, dt.timezone.utc)
        if not a or a['size'] != path.stat().st_size or dt.datetime.fromisoformat(a['updatedAt'].replace('Z', '+00:00')) < stamp:
            todo[name] = path
    if not todo:
        print(f'{tag}: all {len(files)} files already up to date')
        return
    with tempfile.TemporaryDirectory() as tmp:
        staged = []
        for name, path in todo.items():
            dst = Path(tmp) / name
            shutil.copy2(path, dst)
            staged.append(str(dst))
        print(f'{tag}: uploading {len(staged)} of {len(files)} files')
        run(gh, 'release', 'upload', tag, *staged, '--clobber')


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument('--readme', action='store_true', help='only rebuild the README gallery')
    ap.add_argument('--no-push', action='store_true', help='commit locally, send nothing to GitHub')
    args = ap.parse_args()

    mods = find_mods()
    update_readme(mods)
    if args.readme:
        return

    run('git', 'add', '-A')
    leaks = staged_secrets()
    if leaks:
        run('git', 'reset', '-q')
        sys.exit('Not committed: these look like credentials, and the repo is public.\n'
                 + '\n'.join(f'  {f}: {kind}' for f, kind in leaks)
                 + '\nRemove the secret or add the file to .gitignore, then run again.')
    if run('git', 'diff', '--cached', '--quiet', check=False):
        run('git', 'commit', '-q', '-m', f'Backup {dt.datetime.now():%Y-%m-%d %H:%M}')
        print('committed')
    else:
        print('nothing new to commit')
    if args.no_push:
        return

    gh = gh_exe()
    run('git', 'push', '-q', 'origin', 'HEAD')
    print('pushed')
    sync_release(gh, 'mods', 'Mods (latest of each)', release_notes(mods), {m['asset']: m['path'] for m in mods}, True)
    apps = {slug(Path(a).stem) + '.exe': ROOT / a for a in APPS if (ROOT / a).exists()}
    sync_release(gh, 'apps', 'Apps (latest builds)',
                 'Windows builds of the apps in this repo. See each app\'s readme for what it needs.\n', apps, False)


if __name__ == '__main__':
    os.environ.setdefault('GH_PROMPT_DISABLED', '1')
    main()
