// Chanter: a staff fighter with mantras. Impactful Crush, Spinning Strike, Marchutan's Wrath and Ensnaring Mark each
// open a 2-3s window for Dark Crush; Spinning Strike also stacks +15% Critical Damage (twice, 30s). Power of the Storm
// is the burst: +20% Combat Speed and 20% shorter cooldowns.
(function () {
  'use strict';
  const A2 = window.A2;
  const C = 'chanter';
  const on = A2.specOn;
  const darkWhen = (sim) => sim.procOn('darkCrush') || 'Follows Impactful Crush, Spinning Strike, Marchutan\'s Wrath or Ensnaring Mark';

  A2.defineClass(C, {
    name: 'Chanter', order: 8, role: 'Support / melee · staff', icon: 'staff', hue: 95,
    blurb: 'Dark Crush follow-ups, Spinning Strike stacks, mantras and Power of the Storm.',
    botBehind: false, botRange: 2.5,
    bar: ['onslaught', 'incandescentBlow', 'rushingSmash', 'impactfulCrush', 'darkCrush', 'gustRampage', 'heatWaveBlow', 'tremorCrush', 'waveBlow', 'spinningStrike'],
    defaultStigmas: ['powerOfTheStorm', 'undefeatedMantra', 'marchutansWrath', 'fracturingBlow'],
    defaultSpecs: {onslaught: [1, 2], darkCrush: [1, 3], spinningStrike: [0, 1], impactfulCrush: [3], incandescentBlow: [0, 1]},
    over: {
      onslaught: {anim: 0.6},
      incandescentBlow: {anim: 0.75},
      rushingSmash: {anim: 0.8, move: 'to', range: 20, specs: {0: {text: 'Becomes a charge skill, up to +200% damage (not modelled)'}}},
      impactfulCrush: {anim: 0.8, range: 20, lights: {darkCrush: 2}, inflicts: {stun: 3}},
      darkCrush: {anim: 0.7, range: 20, when: darkWhen, procId: 'darkCrush', procWindow: 2,
                  specs: {0: {mod: {dmgPct: 15}, text: 'Extra damage against a target with an Impact-type status (amount not published; the sim uses +15%)'}, 1: {mod: {crit: true}}, 3: {mod: {cdPct: -100}}}},
      gustRampage: {anim: 0.65, needs: 'stagger'},
      heatWaveBlow: {anim: 0.85},
      tremorCrush: {anim: 0.8, move: 'to', range: 10, inflicts: {stun: 3}},
      waveBlow: {anim: 0.9, needs: 'stun', immuneProc: 0.07, inflicts: {knockdown: 3}},
      spinningStrike: {anim: 1.1, range: 20, lights: {darkCrush: 2}, buff: {name: 'Spinning Strike', dur: 30, stat: {critDmg: 15}}},
      marchutansWrath: {anim: 0.9, range: 20, lights: {darkCrush: 3}},
      ensnaringMark: {anim: 0.9, range: 20, lights: {darkCrush: 3}},
      fracturingBlow: {
        anim: 0.9, move: 'to', range: 20,
        power(sim, s, base, atk) {
          const impact = sim.hasStatus('stun') || sim.hasStatus('knockdown') || sim.hasStatus('airborne');
          const k = impact ? 1.2 + (on(s, 3) ? 0.3 : 0) : 1;
          return [base * k, atk * k];
        },
        onHit(sim) { sim.debuff('fracDef', 5, {name: 'Fracturing Blow: Defense -30%', short: 'Def -30%', icon: 'hammer', hue: 95, def: 30}); },
        specs: {3: {hook: true}},
      },
      obliterate: {anim: 1.0, inflicts: {knockdown: 3}},
      assaultShock: {anim: 0.9, range: 20},
      powerOfTheStorm: {anim: 0.3, keep: true, noHit: true, buff: {name: 'Power of the Storm', dur: 10, stat: {combatSpeed: 20, cdr: 20}},
                        onUse(sim, s) { const b = sim.buffOn('powerOfTheStorm'); if (b && on(s, 2)) b.stat.critHit = 200; if (b && on(s, 3)) b.atkPct = 20; },
                        specs: {0: {mod: {cd: -30}}, 2: {hook: true}, 3: {hook: true}}},
      undefeatedMantra: {anim: 0.3, keep: true, noHit: true, buff: {name: 'Undefeated Mantra', dur: 9999, stat: {pveBoost: 10.5}},
                         onUse(sim, s) {
                           const b = sim.buffOn('undefeatedMantra');
                           if (!b) return;
                           if (on(s, 0)) b.stat.critHit = 100;
                           if (on(s, 2)) b.stat.critDmg = 5;
                           if (on(s, 3)) b.stat.double = 5;
                         },
                         specs: {0: {hook: true}, 2: {hook: true}, 3: {hook: true}}},
    },

    passives(sim, st) {
      const lv = sim.lvP;
      sim.pas = {raging: A2.pv(C, 'ragingSpell', 0, lv), wind: A2.pv(C, 'windsPromise', 2, lv), earth: A2.pv(C, 'earthsPromise', 0, lv)};
      st.critHit = (st.critHit || 0) + A2.pv(C, 'inspiringSpell', 0, lv);
      st.pveBoost = (st.pveBoost || 0) + A2.pv(C, 'attackPreparation', 0, lv);
      st.double = (st.double || 0) + A2.pv(C, 'impactHit', 1, lv);
      st.critDmg = (st.critDmg || 0) + A2.pv(C, 'windsPromise', 0, lv);
    },

    onHit(sim, ev, o) {
      if (o.proc || o.dot) return;
      const impact = sim.hasStatus('stagger') || sim.hasStatus('stun') || sim.hasStatus('knockdown');
      if (impact && sim.icdReady('raging', 1)) A2.procHit(sim, 'raging', 'Raging Spell', sim.pas.raging, 34, 95);
      if (ev.crit && sim.rand() < 0.5 && sim.icdReady('wind', 1)) A2.procHit(sim, 'wind', 'Wind\'s Promise', sim.pas.wind, 82.6, 140);
      if (sim.icdReady('earthP', 10)) sim.debuff('earthP', 5, {name: 'Earth\'s Promise: damage tolerance down', short: 'Tolerance', icon: 'rock', hue: 95, vuln: sim.pas.earth});
    },

    rotation(sim) {
      const out = [];
      if (sim.total > 0) out.push('undefeatedMantra', 'powerOfTheStorm');
      if (!sim.buffOn('undefeatedMantra') && sim.has('undefeatedMantra')) out.push('undefeatedMantra');
      out.push('darkCrush', 'waveBlow', 'spinningStrike', 'marchutansWrath', 'ensnaringMark', 'impactfulCrush', 'fracturingBlow', 'obliterate',
               'gustRampage', 'heatWaveBlow', 'rushingSmash', 'tremorCrush', 'assaultShock');
      if (sim.p.mp > 300) out.push('incandescentBlow');
      out.push('onslaught');
      return out;
    },
  });
})();
