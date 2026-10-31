// EX4, Recollection (Extreme): Zelenia's mechanics for the sim's party, on cactbot's timeline (07-dt/trial/zelenia-ex),
// and the four strats wtfdig.info lists for the fight (72/ex4): Raidplan (-Wj9 & k9Vc), Hector, Mrhappy and Yukizuri,
// each with its own defaults for wtfdig's toggles (Escelons' Fall 1/3, Bloom 3, Escelons' Fall 2, Bloom 4, Bloom 6).
// Spots are [east, north] yalms from the arena's middle.
//
// The mechanics follow BossMod's module (github.com/awgil/ffxiv_bossmod, Ex4Zelenia), whose shapes and sizes come from
// the game's Action sheet, and where things stand follows FFLogs kills (the helpers' positions as they cast). The arena
// is a circle of 16 (BossMod's) split into sixteen tiles: an inner ring (0-8 out) and an outer ring (8-16), eight
// 45-degree slices each, the first north-north-east. Built with the sim's toolkit (js/mech.js):
//   Phase 1:
//   - Thorned Catharsis: raidwide.
//   - Shock: one role gets donuts (1-6), the other 4-yalm circles; each drops where its player stands and goes off
//     twelve times. The donuts soak Alexandrian Holy's four towers (3 yalms, at +-8 east, +-5 north), each the tower
//     nearest its clock spot's marker colour; the circles drop two near the boss (north and south) and two far (west
//     and east), then walk out of them.
//   - Specter of the Lost: a 60-degree tank buster cone along each tank's tether.
//   - Escelons' Fall: four sets of 45-degree cones at the four nearest or farthest (the boss's order: a, b, then the
//     opposites), each set on the other role (Slashing Resistance Down): clock spots, in or out.
//   - Stock Break: a four-hit party stack.
//   - Blessed Barricade (adds): supports west, DPS east; the Roseblood Drops soak the party's damage; three rounds of
//     two three-player towers, and each round a Shade at the west and east edge tethers a support and a DPS and cleaves
//     the half of the room on its sword's side (the tethered player turns it out); the fourth only while the Drops
//     live. Perfumed Quietus ends it.
//   Phase 2 (each Roseblood Bloom lights rose tiles and the rose in the middle bleeds whoever stands in it):
//   - Bloom 1: Alexandrian Thunder II's three cones turn 10 degrees a second, fifteen times, and any rose tile they touch
//     electrifies its whole group; then Alexandrian Thunder III's spreads on everyone, off the roses.
//   - Bloom 2 and 5: Thunder Slash's six 60-degree cones one a second, Alexandrian Thunder IV's in-out (or out-in);
//     Bloom 5 adds Valorous Ascension's raidwides and the Briar Thorns' lanes across half the room, then the other half
//     at right angles.
//   - Bloom 3: four towers on alternate outer tiles; one role's roses (Emblazon) go on inner tiles that join no two
//     towers, then off the roses; the other role soaks (a tower is its whole connected rose group).
//   - Escelons' Fall 2: three of one role get donuts, the fourth and one of the other role stacks; then the cones.
//   - Bloom 4: one role's roses in the empty quarter, the other's spreads across from them beside two Thunder III
//     puddles; Encircling Thorns tethers each support to a DPS (break at 20), Banish III's stack on a healer shared over
//     the roses the two sides stand on.
//   - Escelons' Fall 3: the cones between two Power Breaks (half the room east or west).
//   - Bloom 6: four towers (two inner, two outer), one role's roses link them; Holy Hazard's two pairs of cones.
//   - Soft enrage: Stock Break three times, Roseblood Withering, Rose Red.
// Simplified: the boss can't be made untargetable from a script, so in the adds phase the party's damage goes to the
// Drops (all of it) and, once they're down, to her. Bloom 1, 2 and 5's rose patterns are this script's own (cactbot
// calls them fixed but doesn't give them), and so is which way Thunder Slash runs (two mirror orders); the party's way
// through them is solved each pull. Holy Hazard's cones are 90 degrees here (BossMod's 120 leave no way to soak the
// towers wtfdig's spots soak), along the tower axes; with the LB3 strat they're a raidwide. Spreads and puddles don't
// travel through rose tiles (only the cones do); a tower is soaked on one tile of its group. Where wtfdig gives no
// spot (Bloom 4's spreads, where the roses go after Emblazon), the spots are this script's own.
(function (B) {
  const S = B.SLOTS;
  const at = B.bearing;
  const inside = B.mechInside;
  const add = (a, b) => [a[0] + b[0], a[1] + b[1]];
  const sub = (a, b) => [a[0] - b[0], a[1] - b[1]];
  const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);
  const deg360 = (d) => ((d % 360) + 360) % 360;
  const angDiff = (a, b) => Math.abs(deg360(a - b + 180) - 180);
  const pick = (a) => a[Math.floor(Math.random() * a.length)];
  const shuffle = (a) => { const b = a.slice(); for (let i = b.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [b[i], b[j]] = [b[j], b[i]]; } return b; };
  const r2 = (p) => [+p[0].toFixed(2), +p[1].toFixed(2)];
  const brg = (p) => deg360(Math.atan2(p[0], p[1]) * 180 / Math.PI);
  const len = (p) => Math.hypot(p[0], p[1]);
  const SUP = ['MT', 'OT', 'H1', 'H2'], DPS = ['M1', 'M2', 'R1', 'R2'];
  const isSup = (s) => SUP.includes(s);
  const COMPASS = ['north', 'north-northeast', 'northeast', 'east-northeast', 'east', 'east-southeast', 'southeast', 'south-southeast',
    'south', 'south-southwest', 'southwest', 'west-southwest', 'west', 'west-northwest', 'northwest', 'north-northwest'];
  const dirName = (deg) => COMPASS[Math.round(deg360(deg) / 22.5) % 16];
  const DIR8 = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
  const dir8 = (deg) => DIR8[Math.round(deg360(deg) / 45) % 8];

  // ---------- the tiles ----------
  // Tile i: inner (i < 8) or outer (i - 8), its slice 45 degrees from north-north-east's (0) clockwise (BossMod's Tiles).
  const SLICE = ['NNE', 'ENE', 'ESE', 'SSE', 'SSW', 'WSW', 'WNW', 'NNW'];
  const TB = (i) => 22.5 + 45 * (i % 8);
  const tileName = (i) => `${i < 8 ? 'inner' : 'outer'} ${SLICE[i % 8]}`;
  const tileShape = (i) => (i < 8 ? { shape: 'cone', at: [0, 0], deg: TB(i), half: 22.5, r: 8 } : { shape: 'cone', at: [0, 0], deg: TB(i), half: 22.5, r: 16, r0: 8 });
  const tileOf = (p) => { const k = Math.floor(brg(p) / 45) % 8; return len(p) <= 8 ? k : k + 8; };
  const tileMid = (i, rr) => r2(at(TB(i), rr ?? (i < 8 ? 5 : 12)));
  const inTile = (i, p, m) => inside(tileShape(i), p, m);
  const EDGES = (i) => { const k = i % 8, o = i >= 8 ? 8 : 0; return [o + (k + 7) % 8, o + (k + 1) % 8, i >= 8 ? k : k + 8]; };
  // The connected groups of a set of lit tiles.
  function groupsOf(active) {
    const seen = new Set(), out = [];
    for (const t of active) {
      if (seen.has(t)) continue;
      const g = new Set([t]), q = [t];
      seen.add(t);
      while (q.length) { const v = q.pop(); for (const w of EDGES(v)) if (active.has(w) && !seen.has(w)) { seen.add(w); g.add(w); q.push(w); } }
      out.push(g);
    }
    return out;
  }
  // The rose tiles a set of cones from the middle electrifies: every group one of them touches.
  const touches = (deg, half, i) => angDiff(deg, TB(i)) < half + 22.5 - 0.01;
  function electrified(active, cones) {
    const hot = new Set();
    for (const g of groupsOf(active)) if ([...g].some(i => cones.some(c => touches(c.deg, c.half, i)))) g.forEach(i => hot.add(i));
    return hot;
  }
  // The tiles a circle on the floor touches.
  function tilesUnder(c, r) {
    const out = new Set();
    for (let a = 0; a < 360; a += 10) for (const k of [0, 0.5, 1]) { const p = add(c, at(a, r * k)); if (len(p) < 16) out.add(tileOf(p)); }
    return out;
  }

  // ---------- placing ----------
  const onA = (p, m) => len(p) < 16 - (m ?? 0.9);
  // The nearest point to `want` that's ok (searched outward), or want.
  function findSpot(want, ok) {
    if (ok(want)) return r2(want);
    for (let r = 0.2; r <= 32; r += 0.2) {
      const n = Math.max(12, Math.round(2 * Math.PI * r / 0.25));
      for (let k = 0; k < n; k++) { const p = add(want, at(k * 360 / n, r)); if (ok(p)) return r2(p); }
    }
    return r2(want);
  }
  // Eight players close round a point (the rest within half a yalm).
  const CL = [[0, 0], ...Array.from({ length: 7 }, (_, i) => at(i * 360 / 7, 0.5))];
  const clusterAt = (c, slots, rad) => Object.fromEntries(slots.map((s, i) => [s, r2(add(c, rad ? (i ? at((i - 1) * 360 / Math.max(1, slots.length - 1), rad) : [0, 0]) : CL[i % 8]))]));
  const assign = (slots, pts) => Object.fromEntries(slots.map((s, i) => [s, pts[i]]));

  // A way through attacks landing one after another: for each step {t, shapes}, a point (from a polar grid) clear of
  // that step's shapes by m, each reachable from the last at 5.6 yalms a second; the least walking (dynamic programming).
  const CAND = (() => {
    const out = [[0, 0]];
    for (let r = 1; r <= 14.6; r += 0.8) { const n = Math.max(8, Math.round(2 * Math.PI * r)); for (let k = 0; k < n; k++) out.push(r2(at(k * 360 / n + (r * 37) % 9, r))); }
    return out;
  })();
  let NEAR = null;
  const nearList = () => NEAR || (NEAR = CAND.map(p => CAND.map((q, j) => [j, dist(p, q)]).filter(x => x[1] <= 12).sort((a, b) => a[1] - b[1])));
  function solvePath(steps, o) {
    o = o || {};
    const N = CAND.length, m = o.m ?? 1.6, BAD = 1000, NB = nearList();
    const bad = steps.map(st => CAND.map(p => (len(p) > 14.7 || st.shapes.some(h => inside(h, p, m)) ? 1 : 0)));
    let cost = new Float64Array(N);
    for (let c = 0; c < N; c++) {
      let base = 0;
      if (o.start) { const d = dist(o.start, CAND[c]); base = d + (d > (o.reach0 ?? 99) ? BAD : 0); }
      cost[c] = base + bad[0][c] * BAD + (o.pen ? o.pen(CAND[c], 0) : 0);
    }
    const backs = [];
    for (let k = 1; k < steps.length; k++) {
      const reach = 5.6 * (steps[k].t - steps[k - 1].t) - 0.2, nc = new Float64Array(N), bk = new Int32Array(N);
      for (let c = 0; c < N; c++) {
        let best = Infinity, bj = c;
        if (reach >= 12) { for (let j = 0; j < N; j++) { const v = cost[j] + dist(CAND[j], CAND[c]); if (v < best) { best = v; bj = j; } } }
        else for (const [j, d] of NB[c]) { if (d > reach) break; const v = cost[j] + d; if (v < best) { best = v; bj = j; } }
        nc[c] = best + bad[k][c] * BAD + (o.pen ? o.pen(CAND[c], k) : 0);
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

  // ---------- the strats ----------
  // Clock spots: tanks north and south, healers west and east, melee south-west and south-east, ranged north-west and
  // north-east (Yukizuri's: the off tank east and H2 south).
  const CLOCK = { MT: 0, OT: 180, H1: 270, H2: 90, M1: 225, M2: 135, R1: 315, R2: 45 };
  const CLOCK_Y = Object.assign({}, CLOCK, { OT: 90, H2: 180 });
  // Bloom 3, relative: the slices (clockwise from the new north, the inner tile between the two inner roses) each
  // drops a rose on or soaks; Colors (true north): the direction each goes nearest.
  const B3_ROSE = { MT: 0, OT: 4, H1: 5, H2: 3, M1: 5, M2: 4, R1: 0, R2: 3 };
  const B3_TOWER = { MT: 0, OT: 4, H1: 6, H2: 2, M1: 6, M2: 4, R1: 0, R2: 2 };
  const B3_ROSE_DIR = { MT: 0, OT: 180, H1: 270, H2: 90, M1: 225, M2: 135, R1: 315, R2: 45 };
  const B3_TOWER_DIR = { MT: 0, OT: 180, H1: 270, H2: 90, M1: 270, M2: 180, R1: 0, R2: 90 };
  // Bloom 6, LB3: the inner N/S tile each drops its rose on (Raidplan's, and Hector's).
  const B6_LB3 = { MT: 4, OT: 3, H1: 7, H2: 0, M1: 4, M2: 3, R1: 7, R2: 0 };
  const B6_LB3_HECTOR = { MT: 7, OT: 3, H1: 4, H2: 0, M1: 4, M2: 3, R1: 7, R2: 0 };
  const STRATS = {
    raidplan: { ef1: 'supports', bloom3: 'relative', ef2: 'ns', bloom4: 'relative', bloom6: 'lb3', clock: CLOCK, b4East: true, lb3: B6_LB3, b3rose: B3_ROSE, b3tower: B3_TOWER },
    hector: { ef1: 'dpsin', bloom3: 'relative', ef2: 'we', bloom4: 'tn', bloom6: 'we', clock: CLOCK, b4East: false, lb3: B6_LB3_HECTOR, b3rose: B3_ROSE, b3tower: B3_TOWER },
    happy: { ef1: 'supports', bloom3: 'color', ef2: 'we', bloom4: 'relative', bloom6: 'ns', clock: CLOCK, b4East: true, lb3: B6_LB3, b3rose: B3_ROSE, b3tower: B3_TOWER },
    yukizuri: { ef1: 'supports', bloom3: 'color', ef2: 'ns', bloom4: 'relative', bloom6: 'ns', clock: CLOCK_Y, b4East: true, lb3: B6_LB3,
      b3rose: Object.assign({}, B3_ROSE, { OT: 3, H2: 4 }), b3tower: Object.assign({}, B3_TOWER, { OT: 2, H2: 4 }),
      b3roseDir: Object.assign({}, B3_ROSE_DIR, { OT: 90, H2: 180 }), b3towerDir: Object.assign({}, B3_TOWER_DIR, { OT: 90, H2: 180 }) },
  };
  // Escelons' Fall 2's fans (N/S and W/E): each role's half, 30 degrees apart (N/S, "near/far left facing the boss")
  // or 45 (W/E, Raidplan's WNW/WSW/NNW/SSW).
  const FAN_NS = { MT: 15, OT: 345, H1: 45, H2: 315, M1: 195, M2: 165, R1: 225, R2: 135 };
  const FAN_WE = { MT: 292.5, OT: 247.5, H1: 337.5, H2: 202.5, M1: 67.5, M2: 112.5, R1: 22.5, R2: 157.5 };
  const IN_R = 3.0, OUT_R = 8.5;

  // The party's places: tanks at her front (north), melee at her back (her hitbox is 5.5).
  const UP = { MT: [-0.8, 6.6], OT: [0.8, 6.6], M1: [-2.2, -6.4], M2: [2.2, -6.4], H1: [-5.5, -8.5], H2: [5.5, -8.5], R1: [-8.5, -5.6], R2: [8.5, -5.6] };
  const STACK = clusterAt([0, -7], S, 0.8);

  // ---------- the pull ----------
  function plan(events, strat) {
    const st = STRATS[strat] || STRATS.raidplan;
    const P = { start: Object.assign({}, UP), prefs: [], hazards: [], checks: [], calls: [], marks: [], labels: new Map(), debuffs: [],
      boss: [{ t: 0, at: [0, 0] }], hitbox: [{ t: 0, r: 5.5 }], arena: { shape: 'circle', at: [0, 0], r: 16 }, looks: [{ t: 0, show: ['a1_stc01'] }] };
    let id = 0;
    P.notes = [];
    const solve = (name, steps, o) => { const p = solvePath(steps, o); if (p.bad.length) P.notes.push(`${name}: no clean way at steps ${p.bad.map(k => steps[k].t).join(', ')}`); return p; };
    const hz = (o) => { const h = Object.assign({ id: ++id, react: 3 }, o); P.hazards.push(h); return h; };
    const pref = (t, spots) => P.prefs.push({ t, spots });
    const call = (t, text, o) => P.calls.push(Object.assign({ t, text, dur: 5 }, o));
    const check = (o) => P.checks.push(o);
    const debuff = (slot, key, name, hint, t0, t1) => P.debuffs.push({ slot, key, name, hint, t0, t1 });
    const mark = (shape, t0, t1, fill) => P.marks.push(Object.assign({ kind: 'lit', t0: +t0.toFixed(2), t1: +t1.toFixed(2), fill }, shape));
    const label = (ev, text) => { if (ev) P.labels.set(ev, text); };
    const E = (name, t0, t1) => events.find(e => e.name === name && e.t >= t0 && e.t <= t1) || null;
    const EA = (name, t0, t1) => events.filter(e => e.name === name && e.t >= t0 && e.t <= t1);
    const castOf = (ev, d) => ev.t - (ev.cast || d || 5);
    const clock = (s) => st.clock[s];
    const roseFill = 'rgba(210,30,60,0.30)';
    const litTiles = (tiles, t0, t1, fill) => { for (const i of tiles) mark(tileShape(i), t0, t1, fill || roseFill); };
    // The rose in the middle of a bloom (BossMod's Voidzone): bleeding for whoever stands in it.
    const midRose = (t0, t1) => {
      hz({ t: t0, tell: t0 - 0.5, shape: 'circle', at: [0, 0], r: 2, dmg: 0.1, lasts: t1 - t0, tick: 1, tickDmg: 0.08, status: ['roseBleed', 5], quiet: true, name: 'Roseblood (the rose in the middle)' });
    };
    // The floor: the white stone, or the bloom's dark battlefield (the gimmick floor) from each Queen's Crusade.
    const floors = [];
    const dark = (t0, t1) => floors.push([t0, t1]);
    // Spots for a group of spreads: one per slot near its bearing, ok, at least gap apart.
    const spreadSpots = (slots, brgOf, ok, gap) => {
      const out = {}, cand = [];
      for (const r of [6.5, 9.5, 12.5, 14]) for (let a = 0; a < 360; a += 5) cand.push(at(a, r));
      for (const s of slots) {
        let best = null, bd = Infinity;
        for (const c of cand) {
          if (!ok(c) || Object.values(out).some(q => dist(q, c) < gap)) continue;
          const d = angDiff(brg(c), brgOf(s)) + Math.abs(len(c) - 11) * 2;
          if (d < bd) { bd = d; best = c; }
        }
        out[s] = r2(best || at(brgOf(s), 11));
      }
      return out;
    };

    const raid = (ev, dmg, text, d) => {
      if (!ev) return;
      const cs = castOf(ev, d);
      hz({ t: ev.t, tell: cs, raidwide: true, dmg, name: ev.name.replace(/ \(.*\)$/, '') });
      call(cs, text || 'Raidwide', { dur: 3 });
    };

    // ===== Thorned Catharsis =====
    for (const ev of EA('Thorned Catharsis', 0, 9999)) { raid(ev, 0.45, 'AoE'); label(ev, 'Thorned Catharsis (raidwide)'); }

    // ===== Specter of the Lost: a tank buster cone along each tank's tether =====
    for (const ev of EA('Specter of the Lost', 0, 9999)) {
      const cs = ev.t - 7.0;
      hz({ t: ev.t, tell: cs, effect: 'bait', shape: 'cone', from: 'boss', aim: 'target', targets: ['MT', 'OT'], tether: 'boss', half: 30, r: 48, snap: 0.6, dmg: 1.5, own: 0.55, buster: true, name: 'Specter of the Lost' });
      pref(cs + 0.3, Object.assign({}, UP, { MT: r2(at(35, 6.8)), OT: r2(at(325, 6.8)) }));
      for (const s of ['MT', 'OT']) call(cs, 'Tank tether on YOU: point the cone away', { slot: s, alert: true });
      call(cs, 'Avoid the tank tethers', { dur: 4 });
      pref(ev.t + 0.3, UP);
      label(ev, 'Specter of the Lost (tank busters on the tethers)');
    }

    // ===== Stock Break: a four-hit party stack =====
    for (const ev of EA('Stock Break x4', 0, 9999)) {
      const cs = castOf(ev, 7), on = pick(S), hits = [1.15, 2.2, 3.3, 4.4].map(k => +(ev.t + k).toFixed(2));
      pref(cs + 0.3, STACK);
      hits.forEach((tt, k) => hz({ t: tt, tell: k ? hits[k - 1] : cs, effect: 'share', shape: 'circle', from: 'target', targets: [on], r: 6, min: 8, max: 8, dmg: 0.1, name: 'Stock Break' }));
      call(cs, `Stack x4 on ${on}`, { alert: true, dur: 6 });
      pref(hits[3] + 0.3, UP);
      label(ev, `Stock Break (four-hit stack on ${on})`);
    }

    // ===== Escelons' Fall: four sets of cones at the nearest or farthest four =====
    // first: the role that baits the first set ('sup' or 'dps'), or null (DPS in: whoever the first set's kind finds);
    // spotOf(slot, near): where each stands when its role's set is near (in) or far (out).
    function escelons(ev, o) {
      const baits = [1, 2, 3, 4].map(k => E(`Escelons' Fall ${k}`, ev.t, ev.t + 15)).map((e, k) => (e ? e.t : ev.t + 0.9 + 3.05 * k));
      const a = pick(['near', 'far']), b = pick(['near', 'far']), flip = (x) => (x === 'near' ? 'far' : 'near');
      const seq = [a, b, flip(a), flip(b)];
      const X = o.first || (a === 'near' ? 'dps' : 'sup');
      const roleAt = (k) => ((k % 2 === 0) === (X === 'sup') ? 'sup' : 'dps');
      const posAt = (k) => {
        const baiter = roleAt(k), near = seq[k] === 'near';
        return Object.fromEntries(S.map(s => { const mine = (isSup(s) ? 'sup' : 'dps') === baiter; return [s, o.spotOf(s, mine ? near : !near)]; }));
      };
      const goT = o.goT ?? ev.t - 11;
      baits.forEach((tt, k) => {
        hz({ t: tt, tell: k ? baits[k - 1] : ev.t - 12, effect: 'bait', shape: 'cone', from: 'boss', aim: 'target', targets: seq[k] === 'near' ? { nearest: 4 } : { farthest: 4 },
          half: 22.5, r: 24, snap: 0.25, dmg: 1.0, own: 0.35, status: ['slashingResDown', 5], name: "Escelons' Fall" });
        const spots = posAt(k);
        pref(k ? baits[k - 1] + 0.05 : goT, spots);
        check({ t: tt - 0.1, kind: 'spot', spots, r: 2.2, fail: 0.9, name: `Escelons' Fall (${seq[k]}: ${roleAt(k) === 'sup' ? 'supports' : 'DPS'} bait)` });
        label(E(`Escelons' Fall ${k + 1}`, ev.t, ev.t + 15), `Escelons' Fall ${k + 1} (${seq[k]}: ${roleAt(k) === 'sup' ? 'supports' : 'DPS'} bait)`);
      });
      const swap = a === b ? 'swap after first+third' : 'swap after second';
      for (const s of S) {
        const near = posAt(0)[s] && len(posAt(0)[s]) < 5;
        call(o.callT ?? ev.t - 11.5, `${near ? 'Start in' : 'Start out'}, ${swap}`, { slot: s, alert: true, dur: 7 });
      }
      label(ev, `Escelons' Fall (${seq.join(' > ')})`);
      return { baits, seq, posAt };
    }
    const clockSpot = (s, near) => r2(at(clock(s), near ? IN_R : OUT_R));

    // ===== Phase 1 =====
    // --- Shock: donuts and circles, Alexandrian Holy's towers ---
    const sh1 = events.find(e => e.name === 'Shock' && e.t < 60);
    if (sh1) {
      const tIcon = sh1.t + 0.8, t1 = sh1.t + 8.8, holy = E('Alexandrian Holy', sh1.t, sh1.t + 10), ex = E('Explosion', sh1.t, sh1.t + 15);
      const tT = ex ? ex.t : t1 + 1.3;
      const donutSup = Math.random() < 0.5, donuts = donutSup ? SUP : DPS, circles = donutSup ? DPS : SUP;
      const TW = { NE: [8, 5], SE: [8, -5], SW: [-8, -5], NW: [-8, 5] };
      // The tower by each spot's marker colour: a cardinal's the intercard counterclockwise of it, an intercard's its own.
      const towerOf = (s) => dir8(clock(s) % 90 === 0 ? clock(s) - 45 : clock(s));
      const donutAt = (s) => r2(add(TW[towerOf(s)], at(brg(TW[towerOf(s)]) + 180, 1.4)));   // the tower's inner side
      const CIRC = { N: [0, 6.6], S: [0, -6.6], W: [-14.2, 0], E: [14.2, 0] };
      const circleOf = (s) => (isSup(s) ? { 0: 'N', 180: 'S', 270: 'W', 90: 'E' }[clock(s)] : { M1: 'S', M2: 'N', R1: 'W', R2: 'E' }[s]);
      const dSpots = Object.fromEntries(donuts.map(s => [s, donutAt(s)])), cSpots = Object.fromEntries(circles.map(s => [s, CIRC[circleOf(s)]]));
      // Out of the circles after they drop (and never in a donut's ring).
      const clear = (p) => onA(p, 1.0) && Object.values(cSpots).every(c => dist(c, p) > 5.4) && Object.values(dSpots).every(d => dist(d, p) > 6.6);
      const ringFree = (a, b) => { for (let k = 0; k <= 24; k++) { const q = add(a, sub(b, a).map(v => v * k / 24)); if (Object.values(dSpots).some(d => dist(d, q) > 0.6 && dist(d, q) < 6.5)) return false; } return true; };
      const want = { N: [0, 12.5], S: [0, -12.5], W: [-13.6, 5.4], E: [13.6, -5.4] };
      const post = Object.fromEntries(circles.map(s => [s, findSpot(want[circleOf(s)], (p) => clear(p) && ringFree(cSpots[s], p))]));
      pref(tIcon + 0.2, Object.assign({}, dSpots, cSpots));
      hz({ t: t1, tell: tIcon, effect: 'bait', shape: 'donut', r0: 1, r1: 6, from: 'target', targets: donuts, snap: 0.4, dmg: 0.9, own: 0, name: 'Shock (donut)' });
      hz({ t: t1, tell: tIcon, effect: 'bait', shape: 'circle', r: 4, from: 'target', targets: circles, snap: 0.4, dmg: 0.9, own: 0.25, status: ['lightningResDown', 2], name: 'Shock' });
      // Eleven more each where they dropped: the donuts' holders stay in the holes, the circles' walk out.
      for (let k = 1; k <= 11; k++) {
        const tt = +(t1 + 0.5 * k).toFixed(2);
        hz({ t: tt, tell: +(tt - 0.5).toFixed(2), effect: 'bait', shape: 'donut', r0: 1, r1: 6, from: 'target', targets: donuts, snap: tt - (t1 - 0.4), dmg: 0.6, own: 0, quiet: true, name: 'Shock (donut)' });
        if (k >= 2) hz({ t: tt, tell: k === 2 ? t1 - 0.2 : +(tt - 0.5).toFixed(2), shape: 'circle', r: 4, from: 'target', targets: circles, snap: tt - (t1 - 0.4), dmg: 0.3, quiet: true, react: 3, name: 'Shock (lingering)' });
      }
      pref(t1 - 0.3, post);
      for (const [k, p] of Object.entries(TW)) hz({ t: tT, tell: tT - 7, effect: 'tower', shape: 'circle', at: p, r: 3, soak: 1, only: donuts.filter(s => towerOf(s) === k), dmg: 0.3, fail: 0.9, status: ['lightningResDown', 2], name: 'Explosion (tower)' });
      for (const s of donuts) call(tIcon, `Donut on you, get tower (${towerOf(s)})`, { slot: s, alert: true, dur: 7 });
      for (const s of circles) { call(tIcon, `Spread (${({ N: 'north, close', S: 'south, close', W: 'west, far', E: 'east, far' })[circleOf(s)]})`, { slot: s, alert: true, dur: 7 }); call(tIcon + 7, 'Move away', { slot: s, alert: true, dur: 3 }); }
      pref(t1 + 5.8, UP);
      label(sh1, `Shock (donuts on ${donutSup ? 'supports' : 'DPS'}, circles on ${donutSup ? 'DPS' : 'supports'})`);
      label(holy, 'Alexandrian Holy (four towers)');
      label(ex, 'Explosion (the donuts soak the towers)');
    }

    // --- Escelons' Fall 1 ---
    const ef1 = events.find(e => e.name === "Escelons' Fall" && e.t < 100);
    if (ef1) escelons(ef1, { first: st.ef1 === 'supports' ? 'sup' : st.ef1 === 'dps' ? 'dps' : null, spotOf: clockSpot });

    // ===== Adds: Blessed Barricade =====
    const bar = E('Blessed Barricade', 0, 200);
    if (bar) {
      const pushes = EA('Spearpoint Push', bar.t, bar.t + 60), towers = EA('Explosion', bar.t, bar.t + 50);
      const W0 = [-7.5, 0], E0 = [7.5, 0], home = Object.assign(clusterAt(W0, SUP, 1.1), clusterAt(E0, DPS, 1.1));
      pref(bar.t - 2.5, home);
      call(bar.t - 3, 'Supports west, DPS east', { alert: true, dur: 5 });
      const supT = shuffle(SUP), dpsT = shuffle(DPS);
      const SH = { W: [-13, 0], E: [13, 0] };
      mark({ shape: 'circle', at: SH.W, r: 1.3 }, bar.t + 4, (pushes[pushes.length - 1] || bar).t + 1, 'rgba(170,90,255,0.6)');
      mark({ shape: 'circle', at: SH.E, r: 1.3 }, bar.t + 4, (pushes[pushes.length - 1] || bar).t + 1, 'rgba(170,90,255,0.6)');
      pushes.forEach((pe, k) => {
        const tP = +(pe.t + 0.7).toFixed(2), tw = towers[k], tGo = pe.t - 7;
        const spots = Object.assign({}, home);
        const sides = { W: pick(['left', 'right']), E: pick(['left', 'right']) };
        for (const side of ['W', 'E']) {
          const who = side === 'W' ? supT[k % 4] : dpsT[k % 4], sh = SH[side];
          // The tethered player stands where the sword's side faces out: west, left hand north; east, right hand north.
          const north = side === 'W' ? sides.W === 'left' : sides.E === 'right';
          const T = [side === 'W' ? -11.6 : 11.6, north ? 6.6 : -6.6];
          const f = brg(sub(T, sh)), side90 = deg360(sides[side] === 'left' ? f - 90 : f + 90);
          spots[who] = T;
          hz({ t: tP, tell: pe.t - 7.5, effect: 'bait', shape: 'line', from: sh, targets: [who], deg: side90, len: 33, w: 74, back: 1, tether: sh, dmg: 1.4, own: 0.35,
            name: 'Spearpoint Push', ifAlive: k >= 3 ? 0 : undefined });
          call(pe.t - 7.5, `Tether on YOU: point the sword out (stand ${north ? 'north' : 'south'} of the shade)`, { slot: who, alert: true, dur: 6 });
          if (tw) {
            const tp = side === 'W' ? [-6.93, k === 1 ? 4 : -4] : [6.93, k === 1 ? -4 : 4];
            const soak = (side === 'W' ? SUP : DPS).filter(s => s !== who);
            hz({ t: tw.t, tell: tw.t - 6, effect: 'tower', shape: 'circle', at: tp, r: 3, soak: [3, 4], only: soak, dmg: 0.25, fail: 0.9, name: 'Explosion (tower)' });
            Object.assign(spots, clusterAt(tp, soak, 0.9));
            for (const s of soak) call(tw.t - 6, `Tower ${tp[1] > 0 ? 'north' : 'south'}${side === 'W' ? 'west' : 'east'}`, { slot: s, dur: 5 });
          }
        }
        pref(tGo, spots);
        pref(Math.max(tP, tw ? tw.t : 0) + 0.2, home);
        label(pe, `Spearpoint Push (${supT[k % 4]} west, ${dpsT[k % 4]} east${k >= 3 ? '; only while the Drops live' : ''})`);
        if (tw) label(tw, 'Explosion (three-player towers)');
      });
      label(bar, 'Blessed Barricade (adds: supports west, DPS east)');
    }
    const pq = events.find(e => /^Perfumed Quietus/.test(e.name));
    if (pq) {
      hz({ t: pq.t, tell: pq.t - 9.2, raidwide: true, dmg: 0.55, name: 'Perfumed Quietus' });
      call(pq.t - 5.3, 'Big AoE', { alert: true, dur: 4 });
      pref(pq.t - 9, UP);
      label(pq, 'Perfumed Quietus (raidwide: the Drops\' aether)');
    }

    // ===== Phase 2 =====
    // --- Bloom 1 (and its repeat): Alexandrian Thunder II's turning cones, Thunder III's spreads ---
    const ROSES1 = new Set([1, 2, 9, 10, 11, 15]);
    for (const ev of EA('Roseblood Bloom', 100, 9999)) {
      const qc = E("Queen's Crusade", ev.t, ev.t + 3), t2 = E('Alexandrian Thunder II', ev.t, ev.t + 15), t3 = E('Alexandrian Thunder III', ev.t, ev.t + 35);
      const tQ = qc ? qc.t : ev.t + 1, tII = t2 ? t2.t + 0.7 : ev.t + 9.1, tIII = t3 ? t3.t : tII + 19.1;
      const cw = Math.random() < 0.5, rot = cw ? 10 : -10, start = [83, 203, 323];
      const steps = [];
      for (let k = 0; k < 15; k++) {
        const tt = +(tII + k).toFixed(2), cones = start.map(d => ({ deg: deg360(d + rot * k), half: 22.5 }));
        const hot = electrified(ROSES1, cones);
        cones.forEach(c => hz({ t: tt, tell: k >= 2 ? +(tt - 2).toFixed(2) : tII - 4.3, shape: 'cone', at: [0, 0], deg: c.deg, half: 22.5, r: 24, dmg: 1.2, name: 'Alexandrian Thunder II', react: 2.2, aimed: true }));
        for (const i of hot) hz(Object.assign({ t: tt, tell: +(tt - 0.9).toFixed(2), dmg: 0.9, name: 'Rose tiles (electrified)', react: 1.5, aimed: true }, tileShape(i)));
        steps.push({ t: tt, shapes: [...cones.map(c => ({ shape: 'cone', at: [0, 0], deg: c.deg, half: 22.5, r: 24 })), ...[...hot].map(tileShape), { shape: 'circle', at: [0, 0], r: 2 }] });
      }
      const st0 = cw ? at(150, 5) : at(15, 5);
      const path = solve('Bloom 1', steps, { start: st0 });
      pref(tQ + 0.5, clusterAt(path[0], S));
      path.forEach((p, k) => { if (k) pref(steps[k - 1].t + 0.05, clusterAt(p, S)); });
      // Thunder III: a spread on everyone, off the roses.
      const okSpread = (p) => onA(p, 1.2) && len(p) > 4 && ![...ROSES1].some(i => inTile(i, p, 0.6));
      const spreads = spreadSpots(S, clock, okSpread, 5.6);
      pref(steps[14].t + 0.05, spreads);
      hz({ t: tIII, tell: tIII - 4.3, effect: 'bait', shape: 'circle', r: 4, from: 'target', targets: S.slice(), snap: 0.3, dmg: 0.9, own: 0.3, status: ['lightningResDown', 2], name: 'Alexandrian Thunder III' });
      call(tQ + 0.5, `Start ${cw ? 'SE' : 'N'}, rotate ${cw ? 'clockwise' : 'counterclockwise'}`, { alert: true, dur: 8 });
      call(tIII - 4.3, 'Spread (off the rose tiles)', { alert: true, dur: 4 });
      pref(tIII + 0.3, UP);
      litTiles(ROSES1, tQ + 0.5, tIII + 0.5);
      midRose(tQ + 1, tIII + 0.5);
      dark(tQ, tIII + 1);
      label(ev, 'Roseblood Bloom (the rose tiles light)');
      label(t2, `Alexandrian Thunder II (turning ${cw ? 'clockwise' : 'counterclockwise'})`);
      label(t3, 'Alexandrian Thunder III (spreads)');
    }

    // --- Thunder Slash and Alexandrian Thunder IV (Bloom 2, Bloom 5): the cones' order, the in-out ---
    const SLASH_W = [90, 270, 150, 330, 210, 30], SLASH_E = [270, 90, 330, 150, 30, 210];
    const pathText = (path) => {
      const parts = [];
      for (const p of path) { const t = tileOf(p), w = `${t < 8 ? 'In' : 'Out'} ${SLICE[t % 8]}`; if (parts[parts.length - 1] !== w) parts.push(w); }
      return parts.join(' => ');
    };

    // --- Bloom 2 ---
    const b2 = E('Roseblood: 2nd Bloom', 0, 9999);
    if (b2) {
      const qc = E("Queen's Crusade", b2.t, b2.t + 3), tQ = qc ? qc.t : b2.t + 1;
      const sl = EA('Thunder Slash', b2.t, b2.t + 25).map(e => e.t), t4 = EA('Alexandrian Thunder IV', b2.t, b2.t + 25).map(e => e.t);
      const west = Math.random() < 0.5, seq = west ? SLASH_W : SLASH_E, roses = new Set(west ? [6, 12, 2, 8] : [5, 14, 0, 11]);
      const inFirst = Math.random() < 0.5;
      const steps = [];
      sl.forEach((tt, k) => {
        const cone = { shape: 'cone', at: [0, 0], deg: seq[k % 6], half: 30, r: 24 }, hot = electrified(roses, [{ deg: seq[k % 6], half: 30 }]);
        hz(Object.assign({ t: tt, tell: k >= 2 ? sl[k - 2] : tt - 6, dmg: 1.2, name: 'Thunder Slash', react: 2, aimed: true }, cone));
        for (const i of hot) hz(Object.assign({ t: tt, tell: +(tt - 0.9).toFixed(2), dmg: 0.9, name: 'Rose tiles (electrified)', react: 1.5, aimed: true }, tileShape(i)));
        const shapes = [cone, ...[...hot].map(tileShape), { shape: 'circle', at: [0, 0], r: 2 }];
        const j = t4.findIndex(x => Math.abs(x - tt) < 0.3);
        if (j >= 0) {
          const circle = (j === 0) !== inFirst;            // the point-blank circle (out safe), else the donut (in safe)
          const s4 = circle ? { shape: 'circle', at: [0, 0], r: 8 } : { shape: 'donut', at: [0, 0], r0: 8, r1: 20 };
          hz(Object.assign({ t: tt, tell: j ? t4[0] : tt - 6.7, dmg: 1.3, name: 'Alexandrian Thunder IV', react: 3, aimed: true }, s4));
          shapes.push(s4);
        }
        steps.push({ t: tt, shapes });
      });
      if (steps.length) {
        const path = solve('Bloom 2', steps, { start: [0, -6] });
        pref(tQ + 1, clusterAt(path[0], S));
        path.forEach((p, k) => { if (k) pref(steps[k - 1].t + 0.05, clusterAt(p, S)); });
        call(steps[0].t - 6.7, pathText(path), { alert: true, dur: 11 });
        pref(steps[steps.length - 1].t + 0.3, UP);
        litTiles(roses, tQ + 0.5, steps[steps.length - 1].t + 0.5);
        midRose(tQ + 1, steps[steps.length - 1].t + 0.5);
        dark(tQ, steps[steps.length - 1].t + 1);
      }
      label(b2, `Roseblood: 2nd Bloom (${inFirst ? 'in' : 'out'} first)`);
      EA('Alexandrian Thunder IV', b2.t, b2.t + 25).forEach((e, j) => label(e, `Alexandrian Thunder IV (${(j === 0) !== inFirst ? 'circle: out' : 'donut: in'})`));
    }

    // --- Bloom 3: towers on the outer tiles, roses between ---
    const b3 = E('Roseblood: 3rd Bloom', 0, 9999);
    if (b3) {
      const qc = E("Queen's Crusade", b3.t, b3.t + 3), em = E('Emblazon (markers)', b3.t, b3.t + 20), res = E('Emblazon (resolves)', b3.t, b3.t + 30), ex = E('Explosion', b3.t, b3.t + 35);
      const tQ = qc ? qc.t : b3.t + 1, tM = em ? em.t : b3.t + 14.5, tR = res ? res.t : tM + 7.6, tX = ex ? ex.t : tR + 4.3;
      const k = Math.floor(Math.random() * 8);                    // the new north: the inner slice between the two roses
      const towers = [0, 2, 4, 6].map(j => 8 + (k + j) % 8), pre = new Set([...towers, (k + 7) % 8, (k + 1) % 8]);
      const roseSup = Math.random() < 0.5, holders = roseSup ? SUP : DPS, soakers = roseSup ? DPS : SUP;
      const roseSet = [0, 3, 4, 5].map(j => (k + j) % 8);
      let roseOf = {}, towerOf = {};
      if (st.bloom3 === 'relative') {
        for (const s of holders) roseOf[s] = (k + st.b3rose[s]) % 8;
        for (const s of soakers) towerOf[s] = 8 + (k + st.b3tower[s]) % 8;
      } else {
        const rd = st.b3roseDir || B3_ROSE_DIR, td = st.b3towerDir || B3_TOWER_DIR;
        // Each rose holder takes the rose slice nearest its direction (the best of the four ways round).
        let best = null;
        const perm = (a, n = a.length) => (n <= 1 ? [a.slice()] : [].concat(...a.map((x, i) => perm([...a.slice(0, i), ...a.slice(i + 1)]).map(r => [x, ...r]))));
        for (const p of perm(roseSet)) { const c = holders.reduce((s, h, i) => s + angDiff(rd[h], TB(p[i])), 0); if (!best || c < best.c) best = { c, p }; }
        holders.forEach((h, i) => { roseOf[h] = best.p[i]; });
        // The tower touching each one's direction.
        for (const s of soakers) towerOf[s] = towers.find(t => angDiff(td[s], 45 * (t % 8)) < 1 || angDiff(td[s], 45 * (t % 8) + 45) < 1);
      }
      const after = new Set([...pre, ...holders.map(s => roseOf[s])]), groups = groupsOf(after);
      const groupOf = (t) => groups.find(g => g.has(t));
      const roseSpot = Object.fromEntries(holders.map(s => [s, tileMid(roseOf[s], 5)])), towerSpot = Object.fromEntries(soakers.map(s => [s, tileMid(towerOf[s], 12)]));
      // Off the roses once they're down: the nearest unlit ground.
      const taken = [];
      const away = Object.fromEntries(holders.map(s => {
        const p = findSpot(roseSpot[s], (q) => onA(q, 1.2) && len(q) > 3.8 && ![...after].some(i => inTile(i, q, 1.3)) && taken.every(x => dist(x, q) > 1.2));
        taken.push(p);
        return [s, p];
      }));
      pref(tM + 0.9, Object.assign({}, roseSpot, towerSpot));
      pref(tR + 0.05, away);
      for (const s of holders) {
        call(tM + 0.8, `Rose Marker on YOU: ${tileName(roseOf[s])}`, { slot: s, alert: true, dur: 6 });
        debuff(s, null, 'Emblazon', `drop your rose on the ${tileName(roseOf[s])} tile`, tM + 0.8, tR);
        check({ t: tR - 0.1, kind: 'spot', slots: [s], spots: { [s]: roseSpot[s] }, r: 2.6, fail: 0.9, name: 'Emblazon (a rose on the wrong tile)' });
      }
      for (const s of soakers) call(tM + 0.8, `Soak Tower: ${tileName(towerOf[s])}`, { slot: s, alert: true, dur: 6 });
      for (const t of towers) {
        const who = soakers.find(s => towerOf[s] === t);
        hz(Object.assign({ t: tX, tell: tX - 13, effect: 'tower', soak: 1, only: [who], dmg: 0.3, fail: 0.9, status: ['lightResDown', 2], name: 'Explosion (tower)' }, tileShape(t)));
        for (const i of groupOf(t)) if (i !== t) hz(Object.assign({ t: tX, tell: tR, effect: 'tower', soak: [0, 0], only: [], dmg: 0.9, fail: 0.9, name: 'Explosion (its rose group)' }, tileShape(i)));
      }
      pref(tX + 0.3, UP);
      litTiles(pre, tQ + 0.5, tX + 0.3);
      litTiles(holders.map(s => roseOf[s]), tR, tX + 0.3);
      midRose(tQ + 1, tX + 0.3);
      dark(tQ, tX + 1);
      label(b3, `Roseblood: 3rd Bloom (towers ${towers.map(t => SLICE[t % 8]).join('/')})`);
      label(em, `Emblazon (roses on the ${roseSup ? 'supports' : 'DPS'})`);
      label(ex, 'Explosion (the towers: one soaker each)');
      label(E('Alexandrian Holy', b3.t, b3.t + 20), 'Alexandrian Holy (the Shade: towers)');
    }

    // --- Escelons' Fall 2: donuts and stacks, then the cones ---
    const sh2 = events.find(e => e.name === 'Shock' && e.t > 200 && e.t < 400);
    const ef2 = sh2 && E("Escelons' Fall", sh2.t, sh2.t + 30);
    if (sh2 && ef2) {
      const tIcon = sh2.t + 0.8, t1 = sh2.t + 8.9, ban = EA('Alexandrian Banish II', sh2.t, sh2.t + 15), tS = ban.length ? ban[ban.length - 1].t : t1 + 1;
      const donutSup = Math.random() < 0.5, dRole = donutSup ? SUP : DPS, oRole = donutSup ? DPS : SUP;
      const donuts = shuffle(dRole).slice(0, 3), dStack = dRole.find(s => !donuts.includes(s)), oStack = pick(oRole);
      const mode = st.ef2;
      const tEnd = +(t1 + 5.5).toFixed(2);
      let spots, stackAt;
      if (mode === 'bd') {
        spots = Object.assign(clusterAt([0, 0], [...oRole, dStack], 0.8), Object.fromEntries(donuts.map(s => [s, r2(at(clock(s), 14.4))])));
      } else {
        const supC = mode === 'ns' ? [0, 5.8] : [-5.8, 0], dpsC = mode === 'ns' ? [0, -5.8] : [5.8, 0];
        const grp = (role, c) => (role === dRole ? clusterAt(c, [...donuts, dStack], 0.25) : clusterAt(c, role, 0.8));
        spots = Object.assign(grp(SUP, supC), grp(DPS, dpsC));
        stackAt = { sup: supC, dps: dpsC };
      }
      pref(tIcon + 0.3, spots);
      hz({ t: t1, tell: tIcon, effect: 'bait', shape: 'donut', r0: 1, r1: 6, from: 'target', targets: donuts, snap: 0.4, dmg: 0.9, own: 0, name: 'Shock (donut)' });
      for (let k = 1; k <= 11; k++) {
        const tt = +(t1 + 0.5 * k).toFixed(2);
        hz({ t: tt, tell: +(tt - 0.5).toFixed(2), effect: 'bait', shape: 'donut', r0: 1, r1: 6, from: 'target', targets: donuts, snap: tt - (t1 - 0.4), dmg: 0.6, own: 0, quiet: true, name: 'Shock (donut)' });
      }
      if (mode === 'bd') hz({ t: tS, tell: tS - 5, effect: 'share', shape: 'circle', from: 'target', targets: [oStack], r: 5, min: 5, max: 5, dmg: 0.5, name: 'Alexandrian Banish II (both stacks)' });
      else for (const s of [dStack, oStack]) hz({ t: tS, tell: tS - 5, effect: 'share', shape: 'circle', from: 'target', targets: [s], r: 5, min: 4, max: 4, dmg: 0.3, name: 'Alexandrian Banish II' });
      for (const s of donuts) call(tIcon, mode === 'bd' ? 'Donut on YOU: out to your clock spot' : 'Donut on YOU: stack tight with your group', { slot: s, alert: true, dur: 6 });
      call(tS - 5, mode === 'bd' ? `Stacks on ${dStack} and ${oStack}: everyone else in the middle` : `Stacks: ${mode === 'ns' ? 'supports north, DPS south' : 'supports west, DPS east'} (on the hitbox)`, { dur: 5 });
      const fanOf = mode === 'ns' ? FAN_NS : FAN_WE;
      const spotOf = mode === 'bd' ? clockSpot : (s, near) => r2(at(fanOf[s], near ? IN_R : OUT_R));
      escelons(ef2, { first: donutSup ? 'dps' : 'sup', spotOf, goT: tEnd + 0.1, callT: tEnd - 1 });
      label(sh2, `Shock (donuts on ${donuts.join(', ')})`);
      ban.forEach(e => label(e, `Alexandrian Banish II (stacks on ${dStack} and ${oStack})`));
      label(E('Bud of Valor', sh2.t - 10, sh2.t), 'Bud of Valor (a Shade)');
    }

    // --- Bloom 4: roses and spreads, the thorns, Banish III ---
    const b4 = E('Roseblood: 4th Bloom', 0, 9999);
    if (b4) {
      const qc = E("Queen's Crusade", b4.t, b4.t + 3), em = E('Emblazon (markers)', b4.t, b4.t + 15), res = E('Emblazon (resolves)', b4.t, b4.t + 20);
      const th3 = E('Alexandrian Thunder III', b4.t, b4.t + 20), thorn = E('Encircling Thorns', b4.t, b4.t + 25), ban = EA('Alexandrian Banish III', b4.t, b4.t + 35);
      const tQ = qc ? qc.t : b4.t + 1, tM = em ? em.t : b4.t + 6.4, tR = res ? res.t : tM + 7.6, t3 = th3 ? th3.t : tR + 0.7;
      const tTh = (thorn ? thorn.t : t3 + 4) + 3.9, tB = ban.length ? ban[ban.length - 1].t : tTh + 5.1;
      const south = Math.random() < 0.5, rot = south ? 0 : 4;
      const R = (i) => (i < 8 ? (i + rot) % 8 : 8 + (i - 8 + rot) % 8), RB = (b) => deg360(b + (south ? 0 : 180));
      const pre = new Set([1, 6, 8, 10, 13].map(R)), roseTiles = [3, 4, 11, 12].map(R);
      const roseSup = Math.random() < 0.5, holders = roseSup ? SUP : DPS, spreaders = roseSup ? DPS : SUP;
      // The rose tiles: relative (left = west with the roses south), or true north (east or west of the quarter).
      const iE = south ? 3 : 0, iW = south ? 4 : 7, oE = south ? 11 : 8, oW = south ? 12 : 15;
      const relL = { inner: R(4), outer: R(12) }, relR = { inner: R(3), outer: R(11) };
      const roseOf = {};
      holders.forEach((s, i) => {
        const ring = i < 2 ? 'inner' : 'outer', first = i % 2 === 0;           // T1/M1 inner left, T2/M2 inner right, H1/R1 outer left, H2/R2 outer right
        if (st.bloom4 === 'relative') roseOf[s] = (first ? relL : relR)[ring];
        else { const east = first === st.b4East; roseOf[s] = ring === 'inner' ? (east ? iE : iW) : (east ? oE : oW); }
      });
      // The spreads across from the roses (this script's own spots): north-north-west outer, the inner edge north,
      // west-north-west outer and east-north-east outer (turned with the pattern).
      const SPR = { A: at(RB(298), 13), B: at(RB(337.5), 12.6), C: at(RB(0), 7.5), D: at(RB(70), 13) };
      const sprOf = roseSup ? { M1: 'B', M2: 'C', R1: 'A', R2: 'D' } : { MT: 'C', OT: 'B', H1: 'A', H2: 'D' };
      const ground = [at(RB(51.3), 6.4), at(RB(308.7), 6.4)];        // (+-5, 4): the two Thunder III puddles
      const hot3 = electrified(pre, []);
      for (const g of ground) for (const i of tilesUnder(g, 4)) if (pre.has(i)) groupsOf(pre).find(x => x.has(i)).forEach(t => hot3.add(t));
      const roseSpot = Object.fromEntries(holders.map(s => [s, tileMid(roseOf[s], roseOf[s] < 8 ? 5 : 12)]));
      pref(tM + 0.9, Object.assign({}, roseSpot, Object.fromEntries(spreaders.map(s => [s, r2(SPR[sprOf[s]])]))));
      for (const s of holders) {
        call(tM + 0.8, `Rose Marker on YOU, ${south ? 'south' : 'north'}: ${tileName(roseOf[s])}`, { slot: s, alert: true, dur: 6 });
        debuff(s, null, 'Emblazon', `drop your rose on the ${tileName(roseOf[s])} tile`, tM + 0.8, tR);
        check({ t: tR - 0.1, kind: 'spot', slots: [s], spots: { [s]: roseSpot[s] }, r: 2.6, fail: 0.9, name: 'Emblazon (a rose on the wrong tile)' });
      }
      for (const s of spreaders) call(tM + 0.8, `Spread Marker on YOU, spread ${south ? 'north' : 'south'}`, { slot: s, alert: true, dur: 6 });
      call(tQ + 0.6, south ? 'Roses south, spreads north' : 'Roses north, spreads south', { dur: 5 });
      hz({ t: t3, tell: t3 - 5, effect: 'bait', shape: 'circle', r: 4, from: 'target', targets: spreaders, snap: 0.3, dmg: 0.9, own: 0.3, status: ['lightningResDown', 2], name: 'Alexandrian Thunder III' });
      for (const g of ground) hz({ t: t3, tell: t3 - 7.5, shape: 'circle', at: r2(g), r: 4, dmg: 1.0, name: 'Alexandrian Thunder III (puddle)' });
      for (const i of hot3) hz(Object.assign({ t: t3, tell: t3 - 1, dmg: 0.9, name: 'Rose tiles (electrified)', react: 1.5, aimed: true }, tileShape(i)));
      // Meet near the middle in the spreads' quarter, then stretch the thorns: the supports one side, the DPS the other,
      // each on the outer rose tile there (the roses join them, so the stack is shared through them).
      const meet = at(RB(0), 4.6);
      pref(t3 + 0.05, clusterAt(meet, S, 0.8));
      const supWest = st.bloom4 === 'tn' ? true : !south;           // relative: left facing her from the meet
      const westT = south ? 13 : 14, eastT = south ? 10 : 9;
      const supT = supWest ? westT : eastT, dpsT = supWest ? eastT : westT;
      const supC = tileMid(supT, 12.4), dpsC = tileMid(dpsT, 12.4), fin = Object.assign(clusterAt(supC, SUP, 0.9), clusterAt(dpsC, DPS, 0.9));
      pref(tTh + 0.05, fin);
      const pairs = shuffle(DPS);
      SUP.forEach((s, i) => {
        const d = pairs[i];
        for (const [a, b] of [[s, d], [d, s]]) hz({ t: tB, tell: tTh, targets: [a], tether: b, stretch: 20, dmg: 0, fail: 0.8, quiet: true, name: 'Encircling Thorns (tether not broken)' });
        for (const x of [s, d]) debuff(x, 'thornyVine', 'Thorny Vine', `break the tether with ${x === s ? d : s}: 20 yalms`, tTh, tB);
      });
      const healer = pick(['H1', 'H2']);
      hz({ t: tB, tell: tB - 4.8, effect: 'share', shape: 'circle', from: 'target', targets: [healer], r: 4, min: 4, max: 4, dmg: 0.35, name: 'Alexandrian Banish III' });
      hz({ t: tB, tell: tB - 4.8, effect: 'share', shape: 'circle', at: dpsC, r: 4, min: 4, max: 4, dmg: 0.35, name: 'Alexandrian Banish III (through the roses)' });
      check({ t: tB - 0.1, kind: 'spot', spots: fin, r: 3.5, fail: 0.9, name: 'Alexandrian Banish III (off your rose tile)' });
      call(t3 + 0.3, 'Stack for thorns => break tethers => stack in red tiles', { alert: true, dur: 6 });
      call(tTh, `Break the tethers: supports ${supWest ? 'west' : 'east'}, DPS ${supWest ? 'east' : 'west'}`, { alert: true, dur: 5 });
      call(tB - 4.8, `Support/DPS stacks (on ${healer})`, { dur: 4 });
      pref(tB + 0.3, UP);
      litTiles(pre, tQ + 0.5, tB + 0.3);
      litTiles(roseTiles, tR, tB + 0.3);
      midRose(tQ + 1, tB + 0.3);
      dark(tQ, tB + 1);
      label(b4, `Roseblood: 4th Bloom (roses ${south ? 'south' : 'north'})`);
      label(em, `Emblazon (roses on the ${roseSup ? 'supports' : 'DPS'})`);
      label(thorn, 'Encircling Thorns (support-DPS tethers)');
      ban.forEach(e => label(e, `Alexandrian Banish III (stack on ${healer})`));
    }

    // --- Escelons' Fall 3: Power Break either side ---
    const ef3 = events.find(e => e.name === "Escelons' Fall" && e.t > 400);
    if (ef3) {
      const pbs = EA('Power Break', ef3.t - 10, ef3.t + 15), sides = pbs.map(() => pick(['E', 'W']));
      // Out of the cleaved half: each just across the middle line from its spot for the cones.
      const proj = (spots, side) => { const g = side === 'E' ? -1 : 1; return Object.fromEntries(Object.entries(spots).map(([s, p]) => [s, r2([g * Math.max(2.6, g * p[0]), p[1]])])); };
      pbs.forEach((pb, k) => {
        hz({ t: pb.t, tell: pb.t - 6, shape: 'half', dir: [sides[k] === 'E' ? 1 : -1, 0], dmg: 1.4, name: 'Power Break', react: 1.8 });
        call(pb.t - 6, sides[k] === 'E' ? 'West' : 'East', { alert: true, dur: 4 });
        mark({ shape: 'circle', at: [0, k ? -12 : 12], r: 1.3 }, pb.t - 6, pb.t + 0.3, 'rgba(170,90,255,0.6)');
        label(pb, `Power Break (the ${sides[k] === 'E' ? 'east' : 'west'} half)`);
      });
      const r = escelons(ef3, { first: st.ef1 === 'supports' ? 'sup' : st.ef1 === 'dps' ? 'dps' : null, spotOf: clockSpot, goT: pbs[0] ? pbs[0].t + 0.05 : ef3.t - 11 });
      if (pbs[0]) pref(pbs[0].t - 6, proj(r.posAt(0), sides[0]));
      if (pbs[1]) { pref(r.baits[3] + 0.05, proj(r.posAt(3), sides[1])); pref(pbs[1].t + 0.3, UP); }
      label(E('Bud of Valor', ef3.t - 20, ef3.t), 'Bud of Valor (two Shades)');
    }

    // --- Bloom 5: Valorous Ascension, the Briar Thorns' lanes, Thunder Slash and Thunder IV ---
    const b5 = E('Roseblood: 5th Bloom', 0, 9999);
    if (b5) {
      const qc = E("Queen's Crusade", b5.t, b5.t + 3), tQ = qc ? qc.t : b5.t + 1;
      const va = E('Valorous Ascension x3', b5.t, b5.t + 15), ch = EA('Valorous Ascension (chakrams)', b5.t, b5.t + 30).map(e => e.t);
      const sl = EA('Thunder Slash', b5.t, b5.t + 30).map(e => e.t), t4 = EA('Alexandrian Thunder IV', b5.t, b5.t + 30).map(e => e.t);
      if (va) [0, 0.4, 1.85].forEach(d => hz({ t: +(va.t + d).toFixed(2), tell: va.t - 3, raidwide: true, dmg: 0.18, name: 'Valorous Ascension' }));
      if (va) call(va.t - 3, 'AoE x3', { dur: 3 });
      // The safe pair of quarters (the other two are roses), the first lanes' half, then the half at right angles that
      // holds the first safe quarter.
      const QB = { NE: 45, SE: 135, SW: 225, NW: 315 }, QT = { NE: [0, 1, 8, 9], SE: [2, 3, 10, 11], SW: [4, 5, 12, 13], NW: [6, 7, 14, 15] };
      const pair = pick([['NE', 'SW'], ['SE', 'NW']]), roses = new Set(['NE', 'SE', 'SW', 'NW'].filter(q => !pair.includes(q)).flatMap(q => QT[q]));
      const halfQ = { N: ['NE', 'NW'], S: ['SE', 'SW'], E: ['NE', 'SE'], W: ['NW', 'SW'] };
      const w1 = pick(['N', 'E', 'S', 'W']), firstQ = pair.find(q => !halfQ[w1].includes(q)), secondQ = pair.find(q => q !== firstQ);
      const w2 = (w1 === 'N' || w1 === 'S' ? ['E', 'W'] : ['N', 'S']).find(h => halfQ[h].includes(firstQ));
      const LANES = { S: [[16, -12], [16, -4]], N: [[16, 4], [16, 12]], E: [[4, 16], [12, 16]], W: [[-4, 16], [-12, 16]] };
      const lanes = (h) => LANES[h].map(p => ({ shape: 'line', at: p, deg: h === 'N' || h === 'S' ? 270 : 180, len: 40, w: 8 }));
      const inFirst = Math.random() < 0.5;
      const tw = [ch[0] ?? (sl[0] - 0.2), ch[1] ?? (sl[0] + 2.9)];
      // Everything that lands, by second: the lanes, the slashes (in either order: the one the party can get through
      // this pull, this script's guess at the game's), the rose tiles they electrify and the in-out.
      const build = (seq) => {
        const hs = [], byT = new Map();
        const at_ = (tt) => { const k = +tt.toFixed(2); if (!byT.has(k)) byT.set(k, []); return byT.get(k); };
        [w1, w2].forEach((h, j) => lanes(h).forEach(s => { hs.push(Object.assign({ t: tw[j], tell: tw[j] - 5, dmg: 1.3, name: 'Valorous Ascension (Briar Thorn)', react: 3, aimed: true }, s)); at_(tw[j]).push(s); }));
        sl.forEach((tt, k) => {
          const cone = { shape: 'cone', at: [0, 0], deg: seq[k % 6], half: 30, r: 24 }, hot = electrified(roses, [{ deg: seq[k % 6], half: 30 }]);
          hs.push(Object.assign({ t: tt, tell: k >= 2 ? sl[k - 2] : tt - 6, dmg: 1.2, name: 'Thunder Slash', react: 2, aimed: true }, cone));
          for (const i of hot) hs.push(Object.assign({ t: tt, tell: +(tt - 0.9).toFixed(2), dmg: 0.9, name: 'Rose tiles (electrified)', react: 1.5, aimed: true }, tileShape(i)));
          at_(tt).push(cone, ...[...hot].map(tileShape));
        });
        t4.forEach((tt, j) => {
          const circle = (j === 0) !== inFirst, s4 = circle ? { shape: 'circle', at: [0, 0], r: 8 } : { shape: 'donut', at: [0, 0], r0: 8, r1: 20 };
          hs.push(Object.assign({ t: tt, tell: j ? t4[0] : tt - 6.7, dmg: 1.3, name: 'Alexandrian Thunder IV', react: 3, aimed: true }, s4));
          at_(tt).push(s4);
        });
        const steps = [...byT.entries()].sort((a, b) => a[0] - b[0]).map(([t, shapes]) => ({ t, shapes: shapes.concat([{ shape: 'circle', at: [0, 0], r: 2 }]) }));
        return { hs, steps, seq, path: solvePath(steps, { start: at(QB[firstQ], inFirst ? 5 : 11) }) };
      };
      const tries = shuffle([SLASH_W, SLASH_E]).map(build), got = tries.find(x => !x.path.bad.length) || tries[0];
      got.hs.forEach(h => hz(h));
      const steps = got.steps, seq = got.seq;
      if (steps.length) {
        const path = got.path;
        if (path.bad.length) P.notes.push(`Bloom 5 ${pair} ${w1}${w2} ${inFirst ? 'in' : 'out'} ${seq[0]}: no clean way at ${path.bad.map(k => steps[k].t).join(', ')}`);
        pref(tQ + 1, clusterAt(path[0], S));
        path.forEach((p, k) => { if (k) pref(steps[k - 1].t + 0.05, clusterAt(p, S)); });
        call(tw[0] - 5, `Start ${firstQ}`, { alert: true, dur: 4 });
        call(steps[0].t - 4, `${inFirst ? 'In' : 'Out'} ${firstQ} Clockwise => ${inFirst ? 'Out' : 'In'} ${secondQ}`, { alert: true, dur: 8 });
        pref(steps[steps.length - 1].t + 0.3, UP);
        litTiles(roses, tQ + 0.5, steps[steps.length - 1].t + 0.5);
        midRose(tQ + 1, steps[steps.length - 1].t + 0.5);
        dark(tQ, steps[steps.length - 1].t + 1);
      }
      label(b5, `Roseblood: 5th Bloom (${pair.join('/')} free of roses)`);
      EA('Valorous Ascension (chakrams)', b5.t, b5.t + 30).forEach((e, j) => label(e, `Valorous Ascension (Briar Thorns: the ${({ N: 'north', S: 'south', E: 'east', W: 'west' })[j ? w2 : w1]} half)`));
      EA('Alexandrian Thunder IV', b5.t, b5.t + 30).forEach((e, j) => label(e, `Alexandrian Thunder IV (${(j === 0) !== inFirst ? 'circle: out' : 'donut: in'})`));
    }

    // --- Bloom 6: towers, roses linking them, Holy Hazard ---
    const b6 = E('Roseblood: 6th Bloom', 0, 9999);
    if (b6) {
      const qc = E("Queen's Crusade", b6.t, b6.t + 3), em = E('Emblazon (markers)', b6.t, b6.t + 20), res = E('Emblazon (resolves)', b6.t, b6.t + 25);
      const hh = EA('Holy Hazard (snapshot)', b6.t, b6.t + 35).map(e => e.t), ex = E('Explosion', b6.t, b6.t + 35);
      const tQ = qc ? qc.t : b6.t + 1, tM = em ? em.t : b6.t + 12.5, tR = res ? res.t : tM + 7.6;
      const h1 = hh[0] ?? tR + 3.4, h2 = hh[1] ?? h1 + 3, tX = +((ex ? ex.t : h2) + 0.1).toFixed(2);
      const v1 = Math.random() < 0.5;
      const innerT = v1 ? [1, 5] : [2, 6], outerT = v1 ? [10, 14] : [9, 13], towers = [...innerT, ...outerT];
      const innerAxis = v1 ? 67.5 : 112.5, outerAxis = v1 ? 112.5 : 67.5;
      const hitFirst = pick(['inner', 'outer']), ax1 = hitFirst === 'inner' ? innerAxis : outerAxis, ax2 = hitFirst === 'inner' ? outerAxis : innerAxis;
      const cones = (ax) => [ax, ax + 180].map(d => ({ shape: 'cone', at: [0, 0], deg: deg360(d), half: 45, r: 24 }));
      const C1 = cones(ax1), C2 = cones(ax2), lb3 = st.bloom6 === 'lb3';
      const roseSup = Math.random() < 0.5, holders = roseSup ? SUP : DPS, soakers = roseSup ? DPS : SUP;
      // Which tiles: LB3 the strat's inner N/S tile; N/S and W/E, the slice by spot and inner or outer to link the
      // towers the first cleave misses.
      const SL = { SSW: 4, NNE: 0, NNW: 7, SSE: 3 };
      const linkInner = lb3 || hitFirst === 'outer';
      const sliceOf = st.bloom6 === 'ns' ? { MT: 'SSW', OT: 'NNE', H1: 'NNW', H2: 'SSE', M1: 'SSW', M2: 'NNE', R1: 'NNW', R2: 'SSE' }
        : { MT: 'SSW', OT: 'SSE', H1: 'NNW', H2: 'NNE', M1: 'SSW', M2: 'SSE', R1: 'NNW', R2: 'NNE' };
      const roseOf = Object.fromEntries(holders.map(s => [s, lb3 ? st.lb3[s] : SL[sliceOf[s]] + (linkInner ? 0 : 8)]));
      const west = (t) => TB(t) > 180, north = (t) => TB(t) > 270 || TB(t) < 90;
      const towerFor = (s) => {
        const inner = ['MT', 'OT', 'M1', 'M2'].includes(s), first = ['MT', 'H1', 'M1', 'R1'].includes(s), ts = inner ? innerT : outerT;
        return st.bloom6 === 'ns' ? ts.find(t => north(t) === first) : ts.find(t => west(t) === first);
      };
      const towerOf = Object.fromEntries(soakers.map(s => [s, towerFor(s)]));
      const active = new Set([...towers, ...holders.map(s => roseOf[s])]), groups = groupsOf(active), groupOf = (t) => groups.find(g => g.has(t));
      const safe1 = (p) => C1.every(c => !inside(c, p, 1.6)), safe2 = (p) => C2.every(c => !inside(c, p, 1.6));
      const roseSpot = Object.fromEntries(holders.map(s => [s, tileMid(roseOf[s], roseOf[s] < 8 ? 5 : 12)]));
      const taken = [];
      const free = (q) => taken.every(x => dist(x, q) > 1.1);
      // The soakers: in the tower's group where the second cleave misses (LB3: on the tower), and clear of the first.
      const soak2 = {}, soak1 = {};
      for (const s of soakers) {
        const t = towerOf[s], g = groupOf(t);
        const p2 = lb3 ? tileMid(t, t < 8 ? 5.5 : 12) : findSpot(tileMid(t, t < 8 ? 6 : 12), (q) => onA(q, 1.2) && len(q) > 3.8 && [...g].some(i => inTile(i, q, -0.4)) && safe2(q) && free(q));
        taken.push(p2);
        soak2[s] = p2;
        soak1[s] = lb3 || safe1(p2) ? p2 : findSpot(p2, (q) => onA(q, 1.2) && len(q) > 3.8 && safe1(q) && free(q));
        if (soak1[s] !== p2) taken.push(soak1[s]);
      }
      // The roses, once down: off every lit tile, clear of both cleaves.
      const away = Object.fromEntries(holders.map(s => {
        const p = findSpot(roseSpot[s], (q) => onA(q, 1.2) && len(q) > 3.8 && ![...active].some(i => inTile(i, q, 1.3)) && (lb3 || (safe1(q) && safe2(q))) && free(q));
        taken.push(p);
        return [s, p];
      }));
      pref(tM + 0.9, Object.assign({}, roseSpot, soak1));
      pref(tR + 0.05, Object.assign({}, away, soak1));
      pref(h1 + 0.05, soak2);
      for (const s of holders) {
        call(tM + 0.8, `Rose Marker on YOU: ${tileName(roseOf[s])}`, { slot: s, alert: true, dur: 6 });
        debuff(s, null, 'Emblazon', `drop your rose on the ${tileName(roseOf[s])} tile`, tM + 0.8, tR);
        check({ t: tR - 0.1, kind: 'spot', slots: [s], spots: { [s]: roseSpot[s] }, r: 2.6, fail: 0.9, name: 'Emblazon (a rose on the wrong tile)' });
      }
      for (const s of soakers) call(tM + 0.8, lb3 ? `Tower Soaks Later: ${tileName(towerOf[s])}${TANK(s) ? ' (remember to LB!)' : ''}` : 'Tower Soaks Later', { slot: s, dur: 6 });
      if (!lb3) {
        for (const s of holders) call(tR - 3, `Place rose ${linkInner ? 'in' : 'out'} => dodge cleaves`, { slot: s, alert: true, dur: 4 });
        for (const s of soakers) call(tR - 3, `Dodge cleaves => soak tower (${tileName(towerOf[s])})`, { slot: s, alert: true, dur: 4 });
      }
      if (lb3) {
        for (const tt of [h1, h2]) hz({ t: tt, tell: tt - 3, raidwide: true, dmg: 0.3, name: 'Holy Hazard (the tank LB3 covers it)' });
        C1.forEach(c => mark(c, h1 - 0.8, h1 + 0.2, 'rgba(255,170,80,0.35)'));
        C2.forEach(c => mark(c, h2 - 0.8, h2 + 0.2, 'rgba(255,170,80,0.35)'));
      } else {
        C1.forEach(c => hz(Object.assign({ t: h1, tell: h1 - 5.5, dmg: 1.3, name: 'Holy Hazard' }, c)));
        C2.forEach(c => hz(Object.assign({ t: h2, tell: h1, dmg: 1.3, name: 'Holy Hazard' }, c)));
      }
      for (const s of soakers) {
        const t = towerOf[s], g = groupOf(t), mine = tileOf(soak2[s]);
        hz(Object.assign({ t: tX, tell: tX - 13, effect: 'tower', soak: 1, only: [s], dmg: 0.3, fail: 0.9, status: ['lightResDown', 2], name: 'Explosion (tower)' }, tileShape(mine)));
        for (const i of g) if (i !== mine) hz(Object.assign({ t: tX, tell: tR, effect: 'tower', soak: [0, 0], only: [], dmg: 0.9, fail: 0.9, name: 'Explosion (its rose group)' }, tileShape(i)));
      }
      pref(tX + 0.3, UP);
      litTiles(towers, tQ + 0.5, tX + 0.3);
      litTiles(holders.map(s => roseOf[s]), tR, tX + 0.3);
      midRose(tQ + 1, tX + 0.3);
      dark(tQ, tX + 1);
      label(b6, `Roseblood: 6th Bloom (inner towers ${innerT.map(t => SLICE[t]).join('/')}, outer ${outerT.map(t => SLICE[t % 8]).join('/')})`);
      label(em, `Emblazon (roses on the ${roseSup ? 'supports' : 'DPS'})`);
      EA('Holy Hazard (snapshot)', b6.t, b6.t + 35).forEach((e, j) => label(e, `Holy Hazard (the ${(j ? hitFirst === 'inner' ? 'outer' : 'inner' : hitFirst)} towers' line)`));
      label(ex, 'Explosion (the towers: one soaker each)');
    }
    function TANK(s) { return s === 'MT' || s === 'OT'; }

    // --- Roseblood Withering, Rose Red ---
    const wi = E('Roseblood Withering', 0, 9999);
    if (wi) {
      const qc = E("Queen's Crusade", wi.t, wi.t + 3), tQ = qc ? qc.t : wi.t + 1, rr = events.find(e => e.name === 'Rose Red');
      litTiles(Array.from({ length: 16 }, (_, i) => i), tQ + 0.5, (rr ? rr.t : tQ + 12) + 1, 'rgba(210,30,60,0.42)');
      dark(tQ, (rr ? rr.t : tQ + 12) + 5);
      call(tQ + 0.5, 'Every tile a rose: Rose Red is the enrage', { alert: true, dur: 6 });
      label(wi, 'Roseblood Withering (every tile a rose)');
      if (rr) label(rr, 'Rose Red (the enrage)');
    }
    for (const ev of EA("Queen's Crusade", 0, 9999)) label(ev, "Queen's Crusade (the rose field)");
    for (const ev of EA('Bud of Valor', 0, 9999)) if (!P.labels.has(ev)) label(ev, 'Bud of Valor (a Shade)');

    // The floor's look: the dark battlefield (the gimmick floor) through each bloom, the white stone otherwise.
    floors.sort((a, b) => a[0] - b[0]);
    for (const [a, b] of floors) P.looks.push({ t: +(a + 0.5).toFixed(2), show: ['a1_gmc00'] }, { t: +b.toFixed(2), show: ['a1_stc01'] });
    P.looks.sort((a, b) => a.t - b.t);
    return P;
  }

  B.FIGHT_SCRIPTS = B.FIGHT_SCRIPTS || {};
  B.FIGHT_SCRIPTS.ex4 = {
    // FFLogs' max HP in a kill (report 6rv2txLJQKcYzhbA): Zelenia 85,834,672; the four Roseblood Drops 1,562,890 each.
    hp: 85834672,
    adds: [{ from: 97.7, to: 146.7, hp: 6251560, share: 1, name: 'Roseblood Drops' }],
    pushes: [],
    defaultStrat: 'raidplan',
    strats: {
      raidplan: { label: 'Raidplan (-Wj9 & k9Vc)' },
      hector: { label: 'Hector' },
      happy: { label: 'Mrhappy' },
      yukizuri: { label: 'Yukizuri' },
    },
    source: 'wtfdig.info/72/ex4; mechanics after BossMod (github.com/awgil/ffxiv_bossmod) and FFLogs kills',
    // A north, B east, C south, D west; 1-4 the intercards (1 north-west, then clockwise), as the strats' diagrams.
    waymarks: [
      { label: 'A', at: [0, 12], color: 'red' }, { label: 'B', at: [12, 0], color: 'yellow' },
      { label: 'C', at: [0, -12], color: 'blue' }, { label: 'D', at: [-12, 0], color: 'purple' },
      { label: '1', at: [-4.3, 4.3], color: 'red', square: true }, { label: '2', at: [4.3, 4.3], color: 'yellow', square: true },
      { label: '3', at: [4.3, -4.3], color: 'blue', square: true }, { label: '4', at: [-4.3, -4.3], color: 'purple', square: true },
    ],
    plan,
  };
})(window.BLM);
