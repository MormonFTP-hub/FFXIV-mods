// Viper, Dawntrail (patches 7.05–7.57) at level 100, after 7.05's rework (Noxious Gnash gone). The dual-wield combo
// on two buttons: Steel or Reaving Fangs (300 with its Honed buff, and each grants the other's), then Hunter's Sting
// (+10% damage, Hunter's Instinct) or Swiftskin's Sting (15% haste, Swiftscaled), then a flank or rear finisher that
// the venom cycle picks (Flanksting → Hindsting → Flanksbane → Hindsbane, +100 with its venom). Each finisher readies
// Death Rattle. Vicewinder (2 charges) opens Hunter's and Swiftskin's Coil, each with a Twinfang and a Twinblood
// Bite; Uncoiled Fury spends a Rattling Coil for its own pair. Reawaken (50 Serpent Offerings, or free after Serpent's
// Ire) gives five Anguine Tribute: First to Fourth Generation (each with its Legacy) and Ouroboros. Numbers are 7.5's
// (7.2 raised the Legacies, 7.5 Vicewinder and the Coils), from the Lodestone notes, the wiki and the game data at
// 7.57; the gear is The Balance's 7.5 savage set at 2.48 (2.10 under Swiftscaled).
(function (B) {
  const FAR = 0.25;              // Uncoiled Fury and the Reawaken actions: 75% less on the rest of the pack (7.5)
  const ws = (o) => Object.assign({ kind: 'gcd', target: true, range: B.MELEE_RANGE, delay: 0.6, recast: 2.5, fx: 'slash' }, o);
  const aoe = (o) => ws(Object.assign({ target: false, pbaoe: 5, aoe: true, fx: 'slash3' }, o));
  const og = (o) => Object.assign({ kind: 'ogcd', recast: 1, target: true, range: B.MELEE_RANGE, delay: 0.6, fx: 'slash2' }, o);
  const fin = (o) => ws(Object.assign({ potency: 340, posBonus: 60, venomBonus: 100, finisher: true, fx: 'slash3' }, o));
  const gen = (o) => ws(Object.assign({ potency: 480, seqPotency: 680, recast: 2.0, aoe: FAR, generation: true, fx: 'gnbBurst' }, o));
  const legacy = (o) => og(Object.assign({ potency: 320, aoe: FAR, fx: 'gnbCont' }, o));
  // Finishers: what they need, which venom boosts them and which they grant (the cycle).
  const VENOMS = ['flankstungVenom', 'flanksbaneVenom', 'hindstungVenom', 'hindsbaneVenom'];

  const ACTIONS = {
    steelFangs: ws({ name: 'Steel Fangs', potency: 200, honed: 'honedSteel', grants: 'honedReavers', desc: 'Delivers an attack with a potency of 200.\nHoned Steel Potency: 300\nAdditional Effect: Grants Honed Reavers\nDuration: 60s\nSteel Fangs changes to Hunter\'s Sting, then to Flanksting Strike or Hindsting Strike, as the combo continues.' }),
    reavingFangs: ws({ name: 'Reaving Fangs', potency: 200, honed: 'honedReavers', grants: 'honedSteel', desc: 'Delivers an attack with a potency of 200.\nHoned Reavers Potency: 300\nAdditional Effect: Grants Honed Steel\nDuration: 60s\nReaving Fangs changes to Swiftskin\'s Sting, then to Flanksbane Fang or Hindsbane Fang, as the combo continues.' }),
    huntersSting: ws({ name: 'Hunter\'s Sting', potency: 300, path: 'hunter', fx: 'slash2', desc: 'Delivers an attack with a potency of 300.\nCombo Action: Steel Fangs or Reaving Fangs\nAdditional Effect: Grants Hunter\'s Instinct (damage dealt +10%)\nDuration: 40s' }),
    swiftskinsSting: ws({ name: 'Swiftskin\'s Sting', potency: 300, path: 'swift', fx: 'slash2', desc: 'Delivers an attack with a potency of 300.\nCombo Action: Steel Fangs or Reaving Fangs\nAdditional Effect: Grants Swiftscaled (weaponskill recast and auto-attack delay −15%)\nDuration: 40s' }),
    flankstingStrike: fin({ name: 'Flanksting Strike', positional: 'flank', after: 'hunter', venom: 'flankstungVenom', next: 'hindstungVenom', desc: 'Delivers an attack with a potency of 340.\n400 when executed from a target\'s flank.\nFlankstung Venom Potency: 440 (500 from the flank)\nCombo Action: Hunter\'s Sting\nAdditional Effect: Grants Hindstung Venom\nAdditional Effect: Serpent Offerings +10' }),
    flanksbaneFang: fin({ name: 'Flanksbane Fang', positional: 'flank', after: 'hunter', venom: 'flanksbaneVenom', next: 'hindsbaneVenom', desc: 'Delivers an attack with a potency of 340.\n400 when executed from a target\'s flank.\nFlanksbane Venom Potency: 440 (500 from the flank)\nCombo Action: Hunter\'s Sting\nAdditional Effect: Grants Hindsbane Venom\nAdditional Effect: Serpent Offerings +10' }),
    hindstingStrike: fin({ name: 'Hindsting Strike', positional: 'rear', after: 'swift', venom: 'hindstungVenom', next: 'flanksbaneVenom', desc: 'Delivers an attack with a potency of 340.\n400 when executed from a target\'s rear.\nHindstung Venom Potency: 440 (500 from the rear)\nCombo Action: Swiftskin\'s Sting\nAdditional Effect: Grants Flanksbane Venom\nAdditional Effect: Serpent Offerings +10' }),
    hindsbaneFang: fin({ name: 'Hindsbane Fang', positional: 'rear', after: 'swift', venom: 'hindsbaneVenom', next: 'flankstungVenom', desc: 'Delivers an attack with a potency of 340.\n400 when executed from a target\'s rear.\nHindsbane Venom Potency: 440 (500 from the rear)\nCombo Action: Swiftskin\'s Sting\nAdditional Effect: Grants Flankstung Venom\nAdditional Effect: Serpent Offerings +10' }),
    vicewinder: ws({ name: 'Vicewinder', potency: 540, recast: 3, cd: 40, charges: 2, cdGroup: 'vicewinder', cdScales: true, opens: 'coil', fx: 'gnbSlash2', desc: 'Delivers an attack with a potency of 540.\nAdditional Effect: Rattling Coil +1\nMaximum Charges: 2 (shared with Vicepit)\nOpens Hunter\'s Coil and Swiftskin\'s Coil.' }),
    huntersCoil: ws({ name: 'Hunter\'s Coil', potency: 630, posBonus: 50, positional: 'flank', recast: 3, coil: 'hunter', fx: 'gnbFang2', desc: 'Delivers an attack with a potency of 630.\n680 when executed from a target\'s flank.\nCombo Action: Vicewinder or Swiftskin\'s Coil\nAdditional Effect: Grants Hunter\'s Instinct (40s) and Hunter\'s Venom (30s)\nAdditional Effect: Serpent Offerings +5\nTwinfang Bite and Twinblood Bite can follow.' }),
    swiftskinsCoil: ws({ name: 'Swiftskin\'s Coil', potency: 630, posBonus: 50, positional: 'rear', recast: 3, coil: 'swift', fx: 'gnbFang3', desc: 'Delivers an attack with a potency of 630.\n680 when executed from a target\'s rear.\nCombo Action: Vicewinder or Hunter\'s Coil\nAdditional Effect: Grants Swiftscaled (40s) and Swiftskin\'s Venom (30s)\nAdditional Effect: Serpent Offerings +5\nTwinblood Bite and Twinfang Bite can follow.' }),
    uncoiledFury: ws({ name: 'Uncoiled Fury', potency: 680, recast: 3.5, range: 20, aoe: FAR, delay: 0.7, fx: 'gnbShot', desc: 'Delivers a ranged attack with a potency of 680 to target and all enemies nearby it, 75% less for the rest.\nRattling Coil Cost: 1\nAdditional Effect: Grants Poised for Twinfang\nDuration: 60s' }),
    writhingSnap: ws({ name: 'Writhing Snap', potency: 200, range: 20, delay: 0.7, fx: 'gnbShot', desc: 'Delivers a ranged attack with a potency of 200.' }),
    reawaken: ws({ name: 'Reawaken', potency: 750, recast: 2.2, aoe: FAR, fx: 'gnbZone', desc: 'Delivers an attack with a potency of 750 to all nearby enemies, 75% less after the first.\nSerpent Offerings Cost: 50 (none with Ready to Reawaken)\nAdditional Effect: Reawakened, 5 stacks of Anguine Tribute\nDuration: 30s\nWhile Reawakened, Steel Fangs, Reaving Fangs, Hunter\'s Coil and Swiftskin\'s Coil become the four Generations, and Reawaken becomes Ouroboros.' }),
    firstGeneration: gen({ name: 'First Generation', order: 5, legacy: 'firstLegacy', desc: 'Delivers an attack with a potency of 480 (680 when it\'s the first of the sequence).\nAnguine Tribute Cost: 1\nFirst Legacy can follow.' }),
    secondGeneration: gen({ name: 'Second Generation', order: 4, legacy: 'secondLegacy', desc: 'Delivers an attack with a potency of 480 (680 after First Generation).\nAnguine Tribute Cost: 1\nSecond Legacy can follow.' }),
    thirdGeneration: gen({ name: 'Third Generation', order: 3, legacy: 'thirdLegacy', desc: 'Delivers an attack with a potency of 480 (680 after Second Generation).\nAnguine Tribute Cost: 1\nThird Legacy can follow.' }),
    fourthGeneration: gen({ name: 'Fourth Generation', order: 2, legacy: 'fourthLegacy', desc: 'Delivers an attack with a potency of 480 (680 after Third Generation).\nAnguine Tribute Cost: 1\nFourth Legacy can follow.' }),
    ouroboros: ws({ name: 'Ouroboros', potency: 1150, recast: 3, aoe: FAR, fx: 'gnbDouble', desc: 'Delivers an attack with a potency of 1,150 to target and all enemies nearby it, 75% less for the rest.\nCan only be executed while Reawakened with at least one Anguine Tribute. Ends Reawakened.' }),
    // The Serpent's Tail, Twinfang and Twinblood buttons turn into whatever is ready.
    serpentsTail: og({ name: 'Serpent\'s Tail', target: false, desc: 'Becomes Death Rattle after a dual-wield finisher, Last Lash after an AoE finisher, and the Legacies after the Generations.' }),
    twinfang: og({ name: 'Twinfang', target: false, desc: 'Becomes Twinfang Bite after a Coil, Twinfang Thresh after a Den, and Uncoiled Twinfang after Uncoiled Fury.' }),
    twinblood: og({ name: 'Twinblood', target: false, desc: 'Becomes Twinblood Bite after a Coil, Twinblood Thresh after a Den, and Uncoiled Twinblood after Uncoiled Fury.' }),
    deathRattle: og({ name: 'Death Rattle', potency: 280, tail: true, desc: 'Delivers an attack with a potency of 280.\nCan only be executed after a dual-wield finisher.' }),
    lastLash: og({ name: 'Last Lash', potency: 120, tail: true, target: false, pbaoe: 5, aoe: true, desc: 'Delivers an attack with a potency of 120 to all nearby enemies.\nCan only be executed after Jagged Maw or Bloodied Maw.' }),
    firstLegacy: legacy({ name: 'First Legacy', tail: true, desc: 'Delivers an attack with a potency of 320.\nCan only be executed after First Generation.' }),
    secondLegacy: legacy({ name: 'Second Legacy', tail: true, desc: 'Delivers an attack with a potency of 320.\nCan only be executed after Second Generation.' }),
    thirdLegacy: legacy({ name: 'Third Legacy', tail: true, desc: 'Delivers an attack with a potency of 320.\nCan only be executed after Third Generation.' }),
    fourthLegacy: legacy({ name: 'Fourth Legacy', tail: true, desc: 'Delivers an attack with a potency of 320.\nCan only be executed after Fourth Generation.' }),
    twinfangBite: og({ name: 'Twinfang Bite', potency: 120, venomPotency: 170, twin: 'fang', twinKind: 'bite', venom: 'huntersVenom', passes: 'swiftskinsVenom', desc: 'Delivers an attack with a potency of 120.\nHunter\'s Venom Potency: 170\nAdditional Effect: Grants Swiftskin\'s Venom' }),
    twinbloodBite: og({ name: 'Twinblood Bite', potency: 120, venomPotency: 170, twin: 'blood', twinKind: 'bite', venom: 'swiftskinsVenom', passes: 'huntersVenom', desc: 'Delivers an attack with a potency of 120.\nSwiftskin\'s Venom Potency: 170\nAdditional Effect: Grants Hunter\'s Venom' }),
    uncoiledTwinfang: og({ name: 'Uncoiled Twinfang', potency: 120, venomPotency: 170, twin: 'fang', twinKind: 'uncoiled', venom: 'poisedForTwinfang', passes: 'poisedForTwinblood', range: 20, aoe: FAR, desc: 'Delivers an attack with a potency of 120.\nPoised for Twinfang Potency: 170\nAdditional Effect: Grants Poised for Twinblood' }),
    uncoiledTwinblood: og({ name: 'Uncoiled Twinblood', potency: 120, venomPotency: 170, twin: 'blood', twinKind: 'uncoiled', venom: 'poisedForTwinblood', passes: 'poisedForTwinfang', range: 20, aoe: FAR, desc: 'Delivers an attack with a potency of 120.\nPoised for Twinblood Potency: 170\nAdditional Effect: Grants Poised for Twinfang' }),
    twinfangThresh: og({ name: 'Twinfang Thresh', potency: 50, venomPotency: 80, twin: 'fang', twinKind: 'thresh', venom: 'fellhuntersVenom', passes: 'fellskinsVenom', target: false, pbaoe: 5, aoe: true, desc: 'Delivers an attack with a potency of 50 to all nearby enemies.\nFellhunter\'s Venom Potency: 80' }),
    twinbloodThresh: og({ name: 'Twinblood Thresh', potency: 50, venomPotency: 80, twin: 'blood', twinKind: 'thresh', venom: 'fellskinsVenom', passes: 'fellhuntersVenom', target: false, pbaoe: 5, aoe: true, desc: 'Delivers an attack with a potency of 50 to all nearby enemies.\nFellskin\'s Venom Potency: 80' }),
    // AoE: Steel and Reaving Maw → Hunter's or Swiftskin's Bite → Jagged or Bloodied Maw; Vicepit → the Dens.
    steelMaw: aoe({ name: 'Steel Maw', potency: 120, honedPotency: 140, honed: 'honedSteel', grants: 'honedReavers', desc: 'Delivers an attack with a potency of 120 to all nearby enemies.\nHoned Steel Potency: 140\nAdditional Effect: Grants Honed Reavers\nSteel Maw changes to Hunter\'s Bite, then Jagged Maw.' }),
    reavingMaw: aoe({ name: 'Reaving Maw', potency: 120, honedPotency: 140, honed: 'honedReavers', grants: 'honedSteel', desc: 'Delivers an attack with a potency of 120 to all nearby enemies.\nHoned Reavers Potency: 140\nAdditional Effect: Grants Honed Steel\nReaving Maw changes to Swiftskin\'s Bite, then Bloodied Maw.' }),
    huntersBite: aoe({ name: 'Hunter\'s Bite', potency: 180, path: 'hunter', desc: 'Delivers an attack with a potency of 180 to all nearby enemies.\nAdditional Effect: Grants Hunter\'s Instinct\nDuration: 40s' }),
    swiftskinsBite: aoe({ name: 'Swiftskin\'s Bite', potency: 180, path: 'swift', desc: 'Delivers an attack with a potency of 180 to all nearby enemies.\nAdditional Effect: Grants Swiftscaled\nDuration: 40s' }),
    jaggedMaw: aoe({ name: 'Jagged Maw', potency: 180, venomBonus: 40, venom: 'grimhuntersVenom', next: 'grimskinsVenom', aoeFinisher: true, desc: 'Delivers an attack with a potency of 180 to all nearby enemies.\nGrimhunter\'s Venom Potency: 220\nAdditional Effect: Grants Grimskin\'s Venom\nAdditional Effect: Serpent Offerings +10' }),
    bloodiedMaw: aoe({ name: 'Bloodied Maw', potency: 180, venomBonus: 40, venom: 'grimskinsVenom', next: 'grimhuntersVenom', aoeFinisher: true, desc: 'Delivers an attack with a potency of 180 to all nearby enemies.\nGrimskin\'s Venom Potency: 220\nAdditional Effect: Grants Grimhunter\'s Venom\nAdditional Effect: Serpent Offerings +10' }),
    vicepit: aoe({ name: 'Vicepit', potency: 250, recast: 3, cd: 40, charges: 2, cdGroup: 'vicewinder', cdScales: true, opens: 'den', desc: 'Delivers an attack with a potency of 250 to all nearby enemies.\nAdditional Effect: Rattling Coil +1\nMaximum Charges: 2 (shared with Vicewinder)\nOpens Hunter\'s Den and Swiftskin\'s Den.' }),
    huntersDen: aoe({ name: 'Hunter\'s Den', potency: 300, recast: 3, den: 'hunter', desc: 'Delivers an attack with a potency of 300 to all nearby enemies.\nAdditional Effect: Grants Hunter\'s Instinct (40s) and Fellhunter\'s Venom\nAdditional Effect: Serpent Offerings +5' }),
    swiftskinsDen: aoe({ name: 'Swiftskin\'s Den', potency: 300, recast: 3, den: 'swift', desc: 'Delivers an attack with a potency of 300 to all nearby enemies.\nAdditional Effect: Grants Swiftscaled (40s) and Fellskin\'s Venom\nAdditional Effect: Serpent Offerings +5' }),
    serpentsIre: { name: 'Serpent\'s Ire', kind: 'ogcd', recast: 120, desc: 'Grants a Rattling Coil and Ready to Reawaken.\nDuration: 30s\nCan only be executed while in combat.' },
    slither: { name: 'Slither', kind: 'ogcd', recast: 30, charges: 3, target: true, range: 20, desc: 'Slither to a target or location.\nMaximum Charges: 3' },
    ...B.ROLE_ACTIONS.melee,
    ...B.GENERAL_ACTIONS,
    tincture: B.tincture('dexdt4'),
    auto: { name: 'Attack', kind: 'auto', fx: 'auto', desc: 'Auto-attack.' },
  };
  const GEN_BY_TRIBUTE = { 5: 'firstGeneration', 4: 'secondGeneration', 3: 'thirdGeneration', 2: 'fourthGeneration', 1: 'ouroboros' };
  const GEN_BUTTON = { steelFangs: 'firstGeneration', steelMaw: 'firstGeneration', reavingFangs: 'secondGeneration', reavingMaw: 'secondGeneration',
    huntersCoil: 'thirdGeneration', huntersDen: 'thirdGeneration', swiftskinsCoil: 'fourthGeneration', swiftskinsDen: 'fourthGeneration', reawaken: 'ouroboros' };
  // Twinblade actions don't break the coil combo (nor do Uncoiled Fury and Writhing Snap); every other GCD does.
  const KEEPS_TWIN = { vicewinder: 1, vicepit: 1, huntersCoil: 1, swiftskinsCoil: 1, huntersDen: 1, swiftskinsDen: 1, uncoiledFury: 1, writhingSnap: 1 };

  const st = (name, icon, self = true) => ({ name, self, icon });
  const STATUSES = {
    huntersInstinct: st('Hunter\'s Instinct', 'st_hunter'),
    swiftscaled: st('Swiftscaled', 'st_swift'),
    honedSteel: st('Honed Steel', 'st_honed'),
    honedReavers: st('Honed Reavers', 'st_honed'),
    flankstungVenom: st('Flankstung Venom', 'st_venom'),
    flanksbaneVenom: st('Flanksbane Venom', 'st_venom'),
    hindstungVenom: st('Hindstung Venom', 'st_venom'),
    hindsbaneVenom: st('Hindsbane Venom', 'st_venom'),
    grimhuntersVenom: st('Grimhunter\'s Venom', 'st_venom'),
    grimskinsVenom: st('Grimskin\'s Venom', 'st_venom'),
    huntersVenom: st('Hunter\'s Venom', 'st_venom'),
    swiftskinsVenom: st('Swiftskin\'s Venom', 'st_venom'),
    fellhuntersVenom: st('Fellhunter\'s Venom', 'st_venom'),
    fellskinsVenom: st('Fellskin\'s Venom', 'st_venom'),
    poisedForTwinfang: st('Poised for Twinfang', 'st_poised'),
    poisedForTwinblood: st('Poised for Twinblood', 'st_poised'),
    readyToReawaken: st('Ready to Reawaken', 'st_ready'),
    reawakened: st('Reawakened', 'st_reawaken'),
  };

  class ViperDT {
    constructor() {
      this.name = 'Viper';
      this.abbr = 'VPR';
      this.role = 'melee';
      this.level = 100;
      this.levelKey = 100;
      this.model = 'vpr-dt';
      this.actions = ACTIONS;
      this.statuses = STATUSES;
      // The Balance's 7.5 savage set (Grand Champion's Twinfangs: 158 weapon damage, 2.64 delay) at 2.48, food
      // included, without the 5% party bonus.
      this.stats = { hp: 135000, main: 6490, mainStat: 'dex', jobMod: 110, trait: 100, wd: 158, det: 2149, crit: 3605,
        dh: 2177, speed: 582, delay: 2.64 };
      this.speedName = 'Skill speed';
      this.tierHaste = 15;          // GCDs are quoted with Swiftscaled up: 2.48 is 2.10
      this.autoAttack = { potency: 90, delay: 2.64, range: B.MELEE_RANGE };
      this.selfStatusOrder = ['reawakened', 'huntersInstinct', 'swiftscaled', 'honedSteel', 'honedReavers', 'flankstungVenom', 'flanksbaneVenom',
        'hindstungVenom', 'hindsbaneVenom', 'grimhuntersVenom', 'grimskinsVenom', 'huntersVenom', 'swiftskinsVenom', 'fellhuntersVenom',
        'fellskinsVenom', 'poisedForTwinfang', 'poisedForTwinblood', 'readyToReawaken', 'medicated', 'trueNorth', 'bloodbath', 'armsLength', 'sprint'];
      this.targetStatusOrder = ['feint'];
      this.defaultBars = [
        ['steelFangs', 'reavingFangs', 'vicewinder', 'huntersCoil', 'swiftskinsCoil', 'uncoiledFury', 'reawaken', 'serpentsTail', 'twinfang', 'twinblood', 'serpentsIre', 'tincture'],
        ['steelMaw', 'reavingMaw', 'vicepit', 'huntersDen', 'swiftskinsDen', 'writhingSnap', 'slither', 'trueNorth', 'secondWind', 'bloodbath', 'feint', 'legSweep'],
        ['armsLength', 'sprint', null, null, null, null, null, null, null, null, null, null],
      ];
      this.actionGroups = [
        ['Viper', ['steelFangs', 'reavingFangs', 'huntersSting', 'swiftskinsSting', 'flankstingStrike', 'flanksbaneFang', 'hindstingStrike', 'hindsbaneFang',
          'vicewinder', 'huntersCoil', 'swiftskinsCoil', 'uncoiledFury', 'writhingSnap', 'reawaken', 'firstGeneration', 'secondGeneration', 'thirdGeneration',
          'fourthGeneration', 'ouroboros', 'serpentsTail', 'deathRattle', 'firstLegacy', 'secondLegacy', 'thirdLegacy', 'fourthLegacy', 'twinfang', 'twinblood',
          'twinfangBite', 'twinbloodBite', 'uncoiledTwinfang', 'uncoiledTwinblood', 'serpentsIre', 'slither']],
        ['AoE', ['steelMaw', 'reavingMaw', 'huntersBite', 'swiftskinsBite', 'jaggedMaw', 'bloodiedMaw', 'lastLash', 'vicepit', 'huntersDen', 'swiftskinsDen',
          'twinfangThresh', 'twinbloodThresh']],
        ['Role Actions', ['trueNorth', 'secondWind', 'legSweep', 'bloodbath', 'feint', 'armsLength']],
        ['General', ['sprint', 'tincture']],
      ];
      this.referenceDps = 44000;     // a scripted 7.5 rotation on this gear parses about 41,500 on the dummy
      this.referenceGcd = 2.10;
      this.startDistance = 3.2;
    }

    initGauge() { return { offerings: 0, coils: 0, tribute: 0, dw: null, aw: null, tw: null, twins: null, tail: null }; }

    haste(e) { return e.has('swiftscaled') ? 15 : 0; }
    autoHaste(e) { return this.haste(e); }
    live(x, e) { return x && x.until > e.now ? x : null; }

    // The two dual-wield buttons walk the combo; while Reawakened, they and the Coils become the Generations.
    resolveId(id, e) {
      const g = e.g;
      if (e.has('reawakened') && GEN_BUTTON[id]) return GEN_BUTTON[id];
      const dw = this.live(g.dw, e), aw = this.live(g.aw, e);
      if (id === 'steelFangs' || id === 'reavingFangs') {
        if (dw && dw.stage === 1) return id === 'steelFangs' ? 'huntersSting' : 'swiftskinsSting';
        if (dw && dw.stage === 2) return dw.path === 'hunter' ? (id === 'steelFangs' ? 'flankstingStrike' : 'flanksbaneFang') : (id === 'steelFangs' ? 'hindstingStrike' : 'hindsbaneFang');
      }
      if (id === 'steelMaw' || id === 'reavingMaw') {
        if (aw && aw.stage === 1) return id === 'steelMaw' ? 'huntersBite' : 'swiftskinsBite';
        if (aw && aw.stage === 2) return id === 'steelMaw' ? 'jaggedMaw' : 'bloodiedMaw';
      }
      if (id === 'serpentsTail' && this.live(g.tail, e)) return g.tail.id;
      if (id === 'twinfang' || id === 'twinblood') {
        const t = this.live(g.twins, e), which = id === 'twinfang' ? 'fang' : 'blood';
        if (t && t[which]) return { bite: { fang: 'twinfangBite', blood: 'twinbloodBite' }, uncoiled: { fang: 'uncoiledTwinfang', blood: 'uncoiledTwinblood' }, thresh: { fang: 'twinfangThresh', blood: 'twinbloodThresh' } }[t.kind][which];
      }
      return id;
    }

    check(id, e) {
      const a = this.actions[id], g = e.g;
      const dw = this.live(g.dw, e), aw = this.live(g.aw, e), tw = this.live(g.tw, e);
      if (id === 'serpentsTail' || id === 'twinfang' || id === 'twinblood') return 'Unable to execute action.';
      if (a.path && !a.pbaoe && !(dw && dw.stage === 1)) return 'Unable to execute action.';
      if (a.finisher && !(dw && dw.stage === 2 && dw.path === a.after)) return 'Unable to execute action.';
      if (a.path && a.pbaoe && !(aw && aw.stage === 1)) return 'Unable to execute action.';
      if (a.aoeFinisher && !(aw && aw.stage === 2)) return 'Unable to execute action.';
      if (a.coil && !(tw && tw.kind === 'coil' && !tw[a.coil])) return 'Unable to execute action.';
      if (a.den && !(tw && tw.kind === 'den' && !tw[a.den])) return 'Unable to execute action.';
      if (id === 'uncoiledFury' && g.coils < 1) return 'Unable to execute action. Rattling Coil required.';
      if (id === 'reawaken' && (e.has('reawakened') || (g.offerings < 50 && !e.has('readyToReawaken')))) return 'Not enough Serpent Offerings.';
      if ((a.generation || id === 'ouroboros') && !(e.has('reawakened') && g.tribute > 0)) return 'Unable to execute action.';
      if (a.tail && !(this.live(g.tail, e) && g.tail.id === id)) return 'Unable to execute action.';
      if (a.twin) { const t = this.live(g.twins, e); if (!(t && t.kind === a.twinKind && t[a.twin])) return 'Unable to execute action.'; }
      if (id === 'serpentsIre' && !e.inCombat) return 'Unable to execute action while not in combat.';
      return null;
    }

    snapshot(a, e) {
      const mult = e.has('huntersInstinct') ? 1.10 : 1;
      const main = this.stats.main + (e.has('medicated') ? B.TINCTURES.dexdt4.cap : 0);
      return { mult, main };
    }

    venom(e, key, next) {
      for (const k of VENOMS) if (k !== next) e.removeStatus(k, true);
      if (key) e.removeStatus(key, true);
      if (next) e.addStatus(next, 60);
    }
    offer(e, n) { e.g.offerings = Math.min(100, e.g.offerings + n); }
    addCoil(e) { e.g.coils = Math.min(3, e.g.coils + 1); }

    resolve(id, e) {
      const a = this.actions[id], g = e.g;
      let potency = a.potency || 0, opts = null;
      if (a.kind === 'gcd' && !KEEPS_TWIN[id]) g.tw = null;

      if (a.honed) {                                  // step 1, single target or AoE
        if (e.has(a.honed)) { potency = a.honedPotency || 300; e.removeStatus(a.honed, true); }
        e.removeStatus(a.grants === 'honedSteel' ? 'honedReavers' : 'honedSteel', true);
        e.addStatus(a.grants, 60);
        if (a.pbaoe) { g.aw = { stage: 1, until: e.now + 30 }; g.dw = null; } else { g.dw = { stage: 1, until: e.now + 30 }; g.aw = null; }
      } else if (a.path) {                            // step 2
        e.addStatus(a.path === 'hunter' ? 'huntersInstinct' : 'swiftscaled', 40);
        if (a.pbaoe) g.aw = { stage: 2, path: a.path, until: e.now + 30 }; else g.dw = { stage: 2, path: a.path, until: e.now + 30 };
      } else if (a.finisher) {
        const pos = e.positionalHit(a);
        if (pos) potency += a.posBonus;
        if (e.has(a.venom)) potency += a.venomBonus;
        this.venom(e, a.venom, a.next);
        this.offer(e, 10);
        g.dw = null;
        g.tail = { id: 'deathRattle', until: e.now + 30 };
        opts = { positional: pos ? 'hit' : 'miss' };
      } else if (a.aoeFinisher) {
        if (e.has(a.venom)) { potency += a.venomBonus; e.removeStatus(a.venom, true); }
        e.removeStatus(a.next === 'grimskinsVenom' ? 'grimhuntersVenom' : 'grimskinsVenom', true);
        e.addStatus(a.next, 30);
        this.offer(e, 10);
        g.aw = null;
        g.tail = { id: 'lastLash', until: e.now + 30 };
      } else if (a.opens) {                           // Vicewinder, Vicepit
        this.addCoil(e);
        g.tw = { kind: a.opens, hunter: false, swift: false, until: e.now + 30 };
      } else if (a.coil || a.den) {
        const side = a.coil || a.den;
        if (a.coil) { const pos = e.positionalHit(a); if (pos) potency += a.posBonus; opts = { positional: pos ? 'hit' : 'miss' }; }
        e.addStatus(side === 'hunter' ? 'huntersInstinct' : 'swiftscaled', 40);
        const v = a.coil ? (side === 'hunter' ? 'huntersVenom' : 'swiftskinsVenom') : (side === 'hunter' ? 'fellhuntersVenom' : 'fellskinsVenom');
        e.addStatus(v, 30);
        g.twins = { kind: a.coil ? 'bite' : 'thresh', fang: true, blood: true, until: e.now + 30 };
        this.offer(e, 5);
        const tw = this.live(g.tw, e);
        if (tw) { tw[side] = true; tw.until = e.now + 30; if (tw.hunter && tw.swift) g.tw = null; }
      } else if (a.twin) {
        if (e.has(a.venom)) { potency = a.venomPotency; e.removeStatus(a.venom, true); }
        const t = g.twins;
        t[a.twin] = false;
        if (t.fang || t.blood) e.addStatus(a.passes, a.twinKind === 'uncoiled' ? 60 : 30);
        else g.twins = null;
      } else if (a.generation) {
        if (g.tribute === a.order) potency = a.seqPotency;
        g.tribute--;
        g.tail = { id: a.legacy, until: e.now + 30 };
        if (g.tribute <= 0) e.removeStatus('reawakened');
      } else if (a.tail) {
        g.tail = null;
      } else {
        switch (id) {
          case 'uncoiledFury':
            g.coils--;
            e.addStatus('poisedForTwinfang', 60);
            g.twins = { kind: 'uncoiled', fang: true, blood: true, until: e.now + 60 };
            break;
          case 'reawaken':
            if (e.has('readyToReawaken')) e.removeStatus('readyToReawaken');
            else g.offerings -= 50;
            g.tribute = 5;
            e.addStatus('reawakened', 30);
            break;
          case 'ouroboros': g.tribute = 0; e.removeStatus('reawakened'); break;
          case 'serpentsIre': this.addCoil(e); e.addStatus('readyToReawaken', 30); break;
          case 'slither': {
            const d = e.distToTarget() || 1;
            if (d > 2.6) {
              const from = { x: e.pos.x, z: e.pos.z };
              e.pos.x *= 2.4 / d; e.pos.z *= 2.4 / d;
              e.emit('teleport', { from, to: { x: e.pos.x, z: e.pos.z } });
            }
            break;
          }
          default:
            if (B.ROLE_EFFECTS[id]) B.ROLE_EFFECTS[id](e);
        }
      }
      if (potency) e.queueHit(id, potency, this.snapshot(a, e), a.delay, null, opts);
    }

    // Reawakened running out takes the tribute with it.
    nextEvent(e) { return e.g.tribute > 0 && e.statuses.reawakened ? e.statuses.reawakened.until : Infinity; }
    process(e) { if (e.g.tribute > 0 && !e.has('reawakened')) e.g.tribute = 0; }

    proc(id, e) {
      const a = this.actions[id], g = e.g;
      if (a.finisher) return e.has(a.venom);
      if (a.path || a.coil || a.den || a.aoeFinisher || a.generation || id === 'ouroboros') return !this.check(id, e);
      if (a.tail || a.twin) return !this.check(id, e);
      if (id === 'reawaken') return e.has('readyToReawaken') || g.offerings >= 50;
      if (id === 'uncoiledFury') return g.coils >= 3;
      return false;
    }

    mpRegen() { return B.BASE_REGEN; }
    speedInfo(e) { return `GCD ${e.gcdForSpeed(e.stats.speed).toFixed(2)}, ${e.gcdForSpeed(e.stats.speed, 15).toFixed(2)} under Swiftscaled`; }

    // ---------- the Serpent Offerings gauge, Rattling Coils and Anguine Tribute ----------
    gaugeBuild(root) {
      root.innerHTML = `
<svg width="360" height="150" viewBox="0 0 360 150">
  <defs><linearGradient id="vp-off" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#2f9f8a"/><stop offset="1" stop-color="#d84a6a"/></linearGradient></defs>
  <rect x="8" y="10" width="344" height="130" rx="14" fill="rgba(14,12,20,.86)" stroke="rgba(255,255,255,.22)"/>
  <text x="24" y="36" font-family="Noto Sans, sans-serif" font-size="11" font-weight="600" fill="#a9a3b4" letter-spacing="1">SERPENT OFFERINGS</text>
  <text id="vp-n" x="336" y="38" text-anchor="end" font-family="Saira Semi Condensed, sans-serif" font-size="20" font-weight="700" fill="#fff" stroke="#000" stroke-width="3" paint-order="stroke">0</text>
  <rect x="24" y="48" width="312" height="14" rx="7" fill="#1d1a2a" stroke="rgba(255,255,255,.2)"/>
  <rect id="vp-bar" x="24" y="48" width="0" height="14" rx="7" fill="url(#vp-off)"/>
  <line x1="180" y1="44" x2="180" y2="66" stroke="rgba(255,255,255,.5)"/>
  <text x="24" y="92" font-family="Noto Sans, sans-serif" font-size="11" font-weight="600" fill="#a9a3b4" letter-spacing="1">RATTLING COIL</text>
  ${[0, 1, 2].map(k => `<path id="vp-c${k}" d="M0 -10 L8 0 L0 10 L-8 0 Z" transform="translate(${140 + k * 24} 88)" fill="#2a2535" stroke="rgba(0,0,0,.8)" stroke-width="1.5"/>`).join('')}
  <text x="24" y="124" font-family="Noto Sans, sans-serif" font-size="11" font-weight="600" fill="#a9a3b4" letter-spacing="1">ANGUINE TRIBUTE</text>
  ${[0, 1, 2, 3, 4].map(k => `<circle id="vp-t${k}" cx="${150 + k * 22}" cy="120" r="7" fill="#2a2535" stroke="rgba(0,0,0,.8)" stroke-width="1.5"/>`).join('')}
</svg>`;
      const $ = (s) => root.querySelector(s);
      this.vg = { n: $('#vp-n'), bar: $('#vp-bar'), c: [0, 1, 2].map(k => $('#vp-c' + k)), t: [0, 1, 2, 3, 4].map(k => $('#vp-t' + k)), cache: {} };
    }

    gaugeUpdate(e) {
      const G = this.vg, c = G.cache, g = e.g;
      const put = (k, v, fn) => { if (c[k] !== v) { c[k] = v; fn(v); } };
      put('o', g.offerings, v => { G.n.textContent = String(v); G.bar.setAttribute('width', String(312 * v / 100)); });
      for (let i = 0; i < 3; i++) put('c' + i, g.coils > i, v => G.c[i].setAttribute('fill', v ? '#e05a7a' : '#2a2535'));
      for (let i = 0; i < 5; i++) put('t' + i, g.tribute > i, v => G.t[i].setAttribute('fill', v ? '#7fe0c8' : '#2a2535'));
    }

    helpHtml(seq) {
      return `
<h3>How it plays (Dawntrail 7.05–7.57)</h3>
<p>Level 100 Viper. The dual-wield combo runs on two buttons. <b>Steel Fangs</b> or <b>Reaving Fangs</b> first (300 with its Honed buff; each grants the other's, so alternate), then <b>Hunter's Sting</b> (Steel's button: +10% damage, Hunter's Instinct) or <b>Swiftskin's Sting</b> (Reaving's button: 15% faster GCD and autos, Swiftscaled), then a finisher: from the flank after Hunter's Sting, from the rear after Swiftskin's. The venom on your bar says which (+100): Flanksting → Hindsting → Flanksbane → Hindsbane, round and round. Each finisher readies <b>Death Rattle</b> (280) on the Serpent's Tail button.</p>
<p><b>Vicewinder</b> (2 charges, 40s) opens <b>Hunter's Coil</b> (flank) and <b>Swiftskin's Coil</b> (rear), 680 each and buffs; after each, the Twinfang and Twinblood buttons fire twice (170 each in the right order). Vicewinder and Serpent's Ire add Rattling Coils for <b>Uncoiled Fury</b> (680, with its own Twinfang and Twinblood). Finishers and Coils fill the Serpent Offerings: at 50, <b>Reawaken</b> (750; free after <b>Serpent's Ire</b>) turns your buttons into <b>First to Fourth Generation</b> (680 in order, each with its Legacy, 320) and <b>Ouroboros</b> (1,150). Keep Hunter's Instinct and Swiftscaled up through it.</p>
<h3>The 7.5 opener</h3>
${seq(['reavingFangs', ['serpentsIre'], 'swiftskinsSting', 'vicewinder', ['tincture'], 'huntersCoil', ['twinfang'], ['twinblood'], 'swiftskinsCoil', ['twinblood'], ['twinfang'], 'reawaken', 'firstGeneration', ['serpentsTail'], 'secondGeneration', ['serpentsTail'], 'thirdGeneration', ['serpentsTail'], 'fourthGeneration', ['serpentsTail'], 'ouroboros', 'uncoiledFury', ['twinfang'], ['twinblood'], 'uncoiledFury', ['twinfang'], ['twinblood'], 'hindstingStrike', ['serpentsTail'], 'vicewinder', 'huntersCoil', 'swiftskinsCoil'])}
<p>From The Balance's 7.5 Viper guide (Slither in at −0.5s). Every two minutes, Serpent's Ire gives a free Reawaken: spend it and a second one from 50 Offerings back to back.</p>
<p style="color:#a9a3b4">The 7.5–7.57 numbers: Fangs 200 (300 Honed), Stings 300, finishers 340 (400 positional, +100 venom), Death Rattle 280, Vicewinder 540, Coils 630 (680 positional), Twin bites 120 / 170, Uncoiled Fury 680, Reawaken 750, Generations 680 in order (480 out of order), Legacies 320, Ouroboros 1,150; auto-attacks 90 at 2.64s. 7.05–7.1x had Legacies 280, Vicewinder 500 and Coils 570 / 620; 7.2 raised the Legacies. AoE: Maws 120 (140), Bites 180, Jagged / Bloodied Maw 180 (220), Last Lash 120, Vicepit 250, Dens 300, Thresh 50 (80). Gear is The Balance's 7.5 savage set (Dexterity 6,490 without the party bonus), with a Grade 4 Gemdraught.</p>`;
    }
  }

  B.ViperDT = ViperDT;
  B.registerJob({
    id: 'vpr', name: 'Viper', abbr: 'VPR', role: 'melee', classJob: 41,
    versions: [{ id: 'dt705', label: 'Dawntrail 7.05–7.57', history: 'DT 7.05–7.57', note: 'Level 100. The reworked Viper: Honed alternation, venom finishers and Death Rattle, Vicewinder into the Coils and Twin bites, Uncoiled Fury, Reawaken into the Generations, Legacies and Ouroboros; 7.5\'s numbers', create: () => new ViperDT() }],
  });
})(window.BLM);
