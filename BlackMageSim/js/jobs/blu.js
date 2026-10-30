// Blue Mage, the limited job, in three versions by level cap. Spells come from js/jobs/blu_spells.js (generated from
// the research: Action.csv rows, potencies, casts, recasts and shared cooldown groups). A solo player on a dummy can
// use everything that doesn't need a party, incoming damage, a low-HP target or a mount: Mimicry has no partner and
// Basic Instinct only works in duties. Moon Flute is +50% to everything for 15s, then 15s of Waning Nocturne (no
// actions, no auto-attacks); Bristle makes the next spell +50%; Whistle makes the next physical spell ×1.8 and Tingle
// adds 100 potency to it; Surpanakha's four charges each add 50% to the next if used back to back; Phantom Flurry
// channels 200 at once and each second for 5s, and pressing it again ends it with 600. Blue Mage's trait (Maim and Mend
// V) is +50%. Song of Torment and Nightbloom put on the same Bleeding; the tincture adds 10% of your Intelligence (up to
// its cap); spells with their own recast roll it with spell speed.
//  - Cap 80, 6.45–7.57: level 80 (B.LEVELS.blu80) and spells 105–124: Winged Reprobation (three uses at 300 that reset
//    its recast, the fourth at 400 starts it and readies Conviction Marcato at 440), Sea Shanty, Being Mortal and the
//    Apokalypsis channel (140 now and each second, 11 hits), Breath of Magic and Mortal Flame (DoTs with no hit; Mortal
//    Flame never runs out), Candy Cane. No Blue Mage number has changed since 6.45. Blue Academy's 2.20 set.
//  - Cap 70, 5.45–6.41: the Endwalker level-70 table (B.LEVELS.ew70; most of its run), the Mirage set with the
//    Predatrice (93 weapon damage from INT breakpoints).
//  - Cap 60, 5.15–5.41: level 60 at Shadowbringers' formula, Mask of Azuro and Incendiario.
//  - Cap 50, 4.5–5.11: level 50, the 5.1 numbers (Off-guard and Peculiar Light +5% on a shared 60s); Magus's set.
// Numbers are the game data at each patch (xivapi's datamining) and the Lodestone notes; weapon damage before 6.0 is an
// estimate from a same-level caster weapon, and the openers are reconstructed from Blue Academy's and period guides.
// ref: a scripted bot parses about 5,190 at cap 80 and 1,970 at cap 70.
(function (B) {
  const EPS = 1e-6;
  const S = B.BLU_SPELLS;
  const VERSIONS = {
    cap80: { label: 'Cap 80, 6.45–7.57', history: 'Cap 80, 6.45–7.57', level: 80, levelKey: 'blu80', spells: 'cap80', ref: 5500, gcd: 2.2,
      stats: { hp: 28250, main: 1701, wd: 106, det: 700, crit: 1445, dh: 686, speed: 1561 }, tincture: 'int', model: 'blu-80',
      gear: 'Blue Academy\'s 2.20 set: the Blue-eyes with Phantasmal, Edenmorn and Augmented Cryptlurker\'s gear (Intelligence 1,701, 106 weapon damage)',
      note: 'Level 80: Winged Reprobation, Sea Shanty, Being Mortal, Apokalypsis, Breath of Magic and Mortal Flame join the Moon Flute burst' },
    cap70: { label: 'Cap 70, 5.45–6.41', history: 'Cap 70, 5.45–6.41', level: 70, levelKey: 'ew70', spells: 'cap70', ref: 2090,
      stats: { hp: 14200, main: 1246, wd: 93, det: 567, crit: 982, dh: 837, speed: 499 }, tincture: 'int6', model: 'blu-70',
      gear: 'the Mirage set with the Predatrice (Intelligence 1,246, 93 weapon damage)',
      note: 'Level 70: Moon Flute bursts with Triple Trident, Nightbloom, Phantom Flurry, Surpanakha ×4, Matra Magic, The Rose of Destruction' },
    cap60: { label: 'Cap 60, 5.15–5.41', history: 'Cap 60, 5.15–5.41', level: 60, levelKey: 'blu60', spells: 'cap60', ref: 1900,
      stats: { hp: 14800, main: 1292, wd: 115, det: 341, crit: 727, dh: 874, speed: 677 }, tincture: 'int2', model: 'blu-60',
      gear: 'the Mask of Azuro and Incendiario set (Intelligence 1,292, about 115 weapon damage)',
      note: 'Level 60: Surpanakha, Quasar and J Kick, Magic Hammer, Sonic Boom, the 5.1 numbers; Moon Flute bursts' },
    cap50: { label: 'Cap 50, 4.5–5.11', history: 'Cap 50, 4.5–5.11', level: 50, levelKey: 'blu50', spells: 'cap50b', ref: 330,
      stats: { hp: 4100, main: 542, wd: 82, det: 299, crit: 549, dh: 438, speed: 391 }, tincture: 'int3sb', model: 'blu-50',
      gear: 'Magus\'s set with The Spirit of the Whalaqee (Intelligence 542, about 82 weapon damage)',
      note: 'Level 50, the debut: spells 1–49, Moon Flute and Bristle, Song of Torment, Feather Rain, Eruption, Shock Strike, Glass Dance' },
  };
  const UNUSABLE = { coldFog: 1, chelonianGate: 1, finalSting: 1, selfDestruct: 1, chocoMeteor: 1, revengeBlast: 1, devour: 0, basicInstinct: 1, aethericMimicry: 1,
    schiltron: 1, rehydration: 1, forceField: 1, dimensionalShift: 1, wildRage: 1 };
  // GCD spells with a recast of their own roll it with spell speed, except these two.
  const FIXED_CD = { offGuard: 1, peculiarLight: 1 };
  // Each spell's tooltip, in the game's phrasing: [shape, text]. {p} is the cap's potency, {d} / {t} its DoT's potency and
  // duration; a function gets the version (for what changed between caps). Shapes set where it reaches: self (no
  // target), pb (centred on you; the data's radius), melee (3y), cone and line (their length is the range), ground
  // and anything else on a target at 25y (Feather Rain 30y). The effects a lone dummy ignores are kept as text only.
  const TIPS = {
    waterCannon: [0, 'Deals water damage with a potency of {p}.'],
    flameThrower: ['cone', 'Deals fire damage with a potency of {p} to all enemies in a cone before you.'],
    aquaBreath: ['cone', 'Deals water damage with a potency of {p} to all enemies in a cone before you.\nAdditional Effect: Dropsy\nPotency: {d}\nDuration: {t}s'],
    flyingFrenzy: [0, 'Delivers a jumping physical attack with a potency of {p} to target and all enemies nearby it.\nCannot be executed while bound.'],
    drillCannons: ['line', 'Deals physical damage with a potency of {p} to all enemies in a straight line before you.'],
    highVoltage: ['pb', 'Deals lightning damage with a potency of {p} to all nearby enemies.\nAdditional Effect: Paralysis'],
    songOfTorment: [0, (V) => `Deals damage with a potency of {p}.\nAdditional Effect: Bleeding\nPotency: {d}\nDuration: {t}s${V.level >= 70 ? '\nCannot be stacked with Nightbloom\'s Bleeding.' : ''}`],
    glower: ['line', 'Deals lightning damage with a potency of {p} to all enemies in a straight line before you.\nAdditional Effect: Paralysis\nDuration: 6s'],
    plaincracker: ['pb', 'Deals earth damage with a potency of {p} to all nearby enemies.'],
    bristle: ['self', (V) => `Increases the potency of the next spell cast by 50%.\nDuration: 30s${V.level >= 60 ? '\nEffect cannot be stacked with Harmonized.' : ''}`],
    sharpenedKnife: ['melee', 'Deals physical damage with a potency of {p}.'],
    bloodDrain: [0, 'Deals damage with a potency of {p}.\nAdditional Effect: Absorbs a portion of damage dealt as MP'],
    bombToss: [0, 'Deals fire damage with a potency of {p} to all enemies in a designated area.\nAdditional Effect: Stun\nDuration: 3s'],
    offGuard: [0, 'Increases target\'s damage taken by 5%.\nDuration: 15s\nShares a recast timer with Peculiar Light.\nRecast timer cannot be affected by status effects or gear attributes.'],
    flyingSardine: [0, 'Deals physical damage with a potency of {p}.\nAdditional Effect: Interrupts the target'],
    fourTonzeWeight: [0, 'Drops a weight on a designated area, dealing physical damage with a potency of {p} to all enemies in it.\nAdditional Effect: Heavy +40%'],
    theLook: ['cone', 'Deals damage with a potency of {p} to all enemies in a cone before you.\nAdditional Effect: Increased enmity'],
    badBreath: ['cone', 'Inflicts Slow, Heavy, Blind, Paralysis, Poison and Malodorous on all enemies in a cone before you, and interrupts the target.'],
    mightyGuard: ['self', (V) => `Reduces damage taken by 40% while reducing damage dealt by ${V.level >= 70 ? 40 : 70}%. Also increases enmity.\nEffect ends upon reuse.`],
    toadOil: ['self', 'Increases evasion by 20%.\nDuration: 180s'],
    theRamsVoice: ['pb', 'Deals ice damage with a potency of {p} to all nearby enemies.\nAdditional Effect: Deep Freeze\nDuration: 12s'],
    theDragonsVoice: ['pb', 'Deals lightning damage with a potency of {p} to all enemies between 8 and 20 yalms around you.\nAdditional Effect: Paralysis'],
    thousandNeedles: ['pb', 'Deals a fixed 1,000 damage, split evenly among all nearby enemies.'],
    inkJet: ['cone', 'Deals damage with a potency of {p} to all enemies in a cone before you.\nAdditional Effect: Blind\nDuration: 30s'],
    fireAngon: [0, 'Deals physical fire damage with a potency of {p} to target and all enemies nearby it.'],
    moonFlute: ['self', 'Grants Waxing Nocturne, increasing damage dealt by 50% and movement speed by 30%.\nDuration: 15s\nWhen it ends, grants Waning Nocturne: no auto-attacks, spells or abilities.\nDuration: 15s'],
    mindBlast: ['pb', 'Deals damage with a potency of {p} to all nearby enemies.\nAdditional Effect: Paralysis'],
    peculiarLight: ['self', 'Increases magic damage taken by nearby enemies by 5%.\nDuration: 15s\nShares a recast timer with Off-guard.\nRecast timer cannot be affected by status effects or gear attributes.'],
    featherRain: [0, 'Deals wind damage with a potency of {p} to all enemies in a designated area.\nAdditional Effect: Windburn\nPotency: {d}\nDuration: {t}s\nShares a recast timer with Eruption.'],
    eruption: [0, 'Deals fire damage with a potency of {p} to all enemies in a designated area.\nShares a recast timer with Feather Rain.'],
    mountainBuster: ['cone', 'Deals physical earth damage with a potency of {p} to all enemies in a cone before you.\nShares a recast timer with Shock Strike.'],
    shockStrike: [0, 'Deals lightning damage with a potency of {p} to target and all enemies nearby it.\nShares a recast timer with Mountain Buster.'],
    glassDance: ['cone', 'Deals ice damage with a potency of {p} to all enemies in a wide arc before you.\nShares a recast timer with Veil of the Whorl.'],
    alpineDraft: ['line', 'Deals wind damage with a potency of {p} to all enemies in a straight line before you.'],
    proteanWave: ['cone', 'Deals water damage with a potency of {p} to all enemies in a cone before you.\nAdditional Effect: Knockback 15 yalms'],
    northerlies: ['cone', 'Deals ice damage with a potency of {p} to all enemies in a cone before you.\nAdditional Effect: Freezes enemies afflicted with Dropsy'],
    electrogenesis: [0, 'Deals lightning damage with a potency of {p} to target and all enemies nearby it.'],
    kaltstrahl: ['cone', 'Deals physical damage with a potency of {p} to all enemies in a cone before you.'],
    abyssalTransfixion: [0, 'Deals physical damage with a potency of {p}.\nAdditional Effect: Paralysis\nDuration: 30s'],
    magicHammer: [0, (V) => `Deals damage with a potency of {p} to target and all enemies nearby it.\nAdditional Effect: Conked (Intelligence and Mind −10%)\nDuration: 10s\nAdditional Effect: Restores 10% of maximum MP${V.level >= 80 ? '\nShares a recast timer with Candy Cane.' : ''}`],
    sonicBoom: [0, 'Deals wind damage with a potency of {p}.'],
    whistle: ['self', 'Increases the potency of the next physical damage spell cast by 80%.\nDuration: 30s\nEffect cannot be stacked with Boost.'],
    whiteKnightsTour: ['line', 'Deals damage with a potency of {p} to all enemies in a straight line before you.\nAdditional Effect: Bind'],
    blackKnightsTour: ['line', 'Deals damage with a potency of {p} to all enemies in a straight line before you.\nAdditional Effect: Slow +20%'],
    perpetualRay: [0, 'Deals damage with a potency of {p}.\nAdditional Effect: Stun that ignores stun resistance\nDuration: 1s'],
    reflux: [0, 'Deals lightning damage with a potency of {p}.\nAdditional Effect: Heavy +40%'],
    devour: ['melee', 'Deals damage with a potency of {p}.\nAdditional Effect: Increases maximum HP by 20%\nDuration: 15s'],
    condensedLibra: [0, 'Inflicts Physical, Astral or Umbral Attenuation on the target, increasing damage taken of that type by 5%.\nDuration: 30s\nOnly one of these can be on a target at a time.'],
    surpanakha: ['cone', 'Deals earth damage with a potency of {p} to all enemies in a cone before you.\nAdditional Effect: Surpanakha\'s Fury, raising Surpanakha\'s potency by 50% per stack (max 3)\nDuration: 3s\nThe effect ends upon use of any other action.\nMaximum Charges: 4'],
    quasar: ['pb', 'Deals damage with a potency of {p} to all nearby enemies.\nShares a recast timer with J Kick.'],
    jKick: [0, 'Delivers a jumping physical attack with a potency of {p} to target and all enemies nearby it.\nCannot be executed while bound.\nShares a recast timer with Quasar.'],
    tripleTrident: ['melee', 'Delivers a threefold physical attack, each hit with a potency of {p}.'],
    tingle: [0, 'Deals lightning damage with a potency of {p} to target and all enemies nearby it.\nAdditional Effect: Increases the potency of the next physical damage spell cast by 100\nDuration: 15s'],
    tatamiGaeshi: ['line', 'Deals damage with a potency of {p} to all enemies in a straight line before you.\nAdditional Effect: Stun\nDuration: 3s'],
    stotram: ['pb', 'Deals damage with a potency of {p} to all nearby enemies.'],
    saintlyBeam: [0, 'Deals damage with a potency of {p} to target and all enemies nearby it.'],
    feculentFlood: ['line', 'Deals earth damage with a potency of {p} to all enemies in a straight line before you.'],
    theRoseOfDestruction: [0, (V) => `Deals damage with a potency of {p}.\nShares a recast timer with Chelonian Gate${V.level >= 80 ? ' and Ruby Dynamics' : ''}.`],
    blaze: [0, 'Deals ice damage with a potency of {p} to target and all enemies nearby it.'],
    mustardBomb: [0, 'Deals fire damage with a potency of {p} to target and all enemies nearby it.\nAdditional Effect: Fire damage over time\nPotency: {d}\nDuration: {t}s'],
    aetherialSpark: ['line', 'Deals damage with a potency of {p} to all enemies in a straight line before you.\nAdditional Effect: Damage over time\nPotency: {d}\nDuration: {t}s'],
    hydroPull: ['pb', 'Deals water damage with a potency of {p} to all nearby enemies and draws them in.'],
    maledictionOfWater: ['line', 'Deals water damage with a potency of {p} to all enemies in a straight line before you.'],
    matraMagic: [0, 'Deals damage eight times, each hit with a potency of {p}.\nShares a recast timer with Angel\'s Snack and Dragon Force.'],
    peripheralSynthesis: ['line', 'Deals physical damage with a potency of {p} to all enemies in a straight line before you.\nAdditional Effect: Lightheaded'],
    bothEnds: ['pb', 'Deals physical damage with a potency of {p} to all nearby enemies.\nShares a recast timer with Nightbloom.'],
    phantomFlurry: ['cone', 'Delivers a physical attack with a potency of {p} to all enemies in a cone before you, then again each second for 5s.\nUsing it again while channelling ends it with a final attack of 600 potency.\nNo other actions can be used while channelling.'],
    nightbloom: ['pb', 'Deals damage with a potency of {p} to all nearby enemies.\nAdditional Effect: Bleeding\nPotency: {d}\nDuration: {t}s\nCannot be stacked with Song of Torment\'s Bleeding.\nShares a recast timer with Both Ends.'],
    goblinPunch: ['melee', 'Deals physical damage with a potency of {p}.\nFront Potency: 220'],
    rightRound: ['pb', 'Deals physical damage with a potency of {p} to all nearby enemies.\nAdditional Effect: Knockback 10 yalms'],
    peatPelt: [0, 'Deals earth damage with a potency of {p} to target and all enemies nearby it.\nAdditional Effect: Begrimed\nPotency: {d}\nDuration: {t}s'],
    deepClean: ['pb', 'Deals physical damage with a potency of {p} to all nearby enemies.\nAdditional Effect: Removes Begrimed from enemies hit, granting Spick-and-span (regen) for each\nDuration: 15s'],
    rubyDynamics: ['cone', 'Deals physical damage with a potency of {p} to all enemies in a cone before you.\nShares a recast timer with The Rose of Destruction and Chelonian Gate.'],
    divinationRune: ['cone', 'Deals damage with a potency of {p} to all enemies in a cone before you.\nAdditional Effect: Restores MP for each enemy hit'],
    convictionMarcato: ['line', 'Deals damage with a potency of {p} to all enemies in a straight line before you.\nWinged Redemption Potency: 440'],
    wingedReprobation: ['line'],
    laserEye: [0, 'Deals damage with a potency of {p} to target and all enemies nearby it.'],
    candyCane: [0, 'Deals damage with a potency of {p} to target and all enemies nearby it.\nAdditional Effect: Candy Cane (Strength and Dexterity −10%)\nDuration: 10s\nAdditional Effect: Restores 10% of maximum MP\nShares a recast timer with Magic Hammer.'],
    breathOfMagic: ['cone'],
    seaShanty: ['pb', 'Deals water damage with a potency of {p} to all nearby enemies.'],
    apokalypsis: ['line', 'Deals damage with a potency of {p} to all enemies in a straight line before you, then again each second for 10s.\nNo other actions can be used while channelling.\nShares a recast timer with Being Mortal.'],
    beingMortal: ['pb', 'Deals damage with a potency of {p} to all nearby enemies.\nShares a recast timer with Apokalypsis.'],
  };

  function buildActions(V) {
    const A = {};
    for (const s of S[V.spells]) {
      if (UNUSABLE[s.key] === 1) continue;
      const ogcd = /ability/i.test(s.type || '') || s.cast_s === 0 && s.recast_s > 2.5 && !/spell/i.test(s.type || '');
      const phys = /physical/i.test(s.attack_type || '');
      const dot = Array.isArray(s.dot) && s.dot.length ? { potency: s.dot[0].potency, duration: s.dot[0].duration_s || 1e6 } : null;
      const shared = s.cooldown_group && s.cooldown_group !== 58 ? 'g' + s.cooldown_group : undefined;
      const a = {
        name: s.name, kind: ogcd ? 'ogcd' : 'gcd', potency: s.potency || 0, cast: ogcd ? 0 : s.cast_s || 0, recast: s.recast_s || 2.5,
        cdGroup: shared, target: (s.radius_y || 0) === 0 || s.key !== 'peculiarLight', range: 25, delay: 0.7, physical: phys, dot,
        mp: (s.cost_raw || 0) * 100, num: s.number, school: phys ? 'physical' : 'magic', fx: phys ? 'gnbSlash' : 'gnbBurst',
        desc: `Blue magic spell #${s.number}.\n${s.effects || (s.potency ? `Deals damage with a potency of ${s.potency}.` : '')}`.trim(),
      };
      if (ogcd) { a.cd = undefined; }
      else if (s.recast_s > 2.5) { a.cd = s.recast_s; a.recast = 2.5; a.cdScales = !FIXED_CD[s.key]; }
      const tip = TIPS[s.key];
      if (tip) {
        const [shape, text] = tip, r = s.radius_y || 0;
        if (shape === 'self') a.target = false;
        else if (shape === 'pb') Object.assign(a, { target: false, pbaoe: r });
        else if (shape === 'melee') a.range = B.MELEE_RANGE;
        else if ((shape === 'cone' || shape === 'line') && r) a.range = r;
        if (s.key === 'featherRain') a.range = 30;
        if (text) {
          const t = typeof text === 'function' ? text(V) : text;
          a.desc = `Blue magic spell #${s.number}.\n` + t.replace(/\{p\}/g, (s.potency || 0).toLocaleString('en-US'))
            .replace(/\{d\}/g, dot ? dot.potency : '').replace(/\{t\}/g, dot ? dot.duration : '');
        }
      }
      A[s.key] = a;
    }
    if (A.surpanakha) Object.assign(A.surpanakha, { charges: 4 });
    if (A.tripleTrident) A.tripleTrident.hits = 3;
    if (A.matraMagic) A.matraMagic.hits = 8;
    if (A.phantomFlurry) A.phantomFlurry.channel = true;
    if (A.apokalypsis) A.apokalypsis.channel = true;
    if (A.mortalFlame) A.mortalFlame.desc = 'Blue magic spell #121.\nDeals fire damage over time.\nPotency: 40\nThe effect lasts until the target is defeated.\nCannot be cast outside combat.';
    if (A.breathOfMagic) A.breathOfMagic.desc = 'Blue magic spell #109.\nDeals damage over time to all enemies in a cone before you.\nPotency: 120\nDuration: 60s';
    if (A.wingedReprobation) A.wingedReprobation.desc = 'Blue magic spell #118.\nDeals physical damage with a potency of 300 to all enemies in a straight line before you.\nAdditional Effect: Grants a stack of Winged Reprobation and resets this spell\'s recast\nAt 3 stacks: potency 400; uses the stacks, starts the recast and grants Winged Redemption\nDuration: 10s';
    A.swiftcast = { name: 'Swiftcast', kind: 'ogcd', recast: 60, role: true, desc: 'Next spell is cast immediately.\nDuration: 10s' };
    A.lucidDreaming = { name: 'Lucid Dreaming', kind: 'ogcd', recast: 60, role: true, desc: 'Gradually restores MP.\nPotency: 55\nDuration: 21s' };
    Object.assign(A, B.GENERAL_ACTIONS);
    A.tincture = B.tincture(V.tincture);
    return A;
  }

  const STATUSES = {
    waxingNocturne: { name: 'Waxing Nocturne', self: true, icon: 'st_waxing' },
    waningNocturne: { name: 'Waning Nocturne', self: true, icon: 'st_waning' },
    bristle: { name: 'Boost', self: true, icon: 'st_boost' },
    whistle: { name: 'Harmonized', self: true, icon: 'st_harmonized' },
    tingle: { name: 'Tingling', self: true, icon: 'st_tingling' },
    surpanakhasFury: { name: 'Surpanakha\'s Fury', self: true, icon: 'st_surpa' },
    phantomFlurry: { name: 'Phantom Flurry', self: true, icon: 'st_flurry' },
    offGuard: { name: 'Off-guard', self: false, icon: 'st_offguard' },
    peculiarLight: { name: 'Peculiar Light', self: false, icon: 'st_peculiar' },
    songOfTorment: { name: 'Bleeding', self: false, icon: 'st_bleed' },
    nightbloom: { name: 'Bleeding', self: false, icon: 'st_bleed2' },
    featherRain: { name: 'Windburn', self: false, icon: 'st_windburn' },
    wingedReprobation: { name: 'Winged Reprobation', self: true, icon: 'st_wingedReprobation' },
    wingedRedemption: { name: 'Winged Redemption', self: true, icon: 'st_wingedRedemption' },
    apokalypsis: { name: 'Apokalypsis', self: true, icon: 'st_flurry' },
    breathOfMagic: { name: 'Breath of Magic', self: false, icon: 'st_breathOfMagic' },
    mortalFlame: { name: 'Mortal Flame', self: false, icon: 'st_mortalFlame' },
  };

  class BlueMage {
    constructor(version) {
      const V = VERSIONS[version];
      this.V = V;
      this.name = 'Blue Mage';
      this.abbr = 'BLU';
      this.role = 'caster';
      this.level = V.level;
      this.levelKey = V.levelKey;
      this.model = V.model;
      this.maxMp = 10000;
      this.actions = buildActions(V);
      this.statuses = STATUSES;
      this.stats = Object.assign({ mainStat: 'int', jobMod: 115, trait: 150, delay: 3.28 }, V.stats);
      this.speedName = 'Spell speed';
      this.tierHaste = 0;
      this.selfStatusOrder = ['waxingNocturne', 'waningNocturne', 'bristle', 'whistle', 'tingle', 'surpanakhasFury', 'phantomFlurry', 'apokalypsis',
        'wingedReprobation', 'wingedRedemption', 'swiftcast', 'medicated', 'lucidDreaming', 'sprint'];
      this.targetStatusOrder = ['offGuard', 'peculiarLight', 'songOfTorment', 'breathOfMagic', 'mortalFlame', 'featherRain'];
      const has = (k) => !!this.actions[k];
      const pick = (ks) => ks.filter(has);
      const cap80 = V.spells === 'cap80';
      const row1 = cap80 ? pick(['sonicBoom', 'theRoseOfDestruction', 'songOfTorment', 'bristle', 'moonFlute', 'whistle', 'tingle', 'tripleTrident', 'matraMagic', 'wingedReprobation', 'breathOfMagic', 'mortalFlame'])
        : pick(['sonicBoom', 'theRoseOfDestruction', 'songOfTorment', 'bristle', 'moonFlute', 'whistle', 'tingle', 'tripleTrident', 'matraMagic', 'offGuard', 'magicHammer', 'waterCannon']);
      const row2 = cap80 ? pick(['featherRain', 'shockStrike', 'jKick', 'glassDance', 'surpanakha', 'nightbloom', 'phantomFlurry', 'seaShanty', 'beingMortal', 'apokalypsis', 'swiftcast', 'lucidDreaming'])
        : pick(['featherRain', 'eruption', 'shockStrike', 'mountainBuster', 'glassDance', 'jKick', 'quasar', 'surpanakha', 'nightbloom', 'bothEnds', 'phantomFlurry', 'swiftcast']);
      const row3 = cap80 ? pick(['convictionMarcato', 'candyCane', 'magicHammer', 'offGuard', 'peculiarLight', 'quasar', 'eruption', 'mountainBuster', 'bothEnds', 'tincture', 'sprint', 'goblinPunch'])
        : pick(['lucidDreaming', 'tincture', 'sprint', 'peculiarLight', 'flameThrower', 'theLook', 'mindBlast', 'flyingFrenzy', 'drillCannons', 'fourTonzeWeight', 'bombToss', 'plaincracker']);
      const pad = (r) => r.concat(Array(12).fill(null)).slice(0, 12);
      this.defaultBars = [pad(row1), pad(row2), pad(row3)];
      this.actionGroups = [
        ['Blue Magic', Object.keys(this.actions).filter(k => this.actions[k].num).sort((x, y) => this.actions[x].num - this.actions[y].num)],
        ['Role Actions', ['swiftcast', 'lucidDreaming']],
        ['General', ['sprint', 'tincture']],
      ];
      this.referenceDps = V.ref;
      this.referenceGcd = V.gcd || 2.45;
      this.startDistance = 3.2;
    }

    initGauge() { return { surpa: 0, flurryTicks: 0, flurryNext: 0, chan: null, chanSnap: null, wr: 0 }; }
    resolveId(id) { return id; }

    check(id, e) {
      if (e.has('waningNocturne') && id !== 'sprint') return 'Unable to act while under the effect of Waning Nocturne.';
      if (e.has('phantomFlurry') && id !== 'phantomFlurry') return 'Unable to act while channelling Phantom Flurry.';
      if (e.has('apokalypsis')) return 'Unable to act while channelling Apokalypsis.';
      if (id === 'mortalFlame' && !e.inCombat) return 'Unable to cast outside combat.';
      return null;
    }

    castTime(id, e) {
      const a = this.actions[id];
      if (!a.cast) return 0;
      if (e.has('swiftcast')) return 0;
      return e.speedScale(a.cast, 0);
    }
    consumeInstant(id, e) { if (this.actions[id].cast && e.has('swiftcast')) e.removeStatus('swiftcast'); }
    mpCost(id) { return this.actions[id].mp || 0; }
    mpRegen() { return B.BASE_REGEN; }
    lucidGain() { return 550; }
    noAutos(e) { return e.has('waningNocturne'); }

    snapshot(a, e) {
      let mult = 1;
      if (e.has('waxingNocturne')) mult *= 1.5;
      if (e.tHas('offGuard')) mult *= this.V.spells === 'cap50a' ? 1.5 : 1.05;
      if (e.tHas('peculiarLight') && a && !a.physical) mult *= this.V.spells === 'cap50a' ? 1.3 : 1.05;
      const main = this.stats.main + (e.has('medicated') ? Math.min(Math.floor(this.stats.main * 0.1), B.TINCTURES[this.V.tincture].cap) : 0);
      return { mult, main };
    }

    resolve(id, e) {
      const a = this.actions[id], g = e.g;
      if (a.mp) e.mp -= a.mp;
      // Surpanakha's Fury: only back-to-back Surpanakhas keep it.
      if (id !== 'surpanakha' && e.has('surpanakhasFury')) { e.removeStatus('surpanakhasFury'); g.surpa = 0; }
      switch (id) {
        case 'moonFlute': e.addStatus('waxingNocturne', 15); g.moonEnd = e.now + 15; return;
        // Boost and Harmonized don't stack: each replaces the other.
        case 'bristle': e.removeStatus('whistle'); e.addStatus('bristle', 30); return;
        case 'whistle': e.removeStatus('bristle'); e.addStatus('whistle', 30); return;
        case 'offGuard': e.addTStatus('offGuard', 15); return;
        case 'peculiarLight': e.addTStatus('peculiarLight', 15); return;
        case 'phantomFlurry': case 'apokalypsis': {
          if (e.has(id)) { e.removeStatus(id); g.flurryTicks = 0; e.queueHit(id, 600, g.chanSnap || this.snapshot(a, e), 0.3); return; }
          const flurry = id === 'phantomFlurry';
          g.chan = id; g.chanSnap = this.snapshot(a, e);
          e.addStatus(id, flurry ? 5 : 10); g.flurryTicks = flurry ? 5 : 10; g.flurryNext = e.now + 1;
          e.queueHit(id, a.potency, g.chanSnap, 0.3);
          return;
        }
        case 'wingedReprobation': {
          // The first three uses add a stack and hand the recast back; the fourth starts it.
          if (g.wr < 3) {
            g.wr++;
            const c = e.cds[a.cdGroup || id];
            if (c) { c.charges = c.max; c.nextAt = null; }
            e.addStatus('wingedReprobation', 1e9, { stacks: g.wr, permanent: true });
            this.hit(id, 300, e, a);
          } else {
            g.wr = 0;
            e.removeStatus('wingedReprobation');
            e.addStatus('wingedRedemption', 10);
            this.hit(id, 400, e, a);
          }
          return;
        }
        case 'convictionMarcato': this.hit(id, e.has('wingedRedemption') ? 440 : a.potency, e, a); return;
        case 'candyCane': e.mp = Math.min(e.maxMp, e.mp + 1000); break;
        case 'magicHammer': e.mp = Math.min(e.maxMp, e.mp + 1000); break;
        case 'tingle': e.addStatus('tingle', 15); break;
        default:
          if (B.ROLE_EFFECTS[id]) { B.ROLE_EFFECTS[id](e); return; }
      }
      if (!a.potency) { if (a.dot) this.hit(id, 0, e, a); return; }
      let potency = a.potency;
      if (id === 'goblinPunch' && e.positionalHit({ positional: 'front' })) potency = 220;     // its front bonus
      if (id === 'surpanakha') {
        potency = Math.round(potency * (1 + 0.5 * g.surpa));
        g.surpa = Math.min(3, g.surpa + 1);
        e.addStatus('surpanakhasFury', 3, { stacks: g.surpa });
      }
      this.hit(id, potency, e, a);
    }

    // Bristle (+50% next spell), Whistle (×1.8 next physical spell) and Tingle (+100 potency to it) go with the hit.
    hit(id, potency, e, a) {
      const snap = this.snapshot(a, e);
      if (e.has('bristle') && a.kind === 'gcd') { snap.mult *= 1.5; e.removeStatus('bristle'); }
      if (a.physical && e.has('whistle')) { snap.mult *= 1.8; e.removeStatus('whistle'); }
      if (a.physical && e.has('tingle') && id !== 'tingle') { potency += 100; e.removeStatus('tingle'); }
      const hits = a.hits || 1;
      // Song of Torment and Nightbloom put on the same Bleeding.
      const key = id === 'nightbloom' ? 'songOfTorment' : id;
      const apply = a.dot ? () => e.addTStatus(key, a.dot.duration, { snap, dot: { potency: a.dot.potency, id } }) : null;
      if (!potency) { if (apply) apply(); return; }
      for (let k = 0; k < hits; k++) e.queueHit(id, potency, snap, a.delay + k * 0.25, k === 0 ? apply : null);
    }

    nextEvent(e) {
      const g = e.g;
      let t = Infinity;
      if (g.moonEnd) t = Math.min(t, g.moonEnd);
      if (g.flurryTicks > 0) t = Math.min(t, g.flurryNext);
      return t;
    }
    process(e) {
      const g = e.g;
      if (g.moonEnd && e.now >= g.moonEnd - EPS) { g.moonEnd = 0; e.addStatus('waningNocturne', 15); }
      if (g.flurryTicks > 0 && e.now >= g.flurryNext - EPS) {
        g.flurryTicks--; g.flurryNext = e.now + 1;
        const id = g.chan || 'phantomFlurry', a = this.actions[id];
        e.queueHit(id, a.potency, g.chanSnap || this.snapshot(a, e), 0.1);
        if (!g.flurryTicks) e.removeStatus(id);
      }
    }

    proc(id, e) {
      if (id === 'convictionMarcato') return e.has('wingedRedemption');
      if (id === 'wingedReprobation') return e.g.wr > 0;
      return id === 'surpanakha' && e.has('surpanakhasFury');
    }
    speedInfo(e) { return `GCD ${e.gcdForSpeed(e.stats.speed).toFixed(2)} · 2.0s casts ${e.speedScale(2, 0).toFixed(2)}s · 10,000 MP`; }

    gaugeBuild(root) {
      root.innerHTML = `
<svg width="360" height="100" viewBox="0 0 360 100">
  <rect x="8" y="10" width="344" height="80" rx="14" fill="rgba(14,12,20,.86)" stroke="rgba(255,255,255,.22)"/>
  <text id="bl-l" x="24" y="38" font-family="Noto Sans, sans-serif" font-size="11" font-weight="600" fill="#a9a3b4" letter-spacing="1">MOON FLUTE</text>
  <rect x="24" y="52" width="250" height="14" rx="7" fill="#2a2535" stroke="rgba(0,0,0,.8)"/>
  <rect id="bl-b" x="24" y="52" width="0" height="14" rx="7" fill="#5aa0ff"/>
  <text id="bl-t" x="336" y="66" text-anchor="end" font-family="Saira Semi Condensed, sans-serif" font-size="18" font-weight="700" fill="#fff" stroke="#000" stroke-width="3" paint-order="stroke"></text>
</svg>`;
      const $ = (s) => root.querySelector(s);
      this.bg = { l: $('#bl-l'), b: $('#bl-b'), t: $('#bl-t'), cache: {} };
    }
    gaugeUpdate(e) {
      const G = this.bg, c = G.cache;
      const wax = e.has('waxingNocturne'), wan = e.has('waningNocturne');
      const s = wax ? e.statuses.waxingNocturne : wan ? e.statuses.waningNocturne : null;
      const left = s ? Math.max(0, s.until - e.now) : 0;
      const k = (wax ? 'x' : wan ? 'n' : '-') + Math.round(left * 4);
      if (c.k === k) return;
      c.k = k;
      G.l.textContent = wax ? 'MOON FLUTE · WAXING NOCTURNE (+50%)' : wan ? 'WANING NOCTURNE · NO ACTIONS' : 'MOON FLUTE';
      G.b.setAttribute('width', (250 * Math.min(1, left / 15)).toFixed(1));
      G.b.setAttribute('fill', wan ? '#ff8f6b' : '#5aa0ff');
      G.t.textContent = left ? Math.ceil(left) + 's' : '';
    }

    helpHtml(seq) {
      const V = this.V, A = this.actions;
      const op = (V.spells === 'cap80'
        ? ['whistle', 'tingle', 'theRoseOfDestruction', 'moonFlute', ['jKick'], 'tripleTrident', ['nightbloom'], 'wingedReprobation', ['featherRain'], ['seaShanty'],
          'wingedReprobation', ['shockStrike'], ['beingMortal'], 'bristle', ['swiftcast'], ['surpanakha'], ['surpanakha'], ['surpanakha'], ['surpanakha'], 'matraMagic', ['phantomFlurry']]
        : ['whistle', 'tingle', 'theRoseOfDestruction', 'moonFlute', ['jKick'], 'tripleTrident', ['nightbloom'], ['featherRain'], ['shockStrike'], 'bristle', ['glassDance'], 'matraMagic', ['surpanakha'], ['surpanakha'], ['surpanakha'], ['surpanakha'], 'phantomFlurry'])
        .filter(x => (Array.isArray(x) ? A[x[0]] : A[x]));
      return `
<h3>How it plays (${V.label})</h3>
<p>Level ${V.level} Blue Mage on a dummy, alone. The job is built around <b>Moon Flute</b>: +50% to everything for 15s, then 15s of <b>Waning Nocturne</b> in which you can do nothing. Before it, prepare: <b>Whistle</b> (next physical spell ×1.8), <b>Tingle</b> (+100 potency to it), <b>Bristle</b> (next spell +50%). Inside it, spend every cooldown${A.surpanakha ? ', with <b>Surpanakha</b>\'s four charges back to back (each +50% to the next)' : ''}${A.phantomFlurry ? ', and end on <b>Phantom Flurry</b> (200 a second while channelling)' : ''}.</p>
<p>Between bursts: <b>Song of Torment</b> (a 30s DoT)${A.sonicBoom ? ', <b>Sonic Boom</b> as the filler' : ', <b>Water Cannon</b> or Flame Thrower as the filler'}, and the oGCDs on cooldown. Basic Instinct only works in duties and Mimicry needs a partner, so a dummy has neither.</p>
<h3>A burst (reconstructed)</h3>
${seq(op)}
<p>${V.spells === 'cap80' ? 'Blue Academy\'s Winged Reprobation opener: Whistle and Tingle before the pull, the potion at −10s. Between bursts, spend the last two Winged Reprobations (each after Whistle and Tingle) so its recast is back for the next opener, keep Bleeding, Breath of Magic (every minute, after Bristle) and Mortal Flame (once) ticking, and fill with Sonic Boom. Apokalypsis (a 10s channel) is the alternative to Being Mortal.' : `From Blue Academy's Moon Flute opener with the spells this cap doesn't have removed; the cap-${V.level} order isn't archived. Potion at −10s.`}</p>
<p style="color:#a9a3b4">Numbers are the game data at this cap's patches; Blue Mage's trait is +50%. Gear: ${V.gear}. Blue Mage weapon damage comes from an Intelligence breakpoint table; the value here is ${V.level === 70 ? 'the Endwalker table\'s' : 'an estimate from a same-level caster weapon'}.</p>`;
    }
  }

  B.registerJob({
    id: 'blu', name: 'Blue Mage', abbr: 'BLU', role: 'caster', classJob: 36,
    versions: ['cap80', 'cap70', 'cap60', 'cap50'].map(v => ({ id: v, label: VERSIONS[v].label, history: VERSIONS[v].history, note: VERSIONS[v].note, create: () => new BlueMage(v) })),
  });
})(window.BLM);
