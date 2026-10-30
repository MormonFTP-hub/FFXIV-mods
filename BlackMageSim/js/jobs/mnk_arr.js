// Monk, A Realm Reborn 2.1–2.57 at level 50. Built on the Heavensward 3.0 class (mnk_hw30.js): the forms, Greased
// Lightning at 9% a stack (27% at three) and 5% speed for 12s, Touch of Death and Demolish's DoTs, on TP. What ARR had
// instead: no Tornado Kick, Meditation, The Forbidden Chakra, Form Shift, Elixir Field or Purification (all 3.0), so
// Greased Lightning III is just kept going; Demolish's DoT is 40 a tick for 18s; Perfect Balance recasts in 240s;
// Howling Fist 170. ARR's damage formula (B.LEVELS.arr50: level 50, a flat ×1.5 crit, no speed on DoTs). Numbers are
// the Lodestone notes for 2.1–2.57, Gamer Escape's ARR pages and the xiv-sim data files (2015); gear is the 2015 Ariyala
// best-in-slot (Dreadwyrm Claws, Final Coil i130) with the X-Potion of Strength (max 84).
//  - A Realm Reborn 2.0: Greased Lightning 7% a stack (21% at three); Bootshine 130; True Strike 150 with +5% crit from the
//    rear instead of +40 potency; Demolish only a DoT (40 × 18s, no hit); Twin Snakes 12s; Shoulder Tackle 90s; One Ilm
//    Punch 80; cross-class Blood for Blood +20% and Invigorate 300 TP. An end-of-2.0 set (Allagan Baghnakhs, i95: Strength
//    491, 47 weapon damage, 2.72 delay) with the HQ Mega-Potion of Strength (max 61).
(function (B) {
  const HW = B.MonkHW;
  const set = (A, id, o) => { A[id] = Object.assign({}, A[id], o); };

  class MonkARR extends HW {
    constructor() {
      super();
      this.level = 50;
      this.levelKey = 'arr50';
      this.model = 'mnk-arr';
      this.glDur = 12;
      this.glStep = 0.09;
      this.potionCap = 84;
      const A = Object.assign({}, this.actions);
      for (const k of ['tornadoKick', 'meditation', 'forbiddenChakra', 'formShift', 'elixirField', 'purification']) delete A[k];
      set(A, 'demolish', { dot: { potency: 40, duration: 18 }, desc: 'Delivers an attack with a potency of 30.\n70 when executed from a target\'s rear.\nAdditional Effect: Damage over time\nPotency: 40\nDuration: 18s\nAdditional Effect: Greased Lightning\nDuration: 12s\nCan only be executed when in coeurl form.\nAdditional Effect: Changes form to opo-opo\nDuration: 10s' });
      set(A, 'snapPunch', { desc: A.snapPunch.desc.replace(/Duration: 1[24]s/, 'Duration: 12s') });
      set(A, 'perfectBalance', { recast: 240 });
      set(A, 'howlingFist', { potency: 170, desc: A.howlingFist.desc.replace(/potency of \d+/, 'potency of 170') });
      A.tincture = Object.assign({}, A.tincture, { name: 'X-Potion of Strength', desc: 'This diluted brew temporarily increases strength.\nStrength +20% (Max 84)\nDuration: 15s' });
      this.actions = A;
      // The 2015 Ariyala best-in-slot (Final Coil i130, Dreadwyrm Claws: 58 weapon damage, 2.56 delay), melded.
      this.stats = Object.assign({}, this.stats, { hp: 11500, main: 655, wd: 58, det: 448, crit: 491, dh: 341, speed: 389, delay: 2.56 });
      this.autoAttack = Object.assign({}, this.autoAttack, { delay: 2.56 });
      this.defaultBars = [
        ['bootshine', 'trueStrike', 'snapPunch', 'dragonKick', 'twinSnakes', 'demolish', 'touchOfDeath', 'shoulderTackle', 'steelPeak', 'howlingFist', 'internalRelease', 'perfectBalance'],
        ['bloodForBlood', 'fistsOfFire', 'fistsOfWind', 'fistsOfEarth', 'tincture', 'invigorate', 'fracture', 'armOfTheDestroyer', 'oneIlmPunch', 'rockbreaker', 'mantra', 'bloodbath'],
        ['featherfoot', 'secondWind', 'sprint', null, null, null, null, null, null, null, null, null],
      ];
      this.actionGroups = this.actionGroups.map(([n, ids]) => [n, ids.filter(x => A[x])]);
      this.referenceDps = 640;     // a scripted 2.5 rotation parses about 600 on the dummy
      this.referenceGcd = 2.08;
    }

    helpHtml(seq) {
      return `
<h3>How it plays (A Realm Reborn 2.1–2.57)</h3>
<p>Level 50 Monk on TP. The forms go Opo-opo → Raptor → Coeurl, and Snap Punch and Demolish keep <b>Greased Lightning</b> at three stacks: +27% damage and 15% faster GCDs, but only <b>12s</b> at a time, so never drop a coeurl hit. Keep up <b>Twin Snakes</b> (+10%), Dragon Kick's blunt debuff (+10%), <b>Demolish</b> (40 a tick for 18s) and <b>Touch of Death</b> (25 a tick for 30s). There's no Tornado Kick or chakra yet: Greased Lightning is simply kept running.</p>
<p><b>Perfect Balance</b> (240s) lets you build Greased Lightning at once; <b>Internal Release</b> (+30% crit), <b>Blood for Blood</b> (+10%), <b>Steel Peak</b>, <b>Howling Fist</b> (170) and Shoulder Tackle are the cooldowns; Invigorate covers TP.</p>
<h3>The opener (the 2014 ARR Monk guide)</h3>
${seq([['perfectBalance'], 'demolish', ['bloodForBlood'], 'snapPunch', ['internalRelease'], 'snapPunch', ['tincture'], 'touchOfDeath', ['steelPeak'], 'dragonKick', ['howlingFist'], 'twinSnakes', 'demolish', 'bootshine', 'trueStrike', 'snapPunch'])}
<p>Fists of Fire before the pull.</p>
<p style="color:#a9a3b4">The 2.5x numbers: Bootshine 150, True Strike 150 (190 rear), Snap Punch 140 (180 flank), Dragon Kick 100 (150 flank), Twin Snakes 100 (140 flank), Demolish 30 (70 rear) + 40 × 18s, Touch of Death 20 + 25 × 30s, Howling Fist 170, Steel Peak 150. ARR's damage formula here is a refit of the 2013–14 community formulas (about 2–4% off). Gear: the 2015 Ariyala set (Strength 655, 58 weapon damage) with the X-Potion of Strength.</p>`;
    }
  }

  class MonkARR20 extends MonkARR {
    constructor() {
      super();
      this.glStep = 0.07;
      this.potionCap = 61;
      const A = Object.assign({}, this.actions);
      set(A, 'bootshine', { potency: 130, desc: A.bootshine.desc.replace(/potency of \d+/, 'potency of 130') });
      set(A, 'trueStrike', { posBonus: 0, desc: 'Delivers an attack with a potency of 150.\nCritical hit rate +5% when executed from a target\'s rear.\nCan only be executed when in raptor form.\nAdditional Effect: Changes form to coeurl\nDuration: 10s' });
      set(A, 'demolish', { potency: 0, posBonus: 0, desc: 'Deals damage over time.\nPotency: 40\nDuration: 18s\nAdditional Effect: Greased Lightning\nDuration: 12s\nCan only be executed when in coeurl form.\nAdditional Effect: Changes form to opo-opo\nDuration: 10s' });
      set(A, 'twinSnakes', { desc: A.twinSnakes.desc.replace('Duration: 15s', 'Duration: 12s') });
      set(A, 'shoulderTackle', { recast: 90 });
      set(A, 'oneIlmPunch', { potency: 80, desc: A.oneIlmPunch.desc.replace(/potency of \d+/, 'potency of 80') });
      set(A, 'bloodForBlood', { desc: 'Increases damage dealt by 20% while increasing damage taken by 25%.\nDuration: 20s\n(Lancer cross-class)' });
      set(A, 'invigorate', { desc: 'Instantly restores 300 TP.\n(Lancer cross-class)' });
      A.tincture = Object.assign({}, A.tincture, { name: 'Mega-Potion of Strength', desc: 'This diluted brew temporarily increases strength.\nStrength +20% (Max 61)\nDuration: 15s' });
      this.actions = A;
      this.stats = Object.assign({}, this.stats, { hp: 9000, main: 491, wd: 47, det: 296, crit: 580, speed: 402, delay: 2.72 });
      this.autoAttack = Object.assign({}, this.autoAttack, { delay: 2.72 });
      this.referenceDps = 345;     // a scripted 2.0 rotation parses about 325
      this.referenceGcd = 2.08;
    }

    weaponskill(id, e) {
      // Demolish: only the DoT, which goes on at once.
      if (id === 'demolish') {
        const a = this.actions.demolish;
        this.addGl(e);
        this.setForm(e, 'opoOpo');
        const snap = this.snapshot(a, e);
        e.addTStatus(id, a.dot.duration, { snap, dot: { potency: a.dot.potency, id } });
        return;
      }
      this.tsRear = id === 'trueStrike' && e.side() === 'rear';
      super.weaponskill(id, e);
      this.tsRear = false;
      if (id === 'twinSnakes') e.addStatus('twinSnakes', 12);
    }

    // Blood for Blood +20% (2.1 made it 10%); True Strike's rear bonus is +5% crit.
    snapshot(a, e) {
      const s = super.snapshot(a, e);
      if (e.has('bloodForBlood')) s.mult *= 1.2 / 1.1;
      if (this.tsRear) s.critAdd = (s.critAdd || 0) + 0.05;
      return s;
    }

    ability(id, e) {
      if (id === 'invigorate') { if (e.usesTp) e.tp = Math.min(this.tp.max, e.tp + 300); return; }
      super.ability(id, e);
    }

    helpHtml(seq) {
      return `
<h3>How it plays (A Realm Reborn 2.0)</h3>
<p>Level 50 Monk at launch. The forms go Opo-opo → Raptor → Coeurl; Snap Punch and Demolish keep <b>Greased Lightning</b> at three stacks for 12s at a time, +21% damage and 15% faster GCDs. <b>Demolish</b> is only a DoT (40 a tick for 18s), so it's for the DoT and Greased Lightning: Snap Punch is the better coeurl hit while the DoT is up. <b>True Strike</b> from the rear gets +5% crit, not more potency; Bootshine is 130.</p>
<p><b>Blood for Blood</b> is +20% in 2.0: use it on cooldown with <b>Internal Release</b> (+30% crit). <b>Twin Snakes</b> lasts 12s, Shoulder Tackle comes back every 90s, and Invigorate gives 300 TP.</p>
<h3>An opener (the 2.1 guide's, with 2.0's numbers)</h3>
${seq([['perfectBalance'], 'demolish', ['bloodForBlood'], 'snapPunch', ['internalRelease'], 'snapPunch', ['tincture'], 'touchOfDeath', ['steelPeak'], 'dragonKick', ['howlingFist'], 'twinSnakes', 'snapPunch', 'bootshine', 'trueStrike', 'demolish'])}
<p style="color:#a9a3b4">Gear: an end-of-2.0 set with the Allagan Baghnakhs (Strength 491, 47 weapon damage, 2.72 delay) and the HQ Mega-Potion of Strength (max 61). The +5% True Strike crit is from the 2013 wikis only.</p>`;
    }
  }

  B.registerJob({
    id: 'mnk', name: 'Monk', abbr: 'MNK', role: 'melee', classJob: 20,
    versions: [{ id: 'arr21', label: 'A Realm Reborn 2.1–2.57', history: 'ARR 2.1–2.57', note: 'Level 50 on TP: Greased Lightning 27% for 12s and positionals, Touch of Death and Demolish, Perfect Balance every 240s; no Tornado Kick or chakra; Final Coil gear', create: () => new MonkARR() },
      { id: 'arr20', label: 'A Realm Reborn 2.0–2.0', history: 'ARR 2.0–2.0', note: 'Level 50 at launch: Greased Lightning 7/14/21% for 12s, Demolish only a DoT, True Strike\'s rear crit bonus, Shoulder Tackle 90s, Blood for Blood +20%; Binding Coil gear', create: () => new MonkARR20() }],
  });
})(window.BLM);
