// HUD: hotbars, Elemental Gauge, statuses, cast bar, party list, chat log,
// flytext, parse meter, tooltips and the windows.
(function (B) {
  const A = B.ACTIONS;
  const $ = (s, r) => (r || document).querySelector(s);
  const fmt = (n) => Math.round(n).toLocaleString('en-US');
  const esc = (s) => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

  function keyLabel(combo) {
    if (!combo) return '';
    const parts = combo.split('+');
    const code = parts.pop();
    let k = code;
    if (/^Digit\d$/.test(code)) k = code.slice(5);
    else if (/^Key[A-Z]$/.test(code)) k = code.slice(3);
    else if (/^Numpad\d$/.test(code)) k = 'N' + code.slice(6);
    else k = ({ Minus: '-', Equal: '=', Backquote: '`', BracketLeft: '[', BracketRight: ']', Semicolon: ';', Quote: "'", Comma: ',', Period: '.', Slash: '/', Backslash: '\\', Tab: 'Tab', CapsLock: 'Cap' })[code] || code;
    const mods = parts.map(m => ({ Shift: 'S', Ctrl: 'C', Alt: 'A' })[m]).join('');
    return mods + k;
  }
  B.keyLabel = keyLabel;

  const kindLabel = (a) => B.kindLabel(a);     // data.js

  class UI {
    constructor(app) {
      this.app = app;
      this.e = app.engine;
      this.slots = [];
      this.statusEls = {};
      this.tStatusEls = {};
      this.logTab = 'all';
      this.lastMeter = 0;
      this.castMsgUntil = 0;
      this.lagHp = 1;
      this.buildHotbars();
      this.buildGauge();
      this.buildChat();
      this.buildActions();
      this.buildHelp();
      this.buildSettings();
      document.querySelectorAll('[data-close]').forEach(b => b.addEventListener('click', () => this.closeWindows()));
    }

    // ---------- hotbars ----------
    buildHotbars() {
      const root = $('#hotbars');
      root.innerHTML = '';
      for (let b = 0; b < 3; b++) {
        const bar = document.createElement('div');
        bar.className = 'bar';
        bar.style.position = 'relative';
        const lbl = document.createElement('div');
        lbl.className = 'barlbl outline';
        lbl.style.top = '20px';
        lbl.textContent = b + 1;
        bar.appendChild(lbl);
        this.slots[b] = [];
        for (let i = 0; i < 12; i++) {
          const el = document.createElement('div');
          el.className = 'slot';
          el.innerHTML = '<img class="ic" alt="" draggable="false"><div class="tint"></div><div class="rc"></div>' +
            '<svg class="ants" viewBox="0 0 56 56"><rect x="1.5" y="1.5" width="53" height="53" rx="9"/></svg>' +
            '<div class="k outline"></div><div class="cdn outline"></div><div class="mpc outline"></div><div class="chg outline"></div>';
          const s = { el, b, i, img: $('img', el), rc: $('.rc', el), k: $('.k', el), cdn: $('.cdn', el), mpc: $('.mpc', el), chg: $('.chg', el), cache: {} };
          this.attachSlot(s);
          bar.appendChild(el);
          this.slots[b][i] = s;
        }
        root.appendChild(bar);
      }
      this.refreshBars();
    }

    refreshBars() {
      const bars = this.app.bars(), binds = this.app.store.binds;
      for (let b = 0; b < 3; b++) for (let i = 0; i < 12; i++) {
        const s = this.slots[b][i];
        s.id = bars[b][i];
        s.rid = null;
        s.cache = {};
        s.k.textContent = keyLabel(binds[b][i]);
        s.el.classList.toggle('empty', !s.id);
        if (!s.id) { s.img.removeAttribute('src'); s.img.style.display = 'none'; }
        else s.img.style.display = '';
      }
    }

    set(s, key, val, fn) {
      if (s.cache[key] === val) return;
      s.cache[key] = val;
      fn(val);
    }

    updateBars() {
      const e = this.e, now = e.now;
      const showMp = this.app.store.settings.showMpCost;
      for (let b = 0; b < 3; b++) for (let i = 0; i < 12; i++) {
        const s = this.slots[b][i];
        if (!s.id) continue;
        const rid = e.resolve(s.id);
        if (rid !== s.rid) { s.rid = rid; s.img.src = B.icon(rid); }
        const a = A[rid];
        let rem = 0, total = 1, cdText = '', chg = '', light = false;
        // Shared recasts (Continuation's follow-ups, Senei and Guren) live under their group's key.
        const c = e.cdOf(rid);
        if (a.kind === 'gcd') {
          rem = e.gcdEnd - now; total = e.gcdLen;
          // A weaponskill with a recast of its own (Gnashing Fang, Double Down, Tsubame-gaeshi) shows that recast
          // once it outlasts the GCD, with its countdown, as the game does.
          if (a.cd && c && c.charges === 0 && c.nextAt - now > rem) { rem = c.nextAt - now; total = c.recast; cdText = String(Math.ceil(rem)); }
          else if (a.cd && c && c.charges < c.max && rem <= 0.001) { rem = c.nextAt - now; total = c.recast; light = true; }
          if (a.cd && a.charges) chg = String(c ? c.charges : a.charges);
        } else {
          if (c && c.charges === 0) { rem = c.nextAt - now; total = c.recast; cdText = String(Math.ceil(rem)); }
          else if (c && c.charges < c.max) { rem = c.nextAt - now; total = c.recast; light = true; }
          if (a.charges) chg = String(c ? c.charges : a.charges);
        }
        let bg = 'none';
        if (rem > 0.001) {
          const deg = Math.max(0, Math.min(360, (1 - rem / total) * 360)).toFixed(1);
          const shade = light ? 'rgba(0,0,0,.28)' : 'rgba(0,0,0,.64)';
          bg = `conic-gradient(rgba(0,0,0,0) 0deg ${deg}deg, ${shade} ${deg}deg 360deg)`;
        }
        this.set(s, 'bg', bg, v => { s.rc.style.background = v; });
        this.set(s, 'cd', cdText, v => { s.cdn.textContent = v; });
        this.set(s, 'chg', chg, v => { s.chg.textContent = v; });

        const err = e.checkConditions(rid, true);
        this.set(s, 'un', !!err, v => s.el.classList.toggle('unusable', v));
        const oor = !!a.target && e.distToTarget() - B.DUMMY_RADIUS > B.RANGE;
        this.set(s, 'oor', oor, v => s.el.classList.toggle('oor', v));
        const proc = !!(e.job.proc && e.job.proc(rid, e));
        this.set(s, 'proc', proc, v => s.el.classList.toggle('proc', v));
        const q = e.queue.length > 0 && e.queuedIds().includes(rid);
        this.set(s, 'q', q, v => s.el.classList.toggle('queued', v));

        let mpText = '', short = false;
        if (showMp && a.kind === 'gcd' && a.mp > 0) {
          const cost = rid === 'despair' ? 800 : e.mpCost(rid);
          mpText = String(rid === 'despair' ? Math.max(800, e.mp) : cost);
          short = e.mp < cost;
          if (rid !== 'despair' && cost === 0) mpText = '0';
        }
        this.set(s, 'mp', mpText + (short ? '!' : ''), () => { s.mpc.textContent = mpText; s.mpc.classList.toggle('short', short); });
      }
    }

    flashSlot(b, i) {
      const s = this.slots[b] && this.slots[b][i];
      if (!s) return;
      s.el.classList.add('pressed');
      clearTimeout(s.flashT);
      s.flashT = setTimeout(() => s.el.classList.remove('pressed'), 110);
    }

    attachSlot(s) {
      const el = s.el;
      el.addEventListener('pointerdown', (ev) => {
        if (ev.button !== 0) return;
        ev.preventDefault();
        this.app.drag.begin(ev, { from: 'slot', b: s.b, i: s.i, id: s.id });
      });
      el.addEventListener('pointerenter', () => {
        this.hoverSlot = s;
        if (this.app.keybindMode) { el.classList.add('kbhover'); return; }
        if (s.id && !this.app.drag.active) this.showTip(this.e.resolve(s.id), el);
      });
      el.addEventListener('pointerleave', () => {
        if (this.hoverSlot === s) this.hoverSlot = null;
        el.classList.remove('kbhover');
        this.hideTip();
      });
      el.addEventListener('contextmenu', (ev) => ev.preventDefault());
    }

    slotAt(x, y) {
      const el = document.elementFromPoint(x, y);
      const slotEl = el && el.closest && el.closest('.slot');
      if (!slotEl) return null;
      for (const row of this.slots) for (const s of row) if (s.el === slotEl) return s;
      return null;
    }

    // ---------- tooltip ----------
    showTip(id, anchor) {
      const a = A[id];
      if (!a) return;
      const e = this.e;
      const tip = $('#tip');
      let cast = '—', recast = '—', mp = '—';
      if (a.kind === 'gcd') {
        cast = a.cast ? e.speedScale(a.cast).toFixed(2) + 's' : 'Instant';
        // Its own recast (Army's Paeon's 1.5s steps), or the cooldown of a GCD on charges (Holy Sanctuary's 30s).
        recast = (a.cd ? (a.cdScales ? e.speedScale(a.cd) : a.cd) : e.gcdRecast(id)).toFixed(2) + 's';
        mp = id === 'despair' ? '800+' : a.mp ? String(a.mp) : '0';
      } else {
        cast = 'Instant';
        recast = a.recast + 's';
      }
      tip.innerHTML = `<div class="t1"><img src="${B.icon(id)}" alt=""><div><b>${esc(a.name)}</b><small>${kindLabel(a)}${a.target ? ` · Range ${a.range || B.RANGE}y` : ''}${a.kind === 'gcd' && a.charges ? ` · ${a.charges} charges` : ''}</small></div></div>` +
        `<div class="grid"><div>Cast<b>${cast}</b></div><div>Recast<b>${recast}</b></div><div>${a.kind === 'gcd' ? 'MP Cost' : (a.charges ? 'Charges' : 'Lock')}<b>${a.kind === 'gcd' ? mp : (a.charges ? a.charges : e.animLock(a.lock, true).toFixed(2) + 's')}</b></div></div>` +
        `<div class="desc">${esc(a.desc)}</div>`;
      tip.classList.add('show');
      const r = this.app.toHud(anchor.getBoundingClientRect());
      let x = r.x + r.w / 2 - 200, y = r.y - tip.offsetHeight - 12;
      if (y < 10) y = r.y + r.h + 12;
      x = Math.max(10, Math.min(1910 - 400, x));
      tip.style.left = x + 'px'; tip.style.top = y + 'px';
    }
    hideTip() { $('#tip').classList.remove('show'); }

    // ---------- job gauge (drawn by the job module) ----------
    buildGauge() { this.e.job.gaugeBuild($('#gauge')); }
    updateGauge() { this.e.job.gaugeUpdate(this.e); }

    // ---------- statuses ----------
    syncStatusRow(container, map, list, now) {
      const keep = new Set();
      list.forEach(({ key, s }, idx) => {
        keep.add(key);
        let el = map[key];
        if (!el) {
          el = document.createElement('div');
          el.className = 'status';
          el.title = B.STATUSES[key].name;
          el.innerHTML = `<img src="${B.statusIcon(key)}" alt=""><div class="t outline"></div><div class="stk outline"></div>`;
          map[key] = el;
          el._t = $('.t', el); el._k = $('.stk', el);
        }
        if (container.children[idx] !== el) container.insertBefore(el, container.children[idx] || null);
        const rem = s.until - now;
        const txt = s.permanent ? '' : rem >= 60 ? Math.ceil(rem / 60) + 'm' : String(Math.max(0, Math.ceil(rem - 1e-6)));
        if (el._tv !== txt) { el._tv = txt; el._t.textContent = txt; }
        const stk = s.stacks ? String(s.stacks) : '';
        if (el._kv !== stk) {
          el._kv = stk;
          el._k.textContent = B.statusHasStackArt(key, s.stacks) ? '' : stk;
          if (s.stacks) el.querySelector('img').src = B.statusIcon(key, s.stacks);
        }
      });
      for (const k of Object.keys(map)) if (!keep.has(k)) { map[k].remove(); delete map[k]; }
    }

    updateStatuses() {
      const e = this.e, now = e.now;
      const self = e.job.selfStatusOrder.filter(k => e.statuses[k] && e.statuses[k].until > now).map(k => ({ key: k, s: e.statuses[k] }));
      this.syncStatusRow($('#buffs'), this.statusEls, self, now);
      const tl = e.job.targetStatusOrder.filter(k => e.tStatuses[k] && e.tStatuses[k].until > now).map(k => ({ key: k, s: e.tStatuses[k] }));
      this.syncStatusRow($('#tdebuffs'), this.tStatusEls, tl, now);
    }

    // ---------- cast bar ----------
    castInterrupted(id, reason) {
      this.castMsg = { id, reason, k: this.cbK || 0 };
      this.castMsgUntil = performance.now() + 900;
    }

    updateCastBar() {
      const e = this.e, cb = $('#castbar');
      if (e.casting) {
        const c = e.casting, a = A[c.id];
        const k = Math.min(1, (e.now - c.start) / (c.end - c.start));
        this.cbK = k;
        if (this.cbId !== c.id + c.start) {
          this.cbId = c.id + c.start;
          $('#cb-name').textContent = a.name;
          $('#cb-icon').src = B.icon(c.id);
          $('#cb-msg').textContent = '';
          cb.classList.remove('interrupted');
          const slide = $('#cb-slide');
          const pos = 1 - B.SLIDECAST / (c.end - c.start);
          slide.style.display = this.app.store.settings.slidecastMarker && pos > 0 ? '' : 'none';
          slide.style.left = (pos * 100).toFixed(2) + '%';
        }
        $('#cb-fill').style.transform = `scaleX(${k})`;
        $('#cb-time').textContent = Math.max(0, c.end - e.now).toFixed(2);
        cb.classList.add('show');
      } else if (this.castMsg && performance.now() < this.castMsgUntil) {
        if (this.cbId !== 'msg') {
          this.cbId = 'msg';
          const a = A[this.castMsg.id];
          $('#cb-name').textContent = a.name;
          $('#cb-icon').src = B.icon(this.castMsg.id);
          $('#cb-msg').textContent = this.castMsg.reason === 'Interrupted' ? 'INTERRUPTED' : this.castMsg.reason.toUpperCase();
          $('#cb-time').textContent = '';
          $('#cb-fill').style.transform = `scaleX(${this.castMsg.k})`;
          cb.classList.add('interrupted');
        }
        cb.classList.add('show');
      } else {
        this.cbId = null;
        cb.classList.remove('show');
      }
    }

    // ---------- params / party / target ----------
    updateParams() {
      const e = this.e;
      // Jobs on TP (physical jobs before 5.0) show it where MP would be, as the old UI did.
      const tp = e.usesTp;
      const res = tp ? e.tp : e.mp;
      const hpK = e.hp / e.maxHp, mpK = res / (tp ? e.job.tp.max : e.maxMp);
      const c = this.pc || (this.pc = {});
      const put = (k, v, fn) => { if (c[k] !== v) { c[k] = v; fn(v); } };
      put('hp', e.hp, v => { $('#p-hp').textContent = fmt(v); $('#party-hpn').textContent = fmt(v); });
      put('mp', res, v => { $('#p-mp').textContent = String(Math.floor(v)); $('#party-mpn').textContent = String(Math.floor(v)); });
      put('reslbl', tp ? 'TP' : 'MP', v => { $('#p-mplbl').textContent = v; $('#p-tickbar').title = `Next ${v} tick (every 3s)`; });
      put('hpk', hpK, v => { $('#p-hpbar').style.transform = `scaleX(${v})`; $('#party-hp').style.transform = `scaleX(${v})`; });
      put('mpk', mpK, v => { $('#p-mpbar').style.transform = `scaleX(${v})`; $('#party-mp').style.transform = `scaleX(${v})`; });
      put('name', this.app.store.settings.name, v => { $('#party-name').textContent = v; });

      // MP tick timer: fills over the 3s server tick, labelled with what the tick will give.
      const left = Math.max(0, e.mpTickNext - e.now);
      $('#p-tick').style.transform = `scaleX(${(1 - left / 3).toFixed(3)})`;
      const gain = tp ? Math.min(e.job.tp.regen, e.job.tp.max - e.tp) : e.mpTickGain();
      const note = e.job.mpTickNote ? e.job.mpTickNote(e) : null;
      const af = !!note;
      const txt = !tp && note ? `tick ${left.toFixed(1)}s · ${note}` : `+${gain}${tp ? ' TP' : ''} in ${left.toFixed(1)}s`;
      put('tick', txt, v => { $('#p-ticktxt').textContent = v; });
      put('tickaf', af, v => { $('#p-ticktxt').classList.toggle('af', v); $('#p-tickbar').classList.toggle('af', v); });
    }

    flashTick() {
      const bar = $('#p-tickbar');
      bar.classList.add('flash');
      clearTimeout(this.tickT);
      this.tickT = setTimeout(() => bar.classList.remove('flash'), 220);
    }

    updateTarget(hpK) {
      const t = $('#target');
      t.classList.toggle('none', !this.e.targeted);
      if (this.lagHp < hpK) this.lagHp = hpK;
      this.lagHp += (hpK - this.lagHp) * 0.04;
      $('#t-hp').style.transform = `scaleX(${hpK})`;
      $('#t-lag').style.transform = `scaleX(${this.lagHp})`;
      $('#t-pct').textContent = (hpK * 100).toFixed(1) + '%';
    }

    // ---------- chat ----------
    buildChat() {
      document.querySelectorAll('#chat .tabs button').forEach(btn => btn.addEventListener('click', () => {
        document.querySelectorAll('#chat .tabs button').forEach(b => b.classList.toggle('on', b === btn));
        this.logTab = btn.dataset.tab;
        this.filterLog();
      }));
    }
    filterLog() {
      for (const d of $('#log').children) d.style.display = this.logTab === 'all' || d.dataset.cat === this.logTab ? '' : 'none';
    }
    targetName() { return this.app.fight ? this.app.fight.name : 'Striking Dummy'; }

    log(text, cls, cat) {
      const log = $('#log');
      const atBottom = log.scrollHeight - log.scrollTop - log.clientHeight < 30;
      const d = document.createElement('div');
      d.className = cls || 'act';
      d.dataset.cat = cat || 'battle';
      d.textContent = text;
      if (!(this.logTab === 'all' || d.dataset.cat === this.logTab)) d.style.display = 'none';
      log.appendChild(d);
      while (log.children.length > 300) log.removeChild(log.firstChild);
      if (atBottom) log.scrollTop = log.scrollHeight;
    }

    // ---------- flytext ----------
    fly(opts) {
      const p = opts.at;
      if (!p) return;
      const h = this.app.screenToHud(p.x, p.y);
      const el = document.createElement('div');
      el.className = 'fly outline ' + (opts.cls || '');
      el.style.left = (h.x + (opts.dx || 0)) + 'px';
      el.style.top = (h.y + (opts.dy || 0)) + 'px';
      let html = '';
      if (opts.icon || opts.label) html += `<div class="ln1">${opts.icon ? `<img src="${opts.icon}" alt="">` : ''}${opts.label ? esc(opts.label) : ''}</div>`;
      if (opts.tag) html += `<div class="tag">${esc(opts.tag)}</div>`;
      html += `<div class="num">${esc(opts.text)}</div>`;
      el.innerHTML = html;
      $('#fly').appendChild(el);
      setTimeout(() => el.remove(), 1500);
    }

    error(msg) {
      const el = $('#error');
      el.textContent = msg;
      el.classList.add('show');
      clearTimeout(this.errT);
      this.errT = setTimeout(() => el.classList.remove('show'), 900);
    }

    count(text, engage) {
      const el = $('#count');
      el.textContent = text;
      el.classList.toggle('eng', !!engage);
      el.classList.remove('pop');
      void el.offsetWidth;
      el.classList.add('pop');
    }

    banner(html) {
      const b = $('#banner');
      if (!html) { b.classList.remove('show'); return; }
      b.innerHTML = html;
      b.classList.add('show');
    }

    // ---------- parse meter ----------
    updateMeter(force) {
      const t = performance.now();
      if (!force && t - this.lastMeter < 200) return;
      this.lastMeter = t;
      const app = this.app, enc = app.enc || app.lastEnc;
      const now = this.e.now;
      const m = $('#meter');
      const name = esc(app.store.settings.name);
      if (!enc) {
        m.innerHTML = `<div class="hd"><span>${esc(this.targetName())}</span><b>00:00</b></div>` +
          `<div class="row"><i style="transform:scaleX(0)"></i><div class="in"><img src="${B.jobIcon()}" alt=""><div class="who">${name}<small>${esc(this.e.job.abbr)}</small></div><div class="dps outline">0</div></div></div>` +
          `<div class="maxhit">Hit the dummy to start a parse. Use <b>/countdown</b> for a pull.</div>` + this.histHtml() + this.meterActs();
        this.bindMeter();
        return;
      }
      const dur = enc.duration(now);
      const dps = enc.total / dur;
      const mm = String(Math.floor(dur / 60)).padStart(2, '0'), ss = String(Math.floor(dur % 60)).padStart(2, '0');
      const color = app.parseColor(dps);
      const crit = enc.hits ? (enc.crits / enc.hits * 100).toFixed(1) : '0.0';
      const dh = enc.hits ? (enc.dhs / enc.hits * 100).toFixed(1) : '0.0';
      const max = enc.maxHit;
      m.innerHTML = `<div class="hd"><span>${enc.end ? 'Last pull' : esc(this.targetName())}</span><b>${mm}:${ss}</b></div>` +
        `<div class="row"><i style="transform:scaleX(1)"></i><div class="in"><img src="${B.jobIcon(enc.jobId)}" alt=""><div class="who">${name}<small>${esc(enc.abbr || '')} · ${fmt(enc.total)} dmg</small></div><div class="dps outline" style="color:${color}">${fmt(dps)}</div></div></div>` +
        `<div class="sub"><div>Crit<b>${crit}%</b></div><div>Direct hit<b>${dh}%</b></div><div>GCD uptime<b>${enc.uptime(now).toFixed(1)}%</b></div></div>` +
        (max ? `<div class="maxhit">Max hit: ${esc(((enc.actions || A)[max.id] || {}).name || max.id)} <b>${fmt(max.amount)}${max.crit ? '!' : ''}${max.dh ? '!' : ''}</b></div>` : '') +
        this.histHtml() + this.meterActs();
      this.bindMeter();
    }
    histHtml() {
      const h = this.app.history;
      if (!h.length) return '';
      return '<div class="hist">' + h.slice(-5).reverse().map((enc, i) => {
        const d = enc.duration(), dps = enc.total / d;
        const mm = Math.floor(d / 60) + ':' + String(Math.floor(d % 60)).padStart(2, '0');
        return `<div data-hist="${h.length - 1 - i}"><span>Pull ${enc.n} · ${mm}</span><span style="color:${this.app.parseColor(dps)}">${fmt(dps)} DPS</span></div>`;
      }).join('') + '</div>';
    }
    meterActs() { return '<div class="acts"><button class="btn" data-m="details">Breakdown</button><button class="btn" data-m="pull">Countdown</button></div>'; }
    bindMeter() {
      const m = $('#meter');
      m.querySelectorAll('[data-hist]').forEach(d => d.addEventListener('click', () => this.showResults(this.app.history[+d.dataset.hist])));
      m.querySelectorAll('[data-m]').forEach(b => b.addEventListener('click', () => {
        if (b.dataset.m === 'details') { const enc = this.app.enc || this.app.lastEnc; if (enc) this.showResults(enc); }
        else this.app.toggleCountdown();
      }));
    }

    // ---------- windows ----------
    openWindow(id) {
      this.closeWindows();
      $('#' + id).classList.add('show');
    }
    closeWindows() {
      let any = false;
      document.querySelectorAll('.win.show').forEach(w => {
        if (w.id === 'win-barsetup' && this.barSetup) return;      // hotbar setup closes only from its own buttons
        w.classList.remove('show'); any = true;
      });
      return any;
    }
    anyWindow() { return !!document.querySelector('.win.show'); }

    showResults(enc) {
      const EA = (enc && enc.actions) || A;
      const now = this.e.now;
      const dur = enc.duration(now);
      const dps = enc.total / dur;
      const mm = Math.floor(dur / 60) + ':' + String(Math.floor(dur % 60)).padStart(2, '0');
      $('#res-title').textContent = `Pull ${enc.n} · ${this.targetName()}`;
      const rows = Object.entries(enc.byAction).sort((a, b) => b[1].total - a[1].total);
      const casts = {};
      enc.uses.forEach(u => { if (!u.interrupted) casts[u.id] = (casts[u.id] || 0) + 1; });
      const ints = enc.uses.filter(u => u.interrupted).length;
      let html = `<div class="sumrow">` +
        `<div>DPS<b style="color:${this.app.parseColor(dps)}">${fmt(dps)}</b></div>` +
        `<div>Duration<b>${mm}</b></div>` +
        `<div>Total damage<b>${fmt(enc.total)}</b></div>` +
        `<div>GCD uptime<b>${enc.uptime(now).toFixed(1)}%</b></div>` +
        `<div>Crit / DH<b>${enc.hits ? (enc.crits / enc.hits * 100).toFixed(1) : 0}% / ${enc.hits ? (enc.dhs / enc.hits * 100).toFixed(1) : 0}%</b></div></div>`;
      html += `<table class="brk"><thead><tr><th>Action</th><th>Casts</th><th>Hits</th><th>Damage</th><th>%</th><th>Average</th><th>Crit %</th><th>DH %</th><th>Max</th></tr></thead><tbody>`;
      for (const [id, r] of rows) {
        const pct = r.total / Math.max(1, enc.total) * 100;
        html += `<tr><td><img src="${B.icon(id)}" alt="">${esc(EA[id].name)}${r.dotHits ? ' <span style="color:#a9a3b4">(+DoT)</span>' : ''}</td>` +
          `<td>${casts[id] || 0}</td><td>${r.hits}</td><td>${fmt(r.total)}</td><td>${pct.toFixed(1)}<span class="pbar"><i style="width:${pct}%"></i></span></td>` +
          `<td>${fmt(r.total / r.hits)}</td><td>${(r.crits / r.hits * 100).toFixed(0)}</td><td>${(r.dhs / r.hits * 100).toFixed(0)}</td><td>${fmt(r.max)}</td></tr>`;
      }
      const ogcds = Object.entries(casts).filter(([id]) => EA[id].kind !== 'gcd');
      if (ogcds.length) {
        html += `<tr><td colspan="9" style="padding-top:10px;color:#a9a3b4;font-size:12.5px">Abilities used: ` +
          ogcds.map(([id, n]) => `${esc(EA[id].name)} ×${n}`).join(' · ') + (ints ? ` · Interrupted casts: ${ints}` : '') + `</td></tr>`;
      }
      html += '</tbody></table>';
      if (this.app.store.settings.showTimeline) html += this.timelineHtml(enc, now);
      $('#resbody').innerHTML = html;
      this.openWindow('win-results');
    }

    timelineHtml(enc, now) {
      const EA = (enc && enc.actions) || A;
      const pxs = 46;
      const t0 = Math.min(enc.start, enc.uses.length ? enc.uses[0].t : enc.start);
      const t1 = enc.end || now;
      const width = Math.max(1000, (t1 - t0) * pxs + 80);
      let h = `<div class="tlwrap"><div class="tl" style="width:${width}px">`;
      for (let s = Math.ceil(t0 - enc.start); s <= t1 - enc.start; s++) {
        if (s % 5) continue;
        const x = (enc.start + s - t0) * pxs + 20;
        h += `<div class="tick" style="left:${x}px"><span>${s < 0 ? '−' + (-s) : s}s</span></div>`;
      }
      for (const u of enc.uses) {
        const x = (u.t - t0) * pxs + 20;
        if (EA[u.id].kind === 'gcd') {
          if (u.cast) h += `<div class="castbar" style="left:${x}px;width:${(u.interrupted ? u.cut : u.cast) * pxs}px;${u.interrupted ? 'background:#c0392b' : ''}"></div>`;
          h += `<img src="${B.icon(u.id)}" title="${esc(EA[u.id].name)} @ ${(u.t - enc.start).toFixed(2)}s" style="left:${x}px;top:22px;width:34px;height:34px;${u.interrupted ? 'opacity:.4' : ''}">`;
        } else {
          h += `<img src="${B.icon(u.id)}" title="${esc(EA[u.id].name)} @ ${(u.t - enc.start).toFixed(2)}s" style="left:${x}px;top:66px;width:26px;height:26px">`;
        }
      }
      h += '</div></div><div class="tlhint">Top row: spells (gold line = cast time). Bottom row: abilities. Hover an icon for its time.</div>';
      return h;
    }

    // ---------- hotbar setup ----------
    // A walk through everything on the job's default hotbars, its GCDs first and then its abilities and items: press the
    // key you want for each one, or click a slot, and it goes on the slot that key is bound to. It opens by itself on a
    // job version with no saved hotbars, and from the Actions window. The bars update as you go; nothing is saved until
    // you finish or skip.
    openBarSetup(manual = false) {
      const app = this.app;
      if (app.keybindMode) app.toggleKeybind(false);
      const bars = app.bars();
      const ids = [...new Set(this.e.job.defaultBars.flat().filter(id => id && A[id]))];
      const queue = [...ids.filter(id => A[id].kind === 'gcd'), ...ids.filter(id => A[id].kind !== 'gcd')];
      if (!queue.length) { this.closeBarSetup(true); return; }
      const start = bars.map(r => r.slice());
      for (const r of bars) r.forEach((id, i) => { if (queue.includes(id)) r[i] = null; });
      this.barSetup = { queue, pos: 0, history: [], start, msg: '', manual };
      this.refreshBars();
      this.openWindow('win-barsetup');
      this.renderBarSetup();
    }

    closeBarSetup(keep) {
      const S = this.barSetup, app = this.app;
      if (S && !keep) {
        const bars = app.bars();
        S.start.forEach((r, b) => r.forEach((id, i) => { bars[b][i] = id; }));
      }
      this.barSetup = null;
      $('#win-barsetup').classList.remove('show');
      app.save();
      this.refreshBars();
    }

    renderBarSetup() {
      const S = this.barSetup;
      if (!S) return;
      const bars = this.app.bars(), binds = this.app.store.binds, job = this.e.job;
      const where = (id) => { for (let b = 0; b < 3; b++) { const i = bars[b].indexOf(id); if (i >= 0) return keyLabel(binds[b][i]) || `bar ${b + 1}`; } return null; };
      const skipped = new Set(S.history.filter(h => h.skipped).map(h => h.id));
      const isGcd = (id) => A[id].kind === 'gcd';
      // An action asked again (its key was taken) shows once, at its last place in the queue; the GCDs and the
      // abilities each get their own row.
      const cell = (id, j) => {
        if (S.queue.lastIndexOf(id) !== j) return '';
        const k = where(id), state = j === S.pos ? 'now' : skipped.has(id) && j < S.pos ? 'off' : k ? 'set' : '';
        return `<div class="bsi ${state}" title="${esc(A[id].name)}"><img src="${B.icon(id)}" alt=""><small>${j === S.pos ? '…' : k ? esc(k) : skipped.has(id) ? 'off' : ''}</small></div>`;
      };
      const row = (gcd) => S.queue.map((id, j) => (isGcd(id) === gcd ? cell(id, j) : '')).join('');
      const g = row(true), o = row(false);
      const strip = (g ? `<div class="bsrow"><small>GCDs</small><div class="bsq">${g}</div></div>` : '') +
        (o ? `<div class="bsrow"><small>Abilities</small><div class="bsq">${o}</div></div>` : '');
      let html;
      if (S.pos < S.queue.length) {
        const id = S.queue[S.pos], a = A[id];
        const sub = a.kind === 'gcd' ? (a.cast ? a.cast.toFixed(1) + 's cast' : 'Instant') + (a.potency ? ` · ${a.potency} potency` : '') : a.recast ? `Recast ${a.recast}s` : '';
        const n = (gcd) => [...new Set(S.queue.filter(x => isGcd(x) === gcd))].length;
        const at = isGcd(id) ? `GCD ${Math.min(S.pos + 1, n(true))} of ${n(true)}` : `Ability ${Math.min(S.pos + 1 - n(true), n(false))} of ${n(false)}`;
        html = `<div class="bsintro">${esc(job.name)}, ${esc(job.versionLabel)}: press the key you want for each GCD, then each ability, or click a hotbar slot. Your keybinds decide which slot a key fills.</div>
          <div class="bscur"><img src="${B.icon(id)}" alt=""><div><small>${at}</small><b>${esc(a.name)}</b><span>${kindLabel(a)}${sub ? ' · ' + sub : ''}</span></div></div>
          <div class="bsmsg">${S.msg || 'Press a hotbar key: <kbd>1</kbd>–<kbd>=</kbd>, <kbd>Shift</kbd>+<kbd>1</kbd>–<kbd>=</kbd>, <kbd>Q</kbd> <kbd>E</kbd> <kbd>R</kbd> <kbd>F</kbd> … Backspace goes back.'}</div>
          ${strip}
          <div class="bsbtn"><button data-bs="back"${S.history.length ? '' : ' disabled'}>Back</button><button data-bs="off">Leave it off</button><span></span>
            <button data-bs="finish" title="Everything not asked yet goes to its usual slot, or a free one">Finish here</button>
            <button data-bs="skip">${S.manual ? 'Cancel, keep my hotbar' : 'Skip, use the default hotbar'}</button></div>`;
      } else {
        const ids = [...new Set(S.queue)], pl = (gcd) => ids.filter(id => isGcd(id) === gcd && where(id)).length;
        const off = ids.filter(id => !where(id)).length;
        html = `<div class="bsintro">${pl(true)} GCD${pl(true) === 1 ? '' : 's'} and ${pl(false)} abilit${pl(false) === 1 ? 'y' : 'ies'} placed${off ? `, ${off} left off (drag them on from the Actions window any time)` : ''}.</div>
          ${strip}
          <div class="bsbtn"><button data-bs="back">Back</button><span></span><button data-bs="done" class="main">Done</button></div>`;
      }
      const box = $('#barsetup');
      box.innerHTML = html;
      box.querySelectorAll('[data-bs]').forEach(btn => btn.addEventListener('click', () => {
        const k = btn.dataset.bs;
        if (k === 'back') this.barSetupBack();
        else if (k === 'off') this.barSetupStep({ id: S.queue[S.pos], skipped: true });
        else if (k === 'skip') this.closeBarSetup(false);
        else if (k === 'done') this.closeBarSetup(true);
        else if (k === 'finish') this.barSetupFinish();
      }));
    }

    // Finish early: everything not asked yet goes to its usual slot if that's free, otherwise the first free one.
    barSetupFinish() {
      const S = this.barSetup, bars = this.app.bars(), def = this.e.job.defaultBars;
      const placed = new Set(bars.flat());
      for (const id of S.queue.slice(S.pos)) {
        if (placed.has(id)) continue;
        let at = null;
        def.forEach((r, b) => r.forEach((x, i) => { if (x === id && !at && bars[b][i] === null) at = [b, i]; }));
        for (let b = 0; b < 3 && !at; b++) { const i = bars[b].indexOf(null); if (i >= 0) at = [b, i]; }
        if (at) { bars[at[0]][at[1]] = id; placed.add(id); }
      }
      this.closeBarSetup(true);
    }

    // A key pressed during setup: the slot it's bound to gets the current action.
    barSetupKey(ev) {
      const S = this.barSetup;
      if (/^(Shift|Control|Alt|Meta)/.test(ev.code)) return;
      if (ev.repeat) { ev.preventDefault(); return; }               // a held key places once
      if (ev.code === 'Backspace') { ev.preventDefault(); this.barSetupBack(); return; }
      if (ev.code === 'Escape') { S.msg = 'To stop here, use Skip: it keeps the default hotbar.'; this.renderBarSetup(); return; }
      if (S.pos >= S.queue.length) { if (ev.code === 'Enter') { ev.preventDefault(); this.closeBarSetup(true); } return; }
      const combo = this.app.combo(ev), binds = this.app.store.binds;
      for (let b = 0; b < 3; b++) for (let i = 0; i < 12; i++) {
        if (binds[b][i] === combo) { ev.preventDefault(); this.barSetupPlace(b, i); return; }
      }
      if (/^F\d+$/.test(ev.code)) return;       // leave the browser's own keys alone
      ev.preventDefault();
      S.msg = `<b>${esc(keyLabel(combo))}</b> isn't on a hotbar. Use <kbd>1</kbd>–<kbd>=</kbd>, <kbd>Shift</kbd>+<kbd>1</kbd>–<kbd>=</kbd> or <kbd>Q</kbd> <kbd>E</kbd> <kbd>R</kbd> <kbd>F</kbd> …, or change keybinds with <kbd>K</kbd> afterwards.`;
      this.renderBarSetup();
    }

    // Put the current action on a slot. What was there: an action from this pass goes back in the queue to be asked
    // again; anything else (an ability, during the GCD pass) moves to the first free slot.
    barSetupPlace(b, i) {
      const S = this.barSetup;
      if (!S || S.pos >= S.queue.length) return;
      const bars = this.app.bars(), id = S.queue[S.pos], prev = bars[b][i];
      const step = { id, b, i, prev, requeued: false, moved: null };
      bars[b][i] = id;
      if (prev && prev !== id) {
        if (S.queue.includes(prev)) { S.queue.push(prev); step.requeued = true; }
        else {
          for (let r = 0; r < 3 && !step.moved; r++) { const f = bars[r].indexOf(null); if (f >= 0) { bars[r][f] = prev; step.moved = [r, f]; } }
        }
      }
      S.msg = prev && step.requeued ? `${esc(A[prev].name)} was on that key; it's asked again at the end.` : '';
      this.flashSlot(b, i);
      this.barSetupStep(step);
    }

    barSetupStep(step) {
      const S = this.barSetup;
      if (step.skipped) S.msg = '';
      S.history.push(step);
      S.pos++;
      this.refreshBars();
      this.renderBarSetup();
    }

    barSetupBack() {
      const S = this.barSetup;
      const step = S && S.history.pop();
      if (!step) return;
      const bars = this.app.bars();
      if (!step.skipped) {
        if (step.moved) bars[step.moved[0]][step.moved[1]] = null;
        bars[step.b][step.i] = step.prev;
        if (step.requeued) S.queue.splice(S.queue.lastIndexOf(step.prev), 1);
      }
      S.pos--;
      S.msg = '';
      this.refreshBars();
      this.renderBarSetup();
    }

    buildActions() {
      const groups = this.e.job.actionGroups;
      let html = '<div style="color:#a9a3b4;font-size:13.5px;margin-bottom:10px">Drag an action onto a hotbar slot. Drag a slot onto another to swap them, or off the bars to clear it. <button class="bsopen">Set up the hotbar…</button></div>';
      for (const [title, ids] of groups) {
        html += `<div class="ahead">${title}</div><div class="agrid">`;
        for (const id of ids) {
          const a = A[id];
          const sub = a.kind === 'gcd' ? (a.cast ? a.cast.toFixed(1) + 's cast' : 'Instant') + (a.potency ? ` · ${a.potency} potency` : '') : `Recast ${a.recast}s`;
          html += `<div class="aitem" data-id="${id}"><img src="${B.icon(id)}" alt="" draggable="false"><div><b>${esc(a.name)}</b><small>${kindLabel(a)} · ${sub}</small></div></div>`;
        }
        html += '</div>';
      }
      $('#actlist').innerHTML = html;
      $('#actlist .bsopen').addEventListener('click', () => this.openBarSetup(true));
      $('#actlist').querySelectorAll('.aitem').forEach(el => {
        el.addEventListener('pointerdown', (ev) => { ev.preventDefault(); this.app.drag.begin(ev, { from: 'list', id: el.dataset.id }); });
        el.addEventListener('pointerenter', () => { if (!this.app.drag.active) this.showTip(el.dataset.id, el); });
        el.addEventListener('pointerleave', () => this.hideTip());
      });
    }

    buildHelp() {
      const job = this.e.job;
      const ic = (id, og) => `<img class="${og ? 'og' : ''}" src="${B.icon(id)}" title="${esc(A[id].name)}" alt="${esc(A[id].name)}">`;
      const ar = '<span class="ar">›</span>';
      const seq = (items) => '<div class="seq">' + items.map(x => Array.isArray(x) ? ic(x[0], true) : ic(x)).join(ar) + '</div>';
      $('#help-title').textContent = `How to play: ${job.name}, ${job.versionLabel}`;
      $('#helpbody').innerHTML = `
<h3>Controls</h3>
<table>
<tr><td>Hotbars</td><td>Keys <kbd>1</kbd>–<kbd>=</kbd>, <kbd>Shift</kbd>+<kbd>1</kbd>–<kbd>=</kbd>, and <kbd>Q</kbd> <kbd>E</kbd> <kbd>R</kbd> <kbd>F</kbd> … for bar 3, or click a slot. Rebind with <kbd>K</kbd>. The first time you play a job version, the hotbar setup asks for a key for each GCD, then each ability (Actions window, <kbd>P</kbd>, runs it again).</td></tr>
<tr><td>Move</td><td><kbd>W</kbd> <kbd>A</kbd> <kbd>S</kbd> <kbd>D</kbd> (or arrow keys). <kbd>Space</kbd> jumps. Moving or jumping cancels a cast, except in the last 0.5s (the blue line on the cast bar): that's slidecasting.</td></tr>
<tr><td>Camera</td><td>Hold the right mouse button and drag to turn the camera and your character: while it's held, <kbd>A</kbd> <kbd>D</kbd> strafe and <kbd>S</kbd> backpedals at walking pace. Drag with the left button to turn just the camera. Hold both buttons to run forward. The wheel zooms.</td></tr>
<tr><td>Target</td><td><kbd>Tab</kbd> or click the dummy. <kbd>Esc</kbd> closes windows, then clears your target.</td></tr>
<tr><td>Chat</td><td><kbd>Enter</kbd> to type. <code>/countdown 15</code> (or <code>/cd</code>), <code>/reset</code>, <code>/help</code>, <code>/debug</code> (copies a debug log to paste to Claude), <code>/fight</code> (lists the fights; <code>/fight m2s</code> goes to one, <code>/fight off</code> back to the pier).</td></tr>
<tr><td>Windows</td><td><kbd>J</kbd> Job, <kbd>P</kbd> Actions &amp; Traits, <kbd>K</kbd> keybind mode, <kbd>F1</kbd> this help.</td></tr>
</table>
<h3>Timing</h3>
<p>GCD actions share a 2.5s recast (faster with ${job.speedName.toLowerCase()}). Abilities are oGCDs: weave them between GCDs. Buttons queue like the game: a GCD queues in its last 0.5s or a cast's last 0.5s, and anything pressed during an animation lock waits for it. The queue keeps one GCD and two abilities in the order you pressed them. Without NoClippy or XivAlexander your ping sits on top of every animation lock and every caster tax, so set your real ping in Settings: that's what makes double weaves clip.</p>
${job.helpHtml(seq, ic)}
<p style="color:#a9a3b4">${B.GAME_ICONS || B.GAME_MODELS ? `${B.GAME_MODELS ? 'Icons, models and animations' : 'Icons'} are the game's own, read from your install. FINAL FANTASY XIV © SQUARE ENIX. This is a fan-made practice tool, not affiliated with Square Enix.` : 'Icons are drawn for this page, not taken from the game.'}</p>`;
    }

    buildSettings() {
      const st = () => this.app.store.settings;
      const e = this.e;
      const commit = () => { this.app.save(); this.app.applySettings(); this.showGcdInfo(); };
      const sps = $('#s-sps'), gcd = $('#s-gcd'), ping = $('#s-ping');
      const minGcd = e.gcdForSpeed(B.SPEED_MAX, e.job.tierHaste);
      const maxGcd = e.gcdForSpeed(e.lv.sub, e.job.tierHaste);
      // Each job keeps its own spell or skill speed.
      const getSpeed = () => this.speed();
      const setSpeed = (v) => { (st().speed = st().speed || {})[e.job.id] = v; };

      // Speed and GCD drive each other: type either one and the other follows.
      sps.addEventListener('input', () => {
        const v = parseInt(sps.value, 10);
        if (!(v >= e.lv.sub && v <= B.SPEED_MAX)) { $('#s-gcdinfo').textContent = `Enter ${e.lv.sub}–${B.SPEED_MAX}`; return; }
        setSpeed(v);
        gcd.value = e.gcdForSpeed(v, e.job.tierHaste).toFixed(2);
        commit();
      });
      sps.addEventListener('change', () => {
        setSpeed(Math.max(e.lv.sub, Math.min(B.SPEED_MAX, parseInt(sps.value, 10) || getSpeed())));
        sps.value = String(getSpeed());
        gcd.value = e.gcdForSpeed(getSpeed(), e.job.tierHaste).toFixed(2);
        commit();
      });
      // A GCD applies once it has two decimals (2.31), so half-typed values don't jump the speed.
      const setGcd = (v) => {
        setSpeed(e.speedForGcd(Math.max(minGcd, Math.min(maxGcd, v)), e.job.tierHaste));
        sps.value = String(getSpeed());
        commit();
      };
      gcd.addEventListener('input', () => {
        const raw = gcd.value.trim();
        const v = parseFloat(raw);
        if (!/^\d\.\d\d$/.test(raw)) return;
        if (!(v >= minGcd && v <= maxGcd)) { $('#s-gcdinfo').textContent = `Enter ${minGcd.toFixed(2)}–${maxGcd.toFixed(2)}`; return; }
        setGcd(v);
      });
      gcd.addEventListener('change', () => {
        const v = parseFloat(gcd.value);
        setGcd(Number.isFinite(v) ? v : e.gcdForSpeed(getSpeed(), e.job.tierHaste));
        gcd.value = e.gcdForSpeed(getSpeed(), e.job.tierHaste).toFixed(2);
      });

      ping.addEventListener('input', () => {
        const v = parseInt(ping.value, 10);
        if (!(v >= 0 && v <= B.PING_MAX)) { $('#s-lockinfo').textContent = `Enter 0–${B.PING_MAX}`; return; }
        st().ping = v;
        commit();
      });
      ping.addEventListener('change', () => {
        st().ping = Math.max(0, Math.min(B.PING_MAX, parseInt(ping.value, 10) || 0));
        ping.value = String(st().ping);
        commit();
      });
      $('#s-comp').addEventListener('change', () => { st().latencyComp = $('#s-comp').checked; commit(); });

      const bind = (id, key, conv, evt) => {
        const el = $(id);
        el.addEventListener(evt || 'change', () => {
          st()[key] = conv ? conv(el) : el.value;
          this.app.save();
          this.app.applySettings();
        });
      };
      bind('#s-name', 'name', el => el.value.trim().slice(0, 24) || 'Warrior of Light', 'input');
      bind('#s-pull', 'pullLength', el => parseInt(el.value, 10));
      bind('#s-cd', 'countdown', el => parseInt(el.value, 10));
      bind('#s-vol', 'volume', el => parseFloat(el.value), 'input');
      bind('#s-mpcost', 'showMpCost', el => el.checked);
      bind('#s-slide', 'slidecastMarker', el => el.checked);
      bind('#s-timeline', 'showTimeline', el => el.checked);
      bind('#s-models', 'gameModels', el => el.checked);
      bind('#s-map', 'gameMap', el => el.checked);
      const maps = B.gameMaps ? B.gameMaps() : {};
      $('#s-loc').innerHTML = Object.entries(maps).map(([k, m]) => `<option value="${k}">${esc(m.label || m.name)}</option>`).join('')
        || '<option value="pier">The dusk training ground</option>';
      $('#s-loc').addEventListener('change', () => this.app.setLocation($('#s-loc').value));
      bind('#s-follow', 'cameraFollow', el => el.checked);
      bind('#s-lock', 'lockCursor', el => el.checked);
      bind('#s-mouse', 'mouseSpeed', el => parseFloat(el.value), 'input');
      const dummies = (B.GAME_MODELS && B.GAME_MODELS.dummies) || {};
      $('#s-dummy').innerHTML = Object.entries(dummies).map(([k, d]) => `<option value="${k}">${esc(d.label)} Striking Dummy</option>`).join('')
        || '<option value="">Drawn (no game models exported)</option>';
      bind('#s-dummy', 'dummy');
      bind('#s-dummies', 'dummies', el => parseInt(el.value, 10));
      $('#s-resetbars').addEventListener('click', () => this.app.resetLayout());
      $('#s-debug').addEventListener('click', () => this.app.debug.copy());
      $('#debug-copy').addEventListener('click', () => this.app.debug.copy());
    }

    fillSettings() {
      const s = this.app.store.settings;
      $('#s-name').value = s.name;
      $('#s-sps-label').textContent = this.e.job.speedName;
      $('#s-sps').value = String(this.speed());
      $('#s-gcd').value = this.e.gcdForSpeed(this.speed(), this.e.job.tierHaste).toFixed(2);
      $('#s-ping').value = String(s.ping);
      $('#s-comp').checked = s.latencyComp;
      this.showGcdInfo();
      $('#s-pull').value = String(s.pullLength);
      $('#s-cd').value = String(s.countdown);
      $('#s-vol').value = String(s.volume);
      $('#s-mpcost').checked = s.showMpCost;
      $('#s-slide').checked = s.slidecastMarker;
      $('#s-timeline').checked = s.showTimeline;
      $('#s-models').checked = s.gameModels;
      $('#s-map').checked = s.gameMap;
      $('#s-map').disabled = !(window.THREE && B.gameMaps && B.gameMaps().pier);
      $('#s-loc').value = s.location || 'pier';
      $('#s-follow').checked = s.cameraFollow;
      $('#s-lock').checked = s.lockCursor;
      $('#s-mouse').value = String(s.mouseSpeed);
      $('#s-models').disabled = !(B.GAME_MODELS && window.THREE);
      $('#s-dummy').value = s.dummy;
      $('#s-dummies').value = String(s.dummies || 1);
    }

    speed() {
      const e = this.e;
      return (this.app.store.settings.speed || {})[e.job.id] || e.job.stats.speed;
    }

    showGcdInfo() {
      const e = this.e;
      $('#s-gcdinfo').textContent = e.job.speedInfo ? e.job.speedInfo(e) : '';
      $('#s-lockinfo').textContent = `Abilities lock ${e.animLock(0, true).toFixed(2)}s · casts add ${e.casterTax(true).toFixed(2)}s`;
    }

    // The Job window: every job, and under it each game version it can be played as.
    // The job window: each playable job with its versions and how players remember them, a history strip of every
    // version the job has had (coloured by rating, playable ones marked), and the jobs still to come.
    buildJobs() {
      const cur = this.e.job, H = B.JOB_HISTORY || {};
      const ROLE = { caster: 'Magical ranged DPS', melee: 'Melee DPS', tank: 'Tank', healer: 'Healer', ranged: 'Physical ranged DPS', limited: 'Limited job' };
      const TIER = { 5: 'Most missed', 4: 'Well liked', 3: 'Mixed', 2: 'Unpopular', 1: 'Panned' };
      const t0 = Date.parse('2013-08-27'), t1 = Date.now();
      const x = (t) => (Math.max(0, Math.min(1, (t - t0) / (t1 - t0))) * 100).toFixed(2);
      const pips = (r) => `<span class="pips r${r}" aria-label="${r} of 5">${[1, 2, 3, 4, 5].map(i => `<i${i <= r ? ' class="on"' : ''}></i>`).join('')}</span>`;
      const find = (id, label) => ((H[id] || {}).versions || []).find(h => h.label === label);
      const strip = (id, playable) => {
        const h = H[id];
        if (!h) return '';
        const segs = h.versions.map(v => {
          const a = Date.parse(v.start), b = v.end ? Date.parse(v.end) + 864e5 : t1;
          const here = playable.includes(v.label);
          return `<i class="seg r${v.rating}${here ? ' here' : ''}" style="left:${x(a)}%;width:${(x(b) - x(a))}%" title="${esc(v.label)} · ${v.rating}/5 ${TIER[v.rating]}${here ? ' · playable here' : ''}\n${esc(v.why)}"></i>`;
        }).join('');
        const ticks = [['ARR', '2013-08-27'], ['HW', '2015-06-23'], ['SB', '2017-06-20'], ['ShB', '2019-07-02'], ['EW', '2021-12-07'], ['DT', '2024-07-02']]
          .map(([k, d]) => `<span style="left:${x(Date.parse(d))}%">${k}</span>`).join('');
        return `<div class="hstrip"><div class="htrack">${segs}</div><div class="hticks">${ticks}</div></div>`;
      };

      const view = this.app.store.settings.jobView === 'condensed' ? 'condensed' : 'expanded';
      let html = `<div class="jobviews">${[['expanded', 'Expanded'], ['condensed', 'Condensed']].map(([k, t]) =>
        `<button data-view="${k}"${k === view ? ' class="on"' : ''}>${t}</button>`).join('')}</div>`;
      html += '<div class="jobnote">Pick a job, then the version of the game to play it as. Each version keeps its own hotbars. Ratings are how players remember each version: 5 most missed, 4 well liked, 3 mixed, 2 unpopular, 1 panned.</div>';
      if (view === 'condensed') html += this.condensedJobs(cur, find, TIER);
      else html += this.expandedJobs(cur, find, TIER, ROLE, pips, strip);
      const later = Object.keys(H).filter(id => !B.JOBS[id]);
      if (later.length && view === 'expanded') {
        html += '<div class="jobnote">Not in the sim yet. Hover a stripe for that version and its rating.</div><div class="laterlist">';
        for (const id of later) {
          const h = H[id], best = Math.max(...h.versions.map(v => v.rating));
          const fav = h.versions.filter(v => v.rating === best).map(v => v.label);
          html += `<div class="later"><div class="lh"><b>${esc(h.name)}</b><small>${ROLE[h.role] || ''} · ${h.versions.length} versions · fondest: ${esc(fav.length > 2 ? fav[0] + ' +' + (fav.length - 1) : fav.join(', '))}</small></div>${strip(id, [])}</div>`;
        }
        html += '</div>';
      }
      const list = $('#joblist');
      list.innerHTML = html;
      $('#win-job').classList.toggle('condensed', view === 'condensed');
      list.querySelectorAll('[data-ver]').forEach(b => b.addEventListener('click', () => {
        this.closeWindows();
        if (b.dataset.job !== this.e.job.id || b.dataset.ver !== this.e.job.version) this.app.switchJob(b.dataset.job, b.dataset.ver);
      }));
      list.querySelectorAll('.jobviews button').forEach(b => b.addEventListener('click', () => {
        this.app.store.settings.jobView = b.dataset.view;
        this.app.save();
        this.buildJobs();
      }));
    }

    // Expanded: a card per job, with its history strip and each version's note and what players say about it.
    expandedJobs(cur, find, TIER, ROLE, pips, strip) {
      let html = '<div class="jobgrid">';
      for (const id of B.JOB_ORDER) {
        const def = B.JOBS[id];
        html += `<div class="jobcard${id === cur.id ? ' on' : ''}"><div class="jh"><img src="${B.jobIcon(id)}" alt=""><div><b>${esc(def.name)}</b><small>${esc(def.abbr)} · ${ROLE[def.role] || esc(def.role)}</small></div></div>`;
        html += strip(id, def.versions.map(v => v.history));
        for (const v of def.versions) {
          const on = id === cur.id && v.id === cur.version;
          const h = find(id, v.history);
          const rate = h ? `<span class="vr">${pips(h.rating)}<em class="r${h.rating}">${TIER[h.rating]}</em></span>` : '';
          html += `<button class="ver${on ? ' on' : ''}" data-job="${id}" data-ver="${v.id}"><span class="vh"><b>${esc(v.label)}</b>${rate}</span><small>${esc(v.note || '')}</small>${h ? `<small class="why">Players: ${esc(h.why)}</small>` : ''}</button>`;
        }
        html += '</div>';
      }
      return html + '</div>';
    }

    // Condensed: every job and version on one grid, a row per job (by role) and a column per expansion. Each version
    // is a chip coloured by its rating; hover it for the full name, the note and what players say.
    condensedJobs(cur, find, TIER) {
      const EXP = [['ARR', 'ARR', '2.x'], ['HW', 'HW', '3.x'], ['SB', 'SB', '4.x'], ['ShB', 'ShB', '5.x'], ['EW', 'EW', '6.x'], ['DT', 'DT', '7.x'], ['EC', 'Evercold', '8.0']];
      const MAJOR = { 2: 'ARR', 3: 'HW', 4: 'SB', 5: 'ShB', 6: 'EW', 7: 'DT', 8: 'EC' };
      const GROUPS = [['Tanks', ['pld', 'war', 'drk', 'gnb'], 'tank'], ['Healers', ['whm', 'sch', 'ast', 'sge'], 'healer'],
        ['Melee DPS', ['mnk', 'drg', 'nin', 'sam', 'rpr', 'vpr'], 'melee'], ['Physical ranged DPS', ['brd', 'mch', 'dnc'], 'ranged'],
        ['Magical ranged DPS', ['blm', 'smn', 'rdm', 'pct'], 'caster'], ['Limited job', ['blu'], 'limited']];
      // A version's expansion: its history label's prefix (DT 7.1–7.57), or the major patch it starts in (Blue Mage's caps).
      const expOf = (v) => {
        const p = String(v.history || '').split(' ')[0];
        if (EXP.some(x => x[0] === p)) return p;
        const m = String(v.history || v.label).match(/(\d)\.\d/);
        return m ? MAJOR[m[1]] : 'DT';
      };
      const chipText = (v, exp) => exp === 'EC' ? 'Evolved' : /^Cap \d+/.test(v.history || '') ? v.history.match(/^Cap \d+/)[0]
        : String(v.history || v.label).replace(/^\S+\s+/, '');
      const placed = new Set();
      const rows = GROUPS.map(([name, ids, role]) => {
        const extra = B.JOB_ORDER.filter(id => !GROUPS.some(g => g[1].includes(id)) && (B.JOBS[id].role === role));
        return [name, [...ids, ...extra].filter(id => B.JOBS[id] && !placed.has(id) && placed.add(id))];
      }).filter(([, ids]) => ids.length);
      let html = '<div class="jobmatrix"><table><thead><tr><th></th>' +
        EXP.map(([, t, n]) => `<th>${t}<small>${n}</small></th>`).join('') + '</tr></thead><tbody>';
      for (const [group, ids] of rows) {
        html += `<tr class="jg"><th colspan="${EXP.length + 1}">${group}</th></tr>`;
        for (const id of ids) {
          const def = B.JOBS[id];
          html += `<tr${id === cur.id ? ' class="on"' : ''}><th><img src="${B.jobIcon(id)}" alt=""><span><b>${esc(def.abbr)}</b><small>${esc(def.name)}</small></span></th>`;
          for (const [exp] of EXP) {
            // Oldest first within an expansion, as the columns run.
            const vs = def.versions.filter(v => expOf(v) === exp).reverse();
            html += '<td>' + vs.map(v => {
              const h = find(id, v.history), on = id === cur.id && v.id === cur.version;
              const tip = `${def.name} · ${v.label}` + (h ? `\n${h.rating}/5 ${TIER[h.rating]}` : '') + (v.note ? `\n${v.note}` : '') + (h ? `\nPlayers: ${h.why}` : '');
              return `<button class="chip${h ? ' r' + h.rating : ' nr'}${on ? ' on' : ''}" data-job="${id}" data-ver="${v.id}" title="${esc(tip)}">${esc(chipText(v, exp))}</button>`;
            }).join('') + '</td>';
          }
          html += '</tr>';
        }
      }
      html += '</tbody></table></div>';
      html += '<div class="jobnote jobkey">' + [5, 4, 3, 2, 1].map(r => `<span class="chip r${r}">${TIER[r]}</span>`).join('') +
        '<span class="chip nr">Preview</span><span class="chip on r5">Playing now</span></div>';
      return html;
    }

    // Everything on screen that depends on the job: hotbars, gauge, action list, help, settings labels.
    setJob() {
      $('#b-job-name').textContent = this.e.job.abbr;
      $('#party-ver').textContent = this.e.job.versionLabel;
      $('#party-lv').textContent = 'Lv' + this.e.level;
      $('#t-lv').textContent = 'Lv' + this.e.level;
      document.title = `${this.e.job.name} Dummy · ${this.e.job.versionLabel}`;
      this.statusEls = {}; this.tStatusEls = {};
      $('#buffs').innerHTML = ''; $('#tdebuffs').innerHTML = '';
      $('#party-job').src = B.jobIcon();
      this.buildGauge();
      this.refreshBars();
      this.buildActions();
      this.buildHelp();
      this.fillSettings();
      this.updateMeter(true);
    }

    update(hpK) {
      this.updateBars();
      this.updateGauge();
      this.updateStatuses();
      this.updateCastBar();
      this.updateParams();
      this.updateTarget(hpK);
      this.updateMeter();
    }
  }

  B.UI = UI;
})(window.BLM);
