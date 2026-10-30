// The sim: one player, one striking dummy, real time. A class (js/classes/*.js) supplies its skills and hooks;
// this file owns the timing rules, the damage formula, the meter's log and positionals.
//
// Timing. AION 2 has no global cooldown: each skill locks you for its own animation, then the next one starts.
// A skill pressed during the last QUEUE seconds of an animation goes next. Combat Speed shortens animations,
// Cast Speed shortens casts; cooldowns only shrink with Cooldown Reduction.
// Damage. (base at skill level + Attack × skill %) × (1 + Damage Boost) × back attack × critical × Multi-Hit,
// less the boss's damage reduction. See FORMULA for the constants.
(function () {
  'use strict';
  const A2 = window.A2 = window.A2 || {};

  // The community's model (Taiwanese and Korean tests, expcarry, mmoherald); NCSOFT publishes no formula.
  const FORMULA = A2.FORMULA = {
    critBase: 1.5,          // a critical hit before Critical Damage Boost (PvE)
    critPer: 1500,          // about 6.66% critical chance per 100 Critical Hit...
    critCap: 0.5,           // ...up to the Global client's 50% cap (the stat roll only; sure crits and stagger sit on top)
    brokenCrit: 0.45,       // a Staggered boss takes critical hits about 95% of the time in Global parses
    doubleMult: 2,          // a Double hit deals x2 in PvE
    multiHitDmg: 0.1,       // each extra Multi-Hit strike deals 10% of the hit, up to 4 of them
    breakTime: 5,           // "about 5 seconds on most bosses"
    staggerMax: 300,        // gauge size isn't published; 300 gives a solo player a break every half minute or so
    backArc: Math.PI,       // the rear half counts as behind
    variance: 0.04,         // the weapon's min-max roll, roughly
  };
  const QUEUE = 0.5;
  const MOVE_SPEED = 6.2;    // m/s on foot
  const PROC_WINDOW = 6;     // how long a "becomes usable on ..." skill stays lit

  function Sim(cls, cfg) {
    this.cls = cls;
    this.cfg = cfg;
    this.BACK_ARC = FORMULA.backArc;
    this.listeners = {};
    this.reset();
  }
  A2.Sim = Sim;

  Sim.prototype.on = function (type, fn) { (this.listeners[type] = this.listeners[type] || []).push(fn); };
  Sim.prototype.emit = function (type, a, b) { (this.listeners[type] || []).forEach((fn) => fn(a, b, this)); };

  Sim.prototype.reset = function () {
    const cfg = this.cfg;
    this.rand = A2.rng(cfg.seed == null ? (Math.random() * 1e9) | 0 : cfg.seed);
    this.t = 0;
    this.startedAt = null;
    this.done = false;
    this.p = {
      x: 0, y: 3.2, moving: false, goal: null, dir: [0, 0],
      mp: 0, lockUntil: 0, lockLen: 0, castUntil: 0, casting: null, queue: null,
      cds: {}, uses: {}, buffs: {}, procs: {}, icd: {}, stealth: 0, speedBuff: false,
    };
    this.tg = {
      x: 0, y: 0, r: 1.0, face: Math.PI / 2, flash: 0,
      hpMax: 1, hp: 1, stg: 0, brokenUntil: -1, debuffs: {},
    };
    this.log = [];
    this.bySkill = {};
    this.total = 0;
    this.pending = [];       // hits that land after a short delay (the swing's contact frame)
    this.skills = {};
    this.stats = {};
    this.build();
    this.p.mp = this.stats.mpMax;
    if (this.cfg.dummy.stagger === 'off') this.tg.noStagger = true;
    if (this.cls.init) this.cls.init(this);
  };

  // --- the build: which skills are on the bars, at what level, with which specializations ----------

  Sim.prototype.build = function () {
    const cls = this.cls, cfg = this.cfg;
    const stigmas = new Set(cfg.stigmas || []);
    this.skills = {};
    for (const id in cls.skills) {
      const s = Object.assign({id}, cls.skills[id]);
      s.level = s.kind === 'stigma' ? cfg.lvStigma : cfg.lvActive;
      s.equipped = s.kind !== 'stigma' || stigmas.has(id);
      s.specOn = (cfg.specs && cfg.specs[id]) || [];
      s.mods = {};
      (s.specs || []).forEach((sp, i) => {
        if (s.specOn.indexOf(i) >= 0 && s.level >= sp.lv && sp.mod) {
          for (const k in sp.mod) s.mods[k] = typeof sp.mod[k] === 'number' ? (s.mods[k] || 0) + sp.mod[k] : sp.mod[k];
        }
      });
      this.skills[id] = s;
    }
    const st = Object.assign({}, cfg.stats);
    st.mpMax = st.mpMax || 1000;
    this.lvP = cfg.lvPassive || cfg.lvActive;   // passive skill level
    if (cls.passives) cls.passives(this, st);
    this.stats = st;
  };

  Sim.prototype.level = function (id) { return this.skills[id] ? this.skills[id].level : 1; };
  Sim.prototype.has = function (id) { const s = this.skills[id]; return !!(s && s.equipped); };

  // --- buffs and debuffs ------------------------------------------------------------------------

  Sim.prototype.buff = function (id, dur, data) {
    const b = this.p.buffs[id];
    const until = this.t + dur;
    this.p.buffs[id] = Object.assign(b && b.until > this.t ? b : {stacks: 0}, data || {}, {until, dur});
    return this.p.buffs[id];
  };
  Sim.prototype.buffOn = function (id) { const b = this.p.buffs[id]; return b && b.until > this.t ? b : null; };
  Sim.prototype.debuff = function (id, dur, data) {
    const d = this.tg.debuffs[id];
    this.tg.debuffs[id] = Object.assign(d && d.until > this.t ? d : {stacks: 0}, data || {}, {until: this.t + dur, dur});
    return this.tg.debuffs[id];
  };
  Sim.prototype.debuffOn = function (id) { const d = this.tg.debuffs[id]; return d && d.until > this.t ? d : null; };
  Sim.prototype.stacks = function (id) { const d = this.debuffOn(id); return d ? d.stacks : 0; };
  Sim.prototype.addStacks = function (id, n, max, dur) {
    const d = this.debuff(id, dur, {});
    d.stacks = Math.min(max, (d.stacks || 0) + n);
    d.max = max;
    return d;
  };
  Sim.prototype.proc = function (id, dur) { this.p.procs[id] = this.t + (dur || PROC_WINDOW); this.emit('proc', id); };
  Sim.prototype.procOn = function (id) { return (this.p.procs[id] || 0) > this.t; };
  /** Internal cooldown for passive procs ("cooldown 1s"). */
  Sim.prototype.icdReady = function (id, cd) {
    if ((this.p.icd[id] || -1) > this.t) return false;
    this.p.icd[id] = this.t + cd;
    return true;
  };

  /** Sum of a stat from the character sheet plus every running buff that adds to it. */
  Sim.prototype.stat = function (k) {
    let v = this.stats[k] || 0;
    for (const id in this.p.buffs) {
      const b = this.p.buffs[id];
      if (b.until > this.t && b.stat && b.stat[k]) v += b.stat[k] * (b.mult || 1);
    }
    if (k === 'attack') {
      let pct = 0;
      for (const id in this.p.buffs) {
        const b = this.p.buffs[id];
        if (b.until > this.t) pct += ((b.atkPct || 0) + ((b.stat && b.stat.atkPct) || 0)) * (b.mult || 1);
      }
      if (this.cls.statHook) v = this.cls.statHook(this, k, v);
      return v * (1 + pct / 100);
    }
    if (this.cls.statHook) v = this.cls.statHook(this, k, v);
    return v;
  };

  /** Critical chance: the stat roll (capped), then sure-crit bonuses and a broken stagger gauge on top. */
  Sim.prototype.critChance = function (bonusRating, bonusPct) {
    const r = this.stat('critHit') + (bonusRating || 0);
    const cap = (this.cfg.stats.critCap || FORMULA.critCap * 100) / 100;
    let c = Math.min(cap, Math.max(0, r / FORMULA.critPer));
    c += (this.stat('critPct') + (bonusPct || 0)) / 100;
    if (this.t < this.tg.brokenUntil) c += FORMULA.brokenCrit;
    return Math.min(1, c);
  };

  // --- positions --------------------------------------------------------------------------------

  Sim.prototype.dist = function () { return Math.max(0, Math.hypot(this.p.x - this.tg.x, this.p.y - this.tg.y) - this.tg.r); };
  Sim.prototype.isBack = function () {
    const a = Math.atan2(this.p.y - this.tg.y, this.p.x - this.tg.x);
    let d = Math.abs(a - this.tg.face) % (2 * Math.PI);
    if (d > Math.PI) d = 2 * Math.PI - d;
    return d > Math.PI - FORMULA.backArc / 2;
  };
  Sim.prototype.placeAt = function (where) {
    const from = [this.p.x, this.p.y];
    const tg = this.tg;
    let a;
    if (where === 'behind') a = tg.face + Math.PI + (this.rand() - 0.5) * 0.5;
    else if (where === 'opposite') a = Math.atan2(this.p.y - tg.y, this.p.x - tg.x) + Math.PI;
    else if (where === 'back-off') {
      const away = Math.atan2(this.p.y - tg.y, this.p.x - tg.x);
      const d = Math.min(9, this.dist() + 6);
      this.p.x = tg.x + Math.cos(away) * (tg.r + d);
      this.p.y = tg.y + Math.sin(away) * (tg.r + d);
      this.emit('move', from, [this.p.x, this.p.y]);
      return;
    } else a = Math.atan2(this.p.y - tg.y, this.p.x - tg.x);   // 'to': rush in on the side you're on
    const d = tg.r + 1.1;
    this.p.x = tg.x + Math.cos(a) * d;
    this.p.y = tg.y + Math.sin(a) * d;
    this.p.goal = null;
    this.emit('move', from, [this.p.x, this.p.y]);
  };

  // --- using skills -------------------------------------------------------------------------------

  Sim.prototype.cdOf = function (s) {
    const base = typeof s.cd === 'object' ? A2.lv(s.cd, s.level) : (s.cd || 0);
    const cd = Math.max(0, (base + (s.mods.cd || 0)) * (1 + (s.mods.cdPct || 0) / 100));
    return cd * (1 - A2.clamp(this.stat('cdr'), 0, 60) / 100);
  };
  Sim.prototype.mpCost = function (s) {
    let mp = s.mp || 0;
    if (s.mods.mpPct) mp *= 1 + s.mods.mpPct / 100;
    if (this.cls.mpHook) mp = this.cls.mpHook(this, s, mp);
    return Math.round(mp);
  };
  Sim.prototype.cdLeft = function (id) { return Math.max(0, (this.p.cds[id] || 0) - this.t); };

  /** {ok, why, ready}: whether the skill can go now. `ready` is true for skills a proc or condition just lit. */
  Sim.prototype.check = function (id) {
    const s = this.skills[id];
    if (!s) return {ok: false, why: 'unknown'};
    if (!s.equipped) return {ok: false, why: 'Not equipped'};
    if (this.done) return {ok: false, why: 'The parse is over. Press Reset.'};
    const u = this.p.uses[id];
    const chained = u && u.left > 0 && u.until > this.t;
    if (!chained && this.cdLeft(id) > 0) return {ok: false, why: 'Not ready yet', cd: true};
    if (this.p.mp < this.mpCost(s)) return {ok: false, why: 'Not enough MP', mp: true};
    if (s.needs && !s.when) s.when = gate;
    if (s.when) {
      const w = s.when(this, s);
      if (w !== true) return {ok: false, why: w || 'Can\'t use that now', cond: true};
    }
    const range = (s.range || 4) + (s.mods.range || 0);
    if (this.dist() > range + 0.25) return {ok: false, why: 'Target is too far away', range: true};
    return {ok: true, ready: !!s.when};
  };

  const STATUS = {knockdown: 'Knocked down', stun: 'Stunned', airborne: 'Airborne', stagger: 'Staggered', frost: 'Frozen',
                  root: 'Rooted', slow: 'Slowed', blind: 'Blinded', fireMark: 'under Fire Mark', chain: 'bound by Chain of Torment'};
  /** `needs: 'knockdown'`: usable on a target with that status; against a status-immune boss only when
   * `immuneProc` (the skill's "N% chance to trigger when attacking a target with Incapacitated Immunity") lit it. */
  function gate(sim, s) {
    const need = [].concat(s.needs);
    if (need.some((n) => sim.hasStatus(n))) return true;
    if (sim.procOn(s.procId || s.id)) return true;
    if (sim.immune() && s.immuneProc) return `Lights up on a ${Math.round(s.immuneProc * 100)}% chance when you hit a boss`;
    return `The target must be ${need.map((n) => STATUS[n] || n).join(' or ')}`;
  }
  Sim.prototype.immune = function () { return this.cfg.dummy.kind !== 'field'; };
  /** Statuses: crowd control only sticks to a field monster; a boss is "Staggered" while its gauge is broken. */
  Sim.prototype.hasStatus = function (n) {
    if (n === 'stagger') return this.t < this.tg.brokenUntil || !!this.debuffOn('stagger');
    return !!this.debuffOn(n);
  };
  const CC = {knockdown: 'Knockdown', stun: 'Stun', airborne: 'Airborne', frost: 'Frost', root: 'Root', fear: 'Fear', seal: 'Seal'};
  Sim.prototype.inflict = function (n, dur) {
    if (CC[n] && this.immune()) return false;
    this.debuff(n, dur, {name: CC[n] || n, short: CC[n] || n, icon: n === 'root' ? 'chain' : n === 'frost' ? 'ice' : 'bolt', hue: 50});
    return true;
  };

  /** A skill's own buff (from its tooltip: "Increases the caster's Attack by 20% for 10s", or a named effect it grants). */
  Sim.prototype.grant = function (s) {
    const b = s.buff;
    const dur = typeof b.dur === 'object' ? A2.lv(b.dur, s.level) : b.dur;
    const stat = Object.assign({}, b.stat);
    const atkPct = stat.atkPct || 0;
    delete stat.atkPct;
    const keep = this.buffOn(s.id);
    const nb = this.buff(s.id, dur, {name: b.name || s.name, short: b.short || b.name || s.name, icon: s.icon, hue: s.hue, stat, atkPct});
    if (b.stacks) nb.stacks = Math.min(b.stacks, (keep ? keep.stacks : 0) + 1), nb.mult = nb.stacks;
    return nb;
  };
  /** Damage over time from the skill's tooltip; a new application refreshes it. */
  Sim.prototype.applyDot = function (s) {
    const d0 = s.dot;
    let base = typeof d0.base === 'object' ? A2.lv(d0.base, s.level) : d0.base;
    // a tick with only its Lv 1 number grows with the skill's own hit
    if (d0.scale && s.dmg) base *= A2.lv(s.dmg, s.level, s.kind) / A2.lv(s.dmg, 1, s.kind);
    const dur = (typeof d0.dur === 'object' ? A2.lv(d0.dur, s.level) : (d0.dur || 10)) + (s.mods.dotDur || 0);
    const every = (d0.every || 1) * (s.mods.dotEvery || 1);
    const d = this.debuff('dot:' + s.id, dur, {name: d0.name, short: d0.name, icon: s.icon, hue: s.hue});
    if (d.nextTick == null || d.nextTick > this.t + every) d.nextTick = this.t + every;
    d.every = every;
    const row = {id: 'dot:' + s.id, name: `${s.name} (${d0.name})`, hue: s.hue, icon: s.icon, mods: {}};
    // the tooltip's number is the whole effect, split across its ticks (or per tick, if the player picks that reading)
    const split = this.cfg.dummy.dotMode === 'tick' ? 1 : Math.max(1, Math.round((d0.dur || 10) / (d0.every || 1)));
    d.tick = (sim) => sim.hit(row, {base: base / split, atk: d0.atk / split, dot: true, as: row.id, asName: row.name, pct: s.mods.dotPct || 0});
    return d;
  };
  /** An orb, aura or spirit that attacks on its own for a while: {every, chance, dur, base, atk}. */
  Sim.prototype.summon = function (s) {
    const o = s.orb;
    const dur = typeof o.dur === 'object' ? A2.lv(o.dur, s.level) : o.dur;
    const base = typeof o.base === 'object' ? A2.lv(o.base, s.level) : (o.base * (s.dmg ? A2.lv(s.dmg, s.level, s.kind) / A2.lv(s.dmg, 1, s.kind) : 1));
    const b = this.buff('orb:' + s.id, dur + (s.mods.orbDur || 0), {name: o.name || s.name, short: o.name || s.name, icon: s.icon, hue: s.hue});
    b.next = this.t + o.every;
    b.orb = {every: o.every / (s.mods.orbSpeed || 1), chance: Math.min(1, o.chance * (1 + (s.mods.orbChance || 0) / 100)),
             base, atk: o.atk, row: {id: 'orb:' + s.id, name: o.name || s.name, hue: s.hue, icon: s.icon, mods: {crit: s.mods.orbCrit}}};
  };

  Sim.prototype.press = function (id) {
    if (!this.skills[id]) return false;
    const locked = this.p.lockUntil > this.t || this.p.castUntil > this.t;
    if (locked) {
      const left = Math.max(this.p.lockUntil, this.p.castUntil) - this.t;
      if (left <= QUEUE) { this.p.queue = id; return true; }
      return false;
    }
    return this.use(id);
  };

  Sim.prototype.use = function (id) {
    const s = this.skills[id];
    const ok = this.check(id);
    if (!ok.ok) { this.emit('refuse', s, ok.why); return false; }
    const p = this.p;
    if (!s.moving && !s.mods.mobile) { p.goal = null; p.dir = [0, 0]; }
    p.mp = Math.max(0, p.mp - this.mpCost(s));
    // Consecutive uses: the cooldown starts after the last one (or when the window to use them runs out).
    const extra = (s.uses || 0) + (s.mods.uses || 0);
    const u = p.uses[id];
    if (extra > 0) {
      if (u && u.left > 0 && u.until > this.t) {
        u.left--;
        u.until = this.t + 4;
        if (u.left <= 0) p.cds[id] = this.t + this.cdOf(s);
      } else {
        p.uses[id] = {left: extra, until: this.t + 4};
        p.cds[id] = this.t + this.cdOf(s);  // a skipped follow-up still leaves the skill on cooldown
      }
    } else {
      p.cds[id] = this.t + this.cdOf(s);
    }
    if (s.when && s.consume !== false) delete p.procs[s.procId || id];
    const speed = 1 + this.stat('combatSpeed') / 100 + (s.mods.skillSpeed || 0) / 100;
    const anim = (s.anim == null ? 0.8 : s.anim) / speed;
    const castBase = s.cast || (s.charge ? (s.chargeTime || 1.2) : 0);
    const cast = castBase ? castBase / (s.charge ? 1 : 1 + this.stat('castSpeed') / 100) : 0;
    if (cast > 0) {
      p.casting = {id, start: this.t, end: this.t + cast};
      p.castUntil = this.t + cast;
      p.lockUntil = this.t + cast + anim * 0.35;
      p.lockLen = p.lockUntil - this.t;
    } else {
      p.lockUntil = this.t + anim;
      p.lockLen = anim;
      this.fire(s);
    }
    this.emit('use', s);
    return true;
  };

  /** The skill goes off: movement, then its hits (which land a beat after the swing starts). */
  Sim.prototype.fire = function (s) {
    const contact = s.contact == null ? 0.12 : s.contact;
    if (s.move && !s.moveAfter) this.placeAt(s.move);
    if (s.move && s.moveAfter) this.pending.push({at: this.t + contact + 0.05, s: {onLand: (sim) => sim.placeAt(s.move)}, i: 0});
    if (s.buff && s.noHit) this.grant(s);
    if (s.lights) for (const id in s.lights) if (this.has(id)) this.proc(id, s.lights[id]);
    if (s.orb) this.summon(s);
    if (s.onUse) s.onUse(this, s);
    if (this.cls.onUse) this.cls.onUse(this, s);
    if (!s.noHit) {
      const hits = (s.hits || 1) + (s.mods.hitsPlus || 0);
      for (let i = 0; i < hits; i++) this.pending.push({at: this.t + contact + i * 0.12, s, i});
    }
  };

  // --- damage -----------------------------------------------------------------------------------

  /** Base and %Attack of a skill at its level; a skill's own `power(sim, s)` can change them (stacks and so on). */
  Sim.prototype.power = function (s) {
    let base = A2.lv(s.dmg, s.level, s.kind);
    let atk = s.atk || 0;
    if (s.charge) { base *= s.charge.mult; atk = s.charge.atkMax; }
    if (s.power) { const r = s.power(this, s, base, atk); base = r[0]; atk = r[1]; }
    return [base, atk];
  };

  /**
   * One hit. `o`: {base, atk} to override the skill's numbers, `pct` extra damage %, `crit` force a critical,
   * `noCrit`, `dot` (a damage-over-time tick: no Multi-Hit, no back attack), `proc` (from a passive).
   */
  Sim.prototype.hit = function (s, o) {
    o = o || {};
    if (this.done) return null;
    if (this.startedAt == null) this.startedAt = this.t;
    let [base, atk] = o.base != null ? [o.base, o.atk || 0] : this.power(s);
    const attack = this.stat('attack');
    let dmg = base + attack * atk / 100;
    let mult = 1 + (this.stat('dmgBoost') + this.stat('pveBoost') + (o.pct || 0) + (s.mods && s.mods.dmgPct || 0)) / 100;
    if (o.mult) mult *= o.mult;
    const back = !o.dot && this.isBack();
    if (back) {
      mult *= 1 + this.stat('backBoost') / 100;
      if (s.backPct) mult *= 1 + s.backPct / 100;
    }
    // damage over time: no crit, no Double, no Multi-Hit, no back attack (Taiwanese tests)
    const crit = !o.noCrit && !o.dot && (o.crit || (s.mods && s.mods.crit) ||
                 this.rand() < this.critChance(s.critBonus || 0, (s.mods && s.mods.critPct) || 0));
    if (crit) mult *= FORMULA.critBase + (this.stat('critDmg') + (o.critDmg || 0)) / 100;
    if (s.mods && s.mods.immuneDmg && this.immune()) mult *= 1 + s.mods.immuneDmg / 100;
    let red = A2.clamp(this.cfg.dummy.reduction || 0, 0, 90), vuln = 0, defDown = 0;
    for (const id in this.tg.debuffs) {
      const d = this.tg.debuffs[id];
      if (d.until <= this.t) continue;
      if (d.vuln) vuln += d.vuln;
      if (d.def) defDown = Math.max(defDown, d.def);
    }
    // lowered damage tolerance joins the damage-boost bucket; Defense cuts read as less damage reduction
    mult *= (1 - red * (1 - Math.min(defDown, 100) / 100) / 100) * (1 + vuln / 100 / Math.max(1, mult));
    if (!back && this.stat('frontBoost')) mult *= 1 + this.stat('frontBoost') / 100;
    if (this.cls.damageHook) mult = this.cls.damageHook(this, s, mult, o);
    mult *= 1 + (this.rand() * 2 - 1) * FORMULA.variance;
    let amt = dmg * mult;
    // Double: x2 in PvE. Multi-Hit: up to 4 extra strikes of 10% each (the first sure, each next one 50%).
    let dbl = false, multi = 0;
    if (!o.dot) {
      if (this.rand() < this.stat('double') / 100) { dbl = true; amt *= FORMULA.doubleMult; }
      if (!o.proc && !o.noMulti && this.rand() < (this.stat('multiHit') + (s.mods && s.mods.multi || 0)) / 100) {
        multi = 1;
        while (multi < 4 && this.rand() < 0.5) multi++;
        amt *= 1 + multi * FORMULA.multiHitDmg;
      }
    }
    amt = Math.max(1, Math.round(amt));
    this.record(s, amt, crit, back, multi, o, dbl);
    const ev = {s, amt, crit, back, dbl, multi, dot: !!o.dot, proc: !!o.proc, hue: s.hue};
    this.tg.flash = 1;
    this.emit('damage', ev);
    // stagger
    const stg = (s.stagger || 0) + (s.mods && s.mods.stagger || 0);
    if (stg && this.t >= this.tg.brokenUntil && !this.tg.noStagger) {
      this.tg.stg += stg;
      if (this.tg.stg >= (this.cfg.dummy.stagger === 'party' ? 100 : FORMULA.staggerMax)) {
        this.tg.stg = 0;
        this.tg.brokenUntil = this.t + FORMULA.breakTime;
        this.emit('text', 'Stagger break!', '#ffe9a8');
        if (this.cls.onBreak) this.cls.onBreak(this);
      }
    }
    // generic on-hit effects of the skill itself (not its proc or tick copies)
    if (!o.proc && !o.dot && s.mods) {
      const m = s.mods, p = this.p;
      const first = !o.hitIndex;
      if (first && s.mpGain) p.mp = Math.min(this.stats.mpMax, p.mp + s.mpGain * (1 + (m.mpGainPct || 0) / 100));
      if (first && m.mpOnHit) p.mp = Math.min(this.stats.mpMax, p.mp + m.mpOnHit);
      if (crit && m.mpOnCrit) p.mp = Math.min(this.stats.mpMax, p.mp + m.mpOnCrit);
      if (crit && m.resetOnCrit) p.cds[s.id] = this.t;
      if (first && m.cutOnHit && p.cds[m.cutOnHit.id]) p.cds[m.cutOnHit.id] -= m.cutOnHit.s;
      if (first && m.cutAllOnHit) for (const id in p.cds) if (id !== s.id) p.cds[id] -= m.cutAllOnHit;
      if (first && s.inflicts) for (const n in s.inflicts) this.inflict(n, s.inflicts[n]);
      if (first && s.buff && !s.noHit) this.grant(s);
      if (first && s.dot) this.applyDot(s);
      // skills that light on a small chance against a status-immune boss
      if (this.immune()) {
        for (const id in this.skills) {
          const k = this.skills[id];
          if (k.immuneProc && k.equipped && id !== s.id && this.rand() < k.immuneProc) this.proc(k.procId || id, k.procWindow || 6);
        }
      }
    }
    if (s.onHit) s.onHit(this, ev, o);
    if (this.cls.onHit) this.cls.onHit(this, ev, o);
    return ev;
  };

  Sim.prototype.record = function (s, amt, crit, back, multi, o, dbl) {
    if (this.done) return;
    const key = o.as || s.meterId || s.id;
    const row = this.bySkill[key] || (this.bySkill[key] = {id: key, name: o.asName || s.meterName || s.name, dmg: 0, hits: 0, crits: 0, backs: 0, multis: 0, dbls: 0, ticks: 0, hue: s.hue, icon: s.icon});
    row.dmg += amt;
    row.hits++;
    if (o.dot) row.ticks++;
    if (crit) row.crits++;
    if (back) row.backs++;
    if (multi) row.multis++;
    if (dbl) row.dbls++;
    this.total += amt;
    this.log.push({t: this.t, id: key, amt, crit});
  };

  Sim.prototype.elapsed = function () {
    return this.startedAt == null ? 0 : this.t - this.startedAt;
  };
  Sim.prototype.dps = function () {
    const e = this.elapsed();
    return e > 0.5 ? this.total / e : 0;
  };

  // --- the clock ------------------------------------------------------------------------------

  Sim.prototype.step = function (dt) {
    const p = this.p;
    this.t += dt;
    const len = this.cfg.parseLen;
    if (len && this.startedAt != null && !this.done && this.t - this.startedAt >= len) {
      this.t = this.startedAt + len;
      this.done = true;
      this.emit('done');
    }
    // the dummy's HP follows the parse clock, as a boss's would in a group: 100% at the pull, 0% at the end
    const e = this.elapsed();
    const frac = this.cfg.dummy.hpMode === 'fixed' || !len ? 1 : Math.max(0.01, 1 - e / len);
    this.tg.hpMax = 1;
    this.tg.hp = frac;
    // hits waiting for their contact frame
    if (this.pending.length) {
      const due = this.pending.filter((h) => h.at <= this.t);
      if (due.length) {
        this.pending = this.pending.filter((h) => h.at > this.t);
        for (const h of due) {
          if (h.s.onLand) h.s.onLand(this, h.s, h.i); else this.hit(h.s, {hitIndex: h.i});
        }
      }
    }
    // a cast finishing
    if (p.casting && this.t >= p.casting.end) {
      const s = this.skills[p.casting.id];
      p.casting = null;
      this.fire(s);
    }
    if (p.casting && p.moving && !this.skills[p.casting.id].moving) {
      p.casting = null; p.castUntil = 0; p.lockUntil = this.t;
      this.emit('text', 'Interrupted', '#ff7272');
    }
    // the queued skill goes as soon as the animation ends
    if (p.queue && this.t >= p.lockUntil && this.t >= p.castUntil) {
      const q = p.queue;
      p.queue = null;
      this.use(q);
    }
    // ticks (poison and other damage over time)
    for (const id in this.tg.debuffs) {
      const d = this.tg.debuffs[id];
      if (d.tick && d.until > this.t - 1e-9) {
        while (d.nextTick != null && d.nextTick <= this.t && d.nextTick <= d.until + 1e-6) {
          d.tick(this, d);
          d.nextTick += d.every || 1;
        }
      }
    }
    for (const id in p.buffs) {
      const b = p.buffs[id];
      while (b.orb && b.until > this.t && b.next <= this.t) {
        b.next += b.orb.every;
        if (this.rand() < b.orb.chance) this.hit(b.orb.row, {base: b.orb.base, atk: b.orb.atk, proc: true, as: b.orb.row.id, asName: b.orb.row.name, crit: b.orb.row.mods.crit});
      }
    }
    if (this.cls.onStep) this.cls.onStep(this, dt);
    p.speedBuff = this.stat('combatSpeed') > (this.stats.combatSpeed || 0) + 0.1;
    // movement (blocked while a skill that roots you animates)
    const rooted = this.t < p.lockUntil && p.lastSkill && !p.lastSkill.moving;
    let mx = p.dir[0], my = p.dir[1];
    if (!mx && !my && p.goal) {
      const dx = p.goal[0] - p.x, dy = p.goal[1] - p.y, d = Math.hypot(dx, dy);
      if (d < 0.08) p.goal = null; else { mx = dx / d; my = dy / d; }
    }
    p.moving = !!(mx || my) && !rooted;
    if (p.moving) {
      const n = Math.hypot(mx, my);
      const sp = MOVE_SPEED * dt * (this.stat('moveSpeed') ? 1 + this.stat('moveSpeed') / 100 : 1);
      let nx = p.x + mx / n * sp, ny = p.y + my / n * sp;
      // don't walk through the dummy
      const dx = nx - this.tg.x, dy = ny - this.tg.y, d = Math.hypot(dx, dy);
      if (d < this.tg.r + 0.45) { nx = this.tg.x + dx / d * (this.tg.r + 0.45); ny = this.tg.y + dy / d * (this.tg.r + 0.45); }
      const r = Math.hypot(nx, ny);
      if (r > 14) { nx *= 14 / r; ny *= 14 / r; }
      p.x = nx; p.y = ny;
    }
  };

  // remember which skill animates, for the root check above
  const baseUse = Sim.prototype.use;
  Sim.prototype.use = function (id) {
    const ok = baseUse.call(this, id);
    if (ok) this.p.lastSkill = this.skills[id].moving || this.skills[id].mods.mobile ? {moving: true} : {moving: false};
    return ok;
  };

  /** A whole parse with the class's own rotation, off-screen. Returns {dps, total, bySkill, seconds}. */
  A2.runParse = function (cls, cfg) {
    const sim = new Sim(cls, Object.assign({}, cfg, {seed: cfg.seed == null ? 12345 : cfg.seed}));
    const len = cfg.parseLen || 180;
    const dt = 1 / 60;
    let guard = 0;
    while (!sim.done && guard++ < (len + 30) * 60) {
      A2.botStep(sim);
      sim.step(dt);
    }
    return {dps: sim.dps(), total: sim.total, bySkill: sim.bySkill, seconds: sim.elapsed(), sim};
  };

  /** One tick of the class's rotation: walk to where it wants to stand, press the next skill. */
  A2.botStep = function (sim) {
    const cls = sim.cls;
    const p = sim.p;
    // stand behind the dummy if the class wants back attacks, else in front, inside melee or casting range
    const want = cls.botRange || 3;
    const behind = cls.botBehind;
    const tg = sim.tg;
    const a = behind ? tg.face + Math.PI : tg.face;
    const stand = cls.botStand || Math.min(want, 2.2);
    const gx = tg.x + Math.cos(a) * (tg.r + stand), gy = tg.y + Math.sin(a) * (tg.r + stand);
    const needMove = (behind && !sim.isBack()) || sim.dist() > want;
    if (needMove && sim.t >= p.lockUntil) p.goal = [gx, gy]; else if (!needMove) p.goal = null;
    if (p.queue || sim.done) return;
    const left = Math.max(p.lockUntil, p.castUntil) - sim.t;
    if (left > 0.05) return;
    const order = cls.rotation(sim);
    for (const id of order) {
      if (!id) continue;
      if (sim.check(id).ok) { sim.press(id); return; }
    }
  };
})();
