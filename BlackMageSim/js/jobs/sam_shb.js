// Samurai, Shadowbringers at level 80, in two versions. Built on the Endwalker 6.08 class (sam_ew.js) with the 5.x kit:
// Jinpu (+13% damage) and Shifu (13% haste) for 40s, positionals that add 5 Kenki instead of potency, Hissatsu: Kaiten
// (+50% to the next weaponskill), one Tsubame-gaeshi charge on a 60s recast, Meikyo Shisui on 55s, Ikishoten (+50
// Kenki, 60s), Senei and Guren at 50 Kenki, Fuga for the AoE combo (Mangetsu and Oka extend Jinpu and Shifu by 15s),
// and no Ogi Namikiri.
//  - 5.05–5.08: the 5.08 potencies (Jinpu / Shifu 340, Yukikaze 400). Meditation comes only from Meditate (an ability
//    here), up to five stacks for 45s, and Shoha's potency grows with them (100–500, 1s recast); Hagakure gives 5 Kenki
//    per Sen; Tsubame-gaeshi's 2.5s lock ignores skill speed. Eden's Gate gear.
//  - 5.1–5.58: Jinpu / Shifu 320, Yukikaze 360; Iaijutsu, Kaeshi and Meditate ticks each add a Meditation stack (max
//    3, no timer), Shoha is 400 on a 15s recast, Meditate takes the GCD, Hagakure gives 10 per Sen. The Balance's set.
// Numbers are the game data at 5.08 and 5.58 and the Lodestone notes; gear stats are the 5.58 Item.csv's (pre-6.0).
// ref: a scripted bot parses about 21,560 / 14,500 on these.
(function (B) {
  const EW = B.SamuraiEW608;
  const EPS = 1e-6;
  const VERSIONS = {
    shb51: { label: 'Shadowbringers 5.1–5.58', history: 'ShB 5.1–5.58', jinpu: 320, yukikaze: 360, higanDot: 40, kaeshiDot: 60, hagakure: 10,
      oldMeditation: false, tsubameFixed: false, kaiten: 1, tincture: 'str4', ref: 22850,
      stats: { hp: 70000, main: 5549, wd: 134, det: 2045, crit: 4021, dh: 2835, speed: 711 },
      gear: 'The Balance\'s 5.58 "2.14 slowSam" set (Strength 5,549, 134 weapon damage)',
      note: 'Level 80: Kaiten, one Tsubame-gaeshi, Meditation from Iaijutsu and Kaeshi into Shoha, Senei, Jinpu and Shifu; Eden\'s Promise gear' },
    shb505: { label: 'Shadowbringers 5.05–5.08', history: 'ShB 5.05–5.08', jinpu: 340, yukikaze: 400, higanDot: 40, kaeshiDot: 60, hagakure: 5,
      oldMeditation: true, tsubameFixed: true, kaiten: 1, tincture: 'str2', ref: 15370,
      stats: { hp: 62000, main: 4182, wd: 122, det: 2172, crit: 2858, dh: 3072, speed: 685 },
      gear: 'an Eden\'s Gate set at 2.14 with Shifu (Strength 4,182, 122 weapon damage), with a Grade 2 Tincture',
      note: 'Level 80: instant Kaeshi, Meikyo on 55s, Kaiten on a 1s recast (5.08), Shoha only from Meditate; Eden\'s Gate gear' },
  };
  const ws = (o) => Object.assign({ kind: 'gcd', target: true, range: B.MELEE_RANGE, delay: 0.45 }, o);
  const set = (A, id, o) => { A[id] = Object.assign({}, A[id], o); };
  const SHOHA_OLD = [0, 100, 300, 400, 450, 500];
  const KAESHI = ['kaeshiHiganbana', 'kaeshiGoken', 'kaeshiSetsugekka'];

  class SamuraiShB extends EW {
    constructor(version) {
      super();
      const V = VERSIONS[version];
      this.V = V;
      this.level = 80;
      this.levelKey = 'shb80';
      this.model = 'sam-shb';
      const A = Object.assign({}, this.actions);
      for (const k of ['ogiNamikiri', 'kaeshiNamikiri', 'fuko']) delete A[k];
      set(A, 'hakaze', { potency: 200, desc: 'Delivers an attack with a potency of 200.\nAdditional Effect: Increases Kenki Gauge by 5' });
      set(A, 'jinpu', { comboPotency: V.jinpu, desc: `Delivers an attack with a potency of 100.\nCombo Action: Hakaze\nCombo Potency: ${V.jinpu}\nCombo Bonus: Increases damage dealt by 13%\nDuration: 40s\nCombo Bonus: Increases Kenki Gauge by 5` });
      set(A, 'shifu', { comboPotency: V.jinpu, desc: `Delivers an attack with a potency of 100.\nCombo Action: Hakaze\nCombo Potency: ${V.jinpu}\nCombo Bonus: Reduces weaponskill cast time and recast time, spell cast time and recast time, and auto-attack delay by 13%\nDuration: 40s\nCombo Bonus: Increases Kenki Gauge by 5` });
      set(A, 'gekko', { comboPotency: 480, kenki: 5, desc: 'Delivers an attack with a potency of 100.\nCombo Action: Jinpu\nCombo Potency: 480\nRear Combo Bonus: Increases Kenki Gauge by 5\nCombo Bonus: Increases Kenki Gauge by 5\nCombo Bonus: Grants Getsu' });
      set(A, 'kasha', { comboPotency: 480, kenki: 5, desc: 'Delivers an attack with a potency of 100.\nCombo Action: Shifu\nCombo Potency: 480\nFlank Combo Bonus: Increases Kenki Gauge by 5\nCombo Bonus: Increases Kenki Gauge by 5\nCombo Bonus: Grants Ka' });
      set(A, 'yukikaze', { comboPotency: V.yukikaze, desc: `Delivers an attack with a potency of 100.\nCombo Action: Hakaze\nCombo Potency: ${V.yukikaze}\nCombo Bonus: Increases Kenki Gauge by 15\nCombo Bonus: Grants Setsu` });
      set(A, 'enpi', { enhancedPotency: 320, desc: 'Delivers a ranged attack with a potency of 100.\nEnhanced Enpi Bonus Potency: 320\nAdditional Effect: Increases Kenki Gauge by 10' });
      A.fuga = ws({ name: 'Fuga', potency: 100, comboStart: true, comboNext: true, kenki: 5, range: 8, aoe: true, fx: 'slash',
        desc: 'Delivers an attack with a potency of 100 to all enemies in a cone before you.\nAdditional Effect: Increases Kenki Gauge by 5' });
      set(A, 'mangetsu', { comboPotency: 160, comboFrom: 'fuga', desc: 'Delivers an attack with a potency of 100 to all nearby enemies.\nCombo Action: Fuga\nCombo Potency: 160\nCombo Bonus: Extends Jinpu duration by 15s to a maximum of 40s\nCombo Bonus: Increases Kenki Gauge by 10\nCombo Bonus: Grants Getsu' });
      set(A, 'oka', { comboPotency: 160, comboFrom: 'fuga', desc: 'Delivers an attack with a potency of 100 to all nearby enemies.\nCombo Action: Fuga\nCombo Potency: 160\nCombo Bonus: Extends Shifu duration by 15s to a maximum of 40s\nCombo Bonus: Increases Kenki Gauge by 10\nCombo Bonus: Grants Ka' });
      const med = V.oldMeditation ? '' : '\nAdditional Effect: Grants a stack of Meditation, up to a maximum of 3';
      set(A, 'higanbana', { potency: 250, dot: { potency: V.higanDot, duration: 60 }, desc: `Delivers an attack with a potency of 250.\nAdditional Effect: Damage over time\nPotency: ${V.higanDot}\nDuration: 60s${med}\nCan only be executed when under the effect of one of the following: Setsu, Getsu, or Ka.` });
      set(A, 'tenkaGoken', { potency: 360, desc: `Delivers an attack with a potency of 360 to all enemies in a cone before you.${med}\nCan only be executed when under the effect of two of the following: Setsu, Getsu, or Ka.` });
      set(A, 'midareSetsugekka', { potency: 800, desc: `Delivers an attack with a potency of 800.${med}\nCan only be executed when under the effect of Setsu, Getsu, and Ka.` });
      const fixed = V.tsubameFixed ? { fixedRecast: 2.5 } : {};
      const lock = V.tsubameFixed ? '\nTriggers the cooldown of weaponskills upon execution (2.5s, not affected by skill speed).' : '\nTriggers the cooldown of weaponskills upon execution.';
      set(A, 'tsubameGaeshi', Object.assign({ charges: undefined, desc: `Repeats the previously executed iaijutsu with increased potency.\nCan only be executed immediately following Iaijutsu.${lock}` }, fixed));
      set(A, 'kaeshiHiganbana', Object.assign({ potency: 375, charges: undefined, dot: { potency: V.kaeshiDot, duration: 60 }, desc: `Delivers an attack with a potency of 375.\nAdditional Effect: Damage over time\nPotency: ${V.kaeshiDot}\nDuration: 60s${med}\nEffect cannot be stacked with Higanbana.${lock}` }, fixed));
      set(A, 'kaeshiGoken', Object.assign({ potency: 540, charges: undefined, desc: `Delivers an attack with a potency of 540 to all enemies in a cone before you.${med}${lock}` }, fixed));
      set(A, 'kaeshiSetsugekka', Object.assign({ potency: 1200, charges: undefined, desc: `Delivers an attack with a potency of 1,200.${med}${lock}` }, fixed));
      set(A, 'shinten', { potency: 320, desc: 'Delivers an attack with a potency of 320.\nKenki Gauge Cost: 25' });
      set(A, 'kyuten', { potency: 150, desc: 'Delivers an attack with a potency of 150 to all nearby enemies.\nKenki Gauge Cost: 25' });
      set(A, 'senei', { potency: 1100, kenkiCost: 50, desc: 'Delivers an attack with a potency of 1,100.\nKenki Gauge Cost: 50\nShares a recast timer with Hissatsu: Guren.' });
      set(A, 'guren', { potency: 850, kenkiCost: 50, aoe: true, desc: 'Delivers an attack with a potency of 850 to all enemies in a straight line before you.\nKenki Gauge Cost: 50\nShares a recast timer with Hissatsu: Senei.' });
      set(A, 'kaiten', { recast: V.kaiten });
      set(A, 'ikishoten', { recast: 60, desc: 'Increases Kenki Gauge by 50.\nCan only be executed while in combat.' });
      set(A, 'meikyoShisui', { recast: 55, charges: undefined, desc: 'Execute up to 3 weaponskill combos without meeting combo prerequisites. Does not affect Iaijutsu.\nDuration: 15s' });
      set(A, 'hagakure', { desc: `Converts Setsu, Getsu, and Ka into Kenki. Each Sen converted increases your Kenki Gauge by ${V.hagakure}.\nCan only be executed if under the effect of at least one of the three statuses.` });
      if (V.oldMeditation) {
        A.meditate = { name: 'Meditate', kind: 'ogcd', recast: 60, fx: 'meditate', desc: 'Gradually increases your Kenki Gauge.\nDuration: 15s\nAdditional Effect: Grants stacks of Meditation when used in combat, up to a maximum of 5\nMeditation Duration: 45s\nEffect ends upon using another action or moving (including facing a different direction).' };
        set(A, 'shoha', { recast: 1, potency: 0, desc: 'Delivers an attack with a potency of 100 for one stack of Meditation, 300 for two, 400 for three, 450 for four and 500 for five.\nCan only be executed while under the effect of Meditation. Meditation effect fades upon execution.' });
      } else {
        set(A, 'meditate', { desc: 'Gradually increases your Kenki Gauge.\nDuration: 15s\nAdditional Effect: Grants stacks of Meditation when used in combat, up to a maximum of 3\nEffect ends upon using another action or moving (including facing a different direction).\nTriggers the cooldown of weaponskills upon execution.' });
        set(A, 'shoha', { potency: 400, desc: 'Delivers an attack with a potency of 400.\nCan only be executed after accumulating three stacks of Meditation by executing Iaijutsu, Tsubame-gaeshi, or Meditate while in combat.\nMeditation effect fades upon execution.' });
      }
      set(A, 'trueNorth', { desc: 'Nullifies all action direction requirements.\nDuration: 10s\nMaximum Charges: 2' });
      A.tincture = B.tincture(V.tincture);
      this.actions = A;
      this.statuses = Object.assign({}, this.statuses, {
        fugetsu: { name: 'Jinpu', self: true, icon: 'st_fugetsu' },
        fuka: { name: 'Shifu', self: true, icon: 'st_fuka' },
        meditation: { name: 'Meditation', self: true, icon: 'st_meditation' },
      });
      this.buff = { fugetsu: 1.13, fuka: 13, dur: 40 };
      this.positionalBonus = 0;
      this.positionalKenki = 5;
      this.meikyoBuffs = false;
      this.aoeBuffs = false;
      this.meditationStacks = !V.oldMeditation;
      this.tinctureKey = V.tincture;
      this.stats = Object.assign({ mainStat: 'str', jobMod: 112, trait: 100, delay: 2.64 }, V.stats);
      this.autoAttack = { potency: 110, delay: 2.64, range: B.MELEE_RANGE };
      this.selfStatusOrder = ['fugetsu', 'fuka', 'meikyoShisui', 'kaiten', 'meditation', 'enhancedEnpi', 'meditate',
        'trueNorth', 'thirdEye', 'medicated', 'bloodbath', 'armsLength', 'sprint'];
      this.defaultBars = [
        ['hakaze', 'jinpu', 'gekko', 'shifu', 'kasha', 'yukikaze', 'iaijutsu', 'tsubameGaeshi', 'kaiten', 'enpi', 'hagakure', 'meditate'],
        ['shinten', 'senei', 'shoha', 'meikyoShisui', 'ikishoten', 'gyoten', 'yaten', 'trueNorth', 'tincture', 'feint', 'thirdEye', 'guren'],
        ['bloodbath', 'sprint', 'secondWind', 'armsLength', 'legSweep', 'fuga', 'mangetsu', 'oka', 'kyuten', null, null, null],
      ];
      this.actionGroups = [
        ['Samurai', ['hakaze', 'jinpu', 'shifu', 'gekko', 'kasha', 'yukikaze', 'enpi', 'fuga', 'mangetsu', 'oka', 'kyuten', 'iaijutsu', 'higanbana', 'tenkaGoken',
          'midareSetsugekka', 'tsubameGaeshi', 'kaeshiHiganbana', 'kaeshiGoken', 'kaeshiSetsugekka', 'kaiten', 'shinten', 'senei', 'guren', 'shoha',
          'gyoten', 'yaten', 'ikishoten', 'meikyoShisui', 'hagakure', 'meditate', 'thirdEye']],
        ['Role Actions', ['trueNorth', 'feint', 'bloodbath', 'secondWind', 'armsLength', 'legSweep']],
        ['General', ['sprint', 'tincture']],
      ];
      this.referenceDps = V.ref;
      this.referenceGcd = 2.14;
    }

    resolveId(id, e) { return id === 'ogiNamikiri' ? id : super.resolveId(id, e); }

    check(id, e) {
      if (id === 'shoha' && this.V.oldMeditation) return e.has('meditation') ? null : 'Unable to execute action. Meditation required.';
      if (id === 'meditate' && !e.inCombat) return 'Unable to execute action while not in combat.';
      return super.check(id, e);
    }

    // Mangetsu and Oka extend Jinpu and Shifu by 15s (up to 40s) rather than granting them.
    comboBonus(id, e) {
      const key = id === 'mangetsu' ? 'fugetsu' : id === 'oka' ? 'fuka' : null;
      if (key && e.has(key)) e.addStatus(key, Math.min(40, e.statuses[key].until - e.now + 15));
    }

    weaponskill(id, e) {
      super.weaponskill(id, e);
      // From 5.1 the Kaeshi add a Meditation stack too.
      if (this.meditationStacks && KAESHI.includes(id)) e.g.meditation = Math.min(3, e.g.meditation + 1);
    }

    ability(id, e) {
      const g = e.g;
      switch (id) {
        case 'ikishoten': this.addKenki(e, 50); return;
        case 'hagakure':
          this.addKenki(e, this.V.hagakure * this.senCount(e));
          g.sen = { setsu: false, getsu: false, ka: false };
          e.emit('sen', {});
          return;
        case 'meditate':
          e.addStatus('meditate', 15);
          g.medNext = e.now + 3;
          return;
        case 'trueNorth': e.addStatus('trueNorth', 10); return;
        case 'shoha':
          if (this.V.oldMeditation) {
            const n = e.statuses.meditation.stacks || 1;
            e.removeStatus('meditation');
            e.queueHit('shoha', SHOHA_OLD[n], this.snapshot(null, e), this.actions.shoha.delay);
            return;
          }
          break;
      }
      super.ability(id, e);
    }

    // 5.05–5.08: Meditate's ticks build a Meditation status (up to five stacks, 45s) instead of the gauge.
    process(e) {
      if (!this.V.oldMeditation) return super.process(e);
      const g = e.g;
      if (g.medNext === null) return;
      if (!e.has('meditate')) { g.medNext = null; return; }
      if (e.now >= g.medNext - EPS) {
        g.medNext += 3;
        this.addKenki(e, 10);
        const n = e.has('meditation') ? Math.min(5, (e.statuses.meditation.stacks || 0) + 1) : 1;
        e.addStatus('meditation', 45, { stacks: n });
      }
    }

    proc(id, e) {
      if (id === 'shoha') return this.V.oldMeditation ? e.has('meditation') : e.g.meditation >= 3;
      return super.proc(id, e);
    }

    speedInfo(e) {
      return `GCD ${e.gcdForSpeed(e.stats.speed).toFixed(2)} without Shifu · ${e.gcdForSpeed(e.stats.speed, 13).toFixed(2)} with · Iaijutsu ${e.speedScale(1.3, 13).toFixed(2)}s cast with Shifu`;
    }

    helpHtml(seq) {
      const V = this.V;
      const shoha = V.oldMeditation
        ? '<b>Meditate</b> (an ability here, 60s) is the only source of Meditation: a 15s channel that adds a stack and 10 Kenki every 3s, up to five stacks for 45s, which any action or movement ends. Use it in downtime; <b>Shoha</b> spends the stacks for 100–500.'
        : 'Every Iaijutsu, Kaeshi and Meditate tick adds a <b>Meditation</b> stack (max 3); at three, <b>Shoha</b> (400, 15s). Meditate takes the GCD now, so it\'s a downtime tool.';
      return `
<h3>How it plays (${V.label})</h3>
<p>Level 80 Samurai. Build Sen with the three combos and spend them with Iaijutsu (1.3s cast): one Sen is Higanbana (250 + ${V.higanDot} × 60s), two Tenka Goken, three <b>Midare Setsugekka</b> (800). <b>Tsubame-gaeshi</b> (60s, one charge) repeats it straight after as a Kaeshi; always <b>Kaeshi: Setsugekka</b> (1,200), never Kaeshi: Higanbana.${V.tsubameFixed ? ' Its GCD lock is a flat 2.5s in 5.0x, skill speed doesn\'t shorten it.' : ''}</p>
<p>Keep <b>Jinpu</b> (+13% damage) and <b>Shifu</b> (13% haste) up, 40s each. Gekko (rear) and Kasha (flank) give 5 more Kenki from the right side, not more potency. <b>Hissatsu: Kaiten</b> (20 Kenki, +50% to the next weaponskill, its DoT too) goes before every Midare and Higanbana. Kenki also buys <b>Senei</b> (1,100, 50 Kenki, 120s, shared with Guren) and <b>Shinten</b> (320, 25). <b>Ikishoten</b> gives 50 every 60s, <b>Meikyo Shisui</b> (55s) skips three combo steps, and <b>Hagakure</b> turns leftover Sen into ${V.hagakure} Kenki each.</p>
<p>${shoha}</p>
<h3>The opener (Higanbana first)</h3>
${seq(['hakaze', ['ikishoten'], 'shifu', 'kasha', 'hakaze', ['tincture'], 'jinpu', ['kaiten'], 'higanbana', ['senei'], 'gekko', ['meikyoShisui'], 'kasha', ['shinten'], 'yukikaze', ['kaiten'], 'midareSetsugekka', 'kaeshiSetsugekka', ...(V.oldMeditation ? [] : [['shoha']]), 'gekko'])}
<p>${V.oldMeditation ? 'No 2019 Balance opener survives. This is the 5.25 one, which follows the same 60s loop, without its Shoha.' : 'From The Balance\'s "Bushido" guide and Jahaudant\'s 5.3 cheat sheet.'} After it, a 60s loop of 28 GCDs at 2.14: Kaiten Midare twice, a Kaiten Higanbana, Tsubame and Meikyo every minute, Senei every two, with Yukikaze + Hagakure as filler to keep the loop on time.</p>
<p style="color:#a9a3b4">The ${V.oldMeditation ? '5.08' : '5.1–5.58'} numbers: Hakaze 200; Jinpu and Shifu ${V.jinpu}, Gekko and Kasha 480, Yukikaze ${V.yukikaze} in combo; Higanbana 250 + ${V.higanDot}; Tenka Goken 360; Midare 800; Kaeshi: Higanbana 375 + ${V.kaeshiDot}, Goken 540, Setsugekka 1,200; Shinten 320; Kyuten 150; Senei 1,100; Guren 850; Shoha ${V.oldMeditation ? '100–500' : '400'}; Enpi 100 (320 Enhanced); Fuga 100, Mangetsu / Oka 160; auto-attacks 110 at 2.64s. Gear: ${V.gear}, pre-6.0 stats from the 5.58 game data.</p>`;
    }
  }

  B.registerJob({
    id: 'sam', name: 'Samurai', abbr: 'SAM', role: 'melee', classJob: 34,
    versions: ['shb51', 'shb505'].map(v => ({ id: v, label: VERSIONS[v].label, history: VERSIONS[v].history, note: VERSIONS[v].note, create: () => new SamuraiShB(v) })),
  });
})(window.BLM);
