// Combat core shared by every job: GCD, casting, caster tax and ping, animation lock, the action queue,
// cooldowns and charges, statuses, combos, positionals, auto-attacks, DoT and MP server ticks, and the damage
// formula. Everything a job does differently (its gauge, costs, procs, what each action does) lives in its
// job module (js/jobs/*.js), which the engine calls through the hooks below. No drawing in here.
(function (B) {
  const A = B.ACTIONS;          // the current job's actions (B.setJob swaps the contents)
  const EPS = 1e-6;

  class Engine {
    constructor(settings, job) {
      this.listeners = {};
      this.now = 0;
      this.settings = settings;
      this.job = job;
      this.pos = { x: 0, y: 0, z: -10 };     // y: the floor you stand on (the game's map; 0 without it)
      this.world = null;                      // the map's collision (B.MapWorld) while the map is on
      this.reset();
    }

    on(type, fn) { (this.listeners[type] = this.listeners[type] || []).push(fn); }
    emit(type, data) { (this.listeners[type] || []).forEach(fn => fn(data || {})); }

    setJob(job) {
      this.job = job;
      this.reset();
    }

    // The job version's level and its formula modifiers.
    get level() { return this.job.level || 90; }
    get lv() { return B.LEVELS[this.job.levelKey || this.level]; }
    // Max MP: 10,000 from Shadowbringers on; Stormblood's depended on level (a job version sets maxMp).
    get maxMp() { return this.job.maxMp || B.MAX_MP; }
    // Striking dummies standing in the pack (Settings → Dummies): AoE actions hit the extra ones too.
    get targets() { return Math.max(1, Math.min(B.EXTRA_DUMMIES.length + 1, +this.settings.dummies || 1)); }
    // TP: before 5.0, physical jobs spent TP on weaponskills (job.tp = { max, regen } per 3s tick).
    get usesTp() { return !!this.job.tp; }

    get stats() {
      const st = this.job.stats;
      const speed = Math.max(this.lv.sub, Math.min(B.SPEED_MAX, Math.round(this.speedSetting()) || st.speed));
      return Object.assign({}, st, { speed });
    }
    speedSetting() { return (this.settings.speed || {})[this.job.id]; }

    reset() {
      this.mp = this.maxMp;
      this.tp = this.job.tp ? this.job.tp.max : 0;
      this.maxHp = this.job.stats.hp;
      this.hp = this.maxHp;
      this.statuses = {};
      this.tStatuses = {};
      this.cds = {};
      this.gcdStart = -10; this.gcdEnd = -10; this.gcdLen = 2.5;
      this.lockUntil = 0;
      this.casting = null;
      this.queue = [];
      this.hits = [];
      this.combo = null;           // { id, until }: the weaponskill that continues a combo
      this.autoNext = null;        // next auto-attack, once engaged
      this.inCombat = false;
      this.mpTickNext = this.now + 0.5 + Math.random() * 2.5;
      this.dotTickNext = this.now + 0.5 + Math.random() * 2.5;
      this.leyLines = null;
      this.targeted = true;
      this.untargetable = false;   // a fight's boss in one of its untargetable windows
      this.ko = false;             // KO'd by a fight's attack (js/party.js raises you)
      this.facing = Math.PI;       // which way the target faces (the sim's yaw): the dummy faces you, a boss its tank
      this.moving = false;
      this.jumpUntil = 0;
      this.pet = null;             // a summoner's pet: { kind } (the job sets it; the scene draws it)
      this.g = this.job.initGauge(this);
      this.emit('reset');
    }

    // ---------- helpers ----------
    has(key) { const s = this.statuses[key]; return !!(s && s.until > this.now + EPS); }
    tHas(key) { const s = this.tStatuses[key]; return !!(s && s.until > this.now + EPS); }

    addStatus(key, dur, extra) {
      const had = this.has(key);
      this.statuses[key] = Object.assign({ until: this.now + dur, dur }, extra || {});
      if (!had) this.emit('statusGain', { key, self: true });
    }
    removeStatus(key, silent) {
      if (!this.statuses[key]) return;
      delete this.statuses[key];
      if (!silent) this.emit('statusLose', { key, self: true });
    }
    addTStatus(key, dur, extra) {
      const had = this.tHas(key);
      this.tStatuses[key] = Object.assign({ until: this.now + dur, dur, targets: this.targets }, extra || {});
      this.emit('statusGain', { key, self: false, refreshed: had });
    }

    distToTarget() { return Math.hypot(this.pos.x, this.pos.z); }
    inCircle() {
      return !!(this.leyLines && this.leyLines.until > this.now &&
        Math.hypot(this.pos.x - this.leyLines.x, this.pos.z - this.leyLines.z) <= 3);
    }

    // The dummy faces -Z, toward where you start (a fight's boss faces its main tank). Rear is the 90° behind it,
    // flanks the 90° to each side.
    side() {
      let r = Math.atan2(this.pos.x, this.pos.z) - this.facing;
      while (r > Math.PI) r -= 2 * Math.PI;
      while (r < -Math.PI) r += 2 * Math.PI;
      const a = Math.abs(r) * 180 / Math.PI;   // 0 = in front, 180 = behind
      return a > 135 ? 'rear' : a > 45 ? 'flank' : 'front';
    }
    positionalHit(a) {
      if (!a.positional) return false;
      return this.has('trueNorth') || this.side() === a.positional;
    }

    // Spell speed or skill speed, with the job's haste (Ley Lines, Shifu).
    speedScale(baseSec, haste) {
      const L = this.lv;
      const x = Math.floor(130 * (this.stats.speed - L.sub) / L.div);
      let ms = Math.floor(baseSec * 1000 * (1000 - x) / 1000);
      ms = Math.floor(ms * (100 - (haste || 0)) / 100);
      return Math.floor(ms / 10) / 100;
    }
    haste(id) { return this.job.haste ? this.job.haste(this, id) : 0; }     // id: the GCD being started, for haste on some actions only
    gcdRecast(id) {
      if (id && A[id] && A[id].fixedRecast) return A[id].fixedRecast;     // a tank's spell: no spell speed on tank gear
      const own = id && this.job.gcdRecastFor ? this.job.gcdRecastFor(id, this) : null;     // e.g. Rainbow Bright's 2.5s Rainbow Drip
      if (own) return own;
      return this.speedScale((id && A[id] && A[id].recast) || 2.5, this.haste(id));
    }

    // GCD for a speed stat, with the job's standing haste (Samurai tiers are quoted with Fuka on: 2.14).
    gcdForSpeed(speed, haste) {
      const L = this.lv;
      const x = Math.floor(130 * (speed - L.sub) / L.div);
      const ms = Math.floor(2500 * (1000 - x) / 1000);
      return Math.floor(Math.floor(ms * (100 - (haste || 0)) / 100) / 10) / 100;
    }

    // Lowest speed stat that reaches a GCD (in seconds), for typing a GCD in settings.
    speedForGcd(gcd, haste) {
      for (let s = this.lv.sub; s <= B.SPEED_MAX; s++) {
        if (this.gcdForSpeed(s, haste) <= gcd + 1e-9) return s;
      }
      return B.SPEED_MAX;
    }

    // The vanilla client holds your animation lock until the server answers,
    // so ping lands on top of every lock and every caster tax. NoClippy and
    // XivAlexander take it back out.
    latency(nominal) {
      const s = this.settings;
      if (s.latencyComp) return 0;
      const ping = Math.max(0, Math.min(B.PING_MAX, s.ping || 0)) / 1000;
      return nominal ? ping : ping * (0.85 + Math.random() * 0.3);
    }
    animLock(base, nominal) { return (base || B.BASE_LOCK) + this.latency(nominal); }
    casterTax(nominal) { return B.CASTER_TAX + this.latency(nominal); }

    // A button can stand for another action (Fire becomes Paradox, Iaijutsu becomes Midare Setsugekka).
    resolve(id) { return this.job.resolveId ? this.job.resolveId(id, this) : id; }

    cd(id) {
      const a = A[id];
      const key = a.cdGroup || id;
      // Abilities: recast is the cooldown. GCDs with a cooldown of their own (Kaeshi): cd.
      const recast = a.kind === 'gcd' ? (a.cdScales ? this.speedScale(a.cd) : a.cd) : a.recast;
      if (!this.cds[key]) this.cds[key] = { max: a.charges || 1, charges: a.charges || 1, recast, nextAt: null };
      else if (a.cdScales) this.cds[key].recast = recast;     // follows skill speed changed in Settings
      return this.cds[key];
    }
    cdOf(id) { const a = A[id]; return a ? this.cds[a.cdGroup || id] : null; }
    // Start an action's recast. Abilities with holdCd start theirs later, from the job (Draw's starts once the card
    // it drew is used).
    startCd(id) {
      const c = this.cd(id);
      const scale = this.job.recastScale ? this.job.recastScale(id, this) : 1;     // e.g. 4.0's Spear: -20% ability recasts
      if (c.charges === c.max) c.nextAt = this.now + c.recast * scale;
      c.charges--;
    }
    cdTick() {
      for (const id in this.cds) {
        const c = this.cds[id];
        while (c.nextAt !== null && this.now >= c.nextAt - EPS) {
          c.charges++;
          c.nextAt = c.charges < c.max ? c.nextAt + c.recast : null;
        }
      }
    }
    cdReadyAt(id) {
      const c = this.cd(id);
      return c.charges > 0 ? 0 : c.nextAt;
    }

    // When the button would actually fire, ignoring conditions.
    availableAt(id) {
      const a = A[id];
      let t = this.lockUntil;
      if (this.casting) t = Math.max(t, this.casting.end + this.casting.tax);
      if (a.kind === 'gcd') {
        t = Math.max(t, this.gcdEnd);
        if (a.cd) t = Math.max(t, this.cdReadyAt(id));
      } else t = Math.max(t, this.cdReadyAt(id));
      return t;
    }

    castTimeFor(id) {
      const a = A[id];
      if (!a.cast) return 0;
      if (this.job.castTime) {
        const t = this.job.castTime(id, this);
        if (t !== undefined) return t;
      }
      return this.speedScale(a.cast, this.haste());
    }

    mpCost(id) { return this.job.mpCost ? this.job.mpCost(id, this) : (A[id].mp || 0); }

    inCombo(id) { return !!(this.combo && this.combo.id === id && this.combo.until > this.now); }

    // Returns an error message, or null when the action can go off right now.
    // forHotbar skips target, range and movement, which the hotbar shows another way.
    checkConditions(id, forHotbar) {
      const a = A[id];
      if (this.ko) return 'You cannot act while KO\'d.';
      if (a.target && !forHotbar) {
        if (!this.targeted || this.untargetable) return 'Invalid target.';
        if (this.distToTarget() - B.DUMMY_RADIUS > (a.range || B.RANGE)) return 'Target not in range.';
      }
      const err = this.job.check ? this.job.check(id, this, forHotbar) : null;
      if (err) return err;
      if (a.kind === 'gcd' && this.mp < this.mpCost(id)) return 'Not enough MP.';
      if (this.usesTp && a.tp && this.tp < a.tp) return 'Not enough TP.';
      if (!forHotbar && a.kind === 'gcd' && this.castTimeFor(id) > 0 && this.moving) return 'Unable to cast while moving.';
      return null;
    }
    outOfRange(id) {
      const a = A[id];
      return !!a.target && this.distToTarget() - B.DUMMY_RADIUS > (a.range || B.RANGE);
    }

    // ---------- input ----------
    // The queue holds one GCD and up to two oGCDs (a double weave), fired in the
    // order they were pressed, so Triplecast pressed before Fire IV goes first
    // and Fire IV comes out instant.
    press(rawId) {
      const id = this.resolve(rawId);
      if (!A[id]) return;
      if (this.availableAt(id) <= this.now + EPS) {
        this.execute(id);
        return;
      }
      if (!this.queueable(id)) return;
      const isGcd = (q) => A[this.resolve(q.id)].kind === 'gcd';
      if (A[id].kind === 'gcd') {
        this.queue = this.queue.filter(q => !isGcd(q));
      } else {
        this.queue = this.queue.filter(q => this.resolve(q.id) !== id);
        const ogcds = this.queue.filter(q => !isGcd(q));
        if (ogcds.length >= 2) this.queue.splice(this.queue.indexOf(ogcds[0]), 1);
      }
      this.queue.push({ id: rawId, t: this.now });
    }

    // An action can wait in the queue when it's due within 0.5s. Using an action
    // starts a 0.5s client lock, so an animation lock never stops the next press
    // from queueing; a cast does, until its last 0.5s.
    queueable(id) {
      const a = A[id];
      if (this.casting && this.casting.end + this.casting.tax - this.now > B.QUEUE_WINDOW) return false;
      let ready = a.kind === 'gcd' ? this.gcdEnd : this.cdReadyAt(id);
      if (a.kind === 'gcd' && a.cd) ready = Math.max(ready, this.cdReadyAt(id));
      return ready - this.now <= B.QUEUE_WINDOW;
    }

    runQueue() {
      for (let guard = 0; guard < 4 && this.queue.length; guard++) {
        const i = this.queue.findIndex(q => this.availableAt(this.resolve(q.id)) <= this.now + EPS);
        if (i < 0) break;
        const [q] = this.queue.splice(i, 1);
        this.execute(this.resolve(q.id));
      }
      // A hardcast that just started, or a stale press, empties what's left.
      this.queue = this.queue.filter(q => this.now - q.t < 2 && this.queueable(this.resolve(q.id)));
    }

    queuedIds() { return this.queue.map(q => this.resolve(q.id)); }

    setMoving(moving) {
      this.moving = moving;
      if (moving && this.casting && this.now < this.casting.end - B.SLIDECAST) this.interrupt('Interrupted');
    }

    jump() {
      if (this.jumpUntil > this.now) return;
      this.jumpUntil = this.now + 0.75;
      this.emit('jump');
      if (this.casting && this.now < this.casting.end - B.SLIDECAST) this.interrupt('Interrupted');
    }

    interrupt(reason) {
      const c = this.casting;
      if (!c) return;
      this.casting = null;
      // A cancelled cast hands the GCD back and drops anything queued behind it.
      this.gcdEnd = this.now; this.lockUntil = this.now;
      this.queue = [];
      this.emit('interrupt', { id: c.id, reason });
    }

    execute(id) {
      const a = A[id];
      const err = this.checkConditions(id);
      if (err) { this.emit('error', { msg: err, id }); return false; }

      if (this.usesTp && a.tp) this.tp -= a.tp;
      if (a.kind === 'gcd') {
        if (a.cd) {
          const c = this.cd(id);
          if (c.charges === c.max) c.nextAt = this.now + c.recast;
          c.charges--;
        }
        const castTime = this.castTimeFor(id);
        const recast = this.gcdRecast(id);
        this.gcdStart = this.now; this.gcdEnd = this.now + recast; this.gcdLen = recast;
        if (castTime > 0) {
          const tax = this.casterTax();
          this.casting = { id, start: this.now, end: this.now + castTime, tax };
          this.lockUntil = this.now + castTime + tax;
          this.emit('use', { id, gcd: true, cast: castTime, tax, t: this.now });
          this.emit('castStart', { id, start: this.now, end: this.now + castTime });
        } else {
          if (this.job.consumeInstant) this.job.consumeInstant(id, this);
          this.lockUntil = this.now + this.animLock(a.lock);
          this.emit('use', { id, gcd: true, cast: 0, t: this.now });
          this.resolveAction(id);
        }
      } else {
        if (!a.holdCd) this.startCd(id);
        this.lockUntil = this.now + this.animLock(a.lock);
        this.emit('use', { id, gcd: false, t: this.now });
        this.resolveAction(id);
      }
      if (a.target || a.pbaoe) {
        this.inCombat = true;
        if (this.job.autoAttack && this.autoNext === null) this.autoNext = this.now;
      }
      return true;
    }

    resolveAction(id) {
      const a = A[id];
      // Weaponskill combos: a combo action continues one, any other combo-aware weaponskill breaks it.
      if (a.kind === 'gcd' && (a.comboFrom !== undefined || a.comboStart || a.breaksCombo)) {
        const comboOk = a.comboFrom ? this.inCombo(a.comboFrom) || this.has('meikyoShisui') : false;
        this.lastComboHit = comboOk;
        // comboAs: an upgraded action continues the combo as its base (Heated Split Shot as Split Shot).
        this.combo = a.comboNext ? { id: a.comboAs || id, until: this.now + (this.job.comboTime || B.COMBO_TIME) } : null;
      }
      this.job.resolve(id, this);
      this.emit('resolve', { id });
    }

    queueHit(id, potency, snap, delay, after, opts) {
      this.hits.push(Object.assign({ at: this.now + (delay || 0.6), id, potency, snap, after }, opts || {}));
    }

    snapshot(a) { return this.job.snapshot(a, this); }

    // FFXIV damage formula with the job version's level modifiers (B.LEVELS). The attack power modifier is the
    // level's, lower for tanks (or stats.apMod), and tanks add Tenacity. opts.auto: an auto-attack (weapon damage
    // scaled by delay); opts.crit: always a critical hit.
    damage(potency, snap, isDot, opts) {
      const s = this.stats, L = this.lv;
      opts = opts || {};
      if (L.formula === 'hw') return this.damageHW(potency, snap, isDot, opts);
      const ap = s.apMod || (this.job.role === 'tank' ? L.apTank : L.ap);
      const fAP = Math.floor(ap * (snap.main - L.main) / L.main) + 100;
      // opts.dhDet: a guaranteed direct hit gains from the Direct Hit stat through Determination (6.2 on).
      const fDET = Math.floor(L.det * (s.det - L.main) / L.div) + 1000 + (opts.dhDet ? Math.floor(L.det * (s.dh - L.sub) / L.div) : 0);
      const fTNC = s.ten ? Math.floor((L.ten || 100) * (s.ten - L.sub) / L.div) + 1000 : 1000;     // 112 at level 100
      let fWD = Math.floor(L.main * s.jobMod / 1000) + s.wd;
      if (opts.auto) fWD = Math.floor(fWD * s.delay / 3);
      let d = Math.floor(Math.floor(potency * fAP * fDET / 100) / 1000);
      d = Math.floor(d * fTNC / 1000);
      if (isDot || opts.auto) d = Math.floor(d * (Math.floor(130 * (s.speed - L.sub) / L.div) + 1000) / 1000);
      d = Math.floor(Math.floor(d * fWD / 100) * s.trait / 100);
      // snap.critAdd: a crit-rate buff (the Spear).
      const critRate = Math.floor(200 * (s.crit - L.sub) / L.div + 50) / 1000 + (snap.critAdd || 0);
      const critMult = Math.floor(200 * (s.crit - L.sub) / L.div + 1400) / 1000;
      const dhRate = Math.floor(550 * (s.dh - L.sub) / L.div) / 1000 + (snap.dhAdd || 0);   // snap.dhAdd: Battle Voice
      const crit = !opts.noCrit && (opts.crit || Math.random() < critRate);     // opts.noCrit: Heavensward's Barrage hits
      const dh = opts.dh || Math.random() < dhRate;     // opts.dh: a guaranteed direct hit
      if (crit) d = Math.floor(d * critMult);
      if (dh) d = Math.floor(d * 1.25);
      d = Math.floor(d * (95 + Math.random() * 10) / 100);
      d = Math.floor(d * snap.mult);
      return { amount: d, crit, dh };
    }

    // Heavensward's formula (Dervy's fits, 2015–16): weaponskills and spells potency/100 × (WD/25 + 1) × main/9 ×
    // (1 + DET/7290); auto-attacks (WD/3 × delay/34 + 1) × main/6.8 × (1 + DET/6795) per swing; DoT ticks gain
    // 1 + (Skill Speed − 354)/6800. Crit rate (CRT − 354)/4290 + 5% for 1.45× + the same. No Direct Hit before 4.0.
    // A Realm Reborn (B.LEVELS.arr50) uses the same shape with its own divisors (a refit of the 2013-14 community
    // formulas), a flat ×1.5 crit and DoTs that speed doesn't touch: the level entry carries those.
    damageHW(potency, snap, isDot, opts) {
      const s = this.stats, L = this.lv;
      const caster = this.job.role === 'caster' || this.job.role === 'healer';
      let d;
      if (opts.auto) d = (potency / 100) * (s.wd / 3 * s.delay / 34 + 1) * (snap.main / (L.autoStrDiv || 6.8)) * (1 + s.det / (L.autoDetDiv || 6795));
      else d = (potency / 100) * (s.wd / 25 + 1) * (snap.main / ((caster && L.casterStrDiv) || L.strDiv || 9)) * (1 + s.det / ((caster && L.casterDetDiv) || L.detDiv || 7290));
      if (isDot && L.dotSpeed !== false) d *= 1 + (s.speed - 354) / 6800;
      d *= (s.trait || 100) / 100;
      const step = (s.crit - L.sub) / (L.critDiv || 4290);
      const crit = !opts.noCrit && (opts.crit || Math.random() < 0.05 + step + (snap.critAdd || 0));
      const dh = Math.random() < (snap.dhAdd || 0);
      if (crit) d *= L.critMult || 1.45 + step;
      if (dh) d *= 1.25;
      d *= (95 + Math.random() * 10) / 100;
      d = Math.max(1, Math.floor(d * snap.mult) - 1);
      return { amount: d, crit, dh };
    }

    // Out of combat: the dummy reset.
    stopAutos() { this.autoNext = null; this.inCombat = false; }

    // ---------- time ----------
    nextEventTime() {
      let t = Infinity;
      if (this.casting) t = Math.min(t, this.casting.end);
      for (const q of this.queue) t = Math.min(t, Math.max(this.now, this.availableAt(this.resolve(q.id))));
      for (const h of this.hits) t = Math.min(t, h.at);
      t = Math.min(t, this.mpTickNext, this.dotTickNext);
      if (this.autoNext !== null) t = Math.min(t, this.autoNext);
      if (this.job.nextEvent) t = Math.min(t, this.job.nextEvent(this));
      for (const k in this.statuses) t = Math.min(t, this.statuses[k].until);
      for (const k in this.tStatuses) t = Math.min(t, this.tStatuses[k].until);
      for (const id in this.cds) if (this.cds[id].nextAt !== null) t = Math.min(t, this.cds[id].nextAt);
      return t;
    }

    advance(dt) {
      const target = this.now + dt;
      let guard = 0;
      while (guard++ < 200) {
        const t = this.nextEventTime();
        if (t > target) break;
        this.now = Math.max(this.now, t);
        this.processAt();
      }
      this.now = target;
      this.processAt();
    }

    processAt() {
      const now = this.now;
      this.cdTick();
      if (this.job.process) this.job.process(this);

      for (const k of Object.keys(this.statuses)) {
        if (this.statuses[k].until <= now + EPS) this.removeStatus(k);
      }
      for (const k of Object.keys(this.tStatuses)) {
        if (this.tStatuses[k].until <= now + EPS) {
          delete this.tStatuses[k];
          this.emit('statusLose', { key: k, self: false });
        }
      }
      if (this.leyLines && this.leyLines.until <= now) this.leyLines = null;

      if (this.casting && now >= this.casting.end - EPS) {
        const c = this.casting;
        this.casting = null;
        const err = this.job.checkCompletion ? this.job.checkCompletion(c.id, this) : null;
        if (err) {
          this.gcdEnd = Math.min(this.gcdEnd, now); this.lockUntil = now;
          this.emit('interrupt', { id: c.id, reason: err });
        } else {
          this.emit('castEnd', { id: c.id });
          this.resolveAction(c.id);
        }
      }

      if (this.hits.length) {
        const due = this.hits.filter(h => h.at <= now + EPS);
        if (due.length) {
          this.hits = this.hits.filter(h => h.at > now + EPS);
          due.sort((a, b) => a.at - b.at);
          for (const h of due) {
            const a = A[h.id] || {};
            // Point-blank AoE (Demon Slice, Blizzard II) needs no target, but whiffs if the dummy isn't inside it.
            if (a.pbaoe && this.distToTarget() - B.DUMMY_RADIUS > a.pbaoe) continue;
            // A hit from something that's gone (Demi-Bahamut after its 20s) does nothing.
            if (h.expires !== undefined && now > h.expires + EPS) continue;
            const r = this.damage(h.potency, h.snap, false, h);
            this.emit('hit', { id: h.id, amount: r.amount, crit: r.crit, dh: r.dh, dot: false, auto: !!h.auto, positional: h.positional, t: now });
            if (h.onResult) h.onResult(r);          // a job reacting to how it landed (Monk's chakra on crits)
            if (this.job.onHit) this.job.onHit(h, r, this);   // or to every hit (Machinist's Wildfire)
            // The rest of the pack, each with the action's falloff (a job can pass its own, e.g. a combo's).
            const aoe = h.aoe !== undefined ? h.aoe : a.aoe;
            if (aoe && !h.auto) {
              for (let k = 1; k < this.targets; k++) {
                const x = this.damage(h.potency * B.aoeMult(aoe, k), h.snap, false, h);
                this.emit('hit', { id: h.id, amount: x.amount, crit: x.crit, dh: x.dh, dot: false, extra: k, t: now });
              }
            }
            if (h.after) h.after();
          }
        }
      }

      if (now >= this.mpTickNext - EPS) {
        this.mpTickNext += 3;
        const gain = this.mpTickGain();
        const before = this.mp;
        this.mp = Math.min(this.maxMp, this.mp + gain);
        if (this.mp > before) this.emit('mpGain', { amount: this.mp - before, source: 'tick' });
        if (this.usesTp) this.tp = Math.min(this.job.tp.max, this.tp + this.job.tp.regen);
        this.emit('mpTick');
      }

      // DoTs (and Lucid Dreaming's Refresh) tick on the server's 3s status tick, not from when they landed.
      if (now >= this.dotTickNext - EPS) {
        this.dotTickNext += 3;
        if (this.has('lucidDreaming')) {
          const gain = this.job.lucidGain ? this.job.lucidGain(this) : B.LUCID_REGEN;
          const before = this.mp;
          this.mp = Math.min(this.maxMp, this.mp + gain);
          if (this.mp > before) this.emit('mpGain', { amount: this.mp - before, source: 'lucid' });
        }
        for (const [key, st] of Object.entries(this.tStatuses)) {
          if (!st.dot || st.until <= now + EPS) continue;
          const r = this.damage(st.dot.potency, st.snap, true);
          this.emit('hit', { id: st.dot.id, amount: r.amount, crit: r.crit, dh: r.dh, dot: true, t: now });
          // An AoE's DoT (Thunder IV, Bow Shock) ticks on every dummy it reached; so does one spread by Bane
          // (st.aoe: its falloff by dummy).
          const da = A[st.dot.id];
          if ((da && da.dot && da.dot.aoe) || st.aoe) {
            for (let k = 1; k < Math.min(this.targets, st.targets || 1); k++) {
              const x = this.damage(st.dot.potency * B.aoeMult(st.aoe || true, k), st.snap, true);
              this.emit('hit', { id: st.dot.id, amount: x.amount, crit: x.crit, dh: x.dh, dot: true, extra: k, t: now });
            }
          }
          if (this.job.onDotTick) this.job.onDotTick(key, this, r);
        }
      }

      // Auto-attacks, once engaged, while the dummy is in reach.
      if (this.autoNext !== null && now >= this.autoNext - EPS) {
        const au = this.job.autoAttack;
        const delay = au.delay * (100 - (this.job.autoHaste ? this.job.autoHaste(this) : 0)) / 100;
        this.autoNext = now + delay;
        // job.noAutos: auto-attacks switched off (Heavensward Machinist's Gauss Barrel).
        if (this.targeted && !this.untargetable && !this.ko && this.distToTarget() - B.DUMMY_RADIUS <= au.range && !(this.job.noAutos && this.job.noAutos(this))) {
          // job.autoStrikes: hits per swing (A Realm Reborn's Barrage: three).
          const snap = this.snapshot({ school: 'physical', auto: true });
          const n = this.job.autoStrikes ? this.job.autoStrikes(this) : 1;
          for (let k = 0; k < n; k++) this.queueHit('auto', au.potency, snap, 0.1 + k * 0.15, null, { auto: true });
        }
      }

      if (this.queue.length) this.runQueue();
    }

    // MP restored on the next tick (what the tick timer above the MP bar shows).
    mpTickGain() {
      if (this.job.mpRegen) return this.job.mpRegen(this);
      return B.BASE_REGEN;
    }

    // ---------- movement ----------
    // speedMul: below 1 for backpedalling. On the game's map you walk through its collision (stairs, walls, ledges);
    // without it, a flat floor 38 yalms around the dummy.
    move(dx, dz, dt, speedMul) {
      if (this.ko) { dx = 0; dz = 0; }
      const moving = dx !== 0 || dz !== 0, w = this.world;
      if (moving) {
        const speed = 6 * (this.has('sprint') ? 1.3 : 1) * (speedMul || 1);
        const len = Math.hypot(dx, dz);
        const sx = dx / len * speed * dt, sz = dz / len * speed * dt;
        if (w) w.walk(this.pos, sx, sz);
        else { this.pos.x += sx; this.pos.z += sz; }
        // Keep a little space from the dummy's hitbox (a fight's boss you can walk under: B.DUMMY_KEEP).
        const d = Math.hypot(this.pos.x, this.pos.z), keep = B.DUMMY_KEEP || B.DUMMY_RADIUS + 0.6;
        if (d < keep && Math.abs(this.pos.y) < 1.5) { this.pos.x *= keep / d; this.pos.z *= keep / d; }
        const lim = w ? 150 : 38;
        const r = Math.hypot(this.pos.x, this.pos.z);
        if (r > lim) { this.pos.x *= lim / r; this.pos.z *= lim / r; }
      }
      if (w) w.fall(this.pos, dt);
      else this.pos.y = 0;
      if (moving !== this.moving || moving) this.setMoving(moving);
    }

    // Per-frame job upkeep (Circle of Power while standing in Ley Lines).
    frame() { if (this.job.frame) this.job.frame(this); }
  }

  B.Engine = Engine;
})(window.BLM);
