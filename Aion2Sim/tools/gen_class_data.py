"""Write js/classes/data_<class>.js from a class's skill JSON (MetaBot's numbers, collected per skill page).

    python tools/gen_class_data.py <folder with gladiator.json, templar.json, ...> [class ...]

Each skill becomes {name, kind, unlock, cd, range, mp, mpGain, moving, stagger, dmg: {lv: base}, atk, desc, specs}.
Specializations whose wording matches a known pattern get a `mod` the engine understands (Multi-Hit, cooldown,
range, consecutive uses, guaranteed critical, ...); the rest stay text, and the class file can add hooks.
"""
import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent

ICONS = [
    (r'heal|recovery|restoration|salvation|light of|radiant', 'heal'), (r'fire|flame|blaze|hell|burn|inferno|ember', 'flame'),
    (r'frost|ice|cold|freez|glacial|winter', 'ice'), (r'wind|gale|storm|cyclone|tempest', 'wind'), (r'thunder|lightning|bolt|shock', 'bolt'),
    (r'earth|stone|rock|quake', 'rock'), (r'spirit|summon|elemental', 'spirit'), (r'arrow|shot|shoot|fire\b|volley|dart', 'arrow'),
    (r'shield|aegis|bulwark|ward|protect|barrier|block', 'shield'), (r'chain|bind|snare|restrain|root|seal', 'chain'),
    (r'mantra|hymn|song|chant|word|prayer', 'note'), (r'blessing|benediction|stance|empower|boost|fury|rage|wrath|zeal', 'up'),
    (r'poison|venom|bleed|blood|lifesteal', 'poison'), (r'burst|explo|blast|detonat|nova|meteor|annihil', 'burst'),
    (r'wave|whirl|spin|sweep|cyclone', 'whirl'), (r'rush|leap|lunge|charge|dash|assault|pounce', 'dash'),
    (r'judg|punish|smite|hammer|slam|crush|break|shatter', 'hammer'), (r'eye|mark|focus|aim|weak', 'target'),
    (r'orb|sphere|magic|arcane|mana', 'orb'), (r'blade|sword|slash|strike|cut|cleave|slice|edge', 'sword'),
]


def icon_for(name):
    n = name.lower()
    for pat, g in ICONS:
        if re.search(pat, n):
            return g
    return 'star'


def camel(name):
    words = re.sub(r"[^A-Za-z0-9 ]", "", name).split()
    return words[0].lower() + "".join(w.capitalize() for w in words[1:])


def spec_mod(text, skill_ids):
    t = text
    mod = {}
    m = re.search(r'\+?(\d+)% Multi-Hit', t, re.I)
    if m:
        mod['multi'] = int(m.group(1))
    elif re.search(r'Multi-Hit on hit|lands as Multi-Hit', t, re.I):
        mod['multi'] = 100 if re.search(r'lands as Multi-Hit', t, re.I) else 50
    if re.search(r'lands as a Critical Hit|^Critical Hit on hit|Critical Hit on hit$', t, re.I):
        mod['crit'] = True
    m = re.search(r'\+(\d+)% (?:Skill )?Critical Hit', t, re.I)
    if m and 'Damage' not in t:
        mod['critPct'] = int(m.group(1))
    m = re.match(r'-(\d+(?:\.\d+)?)s (?:\[[^\]]+\] )?cooldown$', t, re.I) or re.match(r'Reduces (?:the )?cooldown by (\d+)s', t, re.I)
    if m and 'on hit' not in t:
        mod['cd'] = -float(m.group(1))
    m = re.match(r'-(\d+)\s*min(?:ute)? cooldown', t, re.I)
    if m:
        mod['cd'] = -60 * int(m.group(1))
    m = re.match(r'-(\d+)% (?:\[[^\]]+\] )?cooldown$', t, re.I)
    if m:
        mod['cdPct'] = -int(m.group(1))
    if re.match(r'Remove cooldown', t, re.I):
        mod['cdPct'] = -100
    m = re.search(r'\+(\d+)% MP restored', t, re.I)
    if m:
        mod['mpGainPct'] = int(m.group(1))
    m = re.search(r'-(\d+)% MP (?:consumed|cost)', t, re.I)
    if m and 'duration' not in t:
        mod['mpPct'] = -int(m.group(1))
    m = re.search(r'\+(\d+)% Skill Speed', t, re.I)
    if m and 'duration' not in t:
        mod['skillSpeed'] = int(m.group(1))
    m = re.search(r'\+(\d+(?:\.\d+)?)m (?:\[[^\]]+\] )?range', t, re.I)
    if m:
        mod['range'] = float(m.group(1))
    m = re.search(r'\+(\d+) (?:additional )?consecutive use', t, re.I)
    if m:
        mod['uses'] = int(m.group(1))
    if re.search(r'Changes? (?:it )?to (?:a )?mobile skill|Usable while moving|Changes to mobile', t, re.I):
        mod['mobile'] = True
    m = re.search(r'up to (?:\+)?(\d+)% (?:more )?damage when (?:less|fewer) targets', t, re.I)
    if m:
        mod['dmgPct'] = int(m.group(1))
    m = re.search(r'\+(\d+) Stagger', t, re.I)
    if m:
        mod['stagger'] = int(m.group(1))
    m = re.search(r'\+(\d+)% damage to targets with Incapacitated Immunity', t, re.I)
    if m:
        mod['immuneDmg'] = int(m.group(1))
    m = re.search(r'Restores (\d+) MP(?: on hit| on landing)?$', t, re.I)
    if m and 'Critical' not in t:
        mod['mpOnHit'] = int(m.group(1))
    m = re.search(r'Restores (\d+) MP on landing a Critical Hit', t, re.I)
    if m:
        mod['mpOnCrit'] = int(m.group(1))
    if re.search(r'Resets? (?:its |the |\[[^\]]+\] )?cooldown (?:on|when it) land(?:ing|s) a Critical Hit', t, re.I):
        mod['resetOnCrit'] = True
    m = re.search(r'(?:Deals damage|Activates|Adds) (\d+) (?:additional (?:time|strike)s?|times|additional strikes)', t, re.I)
    if m:
        mod['hitsPlus'] = int(m.group(1)) if 'Activates' not in t else int(m.group(1)) - 1
    m = re.match(r'-(\d+(?:\.\d+)?)s \[([^\]]+)\] cooldown on hit', t, re.I)
    if m:
        mod['cutOnHit'] = {'id': camel(m.group(2)), 's': float(m.group(1))}
    m = re.search(r'-(\d+(?:\.\d+)?)s all skill cooldowns on hit|Reduces all skill cooldowns by (\d+(?:\.\d+)?) ?s', t, re.I)
    if m and 'Critical' not in t:
        mod['cutAllOnHit'] = float(m.group(1) or m.group(2))
    if mod.get('cutOnHit') and mod['cutOnHit']['id'] not in skill_ids:
        del mod['cutOnHit']
    return mod or None


