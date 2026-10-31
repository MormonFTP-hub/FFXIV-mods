// M6S, AAC Cruiserweight M2 (Savage): Sugar Riot's mechanics for the sim's party, on cactbot's timeline, and the
// strats wtfdig.info lists for them: Hector/Toxic (NA / EU, the default here: wtfdig names none for this fight), Game8
// (JP), MR (OCE), Latte and Yukizuri (still "under construction" on wtfdig: it plays Game8's spots). Each strat gives
// the eight spots (MT OT H1 H2 M1 M2 R1 R2) a place for each mechanic; the bots stand there, and so should you. Spots
// are [east, north] yalms from the arena's middle.
//
// The mechanics follow BossMod's module for the fight (github.com/awgil/ffxiv_bossmod, RM06SSugarRiot), whose shapes
// and sizes come from the game's own Action sheet, and the layouts real kills show on FFLogs (the cacti):
//   - Color Riot: 4-yalm bombs on the closest and the farthest player; a tank hit by ice (Cool Tint) must take fire
//     next time, so the tanks swap in and out as the boss picks which colour goes close.
//   - Wingmark + Double Style: everyone flies 34 yalms the way they face when Wingmark runs out; the summons at the
//     edge (morbols' 100-degree cones, succubi's 30-yalm circles, paint bombs' and winged bombs' 15-yalm circles) leave
//     one corner safe, and Color Clash's stored stacks (light parties on the healers or partners on the supports,
//     6 yalms) land there.
//   - Sticky Mousse: 4-yalm spreads on the six non-tanks, two of whom are rooted and then burst as 4-player stacks.
//   - Desert: six waves of cacti (10-yalm circles, 3 s apart, the patterns FFLogs kills show), then two 15-yalm
//     defamations (a tank and a DPS) and a 6-yalm party stack; the quicksand (23 yalms round the middle) with eight
//     more cacti and the healers' defamations, everyone in a corner; then the bombs: blue tethers (supports) drop
//     theirs in the second quicksand, pink tethers (DPS) aim theirs into it, 6-yalm spreads, and out before it sinks.
//   - Adds: the four waves' positions (Cleavemaxxing's, wtfdig's NA/EU adds plan, for every strat), the feather rays'
//     8-yalm Water III drops on the tethered players, the Jabberwock's bind on a healer, Ready Ore Not.
//   - Single Style, and the river's Double Style: 7-wide arrow lanes from the north and east edges (one of two
//     patterns), with Taste of Thunder's 6-yalm spreads or Taste of Fire's healer stacks in the squares between.
//   - The storm: everyone baits a 3-yalm puddle, then stands on the bridge across from the cloud (its 21-yalm strike);
//     Lightning Storm's 8-yalm spreads (a support and a DPS each time) go out to the islands either side; Lightning
//     Bolts' 4-yalm circles; Pudding Party's five party stacks.
//   - The lava: Mousse Drip's partner stacks (5 yalms, four drops, each leaving a puddle), Moussacre's 15-degree cones
//     at the four closest, the 3-yalm bait puddles and the 3-yalm towers; then Wingmark into the second towers (four
//     on one island and two on each other, or all eight south).
// Simplified (the engine has no knockbacks, moving boss, arena changes or adds): Wingmark's flight is a run from the
// launch spot to the landing spot as it goes off; the boss stays in the middle (in the game she moves north for the
// desert and the river, south for the lava); the river, lava, quicksand and bridges are drawn but only the attacks
// on them hurt; the adds can't be fought.
(function (B) {
  const S = B.SLOTS;
  const all = (f) => Object.fromEntries(S.map(s => [s, f(s)]));
  const at = B.bearing;
  const G1 = ['MT', 'H1', 'M1', 'R1'], G2 = ['OT', 'H2', 'M2', 'R2'];
  const SUPPORT = ['MT', 'OT', 'H1', 'H2'], DPS = ['M1', 'M2', 'R1', 'R2'];
  const NONTANK = ['H1', 'H2', 'M1', 'M2', 'R1', 'R2'];
  const pick = (a) => a[Math.floor(Math.random() * a.length)];
  const shuffle = (a) => { const b = a.slice(); for (let i = b.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [b[i], b[j]] = [b[j], b[i]]; } return b; };
  const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);
  const add = (a, b, k = 1) => [a[0] + b[0] * k, a[1] + b[1] * k];
  const unit = (v) => { const l = Math.hypot(v[0], v[1]) || 1; return [v[0] / l, v[1] / l]; };
  // A spot turned clockwise by k quarter turns (the north-west corner's layout to the others').
  const rot = (p, k) => { let [x, y] = p; for (let i = 0; i < ((k % 4) + 4) % 4; i++) [x, y] = [y, -x]; return [x, y]; };
  const CORNER = ['northwest', 'northeast', 'southeast', 'southwest'];
  const CORNER_AT = [[-1, 1], [1, 1], [1, -1], [-1, -1]];
  // A small ring of offsets, so the bots in a clump don't stand inside each other.
  const ringOff = (s, r) => at(S.indexOf(s) * 45 + 22.5, r);
  const clump = (c, r = 0.9) => all(s => add(c, ringOff(s, r)));

  // Everyone's spot outside mechanics: tanks at the boss's front (north), the rest at her back within a couple of
  // yalms of her hitbox (4 yalms), as parties hug her.
  const UP = { MT: [-1.5, 5.3], OT: [1.5, 5.3], H1: [-2.5, -5.6], H2: [2.5, -5.6], M1: [-3.6, -3.6], M2: [3.6, -3.6], R1: [-1.2, -6.0], R2: [1.2, -6.0] };
  // The desert's opening, while she stands north: the party between her and the middle.
  const DESERT = { MT: [-1.5, 10.5], OT: [1.5, 10.5], H1: [-2.5, 7], H2: [2.5, 7], M1: [-3.5, 8.5], M2: [3.5, 8.5], R1: [-1, 6.5], R2: [1, 6.5] };

  // ---------- each strat's spots ----------
  const STRATS = ['toxic', 'game8', 'mr', 'latte', 'yukizuri'];
  const base = (strat) => (strat === 'yukizuri' ? 'game8' : strat);     // Yukizuri's page is unfinished: Game8's spots

  // Wingmark + Double Style, for the safe corner north-west (turned for the others): light parties G1 on the north
  // edge (left, facing the boss from the corner), G2 on the west edge; partners front (MT+M1, toward the boss), back
  // (OT+M2, in the corner), left (H1+R1) and right (H2+R2). Every strat lands the same way.
  const DS_LP = { G1: [-9, 17.5], G2: [-17.5, 9] };
  const DS_PAIRS = [['MT', 'M1', [-12, 12]], ['OT', 'M2', [-17.5, 17.5]], ['H1', 'R1', [-7.5, 18.5]], ['H2', 'R2', [-18.5, 7.5]]];
  function dsLanding(lp, k) {
    return all(s => rot(lp ? DS_LP[G1.includes(s) ? 'G1' : 'G2'] : DS_PAIRS.find(p => p.includes(s))[2], k));
  }
  // Where each spot stands so the flight (34 yalms toward the safe corner) lands it there.
  const FLY = 34;
  const launchFor = (land, k) => add(land, rot([-Math.SQRT1_2, Math.SQRT1_2], k), -FLY);
  // The summons: the eight Double Style casts' pairs (cactbot's table), placed so exactly the north-west corner is
  // safe, then turned. Morbol: a 100-degree cone from its edge across the room (its edge's corners are safe); succubus:
  // a 30-yalm circle (its edge's corners aren't); paint bomb: 15 yalms round itself in its corner; winged bomb: flies
  // 16 yalms across and bursts there.
  const DS_KINDS = [['marl', 'succ'], ['succ', 'marl'], ['marl', 'marl'], ['succ', 'succ'], ['bomb', 'succ'], ['wing', 'succ'], ['bomb', 'marl'], ['wing', 'marl']];
  const ADD_NAME = { marl: 'Bad Breath', succ: 'Dark Mist', bomb: 'Burst', wing: 'Burst' };
  function dsAdds(kinds) {
    const marl = (side) => (side === 'N' ? { shape: 'cone', at: [0, 20], deg: 180, half: 50, r: 50 } : { shape: 'cone', at: [-20, 0], deg: 90, half: 50, r: 50 });
    const succ = (side) => ({ shape: 'circle', at: side === 'S' ? [0, -20] : [20, 0], r: 30 });
    const bomb = (c) => ({ shape: 'circle', at: [c[0] * 14, c[1] * 14], r: 15 });
    const wing = (c) => ({ shape: 'circle', at: [c[0] * 8.5, c[1] * 13], r: 15 });       // where it lands
    const [a, b] = kinds, set = new Set(kinds);
    const others = [[1, 1], [1, -1], [-1, -1]];
    if (set.size === 1) return a === 'marl' ? [marl('N'), marl('W')] : [succ('S'), succ('E')];
    if (set.has('marl') && set.has('succ')) return pick([[marl('N'), succ('E')], [marl('W'), succ('S')]]);
    const big = set.has('marl') ? marl(pick(['N', 'W'])) : succ(pick(['S', 'E']));
    const small = set.has('bomb') ? bomb : wing;
    return [big, ...others.map(small)];
  }
  const turnShape = (h, k) => Object.assign({}, h, { at: rot(h.at, k) }, h.deg !== undefined ? { deg: (h.deg + 90 * k) % 360 } : {});

  // Sticky Mousse: clock spots round the boss (Toxic, MR), or modified clocks with the tanks in the middle (Latte,
  // Game8). Who stacks with whom: light parties if the two rooted players are in different ones, else by distance.
  const STICKY = {
    clock: { MT: [0, 6.5], OT: [0, -6.5], H1: [-6.5, 0], H2: [6.5, 0], R1: [-6, 6], R2: [6, 6], M1: [-6, -6], M2: [6, -6] },
    modified: { MT: [0, 1.8], OT: [0, -1.8], H1: [-6, 0], H2: [6, 0], R1: [-3.9, 5.7], R2: [3.9, 5.7], M1: [-4, -6.3], M2: [4, -6.3] },
  };
  const stickyLayout = (strat) => STICKY[strat === 'toxic' || strat === 'mr' ? 'clock' : 'modified'];
  function stickyGroups(strat, targets, layout) {
    const [a, b] = targets;
    if (strat !== 'latte' && strat !== 'yukizuri' && G1.includes(a) !== G1.includes(b)) {
      const ga = G1.includes(a) ? G1 : G2;
      return [ga.slice(), (ga === G1 ? G2 : G1).slice()];
    }
    const others = S.filter(s => !targets.includes(s));
    const lean = (s) => dist(layout[s], layout[a]) - dist(layout[s], layout[b]);
    const sorted = others.sort((x, y) => lean(x) - lean(y));
    return [[a, ...sorted.slice(0, 3)], [b, ...sorted.slice(3)]];
  }

  // Desert 1: the stack and the two short defamations (15 yalms) after the cacti.
  function desertDefams(strat) {
    const s = base(strat);
    if (s === 'latte') return { stack: [0, 0], tank: [-17.5, 17.5], dps: [17.5, 17.5] };       // stack centre, NW / NE
    if (s === 'mr') return { stack: [0, 13], tank: [-19, -4], dps: [19, -4] };                 // stack north, W / E
    return { stack: [0, 13], tank: [-17.5, -17.5], dps: [17.5, -17.5] };                        // stack north, SW / SE
  }
  // The six waves of cacti (10-yalm circles), as three FFLogs kills show them (cactbot's patterns 1, 3 and 4).
  const CACTI = [
    [[[-16, -16], [-10, 0], [0, 10], [7.5, -7.5], [16, 16]], [[-16, 0], [0, -10], [0, 16], [16, -16], [16, 8]], [[-16, 16], [-11, -16], [0, 0], [7.5, 7.5], [16, -8]],
      [[-16, 8], [-11, 16], [-7.5, -7.5], [0, -16], [10, 0]], [[-16, -8], [-7.5, 7.5], [11, -16], [11, 16], [16, 0]], [[-16, 16], [-11, -16], [-10, 0], [0, -10], [16, 8]]],
    [[[-16, -16], [-11, 16], [0, 0], [7.5, -7.5], [7.5, 7.5]], [[-16, 16], [-7.5, 7.5], [0, -10], [16, -16], [16, 0]], [[-10, 0], [0, -16], [11, 16], [16, -8], [16, 8]],
      [[-11, -16], [-7.5, -7.5], [0, 10], [10, 0], [16, 16]], [[-16, -8], [-16, 0], [-16, 8], [0, 16], [11, -16]], [[-16, -16], [-11, 16], [7.5, -7.5], [7.5, 7.5], [16, 0]]],
    [[[-16, -8], [-10, 0], [11, -16], [11, 16], [16, 8]], [[-16, -16], [-16, 8], [0, -10], [0, 0], [16, 16]], [[-7.5, -7.5], [0, 10], [0, 16], [16, -16], [16, 0]],
      [[-16, 0], [-16, 16], [-11, -16], [7.5, -7.5], [7.5, 7.5]], [[-11, 16], [-7.5, 7.5], [0, -16], [10, 0], [16, -8]], [[-7.5, -7.5], [0, 0], [0, 10], [11, 16], [16, -16]]],
  ];
  // The quicksand's cacti (nine 10-yalm circles): a ring round the middle and a cluster in the unsafe corner.
  const QS_CACTI = {
    1: [[-16, 8], [-10, 0], [0, -10], [0, 10], [10, 0], [11, 16], [16, -8], [16, 0], [16, 16]],
    2: [[-16, -8], [-16, 8], [-10, 0], [0, -10], [0, 10], [10, 0], [16, -16], [16, -8], [16, 8]],
    3: [[-16, -16], [-16, 8], [-11, -16], [-10, 0], [0, -10], [0, 10], [10, 0], [16, -8], [16, 8]],
  };
  QS_CACTI[0] = QS_CACTI[1].map(p => [-p[0], p[1]]);
  const CORNER_SPOT = (c) => [CORNER_AT[c][0] * 19, CORNER_AT[c][1] * 19];
  // Desert 2: the healers' defamations and the party, each in a corner (c: the unsafe one).
  function desertCorners(strat, c) {
    const s = base(strat), cw = (c + 1) % 4, ccw = (c + 3) % 4, across = (c + 2) % 4;
    let h1, h2, party;
    if (s === 'game8') {
      const or = (k) => (k === c ? 3 : k);          // a corner that's unsafe: south-west instead
      h1 = or(0); h2 = or(2); party = or(1);
    } else if (s === 'latte') {                     // the two corners beside the cactus: H1 the west one
      const west = CORNER_AT[cw][0] < 0 ? cw : ccw;
      h1 = west; h2 = west === cw ? ccw : cw; party = across;
    } else { h1 = cw; h2 = ccw; party = across; }
    return all(sl => CORNER_SPOT(sl === 'H1' ? h1 : sl === 'H2' ? h2 : party));
  }
  // Desert 3, the bombs: the supports' row in the quicksand (blue tethers), the DPS's row outside (pink tethers, their
  // bombs flying into it), G1 west, ranged and healers out wide ("RMMR"). Laid out for quicksand north; Game8 calls
  // the quicksand north, so its layout turns with it, the others keep true north.
  const BOMB_ROWS = { H1: [-13, 2.5], MT: [-4.4, 2.5], OT: [4.4, 2.5], H2: [13, 2.5], R1: [-14.5, -6.5], M1: [-4.6, -6.5], M2: [4.6, -6.5], R2: [14.5, -6.5] };
  function bombSpots(strat, north) {
    if (north) return Object.assign({}, BOMB_ROWS);
    if (base(strat) === 'game8') return all(s => rot(BOMB_ROWS[s], 2));
    return all(s => [BOMB_ROWS[s][0], -BOMB_ROWS[s][1]]);
  }

  // The adds (Cleavemaxxing's plan): each wave's spots.
  const ADDS = {
    1: { MT: [0.4, -3.6], OT: [-15.5, 0.2], H1: [-9.6, -1.1], H2: [-8.4, 2], M1: [-11.3, 2.4], M2: [-11.4, -1.8], R1: [-8.9, -3.3], R2: [-7.7, -0.4] },
    2: { MT: [3.9, 2.4], OT: [5.7, 5], M1: [-0.2, 4], M2: [1.8, 2], R1: [2.9, 5.9], H1: [0.5, 6.5], R2: [-8.5, 17.2], H2: [17.3, 17.2] },
    3: { MT: [-14.8, -2.5], OT: [2.5, 12], H1: [-12, -4.5], H2: [-11, -1.5], M1: [-13.5, -0.5], M2: [-12.5, -5.5], R1: [-10, -3], R2: [-10.5, -6] },
    4: { MT: [3, 17.2], OT: [-9, -8], M1: [-1.5, 14.7], M2: [1.3, 15.5], R1: [-18.5, -14.5], R2: [17.9, -12.4], H1: [-0.4, -1], H2: [1.5, -2] },
  };

  // Arrows (Single Style, the river's Double Style): three lanes from the north edge and three from the east, 7 wide,
  // one of two patterns; the squares between them are safe. A square: column c (west to east) and row r (north to south).
  const LANES = { A: { col: [-16.67, -3.33, 10], row: [16.67, 3.33, -10] }, B: { col: [-10, 3.33, 16.67], row: [10, -3.33, -16.67] } };
  const CELLS = { A: { E: [-10, 3.33, 16.67], N: [10, -3.33, -16.67] }, B: { E: [-16.67, -3.33, 10], N: [16.67, 3.33, -10] } };
  const CELL_AT = { NW: [0, 0], N: [1, 0], NE: [2, 0], W: [0, 1], C: [1, 1], E: [2, 1], SW: [0, 2], S: [1, 2], SE: [2, 2] };
  const cell = (pat, name) => [CELLS[pat].E[CELL_AT[name][0]], CELLS[pat].N[CELL_AT[name][1]]];
  // Taste of Thunder's spreads: each spot's square. (Where a strat puts two in one square, the second takes the
  // middle one: the sim's bots keep a yalm off the lanes, too far in for two 6-yalm spreads to fit.)
  const LIGHTNING = {
    game8: { A: { MT: 'N', OT: 'S', H1: 'W', H2: 'E', M1: 'SW', M2: 'SE', R1: 'NW', R2: 'NE' } },
    latte: { A: { MT: 'C', OT: 'N', H1: 'SW', H2: 'SE', M1: 'W', M2: 'E', R1: 'NW', R2: 'NE' } },
    mr: { A: { MT: 'NW', OT: 'N', H1: 'S', H2: 'E', M1: 'W', M2: 'C', R1: 'SW', R2: 'NE' } },
    toxic: { A: { OT: 'NW', M1: 'C', M2: 'N', MT: 'W', H1: 'NE', R1: 'E', H2: 'SW', R2: 'S' },
      B: { OT: 'NW', M2: 'N', H1: 'NE', M1: 'W', MT: 'C', R1: 'E', H2: 'S', R2: 'SE' } },
  };
  const lightningSpots = (strat, pat) => { const L = LIGHTNING[base(strat)]; const m = L[pat] || L.A; return all(s => cell(pat, m[s])); };
  // Taste of Fire: MT, H1 and the melee in the middle square, OT, H2 and the ranged far, behind the south-west bridge.
  const FIRE = [['H1', 'MT', 'M1', 'M2'], ['H2', 'OT', 'R1', 'R2']];
  const fireSpots = (pat) => { const mid = cell(pat, 'C'), far = cell(pat, pat === 'A' ? 'W' : 'SW'); return all(s => add(FIRE[0].includes(s) ? mid : far, ringOff(s, 0.8))); };

  // The storm: the three bridges, the cloud's three spots (it strikes 21 yalms round itself) and the bridge across
  // from each; Lightning Storm's targets go to the islands either side of the bridge, supports clockwise.
  const BRIDGE = { N: [1.2, 9.0], SE: [7.05, -5.8], SW: [-8.4, -3.5] };
  const CLOUD = { NE: [15, 8], NW: [-13, 8], S: [0, -15] };
  const SAFE_BRIDGE = { NE: 'SW', NW: 'SE', S: 'N' };
  const ISLES = { N: ['NE', 'NW'], SE: ['S', 'NE'], SW: ['NW', 'S'] };       // [clockwise, counter-clockwise]
  const ISLE_SPOT = { NE: [15, 15], NW: [-15, 15], S: [0, -17] };
  const CLOUD_CW = { NE: 'S', S: 'NW', NW: 'NE' };
  const CLOUD_CCW = { NE: 'NW', NW: 'S', S: 'NE' };

  // The lava: the first towers (fixed), who takes which, and Mousse Drip's four drops for each island's pair.
  const T1 = { nwIn: [-8, 4], nwOut: [-17, -2], neIn: [9, 3], neOut: [17, 8], sWestNear: [-8, -10], sWestWall: [-9, -17], sEastNear: [7, -11], sEastWall: [5, -17] };
  function towers1(strat) {
    const s = base(strat);
    if (s === 'game8') return { MT: T1.sWestNear, OT: T1.sEastNear, M1: T1.sWestWall, M2: T1.sEastWall, H1: T1.nwOut, R1: T1.nwIn, H2: T1.neIn, R2: T1.neOut };
    return { MT: T1.sWestWall, OT: T1.sEastWall, M1: T1.sWestNear, M2: T1.sEastNear, H1: T1.nwIn, R1: T1.nwOut, H2: T1.neIn, R2: T1.neOut };
  }
  const DRIPS = [[-16, 17], [-9.5, 17.5], [-15.5, 10.5], [-9, 11]];          // the north-west island's; mirrored for north-east
  // Moussacre: the tanks and melee bait the four cones (15 degrees each side) south of the boss, 25 degrees apart.
  const PROTEAN_DEG = { MT: 215, M1: 190, M2: 165, OT: 140 };
  // The second towers: four on one island (north-east or north-west) and two on each other, or all eight south.
  const T2 = {
    NE: { four: { far1: [17, 15], near1: [10, 9], near2: [9, 3], far2: [15, -5] }, two: { NW: { close: [-10, 2.5], far: [-17, 12] }, S: { close: [7, -11], far: [-9, -17] } } },
    NW: { four: { far1: [-17, 12], near1: [-10, 11], near2: [-10, 2.5], far2: [-17, -4] }, two: { NE: { close: [9, 3], far: [17, 8] }, S: { close: [-8, -10], far: [5, -17] } } },
  };
  const S8 = { cN: [0, -8], fW: [-15, -14], cS: [-2, -17], fE: [12, -16], nW: [-8, -10], sW: [-9, -17], nE: [7, -11], sE: [5, -17] };
  function towers2(strat, type) {
    const s = base(strat);
    if (type === '8S') {
      if (s === 'game8') return { MT: S8.cS, OT: S8.sE, H1: S8.fW, H2: S8.nW, M1: S8.sW, M2: S8.fE, R1: S8.cN, R2: S8.nE };
      if (s === 'latte') return { MT: S8.fW, OT: S8.cS, H1: S8.sE, H2: S8.cN, M1: S8.sW, M2: S8.nW, R1: S8.nE, R2: S8.fE };
      return { MT: S8.fW, OT: S8.cS, H1: S8.sE, H2: S8.cN, M1: S8.sW, M2: S8.nW, R1: S8.fE, R2: S8.nE };
    }
    // Everyone turns the same way: the tanks and melee from the south island to the four, H1 and R1 (north-west) and
    // H2 and R2 (north-east) on round to the next island.
    const T = T2[type], four = T.four;
    const g1Isle = type === 'NE' ? 'S' : 'NE', g2Isle = type === 'NE' ? 'NW' : 'S';
    const out = s === 'game8' ? { MT: four.near1, OT: four.near2, M1: four.far1, M2: four.far2 } : { MT: four.far1, OT: four.far2, M1: four.near1, M2: four.near2 };
    return Object.assign(out, { H1: T.two[g1Isle].close, R1: T.two[g1Isle].far, H2: T.two[g2Isle].close, R2: T.two[g2Isle].far });
  }
  // A Wingmark launch spot: 34 yalms back from the landing, inside the arena, as near as can be to where you are.
  function launchTo(land, from) {
    let best = null, bd = Infinity;
    for (let d = 0; d < 360; d += 5) {
      const p = add(land, at(d, 1), -FLY);
      if (Math.abs(p[0]) > 18.5 || Math.abs(p[1]) > 18.5) continue;
      const k = dist(p, from);
      if (k < bd) { bd = k; best = p; }
    }
    return best || from;
  }
  // Bait-then-soak: stand at the tower's edge (A) as the 3-yalm puddles are baited, then step across it (B), 4.4
  // yalms off, out of your own puddle and nobody's else's, and out of the puddles (zones) still on the floor.
  function baitSoak(towers, zones) {
    const A = {}, Bs = {};
    for (let pass = 0; pass < 2; pass++) {
      for (const s of S) {
        const t = towers[s];
        let best = null, bs = -Infinity;
        for (let d = 0; d < 360; d += 22.5) {
          const u = at(d, 2.2), a = add(t, u), b = add(t, u, -1);
          if (Math.abs(a[0]) > 19 || Math.abs(a[1]) > 19 || Math.abs(b[0]) > 19 || Math.abs(b[1]) > 19) continue;
          let score = 99;
          for (const z of zones) score = Math.min(score, dist(a, z) - 6.4, dist(b, z) - 6.4);
          for (const o of S) {
            if (o === s || !A[o]) continue;
            score = Math.min(score, dist(b, A[o]) - 4.4, dist(Bs[o], a) - 4.4);
          }
          if (score > bs) { bs = score; best = [a, b]; }
        }
        [A[s], Bs[s]] = best;
      }
    }
    return { A, B: Bs };
  }

  // The cacti's safe ground: the nearest point to `from` at least 10 + m yalms from every cactus.
  function safeFrom(from, cacti, m) {
    const ok = (q) => Math.abs(q[0]) <= 17.5 && Math.abs(q[1]) <= 17.5 && cacti.every(c => dist(q, c) > 10 + m);
    if (ok(from)) return from;
    for (let r = 0.5; r <= 40; r += 0.5) {
      let best = null, bd = Infinity;
      const n = Math.max(16, Math.round(r * 8));
      for (let k = 0; k < n; k++) {
        const q = add(from, at(k / n * 360, r));
        if (ok(q) && dist(q, from) < bd) { bd = dist(q, from); best = q; }
      }
      if (best) return best;
    }
    return null;
  }

  // ---------- the pull ----------
  // events: the fight's timeline (fight.events). Returns the pull's plan for B.Mechanics.
  function plan(events, strat) {
    const P = { start: Object.assign({}, UP), prefs: [], hazards: [], checks: [], calls: [], marks: [], labels: new Map(), debuffs: [] };
    let id = 0;
    const hz = (o) => { const h = Object.assign({ id: ++id, react: 3 }, o); P.hazards.push(h); return h.id; };
    const pref = (t, spots) => P.prefs.push({ t, spots });
    const call = (t, text, o) => P.calls.push(Object.assign({ t, text }, o));
    const check = (o) => P.checks.push(o);
    const deb = (slot, key, name, hint, t0, t1) => P.debuffs.push({ slot, key, name, hint, t0, t1 });
    const castOf = (ev, d) => ev.t - (ev.cast || d || 5);
    const next = (i, test, within) => { for (let k = i + 1; k < events.length && events[k].t - events[i].t <= within; k++) if (test(events[k])) return events[k]; return null; };
    const voidzone = (p, r, t0, t1, name, dmg) => { let prev = t0 - 1; for (let t = t0; t <= t1 + 1e-6; t += 1) { hz({ t, tell: prev, shape: 'circle', at: p, r, dmg: dmg || 0.8, name, react: 1.2 }); prev = t; } };
    const lanes = (pat, t, tell, name) => {
      for (const x of LANES[pat].col) hz({ t, tell, shape: 'rect', a: [x - 3.5, -20], b: [x + 3.5, 20], dmg: 1.3, name, react: 2.5 });
      for (const y of LANES[pat].row) hz({ t, tell, shape: 'rect', a: [-20, y - 3.5], b: [20, y + 3.5], dmg: 1.3, name, react: 2.5 });
    };
    const markLit = (shape, t0, t1, fill) => P.marks.push(Object.assign({ kind: 'lit', t0, t1, fill }, shape));
    const river = (t0, t1, fill) => {
      for (const [deg, half] of [[10, 7], [250, 8], [122, 8]]) markLit({ shape: 'cone', at: [0, 0], deg, half, r: 29 }, t0, t1, fill);
    };

    let tint = null, wingmarks = 0, stickies = 0, layers = 0, sprays = 0, sugarscapes = 0, doubleStyles = 0, tastes = 0, explosions = 0;
    let deskTank = null, deskDps = null, deskStack = null, qsCorner = 0, qsNorth = false, cloud = null, stormEnd = null;
    let t1Spots = null, lastBridge = null, bindHealer = null;
    const done = new Set();

    events.forEach((ev, i) => {
      const name = ev.name, t = ev.t;
      if (done.has(ev)) return;
      if (name === 'Mousse Mural' || name === 'Ready Ore Not') {
        hz({ t, tell: castOf(ev, name === 'Ready Ore Not' ? 7 : 5), raidwide: true, dmg: name === 'Ready Ore Not' ? 0.55 : 0.5, name });
        call(castOf(ev, 5), name === 'Ready Ore Not' ? 'Big raidwide' : 'Raidwide', { dur: 3 });
      } else if (name === 'Color Riot') {
        // The bombs land 2 s after the cast: one on the closest player, one on the farthest. A tank hit by ice (Cool
        // Tint) must take fire next time, and the other way round.
        const bomb = next(i, e => e.name.startsWith('Cool Bomb'), 4);
        const tb = bomb ? bomb.t : t + 2.1, cs = castOf(ev, 5);
        const iceClose = Math.random() < 0.5, closeTint = iceClose ? 'cool' : 'warm', farTint = iceClose ? 'warm' : 'cool';
        const close = !tint ? 'MT' : (tint.MT === closeTint ? 'OT' : 'MT'), far = close === 'MT' ? 'OT' : 'MT';
        P.labels.set(ev, `Color Riot (${iceClose ? 'ice' : 'fire'} close)`);
        if (bomb) { P.labels.set(bomb, iceClose ? 'Cool Bomb (close) + Warm Bomb (far)' : 'Warm Bomb (close) + Cool Bomb (far)'); done.add(bomb); }
        pref(cs + 0.6, { [close]: [0, 2.2], [far]: [10.9, 13] });
        pref(tb + 0.5, { MT: UP.MT, OT: UP.OT });
        hz({ t: tb, tell: cs, shape: 'tankcones', aimed: true, slots: [close], half: 70, r: 6.5, dmg: 1.5, buster: 0.55, name: iceClose ? 'Cool Bomb' : 'Warm Bomb' });
        hz({ t: tb, tell: cs, shape: 'tankcones', aimed: true, slots: [far], half: 16, r: 60, dmg: 1.5, buster: 0.55, name: iceClose ? 'Warm Bomb' : 'Cool Bomb' });
        const nextRiot = events.find(e => e.name === 'Color Riot' && e.t > t);
        const until = nextRiot ? nextRiot.t + 2.1 : tb + 60;
        const TINT = { cool: ['coolTint', 'Cool Tint', 'take fire (red) next'], warm: ['warmTint', 'Warm Tint', 'take ice (blue) next'] };
        for (const [s, k] of [[close, closeTint], [far, farTint]]) deb(s, TINT[k][0], TINT[k][1], TINT[k][2], tb, until);
        tint = { [close]: closeTint, [far]: farTint };
        call(cs, 'Tank busters: stay behind the boss, away from the tanks', { dur: 5 });
        call(cs, `Color Riot: ${iceClose ? 'ice' : 'fire'} close. Go IN, closest to the boss`, { slot: close, alert: true, dur: 6 });
        call(cs, `Color Riot: ${iceClose ? 'fire' : 'ice'} far. Go OUT, farthest away`, { slot: far, alert: true, dur: 6 });
      } else if (name === 'Wingmark') {
        wingmarks++;
        if (wingmarks === 2) { lavaTowers2(ev, i); return; }
        // Color Clash is stored (light parties or partners), then Double Style's summons leave one corner safe; you
        // launch from the opposite corner and land there as the summons go off, then stack.
        const clash = next(i, e => e.name === 'Color Clash', 10);
        const ds = next(i, e => e.name === 'Double Style', 30);
        const aoe = next(i, e => e.name.startsWith('Bad Breath'), 35);
        const stacks = aoe && next(events.indexOf(aoe), e => e.name === 'Color Clash', 3);
        if (!ds || !aoe) return;
        const lp = Math.random() < 0.5, k = Math.floor(Math.random() * 4);
        const kinds = pick(DS_KINDS), shapes = dsAdds(kinds).map(h => turnShape(h, k));
        const stun = aoe.t - 4.6, summon = aoe.t - 14, tStack = stacks ? stacks.t : aoe.t + 0.4;
        if (clash) { P.labels.set(clash, `Color Clash (${lp ? 'light parties' : 'partners'} later)`); call(castOf(clash, 3), `Stored: ${lp ? 'light party stacks' : 'partner stacks'} for later`, { dur: 5 }); }
        if (stacks) { P.labels.set(stacks, lp ? 'Color Clash (light parties)' : 'Color Clash (partners)'); done.add(stacks); }
        P.labels.set(ds, 'Double Style');
        const names = [...new Set(kinds.map(x => ADD_NAME[x]))].join(' + ');
        P.labels.set(aoe, names);
        done.add(aoe);
        const land = dsLanding(lp, k);
        pref(summon, all(s => launchFor(land[s], k)));
        pref(stun - 2.2, land);
        pref(tStack + 0.4, UP);
        for (const h of shapes) hz(Object.assign({ t: aoe.t, tell: summon, dmg: 1.4, name: names, react: 3 }, h));
        if (lp) check({ t: tStack, kind: 'stack', groups: [G1, G2], r: 6, dmg: 0.3, fail: 0.6, name: 'Color Clash' });
        else check({ t: tStack, kind: 'stack', groups: DS_PAIRS.map(p => p.slice(0, 2)), r: 6, dmg: 0.3, fail: 0.6, name: 'Color Clash' });
        for (const s of S) {
          deb(s, 'wingmark', 'Wingmark', `you fly ${FLY} yalms the way you face when it runs out`, t, stun);
          deb(s, 'stun', 'Stun', 'flying', stun, stun + 3);
        }
        const safe = CORNER[k], from = CORNER[(k + 2) % 4];
        call(summon, `Start ${from}, launch toward ${safe}`, { alert: true, dur: 7 });
        call(tStack - 5, lp ? 'Light parties (on the healers)' : 'Partner stacks (on the supports)', { alert: true, dur: 5 });
      } else if (name === 'Sticky Mousse') {
        stickies++;
        const snap = next(i, e => e.name === 'Sticky Mousse (snapshot)', 3), burst = next(i, e => e.name === 'Burst', 10);
        const ts = snap ? snap.t : t + 0.9, tb = burst ? burst.t : ts + 6, cs = castOf(ev, 5);
        const layout = stickyLayout(base(strat)), targets = shuffle(NONTANK).slice(0, 2);
        const groups = stickyGroups(base(strat), targets, layout);
        if (snap) { P.labels.set(snap, 'Sticky Mousse (spreads)'); done.add(snap); }
        if (burst) { P.labels.set(burst, 'Burst (light party stacks)'); done.add(burst); }
        pref(cs, layout);
        check({ t: ts, kind: 'spread', slots: NONTANK, r: 4, dmg: 0.25, fail: 0.7, name: 'Sticky Mousse' });
        // The rooted two stay put; their groups gather on them, a yalm their own side of them.
        const mates = {};
        groups.forEach(g => { const tg = g[0]; for (const s of g.slice(1)) mates[s] = add(layout[tg], unit([layout[s][0] - layout[tg][0], layout[s][1] - layout[tg][1]]), 1.2); });
        pref(ts + 0.1, mates);
        check({ t: tb, kind: 'stack', groups, r: 4, dmg: 0.3, fail: 0.6, name: 'Burst' });
        for (const s of targets) {
          deb(s, 'mousseMine', 'Mousse Mine', 'rooted: your light party stacks on you', ts, tb);
          call(ts, 'Rooted: stack on YOU', { slot: s, alert: true, dur: 5 });
        }
        groups.forEach(g => { for (const s of g.slice(1)) call(ts, `Stack on ${g[0]}`, { slot: s, alert: true, dur: 5 }); });
        call(cs, 'Spread on your clock spot, then stacks', { dur: 5 });
        pref(tb + 0.4, UP);
      } else if (name === 'Sugarscape') {
        sugarscapes++;
        if (sugarscapes === 1) {
          // The desert. Heating Up (15-yalm defamations): a tank and a DPS, short; both healers, long. Burning Up
          // (the party stack): another DPS.
          pref(t, DESERT);
          const d0 = t + 6.3, b1 = events.find(e => /^Br.l.e\//.test(e.name)), b2 = events.find(e => /^Br.l.e$/.test(e.name));
          const dps = shuffle(DPS);
          deskTank = pick(['MT', 'OT']); deskDps = dps[0]; deskStack = dps[1];
          if (b1) {
            for (const s of [deskTank, deskDps]) { deb(s, 'heatingUp', 'Heating Up', 'defamation (15 yalms): away from everyone', d0, b1.t); call(d0, 'Defamation on YOU (for later)', { slot: s, dur: 5 }); }
            deb(deskStack, 'burningUp', 'Burning Up', 'the party stacks on you', d0, b1.t);
            call(d0, 'Party stack on YOU (for later)', { slot: deskStack, dur: 5 });
          }
          if (b2) for (const s of ['H1', 'H2']) deb(s, 'heatingUp', 'Heating Up', 'defamation (15 yalms): your corner, away from everyone', d0, b2.t);
        } else {
          markRiver(t);
        }
      } else if (name === 'Layer') {
        layers++;
        if (layers === 1) call(t, 'Cacti coming: dodge as they go off', { dur: 5 });
        else if (layers === 2) desertQuicksand(ev, i);
        else if (layers === 3) storm(ev, i);
        else if (layers === 4) lava(ev, i);
      } else if (name === 'Spray Pain') {
        sprays++;
        if (sprays === 1) cactusWaves(ev, i);
      } else if (name === 'Double Style') {
        doubleStyles++;
        if (doubleStyles === 2) desertBombs(ev, i);
        else if (doubleStyles === 3) riverStyle(ev, i);
      } else if (name === 'Soul Sugar') {
        adds(ev, i);
      } else if (name === 'Single Style') {
        const rush = next(i, e => e.name === 'Rush', 8);
        const tr = rush ? rush.t : t + 4.1, pat = pick(['A', 'B']);
        lanes(pat, tr, tr - 6.3, 'Rush');
        const c = pat === 'A' ? cell('A', 'C') : cell('B', 'C');
        pref(tr - 6.3, all(s => add(c, ringOff(s, 1.2))));
        pref(tr + 0.3, UP);
        call(castOf(ev, 6), 'Avoid the arrow lines: into the middle square', { alert: true, dur: 6 });
      } else if (name === 'Artistic Anarchy') {
        call(castOf(ev, 8), 'Enrage: Artistic Anarchy', { alert: true, dur: 8 });
      }
    });

    // ---------- the desert ----------
    function cactusWaves(ev) {
      const pattern = Math.floor(Math.random() * CACTI.length), waves = CACTI[pattern];
      const times = waves.map((_, k) => ev.t + 3.03 * k);
      P.labels.set(ev, `Spray Pain (cactus pattern ${[1, 3, 4][pattern]})`);
      // The party moves as one: after each wave lands, to the ground clear of the next nearest where it's going (the
      // stack's spot, or for the two defamations their corners), at most a 3-second run on.
      const b1 = events.find(e => /^Br.l.e\//.test(e.name));
      const D = desertDefams(strat), last = times[times.length - 1];
      const goal = { party: D.stack, tank: D.tank, dps: D.dps }, pos = { party: [0, 9], tank: [0, 9], dps: [0, 9] };
      waves.forEach((w, k) => {
        const tt = times[k];
        for (const c of w) hz({ t: tt, tell: k ? times[k - 1] : tt - 6, shape: 'circle', at: c, r: 10, dmg: 1.3, name: 'Spray Pain', react: 3 });
        for (const g of Object.keys(pos)) {
          const prev = pos[g], want = safeFrom(goal[g], w, 2.2) || goal[g];
          const step = dist(prev, want) > 14 ? add(prev, unit([want[0] - prev[0], want[1] - prev[1]]), 14) : want;
          let p = safeFrom(step, w, 2.2);
          if (!p || dist(p, prev) > 16.5) p = safeFrom(prev, w, 2.2) || safeFrom(prev, w, 1.4) || prev;
          pos[g] = p;
        }
        const spots = clump(pos.party);
        if (b1) { spots[deskTank] = pos.tank; spots[deskDps] = pos.dps; }
        pref(k ? times[k - 1] + 0.05 : tt - 4, spots);
      });
      // Then the short defamations and the party stack.
      if (!b1) return;
      const spots = all(s => (s === deskTank ? D.tank : s === deskDps ? D.dps : add(D.stack, ringOff(s, 1))));
      pref(last + 0.05, spots);
      P.labels.set(b1, 'Brûlée (defamations) + Crowd Brûlée (stack)');
      const group = S.filter(s => s !== deskTank && s !== deskDps);
      check({ t: b1.t, kind: 'spread', slots: [deskTank, deskDps], r: 15, dmg: 0.3, fail: 0.8, name: 'Brûlée' });
      check({ t: b1.t, kind: 'stack', groups: [group], r: 6, dmg: 0.3, fail: 0.6, name: 'Crowd Brûlée' });
      call(last + 0.1, `Defamations out (${deskTank}, ${deskDps}), party stack on ${deskStack}`, { dur: 5 });
      for (const s of [deskTank, deskDps]) call(last + 0.1, 'Defamation: go to your corner', { slot: s, alert: true, dur: 5 });
      pref(b1.t + 0.5, UP);
    }

    function desertQuicksand(ev) {
      // The quicksand round the middle (23 yalms) and nine cacti leave the corners; one corner has a cactus.
      const appear = ev.t + 7.1, spray = events.find(e => e.name === 'Spray Pain' && e.t > ev.t), b2 = events.find(e => /^Br.l.e$/.test(e.name));
      const ts = spray ? spray.t : ev.t + 15.8, act = ts + 0.46, gone = act + 4;
      qsCorner = Math.floor(Math.random() * 4);
      if (spray) P.labels.set(spray, `Spray Pain (${CORNER[qsCorner]} unsafe)`);
      hz({ t: act, tell: appear, shape: 'circle', at: [0, 0], r: 23, dmg: 1.4, name: 'Quicksand', react: 3 });
      markLit({ shape: 'circle', at: [0, 0], r: 23 }, appear, gone, 'rgba(230,180,90,0.16)');
      for (const c of QS_CACTI[qsCorner]) hz({ t: ts, tell: ts - 8.5, shape: 'circle', at: c, r: 10, dmg: 1.3, name: 'Spray Pain', react: 3 });
      const spots = desertCorners(strat, qsCorner);
      pref(appear, spots);
      if (b2) {
        P.labels.set(b2, 'Brûlée (healer defamations)');
        check({ t: b2.t, kind: 'spread', slots: ['H1', 'H2'], r: 15, dmg: 0.3, fail: 0.8, name: 'Brûlée' });
      }
      const cornerOf = (p) => CORNER[CORNER_AT.findIndex(c => c[0] === Math.sign(p[0]) && c[1] === Math.sign(p[1]))];
      call(appear, `Quicksand: corners. Cactus ${CORNER[qsCorner]}, the party goes ${cornerOf(spots.MT)}`, { alert: true, dur: 7 });
      for (const s of ['H1', 'H2']) call(appear, `Defamation: alone in the ${cornerOf(spots[s])} corner`, { slot: s, dur: 6 });
      pref(gone + 0.2, UP);
    }

    function desertBombs(ev) {
      // Blue tethers (the supports) drop their paint bombs in the quicksand; pink (the DPS) aim their winged bombs
      // into it from outside; Pudding Graf's 6-yalm spreads place them; then everyone out before it sinks.
      const graf = next(events.indexOf(ev), e => e.name === 'Pudding Graf', 3);
      const tg = graf ? graf.t : ev.t + 1, appear = ev.t - 7.4, act = tg + 2.5;
      qsNorth = Math.random() < 0.5;
      const qc = [0, qsNorth ? 20 : -20], spots = bombSpots(strat, qsNorth);
      P.labels.set(ev, `Double Style (bombs, quicksand ${qsNorth ? 'north' : 'south'})`);
      if (graf) { P.labels.set(graf, 'Pudding Graf (spreads)'); done.add(graf); }
      hz({ t: act, tell: appear, shape: 'circle', at: qc, r: 23, dmg: 1.4, name: 'Quicksand', react: 2.3 });
      markLit({ shape: 'circle', at: qc, r: 23 }, appear, act + 7, 'rgba(230,180,90,0.16)');
      pref(appear, spots);
      check({ t: tg, kind: 'spread', r: 6, dmg: 0.25, fail: 0.7, name: 'Pudding Graf' });
      check({ t: tg, kind: 'spot', slots: SUPPORT, spots, r: 3, fail: 0.9, name: 'Paint Bomb' });
      const outY = qsNorth ? -5 : 5;
      pref(tg + 0.05, Object.fromEntries(SUPPORT.map(s => [s, [spots[s][0], outY]])));
      pref(act + 0.5, UP);
      for (const s of SUPPORT) call(appear, 'Blue tether: stand in the quicksand to drop your bomb', { slot: s, alert: true, dur: 6 });
      for (const s of DPS) call(appear, 'Pink tether: face the quicksand from outside (your bomb flies 16 yalms)', { slot: s, alert: true, dur: 6 });
      call(tg + 0.1, 'Out of the quicksand', { alert: true, dur: 2.5 });
    }

    // ---------- the adds ----------
    function adds(ev) {
      const lp = events.filter(e => e.name === 'Live Painting' && e.t > ev.t);
      const ore = events.filter(e => e.name === 'Ready Ore Not' && e.t > ev.t);
      const ss = events.find(e => e.name === 'Single Style' && e.t > ev.t);
      if (lp.length < 4) return;
      lp.forEach((e, k) => P.labels.set(e, `Live Painting (wave ${k + 1})`));
      pref(lp[0].t, ADDS[1]);
      pref(lp[1].t + 1, ADDS[2]);
      pref(lp[2].t + 1, ADDS[3]);
      pref(lp[3].t + 1, ADDS[4]);
      call(lp[0].t, 'Adds: ram west with OT, MT holds the boss and squirrels', { dur: 6 });
      // Wave 2: the feather rays tether R2 (north-west) and H2 (north-east): an 8-yalm Water III each, its puddle
      // staying on the floor.
      const w2 = lp[1].t + 3.1;
      const drop = (s, p, tt) => {
        check({ t: tt, kind: 'spread', slots: [s], r: 8, dmg: 0.3, fail: 0.7, name: 'Water III' });
        deb(s, 'vulnUp', 'Vulnerability Up', 'from your Water III', tt, tt + 8);
        voidzone(p, 8, tt + 2.5, tt + 30, 'Water III');
      };
      drop('R2', ADDS[2].R2, w2 + 10.1);
      drop('H2', ADDS[2].H2, w2 + 10.1);
      pref(w2 + 10.15, { R2: [1.5, 7.5], H2: [-1.5, 6.5] });          // back to the party, off the puddles
      call(lp[1].t, 'Feather rays: R2 north-west, H2 north-east (8-yalm puddles)', { dur: 6 });
      // Wave 3: the Jabberwock binds a healer, who goes south-east first.
      const healers = shuffle(['H1', 'H2']);
      const jab1 = lp[2].t + 11.1, jab2 = lp[3].t + 11.1;
      bindHealer = healers[0];
      pref(jab1 - 3, { [healers[0]]: [17, -17] });
      deb(healers[0], 'bind', 'Bind', 'the Jabberwock has you: kill it fast', jab1, ore[0] ? ore[0].t : jab1 + 18);
      call(jab1 - 3, 'Jabberwock on YOU: go south-east', { slot: healers[0], alert: true, dur: 5 });
      // Wave 4: rays on R1 (south-west) and R2 (south-east), three drops each, walking up the edge; the Jabberwock
      // binds a healer again (south).
      const w4 = lp[3].t + 3.1;
      [0, 1, 2].forEach(n => {
        const tt = w4 + 10.5 + 9.3 * n;
        const p1 = [ADDS[4].R1[0], ADDS[4].R1[1] + 10 * n], p2 = [ADDS[4].R2[0], ADDS[4].R2[1] + 10 * n];
        if (n) pref(tt - 9.15, { R1: p1, R2: p2 });          // on up the edge, off the last puddle
        drop('R1', p1, tt);
        drop('R2', p2, tt);
        if (n === 2) pref(tt + 0.15, { R1: [-9, 0], R2: [8, 0] });
      });
      call(lp[3].t, 'Feather rays: R1 south-west, R2 south-east; MT takes the Jabberwock north', { dur: 6 });
      const h2 = pick(['H1', 'H2']);
      pref(jab2 - 3, { [h2]: [-0.9, -18.5], [h2 === 'H1' ? 'H2' : 'H1']: [-0.4, -1] });
      deb(h2, 'bind', 'Bind', 'the Jabberwock has you: kill it fast', jab2, jab2 + 15);
      call(jab2 - 3, 'Jabberwock on YOU: go south', { slot: h2, alert: true, dur: 5 });
      if (ss) pref(ss.t - 6.9, UP);
    }

    // ---------- the river ----------
    function markRiver(t) {
      const lavaLayer = events.filter(e => e.name === 'Layer')[3];
      const tl = lavaLayer ? lavaLayer.t : t + 100;
      river(t + 8, tl + 7, 'rgba(90,170,255,0.16)');
    }
    function riverStyle(ev) {
      // Double Style: fire (light party stacks on the healers, in the water) or lightning (spreads, out of it), with
      // the arrows.
      const rush = next(events.indexOf(ev), e => e.name.startsWith('Rush+'), 6);
      const tr = rush ? rush.t : ev.t + 4.1, fire = Math.random() < 0.5, pat = pick(['A', 'B']);
      const cs = castOf(ev, 6);
      P.labels.set(ev, `Double Style (${fire ? 'fire' : 'lightning'})`);
      if (rush) { P.labels.set(rush, `Rush + Taste of ${fire ? 'Fire (healer stacks)' : 'Thunder (spreads)'}`); done.add(rush); }
      lanes(pat, tr, tr - 7.2, 'Rush');
      pref(cs + 1, fire ? fireSpots(pat) : lightningSpots(strat, pat));
      if (fire) check({ t: tr, kind: 'stack', groups: FIRE, r: 6, dmg: 0.3, fail: 0.6, name: 'Taste of Fire' });
      else check({ t: tr, kind: 'spread', r: 6, dmg: 0.25, fail: 0.7, name: 'Taste of Thunder' });
      call(cs, fire ? 'Healer groups in the water, avoid the arrow lines' : 'Spread out of the water, avoid the arrow lines', { alert: true, dur: 7 });
    }

    // ---------- the storm ----------
    function storm(ev) {
      // The cloud strikes 21 yalms round itself every 10.6 s, moving island to island; the party waits on the bridge
      // across from it. First everyone baits a 3-yalm puddle round that bridge, then steps on.
      const ls = events.filter(e => e.name === 'Lightning Storm' && e.t > ev.t), bait = events.find(e => e.name === 'Taste of Thunder' && e.t > ev.t);
      if (ls.length < 4) return;
      const strikes = [ls[0].t - 10.6, ...ls.map(e => e.t)];
      cloud = [pick(['NE', 'NW', 'S'])];
      for (let k = 1; k < strikes.length; k++) cloud.push((Math.random() < 0.5 ? CLOUD_CW : CLOUD_CCW)[cloud[k - 1]]);
      const bridges = cloud.map(c => SAFE_BRIDGE[c]);
      const tb = bait ? bait.t : strikes[0] - 1.8, snap = tb - 3;
      // The puddles, round the first bridge.
      const b0 = BRIDGE[bridges[0]];
      const ring = all(s => add(b0, at(S.indexOf(s) * 45, 4.8)));
      pref(ev.t - 1.5, ring);
      for (const s of S) hz({ t: tb, tell: snap, shape: 'circle', at: ring[s], r: 3, dmg: 1.0, name: 'Taste of Thunder', react: 2.8 });
      if (bait) { P.labels.set(bait, 'Taste of Thunder (puddles)'); done.add(bait); }
      call(snap - 1, `Bait your puddle by the ${bridges[0] === 'N' ? 'north' : bridges[0] === 'SE' ? 'south-east' : 'south-west'} bridge, then step on it`, { alert: true, dur: 5 });
      pref(snap + 0.05, clump(b0, 0.3));
      // Who takes each Lightning Storm: a support and a DPS.
      const sup = shuffle(SUPPORT), dps = shuffle(DPS);
      strikes.forEach((ts, k) => {
        const c = cloud[k], br = bridges[k], bp = BRIDGE[br];
        hz({ t: ts, tell: k ? strikes[k - 1] + 1 : ts - 6.9, shape: 'circle', at: CLOUD[c], r: 21, dmg: 1.5, name: 'Highlightning', react: 3 });
        markLit({ shape: 'circle', at: BRIDGE[br], r: 2.5 }, k ? strikes[k - 1] : ts - 6, ts, 'rgba(255,255,160,0.25)');
        if (k) pref(strikes[k - 1] + 0.8, clump(bp, 0.3));
        call(k ? strikes[k - 1] + 0.1 : ts - 6, `Cloud ${c === 'S' ? 'south' : c === 'NE' ? 'north-east' : 'north-west'}: to the ${br === 'N' ? 'north' : br === 'SE' ? 'south-east' : 'south-west'} bridge`, { dur: 5 });
        if (!k) return;
        const lev = ls[k - 1], targets = [sup[k - 1], dps[k - 1]], [cw, ccw] = ISLES[br];
        const spots = { [targets[0]]: ISLE_SPOT[cw], [targets[1]]: ISLE_SPOT[ccw] };
        pref(ts - 3.2, spots);
        pref(ts + 0.8, Object.fromEntries(targets.map(s => [s, add(bp, ringOff(s, 0.3))])));
        check({ t: ts, kind: 'spread', slots: targets, r: 8, dmg: 0.3, fail: 0.8, name: 'Lightning Storm' });
        const on = S.filter(s => !targets.includes(s));
        check({ t: ts + 0.7, kind: 'spot', slots: on, spots: Object.fromEntries(on.map(s => [s, bp])), r: 2.6, fail: 0.8, name: 'Levin Drop' });
        for (const s of targets) call(ts - 5, `Lightning Storm on YOU: out to the ${s === targets[0] ? 'clockwise' : 'counter-clockwise'} island`, { slot: s, alert: true, dur: 5 });
        P.labels.set(lev, `Lightning Storm (${targets.join(', ')})`);
        // Lightning Bolts: six 4-yalm circles, twice between strikes, never on the bridges or where the next
        // Lightning Storm goes.
        const prev = strikes[k - 1];
        for (const tt of [prev + 4.6, prev + 7.1]) {
          const avoid = [BRIDGE.N, BRIDGE.SE, BRIDGE.SW, ...Object.values(spots)];
          for (let n = 0, tries = 0; n < 6 && tries < 300; tries++) {
            const p = [Math.random() * 36 - 18, Math.random() * 36 - 18];
            if (avoid.some(q => dist(p, q) < 7)) continue;
            hz({ t: tt, tell: tt - 3, shape: 'circle', at: p, r: 4, dmg: 1.0, name: 'Lightning Bolt', react: 2.5 });
            n++;
          }
        }
      });
      lastBridge = BRIDGE[bridges[bridges.length - 1]];
      stormEnd = strikes[strikes.length - 1];
      // Pudding Party: five party stacks on one player, on the last bridge.
      const pp = events.find(e => e.name === 'Pudding Party x5' && e.t > stormEnd);
      if (pp) {
        const tgt = pick(S);
        P.labels.set(pp, `Pudding Party x5 (on ${tgt})`);
        pref(stormEnd + 0.8, clump(lastBridge, 0.4));
        for (let n = 0; n < 5; n++) check({ t: pp.t + 1.06 * n, kind: 'stack', groups: [S.slice()], r: 6, dmg: 0.15, fail: 0.5, name: 'Pudding Party' });
        call(pp.t - 4, `Stack on ${tgt} five times`, { alert: true, dur: 6 });
      }
    }

    // ---------- the lava ----------
    function lava(ev) {
      // The river turns to lava. Healers and ranged pair up on the north-west and north-east islands for Mousse Drip,
      // the tanks and melee bait Moussacre south of the boss, then everyone takes a tower.
      const tl = ev.t;
      river(tl + 7, tl + 70, 'rgba(255,90,40,0.28)');
      const drip = events.find(e => e.name === 'Mousse Drip' && e.t > tl && e.cast);
      const drops = events.filter(e => e.name === 'Mousse Drip' && e.t > tl && !e.cast).slice(0, 4);
      const mous = events.find(e => e.name === 'Moussacre' && e.t > tl), snapM = events.find(e => e.name === 'Moussacre (snapshot)' && e.t > tl);
      const bait = events.find(e => e.name === 'Taste of Thunder' && e.t > tl), boom = events.find(e => e.name === 'Explosion' && e.t > tl);
      if (!drip || drops.length < 4 || !boom) return;
      const T = towers1(strat);
      t1Spots = T;
      const baiters = base(strat) === 'game8' ? ['H1', 'H2'] : ['R1', 'R2'];
      const pairs = [['H1', 'R1', 1], ['H2', 'R2', -1]];
      const zones = [];
      // Before: the islands and the boss's south.
      pref(tl + 1, Object.assign({}, all(s => (PROTEAN_DEG[s] !== undefined ? at(PROTEAN_DEG[s], 6.5) : null)),
        { H1: add(DRIPS[0], [1.5, -1]), R1: add(DRIPS[0], [-0.5, 1]), H2: add([-DRIPS[0][0], DRIPS[0][1]], [-1.5, -1]), R2: add([-DRIPS[0][0], DRIPS[0][1]], [0.5, 1]) }));
      for (const [h, r, side] of pairs) {
        const tgt = baiters.includes(h) ? h : r, mate = tgt === h ? r : h;
        DRIPS.forEach((d0, k) => {
          const d = [d0[0] * side, d0[1]], tt = drops[k].t;
          pref(k ? drops[k - 1].t + 0.05 : castOf(drip, 5), { [tgt]: d, [mate]: add(d, unit([-d[0], -d[1]]), 1) });
          zones.push(d);
          voidzone(d, 5, tt + 2, tt + 8, 'Mousse Drip');
        });
        call(castOf(drip, 5), `Mousse Drip on YOU: four drops, ${mate} stacks with you`, { slot: tgt, alert: true, dur: 6 });
        call(castOf(drip, 5), `Stack with ${tgt} for four drops`, { slot: mate, dur: 6 });
      }
      drops.forEach((e, k) => { P.labels.set(e, `Mousse Drip (${k + 1})`); check({ t: e.t, kind: 'stack', groups: pairs.map(p => p.slice(0, 2)), r: 5, dmg: 0.25, fail: 0.6, name: 'Mousse Drip' }); });
      drops.forEach(e => done.add(e));
      // Moussacre: a cone at each of the four closest to the boss.
      if (snapM) {
        for (const s of Object.keys(PROTEAN_DEG)) hz({ t: snapM.t, tell: castOf(mous, 4), shape: 'protean', aimed: true, target: s, half: 15, r: 60, dmg: 0.9, own: 0.3, name: 'Moussacre' });
        call(castOf(mous, 4), 'Moussacre: tanks and melee bait the cones south, 25 degrees apart', { dur: 5 });
        P.labels.set(mous, 'Moussacre (cones at the four closest)');
      }
      // The towers: bait your puddle at the tower's edge, step across.
      const tbait = bait ? bait.t - 3 : boom.t - 4.8, after = Math.max(drops[3].t, snapM ? snapM.t : 0) + 0.1;
      const live = zones.filter((z, n) => drops[n % 4].t + 8 > tbait);
      const { A, B: Bspot } = baitSoak(T, live);
      pref(after, A);
      pref(tbait + 0.05, Bspot);
      for (const s of S) hz({ t: tbait + 3, tell: tbait, shape: 'circle', at: A[s], r: 3, dmg: 1.0, name: 'Taste of Thunder', react: 2.8 });
      if (bait) { P.labels.set(bait, 'Taste of Thunder (puddles)'); done.add(bait); }
      P.marks.push(...Object.values(T).map(p => ({ kind: 'spotlight', at: p, r: 3, t0: tl + 15, t1: boom.t })));
      check({ t: boom.t, kind: 'spot', spots: T, r: 3, fail: 1.2, name: 'Explosion (tower)' });
      P.labels.set(boom, 'Explosion (towers)');
      done.add(boom);
      call(tbait - 2, 'Bait your puddle at your tower\'s edge, then step across into it', { alert: true, dur: 5 });
    }

    function lavaTowers2(ev) {
      // Wingmark: fly from the first towers to the second (four on one island and two on each other, or all eight
      // south), bait the puddles, soak.
      const tw = ev.t, stun = tw + 11, appear = tw + 3.1;
      const bait = events.find(e => e.name === 'Taste of Thunder' && e.t > tw), boom = events.find(e => e.name === 'Explosion' && e.t > tw);
      if (!boom) return;
      const type = pick(['NE', 'NW', '8S']);
      const T = towers2(strat, type), from = t1Spots || UP;
      const launch = all(s => launchTo(T[s], from[s]));
      pref(appear, launch);
      pref(stun - 2.2, T);
      for (const s of S) {
        deb(s, 'wingmark', 'Wingmark', `you fly ${FLY} yalms the way you face when it runs out`, tw, stun);
        deb(s, 'stun', 'Stun', 'flying', stun, stun + 3);
      }
      const tbait = bait ? bait.t - 3 : boom.t - 5;
      const { A, B: Bspot } = baitSoak(T, []);
      pref(stun + 3.6, A);
      pref(tbait + 0.05, Bspot);
      for (const s of S) hz({ t: tbait + 3, tell: tbait, shape: 'circle', at: A[s], r: 3, dmg: 1.0, name: 'Taste of Thunder', react: 2.8 });
      if (bait) { P.labels.set(bait, 'Taste of Thunder (puddles)'); done.add(bait); }
      P.marks.push(...Object.values(T).map(p => ({ kind: 'spotlight', at: p, r: 3, t0: appear, t1: boom.t })));
      check({ t: boom.t, kind: 'spot', spots: T, r: 3, fail: 1.2, name: 'Explosion (tower)' });
      P.labels.set(ev, `Wingmark (towers: ${type === '8S' ? 'all eight south' : `four ${type === 'NE' ? 'north-east' : 'north-west'}`})`);
      P.labels.set(boom, 'Explosion (towers)');
      done.add(boom);
      call(appear, type === '8S' ? '8 towers south: launch onto your tower' : `4 towers ${type === 'NE' ? 'north-east' : 'north-west'}: everyone rotates ${type === 'NE' ? 'counter-clockwise' : 'clockwise'}`, { alert: true, dur: 7 });
      pref(boom.t + 0.5, UP);
    }

    return P;
  }

  B.FIGHT_SCRIPTS = B.FIGHT_SCRIPTS || {};
  B.FIGHT_SCRIPTS.m6s = {
    // Her max HP in FFLogs' M6S kills (every damage event on her carries it).
    hp: 93010785,
    // The four Live Painting waves (from the first to the second Ready Ore Not): in FFLogs' kills the adds take about
    // 37.7M, most of the party's damage then; the rest cleaves onto her.
    adds: [{ from: 224, to: 392, hp: 37.7e6, share: 0.75, name: 'Live Painting adds' }],
    defaultStrat: 'toxic',
    strats: {
      toxic: { label: 'Hector/Toxic (NA / EU)' },
      game8: { label: 'Game8 (JP)' },
      mr: { label: 'MR (OCE)' },
      latte: { label: 'Latte' },
      yukizuri: { label: 'Yukizuri' },
    },
    source: 'wtfdig.info/72/m6s; mechanics after BossMod (github.com/awgil/ffxiv_bossmod) and FFLogs kills',
    waymarks: [
      { label: 'A', at: [0, 10], color: 'red' }, { label: 'B', at: [10, 0], color: 'yellow' },
      { label: 'C', at: [0, -10], color: 'blue' }, { label: 'D', at: [-10, 0], color: 'purple' },
      { label: '1', at: [-10, 10], color: 'red', square: true }, { label: '2', at: [10, 10], color: 'yellow', square: true },
      { label: '3', at: [10, -10], color: 'blue', square: true }, { label: '4', at: [-10, -10], color: 'purple', square: true },
    ],
    plan,
  };
})(window.BLM);
