"""Build a Dalamud plugin from this repo for sharing.

    python tools/package_plugin.py MateriaTransmute
    python tools/package_plugin.py DroneRunner

For <Name> (folder <Name>/, project <Name>/<Name>/<Name>.csproj) it builds Release, writes <Name>/dist/<Name>.zip (the
plugin plus <Name>/HOW TO INSTALL.txt) and adds or updates its entry in repo.json at the repo root, the custom plugin
repository friends add in Dalamud. tools/backup.py uploads the zip to the "apps" release, which is where repo.json
points, so Dalamud offers the new version to everyone who has it.

Bump <Version> in the .csproj first, or Dalamud won't offer the update.
"""
import json
import subprocess
import sys
import zipfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
REPO_JSON = ROOT / 'repo.json'
GITHUB = 'https://github.com/MormonFTP-hub/FFXIV-mods'


def package(name):
    proj = ROOT / name
    bin_dir = proj / name / 'bin' / 'Release'
    zip_path = proj / 'dist' / f'{name}.zip'
    download = f'{GITHUB}/releases/download/apps/{zip_path.name}'

    r = subprocess.run(['dotnet', 'build', str(proj / f'{name}.slnx'), '-c', 'Release', '--nologo', '-v', 'q'])
    if r.returncode:
        sys.exit(f'{name}: build failed')

    manifest = json.loads((bin_dir / f'{name}.json').read_text(encoding='utf-8-sig'))
    dll = bin_dir / f'{name}.dll'

    zip_path.parent.mkdir(exist_ok=True)
    with zipfile.ZipFile(zip_path, 'w', zipfile.ZIP_DEFLATED) as z:
        for f in (f'{name}.dll', f'{name}.json', f'{name}.deps.json'):
            z.write(bin_dir / f, f)
        z.write(proj / 'HOW TO INSTALL.txt', 'HOW TO INSTALL.txt')

    entry = {k: manifest[k] for k in ('Author', 'Name', 'InternalName', 'AssemblyVersion', 'Description',
                                      'ApplicableVersion', 'Tags', 'DalamudApiLevel', 'Punchline') if k in manifest}
    entry.update({
        'RepoUrl': f'{GITHUB}/tree/main/{name}',
        'DownloadLinkInstall': download,
        'DownloadLinkUpdate': download,
        'DownloadLinkTesting': download,
        'LastUpdate': int(dll.stat().st_mtime),
        'AcceptsFeedback': False,
    })

    plugins = json.loads(REPO_JSON.read_text(encoding='utf-8')) if REPO_JSON.exists() else []
    plugins = [p for p in plugins if p.get('InternalName') != entry['InternalName']] + [entry]
    plugins.sort(key=lambda p: p['Name'])
    REPO_JSON.write_text(json.dumps(plugins, indent=2, ensure_ascii=False) + '\n', encoding='utf-8')

    print(f'{zip_path.relative_to(ROOT)}  v{entry["AssemblyVersion"]}  ({zip_path.stat().st_size // 1024} KB)')
    print(f'repo.json  {len(plugins)} plugin(s): {", ".join(p["Name"] for p in plugins)}')


if __name__ == '__main__':
    if len(sys.argv) < 2:
        sys.exit(__doc__)
    for n in sys.argv[1:]:
        package(n)
