"""Package a built file tree into a Penumbra .pmp."""
import json
import os
import zipfile

# EQP values taken from The Emperor's New set, so the Bibo+ body parts show exactly as they do there.
EQP_BODY = 0x3F01
EQP_HANDS = 0x73 << 24
EQP_HEAD_HIDE_HAIR = 0x033FE5 << 40   # tiara/bandana head flags + "hide hair"

CREDITS = ("Requires Bibo+ (skin materials + underwear materials core files).\n"
           "Model and textures: Marvel Rivals (NetEase Games), ripped via The Models Resource.")

LOKI = {
    'set': 6137,
    'out': 'E:/FFXIV-mods/LadyLoki/out/',
    'pmp': 'Lady Loki - Seaside Siren (Marvel Rivals).pmp',
    'weapon_dir': 'chara/weapon/w1001/obj/body/b0071/',
    'head_fallback_races': ('AuRa', 'Elezen'),
    'name': 'Lady Loki - Seaside Siren (Marvel Rivals)',
    'description': (
        "Lady Loki's Seaside Siren outfit from Marvel Rivals, fitted to Bibo+ (feminine c0201 races, "
        "incl. Au Ra/Miqo'te/Elezen/Viera via racial deformation).\n\n"
        "Replaces the Summer Sunset set (Bandana / Beach Cover-up / Wrist Torques / Bottoms / Sandals), "
        "and Loki's scepter replaces the Omega Rod and Ultimate Omega Rod (BLM/THM staff).\n\n" + CREDITS),
    'head_desc': 'Summer Sunset Bandana slot.',
    'staff_option': ('Replace Omega Rod / Ultimate Omega Rod', 'Two-handed staff, model w1001 b0071.'),
    'tags': ['Bibo+', 'Outfit', 'Weapon', 'Black Mage', 'Marvel Rivals'],
}


def eqp(entry, set_id, slot):
    return {'Type': 'Eqp', 'Manipulation': {'Entry': entry, 'SetId': set_id, 'Slot': slot}}


def eqdp_no_own_model(race, set_id, slot):
    """Make a race fall back to the c0201 model for this slot (it has its own vanilla model otherwise)."""
    return {'Type': 'Eqdp', 'Manipulation': {'Entry': 0, 'Gender': 'Female', 'Race': race, 'SetId': set_id, 'Slot': slot}}


def local(path):
    return path.replace('/', '\\')


def collect(files_root, prefix_dir, game_root=''):
    """{game path: local path} for every file under files_root/prefix_dir."""
    out = {}
    base = files_root + prefix_dir
    for root, _, files in os.walk(base):
        for f in files:
            full = os.path.join(root, f).replace('\\', '/')
            out[game_root + full[len(base):]] = local(full[len(files_root):])
    return out


def option(name, desc, files=None, manips=None):
    return {'Name': name, 'Description': desc, 'Priority': 0, 'Files': files or {}, 'FileSwaps': {},
            'Manipulations': manips or []}


def group(name, desc, options, default=0, kind='Single'):
    return {'Version': 0, 'Name': name, 'Description': desc, 'Image': '', 'Page': 0, 'Priority': 0, 'Type': kind,
            'DefaultSettings': default, 'Options': options}


def main(cfg=LOKI):
    files_root = cfg['out'] + 'files/'
    set_id = cfg['set']
    pmp = cfg['out'] + cfg['pmp']
    all_chara = collect(files_root, 'chara/', 'chara/')
    weapon = {k: v for k, v in all_chara.items() if k.startswith(cfg['weapon_dir'])}
    default = {k: v for k, v in all_chara.items() if k not in weapon}
    met = f'chara/equipment/e{set_id:04d}/model/c0201e{set_id:04d}_met.mdl'
    head_fallback = [eqdp_no_own_model(r, set_id, 'Head') for r in cfg['head_fallback_races']]

    meta = {'FileVersion': 3, 'Name': cfg['name'], 'Author': 'arcadia62091 (ported with Claude)',
            'Description': cfg['description'], 'Version': '1.1.1', 'Website': '', 'ModTags': cfg['tags']}
    default_mod = {'Name': '', 'Description': '', 'Priority': 0, 'Files': default, 'FileSwaps': {},
                   'Manipulations': [eqp(EQP_BODY, set_id, 'Body'), eqp(EQP_HANDS, set_id, 'Hands')]}
    head = group('Headpiece', cfg['head_desc'], [
        option('Horned tiara, mask and earrings', 'Keeps your own hairstyle.',
               {met: local('models/met_headpiece/' + met)}, head_fallback),
        option("Tiara + Loki's silver hair", "Hides your hair and uses Loki's bun hairstyle.",
               {met: local('models/met_hair/' + met)}, head_fallback + [eqp(EQP_HEAD_HIDE_HAIR, set_id, 'Head')]),
        option('Off (vanilla headpiece)', ''),
    ])
    staff = group('Staff', "Loki's scepter as a BLM/THM two-handed staff.", [
        option(cfg['staff_option'][0], cfg['staff_option'][1], weapon),
        option('Off', ''),
    ])
    os.makedirs(os.path.dirname(pmp), exist_ok=True)
    with zipfile.ZipFile(pmp, 'w', zipfile.ZIP_DEFLATED) as z:
        z.writestr('meta.json', json.dumps(meta, indent=2))
        z.writestr('default_mod.json', json.dumps(default_mod, indent=2))
        z.writestr('group_001_headpiece.json', json.dumps(head, indent=2))
        z.writestr('group_002_staff.json', json.dumps(staff, indent=2))
        written = set()
        for files in [default, weapon] + [o['Files'] for o in head['Options']]:
            for lp in files.values():
                if lp not in written:
                    z.write(files_root + lp.replace('\\', '/'), lp)
                    written.add(lp)
    print('default files', len(default), 'weapon files', len(weapon), 'packed', len(written))
    print(pmp, os.path.getsize(pmp) // 1024, 'KB')
    return pmp


if __name__ == '__main__':
    main()
