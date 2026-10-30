// Dancer, Endwalker at level 90, in two versions. Built on the Shadowbringers class (dnc_shb.js) for the dances, with
// what 6.0 added: Esprit is no longer a chance (+5 from Cascade / Fountain, +10 from Reverse Cascade / Fountainfall
// while Esprit is up), Technical Finish opens Tillana (360, and Standard Finish again), Devilment opens Starfall Dance
// (600, a critical direct hit), Flourish gives Fan Dance IV (300) as well as the procs and Fan Dance III, and combos
// last 30s.
//  - 6.0–6.08: Flourish grants the same Flourishing Symmetry / Flow as Cascade and Fountain, so it wastes a proc you hold;
//    the 6.08 potencies (Cascade 220, Fountain 280, Reverse Cascade 280, Fountainfall 340, Technical Finish 1,200).
//  - 6.1–6.58: Cascade and Fountain give Silken Symmetry / Flow and Flourish its own Flourishing ones, so you can hold
//    both; from 6.2 Starfall Dance's guaranteed hit also gains from the Direct Hit stat. No potency changed after 6.08.
// Numbers are the game data at 6.08 and 6.58 and the Lodestone notes; gear is The Balance's set for each tier. ref: a
// scripted bot alone parses about 10,450 / 6,610 on these.
(function (B) {
  const SHB = B.DancerShB;
  const set = B.setAction;     // a version's change to an action (its description's numbers follow the potency)
  const VERSIONS = {
    ew61: { label: 'Endwalker 6.1–6.58', history: 'EW 6.1–6.58', silken: true, dhDet: true, tincture: 'dex8', gcd: 2.49, ref: 11070,
      stats: { hp: 80000, main: 3379, wd: 132, det: 1952, crit: 2557, dh: 1380, speed: 436 },
      gear: 'The Balance\'s 6.55 relic set at 2.49 (Dexterity 3,379, 132 weapon damage)',
      note: 'Level 90: Silken and Flourishing procs held apart, Tillana, Starfall Dance, Fan Dance IV, Esprit from your own weaponskills; Anabaseios gear' },
    ew60: { label: 'Endwalker 6.0–6.08', history: 'EW 6.0–6.08', silken: false, dhDet: false, tincture: 'dex6', gcd: 2.47, ref: 7010,
      stats: { hp: 70000, main: 2575, wd: 120, det: 1453, crit: 2283, dh: 1477, speed: 549 },
      gear: 'The Balance\'s 6.08 "2.47 General All-Purpose" set (Dexterity 2,575, 120 weapon damage)',
      note: 'Level 90, the launch kit: Flourish shares Cascade and Fountain\'s procs (and can waste them), Tillana, Starfall Dance, Fan Dance IV; Asphodelos gear' },
  };
  const ws = (o) => Object.assign({ kind: 'gcd', target: true, range: 25, delay: 0.5, fx: 'gnbSlash' }, o);
  const ab = (o) => Object.assign({ kind: 'ogcd' }, o);

  class DancerEW extends SHB {
    constructor(version) {
      super();
      const V = VERSIONS[version];
      this.V = V;
      this.level = 90;
      this.levelKey = 90;
      this.model = 'dnc-ew';
      this.comboTime = 30;
      this.STD = [360, 540, 720];
      this.TECH = [350, 540, 720, 900, 1200];
      const A = Object.assign({}, this.actions);
      const sym = V.silken ? 'Silken Symmetry' : 'Flourishing Symmetry', flow = V.silken ? 'Silken Flow' : 'Flourishing Flow';
      const either = (s) => V.silken ? `${s.replace('Silken', 'Silken')} or ${s.replace('Silken', 'Flourishing')}` : s;
      set(A, 'cascade', { potency: 220, procs: 'silkenSymmetry', espritGain: 5, desc: `Delivers an attack with a potency of 220.\nAdditional Effect: 50% chance of granting ${sym}\nDuration: 30s\n※Action changes to Emboite while dancing.` });
      set(A, 'fountain', { potency: 100, comboPotency: 280, procs: 'silkenFlow', espritGain: 5, desc: `Delivers an attack with a potency of 100.\nCombo Action: Cascade\nCombo Potency: 280\nCombo Bonus: 50% chance of granting ${flow}\nDuration: 30s\n※Action changes to Entrechat while dancing.` });
      set(A, 'reverseCascade', { potency: 280, ready: undefined, sym: 'Symmetry', espritGain: 10, desc: `Delivers an attack with a potency of 280.\nAdditional Effect: 50% chance of granting a Fourfold Feather\nCan only be executed while under the effect of ${either(sym)}.\n※Action changes to Jete while dancing.` });
      set(A, 'fountainfall', { potency: 340, ready: undefined, sym: 'Flow', espritGain: 10, desc: `Delivers an attack with a potency of 340.\nAdditional Effect: 50% chance of granting a Fourfold Feather\nCan only be executed while under the effect of ${either(flow)}.\n※Action changes to Pirouette while dancing.` });
      set(A, 'windmill', { potency: 100, procs: 'silkenSymmetry', espritGain: 5, desc: `Delivers an attack with a potency of 100 to all nearby enemies.\nAdditional Effect: 50% chance of granting ${sym}\nDuration: 30s` });
      set(A, 'bladeshower', { potency: 100, comboPotency: 140, procs: 'silkenFlow', espritGain: 5, desc: `Delivers an attack with a potency of 100 to all nearby enemies.\nCombo Action: Windmill\nCombo Potency: 140\nCombo Bonus: 50% chance of granting ${flow}\nDuration: 30s` });
      set(A, 'risingWindmill', { potency: 140, ready: undefined, sym: 'Symmetry', espritGain: 10, desc: `Delivers an attack to all nearby enemies with a potency of 140 for the first enemy, and 50% less for all remaining enemies.\nAdditional Effect: 50% chance of granting a Fourfold Feather\nCan only be executed while under the effect of ${either(sym)}.` });
      set(A, 'bloodshower', { potency: 180, ready: undefined, sym: 'Flow', espritGain: 10, desc: `Delivers an attack to all nearby enemies with a potency of 180 for the first enemy, and 50% less for all remaining enemies.\nAdditional Effect: 50% chance of granting a Fourfold Feather\nCan only be executed while under the effect of ${either(flow)}.` });
      set(A, 'saberDance', { potency: 480, desc: 'Delivers an attack to target and all enemies nearby it with a potency of 480 for the first enemy, and 50% less for all remaining enemies.\nEsprit Gauge Cost: 50' });
      set(A, 'standardFinish', { desc: 'Delivers an attack to all nearby enemies. Potency varies with number of successful steps, dealing full potency for the first enemy, and 75% less for all remaining enemies.\n0 Steps: 360\n1 Step: 540\n2 Steps: 720\nStep Bonus: Grants Standard Finish (+2% / +5% damage) and Esprit\nDuration: 60s' });
      set(A, 'technicalFinish', { desc: 'Delivers an attack to all nearby enemies. Potency varies with number of successful steps, dealing full potency for the first enemy, and 75% less for all remaining enemies.\n0 Steps: 350\n1 Step: 540\n2 Steps: 720\n3 Steps: 900\n4 Steps: 1,200\nStep Bonus: Grants Technical Finish (+1–5% damage) and Esprit\nDuration: 20s\nAdditional Effect: Grants Flourishing Finish\nDuration: 30s' });
      set(A, 'fanDance', { desc: 'Delivers an attack with a potency of 150.\nAdditional Effect: 50% chance of granting Threefold Fan Dance\nDuration: 30s\nCan only be executed while in possession of Fourfold Feathers.' });
      set(A, 'fanDance2', { desc: 'Delivers an attack with a potency of 100 to all nearby enemies.\nAdditional Effect: 50% chance of granting Threefold Fan Dance\nDuration: 30s\nCan only be executed while in possession of Fourfold Feathers.' });
      set(A, 'fanDance3', { desc: 'Delivers an attack to target and all enemies nearby it with a potency of 200 for the first enemy, and 50% less for all remaining enemies.\nCan only be executed while under the effect of Threefold Fan Dance.' });
      A.fanDance4 = ab({ name: 'Fan Dance IV', recast: 1, potency: 300, target: true, range: 15, aoe: 0.5, ready: 'fourfoldFanDance', delay: 0.5, fx: 'gnbBow', desc: 'Delivers an attack to all enemies in a cone before you with a potency of 300 for the first enemy, and 50% less for all remaining enemies.\nCan only be executed while under the effect of Fourfold Fan Dance.' });
      A.tillana = ws({ name: 'Tillana', potency: 360, target: false, pbaoe: 15, aoe: 0.5, fixedRecast: 1.5, ready: 'flourishingFinish', delay: 0.6, fx: 'gnbZone', desc: 'Delivers an attack to all nearby enemies with a potency of 360 for the first enemy, and 50% less for all remaining enemies.\nAdditional Effect: Grants Standard Finish (+5% damage) and Esprit\nDuration: 60s\nCan only be executed while under the effect of Flourishing Finish.\nRecast: 1.5s' });
      A.starfallDance = ws({ name: 'Starfall Dance', potency: 600, aoe: 0.25, ready: 'flourishingStarfall', delay: 0.6, fx: 'gnbDouble', desc: `Delivers a critical direct hit to all enemies in a straight line before you with a potency of 600 for the first enemy, and 75% less for all remaining enemies.${V.dhDet ? '\nDamage dealt is increased when under an effect that raises critical hit rate or direct hit rate.' : ''}\nCan only be executed while under the effect of Flourishing Starfall.` });
      set(A, 'devilment', { desc: 'Increases critical hit rate and direct hit rate by 20%.\nDuration: 20s\nAdditional Effect: Grants Flourishing Starfall\nDuration: 20s' });
      set(A, 'flourish', { desc: `Grants you the effects of Flourishing Symmetry, Flourishing Flow, Threefold Fan Dance, and Fourfold Fan Dance.\nDuration: 30s\nCan only be executed while in combat.` });     // 6.0x: the same Symmetry / Flow as Cascade's procs (the help says so)
      set(A, 'improvisation', { desc: 'Dance to the beat of your own drum, granting Rising Rhythm to self.\nAdditional Effect: Healing over time for self and nearby party members\nDuration: 15s\nEffect ends upon using another action or moving.' });
      set(A, 'shieldSamba', { recast: 90, desc: 'Reduces damage taken by self and nearby party members by 10%.\nDuration: 15s' });
      A.tincture = B.tincture(V.tincture);
      this.actions = A;
      this.statuses = Object.assign({}, this.statuses, {
        silkenSymmetry: { name: sym, self: true, icon: 'st_sym' },
        silkenFlow: { name: flow, self: true, icon: 'st_flow' },
        flourishSymmetry: { name: 'Flourishing Symmetry', self: true, icon: 'st_fsym' },
        flourishFlow: { name: 'Flourishing Flow', self: true, icon: 'st_fflow' },
        flourishingFanDance: { name: 'Threefold Fan Dance', self: true, icon: 'st_ffan' },
        fourfoldFanDance: { name: 'Fourfold Fan Dance', self: true, icon: 'st_ffour' },
        flourishingStarfall: { name: 'Flourishing Starfall', self: true, icon: 'st_starfall' },
        flourishingFinish: { name: 'Flourishing Finish', self: true, icon: 'st_ffinish' },
      });
      this.stats = Object.assign({ mainStat: 'dex', jobMod: 115, trait: 120, delay: 3.12 }, V.stats);
      this.autoAttack = { potency: 90, delay: 3.12, range: 25 };
      this.selfStatusOrder = ['standardStep', 'technicalStep', 'technicalFinish', 'standardFinish', 'devilment', 'esprit', 'silkenSymmetry', 'silkenFlow',
        'flourishSymmetry', 'flourishFlow', 'flourishingFanDance', 'fourfoldFanDance', 'flourishingStarfall', 'flourishingFinish', 'improvisation', 'shieldSamba',
        'medicated', 'peloton', 'armsLength', 'sprint'];
      this.defaultBars = [
        ['cascade', 'fountain', 'reverseCascade', 'fountainfall', 'saberDance', 'standardStep', 'technicalStep', 'tillana', 'starfallDance', 'fanDance', 'fanDance3', 'fanDance4'],
        ['devilment', 'flourish', 'tincture', 'windmill', 'bladeshower', 'risingWindmill', 'bloodshower', 'fanDance2', 'improvisation', 'closedPosition', 'shieldSamba', 'curingWaltz'],
        ['enAvant', 'headGraze', 'secondWind', 'legGraze', 'footGraze', 'peloton', 'armsLength', 'sprint', null, null, null, null],
      ];
      this.actionGroups = [
        ['Dancer', ['cascade', 'fountain', 'reverseCascade', 'fountainfall', 'windmill', 'bladeshower', 'risingWindmill', 'bloodshower', 'saberDance',
          'tillana', 'starfallDance', 'standardStep', 'technicalStep', 'emboite', 'entrechat', 'jete', 'pirouette', 'standardFinish', 'technicalFinish',
          'fanDance', 'fanDance2', 'fanDance3', 'fanDance4', 'devilment', 'flourish', 'improvisation', 'closedPosition', 'shieldSamba', 'curingWaltz', 'enAvant']],
        ['Role Actions', ['legGraze', 'secondWind', 'footGraze', 'peloton', 'headGraze', 'armsLength']],
        ['General', ['sprint', 'tincture']],
      ];
      this.referenceDps = V.ref;
      this.referenceGcd = V.gcd;
    }

    // The proc a Symmetry / Flow weaponskill uses: the Silken one or, from 6.1, Flourish's own (whichever runs out first).
    procFor(a, e) {
      const keys = this.V.silken ? ['silken' + a.sym, 'flourish' + a.sym] : ['silken' + a.sym];
      const held = keys.filter(k => e.has(k));
      held.sort((x, y) => e.statuses[x].until - e.statuses[y].until);
      return held[0] || null;
    }

    check(id, e) {
      const a = this.actions[id];
      if (a.sym && !this.dancing(e) && !this.procFor(a, e)) return 'Unable to execute action.';
      if (id === 'flourish' && !e.inCombat) return 'Unable to execute action while not in combat.';
      return super.check(id, e);
    }

    snapshot(a, e) {
      const s = super.snapshot(a, e);
      s.main = this.stats.main + (e.has('medicated') ? B.TINCTURES[this.V.tincture].cap : 0);
      return s;
    }

    resolve(id, e) {
      const a = this.actions[id], g = e.g;
      if (a.kind === 'gcd' && !a.dance && !a.step && !a.finish) {
        const combo = !!a.comboFrom && e.lastComboHit;
        const potency = a.comboFrom && combo ? a.comboPotency : a.potency;
        if (a.sym) e.removeStatus(this.procFor(a, e));
        if (a.ready) e.removeStatus(a.ready);
        if (a.esprit) this.esprit(e, -a.esprit);
        if (a.procs && (!a.comboFrom || combo) && Math.random() < 0.5) e.addStatus(a.procs, 30);
        if (a.feather && Math.random() < 0.5) g.feathers = Math.min(4, g.feathers + 1);
        if (a.espritGain && e.has('esprit') && (!a.comboFrom || combo)) this.esprit(e, a.espritGain);
        const snap = this.snapshot(a, e);
        let opts = {};
        if (id === 'starfallDance') opts = { crit: true, dh: true, dhDet: this.V.dhDet };
        if (id === 'tillana') {
          g.stdBuff = 0.05;
          e.addStatus('standardFinish', 60);
          if (!e.has('esprit') || e.statuses.esprit.until - e.now < 60) e.addStatus('esprit', 60);
        }
        e.queueHit(id, potency, snap, a.delay, null, opts);
        return;
      }
      switch (id) {
        case 'technicalFinish': super.resolve(id, e); e.addStatus('flourishingFinish', 30); return;
        case 'devilment': e.addStatus('devilment', 20); e.addStatus('flourishingStarfall', 20); return;
        case 'flourish':
          // In 6.0x Flourish grants the same Symmetry and Flow statuses as Cascade and Fountain.
          e.addStatus(this.V.silken ? 'flourishSymmetry' : 'silkenSymmetry', 30);
          e.addStatus(this.V.silken ? 'flourishFlow' : 'silkenFlow', 30);
          e.addStatus('flourishingFanDance', 30);
          e.addStatus('fourfoldFanDance', 30);
          return;
        case 'fanDance': case 'fanDance2':
          g.feathers--;
          if (Math.random() < 0.5) e.addStatus('flourishingFanDance', 30);
          e.queueHit(id, this.actions[id].potency, this.snapshot(this.actions[id], e), this.actions[id].delay);
          return;
        case 'fanDance4': e.removeStatus('fourfoldFanDance'); e.queueHit(id, a.potency, this.snapshot(a, e), a.delay); return;
        case 'improvisation': e.addStatus('improvisation', 15); return;
      }
      super.resolve(id, e);
    }

    // No Esprit from Improvisation after 6.0.
    nextEvent() { return Infinity; }
    process() {}

    proc(id, e) {
      const a = this.actions[id];
      if (a.sym) return !!this.procFor(a, e);
      return super.proc(id, e);
    }

    helpHtml(seq) {
      const V = this.V;
      return `
<h3>How it plays (${V.label})</h3>
<p>Level 90 Dancer, alone on a dummy. <b>Cascade → Fountain</b> (220 / 280), each with a 50% proc for <b>Reverse Cascade</b> (280) or <b>Fountainfall</b> (340), which each have a 50% chance of a Fourfold Feather for <b>Fan Dance</b> (150, 50% Fan Dance III). Combos last 30s. While Esprit is up, Cascade and Fountain give 5 Esprit and the procs 10, for <b>Saber Dance</b> (480, 50 Esprit).</p>
<p>The dances work as in Shadowbringers (Step 1.5s, steps 1.0s, Finish 1.5s, not shortened by skill speed): <b>Standard Finish</b> 720 and +5% for 60s, <b>Technical Finish</b> 1,200 and +5% for 20s, and Technical opens <b>Tillana</b> (360, which also renews Standard Finish). <b>Devilment</b> (+20% crit and direct hit) opens <b>Starfall Dance</b> (600, a critical direct hit${V.dhDet ? ' that also gains from the Direct Hit stat, as from 6.2' : ''}); <b>Flourish</b> (60s) gives the Symmetry and Flow procs, Fan Dance III and <b>Fan Dance IV</b> (300).${V.silken ? ' From 6.1 Flourish\'s procs are separate from Cascade and Fountain\'s Silken ones, so it never wastes them.' : ' In 6.0x Flourish\'s Symmetry and Flow are the same effects Cascade and Fountain give, so use your procs before it.'}</p>
<h3>The opener (The Balance)</h3>
${seq(['standardStep', 'emboite', 'entrechat', 'standardFinish', 'technicalStep', 'emboite', 'entrechat', 'jete', 'pirouette', 'technicalFinish', ['devilment'], 'starfallDance', ['flourish'], ['fanDance3'], 'tillana', ['fanDance4'], 'saberDance', 'fountainfall', ['fanDance'], 'standardStep', 'emboite', 'entrechat', 'standardFinish'])}
<p>Standard Step at −15.5s with its steps, the tincture at −1.5s, Standard Finish on the pull. Your steps will be in another order.</p>
<p style="color:#a9a3b4">The ${V.silken ? '6.58' : '6.08'} numbers: Cascade 220, Fountain 280 in combo, Reverse Cascade 280, Fountainfall 340, Saber Dance 480, Standard Finish 360 / 540 / 720, Technical Finish 350–1,200, Tillana 360, Starfall Dance 600, Fan Dance 150 / 100 / 200 / 300; Increased Action Damage II +20%; auto-attacks 90 at 3.12s.${V.silken ? '' : ' Before 6.08: Cascade 180, Fountain 240, Reverse Cascade 240, Fountainfall 300, Technical Finish 1,080.'} Gear: ${V.gear}.</p>`;
    }
  }

  B.DancerEW = DancerEW;
  B.registerJob({
    id: 'dnc', name: 'Dancer', abbr: 'DNC', role: 'ranged', classJob: 38,
    versions: ['ew61', 'ew60'].map(v => ({ id: v, label: VERSIONS[v].label, history: VERSIONS[v].history, note: VERSIONS[v].note, create: () => new DancerEW(v) })),
  });
})(window.BLM);
