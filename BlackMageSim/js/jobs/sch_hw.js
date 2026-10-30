// Scholar, Heavensward (patches 3.0–3.57) at level 60: "Scholar's golden age". Built on the Stormblood class (sch_sb.js)
// with what Heavensward had instead: Broil (170) and Ruin (80, both 2.5s), Bio (instant, 40 × 18s), Bio II (a 2.5s
// cast, 35 × 30s), Miasma (20 + 35 × 24s), Miasma II, Shadow Flare as a 3s cast (25 × 30s on the ground), Energy
// Drain on Aetherflow (60s, 20% of your MP), Bane, Dissipation (180s; you summon the faerie back yourself), Selene's
// Fey Wind, and Cleric Stance as a toggle that swaps your Mind into Intelligence (+10%, −20% healing). No Faerie
// Gauge, Chain Stratagem or Quickened Aetherflow (all 4.0). The faerie doesn't attack. Numbers are the 3.5x tooltips
// and job pages the FFXIV wiki and Gamer Escape had before 4.0, and the Lodestone notes. Heavensward's formula (hw60).
(function (B) {
  const SB = B.ScholarSB;
  const FALLOFF = [1, 0.8, 0.6, 0.4, 0.2];
  const spell = (o) => Object.assign({ kind: 'gcd', target: true, range: 25, delay: 0.8, school: 'aether', sound: 'ruin' }, o);
  const heal = (o) => Object.assign({ kind: 'gcd', potency: 0, school: 'aether', sound: 'paradox' }, o);
  const ab = (o) => Object.assign({ kind: 'ogcd' }, o);

  class ScholarHW extends SB {
    constructor() {
      super('sb405');
      this.V = { label: 'Heavensward 3.0–3.57' };
      this.level = 60;
      this.levelKey = 'hw60';
      this.model = 'sch-hw';
      // MP costs are shares of level 60's 8,840 (Gamer Escape's MP Base). The pool is fitted to archived 2016 Lodestone
      // profiles, floor(1.20 × (8,840 + 5.389 × (Piety − 218))), at 775 Piety (Scholar's 1.20 is the healers' value).
      this.maxMp = 14210;
      const S = this.actions;
      this.actions = {
        broil: spell({ name: 'Broil', potency: 170, cast: 2.5, mp: 530, orb: true, desc: 'Deals unaspected damage with a potency of 170.' }),
        ruin: spell({ name: 'Ruin', potency: 80, cast: 2.5, mp: 177, orb: true, desc: 'Deals unaspected damage with a potency of 80.' }),
        ruin2: spell({ name: 'Ruin II', potency: 80, mp: 354, orb: true, desc: 'Deals unaspected damage with a potency of 80.\nAdditional Effect: Blind\nDuration: 10s' }),
        bio: spell({ name: 'Bio', potency: 0, mp: 354, dot: { potency: 40, duration: 18 }, sound: 'dot', desc: 'Deals unaspected damage over time.\nPotency: 40\nDuration: 18s' }),
        bio2: spell({ name: 'Bio II', potency: 0, cast: 2.5, mp: 530, dot: { potency: 35, duration: 30 }, sound: 'dot', desc: 'Deals unaspected damage over time.\nPotency: 35\nDuration: 30s' }),
        miasma: spell({ name: 'Miasma', potency: 20, cast: 2.5, mp: 442, dot: { potency: 35, duration: 24 }, desc: 'Deals unaspected damage with a potency of 20.\nAdditional Effect: Unaspected damage over time\nPotency: 35\nDuration: 24s\nAdditional Effect: Heavy +40%' }),
        miasma2: spell({ name: 'Miasma II', potency: 20, mp: 619, target: false, pbaoe: 5, aoe: true, dot: { potency: 10, duration: 15, aoe: true }, desc: 'Deals unaspected damage with a potency of 20 to all nearby enemies.\nAdditional Effect: Unaspected damage over time\nPotency: 10\nDuration: 15s' }),
        shadowFlare: spell({ name: 'Shadow Flare', potency: 0, cast: 3, mp: 707, dot: { potency: 25, duration: 30, aoe: true }, desc: 'Creates a patch of dark miasma on the ground, dealing unaspected damage with a potency of 25 to any enemies who enter.\nDuration: 30s\nAdditional Effect: Slow +5%\nCannot be used alongside Sacred Soil.' }),
        aero: spell({ name: 'Aero', potency: 50, mp: 354, dot: { potency: 25, duration: 18 }, school: 'wind', sound: 'wind', desc: 'Deals wind damage with a potency of 50.\nAdditional Effect: Wind damage over time\nPotency: 25\nDuration: 18s\n(Conjurer cross-class skill)' }),
        energyDrain: ab({ name: 'Energy Drain', recast: 3, potency: 150, flow: true, target: true, range: 25, delay: 0.6, school: 'aether', sound: 'xeno', desc: 'Deals unaspected damage with a potency of 150.\nAdditional Effect: Absorbs a portion of damage dealt as HP and restores MP\nAetherflow Cost: 1' }),
        bane: Object.assign({}, S.bane, { desc: 'Spreads a target\'s Bio, Bio II and Miasma effects to nearby enemies, with potency reduced by 20% for the second enemy, 40% for the third, 60% for the fourth and 80% for the rest.\nAetherflow Cost: 1' }),
        aetherflow: ab({ name: 'Aetherflow', recast: 60, desc: 'Restores 20% of maximum MP.\nAdditional Effect: Aetherflow III (three stacks)' }),
        dissipation: ab({ name: 'Dissipation', recast: 180, desc: 'Dismisses your faerie, granting you Aetherflow III and increasing healing magic potency by 20%.\nDuration: 30s\nCannot summon your faerie while under the effect of Dissipation; it doesn\'t come back on its own.' }),
        rouse: ab({ name: 'Rouse', recast: 60, desc: 'Increases the healing and damage of your faerie by 40%.\nDuration: 20s' }),
        eyeForAnEye: ab({ name: 'Eye for an Eye', recast: 120, desc: 'Grants a chance to reduce damage taken by a party member by 10% when attacked.\nDuration: 30s' }),
        virus: ab({ name: 'Virus', recast: 90, target: true, range: 25, desc: 'Reduces target\'s strength, dexterity, intelligence and mind by 15% (Supervirus).\nDuration: 10s' }),
        physick: heal({ name: 'Physick', cast: 2, mp: 530, desc: 'Restores target\'s HP.\nCure Potency: 400' }),
        adloquium: heal({ name: 'Adloquium', cast: 2, mp: 1061, desc: 'Restores target\'s HP.\nCure Potency: 300\nAdditional Effect: Erects a magicked barrier which nullifies damage equaling the amount of HP restored.' }),
        succor: heal({ name: 'Succor', cast: 2.5, mp: 1326, desc: 'Restores own HP and the HP of all party members within a radius of 15 yalms.\nCure Potency: 150\nAdditional Effect: Erects a magicked barrier which nullifies damage equaling the amount of HP restored.' }),
        leeches: heal({ name: 'Leeches', cast: 1, mp: 619, desc: 'Removes a single detrimental effect from target.' }),
        lustrate: ab({ name: 'Lustrate', recast: 1, flow: true, desc: 'Restores target\'s HP.\nCure Potency: 600\nAetherflow Cost: 1' }),
        indomitability: ab({ name: 'Indomitability', recast: 30, flow: true, desc: 'Restores own HP and the HP of all party members within a radius of 15 yalms.\nCure Potency: 400\nAetherflow Cost: 1' }),
        sacredSoil: Object.assign({}, S.sacredSoil, { desc: 'Creates a designated area in which party members will only suffer 90% of all damage inflicted.\nDuration: 15s\nAetherflow Cost: 1' }),
        deploymentTactics: S.deploymentTactics,
        emergencyTactics: S.emergencyTactics,
        summon: Object.assign({}, S.summon, { cast: 6, mp: 1768 }),
        summon2: Object.assign({}, S.summon2, { cast: 6, mp: 1768, desc: 'Summons Selene, a faerie healer. Selene keeps Fey Wind up: 3% faster casts and GCD for you and nearby party members (30s, every 60s).' }),
        whisperingDawn: ab({ name: 'Whispering Dawn', recast: 60, desc: 'Orders Eos to gradually restore the HP of party members nearby.\nCure Potency: 100\nDuration: 21s' }),
        feyCovenant: S.feyCovenant,
        feyIllumination: ab({ name: 'Fey Illumination', recast: 120, desc: 'Orders Eos to increase healing magic potency of nearby party members by 20%.\nDuration: 20s' }),
        silentDusk: S.silentDusk,
        feyCaress: S.feyCaress,
        // Conjurer and Thaumaturge cross-class skills.
        clericStance: ab({ name: 'Cleric Stance', recast: 5, role: true, desc: 'Swaps your Mind and Intelligence, increases attack magic potency by 10% and reduces healing magic potency by 20%.\nEffect ends upon reuse.' }),
        swiftcast: S.swiftcast,
        surecast: Object.assign({}, S.surecast, { desc: 'The next spell is cast without interruption.\nDuration: 10s' }),
        // Spells in the game (cast before the pull); here they do nothing, so they're left as instant buttons.
        protect: ab({ name: 'Protect', recast: 2.5, role: true, type: 'Spell', desc: 'Increases the physical and magic defense of nearby party members.\nDuration: 30m' }),
        stoneskin: ab({ name: 'Stoneskin', recast: 2.5, role: true, type: 'Spell', desc: 'Creates a barrier that nullifies damage up to 10% of maximum HP.\nDuration: 30m' }),
        ...B.GENERAL_ACTIONS,
        tincture: Object.assign({}, B.tincture('mnd3sb'), { name: 'Supramax-Potion of Mind', dur: 15, desc: 'This diluted brew temporarily increases mind.\nMind +20% (Max 154)\nDuration: 15s' }),
      };
      this.statuses = Object.assign({}, this.statuses, {
        bio: { name: 'Bio', self: false, icon: 'st_bio' },
        aero: { name: 'Aero', self: false, icon: 'st_aero' },
        rouse: { name: 'Rouse', self: true, icon: 'st_rouse' },
        swiftcast: { name: 'Swiftcast', self: true, icon: 'st_swiftcast' },
      });
      // A rough 3.5 set (item level ~270 healer gear, the Alexandrian Metal Codex), Heavensward-era stats. main is Mind,
      // which Cleric Stance makes your Intelligence; without it you'd hit with about 250. Maim and Mend II: +30%.
      this.stats = { hp: 23500, mainStat: 'mnd', main: 1590, int: 250, jobMod: 115, trait: 130, wd: 115, det: 700, crit: 620,
        dh: 354, speed: 710, piety: 775, delay: 3.12 };
      this.selfStatusOrder = ['clericStance', 'feyWind', 'swiftcast', 'dissipation', 'rouse', 'medicated', 'emergencyTactics', 'surecast', 'sprint'];
      this.targetStatusOrder = ['bio2', 'bio', 'miasma', 'aero', 'miasma2', 'shadowFlare'];
      this.defaultBars = [
        ['broil', 'bio', 'bio2', 'miasma', 'ruin2', 'energyDrain', 'aetherflow', 'shadowFlare', 'clericStance', 'swiftcast', 'tincture', 'aero'],
        ['miasma2', 'bane', 'dissipation', 'summon2', 'summon', 'physick', 'adloquium', 'succor', 'lustrate', 'indomitability', 'sacredSoil', 'ruin'],
        ['deploymentTactics', 'emergencyTactics', 'whisperingDawn', 'feyCovenant', 'feyIllumination', 'silentDusk', 'feyCaress', 'rouse', 'eyeForAnEye', 'virus', 'surecast', 'sprint'],
      ];
      this.actionGroups = [
        ['Scholar', ['broil', 'ruin', 'ruin2', 'bio', 'bio2', 'miasma', 'miasma2', 'shadowFlare', 'energyDrain', 'bane', 'aetherflow', 'dissipation',
          'rouse', 'eyeForAnEye', 'virus', 'physick', 'adloquium', 'succor', 'leeches', 'lustrate', 'indomitability', 'sacredSoil',
          'deploymentTactics', 'emergencyTactics', 'summon', 'summon2']],
        ['Faerie', ['whisperingDawn', 'feyCovenant', 'feyIllumination', 'silentDusk', 'feyCaress']],
        ['Cross-class', ['clericStance', 'swiftcast', 'surecast', 'aero', 'protect', 'stoneskin']],
        ['General', ['sprint', 'tincture']],
      ];
      this.referenceDps = 1610;     // a scripted 3.5 rotation parses about 1,520 over 5 minutes
      this.referenceGcd = 2.32;
    }

    snapshot(a, e) {
      let mult = 1;
      if (e.has('clericStance')) mult *= 1.10;
      const mind = this.stats.main + (e.has('medicated') ? (this.potionCap || 154) : 0);
      return { mult, main: e.has('clericStance') ? mind : this.stats.int, critAdd: 0 };
    }

    spell(id, e) {
      const a = this.actions[id], g = e.g;
      e.mp -= this.mpCost(id);
      if (a.faerie) {
        g.faerie = a.faerie;
        e.pet = { kind: a.faerie };
        g.windNext = e.now + 1;
        return;
      }
      // DoTs with no initial hit go on at once; Miasma and Aero's land with their hit; Miasma II only if the dummy's in reach.
      if (a.dot && !a.potency && !a.pbaoe) { this.applyDot(e, id); return; }
      const inReach = !a.pbaoe || e.distToTarget() - B.DUMMY_RADIUS <= a.pbaoe;
      const after = a.dot && inReach ? () => this.applyDot(e, id) : null;
      if (a.potency) e.queueHit(id, a.potency, this.snapshot(a, e), a.delay, after);
    }

    // No Quickened Aetherflow before 4.0.
    spendFlow(e) { e.g.flow--; }

    ability(id, e) {
      const a = this.actions[id], g = e.g;
      switch (id) {
        case 'aetherflow': {
          g.flow = 3;
          const before = e.mp;
          e.mp = Math.min(e.maxMp, e.mp + Math.round(e.maxMp * 0.2));
          e.emit('mpGain', { amount: e.mp - before, source: 'manafont' });
          return;
        }
        case 'energyDrain': {
          this.spendFlow(e);
          // The tooltip gives no number: ARR's 266 at level 50 (with Energy Siphon) scaled to level 60 is about 884.
          const before = e.mp;
          e.mp = Math.min(e.maxMp, e.mp + (this.edMp || 884));
          if (e.mp > before) e.emit('mpGain', { amount: e.mp - before, source: 'lucid' });
          e.queueHit(id, a.potency, this.snapshot(a, e), a.delay);
          return;
        }
        case 'bane':
          this.spendFlow(e);
          for (const k of ['bio', 'bio2', 'miasma']) {
            const st = e.tStatuses[k];
            if (st && st.until > e.now && e.targets > 1) { st.targets = e.targets; st.aoe = FALLOFF; }
          }
          return;
        case 'clericStance':
          if (e.has('clericStance')) e.removeStatus('clericStance');
          else e.addStatus('clericStance', 1e9, { permanent: true });
          return;
        case 'rouse': e.addStatus('rouse', 20); return;
        case 'eyeForAnEye': case 'virus': case 'protect': case 'stoneskin': return;
      }
      super.ability(id, e);
    }

    speedInfo(e) { return `GCD ${e.gcdForSpeed(e.stats.speed).toFixed(2)} · ${e.gcdForSpeed(e.stats.speed, 3).toFixed(2)} with Fey Wind · ${e.maxMp.toLocaleString()} MP · Heavensward's formula (no Direct Hit)`; }

    // Heavensward had no job gauge; this keeps the Aetherflow stacks and the faerie line, without the Faerie Gauge.
    gaugeBuild(root) {
      super.gaugeBuild(root);
      for (const el of root.querySelectorAll('#sc-feyn, #sc-fey')) el.remove();
      for (const t of root.querySelectorAll('text')) if (t.textContent === 'FAERIE GAUGE') t.remove();
      const bar = root.querySelector('rect[x="170"][y="58"]');
      if (bar) bar.remove();
    }

    helpHtml(seq) {
      return `
<h3>How it plays (Heavensward 3.0–3.57)</h3>
<p>Level 60 Scholar on a dummy. Healer gear had no Intelligence, so damage needs <b>Cleric Stance</b>: a toggle that swaps your Mind into Intelligence (+10% attack magic, −20% healing). Keep three DoTs up, <b>Bio</b> (instant, 40 × 18s), <b>Bio II</b> (2.5s cast, 35 × 30s) and <b>Miasma</b> (2.5s, 20 + 35 × 24s), plus <b>Shadow Flare</b> (a 3s cast, 25 a tick for 30s on the ground), and fill with <b>Broil</b> (170, 2.5s). <b>Ruin II</b> (80) is instant, for moving and for weaving.</p>
<p><b>Aetherflow</b> (60s) gives three stacks and 20% of your MP back; spend them on <b>Energy Drain</b> (150 each, and MP). <b>Dissipation</b> (180s) gives three more but sends the faerie away; summon it back yourself afterwards (6s, 1,768 MP). Selene (Summon II) keeps <b>Fey Wind</b> on you, 3% faster casts. The faerie doesn't attack. <b>Aero</b> is a cross-class DoT worth keeping up too.</p>
<h3>An opener for this version</h3>
${seq([['clericStance'], 'bio2', 'miasma', ['tincture'], 'bio', 'aero', 'shadowFlare', 'ruin2', ['energyDrain'], ['energyDrain'], 'broil', 'ruin2', ['energyDrain'], ['aetherflow'], 'broil', 'broil'])}
<p>Summon Selene before the pull (not under Cleric Stance; the faerie keeps your stats from when she was summoned), then turn on Cleric Stance. Spend Aetherflow before pressing it again, and Dissipation for three more Energy Drains when you can resummon. Based on the wiki's 2017 Scholar page.</p>
<p style="color:#a9a3b4">The 3.5 numbers: Broil 170, Ruin 80, Ruin II 80, Bio 40 × 18s, Bio II 35 × 30s, Miasma 20 + 35 × 24s, Miasma II 20 + 10 × 15s, Shadow Flare 25 × 30s, Energy Drain 150, Aero 50 + 25 × 18s, Cleric Stance +10%, Maim and Mend II +30%, Fey Wind 3%. Heavensward's damage formula is the community fit (Dervy, 2015–16); gear is approximate (item level ~270). The MP pool (14,210) is fitted to archived 2016 character profiles; how much MP Energy Drain gave isn't documented (about 884 here, ARR's value scaled).</p>`;
    }
  }

  B.ScholarHW = ScholarHW;
  B.registerJob({
    id: 'sch', name: 'Scholar', abbr: 'SCH', role: 'healer', classJob: 28,
    versions: [{ id: 'hw30', label: 'Heavensward 3.0–3.57', history: 'HW 3.0–3.57', note: 'Level 60. Cleric Stance swaps Mind into Intelligence; Broil, Bio, Bio II, Miasma and Shadow Flare, Energy Drain on Aetherflow (20% MP), Dissipation, Selene\'s Fey Wind, with Heavensward\'s damage formula', create: () => new ScholarHW() }],
  });
})(window.BLM);
