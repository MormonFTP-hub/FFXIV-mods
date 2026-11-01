// The Cloud of Darkness (Chaotic), the 24-player alliance raid: her mechanics for the sim's party, on cactbot's timeline
// (07-dt/alliance/cloud_of_darkness_chaotic, read along its main line: the first diamond phase as the Death IV/Aero IV
// variant, the second as the Flare variant, the way BossMod's Fork2 runs), and the four strats wtfdig.info lists for
// the fight (71/chaotic): Raidplan (Aurelia/wfJ/o1Z), CODCAR, HealerOut and Idyll/game8. Spots are [east, north] yalms
// from the arena's middle (the game's 100, 100).
//
// The party: the sim's eight are alliance A, at wtfdig's A spots. The other two alliances (sixteen players) aren't
// there; wherever a mechanic needs them they're taken to do their part perfectly and stand clear of ours: they soak
// their own towers and their share of ours (a three-player tower our two stand in counts as soaked with two), take
// their place in our stacks and wild charges (counted as what our members bring), drop their seeds where their strat
// puts them (those voidzones are on the floor), and their spreads, cleaves and lasers miss us. What the game deals
// per alliance is dealt to ours as eight of twenty-four: one of the three flares, two of the six hands a wave, one
// line of three in Rapid-sequence Particle Beam, two of the six Unholy Darkness stacks, one of the four Feint chasers.
//
// The mechanics follow BossMod's module (github.com/awgil/ffxiv_bossmod, Ch01CloudOfDarkness), whose shapes and sizes
// come from the game's Action sheet, and FFLogs kills (where the boss, her helpers and the adds stand as they cast):
//   The diamond phases (after Deluge of Darkness; a 40-yalm square turned 45 degrees, its north tip cut off at 37 north,
//   its middle 23.7 north; off it is a fall):
//   - Blade of Darkness: under her left hand (east), under her right hand (west), or out of a 30-yalm half circle.
//   - Grim Embrace: every player gets a hand; four waves (52.6, 59.7, 66.7 and 108.6 s after the first cast) put an
//     8 by 8 hand in front of or behind each target (facing the boss), and the target steps out of its own.
//   - Razing-volley Particle Beam: Cloudlets on the south-east and south-west edges fire 8-wide lanes across the
//     diamond, two lanes from one edge, two from the other, then the other three of each: a cell of the 5 by 5 grid
//     safe from the first two waves, then one safe from the last two.
//   - Death IV (a 15-yalm draw-in to the middle, then a 6-yalm circle, then everything past 6) and Aero IV (a 15-yalm
//     knockback from the middle with an 8-yalm circle there); Endeath IV and Enaero IV store one for 2.2 s after the
//     next Blade of Darkness.
//   - Rapid-sequence Particle Beam: four wild charges from the boss along a line to each alliance's healer (ours: H1).
//   - Flare (bait it away: 25-yalm falloff), Unholy Darkness (four-player stacks on the healers), Break IV (gazes from
//     the boss and two Sinister Eyes).
//   The platforms and tiles (after the second Deluge of Darkness): a # of 6-wide bars (the tiles, 15 out from the
//   middle) where the boss is fought, and two side platforms (19-39 east and west, 15 wide) joined to an outer ring
//   (34-40 out), where the Stygian Shadows are; between them is the void:
//   - Dark Dominion (raidwide; the outer ring burns until the towers, and again until the second Third Art ends).
//   - The Third Art of Darkness: each Shadow's three mechanics, 3 s apart: a 15-yalm half circle to its left or right,
//     line proteans at the six nearest, or pair stacks on the three nearest.
//   - Particle Concentration: two three-player towers on each platform (along it or across it), a two- and a
//     one-player tower in each tile corner.
//   - Ghastly Gloom: a 30-wide cross (the corners of the tiles, the ring's corners off the platforms) or everything
//     past 21 (the inner tiles, the inner edge of the platforms).
//   - Curse of Darkness (raidwide) and its Dark-energy Particle Beams: each cursed player's laser (a 25-yalm, 15-degree
//     cone) when its curse runs out, pointed away from everyone.
//   - Evil Seed (four seeds a platform, voidzones till the next wild charges), Thorny Vine (the seeds tether their
//     planters: break by 25 yalms), Flood of Darkness (the Shadows' cast, interrupted).
//   - Chaos-condensed Particle Beam (wild charges from the boss to every tank: the platform's six, a tile corner's
//     three) or Diffusive-force Particle Beam (spreads: 7 yalms on the tiles, then 5 on the platforms).
//   - Phaser (each Shadow: three 60-degree cones from the platform's outer end, the middle one then the sides or the
//     other way), Active-pivot Particle Beam (an 18-wide line through the middle turning 22.5 degrees each 1.6 s, five
//     times: two quarters are swept and two never are), Excruciate (the Shadows' tank busters).
//   - Looming Chaos: raidwide, and the tethered players swap places: each strat's clean swap (wtfdig's "I got a clean
//     swap" spots) teleports ours to their second-half area.
//   - Feint Particle Beam: a chaser on one player of each tile corner (18 puddles, 2.1 yalms a step).
// Simplified: the strats' platform spots come from wtfdig's descriptions (the diagrams' masks put them, but not to the
// yalm); spots wtfdig doesn't give (where to stand for the cleaves, Phaser, the cross, Active-pivot, the vines, the
// chased player's run) are this script's own, solved each pull on the floor the player is on. Thorny Vine's tethers
// are on the seeds' planters and break at 25 yalms (BossMod's chain length). The tiles' crumbling (a tile stood on for
// 44 s breaks) isn't modelled. The boss's damage is counted as the party's alone: see `pushes` below.
(function (B) {
  const S = B.SLOTS;
  const at = B.bearing;
  const inside = B.mechInside;
  const add = (a, b) => [a[0] + b[0], a[1] + b[1]];
  const sub = (a, b) => [a[0] - b[0], a[1] - b[1]];
  const mul = (a, k) => [a[0] * k, a[1] * k];
  const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);
  const len = (p) => Math.hypot(p[0], p[1]);
  const deg360 = (d) => ((d % 360) + 360) % 360;
  const brg = (p) => deg360(Math.atan2(p[0], p[1]) * 180 / Math.PI);
  const pick = (a) => a[Math.floor(Math.random() * a.length)];
  const shuffle = (a) => { const b = a.slice(); for (let i = b.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [b[i], b[j]] = [b[j], b[i]]; } return b; };
  const r2 = (p) => [+p[0].toFixed(2), +p[1].toFixed(2)];
  const isTank = (s) => s === 'MT' || s === 'OT';

  // ---------- the floors ----------
  const MID = [0, 23.72];                                    // the diamond's middle (BossMod's Phase1Midpoint)
  const DIAMOND = { shape: 'line', at: MID, deg: 45, len: 20, back: 20, w: 40, deathwall: true };
  const ROUND = { shape: 'circle', at: [0, 0], r: 40 };
  const rect = (a, b) => ({ shape: 'rect', a, b });
  const BARS = [rect([-24, 12], [24, 18]), rect([-24, -18], [24, -12]), rect([12, -24], [18, 24]), rect([-18, -24], [-12, 24])];
  const PLAT = { W: rect([-39, -7.5], [-19, 7.5]), E: rect([19, -7.5], [39, 7.5]) };
  const RING = { shape: 'donut', at: [0, 0], r0: 34, r1: 40 };
  const SPLIT = { parts: [...BARS, PLAT.W, PLAT.E, RING], deathwall: true };
  const inRect = (r, p, m) => p[0] > Math.min(r.a[0], r.b[0]) + m && p[0] < Math.max(r.a[0], r.b[0]) - m
    && p[1] > Math.min(r.a[1], r.b[1]) + m && p[1] < Math.max(r.a[1], r.b[1]) - m;
  const onTiles = (p, m = 0.8) => BARS.some(b => inRect(b, p, m));
  const onRing = (p, m = 0.8) => { const d = len(p); return d > 34 + m && d < 40 - m; };
  // A platform and the ring's half on its side (the ring joins the two, but nobody here walks round to the other).
  const onSide = (side, p, m = 0.8) => (side === 'W' ? p[0] < 6 : p[0] > -6) && (inRect(PLAT[side], p, m) || onRing(p, m));
  const inDiamond = (p, m = 1) => inside(DIAMOND, p, -m) && p[1] < 37 - m;

  // ---------- placing ----------
  // The nearest point to `want` that's ok (searched outward), or want.
  function findSpot(want, ok, maxR = 36) {
    if (ok(want)) return r2(want);
    for (let r = 0.25; r <= maxR; r += 0.25) {
      const n = Math.max(12, Math.round(2 * Math.PI * r / 0.3));
      for (let k = 0; k < n; k++) { const p = add(want, at(k * 360 / n, r)); if (ok(p)) return r2(p); }
    }
    return r2(want);
  }
  const segOk = (a, b, ok) => {
    const n = Math.max(2, Math.ceil(dist(a, b) / 0.3));
    for (let k = 0; k <= n; k++) if (!ok(add(a, mul(sub(b, a), k / n)))) return false;
    return true;
  };
  // A way from a to b over the floor `ok` allows (A* on a 1-yalm grid, then straightened): its corners, a first, b last.
  const NB = [[1, 0, 1], [-1, 0, 1], [0, 1, 1], [0, -1, 1], [1, 1, Math.SQRT2], [1, -1, Math.SQRT2], [-1, 1, Math.SQRT2], [-1, -1, Math.SQRT2]];
  function route(a, b, ok) {
    if (segOk(a, b, ok)) return [r2(a), r2(b)];
    const N = 83, O = -41, cell = (k) => [O + Math.floor(k / N), O + k % N];
    const known = new Int8Array(N * N);
    const good = (i, j) => {
      if (i < 0 || j < 0 || i >= N || j >= N) return false;
      const k = i * N + j;
      if (!known[k]) known[k] = ok([O + i, O + j]) ? 1 : 2;
      return known[k] === 1;
    };
    const near = (p) => {
      let best = -1, bd = Infinity;
      const ci = Math.round(p[0] - O), cj = Math.round(p[1] - O);
      for (let di = -3; di <= 3; di++) for (let dj = -3; dj <= 3; dj++) {
        const i = ci + di, j = cj + dj;
        if (!good(i, j)) continue;
        const q = [O + i, O + j], d = dist(p, q);
        if (d < bd && segOk(p, q, ok)) { bd = d; best = i * N + j; }
      }
      return best;
    };
    const s0 = near(a), g0 = near(b);
    if (s0 < 0 || g0 < 0) return [r2(a), r2(b)];
    const gq = cell(g0), gs = new Float64Array(N * N).fill(Infinity), from = new Int32Array(N * N).fill(-1), done = new Uint8Array(N * N);
    const heap = [];
    const push = (f, k) => { heap.push([f, k]); let i = heap.length - 1; while (i > 0) { const p = (i - 1) >> 1; if (heap[p][0] <= heap[i][0]) break; [heap[p], heap[i]] = [heap[i], heap[p]]; i = p; } };
    const pop = () => {
      const top = heap[0], last = heap.pop();
      if (heap.length) {
        heap[0] = last;
        let i = 0;
        for (;;) { const l = 2 * i + 1, r = l + 1; let m = i; if (l < heap.length && heap[l][0] < heap[m][0]) m = l; if (r < heap.length && heap[r][0] < heap[m][0]) m = r; if (m === i) break; [heap[m], heap[i]] = [heap[i], heap[m]]; i = m; }
      }
      return top;
    };
    gs[s0] = 0;
    push(dist(cell(s0), gq), s0);
    while (heap.length) {
      const [, k] = pop();
      if (done[k]) continue;
      done[k] = 1;
      if (k === g0) break;
      const i = Math.floor(k / N), j = k % N;
      for (const [di, dj, c] of NB) {
        const ii = i + di, jj = j + dj;
        if (!good(ii, jj) || (di && dj && (!good(i + di, j) || !good(i, j + dj)))) continue;
        const kk = ii * N + jj, g = gs[k] + c;
        if (g < gs[kk]) { gs[kk] = g; from[kk] = k; push(g + dist(cell(kk), gq), kk); }
      }
    }
    if (g0 !== s0 && from[g0] < 0) return [r2(a), r2(b)];
    const nodes = [];
    for (let k = g0; ; k = from[k]) { nodes.unshift(cell(k)); if (k === s0 || from[k] < 0) break; }
    const pts = [a, ...nodes, b], out = [pts[0]];
    for (let i = 0; i < pts.length - 1;) {
      let j = pts.length - 1;
      while (j > i + 1 && !segOk(pts[i], pts[j], ok)) j--;
      out.push(pts[j]);
      i = j;
    }
    return out.map(r2);
  }
  // A spot that walks a way (the corners `pts`) from second t0 at v yalms a second: a function of the second.
  function along(pts, t0, v) {
    const L = [0];
    for (let i = 1; i < pts.length; i++) L.push(L[i - 1] + dist(pts[i - 1], pts[i]));
    const total = L[L.length - 1];
    const fn = (t) => {
      const s = Math.max(0, (t - t0) * v);
      if (s >= total) return pts[pts.length - 1];
      let i = 1;
      while (L[i] < s) i++;
      const k = (s - L[i - 1]) / Math.max(1e-6, L[i] - L[i - 1]);
      return [pts[i - 1][0] + (pts[i][0] - pts[i - 1][0]) * k, pts[i - 1][1] + (pts[i][1] - pts[i - 1][1]) * k];
    };
    fn.arrive = t0 + total / v;
    return fn;
  }
  const CL = (n, rad) => [[0, 0], ...Array.from({ length: Math.max(0, n - 1) }, (_, i) => at(i * 360 / Math.max(1, n - 1), rad))];
  const clusterAt = (c, slots, rad = 1.2) => { const o = CL(slots.length, rad); return Object.fromEntries(slots.map((s, i) => [s, r2(add(c, o[i]))])); };

  // ---------- the diamond phases ----------
  const BOSS0 = [0, 44], BOSS1 = [0, 41];
  const HAND = { L: [13, 32], R: [-13, 32] };              // her left hand (the east one) and her right
  const UP = { MT: [-1.5, 17.6], OT: [1.5, 17.6], M1: [-3.6, 16], M2: [3.6, 16], H1: [-5.5, 11.5], H2: [5.5, 11.5], R1: [-9, 9.5], R2: [9, 9.5] };
  // Razing-volley's lanes: the Cloudlets 8 yalms apart on the south-east edge (firing north-west) and the south-west
  // edge (firing north-east); lane i of the one and lane j of the other cross in cell (i, j).
  const CLOUD = { SE: [0, 1, 2, 3, 4].map(k => [4.24 + 5.657 * k, -3.16 + 5.657 * k]), SW: [0, 1, 2, 3, 4].map(k => [-4.24 - 5.657 * k, -3.16 + 5.657 * k]) };
  const cellMid = (i, j) => [5.657 * (i - j), 1.075 + 5.657 * (i + j)];

  // ---------- the platforms and the tiles ----------
  const ADD = { W: [-27, 0], E: [27, 0] };
  // A platform spot from its W-platform terms (a: out from the Shadow toward the wall, b: north there): on the east
  // platform, north stays north for the true-north strats and turns to south for the wall-relative ones.
  const plat = (side, a, b, rel) => (side === 'W' ? [-27 - a, b] : [27 + a, rel ? -b : b]);
  const DIRV = { up: [0, 1], down: [0, -1], out: [1, 0], in: [-1, 0], upout: [0.707, 0.707], downout: [0.707, -0.707], upin: [-0.707, 0.707], downin: [-0.707, -0.707] };
  const platDir = (side, dir, k, rel) => plat(side, DIRV[dir][0] * k, DIRV[dir][1] * k, rel);
  // A bearing in W-platform terms (0 north, 90 in, 270 out) on that side.
  const platBrg = (side, th, rel) => (side === 'W' ? deg360(th) : rel ? deg360(th + 180) : deg360(360 - th));
  const TOWER = { in: [-5, 0], out: [4, 0], up: [-0.5, 4.5], down: [-0.5, -4.5] };
  // The tile corners' cells: the corner tile, the arms toward the middle, the arm ends (the cubbies).
  const CORNER = { NE: [1, 1], NW: [-1, 1], SE: [1, -1], SW: [-1, -1] };
  const CELL = { C: [15, 15], H1: [9, 15], H2: [3, 15], Hc: [21, 15], V1: [15, 9], V2: [15, 3], Vc: [15, 21] };
  const cellAt = (c, name) => {
    const [sx, sy] = CORNER[c];
    if (name === 'Nc') name = sy > 0 ? 'Vc' : 'V1';          // the cell north of the corner tile
    if (name === 'Sc') name = sy > 0 ? 'V1' : 'Vc';
    return [CELL[name][0] * sx, CELL[name][1] * sy];
  };

  // ---------- the strats (alliance A) ----------
  // Z1/Z2: each spot's area before and after Looming Chaos (W, E: the platforms; a tile corner; T: the north-east or
  // south-east corner, whichever the swap gives). P1/P2: the platform spots in W-platform terms: pr, the pair stack
  // (T: marked, nearest the Shadow; P: its partner) and its direction; pd, the protean's bearing; tw, the tower (the
  // first if this pull's pair has it, else the second); sd, the seed; ao, the Diffusive-force spread; sw, the spot
  // before the swap. X1/X2: absent players on our platforms (their seeds, a pair our member partners). T1/T2: the
  // tile spots: id (where to stand), sw (before the swap), wc (the tank's wild charge cell), ch (for the chasers).
  const role = { MT: 'T', OT: 'T', H1: 'H', H2: 'H', M1: 'M', M2: 'M', R1: 'R', R2: 'R' };
  const CODCAR = {
    T: { pr: ['T', 'out'], pd: 270, tw: ['out', 'up'], ao: { W: [-5, -4.5], E: [-5, 4.5] }, sw: [6, 0] },
    H: { pr: ['P', 'out'], pd: 315, tw: ['out', 'up'], sd: [3, 6.3], ao: [5, -4.5], sw: [6, 5] },
    M: { pr: ['T', 'downin'], pd: 225, tw: ['out', 'up'], ao: { W: [-5, 4.5], E: [-5, -4.5] }, sw: [6, -5] },
    R: { pr: ['P', 'downin'], pd: 180, tw: ['in', 'down'], sd: [3, -6.3], ao: [5, 4.5], sw: [-5, -5] },
  };
  const byRole = (T) => Object.fromEntries(S.map(s => [s, T[role[s]]]));
  const STRATS = {
    raidplan: {
      face: 'north', rel: false,
      Z1: { MT: 'W', H1: 'W', M1: 'W', M2: 'W', R1: 'W', R2: 'W', OT: 'SW', H2: 'SW' },
      Z2: { MT: 'T', H1: 'T', R1: 'T', OT: 'E', H2: 'E', M1: 'E', M2: 'E', R2: 'E' },
      P1: {
        MT: { pr: ['T', 'up'], pd: 0, tw: ['up', 'in'], ao: [-5, 4.5], sw: [6, 5] },
        H1: { pr: ['T', 'down'], pd: 180, tw: ['down', 'out'], ao: [-5, -4.5], sw: [6, 0] },
        M1: { pr: ['P', 'up'], pd: 337.5, tw: ['up', 'in'], sd: [-3, 6.3], ao: [5, 4.5], sw: [-5, 5] },
        M2: { pr: ['P', 'down'], pd: 202.5, tw: ['down', 'out'], sd: [-3, -6.3], ao: [5, -4.5], sw: [-5, -5] },
        R1: { pr: ['T', 'out'], pd: 292.5, tw: ['up', 'in'], sd: [3, 6.3], ao: [8.5, -13], sw: [6, -5] },
        R2: { pr: ['P', 'out'], pd: 247.5, tw: ['down', 'out'], sd: [3, -6.3], ao: [8.5, 13], sw: [-5, 0] },
      },
      P2: {
        OT: { pr: ['T', 'up'], pd: 0, tw: ['up', 'out'], ao: [-5, 4.5] },
        H2: { pr: ['T', 'down'], pd: 180, tw: ['down', 'in'], ao: [-5, -4.5] },
        M1: { pr: ['P', 'up'], pd: 337.5, tw: ['up', 'out'], ao: [5, 4.5] },
        M2: { pr: ['P', 'down'], pd: 202.5, tw: ['down', 'in'], ao: [5, -4.5] },
        R2: { pr: ['P', 'out'], pd: 247.5, tw: ['down', 'in'], ao: [8.5, 13] },
      },
      X1: {}, X2: { E: { stacks: ['out'] } },
      T1: { OT: { id: 'H1', sw: 'H1', wc: 'C' }, H2: { id: 'Hc', sw: 'Hc' } },
      T2: { MT: { id: 'H1', wc: 'C', ch: 'H1' }, H1: { id: 'Hc', ch: 'Hc' }, R1: { id: 'Vc', ch: 'Vc' } },
    },
    codcar: {
      face: 'out', rel: true,
      Z1: { MT: 'W', H1: 'W', M1: 'W', R1: 'W', OT: 'E', H2: 'E', M2: 'E', R2: 'E' },
      Z2: { MT: 'E', H1: 'E', M1: 'E', R1: 'E', OT: 'W', H2: 'W', M2: 'W', R2: 'W' },
      P1: byRole(CODCAR), P2: byRole(CODCAR),
      X1: { W: { seeds: [[-3, -6.3], [-3, 6.3]] }, E: { seeds: [[-3, -6.3], [-3, 6.3]] } },
      X2: {},
      T1: {}, T2: {},
    },
    healerout: {
      face: 'in', rel: false,
      Z1: { MT: 'W', H1: 'W', H2: 'W', M1: 'W', R1: 'W', OT: 'SW', M2: 'SW', R2: 'SW' },
      Z2: { MT: 'T', M1: 'T', R1: 'T', OT: 'E', H1: 'E', H2: 'E', M2: 'E', R2: 'E' },
      P1: {
        MT: { pr: ['T', 'in'], pd: 90, tw: ['up', 'out'], ao: [-5, 4.5], sw: [6, 0] },
        H1: { pr: ['P', 'upout'], pd: 270, tw: ['down', 'in'], sd: [-3, 6.3], ao: [5, -4.5], sw: [-5, 1.6] },
        H2: { pr: ['P', 'downout'], pd: 180, tw: ['down', 'in'], sd: [3, 6.3], ao: [8.5, -13], sw: [-5, -1.6] },
        M1: { pr: ['T', 'downout'], pd: 225, tw: ['up', 'out'], ao: [-5, -4.5], sw: [6, -2] },
        R1: { pr: ['T', 'upout'], pd: 315, tw: ['up', 'out'], sd: [-3, -6.3], ao: [5, 4.5], sw: [6, 2] },
      },
      P2: {
        OT: { pr: ['T', 'in'], pd: 90, tw: ['up', 'out'], ao: [-5, 4.5] },
        H1: { pr: ['P', 'upout'], pd: 270, tw: ['down', 'in'], ao: [5, -4.5] },
        H2: { pr: ['P', 'downout'], pd: 180, tw: ['down', 'in'], ao: [8.5, -13] },
        M2: { pr: ['T', 'downout'], pd: 225, tw: ['up', 'out'], ao: [-5, -4.5] },
        R2: { pr: ['T', 'upout'], pd: 315, tw: ['up', 'out'], ao: [5, 4.5] },
      },
      X1: { W: { seeds: [[3, -6.3]] } }, X2: {},
      T1: { OT: { id: 'H1', sw: 'H1', wc: 'C' }, M2: { id: 'Vc', sw: 'Vc' }, R2: { id: 'Hc', sw: 'Hc' } },
      T2: { MT: { id: 'H1', wc: 'C', ch: 'H1' }, M1: { id: 'Vc', ch: 'Vc' }, R1: { id: 'Hc', ch: 'Hc' } },
    },
    idyll: {
      face: 'out', rel: true,
      Z1: { MT: 'W', H2: 'W', M1: 'W', M2: 'W', R1: 'W', R2: 'W', OT: 'NW', H1: 'NW' },
      Z2: { MT: 'T', H2: 'T', M1: 'T', OT: 'E', H1: 'E', M2: 'E', R1: 'E', R2: 'E' },
      P1: {
        MT: { pr: ['T', 'out'], pd: 247.5, tw: ['out', 'down'], ao: [-5, 4.5], sw: [6, 0] },
        H2: { pr: ['P', 'out'], pd: 292.5, tw: ['in', 'up'], sd: [3, 6.3], ao: [-5, -4.5], sw: [6, -1.6] },
        M1: { pr: ['T', 'down'], pd: 180, tw: ['out', 'down'], ao: [5, 4.5], sw: [6, 1.6] },
        M2: { pr: ['T', 'up'], pd: 0, tw: ['in', 'up'], sd: [-3, 6.3], ao: [5, -4.5], sw: [-5, 1.6] },
        R1: { pr: ['P', 'down'], pd: 202.5, tw: ['out', 'down'], sd: [-3, -6.3], ao: [8.5, 13], sw: [-5, 0] },
        R2: { pr: ['P', 'up'], pd: 337.5, tw: ['in', 'up'], sd: [3, -6.3], ao: [8.5, -13], sw: [-5, -1.6] },
      },
      P2: {
        OT: { pr: ['T', 'out'], pd: 247.5, tw: ['out', 'down'], ao: [-5, 4.5] },
        H1: { pr: ['T', 'down'], pd: 180, tw: ['out', 'down'], ao: [-5, -4.5] },
        M2: { pr: ['P', 'down'], pd: 202.5, tw: ['in', 'up'], ao: [5, 4.5] },
        R1: { pr: ['P', 'out'], pd: 292.5, tw: ['in', 'up'], ao: [8.5, 13] },
        R2: { pr: ['P', 'up'], pd: 337.5, tw: ['in', 'up'], ao: [8.5, -13] },
      },
      X1: {}, X2: { E: { stacks: ['up'] } },
      T1: { OT: { id: 'H1', sw: 'H1', wc: 'H1' }, H1: { id: 'Vc', sw: 'C' } },
      T2: { MT: { id: 'H2', wc: 'H1', ch: 'H2' }, H2: { id: 'Nc', ch: 'Nc' }, M1: { id: 'Sc', ch: 'Sc' } },
    },
  };
