// EX5, The Minstrel's Ballad: Necron's Embrace: Necron's mechanics for the sim's party, on cactbot's timeline
// (07-dt/trial/necron-ex), and the strat wtfdig.info lists for the fight (73/ex5): Hector's (MM2: Normal, its default).
// Spots are [east, north] yalms from the arena's middle.
//
// The mechanics follow BossMod's module (github.com/awgil/ffxiv_bossmod, Ex5Necron), whose shapes and sizes come from
// the game's Action sheet, and where things stand follows an FFLogs kill (the hands' and orbs' positions as they cast).
// The arena is a rectangle 36 wide and 30 deep (BossMod's); Necron stands outside its north edge at [0, 22] facing
// south, his hitbox (20) reaching two yalms past the edge. Built with the sim's toolkit (js/mech.js):
//   Phase 1:
//   - Blue Shockwave: a two-hit tank buster, 100-degree cones (MT to the north-west corner, OT the north-east).
//   - Fear of Death: raidwide, eight puddles where the Icy Hands rise (two layouts, either way round), each hand's line
//     at its nearest player: everyone baits their own outward from the spread spots (TMMT front, RHHR back).
//   - Cold Grip: the outer thirds, then Existential Dread the middle and one side: middle, then the safe side.
//   - Memento Mori: the middle line and its voidzone, the hands out of the middle (four to the dark side, one to the
//     light), Smite of Gloom's spreads on everyone: tanks on the dark side, the rest on the light.
//   - Soul Reaping: one stored Aetherblight (out: a circle of 20 on him; in: a donut from 16; middle: the outer thirds;
//     sides: the middle), with Twofold Blight's light-party cones at the healers or Fourfold's partner cones at the
//     supports: out/sides at the sides past max melee, in/middle in the middle under him.
//   - The End's Embrace: spreads on everyone (on the Fear of Death spots), each leaving a hand that aims at its nearest
//     player and fires three seconds later: bait it outward, then step out.
//   - Grand Cross: the floor shrinks to a circle of 9; two pairs of baited puddles (stack in the middle, then out),
//     five lasers through the middle, towers at the intercards and spreads at the cardinals, then the other way round;
//     the last puddles and the cross (intercards safe); Neutron Ring brings the floor back.
//   - Adds: three waves of Icy Hands (lines at their nearest player: each baited outward by its own player) and two
//     Beckoning Hands (line tank busters on MT, then OT); Darkness of Eternity, Inevitability.
//   - The jails: each role's hands (tanks: busters; healers: bleed, Slow, hits; DPS: crossing lines) before the Doom.
//   Phase 2:
//   - Specter of Death: two of three lanes (giant hands), spreads in the third, The End's Embrace's hands, Cold Grip.
//   - Relentless Reaping: four stored Aetherblights in a row, Crop Rotation shifting where they start, the stacks with
//     the last (The Second Season: light parties; The Fourth: partners).
//   - Circle of Lives: five orbs' donuts in turn (safe within 3 of the orb), a giant hand's lane among them; a stored
//     Soul Reaping after. The second: four orbs, two lanes beside the second and fourth.
//   - Mass Macabre: towers 4-2-3-3 (the middle two, the four side pairs, then the light parties' threes around the tank
//     busters), with Memento Mori's line and hands.
//   - Then Fear of Death, Circle of Lives 2, Memento Mori, Cold Grip and Grand Cross again; Darkness of Eternity.
// Simplified: the three jails are two circles of 9 side by side on the arena (the DPS's west, the tanks' and healers'
// east), and the Doom is a 0.55 raidwide while the jails' hands are up (the self-check
// can't kill adds); Spreading Fear's interrupt is a callout. The hands that rise from Fear of Death and The End's
// Embrace stand at the strat's spots (the game's: where each player stood). Smite of Gloom's spreads are 9.6 (the
// game's 10, less the sim's body margin: Hector's light side has no more room). Where the game's patterns aren't
// known (the adds' first wave, Circle of Lives 2's orbs, the lasers' angles, which players bait Grand Cross's puddles,
// the order of Relentless Reaping's icons), they're this script's own, picked each pull.
(function (B) {
  const S = B.SLOTS;
  const at = B.bearing;
  const inside = B.mechInside;
  const add = (a, b) => [a[0] + b[0], a[1] + b[1]];
  const sub = (a, b) => [a[0] - b[0], a[1] - b[1]];
  const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);
  const deg360 = (d) => ((d % 360) + 360) % 360;
  const pick = (a) => a[Math.floor(Math.random() * a.length)];
  const shuffle = (a) => { const b = a.slice(); for (let i = b.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [b[i], b[j]] = [b[j], b[i]]; } return b; };
  const r2 = (p) => [+p[0].toFixed(2), +p[1].toFixed(2)];
  const brg = (p) => deg360(Math.atan2(p[0], p[1]) * 180 / Math.PI);
  const unit = (p) => { const l = Math.hypot(p[0], p[1]) || 1; return [p[0] / l, p[1] / l]; };
  const SUP = ['MT', 'OT', 'H1', 'H2'], DPS = ['M1', 'M2', 'R1', 'R2'];
  const G1 = ['MT', 'H1', 'M1', 'R1'], G2 = ['OT', 'H2', 'M2', 'R2'];
  const PARTNER = { MT: 'M1', OT: 'M2', H1: 'R1', H2: 'R2' };
  const DIR8 = ['north', 'north-east', 'east', 'south-east', 'south', 'south-west', 'west', 'north-west'];
  const dirName = (p) => (Math.hypot(p[0], p[1]) < 1 ? 'middle' : DIR8[Math.round(brg(p) / 45) % 8]);

  // ---------- the arena ----------
  const BOSS = [0, 22];
  const HE = 17.3, HN = 14.3;                      // the farthest a spot goes toward the walls (18 and 15)
  const RECT = { shape: 'rect', a: [-18, -15], b: [18, 15] };
  // The map's looks: the rectangle's floor (x1_flr03, its top and underside a1_stc00/01), or Grand Cross's circle of 9
  // (a3_stc00/01) and its dome (u3_emv03); the carved arches overhead (a1_stc04) and the hands below always show.
  const FLOOR = ['a1_stc00', 'a1_stc01', 'x1_flr03'], CIRCLE = ['a3', 'u3'];
  const inBox = (p, m) => Math.abs(p[0]) <= HE - (m || 0) && Math.abs(p[1]) <= HN - (m || 0);
  const clampBox = (p) => [Math.max(-HE, Math.min(HE, p[0])), Math.max(-HN, Math.min(HN, p[1]))];
  // Eight players close round a point (the rest within rad of it).
  const CL = [[0, 0], ...Array.from({ length: 7 }, (_, i) => at(i * 360 / 7, 0.5))];
  const clusterAt = (c, slots, rad) => Object.fromEntries(slots.map((s, i) => [s, r2(add(c, rad ? (i ? at((i - 1) * 360 / Math.max(1, slots.length - 1), rad) : [0, 0]) : CL[i % 8]))]));
  const pairAt = (c, slots, gap) => Object.fromEntries(slots.map((s, i) => [s, r2(add(c, [(i - (slots.length - 1) / 2) * (gap || 0.6), 0]))]));

  // ---------- the strat's places ----------
  // The party's own: tanks at his front (max melee is 3 past the hitbox's edge, two yalms in), melee beside them, the
  // healers and ranged behind.
  const UP = { MT: [-1.5, 0.5], OT: [1.5, 0.5], M1: [-3.6, -0.4], M2: [3.6, -0.4], H1: [-4.5, -6], H2: [4.5, -6], R1: [-9, -6.5], R2: [9, -6.5] };
  const MID = clusterAt([0, -1], S, 1.0);
  const NW = [-HE, HN], NE = [HE, HN];
  // Hector's pair colours: MT/M1 red (1 north-west, A north), OT/M2 yellow (2, B), H2/R2 blue (3, C), H1/R1 purple
  // (4, D); each pair's intercard and cardinal (Grand Cross).
  const COLOR = { MT: 'red', M1: 'red', OT: 'yellow', M2: 'yellow', H2: 'blue', R2: 'blue', H1: 'purple', R1: 'purple' };
  const INTER = { red: 315, yellow: 45, blue: 135, purple: 225 }, CARD = { red: 0, yellow: 90, blue: 180, purple: 270 };
  // The stored Aetherblights: the shapes, and the strat's spots for them (out/sides: the sides past max melee; in/middle:
  // the middle under him), light-party stacks or partner pairs.
  const KIND = { out: 'Out', in: 'In', mid: 'Middle', sides: 'Sides' };
  const blightShapes = (k) => (k === 'out' ? [{ shape: 'circle', at: BOSS, r: 20 }]
    : k === 'in' ? [{ shape: 'donut', at: BOSS, r0: 16 }]
      : k === 'mid' ? [{ shape: 'rect', a: [-18, -15], b: [-6, 15] }, { shape: 'rect', a: [6, -15], b: [18, 15] }]
        : [{ shape: 'rect', a: [-6, -15], b: [6, 15] }]);
  function blightSpots(kind, four) {
    const os = kind === 'out' || kind === 'sides';
    if (!four) return os ? Object.assign(clusterAt([-8.6, 1.0], G1, 0.8), clusterAt([8.6, 1.0], G2, 0.8))
      : Object.assign(clusterAt([-3.0, 8.6], G1, 0.7), clusterAt([3.0, 8.6], G2, 0.7));
    // Partners one behind the other along the line from him (the cone at the support takes both).
    const out = {};
    const put = (sup, p, d) => { const u = unit(sub(p, BOSS)); out[sup] = r2(p); out[PARTNER[sup]] = r2(add(p, [u[0] * d, u[1] * d])); };
    if (os) { put('MT', [-7.8, 0.6], 0.6); put('H1', [-15.5, 3.8], 0.6); put('OT', [7.8, 0.6], 0.6); put('H2', [15.5, 3.8], 0.6); }
    else { put('MT', add(BOSS, at(188, 12.6)), 0.6); put('H1', add(BOSS, at(208, 9.6)), 0.5); put('OT', add(BOSS, at(172, 12.6)), 0.6); put('H2', add(BOSS, at(152, 9.6)), 0.5); }
    return out;
  }
  // Fear of Death's hands: two layouts (the kill's), either way round; the top four go to TMMT (west to east), the
  // bottom four to RHHR.
  const FOD = [
    [[-12, 10], [4, 10], [-4, 5], [12, 5], [-12, -4], [4, -4], [-4, -9], [12, -9]],
    [[-6, 11], [12, 11], [-12, 4], [6, 4], [-6, -3], [12, -3], [-12, -10], [6, -10]],
  ];
  const FRONT = ['MT', 'M1', 'M2', 'OT'], BACK = ['R1', 'H1', 'H2', 'R2'];
  // The jails (two circles of 9 here, side by side: the DPS's west, the tanks' and healers' east): each spot in its own.
  const JAIL_D = [-9, 0], JAIL_S = [9, 0];
  const JAIL = { MT: [9, 5.5], OT: [9, -5.5], H1: [3.5, 0], H2: [14.5, 0], M1: [-12.9, -3.9], M2: [-5.1, -3.9], R1: [-12.9, 3.9], R2: [-5.1, 3.9] };
  // Grand Cross's lasers: lines through the middle, never along a spot's bearing.
  const LASERS = [22.5, 67.5, 112.5, 157.5];

  // A line from p toward bearing deg: whether q is in it (len 24, half-width w/2 + m).
  const inLine = (p, deg, q, m, len) => inside({ shape: 'line', at: p, deg, len: len || 24, w: 6 }, q, m || 0);
  // A baiter's spot for a hand at h: about `d` out from it toward bearing `want` (or the nearest bearing to it that
  // works), on the floor, clear of the puddles `holes`, its line clear of the spots `others`, and nearer the hand
  // than any of them.
  function baitSpot(h, want, others, holes, d) {
    d = d || 4.6;
    for (const off of [0, -20, 20, -40, 40, -60, 60, -80, 80, -100, 100, -130, 130]) {
      for (const dd of [d, d + 0.8, d - 0.6]) {
        const deg = want + off, p = add(h, at(deg, dd));
        if (!inBox(p)) continue;
        if ((holes || []).some(c => dist(c, p) < 4.3)) continue;
        if (others.some(q => inLine(h, deg, q, 1.4) || dist(q, h) < dd + 1.5)) continue;
        return r2(p);
      }
    }
    return null;
  }

  // ---------- the pull ----------
  function plan(events, strat) {
    ensureP2(events);
    const P = { start: Object.assign({}, UP), prefs: [], hazards: [], checks: [], calls: [], marks: [], labels: new Map(), debuffs: [],
      boss: [{ t: 0, at: BOSS }], face: [{ t: 0, deg: 180 }], hitbox: [{ t: 0, r: 20 }], arena: [Object.assign({ t: 0 }, RECT)],
      looks: [{ t: 0, show: FLOOR }], form: [], untargetable: [] };
    let id = 0;
    P.notes = [];
    const hz = (o) => { const h = Object.assign({ id: ++id, react: 3 }, o); P.hazards.push(h); return h; };
    const pref = (t, spots) => P.prefs.push({ t: +t.toFixed(2), spots });
    const call = (t, text, o) => P.calls.push(Object.assign({ t: +t.toFixed(2), text, dur: 5 }, o));
    const label = (ev, text) => { if (ev) P.labels.set(ev, text); };
    const E = (name, t0, t1) => events.find(e => e.name === name && e.t >= t0 && e.t <= t1) || null;
    const EA = (name, t0, t1) => events.filter(e => e.name === name && e.t >= t0 && e.t <= t1);
    const castOf = (ev, d) => ev.t - (ev.cast || d || 5);
    const arena = (t, a) => P.arena.push(Object.assign({ t: +t.toFixed(2) }, a));
    const raid = (ev, dmg, text, d) => {
      if (!ev) return;
      const cs = castOf(ev, d);
      hz({ t: ev.t, tell: cs, raidwide: true, dmg, name: ev.name });
      if (text) call(cs, text, { dur: 3 });
    };
    const shapeHz = (s, o) => hz(Object.assign({}, s, o));
    const lane = (row) => { const c = { north: 10, middle: 0, south: -10 }[row]; return { shape: 'rect', a: [-18, c - 5], b: [18, c + 5] }; };
    const rowOf = (p) => (p[1] > 4.99 ? 'north' : p[1] < -4.99 ? 'south' : 'middle');

    // ===== Blue Shockwave: a two-hit tank buster, MT first (the north-west corner), OT second (north-east) =====
    function blueShockwave(b1, b2, o) {
      o = o || {};
      if (!b1) return;
      const t0 = b1.t - 7.2, t2 = b2 ? b2.t : b1.t + 4.1;
      hz({ t: b1.t, tell: t0, effect: 'bait', shape: 'cone', from: 'boss', aim: 'target', targets: ['MT'], half: 50, r: 60, snap: 0.4, dmg: 1.5, own: 0.55, buster: true, name: 'Blue Shockwave' });
      hz({ t: t2, tell: b1.t, effect: 'bait', shape: 'cone', from: 'boss', aim: 'target', targets: ['OT'], half: 50, r: 60, snap: 0.4, dmg: 1.5, own: 0.55, buster: true, name: 'Blue Shockwave' });
      if (!o.noSpots) {
        pref(o.goT ?? t0 + 0.3, Object.assign({}, MID, { MT: NW, OT: NE }));
        pref(t2 + 0.3, UP);
      }
      call(t0, 'Tank Buster: MT north-west corner, then OT north-east', { slot: 'MT', alert: true });
      call(t0, 'Tank Buster: MT first, then you (north-east corner)', { slot: 'OT', alert: true });
      for (const s of S) if (s !== 'MT' && s !== 'OT') call(t0, o.noSpots ? 'Tank busters: keep out of the corners' : 'Tank busters: middle, away from the tanks', { slot: s, dur: 4 });
      label(b1, 'Blue Shockwave (MT, north-west corner)');
      label(b2, 'Blue Shockwave (OT, north-east corner)');
    }

    // ===== Fear of Death: raidwide, eight hands, each one's line at its nearest player =====
    // Returns where each bait stood (The End's Embrace drops its hands there) and which way it baited.
    function fearOfDeath(fd) {
      const pud = E('Fear of Death (puddles)', fd.t, fd.t + 5), gr = E('Choking Grasp', fd.t, fd.t + 9);
      const cs = castOf(fd), tP = pud ? pud.t : fd.t + 3, tG = gr ? gr.t : tP + 2.8;
      raid(fd, 0.4, null);
      const lay = pick(FOD), m = pick([1, -1]), hands = lay.map(p => [p[0] * m, p[1]]);
      const byY = hands.slice().sort((a, b) => b[1] - a[1]);
      const front = byY.slice(0, 4).sort((a, b) => a[0] - b[0]), back = byY.slice(4).sort((a, b) => a[0] - b[0]);
      const handOf = Object.assign(Object.fromEntries(FRONT.map((s, i) => [s, front[i]])), Object.fromEntries(BACK.map((s, i) => [s, back[i]])));
      const spots = {}, dir = {};
      for (const s of S) {
        const h = handOf[s], f = FRONT.includes(s);
        const want = Math.abs(h[0]) >= 9 ? (h[0] < 0 ? 270 : 90) : (f ? 0 : 180);
        const others = Object.values(spots);
        const p = baitSpot(h, want, others, hands.filter(x => x !== h)) || r2(clampBox(add(h, at(want, 4.6))));
        if (!baitSpot(h, want, others, hands.filter(x => x !== h))) P.notes.push(`Fear of Death ${s}: no clean bait spot`);
        spots[s] = p;
        dir[s] = brg(sub(p, h));
      }
      // Each spot nearer its own hand than anyone (the lines go at the nearest).
      for (const s of S) for (const o of S) if (o !== s && dist(spots[o], handOf[s]) < dist(spots[s], handOf[s]) + 0.8) P.notes.push(`Fear of Death: ${o} near ${s}'s hand`);
      pref(cs + 0.4, spots);
      for (const h of hands) hz({ t: tP, tell: tP - 3, shape: 'circle', at: h, r: 3, dmg: 0.8, name: 'Fear of Death (puddle)' });
      for (const h of hands) hz({ t: tG, tell: tP, effect: 'bait', shape: 'line', from: h, aim: 'target', targets: { nearest: 1, of: h }, len: 24, w: 6, snap: 0.3, dmg: 1.0, own: 0.4, name: 'Choking Grasp' });
      call(cs, 'AoE', { dur: 3 });
      call(fd.t - 2, 'Bait Hand: your spread spot, the line out', { alert: true, dur: 5 });
      label(fd, 'Fear of Death (raidwide)');
      label(pud, 'Fear of Death (eight hands rise)');
      label(gr, 'Choking Grasp (each hand at its nearest)');
      return { spots, dir, hands: handOf, tG };
    }

    // ===== Cold Grip: the outer thirds, then Existential Dread the middle and one side =====
    function coldGrip(cg, ed, o) {
      if (!cg) return;
      o = o || {};
      const west = Math.random() < 0.5, s = west ? -1 : 1, cs = castOf(cg, 6);
      shapeHz({ shape: 'rect', a: [-18, -15], b: [-6, 15] }, { t: cg.t, tell: cs, dmg: 1.3, name: 'Cold Grip' });
      shapeHz({ shape: 'rect', a: [6, -15], b: [18, 15] }, { t: cg.t, tell: cs, dmg: 1.3, name: 'Cold Grip' });
      const tD = ed ? ed.t : cg.t + 1.7;
      shapeHz(west ? { shape: 'rect', a: [-6, -15], b: [18, 15] } : { shape: 'rect', a: [-18, -15], b: [6, 15] }, { t: tD, tell: cg.t - 0.2, dmg: 1.3, name: 'Existential Dread' });
      pref(o.goT ?? cs + 0.3, clusterAt([o.midX ?? s * 3.4, -1], S, o.midX !== undefined ? 0.45 : 1.0));
      pref(cg.t + 0.05, clusterAt([s * 10.5, -1], S, 1.2));
      pref(tD + 0.3, UP);
      call(o.callT ?? cs, `Middle => ${west ? 'West' : 'East'}`, { alert: true, dur: 6 });
      label(cg, `Cold Grip (middle, then ${west ? 'west' : 'east'})`);
      label(ed, `Existential Dread (${west ? 'west' : 'east'} safe)`);
    }

    // ===== Memento Mori: the middle line and voidzone, the hands out of it, the spreads =====
    function memento(mm, o) {
      o = o || {};
      const ch = E('Choking Grasp', mm.t, mm.t + 9), sm = o.spreads ? E('Smite of Gloom', mm.t, mm.t + 10) : null;
      const cs = castOf(mm), darkWest = Math.random() < 0.5, d = darkWest ? -1 : 1, tH = ch ? ch.t : mm.t + 6.2;
      shapeHz({ shape: 'rect', a: [-6, -15], b: [6, 15] }, { t: mm.t, tell: cs, dmg: 1.2, name: 'Memento Mori' });
      shapeHz({ shape: 'rect', a: [-6, -15], b: [6, 15] }, { t: mm.t + 1.1, tell: mm.t, lasts: 10, tick: 1, tickDmg: 0.3, dmg: 0.3, status: ['bleeding', 6], quiet: true, name: 'Memento Mori (the dark line)' });
      for (const y of [-12, -6, 6, 12]) hz({ t: tH, tell: tH - 3, shape: 'line', at: [d * 3, y], deg: darkWest ? 270 : 90, len: 24, w: 6, dmg: 1.0, name: 'Choking Grasp' });
      hz({ t: tH, tell: tH - 3, shape: 'line', at: [-d * 3, 0], deg: darkWest ? 90 : 270, len: 24, w: 6, dmg: 1.0, name: 'Choking Grasp' });
      if (sm) {
        hz({ t: sm.t, tell: castOf(sm, 4), effect: 'bait', shape: 'circle', from: 'target', targets: S.slice(), r: 9.6, snap: 0.2, dmg: 1.0, own: 0.4, name: 'Smite of Gloom' });
        // Tanks on the dark side (MT left, OT right) in the hands' gap; the rest on the light side, two columns of three.
        const dx = [d * 7.15, d * 17.3].sort((a, b) => a - b), lx = [-d * 7.15, -d * 17.3].sort((a, b) => a - b);
        const spots = { MT: [dx[0], 1.8], OT: [dx[1], -1.8], M1: [lx[0], HN], M2: [lx[1], HN], H1: [lx[0], -4.15], H2: [lx[1], -4.15], R1: [lx[0], -HN], R2: [lx[1], -HN] };
        pref(cs + 0.3, spots);
        pref(sm.t + 0.3, Object.assign(clusterAt([-9.5, -2], G1, 1.0), clusterAt([9.5, -2], G2, 1.0)));
        const cgN = E('Cold Grip', mm.t, mm.t + 30);
        if (!cgN || castOf(cgN, 6) > mm.t + 11.3) pref(mm.t + 11.3, UP);
        call(cs, `Light ${darkWest ? 'East' : 'West'} => Spread`, { alert: true, dur: 6 });
        for (const s of ['MT', 'OT']) call(cs + 1, `Dark side (${darkWest ? 'west' : 'east'}): spread ${s === 'MT' ? 'left' : 'right'} between the hands`, { slot: s, dur: 5 });
        label(sm, 'Smite of Gloom (spreads on everyone)');
      }
      label(mm, `Memento Mori (dark ${darkWest ? 'west' : 'east'})`);
      label(ch, `Choking Grasp (four hands ${darkWest ? 'west' : 'east'}, one ${darkWest ? 'east' : 'west'})`);
      return { darkWest, tH };
    }

    // ===== Soul Reaping and the blights: one stored Aetherblight, and the stacks =====
    function blight(ab, sw, kind, four, tell, spotsT) {
      for (const s of blightShapes(kind)) shapeHz(s, { t: ab.t, tell, dmg: 1.3, name: 'Aetherblight', react: 2.9 });
      if (sw) {
        hz({ t: sw.t, tell, effect: 'share', shape: 'cone', from: 'boss', aim: 'target', targets: four ? SUP.slice() : ['H1', 'H2'], half: 10, r: 60, min: four ? 2 : 4, max: four ? 2 : 4, dmg: 0.3, name: four ? 'Shockwave (partners)' : 'Shockwave (light parties)' });
      }
      if (spotsT !== undefined) pref(spotsT, blightSpots(kind, four));
    }
    const reaps = EA('Soul Reaping', 0, 9999), folds = EA('Twofold Blight/Fourfold Blight', 0, 9999);
    reaps.forEach((sr, k) => {
      const tb = folds[k];
      if (!tb) return;
      const ab = E('Aetherblight', tb.t, tb.t + 3), sw = E('Shockwave', tb.t, tb.t + 3);
      const kind = pick(['out', 'in', 'mid', 'sides']), four = Math.random() < 0.5, cs = castOf(tb);
      if (ab) blight(ab, sw, kind, four, cs, cs + 0.3);
      call(sr.t, k === 0 ? KIND[kind] : `Stored ${KIND[kind]}`, { dur: 4 });
      call(cs, `${KIND[kind]} + ${four ? 'Stack With Partner' : 'Healer Groups'}`, { alert: true, dur: 6 });
      pref((sw || ab || tb).t + 0.3, UP);
      label(sr, `Soul Reaping (stores ${KIND[kind].toLowerCase()})`);
      label(tb, four ? 'Fourfold Blight (partner stacks)' : 'Twofold Blight (light-party stacks)');
      label(ab, `Aetherblight (${KIND[kind].toLowerCase()} safe)`);
      label(sw, four ? 'Shockwave (partner cones at the supports)' : 'Shockwave (light-party cones at the healers)');
    });

    // ===== Phase 1 =====
    blueShockwave(E('Blue Shockwave 1', 0, 30), E('Blue Shockwave 2', 0, 34));
    const fod = EA('Fear of Death', 0, 9999).filter(e => e.cast);
    const fd1 = fod[0] && fearOfDeath(fod[0]);
    if (fod[0]) coldGrip(E('Cold Grip', fod[0].t, fod[0].t + 15), E('Existential Dread', fod[0].t, fod[0].t + 17), { goT: fd1.tG + 0.1 });
    const mm1 = E('Memento Mori', 0, 100);
    if (mm1) memento(mm1, { spreads: true });

    // --- Fear of Death 2 and The End's Embrace: spreads leave hands, each baited out and dodged; the tank busters ---
    const fd2e = fod[1], fd2 = fd2e && fearOfDeath(fd2e);
    const ee1 = fd2e && E("The End's Embrace", fd2e.t, fd2e.t + 15);
    if (ee1) {
      const gr = E('Choking Grasp', ee1.t, ee1.t + 9), tG = gr ? gr.t : ee1.t + 6.1;
      hz({ t: ee1.t, tell: ee1.t - 4, effect: 'bait', shape: 'circle', from: 'target', targets: S.slice(), r: 3, snap: 0.2, dmg: 0.6, own: 0.35, name: "The End's Embrace" });
      const step = {};
      for (const s of S) {
        const h = fd2.spots[s], others = S.filter(o => o !== s).map(o => step[o] || fd2.spots[o]);
        step[s] = baitSpot(h, fd2.dir[s], others, [], 2.4) || h;
        hz({ t: tG, tell: tG - 3, shape: 'line', from: h, aim: 'target', targets: { nearest: 1, of: h }, len: 24, w: 6, snap: 3.0, dmg: 1.0, name: 'Choking Grasp (a hand from The End\'s Embrace)' });
      }
      pref(ee1.t + 0.1, step);
      call(ee1.t - 4, 'Drop hand => Bait hand', { alert: true, dur: 4 });
      call(tG - 3, 'Out of your hand\'s line', { alert: true, dur: 3 });
      label(ee1, "The End's Embrace (spreads: each leaves a hand)");
      label(gr, 'Choking Grasp (the hands fire where they aimed)');
      blueShockwave(E('Blue Shockwave 1', ee1.t, ee1.t + 20), E('Blue Shockwave 2', ee1.t, ee1.t + 25), { goT: tG + 0.1 });
    }

    // ===== Grand Cross: the circle of 9, puddles, lasers, towers and spreads, the cross; Neutron Ring =====
    function grandCross(gc) {
      const W = (n) => EA(n, gc.t, gc.t + 50);
      const puds = W('Grand Cross (puddle)'), lines = W('Grand Cross (line)'), towers = W('Shock (tower)'), spr = W('Grand Cross (spread)');
      const prox = E('Grand Cross (intercards)', gc.t, gc.t + 45) || EA('Grand Cross', gc.t + 20, gc.t + 45).find(e => e.cast) || null;
      const nr = events.find(e => e.name === 'Neutron Ring' && e.kind !== 'cast' && e.t > gc.t && e.t < gc.t + 60);
      const cs = castOf(gc, 7), tEnd = nr ? nr.t : gc.t + 47;
      raid(gc, 0.5, 'Big AoE', 7);
      hz({ t: gc.t, tell: cs, shape: 'donut', at: [0, 0], r0: 9, dmg: 3, name: 'Grand Cross (the floor falls away)' });
      arena(gc.t + 1.1, { shape: 'circle', at: [0, 0], r: 9 });
      arena(tEnd + 0.2, RECT);
      P.looks.push({ t: +(gc.t + 1.1).toFixed(2), show: CIRCLE }, { t: +(tEnd + 0.2).toFixed(2), show: FLOOR });
      // The middle: the supports stacked on it, the DPS a yalm out toward their intercards (the puddles come on the
      // supports, then the DPS).
      const mid = Object.fromEntries(S.map(s => [s, SUP.includes(s) ? [0, 0] : r2(at(INTER[COLOR[s]], 1.0))]));
      pref(cs + 0.3, mid);
      // Puddles: four at a time, where the supports (then the DPS) stand as each starts: the party stacks in the
      // middle for two of them, then goes out.
      puds.forEach((p, k) => hz({ t: p.t, tell: p.t - 3, shape: 'circle', from: 'target', targets: k % 2 ? DPS.slice() : SUP.slice(), r: 3, snap: 3.0, dmg: 0.9, react: 1.0, name: 'Grand Cross (puddle)' }));
      lines.forEach((l) => hz({ t: l.t, tell: l.t - 3, shape: 'line', at: [0, 0], deg: pick(LASERS), len: 20, back: 20, w: 4, dmg: 1.2, react: 2.5, name: 'Grand Cross (laser)' }));
      const supFirst = Math.random() < 0.5, soak1 = supFirst ? SUP : DPS, soak2 = supFirst ? DPS : SUP;
      const roundSpots = (soakers, towerAt) => Object.fromEntries(S.map(s => {
        const c = COLOR[s], soak = soakers.includes(s), tb = towerAt === 'inter' ? INTER[c] : CARD[c], ob = towerAt === 'inter' ? CARD[c] : INTER[c];
        return [s, r2(at(soak ? tb : ob, soak ? 6.6 : 7.6))];
      }));
      const tower = (ev, soakers, where) => {
        if (!ev) return;
        for (const s of soakers) hz({ t: ev.t, tell: ev.t - 5, effect: 'tower', shape: 'circle', at: r2(at(where === 'inter' ? INTER[COLOR[s]] : CARD[COLOR[s]], 5.5)), r: 3, soak: 1, only: [s], dmg: 0.3, fail: 0.9, name: 'Shock (tower)' });
      };
      const spread = (ev, who) => { if (ev) hz({ t: ev.t, tell: ev.t - 5, effect: 'bait', shape: 'circle', from: 'target', targets: who.slice(), r: 3, snap: 0.2, dmg: 0.9, own: 0.35, name: 'Grand Cross (spread)' }); };
      if (puds[1]) pref(puds[1].t - 3 + 0.05, roundSpots(soak1, 'inter'));
      tower(towers[0], soak1, 'inter'); spread(spr[0], soak2);
      if (towers[0]) pref(towers[0].t + 0.1, roundSpots(soak2, 'card'));
      tower(towers[1], soak2, 'card'); spread(spr[1], soak1);
      if (towers[1]) pref(towers[1].t + 0.1, mid);
      // The cross: everyone to the pair's intercard, one behind the other.
      if (prox) {
        hz({ t: prox.t, tell: castOf(prox, 4), shape: 'cross', at: [0, 0], deg: 0, len: 20, w: 9, dmg: 1.4, react: 1.8, name: 'Grand Cross (the cross)' });
        const out = {};
        for (const s of S) out[s] = r2(at(INTER[COLOR[s]], 8.34));
        pref((puds[3] ? puds[3].t - 3 : prox.t - 2.5) + 0.05, out);
        pref((puds[3] ? Math.max(puds[3].t, prox.t) : prox.t) + 0.1, clusterAt([0, -1], S, 1.2));
        label(prox, 'Grand Cross (the cross: intercards safe)');
      }
      pref(tEnd + 0.3, UP);
      call(cs, 'Big AoE', { dur: 3 });
      call(gc.t, 'Bait Puddles: stack middle, then out', { alert: true, dur: 5 });
      if (towers[0]) for (const s of S) call(towers[0].t - 5, soak1.includes(s) ? `Get Towers (${dirName(at(INTER[COLOR[s]], 1))})` : `Spread (${dirName(at(CARD[COLOR[s]], 1))})`, { slot: s, alert: true, dur: 5 });
      if (towers[1]) for (const s of S) call(towers[1].t - 5, soak2.includes(s) ? `Get Towers (${dirName(at(CARD[COLOR[s]], 1))})` : `Spread (${dirName(at(INTER[COLOR[s]], 1))})`, { slot: s, alert: true, dur: 5 });
      call(gc.t + 26.5, 'Bait puddles => Intercardinals', { alert: true, dur: 5 });
      if (nr) { raid(nr, 0.5, null); call(nr.t - 9.7, 'AoE', { dur: 3 }); label(nr, 'Neutron Ring (raidwide; the floor comes back)'); }
      label(events.find(e => e.name === 'Neutron Ring' && e.kind === 'cast' && e.t > gc.t && e.t < tEnd), 'Neutron Ring (cast: a raidwide)');
      label(gc, 'Grand Cross (raidwide; the floor shrinks to a circle)');
      towers.forEach((t, k) => label(t, `Shock (towers at the ${k ? 'cardinals' : 'intercards'}: ${(k ? soak2 : soak1) === SUP ? 'supports' : 'DPS'})`));
      spr.forEach((t, k) => label(t, `Grand Cross (spreads: ${(k ? soak1 : soak2) === SUP ? 'supports' : 'DPS'})`));
      lines.forEach(l => label(l, 'Grand Cross (a laser through the middle)'));
      puds.forEach((p, k) => label(p, `Grand Cross (puddles on the ${k % 2 ? 'DPS' : 'supports'})`));
    }
    const gcs = EA('Grand Cross', 0, 9999).filter(e => e.anim || (!e.cast && EA('Shock (tower)', e.t, e.t + 30).length));
    gcs.forEach(grandCross);

    // ===== Adds: the Icy Hands' lines, the Beckoning Hands' busters =====
    const wavesEv = EA('Fear of Death (puddles)', 190, 240), doe = E('Darkness of Eternity', 240, 270);
    if (wavesEv.length) {
      const m = pick([1, -1]), M = (p) => [p[0] * m, p[1]];
      const SMALL = [[[-11, -8], [10, 5], [2, -11]], [[-3, 11], [6, -8], [-12, 1]], [[-3, -6], [5, 9], [11, 3]]].map(w => w.map(M));
      const BIG = [null, M([14, -6]), M([12, 11])];
      const tEnd = doe ? castOf(doe, 10) : 240.7, tStart = wavesEv[0].t + 2;
      P.untargetable.push([+tStart.toFixed(2), +tEnd.toFixed(2)]);
      const baiters = [['M1', 'M2', 'R1'], ['R2', 'H1', 'H2'], ['M1', 'M2', 'R1']];
      const home = clusterAt([0, -1], S, 1.2);
      // Each hand's baiter stands out past it (its line goes out of the arena), from when its last hand is done till
      // its hand's last cast; the rest wait in the middle.
      const held = {}, windows = [], spotOf = new Map();
      wavesEv.slice(0, 3).forEach((w, k) => {
        const hands = SMALL[k], big = BIG[k], all = big ? hands.concat([big]) : hands;
        for (const h of all) hz({ t: w.t, tell: w.t - 3, shape: 'circle', at: h, r: 3, dmg: 0.8, name: 'Fear of Death (a hand rises)' });
        const casts = [w.t + 7.9, w.t + 17.9].filter(t => t < tEnd - 0.5), last = casts[casts.length - 1] ?? w.t;
        const busy = () => Object.values(held).filter(v => v.until > w.t - 3).map(v => v.p);
        const place = (h, s, until) => {
          const p = baitSpot(h, brg(h), busy().concat([[0, -1]]), all.filter(x => x !== h)) || r2(clampBox(add(h, at(brg(h), 4.6))));
          const from = Math.max(w.t - 2.7, ...windows.filter(x => x.s === s).map(x => x.to + 0.05));
          held[s] = { p, until };
          spotOf.set(h, p);
          windows.push({ s, from, to: until + 0.2, h });
        };
        hands.forEach((h, i) => {
          place(h, baiters[k][i], last);
          for (const tc of casts) hz({ t: tc, tell: tc - 3, effect: 'bait', shape: 'line', from: h, aim: 'target', targets: { nearest: 1, of: h }, len: 24, w: 6, snap: 0.4, dmg: 0.9, own: 0.45, ifAlive: 0, name: 'Choking Grasp (an Icy Hand)' });
        });
        if (big) {
          const tank = k === 1 ? 'MT' : 'OT', tc = w.t + 4.0;
          place(big, tank, tc);
          hz({ t: tc, tell: tc - 3, effect: 'bait', shape: 'line', from: big, aim: 'target', targets: [tank], len: 24, w: 6, snap: 0.4, dmg: 1.6, own: 0.55, buster: true, ifAlive: 0, name: 'Muted Struggle' });
          call(w.t, `Big hand: provoke it and point its line out (${dirName(spotOf.get(big))})`, { slot: tank, alert: true, dur: 5 });
        }
        label(w, `Fear of Death (hands rise: wave ${k + 1})`);
      });
      const marks = [...new Set([tStart - 4, ...windows.flatMap(x => [x.from, x.to])])].filter(t => t < tEnd).sort((a, b) => a - b);
      for (const x of windows) if (x.s !== 'MT' && x.s !== 'OT') call(x.from + 0.1, `Bait your hand's line out (${dirName(spotOf.get(x.h))})`, { slot: x.s, dur: 4 });
      for (const t of marks) {
        const spots = Object.assign({}, home);
        for (const x of windows) if (t >= x.from - 1e-6 && t < x.to - 1e-6) spots[x.s] = spotOf.get(x.h);
        pref(t, spots);
      }
      label(E('Choking Grasp (lines)', 190, 240), 'Choking Grasp (the adds\' lines at their nearest)');
      call(wavesEv[0].t - 2, 'Adds: kill the hands; bait their lines out', { alert: true, dur: 5 });
    }
    if (doe) {
      raid(doe, 0.55, 'Big AoE', 10);
      label(doe, 'Darkness of Eternity (raidwide)');
      pref(castOf(doe, 10) + 0.2, UP);
    }
    const doe2 = doe && events.find(e => e.name === 'Darkness of Eternity' && e.t > doe.t && e.t < doe.t + 10);
    if (doe2) { raid(doe2, 0.5, null); label(doe2, 'Darkness of Eternity (the second hit)'); }

    // ===== The jails =====
    const inev = E('Inevitability', 240, 290), spawn = E('Add Spawn', 255, 300);
    const sp1 = events.find(e => e.name === 'Specter of Death' && e.t > 280);
    const p2 = sp1 ? sp1.t - 5 : null;
    if (inev) {
      const t0 = inev.t, tOut = p2 ? p2 - 4 : t0 + 54, sp = spawn ? spawn.t : t0 + 9.7, doom = t0 + 50;
      raid(inev, 0.15, null);
      arena(t0 + 0.1, { parts: [{ shape: 'circle', at: JAIL_D, r: 9 }, { shape: 'circle', at: JAIL_S, r: 9 }] });
      arena(tOut, RECT);
      P.form.push({ t: +(t0 + 0.1).toFixed(2), model: 'none' }, { t: +tOut.toFixed(2), model: null });
      if (doe2) P.untargetable.push([+doe2.t.toFixed(2), +(p2 || tOut + 4).toFixed(2)]);
      pref(t0 + 0.2, Object.assign({}, JAIL));
      // Tanks: Spreading Fear (interrupt it), then the hand's busters.
      call(sp + 1, 'Jail: interrupt Spreading Fear, then survive the busters', { slot: 'MT', alert: true, dur: 5 });
      call(sp + 1, 'Jail: interrupt Spreading Fear, then survive the busters', { slot: 'OT', alert: true, dur: 5 });
      for (let t = sp + 17.6; t < doom; t += 7.1) hz({ t: +t.toFixed(2), tell: +(t - 5).toFixed(2), effect: 'bait', shape: 'circle', from: 'target', targets: ['MT', 'OT'], r: 1.2, snap: 0.3, dmg: 0.8, own: 0.5, buster: true, ifAlive: 1, name: 'Choking Grasp (the tanks\' jail)' });
      // Healers: Necrotic Pulse's bleed, Chilling Fingers' Slow, then unavoidable hits.
      hz({ t: +(sp + 5.5).toFixed(2), tell: sp + 2.5, effect: 'bait', shape: 'circle', from: 'target', targets: ['H1', 'H2'], r: 1.2, snap: 0.3, dmg: 0.3, own: 0.2, status: ['bleeding', 15], ifAlive: 1, name: 'Necrotic Pulse' });
      hz({ t: +(sp + 12.6).toFixed(2), tell: sp + 7.6, effect: 'bait', shape: 'circle', from: 'target', targets: ['H1', 'H2'], r: 1.2, snap: 0.3, dmg: 0.3, own: 0.15, status: ['slow', 20], ifAlive: 1, name: 'Chilling Fingers' });
      for (const s of ['H1', 'H2']) { call(sp + 1, 'Jail: heal through the bleed', { slot: s, dur: 4 }); call(sp + 12.8, 'Cleanse Slow', { slot: s, alert: true, dur: 4 }); }
      for (let t = sp + 18.7; t < doom; t += 6.1) hz({ t: +t.toFixed(2), tell: +(t - 4).toFixed(2), effect: 'bait', shape: 'circle', from: 'target', targets: ['H1', 'H2'], r: 1.2, snap: 0.3, dmg: 0.4, own: 0.35, ifAlive: 1, name: 'Choking Grasp (the healers\' jail)' });
      // DPS: two hands' lines across their jail every five seconds.
      for (let t = sp + 5.5; t < doom - 1; t += 5.1) {
        const b = Math.random() * 360, b2 = b + 90 + (Math.random() * 40 - 20);
        for (const bb of [b, b2]) {
          const off = Math.random() * 4 - 2, p = add(add(JAIL_D, at(bb, 9.3)), at(bb + 90, off));
          hz({ t: +t.toFixed(2), tell: +(t - 3).toFixed(2), shape: 'line', at: r2(p), deg: deg360(bb + 180), len: 18.6, w: 6, dmg: 1.0, ifAlive: 1, name: 'Choking Grasp (the DPS jail)' });
        }
      }
      for (const s of DPS) call(sp + 1, 'Jail: dodge the lines, kill the hand that starts enraging first', { slot: s, dur: 5 });
      hz({ t: +doom.toFixed(2), tell: doom - 10, raidwide: true, dmg: 0.55, ifAlive: 1, name: 'Doom (the jail\'s hands still up)' });
      call(t0 + 1, 'Jails: kill your hands within 50 seconds', { alert: true, dur: 5 });
      label(inev, 'Inevitability (into the jails)');
      label(spawn, 'The jails\' Icy Hands (kill them before the Doom)');
      pref(tOut, UP);
    }

    // ===== Phase 2 =====
    // --- Specter of Death: two lanes, spreads in the third, The End's Embrace's hands, Cold Grip ---
    if (sp1) {
      const ee2 = E("The End's Embrace", sp1.t, sp1.t + 12), gr = ee2 && E('Choking Grasp', ee2.t, ee2.t + 9);
      const cg = gr && E('Cold Grip', gr.t, gr.t + 5), ed = cg && E('Existential Dread', cg.t, cg.t + 3);
      const cs = castOf(sp1, 5), tInv = sp1.t + 7.2, safe = pick(['north', 'middle', 'south']), c = { north: 10, middle: 0, south: -10 }[safe];
      for (const row of ['north', 'middle', 'south']) if (row !== safe) shapeHz(lane(row), { t: tInv, tell: sp1.t + 2.2, dmg: 1.5, name: 'Invitation (a giant hand)' });
      const xs = [-15, -5, 5, 15], spots = {};
      FRONT.forEach((s, i) => { spots[s] = [xs[i], c + 2.5]; });
      BACK.forEach((s, i) => { spots[s] = [xs[i], c - 2.5]; });
      pref(cs + 0.5, spots);
      call(cs + 1, `${safe[0].toUpperCase() + safe.slice(1)} Row + Spread`, { alert: true, dur: 6 });
      label(sp1, `Specter of Death (the ${safe} lane is safe)`);
      if (ee2) {
        const tG = gr ? gr.t : ee2.t + 6.1;
        hz({ t: ee2.t, tell: ee2.t - 4, effect: 'bait', shape: 'circle', from: 'target', targets: S.slice(), r: 3, snap: 0.2, dmg: 0.6, own: 0.35, name: "The End's Embrace" });
        const step = {};
        for (const s of S) {
          const h = spots[s], others = S.filter(o => o !== s).map(o => step[o] || spots[o]);
          step[s] = baitSpot(h, FRONT.includes(s) ? 0 : 180, others, [], 2.0) || h;
          hz({ t: tG, tell: tG - 3, shape: 'line', from: h, aim: 'target', targets: { nearest: 1, of: h }, len: 24, w: 6, snap: 3.0, dmg: 1.0, name: 'Choking Grasp (a hand from The End\'s Embrace)' });
        }
        pref(ee2.t + 0.1, step);
        call(ee2.t, 'Bait Hand => Dodge', { alert: true, dur: 4 });
        label(ee2, "The End's Embrace (spreads: each leaves a hand)");
        label(gr, 'Choking Grasp (the hands fire where they aimed)');
        coldGrip(cg, ed, { goT: tG - 3 + 0.1, midX: 0, callT: tG - 2.5 });
      }
    }

    // --- Relentless Reaping: four stored Aetherblights in a row, Crop Rotation, the stacks with the last ---
    for (const rr of EA('Relentless Reaping', 0, 9999)) {
      const crop = E('Crop Rotation', rr.t, rr.t + 10), season = E('The Second Season/The Fourth Season', rr.t, rr.t + 25);
      if (!season) continue;
      const abs = EA('Aetherblight', season.t, season.t + 12).slice(0, 4), sw = E('Shockwave', season.t, season.t + 13);
      const order = shuffle(['out', 'in', 'mid', 'sides']), k = Math.floor(Math.random() * 4), seq = order.slice(k).concat(order.slice(0, k));
      const four = Math.random() < 0.5, cs = castOf(season, 8);
      abs.forEach((ab, j) => blight(ab, j === abs.length - 1 ? sw : null, seq[j], four, j ? abs[j - 1].t - 1.5 : cs, j ? abs[j - 1].t + 0.05 : cs + 0.3));
      pref((sw || abs[abs.length - 1] || season).t + 0.3, UP);
      call(castOf(rr, 15), `Relentless Reaping: ${order.map(x => KIND[x]).join(', ')}`, { dur: 6 });
      call(cs, `${seq.map(x => KIND[x]).join(' => ')} + ${four ? 'Stack With Partner' : 'Healer Groups'}`, { alert: true, dur: 12 });
      label(rr, `Relentless Reaping (stores ${order.map(x => KIND[x].toLowerCase()).join(', ')})`);
      label(crop, `Crop Rotation (starts ${k ? `${k} on` : 'where it was'})`);
      label(season, four ? 'The Fourth Season (four in a row, then partner stacks)' : 'The Second Season (four in a row, then light-party stacks)');
      abs.forEach((ab, j) => label(ab, `Aetherblight ${j + 1} (${KIND[seq[j]].toLowerCase()} safe)`));
      label(sw, four ? 'Shockwave (partner cones at the supports)' : 'Shockwave (light-party cones at the healers)');
    }

    // --- Circle of Lives: the orbs' donuts in turn (in within 3), the giant hands' lanes ---
    const cols = EA('Circle of Lives', 0, 9999).filter(e => e.cast);
    cols.forEach((col, n) => {
      const circles = [1, 2, 3, 4, 5].map(k => E(`Circle of Lives ${k}`, col.t, col.t + 40)).filter(Boolean);
      const sps = EA('Specter of Death', col.t, col.t + 26);
      let orbs, lean = [];
      const lanes = [];
      if (n === 0) {
        const s = pick([-1, 1]), r = pick([1, -1]);
        orbs = [[12 * s, 10 * r], [12 * s, -10 * r], [0, 0], [-12 * s, -10 * r], [-12 * s, 10 * r]];
        if (sps[0]) lanes.push({ t: sps[0].t + 7.2, tell: sps[0].t + 2.2, row: pick(['north', 'middle', 'south']) });
      } else {
        orbs = shuffle([[-12, 5], [12, 5], [-12, -5], [12, -5]]);
        // The second and fourth come with a lane beside them: lean out of it.
        sps.slice(0, 2).forEach((sp, j) => {
          const o = orbs[2 * j + 1], row = pick(o[1] > 0 ? ['north', 'middle'] : ['south', 'middle']);
          lanes.push({ t: sp.t + 7.2, tell: sp.t + 2.2, row });
          lean[2 * j + 1] = row === 'middle' ? Math.sign(o[1]) : -Math.sign(o[1]);
        });
      }
      for (const L of lanes) shapeHz(lane(L.row), { t: L.t, tell: L.tell, dmg: 1.5, name: 'Invitation (a giant hand)' });
      circles.forEach((c, k) => {
        const o = orbs[k];
        hz({ t: c.t, tell: c.t - 7, shape: 'donut', at: o, r0: 3, dmg: 1.3, name: 'Circle of Lives' });
        const spot = lean[k] ? add(o, [0, 1.5 * lean[k]]) : o;
        pref(k ? circles[k - 1].t + 0.05 : castOf(col, 4) + 0.3, clusterAt(spot, S, lean[k] ? 0.3 : 0.6));
        let text = dirName(o);
        text = text[0].toUpperCase() + text.slice(1);
        if (n === 0 && lanes[0]) {
          if (k === 1 && lanes[0].row === rowOf(o)) text = `${text} => Dodge Hand`;
          if (k === 2 && lanes[0].row === rowOf(o)) text = `Wait for hand => ${text}`;
        }
        if (lean[k]) text = `${text}, lean ${lean[k] > 0 && o[1] < 0 ? 'middle' : lean[k] < 0 && o[1] > 0 ? 'middle' : lean[k] > 0 ? 'north' : 'south'}`;
        call(c.t - 6.8, text, { alert: true, dur: 6 });
        label(c, `Circle of Lives ${k + 1} (the ${dirName(o)} orb: in)`);
      });
      if (circles.length) pref(circles[circles.length - 1].t + 0.3, UP);
      label(col, 'Circle of Lives (the orbs\' donuts in turn)');
      sps.forEach((sp, j) => label(sp, `Specter of Death (a giant hand: the ${(lanes[j] || lanes[0] || { row: '?' }).row} lane)`));
    });

    // --- Mass Macabre: towers 4-2-3-3, with Memento Mori and the tank busters ---
    const mmk = E('Mass Macabre', 600, 9999) || E('Mass Macabre', 0, 9999);
    if (mmk) {
      const mm2 = E('Memento Mori', mmk.t, mmk.t + 12), b1 = E('Blue Shockwave 1', mmk.t, mmk.t + 30), b2 = b1 && E('Blue Shockwave 2', b1.t, b1.t + 6);
      const cs = castOf(mmk, 4), T4 = mmk.t + 2.2, T2 = mm2 ? mm2.t + 0.8 : T4 + 5.7;
      const tb1 = b1 ? b1.t : T2 + 10.8, tb2 = b2 ? b2.t : tb1 + 4.1;
      const mem = mm2 ? memento(mm2, { spreads: false }) : { tH: T2 + 5, darkWest: true };
      // The towers soak as their players get there: the north-east one after the hands when they're east (dark).
      const T3 = { NE: mem.darkWest ? tb1 - 4.8 : mem.tH + 2.4, SW: tb1 - 1.0, SE: tb2 - 1.0, NW: tb2 + 0.5 };
      const tower = (t, tell, p, who) => hz({ t: +t.toFixed(2), tell, effect: 'tower', shape: 'circle', at: p, r: 3, soak: [who.length, who.length], only: who, dmg: 0.3, fail: 0.9, status: ['magicVuln', 4], name: `Macabre Mark (${who.length}-person tower)` });
      tower(T4, cs, [0, 6], ['MT', 'OT', 'M1', 'M2']);
      tower(T4, cs, [0, -6], ['H1', 'H2', 'R1', 'R2']);
      const two = { NW: [[-15, 3], ['MT', 'M1']], NE: [[15, 3], ['OT', 'M2']], SW: [[-15, -3], ['H1', 'R1']], SE: [[15, -3], ['H2', 'R2']] };
      for (const [p, who] of Object.values(two)) tower(T2, T4, p, who);
      const g1 = ['H1', 'M1', 'R1'], g2 = ['H2', 'M2', 'R2'];
      const three = { NE: [[9, 12], g2], SW: [[-9, -12], g1], SE: [[9, -12], g2], NW: [[-9, 12], g1] };
      for (const [k, [p, who]] of Object.entries(three)) tower(T3[k], T2, p, who);
      blueShockwave(b1, b2, { noSpots: true });
      // The spots: the middle two, the side pairs, then the threes around the busters (the SW and SE soak spots the
      // east and west edges of their towers, clear of the cones).
      pref(cs + 0.3, Object.assign(clusterAt([0, 6.4], ['MT', 'OT', 'M1', 'M2'], 0.8), clusterAt([0, -6.4], ['H1', 'H2', 'R1', 'R2'], 0.8)));
      const pairs = {};
      for (const [p, who] of Object.values(two)) Object.assign(pairs, pairAt(p, who, 0.7));
      pref(T4 + 0.1, pairs);
      const sw3 = clusterAt([-7.0, -12.0], g1, 0.5), se3 = clusterAt([7.0, -12.0], g2, 0.5), ne3 = clusterAt([9, 11.6], g2, 0.6), nw3 = clusterAt([-9, 11.6], g1, 0.6);
      // Till the hands go off: the dark side's players wait in its gap (the middle row), the light side's go on.
      const dW = mem.darkWest;
      pref(T2 + 0.1, Object.assign({}, dW ? ne3 : clusterAt([9, 1.2], g2, 0.5), dW ? clusterAt([-9, -1.2], g1, 0.5) : sw3,
        { MT: dW ? [-13, 0] : NW, OT: dW ? NE : [13, 0] }));
      pref(mem.tH + 0.1, Object.assign({}, ne3, sw3, { MT: NW, OT: NE }));
      pref(T3.NE + 0.1, Object.assign({}, se3, sw3, { MT: NW, OT: NE }));
      pref(tb1 + 0.1, Object.assign({}, se3, nw3, { MT: NW, OT: NE }));
      pref(tb2 + 0.2, Object.assign({}, UP, nw3));
      pref(T3.NW + 0.2, UP);
      call(cs, 'Preposition for LP towers', { alert: true, dur: 5 });
      for (const s of S) call(T4 + 0.5, `Soak Next Tower (${dirName(two[Object.keys(two).find(k => two[k][1].includes(s))][0])})`, { slot: s, dur: 4 });
      for (const s of g2) { call(T2 + 0.5, 'Soak Next Tower (north-east, after the hands)', { slot: s, dur: 4 }); call(T3.NE + 0.5, 'Soak Next Tower (south-east)', { slot: s, dur: 4 }); }
      for (const s of g1) { call(T2 + 0.5, 'Soak Next Tower (south-west, east edge: the buster)', { slot: s, dur: 4 }); call(T3.SW + 0.5, 'Soak Next Tower (north-west, after the buster)', { slot: s, dur: 4 }); }
      label(mmk, 'Mass Macabre (towers 4-2-3-3)');
      if (mm2) label(mm2, `Memento Mori (dark ${mem.darkWest ? 'west' : 'east'}; no spreads)`);
    }

    // --- The rest: Fear of Death 3, Memento Mori 3 and the Cold Grips after Mass Macabre and Memento Mori ---
    for (const fd of fod.slice(2)) fearOfDeath(fd);
    const mm3 = EA('Memento Mori', 900, 9999).find(e => !mmk || e.t > mmk.t + 20) || (p2 ? EA('Memento Mori', p2, 9999).find(e => !mmk || e.t > mmk.t + 20) : null);
    if (mm3) memento(mm3, { spreads: true });
    for (const cg of EA('Cold Grip', p2 || 9999, 9999)) {
      if (sp1 && cg.t < sp1.t + 30) continue;           // Specter of Death's, done with it
      const mmB = EA('Memento Mori', cg.t - 30, cg.t).pop();
      coldGrip(cg, E('Existential Dread', cg.t, cg.t + 3), mmB && mmB.t + 11.15 > castOf(cg, 6) ? { goT: mmB.t + 11.15 } : {});
    }
    const enr = events.find(e => e.kind === 'enrage');
    if (enr) { label(enr, 'Darkness of Eternity (the enrage)'); call(castOf(enr, 10), 'Enrage', { alert: true, dur: 5 }); }
    for (const ev of EA('Shockwave', 0, 9999)) if (!P.labels.has(ev)) label(ev, 'Shockwave');

    P.arena.sort((a, b) => a.t - b.t);
    P.looks.sort((a, b) => a.t - b.t);
    return P;
  }

  // Phase 2, after the jails: export_map.py's main-line reading stops where cactbot's timeline branches into the
  // three jails (P2 resyncs there rather than rejoining at a label), so a map exported without the fix (scratch
  // fix_timeline.py) has no P2. Its events are added here then (cactbot's, cast times from the Action sheet; second 0
  // is P2's start, 58 s after Inevitability as in FFLogs), and the enrage moved to its end.
  const P2_START = 319.0;
  const P2_EVENTS = [
    [5, 'Specter of Death', 5], [13.1, "The End's Embrace", 0], [19.2, 'Choking Grasp', 3], [21.1, 'Cold Grip', 6], [22.8, 'Existential Dread', 1],
    [44.5, 'Relentless Reaping', 15], [50.6, 'Crop Rotation', 3], [61.7, 'The Second Season/The Fourth Season', 8],
    [62.9, 'Aetherblight', 1], [65.8, 'Aetherblight', 1], [68.7, 'Aetherblight', 1], [71.6, 'Aetherblight', 1], [71.7, 'Shockwave', 0],
    [82.5, 'Circle of Lives', 4], [92.6, 'Circle of Lives 1', 7], [93.2, 'Specter of Death', 5], [97.6, 'Circle of Lives 2', 7],
    [102.6, 'Circle of Lives 3', 7], [103.8, 'Soul Reaping', 4], [107.7, 'Circle of Lives 4', 7], [112.7, 'Circle of Lives 5', 7],
    [118, 'Twofold Blight/Fourfold Blight', 5], [119.2, 'Aetherblight', 1], [119.3, 'Shockwave', 0],
    [131.1, 'Mass Macabre', 4], [138.2, 'Memento Mori', 5, 11.1], [144.3, 'Choking Grasp', 3], [149.8, 'Blue Shockwave 1', 0],
    [153.9, 'Blue Shockwave 2', 0], [161, 'Cold Grip', 6], [162.7, 'Existential Dread', 1],
    [183.3, 'Relentless Reaping', 15], [189.4, 'Crop Rotation', 3], [200.5, 'The Second Season/The Fourth Season', 8],
    [201.7, 'Aetherblight', 1], [204.6, 'Aetherblight', 1], [207.5, 'Aetherblight', 1], [210.4, 'Aetherblight', 1], [210.5, 'Shockwave', 0],
    [217.2, 'Fear of Death', 5], [220.2, 'Fear of Death (puddles)', 3], [223, 'Choking Grasp', 0],
    [228.2, 'Circle of Lives', 4], [236.3, 'Specter of Death', 5], [238.3, 'Circle of Lives 1', 7], [243.3, 'Circle of Lives 2', 7],
    [246.1, 'Specter of Death', 5], [248.3, 'Circle of Lives 3', 7], [253.3, 'Circle of Lives 4', 7],
    [260.6, 'Memento Mori', 5, 11.1], [266.8, 'Choking Grasp', 3], [267.7, 'Smite of Gloom', 4], [275.8, 'Cold Grip', 6], [277.5, 'Existential Dread', 1],
    [289.2, 'Grand Cross', 0], [297.3, 'Grand Cross (puddle)', 3], [299.3, 'Grand Cross (puddle)', 3], [299.7, 'Grand Cross (line)', 0.3],
    [301.7, 'Grand Cross (line)', 0.3], [303.3, 'Shock (tower)', 5], [303.3, 'Grand Cross (spread)', 5], [306.4, 'Grand Cross (line)', 0.3],
    [310.4, 'Grand Cross (line)', 0.3], [313.2, 'Grand Cross (line)', 0.3], [314.4, 'Shock (tower)', 5], [314.4, 'Grand Cross (spread)', 5],
    [321.4, 'Grand Cross (puddle)', 3], [323.1, 'Grand Cross', 4], [323.4, 'Grand Cross (puddle)', 3],
    [333.3, 'Neutron Ring', 7, 0, 'cast'], [336, 'Neutron Ring', 0], [355.6, 'Darkness of Eternity', 10, 0, 'enrage'],
  ];
  function ensureP2(events) {
    if (events.some(e => e.name === 'Specter of Death')) return;
    for (const [t, name, cast, dur, kind] of P2_EVENTS) {
      const ev = { t: +(P2_START + t).toFixed(1), name, kind: kind || 'hit' };
      if (cast) ev.cast = cast;
      if (dur) ev.dur = dur;
      events.push(ev);
    }
    const enrage = events[events.length - 1].t;
    for (const d of [B.GAME_MAPS && B.GAME_MAPS.ex5 && B.GAME_MAPS.ex5.fight, B.app && B.app.fight && B.app.fight.key === 'ex5' && B.app.fight.data]) {
      if (d && d.enrage < enrage) d.enrage = enrage;
    }
  }

  B.FIGHT_SCRIPTS = B.FIGHT_SCRIPTS || {};
  B.FIGHT_SCRIPTS.ex5 = {
    // FFLogs' max HP in a kill (report 1FjAGCQLdzqYPyDT): Necron 92,718,920; the Icy and Beckoning Hands 463,218 each.
    hp: 92718920,
    // The adds (ten hands) while he's away; then the jails' hands (each role its own; one pool here), before the Doom.
    adds: [
      { from: 201.4, to: 240.7, hp: 4632180, share: 1, whileAway: true, name: 'Icy Hands' },
      { from: 270.5, to: 310.8, hp: 5500000, share: 1, whileAway: true, name: 'The jails\' Icy Hands' },
    ],
    pushes: [
      { from: 201.4, to: 240.7, adds: 0, name: 'The hands are down' },
      { from: 270.5, to: 315.0, adds: 1, name: 'Every jail is clear' },
    ],
    defaultStrat: 'hector',
    strats: {
      hector: { label: 'Hector' },
    },
    source: 'wtfdig.info/73/ex5; mechanics after BossMod (github.com/awgil/ffxiv_bossmod) and an FFLogs kill',
    // A north, B east, C south, D west; 1-4 the intercards (1 north-west, then clockwise), round the middle as Hector's
    // Grand Cross uses them.
    waymarks: [
      { label: 'A', at: [0, 7.5], color: 'red' }, { label: 'B', at: [7.5, 0], color: 'yellow' },
      { label: 'C', at: [0, -7.5], color: 'blue' }, { label: 'D', at: [-7.5, 0], color: 'purple' },
      { label: '1', at: [-5.3, 5.3], color: 'red', square: true }, { label: '2', at: [5.3, 5.3], color: 'yellow', square: true },
      { label: '3', at: [5.3, -5.3], color: 'blue', square: true }, { label: '4', at: [-5.3, -5.3], color: 'purple', square: true },
    ],
    plan,
  };
})(window.BLM);
