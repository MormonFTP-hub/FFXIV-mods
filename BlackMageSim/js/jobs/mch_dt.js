// Machinist, Dawntrail 7.0–7.57 at level 100. Built on the Endwalker 6.3 class (mch_ew.js): the Heated combo, Air
// Anchor and Chain Saw, Hypercharge into five Overheated stacks, Wildfire up to six, Reassemble's two charges and the
// fixed 12s Queen. Dawntrail renamed Heat Blast to Blazing Shot (240) and Gauss Round / Ricochet to Double Check /
// Checkmate (180, three charges each), gave Drill two charges on a flat 20s, made Chain Saw ready Excavator (+20
// Battery), and turned Barrel Stabilizer into Hypercharged (a free Hypercharge) and Full Metal Machinist for Full Metal
// Field (900, a critical direct hit that leaves Reassemble alone) instead of 50 Heat. The 7.4–7.57 numbers (7.0–7.01
// had Clean Shot 400, the tools 600, Full Metal Field 700, Blazing Shot 220, Double Check / Checkmate 160). Numbers are
// the game data at 7.0, 7.05, 7.1, 7.2, 7.3, 7.41 and 7.57 (xivapi's datamining) and the Lodestone notes; gear is The
// Balance's 7.4+ savage set. ref: a scripted bot parses about 37,300 on this.
(function (B) {
  const EW = B.MachinistEW;
  const ws = (o) => Object.assign({ kind: 'gcd', target: true, range: 25, delay: 0.5, fx: 'gnbShot' }, o);
  const set = (A, id, o) => { A[id] = Object.assign({}, A[id], o); };
  const TOOLS = 660;

  class MachinistDT extends EW {
    constructor() {
      super('ew63');
      this.V = Object.assign({}, this.V, { label: 'Dawntrail 7.0–7.57', tincture: 'dexdt4' });
      this.level = 100;
      this.levelKey = 100;
      this.model = 'mch-dt';
      const A = Object.assign({}, this.actions);
      set(A, 'heatedSplitShot', { potency: 220, desc: 'Delivers an attack with a potency of 220.\nAdditional Effect: Increases Heat Gauge by 5' });
      set(A, 'heatedSlugShot', { potency: 140, comboPotency: 320, desc: 'Delivers an attack with a potency of 140.\nCombo Action: Heated Split Shot\nCombo Potency: 320\nCombo Bonus: Increases Heat Gauge by 5' });
      set(A, 'heatedCleanShot', { potency: 160, comboPotency: 420, desc: 'Delivers an attack with a potency of 160.\nCombo Action: Heated Slug Shot\nCombo Potency: 420\nCombo Bonus: Increases Heat Gauge by 5\nCombo Bonus: Increases Battery Gauge by 10' });
      set(A, 'drill', { potency: TOOLS, cdScales: false, charges: 2, desc: `Delivers an attack with a potency of ${TOOLS}.\nMaximum Charges: 2\nShares a recast timer with Bioblaster.` });
      set(A, 'bioblaster', { potency: 50, dot: { potency: 50, duration: 15 }, cdScales: false, charges: 2, desc: 'Delivers an attack with a potency of 50 to all enemies in a cone before you.\nAdditional Effect: Damage over time\nPotency: 50\nDuration: 15s\nMaximum Charges: 2\nShares a recast timer with Drill.' });
      set(A, 'airAnchor', { potency: TOOLS, desc: `Delivers an attack with a potency of ${TOOLS}.\nAdditional Effect: Increases Battery Gauge by 20` });
      set(A, 'chainSaw', { potency: TOOLS, aoe: 0.75, desc: `Delivers an attack with a potency of ${TOOLS} to target and all enemies in a straight line beyond it, 25% less for all remaining enemies.\nAdditional Effect: Increases Battery Gauge by 20\nAdditional Effect: Grants Excavator Ready\nDuration: 30s` });
      A.excavator = ws({ name: 'Excavator', potency: TOOLS, battery: 20, aoe: 0.75, fx: 'gnbDouble', desc: `Delivers an attack with a potency of ${TOOLS} to target and all enemies nearby it, 25% less for all remaining enemies.\nAdditional Effect: Increases Battery Gauge by 20\nCan only be executed while under the effect of Excavator Ready.` });
      A.fullMetalField = ws({ name: 'Full Metal Field', potency: 900, aoe: 0.75, fx: 'gnbZone', desc: 'Delivers a critical direct hit with a potency of 900 to target and all enemies nearby it, 25% less for all remaining enemies.\nDamage dealt is increased when under an effect that raises critical hit rate or direct hit rate.\nCan only be executed while under the effect of Full Metal Machinist.' });
      A.blazingShot = Object.assign({}, A.heatBlast, { name: 'Blazing Shot', potency: 240, desc: 'Delivers an attack with a potency of 240.\nAdditional Effect: Reduces the recast time of both Double Check and Checkmate by 15s\nCan only be executed when firearm is Overheated.\nRecast timer cannot be affected by status effects or gear attributes.' });
      A.doubleCheck = Object.assign({}, A.gaussRound, { name: 'Double Check', potency: 180, aoe: 0.7, fx: 'gnbShot', desc: 'Delivers an attack with a potency of 180 to target and all enemies nearby it, 30% less for all remaining enemies.\nMaximum Charges: 3' });
      A.checkmate = Object.assign({}, A.ricochet, { name: 'Checkmate', potency: 180, aoe: 0.7, desc: 'Delivers an attack with a potency of 180 to target and all enemies nearby it, 30% less for all remaining enemies.\nMaximum Charges: 3' });
      for (const k of ['heatBlast', 'gaussRound', 'ricochet']) delete A[k];
      set(A, 'scattergun', { potency: 130, desc: 'Delivers an attack with a potency of 130 to all enemies in a cone before you.\nAdditional Effect: Increases Heat Gauge by 10' });
      set(A, 'autoCrossbow', { potency: 180 });
      set(A, 'flamethrower', { potency: 120 });
      set(A, 'barrelStabilizer', { desc: 'Grants Hypercharged and Full Metal Machinist.\nHypercharged Effect: Allows the execution of Hypercharge without consuming Heat\nFull Metal Machinist Effect: Allows the execution of Full Metal Field\nDuration: 30s\nCan only be executed while in combat.\nBarrel Stabilizer changes to Full Metal Field while Full Metal Machinist is up.' });
      set(A, 'hypercharge2', { desc: 'Grants 5 stacks of Overheated, each stack allowing the execution of Blazing Shot or Auto Crossbow.\nOverheated Effect: Increases the potency of single-target weaponskills by 20\nDuration: 10s\nHeat Gauge Cost: 50 (none while Hypercharged)' });
      set(A, 'tactician', { desc: 'Reduces damage taken by self and nearby party members by 15%.\nDuration: 15s' });
      A.tincture = B.tincture('dexdt4');
      this.actions = A;
      this.statuses = Object.assign({}, this.statuses, {
        excavatorReady: { name: 'Excavator Ready', self: true, icon: 'st_reassemble' },
        hypercharged: { name: 'Hypercharged', self: true, icon: 'st_reassemble' },
        fullMetalMachinist: { name: 'Full Metal Machinist', self: true, icon: 'st_reassemble' },
      });
      this.selfStatusOrder = ['reassembled', 'hypercharged', 'fullMetalMachinist', 'excavatorReady', 'flamethrower', 'tactician', 'medicated', 'peloton', 'armsLength', 'sprint'];
      this.stats = { mainStat: 'dex', jobMod: 115, trait: 120, delay: 2.64, hp: 226488, main: 6513, wd: 158, det: 2347, crit: 3549, dh: 2197, speed: 420 };
      this.defaultBars = [
        ['heatedSplitShot', 'heatedSlugShot', 'heatedCleanShot', 'drill', 'airAnchor', 'chainSaw', 'blazingShot', 'hypercharge2', 'doubleCheck', 'checkmate', 'wildfire', 'reassemble'],
        ['barrelStabilizer', 'fullMetalField', 'automatonQueen', 'queenOverdrive', 'tincture', 'tactician', 'flamethrower', 'headGraze', 'secondWind', 'legGraze', 'footGraze', 'peloton'],
        ['scattergun', 'autoCrossbow', 'bioblaster', 'armsLength', 'sprint', null, null, null, null, null, null, null],
      ];
      this.actionGroups = [
        ['Machinist', ['heatedSplitShot', 'heatedSlugShot', 'heatedCleanShot', 'drill', 'airAnchor', 'chainSaw', 'excavator', 'fullMetalField', 'blazingShot',
          'scattergun', 'autoCrossbow', 'bioblaster', 'hypercharge2', 'wildfire', 'detonator', 'reassemble', 'doubleCheck', 'checkmate', 'barrelStabilizer',
          'automatonQueen', 'queenOverdrive', 'flamethrower', 'tactician']],
        ['Role Actions', ['legGraze', 'secondWind', 'footGraze', 'peloton', 'headGraze', 'armsLength']],
        ['General', ['sprint', 'tincture']],
      ];
      this.referenceDps = 39590;
      this.referenceGcd = 2.5;
    }

    resolveId(id, e) {
      if (id === 'chainSaw' && e.has('excavatorReady')) return 'excavator';
      if (id === 'barrelStabilizer' && e.has('fullMetalMachinist')) return 'fullMetalField';
      return super.resolveId(id, e);
    }

    check(id, e) {
      if (id === 'excavator' && !e.has('excavatorReady')) return 'Unable to execute action. Excavator Ready required.';
      if (id === 'fullMetalField' && !e.has('fullMetalMachinist')) return 'Unable to execute action. Full Metal Machinist required.';
      if (id === 'hypercharge2' && e.has('hypercharged') && !this.overheated(e)) return null;
      return super.check(id, e);
    }

    weaponskill(id, e) {
      const a = this.actions[id], g = e.g;
      // Full Metal Field is its own critical direct hit: Reassemble stays for the next weaponskill.
      if (id === 'fullMetalField') {
        e.removeStatus('fullMetalMachinist');
        if (e.tHas('wildfire')) g.wf++;
        e.queueHit(id, a.potency, this.snapshot(a, e), a.delay, null, { crit: true, dh: true, dhDet: true });
        return;
      }
      if (id === 'excavator') e.removeStatus('excavatorReady');
      super.weaponskill(id, e);
      if (id === 'chainSaw') e.addStatus('excavatorReady', 30);
      if (id === 'blazingShot') { this.cut(e, 'doubleCheck', 15); this.cut(e, 'checkmate', 15); }
    }

    ability(id, e) {
      const g = e.g;
      switch (id) {
        case 'barrelStabilizer': e.addStatus('hypercharged', 30); e.addStatus('fullMetalMachinist', 30); return;
        case 'hypercharge2':
          if (e.has('hypercharged')) {
            e.removeStatus('hypercharged');
            g.overheatUntil = e.now + 10;
            g.ohStacks = 5;
            e.emit('overheat', {});
            return;
          }
          break;
      }
      super.ability(id, e);
    }

    proc(id, e) {
      if (id === 'chainSaw') return e.has('excavatorReady');
      if (id === 'barrelStabilizer' || id === 'fullMetalField') return e.has('fullMetalMachinist');
      if (id === 'hypercharge2' && e.has('hypercharged') && !this.overheated(e)) return true;
      if (id === 'blazingShot') return this.overheated(e);
      return super.proc(id, e);
    }

    speedInfo(e) { return `GCD ${e.gcdForSpeed(e.stats.speed).toFixed(2)} · Blazing Shot 1.50 · Drill 20s (two charges), Air Anchor ${e.speedScale(40).toFixed(1)}s, Chain Saw ${e.speedScale(60).toFixed(1)}s`; }

    helpHtml(seq) {
      return `
<h3>How it plays (Dawntrail 7.0–7.57)</h3>
<p>Level 100 Machinist. The <b>Heated Split → Slug → Clean Shot</b> combo (220 / 320 / 420) builds 5 Heat each and 10 Battery at the end. The tools: <b>Drill</b> (660, two charges on a flat 20s), <b>Air Anchor</b> (660, 40s, +20 Battery) and <b>Chain Saw</b> (660, 60s, +20 Battery), which readies <b>Excavator</b> (660, +20 Battery). <b>Reassemble</b> (two charges) makes a tool a critical direct hit.</p>
<p>At 50 Heat, <b>Hypercharge</b>: five Overheated stacks for 10s, each a 1.5s <b>Blazing Shot</b> (240, +20 while Overheated) that takes 15s off <b>Double Check</b> and <b>Checkmate</b> (180, three charges each). <b>Barrel Stabilizer</b> (120s) no longer gives Heat: it grants <b>Hypercharged</b> (one free Hypercharge) and <b>Full Metal Field</b> (900, always a critical direct hit; Reassemble isn't used on it). <b>Wildfire</b> (120s) adds 240 for each weaponskill in its 10s, up to six. The <b>Automaton Queen</b> at 50+ Battery fights for 12s.</p>
<h3>The opener (The Balance, "Standard Opener (AA)")</h3>
${seq([['reassemble'], ['tincture'], 'airAnchor', ['checkmate'], ['doubleCheck'], 'drill', ['barrelStabilizer'], 'chainSaw', 'excavator', ['automatonQueen'], ['reassemble'], 'drill', ['checkmate'], ['wildfire'], 'fullMetalField', ['doubleCheck'], ['hypercharge2'], 'blazingShot', ['checkmate'], 'blazingShot', ['doubleCheck'], 'blazingShot', ['checkmate'], 'blazingShot', ['doubleCheck'], 'blazingShot', ['checkmate'], 'drill', ['doubleCheck'], ['checkmate'], 'heatedSplitShot', 'heatedSlugShot', 'heatedCleanShot'])}
<p>Reassemble at −5s and the tincture at −2s. The Queen goes out at 60 Battery in the opener; afterwards at 90–100 before the two-minute burst.</p>
<p style="color:#a9a3b4">The 7.4–7.57 numbers: Heated Split 220, Slug 320, Clean 420 in combo, Drill / Air Anchor / Chain Saw / Excavator 660, Full Metal Field 900, Blazing Shot 240, Double Check / Checkmate 180, Wildfire 240 per weaponskill, the Queen's Arm Punch 2.4 × Battery, Pile Bunker 6.8 × and Crowned Collider 7.8 ×; auto-attacks 80 at 2.64s. 7.0–7.01: Clean Shot 400, the tools 600, Full Metal Field 700, Blazing Shot 220, Double Check / Checkmate 160; 7.05 raised Full Metal Field to 900, 7.1 the combo, Blazing Shot and the checks, 7.3 and 7.4 the tools. Gear: The Balance's 7.4+ savage set (Dexterity 6,513, 158 weapon damage), with a Grade 4 Gemdraught.</p>`;
    }
  }

  B.registerJob({
    id: 'mch', name: 'Machinist', abbr: 'MCH', role: 'ranged', classJob: 31,
    versions: [{ id: 'dt70', label: 'Dawntrail 7.0–7.57', history: 'DT 7.0–7.57', note: 'Level 100: Blazing Shot, Double Check and Checkmate, Drill with two charges, Chain Saw into Excavator, Barrel Stabilizer into a free Hypercharge and Full Metal Field; the 7.4 numbers', create: () => new MachinistDT() }],
  });
})(window.BLM);
