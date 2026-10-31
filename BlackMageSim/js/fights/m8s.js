// M8S, AAC Cruiserweight M4 (Savage): Howling Blade's mechanics for the sim's party, on cactbot's timeline, and the
// strats wtfdig.info lists for them: Toxic (the first it lists, and the one the others build on), Pastebin, Pastebin +
// Rinon (NA) and 84ddog (EU). wtfdig's strats are bundles of per-mechanic choices (its toggles): Millennial Decay
// (Fering or Toxic), Terrestrial Rage (Clock, Toxic, DN, Full or Half Rinon), Beckon Moonlight (Quad or Toxic),
// Twofold Tempest (Original or Caster SE), Lone Wolf's Lament and the fourth Ultraviolent Ray (Rinon or Toxic); each
// strat's spots come from those. Spots are [east, north] yalms from the arena's middle.
//
// The mechanics follow BossMod's module for the fight (github.com/awgil/ffxiv_bossmod, RM08SHowlingBlade), whose
// shapes and sizes come from the game's Action sheet, built with the sim's toolkit (js/mech.js: aimed attacks,
// stacks, baits, towers, knockbacks, tethers, lasting puddles, the arena by phase, phase pushes):
//   Phase 1, a round arena of radius 12:
//   - Windfang / Stonefang: a cross (15 long, 6 wide) on the cardinals or intercardinals, and a donut 8-20 (in, then
//     25-degree cones at the supports, each shared with a DPS) or a 9-yalm circle (out, then a cone at everyone).
//   - Eminent / Revolutionary Reign: shadows' 6-yalm circles, his leap and 10-wide dash across the arena, then a
//     120-degree cone (in: get behind him) or a 14-yalm circle (out), with cone stacks at the healers (Sovereign Scar)
//     and cones at the tanks (Reign's End), from where he landed.
//   - Millennial Decay: Aero III knocks everyone 8 yalms out; five 8-wide lines turning 45 degrees each; Gust spreads
//     (5); a second knockback into one-player towers and out to stretch the wolves' tethered cones (Winds of Decay).
//   - Tracking Tremors: eight party stacks. Great Divide: a 6-wide line the tanks share.
//   - Terrestrial Titans: two pillars (5-yalm circles) that fall as 10-wide lines, and two Fanged Crossings (crosses 7
//     wide): one intercard left safe.
//   - Tactical Pack: the middle falls away (8 yalms) and the two wolves (their own HP: when they're dead the fight
//     moves on) are tanked at the edge; Pack Predation's 6-wide lines from each wolf at a player and cones at its tank;
//     Earthborne/Windborne End to cleanse in the matching font.
//   - Terrestrial Rage: Fanged Charge lines (6 wide), stack and spreads (6), Shadowchase's five 8-wide lines from a
//     pentagon of shadows (behind them is safe), then Roaring Wind's from the other pentagon.
//   - Beckon Moonlight: four half-room cleaves, two at a time leaving a quadrant; stack and spreads in it.
//   - Weal of Stone: 6-wide lines.
//   Phase 1 ends when its HP does (67.6M dealt), straight to the transition.
//   Phase 2, five platforms (radius 8, 17.5 out from the middle: S, SW, NW, NE, SE) round the boss (now R19); off them
//   is a fall (you leap from one to the next, here round the ring), and destroyed platforms drop out:
//   - Quake III: light parties stack by platform. Ultraviolent Ray: five baits, one to a platform, while Gleaming
//     Beams (8 wide) sweep one half of each. Twinbite: a platform-wide buster on each tank. Hero's Blow: half the room
//     and in (a 15-30 donut) or out (a 22-yalm circle).
//   - Mooncleaver destroys the south platform for a while; Elemental Purge: a 16-yalm spread on a tank, a 6-yalm
//     stack, and a 200-degree cone at the other tank. Prowling Gale: two-player towers.
//   - Twofold Tempest: four rounds of a tethered pair stacking far (leaving a 9-yalm puddle) while the pair nearest the
//     boss shares the line at their platform from close in.
//   - Champion's Circuit: five turns of a rotating set of shapes (a 12-wide line, a 4-13 donut, a cone out to 22, two
//     donut sectors 15.85-28), one on each platform, and a Gleaming Barrage on one half of each.
//   - Lone Wolf's Lament: close and far tethers, then 1-, 2- and 3-player towers. Howling Eight: eight hits on a
//     platform's tower, five times, the platform destroyed after each.
// Simplified: the boss stays in the middle but for the Reigns' leap and dash; the layouts wtfdig gives no diagram for
// (where the pillars, lines, wolves, fonts and towers appear) are this script's own, made to satisfy the mechanic with
// BossMod's shapes; leaping between platforms is walking round the ring of them.
(function (B) {
  const S = B.SLOTS;
  const all = (f) => Object.fromEntries(S.map(s => [s, f(s)]));
  const at = B.bearing;
  const inside = B.mechInside;
  const add = (a, b) => [a[0] + b[0], a[1] + b[1]];
  const mul = (a, k) => [a[0] * k, a[1] * k];
  const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);
  const deg360 = (d) => ((d % 360) + 360) % 360;
  const brg = (p) => deg360(Math.atan2(p[0], p[1]) * 180 / Math.PI);
  const pick = (a) => a[Math.floor(Math.random() * a.length)];
  const shuffle = (a) => { const b = a.slice(); for (let i = b.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [b[i], b[j]] = [b[j], b[i]]; } return b; };
  const G1 = ['MT', 'H1', 'M1', 'R1'], G2 = ['OT', 'H2', 'M2', 'R2'];
  const SUP = ['MT', 'OT', 'H1', 'H2'], DPS = ['M1', 'M2', 'R1', 'R2'];
  const TANKS = ['MT', 'OT'];
  const COMPASS = ['north', 'north-northeast', 'northeast', 'east-northeast', 'east', 'east-southeast', 'southeast', 'south-southeast',
    'south', 'south-southwest', 'southwest', 'west-southwest', 'west', 'west-northwest', 'northwest', 'north-northwest'];
  const dirName = (deg) => COMPASS[Math.round(deg360(deg) / 22.5) % 16];

  // ---------- the floor ----------
  const onP1 = (p) => Math.hypot(p[0], p[1]) <= 11.3;              // phase 1: the round arena (radius 12)
  // Phase 2's platforms: bearing from the middle (BossMod's platforms 0-4, clockwise from the south).
  const PLAT = { S: 180, SW: 252, NW: 324, NE: 36, SE: 108 };
  const PLATS = ['S', 'SW', 'NW', 'NE', 'SE'];
  const NEXT = { S: 'SW', SW: 'NW', NW: 'NE', NE: 'SE', SE: 'S' };
  const plat = (k) => at(PLAT[k], 17.5);
  // A point on platform k: r out from the arena's middle, l to the left (facing the boss from the platform).
  const pl = (k, r, l) => add(at(PLAT[k], r), at(PLAT[k] + 90, l || 0));
  const onPlat = (k, slack) => (p) => dist(p, plat(k)) <= (slack || 7);
  const unit = (v) => { const l = Math.hypot(v[0], v[1]) || 1; return [v[0] / l, v[1] / l]; };
  // The platforms there are (without those in `gone`), with the leap between each pair side by side as a step of
  // floor (a 5-yalm circle in the gap).
  const P2_FLOOR = (gone) => {
    const parts = PLATS.filter(k => !gone.has(k)).map(k => ({ shape: 'circle', at: plat(k), r: 8 }));
    for (const k of PLATS) if (!gone.has(k) && !gone.has(NEXT[k])) parts.push({ shape: 'circle', at: at(PLAT[k] + 36, 15.5), r: 5 });
    return parts;
  };
  const arenaAt = (A, t) => { let cur = A[0]; for (const x of A) if (x.t <= t) cur = x; return cur; };
  const onFloor = (a, p, m) => (a.parts || [a]).some(s => dist(p, s.at || [0, 0]) < s.r - (m || 0));

  // ---------- shapes ----------
  const line = (a, deg, len, w) => ({ shape: 'line', at: a, deg, len, w });
  // n points near `want` clear of every shape in hs (by a bot's margin and a little), on the floor (ok), gap apart.
  function clump(hs, want, n, ok, o) {
    o = o || {};
    const m = o.m === undefined ? 1.3 : o.m, gap = o.gap || 0.55;
    const good = (p) => ok(p) && hs.every(h => !inside(h, p, m));
    const out = [];
    if (good(want)) out.push(want.slice());
    for (let r = 0.3; r <= 16 && out.length < n; r += 0.3) {
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

  // ---------- the party's places ----------
  // Uptime in phase 1: the tanks at his front (he faces north), everyone else clumped at his back (his hitbox is 5).
  const UP = { MT: [-1.5, 6.3], OT: [3, 4.6], M1: [-2.8, -4.2], M2: [1.2, -5.4], R1: [-0.8, -5.6], R2: [2.6, -4.8], H1: [-1.5, -3.5], H2: [1.5, -3.8] };
  // Tracking Tremors' eight stacks: all on one spot at his back.
  const STACK = { MT: [-0.6, -2.4], OT: [0.6, -2.4], H1: [-1.2, -3.2], H2: [1.2, -3.2], M1: [-0.6, -4], M2: [0.6, -4], R1: [-1.2, -4.8], R2: [1.2, -4.8] };
  // Under him, for the shadows' circles at the edge.
  const CENTRE = all(s => at({ MT: 0, OT: 45, H2: 90, M2: 135, R2: 180, M1: 225, H1: 270, R1: 315 }[s], 1.8));
  // Phase 2: the light parties' platforms (Quake III's: G1 south-west, G2 south-east), and the south platform.
  const P2UP = {
    MT: pl('SW', 13.5, 1.2), M1: pl('SW', 13.5, -1.2), H1: pl('SW', 17, 2), R1: pl('SW', 17, -2),
    OT: pl('SE', 13.5, -1.2), M2: pl('SE', 13.5, 1.2), H2: pl('SE', 17, -2), R2: pl('SE', 17, 2),
  };
  const SOUTH = { MT: [-1.5, -12], OT: [1.5, -12], M1: [-1, -13.6], M2: [1, -13.6], H1: [-2.5, -15.2], H2: [2.5, -15.2], R1: [-2.5, -17], R2: [2.5, -17] };

  // The waymarks' colours pair a support with a DPS (Toxic's): red MT+R1, yellow H2+R2, blue OT+M2, purple H1+M1, by
  // the cardinal marker (A north, B east, C south, D west) or the intercard one to its left (1 NW, 2 NE, 3 SE, 4 SW).
  const COLOR_PAIRS = { red: ['MT', 'R1'], yellow: ['H2', 'R2'], blue: ['OT', 'M2'], purple: ['H1', 'M1'] };
  const CARD = { red: 0, yellow: 90, blue: 180, purple: 270 };

  // Each strat's choices (wtfdig's toggles; Pastebin's from its party-finder line, "Toxic | Fering | Clock | Quad |
  // Toxic P2", where the site's own defaults repeat Toxic's).
  const STRATS = {
    toxic: { decay: 'toxic', terrestrial: 'toxic', moonlight: 'toxic', twofold: 'casterse', lament: 'toxic', uv4: 'toxic' },
    'pb-eQ': { decay: 'fer', terrestrial: 'clock', moonlight: 'quad', twofold: 'casterse', lament: 'toxic', uv4: 'toxic' },
    'pb-r': { decay: 'fer', terrestrial: 'clock', moonlight: 'quad', twofold: 'original', lament: 'rinon', uv4: 'rinon' },
    '84ddog': { decay: 'toxic', terrestrial: 'fullr', moonlight: 'quad', twofold: 'casterse', lament: 'toxic', uv4: 'toxic' },
  };

  // Millennial Decay: each spot's bearing while the first line (north-south) comes, four each side; everyone turns
  // 45 degrees with each line after (34 degrees apart, so the Gust spreads clear even mid-turn). Fering: healers and
  // melee west, tanks and ranged east, G1 north; Toxic: G1 west (red north, purple south), G2 east (yellow, blue).
  const DECAY = {
    fer: { H1: 321, M1: 287, M2: 253, H2: 219, MT: 39, R1: 73, R2: 107, OT: 141 },
    toxic: { MT: 321, R1: 287, H1: 253, M1: 219, H2: 39, R2: 73, OT: 107, M2: 141 },
  };
  // Terrestrial Rage, the first set: who of each pair spreads where (front/back, left/right, from the wall laser's
  // "relative north"); the second set: each pair's shadow, counted clockwise from the stack's.
  const RAGE1 = {
    clock: { FL: ['MT', 'R1'], FR: ['H2', 'R2'], BL: ['H1', 'M1'], BR: ['OT', 'M2'] },
    toxic: { FL: ['MT', 'R1'], FR: ['H2', 'R2'], BL: ['H1', 'M1'], BR: ['OT', 'M2'] },
    dn: { FL: ['MT', 'M1'], BL: ['H1', 'R1'], FR: ['OT', 'M2'], BR: ['H2', 'R2'] },
    fullr: { FL: ['MT', 'M1'], BL: ['H1', 'R1'], FR: ['OT', 'M2'], BR: ['H2', 'R2'] },
    halfr: { FL: ['MT', 'M1'], BL: ['H1', 'R1'], FR: ['OT', 'M2'], BR: ['H2', 'R2'] },
  };
  const RAGE2 = {
    clock: { 288: ['MT', 'R1'], 216: ['H1', 'M1'], 144: ['OT', 'M2'], 72: ['H2', 'R2'] },
    toxic: { 288: ['MT', 'R1'], 216: ['H1', 'M1'], 144: ['OT', 'M2'], 72: ['H2', 'R2'] },
    halfr: { 288: ['MT', 'R1'], 216: ['H1', 'M1'], 144: ['OT', 'M2'], 72: ['H2', 'R2'] },
    dn: { 288: ['H1', 'R1'], 216: ['MT', 'M1'], 72: ['H2', 'R2'], 144: ['OT', 'M2'] },
    fullr: { 288: ['MT', 'M1'], 216: ['H1', 'R1'], 72: ['OT', 'M2'], 144: ['H2', 'R2'] },
  };
  // Twofold Tempest: each pair's home platform (Original; Caster SE swaps M2 and R2). The DPS holds the tether.
  const TWOFOLD = {
    original: { SW: ['MT', 'M1'], SE: ['OT', 'M2'], NW: ['H1', 'R1'], NE: ['H2', 'R2'] },
    casterse: { SW: ['MT', 'M1'], NE: ['H2', 'M2'], NW: ['H1', 'R1'], SE: ['OT', 'R2'] },
  };
  // Whose platform's pair baits the line while the tether is on a platform.
  const TWOFOLD_LINE = { SW: 'NE', NW: 'SE', NE: 'SW', SE: 'NW' };

  // ---------- phase 2's leaps ----------
  // A move between platforms that a straight walk would take off the floor goes round instead: out to the ring of
  // platforms, along it (the way that passes no missing platform) and in to the spot, at a run.
  function ringRoute(a, b, t0, floor) {
    const ba = brg(a), bb = brg(b), gone = (k) => !floor.parts.some(s => s.r === 8 && dist(s.at, plat(k)) < 0.1);
    let d = ((bb - ba + 540) % 360) - 180;
    const blocked = (dd) => PLATS.some(k => { const rel = deg360((PLAT[k] - ba) * Math.sign(dd)); return gone(k) && rel > 1 && rel < Math.abs(dd) - 1; });
    if (blocked(d)) d = d > 0 ? d - 360 : d + 360;
    const pts = [a, at(ba, 17.5)], n = Math.max(1, Math.ceil(Math.abs(d) / 4));
    for (let i = 1; i <= n; i++) pts.push(at(ba + d * i / n, 17.5));
    pts.push(b);
    const len = [0];
    for (let i = 1; i < pts.length; i++) len.push(len[i - 1] + dist(pts[i - 1], pts[i]));
    return (t) => {
      const s = Math.max(0, (t - t0) * 5.8);
      if (s >= len[len.length - 1]) return b;
      let i = 1;
      while (len[i] < s) i++;
      const k = (s - len[i - 1]) / Math.max(1e-6, len[i] - len[i - 1]);
      return [pts[i - 1][0] + (pts[i][0] - pts[i - 1][0]) * k, pts[i - 1][1] + (pts[i][1] - pts[i - 1][1]) * k];
    };
  }
  // (Where each spot is at any second, it walking straight to each new spot or round the ring, for the next move.)
  const walk = (a, b, t0) => (t) => { const d = dist(a, b), k = d < 0.01 ? 1 : Math.min(1, Math.max(0, (t - t0) * 5.8 / d)); return [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k]; };
  function addRoutes(P) {
    for (const s of S) {
      const mine = P.prefs.filter(e => e.spots[s] !== undefined).sort((x, y) => x.t - y.t);
      let cur = () => P.start[s];
      mine.forEach((e, i) => {
        if (mine[i + 1] && mine[i + 1].t === e.t) return;           // the later one at the same second wins
        const b = e.spots[s];
        if (typeof b === 'function') { cur = b; return; }
        const a = cur(e.t), fl = arenaAt(P.arena, e.t);
        let on = true;
        for (let k = 1; k <= 40 && on; k++) on = onFloor(fl, [a[0] + (b[0] - a[0]) * k / 40, a[1] + (b[1] - a[1]) * k / 40], 0.4);
        if (!fl.deathwall || on) { cur = walk(a, b, e.t); return; }
        const f = ringRoute(a, b, e.t, fl);
        P.prefs.push({ t: e.t, spots: { [s]: f } });
        cur = f;
      });
    }
  }

  // ---------- the pull ----------
  function plan(events, strat) {
    const st = STRATS[strat] || STRATS.toxic;
    const P = { start: Object.assign({}, UP), prefs: [], hazards: [], checks: [], calls: [], marks: [], labels: new Map(), debuffs: [],
      boss: [{ t: 0, at: [0, 0] }], hitbox: [{ t: 0, r: 5 }, { t: 605, r: 19 }], looks: [{ t: 0, show: ['a1'] }, { t: 627.9, show: ['a2'], lift: 150 }],
      form: [{ t: 627.9, model: 'p2' }] };     // phase 2's giant form (the zone's extra model), with the platforms
    let id = 0, hold = -1, p2 = false, reignEnd = -1;
    const drops = [];                     // phase 2's platforms gone: {k, from, to}
    const hz = (o) => { const h = Object.assign({ id: ++id, react: 3 }, o); P.hazards.push(h); return h.id; };
    const pref = (t, spots) => P.prefs.push({ t, spots });
    const call = (t, text, o) => P.calls.push(Object.assign({ t, text }, o));
    const check = (o) => P.checks.push(o);
    const debuff = (slot, key, name, hint, t0, t1) => P.debuffs.push({ slot, key, name, hint, t0, t1 });
    const castOf = (ev, d) => ev.t - (ev.cast || d || 5);
    const next = (i, test, within) => { for (let k = i + 1; k < events.length && events[k].t - events[i].t <= within; k++) if (test(events[k])) return events[k]; return null; };
    const after = (i, test, within) => events.filter((e, k) => k > i && e.t - events[i].t <= within && test(e));
    const home = () => (p2 ? P2UP : UP);
    // A mechanic's spots start no earlier than the last one's are done with, and it ends by sending everyone home.
    const begin = (t0) => Math.max(t0, hold + 0.05);
    const end = (t1, spots) => { pref(t1, spots || home()); hold = t1; };
    const raid = (ev, dmg, d) => { hz({ t: ev.t, tell: castOf(ev, d || 4), raidwide: true, dmg, name: ev.name.replace(/ \d+$/, '') }); };
    // A spread on each target (its own circle; anyone else in it is hit), and a stack on one (shared by `min`).
    const spreads = (t, targets, r, name, o) => hz(Object.assign({ t, tell: t - 5, effect: 'bait', shape: 'circle', from: 'target', targets, r, dmg: 0.9, own: 0.3, name }, o));
    const stack = (t, targets, r, min, name, o) => hz(Object.assign({ t, tell: t - 5, effect: 'share', shape: 'circle', from: 'target', targets, r, min, max: min, dmg: 0.35, name }, o));
    const runs = new Set();

    events.forEach((ev, i) => {
      const name = ev.name, t = ev.t;
      if (runs.has(ev)) return;

      // ===== raidwides =====
      if (name === 'Extraplanar Pursuit' || name === 'Titanic Pursuit' || name === 'Howling Havoc') {
        raid(ev, 0.45);
        call(castOf(ev, 4), 'Raidwide', { dur: 3 });
      } else if (/^Ravenous Saber \d/.test(name)) {
        raid(ev, 0.12);
        if (name.endsWith(' 1')) call(castOf(ev, 3.4), 'Raidwide x5', { dur: 6 });

      // ===== Windfang / Stonefang =====
      } else if (name === 'Stonefang/Windfang') {
        const wind = Math.random() < 0.5, cards = Math.random() < 0.5, cs = castOf(ev, 6);
        const fang = wind ? 'Windfang' : 'Stonefang';
        P.labels.set(ev, `${fang} (cross on the ${cards ? 'cardinals' : 'intercardinals'})`);
        hz({ t, tell: cs, shape: 'cross', at: [0, 0], deg: cards ? 0 : 45, len: 15, w: 6, dmg: 1.3, name: fang });
        hz(wind ? { t, tell: cs, shape: 'donut', at: [0, 0], r0: 8, r1: 20, dmg: 1.3, name: fang } : { t, tell: cs, shape: 'circle', at: [0, 0], r: 9, dmg: 1.3, name: fang });
        // Each colour's pair on its marker between the arms: stacked in close (Windfang: a cone at each support, its
        // DPS in it), or either side of it out at the wall (Stonefang: a cone at everyone; the support on the left).
        const spots = {};
        for (const [c, [sup, dps]] of Object.entries(COLOR_PAIRS)) {
          const b = CARD[c] - (cards ? 45 : 0);
          if (wind) spots[sup] = spots[dps] = at(b, 6.4);
          else { spots[sup] = at(b - 16, 10.6); spots[dps] = at(b + 16, 10.6); }
        }
        pref(begin(cs + 0.3), spots);
        if (wind) hz({ t: t + 0.1, tell: t - 2, effect: 'share', shape: 'cone', from: 'boss', aim: 'target', targets: SUP, half: 12.5, r: 40, min: 2, max: 2, dmg: 0.35, name: 'Windfang' });
        else hz({ t: t + 0.1, tell: t - 2, effect: 'bait', shape: 'cone', from: 'boss', aim: 'target', targets: S, half: 12.5, r: 40, dmg: 0.9, own: 0.2, name: 'Stonefang' });
        call(cs, wind ? `In + ${cards ? 'Intercards' : 'Cards'} + Partners` : `Out + ${cards ? 'Intercards' : 'Cards'} + Protean`, { alert: true, dur: 6 });
        end(t + 0.4);

      // ===== Eminent / Revolutionary Reign =====
      } else if (name === 'Eminent Reign/Revolutionary Reign') {
        const inn = Math.random() < 0.5, cs = castOf(ev, 5.1);
        P.labels.set(ev, inn ? 'Eminent Reign' : 'Revolutionary Reign');
        // Three shadows 120 degrees apart (one set or the other); he leaps to one of them and dashes across.
        const set0 = pick([0, 180]), clones = [0, 120, 240].map(d => deg360(set0 + d)), th = pick(clones);
        const dash = next(i, e => e.name === "Wolves' Reign (circles)", 6), cone = next(i, e => e.name === "Wolves' Reign (cones)", 9);
        const tJump = t + 1.4, tDash = (dash ? dash.t : t + 3.4) + 0.4, tEnd = (cone ? cone.t : t + 6.4) + 0.4;
        const src = at(th + 180, 7.25);           // where the dash ends, facing back the way he came
        P.boss.push({ t: tJump - 0.3, at: at(th, 10) }, { t: tDash - 0.4, at: src, move: 0.4 }, { t: tEnd + 1, at: [0, 0], move: 1.5 });
        for (const c of clones) hz({ t: tJump, tell: cs + 1, shape: 'circle', at: at(c, 10), r: 6, dmg: 1.3, name: "Wolves' Reign" });
        hz({ t: tDash, tell: tJump, shape: 'line', at: at(th, 10), deg: th + 180, len: 28, w: 10, dmg: 1.4, name: "Wolves' Reign" });
        hz(inn ? { t: tEnd, tell: tDash, shape: 'cone', at: src, deg: th, half: 60, r: 40, dmg: 1.4, name: "Wolves' Reign" }
          : { t: tEnd, tell: tDash, shape: 'circle', at: src, r: 14, dmg: 1.4, name: "Wolves' Reign" });
        // Looking at him from the middle, G1 on the left (BossMod's spots): in, the tanks just behind him and the
        // light parties at his sides; out, everyone across the arena, the tanks wider.
        const fin = all(s => {
          const sg = G1.includes(s) ? 1 : -1, tank = TANKS.includes(s);
          return inn ? add(src, at(th + sg * (tank ? 145 : 75), tank ? 4 : 7)) : add(src, at(th + sg * (tank ? 42 : 9.5), tank ? 15.3 : 17.5));
        });
        // While he dashes: beside the line, level with the final spot.
        const ua = at(th, 1), un = at(th + 90, 1);
        const wait = all(s => {
          const f = fin[s], a = f[0] * ua[0] + f[1] * ua[1], l = f[0] * un[0] + f[1] * un[1];
          const l2 = (G1.includes(s) ? 1 : -1) * Math.max(Math.abs(l), 6.4), a2 = Math.sign(a) * Math.min(Math.abs(a), Math.sqrt(Math.max(0, 11 * 11 - l2 * l2)));
          return add(mul(ua, a2), mul(un, l2));
        });
        pref(begin(cs + 0.3), CENTRE);
        pref(tJump + 0.05, wait);
        pref(tDash + 0.05, fin);
        // Sovereign Scar: a cone at each healer, their light party in it; Reign's End: a cone at each tank.
        hz({ t: tEnd + 0.1, tell: tDash, effect: 'share', shape: 'cone', from: src, aim: 'target', targets: ['H1', 'H2'], half: 15, r: 40, min: 3, max: 4, dmg: 0.35, name: 'Sovereign Scar' });
        hz({ t: tEnd + 0.1, tell: tDash, effect: 'bait', shape: 'cone', from: src, aim: 'target', targets: TANKS, half: 30, r: 40, dmg: 1.2, own: 0.5, buster: true, name: "Reign's End" });
        call(cs, inn ? '(In later)' : '(Out later)', { dur: 4 });
        call(tJump, inn ? `In: behind him, ${dirName(th + 180)}` : `Out: far side, ${dirName(th)}`, { alert: true, dur: 5 });
        reignEnd = tEnd;
        // (Straight on to the lanes when Weal of Stone's lines follow, once the cones are out.)
        end(next(i, e => e.name === 'Weal of Stone', 14) ? tEnd + 0.15 : tEnd + 0.4);

      // ===== Weal of Stone: three lines =====
      } else if (name === 'Weal of Stone') {
        const ns = Math.random() < 0.5, u = ns ? 0 : 90;
        // Lines 6 wide at -9, 0 and 9 across; the lanes between them (4.5 either side of the middle) are safe.
        for (const o of [-9, 0, 9]) hz(Object.assign({ t, tell: t - 4.5, dmg: 1.3, name, react: 1.5 }, line(add(at(u, -16), at(u + 90, o)), u, 32, 6)));
        const lanes = all(s => {
          const k = (G1.includes(s) ? -1 : 1), j = (G1.includes(s) ? G1 : G2).indexOf(s);
          return add(at(u + 90, 4.5 * k), at(u, -3 + 2 * j));
        });
        pref(begin(Math.max(t - 5.5, reignEnd + 0.2)), lanes);
        call(t - 4.5, `Lines: stand in a lane ${ns ? 'east or west' : 'north or south'} of the middle`, { alert: true, dur: 4 });
        end(t + 0.3);

      // ===== Millennial Decay =====
      } else if (name === 'Millennial Decay') {
        raid(ev, 0.45, 5);
        call(castOf(ev, 5), 'Raidwide', { dur: 3 });
        const lines = after(i, e => /^Breath of Decay \d/.test(e.name), 30), gusts = after(i, e => /^Gust \d/.test(e.name), 25);
        const aeros = after(i, e => e.name === 'Aero III', 35), prowl = next(i, e => e.name === 'Prowling Gale (Towers)', 35);
        const winds = next(i, e => e.name === 'Winds of Decay', 35);
        lines.concat(gusts, aeros).forEach(e => runs.add(e));
        // Aero III: knocked 8 yalms out from him (twice): everyone stands 8 short of where they want to land.
        aeros.forEach(e => hz({ t: e.t, tell: castOf(e, 5), effect: 'knockback', from: 'boss', dist: 8, dmg: 0.15, name: 'Aero III' }));
        // The wolves' lines: the first north-south, each after turned 45 degrees the same way round.
        const phi0 = pick([0, 180]), dir = pick([1, -1]), base = DECAY[st.decay] || DECAY.toxic;
        lines.forEach((e, k) => {
          const d = phi0 + 45 * k * dir;
          hz(Object.assign({ t: e.t, tell: k ? lines[k - 1].t - 1.5 : e.t - 6, dmg: 1.4, name: 'Breath of Decay', react: 2 }, line(at(d, 13), d + 180, 26, 8)));
        });
        const turned = (k, r) => all(s => at(base[s] + 45 * k * dir, r || 11));
        const kb1 = aeros[0] ? aeros[0].t : (lines[0] ? lines[0].t - 1.4 : t + 10);
        pref(begin(kb1 - 4.5), turned(0, 3));
        pref(kb1 + 0.05, turned(0));
        lines.slice(0, -1).forEach((e, k) => pref(e.t + 0.05, turned(k + 1)));
        call(kb1 - 5, `Knockback, then lines turning ${dir > 0 ? 'clockwise' : 'counterclockwise'}: rotate with them`, { alert: true, dur: 6 });
        // Gust: spreads on four, then the other four.
        const gust1 = shuffle(S).slice(0, 4), gustSets = [gust1, S.filter(s => !gust1.includes(s))];
        gusts.forEach((e, k) => {
          spreads(e.t, gustSets[k] || [], 5, 'Gust', { tell: e.t - 4 });
          for (const s of gustSets[k] || []) call(e.t - 4, 'Spread (Gust)', { slot: s, dur: 4 });
        });
        // Then each colour's pair: one tethered to a wolf across the arena (Winds of Decay: a cone along the tether,
        // stretched; each wolf a little round from straight across, so nobody stands at another's), one knocked into the
        // tower on their marker. Towers on the cardinals or the intercards; tethers on
        // the others.
        if (prowl) {
          const cards = Math.random() < 0.5, pre = {}, spots = {};
          for (const [c, pair] of Object.entries(COLOR_PAIRS)) {
            const tw = cards ? CARD[c] : CARD[c] - 45, te = cards ? CARD[c] - 45 : CARD[c];
            const [teth, soak] = Math.random() < 0.5 ? pair : [pair[1], pair[0]], wolf = at(te + 200, 12.6);
            pre[soak] = at(tw, 1); spots[soak] = at(tw, 9);
            pre[teth] = at(te, 3.2); spots[teth] = at(te, 11.2);
            hz({ t: prowl.t, tell: prowl.t - 7, effect: 'tower', shape: 'circle', at: at(tw, 9), r: 2, soak: 1, dmg: 0.3, fail: 0.9, name: 'Prowling Gale' });
            hz({ t: winds ? winds.t : prowl.t + 0.1, tell: prowl.t - 7, effect: 'bait', shape: 'cone', from: wolf, aim: 'target', targets: [teth], half: 15, r: 40,
              tether: wolf, stretch: 18, dmg: 1.2, own: 0.35, fail: 0.9, name: 'Winds of Decay' });
            call(prowl.t - 7, 'Knockback into the tower on your colour', { slot: soak, dur: 6 });
            call(prowl.t - 7, `Tether: get knocked to the ${dirName(te)}`, { slot: teth, alert: true, dur: 6 });
          }
          const kb2 = aeros[1] ? aeros[1].t : prowl.t - 2.1;
          pref(lines.length ? lines[lines.length - 1].t + 0.05 : kb2 - 5, pre);
          pref(kb2 + 0.05, spots);
          runs.add(prowl); if (winds) runs.add(winds);
          end((winds ? winds.t : prowl.t) + 0.3);
        } else end(t + 30);

      // ===== Tracking Tremors: eight stacks =====
      } else if (name === 'Tracking Tremors') {
        const hits = after(i, e => /^Tracking Tremors \d/.test(e.name), 12), cs = castOf(ev, 5), on = pick(S.filter(s => !TANKS.includes(s)));
        hits.forEach((e, k) => { runs.add(e); stack(e.t, [on], 6, 8, 'Tracking Tremors', { tell: k ? hits[k - 1].t : cs, dmg: 0.06 }); });
        pref(begin(cs), STACK);
        call(cs, `Stack x8 on ${on}`, { alert: true, dur: 9 });
        end((hits.length ? hits[hits.length - 1].t : t + 8) + 0.3);

      // ===== Great Divide: the tanks share a line =====
      } else if (name === 'Great Divide') {
        const cs = castOf(ev, 5);
        pref(begin(cs), { MT: [-0.5, 6], OT: [0.5, 6] });
        hz({ t, tell: cs + 1, effect: 'share', shape: 'line', from: 'boss', aim: 'target', targets: ['MT'], len: 60, w: 6, min: 2, max: 2, dmg: 0.5, name });
        call(cs, 'Shared tank line', { dur: 5 });
        for (const s of TANKS) call(cs, 'Tank line on you: share it with the other tank', { slot: s, alert: true, dur: 5 });
        end(t + 0.3);

      // ===== Terrestrial Titans =====
      } else if (name === 'Terrestrial Titans') {
        const cs = castOf(ev, 4), ew = Math.random() < 0.5;
        const pil = ew ? [[-7, 0], [7, 0]] : [[0, 7], [0, -7]];
        const pillars = pil.map(p => ({ shape: 'circle', at: p, r: 5 }));
        pillars.forEach(s => hz(Object.assign({ t, tell: cs, dmg: 1.3, name }, s)));
        // The pillars fall as 10-wide lines, one each way along a diagonal; then two Fanged Crossings, on the other
        // axis 8 out, one a plus and one an X: of the two intercards the lines miss, the X's side is safe.
        const fall = next(i, e => e.name === 'Towerfall', 20), d = pick([45, 315]);
        const fangs = ew ? [[0, 8], [0, -8]] : [[8, 0], [-8, 0]], xi = pick([0, 1]), xf = fangs[xi], pf = fangs[1 - xi];
        const lands = [line(pil[0], d, 30, 10), line(pil[1], d + 180, 30, 10),
          { shape: 'cross', at: xf, deg: 45, len: 21, w: 7 }, { shape: 'cross', at: pf, deg: 0, len: 21, w: 7 }];
        const tf = fall ? fall.t : t + 15;
        lands.forEach(s => hz(Object.assign({ t: tf, tell: tf - 7, dmg: 1.4, name: s.shape === 'cross' ? 'Fanged Crossing' : 'Towerfall' }, s)));
        if (fall) runs.add(fall);
        const safeDeg = [d + 90, d - 90].find(b => { const u = at(b, 1); return u[0] * xf[0] + u[1] * xf[1] > 0; });
        // Out of the pillars' way meanwhile (each spot's nearest ground clear of them), then the safe corner.
        pref(begin(cs), all(s => clump(pillars, UP[s], 1, onP1)[0]));
        pref(tf - 6.4, assign(S, clump(lands, at(safeDeg, 10.8), 8, onP1, { gap: 0.45 })));
        call(cs, 'Pillars: keep clear', { dur: 4 });
        call(tf - 6.4, `Safe: ${dirName(safeDeg)}`, { alert: true, dur: 6 });
        end(tf + 0.3);

      // ===== Tactical Pack: the wolves =====
      } else if (name === 'Tactical Pack') {
        const tEnd = 242;
        hz({ t: t + 6, tell: t + 2, shape: 'circle', at: [0, 0], r: 8, dmg: 0.9, lasts: tEnd - t - 6, tick: 2, tickDmg: 0.9, react: 1, name: 'Tactical Pack (the floor gives way)' });
        // The Wolf of Wind on one side, the Wolf of Stone on the other, each light party on one; the tank faces its
        // wolf north, the rest stand south of it, and Pack Predation's line goes out from the wolf at its target.
        const windE = Math.random() < 0.5, g1E = Math.random() < 0.5;
        const sides = { E: g1E ? G1 : G2, W: g1E ? G2 : G1 };
        const homeSpots = {}, wolves = {}, tankOf = {};
        for (const [k, grp] of Object.entries(sides)) {
          const x = k === 'E' ? 1 : -1, others = grp.filter(s => !TANKS.includes(s));
          wolves[k] = [9.8 * x, 0];
          tankOf[k] = grp.find(s => TANKS.includes(s));
          homeSpots[tankOf[k]] = [9.3 * x, 3.6];
          [[9.2, -4.2], [10.4, -4.6], [8.6, -5.6]].forEach((p, j) => { homeSpots[others[j]] = [p[0] * x, p[1]]; });
          const pack = (k === 'E') === windE ? 'stonepack' : 'windpack';
          for (const s of grp) {
            debuff(s, pack, pack === 'stonepack' ? 'Stonepack' : 'Windpack', `hit the wolf of ${pack === 'stonepack' ? 'wind' : 'stone'} (${k === 'E' ? 'east' : 'west'})`, t + 2, tEnd);
            call(t + 2, `${pack === 'stonepack' ? 'Wind' : 'Stone'} wolf: ${k === 'E' ? 'east' : 'west'} side`, { slot: s, alert: true, dur: 5 });
          }
        }
        pref(begin(t + 0.1), homeSpots);
        // Pack Predation x3: one bait each side each time (all six non-tanks once), the tanks take the cones.
        const preds = after(i, e => e.name === 'Pack Predation', 60);
        const order = { E: shuffle(sides.E.filter(s => !TANKS.includes(s))), W: shuffle(sides.W.filter(s => !TANKS.includes(s))) };
        preds.forEach((e, k) => {
          runs.add(e);
          const baits = {};
          for (const side of ['E', 'W']) {
            const b = order[side][k % 3], x = side === 'E' ? 1 : -1;
            baits[b] = [11.6 * x, 0];
            hz({ t: e.t, tell: e.t - 5, effect: 'bait', shape: 'line', from: wolves[side], aim: 'target', targets: [b], len: 40, w: 6, dmg: 1.2, own: 0.3, name: 'Pack Predation' });
            hz({ t: e.t, tell: e.t - 5, effect: 'bait', shape: 'cone', from: wolves[side], aim: 'target', targets: [tankOf[side]], half: 30, r: 40, dmg: 1.2, own: 0.5, buster: true, name: side === 'E' === windE ? 'Alpha Wind' : 'Alpha Stone' });
            call(e.t - 5, 'Predation on YOU: bait the line out past your wolf', { slot: b, alert: true, dur: 5 });
          }
          pref(e.t - 3, baits);
          pref(e.t + 0.1, homeSpots);
        });
        // Earthborne / Windborne End: 21, 37 or 54 s; cleanse in your side's font of that element before it runs out.
        const timers = shuffle([1, 1, 1, 2, 2, 2, 3, 3]), cleanse = { 1: 206.2, 2: 221.2, 3: 238 };
        S.forEach((s, j) => {
          const earth = Math.random() < 0.5, side = sides.E.includes(s) ? 1 : -1, tc = cleanse[timers[j]];
          const font = at(side * (earth ? 40 : 140), 10.6);
          debuff(s, earth ? 'earthborneEnd' : 'windborneEnd', earth ? 'Earthborne End' : 'Windborne End', `cleanse in the ${earth ? 'earth' : 'wind'} font (${timers[j]})`, t + 11.3, tc);
          pref(tc - 2.7, { [s]: font });
          pref(tc + 0.05, { [s]: homeSpots[s] });
          check({ t: tc, kind: 'spotlight', slots: [s], lights: [font], r: 2, fail: 0.9, name: earth ? 'Earthborne End' : 'Windborne End' });
          call(tc - 3, `Cleanse in the ${earth ? 'earth' : 'wind'} font`, { slot: s, alert: true, dur: 3 });
        });
        end(tEnd + 0.5);
      } else if (name.startsWith('Forlorn ')) {
        P.labels.set(ev, `${name.replace(' (Enrage)', '')} (the adds' enrage)`);

      // ===== Terrestrial Rage =====
      } else if (name === 'Terrestrial Rage' && t < 420) {
        const R = pick([0, 90, 180, 270]), loc = (x, y) => add(at(R, y), at(R + 90, x));
        const charges = after(i, e => e.name === 'Fanged Charge', 12), marks = after(i, e => e.name === 'Heavensearth', 18);
        const chase = next(i, e => e.name === 'Shadowchase', 12), roar = next(i, e => e.name === 'Roaring Wind', 25);
        after(i, e => e.name === 'Suspended Stone' || e.name === 'Heavensearth' || e.name === 'Fanged Charge', 18).forEach(e => runs.add(e));
        // Fanged Charge: two lines 6 out either side of the middle (along the wall laser's axis), then two at 10.5.
        const lines1 = [-6, 6].map(x => line(loc(x, 15), R + 180, 30, 6)), lines2 = [-10.5, 10.5].map(x => line(loc(x, 15), R + 180, 30, 6));
        if (charges[0]) lines1.forEach(s => hz(Object.assign({ t: charges[0].t, tell: castOf(charges[0], 4), dmg: 1.3, name: 'Fanged Charge' }, s)));
        if (charges[1]) lines2.forEach(s => hz(Object.assign({ t: charges[1].t, tell: charges[0] ? charges[0].t : castOf(charges[1], 4), dmg: 1.3, name: 'Fanged Charge', react: 1.1 }, s)));
        const first = Math.random() < 0.5 ? SUP : DPS, second = first === SUP ? DPS : SUP;
        // The first stack and spreads: spreads in the outer lanes, the stack in the middle one a little back.
        const r1 = RAGE1[st.terrestrial] || RAGE1.toxic, where1 = { FL: loc(-10.3, 5), FR: loc(10.3, 5), BL: loc(-10.3, -5), BR: loc(10.3, -5) };
        const set1 = {}, in1 = {};
        for (const [k, pair] of Object.entries(r1)) {
          const s = pair.find(x => first.includes(x));
          set1[s] = where1[k];
          in1[s] = add(where1[k], at(R + 90, k[1] === 'L' ? 5.3 : -5.3));     // in from the outer lanes for the second lines
        }
        const st1 = clump(lines1, loc(0, -3), 4, onP1, { gap: 0.45 });
        Object.assign(set1, assign(second, st1)); Object.assign(in1, assign(second, st1));
        pref(begin(t + 0.3), set1);
        const on1 = pick(second), on2 = pick(first);
        if (marks[0]) {
          spreads(marks[0].t, first, 6, 'Suspended Stone');
          stack(marks[0].t, [on1], 6, 4, 'Heavensearth');
          pref(marks[0].t + 0.05, in1);
          for (const s of first) call(marks[0].t - 5, 'Spread => Stack', { slot: s, dur: 5 });
          for (const s of second) call(marks[0].t - 5, `Stack on ${on1} => Spread`, { slot: s, dur: 5 });
        }
        // Shadowchase: five shadows on a pentagon, each dashing through the middle; behind them is safe. Then Roaring
        // Wind from the other pentagon: everyone turns 36 degrees clockwise to be behind a head.
        const pentA = Math.random() < 0.5, verts = (pentA ? [180, 252, 324, 36, 108] : [0, 72, 144, 216, 288]), v0 = pentA ? 36 : 0;
        const shadows = verts.map(v => line(at(v, 7), v + 180, 40, 8)), heads = verts.map(v => line(at(v + 36, 7), v + 216, 40, 8));
        const tChase = (marks[1] ? marks[1].t : (chase ? chase.t + 6 : t + 15)) + 0.3, tRoar = roar ? roar.t : tChase + 4.6;
        shadows.forEach(s => hz(Object.assign({ t: tChase, tell: tChase - 3.5, dmg: 1.4, name: 'Shadowchase' }, s)));
        heads.forEach(s => hz(Object.assign({ t: tRoar, tell: tChase, dmg: 1.4, name: 'Roaring Wind' }, s)));
        const r2 = RAGE2[st.terrestrial] || RAGE2.toxic, set2 = {}, rel = {};
        for (const [d, pair] of Object.entries(r2)) {
          const s = pair.find(x => second.includes(x));
          rel[s] = +d;
          set2[s] = clump(shadows, at(v0 + +d, 10.5), 1, onP1)[0];
        }
        Object.assign(set2, assign(first, clump(shadows, at(v0, 10.5), 4, onP1, { gap: 0.45 })));
        const roarSpots = {};
        for (const s of second) roarSpots[s] = clump(heads, at(v0 + rel[s] + 36, 10.5), 1, onP1)[0];
        Object.assign(roarSpots, assign(first, clump(heads, at(v0 + 36, 10.5), 4, onP1, { gap: 0.45 })));
        pref(charges[1] ? charges[1].t + 0.05 : tChase - 5, set2);
        if (marks[1]) {
          spreads(marks[1].t, second, 6, 'Suspended Stone');
          stack(marks[1].t, [on2], 6, 4, 'Heavensearth');
          for (const s of second) call(marks[1].t - 5, 'Spread (behind clones)', { slot: s, dur: 5 });
          for (const s of first) call(marks[1].t - 5, `Stack on ${on2} (behind clones)`, { slot: s, dur: 5 });
        }
        pref(tChase + 0.05, roarSpots);
        call(tChase + 0.05, 'Rotate', { alert: true, dur: 3 });
        if (roar) runs.add(roar);
        end(tRoar + 0.3);

      // ===== Beckon Moonlight =====
      } else if (name === 'Beckon Moonlight') {
        const bites = after(i, e => /^Moonbeam's Bite \d/.test(e.name), 25), marks = after(i, e => e.name === 'Heavensearth', 25);
        after(i, e => /^Moonbeam's Bite/.test(e.name) || e.name === 'Heavensearth' || e.name === 'Suspended Stone' || e.name === 'Terrestrial Rage', 25).forEach(e => runs.add(e));
        // Two cleaves leave a quadrant (Q1), the next two the one beside it (Q2). A quadrant's frame: a along the
        // cardinal to its left (looking out), b along the one to its right.
        const frame = (q) => { const ua = at(q - 45, 1), ub = at(q + 45, 1); return { q, ua, ub, pt: (a, b) => add(mul(ua, a), mul(ub, b)) }; };
        const Q1 = frame(pick([45, 135, 225, 315])), Q2 = frame(deg360(Q1.q + pick([90, -90])));
        const halves = (Q) => shuffle([{ shape: 'half', dir: mul(Q.ua, -1) }, { shape: 'half', dir: mul(Q.ub, -1) }]);
        const cl = halves(Q1).concat(halves(Q2)), bt = (k) => (bites[k] ? bites[k].t : t + 14 + 2 * k);
        cl.forEach((h, k) => hz(Object.assign({ t: bt(k), tell: k ? bt(k - 1) : bt(0) - 5, dmg: 1.4, name: "Moonbeam's Bite", react: 1.2 }, h)));
        const dot = (u, v) => u[0] * v[0] + u[1] * v[1];
        const tCross = bt(dot(cl[0].dir, at(Q2.q, 1)) > 0 ? 0 : 1) + 0.05;
        const first = Math.random() < 0.5 ? SUP : DPS, second = first === SUP ? DPS : SUP;
        // Each set's spots: Quad: spreads close and far along both edges (G1 on the left facing him), the stack on
        // the intercard; Toxic: three spreads on the markers, the stack near him, OT or R1 spreading next door. Quad's
        // spreads stand right on the quadrant's edges (6-yalm spreads only just fit), so till the cleaves on them are
        // done they hold a step inside (`hold`).
        const layout = (Q, spread, flexQ, hs) => {
          const out = {}, stackers = S.filter(s => !spread.includes(s));
          if (st.moonlight === 'toxic') {
            const flex = spread.includes('OT') ? 'OT' : 'R1';
            const left = spread.find(s => s === 'H2' || s === 'M2'), mid = spread.find(s => s === 'H1' || s === 'M1'), right = spread.find(s => s === 'MT' || s === 'R2');
            out[left] = Q.pt(1.3, 9.6); out[mid] = Q.pt(7.4, 7.4); out[right] = Q.pt(9.6, 1.3);
            out[flex] = at(flexQ, 10.3);
            Object.assign(out, assign(stackers, clump(hs, Q.pt(2, 2), 4, onP1, { gap: 0.4 })));
            return { spots: out, hold: out, flex };
          }
          const close = (g) => spread.find(s => g.includes(s) && (TANKS.includes(s) || s[0] === 'M')), far = (g) => spread.find(s => g.includes(s) && !(TANKS.includes(s) || s[0] === 'M'));
          const ab = { [close(G1)]: [0, 4.8], [far(G1)]: [0, 11.35], [close(G2)]: [4.8, 0], [far(G2)]: [11.35, 0] }, hold = {};
          for (const [s, [a, b]] of Object.entries(ab)) {
            out[s] = Q.pt(a, b);
            hold[s] = Q.pt(Math.max(a, 1.4), Math.max(b, 1.4));
            if (Math.hypot(...hold[s]) > 11.2) hold[s] = mul(hold[s], 11.2 / Math.hypot(...hold[s]));
          }
          Object.assign(out, assign(stackers, clump(hs, Q.pt(7.9, 7.9), 4, onP1, { gap: 0.4 })));
          for (const s of stackers) hold[s] = out[s];
          return { spots: out, hold };
        };
        // Toxic's flex quadrants: beside Q1, safe from the first cleave (back in before the second); beside Q2 on the
        // third cleave's side (safe once it's gone).
        const besideIn = (Q, h) => [Q.q + 90, Q.q - 90].map(deg360).find(q => dot(h.dir, at(q, 1)) > 0);
        const L1 = layout(Q1, first, besideIn(Q1, cl[1]), [cl[0], cl[1]]), L2 = layout(Q2, second, besideIn(Q2, cl[2]), [cl[2], cl[3]]);
        const rest1 = all(s => clump([], Q1.pt(3.5, 3.5), 8, onP1, { gap: 0.5 })[S.indexOf(s)]);
        pref(begin(t + 3), rest1);
        pref(t + 7.8, L1.spots);
        const m1 = marks[0] ? marks[0].t : bt(0) - 1.4, m2 = marks[1] ? marks[1].t : bt(3) + 1;
        const st1 = pick(S.filter(s => !first.includes(s))), st2 = pick(S.filter(s => !second.includes(s)));
        spreads(m1, first, 6, 'Suspended Stone');
        stack(m1, [st1], 6, 4, 'Heavensearth');
        // Then everyone gathers on Q1's side by Q2, to step across once it's safe.
        const shared = dot(Q1.ua, at(Q2.q, 1)) > 0 ? Q1.ua : Q1.ub;
        pref(m1 + 0.05, assign(S, clump([cl[0], cl[1]], add(mul(shared, 6.5), at(Q1.q, 1.8)), 8, onP1, { gap: 0.5 })));
        const w2 = Object.assign({}, L2.hold);
        if (L2.flex) w2[L2.flex] = Q2.pt(4.5, 4.5);
        pref(tCross, w2);
        if (L2.flex) pref(bt(2) + 0.05, { [L2.flex]: L2.spots[L2.flex] });
        else pref(bt(3) + 0.05, L2.spots);
        spreads(m2, second, 6, 'Suspended Stone');
        stack(m2, [st2], 6, 4, 'Heavensearth');
        call(t + 3, `Quadrants: ${dirName(Q1.q)} => ${dirName(Q2.q)}`, { alert: true, dur: 8 });
        for (const s of first) call(m1 - 5, 'Spread => Stack', { slot: s, dur: 5 });
        for (const s of second) call(m1 - 5, `Stack on ${st1} => Spread`, { slot: s, dur: 5 });
        end(m2 + 0.3);

      // ===== the end of phase 1 =====
      } else if (name === 'Extraplanar Feast (Enrage)') {
        P.labels.set(ev, 'Extraplanar Feast (phase 1\'s enrage: push phase 1 before it)');

      // ===== phase 2: Quake III, light parties by platform =====
      } else if (name === 'Quake III') {
        if (!p2) { p2 = true; pref(Math.max(hold + 0.05, 606), SOUTH); hold = 606; }
        const cs = castOf(ev, 5);
        pref(begin(cs), P2UP);
        stack(t, ['H1', 'H2'], 7.5, 4, name, { tell: cs });
        call(cs, 'Light party platforms: G1 south-west, G2 south-east', { alert: true, dur: 5 });
        end(t + 0.3);

      // ===== Ultraviolent Ray: five baits, one to a platform; Gleaming Beam on half of each =====
      } else if (/^Ultraviolent Ray \d/.test(name)) {
        const n = +name.slice(-1), cs = castOf(ev, 6), beam = next(i, e => e.name === 'Gleaming Beam', 1);
        if (beam) runs.add(beam);
        // One group baits three, the other two; each group's baits in their conga order (tank, healer, ranged,
        // melee): the first goes north, the second stays, the third south. Rinon's fourth: tanks and melee from the
        // north-west platform, healers and ranged from the south (supports first, the second east, the third west).
        const rinon = n === 4 && st.uv4 === 'rinon';
        const groups = rinon ? [['MT', 'OT', 'M1', 'M2'], ['H1', 'H2', 'R1', 'R2']] : [['MT', 'H1', 'R1', 'M1'], ['OT', 'H2', 'R2', 'M2']];
        const homes = rinon ? ['NW', 'S'] : ['SW', 'SE'], dests = rinon ? [['NW', 'NE', 'SW'], ['S', 'SE', 'SW']] : [['NW', 'SW', 'S'], ['NE', 'SE', 'S']];
        const three = pick([0, 1]), baits = [];
        groups.forEach((g, k) => baits.push(...shuffle(g).slice(0, k === three ? 3 : 2).sort((a, b) => g.indexOf(a) - g.indexOf(b))));
        const platOfSlot = {};
        groups.forEach((g, k) => {
          const mine = baits.filter(s => g.includes(s));
          g.forEach(s => { platOfSlot[s] = mine.includes(s) ? dests[k][mine.indexOf(s)] : homes[k]; });
        });
        // The beams: each platform's left or right half (8 wide, from the outer edge in).
        const side = Object.fromEntries(PLATS.map(k => [k, pick([1, -1])])), beams = {};
        for (const k of PLATS) {
          beams[k] = line(pl(k, 26.5, 4 * side[k]), PLAT[k] + 180, 31, 8);
          hz(Object.assign({ t, tell: t - 4, dmg: 1.3, name: 'Gleaming Beam' }, beams[k]));
        }
        const spots = {};
        for (const k of PLATS) {
          const here = S.filter(s => platOfSlot[s] === k);
          if (!here.length) continue;
          // (The bait first, in close to the platform's middle, so no two rays reach the same spot.)
          const pts = clump([beams[k]], pl(k, 17.5, -2.5 * side[k]), here.length, onPlat(k, 6.8), { gap: 0.6 });
          const order = here.filter(s => baits.includes(s)).concat(here.filter(s => !baits.includes(s)));
          Object.assign(spots, assign(order, pts));
        }
        // (Rinon's: from Hero's Blow in the south, the north group's leaps round to the far platforms take longer
        // walked than the six seconds the markers give, so everyone sets off for their platform as Hero's Blow ends.)
        if (rinon) pref(begin(hold + 0.05), spots);
        pref(begin(cs + 0.3), spots);
        // Each ray hits its target's platform: one to a platform (whoever else is there shares it).
        hz({ t: t + 0.05, tell: cs, effect: 'share', shape: 'circle', from: 'target', targets: baits, r: 7, min: 1, max: 4, dmg: 0.3, name: 'Ultraviolent Ray' });
        for (const s of baits) call(cs, `UV Ray on YOU: ${platOfSlot[s]} platform`, { slot: s, alert: true, dur: 6 });
        for (const s of S) call(t - 3.5, side[platOfSlot[s]] > 0 ? 'Right' : 'Left', { slot: s, dur: 3 });
        end(t + 0.3);

      // ===== Twinbite: a platform-wide buster on each tank; everyone else south =====
      } else if (name === 'Twinbite') {
        const cs = castOf(ev, 7), spots = Object.assign({}, SOUTH, { MT: plat('SW'), OT: plat('SE') });
        pref(begin(cs), spots);
        hz({ t: t + 0.1, tell: cs, effect: 'bait', shape: 'circle', from: 'target', targets: TANKS, r: 8, dmg: 1.2, own: 0.5, buster: true, name });
        call(cs, 'Tank busters: tanks to their platforms, party south', { dur: 5 });
        end(t + 0.3);

      // ===== Hero's Blow: half the room and in or out, on the south platform =====
      } else if (name === "Hero's Blow") {
        const cs = castOf(ev, 7), east = Math.random() < 0.5, inn = Math.random() < 0.5;
        P.labels.set(ev, `Hero's Blow (${east ? 'east' : 'west'} safe, ${inn ? 'in' : 'out'})`);
        const shapes = [{ shape: 'cone', at: [0, 0], deg: east ? 270 : 90, half: 90, r: 40 },
          inn ? { shape: 'donut', at: [0, 0], r0: 15, r1: 30 } : { shape: 'circle', at: [0, 0], r: 22 }];
        shapes.forEach(s => hz(Object.assign({ t, tell: cs, dmg: 1.4, name: s.shape === 'cone' ? name : inn ? 'Fanged Perimeter' : 'Fanged Maw' }, s)));
        const x = east ? 3.5 : -3.5, spots = assign(S, clump(shapes, inn ? [x, -12.3] : [x, -23.6], 8, onPlat('S', 7.3), { gap: 0.6 }));
        pref(begin(cs + 0.3), spots);
        call(cs + 0.3, `${inn ? 'In' : 'Out'} + ${east ? 'East' : 'West'} (south platform)`, { alert: true, dur: 6 });
        end(t + 0.3);

      // ===== Mooncleaver: the south platform goes; Elemental Purge =====
      } else if (name === 'Mooncleaver') {
        const hit = next(i, e => e.name === 'Mooncleaver (Platform)', 8), purge = next(i, e => e.name === 'Elemental Purge', 16);
        const blasts = after(i, e => e.name === 'Geotemporal Blast' || e.name === 'Aerotemporal Blast' || e.name === "Hunter's Harvest", 20);
        if (hit) runs.add(hit); blasts.forEach(e => runs.add(e));
        const th = hit ? hit.t : t + 5;
        // Baited south, then off it: the tanks to their platforms, the light parties north.
        const away = Object.assign({}, { MT: pl('SW', 17.5, 0), OT: pl('SE', 17.5, 0) },
          assign(['H1', 'M1', 'R1'], clump([], pl('NW', 18, -2), 3, onPlat('NW'), { gap: 0.6 })), assign(['H2', 'M2', 'R2'], clump([], pl('NE', 18, 2), 3, onPlat('NE'), { gap: 0.6 })));
        pref(begin(castOf(ev, 4)), SOUTH);
        pref(t + 0.1, away);
        hz({ t: th, tell: t, shape: 'circle', at: plat('S'), r: 8, dmg: 1.5, name: 'Mooncleaver' });
        drops.push({ k: 'S', from: th + 0.5, to: null });           // back once Twofold Tempest is done
        call(castOf(ev, 4), 'Bait Mooncleaver south, then change platform', { alert: true, dur: 6 });
        if (purge && blasts.length) {
          // A 16-yalm spread on one tank (bound where they stand), a stack on a non-tank, and a 200-degree cone at the
          // other tank: the stack goes to the platform beside the marked tank, away from the other.
          const tb = blasts[0].t, T = pick(TANKS), U = T === 'MT' ? 'OT' : 'MT', tp = T === 'MT' ? 'SW' : 'SE', sp = T === 'MT' ? 'NW' : 'NE', up = U === 'MT' ? 'SW' : 'SE';
          const X = pick(S.filter(s => !TANKS.includes(s))), party = S.filter(s => !TANKS.includes(s));
          const away2 = unit([plat(sp)[0] - plat(tp)[0], plat(sp)[1] - plat(tp)[1]]);
          const spots = Object.assign({ [T]: add(plat(tp), mul(away2, -4)), [U]: plat(up) }, assign(party, clump([], add(plat(sp), mul(away2, 3.5)), 6, onPlat(sp), { gap: 0.6 })));
          pref(castOf(purge, 5) + 0.1, spots);
          debuff(T, 'bind', 'Bind', 'stay put', purge.t, tb);
          spreads(tb, [T], 16, 'Aerotemporal Blast', { own: 0.4, tell: castOf(purge, 5) });
          stack(tb, [X], 6, 6, 'Geotemporal Blast', { tell: castOf(purge, 5) });
          hz({ t: tb + 0.05, tell: tb - 3, effect: 'bait', shape: 'cone', from: 'boss', aim: 'target', targets: [U], half: 100, r: 40, dmg: 1.4, own: 0.45, buster: true, name: "Hunter's Harvest" });
          call(castOf(purge, 5), `Elemental Purge on ${T} and ${X}`, { dur: 6 });
          call(castOf(purge, 5), `Stack on ${X}: ${sp} platform`, { alert: true, dur: 6 });
          call(castOf(purge, 5), 'Marked: spread far, the other tank provokes', { slot: T, alert: true, dur: 6 });
          call(castOf(purge, 5), 'Provoke: take the cleave on your platform', { slot: U, alert: true, dur: 6 });
          end(tb + 0.3);
        } else end(th + 0.3);

      // ===== Prowling Gale (phase 2): two-player towers =====
      } else if (name === 'Prowling Gale (Towers)' && t > 700 && t < 800) {
        const pairs = TWOFOLD[st.twofold] || TWOFOLD.casterse, spots = {};
        for (const [k, pair] of Object.entries(pairs)) {
          spots[pair[0]] = pl(k, 17.5, 0.4); spots[pair[1]] = pl(k, 17.5, -0.4);
          hz({ t, tell: t - 8, effect: 'tower', shape: 'circle', at: plat(k), r: 2, soak: 2, dmg: 0.3, fail: 0.9, name: 'Prowling Gale' });
        }
        pref(begin(t - 8), spots);
        call(t - 8, 'Towers: your pair\'s platform', { alert: true, dur: 6 });
        end(t + 0.3);

      // ===== Twofold Tempest =====
      } else if (name === 'Twofold Tempest') {
        const rounds = [ev].concat(after(i, e => e.name === 'Twofold Tempest', 25)).slice(0, 4), surges = after(i, e => e.name === 'Wind Surge', 30);
        rounds.forEach(e => runs.add(e)); surges.forEach(e => runs.add(e));
        const homes = TWOFOLD[st.twofold] || TWOFOLD.casterse, startW = Math.random() < 0.5;
        const order = startW ? ['SW', 'NW', 'NE', 'SE'] : ['SE', 'NE', 'NW', 'SW'];
        const stackAt = (k) => pl(k, 23, 0), puddles = [];
        rounds.forEach((e, k) => {
          // The tether's pair stacks far out on its platform; the pair whose platform the line goes to (the nearest the
          // boss) shares it from close in; the others wait on theirs, clear of any puddle.
          const T = order[k], L = TWOFOLD_LINE[T], live = puddles.filter(p => p.t1 > e.t - 0.5 && p.t0 < e.t + 7).map(p => p.shape);
          const spots = {};
          for (const [h, pair] of Object.entries(homes)) {
            if (h === T) Object.assign(spots, assign(pair, [pl(h, 23, 0.4), pl(h, 23, -0.4)]));
            else if (h === L) Object.assign(spots, assign(pair, [pl(h, 10.4, 1), pl(h, 10.4, -1)]));
            else Object.assign(spots, assign(pair, clump(live, pl(h, 12.6, 0), 2, onPlat(h, 6.5), { gap: 0.8 })));
          }
          pref(k ? rounds[k - 1].t + 0.05 : begin(e.t - 6.5), spots);
          const holder = homes[T].find(s => DPS.includes(s));
          stack(e.t, [holder], 6, 2, 'Twofold Tempest', { tell: k ? rounds[k - 1].t : e.t - 6.5, tether: 'boss' });
          hz({ t: e.t, tell: e.t - 4, effect: 'share', shape: 'line', from: 'boss', aim: 'target', targets: { nearest: 1 }, len: 35.5, w: 16, min: 2, max: 2, dmg: 0.35, name: 'Twofold Tempest (line)' });
          for (const s of homes[T]) call(e.t - 5, `Tether stack: far out on ${T}`, { slot: s, alert: true, dur: 5 });
          for (const s of homes[L]) call(e.t - 5, `Bait the line: in close on ${L}`, { slot: s, alert: true, dur: 5 });
          // Its puddle: 9 yalms where they stacked, for 11.7 s from the Wind Surge.
          const sg = surges[k], t0 = sg ? sg.t : e.t + 3.7, shape = { shape: 'circle', at: stackAt(T), r: 9 };
          puddles.push({ t0, t1: t0 + 11.7, shape });
          hz(Object.assign({ t: t0 + 0.5, tell: t0, dmg: 0.9, lasts: 11.2, tick: 2, tickDmg: 0.9, react: 1, name: 'Wind Surge' }, shape));
        });
        call(rounds[0].t - 7, `Tether starts ${startW ? 'south-west' : 'south-east'}`, { dur: 5 });
        // The south platform comes back after; everyone home, clear of the puddles still there.
        const tLast = rounds[rounds.length - 1].t, still = puddles.filter(p => p.t1 > tLast).map(p => p.shape);
        drops.forEach(d => { if (d.k === 'S' && d.to === null) d.to = tLast + 5.9; });
        end(tLast + 0.3, all(s => clump(still, P2UP[s], 1, onPlat(P2UP[s][0] < 0 ? 'SW' : 'SE', 6.8))[0]));

      // ===== Champion's Circuit =====
      } else if (name === "Champion's Circuit") {
        const steps = [ev].concat(after(i, e => e.name === "Champion's Circuit", 22)).slice(0, 5), barrages = events.filter(e => e.name === 'Gleaming Barrage' && e.t > t - 1 && e.t < t + 20);
        steps.forEach(e => runs.add(e));
        const dir = pick([1, -1]), cs = castOf(ev, 7.3);
        P.labels.set(ev, `Champion's Circuit (${dir > 0 ? 'clockwise' : 'counterclockwise'})`);
        // The five shapes, one on each platform (south: the 12-wide line; south-west and north-east: donut sectors;
        // north-west: the cone; south-east: the small donut), turning a platform each time; the party on the south.
        const baseShapes = ['sides', 'in', 'out', 'in', 'donut'];
        const shapeOn = (p, k) => baseShapes[(((PLATS.indexOf(p) - dir * k) % 5) + 5) % 5];
        const SH = (kind, p) => ({
          sides: line([0, 0], PLAT[p], 30, 12),
          in: { shape: 'cone', at: [0, 0], deg: PLAT[p], half: 30, r0: 15.85, r: 28 },
          out: { shape: 'cone', at: [0, 0], deg: PLAT[p], half: 30, r: 22 },
          donut: { shape: 'donut', at: plat(p), r0: 4, r1: 13 },
        }[kind]);
        const WANT = { sides: 7.3, in: 3, out: 3, donut: 2 }, Y = { sides: -17.5, in: -12.6, out: -24, donut: -17.5 };
        const seq = [];
        steps.forEach((e, k) => {
          const b = barrages.find(x => Math.abs(x.t - (e.t - 0.6)) < 0.8) || null, step = [];
          seq.push(shapeOn('S', k));
          for (const p of PLATS) {
            const s = SH(shapeOn(p, k), p);
            step.push(s);
            hz(Object.assign({ t: e.t, tell: k ? steps[k - 1].t : cs, dmg: 1.4, name: "Champion's Circuit" }, s));
          }
          let side = 1;
          if (b) {
            runs.add(b);
            for (const p of PLATS) {
              const sd = pick([1, -1]), bar = line(pl(p, 26.5, 4 * sd), PLAT[p] + 180, 31, 8);
              if (p === 'S') side = sd;
              step.push(bar);
              hz(Object.assign({ t: b.t, tell: b.t - 2.8, dmg: 1.3, name: 'Gleaming Barrage' }, bar));
            }
          }
          // (A beam on the left half, from the south platform facing him, is the west half: lateral + is west.)
          const kind = shapeOn('S', k), spots = assign(S, clump(step, [WANT[kind] * side, Y[kind]], 8, onPlat('S', 7.6), { gap: 0.45, m: 1.2 }));
          pref(k ? steps[k - 1].t + 0.05 : begin(cs), spots);
        });
        call(cs, `(${dir > 0 ? 'Clockwise' : 'Counterclockwise'}) ${seq.join(' => ')}`, { alert: true, dur: 10 });
        end(steps[steps.length - 1].t + 0.3);

      // ===== Lone Wolf's Lament =====
      } else if (name === "Lone Wolf's Lament") {
        const towersEv = next(i, e => e.name === 'Prowling Gale (Towers)', 25), tt = towersEv ? towersEv.t : t + 18.7;
        if (towersEv) runs.add(towersEv);
        // Each support tethered to a DPS: a tank and a healer close (green), the others far (blue).
        const closeT = pick(TANKS), farT = closeT === 'MT' ? 'OT' : 'MT', closeH = pick(['H1', 'H2']), farH = closeH === 'H1' ? 'H2' : 'H1';
        const [dCT, dFT, dCH, dFH] = shuffle(DPS);
        const north2 = pick(['NW', 'NE']), north1 = north2 === 'NW' ? 'NE' : 'NW';
        // The towers: three south (the healers and the close healer's partner), two north (the close tank's pair),
        // one each west (the far tank), east (its partner) and north (the far healer's partner). Toxic and Rinon take
        // the same towers (BossMod's Rinon hints) from the same starts; they differ only in the route there.
        const tw = { S: [farH, closeH, dCH], [north2]: [closeT, dCT], SW: [farT], SE: [dFT], [north1]: [dFH] };
        const spots = {};
        for (const [k, g] of Object.entries(tw)) {
          Object.assign(spots, assign(g, clump([], plat(k), g.length, onPlat(k), { gap: 0.5 })));
          hz({ t: tt, tell: tt - 8, effect: 'tower', shape: 'circle', at: plat(k), r: 2, soak: g.length, dmg: 0.35, fail: 0.9, name: 'Prowling Gale' });
        }
        const start = Object.assign({}, assign(TANKS, [pl('NW', 15, 0.8), pl('NW', 15, -0.8)]), assign(['H1', 'H2'], [pl('S', 15, 0.8), pl('S', 15, -0.8)]),
          assign(DPS, clump([], pl('SE', 15, 0), 4, onPlat('SE'), { gap: 0.6 })));
        pref(begin(castOf(ev, 3)), start);
        pref(t + 3.8, spots);
        for (const [a, b, close] of [[closeT, dCT, true], [farT, dFT, false], [closeH, dCH, true], [farH, dFH, false]]) {
          // The tether: close ones within 8 of each other as the towers go off, far ones at least 15 apart.
          hz({ t: tt, tell: t + 3.7, targets: [a], tether: b, within: close ? 8 : undefined, stretch: close ? undefined : 15, dmg: 0, fail: 0.9, name: close ? 'Lament of the Close' : 'Lament of the Distant' });
          for (const [s, o] of [[a, b], [b, a]]) {
            debuff(s, close ? 'lamentClose' : 'lamentDistant', close ? 'Lament of the Close' : 'Lament of the Distant', `stay ${close ? 'close to' : 'far from'} ${o}`, t + 3.7, tt);
            call(t + 3.7, `${close ? 'Close' : 'Far'} tether on YOU: tower ${Object.keys(tw).find(k => tw[k].includes(s))}`, { slot: s, alert: true, dur: 6 });
          }
        }
        end(tt + 0.05, SOUTH);              // straight on south for Hero's Blow

      // ===== Howling Eight: five towers, a platform lost after each =====
      } else if (name === 'Howling Eight') {
        // All five at once (the first one's handler): the towers go clockwise from the south (Toxic: party stack,
        // MT invuln, the tanks share, OT invuln, party stack); whoever isn't soaking waits on the next platform, and
        // each platform is destroyed once its eight hits are done.
        const eights = [ev].concat(after(i, e => e.name === 'Howling Eight', 100)).slice(0, 5);
        const seq = ['S', 'SW', 'NW', 'NE', 'SE'], soakSets = [S, ['MT'], TANKS, ['OT'], S];
        const info = eights.map((e, k) => {
          runs.add(e);
          const j = events.indexOf(e), hits = after(j, x => /^Howling Eight \d/.test(x.name), 9), cleaver = next(j, x => x.name === 'Mooncleaver (Platform)', 16);
          hits.forEach(x => runs.add(x)); if (cleaver) runs.add(cleaver);
          const here = seq[k], there = seq[k + 1], soak = soakSets[k], rest = S.filter(s => !soak.includes(s));
          const spots = Object.assign(assign(soak, clump([], plat(here), soak.length, onPlat(here, 4), { gap: 0.5 })),
            there ? assign(rest, clump([], plat(there), rest.length, onPlat(there, 5), { gap: 0.5 })) : {});
          return { e, hits, cleaver: k < 4 ? cleaver : null, here, soak, rest, spots, last: hits.length ? hits[hits.length - 1].t : e.t + 7 };
        });
        info.forEach((h, k) => {
          pref(k ? info[k - 1].last + 0.05 : begin(castOf(h.e, 8)), h.spots);
          h.hits.forEach((x, n) => hz({ t: x.t, tell: n ? h.hits[n - 1].t : castOf(h.e, 5), effect: 'tower', shape: 'circle', at: plat(h.here), r: 8, soak: [1, 8], dmg: 0.07, fail: 0.9, name: 'Howling Eight' }));
          const what = k === 0 || k === 4 ? 'party stack' : k === 2 ? 'the tanks share' : `${h.soak[0]} invuln`;
          call(castOf(h.e, 5), `Howling Eight on ${h.here}: ${what}`, { alert: true, dur: 8 });
          if (h.cleaver) {
            hz({ t: h.cleaver.t, tell: h.cleaver.t - 4, shape: 'circle', at: plat(h.here), r: 8, dmg: 1.5, name: 'Mooncleaver' });
            drops.push({ k: h.here, from: h.cleaver.t + 0.5, to: Infinity });
            call(h.cleaver.t - 4, 'Change platform', { alert: true, dur: 4 });
          }
        });
        hold = info[info.length - 1].last + 0.05;
      }
    });

    // The floor: phase 1's round arena; in the transition that and the platforms; then the platforms alone (off
    // them is a fall), losing the ones Mooncleaver destroys.
    P.arena = [{ t: 0, shape: 'circle', at: [0, 0], r: 12 },
      { t: 605, parts: [{ shape: 'circle', at: [0, 0], r: 12 }, ...P2_FLOOR(new Set())] }];
    const changes = [...new Set([627.9, ...drops.flatMap(d => [d.from, d.to]).filter(x => x !== null && isFinite(x))])].sort((a, b) => a - b);
    for (const c of changes) {
      const gone = new Set(drops.filter(d => d.from <= c && (d.to === null || c < d.to)).map(d => d.k));
      P.arena.push({ t: c, parts: P2_FLOOR(gone), deathwall: true });
    }
    addRoutes(P);
    return P;
  }

  B.FIGHT_SCRIPTS = B.FIGHT_SCRIPTS || {};
  B.FIGHT_SCRIPTS.m8s = {
    // FFLogs' max HP in an M8S kill: Howling Blade 67,582,753 in phase 1 and 72,751,588 in phase 2; the two wolves of
    // Tactical Pack 10,518,438 each, soaking the party's damage while they're up.
    hp: 140334341,
    adds: [{ from: 179.7, to: 248.1, hp: 21036876, share: 1, name: 'Wolf of Wind and Wolf of Stone' }],
    // Phase 1 ends when its HP runs out (straight to the transition, past its enrage); the wolves dead, he's back.
    pushes: [
      { from: 0, to: 605, dealt: 67582753, name: 'Phase 1 done' },
      { from: 179.7, to: 343.8, adds: 0, name: 'The wolves are down' },
    ],
    defaultStrat: 'toxic',
    strats: {
      toxic: { label: 'Toxic' },
      'pb-eQ': { label: 'Pastebin' },
      'pb-r': { label: 'Pastebin + Rinon (NA)' },
      '84ddog': { label: '84ddog (EU)' },
    },
    source: 'wtfdig.info/72/m8s; mechanics after BossMod (github.com/awgil/ffxiv_bossmod)',
    // Phase 1's: A north, B east, C south, D west, 1-4 at the intercards (1 north-west, then clockwise).
    waymarks: [
      { label: 'A', at: [0, 9], color: 'red' }, { label: 'B', at: [9, 0], color: 'yellow' },
      { label: 'C', at: [0, -9], color: 'blue' }, { label: 'D', at: [-9, 0], color: 'purple' },
      { label: '1', at: [-7.8, 7.8], color: 'red', square: true }, { label: '2', at: [7.8, 7.8], color: 'yellow', square: true },
      { label: '3', at: [7.8, -7.8], color: 'blue', square: true }, { label: '4', at: [-7.8, -7.8], color: 'purple', square: true },
    ],
    plan,
  };
})(window.BLM);
