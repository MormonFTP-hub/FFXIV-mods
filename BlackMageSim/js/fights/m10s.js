// M10S, AAC Heavyweight M2 (Savage): The Xtremes, Red Hot and Deep Blue, for the sim's party, on cactbot's timeline,
// with the strats wtfdig.info lists: Toxic Friends (its default), Hector (Toxic with nomnom's snaking) and OCE (MR).
// wtfdig's strats are bundles of per-mechanic choices (its toggles): Snaking (Toxic, nomnom or OCE) and Deep Aerial
// (Parallel, the only one); the rest of each strat's text (Flame Floater, Insane Air 2's swaps, the last buster) is
// its own. Spots are [east, north] yalms from the arena's middle.
//
// Two bosses, one sim target: the sim's boss (its model, target ring and anything aimed from 'boss') is Red Hot, who
// is up longest (and BossMod's primary actor); in Deep Blue's solo stretch (88.8-151.6) it stands where she does, as
// the party's target. Deep Blue's attacks come from her own spots (`from` points) wherever she stands. Their HP is
// shared: each has 59,491,502 (FFLogs), and Epic Brotherhood evens the two out every phase, so the kill needs both
// pools: the sim's target has 118,983,004.
//
// The mechanics follow BossMod's module (github.com/awgil/ffxiv_bossmod, RM10STheXtremes), with positions from three
// FFLogs kills, built with the sim's toolkit (js/mech.js):
//   - Red Hot alone: Hot Impact (a 6-yalm buster the tanks share); Flame Floater (four baits in order, each an 8-wide
//     line from the last one's spot that stays as fire; the tether has to be stretched 16); Alley-oop Inferno (5-yalm
//     spreads that leave fire); Cutback Blaze (a 330-degree cone at the farthest player, everyone takes it, and it
//     stays as fire but for the slice behind her); Pyrotation (three 6-yalm stacks walking out along that slice, each
//     leaving fire); Divers' Dare raidwides. Her fire lasts till she leaves.
//   - Deep Blue alone: Sick Swell (a wave throwing everyone 10 yalms) with Sickest Take-off (a 15-wide line along it);
//     Awesome Splash (spreads) or Slab (light-party stacks); Alley-oop Double-dip (30-degree proteans, then the same
//     again: move) or Reverse (then the gaps between: stay); Deep Impact (a buster on the farthest, knocked back).
//   - Xtreme Spectacular: the middle 30 yalms north to south is hit; raidwides after.
//   - Insane Air (twice): each boss rides a board round the ring (Red Hot from the south-east, Deep Blue from the
//     north-west, clockwise; one ends in the middle), each board a proximity bait on the four nearest: 45-degree
//     proteans, a 45-degree stack, or a 6-yalm buster; Red Hot's leave fire. The second time everyone carries a colour
//     and swaps boards in role order (healers, melee, ranged; tanks on the buster) to cleanse, with 15-yalm Bailout
//     stacks after each.
//   - Snaking: a light party each gets Firesnaking (Red Hot's) or Watersnaking (Deep Blue's): fire spreads on the east
//     wall, water proteans in Deep Blue's corner; Hot Impact; Deep Varial (a 120-degree cone from the north or south
//     wall); water stack or spreads and more fire spreads; Hot Aerial (four jumps on fire players, each leaving fire);
//     the wave; Cutback Blaze on a fire player; Deep Impact on the water tank. Water on fire (Deep Varial, the wave,
//     the proteans) sets off Steam Burst, 9 yalms round each fire puddle.
//   - Deep Aerial: a two-player tower (the healers) whose players are held in Watery Grave in the middle, the floor a
//     circle; six rounds of tethered Xtreme Waves, Red Hot's through the bubble, Deep Blue's clear of it.
//   - Arena split: Flame Floater down the middle (fire till the phase ends), spreads in the corners, proteans from Deep
//     Blue on one side, pair stacks, the wave across the split and light-party stacks.
//   - Double Alley-oop: proteans with spreads on the markers, Pyrotation round Red Hot and Deep Impact.
// Simplified: one boss model; the steam along Flame Floater's split line (its fire is a row of balls in the game) is
// left out; where wtfdig gives no diagram, layouts are this script's own, made to satisfy BossMod's shapes.
(function (B) {
  const S = B.SLOTS;
  const all = (f) => Object.fromEntries(S.map(s => [s, f(s)]));
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
  // A point turned clockwise by d degrees round the middle.
  const rot = (p, d) => { const a = d * Math.PI / 180, c = Math.cos(a), s = Math.sin(a); return [p[0] * c + p[1] * s, -p[0] * s + p[1] * c]; };
  const G1 = ['MT', 'H1', 'M1', 'R1'], G2 = ['OT', 'H2', 'M2', 'R2'];
  const ROLE = (s) => ({ tank: 'T', healer: 'H', melee: 'M', ranged: 'R' })[B.SLOT_ROLE[s]];
  const ofRole = (grp, r) => grp.find(s => ROLE(s) === r);
  const COMPASS = ['north', 'north-northeast', 'northeast', 'east-northeast', 'east', 'east-southeast', 'southeast', 'south-southeast',
    'south', 'south-southwest', 'southwest', 'west-southwest', 'west', 'west-northwest', 'northwest', 'north-northwest'];
  const dirName = (deg) => COMPASS[Math.round(deg360(deg) / 22.5) % 16];
  const ORD = ['1st', '2nd', '3rd', '4th'];

  // ---------- the floor ----------
  const onSq = (p) => Math.abs(p[0]) <= 18.7 && Math.abs(p[1]) <= 18.7;
  const onCirc = (p) => Math.hypot(p[0], p[1]) <= 18.4;

  // n points near `want` clear of every shape in hs (by m and a little), on the floor (ok), gap apart.
  function clump(hs, want, n, ok, o) {
    o = o || {};
    const m = o.m === undefined ? 1.3 : o.m, gap = o.gap || 0.55;
    const good = (p) => ok(p) && hs.every(h => !inside(h, p, m));
    const out = [];
    if (good(want)) out.push(want.slice());
    for (let r = 0.3; r <= (o.reach || 16) && out.length < n; r += 0.3) {
      const k = Math.max(6, Math.round(2 * Math.PI * r / 0.3));
      for (let j = 0; j < k && out.length < n; j++) {
        const a = (j / k) * 2 * Math.PI, p = [want[0] + Math.sin(a) * r, want[1] + Math.cos(a) * r];
        if (good(p) && out.every(q => dist(q, p) >= gap)) out.push(p);
      }
    }
    while (out.length < n) out.push((out[0] || want).slice());
    return out.map(p => [+p[0].toFixed(2), +p[1].toFixed(2)]);
  }
  const assign = (slots, pts) => Object.fromEntries(slots.map((s, i) => [s, pts[i]]));
  // Each spot nearest its want, clear of hs (by m), gap from those placed before it (spreads), on the floor.
  function place(wants, hs, o) {
    o = o || {};
    const m = o.m === undefined ? 1.4 : o.m, gap = o.gap || 6.3, ok = o.ok || onSq, out = {};
    // (With o.to, the walk from each spot on to that point keeps clear of o.walk's shapes, and what's left of it once
    // o.late yalms are walked (the puddles have come alive) keeps 5.5 from every other spot.)
    const segDist = (q, a, b) => { const ab = sub(b, a), l2 = ab[0] * ab[0] + ab[1] * ab[1], u = l2 ? Math.max(0, Math.min(1, ((q[0] - a[0]) * ab[0] + (q[1] - a[1]) * ab[1]) / l2)) : 0; return dist(q, add(a, mul(ab, u))); };
    const lateEnd = (q) => { const d = dist(q, o.to), k = Math.max(0, d - o.late + 0.5) / Math.max(d, 1e-6); return add(o.to, mul(sub(q, o.to), k)); };
    const clear = (p) => {
      if (!o.to) return true;
      const n = Math.ceil(dist(p, o.to) / 0.5);
      for (let k = 1; k < n; k++) { const q = add(p, mul(sub(o.to, p), k / n)); if (o.walk.some(h => inside(h, q, 0.4))) return false; }
      return Object.values(out).every(q => segDist(q, o.to, lateEnd(p)) >= 5.5 && segDist(p, o.to, lateEnd(q)) >= 5.5);
    };
    for (const [s, w] of Object.entries(wants)) {
      const good = (p) => ok(p) && hs.every(h => !inside(h, p, m)) && Object.values(out).every(q => dist(q, p) >= gap) && clear(p);
      let best = good(w) ? w : null;
      for (let r = 0.3; r <= 16 && !best; r += 0.3) {
        const n = Math.max(8, Math.round(2 * Math.PI * r / 0.3));
        for (let j = 0; j < n; j++) {
          const a = j / n * 2 * Math.PI, p = [w[0] + Math.sin(a) * r, w[1] + Math.cos(a) * r];
          if (good(p)) { best = p; break; }
        }
      }
      if (!best && B.M10S_DEBUG) B.M10S_DEBUG(`place: no spot for ${s} near ${w}`);
      out[s] = (best || w).map(v => +v.toFixed(2));
    }
    return out;
  }

  // ---------- the party's places ----------
  // Uptime: the tanks at the boss's front (it faces `face`), everyone else at its back (its hitbox is 4).
  const HUG = { MT: [-0.8, 4.6], OT: [0.8, 4.6], M1: [-1.8, -4.4], M2: [1.8, -4.4], H1: [-4.2, -5.4], H2: [4.2, -5.4], R1: [-2.4, -7], R2: [2.4, -7] };
  const hug = (b, face) => all(s => add(b, rot(HUG[s], face || 0)));

  // Flame Floater, drawn for Red Hot starting on the north wall (the layouts turn with her): the baits in order, where
  // the party waits, where she's pulled for the spreads (the party's stack spot after), and where she's held for
  // Cutback Blaze (its safe slice runs from her away from the stack).
  const FLOAT = {
    // Toxic: 1st the corner counterclockwise of her, 2nd that wall, 3rd back in the corner, 4th back by the start.
    toxic: { start: [0, 19.5], b: [[-18.6, 18.6], [-18.6, -2.6], [-13.4, 13.6], [3, 15]], wait: [5, 1], inferno: [-3.5, 3.5], cut: [0, 0] },
    // OCE: 1st the corner, 2nd back at her start, 3rd beside the wall's fire, 4th back by the start, next to the fire.
    oce: { start: [0, 19.5], b: [[-18.6, 18.6], [1, 18.6], [17.5, 10.5], [0, 12.2]], wait: [2, -6], inferno: [-3.5, 3.5], cut: [0, 0] },
  };
  // The inferno's spreads: melee close round Red Hot, ranged far (OCE: on the walls, off their middles).
  const INFERNO_FAR = {
    toxic: { H1: [-15, -7], H2: [11, 4], R1: [-7, -17], R2: [16, -2] },
    oce: { H1: [-8, -12], H2: [12, 3], R1: [-18.5, -4], R2: [-15, -11] },
  };
  // Insane Air: Red Hot's boards from the south-east, Deep Blue's from the north-west, both clockwise round the ring.
  const RED_PATH = [[0, -13], [-13, -13], [-13, 0]], BLUE_PATH = [[0, 13], [13, 13], [13, 0]];

  // Insane Air: a group's spots round its board (sp) for its mechanic, facing out along om: proteans spread M T H R
  // clockwise, 30 degrees apart; a stack bunched in the cone on its target; a buster's target alone in front, the rest
  // well back.
  const AIR_ORDER = ['M', 'T', 'H', 'R'];
  function airSpots(sp, om, mech, grp, tgt) {
    const out = {};
    if (mech === 'P') grp.forEach(s => { out[s] = add(sp, at(om - 45 + 30 * AIR_ORDER.indexOf(ROLE(s)), 3.6)); });
    else {
      out[tgt] = add(sp, at(om, 2.4));
      grp.filter(s => s !== tgt).forEach((s, i) => {
        out[s] = mech === 'S' ? add(sp, at(om + [-9, 9, 0][i], [4, 4, 5][i])) : add(sp, at(om + 180 + [-28, 28, 0][i], [7.6, 7.6, 9][i]));
      });
    }
    for (const s of Object.keys(out)) out[s] = out[s].map(v => +v.toFixed(2));
    return out;
  }
  function airShapes(sp, mech, spots, grp, tgt) {
    if (mech === 'P') return grp.map(s => ({ shape: 'cone', at: sp, deg: brg(sub(spots[s], sp)), half: 22.5, r: 60 }));
    if (mech === 'S') return [{ shape: 'cone', at: sp, deg: brg(sub(spots[tgt], sp)), half: 22.5, r: 60 }];
    return [{ shape: 'circle', at: spots[tgt], r: 6 }];
  }
  const AIR_NAME = { P: ['Blasting Snap', 'Plunging Snap'], S: ['Re-entry Blast', 'Re-entry Plunge'], TB: ['Vertical Blast', 'Vertical Plunge'] };
  const AIR_CALL = { P: 'Proteans', S: 'Stack', TB: 'Buster' };

  // Each strat's choices (wtfdig's toggles and its strats' own text).
  const STRATS = {
    toxic: { floater: 'toxic', snaking: 'toxic', air2: 'toxic', lastTB: 'MT' },
    hector: { floater: 'toxic', snaking: 'nomnom', air2: 'toxic', lastTB: 'MT' },
    oce: { floater: 'oce', snaking: 'oce', air2: 'oce', lastTB: 'OT' },
  };

  // ---------- the pull ----------
  function plan(events, strat) {
    const st = STRATS[strat] || STRATS.toxic;
    const P = { start: hug([0, 0], 0), prefs: [], hazards: [], checks: [], calls: [], marks: [], labels: new Map(), debuffs: [],
      boss: [{ t: 0, at: [0, 0] }], hitbox: [{ t: 0, r: 4 }],
      // Red Hot's orange lights while she's out alone, Deep Blue's blue, then both.
      looks: [{ t: 0, show: ['a1_art98', 'a1_cei03'] }, { t: 88.8, show: ['a1_art99', 'a1_cei03'] }, { t: 151.6, show: ['a1_art98', 'a1_art99', 'a1_cei03'] }] };
    let id = 0;
    const hz = (o) => { const h = Object.assign({ id: ++id, react: 3 }, o); P.hazards.push(h); return h; };
    const pref = (t, spots) => P.prefs.push({ t, spots });
    const call = (t, text, o) => P.calls.push(Object.assign({ t, text }, o));
    const check = (o) => P.checks.push(o);
    const debuff = (slot, key, name, hint, t0, t1) => P.debuffs.push({ slot, key, name, hint, t0, t1 });
    const bossTo = (t, p, move) => P.boss.push({ t, at: p, move });
    // Deep Blue (the zone's `blue` model, beside Red Hot: plan.others), where she stands, the same spots her attacks come from.
    const BP = [{ t: 0, at: [0, 0] }], blueTo = (t, p, move) => BP.push({ t, at: p, move });
    const E = (name) => events.filter(e => e.name === name);
    const T = (name, k, def) => { const e = E(name)[k || 0]; return e ? e.t : def; };
    const label = (name, k, text) => { const e = E(name)[k || 0]; if (e) P.labels.set(e, text); };
    const raid = (t, dmg, name, cast) => hz({ t, tell: t - (cast || 4), raidwide: true, dmg, name });
    // The fire on the floor, as planned (for placing spots clear of it, and for the steam): {shape, t0, t1, steam}.
    const fires = [];
    const fire = (shape, t0, t1, steam) => fires.push({ shape, t0, t1, steam: !!steam });
    const fireIn = (a, b) => fires.filter(f => f.t0 < b && a < f.t1).map(f => f.shape);
    // A puddle where an attack lands: it locks in with the attack and burns from 2.4 s later (BossMod's FlamePuddle:
    // it spawns and goes live 1.2 s apart) till t1, hurting whoever's in it every second.
    // (`react` 0: the bots keep clear of puddles by their spots alone, as so many puddles ticking out of step would
    // have them stop for each one; the guide still shows you the way out.)
    const puddle = (o, tHit, t1, name) => hz(Object.assign({ dmg: 0.8, tickDmg: 0.6, tick: 1 }, o,
      { t: tHit + 2.4, tell: tHit, snap: 2.43, react: 0, lasts: Math.max(0.5, t1 - tHit - 2.4), name: name || 'Fire' }));
    // Steam Burst: water landing on a round fire puddle sets it off, 9 yalms round it 4.4 s later.
    const steam = (tw, shapes) => {
      for (const f of fires) {
        if (!f.steam || f.t0 - 1.2 > tw || f.t1 <= tw) continue;
        if (shapes.some(s => inside(s, f.shape.at, 0))) hz({ t: tw + 4.4, tell: tw + 1.4, shape: 'circle', at: f.shape.at, r: 9, dmg: 0.7, name: 'Steam Burst', react: 1.5 });
      }
    };
    // Proteans from Deep Blue at o, at each target (30-degree cones), then their repeat: Double-dip the same cones
    // again (locked where everyone stood), Reverse the gaps either side of each (at the spots planned).
    const alleyOop = (o, targets, spots, t1, t2, double, name) => {
      hz({ t: t1, tell: t1 - 5.6, effect: 'bait', shape: 'cone', from: o, aim: 'target', targets, half: 15, r: 60, dmg: 1, own: 0.15, name });
      const first = targets.map(s => ({ shape: 'cone', at: o, deg: brg(sub(spots[s], o)), half: 15, r: 60 })), rep = [];
      if (double) hz({ t: t2, tell: t1, shape: 'cone', from: o, aim: 'target', targets, half: 15, r: 60, snap: t2 - t1 + 0.03, react: 0, dmg: 1, name: `${name} (repeat)` });
      else {
        for (const s of targets) for (const k of [-22.5, 22.5]) {
          const c = { shape: 'cone', at: o, deg: brg(sub(spots[s], o)) + k, half: 7.5, r: 60 };
          rep.push(c);
          hz(Object.assign({ t: t2, tell: t1, effect: 'bait', owner: s, dmg: 1, own: 0.15, name: `${name} (repeat)` }, c));
        }
      }
      return { first, repeat: double ? first : rep };
    };
    // Sick Swell and Sickest Take-off: the wave throws everyone 10 yalms its way while a 15-wide line runs along it.
    const wave = (t, from, off) => {
      const kb = deg360(from + 180), line = { shape: 'line', at: add(at(from, 25), at(from + 90, off)), deg: kb, len: 50, w: 15 };
      hz({ t, tell: t - 7, effect: 'knockback', dir: kb, dist: 10, name: 'Sick Swell' });
      hz(Object.assign({ t, tell: t - 7, dmg: 1.2, name: 'Sickest Take-off' }, line));
      return { kb, line, v: at(kb, 10) };
    };
    // Spots for a knockback: each near its want after being thrown (post), and where it stands to land there (pre),
    // both clear of their shapes and the slide between clear of hsPost; posts gap apart (or gapOf(s, t) for a pair).
    const placeKB = (wants, v, hsPre, hsPost, gap, gapOf) => {
      const out = {}, post = {};
      const slideOk = (q) => { for (let k = 1; k < 10; k++) { const p = add(q, mul(v, k / 10)); if (hsPost.some(h => inside(h, p, 0.4))) return false; } return true; };
      for (const [s, w] of Object.entries(wants)) {
        // (Failing that, a little closer to the fire and to each other.)
        const good = (q, k) => onSq(q) && onSq(add(q, v)) && hsPre.every(h => !inside(h, q, 0.9 * k)) && hsPost.every(h => !inside(h, add(q, v), 0.9 * k))
          && Object.entries(post).every(([t, p]) => dist(p, add(q, v)) >= (gapOf ? gapOf(s, t) : gap) * (k < 1 ? 0.93 : 1)) && slideOk(q);
        const w0 = sub(w, v);
        let best = null;
        for (const k of [1, 0.5]) {
          if (!best && good(w0, k)) best = w0;
          for (let r = 0.3; r <= 30 && !best; r += 0.3) {
            const n = Math.max(8, Math.round(2 * Math.PI * r / 0.3));
            for (let j = 0; j < n; j++) { const a = j / n * 2 * Math.PI, q = [w0[0] + Math.sin(a) * r, w0[1] + Math.cos(a) * r]; if (good(q, k)) { best = q; break; } }
          }
        }
        if (!best && B.M10S_DEBUG) B.M10S_DEBUG(`placeKB: no spot for ${s} near ${w}`);
        best = best || w0;
        out[s] = best.map(x => +x.toFixed(2));
        post[s] = add(best, v).map(x => +x.toFixed(2));
      }
      return { pre: out, post };
    };
    const spread = (t, targets, r, name, o) => hz(Object.assign({ t, tell: t - 5, effect: 'bait', shape: 'circle', from: 'target', targets, r, dmg: 0.9, own: 0.3, name }, o));
    const stack = (t, targets, r, min, max, name, o) => hz(Object.assign({ t, tell: t - 5, effect: 'share', shape: 'circle', from: 'target', targets, r, min, max, dmg: 0.35, name }, o));
    const buster = (t, slot, r, name, o) => hz(Object.assign({ t, tell: t - 5, effect: 'bait', shape: 'circle', from: 'target', targets: [slot], r, dmg: 1.2, own: 0.5, buster: true, name }, o));
    // Deep Impact's throw: the buster's target, 10 yalms away from Deep Blue (a thin line from her to them).
    const throwOff = (t, o, slot) => hz({ t, tell: t, hidden: true, quiet: true, effect: 'knockback', from: o, aim: 'target', targets: [slot], shape: 'line', len: 'target', w: 1.2, dist: 10, name: 'Deep Impact' });
    const divers = (k, one) => { const t = one === 1 ? T("Divers' Dare", k) : T("Divers' Dare x2", k); if (t !== undefined) { raid(t, 0.45, "Divers' Dare", 5); call(t - 5, 'Raidwide', { dur: 3 }); } return t; };
    for (const e of E('Epic Brotherhood x2')) P.labels.set(e, 'Epic Brotherhood (they even out their HP)');
    for (const e of E('Impact Zone').concat(E('Impact Zone x2'))) P.labels.set(e, `${e.name} (only if the bubble's prisoners fall)`);

    // ======================================================== Red Hot alone ========================================
    const R0 = [0, 0];
    pref(0, hug(R0, 0));
    const tHI = T('Hot Impact', 0, 14.6);
    pref(tHI - 5, Object.assign(hug(R0, 0), { MT: [-0.7, 4.7], OT: [0.7, 4.7] }));
    stack(tHI, ['MT'], 6, 2, 2, 'Hot Impact', { dmg: 0.45 });
    call(tHI - 5, 'Shared tankbuster', { dur: 4 });

    // ----- Flame Floater -----
    const p1End = T("Divers' Dare", 0, 82.5) + 6.3;             // 88.8: Red Hot leaves, and her fire with her
    const tf = [1, 2, 3, 4].map(k => T(`Flame Floater ${k}`, 0, 27 + 3.2 * k));
    const tFCast = tf[0] - 7, th0 = pick([0, 90, 180, 270]), Ff = (p) => rot(p, th0), FL = FLOAT[st.floater] || FLOAT.toxic;
    const red0 = Ff(FL.start), bspot = FL.b.map(Ff), baiters = shuffle(S).slice(0, 4);
    bossTo(tf[0] - 9.6, red0);
    const lines = [], marks = [];
    let origin = red0;
    for (let k = 0; k < 4; k++) {
      const s = baiters[k], line = { shape: 'line', at: origin, deg: brg(sub(bspot[k], origin)), len: 60, w: 8 };
      lines.push(line);
      fire(line, tf[k] + 2.4, p1End);
      // Each line from where the one before landed (its target's spot as it went off), at this bait as it goes off.
      const chain = k ? { from: 'target', after: marks[k - 1], move: 0 } : { from: 'boss' };
      hz(Object.assign({ t: tf[k], tell: k ? tf[k - 1] : tFCast, effect: 'bait', shape: 'line', aim: 'target', targets: [s], len: 60, w: 8,
        dmg: 1.1, own: 0.25, status: ['fireResDown', 12], tether: 'boss', stretch: 16, name: 'Flame Floater' }, chain));
      puddle(Object.assign({ shape: 'line', aim: 'target', targets: [s], len: 60, w: 8 }, chain), tf[k], p1End, 'Flame Floater (fire)');
      marks.push(hz({ t: tf[k], tell: tf[k], from: 'target', targets: [s], hidden: true, quiet: true, name: 'Flame Floater' }));
      bossTo(tf[k] + 0.1, bspot[k], 0.3);
      origin = bspot[k];
    }
    const waitSpots = assign(S, clump(lines, Ff(FL.wait), 8, onSq, { gap: 0.6, m: 1.6 }));
    pref(tFCast, waitSpots);
    const BAIT_AT = st.floater === 'oce' ? ['the corner counterclockwise', 'back at her start', 'beside the wall\'s fire', 'back by her start, next to the fire']
      : ['the corner counterclockwise', 'down that wall', 'back in the corner', 'back by her start'];
    baiters.forEach((s, k) => {
      const go = Math.max(tFCast + 0.5, tf[k] - dist(waitSpots[s], bspot[k]) / 5.6 - 0.8);
      pref(go, { [s]: bspot[k] });
      pref(tf[k] + 0.05, { [s]: waitSpots[s] });
      const key = ['firstInLine', 'secondInLine', 'thirdInLine', 'fourthInLine'][k];
      debuff(s, key, ['First', 'Second', 'Third', 'Fourth'][k] + ' in Line', `bait ${ORD[k]}: ${BAIT_AT[k]}`, tFCast + 0.2 + 2 * k, tf[k]);
      debuff(s, 'fireResDown', 'Fire Resistance Down II', 'keep out of fire', tf[k], tf[3] + 3.5);
      call(tFCast + 0.2 + 2 * k, `${ORD[k]} bait: ${BAIT_AT[k]} (${dirName(brg(bspot[k]))}); stretch the tether`, { slot: s, alert: true, dur: 5 });
    });
    call(tFCast, `Flame Floater: she starts ${dirName(th0)}`, { dur: 5 });

    // ----- Alley-oop Inferno, Cutback Blaze, Pyrotation -----
    // She's pulled to RI for the spreads (all within a couple of seconds' run of her: melee close, ranged further), the
    // party stacks there as she's pulled on to RC, and Cutback Blaze aims at the stack: its safe slice runs from her
    // away from them, and Pyrotation's three stacks walk out along it (each a step past the last before it burns).
    const tInf = T('Alley-oop Inferno', 1, 53.1), tCut = T('Cutback Blaze', 1, 62.8), tPy = T('Pyrotation x3', 0, 68.4);
    const RC = Ff(FL.cut), delta = brg(sub(RC, Ff(FL.inferno))), RI = add(RC, at(delta + 180, 4.9));
    let dmax = 0;
    while (onSq(add(RC, at(delta, dmax + 0.2)))) dmax += 0.2;
    const restD = Math.min(25, dmax - 0.6), dPy = [restD - 17, restD - 11.8, restD - 6.6], slicePt = (d) => add(RC, at(delta, d));
    bossTo(tf[3] + 4, RI, 4);
    bossTo(tInf + 0.3, RC, 3);
    const keep = [{ shape: 'circle', at: RI, r: 7.6 }, { shape: 'circle', at: RC, r: 5.5 }, ...dPy.concat([restD]).map(d => ({ shape: 'circle', at: slicePt(d), r: 6.8 }))];
    const far = INFERNO_FAR[st.floater] || INFERNO_FAR.toxic;
    const infWant = Object.assign({}, ...['MT', 'OT', 'M1', 'M2'].map((s, i) => ({ [s]: add(RI, at(delta + 180 + [-45, 45, -100, 100][i], 8.2)) })),
      ...Object.entries(far).map(([s, p]) => ({ [s]: Ff(p) })));
    const infSpots = place(infWant, lines.concat(keep), { gap: 6, to: RI, walk: lines, late: 13.4, ok: (p) => onSq(p) && dist(p, RI) <= 17 });
    pref(tInf - 5, infSpots);
    spread(tInf, S, 5, 'Alley-oop Inferno');
    for (const s of S) {
      puddle({ shape: 'circle', r: 5, from: 'target', targets: [s] }, tInf, p1End, 'Alley-oop Inferno (fire)');
      fire({ shape: 'circle', at: infSpots[s], r: 5 }, tInf + 2.4, p1End, true);
    }
    call(tInf - 5, 'Spread: melee close, ranged far', { alert: true, dur: 5 });
    pref(tInf + 0.05, assign(S, clump(fireIn(tInf, tCut + 0.5), RI, 8, onSq, { gap: 0.5 })));
    call(tInf + 0.3, 'Stack between her and the fire', { dur: 4 });
    // Cutback Blaze: everyone in the stack takes it; then into the slice before its fire comes alive.
    raid(tCut, 0.3, 'Cutback Blaze', 5.2);
    hz({ t: tCut, tell: tCut - 5.2, shape: 'cone', from: 'boss', aim: 'target', targets: { farthest: 1 }, half: 165, r: 60, dmg: 0, quiet: true, name: 'Cutback Blaze' });
    puddle({ shape: 'cone', from: 'boss', aim: 'target', targets: { farthest: 1 }, half: 165, r: 60 }, tCut, p1End, 'Cutback Blaze (fire)');
    fire({ shape: 'cone', at: RC, deg: deg360(delta + 180), half: 165, r: 60 }, tCut + 2.4, p1End);
    call(tCut + 0.05, `Into the slice behind her (${dirName(delta)})`, { alert: true, dur: 4 });
    const X1 = pick(S), ph = [0.9, 2.9, 4.9].map(d => tPy + d);
    ph.forEach((t, k) => {
      // (The last puddle comes alive 0.4 s after this stack: just clear of its middle, and on at once.)
      const sp = slicePt(dPy[k]), prev = k ? slicePt(dPy[k - 1]) : null, hs = fireIn(t - 1, t + 0.3);
      const pts = clump(hs, sp, 8, (p) => onSq(p) && dist(p, sp) <= 3.6 && (!prev || dist(p, prev) >= 4.9), { gap: 0.45, m: k ? 0.5 : 1.2 });
      pref(k ? ph[k - 1] + 0.05 : tCut + 0.05, Object.assign(assign(S.filter(s => s !== X1), pts.slice(1)), { [X1]: pts[0] }));
      stack(t, [X1], 6, 6, 8, 'Pyrotation', { tell: k ? ph[k - 1] : tPy - 4.3, dmg: 0.3 });
      puddle({ shape: 'circle', r: 6, from: 'target', targets: [X1] }, t, p1End, 'Pyrotation (fire)');
      fire({ shape: 'circle', at: sp, r: 6 }, t + 2.4, p1End, true);
    });
    pref(ph[2] + 0.05, assign(S, clump(fireIn(ph[2], p1End), slicePt(restD), 8, (p) => onSq(p) && dist(p, slicePt(restD)) <= 4.5, { gap: 0.5, m: 0.5 })));
    bossTo(ph[2] + 0.4, slicePt(restD - 4.6), 4);
    call(tPy - 4.3, `Stack x3 on ${X1}: walk out along the slice`, { alert: true, dur: 8 });
    divers(0, 1);

    // ======================================================== Deep Blue alone =======================================
    const B0 = [0, 0];
    bossTo(p1End, B0);
    pref(p1End + 0.05, hug(B0, 0));
    // ----- Sick Swell and Sickest Take-off, then Awesome Splash (spreads) or Slab (light parties) -----
    // Drawn for the wave from the north: everyone thrown 10 south, clear of the line, G1 on the left facing her (west).
    const tW1 = T('Sick Swell', 1, 115.0), tSp1 = T('Awesome Splash/Awesome Slab', 0, 117.5);
    const from1 = pick([0, 90, 180, 270]), off1 = pick([-15, 0, 15]), Fw1 = (p) => rot(p, from1);
    wave(tW1, from1, off1);
    const cx1 = off1 === 0 ? [-13, 13] : off1 > 0 ? [-14, -1] : [1, 14], splash1 = Math.random() < 0.5;
    const post1 = {};
    [G1, G2].forEach((g, i) => g.forEach(s => {
      const c = [cx1[i], -6.3];
      post1[s] = splash1 ? add(c, { T: [-3.3, 3.3], M: [3.3, 3.3], H: [-3.3, -3.3], R: [3.3, -3.3] }[ROLE(s)])
        : add(c, { T: [0, 0.9], M: [0.8, -0.5], H: [0, 0], R: [-0.8, -0.5] }[ROLE(s)]);
    }));
    pref(tW1 - 7, all(s => Fw1(add(post1[s], [0, 10]))));
    pref(tW1 + 0.6, all(s => Fw1(post1[s])));
    if (splash1) spread(tSp1, S, 5, 'Awesome Splash', { tell: tW1 - 2, own: 0.25 });
    else stack(tSp1, ['H1', 'H2'], 6, 4, 4, 'Awesome Slab', { tell: tW1 - 2 });
    label('Awesome Splash/Awesome Slab', 0, splash1 ? 'Awesome Splash (spreads)' : 'Awesome Slab (light parties)');
    const side = (from, off) => (off === 0 ? 'down the middle' : `by the ${dirName(from + (off > 0 ? 90 : -90))} wall`);
    call(tW1 - 7, `Knockback from the ${dirName(from1)}; the line ${side(from1, off1)}`, { alert: true, dur: 6 });
    call(tW1 - 2.5, splash1 ? 'Spread: G1 left, G2 right' : 'Light parties: G1 left, G2 right', { dur: 4 });
    // ----- Alley-oop: proteans round her, by the clock (tanks north and south) -----
    const AO = E('Reverse Alley-oop/Alley-oop Double-dip'), aoT = (k, d) => (AO[k] ? AO[k].t : d);
    const CLOCK = { MT: 0, OT: 180, H1: 270, H2: 90, M1: 225, M2: 135, R1: 315, R2: 45 };
    const dbl1 = Math.random() < 0.5, aoName = (dbl) => (dbl ? 'Alley-oop Double-dip' : 'Reverse Alley-oop');
    const clock = all(s => add(B0, at(CLOCK[s], 5.5)));
    pref(tSp1 + 0.05, clock);
    alleyOop(B0, S, clock, aoT(0, 125.9), aoT(1, 128.5), dbl1, aoName(dbl1));
    if (dbl1) pref(aoT(0, 125.9) + 0.05, all(s => add(B0, at(CLOCK[s] + 22.5, 5.5))));
    [0, 1].forEach(k => { if (AO[k]) P.labels.set(AO[k], aoName(dbl1) + (k ? ' (repeat)' : '')); });
    call(aoT(0, 125.9) - 5.6, `Proteans => ${dbl1 ? 'move' : 'stay'}`, { alert: true, dur: 5 });
    // ----- Deep Impact: a buster on the farthest, thrown back -----
    const tDI1 = T('Deep Impact', 0, 136.5), tDIc1 = T('Deep Impact (bait)', 0, 136.3) - 4.9;
    pref(tDIc1, Object.assign(hug(B0, 0), { MT: add(B0, [0, 15]) }));
    buster(tDI1, 'MT', 6, 'Deep Impact', { tell: tDIc1 });
    throwOff(tDI1, B0, 'MT');
    pref(tDI1 + 0.6, hug(B0, 0));
    call(tDIc1, 'Bait the knockback buster far', { slot: 'MT', alert: true, dur: 5 });
    call(tDIc1, 'Tankbuster on the farthest: stay close', { dur: 4 });
    divers(1, 1);

    // ======================================================== Xtreme Spectacular ====================================
    bossTo(150.6, [5, 0]);
    blueTo(149.6, [-5, 0]);
    pref(151, hug([5, 0], 0));
    const tXS = T('Xtreme Spectacular (line)', 0, 168.7), band = { shape: 'rect', a: [-25, -15], b: [25, 15] };
    hz(Object.assign({ t: tXS, tell: tXS - 7.4, dmg: 1.3, name: 'Xtreme Spectacular' }, band));
    raid(tXS, 0.25, 'Xtreme Spectacular', 7.4);
    for (let k = 0; k < 6; k++) raid(T('Xtreme Spectacular x6', 0, 169.7) + 0.6 * k, 0.06, 'Xtreme Spectacular', 0.5);
    raid(T('Xtreme Spectacular (big)', 0, 173.6), 0.5, 'Xtreme Spectacular', 1);
    pref(tXS - 7.4, assign(S, clump([band], [0, -17.4], 8, (p) => onSq(p) && p[1] <= -16.2, { gap: 0.7, m: 1.2 })));
    call(tXS - 7.4, 'Go N/S + big raidwides', { alert: true, dur: 6 });


    // ======================================================== Insane Air ============================================
    // Each round both bosses leap onto their next board and bait the four nearest it; Red Hot's leave fire. The groups'
    // facing round each board is picked (out toward the wall where it can be) so nobody stands in fire or in the
    // other board's attack, and Red Hot's new fire keeps off the boards still to come.
    // Walks clear of the fire on the floor: straight where it can, else by the nearest waypoint from which both legs
    // are (the fire that comes alive later counts only past dLater yalms in).
    const pathClear = (pts, now, later, dLater) => {
      let cum = 0;
      for (let i = 1; i < pts.length; i++) {
        const a = pts[i - 1], b = pts[i], d = dist(a, b), n = Math.max(1, Math.ceil(d / 0.5));
        for (let k = 1; k <= n; k++) {
          const q = add(a, mul(sub(b, a), k / n)), c = cum + d * k / n;
          if (now.some(h => inside(h, q, 0.5)) || (c > dLater && later.some(h => inside(h, q, 0.5)))) return false;
        }
        cum += d;
      }
      return true;
    };
    const walkTo = (from, to, t0, dLater) => {
      const now = fireIn(t0 - 0.05, t0 + 0.05), later = fireIn(t0, t0 + 4);
      for (const [s, b] of Object.entries(to)) {
        const a = from[s];
        if (!a || pathClear([a, b], now, later, dLater)) { pref(t0, { [s]: b }); continue; }
        const mid = mul(add(a, b), 0.5);
        let best = null, bd = Infinity;
        for (let r = 1; r <= 18 && !best; r += 1) for (let j = 0; j < 24; j++) {
          const w = add(mid, at(j * 15, r));
          if (!onSq(w) || !pathClear([a, w, b], now, later, dLater)) continue;
          const d = dist(a, w) + dist(w, b);
          if (d < bd) { bd = d; best = w; }
        }
        if (!best) { pref(t0, { [s]: b }); continue; }
        pref(t0, { [s]: best.map(v => +v.toFixed(2)) });
        pref(t0 + dist(a, best) / 5.8 + 0.15, { [s]: b });
      }
    };
    const insaneAir = (cfg) => {
      const redMid = Math.random() < 0.5;
      const rp = RED_PATH.concat([redMid ? [0, 0] : [-13, 13]]), bp = BLUE_PATH.concat([redMid ? [13, -13] : [0, 0]]), boards = { red: rp, blue: bp };
      const plans = [];
      for (let k = 0; k < 4; k++) {
        const fut = [];
        for (let j = k + 1; j < 4; j++) fut.push(rp[j], bp[j]);
        const cur = fireIn(k ? cfg.hits[k - 1] : cfg.tells[0], cfg.hits[k] + (cfg.bails ? 1.7 : 0.3)), opts = {};
        for (const c of ['red', 'blue']) {
          const sp = boards[c][k], other = boards[c === 'red' ? 'blue' : 'red'][k];
          const out = Math.hypot(sp[0], sp[1]) < 1 ? brg(sub(sp, other)) : brg(sp);
          const m = cfg.mech(k, c), grp = cfg.group(k, c), tgt = cfg.target(k, c, m, grp);
          opts[c] = [0, 1, -1, 2, -2, 3, -3, 4, -4].map(j => {
            const spots = airSpots(sp, out + 22.5 * j, m, grp, tgt);
            return { j, spots, shapes: airShapes(sp, m, spots, grp, tgt), sp, m, grp, tgt };
          });
        }
        let best = null;
        for (const r of opts.red) for (const b of opts.blue) {
          let bad = (Math.abs(r.j) + Math.abs(b.j)) * 0.01;
          for (const [o, q] of [[r, b], [b, r]]) for (const p of Object.values(o.spots)) {
            if (!onSq(p)) bad += 10;
            if (cur.some(h => inside(h, p, 1.4))) bad += 10;
            if (q.shapes.some(h => inside(h, p, 1))) bad += 10;
          }
          for (const sh of r.shapes) for (const f of fut) if (inside(sh, f, 4.5)) bad += 3;
          // (The Bailout stacks after: the two groups well apart.)
          if (cfg.bails) for (const p of Object.values(r.spots)) for (const q of Object.values(b.spots)) if (dist(p, q) < 16.8) bad += 6;
          if (!best || bad < best.bad) best = { bad, r, b };
        }
        if (B.M10S_DEBUG && best.bad >= 1) B.M10S_DEBUG(`insane air round ${k}: ${best.bad.toFixed(2)}`);
        plans.push(best);
        for (const sh of best.r.shapes) fire(sh, cfg.hits[k] + 2.4, cfg.end, sh.shape === 'circle');
      }
      let last = null;
      plans.forEach(({ r, b }, k) => {
        const t = cfg.hits[k], tell = cfg.tells[k];
        for (const o of [r, b]) {
          const red = o === r, name = AIR_NAME[o.m][red ? 0 : 1], near = (n) => ({ nearest: n, of: o.sp });
          if (o.m === 'P') {
            hz({ t, tell, effect: 'bait', shape: 'cone', from: o.sp, aim: 'target', targets: near(4), half: 22.5, r: 60, dmg: 1, own: 0.2, name });
            if (red) puddle({ shape: 'cone', from: o.sp, aim: 'target', targets: near(4), half: 22.5, r: 60 }, t, cfg.end, `${name} (fire)`);
          } else if (o.m === 'S') {
            hz({ t, tell, effect: 'share', shape: 'cone', from: o.sp, aim: 'target', targets: near(1), half: 22.5, r: 60, min: 4, max: 4, dmg: 0.35, name });
            if (red) puddle({ shape: 'cone', from: o.sp, aim: 'target', targets: near(1), half: 22.5, r: 60 }, t, cfg.end, `${name} (fire)`);
          } else {
            hz({ t, tell, effect: 'bait', shape: 'circle', from: 'target', targets: near(1), r: 6, dmg: 1.2, own: 0.5, buster: true, name });
            if (red) puddle({ shape: 'circle', r: 6, from: 'target', targets: near(1) }, t, cfg.end, `${name} (fire)`);
          }
        }
        bossTo(cfg.baits[k], rp[k], 0.5);
        const spots = Object.assign({}, r.spots, b.spots), t0 = k ? (cfg.bails ? cfg.bails[k - 1] : cfg.hits[k - 1]) + 0.05 : cfg.tells[0];
        if (last) walkTo(last, spots, t0, cfg.bails ? 0 : 13); else pref(t0, spots);
        last = spots;
        // (With a Bailout to share after, each group steps just clear of the new fire, keeping off the other group; a
        // buster's target to the back.)
        if (cfg.bails) {
          const burning = fireIn(t + 2.3, t + 2.5), esc = {};
          for (const [o, q] of [[r, b], [b, r]]) for (const s of o.grp) {
            const p = o.m === 'TB' && s === o.tgt ? add(o.spots[o.grp.filter(x => x !== o.tgt)[2]], [0.7, 0]) : o.spots[s];
            esc[s] = clump(burning, p, 1, (x) => onSq(x) && Object.values(q.spots).every(y => dist(x, y) >= 16), { m: 1.3 })[0];
          }
          pref(t + 0.05, esc);
          last = esc;
        }
        for (const list of [E('Blasting Snap/Plunging Snap/Re-entry Blast (bait)'), E('Blasting Snap/Plunging Snap/Re-entry Blast')]) {
          const e = list.find(x => Math.abs(x.t - t) < 2.5);
          if (e) P.labels.set(e, `${AIR_NAME[r.m][0]} + ${AIR_NAME[b.m][1]}`);
        }
        call(tell, cfg.call ? cfg.call(k, r, b) : `Red: ${AIR_CALL[r.m]} (${dirName(brg(rp[k]))}) / Blue: ${AIR_CALL[b.m]} (${dirName(brg(bp[k]))})`, { alert: true, dur: 6 });
      });
      return { plans, rp, bp, last };
    };
    // Everyone together for the raidwide after, clear of the fire left.
    const airGather = (tFrom, tEnd, near, from, dLater) => {
      const gp = clump(fireIn(tFrom, tEnd), near, 1, onSq, { m: 6 })[0], spots = assign(S, clump(fireIn(tFrom, tEnd), gp, 8, onSq, { gap: 0.6, m: 1.4 }));
      walkTo(from, spots, tFrom + 0.05, dLater);
      return gp;
    };

    // ----- Insane Air 1: G1 bait Deep Blue's boards (from the north-west), G2 Red Hot's (from the south-east) -----
    const airHits = E('Blasting Snap/Plunging Snap/Re-entry Blast').map(e => e.t), airBaits = E('Blasting Snap/Plunging Snap/Re-entry Blast (bait)').map(e => e.t);
    const ia1End = T("Divers' Dare x2", 0, 229.1);
    const fourMechs = () => { const tb = Math.floor(Math.random() * 4); return [0, 1, 2, 3].map(k => (k === tb ? 'TB' : Math.random() < 0.5 ? 'P' : 'S')); };
    const ia1Mech = { red: fourMechs(), blue: fourMechs() };
    pref(178.9, Object.assign(assign(G1, clump([], [-11, 11], 4, onSq, { gap: 0.8 })), assign(G2, clump([], [11, -11], 4, onSq, { gap: 0.8 }))));
    bossTo(186, [13, -13]);
    blueTo(186, [-13, 13]);
    const ia1 = insaneAir({ hits: airHits.slice(0, 4), baits: airBaits.slice(0, 4), tells: airHits.slice(0, 4).map(t => t - 8.6), end: ia1End,
      mech: (k, c) => ia1Mech[c][k], group: (k, c) => (c === 'red' ? G2 : G1), target: (k, c, m, g) => ofRole(g, m === 'TB' ? 'T' : 'H') });
    call(airHits[0] - 12, 'G1 north-west with Deep Blue, G2 south-east with Red Hot', { dur: 5 });
    const gp1 = airGather(airHits[3], ia1End, [0, 0], ia1.last, 13);
    bossTo(airHits[3] + 1.5, gp1, 3);
    ia1.bp.forEach((p, k) => blueTo(airBaits[k], p, 0.5));
    blueTo(airHits[3] + 1.5, add(gp1, [-4, 0]), 3);
    divers(0);


    // ======================================================== Snaking ===============================================
    // One light party gets Firesnaking (Red Hot's), the other Watersnaking (Deep Blue's): "G1 near Blue, G2 near Red",
    // and it can go on either the nearer or the farther four. Drawn for the wave coming from the north (Deep Varial
    // from the south wall), mirrored north-south when it comes from the south.
    const tSn = T('Firesnaking/Watersnaking', 0, 244.8), snEnd = T("Divers' Dare x2", 1, 320.5);
    raid(tSn, 0.45, 'Firesnaking + Watersnaking', 5);
    label('Firesnaking/Watersnaking', 0, 'Firesnaking + Watersnaking');
    call(tSn - 5, 'Raidwide; G1 by Deep Blue (west), G2 by Red Hot (east)', { dur: 5 });
    bossTo(236.5, [5, 0]);
    blueTo(236.5, [-5, 0]);
    pref(236.6, Object.assign(assign(G1, clump([], [-9, 0], 4, onSq, { gap: 0.8 })), assign(G2, clump([], [9, 0], 4, onSq, { gap: 0.8 }))));
    const FIRE = Math.random() < 0.5 ? G2 : G1, WATER = FIRE === G1 ? G2 : G1;
    const [fT, fH, fM, fR] = ['T', 'H', 'M', 'R'].map(r => ofRole(FIRE, r)), [wT, wH] = ['T', 'H'].map(r => ofRole(WATER, r));
    for (const s of FIRE) { debuff(s, 'firesnaking', 'Firesnaking', "Red Hot's target: go to her (east)", tSn, snEnd + 0.4); call(tSn, "Red's target (fire): east", { slot: s, alert: true, dur: 4 }); }
    for (const s of WATER) { debuff(s, 'watersnaking', 'Watersnaking', "Deep Blue's target: go to her (west)", tSn, snEnd + 0.4); call(tSn, "Blue's target (water): west", { slot: s, alert: true, dur: 4 }); }
    const sW = pick([1, -1]), My = (p) => [p[0], p[1] * sW], Bw = [-20, pick([10, -10])];
    blueTo(T('Firesnaking/Watersnaking', 0, 244.8) + 5.2, Bw);
    bossTo(T('Firesnaking/Watersnaking', 0, 244.8) + 5.2, [10, 0]);
    // ----- Alley-oop Inferno on fire (a box on the east wall) and Deep Blue's proteans on water (either side of her
    // along the wall, the tank and healer toward the middle: their cones and Reverse's gaps all miss the box); then
    // the water players step out of the fan, and fire out of the box the only ways there are -----
    const tInfA = T('Alley-oop Inferno', 3, 257.4), dblA = Math.random() < 0.5, Mb = (p) => [p[0], Bw[1] < 0 ? p[1] : -p[1]];
    const BOX = { T: [12.6, 4], H: [18.6, 4], M: [12.6, -4], R: [18.6, -4] }, box = Object.fromEntries(FIRE.map(s => [s, Mb(BOX[ROLE(s)])]));
    const W_BEAR = { M: 8, T: 30, H: 130, R: 165 };
    const wTight = Object.fromEntries(WATER.map(s => [s, add(Bw, at(Bw[1] < 0 ? W_BEAR[ROLE(s)] : 180 - W_BEAR[ROLE(s)], 6.5))]));
    pref(tSn + 0.1, Object.assign({}, box, wTight));
    spread(tInfA, FIRE, 5, 'Alley-oop Inferno');
    for (const s of FIRE) {
      puddle({ shape: 'circle', r: 5, from: 'target', targets: [s] }, tInfA, snEnd, 'Alley-oop Inferno (fire)');
      fire({ shape: 'circle', at: box[s], r: 5 }, tInfA + 2.4, snEnd, true);
    }
    const aoA = alleyOop(Bw, WATER, wTight, aoT(2, 258), aoT(3, 260.6), dblA, aoName(dblA));
    [2, 3].forEach(k => { if (AO[k]) P.labels.set(AO[k], aoName(dblA) + (k === 3 ? ' (repeat)' : '')); });
    steam(aoT(2, 258), aoA.first); steam(aoT(3, 260.6), aoA.repeat);
    pref(aoT(2, 258) + 0.05, assign(WATER, clump(aoA.repeat, Mb([-14, -9]), 4, onSq, { gap: 0.7, m: 1 })));
    const EXIT = { T: [6.6, 3.5], H: [18.6, 10.4], M: [5.5, -6], R: [18.6, -10.4] }, EXIT2 = { H: [5, 10.4], R: [5, -10.4] };
    pref(tInfA + 0.05, Object.fromEntries(FIRE.map(s => [s, Mb(EXIT[ROLE(s)])])));
    pref(aoT(3, 260.6) + 0.05, Object.fromEntries(FIRE.filter(s => EXIT2[ROLE(s)]).map(s => [s, Mb(EXIT2[ROLE(s)])])));
    call(tSn + 0.5, 'Fire: spreads in a box on the east wall; water: tight proteans by her', { dur: 6 });
    call(aoT(2, 258) - 5.6, `Water proteans => ${dblA ? 'double-dip' : 'reverse'}: move out after`, { dur: 5 });
    // ----- Hot Impact: the fire tank holds Red Hot by the middle, the rest of fire north-west of the box -----
    const tHI2 = T('Hot Impact', 1, 268.8), Rh = [4, 0], hiTank = add(Rh, My([0, -4.6]));
    bossTo(tInfA + 1, Rh, 3);
    pref(aoT(3, 260.6) + 2, Object.assign({ [fT]: hiTank }, assign([fH, fM, fR], clump(fireIn(tInfA, tHI2 + 1).concat([{ shape: 'circle', at: hiTank, r: 6.4 }]), My([4.5, 10]), 3, onSq, { gap: 0.8 }))));
    buster(tHI2, fT, 6, 'Hot Impact');
    call(tHI2 - 5, 'Tankbuster on the fire tank', { dur: 4 });
    // ----- Deep Varial: from the wall opposite the wave, a 120-degree cone; water to her west, fire to her east -----
    const tTether = T('Sick Swell', 2, 262.6), from2 = sW > 0 ? 0 : 180;
    call(tTether, `Wave ${dirName(from2)} / cone ${dirName(from2 + 180)}`, { dur: 6 });
    const tDV = T('Deep Varial', 1, 276.8), Bv = My([0, -20]), varial = { shape: 'cone', at: Bv, deg: from2, half: 60, r: 60 };
    blueTo(tDV - 6.8, Bv, 1);
    hz(Object.assign({ t: tDV, tell: tDV - 6.8, dmg: 1.4, name: 'Deep Varial' }, varial));
    steam(tDV, [varial]);
    const tSp2 = T('Awesome Splash/Awesome Slab', 1, 280), tInfB = T('Alley-oop Inferno', 5, 280.1), splash2 = Math.random() < 0.5;
    const WS = { T: [-18.6, -11], H: [-18.6, -17.6], M: [-12.5, -18.6], R: [-6.5, -18.8] };
    const water2 = splash2 ? Object.fromEntries(WATER.map(s => [s, My(WS[ROLE(s)])]))
      : Object.assign(assign(WATER.filter(s => s !== wH), clump([varial], My([-12.5, -16.5]), 4, onSq, { gap: 0.6 }).slice(1)), { [wH]: My([-12.5, -16.5]) });
    pref(tHI2 - 2, water2);
    if (splash2) spread(tSp2, WATER, 5, 'Awesome Splash', { tell: tDV - 3, own: 0.25 });
    else stack(tSp2, [wH], 6, 4, 4, 'Awesome Slab', { tell: tDV - 3 });
    label('Awesome Splash/Awesome Slab', 1, splash2 ? 'Awesome Splash (water spreads)' : 'Awesome Slab (water stack)');
    pref(tHI2 + 0.05, Object.fromEntries(FIRE.map(s => [s, My([5, -9])])));
    pref(tHI2 + 2.6, assign(FIRE, clump(fireIn(tHI2, tDV + 1).concat([varial]), My([15.5, -16.5]), 4, onSq, { gap: 0.7 })));
    const IB = { T: [18.6, -16.5], H: [13, -17.5], M: [7.4, -18], R: [1.8, -18.5] }, ib = Object.fromEntries(FIRE.map(s => [s, My(IB[ROLE(s)])]));
    pref(tDV + 0.05, ib);
    spread(tInfB, FIRE, 5, 'Alley-oop Inferno', { tell: tInfB - 5 });
    for (const s of FIRE) {
      puddle({ shape: 'circle', r: 5, from: 'target', targets: [s] }, tInfB, snEnd, 'Alley-oop Inferno (fire)');
      fire({ shape: 'circle', at: ib[s], r: 5 }, tInfB + 2.4, snEnd, true);
    }
    call(tDV - 6.8, `${dirName(from2 + 180)} + water ${splash2 ? 'spread' : 'stack'} + fire spread`, { alert: true, dur: 6 });
    // ----- Hot Aerial: four jumps on the fire players in turn (Toxic: tank, healer, melee, ranged on markers 1-4;
    // nomnom and OCE: far, close to the fire, far, close), each leaving fire; out to the middle after each -----
    const nomnom = st.snaking !== 'toxic';
    const tHAc = T('Hot Aerial', 0, 288.5), tHA = [1, 2, 3, 4].map(k => T(`Hot Aerial ${k}`, 0, 288 + 2 * k));
    const JS = (nomnom ? [[-15.5, 15.5], [5, -11], [-15, -16], [-5, -12.5]] : [[-13, 13], [13, 13], [11, -10.5], [-13, -13]]).map(My);
    const VIA = nomnom ? {} : { 1: My([4, 9.5]) }, BACK = nomnom ? {} : { 2: My([5, -10]) }, jMid = My(nomnom ? [-3, 3] : [1, 1]);
    const jumps = JS.map(p => ({ shape: 'circle', at: p, r: 6 })), jOrder = [fT, fH, fM, fR];
    bossTo(282.7, [0, 0]);
    pref(tInfB + 0.05, Object.fromEntries(FIRE.map(s => [s, My([5, -11])])));
    const mids = assign(jOrder, clump(fireIn(tHA[0], tHA[3] + 3).concat(jumps), jMid, 4, onSq, { gap: 0.7, m: 1.4 }));
    jOrder.forEach((s, k) => {
      if (VIA[k]) { pref(tInfB + 2.6, { [s]: VIA[k] }); pref(tInfB + 6, { [s]: JS[k] }); } else pref(tInfB + 2.6, { [s]: JS[k] });
      if (BACK[k]) { pref(tHA[k] + 0.05, { [s]: BACK[k] }); pref(tHA[k] + 1.2, { [s]: mids[s] }); } else pref(tHA[k] + 0.05, { [s]: mids[s] });
      hz({ t: tHA[k], tell: k ? tHA[k - 1] : tHAc - 5, effect: 'bait', shape: 'circle', from: 'target', targets: [s], r: 6, dmg: 1.1, own: 0.4, status: ['fireResDown', 8], name: 'Hot Aerial' });
      puddle({ shape: 'circle', r: 6, from: 'target', targets: [s] }, tHA[k], snEnd, 'Hot Aerial (fire)');
      fire({ shape: 'circle', at: JS[k], r: 6 }, tHA[k] + 2.4, snEnd, true);
      bossTo(tHA[k] + 0.05, JS[k], 0.4);
      debuff(s, 'fireResDown', 'Fire Resistance Down II', 'keep out of fire', tHA[k], tHA[3] + 3.4);
      call(tInfB + 2.6, `Bait Hot Aerial ${ORD[k]}: ${dirName(brg(JS[k]))}${nomnom ? (k % 2 ? ' (close)' : ' (far)') : ''}`, { slot: s, alert: true, dur: 5 });
    });
    // ----- The wave and its line, the water stack or spreads, the steam off every fire puddle; everyone already where
    // Cutback Blaze wants them (fire on her far side, water in the slice to come) -----
    const tW2 = T('Sick Swell', 3, 301.3), off2 = pick([-15, 15]), W2 = wave(tW2, from2, off2), tSteam2 = tW2 + 4.4;
    const steamed = fires.filter(f => f.steam && f.t0 - 1.2 <= tW2 && f.t1 > tW2).map(f => ({ shape: 'circle', at: f.shape.at, r: 9 }));
    steam(tW2, [{ shape: 'rect', a: [-25, -25], b: [25, 25] }]);
    const tSp3 = T('Awesome Splash/Awesome Slab', 2, 303.7), splash3 = Math.random() < 0.5;
    label('Awesome Splash/Awesome Slab', 2, splash3 ? 'Awesome Splash (water spreads)' : 'Awesome Slab (water stack)');
    const tCut2 = T('Cutback Blaze', 3, 307.2), tDI2 = T('Deep Impact', 1, 313.5), Rc2 = My([-2, 1]);
    bossTo(tHA[3] + 2.5, Rc2, 3);
    const cutDir = nomnom ? 90 : (sW > 0 ? 180 : 0), slice2 = deg360(cutDir + 180), cutTarget = nomnom ? fT : fH;
    const after3 = fireIn(tW2, tCut2 + 0.5).concat(steamed);
    const f3 = assign(FIRE, clump(after3, add(Rc2, at(cutDir, nomnom ? 3.5 : 5)), 4, onSq, { gap: 0.6, m: 1.3 }));
    const keepF = FIRE.map(s => ({ shape: 'circle', at: f3[s], r: splash3 ? 5.4 : 0.1 }));
    const wWant = (i) => add(add(Rc2, at(slice2, splash3 ? 5 + 6 * Math.floor(i / 2) : 5)), at(slice2 + 90, splash3 ? (i % 2 ? 3.2 : -3.2) : 0));
    const w3 = splash3 ? place(Object.fromEntries(WATER.map((s, i) => [s, wWant(i)])), after3.concat(keepF), { gap: 6, m: 1.3 })
      : Object.assign(assign(WATER, clump(after3.concat(FIRE.map(s => ({ shape: 'circle', at: f3[s], r: 5 }))), wWant(0), 4, onSq, { gap: 0.6, m: 1.3 })));
    if (!splash3) for (const s of FIRE) if (dist(f3[s], w3[wH]) < 6.4 && B.M10S_DEBUG) B.M10S_DEBUG(`fire ${s} in the water stack`);
    const splashSpots = Object.assign({}, w3, f3);
    // (Thrown where the water stack or spreads already work out; then on to those spots before the steam.)
    const isW = (s) => WATER.includes(s);
    const gap3 = (a, b) => (splash3 ? (isW(a) && isW(b) ? 6 : isW(a) || isW(b) ? 5.6 : 0.6) : ((a === wH && !isW(b)) || (b === wH && !isW(a)) ? 6.6 : 0.6));
    const kb2 = placeKB(splashSpots, W2.v, fireIn(tInfB, tW2).concat([W2.line], jumps), fireIn(tW2, tW2 + 2.5), 0.6, gap3);
    pref(tSp2 + 0.05, Object.fromEntries(WATER.map(s => [s, kb2.pre[s]])));
    pref(tHA[3] + 0.06, Object.fromEntries(FIRE.map(s => [s, kb2.pre[s]])));
    pref(tW2 + 0.6, kb2.post);
    pref(tSp3 + 0.05, splashSpots);
    if (splash3) spread(tSp3, WATER, 5, 'Awesome Splash', { tell: tW2 - 3, own: 0.25 });
    else stack(tSp3, [wH], 6, 4, 4, 'Awesome Slab', { tell: tW2 - 3 });
    call(tW2 - 7, `Knockback from the ${dirName(from2)}; the line ${side(from2, off2)}; then water ${splash3 ? 'spread' : 'stack'}, clear of the steam`, { alert: true, dur: 6 });
    // ----- Cutback Blaze on a fire player (Toxic, OCE: fire stacked south of her; nomnom: the fire tank far east), all
    // into its slice after; Deep Impact on the water tank, far out in the slice from Deep Blue -----
    if (nomnom) pref(tSteam2 + 0.05, { [fT]: clump(fireIn(tSteam2, tCut2), add(Rc2, at(cutDir, 9.5)), 1, onSq, { m: 0.6 })[0] });
    raid(tCut2, 0.3, 'Cutback Blaze', 5.2);
    hz({ t: tCut2, tell: tCut2 - 5.2, shape: 'cone', from: 'boss', aim: 'target', targets: [cutTarget], half: 165, r: 60, dmg: 0, quiet: true, name: 'Cutback Blaze' });
    puddle({ shape: 'cone', from: 'boss', aim: 'target', targets: [cutTarget], half: 165, r: 60 }, tCut2, snEnd, 'Cutback Blaze (fire)');
    const cone2 = { shape: 'cone', at: Rc2, deg: cutDir, half: 165, r: 60 };
    fire(cone2, tCut2 + 2.4, snEnd);
    const Bd = add(Rc2, at(cutDir, 5));
    blueTo(T('Sickest Take-off', 3, 301.3) + 2, Bd);
    const wTank = clump(fireIn(tCut2, snEnd), add(Rc2, at(slice2, 16.5)), 1, onSq, { m: 1.3 })[0];
    const inSlice = assign(S.filter(s => s !== wT), clump(fireIn(tCut2, snEnd).concat([{ shape: 'circle', at: wTank, r: 6.4 }]), add(Rc2, at(slice2, 8.5)), 7, onSq, { gap: 0.5, m: 1.2 }));
    pref(tCut2 + 0.05, Object.assign(inSlice, { [wT]: wTank }));
    buster(tDI2, wT, 6, 'Deep Impact', { tell: tDI2 - 5.1 });
    throwOff(tDI2, Bd, wT);
    call(tCut2 - 5.2, nomnom ? 'Fire tank: bait Cutback Blaze far east; everyone into the slice west' : `Fire: stack ${dirName(cutDir)} of her for Cutback Blaze; then into the slice`, { alert: true, dur: 5 });
    call(tDI2 - 5.1, 'Water tank: bait the buster far out in the slice', { slot: wT, alert: true, dur: 5 });
    divers(1);


    // ======================================================== Deep Aerial: the bubble ===============================
    // Parallel: the healers take the tower and are held in Watery Grave in the middle (here a step west in it, as the
    // sim can't make them immune to Red Hot's waves through it); the floor is a circle meanwhile. Six rounds of
    // tethered Xtreme Waves: Red Hot rides hers from where she is to her target, straight through the bubble; Deep
    // Blue's runs parallel, clear of it. Everyone else waits east, clear of both.
    const tDA = T('Deep Aerial (damage + stun)', 0, 334.8), tDAc = T('Deep Aerial (tower)', 0, 328.8), JAIL = ['H1', 'H2'];
    const FREE = S.filter(s => !JAIL.includes(s)), freed = T('Xtreme Wave 6', 0, 388.3) + 5;
    pref(tDAc, Object.assign({ H1: [-0.8, 0.4], H2: [0.8, -0.4] }, assign(FREE, clump([{ shape: 'circle', at: [0, 0], r: 6.5 }], [10, 0], 6, onSq, { gap: 0.8 }))));
    hz({ t: tDA, tell: tDAc, effect: 'tower', shape: 'circle', at: [0, 0], r: 6, soak: [2, 2], dmg: 0.3, fail: 0.9, name: 'Deep Aerial' });
    call(tDAc, 'Healers: the tower (the bubble); everyone else out', { alert: true, dur: 5 });
    pref(tDA + 0.05, { H1: [-3.5, 0.8], H2: [-3.5, -0.8] });
    for (const s of JAIL) {
      debuff(s, 'stun', 'Stun', 'held', tDA, tDA + 2);
      debuff(s, 'wateryGrave', 'Watery Grave', 'held in the bubble', tDA + 2.9, freed);
    }
    hz({ t: 339.5, tell: tDA, shape: 'donut', at: [0, 0], r0: 20, dmg: 1.5, name: 'Watery Grave (the floor shrinks)' });
    const s0 = pick([1, -1]), order6 = shuffle(FREE);
    let redSrc = [14, 14 * s0], blueSrc = [-14, 14 * s0], lastFire = redSrc;
    bossTo(T('Xtreme Wave 1', 0, 345.7) - 7.8, redSrc);
    blueTo(tDAc, [0, 0], 1);
    blueTo(T('Xtreme Wave 1', 0, 345.7) - 7.8, blueSrc);
    for (let k = 0; k < 6; k++) {
      const tW = T(`Xtreme Wave ${k + 1}`, 0, 345.7 + 8.5 * k), th = tW + 0.3, tTeth = tW - 5, f = order6[k], w = order6[(k + 3) % 6];
      const ys = k % 2 ? 1 : -1, fireSpot = k ? [1.5, 18.4 * s0 * ys] : [0.5, -18.4 * s0], waterSpot = k ? [-9, 16.2 * s0 * ys] : [-8, -16.5 * s0];
      const redLine = { shape: 'line', at: redSrc, deg: brg(sub(fireSpot, redSrc)), len: 60, w: 8 }, blueLine = { shape: 'line', at: blueSrc, deg: brg(sub(waterSpot, blueSrc)), len: 60, w: 8 };
      const others = FREE.filter(s => s !== f && s !== w);
      pref(tTeth, Object.assign({ [f]: fireSpot, [w]: waterSpot }, assign(others, clump([redLine, blueLine], [11, 0], 4, onCirc, { gap: 0.8, m: 1.4 }))));
      hz({ t: th, tell: tTeth, effect: 'bait', shape: 'line', from: 'boss', aim: 'target', targets: [f], len: 60, w: 8, dmg: 1, own: 0.15, tether: 'boss', stretch: 28, name: 'Xtreme Wave' });
      hz({ t: th, tell: tTeth, effect: 'bait', shape: 'line', from: blueSrc, aim: 'target', targets: [w], len: 60, w: 8, dmg: 1, own: 0.15, tether: blueSrc, stretch: 28, name: 'Xtreme Wave' });
      check({ t: th, kind: 'spot', slots: [f], spots: { [f]: fireSpot }, r: 4, fail: 0.6, name: 'Xtreme Wave (aim it through the bubble)' });
      bossTo(th + 0.05, fireSpot, 0.4);
      blueTo(th + 0.05, waterSpot, 0.4);
      raid(T(`Scathing Steam ${k + 1}`, 0, tW + 2.1), 0.2, 'Scathing Steam', 1);
      call(tTeth, `Red tether: stretch it to the ${dirName(brg(fireSpot))} wall, through the bubble`, { slot: f, alert: true, dur: 5 });
      call(tTeth, `Blue tether: stretch it to the ${dirName(brg(waterSpot))}, parallel, clear of the bubble`, { slot: w, alert: true, dur: 5 });
      redSrc = fireSpot; blueSrc = waterSpot; lastFire = fireSpot;
    }
    const bEnd = [lastFire[0], lastFire[1] > 0 ? 14 : -14];
    bossTo(freed - 1.7, bEnd, 1);
    blueTo(freed - 1.7, add(bEnd, [-4, 0]), 1);
    pref(freed - 1.6, hug(bEnd, lastFire[1] > 0 ? 0 : 180));
    divers(2);
    P.arena = [{ t: 0, shape: 'square', half: 20 }, { t: 339.5, shape: 'circle', at: [0, 0], r: 20 }, { t: freed + 0.2, shape: 'square', half: 20 }];


    // ======================================================== Arena split ============================================
    // Red Hot rides Flame Floater down the middle from the north wall (fire there till the phase ends): G1 west, G2
    // east. Spreads in the corners; Deep Blue on one side does proteans at all eight: her side round her, the other
    // side's far by the line (its healer and ranged at the ends, its tank and melee either side of west); pair stacks
    // by the markers; the wave across the split, and light-party stacks.
    const tSF = T('Flame Floater', 0, 414.3), spEnd = T("Divers' Dare x2", 3, 451.8);
    bossTo(T("Divers' Dare x2", 2, 398.7) + 8.2, [0, 19.5]);
    blueTo(T("Divers' Dare x2", 2, 398.7) + 8.2, [-1, 14.3]);
    const fromS = pick([90, 270]), splitLine = { shape: 'line', at: [0, 19.5], deg: 180, len: 60, w: 8 };
    call(T('Sick Swell', 4, 409.9), `Wave from the ${dirName(fromS)} (later)`, { dur: 5 });
    hz(Object.assign({ t: tSF, tell: tSF - 5, dmg: 1.3, name: 'Flame Floater' }, splitLine));
    hz(Object.assign({ t: tSF + 2.4, tell: tSF, lasts: spEnd - tSF - 2.4, tick: 1, dmg: 0.8, tickDmg: 0.6, react: 0, name: 'Flame Floater (fire)' }, splitLine));
    fire(splitLine, tSF + 2.4, spEnd);
    bossTo(tSF + 0.2, [0, 0], 1.2);
    pref(tSF - 5, Object.assign(assign(G1, clump([splitLine], [-9, 2], 4, onSq, { gap: 0.8 })), assign(G2, clump([splitLine], [9, 2], 4, onSq, { gap: 0.8 }))));
    call(tSF - 5, 'E/W groups, out of the middle', { alert: true, dur: 5 });
    // ----- Alley-oop Inferno in the corners -----
    const tInfS = T('Alley-oop Inferno', 6, 423.6);
    const CORNER = { R1: [-18.7, 18.7], MT: [-18.7, 12.3], H1: [-18.7, -18.7], M1: [-18.7, -12.3], R2: [18.7, 18.7], OT: [18.7, 12.3], H2: [18.7, -18.7], M2: [18.7, -12.3] };
    pref(tInfS - 5, CORNER);
    spread(tInfS, S, 5, 'Alley-oop Inferno');
    for (const s of S) {
      puddle({ shape: 'circle', r: 5, from: 'target', targets: [s] }, tInfS, spEnd, 'Alley-oop Inferno (fire)');
      fire({ shape: 'circle', at: CORNER[s], r: 5 }, tInfS + 2.4, spEnd, true);
    }
    call(tInfS - 5, 'Spread in the corners', { dur: 4 });
    // ----- Proteans from Deep Blue on one side (drawn for the east) -----
    const bs = pick([1, -1]), Bs = [12 * bs, 0];
    blueTo(T('Alley-oop Inferno', 6, 423.6) - 2.5, Bs);
    const NEAR = bs > 0 ? G2 : G1, FAR = bs > 0 ? G1 : G2, Mx = (p) => [p[0] * bs, p[1]];
    const ray = (deg, d) => add(Bs, at(bs > 0 ? deg : 360 - deg, d));
    const PNEAR = { R: [12, 7.5], T: [17.2, 3], M: [17.2, -3], H: [12, -7.5] }, PFAR = { H: [-5.3, -18.7], M: [-5.6, -3.7], T: [-5.6, 3.7], R: [-5.3, 18.7] };
    const pSpot = Object.assign({}, ...NEAR.map(s => ({ [s]: Mx(PNEAR[ROLE(s)]) })), ...FAR.map(s => ({ [s]: Mx(PFAR[ROLE(s)]) })));
    const DNEAR = { R: [30, 7.5], T: [90, 6], M: [150, 6], H: [150, 7.8] }, DFAR = { H: [240, 22.5], M: [240, 20.3], T: [300, 20.3], R: [300, 22.5] };
    const aS = [aoT(4, 429.2), aoT(5, 431.8)], dblS = Math.random() < 0.5;
    const dSpot = dblS ? Object.assign({}, ...NEAR.map(s => ({ [s]: ray(...DNEAR[ROLE(s)]) })), ...FAR.map(s => ({ [s]: ray(...DFAR[ROLE(s)]) })))
      : Object.assign({}, pSpot, ...FAR.filter(s => ROLE(s) === 'M' || ROLE(s) === 'T').map(s => ({ [s]: ray(270, ROLE(s) === 'M' ? 17.6 : 19.5) })));
    pref(aS[0] - 5.6, pSpot);
    const aoS = alleyOop(Bs, S, pSpot, aS[0], aS[1], dblS, aoName(dblS));
    pref(aS[0] + 0.05, dSpot);
    steam(aS[0], aoS.first); steam(aS[1], aoS.repeat);
    [4, 5].forEach(k => { if (AO[k]) P.labels.set(AO[k], aoName(dblS) + (k === 5 ? ' (repeat)' : '')); });
    call(aS[0] - 5.6, `Proteans from Deep Blue (${bs > 0 ? 'east' : 'west'}) => ${dblS ? 'dodge into the gaps' : 'stay (far melee and tank: to the cardinal)'}`, { alert: true, dur: 6 });
    // ----- Freaky Pyrotation: pair stacks by the markers -----
    const tFP = T('Freaky Pyrotation', 0, 436.7), PAIRS = [['MT', 'R1', [-8, 13]], ['OT', 'R2', [8, 13]], ['H1', 'M1', [-8, -13]], ['H2', 'M2', [8, -13]]];
    const pairSpots = {};
    for (const [a, b, p] of PAIRS) {
      pairSpots[a] = p; pairSpots[b] = add(p, [0, 0.8]);
      puddle({ shape: 'circle', r: 6, from: 'target', targets: [a] }, tFP, spEnd, 'Freaky Pyrotation (fire)');
      fire({ shape: 'circle', at: p, r: 6 }, tFP + 2.4, spEnd, true);
      call(tFP - 5.3, `Pair stack with ${b}`, { slot: a, dur: 5 });
      call(tFP - 5.3, `Pair stack with ${a}`, { slot: b, dur: 5 });
    }
    pref(aS[1] + 0.05, pairSpots);
    stack(tFP, ['MT', 'OT', 'H1', 'H2'], 6, 2, 2, 'Freaky Pyrotation', { tell: tFP - 5.3 });
    // ----- The wave across the split and its line; light-party stacks -----
    const tW3 = T('Sick Swell', 5, 444.7), off3 = pick([-15, 15]), W3 = wave(tW3, fromS, off3), kbEast = fromS === 270;
    steam(tW3, [{ shape: 'rect', a: [-25, -25], b: [25, 25] }]);
    const xPre = kbEast ? [-16.6, 7] : [-7, 16.6], LPO = { H: [0, 0], T: [0.9, 0.5], M: [-0.9, 0.5], R: [0, -0.9] };
    const preS = Object.assign({}, ...[G1, G2].map((g, i) => Object.fromEntries(g.map(s => [s, add([xPre[i], 0], LPO[ROLE(s)])]))));
    pref(tFP + 0.05, preS);
    pref(tW3 + 0.6, all(s => add(preS[s], W3.v)));
    stack(T('Awesome Slab', 0, 447.1), ['H1', 'H2'], 6, 4, 4, 'Awesome Slab', { tell: tW3 - 2 });
    call(tW3 - 7, `Knockback from the ${dirName(fromS)}; the line ${side(fromS, off3)}; then light parties`, { alert: true, dur: 6 });
    divers(3);


    // ======================================================== Insane Air 2 ==========================================
    // Everyone carries a colour (a light party each, "same proximity bait as Snaking") and baits the board of its own
    // colour, but in turn each role takes the other colour's bait to cleanse: healers first, then melee, then ranged,
    // the tanks on the buster round. Toxic and Hector: the healers start at the other colour's boss; OCE: everyone at
    // their own, the turn's role swapping just before. A 15-yalm Bailout stack on each round's cleansed players after.
    const tXS2 = T('Xtreme Firesnaking/Xtreme Watersnaking', 0, 467.4), ia2End = T("Divers' Dare x2", 4, 526);
    raid(tXS2, 0.45, 'Xtreme Firesnaking + Xtreme Watersnaking', 5);
    label('Xtreme Firesnaking/Xtreme Watersnaking', 0, 'Xtreme Firesnaking + Xtreme Watersnaking');
    bossTo(T('Epic Brotherhood x2', 4, 460.3) - 1, [5, 0], 1);
    blueTo(T('Epic Brotherhood x2', 4, 460.3) - 1, [-5, 0], 1);
    pref(T('Epic Brotherhood x2', 4, 460.3), Object.assign(assign(G1, clump([], [-9, 0], 4, onSq, { gap: 0.8 })), assign(G2, clump([], [9, 0], 4, onSq, { gap: 0.8 }))));
    call(tXS2 - 5, 'Raidwide; G1 by Deep Blue (west), G2 by Red Hot (east)', { dur: 5 });
    const FIRE2 = Math.random() < 0.5 ? G2 : G1, colour = (s) => (FIRE2.includes(s) ? 'red' : 'blue'), other = (c) => (c === 'red' ? 'blue' : 'red');
    const hits2 = airHits.slice(4, 8), baits2 = airBaits.slice(4, 8), bails = E('Bailout').map(e => e.t);
    const m2 = ['P'].concat(shuffle(['TB', 'S', 'P'])), rolesLeft = ['H', 'M', 'R'], turn = m2.map(m => (m === 'TB' ? 'T' : rolesLeft.shift()));
    const ROLE_NAME = { T: 'tanks', H: 'healers', M: 'melee', R: 'ranged' };
    const pos = all(s => (st.air2 !== 'oce' && ROLE(s) === 'H' ? other(colour(s)) : colour(s))), posAt = [];
    for (let k = 0; k < 4; k++) {
      for (const s of S) if (ROLE(s) === turn[k]) pos[s] = other(colour(s));
      posAt.push(Object.assign({}, pos));
    }
    for (const s of S) {
      const k = turn.indexOf(ROLE(s)), red = colour(s) === 'red';
      debuff(s, red ? 'xtremeFiresnaking' : 'xtremeWatersnaking', red ? 'Xtreme Firesnaking' : 'Xtreme Watersnaking',
        `cleanse on Insane Air ${k + 1} at ${red ? 'Deep Blue' : 'Red Hot'}`, tXS2, hits2[k]);
      call(tXS2, `${red ? 'Red' : 'Blue'} debuff: cleanse ${ORD[k]} (${AIR_CALL[m2[k]].toLowerCase()})`, { slot: s, alert: true, dur: 5 });
    }
    const startPos = st.air2 === 'oce' ? all(s => colour(s)) : all(s => (ROLE(s) === 'H' ? other(colour(s)) : colour(s)));
    pref(tXS2 + 0.1, Object.assign(assign(S.filter(s => startPos[s] === 'blue'), clump([], [-11, 11], 4, onSq, { gap: 0.8 })),
      assign(S.filter(s => startPos[s] === 'red'), clump([], [11, -11], 4, onSq, { gap: 0.8 }))));
    bossTo(T('Xtreme Firesnaking/Xtreme Watersnaking', 0, 467.4) + 5.2, [13, -13]);
    blueTo(T('Xtreme Firesnaking/Xtreme Watersnaking', 0, 467.4) + 5.2, [-13, 13]);
    const ia2 = insaneAir({ hits: hits2, baits: baits2, tells: hits2.map((t, k) => t - (k ? 10.4 : 9.6)), end: ia2End, bails,
      mech: (k) => m2[k], group: (k, c) => S.filter(s => posAt[k][s] === c),
      target: (k, c, m, g) => g.find(s => ROLE(s) === turn[k]),
      call: (k) => `${AIR_CALL[m2[k]]} (${ROLE_NAME[turn[k]]} swap)` });
    bails.slice(0, 4).forEach((t, k) => {
      const tw = S.filter(s => ROLE(s) === turn[k]);
      stack(t, tw, 15, 4, 4, 'Bailout', { tell: hits2[k], dmg: 0.25 });
    });
    const gp2 = airGather(bails[3] || hits2[3] + 1.5, ia2End, [0, 0], ia2.last, 0);
    bossTo(hits2[3] + 1.5, gp2, 3);
    ia2.bp.forEach((p, k) => blueTo(baits2[k], p, 0.5));
    blueTo(hits2[3] + 1.5, add(gp2, [-4, 0]), 3);
    divers(4);


    // ======================================================== Double Alley-oop ======================================
    // Proteans from Deep Blue in the middle with everyone on the markers (Double-dip: dodge clockwise; Reverse: stay)
    // and spreads that leave fire there; then Pyrotation stacking under Deep Blue and rotating clockwise round Red Hot,
    // while a tank baits Deep Impact far out between the fires (Toxic, Hector: MT; OCE: OT).
    const tEndF = T("Divers' Dare x2", 5, 566.5);
    bossTo(T('Epic Brotherhood x2', 5, 532.2) - 3, [0, 0], 2);
    pref(T('Epic Brotherhood x2', 5, 532.2) - 1, hug([0, 0], 0));
    const MARK = { MT: 0, OT: 180, H1: 270, H2: 90, M1: 225, M2: 135, R1: 315, R2: 45 }, Bf = [0, 0];
    const aF = [aoT(6, 542.1), aoT(7, 544.7)], dblF = Math.random() < 0.5, tInfF = T('Alley-oop Inferno', 7, 544.3);
    const mark = all(s => at(MARK[s], 17)), drop = all(s => at(MARK[s] + (dblF ? 22.5 : 0), 17));
    pref(aF[0] - 5.6, mark);
    alleyOop(Bf, S, mark, aF[0], aF[1], dblF, aoName(dblF));
    if (dblF) pref(aF[0] + 0.05, drop);
    [6, 7].forEach(k => { if (AO[k]) P.labels.set(AO[k], aoName(dblF) + (k === 7 ? ' (repeat)' : '')); });
    spread(tInfF, S, 5, 'Alley-oop Inferno');
    for (const s of S) {
      puddle({ shape: 'circle', r: 5, from: 'target', targets: [s] }, tInfF, tEndF, 'Alley-oop Inferno (fire)');
      fire({ shape: 'circle', at: drop[s], r: 5 }, tInfF + 2.4, tEndF, true);
    }
    call(aF[0] - 5.6, `Proteans on the markers + spreads => ${dblF ? 'dodge clockwise' : 'stay'}`, { alert: true, dur: 6 });
    // ----- Pyrotation and Deep Impact -----
    const tPyF = T('Pyrotation x3', 1, 552.3), phF = [0.9, 2.9, 4.9].map(d => tPyF + d), tDIF = T('Deep Impact', 2, 553.4);
    blueTo(T('Epic Brotherhood x2', 5, 532.2) + 2.1, Bf);
    const tbF = st.lastTB, Bp2 = [0, 5.5];
    blueTo(tInfF + 1, Bp2, 3);
    const tri = [0, 120, 240].map(d => at(d, 5.5));
    const bis = [0, 1, 2, 3, 4, 5, 6, 7].map(i => at(i * 45 + (dblF ? 0 : 22.5), 18.5)).filter(p => onSq(p) && dist(p, Bp2) >= 13);
    const tbSpot = bis.reduce((a, b) => (dist(b, drop[tbF]) < dist(a, drop[tbF]) ? b : a));
    pref(aF[1] + 0.05, { [tbF]: tbSpot });
    const XF = pick(S.filter(s => s !== tbF)), rest7 = S.filter(s => s !== XF && s !== tbF);
    phF.forEach((t, k) => {
      const sp = tri[k], prev = k ? tri[k - 1] : null, hs = fireIn(t - 1, t + 0.3);
      const pts = clump(hs, sp, 7, (p) => onSq(p) && dist(p, sp) <= 3.6 && (!prev || dist(p, prev) >= 4.9), { gap: 0.45, m: k ? 0.5 : 1.2 });
      pref(k ? phF[k - 1] + 0.05 : aF[1] + 0.05, Object.assign(assign(rest7, pts.slice(1)), { [XF]: pts[0] }));
      stack(t, [XF], 6, 6, 7, 'Pyrotation', { tell: k ? phF[k - 1] : tPyF - 4.3, dmg: 0.3 });
      puddle({ shape: 'circle', r: 6, from: 'target', targets: [XF] }, t, tEndF, 'Pyrotation (fire)');
      fire({ shape: 'circle', at: sp, r: 6 }, t + 2.4, tEndF, true);
    });
    pref(phF[2] + 0.05, assign(rest7.concat([XF]), clump(fireIn(phF[2], tEndF), at(300, 9.4), 7, (p) => onSq(p) && dist(p, at(300, 9.4)) <= 4, { gap: 0.45, m: 0.5 })));
    buster(tDIF, tbF, 6, 'Deep Impact', { tell: T('Deep Impact (bait)', 2, 553.2) - 4.9 });
    throwOff(tDIF, Bp2, tbF);
    call(tPyF - 4.3, `Stack x3 on ${XF}: under Deep Blue, then clockwise round Red Hot`, { alert: true, dur: 8 });
    call(tInfF, 'Bait the knockback buster far out', { slot: tbF, alert: true, dur: 5 });
    pref(tEndF + 0.05, hug([0, 0], 0));
    divers(5);
    divers(6);
    label('Over the Falls', 0, 'Over the Falls (enrage)');
    // Deep Blue beside Red Hot: out from Red Hot's return till the end, but for her Sickest Take-offs and the
    // transition's flight; while she's out alone (88.8-150.6) the boss itself is her (the target is hers then).
    BP.sort((a, b) => a.t - b.t);
    P.form = [{ t: p1End, model: 'blue' }, { t: 150.6, model: null }];
    const gone = [[T('Sickest Take-off', 2, 292.1), T('Sickest Take-off', 3, 301.3) + 2], [T('Sickest Take-off', 4, 435.8), T('Sickest Take-off', 5, 444.7) + 2]];
    P.others = [{ model: 'blue', path: BP, shows: [[150.6, 161.7], [177.4, gone[0][0]], [gone[0][1], gone[1][0]], [gone[1][1], 700]] }];
    return P;
  }

  B.FIGHT_SCRIPTS = B.FIGHT_SCRIPTS || {};
  B.FIGHT_SCRIPTS.m10s = {
    // FFLogs: Red Hot and Deep Blue have 59,491,502 each; Epic Brotherhood evens them out, so the kill takes both.
    hp: 118983004,
    defaultStrat: 'toxic',
    strats: {
      toxic: { label: 'Toxic Friends' },
      hector: { label: 'Hector (Toxic/nomnom/Parallel) (NA / EU)' },
      oce: { label: 'OCE (MR) (OCE)' },
    },
    source: 'wtfdig.info/74/m10s; mechanics after BossMod (github.com/awgil/ffxiv_bossmod), positions from FFLogs kills',
    // A north, B east, C south, D west, 1-4 the intercards (1 north-west, then clockwise).
    waymarks: [
      { label: 'A', at: [0, 14], color: 'red' }, { label: 'B', at: [14, 0], color: 'yellow' },
      { label: 'C', at: [0, -14], color: 'blue' }, { label: 'D', at: [-14, 0], color: 'purple' },
      { label: '1', at: [-13, 13], color: 'red', square: true }, { label: '2', at: [13, 13], color: 'yellow', square: true },
      { label: '3', at: [13, -13], color: 'blue', square: true }, { label: '4', at: [-13, -13], color: 'purple', square: true },
    ],
    plan,
  };
})(window.BLM);
