// Gunbreaker, Dawntrail at level 100, in two versions. Built on the Endwalker class (gnb_ew.js, 6.2's 120s
// Bloodfest): the Keen Edge combo, three cartridges for Gnashing Fang's chain with Continuation, Burst Strike and
// Double Down, No Mercy (+20%, 20s). 7.0 made Sonic Break a GCD that No Mercy readies (Ready to Break, 30s), gave
// Bloodfest Ready to Reign for Reign of Beasts → Noble Blood → Lion Heart (no cartridges), turned Fated Circle's
// Continuation into Fated Brand, and replaced Rough Divide with Trajectory, which does no damage.
//  - 7.0–7.05: Double Down costs two cartridges, Hypervelocity 220, Reign of Beasts 800 and Noble Blood 1,000.
//  - 7.1–7.38: Double Down costs one, Hypervelocity 200; 7.2's Reign of Beasts 1,000 and Noble Blood 1,100.
//  - 7.4–7.57: Bloodfest every 60s, raising the cartridge cap to six for 30s (here the extra cartridges are lost when it
//    ends: neither the data nor the notes say); Gnashing Fang two charges at 440 (Savage Claw 500, Wicked Talon 560,
//    Continuations 220 / 260 / 300); Burst Strike 420 and Hypervelocity 180; Sonic Break 340 + 120 × 15s; Double Down
//    1,000 for two cartridges; Reign of Beasts 800 / 900 / 1,000. The 7.4 AAC Heavyweight set at 2.50. A bot parses about
//    20,900 on it.
// Numbers are the game data at 7.0, 7.05, 7.1 and 7.2 (xivapi's datamining) and the Lodestone notes; gear is The
// Balance's set for each tier. ref: a scripted bot parses about 14,410 / 17,930 on these.
(function (B) {
  const EW = B.GunbreakerEW;
  const VERSIONS = {
    dt70: { label: 'Dawntrail 7.0–7.05', history: 'DT 7.0–7.05', hyper: 220, ddCarts: 2, reign: [800, 1000, 1200], tincture: 'strdt2', ref: 15270,
      stats: { hp: 226018, main: 4820, wd: 146, det: 2389, crit: 3270, dh: 1392, speed: 420, ten: 771 },
      gear: 'The Balance\'s 2.50 set from the 7.05 savage tier (Strength 4,820, 146 weapon damage), with a Grade 2 Gemdraught',
      note: 'Level 100: Sonic Break as a GCD from No Mercy, Reign of Beasts → Noble Blood → Lion Heart from Bloodfest, Double Down for two cartridges, no Rough Divide; the 7.05 savage gear' },
    dt71: { label: 'Dawntrail 7.1–7.38', history: 'DT 7.1–7.38', hyper: 200, ddCarts: 1, reign: [1000, 1100, 1200], tincture: 'strdt3', ref: 19010,
      stats: { hp: 258612, main: 5580, wd: 152, det: 2883, crit: 3404, dh: 1068, speed: 420, ten: 794 },
      gear: 'The Balance\'s 7.2 2.50 set (Strength 5,580, 152 weapon damage), with a Grade 3 Gemdraught',
      note: 'Level 100: Double Down for one cartridge, Hypervelocity 200, 7.2\'s Reign of Beasts 1,000 and Noble Blood 1,100; the 7.2 savage gear' },
  };
  VERSIONS.dt74 = { label: 'Dawntrail 7.4–7.57', history: 'DT 7.4–7.57', hyper: 180, ddCarts: 2, reign: [800, 900, 1000], tincture: 'strdt4', ref: 22200,
    stats: { hp: 325047, main: 6447, wd: 158, det: 3066, crit: 3595, dh: 1230, speed: 420, ten: 622 },
    gear: 'The Balance\'s 7.4 2.50 set (Strength 6,447, 158 weapon damage, the Grand Champion\'s Sawback), with a Grade 4 Gemdraught',
    note: 'Level 100: Bloodfest every 60s raises the cartridge cap to six and readies Reign of Beasts each minute; Gnashing Fang has two charges; Double Down two cartridges; Sonic Break 340 + 120 × 15s; the 7.4 savage gear' };
  const REIGN = ['reignOfBeasts', 'nobleBlood', 'lionHeart'];
  const ws = (o) => Object.assign({ kind: 'gcd', target: true, range: B.MELEE_RANGE, delay: 0.5 }, o);
  const set = B.setAction;     // a version's change to an action (its description's numbers follow the potency)

  class GunbreakerDT extends EW {
    constructor(version) {
      super('ew62');
      const V = VERSIONS[version];
      this.V = V;
      this.N = Object.assign({}, this.N, { tincture: V.tincture });
      this.level = 100;
      this.levelKey = 100;
      this.model = 'gnb-dt';
      const A = Object.assign({}, this.actions);
      delete A.roughDivide; delete A.nebula;
      set(A, 'keenEdge', { potency: 300, desc: 'Delivers an attack with a potency of 300.' });
      set(A, 'brutalShell', { potency: 240, comboPotency: 380, desc: 'Delivers an attack with a potency of 240.\nCombo Action: Keen Edge\nCombo Potency: 380\nCombo Bonus: Restores own HP\nCombo Bonus: Creates a barrier' });
      set(A, 'solidBarrel', { potency: 240, comboPotency: 460, desc: 'Delivers an attack with a potency of 240.\nCombo Action: Brutal Shell\nCombo Potency: 460\nCombo Bonus: Adds a Cartridge to your Powder Gauge' });
      set(A, 'burstStrike', { potency: 460, desc: 'Delivers an attack with a potency of 460.\nAdditional Effect: Grants Ready to Blast\nDuration: 10s\nCartridge Cost: 1' });
      set(A, 'gnashingFang', { potency: 500, desc: 'Delivers an attack with a potency of 500.\nAdditional Effect: Grants Ready to Rip\nDuration: 10s\nCartridge Cost: 1\nRecast: 30s\nGnashing Fang changes to Savage Claw, then Wicked Talon.' });
      set(A, 'savageClaw', { potency: 560, desc: 'Delivers an attack with a potency of 560.\nCombo Action: Gnashing Fang\nAdditional Effect: Grants Ready to Tear\nDuration: 10s' });
      set(A, 'wickedTalon', { potency: 620, desc: 'Delivers an attack with a potency of 620.\nCombo Action: Savage Claw\nAdditional Effect: Grants Ready to Gouge\nDuration: 10s' });
      set(A, 'jugularRip', { potency: 240, desc: 'Delivers an attack with a potency of 240.\nCan only be executed when Ready to Rip.' });
      set(A, 'abdomenTear', { potency: 280, desc: 'Delivers an attack with a potency of 280.\nCan only be executed when Ready to Tear.' });
      set(A, 'eyeGouge', { potency: 320, desc: 'Delivers an attack with a potency of 320.\nCan only be executed when Ready to Gouge.' });
      set(A, 'hypervelocity', { potency: V.hyper, desc: `Delivers an attack with a potency of ${V.hyper}.\nCan only be executed when Ready to Blast.` });
      set(A, 'blastingZone', { potency: 800, desc: 'Delivers an attack with a potency of 800.' });
      set(A, 'doubleDown', { carts: V.ddCarts, desc: `Delivers an attack to all nearby enemies with a potency of 1,200 for the first enemy, and 15% less for all remaining enemies.\nCartridge Cost: ${V.ddCarts}` });
      set(A, 'sonicBreak', { cd: undefined, ready: 'readyToBreak', desc: 'Delivers an attack with a potency of 300.\nAdditional Effect: Damage over time\nPotency: 60\nDuration: 30s\nCan only be executed while under the effect of Ready to Break.' });
      set(A, 'noMercy', { desc: 'Increases damage dealt by 20%.\nDuration: 20s\nAdditional Effect: Grants Ready to Break\nDuration: 30s' });
      set(A, 'bloodfest', { desc: 'Draws aetheric energy from target, adding 3 Cartridges to your Powder Gauge.\nAdditional Effect: Grants Ready to Reign\nDuration: 30s' });
      set(A, 'fatedCircle', { desc: 'Delivers an attack with a potency of 300 to all nearby enemies.\nAdditional Effect: Grants Ready to Raze\nDuration: 10s\nCartridge Cost: 1' });
      A.fatedBrand = { name: 'Fated Brand', kind: 'ogcd', recast: 1, cdGroup: 'continuation', potency: 120, target: false, pbaoe: 5, aoe: true, ready: 'readyToRaze', delay: 0.5, fx: 'gnbCont',
        desc: 'Delivers an attack with a potency of 120 to all nearby enemies.\nCan only be executed when Ready to Raze.' };
      set(A, 'continuation', { desc: A.continuation.desc + '\nFated Circle may be followed by Fated Brand.' });
      const num = (n) => n.toLocaleString('en-US');
      A.reignOfBeasts = ws({ name: 'Reign of Beasts', potency: V.reign[0], range: 3, aoe: 0.4, fx: 'gnbZone', desc: `Delivers an attack with a potency of ${num(V.reign[0])} to target and all enemies nearby it, 60% less for all remaining enemies.\nCan only be executed while under the effect of Ready to Reign.\nChanges to Noble Blood, then Lion Heart.` });
      A.nobleBlood = ws({ name: 'Noble Blood', potency: V.reign[1], range: 3, aoe: 0.4, fx: 'gnbDouble', desc: `Delivers an attack with a potency of ${num(V.reign[1])} to target and all enemies nearby it, 60% less for all remaining enemies.\nCombo Action: Reign of Beasts` });
      A.lionHeart = ws({ name: 'Lion Heart', potency: V.reign[2], range: 3, aoe: 0.4, fx: 'gnbFang3', desc: `Delivers an attack with a potency of ${num(V.reign[2])} to target and all enemies nearby it, 60% less for all remaining enemies.\nCombo Action: Noble Blood` });
      A.trajectory = { name: 'Trajectory', kind: 'ogcd', recast: 30, charges: 2, target: true, range: 20, desc: 'Rushes toward target.\nMaximum Charges: 2\nCannot be executed while bound.' };
      A.greatNebula = { name: 'Great Nebula', kind: 'ogcd', recast: 120, desc: 'Reduces damage taken by 40% and increases maximum HP by 20%.\nDuration: 15s' };
      A.tincture = B.tincture(V.tincture);
      this.actions = A;
      this.statuses = Object.assign({}, this.statuses, {
        readyToBreak: { name: 'Ready to Break', self: true, icon: 'st_sonic' },
        readyToReign: { name: 'Ready to Reign', self: true, icon: 'st_nomercy' },
        readyToRaze: { name: 'Ready to Raze', self: true, icon: 'st_blast' },
        greatNebula: { name: 'Great Nebula', self: true, icon: 'st_nebula' },
      });
      this.stats = Object.assign({ mainStat: 'str', apMod: 156, jobMod: 100, trait: 100, delay: 2.8 }, V.stats);
      this.selfStatusOrder = ['noMercy', 'readyToBreak', 'readyToReign', 'readyToRip', 'readyToTear', 'readyToGouge', 'readyToBlast', 'readyToRaze', 'brutalShell',
        'royalGuard', 'medicated', 'rampart', 'camouflage', 'greatNebula', 'aurora', 'superbolide', 'heartOfLight', 'heartOfCorundum', 'armsLength', 'sprint'];
      this.defaultBars = [
        ['keenEdge', 'brutalShell', 'solidBarrel', 'gnashingFang', 'continuation', 'burstStrike', 'sonicBreak', 'doubleDown', 'reignOfBeasts', 'lightningShot', 'trajectory', 'royalGuard'],
        ['noMercy', 'bloodfest', 'blastingZone', 'bowShock', 'tincture', 'rampart', 'camouflage', 'greatNebula', 'heartOfCorundum', 'aurora', 'superbolide', 'reprisal'],
        ['heartOfLight', 'sprint', 'armsLength', 'lowBlow', 'interject', 'shirk', 'demonSlice', 'demonSlaughter', 'fatedCircle', 'provoke', null, null],
      ];
      this.actionGroups = [
        ['Gunbreaker', ['keenEdge', 'brutalShell', 'solidBarrel', 'lightningShot', 'demonSlice', 'demonSlaughter', 'burstStrike', 'fatedCircle',
          'gnashingFang', 'savageClaw', 'wickedTalon', 'sonicBreak', 'doubleDown', 'reignOfBeasts', 'nobleBlood', 'lionHeart', 'continuation', 'jugularRip',
          'abdomenTear', 'eyeGouge', 'hypervelocity', 'fatedBrand', 'noMercy', 'bloodfest', 'blastingZone', 'bowShock', 'trajectory', 'royalGuard',
          'camouflage', 'greatNebula', 'aurora', 'superbolide', 'heartOfLight', 'heartOfCorundum']],
        ['Role Actions', ['rampart', 'lowBlow', 'provoke', 'interject', 'reprisal', 'armsLength', 'shirk']],
        ['General', ['sprint', 'tincture']],
      ];
      this.referenceDps = V.ref;
    }

    // Reign of Beasts' button plays Noble Blood and Lion Heart next; Continuation plays Fated Brand after Fated Circle.
    resolveId(id, e) {
      const g = e.g;
      if (id === 'reignOfBeasts' && g.reign && g.reign.until > e.now) return g.reign.next;
      if (id === 'continuation' && e.has('readyToRaze')) return 'fatedBrand';
      return super.resolveId(id, e);
    }

    check(id, e) {
      const g = e.g;
      if (id === 'reignOfBeasts' && !e.has('readyToReign')) return 'Unable to execute action. Ready to Reign required.';
      if ((id === 'nobleBlood' || id === 'lionHeart') && !(g.reign && g.reign.next === id && g.reign.until > e.now)) return 'Unable to execute action.';
      return super.check(id, e);
    }

    resolve(id, e) {
      const g = e.g;
      switch (id) {
        case 'noMercy': e.addStatus('noMercy', 20); e.addStatus('readyToBreak', 30); return;
        case 'bloodfest': super.resolve(id, e); e.addStatus('readyToReign', 30); return;
        case 'fatedCircle': super.resolve(id, e); this.setReady(e, 'readyToRaze'); return;
        case 'reignOfBeasts': case 'nobleBlood': case 'lionHeart': {
          if (id === 'reignOfBeasts') e.removeStatus('readyToReign');
          const k = REIGN.indexOf(id);
          g.reign = k < 2 ? { next: REIGN[k + 1], until: e.now + 30 } : null;
          break;
        }
        case 'greatNebula': e.addStatus('greatNebula', 15); return;
        case 'trajectory': {
          const d = e.distToTarget() || 1;
          if (d > 2.6) {
            const from = { x: e.pos.x, z: e.pos.z };
            e.pos.x *= 2.4 / d; e.pos.z *= 2.4 / d;
            e.emit('teleport', { from, to: { x: e.pos.x, z: e.pos.z } });
          }
          return;
        }
      }
      super.resolve(id, e);
    }

    setReady(e, key) {
      if (key !== 'readyToRaze') e.removeStatus('readyToRaze', true);
      else for (const r of ['readyToRip', 'readyToTear', 'readyToGouge', 'readyToBlast']) e.removeStatus(r, true);
      if (key === 'readyToRaze') e.addStatus(key, 10); else super.setReady(e, key);
    }

    proc(id, e) {
      const g = e.g;
      if (id === 'reignOfBeasts') return e.has('readyToReign') || !!(g.reign && g.reign.until > e.now);
      if (id === 'sonicBreak') return e.has('readyToBreak');
      if (id === 'continuation' && e.has('readyToRaze')) return true;
      return super.proc(id, e);
    }

    helpHtml(seq) {
      const V = this.V;
      return `
<h3>How it plays (${V.label})</h3>
<p>Level 100 Gunbreaker. <b>Keen Edge → Brutal Shell → Solid Barrel</b> adds a cartridge (three at most). Spend them on <b>Gnashing Fang</b> (500, 30s), which turns into <b>Savage Claw</b> (560) and <b>Wicked Talon</b> (620), each followed by a <b>Continuation</b> (240 / 280 / 320); <b>Burst Strike</b> (460, then Hypervelocity ${V.hyper}); and <b>Double Down</b> (1,200, 60s, ${V.ddCarts} cartridge${V.ddCarts > 1 ? 's' : ''}).</p>
<p><b>No Mercy</b> (+20% for 20s, 60s) readies <b>Sonic Break</b> (300 and a 60-potency DoT for 30s), now a GCD; put Gnashing Fang's chain, Double Down, <b>Blasting Zone</b> (800) and <b>Bow Shock</b> in it too. <b>Bloodfest</b> (120s) adds three cartridges and readies <b>Reign of Beasts → Noble Blood → Lion Heart</b> (${V.reign.join(' / ')}, no cartridges), best inside No Mercy.${V.ddCarts === 1 ? ' With Double Down at one cartridge, enter a No Mercy that holds Bloodfest below three cartridges so none are wasted.' : ''} Trajectory is only a dash now.</p>
<h3>The opener (The Balance)</h3>
${V.ddCarts === 1
    ? seq(['lightningShot', ['bloodfest'], 'keenEdge', ['tincture'], 'burstStrike', ['noMercy'], ['hypervelocity'], 'gnashingFang', ['jugularRip'], ['bowShock'], 'doubleDown', ['blastingZone'], 'sonicBreak', 'savageClaw', ['abdomenTear'], 'wickedTalon', ['eyeGouge'], 'reignOfBeasts', 'nobleBlood', 'lionHeart'])
    : seq(['lightningShot', 'keenEdge', 'brutalShell', ['tincture'], ['noMercy'], ['bloodfest'], 'sonicBreak', 'doubleDown', ['bowShock'], ['blastingZone'], 'gnashingFang', ['jugularRip'], 'savageClaw', ['abdomenTear'], 'wickedTalon', ['eyeGouge'], 'reignOfBeasts', 'nobleBlood', 'lionHeart'])}
<p>Lightning Shot at -0.7s. ${V.ddCarts === 1 ? 'Bloodfest right after the pull, so No Mercy starts at three cartridges.' : 'No Mercy at two GCDs in, with Bloodfest right after it; Double Down takes two cartridges.'}</p>
<p style="color:#a9a3b4">${V.label} numbers: Keen Edge 300, Brutal Shell 380 and Solid Barrel 460 in combo, Burst Strike 460, Hypervelocity ${V.hyper}, Gnashing Fang 500, Savage Claw 560, Wicked Talon 620, Continuation 240 / 280 / 320, Double Down 1,200, Sonic Break 300 + 60 × 30s, Blasting Zone 800, Bow Shock 150 + 60 × 15s, Reign of Beasts ${V.reign.join(' / ')}; auto-attacks 90 at 2.80s.${V.ddCarts === 1 ? ' 7.1–7.11 had Reign of Beasts 800 and Noble Blood 1,000.' : ''} Gear: ${V.gear}.</p>`;
    }
  }

  // 7.4: a 60s Bloodfest that lifts the cartridge cap to six for 30s, two charges of Gnashing Fang.
  class GunbreakerDT74 extends GunbreakerDT {
    constructor() {
      super('dt74');
      const A = Object.assign({}, this.actions);
      set(A, 'gnashingFang', { potency: 440, charges: 2, desc: 'Delivers an attack with a potency of 440.\nAdditional Effect: Grants Ready to Rip\nDuration: 10s\nCartridge Cost: 1\nRecast: 30s\nMaximum Charges: 2\nGnashing Fang changes to Savage Claw, then Wicked Talon.' });
      set(A, 'savageClaw', { potency: 500, desc: A.savageClaw.desc.replace('560', '500') });
      set(A, 'wickedTalon', { potency: 560, desc: A.wickedTalon.desc.replace('620', '560') });
      set(A, 'jugularRip', { potency: 220, desc: A.jugularRip.desc.replace('240', '220') });
      set(A, 'abdomenTear', { potency: 260, desc: A.abdomenTear.desc.replace('280', '260') });
      set(A, 'eyeGouge', { potency: 300, desc: A.eyeGouge.desc.replace('320', '300') });
      set(A, 'burstStrike', { potency: 420, desc: A.burstStrike.desc.replace('460', '420') });
      set(A, 'sonicBreak', { potency: 340, dot: { potency: 120, duration: 15 }, desc: 'Delivers an attack with a potency of 340.\nAdditional Effect: Damage over time\nPotency: 120\nDuration: 15s\nCan only be executed while under the effect of Ready to Break.' });
      set(A, 'doubleDown', { potency: 1000, desc: 'Delivers an attack to all nearby enemies with a potency of 1,000 for the first enemy, and 15% less for all remaining enemies.\nCartridge Cost: 2' });
      set(A, 'bloodfest', { recast: 60, desc: 'Draws aetheric energy from target, adding 3 Cartridges to your Powder Gauge.\nAdditional Effect: Increases the maximum number of cartridges to 6\nDuration: 30s\nAdditional Effect: Grants Ready to Reign\nDuration: 30s' });
      this.actions = A;
      this.statuses = Object.assign({}, this.statuses, { bloodfest: { name: 'Bloodfest', self: true, icon: 'st_bloodfest' } });
      this.selfStatusOrder = ['bloodfest'].concat(this.selfStatusOrder);
    }

    resolve(id, e) {
      if (id === 'bloodfest') e.addStatus('bloodfest', 30);
      if (id === 'bloodfest' || id === 'solidBarrel' || id === 'demonSlaughter') {
        this.maxCarts = e.has('bloodfest') ? 6 : 3;
        try { super.resolve(id, e); } finally { this.maxCarts = 3; }
        return;
      }
      super.resolve(id, e);
    }

    // Cartridges above three go when Bloodfest's cap ends.
    process(e) {
      if (super.process) super.process(e);
      const g = e.g;
      if (g.carts > 3 && !e.has('bloodfest')) { g.carts = 3; e.emit('carts', {}); }
    }

    proc(id, e) {
      if (id === 'burstStrike' && e.g.carts >= (e.has('bloodfest') ? 6 : 3)) return true;
      return super.proc(id, e);
    }

    // The gauge has three rounds; the number beside them shows up to six.
    helpHtml(seq) {
      return super.helpHtml(seq).replace(`<h3>How it plays (${VERSIONS.dt74.label})</h3>`, `<h3>How it plays (${VERSIONS.dt74.label})</h3>
<p><b>${VERSIONS.dt74.label}:</b> every minute is a burst. <b>Bloodfest</b> (60s) adds three cartridges and lifts the cap to <b>six</b> for 30s, and readies <b>Reign of Beasts → Noble Blood → Lion Heart</b> (800 / 900 / 1,000) inside every No Mercy. <b>Gnashing Fang</b> has two charges (440, Savage Claw 500, Wicked Talon 560, Continuations 220 / 260 / 300); <b>Double Down</b> is 1,000 for two cartridges; <b>Sonic Break</b> 340 + 120 × 15s fits inside No Mercy; Burst Strike 420. Gear: ${VERSIONS.dt74.gear}. The older text below describes 7.1.</p>`);
    }
  }

  B.registerJob({
    id: 'gnb', name: 'Gunbreaker', abbr: 'GNB', role: 'tank', classJob: 37,
    versions: [{ id: 'dt74', label: VERSIONS.dt74.label, history: VERSIONS.dt74.history, note: VERSIONS.dt74.note, create: () => new GunbreakerDT74() },
      ...['dt71', 'dt70'].map(v => ({ id: v, label: VERSIONS[v].label, history: VERSIONS[v].history, note: VERSIONS[v].note, create: () => new GunbreakerDT(v) }))],
  });
})(window.BLM);
