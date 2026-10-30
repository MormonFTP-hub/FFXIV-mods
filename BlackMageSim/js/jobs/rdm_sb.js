// Red Mage, Stormblood 4.0–4.58 at level 70: the debut. Built on the Shadowbringers class (rdm_shb.js) for Dualcast,
// the Balance Gauge and its 30-mana imbalance rule, the enchanted melee combo into Verflare / Verholy, Embolden's decay
// and Manafication. What Stormblood didn't have yet: Scorch, Engagement, Reprise, Verthunder II / Veraero II, and
// Manafication's +5% (it only doubles the mana and resets Corps-a-corps and Displacement). Impact needs Impactful,
// which every Jolt II grants for 30s; Scatter is the AoE spell.
// The 4.4–4.58 numbers (the final tier): Jolt II 240, Verthunder / Veraero 310 (300 before 4.4), Verfire / Verstone
// 270, Impact 270, Verflare / Verholy 600 (550 before 4.4), Fleche 420, Contre Sixte 350 (300 before 4.4), Corps-a-corps
// and Displacement 130. Numbers are the game data at 4.11, 4.2 and 4.4 (xivapi's datamining) and the Lodestone notes;
// MP costs are the data's units × 120, the pool 12,000 × Red Mage's 120%. Gear is the 4.58 item data's (pre-6.0).
(function (B) {
  const ShB = B.RedMageShB;
  const set = B.setAction;     // a version's change to an action (its description's numbers follow the potency)
  const S = {
    jolt: 240, ver: 310, proc: 270, impact: 270, flare: 600, fleche: 420, contre: 350, displacement: 130,
    riposte: 210, zwerch: 290, redoub: 470,
    maxMp: 14400, tincture: 'int3sb', ref: 7260,     // ref: a scripted bot parses about 6,850 over 5 minutes
    stats: { hp: 31000, main: 3216, wd: 147, det: 1203, crit: 2602, dh: 2054, speed: 504 },
    gear: 'a rough Alphascape Savage set (Intelligence 3,216, the Omega Smallsword: 147 magic damage)',
  };

  class RedMageSB extends ShB {
    constructor() {
      super('shb51');
      this.V = Object.assign({}, this.V, {
        label: 'Stormblood 4.0–4.58', jolt: S.jolt, ver: S.ver, proc: S.proc, fleche: S.fleche, contre: S.contre, contreAoe: 0.5,
        riposte: S.riposte, accel: { stacks: 1, dur: 10, recast: 35 }, tincture: S.tincture, gear: S.gear, sb: true,
      });
      this.level = 70;
      this.levelKey = 'sb70';
      this.model = 'rdm-sb';
      this.maxMp = S.maxMp;
      const A = Object.assign({}, this.actions);
      for (const k of ['scorch', 'engagement', 'reprise', 'enchantedReprise', 'verthunder2', 'veraero2']) delete A[k];
      set(A, 'jolt2', { potency: S.jolt, mp: 360, desc: `Deals unaspected damage with a potency of ${S.jolt}.\nAdditional Effect: Increases both Black Mana and White Mana by 3\nAdditional Effect: Grants Impactful\nDuration: 30s` });
      set(A, 'verthunder', { potency: S.ver, mp: 480, desc: A.verthunder.desc.replace(/potency of \d+/, `potency of ${S.ver}`) });
      set(A, 'veraero', { potency: S.ver, mp: 480, desc: A.veraero.desc.replace(/potency of \d+/, `potency of ${S.ver}`) });
      set(A, 'verfire', { potency: S.proc, mp: 360 });
      set(A, 'verstone', { potency: S.proc, mp: 360 });
      set(A, 'verflare', { potency: S.flare, mp: 600, desc: A.verflare.desc.replace(/potency of \d+/, `potency of ${S.flare}`) });
      set(A, 'verholy', { potency: S.flare, mp: 600, desc: A.verholy.desc.replace(/potency of \d+/, `potency of ${S.flare}`) });
      set(A, 'impact', { potency: S.impact, cast: 2, mp: 360, black: 4, white: 4, aoe: false, ready: 'impactful', desc: `Deals unaspected damage with a potency of ${S.impact}.\nAdditional Effect: Increases both Black Mana and White Mana by 4\nCan only be executed while under the effect of Impactful.` });
      A.scatter = Object.assign({}, A.jolt2, { name: 'Scatter', potency: 100, cast: 2, mp: 480, black: 3, white: 3, aoe: true, iconOf: undefined,
        desc: 'Deals unaspected damage with a potency of 100 to target and all enemies nearby it.\nAdditional Effect: Increases both Black Mana and White Mana by 3\nAdditional Effect: 30% chance you are granted Enhanced Scatter\nDuration: 10s\nEnhanced Scatter Bonus: Increases Black Mana and White Mana by 10 instead of 3' });
      set(A, 'enchantedRiposte', { potency: S.riposte });
      set(A, 'enchantedMoulinet', { mana: 30, desc: A.enchantedMoulinet.desc.replace('20 Black Mana and 20 White Mana', '30 Black Mana and 30 White Mana') });
      set(A, 'moulinet', { desc: A.moulinet.desc.replace('at 20 or more', 'at 30 or more') });
      set(A, 'enchantedZwerchhau', { comboPotency: S.zwerch });
      set(A, 'enchantedRedoublement', { comboPotency: S.redoub, desc: A.enchantedRedoublement.desc.replace('Verthunder and Veraero become Verflare and Verholy.', 'Allows Verflare and Verholy.') });
      set(A, 'fleche', { potency: S.fleche, desc: `Delivers an attack with a potency of ${S.fleche}.` });
      set(A, 'contreSixte', { potency: S.contre, recast: 45, aoe: 0.5, desc: `Delivers an attack to all nearby enemies with a potency of ${S.contre} for the first enemy, 10% less for the second, 20% less for the third, 30% less for the fourth, 40% less for the fifth, and 50% less for all remaining enemies.` });
      set(A, 'displacement', { potency: S.displacement, cdGroup: undefined, desc: `Delivers an attack with a potency of ${S.displacement}.\nAdditional Effect: 15-yalm backstep\nCannot be executed while bound.` });
      set(A, 'manafication', { recast: 120, desc: 'Doubles current Black Mana and White Mana levels.\nAdditional Effect: Resets Corps-a-corps and Displacement recast timers\nAll combos are canceled upon execution of Manafication.' });
      // Stormblood's caster role actions: Lucid Dreaming was a 120s Refresh (potency 80).
      set(A, 'lucidDreaming', { recast: 120, desc: 'Reduces enmity by half.\nAdditional Effect: Refresh\nPotency: 80\nDuration: 21s' });
      A.tincture = B.tincture(S.tincture);
      this.actions = A;
      this.statuses = Object.assign({}, this.statuses, { impactful: { name: 'Impactful', self: true, icon: 'st_impactful' } });
      this.stats = Object.assign({ mainStat: 'int', jobMod: 115, trait: 130, delay: 3.44 }, S.stats);
      this.selfStatusOrder = ['dualcast', 'verfireReady', 'verstoneReady', 'impactful', 'acceleration', 'embolden', 'swiftcast', 'medicated',
        'lucidDreaming', 'surecast', 'sprint'];
      const gone = (x) => !A[x];
      this.defaultBars = [
        ['jolt2', 'verthunder', 'veraero', 'verfire', 'verstone', 'impact', 'riposte', 'zwerchhau', 'redoublement', 'fleche', 'contreSixte', 'corpsACorps'],
        ['displacement', 'acceleration', 'embolden', 'manafication', 'swiftcast', 'lucidDreaming', 'tincture', 'addle', 'surecast', 'vercure', 'verraise', null],
        ['scatter', 'moulinet', 'sprint', null, null, null, null, null, null, null, null, null],
      ];
      this.actionGroups = this.actionGroups.map(([n, ids]) => [n, ids.filter(x => !gone(x)).concat(n === 'Red Mage' ? ['scatter'] : [])]);
      this.referenceDps = S.ref;
    }

    mpRegen() { return Math.round(this.maxMp * 0.02); }
    lucidGain() { return 960; }

    // No Scorch: Jolt II stays Jolt II after Verflare.
    resolveId(id, e) {
      if (id === 'jolt2') return id;
      if (id === 'moulinet') return this.both(e, 30) ? 'enchantedMoulinet' : id;
      return super.resolveId(id, e);
    }

    // Stormblood's Manafication has no damage bonus.
    snapshot(a, e) {
      const s = super.snapshot(a, e);
      if (a && a.magic && e.has('manafication')) s.mult /= 1.05;
      return s;
    }

    resolve(id, e) {
      if (id === 'impact') e.removeStatus('impactful');
      super.resolve(id, e);
      if (id === 'jolt2') e.addStatus('impactful', 30);
    }

    proc(id, e) {
      if (id === 'impact') return e.has('impactful');
      return super.proc(id, e);
    }

    helpHtml(seq) {
      return `
<h3>How it plays (Stormblood 4.0–4.58)</h3>
<p>Level 70 Red Mage, the debut. Any spell with a cast time grants <b>Dualcast</b>: the next spell is instant. Hardcast <b>Jolt II</b> (${S.jolt}, +3 each, and it grants <b>Impactful</b> for 30s) or a <b>Verfire / Verstone</b> proc (${S.proc}, +9), then Dualcast <b>Verthunder</b> or <b>Veraero</b> (${S.ver}, +11, 50% to proc) for whichever mana is lower. <b>Impact</b> (${S.impact}, +4 each) is the other filler under Impactful. Gains to the lower mana are halved while the other is more than 30 ahead.</p>
<p>At 80|80 or more, the melee combo: <b>Riposte → Zwerchhau → Redoublement</b> turn enchanted with the mana (${S.riposte} / ${S.zwerch} / ${S.redoub}), then <b>Verflare</b> or <b>Verholy</b> (${S.flare}; a sure proc for the lower mana). No Scorch yet. <b>Fleche</b> (${S.fleche}, 25s), <b>Contre Sixte</b> (${S.contre}, 45s), <b>Corps-a-corps</b> and <b>Displacement</b> (130 each) weave between, never between a hardcast and its Dualcast. <b>Embolden</b> (+10% magic, falling 2% every 4s) and <b>Manafication</b> (doubles the mana, resets the gap closers; no damage bonus until 5.0) every two minutes; <b>Acceleration</b> guarantees one proc (10s, 35s).</p>
<h3>An opener for this version</h3>
${seq(['verthunder', 'veraero', ['tincture'], 'verstone', 'veraero', ['fleche'], ['contreSixte'], 'verfire', 'verthunder', ['corpsACorps'], ['embolden'], 'jolt2', ['acceleration'], 'veraero', ['displacement'], 'impact', 'verthunder', ['manafication'], 'riposte', 'zwerchhau', ['corpsACorps'], 'redoublement', ['displacement'], 'veraero', 'jolt2', ['fleche']])}
<p>Procs are random, so the proc GCDs are "the proc you have, or Jolt II / Impact". This follows the version's rules; it isn't copied from a published guide.</p>
<p style="color:#a9a3b4">The 4.4–4.58 numbers: Jolt II ${S.jolt}, Verthunder / Veraero ${S.ver} (300 before 4.4), Verfire / Verstone ${S.proc}, Impact ${S.impact}, Verflare / Verholy ${S.flare} (550 before 4.4), Enchanted Riposte ${S.riposte}, Zwerchhau ${S.zwerch}, Redoublement ${S.redoub}, Fleche ${S.fleche}, Contre Sixte ${S.contre} (300 before 4.4), Corps-a-corps and Displacement 130. Gear: ${S.gear}.</p>`;
    }
  }

  B.registerJob({
    id: 'rdm', name: 'Red Mage', abbr: 'RDM', role: 'caster', classJob: 35,
    versions: [{ id: 'sb40', label: 'Stormblood 4.0–4.58', history: 'SB 4.0–4.58', note: 'Level 70, the debut: Dualcast, Black and White Mana, Impact on Impactful, Verflare and Verholy, Embolden and Manafication; the 4.4 numbers and Alphascape gear', create: () => new RedMageSB() }],
  });
})(window.BLM);
