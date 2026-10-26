"""Write Penumbra mod metadata (FileVersion 3) into a mod folder and zip it into a .pmp.

usage: python package.py <project_dir> [fullbody|outfit_c1701]

  fullbody      mod/        -> DonQuixote.pmp                   (Hyur Midlander female, full body)
  outfit_c1701  mod_c1701/  -> DonQuixote_Outfit_VieraMale.pmp   (Viera male, clothes only)
"""
import json
import os
import sys
import zipfile

ROOT = sys.argv[1]
PROFILE = sys.argv[2] if len(sys.argv) > 2 else 'fullbody'
SET = 'e0359'  # Taoist's set: Cap, Shirt, Gloves, Slops, Shoes
SET_ID = int(SET[1:])
CREDIT = (
    'Model: "Don Quixote V2 - Limbus Company" by Glayer3d, CC BY 4.0: '
    'https://sketchfab.com/3d-models/don-quixote-v2-limbus-company-e9e6918c3c2c446aa08b433115c46524'
)
WEBSITE = 'https://sketchfab.com/3d-models/don-quixote-v2-limbus-company-e9e6918c3c2c446aa08b433115c46524'

HEAD_ENABLED, HEAD_HIDE_SCALP, HEAD_HIDE_HAIR = 0x1, 0x2, 0x4
# Head flags live in bits 40+ of the EQP entry. Clearing every "show" bit also hides ears, earrings and necklace.
HEAD_EQP = (HEAD_ENABLED | HEAD_HIDE_SCALP | HEAD_HIDE_HAIR) << 40
# EQDP: two bits per slot (material, model), slots in order head, body, hands, legs, feet.
EQDP_BODY_MATERIAL, EQDP_BODY_MODEL = 0x4, 0x8
EQDP_LEGS_MODEL = 0x80
EQDP_FEET_MODEL = 0x200


def rel_files(mod, subdir=''):
    """Map every file under <mod>/<subdir>/chara to {game path: path relative to the mod folder}."""
    base = os.path.join(mod, subdir) if subdir else mod
    out = {}
    for dirpath, _, files in os.walk(os.path.join(base, 'chara')):
        for f in files:
            full = os.path.join(dirpath, f)
            game = os.path.relpath(full, base).replace('\\', '/')
            out[game] = os.path.relpath(full, mod).replace('/', '\\')
    return dict(sorted(out.items()))


def eqdp(race, gender, slot, entry):
    return {'Type': 'Eqdp', 'Manipulation': {'Entry': entry, 'Gender': gender, 'Race': race, 'SetId': SET_ID, 'Slot': slot}}


def fullbody(mod):
    files = rel_files(mod)
    assert len(files) == 18, files
    meta = {
        'Name': 'Don Quixote (Limbus Company) - Full Body',
        'Description': (
            'Full body replacement of Don Quixote from Limbus Company for Hyur Midlander female.\n\n'
            "Wear the whole Taoist's set (Cap, Shirt, Gloves, Slops, Shoes) - Glamourer works. The Shirt carries the "
            'whole model; the other four pieces are blanked, and the Cap hides your hair.\n\n'
            'If your own face still shows through hers, enable "Hide your own face" (best in a collection assigned '
            'only to your character, since it blanks Midlander female faces 1-5).\n\n' + CREDIT
        ),
        'ModTags': ['Limbus Company', 'Don Quixote', 'Body Replacement'],
        'Version': '1.3.0',
    }
    manipulations = [{'Type': 'Eqp', 'Manipulation': {'Entry': HEAD_EQP, 'SetId': SET_ID, 'Slot': 'Head'}}]
    hide_face = {
        'Version': 0,
        'Name': 'Hide your own face',
        'Description': 'Blanks Midlander female faces 1-5 for everyone in this collection. Only needed if your face shows through.',
        'Priority': 0,
        'Type': 'Multi',
        'DefaultSettings': 0,
        'Options': [{
            'Name': 'Blank Midlander female faces',
            'Description': 'Use in a collection assigned only to your own character.',
            'Priority': 0,
            'Files': rel_files(mod, 'options/hide_face'),
            'FileSwaps': {},
            'Manipulations': [],
        }],
    }
    assert len(hide_face['Options'][0]['Files']) == 5
    return 'DonQuixote.pmp', meta, files, manipulations, {'group_001_hide your own face.json': hide_face}


def outfit_c1701(mod):
    files = rel_files(mod)
    assert len(files) == 8, files
    assert all('c1701' in g for g in files), files
    meta = {
        'Name': 'Don Quixote (Limbus Company) - Outfit (Viera Male)',
        'Description': (
            "Don Quixote's coat, shirt, tie, trousers and boots refitted for Viera male. Your own head, ears, hair "
            'and hands stay.\n\n'
            "Wear the Taoist's Shirt, Slops and Shoes (Glamourer works). The Shirt carries the whole outfit; the "
            'Slops and Shoes are blanked so nothing pokes through. Hands and head slots are free - wear gloves or '
            "not, any hat you like (not the Taoist's Cap if the Full Body mod is also on: it hides hair).\n\n"
            'Only affects Viera males; other races wearing the Taoist\'s set look normal.\n\n' + CREDIT
        ),
        'ModTags': ['Limbus Company', 'Don Quixote', 'Outfit', 'Viera'],
        'Version': '1.2.0',
    }
    # Viera males normally borrow Midlander male (c0101) models; these entries make the game load c1701 paths.
    manipulations = [
        eqdp('Viera', 'Male', 'Body', EQDP_BODY_MODEL | EQDP_BODY_MATERIAL),
        eqdp('Viera', 'Male', 'Legs', EQDP_LEGS_MODEL),
        eqdp('Viera', 'Male', 'Feet', EQDP_FEET_MODEL),
    ]
    return 'DonQuixote_Outfit_VieraMale.pmp', meta, files, manipulations, {}


PROFILES = {'fullbody': ('mod', fullbody), 'outfit_c1701': ('mod_c1701', outfit_c1701)}
folder, build = PROFILES[PROFILE]
MOD = os.path.join(ROOT, folder)
pmp_name, meta, files, manipulations, groups = build(MOD)
meta = {'FileVersion': 3, 'Name': meta['Name'], 'Author': 'Glayer3d (model), converted for FFXIV',
        'Description': meta['Description'], 'Version': meta['Version'], 'Website': WEBSITE, 'ModTags': meta['ModTags']}
default_mod = {'Version': 0, 'Files': files, 'FileSwaps': {}, 'Manipulations': manipulations}
for game in files:
    assert game.startswith(f'chara/equipment/{SET}/'), game

for name, data in [('meta.json', meta), ('default_mod.json', default_mod), *groups.items()]:
    with open(os.path.join(MOD, name), 'w', encoding='utf-8') as f:
        json.dump(data, f, indent=2)

pmp = os.path.join(ROOT, pmp_name)
with zipfile.ZipFile(pmp, 'w', zipfile.ZIP_DEFLATED) as z:
    for dirpath, _, names in os.walk(MOD):
        for f in sorted(names):
            full = os.path.join(dirpath, f)
            z.write(full, os.path.relpath(full, MOD).replace('\\', '/'))
print('wrote', pmp, os.path.getsize(pmp), 'bytes')
for game, rel in files.items():
    print('  ', game, '<-', rel)
for m in manipulations:
    print('  ', m)
