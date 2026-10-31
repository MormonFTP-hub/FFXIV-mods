// EX3, The Minstrel's Ballad: Sphene's Burden: Queen Eternal's mechanics for the sim's party, on cactbot's timeline
// (07-dt/trial/queen-eternal-ex), and the one strat wtfdig.info lists for the fight (71/ex3): Hector (NA), with the
// Absolute Authority cheese and the MTTT tethers. Spots are [east, north] yalms from the arena's middle.
//
// One duty, two phases (BossMod's Ex3Sphene: BossP1 and BossP2): the Queen, a giant (R22), stands at the north edge
// (FFLogs: [0, 20]) the whole fight; in phase 2 her Tyranny's Grasp brings her to [0, 10]. cactbot puts phase 2 in a
// block at 1000 s: phase 1 ends when its HP does (or at Authority Eternal's cast, where the game would enrage) and the
// fight skips to the transition.
//
// The mechanics follow BossMod's module (github.com/awgil/ffxiv_bossmod, Ex3Sphene), whose shapes and sizes come from the
// game's Action sheet, and two FFLogs kills (the boss's and her helpers' positions as they cast, and where the players
// stood), built with the sim's toolkit (js/mech.js):
//   - The floor (the plan's arena and looks): a 40-yalm square over the void (off it is a fall); Virtual Shift turns it
//     into the wind floor (a north and a south platform joined by two diagonals), the earth floor (two platforms, but
//     everyone floats: the whole square still holds you) or the ice floor (west, east and middle platforms; bridges
//     north and south from Laws of Ice); World Shatter brings the square back. Phase 2's Radical Shift swaps in one of
//     the three each time (each pull's own), and you have to stand where both floors are when it does.
//   - Aethertithe: three times a 70-degree cone (west, middle or east) and two healer line stacks (Retribute).
//   - Wind: healer stacks (Aeroquell) leave twisters; support-DPS chains broken north/south (DPS north); Legitimate
//     Force's half-room cleaves; each player's Wind of Change, a 20-yalm push east or west along their platform.
//   - Prosecution of War: two tank busters with a swap. Royal Domain, World Shatter, Virtual Shift: raidwides.
//   - Divide and Conquer: eight baited lines from the Queen, one a second in a random order (fanned out), then all eight
//     again (step between them).
//   - Earth: Legitimate Force, eight one-player towers on the platforms; Gravitational Empire's two defamations (sides),
//     two tethered cones (north corners) and four towers; two sets of meteors (spread over the platforms, then drop
//     them into the hole between them); Weighty Blow: hide from the orbs behind the meteors as they're smashed, a
//     column at a time.
//   - Coronation: four lasers in a pinwheel (100 x 12 rects 9 off the middle), each tethered to two players who take
//     its two sides (the cells of the grid they leave); Atomic Ray: 16-yalm spreads on everyone.
//   - Absolute Authority (Hector's cheese): bait the puddles along the north wall from the north-west, stack in the
//     north-east and take the flares, the stack and the dorito together, then the 30-yalm knockback south.
//   - Ice: keep moving (Laws of Ice); the ice pillars' tethers (stretch them across to the other side, by the bridge);
//     Legitimate Force from the bridges; Drear Rising: two Ice Dart tethers a round (16-yalm circles: the melee take
//     the first to the north corners, the tanks the other three) and a line stack on the rest.
//   - Phase 2: Radical Shift (twice, twice), each with 5-yalm spreads; Dimensional Distortion's exaflares (two waves
//     down the columns); Tyranny's Grasp (the north half, then a tank tower each); Dying Memory; Royal Banishment's
//     eight line stacks; Preservation, the enrage.
// Simplified: Laws of Ice's freeze (keep moving) only shows (the bots shuffle); the bridges hold any number of players;
// the earth phase's float and land isn't tracked (towers are just on the platforms); the ice pillars' layout and
// Raised Tribute's source (the Queen) are this script's guesses at BossMod's safe spots; Coronation's tethers are a
// spot check; Absolute Authority's flares and stack land as one hit the clump shares, its doritos as one more (the
// cheese: nobody leaves the stack); the second-by-second light hits (Aethertithe, Absolute Authority) come as a few
// bigger ones, since the sim's party only heals between hits. Phase 2's form (m0881 b0002) is left out of the map for
// size: the phase-1 model plays it. Where wtfdig gives no diagram, the spots are this script's own.
(function (B) {
  const S = B.SLOTS;
  const at = B.bearing;
  const inside = B.mechInside;
  const add = (a, b) => [a[0] + b[0], a[1] + b[1]];
  const sub = (a, b) => [a[0] - b[0], a[1] - b[1]];
  const mul = (a, k) => [a[0] * k, a[1] * k];
  const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);
  const unit = (v) => { const l = Math.hypot(v[0], v[1]) || 1; return [v[0] / l, v[1] / l]; };
  const deg360 = (d) => ((d % 360) + 360) % 360;
  const pick = (a) => a[Math.floor(Math.random() * a.length)];
  const shuffle = (a) => { const b = a.slice(); for (let i = b.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [b[i], b[j]] = [b[j], b[i]]; } return b; };
  const r2 = (p) => [+p[0].toFixed(2), +p[1].toFixed(2)];
  const assign = (slots, pts) => Object.fromEntries(slots.map((s, i) => [s, pts[i]]));
  const brg = (from, to) => deg360(Math.atan2(to[0] - from[0], to[1] - from[1]) * 180 / Math.PI);
  const G1 = ['MT', 'H1', 'M1', 'R1'], G2 = ['OT', 'H2', 'M2', 'R2'];
  const SUP = ['MT', 'OT', 'H1', 'H2'], DPS = ['M1', 'M2', 'R1', 'R2'], TANKS = ['MT', 'OT'];

  // ---------- the floors ----------
  const BOSS1 = [0, 20], BOSS2 = [0, 10];
  const rect = (a, b) => ({ shape: 'rect', a, b });
  // A diagonal walkway (BossMod's: 7.5 wide across, from the north platform to the south one) as a chain of circles
  // along its middle, each as wide as it is, run a little into the platforms at each end.
  const chain = (p0, p1, r, step) => {
    const n = Math.ceil(dist(p0, p1) / step), out = [];
    for (let i = -2; i <= n + 2; i++) out.push({ shape: 'circle', at: r2(add(p0, mul(sub(p1, p0), i / n))), r });
    return out;
  };
  const SQUARE = { shape: 'square', half: 20, deathwall: true };
  const WIND = { parts: [rect([-12.5, 15], [12.5, 20]), rect([-12.5, -5], [12.5, 0]),
    ...chain([-7.25, 15], [7.25, 0], 2.7, 0.7), ...chain([7.25, 15], [-7.25, 0], 2.7, 0.7)], deathwall: true };
  const EARTH = { parts: [rect([-12, -2], [-4, 14]), rect([4, -2], [12, 14])], deathwall: true };
  const ICE = { parts: [rect([-16, -10], [-8, 20]), rect([8, -10], [16, 20]), rect([-2, -10], [2, 10])], deathwall: true };
  // With the bridges (run into the platforms they join, so no seam is an edge).
  const ICEB = { parts: ICE.parts.concat([rect([-10.5, 2], [10.5, 6]), rect([-10.5, -6], [10.5, -2])]), deathwall: true };
  const FLOOR = { wind: WIND, earth: EARTH, ice: ICE };
  const onShape = (s, p, m) => {
    if (s.shape === 'circle') return dist(p, s.at || [0, 0]) < s.r - m;
    if (s.shape === 'rect') return p[0] > Math.min(s.a[0], s.b[0]) + m && p[0] < Math.max(s.a[0], s.b[0]) - m && p[1] > Math.min(s.a[1], s.b[1]) + m && p[1] < Math.max(s.a[1], s.b[1]) - m;
    return Math.abs(p[0]) < (s.half || 20) - m && Math.abs(p[1]) < (s.half || 20) - m;
  };
  const floorOf = (a, m) => (p) => (a.parts || [a]).some(s => onShape(s, p, m === undefined ? 0.9 : m));
  // The arena's look by floor. Its models: the square (x6fc_a8_stg01 and its sides, and x6fb_a1_stg02, its rim), the
  // wind floor (x6fb_a4), the earth platforms (x6fb_a3), the ice platforms (x6fc_a7_stg) and the bridges (x6fc_a7_gmc).
  // (Each of a3, a4 and a7 also has a copy floating far off in the sky, which shows with it.)
  const LOOK = { normal: ['a8', 'a1_stg02'], wind: ['a4'], earth: ['a3'], ice: ['a7_stg'], iceb: ['a7_stg', 'a7_gmc'] };

  // ---------- placing the party ----------
  // Each [slot, want, sep] in turn: the nearest point to `want` on the floor, clear of the shapes in `avoid` (by m
  // yalms) and at least sep from those already placed.
  function place(list, o) {
    o = o || {};
    const m = o.m === undefined ? 1.3 : o.m, avoid = o.avoid || [], floor = o.floor || (() => true), done = [];
    const out = {};
    for (const [s, want, sp] of list) {
      const sep = sp === undefined ? 0.7 : sp;
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
  const clump = (slots, c, o) => place(slots.map(s => [s, c, (o && o.sep) || 0.7]), o);
  // A walk along points from second t0 (5.6 yalms a second), as a spot that moves (a pref that's a function).
  function walkPath(pts, t0, speed) {
    const v = speed || 5.6, len = [0];
    for (let i = 1; i < pts.length; i++) len.push(len[i - 1] + dist(pts[i - 1], pts[i]));
    return (t) => {
      const d = Math.max(0, (t - t0) * v);
      if (d >= len[len.length - 1]) return pts[pts.length - 1];
      let i = 1;
      while (len[i] < d) i++;
      const k = (d - len[i - 1]) / Math.max(1e-6, len[i] - len[i - 1]);
      return [pts[i - 1][0] + (pts[i][0] - pts[i - 1][0]) * k, pts[i - 1][1] + (pts[i][1] - pts[i - 1][1]) * k];
    };
  }
  // The way from a to b over floor F: straight, or through one or two waypoints that keep it on the floor.
  function pathOn(a, b, F) {
    const clear = (p, q) => { const n = Math.max(1, Math.ceil(dist(p, q) / 0.4)); for (let i = 0; i <= n; i++) if (!F([p[0] + (q[0] - p[0]) * i / n, p[1] + (q[1] - p[1]) * i / n])) return false; return true; };
    if (clear(a, b)) return [a, b];
    const via = [];
    for (let x = -19; x <= 19; x += 1) for (let y = -19; y <= 19; y += 1) if (F([x, y])) via.push([x, y]);
    let best = null;
    for (const w of via) if (clear(a, w) && clear(w, b)) { const L = dist(a, w) + dist(w, b); if (!best || L < best.L) best = { L, pts: [a, w, b] }; }
    if (best) return best.pts;
    const sparse = via.filter(([x, y]) => x % 2 === 0 && y % 2 === 0), from = sparse.filter(w => clear(a, w)), to = sparse.filter(w => clear(w, b));
    for (const w1 of from) for (const w2 of to) if (clear(w1, w2)) { const L = dist(a, w1) + dist(w1, w2) + dist(w2, b); if (!best || L < best.L) best = { L, pts: [a, w1, w2, b] }; }
    return best ? best.pts : [a, b];
  }
  // Where everyone waits for a floor to turn into another: on both at once, on their own side (G1 west, G2 east) and,
  // where a floor is two or three platforms apart, on that side's platform, so the walk there and on is over floor.
  const SIDE_PLAT = { earth: { [-1]: EARTH.parts[0], [1]: EARTH.parts[1] }, ice: { [-1]: ICE.parts[0], [1]: ICE.parts[1] } };
  function meet(a, b, from) {
    const FA = floorOf(FLOOR[a], 1.1), FB = floorOf(FLOOR[b], 1.1), out = {}, used = [];
    const ok = (p, sg) => sg * p[0] > 0.5 && FA(p) && FB(p) && [a, b].every(k => !SIDE_PLAT[k] || onShape(SIDE_PLAT[k][sg], p, 1.1));
    for (const s of S) {
      const sg = G1.includes(s) ? -1 : 1;
      let best = null, bd = Infinity;
      for (let x = -19; x <= 19; x += 0.5) for (let y = -19; y <= 19; y += 0.5) {
        const c = [x, y], d = dist(c, from[s]);
        if (d < bd && ok(c, sg) && used.every(u => dist(u, c) >= 0.9)) { bd = d; best = c; }
      }
      out[s] = best || from[s];
      used.push(out[s]);
    }
    return out;
  }

  // ---------- the party's places ----------
  // Uptime: the Queen at the north edge (hitbox 22: anywhere in the north two-thirds is in reach); light parties
  // west (G1) and east (G2), each tank on one of her hands.
  const UP = { MT: [-5, 9], OT: [5, 9], M1: [-3, 5], M2: [3, 5], H1: [-8, 3], H2: [8, 3], R1: [-11, 6], R2: [11, 6] };
  // Aethertithe's cones (west, middle, east: bearings from her) and where each light party stands when one goes off.
  const CONE_DEG = { W: 235, M: 180, E: 125 };
  const SAFE = { W: ['M', 'E'], M: ['W', 'E'], E: ['W', 'M'] };
  const GROUP_DEG = { W: 243, M: 180, E: 117 };
  const SIDE_NAME = { W: 'West', M: 'Middle', E: 'East' };
  // Earth: the eight towers (Hector: G1 west, G2 east; tanks inner north, melee outer north, healers inner south,
  // ranged outer south) and the meteors' spots over and off the platforms.
  const TOWERS1 = { MT: [-6, 12], M1: [-10, 12], H1: [-6, 0], R1: [-10, 0], OT: [6, 12], M2: [10, 12], H2: [6, 0], R2: [10, 0] };
  const METEOR1 = { M1: [-10.2, 10], MT: [-5.4, 10], R1: [-10.2, 4.5], H1: [-5.4, 4.5], OT: [5.4, 10], M2: [10.2, 10], H2: [5.4, 4.5], R2: [10.2, 4.5] };
  // The second meteors only hit their own player (BossMod): all eight drop them into the hole between the platforms.
  const METEOR2 = { MT: [-1.2, 9.5], M1: [-1.2, 8.1], H1: [-1.2, 6.7], R1: [-1.2, 5.3], OT: [1.2, 9.5], M2: [1.2, 8.1], H2: [1.2, 6.7], R2: [1.2, 5.3] };
  const ORB = { W: [-8, 20.5], E: [8, 20.5] };
  // Coronation's grid cells (the corners and the edges' middles, clear of the four lasers 9 off the middle).
  const CELL = { Nmid: [0, 18.2], NE: [18.2, 18.2], Emid: [18.2, 0], SE: [18.2, -18.2], Smid: [0, -18.2], SW: [-18.2, -18.2], Wmid: [-18.2, 0], NW: [-18.2, 18.2] };
  const CELL_NAME = { Nmid: 'north', NE: 'northeast', Emid: 'east', SE: 'southeast', Smid: 'south', SW: 'southwest', Wmid: 'west', NW: 'northwest' };
  // Its helpers, by the pinwheel's turn: where each stands, which way it fires, and its left and right partners' cells
  // (cactbot's: the left tether's side is the cardinal counterclockwise of the laser's, the right one's clockwise).
  const CORONATION = {
    cw: { N: { at: [9, 20.5], deg: 180, L: 'Nmid', R: 'NE' }, E: { at: [20.5, -9], deg: 270, L: 'Emid', R: 'SE' },
      S: { at: [-9, -20.5], deg: 0, L: 'Smid', R: 'SW' }, W: { at: [-20.5, 9], deg: 90, L: 'Wmid', R: 'NW' } },
    ccw: { N: { at: [-9, 20.5], deg: 180, L: 'NW', R: 'Nmid' }, E: { at: [20.5, 9], deg: 270, L: 'NE', R: 'Emid' },
      S: { at: [9, -20.5], deg: 0, L: 'SE', R: 'Smid' }, W: { at: [-20.5, -9], deg: 90, L: 'SW', R: 'Wmid' } },
  };
  // The ice pillars (BossMod's two orders: four south of the floor, four over it; four outer, four inner) and where
  // each one's tethered player stretches it, on the far side (BossMod's safe spots). Hector: outer tethers cross by
  // the north bridge, inner by the south.
  const PILLARS = [
    { at: [-12, -15], spot: [10, 19] }, { at: [-4, -15], spot: [15, 19] }, { at: [4, -15], spot: [-15, 19] }, { at: [12, -15], spot: [-10, 19] },
    { at: [-12, 12], spot: [15, 2] }, { at: [12, 12], spot: [-15, 2] }, { at: [-4, -4], spot: [15, -10] }, { at: [4, -4], spot: [-15, -10] },
  ];
  // Phase 2's spreads (5 yalms) on each floor.
  const SPREAD = {
    wind: { MT: [-10, 17.5], M1: [-3.4, 17.5], M2: [3.4, 17.5], OT: [10, 17.5], H1: [-10, -2.5], R1: [-3.4, -2.5], R2: [3.4, -2.5], H2: [10, -2.5] },
    earth: { MT: [-10, 12.2], M1: [-6, 7.9], H1: [-10, 3.6], R1: [-6, -0.7], OT: [10, 12.2], M2: [6, 7.9], H2: [10, 3.6], R2: [6, -0.7] },
    ice: { MT: [-12, 16.8], M1: [-12, 10.3], H1: [-12, 3.8], R1: [-12, -2.7], OT: [12, 16.8], M2: [12, 10.3], H2: [12, 3.8], R2: [12, -2.7] },
  };
  const PLAT_NAME = { wind: 'Wind/Green', earth: 'Earth/Yellow', ice: 'Ice/Blue' };

  // ---------- the pull ----------
  function plan(events, strat) {
    // Phase 2's Authority Eternal is its cast's hit (the cast itself is phase 1's last): give it its 10 s bar, and the
    // Queen's absence until her second form is up (cactbot has only its end).
    const ae2 = events.find(e => e.name === 'Authority Eternal' && e.t > 900);
    if (ae2 && !ae2.cast) ae2.cast = 10;
    for (const d of [B.GAME_MAPS && B.GAME_MAPS.ex3 && B.GAME_MAPS.ex3.fight, B.app && B.app.fight && B.app.fight.key === 'ex3' && B.app.fight.data]) {
      if (d && ae2 && Array.isArray(d.untargetable) && !d.untargetable.length) d.untargetable.push([ae2.t + 0.2, ae2.t + 24.8]);
    }
    const P = { start: Object.assign({}, UP), prefs: [], hazards: [], checks: [], calls: [], marks: [], labels: new Map(), debuffs: [],
      boss: [{ t: 0, at: BOSS1 }], hitbox: [{ t: 0, r: 22 }], looks: [] };
    let id = 0;
    const hz = (o) => { const h = Object.assign({ id: ++id, react: 3 }, o); P.hazards.push(h); return h; };
    const last = Object.assign({}, UP);
    const pref = (t, spots) => { P.prefs.push({ t, spots }); for (const [s, p] of Object.entries(spots)) if (Array.isArray(p)) last[s] = p; };
    // The same, each walking round whatever isn't floor (F) on the way.
    const prefOn = (t, spots, F) => {
      const out = {};
      for (const [s, p] of Object.entries(spots)) { const pts = pathOn(last[s] || p, p, F); out[s] = pts.length > 2 ? walkPath(pts, t) : p; }
      P.prefs.push({ t, spots: out });
      Object.assign(last, spots);
    };
    // A walk along given points (a bridge's way), for each slot its own.
    const prefWalk = (t, paths) => {
      const out = {};
      for (const [s, pts] of Object.entries(paths)) { out[s] = walkPath([last[s]].concat(pts), t); last[s] = pts[pts.length - 1]; }
      P.prefs.push({ t, spots: out });
    };
    const call = (t, text, o) => P.calls.push(Object.assign({ t, text, dur: 5 }, o));
    const check = (o) => P.checks.push(o);
    const debuff = (slot, key, name, hint, t0, t1) => P.debuffs.push({ slot, key, name, hint, t0, t1 });
    const mark = (shape, t0, t1, fill) => P.marks.push(Object.assign({ kind: 'lit', t0, t1, fill }, shape));
    const E = (name, t0, t1) => events.find(e => e.name === name && e.t >= t0 && e.t <= t1) || null;
    const EA = (re, t0, t1) => events.filter(e => re.test(e.name) && e.t >= t0 && e.t <= t1);
    const tOf = (e, d) => (e ? e.t : d);
    const castOf = (ev, d) => ev.t - (ev.cast || d || 5);
    const label = (ev, text) => { if (ev) P.labels.set(ev, text); };
    const half = (side) => ({ shape: 'rect', a: [side < 0 ? -30 : 0, -40], b: [side < 0 ? 0 : 30, 21] });     // the half of the room east (+1) or west (-1)
    const SQ = floorOf(SQUARE, 0.9);

    // ===== the floors, by phase =====
    const arena = [{ t: 0, ...SQUARE }];
    const setFloor = (t, floor, show) => { arena.push({ t, ...floor }); P.looks.push({ t, show }); };
    P.looks.push({ t: 0, show: LOOK.normal });
    const vs = events.filter(e => e.name === 'Virtual Shift');
    const ws1 = events.filter(e => e.name === 'World Shatter' && e.t < 900), ws2 = events.filter(e => e.name === 'World Shatter' && e.t > 900);
    const lawsIce = events.filter(e => e.name === 'Laws of Ice (platforms)');
    if (vs[0]) setFloor(vs[0].t + 0.1, WIND, LOOK.wind);
    if (ws1[0]) setFloor(ws1[0].t + 0.1, SQUARE, LOOK.normal);
    if (vs[1]) setFloor(vs[1].t + 0.1, SQUARE, LOOK.earth);
    if (ws1[1]) setFloor(ws1[1].t + 0.1, SQUARE, LOOK.normal);
    if (vs[2]) setFloor(vs[2].t + 0.1, ICE, LOOK.ice);
    if (lawsIce[0]) setFloor(lawsIce[0].t, ICEB, LOOK.iceb);
    if (ws1[2]) setFloor(ws1[2].t + 0.1, SQUARE, LOOK.normal);
    setFloor(989.9, SQUARE, LOOK.normal);
    // Phase 2: Radical Shift brings one of the three floors each time (never the one it just had).
    const rot = events.filter(e => e.name === 'Radical Shift (rotate)'), plats = [];
    rot.forEach((ev, k) => {
      const all = ['wind', 'earth', 'ice'];
      plats.push(pick(k % 2 ? all.filter(x => x !== plats[k - 1]) : all));
      setFloor(ev.t + 0.1, FLOOR[plats[k]], LOOK[plats[k]]);
      if (k % 2 && ws2[(k - 1) / 2]) setFloor(ws2[(k - 1) / 2].t + 0.1, SQUARE, LOOK.normal);
    });

    // ===== raidwides =====
    for (const ev of events) {
      const n = ev.name, cs = castOf(ev, 5);
      if (n === 'Virtual Shift') {
        hz({ t: ev.t, tell: cs, raidwide: true, dmg: 0.5, name: n });
        call(cs, 'Big raidwide', { dur: 3 });
      } else if (n === 'World Shatter' || n === 'Royal Domain') {
        hz({ t: ev.t, tell: cs, raidwide: true, dmg: 0.45, name: n });
        call(cs, 'Raidwide', { dur: 3 });
        if (n === 'World Shatter') label(ev, 'World Shatter (the floor back)');
      } else if (n === 'Authority Eternal' && ev.t > 900) {
        hz({ t: ev.t, tell: ev.t - 10, raidwide: true, dmg: 0.5, name: n });
        call(ev.t - 10, 'Big raidwide', { dur: 3 });
        label(ev, 'Authority Eternal (phase 2)');
      } else if (n === 'Authority Eternal') {
        label(ev, 'Authority Eternal (phase 1\'s enrage: push her first)');
      } else if (n === 'Authority Eternal (Enrage)') {
        label(ev, 'Authority Eternal (the enrage)');
      } else if (n === 'Radical Shift (rotate)') {
        hz({ t: ev.t, tell: castOf(ev, 11), raidwide: true, dmg: 0.4, name: 'Radical Shift' });
      } else if (n === 'Dying Memory x7') {
        const step = (ev.dur || 6.6) / 6;
        for (let k = 0; k < 7; k++) hz({ t: +(ev.t + step * k).toFixed(2), tell: ev.t - 3, raidwide: true, dmg: 0.05, name: 'Dying Memory' });
        call(ev.t - 3, 'AoE x8', { dur: 4 });
      } else if (n === 'Dying Memory (big)') {
        hz({ t: ev.t, tell: ev.t - 2, raidwide: true, dmg: 0.3, name: 'Dying Memory' });
      } else if (n === 'Preservation (Enrage)') {
        label(ev, 'Preservation (the enrage)');
        call(castOf(ev, 14), 'Enrage: Preservation', { alert: true, dur: 6 });
      }
    }

    // ===== Aethertithe: three cones, healer line stacks after each =====
    const aet = E('Aethertithe', 0, 40);
    if (aet) {
      const t0 = aet.t;
      // Its light hits every second (in three runs between the cones), as one hit at each run's end (the sim's party
      // heals only between hits).
      [9.37, 18.51, 27.69].forEach(d => hz({ t: +(t0 + d).toFixed(2), tell: t0, raidwide: true, dmg: 0.1, name: 'Aethertithe' }));
      const rets = EA(/^Retribute$/, t0, t0 + 40), picks = [];
      [10.1, 19.3, 28.5].forEach((d, k) => {
        const tc = t0 + d, tell = tc - 5.1, tr = tOf(rets[k], tc + 3), c = pick(['W', 'M', 'E']);
        picks.push(c);
        const cone = { shape: 'cone', at: BOSS1, deg: CONE_DEG[c], half: 35, r: 60 };
        hz(Object.assign({ t: tc, tell, dmg: 1.3, name: 'Aethertithe' }, cone));
        hz({ t: tr, tell, effect: 'share', shape: 'line', from: 'boss', aim: 'target', targets: ['H1', 'H2'], len: 60, w: 8, min: 4, max: 4, dmg: 0.3, name: 'Retribute' });
        const [s1, s2] = SAFE[c], grp = (g, side) => place(g.map(s => [s, add(BOSS1, at(GROUP_DEG[side], 13)), 0.7]), { avoid: [cone], m: 1.4, floor: SQ });
        pref(tell + 0.2, Object.assign(grp(['H1', 'MT', 'M1', 'R1'], s1), grp(['H2', 'OT', 'M2', 'R2'], s2)));
        call(tell, `${SIDE_NAME[s1]}/${SIDE_NAME[s2]}, healer groups`, { alert: true, dur: 5 });
        label(rets[k], `Retribute (healer line stacks ${SIDE_NAME[s1].toLowerCase()} and ${SIDE_NAME[s2].toLowerCase()})`);
      });
      label(aet, `Aethertithe (cones ${picks.map(c => SIDE_NAME[c].toLowerCase()).join(', ')})`);
    }

    // ===== Virtual Shift: wind =====
    const vw = vs[0];
    if (vw) {
      const FW = floorOf(WIND, 0.9), cs = castOf(vw, 5);
      const aero = E('Aeroquell', vw.t, vw.t + 30), tAero = tOf(aero, vw.t + 14.1);
      const lf = EA(/^Legitimate Force/, vw.t, vw.t + 40), t1 = tOf(lf[0], tAero + 13), t2 = tOf(lf[1], t1 + 3.1), lfCast = t1 - 8;
      const woc = E('Wind of Change', t2, t2 + 6), tKb = tOf(woc, t2 + 3.1), tWs = tOf(ws1[0], tKb + 7.9);
      // Aeroquell: the healers' stacks on the north-west to south-east diagonal; each leaves a twister there.
      const GA = [-3.9, 11.5], GB = [3.9, 3.5];
      pref(cs + 0.1, Object.assign(clump(['H1', 'MT', 'M1', 'R1'], GA, { floor: FW }), clump(['H2', 'OT', 'M2', 'R2'], GB, { floor: FW })));
      hz({ t: tAero, tell: tAero - 5, effect: 'share', shape: 'circle', from: 'target', targets: ['H1', 'H2'], r: 5, min: 4, max: 4, dmg: 0.3, name: 'Aeroquell' });
      call(tAero - 5, 'Healer groups', { alert: true, dur: 5 });
      const tw0 = tAero + 1.8, twEnd = tWs + 2.6, TW = [{ shape: 'circle', at: GA, r: 5 }, { shape: 'circle', at: GB, r: 5 }];
      for (const h of ['H1', 'H2']) hz({ t: tw0, tell: tAero + 0.6, shape: 'circle', r: 5, from: 'target', targets: [h], snap: tw0 - tAero, dmg: 0.6, lasts: +(twEnd - tw0).toFixed(1), tick: 1, tickDmg: 0.3, name: 'Aero IV (twister)' });
      // Out of them onto the other diagonal: supports its south end, DPS its north.
      prefOn(tAero + 0.05, Object.assign(clump(SUP, [-4.35, 3], { floor: FW, avoid: TW, m: 1.2 }), clump(DPS, [4.35, 12], { floor: FW, avoid: TW, m: 1.2 })), FW);
      // The chains (each support to a DPS), broken north-east (DPS) and south-west (supports).
      const pairs = shuffle(DPS), tChain = lfCast + 0.8, tBreak = tChain + 2.6;
      prefOn(tChain + 0.05, Object.assign(clump(DPS, [10.5, 18.2], { floor: FW, avoid: TW }), clump(SUP, [-10.5, -3], { floor: FW, avoid: TW })), FW);
      SUP.forEach((s, i) => {
        const d = pairs[i];
        hz({ t: tBreak, tell: tChain, targets: [s], tether: d, stretch: 25, dmg: 0, fail: 0.9, name: 'Biting Chains' });
        for (const x of [s, d]) debuff(x, 'missingLink', 'Missing Link', `break it with ${x === s ? d : s}: DPS north, supports south`, tChain, tBreak);
      });
      call(tChain, 'Break chains: DPS north, supports south', { alert: true, dur: 4 });
      // Legitimate Force: one half, then the other; Wind of Change pushes each 20 east or west along their platform.
      const s1 = pick([1, -1]), h1 = half(-s1), h2 = half(s1);
      hz(Object.assign({ t: t1, tell: lfCast, dmg: 1.4, name: 'Legitimate Force' }, h1));
      hz(Object.assign({ t: t2, tell: t1, dmg: 1.4, name: 'Legitimate Force', react: 3.1 }, h2));
      const kb = {};
      shuffle(S).forEach((s, i) => { kb[s] = i < 4 ? 1 : -1; });
      const row = (s) => (DPS.includes(s) ? 18.2 : -2.9);
      const line = (xOf, avoid) => Object.assign(...[DPS, SUP].map(g => place(g.map(s => [s, [xOf(s), row(s)], 0.9]), { avoid: avoid.concat(TW), m: 1.3, floor: FW })));
      const from = (s) => -kb[s] * 10;              // where its push starts
      pref(tBreak + 0.05, line(() => s1 * 2.4, [h1]));
      pref(t1 + 0.05, line(s => (Math.sign(from(s)) === s1 ? -s1 * 2.4 : -s1 * 10), [h2]));
      const kbStart = line(from, []);
      pref(t2 + 0.05, kbStart);
      for (const s of S) {
        hz({ t: tKb, tell: t2, effect: 'knockback', shape: 'circle', r: 0.3, from: 'target', targets: [s], dir: kb[s] > 0 ? 90 : 270, dist: 20, dmg: 0, name: 'Wind of Change' });
        debuff(s, kb[s] > 0 ? 'westWindOfChange' : 'eastWindOfChange', kb[s] > 0 ? 'West Wind of Change' : 'East Wind of Change', `pushed 20 ${kb[s] > 0 ? 'east' : 'west'} as it runs out`, tAero - 5, tKb);
        call(lfCast + 0.5, `Break chains => ${s1 > 0 ? 'Right => Left' : 'Left => Right'} => Knockback ${kb[s] > 0 ? 'Right' : 'Left'}`, { slot: s, alert: true, dur: 8 });
      }
      pref(tKb + 0.1, Object.fromEntries(S.map(s => [s, add(kbStart[s], [kb[s] * 20, 0])])));
      pref(twEnd + 0.05, UP);
      label(lf[0], `Legitimate Force (${s1 > 0 ? 'east' : 'west'} safe first)`);
      label(lf[1], `Legitimate Force (then ${s1 > 0 ? 'west' : 'east'})`);
      label(woc, 'Wind of Change (pushes east and west)');
      label(vw, 'Virtual Shift (the wind floor)');
    }

    // ===== Prosecution of War: busters on each tank =====
    for (const e1 of events.filter(e => e.name === 'Prosecution of War 1')) {
      const e2 = E('Prosecution of War 2', e1.t, e1.t + 6), cs = castOf(e1, 5);
      hz({ t: e1.t, tell: cs, effect: 'bait', shape: 'circle', from: 'target', targets: ['MT'], r: 3, dmg: 1.2, own: 0.5, buster: true, name: 'Prosecution of War' });
      hz({ t: tOf(e2, e1.t + 3.1), tell: e1.t, effect: 'bait', shape: 'circle', from: 'target', targets: ['OT'], r: 3, dmg: 1.2, own: 0.5, buster: true, name: 'Prosecution of War' });
      call(cs, 'Tank Buster Swap', { dur: 5 });
    }

    // ===== Divide and Conquer: eight baited lines, then all eight again =====
    const dc = E('Divide and Conquer x8', 0, 900);
    if (dc) {
      const cs = castOf(dc, 7.5), refire = E('Divide and Conquer', dc.t, dc.t + 20), tR = tOf(refire, dc.t + 11.1);
      // Fanned out round her, west to east (Hector): T1, H1, M1, R1, R2, M2, H2, T2; then into the gaps between.
      const FAN = ['MT', 'H1', 'M1', 'R1', 'R2', 'M2', 'H2', 'OT'];
      const fan = Object.fromEntries(FAN.map((s, k) => [s, r2(add(BOSS1, at(265 - k * 24.3, 16)))]));
      const GAP = { MT: [252.85, 19.4], H1: [228.55, 22], M1: [204.25, 25], R1: [180, 26], R2: [180, 31], M2: [155.75, 25], H2: [131.45, 22], OT: [107.15, 19.4] };
      const gaps = Object.fromEntries(S.map(s => [s, r2(add(BOSS1, at(GAP[s][0], GAP[s][1])))]));
      const order = shuffle(S);
      order.forEach((s, k) => {
        const tb = +(dc.t + k).toFixed(2);
        hz({ t: tb, tell: Math.max(cs, tb - 3.1), effect: 'bait', shape: 'line', from: 'boss', aim: 'target', targets: [s], len: 60, w: 5, dmg: 0.9, own: 0.15, name: 'Divide and Conquer' });
        hz({ t: tR, tell: tR - 3, shape: 'line', from: 'boss', aim: 'target', targets: [s], snap: +(tR - tb).toFixed(2), len: 60, w: 5, dmg: 1.3, name: 'Divide and Conquer' });
        call(Math.max(cs, tb - 3.1), `Line ${k + 1} on YOU`, { slot: s, dur: 3 });
      });
      pref(cs + 0.2, fan);
      pref(dc.t + 7.1, gaps);
      pref(tR + 0.1, UP);
      call(cs, 'Spread', { alert: true, dur: 5 });
      call(dc.t + 7.1, 'Between the lines', { alert: true, dur: 3 });
      label(dc, `Divide and Conquer (lines on ${order.join(', ')})`);
      label(refire, 'Divide and Conquer (all eight again)');
    }

    // ===== Virtual Shift: earth =====
    const ve = vs[1];
    if (ve) {
      const tEnd = tOf(ws1[1], ve.t + 82.7);
      const laws = E('Laws of Earth', ve.t, ve.t + 20), tLaws = tOf(laws, ve.t + 9.1);
      for (const s of S) debuff(s, 'gravitationalAnomaly', 'Gravitational Anomaly', 'floating: the whole square holds you', ve.t + 0.1, tEnd);
      call(ve.t + 0.2, 'Up', { dur: 3 });
      label(ve, 'Virtual Shift (the earth floor: float)');
      // Legitimate Force, then the eight towers (one each on the platforms).
      const lfE = EA(/^Legitimate Force (Left\/Right|Right\/Left)$/, ve.t, ve.t + 30);
      const t1 = tOf(lfE[0], tLaws + 11.1), t2 = tOf(lfE[1], t1 + 3.1), lfCast = t1 - 8;
      const burst1 = E('Burst', t2, t2 + 8), tB1 = tOf(burst1, t2 + 5);
      const s1 = pick([1, -1]), h1 = half(-s1), h2 = half(s1);
      hz(Object.assign({ t: t1, tell: lfCast, dmg: 1.4, name: 'Legitimate Force' }, h1));
      hz(Object.assign({ t: t2, tell: t1, dmg: 1.4, name: 'Legitimate Force', react: 3.1 }, h2));
      const lfSpots = (side, h) => {
        const mine = S.filter(s => Math.sign(TOWERS1[s][0]) === side), rest = S.filter(s => !mine.includes(s));
        return Object.assign(Object.fromEntries(mine.map(s => [s, TOWERS1[s]])), clump(rest, [side * 2.6, 6], { avoid: [h], floor: SQ }));
      };
      pref(lfCast + 0.2, lfSpots(s1, h1));
      pref(t1 + 0.05, lfSpots(-s1, h2));
      pref(t2 + 0.05, TOWERS1);
      call(lfCast, s1 > 0 ? 'Right => Left' : 'Left => Right', { alert: true, dur: 6 });
      for (const s of S) hz({ t: tB1, tell: tLaws, effect: 'tower', shape: 'circle', at: TOWERS1[s], r: 2, soak: 1, dmg: 0.3, fail: 0.9, name: 'Burst' });
      call(tLaws + 14.3, 'Down, soak tower', { alert: true, dur: 4 });
      label(lfE[0], `Legitimate Force (${s1 > 0 ? 'east' : 'west'} safe first)`);
      label(lfE[1], `Legitimate Force (then ${s1 > 0 ? 'west' : 'east'})`);
      label(burst1, 'Burst (eight towers)');
      // Gravitational Empire: two defamations (to the sides), two tethered cones (to the north corners), four towers.
      const ge = E('Gravitational Empire', tB1, tB1 + 20);
      if (ge) {
        const cs = castOf(ge, 7), pil = E('Gravity Pillar', ge.t, ge.t + 3), ray = E('Gravity Ray', ge.t, ge.t + 3), b2 = E('Burst', ge.t, ge.t + 4);
        const tP = tOf(pil, ge.t + 1), tRy = tOf(ray, ge.t + 1), tB2 = tOf(b2, ge.t + 1.9);
        const ord = shuffle(S), pills = ord.slice(0, 2), rays = ord.slice(2, 4), tw = ord.slice(4);
        const sideOf = (s) => (G1.includes(s) ? -1 : 1);
        const bySide = (list) => { const a = list.slice().sort((x, y) => sideOf(x) - sideOf(y)); if (sideOf(a[0]) === sideOf(a[1])) return { [a[0]]: -1, [a[1]]: 1 }; return { [a[0]]: sideOf(a[0]), [a[1]]: sideOf(a[1])}; };
        const ps = bySide(pills), rs = bySide(rays), spots = {};
        for (const s of pills) spots[s] = [ps[s] * 19, 3];
        for (const s of rays) spots[s] = [rs[s] * 18.4, 18.4];
        const T2 = { W: [[-8, 1], [-8, 11]], E: [[8, 1], [8, 11]] }, free = { W: T2.W.slice(), E: T2.E.slice() };
        const twAt = {};
        for (const s of tw.slice().sort((a, b) => sideOf(a) - sideOf(b))) { const want = sideOf(s) < 0 ? 'W' : 'E', k = free[want].length ? want : (want === 'W' ? 'E' : 'W'); twAt[s] = free[k].shift(); }
        for (const s of tw) spots[s] = twAt[s];
        pref(cs + 0.2, spots);
        hz({ t: tP, tell: cs, effect: 'bait', shape: 'circle', from: 'target', targets: pills, r: 10, dmg: 1.0, own: 0.4, name: 'Gravity Pillar' });
        hz({ t: tRy, tell: cs, effect: 'bait', shape: 'cone', from: 'boss', aim: 'target', targets: rays, half: 30, r: 50, dmg: 1.0, own: 0.4, tether: 'boss', name: 'Gravity Ray' });
        for (const p of T2.W.concat(T2.E)) hz({ t: tB2, tell: cs, effect: 'tower', shape: 'circle', at: p, r: 2, soak: 1, only: tw, dmg: 0.3, fail: 0.9, name: 'Burst' });
        for (const s of pills) { call(cs, `Defamation on YOU: float to the ${ps[s] < 0 ? 'west' : 'east'} side`, { slot: s, alert: true, dur: 6 }); debuff(s, null, 'Gravity Pillar', 'a 10-yalm defamation', cs, tP); }
        for (const s of rays) call(cs, `Cone on YOU: float to the ${rs[s] < 0 ? 'northwest' : 'northeast'} corner`, { slot: s, alert: true, dur: 6 });
        for (const s of tw) call(cs + 0.5, 'Down, soak tower', { slot: s, alert: true, dur: 5 });
        label(ge, `Gravitational Empire (defamations ${pills.join(', ')}; cones ${rays.join(', ')})`);
        label(b2, 'Burst (four towers)');
        // Meteors: one each over the platforms (spread), then one each dropped off them.
        const m1 = E('Meteor Impact 1', tB2, tB2 + 10), m2 = E('Meteor Impact 2', tB2, tB2 + 20);
        const tM1 = tOf(m2, tB2 + 11.4) + 0.1, tM2 = tM1 + 7.1, ic1 = tOf(m1, tB2 + 4.3) + 1.1, ic2 = tM1 + 1;
        pref(tB2 + 0.1, METEOR1);
        hz({ t: tM1, tell: ic1, effect: 'bait', shape: 'circle', from: 'target', targets: S, r: 4, dmg: 0.9, own: 0.3, name: 'Meteor Impact' });
        const OFF = [rect([-20, -20], [-12, 20]), rect([-4, -20], [4, 20]), rect([12, -20], [20, 20]), rect([-12, 14], [12, 20]), rect([-12, -20], [12, -2])];
        for (const r of OFF) hz(Object.assign({ t: tM1, tell: ic1, dmg: 1.2, name: 'Meteor Impact (missed the platforms)' }, r));
        call(ic1, 'Spread: meteors over the platforms', { alert: true, dur: 5 });
        pref(tM1 + 0.1, METEOR2);
        hz({ t: tM2, tell: ic2, raidwide: true, dmg: 0.25, name: 'Meteor Impact' });
        for (const r of [rect([-12, -2], [-4, 14]), rect([4, -2], [12, 14])]) hz(Object.assign({ t: tM2, tell: ic2, dmg: 1.2, name: 'Meteor Impact (dropped on a platform)' }, r));
        call(ic2, 'Float and drop the meteors into the hole (middle)', { alert: true, dur: 5 });
        label(m1, 'Meteor Impact (over the platforms)');
        label(m2, 'Meteor Impact (into the hole)');
        // Weighty Blow: the orbs smash the meteors a column at a time (each pull's way: the platforms' west columns
        // first, or their east), north then south; hide behind the column that lasts, then its south meteor.
        const wbc = E('Weighty Blow', tM2, tM2 + 15), orbs = EA(/^Weighty Blow \d \(orb\)$/, tM2, tM2 + 30).map(e => e.t);
        while (orbs.length < 4) orbs.push((orbs[orbs.length - 1] || tM2 + 7) + 3.1);
        const wbCast = wbc ? castOf(wbc, 5) : orbs[0] - 5, westFirst = Math.random() < 0.5;
        const sideP = { W: G1, E: G2 }, boulders = { W: [], E: [] };
        for (const s of S) boulders[METEOR1[s][0] < 0 ? 'W' : 'E'].push(METEOR1[s]);
        const spotsAt = [{}, {}, {}, {}];
        for (const side of ['W', 'E']) {
          const O = ORB[side], xs = [...new Set(boulders[side].map(p => p[0]))].sort((a, b) => a - b);
          const first = westFirst ? xs[0] : xs[1], second = westFirst ? xs[1] : xs[0];
          const col = (x) => boulders[side].filter(p => p[0] === x).sort((a, b) => b[1] - a[1]);     // north, south
          const seq = col(first).concat(col(second));
          seq.forEach((b, k) => {
            hz({ t: orbs[k], tell: k ? orbs[k - 1] : wbCast, shape: 'line', at: O, deg: brg(O, b), len: dist(O, b), w: 3, dmg: 1.2, name: 'Weighty Blow' });
            mark({ shape: 'circle', at: b, r: 2.04 }, tM1, orbs[k] + 0.1, 'rgba(150,120,90,0.55)');
          });
          const behind = (b, d) => r2(add(b, mul(unit(sub(b, O)), d)));
          const [bN, bS] = col(second), ps = sideP[side].slice().sort((a, b) => METEOR1[b][1] - METEOR1[a][1]);      // north pair first
          ps.forEach((s, j) => {
            const early = j < 2 ? behind(bN, 2.7 + j) : behind(bS, 2.7 + (j - 2)), late = j < 2 ? behind(bS, 4.7 + j) : early;
            for (let k = 0; k < 4; k++) spotsAt[k][s] = k < 3 ? early : late;
          });
          mark({ shape: 'circle', at: O, r: 1.2 }, wbCast, orbs[3] + 0.2, 'rgba(170,90,255,0.6)');
        }
        pref(tM2 + 0.1, spotsAt[0]);
        pref(orbs[2] + 0.1, spotsAt[3]);
        orbs.forEach((tk, k) => check({ t: tk, kind: 'spot', spots: spotsAt[k], r: 1.6, fail: 0.9, name: 'Weighty Blow (not behind a meteor)' }));
        call(wbCast, 'Hide behind rocks', { alert: true, dur: 5 });
        call(orbs[2] + 0.1, 'North pair: behind the south rock', { dur: 3 });
        if (wbc) label(wbc, `Weighty Blow (the ${westFirst ? 'west' : 'east'} columns go first)`);
        pref(tEnd + 0.1, UP);
      }
    }

    // ===== Coronation and Atomic Ray =====
    const cor = E('Coronation', 0, 900);
    if (cor) {
      const tTeth = cor.t + 2.1, rr = E('Ruthless Regalia', cor.t, cor.t + 20), tL = tOf(rr, tTeth + 10);
      const ar = events.find(e => e.name === 'Atomic Ray' && e.kind !== 'cast' && e.t > cor.t && e.t < cor.t + 20), tA = tOf(ar, tL + 1.1);
      const way = Math.random() < 0.5 ? 'cw' : 'ccw', C = CORONATION[way], ord = shuffle(S), cellOf = {}, dirOf = {}, mate = {};
      ['N', 'E', 'S', 'W'].forEach((d, i) => {
        const h = C[d], L = ord[2 * i], R = ord[2 * i + 1];
        cellOf[L] = h.L; cellOf[R] = h.R; dirOf[L] = dirOf[R] = d; mate[L] = R; mate[R] = L;
        hz({ t: tL, tell: tTeth, shape: 'line', at: h.at, deg: h.deg, len: 100, w: 12, dmg: 1.4, name: 'Ruthless Regalia' });
        for (const s of [L, R]) hz({ t: tL, tell: tTeth, targets: [s], tether: h.at, dmg: 0, quiet: true, name: 'Coronation' });
        mark({ shape: 'circle', at: h.at, r: 1 }, tTeth, tL + 0.2, 'rgba(255,215,120,0.7)');
      });
      const cells = Object.fromEntries(S.map(s => [s, CELL[cellOf[s]]]));
      pref(tTeth + 0.2, cells);
      check({ t: tL, kind: 'spot', spots: cells, r: 4, fail: 0.9, name: 'Coronation (not on your side of your laser)' });
      const DN = { N: 'North', E: 'East', S: 'South', W: 'West' };
      for (const s of S) call(tTeth, `${DN[dirOf[s]]} laser, ${CELL_NAME[cellOf[s]]} side, w/ ${mate[s]}`, { slot: s, alert: true, dur: 8 });
      hz({ t: tA, tell: tA - 6, effect: 'bait', shape: 'circle', from: 'target', targets: S, r: 16, dmg: 0.9, own: 0.35, name: 'Atomic Ray' });
      call(tA - 6, 'Spread', { dur: 4 });
      label(cor, `Coronation (lasers turning ${way === 'cw' ? 'clockwise' : 'counterclockwise'})`);
      label(rr, 'Ruthless Regalia (the lasers)');
      label(ar, 'Atomic Ray (spreads)');
      pref(tA + 0.1, UP);
    }

    // ===== Absolute Authority (Hector's cheese) =====
    const aa = E('Absolute Authority', 0, 900);
    if (aa) {
      const cs = castOf(aa, 10), fs = E('Absolute Authority (Flares/Stack)', aa.t, aa.t + 15), heel = E('Absolute Authority (Dorito Stack)', aa.t, aa.t + 20);
      const kbe = E('Absolute Authority (Knockback)', aa.t, aa.t + 30);
      const tFs = tOf(fs, aa.t + 10) + 0.1, tHeel = tOf(heel, aa.t + 14.1), tKb = tOf(kbe, aa.t + 21);
      // The clump's path: from the north-west corner along the north wall, a wave of puddles every 2 s, to the
      // north-east (where it stays for the stack, the flares, the dorito and the knockback south).
      const OFF8 = [[0, 0], [0.7, 0], [-0.7, 0], [0, 0.7], [0, -0.7], [0.7, -0.7], [-0.7, -0.7], [0.7, 0.7]];
      const W = [[aa.t + 0.1, [-18, 17.4]], [aa.t + 2.1, [-10.5, 17.4]], [aa.t + 4.1, [-1.5, 17.2]], [aa.t + 6.1, [7, 17.2]], [aa.t + 8.5, [17.8, 12.3]]];
      const along = (t) => {
        if (t <= W[0][0]) return W[0][1];
        for (let i = 1; i < W.length; i++) if (t <= W[i][0]) { const k = (t - W[i - 1][0]) / (W[i][0] - W[i - 1][0]); return add(W[i - 1][1], mul(sub(W[i][1], W[i - 1][1]), k)); }
        return W[W.length - 1][1];
      };
      const nw = Object.fromEntries(S.map((s, i) => [s, add(W[0][1], OFF8[i])]));
      pref(cs + 0.2, nw);
      P.prefs.push({ t: aa.t + 0.1, spots: Object.fromEntries(S.map((s, i) => [s, (t) => add(along(t), OFF8[i])])) });
      for (const [s, i] of S.map((s, i) => [s, i])) last[s] = add(W[W.length - 1][1], OFF8[i]);
      for (let k = 0; k < 4; k++) {
        const drop = aa.t + 0.1 + 2 * k;
        hz({ t: drop + 4, tell: drop, shape: 'circle', r: 8, from: 'target', targets: shuffle(S).slice(0, 4), snap: 4, dmg: 1.3, name: 'Absolute Authority (puddle)' });
      }
      [6.7, 11.5, 15, 18].forEach(d => hz({ t: +(aa.t + d).toFixed(2), tell: aa.t, raidwide: true, dmg: 0.07, name: 'Absolute Authority' }));     // its ten light hits, as four
      // Each player's debuffs: four flares, the rest stacks; six doritos.
      const ord = shuffle(S), flares = ord.slice(0, 4), boots = ord.slice(4), heels = shuffle(S).slice(0, 6);
      // (The cheese: all eight stacked take the four flares and the stack together, one shared hit.)
      hz({ t: tFs, tell: aa.t + 0.5, effect: 'share', shape: 'circle', from: 'target', targets: [boots[0]], r: 6, min: 8, max: 8, dmg: 0.45, name: 'Absolute Authority (flares and stack)' });
      hz({ t: tHeel, tell: aa.t + 0.5, effect: 'share', shape: 'circle', from: 'target', targets: [heels[0]], r: 3, min: 2, max: 8, dmg: 0.3, name: 'Absolute Authority (dorito stack)' });
      for (const s of S) {
        const fl = flares.includes(s);
        debuff(s, fl ? 'authoritysExpansion' : 'authoritysBoot', fl ? 'Authority\'s Expansion' : 'Authority\'s Boot', fl ? 'a flare: stay stacked (mitigate)' : 'a stack: stay stacked', aa.t + 0.5, tFs);
        if (heels.includes(s)) debuff(s, 'authoritysHeel', 'Authority\'s Heel', 'the dorito: stay stacked', tFs, tHeel);
        call(aa.t + 1.5, `${fl ? 'Flare Marker Spread' : 'Stack Marker'} => Dorito Stack (cheese: stay stacked, mitigate)`, { slot: s, dur: 6 });
      }
      hz({ t: tKb, tell: tKb - 15, effect: 'knockback', at: [0, 10], dir: 180, dist: 30, dmg: 0, name: 'Absolute Authority (knockback)' });
      call(cs, 'Stack northwest: bait puddles along the north wall', { alert: true, dur: 6 });
      call(tHeel + 0.5, 'Knockback south (KBI)', { alert: true, dur: 5 });
      label(aa, 'Absolute Authority (puddles along the north wall)');
      label(fs, 'Absolute Authority (flares and stack: stay stacked)');
      label(heel, 'Absolute Authority (dorito stack)');
      label(kbe, 'Absolute Authority (knockback south)');
      pref(tKb + 0.2, Object.fromEntries(S.map((s, i) => [s, add([17.8, -17.7], OFF8[i])])));
    }

    // ===== Virtual Shift: ice =====
    const vi = vs[2];
    if (vi) {
      const FI = floorOf(ICE, 0.9), FB = floorOf(ICEB, 0.9);
      label(vi, 'Virtual Shift (the ice floor)');
      // On the middle platform as it comes.
      const MID = assign(S, [[-0.9, 6.5], [0.9, 6.5], [-0.9, 2.2], [0.9, 2.2], [-0.9, -2.2], [0.9, -2.2], [-0.9, -6.5], [0.9, -6.5]]);
      pref(castOf(vi, 5) - 8, MID);
      const laws = events.filter(e => e.name === 'Laws of Ice (motion)' && e.t > vi.t && e.t < vi.t + 80);
      // Laws of Ice: keep moving while it freezes (the bots step back and forth).
      const shuffleMove = (t0, t1, base) => {
        P.prefs.push({ t: t0, spots: Object.fromEntries(S.map(s => [s, (t) => (t < t1 ? add(base[s], [0, 0.8 * Math.sin((t - t0) * 5)]) : base[s])])) });
      };
      laws.forEach(e => {
        for (const s of S) debuff(s, 'freezingUp', 'Freezing Up', 'keep moving till it ends', e.t, e.t + 4.2);
        call(e.t - 4, 'Laws of Ice: move around', { alert: true, dur: 4 });
        label(e, 'Laws of Ice (keep moving)');
      });
      if (laws[0]) shuffleMove(laws[0].t, laws[0].t + 4.2, MID);
      // Rush: each player's ice pillar; stretch it to the far side (outer tethers by the north bridge, inner the south).
      const rush = E('Rush', vi.t, vi.t + 40), tRush = tOf(rush, vi.t + 26.3) + 0.2, tTeth = (laws[0] ? laws[0].t : vi.t + 9.1) + 5.3;
      const pil = assign(shuffle(S), PILLARS), bridgeOf = (s) => (Math.abs(pil[s].at[0]) > 8 ? 4 : -4);
      prefWalk(tTeth, Object.fromEntries(S.map(s => { const p = pil[s], sx = Math.sign(p.spot[0]), by = bridgeOf(s); return [s, [[0, by], [sx * 10, by], p.spot]]; })));
      for (const s of S) {
        const p = pil[s];
        hz({ t: tRush, tell: tTeth, effect: 'bait', shape: 'line', from: p.at, aim: 'target', targets: [s], len: 80, w: 4, dmg: 1.0, own: 0.4, tether: p.at, stretch: 16, fail: 0.9, name: 'Rush' });
        call(tTeth, `Spread ${p.spot[0] > 0 ? 'East' : 'West'}, stretch tethers (${bridgeOf(s) > 0 ? 'north' : 'south'} bridge)`, { slot: s, alert: true, dur: 6 });
      }
      for (const p of PILLARS) mark({ shape: 'circle', at: p.at, r: 1.2 }, tTeth, tRush + 0.2, 'rgba(170,220,255,0.75)');
      label(rush, 'Rush (stretch the tethers)');
      // Legitimate Force: back to the bridges (the same one), the safe side's half, then the other.
      const lfI = EA(/^Legitimate Force (Left\/Right|Right\/Left)$/, tRush - 15, tRush + 20);
      const t1 = tOf(lfI[0], tRush + 7.6), t2 = tOf(lfI[1], t1 + 3.1), s1 = pick([1, -1]), h1 = half(-s1), h2 = half(s1);
      hz(Object.assign({ t: t1, tell: t1 - 8, dmg: 1.4, name: 'Legitimate Force' }, h1));
      hz(Object.assign({ t: t2, tell: t1, dmg: 1.4, name: 'Legitimate Force', react: 3.1 }, h2));
      const onBridge = (side) => {
        const out = {}, slot = { 4: 0, '-4': 0 };
        for (const s of S) { const by = bridgeOf(s), k = slot[by]++; out[s] = [side * (2.6 + 3 * Math.floor(k / 2)), by + (k % 2 ? 0.7 : -0.7)]; }
        return out;
      };
      const bS1 = onBridge(s1), bS2 = onBridge(-s1);
      prefWalk(tRush + 0.1, Object.fromEntries(S.map(s => { const by = bridgeOf(s), sx = Math.sign(pil[s].spot[0]); return [s, [[sx * 10, by], bS1[s]]]; })));
      pref(t1 + 0.05, bS2);
      call(t1 - 8, s1 > 0 ? 'Right => Left (on the bridges)' : 'Left => Right (on the bridges)', { alert: true, dur: 6 });
      label(lfI[0], `Legitimate Force (${s1 > 0 ? 'east' : 'west'} safe first)`);
      label(lfI[1], `Legitimate Force (then ${s1 > 0 ? 'west' : 'east'})`);
      // Back to the middle platform's south end; then Laws of Ice again; then Drear Rising's four rounds.
      const STK = (who) => place(who.map(s => [s, [0, -7], 0.75]), { floor: FI });
      prefOn(t2 + 0.1, STK(S), FB);
      if (laws[1]) shuffleMove(laws[1].t, laws[1].t + 4.2, STK(S));
      const darts = events.filter(e => e.name === 'Ice Dart' && e.t > vi.t && e.t < vi.t + 100);
      const tribs = events.filter(e => e.name === 'Raised Tribute' && e.t > vi.t && e.t < vi.t + 100);
      const corner = { M1: [-13.5, 18.5], MT: [-13.5, 18.5], M2: [13.5, 18.5], OT: [13.5, 18.5] };
      const out = (s) => { const x = Math.sign(corner[s][0]); return [[0, 4], [x * 10, 4], corner[s]]; };
      const back = (s, spot) => { const x = Math.sign(corner[s][0]); return [[x * 12, -4], [0, -4], spot]; };
      let prevEnd = laws[1] ? laws[1].t + 1 : t2 + 10;
      darts.forEach((d, k) => {
        const holders = k === 0 ? ['M1', 'M2'] : TANKS, rest = S.filter(s => !holders.includes(s));
        const tgt = pick(k < 2 ? rest.filter(s => /^[HR]/.test(s)) : rest.filter(s => !TANKS.includes(s)));
        const stack = STK(rest);
        if (k === 0) {
          const thaw = laws[1] ? laws[1].t + 4.2 : prevEnd;          // still moving while Laws of Ice freezes
          P.prefs.push({ t: prevEnd, spots: Object.fromEntries(rest.map(s => [s, (t) => (t < thaw ? add(stack[s], [0, 0.6 * Math.sin((t - prevEnd) * 5)]) : stack[s])])) });
          for (const s of rest) last[s] = stack[s];
          prefWalk(prevEnd, Object.fromEntries(holders.map(s => [s, out(s)])));
        }
        if (k === 1) {
          prefWalk(darts[0].t + 0.1, Object.assign(Object.fromEntries(['M1', 'M2'].map(s => [s, back(s, stack[s])])), Object.fromEntries(TANKS.map(s => [s, out(s)]))));
        }
        hz({ t: d.t, tell: prevEnd, effect: 'bait', shape: 'circle', from: 'target', targets: holders, r: 16, dmg: 1.0, own: k ? 0.5 : 0.35, buster: k > 0, tether: 'boss', name: 'Ice Dart' });
        hz({ t: tOf(tribs[k], d.t), tell: d.t - 6, effect: 'share', shape: 'line', from: 'boss', aim: 'target', targets: [tgt], len: 80, w: 8, min: 4, max: 6, dmg: 0.35, name: 'Raised Tribute' });
        for (const s of holders) call(prevEnd, `Ice Dart tether on YOU: out to the ${corner[s][0] < 0 ? 'northwest' : 'northeast'} corner (north bridge)`, { slot: s, alert: true, dur: 5 });
        call(d.t - 6, `Line stack on ${tgt}`, { dur: 4 });
        label(d, `Ice Dart (tethers: ${holders.join(', ')})`);
        prevEnd = d.t + 0.1;
      });
      pref(tOf(ws1[2], prevEnd + 8) + 0.15, UP);
    }

    // ===== Legitimate Force on the square (the last one) =====
    for (const e1 of events.filter(e => e.name === 'Legitimate Force Left/Right' && e.t < 900)) {
      const inWind = vs[0] && ws1[0] && e1.t > vs[0].t && e1.t < ws1[0].t, inEarth = vs[1] && ws1[1] && e1.t > vs[1].t && e1.t < ws1[1].t;
      const inIce = vs[2] && ws1[2] && e1.t > vs[2].t && e1.t < ws1[2].t;
      if (inWind || inEarth || inIce) continue;
      const e2 = E('Legitimate Force Right/Left', e1.t, e1.t + 5), t2 = tOf(e2, e1.t + 3.1), s1 = pick([1, -1]), h1 = half(-s1), h2 = half(s1);
      hz(Object.assign({ t: e1.t, tell: e1.t - 8, dmg: 1.4, name: 'Legitimate Force' }, h1));
      hz(Object.assign({ t: t2, tell: e1.t, dmg: 1.4, name: 'Legitimate Force', react: 3.1 }, h2));
      pref(e1.t - 7.8, Object.assign(clump(G1, [s1 * 4, 8], { avoid: [h1], floor: SQ }), clump(G2, [s1 * 7, 4], { avoid: [h1], floor: SQ })));
      pref(e1.t + 0.05, Object.assign(clump(G1, [-s1 * 4, 8], { avoid: [h2], floor: SQ }), clump(G2, [-s1 * 7, 4], { avoid: [h2], floor: SQ })));
      pref(t2 + 0.1, UP);
      call(e1.t - 8, s1 > 0 ? 'Right => Left' : 'Left => Right', { alert: true, dur: 6 });
      label(e1, `Legitimate Force (${s1 > 0 ? 'east' : 'west'} safe first)`);
      label(e2, `Legitimate Force (then ${s1 > 0 ? 'west' : 'east'})`);
    }

    // ===== phase 2 =====
    pref(989.9, UP);
    // Radical Shift: the new floor (and 5-yalm spreads on it); between two, stand where both floors are.
    const spr = events.filter(e => e.name === 'Radical Shift (spread)');
    let prevSpread = null;
    rot.forEach((ev, k) => {
      const plat = plats[k], F = FLOOR[plat], cs = castOf(ev, 11), sp = spr.find(e => e.t > ev.t && e.t < ev.t + 8), ts = tOf(sp, ev.t + 5.1);
      const spots = SPREAD[plat];
      if (k % 2 === 0) pref(cs + 1.2, spots);
      else {
        const A = FLOOR[plats[k - 1]], waits = meet(plats[k - 1], plat, last);
        prefOn(Math.max(prevSpread + 0.1, cs + 1.2), waits, floorOf(A, 0.9));
        prefOn(ev.t + 0.15, spots, floorOf(F, 0.9));
      }
      hz({ t: ts, tell: ts - 10, effect: 'bait', shape: 'circle', from: 'target', targets: S, r: 5, dmg: 0.9, own: 0.3, name: 'Radical Shift' });
      call(cs + 1, `${PLAT_NAME[plat]} => Spread`, { alert: true, dur: 6 });
      label(ev, `Radical Shift (to the ${plat} floor)`);
      label(sp, 'Radical Shift (spreads)');
      prevSpread = ts;
      if (k % 2 && ws2[(k - 1) / 2]) pref(ws2[(k - 1) / 2].t + 0.15, UP);
    });
    // Dimensional Distortion: exaflares down the columns, one wave (three or two lines) then the other 2 s later.
    const ddv = E('Dimensional Distortion', 900, 2000);
    if (ddv) {
      const t0 = ddv.t + 1, cs = castOf(ddv, 4), three = Math.random() < 0.5;
      const cols = (n3) => (n3 ? [-17, 0, 17] : [-8.5, 8.5]), A = cols(three), Bc = cols(!three);
      [[A, t0, cs], [Bc, t0 + 2, cs + 2]].forEach(([xs, tt, tell0]) => xs.forEach(x => {
        B.mechSeq.exaflare({ at: [x, 18], deg: 180, t: tt, n: 5, r: 6, step: 8.5, every: 1.1, show: 2, dmg: 1.3, name: 'Dimensional Distortion' })
          .forEach((h, j) => hz(Object.assign(h, { tell: j ? h.tell : tell0, react: j ? h.react : 3 })));
      }));
      // In the second wave's columns at the north edge; into the first's once its first row has gone off; down
      // behind it; then back (south) for Tyranny's Grasp.
      const colOf = (xs) => { const out = {}; const groups = xs.length === 2 ? [G1, G2] : [['MT', 'M1', 'R1'], ['H1', 'H2'], ['OT', 'M2', 'R2']]; groups.forEach((g, i) => g.forEach((s, j) => { out[s] = [xs[i] + (j % 2 ? 0.3 : -0.3), 18.3 - j]; })); return out; };
      pref(cs + 0.2, colOf(Bc));
      const inA = colOf(A);
      pref(t0 + 0.05, inA);
      pref(t0 + 3.4, Object.fromEntries(S.map(s => [s, [inA[s][0], inA[s][1] - 21.5]])));
      label(ddv, `Dimensional Distortion (${three ? 'three' : 'two'} lines first)`);
      call(cs, 'Dodge exaflares: start in the second wave\'s columns', { alert: true, dur: 5 });
      // Tyranny's Grasp: the north half, a tank tower each side.
      const tg = E('Tyranny\'s Grasp (front)', ddv.t, ddv.t + 20);
      if (tg) {
        const tcs = castOf(tg, 5), lt = E('Tyranny\'s Grasp (left tower)', tg.t, tg.t + 5), rt = E('Tyranny\'s Grasp (right tower)', tg.t, tg.t + 8);
        hz({ t: tg.t, tell: tcs, shape: 'rect', a: [-20, 0], b: [20, 20], dmg: 1.4, name: 'Tyranny\'s Grasp' });
        hz({ t: tOf(lt, tg.t + 1.2), tell: tcs, effect: 'tower', shape: 'circle', at: [-13, -2], r: 4, soak: 1, only: ['MT'], dmg: 0.55, fail: 0.9, name: 'Tyranny\'s Grasp (tank tower)' });
        hz({ t: tOf(rt, tg.t + 4), tell: tcs, effect: 'tower', shape: 'circle', at: [13, -2], r: 4, soak: 1, only: ['OT'], dmg: 0.55, fail: 0.9, name: 'Tyranny\'s Grasp (tank tower)' });
        const others = S.filter(s => !TANKS.includes(s));
        pref(t0 + 6.5, Object.assign({ MT: [-13, -3.6], OT: [13, -3.6] }, clump(others, [0, -9], { floor: SQ })));
        call(tcs, 'Back, Tank Towers => AoE', { alert: true, dur: 5 });
        call(tcs, 'Left tower (tank buster)', { slot: 'MT', alert: true, dur: 5 });
        call(tcs, 'Right tower (tank buster)', { slot: 'OT', alert: true, dur: 5 });
        P.boss.push({ t: tg.t + 0.1, at: BOSS2, move: 1 });
        pref(tOf(rt, tg.t + 4) + 0.2, UP);
        label(tg, 'Tyranny\'s Grasp (the north half)');
      }
    }
    // Royal Banishment: eight line stacks from her on one player.
    const rb = E('Royal Banishment x7', 900, 2000);
    if (rb) {
      const cs = castOf(rb, 5), last8 = E('Royal Banishment (big)', rb.t, rb.t + 15), tgt = pick(S), step = (rb.dur || 6.9) / 6;
      const spots = place([[tgt, [0, -6], 0.7]].concat(S.filter(s => s !== tgt).map(s => [s, [0, -6], 0.7])), { floor: SQ });
      pref(cs - 2, spots);
      for (let k = 0; k < 8; k++) {
        const t = k < 7 ? +(rb.t + step * k).toFixed(2) : tOf(last8, rb.t + 9.9);
        hz({ t, tell: k ? +(rb.t + step * (k - 1)).toFixed(2) : cs - 0.2, effect: 'share', shape: 'line', from: 'boss', aim: 'target', targets: [tgt], len: 60, w: 10, min: 4, max: 8, dmg: k < 7 ? 0.12 : 0.4, name: 'Royal Banishment' });
      }
      call(cs - 0.2, `Line stack on ${tgt} (x8)`, { alert: true, dur: 6 });
      label(rb, `Royal Banishment (line stacks on ${tgt})`);
      pref(tOf(last8, rb.t + 9.9) + 0.2, UP);
    }

    P.arena = arena.sort((a, b) => a.t - b.t);
    P.looks.sort((a, b) => a.t - b.t);
    P.boss.sort((a, b) => a.t - b.t);
    P.debuffs = P.debuffs.filter(d => d.slot);
    return P;
  }

  B.FIGHT_SCRIPTS = B.FIGHT_SCRIPTS || {};
  B.FIGHT_SCRIPTS.ex3 = {
    // FFLogs' max HP in a kill (report XCVzmb1NJQvhH4Ld): Queen Eternal 65,341,983 in phase 1 (BNpcBase 18039) and
    // 18,112,577 in phase 2 (18040).
    hp: 83454560,
    // Phase 1 ends when its HP does (the Queen casts Authority Eternal: phase 2's block at 1000 s, from its 10 s cast);
    // at the cast the game would enrage her instead, the sim plays on.
    pushes: [
      { from: 0, to: 990, dealt: 65341983, name: 'Phase 1 done' },
      { from: 476.9, to: 990, dealt: 0, name: 'Phase 1 over' },
    ],
    defaultStrat: 'hector',
    strats: {
      hector: { label: 'Hector (NA)' },
    },
    source: 'wtfdig.info/71/ex3; mechanics after BossMod (github.com/awgil/ffxiv_bossmod) and FFLogs kills',
    // A north, B east, C south, D west; 1-4 the corners (1 north-west, then clockwise): Coronation's cells.
    waymarks: [
      { label: 'A', at: [0, 17.5], color: 'red' }, { label: 'B', at: [17.5, 0], color: 'yellow' },
      { label: 'C', at: [0, -17.5], color: 'blue' }, { label: 'D', at: [-17.5, 0], color: 'purple' },
      { label: '1', at: [-17.5, 17.5], color: 'red', square: true }, { label: '2', at: [17.5, 17.5], color: 'yellow', square: true },
      { label: '3', at: [17.5, -17.5], color: 'blue', square: true }, { label: '4', at: [-17.5, -17.5], color: 'purple', square: true },
    ],
    plan,
  };
})(window.BLM);
