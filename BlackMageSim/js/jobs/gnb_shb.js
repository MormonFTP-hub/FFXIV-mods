// Gunbreaker, Shadowbringers patches 5.1–5.58 at level 80: the Gunbreaker of the "Gunbreaker dance". Built on the
// Endwalker class (gnb_ew.js) with what played differently before 6.0: two cartridges (Bloodfest adds 2, 90s
// recast), no Double Down or Hypervelocity, Savage Claw and Wicked Talon as their own buttons, Gnashing Fang and
// Sonic Break recasts shortened by skill speed (so they drift and need a filler GCD each minute), a 15s combo window,
// Heart of Stone, one Aurora charge and an 8s Superbolide. Patch 5.1 lengthened Nebula to 15s. Numbers are the
// 5.58 values the 6.0 patch notes changed from (FFXIV wiki patch histories); the opener is The Balance's 5.58
// "4th GCD No Mercy". Level 80 uses the pre-squish formula (B.LEVELS.shb80).
(function (B) {
  const EW = B.GunbreakerEW;
  const COMBO_WINDOW = 15;

  class GunbreakerShB extends EW {
    constructor() {
      super('ew62');
      this.level = 80;
      this.levelKey = 'shb80';
      this.model = 'gnb-shb';
      this.maxCarts = 2;
      this.bloodfestCarts = 2;
      this.ammoCombo = COMBO_WINDOW;
      this.comboTime = COMBO_WINDOW;
      this.oneButtonFang = false;
      this.N = Object.assign({}, this.N, { tincture: 'str4', contRange: 3 });
      this.actions = this.buildShB(this.actions);
      this.statuses = Object.assign({}, this.statuses, { heartOfStone: { name: 'Heart of Stone', self: true, icon: 'st_hos' } });
      delete this.statuses.heartOfCorundum;
      // A rough 5.58 item level 530 relic set at the 2.41 GCD (The Balance's tier); pre-squish level 80 stats.
      this.stats = { hp: 86000, main: 5250, mainStat: 'str', jobMod: 100, trait: 100, wd: 180, det: 2600, crit: 3500,
        dh: 1650, speed: 1300, ten: 600, delay: 2.8 };
      this.autoAttack = { potency: 110, delay: 2.8, range: B.MELEE_RANGE };
      this.selfStatusOrder = ['noMercy', 'readyToRip', 'readyToTear', 'readyToGouge', 'brutalShell', 'royalGuard',
        'medicated', 'rampart', 'camouflage', 'nebula', 'aurora', 'superbolide', 'heartOfLight', 'heartOfStone',
        'armsLength', 'sprint'];
      this.defaultBars = [
        ['keenEdge', 'brutalShell', 'solidBarrel', 'gnashingFang', 'savageClaw', 'wickedTalon', 'continuation', 'burstStrike', 'sonicBreak', 'lightningShot', 'roughDivide', 'royalGuard'],
        ['noMercy', 'bloodfest', 'blastingZone', 'bowShock', 'tincture', 'rampart', 'camouflage', 'nebula', 'heartOfStone', 'aurora', 'superbolide', 'reprisal'],
        ['heartOfLight', 'provoke', 'sprint', 'armsLength', 'lowBlow', 'interject', 'shirk', 'demonSlice', 'demonSlaughter', 'fatedCircle', null, null],
      ];
      this.actionGroups = [
        ['Gunbreaker', ['keenEdge', 'brutalShell', 'solidBarrel', 'lightningShot', 'demonSlice', 'demonSlaughter', 'burstStrike', 'fatedCircle', 'gnashingFang', 'savageClaw',
          'wickedTalon', 'sonicBreak', 'continuation', 'jugularRip', 'abdomenTear', 'eyeGouge', 'noMercy', 'bloodfest',
          'blastingZone', 'bowShock', 'roughDivide', 'royalGuard', 'camouflage', 'nebula', 'aurora', 'superbolide',
          'heartOfLight', 'heartOfStone']],
        ['Role Actions', ['rampart', 'lowBlow', 'provoke', 'interject', 'reprisal', 'armsLength', 'shirk']],
        ['General', ['sprint', 'tincture']],
      ];
      this.referenceDps = 15900;     // a scripted 5.58 rotation at 2.41 parses about 15,000 on the dummy
      this.referenceGcd = 2.41;
      this.startDistance = 3.2;
    }

    // The Endwalker kit with the 5.58 numbers and buttons.
    buildShB(A) {
      const set = (id, o) => { A[id] = Object.assign({}, A[id], o); };
      set('keenEdge', { potency: 200, desc: 'Delivers an attack with a potency of 200.' });
      set('demonSlice', { potency: 150, desc: 'Delivers an attack with a potency of 150 to all nearby enemies.' });
      set('demonSlaughter', { potency: 100, comboPotency: 250, desc: 'Delivers an attack with a potency of 100 to all nearby enemies.\nCombo Action: Demon Slice\nCombo Potency: 250\nCombo Bonus: Adds a Cartridge to your Powder Gauge' });
      set('fatedCircle', { potency: 320, desc: 'Delivers an attack with a potency of 320 to all nearby enemies.\nCartridge Cost: 1' });
      set('brutalShell', { potency: 100, comboPotency: 300, desc: 'Delivers an attack with a potency of 100.\nCombo Action: Keen Edge\nCombo Potency: 300\nCombo Bonus: Restores own HP\nCure Potency: 200\nCombo Bonus: Creates a barrier which nullifies damage equal to HP restored\nDuration: 30s' });
      set('solidBarrel', { potency: 100, comboPotency: 400, desc: 'Delivers an attack with a potency of 100.\nCombo Action: Brutal Shell\nCombo Potency: 400\nCombo Bonus: Adds a Cartridge to your Powder Gauge' });
      set('burstStrike', { potency: 500, desc: 'Delivers an attack with a potency of 500.\nCartridge Cost: 1' });
      set('gnashingFang', { potency: 450, cdScales: true, desc: 'Delivers an attack with a potency of 450.\nAdditional Effect: Grants Ready to Rip\nDuration: 10s\nCartridge Cost: 1\nRecast time is affected by skill speed.' });
      set('savageClaw', { potency: 550, desc: 'Delivers an attack with a potency of 550.\nCombo Action: Gnashing Fang\nAdditional Effect: Grants Ready to Tear\nDuration: 10s' });
      set('wickedTalon', { potency: 650, desc: 'Delivers an attack with a potency of 650.\nCombo Action: Savage Claw\nAdditional Effect: Grants Ready to Gouge\nDuration: 10s' });
      set('sonicBreak', { potency: 300, cdScales: true, dot: { potency: 90, duration: 30 }, desc: 'Delivers an attack with a potency of 300.\nAdditional Effect: Damage over time\nPotency: 90\nDuration: 30s\nRecast time is affected by skill speed.' });
      set('jugularRip', { potency: 260, range: 3, desc: 'Delivers an attack with a potency of 260.\nCan only be executed when Ready to Rip.' });
      set('abdomenTear', { potency: 280, range: 3, desc: 'Delivers an attack with a potency of 280.\nCan only be executed when Ready to Tear.' });
      set('eyeGouge', { potency: 300, range: 3, desc: 'Delivers an attack with a potency of 300.\nCan only be executed when Ready to Gouge.' });
      set('continuation', { desc: 'Allows the firing of successive rounds with your gunblade.\nGnashing Fang may be followed by Jugular Rip.\nSavage Claw may be followed by Abdomen Tear.\nWicked Talon may be followed by Eye Gouge.' });
      set('blastingZone', { potency: 800, desc: 'Delivers an attack with a potency of 800.' });
      set('bowShock', { potency: 200, dot: { potency: 90, duration: 15 }, desc: 'Delivers an attack with a potency of 200 to all nearby enemies.\nAdditional Effect: Damage over time\nPotency: 90\nDuration: 15s' });
      set('roughDivide', { potency: 200, range: 15, desc: 'Delivers a jumping attack with a potency of 200.\nCannot be executed while bound.\nMaximum Charges: 2' });
      set('bloodfest', { recast: 90, desc: 'Draws aetheric energy from target, adding 2 Cartridges to your Powder Gauge.' });
      set('aurora', { charges: 1, desc: 'Grants Regen to target.\nCure Potency: 200\nDuration: 18s' });
      set('superbolide', { desc: 'Reduces HP to 1 and renders you impervious to most attacks.\nDuration: 8s' });
      set('tincture', B.tincture('str4'));
      A.heartOfStone = { name: 'Heart of Stone', kind: 'ogcd', recast: 25, desc: 'Reduces damage taken by 15%.\nDuration: 7s\nAdditional Effect: When targeting a party member while under the effect of Brutal Shell, that effect is also granted to the target.' };
      delete A.doubleDown; delete A.hypervelocity; delete A.heartOfCorundum;
      return A;
    }

    // No Hypervelocity before 6.0, so Burst Strike grants nothing.
    setReady(e, key) { if (key !== 'readyToBlast') super.setReady(e, key); }

    resolveId(id, e) {
      if (id === 'continuation') {
        for (const r of ['readyToRip', 'readyToTear', 'readyToGouge']) if (e.has(r)) return { readyToRip: 'jugularRip', readyToTear: 'abdomenTear', readyToGouge: 'eyeGouge' }[r];
      }
      return id;
    }

    resolve(id, e) {
      const a = this.actions[id], g = e.g;
      // In 5.x every weaponskill used the Ready to Rip / Tear / Gouge up, and the Solid Barrel combo broke the
      // Gnashing Fang combo.
      if (a.kind === 'gcd') {
        for (const r of ['readyToRip', 'readyToTear', 'readyToGouge']) e.removeStatus(r, true);
        if (a.comboFrom || a.comboStart) g.ammo = null;
      }
      if (id === 'superbolide') { e.addStatus('superbolide', 8); return; }
      if (id === 'heartOfStone') { e.addStatus('heartOfStone', 7); return; }
      super.resolve(id, e);
    }

    speedInfo(e) {
      return `GCD ${e.gcdForSpeed(e.stats.speed).toFixed(2)} · Gnashing Fang ${e.speedScale(30).toFixed(1)}s · Sonic Break ${e.speedScale(60).toFixed(1)}s`;
    }

    helpHtml(seq) {
      return `
<h3>How it plays (Shadowbringers 5.1–5.58)</h3>
<p>The level 80 Gunbreaker of the "Gunbreaker dance". The <b>Powder Gauge</b> holds only 2 cartridges: Solid Barrel (end of Keen Edge → Brutal Shell → Solid Barrel) adds one, <b>Bloodfest</b> adds two (90s recast). Spend them on <b>Gnashing Fang</b> (450) and <b>Burst Strike</b> (500). There's no Double Down or Hypervelocity yet.</p>
<p>Gnashing Fang, <b>Savage Claw</b> and <b>Wicked Talon</b> are three separate buttons, and each lets <b>Continuation</b> fire once (Jugular Rip, Abdomen Tear, Eye Gouge). Use it before your next weaponskill, or the Ready effect is lost. Combos last only 15s, and Keen Edge, Brutal Shell or Solid Barrel break the Gnashing Fang combo (Burst Strike and Sonic Break don't).</p>
<p>Gnashing Fang's 30s and Sonic Break's 60s recasts are shortened by skill speed, so at 2.41 they come up a little early each minute. Add one filler GCD each minute so they stay inside <b>No Mercy</b> (+20%, 20s, every 60s). Inside No Mercy: Gnashing Fang combo, Sonic Break, Blasting Zone, Bow Shock, both Rough Divides, and every cartridge on Burst Strike.</p>
<h3>The 5.58 opener (4th GCD No Mercy)</h3>
${seq(['keenEdge', 'brutalShell', ['tincture'], 'solidBarrel', 'keenEdge', ['noMercy'], 'gnashingFang', ['jugularRip'], 'sonicBreak', ['blastingZone'], ['bowShock'], 'savageClaw', ['abdomenTear'], ['bloodfest'], 'wickedTalon', ['roughDivide'], ['eyeGouge'], 'burstStrike', ['roughDivide'], 'brutalShell', 'burstStrike', 'solidBarrel', 'burstStrike', 'keenEdge', 'brutalShell'])}
<p>The Balance's 5.58 opener for the 2.41 tier. Burst Strike doesn't break the Keen Edge combo, so the Solid Barrel combo carries on around it.</p>
<p style="color:#a9a3b4">The 5.58 numbers: Keen Edge 200; Brutal Shell 300 and Solid Barrel 400 in combo; Burst Strike 500; Gnashing Fang 450, Savage Claw 550, Wicked Talon 650; Jugular Rip 260, Abdomen Tear 280, Eye Gouge 300; Sonic Break 300 + 90 per tick for 30s; Blasting Zone 800; Bow Shock 200 + 90 per tick for 15s; Rough Divide 200 (2 charges); auto-attacks 110 at 2.80s.</p>`;
    }
  }

  B.registerJob({
    id: 'gnb', name: 'Gunbreaker', abbr: 'GNB', role: 'tank', classJob: 37,
    versions: [{ id: 'shb51', label: 'Shadowbringers 5.1–5.58', history: 'ShB 5.1–5.58', note: 'Two cartridges, 90s Bloodfest for 2, Savage Claw and Wicked Talon on their own buttons, skill speed drifts Gnashing Fang, level 80', create: () => new GunbreakerShB() }],
  });
})(window.BLM);
