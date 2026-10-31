// A fight's mechanics, from its script (js/fights/<key>.js): the boss's attacks as shapes on the floor (shown while
// they're coming, then landing), where the chosen strat puts each of the eight party spots, where the party's bots
// actually go (their strat spot, moved to the nearest safe ground while something is about to land there), and
// what hits you. Scripts work in compass yalms from the arena's middle: [east, north]. The sim's floor is x = west,
// z = north (the boss at the origin), so a point [E, N] is { x: -E, z: N }.
(function (B) {
  const ARENA = 20;                 // half an arena's side: 40 yalms square, 8 x 8 tiles of 5
  const TILE = 5;
  B.SLOTS = ['MT', 'OT', 'H1', 'H2', 'M1', 'M2', 'R1', 'R2'];
  B.SLOT_ROLE = { MT: 'tank', OT: 'tank', H1: 'healer', H2: 'healer', M1: 'melee', M2: 'melee', R1: 'ranged', R2: 'ranged' };
  B.toSim = (p) => ({ x: -p[0], z: p[1] });
  B.toCompass = (q) => [-q.x, q.z];
  const rad = (deg) => deg * Math.PI / 180;
  // A compass bearing (0 = north, 90 = east) and a distance, as [E, N].
  B.bearing = (deg, r) => [Math.sin(rad(deg)) * r, Math.cos(rad(deg)) * r];
  const wrap = (a) => { while (a > Math.PI) a -= 2 * Math.PI; while (a < -Math.PI) a += 2 * Math.PI; return a; };
  const tileOf = (v) => Math.max(0, Math.min(7, Math.floor((v + ARENA) / TILE)));
  const clampArena = (p) => [Math.max(-ARENA + 0.8, Math.min(ARENA - 0.8, p[0])), Math.max(-ARENA + 0.8, Math.min(ARENA - 0.8, p[1]))];

  // ---------- shapes ----------
  // Whether point p ([E, N]) is in the shape, grown by m yalms (a body's width when it lands; more for the bots, who
  // keep clear). Shapes: circle {at, r}, donut {at, r0} (everything past r0), half {dir: [dE, dN]} (the half of the
  // room that way), wedge {deg, half} (everything outside the wedge of +-half degrees round that bearing), rect {a, b}
  // (two corners), tiles {parity} (the checkerboard's tiles of that colour), cols {cols} (whole columns of tiles,
  // west to east, 0-7), cone {at, deg, half, r}.
  function inside(h, p, m) {
    const at = h.at || [0, 0], dx = p[0] - at[0], dy = p[1] - at[1], d = Math.hypot(dx, dy);
    switch (h.shape) {
      case 'circle': return d < h.r + m;
      case 'donut': return d > h.r0 - m;
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
        if (d > h.r + m || d < 0.01) return d < 0.01;
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
  const SQUARE = [[-ARENA, -ARENA], [ARENA, -ARENA], [ARENA, ARENA], [-ARENA, ARENA]];
  const toArena = (poly) => clip(clip(clip(clip(poly, 1, 0, -ARENA), -1, 0, -ARENA), 0, 1, -ARENA), 0, -1, -ARENA);
  const ring = (at, r, n) => Array.from({ length: n }, (_, i) => [at[0] + Math.sin(i / n * 2 * Math.PI) * r, at[1] + Math.cos(i / n * 2 * Math.PI) * r]);
  function outline(h) {
    const at = h.at || [0, 0];
    switch (h.shape) {
      case 'circle': return [toArena(ring(at, h.r, 48))];
      case 'donut': return [SQUARE, ring(at, h.r0, 48)];
      case 'half': return [clip(SQUARE, h.dir[0], h.dir[1], h.off || 0)];
      case 'wedge': {
        const a = rad(h.deg), w = rad(h.half), far = 80;
        const tri = toArena([[0, 0], [Math.sin(a - w) * far, Math.cos(a - w) * far], [Math.sin(a) * far, Math.cos(a) * far], [Math.sin(a + w) * far, Math.cos(a + w) * far]]);
        return [SQUARE, tri];
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
        const pts = [at];
        for (let i = 0; i <= 16; i++) {
          const a = rad(h.deg - h.half + (2 * h.half) * i / 16);
          pts.push([at[0] + Math.sin(a) * h.r, at[1] + Math.cos(a) * h.r]);
        }
        return [toArena(pts)];
      }
      default: return [];
    }
  }
  // Whether the outline's later polygons are holes in the first (a donut, a wedge's complement) or separate pieces.
  const holed = (h) => h.shape === 'donut' || h.shape === 'wedge';

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
      return p;
    }

    // The attacks the bots are dodging at second t: the next to land that's already showing and close enough to
    // need moving for, with anything landing with it. (Aimed attacks, cones and proteans, the strat's spots
    // already keep clear of, and the bots ignore.)
    // (With the next ones close behind, 1.6 s, as `soon`: a spot safe from those too saves a dash between them.)
    dodging(t, soon) {
      if (t === null) return [];
      let first = null;
      const out = [];
      for (const h of this.plan.hazards) {
        if (h.t <= t || h.aimed || !h.shape) continue;
        if (h.tell > t || h.t - t > (h.react ?? 3)) continue;
        if (first === null) first = h.t;
        if (h.t - first > (soon ? 1.6 : 0.35)) break;
        out.push(h);
      }
      return out;
    }

    // The nearest point to p out of every attack in hz (searching out to `reach` yalms), or null.
    nearestSafe(p, hz, reach) {
      const safe = (q) => hz.every(h => !inside(h, q, 1.1));
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
        best = (soon.length > hz.length && this.nearestSafe(pref, soon, 20)) || this.nearestSafe(pref, hz, 40) || pref;
        this.solved[slot] = { key, p: best };
      }
      // Too far to make in time: of the safe ground it can reach first, the point nearest that spot.
      if (pos) {
        const left = hz[0].t - t, run = Math.hypot(best[0] - pos[0], best[1] - pos[1]) / 6;
        if (run > left - 0.1) return this.reachable(pos, 6 * Math.max(0, left - 0.15), hz, best) || this.nearestSafe(pos, hz, 40) || best;
      }
      return best;
    }

    reachable(pos, reach, hz, goal) {
      const safe = (q) => hz.every(h => !inside(h, q, 1.1));
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
      if (t === null) return;
      while (this.nextHz < P.hazards.length && P.hazards[this.nextHz].t <= t) this.land(P.hazards[this.nextHz++]);
      while (this.nextCk < P.checks.length && P.checks[this.nextCk].t <= t) this.check(P.checks[this.nextCk++]);
      while (this.nextCall < P.calls.length && P.calls[this.nextCall].t <= t) {
        const c = P.calls[this.nextCall++];
        if (!c.slot || c.slot === party.playerSlot()) this.app.ui.callout(c.text, c.dur || 5, c.alert);
      }
      this.flashes = this.flashes.filter(f => t - f.t < 0.45);
    }

    // An attack lands: on you if you're in it (and on a bot that's in it, though they shouldn't be).
    land(h) {
      const party = this.app.party;
      this.flashes.push({ h: this.resolveShape(h), t: h.t });
      for (const m of party.members()) {
        const hit = this.hits(h, m);
        if (hit) party.hurt(m.slot, hit.dmg, h.name, hit.why);
      }
      // A protean's echo lands later where everyone stood for this one.
      if (h.snapshot) this.lastProtean = party.members().map(m => party.bearingOf(m.slot));
      if (h.target) this.snap[h.id] = party.bearingOf(h.target);
    }

    // A protean's cones: one at each party member (and whose it is), or the echo's, where they stood last time.
    protean(h) {
      const party = this.app.party;
      if (h.target) return { degs: [party.bearingOf(h.target)], slots: [h.target] };       // at one player
      if (h.echoOf) return { degs: this.snap[h.echoOf] === undefined ? [] : [this.snap[h.echoOf]], slots: [] };
      if (h.echo) return { degs: this.lastProtean || [], slots: [] };
      const ms = party.members();
      return { degs: ms.map(m => party.bearingOf(m.slot)), slots: ms.map(m => m.slot) };
    }

    // An aimed attack's shape at the moment it lands (a cone pointed at whoever it targets).
    resolveShape(h) {
      if (h.shape === 'tankcones') {
        const party = this.app.party;
        return { shape: 'multi', parts: h.slots.map(s => ({ shape: 'cone', at: [0, 0], deg: party.bearingOf(s), half: h.half, r: h.r })) };
      }
      if (h.shape === 'protean') {
        return { shape: 'multi', parts: this.protean(h).degs.map(d => ({ shape: 'cone', at: [0, 0], deg: d, half: h.half, r: h.r })) };
      }
      return h;
    }

    // What an attack does to party member m: { dmg (a share of the reference HP), why } or null.
    hits(h, m) {
      const party = this.app.party, p = party.compassOf(m.slot);
      if (h.raidwide) return { dmg: h.dmg };
      if (h.shape === 'tankcones') {
        // Deep Cut: a cone at each tank; a tank in their own takes the buster, anyone else in one is cleaved.
        let mine = false, other = 0;
        for (const s of h.slots) {
          const c = { shape: 'cone', at: [0, 0], deg: party.bearingOf(s), half: h.half, r: h.r };
          if (s === m.slot) mine = true;
          else if (inside(c, p, 0.3)) other++;
        }
        if (other) return { dmg: h.dmg * other, why: 'in a tank cleave' };
        return mine ? { dmg: h.buster, tankbuster: true } : null;
      }
      if (h.shape === 'protean') {
        // Proteans: a cone at everyone (the echo: at where everyone stood last time). Your own lands softly; anyone
        // else's on you hurts.
        let n = 0, mine = false;
        const { degs, slots } = this.protean(h);
        degs.forEach((d, i) => {
          if (!inside({ shape: 'cone', at: [0, 0], deg: d, half: h.half, r: h.r }, p, 0.3)) return;
          if (slots[i] === m.slot) mine = true; else n++;
        });
        if (n) return { dmg: h.dmg * n, why: h.echo ? 'in an echo' : 'in someone else\'s protean' };
        return mine ? { dmg: h.own || 0.12 } : null;
      }
      if (!h.shape) return null;
      return inside(h, p, 0.3) ? { dmg: h.dmg } : null;
    }

    // A check that only you can fail (the bots stand where the strat says): a stack you're not in, a spread you're
    // too close to someone for, a spotlight you're not standing in when your debuff runs out.
    check(c) {
      const party = this.app.party, me = party.playerSlot();
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
        if (d > c.r + 0.5) party.hurt(me, c.fail, c.name, `not merged with ${mate}`);
        else if (others.length) party.hurt(me, c.fail, c.name, `${others.map(m => m.slot).join(', ')} in your merge`);
        else this.app.ui.log(`Wavelength: you merge with ${mate}.`, 'gain', 'battle');
      } else if (c.kind === 'spotlight') {
        const lit = c.lights.some(l => Math.hypot(l[0] - p[0], l[1] - p[1]) < c.r);
        if (lit) this.app.ui.log(`You cleanse ${c.name} in a spotlight.`, 'gain', 'battle');
        else party.hurt(me, c.fail, c.name, 'not in a spotlight when it ran out');
      } else if (c.kind === 'spot' && spot) {
        if (Math.hypot(spot[0] - p[0], spot[1] - p[1]) > c.r) party.hurt(me, c.fail, c.name, 'not at your spot');
      }
    }

    // ---------- drawing (the scene's ground layer) ----------
    draw(sc, t) {
      if (t === null) t = -1;
      const P = this.plan, ctx = sc.ctx;
      ctx.save();
      this.drawWaymarks(sc);
      for (const mk of P.marks || []) {
        if (t < mk.t0 || t > mk.t1) continue;
        if (mk.kind === 'spotlight') this.poly(sc, [ring(mk.at, mk.r, 32)], false, 'rgba(255,250,225,0.32)', 'rgba(255,255,240,0.9)', 2);
        if (mk.kind === 'lit') this.poly(sc, outline(mk), false, mk.fill || 'rgba(120,200,255,0.16)', null);
      }
      for (const h of P.hazards) {
        if (!h.shape || h.hidden || t < h.tell || t >= h.t) continue;
        const k = Math.max(0, Math.min(1, (t - h.tell) / Math.max(0.5, h.t - h.tell)));
        const s = this.resolveShape(h);
        const a0 = s.shape === 'tiles' ? 0.3 : 0.16;      // a lit tile has to show over the dance floor's own glow
        this.drawShape(sc, s, `rgba(255,${Math.round(150 - 60 * k)},60,${(a0 + 0.22 * k).toFixed(3)})`, `rgba(255,190,110,${(0.5 + 0.4 * k).toFixed(3)})`);
      }
      for (const f of this.flashes) {
        const a = 1 - (t - f.t) / 0.45;
        if (a > 0 && f.h.shape) this.drawShape(sc, f.h, `rgba(255,240,200,${(0.45 * a).toFixed(3)})`, null);
      }
      // Where the strat wants you (Settings → Show my spot).
      const me = this.app.party.playerSlot();
      if (me && this.app.store.settings.showSpot !== false) {
        const s = this.target(me, t < 0 ? null : t, this.app.party.compassOf(me));
        const pulse = 0.8 + 0.2 * Math.sin(sc.time * 5);
        this.poly(sc, [ring(s, 0.9 * pulse, 24)], false, 'rgba(90,230,255,0.18)', 'rgba(120,240,255,0.95)', 2.5);
      }
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
          if (d > 0.01) { e.pos.x += dx / d * step; e.pos.z += dz / d * step; }
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
          if (d > 0.01) { e.pos.x += dx / d * step; e.pos.z += dz / d * step; }
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
