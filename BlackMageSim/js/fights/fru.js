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

    // The arena's look by phase (the zone's models: n4gw_a1_stg01-02 and a1_dmg00 Fatebreaker's crystal stage, a1_flo01
    // the Usurper's snowflake floor, a2_ome01-02 the Oracle's dark floor, a8_flo01 Pandora's garden; a0_wall1 the
    // ruins round the first two, a0_spa01 and a3_spa01 the skies).
    P.looks.push({ t: 0, show: ['a1_stg', 'a1_dmg', 'a0_wall', 'a0_spa'] }, { t: 196, show: ['a1_flo', 'a0_wall', 'a0_spa'] },
      { t: 488.8, show: ['a2_ome', 'a3_spa'] }, { t: 1010, show: ['a8_flo', 'a0_spa'] });
    phase1(ctx);
    phase2(ctx);
    phase3(ctx);
    phase4(ctx);
    phase5(ctx);

    P.prefs.sort((a, b) => a.t - b.t);
    P.boss.sort((a, b) => a.t - b.t);
    P.form.sort((a, b) => a.t - b.t);
    P.hitbox.sort((a, b) => a.t - b.t);
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
        for (const s of S) hz({ t, tell: k ? t - 2 : t1, shape: 'cone', at: [0, 0], deg: CB_CLOCK[s] + off, half: 11.5, r: 60, dmg: 0.7, name: 'Cyclonic Break', react: 0 });
      });
      // With the second: supports counterclockwise, DPS clockwise; pairs (fire) together, spreads (lightning) in and out.
      pref(t1 + 0.1, all(s => spot(s, isSup(s) ? -22.5 : 22.5, fire ? 6 : rad(s))));
      if (fire) stack(t2, SUP, 6, 2, 'Sinsmoke', { tell: cs + 0.5 });
      else spreads(t2, S, 6, 'Sinsmite', { tell: cs + 0.5 });
      // Back to the spots for the third (turned 22.5 onto the gaps), out to the gaps again for the fourth (45: onto
      // the spots).
      pref(t2 + 0.1, all(s => spot(s, 0)));
      pref(t3 + 0.1, all(s => spot(s, isSup(s) ? -22.5 : 22.5, fire ? 6 : rad(s))));
      call(cs + 0.5, fire ? 'Clock spots => Pairs' : 'Clock spots => Spread', { alert: true, dur: 6 });
      call(t1 + 0.1, fire ? 'Supports CCW, DPS CW: pair up' : 'Supports CCW, DPS CW: spread', { dur: 2 });
      call(t2 + 0.1, 'Back to your spot', { dur: 2 });
      call(t3 + 0.1, 'Out to the gap again', { dur: 2 });
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
      // The clones with a hand up show at second tShow: everyone to the safe axis's spots.
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
      const cbEnd = toh.t - 1.2;
      hz(Object.assign({ t: tL1, tell: cbEnd + 0.05, dmg: 1.3, name: 'Burnt Strike' }, line(10)));
      hz(Object.assign({ t: tOut, tell: cbEnd + 0.05, dmg: 1.3, name: 'Burnout' }, line(20)));
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
      // (The clone's proteans end first: then out of the line's 20 on your own side, across to the safe side after it.)
      pref(cbEnd + 0.1, all(s => { const b = CB_CLOCK[s], x = Math.abs(Math.sin(b * Math.PI / 180)) < 0.3 ? side : Math.sign(Math.sin(b * Math.PI / 180)); return r2([x * 12.5, lane(s)]); }));
      pref(tOut + 0.15, all(s => r2([side * 6.2, lane(s)])));
      pref(tL3 + 0.1, all(s => r2([side * 2.8, lane(s)])));
      pref(tKb + 0.6, Object.assign(clumpAt([...north], [side * 16.5, 6.6]), clumpAt([...south], [side * 16.5, -6.6])));
      stack(tStk, [tN, tS], 6, 4, 'Sinsmoke', { tell: tKb });
      call(cbEnd + 0.1, `Out of the line => ${side > 0 ? 'east' : 'west'} safe, in your lane`, { alert: true, dur: 5 });
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

  // ===== P2: Usurper of Frost, and the intermission =====
  function phase2(c) {
    const { P, hz, pref, call, debuff, mark, label, E, EA, tOf, castOf, raid, spreads, stack, buster, events } = c;
    const UP = uptime(HB.p2);
    const t0 = 196;
    P.form.push({ t: t0, model: 'shiva' });
    P.hitbox.push({ t: t0, r: HB.p2 });
    P.boss.push({ t: t0, at: [0, 0] });
    P.untargetable.push([160.4, 204.1]);
    pref(t0, UP);
    // --- raidwides ---
    for (const n of ['Diamond Dust', 'Light Rampant']) { const ev = E(n, t0, 392); raid(ev, 0.5, n); if (ev) call(castOf(ev, 5), 'Raidwide', { dur: 3 }); }
    // --- Quadruple Slap: a buster on the main tank, the second after the swap on the other ---
    const qs1 = E('Quadruple Slap 1', t0, 230), qs2 = E('Quadruple Slap 2', t0, 230);
    if (qs1) { buster(qs1.t, ['MT'], 1.2, 'Quadruple Slap', { tell: castOf(qs1, 5) }); call(castOf(qs1, 5), 'Tank buster => swap', { dur: 4 }); }
    if (qs2) { buster(qs2.t, ['OT'], 1.2, 'Quadruple Slap', { tell: castOf(qs2, 2.5) }); call(castOf(qs2, 2.5), 'Provoke: take the second hit', { slot: 'OT', alert: true, dur: 3 }); }

    // --- Diamond Dust ---
    const mi = E('Mirror Image', t0, 240), dd = E('Diamond Dust', t0, 245);
    if (dd) {
      const kick = E('Axe Kick/Scythe Kick', dd.t, dd.t + 15), tK = tOf(kick, dd.t + 8.7), kc = tK - 6;
      const tHoL = tK + 0.8, tStone = tOf(E('Frigid Stone', dd.t, dd.t + 15), tK + 2.6);
      const tKb = tOf(E('Heavenly Strike', dd.t, dd.t + 20), tK + 6.9), tNeedle = tOf(E('Frigid Needle', dd.t, dd.t + 25), tKb + 2.7);
      const holy = [1, 2, 3, 4].map(k => tOf(E(`Sinbound Holy ${k} (puddles)`, dd.t, dd.t + 30), [255.5, 256.9, 258.5, 260.1][k - 1] - 235.9 + dd.t));
      const tGaze = tOf(E('Shining Armor + Frost Armor', dd.t, dd.t + 35), holy[3] + 3.8);
      const tw1 = E('Twin Stillness/Twin Silence', dd.t, dd.t + 40), tw2 = E('Twin Silence/Twin Stillness', dd.t, dd.t + 42);
      const tT1 = tOf(tw1, tGaze + 6.6), tT2 = tOf(tw2, tT1 + 2.1);
      const axe = Math.random() < 0.5, dpsMarked = Math.random() < 0.5, card = Math.random() < 0.5, rot = pick([45, -45]);
      const marked = dpsMarked ? DPS : SUP, unmarked = dpsMarked ? SUP : DPS;
      const th0 = pick(card ? [0, 90] : [45, 135]);           // the first circles' axis
      label(kick, axe ? 'Axe Kick (out)' : 'Scythe Kick (in)');
      label(dd, `Diamond Dust (${axe ? 'out' : 'in'}, first circles on the ${card ? 'cardinals' : 'intercardinals'})`);
      // The clone in the middle; the Usurper jumps south, back to the middle for the knockback.
      const phi = pick([0, 45, 90, 135, 180, 225, 270, 315]), still = Math.random() < 0.5;
      P.others.push({ model: 'ryne', path: [{ t: 0, at: [0, 0] }], shows: [[tOf(mi, dd.t - 7.1), tT2 + 3]], face: r2(at(phi, 10)) });
      P.boss.push({ t: tOf(mi, dd.t - 7) - 4, at: [0, -16], move: 1 }, { t: tKb - 3, at: [0, 0] });
      // Each colour pair a letter and a number: the unmarked bait on the first circles' kind (close), the marked
      // on the other; the cone baiters close in after Axe Kick, the marked out to drop their stones.
      const mkOf = (s) => { const [l, n] = COLOUR[s], kindCard = unmarked.includes(s) === card; return MARK[kindCard ? l : n]; };
      const r0 = (s) => (unmarked.includes(s) ? (axe ? 17 : 1.2) : (axe ? 19 : 3.2));
      pref(kc + 0.5, all(s => r2(at(mkOf(s), r0(s)))));
      hz(axe ? { t: tK, tell: kc, shape: 'circle', at: [0, 0], r: 16, dmg: 1.4, name: 'Axe Kick' } : { t: tK, tell: kc, shape: 'donut', at: [0, 0], r0: 4, r1: 20, dmg: 1.4, name: 'Scythe Kick' });
      // House of Light: a cone at each of the four nearest the clone.
      hz({ t: tHoL, tell: kc, effect: 'bait', shape: 'cone', from: [0, 0], aim: 'target', targets: { nearest: 4 }, half: 15, r: 60, dmg: 0.9, own: 0.3, name: 'House of Light' });
      pref(tK + 0.1, all(s => r2(at(mkOf(s), unmarked.includes(s) ? (axe ? 4 : 1.2) : (axe ? 19 : 8)))));
      for (const s of marked) {
        debuff(s, 'prey', 'Frigid Stone', axe ? 'drop the stone at the edge' : 'drop the stone on the inner ring', kc, tStone);
        hz({ t: tStone, tell: kc, effect: 'bait', shape: 'circle', from: 'target', targets: [s], r: 5, snap: 0.6, dmg: 0.9, own: 0.3, name: 'Frigid Stone' });
      }
      const stoneAt = Object.fromEntries(marked.map(s => [s, r2(at(mkOf(s), axe ? 19 : 8))]));
      // Frigid Needle: the stones go off.
      for (const s of marked) hz({ t: tNeedle, tell: tStone, shape: 'circle', at: stoneAt[s], r: 5, dmg: 1.1, name: 'Frigid Needle', react: 2 });
      // Icicle Impact: three pairs of circles (10) at 14 out, four seconds apart, from the first axis turning 45
      // degrees a pair (the last on the axis across the first).
      const tIc = EA('Icicle Impact', dd.t, dd.t + 25).map(e => e.t);
      while (tIc.length < 3) tIc.push((tIc[tIc.length - 1] || tStone + 0.4) + 3.95);
      tIc.slice(0, 3).forEach((t, k) => [0, 180].forEach(o => hz({ t, tell: t - 9, shape: 'circle', at: r2(at(th0 + rot * k + o, 16)), r: 10, dmg: 1.2, name: 'Icicle Impact', react: k ? 2 : 1.5 })));
      // Into the middle out of the first circles, then each group to 6 out on the first axis (G1 the end
      // counterclockwise from north) for Heavenly Strike's 12 to throw it into the first circles' spots.
      const g1End = (th0 === 0 || th0 === 45) ? (th0 === 0 ? 0 : 225) : (th0 === 90 ? 270 : 315), g2End = deg360(g1End + 180);
      const endOf = (s) => (G1.includes(s) ? g1End : g2End);
      pref(tHoL + 0.1, all(s => (marked.includes(s) ? r2(at(mkOf(s), axe ? 19 : 8)) : r2(at(endOf(s), 1.5)))));
      pref(tStone - 0.55, all(s => r2(at(endOf(s), 2.2))));
      pref(tIc[0] + 0.1, Object.assign(clumpAt(G1, at(g1End, 6)), clumpAt(G2, at(g2End, 6))));
      hz({ t: tKb, tell: tKb - 4, effect: 'knockback', at: [0, 0], dist: 12, dmg: 0, name: 'Heavenly Strike' });
      // Sinbound Holy: four light-party stacks on the healers, each group walking away from the turning circles to
      // the last pair's spots (inside the stones dropped at the edge, outside those on the inner ring).
      const wr = axe ? 13 : 17.6, sg = -Math.sign(rot);
      const way = [[sg * 22, wr], [sg * 38, wr], [sg * 55, 15], [sg * 72, 16.5], [sg * 90, 17]];
      const camp = (k) => Object.assign(clumpAt(G1, at(g1End + way[k][0], way[k][1])), clumpAt(G2, at(g2End + way[k][0], way[k][1])));
      pref(tKb + 0.6, camp(0));
      pref(tNeedle + 0.1, camp(1));
      holy.forEach((t, k) => {
        stack(t, ['H1', 'H2'], 6, 4, 'Sinbound Holy', { tell: t - (k ? 1.5 : 5), dmg: 0.25 });
        if (k < 3) pref(t + 0.1, camp(k + 2));
      });
      call(kc + 0.3, `${axe ? 'Out' : 'In'}: ${unmarked === SUP ? 'supports' : 'DPS'} bait the cones (${card ? 'letters' : 'numbers'})`, { alert: true, dur: 6 });
      call(tStone + 0.2, 'Middle => knockback to the first circles', { alert: true, dur: 4 });
      call(tKb + 0.4, `Light parties: rotate ${rot > 0 ? 'counterclockwise' : 'clockwise'} with the stacks`, { dur: 5 });
      // Shining Armor: look away from the Usurper (outside the arena); then Twin Stillness/Silence from the clone,
      // facing phi: 270 degrees in front and 90 behind, one then the other.
      const gazeAt = r2(at(pick([300, 330, 0, 30, 60]), 23));
      P.boss.push({ t: holy[3] + 0.5, at: gazeAt }, { t: tT2 + 3, at: [0, 0] });
      hz({ t: tGaze, tell: tGaze - 4, effect: 'gaze', from: 'boss', dmg: 0.8, status: ['stun', 3], name: 'Shining Armor' });
      call(tGaze - 4, 'Look away from the Usurper', { alert: true, dur: 4 });
      const back = deg360(phi + 180);
      const front = { shape: 'cone', at: [0, 0], deg: phi, half: 135, r: 30 }, rear = { shape: 'cone', at: [0, 0], deg: back, half: 45, r: 40 };
      const [h1, h2] = still ? [front, rear] : [rear, front];
      hz(Object.assign({ t: tT1, tell: tT1 - 3.5, dmg: 1.4, name: still ? 'Twin Stillness' : 'Twin Silence', react: 1.2 }, h1));
      hz(Object.assign({ t: tT2, tell: tT1, dmg: 1.4, name: still ? 'Twin Stillness' : 'Twin Silence', react: 1.6 }, h2));
      label(tw1, still ? 'Twin Stillness (front, then back)' : 'Twin Silence (back, then front)');
      label(tw2, still ? 'Twin Stillness (back)' : 'Twin Silence (front)');
      // The two groups on the rear cone's two edges: inside it for the front cone, a step out for the rear one.
      const inn = 36, out = 55;
      const spot = (g, a) => clumpAt(g, at(back + (g === G1 ? -a : a), 15), { m: 0 });
      pref(holy[3] + 0.2, Object.assign(spot(G1, still ? inn : out), spot(G2, still ? inn : out)));
      pref(tT1 + 0.05, Object.assign(spot(G1, still ? out : inn), spot(G2, still ? out : inn)));
      call(tT1 - 3.4, still ? 'Behind the clone, then slide out' : 'Beside the clone, then slide behind', { alert: true, dur: 4 });
      pref(tT2 + 0.2, UP);
    }

    // --- Hallowed Ray: a line stack from the boss at someone ---
    const hr = E('Hallowed Ray', 270, 300);
    if (hr) {
      const tgt = pick(S), deg = pick([135, 180, 225]);
      hz({ t: hr.t + 0.6, tell: castOf(hr, 5), effect: 'share', shape: 'line', from: 'boss', aim: 'target', targets: [tgt], len: 65, w: 6, min: 8, dmg: 0.25, name: 'Hallowed Ray' });
      pref(castOf(hr, 5) + 0.3, Object.assign(place(S.filter(s => s !== tgt).map(s => [s, at(deg, 9.5), 0.5]), { m: 0, keep: [r2(at(deg, 11))], keepSep: 0.5 }), { [tgt]: r2(at(deg, 11)) }));
      call(castOf(hr, 5) + 0.3, `Line stack on ${tgt}`, { alert: true, dur: 5 });
      pref(hr.t + 1, UP);
    }

    // --- Mirror Mirror ---
    const mm = E('Mirror, Mirror', 280, 310);
    if (mm) {
      const sk = E('Scythe Kick', mm.t, mm.t + 20), tS = tOf(sk, mm.t + 14.1), tP1 = tS + 0.7;
      const red = E('Reflected Scythe Kick', mm.t, mm.t + 30), tR = tOf(red, tS + 10.1), tP2 = tR + 0.6;
      const ban = E('Banish III', mm.t, mm.t + 40), tBan = tOf(ban, tR + 6.1);
      const b = pick([0, 45, 90, 135, 180, 225, 270, 315]), d = pick([90, 135]);
      const shiva = r2(at(b + 180, 16.5)), blue = r2(at(b, 20));
      const reds = [deg360(b + d), deg360(b - d)];
      // Each group to the red mirror clockwise of it (the nearest; clockwise when two are as near).
      const cwFrom = (a) => reds.slice().sort((x, y) => deg360(x - a) - deg360(y - a))[0];
      const redG1 = cwFrom(b + 180), redG2 = reds.find(x => x !== redG1);
      label(mm, `Mirror, Mirror (blue mirror ${dir8(b)}, red ${dir8(reds[0])} and ${dir8(reds[1])})`);
      P.boss.push({ t: mm.t + 1, at: shiva, move: 1.2 }, { t: tOf(E('Light Rampant', mm.t, mm.t + 60), tBan + 9.4) - 6, at: [0, 0], move: 1 });
      // G1 with the Usurper, G2 with the blue mirror, 3.5 out of each, their cones pointing out and to the sides.
      const ring = (g, src, inward, offs) => assign(g, offs.map(o => r2(add(src, at(inward + o, 3.4)))));
      const OFFS = [-140, 140, -95, 95];
      pref(mm.t + 1.5, Object.assign(ring(G1, shiva, b, OFFS), ring(G2, blue, b + 180, [-45, 45, -85, 85])));
      hz({ t: tS, tell: castOf(sk, 6), shape: 'donut', from: 'boss', r0: 4, r1: 20, dmg: 1.4, name: 'Scythe Kick' });
      hz({ t: tS, tell: castOf(sk, 6), shape: 'donut', at: blue, r0: 4, r1: 20, dmg: 1.4, name: 'Reflected Scythe Kick' });
      hz({ t: tP1, tell: castOf(sk, 6), effect: 'bait', shape: 'cone', from: 'boss', aim: 'target', targets: { nearest: 4 }, half: 15, r: 60, dmg: 0.9, own: 0.3, name: 'House of Light' });
      hz({ t: tP1, tell: castOf(sk, 6), effect: 'bait', shape: 'cone', from: blue, aim: 'target', targets: { nearest: 4, of: blue }, half: 15, r: 60, dmg: 0.9, own: 0.3, name: 'House of Light' });
      // Then each to its red mirror: its donut and four cones.
      const rG1 = r2(at(redG1, 20)), rG2 = r2(at(redG2, 20));
      // (The mirrors stand at the edge: the blue one's ring, the red ones'.)
      mark({ shape: 'circle', at: r2(at(b, 19)), r: 1.4 }, mm.t, tS + 0.5, 'rgba(90,170,255,0.7)');
      for (const a of reds) mark({ shape: 'circle', at: r2(at(a, 19)), r: 1.4 }, mm.t, tR + 0.5, 'rgba(255,90,90,0.7)');
      // (Their cones fan out to the side away from the other red mirror.)
      const away = (a, other) => { const rel = ((brg(sub(at(other, 20), at(a, 20))) - (a + 180)) % 360 + 540) % 360 - 180; return [10, -15, -45, -75].map(o => o * Math.sign(rel || 1)); };
      const fan = (a, other) => (Math.abs(deg360(other - a) - 180) < 20 ? [-55, -25, 25, 55] : away(a, other));
      pref(tP1 + 0.2, Object.assign(ring(G1, rG1, redG1 + 180, fan(redG1, redG2)), ring(G2, rG2, redG2 + 180, fan(redG2, redG1))));
      for (const [p, a] of [[rG1, redG1], [rG2, redG2]]) {
        hz({ t: tR, tell: castOf(red || { t: tR }, 10), shape: 'donut', at: p, r0: 4, r1: 20, dmg: 1.4, name: 'Reflected Scythe Kick' });
        hz({ t: tP2, tell: castOf(red || { t: tR }, 10), effect: 'bait', shape: 'cone', from: p, aim: 'target', targets: { nearest: 4, of: p }, half: 15, r: 60, dmg: 0.9, own: 0.3, name: 'House of Light' });
      }
      call(mm.t + 1, `G1 to the Usurper (${dir8(b + 180)}), G2 to the blue mirror (${dir8(b)})`, { alert: true, dur: 6 });
      call(tP1 + 0.2, `Red mirrors: G1 ${dir8(redG1)}, G2 ${dir8(redG2)}`, { alert: true, dur: 6 });
      // Banish III: pairs (supports with their partner) or spreads, round each red mirror.
      const pairs = Math.random() < 0.5;
      label(ban, pairs ? 'Banish III (pairs)' : 'Banish III Divided (spread)');
      const PART = { MT: 'M1', H1: 'R1', OT: 'M2', H2: 'R2' };
      const g2pos = (g, rp, a) => {
        const inw = a + 180;
        if (pairs) {
          const [s1, s2] = g.filter(isSup), out = {};
          [[s1, -40], [s2, 40]].forEach(([s, o]) => { const p = add(rp, at(inw + o, 7)); out[s] = r2(p); out[PART[s]] = r2(add(p, at(inw, 0.8))); });
          return out;
        }
        return assign(g, [-70, -23, 23, 70].map(o => r2(add(rp, at(inw + o, 7.5)))));
      };
      pref(tP2 + 0.3, Object.assign(g2pos(G1, rG1, redG1), g2pos(G2, rG2, redG2)));
      if (pairs) stack(tBan, SUP, 5, 2, 'Banish III', { tell: castOf(ban || { t: tBan }, 5) });
      else spreads(tBan, S, 5, 'Banish III Divided', { tell: castOf(ban || { t: tBan }, 5) });
      call(castOf(ban || { t: tBan }, 5), pairs ? 'Pairs' : 'Spread', { alert: true, dur: 4 });
      pref(tBan + 0.3, UP);
    }

    // --- Light Rampant ---
    const lr = E('Light Rampant', 320, 345);
    if (lr) {
      const ham = [1, 2, 3, 4, 5].map(k => tOf(E(`Luminous Hammer ${k}`, lr.t, lr.t + 20), lr.t + 8 + 1.6 * (k - 1)));
      const tTow = tOf(E('Bright Hunger (solo towers)', lr.t, lr.t + 20), lr.t + 11.3), tPL = tOf(E('Powerful Light', lr.t, lr.t + 25), lr.t + 17.1);
      const tB1 = tOf(E('Burst 1', lr.t, lr.t + 30), lr.t + 19.5), tB2 = tOf(E('Burst 2', lr.t, lr.t + 30), tB1 + 3);
      const tMid = tOf(E('Bright Hunger (group tower)', lr.t, lr.t + 30), lr.t + 26.1), ban = E('Banish III', lr.t, lr.t + 40), tBan = tOf(ban, lr.t + 29.2);
      const hol = E('The House of Light', lr.t + 30, lr.t + 50), tHoL = tOf(hol, tBan + 8.9);
      // Two puddle baiters; the other six tethered, one to each tower (16 out): the conga north (supports, healers
      // west) and south (DPS, ranged west), turned to fill three a side.
      const bait = shuffle(S).slice(0, 2);
      const N = ['H1', 'H2', 'MT', 'OT'].filter(s => !bait.includes(s)), Sth = ['R1', 'R2', 'M1', 'M2'].filter(s => !bait.includes(s));
      while (N.length > 3) Sth.push(N.pop());                 // (four supports: OT turns clockwise to the south)
      while (Sth.length > 3) N.unshift(Sth.shift());          // (four DPS: R1 turns clockwise to the north)
      const towers = { NW: 300, N: 0, NE: 60, SW: 240, S: 180, SE: 120 };
      const towerOf = {};
      ['NW', 'N', 'NE'].forEach((k, i) => { towerOf[N[i]] = towers[k]; });
      ['SW', 'S', 'SE'].forEach((k, i) => { towerOf[Sth[i]] = towers[k]; });
      const [bN, bS] = bait;
      for (const s of S) if (!bait.includes(s)) debuff(s, 'chainsOfLight', 'Chains of Everlasting Light', `your tower: ${dir8(towerOf[s])}`, lr.t + 3, tTow);
      for (const s of bait) debuff(s, 'lightsteeped', 'Luminous Hammer', `bait five puddles ${s === bN ? 'north' : 'south'}, toward the middle then left`, lr.t + 3, ham[4]);
      pref(lr.t + 3, Object.assign(all(s => (bait.includes(s) ? null : r2(at(towerOf[s], 16.6)))), { [bN]: [0, 10.2], [bS]: [0, -10.2] }));
      // The puddle baiters' walk: toward the middle, then left after the third.
      const PN = [[0, 10.2], [0, 6.6], [0, 3.6], [4.2, 4], [7.8, 5]], PS = PN.map(p => [-p[0], -p[1]]);
      ham.forEach((t, k) => {
        hz({ t, tell: t - 1.6, effect: 'bait', shape: 'circle', from: 'target', targets: bait, r: 6, snap: 0.3, dmg: 0.9, own: 0.25, name: 'Luminous Hammer' });
        if (k) pref(ham[k - 1] + 0.05, { [bN]: PN[k], [bS]: PS[k] });
      });
      pref(tTow - 4, Object.fromEntries(S.filter(s => !bait.includes(s)).map(s => [s, r2(at(towerOf[s], 16.6))])));
      for (const [k, a] of Object.entries(towers)) hz({ t: tTow, tell: tTow - 8, effect: 'tower', shape: 'circle', at: r2(at(a, 16)), r: 4, soak: 1, dmg: 0.4, fail: 1.2, name: 'Bright Hunger' });
      call(lr.t + 3, 'Tethers to towers; puddles toward the middle, then left', { alert: true, dur: 6 });
      // Powerful Light: a 4-stack north and south (one target each side).
      const nGrp = N.concat([bN]), sGrp = Sth.concat([bS]);
      const sN = pick(nGrp), sS = pick(sGrp);
      const camps = Object.assign(clumpAt(nGrp, [0, 17]), clumpAt(sGrp, [0, -17]));
      pref(tTow + 0.2, Object.fromEntries(Object.entries(camps).filter(([s]) => !bait.includes(s))));
      pref(ham[4] + 0.1, { [bN]: camps[bN], [bS]: camps[bS] });
      stack(tPL, [sN, sS], 5, 4, 'Powerful Light', { tell: tTow });
      // The orbs (11): three, then three more; out north and south they don't reach.
      const orbs1 = [60, 240].map(a => r2(at(a, 9))), orbs2 = [120, 300].map(a => r2(at(a, 9)));
      orbs1.forEach(p => hz({ t: tB1, tell: tB1 - 5, shape: 'circle', at: p, r: 11, dmg: 1.2, name: 'Holy Light Burst', react: 1.5 }));
      orbs2.forEach(p => hz({ t: tB2, tell: tB2 - 5, shape: 'circle', at: p, r: 11, dmg: 1.2, name: 'Holy Light Burst', react: 1.5 }));
      // The middle tower: those who soaked a tower (two stacks); the puddle baiters stay out.
      const mid = S.filter(s => !bait.includes(s));
      hz({ t: tMid, tell: tB2 - 1, effect: 'tower', shape: 'circle', at: [0, 0], r: 4, soak: [1, 8], only: mid, dmg: 0.3, fail: 1.2, name: 'Bright Hunger' });
      pref(tB2 + 0.1, Object.assign(clumpAt(mid, [0, 0]), { [bN]: [0, 12], [bS]: [0, -12] }));
      call(tB2, 'Two stacks: into the middle tower', { dur: 3 });
      for (const s of bait) call(tB2, 'Stay out of the middle tower', { slot: s, alert: true, dur: 3 });
      // Banish III: clock spots (MT N, R2 NE, H2 E, M2 SE, OT S, M1 SW, H1 W, R1 NW); pairs: supports 45 degrees
      // counterclockwise onto their DPS.
      const pairs = Math.random() < 0.5;
      label(ban, pairs ? 'Banish III (pairs)' : 'Banish III Divided (spread)');
      const CL = { MT: 0, R2: 45, H2: 90, M2: 135, OT: 180, M1: 225, H1: 270, R1: 315 };
      pref(tMid + 0.1, all(s => r2(at(CL[s] - (pairs && isSup(s) ? 45 : 0), pairs ? 10 : 13))));
      if (pairs) stack(tBan, SUP, 5, 2, 'Banish III', { tell: castOf(ban || { t: tBan }, 5) });
      else spreads(tBan, S, 5, 'Banish III Divided', { tell: castOf(ban || { t: tBan }, 5) });
      call(castOf(ban || { t: tBan }, 5), pairs ? 'Pairs (supports CCW)' : 'Spread', { alert: true, dur: 4 });
      // The House of Light: a protean at everyone from the boss; clock spots.
      pref(tBan + 0.2, all(s => r2(at(CL[s], near(s) ? 6.8 : 10))));
      hz({ t: tHoL + 0.6, tell: castOf(hol || { t: tHoL }, 5), shape: 'protean', half: 15, r: 60, dmg: 0.8, own: 0.25, name: 'The House of Light' });
      call(castOf(hol || { t: tHoL }, 5), 'Proteans: clock spots', { dur: 4 });
      pref(tHoL + 1, UP);
    }

    // --- Absolute Zero; the intermission ---
    const az = events.find(e => e.name === 'Absolute Zero' && e.t > 380 && e.t < 400);
    if (az) {
      hz({ t: az.t, tell: az.t - 10, raidwide: true, dmg: 0.5, name: 'Absolute Zero' });
      label(az, 'Absolute Zero (the Usurper under 20%: raidwide, else enrage)');
      call(az.t - 10, 'Raidwide => knockback', { dur: 4 });
    }
    const sf = E('Swelling Frost', 385, 400), tSF = tOf(sf, 392.4);
    P.untargetable.push([tOf(az, 390.1) - 10, 514.3]);
    pref(tSF - 4, clumpAt(S, [0, -3]));
    hz({ t: tSF, tell: tSF - 3, effect: 'knockback', at: [0, 0], dist: 10, dmg: 0.3, status: ['stun', 2], name: 'Swelling Frost' });
    // Crystals of Light on the cardinals (15 out), of Darkness on the intercardinals (8): tanks and melee out on
    // the cardinals baiting the puddles (MT N, OT E, M1 S, M2 W), healers and ranged on the intercardinals baiting
    // the cones (R2 NE, H2 SE, H1 SW, R1 NW).
    const tUp = 411.4, tEnd = 488.8;
    const CARD = { MT: 0, OT: 90, M1: 180, M2: 270 }, INTER = { R2: 45, H2: 135, H1: 225, R1: 315 };
    for (const a of [0, 90, 180, 270]) mark({ shape: 'circle', at: r2(at(a, 15)), r: 1.6 }, tUp - 3, tEnd, 'rgba(160,230,255,0.55)');
    for (const a of [45, 135, 225, 315]) mark({ shape: 'circle', at: r2(at(a, 8)), r: 1.6 }, tUp - 3, tEnd, 'rgba(150,90,220,0.55)');
    mark({ shape: 'circle', at: [0, 0], r: 5 }, tSF, tEnd, 'rgba(170,220,255,0.3)');
    pref(tSF + 1.5, Object.assign(Object.fromEntries(Object.entries(CARD).map(([s, a]) => [s, r2(at(a, 17.5))])),
      Object.fromEntries(Object.entries(INTER).map(([s, a]) => [s, r2(at(a, 9.5))]))));
    // Hiemal Storm: a puddle (7) on each cardinal's baiter; Sinbound Blizzard: a cone at each dark crystal's
    // nearest. (Killed in time, they stop: the adds window's push.)
    for (const ev of EA('Hiemal Storm', 420, 455)) {
      for (const [s, a] of Object.entries(CARD)) hz({ t: ev.t, tell: ev.t - 3.3, shape: 'circle', from: 'target', targets: [s], r: 7, snap: 2.6, dmg: 0.9, name: 'Hiemal Storm', ifAlive: 1, react: 2.5 });
    }
    for (const ev of EA('Sinbound Blizzard III', 420, 455)) {
      for (const [s, a] of Object.entries(INTER)) hz({ t: ev.t, tell: ev.t - 3.3, effect: 'bait', shape: 'cone', from: r2(at(a, 8)), aim: 'target', targets: [s], half: 10, r: 50, dmg: 0.9, own: 0.3, snap: 3.3, name: 'Sinbound Blizzard III', ifAlive: 1 });
    }
    // The cardinals' baiters circle their crystal a little each puddle.
    const storms = EA('Hiemal Storm', 420, 455);
    storms.forEach((ev, k) => pref(ev.t - 2.5, Object.fromEntries(Object.entries(CARD).map(([s, a]) => [s, r2(at(a + (k % 2 ? 22 : -22), 17.5))]))));
    call(tUp - 2, 'Tanks and melee out on the cardinals, healers and ranged in on the intercardinals: kill the light crystals', { alert: true, dur: 6 });
    const eia = events.find(e => e.name === 'Endless Ice Age' && e.kind === 'enrage');
    label(eia, 'Endless Ice Age (enrage: break the Ice Veil before it)');
    pref(tEnd + 0.5, clumpAt(S, [0, -6]));
  }

  // ===== P3: Oracle of Darkness =====
  function phase3(c) {
    const { P, hz, pref, call, debuff, mark, label, E, EA, tOf, castOf, raid, spreads, stack, buster, events } = c;
    const t0 = 488.8, UP = uptime(HB.p3);
    const jn = E('Junction', t0, 510), hj = E('Hell\'s Judgment', t0, 530);
    if (jn) { raid(jn, 0.5, 'Junction', { tell: jn.t - 3 }); call(jn.t - 3, 'Raidwide', { dur: 3 }); }
    P.form.push({ t: t0, model: 'shiva' }, { t: tOf(jn, 500) + 0.5, model: 'none' }, { t: tOf(hj, 518.3) - 4.5, model: 'oracle' });
    P.hitbox.push({ t: tOf(hj, 518.3) - 4.5, r: HB.p3 });
    P.boss.push({ t: t0, at: [0, 0] });
    if (hj) { hz({ t: hj.t, tell: castOf(hj, 4), raidwide: true, dmg: 0.55, name: 'Hell\'s Judgment' }); call(castOf(hj, 4), 'HP to 1: heal up', { dur: 4 }); }
    pref(tOf(hj, 518.3) - 4, UP);

    // --- Ultimate Relativity ---
    const ur = E('Ultimate Relativity', 520, 545);
    if (ur) {
      const tF = [544.2, 554.3, 564.3].map(t => t - 532.4 + ur.t);
      const fireEvs = events.filter(e => /^Dark Fire III/.test(e.name) && e.t > ur.t && e.t < ur.t + 40);
      fireEvs.forEach((e, k) => { tF[k] = e.t; label(e, e.name.split('/').join(' + ')); });
      label(E('Shadoweye/Dark Water III/Dark Eruption', ur.t, ur.t + 50), 'Shadoweye + Dark Water III + Dark Eruption');
      const melt = [1, 2, 3].map(k => tOf(E(`Sinbound Meltdown ${k} (x10)`, ur.t, ur.t + 45), [549.4, 559.4, 570.4][k - 1] - 532.4 + ur.t));
      const tRew = tOf(E('(stun + rewind)', ur.t, ur.t + 45), ur.t + 40.8), tRes = tOf(E('Shadoweye/Dark Water III/Dark Eruption', ur.t, ur.t + 50), tRew + 3);
      raid(ur, 0.5, 'Ultimate Relativity', { tell: castOf(ur, 10) });
      call(castOf(ur, 10), 'Raidwide => relativity', { dur: 4 });
      // Relative north: the three yellow hourglasses' middle one. Supports: fire 10 s north, 20 s west, 30 s
      // north-east (tank) and north-west (healer); DPS: 10 s south-east (melee) and south-west (ranged), 20 s east,
      // 30 s south. (Two of one role on a pair of spots: G2 keeps its side, G1 swaps.)
      const north = pick([0, 45, 90, 135, 180, 225, 270, 315]);
      const shuf = (a) => shuffle(a);
      const sup = shuf(SUP), dps = shuf(DPS);
      const fire = {}, dir = {};
      fire[sup[0]] = 1; fire[sup[1]] = 2; fire[sup[2]] = 3; fire[sup[3]] = 3;
      fire[dps[0]] = 1; fire[dps[1]] = 1; fire[dps[2]] = 2; fire[dps[3]] = 3;
      const pairSide = (pair, eastOk) => {
        // eastOk(s): whether s naturally takes the east spot of the pair (tanks NE, melee SE).
        const [a, b] = pair, ea = eastOk(a), eb = eastOk(b);
        if (ea !== eb) return ea ? [a, b] : [b, a];
        return G2.includes(a) === ea ? [a, b] : [b, a];         // both alike: G2 keeps its natural side
      };
      const [supE, supW] = pairSide([sup[2], sup[3]], s => TANKS.includes(s));
      const [dpsE, dpsW] = pairSide([dps[0], dps[1]], s => s === 'M1' || s === 'M2');
      dir[sup[0]] = 0; dir[sup[1]] = 270; dir[supE] = 45; dir[supW] = 315;
      dir[dpsE] = 135; dir[dpsW] = 225; dir[dps[2]] = 90; dir[dps[3]] = 180;
      const abs = (s) => deg360(north + dir[s]);
      // Blizzard on the 10 s support and the 30 s DPS; Eruption on the 20 s pair; Dark Water on a 10 s DPS; eyes on
      // the 30 s three.
      const bliz = [sup[0], dps[3]], erupt = [sup[1], dps[2]], water = dps[0], eyes = [supE, supW, dps[3]];
      const laser = (s) => (fire[s] === 3 ? 1 : fire[s] === 1 ? 2 : 3);
      const FIRE_HINT = { 1: '10 s', 2: '20 s', 3: '30 s' };
      for (const s of S) {
        debuff(s, 'darkFire', 'Spell-in-Waiting: Dark Fire III', `${FIRE_HINT[fire[s]]}: out to ${dirName(abs(s))}`, ur.t + 1.8, tF[fire[s] - 1]);
        call(ur.t + 2, `${FIRE_HINT[fire[s]]} fire: ${dir8(dir[s])} (relative), laser ${laser(s)}`, { slot: s, alert: true, dur: 8 });
      }
      for (const s of bliz) debuff(s, 'darkBlizzard', 'Spell-in-Waiting: Dark Blizzard III', 'in the middle with the stack', ur.t + 1.8, tF[1]);
      for (const s of erupt) debuff(s, 'darkEruption', 'Spell-in-Waiting: Dark Eruption', 'rewind at your hourglass', ur.t + 1.8, tRes);
      debuff(water, 'darkWater', 'Spell-in-Waiting: Dark Water III', 'rewind in the middle', ur.t + 1.8, tRes);
      for (const s of eyes) debuff(s, 'shadoweye', 'Spell-in-Waiting: Shadoweye', 'rewind just out of the middle', ur.t + 1.8, tRes);
      label(ur, `Ultimate Relativity (north is ${dirName(north)})`);
      // The hourglasses: 9.5 out at the eight directions; yellow (relative NE, NW, S) fire first, then N, SE, SW,
      // then purple (E, W). Each laser (5 wide) from its hourglass at its baiter, turning 15 degrees a hit, ten hits.
      const HG = { 1: [45, 315, 180], 2: [0, 135, 225], 3: [90, 270] };
      for (const [k, list] of Object.entries(HG)) {
        for (const rd of list) {
          const a = deg360(north + rd), hp = r2(at(a, 9.5)), spin = pick([1, -1]);
          mark({ shape: 'circle', at: hp, r: 1 }, ur.t, tRes + 1, k === '1' ? 'rgba(255,230,90,0.6)' : k === '3' ? 'rgba(190,110,255,0.6)' : 'rgba(220,220,220,0.5)');
          // Baited from beside it, 67.5 degrees round from out against its turn, so it sweeps the outside only.
          const baiter = S.find(s => laser(s) === +k && dir[s] === rd);
          const d0 = deg360(a - spin * 67.5), bait = r2(add(hp, at(d0, 1.8)));
          const t1 = melt[k - 1];
          if (baiter) pref(t1 - 4.5, { [baiter]: bait });
          for (let n = 0; n < 10; n++) {
            hz({ t: +(t1 + n * 1.02).toFixed(2), tell: n ? t1 + (n - 1) * 1.02 : t1 - 3, shape: 'line', at: hp, deg: d0 + spin * 15 * n, len: n ? 50 : 60, w: 5, dmg: 1.1, name: 'Sinbound Meltdown', react: n ? 1.2 : 2 });
          }
        }
      }
      // Each round's fire spreads (8) out at 13 in their direction, Unholy Darkness's stack on the rest in the middle.
      const mid = (slots) => clumpAt(slots, [0, 0], { m: 0 });
      const spot = (s, r) => r2(at(abs(s), r));
      [1, 2, 3].forEach((k) => {
        const t = tF[k - 1], out = S.filter(s => fire[s] === k), rest = S.filter(s => fire[s] !== k);
        pref(t - 4.2, Object.assign(mid(rest), Object.fromEntries(out.map(s => [s, spot(s, 13.5)]))));
        spreads(t, out, 8, 'Dark Fire III', { tell: t - 5 });
        stack(t, [rest.find(s => !bliz.includes(s)) || rest[0]], 6, rest.length, 'Unholy Darkness', { tell: t - 5, max: 8 });
        if (k === 2) for (const s of bliz) hz({ t, tell: t - 5, effect: 'bait', shape: 'donut', from: 'target', targets: [s], r0: 4, r1: 12, dmg: 1.0, own: 0, name: 'Dark Blizzard III' });
      });
      // The rewinds: the 20 s pair (eruption) at their hourglass's inner side, the 10 s ones in the middle, as the first
      // lasers go; the eyes just out of the middle as the second go. (Your rewind is where you stand then.)
      const rew = {};
      for (const s of S) rew[s] = laser(s) === 1 ? spot(s, 2.2) : erupt.includes(s) ? spot(s, 8.6) : r2(mul(at(abs(s), 1), 0.6));
      pref(melt[0] - 0.8, Object.fromEntries(S.filter(s => laser(s) !== 1).map(s => [s, rew[s]])));
      pref(melt[0] + 0.3, Object.fromEntries(S.filter(s => laser(s) !== 1 && laser(s) !== 2).map(s => [s, mid([s])[s]])));
      pref(melt[1] - 0.8, Object.fromEntries(S.filter(s => laser(s) === 1).map(s => [s, rew[s]])));
      // Back in after baiting (behind the hourglass, out of its sweep).
      for (const k of [1, 2, 3]) pref(melt[k - 1] + 0.25, Object.fromEntries(S.filter(s => laser(s) === k).map(s => [s, k === 1 ? rew[s] : spot(s, 2.5)])));
      // The rewind: back to where each placed it; then Dark Eruption (6) at the pair's, Dark Water on the middle,
      // the eyes' gazes (look out).
      pref(tRew - 0.2, rew);
      spreads(tRes, erupt, 6, 'Dark Eruption', { tell: tRew });
      stack(tRes, [water], 6, 4, 'Dark Water III', { tell: tRew, max: 8 });
      // (Shadoweye's gazes: everyone in the middle looks out, past the eyes; the sim calls it rather than checking
      // your facing.)
      call(tRew, 'Rewind: look out, away from the eyes', { alert: true, dur: 3 });
      pref(tRes + 0.2, UP);
    }
    // --- Shell Crusher, Shockwave Pulsar, Black Halo ---
    const sc = E('Shell Crusher', 575, 590);
    if (sc) {
      const tRes = tOf(E('Shadoweye/Dark Water III/Dark Eruption', 560, 590), sc.t - 3.9);
      stack(sc.t, ['MT'], 6, 8, 'Shell Crusher', { tell: castOf(sc, 3) - 1 });
      pref(tRes + 0.3, clumpAt(S, [0, HB.p3 + 1]));
      call(castOf(sc, 3), 'Stack', { dur: 3 });
      pref(sc.t + 0.3, UP);
    }
    for (const ev of EA('Shockwave Pulsar', t0, 680)) { raid(ev, 0.5, 'Shockwave Pulsar'); call(castOf(ev, 5), 'Raidwide', { dur: 3 }); }
    const bh = E('Black Halo', 590, 600);
    if (bh) {
      hz({ t: bh.t + 0.2, tell: castOf(bh, 5), effect: 'share', shape: 'cone', from: 'boss', aim: 'MT', targets: ['MT'], half: 45, r: 60, min: 2, max: 2, dmg: 0.55, name: 'Black Halo' });
      pref(castOf(bh, 5), Object.assign({}, UP, { MT: [-0.6, HB.p3 + 0.6], OT: [0.6, HB.p3 + 0.6] }));
      call(castOf(bh, 5), 'Shared tank buster', { slot: 'MT', dur: 4 });
      call(castOf(bh, 5), 'Shared tank buster', { slot: 'OT', dur: 4 });
    }

    // --- Apocalypse ---
    const ap = E('Apocalypse', 610, 630);
    if (ap) {
      const dw = EA('Dark Water III', ap.t, ap.t + 35).map(e => e.t), st = E('Spirit Taker', ap.t, ap.t + 10), tSt = tOf(st, ap.t + 5.1) + 0.3;
      while (dw.length < 3) dw.push([624.8, 643.7, 652.8][dw.length] - 621.2 + ap.t);
      const tA = tOf(E('Apocalypse (x6)', ap.t, ap.t + 20), ap.t + 14), steps = [0, 1, 2, 3, 4, 5].map(k => +(tA + 2 * k).toFixed(2));
      const tEr = tOf(E('Dark Eruption', ap.t, ap.t + 25), steps[1] + 0.7);
      const tJump = tOf(E('Darkest Dance (jump)', ap.t, ap.t + 30), steps[5] + 0.8), tKb = tOf(E('Darkest Dance (knockback)', ap.t, ap.t + 30), tJump + 2.9);
      // Dark Water on six, two at each timer, one of each per light party (G1 left, G2 right; swaps by priority).
      const groups = { L: G1.slice(), Rt: G2.slice() };
      // (After the swaps by priority, T1 > T2 > H1 > H2 | M1 > M2 > R1 > R2, each group has one of each timer.)
      const wOf = {};
      for (const g of ['L', 'Rt']) shuffle(groups[g]).slice(0, 3).forEach((s, k) => { wOf[s] = k; });
      const tgts = [0, 1, 2].map(k => S.filter(s => wOf[s] === k));
      for (const s of Object.keys(wOf)) debuff(s, 'darkWater', 'Spell-in-Waiting: Dark Water III', `stack ${wOf[s] + 1}`, ap.t - 15, dw[wOf[s]]);
      // The lights: from the start axis S0 turning R a step, three steps going off at once (and the middle first).
      const s0 = pick([0, 45, 90, 135]), R = pick([45, -45]);
      const axis = (k) => deg360(s0 + R * k);
      const A3 = axis(3), A0 = axis(4);
      // G1 takes the end counterclockwise from north (N, NW, W, SW), G2 the other.
      const g2side = (a) => { const x = deg360(a); return x > 20 && x <= 200; };
      const endFor = (a, g) => ((g === 'Rt') === g2side(a) ? deg360(a) : deg360(a + 180));
      const eL = (a) => endFor(a, 'L'), eR = (a) => endFor(a, 'Rt');
      label(ap, `Apocalypse (starting ${dir8(s0)}, turning ${R > 0 ? 'clockwise' : 'counterclockwise'})`);
      // Water 1: the groups west and east of the middle (G1 west).
      pref(ap.t - 14, Object.assign(clumpAt(groups.L, [-6, 0]), clumpAt(groups.Rt, [6, 0])));
      stack(dw[0], tgts[0], 6, 4, 'Dark Water III', { tell: dw[0] - 5 });
      // Spirit Taker: spread in the boxes.
      const box = (g, x) => assign(groups[g], [[x * 6, 5], [x * 6, -5], [x * 14, 7], [x * 14, -7]]);
      pref(dw[0] + 0.15, Object.assign(box('L', -1), box('Rt', 1)));
      const stT = pick(S);
      hz({ t: tSt, tell: tSt - 3, effect: 'bait', shape: 'circle', from: 'target', targets: [stT], r: 5, dmg: 0.8, own: 0.4, name: 'Spirit Taker' });
      hz({ t: tSt + 0.05, tell: tSt - 3, effect: 'knockback', shape: 'circle', from: stT, r: 5, dist: 40, dmg: 0, name: 'Spirit Taker', hidden: true, react: 0 });
      P.boss.push({ t: tSt, at: [0, 0] });
      // The circles (9): pairs 14 out on axis k, and the middle on the first two steps.
      steps.forEach((t, j) => {
        for (const k of [j, j - 1, j - 2]) {
          if (k < 0 || k > 5) continue;
          for (const o of [0, 180]) hz({ t, tell: t - 4, shape: 'circle', at: r2(at(axis(k) + o, 14)), r: 9, dmg: 1.3, name: 'Apocalypse', react: 1.8 });
        }
        if (j <= 1) hz({ t, tell: t - 4, shape: 'circle', at: [0, 0], r: 9, dmg: 1.3, name: 'Apocalypse', react: 1.8 });
      });
      // First lights: each group at its end of A3 (safe for three steps); Dark Eruption (6) on two a group: one 19
      // out a little to each side of it, the rest at 10; then into the middle before A3's turn.
      const erL = shuffle(groups.L).slice(0, 2), erR = shuffle(groups.Rt).slice(0, 2);
      const lightSpots = (g, e, ers) => {
        const out = {}, rest = groups[g].filter(s => !ers.slice(0, 2).includes(s));
        out[ers[0]] = r2(at(e - 11, 18.5)); out[ers[1]] = r2(at(e + 11, 18.5));
        return out;
      };
      const restOf = (g, ers) => groups[g].filter(s => !ers.includes(s));
      pref(tSt + 0.4, Object.assign(clumpAt(groups.L, at(eL(A3), 11)), clumpAt(groups.Rt, at(eR(A3), 11))));
      pref(steps[0] + 0.2, Object.assign(lightSpots('L', eL(A3), erL), lightSpots('Rt', eR(A3), erR)));
      pref(steps[1] + 0.1, Object.assign(clumpAt(restOf('L', erL), at(eL(A3), 7)), clumpAt(restOf('Rt', erR), at(eR(A3), 7))));
      for (const s of erL.slice(0, 2).concat(erR.slice(0, 2))) debuff(s, 'darkEruption', 'Dark Eruption', 'spread out at your end', tA - 3, tEr);
      spreads(tEr, erL.slice(0, 2).concat(erR.slice(0, 2)), 6, 'Dark Eruption', { tell: tEr - 5 });
      // Into the middle; Water 2 at 4.5 out on the start axis (each group its end); Darkest Dance: the main tank
      // baits it far (19) on the left group's end, then everyone close to the Oracle where she lands.
      pref(tEr + 0.1, Object.assign(clumpAt(erL, at(eL(A3), 2.5)), clumpAt(erR, at(eR(A3), 2.5))));
      pref(steps[2] + 0.1, Object.assign(clumpAt(groups.L, at(eL(A3), 2)), clumpAt(groups.Rt, at(eR(A3), 2))));
      const a0c = [0, 180].map(o => ({ shape: 'circle', at: r2(at(A0 + o, 14)), r: 9 }));
      const w2 = Object.assign(clumpAt(groups.L, at(eL(A0), 4.5), { avoid: a0c, m: 0.5 }), clumpAt(groups.Rt, at(eR(A0), 4.5), { avoid: a0c, m: 0.5 }));
      pref(steps[3] + 0.15, w2);
      stack(dw[1], tgts[1], 6, 4, 'Dark Water III', { tell: dw[1] - 5 });
      // (Out along the axis the lights just left, after sharing the water.)
      const A2 = axis(2), mtEnd = groups.L.includes('MT') ? eL(A2) : eR(A2), oracle = r2(at(mtEnd, 14));
      pref(dw[1] + 0.1, { MT: oracle });
      hz({ t: tJump, tell: dw[1], effect: 'bait', shape: 'circle', from: 'target', targets: { farthest: 1, of: [0, 0] }, r: 8, dmg: 1.4, own: 0.55, buster: true, name: 'Darkest Dance' });
      P.boss.push({ t: tJump, at: oracle }, { t: tKb + 6, at: [0, 0], move: 1.5 });
      // Close to her, a group either side, for the knockback (21) to throw each across the middle.
      const inward = deg360(mtEnd + 180);
      const kbSpot = (g, sgn) => clumpAt(groups[g], add(oracle, at(inward + sgn * 20, 2.6)), { m: 0 });
      const left = eL(A0) === mtEnd ? 'L' : 'Rt', right = left === 'L' ? 'Rt' : 'L';
      pref(tJump + 0.15, Object.assign(kbSpot(left, -1), kbSpot(right, 1)));
      hz({ t: tKb, tell: tJump, effect: 'knockback', from: 'boss', dist: 21, dmg: 0, name: 'Darkest Dance' });
      // Water 3 where they land.
      const land = (g, sgn) => clumpAt(groups[g], add(oracle, at(inward + sgn * 20, 23)), { m: 0 });
      pref(tKb + 0.7, Object.assign(land(left, -1), land(right, 1)));
      stack(dw[2], tgts[2], 6, 4, 'Dark Water III', { tell: dw[2] - 5 });
      call(ap.t - 14, 'Dark Water: G1 west, G2 east (one of each timer a group)', { alert: true, dur: 6 });
      call(steps[0] - 3, `Lights: ${dir8(eL(A3))} / ${dir8(eR(A3))} safe`, { alert: true, dur: 5 });
      call(steps[2], 'Into the middle', { alert: true, dur: 3 });
      call(dw[1] + 0.1, 'Darkest Dance: bait it far', { slot: 'MT', alert: true, dur: 4 });
      call(tJump, 'Close to the Oracle => knockback across', { alert: true, dur: 3 });
      pref(dw[2] + 0.3, UP);
    }
    const me = events.find(e => e.name === 'Memory\'s End' && e.kind === 'enrage');
    if (me) { hz({ t: me.t, tell: me.t - 10, raidwide: true, dmg: 0.5, name: 'Memory\'s End' }); label(me, 'Memory\'s End (the Oracle under 20%: raidwide, else enrage)'); }
    P.untargetable.push([tOf(me, 672) + 3.4, 680.8]);
  }

  // ===== P4: the Usurper of Frost and the Oracle of Darkness =====
  function phase4(c) {
    const { P, hz, pref, call, debuff, mark, label, E, EA, tOf, castOf, raid, spreads, stack, buster, events } = c;
    const t0 = 680.8, end = 856.5;
    // The Usurper (the sim's target: the zone's `ryne`) in the middle, the Oracle (`oracle`) beside her, south.
    const ORACLE = [0, -4];
    P.form.push({ t: 675.4, model: 'none' }, { t: t0, model: 'ryne' }, { t: end + 0.5, model: 'none' });
    P.hitbox.push({ t: t0, r: HB.p4 });
    P.boss.push({ t: t0, at: [0, 2] });
    const OP = [{ t: 0, at: ORACLE }];
    const UP = { MT: [-1, 8.7], OT: [1, 8.7], M1: [-3, -9.5], M2: [3, -9.5], H1: [-7, -12], H2: [7, -12], R1: [-11, -6], R2: [11, -6] };
    pref(t0, UP);
    for (const ev of events.filter(e => /^Edge of Oblivion/.test(e.name))) { raid(ev, 0.3, 'Edge of Oblivion'); }
    const dds = E('Darklit Dragonsong', t0, 730), ct = E('Crystallize Time', 760, 790);
    for (const ev of [dds, ct]) if (ev) { raid(ev, 0.5, ev.name); call(castOf(ev, 5), 'Raidwide', { dur: 3 }); }

    // --- Akh Rhai: everyone in the middle baits a puddle (4) that keeps going off; out to the Darklit spots ---
    const da = E('Drachen Armor', t0, 710), ar = E('Akh Rhai', t0, 710);
    const DARK = { H1: [-9, 9], H2: [-11, 7], MT: [9, 9], OT: [11, 7], R1: [-9, -9], R2: [-11, -7], M1: [9, -9], M2: [11, -7] };
    if (ar) {
      const tA = ar.t;
      pref(tOf(da, tA - 2.5) - 4, clumpAt(S, [0, -9.5]));
      for (let k = 0; k < 10; k++) hz({ t: +(tA + 0.2 + k * 0.5).toFixed(2), tell: tA - 2.5, shape: 'circle', from: 'target', targets: S, r: 4, snap: 2.6 + k * 0.5, dmg: 0.5, name: 'Akh Rhai', react: k ? 0 : 2.5, quiet: k > 0 });
      pref(tA - 2.45, DARK);
      call(tOf(da, tA - 2.5) - 4, 'Stack south => out to your Darklit spot as the wings sprout', { alert: true, dur: 6 });
    }

    // --- Darklit Dragonsong ---
    if (dds) {
      const tTow = tOf(E('Bright Hunger', dds.t, dds.t + 20), dds.t + 11.2), tPath = tOf(E('The Path of Light', dds.t, dds.t + 20), tTow + 0.9);
      const tSt = tOf(E('Spirit Taker', dds.t, dds.t + 20), tPath + 2.5), tWing = tOf(E('Dark Water III + Hallowed Wings', dds.t, dds.t + 25), tSt + 4.6);
      const tSD1 = tOf(E('Somber Dance (far)', dds.t, dds.t + 30), tWing + 3.6), tSD2 = tOf(E('Somber Dance (close)', dds.t, dds.t + 30), tSD1 + 3.3);
      // Four tethered: a healer, a tank and two DPS. They soak the towers (north and south of the middle, 8 out),
      // two each; the four others bait Path of Light from the Usurper at 4 out on the diagonals (untethered tank east,
      // healer west).
      const h = pick(['H1', 'H2']), tk = pick(TANKS), d2 = shuffle(DPS).slice(0, 2);
      const teth = [h, tk, ...d2], free = S.filter(s => !teth.includes(s));
      const water = [pick(teth), pick(free)];
      // Towers: the tethered healer and one DPS north, the tank and the other south (a bowtie: no swaps).
      const towN = [h, d2[0]], towS = [tk, d2[1]];
      const baitAt = {};
      const fTank = free.find(s => TANKS.includes(s)), fHeal = free.find(s => s[0] === 'H');
      if (fTank) baitAt[fTank] = 60; if (fHeal) baitAt[fHeal] = 300;
      const restAngles = [120, 240, 60, 300].filter(a => !Object.values(baitAt).includes(a));
      free.filter(s => baitAt[s] === undefined).forEach((s, i) => { baitAt[s] = restAngles[i]; });
      for (const s of teth) debuff(s, 'chainsOfLight', 'Chains of Everlasting Light', `soak the ${towN.includes(s) ? 'north' : 'south'} tower`, dds.t, tTow);
      for (const s of water) debuff(s, 'darkWater', 'Spell-in-Waiting: Dark Water III', 'a stack on the safe side', dds.t, tWing);
      const spots = {};
      towN.forEach((s, i) => { spots[s] = [i ? 1.8 : -1.8, 9.5]; });
      towS.forEach((s, i) => { spots[s] = [i ? 1.8 : -1.8, -9.5]; });
      for (const s of free) spots[s] = r2(add([0, 2], at(baitAt[s], 4.2)));
      pref(dds.t + 0.5, spots);
      for (const p of [[0, 8], [0, -8]]) hz({ t: tTow, tell: dds.t + 1, effect: 'tower', shape: 'circle', at: p, r: 4, soak: 2, only: teth, dmg: 0.4, fail: 1.2, name: 'Bright Hunger' });
      hz({ t: tPath, tell: tTow - 2, effect: 'bait', shape: 'cone', from: 'boss', aim: 'target', targets: free, half: 30, r: 60, dmg: 0.9, own: 0.35, name: 'The Path of Light' });
      call(dds.t + 0.5, 'Tethers: towers north/south; the rest bait the proteans close', { alert: true, dur: 6 });
      // Spirit Taker: spread (tethered on the intercardinals, untethered DPS in, supports out).
      const SPR = {};
      const tethI = [315, 45, 225, 135];
      [h, d2[0], d2[1], tk].forEach((s, i) => { SPR[s] = r2(at(tethI[i], 15)); });
      const fD = free.filter(s => !isSup(s));
      if (fTank) SPR[fTank] = [16, 0];
      if (fHeal) SPR[fHeal] = [-16, 0];
      fD.forEach((s, i) => { SPR[s] = [i ? -7.5 : 7.5, -1]; });
      free.forEach((s, i) => { if (!SPR[s]) SPR[s] = [i % 2 ? -16 : 16, 0]; });
      pref(tPath + 0.1, SPR);
      const stT = pick(S);
      hz({ t: tSt, tell: tSt - 3, effect: 'bait', shape: 'circle', from: 'target', targets: [stT], r: 5, dmg: 0.8, own: 0.4, name: 'Spirit Taker' });
      OP.push({ t: tSt - 0.4, at: ORACLE });
      // Hallowed Wings: the Usurper's half of the room (east or west); Dark Water stacks on the safe side, north
      // and south number markers.
      const safeE = Math.random() < 0.5, xs = safeE ? 1 : -1;
      hz({ t: tWing, tell: tWing - 5, shape: 'rect', a: [safeE ? -R - 2 : 0, -R - 2], b: [safeE ? 0 : R + 2, R + 2], dmg: 1.5, name: 'Hallowed Wings' });
      label(E('Dark Water III + Hallowed Wings', dds.t, dds.t + 25), `Dark Water III + Hallowed Wings (${safeE ? 'east' : 'west'} safe)`);
      const [nW, sW] = SPR[water[0]][1] >= SPR[water[1]][1] ? water : [water[1], water[0]];
      const north = new Set([nW]), south = new Set([sW]);
      for (const s of S.filter(x => !water.includes(x)).sort((a, b) => SPR[b][1] - SPR[a][1])) (north.size < 4 ? north : south).add(s);
      const camps = Object.assign(clumpAt([...north], [xs * 9.5, 8.5]), clumpAt([...south], [xs * 9.5, -8.5]));
      pref(tSt + 0.4, camps);
      stack(tWing, [nW, sW], 6, 4, 'Dark Water III', { tell: tWing - 5 });
      call(tWing - 5, `${safeE ? 'East' : 'West'} safe: water stacks north and south`, { alert: true, dur: 5 });
      // Somber Dance: the farthest from the Oracle, then the nearest (8): MT far across, OT close; the rest away.
      const far = r2([xs * 17, -4]), close = r2(add(ORACLE, [xs * 1.5, 0]));
      const restS = S.filter(s => !TANKS.includes(s));
      pref(tWing + 0.2, Object.assign({ MT: far, OT: close }, clumpAt(restS, [-xs * 6, 6])));
      hz({ t: tSD1, tell: tWing, effect: 'bait', shape: 'circle', from: 'target', targets: { farthest: 1, of: ORACLE }, r: 8, dmg: 1.4, own: 0.55, buster: true, name: 'Somber Dance' });
      hz({ t: tSD2, tell: tSD1, effect: 'bait', shape: 'circle', from: 'target', targets: { nearest: 1, of: ORACLE }, r: 8, dmg: 1.4, own: 0.55, buster: true, name: 'Somber Dance' });
      call(tWing, 'Somber Dance: far, then close', { slot: 'MT', alert: true, dur: 4 });
      call(tWing, 'Somber Dance: stay close to the Oracle', { slot: 'OT', alert: true, dur: 4 });
      pref(tSD2 + 0.2, UP);
    }

    // --- Akh Morn (7-1) and Morn Afah ---
    const akh = (ev, solo) => {
      if (!ev) return;
      const n = 5, tS = castOf(ev, 4);
      const rest = S.filter(s => s !== solo), host = solo === 'MT' ? 'OT' : 'MT';
      pref(tS + 0.2, Object.assign({ [solo]: [0, 16] }, clumpAt(rest, [0, -4.5])));
      for (let k = 0; k < n; k++) {
        const t = +(ev.t + k * 0.97).toFixed(2);
        hz({ t, tell: tS, effect: 'share', shape: 'circle', from: 'target', targets: [solo], r: 4, min: 1, max: 1, dmg: 0.45, name: 'Akh Morn', quiet: k > 0 });
        hz({ t, tell: tS, effect: 'share', shape: 'circle', from: 'target', targets: [host], r: 4, min: 7, max: 7, dmg: 0.3, name: 'Akh Morn', quiet: k > 0 });
      }
      call(tS, `Akh Morn: ${solo} out alone, the party stacks`, { alert: true, dur: 5 });
      label(ev, `Akh Morn (x5; ${solo} solo)`);
    };
    const morn = (ev) => {
      if (!ev) return;
      pref(castOf(ev, 6) + 0.3, clumpAt(S, [0, -4.5]));
      stack(ev.t + 0.9, ['OT'], 4, 8, 'Morn Afah', { tell: castOf(ev, 6), dmg: 0.4 });
      call(castOf(ev, 6), 'Morn Afah: everyone stack', { alert: true, dur: 5 });
    };
    const akhs = EA('Akh Morn (x5)', t0, end), morns = EA('Morn Afah', t0, end);
    akh(akhs[0], 'MT'); morn(morns[0]);
    akh(akhs[1], 'OT'); morn(morns[1]);
    if (morns[0]) pref(morns[0].t + 1.2, UP);

    // --- Crystallize Time ---
    if (ct) {
      const tFast = tOf(E('Maelstrom (fast)', ct.t, ct.t + 20), ct.t + 12), tWater = tOf(E('Dark Water III', ct.t, ct.t + 20), tFast + 1);
      const tAero = tOf(E('Dark Blizzard III + Dark Eruption + Dark Aero III', ct.t, ct.t + 20), tWater + 2), tNorm = tOf(E('Maelstrom (normal)', ct.t, ct.t + 25), tAero + 2.6);
      const tUnh = tOf(E('Unholy Darkness', ct.t, ct.t + 25), tNorm + 0.4), tSlow = tOf(E('Maelstrom (slow)', ct.t, ct.t + 30), tNorm + 4.9);
      const tides = EA('Tidal Light (x4)', ct.t, ct.t + 35).map(e => e.t);
      while (tides.length < 2) tides.push((tides[0] || tUnh + 3.4) + 6.3);
      const tQ = tOf(E('Quietus', ct.t, ct.t + 40), ct.t + 31.9), tDrop = tOf(E('(rewind drop)', ct.t, ct.t + 40), tQ + 2);
      const tSt = tOf(E('Spirit Taker', ct.t, ct.t + 45), tQ + 5.6), tRet = tOf(E('(stun + rewind)', ct.t, ct.t + 45), tSt + 3.4);
      const tW1 = tOf(E('Hallowed Wings 1', ct.t, ct.t + 50), tRet + 2.2), tW2 = tOf(E('Hallowed Wings 2', ct.t, ct.t + 55), tW1 + 4.6);
      if (tQ) { hz({ t: tQ, tell: tQ - 3, raidwide: true, dmg: 0.4, name: 'Quietus' }); }
      // The debuffs: claws (red) on four, fangs (blue) on the other four; red: two Aero, two Ice; blue: Eruption,
      // Ice, Unholy, Water.
      const order = shuffle(S), red = order.slice(0, 4), blue = order.slice(4);
      const PRI = ['MT', 'OT', 'H1', 'H2', 'M1', 'M2', 'R1', 'R2'];
      const pr = (a) => a.slice().sort((x, y) => PRI.indexOf(x) - PRI.indexOf(y));
      const rIce = shuffle(red).slice(0, 2), rAero = red.filter(s => !rIce.includes(s));
      const [bErupt, bIce, bUnh, bWater] = shuffle(blue);
      // Ice reds east and west (supports west, DPS east; two of one role: G1 swaps), aeros south-east and
      // south-west (DPS east); the purple (slow) hourglasses on one diagonal: eruption at its north end, the other
      // blues with an aero at its south end.
      const sideSplit = (pair, westFirst) => { const [a, b] = pr(pair); const wa = westFirst(a), wb = westFirst(b); return wa !== wb ? (wa ? [a, b] : [b, a]) : [a, b]; };
      const [iceW, iceE] = sideSplit(rIce, isSup), [aeroW, aeroE] = sideSplit(rAero, isSup);
      const purpleNE = Math.random() < 0.5;                     // purple on NE + SW, else NW + SE
      const pN = purpleNE ? 45 : 315, pS = deg360(pN + 180);
      const aeroWithGroup = pS === 225 ? aeroW : aeroE, aeroAlone = aeroWithGroup === aeroW ? aeroE : aeroW;
      for (const s of red) debuff(s, 'wyrmclaw', 'Wyrmclaw', rAero.includes(s) ? 'Dark Aero III: intercept a head' : 'Dark Blizzard III: intercept a head', ct.t + 1, tW2);
      for (const s of blue) debuff(s, 'wyrmfang', 'Wyrmfang', 'cleanse in a head\'s puddle', ct.t + 1, tW2);
      for (const s of rAero) debuff(s, 'darkAero', 'Spell-in-Waiting: Dark Aero III', 'knockback (15)', ct.t + 1, tAero);
      for (const s of rIce.concat([bIce])) debuff(s, 'darkBlizzard', 'Spell-in-Waiting: Dark Blizzard III', 'a donut round you', ct.t + 1, tAero);
      debuff(bErupt, 'darkEruption', 'Spell-in-Waiting: Dark Eruption', 'spread (6)', ct.t + 1, tAero);
      debuff(bWater, 'darkWater', 'Spell-in-Waiting: Dark Water III', 'the stack (4)', ct.t + 1, tWater);
      debuff(bUnh, 'unholyDarkness', 'Spell-in-Waiting: Unholy Darkness', 'the stack (5)', ct.t + 1, tUnh);
      // The hourglasses (12): yellow north and south first, then the other diagonal, then purple.
      const HG = (a) => r2(at(a, 17));
      const nd = purpleNE ? [315, 135] : [45, 225];
      for (const a of [0, 180]) hz({ t: tFast, tell: tFast - 6, shape: 'circle', at: HG(a), r: 12, dmg: 1.4, name: 'Maelstrom', react: 2 });
      for (const a of nd) hz({ t: tNorm, tell: tNorm - 6, shape: 'circle', at: HG(a), r: 12, dmg: 1.4, name: 'Maelstrom', react: 2 });
      for (const a of [pN, pS]) hz({ t: tSlow, tell: tSlow - 6, shape: 'circle', at: HG(a), r: 12, dmg: 1.4, name: 'Maelstrom', react: 2 });
      for (const a of [0, 180, ...nd, pN, pS]) mark({ shape: 'circle', at: HG(a), r: 1.2 }, ct.t + 3, a === pN || a === pS ? tSlow : nd.includes(a) ? tNorm : tFast,
        a === 0 || a === 180 ? 'rgba(255,230,90,0.6)' : a === pN || a === pS ? 'rgba(190,110,255,0.6)' : 'rgba(220,220,220,0.5)');
      label(ct, `Crystallize Time (purple ${dir8(pN)} and ${dir8(pS)})`);
      // Opening spots (out of the first, north and south).
      const grp = [bWater, bIce, bUnh, aeroWithGroup];
      const gIn = at(pS, 17.2), gOut = at(pS, 19.3);
      // (The ice on the group's side a little north, out of its aero's reach; the lone aero steps into the spent
      // south hourglass after the first, its knockback clear of everyone.)
      const gx = pS === 225 ? -1 : 1, iceG = gx < 0 ? iceW : iceE, iceO = iceG === iceW ? iceE : iceW;
      const open = Object.assign({ [iceG]: [gx * 19, 1.5], [iceO]: [-gx * 19, 0], [aeroAlone]: r2(at(pS === 225 ? 135 : 225, 19.3)), [bErupt]: r2(at(pN, 18.5)) },
        clumpAt([bWater, bIce, bUnh], gIn), { [aeroWithGroup]: r2(gOut) });
      pref(ct.t + 3.5, open);
      pref(tFast + 0.1, { [aeroAlone]: [-gx * 5, -17.5] });
      stack(tWater, [bWater], 6, 4, 'Dark Water III', { tell: tWater - 5, max: 4 });
      spreads(tAero, [bErupt], 6, 'Dark Eruption', { tell: tAero - 4 });
      for (const s of rIce.concat([bIce])) hz({ t: tAero, tell: tAero - 4, effect: 'bait', shape: 'donut', from: 'target', targets: [s], r0: 4, r1: 12, dmg: 1.1, own: 0, name: 'Dark Blizzard III' });
      // Dark Aero (15, knockback 30): the group's aero throws the water stack across; the other's throws nobody.
      for (const s of rAero) hz({ t: tAero, tell: tAero - 4, effect: 'knockback', shape: 'circle', from: s, targets: [s], r: 15, dist: 30, dmg: 0.2, name: 'Dark Aero III', react: 0 });
      const across = at(pN, 13);
      // After landing: Unholy Darkness (5) on the thrown group with the eruption and the ice on that side, at the
      // north purple corner; the rest out of the normal hourglasses.
      const iceNear = pN === 45 ? iceE : iceW, iceFar = iceNear === iceE ? iceW : iceE;
      const unhGrp = [bWater, bIce, bUnh, bErupt, iceNear];
      // (The far ice and both aeros wait by the middle, out of every hourglass's reach.)
      const fx = iceFar === iceW ? -1 : 1;
      pref(tAero + 0.1, Object.assign(clumpAt(unhGrp, at(pN, 13.5)), { [iceFar]: [fx * 6, -2], [aeroWithGroup]: [gx * 2, -3], [aeroAlone]: [gx * 1, -5.5] }));
      stack(tUnh, [bUnh], 6, 5, 'Unholy Darkness', { tell: tAero, max: 5 });
      // Tidal Light: waves 10 deep across the floor, one way from a side, then the other (north to south or back);
      // the party walks into each wave's first row once it has gone off, clear of the purple hourglasses.
      const ew = pick([1, -1]), ns = pick([1, -1]);
      const rows = [];
      for (let k = 0; k < 4; k++) {
        rows.push({ t: +(tides[0] + 2 * k).toFixed(2), shapes: [{ shape: 'rect', a: [ew * (20 - 10 * k), -22], b: [ew * (10 - 10 * k), 22] }] });
        rows.push({ t: +(tides[1] + 2 * k).toFixed(2), shapes: [{ shape: 'rect', a: [-22, ns * (20 - 10 * k)], b: [22, ns * (10 - 10 * k)] }] });
      }
      rows.sort((a, b) => a.t - b.t);
      for (const r of rows) hz(Object.assign({ t: r.t, tell: r.t - 3, dmg: 1.4, name: 'Tidal Light', react: 0 }, r.shapes[0]));
      const slowC = [pN, pS].map(a => ({ shape: 'circle', at: HG(a), r: 12 }));
      const steps = rows.map(r => ({ t: r.t, shapes: r.t > tSlow - 0.6 && r.t < tSlow + 0.6 ? r.shapes.concat(slowC) : r.shapes }));
      steps.push({ t: tSlow, shapes: slowC });
      steps.sort((a, b) => a.t - b.t);
      const tidePath = safePath(steps, at(pN, 13.5), () => [ew * 6, ns * -4], { m: 1.6, t0: tUnh + 0.3 }) || [];
      const tideKeys = [tUnh + 0.3].concat(steps.slice(0, -1).map(s => s.t + 0.05));
      tidePath.forEach((p, i) => pref(tideKeys[i], clumpAt(S, p, { m: 0 })));
      call(tides[0] - 3, `Waves from the ${ew > 0 ? 'east' : 'west'}: into the first row once it goes off`, { alert: true, dur: 5 });
      call(tides[1] - 3, `Waves from the ${ns > 0 ? 'north' : 'south'}`, { alert: true, dur: 4 });
      for (const s of blue) call(tides[0], 'Cleanse in a head\'s puddle', { slot: s, dur: 4 });
      // The rewinds (placed after Quietus): G1 west, G2 east of the middle; Spirit Taker spread from them; back to
      // them; Hallowed Wings from the north, then the south (knockback 20, the tanks in front).
      const rw = {};
      [G1, G2].forEach((g, j) => { const x = j ? 1 : -1; g.forEach((s, i) => { rw[s] = TANKS.includes(s) ? [x * 3, 9] : [x * (3 + 2.5 * (i % 2)), 6 - 2.6 * Math.floor(i / 2)]; }); });
      pref(tides[1] + 6.2, rw);
      for (const s of S) debuff(s, 'return', 'Return', 'back here at the rewind', tDrop, tRet);
      const sp = {};
      [G1, G2].forEach((g, j) => { const x = j ? 1 : -1; g.forEach((s, i) => { sp[s] = r2([x * (4 + 8 * (i % 2)), [13, 11, 4, 3][i]]); }); });
      pref(tDrop + 0.2, sp);
      const stT = pick(S);
      hz({ t: tSt, tell: tSt - 3, effect: 'bait', shape: 'circle', from: 'target', targets: [stT], r: 5, dmg: 0.8, own: 0.4, name: 'Spirit Taker' });
      pref(tSt + 0.2, rw);
      // The Usurper at the north edge, then the south: each wing a 50-wide sweep that throws everyone 20.
      P.boss.push({ t: tQ, at: [0, 17] }, { t: tW1 + 1, at: [0, -17] }, { t: tW2 + 3, at: [0, 2] });
      hz({ t: tW1, tell: tRet - 1, effect: 'knockback', at: [0, 17], dist: 20, dir: 180, shape: 'rect', a: [-25, -22], b: [25, 17], dmg: 0.3, name: 'Hallowed Wings', react: 0 });
      hz({ t: tW1, tell: tRet - 1, effect: 'bait', shape: 'circle', from: 'target', targets: ['MT', 'OT'], r: 1, dmg: 1.2, own: 0.5, buster: true, name: 'Hallowed Wings', quiet: true });
      const rw2 = Object.fromEntries(S.map(s => [s, r2([rw[s][0], -rw[s][1]])]));
      pref(tW1 + 0.6, rw2);
      hz({ t: tW2, tell: tW1, effect: 'knockback', at: [0, -17], dist: 20, dir: 0, shape: 'rect', a: [-25, -17], b: [25, 22], dmg: 0.3, name: 'Hallowed Wings', react: 0 });
      hz({ t: tW2, tell: tW1, effect: 'bait', shape: 'circle', from: 'target', targets: ['MT', 'OT'], r: 1, dmg: 1.2, own: 0.5, buster: true, name: 'Hallowed Wings', quiet: true });
      call(tRet - 1, 'Hallowed Wings: knocked south, then back north', { alert: true, dur: 5 });
      pref(tW2 + 0.7, UP);
    }
    const enr = events.find(e => e.name === 'Memory\'s End + Absolute Zero');
    label(enr, 'Memory\'s End + Absolute Zero (P4\'s enrage: push the pair before it)');
    P.others.push({ model: 'oracle', path: OP, shows: [[tOf(E('Akh Rhai', t0, 710), 702.9) + 3.3, end + 0.5]] });
  }

  // ===== P5: Pandora =====
  function phase5(c) {
    const { P, hz, pref, call, debuff, mark, label, E, EA, tOf, castOf, raid, spreads, stack, buster, events } = c;
    const t0 = 1010, UP = uptime(HB.p5);
    P.form.push({ t: t0, model: 'pandora' });
    P.hitbox.push({ t: t0, r: HB.p5 });
    P.boss.push({ t: t0, at: [0, 0] });
    P.untargetable.push([856.6, 1029.6]);
    pref(t0, UP);
    const enr = events.find(e => e.name === 'Paradise Lost' && e.kind === 'enrage');
    label(enr, 'Paradise Lost (enrage)');
    for (const ev of EA('Pandora\'s Box', t0, 1300)) {
      hz({ t: ev.t, tell: castOf(ev, 12), raidwide: true, dmg: 0.5, name: 'Pandora\'s Box' });
      call(castOf(ev, 12), 'Pandora\'s Box: tank LB3 (on "d")', { alert: true, dur: 6 });
    }

    // --- Fulgent Blade: six lines (5 deep, 80 wide) sweeping in from the edge, two at a time, a step every 2 s;
    // the party walks each crossing as it passes. Then Akh Morn: a 4-stack each side of her (G1 left, G2 right). ---
    for (const fb of EA('Fulgent Blade', t0, 1300)) {
      raid(fb, 0.5, 'Fulgent Blade');
      call(castOf(fb, 6), 'Raidwide => exalines', { dur: 3 });
      const pl = E('The Path of Darkness + The Path of Light', fb.t, fb.t + 15), T0 = tOf(pl, fb.t + 11.2);
      const am = E('Akh Morn', fb.t, fb.t + 40), tAm = tOf(am, T0 + 15.8);
      const base = pick([0, 60]) + pick([0, 15, 30, 45]), cw = pick([1, -1]);
      const lines = [];
      for (let p = 0; p < 3; p++) for (const o of [-30, 30]) lines.push({ deg: deg360(base + cw * 120 * p + o), t: T0 + 4 * p });
      const rows = {};
      for (const L of lines) {
        for (let k = 0; k <= 8; k++) {
          const t = +(L.t + 2 * k).toFixed(2), d = 21 - 5 * k;
          const sh = { shape: 'line', at: r2(at(L.deg, d)), deg: deg360(L.deg + 180), len: 5, w: 80 };
          hz(Object.assign({ t, tell: k ? t - 2.2 : L.t - 7, dmg: 1.3, name: L.deg % 2 ? 'Path of Light' : 'Path of Darkness', react: 0, quiet: k > 0 }, sh));
          (rows[t] = rows[t] || []).push(sh);
        }
      }
      const steps = Object.keys(rows).map(Number).sort((a, b) => a - b).map(t => ({ t, shapes: rows[t] }));
      // Each group's way through (the same till the stacks' spots matter), then to its side of her for Akh Morn.
      const side = (g) => r2(at(g === G1 ? 225 : 135, 8.5));
      const want = (g) => (t) => (t < tAm - 5 ? [0, -9] : side(g));
      const tStart = T0 - 2.5;
      const paths = [G1, G2].map(g => safePath(steps, [0, -9], want(g), { m: 1.4, t0: tStart }));
      [G1, G2].forEach((g, j) => {
        const path = paths[j] || [];
        path.forEach((p, i) => pref(i ? steps[i - 1].t + 0.05 : tStart, clumpAt(g, p, { m: 0 })));
      });
      pref(tStart - 2, clumpAt(S, [0, -9]));
      label(pl, `The Path of Darkness + The Path of Light (${cw > 0 ? 'clockwise' : 'counterclockwise'})`);
      call(T0 - 3, `Exalines ${cw > 0 ? 'clockwise' : 'counterclockwise'}: step into each crossing behind a line`, { alert: true, dur: 6 });
      // Akh Morn: the nearest on each side of her (left: G1) takes a 4-stack (4).
      if (am) {
        const [aL, aR] = [pick(G1), pick(G2)];
        stack(tAm + 0.1, [aL, aR], 4, 4, 'Akh Morn', { tell: castOf(am, 8), dmg: 0.35 });
        call(castOf(am, 8), 'Akh Morn: G1 left, G2 right of her', { alert: true, dur: 5 });
        label(am, 'Akh Morn (light left, dark right)');
      }
      pref(steps[steps.length - 1].t + 0.3, UP);
    }

    // --- Paradise Regained: three towers (3, two each) 7 out, the first relative south; Wings Dark and Light ---
    for (const pr of EA('Paradise Regained', t0, 1300)) {
      const wg = E('Wings Dark and Light', pr.t, pr.t + 15), tW1 = tOf(wg, pr.t + 10), tW2 = tOf(E('Wings Dark and Light + Explosion', pr.t, pr.t + 20), tW1 + 3.9);
      const exps = EA('Explosion', pr.t, pr.t + 20).map(e => e.t).concat(EA('Wings Dark and Light + Explosion', pr.t, pr.t + 20).map(e => e.t)).sort((a, b) => a - b);
      while (exps.length < 3) exps.push((exps[exps.length - 1] || tW1 + 0.4) + 3.5);
      const sig = pick([0, 120, 240]) + pick([0, 60]);        // relative south: the first tower
      const lightFirst = Math.random() < 0.5, o1 = lightFirst ? 60 : -60;
      const second = pick([1, -1]);                           // which side tower goes second
      const tw = [sig, deg360(sig + 120 * second), deg360(sig - 120 * second)];
      const twP = tw.map(a => r2(at(a, 7)));
      // G1's DPS take the tower left of relative north, G2's the right.
      const leftT = deg360(sig + 120), dL = ['M1', 'R1'], dR = ['M2', 'R2'];
      const soak = [['H1', 'H2'], tw[1] === leftT ? dL : dR, tw[1] === leftT ? dR : dL];
      tw.forEach((a, i) => hz({ t: exps[i], tell: pr.t + 0.9 + 3.5 * i, effect: 'tower', shape: 'circle', at: twP[i], r: 3, soak: 2, only: soak[i], dmg: 0.4, fail: 1.2, name: 'Explosion' }));
      label(wg, `Wings Dark and Light (${lightFirst ? 'light' : 'dark'} first; first tower ${dirName(sig)})`);
      // First cleave (240) at MT, who stands in a side tower so it points north; OT takes the tether (dark first:
      // nearest, in; light first: farthest, out); everyone else south (healers in the first tower).
      const mt1 = deg360(sig + 2 * o1), tc1 = lightFirst;     // tether on the farthest when light comes first
      const south = Object.assign({ MT: r2(at(mt1, 7)), OT: r2(at(sig, tc1 ? 17.5 : 1.6)) },
        clumpAt(['H1', 'H2'], twP[0]), assign(['M1', 'R1', 'M2', 'R2'], [r2(at(sig - 32, 9.5)), r2(at(sig - 26, 13)), r2(at(sig + 32, 9.5)), r2(at(sig + 26, 13))]));
      pref(castOf(wg, 6.9) + 0.3, south);
      hz({ t: tW1, tell: castOf(wg, 6.9), effect: 'bait', shape: 'cone', from: 'boss', aim: 'target', targets: ['MT'], turn: o1, half: 120, r: 19, dmg: 1.4, own: 0.55, buster: true, name: 'Wings Dark and Light' });
      hz({ t: tW1 + 0.4, tell: castOf(wg, 6.9), effect: 'bait', shape: 'circle', from: 'target', targets: tc1 ? { farthest: 1 } : { nearest: 1 }, r: 4, dmg: 1.0, own: 0.5, name: 'Wings Dark and Light' });
      // Second (the other element) at OT, provoked, standing so it points south; MT baits the other tether north;
      // everyone else north, the second tower's pair in it on its north side.
      const ot2 = deg360(sig + o1);
      const n = deg360(sig + 180);
      const cone2 = { shape: 'cone', at: [0, 0], deg: sig, half: 120, r: 19 };
      const north = Object.assign({ OT: r2(at(ot2, 7)), MT: r2(at(n, tc1 ? 1.6 : 17.5)) },
        place(soak[1].map(s => [s, add(twP[1], at(n, 1.6)), 0.6]), { avoid: [cone2], m: 0.8, floor: (q) => dist(q, twP[1]) < 2.4 }),
        clumpAt(soak[2].concat(['H1', 'H2']), at(n, tc1 ? 9 : 8)));
      pref(tW1 + 0.6, north);
      hz({ t: tW2, tell: tW1, effect: 'bait', shape: 'cone', from: 'boss', aim: 'target', targets: ['OT'], turn: -o1, half: 120, r: 19, dmg: 1.4, own: 0.55, buster: true, name: 'Wings Dark and Light' });
      hz({ t: tW2 + 0.4, tell: tW1, effect: 'bait', shape: 'circle', from: 'target', targets: tc1 ? { nearest: 1 } : { farthest: 1 }, r: 4, dmg: 1.0, own: 0.5, name: 'Wings Dark and Light' });
      // The last tower.
      pref(tW2 + 0.6, Object.assign(clumpAt(soak[2], twP[2]), clumpAt(S.filter(s => !soak[2].includes(s)), at(n, 9))));
      call(castOf(wg, 6.9), `${lightFirst ? 'Light' : 'Dark'} first: MT to the ${dir8(mt1)} tower, party south`, { alert: true, dur: 6 });
      call(tW1 + 0.2, 'OT provoke: party north', { alert: true, dur: 3 });
      pref(exps[2] + 0.3, UP);
    }

    // --- Polarizing Strikes: four rounds of line stacks at the nearest each side of her (front 5, the rest 9 behind,
    // G1 left, G2 right); each takes the afterglow too, then the front swaps sides (T > M > R > H). ---
    for (const ps of EA('Polarizing Strikes', t0, 1300)) {
      const rounds = [ps].concat(EA('Polarizing Paths', ps.t, ps.t + 20)).map(e => e.t + 0.6).slice(0, 4);
      const ORD = [['MT', 'OT'], ['M1', 'M2'], ['R1', 'R2'], ['H1', 'H2']];
      let left = G1.slice(), right = G2.slice();
      const L = 225, Rg = 135;
      rounds.forEach((t, k) => {
        const [fl, fr] = ORD[k];
        const lineSpots = (grp, front, deg) => Object.assign({ [front]: r2(at(deg, 5.2)) }, clumpAt(grp.filter(s => s !== front), at(deg, 9.5), { m: 0 }));
        pref(k ? rounds[k - 1] + 2.2 : castOf(ps, 6.5) + 1, Object.assign(lineSpots(left, fl, L), lineSpots(right, fr, Rg)));
        for (const [front, deg] of [[fl, L], [fr, Rg]]) {
          const line = { shape: 'line', at: [0, 0], deg, len: 40, w: 6 };
          hz(Object.assign({ t, tell: t - 4, effect: 'share', min: 4, max: 4, dmg: 0.3, name: deg === L ? 'Cruel Path of Light' : 'Cruel Path of Darkness' }, line, { at: undefined, from: 'boss', aim: r2(at(deg, 10)) }));
          hz(Object.assign({ t: +(t + 2).toFixed(2), tell: t, dmg: 1.2, name: 'Polarizing Paths', react: 1.8 }, line));
          debuff(front, deg === L ? 'lightResDown' : 'darkResDown', deg === L ? 'Light Resistance Down II' : 'Dark Resistance Down II', 'swap sides', t, t + 30);
        }
        // Out of the lines for the afterglow; the fronts cross over.
        left = left.filter(s => s !== fl).concat([fr]);
        right = right.filter(s => s !== fr).concat([fl]);
        pref(t + 0.1, Object.assign(clumpAt(left, at(L - 30, 8), { m: 0 }), clumpAt(right, at(Rg + 30, 8), { m: 0 })));
      });
      call(castOf(ps, 6.5), 'Polarizing: G1 left, G2 right; front swaps after', { alert: true, dur: 6 });
      pref(rounds[rounds.length - 1] + 2.3, UP);
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
