// A fight's mechanics, from its script (js/fights/<key>.js): the boss's attacks as shapes on the floor (shown while
// they're coming, then landing), where the chosen strat puts each of the eight party spots, where the party's bots
// actually go (their strat spot, moved to the nearest safe ground while something is about to land there), and
// what hits you. Scripts work in compass yalms from the arena's middle: [east, north]. The sim's floor is x = west,
// z = north (the boss at the origin), so a point [E, N] is { x: -E, z: N }.
(function (B) {
  const ARENA = 20;                 // half an arena's side: 40 yalms square, 8 x 8 tiles of 5
  const TILE = 5;
  B.SLOTS = ['MT', 'OT', 'H1', 'H2', 'M1', 'M2', 'R1', 'R2'];
  B.BOSS = B.BOSS || { x: 0, z: 0 };     // where the boss stands (js/data.js's; here too for the headless checks)
  B.SLOT_ROLE = { MT: 'tank', OT: 'tank', H1: 'healer', H2: 'healer', M1: 'melee', M2: 'melee', R1: 'ranged', R2: 'ranged' };
  B.toSim = (p) => ({ x: -p[0], z: p[1] });
  B.toCompass = (q) => [-q.x, q.z];
  const rad = (deg) => deg * Math.PI / 180;
  // A compass bearing (0 = north, 90 = east) and a distance, as [E, N].
  B.bearing = (deg, r) => [Math.sin(rad(deg)) * r, Math.cos(rad(deg)) * r];
  const wrap = (a) => { while (a > Math.PI) a -= 2 * Math.PI; while (a < -Math.PI) a += 2 * Math.PI; return a; };
  const tileOf = (v) => Math.max(0, Math.min(7, Math.floor((v + ARENA) / TILE)));
  // The floor's bounding box (the arena's: Mechanics.fitBox sets it as the arena changes); spots are searched and
  // shapes drawn within it.
  let BOX = { x0: -ARENA, x1: ARENA, y0: -ARENA, y1: ARENA };
  const clampArena = (p) => [Math.max(BOX.x0 + 0.8, Math.min(BOX.x1 - 0.8, p[0])), Math.max(BOX.y0 + 0.8, Math.min(BOX.y1 - 0.8, p[1]))];

  // ---------- shapes ----------
  // Whether point p ([E, N]) is in the shape, grown by m yalms (a body's width when it lands; more for the bots, who
  // keep clear). Shapes: circle {at, r}, donut {at, r0} (everything past r0), half {dir: [dE, dN]} (the half of the
  // room that way), wedge {deg, half} (everything outside the wedge of +-half degrees round that bearing), rect {a, b}
  // (two corners), tiles {parity} (the checkerboard's tiles of that colour), cols {cols} (whole columns of tiles,
  // west to east, 0-7), cone {at, deg, half, r, r0} (r0: a donut's slice), line {at, deg, len, w, back} (a
  // rectangle w wide from at toward bearing deg, len long, and back yalms behind it), cross {at, deg, len, w} (two
  // lines through at, len each way), donut {at, r0, r1} (r1: its outer edge; without one, out to the walls).
  function inside(h, p, m) {
    const at = h.at || [0, 0], dx = p[0] - at[0], dy = p[1] - at[1], d = Math.hypot(dx, dy);
    switch (h.shape) {
      case 'circle': return d < h.r + m;
      case 'donut': return d > h.r0 - m && (h.r1 === undefined || d < h.r1 + m);
      case 'line': {
        const a = rad(h.deg), u = dx * Math.sin(a) + dy * Math.cos(a), v = dx * Math.cos(a) - dy * Math.sin(a);
        return u > -(h.back || 0) - m && u < h.len + m && Math.abs(v) < h.w / 2 + m;
      }
      case 'cross': return [0, 90].some(k => inside({ shape: 'line', at, deg: h.deg + k, len: h.len, back: h.len, w: h.w }, p, m));
      case 'half': return p[0] * h.dir[0] + p[1] * h.dir[1] > (h.off || 0) - m;
      case 'wedge': {         // its point, the boss's middle, is on its edge: not safe
        const r = Math.hypot(p[0], p[1]);
        if (r < 0.01) return true;
        return Math.abs(wrap(Math.atan2(p[0], p[1]) - rad(h.deg))) > rad(h.half) - m / Math.max(1, r);
      }
      case 'rect': {
        const x0 = Math.min(h.a[0], h.b[0]) - m, x1 = Math.max(h.a[0], h.b[0]) + m;
        const y0 = Math.min(h.a[1], h.b[1]) - m, y1 = Math.max(h.a[1], h.b[1]) + m;
        return p[0] > x0 && p[0] < x1 && p[1] > y0 && p[1] < y1;
      }
      case 'tiles': case 'cols': {
        // Any tile the body (a square of +-m) touches.
        const i0 = tileOf(p[0] - m), i1 = tileOf(p[0] + m), j0 = tileOf(p[1] - m), j1 = tileOf(p[1] + m);
        for (let i = i0; i <= i1; i++) for (let j = j0; j <= j1; j++) {
          if (h.shape === 'tiles' ? (h.set ? h.set.has(i + 8 * j) : (i + j) % 2 === h.parity) : h.cols.includes(i)) return true;
        }
        return false;
      }
      case 'cone': {
        if (d > h.r + m || d < 0.01) return d < 0.01 && !h.r0;
        if (h.r0 && d < h.r0 - m) return false;
        return Math.abs(wrap(Math.atan2(dx, dy) - rad(h.deg))) < rad(h.half) + m / Math.max(1, d);
      }
      default: return false;
    }
  }
  B.mechInside = inside;

  // The shape's outline on the floor, as polygons of [E, N] (clipped to the arena); holes listed after the outline.
  function clip(poly, nx, ny, off) {          // keep the side where nx*E + ny*N >= off
    const out = [];
    for (let i = 0; i < poly.length; i++) {
      const a = poly[i], b = poly[(i + 1) % poly.length];
      const da = a[0] * nx + a[1] * ny - off, db = b[0] * nx + b[1] * ny - off;
      if (da >= 0) out.push(a);
      if ((da >= 0) !== (db >= 0)) { const t = da / (da - db); out.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]); }
    }
    return out;
  }
  const square = () => [[BOX.x0, BOX.y0], [BOX.x1, BOX.y0], [BOX.x1, BOX.y1], [BOX.x0, BOX.y1]];
  const toArena = (poly) => clip(clip(clip(clip(poly, 1, 0, BOX.x0), -1, 0, -BOX.x1), 0, 1, BOX.y0), 0, -1, -BOX.y1);
  const ring = (at, r, n) => Array.from({ length: n }, (_, i) => [at[0] + Math.sin(i / n * 2 * Math.PI) * r, at[1] + Math.cos(i / n * 2 * Math.PI) * r]);
  function outline(h) {
    const at = h.at || [0, 0];
    switch (h.shape) {
      case 'circle': return [toArena(ring(at, h.r, 48))];
      case 'donut': return [h.r1 === undefined ? square() : ring(at, h.r1, 64), ring(at, h.r0, 48)];
      case 'line': {
        const a = rad(h.deg), f = [Math.sin(a), Math.cos(a)], s = [Math.cos(a), -Math.sin(a)], b = h.back || 0, w = h.w / 2;
        const pt = (u, v) => [at[0] + f[0] * u + s[0] * v, at[1] + f[1] * u + s[1] * v];
        return [toArena([pt(-b, -w), pt(h.len, -w), pt(h.len, w), pt(-b, w)])];
      }
      case 'cross': return [0, 90].map(k => outline({ shape: 'line', at, deg: h.deg + k, len: h.len, back: h.len, w: h.w })[0]);
      case 'half': return [clip(square(), h.dir[0], h.dir[1], h.off || 0)];
      case 'wedge': {
        const a = rad(h.deg), w = rad(h.half), far = 80;
        const tri = toArena([[0, 0], [Math.sin(a - w) * far, Math.cos(a - w) * far], [Math.sin(a) * far, Math.cos(a) * far], [Math.sin(a + w) * far, Math.cos(a + w) * far]]);
        return [square(), tri];
      }
      case 'rect': return [toArena([[h.a[0], h.a[1]], [h.b[0], h.a[1]], [h.b[0], h.b[1]], [h.a[0], h.b[1]]])];
      case 'tiles': case 'cols': {
        const out = [];
        for (let i = 0; i < 8; i++) for (let j = 0; j < 8; j++) {
          if (h.shape === 'tiles' ? (h.set ? !h.set.has(i + 8 * j) : (i + j) % 2 !== h.parity) : !h.cols.includes(i)) continue;
          const x0 = -ARENA + i * TILE, y0 = -ARENA + j * TILE;
          out.push([[x0 + 0.15, y0 + 0.15], [x0 + TILE - 0.15, y0 + 0.15], [x0 + TILE - 0.15, y0 + TILE - 0.15], [x0 + 0.15, y0 + TILE - 0.15]]);
        }
        return out;
      }
      case 'cone': {
        const n = Math.max(8, Math.round(h.half / 4)), arc = (r, rev) => Array.from({ length: n + 1 }, (_, i) => {
          const a = rad(h.deg - h.half + (2 * h.half) * (rev ? n - i : i) / n);
          return [at[0] + Math.sin(a) * r, at[1] + Math.cos(a) * r];
        });
        return [toArena([...(h.r0 ? arc(h.r0, true) : [at]), ...arc(h.r)])];
      }
      default: return [];
    }
  }
  // Whether the outline's later polygons are holes in the first (a donut, a wedge's complement) or separate pieces.
  const holed = (h) => h.shape === 'donut' || h.shape === 'wedge';
  const isKnock = (h) => h.effect === 'knockback' || h.effect === 'pull';

  // ---------- the fight's mechanics ----------
  class Mechanics {
    // script: B.FIGHT_SCRIPTS[key]; fight: the B.Fight it runs in.
    constructor(app, fight, script) {
      this.app = app;
      this.fight = fight;
      this.script = script;
      this.plan = null;
      this.reset();
    }

    get strat() {
      const s = (this.app.store.settings.strats || {})[this.fight.key], all = this.script.strats;
      return all[s] ? s : this.script.defaultStrat;
    }

    // A new pull: the boss's picks (which side, which order) and the strat's spots for it.
    reset() {
      this.plan = this.script.plan(this.fight.events, this.strat);
      this.plan.prefs.sort((a, b) => a.t - b.t);
      this.plan.hazards.sort((a, b) => a.t - b.t);
      this.plan.checks.sort((a, b) => a.t - b.t);
      this.plan.calls.sort((a, b) => a.t - b.t);
      this.plan.debuffs.sort((a, b) => a.t0 - b.t0);
      // A lasting attack (`lasts` seconds: a puddle that stays, hitting every `tick`) is a hit per tick where it landed.
      const ticks = [];
      for (const h of this.plan.hazards) {
        if (!h.lasts) continue;
        const every = h.tick || 1;
        for (let k = 1; k * every <= h.lasts + 1e-6; k++) {
          ticks.push({ ...h, t: h.t + k * every, tell: h.t + (k - 1) * every, dmg: h.tickDmg ?? h.dmg * 0.3, tickOf: h, lasts: 0, quiet: true, react: h.react ?? 3 });
        }
      }
      if (ticks.length) this.plan.hazards = this.plan.hazards.concat(ticks).sort((a, b) => a.t - b.t);
      this.nextDeb = 0;
      this.nextHz = 0; this.nextCk = 0; this.nextCall = 0;
      this.calls = [];
      this.flashes = [];
      this.snap = {};                 // where each protean went (its id -> bearing), for its repeat
      this.solved = {};
      this.t = null;
    }

    // Where the strat puts a spot at fight second t (before the pull, its spot for the opening).
    pref(slot, t) {
      let p = this.plan.start[slot];
      for (const e of this.plan.prefs) {
        if (e.t > (t === null ? -1 : t)) break;
        if (e.spots[slot]) p = e.spots[slot];
      }
      return typeof p === 'function' ? p(t === null ? -1 : t) : p;      // a spot that follows the floor (a lane)
    }

    // The attacks the bots are dodging at second t: the next to land that's already showing and close enough to
    // need moving for, with anything landing with it. (Aimed attacks, cones and proteans, the strat's spots
    // already keep clear of, and the bots ignore.)
    // (With the next ones close behind, 1.6 s, as `soon`: a spot safe from those too saves a dash between them.)
    dodging(t, soon, ahead) {
      if (t === null) return [];
      let first = null;
      const out = [];
      let kb = null;
      const HZ = this.plan.hazards;
      for (let i = this.nextHz; i < HZ.length; i++) {
        const h = HZ[i];
        if (h.t - t > 20) break;
        if (h.t <= t || !this.dodged(h)) continue;
        if (h.tell > t || h.t - t > Math.max(h.react ?? 3, ahead || 0)) continue;
        if (first === null) first = h.t;
        if (h.t - first > (soon ? 1.6 : 0.35)) break;
        out.push(h);
        if (isKnock(h)) kb = h;
      }
      // A knockback: where it throws you has to be clear of what lands just after (the bots stand so it is).
      if (kb) {
        for (let i = this.nextHz; i < HZ.length && HZ[i].t - kb.t <= 3; i++) {
          const h = HZ[i];
          if (h.t > kb.t && h.tell <= t && this.dodged(h) && !out.includes(h)) out.push(h);
        }
      }
      return out.sort((a, b) => a.t - b.t);
    }

    // Whether the bots step out of it: shapes on the floor and knockbacks, not attacks aimed at someone (the strat's
    // spots already keep those apart), stacks to share or towers to soak.
    dodged(h) {
      const src = h.tickOf || h;
      if (src.effect === 'share' || src.effect === 'tower' || src.effect === 'gaze' || src.effect === 'bait') return false;
      if (src.aimed) return false;
      // Aimed at someone: the strat's spots keep it off the others till it locks in where it lands; then it's on the
      // floor like any other, and everyone (whoever baited it too) steps out.
      if ((src.targets || (typeof src.from === 'string' && B.SLOT_ROLE[src.from])) && !src.res) return false;
      return !!src.shape || isKnock(src);
    }

    // Whether a body standing at q comes through hz (in the order they land): knockbacks move it (it must land on the
    // floor), and nothing may land on it. slot: whose body (a bot using Arm's Length ignores the knockback).
    safeAt(q, hz, slot) {
      let p = q;
      if (!this.onArena(q, 0.6)) return false;
      for (const h of hz) {
        if (isKnock(h)) {
          if (slot && (h.immune || []).includes(slot)) continue;
          p = this.knockOf(h, p);
          if (!this.onArena(p, 0.6)) return false;
        } else if (this.parts(h).some(s => s.shape && inside(s, p, 1.1))) return false;
      }
      return true;
    }

    // The nearest point to p out of every attack in hz (searching out to `reach` yalms), or null.
    nearestSafe(p, hz, reach, slot) {
      const safe = (q) => this.safeAt(q, hz, slot);
      if (safe(p)) return p;
      for (let r = 0.5; r <= reach; r += 0.5) {
        const n = Math.max(12, Math.round(r * 6));
        let best = null, bd = Infinity;
        for (let k = 0; k < n; k++) {
          const a = k / n * 2 * Math.PI, c = clampArena([p[0] + Math.sin(a) * r, p[1] + Math.cos(a) * r]);
          if (!safe(c)) continue;
          const d = Math.hypot(c[0] - p[0], c[1] - p[1]);
          if (d < bd) { bd = d; best = c; }
        }
        if (best) return best;
      }
      return null;
    }

    // Where a spot should stand at second t: its strat spot, or the nearest ground to it out of what's about to land
    // (and out of what lands right after, where there's such ground). pos, where it stands now: if it couldn't make
    // that in time, the nearest safe ground to where it is instead.
    target(slot, t, pos) {
      const pref = this.pref(slot, t), hz = this.dodging(t);
      if (!hz.length) return pref;
      const soon = this.dodging(t, true);
      const key = soon.map(h => h.id).join(',') + '|' + hz.length + '|' + pref[0].toFixed(2) + ',' + pref[1].toFixed(2);
      const memo = this.solved[slot];
      let best;
      if (memo && memo.key === key) best = memo.p;
      else {
        best = (soon.length > hz.length && this.nearestSafe(pref, soon, 20, slot)) || this.nearestSafe(pref, hz, 40, slot) || pref;
        this.solved[slot] = { key, p: best };
      }
      // Being thrown: nowhere to run till it lands.
      if (this.app.party.knocked(slot)) return pos || best;
      // Too far to make in time: of the safe ground it can reach first, the point nearest that spot.
      if (pos) {
        const left = hz[0].t - t, run = Math.hypot(best[0] - pos[0], best[1] - pos[1]) / 6;
        if (run > left - 0.1) return this.reachable(pos, 6 * Math.max(0, left - 0.15), hz, best, slot) || this.nearestSafe(pos, hz, 40, slot) || best;
      }
      return best;
    }

    // The guide's spot for you: like the bots' (the strat's spot, or the nearest ground out of what's coming), but
    // steadier: it shows the next safe spot as soon as the attack is up (up to 3.5 s ahead, so you can walk it), and
    // never moves with you (the bots' shortcut when they can't make it in time would make it slide as you run).
    guideTarget(slot, t) {
      const pref = this.pref(slot, t), hz = this.dodging(t, false, 3.5);
      if (!hz.length) return pref;
      const soon = this.dodging(t, true, 3.5);
      const key = soon.map(h => h.id).join(',') + '|' + pref[0].toFixed(2) + ',' + pref[1].toFixed(2);
      if (this.guideMemo && this.guideMemo.key === key) return this.guideMemo.p;
      const p = (soon.length > hz.length && this.nearestSafe(pref, soon, 20, slot)) || this.nearestSafe(pref, hz, 40, slot) || pref;
      this.guideMemo = { key, p };
      return p;
    }

    reachable(pos, reach, hz, goal, slot) {
      const safe = (q) => this.safeAt(q, hz, slot);
      let best = safe(pos) ? pos : null, bd = best ? Math.hypot(goal[0] - pos[0], goal[1] - pos[1]) : Infinity;
      for (let r = 0.5; r <= reach; r += 0.5) {
        const n = Math.max(12, Math.round(r * 6));
        for (let k = 0; k < n; k++) {
          const a = k / n * 2 * Math.PI, c = clampArena([pos[0] + Math.sin(a) * r, pos[1] + Math.cos(a) * r]);
          const d = Math.hypot(goal[0] - c[0], goal[1] - c[1]);
          if (d < bd && safe(c)) { bd = d; best = c; }
        }
      }
      return best;
    }

    // Each frame of a pull: attacks and checks that land, callouts that come up.
    update(t) {
      const P = this.plan, party = this.app.party;
      this.t = t;
      this.fitBox();
      if (t === null) return;
      // Off a deathwall arena's edge on your own feet: a KO, and back onto the floor (the game's fall).
      const me = party.playerSlot(), a = this.arena();
      if (a.deathwall && me && !party.knocked(me) && !this.app.engine.ko) {
        const p = party.compassOf(me);
        if (!this.onArena(p, -0.5)) {
          party.hurt(me, 9, 'the edge', 'fell off the arena', { fail: true });
          party.push(me, this.toEdge(p, this.arenaMiddle()), 0.3);
        }
      }
      // An aimed attack locks in where it's going `snap` seconds before it lands (a bait: then you get out).
      for (let i = this.nextHz; i < P.hazards.length && P.hazards[i].t - t < 15; i++) {
        const h = P.hazards[i];
        if (!h.res && this.live(h) && t >= h.t - (h.snap || 0)) h.res = this.aimAt(h);
      }
      while (this.nextHz < P.hazards.length && P.hazards[this.nextHz].t <= t) this.land(P.hazards[this.nextHz++]);
      while (this.nextCk < P.checks.length && P.checks[this.nextCk].t <= t) this.check(P.checks[this.nextCk++]);
      // The timed debuffs the fight puts on players (Burn Baby Burn, Wavelength), as it puts them.
      while (this.nextDeb < P.debuffs.length && P.debuffs[this.nextDeb].t0 <= t) {
        const d = P.debuffs[this.nextDeb++];
        if (d.key && d.t1 > t) party.addStatus(d.slot, d.key, d.t1 - t);
      }
      while (this.nextCall < P.calls.length && P.calls[this.nextCall].t <= t) {
        const c = P.calls[this.nextCall++];
        if (!c.slot || c.slot === party.playerSlot()) this.app.ui.callout(c.text, c.dur || 5, c.alert);
      }
      this.flashes = this.flashes.filter(f => t - f.t < 0.45);
    }

    // An attack lands: on you if you're in it (and on a bot that's in it, though they shouldn't be).
    land(h) {
      const party = this.app.party;
      if (this.live(h) && !h.res) h.res = this.aimAt(h);
      if (!h.quiet) this.flashes.push({ h: this.resolveShape(h), t: h.t, effect: h.effect });
      if (h.effect === 'tower') this.tower(h);
      else {
        for (const m of party.members()) {
          const hit = this.hits(h, m);
          if (hit) party.hurt(m.slot, hit.dmg, h.name, hit.why, { vuln: !h.raidwide && !hit.soft, fail: hit.fail, status: hit.tankbuster ? ['bleeding', 15] : hit.status || null });
        }
      }
      if (isKnock(h)) this.knock(h);
      // A protean's echo lands later where everyone stood for this one.
      const o = this.bossAt(this.t);
      if (h.snapshot) this.lastProtean = party.members().map(m => this.bearingFrom(o, m.slot));
      if (h.target) this.snap[h.id] = this.bearingFrom(o, h.target);
    }

    // A protean's cones: one at each party member (and whose it is), or the echo's, where they stood last time.
    protean(h) {
      const party = this.app.party, o = this.bossAt(this.t);
      if (h.target) return { degs: [this.bearingFrom(o, h.target)], slots: [h.target] };       // at one player
      if (h.echoOf) return { degs: this.snap[h.echoOf] === undefined ? [] : [this.snap[h.echoOf]], slots: [] };
      if (h.echo) return { degs: this.lastProtean || [], slots: [] };
      const ms = party.members();
      return { degs: ms.map(m => this.bearingFrom(o, m.slot)), slots: ms.map(m => m.slot) };
    }
    // The bearing from point o to where a party spot stands.
    bearingFrom(o, slot) {
      const p = this.app.party.compassOf(slot);
      return Math.atan2(p[0] - o[0], p[1] - o[1]) * 180 / Math.PI;
    }

    // An aimed attack's shape at the moment it lands (a cone pointed at whoever it targets).
    resolveShape(h) {
      if (this.live(h) || h.tickOf) return { shape: 'multi', parts: this.parts(h).filter(s => s.shape) };
      if (h.shape === 'tankcones') {
        const party = this.app.party;
        const o = this.bossAt(this.t);
        return { shape: 'multi', parts: h.slots.map(s => ({ shape: 'cone', at: o, deg: this.bearingFrom(o, s), half: h.half, r: h.r })) };
      }
      if (h.shape === 'protean') {
        return { shape: 'multi', parts: this.protean(h).degs.map(d => ({ shape: 'cone', at: this.bossAt(this.t), deg: d, half: h.half, r: h.r })) };
      }
      return h;
    }

    // What an attack does to party member m: { dmg (a share of the reference HP), why } or null.
    hits(h, m) {
      const party = this.app.party, p = party.compassOf(m.slot);
      if (h.raidwide) return { dmg: h.dmg };
      if (h.effect || this.live(h) || h.tickOf) return this.effectOn(h, m, p);
      if (h.shape === 'tankcones') {
        // Deep Cut: a cone at each tank; a tank in their own takes the buster, anyone else in one is cleaved.
        let mine = false, other = 0;
        const o = this.bossAt(this.t);
        for (const s of h.slots) {
          const c = { shape: 'cone', at: o, deg: this.bearingFrom(o, s), half: h.half, r: h.r };
          if (s === m.slot) mine = true;
          else if (inside(c, p, 0.3)) other++;
        }
        if (other) return { dmg: h.dmg * other, why: 'in a tank cleave', fail: true };
        return mine ? { dmg: h.buster, tankbuster: true } : null;
      }
      if (h.shape === 'protean') {
        // Proteans: a cone at everyone (the echo: at where everyone stood last time). Your own lands softly; anyone
        // else's on you hurts.
        let n = 0, mine = false;
        const { degs, slots } = this.protean(h);
        const o = this.bossAt(this.t);
        degs.forEach((d, i) => {
          if (!inside({ shape: 'cone', at: o, deg: d, half: h.half, r: h.r }, p, 0.3)) return;
          if (slots[i] === m.slot) mine = true; else n++;
        });
        if (n) return { dmg: h.dmg * n, why: h.echo ? 'in an echo' : 'in someone else\'s protean', fail: true };
        return mine ? { dmg: h.own || 0.12 } : null;
      }
      if (!h.shape) return null;
      return inside(h, p, 0.3) ? { dmg: h.dmg, fail: true } : null;
    }

    // A check that only you can fail (the bots stand where the strat says): a stack you're not in, a spread you're
    // too close to someone for, a spotlight you're not standing in when your debuff runs out.
    check(c) {
      const party = this.app.party, me = party.playerSlot();
      // The bots always make it: theirs only leave the status the game gives for it.
      if (c.kind === 'spotlight') for (const s of c.slots || []) if (s !== me) party.addStatus(s, 'inTheSpotlight', 3);
      if (!me || (c.slots && !c.slots.includes(me))) return;
      const p = party.compassOf(me);
      const spot = c.spots ? c.spots[me] : null;
      if (c.kind === 'stack') {
        const mates = (c.groups.find(g => g.includes(me)) || [me]).filter(s => s !== me);
        const near = mates.filter(s => Math.hypot(...sub(party.compassOf(s), p)) < c.r);
        if (spot && Math.hypot(...sub(spot, p)) > c.r + 2) party.hurt(me, c.fail * 2, c.name, 'not at your spot');
        else if (near.length < mates.length) {
          party.hurt(me, c.fail * (mates.length + 1) / (near.length + 1), c.name, `stack missed: ${mates.length - near.length} of your ${mates.length === 1 ? 'partner' : 'group'} not with you`);
        } else party.hurt(me, c.dmg, c.name);
      } else if (c.kind === 'spread') {
        const close = party.members().filter(m => m.slot !== me && Math.hypot(...sub(party.compassOf(m.slot), p)) < c.r);
        if (close.length) party.hurt(me, c.fail * close.length, c.name, `spread: ${close.map(m => m.slot).join(', ')} too close`);
        else party.hurt(me, c.dmg, c.name);
      } else if (c.kind === 'rolecones') {
        // Play A-side: a cone at every player; one aimed at another role's player mustn't catch you.
        const role = (s) => (B.SLOT_ROLE[s] === 'melee' || B.SLOT_ROLE[s] === 'ranged' ? 'dps' : B.SLOT_ROLE[s]);
        const hit = party.members().filter(m => m.slot !== me && role(m.slot) !== role(me)
          && inside({ shape: 'cone', at: [0, 0], deg: party.bearingOf(m.slot), half: c.half, r: 60 }, p, 0.3));
        if (hit.length) party.hurt(me, c.fail * hit.length, c.name, `in ${hit.map(m => m.slot).join(', ')}'s cone (another role)`);
        else party.hurt(me, c.dmg, c.name);
      } else if (c.kind === 'lines') {
        // Play B-side: a line stack from the boss at each healer; you share exactly one.
        const n = c.healers.filter(h => {
          const q = party.compassOf(h), l = Math.hypot(q[0], q[1]);
          if (l < 0.5) return false;
          const along = (p[0] * q[0] + p[1] * q[1]) / l, across = Math.abs(p[0] * q[1] - p[1] * q[0]) / l;
          return along > -0.5 && along < 60 && across < c.width + 0.3;
        }).length;
        if (n !== 1) party.hurt(me, c.fail * (n || 1), c.name, n ? 'in both line stacks' : 'in neither line stack');
        else party.hurt(me, c.dmg, c.name);
      } else if (c.kind === 'pair') {
        // Wavelength: merge with your partner, clear of everyone else.
        const mate = c.partner[me], d = Math.hypot(...sub(party.compassOf(mate), p));
        const others = party.members().filter(m => m.slot !== me && m.slot !== mate && Math.hypot(...sub(party.compassOf(m.slot), p)) < c.r);
        party.removeStatus(me, 'wavelengthA'); party.removeStatus(me, 'wavelengthB');
        if (d > c.r + 0.5) party.hurt(me, c.fail, c.name, `not merged with ${mate}`, { status: ['sustainedDamage', 15] });
        else if (others.length) party.hurt(me, c.fail, c.name, `${others.map(m => m.slot).join(', ')} in your merge`, { status: ['sustainedDamage', 15] });
        else this.app.ui.log(`Wavelength: you merge with ${mate}.`, 'gain', 'battle');
      } else if (c.kind === 'spotlight') {
        const lit = c.lights.some(l => Math.hypot(l[0] - p[0], l[1] - p[1]) < c.r);
        party.removeStatus(me, 'burnBabyBurn');
        if (lit) { this.app.ui.log(`You cleanse ${c.name} in a spotlight.`, 'gain', 'battle'); party.addStatus(me, 'inTheSpotlight', 3); }
        else party.hurt(me, c.fail, c.name, 'not in a spotlight when it ran out');
      } else if (c.kind === 'spot' && spot) {
        if (Math.hypot(spot[0] - p[0], spot[1] - p[1]) > c.r) party.hurt(me, c.fail, c.name, 'not at your spot');
      }
    }

    // ---------- the toolkit every fight uses ----------
    // The game's standard mechanics (after BossMod's components, which model every fight with them): any attack can
    // be aimed and can do something other than hurt. Fields on a hazard, all optional:
    //   from     where it comes from: [E, N]; 'boss' (where the boss stands); 'target' (each target: a circle on a
    //            player, a spread); a party spot ('H1': where H1 stands)
    //   aim      which way it points: 'target' (from `from` toward each target: a baited cone, a line stack, a
    //            charge), 'facing' (the boss's facing), a point to face; otherwise the bearing `deg`
    //   targets  who it's aimed at, one shape each: spots (['MT', 'H1']); {nearest: n} or {farthest: n} from `of` (a
    //            point; the boss by default) as it locks in; {role: 'tank' | 'healer' | 'melee' | 'ranged' | 'dps' |
    //            'support'}
    //   snap     it locks in where it's going this many seconds before it lands (a baited puddle: drop, then move);
    //            till then its marker follows
    //   len      'target': a line that runs to its target (a charge, a line stack); otherwise its length in yalms
    //   effect   what it does to whoever's in it:
    //            'hit'       the default: everyone in it takes dmg
    //            'share'     a stack: dmg is each one's share when `min` stand in it (fewer and it hits harder; more
    //                        than `max` is a failure too); standing in two stacks at once hurts
    //            'bait'      spreads, defamations, baited cones: its target takes `own` (dmg by default), anyone else
    //                        in it the full dmg
    //            'tower'     `soak`: how many must stand in it, or [min, max]; short of that it hits everyone (`fail`)
    //            'knockback' `dist` yalms away from its point (or toward bearing `dir`); nobody standing right on its
    //                        point moves; Arm's Length and Surecast stop it (unless `unstoppable`); `immune`: the bots
    //                        that use them. Off the floor is a KO with the arena's `deathwall`, else its edge stops you
    //            'pull'      toward its point, `dist` at most, stopping `minDist` short of it
    //            'gaze'      look away: whoever faces it (its point within 45 degrees of where they face) is hit
    //   status   [key, seconds]: a status it leaves on whoever it hits
    //   lasts    it stays that long (a puddle), hitting whoever's in it every `tick` seconds (1) for `tickDmg`
    //   tether   a point (usually 'boss'): a line from it to each target while it's coming; `stretch`: the target must
    //            be at least that far from it as it lands, `within`: at most that far
    //   falloff  proximity damage: full at its point, down to a tenth `falloff` yalms out
    // Sequences (exaflares, rotating cleaves, chasing puddles) are lists of these: see B.mechSeq below.
    // The plan can also give (each optional):
    //   arena    the floor: {shape: 'square', half} (default 20), {shape: 'circle', at, r}, {shape: 'rect', a, b},
    //            {parts: [...]} (platforms); `deathwall` makes leaving it a KO (walking or thrown); a list of them,
    //            each with its second `t`, for a floor that changes
    //   boss     where the boss stands: [{t, at: [E, N], move}] (it walks `move` seconds to each spot, or leaps);
    //            its target ring, range, positionals, model and anything aimed from 'boss' follow it
    //   hitbox   [{t, r}]: the boss's size by phase
    //   looks    [{t, show: ['a1_flo', 'a3_flo02'], lift}]: the arena's look by phase. Its models are named
    //            <zone>_a1_flo01 and so on; an entry names models by the start of 'a1_flo01' ('a1': all of look a1,
    //            'a1_flo': its floors, 'a3_flo02': one). Each entry shows the models it names, of those the list names
    //            anywhere; models the list never names always show. `lift` raises what it shows that many yalms (a
    //            phase the game fights lower down)
    // and the script (B.FIGHT_SCRIPTS[key]):
    //   adds     [{from, to, hp, share, name}]: adds soak `share` of the party's damage in that window until their hp
    //   pushes   [{from, to, dealt | adds, name}]: deal `dealt` to the boss this pull (or kill window `adds`'s adds)
    //            between from and to, and the fight skips ahead to `to` (an HP-pushed phase); see B.Fight.jump
    live(h) {
      return !!(h.targets || h.from !== undefined || h.aim !== undefined);
    }

    // A point: [E, N], 'boss' (where it stands now) or a party spot (where that spot stands now).
    pointAt(spec) {
      if (Array.isArray(spec)) return spec;
      if (spec === 'boss') return this.bossAt(this.t);
      if (typeof spec === 'string' && B.SLOT_ROLE[spec]) return this.app.party.compassOf(spec);
      return [0, 0];
    }

    // The spots an attack's aimed at, as it locks in.
    pick(h) {
      const sel = h.targets, party = this.app.party;
      if (Array.isArray(sel)) return sel;
      const ms = party.members().map(m => m.slot);
      if (sel.role) {
        const r = sel.role, of = (s) => B.SLOT_ROLE[s];
        return ms.filter(s => of(s) === r || (r === 'dps' && (of(s) === 'melee' || of(s) === 'ranged'))
          || (r === 'support' && (of(s) === 'tank' || of(s) === 'healer')));
      }
      const o = this.pointAt(sel.of || 'boss'), dist = (s) => Math.hypot(...sub(party.compassOf(s), o));
      const by = ms.slice().sort((a, b) => dist(a) - dist(b));
      if (sel.nearest) return by.slice(0, sel.nearest);
      if (sel.farthest) return by.reverse().slice(0, sel.farthest);
      return [];
    }

    // An aimed attack's shapes as it would land now: one per target (or one), each placed and turned.
    aimAt(h) {
      const party = this.app.party;
      return (h.targets ? this.pick(h) : [null]).map(s => {
        let at = (h.from === 'target' ? (s ? party.compassOf(s) : [0, 0]) : this.pointAt(h.from ?? h.at ?? [0, 0])).slice();
        if (h.after && h.move !== undefined) {           // a chaser: from where it last landed, at most `move` toward them
          const prev = this.parts(h.after)[0].at, d = Math.hypot(at[0] - prev[0], at[1] - prev[1]), k = d > h.move ? h.move / d : 1;
          at = [prev[0] + (at[0] - prev[0]) * k, prev[1] + (at[1] - prev[1]) * k];
        }
        let deg = h.deg ?? 0, len = h.len;
        const toward = h.aim === 'target' ? (s ? party.compassOf(s) : null) : h.aim !== undefined && h.aim !== 'facing' ? this.pointAt(h.aim) : null;
        if (toward && Math.hypot(toward[0] - at[0], toward[1] - at[1]) > 0.01) deg = Math.atan2(toward[0] - at[0], toward[1] - at[1]) * 180 / Math.PI;
        else if (h.aim === 'facing') deg = this.bossFacing();
        if (len === 'target') len = toward ? Math.hypot(toward[0] - at[0], toward[1] - at[1]) + 0.5 : 0;
        return { shape: h.shape, r: h.r, r0: h.r0, r1: h.r1, half: h.half, len, w: h.w, back: h.back, at, deg, owner: s };
      });
    }

    // Its shapes: locked in, or (still coming) following whoever it's aimed at; a puddle's ticks where it landed.
    parts(h) {
      if (h.tickOf) return this.parts(h.tickOf);
      if (h.res) return h.res;
      return this.live(h) ? this.aimAt(h) : [h];
    }

    // Where the boss stands at second t (the plan's `boss`: [{t, at, move}], walking `move` seconds to each spot,
    // or jumping there), and which way it faces (a compass bearing: toward its main tank).
    bossAt(t) {
      const path = this.plan && this.plan.boss;
      if (!path || !path.length || t === null || t === undefined) return [0, 0];
      let prev = [0, 0], cur = null;
      for (const k of path) { if (k.t > t) break; if (cur) prev = cur.at; cur = k; }
      if (!cur) return [0, 0];
      const f = cur.move ? Math.min(1, (t - cur.t) / cur.move) : 1;
      return [prev[0] + (cur.at[0] - prev[0]) * f, prev[1] + (cur.at[1] - prev[1]) * f];
    }
    bossFacing() {
      return -this.app.engine.facing * 180 / Math.PI;
    }

    // The floor (the script's or plan's `arena`, or a list of them, each from its second `t`): {shape: 'square',
    // half} (the default, 20), {shape: 'circle', at, r}, {shape: 'rect', a, b}, or {parts: [...]} (platforms). With
    // `deathwall` leaving it is a KO, as the game's edges are; without, its edge stops you.
    arena(t) {
      const a = (this.plan && this.plan.arena) || this.script.arena;
      if (Array.isArray(a)) {
        const now = t ?? this.t ?? 0;
        let cur = a[0];
        for (const x of a) if (x.t <= now) cur = x;
        return cur;
      }
      return a || DEFAULT_ARENA;
    }
    onArena(p, m = 0, t) {
      const a = this.arena(t);
      const on = (s) => {
        if (s.shape === 'circle') { const c = s.at || [0, 0]; return Math.hypot(p[0] - c[0], p[1] - c[1]) < s.r - m; }
        if (s.shape === 'rect') return p[0] > Math.min(s.a[0], s.b[0]) + m && p[0] < Math.max(s.a[0], s.b[0]) - m && p[1] > Math.min(s.a[1], s.b[1]) + m && p[1] < Math.max(s.a[1], s.b[1]) - m;
        const half = s.half ?? ARENA;
        return Math.abs(p[0]) < half - m && Math.abs(p[1]) < half - m;
      };
      return a.parts ? a.parts.some(on) : on(a);
    }
    // The floor's box (for searching spots and drawing shapes), from the arena now.
    fitBox() {
      const a = this.arena(), parts = a.parts || [a];
      let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
      for (const s of parts) {
        let b;
        if (s.shape === 'circle') { const c = s.at || [0, 0]; b = [c[0] - s.r, c[0] + s.r, c[1] - s.r, c[1] + s.r]; }
        else if (s.shape === 'rect') b = [Math.min(s.a[0], s.b[0]), Math.max(s.a[0], s.b[0]), Math.min(s.a[1], s.b[1]), Math.max(s.a[1], s.b[1])];
        else { const h = s.half ?? ARENA; b = [-h, h, -h, h]; }
        x0 = Math.min(x0, b[0]); x1 = Math.max(x1, b[1]); y0 = Math.min(y0, b[2]); y1 = Math.max(y1, b[3]);
      }
      BOX = { x0, x1, y0, y1 };
    }
    arenaMiddle() {
      return [(BOX.x0 + BOX.x1) / 2, (BOX.y0 + BOX.y1) / 2];
    }

    // A phase pushed early (B.Fight.jump): everything the skipped stretch held is passed over, not landed.
    skipTo(to) {
      const P = this.plan;
      while (this.nextHz < P.hazards.length && P.hazards[this.nextHz].t < to) this.nextHz++;
      while (this.nextCk < P.checks.length && P.checks[this.nextCk].t < to) this.nextCk++;
      while (this.nextCall < P.calls.length && P.calls[this.nextCall].t < to) this.nextCall++;
      while (this.nextDeb < P.debuffs.length && P.debuffs[this.nextDeb].t0 < to) this.nextDeb++;
      this.solved = {};
      this.guideMemo = null;
    }

    // The floor nearest p (off the edge): searched outward round it, nearest first, toward c (where it came from)
    // when two are as near. A ring or platforms have no floor in the middle, so it's never just "back inward".
    toEdge(p, c) {
      c = c || [0, 0];
      for (let r = 0.3; r <= 40; r += 0.3) {
        const n = Math.max(16, Math.round(r * 8));
        let best = null, bd = Infinity;
        for (let k = 0; k < n; k++) {
          const a = k / n * 2 * Math.PI, q = [p[0] + Math.sin(a) * r, p[1] + Math.cos(a) * r];
          if (!this.onArena(q, 0.3)) continue;
          const d = Math.hypot(q[0] - c[0], q[1] - c[1]);
          if (d < bd) { bd = d; best = q; }
        }
        if (best) return best;
      }
      return c;
    }

    // Where a knockback (or draw-in) leaves a body standing at p: pushed by each of its points in turn (only one in
    // whose shape it stands, when it has a shape), away from it or toward bearing `dir`.
    knockOf(h, p) {
      let q = p.slice();
      for (const s of this.parts(h)) {
        if (h.shape && !inside(s, q, 0)) continue;
        let v, dist = h.dist || 0;
        if (h.dir !== undefined) v = B.bearing(h.dir, 1);
        else {
          const dx = q[0] - s.at[0], dy = q[1] - s.at[1], d = Math.hypot(dx, dy);
          if (d < 0.01) continue;                    // right on its point: the game doesn't move you
          v = [dx / d, dy / d];
          if (h.effect === 'pull') { v = [-v[0], -v[1]]; dist = Math.min(dist, d - (h.minDist || 0)); }
        }
        if (dist > 0) q = [q[0] + v[0] * dist, q[1] + v[1] * dist];
      }
      return q;
    }
    knock(h) {
      const party = this.app.party, me = party.playerSlot(), e = this.app.engine, a = this.arena();
      for (const m of party.members()) {
        const immune = !h.unstoppable && (m.slot === me ? (e.has('armsLength') || e.has('surecast')) : (h.immune || []).includes(m.slot));
        if (immune) continue;
        const p = party.compassOf(m.slot), q = this.knockOf(h, p);
        if (Math.hypot(q[0] - p[0], q[1] - p[1]) < 0.05) continue;
        const off = !this.onArena(q);
        party.push(m.slot, off ? this.toEdge(q, p) : q, 0.5);
        if (off && a.deathwall) party.hurt(m.slot, 9, h.name, 'knocked off the arena', { fail: true });
      }
    }

    // A tower: enough in it and they share it; too few and it hits everyone.
    tower(h) {
      const party = this.app.party, ms = party.members();
      const [lo, hi] = Array.isArray(h.soak) ? h.soak : [h.soak || 1, h.soak || 1];
      for (const s of this.parts(h)) {
        const inn = ms.filter(m => inside(s, party.compassOf(m.slot), 0));
        if (inn.length < lo) {
          for (const m of ms) party.hurt(m.slot, h.fail ?? 0.9, h.name, inn.length ? `a tower short: ${inn.length} of ${lo}` : 'a tower nobody soaked', { fail: true });
        } else {
          for (const m of inn) party.hurt(m.slot, h.dmg, h.name, inn.length > hi ? `too many in a tower: ${inn.length} of ${hi}` : null, { fail: inn.length > hi, status: h.status });
        }
      }
    }

    // What an aimed, lasting or soaked attack does to party member m standing at p (null: nothing).
    effectOn(h, m, p) {
      const party = this.app.party, eff = h.effect || 'hit';
      const ps = this.parts(h);
      if (eff === 'gaze') {
        if (m.slot !== party.playerSlot()) return null;          // the bots look away
        const face = this.playerFacing();
        const look = ps.some(s => {
          if (s.owner === m.slot) return false;                  // the gaze's own target is spared, as in the game
          const d = Math.atan2(s.at[0] - p[0], s.at[1] - p[1]) * 180 / Math.PI;
          return Math.abs(((d - face + 540) % 360) - 180) < 45;
        });
        return look ? { dmg: h.dmg, why: 'looked at the gaze', fail: true, status: h.status } : null;
      }
      if (h.tether !== undefined && (h.stretch || h.within) && ps.some(s => s.owner === m.slot)) {
        const src = this.pointAt(h.tether), d = Math.hypot(p[0] - src[0], p[1] - src[1]);
        if (h.stretch && d < h.stretch) return { dmg: h.fail ?? h.dmg * 3, why: `tether not stretched (${d.toFixed(1)} of ${h.stretch} yalms)`, fail: true };
        if (h.within && d > h.within) return { dmg: h.fail ?? h.dmg * 3, why: `tether stretched too far (${d.toFixed(1)} of ${h.within} yalms)`, fail: true };
      }
      const inn = ps.filter(s => s.shape && inside(s, p, 0.3));
      if (isKnock(h)) return inn.length && h.dmg ? { dmg: h.dmg, soft: true } : null;
      if (!inn.length) return null;
      if (eff === 'share') {
        if (inn.length > 1) return { dmg: h.dmg * inn.length, why: `in ${inn.length} stacks at once`, fail: true };
        const want = h.min || 1, n = party.members().filter(o => inside(inn[0], party.compassOf(o.slot), 0.3)).length;
        const why = n < want ? `a stack short: ${n} of ${want}` : h.max && n > h.max ? `too many in a stack: ${n} of ${h.max}` : null;
        return { dmg: h.dmg * want / Math.max(1, n), why, fail: !!why, status: h.status, soft: true };
      }
      if (eff === 'bait') {
        const others = inn.filter(s => s.owner !== m.slot);
        if (others.length) return { dmg: h.dmg * others.length, why: `in ${others.map(s => s.owner).join(', ')}'s ${h.name}`, fail: true, status: h.status };
        return { dmg: h.own ?? h.dmg, status: h.status, tankbuster: h.buster };
      }
      if (h.falloff) {
        const d = Math.min(...inn.map(s => Math.hypot(p[0] - s.at[0], p[1] - s.at[1])));
        return { dmg: h.dmg * Math.max(0.1, 1 - d / h.falloff), status: h.status };
      }
      return { dmg: h.dmg * inn.length, fail: true, status: h.status };
    }

    // Your facing as a compass bearing: where your character looks (the models' turn, else the way you last moved).
    playerFacing() {
      const ch = this.app.models && this.app.models.ch, e = this.app.engine;
      const yaw = ch && ch.facing !== undefined ? ch.facing : (e.faceYaw ?? Math.PI);
      return -yaw * 180 / Math.PI;
    }

    // ---------- drawing (the scene's ground layer) ----------
    draw(sc, t) {
      if (t === null) t = -1;
      const P = this.plan, ctx = sc.ctx;
      this.fitBox();
      ctx.save();
      this.drawWaymarks(sc);
      for (const mk of P.marks || []) {
        if (t < mk.t0 || t > mk.t1) continue;
        if (mk.kind === 'spotlight') this.poly(sc, [ring(mk.at, mk.r, 32)], false, 'rgba(255,250,225,0.32)', 'rgba(255,255,240,0.9)', 2);
        if (mk.kind === 'lit') this.poly(sc, outline(mk), false, mk.fill || 'rgba(120,200,255,0.16)', null);
      }
      for (const h of P.hazards) {
        if (h.hidden || t < h.tell || t >= h.t) continue;
        if (h.tether !== undefined && !h.tickOf) this.drawTethers(sc, h);
        if (isKnock(h)) { this.drawKnock(sc, h, t); if (!h.shape) continue; }
        if (!h.shape) continue;
        // A puddle that stays shows steadily; anything else darkens as it comes.
        const k = h.tickOf ? 0.6 : Math.max(0, Math.min(1, (t - h.tell) / Math.max(0.5, h.t - h.tell)));
        const s = this.resolveShape(h), look = LOOK[h.effect];
        if (look) { this.drawShape(sc, s, `rgba(${look},${(0.14 + 0.2 * k).toFixed(3)})`, `rgba(${look},${(0.6 + 0.35 * k).toFixed(3)})`); continue; }
        const a0 = s.shape === 'tiles' ? 0.3 : 0.16;      // a lit tile has to show over the dance floor's own glow
        this.drawShape(sc, s, `rgba(255,${Math.round(150 - 60 * k)},60,${(a0 + 0.22 * k).toFixed(3)})`, `rgba(255,190,110,${(0.5 + 0.4 * k).toFixed(3)})`);
      }
      for (const f of this.flashes) {
        const a = 1 - (t - f.t) / 0.45;
        const look = LOOK[f.effect] || '255,240,200';
        if (a > 0 && f.h.shape) this.drawShape(sc, f.h, `rgba(${look},${(0.45 * a).toFixed(3)})`, null);
      }
      // The guide (Settings → Guide): where the strat wants you, a disc in your role's colour like the bots' markers,
      // pulsing while you're away from it with a dotted line to it, white-rimmed once you're on it.
      const me = this.app.party.playerSlot();
      if (me && this.app.store.settings.showSpot !== false) {
        const want = this.guideTarget(me, t < 0 ? null : t), g = this.guide || (this.guide = { p: want.slice(), at: sc.time });
        const k = Math.min(1, (sc.time - g.at) * 12);              // it glides to a new spot rather than jumping
        g.at = sc.time;
        g.p = Math.hypot(want[0] - g.p[0], want[1] - g.p[1]) > 25 ? want.slice() : [g.p[0] + (want[0] - g.p[0]) * k, g.p[1] + (want[1] - g.p[1]) * k];
        const s = g.p;
        const p = this.app.party.compassOf(me), d = Math.hypot(s[0] - p[0], s[1] - p[1]), on = d < 1.1;
        const col = GUIDE_COLOR[B.SLOT_ROLE[me]], pulse = 0.5 + 0.5 * Math.sin(sc.time * 5);
        this.poly(sc, [ring(s, 1.1, 32)], false, `rgba(${col},${on ? 0.6 : 0.42})`, on ? 'rgba(255,255,255,0.95)' : `rgba(${col},1)`, 3);
        if (!on) {
          this.poly(sc, [ring(s, 1.5 + 0.6 * pulse, 32)], false, null, `rgba(${col},${(0.8 - 0.6 * pulse).toFixed(2)})`, 2);
          if (d > 1.8) this.guideLine(sc, p, s, col);
        }
      }
      ctx.restore();
    }

    // A knockback: arrows round its point (or along its direction) the way it throws you; a draw-in's point inward.
    drawKnock(sc, h, t) {
      const pulse = 0.5 + 0.5 * Math.sin(t * 6), col = h.effect === 'pull' ? '120,230,255' : '255,255,255';
      const arrow = (o, deg, r0, r1) => {
        const f = B.bearing(deg, 1), s = [f[1], -f[0]], tip = r1, base = r1 - 1.3;
        const P = (u, v) => [o[0] + f[0] * u + s[0] * v, o[1] + f[1] * u + s[1] * v];
        const pts = h.effect === 'pull' ? [P(r0, 0), P(r0 + 1.3, -0.7), P(r0 + 1.3, 0.7)] : [P(tip, 0), P(base, -0.7), P(base, 0.7)];
        this.poly(sc, [[P(r0 + (h.effect === 'pull' ? 1.3 : 0), -0.15), P(r1 - (h.effect === 'pull' ? 0 : 1.3), -0.15), P(r1 - (h.effect === 'pull' ? 0 : 1.3), 0.15), P(r0 + (h.effect === 'pull' ? 1.3 : 0), 0.15)], pts], false, `rgba(${col},${(0.45 + 0.4 * pulse).toFixed(2)})`, null);
      };
      for (const s of this.parts(h)) {
        if (h.dir !== undefined) {
          for (const off of [-8, 0, 8]) { const side = B.bearing(h.dir + 90, off); arrow([s.at[0] + side[0], s.at[1] + side[1]], h.dir, -4, 4); }
          continue;
        }
        this.poly(sc, [ring(s.at, 1.2, 24)], false, `rgba(${col},0.18)`, `rgba(${col},0.85)`, 2);
        for (let k = 0; k < 8; k++) arrow(s.at, k * 45 + 22.5, 2.2, 2.2 + Math.min(6, (h.dist || 6) * 0.5));
      }
    }

    // A tether: a line from its point to each player it's on.
    drawTethers(sc, h) {
      const ctx = sc.ctx, src = this.pointAt(h.tether), a = sc.project(-src[0], 1.2, src[1]);
      if (!a) return;
      ctx.save();
      ctx.lineWidth = 3;
      for (const s of this.parts(h)) {
        if (!s.owner) continue;
        const p = this.app.party.compassOf(s.owner), b = sc.project(-p[0], 1.2, p[1]);
        if (!b) continue;
        const d = Math.hypot(p[0] - src[0], p[1] - src[1]), ok = (!h.stretch || d >= h.stretch) && (!h.within || d <= h.within);
        ctx.strokeStyle = ok ? 'rgba(120,220,255,0.9)' : 'rgba(255,90,200,0.95)';
        ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
      }
      ctx.restore();
    }

    // A dotted line along the floor from you to your spot, with an arrowhead short of it.
    guideLine(sc, p, s, col) {
      const ctx = sc.ctx, d = Math.hypot(s[0] - p[0], s[1] - p[1]), ux = (s[0] - p[0]) / d, uy = (s[1] - p[1]) / d;
      const pt = (k) => sc.project(-(p[0] + ux * k), 0.05, p[1] + uy * k);
      ctx.save();
      ctx.setLineDash([7, 7]);
      ctx.lineWidth = 2.5;
      ctx.strokeStyle = `rgba(${col},0.9)`;
      ctx.beginPath();
      let open = false;
      for (let k = 0.6; k <= d - 1.3; k += 0.4) {
        const q = pt(k);
        if (!q) { open = false; continue; }
        if (open) ctx.lineTo(q.x, q.y); else { ctx.moveTo(q.x, q.y); open = true; }
      }
      ctx.stroke();
      ctx.setLineDash([]);
      const tip = pt(d - 1.25), l = sc.project(-(p[0] + ux * (d - 2) - uy * 0.55), 0.05, p[1] + uy * (d - 2) + ux * 0.55),
        r = sc.project(-(p[0] + ux * (d - 2) + uy * 0.55), 0.05, p[1] + uy * (d - 2) - ux * 0.55);
      if (tip && l && r) { ctx.fillStyle = `rgba(${col},0.95)`; ctx.beginPath(); ctx.moveTo(tip.x, tip.y); ctx.lineTo(l.x, l.y); ctx.lineTo(r.x, r.y); ctx.closePath(); ctx.fill(); }
      ctx.restore();
    }

    drawShape(sc, s, fill, stroke) {
      if (s.shape === 'multi') { s.parts.forEach(p => this.drawShape(sc, p, fill, stroke)); return; }
      this.poly(sc, outline(s), holed(s), fill, stroke, 2);
    }

    // Polygons of [E, N] on the floor; with holes, the later ones cut out of the first.
    poly(sc, polys, holes, fill, stroke, width) {
      const ctx = sc.ctx, y = 0.03;
      const trace = (poly) => {
        const pts = sc.clipPoly(poly.map(p => sc.toCam(-p[0], y, p[1])), 0.3);
        if (pts.length < 3) return false;
        pts.forEach((c, i) => { const q = sc.fromCam(c); i ? ctx.lineTo(q.x, q.y) : ctx.moveTo(q.x, q.y); });
        ctx.closePath();
        return true;
      };
      const groups = holes ? [polys] : polys.map(p => [p]);
      for (const g of groups) {
        ctx.beginPath();
        let any = false;
        for (const p of g) if (p.length >= 3 && trace(p)) any = true;
        if (!any) continue;
        if (fill) { ctx.fillStyle = fill; ctx.fill(holes ? 'evenodd' : 'nonzero'); }
        if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = width || 2; ctx.stroke(); }
      }
    }

    // The raid's waymarks, as most parties place them: A north, B east, C south, D west; 1-4 the corners.
    drawWaymarks(sc) {
      const ctx = sc.ctx;
      for (const w of this.script.waymarks || []) {
        const col = { red: '255,80,80', yellow: '255,210,70', blue: '80,170,255', purple: '200,110,255' }[w.color];
        const shape = w.square ? [[w.at[0] - 1, w.at[1] - 1], [w.at[0] + 1, w.at[1] - 1], [w.at[0] + 1, w.at[1] + 1], [w.at[0] - 1, w.at[1] + 1]] : ring(w.at, 1.1, 28);
        this.poly(sc, [shape], false, `rgba(${col},0.22)`, `rgba(${col},0.95)`, 2);
        const q = sc.project(-w.at[0], 0.05, w.at[1]);
        if (q && q.s > 6) {
          ctx.font = `700 ${Math.min(26, q.s * 1.1).toFixed(0)}px Saira Semi Condensed, sans-serif`;
          ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
          ctx.fillStyle = `rgba(${col},1)`;
          ctx.fillText(w.label, q.x, q.y);
        }
      }
    }
  }
  const sub = (a, b) => [a[0] - b[0], a[1] - b[1]];
  const DEFAULT_ARENA = { shape: 'square', half: ARENA };
  // How each kind of attack looks on the floor (the rest are the usual orange): towers blue, stacks yellow, spreads
  // and baits purple, gazes magenta.
  const LOOK = { tower: '90,160,255', share: '255,215,80', bait: '190,110,255', gaze: '255,80,200' };
  // The guide's colour, by your spot's role (the party list's: tanks blue, healers green, DPS red).
  const GUIDE_COLOR = { tank: '80,150,255', healer: '90,220,110', melee: '235,80,80', ranged: '235,80,80' };

  // ---------- sequences: the game's moving attacks, as lists of hazards for a script's plan ----------
  // After BossMod's Exaflare, GenericRotatingAOE and ChasingAOEs. Each takes the fight second `t` the first one lands.
  B.mechSeq = {
    // Exaflare: an r-yalm circle from `at` stepping `step` yalms toward bearing `deg` every `every` seconds, n times
    // (or till it leaves the floor); each shows `show` steps ahead of the one going off.
    exaflare({ at, deg, t, n, r = 6, step = 6.5, every = 1.1, show = 3, dmg = 0.5, name = 'Exaflare', half = ARENA }) {
      const f = B.bearing(deg, 1), out = [];
      for (let k = 0; n ? k < n : true; k++) {
        const p = [at[0] + f[0] * step * k, at[1] + f[1] * step * k];
        if (!n && (Math.abs(p[0]) > half + r || Math.abs(p[1]) > half + r)) break;
        out.push({ t: t + k * every, tell: t + (k - show) * every, shape: 'circle', at: p, r, dmg, name, react: every * show });
        if (k > 40) break;
      }
      return out;
    },
    // A rotating cleave: a cone (or a line: shape 'line', len, w) round `at` turning `by` degrees every `every`
    // seconds, n hits; the next two show.
    rotating({ at = [0, 0], deg, by, t, n, every, shape = 'cone', r = 40, half = 30, len, w, back, dmg = 0.6, name = 'Rotating cleave' }) {
      return Array.from({ length: n }, (_, k) => ({ t: t + k * every, tell: t + (k - 2) * every, shape, at, deg: deg + by * k, r, half, len, w, back, dmg, name, react: every * 2 }));
    },
    // A chasing puddle: n r-yalm circles on `target`, the first where they stand `snap` seconds before it lands,
    // each after it at most `move` yalms on from the last toward them (keep running).
    chase({ target, t, n, every, r = 6, move = 6, snap = 0.5, dmg = 0.5, name = 'Chasing puddle' }) {
      const out = [];
      for (let k = 0; k < n; k++) {
        out.push({ t: t + k * every, tell: t + (k - 1) * every - 1, shape: 'circle', r, from: 'target', targets: [target], snap, dmg, name,
          after: k ? out[k - 1] : undefined, move: k ? move : undefined });
      }
      return out;
    },
  };

  // ---------- the self-check (/qa) ----------
  // Fast-forwards whole pulls of the fight with you playing a spot perfectly (running at 6 yalms a second to where
  // the strat and the dodging put you) and the bots playing theirs, for each strat and spot asked for, and lists
  // everything that hit anyone it shouldn't have: an attack landing on someone, or a stack, spread, spotlight or
  // merge you'd fail by doing what the strat says. Tank busters on the tanks and shared stacks don't count.
  // Each run is picked fresh (sides, orders, patterns), so a few runs per strat catch the rarer combinations.
  B.mechQA = async function (app, opts) {
    const f = app.fight, P = app.party, e = app.engine, st = app.store.settings;
    if (!f || !f.mech) return null;
    const strats = opts.strats || Object.keys(f.script.strats), slots = opts.slots || B.SLOTS, reps = opts.reps || 1;
    const keep = { strats: Object.assign({}, st.strats), slot: st.partySlot, dmg: st.takeDamage, pos: Object.assign({}, e.pos) };
    if (app.enc) app.endEncounter(e.now, 'idle');
    const hurt = P.hurt, issues = [];
    let runs = 0;
    try {
      for (let rep = 0; rep < reps; rep++) for (const strat of strats) for (const slot of slots) {
        (st.strats = Object.assign({}, keep.strats))[f.key] = strat;
        st.partySlot = slot;
        f.reset(); P.setup(); app.placeStart();
        const me = P.playerSlot(), dt = 0.05, end = f.data.enrage;
        P.hurt = (s, share, src, why) => {
          if ((share >= 0.6 && src !== 'Deep Cut') || why) issues.push({ strat, slot, t: f.t, who: s, what: src, why: why || 'stood in it', at: P.compassOf(s).map(v => +v.toFixed(1)) });
        };
        for (let i = 0; i * dt < end; i++) {
          const t = i * dt;
          f.t = t;
          const s = B.toSim(f.mech.target(me, t, P.compassOf(me)));
          const dx = s.x - e.pos.x, dz = s.z - e.pos.z, d = Math.hypot(dx, dz), step = Math.min(d, 6 * dt);
          if (d > 0.01 && !P.knocked(me)) { e.pos.x += dx / d * step; e.pos.z += dz / d * step; }
          f.mech.update(t);
          P.update(dt);
        }
        P.hurt = hurt;
        runs++;
        if (opts.progress) opts.progress(runs, reps * strats.length * slots.length);
        await new Promise(r => setTimeout(r, 0));
      }
    } finally {
      P.hurt = hurt;
      st.strats = keep.strats; st.partySlot = keep.slot; st.takeDamage = keep.dmg;
      f.t = null; f.reset(); P.setup(); app.placeStart();
    }
    return { runs, issues };
  };

  // ---------- against real kills (/qa logs) ----------
  // Plays a pull of the fight with its reference strat (the logs' parties play Hector's) and, at each mechanic the
  // fight's reference file has (js/fights/<key>_ref.js, made by tools/fflogs_<key>_ref.py from FFLogs kills),
  // measures how far each party spot stands from where real players stood. Layouts that change each pull are turned
  // the same way the reference was: the twist's plays mirrored to the east, Frogtourage's corridor north-south.
  const SAMPLE = {
    'Celebrate Good Times': { at: (ev, L) => ev.name === 'Celebrate Good Times' },
    'Deep Cut': { at: (ev, L) => ev.name === 'Deep Cut' },
    'Play A-side': { at: (ev, L) => L === 'Play A-side', norm: 'east' },
    'Play B-side': { at: (ev, L) => L === 'Play B-side', norm: 'east' },
    'Frogtourage 1 spread': { at: (ev, L) => L === 'Eighth Beats' && ev.t > 300 && ev.t < 330, norm: 'corridor' },
    'Frogtourage 1 stack': { at: (ev, L) => L === 'Quarter Beats' && ev.t > 300 && ev.t < 330, norm: 'corridor' },
    'Back-Up Dance 1 (Disco 2)': { at: (ev, L) => ev.name === 'Back-up Dance', nth: 0 },
    'Back-Up Dance 3 (Frogtourage 2)': { at: (ev, L) => ev.name === 'Back-up Dance', nth: 2 },
    'Back-Up Dance 4 (Frogtourage 2)': { at: (ev, L) => ev.name === 'Back-up Dance', nth: 3 },
  };
  const median = (a) => { const b = a.slice().sort((x, y) => x - y); return b.length ? b[Math.floor(b.length / 2)] : 0; };
  function normalise(p, how) {
    if (how === 'east') {
      const s = median(Object.values(p).map(v => v[0])) >= 0 ? 1 : -1;
      return Object.fromEntries(Object.entries(p).map(([k, v]) => [k, [v[0] * s, v[1]]]));
    }
    if (how === 'corridor') {
      const sd = (a) => { const m = a.reduce((x, y) => x + y, 0) / a.length; return Math.sqrt(a.reduce((x, y) => x + (y - m) ** 2, 0) / a.length); };
      if (sd(Object.values(p).map(v => v[0])) > sd(Object.values(p).map(v => v[1]))) p = Object.fromEntries(Object.entries(p).map(([k, v]) => [k, [v[1], -v[0]]]));
      if (p.MT[1] < 0) p = Object.fromEntries(Object.entries(p).map(([k, v]) => [k, [-v[0], -v[1]]]));
    }
    return p;
  }
  B.mechLogCheck = async function (app, opts = {}) {
    const f = app.fight, P = app.party, e = app.engine, st = app.store.settings;
    const ref = f && (B.FIGHT_REFS || {})[f.key];
    if (!f || !f.mech || !ref) return null;
    const keep = { strats: Object.assign({}, st.strats), slot: st.partySlot };
    if (app.enc) app.endEncounter(e.now, 'idle');
    const hurt = P.hurt, rows = {};
    try {
      for (let rep = 0; rep < (opts.reps || 3); rep++) {
        (st.strats = Object.assign({}, keep.strats))[f.key] = opts.strat || f.script.defaultStrat;
        st.partySlot = opts.slot || 'R2';
        f.reset(); P.setup(); app.placeStart();
        P.hurt = () => {};
        // When each reference mechanic happens in this pull.
        const want = [], count = {};
        for (const ev of f.events) {
          const L = f.label(ev);
          for (const [name, s] of Object.entries(SAMPLE)) {
            if (!ref.mechs[name] || !s.at(ev, L)) continue;
            count[name] = (count[name] || 0) + 1;
            if (count[name] - 1 === (s.nth || 0)) want.push({ name, t: ev.t, norm: s.norm });
          }
        }
        const me = P.playerSlot(), dt = 0.05, end = Math.max(...want.map(w => w.t)) + 0.1;
        let next = 0;
        want.sort((a, b) => a.t - b.t);
        for (let i = 0; i * dt < end; i++) {
          const t = i * dt;
          f.t = t;
          const s = B.toSim(f.mech.target(me, t, P.compassOf(me)));
          const dx = s.x - e.pos.x, dz = s.z - e.pos.z, d = Math.hypot(dx, dz), step = Math.min(d, 6 * dt);
          if (d > 0.01 && !P.knocked(me)) { e.pos.x += dx / d * step; e.pos.z += dz / d * step; }
          f.mech.update(t);
          P.update(dt);
          while (next < want.length && want[next].t <= t) {
            const w = want[next++];
            const p = normalise(Object.fromEntries(B.SLOTS.map(sl => [sl, P.compassOf(sl).slice()])), w.norm);
            (rows[w.name] = rows[w.name] || []).push(p);
          }
        }
        P.hurt = hurt;
        await new Promise(r => setTimeout(r, 0));
      }
    } finally {
      P.hurt = hurt;
      st.strats = keep.strats; st.partySlot = keep.slot;
      f.t = null; f.reset(); P.setup(); app.placeStart();
    }
    // Per mechanic: each spot's distance from the logs' median (the sim's own median over its runs), and the typical
    // spread of real players around theirs, for scale.
    const out = [];
    for (const [name, r] of Object.entries(ref.mechs)) {
      const runs = rows[name];
      if (!runs) { out.push({ name, missing: true }); continue; }
      const slots = B.SLOTS.filter(s => r.spots[s]).map(s => {
        const sim = [median(runs.map(p => p[s][0])), median(runs.map(p => p[s][1]))], log = r.spots[s];
        return { slot: s, sim, log: [log[0], log[1]], off: Math.hypot(sim[0] - log[0], sim[1] - log[1]), spread: log[2], loose: log[2] > 6 };
      });
      // A spot real players were all over (more than 6 yalms from their median, typically) says little: left out.
      const firm = slots.filter(s => !s.loose);
      out.push({ name, kills: r.n, mean: firm.reduce((a, b) => a + b.off, 0) / Math.max(1, firm.length), slots: firm, loose: slots.filter(s => s.loose).map(s => s.slot) });
    }
    return { kills: ref.kills, mechs: out };
  };

  B.Mechanics = Mechanics;
  B.MECH_ARENA = ARENA;
})(window.BLM);
