// EX6, The Windward Wilds (Extreme): Guardian Arkveld's mechanics for the sim's party, on cactbot's timeline
// (07-dt/trial/arkveld-ex, read along its main line), and the strat wtfdig.info lists for the fight (73/ex6): Hector's.
// Spots are [east, north] yalms from the arena's middle.
//
// The mechanics follow BossMod's module (github.com/awgil/ffxiv_bossmod, Ex6GuardianArkveld), whose shapes and sizes
// come from the game's Action sheet; where things stand and when they go off follows three FFLogs kills (the boss's and
// its helpers' casts, and where the players stood). The arena is a circle of 20 (BossMod's). Built with the sim's
// toolkit (js/mech.js):
//   - Roar: raidwide. Forged Fury: three raidwides (he powers up: his casts are a second shorter after it).
//   - Chainblade Blow: he lifts a wing; two chain lines (4 wide, one ahead, one 15 degrees toward that side) and a
//     28-wide cleave over that side of him (reaching 5 past his middle line), then the same mirrored: one side, then
//     the other (which side first is picked each time).
//   - Siegeflight: he leaps to the south edge and dashes across (4 wide, then 8 wide); white (Guardian Resonance: the
//     middle 16 explodes, light parties stack on the sides, melee near where he lands, ranged far) or red (Wyvern's
//     Radiance: the sides explode, the stacks line up in the middle), the two in either order. Wyvern's Rattle between
//     them: a 40-wide wave stepping 8 yalms from his end every 2.6 seconds and two sets of puddles baited where everyone
//     stands; the party's way through is solved each pull.
//   - Rush: three charges (12 wide) round a triangle, each landing spot rippling out in rings (8, 14, 20, 26) two
//     seconds apart; the party waits near the third and walks the gaps (solved each pull). The first is fixed in the
//     kills; the later ones turn with where he starts, and either way round.
//   - Wyvern's Ouroblade: half the room on one side of him, and a spread on everyone in the other half.
//   - Steeltail Thrust: a line behind him; Chainblade Charge: a party stack on his hitbox's edge, and (from the second
//     time) a 12-yalm puddle on him after it.
//   - Aetheric Resonance: three rounds of puddles baited by everyone (the middle, toward your tower, away from every
//     tower), then four towers and two tank towers (Hector's: tanks north-west and south-east, ranged north, melee
//     south). The towers leave crystals that explode (6 yalms, the big ones 12) when an exaflare, a laser or another
//     crystal's explosion touches them, a second or so later.
//   - After the first towers: Wyvern's Vengeance's exaflares from the middle (cardinals, then intercardinals, twice),
//     spreads on the supports, then the DPS.
//   - Clamorous Chase (limit cut): he jumps on 1 to 8 in turn (6-yalm circle) and slices the half of the room beyond
//     each one's chord; Hector's diamond: 1 on the cardinal opposite the wing, 2 south, 3 across from 1, 4 north after
//     the first slice, 5-8 the same spots; everyone else in the middle.
//   - Wyvern's Weal: three lasers from the north edge, each turning 11.6 degrees every 0.7 seconds after its target
//     (who runs across); the first sets off the second towers' crystals; light party stacks with the second, a spread
//     after the third.
//   - Wrathful Rattle: a cross of lines through the middle stepping out to the edge, then lines from the edges in to
//     the middle (twice) and out again, with a Chainblade Blow on top; the second Rush follows from the far edge.
//   - After the third towers: Wyvern's Vengeance from one side of the arena, three pairs of lines of six.
// Simplified: the lasers' bearings are fixed from where their targets stand as the telegraph starts (the game turns
// each after its target as it runs); the crystals are drawn as markers; Greater Resonance (a raidwide in some logs) is
// left out; the wrong role in a tank tower is just hit. Where wtfdig gives no spot (the exaflare spreads, the
// lasers' bait spot, the Rattle's second puddles), the spots are this script's own.
(function (B) {
  const S = B.SLOTS;
  const at = B.bearing;
  const inside = B.mechInside;
  const add = (a, b) => [a[0] + b[0], a[1] + b[1]];
  const sub = (a, b) => [a[0] - b[0], a[1] - b[1]];
  const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);
  const deg360 = (d) => ((d % 360) + 360) % 360;
  const pick = (a) => a[Math.floor(Math.random() * a.length)];
  const coin = () => Math.random() < 0.5;
  const shuffle = (a) => { const b = a.slice(); for (let i = b.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [b[i], b[j]] = [b[j], b[i]]; } return b; };
  const r2 = (p) => [+p[0].toFixed(2), +p[1].toFixed(2)];
  const brg = (p) => deg360(Math.atan2(p[0], p[1]) * 180 / Math.PI);
  const len = (p) => Math.hypot(p[0], p[1]);
  // A point turned d degrees clockwise round the middle.
  const rot = (p, d) => { const a = d * Math.PI / 180, c = Math.cos(a), s = Math.sin(a); return [p[0] * c + p[1] * s, p[1] * c - p[0] * s]; };
  const SUP = ['MT', 'OT', 'H1', 'H2'], DPS = ['M1', 'M2', 'R1', 'R2'];
  // Hector's light parties, HTMM / HTRR: the melee group close to him, the ranged group far.
  const G1 = ['MT', 'H1', 'M1', 'M2'], G2 = ['OT', 'H2', 'R1', 'R2'];
  const COMPASS = ['north', 'north-east', 'east', 'south-east', 'south', 'south-west', 'west', 'north-west'];
  const dirName = (deg) => COMPASS[Math.round(deg360(deg) / 45) % 8];
  const R = 20, RMAX = 18.4, HITBOX = 7.8;
  const onA = (p, m) => len(p) < R - (m ?? 1.2);
  // From the boss at o facing f: fwd yalms ahead of him and lat to his right (negative: his left).
  const rel = (o, f, fwd, lat) => add(add(o, at(f, fwd)), at(f + 90, lat));
  const latOf = (o, f, p) => { const d = sub(p, o), v = at(f + 90, 1); return d[0] * v[0] + d[1] * v[1]; };

  // The nearest point to `want` that's ok (searched outward), or want.
  function findSpot(want, ok) {
    if (ok(want)) return r2(want);
    for (let r = 0.25; r <= 40; r += 0.25) {
      const n = Math.max(12, Math.round(2 * Math.PI * r / 0.3));
      for (let k = 0; k < n; k++) { const p = add(want, at(k * 360 / n, r)); if (ok(p)) return r2(p); }
    }
    return r2(want);
  }
  // Players close round a point (within rad).
  const clusterAt = (c, slots, rad) => Object.fromEntries(slots.map((s, i) => [s, r2(add(c, i ? at((i - 1) * 360 / Math.max(1, slots.length - 1) + 20, rad ?? 0.7) : [0, 0]))]));

  // ---------- a way through ----------
  // For attacks landing one after another (steps {t, shapes}): a point for each step clear of its shapes by m (from a
  // polar grid over the floor), each reachable from the last at 5.6 yalms a second, the least walking (dynamic
  // programming, after js/fights/ex4.js). o.start: where it starts (o.reach0: how far it can get by the first step);
  // o.end: {p, tol}: where it has to be at the last step; o.pen(p, k): an extra cost.
  const CAND = (() => {
    const out = [[0, 0]];
    for (let r = 1; r <= RMAX + 1e-6; r += 0.95) { const n = Math.max(8, Math.round(2 * Math.PI * r / 0.95)); for (let k = 0; k < n; k++) out.push(r2(at(k * 360 / n + (r * 37) % 11, r))); }
    return out;
  })();
  let NEAR = null;
  function nearList() {
    if (NEAR) return NEAR;
    NEAR = CAND.map((p) => {
      const l = [];
      CAND.forEach((q, j) => { const d = dist(p, q); if (d <= 13) l.push([j, d]); });
      l.sort((a, b) => a[1] - b[1]);
      return { j: Int32Array.from(l.map(x => x[0])), d: Float32Array.from(l.map(x => x[1])) };
    });
    return NEAR;
  }
  function solvePath(steps, o) {
    o = o || {};
    const N = CAND.length, m = o.m ?? 2.0, BAD = 1000, NB = nearList(), last = steps.length - 1;
    const bad = steps.map(st => { const b = new Uint8Array(N); for (let c = 0; c < N; c++) b[c] = st.shapes.some(h => inside(h, CAND[c], m)) ? 1 : 0; return b; });
    const endCost = (c, k) => {
      let v = o.pen ? o.pen(CAND[c], k) : 0;
      if (k === last && o.end) { const d = dist(CAND[c], o.end.p); v += d * 3 + (d > o.end.tol ? BAD : 0); }
      return v;
    };
    let cost = new Float64Array(N);
    for (let c = 0; c < N; c++) {
      let base = 0;
      if (o.start) { const d = dist(o.start, CAND[c]); base = d + (d > (o.reach0 ?? 99) ? BAD : 0); }
      cost[c] = base + bad[0][c] * BAD + endCost(c, 0);
    }
    const backs = [];
    for (let k = 1; k < steps.length; k++) {
      const reach = 5.6 * (steps[k].t - steps[k - 1].t) - 0.2, nc = new Float64Array(N), bk = new Int32Array(N);
      for (let c = 0; c < N; c++) {
        let best = Infinity, bj = c;
        if (reach >= 13) { for (let j = 0; j < N; j++) { const v = cost[j] + dist(CAND[j], CAND[c]); if (v < best) { best = v; bj = j; } } }
        else {
          const nb = NB[c];
          for (let i = 0; i < nb.j.length; i++) { const d = nb.d[i]; if (d > Math.max(0, reach)) break; const v = cost[nb.j[i]] + d; if (v < best) { best = v; bj = nb.j[i]; } }
        }
        nc[c] = best + bad[k][c] * BAD + endCost(c, k);
        bk[c] = bj;
      }
      backs.push(bk);
      cost = nc;
    }
    let c = 0;
    for (let j = 1; j < N; j++) if (cost[j] < cost[c]) c = j;
    const path = [CAND[c]], idx = [c];
    for (let k = backs.length - 1; k >= 0; k--) { c = backs[k][c]; path.unshift(CAND[c]); idx.unshift(c); }
    path.bad = idx.map((j, k) => (bad[k][j] ? k : -1)).filter(k => k >= 0);
    return path;
  }
  // Steps landing within a tenth of a second of each other are one step.
  function mergeSteps(list) {
    const out = [];
    for (const s of list.slice().sort((a, b) => a.t - b.t)) {
      const prev = out[out.length - 1];
      if (prev && s.t - prev.t < 0.12) prev.shapes.push(...s.shapes);
      else out.push({ t: s.t, shapes: s.shapes.slice() });
    }
    return out;
  }

  // ---------- the crystals ----------
  // The towers leave a crystal at each (the large towers a big one): an exaflare's hit sets one off 1.6 seconds later,
  // a laser's 1.16, another crystal's explosion 1.17 (BossMod's WyvernsRadianceCrystal and the kills); a small one
  // explodes 6 yalms round, a big one 12. hits: [{t, shape, delay}], in any order. Returns [{at, big, t}] (t null:
  // never set off).
  function crystalTimes(crystals, hits) {
    const cs = crystals.map(c => ({ at: c.at, big: c.big, hb: c.big ? 1.2 : 0.7, t: Infinity }));
    for (const h of hits) for (const c of cs) {
      const touch = h.shape.shape === 'circle' ? dist(c.at, h.shape.at) <= h.shape.r + c.hb : inside(h.shape, c.at, c.hb);
      if (touch) c.t = Math.min(c.t, h.t + h.delay);
    }
    for (let changed = true; changed;) {         // chains: each explosion reaches the crystals round it
      changed = false;
      for (const a of cs) {
        if (!isFinite(a.t)) continue;
        for (const b of cs) {
          if (b === a || dist(a.at, b.at) > (a.big ? 12 : 6) + b.hb) continue;
          if (a.t + 1.17 < b.t - 1e-6) { b.t = +(a.t + 1.17).toFixed(2); changed = true; }
        }
      }
    }
    return cs.map(c => ({ at: c.at, big: c.big, t: isFinite(c.t) ? +c.t.toFixed(2) : null }));
  }

  // ---------- the layouts ----------
  // The towers are the same in every kill: the first and third sets, and the second (Hector's soakers: ranged north,
  // melee south, R1/M1 west; the tanks the large ones, MT the one nearer north-west).
  const TOWERS1 = { small: { R1: [-4, 12], R2: [8, 10], M1: [-8, -6], M2: [2, -10] }, large: { MT: [-12, 4], OT: [10, -2] } };
  const TOWERS2 = { small: { R1: [-10, 8], R2: [10, 2], M1: [-12, -4], M2: [8, -8] }, large: { MT: [2, 10], OT: [-4, -12] } };
  const crystalsOf = (L) => [...Object.values(L.small).map(p => ({ at: p, big: false })), ...Object.values(L.large).map(p => ({ at: p, big: true }))];

  // Where the party stands between mechanics: the boss in the middle facing north (MT in front, melee at his back
  // corners, the rest behind), or at the edge facing in ([ahead, right] of him).
  const UP_C = { MT: [0, 9.2], M1: [-6.4, -6.4], M2: [6.4, -6.4], H1: [-11, -9], H2: [11, -9], OT: [-5.5, -13.5], R1: [-9.5, -14.5], R2: [9.5, -14.5] };
  const UP_E = { MT: [9.2, 0], M1: [6.6, -6.4], M2: [6.6, 6.4], OT: [14, -3], H1: [16, -8], H2: [16, 8], R1: [22, -6], R2: [22, 6] };
  function upAt(o, f) {
    const out = {}, taken = [];
    for (const s of S) {
      const want = len(o) < 3 ? add(o, rot(UP_C[s], f)) : rel(o, f, UP_E[s][0], UP_E[s][1]);
      const p = findSpot(want, q => onA(q, 1.4) && taken.every(x => dist(x, q) > 1.3));
      taken.push(p);
      out[s] = p;
    }
    return out;
  }

  // ---------- the pull ----------
  function plan(events, strat) {
    const P = { start: null, prefs: [], hazards: [], checks: [], calls: [], marks: [], labels: new Map(), debuffs: [],
      boss: [], face: [], hitbox: [{ t: 0, r: HITBOX }], arena: { shape: 'circle', at: [0, 0], r: R }, looks: [], notes: [] };
    let id = 0;
    const hz = (o) => { const h = Object.assign({ id: ++id, react: 3 }, o); P.hazards.push(h); return h; };
    const pref = (t, spots) => P.prefs.push({ t: +t.toFixed(2), spots });
    const call = (t, text, o) => P.calls.push(Object.assign({ t: +t.toFixed(2), text, dur: 5 }, o));
    const debuff = (slot, name, hint, t0, t1) => P.debuffs.push({ slot, key: null, name, hint, t0, t1 });
    const mark = (shape, t0, t1, fill) => P.marks.push(Object.assign({ kind: 'lit', t0: +t0.toFixed(2), t1: +t1.toFixed(2), fill }, shape));
    const label = (ev, text) => { if (ev) P.labels.set(ev, text); };
    const E = (name, t0, t1) => events.find(e => e.name === name && e.t >= t0 && e.t <= t1) || null;
    const EA = (name, t0, t1) => events.filter(e => e.name === name && e.t >= t0 && e.t <= t1);
    const solve = (name, steps, o) => { const p = solvePath(steps, o); if (p.bad.length) P.notes.push(`${name}: no clean way at ${p.bad.map(k => steps[k].t.toFixed(1)).join(', ')}`); return p; };
    // A solved way as spots: the first from t0, each next one as the step before it lands.
    const follow = (path, steps, t0, slots, rad) => {
      pref(t0, clusterAt(path[0], slots, rad));
      path.forEach((p, k) => { if (k) pref(steps[k - 1].t + 0.05, clusterAt(p, slots, rad)); });
    };

    // ----- where the boss stands and faces -----
    const bossPath = P.boss, faces = P.face;
    const bossTo = (t, p, move) => bossPath.push({ t: +t.toFixed(2), at: r2(p), move });
    const faceTo = (t, f) => faces.push(Object.assign({ t: +t.toFixed(2) }, f));
    const pathAt = (t) => {
      let prev = bossPath[0].at, cur = null;
      for (const k of bossPath) { if (k.t > t) break; if (cur) prev = cur.at; cur = k; }
      if (!cur) return bossPath[0].at;
      const f = cur.move ? Math.min(1, (t - cur.t) / cur.move) : 1;
      return [prev[0] + (cur.at[0] - prev[0]) * f, prev[1] + (cur.at[1] - prev[1]) * f];
    };
    const faceAt = (t) => {
      let f = null;
      for (const k of faces) if (k.t <= t) f = k;
      if (!f) return 180;
      if (f.deg !== undefined) return f.deg;
      return brg(sub(f.at, pathAt(t)));
    };
    // He leaps somewhere: facing in from the edge, north in the middle.
    const leap = (t, p) => { bossTo(t, p, 0.6); faceTo(t + 0.6, len(p) > 3 ? { at: [0, 0] } : { deg: 0 }); };

    const sf = EA('Siegeflight (dash)', 0, 9999), sfStack = EA('Dragonspark/White Flash', 0, 9999), rattles = EA("Wyvern's Rattle", 0, 9999);
    const rush1 = EA('Rush (1)', 0, 9999), centers = EA('(center)', 0, 9999), roars = EA('Roar (raidwide)', 0, 9999);
    const lc = EA('Clamorous Chase (1)', 0, 9999)[0], weals = EA("Wyvern's Weal", 0, 9999), wrath = E('Wrathful Rattle', 0, 9999);
    const rushSets = rush1.map(r => [r, E('Rush (2)', r.t, r.t + 4), E('Rush (3)', r.t, r.t + 6)]);
    // The second Rush starts across from where the Wrathful Rattle had him: he leaps to an edge (any of eight ways).
    const X = at(pick([0, 45, 90, 135, 180, 225, 270, 315]), 20);
    const rushStart = [[0, 20], r2(rot(X, 180)), [0, 20]];
    const rushPattern = ['A', pick(['A', 'B']), pick(['A', 'B'])];
    const rushPts = rushSets.map((_, k) => {
      const b = brg(rushStart[k]);
      return rushPattern[k] === 'A' ? [at(b + 236.31, 14.42), at(b + 123.69, 14.42), at(b, 14)] : [at(b + 180, 14), at(b + 303.69, 14.42), at(b + 56.31, 14.42)];
    });

    bossTo(0, [0, 10.5]);
    faceTo(0, { at: [0, 0] });
    const timeline = [];
    sf.forEach((ev, k) => {
      const from = k % 2 === 0 ? [0, -20] : [0, 20], to = k % 2 === 0 ? [0, 20] : [0, -20];
      if (k % 2 === 0) timeline.push([ev.t - (ev.t > 300 ? 7.2 : 8.2), () => leap(ev.t - (ev.t > 300 ? 7.2 : 8.2), from)]);
      timeline.push([ev.t, () => { bossTo(ev.t, to, 0.35); faceTo(ev.t, { deg: brg(sub(to, from)) }); faceTo(ev.t + 0.5, { at: [0, 0] }); }]);
    });
    rushSets.forEach((rs, k) => {
      const t0 = rs[0].t;
      timeline.push([t0 - 8.2, () => leap(t0 - 8.2, rushStart[k])]);
      rs.forEach((ev, j) => {
        const tt = ev ? ev.t : t0 + 2.1 * j;
        timeline.push([tt, () => { const prev = j ? rushPts[k][j - 1] : rushStart[k]; bossTo(tt, rushPts[k][j], 0.35); faceTo(tt, { deg: brg(sub(rushPts[k][j], prev)) }); }]);
      });
    });
    for (const ev of centers) timeline.push([ev.t, () => leap(ev.t, [0, 0])]);
    const lcRoar = lc && roars.find(r => r.t < lc.t && r.t > lc.t - 20);
    if (lc) timeline.push([(lcRoar ? lcRoar.t : lc.t - 12) - 7.3, () => leap((lcRoar ? lcRoar.t : lc.t - 12) - 7.3, [0, 20])]);
    if (weals.length) timeline.push([weals[0].t - 11.1, () => leap(weals[0].t - 11.1, [0, 20])]);
    if (wrath) timeline.push([wrath.t - 3.2, () => leap(wrath.t - 3.2, X)]);
    // (the limit cut's jumps go in with the limit cut, below)
    const lcJumps = [];
    timeline.sort((a, b) => a[0] - b[0]);

    // The limit cut's spots and order, now, so the boss's path has his jumps.
    const LC = (() => {
      if (!lc) return null;
      const left = coin(), order = shuffle(S);
      const chase = EA('Clamorous Chase (1)', 0, 9999).concat(...[2, 3, 4, 5, 6, 7, 8].map(n => EA(`Clamorous Chase (${n})`, 0, 9999)));
      const wings = EA('Clamorous Chase (wing)', 0, 9999);
      const card = left ? [90, 180, 270, 0] : [270, 180, 90, 0];
      const tJ = (k) => (chase[k] ? chase[k].t : lc.t + 3 * k), tC = (k) => (wings[k] ? wings[k].t : tJ(k) + 2);
      const spot = (k) => r2(at(card[k % 4], k < 4 ? 18.5 : 16));
      return { left, order, card, tJ, tC, spot, chase, wings };
    })();
    if (LC) for (let k = 0; k < 8; k++) lcJumps.push([LC.tJ(k), () => {
      const prev = k ? LC.spot(k - 1) : [0, 20];
      bossTo(LC.tJ(k), LC.spot(k), 0.3);
      faceTo(LC.tJ(k), { deg: brg(sub(LC.spot(k), prev)) });
    }]);
    timeline.push(...lcJumps);
    timeline.sort((a, b) => a[0] - b[0]);
    for (const [, fn] of timeline) fn();
    bossPath.sort((a, b) => a.t - b.t);
    faces.sort((a, b) => a.t - b.t);

    P.start = upAt([0, 10.5], 180);
    // When each big puddle lands (from the second Chainblade Charge on, 5 seconds after it): the next spots wait.
    const bigPuddleEnd = EA('Chainblade Charge', 400, 9999).map(e => +(e.t + 5.0).toFixed(2));
    const loneStack = new Map();      // the stack after the second Vengeance Line: where he stands

    // ===== Roar, Forged Fury =====
    for (const ev of roars) {
      hz({ t: ev.t, tell: ev.t - 5, raidwide: true, dmg: 0.42, name: 'Roar' });
      call(ev.t - 5, 'AoE', { dur: 3 });
      label(ev, 'Roar (raidwide)');
    }
    for (const ev of EA('Forged Fury', 0, 9999)) {
      if (ev.t > 650) { label(ev, 'Forged Fury (the enrage)'); call(ev.t - 5, 'Enrage', { alert: true, dur: 5 }); continue; }
      [2.0, 2.9, 5.3].forEach(d => hz({ t: +(ev.t + d).toFixed(2), tell: ev.t - 5, raidwide: true, dmg: 0.22, name: 'Forged Fury' }));
      call(ev.t - 5, 'AoE x3', { dur: 6 });
      label(ev, 'Forged Fury (three raidwides; he powers up)');
    }
    for (const ev of centers) label(ev, 'Jump to the middle');
    for (const ev of EA('Greater Resonance', 0, 9999)) label(ev, 'Greater Resonance');

    // ===== Chainblade Blow: one side of him, then the other =====
    // spots: false (a solved way stands them) or the slots' spots for each hit.
    function chainblade(ev1, ev2, o2) {
      o2 = o2 || {};
      const fast = ev1.t > 300, cs = ev1.t - (fast ? 5.2 : 6.2), t2 = ev2 ? ev2.t : ev1.t + 4.2;
      const o = pathAt(ev1.t), f = faceAt(ev1.t), first = o2.first ?? (coin() ? -1 : 1);   // -1: his left first
      const tSide1 = +(ev1.t + 1.0).toFixed(2), tSide2 = +(t2 + 1.0).toFixed(2);
      const tails = (side) => [{ shape: 'line', at: r2(o), deg: deg360(f), len: 40, w: 4 }, { shape: 'line', at: r2(o), deg: deg360(f + 15 * side), len: 40, w: 4 }];
      const cleave = (side) => ({ shape: 'line', at: r2(rel(o, f, 0, 9 * side)), deg: deg360(f), len: 80, back: 40, w: 28 });
      const steps = [];
      const put = (t, tell, sh, dmg, name) => { hz(Object.assign({ t: +t.toFixed(2), tell: +tell.toFixed(2), dmg, name, react: 2.5, aimed: o2.spots === false }, sh)); steps.push({ t: +t.toFixed(2), shapes: [sh] }); };
      [first, -first].forEach((side, j) => {
        const tb = j ? t2 : ev1.t, tell = j ? tSide1 : cs, [a, b] = tails(side);
        put(tb, tell, a, 1.0, 'Chainblade Blow');
        put(tb + 0.4, tell, b, 1.0, 'Chainblade Blow');
        put(j ? tSide2 : tSide1, tell, cleave(side), 1.5, "Wyvern's Radiance (Chainblade Blow)");
      });
      const safe1 = dirName(f - 90 * first), safe2 = dirName(f + 90 * first);
      call(cs, `${safe1[0].toUpperCase() + safe1.slice(1)}, then ${safe2}`, { alert: true, dur: 6 });
      label(ev1, `Chainblade Blow (his ${first < 0 ? 'left' : 'right'} first: ${safe1} safe, then ${safe2})`);
      label(ev2, 'Chainblade Blow (the other side)');
      if (o2.spots === false) return { steps, cs, end: tSide2 };
      // Beside him on the safe side (6.9 past his middle line), the melee on the hitbox's edge.
      const WANT = { MT: [2, 8.6], M1: [-1, 8.6], M2: [5, 8.6], OT: [4.5, 11], H1: [9, 9.5], H2: [12.5, 10.5], R1: [13, 8.4], R2: [16, 9.5] };
      const sideSpots = (side) => {
        const out = {}, taken = [];
        for (const s of S) {
          const p = findSpot(rel(o, f, WANT[s][0], WANT[s][1] * side), q => onA(q, 1.4) && latOf(o, f, q) * side > 7.2 && taken.every(x => dist(x, q) > 1.2));
          taken.push(p);
          out[s] = p;
        }
        return out;
      };
      pref(Math.max(cs + 0.5, (bigPuddleEnd.find(x => x > cs - 6 && x < ev1.t) || 0) + 0.4), sideSpots(-first));
      pref(tSide1 + 0.05, sideSpots(first));
      pref(tSide2 + 0.3, upAt(o, f));
      return { steps, cs, end: tSide2 };
    }
    const cb1 = EA('Chainblade Blow (1)', 0, 9999), cb2 = EA('Chainblade Blow (2)', 0, 9999);
    const cbPair = (ev) => [ev, cb2.find(e => e.t > ev.t && e.t < ev.t + 6) || null];
    const wrathCb = wrath ? cb1.find(e => e.t > wrath.t && e.t < wrath.t + 20) : null;
    // The first two went the same way in every kill (his left, then his right); the rest are picked.
    cb1.forEach((ev, k) => { if (ev !== wrathCb) chainblade(...cbPair(ev), { first: k === 0 ? -1 : k === 1 ? 1 : undefined }); });

    // ===== Siegeflight, Wyvern's Rattle =====
    // The frame of a dash from `from` to `to`: depth from his end (`to`) back along the dash, and lateral (to the right
    // of the way he went).
    const dashFrame = (from, to) => {
      const dir = brg(sub(to, from));
      return { dir, pt: (d, l) => r2(add(add(to, at(dir + 180, d)), at(dir + 90, l))) };
    };
    // The light party stacks: white (sides): melee group close on his left, ranged far on his right; red (middle):
    // both in the middle, melee close.
    const stackSpots = (kind, fr) => (kind === 'white' ? { G1: fr.pt(6, -9.5), G2: fr.pt(18, 9.5) } : { G1: fr.pt(9.6, 0), G2: fr.pt(22, 0) });
    function dashHazards(ev, kind, from, to, tS, steps) {
      const fast = ev.t > 300, cs = ev.t - (fast ? 4 : 5), dir = brg(sub(to, from));
      const put = (o) => { const h = hz(Object.assign({ react: 2.5, aimed: !!steps }, o)); if (steps) steps.push({ t: h.t, shapes: [{ shape: h.shape, at: h.at, deg: h.deg, len: h.len, w: h.w }] }); return h; };
      put({ t: ev.t, tell: cs, shape: 'line', at: from, deg: dir, len: 40, w: 4, dmg: 1.2, name: 'Siegeflight' });
      put({ t: +(ev.t + 1.6).toFixed(2), tell: cs, shape: 'line', at: from, deg: dir, len: 40, w: 8, dmg: 1.2, name: 'Siegeflight' });
      if (kind === 'white') put({ t: tS, tell: cs, shape: 'line', at: from, deg: dir, len: 40, w: 16, dmg: 1.4, name: 'Guardian Resonance' });
      else for (const s of [-1, 1]) put({ t: tS, tell: cs, shape: 'line', at: r2(add(from, at(dir + 90, 13 * s))), deg: dir, len: 40, w: 18, dmg: 1.4, name: "Wyvern's Radiance" });
      return cs;
    }
    function dashStacks(kind, tS) {
      const tg = [pick(G1), pick(G2)];
      for (const s of tg) hz({ t: tS, tell: +(tS - 8).toFixed(2), effect: 'share', shape: 'circle', from: 'target', targets: [s], r: 6, min: 4, max: 4, dmg: 0.5, name: kind === 'white' ? 'White Flash' : 'Dragonspark' });
      call(tS - 8, kind === 'white' ? 'Out of the middle => light party stacks on the sides' : 'Out of the line => back in: light party stacks in the middle', { alert: true, dur: 7 });
      return tg;
    }
    // A pair of dashes with the Rattle between them.
    function siegePair(evA, stA, rat, evB, stB) {
      const kinds = coin() ? ['white', 'red'] : ['red', 'white'];
      const fromA = [0, -20], toA = [0, 20], fromB = [0, 20], toB = [0, -20];
      const tSA = stA ? stA.t : evA.t + 5.2, tSB = stB ? stB.t : evB.t + 5.2;
      const frA = dashFrame(fromA, toA), frB = dashFrame(fromB, toB);
      // --- the first dash ---
      const csA = dashHazards(evA, kinds[0], fromA, toA, tSA);
      const tgA = dashStacks(kinds[0], tSA);
      const spA = stackSpots(kinds[0], frA);
      if (kinds[0] === 'red') {
        pref(csA + 0.3, Object.assign(clusterAt(frA.pt(9.6, -6.6), G1, 0.7), clusterAt(frA.pt(22, 6.6), G2, 0.7)));
        pref(evA.t + 1.65, Object.assign(clusterAt(spA.G1, G1, 0.7), clusterAt(spA.G2, G2, 0.7)));
      } else pref(csA + 0.3, Object.assign(clusterAt(spA.G1, G1, 0.7), clusterAt(spA.G2, G2, 0.7)));
      label(evA, `Siegeflight (${kinds[0]}: ${kinds[0] === 'white' ? 'the middle explodes' : 'the sides explode'})`);
      label(stA, `${kinds[0] === 'white' ? 'White Flash' : 'Dragonspark'} (light party stacks on ${tgA.join(' and ')})`);
      // --- the Rattle: the wave from his end, two sets of puddles where everyone stands ---
      const tR = rat ? rat.t : tSA + 1.0;
      const waveDir = brg(sub(fromA, toA)), steps = [];
      for (let k = 0; k < 5; k++) {
        const tt = +(tR + 2.5 + 2.585 * k).toFixed(2), sh = { shape: 'line', at: r2(add(toA, at(waveDir, 8 * k))), deg: waveDir, len: 8, w: 40 };
        hz(Object.assign({ t: tt, tell: k >= 2 ? +(tt - 2 * 2.585).toFixed(2) : tR, dmg: 1.2, name: "Wyvern's Radiance (the wave)", react: 2.4, aimed: true }, sh));
        steps.push({ t: tt, shapes: [sh] });
      }
      // The second puddles: just past the first wave, each light party its own side.
      const drop2 = kinds[0] === 'white' ? { G1: frA.pt(10.8, -4.5), G2: frA.pt(10.8, 5.5) } : { G1: frA.pt(10.8, -5.5), G2: frA.pt(14, 6) };
      const drops = [[tR, 5.0, spA], [+(tR + 2.0).toFixed(2), 5.0, drop2]];
      for (const [t0, d, sp] of drops) {
        hz({ t: +(t0 + d).toFixed(2), tell: t0, shape: 'circle', r: 6, from: 'target', targets: S.slice(), snap: d, dmg: 0.9, name: "Wyvern's Radiance (puddle)" });
        steps.push({ t: +(t0 + d).toFixed(2), shapes: [sp.G1, sp.G2].map(p => ({ shape: 'circle', at: p, r: 6.9 })) });
      }
      pref(tR + 0.05, Object.assign(clusterAt(drop2.G1, G1, 0.7), clusterAt(drop2.G2, G2, 0.7)));
      call(tR, 'Bait puddles => behind the first wave', { alert: true, dur: 6 });
      label(rat, "Wyvern's Rattle (the wave and two sets of puddles)");
      // --- the second dash ---
      dashHazards(evB, kinds[1], fromB, toB, tSB, steps);
      const tgB = dashStacks(kinds[1], tSB);
      const spB = stackSpots(kinds[1], frB);
      label(evB, `Siegeflight (${kinds[1]}: ${kinds[1] === 'white' ? 'the middle explodes' : 'the sides explode'})`);
      label(stB, `${kinds[1] === 'white' ? 'White Flash' : 'Dragonspark'} (light party stacks on ${tgB.join(' and ')})`);
      // Each light party's way from its second puddle to its next stack.
      const ms = mergeSteps(steps.filter(s => s.t > tR + 2.05));
      for (const [g, slots] of [['G1', G1], ['G2', G2]]) {
        const path = solve(`Rattle (${g})`, ms, { start: drop2[g], reach0: 5.6 * (ms[0].t - tR - 2.05), end: { p: spB[g], tol: 1.3 } });
        path.forEach((p, k) => pref(k ? ms[k - 1].t + 0.05 : tR + 2.1, clusterAt(p, slots, 0.7)));
      }
      pref(tSB + 0.3, upAt(toB, 0));
    }
    for (let k = 0; k + 1 < sf.length; k += 2) {
      const a = sf[k], b = sf[k + 1];
      siegePair(a, sfStack.find(e => e.t > a.t && e.t < a.t + 8), rattles.find(e => e.t > a.t && e.t < b.t), b, sfStack.find(e => e.t > b.t && e.t < b.t + 8));
    }

    // ===== Rush: three charges round a triangle, the rings from each =====
    function rushSteps(k) {
      const [r1, r2_, r3] = rushSets[k], pts = rushPts[k], cs = r1.t - 6;
      const tR = [r1.t, r2_ ? r2_.t : r1.t + 2.1, r3 ? r3.t : r1.t + 4.15], steps = [];
      pts.forEach((p, j) => {
        const from = j ? pts[j - 1] : rushStart[k], sh = { shape: 'line', at: r2(from), deg: brg(sub(p, from)), len: dist(from, p), w: 12 };
        hz(Object.assign({ t: tR[j], tell: cs + 2 * j, dmg: 1.3, name: 'Rush', react: 2.5, aimed: true }, sh));
        steps.push({ t: tR[j], shapes: [sh] });
        const t0 = r1.t + 1.52 + 2.03 * j;
        [[0, 8], [8, 14], [14, 20], [20, 26]].forEach(([a, b], i) => {
          const s = a ? { shape: 'donut', at: r2(p), r0: a, r1: b } : { shape: 'circle', at: r2(p), r: b };
          const tt = +(t0 + 2 * i).toFixed(2);
          hz(Object.assign({ t: tt, tell: i ? +(tt - 2).toFixed(2) : cs + 2 * j, dmg: 1.2, name: "Wyvern's Radiance (quake)", react: 2, aimed: true }, s));
          steps.push({ t: tt, shapes: [s] });
        });
      });
      const third = dirName(brg(pts[2]));
      call(cs, `Wait near the third jump (${third}) => into its circle`, { alert: true, dur: 7 });
      label(r1, `Rush (${dirName(brg(pts[0]))} => ${dirName(brg(pts[1]))} => ${third})`);
      return { steps, cs, end: Math.max(...steps.map(s => s.t)) };
    }

    // ===== Wyvern's Ouroblade: half the room and spreads =====
    function ouroblade(ev) {
      const o = pathAt(ev.t), f = faceAt(ev.t), side = coin() ? -1 : 1;      // the cleaved side: -1 his left
      const cs = ev.t - 6, tHit = +(ev.t + 1.0).toFixed(2), we = E('Wild Energy (aoes)', ev.t, ev.t + 3), tSp = we ? we.t : +(ev.t + 1.2).toFixed(2);
      hz({ t: tHit, tell: cs, shape: 'cone', at: r2(o), deg: deg360(f + 90 * side), half: 90, r: 40, dmg: 1.5, name: "Wyvern's Ouroblade" });
      hz({ t: tSp, tell: +(tSp - 8).toFixed(2), effect: 'bait', shape: 'circle', r: 6, from: 'target', targets: S.slice(), snap: 0.3, dmg: 0.9, own: 0.3, name: 'Wild Energy' });
      // The safe half: three on the hitbox's edge, five at the wall ([ahead, away from the middle line]).
      const SPOT = { MT: [7.8, 4.5], M1: [0, 9], M2: [-7.8, 4.5], OT: [16, 5.8], H1: [9.75, 13.9], R1: [0, 17], H2: [-9.75, 13.9], R2: [-16, 5.8] };
      const spots = Object.fromEntries(S.map(s => [s, findSpot(rel(o, f, SPOT[s][0], -side * SPOT[s][1]), q => onA(q, 1.4))]));
      pref(Math.max(cs + 0.5, tSp - 6.2), spots);
      pref(tSp + 0.3, upAt(o, f));
      call(cs, `${dirName(f - 90 * side)[0].toUpperCase() + dirName(f - 90 * side).slice(1)} half => spread`, { alert: true, dur: 6 });
      label(ev, `Wyvern's Ouroblade (his ${side < 0 ? 'left' : 'right'}: ${dirName(f - 90 * side)} safe)`);
      label(we, 'Wild Energy (spreads)');
    }
    EA("Wyvern's Ouroblade", 0, 9999).forEach(ouroblade);

    // ===== Steeltail Thrust and Chainblade Charge =====
    for (const evT of EA('Steeltail Thrust', 0, 9999)) {
      const fast = evT.t > 300, o = pathAt(evT.t), f = faceAt(evT.t), csT = evT.t - (fast ? 3.6 : 4.6);
      hz({ t: evT.t, tell: csT, shape: 'line', at: r2(o), deg: deg360(f + 180), len: 60, w: 6, dmg: 1.4, name: 'Steeltail Thrust' });
      call(csT, 'Avoid the tail => stack', { dur: 4 });
      label(evT, 'Steeltail Thrust (a line behind him)');
      const evC = E('Chainblade Charge', evT.t, evT.t + 15);
      const stackAt = rel(o, f, 9.4, 0);
      pref(csT + 0.3, clusterAt(stackAt, S, 0.9));
      if (evC) {
        const tg = pick(S), big = evC.t > 400;
        hz({ t: evC.t, tell: +(evC.t - 8.3).toFixed(2), effect: 'share', shape: 'circle', from: 'target', targets: [tg], r: 6, min: 5, dmg: 0.6, name: 'Chainblade Charge' });
        call(evC.t - 8.3, `Stack on ${tg} (his hitbox's edge)`, { dur: 6 });
        label(evC, `Chainblade Charge (party stack on ${tg})`);
        if (big) {
          const tP = +(evC.t + 5.0).toFixed(2);
          hz({ t: tP, tell: evC.t, shape: 'circle', at: r2(o), r: 12, dmg: 1.3, name: "Wyvern's Radiance (the big puddle)" });
          pref(evC.t + 0.1, clusterAt(rel(o, f, 14.2, 0), S, 0.9));
          call(evC.t + 0.2, 'Out of the big puddle', { alert: true, dur: 4 });
          pref(tP + 0.3, upAt(o, f));
        } else pref(evC.t + 0.3, upAt(o, f));
      }
    }
    // The stack that follows the second Vengeance Line (no tail first).
    for (const evC of EA('Chainblade Charge', 0, 9999)) {
      if (P.labels.has(evC)) continue;
      const o = pathAt(evC.t), f = faceAt(evC.t), tg = pick(S);
      hz({ t: evC.t, tell: +(evC.t - 8.3).toFixed(2), effect: 'share', shape: 'circle', from: 'target', targets: [tg], r: 6, min: 5, dmg: 0.6, name: 'Chainblade Charge' });
      call(evC.t - 8.3, `Stack on ${tg} (his hitbox's edge)`, { dur: 6 });
      label(evC, `Chainblade Charge (party stack on ${tg})`);
      const tP = +(evC.t + 5.0).toFixed(2);
      hz({ t: tP, tell: evC.t, shape: 'circle', at: r2(o), r: 12, dmg: 1.3, name: "Wyvern's Radiance (the big puddle)" });
      // (its spots come from the Vengeance Line's solved way, below)
      loneStack.set(evC, { o, f, tP });
    }

    // ===== Aetheric Resonance: puddles, then towers =====
    function resonance(evG, L) {
      const T = evG.t, cs = T - 11;
      const own = Object.assign({}, L.small, L.large), finals = {};
      for (const s of S) finals[s] = own[s] || [0, 0];             // the healers: the middle
      for (const [s, p] of Object.entries(L.small)) hz({ t: T, tell: cs, effect: 'tower', shape: 'circle', at: p, r: 2, soak: [1, 2], dmg: 0.3, fail: 0.9, name: 'Guardian Resonance (tower)' });
      for (const [s, p] of Object.entries(L.large)) hz({ t: T, tell: cs, effect: 'tower', shape: 'circle', at: p, r: 4, soak: [1, 2], only: { role: 'tank' }, dmg: 0.5, fail: 1.0, name: 'Guardian Resonance (tank tower)' });
      const snaps = [T - 8.0, T - 5.45, T - 2.95], lands = [T - 5.0, T - 2.45, T + 0.05];
      snaps.forEach((s, k) => hz({ t: +lands[k].toFixed(2), tell: +s.toFixed(2), shape: 'circle', r: 6, from: 'target', targets: S.slice(), snap: 3.0, dmg: 0.9, name: 'Guardian Resonance (puddle)' }));
      // The second puddles toward your tower (the healers west and east); the third away from every tower (the
      // healers drop theirs in the middle and step out to a free spot).
      const q2 = {}, q3 = { H1: [0, 0], H2: [0, 0] };
      for (const s of S) q2[s] = r2(at(own[s] ? brg(own[s]) : s === 'H1' ? 270 : 90, 7.6));
      const soakers = S.filter(s => own[s]);
      for (const s of soakers) {
        const fin = own[s];
        q3[s] = findSpot(fin, q => onA(q, 1.4) && dist(q, fin) <= 13 && len(q) > 7.4
          && soakers.every(x => dist(own[x], q) > 7.0) && S.every(x => dist(q2[x], q) > 7.2));
      }
      const towersAt = [...Object.values(L.small).map(p => [p, 3.2]), ...Object.values(L.large).map(p => [p, 5.4])];
      for (const s of ['H1', 'H2']) {
        finals[s] = findSpot(at(s === 'H1' ? 250 : 110, 8.5), q => onA(q, 1.4) && len(q) > 7.3 && len(q) < 13
          && Object.values(q3).every(x => dist(x, q) > 7.0) && towersAt.every(([c, r]) => dist(c, q) > r)
          && (s === 'H1' || dist(finals.H1, q) > 1.5));
      }
      pref(cs + 0.4, clusterAt([0, 0], S, 1.0));
      pref(snaps[0] + 0.05, q2);
      pref(snaps[1] + 0.05, q3);
      pref(lands[1] + 0.05, finals);
      for (const s of S) {
        if (own[s]) call(cs, `Bait middle => toward your tower => away; tower ${dirName(brg(own[s]))}${L.large[s] ? ' (tank tower)' : ''}`, { slot: s, alert: true, dur: 8 });
        else call(cs, 'Bait middle => out => away from the towers; then the middle', { slot: s, alert: true, dur: 8 });
      }
      label(E('Aetheric Resonance', T - 4, T), 'Aetheric Resonance (three puddle baits, then towers)');
      label(evG, 'Guardian Resonance (towers: four, two for the tanks)');
      return { T, finals };
    }
    const resG = EA('Guardian Resonance', 0, 9999);
    const res = resG.map((ev, k) => resonance(ev, k === 1 ? TOWERS2 : TOWERS1));
    const crystalMarks = (L, T, ct) => {
      ct.forEach(c => { if (c.t !== null) mark({ shape: 'circle', at: c.at, r: c.big ? 1.2 : 0.7 }, T + 0.1, c.t, 'rgba(150,225,255,0.85)'); });
    };
    const crystalHazards = (ct, t0, aimed) => ct.forEach(c => {
      if (c.t === null) return;
      hz({ t: c.t, tell: +Math.max(t0, c.t - 2.5).toFixed(2), shape: 'circle', at: c.at, r: c.big ? 12 : 6, dmg: c.big ? 1.4 : 1.0, name: "Wyvern's Radiance (crystal)", react: 2.4, aimed: !!aimed });
    });

    // ===== The first exaflares: Wyvern's Vengeance from the middle, spreads =====
    if (res[0]) {
      const T = res[0].T, wes = EA('Wild Energy (aoes)', T, T + 45);
      const tW1 = wes[0] ? wes[0].t : T + 24.7, tW2 = wes[1] ? wes[1].t : tW1 + 8;
      const sets = [tW1 - 15.06, tW1 - 8.04, tW1 + 0.05, tW2 + 0.05].map(v => +v.toFixed(2));
      const exa = [];
      sets.forEach((ts, k) => {
        for (let d = k % 2 ? 45 : 0; d < 360; d += 90) for (let j = 0; j < 3; j++) {
          const tt = +(ts + [0, 1.12, 2.18][j]).toFixed(2), sh = { shape: 'circle', at: r2(at(d, 6 + 8 * j)), r: 6 };
          hz(Object.assign({ t: tt, tell: +Math.max(ts - 5, tt - 2.3).toFixed(2), dmg: 1.0, name: "Wyvern's Vengeance", react: 2.2, aimed: k < 2 }, sh));
          exa.push({ t: tt, shape: sh, delay: 1.6 });
        }
      });
      const ct = crystalTimes(crystalsOf(TOWERS1), exa);
      crystalHazards(ct, sets[0] - 3, true);
      crystalMarks(TOWERS1, T, ct);
      // Supports spread on the intercardinals, DPS beyond them; then the DPS on the cardinals, supports beyond.
      const IC = { MT: 315, H2: 45, OT: 135, H1: 225, R1: 315, R2: 45, M2: 135, M1: 225 };
      const CA = { MT: 0, H2: 90, OT: 180, H1: 270, R1: 0, R2: 90, M2: 180, M1: 270 };
      const ring = (sl, ang, first) => Object.fromEntries(sl.map(s => [s, r2(at(ang[s], SUP.includes(s) === first ? 10.5 : 18))]));
      const sp1 = ring(S, IC, true), sp2 = ring(S, CA, false);
      // Till then everyone together through the first two sets and the crystals.
      const steps = mergeSteps([...exa.filter(e => e.t < sets[2] - 1).map(e => ({ t: e.t, shapes: [e.shape] })),
        ...ct.filter(c => c.t !== null).map(c => ({ t: c.t, shapes: [{ shape: 'circle', at: c.at, r: c.big ? 12 : 6 }] }))]);
      const path = solve('Vengeance 1', steps, {});
      follow(path, steps, T + 0.3, S, 0.9);
      pref(sets[1] + 2.25, sp1);
      pref(sets[2] + 2.25, sp2);
      pref(tW2 + 2.3, upAt([0, 0], 0));
      for (const [k, tw, who] of [[0, tW1, SUP], [1, tW2, DPS]]) {
        hz({ t: tw, tell: +(tw - 8).toFixed(2), effect: 'bait', shape: 'circle', r: 6, from: 'target', targets: who.slice(), snap: 0.3, dmg: 0.9, own: 0.3, name: 'Wild Energy' });
        for (const s of who) call(tw - 8, `Spread ${k ? 'on the cardinals' : 'on the intercardinals'} (inside)`, { slot: s, alert: true, dur: 6 });
        label(wes[k], `Wild Energy (spreads on the ${k ? 'DPS' : 'supports'})`);
      }
      call(T + 0.5, 'Exaflares from the middle: crystals explode when hit', { alert: true, dur: 5 });
    }

    // ===== Clamorous Chase: the limit cut =====
    if (LC) {
      const icon = lc.t - 8.2;
      const n = (s) => LC.order.indexOf(s) + 1;
      const mid = (slots) => clusterAt([0, 0], slots, 1.6);
      const at0 = {};
      for (let k = 0; k < 3; k++) at0[LC.order[k]] = LC.spot(k);
      pref(icon + 0.3, Object.assign(mid(S.filter(s => !at0[s])), at0));
      for (let k = 0; k < 8; k++) {
        const s = LC.order[k], tj = LC.tJ(k), tc = LC.tC(k), prev = k ? LC.spot(k - 1) : [0, 20], sp = LC.spot(k);
        const travel = brg(sub(sp, prev)), cleave = deg360(travel + (LC.left ? -90 : 90));
        hz({ t: tj, tell: +(tj - 3).toFixed(2), effect: 'bait', shape: 'circle', r: 6, from: 'target', targets: [s], snap: 0.3, dmg: 1.2, own: 0.4, name: 'Clamorous Chase' });
        hz({ t: tc, tell: tj, shape: 'cone', at: sp, deg: cleave, half: 90, r: 40, dmg: 1.5, name: 'Clamorous Chase (wing)', react: 2 });
        debuff(s, `Limit cut ${k + 1}`, `bait the jump ${dirName(LC.card[k % 4])}`, icon, tj);
        call(icon, `#${k + 1}: ${dirName(LC.card[k % 4])}${k === 3 ? ' after the first slice' : k > 3 ? ` after #${k - 3}'s slice` : ''}`, { slot: s, alert: true, dur: 8 });
        // #k back to the middle after its jump; #k+4 out to the spot after #k's slice (#4 after #1's).
        const ch = {};
        ch[s] = r2(at(LC.card[k % 4], 3));
        pref(tj + 0.15, ch);
        const nxt = k < 4 ? LC.order[k + 4] : null;
        if (k === 0) pref(tc + 0.05, { [LC.order[3]]: LC.spot(3) });
        if (nxt) pref(tc + 0.1, { [nxt]: LC.spot(k + 4) });
        label(LC.chase[k], `Clamorous Chase (${k + 1}: ${s}, ${dirName(LC.card[k % 4])})`);
        label(LC.wings[k], `Clamorous Chase (${LC.left ? 'left' : 'right'} wing: beyond ${dirName(LC.card[k % 4])})`);
      }
      call(icon, `Limit cut: ${LC.left ? 'left' : 'right'} wing, #1 ${dirName(LC.card[0])}; everyone else in the middle`, { dur: 6 });
      pref(LC.tC(7) + 0.3, upAt([0, 18], 180));
    }

    // ===== Wyvern's Weal: three lasers from the north edge =====
    if (weals.length) {
      const o = [0, 20], WG = [-10, 15.4], EG = [10, 15.4], BE = r2(add(o, at(115, 11)));
      const STEP = 11.6, wf = E('White Flash', weals[0].t, weals[0].t + 30), we = E('Wild Energy (aoes)', weals[0].t, weals[0].t + 40);
      const tg = shuffle(S);
      const lasers = [[BE, 1], [WG, -1], [EG, 1]];
      const hits = [];
      weals.slice(0, 3).forEach((w, j) => {
        const tel = w.t - 0.7, b0 = brg(sub(lasers[j][0], o)), dir = lasers[j][1];
        for (let k = 0; k < 9; k++) {
          const tt = +(k ? w.t + 2.28 + 0.71 * (k - 1) : w.t + 1.28).toFixed(2), sh = { shape: 'line', at: o, deg: deg360(b0 + dir * STEP * k), len: 60, w: 6 };
          hz(Object.assign({ t: tt, tell: +(k ? Math.max(tel, tt - 1.45) : tel).toFixed(2), dmg: 1.4, name: "Wyvern's Weal", react: 1.4 }, sh));
          hits.push({ t: tt, shape: sh, delay: 1.16 });
        }
        const icon = +(w.t + 1.28 - 10.1).toFixed(2);
        debuff(tg[j], 'Laser target', j === 0 ? 'stand east of him, run to the group as it starts' : 'the laser follows you: run with the group', icon, w.t + 1.28);
        call(icon, j === 0 ? 'Laser on YOU: bait east of him, then run west to the group' : 'Laser on YOU: run across with the group', { slot: tg[j], alert: true, dur: 6 });
        label(w, `Wyvern's Weal (laser ${j + 1} on ${tg[j]}: ${dir > 0 ? 'east to west' : 'west to east'})`);
      });
      const ct = crystalTimes(crystalsOf(TOWERS2), hits);
      crystalHazards(ct, weals[0].t - 1);
      if (res[1]) crystalMarks(TOWERS2, res[1].T, ct);
      const w1 = weals[0].t, w2 = weals[1] ? weals[1].t : w1 + 8.7, w3 = weals[2] ? weals[2].t : w2 + 9.7;
      pref(w1 + 1.28 - 10.1, Object.assign(clusterAt(WG, S.filter(s => s !== tg[0]), 0.8), { [tg[0]]: BE }));
      pref(w1 - 0.65, clusterAt(WG, S, 0.8));
      pref(w2 - 0.65, clusterAt(EG, S, 0.8));
      call(w1 - 1, 'West by the boss (laser east)', { dur: 4 });
      call(w2 - 0.7, 'East => light party stacks', { alert: true, dur: 4 });
      if (wf) {
        const a = pick(G1), b = pick(G2), G2AT = [17, 6.5];
        pref(w2 + 2.3, Object.assign(clusterAt(EG, G1, 0.8), clusterAt(G2AT, G2, 0.8)));
        for (const s of [a, b]) hz({ t: wf.t, tell: +(wf.t - 8).toFixed(2), effect: 'share', shape: 'circle', from: 'target', targets: [s], r: 6, min: 4, max: 4, dmg: 0.5, name: 'White Flash' });
        pref(wf.t + 0.1, clusterAt(EG, S, 0.8));
        label(wf, `White Flash (light party stacks on ${a} and ${b})`);
      }
      pref(w3 - 0.65, clusterAt(WG, S, 0.8));
      call(w3 - 0.7, 'West => spread', { alert: true, dur: 4 });
      if (we) {
        const SP = { MT: 0, R1: 45, H2: 90, M2: 135, OT: 180, M1: 225, H1: 270, R2: 315 };
        const spr = Object.fromEntries(S.map(s => [s, r2(at(SP[s], 12.5))]));
        pref(w3 + 7.35, spr);
        hz({ t: we.t, tell: +(we.t - 8).toFixed(2), effect: 'bait', shape: 'circle', r: 6, from: 'target', targets: S.slice(), snap: 0.3, dmg: 0.9, own: 0.3, name: 'Wild Energy' });
        label(we, 'Wild Energy (spreads)');
        pref(we.t + 0.3, upAt(o, 180));
      }
    }

    // ===== Wrathful Rattle: the lines out from the middle and in from the edges, a Chainblade Blow, then Rush =====
    const dance = [];          // [{name, steps, t0}]: stretches the party walks together
    if (wrath) {
      const tm = +(wrath.t + 2.5).toFixed(2), beta = brg(X), steps = [];
      const lineAt = (axis, off, w) => ({ shape: 'line', at: r2(at(axis + 90, off)), deg: deg360(axis), len: 40, back: 40, w });
      const put = (t, tell, sh) => { hz(Object.assign({ t: +t.toFixed(2), tell: +tell.toFixed(2), dmg: 1.2, name: "Wyvern's Radiance (Wrathful Rattle)", react: 2.2, aimed: true }, sh)); steps.push({ t: +t.toFixed(2), shapes: [sh] }); };
      const outT = [0, 2.58, 5.21, 7.83, 10.46].map(d => tm + d);
      for (const ax of [beta, beta + 90]) {
        put(tm, wrath.t - 1.0, lineAt(ax, 0, 8));
        for (let k = 1; k <= 4; k++) for (const s of [-1, 1]) put(outT[k], outT[k - 1], lineAt(ax, s * (2 + 4 * k), 4));
      }
      const inT = [0, 2.1, 4.72, 7.3, 9.93, 12.56, 15.18, 17.78, 20.4, 23.03].map(d => tm + 13.05 + d), inOff = [18, 14, 10, 6, 2, 2, 6, 10, 14, 18];
      for (const ax of [beta, beta + 90]) inT.forEach((tt, k) => { for (const s of [-1, 1]) put(tt, k ? inT[Math.max(0, k - 2)] : tt - 2, lineAt(ax, s * inOff[k], 4)); });
      call(wrath.t - 1, 'Out of the cross => into the middle as they go out; then step over them as they come in', { alert: true, dur: 7 });
      label(wrath, 'Wrathful Rattle (the exalines)');
      const cb = wrathCb ? chainblade(...cbPair(wrathCb), { spots: false }) : null;
      if (cb) steps.push(...cb.steps);
      dance.push({ name: 'Wrathful Rattle', steps, t0: wrath.t - 3 });
    }
    rushSets.forEach((rs, k) => {
      const r = rushSteps(k);
      // The second Rush follows the Wrathful Rattle's lines: one way through both.
      if (k === 1 && dance.length) { dance[0].steps.push(...r.steps); dance[0].name += ' + Rush'; }
      else dance.push({ name: `Rush ${k + 1}`, steps: r.steps, t0: r.cs - 2 });
    });
    for (const d of dance) {
      const steps = mergeSteps(d.steps);
      const start = len(pathAt(d.t0)) > 3 ? rel(pathAt(d.t0), faceAt(d.t0), 12, 0) : [0, -8];
      const path = solve(d.name, steps, { start, reach0: 5.6 * (steps[0].t - d.t0) });
      follow(path, steps, d.t0, S, 0.8);
      const end = steps[steps.length - 1].t;
      pref(end + 0.3, upAt(pathAt(end + 0.3), faceAt(end + 0.3)));
    }

    // ===== The second exaflares: Wyvern's Vengeance from one side =====
    if (res[2]) {
      const T = res[2].T, roar = roars.find(r => r.t > T && r.t < T + 15), T0 = +((roar ? roar.t : T + 7) + 5.0).toFixed(2);
      const side = pick([0, 90, 180, 270]), flip = coin() ? 1 : -1;
      const PAIRS = [[-12, 12], [-4, 20], [-20, 4]], exa = [];
      // Canonical: from the east edge (x 20) going west, lines at these norths; turned to the side they come from.
      PAIRS.forEach((pr, k) => pr.forEach(y => {
        for (let j = 0; j < 6; j++) {
          const tt = +(T0 + [0, 3.03, 6.01][k] + 1.078 * j).toFixed(2), sh = { shape: 'circle', at: r2(rot([20 - 8 * j, y * flip], side - 90)), r: 6 };
          hz(Object.assign({ t: tt, tell: +Math.max(T0 - 8, tt - 2.2).toFixed(2), dmg: 1.0, name: "Wyvern's Vengeance", react: 2.0, aimed: true }, sh));
          exa.push({ t: tt, shape: sh, delay: 1.6 });
        }
      }));
      const ct = crystalTimes(crystalsOf(TOWERS1), exa);
      crystalHazards(ct, T0 - 3, true);
      crystalMarks(TOWERS1, T, ct);
      const evC = EA('Chainblade Charge', T0, T0 + 25).find(e => loneStack.has(e)), lone = evC && loneStack.get(evC);
      const steps = mergeSteps([...exa.map(e => ({ t: e.t, shapes: [e.shape] })), ...ct.filter(c => c.t !== null).map(c => ({ t: c.t, shapes: [{ shape: 'circle', at: c.at, r: c.big ? 12 : 6 }] }))]);
      const stackAt = evC ? rel(lone.o, lone.f, 9.4, 0) : [0, 9.4];
      const path = solve('Vengeance 2', steps, { end: { p: stackAt, tol: 8 } });
      follow(path, steps, T + 0.3, S, 0.8);
      const end = steps[steps.length - 1].t;
      if (evC) {
        pref(end + 0.05, clusterAt(stackAt, S, 0.9));
        pref(evC.t + 0.1, clusterAt(rel(lone.o, lone.f, 14.2, 0), S, 0.9));
        call(evC.t + 0.2, 'Out of the big puddle', { alert: true, dur: 4 });
        pref(lone.tP + 0.3, upAt(lone.o, lone.f));
      } else pref(end + 0.3, upAt([0, 0], 0));
      call(T0 - 6, `Exaflares from the ${dirName(side)}: crystals explode when hit`, { alert: true, dur: 6 });
      label(roar, `Roar (raidwide; exaflares from the ${dirName(side)} next)`);
    }

    P.prefs.sort((a, b) => a.t - b.t);
    P.looks.sort((a, b) => a.t - b.t);
    return P;
  }

  B.FIGHT_SCRIPTS = B.FIGHT_SCRIPTS || {};
  B.FIGHT_SCRIPTS.ex6 = {
    // FFLogs' max HP in a kill (report wvPqDfzVjLKCZrX3): Guardian Arkveld 99,490,188.
    hp: 99490188,
    adds: [],
    pushes: [],
    defaultStrat: 'hector',
    strats: {
      hector: { label: 'Hector' },
    },
    source: 'wtfdig.info/73/ex6; mechanics after BossMod (github.com/awgil/ffxiv_bossmod, Ex6GuardianArkveld) and FFLogs kills',
    // A north, B east, C south, D west; 1 north-west, 2 north-east, 3 south-east, 4 south-west (Hector's towers).
    waymarks: [
      { label: 'A', at: [0, 13], color: 'red' }, { label: 'B', at: [13, 0], color: 'yellow' },
      { label: 'C', at: [0, -13], color: 'blue' }, { label: 'D', at: [-13, 0], color: 'purple' },
      { label: '1', at: [-9.2, 9.2], color: 'red', square: true }, { label: '2', at: [9.2, 9.2], color: 'yellow', square: true },
      { label: '3', at: [9.2, -9.2], color: 'blue', square: true }, { label: '4', at: [-9.2, -9.2], color: 'purple', square: true },
    ],
    plan,
  };
})(window.BLM);
