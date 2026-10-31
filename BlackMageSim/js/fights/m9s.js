// M9S, AAC Heavyweight M1 (Savage): Vamp Fatale's mechanics for the sim's party, on cactbot's timeline, and the strats
// wtfdig.info lists for them: Toxic/Hector (its default, NA / EU / OCE) and Game8/Nukemaru (JP), on wtfdig in English and
// in Japanese (game8jp: the same spots). The two differ in Hell in a Cell (the tower order clockwise from north:
// tank, healer, melee, ranged or tank, melee, ranged, healer; and where the healer and the DPS take Ultrasonic Spread's
// cones) and in Sadistic Screech 2 (Game8's melee hit the flails, Toxic's everyone but the tanks the doornail); the rest
// is the same spots. Spots are [east, north] yalms from the arena's middle.
//
// The mechanics follow BossMod's module for the fight (github.com/awgil/ffxiv_bossmod, RM09SVampFatale), whose shapes and
// sizes come from the game's Action sheet, and where things land follows two FFLogs kills (the boss's and her helpers'
// positions as they cast). Built with the sim's toolkit (js/mech.js):
//   - The floor (the plan's arena and looks): a 40-yalm square; for the saw phases only the middle strip, 20 wide (the
//     sides are buzzsaws: off it is a fall); a circle of radius 20 from each Finale Fatale to the next Insatiable Thirst.
//   - Hardcore: a 6-yalm circle on each tank (15 yalms once she's well fed, the last one).
//   - Vamp Stomp: a 10-yalm circle in the middle, then a ring spreading out from her at 2 yalms a second; everyone has
//     Curse of the Bombpyre, an 8-yalm burst when the ring reaches them (tanks and melee on the cardinals 11 out, healers
//     and ranged on the intercards 18 out, as both strats have it), between three waves of bats' 8-yalm bursts: two 6 out
//     on an axis, three 13 out on a triangle, five 20 out on a pentagon (each pull's own, as the logs show them).
//   - Brutal Rain: a party stack hit 3, 4 or 5 times.
//   - Sadistic Screech: the sides go; the Coffinmaker eats the strip from the north 10 yalms a Dead Wake, and each round
//     she leaps beside it (east, west, then south of it, as the logs have her) for two Half Moons (half the strip, then
//     the other half) while Coffinfiller's 5-wide saw lanes come out two at a time.
//   - Pulping Pulse: 5-yalm puddles where six (later all eight) stand as the cast starts.
//   - Aetherletting: four turns of opposite 45-degree cones round her, two 6-yalm drops at a time at the clock spots on
//     the edge, each a cross 10 wide 14.4 s later (the middle stays clear).
//   - Half Moon: her left half, then her right (or the other way); bigger at the end (4 yalms past her middle).
//   - Sadistic Screech 2: the strip again, with BossMod's Gravegrazer saws (two sweeping east-west 10 out north and
//     south, two looping up and down the lanes), the tanks' Plummet towers (3 yalms), and Electrocution's circle where a
//     Deadly Doornail comes up, its electrified floor growing half a yalm a second till it's dead; the flails and the
//     doornail take the party's damage while they're up.
//   - Hell in a Cell: four one-player towers 12 out (a light party's; the four at 0/135/225/315 turned each pull, then
//     the other four); whoever takes one is shut in a 4-yalm cell till it's dead. Meanwhile the other light party takes
//     Ultrasonic Spread (a 100-degree cone at its tank, 45-degree ones at its healer and its DPS) and Ultrasonic Amp (a
//     100-degree cone they share), in whichever order the pull picks.
//   - Undead Deathmatch: two four-player towers (north and south or west and east), each light party's bat starting
//     there; each follows its bat (a tether that mustn't stretch past 12) half way round the arena while Sanguine
//     Scratch's eight 30-degree claws alternate round her, then the bats burst (a 7-yalm circle: out, toward her; a 4-15
//     donut: under it); twice. The last Sanguine Scratch has no bats.
//   - Raidwides: Killer Voice, Sadistic Screech, Crowd Kill, Finale Fatale, Insatiable Thirst; Finale Fatale's enrage.
// Simplified: cactbot's timeline branches at Hell in a Cell (which Ultrasonic comes first); the export reads it straight
// through, so the script keeps its main line and brings the rest back 400 s (the map's own copy is fixed the same way).
// The Coffinmaker, flails, doornails and cells die on the timeline's schedule (their HP only soaks damage; what would
// happen if they lived, the Coffinmaker's last Dead Wake and the flails' Barbed Burst, never does). Curses go off at
// the time the ring reaches the strat's spot. The bats' flight (half the arena 12 out, each pull's way round) and how
// far the tether stretches (12, BossMod's guess) are guesses; Pulping Pulse's six are random; Aetherletting's drop order
// is drawn so nobody drops while a cone going off touches their spot (the drops on the spots keep the middle clear).
// The Saws 2 tower and doornail spots, and her spots round the Coffinmaker, are the two logs' (the same both times).
(function (B) {
  const S = B.SLOTS;
  const all = (f) => Object.fromEntries(S.map(s => [s, f(s)]));
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
  const G1 = ['MT', 'H1', 'M1', 'R1'], G2 = ['OT', 'H2', 'M2', 'R2'];
  const TANKS = ['MT', 'OT'], DPS = ['M1', 'M2', 'R1', 'R2'], NON_TANKS = S.filter(s => !TANKS.includes(s));
  const ROLE = { MT: 'T', OT: 'T', H1: 'H', H2: 'H', M1: 'M', M2: 'M', R1: 'R', R2: 'R' };
  const COMPASS = ['north', 'north-northeast', 'northeast', 'east-northeast', 'east', 'east-southeast', 'southeast', 'south-southeast',
    'south', 'south-southwest', 'southwest', 'west-southwest', 'west', 'west-northwest', 'northwest', 'north-northwest'];
  const dirName = (deg) => COMPASS[Math.round(deg360(deg) / 22.5) % 16];
  const brg = (p) => deg360(Math.atan2(p[0], p[1]) * 180 / Math.PI);
  const assign = (slots, pts) => Object.fromEntries(slots.map((s, i) => [s, pts[i]]));

  // ---------- the timeline ----------
  // cactbot's timeline branches at Hell in a Cell (Ultrasonic Spread or Amp first, twice), its branches at 507-837 s and
  // the fight going on from 838.4; read straight through, those copies would sit between the two. The main line runs to
  // 438.4 and the rest follows on from there (done once; the timeline's own events, so the cast bar and list agree).
  const CUT = 438.4, BACK = 838.4;
  function linear(events) {
    if (!events.some(e => e.t > BACK)) return events;
    const keep = events.filter(e => e.t <= CUT || e.t > BACK);
    for (const e of keep) {
      if (e.t > BACK) e.t = +(e.t - (BACK - CUT)).toFixed(1);
      e.name = e.name.replace(/\?$/, '');
    }
    events.length = 0;
    events.push(...keep);
    return events;
  }

  // ---------- the floor ----------
  // A 40-yalm square; the middle strip (20 wide) from the first and third Sadistic Screech to the next (the Coffinmaker
  // eating it from the north, 10 yalms a Dead Wake); a circle of 20 from Finale Fatale to Insatiable Thirst.
  // Its look: the floor is two models, the middle strip (a1_flo01, always there) and the sides (a1_flo02, gone in the
  // saw phases). The props standing on it are the mechanics': the spiked flails and their chains (a1_bal01-04) at the
  // eight tower spots, up for each Plummet set till its flails are dead; the doornails' lightning rods (a1_rod01) at the
  // same eight, up while a doornail lives; and saw blades (a1_saw01: the Coffinmaker's teeth across the strip and the
  // Gravegrazers' resting places, with more lying round the room) that never stand where the fight puts them, so never
  // shown. (Each model is all its copies: the eight flails and rods show together, where the game drops two and one.)
  // The cages, thorns and spiked balls round the room (a1_cag01, a1_ndl, a1_bal06...) are 41 yalms out and more: the
  // room's own, always there.
  const BALLS = ['a1_bal01', 'a1_bal02', 'a1_bal03', 'a1_bal04'];
  function arenas(events) {
    const A = [{ t: 0, shape: 'square', half: 20 }];
    const scr = events.filter(e => e.name === 'Sadistic Screech').map(e => e.t), strips = [];
    for (let k = 0; k + 1 < scr.length; k += 2) {
      const a = scr[k], b = scr[k + 1];
      strips.push([a + 0.75, b + 0.1]);
      A.push({ t: a + 0.75, shape: 'rect', a: [-10, -20], b: [10, 20], deathwall: true });
      events.filter(e => e.name === 'Dead Wake' && e.t > a && e.t < b)
        .forEach((e, n) => A.push({ t: e.t + 0.1, shape: 'rect', a: [-10, -20], b: [10, 10 - 10 * n], deathwall: true }));
      A.push({ t: b + 0.1, shape: 'square', half: 20 });
    }
    for (const e of events) {
      if (e.name === 'Finale Fatale') A.push({ t: e.t + 0.1, shape: 'circle', at: [0, 0], r: 20 });
      if (e.name === 'Insatiable Thirst') A.push({ t: e.t + 0.1, shape: 'square', half: 20 });
    }
    // The look at each change: the sides unless in a strip, the flails from each Plummet's cast till they're dead, the
    // rods while its doornail lives; the saws only far past the enrage (named, so they hide).
    const plums = events.filter(e => e.name === 'Plummet').map(e => e.t);
    const flails = plums.map(p => [p - 7, p + 9.6]), rods = plums.map(p => [p + 0.6, p + 10]);
    const within = (ws, t) => ws.some(([a, b]) => t >= a && t < b);
    const showAt = (t) => [].concat(within(strips, t) ? [] : ['a1_flo02'], within(flails, t) ? BALLS : [], within(rods, t) ? ['a1_rod01'] : []);
    const cuts = [...new Set([0, ...[strips, flails, rods].flat(2)])].sort((x, y) => x - y), L = [];
    for (const t of cuts) {
      const show = showAt(t);
      if (!L.length || L[L.length - 1].show.join() !== show.join()) L.push({ t, show });
    }
    L.push({ t: 99999, show: ['a1_saw01'] });
    return { arena: A.sort((x, y) => x.t - y.t), looks: L };
  }
  const onA = (a, p, m) => {
    if (a.shape === 'circle') return Math.hypot(p[0], p[1]) < a.r - m;
    if (a.shape === 'rect') return p[0] > Math.min(a.a[0], a.b[0]) + m && p[0] < Math.max(a.a[0], a.b[0]) - m && p[1] > Math.min(a.a[1], a.b[1]) + m && p[1] < Math.max(a.a[1], a.b[1]) - m;
    return Math.abs(p[0]) < a.half - m && Math.abs(p[1]) < a.half - m;
  };

  // n points near `want` clear of every shape in hs (by a bot's margin and a little), on the floor (ok), gap apart.
  function clump(hs, want, n, ok, o) {
    o = o || {};
    const m = o.m === undefined ? 1.3 : o.m, gap = o.gap || 0.55;
    const good = (p) => ok(p) && hs.every(h => !inside(h, p, m));
    const out = [];
    if (good(want)) out.push(want.slice());
    for (let r = 0.3; r <= 18 && out.length < n; r += 0.3) {
      const k = Math.max(6, Math.round(2 * Math.PI * r / 0.3));
      for (let j = 0; j < k && out.length < n; j++) {
        const a = (j / k) * 2 * Math.PI, p = [want[0] + Math.sin(a) * r, want[1] + Math.cos(a) * r];
        if (good(p) && out.every(q => dist(q, p) >= gap)) out.push(p);
      }
    }
    while (out.length < n) out.push((out[0] || want).slice());
    return out.map(p => [+p[0].toFixed(2), +p[1].toFixed(2)]);
  }

  // ---------- the party's places ----------
  // Uptime: the tanks at her front (she faces her tank, north), everyone else at her back (her hitbox is 4).
  const UP = { MT: [-0.8, 5.5], OT: [1.0, 5.4], M1: [-2.3, -4.9], M2: [2.3, -4.9], H1: [-4.0, -5.8], H2: [4.0, -5.8], R1: [-1.3, -6.6], R2: [1.3, -6.6] };
  // Brutal Rain: the party stacked at her back.
  const STACK = { MT: [-0.7, -3.6], OT: [0.7, -3.6], H1: [-1.4, -4.6], H2: [1.4, -4.6], M1: [-0.7, -5.4], M2: [0.7, -5.4], R1: [-1.2, -6.3], R2: [1.2, -6.3] };
  // Tight in the middle (under her): out of the bats' second and third waves, and Aetherletting's crosses.
  const MID = all(s => at({ MT: 0, R2: 45, H2: 90, M2: 135, OT: 180, M1: 225, H1: 270, R1: 315 }[s], 0.85));
  // Vamp Stomp, both strats: tanks north and south, melee west and east, 11 out (the ring reaches them 5.6 s on);
  // healers south-west and south-east, ranged north-west and north-east, 18 out (9.2 s on).
  const POP_IN = 11.2, POP_OUT = 18.4, IN = ['MT', 'OT', 'M1', 'M2'], OUT = ['H1', 'H2', 'R1', 'R2'];
  const BOMB = { MT: at(0, POP_IN), OT: at(180, POP_IN), M1: at(270, POP_IN), M2: at(90, POP_IN),
    R1: at(315, POP_OUT), R2: at(45, POP_OUT), H1: at(225, POP_OUT), H2: at(135, POP_OUT) };
  // Aetherletting's clock spots on the edge, between the markers (both strats': Game8's markers sit on them).
  const CLOCK_DEG = { MT: 337.5, R2: 22.5, H2: 67.5, M2: 112.5, OT: 157.5, M1: 202.5, H1: 247.5, R1: 292.5 };
  const CLOCK = all(s => at(CLOCK_DEG[s], 19.2));
  // Sadistic Screech 2's towers (the main tank's north, the off tank's south) and doornail, by set (both logs').
  const SAWS2 = [[[5, 16], [-5, -4], [5, -4]], [[5, 4], [5, -16], [-5, 4]], [[-5, 16], [-5, -4], [5, 16]]];

  // Each strat's choices: Hell in a Cell's towers in order clockwise from north (by role), which gap clockwise of the
  // wide one the healer's cone goes in, and who goes to the flails in Sadistic Screech 2.
  const STRATS = {
    toxic: { cells: ['T', 'H', 'M', 'R'], healerCW: true, flailMelee: false },
    game8: { cells: ['T', 'M', 'R', 'H'], healerCW: false, flailMelee: true },
  };
  STRATS.game8jp = STRATS.game8;          // wtfdig's Japanese page of Game8's: the same spots

  // ---------- the saws (Sadistic Screech 2): BossMod's Gravegrazer sequences ----------
  function gravegrazers(t0, until) {
    const out = [];
    // Two 10 x 5 saws sweeping across the strip 10 out north (east first) and south (west first), turning back each
    // time, five sweeps; 1.125 s a step of 3.2 yalms, 1.8 s at each turn.
    let th = t0 + 5.2;
    for (let sweep = 0; sweep < 5; sweep++) {
      for (const row of [10, -10]) {
        const east = (sweep % 2 === 0) === (row > 0);
        for (let k = 0; k < 12; k++) {
          const e0 = east ? -18 + 3.196 * k : 18 - 3.196 * k, lo = east ? e0 : e0 - 10, hi = east ? e0 + 10 : e0, tt = th + 1.125 * k;
          if (hi <= -10 || lo >= 10 || tt > until) continue;
          out.push({ t: +tt.toFixed(2), tell: +(tt - 3.4).toFixed(2), shape: 'line', at: [+e0.toFixed(2), row], deg: east ? 90 : 270, len: 10, w: 5, dmg: 1.4, name: 'Gravegrazer', react: 2.6 });
        }
      }
      th += 11 * 1.125 + 1.8;
    }
    // Two 5 x 5 saws looping the lanes, one each side (the west one the east one turned about the middle): down the
    // outer lane, up the inner, round again; 1.1 s a step of 3.1 yalms.
    const V = [];
    for (let i = 0; i < 14; i++) V.push([7.5, 20 - 3.07 * i, 180]);
    V.push([4.56, -19.9, 270]);
    for (let i = 0; i < 13; i++) V.push([2.5, -19.168 + 3.1 * i, 0]);
    for (let i = 0; i < 2; i++) V.push([3.4 + 3 * i, 19.9, 90]);
    for (let i = 0; i < 13; i++) V.push([7.5, 18.17 - 3.1 * i, 180]);
    for (let i = 0; i < 2; i++) V.push([5.57 - 2.8 * i, -19.9, 270]);
    for (let i = 0; i < 13; i++) V.push([2.5, -17.16 + 3.1 * i, 0]);
    V.push([5.3, 19.9, 90]);
    for (let i = 0; i < 5; i++) V.push([7.5, 19.3 - 3 * i, 180]);
    V.forEach(([e, n, d], k) => {
      const tt = t0 + 4.1 + 1.1 * k;
      if (tt > until) return;
      for (const [E, N, D] of [[e, n, d], [-e, -n, d + 180]]) {
        out.push({ t: +tt.toFixed(2), tell: +(tt - 3.3).toFixed(2), shape: 'line', at: [+E.toFixed(2), +N.toFixed(2)], deg: D % 360, len: 5, w: 5, dmg: 1.3, name: 'Gravegrazer', react: 2.5 });
      }
    });
    return out;
  }

  // ---------- the pull ----------
  function plan(events, strat) {
    linear(events);
    const st = STRATS[strat] || STRATS.toxic;
    const { arena: ARENA, looks: LOOKS } = arenas(events);
    const arenaAt = (t) => { let cur = ARENA[0]; for (const x of ARENA) if (x.t <= t) cur = x; return cur; };
    const okAt = (t, m) => (p) => onA(arenaAt(t), p, m === undefined ? 0.9 : m);
    const P = { start: Object.assign({}, UP), prefs: [], hazards: [], checks: [], calls: [], marks: [], labels: new Map(), debuffs: [],
      boss: [{ t: 0, at: [0, 0] }], hitbox: [{ t: 0, r: 4 }], arena: ARENA, looks: LOOKS };
    let id = 0, hold = -1, home = UP, nScr = 0, plum = 0, cellN = 0, sawsDone = false;
    const cellRot = 45 * Math.floor(Math.random() * 8);           // Hell in a Cell's towers this pull
    const hz = (o) => { const h = Object.assign({ id: ++id, react: 3 }, o); P.hazards.push(h); return h; };
    const pref = (t, spots) => P.prefs.push({ t, spots });
    const call = (t, text, o) => P.calls.push(Object.assign({ t, text }, o));
    const check = (o) => P.checks.push(o);
    const debuff = (slot, key, name, hint, t0, t1) => P.debuffs.push({ slot, key, name, hint, t0, t1 });
    const castOf = (ev, d) => ev.t - (ev.cast || d || 5);
    const next = (i, test, within) => { for (let k = i + 1; k < events.length && events[k].t - events[i].t <= within; k++) if (test(events[k])) return events[k]; return null; };
    const after = (i, test, within) => events.filter((e, k) => k > i && e.t - events[i].t <= within && test(e));
    // A mechanic's spots start no earlier than the last one's are done with, and it ends by sending everyone home.
    const begin = (t0) => Math.max(t0, hold + 0.05);
    const end = (t1, spots) => { pref(t1, spots || home); hold = t1; };
    const cones = (t, tell, deg0, n, half, name, react) => { for (let j = 0; j < n; j++) hz({ t, tell, shape: 'cone', at: [0, 0], deg: deg360(deg0 + 360 / n * j), half, r: 40, dmg: 1.3, name, react }); };
    const runs = new Set();
    const scr = events.filter(e => e.name === 'Sadistic Screech').map(e => e.t);

    events.forEach((ev, i) => {
      const name = ev.name, t = ev.t;
      if (runs.has(ev)) return;

      // ===== raidwides =====
      if (name === 'Killer Voice' || name === 'Crowd Kill' || name === 'Finale Fatale' || name === 'Insatiable Thirst') {
        const cast = { 'Killer Voice': 5, 'Crowd Kill': 5.4, 'Finale Fatale': 6.2, 'Insatiable Thirst': 5.5 }[name];
        const big = name !== 'Killer Voice' && !(name === 'Finale Fatale' && t < 200);
        hz({ t, tell: t - cast, raidwide: true, dmg: big ? 0.5 : 0.4, name });
        call(t - cast, big ? 'Big raidwide' : 'Raidwide', { dur: 3 });
        if (name === 'Finale Fatale') P.labels.set(ev, `Finale Fatale (${t < 200 ? 'small' : 'big'}; the floor turns round)`);
        if (name === 'Insatiable Thirst') P.labels.set(ev, 'Insatiable Thirst (the floor squares up)');
      } else if (name === 'Finale Fatale (Enrage)') {
        P.labels.set(ev, 'Finale Fatale (the enrage)');
      } else if (name === 'Dead Wake (Enrage)') {
        P.labels.set(ev, 'Dead Wake (the Coffinmaker\'s enrage: down by now)');

      // ===== Hardcore: a circle on each tank =====
      } else if (name === 'Hardcore') {
        const big = t > 500, cs = castOf(ev, 5), r = big ? 15 : 6;
        P.labels.set(ev, `Hardcore (${r}-yalm circles on both tanks)`);
        const spots = big
          ? Object.assign({ MT: [-12.4, 12.4], OT: [12.4, 12.4] }, assign(NON_TANKS, clump([], [0, -7.5], 6, okAt(t), { gap: 0.7 })))
          : Object.assign({}, UP, { MT: [-4.6, 5.6], OT: [4.6, 5.6] });
        pref(begin(cs + 0.2), spots);
        hz({ t, tell: cs, effect: 'bait', shape: 'circle', from: 'target', targets: TANKS, r, dmg: 1.2, own: 0.5, buster: true, name: 'Hardcore' });
        for (const s of TANKS) call(cs, big ? 'Tank Cleave on YOU (Big): out, away from everyone' : 'Tank Cleave on YOU: out to the side', { slot: s, alert: true, dur: 5 });
        call(cs, big ? 'Big tank cleaves: away from the tanks' : 'Tank cleaves', { dur: 4 });
        end(t + 0.3);

      // ===== Vamp Stomp: the ring, the curses and the bats =====
      } else if (name === 'Vamp Stomp') {
        const bats = after(i, e => e.name === 'Blast Beat', 14).slice(0, 3);
        bats.forEach((e, k) => { runs.add(e); P.labels.set(e, `Blast Beat (${[2, 3, 5][k]} bats, ${[6, 13, 20][k]} out)`); });
        const cs = castOf(ev, 5), t0 = t + 0.1;
        const tb = [0, 1, 2].map(k => (bats[k] ? bats[k].t : t + [4.1, 7.5, 11.1][k]));
        hz({ t, tell: cs, shape: 'circle', at: [0, 0], r: 10, dmg: 1.4, name: 'Vamp Stomp' });
        // The bats' bursts: two 6 out on an axis, three 13 out (a corner north or south), five 20 out (one on a cardinal).
        const ax = pick([0, 90]), tri = pick([0, 180]), pent = pick([0, 90, 180, 270]);
        const waves = [[ax, ax + 180].map(b => at(b, 6)), [0, 120, 240].map(k => at(tri + k, 13)), [0, 72, 144, 216, 288].map(k => at(pent + k, 20))];
        // (The second and third waves are only dodged once the curses before them have gone off.)
        waves.forEach((ps, k) => ps.forEach(p => hz({ t: tb[k], tell: k ? tb[k - 1] : t, shape: 'circle', at: p, r: 8, dmg: 1.2, name: 'Blast Beat', react: k ? 1.6 : 2.6 })));
        // The ring, as it spreads (2 yalms a second).
        for (let k = 0; k < 70; k++) {
          const tau = t0 + 0.2 * k, R = 0.4 * k;
          if (R > 27) break;
          P.marks.push({ kind: 'lit', shape: 'cone', at: [0, 0], deg: 0, half: 180, r0: Math.max(0.05, R - 0.35), r: R + 0.35, t0: +tau.toFixed(2), t1: +(tau + 0.2).toFixed(2), fill: 'rgba(255,60,120,0.5)' });
        }
        // The curses, when the ring reaches each spot; then into the middle.
        const tIn = t0 + POP_IN / 2, tOut = t0 + POP_OUT / 2;
        hz({ t: tIn, tell: t + 0.2, effect: 'bait', shape: 'circle', from: 'target', targets: IN, r: 8, dmg: 0.9, own: 0.25, name: 'Blast Beat (Curse of the Bombpyre)' });
        hz({ t: tOut, tell: t + 0.2, effect: 'bait', shape: 'circle', from: 'target', targets: OUT, r: 8, dmg: 0.9, own: 0.25, name: 'Blast Beat (Curse of the Bombpyre)' });
        for (const s of S) {
          const inn = IN.includes(s);
          debuff(s, 'curseOfTheBombpyre', 'Curse of the Bombpyre', inn ? 'the ring sets it off 11 out' : 'the ring sets it off 18 out', t, inn ? tIn : tOut);
          call(cs, inn ? `Get out: your curse goes off close (${dirName(brg(BOMB[s]))}, 11 out)` : `Get out: your curse goes off far (${dirName(brg(BOMB[s]))}, 18 out)`, { slot: s, alert: true, dur: 5 });
        }
        pref(begin(cs + 0.2), BOMB);
        pref(tIn + 0.05, assign(IN, IN.map(s => MID[s])));
        pref(tOut + 0.05, assign(OUT, OUT.map(s => MID[s])));
        const names = (ps) => ps.map(p => dirName(brg(p))).join('/');
        call(t + 0.3, `Away from bats ${names(waves[0])}`, { dur: 3.5 });
        call(tb[0] + 0.3, `Away from bats ${names(waves[1])}`, { dur: 3 });
        call(tb[1] + 0.3, 'Go middle (once your curse is off)', { dur: 3 });
        end(tb[2] + 0.3);

      // ===== Brutal Rain: a party stack, hit several times =====
      } else if (/^Brutal Rain x\d/.test(name)) {
        const n = +name.match(/x(\d)/)[1], on = pick(S), step = (ev.dur || n - 1) / Math.max(1, n - 1);
        P.labels.set(ev, `Brutal Rain x${n} (party stack on ${on})`);
        pref(begin(t - 5), STACK);
        for (let k = 0; k < n; k++) hz({ t: +(t + k * step).toFixed(2), tell: k ? +(t + (k - 1) * step).toFixed(2) : t - 5.1, effect: 'share', shape: 'circle', from: 'target', targets: [on], r: 6, min: 4, max: 8, dmg: 0.12, name: 'Brutal Rain' });
        call(t - 5.1, `Stack x${n} on ${on}`, { alert: true, dur: 6 });
        end(t + (n - 1) * step + 0.3);

      // ===== Sadistic Screech: the saw phases come and go =====
      } else if (name === 'Sadistic Screech') {
        nScr++;
        hz({ t, tell: t - 5.8, raidwide: true, dmg: 0.5, name });
        call(t - 5.8, 'Big raidwide', { dur: 3 });
        if (nScr % 2 === 1) {
          // The sides are buzzsaws: into the middle strip.
          for (const sx of [1, -1]) hz({ t: t + 0.7, tell: t - 5, shape: 'rect', a: [10 * sx, -20], b: [20 * sx, 20], dmg: 1.6, name: 'Sadistic Screech (buzzsaws)' });
          P.labels.set(ev, 'Sadistic Screech (the sides go: the middle strip)');
          pref(begin(t - 5), UP);
          call(t - 5, 'Into the middle strip', { alert: true, dur: 5 });
          if (nScr === 3) gravegrazers(t, scr[3] || t + 72).forEach(h => hz(h));
        } else {
          P.labels.set(ev, 'Sadistic Screech (the whole floor back)');
          P.boss.push({ t: t + 5.3, at: [0, 0] });
          home = UP;
          pref(begin(t + 5.4), UP);
        }

      // ===== Sadistic Screech 1: the Coffinmaker's rounds =====
      } else if ((name === 'Dead Wake' || name === 'Half Moon' || name === 'Coffinfiller') && !sawsDone && t > scr[0] && t < (scr[1] || 1e9)) {
        sawsDone = true;
        const s1 = scr[0], s2 = scr[1] || t + 70, inSaw = (e) => e.t > s1 && e.t < s2;
        const dws = events.filter(e => e.name === 'Dead Wake' && inSaw(e)), hms = events.filter(e => e.name === 'Half Moon' && inSaw(e));
        events.filter(e => (e.name === 'Coffinfiller' || e.name === 'Dead Wake' || e.name === 'Half Moon') && inSaw(e)).forEach(e => runs.add(e));
        // Dead Wake: the saw takes the strip's northern 10 yalms each time; she leaps beside it for each round.
        const BOSS_AT = [[12, 0], [-12, -10], [0, -21.8]];
        dws.forEach((e, k) => {
          hz({ t: e.t, tell: castOf(e, 5), shape: 'rect', a: [-10, 10 - 10 * k], b: [10, 20 - 10 * k], dmg: 1.6, name: 'Dead Wake' });
          call(castOf(e, 5), `The saw advances: south of ${10 - 10 * k} north`, { dur: 4 });
          if (BOSS_AT[k]) P.boss.push({ t: e.t - 0.4, at: BOSS_AT[k] });
        });
        const LANE = [-7.5, -2.5, 2.5, 7.5], LNAME = ['Outer West', 'Inner West', 'Inner East', 'Outer East'];
        const northAt = (tt) => 20 - 10 * dws.filter(e => e.t <= tt).length;
        let prevEnd = null;
        for (let k = 0; k + 1 < hms.length; k += 2) {
          const h1 = hms[k], h2 = hms[k + 1], r = k / 2, Nn = northAt(h1.t);
          // Her two Half Moons split what's left: north and south of her (east of the strip, then west of it), then
          // west and east (from the south end).
          const split = r === 0 ? { dir: [0, 1], c: 0 } : r === 1 ? { dir: [0, 1], c: -10 } : { dir: [1, 0], c: 0 };
          const sideName = (sg) => (split.dir[0] ? (sg > 0 ? 'East' : 'West') : (sg > 0 ? 'North' : 'South'));
          const first = pick([1, -1]);
          const half = (sg) => ({ shape: 'half', dir: mul(split.dir, sg), off: sg * split.c });
          // Coffinfiller: two of the four lanes (one each side), then the other two.
          const pairA = [pick([0, 1]), pick([2, 3])], pairB = [0, 1, 2, 3].filter(j => !pairA.includes(j));
          const lane = (j) => ({ shape: 'line', at: [LANE[j], Nn], deg: 180, len: Nn + 22, w: 5 });
          const set1 = [half(first), ...pairA.map(lane)], set2 = [half(-first), ...pairB.map(lane)];
          set1.forEach(s => hz(Object.assign({ t: h1.t, tell: h1.t - 5, dmg: 1.4, name: s.shape === 'half' ? 'Half Moon' : 'Coffinfiller' }, s)));
          set2.forEach(s => hz(Object.assign({ t: h2.t, tell: s.shape === 'half' ? h1.t : h2.t - 5, dmg: 1.4, name: s.shape === 'half' ? 'Half Moon' : 'Coffinfiller', react: 2.6 }, s)));
          // The lane the first cleave and saws leave, then the one the second leave (as close as the pull allows).
          let l1, l2;
          if (split.dir[0]) { l1 = pairB.find(j => Math.sign(LANE[j]) === -first); l2 = pairA.find(j => Math.sign(LANE[j]) === first); }
          else {
            let best = Infinity;
            for (const a of pairB) for (const b of pairA) { const d = Math.abs(a - b) + Math.random() * 0.1; if (d < best) { best = d; l1 = a; l2 = b; } }
          }
          const y = (sg) => (split.dir[0] ? (Nn - 20) / 2 : split.c + sg * 3.4);
          const ok = okAt(h1.t);
          const sp1 = assign(S, clump(set1, [LANE[l1], y(-first)], 8, ok, { gap: 0.5, m: 1.2 }));
          const sp2 = assign(S, clump(set2, [LANE[l2], y(first)], 8, ok, { gap: 0.5, m: 1.2 }));
          pref(prevEnd === null ? begin(h1.t - 5) : prevEnd, sp1);
          pref(h1.t + 0.05, sp2);
          prevEnd = h2.t + 0.1;
          P.labels.set(h1, `Half Moon (${sideName(first).toLowerCase()} half first)`);
          P.labels.set(h2, `Half Moon (then the ${sideName(-first).toLowerCase()} half)`);
          call(h1.t - 5, `${LNAME[l1]} + ${sideName(-first)} => ${LNAME[l2]} + ${sideName(first)}`, { alert: true, dur: 8 });
        }
        // Then with her at the strip's south end till the sides come back.
        const lastEnd = prevEnd || t + 10, hug = assign(S, clump([], [0, -15.2], 8, okAt(lastEnd), { gap: 0.6 }));
        home = hug;
        end(lastEnd, hug);

      // ===== Half Moon (the open floor): her left half, then her right =====
      } else if (name === 'Half Moon') {
        const h2 = next(i, e => e.name === 'Half Moon', 5);
        if (h2) runs.add(h2);
        const t2 = h2 ? h2.t : t + 3, big = t > 500, first = pick([1, -1]), off = big ? -4 : 0, cs = castOf(ev, 5);
        const half = (sg) => ({ shape: 'half', dir: [sg, 0], off });
        hz(Object.assign({ t, tell: cs, dmg: 1.4, name: 'Half Moon' }, half(first)));
        hz(Object.assign({ t: t2, tell: t, dmg: 1.4, name: 'Half Moon', react: 2.6 }, half(-first)));
        const ok = okAt(t), side = (sg) => (sg > 0 ? 'East' : 'West');
        const sp = (sg) => assign(S, clump([half(-sg)], [sg * (big ? 6.2 : 3), 0], 8, ok, { gap: 0.55, m: 1.2 }));
        pref(begin(cs + 0.2), sp(-first));
        pref(t + 0.05, sp(first));
        P.labels.set(ev, `Half Moon (${side(first).toLowerCase()} half first${big ? ', big' : ''})`);
        if (h2) P.labels.set(h2, `Half Moon (then the ${side(-first).toLowerCase()} half)`);
        call(cs, big ? `${side(-first)} max melee => ${side(first)} max melee` : `${side(-first)} => ${side(first)}`, { alert: true, dur: 6 });
        end(t2 + 0.3);

      // ===== Pulping Pulse: puddles where people stand =====
      } else if (name === 'Pulping Pulse') {
        const n = t < 230 ? 6 : 8, cs = castOf(ev, 4), targets = n === 8 ? S.slice() : shuffle(S).slice(0, 6);
        hz({ t, tell: cs, shape: 'circle', from: 'target', targets, snap: 4, r: 5, dmg: 1.2, name: 'Pulping Pulse' });
        for (const s of targets) call(cs, 'Puddle under you: move', { slot: s, dur: 3 });

      // ===== Aetherletting =====
      } else if (name === 'Aetherletting Proteans x4') {
        const drops = after(i, e => /^Aetherletting \d$/.test(e.name), 12).slice(0, 4);
        drops.forEach(e => runs.add(e));
        // Four turns of two opposite 45-degree cones, 2 s apart, turning 45 degrees each time.
        const c0 = pick([0, 45, 90, 135]), d = pick([1, -1]), tc = [0, 1, 2, 3].map(k => t + 2 * k);
        tc.forEach((tt, k) => { for (const b of [0, 180]) hz({ t: tt, tell: tt - 4, shape: 'cone', at: [0, 0], deg: deg360(c0 + 45 * d * k + b), half: 22.5, r: 40, dmg: 1.3, name: 'Aetherletting', react: 2 }); });
        // Two drops at a time at the clock spots (never one whose spot the cones going off with it touch: the drop
        // has to sit right on it for the middle to stay clear of the crosses).
        const coneAt = (tt) => { const k = tc.findIndex(x => Math.abs(x - tt) < 0.3); return k < 0 ? null : deg360(c0 + 45 * d * k) % 180; };
        const touches = (s, tt) => { const c = coneAt(tt); return c !== null && [CLOCK_DEG[s] - 22.5, CLOCK_DEG[s] + 22.5].some(x => Math.abs(deg360(x) % 180 - c) < 1); };
        let order = shuffle(S);
        for (let tries = 0; tries < 500; tries++) {
          if (drops.every((e, k) => order.slice(2 * k, 2 * k + 2).every(s => !touches(s, e.t)))) break;
          order = shuffle(S);
        }
        let lastCross = t + 22;
        drops.forEach((e, k) => {
          const pair = order.slice(2 * k, 2 * k + 2), dur = e.dur || 14.4;
          P.labels.set(e, `Aetherletting (drops: ${pair.join(' + ')})`);
          hz({ t: e.t, tell: e.t - 5, effect: 'bait', shape: 'circle', from: 'target', targets: pair, r: 6, dmg: 0.9, own: 0.3, name: 'Aetherletting' });
          for (const s of pair) {
            hz({ t: +(e.t + dur).toFixed(2), tell: e.t, shape: 'cross', from: 'target', targets: [s], snap: dur, deg: pick([0, 45]), len: 40, w: 10, dmg: 1.4, name: 'Aetherletting (cross)' });
            call(e.t - 5, 'Aetherletting on YOU: drop it on your clock spot', { slot: s, alert: true, dur: 5 });
            pref(Math.max(e.t, tc[3]) + 0.1, { [s]: MID[s] });
          }
          lastCross = e.t + dur;
        });
        P.labels.set(ev, `Aetherletting (cones from ${dirName(c0)}, turning ${d > 0 ? 'clockwise' : 'counterclockwise'})`);
        pref(begin(t - 9), CLOCK);
        call(t - 9, `Clock spots on the edge: cones from ${dirName(c0)}, turning ${d > 0 ? 'clockwise' : 'counterclockwise'}`, { alert: true, dur: 6 });
        call(drops.length ? drops[drops.length - 1].t + 0.3 : t + 8, 'Stack middle for the crosses', { alert: true, dur: 6 });
        end(lastCross + 0.3);

      // ===== Sadistic Screech 2: towers, flails and doornails among the saws =====
      } else if (name === 'Plummet') {
        const k = plum++, set = SAWS2[k % 3], cs = castOf(ev, 7);
        const [mtT, otT, nail] = set;
        P.labels.set(ev, `Plummet (tank towers ${dirName(brg(mtT))} and ${dirName(brg(otT))}; the doornail ${dirName(brg(nail))})`);
        for (const p of [mtT, otT]) hz({ t, tell: cs, effect: 'tower', shape: 'circle', at: p, r: 3, soak: 1, dmg: 0.45, fail: 0.9, name: 'Plummet' });
        hz({ t, tell: cs, shape: 'circle', at: nail, r: 3, dmg: 1.2, name: 'Electrocution' });
        // The doornail's floor grows half a yalm a second till it's dead (about 9 s).
        const grow = (tt) => 3 + 0.5 * Math.max(0, tt - t - 1);
        for (let j = 0; j < 9; j++) hz({ t: t + 1 + j, tell: t + j, shape: 'circle', at: nail, r: grow(t + 2 + j), lasts: 1, tick: 1, tickDmg: 0.6, dmg: 0.6, name: 'Deadly Doornail (electrified floor)', react: 1.5 });
        // Its killers stand off it toward the tower on its row (clear of that tower), backing off as it grows.
        const row = [mtT, otT].find(p => Math.abs(p[1] - nail[1]) < 0.5) || [0, nail[1]], away = unit(sub(row, nail)), across = [away[1], -away[0]];
        const nailers = st.flailMelee ? ['H1', 'H2', 'R1', 'R2'] : NON_TANKS;
        const NOFF = [[0, -0.7], [0, 0.7], [0.9, -1.4], [0.9, 0], [0.9, 1.4], [0, -2.1]];
        const nailSpot = (j) => (tt) => { const dd = Math.max(4.4, grow(tt + 1) + 1.9) + NOFF[j][0]; return add(nail, add(mul(away, dd), mul(across, NOFF[j][1]))); };
        const spots = Object.assign({ MT: mtT, OT: otT }, assign(nailers, nailers.map((s, j) => nailSpot(j))));
        const toward = (p, d) => add(p, [p[0] > 0 ? -d : d, 0]);
        if (st.flailMelee) Object.assign(spots, { M1: toward(mtT, 4.6), M2: toward(otT, 4.6) });
        pref(begin(cs), spots);
        if (st.flailMelee) pref(t + 0.1, { M1: toward(mtT, 1.8), M2: toward(otT, 1.8) });
        const fl = (p) => `${Math.abs(p[1]) < 10 ? 'near' : 'far'} ${dirName(brg(p))}`;
        call(cs, `Flails ${fl(mtT)}/${fl(otT)}`, { dur: 5 });
        call(cs, `Tower ${dirName(brg(mtT))} (north one)`, { slot: 'MT', alert: true, dur: 5 });
        call(cs, `Tower ${dirName(brg(otT))} (south one)`, { slot: 'OT', alert: true, dur: 5 });
        for (const s of nailers) call(cs, 'Out of the circle: kill the doornail once it\'s up', { slot: s, dur: 5 });
        if (st.flailMelee) for (const s of ['M1', 'M2']) call(cs, `Out of the circle: then the ${s === 'M1' ? 'north' : 'south'} flail`, { slot: s, dur: 5 });
        end(t + 9.6);

      // ===== Hell in a Cell =====
      } else if (name === 'Hell in a Cell') {
        cellN++;
        const towers = after(i, e => e.name === 'Bloody Bondage', 3);
        towers.forEach(e => runs.add(e));
        const tB = towers.length ? towers[0].t : t + 1.2;
        const us = after(i, e => /^Ultrasonic/.test(e.name), 22).slice(0, 2);
        us.forEach(e => runs.add(e));
        // One light party's towers (the other four next time), 12 out; whoever takes one is in its cell till it's dead.
        const set = (cellN === 1 ? [0, 135, 225, 315] : [45, 90, 180, 270]).map(b => deg360(b + cellRot)).sort((a, b) => a - b);
        const soak = cellN === 1 ? G1 : G2, free = cellN === 1 ? G2 : G1;
        const cellOf = {};
        set.forEach((b, j) => { cellOf[soak.find(s => ROLE[s] === st.cells[j])] = b; });
        const cellAt = (s) => at(cellOf[s], 12);
        P.labels.set(ev, `Hell in a Cell (towers ${set.map(dirName).join(', ')})`);
        // The gaps between them: one wide (135 degrees), two of 90 and a narrow one.
        const gaps = set.map((b, j) => { const size = deg360(set[(j + 1) % 4] - b) || 360; return { size, mid: deg360(b + size / 2) }; });
        const wi = gaps.findIndex(g => Math.abs(g.size - 135) < 1), W = gaps[wi].mid;
        const cw = [1, 2, 3].map(j => gaps[(wi + j) % 4]).filter(g => Math.abs(g.size - 90) < 1).map(g => g.mid);
        const T = free.find(s => TANKS.includes(s)), H = free.find(s => s[0] === 'H'), D = free.filter(s => DPS.includes(s));
        const hGap = st.healerCW ? cw[0] : cw[1], dGap = st.healerCW ? cw[1] : cw[0];
        const spreadSpots = Object.assign({ [T]: at(W, 5.5), [H]: at(hGap, 6) },
          assign(D, [add(at(dGap, 5.6), at(dGap + 90, 0.7)), add(at(dGap, 5.6), at(dGap - 90, 0.7))]));
        const ampSpots = assign(free, [at(W - 8, 5.4), at(W + 8, 5.4), at(W - 3, 6.8), at(W + 3, 6.8)]);
        const cellSpots = Object.fromEntries(soak.map(s => [s, cellAt(s)]));
        for (const s of soak) {
          hz({ t: tB, tell: tB - 5, effect: 'tower', shape: 'circle', at: cellAt(s), r: 4, soak: 1, dmg: 0.3, fail: 0.9, name: 'Bloody Bondage' });
          debuff(s, 'hellInACell', 'Hell in a Cell', 'kill your cell', tB, tB + 12);
          debuff(s, 'hellAwaits', 'Hell Awaits', 'no second tower', tB, (us[1] ? us[1].t : tB + 15) + 0.5);
          for (let tt = tB + 0.6; tt < tB + 12; tt += 1.5) check({ t: +tt.toFixed(2), kind: 'spot', slots: [s], spots: { [s]: cellAt(s) }, r: 3.7, fail: 0.9, name: 'Naughty Knot (out of your cell)' });
          call(tB - 5, `Tower ${dirName(cellOf[s])}`, { slot: s, alert: true, dur: 5 });
          call(tB + 0.3, 'In a cell: kill it', { slot: s, dur: 4 });
        }
        pref(begin(tB - 5), Object.assign({}, cellSpots, ampSpots));
        // Ultrasonic Spread (cones at the free party's tank, healer and DPS) and Amp (one they share), either order.
        const types = shuffle(['Spread', 'Amp']);
        us.forEach((u, k) => {
          const tc = u.t - 5.7, kind = types[k];
          P.labels.set(u, `Ultrasonic ${kind}`);
          if (kind === 'Spread') {
            hz({ t: u.t, tell: tc, effect: 'bait', shape: 'cone', from: 'boss', aim: 'target', targets: [T], half: 50, r: 40, dmg: 1.2, own: 0.5, buster: true, name: 'Ultrasonic Spread' });
            hz({ t: u.t, tell: tc, effect: 'bait', shape: 'cone', from: 'boss', aim: 'target', targets: [H], half: 22.5, r: 40, dmg: 0.9, own: 0.3, name: 'Ultrasonic Spread' });
            hz({ t: u.t, tell: tc, effect: 'share', shape: 'cone', from: 'boss', aim: 'target', targets: [pick(D)], half: 22.5, r: 40, min: 1, max: 2, dmg: 0.3, name: 'Ultrasonic Spread' });
          } else hz({ t: u.t, tell: tc, effect: 'share', shape: 'cone', from: 'boss', aim: 'target', targets: [pick(free)], half: 50, r: 40, min: 4, max: 4, dmg: 0.25, name: 'Ultrasonic Amp' });
          pref(k ? us[0].t + 0.05 : tc + 0.3, kind === 'Spread' ? spreadSpots : ampSpots);
          call(tc, kind === 'Spread' ? `Role positions: tank ${dirName(W)}, healer ${dirName(hGap)}, DPS ${dirName(dGap)}` : `Light party stack ${dirName(W)}`, { alert: true, dur: 5 });
          for (const s of soak) call(tc, `Avoid ${kind === 'Spread' ? 'the role cones' : 'the stack'}`, { slot: s, dur: 4 });
        });
        end((us[1] ? us[1].t : tB + 15) + 0.3);

      // ===== Undead Deathmatch: towers, bats, claws =====
      } else if (name === 'Undead Deathmatch') {
        const tw = next(i, e => e.name === 'Bloody Bondage', 3);
        if (tw) runs.add(tw);
        const tU = tw ? tw.t : t + 1.2;
        const steps = events.filter(e => /^Sanguine Scratch \d$/.test(e.name) && e.t > t && e.t < t + 40);
        const shapes = events.filter(e => (e.name === 'Breakdown Drop' || e.name === 'Breakwing Beat') && e.t > t && e.t < t + 42);
        steps.concat(shapes).forEach(e => runs.add(e));
        const sT = [...new Set(shapes.map(e => e.t))].sort((a, b) => a - b);
        while (sT.length < 2) sT.push((sT[sT.length - 1] || t + 20) + 18);
        const rounds = [steps.filter(e => e.t < sT[0]), steps.filter(e => e.t > sT[0] && e.t < sT[1])];
        // Two four-player towers: G1's north (or west), G2's across; each one's bat starts there.
        const ns = Math.random() < 0.5, A0 = { G1: ns ? 0 : 270, G2: ns ? 180 : 90 };
        const grp = (s) => (G1.includes(s) ? 'G1' : 'G2');
        for (const g of ['G1', 'G2']) hz({ t: tU, tell: tU - 5, effect: 'tower', shape: 'circle', at: at(A0[g], 12), r: 6, soak: [4, 4], dmg: 0.3, fail: 0.9, name: 'Bloody Bondage' });
        pref(begin(tU - 5), Object.assign(assign(G1, clump([], at(A0.G1, 12), 4, okAt(tU), { gap: 0.8 })), assign(G2, clump([], at(A0.G2, 12), 4, okAt(tU), { gap: 0.8 }))));
        call(tU - 5, `Towers: G1 ${ns ? 'north' : 'west'}, G2 ${ns ? 'south' : 'east'}`, { alert: true, dur: 5 });
        // The bats fly half way round, 12 out, each pull's way round each time, the two always opposite.
        const ways = [pick([1, -1]), pick([1, -1])], legs = [[tU + 1.5, sT[0] - 2.4], [sT[0] + 1, sT[1] - 2.4]];
        const batBrg = (g, tt) => legs.reduce((b, [a, z], k) => b + 180 * ways[k] * Math.max(0, Math.min(1, (tt - a) / (z - a))), A0[g]);
        const batAt = (g, tt) => at(batBrg(g, tt), 12);
        const OFF = { MT: [0, 0], H1: [1.2, 0.7], M1: [-1.2, 0.7], R1: [0, 1.5], OT: [0, 0], H2: [1.2, 0.7], M2: [-1.2, 0.7], R2: [0, 1.5] };
        const follow = (s) => (tt) => { const b = batBrg(grp(s), tt), o = OFF[s]; return add(at(b, 10 - o[1]), at(b + 90, o[0])); };
        pref(tU + 0.05, all(follow));
        // The tethers (stretched past 12 they hurt), and the bats themselves.
        for (let tt = tU + 0.5; tt <= sT[1] + 0.01; tt += 0.5) {
          for (const s of S) hz({ t: +tt.toFixed(2), tell: +(tt - 0.5).toFixed(2), targets: [s], tether: batAt(grp(s), tt), within: 12, dmg: 0, fail: 0.9, quiet: true, name: 'Bat tether (stretched too far)' });
        }
        for (let tt = tU; tt <= sT[1]; tt += 0.25) for (const g of ['G1', 'G2']) P.marks.push({ kind: 'lit', shape: 'circle', at: batAt(g, tt), r: 1.1, t0: +tt.toFixed(2), t1: +(tt + 0.25).toFixed(2), fill: 'rgba(190,90,255,0.65)' });
        // Sanguine Scratch: eight 30-degree claws round her, the next set between the last.
        rounds.forEach((rd) => {
          const base = pick([0, 22.5]);
          rd.forEach((e, k) => cones(e.t, k ? rd[k - 1].t : e.t - 3, base + 22.5 * k, 8, 15, 'Sanguine Scratch', 2.2));
        });
        // The bats burst where they end up: a circle (out of it, toward her and to one side, the tether still in reach) and
        // a donut (under it).
        sT.forEach((ts, k) => {
          const cG = pick(['G1', 'G2']), dG = cG === 'G1' ? 'G2' : 'G1', pc = batAt(cG, ts), pd = batAt(dG, ts);
          const cHz = { shape: 'circle', at: pc, r: 7 }, dHz = { shape: 'donut', at: pd, r0: 4, r1: 15 };
          hz(Object.assign({ t: ts, tell: ts - 6, dmg: 1.4, name: 'Breakdown Drop' }, cHz));
          hz(Object.assign({ t: ts, tell: ts - 6, dmg: 1.4, name: 'Breakwing Beat' }, dHz));
          const u = unit(mul(pc, -1)), v = [u[1], -u[0]], a50 = 50 * Math.PI / 180;
          const want = add(pc, add(mul(u, 9.3 * Math.cos(a50)), mul(v, 9.3 * Math.sin(a50))));
          const cGrp = cG === 'G1' ? G1 : G2, dGrp = dG === 'G1' ? G1 : G2, ok = okAt(ts);
          const spots = Object.assign(assign(cGrp, clump([cHz, dHz], want, 4, (p) => ok(p) && dist(p, pc) < 11.3, { gap: 0.6 })),
            assign(dGrp, clump([cHz, dHz], pd, 4, (p) => ok(p) && dist(p, pd) < 11.3, { gap: 0.6 })));
          const last = rounds[k][rounds[k].length - 1], tGo = (last ? last.t : ts - 2.4) + 0.05;
          pref(tGo, spots);
          if (k === 0) pref(ts + 0.05, all(follow));
          for (const s of cGrp) call(tGo - 2, 'Circle on your bat: out of it, toward the boss', { slot: s, alert: true, dur: 4 });
          for (const s of dGrp) call(tGo - 2, 'Donut on your bat: under it', { slot: s, alert: true, dur: 4 });
          call(k ? ts + 0.3 : tU + 0.5, k ? 'Free again' : `Follow your bat ${ways[0] > 0 ? 'clockwise' : 'counterclockwise'}; dodge the claws`, { dur: 5 });
          if (k === 0) call(ts + 0.5, `Follow your bat ${ways[1] > 0 ? 'clockwise' : 'counterclockwise'} again`, { dur: 5 });
        });
        P.labels.set(ev, `Undead Deathmatch (towers ${ns ? 'north and south' : 'west and east'})`);
        end(sT[1] + 0.3);

      // ===== Sanguine Scratch (the last, without bats) =====
      } else if (name === 'Sanguine Scratch 1') {
        const steps = [ev].concat(after(i, e => /^Sanguine Scratch [2-9]$/.test(e.name), 12));
        steps.forEach(e => runs.add(e));
        const base = pick([0, 22.5]);
        steps.forEach((e, k) => cones(e.t, k ? steps[k - 1].t : e.t - 3, base + 22.5 * k, 8, 15, 'Sanguine Scratch', 2.2));
        pref(begin(t - 3), UP);
        call(t - 3, 'Dodge the alternating claws', { alert: true, dur: 5 });
        end(steps[steps.length - 1].t + 0.3);
      }
    });

    P.boss.sort((a, b) => a.t - b.t);
    return P;
  }

  B.FIGHT_SCRIPTS = B.FIGHT_SCRIPTS || {};
  B.FIGHT_SCRIPTS.m9s = {
    // FFLogs' max HP in an M9S kill: Vamp Fatale 110,594,239. Her adds take the party's damage while they're up: the
    // Fatal Flails (431,207 each) and Deadly Doornail (964,096) of each Sadistic Screech 2 set, and each Hell in a Cell's
    // Charnel Cells (tank 210,896, healer 131,810, DPS 280,567 each; their prisoners' damage only). (The Coffinmaker,
    // 10,260,467, is fought while she can't be targeted, which the sim's party doesn't do.)
    hp: 110594239,
    adds: [
      { from: 295.5, to: 307.5, hp: 1826510, share: 0.9, name: 'Fatal Flails and Deadly Doornail' },
      { from: 313.6, to: 325.6, hp: 1826510, share: 0.9, name: 'Fatal Flails and Deadly Doornail' },
      { from: 331.7, to: 343.7, hp: 1826510, share: 0.9, name: 'Fatal Flails and Deadly Doornail' },
      { from: 400.0, to: 412.0, hp: 903840, share: 0.5, name: 'Charnel Cells' },
      { from: 422.3, to: 434.3, hp: 903840, share: 0.5, name: 'Charnel Cells' },
    ],
    pushes: [],
    defaultStrat: 'toxic',
    strats: {
      toxic: { label: 'Toxic/Hector (NA / EU / OCE)' },
      game8: { label: 'Game8/ぬけまる (English) (JP)' },
      game8jp: { label: 'Game8/ぬけまる (日本語) (JP)' },
    },
    source: 'wtfdig.info/74/m9s; mechanics after BossMod (github.com/awgil/ffxiv_bossmod) and FFLogs kills',
    // Toxic's: A north, B east, C south, D west; 1-4 the intercards (1 north-west, then clockwise).
    waymarks: [
      { label: 'A', at: [0, 13], color: 'red' }, { label: 'B', at: [13, 0], color: 'yellow' },
      { label: 'C', at: [0, -13], color: 'blue' }, { label: 'D', at: [-13, 0], color: 'purple' },
      { label: '1', at: [-9.2, 9.2], color: 'red', square: true }, { label: '2', at: [9.2, 9.2], color: 'yellow', square: true },
      { label: '3', at: [9.2, -9.2], color: 'blue', square: true }, { label: '4', at: [-9.2, -9.2], color: 'purple', square: true },
    ],
    plan,
  };
})(window.BLM);
