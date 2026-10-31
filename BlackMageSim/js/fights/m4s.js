// M4S, AAC Light-heavyweight M4 (Savage): Wicked Thunder's mechanics for the sim's party, on cactbot's timeline
// (07-dt/raid/r4s), and the strat wtfdig.info lists for the fight: Shabin/Hector (pastebin teF90QGm, NA; its Sunrise
// Sabbath toggle on Normal). Spots are [east, north] yalms from the arena's middle.
//
// One HP pool over two phases (FFLogs logs both bodies with the same 114,525,943 max HP; phase 2 picks up where
// phase 1's HP left off) and no HP push: phase 1 ends on the timeline (Electrope Transplant, then the transition's
// four raidwides). Phase 1 is fought on a 40 x 40 square at (100, 100) with Wicked Thunder (R4.9) in it; phase 2 on
// a 40 x 30 platform 65 yalms south, at (100, 165), with her second form (R22.5) filling its north wall. The sim brings
// phase 2's floor to the middle (the plan's looks shift it 65 yalms north) and works in its own coordinates, so the
// boss stands at [0, 15].
//
// The mechanics follow BossMod's module (RM04SWickedThunder, github.com/awgil/ffxiv_bossmod), whose shapes and
// sizes come from the game's Action sheet, with positions from FFLogs kills where BossMod reads them off the actors:
//   Phase 1:
//   - Bewitching Flight: five 5-wide lines down from the boss (north) and five across from the gun batteries on one
//     side, 8 yalms apart: stand in a safe intersection.
//   - Electrifying Witch Hunt: the flight's lines burst 16 wide, the inner three or the outer two (then the others):
//     spread (one hit per quadrant, who keep Forked Lightning), then Witch Hunt's near or far four (the rest).
//   - Narrowing/Widening Witch Hunt: in/out four times, 3.4 s apart, each with two near or far baits (alternating):
//     tanks and healers bait the first two, melee and ranged the last two (modified clocks).
//   - Electrope Edge: mines on the intercards hit once or twice by Witchgleam (diagonal lines from the boss); once: a
//     10 x 10 square round the mine, twice: its whole 30 x 30 quadrant; Sidewise Spark cleaves the east or west half:
//     the one safe quadrant, with Four Star (pairs on the supports) or Eight Star (spreads).
//   - Wicked Jolt: a 5-wide line at the main tank, then at the other.
//   - Lightning Cage: Electrical Condenser short or long; four Witchgleam protean lines give each player 2 or 3 stacks
//     (longs 1 or 2, then +1); twelve of the 5 x 5 cage's 8-yalm cells explode (BossMod's four patterns), each
//     condenser leaves a 24 x 24 (two stacks) or 40 x 40 (three) square: supports one side, DPS the other, the rest
//     in the pattern's safe cell. Between the two anchors, Sidewise Spark with Four Star (on the longs) or Eight Star.
//   - Wicked Bolt: a five-hit stack on one player.
//   - Ion Cluster: Stampeding Thunder takes three of the four 10-wide lanes; three Electron Streams (yellow and blue
//     halves of the lane, north and south of the boss: stand in the other colour) and the conductors 5 s after each:
//     a cone owner front-middle and a collider behind (proximate: its own side's, remote: the far side's), small
//     circles and donuts front-left (supports) and front-right (DPS).
//   - Electrope Transplant: Fulminous Field's eight cones turning 22.5 degrees each 3 s, seven times, twice: pairs in
//     the gaps; Conduction Point's spreads on one role and Forked Fissures' 10-wide wild charges at them (partner in
//     front).
//   - The transition's four raidwides; phase 2 begins with Cross Tail Switch (nine hits).
//   Phase 2:
//   - Sabertail: sixteen exaflares (6-yalm circles, 6.5 yalms a step, the logged pattern turned at random) with Wicked
//     Blaze's four-hit light-party stacks on the healers; each group finds its way along its edge (worked out per pull).
//   - Wicked Special: the middle 20 or the two 15-wide sides.
//   - Mustard Bomb: tethers to the tanks, Kindling Cauldron spreads on four, the bombs passed to the two left.
//   - Aetherial Conversion: stored fire (18-yalm circles at x -10 / +10, one then the other) or water (25-yalm
//     knockbacks from them), resolved later.
//   - Azure Thunder: the floor becomes a 15-yalm circle; Twilight Sabbath (two clone cleaves of half the room each, twice,
//     the safe quadrants; Wicked Fire's puddles dropped in the middle; Wicked Special with the second), Midnight Sabbath
//     (four clones on the cardinals or intercards, cannons (10-wide lines) or wings (5-15 donuts), twice, with
//     Concentrated or Scattered Burst's pairs and spreads), Wicked Thunder (the square back).
//   - Flame Slash: the middle 20 falls; Raining Swords' eight towers (one each, TMRH north to south, G1 west, G2 east);
//     Chain Lightning's 7-yalm explosions on the swords, four rounds with one safe sword a side.
//   - Sunrise Sabbath (Ion Cluster's yellow/blue, short/long): towers (two each) on two opposite cardinals at the
//     edge, cannons on the intercards baited into the wall away from them, the opposite colour; Wicked Special; then
//     the other half swaps.
//   - Sword Quiver x3: four raidwides, three fixed lines and one east-west line (north, middle or south), Laceration's
//     cones at each pair (melee pairs north, ranged pairs south).
// Simplified: Witchgleam's stack counts are dealt out (the lines are aimed so they land); the conductors' cones go to
// their designated collider; Laceration is four shared cones, one per pair; the clones are drawn as their shapes only.
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
  // A point turned clockwise (compass) round the middle.
  const rot = (p, d) => { const a = d * Math.PI / 180, c = Math.cos(a), s = Math.sin(a); return [p[0] * c + p[1] * s, -p[0] * s + p[1] * c]; };
  const SUP = ['MT', 'OT', 'H1', 'H2'], DPS = ['M1', 'M2', 'R1', 'R2'], TANKS = ['MT', 'OT'];
  const G1 = ['MT', 'H1', 'M1', 'R1'], G2 = ['OT', 'H2', 'M2', 'R2'];
  const PAIRS = [['MT', 'M1'], ['OT', 'M2'], ['H1', 'R1'], ['H2', 'R2']];
  const COMPASS = ['north', 'north-northeast', 'northeast', 'east-northeast', 'east', 'east-southeast', 'southeast', 'south-southeast',
    'south', 'south-southwest', 'southwest', 'west-southwest', 'west', 'west-northwest', 'northwest', 'north-northwest'];
  const dirName = (deg) => COMPASS[Math.round(deg360(deg) / 22.5) % 16];
  const DIR8 = ['north', 'northeast', 'east', 'southeast', 'south', 'southwest', 'west', 'northwest'];
  const dir8 = (deg) => DIR8[Math.round(deg360(deg) / 45) % 8];

  // ---------- the floors ----------
  const SQUARE = { shape: 'square', half: 20, deathwall: true };
  const RECT2 = { shape: 'rect', a: [-20, -15], b: [20, 15], deathwall: true };
  const CIRCLE2 = { shape: 'circle', at: [0, 0], r: 15, deathwall: true };
  const LANES2 = { parts: [{ shape: 'rect', a: [-20, -15], b: [-10, 15] }, { shape: 'rect', a: [10, -15], b: [20, 15] }], deathwall: true };
  const laneP1 = (L) => ({ shape: 'rect', a: [L - 5, -20], b: [L + 5, 20], deathwall: true });
  const onShape = (s, p, m) => {
    if (s.shape === 'circle') return dist(p, s.at || [0, 0]) < s.r - m;
    if (s.shape === 'rect') return p[0] > Math.min(s.a[0], s.b[0]) + m && p[0] < Math.max(s.a[0], s.b[0]) - m && p[1] > Math.min(s.a[1], s.b[1]) + m && p[1] < Math.max(s.a[1], s.b[1]) - m;
    return Math.abs(p[0]) < 20 - m && Math.abs(p[1]) < 20 - m;
  };
  const floorOf = (a, m) => (p) => (a.parts || [a]).some(s => onShape(s, p, m === undefined ? 0.9 : m));
  // The arena's looks (the zone's models): phase 1's four lanes, phase 2's (65 yalms south, brought to the middle) with
  // the red dots of Aetherial Conversion and the screens round it; the floor's inset panels (a1_cub) go with each.
  const LOOK1 = ['a1_lan01', 'a1_lan02', 'a1_lan03', 'a1_cub', 'a2_pic'];
  const LOOK2 = ['a1_lan04', 'a1_lan05', 'a1_lan06', 'a1_mgp', 'a1_cub', 'a2_pic'];
  const P2SHIFT = [0, 65];

  // ---------- placing the party ----------
  // Each [slot, want, sep] in turn: the nearest point to `want` on the floor, clear of the shapes in `avoid` (by m
  // yalms) and at least sep (or the other's, whichever is more) from those already placed.
  function place(list, o) {
    o = o || {};
    const m = o.m === undefined ? 1.3 : o.m, avoid = o.avoid || [], floor = o.floor || (() => true), done = (o.keep || []).map(p => ({ p, sep: o.keepSep || 0 }));
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
  const clumpAt = (slots, c, o) => place(slots.map(s => [s, c, 0.55]), o);
  const assign = (slots, pts) => Object.fromEntries(slots.map((s, i) => [s, pts[i]]));

  // ---------- the party's places ----------
  // Phase 1: the boss in the middle facing north (hitbox 4.9): the tanks at her front, everyone else behind.
  const UP1 = { MT: [0, 6.2], OT: [3, 5.6], M1: [-2.5, -6], M2: [2.5, -6], H1: [-6, -10], H2: [6, -10], R1: [-9.5, -7], R2: [9.5, -7] };
  // Phase 2: she fills the north wall (hitbox 22.5 from [0, 15]); everyone in reach, inside the circle she makes.
  const UP2 = { MT: [-2, 9], OT: [2, 9], M1: [-4.5, 4], M2: [4.5, 4], H1: [-6, -3], H2: [6, -3], R1: [-10, 0], R2: [10, 0] };

  // Lightning Cage's four patterns (BossMod's): the twelve cells that explode, by index (row << 3 | column, rows
  // north to south, columns west to east, 8 yalms each from -16), and the pattern's turn: its safe cell is north in
  // pattern 0 and turns clockwise 90 degrees a pattern.
  const CAGE = [
    { cells: [0, 1, 3, 4, 10, 18, 24, 26, 28, 33, 34, 35], turn: 0 },
    { cells: [1, 4, 8, 12, 16, 17, 18, 19, 24, 28, 33, 36], turn: 90 },
    { cells: [1, 2, 3, 8, 10, 12, 18, 26, 32, 33, 35, 36], turn: 180 },
    { cells: [0, 3, 8, 12, 17, 18, 19, 20, 24, 28, 32, 35], turn: 270 },
  ];
  const cellAt = (i) => [-16 + 8 * (i & 7), 16 - 8 * (i >> 3)];
  // Pattern 0's spots: the safe cell (north middle), supports west (two stacks the north-west cell, three the
  // south-west corner), DPS east the same.
  const CAGE0 = { safe: [0, 16], sup2: [-16, 8], sup3: [-16, -16], dps2: [16, 8], dps3: [16, -16] };

  // Sabertail's exaflares as logged (FFLogs): a 4 x 4 grid, each one's way (the pull turns it at random).
  const SABER = [[15, -15, 'W'], [-5, -15, 'N'], [5, -15, 'N'], [15, -5, 'W'], [-15, -15, 'E'], [-5, -5, 'S'], [5, -5, 'S'], [15, 5, 'W'],
    [-15, -5, 'E'], [-5, 5, 'N'], [5, 5, 'N'], [15, 15, 'E'], [-15, 5, 'W'], [-5, 15, 'S'], [5, 15, 'S'], [-15, 15, 'E']];
  const WAY = { N: [0, 1], S: [0, -1], E: [1, 0], W: [-1, 0] };
  // A way for a light party through the exaflares (each step `ex[k]`'s circles, `every` s apart): a spot per step, each
  // 6.9 or more from that step's circles and at most `reach` from the last, on the `side` half of the floor; the
  // first nearest `anchor`, then moving as little as it can.
  function exaPath(steps, side, anchor, reach) {
    const pts = [];
    for (let x = -18.5; x <= 18.501; x += 0.5) for (let y = -13.5; y <= 13.501; y += 0.5) if (x * side >= 1.5) pts.push([x, y]);
    const K = steps.length, M = 6.9;
    const safe = (p, k) => steps[k].every(q => dist(p, q) >= M);
    const ok = [];
    ok[K - 1] = pts.filter(p => safe(p, K - 1));
    for (let k = K - 2; k >= 0; k--) ok[k] = pts.filter(p => safe(p, k) && ok[k + 1].some(q => dist(p, q) <= reach));
    if (!ok[0].length) return null;
    const near = (list, c) => list.reduce((a, b) => (dist(b, c) < dist(a, c) ? b : a));
    const path = [near(ok[0], anchor)];
    for (let k = 1; k < K; k++) { const prev = path[k - 1]; path.push(near(ok[k].filter(q => dist(prev, q) <= reach), prev)); }
    return path;
  }

  // ---------- the pull ----------
  function plan(events) {
    const P = { start: Object.assign({}, UP1), prefs: [], hazards: [], checks: [], calls: [], marks: [], labels: new Map(), debuffs: [],
      boss: [{ t: 0, at: [0, 0] }], hitbox: [{ t: 0, r: 4.9 }], looks: [{ t: 0, show: LOOK1 }], form: [] };
    const arena = [{ t: 0, ...SQUARE }];
    let id = 0;
    const hz = (o) => { const h = Object.assign({ id: ++id, react: 3 }, o); P.hazards.push(h); return h; };
    const pref = (t, spots) => P.prefs.push({ t, spots });
    const call = (t, text, o) => P.calls.push(Object.assign({ t, text, dur: 5 }, o));
    const debuff = (slot, key, name, hint, t0, t1) => P.debuffs.push({ slot, key, name, hint, t0, t1 });
    const mark = (shape, t0, t1, fill) => P.marks.push(Object.assign({ kind: 'lit', t0, t1, fill }, shape));
    const E = (name, t0, t1) => events.find(e => e.name === name && e.t >= t0 && e.t <= t1) || null;
    const EA = (name, t0, t1) => events.filter(e => e.name === name && e.t >= t0 && e.t <= t1);
    const tOf = (e, d) => (e ? e.t : d);
    const raid = (t, tell, dmg, name) => hz({ t, tell, raidwide: true, dmg, name });
    const spreads = (t, targets, r, name, o) => hz(Object.assign({ t, tell: t - 5, effect: 'bait', shape: 'circle', from: 'target', targets, r, dmg: 0.9, own: 0.3, name }, o));
    const stack = (t, targets, r, min, name, o) => hz(Object.assign({ t, tell: t - 5, effect: 'share', shape: 'circle', from: 'target', targets, r, min, max: min, dmg: 0.35, name }, o));
    const CF = floorOf(CIRCLE2, 1);
    const bossPath = (t, p, move) => P.boss.push(move ? { t, at: p, move } : { t, at: p });

    // ===== raidwides =====
    for (const ev of events) {
      if (ev.name === 'Wrath of Zeus' || ev.name === 'Azure Thunder' || (ev.name === 'Wicked Thunder' && ev.kind !== 'enrage')) {
        raid(ev.t, ev.t - 5, 0.45, ev.name);
        call(ev.t - 5, 'Raidwide', { dur: 3 });
      }
    }

    // ===== phase 1 =====
    // --- Bewitching Flight and Electrifying Witch Hunt ---
    const bf = E('Bewitching Flight', 25, 50), ewh = E('Electrifying Witch Hunt', 40, 60), wh = E('Witch Hunt + Forked Lightning', 50, 70);
    if (bf && ewh && wh) {
      const tLines = bf.t + 1, cs = bf.t - 6;
      bossPath(bf.t - 7.3, [0, 20]); bossPath(bf.t + 3.1, [0, 0]);
      // The flight's five lines down from the boss, 8 apart (one of the two offsets), and the batteries' five across.
      const sg = pick([1, -1]), xs = [0, 1, 2, 3, 4].map(k => sg * (-17.5 + 8 * k));
      const side = pick([-1, 1]), sy = pick([1, -1]), ys = [0, 1, 2, 3, 4].map(k => sy * (-17.5 + 8 * k));
      for (const x of xs) hz({ t: tLines, tell: cs, shape: 'line', at: [x, 20], deg: 180, len: 40, w: 5, dmg: 0.9, name: 'Bewitching Flight' });
      for (const y of ys) hz({ t: tLines, tell: cs, shape: 'line', at: [side * 20, y], deg: side < 0 ? 90 : 270, len: 40, w: 5, dmg: 0.9, name: 'Electray' });
      const gx = xs.map(x => x + 4 * sg), gy = ys.map(y => y + 4 * sy);
      call(cs, 'Avoid Front + Side Cleaves: stand in a safe intersection', { alert: true, dur: 6 });
      // Electrifying Witch Hunt: the lines burst 16 wide, inner three (out safe) or outer two (in safe) first.
      const innerFirst = Math.random() < 0.5;
      const inner = [xs[1], xs[2], xs[3]], outer = [xs[0], xs[4]];
      const burst = (t, tell, list) => list.forEach(x => hz({ t, tell, shape: 'line', at: [x, 20], deg: 180, len: 40, w: 16, dmg: 1.2, name: 'Burst' }));
      burst(ewh.t, ewh.t - 6, innerFirst ? inner : outer);
      burst(wh.t + 0.1, wh.t - 6, innerFirst ? outer : inner);
      // Columns: out (the strips at the walls) or in (the middle strip), G1 west, G2 east; rows R T M H north to south
      // (the north pair's far and near spots, the south pair's near and far).
      const COLS = { out: sg > 0 ? [-18.9, 17.2] : [-17.2, 18.9], in: sg > 0 ? [-7.5, 4.5] : [-4.5, 7.5] };
      const ROW = { nFar: 15, nNear: 4.5, sNear: -4.5, sFar: -14 };
      const first = innerFirst ? 'out' : 'in', second = innerFirst ? 'in' : 'out';
      const quads = [['R1', 'MT'], ['M1', 'H1'], ['R2', 'OT'], ['M2', 'H2']];       // each quadrant: [far, near] / [near, far]
      const slotRow = { R1: 'nFar', MT: 'nNear', M1: 'sNear', H1: 'sFar', R2: 'nFar', OT: 'nNear', M2: 'sNear', H2: 'sFar' };
      const spotIn = (area, s, row) => [COLS[area][G1.includes(s) ? 0 : 1], ROW[row]];
      const spots1 = Object.fromEntries(S.map(s => [s, spotIn(first, s, slotRow[s])]));
      // Into the flight's safe cells first: each to the free cell nearest its spread spot.
      const cells = [];
      for (const x of gx) for (const y of gy) if (Math.abs(x) < 19.2 && Math.abs(y) < 19.2) cells.push([x, y]);
      const cellOf = {}, used = new Set();
      for (const s of S.slice().sort((a, b) => Math.abs(spots1[b][0]) - Math.abs(spots1[a][0]))) {
        let bi = -1;
        cells.forEach((c, i) => { if (!used.has(i) && (bi < 0 || dist(c, spots1[s]) < dist(cells[bi], spots1[s]))) bi = i; });
        used.add(bi); cellOf[s] = r2(cells[bi]);
      }
      pref(cs + 0.3, cellOf);
      pref(ewh.t - 5.8, spots1);          // (once the bursting lines show)
      // The first spread: one in each quadrant is hit (Forked Lightning on them).
      const forked = quads.map(q => pick(q));
      spreads(ewh.t + 0.1, forked, 6, 'Electrifying Witch Hunt', { tell: ewh.t - 5 });
      for (const s of forked) debuff(s, 'forkedLightning', 'Forked Lightning', 'don\'t take Witch Hunt\'s bait: the other spot of your quadrant', ewh.t + 0.1, wh.t + 0.5);
      call(ewh.t - 5, `${first === 'in' ? 'In' : 'Out'} + Spread (Avoid Side Cleaves)`, { alert: true, dur: 5 });
      // Witch Hunt: the four nearest (or farthest) take the bait; Forked Lightning's 5-yalm circles on the rest.
      const near = Math.random() < 0.5, spots2 = {};
      quads.forEach(([a, b]) => {
        const north = slotRow[a] === 'nFar', baitRow = near ? (north ? 'nNear' : 'sNear') : (north ? 'nFar' : 'sFar');
        const otherRow = north ? (baitRow === 'nNear' ? 'nFar' : 'nNear') : (baitRow === 'sNear' ? 'sFar' : 'sNear');
        const hit = forked.includes(a) ? a : b, free = hit === a ? b : a;
        spots2[free] = spotIn(second, free, baitRow);
        spots2[hit] = spotIn(second, hit, otherRow);
      });
      pref(ewh.t + 0.2, spots2);
      hz({ t: wh.t + 0.2, tell: wh.t - 5, effect: 'bait', shape: 'circle', from: 'target', targets: near ? { nearest: 4 } : { farthest: 4 }, snap: 0.2, r: 6, dmg: 0.9, own: 0.3, name: 'Witch Hunt' });
      spreads(wh.t + 0.5, forked, 5, 'Forked Lightning', { tell: wh.t - 5, own: 0.2 });
      for (const s of S) {
        const far = near === forked.includes(s);
        call(wh.t - 5, `${second === 'in' ? 'In' : 'Out'} + Spread (${far ? 'Be Further' : 'Be Closer'})`, { slot: s, alert: true, dur: 5 });
      }
      pref(wh.t + 0.6, UP1);
    }

    // --- Narrowing / Widening Witch Hunt ---
    const nw = E('Widening Witch Hunt/Narrowing Witch Hunt', 60, 95);
    if (nw) {
      const widen = Math.random() < 0.5, nearFirst = Math.random() < 0.5, cs = nw.t - 15;
      const hits = [nw.t, ...[2, 3, 4].map(k => tOf(E(`Thundering/Lightning Vortex ${k}`, nw.t, nw.t + 15), nw.t + 3.4 * (k - 1)))];
      P.labels.set(nw, widen ? 'Widening Witch Hunt (out first)' : 'Narrowing Witch Hunt (in first)');
      // Modified clocks: tanks north and south, melee west and east, healers south-west and south-east, ranged
      // north-west and north-east.
      const CLOCK = { MT: 0, OT: 180, M1: 270, M2: 90, H1: 225, H2: 135, R1: 315, R2: 45 };
      const RADII = { in: { near: [3.5, 8.5], far: [8.8, 4.5] }, out: { near: [11.8, 15.5], far: [19, 12.5] } };
      const seq = [];
      for (let k = 0; k < 4; k++) {
        const io = (widen ? k % 2 === 0 : k % 2 === 1) ? 'out' : 'in', bait = ((k % 2 === 0) === nearFirst) ? 'near' : 'far';
        const role = k < 2 ? (bait === 'near' ? 'tank' : 'healer') : (bait === 'near' ? 'melee' : 'ranged');
        const baiters = S.filter(s => B.SLOT_ROLE[s] === role);
        const [rb, ro] = RADII[io][bait];
        pref(k ? hits[k - 1] + 0.15 : cs + 1, Object.fromEntries(S.map(s => [s, r2(at(CLOCK[s], baiters.includes(s) ? rb : ro))])));
        hz(Object.assign({ t: hits[k], tell: k ? hits[k - 1] : cs, dmg: 1.2, name: io === 'out' ? 'Lightning Vortex' : 'Thundering', react: 3 },
          io === 'out' ? { shape: 'circle', at: [0, 0], r: 10 } : { shape: 'donut', at: [0, 0], r0: 10 }));
        hz({ t: hits[k] + 0.1, tell: hits[k] - 3, effect: 'bait', shape: 'circle', from: 'target', targets: bait === 'near' ? { nearest: 2 } : { farthest: 2 }, snap: 0.3, r: 6, dmg: 0.9, own: 0.3, name: 'Witch Hunt' });
        if (k) { const ev = E(`Thundering/Lightning Vortex ${k + 1}`, nw.t, nw.t + 15); if (ev) P.labels.set(ev, io === 'out' ? 'Lightning Vortex' : 'Thundering'); }
        seq.push(`${io === 'in' ? 'In' : 'Out'} (${{ tank: 'Tanks', healer: 'Healers', melee: 'Melee', ranged: 'Ranged' }[role]})`);
        call(k ? hits[k - 1] + 0.2 : cs + 7, seq[k], { alert: true, dur: 3 });
      }
      call(cs + 0.2, `Baits: ${seq.join(' => ')}`, { dur: 8 });
      pref(hits[3] + 0.2, UP1);
    }

    // --- Electrope Edge 1 (the mines) ---
    const ee1 = E('Electrope Edge (mines)', 100, 120), wg = E('Witchgleam', 110, 125), ss1 = E('Spark + Sidewise Spark', 125, 145), st1 = E('Four Star/Eight Star', 125, 145);
    if (ee1 && wg && ss1) {
      const Q = { NE: 45, SE: 135, SW: 225, NW: 315 }, mine = (q) => r2(at(Q[q], 15 * Math.SQRT2));
      const safeQ = pick(Object.keys(Q)), safeX = Math.sign(mine(safeQ)[0]);
      const cleaveSide = -safeX, onceOther = pick(Object.keys(Q).filter(q => Math.sign(mine(q)[0]) === cleaveSide));
      const twice = Object.keys(Q).filter(q => q !== safeQ && q !== onceOther);
      // Witchgleam: three sets of two lines from the boss at the mines (the twice-hit mines twice).
      const gt = [tOf(E('(first mines hit)', wg.t, wg.t + 6), wg.t + 1.1), tOf(E('(second mines hit)', wg.t, wg.t + 6), wg.t + 2.6), tOf(E('(third mines hit)', wg.t, wg.t + 6), wg.t + 4.1)];
      const sets = shuffle([[twice[0], safeQ], [twice[0], twice[1]], [twice[1], onceOther]]);
      sets.forEach((set, k) => set.forEach(q => hz({ t: gt[k], tell: k ? gt[k - 1] : wg.t - 3, shape: 'line', at: [0, 0], deg: Q[q], len: 60, w: 5, dmg: 0.9, name: 'Witchgleam' })));
      // Off the diagonals meanwhile: the cardinals.
      const CARD = { MT: [-1.3, 9], M1: [1.3, 9], OT: [9, 1.3], M2: [9, -1.3], H2: [1.3, -9], R2: [-1.3, -9], H1: [-9, -1.3], R1: [-9, 1.3] };
      pref(ee1.t - 2.8, CARD);
      call(ee1.t - 3, 'Cardinals (count the mines\' hits)', { alert: true, dur: 5 });
      // The mines go off with Sidewise Spark (east or west half) and the stars.
      const tS = ss1.t, cs = tS - 7;
      for (const q of Object.keys(Q)) {
        const c = mine(q), h = twice.includes(q) ? 15 : 5;
        hz({ t: tS, tell: cs, shape: 'rect', a: [c[0] - h, c[1] - h], b: [c[0] + h, c[1] + h], dmg: 1.2, name: twice.includes(q) ? 'Spark II' : 'Spark' });
      }
      hz({ t: tS, tell: cs, shape: 'cone', at: [0, 0], deg: cleaveSide > 0 ? 90 : 270, half: 90, r: 60, dmg: 1.2, name: 'Sidewise Spark' });
      const eight = Math.random() < 0.5;
      // In the south-west quadrant (then turned to the safe one): spreads in a 3 x 3 grid with the mine's corner
      // empty; pairs left (close, far) and right of facing the boss.
      const SPREAD = { MT: [-1.5, -1.5], M1: [-8, -1.5], R1: [-18.5, -1.5], OT: [-9, -9], M2: [-1.5, -8], H1: [-18.5, -8.5], H2: [-8.5, -18.5], R2: [-1.5, -18.5] };
      const PAIR = [[-7, -1.5], [-1.5, -7], [-17, -4], [-4, -17]];
      const turn = Q[safeQ] - 225;
      let spots;
      if (eight) spots = Object.fromEntries(S.map(s => [s, r2(rot(SPREAD[s], turn))]));
      else { spots = {}; PAIRS.forEach(([a, b], j) => Object.assign(spots, clumpAt([a, b], r2(rot(PAIR[j], turn)), { m: 0 }))); }
      pref(cs + 0.3, spots);
      if (eight) spreads(tS, S, 6, 'Eight Star', { tell: cs });
      else stack(tS, SUP, 6, 2, 'Four Star', { tell: cs });
      if (st1) P.labels.set(st1, eight ? 'Eight Star' : 'Four Star');
      P.labels.set(ss1, `Spark + Sidewise Spark (${safeQ} safe)`);
      call(cs + 0.2, `${dirName(Q[safeQ])[0].toUpperCase() + dirName(Q[safeQ]).slice(1)} => ${eight ? 'Spread' : 'Partners'}`, { alert: true, dur: 6 });
      pref(tS + 0.2, UP1);
    }

    // --- Electrope Edge 2: Lightning Cage ---
    const ee2 = E('Electrope Edge (players)', 150, 165), cage = E('Lightning Cage', 165, 180);
    if (ee2 && cage) {
      const a1 = tOf(E('(first sparks detonate)', cage.t, cage.t + 15), cage.t + 7.8), a2 = tOf(E('(second sparks detonate)', a1 + 10, a1 + 30), a1 + 19.9);
      const ss2 = E('Sidewise Spark', a1, a2), st2 = E('Four Star/Eight Star', a1, a2), tS = tOf(ss2, a1 + 9.3);
      const sets = [1, 2, 3, 4].map((k, i) => tOf(E(['Witchgleam (first set)', 'Witchgleam (second set)', 'Witchgleam (third set)', 'Witchgleam (fourth set)'][i], ee2.t, ee2.t + 20), ee2.t + 7.2 + 1.5 * i));
      // Short and long condensers: in each role one short with two stacks and one with three, one long with one (two
      // after) and one with two (three after).
      const info = {};
      for (const grp of [SUP, DPS]) {
        const [s2, s3, l2, l3] = shuffle(grp);
        info[s2] = { order: 1, eff: 2, hits: 2 }; info[s3] = { order: 1, eff: 3, hits: 3 };
        info[l2] = { order: 2, eff: 2, hits: 1 }; info[l3] = { order: 2, eff: 3, hits: 2 };
      }
      const tExp = (s) => (info[s].order === 1 ? a1 : a2);
      for (const s of S) {
        debuff(s, 'electricalCondenser', 'Electrical Condenser', `${info[s].order === 1 ? 'short' : 'long'}: ${info[s].eff} stacks at the cage`, ee2.t + 1.1, tExp(s));
        call(ee2.t + 1.1, `${info[s].order === 1 ? 'Short' : 'Long'} Debuff (${info[s].hits} hit${info[s].hits > 1 ? 's' : ''}${info[s].order === 2 ? ' +1' : ''})`, { slot: s, alert: true, dur: 5 });
      }
      // Witchgleam: four sets of four protean lines, each player's own as many times as its stacks.
      const left = Object.fromEntries(S.map(s => [s, info[s].hits]));
      const CLOCK = { MT: 0, R2: 45, M2: 90, H2: 135, OT: 180, H1: 225, M1: 270, R1: 315 };
      pref(ee2.t + 0.2, Object.fromEntries(S.map(s => [s, r2(at(CLOCK[s], 7.5))])));
      sets.forEach((t, k) => {
        const who = shuffle(S).sort((a, b) => left[b] - left[a]).slice(0, 4);
        who.forEach(s => { left[s]--; hz({ t, tell: k ? sets[k - 1] : t - 3, effect: 'bait', shape: 'line', from: 'boss', aim: 'target', targets: [s], len: 60, w: 5, dmg: 0.9, own: 0.05, name: 'Witchgleam' }); });
      });
      call(ee2.t + 0.3, 'Protean (count the Witchgleams)', { dur: 4 });
      // An anchor: twelve cells go off; the condensers ending then leave their squares at the pattern's two- and
      // three-stack spots (supports one side, DPS the other), the rest wait in its safe cell.
      const anchor = (order, tSpark, tCells, tell) => {
        const pat = pick(CAGE), sp = Object.fromEntries(Object.entries(CAGE0).map(([k, p]) => [k, r2(rot(p, pat.turn))]));
        for (const i of pat.cells) { const c = cellAt(i); hz({ t: tCells, tell, shape: 'rect', a: [c[0] - 4, c[1] - 4], b: [c[0] + 4, c[1] + 4], dmg: 1.2, name: 'Lightning Cage' }); }
        const turnP = S.filter(s => info[s].order === order), rest = S.filter(s => info[s].order !== order), spots = {};
        for (const s of turnP) {
          const key = `${SUP.includes(s) ? 'sup' : 'dps'}${info[s].eff}`, half = info[s].eff === 2 ? 12 : 20;
          spots[s] = sp[key];
          hz({ t: tSpark, tell: tSpark - 5, effect: 'bait', shape: 'line', from: 'target', targets: [s], deg: 0, len: half, back: half, w: 2 * half, dmg: 1.2, own: 0.3, name: info[s].eff === 2 ? 'Spark II' : 'Spark III' });
          call(tell + 0.1, `${info[s].eff} stacks: ${dir8(Math.atan2(sp[key][0], sp[key][1]) * 180 / Math.PI)} cell`, { slot: s, alert: true, dur: 5 });
        }
        Object.assign(spots, clumpAt(rest, sp.safe, { m: 0 }));
        for (const s of rest) call(tell + 0.1, `Not your turn: ${dir8(Math.atan2(sp.safe[0], sp.safe[1]) * 180 / Math.PI)} cell`, { slot: s, dur: 4 });
        pref(tell + 0.1, spots);
      };
      anchor(1, a1, a1 + 0.3, cage.t + 1);
      // Sidewise Spark between: spreads, or pairs (stacks on the longs, each with the short of its role and count).
      const cleave = pick([-1, 1]), mx = (p) => [p[0] * cleave, p[1]], eight = Math.random() < 0.5, cs = tS - 7;
      hz({ t: tS, tell: cs, shape: 'cone', at: [0, 0], deg: cleave > 0 ? 90 : 270, half: 90, r: 60, dmg: 1.2, name: 'Sidewise Spark' });
      let spots;
      if (eight) {
        const SP = { M1: [-1.5, 0], M2: [-8, 0], MT: [-3.5, 6.5], OT: [-3.5, -6.5], R1: [-12, 14], R2: [-12, -14], H1: [-18.5, 6], H2: [-18.5, -6] };
        spots = Object.fromEntries(S.map(s => [s, r2(mx(SP[s]))]));
        spreads(tS, S, 6, 'Eight Star', { tell: cs });
      } else {
        spots = {};
        const PT = { sup3: [-2.5, 7.2], sup2: [-2.5, -7.2], dps2: [-1.2, 0], dps3: [-8, 0] };
        for (const grp of [SUP, DPS]) for (const eff of [2, 3]) {
          const two = grp.filter(s => info[s].eff === eff).sort((a, b) => info[b].order - info[a].order);      // the long first
          Object.assign(spots, clumpAt(two, r2(mx(PT[`${grp === SUP ? 'sup' : 'dps'}${eff}`])), { m: 0 }));
        }
        stack(tS, S.filter(s => info[s].order === 2), 6, 2, 'Four Star', { tell: cs });
      }
      pref(Math.max(a1 + 0.35, cs + 0.2), spots);
      if (st2) P.labels.set(st2, eight ? 'Eight Star' : 'Four Star');
      if (ss2) P.labels.set(ss2, `Sidewise Spark (${cleave > 0 ? 'east' : 'west'} half)`);
      call(cs + 0.2, `${cleave > 0 ? 'West' : 'East'} => ${eight ? 'Spread' : 'Partners'}`, { alert: true, dur: 5 });
      anchor(2, a2, a2 + 0.6, tS + 4.2);
      pref(a2 + 0.7, UP1);
    }

    // --- Wicked Bolt: a five-hit stack ---
    const bolt = E('Wicked Bolt x6', 195, 215);
    if (bolt) {
      const tgt = pick(S), cs = bolt.t - 4;
      pref(cs + 0.2, clumpAt(S, [0, -7], { m: 0 }));
      for (let k = 0; k < 5; k++) stack(bolt.t + 1.1 + k, [tgt], 5, 6, 'Wicked Bolt', { tell: cs, max: 8, dmg: 0.2 });
      call(cs, `Stack on ${tgt} (x5)`, { alert: true, dur: 5 });
    }

    // --- Ion Cluster: the lane and the Electron Streams ---
    const roll = E('Right Roll/Left Roll', 220, 240), fl = E('(floor no more)', 230, 250);
    const streams = EA('Electron Stream', 240, 290);
    if (roll && fl && streams.length) {
      const L = pick([-15, 15]), east = L > 0;
      P.labels.set(roll, east ? 'Right Roll (the east lane stays)' : 'Left Roll (the west lane stays)');
      bossPath(roll.t - 8.4, [0, 20]);
      bossPath(fl.t + 2.9, [L, 0]);
      const tDeb = roll.t - 10.5;
      pref(roll.t - 6, clumpAt(S, [0, 5], { m: 0 }));
      // Stampeding Thunder takes the other three lanes (five hits, then the floor goes).
      const gone = east ? { a: [-20, -20], b: [10, 20] } : { a: [-10, -20], b: [20, 20] };
      for (let k = 0; k < 5; k++) hz({ t: roll.t + 2.4 + 1.1 * k, tell: roll.t, shape: 'rect', ...gone, dmg: 1.2, name: 'Stampeding Thunder', react: 2.4 });
      hz({ t: fl.t, tell: roll.t, shape: 'rect', ...gone, dmg: 1.2, name: 'Stampeding Thunder' });
      pref(roll.t + 0.05, clumpAt(S, [L, 9], { m: 0 }));
      call(roll.t, east ? 'Go East' : 'Go West', { alert: true, dur: 3 });
      const res = streams.map(s => tOf(E('(debuffs resolve)', s.t, s.t + 8), s.t + 5.1));
      const tRestore = res[res.length - 1] + 2.5;
      arena.push({ t: fl.t + 0.05, ...laneP1(L) }, { t: tRestore, ...SQUARE });
      P.looks.push({ t: fl.t + 0.05, show: [east ? 'a1_lan03' : 'a1_lan02', 'a2_pic'] }, { t: tRestore, show: LOOK1 });
      mark({ shape: 'rect', ...gone }, fl.t + 0.05, tRestore, 'rgba(0,0,0,0.6)');
      // Charges: each half a tank, a healer, a melee and a ranged.
      const pos = [pick(['MT', 'OT']), pick(['H1', 'H2']), pick(['M1', 'M2']), pick(['R1', 'R2'])], neg = S.filter(s => !pos.includes(s));
      for (const s of S) {
        const p = pos.includes(s);
        debuff(s, p ? 'positron' : 'negatron', p ? 'Positron' : 'Negatron', p ? 'yellow: stand in the blue stream' : 'blue: stand in the yellow stream', tDeb, res[res.length - 1]);
        call(tDeb + 0.2, p ? 'Positron (yellow): stand in blue' : 'Negatron (blue): stand in yellow', { slot: s, dur: 4 });
      }
      let lastSide = null;
      streams.forEach((st, i) => {
        const ts = st.t, tr = res[i], cs = ts - 6, yellowN = Math.random() < 0.5;
        P.labels.set(st, `Electron Stream (yellow ${yellowN ? 'north' : 'south'})`);
        const sideOf = (s) => (pos.includes(s) ? (yellowN ? -1 : 1) : (yellowN ? 1 : -1));       // yellow stands in blue
        for (const sd of [1, -1]) {
          const grp = S.filter(s => sideOf(s) === sd), yellow = (sd > 0) === yellowN;
          hz({ t: ts, tell: cs, effect: 'tower', shape: 'line', at: [L, 0], deg: sd > 0 ? 0 : 180, len: 20, w: 10, soak: [0, 8], only: grp, dmg: 0.15, fail: 1, name: yellow ? 'Positron Stream' : 'Negatron Stream' });
        }
        // The conductors: each side a cone (both remote or both proximate) front-middle, its collider behind, a small
        // circle or a donut front-left (the support) and front-right (the DPS).
        const remote = Math.random() < 0.5, spots = {}, roles = {};
        for (const sd of [1, -1]) {
          const grp = S.filter(s => sideOf(s) === sd), sup = shuffle(grp.filter(s => SUP.includes(s))), dps = shuffle(grp.filter(s => DPS.includes(s)));
          const pair = shuffle([sup[1], dps[1]]);
          roles[sd] = { owner: pair[0], collider: pair[1], sr: [sup[0], dps[0]] };
          spots[pair[0]] = [L - 2, 5 * sd]; spots[pair[1]] = [L + 2, 6 * sd];
          spots[sup[0]] = [L - 3, 2 * sd]; spots[dps[0]] = [L + 3, 2 * sd];
        }
        pref(cs + 0.1, spots);
        for (const sd of [1, -1]) {
          // (The cone starts just in front of its owner, toward the collider it goes to.)
          const r = roles[sd], target = remote ? roles[-sd].collider : r.collider, o = spots[r.owner], tp = spots[target];
          const u = [(tp[0] - o[0]) / dist(tp, o), (tp[1] - o[1]) / dist(tp, o)];
          hz({ t: tr, tell: cs + 1, effect: 'bait', shape: 'cone', from: r2(add(o, [u[0] * 0.7, u[1] * 0.7])), aim: 'target', targets: [target], r: 50, half: 12.5, dmg: 0.9, own: 0.25, name: 'Axe Current' });
          debuff(r.owner, remote ? 'remoteCurrent' : 'proximateCurrent', remote ? 'Remote Current' : 'Proximate Current', `front of middle: your cone goes to the ${remote ? 'far' : 'near'} collider`, cs, tr);
          call(cs + 0.2, `Front of Middle (${remote ? 'Far' : 'Near'} Cone)`, { slot: r.owner, alert: true, dur: 5 });
          debuff(r.collider, 'colliderConductor', 'Collider Conductor', 'middle, behind: get hit by the cone', cs, tr);
          call(cs + 0.2, 'Middle, Behind Current (Get Hit by Cone)', { slot: r.collider, alert: true, dur: 5 });
          r.sr.forEach((s, j) => {
            const donut = Math.random() < 0.5;
            if (donut) hz({ t: tr, tell: cs + 1, effect: 'bait', shape: 'donut', from: 'target', targets: [s], r0: 10, r1: 25, dmg: 0.9, own: 0.05, name: 'Roundhouse Current' });
            else hz({ t: tr, tell: cs + 1, effect: 'bait', shape: 'circle', from: 'target', targets: [s], r: 2, dmg: 0.9, own: 0.25, name: 'Spinning Current' });
            debuff(s, donut ? 'roundhouseConductor' : 'spinningConductor', donut ? 'Roundhouse Conductor' : 'Spinning Conductor', `front ${j ? 'right' : 'left'}`, cs, tr);
            call(cs + 0.2, `Front ${j ? 'Right' : 'Left'} (${donut ? 'Donut' : 'Small'} AoE)`, { slot: s, alert: true, dur: 5 });
          });
        }
        for (const s of S) {
          const nowSide = sideOf(s) > 0 ? 'North' : 'South';
          const text = lastSide === null ? `${nowSide} - ${TANKS.includes(s) ? 'Be in Front' : 'Behind Tank'}` : (lastSide[s] === nowSide ? 'Stay' : 'Swap Sides');
          call(cs + 0.1, text, { slot: s, alert: true, dur: 3 });
        }
        lastSide = Object.fromEntries(S.map(s => [s, sideOf(s) > 0 ? 'North' : 'South']));
      });
      pref(res[res.length - 1] + 0.2, clumpAt(S, [L, -4], { m: 0, floor: floorOf(laneP1(L)) }));
    }

    // --- Wicked Jolt (twice) ---
    for (const ev of events.filter(e => e.name === 'Wicked Jolt')) {
      const t1 = ev.t, t2 = tOf(E('Wicked Jolt (second hit)', t1, t1 + 5), t1 + 3.1), cs = t1 - 5;
      const b = P.boss.slice().sort((x, y) => x.t - y.t).filter(k => k.t <= cs).pop().at, inward = b[0] > 0 ? -1 : 1;
      const clamp = (p) => [Math.max(-18.5, Math.min(18.5, p[0])), p[1]];
      const spots = { MT: r2(add(b, [0, 6.5])), OT: r2(add(b, [4.5 * inward, 5.5])) };
      for (const s of S.filter(x => !TANKS.includes(x))) spots[s] = r2(clamp(add(b, UP1[s])));
      pref(cs + 0.2, spots);
      hz({ t: t1 + 0.2, tell: cs, effect: 'bait', shape: 'line', from: 'boss', aim: 'target', targets: ['MT'], len: 60, w: 5, dmg: 1.2, own: 0.5, buster: true, name: 'Wicked Jolt' });
      hz({ t: t2, tell: t1 + 0.2, effect: 'bait', shape: 'line', from: 'boss', aim: 'target', targets: ['OT'], len: 60, w: 5, dmg: 1.2, own: 0.5, buster: true, name: 'Wicked Jolt' });
      call(cs, 'Tank Buster (swap): line at the main tank', { alert: true, dur: 4 });
      pref(t2 + 0.2, Object.fromEntries(S.map(s => [s, r2(clamp(add(b, UP1[s])))])));
    }

    // --- Electrope Transplant: Fulminous Field, Conduction Point, Forked Fissures ---
    const tp = E('Electrope Transplant', 300, 330);
    if (tp) {
      bossPath(tp.t - 10.8, [0, 0]);
      const firsts = EA('Fulminous Field 1', tp.t, tp.t + 50);
      call(tp.t, 'Dodge w/Partner x7', { dur: 5 });
      let prevBear = null;
      for (const f1 of firsts) {
        const T = [0, 1, 2, 3, 4, 5, 6].map(k => f1.t - 3 + 3 * k), d0 = Math.random() * 360;
        const cone = (k) => deg360(d0 - 22.5 * k), gap = (k) => deg360(cone(k) + 22.5);
        const cp = E('Conduction Point', f1.t, f1.t + 15), ff = E('Forked Fissures', f1.t, f1.t + 15);
        const role = pick([SUP, DPS]);
        for (let k = 0; k < 7; k++) {
          for (let i = 0; i < 8; i++) hz({ t: T[k], tell: k ? T[k - 1] : T[0] - 3, shape: 'cone', at: [0, 0], deg: cone(k) + 45 * i, half: 15, r: 30, dmg: 0.9, name: 'Fulminous Field', react: 2.8 });
          // Before each hit: the pairs in four of its gaps (whichever four mean the least moving); spread to all eight
          // for Conduction Point (the fifth), the targets behind their partners for the wild charges (the sixth).
          let best = null;
          for (let m = 0; m < 8; m++) for (const v of k === 4 ? [45, -45] : [0]) {
            const g0 = gap(k) + 45 * m, sp = {}, bear = {};
            PAIRS.forEach(([a, b], j) => {
              const g = g0 + 90 * j;
              if (k === 4) { bear[a] = g; bear[b] = g + v; sp[a] = r2(at(g, 14)); sp[b] = r2(at(g + v, 14)); }
              else if (k === 5) { const back = role.includes(a) ? a : b, front = back === a ? b : a; bear[a] = bear[b] = g; sp[front] = r2(at(g, 10.5)); sp[back] = r2(at(g, 16)); }
              else { bear[a] = bear[b] = g; sp[a] = r2(at(g, 12.5)); sp[b] = r2(at(g, 15)); }
            });
            const cost = prevBear ? S.reduce((c, x) => c + Math.abs(((bear[x] - prevBear[x]) % 360 + 540) % 360 - 180), 0) : m + Math.abs(v);
            if (!best || cost < best.cost) best = { cost, sp, bear };
          }
          prevBear = best.bear;
          pref(k ? T[k - 1] + 0.1 : T[0] - 2.9, best.sp);
        }
        spreads(T[4], role, 6, 'Conduction Point', { tell: T[3], status: ['magicVuln', 8] });
        for (const s of role) {
          hz({ t: T[5], tell: T[4], effect: 'share', shape: 'line', from: [0, 0], aim: 'target', targets: [s], len: 40, w: 10, min: 2, max: 2, dmg: 0.3, name: 'Forked Fissures' });
        }
        call(T[3] + 0.1, 'Spread', { dur: 3 });
        for (const s of S) call(T[4] + 0.1, role.includes(s) ? 'Behind Partner' : 'In Front of Partner', { slot: s, alert: true, dur: 3 });
        if (cp) P.labels.set(cp, `Conduction Point (${role === SUP ? 'supports' : 'DPS'})`);
        if (ff) P.labels.set(ff, 'Forked Fissures');
        if (f1 === firsts[firsts.length - 1]) pref(T[6] + 0.1, UP1);
      }
    }

    // --- the transition ---
    const soul = E('Soulshock', 360, 390);
    if (soul) {
      call(soul.t - 4, 'Raidwide x4', { alert: true, dur: 8 });
      for (const ev of [soul, ...EA('Impact', soul.t, soul.t + 10), E('Cannonbolt', soul.t, soul.t + 12)]) if (ev) raid(ev.t, ev.t - 3, 0.3, ev.name);
    }
    const tCannon = tOf(E('Cannonbolt', 370, 400), 383.9), tP2 = tCannon + 6;
    pref(tCannon + 0.3, UP2);
    P.boss.push({ t: tP2, at: [0, 15] });
    P.hitbox.push({ t: tP2, r: 22.5 });
    P.form.push({ t: tP2, model: 'p2' });
    P.looks.push({ t: tP2, show: LOOK2, shift: P2SHIFT });
    arena.push({ t: tP2, ...RECT2 });

    // ===== phase 2 =====
    // --- Cross Tail Switch: nine hits ---
    const cts = E('Cross Tail Switch x10', 395, 420);
    if (cts) {
      call(cts.t - 5, 'LB3! (nine raidwides)', { alert: true, dur: 6 });
      for (let k = 0; k < 8; k++) raid(cts.t + 1.2 + k, cts.t - 5, 0.1, 'Cross Tail Switch');
      raid(cts.t + 9.4, cts.t - 5, 0.35, 'Cross Tail Switch');
    }

    // --- Sabertail and Wicked Blaze ---
    const blaze = E('Wicked Blaze', 415, 435);
    if (blaze) {
      const fx = pick([1, -1]), fy = pick([1, -1]), t0 = blaze.t + 0.13, every = 0.67;
      const steps = [];
      for (const [x, y, w] of SABER) {
        const v = WAY[w], p0 = [x * fx, y * fy], u = [v[0] * fx, v[1] * fy];
        for (let k = 0; ; k++) {
          const p = [p0[0] + u[0] * 6.5 * k, p0[1] + u[1] * 6.5 * k];
          if (Math.abs(p[0]) > 20.01 || Math.abs(p[1]) > 15.01) break;
          (steps[k] = steps[k] || []).push(p);
          // (The party's spots keep clear of these: the bots don't dodge them.)
          hz({ t: t0 + every * k, tell: Math.max(blaze.t - 8, t0 + every * k - 2.5), shape: 'circle', at: r2(p), r: 6, dmg: 0.9, name: 'Sabertail', aimed: true });
        }
      }
      const hits = [blaze.t, ...[2, 3, 4].map(k => tOf(E(`Wicked Blaze ${k}`, blaze.t, blaze.t + 8), blaze.t + 1.55 * (k - 1)))];
      for (const t of hits) stack(t, ['H1', 'H2'], 10, 4, 'Wicked Blaze', { tell: blaze.t - 5, dmg: 0.25 });
      [[G1, -1, 'H1'], [G2, 1, 'H2']].forEach(([grp, side, h]) => {
        const path = exaPath(steps, side, [side * 18.5, 0], every * 5.2) || [[side * 18.5, 0]];
        const offs = [[0, 0], [-side * 0.45, 0], [0, 0.45], [0, -0.45]], order = [h, ...grp.filter(s => s !== h)];
        const spotsAt = (p) => Object.fromEntries(order.map((s, i) => [s, r2(add(p, offs[i]))]));
        pref(blaze.t - 7, spotsAt(path[0]));
        path.forEach((p, k) => { if (k) pref(t0 + every * (k - 1) + 0.02, spotsAt(p)); });
      });
      call(blaze.t - 7, 'LP stacks: G1 West, G2 East (dodge the exaflares along your edge)', { alert: true, dur: 6 });
      pref(hits[3] + 0.2, UP2);
    }

    // --- Wicked Special (center or sides), wherever it comes ---
    const special = (ev, safeFn) => {
      const center = Math.random() < 0.5, t = ev.t, tell = t - 6;
      if (center) hz({ t, tell, shape: 'rect', a: [-10, -15], b: [10, 15], dmg: 1.3, name: 'Wicked Special' });
      else for (const sx of [-1, 1]) hz({ t, tell, shape: 'rect', a: [sx * 5, -15], b: [sx * 20, 15], dmg: 1.3, name: 'Wicked Special' });
      P.labels.set(ev, center ? 'Wicked Special (middle)' : 'Wicked Special (sides)');
      return center;
    };
    const ws1 = E('Wicked Special', 430, 445);
    if (ws1) {
      const center = special(ws1);
      pref(ws1.t - 5.8, center ? Object.assign(clumpAt(G1, [-15, 2], { m: 0 }), clumpAt(G2, [15, 2], { m: 0 })) : clumpAt(S, [0, 3], { m: 0 }));
      call(ws1.t - 6, center ? 'Sides (middle cleave)' : 'Middle (side cleaves)', { alert: true, dur: 4 });
      pref(ws1.t + 0.2, UP2);
    }

    // --- Mustard Bomb (twice) ---
    for (const mb of EA('Mustard Bomb (spread + tethers)', 440, 700)) {
      const t1 = mb.t, t2 = tOf(E('Mustard Bomb (debuffs)', t1, t1 + 15), t1 + 9.7), cs = t1 - 9.7;
      const ROWS = { M1: [-13.5, 6], MT: [-4.5, 6], OT: [4.5, 6], M2: [13.5, 6], R1: [-13.5, -5], H1: [-4.5, -5], H2: [4.5, -5], R2: [13.5, -5] };
      const others = S.filter(s => !TANKS.includes(s)), kind = shuffle(others).slice(0, 4), recv = others.filter(s => !kind.includes(s)).sort((a, b) => ROWS[a][0] - ROWS[b][0]);
      pref(cs + 0.2, ROWS);
      hz({ t: t1, tell: cs, effect: 'bait', shape: 'circle', from: 'target', targets: TANKS, r: 6, tether: 'boss', dmg: 0.9, own: 0.4, name: 'Mustard Bomb' });
      spreads(t1, kind, 6, 'Kindling Cauldron', { tell: cs, status: ['magicVuln', 12] });
      spreads(t2, recv, 6, 'Mustard Bomb', { tell: t1 + 4 });
      // The tanks hand the bombs to the two left without Kindling Cauldron (MT the west one, OT the east).
      const toward = (s, r) => r2(add(ROWS[r], [ROWS[r][0] < ROWS[s][0] ? 1 : -1, 0.8]));
      pref(t1 + 0.1, { MT: toward('MT', recv[0]), OT: toward('OT', recv[1]) });
      pref(t1 + 4.2, { MT: ROWS.MT, OT: ROWS.OT });
      TANKS.forEach((s, i) => { debuff(s, 'mustardBomb', 'Mustard Bomb', `pass it to ${recv[i]}`, t1, t1 + 4); debuff(recv[i], 'mustardBomb', 'Mustard Bomb', 'spread', t1 + 4, t2); });
      call(cs, 'Tanks: grab the tethers; spread MTTM / RHHR', { alert: true, dur: 5 });
      TANKS.forEach((s, i) => call(t1 + 0.2, `Pass Debuff (${recv[i]})`, { slot: s, alert: true, dur: 4 }));
      recv.forEach(s => call(t1 + 0.2, 'Get Debuff', { slot: s, alert: true, dur: 4 }));
      pref(t2 + 0.2, UP2);
    }

    // --- Aetherial Conversion (stored, then resolved) ---
    const resolves = EA('Tail Thrust/Switch of Tides', 470, 740);
    const stores = [470.7, 574.8, 670.4];
    for (let i = 0; i + 1 < resolves.length; i += 2) {
      const t1 = resolves[i].t, t2 = resolves[i + 1].t, store = stores.find(s => s < t1 && s > t1 - 70) || t1 - 9, cs = t1 - 6;
      const fire = Math.random() < 0.5, s1 = pick([-1, 1]);
      [resolves[i], resolves[i + 1]].forEach(ev => P.labels.set(ev, fire ? 'Tail Thrust' : 'Switch of Tides'));
      call(store - 7, `Aetherial Conversion: stored ${fire ? 'fire' : 'water'} (${s1 < 0 ? 'west' : 'east'} first)`, { dur: 5 });
      if (fire) {
        hz({ t: t1, tell: cs, shape: 'circle', at: [s1 * 10, 0], r: 18, dmg: 1.2, name: 'Tail Thrust' });
        hz({ t: t2, tell: t1, shape: 'circle', at: [-s1 * 10, 0], r: 18, dmg: 1.2, name: 'Tail Thrust' });
        pref(cs + 0.2, clumpAt(S, [-s1 * 5, 13], { m: 0 }));
        pref(t1 + 0.1, clumpAt(S, [s1 * 5, 13], { m: 0 }));
        call(cs, `Fire - Start Front + ${s1 < 0 ? 'Right ==>' : 'Left'}`.replace('Left', '<== Left'), { alert: true, dur: 5 });
      } else {
        hz({ t: t1, tell: cs, effect: 'knockback', at: [s1 * 10, 0], dist: 25, dmg: 0.1, name: 'Switch of Tides' });
        hz({ t: t2, tell: t1, effect: 'knockback', at: [-s1 * 10, 0], dist: 25, dmg: 0.1, name: 'Switch of Tides' });
        const line = (sx) => Object.fromEntries(S.map((s, k) => [s, [+(sx * (9 - 0.45 * k)).toFixed(2), k % 2 ? -0.25 : 0.25]]));
        pref(cs + 0.2, line(s1));
        pref(t1 + 0.7, line(-s1));
        call(cs, s1 < 0 ? '<== (Start on Left) Double Knockback' : '(Start on Right) Double Knockback ==>', { alert: true, dur: 5 });
      }
      pref(t2 + 0.8, UP2);
    }

    // --- Azure Thunder's circle; Twilight Sabbath ---
    const azure = EA('Azure Thunder', 490, 700), wt = E('Wicked Thunder', 550, 575);
    if (azure[0]) arena.push({ t: azure[0].t, ...CIRCLE2 });
    if (wt) arena.push({ t: wt.t - 5, ...RECT2 });
    const tw = E('Twilight Sabbath', 500, 515), fire = E('Wicked Fire (puddles drop)', 505, 520), w1 = E('Wicked Fire + Sidewise Spark', 510, 525), w2 = E('Wicked Special + Sidewise Spark', 515, 535);
    if (tw && fire && w1 && w2) {
      const QS = [[1, 1], [1, -1], [-1, -1], [-1, 1]], q1 = pick(QS), q2 = pick(QS), qb = (q) => deg360(Math.atan2(q[0], q[1]) * 180 / Math.PI);
      const halves = (q) => [{ shape: 'half', dir: [-q[0], 0] }, { shape: 'half', dir: [0, -q[1]] }];
      halves(q1).forEach(h => hz(Object.assign({ t: w1.t, tell: tw.t + 3.2, dmg: 1.2, name: 'Sidewise Spark' }, h)));
      halves(q2).forEach(h => hz(Object.assign({ t: w2.t, tell: w1.t, dmg: 1.2, name: 'Sidewise Spark' }, h)));
      const tPud = fire.t + 4;
      hz({ t: tPud, tell: fire.t - 4, shape: 'circle', from: 'target', targets: S, r: 10, snap: 4, dmg: 0.9, name: 'Wicked Fire' });
      pref(fire.t - 3.5, clumpAt(S, [0, 0], { m: 0 }));
      pref(fire.t + 0.05, clumpAt(S, r2(at(qb(q1), 13.2)), { m: 0, floor: CF, avoid: halves(q1) }));
      const center = special(w2);
      const want = center ? [q2[0] * 12.3, q2[1] * 4.5] : [q2[0] * 2.5, q2[1] * 9];
      const wsShapes = center ? [{ shape: 'rect', a: [-10, -15], b: [10, 15] }] : [{ shape: 'rect', a: [5, -15], b: [20, 15] }, { shape: 'rect', a: [-5, -15], b: [-20, 15] }];
      pref(tPud + 0.1, clumpAt(S, want, { m: 1.3, floor: CF, avoid: halves(q2).concat(wsShapes) }));
      call(fire.t - 4, `Puddles in the middle => ${dir8(qb(q1))}`, { alert: true, dur: 6 });
      call(tPud + 0.1, `${dir8(qb(q2))} + ${center ? 'Sides' : 'Middle'}`, { alert: true, dur: 5 });
      P.labels.set(w1, `Sidewise Spark (${dir8(qb(q1))} safe)`);
      pref(w2.t + 0.2, UP2);
    }

    // --- Midnight Sabbath ---
    const ms = E('Midnight Sabbath', 530, 545), mb1 = E('Wicked Flare/Wicked Spark 1', 540, 555), mb2 = E('Wicked Flare/Wicked Spark 2', 545, 560), ws2 = E('Wicked Special', 553, 562);
    if (ms && mb1 && mb2) {
      const CARD = [0, 90, 180, 270], INTER = [45, 135, 225, 315];
      const a1 = pick(['card', 'inter']), a2 = a1 === 'card' ? 'inter' : 'card', ty = [pick(['cannon', 'bird']), pick(['cannon', 'bird'])];
      const conc = Math.random() < 0.5, mode = conc ? ['pairs', 'spread'] : ['spread', 'pairs'];
      const waves = [{ set: a1, t: mb1.t, tell: ms.t + 3.2, ev: mb1 }, { set: a2, t: mb2.t, tell: mb1.t, ev: mb2 }];
      const SECT = { inter: [315, 45, 225, 135], card: [270, 0, 180, 90] };          // MT+M1, OT+M2, H1+R1, H2+R2
      waves.forEach((w, k) => {
        const dirs = w.set === 'card' ? CARD : INTER;
        for (const b of dirs) {
          const c = r2(at(b, 15));
          if (ty[k] === 'cannon') hz({ t: w.t, tell: w.tell, shape: 'line', at: c, deg: b + 180, len: 40, w: 10, dmg: 1.2, name: 'Wicked Cannon' });
          else hz({ t: w.t, tell: w.tell, shape: 'donut', at: c, r0: 5, r1: 15, dmg: 1.2, name: 'Thundering' });
        }
        const safeSet = ty[k] === 'cannon' ? (w.set === 'card' ? 'inter' : 'card') : w.set, bird = ty[k] === 'bird', spots = {};
        PAIRS.forEach(([a, d], j) => {
          const b = SECT[safeSet][j];
          if (mode[k] === 'pairs') { const r = bird ? 12.8 : 12; spots[a] = r2(at(b, r)); spots[d] = r2(at(b, r - 0.7)); }
          else { const r = bird ? 13.8 : 13, dl = bird ? 12.5 : 13.5; spots[a] = r2(at(b + dl, r)); spots[d] = r2(at(b - dl, r)); }
        });
        pref(k ? mb1.t + 0.1 : ms.t + 3.3, spots);
        if (mode[k] === 'pairs') stack(w.t + 0.05, SUP, 5, 2, 'Wicked Flare', { tell: w.tell });
        else spreads(w.t + 0.05, S, 5, 'Wicked Spark', { tell: w.tell });
        P.labels.set(w.ev, mode[k] === 'pairs' ? 'Wicked Flare' : 'Wicked Spark');
        call(k ? mb1.t + 0.1 : ms.t + 3.3, `${w.set === 'card' ? 'Cardinals' : 'Intercards'} + ${bird ? 'Donut' : 'Avoid Line'} + ${mode[k] === 'pairs' ? 'Stack' : 'Spread'}`, { alert: true, dur: 4 });
      });
      if (ws2) {
        const center = special(ws2);
        pref(mb2.t + 0.1, center ? Object.assign(clumpAt(G1, [-12.5, 1], { m: 0, floor: CF }), clumpAt(G2, [12.5, 1], { m: 0, floor: CF })) : clumpAt(S, [0, -4], { m: 0 }));
        call(ws2.t - 5, center ? 'Sides (middle cleave)' : 'Middle (side cleaves)', { alert: true, dur: 4 });
        pref(ws2.t + 0.2, UP2);
      }
    }

    // --- Flame Slash, Raining Swords, Chain Lightning ---
    const fs = E('Flame Slash', 575, 595), rs = E('Raining Swords', 585, 600), cl = E('Chain Lightning', 600, 620);
    if (fs && rs && cl) {
      const tCut = fs.t + 1, steps = [0, 1, 2, 3, 4, 5, 6, 7].map(k => cl.t + 0.8 + 2.7 * k), tBack = steps[7] + 1;
      hz({ t: tCut, tell: fs.t - 6, shape: 'rect', a: [-10, -15], b: [10, 15], dmg: 1.3, name: 'Flame Slash' });
      pref(fs.t - 5.8, Object.assign(clumpAt(G1, [-15, 0], { m: 0 }), clumpAt(G2, [15, 0], { m: 0 })));
      call(fs.t - 6, 'Middle falls: G1 West, G2 East', { alert: true, dur: 5 });
      arena.push({ t: tCut + 0.05, ...LANES2 }, { t: tBack, ...RECT2 });
      P.looks.push({ t: tCut + 0.05, show: LOOK2.filter(m => m !== 'a1_lan04'), shift: P2SHIFT }, { t: tBack, show: LOOK2, shift: P2SHIFT });
      mark({ shape: 'rect', a: [-10, -15], b: [10, 15] }, tCut + 0.05, tBack, 'rgba(0,0,0,0.6)');
      // The towers: TMRH north to south on each side.
      const SY = [11.25, 3.75, -3.75, -11.25], ORDER = { MT: 0, M1: 1, R1: 2, H1: 3, OT: 0, M2: 1, R2: 2, H2: 3 };
      const sideX = (s) => (G1.includes(s) ? -15 : 15);
      pref(tCut + 0.1, Object.fromEntries(S.map(s => [s, [sideX(s), SY[ORDER[s]]]])));
      for (const s of S) hz({ t: rs.t + 1, tell: rs.t - 2, effect: 'tower', shape: 'circle', at: [sideX(s), SY[ORDER[s]]], r: 3, soak: 1, dmg: 0.3, fail: 0.9, name: 'Raining Swords' });
      call(rs.t - 2, 'Towers: TMRH north to south', { alert: true, dur: 4 });
      // Chain Lightning: four rounds, one safe sword a side each (the next at most two swords on).
      for (const sx of [-15, 15]) {
        const safe = [];
        while (safe.length < 4) {
          const left = [0, 1, 2, 3].filter(i => !safe.includes(i) && (!safe.length || Math.abs(i - safe[safe.length - 1]) <= 2));
          if (!left.length) { safe.length = 0; continue; }
          safe.push(pick(left));
        }
        const grp = sx < 0 ? G1 : G2, XO = [-4.3, -3.3, 3.3, 4.3];
        safe.forEach((sv, r) => {
          const prev = r ? safe[r - 1] : null, non = [0, 1, 2, 3].filter(i => i !== sv);
          const between = prev === null ? [] : non.filter(i => i > Math.min(prev, sv) && i < Math.max(prev, sv));
          let second = between.slice(), firstSet = non.filter(i => !between.includes(i));
          if (!second.length) { const j = pick(firstSet); second = [j]; firstSet = firstSet.filter(i => i !== j); }
          for (const [set, t] of [[firstSet, steps[2 * r]], [second, steps[2 * r + 1]]]) {
            for (const i of set) hz({ t, tell: Math.max(cl.t - 14, t - 5.4), shape: 'circle', at: [sx, SY[i]], r: 7, dmg: 1.2, name: 'Chain Lightning', react: 2.6 });
          }
          pref(r ? steps[2 * r - 1] + 0.05 : rs.t + 1.2, Object.fromEntries(grp.map((s, i) => [s, [+(sx + XO[i]).toFixed(2), SY[sv]]])));
        });
        for (const s of grp) call(cl.t - 12, `${sx < 0 ? 'West' : 'East'} side: swords ${safe.map(i => i + 1).join(' => ')}`, { slot: s, alert: true, dur: 8 });
      }
      pref(tBack + 0.1, UP2);
    }

    // --- Sunrise Sabbath ---
    const ic = E('Ion Cluster', 680, 690), sr = E('Sunrise Sabbath', 685, 700), sr1 = E('(first towers/cannons resolve)', 695, 712), ws3 = E('Wicked Special', 705, 718), sr2 = E('(second towers/cannons resolve)', 712, 730);
    if (ic && sr && sr1 && sr2) {
      const tDeb = ic.t + 0.8, tC1 = sr1.t + 0.5, tC2 = sr2.t + 0.5;
      if (azure[1]) arena.push({ t: tC2, ...RECT2 });
      // Short (cannons first, then towers) and long: two supports and two DPS each; each half two yellow and two blue.
      const shortS = [...shuffle(SUP).slice(0, 2), ...shuffle(DPS).slice(0, 2)], longS = S.filter(s => !shortS.includes(s));
      const charge = {};
      for (const grp of [shortS, longS]) { const yl = shuffle(grp).slice(0, 2); for (const s of grp) charge[s] = yl.includes(s) ? 'yellow' : 'blue'; }
      for (const s of S) {
        const sh = shortS.includes(s), y = charge[s] === 'yellow';
        debuff(s, y ? 'positron' : 'negatron', y ? 'Positron' : 'Negatron', `${y ? 'yellow' : 'blue'}: bait a ${y ? 'blue' : 'yellow'} cannon`, tDeb, sh ? tC1 : tC2);
        call(tDeb, `${sh ? 'Short' : 'Long'} ${y ? 'Yellow' : 'Blue'} Debuff (${sh ? 'Cannons' : 'Towers'} First)`, { slot: s, alert: true, dur: 5 });
      }
      // Towers on two opposite cardinals at the edge (supports west or south, DPS north or east), two each.
      const ew = Math.random() < 0.5, supB = ew ? 270 : 180, dpsB = ew ? 90 : 0;
      // Cannons on the intercards; each baiter stands by its cannon toward the cardinal without a tower, so the shot goes
      // into the wall.
      const toward = (c) => (ew ? (c === 45 || c === 315 ? (c === 45 ? -11 : 11) : (c === 135 ? 11 : -11)) : (c === 45 || c === 135 ? (c === 45 ? 11 : -11) : (c === 315 ? -11 : 11)));
      const round = (t, tTow, tell, towerGrp, baitGrp) => {
        const cols = shuffle(['yellow', 'yellow', 'blue', 'blue']), CAN = [315, 225, 135, 45];          // NW, counterclockwise
        const spots = {};
        for (const [b, role] of [[supB, SUP], [dpsB, DPS]]) {
          const two = towerGrp.filter(s => role.includes(s)), c = r2(at(b, 15));
          spots[two[0]] = r2(at(b - 3.3, 13)); spots[two[1]] = r2(at(b + 3.3, 13));
          hz({ t: tTow, tell, effect: 'tower', shape: 'circle', at: c, r: 3, soak: [2, 2], only: two, dmg: 0.3, fail: 0.9, name: 'Soaring Soulpress' });
          for (const s of two) call(tell + 0.1, `Soak Tower (${dir8(b)})`, { slot: s, alert: true, dur: 5 });
        }
        const prio = baitGrp.slice().sort((a, b) => S.indexOf(a) - S.indexOf(b)), free = CAN.map((c, i) => ({ c, col: cols[i] }));
        for (const s of prio) {
          const want = charge[s] === 'yellow' ? 'blue' : 'yellow', k = free.findIndex(f => f.col === want), { c, col } = free.splice(k, 1)[0];
          spots[s] = r2(at(c + toward(c), 14.3));
          hz({ t, tell: tell + 3, effect: 'bait', shape: 'line', from: r2(at(c, 15)), aim: 'target', targets: [s], len: 40, w: 12, dmg: 0.9, own: 0.2, name: col === 'yellow' ? 'Positron Stream' : 'Negatron Stream' });
          call(tell + 3, `${col === 'blue' ? 'Blue' : 'Yellow'} Cannon (${dir8(c)}) - Point ${dir8(c + 4 * toward(c))}`, { slot: s, alert: true, dur: 5 });
        }
        pref(tell + 0.1, spots);
      };
      round(tC1, sr1.t, sr.t + 3.2, longS, shortS);
      if (ws3) {
        const center = special(ws3);
        pref(tC1 + 0.1, center ? Object.assign(clumpAt(G1, [-12.5, 1], { m: 0, floor: CF }), clumpAt(G2, [12.5, 1], { m: 0, floor: CF })) : clumpAt(S, [0, -4], { m: 0 }));
        call(ws3.t - 5, center ? 'Sides (middle cleave)' : 'Middle (side cleaves)', { alert: true, dur: 4 });
      }
      round(tC2, sr2.t, tOf(ws3, sr1.t + 7.8) + 0.2, shortS, longS);
      pref(tC2 + 0.2, UP2);
    }

    // --- Sword Quiver (three times) ---
    for (const sq of EA('Sword Quiver', 735, 800)) {
      const bl = E('Burst + Laceration', sq.t, sq.t + 12), tB = tOf(bl, sq.t + 8.7), cs = sq.t - 5;
      const line = pick([10, 0, -10]);
      P.labels.set(sq, `Sword Quiver (${line > 0 ? 'north' : line < 0 ? 'south' : 'middle'} line)`);
      [1.4, 2.4, 3.4, 4.6].forEach(d => raid(sq.t + d, cs, 0.12, 'Sword Quiver'));
      for (const d of [0, 118, 242]) hz({ t: tB, tell: cs, shape: 'line', at: [0, 0], deg: d, len: 30, back: 30, w: 12, dmg: 1.2, name: 'Burst' });
      hz({ t: tB, tell: cs, shape: 'line', at: [0, line], deg: 90, len: 30, back: 30, w: 12, dmg: 1.2, name: 'Burst' });
      // Melee pairs north, ranged pairs south, in the wedges the fourth line leaves.
      const WED = line > 0 ? [270, 90, 211, 149] : line < 0 ? [329, 31, 270, 90] : [329, 31, 211, 149];
      const spots = {};
      PAIRS.forEach(([a, d], j) => {
        const b = WED[j], r = b % 180 === 90 ? 16 : 14;
        spots[a] = r2(at(b, r)); spots[d] = r2(at(b, r - 0.8));
        hz({ t: tB + 0.2, tell: cs, effect: 'share', shape: 'cone', from: [0, 0], aim: 'target', targets: [a], r: 40, half: 30, min: 2, max: 2, dmg: 0.3, name: 'Laceration' });
      });
      pref(cs + 0.2, spots);
      call(cs + 0.2, { 10: 'Go Sides / Back', 0: 'Go Front / Back', '-10': 'Go Front / Sides' }[line], { alert: true, dur: 5 });
      pref(tB + 0.4, UP2);
    }
    for (const ev of events) if (ev.kind === 'enrage') P.labels.set(ev, 'Wicked Thunder (enrage)');

    P.arena = arena.sort((a, b) => a.t - b.t);
    P.looks.sort((a, b) => a.t - b.t);
    P.boss.sort((a, b) => a.t - b.t);
    return P;
  }

  B.FIGHT_SCRIPTS = B.FIGHT_SCRIPTS || {};
  B.FIGHT_SCRIPTS.m4s = {
    // FFLogs' max HP in an M4S kill (report rmWHfNpP3Gx6bRjq): 114,525,943, one pool over both phases.
    hp: 114525943,
    defaultStrat: 'shabin',
    strats: {
      shabin: { label: 'Shabin/Hector (NA)' },
    },
    source: 'wtfdig.info/70/m4s; mechanics after BossMod (github.com/awgil/ffxiv_bossmod), positions from FFLogs kills',
    // A north, B east, C south, D west; 1-4 the intercards (1 north-west, then clockwise).
    waymarks: [
      { label: 'A', at: [0, 12], color: 'red' }, { label: 'B', at: [12, 0], color: 'yellow' },
      { label: 'C', at: [0, -12], color: 'blue' }, { label: 'D', at: [-12, 0], color: 'purple' },
      { label: '1', at: [-9, 9], color: 'red', square: true }, { label: '2', at: [9, 9], color: 'yellow', square: true },
      { label: '3', at: [9, -9], color: 'blue', square: true }, { label: '4', at: [-9, -9], color: 'purple', square: true },
    ],
    plan,
  };
})(window.BLM);
