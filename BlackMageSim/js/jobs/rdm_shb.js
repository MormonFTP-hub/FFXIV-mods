// Red Mage, Shadowbringers at level 80, in two versions. Every spell with a cast time grants Dualcast (the next spell is
// instant), so a hardcast Jolt II or Verfire / Verstone is followed by an instant Verthunder or Veraero. Those build
// Black and White Mana (+11; procs +9; Jolt II +3 each) and have a 50% chance of Verfire / Verstone Ready; gains to the
// lower mana are halved while the other is more than 30 ahead. At 80|80+ the enchanted melee combo (Riposte → Zwerchhau →
// Redoublement, fixed 1.5 / 1.5 / 2.2s GCDs) leads to Verflare or Verholy (600, a 100% proc for the lower mana) and
// Scorch (700). Fleche, Contre Sixte, Corps-a-corps and Engagement weave between; Embolden (+10% magic, falling 2% every
// 4s) and Manafication (doubles the mana, +5% magic, resets the gap closers) every two minutes.
//  - 5.0–5.08: Jolt II 250, Verthunder / Veraero 310, Verfire / Verstone 270, Fleche 420, Contre Sixte 350 (50% less to
//    the rest), Enchanted Riposte 210, Enchanted Reprise 250; Acceleration is one guaranteed proc for 10s every 35s.
//  - 5.1–5.58: Acceleration three procs for 20s every 55s; 5.2 Verthunder / Veraero 370, Fleche 440, Contre Sixte 400;
//    5.4 Jolt II 290, Verfire / Verstone 310, Enchanted Riposte 220; Enchanted Reprise 300. The 5.58 numbers.
// Numbers are the game data at 5.08 and 5.58 and the Lodestone notes; gear stats are the 5.58 Item.csv's (pre-6.0).
// ref: a scripted bot parses about 20,660 / 13,070 on these.
(function (B) {
  const EPS = 1e-6;
  const VERSIONS = {
    shb51: { label: 'Shadowbringers 5.1–5.58', history: 'ShB 5.1–5.58', jolt: 290, ver: 370, proc: 310, fleche: 440, contre: 400, contreAoe: true, riposte: 220, reprise: 300,
      accel: { stacks: 3, dur: 20, recast: 55 }, tincture: 'int4', ref: 21900,
      stats: { hp: 58000, main: 5515, wd: 180, det: 2194, crit: 4153, dh: 2998, speed: 380 },
      gear: 'The Balance\'s 5.55 relic set at 2.50 (Intelligence 5,515, 180 magic damage)',
      note: 'Level 80: Dualcast, Verflare and Verholy into Scorch, Acceleration for three procs, Manafication and Embolden; the 5.58 numbers and Eden\'s Promise gear' },
    shb50: { label: 'Shadowbringers 5.0–5.08', history: 'ShB 5.0–5.08', jolt: 250, ver: 310, proc: 270, fleche: 420, contre: 350, contreAoe: 0.5, riposte: 210, reprise: 250,
      accel: { stacks: 1, dur: 10, recast: 35 }, tincture: 'int2', ref: 13850,
      stats: { hp: 52000, main: 4193, wd: 164, det: 2098, crit: 3352, dh: 2957, speed: 380 },
      gear: 'an Eden\'s Gate set at 2.50 (Intelligence 4,193, 164 magic damage), with a Grade 2 Tincture',
      note: 'The launch Red Mage: Engagement, Scorch, Verthunder II / Veraero II, a one-proc Acceleration; the 5.08 numbers and Eden\'s Gate gear' },
  };
  const spell = (o) => Object.assign({ kind: 'gcd', target: true, range: 25, delay: 0.7, spell: true, magic: true, breaksCombo: true, sound: 'paradox', fx: 'gnbBurst' }, o);
  // The melee combo is weaponskills in the game (magic damage when enchanted); type only sets the tooltip's header.
  const melee = (o) => Object.assign({ kind: 'gcd', type: 'Weaponskill', target: true, range: B.MELEE_RANGE, delay: 0.5, fx: 'gnbSlash' }, o);
  const ab = (o) => Object.assign({ kind: 'ogcd' }, o);

  function buildActions(V) {
    const acc = V.accel.stacks > 1 ? `the next three casts of Verthunder/Verflare or Veraero/Verholy will, for their first hits,` : 'the next Verthunder/Verflare or Veraero/Verholy spell cast will, for the first hit,';
    return {
      jolt2: spell({ name: 'Jolt II', potency: V.jolt, cast: 2, mp: 200, black: 3, white: 3, desc: `Deals unaspected damage with a potency of ${V.jolt}.\nAdditional Effect: Increases both Black Mana and White Mana by 3\n※Changes to Scorch after Verflare or Verholy.` }),
      verthunder: spell({ name: 'Verthunder', potency: V.ver, cast: 5, mp: 300, black: 11, procs: 'verfireReady', fx: 'gnbZone', desc: `Deals lightning damage with a potency of ${V.ver}.\nAdditional Effect: Increases Black Mana by 11\nAdditional Effect: 50% chance of becoming Verfire Ready\nDuration: 30s\n※Changes to Verflare after Enchanted Redoublement.` }),
      veraero: spell({ name: 'Veraero', potency: V.ver, cast: 5, mp: 300, white: 11, procs: 'verstoneReady', fx: 'gnbZone', desc: `Deals wind damage with a potency of ${V.ver}.\nAdditional Effect: Increases White Mana by 11\nAdditional Effect: 50% chance of becoming Verstone Ready\nDuration: 30s\n※Changes to Verholy after Enchanted Redoublement.` }),
      verfire: spell({ name: 'Verfire', potency: V.proc, cast: 2, mp: 200, black: 9, ready: 'verfireReady', desc: `Deals fire damage with a potency of ${V.proc}.\nAdditional Effect: Increases Black Mana by 9\nCan only be executed while Verfire Ready is active.` }),
      verstone: spell({ name: 'Verstone', potency: V.proc, cast: 2, mp: 200, white: 9, ready: 'verstoneReady', desc: `Deals earth damage with a potency of ${V.proc}.\nAdditional Effect: Increases White Mana by 9\nCan only be executed while Verstone Ready is active.` }),
      verflare: spell({ name: 'Verflare', potency: 600, mp: 400, black: 21, finisher: 'verfireReady', comboFrom: 'enchantedRedoublement', comboNext: true, breaksCombo: undefined, fx: 'gnbDouble', desc: 'Deals fire damage with a potency of 600.\nCombo Action: Enchanted Redoublement\nAdditional Effect: Increases Black Mana by 21\nAdditional Effect: 20% chance of becoming Verfire Ready\nDuration: 30s\nChance to become Verfire Ready increases to 100% if White Mana is higher than Black Mana.' }),
      verholy: spell({ name: 'Verholy', potency: 600, mp: 400, white: 21, finisher: 'verstoneReady', comboFrom: 'enchantedRedoublement', comboNext: true, comboAs: 'verflare', breaksCombo: undefined, fx: 'gnbDouble', desc: 'Deals unaspected damage with a potency of 600.\nCombo Action: Enchanted Redoublement\nAdditional Effect: Increases White Mana by 21\nAdditional Effect: 20% chance of becoming Verstone Ready\nDuration: 30s\nChance to become Verstone Ready increases to 100% if Black Mana is higher than White Mana.' }),
      scorch: spell({ name: 'Scorch', potency: 700, mp: 400, black: 7, white: 7, comboFrom: 'verflare', breaksCombo: undefined, fx: 'gnbZone', desc: 'Deals unaspected damage with a potency of 700.\nCombo Action: Verflare or Verholy\nAdditional Effect: Increases both Black Mana and White Mana by 7' }),
      impact: spell({ name: 'Impact', potency: 220, cast: 5, mp: 400, black: 3, white: 3, aoe: true, desc: 'Deals unaspected damage with a potency of 220 to target and all enemies nearby it.\nAdditional Effect: Increases both Black Mana and White Mana by 3' }),
      verthunder2: spell({ name: 'Verthunder II', potency: 120, cast: 2, mp: 400, black: 7, aoe: true, desc: 'Deals lightning damage with a potency of 120 to target and all enemies nearby it.\nAdditional Effect: Increases Black Mana by 7' }),
      veraero2: spell({ name: 'Veraero II', potency: 120, cast: 2, mp: 400, white: 7, aoe: true, desc: 'Deals wind damage with a potency of 120 to target and all enemies nearby it.\nAdditional Effect: Increases White Mana by 7' }),
      vercure: spell({ name: 'Vercure', potency: 0, cast: 2, mp: 500, target: false, magic: false, desc: 'Restores target\'s HP.\nCure Potency: 350' }),
      verraise: spell({ name: 'Verraise', potency: 0, cast: 10, mp: 2400, target: false, magic: false, desc: 'Resurrects target to a weakened state.' }),
      // The melee combo: plain below the mana, enchanted (magic, faster) above it.
      riposte: melee({ name: 'Riposte', potency: 130, comboStart: true, comboNext: true, desc: 'Delivers an attack with a potency of 130.\nAction upgraded to Enchanted Riposte if both Black Mana and White Mana are at 30 or more.' }),
      zwerchhau: melee({ name: 'Zwerchhau', potency: 100, comboPotency: 150, comboFrom: 'riposte', comboNext: true, desc: 'Delivers an attack with a potency of 100.\nCombo Action: Riposte or Enchanted Riposte\nCombo Potency: 150\nAction upgraded to Enchanted Zwerchhau if both Black Mana and White Mana are at 25 or more.' }),
      redoublement: melee({ name: 'Redoublement', potency: 100, comboPotency: 230, comboFrom: 'zwerchhau', desc: 'Delivers an attack with a potency of 100.\nCombo Action: Zwerchhau or Enchanted Zwerchhau\nCombo Potency: 230\nAction upgraded to Enchanted Redoublement if both Black Mana and White Mana are at 25 or more.' }),
      enchantedRiposte: melee({ name: 'Enchanted Riposte', potency: V.riposte, mana: 30, magic: true, fixedRecast: 1.5, comboStart: true, comboNext: true, comboAs: 'riposte', fx: 'gnbSlash2', desc: `Deals unaspected damage with a potency of ${V.riposte}.\nBalance Gauge Cost: 30 Black Mana and 30 White Mana\nRecast: 1.5s` }),
      enchantedZwerchhau: melee({ name: 'Enchanted Zwerchhau', potency: 100, comboPotency: 290, mana: 25, magic: true, fixedRecast: 1.5, comboFrom: 'riposte', comboNext: true, comboAs: 'zwerchhau', fx: 'gnbSlash2', desc: 'Deals unaspected damage with a potency of 100.\nCombo Action: Riposte or Enchanted Riposte\nCombo Potency: 290\nBalance Gauge Cost: 25 Black Mana and 25 White Mana\nRecast: 1.5s' }),
      enchantedRedoublement: melee({ name: 'Enchanted Redoublement', potency: 100, comboPotency: 470, mana: 25, magic: true, fixedRecast: 2.2, comboFrom: 'zwerchhau', comboNext: true, fx: 'gnbDouble', desc: 'Deals unaspected damage with a potency of 100.\nCombo Action: Enchanted Zwerchhau\nCombo Potency: 470\nBalance Gauge Cost: 25 Black Mana and 25 White Mana\nRecast: 2.2s\nVerthunder and Veraero become Verflare and Verholy.' }),
      moulinet: melee({ name: 'Moulinet', potency: 60, aoe: true, range: 8, breaksCombo: true, desc: 'Delivers an attack with a potency of 60 to all enemies in a cone before you.\nAction upgraded to Enchanted Moulinet if both Black Mana and White Mana are at 20 or more.' }),
      enchantedMoulinet: melee({ name: 'Enchanted Moulinet', potency: 200, mana: 20, magic: true, fixedRecast: 1.5, aoe: true, range: 8, breaksCombo: true, desc: 'Deals unaspected damage with a potency of 200 to all enemies in a cone before you.\nBalance Gauge Cost: 20 Black Mana and 20 White Mana' }),
      reprise: melee({ name: 'Reprise', potency: 100, range: 25, breaksCombo: true, desc: 'Delivers an attack with a potency of 100.\nAction upgraded to Enchanted Reprise if both Black Mana and White Mana are at 5 or more.' }),
      enchantedReprise: melee({ name: 'Enchanted Reprise', potency: V.reprise, mana: 5, magic: true, fixedRecast: 2.2, range: 25, breaksCombo: true, desc: `Deals unaspected damage with a potency of ${V.reprise}.\nBalance Gauge Cost: 5 Black Mana and 5 White Mana\nRecast: 2.2s` }),
      // Off the GCD.
      fleche: ab({ name: 'Fleche', recast: 25, potency: V.fleche, target: true, range: 25, delay: 0.6, fx: 'gnbShot', desc: `Delivers an attack with a potency of ${V.fleche}.` }),
      contreSixte: ab({ name: 'Contre Sixte', recast: 35, potency: V.contre, target: true, range: 25, aoe: V.contreAoe, delay: 0.6, fx: 'gnbBow', desc: `Delivers an attack to target and all enemies nearby it with a potency of ${V.contre}${V.contreAoe === true ? '' : ' for the first enemy, and 50% less for all remaining enemies'}.` }),
      corpsACorps: ab({ name: 'Corps-a-corps', recast: 40, potency: 130, target: true, range: 25, delay: 0.3, fx: 'gnbCont', desc: 'Rushes target and delivers an attack with a potency of 130.\nCannot be executed while bound.' }),
      displacement: ab({ name: 'Displacement', recast: 35, cdGroup: 'displacement', potency: 200, target: true, range: 5, delay: 0.3, fx: 'gnbCont', desc: 'Delivers an attack with a potency of 200.\nAdditional Effect: 15-yalm backstep\nShares a recast timer with Engagement.' }),
      engagement: ab({ name: 'Engagement', recast: 35, cdGroup: 'displacement', potency: 150, target: true, range: 3, delay: 0.3, fx: 'gnbCont', desc: 'Delivers an attack with a potency of 150.\nShares a recast timer with Displacement.' }),
      acceleration: ab({ name: 'Acceleration', recast: V.accel.recast, desc: `Ensures ${acc} trigger Verfire Ready or Verstone Ready respectively.\nDuration: ${V.accel.dur}s` }),
      embolden: ab({ name: 'Embolden', recast: 120, desc: 'Increases own magic damage dealt by 10% and physical damage dealt by nearby party members by 10%. Both effects are reduced by 20% every 4s.\nDuration: 20s' }),
      manafication: ab({ name: 'Manafication', recast: 110, desc: 'Doubles current Black Mana and White Mana levels.\nAdditional Effect: Resets Corps-a-corps, Displacement, and Engagement recast timers\nAdditional Effect: Increases magic damage dealt by 5%\nDuration: 10s\nAll combos are canceled upon execution of Manafication.' }),
      ...B.ROLE_ACTIONS.caster,
      // Before 6.0 Addle lowered the target's Intelligence and Mind (Endwalker made it 5% physical / 10% magic).
      addle: Object.assign({}, B.ROLE_ACTIONS.caster.addle, { desc: 'Lowers target\'s intelligence and mind by 10%.\nDuration: 10s' }),
      swiftcast: ab({ name: 'Swiftcast', recast: 60, role: true, desc: 'Next spell is cast immediately.\nDuration: 10s' }),
      lucidDreaming: ab({ name: 'Lucid Dreaming', recast: 60, role: true, desc: 'Gradually restores own MP.\nPotency: 50\nDuration: 21s' }),
      ...B.GENERAL_ACTIONS,
      tincture: B.tincture(V.tincture),
    };
  }

  const STATUSES = {
    dualcast: { name: 'Dualcast', self: true, icon: 'st_dualcast' },
    verfireReady: { name: 'Verfire Ready', self: true, icon: 'st_verfire' },
    verstoneReady: { name: 'Verstone Ready', self: true, icon: 'st_verstone' },
    acceleration: { name: 'Acceleration', self: true, icon: 'st_accel' },
    embolden: { name: 'Embolden', self: true, icon: 'st_embolden' },
    manafication: { name: 'Manafication', self: true, icon: 'st_manafication' },
  };

  class RedMageShB {
    constructor(version) {
      const V = VERSIONS[version];
      this.V = V;
      this.name = 'Red Mage';
      this.abbr = 'RDM';
      this.role = 'caster';
      this.level = 80;
      this.levelKey = 'shb80';
      this.model = 'rdm-shb';
      this.maxMp = 10000;
      this.actions = buildActions(V);
      this.statuses = STATUSES;
      this.comboTime = 15;
      this.stats = Object.assign({ mainStat: 'int', jobMod: 115, trait: 130, delay: 3.44 }, V.stats);
      this.speedName = 'Spell speed';
      this.tierHaste = 0;
      this.selfStatusOrder = ['dualcast', 'verfireReady', 'verstoneReady', 'acceleration', 'embolden', 'manafication', 'swiftcast', 'medicated',
        'lucidDreaming', 'surecast', 'sprint'];
      this.targetStatusOrder = ['addle'];
      this.defaultBars = [
        ['jolt2', 'verthunder', 'veraero', 'verfire', 'verstone', 'riposte', 'zwerchhau', 'redoublement', 'fleche', 'contreSixte', 'corpsACorps', 'engagement'],
        ['displacement', 'acceleration', 'embolden', 'manafication', 'swiftcast', 'lucidDreaming', 'tincture', 'reprise', 'addle', 'surecast', 'vercure', 'verraise'],
        ['impact', 'verthunder2', 'veraero2', 'moulinet', 'sprint', null, null, null, null, null, null, null],
      ];
      this.actionGroups = [
        ['Red Mage', ['jolt2', 'verthunder', 'veraero', 'verfire', 'verstone', 'verflare', 'verholy', 'scorch', 'impact', 'verthunder2', 'veraero2',
          'riposte', 'zwerchhau', 'redoublement', 'moulinet', 'reprise', 'fleche', 'contreSixte', 'corpsACorps', 'displacement', 'engagement',
          'acceleration', 'embolden', 'manafication', 'vercure', 'verraise']],
        ['Role Actions', ['swiftcast', 'lucidDreaming', 'surecast', 'addle']],
        ['General', ['sprint', 'tincture']],
      ];
      this.referenceDps = V.ref;
      this.referenceGcd = 2.5;
      this.startDistance = 3.2;
    }

    initGauge() { return { black: 0, white: 0, instant: false, emboldenAt: 0 }; }

    both(e, n) { return e.g.black >= n && e.g.white >= n; }

    // The melee buttons turn enchanted with the mana; Verthunder / Veraero become Verflare / Verholy after Enchanted
    // Redoublement, and Jolt II becomes Scorch after those.
    resolveId(id, e) {
      switch (id) {
        case 'riposte': return this.both(e, 30) ? 'enchantedRiposte' : id;
        case 'zwerchhau': return this.both(e, 25) ? 'enchantedZwerchhau' : id;
        case 'redoublement': return this.both(e, 25) ? 'enchantedRedoublement' : id;
        case 'moulinet': return this.both(e, 20) ? 'enchantedMoulinet' : id;
        case 'reprise': return this.both(e, 5) ? 'enchantedReprise' : id;
        case 'verthunder': return e.inCombo('enchantedRedoublement') ? 'verflare' : id;
        case 'veraero': return e.inCombo('enchantedRedoublement') ? 'verholy' : id;
        case 'jolt2': return e.inCombo('verflare') ? 'scorch' : id;
      }
      return id;
    }

    check(id, e) {
      const a = this.actions[id];
      if (a.ready && !e.has(a.ready)) return 'Unable to execute action.';
      if (a.mana && !this.both(e, a.mana)) return 'Not enough mana.';
      if ((id === 'verflare' || id === 'verholy') && !e.inCombo('enchantedRedoublement')) return 'Unable to execute action.';
      if (id === 'scorch' && !e.inCombo('verflare')) return 'Unable to execute action.';
      return null;
    }

    castTime(id, e) {
      const a = this.actions[id];
      if (!a.cast) return 0;
      if (e.has('dualcast') || e.has('swiftcast')) return 0;
      return e.speedScale(a.cast, 0);
    }
    consumeInstant(id, e) {
      if (!this.actions[id].cast) return;
      e.g.instant = true;
      if (e.has('dualcast')) e.removeStatus('dualcast');
      else if (e.has('swiftcast')) e.removeStatus('swiftcast');
    }

    embolden(e) {
      if (!e.has('embolden')) return 0;
      const step = Math.floor((e.now - e.g.emboldenAt) / 4 + EPS);
      return Math.max(0, 0.10 - 0.02 * step);
    }

    // Embolden and Manafication raise magic damage: the spells and the enchanted weaponskills.
    snapshot(a, e) {
      let mult = 1;
      if (a && a.magic) {
        mult *= 1 + this.embolden(e);
        if (e.has('manafication')) mult *= 1.05;
      }
      const main = this.stats.main + (e.has('medicated') ? B.TINCTURES[this.V.tincture].cap : 0);
      return { mult, main };
    }

    // Gains to the lower mana are halved while the other is more than 30 ahead.
    gain(e, black, white) {
      const g = e.g;
      const gap = g.black - g.white;
      if (gap > 30) white = Math.floor(white / 2);
      if (gap < -30) black = Math.floor(black / 2);
      g.black = Math.min(100, g.black + black);
      g.white = Math.min(100, g.white + white);
    }

    proc(id, e) {
      const a = this.actions[id], g = e.g;
      if (a.comboFrom && e.inCombo(a.comboFrom)) return true;
      if (a.ready) return e.has(a.ready);
      if (id === 'riposte' || id === 'enchantedRiposte') return this.both(e, 80);
      return false;
    }

    resolve(id, e) {
      const a = this.actions[id], g = e.g;
      const hard = a.cast && !g.instant;
      g.instant = false;
      if (a.kind === 'gcd') {
        if (a.spell) e.mp -= a.mp || 0;
        // A weaponskill ends Dualcast; a hardcast spell grants it.
        else if (e.has('dualcast')) e.removeStatus('dualcast');
      }
      if (a.mana) { g.black -= a.mana; g.white -= a.mana; }
      let snap = null;
      switch (id) {
        case 'verthunder': case 'veraero': case 'verflare': case 'verholy': {
          const blackLow = g.black < g.white, whiteLow = g.white < g.black;
          snap = this.snapshot(a, e);
          this.gain(e, a.black || 0, a.white || 0);
          const key = a.procs || a.finisher;
          let chance = a.procs ? 0.5 : 0.2;
          if (a.finisher && ((id === 'verflare' && blackLow) || (id === 'verholy' && whiteLow))) chance = 1;
          if (chance < 1 && e.has('acceleration')) {
            chance = 1;
            const s = e.statuses.acceleration;
            s.stacks = (s.stacks || 1) - 1;
            if (s.stacks <= 0) e.removeStatus('acceleration'); else e.emit('statusStack', { key: 'acceleration' });
          }
          if (Math.random() < chance) e.addStatus(key, 30);
          break;
        }
        case 'verfire': case 'verstone':
          e.removeStatus(a.ready);
          this.gain(e, a.black || 0, a.white || 0);
          break;
        case 'acceleration': e.addStatus('acceleration', this.V.accel.dur, { stacks: this.V.accel.stacks }); break;
        case 'embolden': g.emboldenAt = e.now; e.addStatus('embolden', 20); break;
        case 'manafication':
          g.black = Math.min(100, g.black * 2); g.white = Math.min(100, g.white * 2);
          for (const k of ['corpsACorps', 'displacement']) { const c = e.cd(k); c.charges = c.max; c.nextAt = null; }
          e.combo = null;
          e.addStatus('manafication', 10);
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
      let potency = a.potency || 0;
      if (a.comboFrom && a.comboPotency && !e.lastComboHit) potency = a.potency;
      else if (a.comboPotency && e.lastComboHit) potency = a.comboPotency;
      if (potency) e.queueHit(id, potency, snap || this.snapshot(a, e), a.delay);
    }

    gap(e) {
      const d = e.distToTarget() || 1;
      if (d > 2.6) {
        const from = { x: e.pos.x, z: e.pos.z };
        e.pos.x *= 2.4 / d; e.pos.z *= 2.4 / d;
        e.emit('teleport', { from, to: { x: e.pos.x, z: e.pos.z } });
      }
    }

    mpRegen() { return B.BASE_REGEN; }
    lucidGain() { return 500; }
    speedInfo(e) { return `GCD ${e.gcdForSpeed(e.stats.speed).toFixed(2)} · enchanted melee 1.5 / 1.5 / 2.2s · Verthunder ${e.speedScale(5).toFixed(2)}s cast`; }

    // ---------- the Balance Gauge ----------
    gaugeBuild(root) {
      root.innerHTML = `
<svg width="360" height="130" viewBox="0 0 360 130">
  <rect x="8" y="10" width="344" height="110" rx="14" fill="rgba(14,12,20,.86)" stroke="rgba(255,255,255,.22)"/>
  <text x="24" y="34" font-family="Noto Sans, sans-serif" font-size="11" font-weight="600" fill="#a9a3b4" letter-spacing="1">WHITE MANA</text>
  <rect x="24" y="42" width="250" height="12" rx="6" fill="#2a2535" stroke="rgba(0,0,0,.8)"/>
  <rect id="rd-w" x="24" y="42" width="0" height="12" rx="6" fill="#f2f2ff"/>
  <text id="rd-wt" x="336" y="54" text-anchor="end" font-family="Saira Semi Condensed, sans-serif" font-size="18" font-weight="700" fill="#fff" stroke="#000" stroke-width="3" paint-order="stroke">0</text>
  <text x="24" y="78" font-family="Noto Sans, sans-serif" font-size="11" font-weight="600" fill="#a9a3b4" letter-spacing="1">BLACK MANA</text>
  <rect x="24" y="86" width="250" height="12" rx="6" fill="#2a2535" stroke="rgba(0,0,0,.8)"/>
  <rect id="rd-b" x="24" y="86" width="0" height="12" rx="6" fill="#6a3ad6"/>
  <text id="rd-bt" x="336" y="98" text-anchor="end" font-family="Saira Semi Condensed, sans-serif" font-size="18" font-weight="700" fill="#fff" stroke="#000" stroke-width="3" paint-order="stroke">0</text>
  <line x1="224" y1="38" x2="224" y2="102" stroke="rgba(255,90,90,.6)"/>
  <text id="rd-s" x="24" y="114" font-family="Noto Sans, sans-serif" font-size="11" font-weight="600" fill="#ffd98a" letter-spacing="1"></text>
</svg>`;
      const $ = (s) => root.querySelector(s);
      this.rg = { w: $('#rd-w'), wt: $('#rd-wt'), b: $('#rd-b'), bt: $('#rd-bt'), s: $('#rd-s'), cache: {} };
    }

    gaugeUpdate(e) {
      const G = this.rg, c = G.cache, g = e.g;
      const put = (k, v, fn) => { if (c[k] !== v) { c[k] = v; fn(v); } };
      put('w', g.white, v => { G.w.setAttribute('width', String(250 * v / 100)); G.wt.textContent = String(v); });
      put('b', g.black, v => { G.b.setAttribute('width', String(250 * v / 100)); G.bt.textContent = String(v); });
      const gap = Math.abs(g.black - g.white);
      put('s', gap > 30 ? 'IMBALANCED: GAINS TO THE LOWER MANA HALVED' : '', v => { G.s.textContent = v; });
    }

    helpHtml(seq) {
      const V = this.V;
      const opener = V.accel.stacks > 1
        ? seq(['verthunder', 'veraero', ['tincture'], 'verstone', 'veraero', ['fleche'], ['contreSixte'], 'verfire', 'verthunder', ['corpsACorps'], ['embolden'], 'verstone', 'verthunder', ['engagement'], ['manafication'], 'riposte', ['engagement'], 'zwerchhau', ['corpsACorps'], 'redoublement', 'veraero', 'jolt2', 'verstone', 'verthunder', ['fleche']])
        : seq(['verthunder', 'veraero', ['tincture'], 'verstone', 'veraero', ['fleche'], ['contreSixte'], 'verfire', 'verthunder', ['corpsACorps'], ['embolden'], 'jolt2', ['acceleration'], 'veraero', ['displacement'], 'verstone', 'verthunder', ['manafication'], 'riposte', ['engagement'], 'zwerchhau', ['corpsACorps'], 'redoublement', ['displacement'], 'veraero', 'jolt2', ['fleche']]);
      return `
<h3>How it plays (${V.label})</h3>
<p>Level 80 Red Mage. Any spell with a cast time grants <b>Dualcast</b>: the next spell is instant. So hardcast <b>Jolt II</b> (${V.jolt}, +3 each) or a <b>Verfire / Verstone</b> proc (${V.proc}, +9), then Dualcast <b>Verthunder</b> or <b>Veraero</b> (${V.ver}, +11, 50% to proc) for whichever mana is lower. Gains to the lower mana are halved while the other is more than 30 ahead, so keep them close. A weaponskill drops Dualcast.</p>
<p>At 80|80 or more, the melee combo: <b>Riposte → Zwerchhau → Redoublement</b> turn enchanted with the mana (${V.riposte} / 290 / 470, 1.5 / 1.5 / 2.2s GCDs), then Verthunder or Veraero become <b>Verflare</b> or <b>Verholy</b> (600; 100% proc for the lower mana), then Jolt II becomes <b>Scorch</b> (700). <b>Fleche</b> (${V.fleche}), <b>Contre Sixte</b> (${V.contre}), <b>Corps-a-corps</b> and <b>Engagement</b> weave between, never between a hardcast and its Dualcast. <b>Embolden</b> (+10% magic, falling 2% every 4s) and <b>Manafication</b> (doubles the mana, +5% magic, resets the gap closers) go together every two minutes, straight into melee. <b>Acceleration</b> ${V.accel.stacks > 1 ? 'guarantees the next three procs (20s, 55s)' : 'guarantees one proc (10s, 35s)'}.</p>
<h3>The opener (${V.accel.stacks > 1 ? 'The Balance\'s 5.58 "5-8"' : 'reconstructed for 5.0x'})</h3>
${opener}
<p>${V.accel.stacks > 1 ? 'Acceleration at −15s and Verthunder hardcast from −6s so it lands on the pull; Acceleration\'s stacks make the procs in the first GCDs.' : 'No 5.0x Balance opener survives; this follows the 5.x standard with the one-proc Acceleration used mid-opener. Procs are random, so the proc GCDs are "the proc you have, or Jolt II".'} Verholy or Verflare depends on which mana is lower.</p>
<p style="color:#a9a3b4">The ${V.accel.stacks > 1 ? '5.58' : '5.08'} numbers: Jolt II ${V.jolt}, Verthunder / Veraero ${V.ver}, Verfire / Verstone ${V.proc}, Verflare / Verholy 600, Scorch 700, Enchanted Riposte ${V.riposte}, Zwerchhau 290, Redoublement 470, Enchanted Reprise ${V.reprise}, Fleche ${V.fleche}, Contre Sixte ${V.contre}, Corps-a-corps 130, Displacement 200, Engagement 150, Impact 220. Gear: ${V.gear}, pre-6.0 stats from the 5.58 game data.</p>`;
    }
  }

  B.RedMageShB = RedMageShB;
  B.registerJob({
    id: 'rdm', name: 'Red Mage', abbr: 'RDM', role: 'caster', classJob: 35,
    versions: ['shb51', 'shb50'].map(v => ({ id: v, label: VERSIONS[v].label, history: VERSIONS[v].history, note: VERSIONS[v].note, create: () => new RedMageShB(v) })),
  });
})(window.BLM);
