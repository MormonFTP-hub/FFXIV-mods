// Small helpers every other file uses: skill-level tables, a seeded RNG, number formatting, saved settings.
(function () {
  'use strict';
  const A2 = window.A2 = window.A2 || {};

  // Every stigma's base damage grows on one curve (Savage Fang, Smoke Bomb, Aerial Bind, Throw Shadowblade and
  // Triniel's Dagger all read 1 : 2.05 : 2.80 : 3.17 : 4.26 at Lv 1 / 10 / 20 / 25 / 40). Actives each have their own,
  // so their tables come from the skill pages; this curve only fills in a stigma that has just its Lv 1 number.
  const STIGMA_CURVE = {1: 1, 10: 2.050, 20: 2.805, 25: 3.168, 40: 4.258};
  // Actives with only a Lv 1 number fall back to the middle of the Assassin actives' curves.
  const ACTIVE_CURVE = {1: 1, 10: 5.0, 20: 7.6, 40: 12.0};

  function interp(table, level) {
    const keys = Object.keys(table).map(Number).sort((a, b) => a - b);
    if (keys.length === 1) return table[keys[0]];
    if (level <= keys[0]) return table[keys[0]];
    for (let i = 1; i < keys.length; i++) {
      if (level <= keys[i]) {
        const a = keys[i - 1], b = keys[i];
        return table[a] + (table[b] - table[a]) * (level - a) / (b - a);
      }
    }
    const a = keys[keys.length - 2], b = keys[keys.length - 1];
    return table[b] + (table[b] - table[a]) * (level - b) / (b - a);
  }

  /** A skill-level value: `v` is a number (the same at every level), a {lv: value} table, or {1: x} alone. */
  A2.lv = function (v, level, kind) {
    if (v == null) return 0;
    if (typeof v === 'number') return v;
    const keys = Object.keys(v);
    if (keys.length === 1 && kind && keys[0] === '1') {
      return v[1] * interp(kind === 'stigma' ? STIGMA_CURVE : ACTIVE_CURVE, level);
    }
    return interp(v, level);
  };

  /** Mulberry32: the same seed gives the same parse, so "Run a parse" is repeatable. */
  A2.rng = function (seed) {
    let a = seed >>> 0;
    return function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  };

  A2.fmt = function (n) {
    n = Math.round(n);
    if (Math.abs(n) >= 1e9) return (n / 1e9).toFixed(2) + 'B';
    if (Math.abs(n) >= 1e6) return (n / 1e6).toFixed(2) + 'M';
    if (Math.abs(n) >= 1e4) return (n / 1e3).toFixed(1) + 'k';
    return n.toLocaleString('en-US');
  };
  A2.int = (n) => Math.round(n).toLocaleString('en-US');
  A2.clock = function (s) {
    s = Math.max(0, s);
    const m = Math.floor(s / 60), r = Math.floor(s % 60);
    return `${m}:${r < 10 ? '0' : ''}${r}`;
  };
  A2.clamp = (x, a, b) => Math.max(a, Math.min(b, x));
  A2.esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'}[c]));

  A2.save = {
    get(k, d) { try { const v = localStorage.getItem('a2sim.' + k); return v ? JSON.parse(v) : d; } catch (e) { return d; } },
    set(k, v) { try { localStorage.setItem('a2sim.' + k, JSON.stringify(v)); } catch (e) { /* storage blocked: settings last this visit */ } },
  };

  A2.CLASSES = [];
  A2.registerClass = function (def) {
    A2.CLASSES.push(def);
    A2.CLASSES.sort((a, b) => (a.order || 99) - (b.order || 99));
  };
})();
