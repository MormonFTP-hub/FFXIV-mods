// Templar: the tank. Shield Smite, Warding Strike, Shield Rush and Doom Shield each open a short window for Judgment;
// a charged Punishment grants Executor (+20% PvE damage for 20s). Annihilate needs a stunned or knocked-down target,
// so on a boss it only lights on its 5% chance.
(function () {
  'use strict';
  const A2 = window.A2;
  const C = 'templar';
  const on = A2.specOn;
  const judgmentWhen = (sim) => sim.procOn('judgment') || 'Follows Shield Smite, Warding Strike, Shield Rush or Doom Shield';

  A2.defineClass(C, {
    name: 'Templar', order: 3, role: 'Tank · longsword and shield', icon: 'shield', hue: 45,
    blurb: 'Judgment follow-ups, charged Punishment into Executor.',
    botBehind: false, botRange: 2.5,
    bar: ['viciousStrike', 'pummel', 'poach', 'shieldSmite', 'judgment', 'flashRampage', 'debilitatingSmash', 'wardingStrike', 'shieldRush', 'annihilate', 'punishment'],
    defaultStigmas: ['empyreanLordsPunishment', 'doomShield', 'executingBlade', 'battlefieldBanner'],
    defaultSpecs: {viciousStrike: [2, 3], judgment: [2, 3, 4], shieldSmite: [1, 3], punishment: [2, 4], annihilate: [0, 2, 3]},
    over: {
      viciousStrike: {anim: 0.6},
      pummel: {anim: 0.7},
      poach: {anim: 0.7, range: 20},
      shieldSmite: {anim: 0.8, lights: {judgment: 2}, inflicts: {stun: 3}},
      judgment: {anim: 0.7, when: judgmentWhen, procId: 'judgment', procWindow: 2, specs: {1: {mod: {dmgPct: 15}, text: 'Extra damage against a target with an Impact-type status (amount not published; the sim uses +15%)'}, 2: {text: 'Extra damage on hit (amount not published)'}}},
      flashRampage: {anim: 0.65, needs: 'stagger'},
      debilitatingSmash: {anim: 0.85},
      wardingStrike: {anim: 0.9, lights: {judgment: 2}},
      shieldRush: {anim: 0.8, move: 'to', lights: {judgment: 2}, inflicts: {stun: 3}},
      annihilate: {anim: 1.0, needs: ['stun', 'knockdown'], immuneProc: 0.05, inflicts: {knockdown: 3}},
      punishment: {anim: 0.6, chargeTime: 1.4},
      doomShield: {anim: 0.8, move: 'to', lights: {judgment: 3}, inflicts: {knockdown: 3},
                   onHit(sim, ev) { if (on(ev.s, 0)) sim.p.cds.annihilate = sim.t; }, specs: {0: {hook: true}}},
      executingBlade: {
        anim: 0.9,
        power(sim, s, base, atk) {
          const impact = sim.hasStatus('stun') || sim.hasStatus('knockdown') || sim.hasStatus('airborne');
          const k = impact ? 1.2 + (on(s, 3) ? 0.3 : 0) : 1;
          return [base * k, atk * k];
        },
        onHit(sim) { sim.debuff('execDef', 5, {name: 'Executing Blade: Defense -30%', short: 'Def -30%', icon: 'sword', hue: 45, def: 30}); },
        specs: {3: {hook: true}},
      },
      battlefieldBanner: {
        anim: 0.3, keep: true, noHit: true, buff: {name: 'Battlefield Banner', dur: {1: 10, 25: 22.5}, stat: {atkPct: 10}},
        desc: 'Raises Attack in proportion to your Defense for 10s (22.5s at Lv 25). The tooltip gives no number; the sim uses +10% Attack.',
        onUse(sim, s) { const b = sim.buffOn('battlefieldBanner'); if (b) { if (on(s, 0)) b.stat.multiHit = 10; if (on(s, 4)) b.stat.combatSpeed = 15; if (on(s, 2)) b.atkPct += 2; } },
        specs: {0: {hook: true}, 2: {hook: true}, 4: {hook: true}},
      },
    },

    passives(sim, st) {
      const lv = sim.cfg.lvActive;
      sim.pas = {crit: A2.pv(C, 'punishingBenediction', 0, lv), pb: A2.pv(C, 'punishingBenediction', 3, lv),
                 roar: A2.pv(C, 'insultingRoar', 1, lv), front: A2.pv(C, 'fury', 0, lv), multi: A2.pv(C, 'impactHit', 1, lv)};
      st.critHit = (st.critHit || 0) + sim.pas.crit;
      st.frontBoost = (st.frontBoost || 0) + sim.pas.front;
      st.multiHit = (st.multiHit || 0) + sim.pas.multi;
    },

    onHit(sim, ev, o) {
      if (o.proc || o.dot) return;
      if (sim.buffOn('pbOn') && sim.rand() < 0.5 && sim.icdReady('pb', 1)) A2.procHit(sim, 'pb', 'Punishing Benediction', sim.pas.pb, 38, 45);
      sim.buff('pbOn', 10, {name: 'Punishing Benediction', short: 'Benediction', icon: 'up', hue: 45});
      if (!ev.back && sim.icdReady('roar', 5)) sim.buff('roar', 5, {name: 'Insulting Roar: Attack', short: 'Atk', icon: 'roar', hue: 45, atkPct: sim.pas.roar});
    },

    rotation(sim) {
      const out = [];
      if (sim.total > 0) out.push('battlefieldBanner');
      out.push('judgment', 'annihilate', 'punishment', 'empyreanLordsPunishment', 'doomShield', 'executingBlade', 'shieldSmite', 'wardingStrike',
               'flashRampage', 'debilitatingSmash', 'shieldRush', 'taunt', 'grapple', 'assaultFury', 'poach');
      if (sim.p.mp > 350) out.push('pummel');
      out.push('viciousStrike');
      return out;
    },
  });
})();
