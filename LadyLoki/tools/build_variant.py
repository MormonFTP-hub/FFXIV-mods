"""Second pack: the same fitted Lady Loki outfit + scepter on different items (Isle Vacationer's set + Ebony Staff),
so it can be enabled alongside the Lady Loki pack. Reuses the fitted meshes and built textures."""
import os
import pickle
import shutil
import sys

sys.path.insert(0, 'E:/FFXIV-mods/LadyLoki/tools')
import build_models as bm
import make_materials as mm
import make_pmp
import tt

SET = 6159
WEAPON = ('w1001', 'b0012')
WEAPON_VARIANTS = (1, 2, 3)          # Ebony Staff = v1; v2/v3 cover the other items sharing the model (Grandeur)
OUT = 'E:/FFXIV-mods/LadyLoki/out_midlander/'
FILES = OUT + 'files/'
LOKI_FILES = 'E:/FFXIV-mods/LadyLoki/out/files/'

E = f'e{SET:04d}'
EQ_TEX = f'chara/equipment/{E}/texture/'
EQ_MAT = f'chara/equipment/{E}/material/v0001/'
W_DIR = f'chara/weapon/{WEAPON[0]}/obj/body/{WEAPON[1]}/'
W_NAME = WEAPON[0] + WEAPON[1]

# Loki-pack material key -> material file name in this pack
MAT_NAMES = {'suit': f'mt_c0201{E}_top_a.mtrl', 'trim': f'mt_c0201{E}_top_b.mtrl', 'skirt': f'mt_c0201{E}_dwn_a.mtrl',
             'hair': f'mt_c0201{E}_met_a.mtrl', 'weapon': f'mt_{W_NAME}_a.mtrl'}
assert set(MAT_NAMES) == set(mm.MATERIALS), set(MAT_NAMES) ^ set(mm.MATERIALS)
UNDIES = f'mt_c0201{E}_dwn_bot.mtrl'

CFG = {
    'set': SET,
    'out': OUT,
    'pmp': "Seaside Siren - Isle Vacationer's + Ebony Staff.pmp",
    'weapon_dir': W_DIR,
    'head_fallback_races': ('Elezen', 'Miqote', 'AuRa', 'Viera'),
    'name': "Seaside Siren (Lady Loki outfit) - Isle Vacationer's",
    'description': (
        "Lady Loki's Seaside Siren outfit from Marvel Rivals on Bibo+, as a separate pack from the Lady Loki mod "
        "so both can be enabled at once. Built on the c0201 (Midlander female) body; other feminine c0201 races "
        "get it via racial deformation.\n\n"
        "Replaces the Isle Vacationer's set (Visor / Shirt / Wrist Torques / Shorts / Sandals), and Loki's scepter "
        "replaces the Ebony Staff (and Grandeur, which shares the model).\n\n" + make_pmp.CREDITS),
    'head_desc': "Isle Vacationer's Visor slot.",
    'staff_option': ('Replace Ebony Staff / Grandeur', f'Two-handed staff, model {WEAPON[0]} {WEAPON[1]}.'),
    'tags': ['Bibo+', 'Outfit', 'Weapon', 'Black Mage', 'Marvel Rivals'],
}


def tex_paths(key):
    base = W_DIR + f'texture/v01_{W_NAME}_loki' if key == 'weapon' else EQ_TEX + f'v01_c0201{E}_loki_{key}'
    return {k: f'{base}_{k}.tex' for k in ('base', 'norm', 'mask')}


def copy_textures():
    """Same pixels as the Lady Loki pack, under this pack's own paths (so it works with that pack disabled)."""
    from make_textures import tex_paths as loki_paths
    for key in mm.MATERIALS:
        src, dst = loki_paths(key), tex_paths(key)
        for k in src:
            os.makedirs(os.path.dirname(FILES + dst[k]), exist_ok=True)
            shutil.copyfile(LOKI_FILES + src[k], FILES + dst[k])
    for loki_dir, new_dir in (('chara/equipment/e6137/texture/', EQ_TEX), ('chara/weapon/w1001/obj/body/b0071/texture/', W_DIR + 'texture/')):
        os.makedirs(FILES + new_dir, exist_ok=True)
        shutil.copyfile(LOKI_FILES + loki_dir + 'v01_loki_id.tex', FILES + new_dir + 'v01_loki_id.tex')


def build_materials():
    for key in mm.MATERIALS:
        if key == 'weapon':
            files = [W_DIR + f'material/v{v:04d}/' + MAT_NAMES[key] for v in WEAPON_VARIANTS]
            id_tex = W_DIR + 'texture/v01_loki_id.tex'
        else:
            files = [EQ_MAT + MAT_NAMES[key]]
            id_tex = EQ_TEX + 'v01_loki_id.tex'
        mm.build(key, files=files, tex=tex_paths(key), id_tex=id_tex, out=FILES)
    shutil.copyfile(bm.UNDIES_SRC, FILES + EQ_MAT + UNDIES)


def renamed(meshes):
    """Point the material names baked into the meshes at this pack's material files."""
    old_to_new = {mm.model_name(k): '/' + v for k, v in MAT_NAMES.items()}
    old_to_new['/' + bm.UNDIES_NAME] = '/' + UNDIES
    for m in meshes:
        m.material = old_to_new.get(m.material, m.material)
    return meshes


def build_models():
    bm.OUT = FILES                      # wrap() writes under the module's OUT
    bm.DBDIR = 'E:/FFXIV-mods/LadyLoki/work/db_midlander/'
    fitd = pickle.load(open(bm.WORK + 'outfit_fit.pkl', 'rb'))
    eq = f'chara/equipment/{E}/model/c0201{E}_{{}}.mdl'
    for slot in ('top', 'dwn', 'glv', 'sho'):
        bm.wrap(renamed(bm.slot_meshes(fitd, slot)), slot, eq.format(slot))
    bm.wrap(renamed(bm.slot_meshes(fitd, 'met', with_hair=False)), 'met_headpiece', eq.format('met'))
    bm.wrap(renamed(bm.slot_meshes(fitd, 'met', with_hair=True)), 'met_hair', eq.format('met'))
    bm.wrap(renamed(bm.weapon_meshes()), 'weapon', W_DIR + f'model/{W_NAME}.mdl')


def main():
    if os.path.exists(OUT):
        shutil.rmtree(OUT)
    copy_textures()
    build_materials()
    build_models()
    tt.drop_game_link()
    make_pmp.main(CFG)


if __name__ == '__main__':
    main()
