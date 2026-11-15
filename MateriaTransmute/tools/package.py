"""Build Materia Transmuter for sharing.

Makes MateriaTransmute/dist/MateriaTransmute.zip (the plugin plus HOW TO INSTALL.txt) and updates repo.json at the
repo root, the custom plugin repository Dalamud reads. tools/backup.py uploads the zip to the "apps" release, which is
where repo.json points, so a friend's Dalamud picks up the new version on its own.

    python MateriaTransmute/tools/package.py

Bump <Version> in MateriaTransmute.csproj first, or Dalamud won't offer the update to anyone who has it.
"""
import json
import subprocess
import sys
import zipfile
from pathlib import Path

PROJ = Path(__file__).resolve().parents[1]
ROOT = PROJ.parent
BIN = PROJ / 'MateriaTransmute' / 'bin' / 'Release'
ZIP = PROJ / 'dist' / 'MateriaTransmute.zip'
REPO_JSON = ROOT / 'repo.json'
GITHUB = 'https://github.com/MormonFTP-hub/FFXIV-mods'
DOWNLOAD = f'{GITHUB}/releases/download/apps/{ZIP.name}'


def main():
    r = subprocess.run(['dotnet', 'build', str(PROJ / 'MateriaTransmute.slnx'), '-c', 'Release', '--nologo', '-v', 'q'])
    if r.returncode:
        sys.exit('build failed')

    manifest = json.loads((BIN / 'MateriaTransmute.json').read_text(encoding='utf-8-sig'))
    dll = BIN / 'MateriaTransmute.dll'

    ZIP.parent.mkdir(exist_ok=True)
    with zipfile.ZipFile(ZIP, 'w', zipfile.ZIP_DEFLATED) as z:
        for name in ('MateriaTransmute.dll', 'MateriaTransmute.json', 'MateriaTransmute.deps.json'):
            z.write(BIN / name, name)
        z.write(PROJ / 'HOW TO INSTALL.txt', 'HOW TO INSTALL.txt')

    entry = {k: manifest[k] for k in ('Author', 'Name', 'InternalName', 'AssemblyVersion', 'Description',
                                      'ApplicableVersion', 'Tags', 'DalamudApiLevel', 'Punchline') if k in manifest}
    entry.update({
        'RepoUrl': f'{GITHUB}/tree/main/MateriaTransmute',
        'DownloadLinkInstall': DOWNLOAD,
        'DownloadLinkUpdate': DOWNLOAD,
        'DownloadLinkTesting': DOWNLOAD,
        'LastUpdate': int(dll.stat().st_mtime),
        'AcceptsFeedback': False,
    })

    plugins = json.loads(REPO_JSON.read_text(encoding='utf-8')) if REPO_JSON.exists() else []
    plugins = [p for p in plugins if p.get('InternalName') != entry['InternalName']] + [entry]
    plugins.sort(key=lambda p: p['Name'])
    REPO_JSON.write_text(json.dumps(plugins, indent=2, ensure_ascii=False) + '\n', encoding='utf-8')

    print(f'{ZIP.relative_to(ROOT)}  v{entry["AssemblyVersion"]}  ({ZIP.stat().st_size // 1024} KB)')
    print(f'{REPO_JSON.relative_to(ROOT)}  {len(plugins)} plugin(s), downloads from {DOWNLOAD}')


if __name__ == '__main__':
    main()
