// Sorcerer: fire and water from 20m. Every fire hit marks the target (Fire Mark), which opens Blaze and its own extra
// hit; Frost opens Frost Burst (a boss only lights it on 7%); Hellfire is the charged nuke; Delayed Explosion makes
// the target take 15% more of your damage while it ticks down. Grace of Enhancement and Robe of Earth reward high MP.
(function () {
  'use strict';
  const A2 = window.A2;
  const C = 'sorcerer';
  const on = A2.specOn;
  const FIRE = ['flameArrow', 'firestorm', 'blaze', 'flameScattershot', 'hellfire', 'divineBurst', 'fireWall', 'delayedExplosion', 'dot:fireWall'];

  A2.defineClass(C, {
    name: 'Sorcerer', order: 5, role: 'Ranged DPS · spellbook', icon: 'flame', hue: 12,
    blurb: 'Fire Mark into Blaze, charged Hellfire, Delayed Explosion, MP thresholds.',
    botBehind: false, botRange: 18, botStand: 9,
    bar: ['flameArrow', 'iceChain', 'firestorm', 'bittercoldWind', 'blaze', 'flameScattershot', 'frost', 'wintersShackles', 'frostBurst', 'hellfire', 'wishOfConcentration'],
    defaultStigmas: ['elementEnhancement', 'delayedExplosion', 'fireWall', 'coldStorm'],
    defaultSpecs: {flameArrow: [1], firestorm: [0, 3], blaze: [0, 2], hellfire: [0, 3], wishOfConcentration: [1, 3, 4]},
    over: {
      flameArrow: {anim: 0.6, range: 20},
      iceChain: {anim: 0.7, range: 20, inflicts: {slow: 5}},
      firestorm: {anim: 0.9, range: 20, specs: {3: {mod: {dmgPct: 45}, text: '+15% damage per fireball, up to +75% (the sim counts three fireballs: +45%)'}}},
      bittercoldWind: {anim: 0.8, range: 20, inflicts: {root: 3}},
      blaze: {anim: 0.7, range: 20, needs: 'fireMark', specs: {0: {mod: {mpGainPct: 50}}}},
      flameScattershot: {hits: 4, anim: 0.55, range: 20, needs: 'stagger'},
      frost: {anim: 0.8, range: 20, inflicts: {frost: 3}, specs: {1: {mod: {cd: -5}}, 2: {hook: true}}, onHit(sim, ev) { if (on(ev.s, 2) && sim.hasStatus('frost')) sim.p.cds.frostBurst = sim.t; }},
      wintersShackles: {anim: 0.8, range: 20, inflicts: {slow: 3}},
      frostBurst: {anim: 0.8, range: 20, needs: 'frost', immuneProc: 0.07},
      hellfire: {anim: 0.6, range: 20, chargeTime: 1.6, specs: {1: {text: 'Fire damage over time for 10s (amount not published)'}}},
      wishOfConcentration: {
        anim: 0.3,
        onUse(sim, s) {
          const b = sim.buffOn('wishOfConcentration');
          if (!b) return;
          if (on(s, 1)) b.atkPct += 10;
          if (on(s, 3)) b.stat.combatSpeed = 10;
          if (on(s, 4)) for (const id in sim.p.cds) if (id !== s.id) sim.p.cds[id] -= 10;
        },
        specs: {1: {hook: true}, 3: {hook: true}, 4: {hook: true}},
      },
      elementEnhancement: {
        anim: 0.3, keep: true, noHit: true, buff: {name: 'Element Enhancement', dur: {1: 10, 40: 30}, stat: {atkPct: 20}},
        desc: '+20% Fire Attack and +20% Water Attack for 10s (the sim counts it as +20% Attack, since every Sorcerer hit is fire or water).',
        onUse(sim, s) { const b = sim.buffOn('elementEnhancement'); if (b && on(s, 3)) b.atkPct += 10; if (b && on(s, 4)) b.stat.double = 7; },
        specs: {3: {hook: true}, 4: {hook: true}},
      },
      delayedExplosion: {
        anim: 0.6, range: 20, contact: 4.0,
        onUse(sim, s) { sim.debuff('delayed', 4, {name: 'Delayed Explosion: +15% damage taken', short: '+15% taken', icon: 'burst', hue: 12, vuln: 15 + (on(s, 3) ? 10 : 0)}); },
        specs: {0: {mod: {mpOnHit: 200}}, 1: {mod: {cd: -10}}, 3: {hook: true}},
      },
      fireWall: {anim: 0.8, range: 20, specs: {3: {mod: {dotDur: 10}}, 4: {mod: {dotPct: 10}}}},
      coldStorm: {anim: 0.8, range: 20, inflicts: {slow: 5}, specs: {2: {mod: {dotDur: 10}}}},
      glacialSmite: {anim: 0.9, range: 20},
      divineBurst: {anim: 0.9, range: 20},
      assaultBombardment: {anim: 0.9, range: 20},
      lumielsSpace: {anim: 0.9, range: 20, inflicts: {airborne: 3}},
      soulFreeze: {anim: 0.8, range: 20},
    },

    passives(sim, st) {
      const lv = sim.lvP;
      sim.pas = {
        mark: A2.pv(C, 'fireMark', 2, lv), earthCrit: A2.pv(C, 'robeOfEarth', 2, lv), snap: A2.pv(C, 'coldSnap', 1, lv),
        grace: A2.pv(C, 'graceOfEnhancement', 4, lv), vit: A2.pv(C, 'vitalityEvaporation', 0, lv), vitHp: A2.pv(C, 'vitalityEvaporation', 2, lv),
      };
      st.pveBoost = (st.pveBoost || 0) + A2.pv(C, 'robeOfFlame', 1, lv);
      st.double = (st.double || 0) + A2.pv(C, 'robeOfFlame', 3, lv);
    },
    statHook(sim, k, v) {
      const mp = sim.p.mp / sim.stats.mpMax;
      if (k === 'critHit' && mp >= 0.5) return v + sim.pas.earthCrit;
      if (k === 'pveBoost' && mp >= 0.25) return v + 20;   // Grace of Enhancement
      return v;
    },

    onHit(sim, ev, o) {
      const s = ev.s;
      if (FIRE.indexOf(s.id) >= 0 || FIRE.indexOf(o.as) >= 0) {
        if (sim.debuffOn('fireMark') && sim.rand() < 0.2 && sim.icdReady('mark', 1)) A2.procHit(sim, 'markHit', 'Fire Mark', sim.pas.mark, 55, 12);
        sim.debuff('fireMark', 5, {name: 'Fire Mark', short: 'Fire Mark', icon: 'flame', hue: 12});
      }
      if (o.proc || o.dot) return;
      if (sim.hasStatus('slow') && sim.rand() < 0.5 && sim.icdReady('snap', 1)) A2.procHit(sim, 'snap', 'Cold Snap', sim.pas.snap, 23, 200);
      if (sim.rand() < 0.5 && sim.icdReady('grace', 1)) A2.procHit(sim, 'grace', 'Grace of Enhancement', sim.pas.grace, 18, 30);
      if (sim.tg.hp * 100 > sim.pas.vitHp && sim.icdReady('vit', 1)) A2.procHit(sim, 'vit', 'Vitality Evaporation', sim.pas.vit, 39, 0);
    },

    rotation(sim) {
      const out = [];
      if (sim.total > 0) out.push('wishOfConcentration', 'elementEnhancement');
      out.push('delayedExplosion', 'hellfire', 'fireWall', 'coldStorm', 'frostBurst', 'blaze', 'flameScattershot', 'divineBurst', 'glacialSmite',
               'frost', 'bittercoldWind', 'wintersShackles', 'lumielsSpace', 'soulFreeze', 'assaultBombardment');
      if (sim.p.mp > sim.stats.mpMax * 0.55) out.push('firestorm');
      if (!sim.hasStatus('slow') && sim.p.mp > sim.stats.mpMax * 0.5) out.push('iceChain');
      out.push('flameArrow');
      return out;
    },
  });
})();
