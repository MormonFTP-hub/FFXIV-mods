// TEA, The Epic of Alexander (Ultimate): the four phases for the sim's party, on cactbot's timeline, with the strat
// wtfdig.info lists for the fight (NAUR/Elinabin, its only one). Spots are [east, north] yalms from the arena's middle;
// the floor is BossMod's: a circle of 20 (walled: no fall).
//
// Four phases, one sim target (the toolkit's multi-boss and phase features):
//   1. Living Liquid (the zone's own model) with the Liquid Hand beside it (plan.others: `hand`), the party's damage
//      split between them (an adds window for the Hand, its HP what Living Liquid had when it came out);
//   -  the Limit Cut intermission: Cruise Chaser (form `cc`) dashing through the numbers;
//   2. Brute Justice (form `bj`) tanked north, Cruise Chaser (others: `cc`) south; their HP is one pool;
//   3. Alexander Prime (form `ap`), Brute Justice and Cruise Chaser out beside him in Temporal Stasis, Inception and
//      Wormhole; then the DPS check: Cruise Chaser (an adds window, 25 s to kill him), then Brute Justice and the
//      rest of Alexander Prime (a second window);
//   4. Perfect Alexander (form `pa`), after Divine Judgment and the long wait (the timeline's gap is a push).
// Each phase ends when its HP does (script.pushes), else plays on past its enrage.
//
// The mechanics follow BossMod's TEA module (github.com/awgil/ffxiv_bossmod, BossMod.Ultimate/Shadowbringers/Ultimate
// /TEA), whose shapes and sizes come from the game's Action sheet, built with the sim's toolkit (js/mech.js):
//   P1: Fluid Swing / Strike (90-degree cleaves at the tanks); Cascade's three tornadoes (7.6-yalm puddles W, E, S);
//       their proteans (30-degree cones baited by the nearest); Hand of Prayer / Parting (bosses together or apart);
//       the Jagd Dolls' Exhausts (8.8 yalms round each doll's holder) and feeds; Living Liquid's proteans in two sets
//       (all eight, then the four nearest twice, Sluice's 5-yalm puddles on the four furthest); Splash, Drainage (6-yalm
//       busters on the tanks), Throttle, Hand of Pain.
//   Limit Cut: the Hawk Blasters (10-yalm circles, pairs 14 out turning 45 degrees, the middle twice); Alpha Sword (a
//       90-degree cone through each odd number) and Super Blassty Charge (a 10-wide charge at each even, 20 back).
//   P2: Whirlwind, Photon, Judgment Nisi (passed between partners), Compressed Water (an 8-yalm stack of 3+) and
//       Lightning (a pair) three times, Chakrams (a 6-wide line through the middle) with the Hawk Blasters baited at
//       the edge, Spin Crusher, the tornado frozen by Earth Missile's ice, Missile Command (missiles, mines, the
//       Enumerations: stacks of exactly three), Flarethrower (a 90-degree cone at the nearest), Propeller Wind (hide
//       behind the ice), Gavel, Double Rocket Punch (a shared buster), Super Jump and Apocalyptic Ray.
//   P3: Temporal Stasis (Aggravated Assault, House Arrest within 5, Restraining Order 30 apart; Cruise Chaser's cones
//       on the three nearest, Brute Justice's on the two nearest), Chastening Heat and Divine Spear, Inception (the
//       plasmaspheres, Judgment Crystals, Flarethrowers, the debuffs and Sacrament's 16-wide cross, Alpha Sword and
//       Super Jump), Wormhole (Limit Cut again with the Chakrams, Super Jump and Apocalyptic Ray, the wormholes soaked
//       5/6, 7/8, 1/2, Sacrament, Incinerating Heat, Enumerations), Mega Holy; the adds and Divine Judgment.
//   P4: The Final Word (beacons; the forced march toward the light, away from the dark), Optical Sight (spreads and
//       stacks), Fate Calibration alpha (the four clones north: defamation toward the safe one, the stack and the
//       Aggravated Assaults opposite, three Sacraments), Ordained (Capital) Punishment, Fate Calibration beta (light
//       and dark: the stack, the tether, the J Jumps at the wall, Optical Sight, Radiant Sacrament's donut), Almighty
//       Judgment's trines with Irresistible Grace, Temporal Prison.
// Simplified: the arena never turns (cactbot's "open space is new north" is always north; True Heart's direction is
// always north); Ordained Motion / Stillness can't be checked (the sim can't tell standing from moving), so they are
// callouts; the dolls, Embolus orbs, Plasma Shield, True Heart and Judgment Crystals aren't targets of their own; the
// Limit Cut charges stop a little past their target; Propeller Wind's shadow is a strip behind the ice; the Fate
// Calibration beta layout is this script's own (wtfdig gives text, not spots).
(function (B) {
  const S = B.SLOTS;
  const at = B.bearing;
  const inside = B.mechInside;
  const add = (a, b) => [a[0] + b[0], a[1] + b[1]];
  const sub = (a, b) => [a[0] - b[0], a[1] - b[1]];
  const mul = (a, k) => [a[0] * k, a[1] * k];
  const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);
  const deg360 = (d) => ((d % 360) + 360) % 360;
  const brg = (p) => deg360(Math.atan2(p[0], p[1]) * 180 / Math.PI);
  const pick = (a) => a[Math.floor(Math.random() * a.length)];
  const shuffle = (a) => { const b = a.slice(); for (let i = b.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [b[i], b[j]] = [b[j], b[i]]; } return b; };
  const r2 = (p) => [+p[0].toFixed(2), +p[1].toFixed(2)];
  const SUP = ['MT', 'OT', 'H1', 'H2'], DPS = ['M1', 'M2', 'R1', 'R2'], TANKS = ['MT', 'OT'], NONTANK = ['H1', 'H2', 'M1', 'M2', 'R1', 'R2'];
  const COMPASS = ['north', 'north-east', 'east', 'south-east', 'south', 'south-west', 'west', 'north-west'];
  const dirName = (d) => COMPASS[Math.round(deg360(d) / 45) % 8];
  const ARENA_R = 20;
  const CIRCLE = { shape: 'circle', at: [0, 0], r: ARENA_R };
  const onFloor = (p, m) => Math.hypot(p[0], p[1]) < ARENA_R - (m === undefined ? 0.9 : m);

  // ---------- placing the party ----------
  // Each [slot, want, sep] in turn: the nearest point to `want` on the floor, clear of the shapes in `avoid` (by m
  // yalms) and at least sep from those already placed.
  function place(list, o) {
    o = o || {};
    const m = o.m === undefined ? 1.3 : o.m, avoid = o.avoid || [], floor = o.floor || ((p) => onFloor(p)), done = (o.keep || []).map(p => ({ p, sep: o.keepSep || 0 }));
    const out = {};
    for (const [s, want, sp] of list) {
      const sep = sp === undefined ? (o.sep === undefined ? 0.6 : o.sep) : sp;
      const ok = (p) => floor(p) && avoid.every(h => !inside(h, p, m)) && done.every(d => dist(d.p, p) >= Math.max(d.sep, sep));
      let best = ok(want) ? want.slice() : null;
      for (let r = 0.2; !best && r <= 30; r += 0.2) {
        const n = Math.max(8, Math.round(2 * Math.PI * r / 0.25));
        for (let k = 0; k < n; k++) {
          const a = k / n * 2 * Math.PI, p = [want[0] + Math.sin(a) * r, want[1] + Math.cos(a) * r];
          if (ok(p)) { best = p; break; }
        }
      }
      out[s] = r2(best || want);
      done.push({ p: out[s], sep });
    }
    return out;
  }
  const clump = (slots, c, o) => place(slots.map(s => [s, c, 0.55]), Object.assign({ m: 0 }, o));
  const assign = (slots, pts) => Object.fromEntries(slots.map((s, i) => [s, pts[i]]));
  // n spots spread round c at radius r, `sep` degrees apart, centred on bearing deg.
  const fan = (deg, r, n, sep) => Array.from({ length: n }, (_, i) => r2(at(deg + (i - (n - 1) / 2) * sep, r)));

  // ---------- the party's places ----------
  // Phase 1: Living Liquid in the middle facing the main tank (north), everyone else at its back.
  const UP1 = { MT: [0, 4.6], OT: [4.2, 1], M1: [-2.5, -3.4], M2: [2.5, -3.4], H1: [-6, -8], H2: [6, -8], R1: [-9.5, -4.5], R2: [9.5, -4.5] };
  // Phase 2: Brute Justice north (A), Cruise Chaser south (C); the party between, off both.
  const BJ2 = [0, 9.5], CC2 = [0, -9.5];
  const UP2 = { MT: [0, 15.2], OT: [0, -15.2], M1: [-3.2, 3.6], M2: [3.2, 3.6], H1: [6.5, -1], H2: [-6.5, -1], R1: [-8.5, 2.5], R2: [8.5, 2.5] };
  // Phase 3: Alexander Prime in the middle facing the main tank (north).
  const UP3 = { MT: [0, 9], OT: [3.2, 8.4], M1: [-3.4, -7.6], M2: [3.4, -7.6], H1: [-7, -9.6], H2: [7, -9.6], R1: [-10, -7], R2: [10, -7] };
  // Phase 4: Perfect Alexander in the middle (hitbox 10.8): everyone near its edge, the tanks north.
  const UP4 = { MT: [0, 12.6], OT: [2.6, 12.3], M1: [-4.2, -11.6], M2: [4.2, -11.6], H1: [-8.6, -10], H2: [8.6, -10], R1: [-11.6, -6.4], R2: [11.6, -6.4] };

  // The arena's looks (map.js toggles models named _aN_...): phase 1's chamber (looks a1 and a3), the hall the rest
  // of the fight is fought in (a4 to a8, with a1's pipes and fires).
  const LOOK1 = ['a1', 'a3'];
  const LOOK2 = ['a1_flam1', 'a1_pip03', 'a1_pip10', 'a1_pip11', 'a1_shaf3', 'a4', 'a5', 'a6', 'a7', 'a8'];

  // When each phase gives way (the pushes' seconds; the timeline's own lines otherwise).
  const P1_END = 194.8;          // 5.2 s before the first Hawk Blaster (BossMod's P2Intermission)
  const P2_START = 226.1;        // J Kick
  const P2_END = 484.5;          // Temporal Stasis' 8 s cast starts 7.5 s after phase 2 ends
  const P4_FROM = 845.4, P4_TO = 895.4;   // Perfect Alexander up: cactbot's block starts 50 s later

  function plan(events, strat) {
    const P = { start: Object.assign({}, UP1), prefs: [], hazards: [], checks: [], calls: [], marks: [], labels: new Map(), debuffs: [],
      boss: [{ t: 0, at: [0, 0] }], hitbox: [{ t: 0, r: 3.5 }], face: [], form: [], others: [], untargetable: [],
      looks: [{ t: 0, show: LOOK1 }, { t: P1_END, show: LOOK2 }], arena: CIRCLE };
    let id = 0;
    const hz = (o) => { const h = Object.assign({ id: ++id, react: 3 }, o); P.hazards.push(h); return h; };
    const pref = (t, spots) => P.prefs.push({ t, spots });
    const call = (t, text, o) => P.calls.push(Object.assign({ t, text, dur: 5 }, o));
    const debuff = (slot, key, name, hint, t0, t1) => P.debuffs.push({ slot, key, name, hint, t0, t1 });
    const mark = (shape, t0, t1, fill) => P.marks.push(Object.assign({ kind: 'lit', t0, t1, fill }, shape));
    const label = (ev, text) => { if (ev) P.labels.set(ev, text); };
    const E = (name, t0, t1) => events.find(e => e.name === name && e.t >= t0 && e.t <= t1) || null;
    const EA = (name, t0, t1) => events.filter(e => e.name === name && e.t >= t0 && e.t <= t1);
    const T = (name, t0, t1, d) => { const e = E(name, t0, t1); return e ? e.t : d; };
    const castOf = (ev, d) => ev.t - (ev.cast || d || 4);
    const raid = (t, dmg, name, tell) => hz({ t, tell: tell === undefined ? t - 4 : tell, raidwide: true, dmg, name });
    const raidEv = (ev, dmg, text) => { if (!ev) return; raid(ev.t, dmg, ev.name, castOf(ev, 3)); if (text !== null) call(castOf(ev, 3), text || 'Raidwide', { dur: 3 }); };
    const spreads = (t, targets, r, name, o) => hz(Object.assign({ t, tell: t - 5, effect: 'bait', shape: 'circle', from: 'target', targets, r, dmg: 0.9, own: 0.3, name }, o));
    const stack = (t, targets, r, min, name, o) => hz(Object.assign({ t, tell: t - 5, effect: 'share', shape: 'circle', from: 'target', targets, r, min, max: 8, dmg: 0.35, name }, o));
    const buster = (t, targets, r, name, o) => spreads(t, targets, r, name, Object.assign({ dmg: 1.2, own: 0.5, buster: true }, o));
    // A cone from `from` (a point, 'boss' or another boss's model) at each target: its target takes `own`.
    const coneAt = (t, from, targets, half, r, name, o) => hz(Object.assign({ t, tell: t - 3, effect: 'bait', shape: 'cone', from, aim: 'target', targets, half, r, dmg: 1.0, own: 0.3, name }, o));
    const bossPath = P.boss, BJP = [{ t: 0, at: [-6, 0] }], CCP = [{ t: 0, at: [6, 0] }], HANDP = [{ t: 0, at: [2, 0] }];
    const bossTo = (t, p, move) => bossPath.push({ t, at: p, move });
    const bjTo = (t, p, move) => BJP.push({ t, at: p, move });
    const ccTo = (t, p, move) => CCP.push({ t, at: p, move });
    const handTo = (t, p, move) => HANDP.push({ t, at: p, move });
    const face = (t, x) => P.face.push(x === null ? { t } : typeof x === 'number' ? { t, deg: x } : { t, at: x });

    // ===== the raidwides =====
    for (const ev of events) {
      if (ev.name === 'Cascade' || ev.name === 'Whirlwind' || ev.name === 'Mega Holy') raidEv(ev, 0.45);
      else if (ev.name === 'Hand of Pain') raidEv(ev, 0.25, 'Hand of Pain: keep their HP even');
      else if (ev.name === 'J Kick') raidEv(ev, 0.45, null);
      else if (ev.name === 'Photon') raidEv(ev, 0.5, 'Photon: heal up');
      else if (ev.name === 'Gavel') raidEv(ev, 0.4, 'Gavel: Final Judgment');
      else if (ev.name === 'Splash x6') for (let k = 0; k < 6; k++) raid(ev.t + 1.1 * k, 0.1, 'Splash', ev.t - 3);
    }
    for (const ev of events) if (ev.name === 'Splash x6') call(ev.t - 3, 'Splash x6: raidwides', { dur: 4 });

    // ======================= phase 1: Living Liquid and the Liquid Hand =======================
    // Cascade's three tornadoes (Liquid Rage), west, east and south, for the rest of the phase: north stays open.
    const TW = [-16, 0], TE = [16, 0], TS = [0, -16], TORN = [TW, TE, TS];
    const tCas = T('Cascade', 15, 25, 19.5);
    for (const c of TORN) hz({ t: tCas + 1, tell: tCas - 3, shape: 'circle', at: c, r: 7.6, dmg: 0.6, tickDmg: 0.6, lasts: Math.min(150, P1_END - tCas - 1.5), tick: 1, name: 'Liquid Rage' });
    call(tCas - 4, 'Cascade: tornadoes west, east and south (north open)', { dur: 5 });
    // Fluid Swing (Living Liquid) and Fluid Strike (the Hand): 90-degree cleaves at their tanks.
    for (const ev of events.filter(e => e.name === 'Fluid Swing' && e.t < 150)) {
      coneAt(ev.t, 'boss', ['MT'], 45, 11.5, 'Fluid Swing', { dmg: 1.2, own: 0.5, buster: true, tell: ev.t - 4 });
      if (E('Fluid Strike', ev.t - 0.1, ev.t + 0.1)) coneAt(ev.t, 'hand', ['OT'], 45, 11.6, 'Fluid Strike', { dmg: 1.2, own: 0.5, buster: true, tell: ev.t - 4 });
    }
    // The opening: the boss in the middle facing the main tank.
    pref(0, UP1);
    // After Cascade: the Liquid west of the middle (cleaving west), the Hand east (cleaving east); the healers in the
    // middle; the doll holders round the edge between the tornadoes (R1 and R2 nearest the west and east ones, M2
    // nearest the south one: they bait their proteans), each an Exhaust's 8.8 yalms from everyone else.
    const DOLL = { R1: [-12.5, 8.3], R2: [12.5, 8.3], M1: [-10.6, -10.6], M2: [8.3, -12.5] };
    const SPLIT = (gap) => Object.assign({ MT: [-gap - 2.7, 0], OT: [gap + 2.7, 0], H1: [0, 3.6], H2: [0, -3.6] }, DOLL);
    bossTo(tCas + 0.5, [-2, 0], 1.5);
    pref(tCas + 0.5, SPLIT(2));
    const hand1 = tCas + 5.5;                  // the Hand comes out (BossMod: hand of prayer/parting 11 s after Cascade)
    // Hand of Prayer (stack the two) or Parting (split them), picked each pull.
    const handCall = (ev) => {
      if (!ev) return;
      const prayer = Math.random() < 0.5, gap = prayer ? 1 : 3.2;
      label(ev, prayer ? 'Hand of Prayer (bosses together)' : 'Hand of Parting (bosses apart)');
      call(ev.t - 6, prayer ? 'Hand of Prayer: bring the bosses together' : 'Hand of Parting: split the bosses', { alert: true, dur: 5 });
      return { gap, prayer };
    };
    const hp1 = handCall(E('Hand of Prayer/Parting', 30, 40)) || { gap: 2 };
    bossTo(30, [-hp1.gap, 0], 2); handTo(hand1, [2, 0]); handTo(30, [hp1.gap, 0], 2);
    pref(30, SPLIT(hp1.gap));
    // The tornadoes' proteans: the first locks on its nearest as its cast starts (step out), the second on whoever is
    // nearest as it lands (step back in).
    const rw1 = E('Rage Wave 1', 30, 40), rw2 = E('Rage Wave 2', 30, 42);
    const BAITER = { R1: TW, R2: TE, M2: TS };
    if (rw1) {
      for (const [s, c] of Object.entries(BAITER)) {
        hz({ t: rw1.t, tell: rw1.t - 3, shape: 'cone', from: c, aim: 'target', targets: [s], snap: 3, half: 15, r: 40, dmg: 0.9, name: 'Protean Wave (tornado)' });
        if (rw2) coneAt(rw2.t, c, [s], 15, 40, 'Protean Wave (tornado)', { tell: rw1.t, snap: 0.4, own: 0.3 });
      }
      call(rw1.t - 3.5, 'Tornado proteans: R1 west, R2 east, M2 south (bait, step out, step back in)', { dur: 5 });
    }
    // The Jagd Dolls: each holder stands on its doll; Exhaust twice (M1 and M2 feed theirs after the first).
    const ex = EA('Exhaust', 35, 55);
    if (ex[0]) { spreads(ex[0].t, ['M1', 'M2', 'R1', 'R2'], 8.8, 'Exhaust', { tell: ex[0].t - 4, own: 0.25 }); call(ex[0].t - 6, 'Dolls: take yours to your quadrant', { dur: 5 }); }
    if (ex[1]) spreads(ex[1].t, ['R1', 'R2'], 8.8, 'Exhaust', { tell: ex[0] ? ex[0].t + 0.5 : ex[1].t - 5, own: 0.25 });
    if (ex[0]) {
      pref(ex[0].t + 0.2, { M1: [-8.9, -4.6], M2: [4.6, -8.9] });                   // M1, M2 feed theirs to the tornadoes
      call(ex[0].t + 0.2, 'Feed the dolls: M1 and M2', { dur: 3 });
      pref(ex[0].t + 3.5, { M1: [-3.4, -2.6], M2: [3.4, -2.6] });
    }
    if (ex[1]) {
      pref(ex[1].t + 0.2, { R1: [-8.9, 4.6], R2: [8.9, 4.6] });
      call(ex[1].t + 0.2, 'Feed the dolls: R1 and R2', { dur: 3 });
    }
    // The second cleaves: the Liquid pointed south-east, the Hand south-west, everyone else north.
    const fs2 = E('Fluid Swing', 50, 60);
    if (fs2) {
      const t = fs2.t - 4.5;
      bossTo(t, [0.6, -1], 1.5); handTo(t, [-0.6, -1], 1.5);
      pref(t, Object.assign({ MT: [3, -3.4], OT: [-3, -3.4] }, clump(NONTANK, [0, 5.4], { sep: 0.9 })));
    }
    // Living Liquid's proteans: all eight as its cast starts (step out), then the four nearest (melee in, the ranged
    // out for Sluice's puddles on the four furthest), then the four nearest again (ranged in, melee out).
    const proteanSet = (pw1, pw2, pw3, sl, lay) => {
      if (!pw1) return;
      const c1 = castOf(pw1, 3);
      bossTo(c1 - 3, [0, 0], 1.5); handTo(c1 - 3, [0, 1.2], 1.5);
      pref(c1 - 3, Object.assign(clump(lay.n, [0, 4.6], { sep: 0.4 }), clump(lay.s, [0, -4.6], { sep: 0.4 })));
      for (const s of S) hz({ t: pw1.t, tell: c1, shape: 'cone', from: 'boss', aim: 'target', targets: [s], snap: pw1.t - c1, half: 15, r: 40, dmg: 0.9, name: 'Protean Wave' });
      pref(c1 + 0.05, lay.b2);
      if (pw2) coneAt(pw2.t, 'boss', lay.close2, 15, 40, 'Protean Wave', { tell: c1 + 0.5 });
      if (sl) spreads(sl.t, lay.far, 5, 'Sluice', { tell: castOf(sl, 3), snap: 3, dmg: 0.9 });
      pref((pw2 ? pw2.t : c1 + 5) + 0.05, lay.b3);
      if (pw3) coneAt(pw3.t, 'boss', lay.close3, 15, 40, 'Protean Wave', { tell: pw2 ? pw2.t : c1 + 3 });
      call(c1, 'Proteans: bait, then step out', { alert: true, dur: 3 });
      call(c1 + 3.2, `Proteans: ${lay.close2.includes('M1') ? 'melee in, ranged out' : 'ranged in'}`, { dur: 3 });
    };
    const ring = (deg, r) => r2(at(deg, r));
    proteanSet(E('Protean Wave 1', 60, 80), E('Protean Wave 2', 60, 80), E('Protean Wave 3', 60, 80), E('Sluice', 60, 80), {
      n: NONTANK, s: TANKS,
      b2: { MT: ring(135, 3.4), OT: ring(225, 3.4), M1: ring(270, 3.4), M2: ring(90, 3.4), H1: ring(40, 17.4), R2: ring(62, 17.4), H2: ring(320, 17.4), R1: ring(298, 17.4) },
      close2: ['MT', 'OT', 'M1', 'M2'], far: ['H1', 'H2', 'R1', 'R2'],
      b3: { H1: ring(45, 3.3), H2: ring(315, 3.3), R1: ring(270, 3.3), R2: ring(90, 3.3), MT: ring(139, 6.7), OT: ring(221, 6.7), M1: ring(237, 6.7), M2: ring(123, 6.7) },
      close3: ['H1', 'H2', 'R1', 'R2'],
    });
    // Drainage: a 6-yalm buster on each tank (the tornadoes' tethers); everyone else north.
    const dra = E('Drainage', 80, 95);
    if (dra) {
      pref(dra.t - 9, Object.assign({ MT: [-6.5, -2.5], OT: [6.5, -2.5] }, clump(NONTANK, [0, 8.5], { sep: 0.9 })));
      buster(dra.t, TANKS, 6, 'Drainage', { tell: dra.t - 5 });
      call(dra.t - 6, 'Drainage: tanks apart, party north', { dur: 4 });
    }
    const thr = E('Throttles', 90, 100);
    if (thr) {
      for (const s of shuffle(DPS).slice(0, 2)) { debuff(s, 'throttle', 'Throttle', 'a healer cleanses it', thr.t, thr.t + 8); call(thr.t, 'Throttle on YOU: get cleansed', { slot: s, dur: 4 }); }
      call(thr.t, 'Throttle: healers, cleanse', { dur: 3 });
    }
    // The second set: north T1 T2 H2 R1, south H1 M1 M2 R2; then MT north-east, OT west, M1 south, M2 east in, the
    // ranged and healers out; then the ranged and healers in.
    proteanSet(E('Protean Wave 1', 100, 115), E('Protean Wave 2', 100, 115), E('Protean Wave 3', 100, 115), E('Sluice', 100, 115), {
      n: ['MT', 'OT', 'H2', 'R1'], s: ['H1', 'M1', 'M2', 'R2'],
      b2: { MT: ring(45, 3.4), OT: ring(270, 3.4), M1: ring(180, 3.4), M2: ring(90, 3.4), H1: ring(225, 17.4), H2: ring(327.5, 17.4), R1: ring(307, 17.4), R2: ring(135, 17.4) },
      close2: ['MT', 'OT', 'M1', 'M2'], far: ['H1', 'H2', 'R1', 'R2'],
      b3: { H1: ring(180, 3.3), H2: ring(315, 3.3), R1: ring(270, 3.3), R2: ring(90, 3.3), MT: ring(39, 6.7), M2: ring(53, 6.7), OT: ring(225, 6.7), M1: ring(135, 6.7) },
      close3: ['H1', 'H2', 'R1', 'R2'],
    });
    // The tornadoes' proteans again, baited along the walls (south from the west one, east from the south one, north
    // from the east one); the Liquid pulled north-east, the Hand south-west.
    const rw3 = E('Rage Wave 1', 110, 120), rw4 = E('Rage Wave 2', 110, 120);
    if (rw3) {
      const tp = rw3.t - 0.8;
      bossTo(tp, [2.6, 2.6], 1.5); handTo(tp, [-2.6, -2.6], 1.5);
      pref(tp, Object.assign({ MT: [5, 5], OT: [-5, -5] }, clump(NONTANK, [3.5, -3.5], { sep: 0.9 })));
      for (const w of [rw3, rw4].filter(Boolean)) {
        [[TW, 180], [TS, 90], [TE, 0]].forEach(([c, d]) => hz({ t: w.t, tell: w.t - 3, shape: 'cone', at: c, deg: d, half: 15, r: 40, dmg: 0.9, name: 'Protean Wave (tornado)' }));
      }
    }
    const hp2 = handCall(E('Hand of Prayer/Parting', 115, 130));
    if (hp2) {
      const t = 118;
      bossTo(t, [-hp2.gap, 0], 2); handTo(t, [hp2.gap, 0], 2);
      pref(t, SPLIT(hp2.gap));
      pref(T('Splash x6', 125, 130, 127.4), Object.assign({ MT: [0, 4.6], OT: [0, -4.6] }, clump(NONTANK, [-4.5, -1], { sep: 0.9 })));
      bossTo(T('Splash x6', 125, 130, 127.4), [0, 0], 1.5); handTo(T('Splash x6', 125, 130, 127.4), [0, 0.5], 1.5);
    }
    label(E('Cascade Enrage', 130, 150), 'Cascade (phase 1\'s enrage: push Living Liquid before it)');
    P.others.push({ model: 'hand', path: HANDP, shows: [[hand1, P1_END]], face: 'OT' });

    // ======================= the Limit Cut intermission: Cruise Chaser =======================
    P.form.push({ t: P1_END, model: 'cc' });
    P.hitbox.push({ t: P1_END, r: 5 });
    P.untargetable.push([P1_END, 229.1]);
    bossTo(P1_END, [0, 0]);
    {
      const order = shuffle(S), num = Object.fromEntries(order.map((s, i) => [s, i + 1]));
      const who = (n) => order[n - 1];
      const tLC = P1_END + 2;
      for (const s of S) {
        debuff(s, null, `Limit Cut #${num[s]}`, num[s] % 2 ? 'Alpha Sword: step out, cleave outward' : 'Super Blassty Charge: step out, thrown 20', tLC, T(`#${num[s]} ${num[s] % 2 ? 'Alpha Sword' : 'Super Blassty Charge'}`, 200, 230, 222));
        call(tLC, `#${num[s]}: ${num[s] <= 4 ? 'inner' : 'outer'}; ${[1, 2, 5, 6].includes(num[s]) ? 'north-west half' : 'south-east half'}`, { slot: s, alert: true, dur: 8 });
      }
      // The Hawk Blasters: 10-yalm circles in pairs 14 out, starting on the north half and turning 45 degrees
      // clockwise each time, the middle after the fourth (BossMod's P2IntermissionHawkBlaster). The middle (inside
      // 3.7 yalms) is never hit by the pairs: wait there; out for the middle ones.
      const d0 = pick([270, 315, 0, 45]);
      const hb = ['Hawk Blaster 1', 'Hawk Blaster 2', 'Hawk Blaster 3', 'Hawk Blaster 4'];
      const cyc = [EA(hb[0], 195, 225), EA(hb[1], 195, 225), EA(hb[2], 195, 225), EA(hb[3], 195, 225)];
      const mids = EA('Middle Blaster', 195, 225);
      let prev = P1_END + 0.5;
      const blasts = [];
      for (let c = 0; c < 2; c++) for (let k = 0; k < 4; k++) { const e = cyc[k][c]; if (e) blasts.push({ t: e.t, deg: d0 + 45 * k }); }
      for (const m of mids) blasts.push({ t: m.t, mid: true });
      blasts.sort((a, b) => a.t - b.t);
      for (const b of blasts) {
        const parts = b.mid ? [[0, 0]] : [at(b.deg, 14), at(b.deg + 180, 14)];
        for (const c of parts) hz({ t: b.t, tell: prev, shape: 'circle', at: r2(c), r: 10, dmg: 0.9, name: b.mid ? 'Hawk Blaster (middle)' : 'Hawk Blaster', react: b.mid ? 1.3 : 2.2 });
        prev = b.t;
      }
      label(cyc[0][0], `Hawk Blaster (starting ${dirName(d0)}, turning clockwise)`);
      const MID = (slots) => clump(slots, [0, 0], { sep: 0.7 });
      pref(P1_END + 0.2, MID(S));
      // The cuts: each odd number steps out on the bearing just hit, Cruise Chaser appears behind it (3.3 in) and
      // cleaves outward; the even number takes his charge from the same spot, thrown 20 toward the wall.
      const A = [1, 2, 5, 6];
      const cuts = [];
      for (let n = 1; n <= 8; n++) {
        const odd = n % 2 === 1, e = E(`#${n} ${odd ? 'Alpha Sword' : 'Super Blassty Charge'}`, 200, 230);
        if (e) cuts.push({ n, t: e.t, odd, s: who(n) });
      }
      // Which bearing each pair uses: its group's side of the last pair of blasts (just hit, so clear till next time).
      const lastBlast = (t) => blasts.filter(b => !b.mid && b.t <= t).pop();
      const lastAny = (t) => blasts.filter(b => b.t <= t).pop();
      const sideOfGroup = (n, t) => { const lb = lastBlast(t), g = lb ? lb.deg : d0 - 45, north = A.includes(n); const a = deg360(g), bdeg = deg360(g + 180); const isN = (d) => d >= 225 || d < 45; return north ? (isN(a) ? a : bdeg) : (isN(a) ? bdeg : a); };
      const angOff = (a, b) => Math.abs(((a - b) % 360 + 540) % 360 - 180);
      const midBefore = (t, w) => mids.find(m => m.t < t && t - m.t < w);
      const oddDeg = {};
      for (const c of cuts) {
        if (!c.odd) continue;
        let d = sideOfGroup(c.n, c.t - 0.05);
        const pe = cuts.filter(x => !x.odd && x.t < c.t).pop();
        if (pe && c.t - pe.t < 6 && oddDeg[pe.n - 1] !== undefined) {
          const pl = deg360(oddDeg[pe.n - 1] - (midBefore(pe.t, 1) ? 53 : 0)), alt = deg360(d + 180);
          if (angOff(alt, pl) > angOff(d, pl)) d = alt;
        }
        oddDeg[c.n] = d;
      }
      const sideOf = (n) => oddDeg[n % 2 ? n : n - 1];
      const midAfter = (t, w) => mids.find(m => m.t > t && m.t - t < w);
      let apex = null, prevOdd = null;
      const apexAt = (c) => { const o = cuts.filter(x => x.odd && x.t < c.t).pop(); return { d: o ? sideOf(o.n) : d0 }; };
      const outFor = {};            // each middle blast's time to go out
      // (Out after the last pair of blasts before it, and after any charge in between.)
      for (const m of mids) {
        const lo = lastBlast(m.t - 0.05);
        outFor[m.t] = Math.max(m.t - 2.15, lo ? lo.t + 0.05 : 0);
      }
      for (const c of cuts) {
        const lb = lastAny(c.t - 0.05);
        if (c.odd) {
          const d = sideOf(c.n, c.t - 0.05);
          apex = { d, p: r2(at(d, 3.2)) };
          prevOdd = c;
          bossTo(c.t - 1.1, apex.p);
          face(c.t - 1.1, c.s);
          pref(Math.max(c.t - 1.6, lb ? lb.t + 0.05 : 0), { [c.s]: r2(at(d, 5.5)) });
          coneAt(c.t, apex.p, [c.s], 45, 30, 'Alpha Sword', { tell: c.t - 1.6, own: 0.35 });
          call(c.t - 2.5, `#${c.n}: Alpha Sword: step out ${dirName(d)}`, { slot: c.s, alert: true, dur: 2.5 });
          // Back in, unless a middle blast comes first (then out with the rest).
          if (!midAfter(c.t, 2.5)) pref(c.t + 0.15, MID([c.s]));
        } else if (apex) {
          // A middle blast just before: the target waits out beside the apex's line (clear of the odd's cleave),
          // thrown on toward the wall; otherwise just out from the apex on its line.
          const mb = midBefore(c.t, 1), late = midBefore(c.t, 4);
          const tgt = mb ? r2(at(apex.d - 40, 11.2)) : late ? r2(at(apex.d + 45, 7)) : r2(at(apex.d, 6.5));
          c.band = brg(sub(tgt, apex.p));
          pref(mb ? outFor[mb.t] : Math.max(c.t - 1.5, prevOdd.t + 0.1), { [c.s]: tgt });
          hz({ t: c.t, tell: c.t - 1.5, effect: 'bait', shape: 'line', from: apex.p, aim: 'target', targets: [c.s], len: 'target', w: 10, dmg: 1.0, own: 0.35, name: 'Super Blassty Charge' });
          hz({ t: c.t + 0.05, tell: c.t - 1.5, effect: 'knockback', from: apex.p, targets: [c.s], dist: 20, dmg: 0, name: 'Super Blassty Charge', immune: S.slice() });
          call(c.t - 2.5, `#${c.n}: Super Blassty Charge: step out ${dirName(apex.d)} (Arm's Length)`, { slot: c.s, alert: true, dur: 2.5 });
          if (!midAfter(c.t, 2.5)) pref(c.t + 0.7, MID([c.s]));
        }
      }
      // Everyone out for each middle blast (well off the line the next charge takes), back in after.
      for (const m of mids) {
        const after = cuts.find(c => c.t > m.t && c.t - m.t < 1.2);
        const outer = S.filter(s => !after || s !== after.s);
        // Everyone else out in the widest gap between the lines the cuts round it take (each cut's bearing; the
        // charge's toward its target), 15 degrees apart.
        const near = cuts.filter(c => c.t > outFor[m.t] - 1.6 && c.t < m.t + 2);
        const lines = near.map(c => (c.odd ? sideOf(c.n, c.t - 0.05) : (midBefore(c.t, 1) ? deg360(apexAt(c).d - 53) : apexAt(c).d))).map(deg360).sort((a, b) => a - b);
        let ld = d0 + 180;
        if (lines.length) {
          let best = -1;
          lines.forEach((a, i) => { const b = i + 1 < lines.length ? lines[i + 1] : lines[0] + 360, g = b - a; if (g > best) { best = g; ld = a + g / 2; } });
        }
        const spots = {};
        // (Each spot 65 degrees or more off every line; nearest the gap's middle first.)
        const off = (b) => Math.min(...lines.map(l => Math.abs(((b - l) % 360 + 540) % 360 - 180)), 999);
        const cand = [];
        for (let k = -12; k <= 12; k++) { const b = ld + 13 * k; if (off(b) >= 65) cand.push(b); }
        cand.sort((a, b) => Math.abs(a - ld) - Math.abs(b - ld));
        outer.forEach((s, i) => { spots[s] = r2(at(cand.length ? cand[i % cand.length] : ld, 11.6 + (cand.length && i >= cand.length ? 2.2 : 0))); });
        // The next cuts' targets wait out on their own lines (the even beside, clear of the odd's cleave).
        for (const c of cuts.filter(x => x.t > m.t && x.t < m.t + 4 && spots[x.s])) spots[c.s] = r2(c.odd ? at(sideOf(c.n, c.t - 0.05), 11.6) : at(apexAt(c).d + 60, 11.6));
        // (Whoever has a cut before it goes out after that.)
        const busy = cuts.filter(c => c.t > outFor[m.t] - 0.01 && c.t < m.t && spots[c.s]);
        // (An odd cut just before: out the other way from the charge's line, which runs 53 degrees off its own.)
        for (const c of busy) if (c.odd) spots[c.s] = r2(at(sideOf(c.n, c.t - 0.05) + 75, 11.6));
        // (The next cuts' targets go out on their lines only after any charge before the blast: theirs may cross it.)
        const ch = cuts.filter(c => !c.odd && c.t > outFor[m.t] && c.t < m.t).pop(), chLine = ch ? ch.band : null;
        const crosses = (s) => chLine !== null && Math.abs(((brg(spots[s]) - chLine) % 360 + 540) % 360 - 180) < 62;
        const ahead = cuts.filter(x => x.t > m.t && x.t < m.t + 4 && spots[x.s] && crosses(x.s)).map(x => x.s);
        for (const s of ahead) spots[s] = r2(mul(spots[s], 10.8 / 11.6));
        pref(outFor[m.t], Object.fromEntries(Object.entries(spots).filter(([s]) => !busy.some(c => c.s === s) && !ahead.includes(s))));
        if (ahead.length) pref(ch.t + 0.05, Object.fromEntries(ahead.map(s => [s, spots[s]])));
        for (const c of busy) pref(c.t + 0.05, { [c.s]: spots[c.s] });
        // Back in while pairs are still to come; after the last, stay out of the way (a little in).
        const more = blasts.some(b => !b.mid && b.t > m.t), next = new Set(cuts.filter(c => c.t > m.t && c.t < m.t + 4).map(c => c.s));
        const back = outer.filter(s => !next.has(s));
        pref(m.t + 0.2, more ? MID(back) : Object.fromEntries(back.map(s => [s, r2(mul(spots[s], 0.75))])));
        if (after) pref(after.t + 0.7, MID([after.s]));
      }
      call(P1_END + 4, 'Limit Cut: wait in the middle; out for the middle blasts', { dur: 6 });
    }

    // ======================= phase 2: Brute Justice and Cruise Chaser =======================
    P.form.push({ t: P2_START - 3, model: 'bj' });
    P.hitbox.push({ t: P2_START - 3, r: 5.4 });
    bossTo(P2_START - 3, BJ2);
    ccTo(P2_START - 3, CC2);
    pref(P2_START - 2.5, UP2);
    face(P2_START - 3, null);
    const ccFace = [];
    {
      const t0 = P2_START;
      // Judgment Nisi: four nisis passed between partners (MT-M1, OT-R2, H1-M2, H2-R1); the bots pass on time.
      const PART = { MT: 'M1', M1: 'MT', OT: 'R2', R2: 'OT', H1: 'M2', M2: 'H1', H2: 'R1', R1: 'H2' };
      const nisiEv = E('Judgment Nisi', t0, t0 + 30), tN = nisiEv ? nisiEv.t + 0.8 : t0 + 16;
      const greek = ['α', 'β', 'γ', 'δ'], NKEY = ['decreeAlpha', 'decreeBeta', 'decreeGamma', 'decreeDelta'];
      const holders = [['MT', 'M1'], ['OT', 'R2'], ['H1', 'M2'], ['H2', 'R1']].map(p => pick(p));
      const passes = [T('Photon', t0 + 25, t0 + 45, 262.5) + 0.6, 304.5, T('Flarethrower', t0 + 80, t0 + 95, 315.5) + 2.5, T('Water and Thunder', t0 + 100, t0 + 115, 336.2) + 4];
      const tGavel = T('Gavel', t0 + 120, t0 + 140, 356.5);
      holders.forEach((h0, i) => {
        let h = h0, from = tN;
        for (const tp of passes) { debuff(h, NKEY[i], `Final Decree Nisi ${greek[i]}`, `pass it to ${PART[h]}`, from, tp); h = PART[h]; from = tp; }
        debuff(h, NKEY[i], `Final Decree Nisi ${greek[i]}`, 'keep it for the Gavel', from, tGavel + 0.5);
      });
      call(tN, 'Nisi: pass with your partner after Photon', { dur: 5 });
      // Compressed Water (an 8-yalm stack of 3+) and Lightning (a pair), three times; each passes to someone in its
      // stack. Water: west (D), then east (B) twice; Lightning: with the main tank north twice, then with the off
      // tank south-west.
      const wt = EA('Water and Thunder', t0, t0 + 120).map(e => e.t);
      const tLink = T('Link-Up', t0, t0 + 30, 247.4) + 0.8;
      const w1 = pick(['H1', 'H2', 'R1']), l1 = pick(['M1', 'M2']);
      const W_AT = [[-13, -1], [13, -1], [13, -1]];
      const chain = [];
      let w = w1, prevW = null;
      wt.forEach((tw, k) => {
        const lMate = k === 0 ? 'MT' : k === 1 ? w1 : 'OT';
        const lHolder = k === 0 ? l1 : k === 1 ? 'MT' : w1;
        const lGroup = [lHolder, lMate].filter((v, i, a) => a.indexOf(v) === i);
        // The water's stack: its holder, the healers and ranged free of the lightning, then melee to make four.
        const free = (s) => s !== w && !lGroup.includes(s) && s !== prevW;
        const wGroup = [w].concat(['H1', 'H2', 'R1', 'R2'].filter(free), ['M1', 'M2'].filter(free)).slice(0, 4);
        chain.push({ t: tw, w, wGroup, lHolder, lGroup, wAt: W_AT[k] });
        prevW = w; w = pick(wGroup.filter(s => s !== w));
      });
      chain.forEach((c, k) => {
        const from = k ? chain[k - 1].t + 0.7 : tLink;
        debuff(c.w, 'compressedWater', 'Compressed Water', `stack ${k === 0 ? 'west (D)' : 'east (B)'}: three or more`, from, c.t);
        debuff(c.lHolder, 'compressedLightning', 'Compressed Lightning', 'a pair stack', from, c.t);
        call(from, `Compressed Water on YOU: ${k === 0 ? 'D (west)' : 'B (east)'}`, { slot: c.w, alert: true, dur: 5 });
        call(from, 'Compressed Lightning on YOU: pair stack', { slot: c.lHolder, alert: true, dur: 5 });
        stack(c.t, [c.w], 8, 3, 'Crashing Wave', { tell: c.t - 6, max: 6, dmg: 0.45 });
        stack(c.t, [c.lHolder], 8, 2, 'Crashing Thunder', { tell: c.t - 6, max: 2, dmg: 0.45 });
      });
      // Phase 2's movements, in order.
      // Chakrams: a 6-wide line through the middle; the Hawk Blasters baited where everyone stands as their cast starts
      // (at the edge, off the line), then in to the middle.
      const tChak = T('Chakrams', t0 + 20, t0 + 40, 256.2), tHB = T('Hawk Blaster', t0 + 25, t0 + 45, 260.6);
      const axis = pick([0, 45, 90, 135]);
      hz({ t: tChak, tell: tChak - 6, shape: 'line', at: at(axis + 180, 30), deg: axis, len: 60, w: 6, dmg: 1.2, name: 'Eye of the Chakram' });
      const edge = {}, ord = ['MT', 'M1', 'H1', 'R1', 'OT', 'R2', 'H2', 'M2'];
      ord.forEach((s, i) => { edge[s] = r2(at(axis + 22.5 + 45 * i, 18.3)); });
      pref(tChak - 6.5, edge);
      for (const s of S) hz({ t: tHB, tell: tHB - 5, shape: 'circle', from: 'target', targets: [s], snap: 5, r: 10, dmg: 0.9, name: 'Hawk Blaster' });
      pref(tChak + 0.15, clump(S, [0, 0.5], { sep: 0.8 }));
      call(tChak - 6.5, 'Chakrams: bait the blasters at the edge, off the line; then in', { alert: true, dur: 5 });
      // Back to uptime, ready for the first stacks (water west, lightning with the main tank).
      pref(tHB + 0.2, UP2);
      // Spin Crusher: Cruise Chaser's cone at his tank, south.
      const sc = E('Spin Crusher', t0 + 40, t0 + 55);
      if (sc) { coneAt(sc.t, 'cc', ['OT'], 45, 10, 'Spin Crusher', { tell: castOf(sc, 3), own: 0.4, dmg: 1.0 }); }
      const stackSpots = (c, k) => {
        const spots = {};
        Object.assign(spots, clump(c.wGroup, c.wAt, { sep: 0.7 }));
        const lc = k === 2 ? [-9.5, -12.5] : [0, 13.6];
        Object.assign(spots, clump(c.lGroup.filter(s => s !== 'MT' && s !== 'OT'), lc, { sep: 0.7 }));
        if (k === 2) spots.OT = [-9.5, -13.2];
        const rest = S.filter(s => !spots[s] && s !== 'MT' && s !== 'OT');
        Object.assign(spots, place(rest.map(s => [s, [4, 4], 0.8]), { avoid: [{ shape: 'circle', at: c.wAt, r: 8 }, { shape: 'circle', at: lc, r: 8 }], m: 1.4 }));
        return spots;
      };
      // The tornado that each Water stack leaves where it landed: the first frozen by the ice (the gaol that blocks
      // Propeller Wind), the second burned by Flarethrower, the third to the Gavel.
      const torn = (t, c, t1) => {
        hz({ t: t + 2.6, tell: t + 0.2, shape: 'circle', at: c, r: 8, dmg: 0.6, tickDmg: 0.6, lasts: t1 - t - 2.6, tick: 1, name: 'Liquid Rage (Drainage)' });
        // Out of where it comes up, to uptime clear of it.
        pref(t + 0.25, place(S.map(s => [s, UP2[s], 0.8]), { avoid: [{ shape: 'circle', at: c, r: 8 }], m: 1.5 }));
      };
      if (chain[0]) {
        pref(chain[0].t - 7, stackSpots(chain[0], 0));
        call(chain[0].t - 7, 'Water west (D), lightning with the main tank', { dur: 5 });
      }
      // Missile Command: missiles and mines baited by the two furthest (OT and R2 at the south wall), the
      // Enumerations (stacks of exactly three: east H1 R1 R2, west H2 M1 M2) and the ice on a tank, dropped by the
      // tornado to freeze it.
      const mc = E('Earth Missile', t0 + 55, t0 + 70), mf = E('Hidden Minefield', t0 + 55, t0 + 72), en = E('Enumeration', t0 + 60, t0 + 75);
      const tEn = en ? en.t + 5.1 : 297.8, tMine = tEn + 5.2, iceT = pick(TANKS), tFreeze = tEn + 5.6;
      const D = chain[0] ? chain[0].wAt : [-13, -1];
      if (chain[0]) torn(chain[0].t, D, tFreeze);
      if (mc) {
        const tm = castOf(mc, 3);
        pref(chain[0] ? chain[0].t + 0.6 : tm - 3, Object.assign(place(S.filter(s => s !== 'OT' && s !== 'R2').map(s => [s, UP2[s], 0.8]), { avoid: [{ shape: 'circle', at: D, r: 8 }], m: 1.5 }), { OT: [-4.5, -18.3], R2: [4.5, -18.3] }));
        ccTo(chain[0] ? chain[0].t + 0.6 : tm - 3, [0, -9], 2);
        for (const s of ['OT', 'R2']) hz({ t: mc.t, tell: tm, shape: 'circle', from: 'target', targets: [s], snap: 3, r: 5, dmg: 0.9, name: 'Earth Missile', lasts: 9, tick: 1, tickDmg: 0.6 });
        pref(mc.t - 3 + 0.1, { OT: [-4.5, -12], R2: [4.5, -12] });
        call(tm, 'Missiles and mines: OT and R2 at the south wall, then step north', { dur: 5 });
      }
      const mineAt = { OT: [-4.5, -12], R2: [4.5, -12] };
      if (mf) {
        for (const s of ['OT', 'R2']) hz({ t: mf.t, tell: castOf(mf, 3), shape: 'circle', from: 'target', targets: [s], snap: 3, r: 5, dmg: 0.9, name: 'Hidden Minefield' });
        for (const s of ['OT', 'R2']) hz({ t: tMine, tell: mf.t, effect: 'tower', shape: 'circle', at: mineAt[s], r: 2.5, soak: 1, only: [s], dmg: 0.25, fail: 0.9, name: 'Hidden Mine' });
      }
      if (en) {
        const pair = shuffle(NONTANK).slice(0, 2);
        let east = ['H1', 'R1', 'R2'], west = ['H2', 'M1', 'M2'];
        if (east.includes(pair[0]) === east.includes(pair[1])) {        // both on one side: M1 and R2 swap
          east = ['H1', 'R1', 'M1']; west = ['H2', 'R2', 'M2'];
          if (east.includes(pair[0]) === east.includes(pair[1])) { east = ['H1', 'R1', 'M2']; west = ['H2', 'R2', 'M1']; }
        }
        const eT = pair.find(s => east.includes(s)) || east[0], wT = pair.find(s => west.includes(s)) || west[0];
        const EAST = [8.5, -3], WEST = [-3.5, -5.5], ICE = add(D, [3.5, 8.3]);
        const icePlace = { [iceT]: ICE, [TANKS.find(s => s !== iceT)]: iceT === 'MT' ? mineAt.OT : [0, 15.2] };
        const sp = Object.assign(clump(east, EAST, { sep: 0.7 }), clump(west, WEST, { sep: 0.7 }), icePlace);
        pref(en.t + 0.2, sp);
        stack(tEn, [eT], 5, 3, 'Enumeration', { tell: en.t, max: 3, dmg: 0.3 });
        stack(tEn, [wT], 5, 3, 'Enumeration', { tell: en.t, max: 3, dmg: 0.3 });
        spreads(tEn, [iceT], 6, 'Earth Missile (ice)', { tell: en.t, own: 0.3 });
        hz({ t: tEn + 4, tell: tEn, shape: 'circle', at: ICE, r: 10, dmg: 0.9, name: 'Earth Missile (ice)', lasts: 5, tick: 1, tickDmg: 0.6 });
        for (const s of [eT, wT]) call(en.t, 'Enumeration on YOU: three in it', { slot: s, alert: true, dur: 4 });
        call(en.t, `Enumerations: east ${east.join(' ')}, west ${west.join(' ')}`, { dur: 5 });
        call(en.t, 'Ice on YOU: drop it by the tornado (D)', { slot: iceT, alert: true, dur: 4 });
        // After: the mines popped by OT and R2; everyone else back.
        pref(tEn + 0.2, Object.assign(place(S.filter(s => s !== 'OT' && s !== 'R2').map(s => [s, UP2[s], 0.8]), { avoid: [{ shape: 'circle', at: ICE, r: 10 }, { shape: 'circle', at: D, r: 8 }], m: 1.4 }), { OT: mineAt.OT, R2: mineAt.R2 }));
        pref(tMine + 0.2, { OT: UP2.OT, R2: UP2.R2 });
      }
      mark({ shape: 'circle', at: D, r: 2.9 }, tFreeze, tGavel + 6, 'rgba(160,220,255,0.55)');
      // The second stacks: water east (B), lightning with the main tank.
      if (chain[1]) {
        pref(Math.max(chain[1].t - 6, tMine + 0.25), stackSpots(chain[1], 1));
        torn(chain[1].t, chain[1].wAt, T('Flarethrower', t0 + 80, t0 + 95, 315.5) + 0.3);
      }
      // Limit Cut (Cruise Chaser invulnerable behind its Plasma Shield) and Flarethrower: the main tank turns Brute
      // Justice at the second tornado (east), everyone else west.
      const ft = E('Flarethrower', t0 + 80, t0 + 95);
      if (ft) {
        const dir = brg(sub(chain[1] ? chain[1].wAt : [13, -1], BJ2)), mtAt = r2(add(BJ2, at(dir, 5.8)));
        const cone = { shape: 'cone', at: BJ2, deg: dir, half: 45, r: 100 };
        pref(castOf(ft, 3.9) - 0.5, Object.assign({ MT: mtAt }, place(S.filter(s => s !== 'MT').map(s => [s, s === 'OT' ? UP2.OT : [-5, -2], 0.8]), { avoid: [cone], m: 1.6 })));
        coneAt(ft.t, 'boss', ['MT'], 45, 100, 'Flarethrower', { tell: castOf(ft, 3.9), own: 0.5, dmg: 1.2, buster: true });
        call(castOf(ft, 3.9), 'Flarethrower: the main tank points it at the tornado (east)', { dur: 4 });
        label(E('Limit Cut', t0 + 80, t0 + 95), 'Limit Cut (Cruise Chaser invulnerable: hit his Plasma Shield)');
        pref(ft.t + 0.2, UP2);
      }
      // The third stacks: water east, lightning with the off tank south-west (Cruise Chaser with him).
      if (chain[2]) {
        const t = chain[2].t - 7;
        ccTo(t, [-5, -11], 2);
        pref(t, stackSpots(chain[2], 2));
        torn(chain[2].t, chain[2].wAt, tGavel + 2);
        ccFace.push({ t, at: 'OT' });
      }
      // Propeller Wind: hide behind the ice (Gelid Gaol at D), in a line east of it; Cruise Chaser on its far side.
      const pw = E('Propeller Wind', t0 + 120, t0 + 135);
      if (pw) {
        const cs = castOf(pw, 6);
        ccTo(cs - 3, add(D, [-5.2, 0]), 2.5);
        const strip = (x) => r2([D[0] + x, D[1]]);
        const BPOG = shuffle(S.filter(s => s !== 'MT'));
        const line = Object.assign({ MT: strip(4.2) }, assign(BPOG, [5.7, 7.2, 8.7, 10.2, 11.7, 13.2, 14.7].map(strip)));
        pref(cs - 3.5, line);
        const sh = [{ shape: 'half', dir: [0, 1], off: D[1] + 2.6 }, { shape: 'half', dir: [0, -1], off: -(D[1] - 2.6) }, { shape: 'half', dir: [-1, 0], off: -(D[0] + 3) }];
        sh.forEach(h => hz(Object.assign({ t: pw.t, tell: cs, dmg: 1.5, name: 'Propeller Wind', react: 4 }, h)));
        bossTo(cs - 3, add(D, [9, 6]), 2);
        call(cs, 'Propeller Wind: line up behind the ice (east of it)', { alert: true, dur: 5 });
        pref(pw.t + 0.2, clump(S, add(D, [8, 0]), { sep: 0.8 }));
        bossTo(pw.t + 2, BJ2, 2); ccTo(pw.t + 2, CC2, 2);
        pref(tGavel + 0.3, UP2);
      }
      // Double Rocket Punch: a 3-yalm buster the tanks share, near the wall.
      const drp = E('Double Rocket Punch', t0 + 140, t0 + 155);
      if (drp) {
        const cs = castOf(drp, 4);
        pref(cs - 5.5, { MT: [-1, 15.6], OT: [1, 15.6] });
        ccTo(cs - 5, [0, 10.5], 4);
        stack(drp.t, ['MT'], 3, 2, 'Double Rocket Punch', { tell: cs, max: 2, dmg: 0.5 });
        call(cs, 'Double Rocket Punch: tanks share', { dur: 3 });
      }
      // Super Jump on the furthest (R2 at the east wall), then Apocalyptic Ray from there at the main tank (west).
      const sj = E('Super Jump', t0 + 150, t0 + 165), ar = E('Apocalyptic Ray x5', t0 + 150, t0 + 170);
      if (sj) {
        const cs = sj.t - 3.9, jumpAt = [18.4, 0];
        pref(cs - 1, Object.assign(clump(S.filter(s => s !== 'R2' && s !== 'MT'), [-11.5, -1], { sep: 0.8 }), { R2: jumpAt, MT: [-11.8, 3] }));
        bossTo(cs - 1, [-6, 5], 1.5); ccTo(cs - 1, [-6.5, -4], 1.5);
        spreads(sj.t + 0.4, ['R2'], 10, 'Super Jump', { tell: cs, own: 0.4 });
        bossTo(sj.t + 0.4, jumpAt);
        pref(sj.t + 0.5, { R2: [15.4, 10.5] });
        if (ar) {
          for (let k = 0; k < 5; k++) hz({ t: ar.t + 0.6 + 1.1 * k, tell: sj.t + 0.5, shape: 'cone', from: 'boss', aim: 'MT', half: 45, r: 25.5, dmg: 0.9, name: 'Apocalyptic Ray' });
          bossTo(ar.t + 5.5, BJ2, 2); ccTo(ar.t + 5.5, CC2, 2);
          pref(ar.t + 5.6, UP2);
        }
        call(cs, 'Super Jump: R2 at the east wall; everyone west', { alert: true, dur: 5 });
      }
      label(E('Final Sentence', t0 + 180, t0 + 195), 'Final Sentence (Brute Justice\'s enrage)');
      label(E('Eternal Darkness Enrage', t0 + 190, t0 + 205), 'Eternal Darkness (Cruise Chaser\'s enrage: phase 2 over)');
    }

    // ======================= phase 3: Alexander Prime =======================
    P.form.push({ t: P2_END, model: 'ap' });
    P.hitbox.push({ t: P2_END, r: 7.2 });
    P.untargetable.push([P2_END, 511.4]);
    bossTo(P2_END, [0, 13]);
    face(P2_END, 180);
    // --- Temporal Stasis ---
    {
      const ts = E('Temporal Stasis', 490, 505), tD = ts ? ts.t : 500;
      const ccEast = Math.random() < 0.5, sx = ccEast ? 1 : -1;
      const BJ = [-7 * sx, 0], CC = [7 * sx, 0];
      bjTo(P2_END, BJ); ccTo(P2_END, CC);
      const sup = shuffle(SUP), dps = shuffle(DPS);
      const kinds = ['aggravatedAssault', 'houseArrest', 'restrainingOrder', 'none'];
      const kindOf = {};
      kinds.forEach((k, i) => { kindOf[sup[i]] = k; kindOf[dps[i]] = k; });
      const pairOf = (k) => [sup[kinds.indexOf(k)], dps[kinds.indexOf(k)]];
      const [haS, haD] = pairOf('houseArrest'), [roS, roD] = pairOf('restrainingOrder'), [aaS, aaD] = pairOf('aggravatedAssault'), [noS, noD] = pairOf('none');
      const spots = {
        [haS]: add(CC, [0, 2]), [haD]: add(CC, [0, -2]),            // House Arrest: bait Cruise Chaser
        [noS]: add(BJ, [0, 2.2]), [noD]: add(BJ, [0, -2.2]),        // nothing: bait Brute Justice
        [aaS]: [-18.6 * sx, 4.5], [aaD]: [-18.6 * sx, -4.5],        // Aggravated Assault: the wall on Brute Justice's side
        [roS]: [-19.2 * sx, 0], [roD]: [14.2 * sx, 0],              // Restraining Order: the wall and Cruise Chaser's side
      };
      const NAME = { aggravatedAssault: 'Aggravated Assault', houseArrest: 'House Arrest', restrainingOrder: 'Restraining Order' };
      const HINT = { aggravatedAssault: 'take no hits: the wall on Brute Justice\'s side', houseArrest: 'stay within 5 of your partner: bait Cruise Chaser', restrainingOrder: 'stay 30 from your partner', none: 'bait Brute Justice' };
      for (const s of S) {
        const k = kindOf[s];
        if (k !== 'none') debuff(s, k, NAME[k], HINT[k], tD, tD + 3.2);
        debuff(s, 'temporalDisplacement', 'Temporal Displacement', 'time stopped', tD + 1.2, tD + 9);
        call(tD - 6, `${k === 'none' ? 'No debuff' : NAME[k]}: ${HINT[k]}`, { slot: s, alert: true, dur: 7 });
      }
      label(ts, `Temporal Stasis (Cruise Chaser ${ccEast ? 'east' : 'west'})`);
      // (The debuffs are known from the cast's start, as players read them from the game's own markers.)
      pref(tD - 7.5, spots);
      const sev = E('Surety and Severity', tD, tD + 6), tSev = sev ? sev.t : tD + 3.1;
      hz({ t: tSev, tell: tD, targets: [haS], tether: haD, within: 5, dmg: 0, fail: 0.9, name: 'House Arrest' });
      hz({ t: tSev, tell: tD, targets: [roS], tether: roD, stretch: 30, dmg: 0, fail: 0.9, name: 'Restraining Order' });
      const alphas = EA('Alpha Sword', tD, tD + 10), flames = EA('Flarethrower 1', tD, tD + 10).concat(EA('Flarethrower 2', tD, tD + 10));
      const ccT = [haS, haD, roD];
      alphas.forEach((e, k) => { if (ccT[k]) coneAt(e.t, 'cc', [ccT[k]], 45, 30, 'Alpha Sword', { tell: tD, own: 0.3 }); });
      flames.forEach((e, k) => coneAt(e.t, 'bj', [[noS, noD][k] || noS], 45, 100, 'Flarethrower', { tell: tD, own: 0.3 }));
      pref(tD + 9.5, UP3);
      bossTo(511.4 - 1, [0, 0]);
      face(511.4 - 1, null);
    }
    // --- Chastening Heat and Divine Spear (twice): a 5-yalm buster on the main tank, then three cones at the other ---
    let tankA = 'MT', tankB = 'OT';
    const heat = (ev) => {
      if (!ev) return;
      const cs = castOf(ev, 5), spears = ['Divine Spear 1', 'Divine Spear 2', 'Divine Spear 3'].map(n => E(n, ev.t, ev.t + 12)).filter(Boolean);
      pref(cs - 0.5, Object.assign({}, UP3, { [tankA]: [0, 9], [tankB]: [6.5, 7.5] }));
      buster(ev.t, [tankA], 5, 'Chastening Heat', { tell: cs, status: ['magicVuln', 10] });
      pref(ev.t + 0.2, { [tankB]: [0, 9], [tankA]: [7.5, 4] });
      spears.forEach(e => coneAt(e.t, 'boss', [tankB], 45, 24.2, 'Divine Spear', { tell: ev.t, own: 0.45, dmg: 1.2, buster: true }));
      call(cs, `Chastening Heat on ${tankA}: then swap (Divine Spear x3 on ${tankB})`, { dur: 5 });
      [tankA, tankB] = [tankB, tankA];
    };
    heat(E('Chastening Heat', 515, 530));
    // --- Inception Formation ---
    const inc = E('Inception Formation', 530, 545);
    if (inc) {
      const t0 = inc.t;
      const AP = [0, 16], BJ = [-13.5, 6], CC = [13.5, 6];
      bossTo(t0 + 2.5, AP, 2); bjTo(t0 + 2.5, BJ); ccTo(t0 + 2.5, CC);
      face(t0 + 2.5, 180);
      // The plasmaspheres: four players tethered (they wait at the far edge, crossed, for their orbs), the other four
      // drop the Judgment Crystals in a box to the south.
      const teth = shuffle(S).slice(0, 4), free = S.filter(s => !teth.includes(s));
      const TETH = [[-12.7, 12.7], [12.7, 12.7], [-18, 0], [18, 0]];
      const BOX = [[-5, -8], [5, -8], [-5, -18], [5, -18]];
      const spots = Object.assign(assign(teth, TETH), assign(free, BOX));
      const tCr = T('Judgment Crystal + True Heart', t0, t0 + 25, 558.2), tOrb = tCr + 3.5;
      pref(t0 + 4.5, spots);
      for (const s of teth) { call(t0 + 7, 'Plasmasphere tethered to YOU: wait at your edge spot', { slot: s, alert: true, dur: 6 }); debuff(s, null, 'Plasmasphere', 'wait for your orb at the edge', t0 + 7, tOrb); }
      for (const s of free) call(t0 + 7, 'Judgment Crystal: your corner of the box (south)', { slot: s, alert: true, dur: 6 });
      spreads(tCr, free, 5, 'Judgment Crystal', { tell: tCr - 5, own: 0.25 });
      pref(tCr + 0.2, place(free.map(s => [s, [0, 3], 0.8]), { avoid: TETH.map(p => ({ shape: 'circle', at: p, r: 6 })), m: 1.5 }));
      spreads(tOrb, teth, 6, 'Aetheroplasm', { tell: tCr, own: 0.3 });
      // Flarethrower x3 from Brute Justice at the nearest: the tanks take the first two, the party the third
      // together (by Brute Justice, north-west).
      const fl = ['Flarethrower 1', 'Flarethrower 2', 'Flarethrower 3'].map(n => E(n, t0 + 25, t0 + 45)).filter(Boolean);
      if (fl.length) {
        const toward = brg(sub([-5, 15], BJ)), cone = { shape: 'cone', at: BJ, deg: toward, half: 45, r: 100 };
        const party = S.filter(s => !TANKS.includes(s));
        const wait = place(party.map(s => [s, [2, 1], 0.8]), { avoid: [cone], m: 1.6 });
        pref(tOrb + 0.2, Object.assign({ MT: r2(add(BJ, at(toward, 3.2))), OT: r2(add(BJ, at(toward - 70, 5.5))) }, wait));
        coneAt(fl[0].t, 'bj', ['MT'], 45, 100, 'Flarethrower', { tell: tOrb, own: 0.5, buster: true });
        if (fl[1]) {
          pref(fl[0].t + 0.1, { MT: r2(add(BJ, at(toward - 70, 5.5))), OT: r2(add(BJ, at(toward, 3.2))) });
          coneAt(fl[1].t, 'bj', ['OT'], 45, 100, 'Flarethrower', { tell: fl[0].t, own: 0.5, buster: true });
        }
        if (fl[2]) {
          const stk = r2(add(BJ, at(toward, 4)));
          pref((fl[1] || fl[0]).t + 0.1, Object.assign(clump(party, stk, { sep: 0.6 }), { MT: r2(add(BJ, at(toward + 80, 6))), OT: r2(add(BJ, at(toward - 80, 6))) }));
          hz({ t: fl[2].t, tell: (fl[1] || fl[0]).t, effect: 'share', shape: 'cone', from: 'bj', aim: stk, targets: [party[0]], half: 45, r: 100, min: 5, max: 8, dmg: 0.35, name: 'Flarethrower' });
        }
        call(tOrb, 'Flarethrower: tanks 1 and 2, the party the third (north-west)', { dur: 5 });
        hz({ t: fl[fl.length - 1].t + 1.5, tell: fl[fl.length - 1].t, raidwide: true, dmg: 0.2, name: 'Tetrashatter' });
      }
      // Inception: the debuffs (Restraining Order on a tank and a DPS, Shared Sentence on a DPS, Aggravated Assault on
      // two DPS); Alexander Prime to the middle and Sacrament's cross; the tanks and Shared Sentence west (the
      // heart north), everyone else east.
      const ie = E('Inception', t0 + 35, t0 + 50);
      if (ie) {
        const tI = castOf(ie, 5), ssv = E('Surety, Solidarity and Severity', ie.t, ie.t + 12), tS = ssv ? ssv.t : ie.t + 8.1;
        const sac = E('Sacrament', ie.t, ie.t + 12), tSac = sac ? sac.t : tS + 0.3;
        const roT = pick(TANKS), d = shuffle(DPS), roD = d[0], ss = d[1], aa = [d[2], d[3]];
        const WEST = [-13.2, 12.6], EASTP = [13.2, 12.6], SE = [13.2, -12.6];
        debuff(roT, 'restrainingOrder', 'Restraining Order', `stay 30 from ${roD}`, tI, tS);
        debuff(roD, 'restrainingOrder', 'Restraining Order', `stay 30 from ${roT}`, tI, tS);
        debuff(ss, 'sharedSentence', 'Shared Sentence', 'the stack with the tanks (west)', tI, tS);
        for (const s of aa) debuff(s, 'aggravatedAssault', 'Aggravated Assault', 'take no other hits (east)', tI, tS);
        call(tI, 'Inception: tanks and Shared Sentence west, everyone else east', { alert: true, dur: 6 });
        bossTo(tI + 2, [0, 0], 2);
        const westG = TANKS.concat([ss]);
        const sp = Object.assign(clump(westG.filter(s => s !== roT), WEST, { sep: 0.6 }), { [roT]: add(WEST, [-1.4, 1.2]) },
          clump(aa, EASTP, { sep: 0.7 }), clump(S.filter(s => !westG.includes(s) && !aa.includes(s) && s !== roD), SE, { sep: 0.7 }), { [roD]: [14.2, -12.6] });
        pref(tI + 0.2, sp);
        hz({ t: tS, tell: tI, targets: [roT], tether: roD, stretch: 30, dmg: 0, fail: 0.9, name: 'Restraining Order' });
        stack(tS, [ss], 4, 3, 'Plaint of Solidarity', { tell: tI, dmg: 0.4 });
        hz({ t: tSac, tell: tI + 2, shape: 'cross', at: [0, 0], deg: 0, len: 60, w: 16, dmg: 1.5, name: 'Sacrament' });
        // Alpha Sword (Cruise Chaser's cones on the three nearest: the healers north and south of him, Restraining
        // Order's DPS west) and Super Jump on the furthest (the Restraining Order tank, opposite Brute Justice).
        const aS = EA('Alpha Sword', ie.t + 10, ie.t + 20), sjI = E('Super Jump', ie.t + 10, ie.t + 22);
        const CCm = [0, -5], BJm = [-13, 6];
        ccTo(tSac + 0.3, CCm); bjTo(tSac + 0.3, BJm);
        const jumper = roT, rest = S.filter(s => !['H1', 'H2', roD, jumper].includes(s));
        pref(tSac + 0.4, Object.assign({ H1: add(CCm, [0, -3.2]), H2: add(CCm, [0, 3.2]), [roD]: add(CCm, [-3.2, 0]), [jumper]: [14.4, -12.6] }, clump(rest, [12, -1.5], { sep: 0.7 })));
        const tgt = ['H2', 'H1', roD];
        aS.forEach((e, k) => coneAt(e.t, 'cc', [tgt[k]], 45, 30, 'Alpha Sword', { tell: tSac, own: 0.3 }));
        if (sjI) { spreads(sjI.t + 0.3, [jumper], 10, 'Super Jump', { tell: tSac, own: 0.4 }); bjTo(sjI.t + 0.3, [14.4, -12.6]); }
        call(tSac + 0.4, `Healers north and south of Cruise Chaser, ${roD} west; ${jumper} bait the jump south-east`, { dur: 6 });
        pref(600.4, UP3);
      }
      bossTo(600.3 - 1, [0, 0], 1);
      face(600.3 - 1, null);
    }
    heat(E('Chastening Heat', 605, 615));
    // --- Wormhole Formation ---
    const wf = E('Wormhole Formation', 625, 635);
    if (wf) {
      const t0 = wf.t, AP = [0, -16.5];
      bossTo(t0 + 2.5, AP, 2); face(t0 + 2.5, 0);
      const wNW = Math.random() < 0.5, bjWest = !wNW, BJ = bjWest ? [-12, 12] : [12, 12];
      bjTo(t0 + 2.5, BJ); ccTo(t0 + 2.5, bjWest ? [12, 12] : [-12, 12]);
      const order = shuffle(S), num = Object.fromEntries(order.map((s, i) => [s, i + 1])), who = (n) => order[n - 1];
      const tLC = T('Limit Cut', t0, t0 + 15, 637.7);
      for (const s of S) {
        debuff(s, null, `Limit Cut #${num[s]}`, num[s] % 2 ? 'west: Alpha Sword' : 'east: Super Blassty Charge', tLC, T(`#${num[s]} ${num[s] % 2 ? 'Alpha Sword' : 'Super Blassty Charge'}`, t0, t0 + 45, 665));
        call(tLC, `#${num[s]}: ${num[s] % 2 ? 'west' : 'east'}${[5, 6].includes(num[s]) ? ', first wormholes' : [7, 8].includes(num[s]) ? ', second wormholes' : [1, 2].includes(num[s]) ? ', last wormholes' : ''}`, { slot: s, alert: true, dur: 8 });
      }
      // Odds wait west, evens east (clear of the Chakrams' lines, north-south and east-west through the middle, and
      // of Sacrament's cross from Alexander Prime, south); each cut steps out to the north wall on its side.
      const WC = [-13.6, 10], EC = [13.6, 10], CUT = { odd: [-8.4, 16.6], even: [8.4, 16.6] };
      const homeOf = (n) => (n % 2 ? WC : EC);
      const homes = () => Object.assign(clump(S.filter(s => num[s] % 2), WC, { sep: 0.7 }), clump(S.filter(s => !(num[s] % 2)), EC, { sep: 0.7 }));
      pref(t0 + 3, homes());
      const tChak = T('Chakrams', t0 + 15, t0 + 25, 649.5);
      hz({ t: tChak, tell: tChak - 6, shape: 'line', at: [0, 30], deg: 180, len: 60, w: 6, dmg: 1.2, name: 'Eye of the Chakram' });
      hz({ t: tChak, tell: tChak - 6, shape: 'line', at: [bjWest ? -30 : 30, 0], deg: bjWest ? 90 : 270, len: 60, w: 6, dmg: 1.2, name: 'Eye of the Chakram' });
      // The wormholes (north-west and south-east, or north-east and south-west), soaked 5/6, 7/8, 1/2 as they
      // shrink (8, 6, 3 yalms); the south one's second soak from its north edge, clear of Sacrament.
      const WH = wNW ? [r2(at(315, 16.5)), r2(at(135, 16.5))] : [r2(at(45, 16.5)), r2(at(225, 16.5))];
      const westW = WH.find(p => p[0] < 0), eastW = WH.find(p => p[0] > 0);
      const rep = ['Repentance 1', 'Repentance 2', 'Repentance 3'].map(n => E(n, t0 + 20, t0 + 40));
      const soak = [[5, 6], [7, 8], [1, 2]], RAD = [8, 6, 3], GO = [6, 3.4, 3.4];
      rep.forEach((e, k) => {
        if (!e) return;
        for (const n of soak[k]) {
          const wp = n % 2 ? westW : eastW;
          const spot = k === 1 && wp[1] < 0 ? r2([wp[0] * 1.08, -7.2]) : k === 0 && wp[1] > 0 ? r2(at(brg(wp) + (wp[0] > 0 ? 15 : -15), 15)) : r2(mul(wp, 1.04));
          hz({ t: e.t, tell: t0 + 16, effect: 'tower', shape: 'circle', at: wp, r: RAD[k], soak: [1, 8], dmg: 0.25, fail: 0.9, name: `Repentance ${k + 1}` });
          pref(e.t - GO[k], { [who(n)]: spot });
          pref(e.t + 0.15, { [who(n)]: homeOf(n) });
          call(e.t - GO[k] - 1, `Wormhole ${k + 1}: soak ${n % 2 ? 'west' : 'east'}`, { slot: who(n), alert: true, dur: 4 });
        }
      });
      label(rep[0], `Repentance (wormholes ${wNW ? 'north-west and south-east' : 'north-east and south-west'})`);
      // Super Jump on #3 or #4 (on the side away from Brute Justice), then Apocalyptic Ray from there at the middle.
      const sj = E('Super Jump', t0 + 15, t0 + 25), ar = E('Apocalyptic Ray x5', t0 + 15, t0 + 30);
      const jumper = who(bjWest ? 4 : 3), jAt = bjWest ? [17.6, -6] : [-17.6, -6], jAfter = r2(add(jAt, [0, 6.5]));
      if (sj) {
        pref(sj.t - 5, { [jumper]: jAt });
        spreads(sj.t + 0.3, [jumper], 10, 'Super Jump', { tell: sj.t - 3.9, own: 0.4 });
        bjTo(sj.t + 0.3, jAt);
        call(sj.t - 5, 'Super Jump on YOU: bait it at the wall', { slot: jumper, alert: true, dur: 4 });
        pref(sj.t + 0.5, { [jumper]: jAfter });
        if (ar) {
          for (let k = 0; k < 5; k++) hz({ t: ar.t + 0.6 + 1.1 * k, tell: sj.t + 0.5, shape: 'cone', at: jAt, deg: brg(mul(jAt, -1)), half: 45, r: 25.5, dmg: 0.9, name: 'Apocalyptic Ray' });
          bjTo(ar.t + 6, BJ, 1.5);
        }
      }
      const sac = E('Sacrament', t0 + 20, t0 + 35);
      if (sac) hz({ t: sac.t, tell: castOf(sac, 6), shape: 'cross', at: AP, deg: 0, len: 60, w: 16, dmg: 1.5, name: 'Sacrament' });
      // The cuts: Cruise Chaser appears behind each (toward the middle) and cleaves (the odd) or charges (the even)
      // out of the arena; the jump's baiter takes its cut where it landed.
      for (let n = 1; n <= 8; n++) {
        const odd = n % 2 === 1, e = E(`#${n} ${odd ? 'Alpha Sword' : 'Super Blassty Charge'}`, t0, t0 + 45);
        if (!e) continue;
        const southW = (odd ? westW : eastW)[1] < 0;
        const s = who(n), sp = s === jumper ? jAfter : (n === 5 || n === 6) && southW ? [odd ? -18.6 : 18.6, 0] : CUT[odd ? 'odd' : 'even'], cp = r2(mul(sp, 0.82));
        const prevSame = E(`#${n - 2} ${odd ? 'Alpha Sword' : 'Super Blassty Charge'}`, t0, t0 + 45);
        const soaked = rep.map((r, k) => (r && soak[k].includes(n) && r.t < e.t ? r.t : 0)).reduce((a, b) => Math.max(a, b), 0);
        if (s !== jumper) pref(Math.max(e.t - 4, prevSame ? prevSame.t + 0.3 : 0, soaked + 0.2), { [s]: sp });
        ccTo(e.t - 1.1, cp);
        if (odd) coneAt(e.t, cp, [s], 45, 30, 'Alpha Sword', { tell: e.t - 1.6, own: 0.35 });
        else {
          hz({ t: e.t, tell: e.t - 1.6, effect: 'bait', shape: 'line', from: cp, aim: 'target', targets: [s], len: 'target', w: 10, dmg: 1.0, own: 0.35, name: 'Super Blassty Charge' });
          hz({ t: e.t + 0.05, tell: e.t - 1.6, effect: 'knockback', from: cp, targets: [s], dist: 20, dmg: 0, name: 'Super Blassty Charge', immune: S.slice() });
        }
        call(e.t - 2.6, `#${n}: ${odd ? 'Alpha Sword' : 'Super Blassty Charge (Arm\'s Length)'}: step out north`, { slot: s, alert: true, dur: 2.5 });
        pref(e.t + (odd ? 0.2 : 0.7), { [s]: homeOf(n) });
      }
      // Incinerating Heat (a stack on one, everyone in it), then the Enumerations (two DPS: healers west, tanks east).
      const ih = E('Incinerating Heat', t0 + 35, t0 + 45), en = E('Enumeration', t0 + 40, t0 + 50);
      if (ih) {
        const tgt = pick(S);
        pref(Math.max(castOf(ih, 5) + 0.5, T('#8 Super Blassty Charge', t0, t0 + 45, 0) + 0.8), clump(S, [0, 4], { sep: 0.6 }));
        stack(ih.t, [tgt], 5, 8, 'Incinerating Heat', { tell: castOf(ih, 5), dmg: 0.35 });
        call(castOf(ih, 5), `Incinerating Heat on ${tgt}: everyone in`, { dur: 4 });
        bossTo(ih.t, [0, 0], 1.5); face(ih.t, null);
      }
      if (en) {
        const e2 = shuffle(DPS), [ea, wa] = e2;
        const sp = Object.assign(clump(['H1', 'H2', wa], [-8.5, -2], { sep: 0.7 }), clump(['MT', 'OT', ea], [8.5, -2], { sep: 0.7 }), clump([e2[2], e2[3]], [0, 12], { sep: 1.5 }));
        pref(en.t - 4.2, sp);
        stack(en.t, [wa], 5, 3, 'Enumeration', { tell: en.t - 5, max: 3, dmg: 0.3 });
        stack(en.t, [ea], 5, 3, 'Enumeration', { tell: en.t - 5, max: 3, dmg: 0.3 });
        call(en.t - 5, `Enumerations: ${wa} west with the healers, ${ea} east with the tanks`, { alert: true, dur: 5 });
        pref(en.t + 0.2, UP3);
      }
    }
    // --- the DPS check: Summon Alexander; Cruise Chaser (25 s) and Brute Justice, then Alexander Prime ---
    {
      const sa = E('Summon Alexander', 695, 705), tA = sa ? sa.t + 6.2 : 705.6;
      const js = E('J Storm + Waves x16', 700, 712);
      if (js) {
        raid(js.t, 0.3, 'J Storm', js.t - 2);
        for (let k = 0; k < 16; k++) hz({ t: js.t + 4.1 + 3 * k, tell: js.t + 1.1 + 3 * k, raidwide: true, dmg: 0.06, name: 'J Wave', ifAlive: 1 });
        label(js, 'J Storm, then J Waves (until Brute Justice falls)');
      }
      P.form.push({ t: tA, model: 'none' }, { t: 731.7, model: 'ap' }, { t: 771.9, model: 'none' });
      bjTo(tA, [-6, 3]); ccTo(tA, [6, 3]);
      bossTo(731.7, [0, 6]);
      pref(tA, { MT: [-6, 7.6], OT: [6, 7.6], M1: [-4, -0.6], M2: [4, -0.6], H1: [-5, -7], H2: [5, -7], R1: [-9, -4], R2: [9, -4] });
      pref(731.8, { OT: [-3, 7], MT: [0, 10], M2: [-1.5, 0], M1: [-5.5, -0.8] });
      const ed = E('Eternal Darkness Enrage', 725, 740);
      if (ed) { hz({ t: ed.t, tell: ed.t - 25, raidwide: true, dmg: 0.55, name: 'Eternal Darkness (Cruise Chaser lived)', ifAlive: 0 }); label(ed, 'Eternal Darkness (Cruise Chaser\'s enrage: kill him first)'); }
      call(tA + 1, 'Cruise Chaser first (25 s), then Brute Justice, then Alexander Prime', { alert: true, dur: 6 });
      label(E('Divine Judgment Enrage', 760, 780), 'Alexander Prime falls (or Divine Judgment ends it)');
      const dj = E('Divine Judgment', 780, 795);
      if (dj) { raid(dj.t, 0.5, 'Divine Judgment', dj.t - 4); call(dj.t - 4, 'Divine Judgment: tank Limit Break', { alert: true, dur: 4 }); }
      label(E('Down for the Count', 780, 795), 'Down for the Count (Perfect Alexander comes)');
      pref(772, clump(S, [0, -4], { sep: 1 }));
    }

    // ======================= phase 4: Perfect Alexander =======================
    P.form.push({ t: P4_FROM - 8, model: 'pa' });
    P.hitbox.push({ t: P4_FROM - 8, r: 10.8 });
    bossTo(P4_FROM - 8, [0, 0]);
    face(P4_FROM - 8, null);
    pref(P4_FROM - 7, UP4);
    // --- The Final Word: the beacons; the forced march (toward the light, away from the dark) ---
    const fw = E('The Final Word', 900, 915);
    if (fw) {
      const t0 = fw.t + 0.8, sh = shuffle(S), light = sh[0], dark = sh[1], lf = sh.slice(2, 5), df = sh.slice(5);
      debuff(light, 'contactRegulation', 'Final Word: Contact Regulation', 'the light beacon: north', t0, t0 + 14);
      debuff(dark, 'escapeDetection', 'Final Word: Escape Detection', 'the dark beacon: south', t0, t0 + 14);
      for (const s of lf) debuff(s, 'contactProhibition', 'Final Word: Contact Prohibition', 'marched toward the light: start far (south)', t0, t0 + 14);
      for (const s of df) debuff(s, 'escapeProhibition', 'Final Word: Escape Prohibition', 'marched away from the dark: start by it', t0, t0 + 14);
      const om = EA('Ordained Motion/Stillness', fw.t, fw.t + 25);
      const first = Math.random() < 0.5 ? 'Motion' : 'Stillness', second = first === 'Motion' ? 'Stillness' : 'Motion';
      om.forEach((e, k) => { label(e, `Ordained ${k ? second : first}`); call(e.t - 4, k ? (second === 'Motion' ? 'Ordained Motion: keep moving' : 'Ordained Stillness: stop') : (first === 'Motion' ? 'Ordained Motion: keep moving' : 'Ordained Stillness: stop'), { alert: true, dur: 4 }); });
      const LB = [0, 15.8], DB = [0, -13], WAIT = [0, -10];
      pref(t0 + 0.5, Object.assign({ [light]: LB, [dark]: DB }, clump(lf.concat(df), WAIT, { sep: 0.7 })));
      const tMarch = (om[0] ? om[0].t : t0 + 6) + 3.5;
      hz({ t: tMarch, tell: tMarch - 4, effect: 'pull', from: light, targets: lf, dist: 20, minDist: 2, dmg: 0, unstoppable: true, name: 'Forced march (toward the light)' });
      hz({ t: tMarch, tell: tMarch - 4, effect: 'knockback', from: dark, targets: df, dist: 20, dmg: 0, unstoppable: true, name: 'Forced march (away from the dark)' });
      pref(tMarch + 1.4, UP4);
      call(t0, `Final Word: ${light} light (north), ${dark} dark (south); the rest just north of the dark`, { alert: true, dur: 6 });
    }
    // --- Optical Sight: spreads or stacks, then the other ---
    const optical = (t, kind, tell) => {
      if (kind === 'spread') {
        const pts = fan(180, 13.6, 8, 32);
        pref(tell + 0.3, assign(['R2', 'M2', 'H2', 'OT', 'MT', 'H1', 'M1', 'R1'], pts));
        spreads(t, S, 6, 'Individual Reprobation', { tell });
      } else {
        const a = ['MT', 'H1', 'M1', 'R1'], b = ['OT', 'H2', 'M2', 'R2'];
        pref(tell + 0.3, Object.assign(clump(a, [-8.5, -9.5], { sep: 0.6 }), clump(b, [8.5, -9.5], { sep: 0.6 })));
        stack(t, ['H1', 'H2'], 6, 4, 'Collective Reprobation', { tell, max: 4 });
      }
    };
    {
      const o1 = E('Individual/Collective Reprobation', 935, 941), o2 = E('Individual/Collective Reprobation', 941, 947);
      const firstSpread = Math.random() < 0.5;
      if (o1) { optical(o1.t, firstSpread ? 'spread' : 'stack', o1.t - 5); label(o1, firstSpread ? 'Individual Reprobation (spread)' : 'Collective Reprobation (stacks)'); call(o1.t - 5, firstSpread ? 'Spread, then stacks' : 'Stacks, then spread', { alert: true, dur: 5 }); }
      if (o2) { optical(o2.t, firstSpread ? 'stack' : 'spread', o2.t - 4); label(o2, firstSpread ? 'Collective Reprobation (stacks)' : 'Individual Reprobation (spread)'); }
      if (o2) pref(o2.t + 0.2, UP4);
    }
    // --- Fate Calibration alpha: four clones at the north edge, three Sacraments; defamation toward the safe one,
    // the stack (Shared Sentence and the three without a debuff) and the three Aggravated Assaults opposite ---
    const fa = E('Fate Calibration α', 975, 990);
    if (fa) {
      const cs = castOf(fa, 22), tR = T('Obloquy, Solidarity and 3x Severity', fa.t, fa.t + 15, 992.8), tSac = T('Sacrament x3', fa.t, fa.t + 15, 993.8);
      const CL = [-67.5, -22.5, 22.5, 67.5].map(d => r2(at(d, 23.5)));
      const safe = pick([1, 2]), dir = at([-67.5, -22.5, 22.5, 67.5][safe], 1);
      const sh = shuffle(S), def = sh[0], ss = sh[1], aa = sh.slice(2, 5), none = sh.slice(5);
      const orthoL = [-dir[1], dir[0]], orthoR = [dir[1], -dir[0]];
      for (const s of aa) debuff(s, 'aggravatedAssault', 'Aggravated Assault', 'take no other hits: right of the party', cs + 12, tR);
      debuff(ss, 'sharedSentence', 'Shared Sentence', 'the stack, left', cs + 12, tR);
      debuff(def, null, 'Defamation', 'out in front of the safe clone', cs + 12, tR);
      const back = mul(dir, -17.6);
      pref(cs + 12.5, Object.assign({ [def]: r2(mul(dir, 17.6)) }, clump(aa, add(back, mul(orthoR, 3.6)), { sep: 0.6 }), clump([ss].concat(none), add(back, mul(orthoL, 3.6)), { sep: 0.6 })));
      spreads(tR, [def], 30, 'Plaint of Obloquy', { tell: cs + 13, own: 0.4 });
      stack(tR, [ss], 4, 3, 'Plaint of Solidarity', { tell: cs + 13, dmg: 0.4 });
      CL.forEach((c, i) => {
        if (i === safe) return;
        hz({ t: tSac, tell: cs + 14, shape: 'cross', at: c, deg: brg(mul(c, -1)), len: 60, w: 16, dmg: 1.5, name: 'Sacrament' });
      });
      const om = EA('Ordained Motion/Stillness', fa.t, fa.t + 15);
      om.forEach((e, k) => { const m = Math.random() < 0.5; label(e, m ? 'Ordained Motion' : 'Ordained Stillness'); call(e.t - 3, m ? 'Ordained Motion: keep moving' : 'Ordained Stillness: stop', { alert: true, dur: 3 }); });
      label(E('Fate Calibration α', 975, 990), `Fate Calibration α (safe clone ${safe === 1 ? 'north-west' : 'north-east'})`);
      call(cs + 12.5, `Safe clone ${safe === 1 ? 'left' : 'right'} of north: ${def} defamation in front; stack left, Aggravated Assaults right, opposite`, { alert: true, dur: 7 });
      pref(tSac + 0.3, UP4);
    }
    // --- Ordained Capital Punishment (three hits the tanks share) and Ordained Punishment (a solo buster) ---
    for (const ocp of events.filter(e => e.name === 'Ordained Capital Punishment')) {
      const hits = [1, 2, 3].map(k => E(`Ordained Capital Punishment ${k}`, ocp.t, ocp.t + 8)).filter(Boolean), op = E('Ordained Punishment', ocp.t, ocp.t + 12);
      pref(castOf(ocp, 3) - 0.5, { MT: [-0.8, 12.6], OT: [0.8, 12.6] });
      hits.forEach(h => stack(h.t, ['MT'], 4, 2, 'Ordained Capital Punishment', { tell: castOf(ocp, 3), max: 2, dmg: 0.5 }));
      if (op) {
        pref(hits.length ? hits[hits.length - 1].t + 0.2 : op.t - 4, { MT: [-6, 10.8], OT: [0, 12.6] });
        buster(op.t, ['OT'], 5, 'Ordained Punishment', { tell: castOf(op, 5) });
        pref(op.t + 0.2, UP4);
      }
      call(castOf(ocp, 3), 'Ordained Capital Punishment: tanks share x3, then the off tank alone', { dur: 5 });
    }
    // --- Fate Calibration beta: light and dark; the stack on a light player (north), the Restraining Order between a
    // light and a dark player, the J Jumps on the two dark players at the south walls, Optical Sight, then Radiant
    // Sacrament's donut round a clone (east, south or west): in by it ---
    const fb = E('Fate Calibration β', 1065, 1075);
    if (fb) {
      const cs = castOf(fb, 35), sh = shuffle(S), light = sh.slice(0, 4), dark = sh.slice(4);
      const tS = T('Surety and Solidarity', fb.t, fb.t + 15, 1081.5), tJ = T('J Jump', fb.t, fb.t + 15, 1082.5);
      const tO = T('Individual/Collective Reprobation', fb.t, fb.t + 22, 1088.6), tR = T('Radiant Sacrament', fb.t, fb.t + 28, 1093.5);
      for (const s of light) debuff(s, null, 'Light', 'north', cs + 10, tR);
      for (const s of dark) debuff(s, null, 'Dark', dark.indexOf(s) < 2 ? 'the J Jump: the south wall' : 'the middle', cs + 10, tR);
      const ssT = light[0], roL = light[1], roDk = dark[0], jumpers = [dark[0], dark[1]];
      debuff(ssT, 'sharedSentence', 'Shared Sentence', 'the light stack, north', cs + 10, tS);
      debuff(roL, 'restrainingOrder', 'Restraining Order', `30 from ${roDk}`, cs + 10, tS);
      debuff(roDk, 'restrainingOrder', 'Restraining Order', `30 from ${roL}`, cs + 10, tS);
      const LIGHT = [0, 14.2], JW = [[-12, -14.8], [12, -14.8]], MID = [0, 0];
      pref(cs + 10.5, Object.assign(clump(light, LIGHT, { sep: 0.6 }), assign(jumpers, JW), clump(dark.slice(2), MID, { sep: 0.8 })));
      stack(tS, [ssT], 4, 3, 'Plaint of Solidarity', { tell: cs + 11, dmg: 0.4 });
      hz({ t: tS, tell: cs + 11, targets: [roL], tether: roDk, stretch: 30, dmg: 0, fail: 0.9, name: 'Restraining Order' });
      spreads(tJ, jumpers, 10, 'J Jump', { tell: cs + 11, own: 0.4 });
      const stk = Math.random() < 0.5;
      if (stk) {
        pref(tJ + 0.2, Object.assign(clump(light, LIGHT, { sep: 0.6 }), clump(dark, [0, -1], { sep: 0.6 })));
        stack(tO, [light[0], dark[2]], 6, 4, 'Collective Reprobation', { tell: tJ, max: 4 });
      } else {
        const lp = fan(0, 14.6, 4, 28), dp = [[-4.2, -2], [4.2, -2], [-9.5, -9], [9.5, -9]];
        pref(tJ + 0.2, Object.assign(assign(light, lp), assign(dark.slice(2).concat(jumpers), dp)));
        spreads(tO, S, 6, 'Individual Reprobation', { tell: tJ });
      }
      label(E('Optical Sight 1', fb.t, fb.t + 20), stk ? 'Optical Sight (stacks)' : 'Optical Sight (spread)');
      const cdir = pick([90, 180, 270]), clone = r2(at(cdir, 13));
      hz({ t: tR, tell: tO, shape: 'donut', at: clone, r0: 8, dmg: 1.5, name: 'Radiant Sacrament', react: 4 });
      pref(tO + 0.2, clump(S, clone, { sep: 0.8 }));
      label(E('Radiant Sacrament', fb.t, fb.t + 28), `Radiant Sacrament (in by the ${dirName(cdir)} clone)`);
      call(cs + 10.5, `Light north (${ssT}'s stack); ${jumpers.join(' and ')} bait the J Jumps at the south walls`, { alert: true, dur: 7 });
      call(tO, `Radiant Sacrament: in by the ${dirName(cdir)} clone`, { alert: true, dur: 4 });
      pref(tR + 0.3, UP4);
    }
    // --- Almighty Judgment: the trines (a 3 x 3 grid of 6-yalm circles, 10 apart; each set all but one, the safe one
    // moving a step, never diagonally), then Irresistible Grace (everyone in one stack) ---
    for (const aj of events.filter(e => e.name === 'Almighty Judgment')) {
      const sets = [1, 2, 3].map(k => E(`Almighty Judgment ${k}`, aj.t, aj.t + 20)).filter(Boolean), ig = E('Irresistible Grace', aj.t, aj.t + 22);
      if (sets.length < 3) continue;
      const cell = (i, j) => [i * 10, j * 10];
      let c = [pick([-1, 1]), pick([-1, 1])];
      const path = [c];
      for (let k = 1; k < 3; k++) { const opts = [[c[0] + 1, c[1]], [c[0] - 1, c[1]], [c[0], c[1] + 1], [c[0], c[1] - 1]].filter(q => Math.abs(q[0]) <= 1 && Math.abs(q[1]) <= 1); c = pick(opts); path.push(c); }
      sets.forEach((e, k) => {
        for (let i = -1; i <= 1; i++) for (let j = -1; j <= 1; j++) {
          if (i === path[k][0] && j === path[k][1]) continue;
          hz({ t: e.t, tell: aj.t + 4.6, shape: 'circle', at: cell(i, j), r: 6, dmg: 1.3, name: 'Almighty Judgment', react: 1.8 });
        }
        pref(k ? sets[k - 1].t + 0.05 : aj.t + 4, clump(S, cell(...path[k]), { sep: 0.6 }));
      });
      if (ig) { const tgt = pick(S); stack(ig.t, [tgt], 6, 8, 'Irresistible Grace', { tell: castOf(ig, 5), dmg: 0.35 }); }
      call(aj.t + 4.6, `Trines: start ${dirName(brg(cell(...path[0])))}, then step as each goes off`, { alert: true, dur: 6 });
      pref((ig || sets[2]).t + 0.2, UP4);
    }
    // --- Temporal Interference and Temporal Prison: the prisons, north-east and clockwise, the healers first ---
    const ti = E('Temporal Interference', 1195, 1210);
    if (ti) {
      const prisonOrder = ['H1', 'H2', 'MT', 'OT', 'M1', 'M2', 'R1'];
      for (let k = 1; k <= 7; k++) {
        const e = E(`${8 - k} Players Remaining`, ti.t, ti.t + 50);
        if (!e) continue;
        const s = prisonOrder[k - 1];
        pref(e.t - 4, { [s]: r2(at(45 + 45 * (k - 1), 16)) });
        debuff(s, 'temporalPrison', 'Temporal Prison', 'in your prison', e.t, 1260);
        call(e.t - 4, 'Temporal Prison: your turn', { slot: s, alert: true, dur: 4 });
      }
      call(ti.t, 'Temporal Prison: one at a time, north-east and clockwise (healers, tanks, DPS)', { dur: 6 });
      label(E('Temporal Prison Enrage', 1240, 1250), 'Temporal Prison (the enrage)');
    }

    // ---------- the bosses ----------
    BJP.sort((a, b) => a.t - b.t); CCP.sort((a, b) => a.t - b.t); HANDP.sort((a, b) => a.t - b.t);
    P.others.push({ model: 'cc', path: CCP, shows: [[P2_START - 3, P2_END], [P2_END, 511.4], [inc ? inc.t + 2.5 : 540, 600.3], [wf ? wf.t + 2.5 : 632, 674.2], [705.6, 731.7]], face: ccFace.length ? 'OT' : 'party' });
    P.others.push({ model: 'bj', path: BJP, shows: [[P2_END, 511.4], [inc ? inc.t + 2.5 : 540, 600.3], [wf ? wf.t + 2.5 : 632, 674.2], [705.6, 771.9]] });
    P.boss.sort((a, b) => a.t - b.t);
    P.face.sort((a, b) => a.t - b.t);
    P.form.sort((a, b) => a.t - b.t);
    P.hitbox.sort((a, b) => a.t - b.t);
    P.debuffs = P.debuffs.filter(d => d.slot);
    return P;
  }

  B.FIGHT_SCRIPTS = B.FIGHT_SCRIPTS || {};
  // The HP: FFLogs' (a TEA kill on Dawntrail's servers, report TtJ1yLjw9WG4Rh8V) is level 80's: Living Liquid and the
  // Liquid Hand 3,356,051 each, Brute Justice and Cruise Chaser 2,168,926 each, Alexander Prime 3,180,181, the
  // revived Brute Justice and Cruise Chaser 433,785 each, Perfect Alexander 7,535,109. The sim's party deals
  // Dawntrail savage damage, so each phase's pool is the party's damage over the time a typical kill takes (its
  // pushes about where real kills push them): phase 1 by 118 s, phase 2 by 390 s, Alexander Prime to about 15% by
  // Summon Alexander, the adds in 20 s each, Perfect Alexander during Temporal Prison.
  const DPS_SIM = 192500;
  const LL = 13760000, HAND = 8950000, P2HP = 30000000, AP = 21100000, AP_MAIN = 17900000, CCADD = 3850000, BJADD = 3850000, PA = 56100000;
  B.FIGHT_SCRIPTS.tea = {
    hp: LL + P2HP + AP_MAIN + PA,
    // The Hand beside Living Liquid (half the party's damage), the adds of the DPS check (all of it, the boss away).
    adds: [
      { from: 706.8, to: 731.7, hp: CCADD, share: 1, whileAway: true, name: 'Cruise Chaser' },
      { from: 731.7, to: 771.9, hp: BJADD + AP - AP_MAIN, share: 1, whileAway: true, name: 'Brute Justice and Alexander Prime' },
      { from: 24.5, to: P1_END, hp: HAND, share: 0.5, name: 'Liquid Hand' },
    ],
    pushes: [
      { from: 0, to: P1_END, dealt: LL, name: 'Living Liquid is down' },
      { from: 142.1, to: P1_END, dealt: 0, name: 'Phase 1 over' },
      { from: 229.1, to: P2_END, dealt: LL + P2HP, name: 'Brute Justice and Cruise Chaser are down' },
      { from: 423.7, to: P2_END, dealt: 0, name: 'Phase 2 over' },
      { from: 706.8, to: 731.7, adds: 0, name: 'Cruise Chaser is down' },
      { from: 731.7, to: 771.9, adds: 1, name: 'Brute Justice and Alexander Prime are down' },
      { from: P4_FROM, to: P4_TO, dealt: 0, name: 'Perfect Alexander' },
    ],
    defaultStrat: 'naur',
    strats: {
      naur: { label: 'NAUR/Elinabin (NA)' },
    },
    source: 'wtfdig.info ultimates/tea; mechanics after BossMod (github.com/awgil/ffxiv_bossmod) and cactbot',
    // A north, B east, C south, D west; 1-4 the intercards (1 north-east, then clockwise).
    waymarks: [
      { label: 'A', at: [0, 14], color: 'red' }, { label: 'B', at: [14, 0], color: 'yellow' },
      { label: 'C', at: [0, -14], color: 'blue' }, { label: 'D', at: [-14, 0], color: 'purple' },
      { label: '1', at: [10, 10], color: 'red', square: true }, { label: '2', at: [10, -10], color: 'yellow', square: true },
      { label: '3', at: [-10, -10], color: 'blue', square: true }, { label: '4', at: [-10, 10], color: 'purple', square: true },
    ],
    plan,
  };
  void DPS_SIM;
})(window.BLM);
