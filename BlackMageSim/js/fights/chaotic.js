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
  // Whether the straight way from a to b stays on ok ground (`ends`: a and b themselves need not, as when stepping
  // off a spot that's just become unsafe).
  const segOk = (a, b, ok, ends) => {
    const n = Math.max(2, Math.ceil(dist(a, b) / 0.3));
    for (let k = ends ? 1 : 0; k <= (ends ? n - 1 : n); k++) if (!ok(add(a, mul(sub(b, a), k / n)))) return false;
    return true;
  };
  // A way from a to b over the floor `ok` allows (A* on a 1-yalm grid, then straightened): its corners, a first, b last.
  const NB = [[1, 0, 1], [-1, 0, 1], [0, 1, 1], [0, -1, 1], [1, 1, Math.SQRT2], [1, -1, Math.SQRT2], [-1, 1, Math.SQRT2], [-1, -1, Math.SQRT2]];
  function route(a, b, ok) {
    if (segOk(a, b, ok, true)) return [r2(a), r2(b)];
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
        if (d < bd && segOk(p, q, ok, true)) { bd = d; best = i * N + j; }
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
      while (j > i + 1 && !segOk(pts[i], pts[j], ok, true)) j--;
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

  // ---------- the pull ----------
  function plan(events, stratKey) {
    const st = STRATS[stratKey] || STRATS.raidplan;
    const P = { start: Object.assign({}, UP), prefs: [], hazards: [], checks: [], calls: [], marks: [], labels: new Map(), debuffs: [],
      hitbox: [{ t: 0, r: 23 }], face: [{ t: 0, deg: 180 }], looks: [], notes: [] };
    let id = 0;
    const hz = (o) => {
      const h = Object.assign({ id: ++id, react: 3 }, o);
      h.t = +h.t.toFixed(2);
      if (h.tell !== undefined) h.tell = +h.tell.toFixed(2);
      P.hazards.push(h);
      return h;
    };
    const pref = (t, spots) => P.prefs.push({ t: +t.toFixed(2), spots });
    const call = (t, text, o) => P.calls.push(Object.assign({ t: +t.toFixed(2), text, dur: 5 }, o));
    const debuff = (slot, key, name, hint, t0, t1) => P.debuffs.push({ slot, key, name, hint, t0: +t0.toFixed(2), t1: +t1.toFixed(2) });
    const label = (ev, text) => { if (ev) P.labels.set(ev, text); };
    const E = (name, t0, t1) => events.find(e => e.name === name && e.t >= t0 && e.t <= t1) || null;
    const EA = (name, t0 = 0, t1 = 9999) => events.filter(e => e.name === name && e.t >= t0 && e.t <= t1);
    const groups = (evs, gap) => {
      const out = [];
      for (const e of evs) { const g = out[out.length - 1]; if (g && e.t - g[g.length - 1].t <= gap) g.push(e); else out.push([e]); }
      return out;
    };
    const raid = (t, dmg, name, text, cast) => {
      hz({ t, tell: t - (cast || 5), raidwide: true, dmg, name });
      call(t - (cast || 5), text || 'Raidwide', { dur: 3 });
    };
    const prefRaw = (s, t) => {
      let p = P.start[s], bt = -Infinity;
      for (const e of P.prefs) if (e.t <= t && e.t >= bt && e.spots[s]) { bt = e.t; p = e.spots[s]; }
      return p;
    };
    const prefAt = (s, t) => { const p = prefRaw(s, t); return typeof p === 'function' ? p(t) : p; };
    // Hold spot s at `spot` from t0 to t1 (what the plan had for it in between set aside), then back to its plan.
    const override = (s, t0, t1, spot) => {
      const back = prefRaw(s, t1);
      for (const e of P.prefs) if (e.t > t0 && e.t < t1 && e.spots[s]) { e.spots = Object.assign({}, e.spots); delete e.spots[s]; }
      pref(t0, { [s]: spot });
      pref(t1, { [s]: back });
    };

    // ---------- the timeline ----------
    const blades = EA('Blade of Darkness'), deluges = EA('Deluge of Darkness'), floods = EA('Flood of Darkness');
    const ges = EA('Grim Embrace'), razing = groups(EA('Razing-volley Particle Beam'), 2.6).map(g => g.map(e => e.t));
    const tDel1 = deluges[0] ? deluges[0].t : 38.9, tDel2 = deluges[1] ? deluges[1].t : 197.9, tDel3 = deluges[2] ? deluges[2].t : 528.2;
    const tFl1 = floods[0] ? floods[0].t : 183.8, tFl2 = floods[1] ? floods[1].t : 512.1;
    P.arena = [{ t: 0, ...ROUND }, { t: tDel1, ...DIAMOND }, { t: tFl1, ...ROUND }, { t: tDel2, ...SPLIT }, { t: tFl2, ...ROUND }, { t: tDel3, ...DIAMOND }];
    P.boss = [{ t: 0, at: BOSS0 }, { t: tDel1 + 3, at: BOSS1 }, { t: tDel2 + 0.7, at: [0, 0] }, { t: tDel3 + 3, at: BOSS1 }];
    // The floor's look: the round arena, the diamond, the platforms and tiles.
    P.looks = [{ t: 0, show: ['a1'] }, { t: tDel1, show: ['a3'] }, { t: tFl1, show: ['a1'] }, { t: tDel2, show: ['a2'] }, { t: tFl2, show: ['a1'] }, { t: tDel3, show: ['a3'] }];
    deluges.forEach((ev, k) => { raid(ev.t, 0.45, 'Deluge of Darkness', k === 1 ? 'AoE: to the platforms and tiles' : 'AoE: the floor shrinks to the diamond', 8); label(ev, k === 1 ? 'Deluge of Darkness (raidwide: platforms and tiles)' : 'Deluge of Darkness (raidwide: the diamond)'); });
    floods.forEach(ev => { raid(ev.t, 0.45, 'Flood of Darkness', 'AoE: the round floor again', 7); label(ev, 'Flood of Darkness (raidwide: the round floor)'); });

    // ---------- the diamond phases ----------
    const BLADE_AT = { L: [14.5, 26], R: [-14.5, 26], C: [0, 6.5] };
    const blade = (ev, kind, boss, go) => {
      const t = ev.t;
      const shape = kind === 'L' ? { shape: 'cone', at: HAND.L, deg: 230, half: 75, r: 60, r0: 12 }
        : kind === 'R' ? { shape: 'cone', at: HAND.R, deg: 130, half: 75, r: 60, r0: 12 } : { shape: 'cone', at: boss, deg: 180, half: 90, r: 30 };
      hz(Object.assign({ t, tell: t - 7.7, dmg: 1.2, name: 'Blade of Darkness', aimed: true }, shape));
      pref(go ?? t - 7.2, clusterAt(BLADE_AT[kind], S, 1.2));
      call(t - 7.7, ({ L: 'Under her left hand (east)', R: 'Under her right hand (west)', C: 'Out (south)' })[kind], { alert: true, dur: 5 });
      label(ev, `Blade of Darkness (${({ L: 'left hand: east is safe', R: 'right hand: west is safe', C: 'out' })[kind]})`);
    };
    const KDIR = { L: 90, R: 270, C: 180 };
    const radial = (dir, ds, ls) => {
      const pts = [];
      for (const d of ds) for (const l of ls) pts.push(r2(add(add(MID, at(dir, d)), at(dir + 90, l))));
      return Object.fromEntries(S.map((s, i) => [s, pts[i]]));
    };
    const moved = (spots, by) => Object.fromEntries(Object.entries(spots).map(([s, p]) => { const v = sub(p, MID), d = len(v); return [s, r2(add(MID, mul(v, (d + by) / d)))]; }));
    // Death IV or Aero IV landing at t, shown from `tell`, the party gathered toward bearing `dir` from the middle.
    const deathAero = (t, kind, dir, tell, tGo) => {
      const go = tGo ?? tell + 0.2;
      const side = ({ 90: 'east', 270: 'west', 180: 'south' })[dir];
      if (kind === 'aero') {
        const k = radial(dir, [9.3, 9.9, 10.5, 11.1], [-0.45, 0.45]);
        hz({ t, tell, effect: 'knockback', at: MID, dist: 15, name: 'Aero IV' });
        hz({ t, tell, shape: 'circle', at: MID, r: 8, dmg: 1.0, name: 'Aero IV', aimed: true });
        pref(go, k);
        pref(t + 0.05, moved(k, 15));
        call(tell, `Knockback from the middle: ${side} of it, just outside the circle`, { alert: true, dur: 5 });
        return t + 0.6;
      }
      const far = radial(dir, [22.9, 23.6], [-1.8, -0.6, 0.6, 1.8]);
      hz({ t, tell, effect: 'pull', at: MID, dist: 15, name: 'Death IV (Vortex)' });
      hz({ t: t + 2, tell: t - 1, shape: 'circle', at: MID, r: 6, dmg: 1.0, name: 'Death IV', aimed: true });
      hz({ t: t + 4, tell: t + 2, shape: 'donut', at: MID, r0: 6, r1: 40, dmg: 1.0, name: 'Death IV', aimed: true });
      pref(go, far);
      pref(t + 0.05, moved(far, -15));
      pref(t + 2.05, clusterAt(add(MID, at(dir, 2.4)), S, 1.1));
      call(tell, `Draw-in: far out ${side} => out of the circle => in`, { alert: true, dur: 6 });
      return t + 4.1;
    };
    // Razing-volley Particle Beam: the four waves at ts; a cell safe from the first two, then one from the last two.
    const razingSet = (ts, prev, next, nextBy = 3.5) => {
      // (A pattern the party couldn't get through to what comes next is drawn again: the game's never leave the
      // only cell for the last lanes out of reach.)
      let A, Bq, l, m, best = null;
      for (let tries = 0; tries < 30 && (!best || best.cost >= 100); tries++) {
        A = pick(['SE', 'SW']); Bq = A === 'SE' ? 'SW' : 'SE';
        l = shuffle([0, 1, 2, 3, 4]); m = shuffle([0, 1, 2, 3, 4]);
        best = cellsFor(A, l, m, prev, next, nextBy);
      }
      const waves = [[A, l.slice(0, 2)], [Bq, m.slice(0, 2)], [A, l.slice(2)], [Bq, m.slice(2)]];
      waves.forEach(([edge, lanes], k) => lanes.forEach(i => hz({ t: ts[k], tell: ts[k] - (k < 2 ? 5 : 3.5), shape: 'line', at: CLOUD[edge][i], deg: edge === 'SE' ? 315 : 45,
        len: 45, w: 8, dmg: 1.2, name: 'Razing-volley Particle Beam', aimed: true })));
      if (!best) { P.notes.push(`Razing-volley at ${ts[0]}: no cells`); best = { a: [0, 12], b: [0, 12] }; }
      pref(ts[0] - 4.6, clusterAt(best.a, S, 1.4));
      pref(ts[1] + 0.05, clusterAt(best.b, S, 1.4));
      call(ts[0] - 5, 'Criss-cross: a safe cell, then the cell the first lanes hit', { alert: true, dur: 5 });
      return best.b;
    };
    const cellsFor = (A, l, m, prev, next, nextBy) => {
      const seHit = (A === 'SE' ? l : m).slice(0, 2), swHit = (A === 'SE' ? m : l).slice(0, 2);
      const mid = (i, j) => { const c = cellMid(i, j); return i + j >= 6 ? [c[0], 33] : c; };
      const c1 = [], c2 = [];
      for (let i = 0; i < 5; i++) for (let j = 0; j < 5; j++) {
        if (i + j > 6 || (i + j === 6 && i !== j)) continue;
        if (!seHit.includes(i) && !swHit.includes(j)) c1.push(mid(i, j));
        if (seHit.includes(i) && swHit.includes(j)) c2.push(mid(i, j));
      }
      let best = null;
      for (const a of c1) for (const b of c2) {
        if (dist(a, b) > 11.5) continue;
        const cost = dist(prev, a) * 0.6 + dist(a, b) + dist(b, next) * 0.6 + (dist(b, next) > 5.4 * nextBy - 1 ? 100 : 0);
        if (!best || cost < best.cost) best = { cost, a, b };
      }
      return best;
    };
    // Grim Embrace: every player's hand, four waves after the first cast; the target steps out of its own.
    const hands = [];
    const embrace = (g1, g2) => {
      const ord = shuffle(S);
      [52.6, 59.7, 66.7, 108.6].forEach((d, k) => {
        for (const s of ord.slice(2 * k, 2 * k + 2)) {
          const back = Math.random() < 0.5, t = +(g1 + d).toFixed(2);
          hands.push({ t, s, back });
          debuff(s, 'deadlyEmbrace', 'Deadly Embrace', `a hand ${back ? 'behind' : 'in front of'} you: step ${back ? 'forward' : 'back'} out of it`, back ? g2 : g1, t);
        }
      });
    };
    const flare = (tIcon, tGo, tHit, who) => {
      const side = pick([1, -1]), v = [24.6 * side, 23.72], others = S.filter(s => s !== who);
      pref(tGo, Object.assign(clusterAt([-side * 9, 16], others, 1.3), { [who]: v }));
      hz({ t: tHit, tell: tIcon, effect: 'bait', shape: 'circle', r: 25, falloff: 25, from: 'target', targets: [who], snap: 0.3, dmg: 1.0, own: 0.5, name: 'Flare' });
      call(tIcon, `Flare on YOU: out to the ${side > 0 ? 'east' : 'west'} corner`, { slot: who, alert: true, dur: 6 });
      for (const s of others) call(tIcon, `Flare on ${who}: away from it (${side > 0 ? 'west' : 'east'})`, { slot: s, dur: 5 });
    };
    const kindOf = () => pick(['death', 'aero']);
    const KNAME = { death: 'Death IV (draw-in)', aero: 'Aero IV (knockback)' };

    // ===== The opening and the first diamond (Death IV/Aero IV first) =====
    if (blades[0]) blade(blades[0], pick(['L', 'R', 'C']), BOSS0);
    if (blades[1]) blade(blades[1], pick(['L', 'R', 'C']), BOSS0);
    pref((blades[1] ? blades[1].t : 26.5) + 0.2, UP);
    if (ges[0]) {
      embrace(ges[0].t, (ges[1] || ges[0]).t);
      label(ges[0], 'Grim Embrace (hands in front: the first tethers)');
      if (ges[1]) label(ges[1], 'Grim Embrace (hands behind: the second tethers)');
      call(ges[0].t - 5, 'Hand debuffs: the hand spawns in front of or behind you', { dur: 4 });
    }
    const act1 = razing.filter(g => g[0] < tFl1), act3 = razing.filter(g => g[0] > tDel3);
    const k1 = kindOf(), k2 = kindOf(), bk3 = pick(['L', 'R', 'C']);
    const tDA1 = (act1[0] ? act1[0][3] : 79) + 3.2;                // Death IV/Aero IV: 3.2 s after the criss-cross ends
    if (act1[0]) {
      razingSet(act1[0], [0, 14], k1 === 'death' ? [0, 1] : [0, 13.5], 3.1);
      deathAero(+(tDA1).toFixed(2), k1, 180, act1[0][3] - 2.6, act1[0][3] + 0.05);
      call(act1[0][3] - 2.6, KNAME[k1], { dur: 3 });
    }
    const st1 = E('Endeath IV/Enaero IV', 80, 120);
    if (st1) { label(st1, k2 === 'death' ? 'Endeath IV (a draw-in after the next Blade)' : 'Enaero IV (a knockback after the next Blade)'); call(st1.t, k2 === 'death' ? 'Stored: draw-in after the next Blade' : 'Stored: knockback after the next Blade', { dur: 4 }); }
    pref(tDA1 + 4.5, UP);
    const rapid = events.find(e => e.name === 'Rapid-sequence Particle Beam' && e.kind === 'cast' && e.t < tFl1);
    if (rapid) {
      const hits = EA('Rapid-sequence Particle Beam', rapid.t, rapid.t + 10).filter(e => e.kind !== 'cast').map(e => e.t);
      const mine = hands.filter(h => h.t >= hits[0] - 1.5 && h.t <= hits[hits.length - 1] + 0.5);
      const fwd = mine.filter(h => !h.back).map(h => h.s), back = mine.filter(h => h.back).map(h => h.s);
      const base = ['MT', 'OT', 'M1', 'M2', 'R1', 'R2', 'H2', 'H1'];
      const order = [...fwd, ...base.filter(s => !fwd.includes(s) && !back.includes(s)), ...back];
      pref(rapid.t - 6.5, Object.fromEntries(order.map((s, k) => [s, [0, +(18.6 - 1.35 * k).toFixed(2)]])));
      hits.forEach((t, k) => hz({ t, tell: k ? hits[k - 1] : rapid.t - 7, effect: 'share', shape: 'line', from: 'boss', aim: 'target', targets: ['H1'], len: 50, w: 6, min: 8, max: 8, dmg: 0.35, name: 'Rapid-sequence Particle Beam' }));
      call(rapid.t - 7, 'Wild charge x4 on H1: line up, tanks in front', { alert: true, dur: 6 });
      label(rapid, 'Rapid-sequence Particle Beam (four wild charges on H1)');
      pref(hits[hits.length - 1] + 0.1, UP);
    }
    if (act1[1] && blades[2]) {
      razingSet(act1[1], [0, 14], BLADE_AT[bk3], blades[2].t - 0.4 - act1[1][3]);
      blade(blades[2], bk3, BOSS1, act1[1][3] + 0.05);
      const v = E('Vortex/Aero IV', blades[2].t, blades[2].t + 5);
      const tR = v ? v.t : blades[2].t + 2.2;
      deathAero(tR, k2, KDIR[bk3], blades[2].t - 0.1);
      label(v, KNAME[k2] + ' (stored)');
      pref(tR + (k2 === 'death' ? 4.2 : 0.7), UP);
    }
    const fl1 = events.find(e => e.name === 'Flare' && e.kind === 'cast' && e.t < tFl1);
    if (fl1) {
      const hit = E('Flare', fl1.t + 1, fl1.t + 15), tH = hit ? hit.t : fl1.t + 9;
      flare(fl1.t + 1, fl1.t + 1.1, tH, pick(S));
      label(fl1, 'Flare (one of ours: away from everyone)');
      pref(tH + 0.1, UP);
    }

    // ===== The platforms and the tiles =====
    const loom = E('Looming Chaos', 300, 480), tSwap = loom ? loom.t : 385.1;
    const cornerT = pick(['NE', 'SE']);
    const zoneOf = (s, t) => { const z = (t < tSwap ? st.Z1 : st.Z2)[s]; return z === 'T' ? cornerT : z; };
    const isPlat = (z) => z === 'W' || z === 'E';
    const specOf = (s, t) => (t < tSwap ? st.P1 : st.P2)[s];
    const tileOf = (s, t) => (t < tSwap ? st.T1 : st.T2)[s];
    const sideSlots = (side, t) => S.filter(s => zoneOf(s, t) === side);
    const tileGroups = (t) => { const g = {}; for (const s of S) { const z = zoneOf(s, t); if (!isPlat(z)) (g[z] = g[z] || []).push(s); } return g; };
    const extra = (t) => (t < tSwap ? st.X1 : st.X2) || {};
    const aoOf = (sp, side) => (Array.isArray(sp.ao) ? sp.ao : sp.ao[side]);
    const FACE = { north: { W: 0, E: 0 }, out: { W: 270, E: 90 }, in: { W: 90, E: 270 } }[st.face];
    const obstacles = [];
    const clearAt = (p, t0, t1) => obstacles.every(o => o.t1 < t0 || o.t0 > t1 || !o.test(p));
    const okFor = (s, t, t1, m) => {
      const z = zoneOf(s, t), mm = m ?? 0.8;
      const reg = isPlat(z) ? (p) => onSide(z, p, mm) : (p) => onTiles(p, mm);
      return (p) => reg(p) && clearAt(p, t, t1 ?? t + 2);
    };
    // Walk spot s to `dest` from second t over its own floor, round the void and the voidzones.
    const moveTo = (s, t, dest, t1) => {
      const from = prefAt(s, t), ok = okFor(s, t, t1 ?? t + 3, 0.6);
      if (!ok(dest)) P.notes.push(`${s} ${t.toFixed(1)}: [${dest}] isn't clear`);
      if (segOk(from, dest, ok, true)) { pref(t, { [s]: r2(dest) }); return t + dist(from, dest) / 6; }
      const fn = along(route(from, dest, ok), t, 5.6);
      pref(t, { [s]: fn });
      return fn.arrive;
    };
    const moveAll = (t, spots, t1) => { let last = t; for (const [s, p] of Object.entries(spots)) last = Math.max(last, moveTo(s, t, p, t1)); return last; };
    // Spots for several, each the nearest ok point to its want, at least `sep` from the others.
    const placeAll = (t, wants, extraOk, sep = 1.0, t1) => {
      const out = {};
      for (const [s, w] of Object.entries(wants)) {
        const ok0 = okFor(s, t, t1);
        out[s] = findSpot(w, (p) => ok0(p) && (!extraOk || extraOk(s, p)) && Object.values(out).every(q => dist(q, p) >= sep));
      }
      return out;
    };
    const idleOf = (s, t) => {
      const z = zoneOf(s, t);
      if (isPlat(z)) { const sp = specOf(s, t); return platDir(z, sp.pr[1], sp.pr[0] === 'T' ? 3.8 : 5.6, st.rel); }
      return cellAt(z, tileOf(s, t).id);
    };
    const idle = (t, slots, t1) => placeAll(t, Object.fromEntries((slots || S).map(s => [s, idleOf(s, t)])), null, 1.0, t1);
    const backToIdle = (t, slots, t1) => moveAll(t, idle(t, slots, t1), t1);

    const evap = E('Evaporation', tDel2, tFl2), tEvap = evap ? evap.t : tFl2 - 4.8;
    if (deluges[1]) {
      pref(tFl1 + 0.4, Object.fromEntries(S.map(s => [s, idleOf(s, tDel2)])));
      for (const s of S) {
        const z1 = zoneOf(s, tDel2), z2 = zoneOf(s, tSwap + 0.1);
        call(tFl1 + 0.4, isPlat(z1) ? `To the ${z1 === 'W' ? 'west' : 'east'} platform` : `To the ${z1} tiles`, { slot: s, alert: true, dur: 6 });
        debuff(s, isPlat(z1) ? 'outerDarkness' : 'innerDarkness', isPlat(z1) ? 'Outer Darkness' : 'Inner Darkness', isPlat(z1) ? 'on a platform: the Stygian Shadow\'s side' : 'on the tiles: the boss\'s side', tDel2, tSwap);
        debuff(s, isPlat(z2) ? 'outerDarkness' : 'innerDarkness', isPlat(z2) ? 'Outer Darkness' : 'Inner Darkness', isPlat(z2) ? 'on a platform: the Stygian Shadow\'s side' : 'on the tiles: the boss\'s side', tSwap, tFl2);
      }
      for (const side of ['W', 'E']) P.marks.push({ kind: 'lit', shape: 'circle', at: ADD[side], r: 2.6, t0: tDel2 + 4.2, t1: tEvap, fill: 'rgba(150,60,220,0.5)' });
    }
    const dds = EA('Dark Dominion', tDel2, tFl2);
    dds.forEach(ev => { raid(ev.t, 0.4, 'Dark Dominion', 'AoE: then the outer ring burns', 5); label(ev, 'Dark Dominion (raidwide; the outer ring burns)'); });
    const burnRing = (t0, t1) => {
      obstacles.push({ t0, t1, test: (p) => len(p) > 33.3 });
      hz({ t: t0, tell: t0 - 2, shape: 'donut', at: [0, 0], r0: 34, r1: 40, dmg: 0.3, lasts: +(t1 - t0).toFixed(2), tick: 1, tickDmg: 0.6, aimed: true, quiet: true, name: 'The outer ring (burning)' });
    };

    // --- The Third Art of Darkness: each Shadow's three mechanics ---
    const NAMES = { L: 'left cleave', R: 'right cleave', stack: 'pair stacks', spread: 'proteans' };
    const proteanSpots = (side, ours, t, keepOff = 0) => {
      const A = ADD[side], bs = ours.map(s => platBrg(side, specOf(s, t).pd, st.rel));
      const place = (s, b) => {
        const ok = okFor(s, t, t + 1, 0.9);
        let best = null;
        for (let d = 4.6; d <= 11.5; d += 0.1) { const p = add(A, at(b, d)); if (ok(p) && Math.abs(p[0]) >= keepOff) best = p; else if (best) break; }
        return best || add(A, at(b, 4.6));
      };
      let pts = [];
      for (let it = 0; it < 200; it++) {
        pts = ours.map((s, i) => place(s, bs[i]));
        let bad = false;
        for (let i = 0; i < ours.length; i++) for (let j = 0; j < ours.length; j++) {
          if (i === j) continue;
          const u = at(bs[i], 1), v = sub(pts[j], A), al = v[0] * u[0] + v[1] * u[1], pe = Math.abs(v[0] * u[1] - v[1] * u[0]);
          if (al > -0.5 && al < 22.5 && pe < 3.4) { const sg = Math.sign(deg360(bs[j] - bs[i] + 180) - 180) || 1; bs[j] = deg360(bs[j] + sg * 1.5); bad = true; }
        }
        if (!bad) break;
        if (it === 199) P.notes.push(`proteans ${side} at ${t}: crowded`);
      }
      return Object.fromEntries(ours.map((s, i) => [s, r2(pts[i])]));
    };
    const stacks = (side, ours, t, tell) => {
      const pairs = [];
      for (const s of ours) {
        const [rl, dir] = specOf(s, t).pr;
        let pr = pairs.find(x => x.dir === dir);
        if (!pr) pairs.push(pr = { dir });
        if (rl === 'T') pr.target = s; else pr.partner = s;
      }
      const spots = {};
      for (const pr of pairs) {
        const c = platDir(side, pr.dir, 3.8, st.rel);
        if (pr.target) spots[pr.target] = r2(c);
        if (pr.partner) spots[pr.partner] = r2(platDir(side, pr.dir, 5.6, st.rel));
        if (pr.target) hz({ t, tell, effect: 'share', shape: 'circle', r: 3, from: 'target', targets: [pr.target], min: pr.partner ? 2 : 1, max: 2, dmg: 0.4, name: 'Multi-pronged Particle Beam' });
        else hz({ t, tell, effect: 'share', shape: 'circle', r: 3, at: r2(c), min: 1, max: 2, dmg: 0.4, name: 'Multi-pronged Particle Beam (another player\'s)' });
      }
      return spots;
    };
    const towersOn = (side, ours, tFrom, tTow) => {
      const dirs = pick([['in', 'out'], ['up', 'down']]), soak = { in: [], out: [], up: [], down: [] };
      for (const s of ours) { const tw = specOf(s, tTow).tw; soak[dirs.includes(tw[0]) ? tw[0] : tw[1]].push(s); }
      const spots = {};
      for (const d of dirs) {
        const c = r2(plat(side, TOWER[d][0], TOWER[d][1], st.rel)), who = soak[d];
        if (who.length) hz({ t: tTow, tell: tFrom - 2, effect: 'tower', shape: 'circle', at: c, r: 3, soak: [who.length, who.length], only: who, dmg: 0.35, fail: 0.9, name: 'Particle Beam (tower)' });
        else P.marks.push({ kind: 'lit', shape: 'circle', at: c, r: 3, t0: tFrom - 2, t1: tTow, fill: 'rgba(90,160,255,0.2)' });
        who.forEach((s, i) => { spots[s] = r2(add(c, i ? at(i * 120 + 60, 1.2) : [0, 0])); });
        const where = d === 'in' ? 'the inner one' : d === 'out' ? 'the outer one' : (c[1] > 0 ? 'the north one' : 'the south one');
        for (const s of who) call(tFrom, `Platform tower: ${where}`, { slot: s, dur: 4 });
      }
      moveAll(tFrom, spots);
    };
    const thirdArt = (ev, tTow, keepOff = 0) => {
      const tA = ev.t, times = [tA + 0.55, tA + 3.55, tA + 6.55];
      const text = [];
      let last = tA + 7;
      // Tile spots in reach of a Shadow's cleaves step clear of them meanwhile.
      const near = S.filter(s => !isPlat(zoneOf(s, tA)) && ['W', 'E'].some(sd => dist(prefAt(s, tA - 8.5), ADD[sd]) < 16.8));
      if (near.length) moveAll(tA - 8.5, placeAll(tA - 8.5, Object.fromEntries(near.map(s => [s, prefAt(s, tA - 8.5)])), (s, p) => ['W', 'E'].every(sd => dist(p, ADD[sd]) > 16.8), 1.0, tA + 7.2), tA + 7.2);
      for (const side of ['W', 'E']) {
        const ours = sideSlots(side, tA);
        const kinds = shuffle([pick(['L', 'R']), pick(['L', 'R']), pick(['stack', 'spread'])]);
        if (!ours.length) {
          // The other alliance's Shadow: its cleaves still land (its proteans and stacks are on its own players).
          let tell = tA - 9;
          kinds.forEach((k, j) => {
            if (k !== 'L' && k !== 'R') return;
            const tk = +times[j].toFixed(2);
            hz({ t: tk, tell, shape: 'cone', at: ADD[side], deg: deg360(FACE[side] + (k === 'L' ? -90 : 90)), half: 90, r: 15, dmg: 1.2, name: `The Art of Darkness (${NAMES[k]})`, aimed: true });
            tell = tk;
          });
          continue;
        }
        text.push(`${side === 'W' ? 'west' : 'east'}: ${kinds.map(k => NAMES[k]).join(' > ')}`);
        for (const s of ours) call(tA - 9, `Shadow: ${kinds.map(k => NAMES[k]).join(' => ')}`, { slot: s, alert: true, dur: 7 });
        let from = tA - 8, tell = tA - 9;
        kinds.forEach((k, j) => {
          const tk = +(times[j] + (k === 'stack' || k === 'spread' ? 0.45 : 0)).toFixed(2);
          let spots;
          if (k === 'L' || k === 'R') {
            const cone = { shape: 'cone', at: ADD[side], deg: deg360(FACE[side] + (k === 'L' ? -90 : 90)), half: 90, r: 15 };
            hz(Object.assign({ t: tk, tell, dmg: 1.2, name: `The Art of Darkness (${NAMES[k]})`, aimed: true }, cone));
            spots = placeAll(from, Object.fromEntries(ours.map(s => [s, prefAt(s, from)])), (s, p) => !inside(cone, p, 1.5) && dist(p, ADD[side]) > 2.5 && Math.abs(p[0]) >= keepOff, 1.0, tk + 0.5);
          } else if (k === 'stack') spots = stacks(side, ours, tk, tell);
          else {
            spots = proteanSpots(side, ours, tk, keepOff);
            hz({ t: tk, tell, effect: 'bait', shape: 'line', from: ADD[side], aim: 'target', targets: ours.slice(), len: 22, w: 5, snap: 0.3, dmg: 1.0, own: 0.3, name: 'Hyper-focused Particle Beam' });
          }
          moveAll(from, spots, tk + 0.5);
          from = tk + 0.1; tell = tk;
          last = Math.max(last, tk);
        });
        if (tTow) towersOn(side, ours, from, tTow);
      }
      label(ev, `The Third Art of Darkness (${text.join('; ') || 'not on our platforms'})`);
      return last;
    };
    const tileTowers = (tFrom, tTow, tLate) => {
      for (const [c, g] of Object.entries(tileGroups(tTow))) {
        const [sx, sy] = CORNER[c], horiz = Math.random() < 0.5, near = pick([12, 18]), far = near === 12 ? 21 : 9;
        const P2 = horiz ? [near * sx, 15 * sy] : [15 * sx, near * sy], P1 = horiz ? [far * sx, 15 * sy] : [15 * sx, far * sy];
        const ord = g.slice().sort((a, b) => (isTank(b) ? 1 : 0) - (isTank(a) ? 1 : 0));
        const two = ord.slice(0, 2), one = ord.slice(2, 3);
        hz({ t: tTow, tell: tFrom - 0.5, effect: 'tower', shape: 'circle', at: P2, r: 3, soak: [two.length, two.length], only: two, dmg: 0.35, fail: 0.9, name: 'Particle Beam (two-player tower)' });
        if (one.length) hz({ t: tTow, tell: tFrom - 0.5, effect: 'tower', shape: 'circle', at: P1, r: 3, soak: [1, 1], only: one, dmg: 0.4, fail: 0.9, name: 'Particle Beam (one-player tower)' });
        else P.marks.push({ kind: 'lit', shape: 'circle', at: P1, r: 3, t0: tFrom - 0.5, t1: tTow, fill: 'rgba(90,160,255,0.2)' });
        const spots = {};
        two.forEach((s, i) => { spots[s] = r2(add(P2, horiz ? [i ? 0.9 : -0.9, 0] : [0, i ? 0.9 : -0.9])); });
        one.forEach(s => { spots[s] = P1; });
        for (const s of two) call(tFrom, 'Tile tower: the two-player one', { slot: s, dur: 4 });
        for (const s of one) call(tFrom, 'Tile tower: the one-player one', { slot: s, dur: 4 });
        const early = {}, late = {};
        for (const [s, p] of Object.entries(spots)) (tLate && ['W', 'E'].some(sd => dist(p, ADD[sd]) < 16.8) ? late : early)[s] = p;
        moveAll(tFrom, early);
        if (Object.keys(late).length) moveAll(tLate, late);
      }
    };

    // --- Ghastly Gloom: the cross or the donut ---
    const ghastly = (ev) => {
      const t = ev.t, kind = pick(['cross', 'donut']), t0 = t - 8;
      const shape = kind === 'cross' ? { shape: 'cross', at: [0, 0], deg: 0, len: 40, w: 30 } : { shape: 'donut', at: [0, 0], r0: 21, r1: 40 };
      hz(Object.assign({ t, tell: t - 8.5, dmg: 1.3, name: 'Ghastly Gloom', aimed: true }, shape));
      label(ev, `Ghastly Gloom (${kind === 'cross' ? 'cross: the corners' : 'donut: in'})`);
      call(t - 8.5, kind === 'cross' ? 'Corners: the tiles\' outer corners, the ring\'s corners' : 'In: the inner tiles, the platforms\' inner edge', { alert: true, dur: 6 });
      const spots = {};
      for (const s of S) {
        const z = zoneOf(s, t), cur = prefAt(s, t0), ok0 = okFor(s, t0, t + 0.5, 0.6);
        const sep = (p) => Object.values(spots).every(q => dist(q, p) >= 1.05);
        let want, ok;
        if (isPlat(z)) {
          const sx = z === 'W' ? -1 : 1, sy = cur[1] >= 0 ? 1 : -1;
          if (kind === 'cross') { want = [27.5 * sx, 23.5 * sy]; ok = (p) => ok0(p) && !inside(shape, p, 1.4) && sep(p); }
          else { want = [19.75 * sx, Math.max(-3, Math.min(3, cur[1]))]; ok = (p) => ok0(p) && !inside(shape, p, 0.45) && sep(p); }
        } else {
          const [sx, sy] = CORNER[z];
          if (kind === 'cross') {
            const opts = [[17, 20.6], [20.6, 17], [17, 17]].map(q => [q[0] * sx, q[1] * sy]);
            want = opts.sort((a, b) => dist(a, cur) - dist(b, cur)).find(q => sep(q)) || opts[0];
          } else want = len(cur) < 18.5 ? cur : [11 * sx, 14.5 * sy];
          ok = (p) => ok0(p) && !inside(shape, p, 1.4) && sep(p);
        }
        spots[s] = findSpot(want, ok, 30);
      }
      moveAll(t0, spots, t + 0.5);
      return t + 0.1;
    };

    // --- Curse of Darkness: the lasers (placed once every spot is: see the end) ---
    const curses = EA('Curse of Darkness', tDel2, tFl2), laserEvs = EA('Dark-energy Particle Beam', tDel2, tFl2);
    curses.forEach(ev => { raid(ev.t, 0.35, 'Curse of Darkness', 'AoE: lasers on everyone, later', 3); label(ev, 'Curse of Darkness (raidwide; a laser on each player as the curse runs out)'); });
    const laserPlan = [];
    {
      const lord = shuffle(S), counts = [1, 2, 1, 1, 2, 1];
      let li = 0;
      laserEvs.forEach((ev, k) => {
        const who = [];
        for (let j = 0; j < counts[k % counts.length]; j++) who.push(lord[li++ % 8]);
        const c = curses.filter(e => e.t < ev.t).pop();
        laserPlan.push({ t: ev.t, who, curse: c ? c.t : ev.t - 7 });
        label(ev, `Dark-energy Particle Beam (lasers: ${who.join(', ')})`);
      });
    }

    // --- Chaos-condensed (wild charges) or Diffusive-force (spreads) ---
    const chaosDiff = (ev, seedsUntil, notBefore) => {
      const t = ev.t, kind = pick(['chaos', 'diffusive']), t0 = Math.max(t - 7.5, notBefore || 0);
      label(ev, kind === 'chaos' ? 'Chaos-condensed Particle Beam (wild charges on the tanks)' : 'Diffusive-force Particle Beam (spreads: tiles, then platforms)');
      call(t0, kind === 'chaos' ? 'Wild charges: line up behind your tank' : 'Spread: the tiles first (7), then the platforms (5)', { alert: true, dur: 6 });
      if (kind === 'chaos') {
        const tH = t + 0.8;
        for (const side of ['W', 'E']) {
          const ours = sideSlots(side, t);
          if (!ours.length) continue;
          const tank = ours.find(isTank), rest = ours.filter(s => s !== tank), front = plat(side, -5.5, 0);
          const spots = tank ? { [tank]: r2(front) } : {};
          rest.forEach((s, k) => { spots[s] = r2(plat(side, -2.6 + 2.2 * k, k % 2 ? 0.5 : -0.5)); });
          if (tank) hz({ t: tH, tell: t0, effect: 'share', shape: 'line', from: 'boss', aim: 'target', targets: [tank], len: 50, w: 6, min: ours.length, dmg: 0.4, name: 'Chaos-condensed Particle Beam' });
          else hz({ t: tH, tell: t0, effect: 'share', shape: 'line', at: [0, 0], deg: brg(front), len: 50, w: 6, min: ours.length, dmg: 0.4, name: 'Chaos-condensed Particle Beam (another tank\'s)' });
          moveAll(t0, spots, tH + 0.5);
        }
        for (const [c, g] of Object.entries(tileGroups(t))) {
          const tank = g.find(isTank);
          if (!tank) continue;
          const T0 = cellAt(c, tileOf(tank, t).wc), u = mul(T0, 1 / len(T0)), spots = { [tank]: r2(T0) };
          g.filter(s => s !== tank).forEach((s, k) => {
            const want = add(T0, mul(u, 3.4 + 2.2 * k));
            spots[s] = findSpot(want, (p) => onTiles(p, 0.8) && Math.abs(p[0] * u[1] - p[1] * u[0]) < 1.6 && p[0] * u[0] + p[1] * u[1] > len(T0) + 1
              && Object.values(spots).every(q => dist(q, p) >= 1.0), 10);
          });
          hz({ t: tH, tell: t0, effect: 'share', shape: 'line', from: 'boss', aim: 'target', targets: [tank], len: 50, w: 6, min: g.length, dmg: 0.4, name: 'Chaos-condensed Particle Beam' });
          moveAll(t0, spots, tH + 0.5);
        }
        return tH + 0.1;
      }
      const t1 = t + 0.8, t2 = t + 2.4, tiles = S.filter(s => !isPlat(zoneOf(s, t))), plats = S.filter(s => isPlat(zoneOf(s, t)));
      if (tiles.length) {
        hz({ t: t1, tell: t0, effect: 'bait', shape: 'circle', r: 7, from: 'target', targets: tiles, snap: 0.3, dmg: 0.9, own: 0.3, name: 'Diffusive-force Particle Beam' });
        moveAll(t0, placeAll(t0, Object.fromEntries(tiles.map(s => [s, idleOf(s, t)])), null, 7.8, t1 + 0.3), t1 + 0.3);
      }
      if (plats.length) {
        hz({ t: t2, tell: t0, effect: 'bait', shape: 'circle', r: 5, from: 'target', targets: plats, snap: 0.3, dmg: 0.9, own: 0.3, name: 'Diffusive-force Particle Beam' });
        const spots = placeAll(t2 - 0.2, Object.fromEntries(plats.map(s => { const z = zoneOf(s, t), a = aoOf(specOf(s, t), z); return [s, plat(z, a[0], a[1], st.rel)]; })), null, 5.8, t2 + 0.3);
        for (const [s, q] of Object.entries(spots)) {
          const early = !(seedsUntil && seedsUntil > t0) || okFor(s, t0, t2)(q);
          moveTo(s, early ? t0 : seedsUntil + 0.05, q, t2 + 0.3);
        }
      }
      return t2 + 0.1;
    };

    // --- Phaser: three cones from each platform's outer end ---
    const phaser = (ev) => {
      const hits = EA('Phaser', ev.t, ev.t + 6).map(e => e.t), h1 = hits[0] ?? ev.t + 2, h2 = hits[1] ?? ev.t + 3.5;
      const text = [];
      for (const side of ['W', 'E']) {
        const ours = sideSlots(side, ev.t);
        if (!ours.length) continue;
        const O = side === 'W' ? [-40, 0] : [40, 0], axis = side === 'W' ? 90 : 270, core = Math.random() < 0.5;
        const mid = [{ shape: 'cone', at: O, deg: axis, half: 30, r: 23 }], sides = [-60, 60].map(d => ({ shape: 'cone', at: O, deg: deg360(axis + d), half: 30, r: 23 }));
        const w1 = core ? mid : sides, w2 = core ? sides : mid;
        w1.forEach(c => hz(Object.assign({ t: h1, tell: ev.t - 5, dmg: 1.2, name: 'Phaser', aimed: true }, c)));
        w2.forEach(c => hz(Object.assign({ t: h2, tell: h1, dmg: 1.2, name: 'Phaser', aimed: true }, c)));
        const corner = (s, t) => plat(side, 8, prefAt(s, t)[1] >= 0 ? 6 : -6, false), centre = () => plat(side, 4, 0, false);
        const s1 = placeAll(ev.t - 5, Object.fromEntries(ours.map(s => [s, core ? corner(s, ev.t - 5) : centre()])), (s, p) => w1.every(c => !inside(c, p, 1.4)), 1.0, h1 + 0.2);
        moveAll(ev.t - 5, s1, h1 + 0.2);
        const s2 = placeAll(h1 + 0.05, Object.fromEntries(ours.map(s => [s, core ? centre() : corner(s, h1)])), (s, p) => w2.every(c => !inside(c, p, 1.4)), 1.0, h2 + 0.2);
        moveAll(h1 + 0.05, s2, h2 + 0.2);
        text.push(`${side === 'W' ? 'west' : 'east'}: ${core ? 'middle, then sides' : 'sides, then middle'}`);
        for (const s of ours) call(ev.t - 5, core ? 'Phaser: corners, then the middle' : 'Phaser: the middle, then the corners', { slot: s, alert: true, dur: 5 });
      }
      label(ev, `Phaser (${text.join('; ') || 'not on our platforms'})`);
      return h2 + 0.05;
    };

    // ===== The platforms and tiles, in order =====
    const pcs = EA('Particle Concentration', tDel2, tFl2), pbs = EA('Particle Beam', tDel2, tFl2), tas = EA('the Third Art of Darkness', tDel2, tFl2);
    const ggs = EA('Ghastly Gloom', tDel2, tFl2), cds = EA('Chaos-condensed Particle Beam/Diffusive-force Particle Beam', tDel2, tFl2);
    const phs = EA('Core-lateral Phaser/Lateral-core Phaser', tDel2, tFl2);
    if (deluges[1] && tas[0] && pbs[0]) {
      // The first Third Art, with the towers after it (and the tiles' towers).
      burnRing(dds[0] ? dds[0].t + 1.1 : tas[0].t - 12, pbs[0].t + 3);
      label(pcs[0], 'Particle Concentration (towers: three-player on the platforms, two- and one-player on the tiles)');
      label(pbs[0], 'Particle Beam (the towers)');
      const tiles1 = S.filter(s => !isPlat(zoneOf(s, tas[0].t)));
      thirdArt(tas[0], pbs[0].t);
      if (tiles1.length) tileTowers(pcs[0] ? pcs[0].t + 0.6 : tas[0].t, pbs[0].t, tas[0].t + 7.1);
      backToIdle(pbs[0].t + 0.1);
    }
    if (ggs[0]) { const t = ghastly(ggs[0]); backToIdle(t); }
    // Evil Seed: the planters drop their seeds where the strat says; the seeds stay till the next wild charges.
    const es = events.find(e => e.name === 'Evil Seed' && e.t > tDel2 && e.t < tFl2), br = E('Evil Seed (brambles drop)', tDel2, tFl2);
    const seedsUntil = cds[0] ? cds[0].t : (br ? br.t + 47 : 0);
    const planters = [];
    if (es && br) {
      const tIcon = es.t - 7, tLock = br.t - 5, tDrop = br.t;
      const seeds = [];
      for (const side of ['W', 'E']) {
        for (const s of sideSlots(side, tLock)) {
          const sd = specOf(s, tLock).sd;
          if (!sd) continue;
          const p = r2(plat(side, sd[0], sd[1], st.rel));
          planters.push({ s, side, p });
          seeds.push(p);
          moveTo(s, tIcon + 0.3, p, tLock);
          call(tIcon, 'Seed on YOU: drop it on your spot, then away', { slot: s, alert: true, dur: 6 });
          hz({ t: tDrop, tell: tLock - 1, shape: 'circle', r: 5, from: 'target', targets: [s], snap: 5, dmg: 0.9, name: 'Evil Seed', aimed: true, lasts: +(seedsUntil - tDrop).toFixed(2), tick: 1, tickDmg: 0.6 });
        }
        if (sideSlots(side, tLock).length) for (const sd of ((extra(tLock)[side] || {}).seeds || [])) {
          const p = r2(plat(side, sd[0], sd[1], st.rel));
          seeds.push(p);
          hz({ t: tDrop, tell: tLock, shape: 'circle', r: 5, at: p, dmg: 0.9, name: 'Evil Seed (another player\'s)', aimed: true, lasts: +(seedsUntil - tDrop).toFixed(2), tick: 1, tickDmg: 0.6 });
        }
      }
      for (const p of seeds) obstacles.push({ t0: tLock + 0.05, t1: seedsUntil, seed: true, test: (q) => dist(q, p) < 5.7 });
      label(es, 'Evil Seed (seeds on four of each platform)');
      label(br, 'Evil Seed (the seeds drop; voidzones)');
      // Everyone off where the seeds go (the platforms' middle line stays clear).
      backToIdle(tLock + 0.05, null, seedsUntil);
    }
    if (ggs[1]) { const t = ghastly(ggs[1]); backToIdle(t, null, seedsUntil); }
    // Thorny Vine: each seed tethers its planter; 25 yalms breaks it (the planters run out along the ring).
    const tv = E('Thorny Vine', tDel2, tFl2);
    if (tv && planters.length) {
      const tTeth = tv.t + 3, tChk = tv.t + 15;
      const far = {};
      for (const { s, side, p } of planters) {
        const want = [side === 'W' ? -30.5 : 30.5, p[1] > 0 ? -21 : 21];
        far[s] = findSpot(want, (q) => okFor(s, tTeth, tChk)(q) && dist(q, p) >= 26.2 && Object.values(far).every(o => dist(o, q) >= 1.5));
        moveTo(s, tTeth, far[s], tChk);
        hz({ t: tChk, tell: tTeth, targets: [s], tether: p, stretch: 25, dmg: 0, fail: 0.8, quiet: true, name: 'Thorny Vine (tether not broken)' });
        debuff(s, 'thornyVine', 'Thorny Vine', 'your seed\'s vine: stretch it to 25 yalms to break it', tTeth, tChk);
        call(tTeth, 'Vine on YOU: run out along the ring to break it', { slot: s, alert: true, dur: 6 });
      }
      label(tv, 'Thorny Vine (the seeds tether their planters)');
      backToIdle(tChk + 0.1, planters.map(x => x.s), seedsUntil);
      call(tv.t + 5.2, 'Interrupt the Stygian Shadow (Flood of Darkness)', { dur: 4 });
    }
    if (cds[0]) { const t = chaosDiff(cds[0], seedsUntil); backToIdle(t); }
    // Phaser, then Active-pivot Particle Beam: off the swept quarters (the platforms to the ring, the tiles round a corner).
    let tAfterPh = 0;
    if (phs[0]) tAfterPh = phaser(phs[0]);
    const piv = E('Active-pivot Particle Beam', tDel2, tFl2);
    if (piv) {
      const tP = piv.t, cw = Math.random() < 0.5, step = cw ? 22.5 : -22.5;
      const beams = [0, 1, 2, 3, 4].map(k => ({ shape: 'line', at: [0, 0], deg: deg360(90 + step * k), len: 40, back: 40, w: 18 }));
      const ts = beams.map((_, k) => +(tP + 0.6 + 1.6 * k).toFixed(2));
      beams.forEach((b, k) => hz(Object.assign({ t: ts[k], tell: k ? ts[k - 1] : tP - 6, dmg: 1.3, name: 'Active-pivot Particle Beam', aimed: true }, b)));
      const clear = (p, m) => beams.every(b => !inside(b, p, m));
      const swept = cw ? ['SE', 'NW'] : ['NE', 'SW'];
      label(piv, `Active-pivot Particle Beam (${cw ? 'clockwise' : 'counterclockwise'}: the ${swept.join(' and ')} quarters swept)`);
      call(tP - 13.5, `Rotation ${cw ? 'clockwise' : 'counterclockwise'}: off the ${swept.join(' and ')} quarters`, { alert: true, dur: 6 });
      // The tiles: a swept corner's group round to the corner beside it (across the east-west line).
      const tT = tP - 13;
      for (const [c, g] of Object.entries(tileGroups(tP))) {
        const [sx, sy] = CORNER[c], go = swept.includes(c);
        const wants = Object.fromEntries(g.map(s => { const p = idleOf(s, tP); return [s, go ? [-p[0], p[1]] : p]; }));
        moveAll(tT, placeAll(tT, wants, (s, p) => clear(p, 1.6) && (go ? Math.sign(p[0]) === -sx : true) && Math.sign(p[1]) === sy, 1.2, ts[4] + 0.3), ts[4] + 0.3);
      }
      // The platforms: out onto the ring on the side the beam turns away from.
      const tGo = Math.max(tAfterPh, tP - 9);
      for (const side of ['W', 'E']) {
        const ours = sideSlots(side, tP);
        if (!ours.length) continue;
        const b0 = side === 'W' ? (cw ? 250 : 290) : (cw ? 70 : 110), dir = (side === 'W') === cw ? -1 : 1;
        const wants = Object.fromEntries(ours.map((s, i) => [s, at(b0 + dir * 4 * i, 37.2)]));
        moveAll(tGo, placeAll(tGo, wants, (s, p) => clear(p, 1.6), 1.2, ts[4] + 0.3), ts[4] + 0.3);
      }
    }
    // Excruciate: the Shadows' tank busters on our platform tanks.
    const exc = E('Excruciate', tDel2, tFl2);
    if (exc) {
      const tl = laserEvs.map(e => e.t).find(x => piv && x > piv.t && x < exc.t);
      const t0 = Math.max(piv ? piv.t + 0.6 + 6.5 + 0.1 : exc.t - 5, tl ? tl + 0.1 : 0);
      const spots = idle(t0, null, exc.t + 0.3), tanks = [];
      for (const side of ['W', 'E']) {
        const tank = sideSlots(side, exc.t).find(isTank);
        if (!tank) continue;
        tanks.push(tank);
        hz({ t: exc.t, tell: exc.t - 5, effect: 'bait', shape: 'circle', r: 4, from: 'target', targets: [tank], snap: 0.4, dmg: 1.4, own: 0.55, buster: true, name: 'Excruciate' });
        call(exc.t - 5, 'Tank buster on YOU (Excruciate): away from the others', { slot: tank, alert: true, dur: 4 });
      }
      for (const s of S) if (!tanks.includes(s) && isPlat(zoneOf(s, exc.t))) {
        const others = tanks.map(x => spots[x]);
        spots[s] = findSpot(spots[s], (p) => okFor(s, t0, exc.t + 0.3)(p) && others.every(q => dist(q, p) >= 5.8) && Object.entries(spots).every(([o, q]) => o === s || tanks.includes(o) || dist(q, p) >= 1.0));
      }
      moveAll(t0, spots, exc.t + 0.3);
      label(exc, `Excruciate (tank busters on ${tanks.join(' and ') || 'the other alliances\' tanks'})`);
    }
    // Looming Chaos: to the swap spots, then the clean swap.
    if (loom) {
      const t0 = exc ? exc.t + 0.1 : tSwap - 10;
      const sw = {};
      for (const s of S) {
        const z = zoneOf(s, tSwap - 0.1);
        if (isPlat(z)) { const a = specOf(s, tSwap - 0.1).sw || [0, 0]; sw[s] = plat(z, a[0], a[1], st.rel); }
        else sw[s] = cellAt(z, tileOf(s, tSwap - 0.1).sw || tileOf(s, tSwap - 0.1).id);
      }
      moveAll(t0, placeAll(t0, sw, null, 1.0, tSwap), tSwap);
      raid(tSwap, 0.4, 'Looming Chaos', 'AoE + swaps', 7.7);
      const dest = {};
      for (const s of S) {
        const z1 = zoneOf(s, tSwap - 0.1), z2 = zoneOf(s, tSwap + 0.1);
        if (z1 === z2 && st.Z1[s] === st.Z2[s]) continue;
        dest[s] = idleOf(s, tSwap + 0.1);
      }
      const dd = placeAll(tSwap + 0.1, dest, null, 1.0);
      for (const [s, p] of Object.entries(dd)) {
        hz({ t: tSwap, tell: tSwap - 6, effect: 'pull', targets: [s], from: p, dist: 200, unstoppable: true, tether: p, name: 'Looming Chaos (swap)' });
        call(tSwap - 6, `Swap: you land ${isPlat(zoneOf(s, tSwap + 0.1)) ? `on the ${zoneOf(s, tSwap + 0.1) === 'W' ? 'west' : 'east'} platform` : `on the ${zoneOf(s, tSwap + 0.1)} tiles`}`, { slot: s, alert: true, dur: 6 });
      }
      pref(tSwap + 0.6, dd);
      label(loom, `Looming Chaos (raidwide; swaps: ${Object.keys(dd).join(', ') || 'none of ours'})`);
    }
    // The second half: towers with the Phaser, the chasers, the second Third Art, the cross or donut, the Phaser,
    // the wild charges or spreads.
    if (pcs[1] && pbs[1]) {
      label(pcs[1], 'Particle Concentration (towers)');
      label(pbs[1], 'Particle Beam (the towers)');
      let tFrom = pcs[1].t + 0.6;
      if (phs[1]) tFrom = Math.max(tFrom, phaser(phs[1]));
      for (const side of ['W', 'E']) { const ours = sideSlots(side, pbs[1].t); if (ours.length) towersOn(side, ours, tFrom, pbs[1].t); }
      tileTowers(pcs[1].t + 0.6, pbs[1].t);
      backToIdle(pbs[1].t + 0.1);
    }
    if (tas[1]) {
      const tEnd = tas[1].t + 6.55 + 0.45;
      if (dds[1]) burnRing(dds[1].t + 1.1, tEnd + 2.5);
      thirdArt(tas[1], null, 22.0);
      backToIdle(tEnd + 0.1, S.filter(s => isPlat(zoneOf(s, tEnd))));
    }
    const fe = events.find(e => e.name === 'Feint Particle Beam' && e.kind === 'cast' && e.t > tSwap);
    if (fe) {
      const tLock = fe.t + 1, tF0 = tLock + 4, n = 18, every = 0.36, tEnd = tF0 + every * (n - 1);
      label(fe, 'Feint Particle Beam (a chaser in each tile corner)');
      // Spot s held at `spot` (walked there) from t0 till t1, then back to where it stands idle.
      const taEnd = tas[1] ? tas[1].t + 7.1 : 0, clearOfShadows = (p) => ['W', 'E'].every(sd => dist(p, ADD[sd]) > 16.8);
      const cleaves = P.hazards.filter(h => /^The Art of Darkness/.test(h.name) && h.t >= tLock && h.t <= taEnd + 0.5);
      // Spot s held at `spot` (walked there) from t0 till t1, then back toward its idle spot (clear of the Shadows'
      // cleaves till the Third Art is over).
      const hold = (s, t0, t1, spot) => {
        for (const e of P.prefs) if (e.t > t0 && e.t < taEnd + 0.3 && e.spots[s]) { e.spots = Object.assign({}, e.spots); delete e.spots[s]; }
        moveTo(s, t0, spot, t1);
        if (t1 < taEnd) {
          moveTo(s, t1, findSpot(idleOf(s, t1), (p) => okFor(s, t1, taEnd)(p) && clearOfShadows(p)), taEnd);
          moveTo(s, taEnd + 0.2, idleOf(s, taEnd + 0.2));
        } else moveTo(s, t1, idleOf(s, t1));
      };
      for (const [c, g] of Object.entries(tileGroups(fe.t))) {
        const [sx, sy] = CORNER[c];
        const want = Object.fromEntries(g.map(s => [s, cellAt(c, tileOf(s, fe.t).ch || tileOf(s, fe.t).id)]));
        const spots = placeAll(fe.t - 5, want, (s, p) => clearOfShadows(p), 1.2, tEnd);
        const x = pick(g), mates = g.filter(s => s !== x), start = spots[x];
        // Four ways round the # (along either bar, or through the corner tile first): the one whose trail keeps
        // furthest from everyone else.
        const C0 = [15 * sx, 15 * sy];
        const wayH = [[-15 * sx, 15 * sy], [-15 * sx, -15 * sy], [15 * sx, -15 * sy]], wayV = [[15 * sx, -15 * sy], [-15 * sx, -15 * sy], [-15 * sx, 15 * sy]];
        let chosen = null;
        for (const wps of [wayH, wayV, [C0, ...wayH], [C0, ...wayV]]) {
          const pts = [start];
          let cur = start;
          for (const w of wps) { const r = route(cur, w, (p) => onTiles(p, 0.7)); pts.push(...r.slice(1)); cur = w; }
          const fn = along(pts, tLock + 0.05, 5.6), trail = [];
          let prev = start, worst = Infinity;
          for (let k = 0; k < n; k++) {
            const tk = tF0 + every * k;
            if (k) { const goal = fn(tk - 0.3), v = sub(goal, prev), d = len(v); prev = d > 2.1 ? add(prev, mul(v, 2.1 / d)) : goal; }
            trail.push(prev);
            worst = Math.min(worst, dist(fn(tk), prev) + 1);
            if (k === n - 1) for (const h of cleaves) if (inside(h, h.t <= tEnd + 0.3 ? fn(h.t) : fn(tEnd), 1.6)) worst = -10;
            for (const o of S) if (o !== x) worst = Math.min(worst, dist(mates.includes(o) ? spots[o] : prefAt(o, tk), prev));
          }
          if (!chosen || worst > chosen.worst) chosen = { fn, worst, trail };
        }
        hold(x, fe.t - 5, tLock, start);
        for (const e of P.prefs) if (e.t > tLock && e.t < taEnd + 0.3 && e.spots[x]) { e.spots = Object.assign({}, e.spots); delete e.spots[x]; }
        pref(tLock + 0.05, { [x]: chosen.fn });
        if (tEnd + 0.3 < taEnd) {
          moveTo(x, tEnd + 0.3, findSpot(chosen.fn(tEnd), (p) => okFor(x, tEnd, taEnd)(p) && clearOfShadows(p)), taEnd);
          moveTo(x, taEnd + 0.2, idleOf(x, taEnd + 0.2));
        } else moveTo(x, tEnd + 0.3, idleOf(x, tEnd + 0.3));
        for (const m of mates) {
          if (chosen.trail.some(q => dist(q, spots[m]) < 4.8)) spots[m] = findSpot(spots[m], (p) => okFor(m, tLock, tEnd)(p) && clearOfShadows(p) && chosen.trail.every(q => dist(q, p) >= 4.8)
            && Object.entries(spots).every(([o, q]) => o === m || o === x || dist(q, p) >= 1.2), 20);
          hold(m, fe.t - 5, tEnd + 0.3, spots[m]);
        }
        if (chosen.worst < 3.8) P.notes.push(`Feint ${c}: the chaser comes within ${chosen.worst.toFixed(1)}`);
        let prevH = null;
        for (let k = 0; k < n; k++) {
          const t = +(tF0 + every * k).toFixed(2);
          prevH = hz(k ? { t, tell: +(t - every - 0.3).toFixed(2), shape: 'circle', r: 3, from: 'target', targets: [x], snap: 0.3, after: prevH, move: 2.1, dmg: 1.0, name: 'Feint Particle Beam', aimed: true, react: 1 }
            : { t, tell: tLock, shape: 'circle', r: 3, from: 'target', targets: [x], snap: 4, dmg: 1.0, name: 'Feint Particle Beam', aimed: true });
        }
        call(tLock, 'Chaser on YOU: keep running round the tiles', { slot: x, alert: true, dur: 6 });
        for (const m of mates) call(tLock, `Chaser on ${x}: stay put`, { slot: m, dur: 4 });
      }
    }
    if (ggs[2]) { const t = ghastly(ggs[2]); backToIdle(t); }
    let tPh3 = 0;
    if (phs[2]) tPh3 = phaser(phs[2]);
    if (cds[1]) { const t = chaosDiff(cds[1], 0, tPh3); backToIdle(t); } else if (tPh3) backToIdle(tPh3);
    label(evap, 'Evaporation (the Shadows go into the boss)');

    // ===== The second diamond (Flare first) =====
    pref(tFl2 + 0.4, UP);
    const ges3 = ges.filter(e => e.t > tDel3);
    if (ges3[0]) {
      embrace(ges3[0].t, (ges3[1] || ges3[0]).t);
      label(ges3[0], 'Grim Embrace (hands in front: the first tethers)');
      if (ges3[1]) label(ges3[1], 'Grim Embrace (hands behind: the second tethers)');
    }
    const fl3 = events.find(e => e.name === 'Flare' && e.kind === 'cast' && e.t > tDel3);
    const un3 = events.find(e => e.name === 'Unholy Darkness' && e.kind === 'cast' && e.t > tDel3);
    const b3 = blades.filter(e => e.t > tDel3), k5 = kindOf(), bk4 = pick(['L', 'R', 'C']), bk6 = pick(['L', 'R', 'C']), k7 = kindOf();
    const flWho = pick(S);
    if (act3[0]) razingSet(act3[0], [0, 14], [flWho === 'MT' ? 0 : -9, 16]);
    if (fl3) {
      const hit = E('Flare', fl3.t + 1, fl3.t + 15), tH = hit ? hit.t : fl3.t + 9;
      const tGo = act3[0] ? Math.max(fl3.t + 1.1, act3[0][3] + 0.05) : fl3.t + 1.1;
      flare(fl3.t + 1, tGo, tH, flWho);
      label(fl3, 'Flare (one of ours: away from everyone)');
    }
    if (un3) {
      const hit = E('Unholy Darkness', un3.t + 1, un3.t + 15), tH = hit ? hit.t : un3.t + 8.8;
      const tGo = fl3 ? Math.max(un3.t + 1.2, (E('Flare', fl3.t + 1, fl3.t + 15) || { t: un3.t + 1 }).t + 0.1) : un3.t + 1.2;
      const g1 = ['H1', 'MT', 'M1', 'R1'], g2 = ['H2', 'OT', 'M2', 'R2'];
      pref(tGo, Object.assign(clusterAt([-7, 14], g1, 1.0), clusterAt([7, 14], g2, 1.0)));
      for (const h of ['H1', 'H2']) hz({ t: tH, tell: un3.t + 0.7, effect: 'share', shape: 'circle', from: 'target', targets: [h], r: 6, min: 4, max: 4, dmg: 0.4, name: 'Unholy Darkness' });
      call(un3.t + 0.7, 'Healer stacks: H1\'s group west, H2\'s east', { alert: true, dur: 6 });
      label(un3, 'Unholy Darkness (four-player stacks on the healers)');
    }
    if (b3[0]) { const uh = un3 && E('Unholy Darkness', un3.t + 1, un3.t + 15); blade(b3[0], bk4, BOSS1, uh ? Math.max(b3[0].t - 7.2, uh.t + 0.1) : undefined); pref(b3[0].t + 0.1, UP); }
    const st3 = E('Endeath IV/Enaero IV', tDel3, 9999);
    if (st3) { label(st3, k5 === 'death' ? 'Endeath IV (a draw-in after the next Blade)' : 'Enaero IV (a knockback after the next Blade)'); call(st3.t, k5 === 'death' ? 'Stored: draw-in after the next Blade' : 'Stored: knockback after the next Blade', { dur: 4 }); }
    const brk = E('Break IV', tDel3, 9999);
    if (brk) {
      const t = brk.t, e1 = pick([[15, 11], [20, 24]]), eyes = [e1, [-e1[0], e1[1]]];
      hz({ t, tell: t - 6, effect: 'gaze', at: BOSS1, dmg: 0.9, name: 'Break IV' });
      eyes.forEach(e => hz({ t: t + 0.1, tell: t - 4, effect: 'gaze', at: e, dmg: 0.9, name: 'Break IV (Sinister Eye)' }));
      eyes.forEach(e => P.marks.push({ kind: 'lit', shape: 'circle', at: e, r: 1.4, t0: t - 4.5, t1: t + 0.4, fill: 'rgba(200,60,255,0.55)' }));
      call(t - 6, 'Look away from the boss and both eyes', { alert: true, dur: 5 });
      label(brk, 'Break IV (gazes: the boss and two Sinister Eyes)');
    }
    if (b3[1]) {
      blade(b3[1], bk6, BOSS1);
      const v = E('Vortex/Aero IV', b3[1].t, b3[1].t + 5), tR = v ? v.t : b3[1].t + 2.2;
      deathAero(tR, k5, KDIR[bk6], b3[1].t - 0.1);
      label(v, KNAME[k5] + ' (stored)');
      pref(tR + (k5 === 'death' ? 4.2 : 0.7), UP);
    }
    const da3 = events.find(e => e.name === 'Death IV/Aero IV' && e.t > tDel3);
    if (act3[1]) razingSet(act3[1], [0, 14], k7 === 'death' ? [0, 1] : [0, 13.5]);
    if (da3) {
      const v = E('Vortex/Aero IV', da3.t, da3.t + 3), tR = v ? v.t : da3.t + 0.6;
      deathAero(tR, k7, 180, da3.t - 5.6, act3[1] ? Math.max(da3.t - 5.4, act3[1][3] + 0.05) : da3.t - 5.4);
      label(da3, KNAME[k7]);
      label(v, KNAME[k7]);
    }
    const de = events.find(e => /enrage/.test(e.name));
    if (de) label(de, 'Deluge of Darkness (the enrage)');

    // ===== Placed last, once every spot is known =====
    // The lasers: each away from the middle, turned off anyone it would catch.
    for (const L of laserPlan) for (const s of L.who) {
      const p = prefAt(s, L.t - 0.4), others = S.filter(o => o !== s).flatMap(o => [L.t - 0.7, L.t - 0.4, L.t - 0.2, L.t, L.t + 0.1].map(tt => prefAt(o, tt))), out = brg(p);
      let best = null;
      for (const m of [1.4, 0.7]) {
        for (const d of Array.from({ length: 36 }, (_, k) => (k % 2 ? 1 : -1) * Math.ceil(k / 2) * 10)) {
          const deg = deg360(out + d), cone = { shape: 'cone', at: p, deg, half: 7.5, r: 25 };
          if (others.every(q => !inside(cone, q, m))) { best = deg; break; }
        }
        if (best !== null) break;
      }
      if (best === null) { best = out; P.notes.push(`laser ${s} at ${L.t}: no clear way`); }
      hz({ t: L.t, tell: L.t - 4, effect: 'bait', shape: 'cone', from: 'target', targets: [s], deg: best, half: 7.5, r: 25, snap: 0.4, dmg: 0.9, own: 0, name: 'Dark-energy Particle Beam' });
      debuff(s, 'curseOfDarkness', 'Curse of Darkness', 'your laser fires as it runs out: point it away from everyone', L.curse, L.t);
      call(L.t - 4, 'Your laser: face away from everyone', { slot: s, alert: true, dur: 4 });
    }
    const busy = (t) => P.hazards.reduce((m, h) => (h.t < t && (h.effect === 'share' || h.effect === 'tower' || h.effect === 'bait') ? Math.max(m, h.t) : m), 0);
    // The hands: each target where its hand (in front, toward the boss, or behind) catches nobody, then out of it.
    for (const h of hands) {
      const tl = +(h.t - 1).toFixed(2), p = prefAt(h.s, tl), others = S.filter(o => o !== h.s);
      const rect = (q) => ({ shape: 'line', at: q, deg: deg360(brg(sub(BOSS1, q)) + (h.back ? 180 : 0)), len: 8, w: 8 });
      const clearOf = (q) => others.every(o => !inside(rect(q), prefAt(o, h.t), 1.7) && !inside(rect(q), prefAt(o, tl), 1.7));
      if (!clearOf(p)) {
        // Not before the last stack, tower or bait it's part of (it walks there in what time is left).
        const t0 = Math.max(h.t - 3.5, busy(tl) + 0.05), reach = Math.max(1.5, 5.5 * (tl - t0));
        const spot = findSpot(p, (q) => dist(q, p) <= reach && inDiamond(q, 1.6) && clearOf(q) && others.every(o => dist(prefAt(o, h.t), q) > 1.2), 14);
        override(h.s, +t0.toFixed(2), +(h.t + 0.2).toFixed(2), spot);
        if (!clearOf(spot)) {
          // Nowhere clear: the others step out of its way instead.
          for (const o of others) {
            const q0 = prefAt(o, h.t);
            if (!inside(rect(spot), q0, 1.7) && !inside(rect(spot), prefAt(o, tl), 1.7)) continue;
            const q = findSpot(q0, (q) => dist(q, prefAt(o, t0)) <= reach + 2 && inDiamond(q, 1.6) && !inside(rect(spot), q, 2.0) && dist(q, spot) > 1.2, 14);
            override(o, +t0.toFixed(2), +(h.t + 0.2).toFixed(2), q);
          }
        }
      }
      hz({ t: h.t, tell: h.t - 5, shape: 'line', from: 'target', targets: [h.s], aim: BOSS1, turn: h.back ? 180 : 0, len: 8, w: 8, snap: 1.0, dmg: 1.0, name: 'Grim Embrace (the hand)' });
      call(h.t - 5, `Your hand comes ${h.back ? 'behind' : 'in front of'} you: then step ${h.back ? 'forward' : 'back'}`, { slot: h.s, alert: true, dur: 4 });
    }
    return P;
  }

  B.FIGHT_SCRIPTS = B.FIGHT_SCRIPTS || {};
  B.FIGHT_SCRIPTS.chaotic = {
    // FFLogs' max HP in a kill (report ha4c9WMqF3J2b7yQ, and nmyZKRaVNkd3cYth the same): the Cloud of Darkness
    // 294,173,558, for all twenty-four. The sim counts only the eight's damage (about a third of that; the Shadows'
    // damage goes to her anyway, at Evaporation), so a pull here runs on to the enrage with her near two thirds: no
    // push stands in for the others, since every phase change in this fight is on the clock (cactbot's timeline has no
    // HP-pushed phases), and the timeline plays out as in the game. Clearing it needs the whole alliance; the party's
    // job here is the mechanics.
    hp: 294173558,
    pushes: [],
    defaultStrat: 'raidplan',
    strats: {
      raidplan: { label: 'Raidplan (Aurelia/wfJ/o1Z)' },
      codcar: { label: 'CODCAR' },
      healerout: { label: 'HealerOut' },
      idyll: { label: 'Idyll/game8' },
    },
    source: 'wtfdig.info/71/chaotic (alliance A); mechanics after BossMod (github.com/awgil/ffxiv_bossmod) and FFLogs kills',
    // A north, B east, C south, D west, on the round floor's rim; 1-4 the diamond's middle and its corners.
    waymarks: [
      { label: 'A', at: [0, 30], color: 'red' }, { label: 'B', at: [30, 0], color: 'yellow' },
      { label: 'C', at: [0, -30], color: 'blue' }, { label: 'D', at: [-30, 0], color: 'purple' },
      { label: '1', at: [-15, 15], color: 'red', square: true }, { label: '2', at: [15, 15], color: 'yellow', square: true },
      { label: '3', at: [15, -15], color: 'blue', square: true }, { label: '4', at: [-15, -15], color: 'purple', square: true },
    ],
    plan,
  };
})(window.BLM);
