// Scholar, Endwalker at level 90, in two versions, and Dawntrail 7.0–7.57 at level 100. Broil IV (295, a 1.5s cast) as filler, Biolysis (70 × 30s) kept up,
// Ruin II (220, instant) to move; Aetherflow (60s) gives three stacks and 20% MP, Dissipation (180s, the faerie away)
// three more, and each stack buys an Energy Drain (100, 1s) or an Aetherflow heal. Chain Stratagem (120s) raises the
// target's critical hit rate by 10% for 15s. Only damage matters on a dummy; the heals are there to press. The faerie
// does no damage in Endwalker. The 6.0 and 6.58 numbers didn't change in between: 6.1 only shortened Expedience
// (20s → 10s) and 6.4 removed Selene. Game data at each patch (xivapi's datamining) and the Lodestone notes; gear is The
// Balance's set (Asphodelos for 6.0x, the 6.4 set for 6.1–6.58). ref: a scripted bot parses about 4,750 / 7,280.
//  - DT 7.0–7.57: Broil IV 320, Biolysis 85 (the 7.4 numbers); Chain Stratagem lasts 20s and readies Baneful Impaction
//    (140 × 15s around the target); Swiftcast 40s; Seraphism heals only. The 7.4+ savage set; a bot parses about 20,050.
//  - ShB (level 80, pre-squish): Broil III a 2.5s cast (280; 290 from 5.4), Biolysis 60 (70 from 5.4), Ruin II 200, Art of
//    War 150 / 160, every spell 400 MP; Aetherflow gives 10% MP; no Expedient or Protraction. Energy Drain (3s recast)
//    is 150 in 5.05–5.35 and 100 from 5.4; 5.0–5.01 had none, so Aetherflow stacks only bought heals. Eden's Gate gear for
//    5.0x, The Balance's 5.55 relic set for 5.1–5.58. A bot that clips Broil III for its oGCDs parses about 12,970 /
//    8,270 / 7,760.
(function (B) {
  const spell = (o) => Object.assign({ kind: 'gcd', target: true, range: 25, delay: 0.8, school: 'aether', sound: 'paradox' }, o);
  const heal = (o) => Object.assign({ kind: 'gcd', potency: 0, school: 'aether', sound: 'paradox' }, o);
  const ab = (o) => Object.assign({ kind: 'ogcd' }, o);
  const EDEN_GATE = { hp: 88356, main: 4193, wd: 164, det: 2447, crit: 2448, dh: 1760, speed: 1345, piety: 1129 };
  const VERSIONS = {
    shb51: { label: 'Shadowbringers 5.1–5.58', history: 'ShB 5.1–5.58', level: 80, shb: true, broil: 290, bio: 70, aow: 160, ed: 100, seraph: 22, swift: 60, tincture: 'mnd4', ref: 13750,
      stats: { hp: 127517, main: 5560, wd: 180, det: 1668, crit: 3324, dh: 2079, speed: 2132, piety: 908 },
      gear: 'The Balance\'s 5.55 relic set at 2.32 (Mind 5,560, 180 magic damage)',
      note: 'Level 80: Broil III (a 2.5s cast) and Biolysis, Energy Drain 100 from Aetherflow and Dissipation, Chain Stratagem; Eden\'s Promise gear' },
    shb505: { label: 'Shadowbringers 5.05–5.08', history: 'ShB 5.05–5.08', level: 80, shb: true, broil: 280, bio: 60, aow: 160, ed: 150, seraph: 20, swift: 60, tincture: 'mnd2', ref: 8770,
      stats: EDEN_GATE, gear: 'an Eden\'s Gate Savage set at 2.40 (Mind 4,193, 164 magic damage)',
      note: 'Level 80: Broil III 280, Biolysis 60, Energy Drain 150 for each Aetherflow stack; Eden\'s Gate gear' },
    shb50: { label: 'Shadowbringers 5.0–5.01', history: 'ShB 5.0–5.01', level: 80, shb: true, broil: 280, bio: 60, aow: 150, ed: 0, seraph: 20, swift: 60, tincture: 'mnd1', ref: 8220,
      stats: EDEN_GATE, gear: 'an Eden\'s Gate Savage set at 2.40 (Mind 4,193, 164 magic damage)',
      note: 'Level 80 at launch: no Energy Drain for Scholar, so Aetherflow only feeds heals; Broil III and Biolysis; Eden\'s Gate gear' },
    dt70: { label: 'Dawntrail 7.0–7.57', history: 'DT 7.0–7.57', level: 100, broil: 320, bio: 85, chainDur: 20, swift: 40, expedience: 10, selene: false, tincture: 'mnddt4', ref: 21250,
      stats: { hp: 204455, main: 6496, wd: 158, det: 2866, crit: 3388, dh: 1014, speed: 1237, piety: 440 },
      note: 'Level 100: Broil IV 320, Biolysis 85, Chain Stratagem 20s into Baneful Impaction, Energy Drain from Aetherflow and Dissipation; the 7.4 savage gear' },
    ew61: { label: 'Endwalker 6.1–6.58', history: 'EW 6.1–6.58', expedience: 10, selene: false, tincture: 'mnd', ref: 7720,
      stats: { hp: 77532, main: 3369, wd: 132, det: 2087, crit: 2454, dh: 832, speed: 946, piety: 390 },
      note: 'Level 90: Broil IV, Biolysis, Energy Drain from Aetherflow and Dissipation, Chain Stratagem; Expedience 10s; the 6.4 set' },
    ew60: { label: 'Endwalker 6.0–6.08', history: 'EW 6.0–6.08', expedience: 20, selene: true, tincture: 'mnd6', ref: 5040,
      stats: { hp: 53523, main: 2560, wd: 120, det: 1951, crit: 2277, dh: 616, speed: 944, piety: 390 },
      note: 'Level 90 at launch: Broil IV, Biolysis, Energy Drain, Chain Stratagem, Expedience 20s; Asphodelos gear' },
  };

  function buildActions(V) {
    return {
      broil4: spell({ name: 'Broil IV', potency: V.broil || 295, cast: 1.5, mp: 400, orb: true, desc: `Deals unaspected damage with a potency of ${V.broil || 295}.` }),
      biolysis: spell({ name: 'Biolysis', potency: 0, mp: 300, dot: { potency: V.bio || 70, duration: 30 }, sound: 'dot', desc: `Deals unaspected damage over time.\nPotency: ${V.bio || 70}\nDuration: 30s` }),
      ruin2: spell({ name: 'Ruin II', potency: 220, mp: 300, desc: 'Deals unaspected damage with a potency of 220.' }),
      artOfWar2: spell({ name: 'Art of War II', potency: 180, mp: 400, target: false, pbaoe: 5, aoe: true, desc: 'Deals unaspected damage with a potency of 180 to all nearby enemies.' }),
      physick: heal({ name: 'Physick', cast: 1.5, mp: 400, desc: 'Restores target\'s HP.\nCure Potency: 450' }),
      adloquium: heal({ name: 'Adloquium', cast: 2, mp: 1000, desc: 'Restores target\'s HP.\nCure Potency: 300\nAdditional Effect: Erects a magicked barrier (Galvanize)' }),
      // Level 96 turns Succor into Concitation (the same 200-potency heal and barrier).
      succor: heal({ name: V.level === 100 ? 'Concitation' : 'Succor', cast: 2, mp: 1000, desc: 'Restores own HP and the HP of all nearby party members.\nCure Potency: 200\nAdditional Effect: Erects a magicked barrier' }),
      energyDrain: ab({ name: 'Energy Drain', recast: 1, potency: 100, flow: true, target: true, range: 25, delay: 0.6, fx: 'gnbCont', desc: 'Deals unaspected damage with a potency of 100.\nAetherflow Gauge Cost: 1' }),
      aetherflow: ab({ name: 'Aetherflow', recast: 60, desc: 'Restores 20% of maximum MP.\nAdditional Effect: Aetherflow III (three stacks)\nCan only be executed while in combat.' }),
      dissipation: ab({ name: 'Dissipation', recast: 180, desc: 'Orders your faerie away while granting you three Aetherflow stacks and +20% healing magic potency.\nDuration: 30s\nCan only be executed while in combat.' }),
      chainStratagem: ab({ name: 'Chain Stratagem', recast: 120, target: true, range: 25, desc: 'Increases critical hit rate of all party members against the target by 10%.\nDuration: 15s' }),
      lustrate: ab({ name: 'Lustrate', recast: 1, flow: true, desc: 'Restores target\'s HP.\nCure Potency: 600\nAetherflow Gauge Cost: 1' }),
      indomitability: ab({ name: 'Indomitability', recast: 30, flow: true, desc: 'Restores own HP and the HP of all nearby party members.\nCure Potency: 400\nAetherflow Gauge Cost: 1' }),
      excogitation: ab({ name: 'Excogitation', recast: 45, flow: true, desc: 'Restores target\'s HP when it falls below 50% or the effect expires.\nCure Potency: 800\nDuration: 45s\nAetherflow Gauge Cost: 1' }),
      sacredSoil: ab({ name: 'Sacred Soil', recast: 30, flow: true, desc: 'Creates a designated area in which party members will only suffer 90% of all damage inflicted.\nDuration: 15s\nAetherflow Gauge Cost: 1' }),
      recitation: ab({ name: 'Recitation', recast: 60, desc: `Allows the execution of Adloquium, ${V.level === 100 ? 'Concitation' : 'Succor'}, Indomitability or Excogitation without MP or Aetherflow, as a critical heal.\nDuration: 15s` }),
      deploymentTactics: ab({ name: 'Deployment Tactics', recast: 90, desc: 'Extends Galvanize from the target to all nearby party members.' }),
      expedient: ab({ name: 'Expedient', recast: 120, desc: `Grants Expedience (+10% movement speed for ${V.expedience}s) and Desperate Measures (−10% damage taken, 20s) to all nearby party members.` }),
      protraction: ab({ name: 'Protraction', recast: 60, desc: 'Increases target\'s maximum HP by 10% and restores the amount increased.\nDuration: 10s' }),
      summonSeraph: ab({ name: 'Summon Seraph', recast: 120, desc: 'Summons Seraph to fight at your side (healing only).\nDuration: 22s' }),
      swiftcast: ab({ name: 'Swiftcast', recast: V.swift || 60, role: true, desc: 'Next spell is cast immediately.\nDuration: 10s' }),
      lucidDreaming: ab({ name: 'Lucid Dreaming', recast: 60, role: true, desc: 'Gradually restores MP.\nPotency: 55\nDuration: 21s' }),
      surecast: ab({ name: 'Surecast', recast: 120, role: true, desc: 'Spells can be cast without interruption.\nDuration: 6s' }),
      rescue: ab({ name: 'Rescue', recast: 120, role: true, desc: 'Instantly draws target party member to your side.' }),
      ...(V.level === 100 ? {
        banefulImpaction: ab({ name: 'Baneful Impaction', recast: 1, target: true, range: 25, dot: { potency: 140, duration: 15 }, desc: 'Deals unaspected damage over time to the target and all enemies nearby it.\nPotency: 140\nDuration: 15s\nCan only be executed while under the effect of Impact Imminent (from Chain Stratagem).' }),
        seraphism: ab({ name: 'Seraphism', recast: 180, desc: 'Grants Seraphism: Adloquium and Concitation become Manifestation and Accession.\nDuration: 20s' }),
      } : {}),
      ...B.GENERAL_ACTIONS,
      tincture: B.tincture(V.tincture),
    };
  }

  // Shadowbringers: Broil III, a 2.5s cast; every spell 400 MP; no Expedient or Protraction.
  function shbActions(A, V) {
    const set = (id, o) => { A[id] = Object.assign({}, A[id], o); };
    set('broil4', { name: 'Broil III', iconOf: 'broil3', potency: V.broil, cast: 2.5, mp: 400, desc: `Deals unaspected damage with a potency of ${V.broil}.` });
    set('biolysis', { mp: 400 });
    set('ruin2', { potency: 200, mp: 400, desc: 'Deals unaspected damage with a potency of 200.' });
    set('artOfWar2', { name: 'Art of War', iconOf: 'artOfWar', potency: V.aow, mp: 600, desc: `Deals unaspected damage with a potency of ${V.aow} to all nearby enemies.` });
    if (V.ed) set('energyDrain', { recast: 3, potency: V.ed, desc: `Deals unaspected damage with a potency of ${V.ed}.\nAdditional Effect: Absorbs a portion of damage dealt as HP and restores MP\nAetherflow Gauge Cost: 1` });
    else delete A.energyDrain;
    set('aetherflow', { desc: 'Restores 10% of maximum MP.\nAdditional Effect: Aetherflow III (three stacks)\nCan only be executed while in combat.' });
    set('recitation', { recast: 90 });
    set('deploymentTactics', { recast: 120 });
    set('summonSeraph', { desc: `Summons Seraph to fight at your side (healing only).\nDuration: ${V.seraph}s` });
    delete A.expedient; delete A.protraction;
  }

  const STATUSES = {
    biolysis: { name: 'Biolysis', self: false, icon: 'st_bio' },
    chainStratagem: { name: 'Chain Stratagem', self: false, icon: 'st_chain' },
    banefulImpaction: { name: 'Baneful Impaction', self: false, icon: 'st_bio' },
    impactImminent: { name: 'Impact Imminent', self: true, icon: 'st_chain' },
    dissipation: { name: 'Dissipation', self: true, icon: 'st_dissipation' },
    recitation: { name: 'Recitation', self: true, icon: 'st_recitation' },
    swiftcast: { name: 'Swiftcast', self: true, icon: 'st_swiftcast' },
    lucidDreaming: { name: 'Lucid Dreaming', self: true, icon: 'st_lucid' },
    surecast: { name: 'Surecast', self: true, icon: 'st_surecast' },
  };

  class ScholarEW {
    constructor(version) {
      const V = VERSIONS[version];
      this.V = V;
      this.name = 'Scholar';
      this.abbr = 'SCH';
      this.role = 'healer';
      this.level = V.level || 90;
      this.levelKey = V.shb ? 'shb80' : V.level || 90;
      this.model = 'sch-sb';
      this.maxMp = 10000;
      this.actions = buildActions(V);
      if (V.shb) shbActions(this.actions, V);
      this.statuses = STATUSES;
      // Maim and Mend II: +30% to the healer's damage.
      this.stats = Object.assign({ mainStat: 'mnd', jobMod: 115, trait: 130, delay: 3.12 }, V.stats);
      this.speedName = 'Spell speed';
      this.tierHaste = 0;
      this.selfStatusOrder = ['swiftcast', 'dissipation', 'recitation', 'medicated', 'lucidDreaming', 'surecast', 'sprint'];
      this.targetStatusOrder = ['biolysis', 'banefulImpaction', 'chainStratagem'];
      if (V.level === 100) this.selfStatusOrder = ['impactImminent'].concat(this.selfStatusOrder);
      this.defaultBars = [
        ['broil4', 'biolysis', 'ruin2', 'artOfWar2', 'energyDrain', 'aetherflow', 'chainStratagem', 'dissipation', 'lucidDreaming', 'swiftcast', 'tincture', 'recitation'],
        ['physick', 'adloquium', 'succor', 'lustrate', 'indomitability', 'excogitation', 'sacredSoil', 'deploymentTactics', 'expedient', 'protraction', 'summonSeraph', 'surecast'],
        ['rescue', 'sprint', null, null, null, null, null, null, null, null, null, null],
      ];
      this.actionGroups = [
        ['Scholar', ['broil4', 'biolysis', 'ruin2', 'artOfWar2', 'energyDrain', 'aetherflow', 'dissipation', 'chainStratagem', 'physick', 'adloquium', 'succor',
          'lustrate', 'indomitability', 'excogitation', 'sacredSoil', 'recitation', 'deploymentTactics', 'expedient', 'protraction', 'summonSeraph']],
        ['Role Actions', ['swiftcast', 'lucidDreaming', 'surecast', 'rescue']],
        ['General', ['sprint', 'tincture']],
      ];
      if (V.level === 100) {
        this.defaultBars[2][2] = 'banefulImpaction'; this.defaultBars[2][3] = 'seraphism';
        this.actionGroups[0][1] = this.actionGroups[0][1].concat(['banefulImpaction', 'seraphism']);
      }
      if (V.shb) {
        const A = this.actions;
        this.defaultBars = this.defaultBars.map(r => r.map(x => (x && A[x] ? x : null)));
        this.actionGroups = this.actionGroups.map(([n, ids]) => [n, ids.filter(x => A[x])]);
      }
      this.referenceDps = V.ref;
      this.referenceGcd = V.shb ? (V.ed === 100 ? 2.32 : 2.4) : 2.4;
      this.startDistance = 10;
    }

    initGauge() { return { flow: 0 }; }
    resolveId(id) { return id; }

    check(id, e) {
      const a = this.actions[id], g = e.g;
      if (a.flow && g.flow < 1 && !(e.has('recitation') && (id === 'indomitability' || id === 'excogitation'))) return 'Unable to execute action. No Aetherflow.';
      if ((id === 'aetherflow' || id === 'dissipation') && !e.inCombat) return 'Unable to execute action while not in combat.';
      if (id === 'banefulImpaction' && !e.has('impactImminent')) return 'Unable to execute action. Impact Imminent required.';
      return null;
    }

    castTime(id, e) {
      const a = this.actions[id];
      if (!a.cast) return 0;
      if (e.has('swiftcast')) return 0;
      return e.speedScale(a.cast, 0);
    }
    consumeInstant(id, e) { if (this.actions[id].cast && e.has('swiftcast')) e.removeStatus('swiftcast'); }
    mpCost(id) { return this.actions[id].mp || 0; }
    mpRegen() { if (this.V.shb) return 200 + Math.floor(150 * (this.stats.piety - 340) / 3300); return this.level === 100 ? 200 + Math.floor(150 * (this.stats.piety - 440) / 2780) : 200 + Math.floor(150 * (this.stats.piety - 390) / 1900); }
    lucidGain() { return this.V.shb ? 500 : B.LUCID_REGEN; }

    snapshot(a, e) {
      const main = this.stats.main + (e.has('medicated') ? B.TINCTURES[this.V.tincture].cap : 0);
      return { mult: 1, main, critAdd: e.tHas('chainStratagem') ? 0.10 : 0 };
    }

    resolve(id, e) {
      const a = this.actions[id], g = e.g;
      if (a.kind === 'gcd') e.mp -= this.mpCost(id);
      if (a.flow && !(e.has('recitation') && (id === 'indomitability' || id === 'excogitation'))) g.flow--;
      switch (id) {
        case 'aetherflow': g.flow = 3; e.mp = Math.min(e.maxMp, e.mp + (this.V.shb ? 1000 : 2000)); break;
        case 'dissipation': g.flow = 3; e.addStatus('dissipation', 30); break;
        case 'chainStratagem': e.addTStatus('chainStratagem', this.V.chainDur || 15); if (this.level === 100) e.addStatus('impactImminent', 30); break;
        case 'banefulImpaction': e.removeStatus('impactImminent'); break;
        case 'recitation': e.addStatus('recitation', 15); break;
        case 'swiftcast': e.addStatus('swiftcast', 10); break;
        default:
          if (B.ROLE_EFFECTS[id]) B.ROLE_EFFECTS[id](e);
      }
      if (a.potency) e.queueHit(id, a.potency, this.snapshot(a, e), a.delay);
      if (a.dot) {
        const snap = this.snapshot(a, e);
        e.addTStatus(id, a.dot.duration, { snap, dot: { potency: a.dot.potency, id } });
      }
    }

    proc(id, e) {
      if (id === 'energyDrain') return e.g.flow > 0;
      return false;
    }

    mpInfo() { return ''; }
    speedInfo(e) { return `GCD ${e.gcdForSpeed(e.stats.speed).toFixed(2)} · ${this.actions.broil4.name} ${e.speedScale(this.actions.broil4.cast, 0).toFixed(2)}s cast`; }

    gaugeBuild(root) {
      root.innerHTML = `
<svg width="360" height="80" viewBox="0 0 360 80">
  <rect x="8" y="10" width="344" height="60" rx="14" fill="rgba(14,12,20,.86)" stroke="rgba(255,255,255,.22)"/>
  <text x="24" y="45" font-family="Noto Sans, sans-serif" font-size="11" font-weight="600" fill="#a9a3b4" letter-spacing="1">AETHERFLOW</text>
  ${[0, 1, 2].map(k => `<path id="sc-f${k}" d="M0 -12 L9 0 L0 12 L-9 0 Z" transform="translate(${150 + k * 28} 40)" fill="#1d2a2a" stroke="rgba(255,255,255,.3)" stroke-width="1.5"/>`).join('')}
  <text id="sc-d" x="336" y="45" text-anchor="end" font-family="Noto Sans, sans-serif" font-size="12" font-weight="600" fill="#9fe0ff"></text>
</svg>`;
      const $ = (s) => root.querySelector(s);
      this.scg = { f: [0, 1, 2].map(k => $('#sc-f' + k)), d: $('#sc-d'), cache: {} };
    }

    gaugeUpdate(e) {
      const G = this.scg, c = G.cache, g = e.g;
      const put = (k, v, fn) => { if (c[k] !== v) { c[k] = v; fn(v); } };
      for (let i = 0; i < 3; i++) put('f' + i, g.flow > i, v => G.f[i].setAttribute('fill', v ? '#7fd0ff' : '#1d2a2a'));
      put('d', e.has('dissipation'), v => { G.d.textContent = v ? 'DISSIPATION' : ''; });
    }

    helpHtml(seq) {
      const V = this.V;
      if (V.shb) return `
<h3>How it plays (${V.label})</h3>
<p>Level 80 Scholar on a dummy. Fill with <b>Broil III</b> (${V.broil}, a 2.5s cast, so a weave fits after each) and keep <b>Biolysis</b> up (${V.bio} × 30s); <b>Ruin II</b> (200) only to move. Every spell costs 400 MP: <b>Aetherflow</b> (60s) gives three stacks and 10% MP, and Lucid Dreaming does the rest.${V.ed ? ` Spend the stacks, and Dissipation's three (180s), on <b>Energy Drain</b> (${V.ed}, a 3s recast) when nothing needs healing.` : ' In 5.0–5.01 Scholar had no Energy Drain: Aetherflow and Dissipation stacks only buy heals (Lustrate, Indomitability, Excogitation, Sacred Soil).'} <b>Chain Stratagem</b> (120s) raises the target's critical hit rate by 10% for 15s.</p>
<h3>An opener</h3>
${seq(V.ed ? [['tincture'], 'broil4', 'biolysis', ['aetherflow'], 'broil4', ['chainStratagem'], 'broil4', ['energyDrain'], 'broil4', ['energyDrain'], 'broil4', ['energyDrain'], 'broil4', ['dissipation'], 'broil4', ['energyDrain'], 'broil4', ['energyDrain'], 'broil4', ['energyDrain'], 'broil4']
    : [['tincture'], 'broil4', 'biolysis', ['aetherflow'], 'broil4', ['chainStratagem'], 'broil4', 'broil4', 'broil4', ['lucidDreaming'], 'broil4', 'broil4'])}
<p>The tincture at −3s and Broil III at −2.5s.</p>
<p style="color:#a9a3b4">${V.label} numbers: Broil III ${V.broil}, Biolysis ${V.bio} × 30s, Ruin II 200, Art of War ${V.aow}${V.ed ? `, Energy Drain ${V.ed}` : ''}, Chain Stratagem +10% crit for 15s; Maim and Mend II +30%. MP: 200 + Piety's share a tick, Lucid Dreaming 500. Gear: ${V.gear}.</p>`;
      return `
<h3>How it plays (${V.label})</h3>
<p>Level 90 Scholar on a dummy. Fill with <b>Broil IV</b> (295, a 1.5s cast) and keep <b>Biolysis</b> up (70 × 30s); <b>Ruin II</b> (220) only to move. <b>Aetherflow</b> (60s) gives three stacks and 20% MP, <b>Dissipation</b> (180s) three more: spend them on <b>Energy Drain</b> (100) when there's nothing to heal. <b>Chain Stratagem</b> (120s) raises the target's critical hit rate by 10% for 15s, so fit Energy Drains in it. The faerie heals but does no damage.</p>
<h3>The opener (The Balance, "No Swift")</h3>
${seq([['tincture'], 'broil4', 'biolysis', ['aetherflow'], 'broil4', 'broil4', ['chainStratagem'], 'broil4', ['energyDrain'], 'broil4', ['energyDrain'], 'broil4', ['energyDrain'], 'broil4', ['dissipation'], 'broil4', ['energyDrain'], 'broil4', ['energyDrain'], 'broil4'])}
<p>The tincture at −3s and Broil IV at −1.5s; summon the faerie before the pull.</p>
<p style="color:#a9a3b4">${V.label} numbers: Broil IV 295, Biolysis 70 × 30s, Ruin II 220, Art of War II 180, Energy Drain 100, Chain Stratagem +10% crit for 15s; Maim and Mend II +30%. Expedience ${V.expedience}s${V.selene ? ', Selene still there' : ''}. Gear: The Balance's set (Mind ${V.stats.main.toLocaleString()}).</p>`;
    }
  }

  B.registerJob({
    id: 'sch', name: 'Scholar', abbr: 'SCH', role: 'healer', classJob: 28,
    versions: ['dt70', 'ew61', 'ew60', 'shb51', 'shb505', 'shb50'].map(v => ({ id: v, label: VERSIONS[v].label, history: VERSIONS[v].history, note: VERSIONS[v].note, create: () => new ScholarEW(v) })),
  });
})(window.BLM);
