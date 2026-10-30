// The HUD and panels: hotbar, target and player frames, the meter, and the class / build / stats panels.
(function () {
  'use strict';
  const A2 = window.A2 = window.A2 || {};
  const $ = (id) => document.getElementById(id);
  const esc = A2.esc;
  const KEYS1 = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '0', '-', '='];
  const KEYS2 = ['Q', 'E', 'F', 'Z', 'X', 'C', 'G', 'T'];

  const UI = A2.UI = {slots: [], keymap: {}};

  // --- toast --------------------------------------------------------------------------------
  let toastTimer = 0;
  A2.toast = function (msg) {
    const t = $('toast');
    t.textContent = msg;
    t.classList.add('on');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => t.classList.remove('on'), 2400);
  };

  // --- hotbar -------------------------------------------------------------------------------

  UI.buildHotbar = function (sim) {
    const bar = $('hotbar');
    bar.innerHTML = '';
    UI.slots = [];
    UI.keymap = {};
    const cls = sim.cls;
    const actives = cls.bar.filter((id) => sim.skills[id] && sim.skills[id].kind !== 'stigma');
    const stig = (sim.cfg.stigmas || []).filter((id) => sim.skills[id]);
    [[actives, KEYS1], [stig, KEYS2]].forEach(([ids, keys]) => {
      const row = document.createElement('div');
      row.className = 'hrow';
      ids.forEach((id, i) => {
        const s = sim.skills[id];
        const key = keys[i] || '';
        const b = document.createElement('button');
        b.className = 'slot';
        b.setAttribute('aria-label', `${s.name}${key ? ` (${key})` : ''}`);
        b.innerHTML = `<canvas class="ic"></canvas><canvas class="cd"></canvas><span class="k">${esc(key)}</span><span class="t"></span><span class="n"></span>`;
        row.appendChild(b);
        const slot = {id, b, ic: b.querySelector('.ic'), cd: b.querySelector('.cd'), t: b.querySelector('.t'), n: b.querySelector('.n'), last: ''};
        UI.slots.push(slot);
        if (key) UI.keymap[key.toLowerCase()] = id;
        b.addEventListener('pointerdown', (e) => { e.preventDefault(); A2.pressSkill(id); b.classList.add('press'); });
        b.addEventListener('pointerup', () => b.classList.remove('press'));
        b.addEventListener('pointerleave', () => { b.classList.remove('press'); UI.hideTip(); });
        b.addEventListener('pointerenter', (e) => { if (e.pointerType === 'mouse') UI.showTip(sim, id, b); });
        b.addEventListener('contextmenu', (e) => { e.preventDefault(); UI.showTip(sim, id, b); });
      });
      if (ids.length) bar.appendChild(row);
    });
    requestAnimationFrame(() => UI.slots.forEach((sl) => {
      const s = sim.skills[sl.id];
      A2.paintIcon(sl.ic, s.icon, s.hue, s.kind === 'stigma' ? 'stigma' : '');
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      sl.cd.width = sl.cd.height = Math.round((sl.cd.clientWidth || 56) * dpr);
    }));
  };

  function sweep(cv, frac, gold) {
    const c = cv.getContext('2d');
    const w = cv.width, h = cv.height;
    c.clearRect(0, 0, w, h);
    if (frac <= 0) return;
    c.fillStyle = gold ? 'rgba(230,187,106,0.0)' : 'rgba(5,8,18,0.72)';
    c.beginPath();
    c.moveTo(w / 2, h / 2);
    c.arc(w / 2, h / 2, w, -Math.PI / 2, -Math.PI / 2 + frac * Math.PI * 2);
    c.closePath();
    c.fill();
    if (gold) {
      c.strokeStyle = 'rgba(230,187,106,0.95)';
      c.lineWidth = w * 0.07;
      c.beginPath();
      c.arc(w / 2, h / 2, w * 0.42, -Math.PI / 2, -Math.PI / 2 + frac * Math.PI * 2);
      c.stroke();
    }
  }

  UI.updateHotbar = function (sim) {
    const p = sim.p;
    for (const sl of UI.slots) {
      const s = sim.skills[sl.id];
      const chk = sim.check(sl.id);
      const cdLeft = sim.cdLeft(sl.id);
      const u = p.uses[sl.id];
      const chained = u && u.left > 0 && u.until > sim.t;
      let cls = 'slot';
      let txt = '', frac = 0, gold = false;
      if (chained) {
        sl.n.textContent = u.left;
      } else sl.n.textContent = '';
      if (!chained && cdLeft > 0) {
        const full = sim.cdOf(s) || 1;
        frac = cdLeft / full;
        txt = cdLeft >= 1 ? Math.ceil(cdLeft) : cdLeft.toFixed(1);
      } else if (s.when) {
        const lit = chk.ok || (!chk.cond && !chk.cd);
        if (lit && s.procId !== false && p.procs[s.procId || sl.id]) {
          const left = p.procs[s.procId || sl.id] - sim.t;
          if (left > 0) { gold = true; frac = left / (s.procWindow || 6); }
        }
        if (chk.ok) cls += ' ready';
        else if (chk.cond) cls += ' locked';
      }
      if (chk.mp && !(cdLeft > 0)) cls += ' nomp';
      if (p.queue === sl.id) cls += ' queued';
      const key = cls + '|' + txt + '|' + frac.toFixed(2) + gold;
      if (key !== sl.last) {
        sl.last = key;
        sl.b.className = cls;
        sl.t.textContent = txt;
        sweep(sl.cd, frac, gold);
      }
    }
  };

  // --- tooltip ------------------------------------------------------------------------------

  UI.tipText = function (sim, id) {
    const s = sim.skills[id];
    const [base, atk] = sim.power(s);
    const cd = sim.cdOf(s);
    const meta = [s.kind === 'stigma' ? 'Stigma' : 'Active', `Lv ${s.level}`, cd ? `${+cd.toFixed(1)}s cooldown` : 'no cooldown',
                  sim.mpCost(s) ? `${sim.mpCost(s)} MP` : '', s.mpGain ? `restores ${s.mpGain} MP` : '', `${(s.range || 4) + (s.mods.range || 0)} m`,
                  s.cast ? `${s.cast}s cast` : '', s.moving || s.mods.mobile ? 'usable while moving' : ''].filter(Boolean).join(' · ');
    const dmg = s.noHit && !s.dmg ? '' : `<p>Deals <span class="num">${A2.int(base)} (+${+atk.toFixed(1)}% Attack)</span>` +
      ` = <span class="num">${A2.int(base + sim.stat('attack') * atk / 100)}</span> with your Attack${s.hits > 1 ? `, ${s.hits} hits` : ''}.</p>`;
    const specs = (s.specs || []).filter((sp, i) => s.specOn.indexOf(i) >= 0 && s.level >= sp.lv).map((sp) => sp.text);
    return `<h4>${esc(s.name)}</h4><div class="meta">${esc(meta)}</div>${dmg}<p>${esc(s.desc || '')}</p>` +
      (specs.length ? `<p class="dim">Specializations: ${esc(specs.join('; '))}</p>` : '');
  };

  UI.showTip = function (sim, id, anchor) {
    const tip = $('tip');
    tip.innerHTML = UI.tipText(sim, id);
    tip.hidden = false;
    const r = anchor.getBoundingClientRect();
    const tw = tip.offsetWidth, th = tip.offsetHeight;
    let x = r.left + r.width / 2 - tw / 2;
    x = Math.max(8, Math.min(window.innerWidth - tw - 8, x));
    tip.style.left = x + 'px';
    tip.style.top = Math.max(8, r.top - th - 8) + 'px';
    clearTimeout(UI.tipTimer);
    UI.tipTimer = setTimeout(UI.hideTip, 6000);
  };
  UI.hideTip = function () { $('tip').hidden = true; };

  // --- frames -------------------------------------------------------------------------------

  function chipHtml(list) {
    return list.map((b) => {
      const ic = A2.icon(b.icon || 'star', b.hue == null ? 40 : b.hue);
      return `<span class="chip${b.debuff ? ' debuff' : ''}" title="${esc(b.name)}"><img src="${ic.toDataURL()}" alt="">` +
        `${esc(b.short || b.name)}${b.stacks ? ` <b>${b.stacks}</b>` : ''}${b.left != null ? ` ${b.left < 10 ? b.left.toFixed(1) : Math.ceil(b.left)}s` : ''}</span>`;
    }).join('');
  }
  const iconUrl = {};
  function cachedChips(list) {
    // data URLs are costly; cache them per icon
    return list.map((b) => {
      const k = (b.icon || 'star') + '|' + (b.hue == null ? 40 : b.hue);
      if (!iconUrl[k]) iconUrl[k] = A2.icon(b.icon || 'star', b.hue == null ? 40 : b.hue).toDataURL();
      return `<span class="chip${b.debuff ? ' debuff' : ''}" title="${esc(b.name)}"><img src="${iconUrl[k]}" alt="">` +
        `${esc(b.short || b.name)}${b.stacks ? ` <b>${b.stacks}</b>` : ''}${b.left != null ? ` ${b.left < 10 ? b.left.toFixed(1) : Math.ceil(b.left)}s` : ''}</span>`;
    }).join('');
  }
  void chipHtml;

  let lastFrame = 0;
  UI.updateFrames = function (sim, now) {
    UI.updateHotbar(sim);
    if (now - lastFrame < 100) return;   // text frames ten times a second is plenty
    lastFrame = now;
    const p = sim.p, tg = sim.tg;
    $('t-hp').style.width = (tg.hp * 100).toFixed(1) + '%';
    $('t-pct').textContent = (tg.hp * 100).toFixed(tg.hp < 0.1 ? 1 : 0) + '%';
    const broken = sim.t < tg.brokenUntil;
    $('t-stg').style.width = (broken ? (tg.brokenUntil - sim.t) / A2.FORMULA.breakTime * 100 : tg.stg / A2.FORMULA.staggerMax * 100) + '%';
    $('t-stg').parentNode.classList.toggle('broken', broken);
    $('t-stg-n').textContent = broken ? `Broken ${(tg.brokenUntil - sim.t).toFixed(1)}s` : `Stagger ${Math.round(tg.stg)}%`;
    const debuffs = [];
    for (const id in tg.debuffs) {
      const d = tg.debuffs[id];
      if (d.until > sim.t && d.show !== false) debuffs.push({name: d.name || id, short: d.short, icon: d.icon, hue: d.hue, stacks: d.stacks > 1 || d.max ? d.stacks : 0, left: d.until - sim.t, debuff: true});
    }
    $('t-debuffs').innerHTML = cachedChips(debuffs);
    const buffs = [];
    for (const id in p.buffs) {
      const b = p.buffs[id];
      if (b.until > sim.t && b.show !== false) buffs.push({name: b.name || id, short: b.short, icon: b.icon, hue: b.hue, stacks: b.stacks > 1 ? b.stacks : 0, left: b.until - sim.t});
    }
    for (const id in p.procs) {
      if (p.procs[id] > sim.t && sim.skills[id]) buffs.push({name: sim.skills[id].name + ' ready', short: sim.skills[id].name, icon: sim.skills[id].icon, hue: sim.skills[id].hue, left: p.procs[id] - sim.t});
    }
    $('buffs').innerHTML = cachedChips(buffs);
    $('p-mp').style.width = (p.mp / sim.stats.mpMax * 100).toFixed(1) + '%';
    $('p-mp-n').textContent = `MP ${Math.round(p.mp)} / ${sim.stats.mpMax}`;
    // cast bar
    const cb = $('castbar');
    if (p.casting) {
      cb.hidden = false;
      $('cb-fill').style.width = ((sim.t - p.casting.start) / (p.casting.end - p.casting.start) * 100).toFixed(1) + '%';
      $('cb-name').textContent = sim.skills[p.casting.id].name;
    } else cb.hidden = true;
    UI.updateMeter(sim);
  };

  UI.updateMeter = function (sim) {
    const e = sim.elapsed();
    $('m-dps').textContent = A2.int(sim.dps());
    const len = sim.cfg.parseLen;
    $('m-time').textContent = len ? `${A2.clock(e)} / ${A2.clock(len)}` : A2.clock(e);
    let hits = 0, crits = 0, backs = 0;
    const rows = Object.values(sim.bySkill).sort((a, b) => b.dmg - a.dmg);
    for (const r of rows) { hits += r.hits; crits += r.crits; backs += r.backs; }
    $('m-total').textContent = `${A2.fmt(sim.total)} damage`;
    $('m-crit').textContent = `crit ${hits ? Math.round(crits / hits * 100) : 0}%`;
    $('m-back').textContent = `back ${hits ? Math.round(backs / hits * 100) : 0}%`;
    const top = rows.length ? rows[0].dmg : 1;
    $('m-bars').innerHTML = rows.map((r) => `<div class="mrow" style="--w:${(r.dmg / top * 100).toFixed(1)}%"><span>${esc(r.name)}</span>` +
      `<span>${A2.fmt(r.dmg)}</span><span class="pc">${sim.total ? (r.dmg / sim.total * 100).toFixed(1) : 0}%</span></div>`).join('');
  };

  UI.parseText = function (sim) {
    const rows = Object.values(sim.bySkill).sort((a, b) => b.dmg - a.dmg);
    const st = sim.stats;
    const lines = [`AION 2 dummy parse (fan sim, not the game) — ${sim.cls.name}, ${A2.clock(sim.elapsed())}`,
      `${A2.int(sim.dps())} DPS · ${A2.int(sim.total)} damage`,
      `Attack ${st.attack}, Critical Hit ${st.critHit} (${Math.round(sim.critChance() * 100)}%), skills Lv ${sim.cfg.lvActive} / passives Lv ${sim.lvP} / stigmas Lv ${sim.cfg.lvStigma}`,
      `Stigmas: ${(sim.cfg.stigmas || []).map((id) => sim.skills[id] && sim.skills[id].name).filter(Boolean).join(', ') || 'none'}`, ''];
    for (const r of rows) lines.push(`${r.name}: ${A2.int(r.dmg)} (${(r.dmg / sim.total * 100).toFixed(1)}%), ${r.hits} hits, ${Math.round(r.crits / r.hits * 100)}% crit`);
    return lines.join('\n');
  };

  // --- panels -------------------------------------------------------------------------------

  UI.open = function (id) {
    document.querySelectorAll('.sheet').forEach((el) => { el.hidden = el.id !== id || !el.hidden; });
    const el = $(id);
    if (!el.hidden && id === 'board-panel' && A2.Board) A2.Board.render();
    if (!el.hidden) { const f = el.querySelector('input,select,button:not(.close)'); if (f && window.matchMedia('(pointer:fine)').matches) f.focus({preventScroll: true}); }
  };
  UI.closeAll = function () {
    let any = false;
    document.querySelectorAll('.sheet').forEach((el) => { if (!el.hidden) any = true; el.hidden = true; });
    return any;
  };
  UI.anyOpen = () => Array.from(document.querySelectorAll('.sheet')).some((el) => !el.hidden);

  UI.renderClasses = function (current, onPick) {
    const box = $('class-list');
    box.innerHTML = '';
    for (const cls of A2.CLASSES) {
      const b = document.createElement('button');
      b.className = 'cls-card' + (cls.id === current ? ' on' : '');
      b.innerHTML = `<canvas></canvas><span><b>${esc(cls.name)}</b><small>${esc(cls.role)}</small><small>${esc(cls.blurb || '')}</small></span>`;
      b.addEventListener('click', () => onPick(cls.id));
      box.appendChild(b);
      requestAnimationFrame(() => A2.paintIcon(b.querySelector('canvas'), cls.icon, cls.hue, 'stigma'));
    }
  };

  UI.renderBuild = function (sim, cfg, onChange) {
    const cls = sim.cls;
    $('lv-active').value = cfg.lvActive;
    $('lv-active-n').textContent = cfg.lvActive;
    $('lv-stigma').value = cfg.lvStigma;
    $('lv-stigma-n').textContent = cfg.lvStigma;
    $('lv-passive').value = cfg.lvPassive || cfg.lvActive;
    $('lv-passive-n').textContent = cfg.lvPassive || cfg.lvActive;
    const max = cls.stigmaSlots || 4;
    const chosen = cfg.stigmas || [];
    $('stig-count').textContent = `${chosen.length} of ${max}`;
    const box = $('stigma-list');
    box.innerHTML = '';
    for (const id in cls.skills) {
      const s = cls.skills[id];
      if (s.kind !== 'stigma') continue;
      const on = chosen.indexOf(id) >= 0;
      const b = document.createElement('button');
      b.className = 'pick' + (on ? ' on' : '');
      b.setAttribute('aria-pressed', on);
      b.innerHTML = `<canvas></canvas><span>${esc(s.name)}<small>${esc(s.short || '')}</small></span>`;
      b.addEventListener('click', () => {
        let list = chosen.slice();
        if (on) list = list.filter((x) => x !== id);
        else if (list.length < max) list.push(id);
        else { A2.toast(`${max} stigmas at most. Take one off first.`); return; }
        onChange({stigmas: list});
      });
      box.appendChild(b);
      requestAnimationFrame(() => A2.paintIcon(b.querySelector('canvas'), s.icon, s.hue, 'stigma'));
    }
    const sl = $('spec-list');
    sl.innerHTML = '';
    const ids = cls.bar.concat(chosen).filter((id, i, a) => a.indexOf(id) === i && cls.skills[id] && (cls.skills[id].specs || []).length);
    for (const id of ids) {
      const s = sim.skills[id];
      const stig = s.kind === 'stigma';
      const th = [8, 12, 20];
      const slots = th.filter((x) => s.level >= x).length;
      const on = (cfg.specs && cfg.specs[id]) || [];
      const div = document.createElement('div');
      div.className = 'spec';
      div.innerHTML = `<h4><canvas></canvas>${esc(s.name)}<small>${stig ? 'on by themselves as it levels' : `${on.filter((i) => s.specs[i] && s.level >= s.specs[i].lv).length} of ${slots} slots`}</small></h4><div class="opts"></div>`;
      const opts = div.querySelector('.opts');
      s.specs.forEach((sp, i) => {
        const can = s.level >= sp.lv;
        const lab = document.createElement('label');
        const inert = !sp.mod && !sp.hook;
        const rare = /rare stigma/.test(sp.text);
        const auto = stig && !rare;
        lab.className = (!can || inert) ? 'off' : '';
        const checked = auto ? can : on.indexOf(i) >= 0;
        lab.innerHTML = `<input type="checkbox" ${checked ? 'checked' : ''} ${can && !inert && !auto ? '' : 'disabled'}><i>${rare ? 'Item' : `Lv ${sp.lv}`}</i><span>${esc(sp.text)}${inert ? ' (does nothing on a dummy)' : ''}</span>`;
        lab.querySelector('input').addEventListener('change', (e) => {
          let list = on.slice();
          if (e.target.checked) {
            if (!stig && list.filter((k) => s.specs[k] && s.level >= s.specs[k].lv).length >= slots) {
              e.target.checked = false;
              A2.toast(slots ? `${s.name} has ${slots} specialization ${slots === 1 ? 'slot' : 'slots'} at Lv ${s.level}.` : `${s.name} opens its first specialization slot at Lv ${th[0]}.`);
              return;
            }
            list.push(i);
          } else list = list.filter((k) => k !== i);
          onChange({specs: Object.assign({}, cfg.specs, {[id]: list})});
        });
        opts.appendChild(lab);
      });
      sl.appendChild(div);
      requestAnimationFrame(() => A2.paintIcon(div.querySelector('canvas'), s.icon, s.hue, s.kind === 'stigma' ? 'stigma' : ''));
    }
  };

  const STAT_FIELDS = [
    ['attack', 'Attack', ''],
    ['critHit', 'Critical Hit', ''],
    ['critCap', 'Critical Hit rate cap', '% (50 Global, 80 Korea)'],
    ['critDmg', 'Critical Damage Boost', '%'],
    ['dmgBoost', 'Damage Boost', '%'],
    ['pveBoost', 'PvE Damage Boost', '%'],
    ['backBoost', 'Back Attack Damage Boost', '%'],
    ['frontBoost', 'Front Attack Damage Boost', '%'],
    ['double', 'Double Chance', '% (a Double hits ×2)'],
    ['multiHit', 'Multi-Hit Chance', '% (extra 10% strikes)'],
    ['combatSpeed', 'Combat Speed', '%'],
    ['cdr', 'Cooldown Reduction', '%'],
    ['mpMax', 'Max MP', ''],
  ];

  UI.renderStats = function (sim, cfg, onChange) {
    const pre = $('presets');
    pre.innerHTML = '';
    for (const [name, stats] of Object.entries(A2.PRESETS)) {
      const b = document.createElement('button');
      b.textContent = name;
      b.addEventListener('click', () => onChange({stats: Object.assign({}, stats)}));
      pre.appendChild(b);
    }
    const f = $('stats-form');
    f.innerHTML = STAT_FIELDS.map(([k, label, unit]) => `<label for="st-${k}">${esc(label)}${unit ? ` <small>${esc(unit)}</small>` : ''}` +
      `<input id="st-${k}" type="number" inputmode="decimal" step="any" value="${cfg.stats[k] == null ? 0 : cfg.stats[k]}" data-k="${k}">` +
      (k === 'critHit' ? `<small id="st-critpct">${Math.round(sim.critChance() * 100)}% critical rate with your passives</small>` : '') + `</label>`).join('');
    f.querySelectorAll('input').forEach((inp) => inp.addEventListener('change', () => {
      const v = parseFloat(inp.value);
      onChange({stats: Object.assign({}, cfg.stats, {[inp.dataset.k]: isFinite(v) ? v : 0})});
    }));
    const d = $('dummy-form');
    d.innerHTML = `<label for="dm-kind">Dummy<select id="dm-kind"><option value="boss">Boss (status immune)</option><option value="field">Field monster (can be stunned)</option></select></label>` +
      `<label for="dm-red">Boss damage resistance <small>% (scarecrow about 10, bosses 30-65)</small><input id="dm-red" type="number" step="any" value="${cfg.dummy.reduction || 0}"></label>` +
      `<label for="dm-hp">Dummy HP<select id="dm-hp"><option value="fight">Drains over the parse</option><option value="fixed">Stays at 100%</option></select></label>` +
      `<label for="dm-stg">Stagger gauge<select id="dm-stg"><option value="solo">Solo (breaks about once a minute)</option><option value="party">A party's worth (breaks often)</option><option value="off">Never breaks (like a scarecrow)</option></select></label>` +
      `<label for="dm-dot">Damage-over-time tooltips<select id="dm-dot"><option value="total">The number is the whole effect</option><option value="tick">The number is every tick</option></select>` +
      `<small>The tooltips say "every 1s"; read per tick, the Cleric's DoT stigmas would out-damage every class, so the sim splits the number across the ticks.</small></label>`;
    $('dm-kind').value = cfg.dummy.kind;
    $('dm-hp').value = cfg.dummy.hpMode;
    $('dm-stg').value = cfg.dummy.stagger || 'solo';
    $('dm-dot').value = cfg.dummy.dotMode || 'total';
    const upd = () => onChange({dummy: {kind: $('dm-kind').value, reduction: parseFloat($('dm-red').value) || 0, hpMode: $('dm-hp').value,
                                        stagger: $('dm-stg').value, dotMode: $('dm-dot').value}});
    ['dm-kind', 'dm-red', 'dm-hp', 'dm-stg', 'dm-dot'].forEach((id) => $(id).addEventListener('change', upd));
  };
})();
