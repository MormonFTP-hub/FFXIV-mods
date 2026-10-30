// Cleric: the healer, played here for damage. Chain of Torment binds the target (and lowers its damage tolerance),
// which opens Condemnation; Debilitating Mark, Earth Punishment and Voice of Doom tick every second; Bolt is the
// charged nuke and Noble Aura fights beside you. Heals, shields and cleanses are left off the bars.
(function () {
  'use strict';
  const A2 = window.A2;
  const C = 'cleric';
  const on = A2.specOn;

  A2.defineClass(C, {
    name: 'Cleric', order: 7, role: 'Healer · mace', icon: 'mace', hue: 52,
    blurb: 'Chain of Torment into Condemnation, big damage-over-time stigmas, charged Bolt.',
    botBehind: false, botRange: 18, botStand: 9,
    bar: ['earthsRetribution', 'judgmentThunder', 'debilitatingMark', 'chainOfTorment', 'condemnation', 'divineAura', 'lightningStrikeScattershot', 'bolt'],
    defaultStigmas: ['voiceOfDoom', 'earthPunishment', 'prayerOfAmplification', 'nobleAura'],
    defaultSpecs: {earthsRetribution: [2], condemnation: [0, 2, 3], bolt: [2, 4], divineAura: [2, 3, 4]},
    over: {
      earthsRetribution: {anim: 0.6, range: 20, specs: {1: {text: '+20% Discharge chain skill chance (Discharge\'s numbers aren\'t published)'}}},
      judgmentThunder: {anim: 0.7, range: 20},
      debilitatingMark: {anim: 0.7, range: 20, dot: {name: 'Debilitating Mark', every: 1, dur: 10, base: 74, atk: 141.9, scale: true},
                         specs: {0: {mod: {mpPct: -100, mpOnHit: 150}}, 1: {hook: true}},
                         onHit(sim, ev) { if (on(ev.s, 1)) sim.debuff('markDef', 10, {name: 'Debilitating Mark: Defense -15%', short: 'Def -15%', icon: 'target', hue: 52, def: 15}); }},
      chainOfTorment: {anim: 0.8, range: 20, dot: {name: 'Chain of Torment', every: 1, dur: 10, base: 173, atk: 189.8, scale: true},
                       specs: {0: {mod: {dotDur: 3}}},
                       onHit(sim, ev) {
                         const dur = 10 + (on(ev.s, 0) ? 3 : 0);
                         sim.debuff('chain', dur, {name: 'Chain of Torment: damage tolerance -5%', short: 'Tolerance -5%', icon: 'chain', hue: 52, vuln: 5});
                       }},
      condemnation: {anim: 0.7, range: 20, needs: 'chain', onUse(sim, s) { s.mods.crit = !!sim.debuffOn('epCrit'); }},
      divineAura: {anim: 0.6, range: 20, noHit: true, keep: true, orb: {name: 'Divine Aura', every: 1.25, chance: 1, dur: 5, base: 394, atk: 431.1},
                   desc: 'An aura beside you that hits the target every so often for 5s (the interval isn\'t published; the sim uses 1.25s).',
                   specs: {2: {mod: {orbSpeed: 1.5}}, 3: {mod: {orbDur: 3}}}},
      lightningStrikeScattershot: {anim: 0.55, range: 20, needs: 'stagger'},
      bolt: {anim: 0.6, range: 20, chargeTime: 1.6},
      earthPunishment: {anim: 0.8, range: 20, dot: {name: 'Earth Punishment', every: 1, dur: 10, base: 1186, atk: 221, scale: true},
                        onHit(sim, ev) { if (on(ev.s, 0)) sim.debuff('epCrit', 10 + (on(ev.s, 3) ? 10 : 0), {name: 'Earth Punishment: Condemnation always crits', short: 'Sure crit', icon: 'rock', hue: 52}); },
                        specs: {0: {hook: true}, 3: {mod: {dotDur: 10}}}},
      voiceOfDoom: {anim: 0.8, range: 20, dot: {name: 'Voice of Doom', every: 1, dur: 20, base: 2862, atk: 533, scale: true}, specs: {1: {mod: {dotEvery: 0.5}}}},
      powerBurst: {anim: 0.9, range: 20},
      prayerOfAmplification: {anim: 0.3, keep: true, noHit: true, buff: {name: 'Prayer of Amplification', dur: 10, stat: {atkPct: 20}},
                              onUse(sim, s) { const b = sim.buffOn('prayerOfAmplification'); if (b && on(s, 2)) b.atkPct += 15; }, specs: {2: {hook: true}}},
      nobleAura: {anim: 0.4, range: 20, noHit: true, keep: true, orb: {name: 'Noble Aura', every: 2, chance: 1, dur: 300, base: 472, atk: 88},
                  specs: {2: {mod: {immuneDmg: 30}}, 3: {mod: {orbSpeed: 2}}}},
      lightOfProtection: {anim: 0.3, keep: true, noHit: true, buff: {name: 'Light of Protection', dur: 9999, stat: {pveBoost: 10.5}}},
      root: {anim: 0.8, range: 20, inflicts: {root: 10}},
      assaultMark: {anim: 0.9, range: 20},
    },

    passives(sim, st) {
      const lv = sim.lvP;
      sim.pas = {grace: A2.pv(C, 'empyreanLordsGrace', 2, lv)};
      st.critHit = (st.critHit || 0) + A2.pv(C, 'empyreanLordsGrace', 0, lv);
      st.double = (st.double || 0) + A2.pv(C, 'empyreanLordsGrace', 1, lv);
      st.critDmg = (st.critDmg || 0) + A2.pv(C, 'earthsGrace', 0, lv);
    },
    onHit(sim, ev, o) {
      if (o.proc || o.dot) return;
      if (sim.icdReady('grace', 1)) A2.procHit(sim, 'grace', 'Empyrean Lord\'s Grace', sim.pas.grace, 42, 52);
    },

    rotation(sim) {
      const out = [];
      if (sim.total > 0) out.push('lightOfProtection', 'prayerOfAmplification', 'nobleAura');
      out.push('voiceOfDoom', 'earthPunishment');
      if (!sim.debuffOn('chain') || sim.debuffOn('chain').until - sim.t < 1.5) out.push('chainOfTorment');
      out.push('condemnation', 'bolt', 'divineAura', 'powerBurst', 'lightningStrikeScattershot');
      if (!sim.debuffOn('dot:debilitatingMark')) out.push('debilitatingMark');
      out.push('chainOfTorment', 'root', 'assaultMark');
      if (sim.p.mp > 350) out.push('judgmentThunder');
      out.push('earthsRetribution');
      return out;
    },
  });

})();
