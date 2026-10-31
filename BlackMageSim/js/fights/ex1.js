// EX1, Worqor Lar Dor (Extreme): Valigarmanda's mechanics for the sim's party, on cactbot's timeline, and the strat
// wtfdig.info lists for the fight: Hector (NA, its only one). Spots are [east, north] yalms from the arena's middle.
//
// The arena is BossMod's: a 40 x 30 rectangle (Ex1Valigarmanda, ArenaBoundsRect(20, 15)), Valigarmanda (R20) perched
// over its north edge at [0, 15] (FFLogs: it never moves from there). cactbot's timeline puts the opening, the fire
// phase and the adds at 0-235 s, Tulidisaster at 1000 s, the storm phase at 2000 s, the ice phase at 3000 s and the
// last phase at 4000 s; the game plays storm and ice in either order (BossMod's fork), so each pull picks one and the
// script swaps the two blocks' seconds to match. The script's `pushes` are the gaps: killing the beacons (or their
// time running out) goes on to Tulidisaster, and each phase on to the next.
//
// The mechanics follow BossMod's module (github.com/awgil/ffxiv_bossmod, Ex1Valigarmanda), whose shapes and sizes come
// from the game's Action sheet, with where things land from FFLogs kills (the boulders, the stars, the cones), built
// with the sim's toolkit (js/mech.js):
//   - Spikesicle: ten curved lines, 1.2 s apart (donuts 20-25 ... 35-40 round [+-20, 15], then a 5-wide line 17 out),
//     the first from one side, the other side's four, a line, the rest of the first side's, the last line; each leaves
//     an ice boulder that bursts (13 yalms) 6.7 s later (the logs' spots). Hector: hug the middle of the wall on the
//     second curve's side, step off it before the last line, then the middle. The ice phase's comes with an avalanche.
//   - Skyruin, Triscourge, Disaster Zone, Ruin Foretold, Tulidisaster, Wrath Unfurled: raidwides; the elements change
//     the arena's look (fire: the floating slab; storm: the tiles; ice: snow), Disaster Zone brings the mountain back.
//   - Volcanic Drop: the volcano east or west (a 20-yalm circle 13 out, erupting five times), and three waves of
//     2-yalm puddles on three players each.
//   - Strangling Coil / Slithering Strike / Susurrant Breath: an 8-30 donut, a 24-yalm half circle from the boss, or a
//     40-degree cone from it; then partner stacks (fire), 6-yalm puddles under everyone (storm), an avalanche or the
//     stars (ice).
//   - Calamity's Chill / Freezing Dust: keep moving for 2 s (the guide walks you; standing still is a hit).
//   - Mountain Fire: six 3-yalm tank towers in front of the boss, the tanks alternating, each with a 330-degree cone
//     from the tower away from where the boss leans (north first, then left or right): the party hides in the 30-degree
//     wedge behind the tank.
//   - Scourge of Fire: two light party stacks hit three times, each hit leaving a 6-yalm fire puddle (walk north);
//     the storm phase's hit once, the ice phase's are 3-man stacks with the tanks' 16-yalm defamations.
//   - Scourge of Thunder: 5-yalm spreads (fire: everyone; ice: one role); storm: 8-yalm spreads, lightning on a
//     ground tile, ice on an elevated one.
//   - Calamitous Cry (the adds): the three beacons, two line stacks (wild charges, the tank in front) every 6 s between
//     five 20-degree cones from the boss in one of two patterns (the logs'), alternating.
//   - Hail of Feathers: six feathers round the ground tiles from one side (proximity damage), the first killed;
//     Blighted Bolt bursts the other five (8 yalms).
//   - Thunderous Breath: five 5-wide lines across the arena (one lane safe) and the breath on every ground tile.
//   - Ruinfall: a two-tank 6-yalm tower, a 25-yalm knockback (the strat: everyone uses Arm's Length / Surecast) and
//     6-yalm puddles along the south edge.
//   - Northern Cross: an avalanche over the north-east or south-west half. Chilling Cataclysm: five stars of 5-wide
//     lines (eight ways each), at the logs' spots (or their mirror): a thin diagonal safe in one north corner.
//   - Ice Talon: 6-yalm tank busters on both tanks.
// Simplified: levitation is where you stand (the storm phase's elevated tiles float you); the beacons only soak the
// party's damage (killing them moves the fight on; if they outlast the loop the fight moves on anyway, where the game
// would wipe); the Volcanic Drop puddles' targets, the Ruinfall puddles' spots and its knockback's direction (north,
// as wtfdig's arrows) are guesses, and the knockback stops at the arena's edge; the ice phase's Spikesicle avalanche is
// paired with the safe wall (the one log has it so). Where wtfdig gives no diagram (Crackling Cataclysm's exits,
// Freezing Dust's walk), the spots are this script's own.
(function (B) {
  const S = B.SLOTS;
  const at = B.bearing;
  const inside = B.mechInside;
  const add = (a, b) => [a[0] + b[0], a[1] + b[1]];
  const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);
  const deg360 = (d) => ((d % 360) + 360) % 360;
  const pick = (a) => a[Math.floor(Math.random() * a.length)];
  const shuffle = (a) => { const b = a.slice(); for (let i = b.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [b[i], b[j]] = [b[j], b[i]]; } return b; };
  const r2 = (p) => [+p[0].toFixed(2), +p[1].toFixed(2)];
  const mirror = (p) => [-p[0], p[1]];
  const assign = (slots, pts) => Object.fromEntries(slots.map((s, i) => [s, pts[i]]));
  const G1 = ['MT', 'H1', 'M1', 'R1'], G2 = ['OT', 'H2', 'M2', 'R2'];
  const SUP = ['MT', 'OT', 'H1', 'H2'], DPS = ['M1', 'M2', 'R1', 'R2'], TANKS = ['MT', 'OT'];
  const PARTNER = { MT: 'M1', OT: 'M2', H1: 'R1', H2: 'R2' };
  const BOSS = [0, 15];
  const COMPASS = ['north', 'north-northeast', 'northeast', 'east-northeast', 'east', 'east-southeast', 'southeast', 'south-southeast',
    'south', 'south-southwest', 'southwest', 'west-southwest', 'west', 'west-northwest', 'northwest', 'north-northwest'];
  const dirName = (deg) => COMPASS[Math.round(deg360(deg) / 22.5) % 16];
  const onFloor = (p, m) => Math.abs(p[0]) < 20 - m && Math.abs(p[1]) < 15 - m;

  // ---------- placing the party ----------
  // Each [slot, want, sep] in turn: the nearest point to `want` on the floor, clear of the shapes in `avoid` (by m
  // yalms, 1.3 by default) and at least sep from those already placed.
  function place(list, o) {
    o = o || {};
    const m = o.m === undefined ? 1.3 : o.m, avoid = o.avoid || [], floor = o.floor || ((p) => onFloor(p, 0.9)), done = [];
    const out = {};
    for (const [s, want, sp] of list) {
      const sep = sp === undefined ? 0.6 : sp;
      const ok = (p) => floor(p) && avoid.every(h => !inside(h, p, m)) && done.every(d => dist(d, p) >= sep);
      let best = ok(want) ? want.slice() : null;
      for (let r = 0.15; !best && r <= 25; r += 0.15) {
        const n = Math.max(8, Math.round(2 * Math.PI * r / 0.2));
        for (let k = 0; k < n; k++) {
          const a = k / n * 2 * Math.PI, p = [want[0] + Math.sin(a) * r, want[1] + Math.cos(a) * r];
          if (ok(p)) { best = p; break; }
        }
      }
      out[s] = r2(best || want);
      done.push(out[s]);
    }
    return out;
  }
  const clumpAt = (slots, c, o) => place(slots.map(s => [s, c, 0.5]), o);
  // A spot that walks from a to b between seconds t0 and t1 (a function of the second, as prefs take).
  const walker = (a, b, t0, t1) => (t) => {
    const k = Math.max(0, Math.min(1, (t - t0) / (t1 - t0)));
    return [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k];
  };

  // ---------- the party's places ----------
  // Light parties (wtfdig's setup): west and east of the middle, south of the boss's hitbox.
  const HOME = { MT: [-4.4, -4.2], M1: [-5.6, -5.4], R1: [-3.2, -5.4], H1: [-4.4, -6.6], OT: [4.4, -4.2], M2: [3.2, -5.4], R2: [5.6, -5.4], H2: [4.4, -6.6] };
  // Partners for each stance (wtfdig's: tank + melee, healer + ranged): the donut's middle, out of the half circle,
  // or the corners out of the cone.
  const PAIRS = {
    coil: { MT: [-4, 2.5], OT: [4, 2.5], H1: [-4, -4.5], H2: [4, -4.5] },
    strike: { MT: [-5.5, -10.5], OT: [5.5, -10.5], H1: [-16, -7], H2: [16, -7] },
    breath: { MT: [-13, 13.6], OT: [13, 13.6], H1: [-18.4, 7.8], H2: [18.4, 7.8] },
  };
  const STANCE = {
    coil: { name: 'Strangling Coil', what: 'Donut (In)', shape: { shape: 'donut', at: [0, 0], r0: 8, r1: 30 } },
    strike: { name: 'Slithering Strike', what: 'Out of Melee', shape: { shape: 'cone', at: BOSS, deg: 180, half: 90, r: 24 } },
    breath: { name: 'Susurrant Breath', what: 'Front Corner', shape: { shape: 'cone', at: BOSS, deg: 180, half: 40, r: 50 } },
  };
  // Scourge of Thunder (fire): everyone spreads (wtfdig's diagram).
  const SPREAD5 = { MT: [-16, 11.6], M1: [-5, 11.6], M2: [5, 11.6], OT: [16, 11.6], R1: [-16.6, -0.5], H1: [-4.8, -0.6], H2: [4.8, -0.6], R2: [16.6, -0.5] };
  // Scourge of Thunder (ice): the role with the spreads inside, the other at the sides (wtfdig's diagram).
  const ICE_SPREAD = [[-6, 12.5], [6, 12.5], [-6, -2], [6, -2]], ICE_SIDE = [[-17.5, 7.5], [17.5, 7.5], [-17.5, 1.5], [17.5, 1.5]];
  // The storm phase's tiles (BossMod's ThunderPlatform): 10 x 10, the elevated ones (they float you) outer in the
  // north and south rows, inner in the middle row; the rest ground.
  const GROUND = { nw: [-5, 10], ne: [5, 10], mw: [-15, 0], me: [15, 0], sw: [-5, -10], se: [5, -10] };
  const FLOAT = { nw: [-15, 10], ne: [15, 10], mw: [-5, 0], me: [5, 0], sw: [-15, -10], se: [15, -10] };
  const tileRect = (c) => ({ shape: 'rect', a: [c[0] - 5, c[1] - 5], b: [c[0] + 5, c[1] + 5] });
  // Who stands on which tile for Scourge of Thunder (8-yalm spreads, each player on a tile of their own): one role on
  // ground tiles (lightning), the other floating (ice), then the other way round.
  const TILES_A = { MT: GROUND.nw, OT: GROUND.ne, H1: GROUND.sw, H2: GROUND.se, M1: FLOAT.mw, M2: FLOAT.me, R1: FLOAT.sw, R2: FLOAT.se };
  const TILES_B = { MT: FLOAT.nw, OT: FLOAT.ne, H1: FLOAT.mw, H2: FLOAT.me, M1: GROUND.mw, M2: GROUND.me, R1: GROUND.sw, R2: GROUND.se };
  // Spikesicle's boulders, one per curve in order, when the first curve is east (the logs'; mirrored for west).
  const BOULDERS = [[-2.5, 12.5], [2.5, 12.5], [7.5, 12.5], [12.5, 12.5], [5, -12.5], [17.5, 0], [-7.5, 12.5], [-12.5, 12.5], [-5, -12.5], [-17.5, 0]];
  // Chilling Cataclysm's spheres (the logs', both times; or their mirror): the north-most west, so the north-east
  // corner's thin diagonal is safe.
  const STARS = [[-7.5, 12.5], [17.5, 2.5], [-12.5, -2.5], [-2.5, -7.5], [-17.5, -12.5]];
  // Calamitous Echo's two patterns of cones (the logs'; each the other's mirror), and the gaps the light parties' line
  // stacks take in each (G1 west, G2 east).
  const ECHO = { A: [119.4, 154.4, 189.3, 224.8, 259.8], B: [99.3, 134.3, 169.8, 204.8, 239.7] };
  const ECHO_GAP = { A: { G1: 242.3, G2: 136.9 }, B: { G1: 222.3, G2: 116.8 } };
  // Mountain Fire: where the boss leans, which way its cone points (from the tower), the wedge left behind it.
  const LEAN = { N: { cone: 0, wedge: 180, boss: [0, 15], call: 'Middle Wedge Safe' },
    NW: { cone: 315, wedge: 135, boss: [-6, 14], call: 'Right Wedge Safe =>' },
    NE: { cone: 45, wedge: 225, boss: [6, 14], call: '<= Left Wedge Safe' } };
  const TOWER = [0, 10];
  const AVALANCHE = { NE: { dir: [0.6, 0.8], safe: 'Back/Left', name: 'north-east' }, SW: { dir: [-0.6, -0.8], safe: 'Front/Right', name: 'south-west' } };

  // ---------- the timeline ----------
  // cactbot's blocks: storm at 2000 s, ice at 3000 s. The game picks the order; this pull's is made so by swapping the
  // blocks' seconds (each event keeps its own `t0`), and the stand-ins cactbot lists after Tulidisaster are dropped.
  function reorder(events) {
    for (const e of events) if (e.t0 === undefined) e.t0 = e.t;
    for (let i = events.length - 1; i >= 0; i--) if (events[i].t0 > 1030 && events[i].t0 < 1100) events.splice(i, 1);
    const stormFirst = Math.random() < 0.5;
    for (const e of events) {
      if (e.t0 >= 2000 && e.t0 < 3000) e.t = stormFirst ? e.t0 : e.t0 + 1000;
      else if (e.t0 >= 3000 && e.t0 < 4000) e.t = stormFirst ? e.t0 : e.t0 - 1000;
      else e.t = e.t0;
    }
    events.sort((a, b) => a.t - b.t);
    return stormFirst;
  }

  // ---------- the pull ----------
  function plan(events) {
    const stormFirst = reorder(events), S0 = stormFirst ? 2000 : 3000, I0 = stormFirst ? 3000 : 2000;
    const P = { start: Object.assign({}, HOME), prefs: [], hazards: [], checks: [], calls: [], marks: [], labels: new Map(), debuffs: [],
      boss: [{ t: 0, at: BOSS }], hitbox: [{ t: 0, r: 20 }], arena: [{ t: 0, shape: 'rect', a: [-20, -15], b: [20, 15] }], looks: [] };
    let id = 0;
    const hz = (o) => { const h = Object.assign({ id: ++id, react: 3 }, o); P.hazards.push(h); return h; };
    const pref = (t, spots) => P.prefs.push({ t: +t.toFixed(2), spots });
    const call = (t, text, o) => P.calls.push(Object.assign({ t, text, dur: 5 }, o));
    const check = (o) => P.checks.push(o);
    const debuff = (slot, key, name, hint, t0, t1) => P.debuffs.push({ slot, key, name, hint, t0, t1 });
    const E = (name, t0, t1) => events.find(e => e.name === name && e.t >= t0 && e.t <= t1) || null;
    const EA = (name, t0, t1) => events.filter(e => e.name === name && e.t >= t0 && e.t <= t1);
    const tOf = (e, d) => (e ? e.t : d);
    const raid = (ev, dmg, tell, name, text) => {
      if (!ev) return;
      hz({ t: ev.t, tell, raidwide: true, dmg, name: name || ev.name });
      call(tell, text || 'Raidwide', { dur: 3 });
    };
    const look = (t, show) => P.looks.push({ t, show });
    const A1 = ['a1'], FIRE = ['a5', 'a1_plr', 'a1_rck', 'a1_all'], STORM = ['a4', 'a5_flr02', 'a1_plr', 'a1_rck', 'a1_all'], ICE = ['a3', 'a1_all'];
    look(0, A1);
    // Keep moving (Calamity's Chill, Freezing Dust): everyone walks a line through the 2 s; you, following the guide,
    // must keep up with your walking spot (standing still freezes you).
    const keepMoving = (t0, t1, from, to, name, tFrom) => {
      const ws = Object.fromEntries(S.map(s => [s, walker(from[s], to[s], t0 - 0.2, t1 + 0.2)]));
      pref(tFrom, from);
      pref(t0 - 0.2, ws);
      for (let tt = t0 + 0.2; tt < t1 - 0.05; tt += 0.4) for (const s of S) check({ t: +tt.toFixed(2), kind: 'spot', slots: [s], spots: { [s]: ws[s](tt) }, r: 2.2, fail: 0.9, name });
      call(t0 - 1.5, 'Move around (keep moving)', { alert: true, dur: 4 });
    };
    const LINE_X = { R1: -15, H1: -11, M1: -7, MT: -3, OT: 3, M2: 7, H2: 11, R2: 15 };

    // ===== raidwides =====
    for (const ev of events) {
      const n = ev.name;
      if (/^Skyruin \(/.test(n)) {
        raid(ev, 0.45, ev.t - 10.5, 'Skyruin', 'Raidwide (bleed)');
        const el = /fire/.test(n) ? 'fire' : /storm/.test(n) ? 'storm' : 'ice';
        look(ev.t - 5.4, el === 'fire' ? FIRE : el === 'storm' ? STORM : ICE);          // as the boss's cast ends
        P.labels.set(ev, `Skyruin (the ${el} phase)`);
      } else if (n === 'Triscourge') raid(ev, 0.35, ev.t - 3);
      else if (n === 'Disaster Zone') { raid(ev, 0.5, ev.t - 3.8, 'Disaster Zone', 'Big raidwide'); look(ev.t, A1); P.labels.set(ev, 'Disaster Zone (the phase ends)'); }
      else if (n === 'Ruin Foretold') raid(ev, 0.4, ev.t - 5);
      else if (/^Tulidisaster \d$/.test(n)) raid(ev, n.endsWith('3') ? 0.45 : 0.35, ev.t - 5, 'Tulidisaster');
      else if (n === 'Wrath Unfurled' && ev.cast > 5) raid(ev, 0.55, ev.t - 7.3);
      else if (n === 'Wrath Unfurled') P.labels.set(ev, 'Wrath Unfurled (cast)');
      else if (n === 'Tulidisaster' && ev.kind === 'enrage') P.labels.set(ev, 'Tulidisaster (enrage)');
      else if (n === 'Tulidisaster' && ev.t > 3500) {
        if (ev.cast) P.labels.set(ev, 'Tulidisaster (cast: the enrage sequence)');
        else raid(ev, 0.4, ev.t - 5, 'Tulidisaster');
      } else if (n === 'Tulidisaster') P.labels.set(ev, 'Tulidisaster (cast: three raidwides)');
    }

    // ===== Spikesicle =====
    // The ten curves (the first from side s's centre), their boulders, and (ice) the avalanche over the half away from
    // the safe wall. Hector: the middle of the safe wall, off it before the last line, then just north of the middle.
    const spikesicle = (ev, avalanche) => {
      const T = ev.t, s = pick([1, -1]), W = -s, tc = (k) => +(T + 1.3 + 1.2 * k).toFixed(2);
      const seq = [[1, s], [1, -s], [2, -s], [3, -s], [4, -s], [0, s], [2, s], [3, s], [4, s], [0, -s]];
      const shapes = seq.map(([n, side]) => (n ? { shape: 'donut', at: [20 * side, 15], r0: 15 + 5 * n, r1: 20 + 5 * n }
        : { shape: 'rect', a: [17 * side - 2.5, 15], b: [17 * side + 2.5, -25] }));
      const bs = BOULDERS.map(b => (s > 0 ? b : mirror(b)));
      shapes.forEach((sh, k) => {
        hz(Object.assign({ t: tc(k), tell: k < 2 ? T - 8 : +(tc(k) - 3.6).toFixed(2), dmg: 1.1, name: 'Spikesicle', react: 2.4 }, sh));
        hz({ t: +(tc(k) + 6.7).toFixed(2), tell: +(tc(k) + 3.1).toFixed(2), shape: 'circle', at: bs[k], r: 13, dmg: 1.1, name: 'Sphere Shatter', react: 2.4 });
      });
      const sp = E('Sphere Shatter x10', T, T + 12);
      if (sp) P.labels.set(sp, 'Sphere Shatter x10 (the boulders burst in order)');
      const side = W < 0 ? 'west' : 'east';
      P.labels.set(ev, `Spikesicle (${s > 0 ? 'east' : 'west'} first: the ${side} wall)`);
      // The wall's middle: inside the near curves' ring, past the far ones'.
      const wall = place(S.map(sl => [sl, [18.9 * W, 0], 0.4]), { m: 0, floor: (p) => onFloor(p, 0.6) && dist(p, [20 * s, 15]) > 41 && dist(p, [-20 * s, 15]) < 18.9 });
      pref(T - 9, wall);
      call(T - 9.5, W < 0 ? '<= Get Left/West (middle of the wall)' : 'Get Right/East => (middle of the wall)', { alert: true, dur: 6 });
      let tAva = null;
      if (avalanche) {
        tAva = +(tc(9) + 0.9).toFixed(2);
        const a = W < 0 ? 'NE' : 'SW';
        hz({ t: tAva, tell: T + 4, shape: 'half', dir: AVALANCHE[a].dir, dmg: 1.3, name: 'Northern Cross (avalanche)', react: 3 });
        const nc = E('Northern Cross', T - 1, T + 15);
        if (nc) P.labels.set(nc, `Northern Cross (the avalanche: the ${AVALANCHE[a].name} half)`);
        call(T + 5, W < 0 ? '<= Go Left (Dodge Avalanche)' : 'Go Right (Dodge Avalanche) =>', { alert: true, dur: 5 });
      }
      // Off the wall once the ninth curve is through (the last line runs down it), then the middle.
      const late = [6, 7, 8, 9].map(k => ({ shape: 'circle', at: bs[k], r: 13 }));
      pref(tc(8) + 0.05, clumpAt(S, [12 * W, -1], { m: 0.3, avoid: [shapes[9]] }));
      pref((tAva || tc(9)) + 0.05, place(S.map(sl => [sl, [1.5 * s, 0.6], 0.45]), { m: 0.3, avoid: late }));
      call(tc(8), 'Off the wall', { dur: 3 });
      call((tAva || tc(9)) + 0.1, 'Middle (dodge the boulders)', { dur: 4 });
      return tc(9) + 6.8;
    };

    // ===== the stances (cone / out / in) =====
    const stanceAt = (ev, kind) => {
      const k = STANCE[kind];
      hz(Object.assign({ t: ev.t, tell: ev.t - 7.3, dmg: 1.3, name: k.name }, k.shape));
      P.labels.set(ev, `${k.name} (${kind === 'coil' ? 'donut: in' : kind === 'strike' ? 'out from the boss' : 'front cone: the corners'})`);
    };
    const pairsFor = (kind) => {
      const out = {};
      for (const [s, c] of Object.entries(PAIRS[kind])) { out[s] = r2(add(c, [-0.35, 0.3])); out[PARTNER[s]] = r2(add(c, [0.35, -0.3])); }
      return out;
    };

    // ===== Volcanic Drop =====
    const volcanicDrop = (ev) => {
      const t = ev.t, v = pick([1, -1]), c = [13 * v, 0];
      hz({ t: +(t + 0.7).toFixed(2), tell: t - 7.2, shape: 'circle', at: c, r: 20, dmg: 1.3, lasts: 2.4, tick: 0.6, tickDmg: 1.3, name: 'Volcanic Drop', react: 4 });
      const grid = { MT: [11, 10], OT: [16.5, 10], M1: [11, 4], M2: [16.5, 4], R1: [11, -2.5], R2: [16.5, -2.5], H1: [11, -9], H2: [16.5, -9] };
      pref(t - 7.1, Object.fromEntries(S.map(s => [s, [-v * grid[s][0], grid[s][1]]])));
      [2.5, 3.6, 4.6].forEach((d) => {
        const tl = +(t + d).toFixed(2), who = shuffle(S).slice(0, 3);
        hz({ t: tl, tell: +(tl - 2.5).toFixed(2), shape: 'circle', from: 'target', targets: who, snap: 2.5, r: 2, dmg: 0.9, name: 'Volcanic Drop (puddle)' });
        for (const s of who) call(tl - 2.5, 'Puddle under you: move', { slot: s, dur: 2.5 });
      });
      P.labels.set(ev, `Volcanic Drop (the ${v < 0 ? 'west' : 'east'} volcano)`);
      call(t - 7.2, v > 0 ? '<= Get Left/West (east volcano)' : 'Get Right/East => (west volcano)', { alert: true, dur: 5 });
      return t + 4.8;
    };

    // ===== Mountain Fire =====
    const mountainFire = (cast) => {
      const hits = [1, 2, 3, 4, 5, 6].map(k => E(`Mountain Fire ${k}`, cast.t, cast.t + 40)).filter(Boolean);
      P.labels.set(cast, 'Mountain Fire (tank towers: soak and swap)');
      const lean = ['N'];
      for (let k = 1; k < hits.length; k++) {
        const cur = lean[k - 1];
        lean.push(cur === 'N' ? pick(['NW', 'NE']) : Math.random() < 0.85 ? (cur === 'NW' ? 'NE' : 'NW') : 'N');
      }
      for (const s of TANKS) call(cast.t - 4, 'Tank Tower (soak/swap)', { slot: s, dur: 6 });
      hits.forEach((ev, k) => {
        const L = LEAN[lean[k]], tk = ev.t, tank = k % 2 ? 'OT' : 'MT', other = k % 2 ? 'MT' : 'OT', tell = +(tk - 3.9).toFixed(2);
        hz({ t: +(tk - 0.4).toFixed(2), tell, effect: 'tower', shape: 'circle', at: TOWER, r: 3, soak: 1, only: [tank], dmg: 0.5, fail: 0.9, status: ['fireResDown', 20], name: 'Mountain Fire (tower)' });
        hz({ t: tk, tell, shape: 'cone', at: TOWER, deg: L.cone, half: 165, r: 40, r0: 3, dmg: 1.4, name: 'Mountain Fire', react: 3.5 });
        P.boss.push({ t: tell, at: L.boss, move: 0.8 });
        // The tank in the tower; everyone else in a line down the wedge behind it.
        const order = [other, 'M1', 'M2', 'R1', 'R2', 'H1', 'H2'], spots = { [tank]: TOWER.slice() };
        order.forEach((s, j) => { spots[s] = r2(add(TOWER, at(L.wedge, 4.6 + 0.8 * j))); });
        pref(k ? tell + 0.05 : cast.t - 3.9, spots);
        call(tell + 0.1, L.call, { alert: true, dur: 3.5 });
        call(tell + 0.1, 'Soak the tower', { slot: tank, alert: true, dur: 3.5 });
        P.labels.set(ev, `Mountain Fire ${k + 1} (${tank}'s tower; the ${dirName(L.wedge)} wedge)`);
      });
      const last = hits.length ? hits[hits.length - 1].t : cast.t + 32;
      P.boss.push({ t: last + 1.5, at: BOSS, move: 0.8 });
      return last + 0.5;
    };

    // ===== fire phase =====
    const spk1 = E('Spikesicle', 0, 60);
    if (spk1) pref(spikesicle(spk1, false), HOME);
    // Volcanic Drop, then the stance with partners, then Calamity's Chill (keep moving).
    const vd = EA('Volcanic Drop', 40, 200), stances = EA('Strangling Coil/Slithering Strike/Susurrant Breath', 0, 4200);
    const fireStance = (ev) => {
      const kind = pick(['coil', 'strike', 'breath']), role = pick([SUP, DPS]);
      stanceAt(ev, kind);
      const ch = E('Charring Cataclysm', ev.t, ev.t + 2), tp = tOf(ch, ev.t + 0.8);
      hz({ t: tp, tell: ev.t - 7.3, effect: 'share', shape: 'circle', from: 'target', targets: role, r: 4, min: 2, max: 2, dmg: 0.4, name: 'Charring Cataclysm' });
      if (ch) P.labels.set(ch, `Charring Cataclysm (partner stacks on the ${role === SUP ? 'supports' : 'DPS'})`);
      pref(ev.t - 7.2, pairsFor(kind));
      call(ev.t - 7.3, `${STANCE[kind].what} => Stack w/Partner`, { alert: true, dur: 7 });
      return tp;
    };
    if (vd[0]) volcanicDrop(vd[0]);
    const fs1 = stances.find(e => e.t > 60 && e.t < 100);
    if (fs1) {
      const tp = fireStance(fs1), t0 = tp + 7.7, t1 = t0 + 2;
      for (const s of S) debuff(s, 'calamitysChill', "Calamity's Chill", 'keep moving when it runs out', tp + 0.7, t0);
      keepMoving(t0, t1, Object.fromEntries(S.map(s => [s, [LINE_X[s], -9]])), Object.fromEntries(S.map(s => [s, [LINE_X[s], 0.5]])), "Calamity's Chill (stood still)", tp + 0.1);
      P.labels.set(fs1, P.labels.get(fs1) + ', then keep moving');
    }
    const mf1 = events.find(e => e.name === 'Mountain Fire' && e.kind === 'cast' && e.t < 300);
    if (mf1) pref(mountainFire(mf1), HOME);
    // Scourge of Fire: the healers' light party stacks, three hits, a fire puddle after each: walk north.
    const sof = [1, 2, 3].map(k => E(`Scourge of Fire ${k}`, 100, 200)).filter(Boolean);
    if (sof.length) {
      const t1 = sof[0].t, ic = t1 - 7.1, ys = [-9.5, -2, 5.5, 13];
      for (const h of ['H1', 'H2']) debuff(h, 'calamitysInferno', "Calamity's Inferno", 'light party stack, three hits', ic, sof[sof.length - 1].t);
      sof.forEach((ev, k) => {
        hz({ t: ev.t, tell: k ? sof[k - 1].t : ic, effect: 'share', shape: 'circle', from: 'target', targets: ['H1', 'H2'], r: 5, min: 4, max: 4, dmg: 0.3, name: 'Scourge of Fire' });
        for (const h of ['H1', 'H2']) {
          hz({ t: +(ev.t + 1.5).toFixed(2), tell: ev.t, shape: 'circle', from: h, snap: 1.5, r: 6, dmg: 0.3, lasts: Math.max(1, 148.6 - ev.t - 1.5), tick: 1, tickDmg: 0.3, name: 'Scourge of Fire (fire puddle)' });
        }
        pref(k ? sof[k - 1].t + 0.05 : ic, Object.assign(clumpAt(G1, [-4.5, ys[k]], { m: 0 }), clumpAt(G2, [4.5, ys[k]], { m: 0 })));
      });
      pref(sof[sof.length - 1].t + 0.05, Object.assign(clumpAt(G1, [-4.5, ys[3]], { m: 0 }), clumpAt(G2, [4.5, ys[3]], { m: 0 })));
      call(ic, 'Healer Groups: C/D, walk north after each hit', { alert: true, dur: 6 });
      call(sof[sof.length - 1].t + 0.1, 'Off the last puddle', { dur: 3 });
      // Calamity's Chill again: along the north edge, clear of the puddles.
      const t0 = sof[sof.length - 1].t + 8.8, ta = t0 - 7;
      for (const s of S) debuff(s, 'calamitysChill', "Calamity's Chill", 'keep moving when it runs out', ta, t0);
      const from = { MT: [-18.2, 13.4], H1: [-18.2, 12.2], M1: [-16.8, 13.4], R1: [-16.8, 12.2] };
      for (const s of G1) from[G2[G1.indexOf(s)]] = mirror(from[s]);
      const to = Object.fromEntries(S.map(s => [s, add(from[s], [from[s][0] < 0 ? 8.6 : -8.6, 0])]));
      keepMoving(t0, t0 + 2, from, to, "Calamity's Chill (stood still)", t0 - 6);
    }
    if (vd[1]) volcanicDrop(vd[1]);
    const fs2 = stances.find(e => e.t > 150 && e.t < 200);
    if (fs2) fireStance(fs2);
    const sot1 = E('Scourge of Thunder', 150, 200);
    if (sot1) {
      hz({ t: sot1.t, tell: sot1.t - 7.1, effect: 'bait', shape: 'circle', from: 'target', targets: S, r: 5, dmg: 0.9, own: 0.3, name: 'Scourge of Thunder' });
      for (const s of S) debuff(s, 'calamitysBolt', "Calamity's Bolt", 'spread', sot1.t - 7.1, sot1.t);
      pref(sot1.t - 7, SPREAD5);
      call(sot1.t - 6, 'Spread', { alert: true, dur: 5 });
      pref(sot1.t + 0.2, HOME);
      P.labels.set(sot1, 'Scourge of Thunder (spread)');
    }

    // ===== the beacons: Calamitous Cry =====
    const cries = EA('Calamitous Cry', 195, 300);
    let pat = pick(['A', 'B']);
    const crySpots = (p) => {
      const out = {};
      for (const [g, grp] of [['G1', G1], ['G2', G2]]) grp.forEach((s, j) => { out[s] = r2(add(BOSS, at(ECHO_GAP[p][g], 9.6 + 1.2 * j))); });
      return out;
    };
    cries.forEach((ev, k) => {
      const t = ev.t;
      for (const d of ECHO[pat]) hz({ t, tell: t - 5, shape: 'cone', at: BOSS, deg: d, half: 10, r: 40, dmg: 1.0, name: 'Calamitous Echo', react: 4 });
      const tg = [pick(G1), pick(G2)];
      hz({ t: t + 0.05, tell: t - 6, effect: 'share', shape: 'line', from: 'boss', aim: 'target', targets: tg, len: 45, w: 6, min: 4, max: 4, dmg: 0.3, name: 'Calamitous Cry' });
      pref(k ? cries[k - 1].t + 0.1 : 198.4, crySpots(pat));
      P.labels.set(ev, `Calamitous Cry (line stacks on ${tg.join(' and ')}; the ${pat === 'A' ? 'first' : 'second'} pattern of cones)`);
      for (const s of S) call(t - 6, TANKS.includes(s) ? 'Wild charge: be in front of your light party' : `Wild charge: line up behind your tank${tg.includes(s) ? ' (on YOU)' : ''}`, { slot: s, dur: 4 });
      pat = pat === 'A' ? 'B' : 'A';
    });
    if (cries.length) {
      call(198.5, 'Kill Adds + Healer Groups', { alert: true, dur: 5 });
      pref(cries[cries.length - 1].t + 0.2, HOME);
    }
    pref(990, HOME);

    // ===== storm phase =====
    const tri2 = E('Triscourge', S0, S0 + 30);
    if (tri2) {
      const tT = tri2.t, supThunderFirst = Math.random() < 0.5;
      const sots = EA('Scourge of Thunder', S0, S0 + 160);
      // Scourge of Fire (one hit): the healers' light party stacks at C and D, on ground tiles.
      const sf = E('Scourge of Fire', S0, S0 + 60);
      if (sf) {
        hz({ t: sf.t, tell: sf.t - 7.1, effect: 'share', shape: 'circle', from: 'target', targets: ['H1', 'H2'], r: 5, min: 4, max: 4, dmg: 0.3, name: 'Scourge of Fire' });
        for (const h of ['H1', 'H2']) debuff(h, 'calamitysFlames', "Calamity's Flames", 'light party stack', tT, sf.t);
        pref(sf.t - 7, Object.assign(clumpAt(G1, [-4.5, -7.5], { m: 0 }), clumpAt(G2, [4.5, -7.5], { m: 0 })));
        call(sf.t - 6, 'Healer Groups (stay on the ground)', { alert: true, dur: 5 });
      }
      // Each player's lightning and ice: one runs out at the first Scourge of Thunder, the other at the second.
      for (const s of S) {
        const thunderFirst = supThunderFirst === SUP.includes(s), t1 = tOf(sots[0], S0 + 79.9), t2 = tOf(sots[1], S0 + 119.9);
        debuff(s, 'calamitysFulgur', "Calamity's Fulgur", 'spread on a ground tile', tT, thunderFirst ? t1 : t2);
        debuff(s, 'calamitysFrost', "Calamity's Frost", 'spread on an elevated tile', tT, thunderFirst ? t2 : t1);
      }
      // Hail of Feathers: six feathers on the ground tiles from one side, round by the south.
      const hf = [1, 2, 3, 4, 5, 6].map(k => E(`Hail of Feathers ${k}`, S0, S0 + 80)).filter(Boolean);
      const f = pick([1, -1]);
      const FP = [[15 * f, 0], [5 * f, -10], [-5 * f, -10], [-15 * f, 0], [-5 * f, 10], [5 * f, 10]];
      if (hf.length === 6) {
        const t0 = hf[0].t - 6;
        hf.forEach((ev, k) => hz({ t: ev.t, tell: Math.max(t0, ev.t - 6), effect: 'hit', aimed: true, shape: 'circle', at: FP[k], r: 22, falloff: 22, dmg: 0.9, name: 'Hail of Feathers' }));
        P.labels.set(hf[0], `Hail of Feathers (from the ${f > 0 ? 'east' : 'west'}, round by the south)`);
        pref(t0, clumpAt(S, [-16.5 * f, 11.5], { m: 0 }));
        pref(hf[2].t + 0.05, clumpAt(S, [17 * f, -6], { m: 0 }));
        call(t0, f > 0 ? '<= Get Left/West (feathers from the east)' : 'Get Right/East => (feathers from the west)', { alert: true, dur: 5 });
        call(hf[0].t + 5, 'Kill Feather => Stand in safe tile', { dur: 6 });
        const bb = E('Blighted Bolt', hf[5].t, hf[5].t + 20);
        if (bb) {
          FP.slice(1).forEach(p => hz({ t: bb.t, tell: bb.t - 5.8, shape: 'circle', at: p, r: 8, dmg: 1.2, name: 'Blighted Bolt' }));
          pref(hf[5].t + 0.05, clumpAt(S, [15.6 * f, 0], { m: 0 }));
          P.labels.set(bb, 'Blighted Bolt (the five feathers left burst)');
        }
      }
      // Scourge of Thunder x2: everyone spreads (8), lightning on a ground tile, ice on an elevated one.
      sots.forEach((ev, k) => {
        const tiles = (k === 0) === supThunderFirst ? TILES_A : TILES_B;
        hz({ t: ev.t, tell: ev.t - 7.1, effect: 'bait', shape: 'circle', from: 'target', targets: S, r: 8, dmg: 0.9, own: 0.3, name: 'Scourge of Thunder' });
        pref(ev.t - 8, tiles);
        for (const s of S) {
          const ground = Object.values(GROUND).includes(tiles[s]);
          check({ t: ev.t, kind: 'spot', slots: [s], spots: { [s]: tiles[s] }, r: 4.6, fail: 0.9, name: `Scourge of Thunder (${ground ? 'lightning: not on a ground tile' : 'ice: not floating'})` });
          call(ev.t - 7, ground ? 'Spread - ground tile' : 'Spread - elevated tile', { slot: s, alert: true, dur: 6 });
        }
        P.labels.set(ev, 'Scourge of Thunder (spread: lightning on the ground, ice floating)');
      });
      // The stances, each with Crackling Cataclysm's puddles under everyone after.
      const stormGroups = {
        coil: [[-3, 2], [3, 2]], strike: [[-9, -10.5], [9, -10.5]], breath: [[-16.6, 11.2], [16.6, 11.2]],
      };
      const exits = { coil: [[-11, -7], [11, -7]], strike: [[-4.5, 2.5], [4.5, 2.5]], breath: [[-4.5, 3], [4.5, 3]] };
      for (const ev of stances.filter(e => e.t > S0 && e.t < S0 + 160)) {
        const kind = pick(['coil', 'strike', 'breath']);
        stanceAt(ev, kind);
        const before = Object.assign(clumpAt(G1, stormGroups[kind][0], { m: 0 }), clumpAt(G2, stormGroups[kind][1], { m: 0 }));
        pref(ev.t - 7.2, before);
        call(ev.t - 7.3, `${STANCE[kind].what} => Bait Puddles`, { alert: true, dur: 7 });
        const cc = E('Crackling Cataclysm', ev.t, ev.t + 5), tc = tOf(cc, ev.t + 3.1);
        hz({ t: tc, tell: +(tc - 3).toFixed(2), shape: 'circle', from: 'target', targets: S, snap: 3, r: 6, dmg: 0.9, name: 'Crackling Cataclysm' });
        const puddles = Object.values(before).map(p => ({ shape: 'circle', at: p, r: 6 }));
        pref(tc - 2.95, Object.assign(clumpAt(G1, exits[kind][0], { avoid: puddles }), clumpAt(G2, exits[kind][1], { avoid: puddles })));
        call(tc - 2.9, 'Move away from the puddles', { alert: true, dur: 3 });
        if (cc) P.labels.set(cc, 'Crackling Cataclysm (puddles under everyone)');
      }
      // Thunderous Breath: one lane across the arena left by the lines, floating (on its row's elevated tiles).
      const tb = E('Thunderous Breath', S0, S0 + 160);
      if (tb) {
        const LANES = [12.5, 7.5, 2.5, -2.5, -7.5, -12.5], NAMES = ['North Row, Front Half', 'North Row, Back Half', 'Middle Row, Front Half', 'Middle Row, Back Half', 'South Row, Front Half', 'South Row, Back Half'];
        const li = Math.floor(Math.random() * 6), lane = LANES[li], inner = Math.abs(lane) < 5;
        LANES.forEach((n, j) => { if (j !== li) hz({ t: +(tb.t + 0.1).toFixed(2), tell: tb.t - 8.5, shape: 'rect', a: [-20, n - 2.5], b: [20, n + 2.5], dmg: 1.2, name: 'Arcane Lightning', react: 3 }); });
        Object.values(GROUND).forEach(c => hz(Object.assign({ t: tb.t, tell: tb.t - 7.9, dmg: 1.2, name: 'Thunderous Breath (on the ground)', react: 3 }, tileRect(c))));
        const xs = inner ? [-8, -6.5, -5, -3.5] : [-17.5, -16, -14.5, -13];
        pref(tb.t - 8.4, Object.assign(assign(G1, xs.map(x => [x, lane])), assign(G2, xs.map(x => [-x, lane]))));
        call(tb.t - 8.4, `${NAMES[li]} - elevated tile`, { alert: true, dur: 7 });
        P.labels.set(tb, `Thunderous Breath (${NAMES[li].toLowerCase()} safe, floating)`);
      }
      // Ruinfall: the tanks share the tower; everyone else to the sides, Arm's Length / Surecast for the knockback;
      // the puddles along the south edge.
      const rt = E('Ruinfall (tower)', S0 + 140, S0 + 170), rk = E('Ruinfall (knockback)', S0 + 140, S0 + 170);
      if (rt) {
        const tw = [0, 1.5], tl = rt.t - 5.6;
        hz({ t: rt.t, tell: tl, effect: 'tower', shape: 'circle', at: tw, r: 6, soak: [2, 2], only: { role: 'tank' }, dmg: 0.5, fail: 0.9, name: 'Ruinfall (tower)' });
        const tk = tOf(rk, rt.t + 2.4);
        hz({ t: tk, tell: tl, effect: 'knockback', dir: 0, dist: 25, immune: S.slice(), dmg: 0, name: 'Ruinfall (knockback)', react: 4 });
        for (const p of [[-12, -11], [0, -11], [12, -11]]) hz({ t: +(tk + 1.5).toFixed(2), tell: tl, shape: 'circle', at: p, r: 6, dmg: 1.2, name: 'Ruinfall (puddle)' });
        pref(tl, { MT: [-0.7, 1.5], OT: [0.7, 1.5], H1: [-13, 4], M1: [-11, 4], R1: [-9, 4], H2: [13, 4], M2: [11, 4], R2: [9, 4] });
        for (const s of S) call(tl, TANKS.includes(s) ? 'Soak Tower' : 'Avoid Tower', { slot: s, dur: 4 });
        call(tk - 5, "Knockback: Arm's Length / Surecast", { alert: true, dur: 4 });
        if (rk) P.labels.set(rk, "Ruinfall (knockback: everyone uses Arm's Length / Surecast)");
        pref(tk + 1.6, HOME);
      }
    }

    // ===== ice phase =====
    const tri3 = E('Triscourge', I0, I0 + 30);
    if (tri3) {
      // Scourge of Ice and Fire: the tanks' defamations out at markers 2 and 3, the healers' 3-man stacks at C and D.
      const sif = E('Scourge of Ice/Fire', I0, I0 + 50);
      if (sif) {
        const ic = sif.t - 7.1;
        hz({ t: sif.t, tell: ic, effect: 'bait', shape: 'circle', from: 'target', targets: TANKS, r: 16, dmg: 1.2, own: 0.4, name: 'Scourge of Ice (defamation)' });
        hz({ t: sif.t, tell: ic, effect: 'share', shape: 'circle', from: 'target', targets: ['H1', 'H2'], r: 5, min: 3, max: 3, dmg: 0.35, name: 'Scourge of Fire' });
        for (const s of TANKS) { debuff(s, 'calamitysBite', "Calamity's Bite", 'defamation: away from everyone', tri3.t, sif.t); call(ic + 0.5, 'Away from Group (defamation)', { slot: s, alert: true, dur: 6 }); }
        for (const s of ['H1', 'H2']) debuff(s, 'calamitysEmbers', "Calamity's Embers", 'stack (3)', tri3.t, sif.t);
        for (const s of ['H1', 'H2', 'M1', 'M2', 'R1', 'R2']) call(ic + 0.5, 'Healer Groups', { slot: s, alert: true, dur: 6 });
        pref(ic + 0.1, Object.assign({ MT: [-13, 13.6], OT: [13, 13.6] }, clumpAt(['H1', 'M1', 'R1'], [-4.5, -6.5], { m: 0 }), clumpAt(['H2', 'M2', 'R2'], [4.5, -6.5], { m: 0 })));
        pref(sif.t + 0.2, HOME);
        P.labels.set(sif, 'Scourge of Ice and Fire (the tanks\' defamations, the healers\' stacks)');
      }
      const ncs = EA('Northern Cross', I0, I0 + 160), chills = EA('Chilling Cataclysm', I0, I0 + 160);
      // The stars: five spheres, each eight lines; a thin diagonal is safe in the north corner away from the
      // north-most sphere.
      const stars = (ev) => {
        const west = Math.random() < 0.5, ps = STARS.map(p => (west ? p : mirror(p)));
        for (const c of ps) for (const d of [0, 45]) hz({ t: ev.t, tell: ev.t - 5.6, shape: 'cross', at: c, deg: d, len: 40, w: 5, dmg: 1.1, name: 'Chilling Cataclysm', react: 3 });
        const sx = west ? 1 : -1, spots = {};
        S.forEach((s, j) => { const k = 6.15 + 0.19 * j; spots[s] = r2([k * sx, k]); });
        pref(ev.t - 5.55, spots);
        call(ev.t - 5.5, west ? 'Northeast' : 'Northwest', { alert: true, dur: 5 });
        P.labels.set(ev, `Chilling Cataclysm (the stars: ${west ? 'north-east' : 'north-west'} safe)`);
      };
      // The first: the avalanche with a stance (each half safe for each), then the stars.
      const is1 = stances.find(e => e.t > I0 + 40 && e.t < I0 + 60), nc1 = ncs.find(e => e.t > I0 + 40 && e.t < I0 + 60);
      if (is1) {
        const kind = pick(['coil', 'strike', 'breath']), a = pick(['NE', 'SW']), sg = a === 'NE' ? -1 : 1;
        stanceAt(is1, kind);
        const tA = tOf(nc1, is1.t - 1.5);
        hz({ t: tA, tell: tA - 9.2, shape: 'half', dir: AVALANCHE[a].dir, dmg: 1.3, name: 'Northern Cross (avalanche)' });
        if (nc1) P.labels.set(nc1, `Northern Cross (the avalanche: the ${AVALANCHE[a].name} half)`);
        const want = { coil: [2.5 * sg, 2.5 * sg], strike: [15 * sg, -6.5], breath: [18.3 * sg, 7.5] }[kind];
        pref(tA - 9.1, clumpAt(S, [6 * sg, 6 * sg], { m: 0 }));
        pref(is1.t - 7.2, clumpAt(S, want, { m: 0.3, avoid: [STANCE[kind].shape, { shape: 'half', dir: AVALANCHE[a].dir }] }));
        const safe = kind === 'breath' ? (a === 'NE' ? 'NW Safe' : 'NE Safe') : `Be ${AVALANCHE[a].safe}`;
        call(is1.t - 7.3, `${STANCE[kind].what} - ${safe}`, { alert: true, dur: 7 });
      }
      const ch1 = chills.find(e => e.t > I0 + 50 && e.t < I0 + 62);
      if (ch1) stars(ch1);
      // Scourge of Thunder: one role spreads (5) inside, the other at the sides.
      const iceSpreads = (ev) => {
        const role = pick([SUP, DPS]), other = role === SUP ? DPS : SUP;
        hz({ t: ev.t, tell: ev.t - 7.1, effect: 'bait', shape: 'circle', from: 'target', targets: role, r: 5, dmg: 0.9, own: 0.3, name: 'Scourge of Thunder' });
        for (const s of role) debuff(s, 'calamitysBolt', "Calamity's Bolt", 'spread', ev.t - 7.1, ev.t);
        pref(ev.t - 7, Object.assign(assign(role, ICE_SPREAD), assign(other, ICE_SIDE)));
        for (const s of role) call(ev.t - 6, 'Spread', { slot: s, alert: true, dur: 5 });
        P.labels.set(ev, `Scourge of Thunder (the ${role === SUP ? 'supports' : 'DPS'} spread)`);
      };
      const its = EA('Scourge of Thunder', I0, I0 + 160);
      if (its[0]) { iceSpreads(its[0]); pref(its[0].t + 0.2, HOME); }
      const spk2 = E('Spikesicle', I0 + 60, I0 + 100);
      if (spk2) pref(spikesicle(spk2, true), HOME);
      // The second: a stance, the stars, the avalanche, Freezing Dust (keep moving), the spreads.
      const is2 = stances.find(e => e.t > I0 + 100 && e.t < I0 + 125);
      if (is2) {
        const kind = pick(['coil', 'strike', 'breath']);
        stanceAt(is2, kind);
        const want = { coil: [0, 0.5], strike: [0, -11.5], breath: [-17, 10] }[kind];
        pref(is2.t - 7.2, kind === 'breath' ? Object.assign(clumpAt(G1, want, { m: 0 }), clumpAt(G2, mirror(want), { m: 0 })) : clumpAt(S, want, { m: 0 }));
        call(is2.t - 7.3, STANCE[kind].what, { alert: true, dur: 7 });
      }
      const ch2 = chills.find(e => e.t > I0 + 115 && e.t < I0 + 130);
      if (ch2) stars(ch2);
      const nc2 = ncs.find(e => e.t > I0 + 120 && e.t < I0 + 135);
      if (nc2) {
        const a = pick(['NE', 'SW']), sg = a === 'NE' ? -1 : 1;
        hz({ t: nc2.t, tell: nc2.t - 9.1, shape: 'half', dir: AVALANCHE[a].dir, dmg: 1.3, name: 'Northern Cross (avalanche)' });
        P.labels.set(nc2, `Northern Cross (the avalanche: the ${AVALANCHE[a].name} half)`);
        pref(tOf(ch2, nc2.t - 4.8) + 0.05, clumpAt(S, [6 * sg, 6 * sg], { m: 0 }));
        call(tOf(ch2, nc2.t - 4.8) + 0.1, a === 'NE' ? '<= Go Left (Dodge Avalanche)' : 'Go Right (Dodge Avalanche) =>', { alert: true, dur: 4 });
      }
      const fd = E('Freezing Dust', I0 + 110, I0 + 150);
      if (fd) {
        const t0 = fd.t + 1, t1 = fd.t + 3;
        keepMoving(t0, t1, Object.fromEntries(S.map(s => [s, [LINE_X[s], -9]])), Object.fromEntries(S.map(s => [s, [LINE_X[s], 0.5]])), 'Freezing Dust (stood still)', nc2 ? nc2.t + 0.1 : t0 - 5);
        for (const s of S) debuff(s, 'freezingUp', 'Freezing Up', 'keep moving', t0, t1);
        P.labels.set(fd, 'Freezing Dust (keep moving)');
      }
      if (its[1]) { iceSpreads(its[1]); pref(its[1].t + 0.2, HOME); }
      // Ice Talon: busters on both tanks, out in front; everyone else back.
      const talon = E('Ice Talon', I0 + 140, I0 + 170);
      if (talon) {
        hz({ t: talon.t, tell: talon.t - 5, effect: 'bait', shape: 'circle', from: 'target', targets: TANKS, r: 6, dmg: 1.2, own: 0.5, buster: true, name: 'Ice Talon' });
        pref(talon.t - 5, Object.assign({ MT: [-6, 7], OT: [6, 7] }, clumpAt(['H1', 'H2', 'M1', 'M2', 'R1', 'R2'], [0, -4], { m: 0 })));
        for (const s of TANKS) call(talon.t - 5, 'Tank buster on YOU: out in front', { slot: s, alert: true, dur: 4 });
        call(talon.t - 5, 'Tank busters', { dur: 4 });
        pref(talon.t + 0.2, HOME);
      }
    }

    // ===== the last phase =====
    const mf2 = events.find(e => e.name === 'Mountain Fire' && e.kind === 'cast' && e.t > 3500);
    if (mf2) pref(mountainFire(mf2), HOME);

    P.boss.sort((a, b) => a.t - b.t);
    P.looks.sort((a, b) => a.t - b.t);
    return P;
  }

  B.FIGHT_SCRIPTS = B.FIGHT_SCRIPTS || {};
  B.FIGHT_SCRIPTS.ex1 = {
    // FFLogs' max HP in an EX1 kill (report 12rpzKQ3wxCAJYtn): Valigarmanda 61,841,486; the three beacons 979,160 each.
    hp: 61841486,
    // The beacons: while they're up the party hits them (the boss can't be targeted).
    adds: [{ from: 198.3, to: 240.4, hp: 2937480, share: 1, name: 'Flame-kissed, Thunderous and Glacial Beacons' }],
    // The timeline's blocks: the beacons down (or their loop over) goes on to Tulidisaster; then the first element's
    // phase, the second, and the last (the gaps cactbot leaves between them).
    pushes: [
      { from: 198.3, to: 996.3, adds: 0, name: 'The beacons are down' },
      { from: 240.4, to: 996.3, dealt: 0, name: 'The beacons\' time is up' },
      { from: 1029.9, to: 2000, dealt: 0, name: 'Skyruin' },
      { from: 2161.2, to: 3000, dealt: 0, name: 'Skyruin' },
      { from: 3161.2, to: 4000, dealt: 0, name: 'Wrath Unfurled' },
    ],
    defaultStrat: 'hector',
    strats: {
      hector: { label: 'Hector (NA)' },
    },
    source: 'wtfdig.info/70/ex1; mechanics after BossMod (github.com/awgil/ffxiv_bossmod) and FFLogs kills',
    // wtfdig's: A and B either side of the middle, C and D south of them; 1 and 4 on the west and east edges, 2 and 3
    // in the north corners.
    waymarks: [
      { label: 'A', at: [-4, 2.2], color: 'red' }, { label: 'B', at: [4, 2.2], color: 'yellow' },
      { label: 'C', at: [-4, -6.8], color: 'blue' }, { label: 'D', at: [4, -6.8], color: 'purple' },
      { label: '1', at: [-19.2, 8], color: 'red', square: true }, { label: '2', at: [-12.8, 13.8], color: 'yellow', square: true },
      { label: '3', at: [12.8, 13.8], color: 'blue', square: true }, { label: '4', at: [19.2, 8], color: 'purple', square: true },
    ],
    plan,
  };
})(window.BLM);
