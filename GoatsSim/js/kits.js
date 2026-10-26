// What each hero can do, used by the bots and by the player's Reinhardt alike, plus the shared rules for
// resolving melee arcs, hitscan, beams and projectiles against barriers, Defense Matrix and walls.
(function (G) {
  const T = THREE;
  const v1 = new T.Vector3(), v2 = new T.Vector3(), v3 = new T.Vector3();

  function angleTo(u, p) {
    let a = Math.atan2(p.x - u.pos.x, p.z - u.pos.z) - u.yaw;
    while (a > Math.PI) a -= 2 * Math.PI;
    while (a < -Math.PI) a += 2 * Math.PI;
    return a;
  }

  // ---------------------------------------------------------------- shared resolution
  const C = {
    // first enemy barrier (relative to `team`) crossing a->b: { barrier, t } or null
    barrierBetween(g, a, b, team) {
      let best = null;
      for (const u of g.units) {
        if (u.team === team || !u.barrier || !u.barrier.up) continue;
        const t = u.barrier.hit(a, b);
        if (t >= 0 && (!best || t < best.t)) best = { barrier: u.barrier, t };
      }
      return best;
    },

    // an enemy D.Va whose Defense Matrix covers point p (relative to `team`)
    matrixAt(g, p, team) {
      for (const d of g.byHero(1 - team, 'dva')) {
        if (!d.alive || !d.mech || !(d.st.matrix > g.time)) continue;
        const e = d.eye(v3), dist = e.distanceTo(p);
        if (dist > G.HEROES.dva.matrix.range || dist < 0.5) continue;
        const dir = v2.copy(p).sub(e).normalize(), aim = d.aimDir(v1);
        if (dir.dot(aim) > Math.cos(0.42)) return d;
      }
      return null;
    },

    // instant shot from u to target: barriers, matrix (if eatable) and walls stop it. Returns damage dealt.
    hitscan(u, target, dmg, opts = {}) {
      const g = u.game, a = opts.from || u.eye(new T.Vector3()), b = target.center(new T.Vector3());
      const bb = C.barrierBetween(g, a, b, u.team);
      if (bb) { bb.barrier.damage(dmg, u); g.fx.impact(a.clone().lerp(b, bb.t), opts.color || 0xffffff, 0.3); return 0; }
      if (opts.eatable !== false) {
        const d = C.matrixAt(g, a.clone().lerp(b, 0.5), u.team) || C.matrixAt(g, b, u.team);
        if (d && d.eye(v1).distanceTo(a) > 1.5) { g.fx.matrixEat(d, a.clone().lerp(b, 0.5)); d.addUlt(dmg * 0.3); return 0; }
      }
      if (!g.world.los(a, b)) return 0;
      u.stats.hits++;
      return target.damage(dmg, u, opts.kind || 'hit');
    },

    // melee arc in front of u. Barriers in reach soak it for whatever is behind them.
    melee(u, range, arc, dmg, kind) {
      const g = u.game, eye = u.center(new T.Vector3());
      const hit = [];
      let soaked = null;
      for (const b of g.units) {
        if (b.team === u.team || !b.barrier || !b.barrier.up) continue;
        // barrier surface point straight ahead of u
        const ahead = eye.clone().add(u.fwd(v1).multiplyScalar(range));
        const t = b.barrier.hit(eye, ahead);
        if (t >= 0) { soaked = b.barrier; break; }
      }
      for (const e of g.enemiesOf(u.team)) {
        if (!e.alive) continue;
        const d = Math.hypot(e.pos.x - u.pos.x, e.pos.z - u.pos.z) - e.radius;
        if (d > range || Math.abs(e.pos.y - u.pos.y) > 2.6) continue;
        if (Math.abs(angleTo(u, e.pos)) > arc / 2 + 0.15) continue;
        const c = e.center(v2);
        if (C.barrierBetween(g, eye, c, u.team)) continue;
        if (!g.world.los(eye, c, 0.6)) continue;
        hit.push(e);
      }
      if (soaked) { soaked.damage(dmg, u); g.fx.impact(soaked.owner.center(v1).add(u.fwd(v2).multiplyScalar(-1)), 0x8fd8ff, 0.5); }
      for (const e of hit) { u.stats.hits++; e.damage(dmg, u, kind); g.fx.impact(e.center(v1), 0xffd28a, 0.5); }
      return { hit, soaked };
    },

    projectile(u, o) {
      const p = new G.Projectile(Object.assign({ owner: u, team: u.team }, o));
      u.game.projectiles.push(p);
      u.game.fx.projectile(p);
      return p;
    },

    // advance every projectile one tick
    tickProjectiles(g, dt) {
      for (const p of g.projectiles) {
        if (p.dead) continue;
        p.life -= dt;
        const a = p.pos.clone(), b = p.pos.clone().addScaledVector(p.vel, dt);
        if (p.gravity) p.vel.y -= p.gravity * dt;
        // Defense Matrix
        if (p.eatable && C.matrixAt(g, b, p.team)) {
          const d = C.matrixAt(g, b, p.team);
          g.fx.matrixEat(d, b); d.addUlt((p.dmg || 10) * 0.3);
          p.dead = true; continue;
        }
        // barriers
        if (!p.throughBarriers) {
          const bb = C.barrierBetween(g, a, b, p.team);
          if (bb) {
            const at = a.clone().lerp(b, bb.t);
            if (p.onBarrier) p.onBarrier(bb.barrier, at); else bb.barrier.damage(p.dmg || 0, p.owner);
            g.fx.impact(at, p.color || 0xffffff, 0.4);
            p.dead = true; continue;
          }
        }
        // units
        let stopped = false;
        for (const e of g.units) {
          if (!e.alive || e.team === p.team || p.hitList.has(e)) continue;
          const c = e.center(v1), r = e.radius + p.radius, h = e.height * 0.55;
          // distance from segment to the unit's vertical capsule axis
          const seg = v2.copy(b).sub(a), len2 = seg.lengthSq() || 1e-9;
          const tt = Math.max(0, Math.min(1, v3.copy(c).sub(a).dot(seg) / len2));
          const q = a.clone().addScaledVector(seg, tt);
          const dy = Math.max(0, Math.abs(q.y - c.y) - h);
          const dxz = Math.hypot(q.x - c.x, q.z - c.z);
          if (dxz < r && dy < p.radius + 0.1) {
            p.hitList.add(e);
            if (p.onHit) p.onHit(e, q); else if (p.dmg) { p.owner.stats.hits++; e.damage(p.dmg, p.owner, p.kindName || p.kind); }
            g.fx.impact(q, p.color || 0xffffff, 0.35);
            if (!p.pierce) { stopped = true; break; }
          }
        }
        if (stopped) { p.dead = true; continue; }
        // walls / ground
        if (g.world.solidAt(b.x, b.y, b.z) || p.life <= 0 || (p.target && b.distanceTo(p.target) < p.vel.length() * dt)) {
          if (p.onEnd) p.onEnd(b);
          if (!p.quiet) g.fx.impact(b, p.color || 0xffffff, 0.25);
          p.dead = true; continue;
        }
        p.pos.copy(b);
      }
      g.projectiles = g.projectiles.filter((p) => !p.dead);
    },

    // splash damage around p (Zarya alt-fire, micro missiles), with line of sight from p
    splash(u, p, radius, dmg, kind) {
      const g = u.game;
      for (const e of g.enemiesOf(u.team)) {
        if (!e.alive) continue;
        const c = e.center(v1), d = c.distanceTo(p);
        if (d > radius + e.radius) continue;
        if (!g.world.los(p, c, 0.3)) continue;
        e.damage(dmg * (d < 0.8 ? 1 : 0.6), u, kind);
      }
    },

    angleTo,
  };

  // ---------------------------------------------------------------- Reinhardt
  const reinhardt = {
    init(u) { u.barrier = new G.Barrier(u, u.H.barrier); u.swingDir = 1; },
    tick(u, dt) {
      const g = u.game, t = g.time, H = u.H;
      u.barrier.tick(dt);
      if (u.barrier.up && (!u.canAct() || u.action || u.has('charging'))) { u.barrier.up = false; u.barrier.lastDown = t; }
      const a = u.action;
      if (a) {
        a.t += dt;
        if (a.name === 'swing' && !a.hit && a.t >= H.hammer.hitAt) {
          a.hit = true;
          const r = C.melee(u, H.hammer.range, H.hammer.arc * 2, H.hammer.dmg, 'Rocket Hammer');
          g.emit('swing', { unit: u, hits: r.hit.length, soaked: !!r.soaked });
        }
        if (a.name === 'fire' && !a.fired && a.t >= H.fireStrike.windup) {
          a.fired = true;
          const F = H.fireStrike, dir = u.fwd(new T.Vector3());
          C.projectile(u, {
            kind: 'fireStrike', pos: u.pos.clone().add(new T.Vector3(0, 1.3, 0)).addScaledVector(dir, 0.8),
            vel: dir.clone().multiplyScalar(F.speed), radius: F.radius, dmg: F.dmg, life: F.range / F.speed,
            pierce: true, throughBarriers: true, eatable: true, color: 0xff7a1a,
            onHit: (e) => { u.stats.hits++; e.damage(F.dmg, u, 'Fire Strike'); g.emit('fireStrikeHit', { unit: u, target: e }); },
          });
          g.audio.play('fire', u.pos);
        }
        if (a.name === 'shatter' && !a.done && a.t >= H.shatter.windup) { a.done = true; reinhardt.resolveShatter(u); }
        if (a.t >= a.dur) u.action = null;
      }
      if (u.st.charging > t) reinhardt.chargeTick(u, dt);
      else if (u.chargeState) reinhardt.endCharge(u, false);
    },
    swing(u) {
      const t = u.game.time;
      if (!u.canAct() || u.action || u.barrier.up || u.st.charging > t) return false;
      u.action = { name: 'swing', t: 0, dur: u.H.hammer.period, dir: u.swingDir };
      u.swingDir *= -1;
      u.game.audio.play('swing', u.pos);
      return true;
    },
    shield(u, on) {
      const t = u.game.time;
      if (on) {
        if (u.barrier.up || u.action || !u.canAct() || u.st.charging > t || !u.barrier.canRaise()) return false;
        u.barrier.up = true;
        return true;
      }
      if (u.barrier.up) { u.barrier.up = false; u.barrier.lastDown = t; }
      return true;
    },
    charge(u) {
      const g = u.game, t = g.time;
      if (!u.ready('charge') || !u.canAct() || u.action || u.has('grav')) return false;
      u.barrier.up = false;
      u.st.charging = t + u.H.charge.dur;
      u.chargeState = { pinned: null, hit: new Set(), start: t };
      g.audio.play('charge', u.pos);
      g.emit('charge', { unit: u });
      return true;
    },
    chargeTick(u, dt) {
      const g = u.game, H = u.H.charge, cs = u.chargeState;
      if (!u.alive || u.stunned()) { reinhardt.endCharge(u, false); return; }
      const dir = u.fwd(new T.Vector3());
      const r = g.world.slide(u.pos, dir.x * H.speed * dt, dir.z * H.speed * dt, false);
      const moved = Math.hypot(r.x - u.pos.x, r.z - u.pos.z);
      u.pos.x = r.x; u.pos.z = r.z;
      if (!isNaN(r.g)) u.pos.y = r.g;
      // carry the pinned target in front
      if (cs.pinned) {
        const p = cs.pinned;
        p.pos.set(u.pos.x + dir.x * 1.2, u.pos.y + 0.6, u.pos.z + dir.z * 1.2);
        p.vel.set(0, 0, 0);
      }
      for (const e of g.enemiesOf(u.team)) {
        if (!e.alive || cs.hit.has(e) || e === cs.pinned) continue;
        const d = Math.hypot(e.pos.x - u.pos.x, e.pos.z - u.pos.z);
        if (d > u.radius + e.radius + 0.6 || Math.abs(C.angleTo(u, e.pos)) > 1.0 || Math.abs(e.pos.y - u.pos.y) > 2) continue;
        cs.hit.add(e);
        if (e.hero === 'reinhardt' && e.has('charging')) {   // charge-off: both stop
          e.damage(H.bump, u, 'Charge'); u.damage(H.bump, e, 'Charge');
          reinhardt.endCharge(u, false); reinhardt.endCharge(e, false);
          return;
        }
        if (!cs.pinned && !e.has('trans')) {
          cs.pinned = e;
          e.st.pinned = g.time + 5;
          e.damage(H.bump, u, 'Charge');
          g.emit('pin', { unit: u, target: e });
        } else {
          e.damage(H.bump, u, 'Charge');
          const side = new T.Vector3(e.pos.x - u.pos.x, 0, e.pos.z - u.pos.z);
          side.sub(dir.clone().multiplyScalar(side.dot(dir))).normalize();
          e.knock(side.lengthSq() ? side : new T.Vector3(-dir.z, 0, dir.x), 9, 3);
        }
      }
      if (r.blocked || moved < H.speed * dt * 0.3) reinhardt.endCharge(u, true);
    },
    endCharge(u, wall) {
      const g = u.game, cs = u.chargeState;
      u.st.charging = 0;
      u.chargeState = null;
      u.use('charge', u.H.charge.cd);
      if (!cs) return;
      if (cs.pinned) {
        const p = cs.pinned;
        p.st.pinned = 0;
        if (p.alive) { p.damage(u.H.charge.pin, u, 'Charge'); p.stun('stun', 0.4); }
        g.fx.slam(p.pos, wall);
        g.audio.play('slam', p.pos);
      }
      if (wall) g.fx.shake(u, 0.5);
    },
    fireStrike(u) {
      const t = u.game.time;
      if (!u.ready('fire') || !u.canAct() || u.action || u.st.charging > t) return false;
      u.barrier.up = false;
      u.action = { name: 'fire', t: 0, dur: 0.85 };
      u.use('fire', u.H.fireStrike.cd);
      return true;
    },
    shatter(u) {
      const g = u.game, t = g.time;
      if (!u.ultReady() || !u.canAct() || u.action || u.st.charging > t) return false;
      u.barrier.up = false;
      u.action = { name: 'shatter', t: 0, dur: 1.35 };
      u.st.windup = t + u.H.shatter.windup;
      u.ult = 0;
      u.stats.ults++;
      g.emit('ult', { unit: u, kind: 'shatter' });
      return true;
    },
    resolveShatter(u) {
      const g = u.game, S = u.H.shatter, hits = [];
      const from = u.pos.clone().add(new T.Vector3(0, 0.6, 0));
      for (const e of g.enemiesOf(u.team)) {
        if (!e.alive) continue;
        const dx = e.pos.x - u.pos.x, dz = e.pos.z - u.pos.z, d = Math.hypot(dx, dz);
        if (d > S.range + e.radius) continue;
        const ang = Math.abs(C.angleTo(u, e.pos));
        if (ang > S.halfAngle + Math.atan2(1.6 + e.radius, Math.max(d, 0.1)) * 0.5) continue;
        if (Math.abs(e.pos.y - u.pos.y) > 2.2) continue;
        const ground = g.world.groundAt(e.pos.x, e.pos.z, e.pos.y);
        if (!isNaN(ground) && e.pos.y - ground > 1.4 && !e.has('grav')) continue;   // in the air
        const to = e.pos.clone().add(new T.Vector3(0, 0.6, 0));
        const bb = C.barrierBetween(g, from, to, u.team);
        if (bb) { g.emit('shatterBlocked', { unit: u, barrier: bb.barrier }); continue; }
        if (!g.world.los(from, to, 0.4)) continue;
        hits.push(e);
      }
      for (const e of hits) { e.damage(S.dmg, u, 'Earthshatter'); e.stun('knock', S.stun); }
      g.fx.shatter(u, S.range, S.halfAngle);
      g.audio.play('shatter', u.pos);
      g.emit('shatterLanded', { unit: u, hits });
    },
  };

  // ---------------------------------------------------------------- Zarya
  const zarya = {
    init(u) { u.energy = 0; u.energyAt = -99; },
    tick(u, dt) {
      const t = u.game.time;
      if (t - u.energyAt > 2) u.energy = Math.max(0, u.energy - 1.6 * dt);
      if (!(u.st.beaming > t)) u.beamTo = null;
    },
    mult(u) { return 1 + u.energy / 100; },
    beam(u, target, dt) {
      const g = u.game, B = u.H.beam;
      if (!u.canAct() || !target || !target.alive) return false;
      const a = u.eye(new T.Vector3()).add(new T.Vector3(0, -0.35, 0)), b = target.center(new T.Vector3());
      if (a.distanceTo(b) > B.range + target.radius) return false;
      u.st.beaming = g.time + 0.12;
      const dmg = B.dps * zarya.mult(u) * dt;
      const bb = C.barrierBetween(g, a, b, u.team);
      if (bb) { bb.barrier.damage(dmg, u); u.beamTo = a.clone().lerp(b, bb.t); return true; }
      if (!g.world.los(a, b)) { u.beamTo = null; return false; }
      u.beamTo = b;
      target.damage(dmg, u, 'Particle Cannon');
      return true;
    },
    alt(u, point) {
      const g = u.game, A = u.H.alt;
      if (!u.canAct() || !u.ready('alt')) return false;
      u.use('alt', A.period);
      const from = u.eye(new T.Vector3()).add(new T.Vector3(0, -0.3, 0));
      const dir = point.clone().sub(from).normalize();
      const dmg = A.dmg * zarya.mult(u);
      C.projectile(u, {
        kind: 'zaryaAlt', pos: from, vel: dir.multiplyScalar(A.speed), radius: 0.25, dmg, life: 1.4, color: 0xff7ad8,
        onHit: (e, q) => { C.splash(u, q, A.splash, dmg, 'Particle Cannon'); g.fx.burst(q, 0xff7ad8, A.splash); },
        onEnd: (q) => { C.splash(u, q, A.splash, dmg, 'Particle Cannon'); g.fx.burst(q, 0xff7ad8, A.splash); },
        onBarrier: (bar, q) => { bar.damage(dmg, u); g.fx.burst(q, 0xff7ad8, 1); },
      });
      g.audio.play('zalt', u.pos);
      return true;
    },
    bubble(u, ally) {
      const g = u.game, B = u.H.bubble, self = ally === u, key = self ? 'selfBubble' : 'allyBubble';
      if (!u.canAct() || !u.ready(key) || !ally.alive) return false;
      if (!self && (ally.pos.distanceTo(u.pos) > 30 || !g.world.los(u.eye(v1), ally.center(v2)))) return false;
      u.use(key, self ? B.selfCd : B.allyCd);
      ally.st.bubble = { hp: B.hp, until: g.time + B.dur, owner: u };
      g.fx.bubble(ally);
      g.audio.play('bubble', ally.pos);
      g.emit('bubble', { unit: u, target: ally });
      return true;
    },
    grav(u, point) {
      const g = u.game, Gr = u.H.grav;
      if (!u.ultReady() || !u.canAct()) return false;
      u.ult = 0;
      u.stats.ults++;
      const from = u.eye(new T.Vector3()).add(new T.Vector3(0, -0.3, 0));
      const dir = point.clone().sub(from).normalize();
      g.emit('ult', { unit: u, kind: 'grav' });
      C.projectile(u, {
        kind: 'grav', pos: from, vel: dir.multiplyScalar(Gr.speed), radius: 0.35, life: Gr.range / Gr.speed, target: point.clone(),
        eatable: false, color: 0xa04dff, quiet: true,
        onHit: (e, q) => zarya.openGrav(u, q),
        onEnd: (q) => zarya.openGrav(u, q),
        onBarrier: (bar, q) => zarya.openGrav(u, q.clone().addScaledVector(dir, -0.6)),
      });
      return true;
    },
    openGrav(u, p) {
      const g = u.game, Gr = u.H.grav;
      const ground = g.world.groundAt(p.x, p.z, p.y + 1);
      const c = p.clone();
      if (!isNaN(ground)) c.y = Math.max(c.y, ground + 1.5);
      const field = { team: u.team, owner: u, pos: c, until: g.time + Gr.dur, start: g.time, caught: new Set() };
      g.gravs.push(field);
      g.fx.grav(field);
      g.audio.play('grav', c);
      // who's in it right away (for the ult-combo logic)
      for (const e of g.enemiesOf(u.team)) if (e.alive && e.center(v1).distanceTo(c) < Gr.radius && g.world.los(c, e.center(v2), 0.3)) field.caught.add(e);
      g.emit('gravLanded', { unit: u, field, count: field.caught.size });
    },
    tickGravs(g, dt) {
      const Gr = G.HEROES.zarya.grav;
      for (const f of g.gravs) {
        if (f.until < g.time) continue;
        for (const e of g.units) {
          if (!e.alive || e.team === f.team) continue;
          const c = e.center(v1), d = c.distanceTo(f.pos);
          if (d > Gr.radius && !f.caught.has(e)) continue;
          if (!f.caught.has(e) && !g.world.los(f.pos, c, 0.3)) continue;
          f.caught.add(e);
          e.st.grav = f.until;
          if (e.barrier && e.barrier.up && e.hero === 'reinhardt') { e.barrier.up = false; e.barrier.lastDown = g.time; }
          if (e.st.charging) { e.st.charging = 0; }
          // pull toward the centre and float
          const want = f.pos.clone().add(new T.Vector3(0, -e.height * 0.55, 0)).sub(e.pos);
          const k = Math.min(1, dt * 6);
          e.pos.addScaledVector(want, k * Math.min(1, 2.5 / Math.max(0.5, want.length())));
          e.vel.set(0, 0, 0);
          e.onGround = false;
          e.damage(Gr.dps * dt, f.owner, 'Graviton Surge');
        }
      }
      g.gravs = g.gravs.filter((f) => f.until > g.time - 0.1);
    },
  };

  // ---------------------------------------------------------------- D.Va
  const dva = {
    init(u) { u.matrixRes = u.H.matrix.dur; u.matrixAt = -99; },
    tick(u, dt) {
      const g = u.game, t = g.time, M = u.H.matrix;
      if (u.mech) {
        if (u.st.matrix > t) {
          u.matrixRes -= dt;
          u.matrixAt = t;
          if (u.matrixRes <= 0 || !u.canAct()) { u.st.matrix = 0; u.matrixRes = Math.max(0, u.matrixRes); }
          else u.st.matrix = t + 0.1;
        } else if (t - u.matrixAt > M.delay) {
          u.matrixRes = Math.min(M.dur, u.matrixRes + M.dur * M.regen * dt);
        }
      }
      if (u.st.boost > t && u.canAct()) {
        const B = u.H.boosters, dir = u.aimDir(new T.Vector3());
        dir.y = Math.max(-0.2, Math.min(0.6, dir.y));
        const r = g.world.slide(u.pos, dir.x * B.speed * dt, dir.z * B.speed * dt, true);
        u.pos.x = r.x; u.pos.z = r.z;
        u.pos.y += dir.y * B.speed * dt;
        u.onGround = false;
        u.vel.y = Math.max(u.vel.y, 0);
        for (const e of g.enemiesOf(u.team)) {
          if (!e.alive || (u.boostHit && u.boostHit.has(e))) continue;
          if (e.pos.distanceTo(u.pos) > u.radius + e.radius + 0.4) continue;
          (u.boostHit = u.boostHit || new Set()).add(e);
          e.damage(B.dmg, u, 'Boosters');
          e.knock(new T.Vector3(e.pos.x - u.pos.x, 0, e.pos.z - u.pos.z).normalize(), 6, 2);
        }
      } else u.boostHit = null;
    },
    shoot(u, target) {
      const g = u.game;
      if (!u.canAct() || !target || !target.alive) return false;
      if (u.mech) {
        const S = u.H.guns;
        if (!u.ready('guns') || u.st.matrix > g.time) return false;
        u.use('guns', S.period);
        u.st.firing = g.time + 0.25;
        const d = u.pos.distanceTo(target.pos);
        const acc = d < 6 ? 0.9 : Math.max(0.12, 0.9 - (d - 6) / 15);
        const dmg = S.pellet * S.pellets * acc * (0.85 + Math.random() * 0.3);
        C.hitscan(u, target, dmg, { kind: 'Fusion Cannons', color: 0xffe0f0 });
        g.fx.tracer(u, target, 0xffd6f0, 2);
        if (Math.random() < 0.35) g.audio.play('dvagun', u.pos);
      } else {
        const B = u.H.baby;
        if (!u.ready('gun')) return false;
        u.use('gun', B.period);
        const d = u.pos.distanceTo(target.pos);
        C.hitscan(u, target, B.gun * Math.max(0.3, 1 - d / 40), { kind: 'Light Gun', color: 0xff9ad8 });
        g.fx.tracer(u, target, 0xff9ad8, 1);
      }
      return true;
    },
    matrix(u, on) {
      const t = u.game.time;
      if (!u.mech) return false;
      if (!on) { u.st.matrix = 0; return true; }
      if (!u.canAct() || u.matrixRes < 0.3) return false;
      u.st.matrix = t + 0.1;
      return true;
    },
    boost(u) {
      const g = u.game;
      if (!u.mech || !u.canAct() || !u.ready('boost') || u.has('grav')) return false;
      u.use('boost', u.H.boosters.cd + u.H.boosters.dur);
      u.st.boost = g.time + u.H.boosters.dur;
      g.audio.play('boost', u.pos);
      return true;
    },
    missiles(u, target) {
      const g = u.game, M = u.H.missiles;
      if (!u.mech || !u.canAct() || !u.ready('missiles') || !target) return false;
      u.use('missiles', M.cd);
      for (let i = 0; i < M.count; i++) {
        g.later(i * 0.06, () => {
          if (!u.alive || !u.mech) return;
          const from = u.eye(new T.Vector3()).add(new T.Vector3((Math.random() - 0.5) * 1.2, 0.3, 0));
          const to = target.center(new T.Vector3()).add(new T.Vector3((Math.random() - 0.5) * 2.5, (Math.random() - 0.5) * 1.5, (Math.random() - 0.5) * 2.5));
          C.projectile(u, {
            kind: 'missile', pos: from, vel: to.sub(from).normalize().multiplyScalar(32), radius: 0.15, dmg: M.dmg, life: 1.2, color: 0xffb070,
            onHit: (e, q) => { e.damage(M.dmg * 0.66, u, 'Micro Missiles'); C.splash(u, q, 1.5, M.dmg * 0.34, 'Micro Missiles'); },
            onEnd: (q) => C.splash(u, q, 1.5, M.dmg * 0.34, 'Micro Missiles'),
          });
        });
      }
      return true;
    },
    // Self-Destruct: eject and send the mech forward; it blows 3 s after launch
    bomb(u) {
      const g = u.game, B = u.H.bomb;
      if (!u.ultReady() || !u.canAct()) return false;
      u.ult = 0;
      u.stats.ults++;
      const dir = u.aimDir(new T.Vector3());
      const start = u.pos.clone().add(new T.Vector3(0, 1.2, 0));
      const bomb = { team: u.team, owner: u, pos: start, vel: new T.Vector3(dir.x * B.launch, 4 + dir.y * 4, dir.z * B.launch), at: g.time + B.fuse, landed: false };
      g.bombs.push(bomb);
      g.emit('ult', { unit: u, kind: 'bomb', bomb });
      // eject: D.Va pops out behind as a pilot
      u.mech = false;
      u.maxHp = u.H.baby.hp; u.hp = u.maxHp; u.maxArmor = 0; u.armor = 0; u.st.matrix = 0;
      u.vel.set(-dir.x * 5, 7, -dir.z * 5);
      u.onGround = false;
      g.fx.bomb(bomb);
      g.audio.play('bombArm', start);
      return true;
    },
    tickBombs(g, dt) {
      const B = G.HEROES.dva.bomb;
      for (const b of g.bombs) {
        if (b.done) continue;
        if (!b.landed) {
          b.vel.y -= 14 * dt;
          const r = g.world.slide(b.pos, b.vel.x * dt, b.vel.z * dt, true);
          b.pos.x = r.x; b.pos.z = r.z;
          b.pos.y += b.vel.y * dt;
          if (!isNaN(r.g) && b.pos.y < r.g + 0.9) { b.pos.y = r.g + 0.9; b.landed = true; }
          if (r.blocked) { b.vel.x *= -0.2; b.vel.z *= -0.2; }
        }
        if (g.time >= b.at) {
          b.done = true;
          const c = b.pos.clone();
          const victims = [];
          for (const e of g.units) {
            if (!e.alive || e.team === b.team) continue;
            const p = e.center(v1), d = p.distanceTo(c);
            if (d > B.radius) continue;
            if (!g.world.los(c, p, 0.5)) continue;
            const bb = C.barrierBetween(g, c, p, b.team);
            if (bb) { bb.barrier.damage(Math.min(bb.barrier.hp, B.dmg), b.owner); continue; }
            const dmg = d < 5 ? B.dmg : B.dmg * Math.max(0.3, 1 - 0.7 * (d - 5) / (B.radius - 5));   // full in the middle, falls off to 30% at the edge
            victims.push(e);
            e.damage(dmg, b.owner, 'Self-Destruct');
          }
          g.fx.explosion(c, B.radius);
          g.audio.play('boom', c);
          g.emit('bombExploded', { bomb: b, victims });
        }
      }
      g.bombs = g.bombs.filter((b) => !b.done);
    },
    callMech(u) {
      const g = u.game;
      if (u.mech || !u.alive || u.ult < u.ultCost || !u.canAct()) return false;
      u.ult = 0;
      u.mech = true;
      u.maxHp = u.H.hp; u.hp = u.H.hp; u.maxArmor = u.H.armor; u.armor = u.H.armor; u.matrixRes = u.H.matrix.dur;
      g.fx.burst(u.center(v1), 0xff9ad8, 3);
      g.emit('callMech', { unit: u });
      return true;
    },
  };

  // ---------------------------------------------------------------- Lucio
  const lucio = {
    init(u) { u.song = 'speed'; },
    tick(u, dt) {
      const g = u.game, S = u.H.song;
      if (!u.alive || u.song !== 'heal') return;
      const amped = u.has('amp');
      const hps = S.heal * (amped ? u.H.amp.heal : 1);
      for (const a of g.alliesOf(u.team)) {
        if (!a.alive || a.pos.distanceTo(u.pos) > S.radius) continue;
        a.heal(hps * dt * (a === u ? 0.5 : 1), u);
      }
    },
    song(u, s) { if (u.song !== s) { u.song = s; u.game.emit('song', { unit: u, song: s }); } },
    shoot(u, target) {
      const g = u.game, Gn = u.H.gun;
      if (!u.canAct() || !u.ready('gun') || !target) return false;
      u.use('gun', Gn.period);
      for (let i = 0; i < Gn.shots; i++) {
        g.later(i * 0.08, () => {
          if (!u.alive) return;
          const from = u.eye(new T.Vector3()).add(new T.Vector3(0, -0.3, 0));
          const to = target.center(new T.Vector3()).add(new T.Vector3((Math.random() - 0.5) * 0.8, (Math.random() - 0.5) * 0.6, (Math.random() - 0.5) * 0.8));
          C.projectile(u, { kind: 'sonic', pos: from, vel: to.sub(from).normalize().multiplyScalar(Gn.speed), radius: 0.15, dmg: Gn.dmg, life: 1, color: 0x9cff5a, kindName: 'Sonic Amplifier' });
        });
      }
      return true;
    },
    wave(u) {
      const g = u.game, W = u.H.wave;
      if (!u.canAct() || !u.ready('wave')) return false;
      u.use('wave', W.cd);
      for (const e of g.enemiesOf(u.team)) {
        if (!e.alive) continue;
        const d = e.pos.distanceTo(u.pos);
        if (d > W.range || Math.abs(C.angleTo(u, e.pos)) > 0.7) continue;
        if (!g.world.los(u.eye(v1), e.center(v2), 0.4)) continue;
        e.damage(W.dmg, u, 'Soundwave');
        e.knock(new T.Vector3(e.pos.x - u.pos.x, 0, e.pos.z - u.pos.z).normalize(), W.push, 2.5);
      }
      g.fx.wave(u);
      g.audio.play('wave', u.pos);
      return true;
    },
    amp(u) {
      const g = u.game, A = u.H.amp;
      if (!u.canAct() || !u.ready('amp')) return false;
      u.use('amp', A.cd + A.dur);
      u.st.amp = g.time + A.dur;
      g.audio.play('amp', u.pos);
      return true;
    },
    beat(u) {
      const g = u.game, B = u.H.beat;
      if (!u.ultReady() || !u.canAct()) return false;
      u.ult = 0;
      u.stats.ults++;
      const saved = [];
      for (const a of g.alliesOf(u.team)) {
        if (!a.alive || a.pos.distanceTo(u.pos) > B.radius || !g.world.los(u.eye(v1), a.center(v2), 0.4)) continue;
        a.temp = B.shields;
        a.tempAt = g.time;
        saved.push(a);
      }
      g.fx.beat(u, saved);
      g.audio.play('beat', u.pos);
      g.emit('ult', { unit: u, kind: 'beat', saved });
      return true;
    },
  };

  // ---------------------------------------------------------------- Brigitte
  const brigitte = {
    init(u) {
      u.packs = u.H.pack.charges; u.packT = 0;
      u.barrier = new G.Barrier(u, { hp: 200, regen: 100, regenDelay: 2, brokenCd: 4, radius: 1.0, halfArc: 0.85, height: 1.9 });
    },
    tick(u, dt) {
      const g = u.game, t = g.time;
      u.barrier.tick(dt);
      if (u.barrier.up && !u.canAct()) u.barrier.up = false;
      if (u.packs < u.H.pack.charges) { u.packT += dt; if (u.packT >= u.H.pack.recharge) { u.packT = 0; u.packs++; } }
      if (!u.alive) return;
      if (u.st.inspire > t) {
        const I = u.H.inspire;
        for (const a of g.alliesOf(u.team)) if (a.alive && a.pos.distanceTo(u.pos) < I.radius) a.heal(I.hps * dt, u);
      }
      if (u.st.rally > t) {
        const R = u.H.rally;
        for (const a of g.alliesOf(u.team)) {
          if (!a.alive || a.pos.distanceTo(u.pos) > R.radius || a.tempArmor >= R.armor) continue;
          a.tempArmor = Math.min(R.armor, a.tempArmor + R.rate * dt);
          u.stats.heal += R.rate * dt;
        }
      }
      if (u.action) { u.action.t += dt; if (u.action.t >= u.action.dur) u.action = null; }
      if (u.st.bashing > t) {
        const B = u.H.bash, tg = u.bashTarget, dir = u.fwd(new T.Vector3());
        const r = g.world.slide(u.pos, dir.x * 18 * dt, dir.z * 18 * dt, false);
        u.pos.x = r.x; u.pos.z = r.z; if (!isNaN(r.g)) u.pos.y = r.g;
        if (tg && tg.alive && tg.pos.distanceTo(u.pos) < u.radius + tg.radius + 0.6) {
          u.st.bashing = 0;
          if (!C.barrierBetween(g, u.center(v1), tg.center(v2), u.team)) {
            tg.damage(B.dmg, u, 'Shield Bash');
            tg.stun('stun', B.stun);
            g.emit('bash', { unit: u, target: tg });
          }
          g.audio.play('bash', u.pos);
        }
        if (r.blocked) u.st.bashing = 0;
      }
    },
    flail(u) {
      const g = u.game, F = u.H.flail;
      if (!u.canAct() || !u.ready('flail') || u.barrier.up || u.st.bashing > g.time) return false;
      u.use('flail', F.period);
      u.action = { name: 'flail', t: 0, dur: F.period, dir: (u.flailDir = -(u.flailDir || 1)) };
      g.later(0.18, () => {
        if (!u.alive || !u.canAct()) return;
        const r = C.melee(u, F.range, F.arc * 2, F.dmg, 'Rocket Flail');
        if (r.hit.length || r.soaked) u.st.inspire = g.time + u.H.inspire.dur;
      });
      if (Math.random() < 0.5) g.audio.play('flail', u.pos);
      return true;
    },
    whip(u, target) {
      const g = u.game, W = u.H.whip;
      if (!u.canAct() || !u.ready('whip') || !target || !target.alive) return false;
      if (target.pos.distanceTo(u.pos) > W.range) return false;
      u.use('whip', W.cd);
      u.barrier.up = false;
      const a = u.eye(new T.Vector3()), b = target.center(new T.Vector3());
      g.fx.whip(u, b);
      g.audio.play('whip', u.pos);
      const bb = C.barrierBetween(g, a, b, u.team);
      if (bb) { bb.barrier.damage(W.dmg, u); return true; }
      if (!g.world.los(a, b)) return true;
      target.damage(W.dmg, u, 'Whip Shot');
      target.knock(new T.Vector3(b.x - a.x, 0, b.z - a.z).normalize(), W.push, 2);
      u.st.inspire = g.time + u.H.inspire.dur;
      return true;
    },
    pack(u, ally) {
      const g = u.game, P = u.H.pack;
      if (!u.canAct() || u.packs <= 0 || !ally.alive || !u.ready('packThrow')) return false;
      if (ally.pos.distanceTo(u.pos) > P.range || !g.world.los(u.eye(v1), ally.center(v2))) return false;
      u.packs--;
      u.use('packThrow', 0.5);
      ally.st.pack = { until: g.time + P.dur, src: u };
      g.fx.pack(u, ally);
      return true;
    },
    shield(u, on) {
      if (on) { if (!u.canAct() || !u.barrier.canRaise()) return false; u.barrier.up = true; return true; }
      if (u.barrier.up) { u.barrier.up = false; u.barrier.lastDown = u.game.time; }
      return true;
    },
    bash(u, target) {
      const g = u.game, B = u.H.bash;
      if (!u.canAct() || !u.ready('bash') || !target || !target.alive) return false;
      if (target.pos.distanceTo(u.pos) > B.range + 1.5) return false;
      u.use('bash', B.cd);
      u.yaw = Math.atan2(target.pos.x - u.pos.x, target.pos.z - u.pos.z);
      u.bashTarget = target;
      u.st.bashing = g.time + B.range / 18;
      return true;
    },
    rally(u) {
      const g = u.game;
      if (!u.ultReady() || !u.canAct()) return false;
      u.ult = 0;
      u.stats.ults++;
      u.st.rally = g.time + u.H.rally.dur;
      g.fx.rally(u);
      g.audio.play('rally', u.pos);
      g.emit('ult', { unit: u, kind: 'rally' });
      return true;
    },
  };

  // ---------------------------------------------------------------- Zenyatta
  const zenyatta = {
    init(u) { u.harmonyT = null; u.discordT = null; u.harmonyLos = 0; u.discordLos = 0; },
    tick(u, dt) {
      const g = u.game, t = g.time;
      if (!u.alive) return;
      const eye = u.eye(v1);
      if (u.harmonyT) {
        const a = u.harmonyT;
        if (!a.alive) u.harmonyT = null;
        else {
          if (g.world.los(eye, a.center(v2))) u.harmonyLos = t;
          if (t - u.harmonyLos > 3 || a.pos.distanceTo(u.pos) > 45) u.harmonyT = null;
          else a.heal(u.H.harmony.hps * dt, u);
        }
      }
      if (u.discordT) {
        const e = u.discordT;
        if (!e.alive) u.discordT = null;
        else {
          if (g.world.los(eye, e.center(v2))) u.discordLos = t;
          if (t - u.discordLos > 3 || e.pos.distanceTo(u.pos) > 45) u.discordT = null;
          else e.st.discord = { until: t + 0.25, by: u };
        }
      }
      if (u.st.trans > t) {
        const Tr = u.H.trans;
        for (const a of g.alliesOf(u.team)) if (a.alive && a.pos.distanceTo(u.pos) < Tr.radius) a.heal(Tr.hps * dt, u);
      }
    },
    shoot(u, target) {
      const g = u.game, O = u.H.orb;
      if (!u.canAct() || !u.ready('orb') || !target || u.st.trans > g.time) return false;
      u.use('orb', O.period);
      u.castT = g.time;
      const from = u.eye(new T.Vector3()).add(new T.Vector3(0, -0.35, 0));
      const to = target.center(new T.Vector3());
      const lead = to.clone().addScaledVector(target.vel, from.distanceTo(to) / O.speed);
      C.projectile(u, { kind: 'orb', pos: from, vel: lead.sub(from).normalize().multiplyScalar(O.speed), radius: 0.18, dmg: O.dmg, life: 1, color: 0xffe066, kindName: 'Orb of Destruction' });
      return true;
    },
    harmony(u, ally) {
      const g = u.game;
      if (!u.canAct() || !ally || !ally.alive || ally === u || u.harmonyT === ally) return false;
      if (!g.world.los(u.eye(v1), ally.center(v2)) || ally.pos.distanceTo(u.pos) > u.H.harmony.range) return false;
      u.harmonyT = ally; u.harmonyLos = g.time;
      return true;
    },
    discord(u, enemy) {
      const g = u.game;
      if (!u.canAct() || !enemy || !enemy.alive || u.discordT === enemy) return false;
      if (!g.world.los(u.eye(v1), enemy.center(v2)) || enemy.pos.distanceTo(u.pos) > u.H.discord.range) return false;
      u.discordT = enemy; u.discordLos = g.time;
      g.emit('discord', { unit: u, target: enemy });
      return true;
    },
    trans(u) {
      const g = u.game;
      if (!u.ultReady() || !u.canAct()) return false;
      u.ult = 0;
      u.stats.ults++;
      u.st.trans = g.time + u.H.trans.dur;
      g.fx.trans(u);
      g.audio.play('trans', u.pos);
      g.emit('ult', { unit: u, kind: 'trans' });
      return true;
    },
  };

  G.Kits = { reinhardt, zarya, dva, lucio, brigitte, zenyatta };
  G.Combat = C;
})(window.G = window.G || {});