STAT_WORDS = [
    (r"^(?:the caster's )?Attack by ([\d.]+)%", 'atkPct'), (r'^Combat Speed by ([\d.]+)%', 'combatSpeed'),
    (r'^Casting Speed by ([\d.]+)%', 'castSpeed'), (r'^PvE Damage Boost by ([\d.]+)%', 'pveBoost'),
    (r'^(?:Weapon )?Damage Boost by ([\d.]+)%', 'dmgBoost'), (r'^Critical Damage Boost by ([\d.]+)%', 'critDmg'),
    (r'^Critical Hit by ([\d,]+)', 'critHit'), (r'^Multi-Hit Chance by ([\d.]+)%', 'multiHit'),
    (r'^Double Chance by ([\d.]+)%', 'multiHit'), (r'^Back Attack Damage Boost by ([\d.]+)%', 'backBoost'),
]


def parse_stats(phrase):
    """'Attack by 20% and Accuracy by 100' -> {'atkPct': 20}."""
    out = {}
    for part in re.split(r',\s*(?:and\s+)?|\s+and\s+', phrase):
        part = part.strip().rstrip('.')
        part = re.sub(r"^(?:increases )?(?:the caster's |caster's )", '', part, flags=re.I)
        for pat, key in STAT_WORDS:
            m = re.match(pat, part, re.I)
            if m:
                out[key] = out.get(key, 0) + float(m.group(1).replace(',', ''))
                break
    return out


def parse_buff(text):
    """A self-buff skill ("Increases the caster's Attack by 20% for 10s") or a skill that grants a named effect."""
    m = re.search(r"Increases the caster's (.+?) for ([\d.]+)s", text)
    if m:
        st = parse_stats(m.group(1))
        if st:
            return {'name': None, 'dur': float(m.group(2)), 'stat': st}
    m = re.search(r"[Gg]rants (?:the )?([A-Z][\w' ]+?) (?:effect )?(?:to the caster )?for ([\d.]+)s\.?\s*\1: Increases (.+?)(?:\.|$| Max \d| \d+ Stagger)", text)
    if m:
        st = parse_stats(m.group(3))
        if st:
            return {'name': m.group(1), 'dur': float(m.group(2)), 'stat': st}
    return None


def nums(text):
    return [float(x.replace(',', '')) for x in re.findall(r'(?<![\w.])(\d[\d,]*(?:\.\d+)?)', text or '')]


def clean_desc(s):
    s = re.sub(r'\s*\d+ Stagger Gauge Damage\s*$', '', s or '').strip()
    return s[:320]


