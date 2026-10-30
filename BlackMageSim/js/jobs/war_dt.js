// Warrior, Dawntrail at level 100, in two versions. Built on the Endwalker class (war_ew.js, 6.1's rules: only Fell
// Cleave and Decimate use Inner Release's three stacks), with 7.0's additions: Primal Rend grants Primal Ruination
// Ready for Primal Ruination (a critical direct hit GCD); each Fell Cleave or Decimate on an Inner Release stack adds
// a Burgeoning Fury stack, and three give Wrathful for Primal Wrath (700, an oGCD on the Inner Release button);
// Nascent Chaos turns Fell Cleave into Inner Chaos only with 50 gauge or more; Damnation replaces Vengeance.
//  - 7.0: Primal Ruination 740 with a 30s Ready, Heavy Swing 220, Storm's Path / Eye 480, Upheaval 400, the
//    Primal actions 70% less on the rest; launch-week gear.
//  - 7.01–7.57: Primal Ruination Ready 20s; 7.2's Heavy Swing 240, Storm's Path / Eye 500, Upheaval 420, Chaotic
//    Cyclone 200 and 50% falloff; 7.5's Inner Chaos 700, Primal Rend 720 and Primal Ruination 800. The 7.55 gear.
// Numbers are the game data at 7.0, 7.01, 7.2, 7.41 and 7.57 (xivapi's datamining) and the Lodestone notes.
// ref: a scripted bot parses about 13,760 / 25,180 on these.
(function (B) {
  const EW = B.WarriorEW;
  const ws = (o) => Object.assign({ kind: 'gcd', target: true, range: B.MELEE_RANGE, delay: 0.55, fx: 'gnbSlash' }, o);
  const ab = (o) => Object.assign({ kind: 'ogcd' }, o);
  const VERSIONS = {
    dt70: { label: 'Dawntrail 7.0–7.0', history: 'DT 7.0–7.0', heavy: 220, path: [200, 480], chaos: 660, rend: 700, ruin: 740, ruinReady: 30, upheaval: 400, cyclone: 300, fall: 0.3,
      tincture: 'strdt1', ref: 14590,
      stats: { hp: 183476, main: 4263, wd: 141, det: 2048, crit: 2292, dh: 1351, speed: 751, ten: 1217 },
      gear: 'The Balance\'s 7.0 pre-raid set (Strength 4,263, 141 weapon damage, a 2.46 GCD), with a Grade 1 Gemdraught',
      note: 'Level 100 at launch: Primal Ruination after Primal Rend (Ready 30s), Primal Wrath from three Burgeoning Fury, Inner Chaos only at 50 gauge; pre-raid gear' },
    dt71: { label: 'Dawntrail 7.01–7.57', history: 'DT 7.01–7.57', heavy: 240, path: [220, 500], chaos: 700, rend: 720, ruin: 800, ruinReady: 20, upheaval: 420, cyclone: 200, fall: 0.5,
      tincture: 'strdt4', ref: 26690,
      stats: { hp: 325419, main: 6472, wd: 158, det: 3066, crit: 3595, dh: 1230, speed: 420, ten: 622 },
      gear: 'The Balance\'s 7.55 savage set (Strength 6,472, 158 weapon damage, 2.50), with a Grade 4 Gemdraught',
      note: 'Level 100: Primal Ruination Ready 20s, 7.2\'s combo and Upheaval, 7.5\'s Inner Chaos 700, Primal Rend 720 and Primal Ruination 800; the 7.55 savage gear' },
  };
  const set = B.setAction;     // a version's change to an action (its description's numbers follow the potency)

  class WarriorDT extends EW {
    constructor(version) {
      super('ew61');
      const V = VERSIONS[version];
      this.V = Object.assign({}, this.V, V);
      this.level = 100;
      this.levelKey = 100;
      this.model = 'war-dt';
      const A = Object.assign({}, this.actions);
      set(A, 'heavySwing', { potency: V.heavy, desc: `Delivers an attack with a potency of ${V.heavy}.` });
      set(A, 'maim', { potency: 190, comboPotency: 340, desc: 'Delivers an attack with a potency of 190.\nCombo Action: Heavy Swing\nCombo Potency: 340\nCombo Bonus: Increases Beast Gauge by 10' });
      set(A, 'stormsPath', { potency: V.path[0], comboPotency: V.path[1], desc: `Delivers an attack with a potency of ${V.path[0]}.\nCombo Action: Maim\nCombo Potency: ${V.path[1]}\nCombo Bonus: Restores own HP\nCombo Bonus: Increases Beast Gauge by 20` });
      set(A, 'stormsEye', { potency: V.path[0], comboPotency: V.path[1], desc: `Delivers an attack with a potency of ${V.path[0]}.\nCombo Action: Maim\nCombo Potency: ${V.path[1]}\nCombo Bonus: Grants Surging Tempest (damage dealt +10%), extending it by 30s to a maximum of 60s\nCombo Bonus: Increases Beast Gauge by 10` });
      set(A, 'fellCleave', { potency: 580, desc: 'Delivers an attack with a potency of 580.\nBeast Gauge Cost: 50\nInner Release: no cost, a guaranteed critical direct hit, and a stack of Burgeoning Fury.\n※Changes to Inner Chaos under Nascent Chaos with 50 Beast Gauge or more.' });
      set(A, 'innerChaos', { potency: V.chaos, desc: `Delivers an attack with a potency of ${V.chaos}.\nThis attack is guaranteed to be both a critical and a direct hit.\nBeast Gauge Cost: 50\nCan only be executed while under the effect of Nascent Chaos.` });
      set(A, 'primalRend', { potency: V.rend, aoe: V.fall, desc: `Delivers a jumping attack with a potency of ${V.rend} to target and all enemies nearby it, ${Math.round((1 - V.fall) * 100)}% less for the rest.\nThis attack is guaranteed to be both a critical and a direct hit.\nAdditional Effect: Grants Primal Ruination Ready\nDuration: ${V.ruinReady}s\nCan only be executed while under the effect of Primal Rend Ready.` });
      A.primalRuination = ws({ name: 'Primal Ruination', potency: V.ruin, range: B.MELEE_RANGE, aoe: V.fall, fx: 'gnbZone', desc: `Delivers an attack with a potency of ${V.ruin} to target and all enemies nearby it, ${Math.round((1 - V.fall) * 100)}% less for the rest.\nThis attack is guaranteed to be both a critical and a direct hit.\nCan only be executed while under the effect of Primal Ruination Ready.` });
      A.primalWrath = ab({ name: 'Primal Wrath', recast: 1, potency: 700, target: true, range: 20, delay: 0.6, aoe: V.fall, fx: 'gnbBurst', desc: `Delivers an attack with a potency of 700 to target and all enemies nearby it, ${Math.round((1 - V.fall) * 100)}% less for the rest.\nCan only be executed while under the effect of Wrathful.` });
      set(A, 'upheaval', { potency: V.upheaval, desc: `Delivers an attack with a potency of ${V.upheaval}.\nShares a recast timer with Orogeny.` });
      set(A, 'mythrilTempest', { comboPotency: 140, desc: 'Delivers an attack with a potency of 100 to all nearby enemies.\nCombo Action: Overpower\nCombo Potency: 140\nCombo Bonus: Surging Tempest +30s (up to 60s)\nCombo Bonus: Increases Beast Gauge by 20' });
      set(A, 'decimate', { potency: 180, desc: 'Delivers an attack with a potency of 180 to all nearby enemies.\nBeast Gauge Cost: 50' });
      set(A, 'chaoticCyclone', { potency: V.cyclone, desc: `Delivers a critical direct hit with a potency of ${V.cyclone} to all nearby enemies.\nBeast Gauge Cost: 50\nCan only be executed while under the effect of Nascent Chaos.` });
      set(A, 'innerRelease', { desc: 'Grants 3 stacks of Inner Release: Fell Cleave and Decimate use one, cost no gauge, are guaranteed critical direct hits and add a stack of Burgeoning Fury (three give Wrathful).\nDuration: 15s\nAdditional Effect: Grants Primal Rend Ready\nDuration: 30s\nAdditional Effect: Extends Surging Tempest by 10s\nInner Release changes to Primal Wrath while Wrathful.' });
      delete A.vengeance;
      A.damnation = ab({ name: 'Damnation', recast: 120, desc: 'Reduces damage taken by 40% and delivers an attack with a potency of 55 every time you suffer physical damage.\nDuration: 15s\nAdditional Effect: Primeval Impulse when it ends' });
      A.tincture = B.tincture(V.tincture);
      this.actions = A;
      this.statuses = Object.assign({}, this.statuses, {
        primalRuinationReady: { name: 'Primal Ruination Ready', self: true, icon: 'st_prr' },
        burgeoningFury: { name: 'Burgeoning Fury', self: true, icon: 'st_ir' },
        wrathful: { name: 'Wrathful', self: true, icon: 'st_ir' },
        damnation: { name: 'Damnation', self: true, icon: 'st_vengeance' },
      });
      this.stats = Object.assign({ mainStat: 'str', jobMod: 105, trait: 100, delay: 3.36 }, V.stats);
      this.selfStatusOrder = ['surgingTempest', 'innerRelease', 'primalRendReady', 'primalRuinationReady', 'burgeoningFury', 'wrathful', 'nascentChaos', 'defiance',
        'medicated', 'rampart', 'bloodwhetting', 'thrillOfBattle', 'damnation', 'holmgang', 'shakeItOff', 'armsLength', 'sprint'];
      this.defaultBars = [
        ['heavySwing', 'maim', 'stormsPath', 'stormsEye', 'fellCleave', 'primalRend', 'infuriate', 'innerRelease', 'upheaval', 'onslaught', 'tomahawk', 'tincture'],
        ['overpower', 'mythrilTempest', 'decimate', 'orogeny', 'defiance', 'rampart', 'bloodwhetting', 'thrillOfBattle', 'damnation', 'holmgang', 'equilibrium', 'shakeItOff'],
        ['provoke', 'reprisal', 'shirk', 'lowBlow', 'interject', 'armsLength', 'sprint', null, null, null, null, null],
      ];
      this.actionGroups = [
        ['Warrior', ['heavySwing', 'maim', 'stormsPath', 'stormsEye', 'tomahawk', 'fellCleave', 'innerChaos', 'primalRend', 'primalRuination', 'overpower',
          'mythrilTempest', 'decimate', 'chaoticCyclone', 'infuriate', 'innerRelease', 'primalWrath', 'upheaval', 'orogeny', 'onslaught', 'defiance',
          'bloodwhetting', 'thrillOfBattle', 'damnation', 'holmgang', 'equilibrium', 'shakeItOff']],
        ['Role Actions', ['rampart', 'lowBlow', 'provoke', 'interject', 'reprisal', 'armsLength', 'shirk']],
        ['General', ['sprint', 'tincture']],
      ];
      this.referenceDps = V.ref;
    }

    // Inner Chaos needs 50 gauge as well as Nascent Chaos; Primal Rend and Inner Release turn into their follow-ups.
    resolveId(id, e) {
      const g = e.g;
      if (id === 'fellCleave') return e.has('nascentChaos') && g.beast >= 50 ? 'innerChaos' : id;
      if (id === 'decimate') return e.has('nascentChaos') && g.beast >= 50 ? 'chaoticCyclone' : id;
      if (id === 'primalRend' && e.has('primalRuinationReady')) return 'primalRuination';
      if (id === 'innerRelease' && e.has('wrathful')) return 'primalWrath';
      return id;
    }

    check(id, e) {
      if (id === 'primalRuination' && !e.has('primalRuinationReady')) return 'Unable to execute action. Primal Ruination Ready required.';
      if (id === 'primalWrath' && !e.has('wrathful')) return 'Unable to execute action. Wrathful required.';
      return super.check(id, e);
    }

    resolve(id, e) {
      const a = this.actions[id];
      switch (id) {
        case 'primalRuination':
          e.removeStatus('primalRuinationReady');
          e.queueHit(id, a.potency, this.snapshot(a, e), a.delay, null, { crit: true, dh: true, dhDet: true });
          return;
        case 'primalWrath':
          e.removeStatus('wrathful');
          e.queueHit(id, a.potency, this.snapshot(a, e), a.delay);
          return;
        case 'damnation': e.addStatus('damnation', 15); return;
        case 'fellCleave': case 'decimate': {
          const fury = this.usesIr(id, e);
          super.resolve(id, e);
          if (fury) {
            const n = (e.has('burgeoningFury') ? e.statuses.burgeoningFury.stacks || 0 : 0) + 1;
            if (n >= 3) { e.removeStatus('burgeoningFury'); e.addStatus('wrathful', 30); }
            else e.addStatus('burgeoningFury', 30, { stacks: n });
          }
          return;
        }
        case 'primalRend':
          super.resolve(id, e);
          e.addStatus('primalRuinationReady', this.V.ruinReady);
          return;
      }
      super.resolve(id, e);
    }

    proc(id, e) {
      if (id === 'primalRend') return e.has('primalRendReady') || e.has('primalRuinationReady');
      if (id === 'innerRelease') return e.has('wrathful');
      return super.proc(id, e);
    }

    helpHtml(seq) {
      const V = this.V;
      return `
<h3>How it plays (${V.label})</h3>
<p>Level 100 Warrior. <b>Heavy Swing → Maim → Storm's Eye</b> keeps <b>Surging Tempest</b> up (+10% damage, 30s a time up to 60s); otherwise finish with <b>Storm's Path</b> (+20 Beast Gauge). Spend 50 gauge on <b>Fell Cleave</b> (580). <b>Infuriate</b> (two charges) adds 50 and Nascent Chaos, which turns Fell Cleave into <b>Inner Chaos</b> (${V.chaos}, a critical direct hit) while you have 50 gauge or more. Every gauge spender takes 5s off Infuriate.</p>
<p><b>Inner Release</b> (60s) gives three stacks: Fell Cleave uses one, costs nothing and is a critical direct hit. Each such Fell Cleave adds a <b>Burgeoning Fury</b> stack; the third gives <b>Wrathful</b>, and Inner Release's button becomes <b>Primal Wrath</b> (700). Inner Release also readies <b>Primal Rend</b> (${V.rend}, a jumping critical direct hit), which readies <b>Primal Ruination</b> (${V.ruin}, ${V.ruinReady}s). Put <b>Upheaval</b> (${V.upheaval}) and the <b>Onslaught</b> charges in the window.</p>
<h3>The opener (The Balance)</h3>
${seq(['tomahawk', ['infuriate'], 'heavySwing', 'maim', 'stormsEye', ['innerRelease'], ['tincture'], 'innerChaos', ['upheaval'], ['onslaught'], 'fellCleave', ['onslaught'], 'fellCleave', ['onslaught'], 'fellCleave', ['primalWrath'], ['infuriate'], 'primalRend', 'primalRuination', 'innerChaos', 'heavySwing', 'maim', 'stormsPath', 'fellCleave', ['infuriate'], 'innerChaos'])}
<p>Tomahawk at -0.7s with Infuriate; Inner Release and the potion after Storm's Eye; the first Inner Chaos lands with the party's buffs, then the three free Fell Cleaves, Primal Wrath, Primal Rend and Primal Ruination.</p>
<p style="color:#a9a3b4">${V.label} numbers: Heavy Swing ${V.heavy}, Maim 340 and Storm's Path / Eye ${V.path[1]} in combo, Fell Cleave 580, Inner Chaos ${V.chaos}, Primal Rend ${V.rend}, Primal Ruination ${V.ruin}, Primal Wrath 700, Upheaval ${V.upheaval}, Onslaught 150, Tomahawk 150; auto-attacks 90 at 3.36s. AoE: Overpower 110, Mythril Tempest 140, Decimate 180, Chaotic Cyclone ${V.cyclone}, Orogeny 150.${V.ruinReady === 20 ? ' Inside 7.01–7.57: 7.01–7.1 had Heavy Swing 220, Storm\'s Path / Eye 480, Upheaval 400, Chaotic Cyclone 300, Inner Chaos 660, Primal Rend 700 and Primal Ruination 780; 7.2–7.41 had Inner Chaos 660, Primal Rend 700 and Primal Ruination 780.' : ''} Gear: ${V.gear}.</p>`;
    }
  }

  B.registerJob({
    id: 'war', name: 'Warrior', abbr: 'WAR', role: 'tank', classJob: 21,
    versions: ['dt71', 'dt70'].map(v => ({ id: v, label: VERSIONS[v].label, history: VERSIONS[v].history, note: VERSIONS[v].note, create: () => new WarriorDT(v) })),
  });
})(window.BLM);
