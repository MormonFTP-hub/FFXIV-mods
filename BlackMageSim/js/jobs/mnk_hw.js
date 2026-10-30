// Monk, Heavensward (patches 3.07–3.57) at level 60. Built on the Stormblood class (mnk_sb.js) with what Heavensward
// had instead: Greased Lightning stacks of 10% damage and 5% speed lasting 14s (3.07), Tornado Kick on a 40s recast
// (3.07), The Forbidden Chakra at 320 with chakra only from Meditation (no crit procs, no Brotherhood), Perfect
// Balance on 180s, Touch of Death's DoT, Fists of Fire at 5%, no Riddles or Tackles, and the Lancer and Marauder
// cross-class skills (Blood for Blood, Fracture, Invigorate, Bloodbath). Heavensward's damage formula (hw60). Numbers
// are the 3.5x tooltips (Gamer Escape's and the FFXIV wiki's pre-4.0 revisions) and the wiki's patch histories.
(function (B) {
  const SB = B.MonkSB;

  class MonkHW extends SB {
    constructor() {
      super();
      this.level = 60;
      this.levelKey = 'hw60';
      this.model = 'mnk-hw';
      this.glDur = 14;
      this.fofMult = 1.05;
      this.deepMeditation = false;
      this.tackles = false;
      const S = B.MNK_SB.ACTIONS;
      const A = {};
      const keep = ['bootshine', 'trueStrike', 'snapPunch', 'dragonKick', 'twinSnakes', 'demolish', 'armOfTheDestroyer', 'oneIlmPunch',
        'rockbreaker', 'formShift', 'meditation', 'forbiddenChakra', 'tornadoKick', 'steelPeak', 'howlingFist', 'elixirField', 'shoulderTackle',
        'internalRelease', 'perfectBalance', 'fistsOfFire', 'fistsOfWind', 'fistsOfEarth', 'mantra', 'purification', 'secondWind', 'sprint', 'auto'];
      for (const k of keep) A[k] = Object.assign({}, S[k]);
      const set = (id, o) => { A[id] = Object.assign({}, A[id], o); };
      set('bootshine', { potency: 150, tp: 60, desc: 'Delivers an attack with a potency of 150.\nOpo-opo Form Bonus: Critical damage if executed from a target\'s rear\nAdditional Effect: Changes form to raptor\nDuration: 10s' });
      set('dragonKick', { potency: 100, posBonus: 50, tp: 60, desc: 'Delivers an attack with a potency of 100.\n150 when executed from a target\'s flank.\nOpo-opo Form Bonus: Reduces target\'s blunt resistance by 10%\nDuration: 15s\nAdditional Effect: Changes form to raptor\nDuration: 10s' });
      set('trueStrike', { potency: 150, posBonus: 40, tp: 50, desc: 'Delivers an attack with a potency of 150.\n190 when executed from a target\'s rear.\nCan only be executed when in raptor form.\nAdditional Effect: Changes form to coeurl\nDuration: 10s' });
      set('twinSnakes', { potency: 100, posBonus: 40, tp: 60, desc: 'Delivers an attack with a potency of 100.\n140 when executed from a target\'s flank.\nAdditional Effect: Increases damage dealt by 10% (Enhanced Twin Snakes)\nDuration: 15s\nCan only be executed when in raptor form.\nAdditional Effect: Changes form to coeurl\nDuration: 10s' });
      set('snapPunch', { potency: 140, posBonus: 40, tp: 50, desc: 'Delivers an attack with a potency of 140.\n180 when executed from a target\'s flank.\nAdditional Effect: Greased Lightning\nDuration: 14s\nCan only be executed when in coeurl form.\nAdditional Effect: Changes form to opo-opo\nDuration: 10s' });
      set('demolish', { potency: 30, posBonus: 40, tp: 50, dot: { potency: 50, duration: 21 }, desc: 'Delivers an attack with a potency of 30.\n70 when executed from a target\'s rear.\nAdditional Effect: Damage over time\nPotency: 50\nDuration: 21s\nAdditional Effect: Greased Lightning\nDuration: 14s\nCan only be executed when in coeurl form.\nAdditional Effect: Changes form to opo-opo\nDuration: 10s' });
      set('forbiddenChakra', { potency: 320, desc: 'Delivers an attack with a potency of 320.\nCan only be executed with five chakra open.' });
      set('tornadoKick', { recast: 40, desc: 'Delivers an attack with a potency of 330.\nCan only be executed under Greased Lightning III; ends Greased Lightning.' });
      set('perfectBalance', { recast: 180 });
      set('internalRelease', { desc: 'Increases critical hit rate by 30% (Enhanced Internal Release).\nDuration: 15s' });
      set('fistsOfFire', { desc: 'Increases damage dealt by 5%.\nCannot be used with Fists of Earth or Fists of Wind.' });
      set('mantra', { recast: 120 });
      A.touchOfDeath = Object.assign({}, S.bootshine, { name: 'Touch of Death', potency: 20, tp: 80, form: null, positional: null, dot: { potency: 25, duration: 30 }, fx: 'slash3',
        desc: 'Delivers an attack with a potency of 20.\nAdditional Effect: Damage over time\nPotency: 25\nDuration: 30s' });
      // Cross-class skills (Lancer and Marauder).
      A.fracture = Object.assign({}, S.bootshine, { name: 'Fracture', potency: 100, tp: 80, form: null, positional: null, dot: { potency: 20, duration: 18 }, fx: 'gnbSlash',
        desc: 'Delivers an attack with a potency of 100.\nAdditional Effect: Damage over time\nPotency: 20\nDuration: 18s' });
      A.bloodForBlood = { name: 'Blood for Blood', kind: 'ogcd', recast: 80, role: true, desc: 'Increases damage dealt by 10% while increasing damage taken.\nDuration: 20s' };
      A.invigorate = { name: 'Invigorate', kind: 'ogcd', recast: 120, role: true, desc: 'Instantly restores 400 TP.' };
      A.bloodbath = { name: 'Bloodbath', kind: 'ogcd', recast: 90, role: true, desc: 'Converts 25% of physical damage dealt into HP.\nDuration: 15s' };
      A.featherfoot = { name: 'Featherfoot', kind: 'ogcd', recast: 90, desc: 'Increases evasion by 12%.\nDuration: 10s' };
      A.tincture = Object.assign({}, B.tincture('str'), { name: 'Supramax-Potion of Strength', dur: 15, desc: 'This diluted brew temporarily increases strength.\nStrength +20% (Max 154)\nDuration: 15s' });
      this.potionCap = 154;     // the 3.4 potion (Draconian 105 in 3.0x, Max-Potion 127 in 3.2x)
      this.actions = A;
      this.statuses = Object.assign({}, this.statuses, {
        touchOfDeath: { name: 'Touch of Death', self: false, icon: 'st_tod' },
        fracture: { name: 'Fracture', self: false, icon: 'st_fracture' },
        bloodForBlood: { name: 'Blood for Blood', self: true, icon: 'st_bfb' },
        featherfoot: { name: 'Featherfoot', self: true, icon: 'st_feather' },
      });
      // A rough 3.5 set (item level ~270, the Alexandrian Metal Knuckles: 85 weapon damage, 2.56 delay), Heavensward-era
      // stats (today's item data is the 4.0 rescale). No Direct Hit before 4.0.
      this.stats = { hp: 34000, main: 1550, mainStat: 'str', jobMod: 110, trait: 100, wd: 85, det: 600, crit: 950,
        dh: 354, speed: 700, delay: 2.56 };
      this.autoAttack = { potency: 100, delay: 2.56, range: B.MELEE_RANGE };
      this.selfStatusOrder = ['gl3', 'gl2', 'gl1', 'opoOpo', 'raptor', 'coeurl', 'perfectBalance', 'twinSnakes', 'bloodForBlood', 'internalRelease',
        'fistsOfFire', 'fistsOfWind', 'fistsOfEarth', 'medicated', 'mantra', 'bloodbath', 'featherfoot', 'sprint'];
      this.targetStatusOrder = ['demolish', 'touchOfDeath', 'fracture', 'bluntResDown'];
      this.defaultBars = [
        ['bootshine', 'trueStrike', 'snapPunch', 'dragonKick', 'twinSnakes', 'demolish', 'touchOfDeath', 'formShift', 'tornadoKick', 'meditation', 'shoulderTackle', 'steelPeak'],
        ['internalRelease', 'perfectBalance', 'bloodForBlood', 'howlingFist', 'elixirField', 'fistsOfFire', 'fistsOfWind', 'fistsOfEarth', 'tincture', 'invigorate', 'purification', 'fracture'],
        ['armOfTheDestroyer', 'oneIlmPunch', 'rockbreaker', 'mantra', 'bloodbath', 'featherfoot', 'secondWind', 'sprint', null, null, null, null],
      ];
      this.actionGroups = [
        ['Monk', ['bootshine', 'trueStrike', 'snapPunch', 'dragonKick', 'twinSnakes', 'demolish', 'touchOfDeath', 'armOfTheDestroyer', 'oneIlmPunch',
          'rockbreaker', 'formShift', 'meditation', 'forbiddenChakra', 'tornadoKick', 'steelPeak', 'howlingFist', 'elixirField', 'shoulderTackle',
          'internalRelease', 'perfectBalance', 'fistsOfFire', 'fistsOfWind', 'fistsOfEarth', 'mantra', 'purification', 'featherfoot', 'secondWind']],
        ['Cross-class', ['bloodForBlood', 'invigorate', 'fracture', 'bloodbath']],
        ['General', ['sprint', 'tincture']],
      ];
      this.referenceDps = 2650;     // a scripted 3.5 rotation parses about 2,500 (it runs short of TP, as Heavensward Monks did)
      this.referenceGcd = 2.05;
    }

    // Touch of Death and Fracture don't move you through the forms.
    weaponskill(id, e) {
      const a = this.actions[id];
      if (a.form === null) {
        const snap = this.snapshot(a, e);
        e.queueHit(id, a.potency, snap, a.delay, () => e.addTStatus(id, a.dot.duration, { snap, dot: { potency: a.dot.potency, id } }));
        return;
      }
      super.weaponskill(id, e);
    }

    snapshot(a, e) {
      const s = super.snapshot(a, e);
      if (e.has('bloodForBlood')) s.mult *= 1.10;
      s.main = this.stats.main + (e.has('medicated') ? this.potionCap : 0);
      return s;
    }

    ability(id, e) {
      if (id === 'bloodForBlood') { e.addStatus('bloodForBlood', 20); return; }
      if (id === 'bloodbath') { e.addStatus('bloodbath', 15); return; }
      if (id === 'featherfoot') { e.addStatus('featherfoot', 10); return; }
      super.ability(id, e);
    }

    speedInfo(e) { return `GCD ${e.gcdForSpeed(e.stats.speed).toFixed(2)} base · ${e.gcdForSpeed(e.stats.speed, 15).toFixed(2)} with Greased Lightning III · Heavensward's formula`; }

    helpHtml(seq) {
      return `
<h3>How it plays (Heavensward 3.07–3.57)</h3>
<p>Level 60 Monk on TP. The forms are the same as later (Opo-opo → Raptor → Coeurl), and Snap Punch and Demolish keep <b>Greased Lightning</b> at three stacks: +30% damage and 15% faster GCDs, but only <b>14s</b> at a time, so a dropped coeurl hit costs a lot. Keep up Twin Snakes (+10%), Dragon Kick's blunt debuff (+10%), Demolish (50 a tick for 21s) and <b>Touch of Death</b> (25 a tick for 30s). Bootshine in opo-opo from the rear always crits.</p>
<p><b>Tornado Kick</b> (330, 40s) spends Greased Lightning; Perfect Balance (any form, 10s, 180s recast) is where you can rebuild it at once. Chakra only comes from <b>Meditation</b>, so open five before the pull for one <b>Forbidden Chakra</b> (320). Fists of Fire is +5%; Blood for Blood (+10%) and Invigorate come from Lancer, Fracture from Marauder.</p>
<h3>The 3.5 opener</h3>
${seq(['demolish', ['perfectBalance'], 'snapPunch', ['bloodForBlood'], 'snapPunch', ['internalRelease'], ['tincture'], 'twinSnakes', ['shoulderTackle'], 'snapPunch', ['elixirField'], 'touchOfDeath', ['steelPeak'], 'bootshine', ['howlingFist'], 'trueStrike', ['forbiddenChakra'], 'demolish'])}
<p>From the FFXIV wiki's 3.5 Monk page: Fists of Fire, Meditation ×5 and Form Shift ×3 (to coeurl) before the pull.</p>
<p style="color:#a9a3b4">The 3.5x numbers: Bootshine 150, True Strike 150 (190 rear), Snap Punch 140 (180 flank), Dragon Kick 100 (150 flank), Twin Snakes 100 (140 flank), Demolish 30 (70 rear) + 50 × 21s, Touch of Death 20 + 25 × 30s, Tornado Kick 330, The Forbidden Chakra 320, Howling Fist 210, Elixir Field 220. Blood for Blood's 10% is a guess; Heavensward's formula is the community fit; gear approximate.</p>`;
    }
  }

  B.MonkHW = MonkHW;
  B.registerJob({
    id: 'mnk', name: 'Monk', abbr: 'MNK', role: 'melee', classJob: 20,
    versions: [{ id: 'hw307', label: 'Heavensward 3.07–3.57', history: 'HW 3.07–3.57', note: 'Level 60. Greased Lightning III on a 14s timer, Tornado Kick every 40s, Touch of Death, The Forbidden Chakra 320, Blood for Blood, with Heavensward\'s damage formula', create: () => new MonkHW() }],
  });
})(window.BLM);
