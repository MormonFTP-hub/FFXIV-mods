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
      $('#party-job').src = B.jobIcon();
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
      const { bars, binds } = this.app.store;
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
        const proc = (rid === 'fire3' && e.has('firestarter')) || (rid === 'thunder3' && e.has('thundercloud')) || rid === 'paradox';
        this.set(s, 'proc', proc, v => s.el.classList.toggle('proc', v));
        const q = !!(e.queued && e.queued.id === rid);
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

    // ---------- Elemental Gauge ----------
    buildGauge() {
      const C = 2 * Math.PI * 78;
      this.enoC = C;
      const heart = 'M0 6 C-10 -2 -9 -12 -3 -12 C-1 -12 0 -10 0 -9 C0 -10 1 -12 3 -12 C9 -12 10 -2 0 6 Z';
      const cryst = 'M0 -16 L8 -2 L0 16 L-8 -2 Z';
      $('#gauge').innerHTML = `
<svg width="360" height="220" viewBox="0 0 360 220">
  <defs>
    <radialGradient id="oAF" cx="45%" cy="38%" r="70%"><stop offset="0" stop-color="#ffe2a8"/><stop offset=".35" stop-color="#ff7a2a"/><stop offset="1" stop-color="#5a0b04"/></radialGradient>
    <radialGradient id="oUI" cx="45%" cy="38%" r="70%"><stop offset="0" stop-color="#eaffff"/><stop offset=".35" stop-color="#5fb8ff"/><stop offset="1" stop-color="#06204a"/></radialGradient>
    <radialGradient id="oNo" cx="45%" cy="38%" r="70%"><stop offset="0" stop-color="#5a5468"/><stop offset="1" stop-color="#121018"/></radialGradient>
    <linearGradient id="eno" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#f2d0ff"/><stop offset="1" stop-color="#8d3cff"/></linearGradient>
    <radialGradient id="poly" cx="50%" cy="35%" r="70%"><stop offset="0" stop-color="#fbe9ff"/><stop offset=".5" stop-color="#b860ff"/><stop offset="1" stop-color="#3d0a6e"/></radialGradient>
    <linearGradient id="para" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#ff7b7b"/><stop offset=".5" stop-color="#fff"/><stop offset="1" stop-color="#6fb8ff"/></linearGradient>
    <filter id="gl" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="3" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
  </defs>
  <path d="M110 18 L330 18 Q346 18 346 34 L346 184 Q346 200 330 200 L110 200" fill="rgba(14,12,20,.86)" stroke="rgba(255,255,255,.22)"/>
  <circle cx="110" cy="109" r="92" fill="#0b0912" stroke="rgba(230,196,122,.55)" stroke-width="2"/>
  <circle cx="110" cy="109" r="78" fill="none" stroke="#221b33" stroke-width="10"/>
  <circle id="g-eno" cx="110" cy="109" r="78" fill="none" stroke="url(#eno)" stroke-width="10" stroke-dasharray="0 ${C}" transform="rotate(-90 110 109)" filter="url(#gl)"/>
  <circle id="g-orb" cx="110" cy="109" r="64" fill="url(#oNo)" stroke="rgba(0,0,0,.8)" stroke-width="2"/>
  <g id="g-flame" opacity="0" transform="translate(110 100) scale(1.15)"><path d="M0 -38 C4 -26 18 -18 18 -2 C18 12 10 22 0 22 C-10 22 -18 12 -18 0 C-18 -10 -12 -14 -10 -22 C-7 -16 -5 -12 -3 -10 C-2 -20 -4 -28 0 -38 Z" fill="#fff4cf" opacity=".85"/></g>
  <g id="g-ice" opacity="0" transform="translate(110 100) scale(1.1)"><path d="M0 -38 L11 -6 L0 26 L-11 -6 Z" fill="#f2fdff" opacity=".9"/><path d="M-20 -14 L-11 -6 L-16 8 Z M20 -14 L11 -6 L16 8 Z" fill="#dff7ff" opacity=".7"/></g>
  <text id="g-time" class="eltime" x="110" y="122" text-anchor="middle"></text>
  ${[0, 1, 2].map(k => `<path id="g-stk${k}" d="M0 -10 L7 0 L0 10 L-7 0 Z" transform="translate(${82 + k * 28} ${k === 1 ? 187 : 182})" fill="#2a2535" stroke="rgba(0,0,0,.8)" stroke-width="1.5"/>`).join('')}
  ${[0, 1].map(k => `<g transform="translate(${226 + k * 36} 66)"><path id="g-poly${k}" d="${cryst}" fill="#251d33" stroke="rgba(255,255,255,.25)" stroke-width="1.5"/></g>`).join('')}
  <g transform="translate(314 66)"><rect id="g-para" x="-12" y="-12" width="24" height="24" transform="rotate(45)" fill="#251d33" stroke="rgba(255,255,255,.25)" stroke-width="1.5"/></g>
  ${[0, 1, 2].map(k => `<g transform="translate(${226 + k * 34} 152) scale(1.35)"><path id="g-ht${k}" d="${heart}" fill="#1c2233" stroke="rgba(255,255,255,.25)" stroke-width="1.1"/></g>`).join('')}
  <text x="244" y="104" text-anchor="middle" font-family="Noto Sans, sans-serif" font-size="11" font-weight="600" fill="#a9a3b4" letter-spacing="1">POLYGLOT</text>
  <text x="314" y="104" text-anchor="middle" font-family="Noto Sans, sans-serif" font-size="11" font-weight="600" fill="#a9a3b4" letter-spacing="1">PARADOX</text>
  <text x="260" y="186" text-anchor="middle" font-family="Noto Sans, sans-serif" font-size="11" font-weight="600" fill="#a9a3b4" letter-spacing="1">UMBRAL HEARTS</text>
</svg>`;
      this.g = {
        eno: $('#g-eno'), orb: $('#g-orb'), flame: $('#g-flame'), ice: $('#g-ice'), time: $('#g-time'),
        stk: [0, 1, 2].map(k => $('#g-stk' + k)), poly: [0, 1].map(k => $('#g-poly' + k)), para: $('#g-para'),
        ht: [0, 1, 2].map(k => $('#g-ht' + k)), cache: {},
      };
    }

    updateGauge() {
      const e = this.e, g = this.g, c = g.cache;
      const el = e.element;
      const put = (k, v, fn) => { if (c[k] !== v) { c[k] = v; fn(v); } };
      put('orb', el > 0 ? 'af' : el < 0 ? 'ui' : 'no', v => g.orb.setAttribute('fill', v === 'af' ? 'url(#oAF)' : v === 'ui' ? 'url(#oUI)' : 'url(#oNo)'));
      put('fl', el > 0 ? 1 : 0, v => g.flame.setAttribute('opacity', v * 0.95));
      put('ic', el < 0 ? 1 : 0, v => g.ice.setAttribute('opacity', v * 0.95));
      const left = el !== 0 ? Math.max(0, e.elementUntil - e.now) : 0;
      put('t', el !== 0 ? String(Math.ceil(left - 1e-6)) : '', v => { g.time.textContent = v; });
      put('tc', left > 0 && left < 4 ? 'warn' : 'ok', v => g.time.setAttribute('fill', v === 'warn' ? '#ffd36b' : '#fff'));
      for (let k = 0; k < 3; k++) {
        const on = Math.abs(el) > k;
        put('s' + k, on ? (el > 0 ? 'f' : 'i') : 'n', v => {
          g.stk[k].setAttribute('fill', v === 'f' ? '#ff6a3d' : v === 'i' ? '#6cc6ff' : '#2a2535');
          g.stk[k].setAttribute('filter', v === 'n' ? '' : 'url(#gl)');
        });
        put('h' + k, e.hearts > k, v => { g.ht[k].setAttribute('fill', v ? '#8fd8ff' : '#1c2233'); g.ht[k].setAttribute('filter', v ? 'url(#gl)' : ''); });
      }
      for (let k = 0; k < 2; k++) put('p' + k, e.polyglot > k, v => { g.poly[k].setAttribute('fill', v ? 'url(#poly)' : '#251d33'); g.poly[k].setAttribute('filter', v ? 'url(#gl)' : ''); });
      put('para', e.paradox, v => { g.para.setAttribute('fill', v ? 'url(#para)' : '#251d33'); g.para.setAttribute('filter', v ? 'url(#gl)' : ''); });
      const prog = e.enoStart !== null ? Math.min(1, (e.now - e.enoStart) / B.POLYGLOT_TIME) : 0;
      const dash = (prog * this.enoC).toFixed(1);
      put('eno', dash, v => g.eno.setAttribute('stroke-dasharray', `${v} ${this.enoC}`));
    }

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
        if (el._kv !== stk) { el._kv = stk; el._k.textContent = stk; }
      });
      for (const k of Object.keys(map)) if (!keep.has(k)) { map[k].remove(); delete map[k]; }
    }

    updateStatuses() {
      const e = this.e, now = e.now;
      const self = B.SELF_STATUS_ORDER.filter(k => e.statuses[k] && e.statuses[k].until > now).map(k => ({ key: k, s: e.statuses[k] }));
      this.syncStatusRow($('#buffs'), this.statusEls, self, now);
      const tl = ['thunder3', 'addle'].filter(k => e.tStatuses[k] && e.tStatuses[k].until > now).map(k => ({ key: k, s: e.tStatuses[k] }));
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
      let gain = 0;
      if (e.element <= 0) {
        gain = e.element < 0 ? B.UI_REGEN[-e.element - 1] : B.BASE_REGEN;
        if (e.has('lucidDreaming')) gain += B.LUCID_REGEN;
      }
      const af = e.element > 0;
      const txt = af ? `tick ${left.toFixed(1)}s · no regen in Astral Fire` : `+${gain} in ${left.toFixed(1)}s`;
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
          `<div class="row"><i style="transform:scaleX(0)"></i><div class="in"><img src="${B.jobIcon()}" alt=""><div class="who">${name}<small>BLM</small></div><div class="dps outline">0</div></div></div>` +
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
        `<div class="row"><i style="transform:scaleX(1)"></i><div class="in"><img src="${B.jobIcon()}" alt=""><div class="who">${name}<small>BLM · ${fmt(enc.total)} dmg</small></div><div class="dps outline" style="color:${color}">${fmt(dps)}</div></div></div>` +
        `<div class="sub"><div>Crit<b>${crit}%</b></div><div>Direct hit<b>${dh}%</b></div><div>GCD uptime<b>${enc.uptime(now).toFixed(1)}%</b></div></div>` +
        (max ? `<div class="maxhit">Max hit: ${esc(A[max.id].name)} <b>${fmt(max.amount)}${max.crit ? '!' : ''}${max.dh ? '!' : ''}</b></div>` : '') +
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
        html += `<tr><td><img src="${B.icon(id)}" alt="">${esc(A[id].name)}${r.dotHits ? ' <span style="color:#a9a3b4">(+DoT)</span>' : ''}</td>` +
          `<td>${casts[id] || 0}</td><td>${r.hits}</td><td>${fmt(r.total)}</td><td>${pct.toFixed(1)}<span class="pbar"><i style="width:${pct}%"></i></span></td>` +
          `<td>${fmt(r.total / r.hits)}</td><td>${(r.crits / r.hits * 100).toFixed(0)}</td><td>${(r.dhs / r.hits * 100).toFixed(0)}</td><td>${fmt(r.max)}</td></tr>`;
      }
      const ogcds = Object.entries(casts).filter(([id]) => A[id].kind !== 'gcd');
      if (ogcds.length) {
        html += `<tr><td colspan="9" style="padding-top:10px;color:#a9a3b4;font-size:12.5px">Abilities used: ` +
          ogcds.map(([id, n]) => `${esc(A[id].name)} ×${n}`).join(' · ') + (ints ? ` · Interrupted casts: ${ints}` : '') + `</td></tr>`;
      }
      html += '</tbody></table>';
      if (this.app.store.settings.showTimeline) html += this.timelineHtml(enc, now);
      $('#resbody').innerHTML = html;
      this.openWindow('win-results');
    }

    timelineHtml(enc, now) {
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
        if (A[u.id].kind === 'gcd') {
          if (u.cast) h += `<div class="castbar" style="left:${x}px;width:${(u.interrupted ? u.cut : u.cast) * pxs}px;${u.interrupted ? 'background:#c0392b' : ''}"></div>`;
          h += `<img src="${B.icon(u.id)}" title="${esc(A[u.id].name)} @ ${(u.t - enc.start).toFixed(2)}s" style="left:${x}px;top:22px;width:34px;height:34px;${u.interrupted ? 'opacity:.4' : ''}">`;
        } else {
          h += `<img src="${B.icon(u.id)}" title="${esc(A[u.id].name)} @ ${(u.t - enc.start).toFixed(2)}s" style="left:${x}px;top:66px;width:26px;height:26px">`;
        }
      }
      h += '</div></div><div class="tlhint">Top row: spells (gold line = cast time). Bottom row: abilities. Hover an icon for its time.</div>';
      return h;
    }

    buildActions() {
      const groups = [
        ['Black Mage', ['fire', 'fire3', 'fire4', 'despair', 'blizzard', 'blizzard3', 'blizzard4', 'thunder3', 'paradox', 'xenoglossy', 'foul', 'scathe', 'umbralSoul', 'transpose', 'sharpcast', 'triplecast', 'manafont', 'amplifier', 'leyLines', 'betweenTheLines', 'manaward']],
        ['Role Actions', ['swiftcast', 'lucidDreaming', 'addle', 'surecast']],
        ['General', ['sprint', 'tincture']],
      ];
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
      const ic = (id, og) => `<img class="${og ? 'og' : ''}" src="${B.icon(id)}" title="${esc(A[id].name)}" alt="${esc(A[id].name)}">`;
      const ar = '<span class="ar">›</span>';
      const seq = (items) => '<div class="seq">' + items.map(x => Array.isArray(x) ? ic(x[0], true) : ic(x)).join(ar) + '</div>';
      $('#helpbody').innerHTML = `
<h3>Controls</h3>
<table>
<tr><td>Hotbars</td><td>Keys <kbd>1</kbd>–<kbd>=</kbd>, <kbd>Shift</kbd>+<kbd>1</kbd>–<kbd>=</kbd>, and <kbd>Q</kbd> <kbd>E</kbd> <kbd>R</kbd> <kbd>F</kbd> … for bar 3, or click a slot. Rebind with <kbd>K</kbd>.</td></tr>
<tr><td>Move</td><td><kbd>W</kbd> <kbd>A</kbd> <kbd>S</kbd> <kbd>D</kbd> (or arrow keys). <kbd>Space</kbd> jumps. Moving or jumping cancels a cast, except in the last 0.5s (the blue line on the cast bar): that's slidecasting.</td></tr>
<tr><td>Target</td><td><kbd>Tab</kbd> or click the dummy. <kbd>Esc</kbd> closes windows, then clears your target.</td></tr>
<tr><td>Chat</td><td><kbd>Enter</kbd> to type. <code>/countdown 15</code> (or <code>/cd</code>), <code>/reset</code>, <code>/help</code>.</td></tr>
<tr><td>Windows</td><td><kbd>P</kbd> Actions &amp; Traits, <kbd>K</kbd> keybind mode, <kbd>F1</kbd> this help.</td></tr>
</table>

<h3>How it plays (Endwalker 6.5)</h3>
<p>Spells share a 2.5s GCD (faster with spell speed). Abilities like Triplecast and Manafont are oGCDs: weave them after instant spells. Press a button up to 0.5s early and it queues, like the game. Without NoClippy or XivAlexander your ping sits on top of every animation lock and every caster tax, so set your real ping in Settings: that's what makes double weaves clip. Fire spells cost double MP in Astral Fire unless you have Umbral Hearts. Astral Fire and Umbral Ice last 15s; let them drop and you lose Enochian (the 23% damage bonus) and the Polyglot timer resets. Every 30s in Enochian gives a Polyglot (max 2) for Xenoglossy.</p>
<p>Paradox lights up when you swap from Astral Fire III into ice, or from Umbral Ice III with 3 Umbral Hearts into fire. Fire and Blizzard become Paradox. In ice it's instant and free; in fire it refreshes Astral Fire and can proc Firestarter. Thunder III ticks can proc Thundercloud (instant Thunder III with the whole DoT added up front).</p>

<h3>Standard rotation</h3>
${seq(['blizzard3', 'blizzard4', 'paradox', 'fire3', 'fire4', 'fire4', 'fire4', 'paradox', 'fire4', 'fire4', 'fire4', 'despair'])}
<p>Keep Thunder III up (refresh around every 30s, ideally with Thundercloud), spend Polyglot on Xenoglossy before it overcaps, and use Sharpcast on Thunder III or Paradox. Manafont after Despair buys one more Fire IV and Despair.</p>

<h3>A typical 6.x opener</h3>
${seq(['sharpcast', 'fire3', 'thunder3', 'fire4', ['triplecast'], 'fire4', 'fire4', ['amplifier'], 'fire4', ['leyLines'], ['swiftcast'], 'despair', ['manafont'], 'fire4', 'despair', 'blizzard3', 'xenoglossy', 'paradox', 'blizzard4', 'fire3'])}
<p>Sharpcast about 15s before the pull, then start Fire III so it lands as the countdown ends (around −3.3s at 2.37). Use the Tincture around then too. Stand in Ley Lines for the 15% cast and GCD speed.</p>
<p style="color:#a9a3b4">Everything runs on the 6.5 numbers: Fire IV 310, Despair 340, Paradox 500, Xenoglossy 880, Thunder III 50 + 35 per tick for 30s, Astral Fire III ×1.8, Enochian ×1.23, Manafont +3000 MP, Umbral Ice III regen 6200 MP per tick. Icons are drawn for this page, not taken from the game.</p>`;
    }

    buildSettings() {
      const st = () => this.app.store.settings;
      const e = this.e;
      const commit = () => { this.app.save(); this.app.applySettings(); this.showGcdInfo(); };
      const sps = $('#s-sps'), gcd = $('#s-gcd'), ping = $('#s-ping');
      const minGcd = e.gcdForSps(B.SPS_MAX);

      // Spell speed and GCD drive each other: type either one and the other follows.
      sps.addEventListener('input', () => {
        const v = parseInt(sps.value, 10);
        if (!(v >= B.SPS_MIN && v <= B.SPS_MAX)) { $('#s-gcdinfo').textContent = `Enter ${B.SPS_MIN}–${B.SPS_MAX}`; return; }
        st().sps = v;
        gcd.value = e.gcdForSps(v).toFixed(2);
        commit();
      });
      sps.addEventListener('change', () => {
        st().sps = Math.max(B.SPS_MIN, Math.min(B.SPS_MAX, parseInt(sps.value, 10) || st().sps));
        sps.value = String(st().sps);
        gcd.value = e.gcdForSps(st().sps).toFixed(2);
        commit();
      });
      // A GCD applies once it has two decimals (2.31), so half-typed values don't jump the spell speed.
      const setGcd = (v) => {
        st().sps = e.spsForGcd(Math.max(minGcd, Math.min(2.5, v)));
        sps.value = String(st().sps);
        commit();
      };
      gcd.addEventListener('input', () => {
        const raw = gcd.value.trim();
        const v = parseFloat(raw);
        if (!/^\d\.\d\d$/.test(raw)) return;
        if (!(v >= minGcd && v <= 2.5)) { $('#s-gcdinfo').textContent = `Enter ${minGcd.toFixed(2)}–2.50`; return; }
        setGcd(v);
      });
      gcd.addEventListener('change', () => {
        const v = parseFloat(gcd.value);
        setGcd(Number.isFinite(v) ? v : e.gcdForSps(st().sps));
        gcd.value = e.gcdForSps(st().sps).toFixed(2);
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
      $('#s-resetbars').addEventListener('click', () => this.app.resetLayout());
    }

    fillSettings() {
      const s = this.app.store.settings;
      $('#s-name').value = s.name;
      $('#s-sps').value = String(s.sps);
      $('#s-gcd').value = this.e.gcdForSps(s.sps).toFixed(2);
      $('#s-ping').value = String(s.ping);
      $('#s-comp').checked = s.latencyComp;
      this.showGcdInfo();
      $('#s-pull').value = String(s.pullLength);
      $('#s-cd').value = String(s.countdown);
      $('#s-vol').value = String(s.volume);
      $('#s-mpcost').checked = s.showMpCost;
      $('#s-slide').checked = s.slidecastMarker;
      $('#s-timeline').checked = s.showTimeline;
    }

    showGcdInfo() {
      const e = this.e;
      $('#s-gcdinfo').textContent = `Fire IV ${e.speedScale(2.8).toFixed(2)}s · Despair ${e.speedScale(3).toFixed(2)}s · Fire III ${e.speedScale(3.5).toFixed(2)}s`;
      $('#s-lockinfo').textContent = `Abilities lock ${e.animLock(0, true).toFixed(2)}s · casts add ${e.casterTax(true).toFixed(2)}s`;
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
