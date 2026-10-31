// M11S, AAC Heavyweight M3 (Savage): The Tyrant's mechanics for the sim's party, on cactbot's timeline, and the strats
// wtfdig.info lists for them: Hector (Toxic/No Buddies), its default, USB + WdZ + Fixed and Toxic Friends. They share
// everything but two of wtfdig's toggles: the Arena Split (Hector's, Honeyburger's or Toxic's congas and puddle routes)
// and Ecliptic Stampede (Toxic's towers or the Fixed one). Spots are [east, north] yalms from the arena's middle.
//
// The mechanics follow BossMod's module for the fight (github.com/awgil/ffxiv_bossmod, RM11STheTyrant), whose shapes
// and sizes come from the game's Action sheet, built with the sim's toolkit (js/mech.js):
//   - Crown of Arcadia (raidwides). Raw Steel Trophy, axe or scythe first (the other later): the tanks share a 6-yalm
//     buster and the rest spread (6), or 90-degree cleaves at both tanks and a 45-degree cone stack for the rest.
//   - Trophy Weapons: an axe, a sword and a scythe round the arena; Assault Evolved leaps him to each in turn, clockwise
//     from the one he faces: the axe an 8-yalm circle and a party stack (6) away from it, the sword a 10-wide cross and
//     two 6-wide line stacks from it at the healers (light parties behind its diagonals), the scythe a donut from 5 and
//     30-degree proteans from it at everyone (clock spots 3.5 out, by his facing).
//   - Void Stardust: three rounds of 6-yalm puddles at everyone (north, then clockwise), then Comet (everyone spreads,
//     6) or Crushing Comet (a party stack); the other after the second weapons.
//   - Dance of Domination: six small raidwides and a big one, then six 10-wide Explosion lines (the two sides, the
//     middle, one edge and the diagonals, turned any of four ways) and Eye of the Hurricane's partner stacks in the gaps.
//   - Charybdistopia (to 1 HP, here a heavy raidwide); Ultimate Trophy Weapons: six weapons in the order they spawn,
//     then four Maelstroms (4-yalm voidzones) whose Powerful Gusts are 90-degree cones at the two nearest each; One and
//     Only.
//   - Great Wall of Fire: two 6-wide line busters the tanks share (Fire Resistance Down), each line exploding later
//     where it went. Orbital Omen: 10-wide lines from the north and east portals, a column and a row at a time, with
//     Fire and Fury's front and back cones (stand at his flank, then in the first lines' crossing).
//   - Meteorain: Cosmic Kiss meteors baited by the two nearest (melee, healers, ranged), Fearsome Fireball's line stacks
//     (the first shared, tanks in front; the rest blocked by a meteor the party hides behind, which explodes, 8 yalms),
//     Foregone Fatality's tethers to the tanks, and Triple Tyrannhilation: three shockwaves, line of sight behind the
//     three meteors lined up south-west (each breaks the nearest).
//   - Flatliner: a 15-yalm knockback to the sides as the floor splits into two 20 x 40 platforms 12 apart (falling
//     between is a KO). Majestic Meteor: 2-player towers knocking their soakers 23 yalms (across or along), tethers from
//     portals off the arena held stretched (48) to the far corners (Meteowrath, 10-wide lines), Fire Breath (6-wide)
//     at a player on each platform, three rounds of 6-yalm puddles at everyone and Majestic Meteorain's 10-wide lanes;
//     twice. Massive Meteor's five-hit light-party stacks; a third set of towers carries everyone to the platform
//     Arcadion Avalanche spares, then half of that one goes; Crown of Arcadia brings the square back.
//   - Ecliptic Stampede: two proximity Mammoth Meteors at opposite corners, Atomic Impact on two (six 5-yalm drops at
//     the walls, each leaving a fire puddle), six 6-yalm puddles under the boss group, tank and pair towers, four
//     tethers from portals at the cardinals stretched across and clockwise, then Two-way (two lines of four) or Four-way
//     Fireball (four of two), line stacks at the nearest.
//   - Heartbreak Kick: a tower under him that all eight soak, five, six and seven hits; then Heartbreaker, the enrage.
// Simplified: where weapons, towers and portals stand that BossMod doesn't fix (weapons 10 out, towers at the platform
// quadrants or 10 out, Maelstroms at the intercards) is this script's choice; Foregone Fatality's tethers run from him;
// a meteor dropped too near another doesn't explode; Charybdistopia doesn't set HP to 1.
(function (B) {
  const S = B.SLOTS;
  const all = (f) => Object.fromEntries(S.map(s => [s, f(s)]));
  const at = B.bearing;
  const inside = B.mechInside;
  const add = (a, b) => [a[0] + b[0], a[1] + b[1]];
  const sub = (a, b) => [a[0] - b[0], a[1] - b[1]];
  const mul = (a, k) => [a[0] * k, a[1] * k];
  const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);
  const unit = (v) => { const l = Math.hypot(v[0], v[1]) || 1; return [v[0] / l, v[1] / l]; };
  const deg360 = (d) => ((d % 360) + 360) % 360;
  const brg = (p) => deg360(Math.atan2(p[0], p[1]) * 180 / Math.PI);
  const brgFrom = (a, b) => brg(sub(b, a));
  const pick = (a) => a[Math.floor(Math.random() * a.length)];
  const shuffle = (a) => { const b = a.slice(); for (let i = b.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [b[i], b[j]] = [b[j], b[i]]; } return b; };
  const sgn = (v) => (v < 0 ? -1 : 1);
  // A point turned clockwise (as bearings go) by deg about the middle.
  const rot = (p, deg) => { const a = deg * Math.PI / 180, c = Math.cos(a), s = Math.sin(a); return [p[0] * c + p[1] * s, -p[0] * s + p[1] * c]; };
  const TANKS = ['MT', 'OT'], NT = S.filter(s => !TANKS.includes(s));
  const HR = ['H1', 'H2', 'R1', 'R2'];
  const COMPASS = ['north', 'north-northeast', 'northeast', 'east-northeast', 'east', 'east-southeast', 'southeast', 'south-southeast',
    'south', 'south-southwest', 'southwest', 'west-southwest', 'west', 'west-northwest', 'northwest', 'north-northwest'];
  const dirName = (deg) => COMPASS[Math.round(deg360(deg) / 22.5) % 16];
  const DIR8 = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
  const dir8 = (deg) => DIR8[Math.round(deg360(deg) / 45) % 8];
  // wtfdig's arena pictures (0-100 across, the 40-yalm square from about 5 to 95).
  const W = (x, y) => [+((x - 50) * 0.45).toFixed(2), +((50 - y) * 0.45).toFixed(2)];

  // ---------- the floor ----------
  const onSq = (p) => Math.abs(p[0]) <= 19.2 && Math.abs(p[1]) <= 19.2;
  // The split: two platforms, 6 to 26 yalms out east and west, 40 long.
  const SG = { W: -1, E: 1 };
  const sideOf = (p) => (p[0] < 0 ? 'W' : 'E');
  const onPlat = (side) => (p) => p[0] * SG[side] >= 6.8 && p[0] * SG[side] <= 25.2 && Math.abs(p[1]) <= 19.2;
  const platRect = (side) => ({ shape: 'rect', a: [SG[side] * 6, -20], b: [SG[side] * 26, 20] });

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
  const line = (a, deg, len, w) => ({ shape: 'line', at: a, deg, len, w });

  // ---------- the party's places ----------
  // Uptime: the tanks at his front (he faces the main tank, north), everyone else at his back (his hitbox is 5).
  const UP = { MT: [-0.8, 6.3], OT: [1.4, 6.1], M1: [-3.5, -4.7], M2: [3.5, -4.7], H1: [-2, -5.7], H2: [2, -5.7], R1: [-0.9, -6.4], R2: [0.9, -6.4] };
  // Proteans by the clock, from the facing (BossMod's PF standard spots, wtfdig's Toxic: T1 N, T2 S, H1 W, H2 E...).
  const CLOCK = { MT: 0, R2: 1, H2: 2, M2: 3, OT: 4, M1: 5, H1: 6, R1: 7 };
  const LP1 = ['H1', 'MT', 'M1', 'R1'], LP2 = ['H2', 'OT', 'M2', 'R2'];

  // Each strat's toggles (wtfdig: Arena Split and Ecliptic).
  const STRATS = {
    hector: { split: 'hector', ecliptic: 'toxic' },
    usbwdz: { split: 'wdz', ecliptic: 'fixed' },
    toxic: { split: 'toxic', ecliptic: 'toxic' },
  };
  // The Arena Split's conga, north to south on each platform (G1 west, G2 east): Hector's tanks and ranged north,
  // healers and melee south; Honeyburger's supports north-west and south-east, DPS south-west and north-east; Toxic's
  // (its picture gives no order) tanks and melee north.
  const CONGA = {
    hector: { W: ['MT', 'R1', 'H1', 'M1'], E: ['OT', 'R2', 'H2', 'M2'] },
    wdz: { W: ['MT', 'H1', 'R1', 'M1'], E: ['R2', 'M2', 'H2', 'OT'] },
    toxic: { W: ['MT', 'M1', 'H1', 'R1'], E: ['OT', 'M2', 'H2', 'R2'] },
  };
  // The portals the Meteowrath tethers come from (cactbot's two patterns), off the platforms' ends.
  const PORTALS = { 1: [[-31, 15], [31, 5], [31, -5], [-31, -15]], 2: [[31, 15], [-31, 5], [-31, -5], [31, -15]] };
  // Majestic Meteorain's lanes (BossMod's map effects): pattern 1 the west inner and east outer, 2 the others.
  const LANES = { 1: [-11, 21], 2: [-21, 11] };
  const TOWERS = { W: [[-14, 8], [-14, -8]], E: [[14, 8], [14, -8]] };

  // cactbot's timeline branches (axe or scythe first, comet or crush first) as the game plays them, should the map's
  // events still be at their file seconds (tools/export_map.py reads the branches flat).
  const SEGS = [[0, 15.7, 0], [115.7, 184.9, 100], [284.9, 317.2, 200], [517.2, 573.9, 400], [1173.9, Infinity, 1000]];
  function linearize(events) {
    if (!events.some(e => e.t > 1000)) return;
    const out = [];
    for (const e of events) {
      const s = SEGS.find(([a, b]) => e.t >= a && e.t < b);
      if (s) out.push(Object.assign({}, e, { t: +(e.t - s[2]).toFixed(1) }));
    }
    out.sort((a, b) => a.t - b.t);
    events.splice(0, events.length, ...out);
    const enrage = Math.max(...out.filter(e => e.kind === 'enrage').map(e => e.t), 600);
    for (const d of [B.GAME_MAPS && B.GAME_MAPS.m11s && B.GAME_MAPS.m11s.fight, B.app && B.app.fight && B.app.fight.data]) if (d && d.enrage > 1000) d.enrage = enrage;
  }

  // ---------- the pull ----------
  function plan(events, strat) {
    linearize(events);
    const st = STRATS[strat] || STRATS.hector;
    const P = { start: Object.assign({}, UP), prefs: [], hazards: [], checks: [], calls: [], marks: [], labels: new Map(), debuffs: [],
      boss: [{ t: 0, at: [0, 0] }], hitbox: [{ t: 0, r: 5 }] };
    let id = 0, hold = -1;
    const hz = (o) => { const h = Object.assign({ id: ++id, react: 3 }, o); P.hazards.push(h); return h; };
    const pref = (t, spots) => P.prefs.push({ t, spots });
    const call = (t, text, o) => P.calls.push(Object.assign({ t, text }, o));
    const check = (o) => P.checks.push(o);
    const debuff = (slot, name, hint, t0, t1, key) => P.debuffs.push({ slot, key, name, hint, t0, t1 });
    const find = (name, t0, t1) => events.find(e => e.name === name && e.t >= t0 && e.t <= t1) || null;
    const tOf = (name, t0, t1, d) => { const e = find(name, t0, t1); return e ? e.t : d; };
    const label = (e, text) => { if (e) P.labels.set(e, text); };
    // A mechanic's spots start no earlier than the last one's are done with, and it ends by sending everyone home.
    const begin = (t0) => Math.max(t0, hold + 0.05);
    const end = (t1, spots) => { pref(t1, spots || UP); hold = t1; };
    const raid = (t, dmg, name, cast) => hz({ t, tell: t - (cast || 4), raidwide: true, dmg, name });
    const bossTo = (t, p, move) => P.boss.push({ t, at: p, move });
    const mark = (shape, t0, t1, fill) => P.marks.push(Object.assign({ kind: 'lit', t0, t1, fill }, shape));
    let arenas = [{ t: 0, shape: 'square', half: 20 }];

    // ===== Crown of Arcadia =====
    for (const e of events.filter(x => x.name === 'Crown of Arcadia')) {
      raid(e.t, 0.45, 'Crown of Arcadia', 5);
      call(e.t - 5, 'Raidwide', { dur: 4 });
    }

    // ===== Raw Steel Trophy: axe or scythe =====
    const axeFirst = Math.random() < 0.5;
    function rawSteel(e, axe, follow, d) {
      const t0 = e ? e.t : d, cs = t0 - 2, tTank = axe ? t0 + 6.3 : t0 + 7.4, tParty = t0 + 7.4;
      label(e, `Raw Steel Trophy (${axe ? 'Axe' : 'Scythe'})`);
      follow.forEach((f, k) => label(f, axe ? ['Raw Steel (tanks)', 'Impact x6'][k] || 'Impact x6' : ['Raw Steel x2', 'Heavy Hitter'][k] || 'Heavy Hitter'));
      if (axe) {
        // The tanks share a buster at his front; the rest spread (wtfdig: melee max melee south-west and south-east,
        // ranged far west-south-west and east-south-east, healers far south).
        const spots = { MT: [-0.6, 6.4], OT: [0.6, 6.4], M1: [-3.6, -5.6], M2: [3.6, -5.6], R1: W(26.7, 69.1), R2: W(72.7, 69.1), H1: W(41.1, 84.8), H2: W(59.1, 84.9) };
        spots.R1[0] -= 0.5; spots.R2[0] += 0.5; spots.H1[0] -= 0.4; spots.H2[0] += 0.4;
        pref(begin(cs + 0.5), spots);
        hz({ t: tTank, tell: cs + 2, effect: 'share', shape: 'circle', r: 6, from: 'target', targets: ['MT'], min: 2, max: 2, dmg: 0.5, name: 'Raw Steel' });
        hz({ t: tParty, tell: cs + 2, effect: 'bait', shape: 'circle', r: 6, from: 'target', targets: NT, dmg: 0.9, own: 0.3, name: 'Impact' });
        call(cs, 'Party Spread / Tanks Stack', { alert: true, dur: 7 });
      } else {
        // Cleaves at both tanks (north-west and north-east); the party's cone stack south.
        const on = pick(NT), rest = NT.filter(s => s !== on);
        const spots = Object.assign({ MT: [-3.3, 5.6], OT: [3.3, 5.6], [on]: [0, -7.4] }, assign(rest, [[-1.2, -6.8], [1.2, -6.8], [-1.6, -8.4], [1.6, -8.4], [0, -9.4]]));
        pref(begin(cs + 0.5), spots);
        hz({ t: tParty, tell: cs + 2, effect: 'bait', shape: 'cone', from: 'boss', aim: 'target', targets: TANKS, half: 45, r: 60, dmg: 1.2, own: 0.5, buster: true, name: 'Raw Steel' });
        hz({ t: tParty, tell: cs + 2, effect: 'share', shape: 'cone', from: 'boss', aim: 'target', targets: [on], half: 22.5, r: 60, min: 6, max: 6, dmg: 0.35, name: 'Heavy Hitter' });
        call(cs, 'Party Stack / Tank Cleaves', { alert: true, dur: 7 });
      }
      end(tParty + 0.3);
    }
    const rs1 = find('Raw Steel Trophy Axe', 10, 30) || find('Raw Steel Trophy Scythe', 10, 30);
    const rs2 = find('Raw Steel Trophy Scythe', 140, 170) || find('Raw Steel Trophy Axe', 140, 170);
    const after = (e, n, within) => (e ? events.filter(x => x.t > e.t && x.t <= e.t + within && !x.cast).slice(0, n) : []);
    rawSteel(rs1, axeFirst, after(rs1, 3, 8), 17.7);

    // ===== the weapons =====
    const NAME = { axe: 'Heavy Weight', sword: 'Sharp Taste', scythe: 'Sweeping Victory' };
    const CALL = { axe: 'Stack Middle', sword: 'Healer Groups', scythe: 'Protean' };
    // One weapon's resolution: w where it lies, face his facing as he lands (from where he was), tb its bait, ta its
    // shape. Returns the party's spots for it.
    function weapon(kind, w, face, tb, ta, tell) {
      if (kind === 'axe') {
        const aoe = { shape: 'circle', at: w, r: 8 };
        hz(Object.assign({ t: ta, tell, dmg: 1.3, name: 'Assault Evolved' }, aoe));
        const on = pick(NT);
        hz({ t: tb, tell, effect: 'share', shape: 'circle', r: 6, from: 'target', targets: [on], min: 6, max: 8, dmg: 0.3, name: NAME.axe });
        // The party stack 10 from it toward the middle (BossMod's spot).
        const want = add(w, mul(unit(mul(w, -1)), 10));
        return assign([on, ...S.filter(s => s !== on)], clump([aoe], want, 8, onSq, { gap: 0.5 }));
      }
      if (kind === 'scythe') {
        hz({ t: ta, tell, shape: 'donut', at: w, r0: 5, dmg: 1.3, name: 'Assault Evolved' });
        hz({ t: tb, tell, effect: 'bait', shape: 'cone', from: w, aim: 'target', targets: S, half: 15, r: 60, dmg: 0.9, own: 0.25, name: NAME.scythe });
        return all(s => add(w, at(face + 45 * CLOCK[s], 3.5)));
      }
      // The sword: a cross along his facing; the light parties line up behind its diagonals (LP1 back-left as he
      // faces, LP2 back-right), each healer's line stack shared with theirs.
      const aoe = { shape: 'cross', at: w, deg: face, len: 40, w: 10 };
      hz(Object.assign({ t: ta, tell, dmg: 1.3, name: 'Assault Evolved' }, aoe));
      hz({ t: tb, tell, effect: 'share', shape: 'line', from: w, aim: 'target', targets: ['H1', 'H2'], len: 60, w: 6, min: 4, max: 4, dmg: 0.35, name: NAME.sword });
      const spots = {};
      for (const [lp, d] of [[LP1, face - 135], [LP2, face + 135]]) {
        let far = 9;
        while (far < 16 && onSq(add(w, at(d, far + 0.4)))) far += 0.4;
        const ds = far >= 12 ? [10, 9.2, 11, 12] : [far - 1.2, far - 1.8, far - 0.6, far];
        lp.forEach((s, k) => { spots[s] = add(w, at(d, Math.max(8.9, ds[k]))); });
        if (!lp.every(s => onSq(spots[s]))) Object.assign(spots, assign(lp, clump([aoe], add(w, at(d, 9.5)), 4, onSq, { gap: 0.5 })));
      }
      return spots;
    }
    // A set of weapons: each its kind, where it lies and the times (the leap, the bait, the shape); spots from `from`.
    function weaponSet(list, from) {
      let prev = [0, 0];
      const spots = [];
      list.forEach((x, k) => {
        x.face = brgFrom(prev, x.at);
        bossTo(x.tj, x.at);
        spots.push(weapon(x.kind, x.at, x.face, x.tb, x.ta, k ? list[k - 1].ta : x.tell));
        label(x.evB, NAME[x.kind]);
        label(x.evA, `Assault Evolved (${x.kind[0].toUpperCase() + x.kind.slice(1)})`);
        prev = x.at;
      });
      list.forEach((x, k) => pref(k ? list[k - 1].ta + 0.05 : begin(from), spots[k]));
      return list[list.length - 1].ta;
    }
    // Three weapons 120 degrees apart, 10 out, taken clockwise from the first (the one he faces).
    function threeWeapons(tSpawn, tCast) {
      const b0 = pick([0, 45, 90, 135, 180, 225, 270, 315]), kinds = shuffle(['axe', 'sword', 'scythe']);
      const ae = find('Assault Evolved', tCast - 1, tCast + 1), t0 = ae ? ae.t : tCast;
      return kinds.map((kind, k) => {
        const evB = find(`Weapon ${k + 1}`, t0, t0 + 15), evA = find(`Assault Evolved ${k + 1}`, t0, t0 + 15);
        const tb = evB ? evB.t : t0 + 2.1 + 5.1 * k, ta = evA ? evA.t : tb + 0.1;
        return { kind, at: at(b0 + 120 * k, 10), tj: tb - 1.9, tb, ta, evB, evA, tell: t0 - 6 };
      });
    }
    const tw1 = tOf('Trophy Weapons', 30, 45, 38.4), set1 = threeWeapons(tw1, tOf('Assault Evolved', 44, 52, 48.2));
    call(tw1, set1.map(x => CALL[x.kind]).join(' => '), { alert: true, dur: 10 });
    const done1 = weaponSet(set1, set1[0].tell + 0.5);
    bossTo(done1 + 7, [0, 0]);
    end(done1 + 0.1);

    // ===== Void Stardust =====
    const cometFirst = Math.random() < 0.5;          // Comet (spreads) first, Crushing Comet (a stack) after; or the reverse
    const tVoid = tOf('Void Stardust', 75, 85, 79.8);
    function cometites(tLand0, spread, ev) {
      // Three puddles at everyone, 2 s apart, starting north and going clockwise; then the spread or the stack.
      const lands = [0, 2, 4].map(k => tLand0 + k), locks = lands.map(t => t - 3);
      lands.forEach(t => hz({ t, tell: t - 3.5, shape: 'circle', r: 6, from: 'target', targets: S, snap: 3, dmg: 0.9, name: 'Cometite', react: 2.5 }));
      locks.forEach((t, k) => pref(k ? locks[k - 1] + 0.05 : begin(t - 3), assign(S, clump([], at(50 * k, 12), 8, onSq, { gap: 0.5 }))));
      const tc = ev ? ev.t : tLand0 + 6;
      label(ev, spread ? 'Comet' : 'Crushing Comet');
      if (spread) {
        hz({ t: tc, tell: tc - 5, effect: 'bait', shape: 'circle', r: 6, from: 'target', targets: S, dmg: 0.9, own: 0.25, name: 'Comet' });
        pref(locks[2] + 0.05, all(s => at(45 * CLOCK[s], 9.6)));
      } else {
        const on = pick(NT);
        hz({ t: tc, tell: tc - 5, effect: 'share', shape: 'circle', r: 6, from: 'target', targets: [on], min: 6, max: 8, dmg: 0.3, name: 'Crushing Comet' });
        pref(locks[2] + 0.05, assign([on, ...S.filter(s => s !== on)], clump([], [0, -2], 8, onSq, { gap: 0.5 })));
      }
      call(locks[0] - 1, `Bait 3x puddles => ${spread ? 'Spread' : 'Stack'}`, { alert: true, dur: 8 });
      return tc;
    }
    const tw2 = tOf('Trophy Weapons', 65, 78, 72.7), set2 = threeWeapons(tw2, tOf('Assault Evolved', 88, 96, 92.7));
    call(tw2, `${dirName(brg(set2[0].at))}: ${CALL[set2[0].kind]} (1st later)`, { dur: 6 });
    const c1 = cometites(tVoid + 4.1, cometFirst, find(cometFirst ? 'Comet' : 'Crushing Comet', 85, 95) || find('Comet', 85, 95) || find('Crushing Comet', 85, 95));
    hold = c1 + 0.05;
    call(c1 + 0.5, set2.map(x => CALL[x.kind]).join(' => '), { alert: true, dur: 8 });
    const done2 = weaponSet(set2, c1 + 0.1);
    hold = done2 + 0.05;
    const c2ev = find(cometFirst ? 'Crushing Comet' : 'Comet', 110, 120) || find('Comet', 110, 120) || find('Crushing Comet', 110, 120);
    const c2 = cometites(tOf('Cometite 1', 106, 114, 110.2), !cometFirst, c2ev);
    end(c2 + 0.3);
    bossTo(tOf('Dance of Domination Trophy', 125, 140, 134.6) - 4.2, [0, 0]);

    // ===== Dance of Domination =====
    const tDoD = tOf('Dance of Domination Trophy', 125, 140, 134.6);
    events.filter(e => /^Dance of Domination \d$/.test(e.name) && e.t > tDoD && e.t < tDoD + 15).forEach(e => {
      const last = e.name.endsWith(' 7');
      raid(e.t, last ? 0.35 : 0.06, 'Dance of Domination', last ? 1.1 : 0.6);
    });
    call(tDoD + 1.7, 'AoE x6 => Big AoE', { dur: 5 });
    {
      // Six 10-wide lines: the open side (here south) has none; the middle, both sides, the far edge and the two
      // diagonals. Pairs in the gaps: tanks and melee mid east and west, healers and ranged out on the open side.
      const tEx = tOf('Explosion', tDoD + 12, tDoD + 20, tDoD + 16.1), tEye = tOf('Eye of the Hurricane', tDoD + 12, tDoD + 20, tDoD + 15.9);
      const R = pick([0, 90, 180, 270]);
      const base = [line([-20, 15], 90, 40, 10), line([-15, 20], 180, 40, 10), line([15, 20], 180, 40, 10), line([0, 20], 180, 40, 10),
        line([-20, 20], 135, 56.6, 10), line([20, 20], 225, 56.6, 10)];
      base.forEach(h => hz(Object.assign({ t: tEx, tell: tEx - 5, dmg: 1.4, name: 'Explosion' }, h, { at: rot(h.at, R), deg: h.deg + R })));
      const pairs = { MT: [-9, 0.5], M1: [-9, -0.5], OT: [9, 0.5], M2: [9, -0.5], H1: [-6.8, -15.8], R1: [-6.8, -16.8], H2: [6.8, -15.8], R2: [6.8, -16.8] };
      pref(begin(tEye - 4.9), all(s => rot(pairs[s], R)));
      const on = Math.random() < 0.5 ? ['MT', 'OT', 'H1', 'H2'] : ['M1', 'M2', 'R1', 'R2'];
      hz({ t: tEye, tell: tEye - 5, effect: 'share', shape: 'circle', r: 6, from: 'target', targets: on, min: 2, max: 2, dmg: 0.35, name: 'Eye of the Hurricane' });
      const open = deg360(180 + R), mid = open % 180 === 0 ? 'E/W' : 'N/S';
      call(tEye - 4.9, `${mid} Mid / ${dir8(open)} Outer + Partner Stacks`, { alert: true, dur: 5 });
      end(tEx + 0.2);
    }
    rawSteel(rs2, !axeFirst, after(rs2, 2, 9), 156.4);

    // ===== Charybdistopia, Ultimate Trophy Weapons =====
    const tCh = tOf('Charybdistopia', 170, 185, 178.9);
    raid(tCh, 0.55, 'Charybdistopia', 5);
    call(tCh - 5, 'HP to 1 + AoE', { alert: true, dur: 5 });
    const tUtw = tOf('Ultimate Trophy Weapons', 180, 190, 184.6);
    {
      // Six weapons, one every 4 s, each 10 out a quarter or three-eighths round from the last; he takes them in turn.
      const kinds = shuffle(['axe', 'axe', 'sword', 'sword', 'scythe', 'scythe']);
      let b = pick([0, 45, 90, 135, 180, 225, 270, 315]);
      const list = kinds.map((kind, k) => {
        if (k) b = deg360(b + pick([90, 135, -90, -135]));
        const evB = find(`Weapon ${k + 1}`, tUtw, tUtw + 40), evA = find(`Assault Evolved ${k + 1}`, tUtw, tUtw + 40);
        const tb = evB ? evB.t : tUtw + 9.9 + 5.1 * k, ta = evA ? evA.t : tb + 0.1;
        return { kind, at: at(b, 10), tj: tb - 1.9, tb, ta, evB, evA, tell: tUtw + 1.3 + 4 * k };
      });
      list.forEach((x, k) => call(x.tell, CALL[x.kind] + (k === 5 ? ' => Bait Gust' : k >= 2 && x.kind !== 'axe' ? ' => Move' : ''), { dur: 5 }));
      const done = weaponSet(list, tUtw + 1.5);
      bossTo(done + 1.1, [0, 0]);
      // Four Maelstroms (4-yalm voidzones) at the intercards, 8 out; each one's Powerful Gust a 90-degree cone at the
      // two nearest: those two stand just outside it 110 degrees apart, pointing it out to the walls.
      const tGust = tOf('Powerful Gust', done, done + 10, done + 6.2), tOne = tOf('One and Only', tGust, tGust + 20, tGust + 14.1);
      const maels = [45, 135, 225, 315].map(d => at(d, 8));
      const zones = maels.map(m => ({ shape: 'circle', at: m, r: 4 }));
      zones.forEach(z => hz(Object.assign({ t: done + 2.4, tell: done + 0.1, dmg: 0.4, lasts: tOne - done - 2.4, tick: 1, tickDmg: 0.4, react: 1.5, name: 'Maelstrom' }, z)));
      const PAIRS = { 315: ['MT', 'R1'], 45: ['OT', 'R2'], 135: ['M2', 'H2'], 225: ['M1', 'H1'] };
      const gust = {};
      maels.forEach((m, k) => {
        const d = [45, 135, 225, 315][k], [a, c] = PAIRS[d];
        gust[a] = add(m, at(d - 55, 5.4)); gust[c] = add(m, at(d + 55, 5.4));
        hz({ t: tGust, tell: done + 0.1, effect: 'bait', shape: 'cone', from: m, aim: 'target', targets: [a, c], half: 45, r: 60, dmg: 0.9, own: 0.3, name: 'Powerful Gust' });
      });
      pref(done + 0.05, gust);
      call(done + 0.2, 'Bait Gust: by your tornado, outside', { alert: true, dur: 6 });
      end(tGust + 0.2, all(s => clump(zones, UP[s], 1, onSq)[0]));
      raid(tOne, 0.55, 'One and Only', 9);
      call(tOne - 6, 'Big AoE', { dur: 5 });
      end(tOne + 0.2);
    }

    // ===== Great Wall of Fire: two line busters the tanks share, each exploding later where it went =====
    function wallOfFire(tc) {
      const t1 = tOf('Great Wall of Fire 1', tc - 1, tc + 2, tc + 0.2), t2 = tOf('Great Wall of Fire 2', tc + 2, tc + 6, tc + 3.4);
      const e1 = tOf('Explosion 1', tc + 2, tc + 6, tc + 4), e2 = tOf('Explosion 2', tc + 5, tc + 9, tc + 7.2);
      const party = assign(NT, clump([], [0, -7.2], 6, onSq, { gap: 0.6 }));
      pref(begin(tc - 4.5), Object.assign({ MT: at(0, 6.3), OT: at(0, 8.2) }, party));
      pref(t1 + 0.05, { MT: at(45, 6.3), OT: at(45, 8.2) });
      [[t1, e1], [t2, e2]].forEach(([t, e]) => {
        hz({ t, tell: tc - 5, effect: 'share', shape: 'line', from: 'boss', aim: 'target', targets: ['MT'], len: 60, w: 6, min: 2, max: 2, dmg: 0.45, status: ['fireResistDown', 20], name: 'Great Wall of Fire' });
        hz({ t: e, tell: t, shape: 'line', from: 'boss', aim: 'target', targets: ['MT'], snap: e - t, len: 60, w: 6, dmg: 1.3, name: 'Explosion' });
      });
      call(tc - 5, 'Shared line tankbuster x2 (then the lines explode)', { alert: true, dur: 5 });
      for (const s of TANKS) call(tc - 5, 'Line buster: both tanks in front, then 45 clockwise', { slot: s, alert: true, dur: 5 });
      end(e2 + 0.2, UP);
    }
    // ===== Orbital Omen with Fire and Fury =====
    function orbital(tc) {
      const F = tOf('Fire and Fury', tc + 8, tc + 12, tc + 9.7);
      const waves = [1, 2, 3, 4].map((k, i) => tOf(`Orbital Omen ${k}`, tc + 7, tc + 16, tc + [9.1, 10.7, 12.3, 13.7][i]));
      // 10-wide lanes: columns from the north portals, rows from the east. The first wave fires the column beside the
      // flank and a middle row; the party waits at the flank next to that crossing, then steps into it (no lane fires
      // twice).
      const side = pick([1, -1]), rp = pick([1, 2]), r1 = 3 - rp;
      const cIn = side > 0 ? 2 : 1;
      const cols = [cIn, ...shuffle([0, 1, 2, 3].filter(c => c !== cIn))], rows = [r1, ...shuffle([0, 1, 2, 3].filter(r => r !== r1))];
      const Ec = (c) => -15 + 10 * c, Nr = (r) => -15 + 10 * r;
      waves.forEach((t, k) => {
        hz(Object.assign({ t, tell: t - 6, dmg: 1.4, name: 'Orbital Omen', react: 1.5 }, line([Ec(cols[k]), 20], 180, 40, 10)));
        hz(Object.assign({ t, tell: t - 6, dmg: 1.4, name: 'Orbital Omen', react: 1.5 }, line([20, Nr(rows[k])], 270, 40, 10)));
      });
      hz({ t: F, tell: F - 5, shape: 'cone', at: [0, 0], deg: 0, half: 45, r: 60, dmg: 1.4, name: 'Fire and Fury' });
      hz({ t: F, tell: F - 5, shape: 'cone', at: [0, 0], deg: 180, half: 45, r: 60, dmg: 1.4, name: 'Fire and Fury' });
      const wait = assign(S, clump([], [side * 13.5, sgn(Nr(rp)) * 3], 8, onSq, { gap: 0.5 }));
      const cross = assign(S, clump([], [side * 8.3, sgn(Nr(r1)) * 2.3], 8, onSq, { gap: 0.5 }));
      pref(begin(tc + 0.1), Object.assign({}, wait, { MT: [0, 6.3] }));
      pref(F - 5, wait);
      pref(waves[0] + 0.05, cross);
      call(tc, 'Tanks: point him north', { dur: 4 });
      call(F - 5, `Go sides (${side > 0 ? 'east' : 'west'}), then into the first lines' crossing`, { alert: true, dur: 6 });
      end(waves[3] + 0.2, UP);
    }
    wallOfFire(tOf('Great Wall of Fire (castbar)', 245, 260, 252.6));
    orbital(tOf('Orbital Omen (castbar)', 260, 272, 266.1));

    // ===== Meteorain =====
    {
      const tM = tOf('Meteorain', 285, 300, 292.1);
      const ffb = events.filter(e => e.name === 'Fearsome Fireball' && e.t > tM && e.t < tM + 45).map(e => e.t);
      const ck = events.filter(e => e.name === 'Cosmic Kiss' && e.t > tM && e.t < tM + 35).map(e => e.t);
      const ff = events.filter(e => e.name === 'Foregone Fatality' && e.t > tM && e.t < tM + 45).map(e => e.t);
      const ex = events.filter(e => e.name === 'Explosion' && e.t > tM + 15 && e.t < tM + 45).map(e => e.t);
      const tTT = tOf('Triple Tyrannhilation', tM + 40, tM + 60, tM + 50.8);
      const waves = events.filter(e => e.name === 'Shockwave' && e.t > tTT - 1 && e.t < tTT + 8).map(e => e.t);
      const F = (k, d) => (ffb[k] !== undefined ? ffb[k] : d), K = (k, d) => (ck[k] !== undefined ? ck[k] : d);
      // Where the meteors land: north-east and north-west by him, and three lined up south-west, 6.4 apart.
      const NE = at(30, 6.6), NW = at(330, 6.6), SW = [6.6, 13, 19.4].map(r => at(225, r));
      const behind = (c, n, r0) => clump([], add(c, mul(unit(c), r0 || 3.4)), n, onSq, { gap: 0.5 });
      // The first set: the melee close for the markers; the rest stacked north-west for the first line, tanks in front.
      const mk1 = tM + 1.1;
      const lineTo = pick(HR);
      pref(begin(tM - 3), Object.assign(assign(['MT', 'OT'], [at(318, 5.7), at(322, 6.9)]), assign(HR, clump([], at(320, 9.2), 4, onSq, { gap: 0.5 })),
        { M1: at(30, 5.3), M2: at(225, 5.3) }));
      pref(mk1 + 0.5, { M1: NE, M2: SW[0] });
      hz({ t: F(0, tM + 8), tell: F(0, tM + 8) - 5, effect: 'share', shape: 'line', from: 'boss', aim: 'target', targets: [lineTo], len: 60, w: 6, min: 6, max: 6, dmg: 0.3, name: 'Fearsome Fireball' });
      call(F(0, tM + 8) - 5, 'Wild Charge (behind tank)', { alert: true, dur: 5 });
      for (const s of TANKS) call(F(0, tM + 8) - 5, 'Wild Charge (be in front)', { slot: s, alert: true, dur: 5 });
      const comets = [];                // each: where, when it lands, when it goes
      const kiss = (t, who, spots) => {
        hz({ t, tell: t - 8, effect: 'bait', shape: 'circle', r: 4, from: 'target', targets: who, snap: 0.3, dmg: 0.9, own: 0.25, name: 'Cosmic Kiss' });
        who.forEach((s, k) => { comets.push({ at: spots[k], t0: t, t1: Infinity }); debuff(s, 'Meteor', `drop it ${dirName(brg(spots[k]))}`, t - 8.1, t); call(t - 8.1, `Meteor on YOU: drop it ${dirName(brg(spots[k]))}`, { slot: s, alert: true, dur: 6 }); });
      };
      const t1K = K(0, mk1 + 8.1);
      kiss(t1K, ['M1', 'M2'], [NE, SW[0]]);
      // Then three more lines, each blocked by a meteor the party hides behind (it explodes, 8 yalms, 3.8 s on), with
      // Foregone Fatality's tethers to the tanks (north and south) before each; between them the healers, then the
      // ranged, come close for the next markers and drop theirs (north-west and south-west, then south-west far and
      // north-east), and the party waits clear of the last meteor's blast and the next one's bait before hiding.
      const sets = [
        { mark: ['H1', 'H2'], drop: [NW, SW[1]], hide: NE, close: [at(290, 5.3), at(110, 5.3)], wait: null },
        { mark: ['R1', 'R2'], drop: [SW[2], NE], hide: NW, close: [at(135, 5.3), at(160, 5.3)], wait: at(75, 12) },
        { mark: [], drop: [], hide: NE, close: [], wait: at(285, 12) },
      ];
      pref(t1K + 0.05, { MT: [0, 15], OT: at(191, 10.2) });
      let tPrev = t1K, markPrev = [];
      sets.forEach((x, k) => {
        const tFF = ff[k] !== undefined ? ff[k] : F(k + 1, tM + 18 + 10 * k) - 0.9, tF = F(k + 1, tFF + 0.9);
        const tK = K(k + 1, tF + 1.2), tX = ex[k] !== undefined ? ex[k] : tF + 3.8;
        const hiders = NT.filter(s => !x.mark.includes(s)), hide = assign(hiders, behind(x.hide, hiders.length));
        // Who's free now (not dropping a meteor still to land): straight behind the meteor, or to the waiting spot
        // till this meteor has landed (its bait) and the last one has blown (they arrive after the last line).
        const late = hiders.filter(s => markPrev.includes(s)), now = hiders.filter(s => !markPrev.includes(s));
        if (x.wait) pref(tPrev + 0.05, assign(now, clump([], x.wait, now.length, onSq, { gap: 0.55 })));
        if (x.mark.length) pref(tPrev + 0.05, assign(x.mark, x.close));
        const tHide = Math.max(tPrev + 0.05, x.wait ? Math.max(K(k, tPrev), ex[k - 1] !== undefined ? ex[k - 1] : tPrev) + 0.05 : tPrev + 0.05);
        pref(tHide, Object.assign({}, ...now.map(s => ({ [s]: hide[s] }))));
        if (late.length) pref(Math.max(tHide, K(k, tPrev) + 0.05), Object.assign({}, ...late.map(s => ({ [s]: hide[s] }))));
        // The markers: close by him as their markers come (2 s on), then off to drop theirs.
        if (x.mark.length) pref(tF - 6.9, assign(x.mark, x.drop));
        hz({ t: tFF, tell: tFF - 5.8, effect: 'bait', shape: 'circle', r: 3, from: 'target', targets: TANKS, tether: 'boss', dmg: 1.2, own: 0.5, buster: true, name: 'Foregone Fatality' });
        for (const s of TANKS) call(tFF - 5.8, `Take the ${s === 'MT' ? 'north' : 'south'} meteor's tether`, { slot: s, alert: true, dur: 5 });
        // The line runs to the meteor and stops; whoever's behind it is safe, and the meteor explodes.
        const c = comets.find(m => dist(m.at, x.hide) < 0.5 && m.t0 <= tF && m.t1 === Infinity);
        hz(Object.assign({ t: tF, tell: tF - 5, dmg: 1.2, name: 'Fearsome Fireball' }, line([0, 0], brg(x.hide), Math.max(1, dist(x.hide, [0, 0]) - 1.8), 6)));
        check({ t: tF, kind: 'spot', slots: hiders, spots: hide, r: 2.6, fail: 1.2, name: 'Fearsome Fireball (hide behind the meteor)' });
        call(tF - 5, 'Wild Charge (behind meteor)', { alert: true, dur: 5 });
        if (c) c.t1 = tX;
        // (Its dropper steps out of the blast once theirs is down.)
        hz({ t: tX, tell: tX - 3, shape: 'circle', at: x.hide, r: 8, dmg: 1.3, name: 'Explosion', react: 2.4 });
        if (x.mark.length) kiss(tK, x.mark, x.drop);
        tPrev = tF; markPrev = x.mark;
      });
      // Triple Tyrannhilation: three shockwaves; only the meteors' shadows are safe, the nearest breaking each time.
      const hideAll = assign(S, clump([{ shape: 'circle', at: NE, r: 8 }], at(225, 23.8), 8, onSq, { gap: 0.4, m: 0.4 }));
      pref(tPrev + 0.05, hideAll);
      call(tTT - 7, 'LoS behind 3x meteor (south-west)', { alert: true, dur: 7 });
      SW.forEach((c, k) => {
        const tw = waves[k] !== undefined ? waves[k] : tTT + 1.1 + 1.4 * k, r = dist(c, [0, 0]), half = Math.asin(2 / r) * 180 / Math.PI;
        hz({ t: tw, tell: tTT - 7, shape: 'wedge', deg: 225, half, dmg: 1.5, name: 'Shockwave', react: 2 });
        hz({ t: tw, tell: tTT - 7, shape: 'cone', at: [0, 0], deg: 225, half, r: r + 2, dmg: 1.5, name: 'Shockwave', react: 2 });
        const m = comets.find(x => dist(x.at, c) < 0.5 && x.t1 === Infinity);
        if (m) m.t1 = tw + 0.4;
      });
      for (const c of comets) mark({ shape: 'circle', at: c.at, r: 2 }, c.t0, Math.min(c.t1, tTT + 6), 'rgba(255,170,90,0.45)');
      end((waves[2] !== undefined ? waves[2] : tTT + 3.9) + 0.2, UP);
    }

    // ===== Flatliner: the arena splits =====
    const tFlat = tOf('Flatliner (split)', 350, 370, 361.8), tSplit = tFlat + 0.6;
    const conga = CONGA[st.split] || CONGA.hector;
    const posAt = {};                  // where each stands at the start of the next step
    {
      const pre = {};
      for (const side of ['W', 'E']) conga[side].forEach((s, j) => { pre[s] = [SG[side] * 2, 1.5 - j]; });
      pref(begin(tFlat - 5.5), pre);
      hz({ t: tFlat, tell: tFlat - 6, raidwide: true, dmg: 0.3, name: 'Flatliner' });
      hz({ t: tFlat + 0.01, tell: tFlat - 6, effect: 'knockback', from: [0, 0], dist: 15, unstoppable: true, dmg: 0, name: 'Flatliner', react: 5 });
      for (const s of S) posAt[s] = add(pre[s], mul(unit(pre[s]), 15));
      pref(tFlat + 0.05, Object.assign({}, posAt));
      call(tFlat - 6, 'Short knockback to sides (G1 west, G2 east)', { alert: true, dur: 6 });
      hold = tFlat + 0.05;
    }
    arenas.push({ t: tSplit, parts: [platRect('W'), platRect('E')], deathwall: true });
    mark({ shape: 'rect', a: [-6, -20], b: [6, 20] }, tSplit, 1e9, 'rgba(6,6,14,0.82)');

    // One round of the split: tethers, towers (knockbacks), fire breath, puddles, lines.
    function splitRound(o) {
      const { tTeth, tTower, tMark, locks, tLines, tethered, pattern, lanePat } = o;
      const side = all(s => sideOf(posAt[s]));
      // Each tethered player's portal, and the corner they stretch it to (the far platform, the far end).
      const portals = shuffle(PORTALS[pattern]), portalOf = {}, corner = {};
      tethered.forEach((s, k) => { portalOf[s] = portals[k]; corner[s] = { side: portals[k][0] < 0 ? 'E' : 'W', ns: portals[k][1] > 0 ? -1 : 1 }; });
      const lanes = LANES[lanePat], laneHit = { W: lanes.find(x => x < 0), E: lanes.find(x => x > 0) };
      const safeX = { W: laneHit.W === -11 ? -21 : -11, E: laneHit.E === 11 ? 21 : 11 };
      // The towers: the two northmost on each platform take its north tower. Those who need the other platform for
      // their tether stand on the tower's inner side and are thrown across; the rest on its side toward the platform's
      // middle, thrown along it.
      const towerOf = {}, cross = {};
      for (const sd of ['W', 'E']) {
        const here = S.filter(s => side[s] === sd).sort((a, b) => posAt[b][1] - posAt[a][1]);
        here.forEach((s, j) => { towerOf[s] = TOWERS[sd][j < 2 ? 0 : 1]; cross[s] = tethered.includes(s) && corner[s].side !== sd; });
      }
      const soak = {}, land = {};
      for (const tw of [...TOWERS.W, ...TOWERS.E]) {
        const g = S.filter(s => towerOf[s] === tw), sx = sgn(tw[0]), ny = sgn(tw[1]);
        const xs = g.filter(s => cross[s]), ys = g.filter(s => !cross[s]);
        xs.forEach((s, k) => { soak[s] = add(tw, [-sx * 2.5, xs.length > 1 ? (k ? -0.6 : 0.6) : 0]); });
        ys.forEach((s, k) => { soak[s] = add(tw, [ys.length > 1 ? (k ? -0.6 : 0.6) : 0, -ny * 2.5]); });
        g.forEach(s => { land[s] = add(soak[s], mul(unit(sub(soak[s], tw)), 23)); });
        hz({ t: tTower, tell: tTower - 10, effect: 'tower', shape: 'circle', at: tw, r: 4, soak: 2, dmg: 0.3, fail: 0.9, name: 'Explosion' });
        hz({ t: tTower + 0.02, tell: tTower - 10, effect: 'knockback', shape: 'circle', at: tw, r: 4, dist: 23, unstoppable: true, dmg: 0, name: 'Explosion', react: 4 });
      }
      pref(begin(tTower - 9), soak);
      pref(tTower + 0.05, land);
      // Calls and the tethers' reminders.
      for (const s of tethered) {
        const c = corner[s], dir = (c.ns > 0 ? 'north' : 'south') + (c.side === 'E' ? 'east' : 'west');
        call(tTeth, `Tether on YOU: stretch ${dir} (later)`, { slot: s, alert: true, dur: 6 });
        call(tTower - 6, cross[s] ? `Tower Knockback Across to ${c.side === 'E' ? 'East' : 'West'}` : 'Tower Knockback to Same Platform', { slot: s, alert: true, dur: 5 });
        debuff(s, 'Majestic Meteowrath', `stretch to the ${dir} corner`, tTeth, tLines);
      }
      for (const s of S.filter(x => !tethered.includes(x))) {
        call(tTeth + 0.2, 'Bait Fire Breath (later)', { slot: s, dur: 5 });
        call(tTower - 6, 'Tower Knockback to Same Platform', { slot: s, alert: true, dur: 5 });
      }
      // After the towers: on each platform the two tethered (one to each end) and two more; each pairs with one, north
      // and south. One of the untethered on each platform gets Fire Breath.
      const prey = [], pairN = {};
      for (const sd of ['W', 'E']) {
        const here = S.filter(s => sideOf(land[s]) === sd), t2 = here.filter(s => tethered.includes(s)), u2 = here.filter(s => !tethered.includes(s)).sort((a, b) => land[b][1] - land[a][1]);
        const tn = t2.find(s => corner[s].ns > 0), ts = t2.find(s => corner[s].ns < 0);
        if (tn) pairN[tn] = 1; if (ts) pairN[ts] = -1;
        if (u2[0]) pairN[u2[0]] = 1; if (u2[1]) pairN[u2[1]] = -1;
        prey.push(pick(u2));
      }
      // The spots for the lines (BossMod's): the tethered at the far ends, 16 out and a step into the lane that isn't
      // hit; the two others on their platform 12.25 from the middle, one north, one south, likewise.
      const laneShapes = lanes.map(x => line([x, 25], 180, 50, 10)), wide = lanes.map(x => line([x, 25], 180, 50, 12));
      const into = (sd) => SG[sd] * (Math.abs(safeX[sd]) > 16 ? 17.3 : 14.7);
      const D = {};
      for (const s of tethered) D[s] = [into(corner[s].side), corner[s].ns * 18.9];
      const wrath = tethered.map(s => ({ shape: 'line', at: portalOf[s], deg: brgFrom(portalOf[s], D[s]), len: 80, w: 10, owner: s }));
      // The puddles: the two untethered on each platform bait them across it at their spot's end (one north, one
      // south), from the outer edge in to the inner one (Toxic's front wall), then step back out to their spots; the
      // tethered go straight to their corners.
      const path = {};
      const free = S.filter(s => !tethered.includes(s));
      for (const s of free) {
        const sd = sideOf(land[s]), g = SG[sd], ns = pairN[s] || 1, y = ns * 12.25;
        path[s] = [[g * 23.2, y], [g * 15.5, y], [g * 7.1, ns * (st.split === 'toxic' ? 9.4 : 9.8)]];
      }
      const cPuddles = free.map(s => ({ shape: 'circle', at: path[s][2], r: 6.8 }));
      const breaths = [];
      for (const s of prey) {
        const sd = sideOf(land[s]);
        D[s] = clump([...wide, ...cPuddles, ...wrath], [into(sd), (pairN[s] || 1) * 12.25], 1, onPlat(sd), { m: 0.5 })[0];
        breaths.push({ shape: 'line', at: [0, 0], deg: brg(D[s]), len: 80, w: 6, owner: s });
      }
      for (const s of free.filter(x => !D[x])) {
        const sd = sideOf(land[s]);
        D[s] = clump([...wide, ...cPuddles, ...wrath, ...breaths], [into(sd), (pairN[s] || 1) * 12.25], 1, onPlat(sd), { m: 0.5 })[0];
      }
      // (A tethered corner a breath or another tether would cross moves along the end.)
      for (const s of tethered) {
        const others = [...wrath.filter(h => h.owner !== s), ...breaths];
        if (others.some(h => inside(h, D[s], 0.6))) {
          const sd = corner[s].side;
          D[s] = clump([...wide, ...cPuddles, ...others], D[s], 1, (p) => onPlat(sd)(p) && dist(p, portalOf[s]) >= 49, { m: 0.5 })[0];
        }
      }
      pref(tTower + 0.6, Object.assign({}, ...tethered.map(s => ({ [s]: D[s] }))));
      pref(locks[0] - 2.6, Object.assign({}, ...free.map(s => ({ [s]: path[s][0] }))));
      locks.forEach((tl, k) => pref(tl + 0.05, Object.assign({}, ...free.map(s => ({ [s]: k < 2 ? path[s][k + 1] : D[s] })))));
      // The hazards: the untethered's puddles, three times; the lanes, the tethers' lines and the breaths at once.
      locks.forEach((tl, k) => hz({ t: tl + 3, tell: tl - 0.5, shape: 'circle', r: 6, from: 'target', targets: free, snap: 3, dmg: 0.9, name: 'Majestic Meteor', react: 2.6 }));
      laneShapes.forEach(h => hz(Object.assign({ t: tLines, tell: tTeth, dmg: 1.4, name: 'Majestic Meteorain' }, h)));
      for (const s of tethered) {
        hz({ t: tLines, tell: tTeth, effect: 'bait', shape: 'line', from: portalOf[s], aim: 'target', targets: [s], snap: 0.4, len: 80, w: 10, tether: portalOf[s], stretch: 48, fail: 0.9, dmg: 1.3, own: 0.4, name: 'Majestic Meteowrath' });
      }
      hz({ t: tLines, tell: tMark, effect: 'bait', shape: 'line', from: 'boss', aim: 'target', targets: prey, snap: 0.4, len: 80, w: 6, dmg: 1.3, own: 0.4, name: 'Fire Breath' });
      for (const s of prey) {
        debuff(s, 'Fire Breath', 'bait it out on your platform', tMark, tLines);
        call(tMark, `Fire Breath on YOU + Bait Puddles x3 => ${(pairN[s] || 1) > 0 ? 'north' : 'south'}`, { slot: s, alert: true, dur: 6 });
      }
      for (const s of S.filter(x => !prey.includes(x))) call(tMark, tethered.includes(s) ? 'Stretch Tether' : 'Bait Puddles x3 => Avoid Lines', { slot: s, alert: true, dur: 6 });
      for (const s of S) posAt[s] = D[s];
      hold = locks[2] + 0.05;
      return { pairN };
    }
    const tTeth1 = tFlat + 15.2, tTow1 = tOf('Explosion', tFlat + 20, tFlat + 30, tFlat + 27.2);
    const tLines1 = tOf('Majestic Meteowrath/Majestic Meteorain/Fire Breath', tTow1, tTow1 + 20, tTow1 + 14.9);
    label(find('Majestic Meteowrath/Majestic Meteorain/Fire Breath', tTow1, tTow1 + 20), 'Fire Breath + Meteor Lines');
    const pat1 = pick([1, 2]), lane1 = pick([1, 2]);
    const teth1 = [];
    for (const sd of ['W', 'E']) teth1.push(...shuffle(S.filter(s => sideOf(posAt[s]) === sd)).slice(0, 2));
    splitRound({ tTeth: tTeth1, tTower: tTow1, tMark: tTow1 + 5.9, locks: [tTow1 + 8, tTow1 + 10, tTow1 + 12.1], tLines: tLines1, tethered: teth1, pattern: pat1, lanePat: lane1 });
    const tTow2 = tOf('Explosion', tLines1 + 10, tLines1 + 25, tLines1 + 17.2);
    const tLines2 = tOf('Majestic Meteowrath/Majestic Meteorain/Fire Breath', tTow2, tTow2 + 20, tTow2 + 14.9);
    label(find('Majestic Meteowrath/Majestic Meteorain/Fire Breath', tTow2, tTow2 + 20), 'Fire Breath + Meteor Lines');
    const r2 = splitRound({ tTeth: tLines1 + 5.1, tTower: tTow2, tMark: tTow2 + 5.9, locks: [tTow2 + 8, tTow2 + 10, tTow2 + 12], tLines: tLines2,
      tethered: S.filter(s => !teth1.includes(s)), pattern: 3 - pat1, lanePat: 3 - lane1 });

    // ===== Massive Meteor, the last towers and Arcadion Avalanche =====
    const tMass = tOf('Massive Meteor (castbar)', tLines2, tLines2 + 15, tLines2 + 9.3);
    const hits5 = [0, 1, 2, 3, 4].map(k => tMass + 1.1 + 1.4 * k);
    const plat = all(s => sideOf(posAt[s]));
    const stackOn = ['W', 'E'].map(sd => pick(S.filter(s => plat[s] === sd)));
    hits5.forEach((t, k) => hz({ t, tell: k ? hits5[k - 1] : tMass - 5, effect: 'share', shape: 'circle', r: 6, from: 'target', targets: stackOn, min: 4, max: 4, dmg: 0.12, name: 'Massive Meteor' }));
    const mid = {};
    for (const sd of ['W', 'E']) Object.assign(mid, assign([stackOn[sd === 'W' ? 0 : 1], ...S.filter(s => plat[s] === sd && !stackOn.includes(s))], clump([], [SG[sd] * 16, 0], 4, onPlat(sd), { gap: 0.5 })));
    pref(begin(tMass - 4.5), mid);
    call(tMass - 5, 'Stack 5x (your platform)', { alert: true, dur: 6 });
    const tTow3 = tOf('Explosion', tMass + 8, tMass + 18, tMass + 13.5), tAva = tOf('Arcadion Avalanche (castbar)', tTow3 - 1, tTow3 + 3, tTow3 + 0.3);
    const tSlab = tOf('Arcadion Avalanche', tAva + 5, tAva + 15, tAva + 9.6);
    const doomed = pick(['W', 'E']), safe = doomed === 'W' ? 'E' : 'W', northSafe = Math.random() < 0.5;
    label(find('Arcadion Avalanche (castbar)', tAva - 1, tAva + 1), `Arcadion Avalanche (the ${doomed === 'W' ? 'west' : 'east'} platform)`);
    label(find('Arcadion Avalanche', tSlab - 1, tSlab + 1), `Arcadion Avalanche (${northSafe ? 'south' : 'north'} half)`);
    {
      const soak = {}, land = {};
      for (const sd of ['W', 'E']) {
        const here = S.filter(s => plat[s] === sd);
        for (const [j, tw] of TOWERS[sd].entries()) {
          const g = here.filter(s => (r2.pairN[s] || (posAt[s][1] > 0 ? 1 : -1)) === (j ? -1 : 1));
          const take = g.length === 2 ? g : here.filter(s => !Object.keys(soak).includes(s)).slice(0, 2);
          const sx = sgn(tw[0]), ny = sgn(tw[1]);
          take.forEach((s, k) => {
            soak[s] = sd === doomed ? add(tw, [-sx * 2.5, k ? -0.6 : 0.6]) : add(tw, [k ? -0.6 : 0.6, -ny * 2.5]);
            land[s] = add(soak[s], mul(unit(sub(soak[s], tw)), 23));
          });
          hz({ t: tTow3, tell: tTow3 - 10, effect: 'tower', shape: 'circle', at: tw, r: 4, soak: 2, dmg: 0.3, fail: 0.9, name: 'Explosion' });
          hz({ t: tTow3 + 0.02, tell: tTow3 - 10, effect: 'knockback', shape: 'circle', at: tw, r: 4, dist: 23, unstoppable: true, dmg: 0, name: 'Explosion', react: 4 });
        }
      }
      pref(hits5[4] + 0.05, soak);
      pref(tTow3 + 0.05, land);
      call(tAva - 6, `Tower Knockback to ${safe === 'W' ? 'West' : 'East'}`, { alert: true, dur: 6 });
      hz(Object.assign({ t: tAva, tell: tAva - 6, dmg: 1.5, name: 'Arcadion Avalanche' }, platRect(doomed)));
      const half = { shape: 'rect', a: [SG[safe] * 6, 0], b: [SG[safe] * 26, northSafe ? -20 : 20] };
      hz(Object.assign({ t: tSlab, tell: tAva + 0.5, dmg: 1.5, name: 'Arcadion Avalanche' }, half));
      call(tSlab - 6, northSafe ? 'North' : 'South', { alert: true, dur: 5 });
      pref(tTow3 + 0.6, assign(S, clump([half], [SG[safe] * 13.5, northSafe ? 9 : -9], 8, onPlat(safe), { gap: 0.6 })));
      arenas.push({ t: tAva + 0.6, parts: [platRect(safe)], deathwall: true });
      hold = tTow3 + 0.6;
    }
    // Crown of Arcadia: the square back (beyond it, east and west, is hit).
    const tCrown = tOf('Crown of Arcadia', tSlab + 3, tSlab + 15, tSlab + 10.7);
    for (const a of [{ a: [20, -20], b: [26, 20] }, { a: [-26, -20], b: [-20, 20] }]) hz(Object.assign({ t: tCrown, tell: tCrown - 5, shape: 'rect', dmg: 1.4, name: 'Crown of Arcadia' }, a));
    pref(begin(tSlab + 0.1), assign(S, clump([], [SG[safe] * 13.5, northSafe ? 9 : -9], 8, (p) => onPlat(safe)(p) && Math.abs(p[0]) <= 18.5, { gap: 0.6 })));
    arenas.push({ t: tCrown, shape: 'square', half: 20 });
    end(tCrown + 0.1, UP);
    P.marks.forEach(m => { if (m.t1 === 1e9) m.t1 = tAva + 0.6; });
    mark({ shape: 'rect', a: [20, -20], b: [26, 20] }, tSplit, safe === 'E' ? tCrown : tAva + 0.6, 'rgba(190,200,225,0.22)');
    mark({ shape: 'rect', a: [-26, -20], b: [-20, 20] }, tSplit, safe === 'W' ? tCrown : tAva + 0.6, 'rgba(190,200,225,0.22)');

    // ===== the second Great Wall of Fire and Orbital Omen =====
    wallOfFire(tOf('Great Wall of Fire (castbar)', tCrown + 5, tCrown + 20, tCrown + 11.1));
    orbital(tOf('Orbital Omen (castbar)', tCrown + 15, tCrown + 35, tCrown + 24.6));

    // ===== Ecliptic Stampede =====
    {
      const tES = tOf('Ecliptic Stampede', 525, 545, 534.1), tMam = tOf('Mammoth Meteor x2', tES, tES + 12, tES + 7.1);
      const imp = events.filter(e => /^Atomic Impact \d$/.test(e.name) && e.t > tES && e.t < tES + 30).map(e => e.t);
      while (imp.length < 6) imp.push((imp.length ? imp[imp.length - 1] : tMam) + (imp.length ? 3 : 0));
      const tTow = tOf('Weighty Impact', tES + 15, tES + 30, tES + 23.1), tWrath = tOf('Majestic Meteowrath x4', tTow, tTow + 15, tTow + 9.6);
      const fbE = find('Two-way Fireball / Four-way Fireball', tWrath, tWrath + 8), tFB = fbE ? fbE.t : tWrath + 4.3;
      const fixed = st.ecliptic === 'fixed';
      // The opening: tanks and melee under him; healers and ranged out at the intercards for the two Atomic Impacts.
      const outs = { H1: W(35.7, 74.5), H2: W(63.9, 74.3), R1: W(35.9, 25.9), R2: W(63.7, 25.7) };
      const diag = pick([45, 135]), mams = [at(diag, 21), at(diag + 180, 21)];
      const markers = shuffle(HR).slice(0, 2), group = S.filter(s => !markers.includes(s));
      pref(begin(tES - 4.5), Object.assign({}, assign(['MT', 'OT', 'M1', 'M2'], clump([], [0, 0], 4, onSq, { gap: 0.5 })), outs));
      mams.forEach(m => hz({ t: tMam, tell: tMam - 6, effect: 'hit', shape: 'circle', r: 20, from: m, targets: ['MT'], falloff: 20, dmg: 0.9, name: 'Mammoth Meteor' }));
      // Atomic Impact: the two marked walk the walls from the corners the meteors aren't at, a drop every 3 s, each
      // leaving fire behind (6 s).
      const free = [deg360(diag + 90), deg360(diag + 270)];
      const routes = {
        315: (k) => [-17.5, 15 - 6 * k], 135: (k) => [17.5, -15 + 6 * k], 45: (k) => [15 - 6 * k, 17.5], 225: (k) => [-15 + 6 * k, -17.5],
      };
      const near = (s, cb) => dist(outs[s], at(cb, 14));
      const [mA, mB] = markers, swap = near(mA, free[0]) + near(mB, free[1]) > near(mA, free[1]) + near(mB, free[0]);
      const routeOf = { [mA]: routes[swap ? free[1] : free[0]], [mB]: routes[swap ? free[0] : free[1]] };
      for (const s of markers) {
        debuff(s, 'Atomic Impact', 'drop six at the wall, away from the meteor corners', tES + 1.1, imp[5]);
        call(tES + 1.1, `Go ${dir8(brg(routeOf[s](0)))} => Bait Impacts, Avoid Corners`, { slot: s, alert: true, dur: 6 });
        imp.forEach((t, k) => {
          hz({ t, tell: k ? imp[k - 1] : tES + 1.1, effect: 'bait', shape: 'circle', r: 5, from: 'target', targets: [s], snap: 0.2, dmg: 0.9, own: 0.2, name: 'Atomic Impact' });
          hz({ t: t + 1.25, tell: t, shape: 'circle', r: 5, from: 'target', targets: [s], snap: 1.25, lasts: 5, tick: 1, dmg: 0.4, tickDmg: 0.4, name: 'Atomic Impact (fire)', react: 1.25 });
          pref(k ? imp[k - 1] + 0.05 : tES + 1.2, { [s]: routeOf[s](k) });
        });
      }
      for (const s of group) call(tES + 1.1, 'Proximity AoE; Get Middle => Bait Puddles', { slot: s, dur: 6 });
      // The boss group's six puddles: under him, then north, then on round clockwise 8.5 out.
      const G = [[0, 0], ...[0, 60, 120, 180, 240].map(d => at(d, 8.5))];
      imp.forEach((t, k) => {
        hz({ t, tell: t - 3.5, shape: 'circle', r: 6, from: 'target', targets: ['MT'], snap: 3, dmg: 0.9, name: 'Majestic Meteor', react: 2.6 });
        pref(k ? imp[k - 1] - 2.95 : tES + 1.2, assign(group, clump([], G[k], group.length, onSq, { gap: 0.5 })));
      });
      // The towers: two solo ones for the tanks, two for pairs; four of the eight directions, 10 out.
      const dirs = shuffle([0, 45, 90, 135, 180, 225, 270, 315]).slice(0, 4).sort((a, b) => a - b);
      const types = shuffle(['solo', 'solo', 'pair', 'pair']);
      const towers = dirs.map((d, k) => ({ d, at: at(d, 10), solo: types[k] === 'solo' }));
      const solos = towers.filter(x => x.solo), pairs = towers.filter(x => !x.solo);
      const unmarked = HR.filter(s => !markers.includes(s));
      const sTake = {};
      sTake.MT = solos[0]; sTake.OT = solos[1];
      if (fixed) {
        sTake.M1 = pairs[0]; sTake.M2 = pairs[1];
        sTake[unmarked[0]] = pairs[0]; sTake[unmarked[1]] = pairs[1];
      } else {
        sTake.M1 = pairs[1]; sTake.M2 = pairs[1];
        sTake[unmarked[0]] = pairs[0]; sTake[unmarked[1]] = pairs[0];
      }
      const tSpots = {};
      for (const tw of towers) {
        const g = group.filter(s => sTake[s] === tw);
        if (g.length === 1) tSpots[g[0]] = tw.at;
        else if (fixed) g.forEach(s => { tSpots[s] = s[0] === 'M' ? add(tw.at, mul(unit(tw.at), -2.6)) : tw.at; });
        else g.forEach((s, k) => { tSpots[s] = add(tw.at, at(tw.d + 90, k ? -0.7 : 0.7)); });
        hz({ t: tTow, tell: tTow - 5, effect: 'tower', shape: 'circle', at: tw.at, r: 4, soak: tw.solo ? 1 : 2, dmg: 0.35, fail: 0.9, name: tw.solo ? 'Cosmic Kiss' : 'Weighty Impact' });
      }
      pref(imp[5] - 2.95, tSpots);
      for (const s of markers) pref(imp[5] + 0.05, { [s]: clump([], [0, 0], 1, onSq)[0] });
      call(tTow - 5, 'Get Towers', { dur: 4 });
      // The tethers: one from each tower, from the portal at the cardinal nearest it; stretched across and clockwise
      // (cactbot's default) to a corner. Everyone else under him.
      const tTeth = tWrath - 7.1, cards = [0, 90, 180, 270];
      let best = null;
      const perms = (a) => (a.length <= 1 ? [a] : a.flatMap((x, i) => perms([...a.slice(0, i), ...a.slice(i + 1)]).map(p => [x, ...p])));
      for (const p of perms(cards)) {
        const cost = towers.reduce((c, tw, k) => c + Math.abs(((p[k] - tw.d + 540) % 360) - 180), 0);
        if (!best || cost < best.cost) best = { cost, p };
      }
      const teth = [], tethTo = {};
      towers.forEach((tw, k) => {
        const g = group.filter(s => sTake[s] === tw), s = tw.solo ? g[0] : pick(g);
        teth.push(s); tethTo[s] = { from: at(best.p[k], 19.5), to: at(best.p[k] + 225, 17.5) };
      });
      const untethered = S.filter(s => !teth.includes(s));
      const under = assign(untethered, clump([], [0, 0], untethered.length, onSq, { gap: 0.45 }));
      pref(tTow + 0.05, Object.assign({}, under, ...teth.map(s => ({ [s]: tethTo[s].to }))));
      for (const s of teth) {
        hz({ t: tWrath, tell: tTeth, effect: 'bait', shape: 'line', from: tethTo[s].from, aim: 'target', targets: [s], snap: 0.4, len: 60, w: 10, tether: tethTo[s].from, dmg: 1.3, own: 0.4, name: 'Majestic Meteowrath' });
        call(tTeth, `Stretch Tether ${dir8(brg(tethTo[s].to))}`, { slot: s, alert: true, dur: 6 });
        debuff(s, 'Majestic Meteowrath', `stretch it ${dirName(brg(tethTo[s].to))}`, tTeth, tWrath);
      }
      // Two-way (east and west, four each) or Four-way (the intercards, two each) Fireball: line stacks at the nearest;
      // the untethered bait close, the tethered get behind.
      const four = Math.random() < 0.5;
      label(fbE, four ? 'Four-way Fireball' : 'Two-way Fireball');
      label(find('Two-way Fireball / Four-way Fireball (castbar)', tWrath, tWrath + 8), four ? 'Four-way Fireball' : 'Two-way Fireball');
      const order = fixed ? ['M1', 'M2', 'H1', 'H2', 'R1', 'R2', 'MT', 'OT'] : ['H1', 'H2', 'R1', 'R2', 'M1', 'M2', 'MT', 'OT'];
      const un = untethered.slice().sort((a, b) => order.indexOf(a) - order.indexOf(b));
      const fb = {};
      if (four) {
        const byCorner = teth.slice().sort((a, b) => brg(tethTo[a].to) - brg(tethTo[b].to));
        byCorner.forEach((s, k) => { const cb = brg(tethTo[s].to); fb[s] = at(cb, 13.5); fb[un[k]] = at(cb, 5.9); });
      } else {
        const wT = teth.filter(s => tethTo[s].to[0] < 0), eT = teth.filter(s => tethTo[s].to[0] >= 0);
        fb[un[0]] = [-5.9, 0]; fb[un[1]] = [5.9, 0]; fb[un[2]] = [-8.6, 0]; fb[un[3]] = [8.6, 0];
        wT.forEach((s, k) => { fb[s] = [-12 - 2.5 * k, k ? -0.4 : 0.4]; });
        eT.forEach((s, k) => { fb[s] = [12 + 2.5 * k, k ? -0.4 : 0.4]; });
      }
      pref(tWrath + 0.05, fb);
      const n = four ? 4 : 2;
      hz({ t: tFB, tell: tFB - 6.9, effect: 'share', shape: 'line', from: 'boss', aim: 'target', targets: { nearest: n }, len: 60, w: 6, min: 8 / n, max: 8 / n, dmg: 0.35, name: four ? 'Four-way Fireball' : 'Two-way Fireball' });
      for (const s of S) call(tFB - 6.9, four ? `Intercardinal Line Stack, ${teth.includes(s) ? 'Get behind' : 'Be in Front'}` : `${teth.includes(s) ? 'Move; ' : ''}East/West Line Stack, ${teth.includes(s) ? 'Get behind' : 'Be in Front'}`, { slot: s, alert: true, dur: 6 });
      end(tFB + 0.2, UP);
    }

    // ===== Heartbreak Kick: a tower under him for all eight, 5, 6 and 7 hits =====
    const kicks = events.filter(e => e.name === 'Heartbreak Kick' && e.cast);
    const under = assign(S, clump([], [0, 0], 8, onSq, { gap: 0.45 }));
    kicks.forEach((e, k) => {
      const hits = events.filter(x => /^Heartbreak Kick \d$/.test(x.name) && x.t > e.t && x.t < e.t + 16);
      pref(begin(e.t - 4.5), under);
      hits.forEach((x, j) => hz({ t: x.t, tell: j ? hits[j - 1].t : e.t - 5, effect: 'tower', shape: 'circle', at: [0, 0], r: 4, soak: [6, 8], dmg: 0.1, fail: 0.9, name: 'Heartbreak Kick' }));
      call(e.t - 5, `Get Tower => Stack ${hits.length || 5 + k}x`, { alert: true, dur: 6 });
      hold = (hits.length ? hits[hits.length - 1].t : e.t + 9) + 0.1;
      pref(hold, UP);
    });
    const enr = events.filter(e => e.kind === 'enrage');
    if (enr[0]) label(enr[0], 'Heartbreaker (Enrage)');

    P.arena = arenas;
    // The floor: the square's two halves (a1_flo01 west, a1_flo02 east), slid 6 yalms apart for the split (the walk
    // is flat meanwhile: the halves' collision stays joined); after the avalanche only the spared half stays.
    const keep = safe === 'W' ? 'a1_flo01' : 'a1_flo02', apart = { a1_flo01: [-6, 0], a1_flo02: [6, 0] };
    P.looks = [{ t: 0, show: ['a1_flo01', 'a1_flo02'] }, { t: tSplit, show: ['a1_flo01', 'a1_flo02'], shifts: apart },
      { t: tAva + 0.6, show: [keep], shifts: { [keep]: apart[keep] } }, { t: tCrown, show: ['a1_flo01', 'a1_flo02'] }];
    return P;
  }

  B.FIGHT_SCRIPTS = B.FIGHT_SCRIPTS || {};
  B.FIGHT_SCRIPTS.m11s = {
    // FFLogs' max HP for The Tyrant in an M11S kill (one phase).
    hp: 154287371,
    defaultStrat: 'hector',
    strats: {
      hector: { label: 'Hector (Toxic/No Buddies) (NA)' },
      usbwdz: { label: 'USB + WdZ + Fixed (EU)' },
      toxic: { label: 'Toxic Friends' },
    },
    source: 'wtfdig.info/74/m11s; mechanics after BossMod (github.com/awgil/ffxiv_bossmod)',
    // A north, B east, C south, D west; 1-4 at the intercards (1 north-west, then clockwise).
    waymarks: [
      { label: 'A', at: [0, 12], color: 'red' }, { label: 'B', at: [12, 0], color: 'yellow' },
      { label: 'C', at: [0, -12], color: 'blue' }, { label: 'D', at: [-12, 0], color: 'purple' },
      { label: '1', at: [-12, 12], color: 'red', square: true }, { label: '2', at: [12, 12], color: 'yellow', square: true },
      { label: '3', at: [12, -12], color: 'blue', square: true }, { label: '4', at: [-12, -12], color: 'purple', square: true },
    ],
    plan,
  };
})(window.BLM);
