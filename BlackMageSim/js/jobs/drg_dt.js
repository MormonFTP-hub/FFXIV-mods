// Dragoon, Dawntrail 7.1–7.57 at level 100. Built on the Endwalker class (drg_ew.js) for its jumps, statuses and gauge,
// with the kit Dawntrail rewrote: a plain ten-GCD combo loop with no procs or fifth-hit bonus. True / Raiden Thrust →
// Lance Barrage → Heavens' Thrust → Fang and Claw → Drakesbane, then Raiden Thrust → Spiral Blow (Power Surge, +10%
// for 30s) → Chaotic Spring (a DoT) → Wheeling Thrust → Drakesbane; Drakesbane leaves Draconian Fire, which turns True
// Thrust into Raiden Thrust (and a Firstminds' Focus: two buy Wyrmwind Thrust). No Eyes and no Dragon Sight: every
// Geirskogul (60s) starts Life of the Dragon (+15% for 20s) with one Nastrond Ready, and Stardiver in Life readies
// Starcross. Dragonfire Dive readies Rise of the Dragon. Lance Charge (+10%, 60s), Battle Litany (+10% crit, 120s).
// The 7.3–7.57 numbers (7.1 had Heavens' Thrust 440, Drakesbane 440, Stardiver 820; 7.2 Stardiver 840 with 50% less
// for the rest, 40% from 7.3). Game data at 7.1, 7.2, 7.3 and 7.57 (xivapi's datamining) and the Lodestone notes;
// gear is The Balance's 7.4+ savage set at 2.50. ref: a scripted bot parses about 36,200 on this.
//  - 7.0–7.05: each Geirskogul readies three Nastronds (360 each, 2s apart) in its Life of the Dragon; Mirage Dive 200;
//    Stardiver 720 and Starcross 900 at melee range (50% less for the rest; 7.0–7.01 had 620 / 700); Heavens' Thrust
//    440 and Drakesbane 440; Piercing Talon 150 with nothing from Elusive Jump. The Balance's 7.05 savage set at 2.50
//    (Strength 4,886, 146 weapon damage) with a Grade 2 Gemdraught. ref: the same bot parses about 24,200.
(function (B) {
  const EW = B.DragoonEW;
  const EPS = 1e-6;
  const LIFE = 20;
  const ws = (o) => Object.assign({ kind: 'gcd', target: true, range: B.MELEE_RANGE, delay: 0.5, fx: 'gnbFang' }, o);
  const ab = (o) => Object.assign({ kind: 'ogcd' }, o);
  const set = (A, id, o) => { A[id] = Object.assign({}, A[id], o); };
  const V = { label: 'Dawntrail 7.1–7.57', history: 'DT 7.1–7.57', tincture: 'strdt4', ref: 38380,
    stats: { hp: 227580, main: 6513, wd: 158, det: 2506, crit: 3605, dh: 1982, speed: 420 },
    note: 'Level 100: a proc-free combo loop into Drakesbane, every Geirskogul a 20s Life of the Dragon (+15%), Nastrond once, Stardiver into Starcross, Rise of the Dragon; the 7.4 savage set' };

  class DragoonDT extends EW {
    constructor() {
      super('ew63');
      this.V = Object.assign({}, this.V, V, { lifeSurge: 40 });
      this.level = 100;
      this.levelKey = 100;
      this.model = 'drg-dt';
      const A = Object.assign({}, this.actions);
      for (const k of ['vorpalThrust', 'disembowel', 'dragonSight', 'spineshatterDive']) delete A[k];
      set(A, 'trueThrust', { potency: 230, desc: 'Delivers an attack with a potency of 230.\n※Action changes to Raiden Thrust while under the effect of Draconian Fire.' });
      set(A, 'raidenThrust', { potency: 320, desc: 'Delivers an attack with a potency of 320.\nAdditional Effect: Grants Firstminds\' Focus (up to 2)\nCan only be executed while under the effect of Draconian Fire.\nCombos into Lance Barrage and Spiral Blow like True Thrust.' });
      A.lanceBarrage = ws({ name: 'Lance Barrage', potency: 130, comboPotency: 340, comboFrom: 'trueThrust', comboNext: true,
        desc: 'Delivers an attack with a potency of 130.\nCombo Action: True Thrust or Raiden Thrust\nCombo Potency: 340' });
      A.spiralBlow = ws({ name: 'Spiral Blow', potency: 140, comboPotency: 300, comboFrom: 'trueThrust', comboNext: true, fx: 'gnbFang3',
        desc: 'Delivers an attack with a potency of 140.\nCombo Action: True Thrust or Raiden Thrust\nCombo Potency: 300\nCombo Bonus: Grants Power Surge, increasing damage dealt by 10%\nDuration: 30s' });
      set(A, 'heavensThrust', { potency: 160, comboPotency: 460, comboFrom: 'lanceBarrage', comboNext: true,
        desc: 'Delivers an attack with a potency of 160.\nCombo Action: Lance Barrage\nCombo Potency: 460' });
      set(A, 'chaoticSpring', { potency: 140, comboPotency: 300, comboFrom: 'spiralBlow', comboNext: true, dot: { potency: 45, duration: 24 },
        desc: 'Delivers an attack with a potency of 140.\n180 when executed from a target\'s rear.\nCombo Action: Spiral Blow\nCombo Potency: 300\nRear Combo Potency: 340\nCombo Bonus: Damage over time\nPotency: 45\nDuration: 24s' });
      // Fang and Claw and Wheeling Thrust both combo into Drakesbane (the combo id they leave is shared).
      set(A, 'fangAndClaw', { potency: 140, comboPotency: 300, comboFrom: 'heavensThrust', comboNext: true, comboAs: 'drgFifth',
        desc: 'Delivers an attack with a potency of 140.\n180 when executed from a target\'s flank.\nCombo Action: Heavens\' Thrust\nCombo Potency: 300\nFlank Combo Potency: 340\n※Action changes to Drakesbane after it lands.' });
      set(A, 'wheelingThrust', { potency: 140, comboPotency: 300, comboFrom: 'chaoticSpring', comboNext: true, comboAs: 'drgFifth',
        desc: 'Delivers an attack with a potency of 140.\n180 when executed from a target\'s rear.\nCombo Action: Chaotic Spring\nCombo Potency: 300\nRear Combo Potency: 340\n※Action changes to Drakesbane after it lands.' });
      A.drakesbane = ws({ name: 'Drakesbane', potency: 460, comboPotency: 460, comboFrom: 'drgFifth', fx: 'gnbBurst',
        desc: 'Delivers an attack with a potency of 460.\nCombo Action: Fang and Claw or Wheeling Thrust\nCombo Bonus: Grants Draconian Fire\nDuration: 30s\nCan only be executed after Fang and Claw or Wheeling Thrust.' });
      set(A, 'piercingTalon', { potency: 200, breaksCombo: undefined,
        desc: 'Delivers a ranged attack with a potency of 200.\nEnhanced Piercing Talon Potency: 350\nDoes not break the combo.' });
      set(A, 'doomSpike', { potency: 110, desc: 'Delivers an attack with a potency of 110 to all enemies in a straight line before you.\n※Action changes to Draconian Fury while under the effect of Draconian Fire.' });
      A.draconianFury = ws({ name: 'Draconian Fury', potency: 130, range: 10, comboStart: true, comboNext: true, comboAs: 'doomSpike', aoe: true, fx: 'gnbBurst',
        desc: 'Delivers an attack with a potency of 130 to all enemies in a straight line before you.\nAdditional Effect: Grants Firstminds\' Focus (up to 2)\nCan only be executed while under the effect of Draconian Fire.' });
      set(A, 'sonicThrust', { potency: 100, comboPotency: 120, desc: 'Delivers an attack with a potency of 100 to all enemies in a straight line before you.\nCombo Action: Doom Spike or Draconian Fury\nCombo Potency: 120\nCombo Bonus: Grants Power Surge\nDuration: 30s' });
      set(A, 'coerthanTorment', { potency: 100, comboPotency: 150, desc: 'Delivers an attack with a potency of 100 to all enemies in a straight line before you.\nCombo Action: Sonic Thrust\nCombo Potency: 150\nCombo Bonus: Grants Draconian Fire\nDuration: 30s' });
      set(A, 'highJump', { desc: 'Delivers a jumping attack with a potency of 400. Returns you to your original position after the attack is made.\nAdditional Effect: Grants Dive Ready\nDuration: 15s\n※Action changes to Mirage Dive while under the effect of Dive Ready.' });
      set(A, 'mirageDive', { potency: 380, desc: 'Delivers an attack with a potency of 380.\nCan only be executed while under the effect of Dive Ready.' });
      set(A, 'dragonfireDive', { potency: 500, aoe: [1, 0.5], desc: 'Delivers a jumping fire-based attack to target and all enemies nearby it with a potency of 500 for the first enemy, and 50% less for all remaining enemies.\nAdditional Effect: Grants Dragon\'s Flight\nDuration: 30s\n※Action changes to Rise of the Dragon while under the effect of Dragon\'s Flight.' });
      A.riseOfTheDragon = ab({ name: 'Rise of the Dragon', recast: 1, potency: 550, target: true, range: 20, delay: 0.6, aoe: [1, 0.5], fx: 'gnbBow',
        desc: 'Delivers an attack to target and all enemies nearby it with a potency of 550 for the first enemy, and 50% less for all remaining enemies.\nCan only be executed while under the effect of Dragon\'s Flight.' });
      set(A, 'geirskogul', { recast: 60, potency: 280, aoe: [1, 0.5], desc: 'Delivers an attack with a potency of 280 to all enemies in a straight line before you, 50% less for the rest.\nAdditional Effect: Grants Life of the Dragon, increasing damage dealt by 15%\nDuration: 20s\nAdditional Effect: Grants Nastrond Ready\nDuration: 20s\n※Action changes to Nastrond while under the effect of Nastrond Ready.' });
      set(A, 'nastrond', { recast: 2, potency: 720, aoe: [1, 0.5], desc: 'Delivers an attack with a potency of 720 to all enemies in a straight line before you, 50% less for the rest.\nCan only be executed while under the effect of Nastrond Ready.' });
      set(A, 'stardiver', { potency: 840, aoe: [1, 0.6], desc: 'Delivers a jumping fire-based attack to target and all enemies nearby it with a potency of 840 for the first enemy, and 40% less for all remaining enemies.\nAdditional Effect: Grants Starcross Ready\nDuration: 20s\nCan only be executed while under the effect of Life of the Dragon.\n※Action changes to Starcross while under the effect of Starcross Ready.' });
      A.starcross = ab({ name: 'Starcross', recast: 1, potency: 1000, target: true, range: 20, delay: 0.7, aoe: [1, 0.6], fx: 'gnbZone',
        desc: 'Delivers an attack to target and all enemies nearby it with a potency of 1,000 for the first enemy, and 40% less for all remaining enemies.\nCan only be executed while under the effect of Starcross Ready.' });
      set(A, 'wyrmwindThrust', { potency: 440, desc: 'Delivers an attack to all enemies in a straight line before you with a potency of 440 for the first enemy, and 50% less for all remaining enemies.\nCan only be executed with two Firstminds\' Focus.' });
      set(A, 'battleLitany', { desc: 'Increases critical hit rate of self and nearby party members by 10%.\nDuration: 20s' });
      set(A, 'elusiveJump', { desc: 'Executes a jump to a location 15 yalms behind you.\nAdditional Effect: Grants Enhanced Piercing Talon\nDuration: 15s\nCannot be executed while bound.' });
      A.wingedGlide = ab({ name: 'Winged Glide', recast: 60, charges: 2, target: true, range: 20, desc: 'Rush to the specified target.\nMaximum Charges: 2\nCannot be executed while bound.' });
      A.tincture = B.tincture(V.tincture);
      this.actions = A;
      this.statuses = Object.assign({}, this.statuses, {
        draconianFire: { name: 'Draconian Fire', self: true, icon: 'st_draconianFire' },
        nastrondReady: { name: 'Nastrond Ready', self: true, icon: 'st_nastrondReady' },
        starcrossReady: { name: 'Starcross Ready', self: true, icon: 'st_starcrossReady' },
        dragonsFlight: { name: 'Dragon\'s Flight', self: true, icon: 'st_dragonsFlight' },
        enhancedPiercingTalon: { name: 'Enhanced Piercing Talon', self: true, icon: 'st_enhancedPiercingTalon' },
      });
      this.selfStatusOrder = ['lifeOfTheDragon', 'powerSurge', 'lanceCharge', 'battleLitany', 'draconianFire', 'nastrondReady', 'starcrossReady',
        'dragonsFlight', 'diveReady', 'lifeSurge', 'enhancedPiercingTalon', 'medicated', 'trueNorth', 'bloodbath', 'feint', 'armsLength', 'sprint'];
      this.stats = Object.assign({ mainStat: 'str', jobMod: 115, trait: 100, delay: 2.8 }, V.stats);
      this.defaultBars = [
        ['trueThrust', 'lanceBarrage', 'heavensThrust', 'spiralBlow', 'chaoticSpring', 'fangAndClaw', 'wheelingThrust', 'drakesbane', 'highJump', 'mirageDive', 'piercingTalon', 'wingedGlide'],
        ['geirskogul', 'nastrond', 'stardiver', 'starcross', 'wyrmwindThrust', 'dragonfireDive', 'riseOfTheDragon', 'lifeSurge', 'lanceCharge', 'battleLitany', 'trueNorth', 'tincture'],
        ['doomSpike', 'sonicThrust', 'coerthanTorment', 'elusiveJump', 'feint', 'bloodbath', 'secondWind', 'legSweep', 'armsLength', 'sprint', null, null],
      ];
      this.actionGroups = [
        ['Dragoon', ['trueThrust', 'raidenThrust', 'lanceBarrage', 'heavensThrust', 'spiralBlow', 'chaoticSpring', 'fangAndClaw', 'wheelingThrust', 'drakesbane',
          'piercingTalon', 'doomSpike', 'draconianFury', 'sonicThrust', 'coerthanTorment', 'highJump', 'mirageDive', 'dragonfireDive', 'riseOfTheDragon',
          'geirskogul', 'nastrond', 'stardiver', 'starcross', 'wyrmwindThrust', 'lifeSurge', 'lanceCharge', 'battleLitany', 'elusiveJump', 'wingedGlide']],
        ['Role Actions', ['trueNorth', 'feint', 'bloodbath', 'secondWind', 'legSweep', 'armsLength']],
        ['General', ['sprint', 'tincture']],
      ];
      this.referenceDps = V.ref;
      this.referenceGcd = 2.5;
    }

    initGauge() { return { mode: null, until: 0, eyes: 0, focus: 0 }; }

    resolveId(id, e) {
      if (id === 'trueThrust' && e.has('draconianFire')) return 'raidenThrust';
      if (id === 'doomSpike' && e.has('draconianFire')) return 'draconianFury';
      if ((id === 'fangAndClaw' || id === 'wheelingThrust') && e.inCombo('drgFifth')) return 'drakesbane';
      if (id === 'highJump' && e.has('diveReady')) return 'mirageDive';
      if (id === 'geirskogul' && e.has('nastrondReady')) return 'nastrond';
      if (id === 'stardiver' && e.has('starcrossReady')) return 'starcross';
      if (id === 'dragonfireDive' && e.has('dragonsFlight')) return 'riseOfTheDragon';
      return id;
    }

    check(id, e) {
      switch (id) {
        case 'raidenThrust': case 'draconianFury': if (!e.has('draconianFire')) return 'Unable to execute action.'; break;
        case 'drakesbane': if (!e.inCombo('drgFifth')) return 'Unable to execute action.'; break;
        case 'mirageDive': if (!e.has('diveReady')) return 'Unable to execute action. Dive Ready required.'; break;
        case 'nastrond': if (!e.has('nastrondReady')) return 'Unable to execute action. Nastrond Ready required.'; break;
        case 'stardiver': if (!this.dragon(e)) return 'Unable to execute action. Life of the Dragon required.'; break;
        case 'starcross': if (!e.has('starcrossReady')) return 'Unable to execute action. Starcross Ready required.'; break;
        case 'riseOfTheDragon': if (!e.has('dragonsFlight')) return 'Unable to execute action. Dragon\'s Flight required.'; break;
        case 'wyrmwindThrust': if ((e.g.focus || 0) < 2) return 'Unable to execute action. Firstminds\' Focus required.'; break;
      }
      return null;
    }

    snapshot(a, e) {
      let mult = 1, critAdd = 0;
      if (e.has('powerSurge')) mult *= 1.10;
      if (e.has('lanceCharge')) mult *= 1.10;
      if (this.dragon(e)) mult *= 1.15;
      if (e.has('battleLitany')) critAdd += 0.10;
      const main = this.stats.main + (e.has('medicated') ? B.TINCTURES[this.V.tincture].cap : 0);
      return { mult, main, critAdd };
    }

    weaponskill(id, e) {
      const a = this.actions[id], g = e.g;
      const combo = !!a.comboFrom && e.lastComboHit;
      let potency = a.comboFrom && combo ? a.comboPotency : a.potency;
      const pos = !!a.positional && e.positionalHit(a);
      if (pos) potency += a.posBonus;
      if (id === 'raidenThrust' || id === 'draconianFury') { e.removeStatus('draconianFire'); g.focus = Math.min(2, (g.focus || 0) + 1); }
      if (id === 'piercingTalon' && e.has('enhancedPiercingTalon')) { potency = 350; e.removeStatus('enhancedPiercingTalon'); }
      const crit = e.has('lifeSurge');
      if (crit) e.removeStatus('lifeSurge');
      // Power Surge lands after the hit that grants it.
      const snap = this.snapshot(a, e);
      if ((id === 'spiralBlow' || id === 'sonicThrust') && combo) e.addStatus('powerSurge', 30);
      if ((id === 'drakesbane' || id === 'coerthanTorment') && combo) e.addStatus('draconianFire', 30);
      const after = id === 'chaoticSpring' && combo ? () => e.addTStatus('chaoticSpring', 24, { snap: Object.assign({}, snap), dot: { potency: 45, id } }) : null;
      e.queueHit(id, potency, snap, a.delay, after, { positional: a.positional ? (pos ? 'hit' : 'miss') : null, crit });
    }

    ability(id, e) {
      const a = this.actions[id];
      switch (id) {
        case 'mirageDive': e.removeStatus('diveReady'); break;
        case 'geirskogul': this.setDragon(e, 'life', LIFE); e.addStatus('nastrondReady', LIFE); break;
        case 'nastrond': e.removeStatus('nastrondReady'); break;
        case 'stardiver': e.addStatus('starcrossReady', 20); break;
        case 'starcross': e.removeStatus('starcrossReady'); break;
        case 'dragonfireDive': e.addStatus('dragonsFlight', 30); break;
        case 'riseOfTheDragon': e.removeStatus('dragonsFlight'); break;
        case 'battleLitany': e.addStatus('battleLitany', 20); return;
        case 'elusiveJump': super.ability(id, e); e.addStatus('enhancedPiercingTalon', 15); return;
        case 'wingedGlide': {
          const d = e.distToTarget() || 1;
          if (d > 2.6) {
            const from = { x: e.pos.x, z: e.pos.z };
            e.pos.x *= 2.4 / d; e.pos.z *= 2.4 / d;
            e.emit('teleport', { from, to: { x: e.pos.x, z: e.pos.z } });
          }
          return;
        }
        default: return super.ability(id, e);
      }
      if (a.potency) e.queueHit(id, a.potency, this.snapshot(a, e), a.delay);
    }

    proc(id, e) {
      switch (id) {
        case 'trueThrust': case 'raidenThrust': return e.has('draconianFire');
        case 'lanceBarrage': case 'spiralBlow': return e.inCombo('trueThrust');
        case 'heavensThrust': return e.inCombo('lanceBarrage');
        case 'chaoticSpring': return e.inCombo('spiralBlow');
        case 'fangAndClaw': return e.inCombo('heavensThrust') || e.inCombo('drgFifth');
        case 'wheelingThrust': return e.inCombo('chaoticSpring') || e.inCombo('drgFifth');
        case 'drakesbane': return e.inCombo('drgFifth');
        case 'highJump': case 'mirageDive': return e.has('diveReady');
        case 'geirskogul': case 'nastrond': return e.has('nastrondReady');
        case 'stardiver': return this.dragon(e) && !e.has('starcrossReady');
        case 'starcross': return e.has('starcrossReady');
        case 'dragonfireDive': case 'riseOfTheDragon': return e.has('dragonsFlight');
        case 'wyrmwindThrust': return (e.g.focus || 0) >= 2;
        case 'piercingTalon': return e.has('enhancedPiercingTalon');
        case 'sonicThrust': return e.inCombo('doomSpike');
        case 'coerthanTorment': return e.inCombo('sonicThrust');
        case 'doomSpike': case 'draconianFury': return e.has('draconianFire');
      }
      return false;
    }

    // The gauge: Life of the Dragon's 20s and the two Firstminds' Focus.
    gaugeBuild(root) {
      super.gaugeBuild(root);
      const t = [...root.querySelectorAll('text')].find(x => x.textContent === 'DRAGON\'S EYES');
      if (t) t.textContent = 'FIRSTMINDS\' FOCUS';
    }

    gaugeUpdate(e) {
      const G = this.dg, c = G.cache, g = e.g;
      const put = (k, v, fn) => { if (c[k] !== v) { c[k] = v; fn(v); } };
      const life = this.dragon(e), left = life ? g.until - e.now : 0;
      put('mode', life ? 'life' : '', v => { G.lbl.textContent = v ? 'LIFE OF THE DRAGON' : 'DRAGON GAUGE'; G.bar.setAttribute('fill', 'url(#ds-life)'); });
      put('t', Math.round(left * 10), () => { G.bar.setAttribute('width', String(312 * Math.min(1, left / LIFE))); G.t.textContent = left > 0 ? left.toFixed(1) : ''; });
      for (let i = 0; i < 2; i++) put('e' + i, (g.focus || 0) > i, v => { G.eyes[i].setAttribute('fill', v ? 'url(#ds-eye)' : '#2a2535'); G.eyes[i].setAttribute('filter', v ? 'url(#ds-g)' : ''); });
    }

    helpHtml(seq) {
      return `
<h3>How it plays (${V.label})</h3>
<p>Level 100 Dragoon. A fixed ten-GCD combo loop with nothing to proc: <b>Raiden Thrust → Lance Barrage → Heavens' Thrust</b> (460) <b>→ Fang and Claw</b> (flank) <b>→ Drakesbane</b> (460), then <b>Raiden Thrust → Spiral Blow</b> (Power Surge, +10% for 30s) <b>→ Chaotic Spring</b> (rear, + 45 × 24s) <b>→ Wheeling Thrust</b> (rear) <b>→ Drakesbane</b>. Drakesbane leaves Draconian Fire, so the next True Thrust is <b>Raiden Thrust</b> (320), and each Raiden Thrust adds a Firstminds' Focus: two buy <b>Wyrmwind Thrust</b> (440).</p>
<p>Every minute: <b>Lance Charge</b> (+10%) and <b>Geirskogul</b> (280), which always starts <b>Life of the Dragon</b> (+15% for 20s) and readies one <b>Nastrond</b> (720); <b>Stardiver</b> (840) in Life readies <b>Starcross</b> (1,000). Every two minutes add <b>Battle Litany</b> (+10% crit) and <b>Dragonfire Dive</b> (500), which readies <b>Rise of the Dragon</b> (550). <b>High Jump</b> (400, 30s) turns into <b>Mirage Dive</b> (380). <b>Life Surge</b> (two charges, 40s) goes on Heavens' Thrust and Drakesbane. Jumps keep their long animation locks: one per gap.</p>
<h3>The opener (2.50)</h3>
${seq(['trueThrust', ['tincture'], 'spiralBlow', ['lanceCharge'], 'chaoticSpring', ['battleLitany'], ['geirskogul'], 'wheelingThrust', ['dragonfireDive'], ['lifeSurge'], 'drakesbane', ['highJump'], ['riseOfTheDragon'], 'raidenThrust', ['stardiver'], 'lanceBarrage', ['starcross'], ['lifeSurge'], 'heavensThrust', ['mirageDive'], ['nastrond'], 'fangAndClaw', ['wyrmwindThrust'], 'drakesbane', 'raidenThrust', 'spiralBlow', 'chaoticSpring'])}
<p style="color:#a9a3b4">The 7.3–7.57 numbers: True Thrust 230, Raiden Thrust 320, Lance Barrage 340 and Heavens' Thrust 460 in combo, Spiral Blow 300, Chaotic Spring 300 (340 rear) + 45 × 24s, Fang and Claw / Wheeling Thrust 300 (340 positional), Drakesbane 460, High Jump 400, Mirage Dive 380, Dragonfire Dive 500, Rise of the Dragon 550, Geirskogul 280, Nastrond 720, Stardiver 840, Starcross 1,000, Wyrmwind Thrust 440, Piercing Talon 200 (350 after Elusive Jump); auto-attacks 90 at 2.80s. Gear: The Balance's 7.4+ savage set at 2.50 (Strength ${V.stats.main.toLocaleString()}, 158 weapon damage).</p>`;
    }
  }

  const V70 = { label: 'Dawntrail 7.0–7.05', history: 'DT 7.0–7.05', tincture: 'strdt2', ref: 25700,
    stats: { hp: 150554, main: 4886, wd: 146, det: 2150, crit: 3120, dh: 2132, speed: 420 },
    note: 'Level 100 at launch: three Nastronds from every Geirskogul, Stardiver 720 into a melee-range Starcross, Mirage Dive 200; the 7.05 savage set' };

  class DragoonDT70 extends DragoonDT {
    constructor() {
      super();
      this.V = Object.assign({}, this.V, V70);
      const A = Object.assign({}, this.actions);
      set(A, 'heavensThrust', { potency: 140, comboPotency: 440, desc: 'Delivers an attack with a potency of 140.\nCombo Action: Lance Barrage\nCombo Potency: 440' });
      set(A, 'drakesbane', { potency: 440, comboPotency: 440, desc: A.drakesbane.desc.replace('460', '440') });
      set(A, 'mirageDive', { potency: 200, desc: 'Delivers an attack with a potency of 200.\nCan only be executed while under the effect of Dive Ready.' });
      set(A, 'geirskogul', { desc: 'Delivers an attack with a potency of 280 to all enemies in a straight line before you, 50% less for the rest.\nAdditional Effect: Grants Life of the Dragon, increasing damage dealt by 15%\nDuration: 20s\nAdditional Effect: Grants 3 stacks of Nastrond Ready\nDuration: 20s\n※Action changes to Nastrond while under the effect of Nastrond Ready.' });
      set(A, 'nastrond', { potency: 360, desc: 'Delivers an attack with a potency of 360 to all enemies in a straight line before you, 50% less for the rest.\nCan only be executed while under the effect of Nastrond Ready.' });
      set(A, 'stardiver', { potency: 720, aoe: [1, 0.5], desc: 'Delivers a jumping fire-based attack to target and all enemies nearby it with a potency of 720 for the first enemy, and 50% less for all remaining enemies.\nAdditional Effect: Grants Starcross Ready\nDuration: 20s\nCan only be executed while under the effect of Life of the Dragon.\n※Action changes to Starcross while under the effect of Starcross Ready.' });
      set(A, 'starcross', { potency: 900, range: B.MELEE_RANGE, aoe: [1, 0.5], desc: 'Delivers an attack to target and all enemies nearby it with a potency of 900 for the first enemy, and 50% less for all remaining enemies.\nCan only be executed while under the effect of Starcross Ready.' });
      set(A, 'piercingTalon', { potency: 150, desc: 'Delivers a ranged attack with a potency of 150.\nDoes not break the combo.' });
      set(A, 'elusiveJump', { desc: 'Executes a jump to a location 15 yalms behind you.\nCannot be executed while bound.' });
      A.tincture = B.tincture(V70.tincture);
      this.actions = A;
      this.stats = Object.assign({}, this.stats, V70.stats);
      this.referenceDps = V70.ref;
    }

    // Three Nastronds per Geirskogul; Elusive Jump gives no Enhanced Piercing Talon.
    ability(id, e) {
      if (id === 'elusiveJump') { EW.prototype.ability.call(this, id, e); return; }
      if (id === 'nastrond') {
        const s = e.statuses.nastrondReady, left = s ? s.stacks || 1 : 0, until = s ? s.until : 0;
        super.ability(id, e);
        if (left > 1) e.addStatus('nastrondReady', until - e.now, { stacks: left - 1 });
        return;
      }
      super.ability(id, e);
      if (id === 'geirskogul' && e.statuses.nastrondReady) e.statuses.nastrondReady.stacks = 3;
    }

    helpHtml(seq) {
      return super.helpHtml(seq).replace(`<h3>How it plays (${V.label})</h3>`, `<h3>How it plays (${V70.label})</h3>
<p><b>${V70.label}:</b> each Geirskogul readies <b>three</b> Nastronds (360 each, 2s apart) inside its 20s Life of the Dragon; Mirage Dive is 200, Stardiver 720 and Starcross 900 (melee range), Heavens' Thrust and Drakesbane 440, Piercing Talon 150 with no Enhanced Piercing Talon. 7.0–7.01 had Stardiver 620 and Starcross 700. Gear: The Balance's 7.05 savage set at 2.50 (Strength 4,886, 146 weapon damage) with a Grade 2 Gemdraught. The rest below is 7.1's.</p>`);
    }
  }

  B.registerJob({
    id: 'drg', name: 'Dragoon', abbr: 'DRG', role: 'melee', classJob: 22,
    versions: [{ id: 'dt71', label: V.label, history: V.history, note: V.note, create: () => new DragoonDT() },
      { id: 'dt70', label: V70.label, history: V70.history, note: V70.note, create: () => new DragoonDT70() }],
  });
})(window.BLM);
