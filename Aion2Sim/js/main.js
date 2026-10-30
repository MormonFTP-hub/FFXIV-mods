// Start-up, the frame loop, keys and pointer, and each class's saved build.
(function () {
  'use strict';
  const A2 = window.A2;
  const $ = (id) => document.getElementById(id);

  // Character sheets to start from. A fresh level 45, a geared one, and a well-geared endgame one.
  A2.PRESETS = {
    'Fresh 45': {attack: 1400, critHit: 500, critDmg: 0, dmgBoost: 0, pveBoost: 0, backBoost: 0, multiHit: 0, combatSpeed: 0, castSpeed: 0, cdr: 0, mpMax: 1000},
    'Geared': {attack: 2400, critHit: 900, critDmg: 15, dmgBoost: 8, pveBoost: 8, backBoost: 5, multiHit: 5, combatSpeed: 8, castSpeed: 8, cdr: 0, mpMax: 1000},
    'Endgame': {attack: 3600, critHit: 1400, critDmg: 35, dmgBoost: 15, pveBoost: 15, backBoost: 10, multiHit: 10, combatSpeed: 15, castSpeed: 15, cdr: 5, mpMax: 1000},
  };

  const app = {sim: null, cls: null, cfg: null, auto: false, keys: {}, last: 0};
  A2.app = app;

  function defaults(cls) {
    return {
      lvActive: 20, lvStigma: 10, stigmas: (cls.defaultStigmas || []).slice(0, cls.stigmaSlots || 4),
      specs: JSON.parse(JSON.stringify(cls.defaultSpecs || {})),
      stats: Object.assign({}, A2.PRESETS.Geared),
      dummy: {kind: 'boss', reduction: 0, hpMode: 'fight'},
      parseLen: 180,
    };
  }

  function loadCfg(cls) {
    const saved = A2.save.get('cfg.' + cls.id, null);
    const d = defaults(cls);
    if (!saved) return d;
    const cfg = Object.assign(d, saved);
    cfg.stats = Object.assign({}, d.stats, saved.stats);
    cfg.dummy = Object.assign({}, d.dummy, saved.dummy);
    cfg.stigmas = (cfg.stigmas || []).filter((id) => cls.skills[id]);
    return cfg;
  }

  function saveCfg() {
    A2.save.set('cfg.' + app.cls.id, app.cfg);
  }

  function makeSim() {
    const sim = new A2.Sim(app.cls, Object.assign({}, app.cfg, {parseLen: +$('pull').value}));
    sim.on('damage', (ev, b, s) => A2.Scene.onDamage(ev, s));
    sim.on('move', (from, to) => A2.Scene.onMove(from, to));
    sim.on('text', (txt, color) => A2.Scene.onText(txt, color));
    sim.on('refuse', (s, why) => { if (!app.auto && why) A2.toast(`${s.name}: ${why}`); });
    sim.on('done', () => {
      A2.toast(`Parse done: ${A2.int(sim.dps())} DPS over ${A2.clock(sim.elapsed())}. Press R to go again.`);
      if (app.auto) setAuto(false);
    });
    app.sim = sim;
    A2.Scene.reset();
    A2.UI.buildHotbar(sim);
    A2.UI.updateFrames(sim, Infinity);
    $('t-kind').textContent = app.cfg.dummy.kind === 'field' ? 'Field monster · can be stunned' : 'Boss · status immune';
  }

  function setClass(id) {
    const cls = A2.CLASSES.find((c) => c.id === id) || A2.CLASSES[0];
    app.cls = cls;
    app.cfg = loadCfg(cls);
    A2.save.set('class', cls.id);
    $('b-class-name').textContent = cls.name;
    $('b-class-sub').textContent = cls.role;
    const mark = $('b-class-mark');
    mark.style.backgroundImage = `url(${A2.icon(cls.icon, cls.hue, 'stigma').toDataURL()})`;
    if (A2.Board && cls.id) {
      const sel = $('board-class');
      if (sel && !A2.save.get('boardPinned', false)) { /* the board keeps its own choice */ }
    }
    makeSim();
    refreshPanels();
  }

  function change(patch) {
    Object.assign(app.cfg, patch);
    saveCfg();
    makeSim();
    refreshPanels();
  }

  function refreshPanels() {
    A2.UI.renderClasses(app.cls.id, (id) => { setClass(id); A2.UI.closeAll(); A2.toast(`${app.cls.name}. Press B for its build.`); });
    A2.UI.renderBuild(app.sim, app.cfg, change);
    A2.UI.renderStats(app.sim, app.cfg, change);
  }

  function setAuto(on) {
    app.auto = on;
    $('b-auto').classList.toggle('on', on);
    $('b-auto').setAttribute('aria-pressed', on);
    if (!on) { app.sim.p.goal = null; }
  }

  A2.pressSkill = function (id) {
    if (app.auto) setAuto(false);
    app.sim.press(id);
  };

  function reset() {
    makeSim();
  }

  function runParse() {
    const res = A2.runParse(app.cls, Object.assign({}, app.cfg, {parseLen: +$('pull').value || 180}));
    // show the finished parse on the meter, as if you'd just played it
    app.sim = res.sim;
    app.sim.listeners = {};
    A2.Scene.reset();
    A2.UI.buildHotbar(app.sim);
    A2.UI.updateFrames(app.sim, Infinity);
    A2.toast(`The sim's rotation: ${A2.int(res.dps)} DPS over ${A2.clock(res.seconds)}. Press R to play it yourself.`);
  }

  function copyParse() {
    const txt = A2.UI.parseText(app.sim);
    try {
      navigator.clipboard.writeText(txt).then(() => A2.toast('Parse copied.'), () => A2.toast('Copy was blocked. Select the meter text instead.'));
    } catch (e) { A2.toast('Copy was blocked here.'); }
  }

  // --- input -----------------------------------------------------------------------------------

  const MOVE_KEYS = {w: [0, -1], arrowup: [0, -1], s: [0, 1], arrowdown: [0, 1], a: [-1, 0], arrowleft: [-1, 0], d: [1, 0], arrowright: [1, 0]};

  function moveDir() {
    let x = 0, y = 0;
    for (const k in MOVE_KEYS) if (app.keys[k]) { x += MOVE_KEYS[k][0]; y += MOVE_KEYS[k][1]; }
    return [x, y];
  }

  function onKey(e) {
    const tag = (e.target && e.target.tagName) || '';
    if (/INPUT|TEXTAREA|SELECT/.test(tag)) {
      if (e.key === 'Escape') e.target.blur();
      return;
    }
    const k = e.key.toLowerCase();
    if (e.type === 'keyup') {
      delete app.keys[k];
      app.sim.p.dir = moveDir();
      return;
    }
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    if (k === 'escape') { A2.UI.closeAll(); A2.UI.hideTip(); return; }
    if (MOVE_KEYS[k]) {
      app.keys[k] = true;
      app.sim.p.dir = moveDir();
      app.sim.p.goal = null;
      if (app.auto) setAuto(false);
      e.preventDefault();
      return;
    }
    if (e.repeat && !A2.UI.keymap[k]) return;
    if (A2.UI.keymap[k] && !A2.UI.anyOpen()) { A2.pressSkill(A2.UI.keymap[k]); e.preventDefault(); return; }
    const panel = {c: 'class-panel', b: 'build-panel', v: 'stats-panel', l: 'board-panel', h: 'help-panel'}[k];
    if (panel) { A2.UI.open(panel); e.preventDefault(); return; }
    if (k === 'r') { reset(); return; }
    if (k === 'p') { setAuto(!app.auto); return; }
  }

  function wire() {
    window.addEventListener('keydown', onKey);
    window.addEventListener('keyup', onKey);
    window.addEventListener('blur', () => { app.keys = {}; if (app.sim) app.sim.p.dir = [0, 0]; });
    const cv = $('arena');
    cv.addEventListener('pointerdown', (e) => {
      A2.UI.hideTip();
      if (A2.UI.closeAll()) return;
      const [x, y] = A2.Scene.pick(e.clientX, e.clientY);
      app.sim.p.goal = [x, y];
      if (app.auto) setAuto(false);
    });
    $('b-class').addEventListener('click', () => A2.UI.open('class-panel'));
    $('b-build').addEventListener('click', () => A2.UI.open('build-panel'));
    $('b-stats').addEventListener('click', () => A2.UI.open('stats-panel'));
    $('b-leaders').addEventListener('click', () => A2.UI.open('board-panel'));
    $('b-help').addEventListener('click', () => A2.UI.open('help-panel'));
    document.querySelectorAll('[data-close]').forEach((b) => b.addEventListener('click', A2.UI.closeAll));
    $('b-reset').addEventListener('click', reset);
    $('b-auto').addEventListener('click', () => setAuto(!app.auto));
    $('b-run').addEventListener('click', runParse);
    $('b-copy').addEventListener('click', copyParse);
    $('pull').addEventListener('change', () => { app.cfg.parseLen = +$('pull').value; saveCfg(); reset(); });
    const lvA = $('lv-active'), lvS = $('lv-stigma');
    lvA.addEventListener('input', () => { $('lv-active-n').textContent = lvA.value; });
    lvS.addEventListener('input', () => { $('lv-stigma-n').textContent = lvS.value; });
    lvA.addEventListener('change', () => change({lvActive: +lvA.value}));
    lvS.addEventListener('change', () => change({lvStigma: +lvS.value}));
  }

  function frame(now) {
    const dt = Math.min(0.05, Math.max(0, (now - (app.last || now)) / 1000));
    app.last = now;
    const sim = app.sim;
    if (app.auto) A2.botStep(sim);
    // step in small slices so the queue and hit timing don't depend on the frame rate
    let left = dt;
    while (left > 1e-6) { const h = Math.min(left, 1 / 120); sim.step(h); left -= h; }
    A2.Scene.draw(sim, dt);
    A2.UI.updateFrames(sim, now);
    requestAnimationFrame(frame);
  }

  function start() {
    A2.Scene.init($('arena'));
    wire();
    const saved = A2.save.get('class', 'assassin');
    $('pull').value = String((A2.save.get('cfg.' + saved, {}) || {}).parseLen || 180);
    setClass(saved);
    A2.Board.init();
    if (location.hash === '#leaders') A2.UI.open('board-panel');
    requestAnimationFrame(frame);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();
})();
