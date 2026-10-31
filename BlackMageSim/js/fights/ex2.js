// EX2, Everkeep (Extreme): Zoraal Ja's mechanics for the sim's party, on cactbot's timeline (07-dt/trial/zoraal-ja-ex,
// read straight through: it doesn't branch), and the one strat wtfdig.info lists (70/ex2): Conga/Hector (NA). Spots are
// [east, north] yalms from the arena's middle.
//
// The arena is a square turned 45 degrees (BossMod: 40 x 40 at 45 degrees): its corners on the cardinals, 28.3 yalms
// out. The script works in that square's own frame where it helps (u toward the north-east edge, v toward the north-west
// edge, both -20..20), so the game's 5-yalm tiles and lanes line up. Mechanics follow BossMod's module (github.com/awgil/
// ffxiv_bossmod, Ex2ZoraalJa: shapes and sizes from the game's Action sheet) and two FFLogs kills (the boss's and its
// helpers' positions as they cast, Might of Vollok's targets and timing), built with the sim's toolkit (js/mech.js):
//   - Multidirectional Divide: a 4-wide cross from him (the lines drop), then 11 s later an 8-wide cross and eight
//     4-wide lines from the intercardinal axes (the two layouts the logs show, turned each pull), with Forward/Backward
//     Half (he leaps; everything behind him and 10 yalms in front of him, or in front and 10 behind, plus his left or
//     right half) or Regicidal Rage (8-yalm tank busters on the tanks' tethers).
//   - Dawn of an Age: the floor falls to the middle 20 x 20 (a fall off its edge is a KO). Vollok's swords on the four
//     outer platforms (each one of the four one-per-row-and-column layouts, BossMod's and cactbot's six combinations),
//     Sync projects two platforms' swords onto the middle (5 x 5 tiles), with Half Full's side cleave. Greater Gateway,
//     Blade Warp and Forged Track: a fire lane (15 wide: go far) or a wind lane (5 wide, knocking 7 yalms either way off
//     it) from the north platforms, and narrow lanes from the south ones, leaving two tiles on the far edge; then
//     Chasm of Vollok on every player's tile (one per tile).
//   - Projection of Triumph: two lines of four swords sweep across in 10-yalm steps every 5 s (circles of 4, or 3-8
//     donuts), a second pair starting as the first is half way, with Forward/Backward Half (the first time) or Half
//     Circuit (a side cleave with a 10-yalm circle or a 10-30 donut, the second) on top.
//   - Projection of Turmoil: everyone gets Projection; a wall sweeps from the north corner to the south at 1.5 yalms a
//     second, and as it reaches each player an 8-yalm shared hit goes off on them (Magic Vulnerability Up 2 s); the
//     conga line takes them one by one, following the wall after theirs. The second time with three Half Fulls.
//   - Bitter Whirlwind: three 5-yalm busters, the main tank, then the off tank twice (the swap).
//   - Dawn of an Age 2: the middle and one more platform (north-west or north-east, 30 out). Drum of Vollok: 4-yalm
//     pair stacks on the supports, their DPS partners knocked 25 across to the other platform. Two great swords cover
//     a quadrant on each platform (one of the two facing the boss), each player's tile explodes on both platforms;
//     Aero III's tornados (25-yalm knockbacks) carry players across: the half that isn't on the side Forward/Backward
//     Half leaves safe, then the other half for Burning Chains (partners must be 15 apart). Duty's Edge: a line stack
//     for everyone, four hits.
//   - Raidwides: Actualize, Dawn of an Age; the enrage (Actualize).
// Simplified: the tiles' and lanes' layouts are drawn per pull from the patterns BossMod and cactbot describe (the
// narrow lanes cut two of the far edge's four tiles; the lanes parallel to the fire or wind sit under it); a player's
// Chasm of Vollok tile is a 5 x 5 square on them rather than snapped to the grid, and in the two-platform phase its
// copy on the other platform sits where the strat puts them; the tornados throw only at the strat's two jump times
// (walking into one otherwise does nothing); the boss faces his main tank (the sim's rule), so in the knockaround his
// model may not face the platform his cleave is aimed at; after Burning Chains the side platform's group walks back
// over the reforming floor during Actualize. Where wtfdig gives no spots (everything but the conga, the pairs and the
// light parties), they're this script's own.
(function (B) {
  const S = B.SLOTS;
  const all = (f) => Object.fromEntries(S.map(s => [s, f(s)]));
  const at = B.bearing;
  const inside = B.mechInside;
  const add = (a, b) => [a[0] + b[0], a[1] + b[1]];
  const mul = (a, k) => [a[0] * k, a[1] * k];
  const dot = (a, b) => a[0] * b[0] + a[1] * b[1];
  const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);
  const deg360 = (d) => ((d % 360) + 360) % 360;
  const pick = (a) => a[Math.floor(Math.random() * a.length)];
  const shuffle = (a) => { const b = a.slice(); for (let i = b.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [b[i], b[j]] = [b[j], b[i]]; } return b; };
  const r2 = (p) => [+p[0].toFixed(2), +p[1].toFixed(2)];
  const assign = (slots, pts) => Object.fromEntries(slots.map((s, i) => [s, pts[i]]));
  const SUP = ['MT', 'OT', 'H1', 'H2'], DPS = ['M1', 'M2', 'R1', 'R2'], TANKS = ['MT', 'OT'];
  const PARTNER = { MT: 'M1', OT: 'M2', H1: 'R1', H2: 'R2' };
  const COMPASS = ['north', 'north-northeast', 'northeast', 'east-northeast', 'east', 'east-southeast', 'southeast', 'south-southeast',
    'south', 'south-southwest', 'southwest', 'west-southwest', 'west', 'west-northwest', 'northwest', 'north-northwest'];
  const dirName = (deg) => COMPASS[Math.round(deg360(deg) / 22.5) % 16];
  const brg = (p) => deg360(Math.atan2(p[0], p[1]) * 180 / Math.PI);

  // ---------- the square's own frame ----------
  // u toward the north-east edge, v toward the north-west edge; the middle platform is -10..10 in both, the arena
  // -20..20, the outer platforms 10 x 10 squares 30 out on the intercardinals.
  const RT = Math.SQRT2;
  const C = (u, v) => [(u - v) / RT, (u + v) / RT];                    // the square's frame -> compass [E, N]
  const Lc = (p) => [(p[0] + p[1]) / RT, (p[1] - p[0]) / RT];          // compass -> the square's frame
  const brgL = (du, dv) => deg360(brg(C(du, dv)));                    // the bearing of a direction in that frame
  const PLAT = { main: [0, 0], NE: [30, 0], NW: [0, 30], SE: [0, -30], SW: [-30, 0] };
  const OUTER = ['NE', 'NW', 'SE', 'SW'];
  // A square of the frame as the sim's floor: the axis-aligned rectangles inscribed in it (corners on its edges), a
  // step apart; their union is the square to within a step.
  function square(cl, half, step) {
    const c = C(cl[0], cl[1]), R = half * RT, out = [];
    for (let X = step / 2; X < R; X += step) out.push({ shape: 'rect', a: r2([c[0] - X, c[1] - (R - X)]), b: r2([c[0] + X, c[1] + (R - X)]) });
    return out;
  }
  const NORMAL = { parts: square([0, 0], 20, 0.5) };
  const SMALL = { parts: square([0, 0], 10, 0.25), deathwall: true };
  const TWO = (side) => ({ parts: square([0, 0], 10, 0.25).concat(square(PLAT[side], 10, 0.25)), deathwall: true });
  const BACK = (side) => ({ parts: square([0, 0], 20, 0.5).concat(square(PLAT[side], 10, 0.5)) });
  // Whether p is on these platforms (the frame's squares: [centre, half]) with m to spare.
  const onSq = (sqs, m) => (p) => { const l = Lc(p); return sqs.some(([c, h]) => Math.abs(l[0] - c[0]) < h - m && Math.abs(l[1] - c[1]) < h - m); };
  const BIG = [[[0, 0], 20]], MID = [[[0, 0], 10]];

  // Tiles: (i, j), 0-3 along u and v, on a platform; a tile's or quadrant's shape (turned with the square).
  const tileL = (pl, i, j) => [pl[0] - 7.5 + 5 * i, pl[1] - 7.5 + 5 * j];
  const tileAt = (pl, i, j) => C(...tileL(pl, i, j));
  const tileShape = (p) => ({ shape: 'line', at: r2(p), deg: 45, len: 2.5, back: 2.5, w: 5 });
  const quadShape = (p) => ({ shape: 'line', at: r2(p), deg: 45, len: 5, back: 5, w: 10 });
  const TILE_NAME = {
    '3,3': 'north corner', '0,0': 'south corner', '3,0': 'east corner', '0,3': 'west corner',
    '2,2': 'inner north', '1,1': 'inner south', '2,1': 'inner east', '1,2': 'inner west',
    '1,3': 'north-west edge (west)', '2,3': 'north-west edge (north)', '3,2': 'north-east edge (north)', '3,1': 'north-east edge (east)',
    '2,0': 'south-east edge (east)', '1,0': 'south-east edge (south)', '0,1': 'south-west edge (south)', '0,2': 'south-west edge (west)',
  };
  // Vollok's sword layouts on a platform: one per row and column (row j of column i: LAYOUT[i]); the four tile the
  // platform between them, so any two of them project eight tiles (cactbot's six combinations).
  const LAYOUTS = { D: [0, 1, 2, 3], A: [3, 2, 1, 0], K1: [1, 3, 0, 2], K2: [2, 0, 3, 1] };

  // n points near `want` clear of every shape in hs (by m, a bot's margin and a little), on the floor (ok), gap apart.
  function clump(hs, want, n, ok, o) {
    o = o || {};
    const m = o.m === undefined ? 1.3 : o.m, gap = o.gap || 0.55;
    const good = (p) => ok(p) && hs.every(h => !inside(h, p, m));
    const out = [];
    if (good(want)) out.push(want.slice());
    for (let r = 0.3; r <= (o.reach || 18) && out.length < n; r += 0.3) {
      const k = Math.max(6, Math.round(2 * Math.PI * r / 0.3));
      for (let j = 0; j < k && out.length < n; j++) {
        const a = (j / k) * 2 * Math.PI, p = [want[0] + Math.sin(a) * r, want[1] + Math.cos(a) * r];
        if (good(p) && out.every(q => dist(q, p) >= gap)) out.push(p);
      }
    }
    if (!out.length) return null;
    while (out.length < n) out.push(out[0].slice());
    return out.map(r2);
  }
  // The nearest point to `want` clear of hs (by m) on the floor, or null.
  const safeNear = (hs, want, ok, m, reach) => { const c = clump(hs, want, 1, ok, { m, reach }); return c && c[0]; };

  // ---------- the party's places ----------
  // Uptime: the main tank north (he faces it: "front" is north), everyone else at his back; his hitbox is 10.
  const UP = { MT: [0, 8.5], OT: [3, 8], H1: [-6, -7.5], H2: [6, -7.5], M1: [-2.5, -8], M2: [2.5, -8], R1: [-4, -11], R2: [4, -11] };
  // The same on the middle platform.
  const UP2 = { MT: [0, 7.5], OT: [2.5, 6.5], H1: [-4.5, -5], H2: [4.5, -5], M1: [-1.8, -6.5], M2: [1.8, -6.5], R1: [-3.5, -8.5], R2: [3.5, -8.5] };
  // Projection of Turmoil's conga (wtfdig's, at the spacing the logs show): the tanks at the north edge, 10 apart, then
  // M1, M2, H1, H2, R1, R2 down the middle; after their own hit each follows the wall at their own offset.
  const CONGA = { MT: [-5, 21.3], OT: [5, 21.3], M1: [0, 14.5], M2: [0, 8.2], H1: [0, 1.4], H2: [0, -5.9], R1: [0, -12.1], R2: [0, -18.4] };
  const FOLLOW_E = { MT: -5, OT: 5, M1: -2.4, M2: 2.4, H1: -3.6, H2: 3.6, R1: -1.2, R2: 1.2 };
  // Chasm of Vollok's spread after Forged Track: one tile each, a checkerboard.
  const SPREAD_TILE = { MT: [3, 3], OT: [2, 2], M1: [1, 3], M2: [3, 1], H1: [0, 2], H2: [2, 0], R1: [1, 1], R2: [0, 0] };
  // Drum of Vollok's pairs, along the edge facing the other platform (wtfdig: H1, MT, OT, H2 from the north end; each
  // support with its DPS partner on the outside, knocked across): p along the edge, s toward the other platform.
  const DRUM_P = { H1: 7.5, MT: 2.5, OT: -2.5, H2: -7.5 };

  // ---------- the pull ----------
  function plan(events, strat) {
    const P = { start: Object.assign({}, UP), prefs: [], hazards: [], checks: [], calls: [], marks: [], labels: new Map(), debuffs: [],
      boss: [{ t: 0, at: [0, 0] }], hitbox: [{ t: 0, r: 10.05 }], arena: [], looks: [] };
    let id = 0;
    const hz = (o) => { const h = Object.assign({ id: ++id, react: 3 }, o); P.hazards.push(h); return h; };
    const pref = (t, spots) => P.prefs.push({ t: +t.toFixed(2), spots });
    const call = (t, text, o) => P.calls.push(Object.assign({ t: +t.toFixed(2), text }, o));
    const debuff = (slot, key, name, hint, t0, t1) => P.debuffs.push({ slot, key, name, hint, t0, t1 });
    const mark = (o) => P.marks.push(Object.assign({ kind: 'lit' }, o));
    const evs = (name) => events.filter(e => e.name === name);
    const T = (name, k, d) => { const e = evs(name)[k]; return e ? e.t : d; };
    const label = (name, k, text) => { const e = evs(name)[k]; if (e) P.labels.set(e, text); return e; };
    const ARENA = P.arena, LOOKS = P.looks;
    const arenaAt = (t, a) => ARENA.push(Object.assign({ t: +t.toFixed(2) }, a));
    const raidwide = (t, cast, name, dmg, text) => { hz({ t, tell: t - cast, raidwide: true, dmg, name }); call(t - cast, text || 'Raidwide', { dur: 3 }); };
    const boss = (t, p, move) => P.boss.push({ t: +t.toFixed(2), at: p, move });
    // The dark beyond the floor (the frame's strips, cut to the drawn box), for the phases with a fall.
    const VOID = 'rgba(6,3,14,0.6)';
    const voidStrip = (u0, u1, v0, v1, t0, t1) => mark({ shape: 'line', at: r2(C(u0, (v0 + v1) / 2)), deg: 45, len: u1 - u0, w: v1 - v0, t0, t1, fill: VOID });
    const voidAround = (t0, t1, side) => {
      if (!side) { voidStrip(10, 45, -45, 45, t0, t1); voidStrip(-45, -10, -45, 45, t0, t1); voidStrip(-10, 10, 10, 45, t0, t1); voidStrip(-10, 10, -45, -10, t0, t1); return; }
      const sw = (u0, u1, v0, v1) => (side === 'NW' ? voidStrip(u0, u1, v0, v1, t0, t1) : voidStrip(v0, v1, u0, u1, t0, t1));
      sw(10, 45, -45, 60); sw(-45, -10, -45, 60); sw(-10, 10, 10, 20); sw(-10, 10, 40, 60); sw(-10, 10, -45, -10);
    };

    // ===== the phases' times (cactbot's timeline) =====
    const actualize = evs('Actualize').filter(e => e.kind !== 'enrage').map(e => e.t);       // 16, 151.4, 202.4, 390.5, 616.9
    const dawn = evs('Dawn Of An Age').map(e => e.t);                                          // 74.2, 286.3, 526.8
    const tEnrage = (evs('Actualize').find(e => e.kind === 'enrage') || { t: 657.6 }).t;
    actualize.forEach((t) => raidwide(t, 5, 'Actualize', 0.45));
    dawn.forEach((t, k) => { raidwide(t, 7, 'Dawn of an Age', 0.5, 'Raidwide: the floor falls (into the middle)'); label('Dawn Of An Age', k, 'Dawn of an Age (the floor falls)'); });
    label('Actualize', evs('Actualize').length - 1, 'Actualize (the enrage)');

    // The floor and its look: the middle platform's model (a1_stc00) shows while the floor is down (lifted a touch off
    // the room's own floor), moved to the other platform for the knockaround.
    const side = pick(['NW', 'NE']);
    const sideC = C(...PLAT[side]);
    const tPlat = dawn[1] + 4.9;
    arenaAt(0, NORMAL);
    arenaAt(dawn[0], SMALL); arenaAt(actualize[1], NORMAL);
    arenaAt(dawn[1], SMALL); arenaAt(tPlat, TWO(side)); arenaAt(actualize[3] - 5, BACK(side)); arenaAt(actualize[3], NORMAL);
    arenaAt(dawn[2], SMALL); arenaAt(actualize[4], NORMAL);
    LOOKS.push({ t: 0, show: [] }, { t: dawn[0], show: ['a1_stc00'], lift: 0.03 }, { t: actualize[1], show: [] },
      { t: dawn[1], show: ['a1_stc00'], lift: 0.03 }, { t: tPlat, show: ['a1_stc00'], lift: 0.03, shift: r2(sideC) }, { t: actualize[3], show: [] },
      { t: dawn[2], show: ['a1_stc00'], lift: 0.03 }, { t: actualize[4], show: [] });
    voidAround(dawn[0], actualize[1]); voidAround(dawn[1], tPlat); voidAround(tPlat, actualize[3] - 5, side); voidAround(dawn[2], actualize[4]);
    // Into the middle for each Dawn of an Age; back out after Actualize.
    dawn.forEach(t => pref(t - 7 + 0.2, UP2));
    [actualize[1], actualize[4]].forEach(t => pref(t + 0.3, UP));

    // ===== Multidirectional Divide =====
    // The eight lines: from the u axis toward +v and from the v axis toward +u, at the two layouts the logs show, the
    // whole turned by rot quarter turns.
    function mdLines(parity, rot) {
      const U = parity ? [-14, -6, 10, 18] : [-18, -10, 6, 14], V = parity ? [14, 6, -10, -18] : [18, 10, -6, -14];
      const turn = (q) => { let [x, y] = q; for (let k = 0; k < rot; k++) [x, y] = [-y, x]; return [x, y]; };
      const segs = U.map(a => [[a, 0], [0, 1]]).concat(V.map(b => [[0, b], [1, 0]]));
      return segs.map(([p, d]) => { const q = turn(p), e = turn(d); return { shape: 'line', at: r2(C(q[0], q[1])), deg: brgL(e[0], e[1]), len: 40, w: 4 }; });
    }
    const CROSS8 = { shape: 'cross', at: [0, 0], deg: 0, len: 30, w: 8 }, CROSS4 = { shape: 'cross', at: [0, 0], deg: 0, len: 30, w: 4 };
    // Forward/Backward Half from bc facing F: the edge (behind him and 10 in front, or the reverse) and the side he cleaves.
    function fbHalf(bc, F, front, safeRight) {
      const cd = at(front ? F + 180 : F, 1), sd = at(safeRight ? F - 90 : F + 90, 1);
      return [{ shape: 'half', dir: r2(cd), off: +(dot(bc, cd) - 10).toFixed(2) }, { shape: 'half', dir: r2(sd), off: +dot(bc, sd).toFixed(2) }];
    }
    const fbText = (front, safeRight) => `${front ? 'Front' : 'Behind'} + Boss's ${safeRight ? 'Right' : 'Left'}`;
    const okBig = onSq(BIG, 1.3);
    let mdRot = Math.floor(Math.random() * 4), mdPar = Math.random() < 0.5 ? 0 : 1;
    function divide(k, kind) {
      const tDrop = T('Multidirectional Divide (lines drop)', k), tLines = T('Multidirectional Divide', k);
      if (tDrop === undefined || tLines === undefined) return;
      const cs = tDrop - 5;
      hz({ t: tDrop, tell: cs, dmg: 1.2, name: 'Multidirectional Divide', ...CROSS4 });
      label('Multidirectional Divide (lines drop)', k, 'Multidirectional Divide (the cross; the lines drop)');
      label('Multidirectional Divide', k, 'Multidirectional Divide (the criss-cross)');
      call(cs, 'Out of the cross; watch where the lines drop', { dur: 4 });
      if (kind === 'half') {
        // Forward/Backward Half with it: a pull's pick that leaves room in its quadrant.
        const tH = T('Half Full', evs('Half Full').findIndex(e => Math.abs(e.t - tLines) < 3)) || tLines + 1.1;
        let lines, fb, front, safeRight, spot, tries = 0;
        do {
          if (tries++) { mdRot = Math.floor(Math.random() * 4); mdPar = 1 - mdPar; }
          lines = [CROSS8].concat(mdLines(mdPar, mdRot));
          front = Math.random() < 0.5; safeRight = Math.random() < 0.5;
          fb = fbHalf([0, 0], 0, front, safeRight);
          spot = clump(lines.concat(fb), [safeRight ? 8 : -8, front ? 15 : -15], 8, okBig, { m: 1.35, gap: 0.5 });
        } while (!spot && tries < 60);
        lines.forEach(s => hz({ t: tLines, tell: cs, dmg: 1.3, name: 'Multidirectional Divide', ...s }));
        const tHit = tH + 0.1;
        fb.forEach((s, j) => hz({ t: tHit, tell: tH - 9, dmg: 1.4, name: j ? 'Half Full' : (front ? 'Forward Edge' : 'Backward Edge'), react: 3.5, ...s }));
        const he = evs('Half Full').find(e => Math.abs(e.t - tH) < 0.5), ee = evs('Forward Edge/Backward Edge').find(e => Math.abs(e.t - tH) < 0.5);
        if (he) { P.labels.set(he, `${front ? 'Forward' : 'Backward'} Half (${front === safeRight ? 'right' : 'left'} sword: ${fbText(front, safeRight).toLowerCase()})`); if (!he.cast) he.cast = 9; }
        if (ee) P.labels.set(ee, front ? 'Forward Edge' : 'Backward Edge');
        // Clear of the lines behind him till the cleave shows which quadrant; then its checkerboard spot.
        const pre = clump(lines, [0, -12], 8, okBig, { m: 1.35, gap: 0.55 });
        if (pre) pref(tDrop + 0.2, assign(S, pre));
        if (spot) pref(tH - 9 + 0.2, assign(shuffle(S), spot));
        call(tH - 9, `${fbText(front, safeRight)}: checkerboard safe spot ${dirName(brg(spot ? spot[0] : [1, 1]))}`, { alert: true, dur: 6 });
        pref(tHit + 0.2, UP);
      } else {
        // Regicidal Rage with it: the party clear of the lines behind him, the tanks out to either side of it.
        const tR = T('Regicidal Rage', 0, tLines + 0.2) + 0.1, cR = tR - 8.1;
        const lines = [CROSS8].concat(mdLines(mdPar, mdRot));
        const party = clump(lines, [0, -12], 6, okBig, { m: 1.35, gap: 0.55 }) || clump(lines, [0, -12], 6, onSq(BIG, 1.1), { m: 1.15 });
        const pc = party ? party[0] : [0, -12];
        const tankOk = (p) => okBig(p) && dist(p, pc) > 11.5;
        const mt = safeNear(lines, [-12, 6], tankOk, 1.35) || [-12, 6], ot = safeNear(lines, [12, 6], (p) => tankOk(p) && dist(p, mt) > 10, 1.35) || [12, 6];
        lines.forEach(s => hz({ t: tLines, tell: cs, dmg: 1.3, name: 'Multidirectional Divide', ...s }));
        hz({ t: tR, tell: cR, effect: 'bait', shape: 'circle', from: 'target', targets: TANKS, r: 8, dmg: 1.2, own: 0.55, buster: true, tether: 'boss', name: 'Regicidal Rage' });
        pref(tDrop + 0.2, Object.assign(assign(['H1', 'H2', 'M1', 'M2', 'R1', 'R2'], party || S.map(() => pc)), { MT: mt, OT: ot }));
        for (const s of TANKS) call(cR, 'Tank tethers: grab one, away from the party', { slot: s, alert: true, dur: 5 });
        call(cR, 'Avoid the tank tethers', { dur: 4 });
        label('Regicidal Rage', 0, 'Regicidal Rage (tank tethers)');
        pref(tR + 0.2, UP);
      }
    }
    divide(0, 'half');
    mdPar = 1 - mdPar;
    divide(1, 'rage');
    mdRot = Math.floor(Math.random() * 4); mdPar = Math.random() < 0.5 ? 0 : 1;
    divide(2, 'half');

    // ===== the swords phases =====
    // Vollok's layouts on the four outer platforms, and the two Sync projects; the projected tiles on the middle.
    function vollokSmall(kV, kS, tSwords) {
      const tV = T('Vollok', kV), tS = T('Sync', kS);
      const lay = shuffle(['D', 'A', 'K1', 'K2']), on = Object.fromEntries(OUTER.map((o, j) => [o, lay[j]]));
      const synced = shuffle(OUTER).slice(0, 2), bad = new Set();
      for (const o of synced) LAYOUTS[on[o]].forEach((j, i) => bad.add(`${i},${j}`));
      const tiles = [...bad].map(k => k.split(',').map(Number));
      tiles.forEach(([i, j]) => hz({ t: tSwords, tell: tS - 4, dmg: 1.3, name: 'Chasm of Vollok', react: 3.5, ...tileShape(tileAt(PLAT.main, i, j)) }));
      label('Vollok', kV, 'Vollok (swords on the outer platforms)');
      label('Sync', kS, `Sync (the ${synced.join(' and ')} platforms' swords)`);
      const ce = events.find(e => e.name === 'Chasm Of Vollok' && Math.abs(e.t - tSwords) < 0.3);
      if (ce) P.labels.set(ce, 'Chasm of Vollok (the projected swords)');
      call(tS - 5, `Sync: the ${synced.join(' and ')} platforms' swords project onto the middle`, { dur: 4 });
      const safe = [];
      for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) if (!bad.has(`${i},${j}`)) safe.push([i, j]);
      return { bad, safe, tiles, tV, tS };
    }

    // Swords 1: Chasm of Vollok with Half Full (he faces north: east or west safe), by cactbot's "inside" priority.
    (function swords1() {
      const tSw = T('Chasm Of Vollok', 0), tHF = T('Half Full', evs('Half Full').findIndex(e => Math.abs(e.t - tSw) < 2)) || tSw + 0.6;
      const V = vollokSmall(0, 0, tSw);
      const east = Math.random() < 0.5, sg = east ? 1 : -1, cs = tHF - 6;
      const half = { shape: 'half', dir: [-sg, 0], off: 0 };
      hz({ t: tHF + 0.3, tell: cs, dmg: 1.4, name: 'Half Full', react: 3.5, ...half });
      const he = evs('Half Full').find(e => Math.abs(e.t - tHF) < 0.5);
      if (he) { P.labels.set(he, `Half Full (${east ? 'left' : 'right'} sword: ${east ? 'east' : 'west'} safe)`); if (!he.cast) he.cast = 6; }
      const has = (i, j) => !V.bad.has(`${i},${j}`);
      let tile, text;
      if (has(2, 1)) { tile = east ? [2, 1] : [1, 2]; text = east ? 'Inner East Diamond' : 'Inner West Diamond'; }
      else if (has(2, 2)) { tile = [2, 2]; text = `Inner North/South Diamonds - Lean ${east ? 'East' : 'West'}`; }
      else { tile = east ? [3, 1] : [0, 2]; text = `Outer Intercard Diamonds - ${east ? 'East' : 'West'}`; }
      const c = tileAt(PLAT.main, ...tile), want = [c[0] + (Math.abs(c[0]) < 0.1 ? sg * 1.6 : 0), c[1]];
      const hs = V.tiles.map(([i, j]) => tileShape(tileAt(PLAT.main, i, j))).concat([half]);
      const spot = clump(hs, want, 8, onSq(MID, 1.3), { m: 1.2, gap: 0.5 }) || S.map(() => want);
      pref(cs + 0.2, assign(S, spot));
      call(cs, text, { alert: true, dur: 6 });
      pref(tHF + 0.5, UP2);
    })();

    // Forged Track: the fire or wind lane from a north platform, the narrow lanes from the south ones; then each
    // player's tile goes off (one per tile).
    function forged(kGate, kTrack, kCells) {
      const tGate = T('Greater Gateway', kGate), tTrack = T('Forged Track', 2 * kTrack), tLanes = T('Forged Track', 2 * kTrack + 1);
      const tCells = T('Chasm Of Vollok', kCells);
      if (tGate === undefined || tLanes === undefined) return;
      const north = pick(['NW', 'NE']), fire = Math.random() < 0.5, k = pick([1, 2]), safeIdx = k === 2 ? 0 : 3;
      // NW's lanes run north-west to south-east (constant u), NE's north-east to south-west (constant v).
      const ax = north === 'NW' ? 'u' : 'v', other = ax === 'u' ? 'v' : 'u';
      const lane = (a, idx, w) => (a === 'u' ? { shape: 'line', at: r2(C(-7.5 + 5 * idx, -10)), deg: 315, len: 20, w } : { shape: 'line', at: r2(C(-10, -7.5 + 5 * idx)), deg: 45, len: 20, w });
      const cut = pick([[1, 2], [0, 3], [0, 2], [1, 3]]), keep = [0, 1, 2, 3].filter(j => !cut.includes(j));
      const par = [k, k + (k === 2 ? 1 : -1)];
      const tileOf = (a, idx, j) => (a === 'u' ? [idx, j] : [j, idx]);              // the tile at lane index idx along the axis, j across
      const tells = tTrack;
      const narrow = cut.map(j => lane(other, j, 5)).concat(par.map(j => lane(ax, j, 5)));
      narrow.forEach(s => hz({ t: tLanes, tell: tells, dmg: 1.3, name: 'Forged Track', react: 3.5, ...s }));
      const uc = -7.5 + 5 * k;
      if (fire) hz({ t: tLanes + 0.1, tell: tells, dmg: 1.4, name: 'Fiery Edge', react: 3.5, ...lane(ax, k, 15) });
      else {
        hz({ t: tLanes + 0.1, tell: tells, dmg: 1.4, name: 'Stormy Edge', react: 3.5, ...lane(ax, k, 5) });
        const pl = ax === 'u' ? { at: C(uc + 2.5, 0), deg: 45 } : { at: C(0, uc + 2.5), deg: 315 };
        const mi = ax === 'u' ? { at: C(uc - 2.5, 0), deg: 225 } : { at: C(0, uc - 2.5), deg: 135 };
        [pl, mi].map(o => ({ shape: 'line', at: r2(o.at), deg: o.deg, len: 10, w: 20, dir: o.deg })).forEach(s => hz({ t: tLanes + 0.6, tell: tells, effect: 'knockback', dist: 7, name: 'Stormy Edge (knockback)', ...s }));
      }
      const fe = evs('Fiery Edge/Stormy Edge')[kTrack];
      if (fe) P.labels.set(fe, fire ? 'Fiery Edge (the lane widens to three)' : 'Stormy Edge (knockback off the lane)');
      label('Greater Gateway', kGate, `Greater Gateway (${fire ? 'fire' : 'wind'} portal, ${north})`);
      label('Forged Track', 2 * kTrack, 'Forged Track (the swords tethered)');
      label('Forged Track', 2 * kTrack + 1, 'Forged Track (the lanes)');
      // Where to stand: fire, on the far edge's two tiles; wind, next to the lane on their rows, to be thrown there.
      const safeTiles = keep.map(j => tileOf(ax, safeIdx, j));
      const toward = safeIdx === 0 ? -1 : 1;
      const spots = {};
      [SUP, DPS].forEach((grp, g) => {
        const j = keep[g], c = tileAt(PLAT.main, ...tileOf(ax, safeIdx, j));
        grp.forEach((s, n) => {
          const off = (n - 1.5) * 0.75;
          if (fire) { const l = Lc(c); spots[s] = r2(ax === 'u' ? C(l[0] + (n % 2 ? 0.6 : -0.6), l[1] + off) : C(l[0] + off, l[1] + (n % 2 ? 0.6 : -0.6))); }
          else { const a = uc + toward * (2.5 + 1.0 + 0.5), cc = -7.5 + 5 * j; spots[s] = r2(ax === 'u' ? C(a, cc + off) : C(cc + off, a)); }
        });
      });
      pref(tTrack + 0.2, spots);
      const dirN = { u: safeIdx === 0 ? 'Southwest' : 'Northeast', v: safeIdx === 0 ? 'Southeast' : 'Northwest' }[ax];
      const corners = cut.join() === '1,2';
      const tileText = corners ? 'Corners Safe' : safeTiles.map(t => TILE_NAME[t.join()]).join(' / ');
      call(tTrack - 4 + 0.6, `${fire ? 'Go Far' : 'Knockback'} ${dirN} + ${tileText}`, { alert: true, dur: 9 });
      if (!fire) call(tTrack + 0.6, 'Next to the wind lane on your tile\'s row: it throws you onto the edge', { dur: 5 });
      // Chasm of Vollok: everyone's tile goes off; one per tile (a checkerboard).
      if (tCells !== undefined) {
        const tIcon = tLanes - 1.2;
        pref(tLanes + (fire ? 0.4 : 1.2), all(s => r2(tileAt(PLAT.main, ...SPREAD_TILE[s]))));
        hz({ t: tCells, tell: tIcon, effect: 'bait', from: 'target', targets: S.slice(), dmg: 1.0, own: 0.3, name: 'Chasm of Vollok', ...tileShape([0, 0]), at: undefined });
        for (const s of S) call(tIcon, `Spread: one per tile (yours: ${TILE_NAME[SPREAD_TILE[s].join()]})`, { slot: s, alert: true, dur: 5 });
        label('Chasm Of Vollok', kCells, 'Chasm of Vollok (each player\'s tile)');
      }
    }
    forged(0, 0, 1);

    // ===== Projection of Triumph =====
    // Two lines of four swords (circles or donuts) sweep across from opposite sides, 10 yalms a step; a second pair (the
    // other way round) starts on the first's third step.
    function triumph(kProj, steps) {
      const tP = T('Projection Of Triumph', kProj);
      if (tP === undefined || steps.length < 6) return null;
      const ax = pick(['u', 'v']), s1 = pick([1, -1]);
      const T1 = steps.slice(0, 4), T2 = [steps[2] + 0.25, steps[3] + 0.1, steps[4], steps[5]];
      const lines = [{ kind: 'circle', from: s1, ts: T1, show: tP + 5 }, { kind: 'donut', from: -s1, ts: T1, show: tP + 5 },
        { kind: 'donut', from: s1, ts: T2, show: T1[1] }, { kind: 'circle', from: -s1, ts: T2, show: T1[1] }];
      const W = [-15, -5, 5, 15];
      for (const ln of lines) {
        ln.ts.forEach((t, k) => {
          const c = ln.from * (15 - 10 * k);
          for (const w of W) {
            const p = r2(ax === 'u' ? C(c, w) : C(w, c));
            const shp = ln.kind === 'circle' ? { shape: 'circle', at: p, r: 4 } : { shape: 'donut', at: p, r0: 3, r1: 8 };
            hz({ t: +t.toFixed(2), tell: +(k ? ln.ts[k - 1] : Math.min(ln.show, t - 5)).toFixed(2), dmg: 1.3, name: ln.kind === 'circle' ? 'Walls of Vollok' : 'Siege of Vollok', react: 4.6, ...shp });
          }
        });
      }
      const startDir = (sg) => brgL(ax === 'u' ? sg : 0, ax === 'v' ? sg : 0);
      call(tP - 5, `Sword lines: circles from the ${dirName(startDir(s1))}, donuts from the ${dirName(startDir(-s1))}: on the swords for donuts, between them for circles`, { alert: true, dur: 8 });
      evs('Siege Of Vollok/Walls Of Vollok').forEach(e => { if (e.t > tP && e.t < tP + 40) P.labels.set(e, 'Walls of Vollok (circles) and Siege of Vollok (donuts)'); });
      label('Projection Of Triumph', kProj, 'Projection of Triumph (sword lines)');
      return { T1, T2 };
    }
    const siege = evs('Siege Of Vollok/Walls Of Vollok').map(e => e.t);
    // Lines 1, with Forward/Backward Half after the fourth step.
    (function lines1() {
      const tP = T('Projection Of Triumph', 0);
      const steps = siege.filter(t => t > tP && t < tP + 40);
      const r = triumph(0, steps);
      if (!r) return;
      pref(tP - 5 + 0.2, UP);
      const he = evs('Half Full').find(e => e.t > tP && e.t < tP + 40), tH = he ? he.t : steps[3] + 3.5;
      const front = Math.random() < 0.5, safeRight = Math.random() < 0.5, fb = fbHalf([0, 0], 0, front, safeRight);
      fb.forEach((s, j) => hz({ t: tH + 0.1, tell: tH - 9, dmg: 1.4, name: j ? 'Half Full' : (front ? 'Forward Edge' : 'Backward Edge'), react: 3.4, ...s }));
      if (he) { P.labels.set(he, `${front ? 'Forward' : 'Backward'} Half (${fbText(front, safeRight).toLowerCase()})`); if (!he.cast) he.cast = 9; }
      const ee = evs('Forward Edge/Backward Edge').find(e => he && Math.abs(e.t - he.t) < 0.5);
      if (ee) P.labels.set(ee, front ? 'Forward Edge' : 'Backward Edge');
      const q = [safeRight ? 7 : -7, front ? 15 : -15];
      pref(tH - 9 + 0.1, assign(S, clump(fb, q, 8, okBig, { gap: 0.7 }) || S.map(() => q)));
      call(tH - 9, fbText(front, safeRight), { alert: true, dur: 6 });
      pref(tH + 0.3, all(s => r2(mul(UP[s], 0.6))));
    })();

    // ===== Projection of Turmoil =====
    // The wall sweeps from the north corner at 1.5 yalms a second (the logs' pace); each player's 8-yalm shared hit when
    // it reaches them; after it they follow the wall. The second time Half Full cleaves east or west three times.
    function turmoil(k, halves) {
      const tP = T('Projection Of Turmoil', k), tM = T('Might Of Vollok', k);
      if (tP === undefined || tM === undefined) return;
      const t0 = tM + 2.8, RN = 28.28, speed = 1.5, lineN = (t) => RN - speed * (t - t0);
      const hitT = (s) => t0 + (RN - CONGA[s][1]) / speed;
      label('Projection Of Turmoil', k, 'Projection of Turmoil (the wall: everyone has Projection)');
      if (evs('Might Of Vollok')[k]) P.labels.set(evs('Might Of Vollok')[k], 'Might of Vollok (the wall sweeps north to south)');
      pref(tP - 5 + 0.2, CONGA);
      for (const s of S) {
        debuff(s, 'projection', 'Projection', 'the wall sets it off as it reaches you', tP + 1.2, hitT(s));
        hz({ t: +hitT(s).toFixed(2), tell: +(hitT(s) - 4).toFixed(2), effect: 'share', shape: 'circle', from: 'target', targets: [s], r: 8, min: 1, dmg: 0.55, status: ['magicVuln', 2], name: 'Might of Vollok' });
      }
      call(tP - 5, 'Conga line: tanks at the north edge, then M1, M2, H1, H2, R1, R2', { alert: true, dur: 6 });
      for (const s of TANKS) call(tP - 5, 'Take the first wall hit solo (mitigate)', { slot: s, dur: 6 });
      // The half cleaves (the second time): everyone over to the safe side while each is coming.
      const windows = (halves || []).map(h => ({ c: h.t - 6, t: h.t + 0.3, sg: Math.random() < 0.5 ? 1 : -1, ev: h }));
      windows.forEach(w => {
        hz({ t: +w.t.toFixed(2), tell: w.c, dmg: 1.4, name: 'Half Full', react: 4, shape: 'half', dir: [-w.sg, 0], off: 0 });
        P.labels.set(w.ev, `Half Full (${w.sg > 0 ? 'east' : 'west'} safe)`);
        if (!w.ev.cast) w.ev.cast = 6;
        call(w.c, `Boss's ${w.sg > 0 ? 'Right' : 'Left'}: ${w.sg > 0 ? 'east' : 'west'} side of the line`, { alert: true, dur: 5 });
      });
      const rank = Object.fromEntries(S.map((s, i) => [s, i]));
      const eAt = (s, t, base) => { const w = windows.find(x => t >= x.c && t < x.t + 0.2); return w ? w.sg * (2.2 + 0.4 * rank[s]) : base; };
      const last = Math.max(...S.map(hitT));
      for (const s of S) {
        const th = hitT(s);
        const follow = (t) => { const e = eAt(s, t, FOLLOW_E[s]); return [e, Math.max(-26 + Math.abs(e), Math.min(lineN(t) + 2.2, 26.6 - Math.abs(e)))]; };
        if (windows.length) pref(tP + 1, { [s]: (t) => (t < th ? [eAt(s, t, CONGA[s][0]), CONGA[s][1]] : follow(t)) });
        pref(th + 0.05, { [s]: follow });
      }
      // The wall itself.
      for (let t = t0; t < t0 + 2 * RN / speed; t += 0.25) {
        const n = lineN(t), half = RN - Math.abs(n);
        if (half < 0.3) continue;
        mark({ shape: 'line', at: r2([-half, n]), deg: 90, len: +(2 * half).toFixed(2), w: 0.7, t0: +t.toFixed(2), t1: +(t + 0.25).toFixed(2), fill: 'rgba(150,215,255,0.7)' });
      }
      // He follows his tank south as the wall goes; then Bitter Whirlwind: the main tank, then the off tank twice.
      boss(tP - 4, [0, 9], 1.5);
      boss(tP + 13, [0, -10], 24);
      const tB = [1, 2, 3].map(n => T(`Bitter Whirlwind (${n})`, k));
      if (tB[0] !== undefined) {
        pref(Math.max(last, ...windows.map(w => w.t)) + 0.3, Object.assign(assign(S.filter(s => !TANKS.includes(s)), clump([], [0, -1.5], 6, okBig, { gap: 0.8 })), { MT: [-3.5, -21], OT: [3.5, -20.5] }));
        tB.forEach((t, n) => hz({ t, tell: n ? tB[n - 1] : t - 5, effect: 'bait', shape: 'circle', from: 'target', targets: [n ? 'OT' : 'MT'], r: 5, dmg: 1.2, own: 0.55, buster: true, name: 'Bitter Whirlwind' }));
        call(tB[0] - 5, 'Tank buster x3: swap after the first', { slot: 'MT', alert: true, dur: 5 });
        call(tB[0] - 5, 'Tank buster x3: provoke after the first, take the next two', { slot: 'OT', alert: true, dur: 5 });
        call(tB[0] - 5, 'Tank buster swap: away from the tanks', { dur: 4 });
        for (let n = 1; n <= 3; n++) label(`Bitter Whirlwind (${n})`, k, `Bitter Whirlwind (${n === 1 ? 'main tank' : 'off tank'})`);
        boss(tB[2] + 2, [0, 0], 3);
      }
    }
    turmoil(0, []);

    // ===== Dawn of an Age 2: the knockaround =====
    (function knockaround() {
      const tDrum = T('Drum Of Vollok', 0), tV = T('Vollok', 1), tSync = T('Sync', 1), tSw = T('Chasm Of Vollok', 2), tAero = T('Aero III', 0);
      const heH = evs('Half Full').find(e => e.t > tAero && e.t < tAero + 25), tHalf = heH ? heH.t + 0.5 : tAero + 16.9;
      const tDuty = [1, 2, 3, 4].map(n => T(`Duty's Edge (damage ${n})`, 0)), tChains = T('Burning Chains', 0), tChainHit = T('Burning Chains (damage 1)', 0);
      const tAct = actualize[3];
      if (tDrum === undefined || tDuty[0] === undefined) return;
      const sL = side === 'NW' ? [0, 1] : [1, 0], pL = side === 'NW' ? [1, 0] : [0, 1];
      const ps = (p, s) => r2(C(p * pL[0] + s * sL[0], p * pL[1] + s * sL[1]));
      const sDir = at(brgL(...sL), 1);                 // compass: toward the other platform
      const okMain = onSq([[PLAT.main, 10]], 1.3), okSide = onSq([[PLAT[side], 10]], 1.3);
      call(dawn[1] + 3, `The ${side} platform: pairs line up on its edge`, { dur: 5 });
      // Drum of Vollok: pair stacks on the supports; their partners thrown across.
      const drum = {};
      for (const s of SUP) { drum[s] = ps(DRUM_P[s], 6.5); drum[PARTNER[s]] = ps(DRUM_P[s], 8.3); }
      pref(tDrum - 8 + 0.2, drum);
      hz({ t: tDrum, tell: tDrum - 8, effect: 'share', shape: 'circle', from: 'target', targets: SUP.slice(), r: 4, min: 2, max: 2, dmg: 0.5, name: 'Drum of Vollok' });
      hz({ t: tDrum + 0.05, tell: tDrum - 8, effect: 'knockback', shape: 'circle', from: 'target', targets: SUP.slice(), r: 4, dist: 25, unstoppable: true, name: 'Drum of Vollok (knockback)' });
      for (const s of SUP) call(tDrum - 8, 'Partner stack (on you): your DPS on the outside', { slot: s, alert: true, dur: 6 });
      for (const s of DPS) call(tDrum - 8, 'Partner stack (knockback): stand outside your support, toward the other platform', { slot: s, alert: true, dur: 6 });
      label('Drum Of Vollok', 0, 'Drum of Vollok (pair stacks: partners thrown across)');
      pref(tDrum + 0.6, assign(DPS, SUP.map(s => ps(DRUM_P[s], 33.3))));
      // He leaps between the platforms. Two great swords: a quadrant each, on both platforms (one of the two facing
      // him on each); everyone's tile goes off on both platforms too.
      boss(tV - 5, ps(0, 15));
      const Q = pick([[[1, 1], [-1, -1]], [[1, -1], [-1, 1]]]);
      const covered = (a, b) => Q.some(q => q[0] === a && q[1] === b);
      const cM = 0, cS = 30;
      Q.forEach(([a, b], n) => {
        for (const c of [cM, cS]) {
          const under = (n === 0) === (c === cM);
          hz({ t: tSw, tell: under ? tV : tSync, dmg: 1.4, name: 'Chasm of Vollok (great sword)', react: 3.5, ...quadShape(ps(5 * a, c + 5 * b)) });
        }
      });
      const aMain = [1, -1].find(a => !covered(a, 1)), aSide = [1, -1].find(a => !covered(a, -1));
      const tilesQ = (a, c, b) => [[2.5, 2.5], [7.5, 2.5], [2.5, 7.5], [7.5, 7.5]].map(([p, s]) => ps(a * p, c + b * s));
      const cellSpot = Object.assign(assign(SUP, tilesQ(aMain, cM, 1)), assign(DPS, tilesQ(aSide, cS, -1)));
      pref(tV + 0.3, cellSpot);
      const tCell = tSw + 0.2;
      hz({ t: tCell, tell: tCell - 6.1, effect: 'bait', from: 'target', targets: S.slice(), dmg: 1.0, own: 0.3, name: 'Chasm of Vollok', ...tileShape([0, 0]), at: undefined });
      for (const s of S) {
        const q = cellSpot[s], m = SUP.includes(s) ? add(q, mul(sDir, 30)) : add(q, mul(sDir, -30));
        hz({ t: tCell, tell: tCell - 6.1, dmg: 1.0, name: 'Chasm of Vollok (the other platform\'s)', ...tileShape(m) });
      }
      // Front left or right, as you face him.
      const lr = (a, c) => { const face = c === cM ? sDir : mul(sDir, -1), right = [face[1], -face[0]]; return dot(sub(ps(a * 5, c), ps(0, c)), right) > 0 ? 'right' : 'left'; };
      for (const s of S) {
        const mine = SUP.includes(s) ? lr(aMain, cM) : lr(aSide, cS);
        call(tSync, mine === 'left' ? '<= Front Left Quadrant + Spread Out' : 'Front Right Quadrant + Spread Out =>', { slot: s, alert: true, dur: 6 });
      }
      label('Vollok', 1, 'Vollok (two great swords)');
      label('Sync', 1, 'Sync (each sword on both platforms)');
      label('Chasm Of Vollok', 2, 'Chasm of Vollok (the great swords, and every player\'s tile)');
      // Aero III: a tornado on each platform (mirrored); a 25-yalm throw from its middle.
      const tau = pick([1, -1]), torM = ps(5 * tau, cM), torS = ps(-5 * tau, cS), tTor = tAero + 1.2;
      for (const p of [torM, torS]) mark({ shape: 'circle', at: p, r: 4, t0: tTor, t1: tAct - 5, fill: 'rgba(150,255,210,0.32)' });
      label('Aero III', 0, 'Aero III (a tornado on each platform)');
      // Forward/Backward Half from between the platforms: one platform's far side is safe; whoever's on the other
      // takes their tornado across.
      const faceSide = Math.random() < 0.5, front = Math.random() < 0.5, safeRight = Math.random() < 0.5;
      const F = deg360(brgL(...sL) + (faceSide ? 0 : 180)), bc = ps(0, 15);
      const fb = fbHalf(bc, F, front, safeRight);
      fb.forEach((s, j) => hz({ t: +tHalf.toFixed(2), tell: tHalf - 10, dmg: 1.4, name: j ? 'Half Full' : (front ? 'Forward Edge' : 'Backward Edge'), react: 3.5, ...s }));
      const safeOnSide = front === faceSide, cSafe = safeOnSide ? cS : cM, dAway = safeOnSide ? 1 : -1;
      const first = safeOnSide ? SUP : DPS, second = safeOnSide ? DPS : SUP;
      const rightV = at(F + 90, 1), pSign = Math.sign(dot(rightV, sub(ps(1, 0), ps(0, 0)))) * (safeRight ? 1 : -1);
      const halfSpot = clump(fb, ps(5 * pSign, cSafe + dAway * 6), 8, safeOnSide ? okSide : okMain, { m: 1.3, gap: 0.55 })
        || clump(fb, ps(5 * pSign, cSafe + dAway * 6), 8, onSq([[PLAT[safeOnSide ? side : 'main'], 10]], 1.1), { m: 1.15, gap: 0.5 }) || S.map(() => ps(5 * pSign, cSafe + dAway * 6));
      // The jumps: stand on the tornado's far side, thrown 25 to the other platform.
      const jump = (grp, fromSide, t, tGo) => {
        const tor = fromSide ? torS : torM, u = fromSide ? mul(sDir, -1) : sDir;
        pref(tGo, assign(grp, grp.map(() => r2(add(tor, mul(u, 2.5))))));
        hz({ t, tell: t - 5, effect: 'knockback', shape: 'circle', from: tor, targets: grp.slice(), r: 4, dist: 25, unstoppable: true, dmg: 0.15, name: 'Aero III (tornado)' });
        for (const s of grp) { debuff(s, 'liftoff', 'Liftoff', 'thrown across', t, t + 3); debuff(s, 'windResistanceDown', 'Wind Resistance Down II', 'no second tornado', t, t + 46); }
      };
      // After the tiles, each group waits on its platform's far side from its tornado.
      const wait = (grp, c, tor) => { const l = Lc(tor), lc = PLAT[c === cM ? 'main' : side], away = [lc[0] - (l[0] - lc[0]), lc[1] - (l[1] - lc[1])]; return assign(grp, clump([], r2(C(...away)), 4, c === cM ? okMain : okSide, { gap: 0.8 })); };
      pref(tCell + 0.2, Object.assign(wait(SUP, cM, torM), wait(DPS, cS, torS)));
      const tJ1 = tHalf - 6.5;
      jump(first, !safeOnSide, tJ1, tHalf - 10 + 0.3);
      pref(tJ1 + 0.7, assign(first, halfSpot.slice(0, 4)));
      pref(tHalf - 9, assign(second, halfSpot.slice(4)));
      if (heH) { P.labels.set(heH, `${front ? 'Forward' : 'Backward'} Half (${fbText(front, safeRight).toLowerCase()}; the ${safeOnSide ? side : 'middle'} platform)`); if (!heH.cast) heH.cast = 9; }
      const ee = evs('Forward Edge/Backward Edge').find(e => heH && Math.abs(e.t - heH.t) < 0.5);
      if (ee) P.labels.set(ee, front ? 'Forward Edge' : 'Backward Edge');
      for (const s of S) {
        const stay = (SUP.includes(s) ? !safeOnSide : safeOnSide);
        call(tHalf - 10, `${fbText(front, safeRight)} (${stay ? 'Stay' : 'Go Across'})`, { slot: s, alert: true, dur: 6 });
        if (!stay) call(tJ1 - 5, 'Into your tornado from the side away from the other platform... thrown across', { slot: s, dur: 4 });
      }
      // Duty's Edge: everyone in one line stack on the safe platform, four hits.
      const tgt = pick(S), stack = clump([], ps(0, cSafe + dAway * 5), 8, safeOnSide ? okSide : okMain, { gap: 0.5 }) || S.map(() => ps(0, cSafe + dAway * 5));
      const tDC = T('Duty\'s Edge', 0, tDuty[0] - 0.2) - 4.9;
      pref(tHalf + 0.3, assign([tgt].concat(S.filter(s => s !== tgt)), stack));
      tDuty.forEach((t, n) => hz({ t, tell: n ? tDuty[n - 1] : tDC, effect: 'share', shape: 'line', from: 'boss', aim: 'target', targets: [tgt], len: 60, w: 8, min: 8, dmg: 0.28, name: 'Duty\'s Edge' }));
      call(tDC, `Line stack on ${tgt} (x4)`, { alert: true, dur: 8 });
      label('Duty\'s Edge', 0, `Duty's Edge (line stack on ${tgt}, four hits)`);
      // Burning Chains: supports to DPS; whoever hasn't jumped takes the tornado across to break them.
      if (tChains !== undefined && tChainHit !== undefined) {
        const tJ2 = tChains + 3.5;
        jump(second, safeOnSide, tJ2, tJ2 - 5);
        const land = clump([], ps(0, safeOnSide ? cM + 2.5 : cS - 2.5), 4, safeOnSide ? okMain : okSide, { gap: 0.8 });
        pref(tJ2 + 0.7, assign(second, land));
        for (const s of SUP) {
          hz({ t: tChainHit, tell: tChains, targets: [s], tether: PARTNER[s], stretch: 15, dmg: 0, fail: 0.9, quiet: true, name: 'Burning Chains' });
          for (const x of [s, PARTNER[s]]) debuff(x, 'burningChains', 'Burning Chains', `15 yalms from ${x === s ? PARTNER[s] : s}`, tChains, tChainHit);
        }
        for (const s of S) call(tChains, `Break Chains (${second.includes(s) ? 'Go Across' : 'Stay'})`, { slot: s, alert: true, dur: 6 });
        label('Burning Chains', 0, 'Burning Chains (supports to DPS: break them)');
      }
      // Actualize: the floor whole again; the side platform's group walks back as it forms.
      pref(tAct - 4.8, UP);
      boss(tAct - 5, [0, 0]);
    })();

    // ===== Projection of Triumph 2, with Half Circuit; Regicidal Rage =====
    (function lines2() {
      const tP = T('Projection Of Triumph', 1);
      const steps = siege.filter(t => t > tP && t < tP + 40);
      const r = triumph(1, steps);
      if (!r) return;
      pref(tP - 5 + 0.2, all(s => r2(mul(UP[s], 0.6))));
      const tC = T('Half Circuit', 0, steps[2] + 2.3), inn = Math.random() < 0.5, safeRight = Math.random() < 0.5, sg = safeRight ? 1 : -1;
      const sideH = { shape: 'half', dir: [-sg, 0], off: 0 };
      hz({ t: tC, tell: tC - 7, dmg: 1.4, name: 'Half Circuit', react: 3.4, ...(inn ? { shape: 'donut', at: [0, 0], r0: 10, r1: 30 } : { shape: 'circle', at: [0, 0], r: 10 }) });
      hz({ t: tC + 0.3, tell: tC - 7, dmg: 1.4, name: 'Half Circuit', react: 3.4, ...sideH });
      label('Half Circuit', 0, `Half Circuit (${inn ? 'in' : 'out'} + ${safeRight ? 'east' : 'west'})`);
      const circ = inn ? { shape: 'donut', at: [0, 0], r0: 10, r1: 30 } : { shape: 'circle', at: [0, 0], r: 10 }, qc = inn ? [sg * 5.5, 0] : [sg * 15, 0];
      pref(tC - 7 + 0.1, assign(S, clump([circ, sideH], qc, 8, okBig, { gap: 0.7 }) || S.map(() => qc)));
      call(tC - 7, `${inn ? 'In' : 'Out'} + Boss's ${safeRight ? 'Right' : 'Left'}`, { alert: true, dur: 6 });
      pref(tC + 0.5, all(s => r2(mul(UP[s], 0.6))));
      // Regicidal Rage: the party behind him, the tanks out to the sides.
      const tR = T('Regicidal Rage', 1);
      if (tR !== undefined) {
        hz({ t: tR + 0.1, tell: tR - 8, effect: 'bait', shape: 'circle', from: 'target', targets: TANKS, r: 8, dmg: 1.2, own: 0.55, buster: true, tether: 'boss', name: 'Regicidal Rage' });
        const last = Math.max(...r.T2);
        pref(last + 0.15, Object.assign(assign(['H1', 'H2', 'M1', 'M2', 'R1', 'R2'], clump([], [0, -8], 6, okBig, { gap: 0.7 })), { MT: [-10, 5], OT: [10, 5] }));
        for (const s of TANKS) call(tR - 8, 'Tank tethers: grab one, out to the side', { slot: s, alert: true, dur: 5 });
        call(tR - 8, 'Stack behind the boss; avoid the tank tethers', { dur: 5 });
        label('Regicidal Rage', 1, 'Regicidal Rage (tank tethers)');
        pref(tR + 0.3, UP);
      }
    })();
    turmoil(1, evs('Half Full').filter(e => e.t > T('Projection Of Turmoil', 1, 1e9) && e.t < T('Projection Of Turmoil', 1, 1e9) + 50));

    // ===== Swords 2: no cleave; one player per safe tile, then Duty's Edge; Forged Track again =====
    (function swords2() {
      const tSw = T('Chasm Of Vollok', 3), tCell = T('Chasm Of Vollok', 4);
      if (tSw === undefined) return;
      const V = vollokSmall(2, 2, tSw);
      const has = (i, j) => !V.bad.has(`${i},${j}`);
      const text = has(1, 1) && has(2, 1) ? 'Inside Safe' : has(2, 1) ? 'Inside East/West Safe' : has(2, 2) ? 'Inside North/South Safe' : 'Outside Intercards Safe (Avoid Corners)';
      const order = V.safe.map(t => ({ t, p: tileAt(PLAT.main, ...t) })).sort((a, b) => b.p[1] - a.p[1] || a.p[0] - b.p[0]);
      const spots = assign(SUP.concat(DPS), order.map(o => r2(o.p)));
      pref(V.tS + 0.3, spots);
      call(V.tS, `${text}: one player per safe tile`, { alert: true, dur: 6 });
      for (const s of S) call(V.tS + 0.5, `Your tile: ${TILE_NAME[order[SUP.concat(DPS).indexOf(s)].t.join()]}`, { slot: s, dur: 5 });
      label('Chasm Of Vollok', 3, 'Chasm of Vollok (the swords)');
      if (tCell !== undefined) {
        hz({ t: tCell, tell: tSw - 2.7, effect: 'bait', from: 'target', targets: S.slice(), dmg: 1.0, own: 0.3, name: 'Chasm of Vollok', ...tileShape([0, 0]), at: undefined });
        label('Chasm Of Vollok', 4, 'Chasm of Vollok (each player\'s tile)');
      }
      // Duty's Edge: everyone on its target, out from him toward their tile.
      const tD = [1, 2, 3, 4].map(n => T(`Duty's Edge (damage ${n})`, 1));
      if (tD[0] !== undefined) {
        const tgt = pick(S), b = brg(spots[tgt]), stack = clump([], at(b, 7), 8, onSq(MID, 1.3), { gap: 0.5 });
        const tDC = T('Duty\'s Edge', 1, tD[0] - 0.4) - 4.9;
        pref((tCell || tDC) + 0.15, assign([tgt].concat(S.filter(s => s !== tgt)), stack));
        tD.forEach((t, n) => hz({ t, tell: n ? tD[n - 1] : tDC, effect: 'share', shape: 'line', from: 'boss', aim: 'target', targets: [tgt], len: 60, w: 8, min: 8, dmg: 0.28, name: 'Duty\'s Edge' }));
        call(tDC, `Line stack on ${tgt} (x4)`, { alert: true, dur: 8 });
        label('Duty\'s Edge', 1, `Duty's Edge (line stack on ${tgt}, four hits)`);
        pref(tD[3] + 0.3, UP2);
      }
    })();
    forged(1, 1, 5);

    // The enrage.
    call(tEnrage - 10, 'Enrage: Actualize', { alert: true, dur: 6 });
    P.boss.sort((a, b) => a.t - b.t);
    ARENA.sort((a, b) => a.t - b.t);
    return P;
  }
  const sub = (a, b) => [a[0] - b[0], a[1] - b[1]];

  B.FIGHT_SCRIPTS = B.FIGHT_SCRIPTS || {};
  B.FIGHT_SCRIPTS.ex2 = {
    // FFLogs' max HP in an EX2 kill (report hTd92jHkrV1KWxBw): Zoraal Ja 66,146,024.
    hp: 66146024,
    adds: [],
    pushes: [],
    defaultStrat: 'conga',
    strats: {
      conga: { label: 'Conga/Hector (NA)' },
    },
    source: 'wtfdig.info/70/ex2; mechanics after BossMod (github.com/awgil/ffxiv_bossmod) and FFLogs kills',
    // A north, B east, C south, D west (the corners), 1-4 the edges' middles (1 north-west, then clockwise), all on the
    // middle platform.
    waymarks: [
      { label: 'A', at: [0, 11.5], color: 'red' }, { label: 'B', at: [11.5, 0], color: 'yellow' },
      { label: 'C', at: [0, -11.5], color: 'blue' }, { label: 'D', at: [-11.5, 0], color: 'purple' },
      { label: '1', at: [-5.7, 5.7], color: 'red', square: true }, { label: '2', at: [5.7, 5.7], color: 'yellow', square: true },
      { label: '3', at: [5.7, -5.7], color: 'blue', square: true }, { label: '4', at: [-5.7, -5.7], color: 'purple', square: true },
    ],
    plan,
  };
})(window.BLM);
