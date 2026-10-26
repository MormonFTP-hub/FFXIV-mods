// Combat engine: GCD, casting, animation lock, action queue, the Elemental Gauge,
// MP and DoT server ticks, and the damage formula. No drawing in here.
(function (B) {
  const A = B.ACTIONS;
  const EPS = 1e-6;

  const FIRE_MULT = { 1: 1.4, 2: 1.6, 3: 1.8, '-1': 0.9, '-2': 0.8, '-3': 0.7 };
  const ICE_MULT = { 1: 0.9, 2: 0.8, 3: 0.7 };
  const AF_ICE_COST = { 1: 0.5, 2: 0.25, 3: 0 };
  const UI_FIRE_COST = { 1: 0.5, 2: 0.25, 3: 0 };

  class Engine {
    constructor(settings) {
      this.listeners = {};
      this.now = 0;
      this.settings = settings;
      this.pos = { x: 0, z: -14 };
      this.reset();
    }

    on(type, fn) { (this.listeners[type] = this.listeners[type] || []).push(fn); }
    emit(type, data) { (this.listeners[type] || []).forEach(fn => fn(data || {})); }

    get stats() {
      const sps = Math.max(B.SPS_MIN, Math.min(B.SPS_MAX, Math.round(this.settings.sps) || B.DEFAULT_SETTINGS.sps));
      return Object.assign({}, B.BASE_STATS, { sps });
    }

    reset() {
      this.mp = B.MAX_MP;
      this.maxHp = 74210;
      this.hp = this.maxHp;
      this.element = 0;            // +1..+3 Astral Fire, -1..-3 Umbral Ice
      this.elementUntil = 0;
      this.hearts = 0;
      this.polyglot = 0;
      this.enoStart = null;
      this.paradox = false;
      this.statuses = {};
      this.tStatuses = {};
      this.cds = {};
      this.gcdStart = -10; this.gcdEnd = -10; this.gcdLen = 2.5;
      this.lockUntil = 0;
      this.casting = null;
      this.queued = null;
      this.hits = [];
      this.mpTickNext = this.now + 0.5 + Math.random() * 2.5;
      this.dotTickNext = this.now + 0.5 + Math.random() * 2.5;
      this.leyLines = null;
      this.targeted = true;
      this.moving = false;
      this.jumpUntil = 0;
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
      this.tStatuses[key] = Object.assign({ until: this.now + dur, dur }, extra || {});
      this.emit('statusGain', { key, self: false, refreshed: had });
    }

    distToTarget() { return Math.hypot(this.pos.x, this.pos.z); }
    inCircle() {
      return !!(this.leyLines && this.leyLines.until > this.now &&
        Math.hypot(this.pos.x - this.leyLines.x, this.pos.z - this.leyLines.z) <= 3);
    }

    speedScale(baseSec, haste) {
      const x = Math.floor(130 * (this.stats.sps - 400) / 1900);
      let ms = Math.floor(baseSec * 1000 * (1000 - x) / 1000);
      ms = Math.floor(ms * (100 - (haste || 0)) / 100);
      return Math.floor(ms / 10) / 100;
    }

    gcdRecast() { return this.speedScale(2.5, this.inCircle() ? 15 : 0); }

    // Fire and Blizzard turn into Paradox while the marker is lit.
    resolve(id) {
      if ((id === 'fire' || id === 'blizzard') && this.paradox) return 'paradox';
      return id;
    }

    cd(id) {
      const a = A[id];
      if (!this.cds[id]) this.cds[id] = { max: a.charges || 1, charges: a.charges || 1, recast: a.recast, nextAt: null };
      return this.cds[id];
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
      if (this.casting) t = Math.max(t, this.casting.end + B.CASTER_TAX);
      if (a.kind === 'gcd') t = Math.max(t, this.gcdEnd);
      else t = Math.max(t, this.cdReadyAt(id));
      return t;
    }

    castTimeFor(id) {
      const a = A[id];
      if (!a.cast) return 0;
      if (id === 'paradox' && this.element < 0) return 0;
      if (id === 'fire3' && this.has('firestarter')) return 0;
      if (id === 'thunder3' && this.has('thundercloud')) return 0;
      if (this.has('swiftcast') || this.has('triplecast')) return 0;
      let base = a.cast;
      if (a.school === 'fire' && this.element === -3) base /= 2;
      if (a.school === 'ice' && this.element === 3) base /= 2;
      return this.speedScale(base, this.inCircle() ? 15 : 0);
    }

    mpCost(id) {
      const a = A[id];
      const el = this.element;
      switch (id) {
        case 'despair': return this.mp;
        case 'paradox': return el < 0 ? 0 : 1600;
        case 'thunder3': return this.has('thundercloud') ? 0 : a.mp;
        case 'fire3': if (this.has('firestarter')) return 0; break;
      }
      if (!a.mp) return 0;
      if (a.school === 'fire') {
        if (el > 0) return this.hearts > 0 ? a.mp : a.mp * 2;
        if (el < 0) return a.mp * UI_FIRE_COST[-el];
      }
      if (a.school === 'ice') {
        if (el > 0) return a.mp * AF_ICE_COST[el];
        if (el < 0) return 0;
      }
      return a.mp;
    }

    // Returns an error message, or null when the action can go off right now.
    // forHotbar skips target, range and movement, which the hotbar shows another way.
    checkConditions(id, forHotbar) {
      const a = A[id];
      if (a.target && !forHotbar) {
        if (!this.targeted) return 'Invalid target.';
        if (this.distToTarget() - B.DUMMY_RADIUS > B.RANGE) return 'Target not in range.';
      }
      switch (id) {
        case 'fire4': if (this.element <= 0) return 'Unable to execute action. Astral Fire required.'; break;
        case 'despair':
          if (this.element <= 0) return 'Unable to execute action. Astral Fire required.';
          if (this.mp < 800) return 'Not enough MP.';
          break;
        case 'blizzard4': if (this.element >= 0) return 'Unable to execute action. Umbral Ice required.'; break;
        case 'umbralSoul': if (this.element >= 0) return 'Unable to execute action. Umbral Ice required.'; break;
        case 'paradox': if (!this.paradox) return 'Unable to execute action.'; break;
        case 'xenoglossy': case 'foul': if (this.polyglot < 1) return 'Unable to execute action. Polyglot required.'; break;
        case 'transpose': if (this.element === 0) return 'Unable to execute action.'; break;
        case 'amplifier': if (this.element === 0) return 'Unable to execute action. Astral Fire or Umbral Ice required.'; break;
        case 'betweenTheLines': if (!(this.leyLines && this.leyLines.until > this.now)) return 'Unable to execute action. Ley Lines required.'; break;
      }
      if (a.kind === 'gcd' && this.mp < this.mpCost(id)) return 'Not enough MP.';
      if (!forHotbar && a.kind === 'gcd' && this.castTimeFor(id) > 0 && this.moving) return 'Unable to cast while moving.';
      return null;
    }

    // ---------- input ----------
    press(rawId) {
      const id = this.resolve(rawId);
      if (!A[id]) return;
      const at = this.availableAt(id);
      if (at <= this.now + EPS) {
        this.queued = null;
        this.execute(id);
      } else if (at - this.now <= B.QUEUE_WINDOW) {
        this.queued = { id, at };
      }
    }

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
      // A cancelled cast hands the GCD back.
      this.gcdEnd = this.now; this.lockUntil = this.now;
      this.emit('interrupt', { id: c.id, reason });
    }

    execute(id) {
      const a = A[id];
      const err = this.checkConditions(id);
      if (err) { this.emit('error', { msg: err, id }); return false; }

      if (a.kind === 'gcd') {
        const castTime = this.castTimeFor(id);
        const recast = this.gcdRecast();
        this.gcdStart = this.now; this.gcdEnd = this.now + recast; this.gcdLen = recast;
        if (castTime > 0) {
          this.casting = { id, start: this.now, end: this.now + castTime };
          this.lockUntil = this.now + castTime + B.CASTER_TAX;
          this.emit('use', { id, gcd: true, cast: castTime, t: this.now });
          this.emit('castStart', { id, start: this.now, end: this.now + castTime });
        } else {
          this.consumeInstant(id);
          this.lockUntil = this.now + this.settings.animLock;
          this.emit('use', { id, gcd: true, cast: 0, t: this.now });
          this.resolveSpell(id);
        }
      } else {
        const c = this.cd(id);
        if (c.charges === c.max) c.nextAt = this.now + c.recast;
        c.charges--;
        this.lockUntil = this.now + (a.lock || this.settings.animLock);
        this.emit('use', { id, gcd: false, t: this.now });
        this.resolveAbility(id);
      }
      return true;
    }

    // Spells with a cast time that went off instantly eat the buff that made them instant.
    consumeInstant(id) {
      const a = A[id];
      if (!a.cast) return;
      if (id === 'paradox' && this.element < 0) return;
      if (id === 'fire3' && this.has('firestarter')) return;       // eaten in resolveSpell
      if (id === 'thunder3' && this.has('thundercloud')) return;   // eaten in resolveSpell
      if (this.has('triplecast')) {
        const s = this.statuses.triplecast;
        s.stacks--;
        if (s.stacks <= 0) this.removeStatus('triplecast');
        else this.emit('statusStack', { key: 'triplecast' });
        return;
      }
      if (this.has('swiftcast')) this.removeStatus('swiftcast');
    }

    // ---------- resolution ----------
    setElement(next) {
      const prev = this.element;
      // Aspect Mastery V: AF3 -> Umbral Ice, or UI3 with 3 hearts -> Astral Fire, lights Paradox.
      if (prev === 3 && next < 0) this.paradox = true;
      if (prev === -3 && this.hearts === 3 && next > 0) this.paradox = true;
      this.element = next;
      if (next === 0) {
        this.elementUntil = 0;
        this.enoStart = null;
      } else {
        this.elementUntil = this.now + B.ELEMENT_DURATION;
        if (prev === 0) this.enoStart = this.now;
      }
      if (prev !== next) this.emit('element', { prev, next });
    }

    snapshot(school) {
      let mult = 1;
      if (this.element !== 0) mult *= B.ENOCHIAN;
      if (school === 'fire' && this.element !== 0) mult *= FIRE_MULT[this.element];
      if (school === 'ice' && this.element > 0) mult *= ICE_MULT[this.element];
      const int = B.BASE_STATS.int + (this.has('medicated') ? B.TINCTURE_INT : 0);
      return { mult, int };
    }

    resolveSpell(id) {
      const a = A[id];
      const cost = this.mpCost(id);
      if (this.mp < cost) { this.emit('error', { msg: 'Not enough MP.' }); return; }
      // Hearts cover the doubled cost of fire spells under Astral Fire.
      if (a.school === 'fire' && id !== 'despair' && this.element > 0 && this.hearts > 0 && cost > 0) {
        this.hearts--;
        this.emit('hearts', { n: this.hearts });
      }
      this.mp -= cost;

      const snap = this.snapshot(a.school);
      let potency = a.potency;
      const sharp = this.has('sharpcast');
      const procFirestarter = () => {
        if (sharp || Math.random() < 0.4) this.addStatus('firestarter', 30);
      };

      switch (id) {
        case 'fire':
          if (sharp) this.removeStatus('sharpcast');
          if (this.element < 0) this.setElement(0);
          else this.setElement(Math.min(3, this.element + 1));
          procFirestarter();
          break;
        case 'blizzard':
          if (this.element > 0) this.setElement(0);
          else this.setElement(Math.max(-3, this.element - 1));
          break;
        case 'fire3':
          if (this.has('firestarter')) this.removeStatus('firestarter');
          this.setElement(3);
          break;
        case 'blizzard3':
          this.setElement(-3);
          break;
        case 'fire4':
          break;
        case 'blizzard4':
          this.hearts = 3;
          this.emit('hearts', { n: 3 });
          break;
        case 'despair':
          this.setElement(3);
          break;
        case 'paradox':
          this.paradox = false;
          if (this.element > 0) {
            this.elementUntil = this.now + B.ELEMENT_DURATION;
            if (sharp) this.removeStatus('sharpcast');
            procFirestarter();
          } else if (this.element < 0) {
            this.elementUntil = this.now + B.ELEMENT_DURATION;
          }
          this.emit('paradox', { active: false });
          break;
        case 'thunder3':
          if (this.has('thundercloud')) {
            this.removeStatus('thundercloud');
            potency += a.dot.potency * a.dot.duration / 3;
          }
          break;
        case 'xenoglossy': case 'foul':
          this.polyglot--;
          this.emit('polyglot', { n: this.polyglot });
          break;
        case 'scathe':
          if (sharp) this.removeStatus('sharpcast');
          if (sharp || Math.random() < 0.2) potency *= 2;
          break;
        case 'umbralSoul':
          this.setElement(Math.max(-3, this.element - 1));
          this.elementUntil = this.now + B.ELEMENT_DURATION;
          this.hearts = Math.min(3, this.hearts + 1);
          this.emit('hearts', { n: this.hearts });
          break;
      }

      if (id === 'thunder3') {
        const sharpT = sharp;
        if (sharpT) this.removeStatus('sharpcast');
        this.queueHit(id, potency, snap, a.delay, () => {
          const dsnap = this.snapshot('thunder');
          dsnap.mult = snap.mult; dsnap.int = snap.int;
          this.addTStatus('thunder3', a.dot.duration, { snap: dsnap });
          if (sharpT) this.addStatus('thundercloud', 40);
        });
      } else if (a.potency) {
        this.queueHit(id, potency, snap, a.delay);
      }
      this.emit('resolve', { id });
    }

    resolveAbility(id) {
      switch (id) {
        case 'transpose':
          if (this.element > 0) this.setElement(-1);
          else if (this.element < 0) this.setElement(1);
          break;
        case 'sharpcast': this.addStatus('sharpcast', 30); break;
        case 'triplecast': this.addStatus('triplecast', 15, { stacks: 3 }); break;
        case 'swiftcast': this.addStatus('swiftcast', 10); break;
        case 'manafont': {
          const before = this.mp;
          this.mp = Math.min(B.MAX_MP, this.mp + 3000);
          this.emit('mpGain', { amount: this.mp - before, source: 'manafont' });
          break;
        }
        case 'amplifier':
          this.polyglot = Math.min(B.POLYGLOT_MAX, this.polyglot + 1);
          this.emit('polyglot', { n: this.polyglot });
          break;
        case 'leyLines':
          this.leyLines = { x: this.pos.x, z: this.pos.z, until: this.now + 30, start: this.now };
          this.addStatus('leyLines', 30);
          break;
        case 'betweenTheLines': {
          const from = { x: this.pos.x, z: this.pos.z };
          this.pos.x = this.leyLines.x; this.pos.z = this.leyLines.z;
          this.emit('teleport', { from, to: { x: this.pos.x, z: this.pos.z } });
          break;
        }
        case 'manaward': this.addStatus('manaward', 20); break;
        case 'lucidDreaming': this.addStatus('lucidDreaming', 21); break;
        case 'addle': this.addTStatus('addle', 10); break;
        case 'surecast': this.addStatus('surecast', 6); break;
        case 'sprint': this.addStatus('sprint', 10); break;
        case 'tincture': this.addStatus('medicated', 30); break;
      }
      this.emit('resolve', { id });
    }

    queueHit(id, potency, snap, delay, after) {
      this.hits.push({ at: this.now + (delay || 0.6), id, potency, snap, after });
    }

    // FFXIV damage formula at level 90 (6.x level modifiers).
    damage(potency, snap, isDot) {
      const s = this.stats;
      const fAP = Math.floor(195 * (snap.int - 390) / 390) + 100;
      const fDET = Math.floor(140 * (s.det - 390) / 1900) + 1000;
      const fWD = Math.floor(390 * 115 / 1000) + s.wd;
      let d = Math.floor(Math.floor(potency * fAP * fDET / 100) / 1000);
      if (isDot) d = Math.floor(d * (Math.floor(130 * (s.sps - 400) / 1900) + 1000) / 1000);
      d = Math.floor(Math.floor(d * fWD / 100) * B.TRAIT / 100);
      const critRate = Math.floor(200 * (s.crit - 400) / 1900 + 50) / 1000;
      const critMult = Math.floor(200 * (s.crit - 400) / 1900 + 1400) / 1000;
      const dhRate = Math.floor(550 * (s.dh - 400) / 1900) / 1000;
      const crit = Math.random() < critRate;
      const dh = Math.random() < dhRate;
      if (crit) d = Math.floor(d * critMult);
      if (dh) d = Math.floor(d * 1.25);
      d = Math.floor(d * (95 + Math.random() * 10) / 100);
      d = Math.floor(d * snap.mult);
      return { amount: d, crit, dh };
    }

    // ---------- time ----------
    nextEventTime() {
      let t = Infinity;
      if (this.casting) t = Math.min(t, this.casting.end);
      if (this.queued) t = Math.min(t, Math.max(this.now, this.queued.at));
      for (const h of this.hits) t = Math.min(t, h.at);
      t = Math.min(t, this.mpTickNext, this.dotTickNext);
      if (this.element !== 0) t = Math.min(t, this.elementUntil);
      if (this.enoStart !== null) t = Math.min(t, this.enoStart + B.POLYGLOT_TIME);
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

      // Element timer runs out: the gauge empties and Enochian progress resets.
      if (this.element !== 0 && now >= this.elementUntil - EPS) {
        const prev = this.element;
        this.element = 0; this.elementUntil = 0; this.enoStart = null;
        this.emit('element', { prev, next: 0, expired: true });
      }

      if (this.enoStart !== null && now >= this.enoStart + B.POLYGLOT_TIME - EPS) {
        this.enoStart += B.POLYGLOT_TIME;
        if (this.polyglot < B.POLYGLOT_MAX) {
          this.polyglot++;
          this.emit('polyglot', { n: this.polyglot, gained: true });
        }
      }

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
        const err = this.checkCompletion(c.id);
        if (err) {
          this.gcdEnd = Math.min(this.gcdEnd, now); this.lockUntil = now;
          this.emit('interrupt', { id: c.id, reason: err });
        } else {
          this.emit('castEnd', { id: c.id });
          this.resolveSpell(c.id);
        }
      }

      if (this.hits.length) {
        const due = this.hits.filter(h => h.at <= now + EPS);
        if (due.length) {
          this.hits = this.hits.filter(h => h.at > now + EPS);
          due.sort((a, b) => a.at - b.at);
          for (const h of due) {
            const r = this.damage(h.potency, h.snap, false);
            this.emit('hit', { id: h.id, amount: r.amount, crit: r.crit, dh: r.dh, dot: false, t: now });
            if (h.after) h.after();
          }
        }
      }

      if (now >= this.mpTickNext - EPS) {
        this.mpTickNext += 3;
        if (this.element <= 0) {
          let gain = this.element < 0 ? B.UI_REGEN[-this.element - 1] : B.BASE_REGEN;
          if (this.has('lucidDreaming')) gain += B.LUCID_REGEN;
          const before = this.mp;
          this.mp = Math.min(B.MAX_MP, this.mp + gain);
          if (this.mp > before) this.emit('mpGain', { amount: this.mp - before, source: 'tick' });
        }
        this.emit('mpTick');
      }

      if (now >= this.dotTickNext - EPS) {
        this.dotTickNext += 3;
        const dot = this.tStatuses.thunder3;
        if (dot && dot.until > now + EPS) {
          const r = this.damage(A.thunder3.dot.potency, dot.snap, true);
          this.emit('hit', { id: 'thunder3', amount: r.amount, crit: r.crit, dh: r.dh, dot: true, t: now });
          if (Math.random() < 0.1) this.addStatus('thundercloud', 40);
        }
      }

      if (this.queued && now >= this.queued.at - EPS) {
        const q = this.queued;
        const at = this.availableAt(q.id);
        if (at <= now + EPS) {
          this.queued = null;
          this.execute(this.resolve(q.id));
        } else {
          q.at = at;
        }
      }
    }

    // The gauge or MP can change under a cast; the game cancels it at the end if so.
    checkCompletion(id) {
      switch (id) {
        case 'fire4': case 'despair':
          if (this.element <= 0) return 'Interrupted';
          break;
        case 'blizzard4':
          if (this.element >= 0) return 'Interrupted';
          break;
        case 'paradox':
          if (!this.paradox) return 'Interrupted';
          break;
      }
      if (this.mp < this.mpCost(id) || (id === 'despair' && this.mp < 800)) return 'Not enough MP.';
      return null;
    }

    // ---------- movement ----------
    move(dx, dz, dt) {
      const moving = dx !== 0 || dz !== 0;
      if (moving) {
        const speed = 6 * (this.has('sprint') ? 1.3 : 1);
        const len = Math.hypot(dx, dz);
        this.pos.x += dx / len * speed * dt;
        this.pos.z += dz / len * speed * dt;
        // Keep a little space from the dummy's hitbox.
        const d = Math.hypot(this.pos.x, this.pos.z);
        if (d < 1.4) { this.pos.x *= 1.4 / d; this.pos.z *= 1.4 / d; }
        const lim = 38;
        const r = Math.hypot(this.pos.x, this.pos.z);
        if (r > lim) { this.pos.x *= lim / r; this.pos.z *= lim / r; }
      }
      if (moving !== this.moving || moving) this.setMoving(moving);
    }

    syncCircle() {
      const inside = this.inCircle();
      if (inside && !this.has('circleOfPower')) this.addStatus('circleOfPower', 999, { permanent: true });
      else if (!inside && this.statuses.circleOfPower) this.removeStatus('circleOfPower');
      if (this.statuses.circleOfPower) this.statuses.circleOfPower.until = this.now + 999;
    }
  }

  B.Engine = Engine;
})(window.BLM);
