// Dragoon, A Realm Reborn at level 50, built on the Heavensward class (drg_hw.js). The two combos are already there:
// Impulse Drive → Disembowel (−10% piercing resistance, 30s) → Chaos Thrust (+ a DoT), and True Thrust → Vorpal Thrust
// → Full Thrust, with Heavy Thrust and Phlebotomize kept up. What ARR didn't have: Blood of the Dragon, Fang and Claw,
// Wheeling Thrust, Geirskogul and Battle Litany (all 3.0), so Power Surge (+50%) is the only jump buff. Life Surge
// crits the first non-magic action, abilities included. Disembowel's piercing debuff doesn't touch Dragonfire Dive
// (fire). ARR's damage formula (B.LEVELS.arr50). Four stages:
//  - 2.45–2.57: Full Thrust 360, Chaos Thrust 250 from the rear + 35 × 30s, Phlebotomize 170 + 30 × 18s, Impulse Drive
//    180 and Heavy Thrust's +15% from any side, Jump 30s, Life Surge 50s. Ariyala's 2015 set (Longinus Zeta).
//  - 2.4–2.41: Full Thrust 330, Chaos Thrust 200 + 30, Phlebotomize 25 a tick, Impulse Drive 180 only from the rear (and
//    only a rear one starts the Disembowel combo), Heavy Thrust's buff only from the flank, Jump 40s, Life Surge 60s;
//    the Dreadwyrm Spear.
//  - 2.1–2.38: as 2.4 with Spineshatter Dive 90s and Dragonfire Dive 180s, longer jump animations; Second Coil gear.
//  - 2.0: Full Thrust 300, Chaos Thrust 160 + 20, Phlebotomize 20 a tick, Heavy Thrust +10%, Power Surge 90s, cross-class
//    Internal Release +20%, the original long jump animations; Binding Coil gear and the Mega-Potion of Strength.
// Numbers are the Lodestone notes for 2.1, 2.4 and 2.45, Gamer Escape's 2013–15 pages and xiv-sim's dragoon model
// (2014–15). The jump animation locks (0.8 / 1.0 / 1.5s) are guesses. A bot parses about 578, 536, 419 and 312.
(function (B) {
  const HW = B.DragoonHW;
  const set = (A, id, o) => { A[id] = Object.assign({}, A[id], o); };

  const VERSIONS = {
    arr245: { label: 'A Realm Reborn 2.45–2.57', history: 'ARR 2.45–2.57', ft: 360, chaos: [200, 50, 35], phlebo: 30, anySide: true, heavy: 1.15,
      jump: 30, spine: 60, dfd: 120, ls: 50, ps: 60, ir: 0.10, lock: 0.8, potion: ['X-Potion of Strength', 84], ref: 615,
      stats: { hp: 7000, main: 665, wd: 58, det: 359, crit: 575, speed: 370, delay: 2.96 },
      gear: 'Ariyala\'s 2015 set with the Longinus Zeta (Strength 665, 58 weapon damage, 2.96 delay)',
      note: 'Level 50 on TP: Heavy Thrust, Disembowel and Chaos Thrust (250 from the rear), Phlebotomize, Full Thrust 360, Jump every 30s with Power Surge, Blood for Blood +30%; no Blood of the Dragon; Final Coil gear' },
    arr24: { label: 'A Realm Reborn 2.4–2.41', history: 'ARR 2.4–2.41', ft: 330, chaos: [200, 0, 30], phlebo: 25, anySide: false, heavy: 1.15,
      jump: 40, spine: 60, dfd: 120, ls: 60, ps: 60, ir: 0.10, lock: 0.8, potion: ['X-Potion of Strength', 84], ref: 570,
      stats: { hp: 7000, main: 665, wd: 58, det: 359, crit: 558, speed: 370, delay: 2.88 },
      gear: 'the same set with the Dreadwyrm Spear (Strength 665, 58 weapon damage, 2.88 delay)',
      note: 'Level 50 on TP: Impulse Drive from the rear and Heavy Thrust from the flank, Full Thrust 330, Chaos Thrust 200, Jump 40s with Power Surge; Final Coil gear' },
    arr21: { label: 'A Realm Reborn 2.1–2.38', history: 'ARR 2.1–2.38', ft: 330, chaos: [200, 0, 30], phlebo: 25, anySide: false, heavy: 1.15,
      jump: 40, spine: 90, dfd: 180, ls: 60, ps: 60, ir: 0.10, lock: 1.0, potion: ['X-Potion of Strength', 84], ref: 445,
      stats: { hp: 6000, main: 580, wd: 53, det: 290, crit: 526, speed: 431, delay: 2.96 },
      gear: 'xiv-sim\'s 2014 Second Coil set with the High Allagan Spear (Strength 580, 53 weapon damage, 2.96 delay)',
      note: 'Level 50 on TP: positional Impulse Drive and Heavy Thrust, Full Thrust 330, Jump 40s, Spineshatter Dive 90s and Dragonfire Dive 180s; Second Coil gear' },
    arr20: { label: 'A Realm Reborn 2.0–2.0', history: 'ARR 2.0–2.0', ft: 300, chaos: [160, 0, 20], phlebo: 20, anySide: false, heavy: 1.10,
      jump: 40, spine: 90, dfd: 180, ls: 60, ps: 90, ir: 0.20, lock: 1.5, potion: ['Mega-Potion of Strength', 61], ref: 330,
      stats: { hp: 5000, main: 501, wd: 47, det: 336, crit: 486, speed: 449, delay: 2.96 },
      gear: 'an end-of-2.0 set with the Allagan Spear (Strength 501, 47 weapon damage, 2.96 delay)',
      note: 'Level 50 at launch: Full Thrust 300, Chaos Thrust 160, Heavy Thrust +10% from the flank, Power Surge every 90s, long jump animations, Internal Release +20%; Binding Coil gear' },
  };

  class DragoonARR extends HW {
    constructor(v) {
      super();
      const V = this.V = VERSIONS[v];
      this.level = 50;
      this.levelKey = 'arr50';
      this.potionCap = V.potion[1];
      const A = Object.assign({}, this.actions);
      for (const k of ['bloodOfTheDragon', 'fangAndClaw', 'wheelingThrust', 'geirskogul', 'battleLitany']) delete A[k];
      set(A, 'fullThrust', { comboPotency: V.ft, desc: `Delivers an attack with a potency of 100.\nCombo Action: Vorpal Thrust\nCombo Potency: ${V.ft}` });
      set(A, 'chaosThrust', V.chaos[1]
        ? { comboPotency: V.chaos[0], posBonus: V.chaos[1], dot: { potency: V.chaos[2], duration: 30 }, desc: `Delivers an attack with a potency of 100.\nCombo Action: Disembowel\nCombo Potency: ${V.chaos[0]}\nRear Combo Potency: ${V.chaos[0] + V.chaos[1]}\nCombo Bonus: Damage over time\nPotency: ${V.chaos[2]}\nDuration: 30s` }
        : { comboPotency: V.chaos[0], positional: undefined, posBonus: 0, dot: { potency: V.chaos[2], duration: 30 }, desc: `Delivers an attack with a potency of 100.\nCombo Action: Disembowel\nCombo Potency: ${V.chaos[0]}\nCombo Bonus: Damage over time\nPotency: ${V.chaos[2]}\nDuration: 30s` });
      set(A, 'phlebotomize', { dot: { potency: V.phlebo, duration: 18 }, desc: `Delivers an attack with a potency of 170.\nAdditional Effect: Damage over time\nPotency: ${V.phlebo}\nDuration: 18s` });
      set(A, 'heavyThrust', { desc: `Delivers an attack with a potency of 100.\n170 when executed from a target's flank.\n${V.anySide ? 'Additional Effect' : 'Flank Bonus'}: Increases damage dealt by ${Math.round((V.heavy - 1) * 100)}%\nDuration: 20s` });
      if (!V.anySide) set(A, 'impulseDrive', { potency: 100, positional: 'rear', posBonus: 80, desc: 'Delivers an attack with a potency of 100.\n180 when executed from a target\'s rear.\nOnly a rear Impulse Drive starts the Disembowel combo.' });
      set(A, 'jump', { recast: V.jump, lock: V.lock });
      set(A, 'spineshatterDive', { recast: V.spine, lock: V.lock });
      set(A, 'dragonfireDive', { recast: V.dfd, lock: V.lock });
      set(A, 'lifeSurge', { recast: V.ls, desc: 'Ensures critical damage for the first non-magic action used.\nDuration: 10s' });
      set(A, 'powerSurge', { recast: V.ps });
      set(A, 'bloodForBlood', { desc: 'Increases damage dealt by 30% while increasing damage taken.\nDuration: 20s\n(Lancer)' });
      set(A, 'internalRelease', { desc: `Increases critical hit rate by ${V.ir * 100}%.\nDuration: 15s\n(Pugilist cross-class)` });
      A.tincture = Object.assign({}, A.tincture, { name: V.potion[0], desc: `This diluted brew temporarily increases strength.\nStrength +20% (Max ${V.potion[1]})\nDuration: 15s` });
      this.actions = A;
      this.stats = Object.assign({}, this.stats, V.stats, { dh: 341 });
      this.autoAttack = Object.assign({}, this.autoAttack, { delay: V.stats.delay });
      this.selfStatusOrder = this.selfStatusOrder.filter(k => !['bloodOfTheDragon', 'sharperFangAndClaw', 'enhancedWheelingThrust', 'battleLitany'].includes(k));
      this.defaultBars = [
        ['trueThrust', 'vorpalThrust', 'fullThrust', 'impulseDrive', 'disembowel', 'chaosThrust', 'heavyThrust', 'phlebotomize', 'jump', 'spineshatterDive', 'dragonfireDive', 'legSweep'],
        ['powerSurge', 'lifeSurge', 'bloodForBlood', 'internalRelease', 'tincture', 'invigorate', 'piercingTalon', 'doomSpike', 'elusiveJump', 'keenFlurry', 'secondWind', 'sprint'],
        [null, null, null, null, null, null, null, null, null, null, null, null],
      ];
      this.actionGroups = this.actionGroups.map(([n, ids]) => [n, ids.filter(x => A[x])]);
      this.referenceDps = V.ref;
      this.referenceGcd = 2.45;
    }

    weaponskill(id, e) {
      const V = this.V;
      const prev = e.statuses.heavyThrust ? e.statuses.heavyThrust.until : 0;
      const flank = e.positionalHit({ positional: 'flank' });
      super.weaponskill(id, e);
      if (id === 'heavyThrust') {
        // 20s; before 2.45 only from the flank (a miss keeps whatever was left).
        if (V.anySide || flank) e.addStatus('heavyThrust', 20);
        else if (prev > e.now) e.statuses.heavyThrust.until = prev;
        else e.removeStatus('heavyThrust');
      }
      // Before 2.45 only a rear Impulse Drive starts the Disembowel combo.
      if (id === 'impulseDrive' && !V.anySide && !e.positionalHit({ positional: 'rear' })) e.combo = null;
    }

    ability(id, e) {
      const a = this.actions[id];
      if (!a.potency) { super.ability(id, e); return; }
      let potency = a.potency;
      if (a.jumpBuff) {
        if (e.has('powerSurge')) { potency = Math.round(potency * 1.5); e.removeStatus('powerSurge'); }
        this.gap(e);
      }
      if (id === 'dragonfireDive') this.gap(e);
      // Life Surge takes the first non-magic action, abilities included.
      let crit = false;
      if (e.has('lifeSurge')) { crit = true; e.removeStatus('lifeSurge'); }
      e.queueHit(id, potency, this.snapshot(a, e), a.delay, null, { crit });
    }

    snapshot(a, e) {
      const s = super.snapshot(a, e);
      if (e.has('heavyThrust') && this.V.heavy !== 1.15) s.mult *= this.V.heavy / 1.15;
      if (a === this.actions.dragonfireDive && e.tHas('piercingResDown')) s.mult /= 1.10;
      if (e.has('internalRelease') && this.V.ir !== 0.10) s.critAdd += this.V.ir - 0.10;
      return s;
    }

    speedInfo(e) { return `GCD ${e.gcdForSpeed(e.stats.speed).toFixed(2)} · A Realm Reborn's formula (no Direct Hit)`; }

    // No Blood of the Dragon: the gauge shows Heavy Thrust and Disembowel instead.
    gaugeBuild(root) {
      super.gaugeBuild(root);
      for (const t of root.querySelectorAll('text')) if (t.textContent === 'BLOOD OF THE DRAGON') t.textContent = 'HEAVY THRUST';
    }
    gaugeUpdate(e) {
      const G = this.dg, c = G.cache;
      const s = e.statuses.heavyThrust, left = s ? Math.max(0, s.until - e.now) : 0;
      const k = Math.round(left * 4);
      if (c.k !== k) {
        c.k = k;
        G.b.setAttribute('width', (250 * Math.min(1, left / 20)).toFixed(1));
        G.b.setAttribute('fill', left > 0 && left < 5 ? '#ff8f6b' : '#5a7fe0');
        G.t.textContent = left ? Math.ceil(left) + 's' : '';
      }
    }

    helpHtml(seq) {
      const V = this.V;
      return `
<h3>How it plays (${V.label})</h3>
<p>Level 50 Dragoon on TP, before Blood of the Dragon. Keep up <b>Heavy Thrust</b> (+${Math.round((V.heavy - 1) * 100)}% damage, 20s${V.anySide ? '' : ', and only from the flank'}), <b>Disembowel</b>'s −10% piercing resistance (Impulse Drive${V.anySide ? '' : ' from the rear'} → Disembowel → <b>Chaos Thrust</b>, ${V.chaos[0]}${V.chaos[1] ? ` or ${V.chaos[0] + V.chaos[1]} from the rear` : ''} + ${V.chaos[2]} × 30s) and <b>Phlebotomize</b> (170 + ${V.phlebo} × 18s); otherwise True Thrust → Vorpal Thrust → <b>Full Thrust</b> (${V.ft}).</p>
<p><b>Jump</b> (200, ${V.jump}s) with <b>Power Surge</b> (+50%, ${V.ps}s), <b>Spineshatter Dive</b> (170, ${V.spine}s) and <b>Dragonfire Dive</b> (250, ${V.dfd}s) inside <b>Blood for Blood</b> (+30%); <b>Life Surge</b> (${V.ls}s) on Full Thrust; Internal Release (+${V.ir * 100}% crit) and Leg Sweep on cooldown; Invigorate (500 TP) when TP runs low.${V.lock > 1 ? ' The jumps have long animations at launch: each one costs some GCD time.' : ''}</p>
<h3>An opener (from xiv-sim's 2015 priority)</h3>
${seq(['heavyThrust', ['internalRelease'], 'impulseDrive', ['bloodForBlood'], 'disembowel', ['tincture'], 'chaosThrust', ['powerSurge'], ['jump'], 'phlebotomize', ['legSweep'], 'trueThrust', ['spineshatterDive'], 'vorpalThrust', ['lifeSurge'], 'fullThrust', ['dragonfireDive'], 'trueThrust', 'vorpalThrust', 'fullThrust'])}
<p style="color:#a9a3b4">The numbers: True Thrust 150, Vorpal Thrust combo 200, Full Thrust combo ${V.ft}, Impulse Drive ${V.anySide ? '180' : '100 (180 rear)'}, Disembowel combo 220, Chaos Thrust combo ${V.chaos[0]}${V.chaos[1] ? ` (${V.chaos[0] + V.chaos[1]} rear)` : ''} + ${V.chaos[2]} × 30s, Heavy Thrust 100 (170 flank), Phlebotomize 170 + ${V.phlebo} × 18s, Jump 200, Spineshatter Dive 170, Dragonfire Dive 250, Leg Sweep 130. ARR's formula here is a refit of the 2013–14 community formulas. Gear: ${V.gear}, with the ${V.potion[0]} (max ${V.potion[1]}).</p>`;
    }
  }

  B.registerJob({
    id: 'drg', name: 'Dragoon', abbr: 'DRG', role: 'melee', classJob: 22,
    versions: ['arr245', 'arr24', 'arr21', 'arr20'].map(id => ({ id, label: VERSIONS[id].label, history: VERSIONS[id].history, note: VERSIONS[id].note, create: () => new DragoonARR(id) })),
  });
})(window.BLM);
