// M7S, AAC Cruiserweight M3 (Savage): Brute Abombinator's mechanics for the sim's party, on cactbot's timeline, and the
// strats wtfdig.info lists for them: Toxic (its first, the one NA and EU party finders run: Toxic P1, Locked P2, Toxic
// P3), Kindred (an uptime P1, then Locked and Toxic), Game8 (JP) and MR (OCE). Each strat gives the eight spots (MT OT
// H1 H2 M1 M2 R1 R2) a place for each mechanic; the bots stand there, and so should you. Spots are [east, north] yalms
// from the arena's middle.
//
// The mechanics follow BossMod's module for the fight (github.com/awgil/ffxiv_bossmod, RM07SBruteAbominator), whose
// shapes and sizes come from the game's own Action sheet, and where they land follows four FFLogs kills (positions of
// the boss's helpers as they cast):
//   - Stoneringer: the club (out of a 12-yalm circle) or the sword (in, a donut from 9), stored; Smash Here / There then
//     drops a 6-yalm tank buster the two tanks share on whoever is nearest / furthest, a second after the swing.
//   - Spore Sac (four 8-yalm circles in a pinwheel) and Pollen (twelve of the 4x4 grid's 16 points, 11 apart, leaving
//     two inner and two outer, on opposite diagonals); Sinister Seeds: four 6-yalm seed spreads on the tanks and melee
//     or the healers and ranged, and four chasing 7-yalm puddles, 2 s apart, on the other four; each seed sprouts
//     Tendrils of Terror (an eight-way star of 4-wide lines) and each puddle Roots of Evil (12 yalms) a few seconds
//     later; Impact: light-party stacks on the healers.
//   - Adds (the Blooming Abominations, at the seeds), Quarry Swamp (line of sight: hide behind them) and three
//     proximity Explosions round the arena (bearings 0, 120 and 240 at 16 yalms, either way round).
//   - Pulp Smash: a stack on a player, then The Unpotted (30-degree cones at everyone) and a 6-yalm circle under the
//     boss.
//   - P2 (a 25 x 50 arena between two walls, here scaled to 0.8 so it fits the sim's 40 x 40 floor): the boss leaps to
//     a wall for Brutish Swing (out of 25 yalms, or within 21.7), then Glower Power (a 14-wide line along its facing)
//     with everyone's 6-yalm spreads; Abominable Blink, a 23-yalm flare on a tank; Sporesplosion (a 3 x 6 grid of
//     8-yalm puddles in three sets); Strange Seeds (two seeds every 5 s, each a star 4.7 s later) and Killer Seeds
//     (partner stacks, each a star).
//   - P3: Stoneringers (two swings from walls 34.5 out, a Lashing Lariat sweeping all but a strip on one side, Glower
//     Power across the middle with spreads, Slaminator, an 8-yalm tank tower), Debris Deathmatch (tethers, Spore Sac,
//     Pollen, Killer Seeds, Quarry Swamp), Sinister Seeds again with Pulp Smash, and Strange Seeds with the swings.
// Simplified (what the engine can't show): the boss stays in the middle (where it really stands, at a wall or after a
// leap, is drawn as a faint ring); the puddles follow fixed paths rather than chasing whoever baits them; the adds are
// killed or interrupted as real parties do (their crosses only land for the uptime strat that leaves them alone);
// tethers are just statuses; P2's walls are drawn but don't stop you.
(function (B) {
  const S = B.SLOTS;
  const all = (f) => Object.fromEntries(S.map(s => [s, f(s)]));
  const at = B.bearing;
  const pick = (a) => a[Math.floor(Math.random() * a.length)];
  const shuffle = (a) => { const b = a.slice(); for (let i = b.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [b[i], b[j]] = [b[j], b[i]]; } return b; };
  const G1 = ['MT', 'H1', 'M1', 'R1'], G2 = ['OT', 'H2', 'M2', 'R2'];
  const TM = ['MT', 'OT', 'M1', 'M2'], HR = ['H1', 'H2', 'R1', 'R2'];
  const SUP = ['MT', 'OT', 'H1', 'H2'], DPS = ['M1', 'M2', 'R1', 'R2'];
  const TANKS = ['MT', 'OT'], NONTANK = S.filter(s => !TANKS.includes(s));
  const sgn = (v) => (v < 0 ? -1 : 1);
  const mul = (p, k) => [p[0] * k, p[1] * k];
  const brg = (p) => Math.atan2(p[0], p[1]) * 180 / Math.PI;
  // A point turned clockwise (as bearings go) by deg about the middle.
  const rot = (p, deg) => { const a = deg * Math.PI / 180, c = Math.cos(a), s = Math.sin(a); return [p[0] * c + p[1] * s, -p[0] * s + p[1] * c]; };
  const rotAll = (o, deg) => Object.fromEntries(Object.entries(o).map(([k, v]) => [k, rot(v, deg)]));
  // Small offsets so a clump isn't eight bodies on one point.
  const OFF = { MT: [-0.7, 0.7], OT: [0.7, 0.7], H1: [-1, 0], H2: [1, 0], M1: [-0.6, -0.6], M2: [0.6, -0.6], R1: [-0.3, -1], R2: [0.3, -1] };
  const clump = (c, k = 1) => all(s => [c[0] + OFF[s][0] * k, c[1] + OFF[s][1] * k]);
  const K = 0.8;              // P2's arena (25 x 50) scaled to fit the floor

  // Everyone's spot outside mechanics while the boss is in the middle (it faces the tanks, north): the tanks at its
  // front, the rest hugging its back (its hitbox is 7 yalms).
  const UP = { MT: [-1, 5.5], OT: [1.5, 5], M1: [-2.5, -5.5], M2: [2.5, -5.5], R1: [-1, -7], R2: [1.5, -7], H1: [-4, -6], H2: [4, -6] };
  // P2: hugging the boss at its wall (its hitbox grows to 19.7 yalms there), drawn for the east wall (the other wall
  // turns it about the middle); and under the north building, where it starts.
  const UP2 = { MT: [6.5, 9.5], OT: [6.5, 11], M1: [6.5, 6.5], M2: [7.8, 5.5], R1: [4.8, 4.5], R2: [7, 3.2], H1: [4.2, 6.5], H2: [5.5, 2.5] };
  const UP2N = { MT: [-0.8, 14.5], OT: [0.8, 14.5], M1: [-2.5, 13.3], M2: [2.5, 13.3], R1: [-1.5, 11.8], R2: [1.5, 11.8], H1: [-3.8, 12.2], H2: [3.8, 12.2] };

  // ---------- shapes the engine doesn't have, out of the ones it does ----------
  // A line 2*half wide right across the arena through p, along bearing deg: north-south and east-west ones are
  // rectangles; a diagonal one is a cone so narrow (from 300 yalms back) it's a band of near-constant width.
  function line(p, deg, half) {
    const d = ((deg % 180) + 180) % 180;
    if (d === 0) return { shape: 'rect', a: [p[0] - half, -60], b: [p[0] + half, 60] };
    if (d === 90) return { shape: 'rect', a: [-60, p[1] - half], b: [60, p[1] + half] };
    const D = 300, u = at(d, 1);
    return { shape: 'cone', at: [p[0] - u[0] * D, p[1] - u[1] * D], deg: d, half: Math.atan(half / D) * 180 / Math.PI, r: 2 * D };
  }
  // Tendrils of Terror: a cross and a diagonal cross, 4 wide.
  const star = (p, half = 2) => [0, 90, 45, 135].map(d => line(p, d, half));
  const crossOf = (p, half) => [0, 90].map(d => line(p, d, half));
  // Everything outside a disc (a swing's "in" from a wall, its middle off the floor), as thin strips: a donut there
  // would be drawn filling the floor outside the arena too.
  function outsideDisc(c, R) {
    const out = [];
    for (let y = -20; y < 20; y += 0.5) {
      const dy = Math.abs(y + 0.25 - c[1]);
      if (dy >= R) { out.push({ shape: 'rect', a: [-20, y], b: [20, y + 0.5] }); continue; }
      const w = Math.sqrt(R * R - dy * dy), x0 = c[0] - w, x1 = c[0] + w;
      if (x0 > -20) out.push({ shape: 'rect', a: [-20, y], b: [Math.min(20, x0), y + 0.5] });
      if (x1 < 20) out.push({ shape: 'rect', a: [Math.max(-20, x1), y], b: [20, y + 0.5] });
    }
    return out;
  }
  // A rectangle turned by a multiple of 90 degrees.
  const rotRect = (a, b, deg) => { const p = rot(a, deg), q = rot(b, deg); return { shape: 'rect', a: [Math.min(p[0], q[0]), Math.min(p[1], q[1])], b: [Math.max(p[0], q[0]), Math.max(p[1], q[1])] }; };

  // ---------- the arena's grid (Spore Sac, Pollen) ----------
  const GRID = [];
  for (const a of [-16.5, -5.5, 5.5, 16.5]) for (const b of [-16.5, -5.5, 5.5, 16.5]) GRID.push([a, b]);
  const SPORE = [[[-16.5, 5.5], [-5.5, -16.5], [16.5, -5.5], [5.5, 16.5]], [[16.5, 5.5], [5.5, -16.5], [-16.5, -5.5], [-5.5, 16.5]]];
  // Pollen leaves two inner points safe on one diagonal and two outer ones on the other (cactbot's names).
  const POLLEN = {
    NE: { safe: [[-16.5, -16.5], [16.5, 16.5], [-5.5, 5.5], [5.5, -5.5]], inS: [5.5, -5.5], outS: [-16.5, -16.5], outN: [16.5, 16.5],
      inW: [-5.5, 5.5], inE: [5.5, -5.5], outW: [-16.5, -16.5], outE: [16.5, 16.5], call: 'Outer SW/NE, Inner NW/SE' },
    NW: { safe: [[-16.5, 16.5], [16.5, -16.5], [5.5, 5.5], [-5.5, -5.5]], inS: [-5.5, -5.5], outS: [16.5, -16.5], outN: [-16.5, 16.5],
      inW: [-5.5, -5.5], inE: [5.5, 5.5], outW: [-16.5, 16.5], outE: [16.5, -16.5], call: 'Outer NW/SE, Inner SW/NE' },
  };
  const same = (a, b) => Math.abs(a[0] - b[0]) < 0.01 && Math.abs(a[1] - b[1]) < 0.01;

  // ---------- each strat's spots ----------
  // Which P1 / P2 / P3 strat each picks (wtfdig's toggles: Toxic and Kindred run Locked P2 and Toxic P3).
  const PARTS = { toxic: ['toxic', 'locked', 'toxic'], kindred: ['kindred', 'locked', 'toxic'], game8: ['game8', 'game8', 'game8'], mr: ['mr', 'mr', 'mr'] };

  // P1 Sinister Seeds: where everyone waits out Pollen (start), each puddle baiter's four drops (paths), the seed
  // holders' spots (seeds) and the light parties' Impact stacks. seedTM: the seeds are on the tanks and melee.
  function seedsP1(v, seedTM, pt) {
    const seeders = seedTM ? TM : HR, baiters = seedTM ? HR : TM;
    const start = {}, paths = {}, seeds = {}, stacks = {};
    const g1 = (s) => G1.includes(s);
    if (v === 'toxic') {
      // Everyone in the southern inner safe spot (melee close, ranged far); the baiters drop one puddle there, one in
      // the corner beside it, then G1 goes clockwise and G2 counter-clockwise round the edge. Seeds on the rivets:
      // tanks or healers north (G1 west), melee or ranged south.
      for (const s of seeders) start[s] = mul(pt.inS, 0.85);
      for (const s of baiters) start[s] = mul(pt.inS, 1.15);
      const sx = sgn(pt.inS[0]), corner = [14 * sx, -14];
      const south = [[6 * sx, -18], [-3 * sx, -18]], side = [[18 * sx, -6], [18 * sx, 3]];
      const cw = sx > 0 ? south : side, ccw = sx > 0 ? side : south;
      for (const s of baiters) paths[s] = [start[s], corner, ...(g1(s) ? cw : ccw)];
      Object.assign(seeds, seedTM ? { MT: [-9, 9], OT: [9, 9], M1: [-9, -9], M2: [9, -9] } : { H1: [-9, 9], H2: [9, 9], R1: [-9, -9], R2: [9, -9] });
      for (const s of S) stacks[s] = g1(s) ? [-5.5, 0] : [5.5, 0];
    } else if (v === 'kindred') {
      // G1 west, G2 east: tanks and melee in the inner safe spot on their side, healers and ranged the outer one.
      for (const s of S) start[s] = TM.includes(s) ? (g1(s) ? pt.inW : pt.inE) : (g1(s) ? pt.outW : pt.outE);
      if (seedTM) {
        // Melee seeds: they end on the intercards; healers and ranged bait down their side's edge, ending east or
        // west; the stacks collapse east and west.
        const riv = (p) => mul(p, 9 / 5.5), other = (p) => [p[0], -p[1]];
        Object.assign(seeds, { MT: riv(pt.inW), M1: other(riv(pt.inW)), OT: riv(pt.inE), M2: other(riv(pt.inE)) });
        for (const s of baiters) {
          const o = g1(s) ? pt.outW : pt.outE, ex = sgn(o[0]), ny = sgn(o[1]);
          paths[s] = [o, [18.5 * ex, 8.5 * ny], [18.5 * ex, 0], [18.5 * ex, -8.5 * ny]];
        }
        for (const s of S) stacks[s] = g1(s) ? [-5.5, 0] : [5.5, 0];
      } else {
        // Ranged seeds on the cardinals (healers clockwise from their corner, ranged counter-clockwise); the tanks and
        // melee drop puddles clockwise round the middle; the stacks on the inner intercards (1/3 or 2/4).
        for (const s of seeders) seeds[s] = at(brg(g1(s) ? pt.outW : pt.outE) + (s[0] === 'H' ? 45 : -45), 12);
        for (const s of baiters) { const b0 = brg(g1(s) ? pt.inW : pt.inE); paths[s] = [0, 1, 2, 3].map(k => at(b0 + 90 * k, 7.8)); }
        for (const s of S) stacks[s] = mul(g1(s) ? pt.inW : pt.inE, 3.5 / 5.5);
      }
    } else {
      // Game8 / MR: tanks and melee in the southern inner safe spot, healers the southern outer one, ranged the
      // northern outer one; stacks G1 west, G2 east.
      for (const s of S) start[s] = TM.includes(s) ? pt.inS : s[0] === 'H' ? pt.outS : pt.outN;
      if (seedTM) {
        // Melee seeds on the intercard rivets; healers bait toward the south, ranged toward the north, then in.
        Object.assign(seeds, { MT: [-9, 9], OT: [9, 9], M1: [-9, -9], M2: [9, -9] });
        for (const s of baiters) {
          const o = s[0] === 'H' ? pt.outS : pt.outN, ny = sgn(o[1]);
          paths[s] = [o, [8.5 * sgn(o[0]), 18 * ny], [0, 18 * ny], [0, 10 * ny]];
        }
      } else {
        // Ranged seeds on the rivets; the melee drop puddles tight in the middle: Game8 clockwise, MR up, middle, south.
        Object.assign(seeds, { H1: [-9, -9], H2: [9, -9], R1: [-9, 9], R2: [9, 9] });
        const b0 = brg(pt.inS);
        for (const s of baiters) paths[s] = v === 'game8' ? [0, 1, 2, 3].map(k => at(b0 + 90 * k, k < 2 ? 7.8 : 4.5)) : [pt.inS, [pt.inS[0], 3], [0, -2], [0, -9.5]];
      }
      for (const s of S) stacks[s] = g1(s) ? [-5.5, 0] : [5.5, 0];
    }
    return { start, paths, seeds, stacks, seeders, baiters };
  }

  // P1's adds: where the party kills them, then hides from Quarry Swamp (behind them, from the boss), and the hazard
  // that is: the shadow's complement. Toxic pulls them north, Game8 far west (far north-west when the ranged had the
  // seeds), MR far east; Kindred leaves them where they grew (the seeds) and dodges their crosses.
  function addsP1(v, seedTM, L) {
    const ring = (b, r0, list) => Object.fromEntries(list.map((s, k) => [s, at(b + [-5, 5, 0, -3, 3][k % 5], r0 + [0, 0.8, 1.6, 0.4, 1.2][k % 5])]));
    if (v === 'kindred') {
      const adds = Object.values(L.seeds), r0 = Math.hypot(adds[0][0], adds[0][1]);
      // Behind each add in turn (G1 the west ones); the floor outside the four shadows: the middle and the gaps.
      const groups = adds.map(a => ({ a, b: brg(a), who: [] }));
      const order = seedTM ? [['MT', 'H1'], ['M1', 'R1'], ['OT', 'H2'], ['M2', 'R2']] : [['MT', 'H1'], ['M1', 'R1'], ['OT', 'H2'], ['M2', 'R2']];
      const westN = groups.filter(g => g.a[0] < -0.5 || (Math.abs(g.a[0]) < 0.5 && g.a[1] > 0)).sort((x, y) => y.a[1] - x.a[1]);
      const eastS = groups.filter(g => !westN.includes(g)).sort((x, y) => y.a[1] - x.a[1]);
      const pairs = [westN[0], westN[1], eastS[0], eastS[1]];
      const los = {};
      pairs.forEach((g, k) => Object.assign(los, ring(g.b, r0 + 3, order[k])));
      const H = 16, haz = [{ shape: 'circle', at: [0, 0], r: r0 + 1.5 }, ...groups.map(g => ({ shape: 'cone', at: [0, 0], deg: g.b + 45, half: 45 - H, r: 60 }))];
      // Their crosses: the middle (melee seeds) or the corners (ranged seeds) are clear.
      const kill = seedTM ? clump([0, 0], 2.5)
        : { MT: [-18.5, 18.5], M1: [-18, 18.8], H1: [-18.5, -18.5], R1: [-18, -18.8], OT: [18.5, 18.5], M2: [18, 18.8], H2: [18.5, -18.5], R2: [18, -18.8] };
      return { kill, los, haz, adds, where: seedTM ? 'the middle' : 'the corners' };
    }
    const A = v === 'toxic' ? [0, 10] : v === 'mr' ? [14, 0] : seedTM ? [-14, 0] : [-10.5, 10.5];
    const r0 = Math.hypot(A[0], A[1]), b = brg(A), H = v === 'toxic' ? 20 : 15;
    const los = ring(b, r0 + 3, S);
    const haz = [{ shape: 'wedge', deg: b, half: H }, { shape: 'circle', at: [0, 0], r: r0 + 1.6 }];
    const kill = Object.assign(clump(mul(A, (r0 - 2) / r0), 2.5), { MT: A, OT: mul(A, (r0 + 1) / r0) });
    const where = v === 'toxic' ? 'north' : v === 'mr' ? 'far east' : seedTM ? 'far west' : 'far north-west';
    return { kill, los, haz, adds: null, where };
  }

  // P1/P3 Smash Here / There with the stored swing: the tanks' shared buster spot and everyone's.
  function smashSpots(inn, here) {
    if (inn && here) return { tank: [0, 1.2], spots: { MT: [-0.4, 1.4], OT: [0.4, 1.2], M1: [-2.5, -5.8], M2: [2.5, -5.8], R1: [-1, -6.8], R2: [1, -6.8], H1: [-4.3, -4.8], H2: [4.3, -4.8] } };
    if (inn) return { tank: [0, 7.2], spots: { MT: [-0.4, 7.2], OT: [0.4, 7.1], M1: [-1.5, -2], M2: [1.5, -2], R1: [-0.8, -3], R2: [0.8, -3], H1: [-2.5, -1.2], H2: [2.5, -1.2] } };
    if (here) return { tank: [0, 13.5], spots: { MT: [-0.4, 13.5], OT: [0.4, 13.5], M1: [-2.5, -15.3], M2: [2.5, -15.3], R1: [-1, -16.3], R2: [1, -16.3], H1: [-4.5, -14.8], H2: [4.5, -14.8] } };
    return { tank: [0, 18.5], spots: { MT: [-0.4, 18.5], OT: [0.4, 18.5], M1: [-2, -13.6], M2: [2, -13.6], R1: [-1, -14.6], R2: [1, -14.6], H1: [-4, -13.3], H2: [4, -13.3] } };
  }

  // Pulp Smash's protean clock spots (true north, which the boss in the middle also faces).
  const CLOCK = { MT: 0, R2: 45, H2: 90, M2: 135, OT: 180, M1: 225, H1: 270, R1: 315 };

  // P2's walls (scaled): the boss leaps to the east wall's north half or the west wall's south half (the two
  // diagonal buildings), or sits on the north building; layouts are drawn for the east one.
  const P2W = { NE: { at: [27 * K, 12.5 * K], flip: 1 }, SW: { at: [-27 * K, -12.5 * K], flip: -1 }, N: { at: [0, 39.5 * K], flip: 0 } };
  const WALLNAME = { NE: 'east wall', SW: 'west wall', N: 'north end' };
  const flipAll = (o, f) => Object.fromEntries(Object.entries(o).map(([k, v]) => [k, [v[0] * f, v[1] * f]]));
  const up2 = (w) => (w === 'N' ? UP2N : flipAll(UP2, P2W[w].flip));
  // Brutish Swing + Glower Power spreads, for the east wall: the edge strip past the line (north) and the big side.
  const rows = (edge, mid) => { const xs = [8.8, 2.9, -3, -8.8], o = {}; edge.forEach((s, k) => { o[s] = [xs[k], 18.3]; }); mid.forEach((s, k) => { o[s] = [xs[k], 1.5]; }); return o; };
  const cols = (g1, g2) => { const ys = [15.5, 9.7, 3.9, -1.9], o = {}; g1.forEach((s, k) => { o[s] = [-8.2, ys[k]]; }); g2.forEach((s, k) => { o[s] = [8.2, ys[k]]; }); return o; };
  const SPREAD2 = {
    // Locked (wtfdig: Alpha's): MT M1 R1 in the edge strip (MT deep in the corner), the rest in the big side.
    locked: { MT: [9.6, 18.8], M1: [3.6, 17.4], R1: [-6.4, 17.6], OT: [9.6, -0.8], M2: [4.8, 2.4], R2: [2.4, -4], H1: [-4, 2.4], H2: [-7.2, -6.4] },
    // Game8: G1 left of the line facing the boss, G2 right, melee nearest, then tanks, healers, ranged.
    game8: rows(['M1', 'MT', 'H1', 'R1'], ['M2', 'OT', 'H2', 'R2']),
    // MR: G1 the edge, G2 the middle, tanks nearest, then melee, healers, ranged.
    mr: rows(['MT', 'M1', 'H1', 'R1'], ['OT', 'M2', 'H2', 'R2']),
  };
  const SPREAD2N = { locked: cols(['MT', 'M1', 'H1', 'R1'], ['OT', 'M2', 'H2', 'R2']), game8: cols(['M1', 'MT', 'H1', 'R1'], ['M2', 'OT', 'H2', 'R2']), mr: cols(['MT', 'M1', 'H1', 'R1'], ['OT', 'M2', 'H2', 'R2']) };
  // Abominable Blink, for the east wall: Locked and MR take the flare to the corner by the boss and the party away
  // south; Game8 runs it far and the party stays on the boss.
  const FLARE2 = {
    near: { flare: [9.4, 18.6], other: [8.8, -0.8], rest: { H1: [5, -4.5], H2: [7, -5.6], M1: [8, -3.4], M2: [9.2, -4.6], R1: [5.6, -7], R2: [8, -7.6] } },
    far: { flare: [-9.6, -19.2], other: UP2.MT, rest: UP2 },
  };
  // Strange Seeds, for the boss on the west wall ("boss south"): the spot by the boss the strats keep clear of every
  // star, the two wall tethers' spots, the seed drops (waves 1 and 3, waves 2 and 4) and Killer Seeds' pair spots.
  const SEEDS2 = {
    safe: [-6.4, -9.6], mid: [9.6, 0], far: [-9.6, 19.2],
    dotsA: [[-9.6, 0], [-9.6, -19.2]], dotsB: [[-3.4, -15.8], [-3.2, -1.6]],
    pairsAt: { mid: [8.8, 0], far: [-9.2, 18.8], wmid: [-8, 0], corner: [-8.8, -18.8] },
  };
  const TETHER2 = { locked: { mid: 'R1', far: 'H2' }, game8: { mid: 'R1', far: 'R2' }, mr: { mid: 'H1', far: 'H2' } };
  const PAIRS2 = {
    locked: { mid: ['H1', 'R1'], far: ['H2', 'R2'], wmid: ['MT', 'M1'], corner: ['OT', 'M2'] },
    game8: { mid: ['MT', 'R1'], far: ['OT', 'R2'], wmid: ['H1', 'M1'], corner: ['H2', 'M2'] },
    mr: { mid: ['H1', 'M1'], far: ['H2', 'M2'], wmid: ['MT', 'R1'], corner: ['OT', 'R2'] },
  };

  // P3: the walls 34.5 out at the cardinals; layouts drawn for the north wall and turned to the real one.
  const P3_GLOWER = {
    // Toxic / MR: G1 left, G2 right facing the boss; tanks front far, melee front close, healers back close, ranged
    // back far. Game8: two lines either side, melee nearest the boss, then tanks, healers, ranged.
    toxic: { MT: [-18, 19], M1: [-9, 18], H1: [-9, 10], R1: [-16, 2], OT: [18, 19], M2: [9, 18], H2: [9, 10], R2: [16, 2] },
    game8: { M1: [-10, 18.5], MT: [-10, 12], H1: [-10, 5.5], R1: [-10, -1], M2: [10, 18.5], OT: [10, 12], H2: [10, 5.5], R2: [10, -1] },
  };
  P3_GLOWER.mr = P3_GLOWER.toxic;
  // Stoneringers 2's seed markers (the intercards, 10 out): Toxic by colour (red NW, yellow NE, blue SE, purple SW).
  const SEEDS3 = {
    toxic: { MT: [-10, 10], R1: [-10, 10], OT: [10, -10], M2: [10, -10], H1: [-10, -10], M1: [-10, -10], H2: [10, 10], R2: [10, 10] },
    game8: { MT: [-10, 10], R1: [-10, 10], OT: [10, 10], R2: [10, 10], H1: [-10, -10], M1: [-10, -10], H2: [10, -10], M2: [10, -10] },
  };
  SEEDS3.mr = SEEDS3.game8;
  // Debris Deathmatch: the tethers (R1 north, R2 south, H1 west, H2 east) and Killer Seeds' pairs on those sides.
  const WALL3 = { R1: 0, H2: 90, R2: 180, H1: 270 };
  const PAIR3 = { MT: 'R1', OT: 'R2', M1: 'H1', M2: 'H2' };

  // ---------- the pull ----------
  function plan(events, strat) {
    const P = { start: Object.assign({}, UP), prefs: [], hazards: [], checks: [], calls: [], marks: [], labels: new Map(), debuffs: [] };
    const [V1, V2, V3] = PARTS[strat] || PARTS.toxic;
    let id = 0;
    const hz = (o) => { const h = Object.assign({ id: ++id, react: 3 }, o); P.hazards.push(h); return h.id; };
    const hzs = (shapes, o) => shapes.forEach(s => hz(Object.assign({}, o, s)));
    const pref = (t, spots) => P.prefs.push({ t, spots });
    const call = (t, text, o) => P.calls.push(Object.assign({ t, text }, o));
    const callEach = (t, slots, text, o) => slots.forEach(s => call(t, text, Object.assign({ slot: s }, o)));
    const check = (o) => P.checks.push(o);
    const mark = (o) => P.marks.push(o);
    const deb = (slot, key, name, hint, t0, t1) => P.debuffs.push({ slot, key, name, hint, t0, t1 });
    const castOf = (ev, d) => ev.t - (ev.cast || d || 5);
    const find = (i, test, within) => { for (let k = i + 1; k < events.length && events[k].t - events[i].t <= within; k++) if (test(events[k])) return events[k]; return null; };
    const used = new Set();
    const raid = (t, tell, dmg, name) => hz({ t, tell, raidwide: true, dmg, name });
    // A swing "in" from a wall: the strips outside its reach, shown as marks (the strips' own outlines would hatch it).
    const inDisc = (c, R, t, tell, name) => {
      const strips = outsideDisc(c, R);
      hzs(strips, { t, tell, dmg: 1.4, name, hidden: true });
      strips.forEach(s => mark(Object.assign({ kind: 'lit', t0: tell, t1: t, fill: 'rgba(255,120,60,0.24)' }, s)));
    };
    // Where the boss really is while it stands off the middle (its hitbox, faintly).
    const bossAt = (c, r, t0, t1) => mark({ kind: 'lit', shape: 'circle', at: c, r, t0, t1, fill: 'rgba(170,110,255,0.13)' });

    // The pull's picks.
    const pat1 = pick(['NE', 'NW']), pat3 = pick(['NE', 'NW']), pw1 = pick(SPORE), pw3 = pick(SPORE);
    const w1 = pick(['NE', 'SW']), w2 = w1 === 'NE' ? 'SW' : 'NE', w3 = pick([w1, 'N']);
    const flares = shuffle(TANKS);
    let stored = null, stored2 = null, n2 = 0, nBlink = 0, nRing3 = 0, ring3 = null, nSwing3 = 0, nSlam = 0, sporeEnd = 0;

    // ---- P1/P3 (the boss in the middle) ----
    const smash = (i, ev) => {
      const t = ev.t, cs = castOf(ev, 3), here = Math.random() < 0.5;
      const sw = find(i, e => e.name === 'Brutish Swing', 3), bs = find(i, e => e.name === 'Brutal Smash', 4);
      const tSw = sw ? sw.t : t + 1, tBs = bs ? bs.t : t + 2.1, inn = stored === 'in';
      if (sw) { used.add(sw); P.labels.set(sw, `Brutish Swing (${inn ? 'in' : 'out'})`); }
      P.labels.set(ev, here ? 'Smash Here' : 'Smash There');
      hz(Object.assign({ t: tSw, tell: cs, dmg: 1.4, name: 'Brutish Swing' }, inn ? { shape: 'donut', at: [0, 0], r0: 9 } : { shape: 'circle', at: [0, 0], r: 12 }));
      const sp = smashSpots(inn, here);
      pref(cs, sp.spots);
      check({ t: tBs, kind: 'stack', slots: TANKS, groups: [TANKS], r: 6, spots: { MT: sp.tank, OT: sp.tank }, dmg: 0.5, fail: 1.2, name: 'Brutal Smash' });
      check({ t: tBs, kind: 'spot', slots: NONTANK, spots: sp.spots, r: 3.5, fail: 1.2, name: 'Brutal Smash' });
      mark({ kind: 'lit', shape: 'circle', at: sp.tank, r: 6, t0: cs, t1: tBs, fill: 'rgba(255,70,70,0.2)' });
      pref(tBs + 0.3, UP);
      const ring = inn ? 'In' : 'Out';
      callEach(cs, TANKS, `${ring} => Tanks ${here ? 'in' : 'out'}, Shared tankbuster`, { alert: true, dur: 6 });
      callEach(cs, NONTANK, `${ring} => Party ${here ? 'out' : 'in'}, Avoid tankbuster`, { alert: true, dur: 6 });
      stored = null;
    };

    const pollenHits = (ev, pat) => {
      const pt = POLLEN[pat];
      P.labels.set(ev, `Pollen (${pt.call})`);
      for (const g of GRID) if (!pt.safe.some(q => same(q, g))) hz({ t: ev.t, tell: castOf(ev, 4), shape: 'circle', at: g, r: 8, dmg: 1.3, name: 'Pollen' });
      call(castOf(ev, 4), pt.call, { dur: 5 });
    };

    // P1 Sinister Seeds, from its cast to the stacks.
    const seeds1 = (i, ev) => {
      const pt = POLLEN[pat1], seedTM = Math.random() < 0.5, L = seedsP1(V1, seedTM, pt);
      const puds = [1, 2, 3, 4].map(k => find(i, e => e.name === `Sinister Seeds (puddles ${k})`, 15));
      const drop = find(i, e => e.name === 'Sinister Seeds (seeds drop)', 12), tend = find(i, e => e.name === 'Tendrils of Terror', 16);
      const roots = find(i, e => e.name === 'Roots of Evil', 22), imp = find(i, e => e.name === 'Impact', 16);
      [...puds, drop, tend, roots, imp].forEach(e => e && used.add(e));
      P.labels.set(ev, `Sinister Seeds (seeds on the ${seedTM ? 'tanks and melee' : 'healers and ranged'})`);
      const tStart = castOf(ev, 4) + 0.4;
      pref(Math.max(tStart, 48.6), L.start);
      // The puddles: one where each baiter stands as each cast starts, 2 s apart, landing 3 s later.
      const all16 = [];
      puds.forEach((pe, k) => {
        if (!pe) return;
        const t0 = pe.t - 3, pts = [];
        for (const s of L.baiters) { const p = L.paths[s][k]; if (!pts.some(q => same(q, p))) pts.push(p); }
        pts.forEach(p => { hz({ t: pe.t, tell: t0, shape: 'circle', at: p, r: 7, dmg: 1.2, name: 'Sinister Seeds' }); all16.push(p); });
        if (k < 3) pref(t0 + (k ? 0.05 : 0.2), Object.fromEntries(L.baiters.map(s => [s, L.paths[s][k + 1]])));
      });
      const seedT = drop ? drop.t : ev.t + 8;
      pref(puds[0] ? puds[0].t - 2.75 : seedT - 6.75, Object.fromEntries(L.seeders.map(s => [s, L.seeds[s]])));
      check({ t: seedT, kind: 'spread', slots: L.seeders, r: 6, dmg: 0.2, fail: 0.8, name: 'Sinister Seeds' });
      for (const s of L.seeders) deb(s, null, 'Sinister Seed', 'drop it on your spot, clear of everyone', castOf(drop || ev, 7), seedT);
      callEach(castOf(drop || ev, 7), L.seeders, 'Drop seed', { dur: 6 });
      callEach(castOf(drop || ev, 7), L.baiters, 'Bait Puddles', { alert: true, dur: 6 });
      pref(seedT + 0.2, Object.fromEntries(L.seeders.map(s => [s, L.stacks[s]])));
      pref((puds[3] ? puds[3].t - 3 : seedT) + 1.2, Object.fromEntries(L.baiters.map(s => [s, L.stacks[s]])));
      if (tend) {
        Object.values(L.seeds).forEach(p => hzs(star(p), { t: tend.t, tell: tend.t - 3, dmg: 1.3, name: 'Tendrils of Terror' }));
        call(tend.t - 3, 'Avoid line AoEs', { dur: 3 });
      }
      if (imp) {
        check({ t: imp.t, kind: 'stack', groups: [G1, G2], r: 6, spots: L.stacks, dmg: 0.3, fail: 0.8, name: 'Impact' });
        call(seedT, 'Healer groups', { alert: true, dur: 4 });
      }
      if (roots) all16.forEach(p => hz({ t: roots.t, tell: tend ? tend.t : roots.t - 5, shape: 'circle', at: p, r: 12, dmg: 1.4, name: 'Roots of Evil' }));
      // The adds grow where the seeds fell: kill (or leave) them, then hide behind them.
      const A = addsP1(V1, seedTM, L), tAdds = (imp ? imp.t : seedT + 4.6) + 0.4;
      pref(tAdds, A.kill);
      const winds = find(i, e => e.name.startsWith('Winding Wildwinds'), 40), quarry = find(i, e => e.name === 'Quarry Swamp', 55);
      if (winds) {
        used.add(winds);
        P.labels.set(winds, 'Winding Wildwinds & Crossing Crosswinds (adds)');
        if (A.adds) {
          // Kindred leaves the adds alone: two of them cast a 10-wide cross (the other two, interrupted, a donut).
          shuffle(A.adds).slice(0, 2).forEach(a => hzs(crossOf(a, 5), { t: winds.t, tell: castOf(winds, 7), dmg: 1.4, name: 'Crossing Crosswinds' }));
          call(castOf(winds, 7), `Interrupt Winding Wildwinds; dodge the crosses in ${A.where}`, { alert: true, dur: 7 });
        } else call(castOf(winds, 7), `Kill the adds ${A.where}; interrupt Winding Wildwinds`, { alert: true, dur: 7 });
      }
      call(tAdds, A.adds ? `Adds: leave them, uptime from ${A.where}` : `Adds: pull them ${A.where}`, { dur: 5 });
      if (quarry) {
        used.add(quarry);
        const cs = castOf(quarry, 4);
        pref(cs + 0.1, A.los);
        hzs(A.haz, { t: quarry.t, tell: cs, dmg: 1.5, name: 'Quarry Swamp' });
        call(cs, 'Line of Sight boss with adds', { alert: true, dur: 4 });
      }
    };

    // P1's Explosions: three points round the arena, 16 out, in turn either way round; stand opposite each.
    const explosions = (i, ev) => {
      const run = [ev, find(i, e => e.name === 'Explosion 2', 6), find(i, e => e.name === 'Explosion 3', 8)].filter(Boolean);
      run.forEach(e => used.add(e));
      const b0 = pick([0, 120, 240]), dir = pick([1, -1]);
      run.forEach((e, k) => {
        const b = b0 + dir * 120 * k, p = at(b, 16);
        hz({ t: e.t, tell: castOf(e, 9), shape: 'circle', at: p, r: 21, dmg: 1.2, react: 2.6, name: 'Explosion' });
        raid(e.t, castOf(e, 9), 0.15, 'Explosion');
        pref(k ? run[k - 1].t + 0.05 : castOf(ev, 9) + 3.5, clump(at(b + 180, 7.5), 1.2));
      });
      const NAMES = { 0: 'north', 120: 'south-east', 240: 'south-west' }, nm = (b) => NAMES[((b % 360) + 360) % 360];
      call(castOf(ev, 9) + 3.5, `Rotate away from proximity markers: ${run.map((e, k) => nm(b0 + dir * 120 * k)).join(' > ')}`, { alert: true, dur: 8 });
      pref(run[run.length - 1].t + 0.2, UP);
    };

    // Pulp Smash in the middle: stack on the marked player, then out to the clock spots for the proteans.
    const pulpMiddle = (t, unp, stackSpots) => {
      const tgt = pick(S);
      pref(t - 4.8, stackSpots || clump([0, 0], 1));
      check({ t, kind: 'stack', groups: [S], r: 6, dmg: 0.3, fail: 0.9, name: 'Pulp Smash' });
      call(t - 5, `Stack on ${tgt} => Out + Protean`, { dur: 5 });
      const tu = unp ? unp.t : t + 2;
      hz({ t: tu, tell: t, shape: 'circle', at: [0, 0], r: 6, dmg: 1.3, react: 2, name: 'It Came from the Dirt' });
      hz({ t: tu, tell: t, shape: 'protean', aimed: true, half: 15, r: 60, dmg: 0.9, own: 0.15, name: 'The Unpotted' });
      pref(t + 0.05, all(s => at(CLOCK[s], 8.2)));
      pref(tu + 0.4, UP);
    };

    // ---- P2 ----
    const preSwing2 = (wk, inn, lay) => {
      if (wk === 'N') return inn ? all(s => [G1.includes(s) ? -3.5 : 3.5, 17.2 + OFF[s][1]]) : all(s => [(G1.includes(s) ? -6 : 6) + OFF[s][0], 5 + OFF[s][1]]);
      const f = P2W[wk].flip;
      if (inn) return flipAll(clump([8, 10], 1.2), f);
      return flipAll(all(s => (lay[s][1] > 10 ? [-5 + OFF[s][0] * 1.5, 17.5 + OFF[s][1]] : [-2 + OFF[s][0] * 1.5, -6 + OFF[s][1]])), f);
    };
    const swing2 = (i, ev) => {
      n2++;
      const wk = [w1, w2, w3][n2 - 1] || w3, W = P2W[wk], inn = stored2 === 'in', t = ev.t, cs = t - 8.1;
      P.labels.set(ev, `Brutish Swing (${inn ? 'in' : 'out'}, ${WALLNAME[wk]})`);
      if (inn) inDisc(W.at, 21.712 * K, t, cs, 'Brutish Swing');
      else hz({ t, tell: cs, shape: 'circle', at: W.at, r: 25 * K, dmg: 1.4, name: 'Brutish Swing' });
      const nx = find(i, e => e.name === 'Brutish Swing', 90);
      bossAt(W.at, 19.7 * K, cs + 4, nx ? nx.t - 4.1 : 352.1);
      const canon = wk === 'N' ? SPREAD2N[V2] : SPREAD2[V2], lay = wk === 'N' ? canon : flipAll(canon, W.flip);
      pref(Math.max(cs + 0.3, sporeEnd + 0.1), preSwing2(wk, inn, canon));
      call(cs, `${inn ? 'In at' : 'Out from'} tethered wall (${WALLNAME[wk]})`, { alert: true, dur: 7 });
      const ef = find(i, e => e.name === 'Electrogenetic Force', 6), gp = find(i, e => e.name === 'Glower Power', 6);
      if (ef) used.add(ef);
      if (gp) {
        used.add(gp);
        const band = wk === 'N' ? { shape: 'rect', a: [-7 * K, -30], b: [7 * K, 40] } : { shape: 'rect', a: [-30, W.at[1] - 7 * K], b: [30, W.at[1] + 7 * K] };
        hz(Object.assign({ t: gp.t, tell: gp.t - 4, dmg: 1.4, name: 'Glower Power' }, band));
        call(gp.t - 4, 'Spread, Away from front', { alert: true, dur: 4 });
      }
      pref(t + 0.1, lay);
      if (ef) check({ t: ef.t, kind: 'spread', r: 6 * K, dmg: 0.25, fail: 0.8, name: 'Electrogenetic Force' });
      pref((ef ? ef.t : t + 5) + 0.3, up2(wk));
    };

    // Abominable Blink: a flare on a tank (the first a random one, the second the other), 23 yalms of fall-off.
    const blink = (i, ev) => {
      nBlink++;
      const wk = nBlink === 1 ? w1 : w2, f = wk === 'N' ? 1 : P2W[wk].flip, t = ev.t, cs = t - 6.6;
      const tank = flares[(nBlink - 1) % 2], other = tank === 'MT' ? 'OT' : 'MT';
      const L = V2 === 'game8' ? FLARE2.far : FLARE2.near;
      const spots = Object.assign(flipAll(L.rest, f), { [tank]: mul(L.flare, f), [other]: mul(L.other, f) });
      // The wall tethers' holders stay on their tethers.
      if (nBlink === 2) for (const [k, s] of Object.entries(TETHER2[V2])) spots[s] = mul(SEEDS2[k], w2 === 'SW' ? 1 : -1);
      P.labels.set(ev, `Abominable Blink (flare on ${tank})`);
      pref(cs, spots);
      check({ t, kind: 'spread', slots: [tank], r: 23 * K, dmg: 0.5, fail: 1.2, name: 'Abominable Blink' });
      check({ t, kind: 'spot', slots: S.filter(s => s !== tank), spots, r: 4, fail: 1.2, name: 'Abominable Blink' });
      mark({ kind: 'lit', shape: 'circle', at: spots[tank], r: 23 * K, t0: cs, t1: t, fill: 'rgba(255,90,40,0.12)' });
      call(cs, 'Flare + buster on YOU, Away from party', { slot: tank, alert: true, dur: 6 });
      callEach(cs, S.filter(s => s !== tank), 'Away from Flare', { alert: true, dur: 6 });
      if (tank === 'MT') call(cs, 'Provoke: take the tank tether', { slot: 'OT', alert: true, dur: 5 });
      pref(t + 0.3, nBlink === 2 ? strange2Spots() : up2(wk));
    };

    // Sporesplosion: a 3 x 6 grid of puddles in three sets, each row's three in a random order.
    const sporesplosion = (i, ev) => {
      const sets = [1, 2, 3].map(k => find(i, e => e.name === `Sporesplosion ${k}`, 14));
      sets.forEach(e => e && used.add(e));
      const order = [0, 1, 2, 3, 4, 5].map(() => shuffle([0, 1, 2]));
      const cols3 = [-8.5 * K, 0, 8.5 * K], rows6 = [-21.2, -12.8, -4.2, 4.2, 12.8, 21.2].map(v => v * K);
      sets.forEach((e, k) => {
        if (!e) return;
        rows6.forEach((y, r) => hz({ t: e.t, tell: e.t - 5, shape: 'circle', at: [cols3[order[r][k]], y], r: 5.6, dmg: 1.2, react: 2, name: 'Sporesplosion' }));
      });
      sporeEnd = (sets[2] || ev).t;
      call(castOf(ev, 4), 'Puddles: step into each one after it bursts', { alert: true, dur: 6 });
    };

    // Strange Seeds: two seeds every 5 s, a support's and a DPS's; each drops on its wave's dot (or a tether holder's
    // own spot) and sprouts a star 4.7 s later; everyone else waits by the boss, where no star reaches.
    const fS = () => (w2 === 'SW' ? 1 : -1);
    const strange2Spots = () => {
      const f = fS(), sp = clump(mul(SEEDS2.safe, f), 1);
      for (const [k, s] of Object.entries(TETHER2[V2])) sp[s] = mul(SEEDS2[k], f);
      return sp;
    };
    const strange2 = (i, ev) => {
      const f = fS(), tet = TETHER2[V2], tethered = Object.values(tet);
      const waves = [1, 2, 3, 4].map(k => find(i, e => e.name === `Strange Seeds ${k}`, 25));
      const tends = [1, 2, 3, 4].map(k => find(i, e => e.name === `Tendrils of Terror ${k}`, 30));
      [...waves, ...tends].forEach(e => e && used.add(e));
      P.labels.set(ev, `Strange Seeds (boss ${w2 === 'SW' ? 'south' : 'north'})`);
      const sup = shuffle(SUP), dps = shuffle(DPS), home = strange2Spots();
      pref(castOf(ev, 4), home);
      waves.forEach((w, k) => {
        if (!w) return;
        const pair = [sup[k], dps[k]], dots = (k % 2 ? SEEDS2.dotsB : SEEDS2.dotsA).map(p => mul(p, f));
        const drop = {};
        pair.forEach((s, j) => {
          const tk = Object.keys(tet).find(x => tet[x] === s);
          drop[s] = tk ? mul(SEEDS2[tk], f) : dots[j];
        });
        pref(w.t - 4.6, drop);
        check({ t: w.t, kind: 'spread', slots: pair, r: 6 * K, dmg: 0.2, fail: 0.8, name: 'Strange Seeds' });
        pair.forEach(s => deb(s, null, `Strange Seed (wave ${k + 1})`, 'drop it on your dot, then back to the boss', w.t - 5, w.t));
        callEach(w.t - 5, pair, 'Drop seed', { alert: true, dur: 5 });
        pref(w.t + 0.15, Object.fromEntries(pair.map(s => [s, home[s]])));
        const te = tends[k];
        if (te) Object.values(drop).forEach(p => hzs(star(p, 2 * K), { t: te.t, tell: te.t - 3, dmg: 1.3, name: 'Tendrils of Terror' }));
      });
      if (tends[0]) call(tends[0].t - 3, 'Avoid line AoEs', { dur: 3 });
      // Killer Seeds: partner stacks, each sprouting a star.
      const ks = find(i, e => e.name === 'Killer Seeds', 35), t5 = find(i, e => e.name === 'Tendrils of Terror 5', 40);
      if (ks) {
        used.add(ks);
        const pairs = PAIRS2[V2], spots = {};
        for (const [k, pr] of Object.entries(pairs)) for (const s of pr) spots[s] = mul(SEEDS2.pairsAt[k], f);
        pref(castOf(ks, 5) + 0.2, spots);
        check({ t: ks.t, kind: 'stack', groups: Object.values(pairs), r: 6 * K, spots, dmg: 0.3, fail: 0.8, name: 'Killer Seeds' });
        call(castOf(ks, 5), 'Stack with partner', { alert: true, dur: 5 });
        for (const pr of Object.values(pairs)) for (const s of pr) call(castOf(ks, 5), `Stack with ${pr.find(x => x !== s)}`, { slot: s, dur: 5 });
        if (t5) {
          used.add(t5);
          Object.keys(pairs).forEach(k => hzs(star(mul(SEEDS2.pairsAt[k], f), 2 * K), { t: t5.t, tell: t5.t - 3, dmg: 1.3, name: 'Tendrils of Terror' }));
        }
        pref(ks.t + 0.2, up2(w2));
        tethered.forEach(s => deb(s, 'thornsOfDeath', 'Thorns of Death', 'hold your wall tether', 267.6, ks.t + 0.3));
      }
    };

    // ---- P3 ----
    const WALL3NAME = { 0: 'north', 90: 'east', 180: 'south', 270: 'west' };
    // Before a P3 swing: the ground nearest each slot's next spot that's inside (or outside) the swing's reach and clear
    // of anything landing with it.
    const preNear = (targets, wall, inn, extra) => all(s => {
      const q = targets[s], ok = (p) => Math.abs(p[0]) < 18.8 && Math.abs(p[1]) < 18.8
        && (inn ? Math.hypot(p[0] - wall[0], p[1] - wall[1]) < 21.712 - 1.6 : Math.hypot(p[0] - wall[0], p[1] - wall[1]) > 26.6)
        && !(extra || []).some(h => B.mechInside(h, p, 1.5));
      for (let r = 0; r <= 40; r += 0.5) {
        const n = Math.max(1, Math.round(r * 5));
        let best = null, bd = Infinity;
        for (let k = 0; k < n; k++) {
          const a = k / n * 2 * Math.PI, c = [q[0] + Math.sin(a) * r, q[1] + Math.cos(a) * r];
          if (!ok(c)) continue;
          const d = Math.hypot(c[0] - wall[0], c[1] - wall[1]);
          if (d < bd) { bd = d; best = c; }
        }
        if (best) return best;
      }
      return q;
    });
    const lariatSpots = (side, wb) => rotAll(clump([side === 'right' ? 14 : -14, 2], 1.6), wb);
    const swing3 = (i, ev) => {
      nSwing3++;
      const R = ring3, k = nSwing3 - 1, wb = R.walls[k], inn = k === 0 ? R.first === 'in' : R.first !== 'in';
      const t = ev.t, cs = t - 6.7, wall = at(wb, 34.5), weapon = inn ? 'sword' : 'club';
      P.labels.set(ev, `Brutish Swing (${inn ? 'in' : 'out'}, ${WALL3NAME[wb]} wall)`);
      if (inn) inDisc(wall, 21.712, t, cs, 'Brutish Swing');
      else hz({ t, tell: cs, shape: 'circle', at: wall, r: 25, dmg: 1.4, name: 'Brutish Swing' });
      bossAt(wall, 19.7, cs + 3, t + 8);
      const lar = k === 0 ? find(i, e => e.name === 'Lashing Lariat', 9) : null, side = R.hands[weapon];
      // Where each goes next: the lariat's strip, or (the second swing) Glower Power's spreads or the tank tower.
      const nextSpots = k === 0 ? lariatSpots(side, wb) : R.n === 1 ? rotAll(P3_GLOWER[V3], wb) : slamSpots(R.n === 1 ? 'MT' : 'OT', rotAll(clump([0, inn ? 15 : -5], 1.3), wb));
      const te = R.tend[k], extra = te && Math.abs(te.t - t) < 1 ? R.stars[k] : null;
      // (Stoneringers 2: the stars leave one pocket in the swing's reach, the middle of it; everyone takes that.)
      const pre = R.n === 2 ? rotAll(clump([0, inn ? 14.6 : -5], 0.4), wb) : preNear(nextSpots, wall, inn, extra);
      R.last = pre;
      // The seed holders leave their markers once they've dropped; the rest go as soon as the swing shows.
      const holders = R.holders[k] || [];
      pref(cs + 0.3, Object.fromEntries(S.filter(s => !holders.includes(s)).map(s => [s, pre[s]])));
      if (holders.length) pref(R.hold[k], Object.fromEntries(holders.map(s => [s, pre[s]])));
      const io = `${inn ? 'In at' : 'Out from'} tethered wall (${WALL3NAME[wb]})`;
      let text = io;
      if (R.n === 1) text = k === 0 ? `${io} + Big AoE => Get ${side === 'left' ? 'Left' : 'Right'}` : `${io} => Spread, Away from front`;
      else if (k === 0) text = `${io} => Get ${side === 'left' ? 'Left' : 'Right'}`;
      call(cs, text, { alert: true, dur: 7 });
      if (lar) {
        used.add(lar);
        // The lariat sweeps all but a 12-yalm strip on the weapon's side (looking at the wall).
        const lc = castOf(lar, 4), rect = side === 'right' ? rotRect([-25, -25], [8, 40], wb) : rotRect([-8, -25], [25, 40], wb);
        hz(Object.assign({ t: lar.t, tell: lc, dmg: 1.5, name: 'Lashing Lariat' }, rect));
        P.labels.set(lar, `Lashing Lariat (get ${side})`);
        call(lc, side === 'left' ? '<== Get Left' : 'Get Right ==>', { alert: true, dur: 4 });
        pref(t + (R.n === 1 ? 0.2 : (R.tend[0] ? R.tend[0].t - t + 0.1 : 0.4)), lariatSpots(side, wb));
      }
    };

    // Stoneringers 1's second swing: spreads round Glower Power's line from that wall, then Slaminator.
    const glower3 = (i, ev, wb) => {
      const ef = find(i, e => e.name === 'Electrogenetic Force', 5), gp = find(i, e => e.name === 'Glower Power', 5);
      [ef, gp].forEach(e => e && used.add(e));
      if (gp) hz(Object.assign({ t: gp.t, tell: gp.t - 2, dmg: 1.4, name: 'Glower Power' }, rotRect([-7, -25], [7, 40], wb)));
      pref(ev.t + 0.1, rotAll(P3_GLOWER[V3], wb));
      if (ef) check({ t: ef.t, kind: 'spread', r: 6, dmg: 0.25, fail: 0.8, name: 'Electrogenetic Force' });
      return ef ? ef.t : ev.t + 3;
    };

    // Slaminator's tower: the tank in the middle, everyone else 10.8 out on the bearing they came from.
    const slamSpots = (tank, prev) => Object.assign(all(s => at(prev && Math.hypot(prev[s][0], prev[s][1]) > 1 ? brg(prev[s]) : CLOCK[s], 10.8)), { [tank]: [0, 0.3] });
    const slaminator = (ev, after, prev) => {
      nSlam++;
      const tank = nSlam === 1 ? 'MT' : 'OT', cs = castOf(ev, 5);
      hz({ t: ev.t, tell: cs, shape: 'tankcones', aimed: true, slots: [tank], half: 180, r: 8, dmg: 1.4, buster: 0.5, name: 'Slaminator' });
      pref(Math.max(cs, after), slamSpots(tank, prev));
      check({ t: ev.t, kind: 'spot', slots: [tank], spots: { [tank]: [0, 0.3] }, r: 3, fail: 1.4, name: 'Slaminator' });
      call(cs, 'Get tower (tank buster: invuln)', { slot: tank, alert: true, dur: 5 });
      callEach(cs, S.filter(s => s !== tank), 'Tank tower in the middle: stay out', { dur: 5 });
      pref(ev.t + 0.3, UP);
    };

    // Debris Deathmatch: tethers to the healers and ranged, Spore Sac and Pollen, Killer Seeds' pairs, the stars, and
    // Quarry Swamp behind the two adds.
    const debris = (i, ev) => {
      const pt = POLLEN[pat3], t = ev.t;
      HR.forEach(s => deb(s, 'thornsOfDeath', 'Thorns of Death', `hold the tether from the ${WALL3NAME[WALL3[s]]} wall`, t + 1.1, 533.5));
      callEach(castOf(ev, 3), HR, 'Get tethers', { dur: 5 });
      pref(t + 0.3, Object.assign({}, UP, Object.fromEntries(HR.map(s => [s, at(WALL3[s], 17)]))));
      const spore = find(i, e => e.name === 'Spore Sac' && e.cast === 4, 15), pol = find(i, e => e.name === 'Pollen', 20);
      const ks = find(i, e => e.name === 'Killer Seeds', 25), tend = find(i, e => e.name === 'Tendrils of Terror', 28);
      const quarry = find(i, e => e.name === 'Quarry Swamp', 40);
      [spore, pol, ks, tend, quarry].forEach(e => e && used.add(e));
      if (spore) { pw3.forEach(p => hz({ t: spore.t, tell: castOf(spore, 4), shape: 'circle', at: p, r: 8, dmg: 1.3, name: 'Spore Sac' })); }
      // Pollen: the tethered to the outer safe corner by their wall, the rest to the inner one by their partner's.
      const angd = (a, b) => Math.abs((((a - b) % 360) + 540) % 360 - 180);
      const near = (b, list) => list.reduce((p, q) => (angd(brg(q), b) < angd(brg(p), b) ? q : p));
      const outer = [pt.outW, pt.outE], inner = [pt.inW, pt.inE];
      const polSpots = {};
      for (const s of HR) polSpots[s] = mul(near(WALL3[s], outer), 0.97);
      for (const s of TM) polSpots[s] = mul(near(WALL3[PAIR3[s]], inner), 0.9);
      if (pol) { pollenHits(pol, pat3); pref((spore ? spore.t : castOf(pol, 4)) + 0.2, polSpots); }
      if (ks) {
        const r = V3 === 'game8' ? 18 : 15, spots = {}, groups = [];
        for (const [m, h] of Object.entries(PAIR3)) { spots[m] = spots[h] = at(WALL3[h], r); groups.push([m, h]); }
        pref((pol ? pol.t : castOf(ks, 5)) + 0.2, spots);
        check({ t: ks.t, kind: 'stack', groups, r: 6, spots, dmg: 0.3, fail: 0.8, name: 'Killer Seeds' });
        call(castOf(ks, 5), 'Stack with partner', { alert: true, dur: 5 });
        if (tend) Object.values(spots).filter((p, k, a) => a.findIndex(q => same(q, p)) === k).forEach(p => hzs(star(p), { t: tend.t, tell: tend.t - 3, dmg: 1.3, name: 'Tendrils of Terror' }));
      }
      // The adds come up on the two inner points Pollen hit; G1 hides behind the western one.
      const addsAt = [[5.5, 5.5], [-5.5, -5.5], [-5.5, 5.5], [5.5, -5.5]].filter(p => !pt.safe.some(q => same(q, p)));
      const bW = brg(addsAt.find(p => p[0] < 0)), bE = bW + 180;
      const behind = (b, list) => Object.fromEntries(list.map((s, k) => [s, at(b + [0, -4, 4, 0][k], [14, 15, 15, 15.5][k])]));
      const los = Object.assign(behind(bW, ['MT', 'M1', 'H1', 'R1']), behind(bE, ['OT', 'M2', 'H2', 'R2']));
      pref((ks ? ks.t : t + 20) + 0.2, los);
      if (quarry) {
        const cs = castOf(quarry, 4);
        hzs([{ shape: 'circle', at: [0, 0], r: 9.3 }, { shape: 'cone', at: [0, 0], deg: bW + 90, half: 68, r: 60 }, { shape: 'cone', at: [0, 0], deg: bW - 90, half: 68, r: 60 }],
          { t: quarry.t, tell: cs, dmg: 1.5, name: 'Quarry Swamp' });
        call(cs, 'Line of Sight boss with adds', { alert: true, dur: 4 });
      }
    };

    // P3 Sinister Seeds, with Pulp Smash after: the healers and ranged (on their tethers at the walls) bait the
    // puddles round the edge while the tanks and melee drop the seeds, or the other way round.
    const seeds3 = (i, ev) => {
      const seedTM = Math.random() < 0.5, seeders = seedTM ? TM : HR, baiters = seedTM ? HR : TM;
      const puds = [1, 2, 3, 4].map(k => find(i, e => e.name === `Sinister Seeds (puddles ${k})`, 15));
      const drop = find(i, e => e.name === 'Sinister Seeds (seeds drop)', 12), tend = find(i, e => e.name === 'Tendrils of Terror', 16);
      const roots = find(i, e => e.name === 'Roots of Evil', 16), pulp = find(i, e => e.name === 'Pulp Smash', 20), unp = find(i, e => e.name === 'The Unpotted', 22);
      [...puds, drop, tend, roots, pulp, unp].forEach(e => e && used.add(e));
      P.labels.set(ev, `Sinister Seeds (${seedTM ? 'ranged' : 'melee'} puddles)`);
      const paths = {}, seeds = {};
      let wait, stackAt;
      if (seedTM) {
        // Ranged puddles round the edge (18.5 out), the melee's seeds on markers; wait for the stars inside the roots.
        for (const s of baiters) {
          const b = WALL3[s];
          paths[s] = V3 === 'game8'
            ? (b === 0 || b === 270 ? [-33, -6, 21, 48] : [33, 6, -21, -48]).map(d => at(b + d, 18.5))
            : [-14, -41, -68, -95].map(d => at(b + d, 18.5));
        }
        Object.assign(seeds, V3 === 'game8' ? { MT: [0, 14], OT: [0, -14], M1: [-14, 0], M2: [14, 0] } : V3 === 'mr'
          ? { MT: [-10, 10], OT: [10, 10], M1: [-10, -10], M2: [10, -10] } : { MT: [-10, 10], OT: [10, -10], M1: [-10, -10], M2: [10, 10] });
        wait = V3 === 'game8' ? { MT: [-3.2, 3.2], R1: [-3.2, 3.2], OT: [3.2, -3.2], R2: [3.2, -3.2], M1: [-3.2, -3.2], H1: [-3.2, -3.2], M2: [3.2, 3.2], H2: [3.2, 3.2] }
          : { MT: [0, 4.6], R1: [0, 4.6], OT: [0, -4.6], R2: [0, -4.6], M1: [-4.6, 0], H1: [-4.6, 0], M2: [4.6, 0], H2: [4.6, 0] };
        stackAt = null;
      } else {
        // Melee puddles clockwise round the boss, 8 out (Game8 from the north-west); the ranged's seeds at their
        // walls; everyone waits out the roots in the south-west corner and stacks there.
        const b0 = V3 === 'game8' ? 315 : 270;
        for (const s of baiters) paths[s] = [0, 60, 120, 180].map(d => at(b0 + d, 8));
        for (const s of seeders) seeds[s] = at(WALL3[s], 18.5);
        wait = clump([-14.5, -14.5], 1.2);
        stackAt = [-12, -12];
      }
      const t0 = castOf(ev, 4);
      pref(t0, Object.assign(Object.fromEntries(baiters.map(s => [s, paths[s][0]])), Object.fromEntries(seeders.map(s => [s, seedTM ? [seeds[s][0] * 0.4, seeds[s][1] * 0.4] : seeds[s]]))));
      const all16 = [];
      puds.forEach((pe, k) => {
        if (!pe) return;
        const ts = pe.t - 3, pts = [];
        for (const s of baiters) { const p = paths[s][k]; if (!pts.some(q => same(q, p))) pts.push(p); }
        pts.forEach(p => { hz({ t: pe.t, tell: ts, shape: 'circle', at: p, r: 7, dmg: 1.2, name: 'Sinister Seeds' }); all16.push(p); });
        if (k < 3) pref(ts + 0.05, Object.fromEntries(baiters.map(s => [s, paths[s][k + 1]])));
      });
      const seedT = drop ? drop.t : ev.t + 8;
      pref(puds[1] ? puds[1].t + 0.1 : seedT - 2, Object.fromEntries(seeders.map(s => [s, seeds[s]])));
      check({ t: seedT, kind: 'spread', slots: seeders, r: 6, dmg: 0.2, fail: 0.8, name: 'Sinister Seeds' });
      for (const s of seeders) deb(s, null, 'Sinister Seed', 'drop it on your spot, clear of everyone', castOf(drop || ev, 7), seedT);
      callEach(castOf(drop || ev, 7), seeders, 'Drop seed', { dur: 6 });
      callEach(castOf(drop || ev, 7), baiters, 'Bait Puddles', { alert: true, dur: 6 });
      pref(seedT + 0.2, Object.fromEntries(seeders.map(s => [s, wait[s]])));
      pref((puds[3] ? puds[3].t - 3 : seedT) + 0.6, Object.fromEntries(baiters.map(s => [s, wait[s]])));
      if (tend) Object.values(seeds).forEach(p => hzs(star(p), { t: tend.t, tell: tend.t - 3, dmg: 1.3, name: 'Tendrils of Terror' }));
      if (roots) all16.forEach(p => hz({ t: roots.t, tell: tend ? tend.t - 3 : roots.t - 5, shape: 'circle', at: p, r: 12, dmg: 1.4, name: 'Roots of Evil' }));
      if (!pulp) return;
      if (!stackAt) { pulpMiddle(pulp.t, unp, clump([0, 0], 1)); return; }
      // Stacked in the south-west, the boss leaps onto the stack and fires its proteans from there: the clock round
      // it (it faces the middle), drawn, and checked as your spot.
      const tgt = pick(S), tu = unp ? unp.t : pulp.t + 2;
      pref(pulp.t - 4.8, clump(stackAt, 1));
      check({ t: pulp.t, kind: 'stack', groups: [S], r: 6, dmg: 0.3, fail: 0.9, name: 'Pulp Smash' });
      call(pulp.t - 5, `Stack on ${tgt} => Out + Protean`, { dur: 5 });
      hz({ t: tu, tell: pulp.t, shape: 'circle', at: stackAt, r: 6, dmg: 1.3, react: 2, name: 'It Came from the Dirt' });
      bossAt(stackAt, 7, pulp.t, 573.6);
      const clockAt = all(s => { const p = at(CLOCK[s] + 45, 7.2); return [stackAt[0] + p[0], stackAt[1] + p[1]]; });
      pref(pulp.t + 0.05, clockAt);
      check({ t: tu, kind: 'spot', spots: clockAt, r: 2.5, fail: 0.9, name: 'The Unpotted' });
      S.forEach(s => mark({ kind: 'lit', shape: 'cone', at: stackAt, deg: CLOCK[s] + 45, half: 15, r: 40, t0: pulp.t, t1: tu, fill: 'rgba(255,120,60,0.16)' }));
      pref(tu + 0.4, UP);
    };

    // Stoneringers 2's Strange Seeds: the supports' or DPS's seeds on the intercards, then the others'.
    const strange3 = (i, ev) => {
      const drops = events.filter((e, k) => k > i && e.name === 'Strange Seeds (seeds drop)' && e.t - ev.t < 25);
      drops.forEach(e => used.add(e));
      const first = pick([SUP, DPS]), second = first === SUP ? DPS : SUP, map = SEEDS3[V3];
      const R = ring3;
      R.tend = [find(i, e => e.name === 'Tendrils of Terror', 13), find(i, e => e.name === 'Tendrils of Terror' && e.t > ev.t + 15, 28)];
      R.tend.forEach(e => e && used.add(e));
      P.labels.set(ev, `Strange Seeds (${first === SUP ? 'supports' : 'DPS'} first)`);
      [first, second].forEach((grp, k) => {
        const d = drops[k];
        if (!d) return;
        pref(k ? d.t - 4.2 : castOf(ev, 4) + 0.2, Object.assign(k ? {} : clump([0, 0], 1.5), Object.fromEntries(grp.map(s => [s, map[s]]))));
        check({ t: d.t, kind: 'spread', slots: grp, r: 6, dmg: 0.2, fail: 0.8, name: 'Strange Seeds' });
        grp.forEach(s => deb(s, null, 'Strange Seed', 'drop it on your marker', d.t - 5, d.t));
        callEach(d.t - 5, grp, 'Drop seed', { alert: true, dur: 5 });
        R.hold[k] = d.t + 0.2;
        R.holders[k] = grp;
        const te = R.tend[k];
        R.stars[k] = [];
        if (te) grp.map(s => map[s]).filter((p, j, a) => a.findIndex(q => same(q, p)) === j).forEach(p => { R.stars[k].push(...star(p)); hzs(star(p), { t: te.t, tell: te.t - 3, dmg: 1.3, name: 'Tendrils of Terror' }); });
      });
      call(castOf(ev, 4), 'Seeds on the markers, then in/out from the wall', { dur: 5 });
    };

    events.forEach((ev, i) => {
      const name = ev.name, t = ev.t;
      if (used.has(ev)) return;
      if (name.startsWith('Brutal Impact')) {
        const n = parseInt((name.match(/x(\d+)/) || [0, 6])[1], 10);
        for (let k = 0; k < n; k++) raid(t + 0.2 + 1.07 * k, castOf(ev, 5), 0.09, 'Brutal Impact');
        call(castOf(ev, 5), `AoE x${n}`, { dur: 4 });
      } else if (name === 'Stoneringer') {
        const kind = pick(['out', 'in']);
        if (t > 150 && t < 360) {
          stored2 = kind;
          P.labels.set(ev, `Stoneringer (${kind === 'out' ? 'club: out later' : 'sword: in later'})`);
          call(castOf(ev, 2), kind === 'out' ? 'Out (for later)' : 'In (for later)', { dur: 6 });
        } else {
          stored = kind;
          P.labels.set(ev, `Stoneringer (${kind === 'out' ? 'club: out' : 'sword: in'})`);
          call(castOf(ev, 2), kind === 'out' ? 'Out' : 'In', { dur: 6 });
        }
      } else if (name === 'Smash Here/Smash There') smash(i, ev);
      else if (name === 'Spore Sac' && ev.cast === 4 && t < 150) {
        pw1.forEach(p => hz({ t, tell: castOf(ev, 4), shape: 'circle', at: p, r: 8, dmg: 1.3, name: 'Spore Sac' }));
      } else if (name === 'Pollen' && t < 150) pollenHits(ev, pat1);
      else if (name === 'Sinister Seeds') { if (t < 150) seeds1(i, ev); else seeds3(i, ev); }
      else if (name === 'Explosion 1') explosions(i, ev);
      else if (name === 'Pulp Smash' && t < 150) pulpMiddle(t, find(i, e => e.name === 'The Unpotted', 4));
      else if (name === 'Neo Bombarian Special') {
        raid(t, castOf(ev, 8), 0.5, name);
        call(castOf(ev, 8), 'Go North, big AoE + Launch', { alert: true, dur: 8 });
        pref(castOf(ev, 8) + 0.5, all(s => [OFF[s][0] * 3, 15 + OFF[s][1]]));
        // P2: a long arena between two walls (drawn scaled to 0.8: 20 wide here), the boss on the north building.
        for (const x of [1, -1]) mark({ kind: 'lit', shape: 'rect', a: [10 * x, -20], b: [20 * x, 20], t0: t, t1: 352.1, fill: 'rgba(10,10,20,0.62)' });
        bossAt(P2W.N.at, 19.7 * K, t, 176.5);
        pref(t + 0.2, UP2N);
      } else if (name === 'Brutish Swing' && t > 150 && t < 360) swing2(i, ev);
      else if (name === 'Revenge of the Vines') {
        raid(t, ev.cast ? castOf(ev, 5) : t - 2, 0.4, name);
        call(ev.cast ? castOf(ev, 5) : t - 2, 'Big AoE', { dur: 3 });
      } else if (name === 'Thorny Deathmatch') {
        call(castOf(ev, 3), 'Tank tether on MT', { dur: 5 });
        // The tank tether: MT's, but the other tank's while MT carries a flare away.
        const blinks = events.filter(e => e.name === 'Abominable Blink' && e.t > t).slice(0, 2);
        let t0 = t + 1.1;
        blinks.forEach((b, k) => {
          if (flares[k] !== 'MT') return;
          deb('MT', 'thornsOfDeathTank', 'Thorns of Death (tank tether)', 'keep the boss on you', t0, b.t - 6.6);
          deb('OT', 'thornsOfDeathTank', 'Thorns of Death (tank tether)', 'hold it while MT has the flare', b.t - 6.6, b.t + 1);
          t0 = b.t + 1;
        });
        deb('MT', 'thornsOfDeathTank', 'Thorns of Death (tank tether)', 'keep the boss on you', t0, 321.4);
      } else if (name === 'Abominable Blink') blink(i, ev);
      else if (name === 'Sporesplosion') sporesplosion(i, ev);
      else if (name === 'Demolition Deathmatch') {
        call(castOf(ev, 3), 'Get tethers', { dur: 5 });
        pref(t + 0.3, strange2Spots());
      } else if (name === 'Strange Seeds' && t < 360) strange2(i, ev);
      else if (name === 'Powerslam') {
        raid(t, castOf(ev, 6), 0.5, name);
        call(castOf(ev, 6), 'Big AoE', { alert: true, dur: 5 });
        pref(t + 0.3, UP);
      } else if (name === 'Stoneringer 2: Stoneringers') {
        nRing3++;
        const swordLeft = Math.random() < 0.5, first = pick(['in', 'out']);
        const walls = nRing3 === 1 ? (() => { const a = pick([0, 90, 180, 270]); return [a, (a + pick([90, 270])) % 360]; })() : [pick([0, 180]), pick([90, 270])];
        ring3 = { n: nRing3, first, walls, hands: { sword: swordLeft ? 'left' : 'right', club: swordLeft ? 'right' : 'left' }, hold: [], tend: [], stars: [], holders: [] };
        nSwing3 = 0;
        P.labels.set(ev, `Stoneringers (sword ${swordLeft ? 'left' : 'right'}, club ${swordLeft ? 'right' : 'left'})`);
      } else if (name === 'Brutish Swing' && t > 360 && ring3 && nSwing3 < 2) {
        swing3(i, ev);
        if (ring3.n === 1 && nSwing3 === 2) {
          const end = glower3(i, ev, ring3.walls[1]);
          const sl = find(i, e => e.name === 'Slaminator', 12);
          if (sl) { used.add(sl); slaminator(sl, end + 0.3, rotAll(P3_GLOWER[V3], ring3.walls[1])); }
        } else if (ring3.n === 2 && nSwing3 === 2) {
          const sl = find(i, e => e.name === 'Slaminator', 10);
          if (sl) { used.add(sl); slaminator(sl, (ring3.tend[1] ? ring3.tend[1].t : t) + 0.2, ring3.last); }
        }
      } else if (name === 'Debris Deathmatch') debris(i, ev);
      else if (name === 'Strange Seeds' && t > 360) strange3(i, ev);
      else if (name === 'Special Bombarian Special (enrage cast)') call(castOf(ev, 10), 'Enrage', { alert: true, dur: 5 });
    });
    return P;
  }

  B.FIGHT_SCRIPTS = B.FIGHT_SCRIPTS || {};
  B.FIGHT_SCRIPTS.m7s = {
    // His max HP in an FFLogs M7S kill (every damage event on him carries it).
    hp: 118583808,
    defaultStrat: 'toxic',
    strats: {
      toxic: { label: 'Toxic (NA / EU, the default)' },
      kindred: { label: 'Kindred' },
      game8: { label: 'Game8 (JP)' },
      mr: { label: 'MR (OCE)' },
    },
    source: 'wtfdig.info/72/m7s; mechanics after BossMod (github.com/awgil/ffxiv_bossmod)',
    // Toxic's: A-D on the cardinals, 1-4 on the rivets the seeds go on.
    waymarks: [
      { label: 'A', at: [0, 12], color: 'red' }, { label: 'B', at: [12, 0], color: 'yellow' },
      { label: 'C', at: [0, -12], color: 'blue' }, { label: 'D', at: [-12, 0], color: 'purple' },
      { label: '1', at: [-9, 9], color: 'red', square: true }, { label: '2', at: [9, 9], color: 'yellow', square: true },
      { label: '3', at: [9, -9], color: 'blue', square: true }, { label: '4', at: [-9, -9], color: 'purple', square: true },
    ],
    plan,
  };
})(window.BLM);
