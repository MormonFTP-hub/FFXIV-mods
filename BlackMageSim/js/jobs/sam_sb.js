// Samurai, Stormblood (patches 4.0–4.58) at level 70. Built on the Endwalker 6.08 class (sam_ew.js) with what
// played differently before 5.0: weaponskills cost TP (Invigorate refills it), Jinpu and Shifu give 10% for 30s,
// Yukikaze's combo puts Slashing Resistance Down (+10%) on the target, positionals add Kenki instead of potency,
// Iaijutsu has a 1.8s cast, Hissatsu: Kaiten has a 5s recast, Guren costs 50 Kenki, Hagakure turns each Sen into 20
// Kenki, Meikyo Shisui is three free combo steps over 10s on an 80s recast, Meditate is an ability, and there's no
// Tsubame-gaeshi, Shoha, Senei or Ogi Namikiri. Numbers are the final 4.5x values: the FFXIV wiki's pre-5.0 page
// revisions and its patch histories (4.3 and 4.4 raised the combo potencies), and the game's item data for the
// Omega blade.
(function (B) {
  const EW = B.SamuraiEW608;

  const ws = (o) => Object.assign({ kind: 'gcd', target: true, range: B.MELEE_RANGE, delay: 0.45 }, o);
  const FALLOFF = [1, 0.9, 0.8, 0.7, 0.6, 0.5];          // "10% less for the second ... 50% less for all remaining"
  const ACTIONS = {
    hakaze: ws({
      name: 'Hakaze', potency: 150, tp: 60, comboStart: true, comboNext: true, kenki: 5, fx: 'slash',
      desc: 'Delivers an attack with a potency of 150.\nAdditional Effect: Increases Kenki Gauge by 5',
    }),
    jinpu: ws({
      name: 'Jinpu', potency: 100, comboPotency: 300, comboFrom: 'hakaze', comboNext: true, tp: 60, kenki: 5, fx: 'slash2',
      desc: 'Delivers an attack with a potency of 100.\nCombo Action: Hakaze\nCombo Potency: 300\nCombo Bonus: Increases damage dealt by 10%\nDuration: 30s\nCombo Bonus: Increases Kenki Gauge by 5',
    }),
    shifu: ws({
      name: 'Shifu', potency: 100, comboPotency: 300, comboFrom: 'hakaze', comboNext: true, tp: 60, kenki: 5, fx: 'slash2',
      desc: 'Delivers an attack with a potency of 100.\nCombo Action: Hakaze\nCombo Potency: 300\nCombo Bonus: Reduces weaponskill cast time and recast time, spell cast time and recast time, and auto-attack delay by 10%\nDuration: 30s\nCombo Bonus: Increases Kenki Gauge by 5',
    }),
    gekko: ws({
      name: 'Gekko', potency: 100, comboPotency: 440, comboFrom: 'jinpu', positional: 'rear', tp: 50, kenki: 5, sen: 'getsu', fx: 'slash3',
      desc: 'Delivers an attack with a potency of 100.\nCombo Action: Jinpu\nCombo Potency: 440\nCombo Bonus: Increases Kenki Gauge by 5\nRear Combo Bonus: Increases Kenki Gauge by 10\nCombo Bonus: Grants Getsu',
    }),
    kasha: ws({
      name: 'Kasha', potency: 100, comboPotency: 440, comboFrom: 'shifu', positional: 'flank', tp: 50, kenki: 5, sen: 'ka', fx: 'slashFire',
      desc: 'Delivers an attack with a potency of 100.\nCombo Action: Shifu\nCombo Potency: 440\nCombo Bonus: Increases Kenki Gauge by 5\nSide Combo Bonus: Increases Kenki Gauge by 10\nCombo Bonus: Grants Ka',
    }),
    yukikaze: ws({
      name: 'Yukikaze', potency: 100, comboPotency: 380, comboFrom: 'hakaze', tp: 50, kenki: 10, sen: 'setsu', fx: 'slashIce',
      desc: 'Delivers an attack with a potency of 100.\nCombo Action: Hakaze\nCombo Potency: 380\nCombo Bonus: Reduces target\'s slashing resistance by 10%\nDuration: 30s\nCombo Bonus: Increases Kenki Gauge by 10\nCombo Bonus: Grants Setsu',
    }),
    enpi: ws({
      name: 'Enpi', potency: 100, enhancedPotency: 320, tp: 160, kenki: 10, range: 15, breaksCombo: true, delay: 0.7, fx: 'enpi',
      desc: 'Delivers a ranged attack with a potency of 100.\nEnhanced Enpi Bonus Potency: 320\nAdditional Effect: Increases Kenki Gauge by 10',
    }),
    fuga: ws({
      name: 'Fuga', potency: 100, tp: 140, comboStart: true, comboNext: true, kenki: 5, range: 6, aoe: true, fx: 'slash',
      desc: 'Delivers an attack with a potency of 100 to all enemies in a cone before you.\nAdditional Effect: Increases Kenki Gauge by 5',
    }),
    mangetsu: ws({
      name: 'Mangetsu', potency: 100, comboPotency: 200, comboFrom: 'fuga', tp: 140, kenki: 10, sen: 'getsu', target: false, pbaoe: 5,
      aoe: FALLOFF, comboAoe: [1, 0.95, 0.9, 0.85, 0.8, 0.75], fx: 'slash3',
      desc: 'Delivers an attack to all nearby enemies with a potency of 100 for the first enemy, 10% less for the second, 20% less for the third, 30% less for the fourth, 40% less for the fifth, and 50% less for all remaining enemies.\nCombo Action: Fuga\nCombo Potency: 200 for the first enemy, 5% less for the second, 10% less for the third, 15% less for the fourth, 20% less for the fifth, and 25% less for all remaining enemies.\nCombo Bonus: Increases Kenki Gauge by 10\nCombo Bonus: Grants Getsu',
    }),
    oka: ws({
      name: 'Oka', potency: 100, comboPotency: 200, comboFrom: 'fuga', tp: 140, kenki: 10, sen: 'ka', target: false, pbaoe: 5,
      aoe: FALLOFF, comboAoe: [1, 0.95, 0.9, 0.85, 0.8, 0.75], fx: 'slashFire',
      desc: 'Delivers an attack to nearby enemies with a potency of 100 for the first enemy, 10% less for the second, 20% less for the third, 30% less for the fourth, 40% less for the fifth, and 50% less for all remaining enemies.\nCombo Action: Fuga\nCombo Potency: 200 for the first enemy, 5% less for the second, 10% less for the third, 15% less for the fourth, 20% less for the fifth, and 25% less for all remaining enemies.\nCombo Bonus: Increases Kenki Gauge by 10\nCombo Bonus: Grants Ka',
    }),
    iaijutsu: ws({
      name: 'Iaijutsu', cast: 1.8, school: 'iai', range: 6,
      desc: 'Executes a weaponskill determined by the number of Sen stored in the Sen Gauge.\n1 Sen: Higanbana\n2 Sen: Tenka Goken\n3 Sen: Midare Setsugekka',
    }),
    higanbana: ws({
      name: 'Higanbana', potency: 240, cast: 1.8, school: 'iai', range: 6, delay: 0.6, iai: 1, dot: { potency: 35, duration: 60 }, fx: 'higanbana',
      desc: 'Delivers an attack with a potency of 240.\nAdditional Effect: Damage over time\nPotency: 35\nDuration: 60s\nCan only be executed when under the effect of one of the following: Setsu, Getsu, or Ka.',
    }),
    tenkaGoken: ws({
      name: 'Tenka Goken', potency: 360, cast: 1.8, school: 'iai', range: 8, delay: 0.6, iai: 2, aoe: FALLOFF, fx: 'tenka',
      desc: 'Delivers an attack to all enemies in a cone before you with a potency of 360 for the first enemy, 10% less for the second, 20% less for the third, 30% less for the fourth, 40% less for the fifth, and 50% less for all remaining enemies.\nCan only be executed when under the effect of two of the following: Setsu, Getsu, or Ka.',
    }),
    midareSetsugekka: ws({
      name: 'Midare Setsugekka', potency: 720, cast: 1.8, school: 'iai', range: 6, delay: 0.6, iai: 3, fx: 'midare',
      desc: 'Delivers an attack with a potency of 720.\nCan only be executed when under the effect of Setsu, Getsu, and Ka.',
    }),
    shinten: {
      name: 'Hissatsu: Shinten', kind: 'ogcd', recast: 1, potency: 300, kenkiCost: 25, target: true, range: B.MELEE_RANGE, delay: 0.5, fx: 'shinten',
      desc: 'Delivers an attack with a potency of 300.\nKenki Gauge Cost: 25',
    },
    kyuten: {
      name: 'Hissatsu: Kyuten', kind: 'ogcd', recast: 1, potency: 150, kenkiCost: 25, pbaoe: 5, aoe: true, delay: 0.5, fx: 'shinten',
      desc: 'Delivers an attack with a potency of 150 to all nearby enemies.\nKenki Gauge Cost: 25',
    },
    gyoten: {
      name: 'Hissatsu: Gyoten', kind: 'ogcd', recast: 10, potency: 100, kenkiCost: 10, target: true, range: 20, delay: 0.3, fx: 'shinten',
      desc: 'Rushes target and delivers an attack with a potency of 100.\nKenki Gauge Cost: 10\nCannot be executed while bound.',
    },
    yaten: {
      name: 'Hissatsu: Yaten', kind: 'ogcd', recast: 10, potency: 100, kenkiCost: 10, target: true, range: 5, delay: 0.3, fx: 'shinten',
      desc: 'Delivers an attack with a potency of 100.\nAdditional Effect: 10-yalm backstep\nAdditional Effect: Grants Enhanced Enpi\nDuration: 15s\nKenki Gauge Cost: 10\nCannot be executed while bound.',
    },
    kaiten: {
      name: 'Hissatsu: Kaiten', kind: 'ogcd', recast: 5, kenkiCost: 20,
      desc: 'Increases potency of next weaponskill by 50%.\nDuration: 10s\nKenki Gauge Cost: 20',
    },
    guren: {
      name: 'Hissatsu: Guren', kind: 'ogcd', recast: 120, potency: 800, kenkiCost: 50, target: true, range: 10, delay: 0.6, aoe: [1, 0.75, 0.5], fx: 'senei',
      desc: 'Delivers an attack to all enemies in a straight line before you with a potency of 800 for the first enemy, 25% less for the second, and 50% less for all remaining enemies.\nKenki Gauge Cost: 50',
    },
    ikishoten: {
      name: 'Ikishoten', kind: 'ogcd', recast: 60,
      desc: 'Increases Kenki Gauge by 50.\nCan only be executed while in combat.',
    },
    meikyoShisui: {
      name: 'Meikyo Shisui', kind: 'ogcd', recast: 80,
      desc: 'Execute up to 3 weaponskill combos without meeting combo prerequisites. Does not affect Iaijutsu.\nDuration: 10s',
    },
    hagakure: {
      name: 'Hagakure', kind: 'ogcd', recast: 40,
      desc: 'Converts Setsu, Getsu, and Ka into Kenki. Each Sen converted increases your Kenki Gauge by 20.\nCan only be executed if under the effect of at least one of the three statuses.',
    },
    meditate: {
      name: 'Meditate', kind: 'ogcd', recast: 60, fx: 'meditate',
      desc: 'Gradually increases your Kenki Gauge.\nDuration: 15s\nCan only be executed while in combat.\nEffect ends upon using another action or moving (including facing a different direction).\nCancels auto-attack upon execution.',
    },
    thirdEye: {
      name: 'Third Eye', kind: 'ogcd', recast: 15,
      desc: 'Reduces the amount of damage taken by the next attack by 10%.\nDuration: 3s\nAdditional Effect: Grants Open Eyes upon taking damage\nDuration: 15s',
    },
    // The melee role actions of 4.5 (five of the ten could be slotted in Stormblood; these are the usual damage ones).
    trueNorth: { name: 'True North', kind: 'ogcd', recast: 90, role: true, desc: 'Nullifies all action direction requirements.\nDuration: 15s' },
    invigorate: { name: 'Invigorate', kind: 'ogcd', recast: 120, role: true, desc: 'Instantly restores 400 TP.' },
    feint: { name: 'Feint', kind: 'ogcd', recast: 120, role: true, target: true, range: 10, desc: 'Lowers target\'s strength and dexterity by 10%.\nDuration: 10s' },
    bloodbath: { name: 'Bloodbath', kind: 'ogcd', recast: 90, role: true, desc: 'Converts a portion of physical damage dealt into HP.\nDuration: 20s' },
    secondWind: { name: 'Second Wind', kind: 'ogcd', recast: 120, role: true, desc: 'Instantly restores own HP.\nCure Potency: 500' },
    armsLength: { name: 'Arm\'s Length', kind: 'ogcd', recast: 60, role: true, desc: 'Creates a barrier nullifying knockback and draw-in effects.\nDuration: 5s\nAdditional Effect: Slow +20% when barrier is struck\nDuration: 15s' },
    legSweep: { name: 'Leg Sweep', kind: 'ogcd', recast: 40, role: true, target: true, range: 3, desc: 'Stuns target.\nDuration: 3s' },
    ...B.GENERAL_ACTIONS,
    tincture: B.tincture('str3sb'),
    auto: { name: 'Attack', kind: 'auto', fx: 'auto', desc: 'Auto-attack.' },
  };

  class SamuraiSB extends EW {
    constructor() {
      super();
      this.level = 70;
      this.levelKey = 'sb70';
      this.model = 'sam-sb';
      this.actions = ACTIONS;
      this.statuses = Object.assign({}, this.statuses, {
        fugetsu: { name: 'Jinpu', self: true, icon: 'st_fugetsu' },
        fuka: { name: 'Shifu', self: true, icon: 'st_fuka' },
        slashingResDown: { name: 'Slashing Resistance Down', self: false, icon: 'st_slashing' },
      });
      this.buff = { fugetsu: 1.10, fuka: 10, dur: 30 };
      this.positionalBonus = 0;
      this.positionalKenki = 5;
      this.meikyoBuffs = false;
      this.aoeBuffs = false;
      this.meditationStacks = false;
      this.tinctureKey = 'str3sb';
      this.comboTime = 15;
      this.tp = { max: 1000, regen: 60 };
      this.tierHaste = 10;
      // A rough 4.5 Alphascape set (item level 400–405, the Omega blade: 109 weapon damage, 2.64 delay in the 4.58 item data) at the
      // 2.18 GCD with Shifu; level-70 stats.
      this.stats = { hp: 31000, main: 3280, mainStat: 'str', jobMod: 112, trait: 100, wd: 109, det: 1600, crit: 2700,
        dh: 1900, speed: 900, delay: 2.64 };
      this.autoAttack = { potency: 110, delay: 2.64, range: B.MELEE_RANGE };
      this.selfStatusOrder = ['fugetsu', 'fuka', 'meikyoShisui', 'kaiten', 'enhancedEnpi', 'meditate', 'trueNorth', 'thirdEye',
        'medicated', 'bloodbath', 'armsLength', 'sprint'];
      this.targetStatusOrder = ['higanbana', 'slashingResDown', 'feint'];
      this.defaultBars = [
        ['hakaze', 'jinpu', 'gekko', 'shifu', 'kasha', 'yukikaze', 'iaijutsu', 'enpi', 'hagakure', 'kaiten', 'shinten', 'meikyoShisui'],
        ['ikishoten', 'guren', 'gyoten', 'yaten', 'meditate', 'thirdEye', 'trueNorth', 'tincture', 'invigorate', 'feint', 'bloodbath', 'secondWind'],
        ['fuga', 'mangetsu', 'oka', 'kyuten', 'legSweep', 'armsLength', 'sprint', null, null, null, null, null],
      ];
      this.actionGroups = [
        ['Samurai', ['hakaze', 'jinpu', 'shifu', 'gekko', 'kasha', 'yukikaze', 'enpi', 'fuga', 'mangetsu', 'oka', 'iaijutsu', 'higanbana',
          'tenkaGoken', 'midareSetsugekka', 'kaiten', 'shinten', 'kyuten', 'gyoten', 'yaten', 'guren', 'hagakure', 'meikyoShisui',
          'ikishoten', 'meditate', 'thirdEye']],
        ['Role Actions', ['trueNorth', 'invigorate', 'feint', 'bloodbath', 'secondWind', 'armsLength', 'legSweep']],
        ['General', ['sprint', 'tincture']],
      ];
      this.referenceDps = 8350;     // a scripted 4.5x rotation at 2.17 parses about 7,850 on the dummy
      this.referenceGcd = 2.18;
      this.startDistance = 3.2;
    }

    initGauge() { return Object.assign(super.initGauge(), { meditation: 0 }); }

    // No Tsubame-gaeshi or Ogi Namikiri: only Iaijutsu changes with the Sen you hold.
    resolveId(id, e) { return id === 'iaijutsu' ? super.resolveId(id, e) : id; }

    // Yukikaze's slashing debuff: everything a Samurai does is slashing.
    targetMult(e) { return e.tHas('slashingResDown') ? 1.10 : 1; }
    comboBonus(id, e) { if (id === 'yukikaze') e.addTStatus('slashingResDown', 30); }

    check(id, e) {
      if ((id === 'meditate' || id === 'ikishoten') && !e.inCombat) return 'Unable to execute action while not in combat.';
      return super.check(id, e);
    }

    ability(id, e) {
      const g = e.g;
      switch (id) {
        case 'meikyoShisui':
          e.addStatus('meikyoShisui', 10, { stacks: 3 });
          return;
        case 'hagakure':
          this.addKenki(e, 20 * this.senCount(e));
          g.sen = { setsu: false, getsu: false, ka: false };
          e.emit('sen', {});
          return;
        case 'ikishoten': this.addKenki(e, 50); return;
        case 'meditate':
          e.addStatus('meditate', 15);
          g.medNext = e.now + 3;
          return;
        case 'trueNorth': e.addStatus('trueNorth', 15); return;
        case 'invigorate': B.ROLE_EFFECTS.invigorate(e); return;
      }
      super.ability(id, e);
    }

    speedInfo(e) {
      return `GCD ${e.gcdForSpeed(e.stats.speed).toFixed(2)} without Shifu · ${e.gcdForSpeed(e.stats.speed, 10).toFixed(2)} with · Iaijutsu ${e.speedScale(1.8, 10).toFixed(2)}s cast with Shifu`;
    }

    helpHtml(seq) {
      return `
<h3>How it plays (Stormblood 4.0–4.58)</h3>
<p>Level 70 Samurai. Build Sen with the three combos and spend them with Iaijutsu: one Sen is Higanbana, two Tenka Goken, three Midare Setsugekka. Iaijutsu has a <b>1.8s</b> cast here, so slidecast it. There's no Tsubame-gaeshi, Shoha or Senei yet.</p>
<p>Weaponskills cost <b>TP</b> (shown where MP would be): Hakaze, Jinpu and Shifu 60, Gekko, Kasha and Yukikaze 50, Fuga, Mangetsu and Oka 140. TP comes back 60 every 3s, and <b>Invigorate</b> (120s) gives 400 when you run low.</p>
<p>Keep three things up: <b>Jinpu</b> (+10% damage) and <b>Shifu</b> (10% haste), 30s each, and Yukikaze's <b>Slashing Resistance Down</b> on the dummy (+10%, 30s). Gekko (rear) and Kasha (flank) give 5 more Kenki from the right side instead of more potency. Kenki goes to <b>Hissatsu: Kaiten</b> (20, +50% to the next weaponskill, 5s recast) before Midare and Higanbana, <b>Guren</b> (50, 120s), and <b>Shinten</b> (25) to avoid overcapping. <b>Hagakure</b> turns leftover Sen into 20 Kenki each, and <b>Ikishoten</b> gives 50 every 60s.</p>
<p>AoE: Fuga, then Mangetsu (Getsu) or Oka (Ka); Tenka Goken with two Sen; Kyuten for Kenki. Set Dummies to 3 or 5 in Settings to practise it.</p>
<h3>Standard loop</h3>
${seq(['hakaze', 'yukikaze', 'hakaze', 'jinpu', 'gekko', 'hakaze', 'shifu', 'kasha', ['kaiten'], 'midareSetsugekka'])}
<h3>An opener for this version</h3>
${seq(['hakaze', 'shifu', 'kasha', ['tincture'], 'hakaze', 'jinpu', 'gekko', ['kaiten'], 'higanbana', ['meikyoShisui'], 'yukikaze', ['ikishoten'], 'gekko', ['guren'], 'kasha', ['kaiten'], 'midareSetsugekka', 'hakaze', ['shinten'], 'yukikaze'])}
<p>This follows the 2017 Samurai guide's opener (Shifu first, Kaiten Higanbana, then Meikyo into Midare with Guren inside), with a tincture added. Higanbana is a 60s DoT: refresh it with a Kaiten after about 57s.</p>
<p style="color:#a9a3b4">The 4.5x numbers: Hakaze 150; Jinpu and Shifu combo 300; Gekko and Kasha combo 440; Yukikaze combo 380; Higanbana 240 + 35 per tick for 60s; Tenka Goken 360; Midare 720; Shinten 300; Guren 800; Kyuten 150; Enpi 100 (320 Enhanced). Auto-attacks 110 potency at 2.64s. TP costs and the 15s combo window are from memory of the era; gear stats are approximate.</p>`;
    }
  }

  B.registerJob({
    id: 'sam', name: 'Samurai', abbr: 'SAM', role: 'melee', classJob: 34,
    versions: [{ id: 'sb40', label: 'Stormblood 4.0–4.58', history: 'SB 4.0–4.58', note: 'Level 70. TP, Kaiten on a 5s recast, Jinpu/Shifu 10%, Yukikaze\'s slashing debuff, Kenki from positionals, no Tsubame-gaeshi', create: () => new SamuraiSB() }],
  });
})(window.BLM);
