// Dancing Mad (Ultimate): Kefka's five phases for the sim's party, on cactbot's timeline (07-dt/ultimate/dancing_mad,
// read along its main line), with the two strats wtfdig.info lists (ultimates/umad): Kefkabin (NA: Merry-Go-Round
// arrows, Kroxy-Rinon Forsaken, LB Bowels, D>S>A black holes) and LPDU (EU: Static Freaky arrows, LPDU Forsaken,
// Bowels and black holes). Spots are [east, north] yalms from the arena's middle; the arena is a 20-yalm circle
// whose edge is lethal (BossMod's ArenaBoundsCircle(20)).
//
// The phases (BossMod's UMADStates: P1 to P5, each a boss of its own) and the sim's HP: each phase's boss is an
// adds window soaking all the party's damage (Chaos and Exdeath half each), so a phase's HP stands alone; the
// boss's own pool is P5's Ultima Kefka, whose death clears the fight. Pushes skip cactbot's waits: P1's fake duty
// complete, Down for the Count's 30 s on the floor, the gap before P4, and bring P3 on (God Kefka's death) and P4
// (both P3 bosses dead). P1 and P4 are timed: their HP checks (15% and 20%) only enrage in the game; the sim plays on.
//
// The mechanics follow BossMod's UMAD modules (github.com/awgil/ffxiv_bossmod: shapes and sizes from the game's
// Action sheet) and cactbot's triggers, built with the sim's toolkit (js/mech.js):
//   P1 Kefka (the middle; Graven Images far north):
//   - Revolting Ruin III: 120-degree cones at the first then second in enmity; Light of Judgment + Hyperdrive x3.
//   - Graven 1: Pulse Wave (13-yalm knockback south on the tethered), Mystery Magic's ice (two quadrants) and fire
//     (stacks West/East, or spreads), true or fake; Wave Cannon at four of the conga (6-wide lines from the statue),
//     the towers they leave, Confetti (Double-trouble Trap: a stack that throws its partners 14 across) and Mystery
//     Magic's ice + lightning (10-wide bands).
//   - Graven 2: Gravitas (the party stack drops a puddle; north, then south), Vitrophyre spreads clear of the puddles,
//     Revolting Ruin, the half-room Wills; Confetti 2 throws each role into its puddle for the soak.
//   - Graven 3: Tele-trouncing's arrows dropped twice, Confetti 3 (supports NW, DPS SE), the sleep/confuse spots
//     (fixed, tanks and melee inside), then lightning + statue gaze + fire at the strat's static spots.
//   P2 Forsaken (God) Kefka:
//   - Ultimate Embrace (shared tank buster); Forsaken: eight sets of two towers (AAABBBBA) whose soakers carry
//     stack / spread / cone (the cones aimed at a baiter), Future's/Past's End jumps on the four nearest and All
//     Things Ending's half room after each even set; Trines (9/3/9 circles), Wings of Destruction (half room, then
//     near/far busters).
//   P3 Chaos and Exdeath (Kefka giant at the north):
//   - Aero III Assault; Bowels of Agony with Entropy (light-party fire) / Dynamic Fluid (water donuts) short and
//     long, the fire / water crystals' baits on the ranged, Cyclone at the wind crystal, Exdeath's Thunder III and
//     busters, Chaos' Latitudinal/Longitudinal Implosion; Umbra Smash on the farthest, Vacuum Wave, the eight Ultima
//     Blaster clone charges (limit cut).
//   - Earthquake: Slap Happy (three slams + party stack or role cones), the black holes' 24 lasers (each player soaks
//     three, D>S>A), Damning Edict, Look upon Me and Despair, White Hole + Implosion; Stomp-a-Mole's towers, Blizzard
//     puddles, Knock Down stacks and Big Bang.
//   P4 Kefka Says (Chaos and Neo Exdeath beside him): Mystery Magic x3, Grand Cross, Inferno/Tsunami, Flood of
//     Naught's colour halves, Death Bolt/Wave stacks and spreads (supports N/W, DPS S/E), Death Shriek gazes, Stray
//     Flames / Stray Spray (in or out), the last ice.
//   P5 Ultima Kefka: Ultima Repeater, Fell Forces (role autos), Flood (rotating bands) with Chaotic Flood's stack,
//     Maddening Orchestra x2 (Flare to the north wall, Holy stack south), Celestriad (12 elemental towers, in/out),
//     Stray Apocalypse (exaflares) and Stray Entropy, Forsaken (four stacks while holes open), Forsaken Null.
// Simplified: real/fake is shown in the calls, and only the true result lands (the "fake" Ave Maria / fake shriek,
// which want you to look AT them, can't be checked: they only get a call); the arrows' teleports, sleep and confusion,
// Head/Tailwind facing, accretion / primordial crust healing, acceleration bombs (stillness) and Blizzard III's keep
// moving aren't modelled; Forsaken's shapes are dealt at random each set rather than passed on through towers; the
// thunder bands', trines', crystals', black holes' and towers' layouts are this script's (BossMod knows them only
// from map effects); where wtfdig gives no diagram, the spots are this script's own.
(function (B) {
  const S = B.SLOTS;
  const at = B.bearing;
  const inside = B.mechInside;
  const add = (a, b) => [a[0] + b[0], a[1] + b[1]];
  const sub = (a, b) => [a[0] - b[0], a[1] - b[1]];
  const mul = (a, k) => [a[0] * k, a[1] * k];
  const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);
  const unit = (v) => { const l = Math.hypot(v[0], v[1]) || 1; return [v[0] / l, v[1] / l]; };
  const deg360 = (d) => ((d % 360) + 360) % 360;
  const brg = (p) => deg360(Math.atan2(p[0], p[1]) * 180 / Math.PI);
  const pick = (a) => a[Math.floor(Math.random() * a.length)];
  const shuffle = (a) => { const b = a.slice(); for (let i = b.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [b[i], b[j]] = [b[j], b[i]]; } return b; };
  const r2 = (p) => [+p[0].toFixed(2), +p[1].toFixed(2)];
  const ring = (deg, r) => r2(at(deg, r));
  const assign = (slots, pts) => Object.fromEntries(slots.map((s, i) => [s, pts[i]]));
  const SUP = ['MT', 'OT', 'H1', 'H2'], DPS = ['M1', 'M2', 'R1', 'R2'], TANKS = ['MT', 'OT'], HEALERS = ['H1', 'H2'];
  const MELEE = ['M1', 'M2'], RANGED = ['R1', 'R2'], NONTANK = S.filter(s => !TANKS.includes(s));
  const G1 = ['MT', 'H1', 'M1', 'R1'], G2 = ['OT', 'H2', 'M2', 'R2'];
  const PAIRS = [['MT', 'OT'], ['H1', 'H2'], ['M1', 'M2'], ['R1', 'R2']];
  const COMPASS = ['north', 'north-east', 'east', 'south-east', 'south', 'south-west', 'west', 'north-west'];
  const dirName = (deg) => COMPASS[Math.round(deg360(deg) / 45) % 8];

  // ---------- the floor ----------
  const ARENA = { shape: 'circle', at: [0, 0], r: 20, deathwall: true };
  const floorR = (m) => (p) => Math.hypot(p[0], p[1]) < 20 - (m === undefined ? 1 : m);

  // ---------- placing the party ----------
  // Each [slot, want, sep] in turn: the nearest point to `want` on the floor, clear of the shapes in `avoid` (by m
  // yalms) and at least sep (or the other's, whichever is more) from those already placed.
  function place(list, o) {
    o = o || {};
    const m = o.m === undefined ? 1.3 : o.m, avoid = o.avoid || [], floor = o.floor || floorR(1);
    const done = (o.keep || []).map(p => ({ p, sep: o.keepSep || 0 }));
    const out = {};
    for (const [s, want, sp] of list) {
      const sep = sp === undefined ? (o.sep === undefined ? 0.6 : o.sep) : sp;
      const ok = (p) => floor(p) && avoid.every(h => !inside(h, p, m)) && done.every(d => dist(d.p, p) >= Math.max(d.sep, sep));
      let best = ok(want) ? want.slice() : null;
      for (let r = 0.2; !best && r <= 34; r += 0.2) {
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
  const clumpAt = (slots, c, o) => place(slots.map(s => [s, c, 0.55]), Object.assign({ m: 0 }, o));
  // A clump clear of `avoid`: its middle picked first (with room for the clump), so it never splits round a shape.
  const clumpSafe = (slots, c, avoid, m) => clumpAt(slots, place([['c', c]], { avoid, m: (m || 1.5) + 1.3 }).c, { avoid, m: m || 1.5 });
  // n points (pairwise >= sep) satisfying ok, as near `anchor` as a search finds (nearest first, on a 1-yalm grid);
  // `keep`: points to stay sep from too.
  function spreadIn(n, ok, anchor, sep, keep) {
    const cand = [];
    for (let x = -19.5; x <= 19.5; x += 0.5) for (let y = -19.5; y <= 19.5; y += 0.5) if (ok([x, y])) cand.push([x, y]);
    cand.sort((a, b) => dist(a, anchor) - dist(b, anchor));
    const have = (keep || []).slice(), free = cand.filter(c => have.every(p => dist(p, c) >= sep));
    for (const g of [0.5, 1, 2]) {
      const near = free.filter(c => Math.abs((c[0] / g) % 1) < 1e-6 && Math.abs((c[1] / g) % 1) < 1e-6).slice(0, 500), got = [];
      let steps = 0;
      const dfs = (i) => {
        if (got.length === n) return true;
        for (let j = i; j < near.length && steps < 150000; j++) {
          steps++;
          if (got.every(p => dist(p, near[j]) >= sep)) { got.push(near[j]); if (dfs(j + 1)) return true; got.pop(); }
        }
        return false;
      };
      if (dfs(0)) return got.map(r2);
    }
    const out = [];
    for (const c of free) {
      if (out.length >= n) break;
      if (out.every(p => dist(p, c) >= sep)) out.push(r2(c));
    }
    while (out.length < n) out.push(r2(anchor));
    return out;
  }
  // Points along a straight run from a toward b, k of them `gap` apart starting `from` yalms out (a stack's partners
  // lined up on a knockback's line, so it throws them all the same way).
  const along = (a, u, from, gap, k) => Array.from({ length: k }, (_, i) => r2(add(a, mul(u, from + gap * i))));

  // ---------- Mystery Magic (P1 and P4) ----------
  // Blizzard III Blowout: two opposite quadrants (90-degree cones from the middle); the pair left safe is NW + SE or
  // NE + SW, whether the telegraph was true (the others are hit) or fake (the telegraphed ones are safe).
  const ICE_HIT = { NWSE: [45, 225], NESW: [135, 315] };
  const iceCones = (safe) => ICE_HIT[safe].map(d => ({ shape: 'cone', at: [0, 0], deg: d, half: 45, r: 40 }));
  // Thrumming Thunder III: two 10-wide bands (north-south or east-west), 3 to 13 yalms out on each side; true: the
  // bands are hit; fake: the rest (the middle strip and the rims).
  function thunderRects(axis, real) {
    const band = (lo, hi) => (axis === 'NS' ? { shape: 'rect', a: [lo, -22], b: [hi, 22] } : { shape: 'rect', a: [-22, lo], b: [22, hi] });
    return real ? [band(3, 13), band(-13, -3)] : [band(-3, 3), band(13, 22), band(-22, -13)];
  }

  // ---------- the party's places ----------
  // P1 / P4 Kefka in the middle (hitbox 6): tanks north, melee behind, healers and ranged further out.
  const UP1 = { MT: [-1, 7.5], OT: [1, 7.5], M1: [-5.5, -5.5], M2: [5.5, -5.5], H1: [-6.5, -11], H2: [6.5, -11], R1: [-11, -6.5], R2: [11, -6.5] };
  // P2 God Kefka (hitbox 6): the same.
  const UP2 = { MT: [-0.6, 8.5], OT: [0.6, 8.5], M1: [-5, -5.5], M2: [5, -5.5], H1: [-7, -11], H2: [7, -11], R1: [-11.5, -6], R2: [11.5, -6] };
  // P5 Ultima Kefka (hitbox 8): role spots for Fell Forces, everyone at least 5.3 from the others (MT 3.3).
  const UP5 = { MT: [0, 10], OT: [5, 9], M1: [-7.5, -7.5], M2: [7.5, -7.5], R1: [-14, 0], R2: [14, 0], H1: [-5, -14], H2: [5, -14] };

  // Each strat's choices (wtfdig's toggles: arrows, forsaken, bowels, blackhole).
  const STRATS = {
    kefkabin: {
      // Wave Cannon's conga, west to east.
      conga: ['H2', 'H1', 'MT', 'OT', 'M1', 'M2', 'R1', 'R2'],
      // Graven 3's fire: the static spread spots (markers 1 NW, 2 NE, 3 SE, 4 SW; far = the rim) and the stacks.
      spread3: { MT: [10, 10], OT: [10, -10], H1: [0, -17], H2: [17, 0], M1: [-10, 10], M2: [-10, -10], R1: [0, 17], R2: [-17, 0] },
      stack3: { sup: [10, -10], dps: [-10, 10] },
      // Black holes: who takes each round of tethers (D>S>A: DPS first, then supports).
      holes: ['M1', 'M2', 'R1', 'R2', 'MT', 'OT', 'H1', 'H2'],
    },
    lpdu: {
      conga: ['H2', 'H1', 'OT', 'MT', 'M1', 'M2', 'R1', 'R2'],
      spread3: { MT: [-5, -5], OT: [5, -5], H1: [0, -17], H2: [17, 0], M1: [-5, 5], M2: [5, 5], R1: [0, 17], R2: [-17, 0] },
      stack3: { sup: [0, -8], dps: [0, 8] },
      holes: ['M1', 'R1', 'M2', 'R2', 'MT', 'H1', 'OT', 'H2'],
    },
  };

  // ---------- the timeline ----------
  // The main-line reading of cactbot's file keeps a few lines the game never plays in order: P1's enrage branch
  // guessing P2's opening 100 s early, Aero III Assault twice (the branch's line and the phase's own), and the enrage
  // blocks cactbot keeps at the far end. Taken out once; the fight's enrage is Forsaken Null.
  function fixEvents(events) {
    const nul = events.filter(e => e.name === 'Forsaken Null (Enrage)').pop();
    if (!events.umadFixed) {
      const out = events.filter(e => {
        if (e.t > 197.4 && e.t < 297.4) return false;
        if (e.name === 'Aero III Assault' && events.some(o => o !== e && o.name === e.name && o.t > e.t && o.t - e.t < 5)) return false;
        if (nul && e.t > nul.t + 1) return false;
        return true;
      });
      events.splice(0, events.length, ...out);
      Object.defineProperty(events, 'umadFixed', { value: true });
    }
    if (nul) {
      for (const d of [B.GAME_MAPS && B.GAME_MAPS.umad && B.GAME_MAPS.umad.fight, B.app && B.app.fight && B.app.fight.key === 'umad' && B.app.fight.data]) {
        if (d && d.enrage > nul.t + 1) d.enrage = nul.t;
      }
    }
  }

  // ---------- the pull ----------
  function plan(events, strat) {
    fixEvents(events);
    const st = STRATS[strat] || STRATS.kefkabin;
    const P = { start: Object.assign({}, UP1), prefs: [], hazards: [], checks: [], calls: [], marks: [], labels: new Map(), debuffs: [],
      boss: [{ t: 0, at: [0, 0] }], hitbox: [{ t: 0, r: 6 }], looks: [], form: [], others: [], untargetable: [], face: [], arena: [{ t: 0, ...ARENA }],
      names: [{ t: 0, name: 'Kefka' }] };
    let id = 0;
    const X = {
      P, st, events,
      hz: (o) => { const h = Object.assign({ id: ++id, react: 3 }, o); P.hazards.push(h); return h; },
      pref: (t, spots) => P.prefs.push({ t, spots }),
      call: (t, text, o) => P.calls.push(Object.assign({ t, text, dur: 5 }, o)),
      debuff: (slot, key, name, hint, t0, t1) => P.debuffs.push({ slot, key, name, hint, t0, t1 }),
      mark: (shape, t0, t1, fill) => P.marks.push(Object.assign({ kind: 'lit', t0, t1, fill }, shape)),
      E: (name, t0, t1) => events.find(e => e.name === name && e.t >= t0 && e.t <= t1) || null,
      EA: (re, t0, t1) => events.filter(e => re.test(e.name) && e.t >= t0 && e.t <= t1),
      tOf: (e, d) => (e ? e.t : d),
      castOf: (ev, d) => ev.t - (ev.cast || d || 5),
      label: (ev, text) => { if (ev) P.labels.set(ev, text); },
    };
    X.raid = (ev, dmg, d) => { if (ev) X.hz({ t: ev.t, tell: X.castOf(ev, d || 4), raidwide: true, dmg, name: ev.name.replace(/ \d+$/, '').replace(/ \(.*\)$/, '') }); };
    X.spreads = (t, targets, r, name, o) => X.hz(Object.assign({ t, tell: t - 5, effect: 'bait', shape: 'circle', from: 'target', targets, r, dmg: 0.9, own: 0.3, name }, o));
    X.stack = (t, targets, r, min, name, o) => X.hz(Object.assign({ t, tell: t - 5, effect: 'share', shape: 'circle', from: 'target', targets, r, min, max: min, dmg: 0.35, name }, o));
    phase1(X);
    phase2(X);
    phase3(X);
    phase4(X);
    phase5(X);
    P.looks.sort((a, b) => a.t - b.t);
    P.form.sort((a, b) => a.t - b.t);
    P.hitbox.sort((a, b) => a.t - b.t);
    P.boss.sort((a, b) => a.t - b.t);
    P.names.sort((a, b) => a.t - b.t);
    return P;
  }

  // ===================================================== P1: Kefka =====================================================
  function phase1(X) {
    const { P, st, hz, pref, call, debuff, mark, E, EA, tOf, castOf, label, raid, spreads, stack } = X;
    P.looks.push({ t: 0, show: LOOK.p1 });
    for (const ev of X.events) if (ev.name === 'Light of Judgment' && ev.t < 200) { raid(ev, 0.5, 5); call(castOf(ev), 'Raidwide => tank buster x3', { dur: 4 }); }

    // --- Revolting Ruin III: a 120-degree cone at the first in enmity, then at the second ---
    // MT at bearing mtB, OT at otB (7.5 out); the others where `want` puts them, clear of both cones and `avoid`.
    const ruin = (e1, mtB, otB, want, avoid) => {
      const t1 = e1.t, t2 = tOf(E('Revolting Ruin III 2', t1, t1 + 5), t1 + 3.1), cs = castOf(e1, 5);
      const cones = [mtB, otB].map(d => ({ shape: 'cone', at: [0, 0], deg: d, half: 60, r: 40 }));
      const spots = Object.assign({ MT: ring(mtB, 7.5), OT: ring(otB, 7.5) },
        place(NONTANK.map(s => [s, want[s], 0.8]), { avoid: cones.concat(avoid || []), m: 1.6 }));
      pref(cs + 0.2, spots);
      hz({ t: t1, tell: cs, effect: 'bait', shape: 'cone', from: 'boss', aim: 'target', targets: ['MT'], half: 60, r: 40, dmg: 1.2, own: 0.5, buster: true, name: 'Revolting Ruin III' });
      hz({ t: t2, tell: t1, effect: 'bait', shape: 'cone', from: 'boss', aim: 'target', targets: ['OT'], half: 60, r: 40, dmg: 1.2, own: 0.5, buster: true, name: 'Revolting Ruin III' });
      call(cs, 'Tank cones: MT, then OT; party to the sides', { dur: 4 });
      return t2;
    };
    // Hyperdrive: three busters (5 yalms) on the main tank after Light of Judgment; the off tank steps off.
    for (const lj of X.events.filter(e => e.name === 'Light of Judgment' && e.t < 200)) {
      const hs = X.EA(/^Hyperdrive \d$/, lj.t, lj.t + 9);
      pref(castOf(lj) + 0.2, Object.assign({}, UP1, { OT: [6.5, 3] }));
      hs.forEach(h => spreads(h.t, ['MT'], 5, 'Hyperdrive', { tell: lj.t, dmg: 1.1, own: 0.45, buster: true }));
      if (hs.length) pref(hs[hs.length - 1].t + 0.2, UP1);
    }

    const rr1 = E('Revolting Ruin III 1', 5, 20);
    if (rr1) {
      const want = { H1: ring(270, 9), H2: ring(270, 14), M1: ring(90, 7.5), M2: ring(90, 11), R1: ring(85, 15), R2: ring(95, 17.5) };
      const end = ruin(rr1, 0, 180, want);
      pref(end + 0.2, UP1);
    }

    // --- Graven Image 1: knockback, ice + fire; Wave Cannon and its towers; Confetti; ice + lightning ---
    const gi1 = E('Graven Image 1', 20, 40);
    if (gi1) {
      const tKb = tOf(E('Pulse Wave', gi1.t, gi1.t + 10), gi1.t + 5.9);
      const mm = E('Mystery Magic', gi1.t, gi1.t + 12), tIce = tOf(mm, tKb + 2.3), cs = mm ? castOf(mm, 5) : tIce - 5;
      const tFire = tOf(E('Flagrant Fire III', gi1.t, gi1.t + 12), tIce + 0.9);
      const safe = pick(['NWSE', 'NESW']), iceReal = Math.random() < 0.5, cones = iceCones(safe);
      const fireStack = Math.random() < 0.5, fireReal = Math.random() < 0.5;
      const teth = [pick(SUP), pick(DPS)];
      // Supports west, DPS east, each in its half's safe quadrant (low in the north ones, so a knockback fits).
      const Q = { NW: [-10.5, 3], NE: [10.5, 3], SW: [-7, -7], SE: [7, -7] };
      const qW = safe === 'NWSE' ? 'NW' : 'SW', qE = safe === 'NWSE' ? 'SE' : 'NE';
      const okSide = (sx) => (p) => floorR(1.2)(p) && p[0] * sx > 1.5 && cones.every(c => !inside(c, p, 1.6));
      const fin = {};
      for (const [grp, q, sx] of [[SUP, qW, -1], [DPS, qE, 1]]) {
        const pts = fireStack ? Object.values(clumpSafe(grp, Q[q], cones, 1.6)) : spreadIn(4, okSide(sx), Q[q], 6.2);
        // The tethered one takes the spot lowest down (its knockback start, 13 north of it, must be on the floor).
        pts.sort((a, b) => a[1] - b[1]);
        const tt = grp.find(s => teth.includes(s)), rest = grp.filter(s => s !== tt);
        fin[tt] = pts[0];
        rest.forEach((s, i) => { fin[s] = pts[i + 1]; });
      }
      const pre = Object.assign({}, fin);
      for (const s of teth) {
        let p = add(fin[s], [0, 13]);
        if (Math.hypot(p[0], p[1]) > 18.4) p = r2(mul(unit(p), 18.4));
        pre[s] = r2(p);
      }
      pref(gi1.t - 2.8, Object.assign(clumpAt(SUP, [-7, 0]), clumpAt(DPS, [7, 0])));
      call(gi1.t - 2.8, 'Supports West, DPS East', { dur: 4 });
      pref(cs + 0.2, pre);
      pref(tKb + 0.6, fin);
      for (const s of teth) call(tKb - 5, 'Tether: knocked 13 south', { slot: s, alert: true, dur: 4 });
      hz({ t: tKb, tell: tKb - 5, effect: 'knockback', targets: teth, dir: 180, dist: 13, snap: 4, tether: [0, 35], name: 'Pulse Wave' });
      cones.forEach(c => hz(Object.assign({ t: tIce, tell: cs, dmg: 1.2, name: 'Blizzard III Blowout' }, c)));
      if (fireStack) {
        stack(tFire, [pick(SUP)], 6, 4, 'Flagrant Fire III', { tell: cs });
        stack(tFire, [pick(DPS)], 6, 4, 'Flagrant Fire III', { tell: cs });
      } else spreads(tFire, S, 5, 'Flagrant Fire III', { tell: cs });
      const sName = safe === 'NWSE' ? 'NW/SE' : 'NE/SW';
      label(mm, `Mystery Magic (${iceReal ? 'true' : 'fake'} ice, ${fireReal ? 'true' : 'fake'} fire)`);
      call(cs, `${iceReal ? 'True' : 'Fake'} ice: ${sName} safe => ${fireStack ? 'Stack' : 'Spread'}`, { alert: true, dur: 6 });

      // Wave Cannon: the conga in an arc 38 from the statue (8 degrees apart); four of it are lasered (two supports,
      // two DPS), each leaving a tower where they stood, soaked by the others west to east.
      const wc = E('Wave Cannon', tFire, tFire + 10);
      if (wc) {
        const tW = wc.t, tEx = tOf(E('Explosion', tW, tW + 6), tW + 3.5);
        const arc = (k) => { const a = (k - 3.5) * 8 * Math.PI / 180; return r2([Math.sin(a) * 38, 35 - Math.cos(a) * 38]); };
        const spots = Object.fromEntries(st.conga.map((s, k) => [s, arc(k)]));
        pref(tFire + 0.3, spots);
        call(tFire + 0.3, 'Conga line for the lasers', { dur: 4 });
        const hit = shuffle(SUP).slice(0, 2).concat(shuffle(DPS).slice(0, 2));
        for (const s of hit) hz({ t: tW, tell: tW - 4.3, effect: 'bait', shape: 'line', from: [0, 35], aim: 'target', targets: [s], len: 100, w: 6, dmg: 0.9, own: 0.3, status: ['magicVuln', 6], name: 'Wave Cannon' });
        const hitW = st.conga.filter(s => hit.includes(s)), soak = st.conga.filter(s => !hit.includes(s));
        const towers = hitW.map(s => spots[s]), tShapes = towers.map(c => ({ shape: 'circle', at: c, r: 4 }));
        towers.forEach((c, i) => hz({ t: tEx, tell: tEx - 3, effect: 'tower', shape: 'circle', at: c, r: 4, soak: 1, only: [soak[i]], dmg: 0.3, fail: 0.9, name: 'Explosion' }));
        pref(tW + 0.1, Object.assign(assign(soak, towers), place(hitW.map(s => [s, spots[s], 0.8]), { avoid: tShapes, m: 1.4 })));
        soak.forEach((s, i) => call(tW + 0.1, `Tower ${i + 1} from the west`, { slot: s, alert: true, dur: 3 }));

        // Confetti (Double-trouble Trap): one support and one DPS; a 6-yalm stack that throws the other three 14
        // away (BossMod: the holder 9 out on their side, the rest 3.25 in from them, thrown to the far side).
        const dc = E('Double-trouble Trap 1', tW, tW + 4), tC = tOf(E('Double-trouble Trap 2', tW, tW + 12), tW + 7.2);
        const holders = [pick(SUP), pick(DPS)], cspots = {};
        [[SUP, -1], [DPS, 1]].forEach(([grp, sx]) => {
          const h = grp.find(s => holders.includes(s)), mates = grp.filter(s => s !== h), H = [9 * sx, 0];
          cspots[h] = H;
          Object.assign(cspots, assign(mates, along(H, [-sx, 0], 3.25, 0.6, 3)));
          debuff(h, 'doubleTroubleTrap', 'Double-trouble Trap', 'stack: your partners are thrown 14 away', dc ? dc.t : tW + 2, tC);
          call(dc ? dc.t : tW + 2, 'Confetti on YOU: stack 9 out', { slot: h, alert: true, dur: 4 });
          hz({ t: tC, tell: tC - 5, effect: 'knockback', from: 'target', targets: [h], shape: 'circle', r: 6, dist: 14, name: 'Double-trouble Trap' });
          stack(tC, [h], 6, 4, 'Double-trouble Trap', { tell: tC - 5 });
        });
        pref(tEx + 0.1, cspots);
        // Mystery Magic: ice + lightning, from where the knockbacks left everyone.
        const mm2 = E('Mystery Magic', tC, tC + 8);
        if (mm2) {
          const safe2 = pick(['NWSE', 'NESW']), axis = pick(['NS', 'EW']), thReal = Math.random() < 0.5, ice2Real = Math.random() < 0.5;
          const shapes = iceCones(safe2).concat(thunderRects(axis, thReal));
          const landed = {};
          for (const [s, p] of Object.entries(cspots)) landed[s] = holders.includes(s) ? p : r2(add(p, [p[0] < 0 ? 14 : -14, 0]));
          pref(tC + 0.6, place(S.map(s => [s, landed[s], 0.6]), { avoid: shapes, m: 1.4 }));
          shapes.forEach(c => hz(Object.assign({ t: mm2.t, tell: castOf(mm2, 5), dmg: 1.2, name: c.shape === 'cone' ? 'Blizzard III Blowout' : 'Thrumming Thunder III' }, c)));
          label(mm2, `Mystery Magic (${ice2Real ? 'true' : 'fake'} ice ${safe2 === 'NWSE' ? 'NW/SE' : 'NE/SW'} safe, ${thReal ? 'true' : 'fake'} lightning ${axis === 'NS' ? 'north-south' : 'east-west'})`);
          call(castOf(mm2, 5), `${thReal ? 'Out of the lines' : 'In a line'} + ${safe2 === 'NWSE' ? 'NW/SE' : 'NE/SW'} quadrants`, { alert: true, dur: 5 });
          pref(mm2.t + 0.2, UP1);
        }
      }
    }

    // --- Graven Image 2: Gravitas stacks leave puddles; Vitrophyre spreads; Revolting Ruin + half rooms; Confetti 2
    // throws each role into its puddle for the soak ---
    const gi2 = E('Graven Image 2', 75, 90);
    if (gi2) {
      const blz = E('Blizzard III Blowout', gi2.t, gi2.t + 10), tB = tOf(blz, gi2.t + 7.1), cB = blz ? castOf(blz, 5) : tB - 5;
      const gr = EA(/^Gravitas$/, gi2.t, gi2.t + 30), vi = EA(/^Vitrophyre$/, gi2.t, gi2.t + 35);
      const waves = EA(/^Intemperate Will\/Gravitational Wave$/, gi2.t, gi2.t + 40);
      const tG1 = tOf(gr[0], tB + 0.1), tV1 = tOf(vi[0], tG1 + 4), tG2 = tOf(gr[1], tG1 + 18.6), tV2 = tOf(vi[1], tG2 + 4);
      const tW1 = tOf(waves[0], tV1 + 9.9), tW2 = tOf(waves[1], tV2 + 4.6);
      const pop = E('Gravity III (Pop Window)', tW2, tW2 + 5), tPop = tOf(pop, tW2 + 2.6);
      const conf = E('Double-trouble Trap 3', tPop - 1, tPop + 3), tC2 = tOf(conf, tPop + 1.1);
      const safe = pick(['NWSE', 'NESW']), cones = iceCones(safe);
      cones.forEach(c => hz(Object.assign({ t: tB, tell: cB, dmg: 1.2, name: 'Blizzard III Blowout' }, c)));
      label(blz, `Blizzard III Blowout (${safe === 'NWSE' ? 'NW/SE' : 'NE/SW'} safe)`);
      // Gravitas 1: all eight stack north in the safe quadrant; the puddle stays where its target stood.
      const p1 = safe === 'NWSE' ? [-4, 11.5] : [4, 11.5], p2 = [0, -12];
      const puddle = (p, t0, tgt) => {
        stack(t0, [tgt], 5, 6, 'Gravitas', { tell: t0 - 5, max: 8 });
        hz({ t: t0 + 1.8, tell: t0, shape: 'circle', from: 'target', targets: [tgt], snap: 1.8, r: 5, dmg: 0.9, lasts: tPop - 0.6 - (t0 + 1.8), tick: 4, tickDmg: 0.9, name: 'Gravitas (puddle)' });
        call(t0 - 5, `Stack ${p[1] > 0 ? 'north' : 'south'}: the puddle drops there`, { dur: 4 });
      };
      pref(cB + 0.2, clumpSafe(S, p1, cones, 1.6));
      puddle(p1, tG1, pick(S));
      // Vitrophyre: everyone spreads (5), G1 west and G2 east, 10.5 or more from the puddles.
      const vitro = (t0, t, puddles, from) => {
        const spots = {}, done = [];
        [[G1, -1], [G2, 1]].forEach(([grp, sx]) => {
          const ok = (p) => floorR(1.2)(p) && p[0] * sx > 2 && puddles.every(q => dist(p, q) > 10.6);
          const pts = spreadIn(4, ok, r2(add(from, mul(unit([sx, from[1] > 0 ? -0.5 : 0.5]), 11.5))), 6.2, done).sort((a, b) => Math.hypot(...a) - Math.hypot(...b));
          done.push(...pts);
          Object.assign(spots, assign(grp.slice().sort((a, b) => 'MTOTM1M2'.includes(b) - 'MTOTM1M2'.includes(a)), pts));
        });
        pref(t0 + 0.1, spots);
        spreads(t, S, 5, 'Vitrophyre', { tell: t0 });
      };
      vitro(tG1, tV1, [p1], p1);
      // Revolting Ruin, then the half room: the tanks' cones lean away from the party's safe half.
      const rr2 = E('Revolting Ruin III 1', tV1, tW1);
      const half1 = pick([-1, 1]);                        // the half hit: west -1, east 1
      const halfShape = (sx) => ({ shape: 'half', dir: [sx, 0], off: 0 });
      hz(Object.assign({ t: tW1, tell: tW1 - 5.2, dmg: 1.3, name: 'Gravitational Wave' }, halfShape(half1)));
      if (waves[0]) label(waves[0], `${half1 < 0 ? 'Intemperate Will (west half)' : 'Gravitational Wave (east half)'}`);
      if (rr2) {
        const westSafe = half1 > 0, mtB = westSafe ? 55 : -55, otB = westSafe ? 205 : 155, mid = westSafe ? 300 : 60;
        const want = Object.fromEntries(NONTANK.map((s, i) => [s, ring(mid + (i % 2 ? 12 : -12), 8 + 2 * i)]));
        ruin(rr2, mtB, otB, want, [halfShape(half1), { shape: 'circle', at: p1, r: 5 }]);
        call(castOf(rr2, 5), `Party ${westSafe ? 'west' : 'east'}: ${westSafe ? 'east' : 'west'} half next`, { alert: true, dur: 5 });
      }
      // Gravitas 2 south, Vitrophyre 2 clear of both puddles.
      pref(tW1 + 0.1, clumpAt(S, p2));
      puddle(p2, tG2, pick(S));
      vitro(tG2, tV2, [p1, p2], p2);
      // The second half room: supports north, DPS south, on the safe side.
      const half2 = pick([-1, 1]), sx2 = -half2;
      hz(Object.assign({ t: tW2, tell: tW2 - 5.2, dmg: 1.3, name: 'Gravitational Wave' }, halfShape(half2)));
      if (waves[1]) label(waves[1], `${half2 < 0 ? 'Intemperate Will (west half)' : 'Gravitational Wave (east half)'}`);
      const hav = [halfShape(half2), { shape: 'circle', at: p1, r: 5 }, { shape: 'circle', at: p2, r: 5 }];
      pref(tV2 + 0.1, Object.assign(place(SUP.map(s => [s, [11 * sx2, 6], 0.7]), { avoid: hav, m: 1.5 }), place(DPS.map(s => [s, [11 * sx2, -6], 0.7]), { avoid: hav, m: 1.5 })));
      call(tV2 + 0.1, `Supports north, DPS south, ${sx2 < 0 ? 'west' : 'east'}`, { dur: 4 });
      // Confetti 2: each holder stands so its knockback throws its partners onto its role's puddle (supports north,
      // DPS south), the partners lined up on the throw.
      const sx = Math.sign(p1[0]), holders = [pick(SUP), pick(DPS)], cs2 = {};
      [[SUP, p1, [3 * sx, -2.5]], [DPS, p2, [-3 * sx, 2.5]]].forEach(([grp, P0, M0]) => {
        const h = grp.find(s => holders.includes(s)), mates = grp.filter(s => s !== h);
        const u = unit(sub(P0, M0)), H = r2(sub(P0, mul(u, 15.2)));
        cs2[h] = H;
        Object.assign(cs2, assign(mates, along(H, u, 1.2, 0.6, 3)));
        debuff(h, 'doubleTroubleTrap', 'Double-trouble Trap', 'stack: throws your partners into the puddle', tW2 - 6, tC2);
        hz({ t: tC2, tell: tC2 - 5, effect: 'knockback', from: 'target', targets: [h], shape: 'circle', r: 6, dist: 14, name: 'Double-trouble Trap' });
        stack(tC2, [h], 6, 4, 'Double-trouble Trap', { tell: tC2 - 5 });
      });
      pref(tW2 + 0.1, cs2);
      call(tW2 + 0.1, 'Confetti: get thrown into your puddle', { alert: true, dur: 4 });
      // Gravity III's window: soak the puddles (supports north, DPS south).
      pref(tC2 + 0.6, Object.assign(clumpAt(SUP, p1), clumpAt(DPS, p2)));
      for (const p of [p1, p2]) hz({ t: tC2 + 3.4, tell: tPop, effect: 'tower', shape: 'circle', at: p, r: 5, soak: [1, 8], dmg: 0.3, fail: 0.9, name: 'Gravity III' });
      label(pop, 'Gravity III (soak the puddles)');
      pref(tC2 + 3.6, UP1);
    }

    // --- Graven Image 3 (Tele-trouncing): arrows, Confetti 3, sleep/confuse, then lightning + gaze + fire ---
    const tt = E('Tele-trouncing (castbar)', 140, 160);
    if (tt) {
      const t0 = tt.t, a1 = tOf(E('Tele-trouncing 1', t0, t0 + 12), t0 + 7.9), a2 = tOf(E('Tele-trouncing 2', t0, t0 + 14), a1 + 3);
      const tC3 = a2 + 5.5, will = E('Indulgent Will', t0, t0 + 30), tStun = tOf(will, tC3 + 5.6), tWake = tStun + 5.9;
      // Everyone gets two arrows (one role the same twice, the other two different); they drop round the big box
      // clockwise (the first 12.5 out, the second 16.5 out one step counter-clockwise).
      const BOX = { MT: 0, R1: 45, H2: 90, M2: 135, H1: 180, M1: 225, OT: 270, R2: 315 }, DIRS = ['N', 'E', 'S', 'W'];
      const same = pick([SUP, DPS]);
      for (const s of S) {
        const d1 = pick(DIRS), d2 = same.includes(s) ? d1 : pick(DIRS.filter(d => d !== d1));
        debuff(s, 'telePortent' + d1, 'Tele-Portent', `arrow ${d1}: drop it on your box spot`, t0 - 4, a1);
        debuff(s, 'telePortent' + d2, 'Tele-Portent', `arrow ${d2}: drop it one spot counter-clockwise`, a1, a2);
      }
      pref(t0 - 4, Object.fromEntries(S.map(s => [s, ring(BOX[s], 12.5)])));
      pref(a1 + 0.1, Object.fromEntries(S.map(s => [s, ring(BOX[s] - 22.5, 16.5)])));
      call(t0 - 4, 'Arrows: drop them round the box, clockwise', { alert: true, dur: 5 });
      for (const [ta, rr, off] of [[a1, 12.5, 0], [a2, 16.5, -22.5]]) {
        for (const s of S) {
          hz({ t: ta + 1, tell: ta - 0.5, shape: 'circle', from: 'target', targets: [s], snap: 1, r: 2, dmg: 0.9, name: 'Tele-Portent (arrow)' });
          mark({ shape: 'circle', at: ring(BOX[s] + off, rr), r: 2 }, ta + 1, tWake, 'rgba(255,200,80,0.35)');
        }
      }
      // Confetti 3: supports north-west, DPS south-east; the holders on the 1/3 markers' line, their partners thrown
      // across to the other side.
      const holders = [pick(SUP), pick(DPS)], cs3 = {};
      [[SUP, [-6, 6]], [DPS, [6, -6]]].forEach(([grp, H]) => {
        const h = grp.find(s => holders.includes(s)), mates = grp.filter(s => s !== h), u = unit(mul(H, -1));
        cs3[h] = H;
        Object.assign(cs3, assign(mates, along(H, u, 1.2, 0.6, 3)));
        debuff(h, 'doubleTroubleTrap', 'Double-trouble Trap', 'stack: throws your partners across', a2, tC3);
        hz({ t: tC3, tell: tC3 - 5, effect: 'knockback', from: 'target', targets: [h], shape: 'circle', r: 6, dist: 14, name: 'Double-trouble Trap' });
        stack(tC3, [h], 6, 4, 'Double-trouble Trap', { tell: tC3 - 5 });
      });
      pref(a2 + 0.1, cs3);
      call(a2 + 0.1, 'Confetti: supports NW, DPS SE', { alert: true, dur: 4 });
      // The sleep/confuse spots (fixed: tanks and melee 9.5 out, healers and ranged 15.5 on the same cardinal).
      const STUN = { MT: [0, 9.5], R1: [0, 15.5], OT: [-9.5, 0], R2: [-15.5, 0], M1: [0, -9.5], H1: [0, -15.5], M2: [9.5, 0], H2: [15.5, 0] };
      pref(tC3 + 0.6, STUN);
      const sleepers = shuffle(S).slice(0, 4);
      spreads(tStun, sleepers, 5, 'Idyllic Will', { tell: tC3, own: 0.2 });
      for (const s of S) debuff(s, sleepers.includes(s) ? 'sleep' : 'confused', sleepers.includes(s) ? 'Sleep' : 'Confused', 'stand on your fixed spot', tStun, tWake);
      call(tC3 + 0.6, 'Fixed spots: tanks/melee in, healers/ranged out', { alert: true, dur: 5 });
      // Mystery Magic: lightning + the statue's gaze + fire, at the static spots.
      const mm3 = E('Mystery Magic', tStun, tStun + 20), ff = E('Flagrant Fire III', tStun, tStun + 22);
      if (mm3) {
        const tM = mm3.t, tF = tOf(ff, tM + 0.8), axis = pick(['NS', 'EW']), thReal = Math.random() < 0.5, look = Math.random() < 0.5 ? 'away' : 'at';
        const fireStack = Math.random() < 0.5, bands = thunderRects(axis, thReal);
        bands.forEach(c => hz(Object.assign({ t: tM, tell: castOf(mm3, 5), dmg: 1.2, name: 'Thrumming Thunder III' }, c)));
        let spots;
        if (fireStack) {
          spots = Object.assign(clumpSafe(SUP, st.stack3.sup, bands, 1.6), clumpSafe(DPS, st.stack3.dps, bands, 1.6));
          stack(tF, [pick(SUP)], 6, 4, 'Flagrant Fire III', { tell: castOf(mm3, 5) });
          stack(tF, [pick(DPS)], 6, 4, 'Flagrant Fire III', { tell: castOf(mm3, 5) });
        } else {
          spots = place(S.map(s => [s, st.spread3[s], 5.8]), { avoid: bands, m: 1.6 });
          spreads(tF, S, 5, 'Flagrant Fire III', { tell: castOf(mm3, 5) });
        }
        pref(tWake + 0.1, spots);
        const gaze = X.EA(/^Ave Maria\/Indolent Will$/, tM - 1, tM + 1)[0];
        if (look === 'away') hz({ t: tM, tell: castOf(mm3, 5), effect: 'gaze', at: [5.25, 66], dmg: 0.9, status: ['petrification', 4], name: 'Indolent Will' });
        label(gaze, look === 'away' ? 'Indolent Will (look away from the statue)' : 'Ave Maria (look at the statue)');
        label(mm3, `Mystery Magic (${thReal ? 'true' : 'fake'} lightning, ${fireStack ? 'stack' : 'spread'})`);
        call(castOf(mm3, 5), `${thReal ? 'Out of the lines' : 'In a line'} + look ${look === 'away' ? 'AWAY from' : 'AT'} the statue + ${fireStack ? 'stack' : 'spread'}`, { alert: true, dur: 6 });
        pref(tF + 0.2, UP1);
      }
    }
  }

  // ================================================= P2: Forsaken Kefka ================================================
  function phase2(X) {
    const { P, hz, pref, call, debuff, E, EA, tOf, castOf, label, raid, spreads, stack } = X;
    P.form.push({ t: 197.4, model: 'none' }, { t: 304, model: 'god' }, { t: 480.4, model: 'none' });
    P.names.push({ t: 297.4, name: 'Forsaken Kefka' }, { t: 486, name: 'Kefka' });
    P.hitbox.push({ t: 297, r: 6.02 });
    P.looks.push({ t: 297.4, show: LOOK.p2 });
    P.untargetable.push([480.1, 529.5]);
    pref(297.6, UP2);
    for (const ev of X.events.filter(e => e.name === 'Ultimate Embrace' && e.t > 300 && e.t < 485)) {
      stack(ev.t, ['MT'], 5, 2, 'Ultimate Embrace', { tell: castOf(ev, 5), dmg: 0.5 });
      call(castOf(ev, 5), 'Shared tank buster', { dur: 4 });
    }
    raid(E('Light of Judgment', 435, 445), 0.5, 5);

    // --- Forsaken: eight sets of two towers (8 out, 90 degrees apart), turning 45 degrees a set ---
    const fk = E('Forsaken', 330, 340);
    if (fk) {
      raid(fk, 0.5, 7);
      const pol = [1, 2, 3, 4, 5, 6, 7, 8].map(k => E(`The Path of Light ${k}`, fk.t, fk.t + 100));
      const T = pol.map((e, k) => tOf(e, fk.t + 13.2 + 10.5 * k));
      const SH = T.map(t => tOf(X.events.find(x => x.name === 'Spelldriver/Spellscatter/Spellwave' && x.t > t && x.t < t + 2), t + 0.6));
      const fe = [1, 2, 3, 4].map(k => E(`Future's End/Past's End ${k}`, fk.t, fk.t + 100));
      const ate = EA(/^All Things Ending$/, fk.t, fk.t + 110);
      const c0 = pick([0, 45, 90, 135, 180, 225, 270, 315]), rot = pick([1, -1]);
      const C = T.map((_, k) => deg360(c0 + 45 * rot * k));
      // Group A (one with a stack) takes sets 1-3 and 8, group B sets 4-7; each role pair splits across the towers.
      const pairs = shuffle(PAIRS), A = pairs.slice(0, 2), Bg = pairs.slice(2);
      const PRI = ['MT', 'OT', 'M1', 'M2', 'H1', 'H2', 'R1', 'R2'];
      const futures = fe.map(() => Math.random() < 0.5);
      fe.forEach((e, i) => label(e, futures[i] ? `Future's End ${i + 1} (bait away from the next towers)` : `Past's End ${i + 1} (bait by the next towers)`));
      for (let k = 0; k < 8; k++) {
        const c = C[k], odd = k % 2 === 0, R = (th, r) => r2(at(c + th, r));
        const grp = [0, 1, 2, 7].includes(k) ? A : Bg, flip = Math.random() < 0.5;
        const L = [grp[0][flip ? 1 : 0], grp[1][flip ? 1 : 0]], Rt = [grp[0][flip ? 0 : 1], grp[1][flip ? 0 : 1]];
        const out = S.filter(s => !L.includes(s) && !Rt.includes(s)).sort((a, b) => PRI.indexOf(a) - PRI.indexOf(b));
        const shp = {}, spots = {}, baiter = {};
        const deal = (two, kinds) => { const ks = shuffle(kinds); two.forEach((s, i) => { shp[s] = ks[i]; }); };
        if (odd) {
          deal(L, ['stack', 'cone']); deal(Rt, ['stack', 'spread']);
          for (const s of L) spots[s] = shp[s] === 'stack' ? R(-45, 7) : R(-45, 10.5);
          for (const s of Rt) spots[s] = shp[s] === 'stack' ? r2(add(at(c + 45, 8), at(c + 35, -3.25))) : r2(add(at(c + 45, 8), at(c, 3.5)));
          spots[out[3]] = R(-45, 12.5); spots[out[0]] = R(-45, 3.5); spots[out[1]] = R(27, 3.6); spots[out[2]] = R(33, 3.4);
          baiter[L.find(s => shp[s] === 'cone')] = out[3];
        } else {
          deal(L, ['cone', 'spread']); deal(Rt, ['cone', 'spread']);
          for (const s of L) spots[s] = shp[s] === 'cone' ? r2(add(at(c - 45, 8), at(c - 16, -3.6))) : r2(add(at(c - 45, 8), at(c - 10, 3.5)));
          for (const s of Rt) spots[s] = shp[s] === 'cone' ? r2(add(at(c + 45, 8), at(c + 16, -3.6))) : r2(add(at(c + 45, 8), at(c + 10, 3.5)));
          spots[out[0]] = ring(c + 215, 6.02); spots[out[1]] = ring(c + 145, 6.02); spots[out[2]] = R(-90, 10.25); spots[out[3]] = R(90, 10.25);
          baiter[L.find(s => shp[s] === 'cone')] = out[2];
          baiter[Rt.find(s => shp[s] === 'cone')] = out[3];
        }
        // Where everyone goes: right after the last set's shapes (and, after an even set, the All Things Ending bait).
        const tIn = k ? SH[k - 1] + 0.1 : T[0] - 9.5;
        if (odd && k >= 2) {
          const ai = (k - 2) / 2, ta = tOf(ate[ai], T[k] - 0.3), u = at(c, 1);
          hz({ t: ta, tell: ta - 5, shape: 'half', dir: mul(u, -1), off: -1, dmg: 1.3, name: 'All Things Ending' });
          label(ate[ai], `All Things Ending (${dirName(c + 180)} half: by the towers is safe)`);
          if (futures[ai]) {
            pref(tIn, clumpAt(S, r2(mul(u, -9.25))));
            pref(ta - 4.8, spots);
            call(tIn, 'Future: bait away from the towers, then in', { alert: true, dur: 5 });
          } else {
            pref(tIn, spots);
            call(tIn, 'Past: bait by the towers', { alert: true, dur: 5 });
          }
        } else pref(tIn, spots);
        const tTell = k ? SH[k - 1] : T[0] - 10.2;
        for (const th of [-45, 45]) hz({ t: T[k], tell: tTell, effect: 'tower', shape: 'circle', at: R(th, 8), r: 4, soak: [2, 2], dmg: 0.3, fail: 0.9, name: 'The Path of Light' });
        const SHN = { stack: 'Spelldriver', spread: 'Spellscatter', cone: 'Spellwave' };
        for (const s of L.concat(Rt)) {
          if (shp[s] === 'stack') stack(SH[k], [s], 5, 3, 'Spelldriver', { tell: T[k] });
          else if (shp[s] === 'spread') spreads(SH[k], [s], 5, 'Spellscatter', { tell: T[k] });
          else hz({ t: SH[k], tell: T[k], effect: 'bait', shape: 'cone', from: s, aim: 'target', targets: [baiter[s]], half: 45, r: 40, r0: 1, dmg: 0.9, own: 0.3, name: 'Spellwave' });
          call(tIn, `Tower ${k + 1}: take it (${SHN[shp[s]]}: ${shp[s]})`, { slot: s, alert: true, dur: 4 });
          debuff(s, 'spellsTrouble', 'Spell\'s Trouble', `${shp[s]} once you take tower ${k + 1}`, tIn, SH[k]);
        }
        for (const s of out) call(tIn, Object.values(baiter).includes(s) ? `Tower ${k + 1}: bait a cone` : odd ? `Tower ${k + 1}: help a stack` : `Tower ${k + 1}: bait a clone (inner ring)`, { slot: s, dur: 4 });
        // Future's/Past's End: the boss and clones jump on the four nearest as the even towers come.
        if (odd) {
          const f = fe[k / 2];
          if (f) spreads(f.t, { nearest: 4 }, 5, futures[k / 2] ? 'Future\'s End' : 'Past\'s End', { tell: castOf(f, 6.4) });
        }
      }
      // The last All Things Ending: bait at A; stay (Past) or cross over (Future).
      const last = ate[3], tl = tOf(last, SH[7] + 10.1), fut = futures[3];
      hz({ t: tl, tell: tl - 5, shape: 'half', dir: fut ? [0, 1] : [0, -1], off: -1, dmg: 1.3, name: 'All Things Ending' });
      pref(SH[7] + 0.1, clumpAt(S, [0, 9.25]));
      if (fut) pref(tl - 4.8, clumpAt(S, [0, -9.25]));
      label(last, `All Things Ending (${fut ? 'north' : 'south'} half)`);
      call(SH[7] + 0.1, fut ? 'Bait at A, then cross south' : 'Bait at A, stay', { alert: true, dur: 5 });
      pref(tl + 0.2, UP2);
    }

    // --- Trines (9 / 3 / 9 circles), Wings of Destruction (half room, then near/far busters) ---
    const tr = E('Trine', 445, 460);
    if (tr) {
      const wings = X.events.filter(e => e.name === 'Wings of Destruction' && e.t > tr.t && e.t < tr.t + 25);
      const tw = [1, 2, 3].map(k => tOf(E(`Trine ${k}`, tr.t, tr.t + 20), tr.t + 12.9 + 2 * (k - 1)));
      const wHalf = wings[0], wBust = wings[1], tWH = tOf(wHalf, tr.t + 7.1), tWB = tOf(wBust, tw[2] + 0.3);
      const b = pick([0, 30, 60, 90, 120, 150, 180, 210, 240, 270, 300, 330]), hx = pick([-1, 1]);
      hz({ t: tWH, tell: tWH - 4, shape: 'half', dir: [hx, 0], off: 0, dmg: 1.3, name: 'Wings of Destruction' });
      label(wHalf, `Wings of Destruction (${hx < 0 ? 'west' : 'east'} half)`);
      // A trine: three 6-yalm circles round its point (10 apart), one pointing out.
      const trine = (c, outDeg) => [0, 120, 240].map(d => r2(add(c, at(outDeg + d, 5.77))));
      const waves = [
        [0, 120, 240].flatMap(d => trine(at(b + d, 12), b + d)),
        trine([0, 0], b + 60),
        [60, 180, 300].flatMap(d => trine(at(b + d, 12), b + d)),
      ];
      waves.forEach((w, i) => w.forEach(p => hz({ t: tw[i], tell: tw[i] - 10.7, shape: 'circle', at: p, r: 6, dmg: 1.2, name: 'Trine', react: 3 })));
      const gx = NONTANK.slice(0, 3), gy = NONTANK.slice(3);
      pref(castOf(wHalf || { t: tWH, cast: 4 }, 4) + 0.2, clumpAt(S, [-9 * hx, 0]));
      pref(tWH + 0.1, Object.assign(clumpAt(gx, ring(b + 180, 15)), clumpAt(gy, ring(b + 300, 15)), { OT: ring(b + 60, 15), MT: ring(b + 60, 13.5) }));
      pref(tw[0] + 0.1, Object.assign(clumpAt(gx, ring(b + 120, 15)), clumpAt(gy, ring(b + 240, 15)), { OT: ring(b, 18.8), MT: ring(b + 60, 13.5) }));
      pref(tw[1] + 0.05, { MT: ring(b + 60, 2.5) });
      call(tr.t, 'Trines: start out of the first, then into it', { dur: 5 });
      spreads(tWB, { nearest: 1 }, 7, 'Wings of Destruction', { tell: tw[2] - 4, dmg: 1.2, own: 0.5, buster: true });
      spreads(tWB, { farthest: 1 }, 7, 'Wings of Destruction', { tell: tw[2] - 4, dmg: 1.2, own: 0.5, buster: true });
      label(wBust, 'Wings of Destruction (near and far busters)');
      for (const s of TANKS) call(tw[0], s === 'MT' ? 'Near buster: on the boss' : 'Far buster: the wall', { slot: s, alert: true, dur: 4 });
      pref(tWB + 0.2, UP2);
    }
    X.label(X.events.find(e => e.name === 'Light of Judgment (Enrage)' && e.t > 480 && e.t < 490), 'Light of Judgment (enrage if Forsaken Kefka stands)');
  }

  // ================================================ P3: Chaos and Exdeath ===============================================
  function phase3(X) {
    const { P, st, hz, pref, call, debuff, mark, E, EA, tOf, castOf, label, raid, spreads, stack } = X;
    const aero = E('Aero III Assault', 482, 495);
    P.form.push({ t: 485.9, model: null }, { t: 527, model: 'chaos' }, { t: 841.5, model: 'none' });
    P.names.push({ t: 527, name: 'Chaos' });
    P.hitbox.push({ t: 486, r: 6 });
    P.looks.push({ t: 486.0, show: LOOK.p3 });
    const KEF = [0, 18.5];
    P.others.push({ model: 'main', path: [{ t: 0, at: KEF }], shows: [[527, 841.5]], face: [0, 0] });
    const EXP = [{ t: 0, at: [0, 0] }];
    P.others.push({ model: 'exdeath', path: EXP, shows: [[527, 841.5]] });
    if (aero) {
      pref(480.6, clumpAt(S, [0, 0], { sep: 0.55 }));
      hz({ t: aero.t, tell: castOf(aero, 3), effect: 'knockback', at: [0, 0], dist: 15, name: 'Aero III Assault' });
      call(castOf(aero, 3), 'Knockback from Kefka', { alert: true, dur: 3 });
      const down = E('Down for the Count', aero.t, aero.t + 3);
      if (down) for (const s of S) debuff(s, 'bind', 'Down for the Count', 'on the floor', down.t, down.t + 2);
    }
    label(E('Definition of Insanity', 500, 540), 'Definition of Insanity (Chaos and Exdeath)');
    pref(520, UP2);
    // The Decisive Battle: G1 can only hit Chaos (Epic Hero), G2 Exdeath (Fated Hero).
    for (const db of EA(/^The Decisive Battle$/, 520, 700)) {
      for (const s of S) debuff(s, G1.includes(s) ? 'epicHero' : 'fatedHero', G1.includes(s) ? 'Epic Hero' : 'Fated Hero', G1.includes(s) ? 'hit Chaos' : 'hit Exdeath', db.t, db.t + 38);
      label(db, 'The Decisive Battle (G1 on Chaos, G2 on Exdeath)');
    }
    // Exdeath's Thunder III busters: on the nearest to Exdeath (his tank); everyone else 6 off.
    const tb = (t1, ex, others) => {
      const t2 = tOf(E('Thunder III 2', t1, t1 + 4), t1 + 3);
      const ot = r2(add(ex, mul(unit(ex[0] || ex[1] ? ex : [0, -1]), 3.5)));
      pref(t1 - 4.8, Object.assign({ OT: ot }, place(S.filter(s => s !== 'OT').map(s => [s, others[s], 0.7]), { keep: [ot], keepSep: 6.2 })));
      for (const t of [t1, t2]) spreads(t, { nearest: 1, of: 'exdeath' }, 5, 'Thunder III', { tell: t1 - 5, dmg: 1.1, own: 0.45, buster: true });
      call(t1 - 5, 'Exdeath tank buster x2: OT', { dur: 4 });
    };

    // --- Bowels of Agony: crystals, Entropy / Dynamic Fluid, Thunder III, Implosions ---
    const boa = E('Bowels of Agony', 540, 560);
    const wb = pick([0, 45, 90, 135, 180, 225, 270, 315]), CR = { wind: ring(wb, 19), fire: ring(wb + 135, 19), water: ring(wb - 135, 19) };
    if (boa) {
      raid(boa, 0.5, 5);
      const short = pick(['fire', 'water']), long = short === 'fire' ? 'water' : 'fire';
      const sup = shuffle(SUP), mel = shuffle(MELEE);
      const ent = [sup[0], mel[0]], flu = [sup[1], mel[1]];
      const tS = tOf(X.events.find(e => /^Stray (Flames|Spray)\/Stray (Flames|Spray)$/.test(e.name) && e.t > boa.t && e.t < boa.t + 25), boa.t + 19.1);
      const tL = tOf(X.events.find(e => /^Stray (Flames|Spray)\/Stray (Flames|Spray)$/.test(e.name) && e.t > tS + 5 && e.t < tS + 40), tS + 27);
      const cyc = EA(/^Cyclone$/, boa.t, boa.t + 70), thu = E('Thunder III', boa.t, boa.t + 25);
      for (const s of S) debuff(s, Math.random() < 0.5 ? 'headwind' : 'tailwind', 'Headwind/Tailwind', 'face away from / toward the knockbacks', boa.t, 621);
      const tOfEl = (el) => (el === short ? tS : tL);
      for (const s of ent) debuff(s, 'entropy', 'Entropy', 'fire: your light party shares it', boa.t + 1, tOfEl('fire'));
      for (const s of flu) debuff(s, 'dynamicFluid', 'Dynamic Fluid', 'water: a donut round you, stack inside', boa.t + 1, tOfEl('water'));
      label(boa, `Bowels of Agony (wind crystal ${dirName(wb)}, short ${short})`);
      // Exdeath in the middle (his Thunder III: 14.8 round him), Chaos dragged to the wind crystal.
      EXP.push({ t: 529.5, at: [0, 0] });
      P.boss.push({ t: 527, at: ring(wb, 10) }, { t: 575, at: [0, 0], move: 3 });
      // An element's resolution: the six at the wind crystal (fire: supports and melee apart; water: one stack),
      // the ranged at that element's crystal.
      const resolve = (el, t, r6) => {
        const spots = {};
        const half = Math.asin(4.25 / r6) * 180 / Math.PI;
        if (el === 'fire') Object.assign(spots, clumpAt(SUP, ring(wb - half, r6)), clumpAt(MELEE, ring(wb + half, r6)));
        else Object.assign(spots, clumpAt(SUP.concat(MELEE), ring(wb, r6)));
        const cr = el === 'fire' ? wb + 135 : wb - 135, sp = el === 'fire' ? 18 : 10;
        spots.R1 = ring(cr - sp, 18.5); spots.R2 = ring(cr + sp, 18.5);
        if (el === 'fire') {
          stack(t, [ent[0]], 5, 1, 'Stray Flames', { tell: t - 5, max: 4 });
          stack(t, [ent[1]], 5, 1, 'Stray Flames', { tell: t - 5, max: 2 });
          hz({ t: t + 1, tell: t - 4, effect: 'bait', shape: 'donut', from: 'target', targets: { nearest: 2, of: CR.fire }, r0: 4, r1: 10, dmg: 0.9, own: 0.3, name: 'Inferno' });
        } else {
          for (const s of flu) hz({ t, tell: t - 5, shape: 'donut', from: 'target', targets: [s], r0: 4, r1: 10, dmg: 0.9, name: 'Stray Spray' });
          spreads(t + 1, { nearest: 2, of: CR.water }, 5, 'Tsunami', { tell: t - 4 });
        }
        return spots;
      };
      pref(boa.t + 0.2, resolve(short, tS, 17));
      call(boa.t + 0.2, `Short ${short}: ${short === 'fire' ? 'supports and melee apart' : 'stack'} at the wind crystal; ranged to the ${short} crystal`, { alert: true, dur: 6 });
      if (thu) hz({ t: thu.t, tell: castOf(thu, 7), shape: 'circle', at: [0, 0], r: 14.8, dmg: 1.4, name: 'Thunder III' });
      if (cyc[0]) stack(cyc[0].t, { nearest: 1, of: CR.wind }, 6, 2, 'Cyclone', { tell: tS, max: 8 });
      // Exdeath's busters, then the Implosions round Chaos (in the middle): two cones and two, near the intercards.
      const t1 = tOf(E('Thunder III 1', tS, tS + 15), tS + 9.3);
      EXP.push({ t: tS + 3, at: ring(wb, 11), move: 2 });
      tb(t1, ring(wb, 11), Object.fromEntries(S.map(s => [s, ring(wb + 135 + 45 * S.indexOf(s), 9)])));
      const ll = X.events.find(e => e.name === 'Longitudinal Implosion/Latitudinal Implosion (castbar)' && e.t > t1 && e.t < t1 + 20);
      if (ll) {
        const sw = EA(/^Shockwave [12]$/, ll.t, ll.t + 4), longi = Math.random() < 0.5, f = wb + 135;
        P.face.push({ t: castOf(ll, 5) - 0.5, deg: f }, { t: tOf(sw[1], ll.t + 2.8) + 0.5, deg: null });
        const first = longi ? [f, f + 180] : [f + 90, f + 270], second = longi ? [f + 90, f + 270] : [f, f + 180];
        [first, second].forEach((ds, i) => ds.forEach(d => hz({ t: tOf(sw[i], ll.t + 0.8 + 2 * i), tell: castOf(ll, 5), shape: 'cone', at: [0, 0], deg: d, half: 45, r: 40, dmg: 1.3, name: 'Shockwave', react: 2.5 })));
        label(ll, longi ? 'Longitudinal Implosion (front/back first)' : 'Latitudinal Implosion (sides first)');
        const lc = long === 'fire' ? wb + 135 : wb - 135, lsp = long === 'fire' ? 18 : 10;
        const side = Object.assign(clumpAt(SUP.concat(MELEE), ring(wb, 9), { sep: 0.7 }), { R1: ring(lc - lsp, 18.5), R2: ring(lc + lsp, 18.5) });
        pref(t1 + 3.2, side);
        call(castOf(ll, 5), longi ? 'Sides first, then front/back' : 'Front/back first, then sides', { alert: true, dur: 5 });
        pref(tOf(sw[1], ll.t + 2.8) + 0.05, resolve(long, tL, 10));
        if (cyc[1]) stack(cyc[1].t, { nearest: 1, of: CR.wind }, 6, 2, 'Cyclone', { tell: tL, max: 8 });
        pref(tL + 1.2, clumpAt(S.filter(s => s !== 'R1'), ring(wb, 13)));
      }
      for (const [k, c] of Object.entries(CR)) mark({ shape: 'circle', at: c, r: 1.6 }, boa.t, tL + 3, { wind: 'rgba(120,255,160,0.5)', fire: 'rgba(255,120,60,0.5)', water: 'rgba(80,160,255,0.5)' }[k]);
    }

    // --- Umbra Smash (on the farthest), Vacuum Wave, the Ultima Blaster clones (limit cut) ---
    const um = E('Umbra Smash', 600, 625), vw = E('Vacuum Wave', 600, 630);
    if (um && vw) {
      const exAt = ring(wb, 15), jumpAt = ring(wb + 180, 17);
      EXP.push({ t: castOf(um, 5) - 4, at: exAt, move: 2 });
      pref(castOf(um, 5) - 3.5, Object.assign(clumpAt(S.filter(s => s !== 'R1'), ring(wb, 12.5)), { R1: jumpAt }));
      pref(castOf(um, 5) + 0.1, clumpAt(S, ring(wb, 12.5)));
      spreads(um.t, { farthest: 1, of: 'boss' }, 20, 'Umbra Smash', { tell: castOf(um, 5), snap: 5, falloff: 20, own: 0.4 });
      P.boss.push({ t: um.t - 0.4, at: [0, 0] }, { t: um.t, at: jumpAt }, { t: um.t + 6, at: [0, 0], move: 3 });
      call(castOf(um, 5) - 3.5, 'R1: bait the jump opposite the wind crystal', { slot: 'R1', alert: true, dur: 4 });
      hz({ t: vw.t, tell: castOf(vw, 8), effect: 'knockback', at: exAt, dist: 10, name: 'Vacuum Wave' });
      call(castOf(vw, 8), 'Stack in front of Exdeath: knockback', { dur: 5 });
      for (const e of EA(/^Ultima Blaster [1-8]$/, um.t - 6, vw.t + 8)) hz({ t: e.t, tell: e.t - 1, raidwide: true, dmg: 0.06, name: 'Ultima Blaster' });
      // Limit cut: Kefka's clones on the rim 45 degrees apart; number n charges from the n-th; each stands across
      // from their clone, on the inter-intercardinals.
      const c0 = pick([0, 45, 90, 135, 180, 225, 270, 315]), rot = pick([1, -1]);
      const charges = X.events.filter(e => /^Ultima Blaster [1-8]$/.test(e.name) && e.t > vw.t + 10 && e.t < vw.t + 20);
      const order = shuffle(S), numAt = X.events.find(e => e.t > vw.t && e.t < vw.t + 6 && e.name === 'Cyclone');
      const tNum = vw.t + 2.7;
      order.forEach((s, n) => {
        const clone = ring(c0 + 45 * rot * n, 20), spot = ring(c0 + 45 * rot * n + 180 - 22.5 * rot, 16);
        const tc = tOf(charges[n], vw.t + 14.8 + 0.2 * n);
        hz({ t: tc, tell: tNum, effect: 'bait', shape: 'line', from: clone, aim: 'target', targets: [s], len: 100, w: 6, dmg: 0.9, own: 0.3, name: 'Ultima Blaster' });
        P.others.push({ model: 'main', path: [{ t: 0, at: clone }], shows: [[um.t - 4 + 2 * n, tc + 0.4]], face: [0, 0] });
        call(tNum, `Limit cut #${n + 1}: across from its clone`, { slot: s, alert: true, dur: 5 });
        X.P.prefs.push({ t: vw.t + 0.6, spots: { [s]: spot } });
      });
      label(numAt, 'Cyclone (limit cut numbers out)');
      pref(tOf(charges[7], vw.t + 16.2) + 0.3, UP2);
      // Exdeath's busters again (Decisive Battle between).
      const t2 = E('Thunder III 1', vw.t + 18, vw.t + 25), t3 = E('Thunder III 1', vw.t + 35, vw.t + 42);
      EXP.push({ t: vw.t + 16, at: [0, -6], move: 2 });
      const base = { MT: [0, 6.5], OT: [0, -9.5], H1: [-9, -4], H2: [9, -4], M1: [-5, 2], M2: [5, 2], R1: [-12, 3], R2: [12, 3] };
      if (t2) tb(t2.t, [0, -6], base);
      if (t3) tb(t3.t, [0, -6], base);
    }

    // --- Earthquake: Kefka giant at the north; the black holes' lasers, hands, Edicts, Look upon Me ---
    const eq = E('Earthquake', 650, 670);
    if (eq) {
      raid(eq, 0.45, 5);
      label(E('Max', 650, 665), 'Max (Kefka grows: relative north)');
      for (const e of X.events.filter(x => (/^Accretion Earthquake \d$/.test(x.name) || x.name === 'Primordial Crust Quake') && x.t > eq.t && x.t < 800)) hz({ t: e.t, tell: e.t - 1, raidwide: true, dmg: 0.08, name: e.name.replace(/ \d$/, '') });
      const order = shuffle(S);
      order.forEach((s, i) => {
        debuff(s, 'primordialCrust', 'Primordial Crust', 'cleansed by the lasers', eq.t, eq.t + 72);
        debuff(s, i < 3 ? 'firstInLine' : i < 6 ? 'secondInLine' : 'thirdInLine', ['First', 'Second', 'Third'][i < 3 ? 0 : i < 6 ? 1 : 2] + ' in Line', 'your laser round', eq.t, eq.t + 30);
      });
      for (const s of [pick(HEALERS), pick(DPS)]) debuff(s, 'accretion', 'Accretion', 'healed to full by the healers', eq.t, eq.t + 25);
      EXP.push({ t: eq.t, at: [0, -6] });
      P.face.push({ t: eq.t + 5, deg: 0 });
      // Each moment: the shapes that land then and the duties (spots some must hold); everyone else stands clear.
      const BASE = { MT: [0, 6.5], OT: [0, -9.5], H1: [-9, -6], H2: [9, -6], M1: [-5, -2.5], M2: [5, -2.5], R1: [-12, 1], R2: [12, 1] };
      const moments = [];
      // White Hole: everyone full; then the Implosions round Chaos (facing north) with the third Slap Happy: the two
      // waves dodged first, the hand's spots after.
      const wh = E('White Hole', eq.t, 800);
      label(wh, 'White Hole (everyone at full HP)');
      const ll2 = X.events.find(e => e.name === 'Longitudinal Implosion/Latitudinal Implosion (castbar)' && e.t > eq.t && e.t < 800);
      let llT = null, llC = null;
      if (ll2) {
        const sw = EA(/^Shockwave [12]$/, ll2.t, ll2.t + 4), longi = Math.random() < 0.5, f = 0;
        const first = longi ? [f, f + 180] : [f + 90, f + 270], second = longi ? [f + 90, f + 270] : [f, f + 180];
        llT = [tOf(sw[0], ll2.t + 0.8), tOf(sw[1], ll2.t + 2.8)];
        llC = [first, second].map((ds, i) => ds.map(d => ({ shape: 'cone', at: [0, 0], deg: d, half: 45, r: 40 })));
        llC.forEach((cs, i) => cs.forEach(c => hz(Object.assign({ t: llT[i], tell: castOf(ll2, 5), dmg: 1.3, name: 'Shockwave', react: 2.5 }, c))));
        label(ll2, longi ? 'Longitudinal Implosion (front/back first)' : 'Latitudinal Implosion (sides first)');
        call(castOf(ll2, 5), longi ? 'Implosion: sides first, then front/back' : 'Implosion: front/back first, then sides', { alert: true, dur: 5 });
      }
      // Slap Happy: three 13-yalm slams down one side (west with the right hand: party stack; east with the left:
      // role cones), then the middle; the party or roles in 60-degree cones from the middle.
      for (const cb of X.events.filter(e => e.name === 'Slap Happy (castbar)' && e.t > eq.t && e.t < 800)) {
        const hits = [1, 2, 3, 4].map(k => tOf(E(`Slap Happy ${k}`, cb.t, cb.t + 5), cb.t + [0.8, 1.6, 2.3, 3.3][k - 1]));
        const sw = X.events.find(e => e.name === 'Shocking Impact/Shockwave' && e.t >= cb.t && e.t < cb.t + 5), tS = tOf(sw, hits[3]);
        const party = Math.random() < 0.5, sx = party ? -1 : 1;
        const big = [[10 * sx, 10], [10 * sx, 0], [10 * sx, -10]];
        big.forEach((c, i) => hz({ t: hits[i], tell: castOf(cb, 5), shape: 'circle', at: c, r: 13, dmg: 1.3, name: 'Slap Happy' }));
        hz({ t: hits[3], tell: castOf(cb, 5), shape: 'circle', at: [0, 0], r: 6, dmg: 1.3, name: 'Slap Happy' });
        let duty;
        if (party) {
          duty = clumpAt(S, ring(90, 9.5));
          stack(tS, [pick(NONTANK)], 40, 8, 'Shocking Impact', { tell: castOf(cb, 5), shape: 'cone', from: [0, 0], aim: 'target', half: 30 });
        } else {
          duty = Object.assign(clumpAt(TANKS, ring(330, 10)), clumpAt(HEALERS, ring(270, 10)), clumpAt(DPS, ring(210, 10)));
          for (const [grp, n] of [[TANKS, 2], [HEALERS, 2], [DPS, 4]]) stack(tS, [pick(grp)], 40, n, 'Shockwave', { tell: castOf(cb, 5), shape: 'cone', from: [0, 0], aim: 'target', half: 30 });
        }
        label(cb, party ? 'Slap Happy (right hand: west slams, party stack east)' : 'Slap Happy (left hand: east slams, role cones west)');
        label(sw, party ? 'Shocking Impact' : 'Shockwave');
        call(castOf(cb, 5), party ? 'West unsafe: party stack east' : 'East unsafe: role cones west (tanks front, healers mid, DPS back)', { alert: true, dur: 5 });
        const slams = big.map((c, i) => ({ t: hits[i], shape: { shape: 'circle', at: c, r: 13 } }));
        if (llT && llT[0] > castOf(cb, 5) - 3 && llT[1] < tS) {
          const by = (a, b) => slams.filter(x => x.t > a && x.t <= b + 0.6).map(x => x.shape);
          moments.push({ t: castOf(cb, 5) + 0.2, end: llT[0], duty: {}, anchors: duty, shapes: llC[0].concat(by(0, llT[0])) });
          moments.push({ t: llT[0] + 0.05, end: llT[1], duty: {}, anchors: duty, shapes: llC[1].concat(by(llT[0], llT[1])) });
          moments.push({ t: llT[1] + 0.1, end: tS, duty, shapes: [] });
        } else moments.push({ t: castOf(cb, 5) + 0.2, end: tS, duty, shapes: [] });
      }
      // The black holes: on the rim (the first, a quarter round counter-clockwise, then across); each fires its
      // laser (6 wide) at its tethered player, who stands clockwise of it so it runs along the edge.
      const h0 = pick([0, 45, 90, 135, 180, 225, 270, 315]), HB = [h0, h0 - 90, h0 + 180], HOLE = HB.map(d => ring(d, 18.5));
      const shots = EA(/^Nothingness$/, eq.t, 800), PAT = [1, 2, 3, 3, 3, 3, 3, 3, 2, 1];
      const queue = st.holes.slice();
      let qi = 0;
      shots.forEach((e, i) => {
        const n = PAT[i] || 1, duty = {}, shapes = [], used = [];
        for (let j = 0; j < n; j++) {
          let s = queue[qi % 8];
          while (used.includes(s)) s = queue[++qi % 8];
          qi++;
          used.push(s);
          const spot = ring(HB[j] + 25, 17.5);
          duty[s] = spot;
          shapes.push({ shape: 'line', at: HOLE[j], deg: brg(sub(spot, HOLE[j])), len: 40, w: 6 });
          hz({ t: e.t, tell: e.t - 7, effect: 'bait', shape: 'line', from: HOLE[j], aim: 'target', targets: [s], len: 40, w: 6, dmg: 0.9, own: 0.25, tether: HOLE[j], name: 'Nothingness' });
          call(e.t - 7, `Black hole tether: point it clockwise along the edge (${dirName(HB[j] + 25)})`, { slot: s, alert: true, dur: 4 });
        }
        moments.push({ t: i ? Math.max(e.t - 6.8, shots[i - 1].t + 0.15) : e.t - 6.8, end: e.t, duty, shapes });
      });
      HOLE.forEach((p, j) => {
        const first = shots[j === 0 ? 0 : j === 1 ? 1 : 2];
        if (first) mark({ shape: 'circle', at: p, r: 2 }, first.t - 7.5, 795, 'rgba(60,0,90,0.75)');
      });
      // Chaos' Damning Edict (the north half) and Kefka's Look upon Me and Despair (a 16-wide band down the middle).
      for (const de of EA(/^Damning Edict$/, eq.t, 800)) {
        const sh = { shape: 'line', at: [0, 0], deg: 0, len: 60, w: 80 };
        hz(Object.assign({ t: de.t, tell: castOf(de, 5), dmg: 1.3, name: 'Damning Edict' }, sh));
        moments.push({ t: castOf(de, 5) + 0.2, end: de.t, duty: {}, shapes: [sh] });
      }
      for (const lu of EA(/^Look upon Me and Despair$/, eq.t, 800)) {
        const sh = { shape: 'rect', a: [-8, -22], b: [8, 22] };
        hz(Object.assign({ t: lu.t, tell: castOf(lu, 5), dmg: 1.3, name: 'Look upon Me and Despair' }, sh));
        moments.push({ t: castOf(lu, 5) + 0.2, end: lu.t, duty: {}, shapes: [sh] });
      }
      // Exdeath's busters in the stretch (OT at Exdeath, south).
      for (const t1e of EA(/^Thunder III 1$/, eq.t + 10, 800)) {
        const t2 = tOf(E('Thunder III 2', t1e.t, t1e.t + 4), t1e.t + 3);
        for (const t of [t1e.t, t2]) spreads(t, { nearest: 1, of: 'exdeath' }, 5, 'Thunder III', { tell: t1e.t - 5, dmg: 1.1, own: 0.45, buster: true });
        moments.push({ t: t1e.t - 4.8, end: t2, duty: { OT: [0, -9.5] }, shapes: [{ shape: 'circle', at: [0, -9.5], r: 5.7 }] });
      }
      // Lay the moments out: at each start and end, the duties of every moment then running (the one ending first
      // wins a player with two) and everyone else clear of all their shapes still to land.
      const marks = [...new Set(moments.flatMap(m => [m.t, m.end + 0.1]))].sort((a, b) => a - b);
      for (const T of marks) {
        const live = moments.filter(m => m.t <= T + 1e-6 && T < m.end + 0.05).sort((a, b) => a.end - b.end);
        const duty = {}, shapes = [];
        for (const m of live) {
          for (const [s, p] of Object.entries(m.duty)) if (!duty[s]) duty[s] = p;
          shapes.push(...m.shapes);
        }
        const free = S.filter(s => !duty[s]), anc = (live.find(m => m.anchors) || {}).anchors || BASE;
        pref(T, Object.assign({}, duty, place(free.map(s => [s, anc[s] || BASE[s], 0.8]), { avoid: shapes, m: 1.5, keep: Object.values(duty), keepSep: 1.2 })));
      }
    }

    // --- Stomp-a-Mole: Blizzard puddles (two baits), Kefka's towers west and east (two each), Knock Down stacks,
    // Deep Freeze, Big Bang where the stacks were ---
    const bz = E('Blizzard III (castbar)', 790, 810), sam = E('Stomp-a-Mole (castbar)', 790, 815);
    if (bz && sam) {
      const b1 = tOf(E('Blizzard III 1', bz.t, bz.t + 5), bz.t + 3.1), b2 = tOf(E('Blizzard III 2', bz.t, bz.t + 8), b1 + 3);
      const st4 = [1, 2, 3, 4].map(k => tOf(E(`Stomp-a-Mole ${k}`, sam.t, sam.t + 8), sam.t + 1.6 + 1.3 * (k - 1)));
      const kd1 = tOf(E('Knock Down 1', sam.t, sam.t + 4), st4[0]), kd2 = tOf(E('Knock Down 2', sam.t, sam.t + 10), st4[3] + 1.6);
      const bb = E('Big Bang', kd2, kd2 + 8), frz = E('Blizzard III', kd2, kd2 + 6);
      const TW = [[-10, 10], [10, 10]];
      const roleA = pick([SUP, DPS]), roleB = roleA === SUP ? DPS : SUP;
      const half = (g) => [g.filter(s => G1.includes(s)), g.filter(s => G2.includes(s))];
      const [aW, aE] = half(roleA), [bW, bE] = half(roleB);
      // The puddles: each bait under everyone (6 yalms), dropped 3 s before it lands.
      pref(bz.t - 2.8, Object.assign(clumpAt(SUP, [0, 6]), clumpAt(DPS, [0, -6])));
      for (const t of [b1, b2]) hz({ t, tell: t - 3, shape: 'circle', from: 'target', targets: S, snap: 3, r: 6, dmg: 0.9, name: 'Blizzard III' });
      pref(b1 - 2.9, Object.assign(clumpAt(bW, [-14, 0]), clumpAt(bE, [14, 0]), clumpAt(aW, [-7, -12]), clumpAt(aE, [7, -12])));
      // Then: role A stacks in the middle (Knock Down), role B soaks the first two stomps; then they swap.
      const k1 = pick(roleA), k2 = pick(roleB);
      pref(b2 - 2.9, Object.assign(clumpAt(roleA, [0, -1]), clumpAt(bW, TW[0]), clumpAt(bE, TW[1])));
      stack(kd1, [k1], 6, 4, 'Knock Down', { tell: b2 - 3 });
      hz({ t: st4[0], tell: sam.t - 5, effect: 'tower', shape: 'circle', at: TW[0], r: 5, soak: [2, 2], only: bW, dmg: 0.3, fail: 0.9, name: 'Stomp-a-Mole' });
      hz({ t: st4[1], tell: sam.t - 5, effect: 'tower', shape: 'circle', at: TW[1], r: 5, soak: [2, 2], only: bE, dmg: 0.3, fail: 0.9, name: 'Stomp-a-Mole' });
      pref(kd1 + 0.05, Object.assign(clumpAt(aW, TW[0]), clumpAt(aE, TW[1])));
      pref(st4[1] + 0.05, clumpAt(roleB, [0, -1]));
      hz({ t: st4[2], tell: st4[0], effect: 'tower', shape: 'circle', at: TW[0], r: 5, soak: [2, 2], only: aW, dmg: 0.3, fail: 0.9, name: 'Stomp-a-Mole' });
      hz({ t: st4[3], tell: st4[1], effect: 'tower', shape: 'circle', at: TW[1], r: 5, soak: [2, 2], only: aE, dmg: 0.3, fail: 0.9, name: 'Stomp-a-Mole' });
      stack(kd2, [k2], 6, 4, 'Knock Down', { tell: st4[1] });
      call(bz.t - 2.8, `Supports north, DPS south; ${roleA === SUP ? 'supports' : 'DPS'} stack first`, { alert: true, dur: 5 });
      // Big Bang where both stacks went off; everyone out of the middle.
      if (bb) hz({ t: bb.t, tell: kd2, shape: 'circle', at: [0, -1], r: 6, dmg: 1.2, name: 'Big Bang' });
      pref(kd2 + 0.1, Object.fromEntries(S.map((s, i) => [s, ring(i * 45 + 22.5, 11)])));
      label(frz, 'Blizzard III (Deep Freeze: keep moving)');
      call(kd2 + 0.1, 'Keep moving! Out of the middle', { alert: true, dur: 4 });
    }
    for (const ev of X.events) {
      if (/^(Bowels of Agony|Meteor) \((Chaos |Exdeath )?Enrage\)$/.test(ev.name)) label(ev, `${ev.name.split(' (')[0]} (enrage if ${ev.name.startsWith('Meteor') ? 'Exdeath' : 'Chaos'} stands)`);
    }
  }

  // ================================================== P4: Kefka Says ===================================================
  function phase4(X) {
    const { P, hz, pref, call, debuff, E, EA, tOf, castOf, label, raid, spreads, stack } = X;
    const ks = E('Kefka Says', 960, 1000);
    if (!ks) return;
    const t0 = ks.t;
    P.form.push({ t: castOf(ks, 5) - 10, model: null }, { t: 1116, model: 'none' });
    P.names.push({ t: castOf(ks, 5) - 10, name: 'Kefka' });
    P.hitbox.push({ t: castOf(ks, 5) - 10, r: 6 });
    P.boss.push({ t: castOf(ks, 5) - 10, at: [0, 0] });
    P.looks.push({ t: castOf(ks, 5) - 12, show: LOOK.p4 });
    P.face.push({ t: castOf(ks, 5) - 10, deg: null });
    // Chaos beside him (Neo Exdeath's model is left out of the map for its size).
    P.others.push({ model: 'chaos', path: [{ t: 0, at: [-25, 4] }], shows: [[castOf(ks, 5) - 10, 1116]], face: [0, 0] });
    pref(castOf(ks, 5) - 9, UP1);
    label(ks, 'Kefka Says (Chaos and Neo Exdeath: true or false)');
    for (const e of X.events.filter(x => x.t > t0 && x.t < 1116)) {
      if (e.name === 'Grand Cross') raid(e, 0.4, 9);
      else if (/^(Inferno\/Tsunami|Tsunami\/Inferno)$/.test(e.name)) raid(e, 0.35, 9);
      else if (e.name === 'Death Surge' || e.name === 'Ultima Upsurge') hz({ t: e.t, tell: e.cast ? castOf(e) : e.t - 2, raidwide: true, dmg: e.name === 'Death Surge' ? 0.25 : 0.4, name: e.name });
    }
    // Mystery Magic: ice + lightning, true or false each.
    const magic = (ev, iceOnly) => {
      const safe = pick(['NWSE', 'NESW']), axis = pick(['NS', 'EW']), thReal = Math.random() < 0.5, iceReal = Math.random() < 0.5;
      const shapes = iceCones(safe).concat(iceOnly ? [] : thunderRects(axis, thReal));
      shapes.forEach(c => hz(Object.assign({ t: ev.t, tell: castOf(ev, 5), dmg: 1.2, name: c.shape === 'cone' ? 'Blizzard III Blowout' : 'Thrumming Thunder III' }, c)));
      label(ev, `Mystery Magic (${iceReal ? 'true' : 'fake'} ice ${safe === 'NWSE' ? 'NW/SE' : 'NE/SW'} safe${iceOnly ? '' : `, ${thReal ? 'true' : 'fake'} lightning ${axis === 'NS' ? 'north-south' : 'east-west'}`})`);
      return { shapes, safe, axis, thReal };
    };
    for (const k of [1, 2, 3]) {
      const mm = E(`Mystery Magic ${k}`, t0, t0 + 50);
      if (!mm) continue;
      const m = magic(mm);
      pref(castOf(mm, 5) + 0.2, place(S.map(s => [s, UP1[s], 0.7]), { avoid: m.shapes, m: 1.5 }));
      call(castOf(mm, 5), `${m.thReal ? 'Out of the lines' : 'In a line'} + ${m.safe === 'NWSE' ? 'NW/SE' : 'NE/SW'}`, { alert: true, dur: 5 });
    }
    // The debuffs (Neo Exdeath: lightning / water, shriek, bombs; Chaos: entropy / fluid), short and long.
    const sup = shuffle(SUP), dps = shuffle(DPS);
    const set = (i) => ({ light: [sup[i], dps[i]], water: [sup[i + 2], dps[i + 2]] });
    const short = set(0), long = set(1), shriek = [[sup[2], dps[2]], [sup[3], dps[3]]];
    const gc = EA(/^Grand Cross$/, t0, t0 + 50);
    const db1 = E('Death Bolt', t0, t0 + 80), db2 = E('Death Bolt', tOf(db1, t0 + 64) + 5, t0 + 110);
    const sh1 = E('Death Shriek', t0, t0 + 80), sh2 = E('Death Shriek', tOf(sh1, t0 + 73) + 5, t0 + 110);
    const tD1 = tOf(db1, t0 + 64.5), tD2 = tOf(db2, t0 + 89.4);
    for (const s of S) {
      const sl = short.light.includes(s) || long.light.includes(s), lt = short.light.includes(s) || short.water.includes(s) ? tD1 : tD2;
      if (sl || short.water.includes(s) || long.water.includes(s)) debuff(s, sl ? 'forkedLightning' : 'compressedWater', sl ? 'Forked Lightning' : 'Compressed Water', sl ? 'spread (8), or stack if false' : 'stack (8), or spread if false', tOf(gc[0], t0 + 14), lt);
      debuff(s, 'accelerationBomb', 'Acceleration Bomb', 'stop moving as it ends (true) or keep moving (false)', tOf(gc[1], t0 + 29), Math.random() < 0.5 ? tD1 : tD2);
    }
    // Death Bolt / Wave: each role's spread holder out (supports west, DPS east), its stack holder with the other two
    // (supports north, DPS south). The second time the ice follows straight after: the spots sit in its safe quadrants.
    const deaths = (t, s, real, quad) => {
      const sp = { sup: real ? s.light[0] : s.water[0], dps: real ? s.light[1] : s.water[1] };
      const stk = { sup: real ? s.water[0] : s.light[0], dps: real ? s.water[1] : s.light[1] };
      const Q = quad === 'NWSE' ? { sN: 330, sW: 290, dS: 150, dE: 110 } : quad === 'NESW' ? { sN: 30, sW: 250, dS: 210, dE: 70 } : { sN: 0, sW: 270, dS: 180, dE: 90 };
      const spots = Object.assign({ [sp.sup]: ring(Q.sW, 16), [sp.dps]: ring(Q.dE, 16) },
        clumpAt(SUP.filter(x => x !== sp.sup), ring(Q.sN, 12)), clumpAt(DPS.filter(x => x !== sp.dps), ring(Q.dS, 12)));
      spreads(t, [sp.sup, sp.dps], 8, real ? 'Death Bolt' : 'Death Wave', { tell: t - 8 });
      stack(t, [stk.sup], 8, 3, real ? 'Death Wave' : 'Death Bolt', { tell: t - 8 });
      stack(t, [stk.dps], 8, 3, real ? 'Death Wave' : 'Death Bolt', { tell: t - 8 });
      return spots;
    };
    // Flood of Naught: Antilight on each half (west and east); each player has their colour (Allagan Field: the
    // other one, Beyond Death: the same), resolved to a half; Edge of Death down the middle.
    const fon = E('Flood of Naught', t0, t0 + 70);
    if (fon) {
      const west = shuffle(SUP).slice(0, 2).concat(shuffle(DPS).slice(0, 2)), east = S.filter(s => !west.includes(s));
      const ta = tOf(E('White Antilight', fon.t, fon.t + 2), fon.t + 0.4), whiteW = Math.random() < 0.5, real = Math.random() < 0.5;
      hz({ t: ta, tell: castOf(fon, 5), effect: 'tower', shape: 'rect', a: [-21, -21], b: [-1, 21], soak: [1, 8], only: west, dmg: 0.25, fail: 0.9, name: whiteW ? 'White Antilight' : 'Black Antilight' });
      hz({ t: ta, tell: castOf(fon, 5), effect: 'tower', shape: 'rect', a: [1, -21], b: [21, 21], soak: [1, 8], only: east, dmg: 0.25, fail: 0.9, name: whiteW ? 'Black Antilight' : 'White Antilight' });
      hz({ t: ta, tell: castOf(fon, 5), shape: 'rect', a: [-1, -21], b: [1, 21], dmg: 1.3, name: 'Edge of Death' });
      for (const s of S) {
        const w = west.includes(s), allagan = Math.random() < 0.5;
        debuff(s, allagan ? 'allaganField' : 'beyondDeath', allagan ? 'Allagan Field' : 'Beyond Death', `${allagan ? 'opposite' : 'same'} colour: the ${w ? 'west' : 'east'} half`, tOf(gc[2], t0 + 43.6), ta);
      }
      pref(castOf(fon, 5) + 0.2, Object.assign(place(west.map(s => [s, [-9, 0], 0.8])), place(east.map(s => [s, [9, 0], 0.8]))));
      label(fon, `Flood of Naught (${real ? 'true' : 'false'}: ${whiteW ? 'white west' : 'black west'})`);
      call(castOf(fon, 5), 'Colours: stand in your half', { alert: true, dur: 5 });
    }
    // Short debuffs, then the first shriek with the lightning.
    const real1 = Math.random() < 0.5, real2 = Math.random() < 0.5;
    pref(tD1 - 8, deaths(tD1, short, real1));
    label(db1, real1 ? 'Death Bolt / Death Wave (true: lightning spreads, water stacks)' : 'Death Bolt / Death Wave (false: lightning stacks, water spreads)');
    call(tD1 - 8, 'Stacks: supports N, DPS S; spreads: supports W, DPS E', { alert: true, dur: 6 });
    const shrieks = (ev, who, th) => {
      if (!ev) return;
      const real = Math.random() < 0.5;
      const spots = Object.assign(place(who.map((s, i) => [s, [i ? 2.5 : -2.5, 0], 4]), { avoid: th, m: 1.4 }),
        place(S.filter(s => !who.includes(s)).map((s, i) => [s, ring(150 + 12 * i, 12), 0.8]), { avoid: th, m: 1.4, keep: [], keepSep: 0 }));
      pref(ev.t - 6, spots);
      for (const s of who) debuff(s, 'cursedShriek', 'Cursed Shriek', real ? 'everyone looks away from you' : 'everyone looks at you', ev.t - 20, ev.t);
      if (real) hz({ t: ev.t, tell: ev.t - 6, effect: 'gaze', from: 'target', targets: who, dmg: 0.9, status: ['petrification', 4], name: 'Death Shriek' });
      label(ev, real ? 'Death Shriek (look away)' : 'Death Shriek (false: look at them)');
      call(ev.t - 6, real ? 'Shrieks in the middle: party out south, look away' : 'False shrieks: look at them', { alert: true, dur: 5 });
    };
    const tt1 = E('Thrumming Thunder III', tD1, tD1 + 10);
    let th1 = [];
    if (tt1) {
      const axis = pick(['NS', 'EW']), rl = Math.random() < 0.5;
      th1 = thunderRects(axis, rl);
      th1.forEach(c => hz(Object.assign({ t: tt1.t, tell: castOf(tt1, 5), dmg: 1.2, name: 'Thrumming Thunder III' }, c)));
      label(tt1, `Thrumming Thunder III (${rl ? 'true' : 'false'}, ${axis === 'NS' ? 'north-south' : 'east-west'})`);
    }
    shrieks(sh1, shriek[0], th1);
    // Stray Flames (entropy): true, a 6-yalm circle in the middle (go out); false, the donut (stay in).
    const sf = E('Stray Flames', t0, t0 + 95);
    const blz = E('Blizzard III Blowout', tD2 - 2, tD2 + 4);
    const ice = blz ? magic(blz, true) : null;
    if (sf) {
      const entReal = Math.random() < 0.5;
      hz(Object.assign({ t: sf.t, tell: castOf(sf, 5), dmg: 1.2, name: 'Stray Flames' }, entReal ? { shape: 'circle', at: [0, 0], r: 6 } : { shape: 'donut', at: [0, 0], r0: 6 }));
      label(sf, entReal ? 'Stray Flames (true: out)' : 'Stray Flames (false: in)');
      if (!entReal) pref(castOf(sf, 5) + 0.2, clumpAt(S, [0, 0], { sep: 0.55 }));
      call(castOf(sf, 5), entReal ? 'Entropy true: out' : 'Entropy false: in', { alert: true, dur: 4 });
      pref(entReal ? castOf(sf, 5) + 0.2 : sf.t + 0.1, deaths(tD2, long, real2, ice && ice.safe));
    } else pref(tD2 - 6, deaths(tD2, long, real2, ice && ice.safe));
    label(db2, real2 ? 'Death Wave / Death Bolt (true)' : 'Death Wave / Death Bolt (false)');
    shrieks(sh2, shriek[1], []);
    // Mana Release: Stray Spray (fluid; true, the donut: stay close; false, the circle: out), then the last ice
    // (and, out of the donut, lightning).
    const ss = E('Stray Spray', t0, t0 + 115), last = X.events.filter(e => e.name === 'Blizzard III Blowout' && e.t > tD2 + 5 && e.t < t0 + 115)[0];
    if (ss) {
      const fluReal = Math.random() < 0.5;
      hz(Object.assign({ t: ss.t, tell: castOf(ss, 5), dmg: 1.2, name: 'Stray Spray' }, fluReal ? { shape: 'donut', at: [0, 0], r0: 6 } : { shape: 'circle', at: [0, 0], r: 6 }));
      label(ss, fluReal ? 'Stray Spray (true: stay close)' : 'Stray Spray (false: out)');
      const fin = last ? magic(last, fluReal) : { shapes: [] };
      const inner = (p) => (fluReal ? Math.hypot(p[0], p[1]) < 4.6 : Math.hypot(p[0], p[1]) > 7.5) && floorR(1.2)(p);
      pref(castOf(ss, 5) + 0.2, place(S.map(s => [s, fluReal ? mul(unit(UP1[s]), 3) : UP1[s], 0.55]), { avoid: fin.shapes, m: 1.5, floor: inner }));
      call(castOf(ss, 5), fluReal ? 'Fluid true: stay close, then dodge the ice' : 'Fluid false: out, dodge the release', { alert: true, dur: 5 });
      label(E('Mana Release', t0, t0 + 115), 'Mana Release (the stored true/false comes back)');
      pref(tOf(last, ss.t + 1) + 0.2, UP1);
    }
    label(E('Mana Charge', t0, t0 + 80), 'Mana Charge (stores the next true/false)');
  }

  // ================================================= P5: Ultima Kefka ==================================================
  function phase5(X) {
    const { P, hz, pref, call, debuff, E, EA, tOf, castOf, label, raid, spreads, stack } = X;
    const uu = X.events.filter(e => e.name === 'Ultima Upsurge' && e.t > 1100).pop();
    const ur = E('Ultima Repeater (castbar)', 1120, 1160);
    if (!ur) return;
    const tIn = castOf(ur, 4) - 6.5;
    // Ultima Kefka's own model is empty in this client: God Kefka's stands in.
    P.form.push({ t: tIn, model: 'god' });
    P.names.push({ t: uu ? uu.t + 1 : tIn, name: 'Ultima Kefka' });
    P.hitbox.push({ t: tIn, r: 8.01 });
    P.looks.push({ t: uu ? uu.t + 1 : tIn - 20, show: LOOK.p5 });
    pref(uu ? uu.t + 0.5 : tIn, UP5);
    label(uu, 'Ultima Upsurge (Kefka Says ends: Ultima Kefka)');
    // Ultima Repeater: four raidwides.
    for (const e of X.events.filter(x => /^Ultima Repeater \d$/.test(x.name) && x.t > tIn)) hz({ t: e.t, tell: e.t - 2, raidwide: true, dmg: 0.15, name: 'Ultima Repeater' });
    // Fell Forces: role autos, a 3-yalm hit on the main tank, 5 on a healer and a DPS.
    let fi = 0;
    for (const e of X.events.filter(x => /^Fell Forces \d$/.test(x.name) && x.t > tIn)) {
      spreads(e.t, ['MT'], 3, 'Fell Forces', { tell: e.t - 3, dmg: 0.9, own: 0.3 });
      spreads(e.t, [HEALERS[fi % 2]], 5, 'Fell Forces', { tell: e.t - 3 });
      spreads(e.t, [DPS[fi % 4]], 5, 'Fell Forces', { tell: e.t - 3 });
      fi++;
    }
    for (const e of X.events.filter(x => x.name === 'Fell Forces 1' && x.t > tIn)) pref(e.t - 3.5, UP5);

    // --- Flood: four waves of two crossed 10-wide bands, turning 22.5 degrees a second; Chaotic Flood's stack (x4)
    // on one player: everyone stays together, turning with the safe wedge ---
    const fl = E('Flood (castbar)', tIn, tIn + 40);
    if (fl) {
      const ws = [1, 2, 3, 4].map(k => tOf(E(`Flood ${k}`, fl.t, fl.t + 8), fl.t + 1.2 + k - 1));
      const a0 = pick([0, 22.5, 45, 67.5]), rot = pick([1, -1]);
      ws.forEach((t, k) => [0, 90].forEach(d => hz({ t, tell: t - 6, shape: 'line', at: [0, 0], deg: a0 + 22.5 * rot * k + d, len: 21, back: 21, w: 10, dmg: 1.2, name: 'Flood', react: 2.2 })));
      // The spot: 11.25 degrees past each wave's wedge bisector, a column of eight 11.2-15 out.
      const bis = (t) => a0 + 45 + 22.5 * rot * ((t - ws[0]) + 0.5);
      const radii = [11.4, 11.95, 12.5, 13.05, 13.6, 14.15, 14.7, 11.4];
      const off = [0, 0, 0, 0, 0, 0, 0, 1.2];
      const lane = (i) => (t) => { const d = bis(Math.max(ws[0] - 0.6, Math.min(ws[3] + 0.3, t))); return r2(add(at(d, radii[i]), at(d + 90, off[i]))); };
      const order = shuffle(S);
      pref(castOf(fl, 5) + 0.2, Object.fromEntries(order.map((s, i) => [s, lane(i)])));
      const tgt = order[3];
      ws.forEach(t => stack(t, [tgt], 6, 6, 'Chaotic Flood', { tell: ws[0] - 4, max: 8 }));
      call(castOf(fl, 5), 'Flood: stack, turn with the safe wedge', { alert: true, dur: 5 });
      pref(ws[3] + 0.4, UP5);
    }

    // --- Maddening Orchestra: Flare and Holy spreads, the nearest three's Holy + the tanks' shared Chaotic Flare,
    // then Flare Diffusion (25) from the Flare tank at the north wall and Chaotic Holy stacked on the Holy tank ---
    for (const mo of X.events.filter(e => e.name === 'Maddening Orchestra' && e.cast && e.t > tIn)) {
      const second = mo.t > 1240, flareT = second ? 'OT' : 'MT', holyT = flareT === 'MT' ? 'OT' : 'MT';
      const h1 = tOf(E('Holy', mo.t, mo.t + 2), mo.t + 0.9), h2 = tOf(E('Holy', h1 + 1, h1 + 5), h1 + 3.2), h3 = tOf(E('Chaotic Holy', h2, h2 + 5), h2 + 3.5);
      const hit = shuffle(NONTANK).slice(0, 3), close = NONTANK.filter(s => !hit.includes(s));
      const spread = { [flareT]: ring(340, 12), [holyT]: ring(20, 12) };
      const bear = {};
      shuffle(NONTANK).forEach((s, i) => { bear[s] = 100 + 32 * i; spread[s] = ring(bear[s], 10.5); });
      pref(castOf(mo, 5) + 0.2, spread);
      spreads(h1, [flareT, holyT].concat(hit), 5, 'Holy', { tell: castOf(mo, 5) });
      debuff(flareT, 'surpriseFlare', 'Surprise Flare', 'go to the north wall', h1, h3);
      debuff(holyT, 'surpriseHoly', 'Surprise Holy', 'the party stacks on you', h1, h3);
      // Second hit: the three not hit close (9.5 out, apart), the hit three out, the tanks together north.
      const p2 = clumpAt(TANKS, [0, 13.5]);
      for (const s of close) p2[s] = ring(bear[s], 10);
      for (const s of hit) p2[s] = ring(bear[s], 17);
      pref(h1 + 0.1, p2);
      spreads(h2, { nearest: 3 }, 5, 'Holy', { tell: h1 });
      stack(h2, [flareT], 5, 2, 'Chaotic Flare', { tell: h1, dmg: 0.5 });
      // Third: Flare to the north wall, everyone else stacked on the Holy tank south.
      pref(h2 + 0.1, Object.assign({ [flareT]: [0, 19.2] }, clumpAt(S.filter(s => s !== flareT), [0, -9.5])));
      spreads(h3, [flareT], 25, 'Flare Diffusion', { tell: h2, own: 0.4 });
      stack(h3, [holyT], 6, 7, 'Chaotic Holy', { tell: h2 });
      call(castOf(mo, 5), `Maddening Orchestra: spread; ${flareT} takes Flare north`, { alert: true, dur: 5 });
      pref(h3 + 0.2, UP5);
    }

    // --- Celestriad: three sets of four elemental towers (3 yalms, two each), your vuln's element forbidden;
    // Catastrophic Choice with the first and third: Quake (10 round Kefka) or Tornado (out of 10) ---
    const cel = E('Celestriad', tIn, tIn + 80);
    if (cel) {
      const els = X.events.filter(e => e.name === 'Fire III/Blizzard III/Thunder III' && e.t > cel.t && e.t < cel.t + 30);
      const cc = EA(/^Catastrophic Choice$/, cel.t, cel.t + 30), qt = EA(/^Quake\/Tornado$/, cel.t, cel.t + 30);
      const vul = {}, kinds = shuffle(['fire', 'fire', 'ice', 'ice', 'lightning', 'lightning', null, null]);
      S.forEach((s, i) => { vul[s] = kinds[i]; });
      for (const s of S) if (vul[s]) debuff(s, vul[s] + 'ResDown', `${vul[s][0].toUpperCase() + vul[s].slice(1)} Resistance Down II`, `no ${vul[s]} towers`, cel.t, cel.t + 30);
      const ELN = { fire: 'Fire III', ice: 'Blizzard III', lightning: 'Thunder III' };
      const quake = cc.map(() => Math.random() < 0.5);
      els.forEach((e, k) => {
        const withChoice = k === 0 ? 0 : k === 2 ? 1 : -1, q = withChoice >= 0 ? quake[withChoice] : null;
        const r = q === null ? 10 : q ? 14 : 6.5, base = k === 1 ? 0 : 45;
        const tws = [0, 90, 180, 270].map(d => ring(base + d, r));
        const te = shuffle(['fire', 'ice', 'lightning']).concat([pick(['fire', 'ice', 'lightning'])]);
        let asg = null;
        for (let tries = 0; tries < 300 && !asg; tries++) {
          const o = shuffle(S), ok = o.every((s, i) => vul[s] !== te[Math.floor(i / 2)]);
          if (ok) asg = o;
        }
        asg = asg || shuffle(S);
        const spots = {};
        tws.forEach((c, i) => {
          const two = [asg[2 * i], asg[2 * i + 1]];
          Object.assign(spots, clumpAt(two, c));
          hz({ t: e.t, tell: e.t - 6.1, effect: 'tower', shape: 'circle', at: c, r: 3, soak: [2, 2], only: two, dmg: 0.3, fail: 0.9, name: ELN[te[i]] });
          for (const s of two) call(e.t - 6.1, `${ELN[te[i]]} tower ${dirName(base + 90 * i)}`, { slot: s, alert: true, dur: 4 });
        });
        pref(e.t - 6, spots);
        label(e, `Celestriad towers ${k + 1}`);
        if (withChoice >= 0 && qt[withChoice]) {
          hz(Object.assign({ t: qt[withChoice].t, tell: castOf(cc[withChoice], 5), dmg: 1.3, name: q ? 'Quake' : 'Tornado' }, q ? { shape: 'circle', at: [0, 0], r: 10 } : { shape: 'donut', at: [0, 0], r0: 10 }));
          label(qt[withChoice], q ? 'Quake (out of 10)' : 'Tornado (inside 10)');
          label(cc[withChoice], q ? 'Catastrophic Choice (earth: out)' : 'Catastrophic Choice (wind: in)');
        }
      });
      if (els.length) pref(els[els.length - 1].t + 0.4, UP5);
    }

    // --- Stray Apocalypse: six sets of two exaflare lines (north-west, then north-east, and again), 9 either side of
    // a diagonal: the middle is safe from all; Stray Entropy spreads along the last set's safe diagonal ---
    const sa = E('Stray Apocalypse (castbar)', tIn, tIn + 120);
    if (sa) {
      const sets = [1, 2, 3, 4, 5, 6].map(k => tOf(E(`Stray Apocalypse ${k} x6`, sa.t, sa.t + 20), sa.t + 0.7 + 2.5 * (k - 1)));
      sets.forEach((t, k) => {
        const nw = k % 2 === 0, mv = nw ? 135 : 225, side = nw ? 45 : 135;
        for (const o of [-9, 9]) {
          const s0 = -Math.sqrt(19 * 19 - o * o), start = add(at(side, o), at(mv, s0));
          for (const h of B.mechSeq.exaflare({ at: start, deg: mv, t, n: 7, r: 6, step: 7.07, every: 1, show: 3, dmg: 1.1, name: 'Stray Apocalypse' })) hz(h);
        }
      });
      pref(castOf(sa, 4) + 0.2, clumpAt(S, [0, 0], { sep: 0.5 }));
      call(castOf(sa, 4), 'Exaflares: hold the middle', { alert: true, dur: 5 });
      const se = E('Stray Entropy', sa.t, sa.t + 25);
      if (se) {
        const lastNW = (sets.length - 1) % 2 === 0, d = lastNW ? 135 : 45;
        const pts = [-14.7, -10.5, -6.3, -2.1, 2.1, 6.3, 10.5, 14.7].map((x, i) => r2(add(at(d, x), at(d + 90, i % 2 ? 1.8 : -1.8))));
        pref(Math.min(se.t - 3.5, sets[sets.length - 2] + 3.1), assign(shuffle(S), pts));
        spreads(se.t, S, 5, 'Stray Entropy', { tell: castOf(se, 5) });
        call(se.t - 3.5, 'Stray Entropy: spread along the diagonal', { alert: true, dur: 4 });
        pref(se.t + 0.3, UP5);
      }
    }

    // --- Forsaken: four stacks (C, then 4, 1, 2) as the floor's holes open where the orange circles land ---
    const fk = E('Forsaken 1', tIn, tIn + 200);
    if (fk) {
      raid(fk, 0.4, 10);
      for (const e of X.events.filter(x => /^Forsaken [234]$/.test(x.name) && x.t > fk.t)) hz({ t: e.t, tell: e.t - 2, raidwide: true, dmg: 0.3, name: 'Forsaken' });
      const rounds = X.events.filter(x => /^Forsaken Ground\/Forsaken Bonds \d$/.test(x.name) && x.t > fk.t);
      const STK = [180, 225, 315, 45];
      const HOLES = [[[0, 0], [0, 13.5]], [[13.5, 0], [13.5, -13.5]], [[0, -13.5], [-13.5, -13.5]], [[-13.5, 0], [-13.5, 13.5]]];
      const PIECE = { '0,0': 'a7_flo2a', '0,13.5': 'a7_flo2b', '13.5,0': 'a7_flo2f', '13.5,-13.5': 'a7_flo2c', '0,-13.5': 'a7_flo2d', '-13.5,-13.5': 'a7_flo2g', '-13.5,0': 'a7_flo2e', '-13.5,13.5': 'a7_flo2i' };
      const gone = [];
      const end = tOf(E('Forsaken Null (Enrage)', fk.t, fk.t + 120), fk.t + 61);
      rounds.forEach((e, k) => {
        const spot = ring(STK[k], 11), tgt = pick(S);
        pref(k ? rounds[k - 1].t + 0.2 : castOf(fk, 10) + 0.2, clumpAt(S, spot));
        stack(e.t, [tgt], 6, 8, 'Forsaken Bonds', { tell: e.t - 5.1 });
        for (const h of HOLES[k] || []) {
          hz({ t: e.t, tell: castOf(e, 5), shape: 'circle', at: h, r: 8, dmg: 1.3, name: 'Forsaken Ground' });
          hz({ t: e.t + 1, tell: e.t, shape: 'circle', at: h, r: 6, dmg: 0.9, lasts: end - e.t - 1, tick: 3, tickDmg: 0.9, name: 'Forsaken (hole)' });
          gone.push(PIECE[h.join(',')]);
        }
        P.looks.push({ t: e.t + 0.5, show: LOOK.p5.filter(m => !gone.includes(m)) });
        call(e.t - 5.1, `Stack ${['C', '4', '1', '2'][k] || ''}; out of the orange`, { alert: true, dur: 4 });
      });
      label(E('Forsaken Null (Enrage)', fk.t, fk.t + 120), 'Forsaken Null (enrage)');
    }
  }

  // The arena's looks (the zone's models): each phase's floor (a disc and its swirl) and sky; P5's broken floor,
  // whose nine pieces go as Forsaken's holes open.
  const LOOK = {
    p1: ['a0_flo01', 'a1_flo01', 't0'],
    p2: ['a0_flo03', 'a1_flo03', 't2'],
    p3: ['a0_flo04', 'a1_flo04', 't1_zon00', 't1_zon01', 't1_cry'],
    p4: ['a5_flo01', 'a1_flo05', 't1_zon00', 't1_zon01', 't1_cry'],
    p5: ['a7_flo1a', 'a7_flo2a', 'a7_flo2b', 'a7_flo2c', 'a7_flo2d', 'a7_flo2e', 'a7_flo2f', 'a7_flo2g', 'a7_flo2h', 'a7_flo2i', 'a7_flo3a', 'a7_grk2c', 'a8_pan', 't1_zon98', 't1_zon99', 't1_cry'],
  };

  B.FIGHT_SCRIPTS = B.FIGHT_SCRIPTS || {};
  B.FIGHT_SCRIPTS.umad = {
    // FFLogs' max HP in a Dancing Mad kill (report 3KCNG78qzPVTWmhA, fight 8): Ultima Kefka (P5) 56,943,803 is the
    // boss's own pool; the other phases' bosses are adds windows below.
    hp: 56943803,
    adds: [
      { from: 0, to: 197.4, hp: 56331828, share: 1, name: 'Kefka (below 15% before he leaves, or he enrages)' },
      { from: 297.5, to: 486.2, hp: 44109275, share: 1, name: 'Forsaken Kefka' },
      { from: 529.5, to: 976.9, hp: 37552669, share: 0.5, name: 'Chaos (half the damage; Exdeath the other half)' },
      { from: 529.5, to: 976.9, hp: 37552669, share: 0.5, name: 'Exdeath' },
      { from: 979.1, to: 1110.9, hp: 42678195, share: 1, name: 'Kefka (below 20% by the HP check)' },
    ],
    pushes: [
      { from: 197.4, to: 297.5, dealt: 0, name: 'Phase 2: Forsaken Kefka' },
      { from: 307.6, to: 486.2, adds: 1, name: 'Forsaken Kefka is down: phase 3' },
      { from: 491.5, to: 519.5, dealt: 0, name: 'Down for the Count' },
      { from: 529.5, to: 976.9, adds: 2, name: 'Chaos and Exdeath are down: phase 4' },
      { from: 841.1, to: 976.9, dealt: 0, name: 'Phase 3 over (their enrage: the sim plays on)' },
    ],
    defaultStrat: 'kefkabin',
    strats: {
      kefkabin: { label: 'Kefkabin (NA)' },
      lpdu: { label: 'LPDU (EU)' },
    },
    source: 'wtfdig.info/ultimates/umad; mechanics after BossMod (github.com/awgil/ffxiv_bossmod) and cactbot',
    // A north, B east, C south, D west; 1-4 the intercards (1 north-west, then clockwise).
    waymarks: [
      { label: 'A', at: [0, 14], color: 'red' }, { label: 'B', at: [14, 0], color: 'yellow' },
      { label: 'C', at: [0, -14], color: 'blue' }, { label: 'D', at: [-14, 0], color: 'purple' },
      { label: '1', at: [-10, 10], color: 'red', square: true }, { label: '2', at: [10, 10], color: 'yellow', square: true },
      { label: '3', at: [10, -10], color: 'blue', square: true }, { label: '4', at: [-10, -10], color: 'purple', square: true },
    ],
    plan,
  };
})(window.BLM);
