// Gladiator: a greatsword bruiser. Ruinous Blow's Prepare for Battle (+20% PvE damage, +100 Critical Hit for 20s)
// is the burst window; Mocking Blade knocks a field monster down for Overhead Slam and Aerial Snare, which a boss
// only lights on a small chance. Murderous Burst goes off every fifth hit.
(function () {
  'use strict';
  const A2 = window.A2;
  const C = 'gladiator';
  const on = A2.specOn;

  A2.defineClass(C, {
    name: 'Gladiator', order: 2, role: 'Melee DPS / off-tank · greatsword', icon: 'sword', hue: 18,
    blurb: 'Ruinous Blow burst windows, knockdown follow-ups, Murderous Burst.',
    botBehind: false, botRange: 2.5,
    bar: ['keenStrike', 'rendingBlow', 'leapingSlam', 'mockingBlade', 'overheadSlam', 'swordAuraRampage', 'ankleSlice', 'crushingWave', 'rushStrike', 'aerialSnare', 'ruinousBlow'],
    defaultStigmas: ['lungeStance', 'zikelsBlessing', 'rageBurst', 'lifestealingBlade'],
    defaultSpecs: {keenStrike: [2, 3], ruinousBlow: [0, 2, 4], overheadSlam: [3, 4], mockingBlade: [2, 4], rendingBlow: [0, 3, 4]},
    over: {
      keenStrike: {anim: 0.6},
      rendingBlow: {anim: 0.7},
      leapingSlam: {move: 'to', anim: 0.85},
      mockingBlade: {anim: 1.0, inflicts: {knockdown: 3}},
      overheadSlam: {anim: 0.7, needs: 'knockdown', immuneProc: 0.07},
      swordAuraRampage: {hits: 4, anim: 0.65, needs: 'stagger'},
      ankleSlice: {anim: 0.8},
      crushingWave: {anim: 0.9},
      rushStrike: {move: 'to', anim: 0.8, inflicts: {knockdown: 3}},
      aerialSnare: {anim: 0.9, needs: 'knockdown', immuneProc: 0.05, inflicts: {airborne: 3}},
      ruinousBlow: {move: 'to', anim: 1.2, specs: {3: {text: 'Extra damage on hit (amount not published)'}}},
      bladeToss: {anim: 0.6, onHit(sim) { sim.debuff('bladeToss', 10, {name: 'Blade Toss: Defense -30%', short: 'Def -30%', icon: 'sword', hue: 18, def: 30}); }},
      wrathWave: {anim: 1.0, inflicts: {knockdown: 3}},
      assaultStrike: {anim: 0.9, inflicts: {knockdown: 3}},
      fracturingRush: {anim: 0.9, move: 'to'},
      lifestealingBlade: {anim: 1.0, specs: {4: {mod: null}}},
      rageBurst: {
        anim: 0.9, buff: {name: 'Rage Burst', dur: 10, stat: {pveBoost: 10}},
        onHit(sim, ev) {
          if (sim.has('overheadSlam')) sim.proc('overheadSlam', 10);
          if (on(ev.s, 3)) { const b = sim.buffOn('rageBurst'); if (b) b.stat = {pveBoost: 20}; }
        },
        specs: {3: {hook: true}},
      },
      lungeStance: {anim: 0.3, onUse(sim, s) { const b = sim.buffOn('lungeStance'); if (b && on(s, 0)) b.stat.double = 5; }, specs: {0: {hook: true}}},
      zikelsBlessing: {
        anim: 0.3,
        onUse(sim, s) {
          const b = sim.buffOn('zikelsBlessing');
          if (!b) return;
          if (on(s, 1)) b.stat.pveBoost = 10;
          if (on(s, 2)) b.stat.multiHit = 50;
          if (on(s, 4)) b.until += 5;
        },
        specs: {1: {hook: true}, 2: {mod: null, hook: true}, 4: {hook: true}},
      },
      waveArmor: {anim: 0.4, noHit: true, onUse(sim, s) { sim.applyDot(s); }},
    },

    passives(sim, st) {
      const lv = sim.lvP;
      sim.pas = {
        crit: A2.pv(C, 'identifyWeakness', 0, lv), pve: A2.pv(C, 'attackPreparation', 0, lv),
        multi: A2.pv(C, 'impactHit', 1, lv), front: A2.pv(C, 'experiencedCounterstrike', 0, lv),
        impulse: [A2.pv(C, 'destructiveImpulse', 0, lv), 33], burst: [A2.pv(C, 'murderousBurst', 2, lv), 78], burstCd: A2.pv(C, 'murderousBurst', 6, lv),
      };
      st.critHit = (st.critHit || 0) + sim.pas.crit;
      st.pveBoost = (st.pveBoost || 0) + sim.pas.pve;
      st.double = (st.double || 0) + sim.pas.multi;
      st.frontBoost = (st.frontBoost || 0) + sim.pas.front;
    },

    onHit(sim, ev, o) {
      if (o.proc || o.dot) return;
      const lv = sim.lvP;
      if (lv >= 17 && (sim.hasStatus('stagger') || sim.hasStatus('knockdown') || sim.hasStatus('airborne')) && sim.icdReady('impulse', 1)) {
        A2.procHit(sim, 'impulse', 'Destructive Impulse', sim.pas.impulse[0], sim.pas.impulse[1], 18);
      }
      if (lv >= 25) {
        const m = sim.buff('menace', 3, {name: 'Menace', short: 'Menace', icon: 'up', hue: 18});
        m.stacks = (m.stacks || 0) + 1;
        if (m.stacks >= 5) {
          delete sim.p.buffs.menace;
          A2.procHit(sim, 'murderousBurst', 'Murderous Burst', sim.pas.burst[0], sim.pas.burst[1], 0);
          sim.buff('burstCrit', 3, {name: 'Murderous Burst: Critical Damage', short: 'Crit dmg', icon: 'up', hue: 0, stat: {critDmg: sim.pas.burstCd}});
        }
      }
    },

    rotation(sim) {
      const out = [];
      if (sim.total > 0) out.push('zikelsBlessing', 'lungeStance');
      out.push('ruinousBlow', 'rageBurst', 'overheadSlam', 'aerialSnare', 'swordAuraRampage', 'mockingBlade', 'lifestealingBlade',
               'wrathWave', 'crushingWave', 'ankleSlice', 'leapingSlam', 'rushStrike', 'fracturingRush', 'assaultStrike', 'bladeToss', 'forcedRestraint', 'waveArmor');
      if (sim.p.mp > 350) out.push('rendingBlow');
      out.push('keenStrike');
      return out;
    },
  });
})();
