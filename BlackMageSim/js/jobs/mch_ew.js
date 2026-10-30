// Machinist, Endwalker at level 90, in three versions. Built on the Shadowbringers class (mch_shb.js): the same Heated
// combo, Drill, Air Anchor, Hypercharge into five 1.5s Heat Blasts that cut Gauss Round and Ricochet by 15s, and
// Wildfire, plus Chain Saw (60s, +20 Battery), Reassemble with two charges, Scattergun and the Queen's Crowned Collider.
//  - 6.0–6.18: the Queen's time scales with Battery (12.5s at 50 to 20.5s at 100): an Arm Punch (120) per 10 Battery,
//    then Pile Bunker (6.8 × Battery) and Crowned Collider (7.8 ×). The 6.18 numbers: tools 580, Heat Blast 180,
//    Wildfire 220 per weaponskill.
//  - 6.2–6.28: the Queen lasts a fixed 12s: five Arm Punches whose potency scales with Battery (120–240); Reassemble's
//    guaranteed hits gain from the Direct Hit stat. The 6.28 numbers: tools 600, Heat Blast 200, Wildfire 240.
//  - 6.3–6.58: Hypercharge gives five Overheated stacks for 10s (one per Heat Blast), so a tool fits inside; Wildfire
//    stacks to six; Gauss Round / Ricochet 130, Heated Slug / Clean 300 / 380.
// Numbers are the game data at 6.18, 6.28 and 6.58 and the Lodestone notes; the Queen's timings follow The Balance;
// gear is The Balance's set for each tier. ref: a scripted bot parses about 12,170 / 9,720 / 7,530 on these.
(function (B) {
  const SHB = B.MachinistShB;
  const EPS = 1e-6;
  const set = B.setAction;     // a version's change to an action (its description's numbers follow the potency)
  const VERSIONS = {
    ew63: { label: 'Endwalker 6.3–6.58', history: 'EW 6.3–6.58', slug: 300, clean: [120, 380], blast: 200, tools: 600, gauss: 130, wf: 240, wfCap: 6, stacks: true,
      queenFixed: true, dhDet: true, tincture: 'dex8', ref: 12900,
      stats: { hp: 80000, main: 3376, wd: 132, det: 2114, crit: 2557, dh: 1254, speed: 400 },
      gear: 'The Balance\'s 6.5 relic set at 2.50 (Dexterity 3,376, 132 weapon damage)',
      note: 'Level 90: Hypercharge into five Overheated stacks for 10s, Wildfire up to six, Chain Saw, the fixed 12s Queen; Anabaseios gear' },
    ew62: { label: 'Endwalker 6.2–6.28', history: 'EW 6.2–6.28', slug: 280, clean: [110, 360], blast: 200, tools: 600, gauss: 120, wf: 240, wfCap: 99, stacks: false,
      queenFixed: true, dhDet: true, tincture: 'dex7', ref: 10300,
      stats: { hp: 74000, main: 2937, wd: 126, det: 1598, crit: 2389, dh: 1592, speed: 400 },
      gear: 'The Balance\'s 6.2 set at 2.50 (Dexterity 2,937, 126 weapon damage)',
      note: 'Level 90: the Queen for a fixed 12s with Battery scaling her potency, Reassemble gaining from Direct Hit; Abyssos gear' },
    ew60: { label: 'Endwalker 6.0–6.18', history: 'EW 6.0–6.18', slug: 280, clean: [110, 360], blast: 180, tools: 580, gauss: 120, wf: 220, wfCap: 99, stacks: false,
      queenFixed: false, dhDet: false, tincture: 'dex6', ref: 7980,
      stats: { hp: 70000, main: 2572, wd: 120, det: 1615, crit: 2121, dh: 1626, speed: 400 },
      gear: 'The Balance\'s 6.0 set at 2.50 (Dexterity 2,572, 120 weapon damage)',
      note: 'Level 90, the launch kit: an 8s Hypercharge, the Queen\'s time scaling with Battery, Chain Saw, two Reassembles; Asphodelos gear' },
  };
  const ws = (o) => Object.assign({ kind: 'gcd', target: true, range: 25, delay: 0.5, fx: 'gnbShot' }, o);

  class MachinistEW extends SHB {
    constructor(version) {
      super('shb505');
      const V = VERSIONS[version];
      this.V = Object.assign({}, this.V, V, { split: 200, reassemble: 55, tactician: 90 });
      this.level = 90;
      this.levelKey = 90;
      this.model = 'mch-ew';
      this.comboTime = 30;
      this.wfPotency = V.wf;
      this.wfCap = V.wfCap;
      this.reassembleDhDet = V.dhDet;
      const A = Object.assign({}, this.actions);
      set(A, 'heatedSplitShot', { potency: 200, desc: 'Delivers an attack with a potency of 200.\nAdditional Effect: Increases Heat Gauge by 5' });
      set(A, 'heatedSlugShot', { potency: 120, comboPotency: V.slug, desc: `Delivers an attack with a potency of 120.\nCombo Action: Heated Split Shot\nCombo Potency: ${V.slug}\nCombo Bonus: Increases Heat Gauge by 5` });
      set(A, 'heatedCleanShot', { potency: V.clean[0], comboPotency: V.clean[1], desc: `Delivers an attack with a potency of ${V.clean[0]}.\nCombo Action: Heated Slug Shot\nCombo Potency: ${V.clean[1]}\nCombo Bonus: Increases Heat Gauge by 5\nCombo Bonus: Increases Battery Gauge by 10` });
      set(A, 'drill', { potency: V.tools, desc: `Delivers an attack with a potency of ${V.tools}.\nShares a recast timer with Bioblaster.` });
      set(A, 'airAnchor', { potency: V.tools, desc: `Delivers an attack with a potency of ${V.tools}.\nAdditional Effect: Increases Battery Gauge by 20` });
      A.chainSaw = ws({ name: 'Chain Saw', potency: V.tools, cd: 60, cdScales: true, battery: 20, aoe: 0.35, fx: 'gnbDouble', desc: `Delivers an attack with a potency of ${V.tools} to target and all enemies in a straight line beyond it, 65% less for all remaining enemies.\nAdditional Effect: Increases Battery Gauge by 20\nRecast: 60s` });
      set(A, 'heatBlast', { potency: V.blast, desc: `Delivers an attack with a potency of ${V.blast}.\nAdditional Effect: Reduces the recast time of both Gauss Round and Ricochet by 15s\nCan only be executed when firearm is Overheated.\nRecast: 1.5s` });
      A.scattergun = ws({ name: 'Scattergun', potency: 150, heat: 10, breaksCombo: true, aoe: true, range: 12, desc: 'Delivers an attack with a potency of 150 to all enemies in a cone before you.\nAdditional Effect: Increases Heat Gauge by 10' });
      delete A.spreadShot;
      set(A, 'gaussRound', { potency: V.gauss, desc: `Delivers an attack with a potency of ${V.gauss}.\nMaximum Charges: 3` });
      set(A, 'ricochet', { potency: V.gauss, desc: `Delivers an attack to target and all enemies nearby it with a potency of ${V.gauss} for the first enemy, and 50% less for all remaining enemies.\nMaximum Charges: 3` });
      set(A, 'reassemble', { recast: 55, charges: 2, desc: `Guarantees that next weaponskill is a critical direct hit.\nDuration: 5s${V.dhDet ? '\nIncreases damage dealt when under the effect of a critical hit or direct hit rate buff, and from the Direct Hit stat.' : ''}\nThis action does not affect damage over time effects.\nMaximum Charges: 2` });
      set(A, 'wildfire', { desc: `Covers target's body in a slow-burning pitch.\nDeals damage when time expires or upon executing Detonator.\nPotency is increased by ${V.wf} for each of your own weaponskills you land prior to the end of the effect.${V.wfCap < 99 ? '\nCan be stacked up to 6 times.' : ''}\nDuration: 10s\nIt can't be a critical or direct hit.` });
      set(A, 'hypercharge2', { desc: V.stacks ? 'Grants 5 stacks of Overheated, each stack allowing the execution of Heat Blast or Auto Crossbow.\nOverheated Effect: Increases the potency of single-target weaponskills by 20\nDuration: 10s\nHeat Gauge Cost: 50' : 'Releases the energy building in your firearm, causing it to become Overheated, increasing the potency of single-target weaponskills by 20.\nDuration: 8s\nHeat Gauge Cost: 50' });
      set(A, 'automatonQueen', { desc: V.queenFixed ? 'Deploys an Automaton Queen to fight at your side.\nPotency of Automaton Queen actions increases as Battery Gauge exceeds required cost at time of deployment.\nDuration: 12s\nBattery Gauge Cost: 50\nConsumes Battery Gauge upon execution.' : 'Deploys an Automaton Queen to fight at your side.\nBattery Gauge Cost: 50\nDuration increases as Battery Gauge exceeds minimum cost at time of deployment.\nConsumes Battery Gauge upon execution.' });
      set(A, 'queenOverdrive', { desc: 'Orders the Automaton Queen to use Pile Bunker and Crowned Collider.\nThe Automaton Queen shuts down after execution.' });
      set(A, 'tactician', { recast: 90 });
      A.crownedCollider = { name: 'Crowned Collider', kind: 'pet', pet: true, potency: 780, delay: 0.5, fx: 'gnbZone', big: true };
      set(A, 'armPunch', { potency: 120 });
      A.tincture = B.tincture(V.tincture);
      this.actions = A;
      this.stats = Object.assign({ mainStat: 'dex', jobMod: 115, trait: 120, delay: 2.64 }, V.stats);
      this.autoAttack = { potency: 80, delay: 2.64, range: 25 };
      this.defaultBars = [
        ['heatedSplitShot', 'heatedSlugShot', 'heatedCleanShot', 'drill', 'airAnchor', 'chainSaw', 'heatBlast', 'hypercharge2', 'gaussRound', 'ricochet', 'wildfire', 'reassemble'],
        ['barrelStabilizer', 'automatonQueen', 'queenOverdrive', 'tincture', 'tactician', 'flamethrower', 'headGraze', 'secondWind', 'legGraze', 'footGraze', 'peloton', 'armsLength'],
        ['scattergun', 'autoCrossbow', 'bioblaster', 'sprint', null, null, null, null, null, null, null, null],
      ];
      this.actionGroups = [
        ['Machinist', ['heatedSplitShot', 'heatedSlugShot', 'heatedCleanShot', 'drill', 'airAnchor', 'chainSaw', 'heatBlast', 'scattergun', 'autoCrossbow', 'bioblaster',
          'hypercharge2', 'wildfire', 'detonator', 'reassemble', 'gaussRound', 'ricochet', 'barrelStabilizer', 'automatonQueen', 'queenOverdrive', 'flamethrower', 'tactician']],
        ['Role Actions', ['legGraze', 'secondWind', 'footGraze', 'peloton', 'headGraze', 'armsLength']],
        ['General', ['sprint', 'tincture']],
      ];
      this.referenceDps = V.ref;
      this.referenceGcd = 2.5;
    }

    // 6.3+: Overheated is five stacks for 10s, one used by each Heat Blast.
    overheated(e) { return super.overheated(e) && (!this.V.stacks || e.g.ohStacks > 0); }

    weaponskill(id, e) {
      super.weaponskill(id, e);
      if (this.V.stacks && this.actions[id].overheat) e.g.ohStacks--;
    }

    ability(id, e) {
      const g = e.g;
      switch (id) {
        case 'hypercharge2':
          this.heat(e, -50);
          g.overheatUntil = e.now + (this.V.stacks ? 10 : 8);
          g.ohStacks = 5;
          e.emit('overheat', {});
          return;
        case 'automatonQueen': {
          const b = g.battery;
          g.battery = 0;
          // 6.0–6.18: an Arm Punch (120) per 10 Battery; from 6.2 five whose potency scales with it. Then Pile Bunker
          // and Crowned Collider. About 5s of wind-up, punches 1.5s apart (The Balance).
          const n = this.V.queenFixed ? 5 : b / 10;
          const punch = this.V.queenFixed ? 2.4 * b : 120;
          const hits = [];
          for (let k = 0; k < n; k++) hits.push({ at: e.now + 5 + 1.5 * k, id: 'armPunch', potency: punch });
          const end = e.now + 5 + 1.5 * n;
          hits.push({ at: end, id: 'pileBunker', potency: 6.8 * b }, { at: end + 1.5, id: 'crownedCollider', potency: 7.8 * b });
          g.queen = { hits, bunker: 6.8 * b, collider: 7.8 * b, until: end + 1.6 };
          e.pet = { kind: 'queen' };
          return;
        }
        case 'queenOverdrive': {
          const q = g.queen;
          q.hits = q.hits.filter(h => h.at <= e.now + EPS && h.id === 'armPunch');
          q.hits.push({ at: e.now + 0.5, id: 'pileBunker', potency: q.bunker }, { at: e.now + 2, id: 'crownedCollider', potency: q.collider });
          q.until = e.now + 2.1;
          return;
        }
      }
      super.ability(id, e);
    }

    speedInfo(e) { return `GCD ${e.gcdForSpeed(e.stats.speed).toFixed(2)} · Heat Blast 1.50 · Drill ${e.speedScale(20).toFixed(1)}s, Air Anchor ${e.speedScale(40).toFixed(1)}s, Chain Saw ${e.speedScale(60).toFixed(1)}s`; }

    gaugeUpdate(e) {
      super.gaugeUpdate(e);
      if (this.V.stacks && this.overheated(e)) this.mg.s.textContent = `OVERHEATED ×${e.g.ohStacks}` + (e.g.queen ? `  ·  QUEEN ${Math.ceil(e.g.queen.until - e.now)}s` : '');
    }

    helpHtml(seq) {
      const V = this.V;
      const opener = V.stacks
        ? seq(['heatedSplitShot', 'drill', ['barrelStabilizer'], 'heatedSlugShot', 'heatedCleanShot', ['reassemble'], 'airAnchor', ['reassemble'], ['wildfire'], 'chainSaw', ['automatonQueen'], ['hypercharge2'], 'heatBlast', ['gaussRound'], 'heatBlast', ['ricochet'], 'heatBlast', ['gaussRound'], 'heatBlast', ['ricochet'], 'heatBlast', ['gaussRound'], 'drill', ['ricochet']])
        : seq(['airAnchor', 'drill', ['barrelStabilizer'], 'heatedSplitShot', 'heatedSlugShot', 'heatedCleanShot', ['reassemble'], ['wildfire'], 'chainSaw', ['automatonQueen'], ['hypercharge2'], 'heatBlast', ['gaussRound'], 'heatBlast', ['ricochet'], 'heatBlast', ['gaussRound'], 'heatBlast', ['ricochet'], 'heatBlast', ['gaussRound'], 'drill', ['ricochet']]);
      return `
<h3>How it plays (${V.label})</h3>
<p>Level 90 Machinist. The <b>Heated Split → Slug → Clean Shot</b> combo (200 / ${V.slug} / ${V.clean[1]}) builds Heat and Battery; <b>Drill</b>, <b>Air Anchor</b> and <b>Chain Saw</b> (${V.tools} each, 20s / 40s / 60s, the last two +20 Battery) go on cooldown with <b>Reassemble</b> (two charges, a critical direct hit) on the big ones.</p>
<p>At 50 Heat, <b>Hypercharge</b>: ${V.stacks ? 'five Overheated stacks for 10s, one per Heat Blast, so a tool fits inside the window' : '8s of Overheat for five Heat Blasts'} (${V.blast} + 20, a flat 1.5s GCD), each taking 15s off <b>Gauss Round</b> and <b>Ricochet</b> (${V.gauss}). <b>Wildfire</b> (${V.wf} per weaponskill${V.wfCap < 99 ? ', up to six' : ''}) goes on a Hypercharge every two minutes. The <b>Automaton Queen</b> spends 50–100 Battery: ${V.queenFixed ? 'a fixed 12s of five Arm Punches that scale with the Battery' : 'one Arm Punch (120) per 10 Battery, so more Battery means a longer Queen'}, then Pile Bunker and Crowned Collider.</p>
<h3>The opener (The Balance, ${V.stacks ? '"Delayed Tools"' : '"General Raid"'})</h3>
${opener}
<p>${V.stacks ? 'The tincture at −2s.' : 'Reassemble at −5s and the tincture at −1.5s.'} Summon the Queen at 50 Battery in the opener, then around 80–90 a GCD before each burst.</p>
<p style="color:#a9a3b4">The ${V.stacks ? '6.58' : V.queenFixed ? '6.28' : '6.18'} numbers: Heated Split 200, Slug ${V.slug} and Clean ${V.clean[1]} in combo, Drill / Air Anchor / Chain Saw ${V.tools}, Heat Blast ${V.blast} (+20 Overheated), Gauss Round / Ricochet ${V.gauss}, Wildfire ${V.wf} per weaponskill, Scattergun 150; the Queen: Arm Punch ${V.queenFixed ? '120–240' : '120'}, Pile Bunker 6.8 and Crowned Collider 7.8 × Battery, at about 90%; Increased Action Damage II +20%; auto-attacks 80 at 2.64s. Gear: ${V.gear}.</p>`;
    }
  }

  B.MachinistEW = MachinistEW;
  B.registerJob({
    id: 'mch', name: 'Machinist', abbr: 'MCH', role: 'ranged', classJob: 31,
    versions: ['ew63', 'ew62', 'ew60'].map(v => ({ id: v, label: VERSIONS[v].label, history: VERSIONS[v].history, note: VERSIONS[v].note, create: () => new MachinistEW(v) })),
  });
})(window.BLM);
