// Assassin: daggers, Insignia, back attacks. Numbers from the global client (build 0.0.4387.0) via MetaBot's
// skill pages: base damage at skill Lv 1 / 10 / 20 / 40 (stigmas also 25), plus the % Attack part, which never
// changes with level.
//
// Insignia: Savage Roar, Savage Fang, the clones and a few specializations engrave it on the target (5 at most,
// 10s). Insignia Explosion spends it for 12% more damage per stack.
(function () {
  'use strict';
  const A2 = window.A2;
  const HUE = 275;
  const MOVERS = ['shadowstrike', 'flashSlice', 'infiltrate', 'shadowFall', 'spiralSlice', 'shadowstep'];

  function insignia(sim, n) {
    const d = sim.addStacks('insignia', n, 5, 10);
    Object.assign(d, {name: 'Insignia', short: 'Insignia', icon: 'rune', hue: HUE});
  }
  function immune(sim) { return sim.cfg.dummy.kind !== 'field'; }
  function stunned(sim) { return !!sim.debuffOn('stun'); }
  function cc(sim, id, dur, name) {
    if (immune(sim)) return;   // bosses have Incapacitated Immunity
    sim.debuff(id, dur, {name, short: name, icon: 'bolt', hue: 50});
  }
  function blind(sim, dur) {
    sim.debuff('blind', dur, {name: 'Blind', short: 'Blind', icon: 'eye', hue: 220});
  }
  function spec(s, i) { return s.specOn.indexOf(i) >= 0 && s.level >= s.specs[i].lv; }
  function cut(sim, id, sec) { if (sim.p.cds[id]) sim.p.cds[id] -= sec; }

  const skills = {
    quickSlice: {
      name: 'Quick Slice', kind: 'active', unlock: 1, cd: 0, range: 4, mpGain: 100, moving: true, anim: 0.55,
      dmg: {1: 61, 10: 452, 20: 860, 40: 1406}, atk: 70, icon: 'slash', hue: HUE,
      desc: 'Basic dagger flurry. Restores 100 MP.',
      onHit(sim, ev) { if (spec(ev.s, 3)) cut(sim, 'insigniaExplosion', 1); },
      specs: [
        {lv: 8, text: '+20% MP restored', mod: {mpGainPct: 20}}, {lv: 8, text: 'Absorbs HP'}, {lv: 8, text: '+50% Multi-Hit on hit', mod: {multi: 50}},
        {lv: 12, text: '-1s Insignia Explosion cooldown on hit', hook: true}, {lv: 16, text: 'Ignores Block and Evasion and lands as a Critical Hit', mod: {crit: true}},
      ],
    },
    savageRoar: {
      name: 'Savage Roar', kind: 'active', unlock: 1, cd: 0, range: 4, mp: 120, moving: true, anim: 0.7, stagger: 2,
      dmg: {1: 68, 10: 534, 20: 1021, 40: 1673}, atk: 83.5, icon: 'roar', hue: HUE,
      desc: 'Engraves 1 Insignia for 10s.',
      onHit(sim, ev) { insignia(sim, 1); if (spec(ev.s, 3)) cut(sim, 'shadowstrike', 1); },
      specs: [
        {lv: 8, text: '-20% MP consumed', mod: {mpPct: -20}}, {lv: 8, text: '+20% Skill Speed', mod: {skillSpeed: 20}},
        {lv: 8, text: 'Up to 12% more damage when fewer targets are hit', mod: {dmgPct: 12}},
        {lv: 12, text: '-1s Shadowstrike cooldown on hit', hook: true}, {lv: 16, text: 'Pulls nearby targets'},
      ],
    },
    shadowstrike: {
      name: 'Shadowstrike', kind: 'active', unlock: 1, cd: 20, range: 20, mp: 150, moving: false, anim: 0.7, stagger: 10, move: 'behind',
      dmg: {1: 52, 10: 610, 20: 1194, 40: 1974}, atk: 100, icon: 'shadow', hue: HUE,
      desc: 'Moves behind the target, strikes and Stuns for 3s.',
      onHit(sim, ev) {
        cc(sim, 'stun', 3 + (spec(ev.s, 0) ? 1 : 0), 'Stun');
        if (spec(ev.s, 1)) sim.buff('ssCrit', 10, {name: 'Shadowstrike: Critical Damage +20%', short: 'Crit dmg', icon: 'shadow', hue: HUE, stat: {critDmg: 20}});
      },
      specs: [
        {lv: 8, text: 'Stun lasts 1s longer', hook: true}, {lv: 8, text: '+20% Critical Damage Boost for 10s on hit', hook: true},
        {lv: 8, text: '50% chance to Seal for 5s'}, {lv: 12, text: '50% chance to Root for 5s'}, {lv: 16, text: 'Becomes an AoE skill'},
      ],
    },
    ambush: {
      name: 'Ambush', kind: 'active', unlock: 3, cd: 10, range: 4, mp: 100, moving: false, anim: 0.8, stagger: 7, backPct: 30,
      dmg: {1: 126, 10: 943, 20: 1701, 40: 2777}, atk: 138, icon: 'dagger', hue: HUE,
      desc: '+30% damage as a back attack.',
      onHit(sim, ev) {
        const s = ev.s;
        if (spec(s, 0) && ev.back) insignia(sim, 2);
        if (spec(s, 3) && sim.rand() < 0.5 && sim.skills.whirlwindSlice) sim.hit(sim.skills.whirlwindSlice, {proc: true});
      },
      specs: [
        {lv: 8, text: 'Engraves 2 Insignias on a back attack', hook: true}, {lv: 8, text: 'Absorbs HP'}, {lv: 8, text: 'Breaks Protective Shields'},
        {lv: 12, text: '50% chance to trigger Whirlwind Slice on hit', hook: true}, {lv: 16, text: '+2 consecutive uses', mod: {uses: 2}},
      ],
    },
    heartGore: {
      name: 'Heart Gore', kind: 'active', unlock: 4, cd: 5, range: 4, mpGain: 100, moving: true, anim: 0.6, stagger: 5,
      dmg: {1: 111, 10: 834, 20: 1504, 40: 2455}, atk: 122, icon: 'fang', hue: 345, procWindow: 6,
      desc: 'Usable after you land a Critical Hit. Restores 100 MP.',
      when(sim) { return sim.procOn('heartGore') || 'Needs a Critical Hit first'; },
      onHit(sim, ev) {
        const s = ev.s;
        if (spec(s, 1)) insignia(sim, 1);
        if (spec(s, 4) && ev.crit) sim.p.cds.heartGore = sim.t;
      },
      specs: [
        {lv: 8, text: 'Absorbs HP'}, {lv: 8, text: 'Engraves 1 Insignia on hit', hook: true},
        {lv: 8, text: 'Up to +20% Critical Hit when fewer targets are hit', mod: {critPct: 20}},
        {lv: 12, text: 'Multi-Hit on hit', mod: {multi: 50}}, {lv: 16, text: 'Resets its cooldown when it lands a Critical Hit', hook: true},
      ],
    },
    stormRampage: {
      name: 'Storm Rampage', kind: 'active', unlock: 5, cd: 0, range: 4, moving: false, anim: 0.65,
      dmg: {1: 107, 10: 637, 20: 1049, 40: 1692}, atk: 82.5, icon: 'whirl', hue: 200,
      desc: 'Hits a target afflicted with Stagger (a broken stagger gauge on a boss).',
      when(sim) { return sim.t < sim.tg.brokenUntil || !!sim.debuffOn('stun') || 'The target must be Staggered'; },
      onHit(sim, ev) {
        const s = ev.s;
        if (spec(s, 4)) for (const id in sim.p.cds) if (id !== 'stormRampage') cut(sim, id, 1);
      },
      specs: [
        {lv: 8, text: 'Absorbs HP'}, {lv: 8, text: 'Restores 120 MP on hit', mod: {mpOnHit: 120}}, {lv: 8, text: 'Usable while moving', mod: {mobile: true}},
        {lv: 12, text: 'Multi-Hit on hit', mod: {multi: 50}}, {lv: 16, text: 'Every other cooldown -1s on hit', hook: true},
      ],
    },
    whirlwindSlice: {
      name: 'Whirlwind Slice', kind: 'active', unlock: 7, cd: 10, range: 4, moving: false, anim: 0.8, stagger: 7,
      dmg: {1: 300, 10: 1497, 20: 2320, 40: 3701}, atk: 177, icon: 'whirl', hue: HUE,
      desc: 'A spinning cut. Always Stuns monsters that can be stunned.',
      onHit(sim) { cc(sim, 'stun', 3, 'Stun'); },
      specs: [
        {lv: 8, text: '+50% Multi-Hit on hit', mod: {multi: 50}}, {lv: 8, text: 'Changes the AoE'}, {lv: 8, text: '+16m range', mod: {range: 16}},
        {lv: 12, text: '+20% Stun chance'}, {lv: 16, text: '25% chance to reset on Evasion'},
      ],
    },
    flashSlice: {
      name: 'Flash Slice', kind: 'active', unlock: 8, cd: 10, range: 4, mp: 50, moving: false, anim: 0.7, stagger: 7, move: 'opposite',
      dmg: {1: 181, 10: 905, 20: 1402, 40: 2237}, atk: 107, icon: 'step', hue: HUE,
      desc: 'Moves you to the opposite side of the target and Blinds it. Behind becomes in front.',
      onHit(sim) { blind(sim, 3); },
      specs: [
        {lv: 8, text: 'Blind lasts 2s longer'}, {lv: 8, text: '+6m range', mod: {range: 6}}, {lv: 8, text: 'Up to +20% damage when more targets are hit'},
        {lv: 12, text: '+1 consecutive use', mod: {uses: 1}}, {lv: 16, text: '50% chance to Stun a Blinded target'},
      ],
    },
    infiltrate: {
      name: 'Infiltrate', kind: 'active', unlock: 10, cd: 20, range: 10, moving: false, anim: 0.7, stagger: 10, move: 'behind',
      dmg: {1: 239, 10: 945, 20: 1417, 40: 2236}, atk: 105, icon: 'dash', hue: HUE,
      desc: 'Moves behind the target and strikes. Always Blinds monsters.',
      onHit(sim) { blind(sim, 3); },
      specs: [
        {lv: 8, text: 'Restores 300 Stamina'}, {lv: 8, text: '+10m range', mod: {range: 10}}, {lv: 8, text: 'Breaks Protective Shields'},
        {lv: 12, text: 'Adds the Dark Strike chain skill (no numbers published)'}, {lv: 16, text: '+20% Blind chance'},
      ],
    },
    shadowFall: {
      name: 'Shadow Fall', kind: 'active', unlock: 12, cd: 20, range: 10, mp: 100, moving: false, anim: 0.85, stagger: 10, move: 'to',
      dmg: {1: 465, 10: 1836, 20: 2754, 40: 4345}, atk: 204, icon: 'down', hue: 300, procWindow: 6,
      desc: 'Leaps on a Stunned target and knocks it down. Against a status-immune boss it lights up on a 5% chance when you hit.',
      when(sim, s) {
        if (stunned(sim) || sim.procOn('shadowFall')) return true;
        if (spec(s, 4) && sim.debuffOn('blind')) return true;
        return immune(sim) ? 'Lights up on a 5% chance when you hit a boss' : 'The target must be Stunned';
      },
      consume: true,
      onHit(sim, ev) { cc(sim, 'knockdown', 3 + (spec(ev.s, 3) ? 1 : 0), 'Knockdown'); if (spec(ev.s, 1)) insignia(sim, 3); },
      specs: [
        {lv: 8, text: 'Grants a shield'}, {lv: 8, text: 'Engraves 3 Insignias on hit', hook: true}, {lv: 8, text: '-5s cooldown', mod: {cd: -5}},
        {lv: 12, text: 'Knockdown lasts 1s longer'}, {lv: 16, text: 'Usable on Blinded targets', hook: true},
      ],
    },
    insigniaExplosion: {
      name: 'Insignia Explosion', kind: 'active', unlock: 14, cd: 10, range: 20, mp: 200, moving: true, anim: 0.75, stagger: 7,
      dmg: {1: 663, 10: 2065, 20: 3055, 40: 4771}, atk: 220, icon: 'burst', hue: 320,
      desc: 'Detonates the Insignia on the target: +12% damage per stack (5 stacks = +60%).',
      power(sim, s, base, atk) { const k = 1 + 0.12 * sim.stacks('insignia'); return [base * k, atk * k]; },
      onHit(sim, ev) {
        const keep = spec(ev.s, 2) ? Math.min(2, sim.stacks('insignia')) : 0;
        const d = sim.debuffOn('insignia');
        if (d) { if (keep) d.stacks = keep; else delete sim.tg.debuffs.insignia; }
        cc(sim, 'stun', 3 + (spec(ev.s, 3) ? 1 : 0), 'Stun');
      },
      specs: [
        {lv: 8, text: 'Adds a rotate effect'}, {lv: 8, text: '+50% Multi-Hit on hit', mod: {multi: 50}}, {lv: 8, text: 'Keeps 2 Insignia stacks', hook: true},
        {lv: 12, text: 'Stun lasts 1s longer'}, {lv: 16, text: '-3s cooldown', mod: {cd: -3}},
      ],
    },

    // --- stigmas ---------------------------------------------------------------------------
    savageFang: {
      name: 'Savage Fang', kind: 'stigma', cd: 60, range: 4, mp: 200, moving: false, anim: 1.0, stagger: 50,
      dmg: {1: 1074, 10: 2202, 20: 3012, 25: 3402, 30: 3792, 40: 4572}, atk: 200, icon: 'fang', hue: HUE, short: 'Big hit, 5 Insignias',
      desc: 'Engraves 5 Insignias for 10s.',
      onHit(sim, ev) { insignia(sim, 5); if (spec(ev.s, 2)) sim.buff('fangPve', 10, {name: 'Savage Fang: PvE Damage +10%', short: 'PvE +10%', icon: 'fang', hue: HUE, stat: {pveBoost: 10}}); },
      power(sim, s, base, atk) { return spec(s, 4) && immune(sim) ? [base * 3, atk * 3] : [base, atk]; },
      specs: [
        {lv: 5, text: 'Up to +20% damage when more targets are hit'}, {lv: 10, text: '+50 Stagger damage', mod: {stagger: 50}},
        {lv: 15, text: '+10% PvE Damage Boost for 10s on hit', hook: true}, {lv: 20, text: 'Lands as a Critical Hit', mod: {crit: true}},
        {lv: 1, text: '+200% damage to targets with Incapacitated Immunity (bosses) (rare stigma)', hook: true},
      ],
    },
    trinielsDagger: {
      name: 'Triniel\'s Dagger', kind: 'stigma', cd: 45, range: 4, mp: 200, moving: false, anim: 0.9, stagger: 20, backPct: 30,
      dmg: {1: 1374, 10: 2818, 20: 3855, 25: 4354, 40: 5852}, atk: 256, icon: 'dagger', hue: 40, short: 'Biggest hit, +30% from behind',
      desc: '+30% damage from behind. Raises the target\'s skill cooldowns.',
      onHit(sim, ev) {
        if (spec(ev.s, 1)) for (const id in sim.p.cds) if (id !== 'trinielsDagger' && sim.skills[id]) cut(sim, id, sim.cdOf(sim.skills[id]) * 0.1);
        if (spec(ev.s, 4)) sim.buff('triBack', 5, {name: 'Triniel\'s Dagger: Back Attack +10%', short: 'Back +10%', icon: 'dagger', hue: 40, stat: {backBoost: 10}});
      },
      specs: [
        {lv: 5, text: 'Usable while moving', mod: {mobile: true}}, {lv: 10, text: 'Every cooldown -10% on hit', hook: true},
        {lv: 15, text: 'Resets when it defeats an enemy'}, {lv: 20, text: 'Target\'s cooldowns +3%'},
        {lv: 1, text: '+10% Back Attack Damage Boost for 5s on hit (rare stigma)', hook: true},
      ],
    },
    assaultAmbush: {
      name: 'Assault Ambush', kind: 'stigma', cd: 120, range: 20, moving: false, anim: 0.9, stagger: 0,
      dmg: {1: 977, 10: 2003, 20: 2740, 25: 3095, 40: 4160}, atk: 182, icon: 'dash', hue: 20, short: 'Ranged opener, Blind',
      desc: 'Hits the target and up to 3 around it; Blinds monsters.',
      onHit(sim, ev) { blind(sim, 5); if (spec(ev.s, 0)) sim.buff('aaAtk', 5, {name: 'Assault Ambush: Attack +20%', short: 'Atk +20%', icon: 'dash', hue: 20, atkPct: 20}); },
      specs: [
        {lv: 5, text: '+20% Attack for 5s on hit', hook: true}, {lv: 10, text: '500 MP damage'}, {lv: 15, text: '+10m range', mod: {range: 10}},
        {lv: 20, text: '+20% Blind chance'}, {lv: 1, text: '-60s cooldown (rare stigma)', mod: {cd: -60}},
      ],
    },
    throwShadowblade: {
      name: 'Throw Shadowblade', kind: 'stigma', cd: 30, range: 20, moving: true, anim: 0.6, stagger: 15,
      dmg: {1: 778, 10: 1596, 20: 2183, 25: 2466, 40: 3314}, atk: 145, icon: 'arrow', hue: HUE, short: 'Ranged, usable while moving',
      desc: 'Throws a blade from up to 20m and slows the target.',
      specs: [
        {lv: 5, text: 'Adds the Shadowblade Pursuit chain skill (no numbers published)'}, {lv: 10, text: 'Resets when it defeats an enemy'},
        {lv: 15, text: 'Lands as a Critical Hit', mod: {crit: true}}, {lv: 20, text: 'Becomes an AoE skill'},
        {lv: 1, text: '+30% Skill Speed (rare stigma)', mod: {skillSpeed: 30}},
      ],
    },
    shadowstep: {
      name: 'Shadowstep', kind: 'stigma', cd: 45, range: 4, mp: 100, moving: false, anim: 0.8, stagger: 0, move: 'back-off',
      dmg: {1: 832, 10: 1706, 20: 2334, 40: 3543}, atk: 155, icon: 'shadow', hue: 250, short: 'Hit, then leap back into Stealth',
      desc: 'Strikes, then you leap back about 6m and go into Stealth for 3s.',
      moveAfter: true,
      onHit(sim, ev) { sim.p.stealth = sim.t + 3; if (spec(ev.s, 1)) insignia(sim, 5); },
      specs: [
        {lv: 5, text: '40% chance to Stun for 3s'}, {lv: 10, text: 'Engraves 5 Insignias on hit', hook: true}, {lv: 15, text: '+200 Evasion for 10s'},
        {lv: 20, text: '-15s cooldown', mod: {cd: -15}}, {lv: 1, text: 'Stealth lasts 2s longer (rare stigma)'},
      ],
    },
    smokeBomb: {
      name: 'Smoke Bomb', kind: 'stigma', cd: 30, range: 10, mp: 100, moving: true, anim: 0.6, stagger: 15,
      dmg: {1: 966, 10: 1981, 20: 2710, 25: 3061, 40: 4114}, atk: 180, icon: 'smoke', hue: 210, short: 'Mobile, Blind',
      desc: 'Blinds the target for 5s.',
      onHit(sim) { blind(sim, 5); },
      specs: [
        {lv: 5, text: '+10m range', mod: {range: 10}}, {lv: 10, text: 'Becomes an AoE skill'}, {lv: 15, text: 'Slows for 5s'},
        {lv: 20, text: '+1 consecutive use', mod: {uses: 1}}, {lv: 1, text: 'Inflicts Exposed for 5s (rare stigma; effect not published)'},
      ],
    },
    aerialBind: {
      name: 'Aerial Bind', kind: 'stigma', cd: 120, range: 4, mp: 150, moving: false, anim: 0.9, stagger: 20,
      dmg: {1: 837, 10: 1717, 20: 2349, 25: 2653, 40: 3566}, atk: 156, icon: 'wing', hue: 190, short: 'Launch; sure at 5 Insignias',
      desc: 'Launches the target (always at 5 Insignias, never on a status-immune boss).',
      onHit(sim, ev) {
        if (sim.stacks('insignia') >= 5 || sim.rand() < 0.5) cc(sim, 'airborne', 3, 'Airborne');
        if (spec(ev.s, 2)) sim.buff('abStance', 10, {name: 'Aerial Bind: Ambush Stance ×1.5', short: 'Stance ×1.5', icon: 'wing', hue: 190});
      },
      specs: [
        {lv: 5, text: '+16m range', mod: {range: 16}}, {lv: 10, text: 'Adds the Aerial Slaughter chain skill (no numbers published)'},
        {lv: 15, text: '×1.5 Ambush Stance effect for 10s', hook: true}, {lv: 20, text: '-30s cooldown', mod: {cd: -30}},
        {lv: 1, text: 'Ignores Block and Evasion (rare stigma)'},
      ],
    },
    spiralSlice: {
      name: 'Spiral Slice', kind: 'stigma', cd: 90, range: 20, mp: 200, moving: false, anim: 0.9, stagger: 20, move: 'to',
      dmg: {1: 1074, 10: 2202, 20: 3012, 25: 3402, 40: 4572}, atk: 200, icon: 'whirl', hue: 15, short: 'Rush in; strips buffs (dummies have none)',
      desc: 'Rushes in from up to 20m and removes a buff (extra damage per buff removed; a dummy has none).',
      specs: [
        {lv: 5, text: 'Removes up to 2 buffs'}, {lv: 10, text: 'Stuns when it removes 2+ buffs'}, {lv: 15, text: 'Removes up to 3 buffs'},
        {lv: 20, text: '-30s cooldown', mod: {cd: -30}}, {lv: 1, text: 'Ignores Block and Evasion (rare stigma)'},
      ],
    },
    illusiveClone: {
      name: 'Illusive Clone', kind: 'stigma', cd: 90, range: 40, mp: 200, moving: true, anim: 0.4, noHit: true,
      icon: 'clone', hue: 300, short: 'Burst: +20% as extra damage, no Heart Gore cooldown',
      desc: 'For 10s (30s at Lv 40): Heart Gore has no cooldown, and 20% of your damage hits again as extra damage.',
      onUse(sim, s) {
        const dur = A2.lv({1: 10, 40: 30}, s.level);
        sim.buff('illusiveClone', dur, {name: 'Illusive Clone', short: 'Clone', icon: 'clone', hue: 300,
                                       stat: spec(s, 1) ? {critDmg: 20} : null, ew: spec(s, 2) ? 1.5 : 1, backCrit: spec(s, 4)});
        sim.p.cds.heartGore = sim.t;
      },
      specs: [
        {lv: 5, text: '+10% Status Effect Chance'}, {lv: 10, text: '+20% Critical Damage Boost for the duration', hook: true},
        {lv: 15, text: '×1.5 Exploit Weakness for the duration', hook: true}, {lv: 20, text: '50% chance of extra damage on a Critical Hit (amount not published)'},
        {lv: 1, text: '-1s Illusive Clone cooldown on a back critical (rare stigma)', hook: true},
      ],
    },
    swiftContract: {
      name: 'Swift Contract', kind: 'stigma', cd: 60, range: 40, moving: true, anim: 0.3, noHit: true,
      icon: 'wind', hue: 160, short: '+20% Combat Speed',
      desc: '+20% Combat Speed for 10s (30s at Lv 40).',
      onUse(sim, s) {
        const dur = A2.lv({1: 10, 40: 30}, s.level);
        sim.buff('swift', dur, {name: 'Swift Contract', short: 'Swift', icon: 'wind', hue: 160,
                               stat: {combatSpeed: 20 + (spec(s, 3) ? 10 : 0)}, atkPct: spec(s, 4) ? 10 : 0,
                               rear: spec(s, 1) ? 1.5 : 1, assault: spec(s, 2) ? 1.5 : 1, mpCut: spec(s, 0)});
      },
      specs: [
        {lv: 5, text: '-20% MP cost for the duration', hook: true}, {lv: 10, text: '×1.5 Rear Smite for the duration', hook: true},
        {lv: 15, text: '×1.5 Assault Stance for the duration', hook: true}, {lv: 20, text: '+10% more Combat Speed', hook: true},
        {lv: 1, text: '+10% Attack for the duration (rare stigma)', hook: true},
      ],
    },
  };

  A2.registerClass({
    id: 'assassin', name: 'Assassin', order: 1, role: 'Melee DPS · daggers', icon: 'twin', hue: HUE,
    blurb: 'Insignia stacks, back attacks, Heart Gore off every critical.',
    stigmaSlots: 4, botBehind: true, botRange: 3,
    bar: ['quickSlice', 'savageRoar', 'ambush', 'heartGore', 'whirlwindSlice', 'flashSlice', 'insigniaExplosion', 'shadowstrike', 'infiltrate', 'shadowFall', 'stormRampage'],
    defaultStigmas: ['savageFang', 'trinielsDagger', 'illusiveClone', 'swiftContract'],
    defaultSpecs: {quickSlice: [2, 3, 4], ambush: [0, 3, 4], heartGore: [2, 3, 4], insigniaExplosion: [1, 2, 4], savageRoar: [0, 2, 3]},
    skills,

    // The class's passives at the active skill level.
    passives(sim, st) {
      const lv = sim.cfg.lvActive;
      sim.pas = {
        ewCrit: A2.lv({1: 100, 40: 490}, lv), ewAtk: A2.lv({1: 5.5, 40: 25}, lv),
        clone: {1: 17, 10: 106, 20: 172, 40: 279},
        poison: {1: 233, 10: 1167, 20: 1809, 40: 2885},
        rear: A2.lv({1: 3, 40: 22.5}, lv), assault: A2.lv({1: 6, 40: 45}, lv), multi: A2.lv({1: 0.3, 40: 12}, lv),
        stance: {1: 152, 10: 387, 20: 556, 40: 861},
        defBreak: A2.lv({1: 12, 40: 90}, lv),
        detHp: A2.lv({1: 30, 40: 69}, lv), det: {1: 228, 10: 433, 20: 579, 40: 871},
      };
      st.multiHit = (st.multiHit || 0) + sim.pas.multi;   // Impact Hit's Double chance
    },
    statHook(sim, k, v) {
      const swift = sim.buffOn('swift');
      if (k === 'critHit') return v + sim.pas.ewCrit;
      if (k === 'critDmg') return v + sim.pas.assault * (swift ? swift.assault : 1);
      if (k === 'backBoost') return v + sim.pas.rear * (swift ? swift.rear : 1);
      if (k === 'pveBoost') return v + sim.pas.rear * (swift ? swift.rear : 1);
      return v;
    },
    mpHook(sim, s, mp) { const sw = sim.buffOn('swift'); return sw && sw.mpCut ? mp * 0.8 : mp; },
    damageHook(sim, s, mult) {
      const db = sim.debuffOn('defBreak');
      // Defense Break lowers the target's Defense; on a dummy with damage reduction that reads as less reduction.
      if (db) mult *= 1 + Math.min(db.pct, 90) / 100 * A2.clamp(sim.cfg.dummy.reduction || 0, 0, 90) / 100;
      return mult;
    },
    pips(sim) { return {n: sim.stacks('insignia'), max: 5, color: 'hsl(300 90% 70%)'}; },

    onUse(sim, s) {
      if (MOVERS.indexOf(s.id) >= 0) {
        sim.buff('ambushStance', 10, {name: 'Ambush Stance', short: 'Stance', icon: 'eye', hue: 40});
      }
    },

    onHit(sim, ev, o) {
      if (o && (o.dot || o.as === 'clone')) return;
      const s = ev.s;
      const lv = sim.cfg.lvActive;
      // Heart Gore lights on a critical
      if (ev.crit && !o.proc && sim.has('heartGore')) sim.proc('heartGore', 6);
      const ic = sim.buffOn('illusiveClone');
      if (ic && !o.proc) {
        sim.record({id: 'illusiveClone', name: 'Illusive Clone', hue: 300, icon: 'clone'}, Math.round(ev.amt * 0.2), false, false, 0, {});
        if (ic.backCrit && ev.crit && ev.back) cut(sim, 'illusiveClone', 1);
      }
      if (ic) sim.p.cds.heartGore = Math.min(sim.p.cds.heartGore || 0, sim.t);
      if (o.proc) return;
      // Exploit Weakness: 25% Attack buff, 7% clones on a critical
      const ew = ic ? ic.ew : 1;
      {
        if (sim.rand() < 0.25 && sim.icdReady('ewAtk', 1)) sim.buff('ewAtk', 10, {name: 'Exploit Weakness: Attack', short: 'Atk', icon: 'eye', hue: 0, atkPct: sim.pas.ewAtk * ew});
        if (ev.crit && sim.rand() < 0.07 * ew && sim.icdReady('ewClone', 1)) {
          for (let i = 0; i < 5; i++) {
            sim.pending.push({at: sim.t + 0.15 + i * 0.12, s: {id: 'clone', name: 'Exploit Weakness clones', hue: 300, icon: 'clone', mods: {}},
              i, // each clone hit engraves an Insignia
            });
          }
          sim.emit('text', 'Clones!', '#c7b8ff');
        }
      }
      // Apply Poison
      if (sim.rand() < 0.15 && sim.icdReady('poison', 1)) {
        const base = A2.lv(sim.pas.poison, lv);
        const d = sim.debuff('poison', 10, {name: 'Poison', short: 'Poison', icon: 'poison', hue: 120});
        if (d.nextTick == null || d.nextTick > sim.t + 1) d.nextTick = sim.t + 1;
        d.tick = (sm) => sm.hit({id: 'poison', name: 'Apply Poison', hue: 120, icon: 'poison', mods: {}}, {base, atk: 138, dot: true, noMulti: true, as: 'poison', asName: 'Apply Poison'});
      }
      // Ambush Stance
      const stance = sim.buffOn('ambushStance');
      if (stance && sim.rand() < 0.5 && sim.icdReady('stance', 1)) {
        const k = sim.buffOn('abStance') ? 1.5 : 1;
        sim.hit({id: 'ambushStanceHit', name: 'Ambush Stance', hue: 40, icon: 'eye', mods: {}}, {base: A2.lv(sim.pas.stance, lv) * k, atk: 39 * k, proc: true});
      }
      // Determination
      if (sim.tg.hp * 100 <= sim.pas.detHp && sim.icdReady('det', 1)) {
        sim.hit({id: 'determination', name: 'Determination', hue: 0, icon: 'target', mods: {}}, {base: A2.lv(sim.pas.det, lv), atk: 37.5, proc: true});
      }
      // Defense Break on a staggered or impact-stunned target
      if ((sim.t < sim.tg.brokenUntil || sim.debuffOn('stun') || sim.debuffOn('knockdown')) && sim.icdReady('defBreak', 20)) {
        sim.debuff('defBreak', 10, {name: 'Defense Break', short: 'Def −' + Math.round(sim.pas.defBreak) + '%', icon: 'break', hue: 10, pct: sim.pas.defBreak});
      }
      // Shadow Fall's 5% chance against a target with Incapacitated Immunity
      if (immune(sim) && sim.has('shadowFall') && s.id !== 'shadowFall' && sim.rand() < 0.05) sim.proc('shadowFall', 6);
    },

    onStep(sim) {
      // clone hits land through `pending`; route them here so they engrave Insignia
      void sim;
    },

    // The bot's priorities, best first. It walks behind the dummy on its own.
    rotation(sim) {
      const ins = sim.stacks('insignia');
      const ready = (id) => sim.has(id) && sim.cdLeft(id) <= 0;
      const out = [];
      if (sim.elapsed() > 0 || sim.total > 0) {
        out.push('swiftContract');
        if (ins >= 3 || !ready('savageFang')) out.push('illusiveClone');
      }
      out.push('heartGore', 'shadowFall');
      if (ins >= 5 || (ins >= 3 && !ready('savageFang') && sim.cdLeft('savageFang') > 8)) out.push('insigniaExplosion');
      if (ins < 3 && ready('insigniaExplosion')) out.push('savageFang');
      if (sim.isBack()) out.push('trinielsDagger', 'ambush');
      out.push('stormRampage', 'whirlwindSlice');
      if (!sim.isBack()) out.push('shadowstrike', 'infiltrate', 'flashSlice');
      else out.push('aerialBind', 'smokeBomb', 'throwShadowblade', 'assaultAmbush');
      if (ins < 5 && sim.p.mp > 400) out.push('savageRoar');
      out.push('quickSlice');
      return out;
    },
  });

  // Clone hits from Exploit Weakness: each one engraves an Insignia.
  const baseHit = A2.Sim.prototype.hit;
  A2.Sim.prototype.hit = function (s, o) {
    if (s && s.id === 'clone' && this.cls.id === 'assassin') {
      const ev = baseHit.call(this, s, Object.assign({base: A2.lv(this.pas.clone, this.cfg.lvActive), atk: 13.8, proc: true, as: 'clone', asName: 'Exploit Weakness clones'}, o));
      insignia(this, 1);
      return ev;
    }
    return baseHit.call(this, s, o);
  };
})();
