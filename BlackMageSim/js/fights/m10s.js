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
      if (!best && B.M10S_DEBUG) {
        const why = { ok: 0, hs: 0, gap: 0, walk: 0 };
        for (let r = 0.3; r <= 16; r += 0.6) for (let j = 0; j < 24; j++) {
          const p = [w[0] + Math.sin(j / 24 * 2 * Math.PI) * r, w[1] + Math.cos(j / 24 * 2 * Math.PI) * r];
          if (!ok(p)) why.ok++; else if (!hs.every(h => !inside(h, p, m))) why.hs++; else if (!Object.values(out).every(q => dist(q, p) >= gap)) why.gap++; else if (!clear(p)) why.walk++;
        }
        B.M10S_DEBUG(`place: no spot for ${s} near ${w} ${JSON.stringify(why)}`);
      }
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
        if (shapes.some(s => inside(s, f.shape.at, 0))) hz({ t: tw + 4.4, tell: tw + 1.4, shape: 'circle', at: f.shape.at, r: 9, dmg: 0.7, name: 'Steam Burst', react: 2.5 });
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
    // both clear of their shapes.
    const placeKB = (wants, v, hsPre, hsPost, gap) => {
      const out = {}, post = {};
      for (const [s, w] of Object.entries(wants)) {
        const good = (q) => onSq(q) && onSq(add(q, v)) && hsPre.every(h => !inside(h, sub(q, [0, 0]), 1.4)) && hsPost.every(h => !inside(h, add(q, v), 1.4))
          && Object.values(post).every(p => dist(p, add(q, v)) >= gap);
        const w0 = sub(w, v);
        let best = good(w0) ? w0 : null;
        for (let r = 0.3; r <= 16 && !best; r += 0.3) {
          const n = Math.max(8, Math.round(2 * Math.PI * r / 0.3));
          for (let j = 0; j < n; j++) { const a = j / n * 2 * Math.PI, q = [w0[0] + Math.sin(a) * r, w0[1] + Math.cos(a) * r]; if (good(q)) { best = q; break; } }
        }
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
    const divers = (k, name) => { const t = name === 1 ? T("Divers' Dare", k) : T("Divers' Dare x2", k); if (t !== undefined) { raid(t, 0.45, "Divers' Dare", 5); call(t - 5, 'Raidwide', { dur: 3 }); } return t; };
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
    pref(151, hug([5, 0], 0));
    const tXS = T('Xtreme Spectacular (line)', 0, 168.7), band = { shape: 'rect', a: [-25, -15], b: [25, 15] };
    hz(Object.assign({ t: tXS, tell: tXS - 7.4, dmg: 1.3, name: 'Xtreme Spectacular' }, band));
    raid(tXS, 0.25, 'Xtreme Spectacular', 7.4);
    for (let k = 0; k < 6; k++) raid(T('Xtreme Spectacular x6', 0, 169.7) + 0.6 * k, 0.06, 'Xtreme Spectacular', 0.5);
    raid(T('Xtreme Spectacular (big)', 0, 173.6), 0.5, 'Xtreme Spectacular', 1);
    pref(tXS - 7.4, assign(S, clump([band], [0, -17.4], 8, (p) => onSq(p) && p[1] <= -16.2, { gap: 0.7, m: 1.2 })));
    call(tXS - 7.4, 'Go N/S + big raidwides', { alert: true, dur: 6 });

    //@@IA1@@
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
