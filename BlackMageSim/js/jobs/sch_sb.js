// Scholar, Stormblood (4.0–4.58) at level 70, in four versions. The damage kit didn't change across Stormblood:
// Broil II, Bio II and Miasma (Miasma II for AoE), Energy Drain on Aetherflow (each Aetherflow action takes 5s off
// Aetherflow's recast: Quickened Aetherflow), Chain Stratagem (+15% crit taken), Shadow Flare, Cleric Stance. The
// faerie deals no damage; Selene's Fey Wind is 3% haste. Dissipation trades the faerie for three Aetherflow stacks,
// and in Stormblood you resummon it yourself. What the versions change is the healing side:
//  - 4.0–4.01: no Miasma II (back in 4.05); Quickened Aetherflow is a 20% chance per Aetherflow action of taking 10s
//    off (so Aetherflow every ~54s); Summon a 6s cast; Excogitation 650 / 30s on a 60s recast, Indomitability 400,
//    Emergency Tactics 30s. Numbers from 2017's job guide (Wayback) and the 4.05 / 4.1 patch notes; Summon's MP is a
//    guess (2,400, the Heavensward value). ref: scaled from the 4.05 bot by the slower Aetherflow (no bot of its own).
//  - 4.05–4.18: Excogitation doesn't heal when it runs out; Aetherpact 5s; Whispering Dawn a 2s cast (100).
//  - 4.2–4.25: Excogitation also heals when it expires.
//  - 4.3–4.58: Whispering Dawn instant (120), Aetherpact 3s, Dissolve Union 1s.
// Numbers are the game data at 4.11, 4.2, 4.25, 4.38 and 4.58 (xivapi's datamining; none before 4.11) and the
// Lodestone patch notes. The tincture is the one of the time: the ungraded Infusion (max 137) to 4.18, Grade 2 (165)
// in 4.2–4.25, Grade 3 (225) from 4.3.
(function (B) {
  const EPS = 1e-6;
  const FALLOFF = [1, 0.8, 0.6, 0.4, 0.2];
  // Stormblood MP at level 70: 119% (Scholar's modifier) of 12,000 plus 6,000 × (Piety − 292) / 2,170.
  const maxMpFor = (piety) => Math.floor(1.19 * (6000 * (piety - 292) / 2170 + 12000));
  const GEAR = {
    i340: { hp: 25500, main: 2500, wd: 134, det: 1150, crit: 1900, dh: 1250, speed: 650, piety: 900 },
    i370: { hp: 28000, main: 2900, wd: 140, det: 1300, crit: 2200, dh: 1450, speed: 750, piety: 1000 },
    i400: { hp: 30500, main: 3300, wd: 146, det: 1500, crit: 2500, dh: 1650, speed: 850, piety: 1100 },
  };
  // ref: a scripted bot parses about 2,650 / 3,300 / 4,150 in these three over 5 minutes (the gear tier is the difference).
  // Weapon magic damage 134 / 140 / 146 is from the 4.58 item data.
  const VERSIONS = {
    sb40: { label: 'Stormblood 4.0–4.01', history: 'SB 4.0–4.01', gear: 'i340', excogExpiry: false, aetherpact: 5, dawnCast: 2, dawn: 100, ref: 2760,
      early: true, tincture: 'mnd1sb',
      note: 'Level 70, the launch: no Miasma II, Quickened Aetherflow a 20% chance of 10s, Summon a 6s cast; Excogitation 650 / 30s' },
    sb405: { label: 'Stormblood 4.05–4.18', history: 'SB 4.05–4.18', gear: 'i340', excogExpiry: false, aetherpact: 5, dawnCast: 2, dawn: 100, ref: 2810, tincture: 'mnd1sb',
      note: 'Level 70. Broil II, Bio II and Miasma, Energy Drain with Quickened Aetherflow, Chain Stratagem, Selene\'s Fey Wind; Excogitation 800 / 45s' },
    sb42: { label: 'Stormblood 4.2–4.25', history: 'SB 4.2–4.25', gear: 'i370', excogExpiry: true, aetherpact: 5, dawnCast: 2, dawn: 100, ref: 3510, tincture: 'mnd2sb',
      note: 'Level 70. As 4.05, with Excogitation also healing when it expires; Sigmascape gear' },
    sb43: { label: 'Stormblood 4.3–4.58', history: 'SB 4.3–4.58', gear: 'i400', excogExpiry: true, aetherpact: 3, dawnCast: 0, dawn: 120, ref: 4380, tincture: 'mnd3sb',
      note: 'Level 70. Whispering Dawn instant, Aetherpact 3s; Alphascape gear' },
  };

  const spell = (o) => Object.assign({ kind: 'gcd', target: true, range: 25, delay: 0.8, school: 'aether', sound: 'ruin' }, o);
  const heal = (o) => Object.assign({ kind: 'gcd', potency: 0, school: 'aether', sound: 'paradox' }, o);
  const ab = (o) => Object.assign({ kind: 'ogcd' }, o);

  function buildActions(V) {
    const E = V.early;
    const A = {
      broil2: spell({ name: 'Broil II', potency: 230, cast: 2.5, mp: 720, orb: true, desc: 'Deals unaspected damage with a potency of 230.' }),
      bio2: spell({ name: 'Bio II', potency: 0, mp: 720, dot: { potency: 35, duration: 30 }, sound: 'dot', desc: 'Deals unaspected damage over time.\nPotency: 35\nDuration: 30s' }),
      miasma: spell({ name: 'Miasma', potency: 20, cast: 2.5, mp: 600, dot: { potency: 35, duration: 24 }, desc: 'Deals unaspected damage with a potency of 20.\nAdditional Effect: Unaspected damage over time\nPotency: 35\nDuration: 24s' }),
      miasma2: spell({
        name: 'Miasma II', potency: 100, mp: 1680, target: false, pbaoe: 5, aoe: true, dot: { potency: 25, duration: 12, aoe: true },
        desc: 'Deals unaspected damage with a potency of 100 to all nearby enemies.\nAdditional Effect: Unaspected damage over time\nPotency: 25\nDuration: 12s',
      }),
      ruin2: spell({ name: 'Ruin II', potency: 100, mp: 480, orb: true, desc: 'Deals unaspected damage with a potency of 100.' }),
      energyDrain: ab({
        name: 'Energy Drain', recast: 3, potency: 150, flow: true, target: true, range: 25, delay: 0.6, school: 'aether', sound: 'xeno',
        desc: 'Deals unaspected damage with a potency of 150.\nAdditional Effect: Absorbs a portion of damage dealt as HP and restores MP\nAetherflow Gauge Cost: 1\nAdditional Effect: Faerie Gauge +10',
      }),
      bane: ab({ name: 'Bane', recast: 10, flow: true, target: true, range: 25, desc: 'Spreads a target\'s Bio and Miasma effects to nearby enemies, with potency reduced by 20% for the second enemy, 40% for the third, 60% for the fourth and 80% for the rest.\nAetherflow Gauge Cost: 1' }),
      shadowFlare: ab({ name: 'Shadow Flare', recast: 60, target: true, range: 25, school: 'none', dot: { potency: 50, duration: 15, aoe: true }, desc: 'Creates a patch of dark miasma on the ground, dealing unaspected damage with a potency of 50 to any enemies who enter.\nDuration: 15s\nAdditional Effect: Slow +5%' }),
      chainStratagem: ab({ name: 'Chain Stratagem', recast: 120, target: true, range: 25, desc: 'Increases rate at which target takes critical hits by 15%.\nDuration: 15s' }),
      aetherflow: ab({ name: 'Aetherflow', recast: 60, desc: `Restores 10% of maximum MP.\nAdditional Effect: Aetherflow III\nQuickened Aetherflow: ${E ? 'each Aetherflow action has a 20% chance of shortening its recast by 10s' : 'each Aetherflow action shortens its recast by 5s'}.` }),
      dissipation: ab({ name: 'Dissipation', recast: 180, desc: 'Dismisses your faerie, granting you Aetherflow III and increasing healing magic potency by 20%.\nDuration: 30s\nCannot summon your faerie while under the effect of Dissipation.' }),
      physick: heal({ name: 'Physick', cast: 2, mp: 600, desc: 'Restores target\'s HP.\nCure Potency: 400' }),
      adloquium: heal({ name: 'Adloquium', cast: 2, mp: 1560, desc: 'Restores target\'s HP.\nCure Potency: 300\nAdditional Effect: Erects a magicked barrier which nullifies damage equaling the amount of HP restored. When critical HP is restored, also grants Catalyze.' }),
      succor: heal({ name: 'Succor', cast: 2.5, mp: 2040, desc: `Restores own HP and the HP of all party members within a radius of 15 yalms.\nCure Potency: 150\nAdditional Effect: Erects a magicked barrier which nullifies damage equaling ${E ? '' : '150% of '}the amount of HP restored.` }),
      lustrate: ab({ name: 'Lustrate', recast: 1, flow: true, desc: 'Restores target\'s HP.\nCure Potency: 600\nAetherflow Gauge Cost: 1' }),
      indomitability: ab({ name: 'Indomitability', recast: 30, flow: true, desc: `Restores own HP and the HP of all party members within a radius of 15 yalms.\nCure Potency: ${E ? 400 : 500}\nAetherflow Gauge Cost: 1` }),
      excogitation: ab({ name: 'Excogitation', recast: E ? 60 : 45, flow: true, desc: `Grants self or target party member the effect of Excogitation, restoring HP when their HP falls below 50%${V.excogExpiry ? ' or when the effect expires' : ''}.\nCure Potency: ${E ? 650 : 800}\nDuration: ${E ? 30 : 45}s\nAetherflow Gauge Cost: 1` }),
      sacredSoil: ab({ name: 'Sacred Soil', recast: 30, flow: true, desc: 'Creates a designated area in which party members will only suffer 90% of all damage inflicted.\nDuration: 15s\nAetherflow Gauge Cost: 1' }),
      deploymentTactics: ab({ name: 'Deployment Tactics', recast: 120, desc: 'Extends Galvanize effect cast on self or target to all party members within a radius of 15 yalms.' }),
      emergencyTactics: ab({ name: 'Emergency Tactics', recast: E ? 30 : 20, desc: 'Transforms the next Galvanize effect into a healing effect.\nDuration: 15s' }),
      aetherpact: ab({ name: 'Aetherpact', recast: V.aetherpact, desc: 'Orders your faerie to execute Fey Union, gradually restoring a party member\'s HP.\nCure Potency: 480\nFaerie Gauge Cost: 10 per tick\nPress again to dissolve the union.' }),
      summon: heal({ name: 'Summon', cast: E ? 6 : 3, mp: E ? 2400 : 1200, faerie: 'eos', desc: 'Summons Eos, a faerie healer.' }),
      summon2: heal({ name: 'Summon II', cast: E ? 6 : 3, mp: E ? 2400 : 1200, faerie: 'selene', desc: 'Summons Selene, a faerie healer. Selene keeps Fey Wind up: 3% faster casts and GCD for you and nearby party members (30s, every 60s).' }),
      whisperingDawn: ab({ name: 'Whispering Dawn', recast: 60, desc: `Orders Eos to gradually restore the HP of party members nearby.\nCure Potency: ${V.dawn}\nDuration: 21s${V.dawnCast ? `\nCast time: ${V.dawnCast}s (Eos's)` : ''}` }),
      feyCovenant: ab({ name: 'Fey Covenant', recast: 120, desc: 'Orders Eos to increase magic defense of nearby party members by 20%.\nDuration: 20s' }),
      feyIllumination: ab({ name: 'Fey Illumination', recast: 120, desc: 'Orders Eos to increase healing magic potency of nearby party members by 10%.\nDuration: 20s' }),
      silentDusk: ab({ name: 'Silent Dusk', recast: 40, target: true, range: 25, desc: 'Orders Selene to silence the target.' }),
      feyCaress: ab({ name: 'Fey Caress', recast: 60, desc: 'Orders Selene to remove a detrimental effect from nearby party members.' }),
      clericStance: ab({ name: 'Cleric Stance', recast: 90, role: true, desc: 'Increases attack magic potency by 5%.\nDuration: 15s' }),
      largesse: ab({ name: 'Largesse', recast: 90, role: true, desc: 'Increases healing magic potency by 20%.\nDuration: 20s' }),
      swiftcast: ab({ name: 'Swiftcast', recast: 60, role: true, desc: 'Next spell is cast immediately.\nDuration: 10s' }),
      lucidDreaming: ab({ name: 'Lucid Dreaming', recast: 120, role: true, desc: 'Reduces enmity by half.\nAdditional Effect: Refresh\nPotency: 80\nDuration: 21s' }),
      surecast: ab({ name: 'Surecast', recast: 30, role: true, desc: E ? 'Next spell is cast without interruption.\nAdditional Effect: Nullifies most knockback and draw-in effects\nDuration: 10s' : 'Spells can be cast without interruption.\nDuration: 5s' }),
      ...B.GENERAL_ACTIONS,
      tincture: B.tincture(V.tincture),
    };
    // Miasma II was cut in 4.0 and came back in 4.05.
    if (E) delete A.miasma2;
    return A;
  }

  const STATUSES = {
    bio2: { name: 'Bio II', self: false, icon: 'st_bio' },
    miasma: { name: 'Miasma', self: false, icon: 'st_miasma' },
    miasma2: { name: 'Miasma II', self: false, icon: 'st_miasma' },
    shadowFlare: { name: 'Shadow Flare', self: false, icon: 'st_shadowflare' },
    chainStratagem: { name: 'Chain Stratagem', self: false, icon: 'st_chain' },
    feyWind: { name: 'Fey Wind', self: true, icon: 'st_feywind' },
    dissipation: { name: 'Dissipation', self: true, icon: 'st_dissipation' },
    clericStance: { name: 'Cleric Stance', self: true, icon: 'st_cleric' },
    largesse: { name: 'Largesse', self: true, icon: 'st_largesse' },
    feyUnion: { name: 'Fey Union', self: true, icon: 'st_union' },
    emergencyTactics: { name: 'Emergency Tactics', self: true, icon: 'st_et' },
    excogitation: { name: 'Excogitation', self: true, icon: 'st_excog' },
  };

  class ScholarSB {
    constructor(version) {
      const V = VERSIONS[version];
      this.V = V;
      this.name = 'Scholar';
      this.abbr = 'SCH';
      this.role = 'healer';
      this.level = 70;
      this.levelKey = 'sb70';
      this.model = 'sch-sb';
      this.maxMp = maxMpFor(GEAR[V.gear].piety);
      this.actions = buildActions(V);
      this.statuses = STATUSES;
      // Maim and Mend II: +30% to the Scholar's damage (and the faerie's healing).
      this.stats = Object.assign({ mainStat: 'mnd', jobMod: 115, trait: 130, delay: 3.12 }, GEAR[V.gear]);
      this.speedName = 'Spell speed';
      this.selfStatusOrder = ['clericStance', 'feyWind', 'swiftcast', 'dissipation', 'medicated', 'lucidDreaming', 'largesse',
        'feyUnion', 'emergencyTactics', 'excogitation', 'surecast', 'sprint'];
      this.targetStatusOrder = ['bio2', 'miasma', 'miasma2', 'chainStratagem', 'shadowFlare'];
      this.defaultBars = [
        ['broil2', 'bio2', 'miasma', 'ruin2', 'energyDrain', 'aetherflow', 'chainStratagem', 'shadowFlare', 'clericStance', 'swiftcast', 'lucidDreaming', 'tincture'],
        ['miasma2', 'bane', 'dissipation', 'summon2', 'summon', 'physick', 'adloquium', 'succor', 'lustrate', 'indomitability', 'excogitation', 'sacredSoil'],
        ['deploymentTactics', 'emergencyTactics', 'aetherpact', 'whisperingDawn', 'feyCovenant', 'feyIllumination', 'silentDusk', 'feyCaress', 'largesse', 'surecast', 'sprint', null],
      ];
      this.actionGroups = [
        ['Scholar', ['broil2', 'bio2', 'miasma', 'miasma2', 'ruin2', 'energyDrain', 'bane', 'shadowFlare', 'chainStratagem', 'aetherflow',
          'dissipation', 'physick', 'adloquium', 'succor', 'lustrate', 'indomitability', 'excogitation', 'sacredSoil', 'deploymentTactics',
          'emergencyTactics', 'aetherpact', 'summon', 'summon2']],
        ['Faerie', ['whisperingDawn', 'feyCovenant', 'feyIllumination', 'silentDusk', 'feyCaress']],
        ['Role Actions', ['clericStance', 'swiftcast', 'lucidDreaming', 'largesse', 'surecast']],
        ['General', ['sprint', 'tincture']],
      ];
      if (V.early) {
        this.defaultBars = this.defaultBars.map(r => r.map(x => (x === 'miasma2' ? null : x)));
        this.actionGroups = this.actionGroups.map(([n, ids]) => [n, ids.filter(x => x !== 'miasma2')]);
      }
      this.referenceDps = V.ref;
      this.referenceGcd = 2.45;
      this.startDistance = 12;
    }

    initGauge(e) {
      e.pet = { kind: 'selene' };
      return { flow: 0, faerie: 'selene', fey: 0, windNext: 0, unionNext: 0 };
    }

    resolveId(id) { return id; }

    check(id, e) {
      const a = this.actions[id], g = e.g;
      if (a.flow && g.flow < 1) return 'Unable to execute action. Aetherflow required.';
      if (a.faerie && e.has('dissipation')) return 'Unable to execute action while under the effect of Dissipation.';
      const eos = ['whisperingDawn', 'feyCovenant', 'feyIllumination'], selene = ['silentDusk', 'feyCaress'];
      if (eos.includes(id) && g.faerie !== 'eos') return 'Unable to execute action. Eos required.';
      if (selene.includes(id) && g.faerie !== 'selene') return 'Unable to execute action. Selene required.';
      if ((id === 'dissipation' || id === 'aetherpact') && !g.faerie) return 'Unable to execute action. Faerie required.';
      if (id === 'aetherpact' && !e.has('feyUnion') && g.fey < 10) return 'Unable to execute action. Not enough Faerie Gauge.';
      return null;
    }

    haste(e) { return e.has('feyWind') ? 3 : 0; }

    castTime(id, e) {
      const a = this.actions[id];
      if (!a.cast) return 0;
      if (e.has('swiftcast')) return 0;
      return e.speedScale(a.cast, this.haste(e));
    }

    consumeInstant(id, e) {
      if (this.actions[id].cast && e.has('swiftcast')) e.removeStatus('swiftcast');
    }

    mpCost(id) { return this.actions[id].mp || 0; }
    mpRegen() { return Math.round(this.maxMp * 0.02); }
    lucidGain() { return 960; }

    // Cleric Stance +5%; Chain Stratagem +15% crit on the dummy.
    snapshot(a, e) {
      let mult = 1, critAdd = 0;
      if (e.has('clericStance')) mult *= 1.05;
      if (e.tHas('chainStratagem')) critAdd += 0.15;
      const main = this.stats.main + (e.has('medicated') ? B.TINCTURES[this.V.tincture].cap : 0);
      return { mult, main, critAdd };
    }

    resolve(id, e) {
      if (this.actions[id].kind === 'gcd') this.spell(id, e);
      else this.ability(id, e);
    }

    applyDot(e, key) {
      const a = this.actions[key];
      e.addTStatus(key, a.dot.duration, { snap: this.snapshot(a, e), dot: { potency: a.dot.potency, id: key } });
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
      if (id === 'bio2') this.applyDot(e, 'bio2');
      // Miasma II is point-blank: its DoT lands only if the dummy is in reach.
      const inReach = !a.pbaoe || e.distToTarget() - B.DUMMY_RADIUS <= a.pbaoe;
      const after = (id === 'miasma' || (id === 'miasma2' && inReach)) ? () => this.applyDot(e, id) : null;
      if (a.potency) e.queueHit(id, a.potency, this.snapshot(a, e), a.delay, after);
    }

    // Quickened Aetherflow: each Aetherflow action takes 5s off Aetherflow's recast (4.0–4.01: a 20% chance of 10s).
    spendFlow(e) {
      const g = e.g;
      g.flow--;
      const c = e.cds.aetherflow;
      const cut = this.V.early ? (Math.random() < 0.2 ? 10 : 0) : 5;
      if (cut && c && c.nextAt !== null) c.nextAt = Math.max(e.now, c.nextAt - cut);
    }

    ability(id, e) {
      const a = this.actions[id], g = e.g;
      if (a.flow) this.spendFlow(e);
      switch (id) {
        case 'aetherflow': {
          g.flow = 3;
          const before = e.mp;
          e.mp = Math.min(e.maxMp, e.mp + Math.round(e.maxMp * 0.1));
          e.emit('mpGain', { amount: e.mp - before, source: 'manafont' });
          return;
        }
        case 'energyDrain': {
          g.fey = Math.min(100, g.fey + 10);
          // "Restores MP": the amount isn't in the data; 5% of max here.
          const before = e.mp;
          e.mp = Math.min(e.maxMp, e.mp + Math.round(e.maxMp * 0.05));
          if (e.mp > before) e.emit('mpGain', { amount: e.mp - before, source: 'lucid' });
          break;
        }
        case 'bane':
          for (const k of ['bio2', 'miasma']) {
            const st = e.tStatuses[k];
            if (st && st.until > e.now && e.targets > 1) { st.targets = e.targets; st.aoe = FALLOFF; }
          }
          return;
        case 'dissipation':
          g.flow = 3; g.faerie = null; e.pet = null;
          e.addStatus('dissipation', 30);
          return;
        case 'chainStratagem': e.addTStatus('chainStratagem', 15); return;
        case 'shadowFlare': this.applyDot(e, 'shadowFlare'); return;
        case 'aetherpact':
          if (e.has('feyUnion')) e.removeStatus('feyUnion');
          else { e.addStatus('feyUnion', 1e9, { permanent: true }); g.unionNext = e.now + 3; }
          return;
        case 'excogitation': e.addStatus('excogitation', this.V.early ? 30 : 45); return;
        case 'emergencyTactics': e.addStatus('emergencyTactics', 15); return;
        case 'clericStance': e.addStatus('clericStance', 15); return;
        case 'largesse': e.addStatus('largesse', 20); return;
        default:
          if (B.ROLE_EFFECTS[id]) B.ROLE_EFFECTS[id](e);
      }
      if (a.potency) e.queueHit(id, a.potency, this.snapshot(a, e), a.delay);
    }

    // Selene keeps Fey Wind up (30s every 60s) once you're in combat; Fey Union drains the Faerie Gauge.
    nextEvent(e) {
      const g = e.g;
      let t = g.faerie === 'selene' && e.inCombat ? Math.max(e.now, g.windNext) : Infinity;
      if (e.has('feyUnion')) t = Math.min(t, g.unionNext);
      return t;
    }
    process(e) {
      const g = e.g;
      if (g.faerie === 'selene' && e.inCombat && e.now >= g.windNext - EPS) {
        g.windNext = e.now + 60;
        e.addStatus('feyWind', 30);
      }
      if (e.has('feyUnion') && e.now >= g.unionNext - EPS) {
        g.unionNext += 3;
        g.fey = Math.max(0, g.fey - 10);
        if (g.fey <= 0) e.removeStatus('feyUnion');
      }
    }

    proc(id, e) {
      if (id === 'energyDrain') return e.g.flow > 0;
      if (id === 'aetherflow') return e.g.flow === 0;
      return false;
    }

    speedInfo(e) { return `GCD ${e.gcdForSpeed(e.stats.speed).toFixed(2)} · ${e.gcdForSpeed(e.stats.speed, 3).toFixed(2)} with Fey Wind · ${e.maxMp.toLocaleString()} MP`; }

    // ---------- Aetherflow and the Faerie Gauge ----------
    gaugeBuild(root) {
      root.innerHTML = `
<svg width="360" height="150" viewBox="0 0 360 150">
  <defs><radialGradient id="sc-flow" cx="50%" cy="40%" r="60%"><stop offset="0" stop-color="#eafff6"/><stop offset="1" stop-color="#2fb08c"/></radialGradient>
  <linearGradient id="sc-fey" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#3fa0c4"/><stop offset="1" stop-color="#b8f4ff"/></linearGradient></defs>
  <rect x="8" y="10" width="344" height="130" rx="14" fill="rgba(14,12,20,.86)" stroke="rgba(255,255,255,.22)"/>
  <text x="24" y="38" font-family="Noto Sans, sans-serif" font-size="11" font-weight="600" fill="#a9a3b4" letter-spacing="1">AETHERFLOW</text>
  ${[0, 1, 2].map(k => `<path id="sc-f${k}" d="M0 -14 L10 0 L0 14 L-10 0 Z" transform="translate(${44 + k * 34} 66)" fill="#1d2a26" stroke="rgba(255,255,255,.25)" stroke-width="1.5"/>`).join('')}
  <text x="170" y="38" font-family="Noto Sans, sans-serif" font-size="11" font-weight="600" fill="#a9a3b4" letter-spacing="1">FAERIE GAUGE</text>
  <text id="sc-feyn" x="336" y="38" text-anchor="end" font-family="Saira Semi Condensed, sans-serif" font-size="18" font-weight="700" fill="#fff" stroke="#000" stroke-width="3" paint-order="stroke">0</text>
  <rect x="170" y="58" width="166" height="14" rx="7" fill="#1d1a2a" stroke="rgba(255,255,255,.2)"/>
  <rect id="sc-fey" x="170" y="58" width="0" height="14" rx="7" fill="url(#sc-fey)"/>
  <text id="sc-pet" x="24" y="118" font-family="Noto Sans, sans-serif" font-size="12" font-weight="600" fill="#cfe8ff" letter-spacing="1"></text>
</svg>`;
      const $ = (s) => root.querySelector(s);
      this.sg = { f: [0, 1, 2].map(k => $('#sc-f' + k)), fey: $('#sc-fey'), feyn: $('#sc-feyn'), pet: $('#sc-pet'), cache: {} };
    }

    gaugeUpdate(e) {
      const G = this.sg, c = G.cache, g = e.g;
      const put = (k, v, fn) => { if (c[k] !== v) { c[k] = v; fn(v); } };
      for (let i = 0; i < 3; i++) put('f' + i, g.flow > i, v => G.f[i].setAttribute('fill', v ? 'url(#sc-flow)' : '#1d2a26'));
      put('fey', g.fey, v => { G.fey.setAttribute('width', String(166 * v / 100)); G.feyn.textContent = String(v); });
      const pet = g.faerie === 'selene' ? 'SELENE' : g.faerie === 'eos' ? 'EOS' : e.has('dissipation') ? 'DISSIPATION (NO FAERIE)' : 'NO FAERIE: SUMMON ONE';
      put('pet', pet, v => { G.pet.textContent = v; });
    }

    helpHtml(seq) {
      const V = this.V;
      return `
<h3>How it plays (${V.label})</h3>
<p>Level 70 Scholar on a dummy: damage and MP. Keep <b>Bio II</b> (35 a tick for 30s, instant) and <b>Miasma</b> (20 + 35 a tick for 24s) up and fill with <b>Broil II</b> (230, 2.5s cast). <b>Ruin II</b> is instant for moving and for making room for abilities, since a 2.5s cast leaves no gap to weave in.</p>
<p><b>Aetherflow</b> (60s) gives three stacks and 10% MP. Spend them on <b>Energy Drain</b> (150, and some MP back): ${V.early ? 'each Aetherflow action has a 20% chance of taking 10s off Aetherflow\'s recast (Quickened Aetherflow), so it\'s back every 54s or so' : 'each Aetherflow action takes 5s off Aetherflow\'s recast (Quickened Aetherflow), so it\'s back every 45s'}. <b>Chain Stratagem</b> (+15% crit on the dummy, 120s) goes with <b>Cleric Stance</b> (+5%, 90s); <b>Shadow Flare</b> is a 60s ground DoT. Selene (Summon II) keeps <b>Fey Wind</b> on you, 3% faster casts. <b>Dissipation</b> gives three more stacks but sends the faerie away for 30s, and in Stormblood you have to summon it back yourself (${V.early ? '6s, 2,400 MP' : '3s, 1,200 MP'}).</p>
<h3>An opener for this version</h3>
${seq(['broil2', 'bio2', ['tincture'], ['clericStance'], 'miasma', 'ruin2', ['chainStratagem'], ['aetherflow'], 'broil2', 'ruin2', ['energyDrain'], ['energyDrain'], 'broil2', 'ruin2', ['energyDrain'], ['shadowFlare'], 'broil2', 'broil2'])}
<p>Summon Selene before the pull. This follows the version's rules; it isn't copied from a published guide.</p>
<p style="color:#a9a3b4">${V.early ? 'Numbers are 2017\'s job guide and the 4.05 / 4.1 patch notes (no game data before 4.11); Summon\'s 2,400 MP is a guess' : 'Numbers are the game data for this patch'}: Broil II 230, Bio II 35 × 30s, Miasma 20 + 35 × 24s, ${V.early ? 'no Miasma II (back in 4.05)' : 'Miasma II 100 + 25 × 12s'}, Ruin II 100, Energy Drain 150, Shadow Flare 50 a tick for 15s, Chain Stratagem +15% crit, Fey Wind 3%. Energy Drain's MP is a guess (5%); gear is approximate. The heals are on the hotbar for the feel of the kit; on a dummy they do nothing.</p>`;
    }
  }

  B.ScholarSB = ScholarSB;
  B.registerJob({
    id: 'sch', name: 'Scholar', abbr: 'SCH', role: 'healer', classJob: 28,
    versions: ['sb43', 'sb42', 'sb405', 'sb40'].map(v => ({ id: v, label: VERSIONS[v].label, history: VERSIONS[v].history, note: VERSIONS[v].note, create: () => new ScholarSB(v) })),
  });
})(window.BLM);
