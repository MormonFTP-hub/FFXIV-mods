// Dragoon, Endwalker at level 90, in two versions. Built on the Shadowbringers class (drg_shb.js), with Blood of the
// Dragon a passive trait now (no action, no timer, no bonus on the jumps). The ten-GCD loop: True / Raiden Thrust →
// Disembowel (Power Surge, +10% for 30s) → Chaotic Spring (a DoT) → Wheeling Thrust → Fang and Claw, then Raiden Thrust →
// Vorpal Thrust → Heavens' Thrust → Fang and Claw → Wheeling Thrust; every fifth hit gets +100 and always readies Raiden
// Thrust. Raiden Thrust adds a Firstminds' Focus (two buy Wyrmwind Thrust, 420). Mirage Dive (after High Jump) always
// adds an Eye; Geirskogul with two enters Life of the Dragon for 30s: Nastrond (360, 10s) and Stardiver (620).
// Lance Charge (+10%, 60s), Dragon Sight (+10%, 120s), Battle Litany (+10% crit, 15s, 120s), Life Surge (two charges).
//  - 6.0–6.28: Life Surge 45s. The 6.08 numbers (6.0–6.05 had Heavens' Thrust 430, Raiden 260, Stardiver 500).
//  - 6.3–6.58: Life Surge 40s; from 6.4 Dragon Sight makes your positionals land. Anabaseios gear.
// Numbers are the game data at each patch (xivapi's datamining) and the Lodestone notes; gear is The Balance's set for
// each tier. ref: a scripted bot parses about 9,760 / 11,950 on these.
(function (B) {
  const SHB = B.DragoonShB;
  const EPS = 1e-6;
  const ws = (o) => Object.assign({ kind: 'gcd', target: true, range: B.MELEE_RANGE, delay: 0.5, fx: 'gnbFang' }, o);
  const ab = (o) => Object.assign({ kind: 'ogcd' }, o);
  const set = B.setAction;     // a version's change to an action (its description's numbers follow the potency)
  const VERSIONS = {
    ew63: { label: 'Endwalker 6.3–6.58', history: 'EW 6.3–6.58', lifeSurge: 40, sightNorth: true, tincture: 'str', ref: 12670,
      stats: { hp: 86628, main: 3379, wd: 132, det: 1818, crit: 2567, dh: 1540, speed: 400 },
      note: 'Level 90: Life Surge 40s, Dragon Sight making positionals land (6.4); Anabaseios gear' },
    ew60: { label: 'Endwalker 6.0–6.28', history: 'EW 6.0–6.28', lifeSurge: 45, sightNorth: false, tincture: 'str7', ref: 10350,
      stats: { hp: 72413, main: 2949, wd: 126, det: 1545, crit: 2462, dh: 1577, speed: 400 },
      note: 'Level 90: Blood of the Dragon a trait, Raiden Thrust and Firstminds\' Focus into Wyrmwind Thrust, Eyes into a 30s Life of the Dragon; Abyssos gear' },
  };

  class DragoonEW extends SHB {
    constructor(version) {
      super('shb501');
      const V = VERSIONS[version];
      this.V = Object.assign({}, this.V, V, { fifth: 100, ctDot: 45 });
      this.level = 90;
      this.levelKey = 90;
      this.model = 'drg-shb';
      const A = Object.assign({}, this.actions);
      for (const k of ['fullThrust', 'chaosThrust', 'bloodOfTheDragon']) delete A[k];
      set(A, 'trueThrust', { potency: 230, desc: 'Delivers an attack with a potency of 230.\n※Action changes to Raiden Thrust under Draconian Fire.' });
      set(A, 'raidenThrust', { potency: 280, desc: 'Delivers an attack with a potency of 280.\nAdditional Effect: Grants Firstminds\' Focus (up to 2)\nCan only be executed under Draconian Fire.' });
      set(A, 'vorpalThrust', { potency: 130, comboPotency: 280, desc: 'Delivers an attack with a potency of 130.\nCombo Action: True Thrust or Raiden Thrust\nCombo Potency: 280' });
      A.heavensThrust = ws({ name: 'Heavens\' Thrust', potency: 100, comboPotency: 480, comboFrom: 'vorpalThrust', fx: 'gnbBurst', desc: 'Delivers an attack with a potency of 100.\nCombo Action: Vorpal Thrust\nCombo Potency: 480\nCombo Bonus: Grants Fang and Claw Bared\nDuration: 30s' });
      set(A, 'disembowel', { potency: 140, comboPotency: 250, desc: 'Delivers an attack with a potency of 140.\nCombo Action: True Thrust or Raiden Thrust\nCombo Potency: 250\nCombo Bonus: Grants Power Surge, increasing damage dealt by 10%\nDuration: 30s' });
      A.chaoticSpring = ws({ name: 'Chaotic Spring', potency: 100, comboPotency: 260, comboFrom: 'disembowel', positional: 'rear', posBonus: 40, dot: { potency: 45, duration: 24 }, fx: 'gnbFang3',
        desc: 'Delivers an attack with a potency of 100.\n140 when executed from a target\'s rear.\nCombo Action: Disembowel\nCombo Potency: 260\nRear Combo Potency: 300\nCombo Bonus: Damage over time\nPotency: 45\nDuration: 24s\nCombo Bonus: Grants Wheel in Motion\nDuration: 30s' });
      for (const id of ['fangAndClaw', 'wheelingThrust']) set(A, id, { potency: 260, desc: A[id].desc.replace(/\d{3}/, '260') });
      set(A, 'highJump', { potency: 400, desc: 'Delivers a jumping attack with a potency of 400.\nAdditional Effect: Grants Dive Ready\nDuration: 15s' });
      set(A, 'spineshatterDive', { potency: 250, charges: 2, desc: 'Delivers a jumping attack with a potency of 250.\nMaximum Charges: 2' });
      set(A, 'dragonfireDive', { potency: 300 });
      set(A, 'mirageDive', { potency: 200, desc: 'Delivers an attack with a potency of 200.\nAdditional Effect: Strengthens the gaze of your Dragon Gauge by 1\nCan only be executed while under the effect of Dive Ready.' });
      set(A, 'geirskogul', { potency: 260, aoe: 0.7, desc: 'Delivers an attack with a potency of 260 to all enemies in a straight line before you, 30% less for the rest.\nAdditional Effect: Changes to Nastrond and grants Life of the Dragon (30s) when the Dragon Gauge holds two Eyes.' });
      set(A, 'nastrond', { potency: 360, aoe: 0.7 });
      set(A, 'stardiver', { potency: 620, aoe: 0.7 });
      A.wyrmwindThrust = ab({ name: 'Wyrmwind Thrust', recast: 10, potency: 420, target: true, range: 15, aoe: 0.5, delay: 0.6, fx: 'senei', desc: 'Delivers an attack to all enemies in a straight line before you with a potency of 420 for the first enemy, and 50% less for all remaining enemies.\nCan only be executed with two Firstminds\' Focus.' });
      set(A, 'lanceCharge', { recast: 60, desc: 'Increases damage dealt by 10%.\nDuration: 20s' });
      set(A, 'battleLitany', { recast: 120, desc: 'Increases critical hit rate of self and nearby party members by 10%.\nDuration: 15s' });
      set(A, 'lifeSurge', { recast: V.lifeSurge, charges: 2, desc: `Ensures critical damage for the next weaponskill.\nDuration: 5s\nMaximum Charges: 2\nRecast: ${V.lifeSurge}s` });
      set(A, 'dragonSight', { desc: `Grants Right Eye to self, increasing damage dealt by 10%.${V.sightNorth ? ' Also nullifies your positional requirements.' : ''}\nDuration: 20s` });
      A.tincture = B.tincture(V.tincture);
      this.actions = A;
      this.statuses = Object.assign({}, this.statuses, {
        powerSurge: { name: 'Power Surge', self: true, icon: 'st_disembowel' },
        chaoticSpring: { name: 'Chaotic Spring', self: false, icon: 'st_chaos' },
      });
      this.selfStatusOrder = ['lifeOfTheDragon', 'powerSurge', 'lanceCharge', 'battleLitany', 'rightEye', 'raidenThrustReady', 'sharperFangAndClaw',
        'enhancedWheelingThrust', 'diveReady', 'lifeSurge', 'medicated', 'trueNorth', 'bloodbath', 'feint', 'armsLength', 'sprint'];
      this.targetStatusOrder = ['chaoticSpring'];
      this.stats = Object.assign({ mainStat: 'str', jobMod: 115, trait: 100, delay: 2.8 }, V.stats);
      this.autoAttack = { potency: 90, delay: 2.8, range: B.MELEE_RANGE };
      const swap = { fullThrust: 'heavensThrust', chaosThrust: 'chaoticSpring', bloodOfTheDragon: 'wyrmwindThrust' };
      this.defaultBars = this.defaultBars.map(r => r.map(id => (id && swap[id]) || (id && A[id] ? id : null)));
      this.actionGroups = this.actionGroups.map(([n, ids]) => [n, ids.map(id => swap[id] || id).filter(id => A[id])]);
      this.referenceDps = V.ref;
      this.referenceGcd = 2.5;
    }

    initGauge() { return { mode: null, until: 0, eyes: 0, focus: 0 }; }
    dragon(e) { return e.g.mode === 'life' && e.g.until > e.now + EPS; }
    extendBlood() {}

    check(id, e) {
      const g = e.g;
      switch (id) {
        case 'raidenThrust': if (!e.has('raidenThrustReady')) return 'Unable to execute action.'; break;
        case 'fangAndClaw': if (!e.has('sharperFangAndClaw')) return 'Unable to execute action.'; break;
        case 'wheelingThrust': if (!e.has('enhancedWheelingThrust')) return 'Unable to execute action.'; break;
        case 'mirageDive': if (!e.has('diveReady')) return 'Unable to execute action. Dive Ready required.'; break;
        case 'nastrond': case 'stardiver': if (!this.dragon(e)) return 'Unable to execute action. Life of the Dragon required.'; break;
        case 'wyrmwindThrust': if ((g.focus || 0) < 2) return 'Unable to execute action. Firstminds\' Focus required.'; break;
      }
      return null;
    }

    snapshot(a, e) {
      let mult = 1, critAdd = 0;
      if (e.has('powerSurge')) mult *= 1.10;
      if (e.has('lanceCharge')) mult *= 1.10;
      if (e.has('rightEye')) mult *= 1.10;
      if (e.has('battleLitany')) critAdd += 0.10;
      const main = this.stats.main + (e.has('medicated') ? B.TINCTURES[this.V.tincture].cap : 0);
      return { mult, main, critAdd };
    }

    weaponskill(id, e) {
      const a = this.actions[id], g = e.g;
      const combo = !!a.comboFrom && e.lastComboHit;
      let potency = a.comboFrom && combo ? a.comboPotency : a.potency;
      const pos = !!a.positional && (e.positionalHit(a) || (this.V.sightNorth && e.has('rightEye')));
      if (pos) potency += a.posBonus;
      if (id === 'raidenThrust') { e.removeStatus('raidenThrustReady'); g.focus = Math.min(2, (g.focus || 0) + 1); }
      // The fourth hit opens the fifth, which always readies Raiden Thrust.
      if (id === 'fangAndClaw' || id === 'wheelingThrust') {
        const mine = id === 'fangAndClaw' ? 'sharperFangAndClaw' : 'enhancedWheelingThrust';
        const other = id === 'fangAndClaw' ? 'enhancedWheelingThrust' : 'sharperFangAndClaw';
        const fifth = !!(e.statuses[mine] && e.statuses[mine].fifth);
        if (fifth) potency += this.V.fifth;
        e.removeStatus(mine, true);
        if (!fifth) e.addStatus(other, 30, { fifth: true }); else e.addStatus('raidenThrustReady', 30);
      } else { e.removeStatus('sharperFangAndClaw', true); e.removeStatus('enhancedWheelingThrust', true); }
      if (id === 'heavensThrust' && combo) e.addStatus('sharperFangAndClaw', 30, { fifth: false });
      if (id === 'chaoticSpring' && combo) e.addStatus('enhancedWheelingThrust', 30, { fifth: false });
      const crit = e.has('lifeSurge');
      if (crit) e.removeStatus('lifeSurge');
      const snap = this.snapshot(a, e);
      if (id === 'disembowel' && combo) e.addStatus('powerSurge', 30);
      const after = id === 'chaoticSpring' && combo ? () => e.addTStatus('chaoticSpring', 24, { snap: Object.assign({}, snap), dot: { potency: 45, id } }) : null;
      e.queueHit(id, potency, snap, a.delay, after, { positional: a.positional ? (pos ? 'hit' : 'miss') : null, crit });
    }

    ability(id, e) {
      const a = this.actions[id], g = e.g;
      switch (id) {
        case 'highJump': e.addStatus('diveReady', 15); break;
        case 'spineshatterDive': break;
        case 'mirageDive': e.removeStatus('diveReady'); g.eyes = Math.min(2, g.eyes + 1); e.emit('eyes', {}); break;
        case 'geirskogul': if (g.eyes >= 2) { g.eyes = 0; this.setDragon(e, 'life', 30); } break;
        case 'wyrmwindThrust': g.focus -= 2; break;
        case 'lanceCharge': e.addStatus('lanceCharge', 20); return;
        case 'battleLitany': e.addStatus('battleLitany', 15); return;
        default: return super.ability(id, e);
      }
      if (a.potency) e.queueHit(id, a.potency, this.snapshot(a, e), a.delay);
    }

    // Life of the Dragon simply ends; the Eyes it didn't use stay.
    process(e) {
      const g = e.g;
      if (g.mode && e.now >= g.until - EPS) { g.mode = null; g.until = 0; e.removeStatus('lifeOfTheDragon'); }
    }

    proc(id, e) {
      if (id === 'wyrmwindThrust') return (e.g.focus || 0) >= 2;
      if (id === 'heavensThrust') return e.inCombo('vorpalThrust');
      if (id === 'chaoticSpring') return e.inCombo('disembowel');
      if (id === 'fangAndClaw') return e.has('sharperFangAndClaw');
      if (id === 'wheelingThrust') return e.has('enhancedWheelingThrust');
      return super.proc(id, e);
    }

    helpHtml(seq) {
      const V = this.V;
      return `
<h3>How it plays (${V.label})</h3>
<p>Level 90 Dragoon. A fixed ten-GCD loop: <b>True / Raiden Thrust → Disembowel</b> (Power Surge, +10% for 30s) <b>→ Chaotic Spring</b> (300 from the rear, + 45 × 24s) <b>→ Wheeling Thrust → Fang and Claw</b>, then <b>Raiden Thrust → Vorpal Thrust → Heavens' Thrust</b> (480) <b>→ Fang and Claw → Wheeling Thrust</b>. The fifth hit is 100 stronger and readies Raiden Thrust (280), which adds a Firstminds' Focus: two buy <b>Wyrmwind Thrust</b> (420).</p>
<p><b>High Jump</b> (400, 30s) readies <b>Mirage Dive</b> (200, +1 Eye). <b>Geirskogul</b> (260, 30s) with two Eyes starts <b>Life of the Dragon</b> for 30s: <b>Nastrond</b> (360, every 10s) and <b>Stardiver</b> (620). <b>Lance Charge</b> (+10%, 60s), <b>Dragon Sight</b> (+10%, 120s${V.sightNorth ? ', positionals always land from 6.4' : ''}), <b>Battle Litany</b> (+10% crit, 15s, 120s) and <b>Life Surge</b> (a critical hit, two charges, ${V.lifeSurge}s) go on Heavens' Thrust and the fifth hits. Spineshatter Dive (250, two charges) and Dragonfire Dive (300) whenever.</p>
<h3>The opener (The Balance, 2.50)</h3>
${seq(['trueThrust', ['tincture'], 'disembowel', ['lanceCharge'], ['dragonSight'], 'chaoticSpring', ['battleLitany'], ['geirskogul'], 'wheelingThrust', ['highJump'], ['lifeSurge'], 'fangAndClaw', ['dragonfireDive'], ['wyrmwindThrust'], 'raidenThrust', ['spineshatterDive'], ['mirageDive'], 'vorpalThrust', ['lifeSurge'], 'heavensThrust', ['spineshatterDive'], 'fangAndClaw', 'wheelingThrust', 'raidenThrust', ['wyrmwindThrust'], 'disembowel', 'chaoticSpring'])}
<p style="color:#a9a3b4">${V.label} numbers: True Thrust 230, Raiden Thrust 280, Vorpal 280 and Heavens' Thrust 480 in combo, Disembowel 250, Chaotic Spring 260 (300 rear) + 45 × 24s, Fang and Claw / Wheeling Thrust 260 (300 positional, +100 as the fifth hit), High Jump 400, Mirage Dive 200, Spineshatter Dive 250, Dragonfire Dive 300, Geirskogul 260, Nastrond 360, Stardiver 620, Wyrmwind Thrust 420; auto-attacks 90 at 2.80s. Gear: The Balance's set for the tier (Strength ${V.stats.main.toLocaleString()}).</p>`;
    }
  }

  B.DragoonEW = DragoonEW;
  B.registerJob({
    id: 'drg', name: 'Dragoon', abbr: 'DRG', role: 'melee', classJob: 22,
    versions: ['ew63', 'ew60'].map(v => ({ id: v, label: VERSIONS[v].label, history: VERSIONS[v].history, note: VERSIONS[v].note, create: () => new DragoonEW(v) })),
  });
})(window.BLM);
