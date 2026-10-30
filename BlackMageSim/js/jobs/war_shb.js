// Warrior, Shadowbringers 5.0–5.58 at level 80, in three versions. Built on the Endwalker class (war_ew.js) for the
// Beast Gauge, Infuriate and Nascent Chaos, with the 5.x kit: Storm's Eye is a +10% damage buff of its own that the
// combo refreshes to 30s (5.3 made it stack to 60s), Inner Release lasts 10s on a 90s recast and makes every attack
// a critical direct hit and every Beast Gauge action free (Fell Cleave, Inner Chaos, Upheaval and Onslaught alike),
// Upheaval and Onslaught cost 20 gauge, Onslaught has no charges, and there's no Primal Rend, Orogeny or Bloodwhetting.
//  - 5.0–5.08: Vengeance 10s, Holmgang 6s, Raw Intuition 5s, a single-target 5s Reprisal; Eden's Gate gear.
//  - 5.1–5.21: Vengeance 15s, Holmgang 8s, Raw Intuition 6s, Reprisal on all nearby enemies for 10s; Eden's Verse gear.
//  - 5.3–5.58: Storm's Eye's combo adds 30s up to 60s (Mythril Tempest 30s too), Inner Release adds 15s; 5.5's Maim
//    320 and Storm's Path / Eye 420; Eden's Promise gear.
// The damage numbers didn't change from 5.0 to 5.45 (the game data at each patch; 5.5 raised the combo). Gear
// stats are the 5.58 Item.csv's (pre-6.0), sets without Direct Hit like The Balance's Warrior sets. ref: a scripted bot
// parses about 10,430 / 8,370 on 5.1 / 5.0, and about 12,900 on 5.3.
(function (B) {
  const EW = B.WarriorEW;
  const ws = (o) => Object.assign({ kind: 'gcd', target: true, range: B.MELEE_RANGE, delay: 0.55, fx: 'gnbSlash' }, o);
  const ab = (o) => Object.assign({ kind: 'ogcd' }, o);
  const VERSIONS = {
    shb53: { label: 'Shadowbringers 5.3–5.58', history: 'ShB 5.3–5.58', vengeance: 15, holmgang: 8, raw: 6, reprisal: 10, tincture: 'str4', gcd: 2.38, ref: 13700,
      maim: 320, path: 420, eyeCap: 60, eyeStack: true, mythrilEye: 30, irEye: 15,
      stats: { hp: 90000, main: 5526, wd: 134, det: 3113, crit: 4077, dh: 380, speed: 1530, ten: 892 },
      gear: 'The Balance\'s 5.4 Eden\'s Promise set at 2.38 (Strength 5,526, 134 weapon damage), with a Grade 4 Tincture',
      note: 'Level 80: Storm\'s Eye stacks to 60s and Inner Release adds 15s to it, 5.5\'s Maim 320 and Storm\'s Path / Eye 420; Eden\'s Promise gear' },
    shb51: { label: 'Shadowbringers 5.1–5.25', history: 'ShB 5.1–5.25', vengeance: 15, holmgang: 8, raw: 6, reprisal: 10, tincture: 'str3', gcd: 2.38, ref: 11050,
      stats: { hp: 86000, main: 4789, wd: 128, det: 2633, crit: 3898, dh: 380, speed: 1538, ten: 1109 },
      gear: 'an Eden\'s Verse set at 2.38 (Strength 4,789, 128 weapon damage), with a Grade 3 Tincture',
      note: 'Level 80: Storm\'s Eye refreshed to 30s, Inner Release (10s, 90s) makes every hit a free critical direct hit, Infuriate into Inner Chaos; Eden\'s Verse gear' },
    shb50: { label: 'Shadowbringers 5.0–5.08', history: 'ShB 5.0–5.08', vengeance: 10, holmgang: 6, raw: 5, reprisal: 5, tincture: 'str2', gcd: 2.38, ref: 8870,
      stats: { hp: 78000, main: 4159, wd: 122, det: 2613, crit: 3604, dh: 380, speed: 1547, ten: 1022 },
      gear: 'an Eden\'s Gate set at 2.38 (Strength 4,159, 122 weapon damage), with a Grade 2 Tincture',
      note: 'The launch Warrior: one stance, Inner Release critical direct hits, Infuriate into Inner Chaos; shorter Vengeance and Holmgang; Eden\'s Gate gear' },
  };

  function buildActions(V) {
    return {
      heavySwing: ws({ name: 'Heavy Swing', potency: 200, comboStart: true, comboNext: true, desc: 'Delivers an attack with a potency of 200.' }),
      maim: ws({ name: 'Maim', potency: 100, comboPotency: V.maim || 300, comboFrom: 'heavySwing', comboNext: true, gauge: 10, fx: 'gnbSlash2', desc: `Delivers an attack with a potency of 100.\nCombo Action: Heavy Swing\nCombo Potency: ${V.maim || 300}\nCombo Bonus: Increases Beast Gauge by 10` }),
      stormsPath: ws({ name: 'Storm\'s Path', potency: 100, comboPotency: V.path || 380, comboFrom: 'maim', gauge: 20, fx: 'gnbBurst', desc: `Delivers an attack with a potency of 100.\nCombo Action: Maim\nCombo Potency: ${V.path || 380}\nCombo Bonus: Restores own HP\nCure Potency: 250\nCombo Bonus: Increases Beast Gauge by 20` }),
      stormsEye: ws({ name: 'Storm\'s Eye', potency: 100, comboPotency: V.path || 380, comboFrom: 'maim', gauge: 10, eye: 30, fx: 'gnbBurst', desc: `Delivers an attack with a potency of 100.\nCombo Action: Maim\nCombo Potency: ${V.path || 380}\nCombo Bonus: Increases damage dealt by 10%\n${V.eyeStack ? 'Extends the duration by 30s to a maximum of 60s' : 'Duration: 30s'}\nCombo Bonus: Increases Beast Gauge by 10` }),
      tomahawk: ws({ name: 'Tomahawk', potency: 140, range: 20, delay: 0.7, fx: 'enpi', desc: 'Delivers a ranged attack with a potency of 140.\nAdditional Effect: Increased enmity' }),
      fellCleave: ws({ name: 'Fell Cleave', potency: 590, cost: 50, spends: true, fx: 'gnbDouble', desc: 'Delivers an attack with a potency of 590.\nBeast Gauge Cost: 50\n※Action changes to Inner Chaos while under the effect of Nascent Chaos.' }),
      innerChaos: ws({ name: 'Inner Chaos', potency: 920, cost: 50, chaos: true, fx: 'gnbDouble', desc: 'Delivers a critical direct hit with a potency of 920.\nAdditional Effect: Reduces the recast time of Infuriate by 5 seconds\nBeast Gauge Cost: 50\nCan only be executed while under the effect of Nascent Chaos. Effect fades upon execution.' }),
      overpower: ws({ name: 'Overpower', potency: 130, comboStart: true, comboNext: true, target: false, pbaoe: 5, aoe: true, desc: 'Delivers an attack with a potency of 130 to all enemies in a cone before you.' }),
      mythrilTempest: ws({ name: 'Mythril Tempest', potency: 100, comboPotency: 200, comboFrom: 'overpower', target: false, pbaoe: 5, aoe: true, gauge: 20, eyeAdd: V.mythrilEye || 10, desc: `Delivers an attack with a potency of 100 to all nearby enemies.\nCombo Action: Overpower\nCombo Potency: 200\nCombo Bonus: Extends Storm's Eye duration by ${V.mythrilEye || 10}s to a maximum of ${V.eyeCap || 30}s\nCombo Bonus: Increases Beast Gauge by 20` }),
      decimate: ws({ name: 'Decimate', potency: 250, cost: 50, spends: true, target: false, pbaoe: 5, aoe: true, desc: 'Delivers an attack to all nearby enemies with a potency of 250.\nBeast Gauge Cost: 50' }),
      chaoticCyclone: ws({ name: 'Chaotic Cyclone', potency: 400, cost: 50, chaos: true, target: false, pbaoe: 5, aoe: true, desc: 'Delivers a critical direct hit with a potency of 400 to all nearby enemies.\nAdditional Effect: Reduces the recast time of Infuriate by 5 seconds\nBeast Gauge Cost: 50\nCan only be executed while under the effect of Nascent Chaos.' }),
      infuriate: ab({ name: 'Infuriate', recast: 60, charges: 2, desc: 'Increases Beast Gauge by 50.\nAdditional Effect: Grants Nascent Chaos\nDuration: 30s\nMaximum Charges: 2\nCan only be executed while in combat.\nFell Cleave, Decimate, Inner Chaos and Chaotic Cyclone shorten its recast by 5s.' }),
      innerRelease: ab({ name: 'Inner Release', recast: 90, desc: 'Allows the use of Beast Gauge actions without cost and nullifies Stun, Sleep, Bind, Heavy, and most knockback and draw-in effects.\nAdditional Effect: Guarantees that all attacks are critical and direct hits\nDuration: 10s' }),
      upheaval: ab({ name: 'Upheaval', recast: 30, cost: 20, potency: 450, target: true, range: B.MELEE_RANGE, delay: 0.6, fx: 'gnbZone', desc: 'Delivers an attack with a potency of 450.\nBeast Gauge Cost: 20' }),
      onslaught: ab({ name: 'Onslaught', recast: 10, cost: 20, potency: 100, target: true, range: 20, delay: 0.3, fx: 'gnbCont', desc: 'Rushes target and delivers an attack with a potency of 100.\nBeast Gauge Cost: 20\nCannot be executed while bound.' }),
      defiance: ab({ name: 'Defiance', recast: 10, desc: 'Significantly increases enmity generation.\nEffect ends upon reuse.' }),
      rawIntuition: ab({ name: 'Raw Intuition', recast: 25, cdGroup: 'raw', desc: `Reduces damage taken by 20%.\nDuration: ${V.raw}s\nShares a recast timer with Nascent Flash.` }),
      nascentFlash: ab({ name: 'Nascent Flash', recast: 25, cdGroup: 'raw', desc: 'Grants Nascent Flash to self and Nascent Glint to target party member.\nNascent Flash Effect: Absorbs damage dealt as HP\nDuration: 6s\nShares a recast timer with Raw Intuition.' }),
      thrillOfBattle: ab({ name: 'Thrill of Battle', recast: 90, desc: 'Increases maximum HP by 20% and restores the amount increased.\nDuration: 10s' }),
      vengeance: ab({ name: 'Vengeance', recast: 120, desc: `Reduces damage taken by 30% and delivers an attack with a potency of 55 every time you suffer physical damage.\nDuration: ${V.vengeance}s` }),
      holmgang: ab({ name: 'Holmgang', recast: 240, desc: `Brace yourself for an enemy onslaught, preventing most attacks from reducing your HP to less than 1.\nDuration: ${V.holmgang}s` }),
      equilibrium: ab({ name: 'Equilibrium', recast: 60, desc: 'Restores own HP.\nCure Potency: 1,200' }),
      shakeItOff: ab({ name: 'Shake It Off', recast: 90, desc: 'Creates a barrier around self and all nearby party members that absorbs damage totaling 12% of maximum HP.\nDispels Thrill of Battle, Vengeance and Raw Intuition, increasing damage absorbed by 2% for each effect removed.\nDuration: 15s' }),
      ...B.ROLE_ACTIONS.tank,
      reprisal: Object.assign({}, B.ROLE_ACTIONS.tank.reprisal, V.reprisal === 5 ? { desc: 'Reduces damage dealt by target by 10%.\nDuration: 5s' } : {}),
      ...B.GENERAL_ACTIONS,
      tincture: B.tincture(V.tincture),
      auto: { name: 'Attack', kind: 'auto', fx: 'auto', desc: 'Auto-attack.' },
    };
  }

  class WarriorShB extends EW {
    constructor(version) {
      super('ew61');
      const V = VERSIONS[version];
      this.V = V;
      this.level = 80;
      this.levelKey = 'shb80';
      this.model = 'war-shb';
      this.actions = buildActions(V);
      this.statuses = Object.assign({}, this.statuses, {
        stormsEye: { name: 'Storm\'s Eye', self: true, icon: 'st_eye' },
        innerRelease: { name: 'Inner Release', self: true, icon: 'st_ir' },
        rawIntuition: { name: 'Raw Intuition', self: true, icon: 'st_ri' },
        nascentFlash: { name: 'Nascent Flash', self: true, icon: 'st_flash' },
      });
      this.stats = Object.assign({ mainStat: 'str', jobMod: 105, trait: 100, delay: 3.36 }, V.stats);
      this.autoAttack = { potency: 110, delay: 3.36, range: B.MELEE_RANGE };
      this.selfStatusOrder = ['stormsEye', 'innerRelease', 'nascentChaos', 'defiance', 'medicated', 'rampart', 'rawIntuition', 'nascentFlash',
        'thrillOfBattle', 'vengeance', 'holmgang', 'shakeItOff', 'armsLength', 'sprint'];
      this.defaultBars = [
        ['heavySwing', 'maim', 'stormsPath', 'stormsEye', 'fellCleave', 'infuriate', 'innerRelease', 'upheaval', 'onslaught', 'tomahawk', 'tincture', null],
        ['overpower', 'mythrilTempest', 'decimate', 'defiance', 'rampart', 'rawIntuition', 'nascentFlash', 'thrillOfBattle', 'vengeance', 'holmgang', 'equilibrium', 'shakeItOff'],
        ['provoke', 'reprisal', 'shirk', 'lowBlow', 'interject', 'armsLength', 'sprint', null, null, null, null, null],
      ];
      this.actionGroups = [
        ['Warrior', ['heavySwing', 'maim', 'stormsPath', 'stormsEye', 'tomahawk', 'fellCleave', 'innerChaos', 'overpower', 'mythrilTempest', 'decimate',
          'chaoticCyclone', 'infuriate', 'innerRelease', 'upheaval', 'onslaught', 'defiance', 'rawIntuition', 'nascentFlash', 'thrillOfBattle',
          'vengeance', 'holmgang', 'equilibrium', 'shakeItOff']],
        ['Role Actions', ['rampart', 'lowBlow', 'provoke', 'interject', 'reprisal', 'armsLength', 'shirk']],
        ['General', ['sprint', 'tincture']],
      ];
      this.referenceDps = V.ref;
      this.referenceGcd = V.gcd;
    }

    check(id, e) {
      const a = this.actions[id], g = e.g;
      if (a.chaos && !e.has('nascentChaos')) return 'Unable to execute action. Nascent Chaos required.';
      if (id === 'infuriate' && !e.inCombat) return 'Unable to execute action. Must be in combat.';
      if (a.cost && g.beast < a.cost && !e.has('innerRelease')) return 'Not enough Beast Gauge.';
      return null;
    }

    // Storm's Eye: +10%. Inner Release: every hit a critical direct hit, auto-attacks too.
    snapshot(a, e) {
      const mult = e.has('stormsEye') ? 1.10 : 1;
      const main = this.stats.main + (e.has('medicated') ? B.TINCTURES[this.V.tincture].cap : 0);
      return e.has('innerRelease') ? { mult, main, critAdd: 1, dhAdd: 1 } : { mult, main };
    }

    resolve(id, e) {
      const a = this.actions[id], g = e.g;
      if (!a.potency && !['infuriate', 'innerRelease', 'rawIntuition', 'nascentFlash', 'vengeance', 'holmgang', 'shakeItOff', 'reprisal'].includes(id)) {
        super.resolve(id, e);
        return;
      }
      let potency = a.potency || 0, opts = {};
      if (a.comboFrom && e.lastComboHit) potency = a.comboPotency;
      if (a.cost && !e.has('innerRelease')) this.gauge(e, -a.cost);
      if (a.chaos) { opts = { crit: true, dh: true }; e.removeStatus('nascentChaos'); }
      // Enhanced Infuriate: Fell Cleave, Decimate, Inner Chaos and Chaotic Cyclone take 5s off Infuriate.
      if (a.spends || a.chaos) { const c = e.cdOf('infuriate'); if (c && c.nextAt !== null) c.nextAt -= 5; }
      if (a.gauge && e.lastComboHit) this.gauge(e, a.gauge);
      // 5.3 on: Storm's Eye (and Mythril Tempest, and Inner Release) add to the buff, up to 60s.
      const addEye = (n) => {
        const left = e.has('stormsEye') ? e.statuses.stormsEye.until - e.now : 0;
        e.addStatus('stormsEye', Math.min(this.V.eyeCap || 30, left + n));
      };
      if (a.eye && e.lastComboHit) { if (this.V.eyeStack) addEye(a.eye); else e.addStatus('stormsEye', a.eye); }
      if (a.eyeAdd && e.lastComboHit) addEye(a.eyeAdd);
      if (id === 'innerRelease' && this.V.irEye) addEye(this.V.irEye);

      switch (id) {
        case 'infuriate': this.gauge(e, 50); e.addStatus('nascentChaos', 30); break;
        // The buff lands about 0.6s after the button (the server's application delay), so a late weave fits five GCDs.
        case 'innerRelease': e.addStatus('innerRelease', 10.6); break;
        case 'onslaught': this.gap(e); break;
        case 'rawIntuition': e.addStatus('rawIntuition', this.V.raw); break;
        case 'nascentFlash': e.addStatus('nascentFlash', 6); break;
        case 'vengeance': e.addStatus('vengeance', this.V.vengeance); break;
        case 'holmgang': e.addStatus('holmgang', this.V.holmgang); break;
        case 'shakeItOff': e.addStatus('shakeItOff', 15); break;
        case 'reprisal': e.addTStatus('reprisal', this.V.reprisal); break;
      }
      if (potency) e.queueHit(id, potency, this.snapshot(a, e), a.delay, null, opts);
    }

    proc(id, e) {
      const a = this.actions[id];
      if (a.comboFrom && e.inCombo(a.comboFrom)) return true;
      if (id === 'fellCleave' || id === 'innerChaos') return e.g.beast >= 50 || e.has('innerRelease') || e.has('nascentChaos');
      return false;
    }

    speedInfo(e) { return `GCD ${e.gcdForSpeed(e.stats.speed).toFixed(2)} · Inner Release fits ${Math.ceil(10 / e.gcdForSpeed(e.stats.speed))} Fell Cleaves when used late`; }

    gaugeUpdate(e) {
      const G = this.wg, c = G.cache, g = e.g;
      const put = (k, v, fn) => { if (c[k] !== v) { c[k] = v; fn(v); } };
      put('b', g.beast, v => { G.n.textContent = String(v); G.bar.setAttribute('width', String(312 * v / 100)); });
      const t = e.has('stormsEye') ? Math.ceil(e.statuses.stormsEye.until - e.now) : 0;
      const ir = e.has('innerRelease') ? Math.ceil(e.statuses.innerRelease.until - e.now) : 0;
      put('t', `${t}|${ir}`, () => { G.t.textContent = `STORM'S EYE ${t ? t + 's' : '—'}${ir ? `  ·  INNER RELEASE ${ir}s` : ''}`; });
    }

    helpHtml(seq) {
      const V = this.V;
      return `
<h3>How it plays (${V.label})</h3>
<p>Level 80 Warrior, one stance. <b>Heavy Swing → Maim → Storm's Eye</b> keeps the <b>Storm's Eye</b> buff up (+10% damage; ${V.eyeStack ? 'from 5.3 each combo adds 30s up to 60s, and Inner Release adds 15s, so one Storm\'s Eye in every two combos is enough' : 'the combo sets it back to 30s, it doesn\'t stack yet'}); otherwise finish with <b>Storm's Path</b> (+20 Beast Gauge). Spend 50 gauge on <b>Fell Cleave</b> (590). <b>Infuriate</b> (two charges, in combat) adds 50 and Nascent Chaos, which turns Fell Cleave into <b>Inner Chaos</b> (920, always a critical direct hit). Fell Cleave and Inner Chaos take 5s off Infuriate.</p>
<p><b>Inner Release</b> (90s) gives 10s in which Beast Gauge actions cost nothing and <b>every attack</b> is a critical direct hit, auto-attacks included. Weave it late to fit five Fell Cleaves, plus <b>Upheaval</b> (450) and <b>Onslaught</b> (100), which cost 20 gauge outside it. Don't Infuriate inside it: Nascent Chaos would turn a free Fell Cleave into Inner Chaos.</p>
<h3>${V.eyeStack ? 'The "IC IR IC IC" opener (The Balance)' : 'An Inner Release opener'}</h3>
${V.eyeStack ? seq(['tomahawk', ['infuriate'], 'heavySwing', 'maim', ['tincture'], 'stormsEye', 'innerChaos', ['nascentFlash'], ['innerRelease'], 'fellCleave', ['upheaval'], 'fellCleave', ['onslaught'], 'fellCleave', 'fellCleave', 'fellCleave', ['infuriate'], 'innerChaos', 'heavySwing', ['infuriate'], 'innerChaos', 'maim', 'stormsPath', 'fellCleave', 'heavySwing', 'maim', 'stormsEye', ['upheaval']]) : seq(['heavySwing', 'maim', ['tincture'], 'stormsEye', ['innerRelease'], 'fellCleave', ['upheaval'], 'fellCleave', ['onslaught'], 'fellCleave', 'fellCleave', 'fellCleave', ['infuriate'], 'innerChaos', ['infuriate'], 'innerChaos', 'heavySwing', 'maim', 'stormsPath'])}
<p>${V.eyeStack ? `Tomahawk at -0.7s with Infuriate, Inner Chaos before Inner Release (Nascent Flash pushes Inner Release into the second weave slot), five free Fell Cleaves, then Infuriate into Inner Chaos twice. Inner Release's 15s keeps Storm's Eye up long enough for the extra Fell Cleave.` : `The Balance's early-Shadowbringers opener image is lost; this one follows its rules: Inner Release on the third GCD with five Fell Cleaves, Upheaval and Onslaught inside, then both Infuriate charges into Inner Chaos. (The "IC IR IC IC" opener came with 5.3's Storm's Eye changes.)`}</p>
<p style="color:#a9a3b4">The ${V.eyeStack ? '5.5–5.58' : '5.0–5.21'} numbers: Heavy Swing 200, Maim ${V.maim || 300}, Storm's Path / Eye ${V.path || 380} in combo${V.eyeStack ? ' (5.3–5.45: 300 and 380)' : ''}, Fell Cleave 590, Inner Chaos 920, Upheaval 450, Onslaught 100, Tomahawk 140, Overpower 130, Mythril Tempest 200, Decimate 250, Chaotic Cyclone 400; auto-attacks 110 at 3.36s. Gear: ${V.gear}, pre-6.0 stats from the 5.58 game data.</p>`;
    }
  }

  B.registerJob({
    id: 'war', name: 'Warrior', abbr: 'WAR', role: 'tank', classJob: 21,
    versions: ['shb53', 'shb51', 'shb50'].map(v => ({ id: v, label: VERSIONS[v].label, history: VERSIONS[v].history, note: VERSIONS[v].note, create: () => new WarriorShB(v) })),
  });
})(window.BLM);
