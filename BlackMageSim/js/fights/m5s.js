// M5S, AAC Cruiserweight M1 (Savage): Dancing Green's mechanics for the sim's party, on cactbot's timeline, and the
// strats wtfdig.info lists for them: Hector's (its default, the one NA and EU party finders run), Game8/Nukemaru
// (JP), MR (OCE), Latte and Toxic Friends. Each strat gives the eight spots (MT OT H1 H2 M1 M2 R1 R2) a place for
// each mechanic; the bots stand there, and so should you. Spots are [east, north] yalms from the arena's middle.
//
// What's modelled: Deep Cut's tank cones; the 2/3/4-snap Twist's half-room cleaves (the side and count picked each
// pull) and the A-side (role positions) or B-side (light parties) it plays after; Celebrate Good Times, Disco
// Infernal and Let's Pose raidwides; Funky Floor's checkerboard; Disco Infernal's Burn Baby Burn (stand in a
// spotlight when it runs out); Inside Out / Outside In; Arcady Night Fever's in/out proteans and their echoes; Let's
// Dance's eight half-room cleaves (and the Remix); Ride the Waves' lanes; Quarter Beats (partner stacks) and Eighth
// Beats (spreads); Frogtourage's Moonburn lines; Do the Hustle's cleaves. Simplified: the dance floor's patterns
// and lanes are fixed shapes, not the game's moving ones; the conga debuffs, Wavelength and the frogs' Back-up
// Dance baits only move the bots (nothing lands for them).
(function (B) {
  const S = B.SLOTS;
  const all = (f) => Object.fromEntries(S.map(s => [s, f(s)]));
  const at = B.bearing;
  const mid = (a, b) => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
  const G1 = ['MT', 'H1', 'M1', 'R1'], G2 = ['OT', 'H2', 'M2', 'R2'];
  const SUPPORT = ['MT', 'OT', 'H1', 'H2'];
  const DIR = { N: [0, 1], E: [1, 0], S: [0, -1], W: [-1, 0] };
  const DEG = { N: 0, E: 90, S: 180, W: 270 };
  const NAME = { N: 'North', E: 'East', S: 'South', W: 'West' };
  const pick = (a) => a[Math.floor(Math.random() * a.length)];

  // Everyone's spot outside mechanics: tanks at the boss's front (she faces north), melee at her rear flanks, the
  // ranged and healers further back.
  const UP = { MT: [0, 6.5], OT: [2.5, 6], M1: [-4.5, -5], M2: [4.5, -5], R1: [-7, -10], R2: [7, -10], H1: [-2.5, -12.5], H2: [2.5, -12.5] };
  // Clumped round the boss, to dodge half-room cleaves that come quickly.
  const CLUMP = { MT: [0, 3], OT: [1.5, 3], M1: [-2, -2], M2: [2, -2], R1: [-3.5, -1], R2: [3.5, -1], H1: [-1.5, -3.5], H2: [1.5, -3.5] };

  // ---------- each strat's spots ----------
  // #-snap Twist, then Play A-side (role positions) or B-side (light parties), on the side the last hit leaves safe
  // (s: +1 east, -1 west). groups: who stacks together (the check: you're with yours, at your spot).
  function twist(strat, ab, s) {
    const x = 2.5 * s;
    if (strat === 'game8') {          // static: the same spots for both sides
      const north = ['MT', 'H1', 'R1', 'R2'];
      return { spots: all(k => north.includes(k) ? [x, 6.5] : [x, -6.5]), groups: [north, S.filter(k => !north.includes(k))] };
    }
    if (strat === 'mr') {             // fixed: tanks north, H1 north-west, H2 south-east, DPS south
      return { spots: { MT: [x, 6.5], OT: [x, 6.5], H1: [6 * s, 4], H2: [6 * s, -4], M1: [x, -6.5], M2: [x, -6.5], R1: [x, -6.5], R2: [x, -6.5] },
        groups: [['MT', 'OT'], ['H1'], ['H2'], ['M1', 'M2', 'R1', 'R2']] };
    }
    if (ab === 'A') {                 // tanks north, healers out to the side, DPS south
      return { spots: { MT: [x, 6], OT: [x, 6], H1: [6.5 * s, 0], H2: [6.5 * s, 0], M1: [x, -6], M2: [x, -6], R1: [x, -6], R2: [x, -6] },
        groups: [['MT', 'OT'], ['H1', 'H2'], ['M1', 'M2', 'R1', 'R2']] };
    }
    return { spots: all(k => G1.includes(k) ? [x, 6] : [x, -6]), groups: [G1, G2] };      // G1 north, G2 south
  }

  // Disco Infernal 1: each spot's half of the floor and the spotlight it cleanses in (supports first, then DPS).
  const LIGHTS1 = [[-2.5, 7.5], [7.5, 2.5], [2.5, -7.5], [-7.5, -2.5], [-12.5, 12.5], [12.5, 12.5], [12.5, -12.5], [-12.5, -12.5]];
  function disco1(strat) {
    if (strat === 'latte') {          // G1 north, G2 south
      return { zone: { MT: [-2.5, 7.5], M1: [2.5, 7.5], H1: [-2.5, 12.5], R1: [2.5, 12.5], OT: [2.5, -7.5], M2: [-2.5, -7.5], H2: [-2.5, -12.5], R2: [2.5, -12.5] },
        lights: { MT: [-2.5, 7.5], M1: [7.5, 2.5], H1: [-12.5, 12.5], R1: [12.5, 12.5], OT: [2.5, -7.5], M2: [-7.5, -2.5], H2: [-12.5, -12.5], R2: [12.5, -12.5] } };
    }
    // G1 west, G2 east; tanks and melee close to the boss, healers and ranged far (Toxic: melee north/west, south/east)
    return { zone: { MT: [-7.5, 2.5], M1: [-7.5, -2.5], H1: [-12.5, 2.5], R1: [-12.5, -2.5], OT: [7.5, 2.5], M2: [7.5, -2.5], H2: [12.5, 2.5], R2: [12.5, -2.5] },
      lights: { MT: [-2.5, 7.5], M1: [-7.5, -2.5], H1: [-12.5, 12.5], R1: [-12.5, -12.5], OT: [7.5, 2.5], M2: [2.5, -7.5], H2: [12.5, 12.5], R2: [12.5, -12.5] } };
  }

  // Arcady Night Fever: each spot's protean bearing (rotating 22.5 degrees clockwise after each hit, then back).
  const PROTEAN = {
    hector: { MT: 337.5, OT: 22.5, H1: 292.5, H2: 67.5, M1: 202.5, M2: 157.5, R1: 247.5, R2: 112.5 },
    latte: { MT: 22.5, OT: 337.5, H1: 67.5, H2: 292.5, M1: 202.5, M2: 157.5, R1: 247.5, R2: 112.5 },
    toxic: { MT: 337.5, OT: 202.5, H1: 292.5, H2: 247.5, M1: 112.5, M2: 157.5, R1: 22.5, R2: 67.5 },
  };

  // Ride the Waves: the two dark lanes (tile columns 1-2 and 4-5) and each spot's place in them; pairs for Quarter
  // Beats' partner stacks.
  const WAVE_COLS = [0, 3, 6, 7];
  function waves(strat) {
    if (strat === 'game8') {          // melee north, ranged south
      return { spots: { MT: [-10, 12], M1: [-10, 5], H1: [-10, -5], R1: [-10, -12], OT: [5, 12], M2: [5, 5], H2: [5, -5], R2: [5, -12] },
        pairs: [['MT', 'M1'], ['H1', 'R1'], ['OT', 'M2'], ['H2', 'R2']] };
    }
    if (strat === 'mr') {             // melee in the close lane, ranged in the far one; G1 north, G2 south
      return { spots: { MT: [5, 12], M1: [5, 5], H1: [-10, 12], R1: [-10, 5], OT: [5, -12], M2: [5, -5], H2: [-10, -12], R2: [-10, -5] },
        pairs: [['MT', 'M1'], ['H1', 'R1'], ['OT', 'M2'], ['H2', 'R2']] };
    }
    if (strat === 'toxic') {          // TR and HM stacks, ranged far, melee close
      return { spots: { MT: [-7, 6], R1: [-12, 10], H1: [-12, -10], M1: [-7, -6], OT: [2.5, 6], R2: [8, 10], H2: [8, -10], M2: [2.5, -6] },
        pairs: [['MT', 'R1'], ['H1', 'M1'], ['OT', 'R2'], ['H2', 'M2']] };
    }
    return { spots: { MT: [-12, 5], R1: [-8, 8.5], M1: [-12, -3.5], H1: [-12, -11], OT: [2.5, 5], R2: [7.5, 8.5], M2: [2.5, -3.5], H2: [2.5, -11] },
      pairs: [['MT', 'R1'], ['OT', 'R2'], ['H1', 'M1'], ['H2', 'M2']] };
  }

  // Frogtourage 1: Moonburn leaves north and south safe (axis 'NS') or east and west ('EW'); G1 takes north (or
  // west), G2 south (or east), supports on the left facing the boss.
  function frog1(strat, axis) {
    const rot = (p) => (axis === 'NS' ? p : [-p[1], p[0]]);
    if (strat === 'mr') {             // the safe spot nearest each intercard: melee close, ranged far
      const spot = (sx, sy, d) => (axis === 'NS' ? [sx * 4, sy * d] : [sx * d, sy * 4]);
      return { spots: { MT: spot(-1, 1, 9), R1: spot(-1, 1, 17), OT: spot(1, 1, 9), R2: spot(1, 1, 17), M1: spot(-1, -1, 9), H1: spot(-1, -1, 17), M2: spot(1, -1, 9), H2: spot(1, -1, 17) },
        pairs: [['MT', 'R1'], ['OT', 'R2'], ['H1', 'M1'], ['H2', 'M2']] };
    }
    const base = strat === 'latte'
      ? { MT: [4, 11], M1: [-4, 11], H1: [-4, 18.5], R1: [4, 18.5], OT: [4, -11], M2: [-4, -11], H2: [-4, -18.5], R2: [4, -18.5] }
      : { MT: [4, 11], H1: [4, 18.5], M1: [-4, 11], R1: [-4, 18.5], OT: [-4, -11], H2: [-4, -18.5], M2: [4, -11], R2: [4, -18.5] };
    return { spots: all(k => rot(base[k])), pairs: [['MT', 'M1'], ['H1', 'R1'], ['OT', 'M2'], ['H2', 'R2']] };
  }

  // Disco Infernal 2: colour partners, a support and a DPS by each waymark colour; supports cleanse first while
  // their DPS baits a frog nearer the middle, then they swap.
  const COLOR_SPOT = { red: [-2.5, 12.5], yellow: [12.5, 2.5], blue: [2.5, -12.5], purple: [-12.5, -2.5] };
  function disco2(strat) {
    if (strat === 'hector' || strat === 'mr') return { red: ['MT', 'R1'], yellow: ['OT', 'R2'], purple: ['H1', 'M1'], blue: ['H2', 'M2'] };
    return { red: ['MT', 'R1'], blue: ['OT', 'M2'], purple: ['H1', 'M1'], yellow: ['H2', 'R2'] };
  }

  // Frogtourage 2's baits (More Amphibians): each pair's bearing; supports bait first.
  function amphibians(strat) {
    if (strat === 'game8' || strat === 'mr') return [['MT', 'R1', 315], ['OT', 'R2', 45], ['H1', 'M1', 225], ['H2', 'M2', 135]];
    if (strat === 'latte') return [['MT', 'R1', 337.5], ['OT', 'M2', 157.5], ['H1', 'M1', 247.5], ['H2', 'R2', 67.5]];
    return [['MT', 'R1', 337.5], ['OT', 'R2', 67.5], ['H1', 'M1', 247.5], ['H2', 'M2', 157.5]];
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
    const hz = (o) => { P.hazards.push(Object.assign({ id: ++id, react: 3 }, o)); };
    const pref = (t, spots) => P.prefs.push({ t, spots });
    const call = (t, text, o) => P.calls.push(Object.assign({ t, text }, o));
    const check = (o) => P.checks.push(o);
    const castOf = (ev, d) => ev.t - (ev.cast || d || 5);
    const next = (i, test, within) => { for (let k = i + 1; k < events.length && events[k].t - events[i].t <= within; k++) if (test(events[k])) return events[k]; return null; };

    let ab = null, lastFlip = null, lastQE = null, discos = 0, frogs = 0, phase = null, wavePlan = null, frogPlan = null;
    const runs = new Set();
    const qeSpots = () => (phase === 'waves' ? wavePlan : phase === 'frog1' ? frogPlan : phase === 'funky2' ? funky2(strat) : null);
    const partnerCalls = (t, pairs) => {
      for (const [a, b] of pairs) { call(t, `Stack with ${b}`, { slot: a }); call(t, `Stack with ${a}`, { slot: b }); }
    };

    events.forEach((ev, i) => {
      const name = ev.name, t = ev.t;
      if (runs.has(ev)) return;
      if (name === 'Deep Cut') {
        pref(t - 5.6, { MT: [-5, 5], OT: [5, 5] });
        pref(t + 0.6, { MT: UP.MT, OT: UP.OT });
        hz({ t, tell: t - 5, shape: 'tankcones', aimed: true, slots: ['MT', 'OT'], half: 30, r: 40, dmg: 1.5, buster: 0.75, name });
        call(t - 5.6, 'Tank cleaves: stay out of the tanks\' cones');
        for (const s of ['MT', 'OT']) call(t - 5.6, 'Tank cleave on YOU: face it away from the party', { slot: s, alert: true });
      } else if (name.startsWith('Flip to')) {
        ab = lastFlip && t - lastFlip.t < 30 ? (lastFlip.ab === 'A' ? 'B' : 'A') : pick(['A', 'B']);
        lastFlip = { t, ab };
        P.labels.set(ev, `Flip to ${ab}-side`);
        call(castOf(ev, 4), ab === 'A' ? '(Role positions later)' : '(Light parties later)', { dur: 4 });
      } else if (name.includes('snap Twist')) {
        const n = pick([2, 3, 4]), s0 = pick([-1, 1]), sf = n % 2 ? s0 : -s0, side = ab || 'B';
        P.labels.set(ev, `${n}-snap Twist & Drop the Needle`);
        const needle = next(i, e => e.name === 'Drop the Needle', 6), play = next(i, e => e.name.startsWith('Play '), 9);
        const last = needle ? needle.t : t + 3.7, cs = castOf(ev, 5);
        const tw = twist(strat, side, sf);
        pref(cs, tw.spots);
        for (let k = 0; k < n; k++) {
          const tk = t + k * (last - t) / (n - 1), safe = s0 * (k % 2 ? -1 : 1);
          hz({ t: tk, tell: k ? t + (k - 1) * (last - t) / (n - 1) : cs + 0.5, shape: 'half', dir: [-safe, 0], dmg: 1.4, name: k === n - 1 ? 'Drop the Needle' : `${n}-snap Twist`, react: k ? 1.6 : 3 });
        }
        call(cs, `Start ${s0 < 0 ? 'West' : 'East'} (${n} hits) => ${side === 'A' ? 'Role positions' : 'Light parties'}`, { alert: true, dur: 7 });
        if (play) {
          P.labels.set(play, `Play ${side}-side`);
          check({ t: play.t, kind: 'stack', groups: tw.groups, spots: tw.spots, r: 4, dmg: 0.3, fail: 0.6, name: `Play ${side}-side` });
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
          const d = disco1(strat);
          pref(t, d.zone);
          P.marks.push(...LIGHTS1.map(p => ({ kind: 'spotlight', at: p, r: 2.2, t0: t, t1: t + 33 })));
          for (const s of S) {
            const ex = t + (SUPPORT.includes(s) ? 23.5 : 31.5);
            pref(ex - 4.5, { [s]: d.lights[s] });
            pref(ex + 0.4, { [s]: d.zone[s] });
            check({ t: ex, kind: 'spotlight', slots: [s], lights: LIGHTS1, r: 2.4, fail: 0.9, name: 'Burn Baby Burn' });
            P.debuffs.push({ slot: s, name: 'Burn Baby Burn', t0: t, t1: ex });
            call(ex - 5, 'Cleanse in a spotlight', { slot: s, alert: true, dur: 5 });
          }
        } else {
          const cols = disco2(strat), lights = Object.values(COLOR_SPOT);
          P.marks.push(...lights.map(p => ({ kind: 'spotlight', at: p, r: 2.2, t0: t, t1: t + 20 })));
          for (const [c, [sup, dps]] of Object.entries(cols)) {
            const spot = COLOR_SPOT[c], bait = [spot[0] * 0.55, spot[1] * 0.55];
            pref(t, { [sup]: spot, [dps]: bait });
            pref(t + 9.5, { [sup]: bait, [dps]: spot });
            [[sup, t + 9], [dps, t + 19]].forEach(([s, ex]) => {
              check({ t: ex, kind: 'spotlight', slots: [s], lights, r: 2.4, fail: 0.9, name: 'Burn Baby Burn' });
              P.debuffs.push({ slot: s, name: 'Burn Baby Burn', t0: t, t1: ex });
              call(ex - 5, `Cleanse in the ${c} spotlight`, { slot: s, alert: true, dur: 5 });
            });
            call(t, `Bait the frog by ${c}, then cleanse`, { slot: dps, dur: 5 });
          }
          pref(t + 20, UP);
        }
      } else if (name === 'Funky Floor') {
        const run = [ev];
        for (let k = i + 1; k < events.length; k++) {
          if (events[k].name === 'Funky Floor' && events[k].t - run[run.length - 1].t < 4.6) { run.push(events[k]); runs.add(events[k]); } else if (events[k].t - run[run.length - 1].t > 4.6) break;
        }
        const p0 = pick([0, 1]);
        if (t > 500) { phase = 'funky2'; pref(t - 4, funky2(strat).spots); }
        run.forEach((e, k) => hz({ t: e.t, tell: k ? run[k - 1].t : e.t - 4, shape: 'tiles', parity: (p0 + k) % 2, dmg: 1.3, name, react: 1.6 }));
        call(t - 4, 'Funky Floor: step onto a safe tile before each flash', { dur: 5 });
        const end = run[run.length - 1].t;
        if (t > 500) pref(end + 0.5, UP);
      } else if (name === 'Inside Out/Outside In') {
        const second = next(i, e => e.name === name, 3.5);
        const io = pick(['Inside Out', 'Outside In']);
        const out = { shape: 'circle', at: [0, 0], r: 7 }, under = { shape: 'donut', at: [0, 0], r0: 5 };
        const first = io === 'Inside Out' ? out : under, then = io === 'Inside Out' ? under : out;
        P.labels.set(ev, io);
        hz(Object.assign({ t, tell: castOf(ev, 5), dmg: 1.3, name: io }, first));
        if (second) {
          runs.add(second);
          P.labels.set(second, io);
          hz(Object.assign({ t: second.t, tell: t, dmg: 1.3, name: io, react: 2.6 }, then));
        }
        call(castOf(ev, 5), io === 'Inside Out' ? 'Max melee => Under' : 'Under => Max melee', { alert: true, dur: 6 });
      } else if (name.startsWith('Get Down!')) {
        const run = [ev];
        for (let k = i + 1; k < events.length && events[k].t - t < 25; k++) if (events[k].name.startsWith('Get Down!')) { run.push(events[k]); runs.add(events[k]); }
        const base = PROTEAN[strat] || PROTEAN.hector;
        let prevT = null;
        run.forEach((e, k) => {
          const echoOnly = !/Protean/.test(e.name);
          const outSet = /\(Out/.test(e.name), shift = k % 2 ? 22.5 : 0;
          if (!echoOnly) {
            pref(prevT === null ? e.t - 5.5 : prevT + 0.25, all(s => at(base[s] + shift, outSet ? 9.5 : 3.5)));
            hz(Object.assign({ t: e.t, tell: prevT === null ? e.t - 5 : prevT, dmg: 1.3, name: 'Get Down!', react: 2.4 },
              outSet ? { shape: 'circle', at: [0, 0], r: 7 } : { shape: 'donut', at: [0, 0], r0: 5 }));
          } else pref(prevT + 0.25, all(s => at(base[s] + shift, 9.5)));
          if (k) hz({ t: e.t, tell: e.t - 1.2, shape: 'protean', aimed: true, echo: true, half: 12.5, r: 40, dmg: 0.9, name: 'Get Down! (echo)' });
          if (!echoOnly) hz({ t: e.t, tell: e.t - 1.2, shape: 'protean', aimed: true, snapshot: true, half: 12.5, r: 40, dmg: 0.9, own: 0.12, name: 'Get Down!' });
          prevT = e.t;
        });
        call(t - 5.5, 'Proteans: out first, then in; rotate a step clockwise after every hit', { alert: true, dur: 7 });
        pref(prevT + 0.5, UP);
      } else if (name.startsWith("Let's Dance!")) {
        const remix = name.includes('Remix');
        const run = [ev];
        for (let k = i + 1; k < events.length && events[k].t - run[run.length - 1].t < 4; k++) if (events[k].name.startsWith("Let's Dance!")) { run.push(events[k]); runs.add(events[k]); }
        const dirs = run.map(() => pick(['N', 'E', 'S', 'W']));
        pref(t - (remix ? 6 : 4), CLUMP);
        run.forEach((e, k) => {
          const d = DIR[dirs[k]];
          P.labels.set(e, `${remix ? "Let's Dance! Remix" : "Let's Dance!"} ${k + 1} (${NAME[dirs[k]]} safe)`);
          hz({ t: e.t, tell: k ? run[k - 1].t : e.t - 3, shape: 'half', dir: [-d[0], -d[1]], dmg: 1.4, name: remix ? "Let's Dance! Remix" : "Let's Dance!", react: remix ? 1.5 : 2.6 });
        });
        call(t - (remix ? 6 : 4), `Safe: ${dirs.map(d => d).join(' > ')}`, { alert: true, dur: remix ? 14 : 20 });
        pref(run[run.length - 1].t + 0.5, UP);
      } else if (name === 'Ride the Waves') {
        phase = 'waves';
        wavePlan = waves(strat);
        pref(castOf(ev, 3.5), wavePlan.spots);
        for (let tt = t + 3.5; tt < t + 26; tt += 2.5) hz({ t: tt, tell: tt - 2.5, shape: 'cols', cols: WAVE_COLS, dmg: 1.2, name, react: 2.5 });
        call(castOf(ev, 3.5), 'Ride the Waves: keep to your lane (the dark columns)', { alert: true, dur: 6 });
        pref(t + 26.5, UP);
      } else if (name.includes('Quarter Beats')) {
        const quarter = lastQE && t - lastQE.t < 15 ? !lastQE.quarter : Math.random() < 0.5;
        lastQE = { t, quarter };
        P.labels.set(ev, quarter ? 'Quarter Beats' : 'Eighth Beats');
        const q = qeSpots() || { spots: UP, pairs: [['MT', 'R1'], ['OT', 'R2'], ['H1', 'M1'], ['H2', 'M2']] };
        const cs = castOf(ev, 5);
        if (quarter) {
          const spots = {};
          for (const [a, b] of q.pairs) spots[a] = spots[b] = mid(q.spots[a], q.spots[b]);
          pref(cs, spots);
          check({ t, kind: 'stack', groups: q.pairs, r: 3.5, dmg: 0.3, fail: 0.6, name: 'Quarter Beats' });
          partnerCalls(cs, q.pairs);
        } else {
          pref(cs, q.spots);
          check({ t, kind: 'spread', r: 4, dmg: 0.25, fail: 0.7, name: 'Eighth Beats' });
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
            const a = axis === 'NS' ? [[[-20, -20], [-6, 20]], [[6, -20], [20, 20]]] : [[[-20, -20], [20, -6]], [[-20, 6], [20, 20]]];
            for (const [p, q] of a) hz({ t: moon.t, tell: moon.t - 7, shape: 'rect', a: p, b: q, dmg: 1.4, name: 'Moonburn' });
          }
          call(t + 1, `Moonburn: ${axis === 'NS' ? 'north and south' : 'east and west'} safe`, { alert: true, dur: 8 });
        } else {
          phase = 'frog2';
          const baits = amphibians(strat);
          const near = (sup) => Object.fromEntries(baits.flatMap(([a, b, d]) => [[a, at(d, sup ? 12 : 6)], [b, at(d, sup ? 6 : 12)]]));
          pref(470, near(true));
          pref(486, near(false));
          pref(497, UP);
          call(470, 'Frog baits: supports out first, then DPS', { dur: 6 });
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
    // Icy Veins' guide puts the DPS check at about 171,000 raid DPS for the enrage at 10:03 (603 s): 103 million.
    // With the bots' damage (js/party.js) a player near their job's benchmark kills it around 9:00.
    hp: 103000000,
    defaultStrat: 'hector',
    strats: {
      hector: { label: 'Hector (NA / EU, the default)' },
      game8: { label: 'Game8 / Nukemaru (JP)' },
      mr: { label: 'MR (OCE)' },
      latte: { label: 'Latte' },
      toxic: { label: 'Toxic Friends' },
    },
    source: 'wtfdig.info/72/m5s',
    waymarks: [
      { label: 'A', at: [0, 7], color: 'red' }, { label: 'B', at: [7, 0], color: 'yellow' },
      { label: 'C', at: [0, -7], color: 'blue' }, { label: 'D', at: [-7, 0], color: 'purple' },
      { label: '1', at: [-12.5, 12.5], color: 'red', square: true }, { label: '2', at: [12.5, 12.5], color: 'yellow', square: true },
      { label: '3', at: [12.5, -12.5], color: 'blue', square: true }, { label: '4', at: [-12.5, -12.5], color: 'purple', square: true },
    ],
    plan,
  };
})(window.BLM);
