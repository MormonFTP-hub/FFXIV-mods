// EX7, Hell on Rails (Extreme): Doomtrain's mechanics for the sim's party, on cactbot's timeline
// (07-dt/trial/doomtrain-ex), and the two strats wtfdig.info lists for the fight (74/ex7): Hector (NA, the default) and
// Game8 (JP), each with its own defaults for wtfdig's toggles (Intermission: Hector's slide 30 or Game8's; Arcane:
// normal or Game8's 2/6 cheese). Spots are [east, north] yalms from the middle of the car the party is on.
//
// The fight is fought on a train: six cars, each 20 x 29.2 (BossMod's CarGeometry), the boss (R19) 25 north of the
// car's middle, facing the party. The sim keeps the car the party is on at the origin and moves the map with it (the
// plan's looks shift the train 50 yalms a car). The mechanics follow BossMod's module (github.com/awgil/ffxiv_bossmod,
// Ex7Doomtrain), whose shapes and sizes come from the game's Action sheet; where things stand follows an FFLogs kill
// (the boss, the turrets, the towers, the Aether's arena). Built with the sim's toolkit (js/mech.js):
//   - The cars' obstacles: electric fences (5 x 5, they stop you, not lasers) and crate stacks (5.8, they stop both);
//     the floor is the car less them. Car 4 has two raised platforms, car 6 one (wtfdig's "High/Low").
//   - Dead Man's Overdraught: stores a spread (Plasma, 5 yalms on everyone) or partner stacks (Hyperexplosive Plasma,
//     on the four supports); the next one stores the other. It goes off after the next Express or Windpipe.
//   - Dead Man's Express: a 30-yalm push south (stopped by fences, crates and the wall), then Plasma Beam down the two
//     lanes whose signal is low (lanes 1+3 or 2+4, each pull), cut short by crates. Dead Man's Windpipe: a 30-yalm
//     draw north, then Blastpipe on the north 10 yalms. Car 1 does Express then Windpipe; cars 2 and 6 either order.
//   - Turret Crossing: six 5-wide lasers across the car from the west or east (then the other side, then the first
//     again), cut short by crates: hide behind one. Car 6's later sets: from the east they hit the ground (go up on
//     the platform), from the west the platform (stay down).
//   - Lightning Burst: a 5-yalm tank buster on each tank. Unlimited Express, Shockwave, Runaway Train: raidwides.
//   - Runaway Train: the Aether's arena (a 14.5-yalm circle), five rounds while it lives: the Ghost Train, 25 out and
//     circling, fires a 35-degree cone at each tank, and the healers' two stacks or everyone's spreads go off; kill the
//     Aether (it takes all the party's damage) to go back to car 3.
//   - Derailment Siege: a tower in the north half (everyone in), hit three to seven times; then Derail hits the car but
//     the launchpad at its south end, and the party is on the next car.
//   - Third Rail: a 4-yalm puddle dropped under everyone; move out before it goes off.
//   - Thunderous Breath / Headlight: the ground, then the platforms 2.4 s later (or the other way round).
//   - Arcane Revelation: Hail of Thunder, a 16-yalm circle at one of four points (north, west, south, east of the
//     car's middle), moved two, three or four steps round them each time, three times in car 4, twice in car 6; with
//     it Hyperconductive Plasma, 13-yalm stacks on a tank and a healer (tanks and melee together, healers and ranged
//     together). Game8's cheese: tanks north-west, everyone else north-east, taking the Hail with mitigation (the bots
//     stand in it; in the sim it also leaves Damage Down, as anything you stand in does).
//   - Psychokinesis: Plummet, 8-yalm spreads on two, three, five (car 5) and four (car 6) players; car 5's crates go
//     a few at a time before each (one of two mirrored patterns).
// Simplified: one floor level: the platforms are floor you walk onto (no teleport pads), standing on one is "up";
// the fences and crates stop knockbacks and lasers but the sim's floor doesn't stop you walking through them (the
// pushes are bands of the car, each pushed as far as its stop). Where Hector's tanks, melee and ranged take Windpipe
// with Arm's Length or Surecast, the sim's spots hide everyone behind a fence or crate instead (you can still use
// yours). wtfdig's spots are car 1's: elsewhere (cars 2 and 6's stored mechanics, the turrets, the pushes,
// Psychokinesis' two and three spreads, car 6's Arcane Revelation) the spots are this script's own, the strat's where
// they can be reached in time, worked out each pull from the obstacles. The Aether is drawn as a mark (its model is all
// effects); its enrage (Runaway Train, if it lives) isn't: the fight moves on to car 3 either way. Which tank and
// healer get Hyperconductive Plasma is random, and Game8's cheese shares the tanks' stack between the two of them.
// The crates the map shows can't vanish one at a time: car 2's (the map also has the normal mode's there), and car
// 5's once they start going, are marks on the floor.
(function (B) {
  const S = B.SLOTS;
  const at = B.bearing;
  const inside = B.mechInside;
  const add = (a, b) => [a[0] + b[0], a[1] + b[1]];
  const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);
  const r2 = (p) => [+p[0].toFixed(2), +p[1].toFixed(2)];
  const pick = (a) => a[Math.floor(Math.random() * a.length)];
  const shuffle = (a) => { const b = a.slice(); for (let i = b.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [b[i], b[j]] = [b[j], b[i]]; } return b; };
  const deg360 = (d) => ((d % 360) + 360) % 360;
  const brg = (p) => deg360(Math.atan2(p[0], p[1]) * 180 / Math.PI);
  const len = (p) => Math.hypot(p[0], p[1]);
  const rot = (p, g) => (len(p) < 1e-6 ? [0, 0] : at(brg(p) + g, len(p)));
  const SUP = ['MT', 'OT', 'H1', 'H2'], DPS = ['M1', 'M2', 'R1', 'R2'], TANKS = ['MT', 'OT'], HEALERS = ['H1', 'H2'];
  const PARTNER = { MT: 'M1', OT: 'M2', H1: 'R1', H2: 'R2', M1: 'MT', M2: 'OT', R1: 'H1', R2: 'H2' };
  const DIR16 = ['north', 'north-northeast', 'northeast', 'east-northeast', 'east', 'east-southeast', 'southeast', 'south-southeast',
    'south', 'south-southwest', 'southwest', 'west-southwest', 'west', 'west-northwest', 'northwest', 'north-northwest'];
  const dir16 = (deg) => DIR16[Math.round(deg360(deg) / 22.5) % 16];
  const W = 10, L = 14.6;               // the car's half width and half length (BossMod's CarHeight)
  const STOPM = 1.2;                    // where a push stops short of what stops it
  const BOSS_AT = [0, 25];

  // ---------- the cars ----------
  // Obstacles: {x0, x1, y0, y1, kind}: 'fence' (stops you), 'crate' (stops you and lasers).
  const box = (x0, x1, y0, y1, kind) => ({ x0, x1, y0, y1, kind });
  const sq = (cx, cy, h, kind) => box(cx - h, cx + h, cy - h, cy + h, kind);
  const fence = (cx, cy) => sq(cx, cy, 2.5, 'fence');
  const crate = (cx, cy) => sq(cx, cy, 2.9, 'crate');
  // Car 5's sixteen crates, row r north to south, column c west to east; which go before each Psychokinesis (Game8's
  // drawings; Hector's are the mirror image).
  const C5 = (r, c) => crate(-7.5 + 5 * c, 7.5 - 5 * r);
  const C5_GONE = [[[0, 2], [1, 3]], [[1, 0], [1, 2], [2, 1]], [[0, 0], [0, 1], [2, 0], [2, 3], [3, 1]]];
  // The raised platforms (floor in the sim: standing on one is "up").
  const PLAT = { 4: [box(5, 10, -5, 5, 'plat'), box(-10, -5, -14.5, 0, 'plat')], 6: [box(-10, -5, -14.5, 5, 'plat')] };
  const PAD = [0, -12.5];               // the launchpad to the next car

  // The car's floor less its obstacles, as the largest rectangles that fit (overlapping, so a point well inside the
  // floor is well inside one of them).
  function floorRects(obs) {
    const cl = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
    const xs = [...new Set([-W, W, ...obs.flatMap(o => [cl(o.x0, -W, W), cl(o.x1, -W, W)])])].sort((a, b) => a - b);
    const ys = [...new Set([-L, L, ...obs.flatMap(o => [cl(o.y0, -L, L), cl(o.y1, -L, L)])])].sort((a, b) => a - b);
    const nx = xs.length - 1, ny = ys.length - 1;
    const F = xs.slice(0, nx).map((_, i) => ys.slice(0, ny).map((__, j) => {
      const cx = (xs[i] + xs[i + 1]) / 2, cy = (ys[j] + ys[j + 1]) / 2;
      return xs[i + 1] - xs[i] > 1e-6 && ys[j + 1] - ys[j] > 1e-6 && !obs.some(o => cx > o.x0 && cx < o.x1 && cy > o.y0 && cy < o.y1);
    }));
    const out = new Map();
    const keep = (i0, i1, j0, j1) => out.set(`${i0},${i1},${j0},${j1}`, { shape: 'rect', a: [xs[i0], ys[j0]], b: [xs[i1 + 1], ys[j1 + 1]] });
    for (let i = 0; i < nx; i++) for (let j = 0; j < ny; j++) {
      if (!F[i][j]) continue;
      // Across, then up and down as far as the whole run is free; and the other way round.
      let i0 = i, i1 = i;
      while (i0 > 0 && F[i0 - 1][j]) i0--;
      while (i1 < nx - 1 && F[i1 + 1][j]) i1++;
      const rowFree = (jj) => { for (let k = i0; k <= i1; k++) if (!F[k][jj]) return false; return true; };
      let j0 = j, j1 = j;
      while (j0 > 0 && rowFree(j0 - 1)) j0--;
      while (j1 < ny - 1 && rowFree(j1 + 1)) j1++;
      keep(i0, i1, j0, j1);
      let a0 = j, a1 = j;
      while (a0 > 0 && F[i][a0 - 1]) a0--;
      while (a1 < ny - 1 && F[i][a1 + 1]) a1++;
      const colFree = (ii) => { for (let k = a0; k <= a1; k++) if (!F[ii][k]) return false; return true; };
      let b0 = i, b1 = i;
      while (b0 > 0 && colFree(b0 - 1)) b0--;
      while (b1 < nx - 1 && colFree(b1 + 1)) b1++;
      keep(b0, b1, a0, a1);
    }
    return [...out.values()];
  }
  // The same floor as rectangles that don't overlap (a hit over the floor lands once): rows of cells.
  function gridRects(obs) {
    const cl = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
    const xs = [...new Set([-W, W, ...obs.flatMap(o => [cl(o.x0, -W, W), cl(o.x1, -W, W)])])].sort((a, b) => a - b);
    const ys = [...new Set([-L, L, ...obs.flatMap(o => [cl(o.y0, -L, L), cl(o.y1, -L, L)])])].sort((a, b) => a - b);
    const out = [];
    for (let j = 0; j + 1 < ys.length; j++) {
      let run = null;
      for (let i = 0; i + 1 < xs.length; i++) {
        const cx = (xs[i] + xs[i + 1]) / 2, cy = (ys[j] + ys[j + 1]) / 2;
        const free = !obs.some(o => cx > o.x0 && cx < o.x1 && cy > o.y0 && cy < o.y1);
        if (free) run = run ? [run[0], xs[i + 1]] : [xs[i], xs[i + 1]];
        if ((!free || i + 2 === xs.length) && run) { out.push({ shape: 'rect', a: [run[0], ys[j]], b: [run[1], ys[j + 1]] }); run = null; }
      }
    }
    return out;
  }
  // Whether a point is on the car's floor, m clear of its edges and obstacles.
  const onFloor = (p, obs, m) => Math.abs(p[0]) < W - m && Math.abs(p[1]) < L - m
    && !obs.some(o => p[0] > o.x0 - m && p[0] < o.x1 + m && p[1] > o.y0 - m && p[1] < o.y1 + m);
  // The nearest point to `want` that's ok (searched outward), or want.
  function findSpot(want, ok) {
    if (ok(want)) return r2(want);
    for (let r = 0.2; r <= 30; r += 0.2) {
      const n = Math.max(12, Math.round(2 * Math.PI * r / 0.25));
      for (let k = 0; k < n; k++) { const p = add(want, at(k * 360 / n, r)); if (ok(p)) return r2(p); }
    }
    return r2(want);
  }
  const nudgeAll = (spots, obs, m) => Object.fromEntries(Object.entries(spots).map(([s, p]) => [s, findSpot(p, (q) => onFloor(q, obs, m ?? 1.0))]));

  // Where a body at p ends after a straight push south (180) or north (0): STOPM short of the first obstacle or wall
  // in its way.
  function pushLand(p, dir, obs) {
    const bl = obs.filter(o => p[0] > o.x0 - 0.5 && p[0] < o.x1 + 0.5);
    if (dir === 180) {
      let stop = -L + STOPM;
      for (const o of bl) if (o.y1 <= p[1] + 0.5 && o.y1 + STOPM > stop) stop = o.y1 + STOPM;
      return [p[0], Math.min(p[1], stop)];
    }
    let stop = L - STOPM;
    for (const o of bl) if (o.y0 >= p[1] - 0.5 && o.y0 - STOPM < stop) stop = o.y0 - STOPM;
    return [p[0], Math.max(p[1], stop)];
  }

  // ---------- the strats ----------
  // wtfdig's spots, from its pictures of car 1 (Hector's 1920 x 1080: the car 28.5 px a yalm about (962, 657); Game8's
  // smaller drawings likewise): the stored spread, the partner stacks, the big spreads.
  const HEC = {
    spread: { MT: [-9.03, 13.81], OT: [9.43, 13.96], H1: [-9.16, -13.89], H2: [9.36, -13.93], M1: [-4.05, 6.99], M2: [3.77, 6.91], R1: [-0.81, -13.93], R2: [2.56, -1.69] },
    pairs: { MT: [-6.74, 9.64], OT: [6.87, 9.68], H1: [-7.75, -5.22], H2: [6.8, -4.69], M1: [-6.74, 9.64], M2: [6.87, 9.68], R1: [-7.75, -5.22], R2: [6.8, -4.69] },
    big: { MT: [-9.07, 13.96], OT: [9.36, 13.96], H1: [-9.16, -4.12], H2: [9.36, -4.08], M1: [0.13, 14.03], M2: [0.2, 5.43], R1: [-9.16, 4.9], R2: [9.36, 4.94] },
    // Car 5's five spreads (the crates left then, Hector's pattern).
    big5: { MT: [-9.3, 13.9], OT: [9.3, 13.9], M1: [0.1, 13.9], R1: [-9.3, 3.9], M2: [-1.1, 5.6], R2: [9.3, 5.3], H1: [-6.1, -3.9], H2: [8.4, -3.4] },
    // Car 1's Express and Windpipe (Hector's slides): who stands where before the push.
    express: { MT: [2.4, 7.6], OT: [3.4, 6.4], M1: [1.4, 7.5], M2: [3.8, 6.4], H1: [-7.8, 0.6], R1: [-8.6, -1.2], R2: [2.35, -1.2], H2: [3.9, -1.0] },
    windpipe: { MT: [-1.2, 4.1], OT: [-3.2, 4.1], M1: [-5.2, 4.1], M2: [-2.4, 3.05], H1: [1.26, -1.2], H2: [2.8, -1.0], R1: [-8.3, -7.2], R2: [8.6, -6.7] },
  };
  const G8 = {
    spread: { MT: [-7.4, 12.5], OT: [7.6, 12.5], H1: [-6.9, -3.4], H2: [5.6, -4.2], M1: [-5.0, 4.2], M2: [6.7, 3.6], R1: [-5.2, -12.6], R2: [5.6, -12.6] },
    pairs: { MT: [-6.8, 7.5], OT: [4.1, 7.5], H1: [-6.7, -10.7], H2: [5.0, -10.1], M1: [-6.8, 7.5], M2: [4.1, 7.5], R1: [-6.7, -10.7], R2: [5.0, -10.1] },
    big: HEC.big,
    big5: HEC.big5,
    express: { MT: [-7.9, 5.4], M1: [-7.9, 5.0], OT: [2.4, 8.0], M2: [4.0, 8.0], H1: [-7.9, -0.6], R1: [-7.9, -3.1], H2: [2.0, -1.8], R2: [3.0, -3.6] },
    windpipe: { MT: [-7.0, -9.0], M1: [-7.0, -9.5], OT: [6.0, -6.0], M2: [7.0, -6.0], H1: [1.5, -1.5], R1: [1.5, -2.5], H2: [3.5, -1.5], R2: [3.5, -2.5] },
  };
  // Runaway Train, the Ghost Train north (its frame turns with it): Hector's (slide 30) and Game8's.
  const RUN = {
    alt: {
      stacks: { MT: [-9.6, 9.3], OT: [9.9, 8.6], H1: [-0.15, 7.6], M1: [-0.15, 7.0], R1: [0.5, 7.6], H2: [-0.15, -6.7], M2: [-0.15, -6.0], R2: [0.5, -6.7] },
      spreads: { MT: [-9.6, 9.3], OT: [9.9, 8.6], H1: [0, 13.0], H2: [-0.1, -13.0], M1: [0, 4.8], M2: [0, -4.5], R1: [-7.6, -10.6], R2: [7.8, -10.4] },
    },
    game8: {
      stacks: { MT: [-9.05, 8.9], OT: [9.05, 8.95], H1: [0.1, 3.5], M1: [-0.5, 3.5], M2: [0.6, 3.5], H2: [0.4, -6.7], R1: [-0.2, -6.7], R2: [1.0, -6.7] },
      spreads: { MT: [-9.1, 8.7], OT: [9.1, 8.8], H1: [0, 10.2], H2: [0, -6.1], M1: [-5.5, 0.8], M2: [5.7, 0.2], R1: [-6.3, -10.2], R2: [6.4, -10.5] },
    },
  };
  const STRATS = {
    hector: { setup: HEC, runaway: 'alt', arcane: 'normal' },
    game8: { setup: G8, runaway: 'game8', arcane: 'cheese' },
  };
  // Where the party waits between mechanics: tanks and melee at the boss's front edge, the rest behind.
  const UP = { MT: [-1.4, 8.2], OT: [1.4, 8.2], M1: [-3.6, 7.2], M2: [3.6, 7.2], R1: [-6.0, 3.0], R2: [6.0, 3.0], H1: [-3.6, -2.0], H2: [3.6, -2.0] };
  const UP_INT = { MT: [-1.2, 3.2], OT: [1.2, 3.2], M1: [-2.5, 2.0], M2: [2.5, 2.0], R1: [-6, -3], R2: [6, -3], H1: [-3, -5], H2: [3, -5] };

  // ---------- the pull ----------
  function plan(events, strat) {
    const st = STRATS[strat] || STRATS.hector, SET = st.setup;
    const P = { start: Object.assign({}, UP), prefs: [], hazards: [], checks: [], calls: [], marks: [], labels: new Map(), debuffs: [],
      boss: [{ t: 0, at: BOSS_AT }], hitbox: [{ t: 0, r: 19 }], face: [{ t: 0, deg: 180 }], arena: [], looks: [], form: [], others: [] };
    let id = 0;
    const hz = (o) => { const h = Object.assign({ id: ++id, react: 3 }, o); P.hazards.push(h); return h; };
    const pref = (t, spots) => P.prefs.push({ t: +t.toFixed(2), spots });
    const call = (t, text, o) => P.calls.push(Object.assign({ t: +t.toFixed(2), text, dur: 5 }, o));
    const mark = (shape, t0, t1, fill) => P.marks.push(Object.assign({ kind: 'lit', t0: +t0.toFixed(2), t1: +t1.toFixed(2), fill }, shape));
    const label = (ev, text) => { if (ev) P.labels.set(ev, text); };
    const E = (name, t0, t1) => events.find(e => e.name === name && e.t >= t0 && e.t <= t1) || null;
    const EA = (name, t0, t1) => events.filter(e => e.name === name && e.t >= t0 && e.t <= t1);
    const EP = (pre, t0, t1) => events.find(e => e.name.startsWith(pre) && e.t >= t0 && e.t <= t1) || null;
    const tOf = (ev, d) => (ev ? ev.t : d);
    const raid = (t, tell, dmg, name, text) => { hz({ t, tell, raidwide: true, dmg, name }); call(tell, text || 'Raidwide', { dur: 3 }); };
    const all = (p) => Object.fromEntries(S.map(s => [s, p]));

    // ===== the cars and when the party is on each =====
    const ue = EA('Unlimited Express', 0, 200), rtStart = E('Runaway Train', 140, 160), rtEnd = E('Runaway Train', 400, 600);
    const derails = EA('Derail', 500, 900);
    const T = {
      c2: tOf(ue[0], 52.3) + 2.5, c3: tOf(ue[1], 120.7) + 2.5, int: tOf(rtStart, 149.2) + 3.4, back: tOf(rtEnd, 515.1) + 0.1,
      c4: tOf(derails[0], 559.9) + 0.6, c5: tOf(derails[1], 683.1) + 0.6, c6: tOf(derails[2], 760.2) + 0.6,
    };
    const carAt = (t) => (t < T.c2 ? 1 : t < T.c3 ? 2 : t < T.int ? 3 : t < 400 ? 'int' : t < T.back ? 'int' : t < T.c4 ? 3 : t < T.c5 ? 4 : t < T.c6 ? 5 : 6);
    // Car 5's crates: all sixteen, then the three batches gone (before each Psychokinesis), the pattern mirrored or not.
    const mirror5 = Math.random() < 0.5;
    const psy = EA('Psychokinesis', 680, 760);
    const c5Stage = [T.c5 - 1, ...psy.map(e => e.t - 8.5)];          // when each stage starts (0: all sixteen)
    const c5Crates = (k) => {
      const gone = new Set(C5_GONE.slice(0, k).flat().map(([r, c]) => `${r},${mirror5 ? 3 - c : c}`));
      const out = [];
      for (let r = 0; r < 4; r++) for (let c = 0; c < 4; c++) if (!gone.has(`${r},${c}`)) out.push(C5(r, c));
      return out;
    };
    const el6 = EA('Electray', 780, 830);
    const c6CratesGone = el6[1] ? el6[1].t - 6.5 : 797.9;
    const obsAt = (t) => {
      const c = carAt(t);
      if (c === 1) return [fence(-2.5, -7.5), fence(2.5, 2.5)];
      if (c === 2) return [fence(2.5, -7.5), fence(-2.5, 2.5), crate(7.575, 2.425), crate(-7.425, -7.425)];
      if (c === 4) return [box(-5, 5, -4.5, -0.5, 'fence')];
      if (c === 5) { let k = 0; for (let i = 1; i < c5Stage.length; i++) if (t >= c5Stage[i]) k = i; return c5Crates(k); }
      if (c === 6) return t < c6CratesGone ? [fence(2.5, -2.5), box(5, 10.5, 5, 15, 'crate'), box(0, 10.5, -15, -10, 'crate')] : [fence(2.5, -2.5)];
      return [];
    };
    const nudge = (spots, t, m) => nudgeAll(spots, obsAt(t), m);
    const upAt = (t) => (carAt(t) === 'int' ? UP_INT : nudge(UP, t));

    // The floor, the map's look and the crates' marks, car by car.
    const SCENERY = ['a0_arf07', 'a0_brg', 'a0_lin', 'a0_rai', 'a0_stc01', 'a0_stc03', 'a1_', 'a2_'];
    // The train's cars (car 3's and 5's plain deck, a0_stg01, only while on them: the map has the normal mode's cars
    // too, whose plain decks lie over the other cars' own).
    const TRAIN = ['a0_stg00', 'a0_stg02', 'a0_stg03', 'a0_stg04', 'a0_stg05', 'a0_stg0r', 'a0_fen02', 'a0_fen03', 'a0_fen04', 'a0_arf05', 'a0_arf06', 'a0_wal0r'];
    const look = (t, car, extra) => P.looks.push({ t: +t.toFixed(2), show: [...TRAIN, ...SCENERY, ...extra], shift: [0, 50 * (car - 1)] });
    const floor = (t, obs) => P.arena.push({ t: +t.toFixed(2), parts: floorRects(obs) });
    const crateMarks = (obs, t0, t1) => { for (const o of obs) if (o.kind === 'crate') mark({ shape: 'rect', a: [Math.max(-W, o.x0), Math.max(-L, o.y0)], b: [Math.min(W, o.x1), Math.min(L, o.y1)] }, t0, t1, 'rgba(120,110,255,0.42)'); };
    const PLATS = ['a0_arf02', 'a0_arf03', 'a0_arf04', 'a0_warp', 'a0_fen01'];
    look(0, 1, PLATS); floor(0, obsAt(0));
    look(T.c2, 2, PLATS); floor(T.c2, obsAt(T.c2)); crateMarks(obsAt(T.c2), T.c2, T.c3);
    look(T.c3, 3, ['a0_stg01', 'a0_arf02', 'a0_arf03', 'a0_arf04', 'a0_warp0', 'a0_fen01']); floor(T.c3, []);
    P.looks.push({ t: +T.int.toFixed(2), show: ['a3_emv01', 'a0_stc04'], shift: [500, -500], lift: 900 });
    P.arena.push({ t: +T.int.toFixed(2), shape: 'circle', at: [0, 0], r: 14.5 });
    look(T.back, 3, ['a0_stg01', 'a0_arf02', 'a0_arf03', 'a0_arf04', 'a0_warp0', 'a0_fen01']); floor(T.back, []);
    look(T.c4, 4, PLATS); floor(T.c4, obsAt(T.c4));
    look(T.c5, 5, ['a0_stg01', 'a0_box01']); floor(T.c5, obsAt(T.c5));
    for (let k = 1; k < c5Stage.length; k++) {
      look(c5Stage[k], 5, ['a0_stg01']); floor(c5Stage[k], obsAt(c5Stage[k]));
      crateMarks(obsAt(c5Stage[k]), c5Stage[k], k + 1 < c5Stage.length ? c5Stage[k + 1] : T.c6);
    }
    look(T.c6, 6, [...PLATS, 'a0_box01']); floor(T.c6, obsAt(T.c6));
    look(c6CratesGone, 6, PLATS); floor(c6CratesGone, obsAt(c6CratesGone));
    // The boss: 25 north of the car (the Aether in the middle of its arena meanwhile, its own model off the field).
    P.boss.push({ t: +(T.int - 0.1).toFixed(2), at: [0, 0] }, { t: +T.back.toFixed(2), at: BOSS_AT });
    P.hitbox.push({ t: +(T.int - 0.1).toFixed(2), r: 1.5 }, { t: +T.back.toFixed(2), r: 19 });
    P.form.push({ t: +T.int.toFixed(2), model: 'none' }, { t: +T.back.toFixed(2), model: null });
    mark({ shape: 'circle', at: [0, 0], r: 1.5 }, T.int, T.back, 'rgba(120,200,255,0.55)');

    // ===== Dead Man's Overdraught, Express and Windpipe =====
    // The stored mechanic: the first car-by-car is random, then they alternate.
    let stored = Math.random() < 0.5 ? 'spread' : 'pairs';
    const storedName = (k) => (k === 'spread' ? 'Spread' : 'Stack With Partner');
    const ods = EA("Dead Man's Overdraught", 0, 900);
    // Car 2's and car 6's Express/Windpipe order.
    const kmOrder = { 2: Math.random() < 0.5 ? 'express' : 'windpipe', 6: Math.random() < 0.5 ? 'express' : 'windpipe' };
    const firstSide = { 2: Math.random() < 0.5 ? 'W' : 'E', 6: Math.random() < 0.5 ? 'W' : 'E' };
    const odOrder = { 1: stored };

    // Plasma Beam: the two lanes whose signal is low, from the north end, cut short by crates (car 6's west lane by its
    // platform; its high beam there runs over the platform).
    function beams(t, tell, ground, obs, car) {
      for (const i of [0, 1, 2, 3]) {
        const x0 = -W + 5 * i, x1 = x0 + 5;
        if (ground.includes(i)) {
          let yEnd = -L;
          for (const o of obs) if (o.kind === 'crate' && Math.min(o.x1, x1) - Math.max(o.x0, x0) > 1 && o.y1 > yEnd) yEnd = o.y1;
          if (car === 6 && i === 0) yEnd = Math.max(yEnd, 5);
          if (L - yEnd > 0.3) hz({ t, tell, shape: 'rect', a: [x0, yEnd], b: [x1, L], dmg: 1.2, name: 'Plasma Beam' });
        } else if (car === 6 && i === 0) hz({ t, tell, shape: 'rect', a: [-W, -14.5], b: [-5, 5], dmg: 1.2, name: 'Plasma Beam (over the platform)' });
      }
    }
    // A straight push (180: south, Express) or draw (0: north, Windpipe) of 30 that stops at fences, crates and the
    // walls: bands of the car, each pushed as far as its stop (the toolkit's knockback has one distance a hazard).
    function pushBands(t, tell, dir, obs, name) {
      const xs = [...new Set([-W, W, ...obs.flatMap(o => [o.x0 - 0.5, o.x1 + 0.5]).filter(x => x > -W && x < W)])].sort((a, b) => a - b);
      const out = [];
      for (let k = 0; k + 1 < xs.length; k++) {
        const xa = xs[k], xb = xs[k + 1];
        if (xb - xa < 0.05) continue;
        const xm = (xa + xb) / 2;
        const bl = obs.filter(o => xm > o.x0 - 0.5 && xm < o.x1 + 0.5).map(o => [Math.max(-L, o.y0), Math.min(L, o.y1)]).sort((a, b) => a[0] - b[0]);
        const segs = [];
        let y = -L;
        for (const [y0, y1] of bl) { if (y0 > y) segs.push([y, y0]); y = Math.max(y, y1); }
        if (y < L) segs.push([y, L]);
        for (const [lo, hi] of segs) {
          if (hi - lo < 2 * STOPM) continue;
          if (dir === 180) {
            const stop = lo + STOPM;
            for (let b0 = stop + 0.5; b0 < hi - 1e-6; b0 += 1) { const b1 = Math.min(hi, b0 + 1), mid = (b0 + b1) / 2; out.push({ y: mid, a: [xa, b0], b: [xb, b1], dist: +(mid - stop).toFixed(2) }); }
          } else {
            const stop = hi - STOPM;
            for (let b1 = stop - 0.5; b1 > lo + 1e-6; b1 -= 1) { const b0 = Math.max(lo, b1 - 1), mid = (b0 + b1) / 2; out.push({ y: mid, a: [xa, b0], b: [xb, b1], dist: +(stop - mid).toFixed(2) }); }
          }
        }
      }
      // The far side's first, so nobody's pushed twice.
      out.sort((a, b) => (dir === 180 ? a.y - b.y : b.y - a.y));
      for (const o of out) hz({ t, tell, effect: 'knockback', dir, shape: 'rect', a: o.a, b: o.b, dist: o.dist, hidden: true, quiet: true, dmg: 0, name, react: 4 });
      hz({ t, tell, effect: 'knockback', dir, at: [0, -2], dist: 0, dmg: 0, quiet: true, name, react: 4 });
    }
    // Where each slot stands before a push: a point clear of what lands first (pre) whose push lands clear of what
    // follows (post); the nearest to its want (byLand: the one whose landing is nearest its spot after, home).
    function pushSpots(wants, dir, obs, pre, post, near, home) {
      const ok = (p) => {
        if (!onFloor(p, obs, 0.9) || pre.some(h => inside(h, p, 1.4)) || (near && !near(p))) return false;
        const q = pushLand(p, dir, obs);
        return onFloor(q, obs, 0.6) && !post.some(h => inside(h, q, 1.8));
      };
      if (!home) return Object.fromEntries(S.map(s => [s, findSpot(wants[s], ok)]));
      const cand = [];
      for (let x = -9.0; x <= 9.01; x += 0.4) for (let y = -13.6; y <= 13.61; y += 0.4) { const p = [x, y]; if (ok(p)) cand.push([p, pushLand(p, dir, obs)]); }
      return Object.fromEntries(S.map(s => {
        let best = null, bs = Infinity;
        for (const [p, q] of cand) { const sc = dist(q, home[s]) + 0.25 * dist(p, wants[s]); if (sc < bs) { bs = sc; best = p; } }
        return [s, best ? r2(best) : r2(wants[s])];
      }));
    }
    // Spots for the stored mechanic each can reach from where its push lands (within R): the strat's where they're near
    // enough, else the nearest that keep a spread 6 apart (or the four partner stacks 11 apart).
    function reachHome(store, want, lands, obs, R) {
      const cand = [];
      for (let x = -9.0; x <= 9.01; x += 0.5) for (let y = -13.6; y <= 13.61; y += 0.5) if (onFloor([x, y], obs, 1.0)) cand.push([x, y]);
      const out = {};
      if (store === 'spread') {
        const order = S.slice().sort((a, b) => dist(lands[b], want[b]) - dist(lands[a], want[a]));
        for (const s of order) {
          let best = null, bs = Infinity;
          for (const c of cand) {
            if (dist(c, lands[s]) > R || Object.values(out).some(q => dist(q, c) < 6.2)) continue;
            const sc = dist(c, want[s]);
            if (sc < bs) { bs = sc; best = c; }
          }
          out[s] = r2(best || want[s]);
        }
        return out;
      }
      const centres = [];
      const order = SUP.slice().sort((a, b) => Math.max(dist(lands[b], want[b]), dist(lands[PARTNER[b]], want[b])) - Math.max(dist(lands[a], want[a]), dist(lands[PARTNER[a]], want[a])));
      for (const s of order) {
        const mate = PARTNER[s];
        let best = null, bs = Infinity;
        for (const c of cand) {
          if (dist(c, lands[s]) > R || dist(c, lands[mate]) > R || centres.some(q => dist(q, c) < 11)) continue;
          const sc = dist(c, want[s]);
          if (sc < bs) { bs = sc; best = c; }
        }
        out[s] = out[mate] = r2(best || want[s]);
        centres.push(out[s]);
      }
      return out;
    }
    // The stored mechanic going off: everyone's spread (Plasma) or the supports' partner stacks (Hyperexplosive).
    function plasma(t, tell, kind) {
      if (kind === 'spread') hz({ t, tell, effect: 'bait', shape: 'circle', r: 5, from: 'target', targets: S.slice(), snap: 0.3, dmg: 0.9, own: 0.25, name: 'Plasma' });
      else hz({ t, tell, effect: 'share', shape: 'circle', r: 5, from: 'target', targets: SUP.slice(), min: 2, max: 2, dmg: 0.5, name: 'Hyperexplosive Plasma' });
    }
    // One Express or Windpipe and the stored mechanic after it. ev: its event (the boss's cast); kind; pre: what lands
    // just before the push (turrets) and must be dodged from the spot it's taken from; wants: where each would like to
    // stand before it (car 1: the strat's slides; else its spot for what's stored).
    function kmSet(ev, kind, store, car, o) {
      o = o || {};
      const tCast = ev.t - (ev.cast || 6), tPush = kind === 'express' ? ev.t : ev.t + 1.0, tAfter = ev.t + (kind === 'express' ? 2.0 : 3.0);
      const plEv = events.find(e => /^(Plasma\/Hyperexplosive Plasma|Hyperexplosive Plasma\/Plasma)$/.test(e.name) && e.t > ev.t + 2 && e.t < ev.t + 8) || null;
      const tPl = plEv ? plEv.t : ev.t + 5.1;
      const obs = obsAt(tPush), dir = kind === 'express' ? 180 : 0;
      const ground = pick([[0, 2], [1, 3]]);
      const post = [];
      if (kind === 'express') {
        const before = P.hazards.length;
        beams(tAfter, tCast + 1, ground, obs, car);
        post.push(...P.hazards.slice(before));
      } else post.push(hz({ t: tAfter, tell: tCast + 1, shape: 'rect', a: [-W, 4.6], b: [W, L], dmg: 1.2, name: "Dead Man's Blastpipe" }));
      pushBands(tPush, tCast, dir, obs, kind === 'express' ? "Dead Man's Express" : "Dead Man's Windpipe");
      let home = nudge(store === 'spread' ? SET.spread : SET.pairs, tPl);
      const wants = o.wants || home;
      let near = null, tLas = 0, reach = 0;
      if (o.pre && o.pre.length) {
        // Turrets just before: the push spot a short run from somewhere out of their lasers.
        tLas = Math.max(...o.pre.map(h => h.t)); reach = 6 * (tPush - tLas) - 1.2;
        const pockets = [];
        for (let x = -9.1; x <= 9.11; x += 0.5) for (let y = -13.7; y <= 13.71; y += 0.5) {
          const p = [x, y];
          if (onFloor(p, obs, 0.9) && !o.pre.some(h => inside(h, p, 1.4))) pockets.push(p);
        }
        near = (p) => pockets.some(q => dist(p, q) <= reach);
      }
      let spots = pushSpots(wants, dir, obs, [], post, near, o.byWant ? null : home);
      // Too far from where the push lands to get there in time: spots nearer.
      const R = 6 * (tPl - tAfter) + (kind === 'express' ? 3 : 6);
      const lands = Object.fromEntries(S.map(s => [s, pushLand(spots[s], dir, obs)]));
      if (S.some(s => dist(lands[s], home[s]) > R)) {
        home = reachHome(store, home, lands, obs, R);
        if (!o.byWant) spots = pushSpots(wants, dir, obs, [], post, near, home);
      }
      if (o.pre && o.pre.length) {
        const pocket = Object.fromEntries(S.map(s => [s, findSpot(spots[s], (p) => onFloor(p, obs, 0.9) && !o.pre.some(h => inside(h, p, 1.4)) && dist(p, spots[s]) <= reach)]));
        pref(o.goT ?? tCast + 0.5, pocket);
        pref(tLas + 0.05, spots);
      } else pref(o.goT ?? tCast + 0.5, spots);
      pref(tPush + 0.1, home);
      plasma(tPl, tCast, store);
      pref(tPl + 0.2, upAt(tPl + 0.2));
      // Labels: the boss's cast, what follows, what goes off.
      const nm = kind === 'express' ? "Dead Man's Express" : "Dead Man's Windpipe";
      label(ev, `${nm} (${kind === 'express' ? 'push south' : 'draw north'})`);
      const fol = events.find(e => /^(Plasma Beam\/Dead Man's Blastpipe|Dead Man's Blastpipe\/Plasma Beam)$/.test(e.name) && e.t > ev.t + 0.5 && e.t < ev.t + 4) || null;
      label(fol, kind === 'express' ? `Plasma Beam (lanes ${ground.map(i => i + 1).join(' and ')})` : "Dead Man's Blastpipe (the north 10 yalms)");
      label(plEv, store === 'spread' ? 'Plasma (spread)' : 'Hyperexplosive Plasma (partner stacks)');
      return { tCast, tPush, tPl, kind, spots };
    }
    const mechText = (kind) => (kind === 'express' ? 'Knockback => Dodge Lasers' : 'Draw In => Away from Front');

    // ===== Car 1 =====
    {
      const evs = EA("Dead Man's Express/Dead Man's Windpipe", 0, 30).concat(EA("Dead Man's Windpipe/Dead Man's Express", 0, 50));
      const od = ods.filter(e => e.t < 50);
      od.forEach((e, k) => {
        const kind = k ? (stored === 'spread' ? 'pairs' : 'spread') : stored;
        call(e.t - 4, `Stored ${storedName(kind)}`, { dur: 4 });
        label(e, `Dead Man's Overdraught (stores ${kind === 'spread' ? 'a spread' : 'partner stacks'})`);
        const km = evs.find(x => x.t > e.t && x.t < e.t + 12);
        if (!km) return;
        const kind2 = k ? 'windpipe' : 'express';
        const r = kmSet(km, kind2, kind, 1, { wants: kind2 === 'express' ? SET.express : SET.windpipe, byWant: true });
        call(r.tCast, `${kind2 === 'express' ? 'Knockback' : 'Draw In'} => ${storedName(kind)}`, { dur: 8, alert: true });
      });
      stored = od.length % 2 ? (stored === 'spread' ? 'pairs' : 'spread') : stored;
    }
    for (const e of ue) { raid(e.t, e.t - 5.9, 0.5, 'Unlimited Express', 'AoE: next car'); label(e, 'Unlimited Express (raidwide: on to the next car)'); }

    // ===== Turrets: six 5-wide lasers across the car, cut short by crates =====
    function electray(t, tell, side, obs, car, set) {
      const out = [];
      for (let j = 0; j < 6; j++) {
        const c = 12.5 - 5 * j, y0 = c - 2.5, y1 = c + 2.5;
        const bl = obs.filter(o => o.kind === 'crate' && Math.min(o.y1, y1) - Math.max(o.y0, y0) > 1);
        let x0 = -W, x1 = W;
        const plat = car === 6 && Math.min(5, y1) - Math.max(-14.5, y0) > 1;
        if (side === 'W') { if (plat) x1 = -5; for (const o of bl) if (o.x0 < x1) x1 = Math.max(-W, Math.min(x1, o.x0)); }
        else { if (plat) x0 = -5; for (const o of bl) if (o.x1 > x0) x0 = Math.min(W, Math.max(x0, o.x1)); }
        if (x1 - x0 < 0.3) continue;
        out.push(hz({ t, tell, shape: 'rect', a: [x0, y0], b: [x1, y1], dmg: 1.2, name: `Electray (${side === 'W' ? 'west' : 'east'} turrets)` }));
      }
      return out;
    }
    // Where to stand for the turrets: the nearest spot to each want out of the lasers.
    const losSpots = (wants, shapes, obs) => Object.fromEntries(S.map(s => [s, findSpot(wants[s], (p) => onFloor(p, obs, 0.9) && !shapes.some(h => inside(h, p, 1.4)))]));
    const sideName = (sd) => (sd === 'W' ? 'West' : 'East');

    // ===== Car 2 =====
    {
      const t0 = T.c2, t1 = T.c3;
      stored = pick(['spread', 'pairs']);
      pref(t0 + 0.5, upAt(t0 + 0.5));
      const els = EA('Electray', t0, t1), od = ods.filter(e => e.t > t0 && e.t < t1);
      const kms = EA("Dead Man's Express/Dead Man's Windpipe", t0, t1).concat(EA("Dead Man's Windpipe/Dead Man's Express", t0, t1)).sort((a, b) => a.t - b.t);
      const sides = [firstSide[2], firstSide[2] === 'W' ? 'E' : 'W', firstSide[2]];
      const lasers = els.map((e, k) => {
        const obs = obsAt(e.t), sh = electray(e.t, e.t - 7, sides[k], obs, 2, k);
        label(e, `Electray (${sideName(sides[k]).toLowerCase()} turrets)`);
        return { e, sh, side: sides[k], obs };
      });
      const tc = E('Turret Crossing', t0, t1);
      label(tc, `Turret Crossing (${sideName(sides[0]).toLowerCase()} first)`);
      od.forEach((e, k) => {
        const kind = k ? (stored === 'spread' ? 'pairs' : 'spread') : stored;
        call(e.t - 4, `Stored ${storedName(kind)}`, { dur: 4 });
        label(e, `Dead Man's Overdraught (stores ${kind === 'spread' ? 'a spread' : 'partner stacks'})`);
        const km = kms.find(x => x.t > e.t && x.t < e.t + 25);
        if (!km) return;
        const kind2 = k ? (kmOrder[2] === 'express' ? 'windpipe' : 'express') : kmOrder[2];
        const las = lasers.filter(l => l.e.t <= km.t + 1.2 && l.e.t > km.t - 4);
        const pre = las.flatMap(l => l.sh);
        // Out of the turrets' lasers, where the push takes you near your spot for what's stored.
        const home = nudge(kind === 'spread' ? SET.spread : SET.pairs, km.t + 5);
        const r = kmSet(km, kind2, kind, 2, { pre, goT: las.length ? las[0].e.t - 6.5 : undefined, wants: home });
        const losTxt = las.length ? `LoS ${sideName(las[0].side)} => ` : '';
        call(r.tCast, `${losTxt}${mechText(kind2)} => ${storedName(kind)}`, { dur: 11, alert: true });
      });
      if (od.length % 2) stored = stored === 'spread' ? 'pairs' : 'spread';
      // The middle set of turrets and Lightning Burst after it.
      const lb = E('Lightning Burst', t0, t1), mid = lasers.find(l => lb && l.e.t < lb.t && l.e.t > lb.t - 6);
      if (mid) {
        pref(mid.e.t - 6.5, losSpots(upAt(mid.e.t), mid.sh, mid.obs));
        call(mid.e.t - 6.5, `LoS ${sideName(mid.side)} => Tankbusters`, { dur: 9, alert: true });
      }
      if (lb) tankBuster(lb, mid ? mid.e.t + 0.05 : lb.t - 5);
    }

    // ===== Lightning Burst: a tank buster on each tank =====
    function tankBuster(ev, goT) {
      const tHit = ev.t + 0.4, tl = ev.t - 5;
      hz({ t: tHit, tell: tl, effect: 'bait', shape: 'circle', r: 5, from: 'target', targets: TANKS.slice(), snap: 0.5, dmg: 1.6, own: 0.55, buster: true, name: 'Lightning Burst' });
      const spots = nudge(Object.assign({}, UP, { MT: [-7.5, 10.5], OT: [7.5, 10.5], M1: [-1.5, 3.5], M2: [1.5, 3.5], R1: [-3, -2], R2: [3, -2], H1: [-1.5, -1], H2: [1.5, -1] }), tHit);
      // Keep everyone else 6 clear of the tanks.
      for (const s of S) if (!TANKS.includes(s)) spots[s] = findSpot(spots[s], (p) => onFloor(p, obsAt(tHit), 1.0) && TANKS.every(k => dist(p, spots[k]) > 6.5));
      pref(Math.max(goT, tl), spots);
      pref(tHit + 0.2, upAt(tHit + 0.2));
      for (const s of TANKS) call(tl, 'Tank Buster on YOU', { slot: s, alert: true, dur: 5 });
      for (const s of S) if (!TANKS.includes(s)) call(tl, 'Tank Busters', { slot: s, dur: 4 });
      label(ev, 'Lightning Burst (tank busters)');
    }

    // ===== Car 3, Runaway Train =====
    {
      pref(T.c3 + 0.5, upAt(T.c3 + 0.5));
      const lb = E('Lightning Burst', T.c3, T.int);
      if (lb) tankBuster(lb, lb.t - 5);
      if (rtStart) { label(rtStart, 'Runaway Train (to the Aether)'); call(rtStart.t - 5, 'Runaway Train: kill the Aether', { dur: 5 }); }
      const ov = E('Overdraught', 150, 160);
      label(ov, 'Overdraught (the Aether)');
    }

    // ===== The Aether's arena: the Ghost Train's cones on the tanks, stacks or spreads =====
    {
      const rays = EA('Aetherial Ray', 160, 240), mechs = EA('Aetherochar/Aetherosote', 160, 240);
      const R = RUN[st.runaway] || RUN.alt;
      pref(T.int + 0.5, UP_INT);
      // The Ghost Train circles 25 out: where it fires from each round, and the turn it makes from the horn to then.
      const path = [];
      let prevDeg = Math.random() * 360, prevT = T.int;
      path.push({ t: +prevT.toFixed(2), at: r2(at(prevDeg, 25)) });
      rays.forEach((ray, k) => {
        const g = Math.floor(Math.random() * 16) * 22.5, spin = pick([170, 106]), horn = ray.t - 9.7;
        const src = r2(at(g, 25)), stacks = Math.random() < 0.5;
        // The train runs on to where it'll fire: round the circle from where it was to the horn, then the turn.
        const hornDeg = g + spin;
        for (let u = prevT + 1; u < horn; u += 1) path.push({ t: +u.toFixed(2), at: r2(at(prevDeg + (deg360(hornDeg - prevDeg)) * (u - prevT) / (horn - prevT), 25)), move: 1 });
        for (let u = Math.max(horn, prevT + 0.5); u <= ray.t + 1e-6; u += 1) path.push({ t: +u.toFixed(2), at: r2(at(hornDeg - spin * Math.min(1, (u - horn) / 9.7), 25)), move: 1 });
        prevDeg = g; prevT = ray.t;
        hz({ t: ray.t, tell: ray.t - 7.8, effect: 'bait', shape: 'cone', from: src, aim: 'target', targets: TANKS.slice(), half: 17.5, r: 50, snap: 0.6, dmg: 1.6, own: 0.55, buster: true, name: 'Aetherial Ray' });
        const m = mechs.find(x => Math.abs(x.t - ray.t) < 1.5) || { t: ray.t - 0.1 };
        if (stacks) hz({ t: m.t, tell: m.t - 6.5, effect: 'share', shape: 'circle', r: 6, from: 'target', targets: HEALERS.slice(), min: 3, max: 3, dmg: 0.5, name: 'Aetherosote' });
        else hz({ t: m.t, tell: m.t - 6.5, effect: 'bait', shape: 'circle', r: 6, from: 'target', targets: [...HEALERS, ...DPS], snap: 0.3, dmg: 0.9, own: 0.3, name: 'Aetherochar' });
        const frame = stacks ? R.stacks : R.spreads;
        const spots = Object.fromEntries(TANKS.map(s => [s, findSpot(rot(frame[s], g), (p) => len(p) < 13.6)]));
        // Clear of the tanks' cones (the train fires from 25 out).
        const cones = TANKS.map(s => ({ shape: 'cone', at: src, deg: brg([spots[s][0] - src[0], spots[s][1] - src[1]]), half: 17.5, r: 50 }));
        for (const s of S) if (!TANKS.includes(s)) spots[s] = findSpot(rot(frame[s], g), (p) => len(p) < 13.6 && !cones.some(c => inside(c, p, 1.5)));
        pref(ray.t - 8.5, spots);
        pref(ray.t + 0.2, UP_INT);
        call(ray.t - 8.5, `Train cleaves from ${dir16(g)}`, { dur: 3 });
        for (const s of S) call(ray.t - 6.5, TANKS.includes(s) ? 'Train ' + dir16(g) + ', Tank Cleave on YOU' : `Train ${dir16(g)}, ${stacks ? 'Healer Groups' : 'Spread'}`, { slot: s, dur: 6.5, alert: TANKS.includes(s) });
        label(ray, `Aetherial Ray (from the ${dir16(g)})`);
        if (mechs.includes(m)) label(m, stacks ? 'Aetherosote (healer stacks)' : 'Aetherochar (spreads)');
      });
      P.others.push({ model: 'ghost', path, shows: [[T.int, 240]], face: [0, 0] });
    }

    // ===== Car 3, again: the towers and the launchpad =====
    if (rtEnd) { raid(rtEnd.t, rtEnd.t - 5, 0.5, 'Runaway Train', 'AoE'); label(rtEnd, 'Runaway Train (raidwide: back to car 3)'); pref(T.back + 0.1, upAt(T.back + 0.2)); }
    const sw = E('Shockwave', 500, 600);
    if (sw) { raid(sw.t, sw.t - 5.7, 0.5, 'Shockwave', 'AoE'); label(sw, 'Shockwave (raidwide)'); }
    const lb3 = E('Lightning Burst', 520, 560);
    if (lb3) tankBuster(lb3, lb3.t - 5);
    // Derailment Siege: a tower everyone soaks, hit n times and once more, hard; then Derail hits the car but the
    // launchpad at its south end.
    function siege(ev, de, last) {
      const n = parseInt((ev.name.match(/x(\d+)/) || [])[1], 10) || 3, tw = [0, 10];
      const tFinal = ev.t + n + 1.0, tl = ev.t - 6;
      for (let i = 0; i < n; i++) hz({ t: +(ev.t + 1.1 + i).toFixed(2), tell: i ? ev.t + 0.1 + i : tl, effect: 'tower', shape: 'circle', at: tw, r: 5, soak: [4, 8], dmg: 0.12, fail: 0.9, name: 'Derailment Siege' });
      hz({ t: tFinal, tell: ev.t + n, effect: 'tower', shape: 'circle', at: tw, r: 5, soak: [4, 8], dmg: 0.35, fail: 1.2, name: 'Derailment Siege (the last hit)' });
      pref(tl + 0.5, Object.fromEntries(S.map((s, i) => [s, r2(add(tw, i ? at(i * 360 / 7, 1.6) : [0, 0]))])));
      call(tl, last ? `Tower x${n} => Enrage` : `Tower x${n} => Next Platform`, { dur: 12, alert: true });
      label(ev, `Derailment Siege x${n} (everyone in the tower)`);
      if (!de || last) return;
      mark({ shape: 'circle', at: PAD, r: 2 }, tl, de.t + 0.4, 'rgba(90,230,255,0.55)');
      hz({ t: de.t, tell: tFinal + 0.2, shape: 'donut', at: PAD, r0: 2, dmg: 9, name: 'Derail' });
      pref(tFinal + 0.1, all(PAD));
      call(tFinal + 0.1, 'Launchpad: south end', { dur: 4, alert: true });
      label(de, 'Derail (everything but the launchpad)');
      pref(de.t + 0.7, upAt(de.t + 0.7));
    }
    const sieges = events.filter(e => e.name.startsWith('Derailment Siege'));
    sieges.forEach((ev, k) => siege(ev, derails.find(d => d.t > ev.t && d.t < ev.t + 20), k === sieges.length - 1));

    // ===== Thunderous Breath / Headlight: the ground and the platforms, one then the other =====
    function highLow(e1, e2) {
      const car = carAt(e1.t), plats = PLAT[car] || [];
      const groundFirst = Math.random() < 0.5, t1 = e1.t, t2 = e2 ? e2.t : e1.t + 2.4, tl = t1 - 6;
      const ground = gridRects(plats), air = plats.map(p => ({ shape: 'rect', a: [p.x0, p.y0], b: [p.x1, p.y1] }));
      const hit = (t, shapes, nm, tell) => shapes.forEach(sh => hz(Object.assign({ t, tell, dmg: 1.2, name: nm }, sh)));
      hit(t1, groundFirst ? ground : air, groundFirst ? 'Thunderous Breath (the ground)' : 'Headlight (the platforms)', tl);
      hit(t2, groundFirst ? air : ground, groundFirst ? 'Headlight (the platforms)' : 'Thunderous Breath (the ground)', t1);
      // Up: on the platform; down: beside it.
      const upSpot = car === 4 ? [7.5, 1.0] : [-7.5, 0.5], downSpot = car === 4 ? [3.0, 2.5] : [-2.6, 1.5];
      const ring = (c, rr) => Object.fromEntries(S.map((s, i) => [s, r2(add(c, i ? at(i * 360 / 7, rr) : [0, 0]))]));
      const first = groundFirst ? ring(upSpot, 1.1) : ring(downSpot, 1.1), second = groundFirst ? ring(downSpot, 1.1) : ring(upSpot, 1.1);
      pref(tl + 0.5, first);
      pref(t1 + 0.05, second);
      pref(t2 + 0.2, upAt(t2 + 0.2));
      call(tl, groundFirst ? 'Up => Down' : 'Down => Up', { dur: 9.6, alert: true });
      label(e1, groundFirst ? 'Thunderous Breath (the ground)' : 'Headlight (the platforms)');
      label(e2, groundFirst ? 'Headlight (the platforms)' : 'Thunderous Breath (the ground)');
    }
    for (const e1 of events.filter(e => /^(Thunderous Breath\/Headlight|Headlight\/Thunderous Breath)$/.test(e.name) && e.t > 500)) {
      if (P.labels.has(e1)) continue;
      const e2 = events.find(e => e !== e1 && /^(Thunderous Breath\/Headlight|Headlight\/Thunderous Breath)$/.test(e.name) && e.t > e1.t && e.t < e1.t + 4);
      highLow(e1, e2);
    }

    // ===== Arcane Revelation: Hail of Thunder round the car, the tank's and the healer's stacks =====
    const HAIL = [[0, 10], [4.8, 0], [0, -10], [-4.8, 0]];            // north, east, south, west (clockwise)
    const HAIL_NAME = ['north', 'east', 'south', 'west'];
    // Normal: each group where Hector's slides put it for that point (car 4); car 6's worked out the same way.
    const AR_SPOTS = {
      4: { 0: { tm: [9.2, -5.0], hr: [-8.8, -12.8] }, 2: { tm: [8.8, 13.4], hr: [-8.4, 12.0] }, 3: { tm: [8.4, 13.4], hr: [8.4, -12.4] }, 1: { tm: [-7.9, 13.4], hr: [-8.6, -12.8] } },
      6: { 0: { tm: [8.6, -13.0], hr: [-8.4, -12.8] }, 2: { tm: [8.6, 13.4], hr: [-8.4, 12.6] }, 3: { tm: [8.4, 13.4], hr: [8.4, -12.6] }, 1: { tm: [-7.0, 13.4], hr: [-8.4, -12.8] } },
    };
    for (const ar of EA('Arcane Revelation', 500, 950)) {
      const car = carAt(ar.t), hails = EA('Hail of Thunder', ar.t, ar.t + 45), stacksEv = EA('Hyperconductive Plasma', ar.t, ar.t + 45);
      const tank = pick(TANKS), healer = pick(HEALERS), cheese = st.arcane === 'cheese';
      let pos = 0;
      const tm = ['MT', 'OT', 'M1', 'M2'], hr = ['H1', 'H2', 'R1', 'R2'];
      call(ar.t - 2, `Arcane Revelation: stacks on ${tank} and ${healer}`, { dur: 5 });
      label(ar, `Arcane Revelation (stacks on ${tank} and ${healer})`);
      hails.forEach((h, k) => {
        const step = pick([2, 3, 4]), dirn = step === 3 ? pick([1, -1]) : 1;
        pos = (pos + (step === 3 ? dirn : step === 2 ? 2 : 0) + 4) % 4;
        const c = HAIL[pos], told = h.t - (step === 2 ? 7.5 : step === 3 ? 10.5 : 13.4);
        const prevHit = k ? hails[k - 1].t : ar.t;
        const tell = Math.max(told, prevHit + 0.2);
        hz({ t: h.t, tell, shape: 'circle', at: c, r: 16, dmg: 0.55, aimed: cheese, name: 'Hail of Thunder' });
        // The stacks: the tank's on tanks and melee, the healer's on healers and ranged (the cheese: tanks alone).
        const ts = stacksEv.find(x => Math.abs(x.t - h.t) < 1) || h;
        hz({ t: ts.t + 0.05, tell, effect: 'share', shape: 'circle', r: 13, from: 'target', targets: [tank], min: cheese ? 2 : 3, max: 4, dmg: 0.5, name: 'Hyperconductive Plasma' });
        hz({ t: ts.t + 0.05, tell, effect: 'share', shape: 'circle', r: 13, from: 'target', targets: [healer], min: 3, max: cheese ? 6 : 4, dmg: 0.5, name: 'Hyperconductive Plasma' });
        let spots;
        if (cheese) {
          const nw = [-8.4, 12.8], ne = [8.4, 12.8];
          spots = Object.fromEntries(S.map((s, i) => [s, r2(add(TANKS.includes(s) ? nw : ne, at(i * 51, TANKS.includes(s) ? 0.6 : 1.2)))]));
        } else {
          const g = (AR_SPOTS[car] || AR_SPOTS[4])[pos];
          spots = Object.fromEntries(S.map((s, i) => [s, r2(add(tm.includes(s) ? g.tm : g.hr, at(i * 90 + 45, 0.9)))]));
        }
        pref(Math.max(tell, prevHit + 0.2), nudge(spots, h.t, 0.8));
        const safe = ['back', 'left', 'front', 'right'][pos];
        call(tell, cheese ? `Hail ${HAIL_NAME[pos]} (${step} steps): tanks north-west, party north-east` : `${safe[0].toUpperCase() + safe.slice(1)} Safe + Stacks (Hail ${HAIL_NAME[pos]})`, { dur: Math.min(8, h.t - tell), alert: true });
        label(h, `Hail of Thunder (${step} steps: ${HAIL_NAME[pos]})`);
        label(ts !== h ? ts : null, `Hyperconductive Plasma (on ${tank} and ${healer})`);
      });
      const lastH = hails[hails.length - 1];
      if (lastH) pref(lastH.t + 0.3, upAt(lastH.t + 0.3));
    }

    // ===== Psychokinesis: Plummet's 8-yalm spreads =====
    {
      const ps = EA('Psychokinesis', 680, 820), counts = [2, 3, 5, 4];
      ps.forEach((ev, k) => {
        const pl = E('Plummet', ev.t, ev.t + 3), tHit = pl ? pl.t : ev.t + 1, tl = ev.t - 7, n = counts[k] || 3;
        const targets = shuffle(S).slice(0, n);
        hz({ t: tHit, tell: tl + 3, effect: 'bait', shape: 'circle', r: 8, from: 'target', targets, snap: 0.4, dmg: 1.0, own: 0.4, name: 'Plummet' });
        const obs = obsAt(tHit), mir = (o) => Object.fromEntries(Object.entries(o).map(([s, p]) => [s, [-p[0], p[1]]]));
        let spots;
        if (n >= 4) spots = nudgeAll(n === 5 ? (mirror5 ? SET.big5 : mir(SET.big5)) : SET.big, obs, 0.6);
        else {
          // The targets to far corners, everyone else together away from them.
          const drops = n === 2 ? [[-8.4, 12.8], [8.4, 12.8]] : [[-8.4, 12.8], [8.4, 12.8], [8.4, -12.8]];
          const clump = n === 2 ? [0, -12.6] : [-8.2, -12.6];
          spots = {};
          targets.forEach((s, i) => { spots[s] = findSpot(drops[i], (p) => onFloor(p, obs, 1.0)); });
          const rest = S.filter(s => !targets.includes(s));
          rest.forEach((s, i) => { spots[s] = findSpot(add(clump, i ? at(i * 72, 1.0) : [0, 0]), (p) => onFloor(p, obs, 1.0)); });
        }
        pref(tl + 3.2, spots);
        pref(tHit + 0.2, upAt(tHit + 0.2));
        const after = k === 1 ? 'Tankbusters' : 'Bait Puddles';
        call(tl, `Spread AoEs => ${after}`, { dur: 7 });
        for (const s of targets) call(tl + 3, 'Plummet on YOU: out', { slot: s, alert: true, dur: 5 });
        label(ev, `Psychokinesis (${n} spreads)`);
        label(pl, `Plummet (on ${targets.join(', ')})`);
      });
    }
    {
      const lb5 = EA('Lightning Burst', 650, 950);
      for (const lb of lb5) tankBuster(lb, lb.t - 5);
    }

    // ===== Car 6 =====
    {
      const t0 = T.c6, t1 = 960;
      stored = pick(['spread', 'pairs']);
      const els = EA('Electray', t0, t1), od = ods.filter(e => e.t > t0);
      const kms = EA("Dead Man's Express/Dead Man's Windpipe", t0, t1).concat(EA("Dead Man's Windpipe/Dead Man's Express", t0, t1)).sort((a, b) => a.t - b.t);
      const sides = [firstSide[6], pick(['W', 'E']), pick(['W', 'E'])];
      const lasers = els.map((e, k) => {
        const obs = obsAt(e.t), sh = electray(e.t, e.t - 7, sides[k], obs, 6, k);
        label(e, `Electray (${sideName(sides[k]).toLowerCase()} turrets)`);
        return { e, sh, side: sides[k], obs };
      });
      const tc = E('Turret Crossing', t0, t1);
      label(tc, `Turret Crossing (${sideName(sides[0]).toLowerCase()} first)`);
      lasers.forEach((l, k) => {
        // Out of the lasers: behind a crate (the first), or up on the platform from the east, down from the west (an
        // Express or Windpipe just after takes its spots from them itself).
        const want = k === 0 ? upAt(l.e.t) : l.side === 'E'
          ? Object.fromEntries(S.map((s, i) => [s, r2(add([-7.5, -6], at(i * 51, 1.4)))])) : upAt(l.e.t);
        const busy = P.prefs.filter(p => p.t > l.e.t - 7 && p.t < l.e.t);
        const km = kms.find(x => x.t >= l.e.t - 1 && x.t < l.e.t + 4);
        if (!busy.length && !km) { pref(l.e.t - 6.5, losSpots(want, l.sh, l.obs)); pref(l.e.t + 0.1, upAt(l.e.t + 0.1)); }
        call(l.e.t - 6.7, k === 0 ? `LoS ${sideName(l.side)}` : l.side === 'E' ? 'Up (dodge turrets)' : 'Down (dodge turrets)', { dur: 6.7, alert: true });
      });
      od.forEach((e, k) => {
        const kind = k ? (stored === 'spread' ? 'pairs' : 'spread') : stored;
        call(e.t - 4, `Stored ${storedName(kind)}`, { dur: 4 });
        label(e, `Dead Man's Overdraught (stores ${kind === 'spread' ? 'a spread' : 'partner stacks'})`);
        const km = kms.find(x => x.t > e.t && x.t < e.t + 50);
        if (!km) return;
        const kind2 = k ? (kmOrder[6] === 'express' ? 'windpipe' : 'express') : kmOrder[6];
        const las = lasers.filter(l => l.e.t <= km.t + 1.2 && l.e.t > km.t - 4);
        const pre = las.flatMap(l => l.sh);
        const home = nudge(kind === 'spread' ? SET.spread : SET.pairs, km.t + 5);
        const r = kmSet(km, kind2, kind, 6, { pre, goT: las.length ? las[0].e.t - 6.5 : undefined, wants: home });
        call(r.tCast, `${mechText(kind2)} => ${storedName(kind)}`, { dur: 11, alert: true });
      });
    }

    // ===== Third Rail: a puddle under everyone, then out =====
    for (const ev of EA('Third Rail (bait)', 500, 950)) {
      const det = E('Third Rail (detonate)', ev.t, ev.t + 6), tDet = det ? det.t : ev.t + 4;
      const car = carAt(ev.t), clump = car === 5 ? [0, 12.4] : car === 6 ? [-1.5, 7.5] : [2, 6.2];
      // Gathered once whatever's landing just before is done.
      const busy = P.hazards.filter(h => !h.hidden && !h.raidwide && h.t > ev.t - 3.5 && h.t <= ev.t + 0.6).map(h => h.t);
      let goT = Math.max(ev.t - 3, ...busy.map(t => t + 0.1));
      // After whatever sends the party back to its places meanwhile.
      goT = Math.max(goT, ...P.prefs.filter(p => p.t >= goT && p.t <= ev.t + 0.5).map(p => p.t + 0.01));
      pref(goT, nudge(Object.fromEntries(S.map((s, i) => [s, r2(add(clump, i ? at(i * 360 / 7, 1.0) : [0, 0]))])), ev.t));
      hz({ t: tDet, tell: ev.t - 0.5, shape: 'circle', r: 4, from: 'target', targets: S.slice(), snap: tDet - ev.t - 1.0, dmg: 0.8, name: 'Third Rail' });
      call(ev.t - 2, 'Bait Puddles', { dur: 2 });
      call(ev.t + 1.0, 'Move Away', { alert: true, dur: 3 });
      pref(tDet + 0.2, upAt(tDet + 0.2));
      label(ev, 'Third Rail (puddles under everyone)');
      label(det, 'Third Rail (the puddles go off)');
    }

    // ===== Derail (enrage) =====
    const enr = events.find(e => e.kind === 'enrage');
    if (enr) { label(enr, 'Derail (enrage)'); call(enr.t - 15, 'Derail: the enrage', { dur: 6, alert: true }); }

    P.prefs.sort((a, b) => a.t - b.t);
    P.looks.sort((a, b) => a.t - b.t);
    P.arena.sort((a, b) => a.t - b.t);
    return P;
  }

  B.FIGHT_SCRIPTS = B.FIGHT_SCRIPTS || {};
  B.FIGHT_SCRIPTS.ex7 = {
    // FFLogs' max HP in a kill (report ghQ7pNK962Acb8DP): Doomtrain 98,895,160; the Aether 9,358,510.
    hp: 98895160,
    // The Aether: it takes all the party's damage while it's up; killing it goes on to car 3 (cactbot's timeline
    // picks up at 500 s), and so does its time running out (with Runaway Train's enrage).
    adds: [{ from: 159.8, to: 234.8, hp: 9358510, share: 1, name: 'Aether' }],
    pushes: [
      { from: 159.8, to: 500, adds: 0, name: 'The Aether is down' },
      { from: 234.8, to: 500, dealt: 0, name: "The Aether's time is up" },
    ],
    defaultStrat: 'hector',
    strats: {
      hector: { label: 'Hector (NA)' },
      game8: { label: 'Game8 (JP)' },
    },
    source: 'wtfdig.info/74/ex7; mechanics after BossMod (github.com/awgil/ffxiv_bossmod) and an FFLogs kill',
    // A north, B east, C south, D west on the car; 1-4 its corners (1 north-west, then clockwise).
    waymarks: [
      { label: 'A', at: [0, 12.5], color: 'red' }, { label: 'B', at: [8.5, 0], color: 'yellow' },
      { label: 'C', at: [0, -12.5], color: 'blue' }, { label: 'D', at: [-8.5, 0], color: 'purple' },
      { label: '1', at: [-8.5, 12.5], color: 'red', square: true }, { label: '2', at: [8.5, 12.5], color: 'yellow', square: true },
      { label: '3', at: [8.5, -12.5], color: 'blue', square: true }, { label: '4', at: [-8.5, -12.5], color: 'purple', square: true },
    ],
    plan,
  };
})(window.BLM);
