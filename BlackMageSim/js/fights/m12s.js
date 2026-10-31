// M12S, AAC Heavyweight M4 (Savage): the Lindwurm's mechanics for the sim's party, on cactbot's timeline, and the strats
// wtfdig.info lists for the fight: Modified (pastebin 3VJ0, NA: Role Mortal Slayer, DN Replication 1, Clone Zone
// Replication 2, DN Idyllic Dream) and Caro/Zenith (a3V, EU: Toxic Mortal Slayer, Caro Replication 1, Clone Zone, Caro
// Idyllic Dream). Spots are [east, north] yalms from the arena's middle.
//
// One duty, two phases (BossMod's RM12S1TheLindwurm and RM12S2TheLindwurm share the duty, CFC 1075; the second is a
// checkpoint you restart from): phase 1 the Lindwurm (R13.8) at the north edge of a 40 x 30 arena, phase 2 its second
// form (R5) in a round arena of radius 20. cactbot's timeline is read along its main line (the zone's "branches":
// "main": each Slaughtershed's arms as its generic lines, which the script picks per pull), but it still puts phase 2
// in a block of its own some 900 s on: the script's `pushes` skip that gap (a push with nothing to deal is the
// timeline's own jump), and phase 1 ends when its HP does.
//
// The mechanics follow BossMod's modules (github.com/awgil/ffxiv_bossmod), whose shapes and sizes come from the
// game's Action sheet, built with the sim's toolkit (js/mech.js):
//   Phase 1:
//   - Mortal Slayer: eight orbs in pairs; each hits the player nearest the boss on its side (6-yalm circle; the
//     purple ones are tank busters). Role: supports on the purple side; Toxic: a conga line H1-M1-R1-R2-M2-H2.
//   - Grotesquerie Act 1: four puddles baited on the party from marker 1 toward A, Ravenous Reach's 120-degree cone over
//     half the room, then each player's directed cone (pointed out of the arena), spreads on one role and a stack on
//     the other; Burst's five 12-yalm blobs (two patterns from cactbot) with a shared tank buster and a six-stack.
//   - Act 2: the four fixed blob puddles, the coil (a 9-14 donut with a 45-degree gap turning 90 degrees a hit, five
//     seconds apart), everyone drawn in and bound; four pairs chained (alpha out through the gap, beta in), each
//     break leaving a chain tower, the blob towers soaked III-IV-I-II, Constrictor's 13-yalm circle at the end.
//   - Act 3: the floor falls (Bring Down the House) to four platforms on the cardinals or intercards, one support
//     and one DPS each; 9-yalm spreads and the towers each player projects across; Split Scourge's lines at the tanks
//     and Venomous Scourge's spreads on the three furthest west and east.
//   - Curtain Call: the old platforms fall instead; five puddles, Ravenous Reach (Rotting Flesh must stand in it,
//     Bursting must not), chains broken supports west / DPS east, Burst's blobs (two patterns) to safe corners.
//   - Slaughtershed x3: stack and spreads in the north corners (the Burst pattern decides which), then Serpentine
//     Scourge (half-room cleaves) or Raptor Knuckles (30-yalm knockbacks from the north corners), picked each time.
//   Phase 2:
//   - Replication 1: four clones; one pair cleaves (front and back), one baits Top-tier Slam (a pair stack on the
//     nearest) and one Mighty Magic (spreads on the two nearest); then eight clones in two lines.
//   - Double Sobat: a half-room buster at the main tank, the turn and a second half-room cleave, Esoteric Finisher.
//   - Replication 2 (Clone Zone): each player's clone spot gives a tether: the boss (it leaps there, then proteans),
//     cleaves, stacks, defamations; the Reenactment replays them from the clones' spots in their order, with
//     Netherwrath's close or far pair stacks.
//   - Blood Mana: alpha/beta mutations, the black holes' stored shapes replayed in two waves, Netherworld's stack.
//   - Idyllic Dream: stored Power Gusher / Snaking Kick, the two platforms (spreads, towers), the clones' stacks and
//     defamations, the Reenactment's defamations and towers, Arcadian Hell.
// Simplified: the coil is only dangerous as it hits (the bots may cross it between hits); directed cones point out
// of the arena from each player's spot (the game aims them by your facing); Bloody Burst, the platforms' tower
// side effects (Dark II lines, Stone III, Thunder II, Doom) and Idyllic Dream's clone tethers are reduced to what
// the party must stand in or out of; where wtfdig gives no diagram, the spots are this script's own.
(function (B) {
  const S = B.SLOTS;
  const all = (f) => Object.fromEntries(S.map(s => [s, f(s)]));
  const at = B.bearing;
  const inside = B.mechInside;
  const add = (a, b) => [a[0] + b[0], a[1] + b[1]];
  const mul = (a, k) => [a[0] * k, a[1] * k];
  const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);
  const deg360 = (d) => ((d % 360) + 360) % 360;
  const pick = (a) => a[Math.floor(Math.random() * a.length)];
  const shuffle = (a) => { const b = a.slice(); for (let i = b.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [b[i], b[j]] = [b[j], b[i]]; } return b; };
  const unit = (v) => { const l = Math.hypot(v[0], v[1]) || 1; return [v[0] / l, v[1] / l]; };
  const SUP = ['MT', 'OT', 'H1', 'H2'], DPS = ['M1', 'M2', 'R1', 'R2'], TANKS = ['MT', 'OT'];
  const G1 = ['MT', 'H1', 'M1', 'R1'], G2 = ['OT', 'H2', 'M2', 'R2'];
  const COMPASS = ['north', 'north-northeast', 'northeast', 'east-northeast', 'east', 'east-southeast', 'southeast', 'south-southeast',
    'south', 'south-southwest', 'southwest', 'west-southwest', 'west', 'west-northwest', 'northwest', 'north-northwest'];
  const dirName = (deg) => COMPASS[Math.round(deg360(deg) / 22.5) % 16];
  const r2 = (p) => [+p[0].toFixed(2), +p[1].toFixed(2)];

  // ---------- the floors ----------
  const RECT = { shape: 'rect', a: [-20, -15], b: [20, 15], deathwall: true };
  const sq = (c) => ({ shape: 'rect', a: [c[0] - 5, c[1] - 5], b: [c[0] + 5, c[1] + 5] });
  // Act 3's platforms (BossMod's: 10 x 10 squares), on the cardinals or the intercards; Curtain Call's floor is the
  // room without them (parts that overlap, so no seam is an edge).
  const PLAT = { card: { W: [-15, 0], N: [0, 10], E: [15, 0], S: [0, -10] }, inter: { NW: [-15, 10], NE: [15, 10], SE: [15, -10], SW: [-15, -10] } };
  const PLATFORMS = (k) => ({ parts: Object.values(PLAT[k]).map(sq), deathwall: true });
  const HOLED = {
    card: { parts: [{ shape: 'rect', a: [-20, 5], b: [-5, 15] }, { shape: 'rect', a: [5, 5], b: [20, 15] }, { shape: 'rect', a: [-20, -15], b: [-5, -5] },
      { shape: 'rect', a: [5, -15], b: [20, -5] }, { shape: 'rect', a: [-10, -5], b: [10, 5] }, { shape: 'rect', a: [-10, -15], b: [-5, 15] },
      { shape: 'rect', a: [5, -15], b: [10, 15] }], deathwall: true },
    inter: { parts: [{ shape: 'rect', a: [-10, -15], b: [10, 15] }, { shape: 'rect', a: [-20, -5], b: [20, 5] }], deathwall: true },
  };
  // Where Bring Down the House drops the floor (the rest of the room).
  const FALL = {
    card: [{ a: [-20, 5], b: [-5, 15] }, { a: [-20, -15], b: [-5, -5] }, { a: [5, 5], b: [20, 15] }, { a: [5, -15], b: [20, -5] }, { a: [-10, -5], b: [10, 5] }],
    inter: [{ a: [-10, 5], b: [10, 15] }, { a: [-20, -5], b: [0, 5] }, { a: [0, -5], b: [20, 5] }, { a: [-10, -15], b: [10, -5] }],
  };
  const CIRCLE = { shape: 'circle', at: [0, 0], r: 20, deathwall: true };
  const P2PLAT = { parts: [{ shape: 'circle', at: [-14, 0], r: 10 }, { shape: 'circle', at: [14, 0], r: 10 }], deathwall: true };
  const onShape = (s, p, m) => {
    if (s.shape === 'circle') return dist(p, s.at || [0, 0]) < s.r - m;
    if (s.shape === 'rect') return p[0] > Math.min(s.a[0], s.b[0]) + m && p[0] < Math.max(s.a[0], s.b[0]) - m && p[1] > Math.min(s.a[1], s.b[1]) + m && p[1] < Math.max(s.a[1], s.b[1]) - m;
    return Math.abs(p[0]) < 20 - m && Math.abs(p[1]) < 20 - m;
  };
  const floorOf = (a, m) => (p) => (a.parts || [a]).some(s => onShape(s, p, m === undefined ? 0.9 : m));

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
  // n points (pairwise >= sep) satisfying ok, nearest `anchor` first; `keep` are points to stay sep from too.
  function spreadIn(n, ok, anchor, sep, keep, step, within) {
    const cand = [], g = step || 0.4;
    for (let x = -19.6; x <= 19.6 + 1e-9; x += g) for (let y = -19.6; y <= 19.6 + 1e-9; y += g) if (ok([x, y])) cand.push([x, y]);
    cand.sort((a, b) => dist(a, anchor) - dist(b, anchor));
    const have = (keep || []).slice();
    // Within `within` of the anchor: a search for n that fit (the first that do, nearest first); else greedily.
    if (within) {
      const near = cand.filter(c => dist(c, anchor) <= within && have.every(p => dist(p, c) >= sep)).slice(0, 500), got = [];
      let steps = 0;
      const dfs = (i) => {
        if (got.length === n) return true;
        for (let j = i; j < near.length && steps < 200000; j++) {
          steps++;
          if (got.every(p => dist(p, near[j]) >= sep)) { got.push(near[j]); if (dfs(j + 1)) return true; got.pop(); }
        }
        return false;
      };
      if (dfs(0)) return got.map(r2);
    }
    const out = [];
    for (const c of cand) {
      if (out.length >= n) break;
      if (have.every(p => dist(p, c) >= sep)) { out.push(r2(c)); have.push(c); }
    }
    while (out.length < n) out.push(r2(anchor));
    return out;
  }
  const assign = (slots, pts) => Object.fromEntries(slots.map((s, i) => [s, pts[i]]));
  // A walk along points from second t0, as a spot that moves (a pref that's a function of the second).
  function walkPath(pts, t0) {
    const len = [0];
    for (let i = 1; i < pts.length; i++) len.push(len[i - 1] + dist(pts[i - 1], pts[i]));
    return (t) => {
      const d = Math.max(0, (t - t0) * 5.6);
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
    for (let x = -18; x <= 18; x += 1.5) for (let y = -14; y <= 14; y += 1.5) if (F([x, y])) via.push([x, y]);
    let best = null;
    for (const w of via) if (clear(a, w) && clear(w, b)) { const L = dist(a, w) + dist(w, b); if (!best || L < best.L) best = { L, pts: [a, w, b] }; }
    if (best) return best.pts;
    const sparse = via.filter(([x, y]) => Math.abs(x % 3) < 1e-6 && Math.abs(y % 3) < 1e-6), from = sparse.filter(w => clear(a, w)), to = sparse.filter(w => clear(w, b));
    for (const w1 of from) for (const w2 of to) if (clear(w1, w2)) { const L = dist(a, w1) + dist(w1, w2) + dist(w2, b); if (!best || L < best.L) best = { L, pts: [a, w1, w2, b] }; }
    return best ? best.pts : [a, b];
  }
  const mirrorX = (p) => [-p[0], p[1]];
  const shift = (spots, v) => Object.fromEntries(Object.entries(spots).map(([s, p]) => [s, add(p, v)]));

  // ---------- the party's places ----------
  // Phase 1: the Lindwurm lies along the north edge (its middle at [0, 15], hitbox 13.8): everyone just south of it.
  const BOSS1 = [0, 15];
  const UP1 = { MT: [-1.2, 1.6], OT: [1.2, 1.6], M1: [-4, 1], M2: [4, 1], H1: [-5.5, -4], H2: [5.5, -4], R1: [-9, -2], R2: [9, -2] };
  // Phase 2: the boss in the middle (hitbox 5), the tanks at its front (north), melee at its back.
  const UP2 = { MT: [-1, 5.6], OT: [1, 5.6], M1: [-2.6, -5], M2: [2.6, -5], H1: [-6, -9], H2: [6, -9], R1: [-9.5, -5.5], R2: [9.5, -5.5] };

  // Each strat's choices (wtfdig's toggles).
  const STRATS = {
    modified: { mortal: 'role', rep1: 'dn', rep2: 'clonezone', idyllic: 'dn' },
    caro: { mortal: 'toxic', rep1: 'caro', rep2: 'clonezone', idyllic: 'caro' },
  };

  // Burst's blobs (cactbot's coordinates): Act 1 (safe: NW and east, or NE and west), Curtain Call (NW/SE or NE/SW)
  // and Slaughtershed (one blob east or west of the four that are always there).
  const ACT1_BLOBS = [
    { safe: 'NW', tanks: 'E', blobs: [[12.5, 11.37], [-4.07, 8.64], [-10.07, -0.13], [9.18, -9.63], [-9.33, -12.13]] },
    { safe: 'NE', tanks: 'W', blobs: [[-11.58, 10.81], [7.02, 7.81], [12.5, -5.69], [-5.98, -8.53], [-17.66, -13.53]] },
  ];
  const CC_BLOBS = [
    { safe: ['NW', 'SE'], blobs: [[10, 13], [-15, 0], [0, 0], [15, 0], [-9, -13]] },
    { safe: ['SW', 'NE'], blobs: [[-9, 13], [-15, 0], [0, 0], [15, 0], [9, -13]] },
  ];
  const SLAUGHTER_BLOBS = [[0.8, 8], [-13.5, -5.9], [2.5, -6.4], [18.5, -6.16]];
  // Where four 6-yalm spreads fit in the corner the blobs leave (searched offline: each 12.5 or more from every blob).
  const SLAUGHTER_SPREADS = { NW: [[-19.2, 13], [-12.6, 14.2], [-12.6, 7.6], [-19.2, 6.4]], NE: [[18.4, 14.2], [11.8, 14], [19.2, 7.6], [13, 5.2]] };
  const CORNER = { NW: [-18.6, 13.6], NE: [18.6, 13.6], SE: [18.6, -13.6], SW: [-18.6, -13.6] };
  // Act 2's blob puddles (later towers), in the order they drop: two inner, two outer.
  const ACT2_BLOBS = [
    [[4, -4], [-4, 4], [-15, -10], [15, 10]], [[4, 4], [-4, -4], [-15, 10], [15, -10]],
    [[-4, 4], [4, -4], [15, 10], [-15, -10]], [[-4, -4], [4, 4], [15, -10], [-14, 10]],
  ];

  // ---------- the pull ----------
  function plan(events, strat) {
    const st = STRATS[strat] || STRATS.modified;
    const P = { start: Object.assign({}, UP1), prefs: [], hazards: [], checks: [], calls: [], marks: [], labels: new Map(), debuffs: [],
      boss: [{ t: 0, at: BOSS1 }], hitbox: [{ t: 0, r: 13.8 }], looks: [{ t: 0, show: ['a1'] }] };
    const arena = [{ t: 0, ...RECT }];
    let id = 0;
    const hz = (o) => { const h = Object.assign({ id: ++id, react: 3 }, o); P.hazards.push(h); return h; };
    const last = Object.assign({}, UP1);           // each spot's latest place (for routing round holes)
    const pref = (t, spots) => { P.prefs.push({ t, spots }); for (const [s, p] of Object.entries(spots)) if (Array.isArray(p)) last[s] = p; };
    // The same, each walking round whatever isn't floor (F) on the way.
    const prefOn = (t, spots, F) => {
      const out = {};
      for (const [s, p] of Object.entries(spots)) { const pts = pathOn(last[s] || p, p, F); out[s] = pts.length > 2 ? walkPath(pts, t) : p; }
      P.prefs.push({ t, spots: out });
      Object.assign(last, spots);
    };
    const call = (t, text, o) => P.calls.push(Object.assign({ t, text, dur: 5 }, o));
    const debuff = (slot, key, name, hint, t0, t1) => P.debuffs.push({ slot, key, name, hint, t0, t1 });
    const mark = (shape, t0, t1, fill) => P.marks.push(Object.assign({ kind: 'lit', t0, t1, fill }, shape));
    const E = (name, t0, t1) => events.find(e => e.name === name && e.t >= t0 && e.t <= t1) || null;
    const EA = (re, t0, t1) => events.filter(e => re.test(e.name) && e.t >= t0 && e.t <= t1);
    const tOf = (e, d) => (e ? e.t : d);
    const castOf = (ev, d) => ev.t - (ev.cast || d || 5);
    const raid = (ev, dmg, d) => { if (ev) hz({ t: ev.t, tell: castOf(ev, d || 4), raidwide: true, dmg, name: ev.name.replace(/ \d+$/, '').replace(/ \(.*\)$/, '') }); };
    const spreads = (t, targets, r, name, o) => hz(Object.assign({ t, tell: t - 5, effect: 'bait', shape: 'circle', from: 'target', targets, r, dmg: 0.9, own: 0.3, name }, o));
    const stack = (t, targets, r, min, name, o) => hz(Object.assign({ t, tell: t - 5, effect: 'share', shape: 'circle', from: 'target', targets, r, min, max: min, dmg: 0.35, name }, o));
    const P1F = floorOf(RECT), P2F = floorOf(CIRCLE, 1);
    let act3Kind = 'card';                    // this pull's Act 3 platforms (Curtain Call drops them)

    // ===== raidwides =====
    for (const ev of events) {
      if (ev.name === 'The Fixer' || ev.name === 'Arcadia Aflame' || ev.name === 'Idyllic Dream' || ev.name === "Lindwurm's Meteor") {
        raid(ev, 0.5, 5);
        call(castOf(ev, 5), 'Raidwide', { dur: 3 });
      } else if (ev.name === 'Splattershed') {
        const cb = events.find(e => e.name === 'Splattershed (castbar)' && Math.abs(e.t - ev.t) < 4);
        hz({ t: ev.t, tell: cb ? castOf(cb, 3) : ev.t - 5, raidwide: true, dmg: 0.45, name: 'Splattershed' });
        call(cb ? castOf(cb, 3) : ev.t - 5, 'Raidwide', { dur: 3 });
      } else if (/^Arcadian Hell \d \(boss\)/.test(ev.name)) {
        raid(ev, 0.55, 5);
        call(castOf(ev, 5), ev.name.startsWith('Arcadian Hell 1') ? 'Raidwide x5' : 'Raidwide x9', { dur: 4 });
      }
    }

    // ===== phase 1 =====
    // --- Mortal Slayer ---
    for (const e1 of events.filter(e => e.name === 'Mortal Slayer 1')) {
      const hits = [0, 1, 2, 3].map(k => tOf(E(`Mortal Slayer ${k + 1}`, e1.t + 3 * k - 1, e1.t + 3 * k + 1), e1.t + 3 * k));
      const cs = hits[0] - 12.1, side = pick([-1, 1]);             // the purples' side (west -1)
      const orbs = shuffle([{ side, purple: true }, { side, purple: true }, { side }, { side }, { side: -side }, { side: -side }, { side: -side }, { side: -side }]);
      const baiter = [];
      if (st.mortal === 'role') {
        const purp = ['MT', 'OT'], sup = ['H1', 'H2'], dps = ['M1', 'M2', 'R1', 'R2'];
        for (const o of orbs) baiter.push(o.purple ? purp.shift() : o.side === side ? sup.shift() : dps.shift());
      } else {
        const purp = ['MT', 'OT'], conga = ['H1', 'M1', 'R1', 'R2', 'M2', 'H2'];
        for (const o of orbs) baiter.push(o.purple ? purp.shift() : conga.shift());
      }
      // Waiting at the back (Role: supports on the purples' side; Toxic: the conga line west to east).
      const wait = st.mortal === 'role'
        ? Object.assign(assign(SUP, [[side * 6, -8], [side * 12, -8], [side * 6, -13.5], [side * 12, -13.5]]),
          assign(DPS, [[-side * 6, -8], [-side * 12, -8], [-side * 6, -13.5], [-side * 12, -13.5]]))
        : { H1: [-15, -9.5], M1: [-9, -9.5], R1: [-3.2, -9.5], R2: [3.2, -9.5], M2: [9, -9.5], H2: [15, -9.5], MT: [-6, -14], OT: [6, -14] };
      pref(Math.max(cs + 0.3, 0), wait);
      // (Toxic: once baited, to the back on that side, out of the way of the line.)
      const done = { [-1]: [[-7, -13.8], [-12.5, -13.8], [-18, -13.8], [-18, -8]], [1]: [[7, -13.8], [12.5, -13.8], [18, -13.8], [18, -8]] };
      for (let k = 0; k < 4; k++) {
        const pair = [0, 1].map(j => ({ o: orbs[2 * k + j], s: baiter[2 * k + j] })), same = pair[0].o.side === pair[1].o.side;
        const spots = {};
        pair.forEach(({ o, s }, j) => { spots[s] = same && j === 1 ? [o.side * 11, -1.5] : [o.side * 4, 1]; });
        const tin = k ? hits[k - 1] + 0.15 : cs + 5;
        // (Toxic: the next pair crosses over behind the line first, clear of the orbs going off.)
        if (st.mortal !== 'role') pref(k ? hits[k - 1] - 2.6 : cs + 2.5, Object.fromEntries(pair.map(({ o, s }, j) => [s, [o.side * (same && j === 1 ? 12 : 6), -9.8]])));
        pref(tin, spots);
        pref(hits[k] + 0.15, Object.fromEntries(pair.map(({ o, s }) => [s, st.mortal === 'role' ? wait[s] : done[o.side].shift()])));
        for (const { o, s } of pair) {
          hz({ t: hits[k], tell: k ? hits[k - 1] : cs + 3, effect: 'bait', shape: 'circle', from: 'target', targets: [s], r: 6, dmg: o.purple ? 1.2 : 0.9,
            own: o.purple ? 0.5 : 0.3, buster: !!o.purple, status: ['poisonResDown', 30], name: 'Mortal Slayer' });
          call(tin, `${o.purple ? 'Purple' : 'Green'} orb ${k + 1} on YOU: go in ${o.side < 0 ? 'west' : 'east'}`, { slot: s, alert: true, dur: 3 });
        }
      }
      call(cs, `Tanks ${side < 0 ? 'Left' : 'Right'}`, { alert: true, dur: 5 });
      P.labels.set(e1, `Mortal Slayer (purples ${side < 0 ? 'west' : 'east'})`);
      pref(hits[3] + 0.2, UP1);
    }

    // --- Grotesquerie: Act 1 ---
    const act1 = E('Grotesquerie: Act 1', 0, 200);
    if (act1) {
      const t0 = act1.t, tHit = tOf(E('Hemorrhagic Projection x8', t0, t0 + 30), t0 + 18), reach = E('Ravenous Reach', t0, t0 + 30);
      const pud = [1, 2, 3, 4].map(k => E(`Phagocyte Spotlight ${k}`, t0, t0 + 25)).filter(Boolean);
      const burst = E('Burst', tHit, tHit + 15), tBurst = tOf(burst, tHit + 8.7), tBuster = tOf(E('Visceral Burst x2', tHit, tHit + 15), tBurst + 0.6);
      const spreadRole = pick([SUP, DPS]), stackRole = spreadRole === SUP ? DPS : SUP, stT = pick(stackRole);
      const westSafe = Math.random() < 0.5, fx = westSafe ? (p) => p : mirrorX;
      const DIRS = ['Front', 'Rear', 'Left', 'Right'];
      for (const s of S) {
        const d = pick(DIRS);
        debuff(s, 'directedGrotesquerie', 'Directed Grotesquerie', `${d.toLowerCase()} cleave: point it out of the arena`, t0 + 0.6, tHit);
        if (spreadRole.includes(s)) {
          debuff(s, 'burstingGrotesquerie', 'Bursting Grotesquerie', 'spread', t0 + 0.6, tHit);
          call(t0 + 0.6, `Bait 4x Puddles => Spread + ${d} Cleave`, { slot: s, alert: true, dur: 6 });
        } else call(t0 + 0.6, `Bait 4x Puddles => Stack + ${d} Cleave`, { slot: s, alert: true, dur: 6 });
      }
      debuff(stT, 'sharedGrotesquerie', 'Shared Grotesquerie', 'the stack (4)', t0 + 0.6, tHit);
      // Four puddles, one under each player at each bait: marker 1 toward A, then the middle (8.5 yalms a step).
      const Q = [[-12, 8], [-4.5, 12], [3.5, 9.5], [0, 1.8]];
      pref(t0 + 1, clumpAt(S, Q[0], { m: 0 }));
      pud.forEach((e, k) => {
        hz({ t: e.t, tell: e.t - 3, shape: 'circle', from: 'target', targets: S, r: 5, snap: 3, dmg: 0.9, name: 'Phagocyte Spotlight' });
        if (k < 3) pref(e.t - 3 + 0.05, clumpAt(S, Q[k + 1], { m: 0 }));
      });
      // Ravenous Reach: the head goes to the safe side and cleaves the other half.
      const cone = { shape: 'cone', at: fx([-2, 15]), deg: westSafe ? 125 : 235, half: 60, r: 35 };
      if (reach) {
        hz(Object.assign({ t: reach.t, tell: reach.t - 10.5, dmg: 1.3, name: 'Ravenous Reach' }, cone));
        P.labels.set(reach, `Ravenous Reach (${westSafe ? 'west' : 'east'} safe)`);
        call(reach.t - 10.5, westSafe ? 'West' : 'East', { dur: 4 });
      }
      // Spreads down the safe side (north to south), the stack on marker 1 (2 east): its north pair point their
      // cleaves north, the others out to the sides; the spreads' point out of the arena.
      const ord = (role) => (role === SUP ? ['MT', 'OT', 'H1', 'H2'] : ['M1', 'M2', 'R1', 'R2']);
      const sp = ord(spreadRole), so = ord(stackRole), spots = {}, aims = {};
      [[-18.5, 3.5], [-11.5, -1], [-18.5, -6], [-11.5, -12]].forEach((p, i) => { spots[sp[i]] = fx(p); aims[sp[i]] = fx([-60, p[1]]); });
      [[-14.6, 12.6], [-13.4, 12.6], [-15.6, 11.3], [-12.4, 10.8]].forEach((p, i) => { spots[so[i]] = fx(p); aims[so[i]] = i === 2 ? fx([-60, p[1]]) : [fx(p)[0], 60]; });
      pref(pud.length ? pud[pud.length - 1].t - 3 + 0.05 : tHit - 4, spots);
      for (const s of S) hz({ t: tHit, tell: tHit - 5, effect: 'bait', shape: 'cone', from: 'target', targets: [s], aim: aims[s], half: 15, r: 60, dmg: 0.9, own: 0, name: 'Hemorrhagic Projection' });
      spreads(tHit, spreadRole, 6, 'Dramatic Lysis');
      stack(tHit, [stT], 6, 4, 'Fourth-wall Fusion');
      // Burst: the six stack in the safe corner, the tanks share their busters in the other safe spot.
      const pat = pick(ACT1_BLOBS), blobs = pat.blobs.map(b => ({ shape: 'circle', at: b, r: 12 }));
      blobs.forEach(s => hz(Object.assign({ t: tBurst, tell: tBurst - 6.7, dmg: 1.3, name: 'Burst', react: 0.5 }, s)));
      const six = S.filter(s => !TANKS.includes(s)), stack6 = pick(six);
      const tankAt = pat.tanks === 'E' ? [19.2, -0.4] : [-19.2, -0.4];
      pref(tHit + 0.1, Object.assign(clumpAt(six, CORNER[pat.safe], { avoid: blobs, m: 0.5, floor: P1F }), clumpAt(TANKS, tankAt, { avoid: blobs, m: 0.4, floor: floorOf(RECT, 0.7) })));
      stack(tBuster, [stack6], 6, 6, 'Fourth-wall Fusion', { tell: tBurst - 4 });
      stack(tBuster, ['MT'], 6, 2, 'Visceral Burst', { tell: tBurst - 4, dmg: 0.5 });
      call(tHit + 0.3, `${pat.safe === 'NW' ? 'Northwest' : 'Northeast'}/${pat.tanks === 'E' ? 'East' : 'West'}: stack + tank busters`, { alert: true, dur: 6 });
      for (const s of TANKS) call(tHit + 0.3, `Tank busters: share ${pat.tanks === 'E' ? 'east' : 'west'}`, { slot: s, alert: true, dur: 6 });
      if (burst) P.labels.set(burst, `Burst (${pat.safe} and ${pat.tanks} safe)`);
      pref(tBuster + 0.2, UP1);
    }

    // --- Grotesquerie: Act 2 ---
    const act2 = E('Grotesquerie: Act 2', 100, 200);
    if (act2) {
      const t0 = act2.t, cc = E('Cruel Coil', t0, t0 + 25), tcc = tOf(cc, t0 + 15.2), tBind = tcc + 1;
      const H = [0, 1, 2, 3, 4, 5, 6, 7].map(n => (n ? tOf(E(`Skinsplitter ${n}`, t0, t0 + 60), tcc + 6 + 5 * (n - 1)) : tcc));
      const blobT = [1, 2, 3, 4].map(k => tOf(E(`Roiling Mass ${k}`, t0, t0 + 60), H[3] + 2 + 5 * (k - 1)));
      const tCon = tOf(E('Constrictor', t0, t0 + 70), H[7] + 6);
      const blobsAt = pick(ACT2_BLOBS);
      const g0 = pick([90, 270, 0, 180]), G = (n) => deg360(g0 - 90 * n);
      // Who is which: each number (I-IV) one alpha and one beta.
      const order = shuffle(S), A = {}, Bt = {}, numOf = {};
      for (let k = 1; k <= 4; k++) {
        const [a, b] = shuffle([order[2 * k - 2], order[2 * k - 1]]);
        A[k] = a; Bt[k] = b; numOf[a] = k; numOf[b] = k;
      }
      const ROMAN = ['', 'I', 'II', 'III', 'IV'];
      const Tc = (k) => H[k + 1], Tb = (k) => H[k + 1] + 3;
      const breakB = (k) => r2(at(G(k + 1) + 180, 6.2));
      // The fixed blob puddles (the towers' spots).
      const pud = [1, 2, 3, 4].map(k => E(`Phagocyte Spotlight ${k}`, t0, t0 + 20)).filter(Boolean);
      pud.forEach((e, k) => hz({ t: e.t, tell: e.t - 3, shape: 'circle', at: blobsAt[k], r: 5, dmg: 0.9, name: 'Phagocyte Spotlight' }));
      const pudShapes = blobsAt.map(b => ({ shape: 'circle', at: b, r: 5 }));
      pref(t0 + 1, clumpAt(S, [0, -1], { avoid: pudShapes, m: 1.3, floor: P1F }));
      // The coil: drawn in to the middle and bound, then a hit every five seconds, its gap turning.
      P.boss.push({ t: tcc - 0.5, at: [0, 0] }, { t: tCon + 1.5, at: BOSS1 });
      hz({ t: tBind, tell: tcc - 2, effect: 'pull', at: [0, 0], dist: 40, minDist: 1.6, dmg: 0, name: 'Cruel Coil' });
      for (const s of S) debuff(s, 'bind', 'Bind', 'drawn into the coil', tBind, tBind + 5);
      for (let n = 1; n <= 7; n++) {
        hz({ t: H[n], tell: n === 1 ? tBind : H[n - 1], shape: 'cone', at: [0, 0], deg: G(n) + 180, half: 157.5, r: 14, r0: 9, dmg: 0.9, name: 'Skinsplitter', react: 2.5 });
      }
      hz({ t: tCon, tell: tCon - 4.9, shape: 'circle', at: [0, 0], r: 13, dmg: 1.5, name: 'Constrictor' });
      // Inside: the beta of each pair breaks on the far side from the gap while the alpha runs out through it; the
      // chain towers (where each beta broke) and the blob towers get their soakers; whoever is free waits by the gap.
      const exitPt = (g) => (g === 90 || g === 270 ? at(g, 16.8) : [g === 0 ? 7 : -7, g === 0 ? 13.6 : -13.6]);
      const outside = {}, jobs = [], towers = [];
      for (let k = 1; k <= 4; k++) {
        const a = A[k], b = Bt[k], g = G(k + 1), soaker = Bt[[3, 4, 1, 2][k - 1]];
        outside[a] = r2(exitPt(g));
        jobs.push({ t0: Tc(k), t1: Infinity, s: a, p: outside[a], out: true });
        jobs.push({ t0: Tc(k), t1: Tb(k) + 0.1, s: b, p: breakB(k), clear: 4.4 });
        jobs.push({ t0: Tb(k) + 0.15, t1: Tb(k) + 4.1, s: soaker, p: breakB(k), clear: 3.3 });
        towers.push({ t0: Tb(k), t1: Tb(k) + 4, at: breakB(k) });
        hz({ t: Tb(k), tell: Tc(k), targets: [a], tether: b, stretch: 14, dmg: 0, fail: 0.9, name: 'Unbreakable Flesh' });
        spreads(Tb(k), [a, b], 4, 'Dramatic Lysis', { tell: Tc(k), own: 0.25 });
        // The chain tower where the beta broke, soaked by beta III, IV, I, II.
        hz({ t: Tb(k) + 4, tell: Tb(k), effect: 'tower', shape: 'circle', at: breakB(k), r: 3, soak: 1, dmg: 0.3, fail: 0.9, name: 'Roiling Mass' });
        debuff(a, 'unbreakableA', 'Unbreakable Flesh α', `break the chain: out through the gap (${dirName(g)})`, Tc(k), Tb(k));
        debuff(b, 'unbreakableB', 'Unbreakable Flesh β', 'break the chain: stay in the coil', Tc(k), Tb(k));
        call(Tc(k), `Break chain ${k} (${dirName(g)})`, { slot: a, alert: true, dur: 3 });
        call(Tc(k), `Break chain ${k}: stay in (${dirName(g + 180)})`, { slot: b, alert: true, dur: 3 });
        call(Tb(k), 'Chain tower', { slot: soaker, alert: true, dur: 3 });
      }
      // The blob towers, soaked by alpha III, IV (inside) and I, II (outside).
      [3, 4, 1, 2].forEach((n, j) => {
        const s = A[n], tt = blobT[j];
        hz({ t: tt, tell: tt - 5, effect: 'tower', shape: 'circle', at: blobsAt[j], r: 3, soak: 1, dmg: 0.3, fail: 0.9, name: 'Roiling Mass' });
        jobs.push({ t0: n >= 3 ? tt - 4.5 : Tb(n) + 0.1, t1: tt + 0.1, s, p: blobsAt[j], clear: 3.3 });
        towers.push({ t0: tt - 5, t1: tt, at: blobsAt[j] });
        call(tt - 5, `Blob tower ${j + 1}`, { slot: s, alert: true, dur: 4 });
      });
      const gapAt = (T) => G(H.filter((h, n) => n && h <= T + 1e-6).length);
      const keys = [...new Set([tBind + 0.05, ...H.slice(1, 7).map(h => h + 0.05), ...jobs.flatMap(j => [j.t0 + 0.05, j.t1 + 0.05]).filter(isFinite)])]
        .filter(T => T < H[7]).sort((a, b) => a - b);
      for (const T of keys) {
        const now = jobs.filter(j => j.t0 <= T && T < j.t1), spots = {}, avoid = [];
        for (const s of S) {
          const j = now.find(x => x.s === s && !x.out) || now.find(x => x.s === s);
          if (j) { spots[s] = j.p; if (j.clear) avoid.push({ shape: 'circle', at: j.p, r: j.clear }); }
        }
        for (const tw of towers) if (tw.t0 <= T && T < tw.t1) avoid.push({ shape: 'circle', at: tw.at, r: 3.3 });
        const idle = S.filter(s => !spots[s]);
        Object.assign(spots, place(idle.map(s => [s, at(gapAt(T), 3), 0.6]), { avoid, m: 0.3, floor: (p) => Math.hypot(p[0], p[1]) < 7.6, keep: Object.values(spots), keepSep: 0.6 }));
        pref(T, spots);
      }
      for (const s of S) {
        const k = numOf[s], alpha = A[k] === s, key = ['firstInLine', 'secondInLine', 'thirdInLine', 'fourthInLine'][k - 1];
        debuff(s, key, ['First', 'Second', 'Third', 'Fourth'][k - 1] + ' in Line', alpha ? (k >= 3 ? `blob tower ${k - 2} first` : `chain ${k}, then blob tower ${k + 2}`) : (k >= 3 ? `chain tower ${k - 2} first` : `chain ${k}, then chain tower ${k + 2}`), t0 + 1, Tc(k));
        debuff(s, alpha ? 'bondsA' : 'bondsB', alpha ? 'Bonds of Flesh α' : 'Bonds of Flesh β', alpha ? 'run out of the coil to break' : 'stay in the coil to break', t0 + 1, Tc(k));
        call(t0 + 1, `${k}${alpha ? 'α' : 'β'}: ${k <= 2 ? `Wait for Tether ${k}` : alpha ? `Blob Tower ${k - 2}` : `Chain Tower ${k - 2}`}`, { slot: s, alert: true, dur: 6 });
      }
      if (cc) P.labels.set(cc, `Cruel Coil (gap ${dirName(g0)}, turning counterclockwise)`);
      // Out before Constrictor: through the last gap to the sides.
      const out = place(S.map(s => [s, outside[s] || exitPt(G(7)), 0.7]), { avoid: [{ shape: 'circle', at: [0, 0], r: 13 }], m: 1.6, floor: P1F });
      pref(H[7] + 0.1, out);
      call(H[7], `Out of Coil (${dirName(G(7))})`, { alert: true, dur: 4 });
      pref(tCon + 0.2, UP1);
    }

    // --- Grotesquerie: Act 3 ---
    const act3 = E('Grotesquerie: Act 3', 150, 260);
    if (act3) {
      const t0 = act3.t, bdh = E('Bring Down the House', t0, t0 + 20), tB = tOf(bdh, t0 + 9.7);
      const tLys = tOf(E('Dramatic Lysis x8', t0, t0 + 20), tB + 2.4), tMet = tOf(E('Metamitosis x8', t0, t0 + 20), tLys + 0.2);
      const tSplit = tOf(events.find(e => e.name === 'Split Scourge' && e.kind !== 'cast' && e.t > t0 && e.t < t0 + 30), tMet + 9.8);
      const tVen = tOf(E('Venomous Scourge', t0, t0 + 35), tSplit + 2.4), tBack = tMet + 3.3;
      const kind = pick(['card', 'inter']);
      act3Kind = kind;
      // Each support and each DPS gets a direction; your tower lands that way (30 yalms east-west, 20 north-south)
      // on the platform across, so you stand on the platform the other way (on the intercards: the next one round).
      const plat = kind === 'card' ? { E: 'W', W: 'E', N: 'S', S: 'N' } : { E: 'NW', S: 'NE', W: 'SE', N: 'SW' };
      const corner = kind === 'card'
        ? { W: [[-10.8, 4.2], [-19.2, -4.2]], N: [[-4.2, 14.2], [4.2, 5.8]], E: [[10.8, -4.2], [19.2, 4.2]], S: [[4.2, -14.2], [-4.2, -5.8]] }
        : Object.fromEntries(Object.entries(PLAT.inter).map(([k, c]) => [k, [add(c, [-4.2, 4.2]), add(c, [4.2, -4.2])]]));
      const supD = shuffle(['E', 'S', 'W', 'N']), dpsD = shuffle(['E', 'S', 'W', 'N']);
      const spots = {}, dirOf = {};
      SUP.forEach((s, i) => { dirOf[s] = supD[i]; spots[s] = corner[plat[supD[i]]][0]; });
      DPS.forEach((s, i) => { dirOf[s] = dpsD[i]; spots[s] = corner[plat[dpsD[i]]][1]; });
      pref(t0 + 0.2, spots);
      const NAME = { E: 'east', W: 'west', N: 'north', S: 'south' }, PN = { W: 'west', E: 'east', N: 'north', S: 'south', NW: 'north-west', NE: 'north-east', SE: 'south-east', SW: 'south-west' };
      for (const s of S) {
        debuff(s, 'mitoticPhase', 'Mitotic Phase', `spread (9), your tower goes ${NAME[dirOf[s]]}`, t0 + 1, tLys);
        call(t0 + 0.5, `Tower ${NAME[dirOf[s]]}: ${PN[plat[dirOf[s]]]} platform`, { slot: s, alert: true, dur: 6 });
      }
      FALL[kind].forEach(r => hz({ t: tB, tell: tB - 3.6, shape: 'rect', a: r.a, b: r.b, dmg: 1.5, name: 'Bring Down the House' }));
      arena.push({ t: tB + 0.05, ...PLATFORMS(kind) }, { t: tBack, ...RECT });
      FALL[kind].forEach(r => mark({ shape: 'rect', a: r.a, b: r.b }, tB, tBack, 'rgba(0,0,0,0.6)'));
      if (bdh) P.labels.set(bdh, `Bring Down the House (${kind === 'card' ? 'cardinal' : 'intercardinal'} platforms)`);
      spreads(tLys, S, 9, 'Dramatic Lysis', { tell: tB });
      for (const s of S) hz({ t: tMet, tell: tMet - 1.8, effect: 'tower', shape: 'circle', at: spots[s], r: 3, soak: 1, dmg: 0.3, fail: 0.9, name: 'Metamitosis' });
      // Split Scourge: a line from each head at its nearest player (the tanks, north); then the three furthest west and
      // east spread, the tanks in the middle.
      const heads = [[-10, 15.5], [10, 15.5]], spot2 = { MT: [-10, 12.4], OT: [10, 12.4] };
      [['H1', 'M1', 'R1'], ['H2', 'M2', 'R2']].forEach((g, j) => g.forEach((s, i) => { spot2[s] = [(j ? 1 : -1) * 18.6, [10, 0.5, -9][i]]; }));
      pref(tBack + 0.05, spot2);
      TANKS.forEach((s, j) => hz({ t: tSplit, tell: tBack, effect: 'bait', shape: 'line', from: heads[j], aim: 'target', targets: [s], len: 60, w: 10, dmg: 1.3, own: 0.5, buster: true, name: 'Split Scourge' }));
      pref(tSplit + 0.05, { MT: [-1.5, -2], OT: [1.5, -2] });
      spreads(tVen, ['H1', 'M1', 'R1', 'H2', 'M2', 'R2'], 5, 'Venomous Scourge', { tell: tSplit - 2 });
      call(tBack, 'Tanks: bait the lines north => middle; others spread near the heads', { alert: true, dur: 6 });
      pref(tVen + 0.2, UP1);
    }

    // --- Grotesquerie: Curtain Call ---
    const cc3 = E('Grotesquerie: Curtain Call', 200, 300);
    if (cc3) {
      const t0 = cc3.t, kind = act3Kind, floor = HOLED[kind], FF = floorOf(floor), FW = floorOf(floor, 0.5);
      const reach = E('Ravenous Reach', t0, t0 + 25), tR = tOf(reach, t0 + 14.8);
      const pud = [1, 2, 3, 4, 5].map(k => E(`Phagocyte Spotlight ${k}`, t0, t0 + 15)).filter(Boolean);
      const tCell = tOf(E('Cell Shedding x4', t0, t0 + 25), tR + 0.1), tLys = tOf(E('Dramatic Lysis x4', t0, t0 + 25), tR + 0.3);
      const burst = E('Burst', t0 + 20, t0 + 35), tBurst = tOf(burst, t0 + 27.7);
      const tChain = tLys + 4.8, tBreak = tChain + 4.8, tUp = tBurst + 1.6;
      arena.push({ t: t0 + 0.8, ...floor }, { t: tUp, ...RECT });
      const holes = Object.values(PLAT[kind]).map(sq);
      holes.forEach(h => mark(h, t0 + 0.8, tUp, 'rgba(0,0,0,0.6)'));
      const rotRole = pick([SUP, DPS]), burRole = rotRole === SUP ? DPS : SUP;
      for (const s of rotRole) { debuff(s, 'rottingFlesh', 'Rotting Flesh', 'spread in the head\'s cleave', t0 + 0.5, tCell); call(t0 + 0.5, 'Rotting Flesh on YOU: bait 5x puddles => spread in the cleave', { slot: s, alert: true, dur: 6 }); }
      for (const s of burRole) { debuff(s, 'burstingGrotesquerie', 'Bursting Grotesquerie', 'spread out of the cleave', t0 + 0.5, tLys); call(t0 + 0.5, 'Bait 5x puddles => spread out of the cleave', { slot: s, dur: 6 }); }
      // Five puddles round the hole on the north edge (cardinal) or the north-west one (intercardinal).
      const Q = kind === 'card' ? [[-16, 11], [-7.5, 11], [-7.5, 2.5], [0, -2], [7.5, 2.5], [7.5, 11]] : [[-16, 1.5], [-7.5, 1.5], [-7.5, 10], [1, 10], [1, 1.5], [9.5, 1.5]];
      pref(t0 - 5, clumpAt(S, Q[0], { m: 0, floor: FF }));
      pud.forEach((e, k) => {
        hz({ t: e.t, tell: e.t - 3, shape: 'circle', from: 'target', targets: S, r: 5, snap: 3, dmg: 0.9, name: 'Phagocyte Spotlight' });
        if (k < pud.length - 1) prefOn(e.t - 3 + 0.05, clumpAt(S, Q[k + 1], { m: 0, floor: FF }), FW);
      });
      // Ravenous Reach: Rotting Flesh spreads inside it (it cleanses them: four must be in it), Bursting outside.
      const westSafe = Math.random() < 0.5;
      const cone = { shape: 'cone', at: westSafe ? [-2, 15] : [2, 15], deg: westSafe ? 125 : 235, half: 60, r: 35 };
      if (reach) P.labels.set(reach, `Ravenous Reach (${westSafe ? 'east' : 'west'} cleave: Rotting Flesh in it)`);
      hz(Object.assign({ t: tR, tell: tR - 10.5, effect: 'tower', soak: [4, 4], dmg: 0.3, fail: 0.9, name: 'Ravenous Reach' }, cone));
      const rotPts = spreadIn(4, (p) => FF(p) && inside(cone, p, -1.3) && dist(p, cone.at) > 3, westSafe ? [11, 2] : [-11, 2], 6.8);
      const burPts = spreadIn(4, (p) => FF(p) && !inside(cone, p, 1.4), westSafe ? [-12, 2] : [12, 2], 6.8, rotPts);
      prefOn(pud.length ? pud[pud.length - 1].t - 3 + 0.05 : tR - 4, Object.assign(assign(rotRole, rotPts), assign(burRole, burPts)), FW);
      spreads(tCell, rotRole, 6, 'Cell Shedding', { tell: tR - 5 });
      spreads(tLys, burRole, 6, 'Dramatic Lysis', { tell: tR - 5 });
      call(tR - 10.5, `${westSafe ? 'Spread East in the cleave / West out of it' : 'Spread West in the cleave / East out of it'}`, { alert: true, dur: 6 });
      // The chains: stack in the middle, then supports west, DPS east (north to south), each pair chained across
      // (more than 20 apart to break): the blobs are out by then, so each side spreads toward its safe corner, then
      // gathers in it.
      prefOn(tLys + 0.15, clumpAt(S, [0, 0], { m: 0, floor: FF }), FW);
      const pat = pick(CC_BLOBS), blobs = pat.blobs.map(b => ({ shape: 'circle', at: b, r: 12 }));
      const wC = pat.safe.find(c => c.endsWith('W')), eC = pat.safe.find(c => c.endsWith('E'));
      const byNS = (pts) => pts.slice().sort((a, b) => b[1] - a[1]);
      const safeOk = (p) => FF(p) && blobs.every(b => dist(p, b.at) > 12.6);
      const wB = spreadIn(4, safeOk, CORNER[wC], 0.6), eB = spreadIn(4, safeOk, CORNER[eC], 0.6);
      const cen = (pts) => [pts.reduce((a, p) => a + p[0], 0) / pts.length, pts.reduce((a, p) => a + p[1], 0) / pts.length];
      const wCol = byNS(spreadIn(4, FF, cen(wB), 4.8, null, 0.4, 10)), eCol = byNS(spreadIn(4, FF, cen(eB), 4.8, null, 0.4, 10));
      const match = (col, bs) => { const left = bs.slice(); return col.map(c => { let bi = 0; left.forEach((b, i) => { if (dist(b, c) < dist(left[bi], c)) bi = i; }); return left.splice(bi, 1)[0]; }); };
      prefOn(tChain + 0.1, Object.assign(assign(SUP, wCol), assign(DPS, eCol)), FW);
      SUP.forEach((s, i) => {
        const d = DPS[i];
        hz({ t: tBreak, tell: tChain, targets: [s], tether: d, stretch: 20, dmg: 0, fail: 0.9, name: 'Unbreakable Flesh' });
        for (const x of [s, d]) debuff(x, i % 2 ? 'unbreakableB' : 'unbreakableA', i % 2 ? 'Unbreakable Flesh β' : 'Unbreakable Flesh α', `break the chain with ${x === s ? d : s}`, tChain, tBreak);
      });
      spreads(tBreak, S, 4, 'Dramatic Lysis', { tell: tChain, own: 0.25 });
      call(tChain, `Chains: supports ${wC}, DPS ${eC}`, { alert: true, dur: 4 });
      blobs.forEach(s => hz(Object.assign({ t: tBurst, tell: tBurst - 6.7, dmg: 1.3, name: 'Burst', react: 0.6 }, s)));
      prefOn(tBreak + 0.1, Object.assign(assign(SUP, match(wCol, wB)), assign(DPS, match(eCol, eB))), FW);
      if (burst) P.labels.set(burst, `Burst (${pat.safe.join(' and ')} safe)`);
      prefOn(tBurst + 0.2, UP1, FW);
    }

    // --- Slaughtershed (three times; each picks its arms) ---
    for (const cb of events.filter(e => /^Slaughtershed \d \(castbar\)$/.test(e.name))) {
      const t = cb.t, lys = E('Dramatic Lysis x4', t, t + 15);
      if (!lys) continue;                              // the timeline's jump point: the next one plays on
      const hit = E(cb.name.replace(' (castbar)', ''), t, t + 4);
      if (hit) { hz({ t: hit.t, tell: castOf(cb, 3), raidwide: true, dmg: 0.5, name: 'Slaughtershed' }); call(castOf(cb, 3), 'Raidwide', { dur: 3 }); }
      const tH = tOf(hit, t + 2.4), tL = lys.t, burst = E('Burst', tL, tL + 2), tBurst = tOf(burst, tL + 0.4);
      const arms = EA(/^Serpentine Scourge\/Raptor Knuckles\??$/, tL, tL + 15), kbs = EA(/^Serpentine Scourge\/--knockback--\??$/, tL, tL + 15);
      const spreadRole = pick([SUP, DPS]), stackRole = spreadRole === SUP ? DPS : SUP, stT = pick(stackRole);
      const east = Math.random() < 0.5;                 // the extra blob: east (spreads north-west, stack north-east) or west
      const blobPts = SLAUGHTER_BLOBS.concat([east ? [10.75, 3.5] : [-10.75, 3.6]]), blobs = blobPts.map(b => ({ shape: 'circle', at: b, r: 12 }));
      blobs.forEach(s => hz(Object.assign({ t: tBurst, tell: tBurst - 6.7, dmg: 1.3, name: 'Burst', react: 0.35 }, s)));
      const safe = (p) => floorOf(RECT, 0.7)(p) && blobPts.every(b => dist(p, b) > 12.38);
      const sPts = SLAUGHTER_SPREADS[east ? 'NW' : 'NE'];
      const kPts = spreadIn(4, safe, east ? [19.2, 14.2] : [-19.2, 14.2], 0.3, null, 0.2);
      pref(tH + 0.2, Object.assign(assign(spreadRole, sPts), assign(stackRole, kPts)));
      spreads(tL, spreadRole, 6, 'Dramatic Lysis', { tell: tH });
      stack(tL, [stT], 6, 4, 'Fourth-wall Fusion', { tell: tH });
      call(tH, east ? 'Spread NW / Stack NE' : 'Spread NE / Stack NW', { alert: true, dur: 6 });
      // The arms: two half-room cleaves (Serpentine Scourge) or two 30-yalm knockbacks from the north corners
      // (Raptor Knuckles), one side then the other.
      const raptor = Math.random() < 0.5, west = Math.random() < 0.5, sg = west ? -1 : 1;
      const k1 = tOf(kbs[0], tL + 6.5), k2 = tOf(kbs[1], k1 + 4.7);
      arms.forEach((e, j) => P.labels.set(e, raptor ? `Raptor Knuckles (from the ${(j ? -sg : sg) < 0 ? 'north-west' : 'north-east'})` : `Serpentine Scourge (${(j ? -sg : sg) < 0 ? 'west' : 'east'} half)`));
      kbs.forEach((e, j) => P.labels.set(e, raptor ? 'Raptor Knuckles (knockback)' : 'Serpentine Scourge'));
      if (!raptor) {
        [k1, k2].forEach((tk, j) => {
          const s = j ? -sg : sg;
          hz({ t: tk, tell: j ? k1 : tBurst + 0.1, shape: 'rect', a: [s < 0 ? -20 : 0, -15], b: [s < 0 ? 0 : 20, 15], dmg: 1.4, name: 'Serpentine Scourge', react: 2.5 });
        });
        pref(tBurst + 0.1, clumpAt(S, [-sg * 7, 2.5], { m: 0 }));
        pref(k1 + 0.05, clumpAt(S, [sg * 7, 2.5], { m: 0 }));
        call(tBurst + 0.1, `${west ? 'East' : 'West'} => ${west ? 'West' : 'East'}`, { alert: true, dur: 5 });
      } else {
        const srcs = [[sg * 18, 11], [-sg * 18, 11]];
        [k1, k2].forEach((tk, j) => {
          const src = srcs[j], u = unit([-src[0] * 20 / 18 - src[0], -15 - src[1]]);
          hz({ t: tk, tell: j ? k1 : tBurst + 0.1, effect: 'knockback', at: src, dist: 30, dmg: 0.2, name: 'Raptor Knuckles', react: 4 });
          pref(j ? k1 + 0.6 : tBurst + 0.1, clumpAt(S, add(src, mul(u, 7)), { m: 0, floor: P1F }));
        });
        call(tBurst + 0.1, `Knockback from ${west ? 'Northwest' : 'Northeast'} => Knockback from ${west ? 'Northeast' : 'Northwest'}`, { alert: true, dur: 6 });
      }
      pref(k2 + 0.7, UP1);
    }

    // --- the end of phase 1 ---
    for (const ev of events) {
      if (ev.name === 'The Fixer (Enrage)') P.labels.set(ev, 'The Fixer (phase 1\'s enrage: push phase 1 before it)');
      else if (ev.name === 'Refreshing Overkill (Enrage)') P.labels.set(ev, 'Refreshing Overkill');
      else if (ev.name === 'Refreshing Overkill') {
        hz({ t: ev.t, tell: ev.t - 3, raidwide: true, dmg: 0.3, name: 'Refreshing Overkill' });
        P.labels.set(ev, 'Refreshing Overkill (phase 1 done)');
      }
    }
    // The transition: Refreshing Overkill, the floor round to a circle; phase 2 from Arcadia Aflame's cast.
    const tP2 = tOf(events.find(e => e.name === 'Refreshing Overkill' && e.kind !== 'enrage'), 538.3) + 3;
    const AA = events.find(e => e.name === 'Arcadia Aflame'), p2 = AA ? AA.t - 15.2 : tP2 + 960;
    P.hitbox.push({ t: tP2, r: 5 });
    P.looks.push({ t: tP2, show: ['a2'] });
    arena.push({ t: tP2, ...CIRCLE });
    P.boss.push({ t: tP2, at: [0, 7.5] });
    pref(tP2, shift(UP2, [0, 7.5]));

    // ===== phase 2 =====
    P.boss.push({ t: tOf(E('Replication 1', p2, p2 + 100), p2 + 27.5) - 5.2, at: [0, 0], move: 1 });
    pref(tOf(E('Replication 1', p2, p2 + 100), p2 + 27.5) - 5, UP2);

    // --- Double Sobat (three times) ---
    for (const cb of events.filter(e => e.name === 'Double Sobat (castbar)')) {
      const t1 = tOf(E('Double Sobat 1', cb.t, cb.t + 3), cb.t + 0.6), t2 = tOf(E('Double Sobat 2', cb.t, cb.t + 8), t1 + 4.6);
      const t3 = tOf(E('Esoteric Finisher', cb.t, cb.t + 12), t2 + 2.4), cs = cb.t - (cb.cast || 5);
      const turn = pick([0, 90, 180, 270]), d2 = deg360(0 - turn);
      // The buster at the main tank (north); everyone else behind; then the second cleave the way the boss turns.
      pref(cs + 0.2, Object.assign(clumpAt(['MT'], [0, 6]), clumpAt(S.filter(s => s !== 'MT'), [0, -6], { m: 0 })));
      hz({ t: t1, tell: cs + 0.5, effect: 'bait', shape: 'cone', from: 'boss', aim: 'target', targets: ['MT'], half: 90, r: 40, dmg: 1.3, own: 0.55, buster: true, name: 'Double Sobat' });
      const half2 = { shape: 'cone', at: [0, 0], deg: d2, half: 90, r: 40 };
      hz(Object.assign({ t: t2, tell: t1, dmg: 1.3, name: 'Double Sobat', react: 3 }, half2));
      const away = at(d2 + 180, 7.5);
      pref(t1 + 0.1, place(S.map(s => [s, away, 0.55]), { avoid: [half2], m: 1.5, floor: P2F }));
      // Esoteric Finisher: a 10-yalm circle on each tank, apart and away from the party.
      const tankSpots = { MT: at(d2 + 180 - 60, 9), OT: at(d2 + 180 + 60, 9) };
      const rest = clumpAt(S.filter(s => !TANKS.includes(s)), at(d2, 11), { avoid: [{ shape: 'circle', at: tankSpots.MT, r: 10 }, { shape: 'circle', at: tankSpots.OT, r: 10 }], m: 1, floor: P2F });
      pref(t2 + 0.1, Object.assign({}, tankSpots, rest));
      spreads(t3, TANKS, 10, 'Esoteric Finisher', { tell: t2, dmg: 1.2, own: 0.5, buster: true });
      const dn = { 0: 'North', 90: 'East', 180: 'South', 270: 'West' };
      call(t1, `${dn[d2]} cleave next: go ${dn[deg360(d2 + 180)].toLowerCase()}`, { alert: true, dur: 4 });
      call(t2, 'Tank busters: tanks apart', { dur: 3 });
      pref(t3 + 0.2, UP2);
    }

    // --- Replication 1 ---
    const rep1 = E('Replication 1', p2, p2 + 100);
    if (rep1) {
      const tf1 = tOf(E('Top-tier Slam x2', rep1.t, rep1.t + 20), rep1.t + 11.7), tc1 = tOf(E('Winged Scourge x4', rep1.t, rep1.t + 20), tf1 + 0.8), td1 = tOf(E('Mighty Magic x4', rep1.t, rep1.t + 20), tc1 + 0.2);
      const kick = E('Snaking Kick', rep1.t, rep1.t + 25);
      const tf2 = tOf(E('Top-tier Slam x2', tf1 + 5, tf1 + 30), tf1 + 21.3), tc2 = tOf(E('Winged Scourge x4', tc1 + 5, tc1 + 30), tf2 + 0.8), td2 = tOf(E('Mighty Magic x4', td1 + 5, td1 + 30), tc2 + 0.3);
      const cs = rep1.t;
      // Four clones on the cardinals (14 out): one pair cleaves front and back along one axis, the other pair is a
      // fire clone (a stack on its nearest) and a dark one (spreads on its two nearest).
      const cleaveNS = Math.random() < 0.5, axis = pick([0, 90]), fireFirst = Math.random() < 0.5;
      const cl = cleaveNS ? [[0, 14], [0, -14]] : [[14, 0], [-14, 0]], other = cleaveNS ? [[-14, 0], [14, 0]] : [[0, 14], [0, -14]];
      const fire = fireFirst ? other[0] : other[1], dark = fireFirst ? other[1] : other[0];
      const cones = [];
      for (const c of cl) for (const d of [axis, axis + 180]) cones.push({ shape: 'cone', at: c, deg: d, half: 15, r: 50 });
      cones.forEach(s => hz(Object.assign({ t: tc1, tell: tc1 - 4, dmg: 1.3, name: 'Winged Scourge' }, s)));
      // Setup (DN: G1 north, G2 south, melee NE/SW, ranged NW/SE; Caro: ranged and healers on the 1/3 corners, tanks
      // and melee max melee on 2/4): the group on each clone's side sends two in; the pair stack takes the fire
      // clone, two spread on the dark one.
      const sideOf = (c) => (cleaveNS ? (c[0] < 0 ? 'W' : 'E') : (c[1] > 0 ? 'N' : 'S'));
      const grpFor = (c) => (st.rep1 === 'dn' ? ((sideOf(c) === 'N' || sideOf(c) === 'W') ? G1 : G2) : ((sideOf(c) === 'N' || sideOf(c) === 'W') ? ['MT', 'M1', 'H1', 'R1'] : ['OT', 'M2', 'H2', 'R2']));
      const fg = grpFor(fire), dg = grpFor(dark);
      const fPair = [fg[0], fg[2]], dPair = [dg[0], dg[2]];
      const toward = (c, k, l) => add(mul(unit(c), 14 - k), mul(unit([c[1], -c[0]]), l));
      const want1 = {};
      want1[fPair[0]] = toward(fire, 3.2, -0.4); want1[fPair[1]] = toward(fire, 3.2, 0.4);
      want1[dPair[0]] = toward(dark, 3.5, -3.2); want1[dPair[1]] = toward(dark, 3.5, 3.2);
      const rest1 = S.filter(s => !want1[s]);
      const restSpots = place(rest1.map(s => [s, mul(unit(add(toward(fg.includes(s) ? fire : dark, 9, 0), [0, 0])), 5.5), 1]),
        { avoid: cones.concat([{ shape: 'circle', at: want1[dPair[0]], r: 5 }, { shape: 'circle', at: want1[dPair[1]], r: 5 }, { shape: 'circle', at: want1[fPair[0]], r: 5 }]), m: 1.4, floor: P2F });
      pref(cs + 0.2, Object.assign({}, want1, restSpots));
      stack(tf1, [fPair[0]], 5, 2, 'Top-tier Slam', { tell: cs + 1, status: ['fireResDown', 25] });
      spreads(td1, dPair, 5, 'Mighty Magic', { tell: cs + 1, status: ['darkResDown', 25] });
      call(cs + 1, `${cleaveNS ? 'N/S' : 'E/W'} cleaving ${axis ? 'East/West' : 'North/South'}`, { dur: 5 });
      for (const s of fPair) call(cs + 1, 'Fire clone: pair stack', { slot: s, alert: true, dur: 5 });
      for (const s of dPair) call(cs + 1, 'Dark clone: spread', { slot: s, alert: true, dur: 5 });
      // Snaking Kick: a half-room cleave at a random player; get behind.
      if (kick) {
        // (Its target is someone standing out from the boss; everyone then gets behind, its far side.)
        const spot1 = Object.assign({}, want1, restSpots), tgt = pick(S.filter(s => Math.hypot(...spot1[s]) > 3)), tk = kick.t, kc = tk - (kick.cast || 5);
        const away = at(Math.atan2(spot1[tgt][0], spot1[tgt][1]) * 180 / Math.PI + 180, 6);
        hz({ t: tk, tell: kc, shape: 'cone', from: 'boss', aim: 'target', targets: [tgt], snap: 4.8, half: 90, r: 40, dmg: 1.3, name: 'Snaking Kick' });
        pref(td1 + 0.15, clumpAt(S, away, { m: 0, floor: P2F }));
        pref(tk + 0.1, UP2);
        call(kc + 0.2, 'Get Behind', { alert: true, dur: 4 });
      }
      // The second set: eight clones on the two diagonals; one line alternates fire and dark, the other cleaves.
      const diagFD = pick([45, 135]), diagC = diagFD === 45 ? 135 : 45, axis2 = pick([0, 90]);
      const line = (d) => [at(d, 14.1), at(d, 7.07), at(d + 180, 7.07), at(d + 180, 14.1)];
      const fd = line(diagFD), fdKinds = Math.random() < 0.5 ? ['F', 'D', 'F', 'D'] : ['D', 'F', 'D', 'F'];
      const cones2 = [];
      for (const c of line(diagC)) for (const d of [axis2, axis2 + 180]) cones2.push({ shape: 'cone', at: c, deg: d, half: 15, r: 50 });
      cones2.forEach(s => hz(Object.assign({ t: tc2, tell: tc2 - 6, dmg: 1.3, name: 'Winged Scourge' }, s)));
      // Dark-debuffed players take the fire stacks with a partner, the fire-debuffed and the rest take the dark spreads.
      const none = shuffle(S.filter(s => !fPair.includes(s) && !dPair.includes(s)));
      const fires = fd.filter((_, i) => fdKinds[i] === 'F'), darks = fd.filter((_, i) => fdKinds[i] === 'D');
      const w2 = {}, list = [];
      fires.forEach((c, i) => { const s = dPair[i], m = none[i]; list.push([s, c, 0.5], [m, c, 0.5]); w2[s] = 'fire'; w2[m] = 'fire'; });
      darks.forEach((c, i) => { const a = fPair[i], m = none[2 + i]; const u = unit([c[1], -c[0]]); list.push([a, add(c, mul(u, 2.9)), 5.6], [m, add(c, mul(u, -2.9)), 5.6]); w2[a] = 'dark'; w2[m] = 'dark'; });
      const fireStackers = fires.map((c, i) => dPair[i]);
      const spots2 = place(list.sort((x, y) => y[2] - x[2]), { avoid: cones2, m: 1.3, floor: P2F, sep: 0.5 });
      pref(kick ? kick.t + 0.1 : tf2 - 8, spots2);
      stack(tf2, fireStackers, 5, 2, 'Top-tier Slam', { tell: tf2 - 8 });
      spreads(td2, S.filter(s => w2[s] === 'dark'), 5, 'Mighty Magic', { tell: tf2 - 8 });
      for (const s of S) call(tc2 - 8, w2[s] === 'fire' ? 'Take a fire stack (pair)' : 'Take a dark spread (solo)', { slot: s, alert: true, dur: 5 });
      pref(td2 + 0.15, UP2);
    }

    // --- Replication 2 (Clone Zone) ---
    const stg = E('Staging', p2 + 80, p2 + 100), rep2 = E('Replication 2', p2 + 80, p2 + 120);
    if (stg && rep2) {
      const tFire = tOf(E('Firefall Splash', rep2.t, rep2.t + 30), rep2.t + 22.4), tWave = tOf(E('Scalding Waves x4', rep2.t, rep2.t + 30), tFire + 0.7);
      const tMana = tOf(E('Mana Burst x3', rep2.t, rep2.t + 30), tWave + 1.4), tSlam = tOf(E('Heavy Slam x2', rep2.t, rep2.t + 35), tMana + 5.6);
      const tProj = tOf(E('Hemorrhagic Projection x2', rep2.t, rep2.t + 40), tSlam + 1.8), kick = E('Snaking Kick', tProj, tProj + 10);
      const reen = E('Reenactment 1', rep2.t, rep2.t + 60), tRe = tOf(reen, tProj + 14), nw = E('Netherwrath Near/Netherwrath Far', tRe, tRe + 15);
      const tSpite = tOf(E('Timeless Spite x2', tRe, tRe + 15), tRe + 9.3), m0 = tRe + 8.2;
      // Each player's clone appears on a clock spot; Clone Zone's tether for it: N the boss, NE/NW cleaves, E/W
      // stacks, SE/SW defamations, S nothing. LP2 north to south-east, LP1 south to north-west.
      const CLOCK = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'], BRG = { N: 0, NE: 45, E: 90, SE: 135, S: 180, SW: 225, W: 270, NW: 315 };
      const ROLE = { N: 'boss', NE: 'cone', E: 'stack', SE: 'defam', S: 'none', SW: 'defam', W: 'stack', NW: 'cone' };
      const perm = shuffle(S), clockOf = {}, who = {};
      CLOCK.forEach((c, i) => { clockOf[perm[i]] = c; who[c] = perm[i]; });
      const LP2 = ['N', 'NE', 'E', 'SE'].map(c => who[c]), LP1 = ['S', 'SW', 'W', 'NW'].map(c => who[c]);
      const cloneAt = (c) => r2(at(BRG[c], 12));
      const tClones = stg.t + 7.9;
      for (const s of S) {
        call(tClones, `Tethered to ${dirName(BRG[clockOf[s]])} clone: ${({ boss: 'boss tether', cone: 'cleave tether', stack: 'stack tether', defam: 'defamation tether', none: 'no tether' })[ROLE[clockOf[s]]]}`, { slot: s, alert: true, dur: 6 });
      }
      pref(stg.t + 0.2, all(s => r2(at(BRG[clockOf[s]], 12))));
      // Then to the tethers' spots: the boss tether on the diamond under A, stacks and cleaves on the north edge,
      // defamations ESE and WSW, the untethered south.
      const pre = {
        [who.N]: [0, 9], [who.NE]: [4, 17.4], [who.E]: [9, 16.5], [who.NW]: [-4, 17.4], [who.W]: [-9, 16.5],
        [who.SE]: r2(at(112.5, 19.3)), [who.SW]: r2(at(247.5, 19.3)), [who.S]: [0, -19.3],
      };
      pref(rep2.t + 4, pre);
      P.boss.push({ t: tFire, at: [0, 9] }, { t: tMana + 0.5, at: [0, 0], move: 1 });
      spreads(tFire, [who.N], 5, 'Firefall Splash', { tell: tFire - 5.9 });
      pref(tFire + 0.05, { [who.N]: [0, 7.3] });
      const proBaits = [who.NE, who.E, who.NW, who.W];
      hz({ t: tWave, tell: tFire, effect: 'bait', shape: 'cone', from: [0, 9], aim: 'target', targets: proBaits, half: 5, r: 50, dmg: 0.9, own: 0.25, name: 'Scalding Waves' });
      spreads(tMana, [who.SE, who.SW, who.S], 20, 'Mana Burst', { tell: tMana - 8, own: 0.35 });
      // Light-party stacks on the stack tethers (LP1 north-west, LP2 north-east), then the cleaves point north.
      const stk = { [who.W]: [-7.5, 12.5], [who.E]: [7.5, 12.5] };
      const st2 = Object.assign(clumpAt(LP1, stk[who.W], { m: 0 }), clumpAt(LP2, stk[who.E], { m: 0 }));
      pref(tMana + 0.1, st2);
      stack(tSlam, [who.W, who.E], 5, 4, 'Heavy Slam', { tell: tMana });
      pref(tSlam + 0.1, { [who.NE]: [3.2, 12.5], [who.NW]: [-3.2, 12.5] });
      for (const s of [who.NE, who.NW]) hz({ t: tProj, tell: tSlam, effect: 'bait', shape: 'cone', from: 'target', targets: [s], aim: [s === who.NE ? 3.2 : -3.2, 60], half: 22.5, r: 50, dmg: 0.9, own: 0, name: 'Hemorrhagic Projection' });
      // Snaking Kick: south half; A is always safe.
      if (kick) hz({ t: kick.t, tell: kick.t - 5, shape: 'cone', at: [0, 0], deg: 180, half: 90, r: 40, dmg: 1.3, name: 'Snaking Kick' });
      // The Reenactment: the clones replay their tethers in spawn order (N/S, NE/SW, E/W, SE/NW), four seconds apart;
      // Netherwrath's two pair stacks go to the two nearest (Near) or furthest (Far).
      const far = Math.random() < 0.5;
      if (nw) P.labels.set(nw, far ? 'Netherwrath Far' : 'Netherwrath Near');
      const pairA = [who.N, who.SE], pairB = [who.S, who.SW];
      const pairSpots = far ? [[14, 12.3], [-14, 12.3]] : [[3.2, 3.6], [-3.2, 3.6]];
      const proSpots = { [who.NE]: [3.1, 18.4], [who.E]: [8.2, 16.9], [who.NW]: [-3.1, 18.4], [who.W]: [-8.2, 16.9] };
      const spite = Object.assign({}, proSpots, assign(pairA, [pairSpots[0], add(pairSpots[0], [0.6, -0.4])]), assign(pairB, [pairSpots[1], add(pairSpots[1], [-0.6, -0.4])]));
      pref(tRe - 6, spite);
      stack(tSpite, [who.N, who.S], 6, 2, 'Timeless Spite', { tell: tRe });
      const nC = cloneAt('N');
      hz({ t: m0, tell: tRe, shape: 'circle', at: nC, r: 5, dmg: 0.9, name: 'Firefall Splash (clone)' });
      hz({ t: m0 + 1.9, tell: tRe, effect: 'bait', shape: 'cone', from: nC, aim: 'target', targets: proBaits, half: 5, r: 50, dmg: 0.9, own: 0.25, name: 'Scalding Waves (clone)' });
      call(tRe, far ? 'Far pairs NW/NE + proteans north' : 'Pairs on the boss + proteans north', { alert: true, dur: 6 });
      // NE cleave and SW defamation, E/W stacks, SE defamation and NW cleave.
      const coneNE = { shape: 'cone', at: cloneAt('NE'), deg: 0, half: 22.5, r: 50 }, coneNW = { shape: 'cone', at: cloneAt('NW'), deg: 0, half: 22.5, r: 50 };
      const defSW = { shape: 'circle', at: cloneAt('SW'), r: 20 }, defSE = { shape: 'circle', at: cloneAt('SE'), r: 20 };
      hz(Object.assign({ t: m0 + 4 + 1.9, tell: m0, dmg: 1.2, name: 'Hemorrhagic Projection (clone)' }, coneNE));
      hz(Object.assign({ t: m0 + 4 + 1.2, tell: m0, dmg: 1.3, name: 'Mana Burst (clone)' }, defSW));
      const towW = cloneAt('W'), towE = cloneAt('E');
      for (const c of [towW, towE]) hz({ t: m0 + 8 + 1.6, tell: m0 + 4, effect: 'tower', shape: 'circle', at: c, r: 5, soak: [1, 4], dmg: 0.3, fail: 0.9, name: 'Heavy Slam (clone)' });
      hz(Object.assign({ t: m0 + 12 + 1.2, tell: m0 + 6, dmg: 1.3, name: 'Mana Burst (clone)' }, defSE));
      hz(Object.assign({ t: m0 + 12 + 1.9, tell: m0 + 6, dmg: 1.2, name: 'Hemorrhagic Projection (clone)' }, coneNW));
      // Ranged (and healers) end up west, melee (and tanks) east.
      const W4 = ['H1', 'H2', 'R1', 'R2'], E4 = ['MT', 'OT', 'M1', 'M2'];
      pref(m0 + 2, Object.assign(clumpAt(W4, [-5, 14.5], { avoid: [defSW, coneNE, coneNW], m: 1.3, floor: P2F }), clumpAt(E4, [14.5, 6], { avoid: [defSW, coneNE], m: 1.3, floor: P2F })));
      pref(m0 + 4 + 2, Object.assign(clumpAt(W4, towW, { m: 0 }), clumpAt(E4, towE, { m: 0 })));
      pref(m0 + 8 + 1.7, clumpAt(E4, [9.5, 14.5], { avoid: [defSE, coneNW], m: 1.3, floor: P2F }));
      call(m0, 'Ranged west, melee east', { alert: true, dur: 5 });
      call(m0 + 8 + 1.7, 'Melee: dodge back north-east', { dur: 4 });
      pref(m0 + 12 + 2, UP2);
    }

    // --- Blood Mana (the superchain) ---
    const mut = E('Mutating Cells', p2 + 150, p2 + 250);
    if (mut) {
      const t0 = mut.t, bw = E('Blood Wakening', t0, t0 + 50), h1 = E('Black Hole 1', t0, t0 + 50), h2 = E('Black Hole 2', t0, t0 + 50);
      const tW1 = tOf(h1, tOf(bw, t0 + 32.9) + 1.6), tW2 = tOf(h2, tW1 + 5), nwd = E('Netherworld Near/Netherworld Far', t0, t0 + 60);
      const tWave = tOf(E('Wailing Wave x3', t0, t0 + 60), tW2 + 5.5), tSwap = t0 + 18.5;
      const alphas = shuffle(S).slice(0, 4), betas = S.filter(s => !alphas.includes(s));
      for (const s of S) {
        const a = alphas.includes(s);
        debuff(s, a ? 'mutationA' : 'mutationB', a ? 'Mutation α' : 'Mutation β', a ? 'take no damage' : 'pop the shapes', t0 + 1.8, tSwap);
        debuff(s, a ? 'mutationB' : 'mutationA', a ? 'Mutation β' : 'Mutation α', a ? 'take the stack' : 'avoid the stack', tSwap, tWave + 0.5);
        call(t0 + 1.8, `Mutation ${a ? 'α' : 'β'} on YOU`, { slot: s, alert: true, dur: 4 });
      }
      for (const e of EA(/^Dramatic Lysis x8$/, t0, t0 + 60)) hz({ t: e.t, tell: e.t - 2, raidwide: true, dmg: 0.15, name: 'Dramatic Lysis' });
      // The black holes (west and east) eat the shapes and replay them in two waves: water (an 8-yalm circle), aero
      // (all but 5 yalms round the hole), thunder (cones north and south) and fire (cones east and west).
      const holes = [[-10, 0], [10, 0]];
      const shapeOf = (k, c) => k === 'water' ? [{ shape: 'circle', at: c, r: 8 }] : k === 'aero' ? [{ shape: 'donut', at: c, r0: 5, r1: 60 }]
        : (k === 'thunder' ? [0, 180] : [90, 270]).map(d => ({ shape: 'cone', at: c, deg: d, half: 60, r: 40 }));
      const safePts = (shapes) => spreadIn(8, (p) => P2F(p) && shapes.every(h => !inside(h, p, 1.6)), [0, -6], 0.6);
      let waves = null;
      for (let tries = 0; tries < 60 && !waves; tries++) {
        const ks = shuffle(['water', 'aero', 'thunder', 'fire']);
        const w = [shapeOf(ks[0], holes[0]).concat(shapeOf(ks[2], holes[1])), shapeOf(ks[1], holes[0]).concat(shapeOf(ks[3], holes[1]))];
        const okAll = w.every(sh => { let n = 0; for (let x = -18; x <= 18; x += 1) for (let y = -18; y <= 18; y += 1) if (P2F([x, y]) && sh.every(h => !inside(h, [x, y], 2))) n++; return n >= 6; });
        if (okAll) waves = { w, ks };
      }
      if (waves) {
        [tW1, tW2].forEach((tw, j) => waves.w[j].forEach(s => hz(Object.assign({ t: tw, tell: tw - 4.5, dmg: 1.3, name: ['Black Hole', 'Black Hole'][j], react: 3 }, s))));
        pref(tW1 - 4.4, assign(shuffle(S), safePts(waves.w[0])));
        pref(tW1 + 0.1, assign(shuffle(S), safePts(waves.w[1])));
        call(tW1 - 4.5, `West: ${waves.ks[0]} => ${waves.ks[1]}; East: ${waves.ks[2]} => ${waves.ks[3]}`, { alert: true, dur: 8 });
      }
      // Netherworld: a stack on the nearest (or furthest) from the boss; the new betas (the first alphas) take it.
      if (nwd) {
        const farN = Math.random() < 0.5, tgt = alphas[0];
        P.labels.set(nwd, farN ? 'Netherworld Far' : 'Netherworld Near');
        const c = farN ? [0, -18.8] : [0, 4.2];
        pref(tW2 + 0.1, Object.assign(clumpAt(alphas, c, { m: 0, floor: P2F }), clumpAt(betas, farN ? [0, 9] : [0, -12], { m: 0, floor: P2F })));
        stack(tWave, [tgt], 6, 4, 'Wailing Wave', { tell: tWave - 5.5 });
        call(tWave - 5.5, `${farN ? 'Far' : 'Near'} β stack (on ${tgt})`, { alert: true, dur: 5 });
      }
      pref(tWave + 0.2, UP2);
    }

    // --- Idyllic Dream ---
    const idy = E('Idyllic Dream', p2 + 250, p2 + 300);
    if (idy) {
      const t0 = idy.t;
      const tv = [1, 2, 3, 4, 5, 6, 7, 8].map(k => E(`Twisted Vision ${k}`, t0, t0 + 200));
      const tvT = (k, d) => tOf(tv[k - 1], d);
      const meteor = E("Lindwurm's Meteor", t0, t0 + 100), down = E('Downfall', t0, t0 + 100), arc = E('Arcadian Arcanum', t0, t0 + 120);
      const W4 = ['MT', 'H1', 'M1', 'R1'], E4 = ['OT', 'H2', 'M2', 'R2'];
      // Stored Power Gusher and Snaking Kick: a clone on the north-south line; a 10-yalm circle round it and two
      // 90-degree cones from it, east and west or north and south.
      const storedAt = (tShow, tHit, name) => {
        const c = [0, pick([8, -8])], sides = Math.random() < 0.5;
        const shapes = [{ shape: 'circle', at: c, r: 10 }].concat((sides ? [90, 270] : [0, 180]).map(d => ({ shape: 'cone', at: c, deg: d, half: 45, r: 60 })));
        shapes.forEach(s => hz(Object.assign({ t: tHit, tell: tShow, dmg: 1.3, name: s.shape === 'circle' ? 'Snaking Kick' : 'Power Gusher', react: 3.5 }, s)));
        const safe = (p) => P2F(p) && shapes.every(h => !inside(h, p, 1.5));
        call(tShow, `${name}: ${sides ? 'north/south of the clone' : 'east/west of the clone'}, out of its circle`, { alert: true, dur: 5 });
        return safe;
      };
      const tStore = tOf(E('Snaking Kick', tvT(3, t0 + 65) - 1, tvT(3, t0 + 65) + 8), tvT(3, t0 + 65) + 4.4);
      const safe1 = storedAt(tvT(3, t0 + 65) - 4, tStore, 'Stored cleaves');
      pref(tStore - 3.4, assign(shuffle(S), spreadIn(8, safe1, [0, -10], 0.7)));
      // The platforms (two 10-yalm discs east and west): light parties split; Arcadian Arcanum's spreads on each.
      const tDown = tOf(down, t0 + 80), plat1 = [tDown - 3 + 0.9, tvT(4, tDown + 14) - 4 + 5.2];
      arena.push({ t: plat1[0], ...P2PLAT }, { t: plat1[1], ...CIRCLE });
      const platMarks = (a, b) => {
        mark({ shape: 'rect', a: [-4, -20], b: [4, 20] }, a, b, 'rgba(0,0,0,0.6)');
        for (const c of [[-14, 0], [14, 0]]) mark({ shape: 'circle', at: c, r: 10 }, a, b, 'rgba(120,200,255,0.18)');
      };
      platMarks(plat1[0], plat1[1]);
      const sq4 = (c) => [add(c, [-3.3, 3.3]), add(c, [3.3, 3.3]), add(c, [-3.3, -3.3]), add(c, [3.3, -3.3])];
      pref(tStore + 0.3, Object.assign(assign(W4, sq4([-14, 0])), assign(E4, sq4([14, 0]))));
      if (arc) spreads(arc.t, S, 6, 'Arcadian Arcanum', { tell: arc.t - 4.3 });
      call(tStore + 0.3, 'Platforms: G1 west, G2 east', { alert: true, dur: 5 });
      // The clones' stacks and defamations, four rounds: the defamation far north or south, everyone else stacked.
      const rounds = [1, 2, 3, 4].map(k => ({ slam: E(`Clone ${k} Heavy Slam`, t0, t0 + 130), burst: E(`Clone ${k} Mana Burst`, t0, t0 + 130) }));
      const order = shuffle(S), stkT = order.slice(0, 4), defT = order.slice(4);
      pref(plat1[1] + 0.1, clumpAt(S, [0, 0], { m: 0 }));
      let prevB = 0;
      rounds.forEach((r, k) => {
        if (!r.slam) return;
        const north = k % 2 === 0, d = defT[k], sTgt = stkT[k], tS = r.slam.t, tB2 = tOf(r.burst, tS + 1.2);
        const others = S.filter(s => s !== d);
        prevB = Math.max(tS - 4.6, prevB + 0.1);
        pref(prevB, Object.assign({ [d]: north ? [0, 19.2] : [0, -19.2] }, clumpAt(others, north ? [0, -3.5] : [0, 3.5], { m: 0 })));
        stack(tS, [sTgt], 5, 3, 'Heavy Slam', { tell: tS - 4.6, max: 7 });
        spreads(tB2, [d], 20, 'Mana Burst', { tell: tS - 4.6, own: 0.35 });
        call(prevB, `Defamation on YOU: go ${north ? 'north' : 'south'}`, { slot: d, alert: true, dur: 4 });
        call(prevB, `Stack on ${sTgt} (${north ? 'south' : 'north'})`, { dur: 4 });
        prevB = tB2;
      });
      // Twisted Vision 5: the platforms again, eight towers (four on each); then they go.
      const kiss = E('Cosmic Kiss x8', t0, t0 + 160), t5 = tvT(5, t0 + 125);
      const plat2 = [t5 + 1.3, tvT(6, t5 + 36) - 4 + 5.2];
      arena.push({ t: plat2[0], ...P2PLAT }, { t: plat2[1], ...CIRCLE });
      platMarks(plat2[0], plat2[1]);
      if (kiss) {
        const tw = (c) => [add(c, [-4.5, 4]), add(c, [4.5, 4]), add(c, [-4.5, -4]), add(c, [4.5, -4])];
        const towers = Object.assign(assign(W4, tw([-14, 0])), assign(E4, tw([14, 0])));
        pref(t5 - 3, towers);
        for (const s of S) hz({ t: kiss.t, tell: kiss.t - 4, effect: 'tower', shape: 'circle', at: towers[s], r: 3, soak: 1, dmg: 0.3, fail: 0.9, name: 'Cosmic Kiss' });
        const fireT = shuffle(S).slice(0, 2), earthT = shuffle(S.filter(s => !fireT.includes(s))).slice(0, 2);
        for (const s of fireT) debuff(s, 'hotBlooded', 'Hot-blooded', 'don\'t move', kiss.t + 0.6, kiss.t + 5.6);
        for (const s of earthT) debuff(s, 'doom', 'Doom', 'a healer cleanses it', kiss.t + 0.7, kiss.t + 8.7);
        call(kiss.t - 4, 'Towers: one each on your platform', { alert: true, dur: 4 });
        for (const e of [E("Lindwurm's Dark II x2", t0, t0 + 170), E("Lindwurm's Stone III x2", t0, t0 + 170), E("Lindwurm's Thunder II x4", t0, t0 + 170)]) {
          if (e) hz({ t: e.t, tell: e.t - 2, raidwide: true, dmg: 0.2, name: e.name.replace(/ x\d$/, '') });
        }
      }
      pref(plat2[1] + 0.1, clumpAt(S, [0, -2], { m: 0 }));
      // Reenactment 2: the player clones' defamations and stacks, north then south (towers across from them);
      // between, Twisted Vision 7's safe platform.
      const tv6 = tvT(6, t0 + 160), re2 = E('Reenactment 2', t0, t0 + 180);
      const part = (tB2, tS2, north) => {
        const ny = north ? 1 : -1;
        const defs = [[-12, 14 * ny], [12, 14 * ny]].map(c => ({ shape: 'circle', at: c, r: 20 }));
        defs.forEach(s => hz(Object.assign({ t: tB2, tell: tB2 - 6, dmg: 1.3, name: 'Mana Burst (clone)' }, s)));
        const tws = [[-6, -12 * ny], [6, -12 * ny]];
        tws.forEach(c => hz({ t: tS2, tell: tS2 - 6, effect: 'tower', shape: 'circle', at: c, r: 5, soak: [2, 4], dmg: 0.3, fail: 0.9, name: 'Heavy Slam (clone)' }));
        pref(tB2 - 5.5, Object.assign(clumpAt(W4, tws[0], { m: 0 }), clumpAt(E4, tws[1], { m: 0 })));
      };
      const b1 = E('Clone Mana Burst x2', tv6, tv6 + 15), s1 = E('Clone Heavy Slam x2', tv6, tv6 + 15);
      if (b1) part(b1.t, tOf(s1, b1.t + 0.2), true);
      // Twisted Vision 7: one platform kicked (a 10-yalm circle on it), cones north and south from it.
      const tv7 = tvT(7, t0 + 176), kick7 = E('Snaking Kick', tv7, tv7 + 8), gush7 = E('Power Gusher', tv7, tv7 + 8);
      if (kick7) {
        const plat3 = [tv7 + 1.3, tvT(8, tv7 + 7.5) - 4 + 5.2];
        arena.push({ t: plat3[0], ...P2PLAT }, { t: plat3[1], ...CIRCLE });
        platMarks(plat3[0], plat3[1]);
        const bad = pick([-14, 14]), good = -bad;
        hz({ t: kick7.t, tell: tv7 - 4, shape: 'circle', at: [bad, 0], r: 10, dmg: 1.3, name: 'Snaking Kick' });
        if (gush7) for (const d of [0, 180]) hz({ t: gush7.t, tell: tv7 - 4, shape: 'cone', at: [bad, 0], deg: d, half: 45, r: 60, dmg: 1.3, name: 'Power Gusher' });
        pref(tv7 - 3.5, clumpAt(S, [good, 0], { m: 0 }));
        call(tv7 - 4, `${good < 0 ? 'West' : 'East'} platform`, { alert: true, dur: 5 });
        pref(plat3[1] + 0.1, clumpAt(S, [0, 0], { m: 0 }));
      }
      const b2 = E('Clone Mana Burst x2', tv7 + 5, tv7 + 25), s2 = E('Clone Heavy Slam x2', tv7 + 5, tv7 + 25);
      if (b2) part(b2.t, tOf(s2, b2.t + 0.2), false);
      const g8 = E('Power Gusher', tOf(b2, tv7 + 15), tOf(b2, tv7 + 15) + 8);
      if (g8) {
        for (const d of [90, 270]) hz({ t: g8.t, tell: g8.t - 5, shape: 'cone', at: [0, 0], deg: d, half: 45, r: 60, dmg: 1.3, name: 'Power Gusher' });
        call(g8.t - 5, 'Power Gusher: north or south', { dur: 4 });
      }
      if (re2) P.labels.set(re2, 'Reenactment 2 (the clones\' defamations and towers)');
      pref(tOf(g8, tOf(b2, t0 + 195) + 5) + 0.2, UP2);
    }
    for (const ev of events) if (ev.name === 'Arcadian Hell (Boss Enrage)') P.labels.set(ev, 'Arcadian Hell (enrage)');

    P.arena = arena.sort((a, b) => a.t - b.t);
    return P;
  }

  B.FIGHT_SCRIPTS = B.FIGHT_SCRIPTS || {};
  B.FIGHT_SCRIPTS.m12s = {
    // FFLogs' max HP in an M12S kill (report PcyCvGAFRqzrXJBj): the Lindwurm 104,593,118 in phase 1 and 131,936,161
    // in phase 2 (FFLogs logs them as two encounters, 104 and 105).
    hp: 236529279,
    // Phase 1 ends when its HP does (to Refreshing Overkill and the transition); the others are the timeline's own
    // jumps: on past phase 1's enrage (the sim plays on), and over the gap before phase 2's block.
    pushes: [
      { from: 0, to: 537.5, dealt: 104593118, name: 'Phase 1 done' },
      { from: 434, to: 537.5, dealt: 0, name: 'Phase 1 over' },
      { from: 619.2, to: 1502, dealt: 0, name: 'Phase 2' },
    ],
    defaultStrat: 'modified',
    strats: {
      modified: { label: 'Modified (3VJ0) (NA)' },
      caro: { label: 'Caro/Zenith (a3V) (EU)' },
    },
    source: 'wtfdig.info/74/m12s; mechanics after BossMod (github.com/awgil/ffxiv_bossmod)',
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
