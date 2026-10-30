// Dancer, Dawntrail 7.0–7.57 at level 100. Built on the Endwalker 6.1 class (dnc_ew.js): the dances, Silken and
// Flourishing procs held apart, Esprit from your own weaponskills, Starfall Dance and the Fan Dances. Dawntrail adds
// Last Dance (540, readied by Standard Finish or Finishing Move), Finishing Move (850: Flourish readies it, it shares
// Standard Step's 30s and gives the +5% Standard Finish without dancing) and Dance of the Dawn (1,000 for 50 Esprit,
// readied by Technical Finish); Tillana is now a 600-potency 2.5s GCD that gives 50 Esprit instead of Standard Finish.
// Standard Finish is 850 at two steps and Technical Finish 1,300 at four. The 7.4–7.57 numbers (Saber Dance 540, Fan
// Dance IV 460; 7.1 raised Fan Dance to 180 and Fan Dance III to 220). Numbers are the game data at 7.0, 7.05, 7.1,
// 7.2, 7.3, 7.41 and 7.57 (xivapi's datamining) and the Lodestone notes; gear is The Balance's 7.4+ savage set.
// ref: a scripted bot alone parses about 28,650 on this.
(function (B) {
  const EW = B.DancerEW;
  const ws = (o) => Object.assign({ kind: 'gcd', target: true, range: 25, delay: 0.5, fx: 'gnbSlash' }, o);
  const set = (A, id, o) => { A[id] = Object.assign({}, A[id], o); };

  class DancerDT extends EW {
    constructor() {
      super('ew61');
      this.V = Object.assign({}, this.V, { label: 'Dawntrail 7.0–7.57', tincture: 'dexdt4', gcd: 2.5 });
      this.level = 100;
      this.levelKey = 100;
      this.model = 'dnc-dt';
      this.STD = [360, 540, 850];
      this.TECH = [350, 540, 720, 900, 1300];
      const A = Object.assign({}, this.actions);
      set(A, 'fountain', { potency: 120, desc: 'Delivers an attack with a potency of 120.\nCombo Action: Cascade\nCombo Potency: 280\nCombo Bonus: 50% chance of granting Silken Flow\nDuration: 30s' });
      set(A, 'saberDance', { potency: 540, aoe: 0.4, desc: 'Delivers an attack to target and all enemies nearby it with a potency of 540 for the first enemy, and 60% less for all remaining enemies.\nEsprit Gauge Cost: 50\n※Changes to Dance of the Dawn while under the effect of Dance of the Dawn Ready.' });
      set(A, 'standardFinish', { aoe: 0.4, desc: 'Delivers an attack to all nearby enemies. Potency varies with number of successful steps, dealing full potency for the first enemy, and 60% less for all remaining enemies.\n0 Steps: 360\n1 Step: 540\n2 Steps: 850\nAdditional Effect: Grants Standard Finish (+2% / +5% damage), Esprit and Last Dance Ready\nDuration: 60s (Last Dance Ready 30s)' });
      set(A, 'technicalFinish', { aoe: 0.4, desc: 'Delivers an attack to all nearby enemies. Potency varies with number of successful steps, dealing full potency for the first enemy, and 60% less for all remaining enemies.\n0 Steps: 350\n1 Step: 540\n2 Steps: 720\n3 Steps: 900\n4 Steps: 1,300\nAdditional Effect: Grants Technical Finish (+1% to +5% damage) to self and party\nDuration: 20s\nAdditional Effect: Grants Flourishing Finish and Dance of the Dawn Ready\nDuration: 30s' });
      set(A, 'tillana', { potency: 600, fixedRecast: undefined, aoe: 0.4, desc: 'Delivers an attack to all nearby enemies with a potency of 600 for the first enemy, and 60% less for all remaining enemies.\nAdditional Effect: Increases Esprit Gauge by 50\nCan only be executed while under the effect of Flourishing Finish.' });
      set(A, 'fanDance', { potency: 180, desc: 'Delivers an attack with a potency of 180.\nAdditional Effect: 50% chance of granting Threefold Fan Dance\nDuration: 30s\nCan only be executed while in possession of Fourfold Feathers.' });
      set(A, 'fanDance3', { potency: 220, aoe: 0.4, desc: 'Delivers an attack to target and all enemies nearby it with a potency of 220 for the first enemy, and 60% less for all remaining enemies.\nCan only be executed while under the effect of Threefold Fan Dance.' });
      set(A, 'fanDance4', { potency: 460, aoe: 0.4, desc: 'Delivers an attack to all enemies in a cone before you with a potency of 460 for the first enemy, and 60% less for all remaining enemies.\nCan only be executed while under the effect of Fourfold Fan Dance.' });
      set(A, 'windmill', { potency: 120 });
      set(A, 'bladeshower', { comboPotency: 160 });
      set(A, 'risingWindmill', { potency: 160 });
      set(A, 'bloodshower', { potency: 200 });
      A.lastDance = ws({ name: 'Last Dance', potency: 540, aoe: 0.4, ready: 'lastDanceReady', fx: 'gnbZone', desc: 'Delivers an attack to target and all enemies nearby it with a potency of 540 for the first enemy, and 60% less for all remaining enemies.\nCan only be executed while under the effect of Last Dance Ready.' });
      A.finishingMove = ws({ name: 'Finishing Move', potency: 850, target: false, pbaoe: 15, aoe: 0.4, cd: 30, cdGroup: 'standardStep', ready: 'finishingMoveReady', delay: 0.6, fx: 'gnbZone',
        desc: 'Delivers an attack to all nearby enemies with a potency of 850 for the first enemy, and 60% less for all remaining enemies.\nAdditional Effect: Grants Standard Finish (+5% damage) and Esprit\nDuration: 60s\nAdditional Effect: Grants Last Dance Ready\nDuration: 30s\nShares a recast timer with Standard Step.\nCan only be executed while under the effect of Finishing Move Ready.' });
      A.danceOfTheDawn = ws({ name: 'Dance of the Dawn', potency: 1000, esprit: 50, aoe: 0.4, ready: 'danceOfTheDawnReady', fx: 'gnbDouble', desc: 'Delivers an attack to target and all enemies nearby it with a potency of 1,000 for the first enemy, and 60% less for all remaining enemies.\nEsprit Gauge Cost: 50\nCan only be executed while under the effect of Dance of the Dawn Ready.' });
      set(A, 'flourish', { desc: 'Grants you the effects of Flourishing Symmetry, Flourishing Flow, Threefold Fan Dance, Fourfold Fan Dance and Finishing Move Ready.\nDuration: 30s\nCan only be executed while in combat.' });
      set(A, 'shieldSamba', { desc: 'Reduces damage taken by self and nearby party members by 15%.\nDuration: 15s' });
      A.tincture = B.tincture('dexdt4');
      this.actions = A;
      this.statuses = Object.assign({}, this.statuses, {
        lastDanceReady: { name: 'Last Dance Ready', self: true, icon: 'st_ffinish' },
        finishingMoveReady: { name: 'Finishing Move Ready', self: true, icon: 'st_ffinish' },
        danceOfTheDawnReady: { name: 'Dance of the Dawn Ready', self: true, icon: 'st_starfall' },
      });
      this.selfStatusOrder = this.selfStatusOrder.slice(0, 15).concat(['lastDanceReady', 'finishingMoveReady', 'danceOfTheDawnReady'], this.selfStatusOrder.slice(15));
      this.stats = { mainStat: 'dex', jobMod: 115, trait: 120, delay: 3.12, hp: 215712, main: 6516, wd: 158, det: 2509, crit: 3549, dh: 2035, speed: 420 };
      this.defaultBars = [
        ['cascade', 'fountain', 'reverseCascade', 'fountainfall', 'saberDance', 'standardStep', 'technicalStep', 'tillana', 'starfallDance', 'lastDance', 'fanDance', 'fanDance3'],
        ['devilment', 'flourish', 'fanDance4', 'tincture', 'windmill', 'bladeshower', 'risingWindmill', 'bloodshower', 'fanDance2', 'improvisation', 'closedPosition', 'shieldSamba'],
        ['curingWaltz', 'enAvant', 'headGraze', 'secondWind', 'legGraze', 'footGraze', 'peloton', 'armsLength', 'sprint', null, null, null],
      ];
      this.actionGroups = [
        ['Dancer', ['cascade', 'fountain', 'reverseCascade', 'fountainfall', 'windmill', 'bladeshower', 'risingWindmill', 'bloodshower', 'saberDance',
          'danceOfTheDawn', 'tillana', 'starfallDance', 'lastDance', 'standardStep', 'technicalStep', 'emboite', 'entrechat', 'jete', 'pirouette',
          'standardFinish', 'technicalFinish', 'finishingMove', 'fanDance', 'fanDance2', 'fanDance3', 'fanDance4', 'devilment', 'flourish', 'improvisation',
          'closedPosition', 'shieldSamba', 'curingWaltz', 'enAvant']],
        ['Role Actions', ['legGraze', 'secondWind', 'footGraze', 'peloton', 'headGraze', 'armsLength']],
        ['General', ['sprint', 'tincture']],
      ];
      this.referenceDps = 30380;
      this.referenceGcd = 2.5;
    }

    // Standard Step plays Finishing Move under Finishing Move Ready; Saber Dance plays Dance of the Dawn when readied.
    resolveId(id, e) {
      if (id === 'standardStep' && !this.dancing(e) && e.has('finishingMoveReady')) return 'finishingMove';
      if (id === 'saberDance' && e.has('danceOfTheDawnReady')) return 'danceOfTheDawn';
      return super.resolveId(id, e);
    }

    resolve(id, e) {
      const a = this.actions[id], g = e.g;
      switch (id) {
        case 'tillana':
          e.removeStatus('flourishingFinish');
          this.esprit(e, 50);
          e.queueHit(id, a.potency, this.snapshot(a, e), a.delay);
          return;
        case 'finishingMove':
          e.removeStatus('finishingMoveReady');
          g.stdBuff = 0.05;
          e.addStatus('standardFinish', 60);
          if (!e.has('esprit') || e.statuses.esprit.until - e.now < 60) e.addStatus('esprit', 60);
          e.addStatus('lastDanceReady', 30);
          e.queueHit(id, a.potency, this.snapshot(a, e), a.delay);
          return;
        case 'standardFinish': super.resolve(id, e); e.addStatus('lastDanceReady', 30); return;
        case 'technicalFinish': super.resolve(id, e); e.addStatus('danceOfTheDawnReady', 30); return;
        case 'flourish': super.resolve(id, e); e.addStatus('finishingMoveReady', 30); return;
      }
      super.resolve(id, e);
    }

    proc(id, e) {
      if (id === 'standardStep' && e.has('finishingMoveReady')) return true;
      if (id === 'saberDance' && e.has('danceOfTheDawnReady') && e.g.esprit >= 50) return true;
      return super.proc(id, e);
    }

    speedInfo(e) { return `GCD ${e.gcdForSpeed(e.stats.speed).toFixed(2)} · steps 1.0s, Step and Finish 1.5s`; }

    helpHtml(seq) {
      return `
<h3>How it plays (Dawntrail 7.0–7.57)</h3>
<p>Level 100 Dancer. <b>Cascade → Fountain</b> (220 / 280) each have a 50% chance of a Silken proc for <b>Reverse Cascade</b> (280) or <b>Fountainfall</b> (340), which have a 50% chance of a Fourfold Feather for <b>Fan Dance</b> (180) and its Threefold proc (<b>Fan Dance III</b>, 220). Your weaponskills build <b>Esprit</b> while it's up (+5, procs +10); spend 50 on <b>Saber Dance</b> (540).</p>
<p><b>Standard Step</b> (30s, two steps) into <b>Standard Finish</b> (850, +5% for 60s) readies <b>Last Dance</b> (540). Every other 30s, <b>Flourish</b> (60s) readies <b>Finishing Move</b> on the same button (850, the same +5% without dancing, and Last Dance again). Every two minutes, <b>Technical Step</b> (four steps) into <b>Technical Finish</b> (1,300, +5% for 20s) with <b>Devilment</b> (+20% crit and direct hit, and <b>Starfall Dance</b>, 600, a critical direct hit) readies <b>Tillana</b> (600, +50 Esprit) and <b>Dance of the Dawn</b> on Saber Dance's button (1,000 for 50 Esprit). Flourish also gives the Flourishing procs and <b>Fan Dance IV</b> (460).</p>
<h3>The opener (The Balance)</h3>
${seq(['standardStep', 'emboite', 'entrechat', ['tincture'], 'standardFinish', 'technicalStep', 'emboite', 'entrechat', 'jete', 'pirouette', 'technicalFinish', ['devilment'], 'tillana', ['flourish'], 'danceOfTheDawn', ['fanDance4'], 'lastDance', ['fanDance3'], 'finishingMove', 'starfallDance', 'saberDance'])}
<p>Standard Step and its steps from −15s, the tincture at −1s, Standard Finish at the pull. In later bursts with 50+ Esprit, Tillana can wait; keep Finishing Move on cooldown and spend a held Last Dance before it.</p>
<p style="color:#a9a3b4">The 7.4–7.57 numbers: Cascade 220, Fountain 120 / 280, Reverse Cascade 280, Fountainfall 340, Saber Dance 540, Dance of the Dawn 1,000, Standard Finish 360 / 540 / 850, Technical Finish 350 / 540 / 720 / 900 / 1,300, Finishing Move 850, Last Dance 540, Tillana 600, Starfall Dance 600, Fan Dance 180, III 220, IV 460; auto-attacks 90 at 3.12s. 7.0–7.01 had Saber Dance and Last Dance 520, Fan Dance 150, Fan Dance III 200 and Fan Dance IV 300 (420 from 7.05). Gear: The Balance's 7.4+ savage set (Dexterity 6,516, 158 weapon damage), with a Grade 4 Gemdraught. Alone on a dummy: no dance partner.</p>`;
    }
  }

  B.registerJob({
    id: 'dnc', name: 'Dancer', abbr: 'DNC', role: 'ranged', classJob: 38,
    versions: [{ id: 'dt70', label: 'Dawntrail 7.0–7.57', history: 'DT 7.0–7.57', note: 'Level 100: Last Dance, Finishing Move from Flourish, Dance of the Dawn, Tillana for Esprit; the 7.4 numbers', create: () => new DancerDT() }],
  });
})(window.BLM);
