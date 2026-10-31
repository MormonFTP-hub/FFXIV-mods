// M5S, AAC Cruiserweight M1 (Savage): Dancing Green's mechanics for the sim's party, on cactbot's timeline, and the
// strats wtfdig.info lists for them: Hector's (its default, the one NA and EU party finders run), Game8/Nukemaru
// (JP), MR (OCE), Latte and Toxic Friends. Each strat gives the eight spots (MT OT H1 H2 M1 M2 R1 R2) a place for
// each mechanic; the bots stand there, and so should you. Spots are [east, north] yalms from the arena's middle.
//
// The mechanics follow BossMod's module for the fight (github.com/awgil/ffxiv_bossmod, RM05SDancingGreen), whose
// shapes and sizes come from the game's own Action sheet:
//   - Deep Cut: a 60-degree cone at each tank.
//   - #-snap Twist & Drop the Needle: the boss and his helpers hit one half of the room 2, 3 or 4 times in quick
//     succession, then Drop the Needle hits the other half; Play A-side then fires a 45-degree cone at everyone (be
//     in no other role's), Play B-side two 8-wide line stacks at the healers (be in exactly one).
//   - Funky Floor: the checkerboard, its tiles flipping every 4.1 s; Burn Baby Burn: stand in a spotlight when it
//     runs out; Inside Out / Outside In: a 7-yalm circle and a donut from 5, 2.5 s apart.
//   - Arcady Night Fever: a circle and a donut in turn every 2.5 s, and with each a 45-degree protean at one player
//     (supports and DPS taking turns), repeated in the same place 2.5 s later.
//   - Let's Dance: half the room, eight times, in the order the frogs showed; Wavelength: pairs merge (within 2
//     yalms) as their timers run out.
//   - Ride the Waves: rows of tiles flowing north to south, their safe columns zig-zagging; Quarter Beats: 4-yalm
//     partner stacks; Eighth Beats: 5-yalm spreads.
//   - Frogtourage: Moonburn's 15-yalm bands of tiles; Do the Hustle's half-room cleaves.
// Where everyone stands was checked against 25 NA kills from FFLogs (tools/fflogs_m5s.py): the spots below are the
// medians of where each party spot really stood at each mechanic, for Hector's strat (the others from wtfdig's text).
// Simplified: the frogs' Back-up Dance baits aren't aimed (the baiters just stand where the logs put them).
(function (B) {
  const S = B.SLOTS;
  const all = (f) => Object.fromEntries(S.map(s => [s, f(s)]));
  const at = B.bearing;
  const mid = (a, b) => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
  const G1 = ['MT', 'H1', 'M1', 'R1'], G2 = ['OT', 'H2', 'M2', 'R2'];
  const SUPPORT = ['MT', 'OT', 'H1', 'H2'], DPS = ['M1', 'M2', 'R1', 'R2'];
  const DIR = { N: [0, 1], E: [1, 0], S: [0, -1], W: [-1, 0] };
  const DEG = { N: 0, E: 90, S: 180, W: 270 };
  const NAME = { N: 'North', E: 'East', S: 'South', W: 'West' };
  const pick = (a) => a[Math.floor(Math.random() * a.length)];
  const shuffle = (a) => { const b = a.slice(); for (let i = b.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [b[i], b[j]] = [b[j], b[i]]; } return b; };
  // A tile: column i (0 west to 7 east), row j (0 south to 7 north), as the mechanics' tile shapes number them.
  const tile = (i, j) => i + 8 * j;
  const tilesWhere = (f) => { const set = new Set(); for (let i = 0; i < 8; i++) for (let j = 0; j < 8; j++) if (f(i, j)) set.add(tile(i, j)); return set; };

  // Everyone's spot outside mechanics, as the logs have it: tanks at the boss's front (he faces north), and the whole
  // party, ranged and healers too, clumped at his back within five yalms of his middle.
  const UP = { MT: [-1.5, 6.3], OT: [3, 4.6], M1: [-2.8, -4.2], M2: [1.2, -5.4], R1: [-0.8, -5.6], R2: [2.6, -4.8], H1: [-1.5, -3.5], H2: [1.5, -3.8] };
  // Clumped on the boss, to dodge half-room cleaves that come quickly (a step across his middle each time).
  const CLUMP = { MT: [0, 2.5], OT: [1, 2.5], M1: [-1.5, -1.5], M2: [1.5, -1.5], R1: [-2, 0], R2: [2, 0], H1: [-1, -2.5], H2: [1, -2.5] };

  // ---------- each strat's spots ----------
  // #-snap Twist: where each spot plays A-side (role cones) or B-side (line stacks at the healers), on the half the
  // snaps hit (s: +1 east, -1 west; Drop the Needle has just hit the other); `wait`, where it stands through the snaps.
  function twist(strat, ab, s, first) {
    const x = 2.5 * s, xw = 2.5 * first;
    if (strat === 'game8' || strat === 'mr') {
      // Static spots round the boss for both sides, taken once the needle drops; wait at the boss's side meanwhile.
      const deg = strat === 'game8'
        ? { MT: 315, OT: 225, H1: 0, H2: 180, M1: 135, M2: 135, R1: 45, R2: 45 }
        : { MT: 0, OT: 0, H1: 315, H2: 135, M1: 180, M2: 180, R1: 180, R2: 180 };
      const spots = all(k => at(deg[k], 4.5));
      return { spots, wait: all(k => [xw, Math.sign(spots[k][1] || 1) * 3.5]), cross: all(k => [x, Math.sign(spots[k][1] || 1) * 3.5]), static: true };
    }
    // On the side, hugging the middle line (a yalm or two out), as the logs have it.
    if (ab === 'A') {                 // tanks north, healers at the boss's side, DPS south
      const lay = (e) => ({ MT: [e, 6], OT: [e, 6], H1: [e * 2.2, 0], H2: [e * 2.2, 0], M1: [e, -6], M2: [e, -6], R1: [e, -6], R2: [e, -6] });
      return { spots: lay(Math.sign(x)), wait: lay(Math.sign(xw)) };
    }
    const lay = (e) => all(k => (G1.includes(k) ? [e, 5.5] : [e, -5.5]));      // G1 north, G2 south (with H1 and H2)
    return { spots: lay(Math.sign(x)), wait: lay(Math.sign(xw)) };
  }

  // Disco Infernal 1: the spotlights (four on inner tiles in a pinwheel, either way round, and the four corners), each
  // spot's half of the floor and the spotlight it cleanses in (supports first, then DPS). In the logs the tanks and
  // melee take the inner ones on their half, the healers and ranged the corners.
  function lights1(cw) {
    const inner = cw ? [[-2.5, 7.5], [7.5, 2.5], [2.5, -7.5], [-7.5, -2.5]] : [[2.5, 7.5], [7.5, -2.5], [-2.5, -7.5], [-7.5, 2.5]];
    return inner.concat([[-12.5, 12.5], [12.5, 12.5], [12.5, -12.5], [-12.5, -12.5]]);
  }
  function disco1(strat, cw) {
    const L = lights1(cw), inner = L.slice(0, 4);
    const pickIn = (test) => inner.filter(test).sort((a, b) => b[1] - a[1]);     // north first
    if (strat === 'latte') {          // G1 north, G2 south
      const n = pickIn(p => p[1] > 0), s = pickIn(p => p[1] < 0);
      return { zone: { MT: [-2.5, 2.5], M1: [2.5, 2.5], H1: [-2.5, 7.5], R1: [2.5, 7.5], OT: [2.5, -2.5], M2: [-2.5, -2.5], H2: [-2.5, -7.5], R2: [2.5, -7.5] },
        lights: { MT: n[0], M1: n[1], H1: [-12.5, 12.5], R1: [12.5, 12.5], OT: s[0], M2: s[1], H2: [-12.5, -12.5], R2: [12.5, -12.5] }, all: L };
    }
    // G1 west, G2 east; tanks and melee close to the boss, healers and ranged far (Toxic: melee north/west, south/east)
    const w = pickIn(p => p[0] < 0), e = pickIn(p => p[0] > 0);
    return { zone: { MT: [-2.5, 2.5], M1: [-2.5, -2.5], H1: [-7.5, 2.5], R1: [-7.5, -2.5], OT: [2.5, 2.5], M2: [2.5, -2.5], H2: [7.5, 2.5], R2: [7.5, -2.5] },
      lights: { MT: w[0], M1: w[1], H1: [-12.5, 12.5], R1: [-12.5, -12.5], OT: e[0], M2: e[1], H2: [12.5, -12.5], R2: [12.5, 12.5] }, all: L };
  }

  // Arcady Night Fever: each spot's protean slice (its bearing; the slices are 45 degrees, one per player).
  const PROTEAN = {
    hector: { MT: 337.5, OT: 22.5, H1: 292.5, H2: 67.5, M1: 202.5, M2: 157.5, R1: 247.5, R2: 112.5 },
    latte: { MT: 22.5, OT: 337.5, H1: 67.5, H2: 292.5, M1: 202.5, M2: 157.5, R1: 247.5, R2: 112.5 },
    toxic: { MT: 337.5, OT: 202.5, H1: 292.5, H2: 247.5, M1: 112.5, M2: 157.5, R1: 22.5, R2: 67.5 },
  };

  // Ride the Waves: each spot's place in a lane, a row of its own (far north, near north, near south, far south: rows
  // ten yalms apart, so the 5-yalm spreads fit and partners meet in the row between); the snake of safe columns
  // moves everyone sideways. Pairs: Quarter Beats' partner stacks.
  const ROW = { farN: 12, nearN: 3.75, nearS: -3.75, farS: -11 };
  const lane = (e, rows) => Object.fromEntries(Object.entries(rows).map(([s, r]) => [s, [e, ROW[r]]]));
  function waves(strat) {
    if (strat === 'game8') {          // G1 west, G2 east; melee north, ranged south
      return { spots: Object.assign(lane(-12.5, { MT: 'farN', M1: 'nearN', H1: 'nearS', R1: 'farS' }), lane(2.5, { OT: 'farN', M2: 'nearN', H2: 'nearS', R2: 'farS' })),
        pairs: [['MT', 'M1'], ['H1', 'R1'], ['OT', 'M2'], ['H2', 'R2']] };
    }
    if (strat === 'mr') {             // melee in the lane nearer the boss, ranged in the far one; G1 north, G2 south
      return { spots: Object.assign(lane(2.5, { MT: 'farN', M1: 'nearN', OT: 'farS', M2: 'nearS' }), lane(-12.5, { H1: 'farN', R1: 'nearN', H2: 'farS', R2: 'nearS' })),
        pairs: [['MT', 'M1'], ['H1', 'R1'], ['OT', 'M2'], ['H2', 'R2']] };
    }
    // Hector, Latte, Toxic: G1 west, G2 east; tanks north close, ranged north far, melee south close, healers south far
    return { spots: Object.assign(lane(-7.5, { MT: 'nearN', R1: 'farN', M1: 'nearS', H1: 'farS' }), lane(2.5, { OT: 'nearN', R2: 'farN', M2: 'nearS', H2: 'farS' })),
      pairs: [['MT', 'R1'], ['OT', 'R2'], ['H1', 'M1'], ['H2', 'M2']], meet: 'near' };
  }
  // The rows' safe columns, a snake: two lanes (columns 1 and 4, 2 and 5, or 3 and 6), each step through a row wide
  // enough for both.
  const LANES = { 1: [1, 4], 12: [1, 2, 4, 5], 2: [2, 5], 23: [2, 3, 5, 6], 3: [3, 6] };
  function snake(n) {
    let s = pick([1, 3]), dir = s === 1 ? 1 : -1;
    const rows = [];
    while (rows.length < n) {
      rows.push(LANES[s]);
      const to = s + dir;
      rows.push(LANES[Math.min(s, to) * 10 + Math.max(s, to)]);
      s = to;
      if (s === 1 || s === 3) dir = -dir;
    }
    return rows.slice(0, n);
  }

  // Frogtourage 1: Moonburn's bands leave a corridor north and south ('NS') or east and west ('EW'); G1 takes
  // north (or west), G2 south (or east), supports on the left facing the boss.
  function frog1(strat, axis) {
    const rot = (p) => (axis === 'NS' ? p : [-p[1], p[0]]);
    if (strat === 'mr') {             // the safe spot nearest each intercard: melee close, ranged far
      const spot = (sx, sy, d) => (axis === 'NS' ? [sx * 3, sy * d] : [sx * d, sy * 3]);
      return { spots: { MT: spot(-1, 1, 9), R1: spot(-1, 1, 17), OT: spot(1, 1, 9), R2: spot(1, 1, 17), M1: spot(-1, -1, 9), H1: spot(-1, -1, 17), M2: spot(1, -1, 9), H2: spot(1, -1, 17) },
        pairs: [['MT', 'R1'], ['OT', 'R2'], ['H1', 'M1'], ['H2', 'M2']] };
    }
    const base = strat === 'latte'
      ? { MT: [4, 11], M1: [-4, 11], H1: [-4, 18.5], R1: [4, 18.5], OT: [4, -11], M2: [-4, -11], H2: [-4, -18.5], R2: [4, -18.5] }
      : { MT: [4, 11], H1: [4, 18.5], M1: [-4, 11], R1: [-4, 18.5], OT: [-4, -11], H2: [-4, -18.5], M2: [4, -11], R2: [4, -18.5] };
    return { spots: all(k => rot(base[k])), pairs: [['MT', 'M1'], ['H1', 'R1'], ['OT', 'M2'], ['H2', 'R2']] };
  }
  // Moonburn's bands: three tiles wide, a whole column or row of them.
  const band = (cols, i0) => tilesWhere((i, j) => (cols ? i : j) >= i0 && (cols ? i : j) < i0 + 3);

  // Disco Infernal 2: colour partners, a support and a DPS by each waymark colour. The DPS's debuffs are the short
  // ones: they cleanse first, in the spotlight out at the edge, while their support baits a frog at the intercard;
  // then they swap. (Spots: the logs' medians.)
  // Each colour's spotlight is out at its cardinal or the corner beside it (red N or NW, yellow E or NE, blue S or SE,
  // purple W or SW), all one way or the other each pull.
  const colorSpots = (corner) => (corner
    ? { red: [-14.5, 14.5], yellow: [14.5, 14.5], blue: [14.5, -14.5], purple: [-14.5, -14.5] }
    : { red: [0, 14.5], yellow: [14.5, 0], blue: [0, -14.5], purple: [-14.5, 0] });
  const COLOR_BAIT = { red: [-5.5, 6], yellow: [6, 5.5], blue: [6, -6], purple: [-6, -5.5] };
  function disco2(strat) {
    if (strat === 'hector' || strat === 'mr') return { red: ['MT', 'R1'], yellow: ['OT', 'R2'], purple: ['H1', 'M1'], blue: ['H2', 'M2'] };
    return { red: ['MT', 'R1'], blue: ['OT', 'M2'], purple: ['H1', 'M1'], yellow: ['H2', 'R2'] };
  }

  // Frogtourage 2's baits (More Amphibians): each pair's bearing; supports bait first.
  function amphibians(strat) {
    if (strat === 'game8' || strat === 'mr') return [['MT', 'R1', 315], ['OT', 'R2', 45], ['H1', 'M1', 225], ['H2', 'M2', 135]];
    if (strat === 'latte') return [['MT', 'R1', 305], ['OT', 'M2', 125], ['H1', 'M1', 235], ['H2', 'R2', 55]];
    return [['MT', 'R1', 305], ['OT', 'R2', 55], ['H1', 'M1', 235], ['H2', 'M2', 125]];
  }

  // Funky Floor 2: partners share a bearing, melee (and tanks) close, ranged (and healers) far.
  function funky2(strat) {
    const pairs = strat === 'game8' || strat === 'latte' ? [['MT', 'R1', 0], ['H2', 'R2', 90], ['OT', 'M2', 180], ['H1', 'M1', 270]]
      : strat === 'toxic' ? [['MT', 'M1', 0], ['H2', 'R2', 90], ['OT', 'M2', 180], ['H1', 'R1', 270]]
        : [['MT', 'R1', 0], ['OT', 'R2', 90], ['H2', 'M2', 180], ['H1', 'M1', 270]];
    const close = (s) => B.SLOT_ROLE[s] === 'tank' || B.SLOT_ROLE[s] === 'melee';
    const spots = {};
    for (const [a, b, d] of pairs) {
      // Partners of the same reach (a healer with a ranged): the first in, the second out.
      const inA = close(a) || !close(b);
      spots[a] = at(d, inA ? 6.5 : 13);
      spots[b] = at(d, inA ? 13 : 6.5);
    }
    return { spots, pairs: pairs.map(p => p.slice(0, 2)) };
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
    const castOf = (ev, d) => ev.t - (ev.cast || d || 5);
    const next = (i, test, within) => { for (let k = i + 1; k < events.length && events[k].t - events[i].t <= within; k++) if (test(events[k])) return events[k]; return null; };

    let ab = null, lastFlip = null, lastQE = null, discos = 0, frogs = 0, phase = null, wavePlan = null, frogPlan = null, disco1Zone = null;
    const runs = new Set();
    const qeSpots = () => (phase === 'waves' ? wavePlan : phase === 'frog1' ? frogPlan : phase === 'funky2' ? funky2(strat) : null);
    // Where everyone goes back to after a mechanic inside a phase.
    const phaseSpots = (t) => (phase === 'disco1' && t < 120 ? disco1Zone : phase === 'waves' && t < 265 ? wavePlan.spots
      : phase === 'funky2' && t < 553 ? funky2(strat).spots : UP);
    const partnerCalls = (t, pairs) => {
      for (const [a, b] of pairs) { call(t, `Stack with ${b}`, { slot: a }); call(t, `Stack with ${a}`, { slot: b }); }
    };

    events.forEach((ev, i) => {
      const name = ev.name, t = ev.t;
      if (runs.has(ev)) return;
      if (name === 'Deep Cut') {
        pref(t - 5.6, { MT: [-2.4, 6.4], OT: [3.3, 5.6] });      // the logs' spots: about 55 degrees apart
        pref(t + 0.6, { MT: UP.MT, OT: UP.OT });
        hz({ t, tell: t - 5, shape: 'tankcones', aimed: true, slots: ['MT', 'OT'], half: 30, r: 60, dmg: 1.5, buster: 0.75, name });
        call(t - 5.6, 'Tank cleaves: stay out of the tanks\' cones');
        for (const s of ['MT', 'OT']) call(t - 5.6, 'Tank cleave on YOU: face it away from the party', { slot: s, alert: true });
      } else if (name.startsWith('Flip to')) {
        ab = lastFlip && t - lastFlip.t < 30 ? (lastFlip.ab === 'A' ? 'B' : 'A') : pick(['A', 'B']);
        lastFlip = { t, ab };
        P.labels.set(ev, `Flip to ${ab}-side`);
        call(castOf(ev, 4), ab === 'A' ? '(Role positions later)' : '(Light parties later)', { dur: 4 });
      } else if (name.includes('snap Twist')) {
        // The boss and his helpers hit one half (`hit`) n times quickly; Drop the Needle then hits the other half
        // (`first`, where you waited), so you cross over and play the side from there.
        const n = pick([2, 3, 4]), first = pick([-1, 1]), hit = -first, side = ab || 'B';
        P.labels.set(ev, `${n}-snap Twist & Drop the Needle`);
        const needle = next(i, e => e.name === 'Drop the Needle', 6), play = next(i, e => e.name.startsWith('Play '), 9);
        const last = needle ? needle.t : t + 3.5, cs = castOf(ev, 5);
        const quick = { 2: [0, 1.5], 3: [0, 1.2, 1.9], 4: [0, 1, 1.5, 2] }[n];
        quick.forEach((d) => hz({ t: t + d, tell: cs + 0.5, shape: 'half', dir: [hit, 0], dmg: 1.4, name: `${n}-snap Twist`, react: 3 }));
        hz({ t: last, tell: t + quick[quick.length - 1], shape: 'half', dir: [first, 0], dmg: 1.4, name: 'Drop the Needle', react: 2 });
        const tw = twist(strat, side, hit, first);
        pref(cs, tw.wait);
        pref(t + quick[quick.length - 1] + 0.05, tw.static ? tw.cross : tw.spots);
        if (tw.static) pref(last + 0.05, tw.spots);
        const sideName = (s) => (s < 0 ? 'West' : 'East');
        call(cs, `${sideName(first)} first (${n} hits), then ${sideName(hit)} => ${side === 'A' ? 'Role positions' : 'Light parties'}`, { alert: true, dur: 7 });
        if (play) {
          P.labels.set(play, `Play ${side}-side`);
          if (side === 'A') check({ t: play.t, kind: 'rolecones', half: 22.5, dmg: 0.25, fail: 0.7, name: 'Play A-side' });
          else check({ t: play.t, kind: 'lines', healers: ['H1', 'H2'], width: 4, dmg: 0.3, fail: 1.1, name: 'Play B-side' });
          pref(play.t + 0.6, UP);
        }
        ab = null;
      } else if (name === 'Celebrate Good Times' || name === "Let's Pose!") {
        hz({ t, tell: castOf(ev, 5), raidwide: true, dmg: name === "Let's Pose!" ? 0.45 : 0.5, name });
        call(castOf(ev, 5), 'Raidwide', { dur: 3 });
      } else if (name === 'Disco Infernal') {
        discos++;
        hz({ t, tell: castOf(ev, 4), raidwide: true, dmg: 0.35, name });
        if (discos === 1) {
          phase = 'disco1';
          const d = disco1(strat, Math.random() < 0.5);
          disco1Zone = d.zone;
          pref(t, d.zone);
          P.marks.push(...d.all.map(p => ({ kind: 'spotlight', at: p, r: 2.5, t0: t, t1: t + 33 })));
          for (const s of S) {
            const ex = t + (SUPPORT.includes(s) ? 23.5 : 31.5);
            pref(ex - 4.5, { [s]: d.lights[s] });
            pref(ex + 0.4, { [s]: d.zone[s] });
            check({ t: ex, kind: 'spotlight', slots: [s], lights: d.all, r: 2.5, fail: 0.9, name: 'Burn Baby Burn' });
            P.debuffs.push({ slot: s, name: 'Burn Baby Burn', hint: 'be in a spotlight when it ends', t0: t, t1: ex });
            call(ex - 5, 'Cleanse in a spotlight', { slot: s, alert: true, dur: 5 });
          }
        } else {
          const COLOR_SPOT = colorSpots(Math.random() < 0.5), cols = disco2(strat), lights = Object.values(COLOR_SPOT);
          P.marks.push(...lights.map(p => ({ kind: 'spotlight', at: p, r: 2.5, t0: t, t1: t + 21 })));
          for (const [c, [sup, dps]] of Object.entries(cols)) {
            const spot = COLOR_SPOT[c], bait = COLOR_BAIT[c];
            pref(t, { [dps]: spot, [sup]: bait });
            pref(t + 15, { [dps]: bait, [sup]: spot });
            [[dps, t + 9.5], [sup, t + 19.5]].forEach(([s, ex]) => {
              check({ t: ex, kind: 'spotlight', slots: [s], lights, r: 2.5, fail: 0.9, name: 'Burn Baby Burn' });
              P.debuffs.push({ slot: s, name: 'Burn Baby Burn', hint: 'be in a spotlight when it ends', t0: t, t1: ex });
              call(ex - 5, `Cleanse in the ${c} spotlight`, { slot: s, alert: true, dur: 5 });
            });
            call(t, `Bait the frog by ${c}, then cleanse`, { slot: sup, dur: 5 });
          }
          pref(t + 25.5, UP);
        }
      } else if (name === 'Funky Floor') {
        const run = [ev];
        for (let k = i + 1; k < events.length; k++) {
          if (events[k].name === 'Funky Floor' && events[k].t - run[run.length - 1].t < 4.6) { run.push(events[k]); runs.add(events[k]); } else if (events[k].t - run[run.length - 1].t > 4.6) break;
        }
        const p0 = pick([0, 1]);
        if (t > 500) { phase = 'funky2'; pref(t - 4, funky2(strat).spots); }
        run.forEach((e, k) => hz({ t: e.t, tell: k ? run[k - 1].t : e.t - 3.1, shape: 'tiles', parity: (p0 + k) % 2, dmg: 1.3, name, react: 1.6 }));
        call(t - 3.1, 'Funky Floor: step onto a safe tile before each flash', { dur: 5 });
        const end = run[run.length - 1].t;
        if (t > 500) pref(end + 0.5, UP);
      } else if (name === 'Inside Out/Outside In') {
        const second = next(i, e => e.name === name, 3.5);
        const io = pick(['Inside Out', 'Outside In']);
        const out = { shape: 'circle', at: [0, 0], r: 7 }, under = { shape: 'donut', at: [0, 0], r0: 5 };
        const first = io === 'Inside Out' ? out : under, then = io === 'Inside Out' ? under : out;
        P.labels.set(ev, io);
        hz(Object.assign({ t, tell: castOf(ev, 5), dmg: 1.3, name: io }, first));
        // Everyone gathers round the boss as the cast starts, each on their own side of him: at max melee for the
        // circle, under him for the donut, then the other.
        const ring = (r) => all(s => { const p = UP[s], l = Math.hypot(p[0], p[1]); return [p[0] / l * r, p[1] / l * r]; });
        const outR = 8.3, inR = 2.5;
        pref(castOf(ev, 5), ring(io === 'Inside Out' ? outR : inR));
        if (second) {
          runs.add(second);
          P.labels.set(second, io);
          hz(Object.assign({ t: second.t, tell: t, dmg: 1.3, name: io, react: 2.5 }, then));
          pref(t + 0.05, ring(io === 'Inside Out' ? inR : outR));
          pref(second.t + 0.3, phaseSpots(second.t));
        }
        call(castOf(ev, 5), io === 'Inside Out' ? 'Max melee => Under' : 'Under => Max melee', { alert: true, dur: 6 });
      } else if (name.startsWith('Get Down!')) {
        // In and out in turn, and a protean at one player each time, supports and DPS taking turns; it repeats where
        // it went 2.5 s later. Whoever it hit hides in a neighbour's slice of their own group (never the next one
        // targeted) for that beat, then goes home. (The strats put supports side by side, and DPS.)
        const run = [ev];
        for (let k = i + 1; k < events.length && events[k].t - t < 25; k++) if (events[k].name.startsWith('Get Down!')) { run.push(events[k]); runs.add(events[k]); }
        const sets = run.filter(e => /Protean/.test(e.name)), tail = run.find(e => !/Protean/.test(e.name));
        const base = PROTEAN[strat] || PROTEAN.hector, ang = Object.assign({}, base);
        const sup = shuffle(SUPPORT), dps = shuffle(DPS), supFirst = Math.random() < 0.5;
        const order = [];
        for (let k = 0; k < 4; k++) order.push(...(supFirst ? [sup[k], dps[k]] : [dps[k], sup[k]]));
        const diff = (a, b) => Math.abs(((a - b) % 360 + 540) % 360 - 180);
        let prev = null;
        sets.forEach((e, k) => {
          const outSet = /\(Out/.test(e.name), r = outSet ? 8.3 : 3.3, tgt = order[k];
          pref(k ? sets[k - 1].t + 0.25 : e.t - 5.5, all(s => at(ang[s], r)));
          hz(Object.assign({ t: e.t, tell: k ? sets[k - 1].t : e.t - 5.2, dmg: 1.3, name: 'Get Down!', react: 2.4 },
            outSet ? { shape: 'circle', at: [0, 0], r: 7 } : { shape: 'donut', at: [0, 0], r0: 5 }));
          if (prev) hz({ t: e.t, tell: e.t - 2.5, shape: 'protean', aimed: true, echoOf: prev.id, half: 22.5, r: 40, dmg: 0.9, name: 'Get Down! (repeat)' });
          const pid = hz({ t: e.t, tell: e.t - 1.2, shape: 'protean', aimed: true, target: tgt, half: 22.5, r: 60, dmg: 0.9, own: 0.15, name: 'Get Down!' });
          // The dodge, for the next beat; the last one hit goes home.
          if (prev) ang[prev.slot] = base[prev.slot];
          const mates = (SUPPORT.includes(tgt) ? SUPPORT : DPS).filter(s => s !== tgt);
          const hide = mates.reduce((a, b) => (diff(base[a], base[tgt]) <= diff(base[b], base[tgt]) ? a : b));
          ang[tgt] = base[hide];
          call(e.t + 0.1, `Protean hit you: step into ${hide}'s slice for a beat`, { slot: tgt, alert: true, dur: 2.4 });
          prev = { id: pid, slot: tgt };
        });
        if (tail && prev) {
          pref(sets[sets.length - 1].t + 0.25, all(s => at(ang[s], 8.3)));
          ang[prev.slot] = base[prev.slot];
          hz({ t: tail.t, tell: tail.t - 2.5, shape: 'protean', aimed: true, echoOf: prev.id, half: 22.5, r: 40, dmg: 0.9, name: 'Get Down! (repeat)' });
        }
        call(t - 5.5, 'Proteans: out, then in, every 2.5s; one hits a player each time and repeats there', { alert: true, dur: 7 });
        pref((tail || sets[sets.length - 1]).t + 0.5, UP);
      } else if (name.startsWith("Let's Dance!")) {
        const remix = name.includes('Remix');
        const run = [ev];
        for (let k = i + 1; k < events.length && events[k].t - run[run.length - 1].t < 4; k++) if (events[k].name.startsWith("Let's Dance!")) { run.push(events[k]); runs.add(events[k]); }
        const dirs = run.map(() => (Math.random() < 0.8 ? pick(['E', 'W']) : pick(['N', 'S'])));     // the logs: mostly east or west
        run.forEach((e, k) => {
          const d = DIR[dirs[k]];
          P.labels.set(e, `${remix ? "Let's Dance! Remix" : "Let's Dance!"} ${k + 1} (${NAME[dirs[k]]} safe)`);
          // (In the first dance the Wavelength merges land a second after a cleave: hold the merge, then step across.)
          hz({ t: e.t, tell: k ? run[k - 1].t : e.t - 3, shape: 'half', dir: [-d[0], -d[1]], dmg: 1.4, name: remix ? "Let's Dance! Remix" : "Let's Dance!", react: remix ? 1.5 : 1.4 });
        });
        call(t - (remix ? 6 : 4), `Safe: ${dirs.join(' > ')}`, { alert: true, dur: remix ? 14 : 20 });
        // Wavelength (the first dance): four pairs, each merging, away from the others, as its timers run out;
        // shortest timers north, longest south.
        const merges = events.filter(e => /^Debuffs \d/.test(e.name) && e.t > t - 5 && e.t < t + 30);
        if (!remix && merges.length) {
          // The pairs line up on the boss, shortest timers first: a column north to south while the cleaves come from
          // east or west (most of them, in the logs), a row west to east for a north or south one.
          const who = shuffle(S), along = [5, 2, -2.5, -6.5], order = {};
          merges.slice(0, 4).forEach((m, k) => {
            const [a, b] = [who[2 * k], who[2 * k + 1]];
            order[a] = order[b] = k;
            check({ t: m.t, kind: 'pair', slots: [a, b], partner: { [a]: b, [b]: a }, r: 2, fail: 0.8, name: 'Wavelength' });
            for (const [s, o] of [[a, b], [b, a]]) {
              P.debuffs.push({ slot: s, name: `Wavelength ${k + 1}`, hint: `merge with ${o}, away from the rest`, t0: t - 5, t1: m.t });
              call(m.t - 4, `Merge with ${o} now`, { slot: s, alert: true, dur: 4 });
            }
          });
          const line = (d) => all(sl => (order[sl] === undefined ? [0, 0] : d === 'E' || d === 'W' ? [0, along[order[sl]]] : [-along[order[sl]], 0]));
          pref(t - 4, line(dirs[0]));
          // Re-forming waits for a merge landing in between, so no one crosses a pair as it merges.
          const ns = (d) => d === 'N' || d === 'S';
          run.forEach((e, k) => {
            if (!k || ns(dirs[k]) === ns(dirs[k - 1])) return;
            const m = merges.find(x => x.t > run[k - 1].t && x.t < e.t - 1.3);
            pref(m ? m.t + 0.1 : run[k - 1].t + 0.05, line(dirs[k]));
          });
        } else pref(t - (remix ? 6 : 4), CLUMP);
        pref(Math.max(run[run.length - 1].t, ...merges.map(m => m.t)) + 0.5, UP);
      } else if (name === 'Ride the Waves') {
        // Seven rows of tiles flow in from the north, a row every 2.1 s, each with its safe columns, then flow out
        // the south; while the first six come in, the top row is all lit.
        phase = 'waves';
        wavePlan = waves(strat);
        pref(castOf(ev, 3.5), wavePlan.spots);
        const first = t + 4, n = 14, rows = snake(7);
        for (let k = 1; k <= n; k++) {
          const set = new Set();
          for (let r = 0; r < 8; r++) {
            const j = 7 - r, row = k - r;
            if (r === 0 && k >= 2 && k <= 6) { for (let c = 0; c < 8; c++) set.add(tile(c, j)); continue; }
            if (row < 1 || row > rows.length) continue;
            for (let c = 0; c < 8; c++) if (!rows[row - 1].includes(c)) set.add(tile(c, j));
          }
          const tt = first + (k - 1) * 2.1;
          hz({ t: tt, tell: tt - 2.1, shape: 'tiles', set, dmg: 1.2, name, react: 2.1 });
        }
        call(castOf(ev, 3.5), 'Ride the Waves: follow your lane as it zig-zags down', { alert: true, dur: 6 });
        pref(first + (n - 1) * 2.1 + 0.5, UP);
      } else if (name.includes('Quarter Beats')) {
        const quarter = lastQE && t - lastQE.t < 15 ? !lastQE.quarter : Math.random() < 0.5;
        lastQE = { t, quarter };
        P.labels.set(ev, quarter ? 'Quarter Beats' : 'Eighth Beats');
        const q = qeSpots() || { spots: UP, pairs: [['MT', 'R1'], ['OT', 'R2'], ['H1', 'M1'], ['H2', 'M2']] };
        const cs = castOf(ev, 5);
        if (quarter) {
          const spots = {};
          for (const [a, b] of q.pairs) spots[a] = spots[b] = q.meet === 'near' ? q.spots[a] : mid(q.spots[a], q.spots[b]);
          pref(cs, spots);
          check({ t, kind: 'stack', groups: q.pairs, r: 4, dmg: 0.3, fail: 0.6, name: 'Quarter Beats' });
          partnerCalls(cs, q.pairs);
        } else {
          pref(cs, q.spots);
          check({ t, kind: 'spread', r: 5, dmg: 0.25, fail: 0.7, name: 'Eighth Beats' });
          call(cs, 'Spread', { dur: 5 });
        }
        pref(t + 0.4, q.spots);
      } else if (name === 'Frogtourage') {
        frogs++;
        if (frogs === 1) {
          phase = 'frog1';
          const axis = pick(['NS', 'EW']);
          frogPlan = frog1(strat, axis);
          pref(t + 1, frogPlan.spots);
          const moon = next(i, e => e.name === 'Moonburn', 20);
          if (moon) {
            const set = new Set([...band(axis === 'NS', 0), ...band(axis === 'NS', 5)]);
            hz({ t: moon.t, tell: moon.t - 10.5, shape: 'tiles', set, dmg: 1.4, name: 'Moonburn', react: 4 });
          }
          call(t + 1, `Moonburn: ${axis === 'NS' ? 'north and south' : 'east and west'} safe`, { alert: true, dur: 8 });
        } else {
          phase = 'frog2';
          // More Amphibians, as the logs have it: supports bait first, far out at the intercards, while the DPS wait
          // east and west (G1 west); then the DPS bait close in at the same bearings and the supports stand on the boss.
          const baits = amphibians(strat), moons = events.filter(e => e.name === 'Moonburn' && e.t > t && e.t < t + 60);
          const sup = {}, dps = {};
          for (const [a, b, d] of baits) {
            const [s, x] = SUPPORT.includes(a) ? [a, b] : [b, a];
            sup[s] = at(d, 12.8); sup[x] = [G1.includes(x) ? -11 : 11, 0];
            dps[x] = at(d, 7.5); dps[s] = [0, 0];
          }
          const m1 = moons[0] ? moons[0].t : 479.3;
          pref(m1 - 9, sup);
          pref(m1 + 0.6, dps);
          pref((moons[1] ? moons[1].t : 495.1) + 0.8, UP);
          call(m1 - 9, 'Frog baits: supports out first, then DPS', { dur: 6 });
          // The Moonburns here: a band down the middle, then one along an edge.
          moons.forEach((m, k) => {
            const set = k === 0 ? band(true, pick([2, 3])) : band(false, pick([0, 5]));
            hz({ t: m.t, tell: m.t - 10.5, shape: 'tiles', set, dmg: 1.4, name: 'Moonburn', react: 4 });
          });
        }
      } else if (name.startsWith('Do the Hustle')) {
        if (name.includes('(dancers)')) {
          const c = pick(['N', 'E', 'S', 'W']);
          P.labels.set(ev, `Do the Hustle (${NAME[c]} safe)`);
          hz({ t, tell: castOf(ev, 5), shape: 'wedge', deg: DEG[c], half: 45, dmg: 1.4, name: 'Do the Hustle' });
          call(castOf(ev, 5), `Safe: ${NAME[c]}`, { alert: true, dur: 5 });
        } else if (name.includes('(boss)')) {
          const side = pick(['E', 'W']);
          P.labels.set(ev, `Do the Hustle (${NAME[side]} safe)`);
          hz({ t, tell: castOf(ev, 5), shape: 'half', dir: side === 'E' ? [-1, 0] : [1, 0], dmg: 1.4, name: 'Do the Hustle' });
          call(castOf(ev, 5), `Safe: ${NAME[side]}`, { alert: true, dur: 5 });
        } else {
          const c = pick(['N', 'S']), side = pick(['E', 'W']);
          const deg = DEG[c] + ((side === 'E') === (c === 'N') ? 22.5 : -22.5);
          P.labels.set(ev, `Do the Hustle (${c}${c === 'N' ? 'N' : 'S'}${side} safe)`);
          hz({ t, tell: castOf(ev, 5), shape: 'wedge', deg, half: 22.5, dmg: 1.4, name: 'Do the Hustle' });
          call(castOf(ev, 5), `Safe: ${NAME[c]}-${NAME[side].toLowerCase()} (${c}${c}${side})`, { alert: true, dur: 5 });
        }
      }
    });
    return P;
  }

  B.FIGHT_SCRIPTS = B.FIGHT_SCRIPTS || {};
  B.FIGHT_SCRIPTS.m5s = {
    // His max HP in FFLogs' M5S kills (every damage event on him carries it). With the bots' damage (js/party.js) a
    // player near their job's benchmark kills him around 9:10, before the 10:03 enrage.
    hp: 105549682,
    defaultStrat: 'hector',
    strats: {
      hector: { label: 'Hector (NA / EU, the default)' },
      game8: { label: 'Game8 / Nukemaru (JP)' },
      mr: { label: 'MR (OCE)' },
      latte: { label: 'Latte' },
      toxic: { label: 'Toxic Friends' },
    },
    source: 'wtfdig.info/72/m5s; mechanics after BossMod (github.com/awgil/ffxiv_bossmod)',
    waymarks: [
      { label: 'A', at: [0, 7], color: 'red' }, { label: 'B', at: [7, 0], color: 'yellow' },
      { label: 'C', at: [0, -7], color: 'blue' }, { label: 'D', at: [-7, 0], color: 'purple' },
      { label: '1', at: [-12.5, 12.5], color: 'red', square: true }, { label: '2', at: [12.5, 12.5], color: 'yellow', square: true },
      { label: '3', at: [12.5, -12.5], color: 'blue', square: true }, { label: '4', at: [-12.5, -12.5], color: 'purple', square: true },
    ],
    plan,
  };
})(window.BLM);
