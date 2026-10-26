// The bots. A Director per team runs the fight the way GOATS teams did: group up behind the Rein, poke
// through the gate, wait for an engage call (Lucio's speed, an ult advantage, a pick, or their Rein walking
// in), brawl, and trade ults in order: bait a save with one ult, land the next when the save is gone, and
// answer the other side's ults (Trans the grav, Beat the bomb, hide behind the shield). After a lost fight
// the team regroups instead of walking back in one at a time, and the clock pushes attackers onto the point.
// Each hero has a brain that moves to its spot in the deathball and plays its kit like players of that hero did.
(function (G) {
  const T = THREE;
  const K = () => G.Kits;
  const C = () => G.Combat;
  const v1 = new T.Vector3(), v2 = new T.Vector3();
  const rnd = (a, b) => a + Math.random() * (b - a);
  const PRIORITY = { zenyatta: 1.35, lucio: 1.2, dva: 1.05, zarya: 1.0, brigitte: 1.1, reinhardt: 0.75 };

  // ---------------------------------------------------------------- team director
  class Director {
    constructor(game, team, side) {
      this.g = game;
      this.team = team;
      this.side = side;        // 'attack' | 'defense'
      this.phase = 'setup';
      this.phaseAt = 0;
      this.saveAt = -99;       // last time a save ult (trans/beat) went out
      this.enemyUsed = {};     // hero -> time the enemy used that ult
      this.called = {};        // throttles comms
      this.engageScore = 0;
      this.nextThink = 0;
    }
    get units() { return this.g.team(this.team); }
    get enemies() { return this.g.team(1 - this.team); }
    alive(list) { return list.filter((u) => u.alive); }
    anchor() {
      const r = this.units.find((u) => u.hero === 'reinhardt' && u.alive);
      if (r) return r;
      return this.alive(this.units).sort((a, b) => b.maxTotal() - a.maxTotal())[0] || null;
    }
    setPhase(p) {
      if (this.phase === p) return;
      this.phase = p;
      this.phaseAt = this.g.time;
      this.g.emit('phase', { team: this.team, phase: p });
    }
    say(hero, key, vars, cool = 4) {
      const g = this.g, id = hero + key;
      if (this.called[id] > g.time) return;
      this.called[id] = g.time + cool;
      const u = this.units.find((x) => x.hero === hero && x.alive);
      if (!u || u.isPlayer) return;
      g.comms(u, key, vars);
    }

    centroid(list) {
      const a = this.alive(list);
      if (!a.length) return null;
      const c = new T.Vector3();
      for (const u of a) c.add(u.pos);
      return c.multiplyScalar(1 / a.length);
    }

    rein() { return this.units.find((u) => u.hero === 'reinhardt' && u.alive) || null; }

    // Where the team means to be right now, whatever its Rein is doing. Attackers group at the gate (giving
    // a slow Rein a few seconds to catch up), then take the platform over the point; defenders hold the point.
    plan() {
      const g = this.g, t = g.time, ec = this.centroid(this.enemies), oc = this.centroid(this.units);
      if (this.phase === 'regroup') return this.side === 'attack' ? g.map.plaza : g.map.hold;
      if (this.phase === 'engage') {
        if (ec && oc) return oc.clone().lerp(ec, 0.5);
        return this.side === 'attack' ? g.map.point : g.map.hold;
      }
      if (this.side === 'defense') return g.map.hold;
      const rein = this.rein();
      if (rein && rein.pos.distanceTo(g.map.stage) > 16 && this.phase !== 'poke' && t - this.phaseAt < 6) return g.map.gate;
      return g.map.stage;
    }

    // What the deathball forms on and which way it faces. If the Rein is with the plan (or in the fight),
    // the team plays around him, behind his barrier when it's up; if he wanders off or lags, the team
    // sticks to its plan instead of following him.
    front() {
      const g = this.g, ec = this.centroid(this.enemies), oc = this.centroid(this.units);
      const plan = this.plan(), rein = this.rein();
      const facing = (from) => {
        const target = ec && ec.distanceTo(from) < 30 ? ec : (this.side === 'attack' ? g.map.point : g.map.hold);
        const dir = target.clone().sub(from).setY(0);
        if (dir.lengthSq() < 0.01) dir.set(this.side === 'attack' ? -1 : 1, 0, 0);
        return { target, dir: dir.normalize() };
      };
      const withPlan = rein && (rein.pos.distanceTo(plan) < 10 || (this.phase === 'engage' && ec && rein.pos.distanceTo(ec) < 16));
      if (withPlan) {
        const f = facing(rein.pos);
        if (rein.barrier.up) f.dir = rein.fwd(new T.Vector3());
        return { pos: rein.pos.clone(), dir: f.dir, target: f.target, rein, shield: rein.barrier.up, plan };
      }
      const base = this.phase === 'engage' && oc ? oc.clone().lerp(plan, 0.5) : plan.clone();
      const f = facing(base);
      return { pos: base, dir: f.dir, target: f.target, rein: null, shield: false, plan };
    }

    // the enemy the team should kill, and anyone sitting on our supports
    pickTargets() {
      const own = this.alive(this.units), foes = this.alive(this.enemies), oc = this.centroid(this.units), t = this.g.time;
      this.peel = null;
      for (const s of own) {
        if (s.hero !== 'zenyatta' && s.hero !== 'lucio') continue;
        for (const e of foes) if (e.pos.distanceTo(s.pos) < 6.5 && (!this.peel || e.pos.distanceTo(s.pos) < this.peel.pos.distanceTo(s.pos))) { this.peel = e; this.peelFor = s; }
      }
      let best = null, bs = -1e9;
      for (const e of foes) {
        if (!oc || e.pos.distanceTo(oc) > 28) continue;
        let sc = (1 - e.frac()) * 3 + (PRIORITY[e.hero] - 1) * 2.5 - e.pos.distanceTo(oc) * 0.05;
        if (e.st.discord && e.st.discord.until > t) sc += 1.5;
        if (e.has('grav') || e.has('knock') || e.has('stun')) sc += 2;
        if (!foes.some((o) => o !== e && o.pos.distanceTo(e.pos) < 6)) sc += 1.2;          // caught out alone
        if (e.temp > 50 || e.has('trans') || (e.st.bubble && e.st.bubble.until > t)) sc -= 2.5; // don't shoot the save
        if (e === this.focus) sc += 0.8;                                                      // stick with the call
        if (sc > bs) { bs = sc; best = e; }
      }
      this.focus = best;
    }

    believedReady(u) { return u.alive && u.ultReady() && u.game.time - (u.readyAt || 0) > 1.0; }
    enemyHas(hero) { const e = this.enemies.find((x) => x.hero === hero); return !!e && this.believedReady(e); }
    ownHas(hero) { const u = this.units.find((x) => x.hero === hero); return !!u && u.ultReady() && !u.isPlayer; }

    update(dt) {
      const g = this.g, t = g.time;
      if (g.state !== 'fight') return;
      if (t < this.nextThink) return;
      this.nextThink = t + 0.25;
      const own = this.alive(this.units), foes = this.alive(this.enemies);
      if (!own.length) return;
      this.pickTargets();
      const ec = this.centroid(this.enemies), oc = this.centroid(this.units);
      const dist = ec && oc ? ec.distanceTo(oc) : 99;

      // a lost fight: fall back and wait for the respawns instead of feeding in one at a time
      const losing = (own.length <= 2 && foes.length - own.length >= 2) || (own.length <= 3 && foes.length - own.length >= 3);
      if (this.phase !== 'regroup' && losing && !(this.side === 'defense' && g.attackersOn > 0)) { this.setPhase('regroup'); return; }
      if (this.phase === 'regroup') {
        const spot = this.plan();
        const gathered = own.filter((u) => u.pos.distanceTo(spot) < 14).length;
        const enough = own.length >= 5 || (own.length >= 4 && own.length >= foes.length) || gathered >= 5;
        // defenders can't sit back while the point is being taken
        const mustGo = this.side === 'defense' ? g.attackersOn > 0 : (g.roundEnd - t < 25);
        if ((enough && gathered >= Math.min(4, own.length)) || mustGo || t - this.phaseAt > 24) this.setPhase(this.side === 'attack' ? 'approach' : 'poke');
        return;
      }

      if (this.phase === 'setup' || this.phase === 'approach') {
        if (dist < 26) this.setPhase('poke');
        else if (this.phase === 'setup') this.setPhase('approach');
      }
      // after a won fight the attackers stand on the point; defenders always come back to contest it
      if (this.phase === 'poke' && this.side === 'attack' && foes.length <= 2 && own.length >= foes.length + 2) this.engage();
      if (this.phase === 'poke') {
        const s = this.engageValue(own, foes, dist);
        this.engageScore = s;
        const pokeFor = t - this.phaseAt;
        if (s > 2.2 && pokeFor > 2.5) this.engage();
        else if (pokeFor > 1.5 && Math.random() < 0.08) this.say(this.side === 'attack' ? 'zenyatta' : 'lucio', 'hold', null, 9);
      }
      if (this.phase === 'engage' && dist > 32 && t - this.phaseAt > 6) this.setPhase('poke');
      // nobody has hurt anybody for a while: whoever is left goes to the point and settles it
      if (t - (g.lastDamageAt || 0) > 10 && t > 20 && this.phase !== 'engage' && this.phase !== 'regroup') this.setPhase('engage');
    }

    engageValue(own, foes, dist) {
      const g = this.g, t = g.time;
      let s = 0;
      const w = { zarya: 1.5, dva: 1.2, reinhardt: 1.2, zenyatta: 1.0, lucio: 1.0, brigitte: 0.6 };
      for (const u of this.units) if (u.ultReady()) s += (w[u.hero] || 1) * 0.6;
      for (const u of this.enemies) if (this.believedReady(u)) s -= (w[u.hero] || 1) * 0.6;
      for (const h of ['zenyatta', 'lucio']) if (this.enemyUsed[h] && t - this.enemyUsed[h] < 12) s += 1.4;
      s += (own.length - foes.length) * 1.6;
      const lucio = own.find((u) => u.hero === 'lucio');
      if (lucio && lucio.ready('amp')) s += 0.5;
      s += Math.min(3, (t - this.phaseAt) * 0.18);
      if (this.side === 'attack') {
        s += 0.4;
        const left = g.roundEnd - t;
        if (left < 60) s += 2;          // the clock is running out: go
        if (left < 25) s += 4;
      }
      // defenders step up when attackers walk onto the point
      if (this.side === 'defense' && this.alive(this.enemies).some((e) => e.pos.distanceTo(g.map.point) < g.map.pointR + 2)) s += 3;
      // the player's Rein walking into them is an engage, like it or not
      const p = this.units.find((u) => u.isPlayer && u.alive);
      if (p) {
        const near = foes.filter((e) => e.pos.distanceTo(p.pos) < 9).length;
        if (near >= 1) s += 2.5 + near;
      }
      if (dist > 28) s -= 2;
      // a GOATS team goes in with its Rein: if he's nowhere near, they hold a while longer before going without him
      const rein = this.rein(), oc = this.centroid(this.units);
      if (rein && oc && rein.pos.distanceTo(oc) > 14 && t - this.phaseAt < 12) s -= 2.5;
      if (!rein) s -= 1;
      return s;
    }

    engage() {
      this.setPhase('engage');
      const lucio = this.units.find((u) => u.hero === 'lucio' && u.alive);
      if (lucio && !lucio.isPlayer) {
        K().lucio.song(lucio, 'speed');
        K().lucio.amp(lucio);
        lucio.brain.speedUntil = this.g.time + 3.5;
      }
      this.say('lucio', 'engage', null, 6);
      this.g.emit('engage', { team: this.team });
    }

    // ---------------------------------------------------------------- the ult trade
    // called every tick by brains that hold an ult; returns true if this hero should fire now.
    // (Each brain checks its own targeting; the director decides the order.)
    allowUlt(u, kind, strong) {
      const g = this.g, t = g.time;
      const enemyBeat = this.enemyHas('lucio'), enemyTrans = this.enemyHas('zenyatta');
      const ownBomb = this.ownHas('dva'), ownGrav = this.ownHas('zarya');
      const gravUp = g.gravs.some((f) => f.team === this.team && f.until > t);
      // combos go straight away; otherwise one big ult at a time, and let the brawl start first
      if ((kind === 'bomb' || kind === 'shatter') && gravUp) return kind === 'bomb' ? 'grav' : 'go';
      if (!strong) {
        if (t - (this.lastUlt || -99) < 3) return 'wait';
        if (this.phase !== 'engage') return 'wait';
        if (t - this.phaseAt < 2.5) return 'wait';
      }
      if (kind === 'grav') {
        // bomb first to drag out their beat when we hold both
        if (enemyBeat && ownBomb && this.phase === 'engage' && t - (this.bombAt || -99) > 6) return 'wait';
        return 'go';
      }
      if (kind === 'bomb') {
        if (enemyBeat && ownGrav) return 'bait';
        return 'go';
      }
      return 'go';
    }

    noteOwnUlt(u, kind) { if (kind !== 'trans' && kind !== 'beat') this.lastUlt = this.g.time; }

    noteEnemyUlt(u, kind) {
      this.enemyUsed[u.hero] = this.g.time;
      if (u.hero === 'zenyatta' || u.hero === 'lucio' || u.hero === 'zarya' || u.hero === 'dva') {
        const caller = ['zenyatta', 'lucio', 'brigitte', 'zarya'].find((h) => this.units.some((x) => x.hero === h && x.alive && !x.isPlayer && h !== u.hero)) || 'zenyatta';
        this.g.later(rnd(0.4, 0.9), () => this.say(caller, 'enemyUlt', { hero: u.hero }, 1));
      }
    }

    // threats to us right now, for the save ults
    threats() {
      const g = this.g, t = g.time;
      const own = this.alive(this.units);
      const gravs = g.gravs.filter((f) => f.team !== this.team && f.until > t);
      const caught = new Set();
      for (const f of gravs) for (const u of f.caught) if (u.alive) caught.add(u);
      const bombs = g.bombs.filter((b) => b.team !== this.team && !b.done);
      let bombThreat = 0, bombLeft = 9;
      for (const b of bombs) {
        bombLeft = Math.min(bombLeft, b.at - t);
        for (const u of own) {
          const c = u.center(v1);
          if (c.distanceTo(b.pos) < G.HEROES.dva.bomb.radius - 1 && g.world.los(b.pos, c, 0.5) && !C().barrierBetween(g, b.pos, c, b.team)) bombThreat++;
        }
      }
      const hurt = own.filter((u) => u.frac() < 0.4).length;
      const burst = own.reduce((s, u) => s + u.recentDmg, 0);
      const knocked = own.filter((u) => u.has('knock')).length;
      return { caught: caught.size, bombThreat, bombLeft, hurt, burst, knocked, n: own.length };
    }
  }

  // ---------------------------------------------------------------- brains
  class Brain {
    constructor(u, dir) {
      this.u = u;
      this.d = dir;
      this.path = null;
      this.pathGoal = null;
      this.pathAt = -99;
      this.target = null;
      this.react = rnd(0.25, 0.55);
      this.aimErr = new T.Vector3();
      this.errAt = 0;
      this.thinkAt = 0;
      u.brain = this;
    }
    get g() { return this.u.game; }
    get skill() { return this.g.skill; }

    // ---- movement
    goTo(goal, dt, stopAt = 0.8) {
      const u = this.u, g = this.g, t = g.time;
      if (!goal) { u.move.set(0, 0, 0); return; }
      const d = Math.hypot(goal.x - u.pos.x, goal.z - u.pos.z);
      if (d < stopAt) { u.move.set(0, 0, 0); return; }
      let next = goal;
      if (!g.world.walkable(u.pos, goal)) {
        if (!this.path || t - this.pathAt > 0.8 || !this.pathGoal || this.pathGoal.distanceTo(goal) > 2) {
          this.path = g.world.findPath(u.pos, goal) || null;
          this.pathGoal = goal.clone();
          this.pathAt = t;
        }
        if (this.path && this.path.length) {
          while (this.path.length > 1 && Math.hypot(this.path[0].x - u.pos.x, this.path[0].z - u.pos.z) < 1.0) this.path.shift();
          next = this.path[0];
        }
      } else this.path = null;
      const dir = new T.Vector3(next.x - u.pos.x, 0, next.z - u.pos.z).normalize();
      // keep a little space from teammates
      for (const o of g.units) {
        if (o === u || !o.alive) continue;
        const dx = u.pos.x - o.pos.x, dz = u.pos.z - o.pos.z, dd = Math.hypot(dx, dz);
        const want = u.radius + o.radius + 0.4;
        if (dd < want && dd > 0.01) dir.add(new T.Vector3(dx / dd, 0, dz / dd).multiplyScalar((want - dd) / want * 1.2));
      }
      u.move.copy(dir.setY(0).normalize());
    }

    strafe(amount) {
      const u = this.u, t = this.g.time;
      const s = Math.sin(t * 1.3 + u.id * 2.1) * amount;
      u.move.add(new T.Vector3(Math.cos(u.yaw), 0, -Math.sin(u.yaw)).multiplyScalar(s));
      if (u.move.lengthSq() > 1) u.move.normalize();
    }

    // ---- aiming
    aimAt(p, dt, rate = 6) {
      const u = this.u, g = this.g;
      if (g.time > this.errAt) {
        const e = (1.15 - this.skill) * 1.2;
        this.aimErr.set(rnd(-e, e), rnd(-e, e) * 0.5, rnd(-e, e));
        this.errAt = g.time + rnd(0.3, 0.7);
      }
      const tgt = p.clone().add(this.aimErr);
      const e = u.eye(v1);
      const wantYaw = Math.atan2(tgt.x - e.x, tgt.z - e.z);
      const wantPitch = Math.atan2(tgt.y - e.y, Math.hypot(tgt.x - e.x, tgt.z - e.z));
      let dy = wantYaw - u.yaw;
      while (dy > Math.PI) dy -= 2 * Math.PI;
      while (dy < -Math.PI) dy += 2 * Math.PI;
      const k = Math.min(1, dt * rate * (0.6 + this.skill * 0.6));
      u.yaw += dy * k;
      u.pitch += (wantPitch - u.pitch) * k;
      return Math.abs(dy) < 0.25;
    }

    // ---- targeting
    enemies(range = 60) {
      const u = this.u, g = this.g;
      return g.enemiesOf(u.team).filter((e) => e.alive && e.pos.distanceTo(u.pos) < range);
    }
    visible(e) { return this.g.world.los(this.u.eye(v1), e.center(v2)); }
    pickTarget(range, prefer = {}) {
      const u = this.u;
      let best = null, bs = -1e9;
      for (const e of this.enemies(range)) {
        if (!this.visible(e)) continue;
        const d = e.pos.distanceTo(u.pos);
        let s = -d * 0.12 + (1 - e.frac()) * 2 + (PRIORITY[e.hero] || 1) + (prefer[e.hero] || 0);
        if (e.st.discord && e.st.discord.until > this.g.time) s += 1.5;
        if (C().barrierBetween(this.g, u.eye(v1), e.center(v2), u.team)) s -= 3;
        if (e.has('grav') || e.has('knock')) s += 1.2;
        if (e === this.target) s += 0.8;
        if (e === this.d.focus) s += 1.6;
        if (e === this.d.peel && u !== this.d.peelFor && (u.hero === 'brigitte' || u.hero === 'zarya' || u.hero === 'lucio' || u.hero === 'dva')) s += 2.5;
        if (s > bs) { bs = s; best = e; }
      }
      return best;
    }
    // what an enemy barrier is protecting, to shoot at instead (the shield is the target in poke)
    shieldTarget(range) {
      const u = this.u;
      for (const e of this.enemies(range)) if (e.barrier && e.barrier.up && e.hero === 'reinhardt') return e;
      return null;
    }

    // where to go when there's nothing in sight: the enemy if we know where they are, else the point
    objective() {
      const g = this.g, d = this.d;
      const ec = d.centroid(d.enemies);
      if (d.side === 'attack') {
        if (ec && ec.distanceTo(g.map.point) < 14) return ec;
        return this.u.pos.x > g.map.gate.x + 2 ? g.map.gate : g.map.point;
      }
      if (ec && ec.distanceTo(g.map.point) < 10) return ec;
      return g.map.point;
    }

    slot(front) {
      const u = this.u, d = this.d;
      if (front.rein === u) return front.plan;
      const f = front.dir, l = new T.Vector3(f.z, 0, -f.x);   // left of facing
      // the deathball: tight behind the shield, but spread wider when they have a grav up
      let tight = d.phase === 'approach' || d.phase === 'setup' ? 1.15 : 1;
      if (d.enemyHas('zarya')) tight *= 1.25;
      const S = {
        zarya: [-1.5, 2.2], dva: [-0.8, -2.8], brigitte: [-1.6, -0.9], lucio: [-3.4, 1.2], zenyatta: [-5.5, -0.5], reinhardt: [0.5, 0],
      }[u.hero] || [-2, 0];
      let side = S[1] * tight, back = S[0] * tight;
      if (front.shield) { side *= 0.6; back = Math.min(back, -1.3); }   // stay in the barrier's shadow
      if (!front.rein) back -= 0.5;
      const p = front.pos.clone().addScaledVector(f, back).addScaledVector(l, side);
      const gy = this.g.world.groundAt(p.x, p.z, front.pos.y + 1.5);
      if (isNaN(gy)) return this.g.world.nearestReachable(p, 8);
      p.y = gy;
      return p;
    }

    nearestEnemy() {
      let best = null, bd = 1e9;
      for (const e of this.enemies(80)) { const d = e.pos.distanceTo(this.u.pos); if (d < bd) { bd = d; best = e; } }
      return best;
    }

    think(dt) {
      const u = this.u, g = this.g;
      u.move.set(0, 0, 0);
      if (!u.alive || g.state !== 'fight' && g.state !== 'countdown') return;
      if (g.state === 'countdown') { this.idleAim(dt); return; }
      if (!u.canAct()) return;
      const fn = this[u.hero === 'dva' ? 'dva' : u.hero];
      fn.call(this, dt);
      this.dodgeBomb(dt);
    }

    // after the kit has had its say, movement gives way to getting away from a bomb
    dodgeBomb(dt) {
      const u = this.u, g = this.g, R = G.HEROES.dva.bomb.radius;
      const b = g.bombs.find((x) => x.team !== u.team && !x.done && x.pos.distanceTo(u.pos) < R + 2);
      if (!b || g.time - (b.at - G.HEROES.dva.bomb.fuse) < this.react) return;
      if (u.hero === 'reinhardt') {
        this.aimAt(b.pos, dt, 14);
        K().reinhardt.shield(u, true);
        u.move.set(0, 0, 0);
        return;
      }
      const rein = g.byHero(u.team, 'reinhardt').find((r) => r.alive && r.barrier.up);
      let goal;
      if (rein && rein.pos.distanceTo(u.pos) < 10) {
        const away = rein.pos.clone().sub(b.pos).setY(0).normalize();
        goal = rein.pos.clone().addScaledVector(away, 1.6);
      } else {
        goal = u.pos.clone().add(u.pos.clone().sub(b.pos).setY(0).normalize().multiplyScalar(8));
      }
      this.goTo(goal, dt, 0.4);
    }

    idleAim(dt) {
      const f = this.d.front();
      if (f.target) this.aimAt(f.target.clone().setY(this.u.pos.y + 1.5), dt, 3);
    }

    // ---------------------------------------------------------------- Reinhardt (the enemy anchor)
    reinhardt(dt) {
      const u = this.u, g = this.g, d = this.d, t = g.time, R = K().reinhardt, H = u.H;
      const front = d.front();
      const foe = this.nearestEnemy();
      const fd = foe ? foe.pos.distanceTo(u.pos) : 99;
      let goal;
      if (d.phase === 'regroup') goal = d.plan();
      else if (d.phase === 'engage') goal = foe && fd < 30 ? foe.pos : this.objective();
      else if (d.side === 'defense') goal = g.map.hold;
      else { const plan = d.plan(); goal = fd > 8 && u.pos.distanceTo(plan) > 1.5 ? plan : null; }
      if (goal && (d.phase !== 'engage' || fd > 3.2)) this.goTo(goal, dt, d.phase === 'engage' ? 2.6 : 1.2);
      // aim: the shield faces where the damage comes from (their team), the hammer goes at the call
      const ec = d.centroid(d.enemies);
      const swingAt = d.focus && d.focus.pos.distanceTo(u.pos) < H.hammer.range + 0.6 ? d.focus : foe;
      if (u.barrier.up && ec) this.aimAt(ec.clone().add(new T.Vector3(0, 1.2, 0)), dt, 5);
      else if (swingAt) this.aimAt(swingAt.center(v1), dt, 5);
      // caught in a grav: can't move, so the barrier goes up toward their team and stays up
      if (u.has('grav')) {
        if (ec) this.aimAt(ec.clone().add(new T.Vector3(0, 1.2, 0)), dt, 8);
        if (u.barrier.canRaise() && u.barrier.hp > 100) R.shield(u, true);
        return;
      }
      // Earthshatter
      if (u.ultReady() && !u.action && (u.reactAt || 0) < t) {
        const hits = this.shatterWouldHit();
        const p = g.byHero(1 - u.team, 'reinhardt')[0];   // their Rein: is his shield down or turned away?
        const exposed = p && p.alive && (!p.barrier.up || Math.abs(C().angleTo(p, u.pos)) > p.H.barrier.halfArc);
        const saves = d.enemyHas('zenyatta') + d.enemyHas('lucio');
        const allyGrav = g.gravs.some((f) => f.team === u.team && f.until > t);
        const verdict = d.allowUlt(u, 'shatter', hits >= 4 || (hits >= 2 && exposed && fd < 10));
        if (verdict !== 'wait' && (hits >= 3 || (hits >= 2 && (saves === 0 || allyGrav || exposed)) || (hits >= 1 && exposed && fd < 8 && saves === 0))) {
          if (R.shatter(u)) { d.say('zarya', 'shatter', null, 6); return; }
        }
      }
      // Fire Strike when they're lined up
      if (u.ready('fire') && foe && fd < 22 && !u.action && Math.random() < dt * 1.5) {
        const lined = this.enemies(30).filter((e) => Math.abs(C().angleTo(u, e.pos)) < 0.15 && this.visible(e)).length;
        if (lined >= 2 || (lined >= 1 && d.phase !== 'engage')) { R.shield(u, false); R.fireStrike(u); return; }
      }
      // Charge an isolated squishy in a brawl
      if (u.ready('charge') && d.phase === 'engage' && foe && Math.random() < dt * 0.3) {
        const sq = this.enemies(16).find((e) => (e.hero === 'zenyatta' || e.hero === 'lucio') && Math.abs(C().angleTo(u, e.pos)) < 0.1 && this.visible(e));
        if (sq && g.world.walkable(u.pos, sq.pos)) { R.charge(u); return; }
      }
      // shield vs swing: hold it while being poked, drop it to swing when someone is in hammer range
      const inRange = foe && fd < H.hammer.range + 0.6;
      const underFire = u.recentDmg > 30 || this.incomingProjectiles() > 0;
      const enemyShatter = d.enemyHas('reinhardt');
      const enemyRein = g.byHero(1 - u.team, 'reinhardt')[0];
      const facedByRein = enemyRein && enemyRein.alive && enemyRein.pos.distanceTo(u.pos) < 18 && Math.abs(C().angleTo(enemyRein, u.pos)) < 0.5;
      if (inRange && (d.phase === 'engage' || fd < 3.5) && !(enemyShatter && facedByRein && Math.random() < 0.5 && u.barrier.hp > 600)) {
        R.shield(u, false);
        if (!u.action) R.swing(u);
      } else if ((underFire || d.phase === 'poke' || d.phase === 'approach') && u.barrier.canRaise() && u.barrier.hp > 150) {
        R.shield(u, true);
      } else if (u.barrier.hp < 150) R.shield(u, false);
      if (u.barrier.up && u.barrier.hp < 500) d.say('brigitte', 'lowShield', null, 10);
    }

    shatterWouldHit() {
      const u = this.u, g = this.g, S = u.H.shatter;
      const from = u.pos.clone().add(new T.Vector3(0, 0.6, 0));
      let n = 0;
      for (const e of g.enemiesOf(u.team)) {
        if (!e.alive) continue;
        const d = Math.hypot(e.pos.x - u.pos.x, e.pos.z - u.pos.z);
        if (d > S.range * 0.9) continue;
        if (Math.abs(C().angleTo(u, e.pos)) > S.halfAngle + Math.atan2(1.4, Math.max(d, 0.1)) * 0.4) continue;
        const to = e.pos.clone().add(new T.Vector3(0, 0.6, 0));
        if (C().barrierBetween(g, from, to, u.team) || !g.world.los(from, to, 0.4)) continue;
        if (e.has('knock')) continue;
        n++;
      }
      return n;
    }

    incomingProjectiles() {
      const u = this.u;
      let n = 0;
      for (const p of this.g.projectiles) {
        if (p.team === u.team) continue;
        const d = p.pos.distanceTo(u.pos);
        if (d < 14 && p.vel.clone().normalize().dot(u.pos.clone().sub(p.pos).normalize()) > 0.8) n++;
      }
      return n;
    }

    // ---------------------------------------------------------------- Zarya
    zarya(dt) {
      const u = this.u, g = this.g, d = this.d, t = g.time, Z = K().zarya;
      const front = d.front();
      const tgt = this.pickTarget(d.phase === 'engage' ? 16 : 30, { dva: 0.4, reinhardt: d.phase === 'poke' ? 0.6 : 0 });
      this.target = tgt;
      // position: slot in poke, 6-9 m from the target in a brawl
      let goal = this.slot(front);
      if (d.phase === 'engage' && tgt) {
        const dist = tgt.pos.distanceTo(u.pos);
        if (dist > 10) goal = tgt.pos;
        else if (dist < 5) goal = u.pos.clone().add(u.pos.clone().sub(tgt.pos).setY(0).normalize().multiplyScalar(3));
        else goal = null;
      }
      if (!tgt && d.phase === 'engage') goal = this.objective();
      if (goal) this.goTo(goal, dt, 1.2); else this.strafe(0.6);
      // bubbles: the anchor when he's focused or committing, a gravved/knocked teammate, herself when hit
      const allies = g.alliesOf(u.team).filter((a) => a.alive && a !== u);
      if (u.ready('allyBubble')) {
        const a = allies.filter((x) => x.pos.distanceTo(u.pos) < 28 && this.visible(x)).sort((p, q) => this.bubbleNeed(q) - this.bubbleNeed(p))[0];
        if (a && this.bubbleNeed(a) > 1 && Math.random() < dt * 4 * this.skill) {
          if (Z.bubble(u, a)) d.say('zarya', 'bubble', { t: a.isPlayer ? 'Rein' : a.H.name }, 6);
        }
      }
      if (u.ready('selfBubble') && (u.recentDmg > 70 || (u.frac() < 0.6 && d.phase === 'engage')) && Math.random() < dt * 5) Z.bubble(u, u);
      // Graviton Surge
      if (u.ultReady() && t > (u.reactAt || 0)) {
        const pick = this.gravSpot();
        const verdict = d.allowUlt(u, 'grav', pick && pick.c.distanceTo(u.pos) < 18 && (pick.n >= 5 || (pick.n >= 4 && d.ownHas('dva'))));
        const need = d.phase === 'engage' ? 3 : 4;
        const foes = d.alive(d.enemies).length;
        if (pick && verdict === 'go' && (pick.n >= need || (pick.n >= 2 && foes <= 3) || (pick.n >= 2 && pick.squishy && !d.enemyHas('zenyatta') && !d.enemyHas('lucio')))) {
          this.aimAt(pick.c, 1, 99);
          if (Z.grav(u, pick.c)) { d.say('zarya', 'grav', { n: pick.n }, 5); return; }
        }
      }
      if (!tgt) { this.idleAim(dt); return; }
      const c = tgt.center(v1);
      this.aimAt(c, dt, 7);
      const dist = tgt.pos.distanceTo(u.pos);
      if (dist < 14.5) Z.beam(u, tgt, dt);
      else if (dist < 28 && u.ready('alt')) Z.alt(u, c.clone().add(tgt.vel.clone().multiplyScalar(dist / 25)));
    }

    bubbleNeed(a) {
      const g = this.g;
      if (a.st.bubble && a.st.bubble.until > g.time) return 0;
      let n = 0;
      n += a.recentDmg / 120;
      if (a.has('grav') || a.has('knock') || a.has('stun')) n += 1.6;
      if (a.hero === 'reinhardt' && (a.has('charging') || (a.action && a.action.name === 'shatter') || (!a.barrierUp() && a.recentDmg > 60))) n += 1.2;
      if (g.bombs.some((b) => b.team !== a.team && b.pos.distanceTo(a.pos) < 18 && b.at - g.time < 1.2)) n += 2.5;
      if (a.frac() < 0.4) n += 0.8;
      return n;
    }

    gravSpot() {
      const u = this.u, g = this.g;
      const foes = this.enemies(30).filter((e) => !e.has('grav'));
      let best = null;
      for (const e of foes) {
        const c = e.center(new T.Vector3());
        if (c.distanceTo(u.eye(v1)) > 26 || !this.visible(e)) continue;
        if (C().barrierBetween(g, u.eye(v1), c, u.team)) continue;
        let n = 0, squishy = false;
        for (const o of foes) if (o.center(v2).distanceTo(c) < 5.2 && g.world.los(c, o.center(v2), 0.3)) { n++; if (o.hero === 'zenyatta' || o.hero === 'lucio') squishy = true; }
        if (!best || n > best.n) best = { c, n, squishy };
      }
      return best;
    }

    // ---------------------------------------------------------------- D.Va
    dva(dt) {
      const u = this.u, g = this.g, d = this.d, t = g.time, D = K().dva;
      const front = d.front();
      if (!u.mech) {   // baby D.Va: stay back, plink, call mech when it's up
        if (u.ult >= u.ultCost) D.callMech(u);
        const tgt = this.pickTarget(25);
        const goal = front.pos.clone().addScaledVector(front.dir, -5);
        this.goTo(goal, dt, 1.5);
        if (tgt) { this.aimAt(tgt.center(v1), dt, 7); D.shoot(u, tgt); }
        return;
      }
      // Self-Destruct
      if (u.ultReady() && t > (u.reactAt || 0)) {
        const verdict = d.allowUlt(u, 'bomb', u.hp + u.armor < 150);
        const grav = g.gravs.find((f) => f.team === u.team && f.until > t + 0.5);
        if (verdict === 'grav' && grav && grav.caught.size >= 2 && grav.pos.distanceTo(u.pos) < 18) {
          this.aimAt(grav.pos, 1, 99);
          if (D.bomb(u)) { d.say('dva', 'gravBomb', null, 5); return; }
        }
        const cluster = this.bombSpot();
        const reach = cluster && cluster.c.distanceTo(u.pos) < 14;
        if (verdict !== 'grav' && verdict !== 'wait' && reach && (cluster.n >= 3 || (verdict === 'bait' && cluster.n >= 2))) {
          this.aimAt(cluster.c, 1, 99);
          if (D.bomb(u)) { d.bombAt = t; d.say('dva', 'bomb', null, 5); return; }
        }
        if (u.hp + u.armor < 110 && this.enemies(12).length >= 2) { this.aimAt(this.nearestEnemy().center(v1), 1, 99); if (D.bomb(u)) return; }
      }
      // in a brawl D.Va goes for their Zen; in poke she holds an off-angle and eats projectiles
      const zen = g.byHero(1 - u.team, 'zenyatta').find((e) => e.alive);
      let tgt;
      if (d.phase === 'engage' && zen && zen.pos.distanceTo(u.pos) < 24) {
        tgt = zen;
        if (zen.pos.distanceTo(u.pos) > 9 && u.ready('boost') && this.visible(zen)) { this.aimAt(zen.center(v1), 1, 99); D.boost(u); d.say('dva', 'dive', null, 12); }
        this.goTo(zen.pos, dt, 3);
      } else {
        tgt = this.pickTarget(22, { lucio: 0.3 });
        const goal = d.phase === 'regroup' ? this.slot(front) : (d.phase === 'engage' ? (tgt ? tgt.pos : this.objective()) : this.slot(front));
        this.goTo(goal, dt, d.phase === 'engage' ? 4 : 1.2);
        if (d.phase === 'engage') this.strafe(0.5);
      }
      this.target = tgt;
      // Defense Matrix against incoming projectiles
      const inc = this.incomingToTeam();
      if (inc && u.matrixRes > 0.4) {
        this.aimAt(inc.pos, dt, 12);
        D.matrix(u, true);
        return;
      }
      if (tgt) {
        const c = tgt.center(v1);
        this.aimAt(c, dt, 7);
        if (tgt.pos.distanceTo(u.pos) < 18) D.shoot(u, tgt);
        if (u.ready('missiles') && tgt.pos.distanceTo(u.pos) < 25 && Math.random() < dt * 0.8) D.missiles(u, tgt);
      } else this.idleAim(dt);
    }

    incomingToTeam() {
      const u = this.u, g = this.g;
      let best = null, bd = 1e9;
      for (const p of g.projectiles) {
        if (p.team === u.team || !p.eatable) continue;
        const d = p.pos.distanceTo(u.pos);
        if (d > 11 || d < 1.5) continue;
        const toUs = u.pos.clone().sub(p.pos).setY(0).normalize();
        if (p.vel.clone().setY(0).normalize().dot(toUs) < 0.5) continue;
        const w = d - (p.kind === 'fireStrike' ? 8 : 0) - (p.kind === 'orb' ? 3 : 0);
        if (w < bd) { bd = w; best = p; }
      }
      return best && Math.random() < this.skill ? best : null;
    }

    bombSpot() {
      const u = this.u, g = this.g;
      const foes = this.enemies(22);
      let best = null;
      for (const e of foes) {
        if (!this.visible(e)) continue;
        const c = e.center(new T.Vector3());
        let n = 0;
        for (const o of foes) {
          if (o.center(v2).distanceTo(c) > 11) continue;
          if (C().barrierBetween(g, c, o.center(v2), u.team)) continue;
          n++;
        }
        if (!best || n > best.n) best = { c, n };
      }
      return best;
    }

    // ---------------------------------------------------------------- Lucio
    lucio(dt) {
      const u = this.u, g = this.g, d = this.d, t = g.time, L = K().lucio;
      const front = d.front();
      // save: Sound Barrier
      if (u.ultReady() && t > (u.reactAt || 0)) {
        const th = d.threats();
        const zenTrans = d.ownHas('zenyatta');
        const fresh = t - d.saveAt > 2.5;
        if ((th.bombThreat >= 2 && th.bombLeft < 1.8) ||
            (fresh && th.caught >= 2 && (!zenTrans || d.enemyHas('dva') === false) && !zenTrans) ||
            (fresh && th.knocked >= 3 && !zenTrans) ||
            (fresh && d.phase === 'engage' && th.hurt >= 3 && th.burst > 700)) {
          if (!this.waitSave) this.waitSave = t + (th.bombThreat >= 2 ? 0.15 : this.react * (1.2 - this.skill * 0.5));
          if (t >= this.waitSave) { if (L.beat(u)) { d.saveAt = t; d.say('lucio', 'beat', null, 5); this.waitSave = 0; return; } }
        } else this.waitSave = 0;
      }
      // song: speed on the walk and the engage, heal otherwise
      const healing = g.alliesOf(u.team).some((a) => a.alive && a.frac() < 0.85 && a.pos.distanceTo(u.pos) < 10);
      const wantSpeed = (d.phase === 'approach' && !healing) || (this.speedUntil > t) || d.phase === 'regroup';
      L.song(u, wantSpeed ? 'speed' : 'heal');
      if (d.phase === 'engage' && !u.has('amp') && u.ready('amp') && g.alliesOf(u.team).filter((a) => a.alive && a.frac() < 0.55 && a.pos.distanceTo(u.pos) < 10).length >= 2) L.amp(u);
      const tgt = this.pickTarget(26);
      this.target = tgt;
      let goal = this.slot(front);
      if (d.phase === 'engage') {
        const mates = g.alliesOf(u.team).filter((x) => x.alive && x !== u && x.hero !== 'zenyatta');
        if (mates.length) {
          const c = mates.reduce((acc, x) => acc.add(x.pos), new T.Vector3()).multiplyScalar(1 / mates.length);
          goal = c.addScaledVector(front.dir, -1.5).add(new T.Vector3(Math.sin(t * 0.7 + u.id) * 1.5, 0, Math.cos(t * 0.9) * 1.5));
          const gy = g.world.groundAt(goal.x, goal.z, u.pos.y + 1.5);
          if (!isNaN(gy)) goal.y = gy; else goal = this.slot(front);
        }
      }
      this.goTo(goal, dt, 1);
      // soundwave: boop the nearest enemy off us
      const near = this.nearestEnemy();
      if (near && near.pos.distanceTo(u.pos) < 6 && u.ready('wave')) { this.aimAt(near.center(v1), 1, 99); L.wave(u); }
      if (tgt) { this.aimAt(tgt.center(v1), dt, 6); if (tgt.pos.distanceTo(u.pos) < 24) L.shoot(u, tgt); } else this.idleAim(dt);
    }

    // ---------------------------------------------------------------- Brigitte
    brigitte(dt) {
      const u = this.u, g = this.g, d = this.d, t = g.time, B = K().brigitte;
      const front = d.front();
      // Rally on the engage
      if (u.ultReady() && d.phase === 'engage' && t - (d.lastUlt || -99) > 1.5) {
        if ((t - d.phaseAt < 5 && this.enemies(12).length >= 2) || g.alliesOf(u.team).filter((a) => a.alive && a.frac() < 0.6).length >= 2) { if (B.rally(u)) d.say('brigitte', 'rally', null, 8); }
      }
      // packs on the lowest teammate
      if (u.packs > 0) {
        const a = g.alliesOf(u.team).filter((x) => x.alive && x.pos.distanceTo(u.pos) < 28 && !(x.st.pack && x.st.pack.until > t))
          .sort((p, q) => p.frac() - q.frac())[0];
        if (a && (a.frac() < 0.7 || (a.isPlayer && a.frac() < 0.85)) && this.visible(a)) B.pack(u, a);
      }
      const near = this.nearestEnemy();
      const nd = near ? near.pos.distanceTo(u.pos) : 99;
      // bash: stop a charging Rein, a boosting D.Va diving our Zen, or a Zarya about to grav
      if (u.ready('bash') && near && nd < 8) {
        const threat = this.enemies(9).find((e) => e.has('charging') || (e.hero === 'dva' && e.st.boost > t) || (e.hero === 'zarya' && e.ultReady())) || (d.peel && d.peel.pos.distanceTo(u.pos) < 8 ? d.peel : null);
        const tg = threat || (d.phase === 'engage' && Math.random() < dt * 0.4 ? near : null);
        if (tg) { B.shield(u, true); if (B.bash(u, tg)) { this.aimAt(tg.center(v1), 1, 99); return; } }
      }
      let goal = this.slot(front);
      if (d.peel && d.peel.pos.distanceTo(u.pos) < 18) goal = d.peel.pos;   // peel for Zen / Lucio first
      else if (d.phase === 'engage') goal = near && nd < 14 ? near.pos : goal;
      this.goTo(goal, dt, d.phase === 'engage' ? 3.5 : 1.0);
      // whip shot squishies or a target near a ledge
      const whipT = this.pickTarget(19, { zenyatta: 0.8, lucio: 0.6 });
      if (whipT && u.ready('whip') && Math.random() < dt * 2) { this.aimAt(whipT.center(v1), 1, 99); B.whip(u, whipT); return; }
      if (near && nd < u.H.flail.range + 0.5) {
        this.aimAt(near.center(v1), dt, 8);
        B.shield(u, false);
        B.flail(u);
      } else {
        if (near) this.aimAt(near.center(v1), dt, 5); else this.idleAim(dt);
        // shield up while waiting in poke if we're being shot
        if (d.phase !== 'engage' && u.recentDmg > 20) B.shield(u, true);
        else if (u.barrier.up && u.recentDmg < 5) B.shield(u, false);
      }
    }

    // ---------------------------------------------------------------- Zenyatta
    zenyatta(dt) {
      const u = this.u, g = this.g, d = this.d, t = g.time, Z = K().zenyatta;
      const front = d.front();
      // Transcendence
      if (u.ultReady() && t > (u.reactAt || 0)) {
        const th = d.threats();
        const lucioBeat = d.ownHas('lucio');
        const bombComing = d.enemyHas('dva') && lucioBeat;   // keep Beat for the bomb, Trans the grav
        const fresh = t - d.saveAt > 2.0;
        const want = (fresh && th.caught >= 2 && (bombComing || !lucioBeat || th.caught >= 3)) ||
          (fresh && th.knocked >= 3) ||
          (fresh && d.phase === 'engage' && th.hurt >= 3 && th.burst > 600 && !lucioBeat) ||
          (u.frac() < 0.3 && this.enemies(8).length >= 2);
        if (want) {
          if (!this.waitSave) this.waitSave = t + this.react * (1.2 - this.skill * 0.5);
          if (t >= this.waitSave) { if (Z.trans(u)) { d.saveAt = t; d.say('zenyatta', 'trans', null, 5); this.waitSave = 0; return; } }
        } else this.waitSave = 0;
      }
      // Harmony: on whoever needs it, sticky on the anchor
      const allies = g.alliesOf(u.team).filter((a) => a.alive && a !== u && a.pos.distanceTo(u.pos) < 38);
      const needy = allies.sort((p, q) => (p.frac() - (p.hero === 'reinhardt' ? 0.15 : 0)) - (q.frac() - (q.hero === 'reinhardt' ? 0.15 : 0)))[0];
      if (needy && (!u.harmonyT || (u.harmonyT.frac() > 0.95 && needy.frac() < 0.8)) && this.visible(needy)) Z.harmony(u, needy);
      // Discord: the tank in poke, the dive target in a brawl
      const foes = this.enemies(38).filter((e) => this.visible(e));
      let disc = null;
      if (foes.length) {
        if (d.phase === 'engage') disc = (d.focus && foes.includes(d.focus) ? d.focus : null) || foes.find((e) => e.hero === 'dva' && e.pos.distanceTo(u.pos) < 15) || foes.sort((a, b) => a.frac() - b.frac())[0];
        else disc = foes.find((e) => e.hero === 'reinhardt') || foes.find((e) => e.hero === 'dva') || foes[0];
      }
      if (disc && u.discordT !== disc && (!u.discordT || !u.discordT.alive || Math.random() < dt * 0.6)) { if (Z.discord(u, disc)) d.say('zenyatta', 'discord', { t: disc.H.name }, 10); }
      let goal = this.slot(front);
      if (d.phase === 'engage') goal = front.pos.clone().addScaledVector(front.dir, -5).add(new T.Vector3(Math.sin(t * 0.5 + 1) * 1.5, 0, 0));
      // a Zen who can't see the fight is doing nothing: walk up until he can
      const sees = foes.length > 0 || (u.harmonyT && this.visible(u.harmonyT));
      if (sees) this.sawAt = t;
      if (t - (this.sawAt || 0) > 1.0) goal = front.pos.clone().addScaledVector(front.dir, -2);
      // keep away from a diving D.Va
      const diver = this.enemies(7)[0];
      if (diver) goal = u.pos.clone().add(u.pos.clone().sub(diver.pos).setY(0).normalize().multiplyScalar(5));
      this.goTo(goal, dt, 1.2);
      const tgt = u.discordT && this.visible(u.discordT) ? u.discordT : this.pickTarget(40);
      this.target = tgt;
      if (tgt) { this.aimAt(tgt.center(v1), dt, 6); Z.shoot(u, tgt); } else this.idleAim(dt);
    }
  }

  G.Director = Director;
  G.Brain = Brain;
})(window.G = window.G || {});
