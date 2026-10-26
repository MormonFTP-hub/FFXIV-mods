// Heroes in the fight, and the rules every hit goes through: Zarya bubbles and Transcendence first, then
// Discord, then the health pools in Overwatch's order (Lucio's beat shields, Brigitte's overhealth armour,
// shields, armour, health), with 2018 armour (-5 per hit, or half for hits under 10). Barriers, projectiles,
// D.Va's Defense Matrix and line of sight decide whether a shot gets there at all.
(function (G) {
  const T = THREE;
  const tmp = new T.Vector3(), tmp2 = new T.Vector3();
  let uid = 0;

  class Unit {
    constructor(game, team, hero) {
      this.id = uid++;
      this.game = game;
      this.team = team;
      this.hero = hero;
      this.H = G.HEROES[hero];
      this.name = G.NAMES[team][hero];
      this.isPlayer = false;
      this.pos = new T.Vector3();
      this.vel = new T.Vector3();
      this.yaw = 0;           // aim
      this.pitch = 0;
      this.bodyYaw = 0;       // where the model faces (follows aim, lags a little)
      this.onGround = true;
      this.move = new T.Vector3();   // wanted horizontal move direction (unit length or 0), set by brain/input
      this.cd = {};
      this.st = {};
      this.ult = 0;
      this.stats = { dmg: 0, heal: 0, blocked: 0, kills: 0, deaths: 0, ults: 0, hits: 0 };
      this.lastHurt = -99;
      this.recentDmg = 0;     // decaying sum of damage taken (for brains and saves)
      this.reset();
    }

    reset() {
      const H = this.H;
      this.mech = this.hero === 'dva';
      this.maxHp = H.hp; this.hp = H.hp;
      this.maxArmor = H.armor; this.armor = H.armor;
      this.maxShields = H.shields; this.shields = H.shields;
      this.temp = 0;          // Lucio Sound Barrier shields
      this.tempArmor = 0;     // Brigitte pack / Rally overhealth
      this.alive = true;
      this.deadAt = 0;
      this.st = {};
      this.cd = {};
      this.vel.set(0, 0, 0);
      this.action = null;
      this.recentDmg = 0;
    }

    get height() { return this.mech || this.hero !== 'dva' ? this.H.height : 1.5; }
    get radius() { return this.mech || this.hero !== 'dva' ? this.H.radius : 0.4; }
    get eyeH() { return this.mech || this.hero !== 'dva' ? this.H.eye : 1.3; }
    center(out = new T.Vector3()) { return out.set(this.pos.x, this.pos.y + this.height * 0.55, this.pos.z); }
    eye(out = new T.Vector3()) { return out.set(this.pos.x, this.pos.y + this.eyeH, this.pos.z); }
    aimDir(out = new T.Vector3()) {
      const c = Math.cos(this.pitch);
      return out.set(Math.sin(this.yaw) * c, Math.sin(this.pitch), Math.cos(this.yaw) * c);
    }
    fwd(out = new T.Vector3()) { return out.set(Math.sin(this.yaw), 0, Math.cos(this.yaw)); }
    total() { return this.hp + this.armor + this.shields + this.temp + this.tempArmor; }
    maxTotal() { return this.maxHp + this.maxArmor + this.maxShields; }
    frac() { return (this.hp + this.armor + this.shields) / this.maxTotal(); }
    get ultCost() { return this.H.ultCost; }
    ultReady() { return this.alive && this.ult >= this.ultCost && (this.hero !== 'dva' || this.mech); }
    ultPct() { return Math.min(100, Math.floor(this.ult / this.ultCost * 100)); }

    now() { return this.game.time; }
    has(s) { const v = this.st[s]; return v !== undefined && (typeof v === 'number' ? v > this.game.time : v.until > this.game.time); }
    stunned() { return this.has('stun') || this.has('knock') || this.has('pinned'); }
    canAct() { return this.alive && !this.stunned(); }
    canMove() { return this.alive && !this.stunned() && !this.has('grav') && !this.has('charging'); }
    ready(name) { return !(this.cd[name] > this.game.time); }
    cdLeft(name) { return Math.max(0, (this.cd[name] || 0) - this.game.time); }
    use(name, secs) { this.cd[name] = this.game.time + secs; }

    speedMul() {
      let m = 1;
      const g = this.game, t = g.time;
      if (this.has('rally') && this.hero === 'brigitte') m += 0.3;
      // Lucio's speed song / amp from any ally Lucio in range
      for (const l of g.byHero(this.team, 'lucio')) {
        if (!l.alive || l.song !== 'speed' || l.pos.distanceTo(this.pos) > G.HEROES.lucio.song.radius) continue;
        m = Math.max(m, 1 + (l.has('amp') ? G.HEROES.lucio.amp.speed : G.HEROES.lucio.song.speed) * (l === this ? 1 : 1));
      }
      if (this.has('trans')) m += G.HEROES.zenyatta.trans.speed;
      if (this.barrierUp() && this.hero === 'reinhardt') m *= this.H.barrier.slow;
      if (this.hero === 'dva' && this.mech && this.st.firing > t) m *= this.H.guns.slow;
      if (this.st.windup > t) m *= 0.25;
      return m;
    }

    barrierUp() { return this.barrier && this.barrier.up; }

    addUlt(points) {
      if (!this.alive || this.has('ulting')) return;
      if (this.hero === 'dva' && !this.mech) points *= 1.4;   // baby D.Va builds Call Mech fast
      const before = this.ultReady();
      this.ult = Math.min(this.ultCost, this.ult + points);
      if (!before && this.ultReady()) this.game.emit('ultReady', { unit: this });
    }

    // ---------------------------------------------------------------- damage & healing
    damage(amount, src, kind = 'hit') {
      if (!this.alive || amount <= 0) return 0;
      const g = this.game;
      if (this.has('trans')) return 0;
      if (this.st.bubble && this.st.bubble.until > g.time) {
        const b = this.st.bubble;
        b.hp -= amount;
        if (b.owner && b.owner.alive) b.owner.energy = Math.min(100, (b.owner.energy || 0) + amount / 8);
        if (b.owner && b.owner.alive) b.owner.energyAt = g.time;
        g.fx.bubbleHit(this);
        if (b.hp <= 0) { b.until = 0; g.fx.bubblePop(this); }
        if (src) src.addUlt(amount * G.ULT.perBarrier);
        return 0;
      }
      if (this.st.discord && this.st.discord.until > g.time) amount *= 1 + G.HEROES.zenyatta.discord.amp;
      let left = amount, dealt = 0;
      const take = (pool) => { const d = Math.min(this[pool], left); this[pool] -= d; left -= d; dealt += d; };
      take('temp');
      if (left > 0 && this.shields > 0) take('shields');
      if (left > 0 && (this.tempArmor > 0 || this.armor > 0)) {
        // armour reduces each hit; the reduction applies to the part of the hit that lands on armour
        const red = left >= 10 ? Math.min(5, left) : left * 0.5;
        const want = left - red;
        let onArmor = Math.min(this.tempArmor + this.armor, want);
        const fromTemp = Math.min(this.tempArmor, onArmor);
        this.tempArmor -= fromTemp; onArmor -= fromTemp;
        this.armor -= onArmor;
        dealt += fromTemp + onArmor;
        const rest = want - fromTemp - onArmor;
        left = rest > 0 ? rest + red * (rest / want) : 0;
      }
      if (left > 0) { const d = Math.min(this.hp, left); this.hp -= d; dealt += d; }
      this.lastHurt = g.time;
      this.recentDmg += dealt;
      if (src && src.team !== this.team) {
        src.stats.dmg += dealt;
        src.addUlt(dealt * G.ULT.perDamage);
        this.lastAttacker = src;
        this.lastAttackerAt = g.time;
      }
      g.emit('damage', { unit: this, src, amount: dealt, kind });
      if (this.hp <= 0.01) this.die(src, kind);
      return dealt;
    }

    heal(amount, src, kind = 'heal') {
      if (!this.alive || amount <= 0) return 0;
      let left = amount, done = 0;
      const fill = (pool, max) => { const d = Math.min(max - this[pool], left); if (d > 0) { this[pool] += d; left -= d; done += d; } };
      fill('hp', this.maxHp);
      fill('armor', this.maxArmor);
      fill('shields', this.maxShields);
      if (src && done > 0) { src.stats.heal += done; src.addUlt(done * G.ULT.perHeal); }
      return done;
    }

    die(killer, kind) {
      const g = this.game;
      if (this.hero === 'dva' && this.mech) {
        // the mech goes down, D.Va ejects as a 150 hp pilot
        this.mech = false;
        this.maxHp = this.H.baby.hp; this.hp = this.maxHp; this.maxArmor = 0; this.armor = 0; this.temp = 0; this.tempArmor = 0;
        this.ult = 0;
        this.vel.y = 6;
        this.onGround = false;
        this.st.bubble = null;
        g.emit('demech', { unit: this, killer, kind });
        return;
      }
      this.alive = false;
      this.deadAt = g.time;
      this.hp = 0; this.armor = 0; this.shields = 0; this.temp = 0; this.tempArmor = 0;
      this.stats.deaths++;
      if (this.barrier) this.barrier.up = false;
      const credit = killer && killer.team !== this.team ? killer : (this.lastAttacker && g.time - this.lastAttackerAt < 5 ? this.lastAttacker : null);
      if (credit) credit.stats.kills++;
      g.emit('kill', { unit: this, killer: credit, kind });
      this.st = {};
    }

    // knock someone around (soundwave, whip, charge bumps, boosters)
    knock(dir, power, up = 2.5) {
      if (!this.alive || this.has('grav') || this.has('pinned')) return;
      const m = this.hero === 'reinhardt' ? 0.55 : (this.mech ? 0.6 : 1);
      this.vel.x += dir.x * power * m;
      this.vel.z += dir.z * power * m;
      this.vel.y = Math.max(this.vel.y, up * m);
      this.onGround = false;
      this.st.knocked = this.game.time + 0.35;
      if (this.barrier && this.barrier.up && this.hero === 'reinhardt' && !this.isPlayer) this.barrier.up = false;
    }

    stun(kind, secs) {
      if (!this.alive) return false;
      this.st[kind] = Math.max(this.st[kind] || 0, this.game.time + secs);
      if (this.barrier) this.barrier.up = false;
      this.action = null;
      if (this.hero === 'dva') this.st.matrix = 0;
      if (this.st.charging) this.st.charging = 0;
      if (this.st.windup) this.st.windup = 0;
      return true;
    }
  }

  // Reinhardt's Barrier Field (a curved wall on a circle around him) and Brigitte's Barrier Shield.
  class Barrier {
    constructor(owner, spec) {
      this.owner = owner;
      this.spec = spec;
      this.maxHp = spec.hp;
      this.hp = spec.hp;
      this.up = false;
      this.lastHit = -99;
      this.brokenUntil = 0;
      this.lastDown = -99;
    }
    get yaw() { return this.owner.yaw; }

    // first t in (0,1) where segment a->b crosses the barrier surface, or -1
    hit(a, b) {
      if (!this.up || !this.owner.alive) return -1;
      const o = this.owner.pos, s = this.spec, r = s.radius;
      const dx = b.x - a.x, dz = b.z - a.z, fx = a.x - o.x, fz = a.z - o.z;
      const A = dx * dx + dz * dz, B = 2 * (fx * dx + fz * dz), C = fx * fx + fz * fz - r * r;
      const disc = B * B - 4 * A * C;
      if (disc < 0 || A < 1e-9) return -1;
      const sq = Math.sqrt(disc);
      let best = -1;
      for (const t of [(-B - sq) / (2 * A), (-B + sq) / (2 * A)]) {
        if (t <= 0 || t >= 1) continue;
        const px = a.x + dx * t, pz = a.z + dz * t, py = a.y + (b.y - a.y) * t;
        const ang = Math.atan2(px - o.x, pz - o.z);
        let da = ang - this.yaw;
        while (da > Math.PI) da -= 2 * Math.PI;
        while (da < -Math.PI) da += 2 * Math.PI;
        if (Math.abs(da) > s.halfArc) continue;
        if (py < o.y - 0.3 || py > o.y + s.height) continue;
        if (best < 0 || t < best) best = t;
      }
      return best;
    }

    damage(amount, src) {
      const g = this.owner.game;
      this.hp -= amount;
      this.lastHit = g.time;
      this.owner.stats.blocked += amount;
      if (src) src.addUlt(amount * G.ULT.perBarrier);
      g.emit('barrierHit', { barrier: this, amount, src });
      if (this.hp <= 0) {
        this.hp = 0;
        this.up = false;
        this.brokenUntil = g.time + (this.spec.brokenCd || 4);
        g.emit('barrierBreak', { barrier: this, src });
      }
    }

    tick(dt) {
      const g = this.owner.game;
      if (this.up) return;
      if (g.time - this.lastHit > (this.spec.regenDelay || 2) && g.time - this.lastDown > (this.spec.regenDelay || 2)) {
        this.hp = Math.min(this.maxHp, this.hp + this.spec.regen * dt);
      }
    }

    canRaise() { return this.owner.game.time >= this.brokenUntil && this.hp > 1; }
  }

  // Projectiles: travel each tick, can be eaten by Defense Matrix, stopped by barriers and walls.
  class Projectile {
    constructor(o) {
      Object.assign(this, { radius: 0.15, life: 3, pierce: false, eatable: true, throughBarriers: false, hitList: new Set(), dead: false }, o);
      this.pos = o.pos.clone();
      this.vel = o.vel.clone();
    }
  }

  G.Unit = Unit;
  G.Barrier = Barrier;
  G.Projectile = Projectile;
})(window.G = window.G || {});
