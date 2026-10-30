// Builds a class from its generated data (js/classes/data_<id>.js) plus a hand-written overlay: which skills go on
// the bar, how each one behaves on a dummy (conditions, follow-up windows, crowd control, casts), the passives and
// the rotation. Pure utility skills (heals, shields, cleanses) with no damage and no damage buff are left out.
(function () {
  'use strict';
  const A2 = window.A2;

  A2.defineClass = function (id, def) {
    const data = (A2.DATA || {})[id];
    if (!data) return;
    const skills = {};
    for (const sid in data.skills) {
      const o = (def.over || {})[sid] || {};
      if ((def.exclude || []).indexOf(sid) >= 0 || o.exclude) continue;
      const base = JSON.parse(JSON.stringify(data.skills[sid]));
      if (base.noHit && !base.buff && !o.keep && !o.onUse && !o.orb && !o.buff) continue;
      if (/^HEAL:/.test(base.desc || '') && !o.keep) continue;
      const specs = base.specs || [];
      const sk = Object.assign(base, o);
      sk.specs = specs.map((sp, i) => (o.specs && o.specs[i] ? Object.assign({}, sp, o.specs[i]) : sp));
      sk.desc = o.desc || base.desc;
      skills[sid] = sk;
    }
    A2.registerClass(Object.assign({id, skills, stigmaSlots: 4, data}, def));
  };

  /** A passive's number `idx` (in the order the tooltip lists them) at skill level `lv`, from its Lv 1 and Lv 40 text. */
  A2.pv = function (cls, name, idx, lv) {
    const p = A2.DATA[cls] && A2.DATA[cls].passives[name];
    if (!p) return 0;
    const a = p.n1[idx] || 0;
    const b = p.n40[idx] == null ? a : p.n40[idx];
    return a + (b - a) * (A2.clamp(lv, 1, 40) - 1) / 39;
  };

  /** A passive's proc: a hit with its own meter row. */
  A2.procHit = function (sim, id, name, base, atk, hue, extra) {
    return sim.hit({id, name, hue, icon: 'star', mods: {}}, Object.assign({base, atk, proc: true, as: id, asName: name}, extra));
  };

  A2.specOn = function (s, i) { return !!(s && s.specOn.indexOf(i) >= 0 && s.level >= s.specs[i].lv); };
})();
