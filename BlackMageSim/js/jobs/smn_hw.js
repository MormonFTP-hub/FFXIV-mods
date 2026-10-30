// Summoner, Heavensward (patches 3.0–3.57) at level 60: the "DoT Summoner". Three DoTs (Bio, Bio II, Miasma) that
// Tri-disaster puts up at once and Garuda-Egi's Contagion extends by 15s, Fester at 100 per DoT, Aetherflow (20% MP,
// three stacks) into a 15s Dreadwyrm Trance and Deathflare, Rouse and Spur on the egi, Raging Strikes from Archer, and
// Enhanced Pet Actions (a pet crit can give you +20% spell speed for 8s). No Demi-Bahamut, Ruin IV or Lucid Dreaming
// yet. Built on the Stormblood class (smn_sb.js) for the pets and gauge. Heavensward's formula (hw60) with magic
// damage and Intelligence in place of weapon damage and Strength, ×1.30 for Maim and Mend II. Numbers are the 3.5x
// tooltips (Gamer Escape's and the FFXIV wiki's pre-4.0 revisions); 3.2 raised Ruin III to 200 and 3.3 the egis'
// attacks. MP uses Heavensward's level-60 costs.
(function (B) {
  const SB = B.SummonerSB;
  const DOTS = ['bio', 'bio2', 'miasma'];

  class SummonerHW extends SB {
    constructor() {
      super();
      this.level = 60;
      this.levelKey = 'hw60';
      this.model = 'smn-hw';
      this.maxMp = 10000;
      const S = B.SMN_SB.ACTIONS;
      const A = {};
      const keep = ['ruin3', 'ruin2', 'fester', 'painflare', 'energyDrain', 'bane', 'aetherflow', 'dreadwyrmTrance', 'deathflare', 'rouse',
        'enkindle', 'contagion', 'physick', 'summon', 'summon3', 'swiftcast', 'surecast', 'sprint', 'windBlade', 'aerialSlash', 'aerialBlast',
        'burningStrike', 'crimsonCyclone', 'flamingCrush', 'inferno'];
      for (const k of keep) A[k] = Object.assign({}, S[k]);
      const set = (id, o) => { A[id] = Object.assign({}, A[id], o); };
      const spell = (o) => Object.assign({ kind: 'gcd', target: true, range: 25, delay: 0.8, school: 'aether', sound: 'ruin' }, o);
      set('ruin3', { potency: 200, mp: 1061, desc: 'Deals unaspected damage with a potency of 200.\nDreadwyrm Trance Bonus: Reduces MP cost.' });
      set('ruin2', { potency: 80, mp: 354, desc: 'Deals unaspected damage with a potency of 80.\nAdditional Effect: Blind\nDuration: 10s' });
      A.ruin = spell({ name: 'Ruin', potency: 80, cast: 2.5, mp: 177, ruin: true, orb: true, desc: 'Deals unaspected damage with a potency of 80.' });
      A.bio = spell({ name: 'Bio', potency: 0, mp: 354, dot: { potency: 40, duration: 18 }, sound: 'dot', desc: 'Deals unaspected damage over time.\nPotency: 40\nDuration: 18s' });
      A.bio2 = spell({ name: 'Bio II', potency: 0, cast: 2.5, mp: 530, dot: { potency: 35, duration: 30 }, sound: 'dot', desc: 'Deals unaspected damage over time.\nPotency: 35\nDuration: 30s' });
      A.miasma = spell({ name: 'Miasma', potency: 20, cast: 2.5, mp: 442, dot: { potency: 35, duration: 24 }, desc: 'Deals unaspected damage with a potency of 20.\nAdditional Effect: Unaspected damage over time\nPotency: 35\nDuration: 24s\nAdditional Effect: Reduces HP recovery via healing magic by 10%' });
      A.triDisaster = { name: 'Tri-disaster', kind: 'ogcd', recast: 60, target: true, range: 25, desc: 'Inflicts target with Bio, Bio II and Miasma.' };
      set('fester', { recast: 10, perDot: 100, desc: 'Deals unaspected damage with a potency of 100 for each of your Bio, Bio II and Miasma effects on the target (300 with all three).\nAetherflow Gauge Cost: 1' });
      set('painflare', { recast: 10, potency: 200, desc: 'Deals unaspected damage with a potency of 200 to target and all enemies nearby it.\nAetherflow Gauge Cost: 1' });
      set('bane', { desc: 'Spreads a target\'s Bio, Bio II and Miasma effects to nearby enemies, with their remaining duration.\nAetherflow Gauge Cost: 1' });
      set('aetherflow', { desc: 'Restores 20% of maximum MP.\nAdditional Effect: Aetherflow III' });
      set('dreadwyrmTrance', { recast: 30, desc: 'Increases magic damage dealt by 10% while reducing the MP cost of Ruin III.\nDuration: 15s\nCan only be executed while in possession of 3 stacks of Aethertrail Attunement.' });
      set('deathflare', { recast: 30 });
      set('rouse', { recast: 60, desc: 'Increases damage and healing dealt by pet by 40% (Enhanced Rouse: 60s recast).\nDuration: 20s' });
      A.spur = { name: 'Spur', kind: 'ogcd', recast: 120, desc: 'Increases the attack power of your pet by 40%.\nDuration: 20s' };
      set('contagion', { desc: 'Orders Garuda-Egi to use Contagion: extends the duration of your Bio, Bio II and Miasma on the target by 15s.' });
      set('summon', { cast: 6, mp: 1768 });
      set('summon3', { cast: 6, mp: 1768 });
      set('physick', { mp: 530 });
      A.ragingStrikes = { name: 'Raging Strikes', kind: 'ogcd', recast: 180, role: true, desc: 'Increases damage dealt by 20%.\nDuration: 20s' };
      A.tincture = Object.assign({}, B.tincture('int'), { name: 'Supramax-Potion of Intelligence', dur: 15, desc: 'This diluted brew temporarily increases intelligence.\nIntelligence +20% (Max 154)\nDuration: 15s' });
      this.actions = A;
      this.statuses = Object.assign({}, this.statuses, {
        bio: { name: 'Bio', self: false, icon: 'st_bio' },
        bio2: { name: 'Bio II', self: false, icon: 'st_bio' },
        miasma: { name: 'Miasma', self: false, icon: 'st_miasma' },
        spur: { name: 'Spur', self: true, icon: 'st_spur' },
        ragingStrikes: { name: 'Raging Strikes', self: true, icon: 'st_raging' },
        petSpeed: { name: 'Enhanced Pet Actions', self: true, icon: 'st_speed' },
      });
      // A rough 3.5 Alexander Savage set (item level ~270, the Alexandrian Metal Grimoire: 115 magic damage, 3.12
      // delay), Heavensward-era stats. Maim and Mend II: +30%. No Direct Hit before 4.0.
      this.stats = { hp: 26000, main: 1570, mainStat: 'int', jobMod: 115, trait: 130, wd: 115, det: 746, crit: 900,
        dh: 354, speed: 836, delay: 3.12 };
      this.cfg = Object.assign({}, this.cfg, { trance: 15, instantRuin3: false, petProc: 0, devotion: 1 });
      this.selfStatusOrder = ['dreadwyrmTrance', 'ragingStrikes', 'rouse', 'spur', 'petSpeed', 'swiftcast', 'medicated', 'surecast', 'sprint'];
      this.targetStatusOrder = ['bio', 'bio2', 'miasma'];
      this.defaultBars = [
        ['ruin3', 'ruin2', 'bio', 'bio2', 'miasma', 'triDisaster', 'fester', 'energyDrain', 'aetherflow', 'dreadwyrmTrance', 'deathflare', 'contagion'],
        ['rouse', 'spur', 'enkindle', 'ragingStrikes', 'swiftcast', 'tincture', 'ruin', 'physick', 'summon', 'summon3', 'surecast', 'sprint'],
        ['painflare', 'bane', null, null, null, null, null, null, null, null, null, null],
      ];
      this.actionGroups = [
        ['Summoner', ['ruin', 'ruin2', 'ruin3', 'bio', 'bio2', 'miasma', 'triDisaster', 'aetherflow', 'energyDrain', 'fester', 'painflare', 'bane',
          'dreadwyrmTrance', 'deathflare', 'rouse', 'spur', 'enkindle', 'contagion', 'physick', 'summon', 'summon3']],
        ['Cross-class', ['ragingStrikes', 'swiftcast', 'surecast']],
        ['General', ['sprint', 'tincture']],
      ];
      this.referenceDps = 2420;     // a scripted 3.5 rotation parses about 2,280 (MP-limited: Ruin III mostly in Trance)
      this.referenceGcd = 2.31;
    }

    resolveId(id) { return id; }

    check(id, e) {
      const a = this.actions[id], g = e.g;
      if (a.flow && g.flow < 1) return 'Unable to execute action. Aetherflow required.';
      if (id === 'aetherflow' && e.has('dreadwyrmTrance')) return 'Unable to execute action while under the effect of Dreadwyrm Trance.';
      if (id === 'dreadwyrmTrance' && g.trail < 3) return 'Unable to execute action. Aethertrail Attunement required.';
      if (id === 'deathflare' && !e.has('dreadwyrmTrance')) return 'Unable to execute action. Dreadwyrm Trance required.';
      if (id === 'contagion' && g.egi !== 'garuda') return 'Unable to execute action. Garuda-Egi required.';
      if ((id === 'enkindle' || id === 'rouse' || id === 'spur') && !g.egi) return 'Unable to execute action. Pet required.';
      return null;
    }

    // Enhanced Pet Actions: +20% spell speed.
    castTime(id, e) {
      const a = this.actions[id];
      if (!a.cast || e.has('swiftcast')) return 0;
      return e.speedScale(a.cast, e.has('petSpeed') ? 20 : 0);
    }
    haste(e) { return e.has('petSpeed') ? 20 : 0; }

    mpCost(id, e) {
      const a = this.actions[id];
      if (id === 'ruin3' && e.has('dreadwyrmTrance')) return Math.round(a.mp / 2);
      return a.mp || 0;
    }
    mpRegen() { return Math.round(this.maxMp * 0.02); }
    lucidGain() { return 0; }

    snapshot(a, e) {
      let mult = 1;
      const pet = !!(a && a.pet);
      if (!pet) {
        if (e.has('dreadwyrmTrance')) mult *= 1.10;
        if (e.has('ragingStrikes')) mult *= 1.20;
      } else {
        if (e.has('rouse')) mult *= 1.40;
        if (e.has('spur')) mult *= 1.40;
      }
      const main = this.stats.main + (e.has('medicated') ? (this.potionCap || 154) : 0);
      return { mult, main };
    }

    spell(id, e) {
      const a = this.actions[id];
      if (DOTS.includes(id)) {
        e.mp = Math.max(0, e.mp - this.mpCost(id, e));
        if (id === 'bio') { this.applyDot(e, 'bio'); return; }
        if (id === 'bio2') { this.applyDot(e, 'bio2'); return; }
        e.queueHit(id, a.potency, this.snapshot(a, e), a.delay, () => this.applyDot(e, 'miasma'));
        return;
      }
      super.spell(id, e);
    }

    ability(id, e) {
      const g = e.g;
      switch (id) {
        case 'triDisaster': for (const k of DOTS) this.applyDot(e, k); return;
        case 'fester': {
          this.spendFlow(e);
          const n = DOTS.filter(k => e.tHas(k)).length;
          if (n) e.queueHit(id, 100 * n, this.snapshot(this.actions.fester, e), this.actions.fester.delay);
          return;
        }
        case 'aetherflow': {
          g.flow = 3 - g.trail;
          const before = e.mp;
          e.mp = Math.min(e.maxMp, e.mp + Math.round(e.maxMp * 0.2));
          e.emit('mpGain', { amount: e.mp - before, source: 'manafont' });
          return;
        }
        case 'bane':
          this.spendFlow(e);
          for (const k of DOTS) {
            const st = e.tStatuses[k];
            if (st && st.until > e.now && e.targets > 1) { st.targets = e.targets; st.aoe = [1, 1, 1, 1, 0.5]; }
          }
          return;
        case 'dreadwyrmTrance':
          g.trail = 0; g.trance = true;
          e.addStatus('dreadwyrmTrance', this.cfg.trance);
          return;
        case 'contagion':
          // Garuda-Egi stretches your DoTs on the dummy by 15s.
          for (const k of DOTS) if (e.tHas(k)) e.tStatuses[k].until += 15;
          e.emit('petUse', { id: 'contagion' });
          return;
        case 'spur': e.addStatus('spur', 20); return;
        case 'ragingStrikes': e.addStatus('ragingStrikes', 20); return;
      }
      super.ability(id, e);
    }

    spendFlow(e) {
      const g = e.g;
      g.flow--;
      g.trail = Math.min(3, g.trail + 1);
    }

    // A pet hit that crits: 20% chance of Enhanced Pet Actions (+20% spell speed, 8s).
    petAct(e, id) {
      const a = this.actions[id];
      e.emit('petUse', { id });
      const snap = this.snapshot(a, e);
      const after = a.dot ? () => e.addTStatus(id, a.dot.duration, { snap, dot: { potency: a.dot.potency, id } }) : null;
      e.queueHit(id, a.potency, snap, a.delay, after, { onResult: (r) => { if (r.crit && Math.random() < 0.2) e.addStatus('petSpeed', 8); } });
    }

    // Trance ends without Dreadwyrm Aether (that came with Bahamut in 4.0).
    process(e) {
      const g = e.g;
      if (g.trance && !e.has('dreadwyrmTrance')) g.trance = false;
      g.aether = 0;
      super.process(e);
    }

    proc(id, e) {
      const g = e.g;
      if (id === 'dreadwyrmTrance') return g.trail >= 3;
      if (id === 'deathflare') return e.has('dreadwyrmTrance');
      if (id === 'fester') return g.flow > 0 && DOTS.every(k => e.tHas(k));
      return false;
    }

    speedInfo(e) { return `GCD ${e.gcdForSpeed(e.stats.speed).toFixed(2)} · Ruin III ${e.speedScale(2.5).toFixed(2)}s cast · Heavensward's formula`; }

    helpHtml(seq) {
      return `
<h3>How it plays (Heavensward 3.0–3.57)</h3>
<p>Level 60 Summoner, built around DoTs. Keep <b>Bio</b> (40 a tick, 18s, instant), <b>Bio II</b> (35 a tick, 30s) and <b>Miasma</b> (20 + 35 a tick, 24s) on the dummy; <b>Tri-disaster</b> (60s) puts all three up at once, so use it inside your buffs, then have Garuda-Egi stretch them 15s with <b>Contagion</b>. <b>Fester</b> is 100 per DoT (300 with all three).</p>
<p><b>Aetherflow</b> (60s) gives 20% MP and three stacks for Fester or Energy Drain, each one a step of Aethertrail; with three, <b>Dreadwyrm Trance</b> is 15s of +10% magic damage and cheaper <b>Ruin III</b> (200), ending with <b>Deathflare</b> (400). Ruin III costs a lot of MP outside Trance; Ruin II (80, instant) is for moving and weaving. <b>Rouse</b> and <b>Spur</b> (+40% each) go on Garuda-Egi with <b>Enkindle</b> (Aerial Blast, 250), and <b>Raging Strikes</b> (+20%, from Archer) with Trance and Tri-disaster. A critical hit from your egi can give +20% spell speed for 8s.</p>
<h3>An opener for this version</h3>
${seq(['ruin3', ['triDisaster'], ['ragingStrikes'], 'ruin2', ['fester'], ['rouse'], 'ruin3', ['spur'], ['contagion'], 'ruin2', ['fester'], ['enkindle'], 'ruin2', ['fester'], ['dreadwyrmTrance'], 'ruin3', 'ruin3', 'ruin3', 'ruin3', 'ruin3', ['deathflare'], 'bio2'])}
<p>Garuda-Egi summoned and Aetherflow used before the pull. This follows the version's rules; it isn't copied from a published guide.</p>
<p style="color:#a9a3b4">The 3.5 numbers: Ruin 80, Ruin II 80, Ruin III 200 (3.2), Bio 40 × 18s, Bio II 35 × 30s, Miasma 20 + 35 × 24s, Fester 100 per DoT, Energy Drain 150, Painflare 200, Deathflare 400, Wind Blade 110, Aerial Blast 250. Max MP (10,000) is extrapolated, Ruin III's Trance discount and Raging Strikes' value are approximate, and how pets scaled in Heavensward isn't documented (here they use your stats). Heavensward's formula is the community fit; gear approximate.</p>`;
    }
  }

  B.SummonerHW = SummonerHW;
  B.registerJob({
    id: 'smn', name: 'Summoner', abbr: 'SMN', role: 'caster', classJob: 27,
    versions: [{ id: 'hw30', label: 'Heavensward 3.0–3.57', history: 'HW 3.0–3.57', note: 'Level 60. Bio, Bio II and Miasma with Tri-disaster and Contagion, Fester, a 15s Dreadwyrm Trance and Deathflare, Rouse and Spur, Raging Strikes, with Heavensward\'s formula', create: () => new SummonerHW() }],
  });
})(window.BLM);
