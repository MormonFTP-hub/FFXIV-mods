// M8S, AAC Cruiserweight M4 (Savage): Howling Blade's mechanics for the sim's party, on cactbot's timeline, and the
// strats wtfdig.info lists for them: Toxic (the first it lists, and the one the others build on), Pastebin, Pastebin +
// Rinon (NA) and 84ddog (EU). wtfdig's strats are bundles of per-mechanic choices (its toggles): Millennial Decay
// (Fering or Toxic), Terrestrial Rage (Clock, Toxic, DN, Full or Half Rinon), Beckon Moonlight (Quad or Toxic),
// Twofold Tempest (Original or Caster SE), Lone Wolf's Lament and the fourth Ultraviolent Ray (Rinon or Toxic); each
// strat's spots come from those. Spots are [east, north] yalms from the arena's middle.
//
// The mechanics follow BossMod's module for the fight (github.com/awgil/ffxiv_bossmod, RM08SHowlingBlade), whose
// shapes and sizes come from the game's Action sheet:
//   Phase 1, a round arena of radius 12:
//   - Windfang / Stonefang: a cross (15 long, 6 wide) on the cardinals or intercardinals, and a donut from 8 (in, then
//     partner stacks) or a 9-yalm circle (out, then a 25-degree protean at everyone).
//   - Eminent / Revolutionary Reign: shadows' 6-yalm circles, his jump and 10-wide dash across the arena, then a
//     120-degree cone (in: get behind him) or a 14-yalm circle (out), with light-party cone stacks at the healers
//     (Sovereign Scar) and cones at the tanks (Reign's End).
//   - Millennial Decay: five 8-wide lines turning 45 degrees each, Gust spreads (5), Aero III knockbacks, then
//     one-player towers and tethered cones (Winds of Decay).
//   - Tracking Tremors: eight party stacks. Great Divide: a 6-wide line the tanks share.
//   - Terrestrial Titans: two pillars (5-yalm circles) that fall as 10-wide lines, and two Fanged Crossings (crosses 7
//     wide): one intercard left safe.
//   - Tactical Pack: the middle falls away (8 yalms) and two wolves are tanked at the edge; Pack Predation's 6-wide
//     lines at two players and cones at the tanks; Earthborne/Windborne End to cleanse in the matching font.
//   - Terrestrial Rage: Fanged Charge lines (6 wide), stack and spreads (6), Shadowchase's five 8-wide lines from a
//     pentagon of shadows (behind them is safe), then Roaring Wind's from the other pentagon.
//   - Beckon Moonlight: four half-room cleaves, two at a time leaving a quadrant; stack and spreads in it.
//   - Weal of Stone: 6-wide lines.
//   Phase 2, five platforms (radius 8, 17.5 out from the middle: S, SW, NW, NE, SE), the boss in the middle:
//   - Quake III: light parties stack by platform. Ultraviolent Ray: five baits, one to a platform, while Gleaming
//     Beams (8 wide) sweep one half of each. Twinbite: the tanks alone on their platforms. Hero's Blow: half the room
//     and in (a 15-30 donut) or out (a 22-yalm circle).
//   - Mooncleaver destroys the south platform for a while; Elemental Purge: a 16-yalm spread on a tank, a 6-yalm
//     stack, and a 200-degree cone at the other tank. Prowling Gale: two-player towers.
//   - Twofold Tempest: four rounds of a tethered pair stacking far (leaving a 9-yalm puddle) while another pair baits
//     the line at their platform from close in.
//   - Champion's Circuit: five turns of a rotating set of shapes (a 12-wide line, a 4-13 donut, a cone out to 22, two
//     donut sectors from 15.85), one on each platform, and a Gleaming Barrage on one half of each.
//   - Lone Wolf's Lament: close and far tethers, then 1-, 2- and 3-player towers. Howling Eight: eight hits on a
//     platform's tower, five times, the platform destroyed after each.
// Simplified: the knockbacks (Aero III) aren't modelled (everyone stands where the knockback would put them); baited
// lines and cones (tethers, Pack Predation, Reign's End, Twofold's line, Twinbite) are drawn and checked by where you
// stand rather than aimed; the adds share the boss's HP; the boss stays in the middle (his jumps, dashes and the
// shadows only move where the attacks come from). The layouts wtfdig gives no diagram for (where the pillars, lines,
// wolves, fonts and towers appear) are this script's own, made to satisfy the mechanic with BossMod's shapes.
(function (B) {
  const S = B.SLOTS;
  const all = (f) => Object.fromEntries(S.map(s => [s, f(s)]));
  const at = B.bearing;
  const inside = B.mechInside;
  const add = (a, b) => [a[0] + b[0], a[1] + b[1]];
  const mul = (a, k) => [a[0] * k, a[1] * k];
  const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);
  const deg360 = (d) => ((d % 360) + 360) % 360;
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
  const plat = (k) => at(PLAT[k], 17.5);
  // A point on platform k: r out from the arena's middle, l to the left (facing the boss from the platform).
  const pl = (k, r, l) => add(at(PLAT[k], r), at(PLAT[k] + 90, l || 0));
  const onPlat = (k, slack) => (p) => dist(p, plat(k)) <= (slack || 7);
  const unit = (v) => { const l = Math.hypot(v[0], v[1]) || 1; return [v[0] / l, v[1] / l]; };

  // ---------- shapes ----------
  // A rect hw either side of the line from a along bearing deg for len yalms: one rect when it runs north-south or
  // east-west, otherwise a chain of circles along it (the mechanics have no turned rects).
  function band(a, deg, len, hw) {
    const d = deg360(deg), u = at(d, 1), e = [a[0] + u[0] * len, a[1] + u[1] * len];
    if (Math.min(d % 90, 90 - (d % 90)) < 0.01) {
      const ns = Math.abs(u[0]) < 0.5;
      return [{ shape: 'rect', a: [Math.min(a[0], e[0]) - (ns ? hw : 0), Math.min(a[1], e[1]) - (ns ? 0 : hw)],
        b: [Math.max(a[0], e[0]) + (ns ? hw : 0), Math.max(a[1], e[1]) + (ns ? 0 : hw)] }];
    }
    // (The chain starts and ends a little inside the rect, which is square-ended: right behind its start is safe.)
    const out = [], step = hw * 0.7, s0 = Math.min(hw * 0.6, len / 2);
    for (let s = s0; s <= len - s0 + 1e-6; s += step) {
      const c = [a[0] + u[0] * s, a[1] + u[1] * s];
      if (Math.hypot(c[0], c[1]) < 27 + hw) out.push({ shape: 'circle', at: c, r: hw });
    }
    return out;
  }
  // A cross centred on c: four arms of len, hw either side, the first along bearing deg0.
  const cross = (c, deg0, len, hw) => [0, 90, 180, 270].flatMap(k => band(c, deg0 + k, len, hw));
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

  // Millennial Decay: each spot's bearing while the first line (north-south) comes, four each side;
  // everyone turns 45 degrees with each line after (34 degrees apart, so the Gust spreads clear even mid-turn). Fering: healers and melee west, tanks and ranged east, G1 north;
  // Toxic: G1 west (red north, purple south), G2 east (yellow north, blue south).
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
  // Twofold Tempest: each pair's home platform (Original; Caster SE swaps M2 and R2).
  const TWOFOLD = {
    original: { SW: ['MT', 'M1'], SE: ['OT', 'M2'], NW: ['H1', 'R1'], NE: ['H2', 'R2'] },
    casterse: { SW: ['MT', 'M1'], NE: ['H2', 'M2'], NW: ['H1', 'R1'], SE: ['OT', 'R2'] },
  };
  // Whose platform's pair baits the line while the tether is on a platform.
  const TWOFOLD_LINE = { SW: 'NE', NW: 'SE', NE: 'SW', SE: 'NW' };

  // ---------- the pull ----------
  function plan(events, strat) {
    const st = STRATS[strat] || STRATS.toxic;
    const P = { start: Object.assign({}, UP), prefs: [], hazards: [], checks: [], calls: [], marks: [], labels: new Map(), debuffs: [] };
    let id = 0, hold = -1, p2 = false, reignEnd = -1;
    const hz = (o) => { const h = Object.assign({ id: ++id, react: 3 }, o); P.hazards.push(h); return h.id; };
    const hzs = (shapes, o) => shapes.forEach(s => hz(Object.assign({}, o, s)));
    const pref = (t, spots) => P.prefs.push({ t, spots });
    const call = (t, text, o) => P.calls.push(Object.assign({ t, text }, o));
    const check = (o) => P.checks.push(o);
    const mark = (t0, t1, shape, fill) => P.marks.push(Object.assign({ kind: 'lit', t0, t1, fill: fill || 'rgba(255,90,60,0.2)' }, shape));
    const debuff = (slot, key, name, hint, t0, t1) => P.debuffs.push({ slot, key, name, hint, t0, t1 });
    const castOf = (ev, d) => ev.t - (ev.cast || d || 5);
    const next = (i, test, within) => { for (let k = i + 1; k < events.length && events[k].t - events[i].t <= within; k++) if (test(events[k])) return events[k]; return null; };
    const after = (i, test, within) => events.filter((e, k) => k > i && e.t - events[i].t <= within && test(e));
    const home = () => (p2 ? P2UP : UP);
    // A mechanic's spots start no earlier than the last one's are done with, and it ends by sending everyone home.
    const begin = (t0) => Math.max(t0, hold + 0.05);
    const end = (t1, spots) => { pref(t1, spots || home()); hold = t1; };
    const raid = (ev, dmg, d) => { hz({ t: ev.t, tell: castOf(ev, d || 4), raidwide: true, dmg, name: ev.name.replace(/ \d+$/, '') }); };
    // Something that stays on the floor: a hit every couple of seconds on whoever stands in it.
    const linger = (shape, t0, t1, name, every) => { for (let t = t0; t <= t1; t += every || 2) hz(Object.assign({ t, tell: t - (every || 2), react: 1, dmg: 0.9, name }, shape)); };
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
        hzs(cross([0, 0], cards ? 0 : 45, 15, 3), { t, tell: cs, dmg: 1.3, name: fang });
        hz(wind ? { t, tell: cs, shape: 'donut', at: [0, 0], r0: 8, dmg: 1.3, name: fang } : { t, tell: cs, shape: 'circle', at: [0, 0], r: 9, dmg: 1.3, name: fang });
        // Each colour's pair on its marker between the arms: stacked in close (Windfang), or either side of it out
        // at the wall (Stonefang: the support on the left, the DPS on the right).
        const spots = {};
        for (const [c, [sup, dps]] of Object.entries(COLOR_PAIRS)) {
          const b = CARD[c] - (cards ? 45 : 0);
          if (wind) spots[sup] = spots[dps] = at(b, 6.4);
          else { spots[sup] = at(b - 16, 10.6); spots[dps] = at(b + 16, 10.6); }
        }
        pref(begin(cs + 0.3), spots);
        if (wind) check({ t: t + 0.1, kind: 'stack', groups: Object.values(COLOR_PAIRS), r: 2.5, dmg: 0.3, fail: 0.7, name: 'Windfang', spots });
        else hz({ t: t + 0.1, tell: t - 1.5, shape: 'protean', aimed: true, half: 12.5, r: 40, dmg: 0.9, own: 0.15, name: 'Stonefang' });
        call(cs, wind ? `In + ${cards ? 'Intercards' : 'Cards'} + Partners` : `Out + ${cards ? 'Intercards' : 'Cards'} + Protean`, { alert: true, dur: 6 });
        end(t + 0.4);

      // ===== Eminent / Revolutionary Reign =====
      } else if (name === 'Eminent Reign/Revolutionary Reign') {
        const inn = Math.random() < 0.5, cs = castOf(ev, 5.1);
        P.labels.set(ev, inn ? 'Eminent Reign' : 'Revolutionary Reign');
        // Three shadows 120 degrees apart (one set or the other); he jumps to one of them and dashes across.
        const set0 = pick([0, 180]), clones = [0, 120, 240].map(d => deg360(set0 + d)), th = pick(clones);
        const dash = next(i, e => e.name === "Wolves' Reign (circles)", 6), cone = next(i, e => e.name === "Wolves' Reign (cones)", 9);
        const tJump = t + 1.4, tDash = (dash ? dash.t : t + 3.4) + 0.4, tEnd = (cone ? cone.t : t + 6.4) + 0.4;
        for (const c of clones) hz({ t: tJump, tell: cs + 1, shape: 'circle', at: at(c, 10), r: 6, dmg: 1.3, name: "Wolves' Reign" });
        hzs(band(at(th, 10), th + 180, 28, 5), { t: tDash, tell: tJump, dmg: 1.4, name: "Wolves' Reign" });
        const src = at(th + 180, 7.25);           // where the dash ends, facing back the way he came
        hz(inn ? { t: tEnd, tell: tDash, shape: 'cone', at: src, deg: th, half: 60, r: 40, dmg: 1.4, name: "Wolves' Reign" }
          : { t: tEnd, tell: tDash, shape: 'circle', at: src, r: 14, dmg: 1.4, name: "Wolves' Reign" });
        // Looking at him from the middle, G1 on the left (BossMod's spots): in, the tanks just behind him and the
        // light parties at his sides; out, everyone across the arena, the tanks wider.
        const fin = all(s => {
          const sg = G1.includes(s) ? 1 : -1, tank = TANKS.includes(s);
          return inn ? add(src, at(th + sg * (tank ? 145 : 75), tank ? 4 : 7)) : add(src, at(th + sg * (tank ? 44 : 11), tank ? 15.2 : 17.5));
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
        const lps = [['H1', 'M1', 'R1'], ['H2', 'M2', 'R2']];
        check({ t: tEnd + 0.1, kind: 'stack', groups: lps, slots: lps.flat(), r: 3, dmg: 0.35, fail: 0.8, name: 'Sovereign Scar', spots: fin });
        check({ t: tEnd + 0.1, kind: 'stack', groups: [['MT'], ['OT']], slots: TANKS, r: 3, dmg: 0.5, fail: 0.9, name: "Reign's End", spots: fin });
        for (const s of ['H1', 'H2', 'MT', 'OT']) {
          const d = Math.atan2(fin[s][0] - src[0], fin[s][1] - src[1]) * 180 / Math.PI;
          mark(tEnd - 2.5, tEnd + 0.3, { shape: 'cone', at: src, deg: d, half: TANKS.includes(s) ? 30 : 15, r: 22 }, TANKS.includes(s) ? 'rgba(255,90,60,0.18)' : 'rgba(120,200,255,0.2)');
        }
        call(cs, inn ? '(In later)' : '(Out later)', { dur: 4 });
        call(tJump, inn ? `In: behind him, ${dirName(th + 180)}` : `Out: far side, ${dirName(th)}`, { alert: true, dur: 5 });
        reignEnd = tEnd;
        end(tEnd + 0.4);

      // ===== Weal of Stone: three lines =====
      } else if (name === 'Weal of Stone') {
        const ns = Math.random() < 0.5, u = ns ? 0 : 90;
        // Lines 6 wide at -9, 0 and 9 across; the lanes between them (4.5 either side of the middle) are safe.
        for (const o of [-9, 0, 9]) hzs(band(add(at(u, -16), at(u + 90, o)), u, 32, 3), { t, tell: t - 4.5, dmg: 1.3, name });
        const lanes = all(s => {
          const k = (G1.includes(s) ? -1 : 1), j = (G1.includes(s) ? G1 : G2).indexOf(s);
          return add(at(u + 90, 4.5 * k), at(u, -3 + 2 * j));
        });
        pref(begin(Math.max(t - 5.5, reignEnd + 0.15)), lanes);
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
        aeros.forEach(e => hz({ t: e.t, tell: castOf(e, 5), raidwide: true, dmg: 0.15, name: 'Aero III' }));
        // The wolves' lines: the first north-south, each after turned 45 degrees the same way round.
        const phi0 = pick([0, 180]), dir = pick([1, -1]), base = DECAY[st.decay] || DECAY.toxic;
        lines.forEach((e, k) => {
          const d = phi0 + 45 * k * dir;
          hzs(band(at(d, 13), d + 180, 26, 4), { t: e.t, tell: k ? lines[k - 1].t - 1.5 : e.t - 6, dmg: 1.4, name: 'Breath of Decay', react: 2 });
        });
        const turned = (k) => all(s => at(base[s] + 45 * k * dir, 11));
        pref(begin(lines.length ? lines[0].t - 5.5 : t + 6), turned(0));
        lines.slice(0, -1).forEach((e, k) => pref(e.t + 0.05, turned(k + 1)));
        call(lines.length ? lines[0].t - 6 : t, `Lines turn ${dir > 0 ? 'clockwise' : 'counterclockwise'}: rotate with them`, { alert: true, dur: 6 });
        // Gust: spreads on four, then the other four.
        const gust1 = shuffle(S).slice(0, 4), gustSets = [gust1, S.filter(s => !gust1.includes(s))];
        gusts.forEach((e, k) => {
          check({ t: e.t, kind: 'spread', slots: gustSets[k] || [], r: 5, dmg: 0.3, fail: 0.7, name: 'Gust' });
          for (const s of gustSets[k] || []) call(e.t - 4, 'Spread (Gust)', { slot: s, dur: 4 });
        });
        // Then each colour's pair: one tethered to a wolf across the arena (Winds of Decay: a cone along the tether),
        // one in the tower on their marker. Towers on the cardinals or the intercards; tethers on the others.
        if (prowl) {
          const cards = Math.random() < 0.5, spots = {}, towers = {}, tethered = {};
          for (const [c, pair] of Object.entries(COLOR_PAIRS)) {
            const tw = cards ? CARD[c] : CARD[c] - 45, te = cards ? CARD[c] - 45 : CARD[c];
            const [teth, soak] = Math.random() < 0.5 ? pair : [pair[1], pair[0]];
            spots[soak] = towers[soak] = at(tw, 9);
            spots[teth] = tethered[teth] = at(te, 11.2);
            mark(prowl.t - 7, prowl.t, { shape: 'circle', at: towers[soak], r: 2 }, 'rgba(120,200,255,0.25)');
            mark(prowl.t - 7, prowl.t + 0.1, { shape: 'cone', at: at(te + 180, 12.6), deg: te, half: 15, r: 25 });
            call(prowl.t - 7, 'Tower on your colour', { slot: soak, dur: 6 });
            call(prowl.t - 7, `Tether: stretch it to the ${dirName(te)}`, { slot: teth, alert: true, dur: 6 });
          }
          pref(lines.length ? lines[lines.length - 1].t + 0.05 : prowl.t - 7, spots);
          check({ t: prowl.t, kind: 'spot', spots: towers, r: 2, fail: 0.9, name: 'Prowling Gale' });
          check({ t: winds ? winds.t : prowl.t + 0.1, kind: 'spot', spots: tethered, r: 2.5, fail: 0.9, name: 'Winds of Decay' });
          runs.add(prowl); if (winds) runs.add(winds);
          end((winds ? winds.t : prowl.t) + 0.3);
        } else end(t + 30);

      // ===== Tracking Tremors: eight stacks =====
      } else if (name === 'Tracking Tremors') {
        const hits = after(i, e => /^Tracking Tremors \d/.test(e.name), 12), cs = castOf(ev, 5);
        hits.forEach(e => {
          runs.add(e);
          check({ t: e.t, kind: 'stack', groups: [S], r: 6, dmg: 0.06, fail: 0.4, name: 'Tracking Tremors', spots: STACK });
        });
        pref(begin(cs), STACK);
        call(cs, 'Stack x8', { alert: true, dur: 9 });
        end((hits.length ? hits[hits.length - 1].t : t + 8) + 0.3);

      // ===== Great Divide: the tanks share a line =====
      } else if (name === 'Great Divide') {
        const cs = castOf(ev, 5);
        pref(begin(cs), { MT: [-0.5, 6], OT: [0.5, 6] });
        // The line runs north from him through the tanks (anyone else in it is hit).
        hz({ t, tell: cs + 1, shape: 'rect', a: [-3, 0.3], b: [3, 4.4], dmg: 1.2, name });
        hz({ t, tell: cs + 1, shape: 'rect', a: [-3, 7.6], b: [3, 20], dmg: 1.2, name });
        check({ t, kind: 'stack', groups: [TANKS], slots: TANKS, r: 2.5, dmg: 0.5, fail: 1, name, spots: { MT: [-0.5, 6], OT: [0.5, 6] } });
        call(cs, 'Shared tank line', { dur: 5 });
        for (const s of TANKS) call(cs, 'Tank line on you: share it with the other tank', { slot: s, alert: true, dur: 5 });
        end(t + 0.3);

      // ===== Terrestrial Titans =====
      } else if (name === 'Terrestrial Titans') {
        const cs = castOf(ev, 4), ew = Math.random() < 0.5;
        const pil = ew ? [[-7, 0], [7, 0]] : [[0, 7], [0, -7]];
        const pillars = pil.map(p => ({ shape: 'circle', at: p, r: 5 }));
        hzs(pillars, { t, tell: cs, dmg: 1.3, name });
        // The pillars fall as 10-wide lines, one each way along a diagonal; then two Fanged Crossings, on the other
        // axis 8 out, one a plus and one an X: of the two intercards the lines miss, the X's side is safe.
        const fall = next(i, e => e.name === 'Towerfall', 20), d = pick([45, 315]);
        const fangs = ew ? [[0, 8], [0, -8]] : [[8, 0], [-8, 0]], xi = pick([0, 1]), xf = fangs[xi], pf = fangs[1 - xi];
        const lands = [...band(pil[0], d, 30, 5), ...band(pil[1], d + 180, 30, 5), ...cross(xf, 45, 21, 3.5), ...cross(pf, 0, 21, 3.5)];
        const tf = fall ? fall.t : t + 15;
        hzs(lands, { t: tf, tell: tf - 7, dmg: 1.4, name: 'Towerfall' });
        if (fall) runs.add(fall);
        const safeDeg = [d + 90, d - 90].find(b => { const u = at(b, 1); return u[0] * xf[0] + u[1] * xf[1] > 0; });
        // Out of the pillars' way meanwhile (each spot's nearest ground clear of them), then the safe corner.
        pref(begin(cs), all(s => clump(pillars, UP[s], 1, onP1)[0]));
        const corner = clump(lands, at(safeDeg, 10.8), 8, onP1, { gap: 0.45 });
        pref(tf - 6.4, assign(S, corner));
        call(cs, 'Pillars: keep clear', { dur: 4 });
        call(tf - 6.4, `Safe: ${dirName(safeDeg)}`, { alert: true, dur: 6 });
        end(tf + 0.3);

      // ===== Tactical Pack: the wolves =====
      } else if (name === 'Tactical Pack') {
        const tEnd = 242;
        linger({ shape: 'circle', at: [0, 0], r: 8 }, t + 6, tEnd, 'Tactical Pack (the floor gives way)', 2);
        // The Wolf of Wind on one side, the Wolf of Stone on the other, each light party on one; the tank faces its
        // wolf north, the rest stand south of it, and Pack Predation's line goes out from the wolf at its target.
        const windE = Math.random() < 0.5, g1E = Math.random() < 0.5;
        const sides = { E: g1E ? G1 : G2, W: g1E ? G2 : G1 };
        const homeSpots = {}, wolves = {};
        for (const [k, grp] of Object.entries(sides)) {
          const x = k === 'E' ? 1 : -1, others = grp.filter(s => !TANKS.includes(s));
          wolves[k] = [9.8 * x, 0];
          homeSpots[grp.find(s => TANKS.includes(s))] = [9.3 * x, 3.6];
          [[9.6, -3.4], [10.6, -2.6], [9.0, -4.6]].forEach((p, j) => { homeSpots[others[j]] = [p[0] * x, p[1]]; });
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
          const spots = Object.assign({}, homeSpots), baits = {};
          for (const side of ['E', 'W']) {
            const b = order[side][k % 3], x = side === 'E' ? 1 : -1;
            spots[b] = baits[b] = [11.6 * x, 0];
            mark(e.t - 5, e.t, { shape: 'rect', a: [x > 0 ? 9.8 : -30, -3], b: [x > 0 ? 30 : -9.8, 3] });
            mark(e.t - 5, e.t, { shape: 'cone', at: wolves[side], deg: Math.atan2(-0.5 * x, 3.6) * 180 / Math.PI, half: 30, r: 12 });
            call(e.t - 5, 'Predation on YOU: bait the line out past your wolf', { slot: b, alert: true, dur: 5 });
          }
          pref(e.t - 3, baits);
          pref(e.t + 0.1, homeSpots);
          check({ t: e.t, kind: 'spot', spots, r: 2.5, fail: 0.9, name: 'Pack Predation' });
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
        P.labels.set(ev, `${name.replace(' (Enrage)', '')} (the adds' enrage: they're dead by now)`);

      // ===== Terrestrial Rage =====
      } else if (name === 'Terrestrial Rage' && t < 420) {
        const R = pick([0, 90, 180, 270]), loc = (x, y) => add(at(R, y), at(R + 90, x));
        const charges = after(i, e => e.name === 'Fanged Charge', 12), marks = after(i, e => e.name === 'Heavensearth', 18);
        const chase = next(i, e => e.name === 'Shadowchase', 12), roar = next(i, e => e.name === 'Roaring Wind', 25);
        after(i, e => e.name === 'Suspended Stone' || e.name === 'Heavensearth' || e.name === 'Fanged Charge', 18).forEach(e => runs.add(e));
        // Fanged Charge: two lines 6 out either side of the middle (along the wall laser's axis), then two at 10.5.
        const lines1 = [-6, 6].flatMap(x => band(loc(x, 15), R + 180, 30, 3)), lines2 = [-10.5, 10.5].flatMap(x => band(loc(x, 15), R + 180, 30, 3));
        if (charges[0]) hzs(lines1, { t: charges[0].t, tell: castOf(charges[0], 4), dmg: 1.3, name: 'Fanged Charge' });
        if (charges[1]) hzs(lines2, { t: charges[1].t, tell: charges[0] ? charges[0].t : castOf(charges[1], 4), dmg: 1.3, name: 'Fanged Charge', react: 1.1 });
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
        if (marks[0]) {
          check({ t: marks[0].t, kind: 'spread', slots: first, r: 6, dmg: 0.3, fail: 0.7, name: 'Suspended Stone' });
          check({ t: marks[0].t, kind: 'stack', groups: [second], slots: second, r: 6, dmg: 0.3, fail: 0.7, name: 'Heavensearth', spots: set1 });
          pref(marks[0].t + 0.05, in1);
          for (const s of first) call(marks[0].t - 5, 'Spread => Stack', { slot: s, dur: 5 });
          for (const s of second) call(marks[0].t - 5, 'Stack => Spread', { slot: s, dur: 5 });
        }
        // Shadowchase: five shadows on a pentagon, each dashing through the middle; behind them is safe. Then Roaring
        // Wind from the other pentagon: everyone turns 36 degrees clockwise to be behind a head.
        const pentA = Math.random() < 0.5, verts = (pentA ? [180, 252, 324, 36, 108] : [0, 72, 144, 216, 288]), v0 = pentA ? 36 : 0;
        const shadows = verts.flatMap(v => band(at(v, 7), v + 180, 20, 4)), heads = verts.flatMap(v => band(at(v + 36, 7), v + 216, 20, 4));
        const tChase = (marks[1] ? marks[1].t : (chase ? chase.t + 6 : t + 15)) + 0.3, tRoar = roar ? roar.t : tChase + 4.6;
        hzs(shadows, { t: tChase, tell: tChase - 3.5, dmg: 1.4, name: 'Shadowchase' });
        hzs(heads, { t: tRoar, tell: tChase, dmg: 1.4, name: 'Roaring Wind' });
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
          check({ t: marks[1].t, kind: 'spread', slots: second, r: 6, dmg: 0.3, fail: 0.7, name: 'Suspended Stone' });
          check({ t: marks[1].t, kind: 'stack', groups: [first], slots: first, r: 6, dmg: 0.3, fail: 0.7, name: 'Heavensearth', spots: set2 });
          for (const s of second) call(marks[1].t - 5, 'Spread (behind clones)', { slot: s, dur: 5 });
          for (const s of first) call(marks[1].t - 5, 'Stack (behind clones)', { slot: s, dur: 5 });
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
        cl.forEach((h, k) => hz(Object.assign({ t: bt(k), tell: k ? bt(k - 1) : bt(0) - 5, dmg: 1.4, name: "Moonbeam's Bite", react: 2 }, h)));
        const dot = (u, v) => u[0] * v[0] + u[1] * v[1];
        const tCross = bt(dot(cl[0].dir, at(Q2.q, 1)) > 0 ? 0 : 1) + 0.05;
        const first = Math.random() < 0.5 ? SUP : DPS, second = first === SUP ? DPS : SUP;
        // Each set's spots: Quad: spreads close and far along both edges (G1 on the left facing him), the stack on
        // the intercard; Toxic: three spreads on the markers, the stack near him, OT or R1 spreading next door.
        const layout = (Q, spread, flexQ) => {
          const out = {}, stackers = S.filter(s => !spread.includes(s));
          if (st.moonlight === 'toxic') {
            const flex = spread.includes('OT') ? 'OT' : 'R1';
            const left = spread.find(s => s === 'H2' || s === 'M2'), mid = spread.find(s => s === 'H1' || s === 'M1'), right = spread.find(s => s === 'MT' || s === 'R2');
            out[left] = Q.pt(1.3, 9.6); out[mid] = Q.pt(7.4, 7.4); out[right] = Q.pt(9.6, 1.3);
            out[flex] = at(flexQ, 10.3);
            Object.assign(out, assign(stackers, clump([], Q.pt(2.6, 2.6), 4, onP1, { gap: 0.4 })));
            return { spots: out, flex };
          }
          const close = (g) => spread.find(s => g.includes(s) && (TANKS.includes(s) || s[0] === 'M')), far = (g) => spread.find(s => g.includes(s) && !(TANKS.includes(s) || s[0] === 'M'));
          out[close(G1)] = Q.pt(1.3, 5.6); out[far(G1)] = Q.pt(1.3, 11.7);
          out[close(G2)] = Q.pt(5.6, 1.3); out[far(G2)] = Q.pt(11.7, 1.3);
          Object.assign(out, assign(stackers, clump([], Q.pt(7.9, 7.9), 4, onP1, { gap: 0.4 })));
          return { spots: out };
        };
        // Toxic's flex quadrants: beside Q1, safe from the first cleave (back in before the second); beside Q2 on the
        // third cleave's side (safe once it's gone).
        const besideIn = (Q, h) => [Q.q + 90, Q.q - 90].map(deg360).find(q => dot(h.dir, at(q, 1)) > 0);
        const L1 = layout(Q1, first, besideIn(Q1, cl[1])), L2 = layout(Q2, second, besideIn(Q2, cl[2]));
        const rest1 = all(s => clump([], Q1.pt(3.5, 3.5), 8, onP1, { gap: 0.5 })[S.indexOf(s)]);
        pref(begin(t + 3), rest1);
        pref(t + 7.8, L1.spots);
        const m1 = marks[0] ? marks[0].t : bt(0) - 1.4, m2 = marks[1] ? marks[1].t : bt(3) + 1;
        check({ t: m1, kind: 'spread', slots: first, r: 6, dmg: 0.3, fail: 0.7, name: 'Suspended Stone' });
        check({ t: m1, kind: 'stack', groups: [S.filter(s => !first.includes(s))], slots: S.filter(s => !first.includes(s)), r: 6, dmg: 0.3, fail: 0.7, name: 'Heavensearth', spots: L1.spots });
        // Then everyone gathers on Q1's side by Q2, to step across once it's safe.
        const shared = dot(Q1.ua, at(Q2.q, 1)) > 0 ? Q1.ua : Q1.ub;
        pref(m1 + 0.05, assign(S, clump([cl[0], cl[1]], add(mul(shared, 6.5), at(Q1.q, 1.8)), 8, onP1, { gap: 0.5 })));
        const w2 = Object.assign({}, L2.spots);
        if (L2.flex) w2[L2.flex] = Q2.pt(4.5, 4.5);
        pref(tCross, w2);
        if (L2.flex) pref(bt(2) + 0.05, { [L2.flex]: L2.spots[L2.flex] });
        check({ t: m2, kind: 'spread', slots: second, r: 6, dmg: 0.3, fail: 0.7, name: 'Suspended Stone' });
        check({ t: m2, kind: 'stack', groups: [S.filter(s => !second.includes(s))], slots: S.filter(s => !second.includes(s)), r: 6, dmg: 0.3, fail: 0.7, name: 'Heavensearth', spots: L2.spots });
        call(t + 3, `Quadrants: ${dirName(Q1.q)} => ${dirName(Q2.q)}`, { alert: true, dur: 8 });
        for (const s of first) call(m1 - 5, 'Spread => Stack', { slot: s, dur: 5 });
        for (const s of second) call(m1 - 5, 'Stack => Spread', { slot: s, dur: 5 });
        end(m2 + 0.3);

      // ===== the end of phase 1 =====
      } else if (name === 'Extraplanar Feast (Enrage)') {
        P.labels.set(ev, 'Extraplanar Feast (phase 1\'s enrage: pushed past in a kill)');
      } else if (name === '--sync--' || name === '--middle--') {
        // (filtered out by the timeline already)

      // ===== phase 2: Quake III, light parties by platform =====
      } else if (name === 'Quake III') {
        if (!p2) { p2 = true; pref(Math.max(hold + 0.05, 606), SOUTH); hold = 606; }
        const cs = castOf(ev, 5);
        pref(begin(cs), P2UP);
        check({ t, kind: 'stack', groups: [G1, G2], r: 7, dmg: 0.4, fail: 0.8, name, spots: P2UP });
        call(cs, 'Light party platforms: G1 south-west, G2 south-east', { alert: true, dur: 5 });
        end(t + 0.3);

      // ===== Ultraviolent Ray: five baits, one to a platform; Gleaming Beam on half of each =====
      } else if (/^Ultraviolent Ray \d/.test(name)) {
        const n = +name.slice(-1), cs = castOf(ev, 6), beam = next(i, e => e.name === 'Gleaming Beam', 1);
        if (beam) runs.add(beam);
        // One group bait three, the other two; each group's baits in their conga order (tank, healer, ranged,
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
          beams[k] = band(pl(k, 26.5, 4 * side[k]), PLAT[k] + 180, 17, 4);
          hzs(beams[k], { t, tell: t - 4, dmg: 1.3, name: 'Gleaming Beam' });
        }
        const spots = {};
        for (const k of PLATS) {
          const here = S.filter(s => platOfSlot[s] === k);
          if (here.length) Object.assign(spots, assign(here, clump(beams[k], pl(k, 16, -3.6 * side[k]), here.length, onPlat(k, 6.8), { gap: 0.6 })));
        }
        pref(begin(cs + 0.3), spots);
        check({ t, kind: 'stack', groups: baits.map(s => [s]), slots: baits, r: 4, dmg: 0.25, fail: 0.9, name: 'Ultraviolent Ray', spots });
        check({ t, kind: 'spot', spots: Object.fromEntries(S.filter(s => !baits.includes(s)).map(s => [s, spots[s]])), r: 4, fail: 0.9, name: 'Gleaming Beam' });
        for (const s of baits) call(cs, `UV Ray on YOU: ${platOfSlot[s]} platform`, { slot: s, alert: true, dur: 6 });
        for (const s of S) call(t - 3.5, side[platOfSlot[s]] > 0 ? 'Right' : 'Left', { slot: s, dur: 3 });
        end(t + 0.3);

      // ===== Twinbite: the tanks alone, south-west and south-east; everyone else south =====
      } else if (name === 'Twinbite') {
        const cs = castOf(ev, 7), spots = Object.assign({}, SOUTH, { MT: plat('SW'), OT: plat('SE') });
        pref(begin(cs), spots);
        check({ t, kind: 'stack', groups: [['MT'], ['OT']], slots: TANKS, r: 5, dmg: 0.5, fail: 1, name, spots });
        check({ t, kind: 'spot', spots: Object.fromEntries(S.filter(s => !TANKS.includes(s)).map(s => [s, SOUTH[s]])), r: 5, fail: 1, name });
        mark(t - 4, t, { shape: 'circle', at: plat('SW'), r: 8 }); mark(t - 4, t, { shape: 'circle', at: plat('SE'), r: 8 });
        call(cs, 'Tank busters: tanks to their platforms, party south', { dur: 5 });
        end(t + 0.3);

      // ===== Hero's Blow: half the room and in or out, on the south platform =====
      } else if (name === "Hero's Blow") {
        const cs = castOf(ev, 7), east = Math.random() < 0.5, inn = Math.random() < 0.5;
        P.labels.set(ev, `Hero's Blow (${east ? 'east' : 'west'} safe, ${inn ? 'in' : 'out'})`);
        const shapes = [{ shape: 'half', dir: [east ? -1 : 1, 0] }, inn ? { shape: 'donut', at: [0, 0], r0: 15 } : { shape: 'circle', at: [0, 0], r: 22 }];
        hzs(shapes, { t, tell: cs, dmg: 1.4, name });
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
        const bait = SOUTH, away = Object.assign({}, { MT: pl('SW', 17.5, 0), OT: pl('SE', 17.5, 0) },
          assign(['H1', 'M1', 'R1'], clump([], pl('NW', 18, -2), 3, onPlat('NW'), { gap: 0.6 })), assign(['H2', 'M2', 'R2'], clump([], pl('NE', 18, 2), 3, onPlat('NE'), { gap: 0.6 })));
        pref(begin(castOf(ev, 4)), bait);
        pref(t + 0.1, away);
        hz({ t: th, tell: t, shape: 'circle', at: plat('S'), r: 8, dmg: 1.5, name: 'Mooncleaver' });
        linger({ shape: 'circle', at: plat('S'), r: 8 }, th + 2.5, 794, 'Mooncleaver (the platform is gone)', 2.5);
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
          check({ t: tb, kind: 'spread', slots: [T], r: 16, dmg: 0.4, fail: 0.8, name: 'Aerotemporal Blast' });
          check({ t: tb, kind: 'stack', groups: [party], slots: party, r: 6, dmg: 0.35, fail: 0.8, name: 'Geotemporal Blast', spots });
          check({ t: tb, kind: 'spot', spots: { [T]: spots[T], [U]: spots[U] }, r: 3, fail: 0.9, name: "Hunter's Harvest" });
          hz({ t: tb + 0.05, tell: tb - 3, shape: 'protean', aimed: true, target: U, half: 100, r: 40, dmg: 1.4, own: 0.45, name: "Hunter's Harvest" });
          call(castOf(purge, 5), `Elemental Purge on ${T} and ${X}`, { dur: 6 });
          call(castOf(purge, 5), `Stack on ${X}: ${sp} platform`, { alert: true, dur: 6 });
          call(castOf(purge, 5), 'Marked: spread far, the other tank provokes', { slot: T, alert: true, dur: 6 });
          call(castOf(purge, 5), 'Provoke: take the cleave on your platform', { slot: U, alert: true, dur: 6 });
          end(tb + 0.3);
        } else end(th + 0.3);

      // ===== Prowling Gale (phase 2): two-player towers =====
      } else if (name === 'Prowling Gale (Towers)' && t > 700 && t < 800) {
        const pairs = TWOFOLD[st.twofold] || TWOFOLD.casterse, spots = {}, groups = [];
        for (const [k, pair] of Object.entries(pairs)) {
          spots[pair[0]] = pl(k, 17.5, 0.4); spots[pair[1]] = pl(k, 17.5, -0.4);
          groups.push(pair);
          mark(t - 8, t, { shape: 'circle', at: plat(k), r: 2 }, 'rgba(120,200,255,0.25)');
        }
        pref(begin(t - 8), spots);
        check({ t, kind: 'stack', groups, r: 2, dmg: 0.3, fail: 0.8, name: 'Prowling Gale', spots });
        call(t - 8, 'Towers: your pair\'s platform', { alert: true, dur: 6 });
        end(t + 0.3);

      // ===== Twofold Tempest =====
      } else if (name === 'Twofold Tempest') {
        const rounds = [ev].concat(after(i, e => e.name === 'Twofold Tempest', 25)).slice(0, 4), surges = after(i, e => e.name === 'Wind Surge', 30);
        rounds.forEach(e => runs.add(e)); surges.forEach(e => runs.add(e));
        const homes = TWOFOLD[st.twofold] || TWOFOLD.casterse, startW = Math.random() < 0.5;
        const order = startW ? ['SW', 'NW', 'NE', 'SE'] : ['SE', 'NE', 'NW', 'SW'];
        const homeOf = {};
        for (const [k, pair] of Object.entries(homes)) for (const s of pair) homeOf[s] = k;
        const stackAt = (k) => pl(k, 23, 0), puddles = [];
        rounds.forEach((e, k) => {
          // The tether's pair stacks far out on its platform; the pair whose platform the line goes to baits it from
          // close in; the others wait on theirs, clear of any puddle.
          const T = order[k], L = TWOFOLD_LINE[T], live = puddles.filter(p => p.t1 > e.t - 0.5 && p.t0 < e.t + 7).map(p => p.shape);
          const spots = {};
          for (const [h, pair] of Object.entries(homes)) {
            if (h === T) Object.assign(spots, assign(pair, [pl(h, 23, 0.4), pl(h, 23, -0.4)]));
            else if (h === L) Object.assign(spots, assign(pair, [pl(h, 10.4, 1), pl(h, 10.4, -1)]));
            else Object.assign(spots, assign(pair, clump(live, pl(h, 12.6, 0), 2, onPlat(h, 6.5), { gap: 0.8 })));
          }
          pref(k ? rounds[k - 1].t + 0.05 : begin(e.t - 6.5), spots);
          check({ t: e.t, kind: 'stack', groups: [homes[T]], slots: homes[T], r: 3, dmg: 0.35, fail: 0.8, name: 'Twofold Tempest', spots });
          check({ t: e.t, kind: 'stack', groups: [homes[L]], slots: homes[L], r: 3, dmg: 0.35, fail: 0.8, name: 'Twofold Tempest (line)', spots });
          check({ t: e.t, kind: 'spot', spots: Object.fromEntries(S.filter(s => homeOf[s] !== T && homeOf[s] !== L).map(s => [s, spots[s]])), r: 4, fail: 0.8, name: 'Twofold Tempest' });
          mark(e.t - 4, e.t, { shape: 'circle', at: plat(L), r: 8 });
          mark(e.t - 4, e.t, { shape: 'circle', at: stackAt(T), r: 6 }, 'rgba(120,200,255,0.2)');
          for (const s of homes[T]) call(e.t - 5, `Tether stack: far out on ${T}`, { slot: s, alert: true, dur: 5 });
          for (const s of homes[L]) call(e.t - 5, `Bait the line: in close on ${L}`, { slot: s, alert: true, dur: 5 });
          // Its puddle: 9 yalms where they stacked, for 11.7 s from the Wind Surge.
          const sg = surges[k], t0 = sg ? sg.t : e.t + 3.7, shape = { shape: 'circle', at: stackAt(T), r: 9 };
          puddles.push({ t0, t1: t0 + 11.7, shape });
          linger(shape, t0 + 0.5, t0 + 11.7, 'Wind Surge', 2);
        });
        call(rounds[0].t - 7, `Tether starts ${startW ? 'south-west' : 'south-east'}`, { dur: 5 });
        end(rounds[rounds.length - 1].t + 0.3);

      // ===== Champion's Circuit =====
      } else if (name === "Champion's Circuit") {
        const steps = [ev].concat(after(i, e => e.name === "Champion's Circuit", 22)).slice(0, 5), barrages = events.filter(e => e.name === 'Gleaming Barrage' && e.t > t - 1 && e.t < t + 20);
        steps.forEach(e => runs.add(e));
        const dir = pick([1, -1]), cs = castOf(ev, 7.3);
        P.labels.set(ev, `Champion's Circuit (${dir > 0 ? 'clockwise' : 'counterclockwise'})`);
        // The five shapes, one on each platform, turning a platform each time; the south platform's in turn.
        const baseShapes = ['sides', 'in', 'out', 'in', 'donut'];
        const shapeOn = (k) => baseShapes[(((0 - dir * k) % 5) + 5) % 5];
        const SH = {
          sides: { shape: 'rect', a: [-6, -31], b: [6, 0] },
          in: { shape: 'rect', a: [-9.5, -28], b: [9.5, -15.85] },
          out: { shape: 'cone', at: [0, 0], deg: 180, half: 30, r: 22 },
          donut: { shape: 'donut', at: plat('S'), r0: 4 },
        };
        const WANT = { sides: 7.3, in: 3, out: 3, donut: 2 }, Y = { sides: -17.5, in: -12.6, out: -24, donut: -17.5 };
        const seq = [];
        steps.forEach((e, k) => {
          const b = barrages.find(x => Math.abs(x.t - (e.t - 0.6)) < 0.8) || null, side = pick([1, -1]), kind = shapeOn(k);
          seq.push(kind);
          const bar = { shape: 'rect', a: [0, -26.5], b: [8 * side, 4.5] };
          hz(Object.assign({ t: e.t, tell: k ? steps[k - 1].t : cs, dmg: 1.4, name: "Champion's Circuit" }, SH[kind]));
          if (b) { runs.add(b); hz(Object.assign({ t: b.t, tell: b.t - 2.8, dmg: 1.3, name: 'Gleaming Barrage' }, bar)); }
          const spots = assign(S, clump([SH[kind], bar], [-WANT[kind] * side, Y[kind]], 8, onPlat('S', 7.6), { gap: 0.45, m: 1.2 }));
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
        // one each west (the far tank), east (its partner) and north (the far healer's partner).
        const tw = { S: [farH, closeH, dCH], [north2]: [closeT, dCT], SW: [farT], SE: [dFT], [north1]: [dFH] };
        const spots = {}, groups = [];
        for (const [k, g] of Object.entries(tw)) {
          Object.assign(spots, assign(g, clump([], plat(k), g.length, onPlat(k), { gap: 0.5 })));
          groups.push(g);
          mark(tt - 8, tt, { shape: 'circle', at: plat(k), r: 2 }, 'rgba(120,200,255,0.25)');
        }
        const start = Object.assign({}, assign(TANKS, [pl('NW', 15, 0.8), pl('NW', 15, -0.8)]), assign(['H1', 'H2'], [pl('S', 15, 0.8), pl('S', 15, -0.8)]),
          assign(DPS, clump([], pl('SE', 15, 0), 4, onPlat('SE'), { gap: 0.6 })));
        pref(begin(castOf(ev, 3)), start);
        pref(t + 3.8, spots);
        check({ t: tt, kind: 'stack', groups, r: 2.5, dmg: 0.35, fail: 0.8, name: 'Prowling Gale', spots });
        for (const [a, b, close] of [[closeT, dCT, true], [farT, dFT, false], [closeH, dCH, true], [farH, dFH, false]]) {
          for (const [s, o] of [[a, b], [b, a]]) {
            debuff(s, close ? 'lamentClose' : 'lamentDistant', close ? 'Lament of the Close' : 'Lament of the Distant', `stay ${close ? 'close to' : 'far from'} ${o}`, t + 3.7, tt);
            call(t + 3.7, `${close ? 'Close' : 'Far'} tether on YOU: tower ${Object.keys(tw).find(k => tw[k].includes(s))}`, { slot: s, alert: true, dur: 6 });
          }
        }
        end(tt + 0.3);

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
          h.hits.forEach(x => {
            check({ t: x.t, kind: 'stack', groups: [h.soak], slots: h.soak, r: 8, dmg: 0.07, fail: 0.4, name: 'Howling Eight', spots: h.spots });
            if (h.rest.length) check({ t: x.t, kind: 'spot', spots: Object.fromEntries(h.rest.map(s => [s, h.spots[s]])), r: 5, fail: 0.6, name: 'Howling Eight' });
          });
          mark(castOf(h.e, 5), h.last, { shape: 'circle', at: plat(h.here), r: 8 }, 'rgba(120,200,255,0.18)');
          const what = k === 0 || k === 4 ? 'party stack' : k === 2 ? 'the tanks share' : `${h.soak[0]} invuln`;
          call(castOf(h.e, 5), `Howling Eight on ${h.here}: ${what}`, { alert: true, dur: 8 });
          if (h.cleaver) {
            hz({ t: h.cleaver.t, tell: h.cleaver.t - 4, shape: 'circle', at: plat(h.here), r: 8, dmg: 1.5, name: 'Mooncleaver' });
            linger({ shape: 'circle', at: plat(h.here), r: 8 }, h.cleaver.t + 2.5, 1036, 'Mooncleaver (the platform is gone)', 2.5);
            call(h.cleaver.t - 4, 'Change platform', { alert: true, dur: 4 });
          }
        });
        hold = info[info.length - 1].last + 0.05;
      }
    });
    return P;
  }

  B.FIGHT_SCRIPTS = B.FIGHT_SCRIPTS || {};
  B.FIGHT_SCRIPTS.m8s = {
    // FFLogs' max HP in an M8S kill: Howling Blade 67,582,753 in phase 1 and 72,751,588 in phase 2, and the two wolves
    // of Tactical Pack 10,518,438 each, all in the one pool the sim has (the boss stands in for the adds while
    // they're up, and the timeline can't jump to phase 2 when phase 1's HP runs out).
    hp: 161371217,
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
