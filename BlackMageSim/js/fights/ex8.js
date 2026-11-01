// EX8, The Unmaking (Extreme): Enuo's mechanics for the sim's party, on cactbot's timeline (07-dt/trial/enuo-ex), and
// the two strats wtfdig.info lists for the fight (75/ex8): Hector (1-A markers, colour pairs on the intercards, the
// original Northmost/Southmost intermission, chasers clockwise then clockwise) and Modified (1L_) (A-1 markers, colour
// partners on the cardinals, snake intermission, clockwise then counterclockwise). Spots are [east, north] yalms from
// the arena's middle (a circle of 20; the intermission a square of 30).
//
// The mechanics follow BossMod's module (github.com/awgil/ffxiv_bossmod, Ex8Enuo), whose shapes and sizes come from the
// game's Action sheet, and where things stand follows an FFLogs kill (7kmW2hMynHcNCd1w: the voids, orbs, towers and
// chasers as they cast). Built with the sim's toolkit (js/mech.js):
//   - Meteorain, Almagest, Lightless World: raidwides.
//   - Naught Grows: a void portal 40 out does a 40 circle (get far) or a 40-60 donut (get close); in phase 2 Enuo does
//     the other one too (a 12 circle: out of melee, or a 6-40 donut: under her). Then Return to Nothing (two healer
//     line stacks) or Great Return to Nothing (one party line stack): a wild charge from beyond its target into her,
//     the tanks in front.
//   - Meltdown: puddles baited under the boss, Chains of Condemnation (stand still 2 s), then out to the clock spots for
//     the spreads before the puddles go off.
//   - Airy Emptiness (60-degree cones on the supports, pair stacks) / Dense Emptiness (100-degree cones on the
//     healers, light party stacks): one, then the other; phase 2 repeats the first.
//   - Gaze of the Void: ten 45-degree cones turning round her a step every 0.4 s from the glowing orb (start just behind
//     it, then move round past the first two); then eight orbs drift in, four quick (yellow) and four slow (purple), each
//     colour one big tank orb: role pairs pop one of each colour, clockwise from that colour's tank orb (THMR).
//   - Vacuum (Silent Torrent): eight arcs on the edge (one short, then medium, long, medium, long...) and three void
//     puddles across from the short arc; the party waits close to the middle on the short arc's side. In phase 2 with
//     Meltdown: the puddles are baited there and the chains held there.
//   - Deep Freeze: a flare on each tank (13 out is clear; Hector: tanks on 1 and 4, the party east; Modified: NW and NE,
//     the party south), then Freezing Up: keep moving for 2 s.
//   - Intermission (All for Naught): the Looming Shadow's knockback (20, from the middle; an 8 circle), then twice four
//     Empty Shadow towers (one each) on one role and Voidal Turbulence's cones (60 degrees, from the middle) on the other
//     through the gaps; the soakers' hands then act: Demon Eye (DPS hands' gaze, reach 20), Curse of the Flesh (healers'
//     Disease to cleanse), Drain Touch (to interrupt) and Weight of Nothing (a line buster at the tank). Killing the
//     Looming Shadow and its hands, then the Beacon in the Dark (the hands' Nothingness lines meanwhile), ends it.
//   - Naught Wakes (Passage of Naught): the portals' 16-wide lasers in two waves (two through the middle: cardinals or
//     intercards safe; one through the middle with one beside it: max melee across it; two beside the middle: middle).
//   - Shrouded Holy: healer stacks. Dimension Zero: a party line stack, three or four hits.
//   - Naught Hunts: middle through the first lasers, then two chasers (6 circles, 3 yalms a step): two players bait
//     them clockwise for 13 hits and hand them over for 12 more (clockwise again, or counterclockwise); the second
//     lasers (cardinals or intercards).
// Simplified: who gets the wild charge's front doesn't change its damage (a check keeps the tanks at the front); Chains
// of Condemnation and Freezing Up are checked by where you stand (still at your spot; not where you stood a second ago),
// as the sim can't watch movement; Demon Eye's gaze has no reach in the engine, so the party steps out of it (the
// eyes' 20-yalm reach shows) and it never checks your facing; Drain Touch's interrupt and Esuna aren't modelled (the
// call and the Disease show); the hands are marks on the floor (the map's budget keeps the Looming Shadow's model only)
// and the Beacon is unseen; the two intermission add windows soak all of the party's damage (pushed on as each dies).
// Where wtfdig gives no spot (the Vacuum, the chasers' paths, the laser waves' patterns), the spots and patterns are
// this script's own, after the kill's.
(function (B) {
  const S = B.SLOTS;
  const at = B.bearing;
  const inside = B.mechInside;
  const add = (a, b) => [a[0] + b[0], a[1] + b[1]];
  const sub = (a, b) => [a[0] - b[0], a[1] - b[1]];
  const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);
  const len = (p) => Math.hypot(p[0], p[1]);
  const lerp = (a, b, u) => [a[0] + (b[0] - a[0]) * u, a[1] + (b[1] - a[1]) * u];
  const deg360 = (d) => ((d % 360) + 360) % 360;
  const pick = (a) => a[Math.floor(Math.random() * a.length)];
  const shuffle = (a) => { const b = a.slice(); for (let i = b.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [b[i], b[j]] = [b[j], b[i]]; } return b; };
  const r2 = (p) => [+p[0].toFixed(2), +p[1].toFixed(2)];
  const brg = (p) => deg360(Math.atan2(p[0], p[1]) * 180 / Math.PI);
  const SUP = ['MT', 'OT', 'H1', 'H2'], DPS = ['M1', 'M2', 'R1', 'R2'];
  const G1 = ['MT', 'H1', 'M1', 'R1'], G2 = ['OT', 'H2', 'M2', 'R2'];
  const TANKS = ['MT', 'OT'];
  const DIR8 = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
  const dir8 = (deg) => DIR8[Math.round(deg360(deg) / 45) % 8];
  const DIR16 = ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE', 'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW'];
  const dir16 = (deg) => DIR16[Math.round(deg360(deg) / 22.5) % 16];
  const DIRNAME = { N: 'north', NE: 'northeast', E: 'east', SE: 'southeast', S: 'south', SW: 'southwest', W: 'west', NW: 'northwest' };

  // ---------- the strats ----------
  // Clock spots (both): tanks north and south, healers west and east, melee south-west and south-east, ranged north-west
  // and north-east.
  const CLOCK = { MT: 0, OT: 180, H1: 270, H2: 90, M1: 225, M2: 135, R1: 315, R2: 45 };
  const STRATS = {
    // Airy Emptiness: each support's bearing, its DPS partner with it. Deep Freeze: the tanks' bearings and the party's.
    // Intermission: Hector's (each side's Northmost/Southmost tower and gap) or the snake (THHT/RMMR from NW
    // counterclockwise and from A clockwise). Hunts: the second baiters clockwise again or counterclockwise.
    hector: { airy: { MT: 315, OT: 135, H1: 225, H2: 45 }, partner: { MT: 'R1', OT: 'M2', H1: 'M1', H2: 'R2' },
      freeze: { MT: 315, OT: 225, party: 90 }, inter: 'hector', hunts: 'cw',
      kb: { MT: 315, R1: 315, OT: 135, M2: 135, H1: 225, M1: 225, H2: 45, R2: 45 } },
    modified: { airy: { MT: 0, OT: 180, H1: 270, H2: 90 }, partner: { MT: 'R2', OT: 'M1', H1: 'R1', H2: 'M2' },
      freeze: { MT: 315, OT: 45, party: 180 }, inter: 'snake', hunts: 'ccw',
      kb: { MT: 315, R1: 315, H1: 285, M1: 285, OT: 15, R2: 15, H2: 45, M2: 45 } },
  };
  // The party's places: the tanks at her front (north), melee behind (her hitbox is 6).
  const UP = { MT: [0, 7.6], OT: [1.6, 7.3], M1: [-2.4, -7.3], M2: [2.4, -7.3], H1: [-7, -9.5], H2: [7, -9.5], R1: [-10.5, -5], R2: [10.5, -5] };
  // Round the Looming Shadow (its hitbox is 12.5).
  const UP_SHADOW = { MT: [0, 13.6], OT: [1.6, 13.5], M1: [-2.4, -13.6], M2: [2.4, -13.6], H1: [-8, -15], H2: [8, -15], R1: [-14.5, -7], R2: [14.5, -7] };
  const shift = (spots, d) => Object.fromEntries(Object.entries(spots).map(([s, p]) => [s, r2(add(p, d))]));

  // Eight close round a point (the rest within `rad`).
  const clusterAt = (c, slots, rad) => Object.fromEntries(slots.map((s, i) => [s, r2(add(c, i ? at((i - 1) * 360 / Math.max(1, slots.length - 1), rad ?? 0.6) : [0, 0]))]));
  // A line of players out from the boss along bearing b, the first farthest (r0 out to r1 in).
  const lineUp = (slots, b, r0, r1) => Object.fromEntries(slots.map((s, i) => [s, r2(at(b, r0 + (r1 - r0) * (slots.length > 1 ? i / (slots.length - 1) : 0)))]));

  // ---------- the lasers (Passage of Naught) ----------
  // A portal 40 out at bearing th: through the middle (big) or 16 beside it (small), 16 wide, across the arena.
  const bigLine = (th) => ({ shape: 'line', at: r2(at(th, 40)), deg: deg360(th + 180), len: 80, w: 16 });
  const smallLine = (th, side) => ({ shape: 'line', at: r2(add(at(th, 40), at(th + 90 * side, 16))), deg: deg360(th + 180), len: 80, w: 16 });
  function laserWave(kind) {
    const card = Math.random() < 0.5, th = pick(card ? [0, 90, 180, 270] : [45, 135, 225, 315]);
    if (kind === 'twobig') return { lines: [bigLine(th), bigLine(th + 90)], call: card ? 'Intercards' : 'Cardinals', kind };
    if (kind === 'bigsmall') {
      const d1 = dir8(th + 90), d2 = dir8(th + 270);
      return { lines: [bigLine(th), smallLine(th + 90, pick([1, -1]))], call: `Go ${[d1, d2].sort((a, b) => DIR8.indexOf(a) - DIR8.indexOf(b)).join('/')} Max Melee`, kind };
    }
    // Two beside the middle from portals a quarter apart, each on the side away from the other's.
    return { lines: [smallLine(th, pick([1, -1])), smallLine(th + 90, pick([1, -1]))], call: 'Go into middle', kind: 'middle' };
  }

  // ---------- the chasers (Naught Hunts) ----------
  // Baiters' paths (5.5 yalms a second, the bots run 6), checked against the chaser each pull: 3 yalms a step toward
  // its target as it locks (half a second before), a step every 0.69 s, 13 on the first baiter and 12 on the second.
  const V = 5.5, STEP = 0.69, N1 = 13, NCH = 25;
  const HUNT = {
    cw: { lead: 65, swing: 20, R: 16, ahead: 30, peel: 90, cont: 4, out: 3.2 },
    ccw: { lead: 50, swing: 20, R: 16, ahead: 60, peel: 0, cont: 0, out: 2.6 },
  };
  const runner = (p, t0, th1, R, dir) => {
    const q = at(th1, R), d1 = dist(p, q), t1 = t0 + d1 / V, w = V / R * 180 / Math.PI;
    return (t) => (t <= t0 ? p : t <= t1 ? lerp(p, q, (t - t0) / (t1 - t0)) : at(th1 + dir * w * (t - t1), R));
  };
  const walker = (p, q, t0) => (t) => { const d = dist(p, q); return lerp(p, q, d < 0.01 ? 1 : Math.max(0, Math.min(1, (t - t0) * V / d))); };
  // One chaser from bearing alpha (17 out), baited from t1: rot +1 clockwise; mode 'cw' (the second baiter clockwise
  // again, starting just ahead of it) or 'ccw' (starting behind it, the other way). Returns the baiters' paths (absolute
  // times) and the chaser's landings as this script expects them.
  function chaserPlan(alpha, rot, mode, t1) {
    const o = HUNT[mode], tk = (k) => t1 + k * STEP;
    const S0 = r2(at(alpha + rot * o.lead, 3));
    const A1run = runner(S0, t1 + 0.05, alpha + rot * (o.lead + o.swing), o.R, rot);
    const step = (p, T) => { const d = dist(T, p), m = Math.min(3, d); return d > 0 ? [p[0] + (T[0] - p[0]) / d * m, p[1] + (T[1] - p[1]) / d * m] : p; };
    const L = [at(alpha, 17)];
    for (let k = 1; k < N1; k++) L.push(step(L[k - 1], A1run(tk(k) - 0.5)));
    const tx = tk(N1 - 1) + 0.05, cb = brg(L[N1 - 1]);
    const dir2 = mode === 'cw' ? rot : -rot;
    const wait = r2(at(cb + (mode === 'cw' ? rot : -rot) * o.ahead, o.R));
    const A2run = runner(wait, tx, brg(wait), o.R, dir2);
    const tg = tx + o.cont, a1g = A1run(tg), A1back = walker(a1g, at(brg(a1g) + rot * o.peel, 1.2), tg);
    const A1 = (t) => (t <= tg ? A1run(t) : A1back(t));
    for (let k = N1; k < NCH; k++) L.push(step(L[k - 1], A2run(tk(k) - 0.5)));
    const tOut = tx - o.out, A2walk = walker([0.5, 0.5], wait, tOut);
    // How close it comes: to its baiter, to the middle, to the first baiter walking back, to the second walking out.
    let worst = 99;
    for (let k = 1; k < NCH; k++) {
      const t = tk(k);
      worst = Math.min(worst, dist(k < N1 ? A1(t) : A2run(t), L[k]) - 6.6, len(L[k]) - 8.0);
      if (k >= N1) worst = Math.min(worst, dist(A1(t), L[k]) - 6.6);
      if (k < N1 && t >= tOut) worst = Math.min(worst, dist(A2walk(t), L[k]) - 6.6);
    }
    return { S0, A1, A2: A2run, wait, tx, tg, tOut, L, worst };
  }

  // ---------- the pull ----------
  function plan(events, strat) {
    const st = STRATS[strat] || STRATS.hector;
    const P = { start: Object.assign({}, UP), prefs: [], hazards: [], checks: [], calls: [], marks: [], labels: new Map(), debuffs: [],
      boss: [{ t: 0, at: [0, 0] }], hitbox: [{ t: 0, r: 6 }], looks: [], notes: [] };
    let id = 0;
    const hz = (o) => { const h = Object.assign({ id: ++id, react: 3 }, o); P.hazards.push(h); return h; };
    const pref = (t, spots) => P.prefs.push({ t: +t.toFixed(2), spots });
    const call = (t, text, o) => P.calls.push(Object.assign({ t: +t.toFixed(2), text, dur: 5 }, o));
    const check = (o) => P.checks.push(o);
    const debuff = (slot, key, name, hint, t0, t1) => P.debuffs.push({ slot, key, name, hint, t0: +t0.toFixed(2), t1: +t1.toFixed(2) });
    const mark = (shape, t0, t1, fill) => P.marks.push(Object.assign({ kind: 'lit', t0: +t0.toFixed(2), t1: +t1.toFixed(2), fill }, shape));
    const label = (ev, text) => { if (ev) P.labels.set(ev, text); };
    const E = (name, t0, t1) => events.find(e => e.name === name && e.t >= t0 && e.t <= t1) || null;
    const EA = (name, t0, t1) => events.filter(e => e.name === name && e.t >= t0 && e.t <= t1);
    const EW = (re, t0, t1) => events.filter(e => re.test(e.name) && e.t >= t0 && e.t <= t1);
    const castOf = (ev, d) => ev.t - (ev.cast || d || 5);
    // The player's spot (for Demon Eye's reach, which the engine's gaze doesn't have).
    const me = (B.app && B.app.party && B.app.party.active && B.app.party.playerSlot()) || 'R2';

    const raid = (ev, dmg, text, d, name) => {
      if (!ev) return;
      const cs = castOf(ev, d);
      hz({ t: ev.t, tell: cs, raidwide: true, dmg, name: name || ev.name.replace(/ \(.*\)$/, '') });
      call(cs, text || 'AoE', { dur: 3 });
    };

    // The picks: which wild charge and which Emptiness come first (the second time the other; phase 2 repeats the first).
    const ret0 = Math.random() < 0.5 ? 'healer' : 'stack', emp0 = Math.random() < 0.5 ? 'airy' : 'dense';
    const other = (k) => ({ healer: 'stack', stack: 'healer', airy: 'dense', dense: 'airy' })[k];

    // ===== raidwides =====
    for (const ev of EA('Meteorain', 0, 9999)) { raid(ev, 0.45, 'AoE'); label(ev, 'Meteorain (raidwide)'); }
    for (const ev of events.filter(e => e.name === 'Almagest' && e.kind !== 'enrage')) { raid(ev, 0.45, 'AoE'); label(ev, 'Almagest (raidwide)'); }
    const lw = E('Lightless World x5', 400, 9999), lwb = E('Lightless World (big)', 400, 9999);
    if (lw) {
      for (let k = 0; k < 5; k++) hz({ t: +(lw.t + 0.5 * k).toFixed(2), tell: lw.t - 10, raidwide: true, dmg: 0.07, name: 'Lightless World' });
      call(lw.t - 10, 'Big AoE', { alert: true, dur: 5 });
      label(lw, 'Lightless World x5 (raidwides)');
    }
    if (lwb) { hz({ t: lwb.t, tell: lwb.t - 3, raidwide: true, dmg: 0.5, name: 'Lightless World' }); label(lwb, 'Lightless World (the big one)'); }
    const enr = events.find(e => e.kind === 'enrage');
    if (enr) label(enr, 'Almagest (enrage)');

    // ===== Naught Grows and the wild charge =====
    // P1: the portal only. P2 (double): Enuo's own too, the other kind. kind: 'healer' (two light party lines on the
    // healers) or 'stack' (one party line).
    function grows(ng, ret, kind, double) {
      if (!ng) return;
      const tC = ng.t - 8, Pb = pick([0, 45, 90, 135, 180, 225, 270, 315]), portal = r2(at(Pb, 40));
      const pDonut = Math.random() < 0.5;
      hz(pDonut ? { t: ng.t, tell: tC, shape: 'donut', at: portal, r0: 40, r1: 64, dmg: 1.4, name: 'Naught Grows (the portal\'s donut)' }
        : { t: ng.t, tell: tC, shape: 'circle', at: portal, r: 40, dmg: 1.4, name: 'Naught Grows (the portal\'s circle)' });
      if (double) {
        hz(pDonut ? { t: ng.t, tell: tC, shape: 'circle', at: [0, 0], r: 12, dmg: 1.4, name: 'Naught Grows (Enuo\'s circle)' }
          : { t: ng.t, tell: tC, shape: 'donut', at: [0, 0], r0: 6, r1: 40, dmg: 1.4, name: 'Naught Grows (Enuo\'s donut)' });
      }
      // Where the lines go: by the portal (its donut), away from it (its circle); with Enuo's circle, out of it; with her
      // donut, under her.
      const near = pDonut, base = near ? Pb : Pb + 180;
      const spread = double ? (near ? 30 : 45) : 45;
      const [rf, rb] = !double ? [9, 3.6] : near ? [18.6, 13.6] : (kind === 'stack' ? [4.6, 1.7] : [4.8, 3.7]);
      let spots, b1 = null, b2 = null;
      if (kind === 'stack') spots = lineUp(['MT', 'OT', 'M1', 'M2', 'R1', 'R2', 'H1', 'H2'], base, rf, rb);
      else {
        b1 = deg360(base - spread); b2 = deg360(base + spread);
        const e1 = at(b1, 1), e2 = at(b2, 1);
        if (e2[0] < e1[0] - 0.01 || (Math.abs(e2[0] - e1[0]) < 0.01 && e2[1] > e1[1])) [b1, b2] = [b2, b1];
        spots = Object.assign(lineUp(['MT', 'M1', 'R1', 'H1'], b1, rf, rb), lineUp(['OT', 'M2', 'R2', 'H2'], b2, rf, rb));
      }
      pref(tC + 1, spots);
      const tgt = kind === 'stack' ? pick(S) : null;
      if (ret) {
        hz({ t: ret.t, tell: tC + 0.5, effect: 'share', shape: 'line', from: 'target', targets: kind === 'stack' ? [tgt] : ['H1', 'H2'], aim: 'boss', len: 'target',
          back: 7, w: 6, snap: 0.4, min: kind === 'stack' ? 8 : 4, max: kind === 'stack' ? 8 : 4, dmg: 0.35, name: kind === 'stack' ? 'Great Return to Nothing' : 'Return to Nothing' });
        check({ t: ret.t - 0.1, kind: 'spot', slots: TANKS, spots, r: 2.2, fail: 0.8, name: 'Wild charge (tanks at the front)' });
        pref(ret.t + 0.3, UP);
      }
      const mech = kind === 'stack' ? 'Stack' : 'Healer Groups';
      const D = dir8(Pb);
      const text = !double ? (pDonut ? `${D} + ${mech}` : `Away from ${D} + ${mech}`)
        : (pDonut ? `${D} + Away from Boss + ${mech}` : `Under Boss + Away from ${D} + ${mech}`);
      call(tC + 0.5, text, { alert: true, dur: 7 });
      if (kind === 'stack') call(tC + 0.5, 'Tanks in front of the line', { slot: 'MT', dur: 7 }), call(tC + 0.5, 'Tanks in front of the line', { slot: 'OT', dur: 7 });
      label(ng, `Naught Grows (${double ? (pDonut ? 'Enuo\'s circle, the portal\'s donut' : 'Enuo\'s donut, the portal\'s circle') : pDonut ? 'the portal\'s donut' : 'the portal\'s circle'}: ${DIRNAME[D]})`);
      if (ret) label(ret, kind === 'stack' ? `Great Return to Nothing (party line stack on ${tgt})` : 'Return to Nothing (healer line stacks)');
    }
    const ng1 = events.filter(e => e.name === 'Naught Grows');
    const rets = EW(/Return to Nothing/, 0, 9999);
    const retAfter = (ng) => rets.find(r => r.t > ng.t && r.t < ng.t + 3) || null;
    ng1.forEach((ng, k) => grows(ng, retAfter(ng), k === 0 ? ret0 : other(ret0), false));
    EA('Naught Grows x2', 400, 9999).forEach(ng => grows(ng, retAfter(ng), ret0, true));

    // ===== Meltdown =====
    // spot: where the party stacks for the puddles and the chains (P1 under the boss; P2 the Vacuum's safe spot).
    function meltdown(md, ex, sp, stackC) {
      if (!md) return;
      const tCast = castOf(md, 4), t0 = md.t + 1.0, t1 = t0 + 2.0, tX = ex ? ex.t : md.t + 5.6, tS = sp ? sp.t : tX + 1.1;
      const stack = clusterAt(stackC, S, 0.6);
      pref(tCast + 0.3, stack);
      call(tCast, 'Bait Puddles => Stop Moving => Spread', { dur: 5 });
      call(md.t, 'Stop Moving => Spread', { alert: true, dur: 4 });
      for (const s of S) debuff(s, 'chains', 'Chains of Condemnation', 'stand still', t0, t1);
      for (const k of [0.4, 1.0, 1.6]) check({ t: +(t0 + k).toFixed(2), kind: 'spot', spots: stack, r: 1.5, fail: 0.6, name: 'Chains of Condemnation (moved)' });
      // The puddles: where each stood as the chains took hold; they show from then, the dodge only once the chains are off.
      for (const s of S) {
        hz({ t: tX, tell: t1 + 0.05, shape: 'circle', r: 5, from: 'target', targets: [s], snap: tX - t0, dmg: 0.9, react: 3, name: 'Meltdown (puddle)' });
        mark({ shape: 'circle', at: stack[s], r: 5 }, t0, t1 + 0.05, 'rgba(255,120,40,0.16)');
      }
      // Out to the clock spots for the spreads.
      const spreads = Object.fromEntries(S.map(s => [s, r2(at(CLOCK[s], 13))]));
      pref(t1 + 0.05, spreads);
      hz({ t: tS, tell: tS - 5, effect: 'bait', shape: 'circle', r: 5, from: 'target', targets: S.slice(), snap: 0.3, dmg: 0.9, own: 0.3, name: 'Meltdown (spread)' });
      pref(tS + 0.3, UP);
      label(md, 'Meltdown (puddles baited, Chains of Condemnation)');
      label(ex, 'Meltdown (the puddles)');
      label(sp, 'Meltdown (spreads)');
    }

    // ===== Airy / Dense Emptiness =====
    function emptiness(ev, kind) {
      if (!ev) return;
      const tC = ev.t - 5;
      if (kind === 'airy') {
        const spots = {};
        for (const s of SUP) { spots[s] = r2(at(st.airy[s], 4.6)); spots[st.partner[s]] = r2(at(st.airy[s], 6.4)); }
        pref(tC + 0.3, spots);
        hz({ t: ev.t, tell: tC, effect: 'share', shape: 'cone', from: 'boss', aim: 'target', targets: SUP.slice(), half: 30, r: 40, snap: 0.4, min: 2, max: 2, dmg: 0.3, name: 'Airy Emptiness' });
        call(tC, 'Stack with partner', { alert: true, dur: 5 });
        label(ev, `Airy Emptiness (pair stacks, ${strat === 'modified' ? 'cardinals' : 'intercards'})`);
      } else {
        const spots = Object.assign({ H1: [-5, 0], MT: [-5.4, 1.5], M1: [-5.4, -1.5], R1: [-6.8, 0] }, { H2: [5, 0], OT: [5.4, 1.5], M2: [5.4, -1.5], R2: [6.8, 0] });
        pref(tC + 0.3, spots);
        hz({ t: ev.t, tell: tC, effect: 'share', shape: 'cone', from: 'boss', aim: 'target', targets: ['H1', 'H2'], half: 50, r: 40, snap: 0.4, min: 4, max: 4, dmg: 0.4, name: 'Dense Emptiness' });
        call(tC, 'Healer Groups', { alert: true, dur: 5 });
        label(ev, 'Dense Emptiness (light party stacks on the healers)');
      }
      pref(ev.t + 0.3, UP);
    }
    const emps = EW(/^(Airy|Dense) Emptiness/, 0, 9999);
    emps.forEach((ev, k) => emptiness(ev, ev.t < 150 ? (k === 0 ? emp0 : other(emp0)) : emp0));

    // ===== Gaze of the Void =====
    function gaze(gz) {
      if (!gz) return;
      const c0 = pick([0, 45, 90, 135, 180, 225, 270, 315]), rot = Math.random() < 0.5 ? 1 : -1;
      const tk = (k) => +(gz.t + 0.4 * k).toFixed(2);
      for (let k = 0; k < 10; k++) {
        hz({ t: tk(k), tell: k < 2 ? gz.t - 7 : tk(k - 2), shape: 'cone', at: [0, 0], deg: deg360(c0 + rot * 45 * k), half: 22.5, r: 40, dmg: 1.2, react: 1.5, aimed: true, name: 'Gaze of the Void' });
      }
      // Start just behind the first cone, then round past the first two once the third has gone.
      const start = deg360(c0 - rot * 45), end = deg360(c0 + rot * 90);
      const off = Object.fromEntries(S.map((s, i) => [s, i ? at((i - 1) * 360 / 7, 0.6) : [0, 0]]));
      pref(gz.t - 6.7, Object.fromEntries(S.map(s => [s, r2(add(at(start, 4.2), off[s]))])));
      const tGo = tk(2) + 0.02;
      const arc = (s) => (t) => { const u = Math.max(0, Math.min(1, (t - tGo) / 1.9)); return r2(add(at(start + rot * 135 * u, 4.2), off[s])); };
      pref(tGo, Object.fromEntries(S.map(s => [s, arc(s)])));
      call(gz.t - 6.7, `${dir8(start)} ${rot > 0 ? 'Clockwise' : 'Counterclockwise'} => ${dir8(end)}`, { alert: true, dur: 7 });
      label(gz, `Gaze of the Void x10 (from ${DIRNAME[dir8(c0)]}, ${rot > 0 ? 'clockwise' : 'counterclockwise'})`);
      // The orbs: one at each 8-dir 19 out, drifting in; the first cone's and the next its tank orbs (one each colour).
      const ts0 = tk(9) + 0.1, tF = +(gz.t + 10.8).toFixed(2), tS = +(gz.t + 16.8).toFixed(2), vF = 0.95, vS = 0.75;
      const tankA = c0, tankB = deg360(c0 + rot * 45);
      const fastFirst = Math.random() < 0.5;
      const rest = shuffle([0, 45, 90, 135, 180, 225, 270, 315].filter(b => b !== tankA && b !== tankB));
      const fast = new Set([fastFirst ? tankA : tankB, ...rest.slice(0, 3)]);
      const orbs = [0, 45, 90, 135, 180, 225, 270, 315].map(b => ({ b, tank: b === tankA || b === tankB, fast: fast.has(b) }));
      const PAIRS = [['MT', 'OT'], ['H1', 'H2'], ['M1', 'M2'], ['R1', 'R2']];
      const mine = {};
      for (const quick of [true, false]) {
        const grp = orbs.filter(o => o.fast === quick), t0 = grp.find(o => o.tank).b;
        grp.sort((a, b) => deg360(a.b - t0) - deg360(b.b - t0));            // clockwise from its tank orb
        grp.forEach((o, i) => { o.pair = PAIRS[i]; for (const s of PAIRS[i]) (mine[s] = mine[s] || {})[quick ? 'fast' : 'slow'] = o; });
      }
      for (const o of orbs) {
        const v = o.fast ? vF : vS, tPop = o.fast ? tF : tS, r = o.tank ? 6 : 5;
        o.pos = r2(at(o.b, 19 - v * (tPop - ts0)));
        for (let t = ts0; t < tPop - 0.01; t += 0.3) mark({ shape: 'circle', at: r2(at(o.b, 19 - v * (t - ts0))), r: o.tank ? 2.2 : 1.6 }, t, Math.min(tPop, t + 0.3), o.fast ? 'rgba(255,215,80,0.55)' : 'rgba(175,95,255,0.55)');
        hz({ t: tPop, tell: tPop - 3.5, effect: 'tower', shape: 'circle', at: o.pos, r, soak: [2, 2], only: o.pair, dmg: 0.45, fail: 1.0, status: ['magicVuln', 4],
          name: o.tank ? 'Violent Burst (tank orb)' : 'Burst (orb)' });
      }
      // Each pair: toward its quick orb, in to pop it; then its slow one.
      const soakAt = (o, s) => r2(add(at(o.b, len(o.pos) + 0.6), at(o.b + 90, s === o.pair[0] ? 0.6 : -0.6)));
      const waitAt = (o, s, r) => r2(add(at(o.b, r), at(o.b + 90, s === o.pair[0] ? 0.6 : -0.6)));
      pref(ts0 + 0.05, Object.fromEntries(S.map(s => [s, waitAt(mine[s].fast, s, 8)])));
      pref(tF - 2.6, Object.fromEntries(S.map(s => [s, soakAt(mine[s].fast, s)])));
      pref(tF + 0.3, Object.fromEntries(S.map(s => [s, waitAt(mine[s].slow, s, 5.5)])));
      pref(tS - 2.6, Object.fromEntries(S.map(s => [s, soakAt(mine[s].slow, s)])));
      pref(tS + 0.3, UP);
      for (const s of S) call(ts0 + 0.4, `${dir8(mine[s].fast.b)} => ${dir8(mine[s].slow.b)}`, { slot: s, alert: true, dur: 8 });
      call(ts0 + 0.4, `Tank orbs ${dir16((tankA + (deg360(tankB - tankA) > 180 ? deg360(tankB - tankA) - 360 : deg360(tankB - tankA)) / 2))}`, { dur: 5 });
    }
    EA('Gaze of the Void x10', 0, 9999).forEach(gaze);

    // ===== Vacuum: the arcs and the void puddles =====
    // Returns the safe spot's bearing (the short arc's).
    function vacuum(lines, withMeltdown) {
      if (!lines) return null;
      const d = pick([0, 45, 90, 135, 180, 225, 270, 315]);
      const ARCS = [[0, 10], [45, 20], [-45, 20], [90, 30], [-90, 30], [135, 20], [-135, 20], [180, 30]];
      for (const [o, half] of ARCS) hz({ t: lines.t, tell: lines.t - 5.5, shape: 'cone', at: [0, 0], deg: deg360(d + o), half, r: 21, r0: 17, dmg: 1.2, name: 'Silent Torrent' });
      const tV = +(lines.t + (withMeltdown ? 2.5 : 2.1)).toFixed(2);
      for (const [o, r] of [[180, 8.5], [125, 11], [235, 11]]) hz({ t: tV, tell: lines.t - 4, shape: 'circle', at: r2(at(d + o, r)), r: 7, dmg: 1.2, name: 'Vacuum (void puddle)' });
      const safe = r2(at(d, 3.2));
      if (!withMeltdown) {
        pref(lines.t - 5.8, clusterAt(safe, S, 0.7));
        pref(tV + 0.3, UP);
      }
      call(lines.t - 5.5, `${dir16(d)} Close`, { alert: true, dur: 5 });
      label(lines, `Silent Torrent (the short arc ${DIRNAME[dir8(d)]})`);
      return safe;
    }
    const vac1 = E('Silent Torrent x7 (lines)', 0, 300);
    vacuum(vac1, false);
    label(E('Silent Torrent x7 (puddles)', 0, 300), 'Vacuum (the void puddles)');
    meltdown(E('Meltdown (puddle baits + pyretic)', 0, 300), E('Meltdown (puddle explodes)', 0, 300), E('Meltdown (spread)', 0, 300), [0, 0]);
    const vac2 = E('Silent Torrent x7 (lines)', 400, 9999);
    const safe2 = vacuum(vac2, true);
    if (safe2) {
      pref(vac2.t - 6, clusterAt(safe2, S, 0.6));
      meltdown(E('Meltdown (puddle baits + pyretic)', 400, 9999), E('Meltdown (puddle explodes)', 400, 9999), E('Meltdown (spread)', 400, 9999), safe2);
      label(E('Silent Torrent x7 (puddles)', 400, 9999), 'Vacuum (the void puddles)');
    }

    // ===== Deep Freeze =====
    function deepFreeze(df) {
      if (!df) return;
      const tC = df.t - 6, f0 = df.t - 0.3, f1 = f0 + 2.0;
      const others = S.filter(s => !TANKS.includes(s));
      const base = { MT: r2(at(st.freeze.MT, 11)), OT: r2(at(st.freeze.OT, 11)) };
      others.forEach((s, i) => { base[s] = r2(at(st.freeze.party - 45 + 18 * i, 11)); });
      pref(tC + 0.3, base);
      for (const t of TANKS) {
        hz({ t: df.t, tell: tC, effect: 'bait', shape: 'circle', r: 40, from: 'target', targets: [t], snap: 0.3, falloff: 26, dmg: 0.8, own: 0.5, buster: true, name: 'Deep Freeze (flare)' });
        call(tC, 'Tank Flare on YOU => Keep Moving', { slot: t, alert: true, dur: 6 });
      }
      for (const s of others) call(tC, 'Away from tank flares => Keep Moving', { slot: s, dur: 6 });
      // Freezing Up: everyone walks small circles (in step, so nobody closes on anyone) till it's off.
      for (const s of S) debuff(s, 'freezingUp', 'Freezing Up', 'keep moving', f0, f1);
      const loop = (c) => (t) => r2(add(c, at(115 * (t - f0), 1.2)));
      pref(f0, Object.fromEntries(S.map(s => [s, loop(sub(base[s], at(0, 1.2)))])));
      for (const k of [0.9, 1.45, 2.0]) {
        for (const s of S) hz({ t: +(f0 + k).toFixed(2), tell: +(f0 + k - 0.9).toFixed(2), shape: 'circle', r: 0.8, from: 'target', targets: [s], snap: 0.9, dmg: 0.6, aimed: true,
          hidden: true, quiet: true, status: ['deepFreeze', 3], name: 'Freezing Up (stopped moving)' });
      }
      call(f0, 'Keep Moving!', { alert: true, dur: 2.5 });
      pref(f1 + 0.2, UP);
      label(df, `Deep Freeze (tank flares ${dir8(st.freeze.MT)}/${dir8(st.freeze.OT)}, then keep moving)`);
    }
    events.filter(e => e.name === 'Deep Freeze').forEach(deepFreeze);

    // ===== Intermission: All for Naught =====
    const afn = E('All for Naught', 0, 400);
    const SLOT16 = (i) => 22.5 + 45 * i;          // the towers' and gaps' places: 0 NNE ... 7 NNW
    const northness = (i) => Math.cos(SLOT16(i) * Math.PI / 180);
    const firstRole = (s) => TANKS.includes(s) || s === 'R1' || s === 'R2';       // T/R first, H/M second
    function interAssign(towers, soakRole) {
      const gaps = new Set([0, 1, 2, 3, 4, 5, 6, 7].filter(i => !towers.has(i)));
      const soak = soakRole === 'sup' ? SUP : DPS, bait = soakRole === 'sup' ? DPS : SUP;
      const out = { tower: {}, gap: {} };
      for (const [kind, set, who] of [['tower', towers, soak], ['gap', gaps, bait]]) {
        if (st.inter === 'hector') {
          // Each side's two, north first: west MT/R1 north, H1/M1 south; east H2/R2 north, OT/M2 south.
          const side = (west) => [...set].filter(i => (i >= 4) === west).sort((a, b) => northness(b) - northness(a));
          const NORTH = ['MT', 'R1', 'H2', 'R2'];
          for (const s of who) { const sd = side(G1.includes(s)); out[kind][s] = NORTH.includes(s) ? sd[0] : sd[1]; }
        } else {
          // The snake: group 2 from A clockwise, group 1 from NW counterclockwise; T/R the first, H/M the second.
          const ORD1 = [6, 5, 4, 3, 2, 1, 0, 7], ORD2 = [0, 1, 2, 3, 4, 5, 6, 7];
          const g2 = ORD2.filter(i => set.has(i)).slice(0, 2), g1 = ORD1.filter(i => set.has(i) && !g2.includes(i)).slice(0, 2);
          for (const s of who) { const g = G1.includes(s) ? g1 : g2; out[kind][s] = firstRole(s) ? g[0] : g[1]; }
        }
      }
      return out;
    }
    if (afn) {
      P.boss.push({ t: 147.4, at: [0, 20] });
      label(afn, 'All for Naught (the intermission)');
      const le = E('Looming Emptiness', afn.t, afn.t + 40), es = E('Empty Shadow', afn.t, afn.t + 40), vt = E('Voidal Turbulence', afn.t, afn.t + 40);
      const tLE = le ? le.t : afn.t + 20.1;
      P.boss.push({ t: tLE - 6, at: [0, 0] });
      // The knockback from the middle: pairs out on their marks first.
      pref(tLE - 5.6, Object.fromEntries(S.map(s => {
        const b = st.kb[s], mate = S.find(x => x !== s && st.kb[x] === b);
        return [s, r2(add(at(b, 9.8), at(b + 90, S.indexOf(s) < S.indexOf(mate) ? 0.7 : -0.7)))];
      })));
      hz({ t: tLE, tell: tLE - 6, shape: 'circle', at: [0, 0], r: 8, dmg: 1.2, name: 'Looming Emptiness' });
      hz({ t: tLE, tell: tLE - 6, effect: 'knockback', shape: 'circle', at: [0, 0], r: 60, dist: 20, name: 'Looming Emptiness (knockback)' });
      call(tLE - 6, 'Knockback', { alert: true, dur: 5 });
      label(le, 'Looming Emptiness (knockback from the middle)');
      // Two sets of towers and cones: one role soaks, the other's cones go through the gaps; then the other way.
      const first = Math.random() < 0.5 ? 'sup' : 'dps';
      const sets = [{ t: es ? es.t : tLE + 9, cone: vt ? vt.t : tLE + 9.3, soak: first }, { t: (es ? es.t : tLE + 9) + 22.5, cone: (vt ? vt.t : tLE + 9.3) + 22.5, soak: first === 'sup' ? 'dps' : 'sup' }];
      sets.forEach((set, n) => {
        const towers = new Set([...shuffle([0, 1, 2, 3]).slice(0, 2), ...shuffle([4, 5, 6, 7]).slice(0, 2)]);
        const as = interAssign(towers, set.soak);
        const spots = {};
        for (const [s, i] of Object.entries(as.tower)) spots[s] = r2(at(SLOT16(i), 25));
        for (const [s, i] of Object.entries(as.gap)) spots[s] = r2(at(SLOT16(i), 20));
        pref(set.t - 7.5, spots);
        for (const [s, i] of Object.entries(as.tower)) {
          hz({ t: set.t, tell: set.t - 7, effect: 'tower', shape: 'circle', at: r2(at(SLOT16(i), 25)), r: 6, soak: 1, only: [s], dmg: 0.3, fail: 0.9, status: ['darkResDown', 5], name: 'Empty Shadow (tower)' });
          call(set.t - 7, `Soak Tower ${dir16(SLOT16(i))}`, { slot: s, alert: true, dur: 6 });
        }
        const baiters = Object.keys(as.gap);
        hz({ t: set.cone, tell: set.t - 6.5, effect: 'bait', shape: 'cone', from: [0, 0], aim: 'target', targets: baiters, half: 30, r: 40, snap: 0.3, dmg: 1.1, own: 0.35,
          status: ['darkResDown', 5], name: 'Voidal Turbulence' });
        for (const [s, i] of Object.entries(as.gap)) call(set.t - 7, `Aim Cone ${dir16(SLOT16(i))}`, { slot: s, alert: true, dur: 6 });
        if (n === 0) { label(es, `Empty Shadow (towers on the ${set.soak === 'sup' ? 'supports' : 'DPS'})`); label(vt, `Voidal Turbulence (cones on the ${set.soak === 'sup' ? 'DPS' : 'supports'})`); }
        pref(set.cone + 0.3, UP_SHADOW);
        // The soakers' hands, where their towers were, and what each does.
        const hands = Object.entries(as.tower).map(([s, i]) => ({ s, at: r2(at(SLOT16(i), 25)), b: SLOT16(i) }));
        const life = n === 0 ? 14 : 20;
        for (const h of hands) {
          const col = TANKS.includes(h.s) ? 'rgba(90,150,255,0.6)' : h.s[0] === 'H' ? 'rgba(90,220,120,0.6)' : 'rgba(235,70,70,0.6)';
          mark({ shape: 'circle', at: h.at, r: 2.4 }, set.t + 1, set.t + life, col);
        }
        if (set.soak === 'dps') {
          // Demon Eye: everyone into the middle, out of the eyes' reach (20).
          const tE = +(set.t + 7.2).toFixed(2);
          pref(tE - 3, clusterAt([0, 0], S, 1.0));
          for (const h of hands) hz({ t: tE, tell: tE - 5, effect: 'gaze', shape: 'circle', from: h.at, targets: [me], r: 20, dmg: 0.6, status: ['petrification', 4], name: 'Demon Eye' });
          call(tE - 5, 'Look Middle (out of the eyes\' reach)', { alert: true, dur: 5 });
          pref(tE + 0.3, UP_SHADOW);
          if (n === 0) label(E('Demon Eye', afn.t, afn.t + 60), 'Demon Eye (the DPS hands\' gaze)');
        } else {
          // Curse of the Flesh: Disease on the healers (cleanse it); Drain Touch to interrupt; Weight of Nothing.
          const tCu = +(set.t + 5.2).toFixed(2), tW = +(set.t + 14.4).toFixed(2);
          for (const s of ['H1', 'H2']) { debuff(s, 'disease', 'Disease', 'Esuna it', tCu, tCu + 12); call(tCu, 'Cleanse Debuff', { slot: s, dur: 4 }); }
          for (const s of TANKS) call(set.t + 1.6, 'Interrupt Drain Touch', { slot: s, alert: true, dur: 4 });
          const spots2 = Object.assign({}, UP_SHADOW);
          for (const h of hands.filter(x => TANKS.includes(x.s))) {
            // Beside the hand, so its line runs along the edge, away from the middle and the other hand.
            const otherH = hands.find(x => TANKS.includes(x.s) && x !== h), side = otherH && deg360(otherH.b - h.b) < 180 ? -1 : 1;
            spots2[h.s] = r2(add(h.at, at(h.b + 90 * side, 6)));
            hz({ t: tW, tell: tW - 5, effect: 'bait', shape: 'line', from: h.at, aim: 'target', targets: [h.s], len: 60, w: 8, snap: 0.4, dmg: 1.4, own: 0.5, buster: true, name: 'Weight of Nothing' });
            call(tW - 5, 'Tank cleave on YOU: aim it along the edge', { slot: h.s, alert: true, dur: 5 });
          }
          pref(set.cone + 0.35, spots2);
          pref(tW + 0.3, UP_SHADOW);
          if (n === 0) { label(E('Curse of the Flesh', afn.t, afn.t + 60), 'Curse of the Flesh (the healers\' Disease)'); label(E('Weight of Nothing', afn.t, afn.t + 60), 'Weight of Nothing (line busters on the tanks)'); }
        }
      });
      if (sets[0].soak === 'sup') label(E('Demon Eye', afn.t, afn.t + 60), 'Demon Eye (after the second towers)');
      else { label(E('Curse of the Flesh', afn.t, afn.t + 60), 'Curse of the Flesh (after the second towers)'); label(E('Weight of Nothing', afn.t, afn.t + 60), 'Weight of Nothing (after the second towers)'); }
      // The Beacon in the Dark: the hands' Nothingness lines through the middle meanwhile.
      const noth = EA('Nothingness', afn.t, afn.t + 400);
      if (noth.length) pref(noth[0].t - 6, clusterAt([0, -6], S, 0.8));
      for (const ev of noth) {
        for (const i of shuffle([0, 1, 2, 3, 4, 5, 6, 7]).slice(0, 3)) {
          hz({ t: ev.t, tell: ev.t - 3, shape: 'line', at: r2(at(SLOT16(i), 25)), deg: deg360(SLOT16(i) + 180), len: 55, w: 4, dmg: 1.0, name: 'Nothingness' });
        }
        label(ev, 'Nothingness (the hands\' lines)');
      }
      // The boss: away; the Looming Shadow in the middle (her model swapped), then the unseen Beacon; she comes back north.
      P.form = [{ t: afn.t + 0.6, model: 'none' }, { t: tLE - 5, model: 'shadow' }, { t: 296, model: 'none' }, { t: 494.7, model: null }];
      P.hitbox.push({ t: tLE - 5, r: 12.5 }, { t: 296, r: 5 }, { t: 494.7, r: 6 });
      P.arena = [{ t: 0, shape: 'circle', at: [0, 0], r: 20 }, { t: afn.t + 0.6, shape: 'square', half: 30 }, { t: 494.7, shape: 'circle', at: [0, 0], r: 20 }];
      // The void's floor (the game's has no collision out past the stage): a flat floor (an unmoved `shift`) meanwhile.
      P.looks.push({ t: 0, show: ['a1_stg00', 'a1_stg01', 'a1_nat', 'a1_arf10'] }, { t: afn.t + 0.6, show: ['a3'], shift: [0, 0] }, { t: 494.7, show: ['a2', 'a1_nat', 'a1_arf10'] });
      P.boss.push({ t: 486.2, at: [0, 20] }, { t: 505.7, at: [0, 4.6], move: 8 }, { t: 523.1, at: [0, 0] });
      pref(486.4, shift(UP, [0, 6]));
      pref(510, UP);
      call(tLE + 1, 'Tower adds: kill your own hand', { dur: 4 });
    }

    // ===== Naught Wakes: the lasers =====
    function lasers(ev, kind) {
      if (!ev) return null;
      const w = laserWave(kind);
      for (const l of w.lines) hz(Object.assign({ t: ev.t, tell: ev.t - 6, dmg: 1.3, name: 'Passage of Naught' }, l));
      call(ev.t - 6, w.call, { alert: true, dur: 5 });
      label(ev, `Passage of Naught (${w.call.toLowerCase()})`);
      return w;
    }
    const pas = EA('Passage of Naught', 400, 9999);
    const hunts = EA('Naught Hunts', 400, 9999);
    const inHunt = (ev) => hunts.some(h => ev.t > h.t && ev.t < h.t + 30);
    // The first Naught Wakes: beside the middle, then one through it; the last: anything.
    const free = pas.filter(ev => !inHunt(ev));
    free.forEach((ev, k) => {
      const firstOfPair = k % 2 === 0, early = k < 2;
      lasers(ev, firstOfPair ? (early ? 'middle' : pick(['middle', 'bigsmall'])) : (early ? 'bigsmall' : pick(['bigsmall', 'twobig'])));
    });

    // ===== Shrouded Holy: healer stacks =====
    for (const ev of EA('Shrouded Holy', 400, 9999)) {
      const tC = ev.t - 6;
      pref(tC + 0.2, Object.assign(clusterAt([-4.6, -1.5], ['H1', 'MT', 'M1', 'R1'], 0.8), clusterAt([4.6, -1.5], ['H2', 'OT', 'M2', 'R2'], 0.8)));
      hz({ t: ev.t, tell: tC, effect: 'share', shape: 'circle', from: 'target', targets: ['H1', 'H2'], r: 6, snap: 0.3, min: 4, max: 4, dmg: 0.4, name: 'Shrouded Holy' });
      call(tC, 'Healer Groups', { alert: true, dur: 5 });
      pref(ev.t + 0.3, UP);
      label(ev, 'Shrouded Holy (healer stacks)');
    }

    // ===== Dimension Zero: a party line stack, several hits =====
    for (const ev of EW(/^Dimension Zero/, 400, 9999)) {
      const n = /x3/.test(ev.name) ? 3 : 4, tC = ev.t - 5.4, tgt = pick(S);
      pref(tC + 0.3, clusterAt([0, -4.6], S, 0.8));
      for (let k = 0; k < n; k++) hz({ t: +(ev.t + 1.3 * k).toFixed(2), tell: k ? +(ev.t + 1.3 * (k - 1)).toFixed(2) : tC, effect: 'share', shape: 'line', from: 'boss', aim: 'target', targets: [tgt],
        len: 40, w: 8, snap: 0.3, min: 8, max: 8, dmg: 0.16, name: 'Dimension Zero' });
      call(tC, `Line stack x${n} (on ${tgt})`, { alert: true, dur: 6 });
      pref(ev.t + 1.3 * (n - 1) + 0.3, UP);
      label(ev, `Dimension Zero x${n} (line stack on ${tgt})`);
    }

    // ===== Naught Hunts: the chasers =====
    for (const nh of hunts) {
      const ec = E('Endless Chase (active)', nh.t, nh.t + 3), t1 = ec ? ec.t : nh.t + 1;
      const pa = pas.filter(ev => ev.t >= nh.t && ev.t < nh.t + 30);
      lasers(pa[0], 'middle');
      lasers(pa[1], 'twobig');
      const tC = nh.t - 6, rot = 1, mode = st.hunts;
      const alpha = pick([0, 45, 90, 135]);
      const [A1, B1, A2, B2] = shuffle(S).slice(0, 4);
      const ca = chaserPlan(alpha, rot, mode, t1), cb = chaserPlan(alpha + 180, rot, mode, t1);
      if (Math.min(ca.worst, cb.worst) < 0) P.notes.push(`Naught Hunts ${alpha}: the chasers come within ${Math.min(ca.worst, cb.worst).toFixed(1)} of the margins`);
      const mid = clusterAt([0, 0], S, 0.7);
      pref(tC + 0.3, Object.assign({}, mid, { [A1]: ca.S0, [B1]: cb.S0 }));
      pref(t1 + 0.04, Object.assign({}, mid, { [A1]: ca.A1, [B1]: cb.A1 }));
      // The second baiters out to where they take over, 3.6 s before; then on round.
      const tOut = ca.tOut;
      pref(tOut, Object.assign({}, mid, { [A1]: ca.A1, [B1]: cb.A1, [A2]: walker(mid[A2], ca.wait, tOut), [B2]: walker(mid[B2], cb.wait, tOut) }));
      pref(ca.tx, Object.assign({}, mid, { [A1]: ca.A1, [B1]: cb.A1, [A2]: ca.A2, [B2]: cb.A2 }));
      const tEnd = t1 + (NCH - 1) * STEP + 0.2;
      pref(tEnd, Object.assign({}, mid, { [A2]: walker(ca.A2(tEnd), mid[A2], tEnd), [B2]: walker(cb.A2(tEnd), mid[B2], tEnd) }));
      pref(tEnd + 4.5, mid);
      for (const [c, x1, x2] of [[ca, A1, A2], [cb, B1, B2]]) {
        let prev = hz({ t: t1, tell: t1 - 6, shape: 'circle', at: r2(c.L[0]), r: 6, dmg: 0.7, name: 'Endless Chase' });
        for (let k = 1; k < NCH; k++) {
          const tt = +(t1 + k * STEP).toFixed(2);
          prev = hz({ t: tt, tell: +(tt - 1.2).toFixed(2), shape: 'circle', r: 6, from: 'target', targets: [k < N1 ? x1 : x2], snap: 0.5, after: prev, move: 3, dmg: 0.7, aimed: true, name: 'Endless Chase' });
        }
        call(tC, `12x Chasing puddle on you: middle till the lasers, then bait clockwise`, { slot: x1, alert: true, dur: 7 });
        call(tOut - 0.5, `Chaser passes to you: take it ${mode === 'cw' ? 'on clockwise' : 'back counterclockwise'}`, { slot: x2, alert: true, dur: 6 });
      }
      call(tC, 'Middle; chasers on ' + [A1, B1].join(' and '), { dur: 5 });
      label(nh, `Naught Hunts (chasers on ${A1} and ${B1}, then ${A2} and ${B2})`);
      if (ec) label(ec, 'Endless Chase (the chasers)');
    }

    P.boss.sort((a, b) => a.t - b.t);
    P.looks.sort((a, b) => a.t - b.t);
    if (!P.looks.length) P.looks.push({ t: 0, show: ['a1_stg00', 'a1_stg01', 'a1_nat', 'a1_arf10'] });
    return P;
  }

  // The waymarks: A north, B east, C south, D west; the numbers on the intercards, 1-A (Hector: 1 north-west, then
  // clockwise) or A-1 (Modified: 1 north-east).
  const WM = (one) => {
    const nums = [0, 1, 2, 3].map(k => one + 90 * k), col = ['red', 'yellow', 'blue', 'purple'];
    return [
      { label: 'A', at: [0, 12], color: 'red' }, { label: 'B', at: [12, 0], color: 'yellow' },
      { label: 'C', at: [0, -12], color: 'blue' }, { label: 'D', at: [-12, 0], color: 'purple' },
      ...nums.map((b, k) => ({ label: String(k + 1), at: r2(at(b, 12)), color: col[k], square: true })),
    ];
  };
  const WM_1A = WM(315), WM_A1 = WM(45);

  B.FIGHT_SCRIPTS = B.FIGHT_SCRIPTS || {};
  B.FIGHT_SCRIPTS.ex8 = {
    // FFLogs' max HP in an EX8 kill (report 7kmW2hMynHcNCd1w): Enuo 107,935,443; the Looming Shadow 9,863,154 and its
    // hands (Aggressive 318,227 x4, Protective 284,333 x2, Soothing 220,311 x2); the Beacon in the Dark 1,660,806.
    hp: 107935443,
    // The intermission's two add windows: everything the party deals goes to them (Enuo can't be targeted).
    adds: [
      { from: 174.9, to: 296, hp: 12151350, share: 1, whileAway: true, name: 'Looming Shadow and its hands' },
      { from: 296, to: 486.2, hp: 1660806, share: 1, whileAway: true, name: 'Beacon in the Dark' },
    ],
    // Each down, the fight goes on (cactbot's timeline waits on them).
    pushes: [
      { from: 174.9, to: 296, adds: 0, name: 'The Looming Shadow is down' },
      { from: 296, to: 486.2, adds: 1, name: 'The Beacon in the Dark is down' },
    ],
    defaultStrat: 'hector',
    strats: {
      hector: { label: 'Hector' },
      modified: { label: 'Modified (1L_)' },
    },
    source: 'wtfdig.info/75/ex8; mechanics after BossMod (github.com/awgil/ffxiv_bossmod) and an FFLogs kill',
    // The strat's own markers (1-A for Hector, A-1 for Modified).
    get waymarks() {
      const m = B.app && B.app.fight && B.app.fight.key === 'ex8' && B.app.fight.mech;
      return m && m.strat === 'modified' ? WM_A1 : WM_1A;
    },
    plan,
  };
})(window.BLM);
