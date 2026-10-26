"""Check a built .pmp: every referenced file is packed, every model material and material texture resolves."""
import json
import os
import sqlite3
import sys
import zipfile

sys.path.insert(0, 'E:/FFXIV-mods/LadyLoki/tools')
import mtrl
import tt

BS = chr(92)


def verify(pmp, tmp, forbidden=()):
    z = zipfile.ZipFile(pmp)
    names = set(z.namelist())
    game = {}
    for g in sorted(n for n in names if n.endswith('.json') and n != 'meta.json'):
        j = json.loads(z.read(g))
        for o in j.get('Options', [j]):
            for k, v in o['Files'].items():
                assert v.replace(BS, '/') in names, v
                game.setdefault(k, set()).add(v.replace(BS, '/'))
            for m in o['Manipulations']:
                print(f"{g:26s} {o.get('Name') or 'default':34s} {m['Type']:5s} {json.dumps(m['Manipulation'])}")
    print('game paths:', len(game))
    leaks = [p for p in list(names) + list(game) if any(f in p for f in forbidden)]
    print('paths from the other pack:', leaks)
    problems = []
    os.makedirs(tmp, exist_ok=True)
    for gp, lps in game.items():
        for lp in lps:
            if gp.endswith('.mtrl'):
                for t, _ in mtrl.Mtrl.parse(z.read(lp)).textures:
                    if t not in game:
                        problems.append(('missing texture', gp, t))
            if gp.endswith('.mdl'):
                f = tmp + lp.replace('/', '_')
                open(f, 'wb').write(z.read(lp))
                tt.unwrap(os.path.normpath(f), os.path.normpath(f + '.db'), gp)
                mats = [r[0] for r in sqlite3.connect(f + '.db').execute('select name from materials')]
                folder = gp.split('/model/')[0] + '/material/'
                for mname in mats:
                    if 'b0001' in mname:
                        continue        # skin: resolved to the character's own body material
                    found = [v for v in ('v0001', 'v0002', 'v0003') if f'{folder}{v}/{mname}.mtrl' in game]
                    print(f'  {lp[-48:]:48s} {mname:26s} -> {found or "MISSING"}')
                    if not found:
                        problems.append(('missing material', gp, mname))
    tt.drop_game_link()
    print('problems:', problems)
    return problems


if __name__ == '__main__':
    verify(sys.argv[1], sys.argv[2], tuple(sys.argv[3:]))
