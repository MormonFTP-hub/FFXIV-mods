// Ranger: the bow. Marking Shot's Precision (+300 Critical Hit) powers Deadshot (+35%); Snare Shot's Slow opens
// Burst Arrow and Rooting Eye; Drill Dart's Bleed and Griffon Arrow's Crimson Flames feed Concentrated Fire.
(function () {
  'use strict';
  const A2 = window.A2;
  const C = 'ranger';
  const on = A2.specOn;

  A2.defineClass(C, {
    name: 'Ranger', order: 4, role: 'Ranged DPS · bow', icon: 'bow', hue: 135,
    blurb: 'Precision windows, charged Deadshot, Slow into Burst Arrow, bleeds.',
    botBehind: false, botRange: 18, botStand: 9,
    bar: ['snipe', 'tempestShot', 'snareShot', 'markingShot', 'drillDart', 'arrowScattershot', 'galeArrow', 'burstArrow', 'suppressingArrow', 'deadshot', 'explosionTrap'],
    defaultStigmas: ['vaizelsAuthority', 'bowOfBlessing', 'supportingFire', 'griffonArrow'],
    defaultSpecs: {snipe: [1, 2], deadshot: [0, 1], drillDart: [1, 2, 3], burstArrow: [0, 2], markingShot: [2, 3]},
    over: {
      snipe: {anim: 0.55, range: 20},
      tempestShot: {anim: 0.65, range: 20},
      snareShot: {anim: 0.7, range: 20, inflicts: {slow: 5}},
      markingShot: {anim: 0.7, range: 20, onUse(sim, s) { if (on(s, 0)) { /* +5% Perfect Chance: not modelled */ } }},
      drillDart: {
        anim: 0.6, range: 20, mpGain: 0,
        onHit(sim, ev) { if (ev.crit) sim.p.mp = Math.min(sim.stats.mpMax, sim.p.mp + 100); },
        specs: {0: {mod: {dotDur: 2}}},
      },
      arrowScattershot: {hits: 4, anim: 0.55, range: 20, needs: 'stagger'},
      galeArrow: {anim: 0.8, range: 20, specs: {0: {hook: true}}, onUse(sim, s) { if (on(s, 0)) { const b = sim.buffOn('galeArrow'); if (b) b.until += 5; } }},
      burstArrow: {anim: 0.8, range: 20, needs: ['slow', 'root']},
      suppressingArrow: {anim: 0.7, range: 20},
      deadshot: {
        anim: 0.5, range: 20, chargeTime: 1.5,
        power(sim, s, base, atk) { const k = sim.buffOn('markingShot') ? 1.35 : 1; return [base * k, atk * k]; },
        specs: {0: {mod: {mpPct: -100}}, 3: {text: 'Extra damage on hit (amount not published)'}},
      },
      explosionTrap: {anim: 0.6, range: 5, contact: 1.0, inflicts: {stun: 3}, desc: 'A trap at your feet that goes off when the target steps on it. On a dummy it only hits if you stand within 5m.'},
      explosiveArrow: {anim: 0.8, range: 20, power(sim, s, base, atk) { const k = sim.hasStatus('slow') || sim.hasStatus('root') ? 1.2 : 1; return [base * k, atk * k]; }},
      illusoryArrow: {anim: 0.7, range: 20},
      arrowStorm: {anim: 0.9, range: 20, inflicts: {stun: 3}},
      assaultSmite: {anim: 0.9, range: 20},
      sealingArrow: {anim: 0.7, range: 20},
      ambushKick: {anim: 0.8, range: 5, move: 'behind'},
      griffonArrow: {anim: 0.8, range: 20, specs: {1: {mod: {dotDur: 5}}, 3: {mod: {dotEvery: 0.5}}, 4: {mod: {dotPct: 20}}}},
      ensnaringTrap: {anim: 0.6, range: 5, contact: 1.0, inflicts: {airborne: 3}},
      supportingFire: {anim: 0.4, noHit: true, keep: true, specs: {0: {mod: {orbChance: 25}}, 1: {mod: {orbDur: 15}}, 2: {mod: {cd: -30}}, 3: {mod: {orbCrit: true}}}},
      vaizelsAuthority: {anim: 0.3},
      bowOfBlessing: {
        anim: 0.3,
        onUse(sim, s) {
          const b = sim.buffOn('bowOfBlessing');
          if (!b) return;
          if (on(s, 0)) b.stat.multiHit = (b.stat.multiHit || 0) + 50;
          if (on(s, 2)) b.stat.critDmg = 20;
          if (on(s, 3)) b.stat.double = 7;
          if (on(s, 4)) b.until += 5;
        },
        specs: {0: {hook: true}, 2: {hook: true}, 3: {hook: true}, 4: {hook: true}},
      },
    },

    passives(sim, st) {
      const lv = sim.lvP;
      sim.pas = {
        conc: A2.pv(C, 'concentratedFire', 1, lv), rooting: A2.pv(C, 'rootingEye', 1, lv), melee: A2.pv(C, 'meleeFire', 1, lv),
        soul: A2.pv(C, 'huntersSoul', 1, lv),
      };
      st.pveBoost = (st.pveBoost || 0) + A2.pv(C, 'focusedEye', 1, lv);
      st.double = (st.double || 0) + A2.pv(C, 'focusedEye', 3, lv);
      st.critDmg = (st.critDmg || 0) + A2.pv(C, 'huntersResolve', 0, lv);
    },

    onHit(sim, ev, o) {
      if (o.proc || o.dot) return;
      const dot = Object.keys(sim.tg.debuffs).some((k) => k.indexOf('dot:') === 0 && sim.tg.debuffs[k].until > sim.t);
      if (dot && sim.rand() < 0.5 && sim.icdReady('conc', 1)) A2.procHit(sim, 'conc', 'Concentrated Fire', sim.pas.conc, 31.2, 135);
      if ((sim.hasStatus('slow') || sim.hasStatus('root')) && sim.rand() < 0.5 && sim.icdReady('rooting', 1)) A2.procHit(sim, 'rooting', 'Rooting Eye', sim.pas.rooting, 35, 100);
      if (sim.rand() < 0.25 && sim.icdReady('melee', 1)) A2.procHit(sim, 'melee', 'Melee Fire', sim.pas.melee, 26.4, 160);
      if (ev.crit && sim.rand() < 0.5 && sim.icdReady('soul', 1)) A2.procHit(sim, 'soul', 'Hunter\'s Soul', sim.pas.soul, 53.8, 120);
    },

    rotation(sim) {
      const out = [];
      if (sim.total > 0) out.push('vaizelsAuthority', 'bowOfBlessing', 'supportingFire');
      out.push('markingShot');
      if (sim.buffOn('markingShot')) out.push('deadshot');
      out.push('galeArrow', 'griffonArrow', 'explosiveArrow', 'burstArrow', 'arrowScattershot', 'snareShot', 'drillDart', 'suppressingArrow',
               'arrowStorm', 'illusoryArrow', 'sealingArrow', 'assaultSmite');
      if (!sim.has('markingShot') || sim.cdLeft('markingShot') > 4) out.push('deadshot');
      if (sim.p.mp > 350) out.push('tempestShot');
      out.push('snipe');
      return out;
    },
  });
})();
