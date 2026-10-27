// Gunbreaker, Shadowbringers at level 80, in two versions: 5.1–5.58, the Gunbreaker of the "Gunbreaker dance", and
// 5.0–5.08, the launch kit (the same damage; Nebula 10s, a 150 Brutal Shell heal with a 10s barrier, a single-target 5s
// Reprisal, Eden's Gate gear). Built on the
// Endwalker class (gnb_ew.js) with what played differently before 6.0: two cartridges (Bloodfest adds 2, 90s
// recast), no Double Down or Hypervelocity, Savage Claw and Wicked Talon as their own buttons, Gnashing Fang and
// Sonic Break recasts shortened by skill speed (so they drift and need a filler GCD each minute), a 15s combo window,
// Heart of Stone, one Aurora charge and an 8s Superbolide. Patch 5.1 lengthened Nebula to 15s. Numbers are the
// 5.58 values the 6.0 patch notes changed from (FFXIV wiki patch histories); the opener is The Balance's 5.58
// "4th GCD No Mercy". Level 80 uses the pre-squish formula (B.LEVELS.shb80). Gear stats are the 5.58 Item.csv's:
// 5.1 uses The Balance's 5.58 relic tank set at 2.41 (the Paladin's: the same Fending armour and a 134-damage relic),
// 5.0 an Eden's Gate set at 2.40 (Edengrace and Augmented Deepshadow, item level 470–475). ref: a scripted bot parses
// about 13,500 / 8,900 on these.
(function (B) {
  const EW = B.GunbreakerEW;
  const COMBO_WINDOW = 15;
  const VERSIONS = {
    shb51: { label: 'Shadowbringers 5.1–5.58', history: 'ShB 5.1–5.58', nebula: 15, brutal: [200, 30], reprisal: 10, tincture: 'str4', gcd: 2.41, ref: 14340,
      stats: { main: 5509, wd: 134, det: 2600, crit: 4145, dh: 1280, speed: 1218, ten: 908 },
      note: 'Two cartridges, 90s Bloodfest for 2, Savage Claw and Wicked Talon on their own buttons, skill speed drifts Gnashing Fang, level 80' },
    shb50: { label: 'Shadowbringers 5.0–5.08', history: 'ShB 5.0–5.08', nebula: 10, brutal: [150, 10], reprisal: 5, tincture: 'str2', gcd: 2.4, ref: 9440,
      stats: { main: 4142, wd: 122, det: 1913, crit: 3662, dh: 1220, speed: 1331, ten: 1041 },
      note: 'The launch Gunbreaker: the 5.1 damage kit with a 10s Nebula, a 150 Brutal Shell heal and a single-target Reprisal; Eden\'s Gate gear' },
  };

  class GunbreakerShB extends EW {
    constructor(version) {
      super('ew62');
      const V = VERSIONS[version || 'shb51'];
      this.V = V;
      this.level = 80;
      this.levelKey = 'shb80';
      this.model = 'gnb-shb';
      this.maxCarts = 2;
      this.bloodfestCarts = 2;
      this.ammoCombo = COMBO_WINDOW;
      this.comboTime = COMBO_WINDOW;
      this.oneButtonFang = false;
      this.N = Object.assign({}, this.N, { tincture: V.tincture, contRange: 3 });
      this.actions = this.buildShB(this.actions);
      this.statuses = Object.assign({}, this.statuses, { heartOfStone: { name: 'Heart of Stone', self: true, icon: 'st_hos' } });
      delete this.statuses.heartOfCorundum;
      this.stats = Object.assign({ hp: 86000, mainStat: 'str', jobMod: 100, trait: 100, delay: 2.8 }, V.stats);
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
      this.referenceDps = V.ref;
      this.referenceGcd = V.gcd;
      this.startDistance = 3.2;
    }

    // The Endwalker kit with the 5.58 numbers and buttons.
    buildShB(A) {
      const set = (id, o) => { A[id] = Object.assign({}, A[id], o); };
      set('keenEdge', { potency: 200, desc: 'Delivers an attack with a potency of 200.' });
      set('demonSlice', { potency: 150, desc: 'Delivers an attack with a potency of 150 to all nearby enemies.' });
      set('demonSlaughter', { potency: 100, comboPotency: 250, desc: 'Delivers an attack with a potency of 100 to all nearby enemies.\nCombo Action: Demon Slice\nCombo Potency: 250\nCombo Bonus: Adds a Cartridge to your Powder Gauge' });
      set('fatedCircle', { potency: 320, desc: 'Delivers an attack with a potency of 320 to all nearby enemies.\nCartridge Cost: 1' });
      const V = this.V;
      set('brutalShell', { potency: 100, comboPotency: 300, desc: `Delivers an attack with a potency of 100.\nCombo Action: Keen Edge\nCombo Potency: 300\nCombo Bonus: Restores own HP\nCure Potency: ${V.brutal[0]}\nCombo Bonus: Creates a barrier which nullifies damage equal to HP restored\nDuration: ${V.brutal[1]}s` });
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
      set('tincture', B.tincture(V.tincture));
      set('nebula', { desc: `Reduces damage taken by 30%.\nDuration: ${V.nebula}s` });
      if (V.reprisal === 5) set('reprisal', { desc: 'Reduces damage dealt by target by 10%.\nDuration: 5s' });
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
      if (id === 'nebula') { e.addStatus('nebula', this.V.nebula); return; }
      if (id === 'reprisal') { e.addTStatus('reprisal', this.V.reprisal); return; }
      super.resolve(id, e);
      if (id === 'brutalShell' && e.lastComboHit) e.addStatus('brutalShell', this.V.brutal[1]);
    }

    speedInfo(e) {
      return `GCD ${e.gcdForSpeed(e.stats.speed).toFixed(2)} · Gnashing Fang ${e.speedScale(30).toFixed(1)}s · Sonic Break ${e.speedScale(60).toFixed(1)}s`;
    }

    helpHtml(seq) {
      return `
<h3>How it plays (${this.V.label})</h3>
<p>${this.V.reprisal === 5 ? 'The launch Gunbreaker at level 80: the same damage kit as 5.1–5.58 (Nebula lasts 10s, Brutal Shell heals 150 for a 10s barrier).' : 'The level 80 Gunbreaker of the "Gunbreaker dance".'} The <b>Powder Gauge</b> holds only 2 cartridges: Solid Barrel (end of Keen Edge → Brutal Shell → Solid Barrel) adds one, <b>Bloodfest</b> adds two (90s recast). Spend them on <b>Gnashing Fang</b> (450) and <b>Burst Strike</b> (500). There's no Double Down or Hypervelocity yet.</p>
<p>Gnashing Fang, <b>Savage Claw</b> and <b>Wicked Talon</b> are three separate buttons, and each lets <b>Continuation</b> fire once (Jugular Rip, Abdomen Tear, Eye Gouge). Use it before your next weaponskill, or the Ready effect is lost. Combos last only 15s, and Keen Edge, Brutal Shell or Solid Barrel break the Gnashing Fang combo (Burst Strike and Sonic Break don't).</p>
<p>Gnashing Fang's 30s and Sonic Break's 60s recasts are shortened by skill speed, so at 2.41 they come up a little early each minute. Add one filler GCD each minute so they stay inside <b>No Mercy</b> (+20%, 20s, every 60s). Inside No Mercy: Gnashing Fang combo, Sonic Break, Blasting Zone, Bow Shock, both Rough Divides, and every cartridge on Burst Strike.</p>
<h3>The 5.58 opener (4th GCD No Mercy)</h3>
${seq(['keenEdge', 'brutalShell', ['tincture'], 'solidBarrel', 'keenEdge', ['noMercy'], 'gnashingFang', ['jugularRip'], 'sonicBreak', ['blastingZone'], ['bowShock'], 'savageClaw', ['abdomenTear'], ['bloodfest'], 'wickedTalon', ['roughDivide'], ['eyeGouge'], 'burstStrike', ['roughDivide'], 'brutalShell', 'burstStrike', 'solidBarrel', 'burstStrike', 'keenEdge', 'brutalShell'])}
<p>The Balance's 5.58 opener${this.V.reprisal === 5 ? ', the same at 5.0 (no 5.0x text of it survives)' : ' for the 2.41 tier'}. Burst Strike doesn't break the Keen Edge combo, so the Solid Barrel combo carries on around it.</p>
<p style="color:#a9a3b4">The 5.58 numbers: Keen Edge 200; Brutal Shell 300 and Solid Barrel 400 in combo; Burst Strike 500; Gnashing Fang 450, Savage Claw 550, Wicked Talon 650; Jugular Rip 260, Abdomen Tear 280, Eye Gouge 300; Sonic Break 300 + 90 per tick for 30s; Blasting Zone 800; Bow Shock 200 + 90 per tick for 15s; Rough Divide 200 (2 charges); auto-attacks 110 at 2.80s. Gear: ${this.V.reprisal === 5 ? 'an Eden\'s Gate set at 2.40 (Strength 4,142, 122 weapon damage), with a Grade 2 Tincture' : 'The Balance\'s 5.58 relic tank set at 2.41 (Strength 5,509, 134 weapon damage)'}, pre-6.0 stats from the 5.58 game data.</p>`;
    }
  }

  B.registerJob({
    id: 'gnb', name: 'Gunbreaker', abbr: 'GNB', role: 'tank', classJob: 37,
    versions: ['shb51', 'shb50'].map(v => ({ id: v, label: VERSIONS[v].label, history: VERSIONS[v].history, note: VERSIONS[v].note, create: () => new GunbreakerShB(v) })),
  });
})(window.BLM);
