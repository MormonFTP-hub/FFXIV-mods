// Spiritmaster: one spirit at a time. A summon's own skill fires as it arrives; after that the spirit swings on its
// own and uses its skill on 10-15% of its hits (3s apart). Every spirit skill gives you an element and briefly opens
// Dimensional Control; four elements open Elemental Fusion. Jointstrikes bring the current spirit in for an extra hit.
//
// Not published, so estimated here: a spirit's basic attack (the sim uses 20% of your Attack every 1.5s) and the
// Jointstrike spirit hits for Curse and Corrode (they borrow Destructive Attack's ratio per element).
(function () {
  'use strict';
  const A2 = window.A2;
  const C = 'spiritmaster';
  const on = A2.specOn;
  const SPIRITS = {
    summonFireSpirit: {type: 'Fire', chance: 0.15, hue: 10, js: 664 / 573},
    summonWaterSpirit: {type: 'Water', chance: 0.15, hue: 205, js: 797 / 573},
    summonEarthSpirit: {type: 'Earth', chance: 0.10, hue: 35, js: 731 / 573},
    summonWindSpirit: {type: 'Wind', chance: 0.10, hue: 150, js: 598 / 573},
    summonAncientSpirit: {type: 'Ancient', chance: 0, every: 7, hue: 280, js: 1063 / 573, dur: 30},
  };
  const SWING = 1.5;

  function spiritSkill(sim, id) {
    const s = sim.skills[id];
    if (!s) return;
    sim.hit(s, {proc: true, as: 'spirit:' + id, asName: SPIRITS[id].type + ' Spirit skill', pct: sim.debuffOn('dot:jointstrikeCorrode') ? 10 : 0});
    const sp = sim.spirit;
    if (sp) sp.skillReady = sim.t + 3;
    if (sim.has('dimensionalControl')) sim.proc('dimensionalControl', 4);
    // an element, or Four Elements outright from the Ancient Spirit
    if (!sim.buffOn('fourElements')) {
      const el = sim.buffOn('elements') || sim.buff('elements', 9999, {name: 'Elements', short: 'Elements', icon: 'orb', hue: 190, stacks: 0});
      el.stacks = id === 'summonAncientSpirit' ? 4 : el.stacks + 1;
      if (el.stacks >= 4) {
        delete sim.p.buffs.elements;
        sim.buff('fourElements', 9999, {name: 'Four Elements', short: 'Four Elements', icon: 'orb', hue: 190});
        if (sim.has('elementalFusion')) sim.proc('elementalFusion', 9999);
      }
    }
    const eu = sim.buff('elementUnification', 10, {name: 'Element Unification', short: 'Crit dmg', icon: 'up', hue: 190});
    eu.stacks = Math.min(5, (eu.stacks || 0) + 1);
    eu.stat = {critDmg: sim.pas.unify * eu.stacks};
  }

  function summon(sim, s) {
    const info = SPIRITS[s.id];
    sim.spirit = {id: s.id, next: sim.t + SWING, swings: 0, skillReady: sim.t, until: info.dur ? sim.t + A2.lv({1: 30, 25: 30}, s.level) : Infinity};
    sim.buff('descent', s.id === 'summonAncientSpirit' ? 30 : 10, {name: 'Spirit\'s Descent', short: 'Descent', icon: 'spirit', hue: 190});
    spiritSkill(sim, s.id);
    sim.emit('text', info.type + ' Spirit', `hsl(${info.hue} 80% 75%)`);
  }

  function joint(sim, s) {
    const sp = sim.spirit;
    if (!sp) return;
    const info = SPIRITS[sp.id];
    const [base, atk] = sim.power(s);
    sim.hit(s, {base: base * info.js, atk: atk * info.js, proc: true, as: 'joint:' + sp.id, asName: info.type + ' Spirit (Jointstrike)'});
  }

  const over = {
    coldShock: {anim: 0.6, range: 20},
    combustion: {anim: 0.7, range: 20},
    jointstrikeCurse: {anim: 0.7, range: 20, dot: {name: 'Curse', every: 1, dur: 5, base: 148, atk: 150, scale: true},
                       onHit(sim, ev, o) { if (!o.hitIndex && !o.proc) joint(sim, ev.s); }, specs: {0: {mod: {dotDur: 2}}}},
    rapidScattershot: {anim: 0.55, range: 20, needs: 'stagger'},
    dimensionalControl: {anim: 0.6, range: 20, procWindow: 4, when: (sim) => sim.procOn('dimensionalControl') || 'Opens for a moment each time a spirit uses its skill', inflicts: {slow: 3}},
    soulsCry: {anim: 0.8, range: 20},
    elementalFusion: {
      anim: 0.9, range: 20, procWindow: 9999,
      when: (sim) => !!sim.buffOn('fourElements') || 'Needs Four Elements: four spirit skills',
      onUse(sim) { delete sim.p.buffs.fourElements; },
    },
    cursedCloud: {anim: 0.8, range: 20, dot: {name: 'Cursed Cloud', every: 1, dur: 10, base: 1203, atk: 210, scale: true}, specs: {1: {mod: {dotDur: 10}}}},
    jointstrikeCorrode: {anim: 0.8, range: 20, dot: {name: 'Corrode', every: 1, dur: 20, base: 859, atk: 150, scale: true},
                         onHit(sim, ev, o) { if (!o.hitIndex && !o.proc) joint(sim, ev.s); }, specs: {2: {mod: {dotDur: 10}}}},
    jointstrikeDestructiveAttack: {anim: 0.9, range: 20, onHit(sim, ev, o) {
      if (o.hitIndex || o.proc) return;
      joint(sim, ev.s);
      if (on(ev.s, 3)) { sim.p.cds.jointstrikeCurse = sim.t; sim.p.cds.jointstrikeCorrode = sim.t; }
    }, specs: {3: {hook: true}}},
    magicBlock: {anim: 0.8, range: 20},
    seizeMagic: {anim: 0.8, range: 20},
    siphon: {anim: 0.8, range: 20},
    assaultTerror: {anim: 0.9, range: 20},
    cryOfTerror: {anim: 0.9, range: 20},
    enhanceSpiritsBenediction: {anim: 0.3, keep: true, noHit: true, buff: {name: 'Spirit\'s Benediction', dur: 10, stat: {pveBoost: 20}}},
    flameBlessing: {
      anim: 0.3, keep: true, noHit: true, range: 40,
      onUse(sim, s) { sim.buff('flameBlessing', 10, {name: 'Flame Blessing', short: 'Flame', icon: 'flame', hue: 15, base: A2.lv(s.dmg, s.level, s.kind), icd: on(s, 3) ? 0.5 : 1}); },
      specs: {1: {hook: true}, 2: {hook: true}, 3: {hook: true}},
    },
  };
  for (const id in SPIRITS) {
    over[id] = Object.assign(over[id] || {}, {anim: 0.6, range: 20, noHit: true, keep: true, onUse: summon,
      desc: (SPIRITS[id].type === 'Ancient' ? 'Summons the Ancient Spirit for 30s; it uses its skill every 7th swing and each use gives Four Elements. ' :
             `Summons the ${SPIRITS[id].type} Spirit (replacing the one you have). Its skill fires as it arrives, then on ${SPIRITS[id].chance * 100}% of its hits. `) +
            'Spirit swings are estimated at 20% of your Attack.'});
  }

  A2.defineClass(C, {
    name: 'Spiritmaster', order: 6, role: 'Ranged DPS · orb and spirits', icon: 'spirit', hue: 190,
    blurb: 'Swap spirits for elements, Four Elements into Fusion, Jointstrikes and curses.',
    botBehind: false, botRange: 18, botStand: 9,
    bar: ['coldShock', 'combustion', 'summonFireSpirit', 'summonWaterSpirit', 'summonWindSpirit', 'summonEarthSpirit', 'jointstrikeCurse', 'dimensionalControl', 'elementalFusion', 'rapidScattershot', 'soulsCry'],
    defaultStigmas: ['summonAncientSpirit', 'cursedCloud', 'jointstrikeCorrode', 'flameBlessing'],
    defaultSpecs: {coldShock: [1], jointstrikeCurse: [0, 1, 3], summonFireSpirit: [0], summonWaterSpirit: [0]},
    over,

    init(sim) { sim.spirit = null; },
    passives(sim, st) {
      const lv = sim.cfg.lvActive;
      sim.pas = {descent: A2.pv(C, 'spiritsDescent', 1, lv), corrode: A2.pv(C, 'corrode', 2, lv), counter: A2.pv(C, 'consecutiveCountercurrent', 1, lv),
                 unify: A2.pv(C, 'elementUnification', 0, lv)};
      st.pveBoost = (st.pveBoost || 0) + A2.pv(C, 'spiritStrike', 0, lv);
      st.critHit = (st.critHit || 0) + A2.pv(C, 'corrode', 0, lv);
      st.multiHit = (st.multiHit || 0) + A2.pv(C, 'mentalFocus', 1, lv);
    },

    onStep(sim) {
      const sp = sim.spirit;
      if (!sp) return;
      if (sim.t > sp.until) { sim.spirit = null; return; }
      if (sim.t < sp.next || sim.done) return;
      sp.next += SWING;
      sp.swings++;
      const info = SPIRITS[sp.id];
      sim.hit({id: 'spiritSwing', name: 'Spirit attacks', hue: info.hue, icon: 'spirit', mods: {}}, {base: 0, atk: 20, proc: true, as: 'spiritSwing', asName: 'Spirit attacks'});
      if (sp.id === 'summonWaterSpirit') sim.p.mp = Math.min(sim.stats.mpMax, sim.p.mp + 20);
      const due = info.every ? sp.swings % info.every === 0 : sim.rand() < info.chance;
      if (due && sim.t >= sp.skillReady) spiritSkill(sim, sp.id);
    },

    onHit(sim, ev, o) {
      if (o.dot) return;
      if (ev.s.id === 'spiritSwing' || (o.as && o.as.indexOf('spirit') === 0)) return;
      if (sim.buffOn('descent') && sim.rand() < 0.5 && sim.icdReady('descent', 1)) A2.procHit(sim, 'descent', 'Spirit\'s Descent', sim.pas.descent, 26, 190);
      if (ev.crit && sim.rand() < 0.5 && sim.icdReady('corrodeP', 1)) A2.procHit(sim, 'corrodeP', 'Corrode (passive)', sim.pas.corrode, 50.5, 260);
      const dot = Object.keys(sim.tg.debuffs).some((k) => k.indexOf('dot:') === 0 && sim.tg.debuffs[k].until > sim.t);
      if (dot && sim.rand() < 0.5 && sim.icdReady('counter', 1)) A2.procHit(sim, 'counter', 'Consecutive Countercurrent', sim.pas.counter, 23.5, 220);
      const fb = sim.buffOn('flameBlessing');
      if (fb && !o.proc && sim.rand() < 0.5 && sim.icdReady('flameB', fb.icd)) A2.procHit(sim, 'flameB', 'Flame Blessing', fb.base, 41, 15);
    },

    rotation(sim) {
      const out = ['elementalFusion'];
      if (sim.total > 0) out.push('summonAncientSpirit', 'enhanceSpiritsBenediction', 'flameBlessing');
      out.push('jointstrikeDestructiveAttack', 'cursedCloud', 'jointstrikeCorrode', 'dimensionalControl');
      // keep a spirit out and cycle them for elements, but don't send the Ancient Spirit home early
      if (!sim.spirit || sim.spirit.id !== 'summonAncientSpirit') {
        const order = ['summonWaterSpirit', 'summonFireSpirit', 'summonWindSpirit', 'summonEarthSpirit'];
        for (const id of order) if (!sim.spirit || sim.spirit.id !== id) out.push(id);
      }
      out.push('jointstrikeCurse', 'rapidScattershot', 'siphon', 'magicBlock', 'seizeMagic', 'soulsCry', 'cryOfTerror', 'assaultTerror');
      if (sim.p.mp > 350) out.push('combustion');
      out.push('coldShock');
      return out;
    },
  });
})();
