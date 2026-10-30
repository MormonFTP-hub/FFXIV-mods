// Warrior, Stormblood at level 70, in three versions. Weaponskills on TP; the Beast Gauge fills from the combos (Skull
// Sunder, Butcher's Block, Maim and Storm's Eye +10, Storm's Path +20) and Infuriate (+50, 60s, 5s less for every gauge
// spender), and pays 50 for Fell Cleave (Deliverance) or Inner Beast (Defiance), 20 for Upheaval (300, ×1.2 under Thrill
// of Battle's extra HP) and Onslaught. Deliverance is +5% damage and +0.1% crit per gauge point; Defiance (the tank
// stance) −20%. Maim lowers the dummy's slashing resistance 10% (24s); Storm's Eye is a damage buff on yourself (30s).
//  - 4.0–4.01: as 4.05, but Inner Release and Unchained cost 20 Beast Gauge, Storm's Path is 250, Heavy Swing costs 70 TP
//    and swapping stance halves the gauge (2017's job guide, the 4.05 notes and wiki revisions).
//  - 4.05–4.06: Berserk +30% for 20s (60s); Inner Release (120s, 20s) halves gauge costs; Storm's Eye +20%. Fell Cleave
//    and Inner Beast are separate buttons, each usable only in its stance.
//  - 4.1–4.18: the same numbers; Inner Beast and Steel Cyclone turn into Fell Cleave and Decimate in Deliverance.
//  - 4.2–4.58: Berserk becomes Inner Release (90s, 10s): gauge actions free and every hit a critical direct hit,
//    auto-attacks too; Storm's Eye +10%; Heavy Swing 160, Skull Sunder 210, Butcher's Block 300, Maim 200, Storm's Path
//    and Storm's Eye 280, Fell Cleave 520.
// Numbers are the game data at 4.11–4.58 (xivapi's datamining; nothing that changes damage differs between 4.05 and
// 4.11) and the Lodestone notes. Gear: the Warrior 4.0/4.1 guide's 2.44 Genji set, and The Balance's 4.4 Paladin set with
// the Omega Battleaxe (no Warrior set was published for it); pre-6.0 stats from the 4.58 Item.csv.
(function (B) {
  const EPS = 1e-6;
  const GAUGE_MAX = 100;
  // ref: a scripted bot parses about 4,270 (4.2) and 2,940 (4.05 and 4.1, the same numbers) over 5 minutes.
  const VERSIONS = {
    sb42: { label: 'Stormblood 4.2–4.58', history: 'SB 4.2–4.58', ir42: true, swap: true, eye: 1.10, ref: 4520,
      pot: { heavySwing: 160, skullSunder: 210, butchersBlock: 300, maim: 200, stormsPath: 280, stormsEye: 280, fellCleave: 520, overpower: 130, tomahawk: 140 },
      stats: { hp: 76650, main: 2688, wd: 109, det: 1653, crit: 1978, dh: 738, speed: 1202, ten: 1064 }, tincture: 'str3sb',
      gear: 'The Balance\'s 4.4 Paladin set with the Omega Battleaxe (Strength 2,688, 109 weapon damage, 2.37 GCD)',
      note: 'Level 70: Inner Release for ten seconds of free, critical direct-hit Fell Cleaves, Upheaval and Onslaught, Infuriate, Storm\'s Eye +10%; Alphascape gear' },
    sb41: { label: 'Stormblood 4.1–4.18', history: 'SB 4.1–4.18', ir42: false, swap: true, eye: 1.20, ref: 3120,
      stats: { hp: 52979, main: 2132, wd: 100, det: 1448, crit: 1146, dh: 1222, speed: 699, ten: 1360 }, tincture: 'str1sb',
      gear: 'the 4.0/4.1 guide\'s 2.44 Genji set (Strength 2,132, 100 weapon damage)',
      note: 'Level 70: Berserk +30%, Inner Release halving gauge costs, Storm\'s Eye +20%; Deliverance turns Inner Beast into Fell Cleave; Deltascape gear' },
    sb40: { label: 'Stormblood 4.0–4.01', history: 'SB 4.0–4.01', ir42: false, swap: false, eye: 1.20, ref: 3110, irCost: 20, hsTp: 70,
      pot: { stormsPath: 250 },
      stats: { hp: 52979, main: 2132, wd: 100, det: 1448, crit: 1146, dh: 1222, speed: 699, ten: 1360 }, tincture: 'str1sb',
      gear: 'the 4.0/4.1 guide\'s 2.44 Genji set (Strength 2,132, 100 weapon damage)',
      note: 'Level 70, the launch: the Beast Gauge (halved by stance swaps), Inner Release and Unchained for 20 gauge, Berserk +30%; i340 gear' },
    sb405: { label: 'Stormblood 4.05–4.06', history: 'SB 4.05–4.06', ir42: false, swap: false, eye: 1.20, ref: 3120,
      stats: { hp: 52979, main: 2132, wd: 100, det: 1448, crit: 1146, dh: 1222, speed: 699, ten: 1360 }, tincture: 'str1sb',
      gear: 'the 4.0/4.1 guide\'s 2.44 Genji set (Strength 2,132, 100 weapon damage)',
      note: 'Level 70: the Beast Gauge kept through stance swaps, Berserk +30%, Inner Release halving gauge costs, Fell Cleave and Inner Beast as separate buttons; Deltascape gear' },
  };
  const ws = (o) => Object.assign({ kind: 'gcd', target: true, range: B.MELEE_RANGE, delay: 0.55, fx: 'gnbSlash' }, o);
  const ab = (o) => Object.assign({ kind: 'ogcd' }, o);

  function buildActions(V) {
    const P = Object.assign({ heavySwing: 150, skullSunder: 200, butchersBlock: 280, maim: 190, stormsPath: 270, stormsEye: 270, fellCleave: 500, overpower: 120, tomahawk: 130 }, V.pot || {});
    const eye = Math.round((V.eye - 1) * 100);
    const A = {
      heavySwing: ws({ name: 'Heavy Swing', potency: P.heavySwing, tp: V.hsTp || 60, comboStart: true, comboNext: true, desc: `Delivers an attack with a potency of ${P.heavySwing}.` }),
      skullSunder: ws({ name: 'Skull Sunder', potency: 100, comboPotency: P.skullSunder, comboFrom: 'heavySwing', comboNext: true, tp: 60, beast: 10, desc: `Delivers an attack with a potency of 100.\nCombo Action: Heavy Swing\nCombo Potency: ${P.skullSunder}\nCombo Bonus: Increases Beast Gauge by 10` }),
      butchersBlock: ws({ name: 'Butcher\'s Block', potency: 100, comboPotency: P.butchersBlock, comboFrom: 'skullSunder', tp: 60, beast: 10, fx: 'gnbBurst', desc: `Delivers an attack with a potency of 100.\nCombo Action: Skull Sunder\nCombo Potency: ${P.butchersBlock}\nCombo Bonus: Increases Beast Gauge by 10` }),
      maim: ws({ name: 'Maim', potency: 100, comboPotency: P.maim, comboFrom: 'heavySwing', comboNext: true, tp: 60, beast: 10, fx: 'gnbSlash2', desc: `Delivers an attack with a potency of 100.\nCombo Action: Heavy Swing\nCombo Potency: ${P.maim}\nCombo Bonus: Reduces target's slashing resistance by 10%\nDuration: 24s\nCombo Bonus: Increases Beast Gauge by 10` }),
      stormsPath: ws({ name: 'Storm\'s Path', potency: 100, comboPotency: P.stormsPath, comboFrom: 'maim', tp: 60, beast: 20, fx: 'gnbBurst', desc: `Delivers an attack with a potency of 100.\nCombo Action: Maim\nCombo Potency: ${P.stormsPath}\nCombo Bonus: Absorbs a portion of damage dealt as HP\nCombo Bonus: Increases Beast Gauge by 20` }),
      stormsEye: ws({ name: 'Storm\'s Eye', potency: 100, comboPotency: P.stormsEye, comboFrom: 'maim', tp: 60, beast: 10, fx: 'gnbBurst', desc: `Delivers an attack with a potency of 100.\nCombo Action: Maim\nCombo Potency: ${P.stormsEye}\nCombo Bonus: Increases damage dealt by ${eye}%\nDuration: 30s\nCombo Bonus: Increases Beast Gauge by 10` }),
      overpower: ws({ name: 'Overpower', potency: P.overpower, tp: 120, range: 8, aoe: true, breaksCombo: true, desc: `Delivers an attack with a potency of ${P.overpower} to all enemies in a cone before you.` }),
      tomahawk: ws({ name: 'Tomahawk', potency: P.tomahawk, tp: 120, range: 15, breaksCombo: true, delay: 0.7, fx: 'enpi', desc: `Throws an axe, dealing damage with a potency of ${P.tomahawk}.\nAdditional Effect: Increased enmity` }),
      fellCleave: ws({ name: 'Fell Cleave', potency: P.fellCleave, cost: 50, spender: true, stance: 'deliverance', fx: 'gnbDouble', desc: `Delivers an attack with a potency of ${P.fellCleave}.\nBeast Gauge Cost: 50\nCan only be executed in Deliverance.` }),
      decimate: ws({ name: 'Decimate', potency: 280, cost: 50, spender: true, stance: 'deliverance', target: false, pbaoe: 5, aoe: true, fx: 'gnbBow', desc: 'Delivers an attack with a potency of 280 to all nearby enemies.\nBeast Gauge Cost: 50\nCan only be executed in Deliverance.' }),
      innerBeast: ws({ name: 'Inner Beast', potency: 350, cost: 50, spender: true, stance: 'defiance', ignoresDefiance: true, fx: 'gnbDouble', desc: 'Delivers an attack with a potency of 350.\nAdditional Effect: Absorbs a portion of damage dealt as HP and reduces damage taken by 20%\nDuration: 6s\nBeast Gauge Cost: 50\nIgnores the damage penalty from Defiance. Can only be executed in Defiance.' }),
      steelCyclone: ws({ name: 'Steel Cyclone', potency: 200, cost: 50, spender: true, stance: 'defiance', ignoresDefiance: true, target: false, pbaoe: 5, aoe: true, fx: 'gnbBow', desc: 'Delivers an attack with a potency of 200 to all nearby enemies.\nBeast Gauge Cost: 50\nIgnores the damage penalty from Defiance. Can only be executed in Defiance.' }),
      // Off the GCD.
      upheaval: ab({ name: 'Upheaval', recast: 30, cost: 20, potency: 300, target: true, range: B.MELEE_RANGE, delay: 0.6, fx: 'gnbCont', desc: 'Delivers an attack with a potency of 300.\nPotency decreases as HP falls and rises with maximum HP.\nBeast Gauge Cost: 20' }),
      onslaught: ab({ name: 'Onslaught', recast: 15, cost: 20, potency: 100, target: true, range: 20, delay: 0.4, fx: 'gnbCont', desc: 'Rushes target and delivers an attack with a potency of 100.\nBeast Gauge Cost: 20' }),
      infuriate: ab({ name: 'Infuriate', recast: 60, desc: 'Increases Beast Gauge by 50.\nCan only be executed in Defiance or Deliverance, in combat.\nEnhanced Infuriate: each Fell Cleave, Decimate, Inner Beast or Steel Cyclone takes 5s off its recast.' }),
      deliverance: ab({ name: 'Deliverance', recast: 10, cdGroup: 'stance', desc: 'Increases damage dealt by 5%; each point of Beast Gauge adds 0.1% critical hit rate.\nCannot be used with Defiance.' }),
      defiance: ab({ name: 'Defiance', recast: 10, cdGroup: 'stance', desc: 'Increases maximum HP by 25% and enmity, while reducing damage dealt by 20%.\nCannot be used with Deliverance.' }),
      innerRelease: V.ir42
        ? ab({ name: 'Inner Release', recast: 90, desc: 'Beast Gauge actions cost nothing, and every attack is a critical direct hit.\nDuration: 10s\nAdditional Effect: Nullifies stun, sleep, bind, heavy, knockback and draw-in' })
        : ab({ name: 'Inner Release', recast: 120, cdGroup: 'release', cost: V.irCost, desc: `Halves the Beast Gauge cost of all actions.\nDuration: 20s\nCan only be executed in Deliverance. Shares a recast timer with Unchained.${V.irCost ? `\nBeast Gauge Cost: ${V.irCost}` : ''}` }),
      unchained: ab({ name: 'Unchained', recast: V.ir42 ? 90 : 120, cdGroup: V.ir42 ? undefined : 'release', cost: V.irCost, desc: `Nullifies the damage penalty from Defiance.\nDuration: 20s\nCan only be executed in Defiance.${V.irCost ? `\nBeast Gauge Cost: ${V.irCost}` : ''}` }),
      equilibrium: ab({ name: 'Equilibrium', recast: 60, desc: 'Defiance: restores own HP (cure potency 1,200).\nDeliverance: restores 200 TP.' }),
      thrillOfBattle: ab({ name: 'Thrill of Battle', recast: 120, desc: 'Increases maximum HP by 20% and restores the amount increased.\nDuration: 20s' }),
      vengeance: ab({ name: 'Vengeance', recast: 120, desc: 'Reduces damage taken by 30% and delivers a counter when hit.\nDuration: 15s' }),
      rawIntuition: ab({ name: 'Raw Intuition', recast: 90, desc: 'Parries all frontal attacks; attacks from the flank or rear are critical hits.\nDuration: 20s' }),
      holmgang: ab({ name: 'Holmgang', recast: 180, desc: 'Your HP cannot fall below 1.\nDuration: 6s' }),
      shakeItOff: ab({ name: 'Shake It Off', recast: 90, desc: 'Creates a barrier around yourself and nearby party members.\nDuration: 15s' }),
      // Stormblood's tank role actions (none adds damage).
      rampart: ab({ name: 'Rampart', recast: 90, role: true, desc: 'Reduces damage taken by 20%.\nDuration: 20s' }),
      lowBlow: ab({ name: 'Low Blow', recast: 25, role: true, target: true, range: 3, desc: 'Stuns target.\nDuration: 5s' }),
      provoke: ab({ name: 'Provoke', recast: 40, role: true, target: true, range: 25, desc: 'Gesture threateningly, placing yourself at the top of a target\'s enmity list.' }),
      convalescence: ab({ name: 'Convalescence', recast: 120, role: true, desc: 'Increases HP recovery via healing actions by 20%.\nDuration: 20s' }),
      anticipation: ab({ name: 'Anticipation', recast: 60, role: true, desc: 'Increases parry rate by 30%.\nDuration: 20s' }),
      reprisal: ab({ name: 'Reprisal', recast: 60, role: true, target: true, range: 3, desc: 'Reduces target\'s damage dealt by 10%.\nDuration: 5s' }),
      awareness: ab({ name: 'Awareness', recast: 120, role: true, desc: 'Nullifies the chance of suffering critical damage.\nDuration: 25s' }),
      interject: ab({ name: 'Interject', recast: 30, role: true, target: true, range: 3, desc: 'Interrupts the use of a target\'s action.' }),
      ...B.GENERAL_ACTIONS,
      tincture: B.tincture(V.tincture),
      auto: { name: 'Attack', kind: 'auto', fx: 'auto', desc: 'Auto-attack.' },
    };
    if (!V.ir42) A.berserk = ab({ name: 'Berserk', recast: 60, desc: 'Increases attack power by 30%.\nDuration: 20s' });
    return A;
  }

  const STATUSES = {
    deliverance: { name: 'Deliverance', self: true, icon: 'st_deliverance' },
    defiance: { name: 'Defiance', self: true, icon: 'st_defiance' },
    stormsEye: { name: 'Storm\'s Eye', self: true, icon: 'st_stormseye' },
    berserk: { name: 'Berserk', self: true, icon: 'st_berserk' },
    innerRelease: { name: 'Inner Release', self: true, icon: 'st_ir' },
    unchained: { name: 'Unchained', self: true, icon: 'st_unchained' },
    thrillOfBattle: { name: 'Thrill of Battle', self: true, icon: 'st_thrill' },
    vengeance: { name: 'Vengeance', self: true, icon: 'st_vengeance' },
    rawIntuition: { name: 'Raw Intuition', self: true, icon: 'st_ri' },
    holmgang: { name: 'Holmgang', self: true, icon: 'st_holmgang' },
    rampart: { name: 'Rampart', self: true, icon: 'st_rampart' },
    slashingResDown: { name: 'Slashing Resistance Down', self: false, icon: 'st_slash' },
  };

  class WarriorSB {
    constructor(version) {
      const V = VERSIONS[version];
      this.V = V;
      this.name = 'Warrior';
      this.abbr = 'WAR';
      this.role = 'tank';
      this.level = 70;
      this.levelKey = 'sb70';
      this.model = 'war-sb';
      this.actions = buildActions(V);
      this.statuses = STATUSES;
      this.tp = { max: 1000, regen: 60 };
      this.comboTime = 10;
      // Warrior's Strength modifier is 105; Tenacity raises a tank's damage. The Omega / Genji axe: 3.36 delay.
      this.stats = Object.assign({ mainStat: 'str', jobMod: 105, trait: 100, delay: 3.36 }, V.stats);
      this.speedName = 'Skill speed';
      this.tierHaste = 0;
      this.autoAttack = { potency: 110, delay: 3.36, range: B.MELEE_RANGE };
      this.selfStatusOrder = ['deliverance', 'defiance', 'stormsEye', 'innerRelease', 'berserk', 'unchained', 'thrillOfBattle', 'vengeance',
        'rawIntuition', 'holmgang', 'rampart', 'medicated', 'sprint'];
      this.targetStatusOrder = ['slashingResDown'];
      const burst = V.ir42 ? ['innerRelease'] : ['berserk', 'innerRelease'];
      this.defaultBars = [
        ['heavySwing', 'skullSunder', 'butchersBlock', 'maim', 'stormsPath', 'stormsEye', 'fellCleave', 'upheaval', 'onslaught', 'infuriate', ...burst, null].slice(0, 12),
        ['deliverance', 'defiance', 'innerBeast', 'unchained', 'equilibrium', 'thrillOfBattle', 'vengeance', 'rawIntuition', 'tomahawk', 'overpower', 'decimate', 'steelCyclone'],
        ['holmgang', 'shakeItOff', 'rampart', 'reprisal', 'convalescence', 'anticipation', 'awareness', 'lowBlow', 'provoke', 'interject', 'sprint', 'tincture'],
      ];
      this.actionGroups = [
        ['Warrior', ['heavySwing', 'skullSunder', 'butchersBlock', 'maim', 'stormsPath', 'stormsEye', 'overpower', 'tomahawk', 'fellCleave', 'decimate',
          'innerBeast', 'steelCyclone', 'upheaval', 'onslaught', 'infuriate', ...burst, 'deliverance', 'defiance', 'unchained', 'equilibrium',
          'thrillOfBattle', 'vengeance', 'rawIntuition', 'holmgang', 'shakeItOff']],
        ['Role Actions', ['rampart', 'lowBlow', 'provoke', 'convalescence', 'anticipation', 'reprisal', 'awareness', 'interject']],
        ['General', ['sprint', 'tincture']],
      ];
      this.referenceDps = V.ref;
      this.referenceGcd = V.ir42 ? 2.37 : 2.45;
      this.startDistance = 3.2;
    }

    initGauge(e) {
      e.addStatus('deliverance', 1e9, { permanent: true });
      return { beast: 0 };
    }

    stance(e) { return e.has('deliverance') ? 'deliverance' : e.has('defiance') ? 'defiance' : null; }

    // 4.1 on: Inner Beast and Steel Cyclone are Fell Cleave and Decimate in Deliverance (and the other way in Defiance).
    resolveId(id, e) {
      if (!this.V.swap) return id;
      const st = this.stance(e);
      if (st === 'deliverance') { if (id === 'innerBeast') return 'fellCleave'; if (id === 'steelCyclone') return 'decimate'; }
      if (st === 'defiance') { if (id === 'fellCleave') return 'innerBeast'; if (id === 'decimate') return 'steelCyclone'; }
      return id;
    }

    cost(id, e) {
      const a = this.actions[id];
      if (!a.cost) return 0;
      if (e.has('innerRelease')) return this.V.ir42 ? 0 : a.cost / 2;
      return a.cost;
    }

    check(id, e) {
      const a = this.actions[id], st = this.stance(e);
      if (a.stance && st !== a.stance) return `Unable to execute action. ${a.stance === 'deliverance' ? 'Deliverance' : 'Defiance'} required.`;
      if (a.cost && e.g.beast < this.cost(id, e)) return 'Not enough Beast Gauge.';
      if (id === 'infuriate' && (!st || !e.inCombat)) return 'Unable to execute action. Defiance or Deliverance required, in combat.';
      if (id === 'unchained' && st !== 'defiance') return 'Unable to execute action. Defiance required.';
      if (id === 'innerRelease' && !this.V.ir42 && st !== 'deliverance') return 'Unable to execute action. Deliverance required.';
      return null;
    }

    snapshot(a, e) {
      let mult = 1, critAdd = 0, dhAdd = 0;
      const st = this.stance(e);
      if (st === 'deliverance') { mult *= 1.05; critAdd += 0.001 * e.g.beast; }
      if (st === 'defiance' && !e.has('unchained') && !(a && a.ignoresDefiance)) mult *= 0.80;
      if (e.has('stormsEye')) mult *= this.V.eye;
      if (e.tHas('slashingResDown')) mult *= 1.10;
      if (e.has('berserk')) mult *= 1.30;
      // 4.2's Inner Release: every hit (auto-attacks too) a critical direct hit.
      if (this.V.ir42 && e.has('innerRelease')) { critAdd += 1; dhAdd += 1; }
      const main = this.stats.main + (e.has('medicated') ? B.TINCTURES[this.V.tincture].cap : 0);
      return { mult, main, critAdd, dhAdd };
    }

    gain(e, n) { e.g.beast = Math.min(GAUGE_MAX, e.g.beast + n); }

    resolve(id, e) {
      const a = this.actions[id], g = e.g;
      const snap = this.snapshot(a, e);
      if (a.cost) g.beast -= this.cost(id, e);
      if (a.spender) {
        // Enhanced Infuriate: 5s off Infuriate's recast for each spender.
        const c = e.cds.infuriate;
        if (c && c.nextAt !== null) c.nextAt = Math.max(e.now, c.nextAt - 5);
      }
      if (a.kind === 'gcd') {
        const combo = !!a.comboFrom && e.lastComboHit;
        const potency = combo ? a.comboPotency : a.potency;
        if (combo && a.beast) this.gain(e, a.beast);
        if (id === 'maim' && combo) e.addTStatus('slashingResDown', 24);
        if (id === 'stormsEye' && combo) e.addStatus('stormsEye', 30);
        e.queueHit(id, potency, snap, a.delay);
        return;
      }
      switch (id) {
        case 'upheaval': e.queueHit(id, Math.round(a.potency * (e.has('thrillOfBattle') ? 1.2 : 1)), snap, a.delay); return;
        case 'infuriate': this.gain(e, 50); return;
        case 'deliverance': case 'defiance':
          if (this.V.irCost && this.stance(e) && this.stance(e) !== id) g.beast = Math.floor(g.beast / 2);
          e.removeStatus(id === 'deliverance' ? 'defiance' : 'deliverance', true);
          e.addStatus(id, 1e9, { permanent: true });
          return;
        case 'berserk': e.addStatus('berserk', 20); return;
        case 'innerRelease': e.addStatus('innerRelease', this.V.ir42 ? 10 : 20); return;
        case 'unchained': e.addStatus('unchained', 20); return;
        case 'equilibrium': if (this.stance(e) === 'deliverance') e.tp = Math.min(this.tp.max, e.tp + 200); return;
        case 'thrillOfBattle': e.addStatus('thrillOfBattle', 20); return;
        case 'vengeance': e.addStatus('vengeance', 15); return;
        case 'rawIntuition': e.addStatus('rawIntuition', 20); return;
        case 'holmgang': e.addStatus('holmgang', 6); return;
        case 'rampart': e.addStatus('rampart', 20); return;
        case 'onslaught': this.gap(e); break;
        default:
          if (B.ROLE_EFFECTS[id]) { B.ROLE_EFFECTS[id](e); return; }
      }
      if (a.potency) e.queueHit(id, a.potency, snap, a.delay);
    }

    gap(e) {
      const d = e.distToTarget() || 1;
      if (d > 2.6) {
        const from = { x: e.pos.x, z: e.pos.z };
        e.pos.x *= 2.4 / d; e.pos.z *= 2.4 / d;
        e.emit('teleport', { from, to: { x: e.pos.x, z: e.pos.z } });
      }
    }

    proc(id, e) {
      const a = this.actions[id];
      if (a.comboFrom && e.inCombo(a.comboFrom)) return true;
      if (a.spender && !a.aoe) return e.g.beast >= this.cost(id, e) && (!a.stance || this.stance(e) === a.stance);
      return false;
    }

    mpRegen() { return B.BASE_REGEN; }
    speedInfo(e) { return `GCD ${e.gcdForSpeed(e.stats.speed).toFixed(2)} · auto-attacks every ${(this.stats.delay).toFixed(2)}s`; }

    // ---------- the Beast Gauge ----------
    gaugeBuild(root) {
      root.innerHTML = `
<svg width="360" height="100" viewBox="0 0 360 100">
  <rect x="8" y="10" width="344" height="80" rx="14" fill="rgba(14,12,20,.86)" stroke="rgba(255,255,255,.22)"/>
  <text id="wb-lbl" x="24" y="38" font-family="Noto Sans, sans-serif" font-size="11" font-weight="600" fill="#a9a3b4" letter-spacing="1">BEAST GAUGE</text>
  <rect x="24" y="52" width="250" height="14" rx="7" fill="#2a2535" stroke="rgba(0,0,0,.8)"/>
  <rect id="wb-b" x="24" y="52" width="0" height="14" rx="7" fill="#e0602a"/>
  <line x1="149" y1="48" x2="149" y2="70" stroke="rgba(255,255,255,.35)"/>
  <text id="wb-t" x="336" y="66" text-anchor="end" font-family="Saira Semi Condensed, sans-serif" font-size="18" font-weight="700" fill="#fff" stroke="#000" stroke-width="3" paint-order="stroke">0</text>
</svg>`;
      const $ = (s) => root.querySelector(s);
      this.wg = { lbl: $('#wb-lbl'), b: $('#wb-b'), t: $('#wb-t'), cache: {} };
    }

    gaugeUpdate(e) {
      const G = this.wg, c = G.cache, g = e.g;
      const put = (k, v, fn) => { if (c[k] !== v) { c[k] = v; fn(v); } };
      const ir = e.has('innerRelease');
      put('b', g.beast + (ir ? 'r' : ''), () => { G.b.setAttribute('width', String(250 * g.beast / GAUGE_MAX)); G.b.setAttribute('fill', ir ? '#ffb347' : '#e0602a'); G.t.textContent = String(g.beast); });
      const st = this.stance(e);
      put('l', st, v => { G.lbl.textContent = v === 'defiance' ? 'BEAST GAUGE · DEFIANCE' : v === 'deliverance' ? 'BEAST GAUGE · DELIVERANCE' : 'BEAST GAUGE · NO STANCE'; });
    }

    helpHtml(seq) {
      const V = this.V;
      const opener = V.ir42
        ? seq(['heavySwing', ['infuriate'], 'maim', ['thrillOfBattle'], 'stormsEye', ['tincture'], 'fellCleave', ['innerRelease'], 'fellCleave', ['upheaval'], 'fellCleave', ['onslaught'], 'fellCleave', 'fellCleave', 'heavySwing', 'maim', 'stormsPath', 'heavySwing', ['infuriate'], 'fellCleave', 'maim', 'stormsEye'])
        : seq(['heavySwing', ['infuriate'], 'maim', ['thrillOfBattle'], 'stormsEye', 'heavySwing', ['berserk'], 'maim', ['innerRelease'], ['onslaught'], 'stormsPath', 'fellCleave', ['upheaval'], 'fellCleave', 'fellCleave', 'heavySwing', 'maim', 'stormsPath', ['onslaught'], 'fellCleave', 'heavySwing', 'maim', 'stormsEye']);
      return `
<h3>How it plays (${V.label})</h3>
<p>Level 70 Warrior on TP, in <b>Deliverance</b> for damage (+5%, and +0.1% crit for each point of Beast Gauge). Keep <b>Storm's Eye</b> up on yourself (Heavy Swing → Maim → Storm's Eye: +${Math.round((V.eye - 1) * 100)}%, 30s); Maim also lowers the dummy's slashing resistance 10% for 24s. Otherwise <b>Heavy Swing → Maim → Storm's Path</b> for 20 gauge. <b>Fell Cleave</b> (${V.pot ? V.pot.fellCleave : 500}) costs 50, <b>Upheaval</b> (300, ×1.2 with Thrill of Battle up) and <b>Onslaught</b> (100) 20. <b>Infuriate</b> gives 50 every 60s, 5s sooner for each Fell Cleave.</p>
<p>${V.ir42 ? '<b>Inner Release</b> (90s) gives ten seconds in which gauge actions cost nothing and every hit, auto-attacks included, is a critical direct hit: five Fell Cleaves, Upheaval and Onslaught inside it.' : '<b>Berserk</b> (+30% for 20s, 60s) and <b>Inner Release</b> (120s, 20s: gauge costs halved) go together: build the gauge first, then spend it at half price under both.'}${V.swap ? ' In Deliverance the Inner Beast button is Fell Cleave.' : ' Fell Cleave and Inner Beast are separate buttons in this patch.'} Defiance (the tank stance) is −20% damage; Inner Beast (350) ignores that.</p>
<h3>The opener (${V.ir42 ? 'The Balance\'s 4.2 opener, after the tank part' : 'the 4.1 wiki\'s DPS opener'})</h3>
${opener}
<p>${V.ir42 ? 'The Balance\'s openers start in Defiance (Unchained, Tomahawk, Equilibrium) for threat; on a dummy, start in Deliverance.' : 'From the FFXIV wiki\'s 4.1 Warrior rotations: Deliverance and Infuriate early, Berserk and Inner Release together once the gauge is up.'}</p>
<p style="color:#a9a3b4">${V.irCost ? `In 4.0–4.01 Inner Release and Unchained cost ${V.irCost} Beast Gauge, Storm's Path is 250 and swapping stance halves the gauge. ` : ''}The ${V.ir42 ? '4.2–4.58' : '4.1'} numbers: Heavy Swing ${V.pot ? 160 : 150}, Skull Sunder combo ${V.pot ? 210 : 200}, Butcher's Block combo ${V.pot ? 300 : 280}, Maim combo ${V.pot ? 200 : 190}, Storm's Path and Storm's Eye combo ${V.pot ? 280 : 270}, Fell Cleave ${V.pot ? 520 : 500}, Inner Beast 350, Upheaval 300, Onslaught 100. Gear: ${V.gear}, with ${V.ir42 ? 'the Grade 3' : 'the ungraded'} Infusion of Strength.</p>`;
    }
  }

  B.registerJob({
    id: 'war', name: 'Warrior', abbr: 'WAR', role: 'tank', classJob: 21,
    versions: ['sb42', 'sb41', 'sb405', 'sb40'].map(v => ({ id: v, label: VERSIONS[v].label, history: VERSIONS[v].history, note: VERSIONS[v].note, create: () => new WarriorSB(v) })),
  });
})(window.BLM);
