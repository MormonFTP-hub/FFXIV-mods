// Dragoon, Stormblood (patches 4.1–4.58) at level 70: the two five-hit combos (True Thrust → Vorpal → Full Thrust →
// Fang and Claw → Wheeling Thrust, and Impulse Drive → Disembowel → Chaos Thrust → Wheeling Thrust → Fang and Claw,
// the last hit +100 from Lance Mastery), Heavy Thrust's 10%, the Dragon Gauge (Blood of the Dragon kept up by Fang and
// Claw and Wheeling Thrust; Jump and Spineshatter Dive grant Mirage Dive, each an Eye; Geirskogul with three Eyes
// enters Life of the Dragon, which turns it into Nastrond), Blood for Blood, Battle Litany and Dragon Sight, all on TP.
// Patch 4.1 set the numbers (3 Eyes, Geirskogul 30s, no Blood during Life); nothing for Dragoon changed after it
// except True North's recast (4.5). Numbers are the game data at 4.11–4.58 (xivapi's datamining) and the Lodestone
// notes.
(function (B) {
  const EPS = 1e-6;
  const BLOOD = 20, GAUGE_MAX = 30, LIFE_EXTRA = 10;
  const ws = (o) => Object.assign({ kind: 'gcd', target: true, range: B.MELEE_RANGE, delay: 0.5, fx: 'gnbFang' }, o);
  const ab = (o) => Object.assign({ kind: 'ogcd' }, o);
  const ACTIONS = {
    trueThrust: ws({ name: 'True Thrust', potency: 160, tp: 60, comboStart: true, comboNext: true, desc: 'Delivers an attack with a potency of 160.' }),
    vorpalThrust: ws({ name: 'Vorpal Thrust', potency: 100, comboPotency: 250, comboFrom: 'trueThrust', comboNext: true, tp: 50, desc: 'Delivers an attack with a potency of 100.\nCombo Action: True Thrust\nCombo Potency: 250' }),
    fullThrust: ws({ name: 'Full Thrust', potency: 100, comboPotency: 450, comboFrom: 'vorpalThrust', tp: 50, fx: 'gnbFang', desc: 'Delivers an attack with a potency of 100.\nCombo Action: Vorpal Thrust\nCombo Potency: 450\nCombo Bonus: Grants Sharper Fang and Claw while under the effect of Blood of the Dragon\nDuration: 10s' }),
    impulseDrive: ws({ name: 'Impulse Drive', potency: 200, tp: 60, comboStart: true, comboNext: true, desc: 'Delivers an attack with a potency of 200.' }),
    disembowel: ws({ name: 'Disembowel', potency: 100, comboPotency: 240, comboFrom: 'impulseDrive', comboNext: true, tp: 50, desc: 'Delivers an attack with a potency of 100.\nCombo Action: Impulse Drive\nCombo Potency: 240\nCombo Bonus: Reduces target\'s piercing resistance by 5%\nDuration: 30s' }),
    chaosThrust: ws({
      name: 'Chaos Thrust', potency: 100, comboPotency: 240, comboFrom: 'disembowel', positional: 'rear', posBonus: 40, tp: 50, fx: 'slashFire',
      dot: { potency: 35, duration: 30 },
      desc: 'Delivers an attack with a potency of 100.\n140 when executed from a target\'s rear.\nCombo Action: Disembowel\nCombo Potency: 240\nRear Combo Potency: 280\nCombo Bonus: Damage over time\nPotency: 35\nDuration: 30s\nCombo Bonus: Grants Enhanced Wheeling Thrust while under the effect of Blood of the Dragon\nDuration: 10s',
    }),
    heavyThrust: ws({ name: 'Heavy Thrust', potency: 150, positional: 'flank', posBonus: 40, tp: 60, fx: 'gnbSlash', desc: 'Delivers an attack with a potency of 150.\n190 when executed from a target\'s flank.\nAdditional Effect: Increases damage dealt by 10%\nDuration: 30s' }),
    fangAndClaw: ws({ name: 'Fang and Claw', potency: 260, positional: 'flank', posBonus: 40, tp: 50, fx: 'gnbBurst', desc: 'Delivers an attack with a potency of 260.\n300 when executed from a target\'s flank.\nAdditional Effect: Extends Blood of the Dragon by 10s (max 30s)\nCan only be executed while under the effects of Blood of the Dragon and Sharper Fang and Claw.\nLance Mastery: grants Enhanced Wheeling Thrust, and Fang and Claw used from Lance Mastery gets +100 potency.' }),
    wheelingThrust: ws({ name: 'Wheeling Thrust', potency: 260, positional: 'rear', posBonus: 40, tp: 50, fx: 'gnbBurst', desc: 'Delivers an attack with a potency of 260.\n300 when executed from a target\'s rear.\nAdditional Effect: Extends Blood of the Dragon by 10s (max 30s)\nCan only be executed while under the effects of Blood of the Dragon and Enhanced Wheeling Thrust.\nLance Mastery: grants Sharper Fang and Claw, and Wheeling Thrust used from Lance Mastery gets +100 potency.' }),
    piercingTalon: ws({ name: 'Piercing Talon', potency: 120, tp: 130, range: 15, breaksCombo: true, delay: 0.7, fx: 'enpi', desc: 'Delivers a ranged attack with a potency of 120.' }),
    doomSpike: ws({ name: 'Doom Spike', potency: 140, tp: 120, range: 10, comboStart: true, comboNext: true, aoe: true, desc: 'Delivers an attack with a potency of 140 to all enemies in a straight line before you.' }),
    sonicThrust: ws({ name: 'Sonic Thrust', potency: 100, comboPotency: 180, comboFrom: 'doomSpike', tp: 100, target: false, pbaoe: 5, aoe: true, desc: 'Delivers an attack with a potency of 100 to all enemies in a cone before you.\nCombo Action: Doom Spike\nCombo Potency: 180\nCombo Bonus: Extends Blood of the Dragon by 10s (max 30s)' }),
    jump: ab({ name: 'Jump', recast: 30, potency: 260, target: true, range: 20, delay: 0.7, lock: 0.8, fx: 'gnbZone', desc: 'Delivers a jumping attack with a potency of 260. Returns you to your original position after the attack.\nAdditional Effect: Grants Dive Ready\nDuration: 15s\nBlood of the Dragon Bonus: Potency is increased by 30%' }),
    spineshatterDive: ab({ name: 'Spineshatter Dive', recast: 60, potency: 210, target: true, range: 20, delay: 0.7, lock: 0.8, fx: 'gnbZone', desc: 'Delivers a jumping attack with a potency of 210.\nAdditional Effect: Stun\nDuration: 2s\nAdditional Effect: Grants Dive Ready\nDuration: 15s\nBlood of the Dragon Bonus: Potency is increased by 30%' }),
    dragonfireDive: ab({ name: 'Dragonfire Dive', recast: 120, potency: 320, target: true, range: 20, delay: 0.8, lock: 0.8, aoe: true, fx: 'gnbBow', desc: 'Delivers a jumping fire-based attack with a potency of 320 to target and all enemies nearby it.' }),
    mirageDive: ab({ name: 'Mirage Dive', recast: 1, potency: 210, target: true, range: 20, delay: 0.6, lock: 0.7, fx: 'gnbCont', desc: 'Delivers an attack with a potency of 210.\nAdditional Effect: Grants one Dragon\'s Eye while under the effect of Blood of the Dragon or Life of the Dragon\nCan only be executed while under the effect of Dive Ready.' }),
    geirskogul: ab({ name: 'Geirskogul', recast: 30, potency: 230, target: true, range: 15, delay: 0.6, aoe: true, fx: 'senei', desc: 'Delivers an attack with a potency of 230 to all enemies in a straight line before you.\nAdditional Effect: With three Dragon\'s Eyes, changes Blood of the Dragon to Life of the Dragon\nCan only be executed while under the effect of Blood of the Dragon.\nGeirskogul changes to Nastrond while under the effect of Life of the Dragon.' }),
    nastrond: ab({ name: 'Nastrond', recast: 10, potency: 330, target: true, range: 15, delay: 0.6, aoe: true, fx: 'senei', desc: 'Delivers an attack with a potency of 330 to all enemies in a straight line before you.\nCan only be executed while under the effect of Life of the Dragon.' }),
    bloodOfTheDragon: ab({ name: 'Blood of the Dragon', recast: 30, desc: 'Increases the potency of Jump and Spineshatter Dive by 30%.\nDuration: 20s\nExtended by Fang and Claw, Wheeling Thrust and Sonic Thrust, up to 30s.\nCannot be executed while under the effect of Life of the Dragon.' }),
    lifeSurge: ab({ name: 'Life Surge', recast: 50, desc: 'Ensures critical damage for first weaponskill used while Life Surge is active.\nDuration: 10s\nAdditional Effect: Absorbs a portion of damage dealt as HP' }),
    bloodForBlood: ab({ name: 'Blood for Blood', recast: 80, desc: 'Increases damage dealt by 15% while increasing damage taken by 10%.\nDuration: 20s' }),
    battleLitany: ab({ name: 'Battle Litany', recast: 180, desc: 'Increases critical hit rate of self and nearby party members by 15%.\nDuration: 20s' }),
    dragonSight: ab({ name: 'Dragon Sight', recast: 120, desc: 'Grants Right Eye to self, increasing damage dealt by 10%, and Left Eye (+5%) to a party member.\nDuration: 20s\nHere, with no party, only Right Eye.' }),
    elusiveJump: ab({ name: 'Elusive Jump', recast: 30, lock: 0.8, desc: 'Executes a jump to a location 15 yalms behind you.\nAdditional Effect: Removes Heavy and Bind, and reduces enmity by half' }),
    // The melee role actions of 4.5 (five could be slotted in Stormblood; these are the usual ones).
    trueNorth: ab({ name: 'True North', recast: 90, role: true, desc: 'Nullifies all action direction requirements.\nDuration: 15s' }),
    invigorate: ab({ name: 'Invigorate', recast: 120, role: true, desc: 'Instantly restores 400 TP.' }),
    feint: ab({ name: 'Feint', recast: 120, role: true, target: true, range: 10, desc: 'Lowers target\'s strength and dexterity by 10%.\nDuration: 10s' }),
    bloodbath: ab({ name: 'Bloodbath', recast: 90, role: true, desc: 'Converts a portion of physical damage dealt into HP.\nDuration: 20s' }),
    secondWind: ab({ name: 'Second Wind', recast: 120, role: true, desc: 'Instantly restores own HP.\nCure Potency: 500' }),
    legSweep: ab({ name: 'Leg Sweep', recast: 40, role: true, target: true, range: 3, desc: 'Stuns target.\nDuration: 3s' }),
    armsLength: ab({ name: 'Arm\'s Length', recast: 60, role: true, desc: 'Creates a barrier nullifying knockback and draw-in effects.\nDuration: 5s' }),
    ...B.GENERAL_ACTIONS,
    tincture: B.tincture('str3sb'),
    auto: { name: 'Attack', kind: 'auto', fx: 'auto', desc: 'Auto-attack.' },
  };

  const STATUSES = {
    heavyThrust: { name: 'Heavy Thrust', self: true, icon: 'st_heavy' },
    lifeSurge: { name: 'Life Surge', self: true, icon: 'st_surge' },
    bloodForBlood: { name: 'Blood for Blood', self: true, icon: 'st_bfb' },
    battleLitany: { name: 'Battle Litany', self: true, icon: 'st_litany' },
    rightEye: { name: 'Right Eye', self: true, icon: 'st_eye' },
    sharperFangAndClaw: { name: 'Sharper Fang and Claw', self: true, icon: 'st_fang' },
    enhancedWheelingThrust: { name: 'Enhanced Wheeling Thrust', self: true, icon: 'st_wheel' },
    diveReady: { name: 'Dive Ready', self: true, icon: 'st_dive' },
    bloodOfTheDragon: { name: 'Blood of the Dragon', self: true, icon: 'st_blood' },
    lifeOfTheDragon: { name: 'Life of the Dragon', self: true, icon: 'st_blood' },
    chaosThrust: { name: 'Chaos Thrust', self: false, icon: 'st_chaos' },
    piercingResDown: { name: 'Piercing Resistance Down', self: false, icon: 'st_pierce' },
  };

  class DragoonSB {
    constructor() {
      this.name = 'Dragoon';
      this.abbr = 'DRG';
      this.role = 'melee';
      this.level = 70;
      this.levelKey = 'sb70';
      this.model = 'drg-sb';
      this.actions = ACTIONS;
      this.statuses = STATUSES;
      this.tp = { max: 1000, regen: 60 };
      this.comboTime = 15;
      // A rough 4.5 Alphascape set (the Omega Trident: 109 weapon damage, 2.80 delay in the 4.58 item data) at the 2.44 GCD;
      // level-70 stats.
      this.stats = { hp: 33000, main: 3280, mainStat: 'str', jobMod: 115, trait: 100, wd: 109, det: 1700, crit: 2600,
        dh: 2000, speed: 750, delay: 2.8 };
      this.speedName = 'Skill speed';
      this.tierHaste = 0;
      this.autoAttack = { potency: 110, delay: 2.8, range: B.MELEE_RANGE };
      this.selfStatusOrder = ['lifeOfTheDragon', 'bloodOfTheDragon', 'heavyThrust', 'bloodForBlood', 'battleLitany', 'rightEye',
        'sharperFangAndClaw', 'enhancedWheelingThrust', 'diveReady', 'lifeSurge', 'trueNorth', 'medicated', 'bloodbath', 'armsLength', 'sprint'];
      this.targetStatusOrder = ['chaosThrust', 'piercingResDown', 'feint'];
      this.defaultBars = [
        ['trueThrust', 'vorpalThrust', 'fullThrust', 'impulseDrive', 'disembowel', 'chaosThrust', 'fangAndClaw', 'wheelingThrust', 'heavyThrust', 'piercingTalon', 'jump', 'spineshatterDive'],
        ['mirageDive', 'geirskogul', 'bloodOfTheDragon', 'lifeSurge', 'bloodForBlood', 'battleLitany', 'dragonSight', 'dragonfireDive', 'trueNorth', 'invigorate', 'tincture', 'elusiveJump'],
        ['doomSpike', 'sonicThrust', 'feint', 'bloodbath', 'secondWind', 'legSweep', 'armsLength', 'sprint', null, null, null, null],
      ];
      this.actionGroups = [
        ['Dragoon', ['trueThrust', 'vorpalThrust', 'fullThrust', 'impulseDrive', 'disembowel', 'chaosThrust', 'fangAndClaw', 'wheelingThrust',
          'heavyThrust', 'piercingTalon', 'doomSpike', 'sonicThrust', 'jump', 'spineshatterDive', 'dragonfireDive', 'mirageDive', 'geirskogul',
          'nastrond', 'bloodOfTheDragon', 'lifeSurge', 'bloodForBlood', 'battleLitany', 'dragonSight', 'elusiveJump']],
        ['Role Actions', ['trueNorth', 'invigorate', 'feint', 'bloodbath', 'secondWind', 'legSweep', 'armsLength']],
        ['General', ['sprint', 'tincture']],
      ];
      this.referenceDps = 7800;     // a scripted 4.5 rotation at 2.44 parses about 7,350 on the dummy
      this.referenceGcd = 2.44;
      this.startDistance = 3.2;
    }

    initGauge() { return { mode: null, until: 0, eyes: 0 }; }

    dragon(e) { return e.g.mode !== null && e.g.until > e.now + EPS; }

    resolveId(id, e) { return id === 'geirskogul' && e.g.mode === 'life' ? 'nastrond' : id; }

    check(id, e) {
      const g = e.g;
      switch (id) {
        case 'fangAndClaw': if (!this.dragon(e) || !e.has('sharperFangAndClaw')) return 'Unable to execute action.'; break;
        case 'wheelingThrust': if (!this.dragon(e) || !e.has('enhancedWheelingThrust')) return 'Unable to execute action.'; break;
        case 'mirageDive': if (!e.has('diveReady')) return 'Unable to execute action. Dive Ready required.'; break;
        case 'geirskogul': if (g.mode !== 'blood' || !this.dragon(e)) return 'Unable to execute action. Blood of the Dragon required.'; break;
        case 'nastrond': if (g.mode !== 'life' || !this.dragon(e)) return 'Unable to execute action. Life of the Dragon required.'; break;
        case 'bloodOfTheDragon': if (g.mode === 'life') return 'Unable to execute action while under the effect of Life of the Dragon.'; break;
      }
      return null;
    }

    setDragon(e, mode, dur) {
      const g = e.g;
      for (const k of ['bloodOfTheDragon', 'lifeOfTheDragon']) e.removeStatus(k, true);
      g.mode = mode;
      g.until = mode ? e.now + dur : 0;
      if (mode) e.addStatus(mode === 'life' ? 'lifeOfTheDragon' : 'bloodOfTheDragon', dur);
    }
    // Fang and Claw, Wheeling Thrust and Sonic Thrust add 10s to Blood of the Dragon, up to 30s.
    extendBlood(e) {
      const g = e.g;
      if (g.mode !== 'blood' || !this.dragon(e)) return;
      g.until = Math.min(e.now + GAUGE_MAX, g.until + 10);
      e.statuses.bloodOfTheDragon && (e.statuses.bloodOfTheDragon.until = g.until);
    }

    snapshot(a, e) {
      let mult = 1, critAdd = 0;
      if (e.has('heavyThrust')) mult *= 1.10;
      if (e.has('bloodForBlood')) mult *= 1.15;
      if (e.has('rightEye')) mult *= 1.10;
      if (e.tHas('piercingResDown')) mult *= 1.05;
      if (e.has('battleLitany')) critAdd += 0.15;
      const main = this.stats.main + (e.has('medicated') ? B.TINCTURES.str3sb.cap : 0);
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
      // Fang and Claw / Wheeling Thrust: the one from Lance Mastery gets +100 and grants nothing more; the first one
      // (from Full Thrust or Chaos Thrust) grants the other.
      if (id === 'fangAndClaw' || id === 'wheelingThrust') {
        const mine = id === 'fangAndClaw' ? 'sharperFangAndClaw' : 'enhancedWheelingThrust';
        const other = id === 'fangAndClaw' ? 'enhancedWheelingThrust' : 'sharperFangAndClaw';
        const bonus = (e.statuses[mine] && e.statuses[mine].bonus) || 0;
        potency += bonus;
        e.removeStatus(mine, true);
        if (!bonus) e.addStatus(other, 10, { bonus: 100 });
        this.extendBlood(e);
      } else {
        // Any other weaponskill ends both procs.
        e.removeStatus('sharperFangAndClaw', true); e.removeStatus('enhancedWheelingThrust', true);
      }
      if (id === 'fullThrust' && combo && this.dragon(e)) e.addStatus('sharperFangAndClaw', 10, { bonus: 0 });
      if (id === 'chaosThrust' && combo && this.dragon(e)) e.addStatus('enhancedWheelingThrust', 10, { bonus: 0 });
      if (id === 'heavyThrust') e.addStatus('heavyThrust', 30);
      if (id === 'disembowel' && combo) e.addTStatus('piercingResDown', 30);
      if (id === 'sonicThrust' && combo) this.extendBlood(e);
      const crit = e.has('lifeSurge');
      if (crit) e.removeStatus('lifeSurge');
      const snap = this.snapshot(a, e);
      const after = id === 'chaosThrust' && combo ? () => e.addTStatus('chaosThrust', a.dot.duration, { snap, dot: { potency: a.dot.potency, id } }) : null;
      e.queueHit(id, potency, snap, a.delay, after, { positional: a.positional ? (pos ? 'hit' : 'miss') : null, crit });
    }

    ability(id, e) {
      const a = this.actions[id], g = e.g;
      let potency = a.potency || 0;
      switch (id) {
        case 'jump': case 'spineshatterDive':
          if (this.dragon(e)) potency = Math.round(potency * 1.3);
          e.addStatus('diveReady', 15);
          break;
        case 'mirageDive':
          e.removeStatus('diveReady');
          if (this.dragon(e)) { g.eyes = Math.min(3, g.eyes + 1); e.emit('eyes', {}); }
          break;
        case 'geirskogul':
          // Three Eyes: Blood becomes Life of the Dragon, for what was left of Blood plus 10s (up to 30s).
          if (g.eyes >= 3) {
            const left = g.until - e.now;
            g.eyes = 0;
            this.setDragon(e, 'life', Math.min(GAUGE_MAX, left + LIFE_EXTRA));
          }
          break;
        case 'bloodOfTheDragon': this.setDragon(e, 'blood', Math.max(BLOOD, g.mode === 'blood' ? g.until - e.now : 0)); return;
        case 'lifeSurge': e.addStatus('lifeSurge', 10); return;
        case 'bloodForBlood': e.addStatus('bloodForBlood', 20); return;
        case 'battleLitany': e.addStatus('battleLitany', 20); return;
        case 'dragonSight': e.addStatus('rightEye', 20); return;
        case 'trueNorth': e.addStatus('trueNorth', 15); return;
        case 'invigorate': B.ROLE_EFFECTS.invigorate(e); return;
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

    // The Dragon Gauge running out: Life goes back to Blood (20s here; the length isn't recorded), Blood just ends.
    nextEvent(e) { return e.g.mode ? e.g.until : Infinity; }
    process(e) {
      const g = e.g;
      if (g.mode && e.now >= g.until - EPS) {
        if (g.mode === 'life') this.setDragon(e, 'blood', BLOOD);
        else this.setDragon(e, null, 0);
      }
    }

    proc(id, e) {
      const a = this.actions[id];
      if (a.comboFrom && e.inCombo(a.comboFrom)) return true;
      if (id === 'fangAndClaw') return e.has('sharperFangAndClaw') && this.dragon(e);
      if (id === 'wheelingThrust') return e.has('enhancedWheelingThrust') && this.dragon(e);
      if (id === 'mirageDive') return e.has('diveReady');
      if (id === 'geirskogul') return e.g.eyes >= 3;
      if (id === 'nastrond') return true;
      return false;
    }

    mpRegen() { return B.BASE_REGEN; }
    speedInfo(e) { return `GCD ${e.gcdForSpeed(e.stats.speed).toFixed(2)} · combos run 11 GCDs (${(11 * e.gcdForSpeed(e.stats.speed)).toFixed(1)}s) against 30s buffs`; }

    // ---------- the Dragon Gauge ----------
    gaugeBuild(root) {
      root.innerHTML = `
<svg width="360" height="150" viewBox="0 0 360 150">
  <defs><linearGradient id="dg-blood" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#7a1010"/><stop offset="1" stop-color="#ff5a3a"/></linearGradient>
  <linearGradient id="dg-life" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#b8661a"/><stop offset="1" stop-color="#ffd27a"/></linearGradient>
  <radialGradient id="dg-eye" cx="50%" cy="40%" r="60%"><stop offset="0" stop-color="#fff0d0"/><stop offset="1" stop-color="#e0402a"/></radialGradient>
  <filter id="dg-g" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="3" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter></defs>
  <rect x="8" y="10" width="344" height="130" rx="14" fill="rgba(14,12,20,.86)" stroke="rgba(255,255,255,.22)"/>
  <text id="dg-lbl" x="24" y="38" font-family="Noto Sans, sans-serif" font-size="11" font-weight="600" fill="#a9a3b4" letter-spacing="1">DRAGON GAUGE</text>
  <text id="dg-t" x="336" y="40" text-anchor="end" font-family="Saira Semi Condensed, sans-serif" font-size="20" font-weight="700" fill="#fff" stroke="#000" stroke-width="3" paint-order="stroke"></text>
  <rect x="24" y="52" width="312" height="16" rx="8" fill="#1d1a2a" stroke="rgba(255,255,255,.2)"/>
  <rect id="dg-bar" x="24" y="52" width="0" height="16" rx="8" fill="url(#dg-blood)"/>
  <text x="24" y="100" font-family="Noto Sans, sans-serif" font-size="11" font-weight="600" fill="#a9a3b4" letter-spacing="1">DRAGON'S EYES</text>
  ${[0, 1, 2].map(k => `<ellipse id="dg-e${k}" cx="${150 + k * 40}" cy="96" rx="15" ry="9" fill="#2a2535" stroke="rgba(0,0,0,.8)" stroke-width="1.5"/>`).join('')}
</svg>`;
      const $ = (s) => root.querySelector(s);
      this.dg = { lbl: $('#dg-lbl'), t: $('#dg-t'), bar: $('#dg-bar'), eyes: [0, 1, 2].map(k => $('#dg-e' + k)), cache: {} };
    }

    gaugeUpdate(e) {
      const G = this.dg, c = G.cache, g = e.g;
      const put = (k, v, fn) => { if (c[k] !== v) { c[k] = v; fn(v); } };
      const left = this.dragon(e) ? g.until - e.now : 0;
      put('mode', this.dragon(e) ? g.mode : '', v => {
        G.lbl.textContent = v === 'life' ? 'LIFE OF THE DRAGON' : v === 'blood' ? 'BLOOD OF THE DRAGON' : 'DRAGON GAUGE';
        G.bar.setAttribute('fill', v === 'life' ? 'url(#dg-life)' : 'url(#dg-blood)');
      });
      put('t', Math.round(left * 10), () => { G.bar.setAttribute('width', String(312 * Math.min(1, left / GAUGE_MAX))); G.t.textContent = left > 0 ? left.toFixed(1) : ''; });
      for (let i = 0; i < 3; i++) put('e' + i, g.eyes > i, v => { G.eyes[i].setAttribute('fill', v ? 'url(#dg-eye)' : '#2a2535'); G.eyes[i].setAttribute('filter', v ? 'url(#dg-g)' : ''); });
    }

    helpHtml(seq) {
      return `
<h3>How it plays (Stormblood 4.1–4.58)</h3>
<p>Level 70 Dragoon on TP. Two five-hit combos: <b>True Thrust → Vorpal Thrust → Full Thrust → Fang and Claw → Wheeling Thrust</b> and <b>Impulse Drive → Disembowel → Chaos Thrust → Wheeling Thrust → Fang and Claw</b>. Full Thrust (450) and Chaos Thrust open Fang and Claw / Wheeling Thrust while Blood of the Dragon is up; Lance Mastery then opens the other one with +100 potency. Fang and Claw is a flank positional, Wheeling Thrust and Chaos Thrust rear ones (+40). <b>Heavy Thrust</b> (+10% damage, 30s) and Disembowel's piercing debuff (+5%) fit the loop of eleven GCDs.</p>
<p><b>Blood of the Dragon</b> lasts 20s; Fang and Claw, Wheeling Thrust and Sonic Thrust each add 10s, up to 30s, and it makes Jump and Spineshatter Dive 30% stronger. Each of those grants Dive Ready for <b>Mirage Dive</b>, which gives a Dragon's Eye. With three Eyes, <b>Geirskogul</b> turns Blood into <b>Life of the Dragon</b> (what was left of Blood plus 10s) and becomes <b>Nastrond</b> (330, every 10s). Line up <b>Blood for Blood</b> (+15%, 80s), <b>Battle Litany</b> (+15% crit) and <b>Dragon Sight</b> (+10%) with Life Surge on Full Thrust. Weaponskills cost TP; Invigorate gives 400.</p>
<h3>An opener for this version</h3>
${seq(['heavyThrust', ['tincture'], ['bloodForBlood'], 'impulseDrive', ['dragonSight'], ['battleLitany'], 'disembowel', ['jump'], 'chaosThrust', ['mirageDive'], ['geirskogul'], 'wheelingThrust', ['lifeSurge'], 'fangAndClaw', ['spineshatterDive'], 'trueThrust', ['mirageDive'], ['dragonfireDive'], 'vorpalThrust', 'fullThrust', 'fangAndClaw', 'wheelingThrust'])}
<p>Blood of the Dragon goes up a couple of seconds before the pull. This follows the version's rules; it isn't copied from a published guide.</p>
<p style="color:#a9a3b4">The 4.1–4.58 numbers: True Thrust 160, Vorpal combo 250, Full Thrust combo 450, Impulse Drive 200, Disembowel combo 240, Chaos Thrust combo 240 (280 rear) + 35 × 30s, Fang and Claw / Wheeling Thrust 260 (300 positional, +100 from Lance Mastery), Heavy Thrust 150 (190 flank), Jump 260, Spineshatter 210, Dragonfire Dive 320, Mirage Dive 210, Geirskogul 230, Nastrond 330. How long Life lasted and what Blood came back with after it aren't in the data; here Life is Blood's remainder + 10s and Blood returns for 20s. Auto-attacks 110 potency at 2.80s; gear approximate.</p>`;
    }
  }

  B.registerJob({
    id: 'drg', name: 'Dragoon', abbr: 'DRG', role: 'melee', classJob: 22,
    versions: [{ id: 'sb41', label: 'Stormblood 4.1–4.58', history: 'SB 4.1–4.58', note: 'Level 70. Two five-hit combos with Lance Mastery, Blood of the Dragon kept up by Fang and Claw / Wheeling Thrust, three Eyes for Life of the Dragon and Nastrond, Blood for Blood', create: () => new DragoonSB() }],
  });
})(window.BLM);