def convert(d, hue):
    out = {}
    ids = {camel(a['name']) for a in d['actives'] + d['stigmas']}
    for kind, key in (('active', 'actives'), ('stigma', 'stigmas')):
        for a in d[key]:
            sid = camel(a['name'])
            bl = a.get('baseByLevel') or ({'1': a['base']} if a.get('base') else None)
            sk = {'name': a['name'], 'kind': kind, 'unlock': a.get('unlock') or 22, 'cd': a.get('cd') or 0,
                  'range': a.get('range') or (40 if not a.get('base') else 4), 'mp': a.get('mp') or 0,
                  'mpGain': a.get('mpGain') or 0, 'moving': bool(a.get('usableWhileMoving')),
                  'stagger': a.get('stagger') or 0, 'icon': icon_for(a['name']), 'hue': hue,
                  'desc': clean_desc(a.get('effects'))}
            if bl:
                sk['dmg'] = {int(k): v for k, v in bl.items()}
                sk['atk'] = a.get('atkPct') or 0
            else:
                sk['noHit'] = True
            if a.get('effectsAtMaxLevel'):
                sk['descMax'] = clean_desc(a['effectsAtMaxLevel'])
            maxlv = a.get('maxLevelShown') or 40
            sk['maxLv'] = maxlv
            bf = parse_buff(a.get('effects') or '')
            if bf:
                bm = parse_buff(a.get('effectsAtMaxLevel') or '') or bf
                bf['dur'] = {1: bf['dur'], maxlv: bm['dur']} if bm['dur'] != bf['dur'] else bf['dur']
                sk['buff'] = bf
            if a.get('dot') and a['dot'].get('base'):
                dt = a['dot']
                sk['dot'] = {'name': dt.get('name') or 'Damage over Time', 'every': dt.get('tickSec') or 1, 'dur': dt.get('durationSec') or 10,
                             'base': {1: dt['base'], maxlv: dt.get('baseAtMaxLevel') or dt['base']}, 'atk': dt.get('atkPct') or 0}
            if a.get('proc') and a['proc'].get('base'):
                pr = a['proc']
                sk['orb'] = {'chance': (pr.get('chance') or 100) / 100, 'every': pr.get('intervalSec') or 1, 'dur': pr.get('durationSec') or 10,
                             'base': pr['base'], 'atk': pr.get('atkPct') or 0}
            if a.get('chargeLevels') and a.get('baseAtMaxCharge') and a.get('base'):
                m = re.search(r'-[\d,]+ \(\+([\d,.]+)% Attack\)', a.get('effects') or '')
                sk['charge'] = {'levels': a['chargeLevels'], 'mult': round(a['baseAtMaxCharge'] / a['base'], 4),
                                'atkMax': float(m.group(1).replace(',', '')) if m else (a.get('atkPct') or 0) * 3}
            specs = []
            for line in a.get('specializations') or []:
                m = re.match(r'lv(\d+):\s*(.*)', line)
                if m:
                    lv, text = int(m.group(1)), m.group(2)
                else:
                    m = re.match(r'S5[^:]*:\s*(.*)', line)
                    lv, text = 1, (m.group(1) if m else line) + ' (rare stigma)'
                sp = {'lv': lv, 'text': text}
                mod = spec_mod(re.sub(r' \(rare stigma\)$', '', text), ids)
                if mod:
                    sp['mod'] = mod
                specs.append(sp)
            sk['specs'] = specs
            out[sid] = sk
    passives = {}
    for p in d.get('passives', []):
        mx = p.get('textAtMaxLevel') or p.get('effectsAtMaxLevel') or p.get('textMax') or ''
        n1 = nums(p.get('text'))
        n40 = nums(mx) if mx else list(n1)
        for sc in p.get('scaling') or []:
            bl = sc.get('byLevel') or {}
            if '1' in bl and n1:
                top = bl[max(bl, key=int)]
                for i, v in enumerate(n1):
                    if v == bl['1'] and n40[i] == v:
                        n40[i] = top
                        break
        passives[camel(p['name'])] = {'name': p['name'], 'unlock': p.get('unlock'), 'text': p.get('text', ''), 'n1': n1, 'n40': n40}
    return out, passives


HUES = {'gladiator': 18, 'templar': 45, 'ranger': 135, 'sorcerer': 12, 'spiritmaster': 190, 'cleric': 52, 'chanter': 95}


def main():
    src = Path(sys.argv[1])
    names = sys.argv[2:] or list(HUES)
    for n in names:
        f = src / f'{n}.json'
        if not f.exists():
            print('missing', f)
            continue
        d = json.loads(f.read_text(encoding='utf-8'))
        skills, passives = convert(d, HUES.get(n, 40))
        guide = d.get('guide') or {}
        js = (f'// Generated by tools/gen_class_data.py from MetaBot\'s skill pages (global client {d.get("dataVersion", "")}). '
              f'Don\'t edit by hand: rerun it.\n'
              f'window.A2 = window.A2 || {{}};\nA2.DATA = A2.DATA || {{}};\n'
              f'A2.DATA.{n} = {json.dumps({"skills": skills, "passives": passives, "rotation": guide.get("metabotRotation"), "slots": [s.get("unlock") for s in guide.get("stigmaSlots") or []]}, ensure_ascii=False, indent=1)};\n')
        out = ROOT / 'js' / 'classes' / f'data_{n}.js'
        out.write_text(js, encoding='utf-8')
        print(out.name, len(skills), 'skills', sum(1 for s in skills.values() for sp in s['specs'] if sp.get('mod')), 'specs with mods')


if __name__ == '__main__':
    main()
