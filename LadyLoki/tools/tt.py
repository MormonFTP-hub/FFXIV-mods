"""Thin wrapper around the private TexTools ConsoleTools copy."""
import os
import subprocess

TT = r'E:\FFXIV-mods\LadyLoki\tools\tt\ConsoleTools.exe'
GAME = r'E:\FFXIV-mods\LadyLoki\work\game'


SQPACK_LINK = r'E:\FFXIV-mods\LadyLoki\tools\ttgame\game\sqpack'
SQPACK_REAL = r'C:\Program Files (x86)\SquareEnix\FINAL FANTASY XIV - A Realm Reborn\game\sqpack'


def ensure_game_link():
    """ConsoleTools wants a writable game folder for its cache; give it one whose sqpack is a junction to the real data.
    The junction is removed again by drop_game_link() so it never lingers inside the mods folder."""
    if not os.path.exists(SQPACK_LINK):
        os.makedirs(os.path.dirname(SQPACK_LINK), exist_ok=True)
        subprocess.run(['cmd', '/c', 'mklink', '/J', SQPACK_LINK, SQPACK_REAL], check=True, capture_output=True)


def drop_game_link():
    if os.path.isdir(SQPACK_LINK):
        os.rmdir(SQPACK_LINK)   # removes the junction itself, never the target


def _run(args):
    ensure_game_link()
    r = subprocess.run([TT] + args, cwd=os.path.dirname(TT), capture_output=True, text=True, errors='replace')
    out = r.stdout + r.stderr
    if 'Exception' in out:
        raise RuntimeError(out[:3000])
    return out


def extract(ffpath, dest=None):
    dest = dest or os.path.join(GAME, ffpath.replace('/', '_'))
    if not os.path.exists(dest):
        _run(['/extract', ffpath, dest])
    return dest


def unwrap(src, dest, ffpath):
    return _run(['/unwrap', src, dest, ffpath])


def unwrap_game(ffpath, ext='.db'):
    raw = extract(ffpath)
    dest = os.path.splitext(raw)[0] + ext
    if not os.path.exists(dest):
        unwrap(raw, dest, ffpath)
    return dest


def wrap(src, dest, ffpath, *flags):
    return _run(['/wrap', src, dest, ffpath] + list(flags))
