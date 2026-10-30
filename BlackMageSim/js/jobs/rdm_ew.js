// Red Mage, Endwalker 6.0–6.58 (level 90) and Dawntrail 7.0–7.01, 7.05–7.38 and 7.4–7.57 (level 100). Built on the Shadowbringers class
// (rdm_shb.js) for Dualcast, the Balance Gauge and the imbalance rule, with the 6.0 rework: Verthunder III / Veraero III
// (+6), Verfire / Verstone (+5), Jolt (+2 each); a cheaper melee combo (20 / 15 / 15) whose steps each add a Mana Stack,
// and three stacks turn Verthunder III / Veraero III into Verflare / Verholy (+11), then Scorch and Resolution; Embolden
// a flat +5% to your magic; Manafication +5% magic for your next six GCDs; Acceleration two charges, each making the
// next Verthunder III / Veraero III / Impact instant with a sure proc.
//  - EW 6.0–6.58: Manafication also gives 50|50 mana. The 6.58 numbers (6.28 raised the melee, 6.5 the rest).
//  - DT 7.05–7.38: Jolt III; Manafication gives no mana but three Magicked Swordplay stacks (free enchanted melee, 30s
//    from 7.05) and, once its six stacks are used, Prefulgence (1,200); Embolden opens Vice of Thorns (900) and
//    Acceleration Grand Impact (600). The 7.3x numbers.
//  - DT 7.0–7.01: Magicked Swordplay lasts 15s; Verthunder / Veraero III 420, Verflare / Verholy 620, Scorch 700,
//    Resolution 800, Vice of Thorns 700, Prefulgence 900, the melee 300 / 360 / 540, 60% AoE falloff; launch gear.
//  - DT 7.4–7.57: Manafication readies Prefulgence at once and no longer gives +5% stacks; Embolden is +10% to your own
//    magic; Vice of Thorns 950.
// Numbers are the game data at 6.58, 7.0, 7.01, 7.38 and 7.57 and the Lodestone notes; gear is The Balance's set for each tier. ref: a
// scripted bot parses about 11,840 / 29,970 on these (7.4–7.57 about 40,100, 7.0–7.01 about 20,050).
(function (B) {
  const SHB = B.RedMageShB;
  const VERSIONS = {
    ew60: { label: 'Endwalker 6.0–6.58', history: 'EW 6.0–6.58', level: 90, dt: false, jolt: ['jolt2', 'Jolt II', 320], ver: 380, proc: 340, fin: 600, scorch: 680, res: 750,
      melee: [280, 340, 500], fleche: 460, contre: 380, swift: 60, combo: 15, manaDur: 15, tincture: 'int', ref: 12550, model: 'rdm-ew',
      stats: { hp: 70000, main: 3379, wd: 132, det: 1601, crit: 2514, dh: 1616, speed: 502 },
      gear: 'The Balance\'s 6.5 set at 2.48 (Intelligence 3,379, 132 magic damage)',
      note: 'Level 90: Mana Stacks into Verflare / Verholy, Scorch and Resolution, Manafication\'s 50|50 and six +5% GCDs, a flat 5% Embolden, two Accelerations; Anabaseios gear' },
    dt705: { label: 'Dawntrail 7.05–7.38', history: 'DT 7.05–7.38', level: 100, dt: true, jolt: ['jolt3', 'Jolt III', 360], ver: 440, proc: 380, fin: 650, scorch: 750, res: 850,
      melee: [340, 380, 560], meleeBase: [190, 190], fleche: 480, contre: 420, swift: 40, combo: 30, manaDur: 30, tincture: 'intdt3', ref: 31770, model: 'rdm-dt',
      stats: { hp: 110000, main: 5643, wd: 152, det: 2566, crit: 3399, dh: 1764, speed: 420 },
      gear: 'The Balance\'s 7.2 xivgear "2.5 BiS" (Intelligence 5,643, 152 magic damage)',
      note: 'Level 100: Magicked Swordplay for 30s, Prefulgence, Vice of Thorns, Grand Impact; the 7.3x numbers and Cruiserweight gear' },
    dt70: { label: 'Dawntrail 7.0–7.01', history: 'DT 7.0–7.01', level: 100, dt: true, jolt: ['jolt3', 'Jolt III', 360], ver: 420, proc: 380, fin: 620, scorch: 700, res: 800,
      melee: [300, 360, 540], meleeBase: [170, 170], fleche: 480, contre: 400, swift: 40, combo: 30, manaDur: 30, swordDur: 15, vice: 700, pref: 900, falloff: 0.4,
      tincture: 'intdt1', ref: 21250, model: 'rdm-dt',
      stats: { hp: 115570, main: 4310, wd: 141, det: 1892, crit: 2534, dh: 2042, speed: 768 },
      gear: 'a launch-week caster set (The Balance\'s 7.0 Summoner pre-raid set with the i710 Skyruin Rapier: Intelligence 4,310, 141 magic damage, a 2.46 GCD; no Red Mage set was published)',
      note: 'Level 100 at launch: Magicked Swordplay for only 15s, Vice of Thorns 700, Prefulgence 900, 60% AoE falloff; launch-week gear' },
    dt74: { label: 'Dawntrail 7.4–7.57', history: 'DT 7.4–7.57', level: 100, dt: true, jolt: ['jolt3', 'Jolt III', 360], ver: 440, proc: 380, fin: 650, scorch: 750, res: 850,
      melee: [340, 380, 560], meleeBase: [190, 190], fleche: 480, contre: 420, swift: 40, combo: 30, manaDur: 30, vice: 950, pref: 1200, emboldenSelf: 1.10, manaStacks: false,
      tincture: 'intdt4', ref: 42500, model: 'rdm-dt',
      stats: { hp: 205237, main: 6513, wd: 158, det: 2287, crit: 3576, dh: 2230, speed: 420 },
      gear: 'The Balance\'s 7.4 "2.50" set (Intelligence 6,513, 158 magic damage), with a Grade 4 Gemdraught',
      note: 'Level 100: Manafication readies Prefulgence at once with no +5% stacks, Embolden +10% to your own magic, Vice of Thorns 950; the 7.4 savage gear' },
  };
  const spell = (o) => Object.assign({ kind: 'gcd', target: true, range: 25, delay: 0.7, spell: true, magic: true, breaksCombo: true, sound: 'paradox', fx: 'gnbBurst' }, o);
  const melee = (o) => Object.assign({ kind: 'gcd', target: true, range: B.MELEE_RANGE, delay: 0.5, magic: true, fx: 'gnbSlash2' }, o);
  const ab = (o) => Object.assign({ kind: 'ogcd' }, o);
  const ACCEL = { verthunder3: 1, veraero3: 1, impact: 1 };

  class RedMageEW extends SHB {
    constructor(version) {
      super('shb51');
      const V = VERSIONS[version];
      this.V = Object.assign({}, this.V, V, { accel: { stacks: 1, dur: 20, recast: 55 } });
      this.level = V.level;
      this.levelKey = V.level;
      this.model = V.model;
      this.comboTime = V.combo;
      const J = V.jolt[0];
      const A = Object.assign({}, this.actions);
      for (const k of ['jolt2', 'verthunder', 'veraero', 'enchantedReprise', 'reprise', 'moulinet', 'enchantedMoulinet']) delete A[k];
      A[J] = spell({ name: V.jolt[1], potency: V.jolt[2], cast: 2, mp: 200, black: 2, white: 2, dropsStacks: true, desc: `Deals unaspected damage with a potency of ${V.jolt[2]}.\nAdditional Effect: Increases both Black Mana and White Mana by 2\n※Changes to Scorch, then Resolution, after Verflare or Verholy.` });
      A.verthunder3 = spell({ name: 'Verthunder III', potency: V.ver, cast: 5, mp: 300, black: 6, procs: 'verfireReady', dropsStacks: true, fx: 'gnbZone', desc: `Deals lightning damage with a potency of ${V.ver}.\nAdditional Effect: Increases Black Mana by 6\nAdditional Effect: 50% chance of becoming Verfire Ready\nDuration: 30s\n※Changes to Verflare with three Mana Stacks.` });
      A.veraero3 = spell({ name: 'Veraero III', potency: V.ver, cast: 5, mp: 300, white: 6, procs: 'verstoneReady', dropsStacks: true, fx: 'gnbZone', desc: `Deals wind damage with a potency of ${V.ver}.\nAdditional Effect: Increases White Mana by 6\nAdditional Effect: 50% chance of becoming Verstone Ready\nDuration: 30s\n※Changes to Verholy with three Mana Stacks.` });
      Object.assign(A.verfire, { potency: V.proc, black: 5, dropsStacks: true, desc: `Deals fire damage with a potency of ${V.proc}.\nAdditional Effect: Increases Black Mana by 5\nCan only be executed while Verfire Ready is active.` });
      Object.assign(A.verstone, { potency: V.proc, white: 5, dropsStacks: true, desc: `Deals earth damage with a potency of ${V.proc}.\nAdditional Effect: Increases White Mana by 5\nCan only be executed while Verstone Ready is active.` });
      A.verfire = Object.assign({}, A.verfire); A.verstone = Object.assign({}, A.verstone);
      A.verflare = spell({ name: 'Verflare', potency: V.fin, mp: 400, black: 11, finisher: 'verfireReady', comboStart: true, comboNext: true, breaksCombo: undefined, fx: 'gnbDouble', desc: `Deals fire damage with a potency of ${V.fin} to target and all enemies nearby it.\nAdditional Effect: Increases Black Mana by 11\nAdditional Effect: 20% chance of becoming Verfire Ready (100% if White Mana is higher)\nDuration: 30s\nMana Stack Cost: 3` });
      A.verholy = spell({ name: 'Verholy', potency: V.fin, mp: 400, white: 11, finisher: 'verstoneReady', comboStart: true, comboNext: true, comboAs: 'verflare', breaksCombo: undefined, fx: 'gnbDouble', desc: `Deals unaspected damage with a potency of ${V.fin} to target and all enemies nearby it.\nAdditional Effect: Increases White Mana by 11\nAdditional Effect: 20% chance of becoming Verstone Ready (100% if Black Mana is higher)\nDuration: 30s\nMana Stack Cost: 3` });
      A.scorch = spell({ name: 'Scorch', potency: V.scorch, mp: 400, black: 4, white: 4, comboFrom: 'verflare', comboNext: true, breaksCombo: undefined, fx: 'gnbZone', desc: `Deals unaspected damage with a potency of ${V.scorch} to target and all enemies nearby it.\nCombo Action: Verflare or Verholy\nAdditional Effect: Increases both Black Mana and White Mana by 4` });
      A.resolution = spell({ name: 'Resolution', potency: V.res, mp: 400, black: 4, white: 4, comboFrom: 'scorch', breaksCombo: undefined, fx: 'gnbZone', desc: `Deals unaspected damage with a potency of ${V.res} to all enemies in a straight line before you.\nCombo Action: Scorch\nAdditional Effect: Increases both Black Mana and White Mana by 4` });
      Object.assign(A, {
        impact: spell({ name: 'Impact', potency: 210, cast: 5, mp: 400, black: 3, white: 3, aoe: true, dropsStacks: true, desc: 'Deals unaspected damage with a potency of 210 to target and all enemies nearby it.\nAcceleration Potency: 260\nAdditional Effect: Increases both Black Mana and White Mana by 3' }),
        enchantedRiposte: melee({ name: 'Enchanted Riposte', potency: V.melee[0], mana: 20, fixedRecast: 1.5, comboStart: true, comboNext: true, comboAs: 'riposte', stack: true, desc: `Deals unaspected damage with a potency of ${V.melee[0]}.\nBalance Gauge Cost: 20 Black Mana and 20 White Mana\nAdditional Effect: Grants a Mana Stack` }),
        enchantedZwerchhau: melee({ name: 'Enchanted Zwerchhau', potency: V.meleeBase ? V.meleeBase[0] : 150, comboPotency: V.melee[1], mana: 15, fixedRecast: 1.5, comboFrom: 'riposte', comboNext: true, comboAs: 'zwerchhau', stack: true, desc: `Deals unaspected damage with a potency of 150.\nCombo Action: Riposte or Enchanted Riposte\nCombo Potency: ${V.melee[1]}\nBalance Gauge Cost: 15 Black Mana and 15 White Mana\nAdditional Effect: Grants a Mana Stack` }),
        enchantedRedoublement: melee({ name: 'Enchanted Redoublement', potency: V.meleeBase ? V.meleeBase[1] : 130, comboPotency: V.melee[2], mana: 15, fixedRecast: 2.2, comboFrom: 'zwerchhau', stack: true, fx: 'gnbDouble', desc: `Deals unaspected damage with a potency of 130.\nCombo Action: Enchanted Zwerchhau\nCombo Potency: ${V.melee[2]}\nBalance Gauge Cost: 15 Black Mana and 15 White Mana\nAdditional Effect: Grants a Mana Stack` }),
      });
      Object.assign(A.riposte, {}); A.riposte = Object.assign({}, A.riposte, { desc: 'Delivers an attack with a potency of 130.\nAction upgraded to Enchanted Riposte if both Black Mana and White Mana are at 20 or more.' });
      A.zwerchhau = Object.assign({}, A.zwerchhau, { desc: 'Delivers an attack with a potency of 100.\nCombo Action: Riposte or Enchanted Riposte\nCombo Potency: 150\nAction upgraded to Enchanted Zwerchhau if both Black Mana and White Mana are at 15 or more.' });
      A.redoublement = Object.assign({}, A.redoublement, { desc: 'Delivers an attack with a potency of 100.\nCombo Action: Zwerchhau or Enchanted Zwerchhau\nCombo Potency: 230\nAction upgraded to Enchanted Redoublement if both Black Mana and White Mana are at 15 or more.' });
      A.fleche = Object.assign({}, A.fleche, { potency: V.fleche, desc: `Delivers an attack with a potency of ${V.fleche}.` });
      A.contreSixte = Object.assign({}, A.contreSixte, { potency: V.contre, aoe: true, desc: `Delivers an attack with a potency of ${V.contre} to target and all enemies nearby it.` });
      A.corpsACorps = Object.assign({}, A.corpsACorps, { recast: 35, charges: 2, desc: 'Rushes target and delivers an attack with a potency of 130.\nMaximum Charges: 2' });
      A.engagement = Object.assign({}, A.engagement, { recast: 35, charges: 2, potency: 180, desc: 'Delivers an attack with a potency of 180.\nMaximum Charges: 2\nShares a recast timer with Displacement.' });
      A.displacement = Object.assign({}, A.displacement, { recast: 35, charges: 2, potency: 180, desc: 'Delivers an attack with a potency of 180.\nAdditional Effect: 15-yalm backstep\nMaximum Charges: 2\nShares a recast timer with Engagement.' });
      A.acceleration = ab({ name: 'Acceleration', recast: 55, charges: 2, desc: `Ensures the next Verthunder III, Veraero III or Impact can be cast immediately; Verthunder III and Veraero III will trigger Verfire Ready or Verstone Ready.\nDuration: 20s${V.dt ? '\nAdditional Effect: Grants Grand Impact Ready\nDuration: 30s' : ''}\nMaximum Charges: 2` });
      A.embolden = ab({ name: 'Embolden', recast: 120, desc: `Increases own magic damage dealt by 5% and damage dealt by nearby party members by 5%.\nDuration: 20s${V.dt ? '\nAdditional Effect: Grants Thorned Flourish\nDuration: 30s' : ''}` });
      A.manafication = ab({ name: 'Manafication', recast: 110, desc: V.dt
        ? 'Grants 3 stacks of Magicked Swordplay: enchanted melee without mana costs\nDuration: 30s\nAdditional Effect: Grants 6 stacks of Manafication: +5% magic damage for your next six weaponskills and spells\nDuration: 30s\nAdditional Effect: Grants Prefulgence Ready upon consuming all six stacks\nCan only be executed while in combat. All combos are cancelled.'
        : 'Increases both Black Mana and White Mana by 50.\nAdditional Effect: Grants 6 stacks of Manafication: +5% magic damage for your next six weaponskills and spells\nDuration: 15s\nCan only be executed while in combat. All combos are cancelled.' });
      A.swiftcast = Object.assign({}, A.swiftcast, { recast: V.swift });
      if (V.dt) {
        A.grandImpact = spell({ name: 'Grand Impact', potency: 600, mp: 0, black: 3, white: 3, aoe: V.falloff || 0.45, ready: 'grandImpactReady', breaksCombo: undefined, fx: 'gnbZone', desc: 'Deals unaspected damage with a potency of 600 to target and all enemies nearby it, 55% less for the rest.\nAdditional Effect: Increases both Black Mana and White Mana by 3\nCan only be executed while under the effect of Grand Impact Ready.' });
        A.viceOfThorns = ab({ name: 'Vice of Thorns', recast: 1, potency: V.vice || 900, target: true, range: 25, aoe: V.falloff || 0.45, ready: 'thornedFlourish', delay: 0.6, fx: 'gnbBow', desc: 'Delivers an attack with a potency of 900 to target and all enemies nearby it, 55% less for the rest.\nCan only be executed while under the effect of Thorned Flourish.' });
        A.prefulgence = ab({ name: 'Prefulgence', recast: 1, potency: V.pref || 1200, target: true, range: 25, aoe: V.falloff || 0.45, ready: 'prefulgenceReady', delay: 0.6, fx: 'gnbDouble', desc: 'Delivers an attack with a potency of 1,200 to target and all enemies nearby it, 55% less for the rest.\nCan only be executed while under the effect of Prefulgence Ready.' });
      }
      A.lucidDreaming = Object.assign({}, A.lucidDreaming, { desc: 'Gradually restores own MP.\nPotency: 55\nDuration: 21s' });
      A.tincture = B.tincture(V.tincture);
      this.actions = A;
      this.statuses = Object.assign({}, this.statuses, {
        manafication: { name: 'Manafication', self: true, icon: 'st_manafication' },
        magickedSwordplay: { name: 'Magicked Swordplay', self: true, icon: 'st_swordplay' },
        thornedFlourish: { name: 'Thorned Flourish', self: true, icon: 'st_thorns' },
        grandImpactReady: { name: 'Grand Impact Ready', self: true, icon: 'st_gimpact' },
        prefulgenceReady: { name: 'Prefulgence Ready', self: true, icon: 'st_prefulgence' },
      });
      this.stats = Object.assign({ mainStat: 'int', jobMod: 115, trait: 130, delay: 3.44 }, V.stats);
      this.selfStatusOrder = ['dualcast', 'verfireReady', 'verstoneReady', 'acceleration', 'embolden', 'manafication', 'magickedSwordplay', 'thornedFlourish',
        'grandImpactReady', 'prefulgenceReady', 'swiftcast', 'medicated', 'lucidDreaming', 'surecast', 'sprint'];
      this.defaultBars = [
        [J, 'verthunder3', 'veraero3', 'verfire', 'verstone', 'riposte', 'zwerchhau', 'redoublement', 'fleche', 'contreSixte', 'corpsACorps', 'engagement'],
        ['acceleration', 'embolden', 'manafication', 'swiftcast', 'lucidDreaming', 'tincture', 'displacement', 'addle', 'surecast', 'vercure', 'verraise', V.dt ? 'viceOfThorns' : null],
        ['impact', V.dt ? 'grandImpact' : null, 'sprint', null, null, null, null, null, null, null, null, null],
      ];
      this.actionGroups = [
        ['Red Mage', [J, 'verthunder3', 'veraero3', 'verfire', 'verstone', 'verflare', 'verholy', 'scorch', 'resolution', 'impact', ...(V.dt ? ['grandImpact'] : []),
          'riposte', 'zwerchhau', 'redoublement', 'fleche', 'contreSixte', 'corpsACorps', 'displacement', 'engagement', 'acceleration', 'embolden', 'manafication',
          ...(V.dt ? ['viceOfThorns', 'prefulgence'] : []), 'vercure', 'verraise']],
        ['Role Actions', ['swiftcast', 'lucidDreaming', 'surecast', 'addle']],
        ['General', ['sprint', 'tincture']],
      ];
      this.referenceDps = V.ref;
      this.referenceGcd = 2.5;
    }

    initGauge() { return Object.assign(super.initGauge(), { stacks: 0 }); }

    sword(e) { return this.V.dt && e.has('magickedSwordplay'); }

    resolveId(id, e) {
      const g = e.g, J = this.V.jolt[0];
      switch (id) {
        case 'riposte': return this.both(e, 20) || this.sword(e) ? 'enchantedRiposte' : id;
        case 'zwerchhau': return this.both(e, 15) || this.sword(e) ? 'enchantedZwerchhau' : id;
        case 'redoublement': return this.both(e, 15) || this.sword(e) ? 'enchantedRedoublement' : id;
        case 'verthunder3': return g.stacks >= 3 ? 'verflare' : id;
        case 'veraero3': return g.stacks >= 3 ? 'verholy' : id;
        case 'manafication': return this.V.dt && e.has('prefulgenceReady') ? 'prefulgence' : id;
        case 'embolden': return this.V.dt && e.has('thornedFlourish') && e.cdOf('embolden') && e.availableAt('embolden') > e.now ? 'viceOfThorns' : id;
      }
      if (id === J || id === 'impact') {
        if (e.inCombo('scorch')) return 'resolution';
        if (e.inCombo('verflare')) return 'scorch';
        if (this.V.dt && id === J && e.has('grandImpactReady')) return 'grandImpact';
      }
      return id;
    }

    check(id, e) {
      const a = this.actions[id], g = e.g;
      if (a.ready && !e.has(a.ready)) return 'Unable to execute action.';
      if (a.mana && !this.both(e, a.mana) && !this.sword(e)) return 'Not enough mana.';
      if (a.finisher && g.stacks < 3) return 'Unable to execute action. Mana Stacks required.';
      if (id === 'scorch' && !e.inCombo('verflare')) return 'Unable to execute action.';
      if (id === 'resolution' && !e.inCombo('scorch')) return 'Unable to execute action.';
      if (id === 'manafication' && !e.inCombat) return 'Unable to execute action while not in combat.';
      return null;
    }

    castTime(id, e) {
      const a = this.actions[id];
      if (!a.cast) return 0;
      if ((ACCEL[id] && e.has('acceleration')) || e.has('dualcast') || e.has('swiftcast')) return 0;
      return e.speedScale(a.cast, 0);
    }
    // Acceleration first (for the spells it covers), then Dualcast, then Swiftcast.
    consumeInstant(id, e) {
      if (!this.actions[id].cast) return;
      const g = e.g;
      g.instant = true;
      if (ACCEL[id] && e.has('acceleration')) { e.removeStatus('acceleration'); g.accelUsed = true; }
      else if (e.has('dualcast')) e.removeStatus('dualcast');
      else if (e.has('swiftcast')) e.removeStatus('swiftcast');
    }

    snapshot(a, e) {
      let mult = 1;
      if (a && a.magic) {
        if (e.has('embolden')) mult *= this.V.emboldenSelf || 1.05;
        if (e.has('manafication')) mult *= 1.05;
      }
      const main = this.stats.main + (e.has('medicated') ? B.TINCTURES[this.V.tincture].cap : 0);
      return { mult, main };
    }

    resolve(id, e) {
      const a = this.actions[id], g = e.g, V = this.V;
      const hard = a.cast && !g.instant;
      const accel = !!g.accelUsed;
      g.instant = false; g.accelUsed = false;
      const snap = this.snapshot(a, e);
      if (a.kind === 'gcd') {
        if (a.spell) e.mp -= a.mp || 0;
        else if (e.has('dualcast')) e.removeStatus('dualcast');
        // Manafication's stacks: one per weaponskill or spell; in Dawntrail the last one readies Prefulgence.
        if (e.has('manafication')) {
          const s = e.statuses.manafication;
          s.stacks = (s.stacks || 1) - 1;
          if (s.stacks <= 0) { e.removeStatus('manafication'); if (V.dt) e.addStatus('prefulgenceReady', 30); }
          else e.emit('statusStack', { key: 'manafication' });
        }
      }
      if (a.mana) {
        if (this.sword(e)) {
          const s = e.statuses.magickedSwordplay;
          s.stacks = (s.stacks || 1) - 1;
          if (s.stacks <= 0) e.removeStatus('magickedSwordplay'); else e.emit('statusStack', { key: 'magickedSwordplay' });
        } else { g.black -= a.mana; g.white -= a.mana; }
      }
      if (a.stack) g.stacks = Math.min(3, g.stacks + 1);
      if (a.dropsStacks) g.stacks = 0;
      if (a.ready) e.removeStatus(a.ready);
      let potency = a.comboPotency && e.lastComboHit ? a.comboPotency : a.potency || 0;
      if (id === 'impact' && accel) potency = 260;
      switch (id) {
        case 'verthunder3': case 'veraero3': case 'verflare': case 'verholy': {
          const blackLow = g.black < g.white, whiteLow = g.white < g.black;
          if (a.finisher) g.stacks = 0;
          this.gain(e, a.black || 0, a.white || 0);
          let chance = a.procs ? (accel ? 1 : 0.5) : 0.2;
          if (a.finisher && ((id === 'verflare' && blackLow) || (id === 'verholy' && whiteLow))) chance = 1;
          if (Math.random() < chance) e.addStatus(a.procs || a.finisher, 30);
          break;
        }
        case 'acceleration': e.addStatus('acceleration', 20); if (V.dt) e.addStatus('grandImpactReady', 30); break;
        case 'embolden': e.addStatus('embolden', 20); if (V.dt) e.addStatus('thornedFlourish', 30); break;
        case 'manafication':
          if (!V.dt) {
            const imb = Math.abs(g.black - g.white) > 30;
            const lowB = g.black < g.white;
            g.black = Math.min(100, g.black + (imb && lowB ? 25 : 50));
            g.white = Math.min(100, g.white + (imb && !lowB ? 25 : 50));
          } else e.addStatus('magickedSwordplay', V.swordDur || 30, { stacks: 3 });
          e.combo = null;
          // 7.4: no +5% stacks; Prefulgence is ready at once.
          if (V.manaStacks === false) e.addStatus('prefulgenceReady', 30);
          else e.addStatus('manafication', V.manaDur, { stacks: 6 });
          break;
        case 'corpsACorps': this.gap(e); break;
        case 'displacement': {
          const d = e.distToTarget() || 1;
          const from = { x: e.pos.x, z: e.pos.z };
          e.pos.x += e.pos.x / d * 15; e.pos.z += e.pos.z / d * 15;
          e.emit('teleport', { from, to: { x: e.pos.x, z: e.pos.z } });
          break;
        }
        default:
          if (a.black || a.white) this.gain(e, a.black || 0, a.white || 0);
          if (B.ROLE_EFFECTS[id]) B.ROLE_EFFECTS[id](e);
      }
      if (hard) e.addStatus('dualcast', 15);
      if (potency) e.queueHit(id, potency, snap, a.delay);
    }

    proc(id, e) {
      const a = this.actions[id], g = e.g;
      if (a.comboFrom && e.inCombo(a.comboFrom)) return true;
      if (a.ready) return e.has(a.ready);
      if (a.finisher) return g.stacks >= 3;
      if (id === 'riposte' || id === 'enchantedRiposte') return this.both(e, 50) || this.sword(e);
      return false;
    }

    lucidGain() { return 550; }
    speedInfo(e) { return `GCD ${e.gcdForSpeed(e.stats.speed).toFixed(2)} · enchanted melee 1.5 / 1.5 / 2.2s · Verthunder III ${e.speedScale(5).toFixed(2)}s cast`; }

    gaugeUpdate(e) {
      super.gaugeUpdate(e);
      const g = e.g, G = this.rg;
      const t = Math.abs(g.black - g.white) > 30 ? 'IMBALANCED' : '';
      const s = `${g.stacks ? `MANA STACKS ×${g.stacks}` : ''}${g.stacks && t ? '  ·  ' : ''}${t}`;
      if (G.cache.st !== s) { G.cache.st = s; G.s.textContent = s; G.cache.s = null; }
    }

    helpHtml(seq) {
      const V = this.V, J = V.jolt[0];
      const opener = V.dt
        ? seq(['veraero3', 'verthunder3', ['swiftcast'], 'verthunder3', ['tincture'], ['fleche'], 'verthunder3', ['acceleration'], ['embolden'], ['manafication'], 'riposte', ['contreSixte'], 'zwerchhau', ['engagement'], 'redoublement', ['corpsACorps'], 'verholy', ['viceOfThorns'], J, ['engagement'], ['corpsACorps'], J, ['prefulgence'], 'grandImpact', ['acceleration'], 'verfire', 'grandImpact', 'verthunder3', ['fleche']])
        : seq(['verthunder3', 'veraero3', ['swiftcast'], ['acceleration'], 'verthunder3', ['tincture'], 'verthunder3', ['embolden'], ['manafication'], 'riposte', ['fleche'], 'zwerchhau', ['contreSixte'], 'redoublement', ['corpsACorps'], ['engagement'], 'verholy', ['corpsACorps'], ['engagement'], J, J, 'verfire', 'verthunder3', 'verstone', 'veraero3', J, 'verthunder3', ['fleche']]);
      return `
<h3>How it plays (${V.label})</h3>
<p>Level ${V.level} Red Mage. A hardcast spell grants <b>Dualcast</b>: hardcast <b>${V.jolt[1]}</b> (${V.jolt[2]}, +2 each) or a <b>Verfire / Verstone</b> proc (${V.proc}, +5), then Dualcast <b>Verthunder III</b> or <b>Veraero III</b> (${V.ver}, +6, 50% to proc) for the lower mana; gains to the lower one are halved while the other is more than 30 ahead.</p>
<p>At 50|50, the melee combo (Riposte → Zwerchhau → Redoublement: ${V.melee.join(' / ')}, costing 20 / 15 / 15) builds three <b>Mana Stacks</b>, which turn Verthunder III / Veraero III into <b>Verflare</b> / <b>Verholy</b> (${V.fin}, a sure proc for the lower mana); then ${V.jolt[1]} becomes <b>Scorch</b> (${V.scorch}) and <b>Resolution</b> (${V.res}). Casting any other spell before the finisher drops the stacks. <b>Embolden</b> (+${V.emboldenSelf ? 10 : 5}% to your magic, 120s) and <b>Manafication</b> (110s: ${V.manaStacks === false ? `three Magicked Swordplay stacks for a free melee combo and Prefulgence (${(V.pref || 1200).toLocaleString()}) at once` : V.dt ? `three Magicked Swordplay stacks (${V.swordDur || 30}s) for a free melee combo, +5% to your next six GCDs, and Prefulgence (${(V.pref || 1200).toLocaleString()}) once those six stacks are used` : '50|50 mana, +5% to your next six GCDs'}) go together into melee. <b>Acceleration</b> (two charges) makes the next Verthunder III / Veraero III instant with a sure proc${V.dt ? ' and opens <b>Grand Impact</b> (600)' : ''}.${V.dt ? ' Embolden also opens <b>Vice of Thorns</b> (900).' : ''} Fleche (${V.fleche}), Contre Sixte (${V.contre}), Engagement and Corps-a-corps (two charges each) weave between, never between a hardcast and its Dualcast.</p>
<h3>The opener (The Balance)</h3>
${opener}
<p>${V.dt ? 'Veraero III' : 'Verthunder III'} hardcast from −5s. Procs are random; Verholy or Verflare depends on which mana is lower.</p>
<p style="color:#a9a3b4">The ${V.label.replace(/^\S+ /, '')} numbers: ${V.jolt[1]} ${V.jolt[2]}, Verthunder / Veraero III ${V.ver}, Verfire / Verstone ${V.proc}, Verflare / Verholy ${V.fin}, Scorch ${V.scorch}, Resolution ${V.res}, Enchanted Riposte / Zwerchhau / Redoublement ${V.melee.join(' / ')}, Fleche ${V.fleche}, Contre Sixte ${V.contre}, Corps-a-corps 130, Engagement 180${V.dt ? `, Grand Impact 600, Vice of Thorns ${V.vice || 900}, Prefulgence ${(V.pref || 1200).toLocaleString()}` : ''}. Gear: ${V.gear}.</p>`;
    }
  }

  B.registerJob({
    id: 'rdm', name: 'Red Mage', abbr: 'RDM', role: 'caster', classJob: 35,
    versions: ['dt74', 'dt705', 'dt70', 'ew60'].map(v => ({ id: v, label: VERSIONS[v].label, history: VERSIONS[v].history, note: VERSIONS[v].note, create: () => new RedMageEW(v) })),
  });
})(window.BLM);
