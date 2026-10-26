// Samurai, Endwalker patch 6.0x (last patched 6.08) at level 90: the kit with Hissatsu: Kaiten, before the 6.1
// rework removed it. Numbers from the FFXIV wiki's patch histories and the 6.1 patch notes (what 6.1 changed
// from), checked against 6.05 openers. Kaiten adds 50% to the next weaponskill, including Higanbana's DoT;
// the Kaeshi follow-ups are abilities in game, so it doesn't reach them.
(function (B) {
  const EPS = 1e-6;
  const KENKI_MAX = 100;
  const MED_MAX = 3;
  const FUGETSU = 1.13;          // +13% damage dealt
  const FUKA = 13;               // 13% haste: weaponskills, Iaijutsu casts and auto-attacks
  const KAITEN = 1.5;
  const POSITIONAL = 50;
  const IAI = ['higanbana', 'tenkaGoken', 'midareSetsugekka'];
  const KAESHI = { higanbana: 'kaeshiHiganbana', tenkaGoken: 'kaeshiGoken', midareSetsugekka: 'kaeshiSetsugekka' };

  const ws = (o) => Object.assign({ kind: 'gcd', target: true, range: B.MELEE_RANGE, delay: 0.45 }, o);
  const ACTIONS = {
    hakaze: ws({
      name: 'Hakaze', potency: 180, comboStart: true, comboNext: true, kenki: 5, fx: 'slash',
      desc: 'Delivers an attack with a potency of 180.\nAdditional Effect: Increases Kenki Gauge by 5',
    }),
    jinpu: ws({
      name: 'Jinpu', potency: 100, comboPotency: 280, comboFrom: 'hakaze', comboNext: true, kenki: 5, fx: 'slash2',
      desc: 'Delivers an attack with a potency of 100.\nCombo Action: Hakaze\nCombo Potency: 280\nCombo Bonus: Grants Fugetsu\nFugetsu Effect: Increases damage dealt by 13%\nDuration: 40s\nCombo Bonus: Increases Kenki Gauge by 5',
    }),
    shifu: ws({
      name: 'Shifu', potency: 100, comboPotency: 280, comboFrom: 'hakaze', comboNext: true, kenki: 5, fx: 'slash2',
      desc: 'Delivers an attack with a potency of 100.\nCombo Action: Hakaze\nCombo Potency: 280\nCombo Bonus: Grants Fuka\nFuka Effect: Reduces weaponskill cast time and recast time, spell cast time and recast time, and auto-attack delay by 13%\nDuration: 40s\nCombo Bonus: Increases Kenki Gauge by 5',
    }),
    gekko: ws({
      name: 'Gekko', potency: 100, comboPotency: 320, comboFrom: 'jinpu', positional: 'rear', kenki: 10, sen: 'getsu', fx: 'slash3',
      desc: 'Delivers an attack with a potency of 100.\n150 when executed from a target\'s rear.\nCombo Action: Jinpu\nCombo Potency: 320\nRear Combo Potency: 370\nCombo Bonus: Increases Kenki Gauge by 10\nCombo Bonus: Grants Getsu\nMeikyo Shisui Bonus: Grants Fugetsu',
    }),
    kasha: ws({
      name: 'Kasha', potency: 100, comboPotency: 320, comboFrom: 'shifu', positional: 'flank', kenki: 10, sen: 'ka', fx: 'slashFire',
      desc: 'Delivers an attack with a potency of 100.\n150 when executed from a target\'s flank.\nCombo Action: Shifu\nCombo Potency: 320\nFlank Combo Potency: 370\nCombo Bonus: Increases Kenki Gauge by 10\nCombo Bonus: Grants Ka\nMeikyo Shisui Bonus: Grants Fuka',
    }),
    yukikaze: ws({
      name: 'Yukikaze', potency: 100, comboPotency: 280, comboFrom: 'hakaze', kenki: 15, sen: 'setsu', fx: 'slashIce',
      desc: 'Delivers an attack with a potency of 100.\nCombo Action: Hakaze\nCombo Potency: 280\nCombo Bonus: Increases Kenki Gauge by 15\nCombo Bonus: Grants Setsu',
    }),
    enpi: ws({
      name: 'Enpi', potency: 100, enhancedPotency: 260, kenki: 10, range: 20, breaksCombo: true, delay: 0.7, fx: 'enpi',
      desc: 'Delivers a ranged attack with a potency of 100.\nEnhanced Enpi Bonus Potency: 260\nAdditional Effect: Increases Kenki Gauge by 10',
    }),
    iaijutsu: ws({
      name: 'Iaijutsu', cast: 1.3, school: 'iai', range: 6,
      desc: 'Executes a weaponskill determined by the number of Sen stored in the Sen Gauge.\n1 Sen: Higanbana\n2 Sen: Tenka Goken\n3 Sen: Midare Setsugekka',
    }),
    higanbana: ws({
      name: 'Higanbana', potency: 200, cast: 1.3, school: 'iai', range: 6, delay: 0.6, iai: 1, dot: { potency: 30, duration: 60 }, fx: 'higanbana',
      desc: 'Delivers an attack with a potency of 200.\nAdditional Effect: Damage over time\nPotency: 30\nDuration: 60s\nAdditional Effect: Grants a stack of Meditation\nCan only be executed when under the effect of one of the following: Setsu, Getsu, or Ka.',
    }),
    tenkaGoken: ws({
      name: 'Tenka Goken', potency: 280, cast: 1.3, school: 'iai', range: 6, delay: 0.6, iai: 2, fx: 'tenka',
      desc: 'Delivers an attack to all enemies in a cone before you with a potency of 280.\nAdditional Effect: Grants a stack of Meditation\nCan only be executed when under the effect of two of the following: Setsu, Getsu, or Ka.',
    }),
    midareSetsugekka: ws({
      name: 'Midare Setsugekka', potency: 660, cast: 1.3, school: 'iai', range: 6, delay: 0.6, iai: 3, fx: 'midare',
      desc: 'Delivers an attack with a potency of 660.\nAdditional Effect: Grants a stack of Meditation\nCan only be executed when under the effect of Setsu, Getsu, and Ka.',
    }),
    tsubameGaeshi: ws({
      name: 'Tsubame-gaeshi', cd: 60, charges: 2, cdGroup: 'tsubame', range: 6,
      desc: 'Repeats the previously executed iaijutsu with increased potency.\nCan only be executed immediately following Iaijutsu.\nShares a recast timer with all weaponskills.\nMaximum Charges: 2',
    }),
    kaeshiHiganbana: ws({
      name: 'Kaeshi: Higanbana', potency: 300, cd: 60, charges: 2, cdGroup: 'tsubame', range: 6, noKaiten: true, delay: 0.6,
      dot: { potency: 45, duration: 60 }, fx: 'higanbana',
      desc: 'Delivers an attack with a potency of 300.\nAdditional Effect: Damage over time\nPotency: 45\nDuration: 60s\nCan only be executed immediately following Higanbana.',
    }),
    kaeshiGoken: ws({
      name: 'Kaeshi: Goken', potency: 420, cd: 60, charges: 2, cdGroup: 'tsubame', range: 6, noKaiten: true, delay: 0.6, fx: 'tenka',
      desc: 'Delivers an attack to all enemies in a cone before you with a potency of 420.\nCan only be executed immediately following Tenka Goken.',
    }),
    kaeshiSetsugekka: ws({
      name: 'Kaeshi: Setsugekka', potency: 990, cd: 60, charges: 2, cdGroup: 'tsubame', range: 6, noKaiten: true, delay: 0.6, fx: 'midare',
      desc: 'Delivers an attack with a potency of 990.\nCan only be executed immediately following Midare Setsugekka.',
    }),
    ogiNamikiri: ws({
      name: 'Ogi Namikiri', potency: 900, cast: 1.3, school: 'iai', range: 8, delay: 0.7, fx: 'ogi',
      desc: 'Delivers an attack to all enemies in a cone before you with a potency of 900 for the first enemy, and 75% less for all remaining enemies.\nAdditional Effect: Grants a stack of Meditation\nCan only be executed while under the effect of Ogi Namikiri Ready.',
    }),
    kaeshiNamikiri: ws({
      name: 'Kaeshi: Namikiri', potency: 1350, range: 8, noKaiten: true, delay: 0.7, fx: 'ogi',
      desc: 'Delivers an attack to all enemies in a cone before you with a potency of 1,350 for the first enemy, and 75% less for all remaining enemies.\nCan only be executed immediately following Ogi Namikiri.',
    }),
    meditate: {
      name: 'Meditate', kind: 'gcd', cd: 60, fx: 'meditate',
      desc: 'Gradually increases your Kenki Gauge and grants a stack of Meditation every 3 seconds.\nDuration: 15s\nKenki Gauge Increase: 10\nEffect ends upon using another action or moving (including facing a different direction).\nTriggers the cooldown of weaponskills upon execution.',
    },
    shinten: {
      name: 'Hissatsu: Shinten', kind: 'ogcd', recast: 1, potency: 270, kenkiCost: 25, target: true, range: B.MELEE_RANGE, delay: 0.5, fx: 'shinten',
      desc: 'Delivers an attack with a potency of 270.\nKenki Gauge Cost: 25',
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
      name: 'Hissatsu: Kaiten', kind: 'ogcd', recast: 1, kenkiCost: 20,
      desc: 'Increases potency of next weaponskill by 50%.\nDuration: 10s\nKenki Gauge Cost: 20',
    },
    senei: {
      name: 'Hissatsu: Senei', kind: 'ogcd', recast: 120, cdGroup: 'senei', potency: 800, kenkiCost: 25, target: true, range: B.MELEE_RANGE, delay: 0.6, fx: 'senei',
      desc: 'Delivers an attack with a potency of 800.\nKenki Gauge Cost: 25\nShares a recast timer with Hissatsu: Guren.',
    },
    guren: {
      name: 'Hissatsu: Guren', kind: 'ogcd', recast: 120, cdGroup: 'senei', potency: 500, kenkiCost: 25, target: true, range: 10, delay: 0.6, fx: 'senei',
      desc: 'Delivers an attack to all enemies in a straight line before you with a potency of 500 for the first enemy, and 50% less for all remaining enemies.\nKenki Gauge Cost: 25\nShares a recast timer with Hissatsu: Senei.',
    },
    shoha: {
      name: 'Shoha', kind: 'ogcd', recast: 15, potency: 580, target: true, range: B.MELEE_RANGE, delay: 0.6, fx: 'shoha',
      desc: 'Delivers an attack with a potency of 580.\nCan only be executed when Meditation is fully stacked.',
    },
    ikishoten: {
      name: 'Ikishoten', kind: 'ogcd', recast: 120,
      desc: 'Increases Kenki Gauge by 50.\nAdditional Effect: Grants Ogi Namikiri Ready\nDuration: 30s\nCan only be executed while in combat.',
    },
    meikyoShisui: {
      name: 'Meikyo Shisui', kind: 'ogcd', recast: 55, charges: 2,
      desc: 'Execute up to 3 weaponskill combos without meeting combo prerequisites. Does not affect Iaijutsu.\nDuration: 15s\nMeikyo Shisui Effect: Grants Fugetsu when Gekko is executed, and Fuka when Kasha is executed.\nMaximum Charges: 2',
    },
    hagakure: {
      name: 'Hagakure', kind: 'ogcd', recast: 5,
      desc: 'Converts Setsu, Getsu, and Ka into Kenki. Each Sen converted increases your Kenki Gauge by 10.\nCan only be executed if under the effect of at least one of the three statuses.',
    },
    thirdEye: {
      name: 'Third Eye', kind: 'ogcd', recast: 15,
      desc: 'Reduces the amount of damage taken by the next attack by 10%.\nDuration: 3s\nAdditional Effect: Increases Kenki Gauge by 10 when hit',
    },
    ...B.ROLE_ACTIONS.melee,
    ...B.GENERAL_ACTIONS,
    tincture: B.tincture('str6'),
    auto: { name: 'Attack', kind: 'auto', fx: 'auto', desc: 'Auto-attack.' },
  };

  const STATUSES = {
    fugetsu: { name: 'Fugetsu', self: true, icon: 'st_fugetsu' },
    fuka: { name: 'Fuka', self: true, icon: 'st_fuka' },
    meikyoShisui: { name: 'Meikyo Shisui', self: true, icon: 'st_meikyo' },
    kaiten: { name: 'Kaiten', self: true, icon: 'st_kaiten' },
    ogiNamikiriReady: { name: 'Ogi Namikiri Ready', self: true, icon: 'st_ogi' },
    enhancedEnpi: { name: 'Enhanced Enpi', self: true, icon: 'st_enpi' },
    meditate: { name: 'Meditate', self: true, icon: 'st_meditate' },
    thirdEye: { name: 'Third Eye', self: true, icon: 'st_thirdeye' },
    higanbana: { name: 'Higanbana', self: false, icon: 'st_higanbana' },
  };

  class SamuraiEW608 {
    constructor() {
      this.name = 'Samurai';
      this.abbr = 'SAM';
      this.role = 'melee';
      this.actions = ACTIONS;
      this.statuses = STATUSES;
      // 6.0x 2.14 Savage best-in-slot (i600, Asphodelos blade); skill speed is typed in Settings.
      this.stats = { hp: 64000, main: 2563, mainStat: 'str', jobMod: 112, trait: 100, wd: 120, det: 1654, crit: 2310,
        dh: 1217, speed: 579, delay: 2.64 };
      this.speedName = 'Skill speed';
      this.tierHaste = FUKA;         // Samurai GCD tiers are quoted with Fuka up (2.14)
      this.autoAttack = { potency: 90, delay: 2.64, range: B.MELEE_RANGE };
      this.selfStatusOrder = ['fugetsu', 'fuka', 'meikyoShisui', 'kaiten', 'ogiNamikiriReady', 'enhancedEnpi', 'meditate',
        'trueNorth', 'thirdEye', 'medicated', 'bloodbath', 'armsLength', 'sprint'];
      this.targetStatusOrder = ['higanbana', 'feint'];
      this.defaultBars = [
        ['hakaze', 'jinpu', 'gekko', 'shifu', 'kasha', 'yukikaze', 'iaijutsu', 'tsubameGaeshi', 'ogiNamikiri', 'enpi', 'hagakure', 'meditate'],
        ['kaiten', 'shinten', 'senei', 'shoha', 'meikyoShisui', 'ikishoten', 'gyoten', 'yaten', 'trueNorth', 'tincture', 'feint', 'thirdEye'],
        ['bloodbath', 'sprint', 'secondWind', 'armsLength', 'legSweep', 'guren', null, null, null, null, null, null],
      ];
      this.actionGroups = [
        ['Samurai', ['hakaze', 'jinpu', 'shifu', 'gekko', 'kasha', 'yukikaze', 'enpi', 'iaijutsu', 'higanbana', 'tenkaGoken', 'midareSetsugekka',
          'tsubameGaeshi', 'kaeshiHiganbana', 'kaeshiGoken', 'kaeshiSetsugekka', 'ogiNamikiri', 'kaeshiNamikiri', 'kaiten', 'shinten',
          'senei', 'guren', 'shoha', 'gyoten', 'yaten', 'ikishoten', 'meikyoShisui', 'hagakure', 'meditate', 'thirdEye']],
        ['Role Actions', ['trueNorth', 'feint', 'bloodbath', 'secondWind', 'armsLength', 'legSweep']],
        ['General', ['sprint', 'tincture']],
      ];
      this.referenceDps = 8700;     // a scripted 6.08 rotation on this gear parses about 8,200 on the dummy
      this.referenceGcd = 2.14;
      this.startDistance = 3.2;
    }

    initGauge() {
      return { kenki: 0, sen: { setsu: false, getsu: false, ka: false }, meditation: 0, kaeshi: null, namikiri: false,
        medNext: null };
    }

    senCount(e) { const s = e.g.sen; return (s.setsu ? 1 : 0) + (s.getsu ? 1 : 0) + (s.ka ? 1 : 0); }

    // Iaijutsu, Tsubame-gaeshi and Ogi Namikiri change into what they'd do right now.
    resolveId(id, e) {
      const g = e.g;
      if (id === 'iaijutsu') return IAI[this.senCount(e) - 1] || 'iaijutsu';
      if (id === 'tsubameGaeshi') return (g.kaeshi && KAESHI[g.kaeshi]) || 'tsubameGaeshi';
      if (id === 'ogiNamikiri' && g.namikiri) return 'kaeshiNamikiri';
      return id;
    }

    haste(e) { return e.has('fuka') ? FUKA : 0; }
    autoHaste(e) { return e.has('fuka') ? FUKA : 0; }

    check(id, e) {
      const a = ACTIONS[id], g = e.g;
      if (id === 'iaijutsu') return 'Unable to execute action. Sen required.';
      if (id === 'tsubameGaeshi') return 'Unable to execute action. Iaijutsu required.';
      if (a.cdGroup === 'tsubame' && KAESHI[g.kaeshi] !== id) return 'Unable to execute action.';
      if (id === 'ogiNamikiri' && !e.has('ogiNamikiriReady')) return 'Unable to execute action. Ogi Namikiri Ready required.';
      if (id === 'kaeshiNamikiri' && !g.namikiri) return 'Unable to execute action.';
      if (a.iai && this.senCount(e) !== a.iai) return 'Unable to execute action. Sen required.';
      if (a.kenkiCost && g.kenki < a.kenkiCost) return 'Not enough Kenki.';
      if (id === 'shoha' && g.meditation < MED_MAX) return 'Unable to execute action. Meditation required.';
      if (id === 'ikishoten' && !e.inCombat) return 'Unable to execute action while not in combat.';
      if (id === 'hagakure' && this.senCount(e) === 0) return 'Unable to execute action. Sen required.';
      return null;
    }

    addKenki(e, n) {
      const g = e.g;
      g.kenki = Math.max(0, Math.min(KENKI_MAX, g.kenki + n));
    }

    snapshot(a, e) {
      let mult = e.has('fugetsu') ? FUGETSU : 1;
      if (a && a.kaiten) mult *= KAITEN;
      const main = this.stats.main + (e.has('medicated') ? B.TINCTURES.str6.cap : 0);
      return { mult, main };
    }

    resolve(id, e) {
      // Meditate is a channel: any other action ends it.
      if (id !== 'meditate' && e.has('meditate')) { e.removeStatus('meditate'); e.g.medNext = null; }
      if (ACTIONS[id].kind === 'gcd') this.weaponskill(id, e);
      else this.ability(id, e);
    }

    weaponskill(id, e) {
      const a = ACTIONS[id], g = e.g;
      const iai = IAI.includes(id);
      const comboFamily = !!(a.comboFrom || a.comboStart || id === 'enpi');
      // Meikyo Shisui: each stack lets a weaponskill skip its combo requirement (Iaijutsu and Kaeshi don't use one).
      const meikyo = comboFamily && e.has('meikyoShisui');
      if (meikyo) {
        const s = e.statuses.meikyoShisui;
        s.stacks--;
        if (s.stacks <= 0) e.removeStatus('meikyoShisui');
        else e.emit('statusStack', { key: 'meikyoShisui' });
      }
      const combo = !!a.comboFrom && e.lastComboHit;

      // Potency: combo, positional, Enhanced Enpi, then Kaiten on top.
      let potency = a.potency || 0;
      if (a.comboFrom && combo) potency = a.comboPotency;
      const positional = !!a.positional && e.positionalHit(a);
      if (positional) potency += POSITIONAL;
      if (id === 'enpi' && e.has('enhancedEnpi')) { potency = a.enhancedPotency; e.removeStatus('enhancedEnpi'); }
      const kaiten = potency > 0 && !a.noKaiten && e.has('kaiten');
      if (kaiten) e.removeStatus('kaiten');
      const snap = this.snapshot({ kaiten }, e);

      // Combo bonuses: Kenki, Sen and the two buffs.
      if (id === 'hakaze' || id === 'enpi') this.addKenki(e, a.kenki);
      if (a.comboFrom && combo) {
        this.addKenki(e, a.kenki);
        if (id === 'jinpu') e.addStatus('fugetsu', 40);
        if (id === 'shifu') e.addStatus('fuka', 40);
        if (a.sen) { g.sen[a.sen] = true; e.emit('sen', {}); }
        if (meikyo && id === 'gekko') e.addStatus('fugetsu', 40);
        if (meikyo && id === 'kasha') e.addStatus('fuka', 40);
      }

      let after = null;
      if (iai) {
        g.sen = { setsu: false, getsu: false, ka: false };
        g.meditation = Math.min(MED_MAX, g.meditation + 1);
        e.emit('sen', {});
      }
      if (id === 'ogiNamikiri') {
        e.removeStatus('ogiNamikiriReady');
        g.meditation = Math.min(MED_MAX, g.meditation + 1);
      }
      if (a.dot) {
        after = () => e.addTStatus('higanbana', a.dot.duration, { snap, dot: { potency: a.dot.potency, id } });
      }
      if (id === 'meditate') {
        e.addStatus('meditate', 15);
        g.medNext = e.now + 3;
      }

      // Kaeshi and Kaeshi: Namikiri only follow straight after their Iaijutsu / Ogi Namikiri.
      g.kaeshi = iai ? id : null;
      g.namikiri = id === 'ogiNamikiri';

      if (potency) e.queueHit(id, potency, snap, a.delay, after, { positional: a.positional ? (positional ? 'hit' : 'miss') : null });
    }

    ability(id, e) {
      const a = ACTIONS[id], g = e.g;
      if (a.kenkiCost) this.addKenki(e, -a.kenkiCost);
      switch (id) {
        case 'kaiten': e.addStatus('kaiten', 10); break;
        case 'ikishoten': this.addKenki(e, 50); e.addStatus('ogiNamikiriReady', 30); break;
        case 'meikyoShisui': e.addStatus('meikyoShisui', 15, { stacks: 3 }); break;
        case 'hagakure':
          this.addKenki(e, 10 * this.senCount(e));
          g.sen = { setsu: false, getsu: false, ka: false };
          e.emit('sen', {});
          break;
        case 'shoha': g.meditation = 0; break;
        case 'thirdEye': e.addStatus('thirdEye', 3); break;
        case 'yaten': {
          // 10-yalm backstep, straight away from the dummy.
          const d = e.distToTarget() || 1;
          const from = { x: e.pos.x, z: e.pos.z };
          e.pos.x += e.pos.x / d * 10; e.pos.z += e.pos.z / d * 10;
          e.addStatus('enhancedEnpi', 15);
          e.emit('teleport', { from, to: { x: e.pos.x, z: e.pos.z } });
          break;
        }
        case 'gyoten': {
          // Rush to melee range.
          const d = e.distToTarget() || 1;
          if (d > 2.6) {
            const from = { x: e.pos.x, z: e.pos.z };
            e.pos.x *= 2.4 / d; e.pos.z *= 2.4 / d;
            e.emit('teleport', { from, to: { x: e.pos.x, z: e.pos.z } });
          }
          break;
        }
        default:
          if (B.ROLE_EFFECTS[id]) B.ROLE_EFFECTS[id](e);
      }
      if (a.potency) e.queueHit(id, a.potency, this.snapshot(null, e), a.delay);
    }

    // Meditate's ticks.
    nextEvent(e) { return e.g.medNext !== null && e.has('meditate') ? e.g.medNext : Infinity; }
    process(e) {
      const g = e.g;
      if (g.medNext === null) return;
      if (!e.has('meditate')) { g.medNext = null; return; }
      if (e.now >= g.medNext - EPS) {
        g.medNext += 3;
        this.addKenki(e, 10);
        g.meditation = Math.min(MED_MAX, g.meditation + 1);
      }
    }
    frame(e) {
      if (e.moving && e.has('meditate')) { e.removeStatus('meditate'); e.g.medNext = null; }
    }

    // Hotbar borders: the next combo step, Kaeshi, Ogi Namikiri, Enhanced Enpi, Midare with three Sen.
    proc(id, e) {
      const a = ACTIONS[id], g = e.g;
      if (a.comboFrom && e.inCombo(a.comboFrom)) return true;
      if (a.cdGroup === 'tsubame' && KAESHI[g.kaeshi] === id) return true;
      if (id === 'ogiNamikiri' && e.has('ogiNamikiriReady')) return true;
      if (id === 'kaeshiNamikiri' && g.namikiri) return true;
      if (id === 'enpi' && e.has('enhancedEnpi')) return true;
      if (id === 'midareSetsugekka') return true;
      return false;
    }

    mpRegen(e) { return B.BASE_REGEN; }

    speedInfo(e) {
      return `GCD ${e.gcdForSpeed(e.stats.speed).toFixed(2)} without Fuka · Iaijutsu ${e.speedScale(1.3, FUKA).toFixed(2)}s cast with Fuka`;
    }

    // ---------- Kenki gauge, Sen and Meditation ----------
    gaugeBuild(root) {
      const flower = (cx, cy) => [0, 72, 144, 216, 288].map(r => `<ellipse cx="${cx}" cy="${cy - 7}" rx="4.5" ry="7.5" transform="rotate(${r} ${cx} ${cy})"/>`).join('');
      root.innerHTML = `
<svg width="360" height="220" viewBox="0 0 360 220">
  <defs>
    <linearGradient id="kk" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#7a1414"/><stop offset=".6" stop-color="#e2452e"/><stop offset="1" stop-color="#ffd2a0"/></linearGradient>
    <linearGradient id="blade" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#e9edf2"/><stop offset="1" stop-color="#8d96a3"/></linearGradient>
    <radialGradient id="setsu" cx="50%" cy="40%" r="60%"><stop offset="0" stop-color="#f2fdff"/><stop offset="1" stop-color="#3f8fd6"/></radialGradient>
    <radialGradient id="getsu" cx="50%" cy="40%" r="60%"><stop offset="0" stop-color="#f4f0ff"/><stop offset="1" stop-color="#5a62d8"/></radialGradient>
    <radialGradient id="ka" cx="50%" cy="40%" r="60%"><stop offset="0" stop-color="#ffe6e0"/><stop offset="1" stop-color="#d6453b"/></radialGradient>
    <filter id="sg" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="3" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
  </defs>
  <rect x="8" y="14" width="344" height="190" rx="14" fill="rgba(14,12,20,.86)" stroke="rgba(255,255,255,.22)"/>
  <text x="24" y="42" font-family="Noto Sans, sans-serif" font-size="11" font-weight="600" fill="#a9a3b4" letter-spacing="1">KENKI</text>
  <path d="M24 62 L300 62 L332 70 L300 78 L24 78 Z" fill="#1d1820" stroke="url(#blade)" stroke-width="2"/>
  <clipPath id="kclip"><path d="M24 62 L300 62 L332 70 L300 78 L24 78 Z"/></clipPath>
  <rect id="s-kenki" x="24" y="62" width="0" height="16" fill="url(#kk)" clip-path="url(#kclip)"/>
  <rect x="14" y="58" width="12" height="24" rx="2" fill="#2b1b10" stroke="#d9b24a" stroke-width="1.5"/>
  <text id="s-kenkin" x="332" y="46" text-anchor="end" font-family="Saira Semi Condensed, sans-serif" font-size="26" font-weight="700" fill="#fff" stroke="#000" stroke-width="3" paint-order="stroke">0</text>
  <text x="24" y="112" font-family="Noto Sans, sans-serif" font-size="11" font-weight="600" fill="#a9a3b4" letter-spacing="1">SEN</text>
  <g id="s-setsu" transform="translate(60 150)"><circle r="22" fill="#1d2230" stroke="rgba(255,255,255,.25)" stroke-width="1.5"/>
    <g class="glyph" stroke="#fff" stroke-width="2.5" stroke-linecap="round" opacity=".35"><path d="M0 -13 L0 13 M-11 -6.5 L11 6.5 M-11 6.5 L11 -6.5"/></g></g>
  <g id="s-getsu" transform="translate(120 150)"><circle r="22" fill="#1d2230" stroke="rgba(255,255,255,.25)" stroke-width="1.5"/>
    <path class="glyph" d="M4 -13 A13 13 0 1 0 4 13 A10 10 0 1 1 4 -13 Z" fill="#fff" opacity=".35"/></g>
  <g id="s-ka" transform="translate(180 150)"><circle r="22" fill="#1d2230" stroke="rgba(255,255,255,.25)" stroke-width="1.5"/>
    <g class="glyph" fill="#fff" opacity=".35">${flower(0, 0)}<circle r="3.5" fill="#1d2230"/></g></g>
  <text x="236" y="112" font-family="Noto Sans, sans-serif" font-size="11" font-weight="600" fill="#a9a3b4" letter-spacing="1">MEDITATION</text>
  ${[0, 1, 2].map(k => `<path id="s-med${k}" d="M0 -12 L9 0 L0 12 L-9 0 Z" transform="translate(${252 + k * 32} 150)" fill="#2a2535" stroke="rgba(0,0,0,.8)" stroke-width="1.5"/>`).join('')}
</svg>`;
      const $ = (s) => root.querySelector(s);
      this.sg = { kenki: $('#s-kenki'), kenkin: $('#s-kenkin'), setsu: $('#s-setsu'), getsu: $('#s-getsu'), ka: $('#s-ka'),
        med: [0, 1, 2].map(k => $('#s-med' + k)), cache: {} };
    }

    gaugeUpdate(e) {
      const G = this.sg, c = G.cache, g = e.g;
      const put = (k, v, fn) => { if (c[k] !== v) { c[k] = v; fn(v); } };
      put('k', g.kenki, v => { G.kenki.setAttribute('width', String(308 * v / KENKI_MAX)); G.kenkin.textContent = String(v); });
      for (const [k, fill] of [['setsu', 'url(#setsu)'], ['getsu', 'url(#getsu)'], ['ka', 'url(#ka)']]) {
        put(k, g.sen[k], v => {
          G[k].querySelector('circle').setAttribute('fill', v ? fill : '#1d2230');
          G[k].querySelector('.glyph').setAttribute('opacity', v ? '1' : '.35');
          G[k].setAttribute('filter', v ? 'url(#sg)' : '');
        });
      }
      for (let i = 0; i < 3; i++) put('m' + i, g.meditation > i, v => { G.med[i].setAttribute('fill', v ? '#ffcf5a' : '#2a2535'); G.med[i].setAttribute('filter', v ? 'url(#sg)' : ''); });
    }

    // ---------- help ----------
    helpHtml(seq) {
      return `
<h3>How it plays (Endwalker 6.08, with Kaiten)</h3>
<p>This is Samurai as it launched in Endwalker, before patch 6.1 removed <b>Hissatsu: Kaiten</b> and reworked the job. Weaponskills share a 2.5s GCD (faster with skill speed; Fuka takes 13% more off, which is why this tier is called 2.14). Build Sen with the three combos, then spend them with Iaijutsu: one Sen is Higanbana, two Tenka Goken, three Midare Setsugekka. Iaijutsu has a 1.3s cast you can slidecast.</p>
<p><b>Kaiten</b> costs 20 Kenki and adds 50% to your next weaponskill, Higanbana's DoT included. Use it right before Midare, Higanbana and Ogi Namikiri, not on combo GCDs. Tsubame-gaeshi repeats your last Iaijutsu as a Kaeshi (Kaeshi: Setsugekka 990), but only as the very next GCD; Kaiten doesn't reach Kaeshi, since it's an ability in game.</p>
<p>Keep <b>Fugetsu</b> (Jinpu: +13% damage) and <b>Fuka</b> (Shifu: 13% haste) up. Gekko is a rear positional and Kasha a flank one (+50 potency each). Walk around the dummy or use True North. Kenki comes from combos (Hakaze 5, Jinpu/Shifu 5, Gekko/Kasha 10, Yukikaze 15) and Ikishoten (50); spend it on Kaiten and Shinten before it caps at 100. Every Iaijutsu and Ogi Namikiri adds a Meditation stack; three let you Shoha.</p>
<h3>The 6.0x opener</h3>
${seq(['meikyoShisui', 'gekko', ['tincture'], 'kasha', ['ikishoten'], 'yukikaze', ['kaiten'], 'midareSetsugekka', 'kaeshiSetsugekka', ['senei'], ['meikyoShisui'], 'gekko', ['kaiten'], 'higanbana', 'kasha', ['kaiten'], 'ogiNamikiri', 'kaeshiNamikiri', ['shoha'], 'gekko', ['shinten'], 'hakaze', 'yukikaze', ['kaiten'], 'midareSetsugekka', 'kaeshiSetsugekka'])}
<p>Meikyo Shisui about 9s before the pull. True North covers the positionals while you get set up.</p>
<h3>After the opener</h3>
<p>Every 2 minutes: Ikishoten, Ogi Namikiri and Kaeshi: Namikiri, Senei, and a double Midare with Kaeshi inside your buffs. About every 60s: a Kaiten'd Higanbana and a Tsubame charge. Fill with Hakaze → Jinpu → Gekko, Hakaze → Shifu → Kasha and Hakaze → Yukikaze, using Meikyo to keep bursts on time, and Shinten whenever Kenki would overcap.</p>
<p style="color:#a9a3b4">The 6.08 numbers: Hakaze 180; Jinpu, Shifu and Yukikaze combo 280; Gekko and Kasha combo 320 (370 positional); Higanbana 200 + 30 per tick for 60s; Midare 660 (not yet a guaranteed crit); Kaeshi: Setsugekka 990; Ogi Namikiri 900; Kaeshi: Namikiri 1350; Shinten 270; Senei 800; Shoha 580; auto-attacks 90 potency at 2.64s. 6.1 later raised the combo GCDs, made Midare and Ogi guaranteed crits and cut the Kaeshi.</p>`;
    }
  }

  B.registerJob({
    id: 'sam', name: 'Samurai', abbr: 'SAM', role: 'melee', classJob: 34,
    versions: [{ id: 'ew608', label: 'Endwalker 6.08 (Kaiten)', note: 'Hissatsu: Kaiten, Midare 660, Kaeshi: Setsugekka 990. Before the 6.1 rework', create: () => new SamuraiEW608() }],
  });
})(window.BLM);
