// Shared numbers, role actions, the job registry and default settings. Each job version lives in js/jobs/*.js
// and registers itself here; B.setJob swaps the current job's actions and statuses into B.ACTIONS / B.STATUSES.
window.BLM = window.BLM || {};

(function (B) {
  B.SPEED_MIN = 400;           // level 90 base for spell / skill speed (other levels: B.LEVELS[n].sub)
  B.SPEED_MAX = 4000;
  B.MAX_MP = 10000;
  B.BASE_REGEN = 200;
  B.LUCID_REGEN = 550;
  B.QUEUE_WINDOW = 0.5;
  B.CASTER_TAX = 0.1;
  B.BASE_LOCK = 0.6;           // server-side animation lock for most actions
  B.PING_MAX = 500;
  B.SLIDECAST = 0.5;
  B.RANGE = 25;
  B.MELEE_RANGE = 3;
  B.AUTO_RANGE = 2.1;
  B.DUMMY_RADIUS = 0.8;
  B.COMBO_TIME = 30;
  // Extra striking dummies for practising AoE (Settings → Dummies): a pack behind the main dummy, which faces -Z.
  B.EXTRA_DUMMIES = [{ x: -2.1, z: 1.6 }, { x: 2.1, z: 1.6 }, { x: -1.1, z: 3.4 }, { x: 1.1, z: 3.4 }];
  // An action's aoe field: true (full potency on every target), a number (the multiplier on every target after
  // the first, e.g. 0.6 for "40% less for all remaining enemies") or a list of multipliers by target, the last
  // repeating ("15% less for the second, 30% less for the third ...").
  B.aoeMult = (aoe, k) => Array.isArray(aoe) ? aoe[Math.min(k, aoe.length - 1)] : typeof aoe === 'number' ? (k ? aoe : 1) : 1;

  // Level modifiers for the damage and speed formulas: main stat, substat and divisor, the attack power multiplier
  // for non-tanks and tanks, and Determination's coefficient. A job version sets its level (default 90), and
  // levelKey when it played before Endwalker's stat squish: 6.0 cut level 80's divisor from 3300 to 1300 and shrank
  // every item, so Shadowbringers numbers (gear with 5000+ main stat) only work with the old table.
  B.LEVELS = {
    100: { main: 440, sub: 420, div: 2780, ap: 237, apTank: 190, det: 140, ten: 112 },   // Dawntrail (Allagan Studies' level 100 table)
    90: { main: 390, sub: 400, div: 1900, ap: 195, apTank: 156, det: 140 },
    80: { main: 340, sub: 380, div: 1300, ap: 165, apTank: 115, det: 130 },
    shb80: { main: 340, sub: 380, div: 3300, ap: 165, apTank: 115, det: 130 },   // level 80 in 5.x (Allagan Studies)
    // Heavensward (3.x): damage = potency × (WD/25 + 1) × main/9 × (1 + DET/7290), crit (CRT−354)/(858×5) + 5% for
    // 1.45× + the same, no Direct Hit; Skill Speed on the 4.x shape with 354 / 858. formula: 'hw' switches the engine.
    hw60: { main: 218, sub: 354, div: 858, det: 118, ap: 100, apTank: 100, formula: 'hw' },
    // Level 50 in 2.x: ParamGrow's level table (sub and divisor 341, base main 202) with the Heavensward shape refitted to
    // the ARR community formulas (valk's calculator, Reddit's caster fit; about 2-4% off), a flat ×1.5 crit and no speed
    // scaling on DoTs (both 3.0 changes).
    arr50: { main: 202, sub: 341, div: 341, det: 118, ap: 100, apTank: 100, formula: 'hw', strDiv: 10.8, detDiv: 2300, casterStrDiv: 7.75,
      casterDetDiv: 4000, autoStrDiv: 10.35, autoDetDiv: 1000, critDiv: 1705, critMult: 1.5, dotSpeed: false },
    sb70: { main: 292, sub: 364, div: 2170, ap: 125, apTank: 105, det: 130 },
    // Blue Mage's caps (Allagan Studies' level tables): level 70 in 6.x, and levels 60 and 50 at Shadowbringers' formula.
    ew70: { main: 292, sub: 364, div: 900, ap: 125, apTank: 105, det: 140 },
    blu80: { main: 340, sub: 380, div: 1300, ap: 165, apTank: 115, det: 140 },  // Blue Mage at 80 (Allagan Studies' BLU doc: det 140)
    blu60: { main: 218, sub: 354, div: 858, ap: 100, apTank: 100, det: 130 },
    blu50: { main: 202, sub: 341, div: 341, ap: 75, apTank: 75, det: 130 },    // level 70 in 4.x (Allagan Studies)
  };

  // The current job's tables. These objects stay the same; their contents change with the job.
  B.ACTIONS = {};
  B.STATUSES = {};

  // ---------- role and general actions ----------
  B.ROLE_ACTIONS = {
    caster: {
      swiftcast: {
        name: 'Swiftcast', kind: 'ogcd', recast: 60, role: true,
        desc: 'Next spell is cast immediately.\nDuration: 10s',
      },
      lucidDreaming: {
        name: 'Lucid Dreaming', kind: 'ogcd', recast: 60, role: true,
        desc: 'Gradually restores MP.\nPotency: 55\nDuration: 21s',
      },
      addle: {
        name: 'Addle', kind: 'ogcd', recast: 90, role: true, target: true,
        desc: 'Lowers target\'s physical damage dealt by 5% and magic damage dealt by 10%.\nDuration: 10s',
      },
      surecast: {
        name: 'Surecast', kind: 'ogcd', recast: 120, role: true,
        desc: 'Spells can be cast without interruption.\nAdditional Effect: Nullifies most knockback and draw-in effects\nDuration: 6s',
      },
    },
    melee: {
      trueNorth: {
        name: 'True North', kind: 'ogcd', recast: 45, charges: 2, role: true,
        desc: 'Nullifies all action direction requirements.\nDuration: 10s\nMaximum Charges: 2',
      },
      feint: {
        name: 'Feint', kind: 'ogcd', recast: 90, role: true, target: true, range: 10,
        desc: 'Lowers target\'s physical damage dealt by 10% and magic damage dealt by 5%.\nDuration: 10s',
      },
      bloodbath: {
        name: 'Bloodbath', kind: 'ogcd', recast: 90, role: true,
        desc: 'Converts a portion of physical damage dealt into HP.\nDuration: 20s',
      },
      secondWind: {
        name: 'Second Wind', kind: 'ogcd', recast: 120, role: true,
        desc: 'Instantly restores own HP.\nCure Potency: 500',
      },
      armsLength: {
        name: 'Arm\'s Length', kind: 'ogcd', recast: 120, role: true,
        desc: 'Creates a barrier nullifying most knockback and draw-in effects.\nDuration: 6s',
      },
      legSweep: {
        name: 'Leg Sweep', kind: 'ogcd', recast: 40, role: true, target: true, range: 3,
        desc: 'Stuns target.\nDuration: 3s',
      },
    },
    tank: {
      rampart: {
        name: 'Rampart', kind: 'ogcd', recast: 90, role: true,
        desc: 'Reduces damage taken by 20%.\nDuration: 20s',
      },
      lowBlow: {
        name: 'Low Blow', kind: 'ogcd', recast: 25, role: true, target: true, range: 3,
        desc: 'Stuns target.\nDuration: 5s',
      },
      provoke: {
        name: 'Provoke', kind: 'ogcd', recast: 30, role: true, target: true, range: 25,
        desc: 'Gesture threateningly, placing yourself at the top of a target\'s enmity list and increasing enmity to that of the current enmity leader plus a set amount.',
      },
      interject: {
        name: 'Interject', kind: 'ogcd', recast: 30, role: true, target: true, range: 3,
        desc: 'Interrupts the use of a target\'s action.',
      },
      reprisal: {
        name: 'Reprisal', kind: 'ogcd', recast: 60, role: true, target: true, range: 5,
        desc: 'Reduces damage dealt by nearby enemies by 10%.\nDuration: 10s',
      },
      armsLength: {
        name: 'Arm\'s Length', kind: 'ogcd', recast: 120, role: true,
        desc: 'Creates a barrier nullifying most knockback and draw-in effects.\nDuration: 6s',
      },
      shirk: {
        name: 'Shirk', kind: 'ogcd', recast: 120, role: true,
        desc: 'Diverts 25% of enmity to target party member.',
      },
    },
  };

  B.GENERAL_ACTIONS = {
    sprint: {
      name: 'Sprint', kind: 'ogcd', recast: 60,
      desc: 'Increases movement speed.\nDuration: 10s',
    },
  };

  // Grade 8 tinctures (patch 6.4): +10%, capped.
  B.TINCTURES = {
    int: { name: 'Grade 8 Tincture of Intelligence', cap: 262 },
    str: { name: 'Grade 8 Tincture of Strength', cap: 262 },
    str6: { name: 'Grade 6 Tincture of Strength', cap: 189 },   // the 6.0x tier
    str7: { name: 'Grade 7 Tincture of Strength', cap: 223 },   // the 6.2/6.3 tier
    mnd6: { name: 'Grade 6 Tincture of Mind', cap: 189 },
    mnd7: { name: 'Grade 7 Tincture of Mind', cap: 223 },
    mnd: { name: 'Grade 8 Tincture of Mind', cap: 262 },
    int4: { name: 'Grade 4 Tincture of Intelligence', cap: 464 },   // the 5.4/5.5 tier (pre-squish stats)
    str4: { name: 'Grade 4 Tincture of Strength', cap: 464 },
    str2: { name: 'Grade 2 Tincture of Strength', cap: 339 },   // the 5.05 tier
    str3: { name: 'Grade 3 Tincture of Strength', cap: 398 },   // the 5.2 tier
    str1: { name: 'Tincture of Strength', cap: 312 },           // 5.0's only one
    dex1: { name: 'Tincture of Dexterity', cap: 312 },          // 5.0's only one
    dex2: { name: 'Grade 2 Tincture of Dexterity', cap: 339 },
    dex4: { name: 'Grade 4 Tincture of Dexterity', cap: 464 },
    dex6: { name: 'Grade 6 Tincture of Dexterity', cap: 189 },
    int6: { name: 'Grade 6 Tincture of Intelligence', cap: 189 },    // the 6.0x tier
    dex7: { name: 'Grade 7 Tincture of Dexterity', cap: 223 },    // the 6.2 tier
    dex8: { name: 'Grade 8 Tincture of Dexterity', cap: 262 },    // the 6.4 tier
    int2: { name: 'Grade 2 Tincture of Intelligence', cap: 339 },
    intdt3: { name: 'Grade 3 Gemdraught of Intelligence', cap: 461 },   // the 7.2 tier
    intdt2: { name: 'Grade 2 Gemdraught of Intelligence', cap: 392 },   // the 7.05 tier
    intdt4: { name: 'Grade 4 Gemdraught of Intelligence', cap: 541 },   // the 7.4 tier
    intdt1: { name: 'Grade 1 Gemdraught of Intelligence', cap: 351 },   // 7.0
    mnd4: { name: 'Grade 4 Tincture of Mind', cap: 464 },
    mnd3: { name: 'Grade 3 Tincture of Mind', cap: 398 },     // the 5.2 tier
    mnd2: { name: 'Grade 2 Tincture of Mind', cap: 339 },     // 5.05–5.08
    mnd1: { name: 'Tincture of Mind', cap: 312 },             // 5.0–5.01
    int3sb: { name: 'Grade 3 Infusion of Intelligence', cap: 225 },
    int1sb: { name: 'Infusion of Intelligence', cap: 137 },        // 4.0–4.1x: HQ +10%, max 137   // the 4.4/4.5 tier: HQ +10%, max 225 (wiki, 2018)
    str3sb: { name: 'Grade 3 Infusion of Strength', cap: 225 },
    mnd3sb: { name: 'Grade 3 Infusion of Mind', cap: 225 },
    dex3sb: { name: 'Grade 3 Infusion of Dexterity', cap: 225 },
    dex1sb: { name: 'Infusion of Dexterity', cap: 137 },           // 4.0–4.1x
    str1sb: { name: 'Infusion of Strength', cap: 137 },
    str2sb: { name: 'Grade 2 Infusion of Strength', cap: 165 },    // 4.2–4.3x
    mnd1sb: { name: 'Infusion of Mind', cap: 137 },
    mnd2sb: { name: 'Grade 2 Infusion of Mind', cap: 165 },        // 4.2–4.3x: HQ +10%, max 165
    // Dawntrail's 7.4 tier: Grade 4 Gemdraughts, HQ +10% up to 541.
    strdt4: { name: 'Grade 4 Gemdraught of Strength', cap: 541 },
    strdt3: { name: 'Grade 3 Gemdraught of Strength', cap: 461 },     // the 7.2 tier
    strdt2: { name: 'Grade 2 Gemdraught of Strength', cap: 392 },     // the 7.05 tier
    strdt1: { name: 'Grade 1 Gemdraught of Strength', cap: 351 },     // 7.0
    dexdt4: { name: 'Grade 4 Gemdraught of Dexterity', cap: 541 },
    dexdt1: { name: 'Grade 1 Gemdraught of Dexterity', cap: 351 },     // 7.0
    dexdt2: { name: 'Grade 2 Gemdraught of Dexterity', cap: 392 },     // the 7.05 tier
    mnddt4: { name: 'Grade 4 Gemdraught of Mind', cap: 541 },
    mnddt2: { name: 'Grade 2 Gemdraught of Mind', cap: 392 },     // the 7.05 tier
    mnddt3: { name: 'Grade 3 Gemdraught of Mind', cap: 461 },     // the 7.2 tier
    mnddt1: { name: 'Grade 1 Gemdraught of Mind', cap: 351 },     // 7.0
  };
  // Healers cast like casters (cast bars, spell effects).
  B.isCaster = (job) => job.role === 'caster' || job.role === 'healer';
  B.statName = (stat) => stat.startsWith('int') ? 'Intelligence' : stat.startsWith('mnd') ? 'Mind' : stat.startsWith('dex') ? 'Dexterity' : 'Strength';
  B.tincture = (stat) => ({
    name: B.TINCTURES[stat].name, short: 'Tincture', kind: 'item', recast: 270, lock: 1.1,
    desc: `${B.medicineFlavor(B.TINCTURES[stat].name)}\n${B.statName(stat)} +10% (Max ${B.TINCTURES[stat].cap})\nDuration: 30s`,
  });
  // The item's own first line: the old 15s potions each had theirs; infusions, tinctures and gemdraughts are the
  // "diluted brew" that lasts twice as long.
  const POTION_FLAVOR = [['X-Potion', 'powerful'], ['Mega-Potion', 'potent'], ['Max-Potion', 'extremely powerful'],
    ['Supramax-Potion', 'unthinkably powerful'], ['Draconian Potion', 'intoxicating', ' brewed from an ancient dragon recipe']];
  B.medicineFlavor = function (name) {
    const stat = name.split(' of ').pop().toLowerCase(), pot = POTION_FLAVOR.find(([k]) => name.startsWith(k));
    if (pot) return `This ${pot[1]} concoction${pot[2] || ''} temporarily increases ${stat}.`;
    return `This diluted brew temporarily increases ${stat}${/Infusion/.test(name) ? ', but' : ''} for twice the duration of similar potions.`;
  };

  B.COMMON_STATUSES = {
    sprint: { name: 'Sprint', self: true, icon: 'st_sprint' },
    medicated: { name: 'Medicated', self: true, icon: 'st_medicated' },
    swiftcast: { name: 'Swiftcast', self: true, icon: 'st_swiftcast' },
    lucidDreaming: { name: 'Lucid Dreaming', self: true, icon: 'st_lucid' },
    surecast: { name: 'Surecast', self: true, icon: 'st_surecast' },
    addle: { name: 'Addle', self: false, icon: 'st_addle' },
    trueNorth: { name: 'True North', self: true, icon: 'st_truenorth' },
    bloodbath: { name: 'Bloodbath', self: true, icon: 'st_bloodbath' },
    armsLength: { name: 'Arm\'s Length', self: true, icon: 'st_armslength' },
    feint: { name: 'Feint', self: false, icon: 'st_feint' },
    rampart: { name: 'Rampart', self: true, icon: 'st_rampart' },
    reprisal: { name: 'Reprisal', self: false, icon: 'st_reprisal' },
  };

  // Role actions that just put a status up.
  B.ROLE_EFFECTS = {
    swiftcast: (e) => e.addStatus('swiftcast', 10),
    lucidDreaming: (e) => e.addStatus('lucidDreaming', 21),
    addle: (e) => e.addTStatus('addle', e.job.actions.addle.dur || 10),
    surecast: (e) => e.addStatus('surecast', e.job.actions.surecast.dur || 6),
    trueNorth: (e) => e.addStatus('trueNorth', 10),
    feint: (e) => e.addTStatus('feint', e.job.actions.feint.dur || 10),
    bloodbath: (e) => e.addStatus('bloodbath', 20),
    secondWind: () => {},
    armsLength: (e) => e.addStatus('armsLength', 6),
    legSweep: () => {},
    rampart: (e) => e.addStatus('rampart', 20),
    invigorate: (e) => { if (e.usesTp) e.tp = Math.min(e.job.tp.max, e.tp + 400); },
    reprisal: (e) => e.addTStatus('reprisal', e.job.actions.reprisal.dur || 10),
    lowBlow: () => {}, provoke: () => {}, interject: () => {}, shirk: () => {},
    sprint: (e) => e.addStatus('sprint', 10),
    // Heavensward potions lasted 15s (the tincture's dur).
    tincture: (e) => e.addStatus('medicated', (e.job.actions.tincture && e.job.actions.tincture.dur) || 30),
  };

  // ---------- version tweaks to an action ----------
  // A version's change to an action: A[id] becomes a copy with o's fields. When o changes the potency or the combo
  // potency and brings no description of its own, the description's numbers follow, so the tooltip matches what the
  // action deals: "potency of 120", "Combo Potency: 280", and the positional line under each ("150 when executed from
  // a target's rear"), which keeps its bonus over the new number.
  const N = (s) => +String(s).replace(/,/g, '');
  const fmtPotency = (n, like) => (n >= 1000 || /,/.test(like) ? n.toLocaleString('en-US') : String(n));
  B.retuneDesc = function (desc, was, now) {
    let ref = 'potency';
    return desc.split('\n').map((line) => {
      if (/^Combo Potency: /.test(line)) {
        ref = 'comboPotency';
        return line.replace(/[\d,]+/, (m) => (N(m) === was.comboPotency && typeof now.comboPotency === 'number' ? fmtPotency(now.comboPotency, m) : m));
      }
      line = line.replace(/potency of ([\d,]+)/, (all, m) => (N(m) === was.potency && typeof now.potency === 'number' ? 'potency of ' + fmtPotency(now.potency, m) : all));
      // "170 when executed from a target's rear", "Rear Combo Potency: 380": the same bonus over the new number.
      const shift = (all, pre, m, post) => {
        const k = pre ? 'comboPotency' : ref, o = was[k], n = now[k];
        return typeof o === 'number' && typeof n === 'number' && o !== n ? pre + fmtPotency(N(m) - o + n, m) + post : all;
      };
      return line.replace(/^()([\d,]+)( when executed)/, shift).replace(/^((?:Rear|Flank) Combo Potency: )([\d,]+)()/, shift);
    }).join('\n');
  };
  B.setAction = function (A, id, o) {
    const was = A[id] || {}, now = Object.assign({}, was, o);
    const changed = ('potency' in o && o.potency !== was.potency) || ('comboPotency' in o && o.comboPotency !== was.comboPotency);
    if (changed && !('desc' in o) && typeof was.desc === 'string') now.desc = B.retuneDesc(was.desc, was, now);
    A[id] = now;
  };

  // ---------- job registry ----------
  // B.JOBS[id] = { id, name, abbr, role, classJob, versions: [{ id, label, history, note, create() }] }
  // history names the version's entry in docs/job-versions.md (B.JOB_HISTORY, js/versions.js), for its rating.
  B.JOBS = {};
  B.JOB_ORDER = [];
  const EXPANSION_RANK = { EC: -1, DT: 0, EW: 1, ShB: 2, SB: 3, HW: 4, ARR: 5 };     // EC: the Evercold previews
  B.registerJob = function (job) {
    if (!B.JOBS[job.id]) B.JOB_ORDER.push(job.id);
    const prev = B.JOBS[job.id];
    // Newest expansion first, whatever order the files load in (a file builds on the class it extends, so it loads
    // after it); within an expansion, the order the files list them.
    const all = (prev ? prev.versions : []).concat(job.versions || []);
    const rank = (v) => { const k = EXPANSION_RANK[String(v.history || '').split(' ')[0]]; return k === undefined ? 9 : k; };
    const versions = all.map((v, i) => [v, i]).sort((x, y) => rank(x[0]) - rank(y[0]) || x[1] - y[1]).map(x => x[0]);
    B.JOBS[job.id] = Object.assign({}, job, { versions });
  };

  // ---------- tooltips ----------
  // The header word: an action's own type wins (Riposte is a weaponskill on a caster); otherwise a GCD is a spell if
  // it's cast, costs MP, deals holy or dark damage or belongs to a caster or healer, and a weaponskill if not; Iaijutsu
  // is a weaponskill and Ninjutsu an ability. Role actions came in 4.0: before that they were the class's own skills
  // or cross-class ones, plain abilities.
  B.kindLabel = function (a) {
    if (a.type) return a.type;
    if (a.kind === 'item') return 'Item';
    const job = B.job || {}, role = job.role || (job.def && job.def.role);
    if (a.kind === 'ogcd') return a.role && job.era !== 'ARR' && job.era !== 'HW' ? 'Ability (Role Action)' : 'Ability';
    if (a.school === 'iai') return 'Weaponskill';
    if (a.school === 'ninjutsu') return 'Ability';
    return a.cast || a.mp || a.school === 'holy' || a.school === 'dark' || role === 'caster' || role === 'healer' ? 'Spell' : 'Weaponskill';
  };

  // What a version's tooltips share: each era's potion text, and level 100's role traits (Feint, Addle and Reprisal
  // last 15s, Second Wind heals for 800). Statuses follow the text (Surecast was 10s before 4.0, 5s in early 4.x).
  // The job's own table is copied first, since versions share their actions.
  function tidyTips(job) {
    const A = job.actions = Object.assign({}, job.actions);
    const fix = (id, o) => { A[id] = Object.assign({}, A[id], o(A[id])); };
    for (const id of Object.keys(A)) {
      const a = A[id];
      if (a.kind === 'item' && typeof a.desc === 'string' && / of (Strength|Dexterity|Intelligence|Mind)$/.test(a.name || '')) {
        fix(id, (x) => ({ desc: x.desc.replace(/^(?:This|Temporarily) [^\n]*/, B.medicineFlavor(x.name)) }));
      }
    }
    const sure = A.surecast && /Duration: (\d+)s/.exec(A.surecast.desc || '');
    if (sure) fix('surecast', () => ({ dur: +sure[1] }));
    if (job.era !== 'DT' && job.era !== 'EC') return;
    for (const id of ['feint', 'addle', 'reprisal']) {
      if (A[id] && A[id].role && /Duration: 10s/.test(A[id].desc || '')) fix(id, (x) => ({ dur: 15, desc: x.desc.replace('Duration: 10s', 'Duration: 15s') }));
    }
    if (A.secondWind && A.secondWind.role) fix('secondWind', (x) => ({ desc: String(x.desc).replace(/Cure Potency: \d+/, 'Cure Potency: 800') }));
  }

  // Make a job version current: fill B.ACTIONS / B.STATUSES and return the job object.
  B.setJob = function (jobId, versionId) {
    const def = B.JOBS[jobId] || B.JOBS[B.JOB_ORDER[0]];
    const ver = def.versions.find(v => v.id === versionId) || def.versions[def.versions.length - 1];
    const job = ver.create();
    job.id = def.id; job.version = ver.id; job.versionLabel = ver.label; job.def = def;
    job.era = String(ver.history || '').split(' ')[0];
    tidyTips(job);
    for (const k of Object.keys(B.ACTIONS)) delete B.ACTIONS[k];
    Object.assign(B.ACTIONS, job.actions);
    for (const k of Object.keys(B.STATUSES)) delete B.STATUSES[k];
    Object.assign(B.STATUSES, B.COMMON_STATUSES, job.statuses);
    B.job = job;
    B.jobId = def.id;
    return job;
  };

  // ---------- defaults ----------
  const ROW = ['Digit1', 'Digit2', 'Digit3', 'Digit4', 'Digit5', 'Digit6', 'Digit7', 'Digit8', 'Digit9', 'Digit0', 'Minus', 'Equal'];
  B.DEFAULT_BINDS = [
    ROW.slice(),
    ROW.map(k => 'Shift+' + k),
    ['KeyQ', 'KeyE', 'KeyR', 'KeyF', 'KeyT', 'KeyG', 'KeyZ', 'KeyX', 'KeyC', 'KeyV', 'KeyB', 'KeyY'],
  ];

  B.SIM_VERSION = '2.45.0';      // the README changelog's newest entry (shown in the debug log)

  B.DEFAULT_SETTINGS = {
    name: 'Warrior of Light',
    job: 'blm',
    versions: {},         // job id -> version id
    speed: {},            // job id -> spell / skill speed
    ping: 70,             // ms; the vanilla client adds it to every lock
    latencyComp: true,    // NoClippy / XivAlexander (most players run one); off is the vanilla client
    volume: 0.5,
    pullLength: 0,        // seconds, 0 = until you stop
    countdown: 15,
    showMpCost: true,
    slidecastMarker: true,
    showTimeline: true,
    gameModels: true,     // use work/game-models.js when it's there
    gameMap: true,        // and work/game-map.js (Wolves' Den Pier)
    dummy: 'thavnair',
    dummies: 1,
    cameraFollow: false,  // swing the camera round to keep the dummy in view (off: the game's free camera)
    mouseSpeed: 1,        // camera turn speed for mouse drags
    jobView: 'expanded',  // the Job window: 'expanded' cards, or 'condensed' (every version on one grid)
  };

  // Rough dummy colour bands for a single target parse with no raid buffs, relative to the job's benchmark.
  B.PARSE_BANDS = [
    { min: 0, color: '#9d9d9d' },
    { min: 0.75, color: '#1eff00' },
    { min: 0.85, color: '#0070ff' },
    { min: 0.92, color: '#a335ee' },
    { min: 0.97, color: '#ff8000' },
    { min: 1.0, color: '#e268a8' },
    { min: 1.02, color: '#e5cc80' },
  ];
})(window.BLM);
