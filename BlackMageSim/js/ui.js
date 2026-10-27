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

  function kindLabel(a) {
    if (a.kind === 'item') return 'Item';
    if (a.kind === 'ogcd') return a.role ? 'Ability (Role Action)' : 'Ability';
    return 'Spell';
  }

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
        if (a.kind === 'gcd') {
          rem = e.gcdEnd - now; total = e.gcdLen;
        } else {
          const c = e.cds[rid];
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
        recast = e.speedScale(2.5).toFixed(2) + 's';
        mp = id === 'despair' ? '800+' : a.mp ? String(a.mp) : '0';
      } else {
        cast = 'Instant';
        recast = a.recast + 's';
      }
      tip.innerHTML = `<div class="t1"><img src="${B.icon(id)}" alt=""><div><b>${esc(a.name)}</b><small>${kindLabel(a)}${a.target ? ' · Range 25y' : ''}</small></div></div>` +
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
      const hpK = e.hp / e.maxHp, mpK = e.mp / B.MAX_MP;
      const c = this.pc || (this.pc = {});
      const put = (k, v, fn) => { if (c[k] !== v) { c[k] = v; fn(v); } };
      put('hp', e.hp, v => { $('#p-hp').textContent = fmt(v); $('#party-hpn').textContent = fmt(v); });
      put('mp', e.mp, v => { $('#p-mp').textContent = String(Math.floor(v)); $('#party-mpn').textContent = String(Math.floor(v)); });
      put('hpk', hpK, v => { $('#p-hpbar').style.transform = `scaleX(${v})`; $('#party-hp').style.transform = `scaleX(${v})`; });
      put('mpk', mpK, v => { $('#p-mpbar').style.transform = `scaleX(${v})`; $('#party-mp').style.transform = `scaleX(${v})`; });
      put('name', this.app.store.settings.name, v => { $('#party-name').textContent = v; });

      // MP tick timer: fills over the 3s server tick, labelled with what the tick will give.
      const left = Math.max(0, e.mpTickNext - e.now);
      $('#p-tick').style.transform = `scaleX(${(1 - left / 3).toFixed(3)})`;
      const gain = e.mpTickGain();
      const note = e.job.mpTickNote ? e.job.mpTickNote(e) : null;
      const af = !!note;
      const txt = note ? `tick ${left.toFixed(1)}s · ${note}` : `+${gain} in ${left.toFixed(1)}s`;
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
        m.innerHTML = `<div class="hd"><span>Striking Dummy</span><b>00:00</b></div>` +
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
      m.innerHTML = `<div class="hd"><span>${enc.end ? 'Last pull' : 'Striking Dummy'}</span><b>${mm}:${ss}</b></div>` +
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
      document.querySelectorAll('.win.show').forEach(w => { w.classList.remove('show'); any = true; });
      return any;
    }
    anyWindow() { return !!document.querySelector('.win.show'); }

    showResults(enc) {
      const EA = (enc && enc.actions) || A;
      const now = this.e.now;
      const dur = enc.duration(now);
      const dps = enc.total / dur;
      const mm = Math.floor(dur / 60) + ':' + String(Math.floor(dur % 60)).padStart(2, '0');
      $('#res-title').textContent = `Pull ${enc.n} · Striking Dummy`;
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

    buildActions() {
      const groups = this.e.job.actionGroups;
      let html = '<div style="color:#a9a3b4;font-size:13.5px;margin-bottom:10px">Drag an action onto a hotbar slot. Drag a slot onto another to swap them, or off the bars to clear it.</div>';
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
<tr><td>Hotbars</td><td>Keys <kbd>1</kbd>–<kbd>=</kbd>, <kbd>Shift</kbd>+<kbd>1</kbd>–<kbd>=</kbd>, and <kbd>Q</kbd> <kbd>E</kbd> <kbd>R</kbd> <kbd>F</kbd> … for bar 3, or click a slot. Rebind with <kbd>K</kbd>.</td></tr>
<tr><td>Move</td><td><kbd>W</kbd> <kbd>A</kbd> <kbd>S</kbd> <kbd>D</kbd> (or arrow keys). <kbd>Space</kbd> jumps. Moving or jumping cancels a cast, except in the last 0.5s (the blue line on the cast bar): that's slidecasting.</td></tr>
<tr><td>Camera</td><td>Hold the right mouse button and drag to turn the camera and your character: while it's held, <kbd>A</kbd> <kbd>D</kbd> strafe and <kbd>S</kbd> backpedals at walking pace. Drag with the left button to turn just the camera. Hold both buttons to run forward. The wheel zooms.</td></tr>
<tr><td>Target</td><td><kbd>Tab</kbd> or click the dummy. <kbd>Esc</kbd> closes windows, then clears your target.</td></tr>
<tr><td>Chat</td><td><kbd>Enter</kbd> to type. <code>/countdown 15</code> (or <code>/cd</code>), <code>/reset</code>, <code>/help</code>.</td></tr>
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
      const maxGcd = e.gcdForSpeed(B.SPEED_MIN, e.job.tierHaste);
      // Each job keeps its own spell or skill speed.
      const getSpeed = () => this.speed();
      const setSpeed = (v) => { (st().speed = st().speed || {})[e.job.id] = v; };

      // Speed and GCD drive each other: type either one and the other follows.
      sps.addEventListener('input', () => {
        const v = parseInt(sps.value, 10);
        if (!(v >= B.SPEED_MIN && v <= B.SPEED_MAX)) { $('#s-gcdinfo').textContent = `Enter ${B.SPEED_MIN}–${B.SPEED_MAX}`; return; }
        setSpeed(v);
        gcd.value = e.gcdForSpeed(v, e.job.tierHaste).toFixed(2);
        commit();
      });
      sps.addEventListener('change', () => {
        setSpeed(Math.max(B.SPEED_MIN, Math.min(B.SPEED_MAX, parseInt(sps.value, 10) || getSpeed())));
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
      bind('#s-follow', 'cameraFollow', el => el.checked);
      bind('#s-mouse', 'mouseSpeed', el => parseFloat(el.value), 'input');
      const dummies = (B.GAME_MODELS && B.GAME_MODELS.dummies) || {};
      $('#s-dummy').innerHTML = Object.entries(dummies).map(([k, d]) => `<option value="${k}">${esc(d.label)} Striking Dummy</option>`).join('')
        || '<option value="">Drawn (no game models exported)</option>';
      bind('#s-dummy', 'dummy');
      $('#s-resetbars').addEventListener('click', () => this.app.resetLayout());
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
      $('#s-follow').checked = s.cameraFollow;
      $('#s-mouse').value = String(s.mouseSpeed);
      $('#s-models').disabled = !(B.GAME_MODELS && window.THREE);
      $('#s-dummy').value = s.dummy;
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
    buildJobs() {
      const cur = this.e.job;
      let html = '<div class="jobnote">Pick a job, then the version of the game to play it as. Each version keeps its own hotbars.</div><div class="jobgrid">';
      for (const id of B.JOB_ORDER) {
        const def = B.JOBS[id];
        html += `<div class="jobcard${id === cur.id ? ' on' : ''}"><div class="jh"><img src="${B.jobIcon(id)}" alt=""><div><b>${esc(def.name)}</b><small>${esc(def.abbr)} · ${{ caster: 'Magical ranged DPS', melee: 'Melee DPS', tank: 'Tank', healer: 'Healer', ranged: 'Physical ranged DPS' }[def.role] || esc(def.role)}</small></div></div>`;
        for (const v of def.versions) {
          const on = id === cur.id && v.id === cur.version;
          html += `<button class="ver${on ? ' on' : ''}" data-job="${id}" data-ver="${v.id}"><b>${esc(v.label)}</b><small>${esc(v.note || '')}</small></button>`;
        }
        html += '</div>';
      }
      html += '</div><div class="jobnote">More jobs and expansions slot in here as they\'re added.</div>';
      $('#joblist').innerHTML = html;
      $('#joblist').querySelectorAll('button.ver').forEach(b => b.addEventListener('click', () => {
        this.closeWindows();
        if (b.dataset.job !== this.e.job.id || b.dataset.ver !== this.e.job.version) this.app.switchJob(b.dataset.job, b.dataset.ver);
      }));
    }

    // Everything on screen that depends on the job: hotbars, gauge, action list, help, settings labels.
    setJob() {
      $('#b-job-name').textContent = this.e.job.abbr;
      $('#party-ver').textContent = this.e.job.versionLabel;
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
