// UCoB, The Unending Coil of Bahamut (Ultimate): Twintania, Nael deus Darnus, Bahamut Prime, the adds phase and Golden
// Bahamut for the sim's party, on cactbot's timeline (04-sb/ultimate/unending_coil_ultimate, read along its main line),
// with the one strat wtfdig.info lists for it: NAUR (NA Ultimate Raiding). Spots are [east, north] yalms from the
// arena's middle; the arena is BossMod's circle of radius 22 (its edge stops you).
//
// The mechanics follow BossMod's UCOB module (github.com/awgil/ffxiv_bossmod, BossMod.Ultimate/Stormblood/Ultimate/
// UCOB), whose shapes and sizes come from the game's Action sheet, built with the sim's toolkit (js/mech.js). Where
// wtfdig gives only pictures, the spots are this script's own reading of NAUR's text. Phase by phase:
//   1. Twintania (100% to 0%, HP-pushed at 75% and 45%: each push leaves a Neurolink where she stood, the waymarks
//      1-3): Plummet (a 12-yalm frontal cone at her tank), Twister (a twister under everyone as the cast ends: move
//      off it), Fireball (a 4-yalm stack; the tanks and one healer stay out), Death Sentence, Liquid Hell (five 6-yalm
//      puddles chasing the physical ranged, live 1.8 s after each drops), Generate (the marked player takes the egg
//      in a Neurolink: an 8-yalm Hatch round them), Targeted Fire (Liquid Hell on a random player). cactbot loops each
//      block until the HP push; the script repeats the loops (without cast bars) so a slow party keeps playing.
//   2. Nael (killed, not timed): Heavensfall's knockback from the middle, Meteor Stream spreads between two waves
//      of Thermionic Burst slices, Dalamud Dive on the tank; Bahamut's Favor: the dragons' Chain Lightning (two
//      5-yalm spreads), Deathstorm's dooms cleansed in Wings of Salvation's puddles (the party drops them turning
//      clockwise round Nael), Firehorn's fireballs (in, out, in, in); Nael's quotes (Iron Chariot 8.55, Lunar Dynamo
//      6-22, Thermionic Beam stack, Raven Dive on a random player, Meteor Stream spreads, Dalamud Dive); the divebombs
//      (five dragons' 20-wide Cauterize lines baited on the edge 2-1-2, Hypernova's puddles); Bahamut's Claw,
//      Ravensbeak.
//   3. Bahamut Prime (timed: his HP here is an adds window, as the game's P3 damage doesn't carry to P5): Seventh
//      Umbral Era's knockback, Calamitous Flame/Blaze, Flare Breath (cone at the tank), Flatten, Gigaflare; the
//      trios: Quickmarch (three dives from new north, twisters, spreads, puddles, Earth Shaker cones, Tempest Wing
//      tethers, the stack), Blackfire (Liquid Hell on one player, Thermionic Beam, Megaflare Dive, Hypernova, the
//      four towers and the four-stack), Fellruin (Nael's quote, Tempest Wing, Aetheric Profusion soaked in the
//      Neurolinks, Meteor Stream), Heavensfall (dives, twisters, pepperoni puddles, the knockback into eight
//      towers, Thermionic Burst, Hypernova, the stack), Tenstrike (two sets of three Hatches, Meteor Streams, two sets
//      of Earth Shakers) and Grand Octet (Nael, five dragons and Bahamut diving at the party as it runs round the
//      edge, Twintania's dive, towers, the stack, twisters).
//   4. The adds phase: Twintania (the sim's target) and Nael (an adds window soaking half the damage) together, with
//      Bahamut waiting at the north edge: Plummet and Bahamut's Claw, Liquid Hell, three Hatches with twisters, two
//      triple quotes, Megaflare, Death Sentence and Ravensbeak.
//   5. Golden Bahamut: Teraflare, Morn Afah (everyone's stack), Akh Morn (the tanks' shared buster, 4 to 7 hits),
//      Exaflares from the edge.
// Simplified: tank swaps aren't played (the MT keeps Twintania, Nael and Bahamut; the OT Nael in the adds phase);
// Liquid Hell, Hypernova and Earth Shaker voidzones hit as they land and don't stay; the Iceclaw's iceballs and
// Thunderwing's paralysis, Twister's knock-up and Teraflare's wipe-and-revive are plain damage; enrages are labels.
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
  const unit = (v) => { const l = Math.hypot(v[0], v[1]) || 1; return [v[0] / l, v[1] / l]; };
  const r2 = (p) => [+p[0].toFixed(2), +p[1].toFixed(2)];
  const assign = (slots, pts) => Object.fromEntries(slots.map((s, i) => [s, pts[i]]));
  const TANKS = ['MT', 'OT'], NT = S.filter(s => !TANKS.includes(s)), DPS = ['M1', 'M2', 'R1', 'R2'];
  // Quickmarch's columns (wtfdig's setup): L1-L4 and R1-R4, northmost first.
  const QL = ['MT', 'H1', 'M1', 'R1'], QR = ['OT', 'H2', 'M2', 'R2'];
  const COMPASS = ['north', 'north-east', 'east', 'south-east', 'south', 'south-west', 'west', 'north-west'];
  const dirName = (d) => COMPASS[Math.round(deg360(d) / 45) % 8];

  // ---------- the floor ----------
  const RAD = 22;
  const ARENA = { shape: 'circle', at: [0, 0], r: RAD };
  const onFloor = (m) => (p) => Math.hypot(p[0], p[1]) < RAD - (m === undefined ? 1 : m);
  const FLOOR = onFloor(1.2);
  // The three Neurolinks (waymarks 1-3), where Twintania is tanked as she reaches 75%, 45% and 0%: 1 and 3 either side
  // of the north, 2 in the south (the adds phase is tanked between 1 and 3).
  const NL = { 1: [-11, 4], 2: [0, -12], 3: [11, 4] };

  // ---------- placing the party ----------
  // Each [slot, want, sep] in turn: the nearest point to `want` on the floor, clear of the shapes in `avoid` (by m)
  // and at least sep from those already placed.
  function place(list, o) {
    o = o || {};
    const m = o.m === undefined ? 1.3 : o.m, avoid = o.avoid || [], floor = o.floor || FLOOR, done = (o.keep || []).map(p => ({ p, sep: o.keepSep || 0 }));
    const out = {};
    for (const [s, want, sp] of list) {
      const sep = sp === undefined ? (o.sep === undefined ? 0.6 : o.sep) : sp;
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
  // A walk along points from second t0 (a spot that moves: a pref that's a function of the second).
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
  // Points along an arc round c (radius r) from bearing b0 to b1, every `step` degrees.
  const arc = (c, r, b0, b1, step) => {
    const n = Math.max(1, Math.round(Math.abs(b1 - b0) / (step || 10)));
    return Array.from({ length: n + 1 }, (_, i) => r2(add(c, at(b0 + (b1 - b0) * i / n, r))));
  };

  // ---------- the pull ----------
  function plan(events, strat) {
    const P = { start: null, prefs: [], hazards: [], checks: [], calls: [], marks: [], labels: new Map(), debuffs: [],
      boss: [], hitbox: [], form: [], others: [], untargetable: [], arena: [{ t: 0, ...ARENA }] };
    let id = 0;
    const hz = (o) => { const h = Object.assign({ id: ++id, react: 3 }, o); P.hazards.push(h); return h; };
    const pref = (t, spots) => P.prefs.push({ t, spots });
    const call = (t, text, o) => P.calls.push(Object.assign({ t, text, dur: 5 }, o));
    const debuff = (slot, key, name, hint, t0, t1) => P.debuffs.push({ slot, key, name, hint, t0, t1 });
    const mark = (shape, t0, t1, fill) => P.marks.push(Object.assign({ kind: 'lit', t0, t1, fill }, shape));
    const E = (name, t0, t1) => events.find(e => e.name === name && e.t >= t0 && e.t <= t1) || null;
    const EA = (re, t0, t1) => events.filter(e => re.test(e.name) && e.t >= t0 && e.t <= t1);
    const T = (name, t0, t1, d) => { const e = E(name, t0, t1); return e ? e.t : d; };
    const label = (e, text) => { if (e) P.labels.set(e, text); };
    const bossAt = (t, p, move) => P.boss.push({ t, at: r2(p), move });
    const other = (model, path, shows, face) => P.others.push({ model, path: path.map(k => ({ t: k.t, at: r2(k.at), move: k.move })), shows, face });

    // The game's standard attacks.
    const raid = (t, dmg, name, tell) => hz({ t, tell: tell === undefined ? t - 4 : tell, raidwide: true, dmg, name });
    const buster = (t, slot, name, o) => hz(Object.assign({ t, tell: t - 4, effect: 'bait', shape: 'circle', from: 'target', targets: [slot], r: 0.2, dmg: 1.0, own: 0.5, buster: true, name }, o));
    const cleave = (t, slot, r, half, name, o) => hz(Object.assign({ t, tell: t - 3, effect: 'bait', shape: 'cone', from: 'boss', aim: 'target', targets: [slot], r, half, dmg: 1.0, own: 0.45, buster: true, name }, o));
    const spreads = (t, slots, r, name, o) => hz(Object.assign({ t, tell: t - 4, effect: 'bait', shape: 'circle', from: 'target', targets: slots, r, dmg: 0.9, own: 0.3, name }, o));
    const stack = (t, slot, r, min, max, name, o) => hz(Object.assign({ t, tell: t - 4, effect: 'share', shape: 'circle', from: 'target', targets: [slot], r, min, max, dmg: 0.35, name }, o));
    const tower = (t, p, r, soak, only, name, o) => hz(Object.assign({ t, tell: t - 4, effect: 'tower', shape: 'circle', at: p, r, soak, only, dmg: 0.3, fail: 0.9, name }, o));
    // Twister: as its cast ends a twister rises under everyone (0.3 s on), and catches whoever's still on it a second later.
    const twisters = (tEnd, name) => {
      hz({ t: tEnd + 1.3, tell: tEnd - 2, shape: 'circle', from: 'target', targets: S.slice(), r: 1.25, snap: 1.0, dmg: 1.0, name: name || 'Twister' });
      return tEnd + 0.35;                               // free to move off it
    };
    // Liquid Hell (and Targeted Fire, Hypernova): a puddle where the target stands as each drops, live `live` s later.
    const puddles = (t0, n, every, slot, r, name, o) => {
      const out = [];
      for (let k = 0; k < n; k++) {
        const live = (o && o.live) || 1.8;
        out.push(hz(Object.assign({ t: t0 + k * every + live, tell: t0 + k * every - 1, shape: 'circle', from: 'target', targets: [slot], r, snap: live, dmg: 0.9, name }, o)));
      }
      return out;
    };
    // Hatch: the marked player takes the egg in a Neurolink; it bursts 8 yalms round them.
    const hatch = (t, tIcon, slot, nl) => {
      tower(t, nl, 2, 1, [slot], 'Hatch (Neurolink)', { tell: tIcon });
      hz({ t, tell: t - 1.5, effect: 'bait', shape: 'circle', from: 'target', targets: [slot], r: 8, dmg: 0.9, own: 0.2, name: 'Hatch' });
      debuff(slot, 'manaHypersensitivity', 'Generate', 'take the egg in a Neurolink', tIcon, t);
      call(tIcon, `Hatch on YOU: Neurolink ${nlName(nl)}`, { slot, alert: true, dur: 4 });
    };
    const nlName = (p) => (p === NL[1] ? '1' : p === NL[2] ? '2' : '3');
    const nlMark = (k, t0) => mark({ shape: 'circle', at: NL[k], r: 2 }, t0, 1e9, 'rgba(110,190,255,0.28)');

    // ======================================================================== Phase 1: Twintania
    // Twintania tanked at T, facing out: the MT in front of her, the OT beside her, everyone else behind toward the
    // middle (Q, where the stacks go).
    const twin = (Tp) => {
      const out = unit(Tp), side = [out[1], -out[0]], Q = add(Tp, mul(out, -7.5));
      const base = {
        MT: add(Tp, mul(out, 5.5)), OT: add(Tp, mul(side, 5.4)),
        M1: add(add(Q, mul(out, 2.4)), mul(side, -1.8)), M2: add(add(Q, mul(out, 2.4)), mul(side, 1.8)),
        H1: add(Q, mul(side, -3)), H2: add(Q, mul(side, 3)),
        R1: add(add(Q, mul(out, -3)), mul(side, -2.5)), R2: add(add(Q, mul(out, -3)), mul(side, 2.5)),
      };
      // Twister: a rough spread round Q (the non-tanks), then in to Q.
      const inward = brg(mul(out, -1));
      const rough = Object.assign({ MT: base.MT, OT: base.OT }, assign(['H1', 'M1', 'R1', 'R2', 'M2', 'H2'], [-75, -45, -15, 15, 45, 75].map(d => r2(add(Q, at(inward + d, 4.4))))));
      return { T: Tp, out, side, Q, base: Object.fromEntries(Object.entries(base).map(([k, v]) => [k, r2(v)])), rough };
    };
    // A loop of cactbot's (its abilities at their seconds), repeated every `period` until `end`: [name, second, k].
    const loop = (items, period, end) => {
      const out = [];
      for (let k = 0; ; k++) {
        const it = items.map(([n, t]) => [n, t + k * period, k]);
        if (it[0][1] > end) break;
        out.push(...it.filter(x => x[1] < end));
      }
      return out;
    };
    const p1Fireball = (g, tw, fb, k) => {
      const tgt = pick(NT), outH = tgt === 'H1' ? 'H2' : 'H1', in5 = NT.filter(s => s !== outH);
      stack(fb, tgt, 4, 5, 5, 'Fireball', { tell: tw - 2.1 });
      pref(tw + 0.35, Object.assign({}, g.base, clumpAt(in5, g.Q), { [outH]: r2(add(g.Q, mul(g.out, -6.5))) }));
      pref(fb + 0.2, g.base);
      call(tw - 2.1, `Fireball on ${tgt}: stack (tanks and ${outH} out)`, { dur: 4 });
      if (!k) label(E('Fireball', fb - 0.5, fb + 0.5), `Fireball (on ${tgt})`);
    };
    const p1Twister = (g, tw, then) => {
      pref(tw - 2, g.rough);
      twisters(tw);
      call(tw - 2, 'Twister: spread, then move', { dur: 3 });
      if (then !== false) pref(tw + 0.35, then || g.base);
    };

    // --- 100% to 75%: Twintania at Neurolink 1's spot ---
    const A = twin(NL[1]);
    P.start = Object.assign({}, A.base);
    bossAt(0, A.T);
    P.hitbox.push({ t: 0, r: 3.96 });
    const endA = 97;
    cleave(T('Plummet', 5, 8, 6.5), 'MT', 12, 60, 'Plummet');
    for (const [n, t, k] of loop([['Twister', T('Twister', 10, 14, 12.6)], ['Fireball', T('Fireball', 14, 17, 15.8)], ['Death Sentence', T('Death Sentence', 22, 25, 23.9)], ['Plummet', T('Plummet', 26, 28, 27.0)]], 19.6, endA)) {
      if (n === 'Twister') { p1Twister(A, t, false); p1Fireball(A, t, t + 3.2, k); }
      if (n === 'Death Sentence') buster(t, 'MT', 'Death Sentence');
      if (n === 'Plummet') cleave(t, 'MT', 12, 60, 'Plummet');
    }

    // --- 75% to 45%: Neurolink 1 drops; Twintania to Neurolink 2's spot; Liquid Hell on the physical ranged ---
    const tB = 100, Bq = twin(NL[2]);
    nlMark(1, tB);
    bossAt(tB, Bq.T, 3);
    pref(tB, Bq.base);
    call(tB, 'Neurolink 1: Twintania to 2', { dur: 4 });
    // R1 runs an arc along the north edge (325 to 55 degrees), then back in.
    const lhArcB = arc([0, 0], 17, 325, 415, 15);
    const liquidHell = (t, arcPts, baiter, back) => {
      puddles(t, 5, 1.15, baiter, 6, 'Liquid Hell');
      pref(t - 3.5, { [baiter]: arcPts[0] });
      pref(t - 0.2, { [baiter]: walkPath(arcPts.concat([back]), t - 0.2, 5.4) });
      call(t - 3.5, 'Liquid Hell: run the edge', { slot: baiter, alert: true, dur: 4 });
    };
    let hatchers = [];
    for (const [n, t, k] of loop([['Liquid Hell x5', T('Liquid Hell x5', 106, 110, 108.5)], ['Generate', T('Generate', 115, 119, 117.3)], ['Liquid Hell x5', T('Liquid Hell x5', 119, 122, 120.6)],
      ['Death Sentence', T('Death Sentence', 130, 134, 132.3)], ['Generate', T('Generate', 137, 141, 139.3)], ['Twister', T('Twister', 141, 144, 142.3)], ['Plummet', T('Plummet', 147, 150, 148.3)]], 44.9, 197)) {
      if (n === 'Liquid Hell x5') liquidHell(t, lhArcB, 'R1', Bq.base.R1);
      else if (n === 'Generate') {
        const x = pick(NT.filter(s => s !== 'R1'));
        const withTwister = t > 130 + k * 44.9;            // the second Generate: the twister comes first
        const hT = withTwister ? t + 4.5 : t + 4;
        if (withTwister) {
          const wait = r2(add(NL[1], mul(unit(sub([0, 0], NL[1])), 3.6)));
          pref(t - 3, { [x]: wait });
          pref(t + 3.35, { [x]: NL[1] });
          hatchers.push({ x, t0: t - 3, t1: hT });
        } else pref(t - 3, { [x]: NL[1] });
        hatch(hT, t - 3, x, NL[1]);
        pref(hT + 0.1, { [x]: Bq.base[x] });
      } else if (n === 'Twister') {
        // (The Hatch player drops theirs by the Neurolink, then steps in.)
        const h = hatchers[hatchers.length - 1], rough = Object.assign({}, Bq.rough);
        if (h) delete rough[h.x];
        pref(t - 2, rough);
        twisters(t);
        const back = Object.assign({}, Bq.base);
        if (h) delete back[h.x];
        pref(t + 0.35, back);
        call(t - 2, 'Twister: drop it outside the Neurolink', { dur: 3 });
      } else if (n === 'Death Sentence') buster(t, 'MT', 'Death Sentence');
      else if (n === 'Plummet') cleave(t, 'MT', 12, 60, 'Plummet');
    }

    // --- 45% to 0%: Neurolink 2 drops; Twintania to Neurolink 3's spot; two Hatches at a time, Targeted Fire ---
    const tC = 200, Cq = twin(NL[3]);
    nlMark(2, tC);
    bossAt(tC, Cq.T, 4);
    pref(tC, Cq.base);
    call(tC, 'Neurolink 2: Twintania to 3', { dur: 4 });
    const lhArcC = arc([0, 0], 17.5, 322, 398, 12);
    liquidHell(T('Liquid Hell x5', 206, 210, 208.4), lhArcC, 'R1', Cq.base.R1);
    let gens = [], tfY = null;
    for (const [n, t, k] of loop([['Generate x2', T('Generate x2', 215, 219, 217.2)], ['Targeted Fire x5', T('Targeted Fire x5', 219, 222, 220.4)], ['Fireball', T('Fireball', 226, 229, 227.4)],
      ['Death Sentence', T('Death Sentence', 234, 238, 236.4)], ['Plummet', T('Plummet', 238, 241, 239.4)], ['Generate x2', T('Generate x2', 245, 248, 246.4)], ['Twister', T('Twister', 248, 251, 249.4)],
      ['Plummet', T('Plummet', 253, 256, 254.4)], ['Liquid Hell x5', T('Liquid Hell x5', 255, 258, 256.6)]], 48.3, 397)) {
      if (n === 'Generate x2') {
        const xs = shuffle(NT.filter(s => s !== 'R1')).slice(0, 2), withTwister = gens.length % 2 === 1;
        gens.push({ t, xs });
        const hT = withTwister ? t + 4.5 : t + 4;
        xs.forEach((x, j) => {
          const nl = j ? NL[2] : NL[1];
          if (withTwister) {
            pref(t - 3, { [x]: r2(add(nl, mul(unit(sub(Cq.Q, nl)), 3.6))) });
            pref(t + 3.35, { [x]: nl });
          } else pref(t - 3, { [x]: nl });
          hatch(hT, t - 3, x, nl);
          pref(hT + 0.1, { [x]: Cq.base[x] });
        });
      } else if (n === 'Targeted Fire x5') {
        // On a random player (not a Hatch): five puddles along the north edge, clear of the party (who stack without them).
        const xs = gens[gens.length - 1].xs, y = pick(NT.filter(s => s !== 'R1' && !xs.includes(s)));
        tfY = y;
        puddles(t, 5, 1.15, y, 6, 'Targeted Fire');
        pref(t - 3.5, { [y]: lhArcC[0] });
        pref(t - 0.1, { [y]: walkPath(lhArcC.concat([Cq.base[y]]), t - 0.1, 5.4) });
        call(t - 3.5, 'Puddles on YOU: run the north edge', { slot: y, alert: true, dur: 4 });
        label(k ? null : E('Targeted Fire x5', t - 0.5, t + 0.5), `Targeted Fire x5 (on ${y})`);
      } else if (n === 'Fireball') {
        const tgt = pick(NT.filter(s => s !== tfY)), outH = tgt === 'H1' ? 'H2' : 'H1', inn = NT.filter(s => s !== outH && s !== tfY);
        stack(t, tgt, 4, inn.length, inn.length, 'Fireball', { tell: t - 5 });
        pref(t - 1.8, Object.assign(clumpAt(inn, Cq.Q), { [outH]: r2(add(Cq.Q, mul(Cq.out, -6.5))) }));
        const back = Object.assign({}, Cq.base);
        if (tfY) delete back[tfY];
        pref(t + 0.2, back);
        call(t - 5, `Fireball on ${tgt}: stack (the tanks, ${outH} and the puddles out)`, { dur: 4 });
      } else if (n === 'Twister') {
        const xs = gens[gens.length - 1].xs, rough = Object.assign({}, Cq.rough);
        xs.forEach(x => delete rough[x]);
        pref(t - 2, rough);
        twisters(t);
        const back = Object.assign({}, Cq.base);
        xs.forEach(x => delete back[x]);
        pref(t + 0.35, back);
        call(t - 2, 'Twister: drop it outside the Neurolinks', { dur: 3 });
      } else if (n === 'Death Sentence') buster(t, 'MT', 'Death Sentence');
      else if (n === 'Plummet') cleave(t, 'MT', 12, 60, 'Plummet');
      else if (n === 'Liquid Hell x5') liquidHell(t, lhArcC, 'R1', Cq.base.R1);
    }

    // ======================================================================== Phase 2: Nael deus Darnus
    // Twintania falls at Neurolink 3's spot; Ragnarok's Heavensfall, then Nael dives on the tank.
    const tP2 = 400;
    nlMark(3, tP2);
    P.untargetable.push([tP2, T('Bahamut\'s Claw x5', 419, 423, 421.2) - 0.1]);
    P.form.push({ t: tP2, model: 'none' });
    bossAt(tP2, [0, 0]);
    const tHF = T('Heavensfall', 404, 410, 407.5), D_STACK = [-4, 0];
    pref(tP2 + 0.5, clumpAt(S, D_STACK));
    call(tP2 + 0.5, 'Stack west of the middle (D) for the knockback', { alert: true, dur: 5 });
    hz({ t: tHF, tell: tHF - 4, effect: 'knockback', at: [0, 0], dist: 11, dmg: 0, name: 'Heavensfall' });
    raid(tHF, 0.4, 'Heavensfall');
    const tMS1 = T('Meteor Stream', 411, 414, 413.0), tMS2 = T('Meteor Stream', 415, 418, 416.1);
    const tTB1 = T('Thermionic Burst', 413, 416, 414.5), tTB2 = T('Thermionic Burst', 417, 420, 418.6), tDD = T('Dalamud Dive', 418, 421, 419.1);
    // Thermionic Burst: eight 22.5-degree slices from the middle (on the intercards-and-a-half), then the eight between.
    const off = pick([0, 22.5]);
    [[tTB1, off + 22.5], [tTB2, off]].forEach(([tb, o]) => {
      for (let k = 0; k < 8; k++) hz({ t: tb, tell: tb - 3, shape: 'cone', at: [0, 0], deg: o + 45 * k, half: 11.25, r: 24.5, dmg: 1.0, name: 'Thermionic Burst', react: 3 });
    });
    // Spread in the first wave's gaps on the west half (two rings), then turn a half-slice clockwise into its slices.
    const sp1 = { MT: [270, 17], OT: [225, 17], H1: [315, 10], H2: [225, 10], M1: [270, 10], M2: [180, 10], R1: [315, 17], R2: [180, 17] };
    const spAt = (rot) => Object.fromEntries(Object.entries(sp1).map(([s, [b, r]]) => [s, r2(at(b + off + rot, r))]));
    pref(tHF + 0.6, spAt(0));
    pref(tTB1 + 0.05, spAt(22.5));
    spreads(tMS1, ['MT', 'H1', 'M1', 'R1'], 4, 'Meteor Stream', { tell: tHF + 0.5 });
    spreads(tMS2, ['OT', 'H2', 'M2', 'R2'], 4, 'Meteor Stream', { tell: tHF + 0.5 });
    buster(tDD, 'MT', 'Dalamud Dive', { r: 5, tell: tTB1 });
    call(tHF + 0.5, 'Spread between the slices; the tank takes the dive', { alert: true, dur: 5 });
    // Nael lands on the tank, who brings her to the middle.
    const ddSpot = spAt(22.5).MT;
    P.form.push({ t: tDD, model: 'nael' });
    P.hitbox.push({ t: tDD, r: 2.55 });
    bossAt(tDD, ddSpot);
    bossAt(tDD + 1, [0, 0], 3);

    // --- Bahamut's Favor: the dragons, the dooms, the fireballs and the quotes ---
    // The five dragons on the edge (they dive in the divebombs later), north and then clockwise every 72 degrees.
    const drRot = Math.random() * 72;
    const DRAGONS = shuffle(['firehorn', 'iceclaw', 'thunderwing', 'tail', 'fang']);
    const drAt = (k) => r2(at(drRot + 72 * k, 23));
    const tFav = T('Bahamut\'s Favor', 425, 435, 430.2);
    // Nael's quotes: each piece's shape and where the party stands for it, round Nael at n, on side th.
    const NAME = { dynamo: 'Lunar Dynamo', chariot: 'Iron Chariot', beam: 'Thermionic Beam', dive: 'Raven Dive', meteor: 'Meteor Stream' };
    // The party's roles by second (a list of {t0, t1, slot, p}): later entries win; anyone without one stands in the clump.
    const p2 = { roles: [], clump: [] };          // clump: [{t, c}] the clump's middle from second t
    const role = (t0, t1, slot, p) => p2.roles.push({ t0, t1, slot, p });
    const clumpFrom = (t, c) => p2.clump.push({ t, c: r2(c) });
    const quotePiece = (t, kind, n, th, members, tell) => {
      if (kind === 'dynamo') hz({ t, tell, shape: 'donut', at: n, r0: 6, r1: 40, dmg: 1.2, name: NAME.dynamo, react: 4 });
      else if (kind === 'chariot') hz({ t, tell, shape: 'circle', at: n, r: 8.55, dmg: 1.2, name: NAME.chariot, react: 4 });
      else if (kind === 'beam') stack(t, pick(members), 4, members.length, 8, NAME.beam, { tell });
    };
    // A Raven Dive: everyone spread round Nael; she jumps on one of them (3 yalms, knocking back anyone close).
    const ravenDive = (t, n, th, tell) => {
      const ring = Object.fromEntries(S.map((s, i) => [s, r2(add(n, at(th + 45 * i, 6.5)))]));
      const tgt = pick(S);
      hz({ t, tell, effect: 'bait', shape: 'circle', from: 'target', targets: [tgt], r: 3, dmg: 1.0, own: 0.4, name: NAME.dive });
      return { ring, tgt, land: ring[tgt] };
    };
    const IN = (n, th) => add(n, at(th, 3.0)), OUTP = (n, th) => add(n, at(th, 11));

    let th = 180;                                     // the party's side of Nael (it turns clockwise with the puddles)
    clumpFrom(tDD + 2, IN([0, 0], th));
    // Thunderwing's Chain Lightning: two players hold their 5-yalm burst clear of the clump, inside Lunar Dynamo's range.
    const chain = (t, pair) => {
      spreads(t, pair, 5, 'Chain Lightning', { tell: t - 5, own: 0.2 });
      pair.forEach((s, j) => { debuff(s, 'thunderstruck', 'Thunderstruck', 'burst clear of the party', t - 5, t); call(t - 5, 'Thunder on YOU: out to the side', { slot: s, alert: true, dur: 4 }); });
      return pair;
    };
    const thunders = [];
    // Firehorn's fireballs on a tethered player: in (everyone stacks), out (alone), in, in.
    const fireball = (t, tgt, inn, outOnes) => {
      if (inn) stack(t, tgt, 4, 8 - outOnes.length, 8, 'Fireball', { tell: t - 4 });
      else spreads(t, [tgt], 4, 'Fireball', { tell: t - 5, own: 0.4 });
      debuff(tgt, 'firescorched', 'Firescorched', inn ? 'the party stacks with you' : 'take it alone', t, t + 20);
      call(t - 4, inn ? `Fireball on ${tgt}: IN` : `Fireball on ${tgt}: OUT`, { alert: true, dur: 4 });
    };
    // Wings of Salvation: a puddle where the clump stands; it moves on clockwise; a doomed player steps in to cleanse.
    const wings = [];                                   // {cast, land, c}
    const wingsSet = (tFirst, n, every, doomed) => {
      for (let k = 0; k < n; k++) {
        const land = tFirst + k * every, cast = land - 3;
        const c = r2(IN([0, 0], th));
        hz({ t: land, tell: cast, shape: 'circle', at: c, r: 4, dmg: 0.9, name: 'Wings of Salvation' });
        wings.push({ cast, land, c });
        th = deg360(th + 90);
        clumpFrom(cast + 0.05, IN([0, 0], th));
        const d = doomed[k];
        if (d) {
          role(land + 0.05, land + 1.25, d, c);
          tower(land + 1.1, c, 2.5, 1, [d], 'Wings of Salvation (cleanse)', { tell: land, fail: 1.2 });
          debuff(d, 'doom', 'Doom', 'cleanse in a Wings of Salvation puddle', cast - 2, land + 1.1);
        }
      }
    };

    for (const e of EA(/^Bahamut's Claw x5$/, 419, 612)) buster(e.t + 3.2, 'MT', 'Bahamut\'s Claw', { tell: e.t - 1 });
    // Quote 1: Lunar Dynamo with the first Chain Lightning, then Iron Chariot or Thermionic Beam.
    const q1a = E('Lunar Dynamo', 440, 445), q1b = E('Iron Chariot/Thermionic Beam', 444, 449);
    const tQ1a = q1a ? q1a.t : 443.2, tQ1b = q1b ? q1b.t : 446.2, q1k = pick(['chariot', 'beam']);
    label(q1b, NAME[q1k]);
    const cl = EA(/^Chain Lightning$/, 440, 520).map(e => e.t);
    const pairs = [];
    let pool = shuffle(NT);
    for (let i = 0; i < 4; i++) { if (pool.length < 2) pool = shuffle(NT); pairs.push([pool.pop(), pool.pop()]); }
    const fb = [1, 2, 3, 4].map(k => T(`Fireball (${k})`, 440, 520, [448.9, 464.0, 489.8, 510.8][k - 1]));
    const dooms = EA(/^Doom$/, 440, 520).map(e => e.t);
    const wingE = EA(/^Wings Of Salvation x\d$/, 440, 520);
    // Who is doomed in each set (2, 3, 3), and who carries each fireball.
    const doomSets = [shuffle(NT).slice(0, 2), shuffle(NT).slice(0, 3), shuffle(NT).slice(0, 3)];
    const fbT = [pick(NT), pick(NT), null, pick(NT)];
    fbT[2] = pick(NT.filter(s => s !== fbT[1]));

    // 438: quote 1.
    call(tQ1a - 5, q1k === 'chariot' ? 'In => Out' : 'In => Stack', { alert: true, dur: 5 });
    quotePiece(tQ1a, 'dynamo', [0, 0], th, S, tQ1a - 5);
    chain(cl[0] || tQ1a, pairs[0]);
    thunders.push({ t0: (cl[0] || tQ1a) - 5, t1: (cl[0] || tQ1a) + 0.05, pair: pairs[0] });
    if (q1k === 'chariot') { quotePiece(tQ1b, 'chariot', [0, 0], th, S, tQ1a); clumpFrom(tQ1a + 0.05, OUTP([0, 0], th)); clumpFrom(tQ1b + 0.05, IN([0, 0], th)); }
    else quotePiece(tQ1b, 'beam', [0, 0], th, S, tQ1a);
    // Doom 1 (two) and Wings x2; fireball 1 in.
    const w1 = wingE[0] ? wingE[0].t : 449.9;
    wingsSet(w1, 2, 4.0, doomSets[0]);
    fireball(fb[0], fbT[0], true, []);
    // Fireball 2: out, alone, opposite the clump.
    role(fb[1] - 5, fb[1] + 0.1, fbT[1], r2(OUTP([0, 0], th + 180)));
    fireball(fb[1], fbT[1], false, []);
    // Quote 2: Thermionic Beam, then Lunar Dynamo or Iron Chariot; Chain Lightning 2 just before.
    chain(cl[1] || fb[1] + 4, pairs[1]);
    thunders.push({ t0: (cl[1] || fb[1] + 4) - 5, t1: (cl[1] || fb[1] + 4) + 0.05, pair: pairs[1] });
    const q2a = E('Thermionic Beam', 469, 473), q2b = E('Lunar Dynamo/Iron Chariot', 472, 476);
    const tQ2a = q2a ? q2a.t : 471.3, tQ2b = q2b ? q2b.t : 474.3, q2k = pick(['dynamo', 'chariot']);
    label(q2b, NAME[q2k]);
    call(tQ2a - 5, q2k === 'chariot' ? 'Stack => Out' : 'Stack => In', { alert: true, dur: 5 });
    quotePiece(tQ2a, 'beam', [0, 0], th, S, tQ2a - 5);
    quotePiece(tQ2b, q2k, [0, 0], th, S, tQ2a);
    if (q2k === 'chariot') { clumpFrom(tQ2a + 0.05, OUTP([0, 0], th)); clumpFrom(tQ2b + 0.05, IN([0, 0], th)); }
    // Doom 2 (three) and Wings x3; Chain Lightning 3; fireball 3 in (but tether 2 stays out).
    const w2 = wingE[1] ? wingE[1].t : 477.7;
    wingsSet(w2, 3, 4.0, doomSets[1]);
    chain(cl[2] || w2 + 9, pairs[2]);
    thunders.push({ t0: (cl[2] || w2 + 9) - 5, t1: (cl[2] || w2 + 9) + 0.05, pair: pairs[2] });
    role(fb[2] - 4, fb[2] + 0.1, fbT[1], r2(OUTP([0, 0], th + 180)));
    fireball(fb[2], fbT[2], true, [fbT[1]]);
    // Quote 3: Raven Dive (spread; Nael lands on one), then Lunar Dynamo or Iron Chariot round where she lands.
    const q3a = E('Raven Dive', 501, 507), q3b = E('Lunar Dynamo/Iron Chariot', 505, 510);
    const tQ3a = q3a ? q3a.t : 504.5, tQ3b = q3b ? q3b.t : 507.5, q3k = pick(['dynamo', 'chariot']);
    label(q3b, NAME[q3k]);
    call(tQ3a - 5, q3k === 'chariot' ? 'Spread => Out' : 'Spread => In', { alert: true, dur: 5 });
    const rd3 = ravenDive(tQ3a, [0, 0], th, tQ3a - 5);
    for (const s of S) role(tQ3a - 4.5, tQ3a + 0.05, s, rd3.ring[s]);
    bossAt(tQ3a, rd3.land);
    const n3 = rd3.land, th3 = brg(mul(n3, -1));
    quotePiece(tQ3b, q3k, n3, th3, S, tQ3a);
    clumpFrom(tQ3a + 0.05, q3k === 'dynamo' ? add(n3, at(th3, 2.5)) : add(n3, at(th3, 11)));
    // Fireball 4 in, where the clump is; then Nael back to the middle and the clump back by her.
    fireball(fb[3], fbT[3], true, []);
    clumpFrom(tQ3b + 0.05, IN([0, 0], th));
    bossAt(tQ3b + 0.5, [0, 0], 2);
    // Doom 3 and Wings x3; Chain Lightning 4.
    const w3 = wingE[2] ? wingE[2].t : 513.9;
    chain(cl[3] || w3, pairs[3]);
    thunders.push({ t0: (cl[3] || w3) - 5, t1: (cl[3] || w3) + 0.05, pair: pairs[3] });
    wingsSet(w3, 3, 4.0, doomSets[2]);
    buster(T('Ravensbeak', 528, 536, 532.4), 'MT', 'Ravensbeak');

    // The roles become the party's spots at each change: the clump (round Nael), the thunders beside it, the out ones.
    const naelAt = (t) => {
      let p = [0, 0];
      for (const k of P.boss) if (k.t <= t) p = k.at;
      return p;
    };
    const clumpAtT = (t) => { let c = p2.clump[0].c; for (const k of p2.clump) if (k.t <= t) c = k.c; return c; };
    const keysP2 = [...new Set([...p2.clump.map(k => k.t), ...p2.roles.flatMap(r => [r.t0, r.t1]), ...thunders.flatMap(r => [r.t0, r.t1])])]
      .filter(t => t >= tDD + 2 && t < 534).sort((a, b) => a - b);
    for (const t of keysP2) {
      const spots = {}, c = clumpAtT(t), n = naelAt(t);
      for (const r of p2.roles) if (r.t0 <= t && t < r.t1) spots[r.slot] = r.p;
      // (A puddle about to land, or one landed a moment ago: everyone else keeps clear of it.)
      const pend = wings.filter(w => w.cast <= t && t < w.land + 1.25).map(w => ({ shape: 'circle', at: w.c, r: 4.3 }));
      const th0 = thunders.find(x => x.t0 <= t && t < x.t1);
      const free = S.filter(s => !spots[s] && !(th0 && th0.pair.includes(s)));
      Object.assign(spots, clumpAt(free, c, { avoid: pend.filter(p => dist(p.at, c) > 0.5), m: 0.3 }));
      if (th0) {
        // Each thunder 4.6 from Nael (inside Lunar Dynamo), as far from the clump as it can be.
        const cb = brg(sub(c, n)), cands = [110, 140, 170, -110, -140, -170, 80, -80].map(d => r2(add(n, at(cb + d, 4.4))));
        const ok = (p) => dist(p, c) > 6.6 && pend.every(q => dist(q.at, p) > q.r + 1.2) && FLOOR(p);
        const good = cands.filter(ok);
        const a = good[0] || cands[0], b = good.find(p => dist(p, a) > 6.5) || cands[3];
        spots[th0.pair[0]] = a; spots[th0.pair[1]] = b;
      }
      pref(t, spots);
    }

    // --- The divebombs: five dragons dive in three sets at the marked players on the edge ---
    const tM1 = T('Marker 1', 535, 540, 537.6), tM2 = T('Marker 2', 539, 544, 541.6), tM3 = T('Marker 3', 543, 548, 545.6);
    const cauts = EA(/^Cauterize$/, 546, 560).map(e => e.t);
    const tC1 = cauts[0] || 548.9, tC2 = cauts[1] || 552.9, tC3 = cauts[2] || 557.0;
    const spreadQ = Math.random() < 0.5;          // Meteor Stream then Dalamud Dive, or Dalamud Dive then Thermionic Beam
    const qd = E('Meteor Stream', 550, 554), tdd = T('Dalamud Dive', 552, 557, 555.3);
    const tSpread = qd ? qd.t : 552.3;
    const tDive2 = spreadQ ? tdd : tSpread, tBeam2 = tSpread + 2.2;
    if (qd) label(qd, spreadQ ? 'Meteor Stream' : 'Dalamud Dive');
    label(E('Dalamud Dive', 552, 557), spreadQ ? 'Dalamud Dive' : 'Thermionic Beam');
    label(E('Marker 1', 535, 540), `Marker 1 (${spreadQ ? 'spread' : 'stack'} quote)`);
    const baiters = shuffle(NT);                       // two, one, two (the MT keeps Nael for her dive)
    const sets = [[baiters[0], baiters[1]], [baiters[2]], [baiters[3], baiters[4]]];
    const drOrder = [0, 1, 2, 3, 4].map(k => drAt(k)).sort((a, b) => brg(a) - brg(b));   // clockwise from north
    const diveOf = [[drOrder[0], drOrder[1]], [drOrder[2]], [drOrder[3], drOrder[4]]];
    const tLock = [tC1 - 4, tC2 - 4, tC3 - 4], tHit = [tC1, tC2, tC3], tMark = [tM1, tM2, tM3];
    const lines = [];
    sets.forEach((set, j) => set.forEach((s, i) => {
      const d = diveOf[j][i], spot = r2(at(brg(d) + 36, 20.5));
      const h = hz({ t: tHit[j], tell: tMark[j], shape: 'line', from: d, aim: 'target', targets: [s], len: 52, w: 20, snap: 4, dmg: 1.3, name: 'Cauterize', react: 4 });
      lines.push({ h, t0: tLock[j], t1: tHit[j], from: d, to: spot });
      role(tLock[j] - 2.8, tLock[j] + 0.05, s, spot);
      call(tMark[j], `Divebomb ${j + 1}: bait the ${dirName(brg(d))} dragon (stand ${dirName(brg(spot))})`, { slot: s, alert: true, dur: 4 });
    }));
    call(tM1, spreadQ ? 'Divebombs: spread quote (spread, then the tank\'s dive)' : 'Divebombs: stack quote (the tank\'s dive, then stack)', { alert: true, dur: 6 });
    // Hypernova: four puddles where the party stands, a step aside each time.
    const hyper = E('Hypernova x4', 540, 546), tHy = hyper ? hyper.t : 542.8;
    const hyPts = [[0, -3], [-6, -3], [-6, 3], [0, 4]];
    const carrier = pick(S.filter(s => !baiters.slice(0, 2).includes(s)));
    for (let k = 0; k < 4; k++) hz({ t: tHy + 1.55 * k + 1.2, tell: tHy + 1.55 * k - 0.8, shape: 'circle', from: 'target', targets: [carrier], r: 5, snap: 1.2, dmg: 0.9, name: 'Hypernova' });
    // The quote: spreads west of the middle (the next baiters at their spots), or the tank's dive then the stack.
    const quoteSpots = {};
    const lockedAt = (t) => lines.filter(l => l.t0 <= t && t < l.t1 + 0.2).map(l => ({ shape: 'line', at: l.from, deg: brg(sub(l.to, l.from)), len: 52, w: 20 }));
    {
      const t = tSpread - 2.5, avoid = lockedAt(tSpread + 0.5);
      const keep = sets[2].map(s => at(brg(diveOf[2][sets[2].indexOf(s)]) + 36, 20.5));
      const rest = S.filter(s => !sets[2].includes(s));
      const ok = (p) => FLOOR(p) && avoid.every(h => !inside(h, p, 1.6));
      const pts = [];
      for (let x = -19; x <= 19; x += 0.5) for (let y = -19; y <= 19; y += 0.5) if (ok([x, y]) && keep.every(q => dist(q, [x, y]) > 5)) pts.push([x, y]);
      pts.sort((a, b) => dist(a, [-6, 0]) - dist(b, [-6, 0]));
      const got = [];
      for (const p of pts) { if (got.length >= rest.length) break; if (got.every(q => dist(q, p) > 5.2)) got.push(p); }
      rest.forEach((s, i) => { quoteSpots[s] = r2(got[i] || [-6, 0]); });
      if (!spreadQ) {
        // The dive first: the tank alone (its spread spot), the rest stack in the middle of theirs.
        const mid = rest.filter(s => s !== 'MT'), c = got.length ? [got.slice(1, mid.length + 1).reduce((a, p) => a + p[0], 0) / mid.length, got.slice(1, mid.length + 1).reduce((a, p) => a + p[1], 0) / mid.length] : [-6, 0];
        const far = got.slice().sort((a, b) => dist(b, c) - dist(a, c))[0] || [-14, 6];
        quoteSpots.MT = r2(far);
        Object.assign(quoteSpots, clumpAt(mid, place([['x', c]], { avoid: avoid.concat([{ shape: 'circle', at: far, r: 9 }]), m: 1.6 }).x));
      }
      for (const s of rest) role(t, (spreadQ ? tdd : tBeam2) + 0.1, s, quoteSpots[s]);
    }
    if (spreadQ) {
      spreads(tSpread, S.filter(s => !sets[2].includes(s)), 4, 'Meteor Stream', { tell: tSpread - 3 });
      buster(tdd, 'MT', 'Dalamud Dive', { r: 5, tell: tSpread });
    } else {
      buster(tDive2, 'MT', 'Dalamud Dive', { r: 5, tell: tDive2 - 3 });
      const mid = S.filter(s => s !== 'MT' && !sets[2].includes(s));
      stack(tBeam2, pick(mid), 4, mid.length, 8, 'Thermionic Beam', { tell: tDive2 - 2 });
      role(tDive2 + 0.1, tBeam2 + 0.1, 'MT', quoteSpots[mid[0]]);
    }
    const tDiveNael = spreadQ ? tdd : tDive2;
    P.form.push({ t: tLock[0] + 1, model: 'none' }, { t: tDiveNael, model: 'nael' });
    bossAt(tDiveNael, quoteSpots.MT || [-10, 0]);
    bossAt(tDiveNael + 1, [0, 0], 3);
    // The baiters back in after their lock, away from the lines coming.
    {
      const keys = [...new Set([tM1 - 0.5, tHy - 0.9, ...[0, 1, 2, 3].map(k => tHy + 1.55 * k + 0.45), ...lines.flatMap(l => [l.t0 - 2.8, l.t0 + 0.05, l.t1 + 0.05]), ...p2.roles.filter(r => r.t0 > 535).flatMap(r => [r.t0, r.t1])])]
        .filter(t => t >= tM1 - 0.5 && t < tC3 + 1).sort((a, b) => a - b);
      for (const t of keys) {
        const spots = {};
        for (const r of p2.roles) if (r.t0 <= t && t < r.t1 && r.t0 > 535) spots[r.slot] = r.p;
        const avoid = lockedAt(t + 0.01);
        const k = [0, 1, 2, 3].filter(j => tHy + 1.55 * j + 0.45 <= t).length;     // the party's step for Hypernova
        const c = hyPts[Math.min(3, k)];
        const free = S.filter(s => !spots[s]);
        Object.assign(spots, place(free.map(s => [s, c, 0.6]), { avoid, m: 1.6 }));
        pref(t, spots);
      }
    }
    pref(tC3 + 0.2, clumpAt(S, IN([0, 0], 180)));
    // Afterwards: the clump on Nael's south; quotes 5 and 6 (random), Ravensbeak, Bahamut's Claw.
    const QUOTES = [['dynamo', 'chariot'], ['dynamo', 'beam'], ['beam', 'chariot'], ['beam', 'dynamo'], ['dive', 'chariot'], ['dive', 'dynamo']];
    for (const e of [E('Lunar Dynamo', 570, 580), E('Lunar Dynamo', 582, 592)]) {
      if (!e) continue;
      const q = pick(QUOTES), t1 = e.t, t2 = e.t + 3;
      label(e, `${NAME[q[0]]} => ${NAME[q[1]]}`);
      call(t1 - 5, `${NAME[q[0]]} => ${NAME[q[1]]}`, { alert: true, dur: 5 });
      let n = [0, 0], c = IN(n, 180);
      if (q[0] === 'dive') {
        const rd = ravenDive(t1, n, 180, t1 - 5);
        pref(t1 - 4.5, rd.ring);
        bossAt(t1, rd.land);
        n = rd.land;
        c = add(n, at(brg(mul(n, -1)), 2.5));
      } else {
        quotePiece(t1, q[0], n, 180, S, t1 - 5);
        pref(t1 - 4.5, clumpAt(S, q[0] === 'chariot' ? OUTP(n, 180) : IN(n, 180)));
      }
      quotePiece(t2, q[1], n, 180, S, t1);
      pref(t1 + 0.05, clumpAt(S, q[1] === 'chariot' ? (q[0] === 'dive' ? add(n, at(brg(mul(n, -1)), 11)) : OUTP(n, 180)) : c));
      pref(t2 + 0.1, clumpAt(S, IN([0, 0], 180)));
      if (q[0] === 'dive') bossAt(t2 + 0.5, [0, 0], 2);
    }
    buster(T('Ravensbeak', 594, 602, 598.3), 'MT', 'Ravensbeak');
    label(E('Megaflare Enrage', 610, 625), 'Megaflare (enrage: Nael must be down)');
    // The dragons, out from Bahamut's Favor till their dives.
    DRAGONS.forEach((m, k) => {
      const d = drAt(k), j = diveOf.findIndex(x => x.includes(drOrder.find(q => q === d) || d)), tGone = j >= 0 ? tHit[j] + 0.6 : tC3 + 0.6;
      other(m, [{ t: 0, at: d }], [[tFav, tGone]], [0, 0]);
    });

    // ======================================================================== Phase 3: Bahamut Prime
    const tUE = T('Seventh Umbral Era', 650, 660, 655.3), tP3 = tUE - 5.3;
    P.form.push({ t: T('Megaflare Enrage', 610, 625, 617.8) - 5, model: 'none' }, { t: tUE, model: 'bahamut' });
    P.hitbox.push({ t: tUE, r: 4.2 });
    bossAt(tP3, [0, 0]);
    pref(tP3, clumpAt(S, [0, -3]));
    hz({ t: tUE, tell: tUE - 4, effect: 'knockback', at: [0, 0], dist: 11, dmg: 0, name: 'Seventh Umbral Era' });
    raid(tUE, 0.35, 'Seventh Umbral Era');
    for (let k = 0; k < 3; k++) raid(T('Calamitous Flame x3', 656, 661, 658.3) + k, 0.12, 'Calamitous Flame', tUE);
    raid(T('Calamitous Blaze', 661, 666, 663.3), 0.55, 'Calamitous Blaze (tank LB)', tUE + 3);
    call(tP3, 'Stack south of the middle for the knockback', { dur: 4 });
    // Bahamut in the middle facing north: the MT north, the OT east, everyone else behind.
    const UP3 = { MT: [0, 6.8], OT: [6.2, 1.2], M1: [-2.2, -5.8], M2: [2.2, -5.8], H1: [-7, -9.5], H2: [7, -9.5], R1: [-10.5, -5], R2: [10.5, -5] };
    pref(tUE + 0.6, UP3);
    const flare = (t, tell) => cleave(t, 'MT', 29.2, 46, 'Flare Breath', { tell: tell === undefined ? t - 3 : tell });
    for (const e of EA(/^Flare Breath( \d)?$/, 660, 950)) flare(e.t);
    for (const e of EA(/^Flatten$/, 660, 950)) buster(e.t, 'MT', 'Flatten');
    for (const e of EA(/^Gigaflare$/, 660, 950)) raid(e.t, 0.5, 'Gigaflare', e.t - 6);
    const QSPOT = (N, slot, r, deg) => { const L = QL.indexOf(slot), R = QR.indexOf(slot), o = L >= 0 ? -deg[L] : deg[R]; return r2(at(N + o, r)); };
    const dive = (t, from, deg, w, name, tell) => hz({ t, tell, shape: 'line', at: from, deg, len: 46, w, dmg: 1.3, name, react: 4 });

    // --- Quickmarch Trio: dives from new north, twisters, spreads, puddles, Earth Shakers, Tempest Wing, the stack ---
    const qmt = E('Quickmarch Trio', 680, 692);
    if (qmt) {
      const t0 = qmt.t, N = pick([0, 45, 90, 135, 180, 225, 270, 315]);
      const tDv = T('Twisting Dive', t0 + 5, t0 + 12, t0 + 8.3), tSp = T('Spread', t0 + 10, t0 + 15, t0 + 12.3), tPep = T('Pepperoni', t0 + 12, t0 + 17, t0 + 14.3);
      const tSt = T('Stack', t0 + 14, t0 + 19, t0 + 16.3), tES = T('Earth Shaker', t0 + 16, t0 + 21, t0 + 18.6), tTW = T('Tempest Wing', t0 + 18, t0 + 23, t0 + 20.6);
      label(qmt, `Quickmarch Trio (new north: ${dirName(N)})`);
      call(t0 + 3, `New north: ${dirName(N)}. Quickmarch spots`, { alert: true, dur: 5 });
      bossAt(t0 + 2, at(N, 21));
      bossAt(tDv, at(N + 180, 21));
      bossAt(tSp + 1, [0, 0]);
      other('main', [{ t: 0, at: at(N - 30, 21) }], [[t0 + 2, tDv]], [0, 0]);
      other('nael', [{ t: 0, at: at(N + 30, 21) }], [[t0 + 2, tDv]], [0, 0]);
      const qm = Object.fromEntries(S.map(s => [s, QSPOT(N, s, 20, [60, 80, 100, 120])]));
      pref(t0 + 2.2, qm);
      dive(tDv, at(N, 22), N + 180, 12, 'Megaflare Dive', tDv - 4);
      dive(tDv, at(N - 30, 22), N + 150, 8, 'Twisting Dive', tDv - 4);
      dive(tDv, at(N + 30, 22), N + 210, 8, 'Lunar Dive', tDv - 4);
      const tTw = twisters(tDv + 1.0);
      pref(tTw, Object.fromEntries(S.map(s => [s, QSPOT(N, s, 12, [37.5, 72.5, 107.5, 142.5])])));
      spreads(tSp, S, 5, 'Megaflare', { tell: tDv + 1.3 });
      hz({ t: tPep, tell: tPep - 3, shape: 'circle', from: 'target', targets: S.slice(), r: 6, snap: 3, dmg: 1.0, name: 'Megaflare (puddle)' });
      pref(tSp + 0.05, clumpAt(S, [0, 0]));
      // Earth Shakers: H1 north-west, H2 north-east, two DPS south-east together; the stack (the other DPS) south-west;
      // the tanks hold Tempest Wing's tethers due north, between the cones.
      const esD = shuffle(DPS).slice(0, 2), stD = DPS.filter(s => !esD.includes(s));
      const esT = ['H1', 'H2', esD[0]];
      const SP = { H1: at(N + 300, 10), H2: at(N + 60, 10), MT: at(N + 347, 18), OT: at(N + 13, 18) };
      SP[esD[0]] = at(N + 135, 10); SP[esD[1]] = add(at(N + 135, 10), at(N + 135, 1));
      Object.assign(SP, clumpAt(stD, at(N + 225, 7)));
      pref(tPep + 0.05, Object.fromEntries(Object.entries(SP).map(([k, v]) => [k, r2(v)])));
      for (const s of esT) {
        const shared = s === esD[0];
        hz({ t: tES, tell: tSp + 1, effect: shared ? 'share' : 'bait', shape: 'cone', from: 'boss', aim: 'target', targets: [s], r: 60, half: 45, min: shared ? 2 : undefined, max: shared ? 2 : undefined, dmg: shared ? 0.45 : 0.9, own: 0.4, name: 'Earth Shaker' });
      }
      for (const s of ['H1', 'H2', ...esD]) call(tSp + 1, 'Earth Shaker on YOU', { slot: s, alert: true, dur: 4 });
      stack(tSt, stD[0], 5, 2, 3, 'Megaflare (stack)', { tell: tSp + 1 });
      for (const s of TANKS) { buster(tTW, s, 'Tempest Wing', { r: 5, tell: tSp + 2 }); call(tSp + 2, 'Tempest Wing: take a tether north', { slot: s, alert: true, dur: 4 }); }
      pref(tTW + 0.1, UP3);
    }

    // --- Blackfire Trio: Liquid Hell on one, Thermionic Beam, Megaflare Dive, Hypernova, four towers and a four-stack ---
    const bft = E('Blackfire Trio', 720, 735);
    if (bft) {
      const t0 = bft.t, th = pick([0, 45, 90, 135, 180, 225, 270, 315]), sgn = pick([-1, 1]);
      const tLH = T('Liquid Hell x5', t0 + 2, t0 + 6, t0 + 4), tBeam = T('Thermionic Beam', t0 + 5, t0 + 9, t0 + 7.4), tMD = T('Megaflare Dive', t0 + 6, t0 + 10, t0 + 8.4);
      const tHy = T('Hypernova x4', t0 + 12, t0 + 16, t0 + 14.5), tSt = T('Stack', t0 + 14, t0 + 18, t0 + 16.4), tTw = T('Towers', t0 + 16, t0 + 20, t0 + 18.4);
      label(bft, `Blackfire Trio (Nael ${dirName(th)})`);
      call(t0 + 2, `Nael ${dirName(th)}: run toward her`, { alert: true, dur: 5 });
      other('nael', [{ t: 0, at: at(th, 20) }], [[t0 + 2, tTw + 0.5]], [0, 0]);
      bossAt(t0 + 2, at(th + 90 * sgn, 21));
      bossAt(tMD, at(th + 90 * sgn + 180, 21));
      bossAt(tTw, [0, 0]);
      // Liquid Hell on one (supports run clockwise, DPS counterclockwise), on the far half from Nael.
      const x = pick(NT), cw = DPS.includes(x) ? -1 : 1, beamTo = pick(S.filter(s => s !== x));
      const path = arc([0, 0], 13.5, th + 180 - 25 * cw, th + 180 + 75 * cw, 12);
      puddles(tLH, 5, 1.12, x, 6, 'Liquid Hell');
      pref(t0 + 2.2, Object.assign(clumpAt(S.filter(s => s !== x), at(th, 11)), { [x]: path[0] }));
      pref(tLH - 0.2, { [x]: walkPath(path, tLH - 0.2, 5.0) });
      call(t0 + 2, 'Liquid Hell on YOU', { slot: x, alert: true, dur: 4 });
      stack(tBeam, beamTo, 4, 7, 8, 'Thermionic Beam', { tell: t0 + 3 });
      dive(tMD, at(th + 90 * sgn, 22), th + 90 * sgn + 180, 12, 'Megaflare Dive', tMD - 4);
      // Towers (the MT nearest Nael, H1 nearest the stack, M1 and R1 the sides); the other four stack and walk
      // Hypernova's puddles round the far edge.
      const tw = { MT: at(th, 9), H1: at(th + 180, 9), M1: at(th - 90, 9), R1: at(th + 90, 9) };
      for (const [s, p] of Object.entries(tw)) tower(tTw, r2(p), 3, 1, [s], 'Megaflare (tower)', { tell: tTw - 8 });
      const grp = ['OT', 'H2', 'M2', 'R2'], carrier = pick(grp), path2 = [150, 175, 200, 225].map(d => at(th + d, 15));
      for (let k = 0; k < 4; k++) hz({ t: tHy + 1.55 * k, tell: tHy + 1.55 * k - 2.4, shape: 'circle', from: 'target', targets: [carrier], r: 5, snap: 1.4, dmg: 0.9, name: 'Hypernova' });
      stack(tSt, carrier, 5, 4, 4, 'Megaflare (stack)', { tell: tSt - 5 });
      pref(tMD + 0.1, Object.assign(Object.fromEntries(Object.entries(tw).map(([s, p]) => [s, r2(p)])), clumpAt(grp, path2[0])));
      for (let k = 1; k < 4; k++) pref(tHy + 1.55 * (k - 1) - 1.35, clumpAt(grp, path2[k]));
      call(tMD, 'Towers: MT, H1, M1, R1; the rest stack', { alert: true, dur: 5 });
      pref(tTw + 0.1, UP3);
    }

    // --- Fellruin Trio: Nael's quote in the middle, Tempest Wing, Aetheric Profusion (the Neurolinks), Meteor Stream ---
    const frt = E('Fellruin Trio', 770, 785);
    if (frt) {
      const t0 = frt.t, opt = pick([[0, 2], [110, 1], [250, 3]]), bB = opt[0], pNL = NL[opt[1]];
      const tankNL = [1, 2, 3].filter(k => k !== opt[1]).map(k => NL[k]);
      const eA = E('Lunar Dynamo/Raven Dive', t0 + 6, t0 + 12), eB = E('Raven Dive/Lunar Dynamo', t0 + 9, t0 + 15);
      const tA = eA ? eA.t : t0 + 9.4, tB2 = eB ? eB.t : t0 + 12.4, tTW = T('Tempest Wing', t0 + 12, t0 + 18, t0 + 15.4);
      const tAP = T('Aetheric Profusion', t0 + 13, t0 + 19, t0 + 16.4), tMS = T('Meteor Stream', t0 + 17, t0 + 23, t0 + 19.7);
      const diveFirst = Math.random() < 0.5;
      label(frt, `Fellruin Trio (Bahamut ${dirName(bB)})`);
      label(eA, diveFirst ? NAME.dive : NAME.dynamo);
      label(eB, diveFirst ? NAME.dynamo : NAME.dive);
      call(t0 + 2, diveFirst ? 'Spread => In, then Neurolinks' : 'In => Spread, then Neurolinks', { alert: true, dur: 5 });
      bossAt(t0 + 2, at(bB, 20));
      bossAt(tMS, [0, 0]);
      other('nael', [{ t: 0, at: [0, 0] }], [[t0 + 2, tB2 + 2]], null);
      other('main', [{ t: 0, at: at(bB + 180, 21) }], [[t0 + 8, tAP + 1]], [0, 0]);
      pref(t0 + 2.2, clumpAt(S, [0, -1.5]));
      let n = [0, 0];
      if (diveFirst) {
        const rd = ravenDive(tA, n, bB + 180, t0 + 4);
        pref(tA - 4.5, rd.ring);
        P.others[P.others.length - 2].path.push({ t: tA, at: rd.land });
        n = rd.land;
        hz({ t: tB2, tell: tA, shape: 'donut', at: n, r0: 6, r1: 40, dmg: 1.2, name: NAME.dynamo, react: 4 });
        pref(tA + 0.05, clumpAt(S, add(n, at(brg(mul(n, -1)), 2.5))));
      } else {
        hz({ t: tA, tell: t0 + 4, shape: 'donut', at: n, r0: 6, r1: 40, dmg: 1.2, name: NAME.dynamo, react: 4 });
        const rd = ravenDive(tB2, n, bB + 180, tA);
        pref(tA + 0.05, rd.ring);
        P.others[P.others.length - 2].path.push({ t: tB2, at: rd.land });
      }
      // The tanks to the Neurolinks either side of Bahamut (their tethers), everyone else in the one opposite.
      const party = NT;
      pref(tB2 + 0.05, Object.assign({ MT: tankNL[0], OT: tankNL[1] }, clumpAt(party, pNL)));
      for (const [s, p] of [['MT', tankNL[0]], ['OT', tankNL[1]]]) {
        buster(tTW, s, 'Tempest Wing', { r: 5, tell: tA });
        tower(tAP, p, 2, 1, [s], 'Aetheric Profusion (Neurolink)', { tell: tAP - 5, fail: 1.0 });
      }
      tower(tAP, pNL, 2, [party.length, party.length], party, 'Aetheric Profusion (Neurolink)', { tell: tAP - 5, fail: 1.0 });
      call(tB2, `Neurolinks: party ${nlName(pNL)}, tanks ${nlName(tankNL[0])} and ${nlName(tankNL[1])}`, { alert: true, dur: 4 });
      // Meteor Stream: everyone spreads out from the Neurolinks.
      const away = unit(pNL);
      const ring = assign(party, [-75, -45, -15, 15, 45, 75].map(d => r2(add(pNL, at(brg(away) + d, 5.4)))));
      pref(tAP + 0.05, ring);
      spreads(tMS, S, 4, 'Meteor Stream', { tell: tAP - 1 });
      pref(tMS + 0.1, UP3);
    }

    // --- Heavensfall Trio: dives, twisters, pepperonis, the knockback into eight towers, Thermionic Burst ---
    const hft = E('Heavensfall Trio', 825, 840);
    if (hft) {
      const t0 = hft.t, N = pick([0, 45, 90, 135, 180, 225, 270, 315]);
      const tDv = T('Twisting Dive', t0 + 5, t0 + 11, t0 + 8.4), tPep = T('Pepperoni', t0 + 12, t0 + 17, t0 + 14.4), tKB = T('Heavensfall', t0 + 14, t0 + 18, t0 + 15.9);
      const tTow = T('Towers', t0 + 16, t0 + 21, t0 + 18.4), tHy = T('Hypernova x3', t0 + 19, t0 + 24, t0 + 21.5), tBurst = T('Thermionic Burst x8', t0 + 20, t0 + 26, t0 + 23);
      const tFB = T('Fireball', t0 + 27, t0 + 34, t0 + 30.7);
      label(hft, `Heavensfall Trio (Nael ${dirName(N)})`);
      call(t0 + 2, `Nael ${dirName(N)} is north: dive spots`, { alert: true, dur: 5 });
      other('nael', [{ t: 0, at: at(N, 21) }], [[t0 + 2, tBurst + 3]], [0, 0]);
      other('main', [{ t: 0, at: at(N + 45, 21) }], [[t0 + 2, tDv + 0.5]], [0, 0]);
      bossAt(t0 + 2, at(N + 135, 21));
      bossAt(tDv, at(N + 315, 21));
      bossAt(tFB, [0, 0]);
      const DV = { MT: [0, 10.5], OT: [0, 13], H1: [270, 10.5], M1: [270, 13], H2: [90, 10.5], M2: [90, 13], R1: [180, 10.5], R2: [180, 13] };
      pref(t0 + 2.2, Object.fromEntries(Object.entries(DV).map(([s, [b, r]]) => [s, r2(at(N + b, r))])));
      dive(tDv, at(N + 45, 22), N + 225, 8, 'Twisting Dive', tDv - 4);
      dive(tDv, at(N + 135, 22), N + 315, 12, 'Megaflare Dive', tDv - 4);
      const tTw = twisters(tDv + 1.0);
      // Towers: R1-R4 under Nael and clockwise, L1-L4 counterclockwise from beside her (wtfdig's).
      const TB = { OT: 0, H2: 45, M2: 90, R2: 135, R1: 180, M1: 225, H1: 270, MT: 315 };
      const baitB = { OT: 0, MT: 337.5, H2: 67.5, M2: 90, H1: 270, M1: 247.5, R1: 180, R2: 157.5 };
      pref(tTw, Object.fromEntries(S.map(s => [s, r2(at(N + baitB[s], 15))])));
      hz({ t: tPep, tell: tPep - 3, shape: 'circle', from: 'target', targets: S.slice(), r: 6, snap: 3, dmg: 1.0, name: 'Megaflare (puddle)' });
      pref(tPep - 2.95, Object.fromEntries(S.map(s => [s, r2(at(N + TB[s], 6))])));
      hz({ t: tKB, tell: tKB - 3, effect: 'knockback', at: [0, 0], dist: 11, dmg: 0, name: 'Heavensfall' });
      raid(tKB, 0.35, 'Heavensfall', tKB - 3);
      for (const s of S) tower(tTow, r2(at(N + TB[s], 17)), 3, 1, [s], 'Megaflare (tower)', { tell: tTow - 8 });
      pref(tKB + 0.6, Object.fromEntries(S.map(s => [s, r2(at(N + TB[s], 17))])));
      call(tPep - 3, 'Pepperonis out, then in: the knockback puts you in your tower', { alert: true, dur: 5 });
      // Thermionic Burst between the towers; Hypernova on three of them; then in to the middle for the fireball.
      for (let k = 0; k < 8; k++) hz({ t: tBurst, tell: tBurst - 3, shape: 'cone', at: [0, 0], deg: N + 22.5 + 45 * k, half: 11.25, r: 24.5, dmg: 1.2, name: 'Thermionic Burst', react: 3 });
      const hyT = shuffle(S).slice(0, 3);
      hyT.forEach((s, k) => hz({ t: tHy + 1.6 * k, tell: tHy + 1.6 * k - 2.2, shape: 'circle', from: 'target', targets: [s], r: 5, snap: 1.2, dmg: 0.9, name: 'Hypernova' }));
      pref(tBurst + 0.1, clumpAt(S, [0, 0]));
      stack(tFB, pick(S), 4, 8, 8, 'Fireball', { tell: tFB - 5 });
      call(tBurst, 'Spiral in: stack in the middle', { dur: 4 });
      pref(tFB + 0.2, UP3);
    }

    // --- Tenstrike Trio: two sets of three Hatches, Meteor Streams, two sets of Earth Shakers ---
    const tst = E('Tenstrike Trio', 885, 900);
    if (tst) {
      const t0 = tst.t, N = brg(NL[1]);
      const gs = EA(/^Generate x3$/, t0 + 3, t0 + 15).map(e => e.t), g1 = gs[0] || t0 + 7.3, g2 = gs[1] || t0 + 11.3;
      const tMD = T('Meteor Stream (DPS)', t0 + 5, t0 + 12, t0 + 8.3) + 2, tMT = T('Meteor Stream (T/H)', t0 + 9, t0 + 16, t0 + 12.3) + 2;
      const es = EA(/^Earth Shaker$/, t0 + 15, t0 + 30).map(e => e.t), es1 = es[0] || t0 + 21.2, es2 = es[1] || t0 + 26.2;
      label(tst, 'Tenstrike Trio (Neurolink 1 is north)');
      call(t0 + 2, 'Quickmarch spread facing Neurolink 1', { alert: true, dur: 5 });
      const order = shuffle(S), set1 = order.slice(0, 3), set2 = order.slice(3, 6);
      const NLS = [NL[1], NL[2], NL[3]];
      // Safe edge spots (clear of every Neurolink's Hatch).
      const safe = [];
      for (const b of [-12, 0, 12, 113, 125, 137, 223, 235, 247]) safe.push(r2(at(b, 19.5)));
      const free1 = S.filter(s => !set1.includes(s));
      pref(t0 + 2.2, assign(free1, safe));
      set1.forEach((s, i) => { hatch(g1 + 4, g1 - 3, s, NLS[i]); pref(g1 - 3, { [s]: NLS[i] }); });
      set2.forEach((s, i) => { hatch(g2 + 4, g2 - 3, s, NLS[i]); pref(g2 - 3, { [s]: NLS[i] }); });
      const free2 = S.filter(s => !set2.includes(s));
      pref(g1 + 4.05, assign(free2, safe.filter((p, i) => !free1.slice(0, 5).some((s, j) => set2.includes(s) ? false : j === i)).concat(safe)));
      spreads(tMD, DPS, 4, 'Meteor Stream', { tell: tMD - 4 });
      spreads(tMT, ['MT', 'OT', 'H1', 'H2'], 4, 'Meteor Stream', { tell: tMT - 4 });
      // Earth Shakers: four at a time, two cones east and two west (sharing); the rest at Neurolink 1's side.
      const esA = shuffle(S).slice(0, 4), esB = S.filter(s => !esA.includes(s));
      const shaker = (t, grp, rest, tell) => {
        const spots = Object.assign({}, assign(grp, [at(N + 90, 10), add(at(N + 90, 10), at(N + 90, 1)), at(N + 270, 10), add(at(N + 270, 10), at(N + 270, 1))].map(r2)), clumpAt(rest, at(N, 6)));
        pref(tell + 0.05, spots);
        [grp[0], grp[2]].forEach(s => hz({ t, tell, effect: 'share', shape: 'cone', from: 'boss', aim: 'target', targets: [s], r: 60, half: 45, min: 2, max: 2, dmg: 0.45, name: 'Earth Shaker' }));
        for (const s of grp) call(tell, 'Earth Shaker on YOU: pair up east or west', { slot: s, alert: true, dur: 4 });
      };
      shaker(es1, esA, esB, Math.max(g2 + 4.1, es1 - 5));
      shaker(es2, esB, esA, es1 + 0.1);
      pref(es2 + 0.1, UP3);
    }

    // --- Grand Octet: Nael, five dragons and Bahamut dive round the edge at the party as it runs; Twintania; towers ---
    const go = E('Grand Octet', 940, 955);
    if (go) {
      const t0 = go.t, dB = pick([0, 45, 90, 135, 180, 225, 270, 315]), dir = dB % 90 === 0 ? -1 : 1;
      const d0 = deg360(dB - 270 * dir);              // Nael; the dragons follow round, Bahamut sixth, Twintania's gap last
      const tLD = T('Lunar Dive 1', t0 + 8, t0 + 16, t0 + 12.4);
      const tCa = [2, 3, 4, 5, 6].map((k, i) => T(`Cauterize ${k}`, t0 + 14, t0 + 32, t0 + 19.4 + 2 * i));
      const tMF = T('Megaflare Dive 7', t0 + 25, t0 + 35, t0 + 29.6), tTwM = T('Twin Marker', t0 + 30, t0 + 38, t0 + 34.4);
      const tSt = T('Stack', t0 + 33, t0 + 41, t0 + 37.4), tTD = T('Twisting Dive 8', t0 + 34, t0 + 42, t0 + 38.5), tTow = T('Towers', t0 + 35, t0 + 43, t0 + 39.3);
      label(go, `Grand Octet (Bahamut ${dirName(dB)}: run ${dir < 0 ? 'counterclockwise' : 'clockwise'})`);
      call(t0 + 2, `Bahamut ${dirName(dB)}: run ${dir < 0 ? 'counterclockwise' : 'clockwise'}`, { alert: true, dur: 5 });
      const dAt = (k) => deg360(d0 + 45 * dir * k);
      const R = 15.5;
      other('nael', [{ t: 0, at: at(dAt(0), 21) }], [[t0 + 2, tLD + 0.6]], [0, 0]);
      DRAGONS.forEach((m, k) => other(m, [{ t: 0, at: at(dAt(k + 1), 22) }], [[t0 + 2, tCa[k] + 0.6]], [0, 0]));
      bossAt(t0 + 2, at(dAt(6), 21));
      bossAt(tMF, at(dAt(6) + 180, 21));
      bossAt(tTow + 2, [0, 0]);
      pref(t0 + 2.2, clumpAt(S, [0, 0]));
      const locks = [tLD - 4, ...tCa.map(t => t - 4)], hits = [tLD, ...tCa];
      const shapes = [[60, 8, 'Lunar Dive'], ...tCa.map(() => [52, 20, 'Cauterize'])];
      // The party at the far side from each diver as it locks on, then on round.
      const ph = (k) => r2(at(dAt(k) + 180, R));
      pref(locks[0] - 3.5, clumpAt(S, ph(0)));
      locks.forEach((L, k) => {
        hz({ t: hits[k], tell: L - 1, shape: 'line', from: k ? at(dAt(k), 22) : at(dAt(0), 21), aim: 'target', targets: [S[k % 8]], len: shapes[k][0], w: shapes[k][1], snap: 4, dmg: 1.3, name: shapes[k][2], react: 4 });
        pref(L + 0.05, clumpAt(S, ph(k + 1)));
      });
      call(locks[1] - 1, 'Keep running round the edge', { dur: 4 });
      // Bahamut's dive through the party (the tank's LB3).
      hz({ t: tMF, tell: tMF - 4, shape: 'line', at: at(dAt(6), 22), deg: dAt(6) + 180, len: 46, w: 12, dmg: 0.55, name: 'Megaflare Dive (LB3)' });
      // Twintania from the gap: R1 baits her against the wall; the MT, OT and R2 stack in the middle; H1, H2, M1, M2
      // take the towers; twisters as the towers go.
      const dT = dAt(7), twBait = r2(at(dT - 120 * dir, 19)), twFrom = at(dT, 21);
      other('main', [{ t: 0, at: twFrom }], [[tTwM - 1, tTD + 0.5]], [0, 0]);
      const chord = { shape: 'line', at: twFrom, deg: brg(sub(twBait, twFrom)), len: 60, w: 8 };
      const cands = [];
      for (let b = 0; b < 360; b += 22.5) { const p = r2(at(b, 9)); if (!inside(chord, p, 4.5) && dist(p, [0, 0]) > 8) cands.push(p); }
      const towersAt = [];
      for (const p of cands) if (towersAt.length < 4 && towersAt.every(q => dist(q, p) > 8)) towersAt.push(p);
      while (towersAt.length < 4) towersAt.push(r2(at(dT + 180 + 30 * towersAt.length, 9)));
      const towerSlots = ['H1', 'H2', 'M1', 'M2'];
      towerSlots.forEach((s, i) => tower(tTow, towersAt[i], 3, 1, [s], 'Megaflare (tower)', { tell: tTow - 8 }));
      hz({ t: tTD, tell: tTwM, shape: 'line', from: twFrom, aim: 'target', targets: ['R1'], len: 60, w: 8, snap: 4, dmg: 1.3, name: 'Twisting Dive' });
      const stk = ['MT', 'OT', 'R2'];
      stack(tSt, pick(stk), 5, 3, 3, 'Megaflare (stack)', { tell: tTwM });
      pref(tMF + 0.1, Object.assign({ R1: twBait }, assign(towerSlots, towersAt), clumpAt(stk, [0, 0])));
      call(tTwM, 'Twintania on YOU: bait her along the wall', { slot: 'R1', alert: true, dur: 4 });
      twisters(tTow);
    }

    // ======================================================================== Phase 4: the adds
    const fav = E('Bahamut\'s Favor', 980, 1010), tFav4 = fav ? fav.t : 994.4, tP4 = tFav4 - 3.6;
    const TW4 = [-2.5, 6], NA4 = [2.5, 3.5], BA4 = [0, 20];
    P.form.push({ t: tP4, model: null });
    P.hitbox.push({ t: tP4, r: 3.96 });
    bossAt(tP4, TW4);
    other('nael', [{ t: 0, at: NA4 }], [[tP4, 1300]], 'OT');
    other('bahamut', [{ t: 0, at: BA4 }], [[tP4, 1300]], [0, 0]);
    const P4 = { MT: [-2.5, 11.5], OT: [4.6, 6.2], H1: [-2.2, -1], H2: [3, -1.5], M1: [-0.8, 1.6], M2: [1.6, 0.6], R1: [-1, -2.5], R2: [1.2, -3] };
    pref(tP4 + 0.2, P4);
    call(tP4, 'Tank the adds between Neurolinks 1 and 3', { dur: 5 });
    const tankPlummet = (t) => { cleave(t, 'MT', 12, 60, 'Plummet'); buster(t + 3.2, 'OT', 'Bahamut\'s Claw', { tell: t - 1 }); };
    for (const e of EA(/^Plummet$/, tP4, tP4 + 200)) tankPlummet(e.t);
    for (const e of EA(/^Death Sentence$/, tP4, tP4 + 200)) buster(e.t, 'MT', 'Death Sentence');
    for (const e of EA(/^Ravensbeak$/, tP4, tP4 + 200)) buster(e.t, 'OT', 'Ravensbeak');
    for (const e of EA(/^Megaflare$/, tP4, tP4 + 200)) raid(e.t, 0.5, 'Megaflare', e.t - 5);
    label(E('Enrage', tP4 + 100, tP4 + 200), 'Twin Fury / White Fury (enrage: both must be down)');
    // Liquid Hell: R1 runs the south-west edge and ends by Neurolink 2.
    const lhArc4 = arc([0, 0], 17, 255, 195, 12);
    for (const e of EA(/^Liquid Hell x5$/, tP4, tP4 + 200)) liquidHell(e.t, lhArc4, 'R1', P4.R1);
    // Generate x3 + Twister: the close Hatches (1 and 3) before the twister, the far one (2) after.
    for (const e of EA(/^Generate x3$/, tP4, tP4 + 200)) {
      const g = e.t, tw = T('Twister', g + 2, g + 6, g + 4.1);
      const xs = shuffle(NT).slice(0, 3).sort((a, b) => ['M1', 'M2', 'R1', 'R2', 'H1', 'H2'].indexOf(a) - ['M1', 'M2', 'R1', 'R2', 'H1', 'H2'].indexOf(b));
      const nls = [NL[1], NL[3], NL[2]];
      xs.forEach((x, i) => {
        const far = i === 2, hT = far ? tw + 1.4 : tw - 0.4;
        if (far) {
          pref(g - 3, { [x]: r2(add(NL[2], at(0, 3.6))) });
          pref(tw + 0.35, { [x]: NL[2] });
        } else pref(g - 3, { [x]: nls[i] });
        hatch(hT, g - 3, x, nls[i]);
        pref(hT + 0.1, { [x]: P4[x] });
      });
      const rough = {};
      for (const s of NT.filter(s => !xs.includes(s))) rough[s] = r2(add(P4[s], mul(unit(P4[s]), 1.5)));
      pref(tw - 2, rough);
      twisters(tw);
      call(tw - 2, 'Twister', { dur: 3 });
      const back = Object.assign({}, P4);
      xs.forEach(x => delete back[x]);
      pref(tw + 0.35, back);
    }
    // The triple quotes: in/out round Nael, the stack in the middle, Raven Dive (spread: wtfdig's spots).
    const RD4 = { MT: [-6, 16.5], OT: [6, 16.5], H1: [13, 0], H2: [-13, 0], M1: [-7, 1], M2: [7, 1], R1: [-16, -7], R2: [16, -7] };
    const IN4 = { MT: [0.2, 6.6], OT: [4.2, 5.8] }, OUT4 = { MT: [-5, 13], OT: [10, 11] };
    const triple = (ts, kinds) => {
      call(ts[0] - 5, kinds.map(k => NAME[k]).join(' => '), { alert: true, dur: 6 });
      kinds.forEach((k, i) => {
        const t = ts[i], from = i ? ts[i - 1] + 0.1 : ts[0] - 4.8, tell = i ? ts[i - 1] : ts[0] - 5;
        if (k === 'dynamo') { hz({ t, tell, shape: 'donut', at: NA4, r0: 6, r1: 40, dmg: 1.2, name: NAME.dynamo, react: 4 }); pref(from, Object.assign(clumpAt(NT, [0.8, 1]), IN4)); }
        else if (k === 'chariot') { hz({ t, tell, shape: 'circle', at: NA4, r: 8.55, dmg: 1.2, name: NAME.chariot, react: 4 }); pref(from, Object.assign(clumpAt(NT, [-3.5, -6.5]), OUT4)); }
        else if (k === 'beam') { stack(t, pick(S), 4, 8, 8, NAME.beam, { tell }); pref(from, clumpAt(S, [0.5, 0.5])); }
        else if (k === 'dive') {
          const tgt = pick(S);
          hz({ t, tell, effect: 'bait', shape: 'circle', from: 'target', targets: [tgt], r: 3, dmg: 1.0, own: 0.4, name: NAME.dive });
          pref(from, RD4);
          P.others[P.others.length - 2].path.push({ t, at: RD4[tgt] }, { t: t + 1.5, at: NA4, move: 2 });
        }
      });
    };
    const Q4 = [['chariot', 'beam', 'dive'], ['chariot', 'dive', 'beam'], ['dynamo', 'dive', 'beam'], ['dynamo', 'chariot', 'dive']];
    const qa = Math.floor(Math.random() * 4), qb = qa < 2 ? 2 + Math.floor(Math.random() * 2) : Math.floor(Math.random() * 2);
    const qe1 = E('Lunar Dynamo/Iron Chariot', tP4 + 20, tP4 + 45) || E('Iron Chariot', tP4 + 20, tP4 + 50);
    const qe2 = E('Lunar Dynamo', tP4 + 80, tP4 + 110);
    [[qe1, Q4[qa]], [qe2, Q4[qb]]].forEach(([e, ks]) => {
      if (!e) return;
      const ts = [e.t, e.t + 3, e.t + 6.1];
      label(e, ks.map(k => NAME[k]).join(' => '));
      [1, 2].forEach(i => { const ev = events.find(x => Math.abs(x.t - ts[i]) < 0.6 && /Raven|Chariot|Beam|Dynamo/.test(x.name)); if (ev) label(ev, NAME[ks[i]]); });
      triple(ts, ks);
      const tw = T('Twister', ts[2] + 1, ts[2] + 6, ts[2] + 3.6);
      twisters(tw);
      if (ks[2] !== 'dive') pref(tw - 2, Object.assign({}, ...NT.map(s => ({ [s]: r2(add(P4[s], mul(unit(P4[s]), 2.5))) }))));
      pref(tw + 0.35, P4);
    });

    // ======================================================================== Phase 5: Golden Bahamut
    const tera = E('Teraflare', 1150, 1260), tT = tera ? tera.t : 1212.9, tP5 = tT - 16.2;
    const tFoR = T('Flames Of Rebirth', tT + 10, tT + 40, tT + 25.1), tTarg = tT + 45;
    P.untargetable.push([tP5, tTarg]);
    P.form.push({ t: tP5, model: 'bahamut' }, { t: tFoR + 4, model: 'golden' });
    P.hitbox.push({ t: tP5, r: 4.2 });
    bossAt(tP5, BA4);
    bossAt(tP5 + 3, [0, 0], 4);
    P.others.forEach(o => { if (o.model === 'nael' || o.model === 'bahamut') o.shows = o.shows.map(([a, b]) => [a, b > tP5 && a < tP5 ? tP5 : b]); });
    raid(tT, 0.55, 'Teraflare', tT - 5);
    label(tera, 'Teraflare (the party falls; Phoenix revives it)');
    const UP5 = { MT: [-0.8, 6.8], OT: [0.8, 6.8], M1: [-1.5, -1.5], M2: [1.5, -1.5], H1: [-0.8, -2.6], H2: [0.8, -2.6], R1: [-2.2, -3.2], R2: [2.2, -3.2] };
    pref(tP5 + 0.5, UP5);
    for (const e of EA(/^Morn Afah #\d$/, tP5, tP5 + 300)) {
      stack(e.t, pick(NT), 4, 8, 8, 'Morn Afah', { tell: e.t - 6, dmg: 0.4 });
      pref(e.t - 5.5, clumpAt(S, [0, -1]));
      pref(e.t + 0.1, UP5);
      call(e.t - 6, 'Morn Afah: everyone in the boss', { dur: 4 });
    }
    for (const e of EA(/^Akh Morn #\d$/, tP5, tP5 + 300)) {
      const hits = Math.round((e.dur || 3.3) / 1.1) + 1;
      for (let k = 0; k < hits; k++) stack(e.t + 1.1 * k, 'MT', 4, 2, 2, 'Akh Morn', { tell: e.t - 4, dmg: 0.4 });
      call(e.t - 4, `Akh Morn x${hits}: tanks share`, { dur: 4 });
    }
    // Exaflares: three lines in from the edge (cardinals and intercards), 8 yalms a step every 1.5 s, six steps.
    for (const e of EA(/^Exaflare #\d$/, tP5, tP5 + 300)) {
      const bs = shuffle([0, 45, 90, 135, 180, 225, 270, 315]);
      const use = [bs[0]];
      for (const b of bs) if (use.length < 3 && use.every(u => Math.abs(((b - u + 540) % 360) - 180) >= 90)) use.push(b);
      use.forEach((b, i) => {
        for (const h of B.mechSeq.exaflare({ at: at(b, 20), deg: b + 180, t: e.t + 2 * i, n: 6, r: 6, step: 8, every: 1.5, show: 2, dmg: 1.0, name: 'Exaflare' })) hz(h);
      });
      label(e, `Exaflare #${e.name.slice(-1)} (from the ${use.map(dirName).join(', ')})`);
    }
    for (const e of EA(/^Morn Afah Enrage/, tP5, tP5 + 400)) label(e, e.name.replace('Morn Afah Enrage', 'Morn Afah (enrage)'));

    P.boss.sort((a, b) => a.t - b.t);
    P.form.sort((a, b) => a.t - b.t);
    P.hitbox.sort((a, b) => a.t - b.t);
    return P;
  }

  B.FIGHT_SCRIPTS = B.FIGHT_SCRIPTS || {};
  // FFLogs (kills A4jp6rv8KZQ1XgGx #16 and LZ6kTx8yahYD2A43 #8): Twintania 1,882,943 HP, Nael deus Darnus 1,706,046,
  // Bahamut Prime 4,679,480; in the adds phase Twintania comes back with 751,691 and Nael with 767,189; Golden
  // Bahamut is Bahamut Prime again, healed to full. Each pool is scaled to the bots' (Dawntrail) damage so its phase
  // takes as long as in those kills at ~220,000 party DPS: P1 133 s, P2 127 s, P4 110 s, P5 175 s.
  const HP1 = 29.35e6, HP2 = 27.9e6, HP4T = 11.98e6, HP4N = 12.22e6, HP5 = 38.5e6;
  B.FIGHT_SCRIPTS.ucob = {
    hp: HP1 + HP2 + HP4T + HP5,
    // Bahamut Prime in P3 (time-locked; his HP there is a window that takes all the damage, as it never reaches the
    // later pools; it shows his HP falling to about half, as in the kills), and Nael beside Twintania in the adds
    // phase (half the damage, so the two fall together).
    adds: [
      { from: 650, to: 990.8, hp: 77e6, share: 1, name: 'Bahamut Prime' },
      { from: 990.8, to: 1196.7, hp: HP4N, share: HP4N / (HP4N + HP4T), name: 'Nael deus Darnus' },
    ],
    // Twintania's 75% and 45% (each block's loop runs till then) and her death, Nael's death (not before the
    // divebombs are over), and the adds phase over (Twintania with Nael) to Teraflare.
    pushes: [
      { from: 0, to: 100, dealt: HP1 * 0.25, name: 'Twintania at 75%' },
      { from: 100, to: 200, dealt: HP1 * 0.55, name: 'Twintania at 45%' },
      { from: 200, to: 400, dealt: HP1, name: 'Twintania falls' },
      { from: 562.5, to: 650, dealt: HP1 + HP2, name: 'Nael deus Darnus falls' },
      { from: 990.8, to: 1196.7, dealt: HP1 + HP2 + HP4T, name: 'Twintania and Nael fall' },
    ],
    defaultStrat: 'naur',
    strats: {
      naur: { label: 'NAUR (NA)' },
    },
    source: 'wtfdig.info/ultimates/ucob (NAUR); mechanics after BossMod (github.com/awgil/ffxiv_bossmod) and cactbot',
    // A north, B east, C south, D west on the edge; 1-3 the Neurolinks.
    waymarks: [
      { label: 'A', at: [0, 18], color: 'red' }, { label: 'B', at: [18, 0], color: 'yellow' },
      { label: 'C', at: [0, -18], color: 'blue' }, { label: 'D', at: [-18, 0], color: 'purple' },
      { label: '1', at: NL[1], color: 'red', square: true }, { label: '2', at: NL[2], color: 'yellow', square: true },
      { label: '3', at: NL[3], color: 'blue', square: true },
    ],
    plan,
  };
})(window.BLM);
