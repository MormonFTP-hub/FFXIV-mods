// Reaper, Dawntrail at level 100, in two versions. Slice → Waxing Slice → Infernal Slice and Soul Slice build Soul;
// Blood Stalk (or the Unveiled actions) spends 50 for Soul Reaver, which Gibbet (flank) and Gallows (rear) use, each
// enhancing the other; Gluttony gives two Executioner's Gibbet/Gallows. Those build Shroud for Enshroud: five Lemure
// Shroud for Void and Cross Reaping, Lemure's Slice, Sacrificium (Oblatio) and Communio. Shadow of Death keeps Death's
// Design up (+10% to all your damage on the target). Arcane Circle (+3%, 120s) leads to Plentiful Harvest, which
// readies a free Enshroud and Perfectio after the next Communio.
//  - 7.0–7.25: Enshroud on a 15s recast; the 7.2 numbers (Void/Cross 540, enhanced 600; Sacrificium 600; Gluttony 520).
//  - 7.3–7.57: Enshroud on a 5s recast; the 7.5 numbers (Void/Cross 580 / 640, Sacrificium 700, Gluttony 560).
// Numbers are the game data per patch (xivapi), the wiki histories and the Lodestone notes; gear is The Balance's set
// for the 7.2 and 7.4 tiers. ref: a scripted bot parses about 30,500 / 38,700 on these.
(function (B) {
  const ws = (o) => Object.assign({ kind: 'gcd', target: true, range: B.MELEE_RANGE, delay: 0.6, fx: 'gnbSlash' }, o);
  const ab = (o) => Object.assign({ kind: 'ogcd', recast: 1, target: true, range: B.MELEE_RANGE, delay: 0.6, fx: 'gnbCont' }, o);
  const VERSIONS = {
    dt70: { label: 'Dawntrail 7.0–7.25', history: 'DT 7.0–7.25', reaping: [540, 600], sacrificium: 600, gluttony: 520, grim: 200, enshroudRecast: 15,
      tincture: 'strdt3', ref: 32300, stats: { hp: 120000, main: 5642, wd: 152, det: 2308, crit: 3425, dh: 1942, speed: 474 },
      note: 'Level 100: Executioner from Gluttony, Oblatio and Sacrificium, Perfectio after Plentiful Harvest; Enshroud on 15s; the 7.2 numbers and Cruiserweight gear' },
    dt73: { label: 'Dawntrail 7.3–7.57', history: 'DT 7.3–7.57', reaping: [580, 640], sacrificium: 700, gluttony: 560, grim: 220, enshroudRecast: 5,
      tincture: 'strdt4', ref: 41000, stats: { hp: 135000, main: 6516, wd: 158, det: 2506, crit: 3605, dh: 1928, speed: 474 },
      note: 'Level 100: Enshroud on a 5s recast, Void/Cross Reaping 580, Sacrificium 700, Gluttony 560 (7.45–7.5); Heavyweight gear' },
  };

  function buildActions(V) {
    return {
      slice: ws({ name: 'Slice', potency: 420, comboStart: true, comboNext: true, soul: 10, desc: 'Delivers an attack with a potency of 420.\nAdditional Effect: Increases Soul Gauge by 10' }),
      waxingSlice: ws({ name: 'Waxing Slice', potency: 260, comboPotency: 500, comboFrom: 'slice', comboNext: true, soul: 10, fx: 'gnbSlash2', desc: 'Delivers an attack with a potency of 260.\nCombo Action: Slice\nCombo Potency: 500\nCombo Bonus: Increases Soul Gauge by 10' }),
      infernalSlice: ws({ name: 'Infernal Slice', potency: 280, comboPotency: 600, comboFrom: 'waxingSlice', soul: 10, fx: 'gnbBurst', desc: 'Delivers an attack with a potency of 280.\nCombo Action: Waxing Slice\nCombo Potency: 600\nCombo Bonus: Increases Soul Gauge by 10' }),
      shadowOfDeath: ws({ name: 'Shadow of Death', potency: 300, design: true, fx: 'gnbSlash2', desc: 'Delivers an attack with a potency of 300.\nAdditional Effect: Afflicts target with Death\'s Design, increasing damage you deal target by 10%\nDuration: 30s\nExtends duration of Death\'s Design by 30s to a maximum of 60s.' }),
      soulSlice: ws({ name: 'Soul Slice', potency: 520, cd: 30, charges: 2, soulGain: 50, fx: 'gnbFang', desc: 'Delivers an attack with a potency of 520.\nAdditional Effect: Increases Soul Gauge by 50\nMaximum Charges: 2' }),
      gibbet: ws({ name: 'Gibbet', potency: 500, enhanced: 560, positional: 'flank', posBonus: 60, reaver: true, buff: 'enhancedGibbet', grants: 'enhancedGallows', fx: 'gnbFang2', desc: 'Delivers an attack with a potency of 500.\n560 when executed from a target\'s flank.\nEnhanced Gibbet Potency: 560 (620 from the flank)\nAdditional Effect: Grants Enhanced Gallows\nAdditional Effect: Increases Shroud Gauge by 10\nCan only be executed while under the effect of Soul Reaver.' }),
      gallows: ws({ name: 'Gallows', potency: 500, enhanced: 560, positional: 'rear', posBonus: 60, reaver: true, buff: 'enhancedGallows', grants: 'enhancedGibbet', fx: 'gnbFang3', desc: 'Delivers an attack with a potency of 500.\n560 when executed from a target\'s rear.\nEnhanced Gallows Potency: 560 (620 from the rear)\nAdditional Effect: Grants Enhanced Gibbet\nAdditional Effect: Increases Shroud Gauge by 10\nCan only be executed while under the effect of Soul Reaver.' }),
      executionersGibbet: ws({ name: 'Executioner\'s Gibbet', potency: 700, enhanced: 760, positional: 'flank', posBonus: 60, executioner: true, buff: 'enhancedGibbet', grants: 'enhancedGallows', fx: 'gnbDouble', desc: 'Delivers an attack with a potency of 700.\n760 from the flank; Enhanced Gibbet Potency: 760 (820 from the flank)\nAdditional Effect: Grants Enhanced Gallows\nAdditional Effect: Increases Shroud Gauge by 10\nCan only be executed while under the effect of Executioner.' }),
      executionersGallows: ws({ name: 'Executioner\'s Gallows', potency: 700, enhanced: 760, positional: 'rear', posBonus: 60, executioner: true, buff: 'enhancedGallows', grants: 'enhancedGibbet', fx: 'gnbDouble', desc: 'Delivers an attack with a potency of 700.\n760 from the rear; Enhanced Gallows Potency: 760 (820 from the rear)\nAdditional Effect: Grants Enhanced Gibbet\nAdditional Effect: Increases Shroud Gauge by 10\nCan only be executed while under the effect of Executioner.' }),
      voidReaping: ws({ name: 'Void Reaping', potency: V.reaping[0], enhanced: V.reaping[1], recast: 1.5, lemure: true, buff: 'enhancedVoidReaping', grants: 'enhancedCrossReaping', fx: 'gnbZone', desc: `Delivers an attack with a potency of ${V.reaping[0]}.\nEnhanced Void Reaping Potency: ${V.reaping[1]}\nAdditional Effect: Grants Enhanced Cross Reaping\nLemure Shroud Cost: 1\nAdditional Effect: Void Shroud +1\nCan only be executed while Enshrouded. Recast 1.5s.` }),
      crossReaping: ws({ name: 'Cross Reaping', potency: V.reaping[0], enhanced: V.reaping[1], recast: 1.5, lemure: true, buff: 'enhancedCrossReaping', grants: 'enhancedVoidReaping', fx: 'gnbZone', desc: `Delivers an attack with a potency of ${V.reaping[0]}.\nEnhanced Cross Reaping Potency: ${V.reaping[1]}\nAdditional Effect: Grants Enhanced Void Reaping\nLemure Shroud Cost: 1\nAdditional Effect: Void Shroud +1\nCan only be executed while Enshrouded. Recast 1.5s.` }),
      communio: ws({ name: 'Communio', potency: 1100, cast: 1.3, aoe: 0.4, range: 25, fx: 'gnbDouble', desc: 'Deals unaspected damage with a potency of 1,100 to target and all enemies nearby it, 60% less for the rest.\nCan only be executed while Enshrouded with at least one Lemure Shroud. Ends Enshroud.\nGrants Perfectio Parata if Perfectio Occulta is up.' }),
      perfectio: ws({ name: 'Perfectio', potency: 1300, aoe: 0.4, range: 25, fx: 'gnbDouble', desc: 'Deals unaspected damage with a potency of 1,300 to target and all enemies nearby it, 60% less for the rest.\nCan only be executed while under the effect of Perfectio Parata.' }),
      plentifulHarvest: ws({ name: 'Plentiful Harvest', potency: 720, aoe: 0.4, range: 15, fx: 'gnbZone', desc: 'Delivers an attack with a potency of 720 (+40 per Immortal Sacrifice stack after the first, up to 1,000) to target and all enemies nearby it, 60% less for the rest.\nAdditional Effect: Grants Ideal Host and Perfectio Occulta\nDuration: 30s\nCan only be executed while under the effect of Immortal Sacrifice, after Bloodsown Circle ends.' }),
      harvestMoon: ws({ name: 'Harvest Moon', potency: 800, range: 25, aoe: 0.5, fx: 'gnbZone', desc: 'Delivers an attack with a potency of 800 to target and all enemies nearby it.\nAdditional Effect: Increases Soul Gauge by 10\nCan only be executed while under the effect of Soulsow.' }),
      soulsow: ws({ name: 'Soulsow', potency: 0, cast: 5, target: false, desc: 'Grants Soulsow, readying Harvest Moon.\nCast instantly out of combat (5s in combat).' }),
      harpe: ws({ name: 'Harpe', potency: 300, cast: 1.3, range: 25, soul: 10, fx: 'gnbShot', desc: 'Deals unaspected damage with a potency of 300.\nAdditional Effect: Increases Soul Gauge by 10' }),
      spinningScythe: ws({ name: 'Spinning Scythe', potency: 140, comboStart: true, comboNext: true, soul: 10, target: false, pbaoe: 5, aoe: true, desc: 'Delivers an attack with a potency of 140 to all nearby enemies.\nAdditional Effect: Increases Soul Gauge by 10' }),
      nightmareScythe: ws({ name: 'Nightmare Scythe', potency: 120, comboPotency: 180, comboFrom: 'spinningScythe', soul: 10, target: false, pbaoe: 5, aoe: true, desc: 'Delivers an attack with a potency of 120 to all nearby enemies.\nCombo Action: Spinning Scythe\nCombo Potency: 180\nCombo Bonus: Increases Soul Gauge by 10' }),
      whorlOfDeath: ws({ name: 'Whorl of Death', potency: 100, design: true, target: false, pbaoe: 5, aoe: true, desc: 'Delivers an attack with a potency of 100 to all nearby enemies.\nAdditional Effect: Afflicts targets with Death\'s Design' }),
      guillotine: ws({ name: 'Guillotine', potency: 200, reaver: true, range: 8, aoe: true, desc: 'Delivers an attack in a cone before you with a potency of 200.\nAdditional Effect: Increases Shroud Gauge by 10\nCan only be executed while under the effect of Soul Reaver.' }),
      executionersGuillotine: ws({ name: 'Executioner\'s Guillotine', potency: 260, executioner: true, range: 8, aoe: true, desc: 'Delivers an attack in a cone before you with a potency of 260.\nAdditional Effect: Increases Shroud Gauge by 10\nCan only be executed while under the effect of Executioner.' }),
      grimReaping: ws({ name: 'Grim Reaping', potency: V.grim, recast: 1.5, lemure: true, range: 8, aoe: true, desc: `Delivers an attack in a cone before you with a potency of ${V.grim}.\nLemure Shroud Cost: 1\nAdditional Effect: Void Shroud +1\nCan only be executed while Enshrouded.` }),
      bloodStalk: ab({ name: 'Blood Stalk', potency: 340, cost: 50, desc: 'Delivers an attack with a potency of 340.\nAdditional Effect: Grants Soul Reaver\nDuration: 30s\nSoul Gauge Cost: 50\nBecomes Unveiled Gibbet or Gallows under Enhanced Gibbet or Gallows.' }),
      unveiledGibbet: ab({ name: 'Unveiled Gibbet', potency: 440, cost: 50, needs: 'enhancedGibbet', desc: 'Delivers an attack with a potency of 440.\nAdditional Effect: Grants Soul Reaver\nSoul Gauge Cost: 50\nCan only be executed while under the effect of Enhanced Gibbet.' }),
      unveiledGallows: ab({ name: 'Unveiled Gallows', potency: 440, cost: 50, needs: 'enhancedGallows', desc: 'Delivers an attack with a potency of 440.\nAdditional Effect: Grants Soul Reaver\nSoul Gauge Cost: 50\nCan only be executed while under the effect of Enhanced Gallows.' }),
      grimSwathe: ab({ name: 'Grim Swathe', potency: 140, cost: 50, target: false, range: 8, aoe: true, desc: 'Delivers an attack in a cone before you with a potency of 140.\nAdditional Effect: Grants Soul Reaver\nSoul Gauge Cost: 50' }),
      gluttony: ab({ name: 'Gluttony', recast: 60, potency: V.gluttony, cost: 50, aoe: 0.25, range: 25, fx: 'gnbZone', desc: `Delivers an attack with a potency of ${V.gluttony} to target and all enemies nearby it.\nAdditional Effect: Grants 2 stacks of Executioner\nDuration: 30s\nSoul Gauge Cost: 50` }),
      enshroud: ab({ name: 'Enshroud', recast: V.enshroudRecast, target: false, desc: `Grants Enshrouded and 5 stacks of Lemure Shroud, and Oblatio.\nDuration: 30s\nShroud Gauge Cost: 50 (none with Ideal Host)\nRecast: ${V.enshroudRecast}s\nWhile Enshrouded, Gibbet and Gallows become Void and Cross Reaping, Blood Stalk Lemure's Slice, Gluttony Sacrificium and Enshroud Communio.` }),
      lemuresSlice: ab({ name: 'Lemure\'s Slice', potency: 280, fx: 'gnbCont', desc: 'Delivers an attack with a potency of 280.\nVoid Shroud Cost: 2' }),
      sacrificium: ab({ name: 'Sacrificium', potency: V.sacrificium, aoe: 0.4, range: 25, fx: 'gnbZone', desc: `Deals unaspected damage with a potency of ${V.sacrificium} to target and all enemies nearby it, 60% less for the rest.\nCan only be executed while Enshrouded and under the effect of Oblatio.` }),
      arcaneCircle: ab({ name: 'Arcane Circle', recast: 120, target: false, desc: 'Increases damage dealt by you and nearby party members by 3%.\nDuration: 20s\nAdditional Effect: Grants Immortal Sacrifice for Plentiful Harvest (one stack alone on a dummy)' }),
      arcaneCrest: ab({ name: 'Arcane Crest', recast: 30, target: false, desc: 'Grants a barrier that nullifies damage equal to 10% of maximum HP.\nDuration: 5s' }),
      hellsIngress: ab({ name: 'Hell\'s Ingress', recast: 20, target: false, desc: 'Dash 15 yalms forward.' }),
      ...B.ROLE_ACTIONS.melee,
      ...B.GENERAL_ACTIONS,
      tincture: B.tincture(V.tincture),
      auto: { name: 'Attack', kind: 'auto', fx: 'auto', desc: 'Auto-attack.' },
    };
  }

  const st = (name, icon, self = true) => ({ name, self, icon });
  const STATUSES = {
    soulReaver: st('Soul Reaver', 'st_reaver'), executioner: st('Executioner', 'st_exec'), enshrouded: st('Enshrouded', 'st_shroud'),
    enhancedGibbet: st('Enhanced Gibbet', 'st_enh'), enhancedGallows: st('Enhanced Gallows', 'st_enh'),
    enhancedVoidReaping: st('Enhanced Void Reaping', 'st_enh'), enhancedCrossReaping: st('Enhanced Cross Reaping', 'st_enh'),
    oblatio: st('Oblatio', 'st_oblatio'), arcaneCircle: st('Arcane Circle', 'st_circle'), bloodsownCircle: st('Bloodsown Circle', 'st_circle'),
    immortalSacrifice: st('Immortal Sacrifice', 'st_sacrifice'), idealHost: st('Ideal Host', 'st_host'), perfectioOcculta: st('Perfectio Occulta', 'st_perf'),
    perfectioParata: st('Perfectio Parata', 'st_perf'), soulsow: st('Soulsow', 'st_soulsow'), arcaneCrest: st('Arcane Crest', 'st_crest'),
    deathsDesign: st('Death\'s Design', 'st_design', false),
  };

  class ReaperDT {
    constructor(version) {
      const V = VERSIONS[version];
      this.V = V;
      this.name = 'Reaper';
      this.abbr = 'RPR';
      this.role = 'melee';
      this.level = 100;
      this.levelKey = 100;
      this.model = 'rpr-dt';
      this.actions = buildActions(V);
      this.statuses = STATUSES;
      this.stats = Object.assign({ mainStat: 'str', jobMod: 115, trait: 100, delay: 3.2 }, V.stats);
      this.speedName = 'Skill speed';
      this.tierHaste = 0;
      this.autoAttack = { potency: 90, delay: 3.2, range: B.MELEE_RANGE };
      this.selfStatusOrder = ['enshrouded', 'soulReaver', 'executioner', 'enhancedGibbet', 'enhancedGallows', 'enhancedVoidReaping', 'enhancedCrossReaping', 'oblatio',
        'arcaneCircle', 'bloodsownCircle', 'immortalSacrifice', 'idealHost', 'perfectioOcculta', 'perfectioParata', 'soulsow', 'medicated', 'arcaneCrest',
        'trueNorth', 'bloodbath', 'armsLength', 'sprint'];
      this.targetStatusOrder = ['deathsDesign', 'feint'];
      this.defaultBars = [
        ['slice', 'waxingSlice', 'infernalSlice', 'shadowOfDeath', 'soulSlice', 'gibbet', 'gallows', 'bloodStalk', 'gluttony', 'enshroud', 'arcaneCircle', 'plentifulHarvest'],
        ['perfectio', 'harvestMoon', 'soulsow', 'harpe', 'tincture', 'trueNorth', 'arcaneCrest', 'hellsIngress', 'secondWind', 'bloodbath', 'feint', 'legSweep'],
        ['spinningScythe', 'nightmareScythe', 'whorlOfDeath', 'guillotine', 'grimSwathe', 'armsLength', 'sprint', null, null, null, null, null],
      ];
      this.actionGroups = [
        ['Reaper', ['slice', 'waxingSlice', 'infernalSlice', 'shadowOfDeath', 'soulSlice', 'gibbet', 'gallows', 'executionersGibbet', 'executionersGallows', 'bloodStalk',
          'unveiledGibbet', 'unveiledGallows', 'gluttony', 'enshroud', 'voidReaping', 'crossReaping', 'lemuresSlice', 'sacrificium', 'communio', 'perfectio',
          'arcaneCircle', 'plentifulHarvest', 'soulsow', 'harvestMoon', 'harpe', 'arcaneCrest', 'hellsIngress']],
        ['AoE', ['spinningScythe', 'nightmareScythe', 'whorlOfDeath', 'guillotine', 'executionersGuillotine', 'grimSwathe', 'grimReaping']],
        ['Role Actions', ['trueNorth', 'secondWind', 'legSweep', 'bloodbath', 'feint', 'armsLength']],
        ['General', ['sprint', 'tincture']],
      ];
      this.referenceDps = V.ref;
      this.referenceGcd = 2.49;
      this.startDistance = 3.2;
    }

    initGauge() { return { soul: 0, shroud: 0, lemure: 0, void: 0 }; }

    // Buttons that change: Gibbet/Gallows into the Executioner's or Reaping versions, Blood Stalk into Unveiled or
    // Lemure's Slice, Gluttony into Sacrificium, Enshroud into Communio, Guillotine into its Executioner/Grim versions.
    resolveId(id, e) {
      const shroud = e.has('enshrouded');
      if (id === 'gibbet') return shroud ? 'voidReaping' : e.has('executioner') ? 'executionersGibbet' : id;
      if (id === 'gallows') return shroud ? 'crossReaping' : e.has('executioner') ? 'executionersGallows' : id;
      if (id === 'guillotine') return shroud ? 'grimReaping' : e.has('executioner') ? 'executionersGuillotine' : id;
      if (id === 'bloodStalk') return shroud ? 'lemuresSlice' : e.has('enhancedGibbet') ? 'unveiledGibbet' : e.has('enhancedGallows') ? 'unveiledGallows' : id;
      if (id === 'gluttony' && shroud) return 'sacrificium';
      if (id === 'enshroud' && shroud) return 'communio';
      if (id === 'soulsow' && e.has('soulsow')) return 'harvestMoon';
      return id;
    }

    check(id, e) {
      const a = this.actions[id], g = e.g;
      if (a.reaver && !e.has('soulReaver')) return 'Unable to execute action. Soul Reaver required.';
      if (a.executioner && !e.has('executioner')) return 'Unable to execute action. Executioner required.';
      if (a.lemure && !(e.has('enshrouded') && g.lemure > 0)) return 'Unable to execute action. Enshrouded required.';
      if (a.needs && !e.has(a.needs)) return 'Unable to execute action.';
      if (a.cost && !e.has('enshrouded') && g.soul < a.cost) return 'Not enough Soul Gauge.';
      if ((a.cost || id === 'soulSlice') && (e.has('soulReaver') || e.has('executioner'))) return 'Unable to execute action while under the effect of Soul Reaver.';
      if (id === 'enshroud' && (g.shroud < 50 && !e.has('idealHost'))) return 'Not enough Shroud Gauge.';
      if (id === 'communio' && !(e.has('enshrouded') && g.lemure > 0)) return 'Unable to execute action.';
      if (id === 'lemuresSlice' && g.void < 2) return 'Unable to execute action. Void Shroud required.';
      if (id === 'sacrificium' && !(e.has('enshrouded') && e.has('oblatio'))) return 'Unable to execute action. Oblatio required.';
      if (id === 'perfectio' && !e.has('perfectioParata')) return 'Unable to execute action. Perfectio Parata required.';
      if (id === 'plentifulHarvest' && (!e.has('immortalSacrifice') || e.has('bloodsownCircle'))) return 'Unable to execute action.';
      if (id === 'harvestMoon' && !e.has('soulsow')) return 'Unable to execute action. Soulsow required.';
      return null;
    }

    castTime(id, e) {
      const a = this.actions[id];
      if (!a.cast) return 0;
      if (id === 'soulsow' && !e.inCombat) return 0;
      return e.speedScale(a.cast, 0);
    }

    snapshot(a, e) {
      let mult = 1;
      if (e.tHas('deathsDesign')) mult *= 1.10;
      if (e.has('arcaneCircle')) mult *= 1.03;
      const main = this.stats.main + (e.has('medicated') ? B.TINCTURES[this.V.tincture].cap : 0);
      return { mult, main };
    }

    soul(e, n) { e.g.soul = Math.max(0, Math.min(100, e.g.soul + n)); }
    shroud(e, n) { e.g.shroud = Math.max(0, Math.min(100, e.g.shroud + n)); }
    endShroud(e) { e.removeStatus('enshrouded'); e.removeStatus('oblatio'); e.g.lemure = 0; e.g.void = 0; }

    resolve(id, e) {
      const a = this.actions[id], g = e.g;
      let potency = a.potency || 0;
      const opts = {};
      if (a.comboFrom && e.lastComboHit) potency = a.comboPotency;
      if (a.soul && (!a.comboFrom || e.lastComboHit)) this.soul(e, a.soul);
      if (a.soulGain) this.soul(e, a.soulGain);
      if (a.cost && !e.has('enshrouded')) this.soul(e, -a.cost);
      if (a.design) {
        const left = e.tHas('deathsDesign') ? e.tStatuses.deathsDesign.until - e.now : 0;
        e.addTStatus('deathsDesign', Math.min(60, left + 30));
      }
      if (a.buff && e.has(a.buff)) { potency = a.enhanced; e.removeStatus(a.buff, true); }
      if (a.grants) {
        for (const k of ['enhancedGibbet', 'enhancedGallows', 'enhancedVoidReaping', 'enhancedCrossReaping']) if (k !== a.grants) e.removeStatus(k, true);
        e.addStatus(a.grants, a.lemure ? 30 : 60);
      }
      if (a.positional) { const pos = e.positionalHit(a); if (pos) potency += a.posBonus; opts.positional = pos ? 'hit' : 'miss'; }
      if (a.reaver) { const s = e.statuses.soulReaver; s.stacks = (s.stacks || 1) - 1; if (s.stacks <= 0) e.removeStatus('soulReaver'); this.shroud(e, 10); }
      if (a.executioner) { const s = e.statuses.executioner; s.stacks = (s.stacks || 1) - 1; if (s.stacks <= 0) e.removeStatus('executioner'); else e.emit('statusStack', { key: 'executioner' }); this.shroud(e, 10); }
      if (a.lemure) { g.lemure--; g.void++; }

      switch (id) {
        case 'bloodStalk': case 'unveiledGibbet': case 'unveiledGallows': case 'grimSwathe': e.addStatus('soulReaver', 30, { stacks: 1 }); break;
        case 'gluttony': e.addStatus('executioner', 30, { stacks: 2 }); break;
        case 'enshroud':
          if (e.has('idealHost')) e.removeStatus('idealHost'); else this.shroud(e, -50);
          e.removeStatus('perfectioParata');
          g.lemure = 5; g.void = 0;
          e.addStatus('enshrouded', 30); e.addStatus('oblatio', 30);
          break;
        case 'lemuresSlice': g.void -= 2; break;
        case 'sacrificium': e.removeStatus('oblatio'); break;
        case 'communio':
          this.endShroud(e);
          if (e.has('perfectioOcculta')) { e.removeStatus('perfectioOcculta'); e.addStatus('perfectioParata', 30); }
          break;
        case 'perfectio': e.removeStatus('perfectioParata'); break;
        case 'arcaneCircle':
          e.addStatus('arcaneCircle', 20); e.addStatus('bloodsownCircle', 6); e.addStatus('immortalSacrifice', 30, { stacks: 1 });
          break;
        case 'plentifulHarvest':
          e.removeStatus('immortalSacrifice'); e.addStatus('idealHost', 30); e.addStatus('perfectioOcculta', 30);
          break;
        case 'soulsow': e.addStatus('soulsow', 1e9, { permanent: true }); break;
        case 'harvestMoon': e.removeStatus('soulsow'); this.soul(e, 10); break;
        case 'arcaneCrest': e.addStatus('arcaneCrest', 5); break;
        case 'hellsIngress': {
          const d = e.distToTarget() || 1;
          if (d > 2.6) { const from = { x: e.pos.x, z: e.pos.z }; e.pos.x *= 2.4 / d; e.pos.z *= 2.4 / d; e.emit('teleport', { from, to: { x: e.pos.x, z: e.pos.z } }); }
          break;
        }
        default:
          if (B.ROLE_EFFECTS[id]) B.ROLE_EFFECTS[id](e);
      }
      if (potency) e.queueHit(id, potency, this.snapshot(a, e), a.delay, null, opts);
    }

    // Enshroud running out takes its Lemure and Void Shroud with it.
    nextEvent(e) { return e.g.lemure > 0 && e.statuses.enshrouded ? e.statuses.enshrouded.until : Infinity; }
    process(e) { if (e.g.lemure > 0 && !e.has('enshrouded')) this.endShroud(e); }

    proc(id, e) {
      const a = this.actions[id];
      if (a.comboFrom && e.inCombo(a.comboFrom)) return true;
      if (a.buff && e.has(a.buff)) return !this.check(id, e);
      if (['perfectio', 'plentifulHarvest', 'harvestMoon', 'communio', 'sacrificium', 'lemuresSlice'].includes(id)) return !this.check(id, e);
      return false;
    }

    mpRegen() { return B.BASE_REGEN; }
    speedInfo(e) { return `GCD ${e.gcdForSpeed(e.stats.speed).toFixed(2)} · Enshroud recast ${this.V.enshroudRecast}s`; }

    // ---------- the Soul and Death gauges ----------
    gaugeBuild(root) {
      root.innerHTML = `
<svg width="360" height="140" viewBox="0 0 360 140">
  <rect x="8" y="10" width="344" height="120" rx="14" fill="rgba(14,12,20,.86)" stroke="rgba(255,255,255,.22)"/>
  <text x="24" y="34" font-family="Noto Sans, sans-serif" font-size="11" font-weight="600" fill="#a9a3b4" letter-spacing="1">SOUL</text>
  <text id="rp-sn" x="336" y="36" text-anchor="end" font-family="Saira Semi Condensed, sans-serif" font-size="18" font-weight="700" fill="#fff" stroke="#000" stroke-width="3" paint-order="stroke">0</text>
  <rect x="24" y="42" width="312" height="12" rx="6" fill="#1d1a2a"/><rect id="rp-s" x="24" y="42" width="0" height="12" rx="6" fill="#d0364a"/>
  <text x="24" y="76" font-family="Noto Sans, sans-serif" font-size="11" font-weight="600" fill="#a9a3b4" letter-spacing="1">SHROUD</text>
  <text id="rp-hn" x="336" y="78" text-anchor="end" font-family="Saira Semi Condensed, sans-serif" font-size="18" font-weight="700" fill="#fff" stroke="#000" stroke-width="3" paint-order="stroke">0</text>
  <rect x="24" y="84" width="312" height="12" rx="6" fill="#1d1a2a"/><rect id="rp-h" x="24" y="84" width="0" height="12" rx="6" fill="#4ac8c0"/>
  ${[0, 1, 2, 3, 4].map(k => `<circle id="rp-l${k}" cx="${44 + k * 26}" cy="114" r="8" fill="#2a2535" stroke="rgba(0,0,0,.8)" stroke-width="1.5"/>`).join('')}
  <text id="rp-v" x="336" y="118" text-anchor="end" font-family="Noto Sans, sans-serif" font-size="12" font-weight="600" fill="#c8a8ff"></text>
</svg>`;
      const $ = (s) => root.querySelector(s);
      this.rg = { sn: $('#rp-sn'), s: $('#rp-s'), hn: $('#rp-hn'), h: $('#rp-h'), l: [0, 1, 2, 3, 4].map(k => $('#rp-l' + k)), v: $('#rp-v'), cache: {} };
    }

    gaugeUpdate(e) {
      const G = this.rg, c = G.cache, g = e.g;
      const put = (k, v, fn) => { if (c[k] !== v) { c[k] = v; fn(v); } };
      put('s', g.soul, v => { G.sn.textContent = String(v); G.s.setAttribute('width', String(312 * v / 100)); });
      put('h', g.shroud, v => { G.hn.textContent = String(v); G.h.setAttribute('width', String(312 * v / 100)); });
      for (let i = 0; i < 5; i++) put('l' + i, g.lemure > i ? 'l' : i < g.lemure + g.void ? 'v' : '', v => G.l[i].setAttribute('fill', v === 'l' ? '#4ac8c0' : v === 'v' ? '#9a5ad8' : '#2a2535'));
      put('v', g.void, v => { G.v.textContent = e.has('enshrouded') ? `VOID SHROUD ${v}` : ''; });
    }

    helpHtml(seq) {
      const V = this.V;
      return `
<h3>How it plays (${V.label})</h3>
<p>Level 100 Reaper. Keep <b>Death's Design</b> on the dummy with <b>Shadow of Death</b> (+10% to all your damage, 30s at a time up to 60s). <b>Slice → Waxing Slice → Infernal Slice</b> and <b>Soul Slice</b> (two charges) fill the Soul Gauge; at 50, <b>Blood Stalk</b> (Unveiled Gibbet / Gallows once enhanced) gives Soul Reaver for <b>Gibbet</b> (flank) or <b>Gallows</b> (rear), each enhancing the other. <b>Gluttony</b> (60s, ${V.gluttony}) gives two Executioner's Gibbet / Gallows. Each adds 10 Shroud.</p>
<p>At 50 Shroud, <b>Enshroud</b> (recast ${V.enshroudRecast}s) turns your buttons: alternate <b>Void</b> and <b>Cross Reaping</b> (${V.reaping[0]}, ${V.reaping[1]} enhanced), weave <b>Lemure's Slice</b> for each two and <b>Sacrificium</b> (${V.sacrificium}) once, and finish with <b>Communio</b> (1,100). <b>Arcane Circle</b> (+3%, 120s) leads to <b>Plentiful Harvest</b>, which makes the next Enshroud free and readies <b>Perfectio</b> (1,300) after its Communio. Keep <b>Soulsow</b> up for Harvest Moon (800) when you can't reach the dummy.</p>
<h3>The opener (The Balance)</h3>
${seq(['harpe', 'shadowOfDeath', ['tincture'], 'soulSlice', ['arcaneCircle'], ['gluttony'], 'executionersGibbet', 'executionersGallows', 'plentifulHarvest', ['enshroud'], 'voidReaping', ['sacrificium'], 'crossReaping', ['lemuresSlice'], 'voidReaping', 'crossReaping', ['lemuresSlice'], 'communio', 'perfectio', 'soulSlice', ['unveiledGibbet'], 'gibbet', 'shadowOfDeath', 'slice'])}
<p>Soulsow before the pull, Harpe at about −1.7s.</p>
<p style="color:#a9a3b4">${V.label} numbers: Slice 420, Waxing 500, Infernal 600 in combo, Shadow of Death 300, Soul Slice 520, Gibbet / Gallows 500 (560 positional, +60 enhanced), Executioner's 700, Blood Stalk 340, Unveiled 440, Gluttony ${V.gluttony}, Void / Cross Reaping ${V.reaping.join(' / ')}, Lemure's Slice 280, Sacrificium ${V.sacrificium}, Communio 1,100, Perfectio 1,300, Plentiful Harvest 720 (one Immortal Sacrifice stack alone), Harvest Moon 800; auto-attacks 90 at 3.20s. Gear: The Balance's set for the tier (Strength ${V.stats.main.toLocaleString()}, without the party bonus).</p>`;
    }
  }

  B.ReaperDT = ReaperDT;
  B.registerJob({
    id: 'rpr', name: 'Reaper', abbr: 'RPR', role: 'melee', classJob: 39,
    versions: ['dt73', 'dt70'].map(v => ({ id: v, label: VERSIONS[v].label, history: VERSIONS[v].history, note: VERSIONS[v].note, create: () => new ReaperDT(v) })),
  });
})(window.BLM);
