// Wires the engine, scene, sound and HUD together: input, keybinds, drag and
// drop, countdown, chat commands, parse tracking and the frame loop.
(function (B) {
  const A = B.ACTIONS;
  const STORE_KEY = 'blm-ew-sim.v1';
  const DUMMY_HP = 25000000;
  const BACKPEDAL = 0.4;      // backpedalling is a walk: 2.4 yalms a second against a 6 yalm run
  const MOVE_KEYS = { KeyW: 'f', ArrowUp: 'f', KeyS: 'b', ArrowDown: 'b', KeyA: 'l', ArrowLeft: 'l', KeyD: 'r', ArrowRight: 'r' };
  const RESERVED = new Set(['KeyW', 'KeyA', 'KeyS', 'KeyD', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space', 'Enter', 'Tab', 'Escape', 'F1']);
  const MOD_KEYS = new Set(['ShiftLeft', 'ShiftRight', 'ControlLeft', 'ControlRight', 'AltLeft', 'AltRight', 'MetaLeft', 'MetaRight']);
  const fmt = (n) => Math.round(n).toLocaleString('en-US');

  const okGrid = (g, ok) => Array.isArray(g) && g.length === 3 && g.every(r => Array.isArray(r) && r.length === 12 && r.every(ok));

  // Hotbars are saved per job version (like the game saves them per job); keybinds are shared.
  function loadStore() {
    const store = {
      settings: Object.assign({}, B.DEFAULT_SETTINGS, { versions: {}, speed: {} }),
      barsByJob: {},
      binds: B.DEFAULT_BINDS.map(r => r.slice()),
    };
    let saved = null;
    try { saved = JSON.parse(localStorage.getItem(STORE_KEY) || 'null'); } catch (e) { saved = null; }
    if (saved && typeof saved === 'object') {
      const s = saved.settings || {};
      for (const k of Object.keys(B.DEFAULT_SETTINGS)) {
        if (k in s && typeof s[k] === typeof B.DEFAULT_SETTINGS[k]) store.settings[k] = s[k];
      }
      if (typeof s.sps === 'number' && !store.settings.speed.blm) store.settings.speed.blm = s.sps;   // from 1.2.x
      if (saved.barsByJob && typeof saved.barsByJob === 'object') store.barsByJob = saved.barsByJob;
      else if (saved.bars) store.barsByJob['blm:ew65'] = saved.bars;                                  // from 1.x
      if (okGrid(saved.binds, v => v === null || typeof v === 'string')) store.binds = saved.binds;
      if (saved.barsSeen && typeof saved.barsSeen === 'object') store.barsSeen = saved.barsSeen;
    }
    if (!B.JOBS[store.settings.job]) store.settings.job = B.JOB_ORDER[0];
    return store;
  }

  class Encounter {
    constructor(n, start, preUses) {
      this.n = n; this.start = start; this.end = null;
      this.actions = Object.assign({}, B.ACTIONS);    // this pull's job, for its results later
      this.job = B.job ? `${B.job.abbr} · ${B.job.versionLabel}` : '';
      this.jobId = B.jobId; this.abbr = B.job ? B.job.abbr : '';
      this.total = 0; this.hits = 0; this.crits = 0; this.dhs = 0; this.maxHit = null;
      this.byAction = {};
      this.uses = preUses || [];
      this.lastDamage = start;
      this.lastActivity = start;
    }
    addHit(ev) {
      this.total += ev.amount; this.hits++;
      if (ev.crit) this.crits++;
      if (ev.dh) this.dhs++;
      const r = this.byAction[ev.id] || (this.byAction[ev.id] = { total: 0, hits: 0, crits: 0, dhs: 0, max: 0, dotHits: 0 });
      r.total += ev.amount; r.hits++;
      if (ev.crit) r.crits++;
      if (ev.dh) r.dhs++;
      if (ev.dot) r.dotHits++;
      r.max = Math.max(r.max, ev.amount);
      if (!this.maxHit || ev.amount > this.maxHit.amount) this.maxHit = { id: ev.id, amount: ev.amount, crit: ev.crit, dh: ev.dh };
      this.lastDamage = ev.t;
      if (!ev.dot) this.lastActivity = ev.t;
    }
    duration(now) {
      const end = this.end !== null ? this.end : now;
      return Math.max(1, end - this.start);
    }
    // Share of the fight spent casting or with the GCD rolling.
    uptime(now) {
      const end = this.end !== null ? this.end : now;
      const iv = this.uses.filter(u => (this.actions[u.id] || {}).kind === 'gcd').map(u => {
        const len = u.interrupted ? u.cut : Math.max(u.recast, u.cast ? u.cast + (u.tax || B.CASTER_TAX) : 0);
        return [Math.max(this.start, u.t), Math.min(end, u.t + len)];
      }).filter(([a, b]) => b > a).sort((a, b) => a[0] - b[0]);
      let busy = 0, cs = null, ce = null;
      for (const [a, b] of iv) {
        if (cs === null) { cs = a; ce = b; }
        else if (a <= ce) ce = Math.max(ce, b);
        else { busy += ce - cs; cs = a; ce = b; }
      }
      if (cs !== null) busy += ce - cs;
      return Math.min(100, busy / Math.max(1, end - this.start) * 100);
    }
  }

  class Drag {
    constructor(app) { this.app = app; this.active = false; this.onMove = this.move.bind(this); this.onUp = this.up.bind(this); }
    begin(ev, src) {
      if (this.app.keybindMode) return;
      this.src = src; this.sx = ev.clientX; this.sy = ev.clientY; this.active = false;
      window.addEventListener('pointermove', this.onMove);
      window.addEventListener('pointerup', this.onUp);
    }
    move(ev) {
      const g = document.getElementById('ghost');
      if (!this.active) {
        if (!this.src.id || Math.hypot(ev.clientX - this.sx, ev.clientY - this.sy) < 7) return;
        this.active = true;
        g.src = B.icon(this.src.id);
        g.classList.add('show');
        this.app.ui.hideTip();
      }
      g.style.left = (ev.clientX - 24) + 'px'; g.style.top = (ev.clientY - 24) + 'px';
      const s = this.app.ui.slotAt(ev.clientX, ev.clientY);
      if (this.over && this.over !== s) this.over.el.classList.remove('droptarget');
      this.over = s;
      if (s) s.el.classList.add('droptarget');
    }
    up(ev) {
      window.removeEventListener('pointermove', this.onMove);
      window.removeEventListener('pointerup', this.onUp);
      const app = this.app, src = this.src;
      if (!this.active) {
        if (src.from === 'slot') app.useSlot(src.b, src.i);
        return;
      }
      this.active = false;
      document.getElementById('ghost').classList.remove('show');
      if (this.over) this.over.el.classList.remove('droptarget');
      const s = app.ui.slotAt(ev.clientX, ev.clientY);
      const bars = app.bars();
      if (s) {
        if (src.from === 'slot') {
          const prev = bars[s.b][s.i];
          bars[s.b][s.i] = src.id;
          bars[src.b][src.i] = prev;
        } else {
          bars[s.b][s.i] = src.id;
        }
      } else if (src.from === 'slot') {
        bars[src.b][src.i] = null;
      }
      app.save();
      app.ui.refreshBars();
    }
  }

  const app = {
    history: [],
    enc: null,
    lastEnc: null,
    recentUses: [],
    keybindMode: false,
    held: new Set(),
    mouse: { left: false, right: false, x: 0, y: 0, moved: 0 },
    cd: null,
    cdEndedAt: null,
    noNewUntil: 0,

    init() {
      this.store = loadStore();
      const st = this.store.settings;
      this.job = B.setJob(st.job, st.versions[st.job]);
      this.engine = new B.Engine(st, this.job);
      this.engine.pos.z = -this.job.startDistance;
      this.sfx = new B.Sfx();
      this.sfx.setVolume(this.store.settings.volume);
      this.scene = new B.Scene(document.getElementById('scene'), this.engine, document.getElementById('fx'));
      this.models = new B.ModelLayer(document.getElementById('models'), this.engine, this.scene, this.store.settings);
      this.scene.models = this.models;
      this.drag = new Drag(this);
      this.ui = new B.UI(this);
      this.ui.setJob();
      this.wireEngine();
      this.wireInput();
      this.layout();
      window.addEventListener('resize', () => this.layout());
      this.ui.log(`Welcome to the training ground. You're a ${this.job.name} (${this.job.versionLabel}). Press J to change job or version, F1 for controls and the rotation.`, 'sys', 'system');
      this.ui.log('Tip: /countdown 15 starts a pull. The parse meter starts on your first hit.', 'dim', 'system');
      this.last = performance.now();
      requestAnimationFrame(t => this.frame(t));
    },

    save() {
      try { localStorage.setItem(STORE_KEY, JSON.stringify(this.store)); } catch (e) { /* private mode */ }
    },

    applySettings() {
      this.sfx.setVolume(this.store.settings.volume);
      this.models.setEnabled();
      this.ui.updateMeter(true);
    },

    jobKey() { return this.job.id + ':' + this.job.version; },

    // This job version's hotbars, from its defaults the first time (or if a saved slot names an unknown action).
    bars() {
      const key = this.jobKey();
      const have = this.store.barsByJob[key];
      if (!okGrid(have, v => v === null || !!A[v])) this.store.barsByJob[key] = this.job.defaultBars.map(r => r.slice());
      const bars = this.store.barsByJob[key];
      const seen = (this.store.barsSeen = this.store.barsSeen || {})[key] = this.store.barsSeen[key] || [];
      if (!seen.length) bars.forEach(r => r.forEach(v => { if (v) seen.push(v); }));
      const placed = new Set(bars.flat());
      this.job.defaultBars.forEach((r, b) => r.forEach((id, i) => {
        if (!id || seen.includes(id)) return;
        seen.push(id);
        if (!placed.has(id) && bars[b][i] === null) bars[b][i] = id;
      }));
      return bars;
    },

    // Change job or version: a fresh engine state, the job's hotbars, gauge, help and model.
    switchJob(jobId, versionId) {
      const st = this.store.settings;
      st.job = jobId;
      if (versionId) st.versions[jobId] = versionId;
      this.save();
      this.enc = null;
      this.job = B.setJob(jobId, st.versions[jobId]);
      this.engine.setJob(this.job);
      this.engine.pos.x = 0; this.engine.pos.z = -this.job.startDistance;
      this.scene.resetCamera();
      this.cd = null; this.cdEndedAt = null; this.recentUses = [];
      this.ui.setJob();
      this.models.setJob();
      this.ui.log(`You change to ${this.job.name} (${this.job.versionLabel}).`, 'sys', 'system');
    },

    resetLayout() {
      this.store.barsByJob[this.jobKey()] = this.job.defaultBars.map(r => r.slice());
      this.store.binds = B.DEFAULT_BINDS.map(r => r.slice());
      this.save();
      this.ui.refreshBars();
      this.ui.log('Hotbars and keybinds restored to default.', 'dim', 'system');
    },

    layout() {
      const W = window.innerWidth, H = window.innerHeight;
      const s = Math.min(W / 1920, H / 1080);
      this.hudS = s; this.hudX = (W - 1920 * s) / 2; this.hudY = (H - 1080 * s) / 2;
      document.getElementById('hud').style.transform = `translate(${this.hudX}px, ${this.hudY}px) scale(${s})`;
      this.scene.resize();
    },
    screenToHud(x, y) { return { x: (x - this.hudX) / this.hudS, y: (y - this.hudY) / this.hudS }; },
    toHud(r) { return { x: (r.left - this.hudX) / this.hudS, y: (r.top - this.hudY) / this.hudS, w: r.width / this.hudS, h: r.height / this.hudS }; },

    // Rough single-target dummy benchmark for the chosen GCD (no raid buffs).
    referenceDps() {
      // Each GCD (hardcast or weaponskill plus its lock) gets stretched by about the ping.
      const j = this.job, cycle = 2.65 + B.CASTER_TAX;
      return j.referenceDps * (j.referenceGcd / this.engine.gcdRecast()) ** 0.85 * cycle / (cycle + this.engine.latency(true));
    },
    parseColor(dps) {
      const k = dps / this.referenceDps();
      let c = B.PARSE_BANDS[0].color;
      for (const b of B.PARSE_BANDS) if (k >= b.min) c = b.color;
      return c;
    },

    // ---------- engine events ----------
    wireEngine() {
      const e = this.engine, ui = this.ui, sc = this.scene, sfx = this.sfx;
      const name = () => this.store.settings.name;
      const dummyAt = () => sc.dummyHead();
      const mageAt = () => sc.mageHead();
      let flyN = 0;

      e.on('use', ev => {
        const a = A[ev.id];
        const u = { t: ev.t, id: ev.id, cast: ev.cast || 0, tax: ev.tax || 0, recast: a.kind === 'gcd' ? e.gcdLen : 0 };
        this.recentUses.push(u);
        this.recentUses = this.recentUses.filter(x => ev.t - x.t < 40);
        if (this.enc) { this.enc.uses.push(u); this.enc.lastActivity = ev.t; }
      });
      // Spells are cast; weaponskills are readied (a cast) and used.
      const caster = () => e.job.role === 'caster';
      e.on('castStart', ev => {
        sc.onCastStart(ev.id);
        sfx.play(caster() ? 'cast' : 'draw');
        ui.log(caster() ? `You begin casting ${A[ev.id].name}.` : `You ready ${A[ev.id].name}.`, 'act');
      });
      e.on('resolve', ev => {
        const a = A[ev.id];
        sc.onRelease(ev.id);
        if (a.kind === 'gcd') ui.log(caster() ? `You cast ${a.name}.` : `You use ${a.name}.`, 'act');
        else if (a.kind === 'item') ui.log(`You use a ${a.name}.`, 'act');
        else ui.log(`You use ${a.name}.`, 'act');
        if (a.kind !== 'gcd') sfx.play(ev.id === 'manafont' ? 'manafont' : 'ogcd');
      });
      e.on('interrupt', ev => {
        ui.castInterrupted(ev.id, ev.reason);
        sfx.play('interrupt');
        ui.log(ev.reason === 'Interrupted' ? `${A[ev.id].name} is interrupted.` : `${A[ev.id].name} fails: ${ev.reason}`, 'lose');
        const u = [...this.recentUses].reverse().find(x => x.id === ev.id && A[x.id].kind === 'gcd');
        if (u) { u.interrupted = true; u.cut = e.now - u.t; }
      });
      e.on('error', ev => { ui.error(ev.msg); sfx.play('error'); });
      e.on('hit', ev => {
        // Count it for the parse.
        if (!this.enc && e.now >= this.noNewUntil) this.startEncounter(ev.t);
        if (this.enc) {
          const lim = this.store.settings.pullLength;
          if (!lim || ev.t <= this.enc.start + lim) this.enc.addHit(ev);
        }
        const a = A[ev.id];
        const tag = ev.crit && ev.dh ? 'Critical Direct Hit!' : ev.crit ? 'Critical!' : ev.dh ? 'Direct Hit!' : '';
        const n = fmt(ev.amount) + (ev.crit ? '!' : '') + (ev.dh ? '!' : '');
        // Another dummy in the pack: just its number over its head.
        if (ev.extra) {
          ui.fly({ at: sc.dummyHead(ev.extra), text: n, cls: 'extra ' + (ev.crit ? 'crit ' : '') + (ev.dot ? 'dot' : ''), dy: ev.dot ? 30 : 0 });
          sc.onExtraHit(ev);
          return;
        }
        flyN = (flyN + 1) % 5;
        ui.fly({
          at: dummyAt(), text: n, tag, cls: (ev.crit ? 'crit ' : '') + (ev.dh ? 'dh ' : '') + (ev.dot ? 'dot' : ''),
          icon: ev.dot ? null : B.icon(ev.id), label: ev.dot ? '' : a.name,
          dx: (flyN - 2) * 26 + (ev.dot ? 70 : 0), dy: ev.dot ? 30 : 0,
        });
        const lead = ev.dot ? '' : '⇒ ';
        const what = ev.crit && ev.dh ? 'Critical direct hit! ' : ev.crit ? 'Critical! ' : ev.dh ? 'Direct hit! ' : '';
        ui.log(`${lead}${what}The striking dummy takes ${fmt(ev.amount)} damage.`, 'dmg');
        sc.onHit(ev);
        if (ev.dot) sfx.play('dot');
        else {
          const snd = a.sound || a.fx || { fire: 'fire', fire3: 'fire', fire4: 'fire4', despair: 'despair', blizzard: 'ice', blizzard3: 'ice', blizzard4: 'ice4', thunder3: 'thunder', xenoglossy: 'xeno', foul: 'xeno', paradox: 'paradox', scathe: 'xeno' }[a.look || ev.id];
          if (snd) sfx.play(snd);
        }
      });
      e.on('statusGain', ev => {
        const st = B.STATUSES[ev.key];
        if (!st) return;
        if (ev.self) {
          ui.log(`You gain the effect of ${st.name}.`, 'gain');
          ui.fly({ at: mageAt(), text: '+ ' + st.name, cls: 'self', icon: B.statusIcon(ev.key), dx: 80 });
        } else {
          ui.log(`The striking dummy suffers the effect of ${st.name}.`, 'gain');
        }
      });
      e.on('statusLose', ev => {
        const st = B.STATUSES[ev.key];
        if (!st) return;
        if (ev.self) ui.log(`You lose the effect of ${st.name}.`, 'lose');
        else ui.log(`The striking dummy recovers from the effect of ${st.name}.`, 'lose');
      });
      e.on('mpGain', ev => {
        if (ev.source === 'manafont') ui.fly({ at: mageAt(), text: `${fmt(ev.amount)} MP`, cls: 'mp', dx: -70 });
        else if (ev.source === 'lucid') ui.fly({ at: mageAt(), text: `${fmt(ev.amount)} MP`, cls: 'mp small', dx: -70 });
      });
      e.on('element', ev => {
        if (ev.expired) ui.log(`${ev.prev > 0 ? 'Astral Fire' : 'Umbral Ice'} wore off. Enochian lost.`, 'lose', 'system');
      });
      e.on('teleport', ev => sc.onTeleport(ev.from, ev.to));
      e.on('petUse', ev => sc.onPetUse(ev.id));
      e.on('mpTick', () => ui.flashTick());
      e.on('reset', () => { this.ui && this.ui.refreshBars && this.ui.refreshBars(); });
    },

    startEncounter(t) {
      let start = t;
      if (this.cdEndedAt !== null && t - this.cdEndedAt < 20 && this.cdEndedAt <= t) start = this.cdEndedAt;
      this.cdEndedAt = null;
      const pre = this.recentUses.filter(u => u.t >= start - 25);
      this.enc = new Encounter(this.history.length + 1, start, pre);
      this.ui.log(`Pull ${this.enc.n} started.`, 'dim', 'system');
    },

    endEncounter(endT, reason) {
      const enc = this.enc;
      if (!enc) return;
      enc.end = endT;
      this.enc = null;
      this.lastEnc = enc;
      this.history.push(enc);
      if (this.history.length > 30) this.history.shift();
      // The dummy resets out of combat.
      for (const k of Object.keys(this.engine.tStatuses)) delete this.engine.tStatuses[k];
      // A cast finishing after the buzzer still lands up to ~4s later; don't let it open a new pull.
      this.noNewUntil = this.engine.now + (reason === 'time' ? 5 : 0);
      const dur = enc.duration();
      const dps = enc.total / dur;
      const mm = Math.floor(dur / 60) + ':' + String(Math.floor(dur % 60)).padStart(2, '0');
      this.ui.log(`Pull ${enc.n} ${reason === 'time' ? 'complete' : 'ended'}: ${fmt(dps)} DPS over ${mm}.`, 'sys', 'system');
      if (reason === 'time') this.ui.count('TIME', true);
      if (dur >= 15 && !this.ui.anyWindow()) this.ui.showResults(enc);
      this.ui.updateMeter(true);
    },

    fullReset() {
      this.engine.reset();
      this.engine.pos.x = 0; this.engine.pos.z = -this.job.startDistance;
      this.scene.resetCamera();
      this.enc = null;
      this.cd = null;
      this.cdEndedAt = null;
      this.ui.refreshBars();
      this.ui.log('Cooldowns, MP and the gauge are reset.', 'sys', 'system');
      this.ui.updateMeter(true);
    },

    toggleCountdown(n) {
      const name = this.store.settings.name;
      if (this.cd && !n) {
        this.cd = null;
        this.ui.log(`Countdown canceled by ${name}.`, 'sys', 'system');
        return;
      }
      n = Math.max(1, Math.min(30, Math.round(n || this.store.settings.countdown)));
      this.cd = { end: this.engine.now + n, shown: null };
      this.ui.log(`Battle commencing in ${n} seconds! (${name})`, 'sys', 'system');
      this.sfx.ensure();
    },

    updateCountdown() {
      const c = this.cd;
      if (!c) return;
      const left = c.end - this.engine.now;
      if (left <= 0) {
        this.cd = null;
        this.cdEndedAt = c.end;
        this.ui.count('ENGAGE!', true);
        this.sfx.play('engage');
        this.ui.log('Engage!', 'sys', 'system');
        return;
      }
      const sec = Math.ceil(left);
      if (sec !== c.shown) {
        c.shown = sec;
        this.ui.count(String(sec));
        if (sec <= 5) this.sfx.play('tick');
      }
    },

    chat(text) {
      const t = text.trim();
      if (!t) return;
      const [cmd, ...rest] = t.split(/\s+/);
      const arg = rest.join(' ');
      switch (cmd.toLowerCase()) {
        case '/countdown': case '/cd': this.toggleCountdown(parseInt(arg, 10) || 0); break;
        case '/reset': this.fullReset(); break;
        case '/help': this.ui.openWindow('win-help'); break;
        case '/echo': case '/e': this.ui.log(arg, 'echo', 'system'); break;
        default:
          if (t.startsWith('/')) this.ui.log(`The command "${cmd}" does not exist.`, 'err', 'system');
          else this.ui.log(`${this.store.settings.name}: ${t}`, 'act', 'system');
      }
    },

    useSlot(b, i) {
      if (this.keybindMode) return;
      const id = this.bars()[b][i];
      if (!id) return;
      this.sfx.ensure();
      this.ui.flashSlot(b, i);
      this.engine.press(id);
    },

    toggleKeybind(on) {
      this.keybindMode = on === undefined ? !this.keybindMode : on;
      document.getElementById('b-keybind').classList.toggle('on', this.keybindMode);
      this.ui.banner(this.keybindMode ? '<b style="color:#e6c47a">Keybind mode</b> — hover a hotbar slot and press a key (Shift works as a modifier). Backspace clears it. Esc or K to finish.' : '');
      if (!this.keybindMode) document.querySelectorAll('.slot.kbhover').forEach(el => el.classList.remove('kbhover'));
    },

    combo(ev) {
      return (ev.ctrlKey ? 'Ctrl+' : '') + (ev.altKey ? 'Alt+' : '') + (ev.shiftKey ? 'Shift+' : '') + ev.code;
    },

    // ---------- input ----------
    wireInput() {
      const chatin = document.getElementById('chatin');
      chatin.addEventListener('keydown', ev => {
        ev.stopPropagation();
        if (ev.key === 'Enter') { this.chat(chatin.value); chatin.value = ''; chatin.blur(); ev.preventDefault(); }
        else if (ev.key === 'Escape') { chatin.value = ''; chatin.blur(); }
      });
      chatin.addEventListener('focus', () => this.held.clear());

      window.addEventListener('keydown', ev => {
        if (ev.target && (ev.target.tagName === 'INPUT' || ev.target.tagName === 'SELECT')) return;
        const code = ev.code;
        if (this.keybindMode) { this.bindKey(ev); return; }
        if (code === 'Enter') { ev.preventDefault(); chatin.focus(); return; }
        if (code === 'Escape') {
          if (!this.ui.closeWindows()) this.engine.targeted = false;
          return;
        }
        if (code === 'F1') { ev.preventDefault(); this.toggleWindow('win-help'); return; }
        if (code === 'Tab') { ev.preventDefault(); this.engine.targeted = true; return; }
        if (MOVE_KEYS[code] && !ev.ctrlKey && !ev.altKey) { ev.preventDefault(); this.held.add(code); return; }
        if (code === 'Space') { ev.preventDefault(); if (!ev.repeat) this.engine.jump(); return; }
        const combo = this.combo(ev);
        const binds = this.store.binds;
        for (let b = 0; b < 3; b++) for (let i = 0; i < 12; i++) {
          if (binds[b][i] === combo) { ev.preventDefault(); this.useSlot(b, i); return; }
        }
        if (!ev.ctrlKey && !ev.altKey && !ev.shiftKey) {
          if (code === 'KeyP') { this.toggleWindow('win-actions'); return; }
          if (code === 'KeyJ') { this.ui.buildJobs(); this.toggleWindow('win-job'); return; }
          if (code === 'KeyK') { this.toggleKeybind(); return; }
        }
      });
      window.addEventListener('keyup', ev => { this.held.delete(ev.code); });
      window.addEventListener('blur', () => this.held.clear());

      // The mouse, as in the game's standard controls. Left drag turns the camera; right drag turns the camera
      // and your character with it, and while the right button is down A/D strafe and S backpedals; both
      // buttons run forward; the wheel zooms. A click without a drag targets the dummy.
      const canvas = document.getElementById('scene');
      const mouse = this.mouse;
      const setButtons = (ev) => { mouse.left = !!(ev.buttons & 1); mouse.right = !!(ev.buttons & 2); };
      const release = () => {
        mouse.left = mouse.right = false; mouse.moved = 0;
        this.scene.dragging = false;
        document.body.classList.remove('camdrag');
      };
      canvas.addEventListener('contextmenu', ev => ev.preventDefault());
      canvas.addEventListener('pointerdown', ev => {
        this.sfx.ensure();
        if (ev.pointerType !== 'mouse' && ev.pointerType !== 'pen') {      // touch: just target
          if (this.scene.hitDummy(ev.clientX, ev.clientY)) this.engine.targeted = true;
          return;
        }
        ev.preventDefault();
        if (!mouse.left && !mouse.right) { mouse.moved = 0; try { canvas.setPointerCapture(ev.pointerId); } catch (e) { /* ok */ } }
        setButtons(ev);
        mouse.x = ev.clientX; mouse.y = ev.clientY;
      });
      canvas.addEventListener('pointermove', ev => {
        if (ev.pointerType !== 'mouse' && ev.pointerType !== 'pen') return;
        setButtons(ev);              // a second button pressed or let go mid-drag arrives as a move
        if (!mouse.left && !mouse.right) { if (this.scene.dragging) release(); return; }
        const dx = ev.clientX - mouse.x, dy = ev.clientY - mouse.y;
        mouse.x = ev.clientX; mouse.y = ev.clientY;
        mouse.moved += Math.abs(dx) + Math.abs(dy);
        if (mouse.moved > 3) {
          this.scene.dragging = true;
          document.body.classList.add('camdrag');
          this.scene.turnCamera(dx, dy);
        }
      });
      canvas.addEventListener('pointerup', ev => {
        if (ev.pointerType !== 'mouse' && ev.pointerType !== 'pen') return;
        const click = mouse.moved <= 3;
        setButtons(ev);
        if (click && this.scene.hitDummy(ev.clientX, ev.clientY)) this.engine.targeted = true;
        if (!mouse.left && !mouse.right) { release(); try { canvas.releasePointerCapture(ev.pointerId); } catch (e) { /* ok */ } }
      });
      canvas.addEventListener('pointercancel', release);
      canvas.addEventListener('lostpointercapture', () => { if (!mouse.left && !mouse.right) release(); });
      window.addEventListener('blur', release);
      canvas.addEventListener('wheel', ev => { ev.preventDefault(); this.scene.zoomCamera(ev.deltaY); }, { passive: false });

      const on = (id, fn) => document.getElementById(id).addEventListener('click', fn);
      on('b-job', () => { this.ui.buildJobs(); this.toggleWindow('win-job'); });
      on('b-pull', () => this.toggleCountdown());
      on('b-reset', () => this.fullReset());
      on('b-actions', () => this.toggleWindow('win-actions'));
      on('b-keybind', () => this.toggleKeybind());
      on('b-settings', () => { this.ui.fillSettings(); this.toggleWindow('win-settings'); });
      on('b-help', () => this.toggleWindow('win-help'));
      document.getElementById('target').addEventListener('click', () => { this.engine.targeted = true; });
    },

    toggleWindow(id) {
      const el = document.getElementById(id);
      if (el.classList.contains('show')) this.ui.closeWindows();
      else this.ui.openWindow(id);
    },

    bindKey(ev) {
      const code = ev.code;
      ev.preventDefault();
      if (code === 'Escape' || (code === 'KeyK' && !ev.shiftKey && !ev.ctrlKey && !ev.altKey)) { this.toggleKeybind(false); return; }
      if (MOD_KEYS.has(code)) return;
      const s = this.ui.hoverSlot;
      if (!s) { this.ui.error('Hover over a hotbar slot first.'); return; }
      const binds = this.store.binds;
      if (code === 'Backspace' || code === 'Delete') {
        binds[s.b][s.i] = null;
      } else {
        if (RESERVED.has(code)) { this.ui.error('That key is used for movement or menus.'); return; }
        const combo = this.combo(ev);
        for (const row of binds) for (let i = 0; i < row.length; i++) if (row[i] === combo) row[i] = null;
        binds[s.b][s.i] = combo;
      }
      this.save();
      this.ui.refreshBars();
      s.el.classList.add('kbhover');
    },

    // ---------- loop ----------
    frame(t) {
      const dt = Math.min(0.1, Math.max(0, (t - this.last) / 1000));
      this.last = t;
      const e = this.engine;

      // Movement relative to the camera. Both mouse buttons run forward. With the right button held your
      // character faces the camera's way, so A/D strafe and moving backward is a slow backpedal.
      const mb = this.scene.moveBasis();
      let fwd = 0, side = 0;
      for (const k of this.held) {
        const d = MOVE_KEYS[k];
        if (d === 'f') fwd++;
        if (d === 'b') fwd--;
        if (d === 'r') side++;
        if (d === 'l') side--;
      }
      const mouselook = this.mouse.right;
      if (this.mouse.left && this.mouse.right) fwd = Math.min(1, fwd + 1);
      fwd = Math.max(-1, Math.min(1, fwd)); side = Math.max(-1, Math.min(1, side));
      let dx = mb.fx * fwd + mb.rx * side, dz = mb.fz * fwd + mb.rz * side;
      if (Math.abs(dx) < 1e-6 && Math.abs(dz) < 1e-6) { dx = 0; dz = 0; }
      this.scene.mouselook = mouselook;
      this.scene.backpedal = mouselook && fwd < 0;
      e.move(dx, dz, dt, this.scene.backpedal ? BACKPEDAL : 1);
      e.advance(dt);
      e.frame();
      this.updateCountdown();

      if (this.enc) {
        const lim = this.store.settings.pullLength;
        if (lim && e.now >= this.enc.start + lim) this.endEncounter(this.enc.start + lim, 'time');
        else if (e.now - this.enc.lastActivity > 10) this.endEncounter(this.enc.lastDamage, 'idle');
      }

      this.scene.update(dt, dx !== 0 || dz !== 0);
      this.scene.draw();
      this.models.update(dt);
      const hpK = this.enc ? Math.max(1, DUMMY_HP - this.enc.total) / DUMMY_HP : 1;
      this.ui.update(hpK);
      requestAnimationFrame(tt => this.frame(tt));
    },
  };

  B.app = app;
  window.addEventListener('DOMContentLoaded', () => app.init());
})(window.BLM);
