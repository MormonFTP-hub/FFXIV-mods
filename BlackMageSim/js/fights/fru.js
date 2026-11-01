// FRU, Futures Rewritten (Ultimate): the five phases' mechanics for the sim's party, on cactbot's timeline
// (07-dt/ultimate/futures_rewritten), with the strat wtfdig.info lists for the fight: NAUR (its only one; its P4 Akh
// Morn toggle at its default, 7-1). Spots are [east, north] yalms from the arena's middle (a circle of 20).
//
// One duty, five bosses in turn, one sim target. The sim's boss is the phase's boss (plan.form: Fatebreaker, then the
// Usurper of Frost, the Oracle of Darkness, the Usurper again with the Oracle beside her (plan.others), Pandora), its
// hitbox and the arena's look changing with it. The game pushes phases on HP, and so does the script (its `pushes`):
//   - P1 ends when Fatebreaker's HP does (22,289,071, FFLogs); past its enrage the sim plays on into P2.
//   - P2 (the Usurper, 25,151,231) and P3 (the Oracle, 30,909,445) run to fixed ends in the game (Absolute Zero, Memory's
//     End: damage checks), so their HP are pools of their own (adds windows over the whole phase) that soak the party's
//     damage meanwhile and leave the main pool alone.
//   - The intermission's adds (four Crystals of Light, 1,628,795 each, and half the Ice Veil's 2,513,805: Gaia hits the
//     other half) push to P3 when they're down (an adds window whose push skips ahead), else Endless Ice Age passes.
//   - P4 (the Usurper and the Oracle, 11,943,869 each, held level by Morn Afah) and P5 (Pandora, 48,541,857) are the
//     main pool with P1's: P4's push needs P1's and P4's HP dealt; the kill is Pandora's.
//
// The mechanics follow BossMod's module (github.com/awgil/ffxiv_bossmod, Dawntrail/Ultimate/FRU), whose shapes and
// sizes come from the game's Action sheet, and NAUR's spots as wtfdig gives them, built with the sim's toolkit:
//   P1 Fatebreaker: Cyclonic Break (proteans that repeat, then turn 22.5 degrees twice; pairs or spreads with the
//     second), Powder Mark Trail (a buster whose Burn Mark hits the tank and whoever's nearest), Utopian Sky (three of
//     eight clones' 16-wide lines through the middle, light-party stacks or spreads on the safe axis), the clone's
//     Cyclonic Break, Turn of the Heavens (lines, the 20-wide Burnout, Blastburn's knockback to the safe side, the
//     halos, two fire-tether stacks in lanes), Fall of Faith (four tethers, fire = one shared cone, lightning = three
//     cones, west and east in turn) and the Explosion towers (the line, its knockback or widening, towers of 1-4 filled
//     north to south, the tanks' Burn Marks on the other side).
//   P2 Usurper of Frost: Quadruple Slap; Diamond Dust (the clone's Axe or Scythe Kick, House of Light cones on the
//     unmarked, Frigid Stones on the marked, the rotating Icicle Impacts, Heavenly Strike's knockback to the first
//     circles, Sinbound Holy's four light-party stacks walking the edge, the gaze, Twin Stillness/Silence); Hallowed Ray
//     (a line stack); Mirror Mirror (the boss and the blue mirror's donuts and proteans, then the red mirrors', Banish
//     III pairs or spreads); Light Rampant (two puddle baiters, six tethered towers, the 4-stacks, the orbs, the middle
//     tower, Banish III); House of Light; Absolute Zero.
//   Intermission: Swelling Frost's knockback; the Crystals of Light's puddles and rays on the cardinals, the Crystals of
//     Darkness's cones on the intercardinals; kill the light crystals and half the Ice Veil.
//   P3 Oracle of Darkness: Junction, Hell's Judgment; Ultimate Relativity (fire spreads 10/20/30 s and the middle
//     stacks, the eight hourglasses' lasers baited in three rounds, rewinds, Dark Eruption, Dark Water and the eyes);
//     Shell Crusher, Shockwave Pulsar, Black Halo; Apocalypse (three Dark Water rounds, Spirit Taker, the lights' circles
//     sweeping round, Dark Eruption, Darkest Dance's bait and knockback); Memory's End.
//   P4 the Usurper and the Oracle: Akh Rhai puddles; Darklit Dragonsong (the four tethered soak the towers, the others
//     bait Path of Light, Spirit Taker, Hallowed Wings's half and the Dark Water stacks, Somber Dance far then close);
//     Akh Morn 7-1 and Morn Afah; Crystallize Time (claws and fangs, the hourglasses' traffic lights, Dark Water, Aero's
//     knockback, Eruption, Blizzard, Unholy, Tidal Light's waves, Quietus, the rewinds and Hallowed Wings's two
//     knockbacks); Akh Morn, Morn Afah.
//   P5 Pandora: Fulgent Blade's six sweeping lines (the party walks their crossings), Akh Morn left/right, Paradise
//     Regained (three towers, Wings Dark and Light's cleaves and tethers on the tanks), Polarizing Strikes (four rounds
//     of line baits, swapping sides), Pandora's Box (the tank LB), twice over, Paradise Lost.
// Simplified (the engine can't do it, or wtfdig gives no diagram): Diamond Dust's thin ice slides are walks, and its
// cursed pattern and the Frigid Needle crosses are left out; the hourglasses' lasers sweep from where they're baited;
// Crystallize Time's dragon heads and cleanses are calls (their puddles aren't on the floor), its traffic lights stand
// N/S and on the diagonals; Morn Afah's HP check, the tank LB and the intermission's Gaia are assumed done; where
// BossMod's AI and wtfdig disagree on a spot, wtfdig's; elsewhere the spots are this script's own.
(function (B) {
  const S = B.SLOTS;
  const at = B.bearing;
  const inside = B.mechInside;
  const add = (a, b) => [a[0] + b[0], a[1] + b[1]];
  const sub = (a, b) => [a[0] - b[0], a[1] - b[1]];
  const mul = (a, k) => [a[0] * k, a[1] * k];
  const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);
  const deg360 = (d) => ((d % 360) + 360) % 360;
  const brg = (p) => deg360(Math.atan2(p[0], p[1]) * 180 / Math.PI);
  const pick = (a) => a[Math.floor(Math.random() * a.length)];
  const shuffle = (a) => { const b = a.slice(); for (let i = b.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [b[i], b[j]] = [b[j], b[i]]; } return b; };
  const r2 = (p) => [+p[0].toFixed(2), +p[1].toFixed(2)];
  const all = (f) => Object.fromEntries(S.map(s => [s, f(s)]));
  const assign = (slots, pts) => Object.fromEntries(slots.map((s, i) => [s, pts[i]]));
  const SUP = ['MT', 'OT', 'H1', 'H2'], DPS = ['M1', 'M2', 'R1', 'R2'], TANKS = ['MT', 'OT'];
  const G1 = ['MT', 'H1', 'M1', 'R1'], G2 = ['OT', 'H2', 'M2', 'R2'];
  const isSup = (s) => SUP.includes(s);
  const near = (s) => s === 'MT' || s === 'OT' || s === 'M1' || s === 'M2';         // tanks and melee: in close
  const COMPASS = ['north', 'north-northeast', 'northeast', 'east-northeast', 'east', 'east-southeast', 'southeast', 'south-southeast',
    'south', 'south-southwest', 'southwest', 'west-southwest', 'west', 'west-northwest', 'northwest', 'north-northwest'];
  const dirName = (deg) => COMPASS[Math.round(deg360(deg) / 22.5) % 16];
  const DIR8 = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
  const dir8 = (deg) => DIR8[Math.round(deg360(deg) / 45) % 8];
  const R = 20;                               // the arena's radius
  const onFloor = (m) => (p) => Math.hypot(p[0], p[1]) < R - (m === undefined ? 0.9 : m);
  const F = onFloor();

  // ---------- placing the party ----------
  // Each [slot, want, sep] in turn: the nearest point to `want` on the floor, clear of the shapes in `avoid` (by m
  // yalms) and at least sep from those already placed.
  function place(list, o) {
    o = o || {};
    const m = o.m === undefined ? 1.2 : o.m, avoid = o.avoid || [], floor = o.floor || F, done = (o.keep || []).map(p => ({ p, sep: o.keepSep || 0 }));
    const out = {};
    for (const [s, want, sp] of list) {
      const sep = sp === undefined ? 0.6 : sp;
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
  const clumpAt = (slots, c, o) => place(slots.map(s => [s, c, 0.55]), Object.assign({ m: 0 }, o));
  // A walk along points from second t0 (5.6 yalms a second), as a spot that moves (a pref that's a function).
  function walkPath(pts, t0, speed) {
    const v = speed || 5.6, len = [0];
    for (let i = 1; i < pts.length; i++) len.push(len[i - 1] + dist(pts[i - 1], pts[i]));
    return (t) => {
      const d = Math.max(0, (t - t0) * v);
      if (d >= len[len.length - 1]) return pts[pts.length - 1];
      let i = 1;
      while (len[i] < d) i++;
      const k = (d - len[i - 1]) / Math.max(1e-6, len[i] - len[i - 1]);
      return [pts[i - 1][0] + (pts[i][0] - pts[i - 1][0]) * k, pts[i - 1][1] + (pts[i][1] - pts[i - 1][1]) * k];
    };
  }
  // A path through moving danger: positions at each of the hits' seconds (`steps`: [{t, shapes}]) that a body
  // running at `speed` can make, out of each step's shapes (by m), kept as near `prefer(t)` as it can be. Searched
  // over a grid of the floor, every reachable cell from the last step's, and walked back from the best at the end.
  function safePath(steps, start, prefer, o) {
    o = o || {};
    const g = o.grid || 1, m = o.m === undefined ? 1.2 : o.m, speed = (o.speed || 6) * 0.85, floor = o.floor || F;
    const cells = [];
    for (let x = -R; x <= R; x += g) for (let y = -R; y <= R; y += g) if (floor([x, y])) cells.push([x, y]);
    let layer = [{ p: start, cost: 0, prev: null }], t0 = o.t0 ?? steps[0].t - 3;
    for (const st of steps) {
      const reach = speed * (st.t - t0), out = [];
      for (const c of cells) {
        if (st.shapes.some(h => inside(h, c, m))) continue;
        let best = null;
        for (const L of layer) { const d = dist(L.p, c); if (d <= reach && (!best || L.cost < best.cost)) best = L; }
        if (best) out.push({ p: c, cost: best.cost + dist(c, prefer(st.t)) + 0.3 * dist(c, best.p), prev: best });
      }
      if (!out.length) return null;
      out.sort((a, b) => a.cost - b.cost);
      layer = out.slice(0, 400);
      t0 = st.t;
    }
    const res = [];
    for (let L = layer[0]; L && L.prev; L = L.prev) res.unshift(L.p);
    return res;
  }

  // ---------- the party's places ----------
  // Uptime round a boss in the middle (hitbox hb): tanks at its front (north), melee at its back, the rest behind.
  const uptime = (hb, c) => {
    const o = c || [0, 0];
    return { MT: add(o, [-1, hb + 0.6]), OT: add(o, [1, hb + 0.6]), M1: add(o, [-2.4, -hb - 0.4]), M2: add(o, [2.4, -hb - 0.4]),
      H1: add(o, [-6.5, -hb - 4]), H2: add(o, [6.5, -hb - 4]), R1: add(o, [-9.5, -hb - 1]), R2: add(o, [9.5, -hb - 1]) };
  };
  const HB = { p1: 5, p2: 6.1, p3: 7, p4: 6.1, p5: 7 };
  // NAUR's waymarks: A north, B east, C south, D west; 1 north-west, 2 north-east, 3 south-east, 4 south-west.
  const MARK = { A: 0, B: 90, C: 180, D: 270, 1: 315, 2: 45, 3: 135, 4: 225 };
  // NAUR's colour pairs (a letter and a number each): red A/1 (MT, M1), yellow B/2 (OT, M2), blue C/3 (H2, R2),
  // purple D/4 (H1, R1); G1 red and purple, G2 yellow and blue.
  const COLOUR = { MT: ['A', '1'], M1: ['A', '1'], OT: ['B', '2'], M2: ['B', '2'], H2: ['C', '3'], R2: ['C', '3'], H1: ['D', '4'], R1: ['D', '4'] };

  // ---------- the pull ----------
  function plan(events, strat) {
    const P = { start: uptime(HB.p1), prefs: [], hazards: [], checks: [], calls: [], marks: [], labels: new Map(), debuffs: [],
      boss: [{ t: 0, at: [0, 0] }], hitbox: [{ t: 0, r: HB.p1 }], face: [], form: [], others: [], looks: [], untargetable: [] };
    let id = 0;
    const hz = (o) => { const h = Object.assign({ id: ++id, react: 3, dmg: 0.6 }, o); P.hazards.push(h); return h; };
    const pref = (t, spots) => P.prefs.push({ t: +t.toFixed(2), spots });
    const call = (t, text, o) => P.calls.push(Object.assign({ t, text, dur: 5 }, o));
    const debuff = (slot, key, name, hint, t0, t1) => P.debuffs.push({ slot, key, name, hint, t0, t1 });
    const mark = (shape, t0, t1, fill) => P.marks.push(Object.assign({ kind: 'lit', t0, t1, fill }, shape));
    const label = (ev, text) => { if (ev) P.labels.set(ev, text); };
    const E = (name, t0, t1) => events.find(e => e.name === name && e.t >= t0 && e.t <= t1) || null;
    const EA = (name, t0, t1) => events.filter(e => e.name === name && e.t >= t0 && e.t <= t1);
    const tOf = (e, d) => (e ? e.t : d);
    const castOf = (ev, d) => ev.t - (ev.cast || d || 5);
    const raid = (ev, dmg, name, o) => { if (ev) hz(Object.assign({ t: ev.t, tell: castOf(ev, 4), raidwide: true, dmg, name: name || ev.name }, o)); };
    const spreads = (t, targets, r, name, o) => hz(Object.assign({ t, tell: t - 5, effect: 'bait', shape: 'circle', from: 'target', targets, r, dmg: 0.9, own: 0.3, name }, o));
    const stack = (t, targets, r, min, name, o) => hz(Object.assign({ t, tell: t - 5, effect: 'share', shape: 'circle', from: 'target', targets, r, min, max: min, dmg: 0.4, name }, o));
    const buster = (t, targets, r, name, o) => hz(Object.assign({ t, tell: t - 5, effect: 'bait', shape: 'circle', from: 'target', targets, r, dmg: 1.4, own: 0.55, buster: true, name }, o));
    const ctx = { P, hz, pref, call, debuff, mark, label, E, EA, tOf, castOf, raid, spreads, stack, buster, events };

    phase1(ctx);

    P.prefs.sort((a, b) => a.t - b.t);
    P.looks.sort((a, b) => a.t - b.t);
    return P;
  }

  // ===== P1: Fatebreaker =====
  // Cyclonic Break's clock spots (NAUR's: supports on the cardinals, each DPS 45 degrees counterclockwise of their
  // partner, so supports turning counterclockwise and DPS clockwise meet for the pairs): MT N, R1 NW, H1 W, M1 SW,
  // OT S, R2 SE, H2 E, M2 NE.
  const CB_CLOCK = { MT: 0, M2: 45, H2: 90, R2: 135, OT: 180, M1: 225, H1: 270, R1: 315 };
  function phase1(c) {
    const { P, hz, pref, call, debuff, label, E, EA, tOf, castOf, raid, spreads, stack, buster, events } = c;
    const UP = uptime(HB.p1);
    // --- raidwides ---
    for (const ev of EA('Burnished Glory', 0, 150)) { raid(ev, 0.5, 'Burnished Glory', { status: ['bleeding', 6] }); call(castOf(ev, 5), 'Raidwide + bleed', { dur: 3 }); }
    const enr = events.find(e => e.name === 'Burnished Glory' && e.kind === 'enrage');
    label(enr, 'Burnished Glory (P1\'s enrage: push Fatebreaker before it)');

    // --- Cyclonic Break (the boss's, then the clone's) ---
    const cyclonic = (first, kind, free) => {
      const t1 = first.t, t2 = t1 + 2, t3 = t1 + 4, t4 = t1 + 6, cs = t1 - 7.2;
      const fire = kind === 'fire';
      const rad = (s) => (near(s) ? 4.8 : 12);
      const spot = (s, off, r) => r2(at(CB_CLOCK[s] + off, r ?? rad(s)));
      pref(Math.max(cs + 0.2, free || 0), all(s => spot(s, 0)));
      // Proteans at everyone (23 degrees each), the same again, then turning 22.5 and 45 degrees clockwise.
      hz({ t: t1, tell: cs + 0.5, shape: 'protean', half: 11.5, r: 60, dmg: 0.7, own: 0.25, name: 'Cyclonic Break' });
      [[t2, 0], [t3, 22.5], [t4, 45]].forEach(([t, off], k) => {
        for (const s of S) hz({ t, tell: k ? t - 2 : t1, shape: 'cone', at: [0, 0], deg: CB_CLOCK[s] + off, half: 11.5, r: 60, dmg: 0.7, name: 'Cyclonic Break', react: 1.8 });
      });
      // With the second: supports counterclockwise, DPS clockwise; pairs (fire) together, spreads (lightning) in and out.
      pref(t1 + 0.1, all(s => spot(s, isSup(s) ? -22.5 : 22.5, fire ? 6 : rad(s))));
      if (fire) stack(t2, SUP, 6, 2, 'Sinsmoke', { tell: cs + 0.5 });
      else spreads(t2, S, 6, 'Sinsmite', { tell: cs + 0.5 });
      pref(t2 + 0.1, all(s => spot(s, 0)));
      call(cs + 0.5, fire ? 'Clock spots => Pairs' : 'Clock spots => Spread', { alert: true, dur: 6 });
      call(t1 + 0.1, fire ? 'Supports CCW, DPS CW: pair up' : 'Supports CCW, DPS CW: spread', { dur: 2 });
      call(t2 + 0.1, 'Back to your spot', { dur: 2 });
      return t4;
    };
    const cbs = EA('Cyclonic Break 1 (targeted)', 0, 200);
    const sins = EA('Sinsmoke/Sinsmite', 0, 200);
    const kinds = cbs.map(() => pick(['fire', 'lightning']));
    const usEv = E('Utopian Sky', 20, 60), blz = usEv && E('Blasting Zone', usEv.t, usEv.t + 20);
    cbs.forEach((e, k) => {
      const end = cyclonic(e, kinds[k], k && blz ? blz.t + 0.3 : 0);
      label(sins[k], kinds[k] === 'fire' ? 'Sinsmoke (pairs)' : 'Sinsmite (spread)');
      label(e, `Cyclonic Break (${kinds[k] === 'fire' ? 'fire: pairs' : 'lightning: spread'})`);
      if (k === 0) pref(end + 0.2, UP);
    });

    // --- Powder Mark Trail: the buster, then Burn Mark on the tank and whoever stands nearest them ---
    const pmts = EA('Powder Mark Trail', 0, 150), burn = E('Burn Mark', 30, 50);
    pmts.forEach((ev, k) => {
      buster(ev.t, ['MT'], 1.2, 'Powder Mark Trail', { tell: castOf(ev, 5) });
      const tBurn = k === 0 ? tOf(burn, ev.t + 16.2) : ev.t + 15.7;
      debuff('MT', 'powderMarkTrail', 'Powder Mark Trail', 'stay with OT, away from the party', ev.t, tBurn);
      hz({ t: tBurn, tell: tBurn - 6, effect: 'bait', shape: 'circle', from: 'target', targets: ['MT', 'OT'], r: 10, dmg: 1.2, own: 0.45, buster: true, name: 'Burn Mark' });
      call(castOf(ev, 5), 'Tank buster: OT stays nearest MT', { slot: 'OT', alert: true, dur: 4 });
    });

    // --- Utopian Sky ---
    const us = E('Utopian Sky', 20, 60);
    if (us) {
      const tLine = tOf(E('Blasting Zone', us.t, us.t + 20), us.t + 15.3), tSS = tOf(E('Sinbound Fire III/Sinbound Thunder III', us.t, us.t + 20), tLine - 0.1);
      const fire = Math.random() < 0.5;
      // Eight clock spots at the edge (Role: supports north, DPS south; the tanks a notch toward each other).
      const US_CLOCK = { MT: 0, OT: 37.5, H2: 90, R2: 135, M2: 180, M1: 225, R1: 270, H1: 315 };
      pref(us.t - 3.5, all(s => r2(at(US_CLOCK[s], 18))));
      // Three of eight clones raise a hand: each a 16-wide line through the middle; the fourth axis is safe.
      const safeAxis = pick([0, 45, 90, 135]);
      const lines = [0, 45, 90, 135].filter(a => a !== safeAxis).map(a => a + pick([0, 180]));
      const tShow = us.t + 5.2;
      for (const a of lines) hz({ t: tLine, tell: tShow, shape: 'line', at: at(a, 20), deg: a + 180, len: 50, w: 16, dmg: 1.5, name: 'Blasting Zone', react: 1.5 });
      // (Fatebreaker leaves the floor; the three clones with a hand up stand at the edge, facing the middle.)
      P.form.push({ t: us.t + 0.5, model: 'none' }, { t: tLine + 0.6, model: null });
      for (const a of lines) P.others.push({ model: 'main', path: [{ t: 0, at: r2(at(a, 19)) }], shows: [[us.t + 1, tLine + 0.5]], face: [0, 0] });
      // The safe axis's ends: G1 the end counterclockwise from north (N, NW, W, SW), G2 the other.
      const g1End = safeAxis === 0 ? 0 : safeAxis + 180, g2End = deg360(g1End + 180);
      const SPOT = { H1: [0, 13], MT: [0, 19], M1: [18, 19], R1: [-18, 19] };
      const spots = {};
      for (const [g, end] of [[G1, g1End], [G2, g2End]]) {
        const role = (s) => ({ MT: 'MT', OT: 'MT', H1: 'H1', H2: 'H1', M1: 'M1', M2: 'M1', R1: 'R1', R2: 'R1' })[s];
        for (const s of g) {
          const [off, r] = SPOT[role(s)];
          spots[s] = r2(at(end + off, r));
        }
      }
      const fin = fire ? Object.assign(clumpAt(G1, at(g1End, 13)), clumpAt(G2, at(g2End, 13))) : spots;
      // The clones with a hand up show at second tShow; the spots' owners call it by stepping in, then all go.
      pref(tShow + 1.5, place(S.map(s => [s, fin[s], 0.55]), { avoid: [], m: 0 }));
      if (fire) stack(tSS, ['H1', 'H2'], 6, 4, 'Sinbound Fire III', { tell: tShow });
      else spreads(tSS, S, 5, 'Sinbound Thunder III', { tell: tShow });
      const ssEv = E('Sinbound Fire III/Sinbound Thunder III', us.t, us.t + 20);
      label(ssEv, fire ? 'Sinbound Fire III (light parties)' : 'Sinbound Thunder III (spread)');
      label(us, `Utopian Sky (${fire ? 'fire: light parties' : 'lightning: spread'}; ${dir8(g1End)}/${dir8(g2End)} safe)`);
      call(us.t - 4, fire ? 'Utopian Sky: fire (light parties)' : 'Utopian Sky: lightning (spread)', { alert: true, dur: 5 });
      call(tShow + 0.5, `${dir8(g1End)} / ${dir8(g2End)} safe => ${fire ? 'Stacks' : 'Spread'}`, { alert: true, dur: 6 });
    }

    // --- Turn of the Heavens (the clones' lines, knockback to the safe side, fire-tether stacks in lanes) ---
    const toh = E('Turn Of The Heavens', 50, 80);
    if (toh) {
      const tL1 = tOf(E('Burnt Strike (lightning)', toh.t, toh.t + 5), toh.t + 1), tOut = tOf(E('Burnout', toh.t, toh.t + 6), tL1 + 1.7);
      const tL3 = tOf(E('Burnt Strike (fire)', toh.t, toh.t + 10), tOut + 4.3), tKb = tOf(E('Blastburn', toh.t, toh.t + 12), tL3 + 2);
      const tFet = tOf(E('Floating Fetters', toh.t, toh.t + 15), tKb + 2.6), tStk = tOf(E('Sinsmoke', toh.t, toh.t + 18), tFet + 3.2);
      const tHalo = tKb + 2.1;
      const fireTurn = Math.random() < 0.5, side = pick([-1, 1]);       // the safe halos' side (east 1)
      label(toh, `Turn of the Heavens (${fireTurn ? 'fire: lightning halos' : 'lightning: fire halos'} safe, ${side > 0 ? 'east' : 'west'})`);
      // Lines north to south through the middle: 10 wide, then 20 wide; then 10 wide again and the knockback.
      const line = (w) => ({ shape: 'rect', a: [-w / 2, -R - 2], b: [w / 2, R + 2] });
      hz(Object.assign({ t: tL1, tell: toh.t - 6, dmg: 1.3, name: 'Burnt Strike' }, line(10)));
      hz(Object.assign({ t: tOut, tell: toh.t - 4, dmg: 1.3, name: 'Burnout' }, line(20)));
      hz(Object.assign({ t: tL3, tell: tOut, dmg: 1.3, name: 'Burnt Strike', react: 2 }, line(10)));
      hz({ t: tKb, tell: tOut, effect: 'knockback', at: [0, 0], dist: 15, dir: side > 0 ? 90 : 270, shape: 'rect', a: [side > 0 ? 0 : -R - 2, -R - 2], b: [side > 0 ? R + 2 : 0, R + 2], dmg: 0, name: 'Blastburn', react: 3 });
      hz({ t: tKb, tell: tOut, effect: 'knockback', at: [0, 0], dist: 15, dir: side > 0 ? 270 : 90, shape: 'rect', a: [side > 0 ? -R - 2 : 0, -R - 2], b: [side > 0 ? 0 : R + 2, R + 2], dmg: 0, name: 'Blastburn', react: 3, hidden: true });
      // The halos: big circles (10) on the unsafe side, small ones (5) on the safe side.
      for (const p of [[12, 0], [8, 13], [8, -13]]) {
        hz({ t: tHalo, tell: tOut + 0.4, shape: 'circle', at: [p[0] * side, p[1]], r: 5, dmg: 1.1, name: 'Brightfire', react: 1.5 });
        hz({ t: tHalo, tell: tOut + 0.4, shape: 'circle', at: [-p[0] * side, p[1]], r: 10, dmg: 1.1, name: 'Brightfire', react: 1.5 });
      }
      // Two fire tethers: the long one stacks in the north lane, the short one south; supports north, DPS south, a
      // tethered pair of one role sending a flex (MT south for two DPS, M1 north for two supports).
      const tt = shuffle(S).slice(0, 2), [tN, tS] = tt;
      const north = new Set([tN]), south = new Set([tS]);
      const flexN = isSup(tN) && isSup(tS) ? 'M1' : null, flexS = !isSup(tN) && !isSup(tS) ? 'MT' : null;
      for (const s of S) {
        if (tt.includes(s)) continue;
        if (s === flexN) north.add(s); else if (s === flexS) south.add(s);
        else (isSup(s) ? north : south).add(s);
      }
      // Balance (a flex already moved, but a lane can still be five).
      while (north.size > 4) { const s = [...north].find(x => x !== tN && !isSup(x)) || [...north].find(x => x !== tN); north.delete(s); south.add(s); }
      while (south.size > 4) { const s = [...south].find(x => x !== tS && isSup(x)) || [...south].find(x => x !== tS); south.delete(s); north.add(s); }
      const lane = (s) => (north.has(s) ? 5.4 : -5.4);
      for (const s of tt) debuff(s, 'floatingFetters', 'Floating Fetters', `the ${s === tN ? 'north' : 'south'} lane's stack`, tFet, tStk);
      pref(toh.t - 6.5, all(s => r2([side * 12.5, lane(s) + (lane(s) > 0 ? 1 : -1) * (S.indexOf(s) % 4) * 0.01])));
      pref(tOut + 0.15, all(s => r2([side * 6.2, lane(s)])));
      pref(tL3 + 0.1, all(s => r2([side * 2.8, lane(s)])));
      pref(tKb + 0.6, Object.assign(clumpAt([...north], [side * 16.5, 6.6]), clumpAt([...south], [side * 16.5, -6.6])));
      stack(tStk, [tN, tS], 6, 4, 'Sinsmoke', { tell: tKb });
      call(toh.t - 6.5, `${side > 0 ? 'East' : 'West'} safe: out of the line, in your lane`, { alert: true, dur: 5 });
      call(tOut + 0.1, 'In => knockback', { alert: true, dur: 3 });
      for (const s of tt) call(tKb - 3, `Fire tether: ${s === tN ? 'north' : 'south'} lane stack`, { slot: s, alert: true, dur: 5 });
      pref(tStk + 0.2, UP);
    }

    // --- Fall of Faith ---
    const fof = E('Fall Of Faith', 80, 130);
    if (fof) {
      const cs = castOf(fof, 9);
      const fet = [1, 2, 3, 4].map(k => tOf(E(`Floating Fetters ${k}`, fof.t, fof.t + 15), [102.2, 105.2, 107.5, 109.9][k - 1] - 101.4 + fof.t));
      const baits = [1, 2, 3, 4].map(k => E(`Sinblaze/Sinsmite ${k}`, fof.t, fof.t + 15));
      const tB = baits.map((e, k) => tOf(e, [105.5, 108.4, 110.8, 113.3][k] - 101.4 + fof.t));
      // The tethers, in the conga's order (R1 H1 M1 MT OT M2 H2 R2), 1 and 3 west, 2 and 4 east.
      const CONGA = ['R1', 'H1', 'M1', 'MT', 'OT', 'M2', 'H2', 'R2'];
      const teth = shuffle(S).slice(0, 4), elem = teth.map(() => pick(['fire', 'lightning']));
      const west = [teth[0], teth[2]], east = [teth[1], teth[3]];
      const rest = CONGA.filter(s => !teth.includes(s));
      // The untethered join their own group's side (G1 west); melee and tanks flex across when a side is short.
      const wF = rest.filter(s => G1.includes(s)), eF = rest.filter(s => G2.includes(s));
      while (wF.length > 2) { const s = wF.find(x => near(x)) || wF[wF.length - 1]; wF.splice(wF.indexOf(s), 1); eF.push(s); }
      while (eF.length > 2) { const s = eF.find(x => near(x)) || eF[eF.length - 1]; eF.splice(eF.indexOf(s), 1); wF.push(s); }
      wF.sort((a, b) => CONGA.indexOf(a) - CONGA.indexOf(b)); eF.sort((a, b) => CONGA.indexOf(a) - CONGA.indexOf(b));
      const sideOf = { W: -1, E: 1 };
      // Spots for one side's bait: its source on the tether spot (5.5 out), and for fire the other three stacked 2
      // further out; for lightning the other tether 2 out, the fillers 2 north and south of the source.
      const baitSpots = (sx, src, other, fill, fire) => {
        const o = {};
        o[src] = [sx * 5.5, 0];
        if (fire) { const cl = clumpAt([other, ...fill], [sx * 7.7, 0]); Object.assign(o, cl); }
        else { o[other] = [sx * 7.6, 0]; o[fill[0]] = [sx * 5.5, 2.2]; o[fill[1]] = [sx * 5.5, -2.2]; }
        return o;
      };
      const label4 = elem.map(e => (e === 'fire' ? 'Fire' : 'Lightning'));
      label(fof, `Fall of Faith (${label4.join(' > ')})`);
      teth.forEach((s, k) => {
        debuff(s, 'floatingFetters', 'Floating Fetters', `tether ${k + 1}: ${elem[k]}, ${k % 2 ? 'east' : 'west'}`, cs + 1 + k, tB[k]);
        call(cs + 1 + 2 * k, `${k + 1}: ${label4[k]}${k % 2 ? ' (east)' : ' (west)'}`, { slot: s, alert: true, dur: 4 });
        label(baits[k], `${elem[k] === 'fire' ? 'Sinblaze (shared cone)' : 'Sinsmite (three cones)'} ${k + 1}`);
      });
      call(cs + 8.5, `${label4.join(' => ')}`, { alert: true, dur: 8 });
      // Before the first: each side waits for its first bait.
      const side = (sx, srcs, fill, k) => baitSpots(sx, srcs[k], srcs[1 - k], fill, elem[sx < 0 ? 2 * k : 2 * k + 1] === 'fire');
      pref(cs + 3, Object.assign(side(-1, west, wF, 0), side(1, east, eF, 0)));
      pref(tB[0] + 0.1, side(-1, west, wF, 1));
      pref(tB[1] + 0.1, side(1, east, eF, 1));
      // The baits: from the source on its spot at the nearest one (fire: a 90-degree cone the three share) or the
      // three nearest (lightning: 120-degree cones).
      teth.forEach((s, k) => {
        const others = k % 2 ? (k === 1 ? [east[1], ...eF] : [east[0], ...eF]) : (k === 0 ? [west[1], ...wF] : [west[0], ...wF]);
        if (elem[k] === 'fire') {
          const tgt = others[0];
          hz({ t: tB[k], tell: fet[k], effect: 'share', shape: 'cone', from: s, aim: tgt, targets: [tgt], half: 45, r: 60, r0: 0.5, min: 3, max: 3, dmg: 0.4, name: 'Sinblaze' });
        } else {
          hz({ t: tB[k], tell: fet[k], effect: 'bait', shape: 'cone', from: s, aim: 'target', targets: others, half: 60, r: 60, r0: 0.5, dmg: 0.9, own: 0.35, name: 'Bow Shock' });
        }
        hz({ t: tB[k], tell: fet[k], effect: 'bait', shape: 'circle', from: 'target', targets: [s], r: 0.8, dmg: 0.4, own: 0.4, name: elem[k] === 'fire' ? 'Sinblaze' : 'Sinsmite' });
      });
      pref(tB[3] + 0.3, UP);
    }

    // --- Explosion: the line, its knockback or widening, the towers, the tanks' Burn Marks ---
    const bs = E('Burnt Strike', 120, 160);
    if (bs) {
      const tLine = bs.t, tSecond = tOf(E('Blastburn/Burnout', bs.t, bs.t + 4), bs.t + 1.8), tTow = tOf(E('Explosion', bs.t, bs.t + 8), bs.t + 3.8);
      const fire = Math.random() < 0.5, sx = pick([-1, 1]);
      const ev2 = E('Blastburn/Burnout', bs.t, bs.t + 4);
      label(bs, `Burnt Strike (${fire ? 'fire: knockback' : 'lightning: then 20 wide'})`);
      label(ev2, fire ? 'Blastburn (knockback 15)' : 'Burnout (20 wide)');
      const line = (w) => ({ shape: 'rect', a: [-w / 2, -R - 2], b: [w / 2, R + 2] });
      hz(Object.assign({ t: tLine, tell: castOf(bs, 6.5), dmg: 1.3, name: 'Burnt Strike' }, line(10)));
      if (fire) {
        hz({ t: tSecond, tell: tLine, effect: 'knockback', at: [0, 0], dist: 15, dir: 90, shape: 'rect', a: [0, -R - 2], b: [R + 2, R + 2], dmg: 0, name: 'Blastburn', react: 3 });
        hz({ t: tSecond, tell: tLine, effect: 'knockback', at: [0, 0], dist: 15, dir: 270, shape: 'rect', a: [-R - 2, -R - 2], b: [0, R + 2], dmg: 0, name: 'Blastburn', react: 3, hidden: true });
      } else hz(Object.assign({ t: tSecond, tell: tLine - 1, dmg: 1.3, name: 'Burnout' }, line(20)));
      // Three towers on one side, north to south, of 1-4 each (six in all).
      const SPLITS = [[1, 1, 4], [1, 4, 1], [4, 1, 1], [1, 2, 3], [1, 3, 2], [2, 1, 3], [2, 3, 1], [3, 1, 2], [3, 2, 1], [2, 2, 2]];
      const need = pick(SPLITS);
      const TOW = [[sx * 15, 8], [sx * 16.5, 0], [sx * 15, -8]];
      // H1, R2, H2 fixed north to south; M1, M2, R1 fill north to south.
      const fixed = ['H1', 'R2', 'H2'], flex = ['M1', 'M2', 'R1'], soak = [[fixed[0]], [fixed[1]], [fixed[2]]];
      let f = 0;
      for (let i = 0; i < 3; i++) for (let j = 1; j < need[i]; j++) soak[i].push(flex[f++]);
      TOW.forEach((p, i) => hz({ t: tTow, tell: castOf({ t: tTow, cast: 10.5 }), effect: 'tower', shape: 'circle', at: p, r: 4, soak: need[i], dmg: 0.4, fail: 1.2, name: 'Explosion' }));
      // Fire: wait on your tower's row just off the line, to be thrown into it; lightning: in the tower, out of the 20.
      const spots = {};
      soak.forEach((g, i) => {
        if (fire) Object.assign(spots, place(g.map(s => [s, [sx * 5.7, TOW[i][1] * (i === 1 ? 1 : 0.9)], 0.3]), { m: 0 }));
        else Object.assign(spots, clumpAt(g, add(TOW[i], [sx * 0.6, 0])));
      });
      spots.MT = fire ? [-sx * 5.8, 7] : [-sx * 12.5, 7]; spots.OT = fire ? [-sx * 5.8, -7] : [-sx * 12.5, -7];
      pref(castOf(bs, 6.5) + 1.5, spots);
      if (fire) {
        const inner = {};
        soak.forEach((g, i) => Object.assign(inner, place(g.map(s => [s, [sx * (i === 1 ? 4.2 : 2.8), TOW[i][1] * (i === 1 ? 1 : 0.9)], 0.3]), { m: 0 })));
        inner.MT = [-sx * 3, 7]; inner.OT = [-sx * 3, -7];
        pref(tLine + 0.1, inner);
        const after = {};
        soak.forEach((g, i) => Object.assign(after, clumpAt(g, add(TOW[i], [sx * 1.2, 0]), { floor: onFloor(1.0) })));
        after.MT = [-sx * 16, 9]; after.OT = [-sx * 16, -9];
        pref(tSecond + 0.6, after);
      }
      call(castOf(bs, 6.5), fire ? 'Line => knockback into your tower' : 'Line => out (20 wide): into your tower', { alert: true, dur: 6 });
      soak.forEach((g, i) => g.forEach(s => call(castOf(bs, 6.5) + 0.5, `Tower ${['north', 'middle', 'south'][i]} (${need[i]})`, { slot: s, alert: true, dur: 5 })));
      pref(tTow + 1.2, UP);
    }
  }

  B.FIGHT_SCRIPTS = B.FIGHT_SCRIPTS || {};
  B.FIGHT_SCRIPTS.fru = {
    // The main pool: P1 Fatebreaker (22,289,071), P4 the Usurper and the Oracle (11,943,869 each) and P5 Pandora
    // (48,541,857), from one FFLogs kill (report 1bxym3nNVFf7rCk9); P2's and P3's bosses and the intermission's adds are
    // `adds` pools of their own.
    hp: 22289071 + 2 * 11943869 + 48541857,
    adds: [
      { from: 196, to: 392, hp: 25151231, share: 1, name: 'Usurper of Frost (P2: under 20% by Absolute Zero)' },
      { from: 411.4, to: 488.8, hp: 4 * 1628795 + Math.round(2513805 / 2), share: 1, whileAway: true, name: 'Crystals of Light and the Ice Veil' },
      { from: 488.8, to: 680, hp: 30909445, share: 1, name: 'Oracle of Darkness (P3: under 20% by Memory\'s End)' },
    ],
    pushes: [
      { from: 0, to: 196, dealt: 22289071, name: 'Fatebreaker defeated' },
      { from: 160.4, to: 196, dealt: 0, name: 'P1 over' },
      { from: 411.4, to: 488.8, adds: 1, name: 'The Ice Veil shatters' },
      { from: 455.8, to: 488.8, dealt: 0, name: 'Intermission over' },
      { from: 680.8, to: 1010, dealt: 22289071 + 2 * 11943869, name: 'The Usurper and the Oracle defeated' },
      { from: 856.6, to: 1010, dealt: 0, name: 'P4 over' },
    ],
    defaultStrat: 'naur',
    strats: { naur: { label: 'NAUR' } },
    source: 'wtfdig.info/ultimates/fru; mechanics after BossMod (github.com/awgil/ffxiv_bossmod)',
    arena: { shape: 'circle', at: [0, 0], r: R },
    // NAUR's: A north, B east, C south, D west; 1 north-west, 2 north-east, 3 south-east, 4 south-west.
    waymarks: [
      { label: 'A', at: [0, 15], color: 'red' }, { label: 'B', at: [15, 0], color: 'yellow' },
      { label: 'C', at: [0, -15], color: 'blue' }, { label: 'D', at: [-15, 0], color: 'purple' },
      { label: '1', at: r2(at(315, 15)), color: 'red', square: true }, { label: '2', at: r2(at(45, 15)), color: 'yellow', square: true },
      { label: '3', at: r2(at(135, 15)), color: 'blue', square: true }, { label: '4', at: r2(at(225, 15)), color: 'purple', square: true },
    ],
    plan,
  };
})(window.BLM);
