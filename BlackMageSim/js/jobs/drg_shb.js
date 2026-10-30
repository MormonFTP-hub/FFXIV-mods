// Dragoon, Shadowbringers at level 80, in two versions. True Thrust (Raiden Thrust after a fifth hit that lands its
// positional) → Vorpal Thrust → Full Thrust or → Disembowel (+10% damage) → Chaos Thrust (a DoT); Full Thrust and Chaos
// Thrust open Fang and Claw (flank) / Wheeling Thrust (rear), and the first opens the other with a fifth-hit bonus. Blood
// of the Dragon (30s, kept up by those two) makes High Jump and Spineshatter Dive 30% stronger; Mirage Dive after High
// Jump adds an Eye, and Geirskogul with two Eyes enters Life of the Dragon for a fixed 30s: Nastrond (400, 10s) and
// Stardiver. Lance Charge (+15%), Dragon Sight (+10% alone), Battle Litany (+10% crit) and Life Surge (a crit).
//  - 5.0 (two weeks): Disembowel 24s, Geirskogul 270, Mirage Dive 250, Stardiver 550, Blood recast 30s, Fang and Claw /
//    Wheeling Thrust 320 (+100 as the fifth hit), Chaos Thrust's DoT 45. Eden's Gate gear and a Grade 1 Tincture.
//  - 5.01–5.58: Disembowel 30s; 5.1 Blood recast 25s, Geirskogul and Mirage Dive 300, Stardiver 600; 5.4 Chaos Thrust's
//    DoT 50; 5.5 Fang and Claw / Wheeling Thrust 340 (+110). The 5.58 numbers and The Balance's 5.58 set.
// Numbers are the game data at 5.0 and 5.58 and the Lodestone notes; gear stats are the 5.58 Item.csv's (pre-6.0).
// ref: a scripted bot parses about 21,870 / 13,750 on these.
(function (B) {
  const EPS = 1e-6;
  const GAUGE_MAX = 30, LIFE = 30, EYES = 2;
  const VERSIONS = {
    shb501: { label: 'Shadowbringers 5.01–5.58', history: 'ShB 5.01–5.58', fc: 340, fifth: 110, ctDot: 50, geir: 300, mirage: 300, star: 600,
      bloodRecast: 25, disembowel: 30, tincture: 'str4', ref: 23180,
      stats: { hp: 72000, main: 5560, wd: 134, det: 2041, crit: 4060, dh: 3290, speed: 380 },
      gear: 'The Balance\'s 5.58 "2.50 Raid Chest" relic set (Strength 5,560, 134 weapon damage)',
      note: 'Level 80: Raiden Thrust, Disembowel 30s, two Eyes for Life of the Dragon, Nastrond and Stardiver, Lance Charge and Dragon Sight; the 5.58 numbers and Eden\'s Promise gear' },
    shb50: { label: 'Shadowbringers 5.0–5.0', history: 'ShB 5.0–5.0', fc: 320, fifth: 100, ctDot: 45, geir: 270, mirage: 250, star: 550,
      bloodRecast: 30, disembowel: 24, tincture: 'str1', ref: 14570,
      stats: { hp: 62000, main: 4193, wd: 122, det: 2030, crit: 3605, dh: 2772, speed: 380 },
      gear: 'an Eden\'s Gate set at 2.50 (Strength 4,193, 122 weapon damage), with the Grade 1 Tincture, the only one in 5.0',
      note: 'The launch Dragoon: Disembowel for 24s, Geirskogul 270, Stardiver 550, Blood on a 30s recast; Eden\'s Gate gear' },
  };
  const ws = (o) => Object.assign({ kind: 'gcd', target: true, range: B.MELEE_RANGE, delay: 0.5, fx: 'gnbFang' }, o);
  const ab = (o) => Object.assign({ kind: 'ogcd' }, o);

  function buildActions(V) {
    return {
      trueThrust: ws({ name: 'True Thrust', potency: 290, comboStart: true, comboNext: true, desc: 'Delivers an attack with a potency of 290.\n※Action changes to Raiden Thrust when Raiden Thrust Ready.' }),
      raidenThrust: ws({ name: 'Raiden Thrust', potency: 330, comboStart: true, comboNext: true, comboAs: 'trueThrust', fx: 'gnbBurst', desc: 'Delivers an attack with a potency of 330.\nCan only be executed when Raiden Thrust Ready.\nCombos into Vorpal Thrust and Disembowel like True Thrust.' }),
      vorpalThrust: ws({ name: 'Vorpal Thrust', potency: 140, comboPotency: 350, comboFrom: 'trueThrust', comboNext: true, desc: 'Delivers an attack with a potency of 140.\nCombo Action: True Thrust\nCombo Potency: 350' }),
      fullThrust: ws({ name: 'Full Thrust', potency: 100, comboPotency: 530, comboFrom: 'vorpalThrust', desc: 'Delivers an attack with a potency of 100.\nCombo Action: Vorpal Thrust\nCombo Potency: 530\nCombo Bonus: Grants Sharper Fang and Claw if under the effect of Blood of the Dragon or Life of the Dragon\nDuration: 10s' }),
      disembowel: ws({ name: 'Disembowel', potency: 150, comboPotency: 320, comboFrom: 'trueThrust', comboNext: true, desc: `Delivers an attack with a potency of 150.\nCombo Action: True Thrust\nCombo Potency: 320\nCombo Bonus: Increases damage dealt by 10%\nDuration: ${V.disembowel}s` }),
      chaosThrust: ws({ name: 'Chaos Thrust', potency: 100, comboPotency: 290, comboFrom: 'disembowel', positional: 'rear', posBonus: 40, dot: { potency: V.ctDot, duration: 24 }, fx: 'slashFire',
        desc: `Delivers an attack with a potency of 100.\n140 when executed from a target's rear.\nCombo Action: Disembowel\nCombo Potency: 290\nRear Combo Potency: 330\nCombo Bonus: Damage over time\nPotency: ${V.ctDot}\nDuration: 24s\nCombo Bonus: Grants Enhanced Wheeling Thrust if under the effect of Blood of the Dragon or Life of the Dragon\nDuration: 10s` }),
      fangAndClaw: ws({ name: 'Fang and Claw', potency: V.fc, positional: 'flank', posBonus: 40, fx: 'gnbBurst', desc: `Delivers an attack with a potency of ${V.fc}.\n${V.fc + 40} when executed from a target's flank.\nCan only be executed while under the effects of Sharper Fang and Claw and either Blood of the Dragon or Life of the Dragon.\nAdditional Effect: Extends Blood of the Dragon duration by 10s to a maximum of 30s\nAs the fifth hit (after Wheeling Thrust): +${V.fifth} potency, and from the flank it grants Raiden Thrust Ready.` }),
      wheelingThrust: ws({ name: 'Wheeling Thrust', potency: V.fc, positional: 'rear', posBonus: 40, fx: 'gnbBurst', desc: `Delivers an attack with a potency of ${V.fc}.\n${V.fc + 40} when executed from a target's rear.\nCan only be executed while under the effects of Enhanced Wheeling Thrust and either Blood of the Dragon or Life of the Dragon.\nAdditional Effect: Extends Blood of the Dragon duration by 10s to a maximum of 30s\nAs the fifth hit (after Fang and Claw): +${V.fifth} potency, and from the rear it grants Raiden Thrust Ready.` }),
      piercingTalon: ws({ name: 'Piercing Talon', potency: 150, range: 20, breaksCombo: true, delay: 0.7, fx: 'enpi', desc: 'Delivers a ranged attack with a potency of 150.' }),
      doomSpike: ws({ name: 'Doom Spike', potency: 170, range: 10, comboStart: true, comboNext: true, aoe: true, desc: 'Delivers an attack with a potency of 170 to all enemies in a straight line before you.' }),
      sonicThrust: ws({ name: 'Sonic Thrust', potency: 100, comboPotency: 200, comboFrom: 'doomSpike', comboNext: true, range: 10, aoe: true, desc: 'Delivers an attack with a potency of 100 to all enemies in a straight line before you.\nCombo Action: Doom Spike\nCombo Potency: 200\nCombo Bonus: Extends Blood of the Dragon duration by 10s to a maximum of 30s' }),
      coerthanTorment: ws({ name: 'Coerthan Torment', potency: 100, comboPotency: 230, comboFrom: 'sonicThrust', range: 10, aoe: true, desc: 'Delivers an attack with a potency of 100 to all enemies in a straight line before you.\nCombo Action: Sonic Thrust\nCombo Potency: 230\nCombo Bonus: Extends Blood of the Dragon duration by 10s to a maximum of 30s' }),
      highJump: ab({ name: 'High Jump', recast: 30, potency: 400, target: true, range: 20, delay: 0.7, lock: 0.8, fx: 'gnbZone', desc: 'Delivers a jumping attack with a potency of 400. Returns you to your original position after the attack is made.\nAdditional Effect: Grants Dive Ready\nDuration: 15s\nBlood of the Dragon Bonus: Potency is increased by 30%' }),
      spineshatterDive: ab({ name: 'Spineshatter Dive', recast: 60, potency: 240, target: true, range: 20, delay: 0.7, lock: 0.8, fx: 'gnbZone', desc: 'Delivers a jumping attack with a potency of 240.\nBlood of the Dragon Bonus: Potency is increased by 30%' }),
      dragonfireDive: ab({ name: 'Dragonfire Dive', recast: 120, potency: 380, target: true, range: 20, delay: 0.8, lock: 0.8, aoe: true, fx: 'gnbBow', desc: 'Delivers a jumping fire-based attack with a potency of 380 to target and all enemies nearby it.' }),
      mirageDive: ab({ name: 'Mirage Dive', recast: 1, potency: V.mirage, target: true, range: 20, delay: 0.6, lock: 0.7, fx: 'gnbCont', desc: `Delivers an attack with a potency of ${V.mirage}.\nAdditional Effect: Strengthens the gaze of your Dragon Gauge by 1 if under the effect of Blood of the Dragon or Life of the Dragon\nCan only be executed when Dive Ready.` }),
      geirskogul: ab({ name: 'Geirskogul', recast: 30, potency: V.geir, target: true, range: 15, delay: 0.6, aoe: true, fx: 'senei', desc: `Delivers an attack with a potency of ${V.geir} to all enemies in a straight line before you.\nCan only be executed while under the effect of Blood of the Dragon.\nAdditional Effect: With two Dragon's Eyes, changes Blood of the Dragon to Life of the Dragon (30s)\n※Action changes to Nastrond while under the effect of Life of the Dragon.` }),
      nastrond: ab({ name: 'Nastrond', recast: 10, potency: 400, target: true, range: 15, delay: 0.6, aoe: true, fx: 'senei', desc: 'Delivers an attack with a potency of 400 to all enemies in a straight line before you.\nCan only be executed while under the effect of Life of the Dragon.' }),
      stardiver: ab({ name: 'Stardiver', recast: 30, potency: V.star, target: true, range: 20, delay: 1.0, lock: 1.5, aoe: [1, 0.7], fx: 'gnbZone', desc: `Delivers a jumping fire-based attack to target and all enemies nearby it with a potency of ${V.star} for the first enemy, and 30% less for all remaining enemies.\nCan only be executed while under the effect of Life of the Dragon.\nCannot be executed while bound.` }),
      bloodOfTheDragon: ab({ name: 'Blood of the Dragon', recast: V.bloodRecast, desc: 'Increases potency of High Jump and Spineshatter Dive by 30%.\nDuration: 30s\nAdditional Effect: Grants Sharper Fang and Claw upon successfully executing Full Thrust, or Enhanced Wheeling Thrust upon successfully executing Chaos Thrust\nDuration: 10s\nCannot be executed while under the effect of Life of the Dragon.' }),
      lifeSurge: ab({ name: 'Life Surge', recast: 45, desc: 'Ensures critical damage for first weaponskill used while Life Surge is active.\nDuration: 5s\nEffect cannot be applied to damage over time.' }),
      lanceCharge: ab({ name: 'Lance Charge', recast: 90, desc: 'Increases damage dealt by 15%.\nDuration: 20s' }),
      battleLitany: ab({ name: 'Battle Litany', recast: 180, desc: 'Increases critical hit rate of self and nearby party members by 10%.\nDuration: 20s' }),
      dragonSight: ab({ name: 'Dragon Sight', recast: 120, desc: 'Grants Right Eye to self, increasing damage dealt by 10%. Also grants target party member Left Eye (+5%).\nDuration: 20s\nHere, with no party, only Right Eye.' }),
      elusiveJump: ab({ name: 'Elusive Jump', recast: 30, lock: 0.8, desc: 'Executes a jump to a location 15 yalms behind you.\nCannot be executed while bound.' }),
      ...B.ROLE_ACTIONS.melee,
      ...B.GENERAL_ACTIONS,
      tincture: B.tincture(V.tincture),
      auto: { name: 'Attack', kind: 'auto', fx: 'auto', desc: 'Auto-attack.' },
    };
  }

  const STATUSES = {
    disembowel: { name: 'Disembowel', self: true, icon: 'st_disembowel' },
    lanceCharge: { name: 'Lance Charge', self: true, icon: 'st_lance' },
    lifeSurge: { name: 'Life Surge', self: true, icon: 'st_surge' },
    battleLitany: { name: 'Battle Litany', self: true, icon: 'st_litany' },
    rightEye: { name: 'Right Eye', self: true, icon: 'st_eye' },
    sharperFangAndClaw: { name: 'Sharper Fang and Claw', self: true, icon: 'st_fang' },
    enhancedWheelingThrust: { name: 'Enhanced Wheeling Thrust', self: true, icon: 'st_wheel' },
    raidenThrustReady: { name: 'Raiden Thrust Ready', self: true, icon: 'st_raiden' },
    diveReady: { name: 'Dive Ready', self: true, icon: 'st_dive' },
    bloodOfTheDragon: { name: 'Blood of the Dragon', self: true, icon: 'st_blood' },
    lifeOfTheDragon: { name: 'Life of the Dragon', self: true, icon: 'st_blood' },
    chaosThrust: { name: 'Chaos Thrust', self: false, icon: 'st_chaos' },
  };

  class DragoonShB {
    constructor(version) {
      const V = VERSIONS[version];
      this.V = V;
      this.name = 'Dragoon';
      this.abbr = 'DRG';
      this.role = 'melee';
      this.level = 80;
      this.levelKey = 'shb80';
      this.model = 'drg-shb';
      this.actions = buildActions(V);
      this.statuses = STATUSES;
      this.comboTime = 15;
      this.stats = Object.assign({ mainStat: 'str', jobMod: 115, trait: 100, delay: 2.8 }, V.stats);
      this.speedName = 'Skill speed';
      this.tierHaste = 0;
      this.autoAttack = { potency: 110, delay: 2.8, range: B.MELEE_RANGE };
      this.selfStatusOrder = ['lifeOfTheDragon', 'bloodOfTheDragon', 'disembowel', 'lanceCharge', 'battleLitany', 'rightEye', 'raidenThrustReady',
        'sharperFangAndClaw', 'enhancedWheelingThrust', 'diveReady', 'lifeSurge', 'trueNorth', 'medicated', 'bloodbath', 'armsLength', 'sprint'];
      this.targetStatusOrder = ['chaosThrust', 'feint'];
      this.defaultBars = [
        ['trueThrust', 'vorpalThrust', 'fullThrust', 'disembowel', 'chaosThrust', 'fangAndClaw', 'wheelingThrust', 'piercingTalon', 'highJump', 'mirageDive', 'spineshatterDive', 'dragonfireDive'],
        ['geirskogul', 'stardiver', 'bloodOfTheDragon', 'lifeSurge', 'lanceCharge', 'battleLitany', 'dragonSight', 'trueNorth', 'tincture', 'elusiveJump', 'feint', 'bloodbath'],
        ['doomSpike', 'sonicThrust', 'coerthanTorment', 'secondWind', 'legSweep', 'armsLength', 'sprint', null, null, null, null, null],
      ];
      this.actionGroups = [
        ['Dragoon', ['trueThrust', 'raidenThrust', 'vorpalThrust', 'fullThrust', 'disembowel', 'chaosThrust', 'fangAndClaw', 'wheelingThrust',
          'piercingTalon', 'doomSpike', 'sonicThrust', 'coerthanTorment', 'highJump', 'spineshatterDive', 'dragonfireDive', 'mirageDive', 'geirskogul',
          'nastrond', 'stardiver', 'bloodOfTheDragon', 'lifeSurge', 'lanceCharge', 'battleLitany', 'dragonSight', 'elusiveJump']],
        ['Role Actions', ['trueNorth', 'feint', 'bloodbath', 'secondWind', 'legSweep', 'armsLength']],
        ['General', ['sprint', 'tincture']],
      ];
      this.referenceDps = V.ref;
      this.referenceGcd = 2.5;
      this.startDistance = 3.2;
    }

    initGauge() { return { mode: null, until: 0, eyes: 0 }; }

    dragon(e) { return e.g.mode !== null && e.g.until > e.now + EPS; }

    resolveId(id, e) {
      if (id === 'geirskogul' && e.g.mode === 'life' && this.dragon(e)) return 'nastrond';
      if (id === 'trueThrust' && e.has('raidenThrustReady')) return 'raidenThrust';
      return id;
    }

    check(id, e) {
      const g = e.g;
      switch (id) {
        case 'raidenThrust': if (!e.has('raidenThrustReady')) return 'Unable to execute action.'; break;
        case 'fangAndClaw': if (!this.dragon(e) || !e.has('sharperFangAndClaw')) return 'Unable to execute action.'; break;
        case 'wheelingThrust': if (!this.dragon(e) || !e.has('enhancedWheelingThrust')) return 'Unable to execute action.'; break;
        case 'mirageDive': if (!e.has('diveReady')) return 'Unable to execute action. Dive Ready required.'; break;
        case 'geirskogul': if (g.mode !== 'blood' || !this.dragon(e)) return 'Unable to execute action. Blood of the Dragon required.'; break;
        case 'nastrond': case 'stardiver': if (g.mode !== 'life' || !this.dragon(e)) return 'Unable to execute action. Life of the Dragon required.'; break;
        case 'bloodOfTheDragon': if (g.mode === 'life' && this.dragon(e)) return 'Unable to execute action while under the effect of Life of the Dragon.'; break;
      }
      return null;
    }

    setDragon(e, mode, dur) {
      const g = e.g;
      for (const k of ['bloodOfTheDragon', 'lifeOfTheDragon']) e.removeStatus(k, true);
      g.mode = mode;
      g.until = mode ? e.now + dur : 0;
      if (!mode) g.eyes = 0;
      if (mode) e.addStatus(mode === 'life' ? 'lifeOfTheDragon' : 'bloodOfTheDragon', dur);
    }
    // Fang and Claw, Wheeling Thrust and the AoE combo add 10s to Blood of the Dragon, up to 30s (Life can't be extended).
    extendBlood(e) {
      const g = e.g;
      if (g.mode !== 'blood' || !this.dragon(e)) return;
      g.until = Math.min(e.now + GAUGE_MAX, g.until + 10);
      if (e.statuses.bloodOfTheDragon) e.statuses.bloodOfTheDragon.until = g.until;
    }

    snapshot(a, e) {
      let mult = 1, critAdd = 0;
      if (e.has('disembowel')) mult *= 1.10;
      if (e.has('lanceCharge')) mult *= 1.15;
      if (e.has('rightEye')) mult *= 1.10;
      if (e.has('battleLitany')) critAdd += 0.10;
      const main = this.stats.main + (e.has('medicated') ? B.TINCTURES[this.V.tincture].cap : 0);
      return { mult, main, critAdd };
    }

    resolve(id, e) {
      if (this.actions[id].kind === 'gcd') this.weaponskill(id, e);
      else this.ability(id, e);
    }

    weaponskill(id, e) {
      const a = this.actions[id];
      const combo = !!a.comboFrom && e.lastComboHit;
      let potency = a.comboFrom && combo ? a.comboPotency : a.potency;
      const pos = !!a.positional && e.positionalHit(a);
      if (pos) potency += a.posBonus;
      if (id === 'raidenThrust') e.removeStatus('raidenThrustReady');
      // Fang and Claw / Wheeling Thrust: the first (from Full Thrust or Chaos Thrust) opens the other; the fifth hit
      // gets the bonus and, if its positional lands, Raiden Thrust Ready.
      if (id === 'fangAndClaw' || id === 'wheelingThrust') {
        const mine = id === 'fangAndClaw' ? 'sharperFangAndClaw' : 'enhancedWheelingThrust';
        const other = id === 'fangAndClaw' ? 'enhancedWheelingThrust' : 'sharperFangAndClaw';
        const fifth = !!(e.statuses[mine] && e.statuses[mine].fifth);
        if (fifth) potency += this.V.fifth;
        e.removeStatus(mine, true);
        if (!fifth) e.addStatus(other, 10, { fifth: true });
        else if (pos) e.addStatus('raidenThrustReady', 10);
        this.extendBlood(e);
      } else {
        // Any other weaponskill ends both.
        e.removeStatus('sharperFangAndClaw', true); e.removeStatus('enhancedWheelingThrust', true);
      }
      if (id === 'fullThrust' && combo && this.dragon(e)) e.addStatus('sharperFangAndClaw', 10, { fifth: false });
      if (id === 'chaosThrust' && combo && this.dragon(e)) e.addStatus('enhancedWheelingThrust', 10, { fifth: false });
      if ((id === 'sonicThrust' || id === 'coerthanTorment') && combo) this.extendBlood(e);
      const crit = e.has('lifeSurge');
      if (crit) e.removeStatus('lifeSurge');
      // Disembowel's buff lands after its own hit.
      const snap = this.snapshot(a, e);
      if (id === 'disembowel' && combo) e.addStatus('disembowel', this.V.disembowel);
      const after = id === 'chaosThrust' && combo ? () => e.addTStatus('chaosThrust', a.dot.duration, { snap: Object.assign({}, snap), dot: { potency: a.dot.potency, id } }) : null;
      e.queueHit(id, potency, snap, a.delay, after, { positional: a.positional ? (pos ? 'hit' : 'miss') : null, crit });
    }

    ability(id, e) {
      const a = this.actions[id], g = e.g;
      let potency = a.potency || 0;
      switch (id) {
        case 'highJump':
          if (this.dragon(e)) potency = Math.round(potency * 1.3);
          e.addStatus('diveReady', 15);
          break;
        case 'spineshatterDive': if (this.dragon(e)) potency = Math.round(potency * 1.3); break;
        case 'mirageDive':
          e.removeStatus('diveReady');
          if (this.dragon(e)) { g.eyes = Math.min(EYES, g.eyes + 1); e.emit('eyes', {}); }
          break;
        case 'geirskogul':
          if (g.eyes >= EYES) { g.eyes = 0; this.setDragon(e, 'life', LIFE); }
          break;
        case 'bloodOfTheDragon': this.setDragon(e, 'blood', GAUGE_MAX); return;
        case 'lifeSurge': e.addStatus('lifeSurge', 5); return;
        case 'lanceCharge': e.addStatus('lanceCharge', 20); return;
        case 'battleLitany': e.addStatus('battleLitany', 20); return;
        case 'dragonSight': e.addStatus('rightEye', 20); return;
        case 'elusiveJump': {
          const d = e.distToTarget() || 1;
          const from = { x: e.pos.x, z: e.pos.z };
          e.pos.x += e.pos.x / d * 15; e.pos.z += e.pos.z / d * 15;
          e.emit('teleport', { from, to: { x: e.pos.x, z: e.pos.z } });
          return;
        }
        default:
          if (B.ROLE_EFFECTS[id]) B.ROLE_EFFECTS[id](e);
      }
      if (potency) e.queueHit(id, potency, this.snapshot(a, e), a.delay);
    }

    // Life of the Dragon ends back in Blood with 30s; Blood running out takes the Eyes with it.
    nextEvent(e) { return e.g.mode ? e.g.until : Infinity; }
    process(e) {
      const g = e.g;
      if (g.mode && e.now >= g.until - EPS) {
        if (g.mode === 'life') this.setDragon(e, 'blood', GAUGE_MAX);
        else this.setDragon(e, null, 0);
      }
    }

    proc(id, e) {
      const a = this.actions[id];
      if (a.comboFrom && e.inCombo(a.comboFrom)) return true;
      if (id === 'trueThrust' || id === 'raidenThrust') return e.has('raidenThrustReady');
      if (id === 'fangAndClaw') return e.has('sharperFangAndClaw') && this.dragon(e);
      if (id === 'wheelingThrust') return e.has('enhancedWheelingThrust') && this.dragon(e);
      if (id === 'mirageDive') return e.has('diveReady');
      if (id === 'geirskogul') return e.g.eyes >= EYES;
      if (id === 'nastrond' || id === 'stardiver') return e.g.mode === 'life' && this.dragon(e);
      return false;
    }

    mpRegen() { return B.BASE_REGEN; }
    speedInfo(e) { return `GCD ${e.gcdForSpeed(e.stats.speed).toFixed(2)} · the 10-GCD loop takes ${(10 * e.gcdForSpeed(e.stats.speed)).toFixed(1)}s`; }

    // ---------- the Dragon Gauge ----------
    gaugeBuild(root) {
      root.innerHTML = `
<svg width="360" height="150" viewBox="0 0 360 150">
  <defs><linearGradient id="ds-blood" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#7a1010"/><stop offset="1" stop-color="#ff5a3a"/></linearGradient>
  <linearGradient id="ds-life" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#b8661a"/><stop offset="1" stop-color="#ffd27a"/></linearGradient>
  <radialGradient id="ds-eye" cx="50%" cy="40%" r="60%"><stop offset="0" stop-color="#fff0d0"/><stop offset="1" stop-color="#e0402a"/></radialGradient>
  <filter id="ds-g" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="3" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter></defs>
  <rect x="8" y="10" width="344" height="130" rx="14" fill="rgba(14,12,20,.86)" stroke="rgba(255,255,255,.22)"/>
  <text id="ds-lbl" x="24" y="38" font-family="Noto Sans, sans-serif" font-size="11" font-weight="600" fill="#a9a3b4" letter-spacing="1">DRAGON GAUGE</text>
  <text id="ds-t" x="336" y="40" text-anchor="end" font-family="Saira Semi Condensed, sans-serif" font-size="20" font-weight="700" fill="#fff" stroke="#000" stroke-width="3" paint-order="stroke"></text>
  <rect x="24" y="52" width="312" height="16" rx="8" fill="#1d1a2a" stroke="rgba(255,255,255,.2)"/>
  <rect id="ds-bar" x="24" y="52" width="0" height="16" rx="8" fill="url(#ds-blood)"/>
  <text x="24" y="100" font-family="Noto Sans, sans-serif" font-size="11" font-weight="600" fill="#a9a3b4" letter-spacing="1">DRAGON'S EYES</text>
  ${[0, 1].map(k => `<ellipse id="ds-e${k}" cx="${170 + k * 44}" cy="96" rx="15" ry="9" fill="#2a2535" stroke="rgba(0,0,0,.8)" stroke-width="1.5"/>`).join('')}
</svg>`;
      const $ = (s) => root.querySelector(s);
      this.dg = { lbl: $('#ds-lbl'), t: $('#ds-t'), bar: $('#ds-bar'), eyes: [0, 1].map(k => $('#ds-e' + k)), cache: {} };
    }

    gaugeUpdate(e) {
      const G = this.dg, c = G.cache, g = e.g;
      const put = (k, v, fn) => { if (c[k] !== v) { c[k] = v; fn(v); } };
      const left = this.dragon(e) ? g.until - e.now : 0;
      put('mode', this.dragon(e) ? g.mode : '', v => {
        G.lbl.textContent = v === 'life' ? 'LIFE OF THE DRAGON' : v === 'blood' ? 'BLOOD OF THE DRAGON' : 'DRAGON GAUGE';
        G.bar.setAttribute('fill', v === 'life' ? 'url(#ds-life)' : 'url(#ds-blood)');
      });
      put('t', Math.round(left * 10), () => { G.bar.setAttribute('width', String(312 * Math.min(1, left / GAUGE_MAX))); G.t.textContent = left > 0 ? left.toFixed(1) : ''; });
      for (let i = 0; i < EYES; i++) put('e' + i, g.eyes > i, v => { G.eyes[i].setAttribute('fill', v ? 'url(#ds-eye)' : '#2a2535'); G.eyes[i].setAttribute('filter', v ? 'url(#ds-g)' : ''); });
    }

    helpHtml(seq) {
      const V = this.V;
      return `
<h3>How it plays (${V.label})</h3>
<p>Level 80 Dragoon. A fixed ten-GCD loop: <b>Raiden Thrust → Disembowel → Chaos Thrust → Wheeling Thrust → Fang and Claw</b>, then <b>Raiden Thrust → Vorpal Thrust → Full Thrust → Fang and Claw → Wheeling Thrust</b>. Disembowel's combo gives +10% damage for ${V.disembowel}s (after its own hit); Chaos Thrust (rear) puts on a ${V.ctDot}-potency DoT. Full Thrust (530) and Chaos Thrust open Fang and Claw (flank) or Wheeling Thrust (rear), and that one opens the other as the fifth hit, +${V.fifth}. If the fifth hit lands its positional, True Thrust becomes <b>Raiden Thrust</b> (330) for 10s.</p>
<p>Keep <b>Blood of the Dragon</b> up (30s; Fang and Claw and Wheeling Thrust add 10s each): it makes <b>High Jump</b> 520 and <b>Spineshatter Dive</b> 312. <b>Mirage Dive</b> after each High Jump adds a Dragon's Eye; with two, <b>Geirskogul</b> (${V.geir}) turns Blood into <b>Life of the Dragon</b> for 30s, in which Geirskogul becomes <b>Nastrond</b> (400, every 10s) and <b>Stardiver</b> (${V.star}) opens: three Nastronds and a Stardiver per Life, then you're back in Blood. Line it up with <b>Lance Charge</b> (+15%, 90s), <b>Dragon Sight</b> (+10% alone, 120s) and <b>Battle Litany</b> (+10% crit, 180s), with <b>Life Surge</b> on Full Thrust. Jumps have long animation locks: one per gap, never two.</p>
<h3>The opener (The Balance)</h3>
${seq(['trueThrust', ['lanceCharge'], ['dragonSight'], 'disembowel', ['battleLitany'], 'chaosThrust', 'wheelingThrust', 'fangAndClaw', ['highJump'], 'raidenThrust', ['spineshatterDive'], 'vorpalThrust', ['lifeSurge'], ['geirskogul'], 'fullThrust', ['dragonfireDive'], 'fangAndClaw', ['mirageDive'], 'wheelingThrust', 'raidenThrust'])}
<p>Blood of the Dragon 5–10s before the pull and the tincture at −1s; weave Battle Litany late so nine GCDs land under it. Then repeat the loop with the oGCDs on cooldown.${V.disembowel === 24 ? ' The 5.0 opener is The Balance\'s 5.58 picture, whose guide text still quotes 5.0 numbers; it may have been redrawn after 5.0.' : ''}</p>
<p style="color:#a9a3b4">The ${V.disembowel === 24 ? '5.0' : '5.58'} numbers: True Thrust 290, Raiden Thrust 330, Vorpal 350, Full Thrust 530, Disembowel 320, Chaos Thrust 290 (330 rear) + ${V.ctDot} × 24s, Fang and Claw / Wheeling Thrust ${V.fc} (${V.fc + 40} positional, +${V.fifth} as the fifth hit), High Jump 400, Spineshatter 240, Dragonfire Dive 380, Mirage Dive ${V.mirage}, Geirskogul ${V.geir}, Nastrond 400, Stardiver ${V.star}; auto-attacks 110 at 2.80s. Gear: ${V.gear}, pre-6.0 stats from the 5.58 game data. Whether Life of the Dragon keeps the jumps' 30% isn't documented (it does here).</p>`;
    }
  }

  B.DragoonShB = DragoonShB;
  B.registerJob({
    id: 'drg', name: 'Dragoon', abbr: 'DRG', role: 'melee', classJob: 22,
    versions: ['shb501', 'shb50'].map(v => ({ id: v, label: VERSIONS[v].label, history: VERSIONS[v].history, note: VERSIONS[v].note, create: () => new DragoonShB(v) })),
  });
})(window.BLM);
