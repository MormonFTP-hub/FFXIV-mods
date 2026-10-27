// Samurai, Endwalker 6.1–6.58 at level 90. Built on the 6.08 class (sam_ew.js) with what 6.1 changed: Hissatsu:
// Kaiten removed, Midare Setsugekka, Kaeshi: Setsugekka, Ogi Namikiri and Kaeshi: Namikiri always critical hits, and a
// potency rework (raised again in 6.11 and 6.4). The 6.58 numbers from the game data at each patch and the Lodestone
// notes; gear is The Balance's 6.4/6.5 set at 2.15 with Fuka.
(function (B) {
  const EW608 = B.SamuraiEW608;
  const set = (A, id, o) => { A[id] = Object.assign({}, A[id], o); };
  const CRIT = { midareSetsugekka: 1, kaeshiSetsugekka: 1, ogiNamikiri: 1, kaeshiNamikiri: 1 };

  class SamuraiEW61 extends EW608 {
    constructor() {
      super();
      const A = Object.assign({}, this.actions);
      delete A.kaiten;
      const p = (id, potency, combo, extra) => set(A, id, Object.assign({ potency }, combo ? { comboPotency: combo } : {}, extra || {}));
      p('hakaze', 200); p('jinpu', 120, 280); p('shifu', 120, 280); p('gekko', 120, 330); p('kasha', 120, 330); p('yukikaze', 120, 300);
      p('mangetsu', 100, 120); p('oka', 100, 120);
      p('higanbana', 200, 0, { dot: { potency: 45, duration: 60 } }); p('tenkaGoken', 300); p('midareSetsugekka', 640);
      p('kaeshiHiganbana', 200, 0, { dot: { potency: 45, duration: 60 } }); p('kaeshiGoken', 300); p('kaeshiSetsugekka', 640);
      p('ogiNamikiri', 860); p('kaeshiNamikiri', 860);
      p('shinten', 250); p('senei', 860); p('kyuten', 120); p('shoha', 560);
      for (const id of Object.keys(A)) {
        if (A[id].desc) A[id] = Object.assign({}, A[id], { desc: A[id].desc.replace(/potency of \d+/, `potency of ${A[id].potency}`).replace(/Combo Potency: \d+/, `Combo Potency: ${A[id].comboPotency}`) + (CRIT[id] ? '\nThis attack is guaranteed to be a critical hit.' : '') });
      }
      A.tincture = B.tincture('str');
      this.actions = A;
      this.tinctureKey = 'str';
      // The Balance's 6.4/6.5 set without the relic (Samurai Blade of Ascension, 132 weapon damage), 508 skill speed.
      this.stats = Object.assign({}, this.stats, { main: 3367, wd: 132, det: 1716, crit: 2587, dh: 1422, speed: 508, hp: 85000 });
      this.defaultBars = this.defaultBars.map(r => r.map(id => (id && A[id] ? id : null)));
      this.actionGroups = this.actionGroups.map(([n, ids]) => [n, ids.filter(id => A[id])]);
      this.selfStatusOrder = this.selfStatusOrder.filter(k => k !== 'kaiten');
      this.referenceDps = 13060;     // a scripted 6.4 rotation on this gear parses about 12,320 on the dummy
    }

    // Midare, Ogi and both of their Kaeshi always crit.
    weaponskill(id, e) {
      if (!CRIT[id]) return super.weaponskill(id, e);
      e.queueHit = (i, pot, s, d, after, opts) => B.Engine.prototype.queueHit.call(e, i, pot, s, d, after, Object.assign({}, opts, { crit: true }));
      try { super.weaponskill(id, e); } finally { delete e.queueHit; }
    }

    helpHtml(seq) {
      return `
<h3>How it plays (Endwalker 6.1–6.58)</h3>
<p>Level 90 Samurai after 6.1 removed Hissatsu: Kaiten. Keep <b>Fugetsu</b> (+13% damage, Jinpu / Gekko) and <b>Fuka</b> (13% haste, Shifu / Kasha) up and gather the three Sen: <b>Gekko</b> from the rear and <b>Kasha</b> from the flank (380 positional), <b>Yukikaze</b> (300). Three Sen make <b>Midare Setsugekka</b> (640), followed by <b>Kaeshi: Setsugekka</b> (640); both are guaranteed critical hits, as are <b>Ogi Namikiri</b> and <b>Kaeshi: Namikiri</b> (860 each, from Ikishoten). Keep <b>Higanbana</b> (200 + 45 × 60s) up. Kenki goes to <b>Shinten</b> (250) and <b>Senei</b> (860, 120s); three Meditation stacks to <b>Shoha</b> (560).</p>
<h3>The opener (The Balance)</h3>
${seq(['meikyoShisui', 'gekko', ['tincture'], 'kasha', ['ikishoten'], 'yukikaze', 'midareSetsugekka', ['senei'], 'kaeshiSetsugekka', ['meikyoShisui'], 'gekko', ['shinten'], 'higanbana', ['shinten'], 'ogiNamikiri', ['shoha'], 'kaeshiNamikiri', 'kasha', ['shinten'], 'gekko', ['gyoten'], 'hakaze', 'yukikaze', ['shinten'], 'midareSetsugekka', 'kaeshiSetsugekka'])}
<p>Meikyo Shisui at −9s and True North at −5s. A 2.15 GCD with Fuka.</p>
<p style="color:#a9a3b4">The 6.58 numbers: Hakaze 200, Jinpu / Shifu 280 and Yukikaze 300 in combo, Gekko / Kasha 330 (380 positional), Higanbana 200 + 45 × 60s, Tenka Goken 300, Midare 640, Kaeshi: Setsugekka 640, Ogi Namikiri and Kaeshi: Namikiri 860, Shinten 250, Senei 860, Shoha 560; auto-attacks 90 at 2.64s. Gear: The Balance's 6.4/6.5 set without the relic (Strength 3,367).</p>`;
    }
  }

  B.registerJob({
    id: 'sam', name: 'Samurai', abbr: 'SAM', role: 'melee', classJob: 34,
    versions: [{ id: 'ew61', label: 'Endwalker 6.1–6.58', history: 'EW 6.1–6.58', note: 'Level 90: no Kaiten; Midare, Kaeshi: Setsugekka, Ogi and Kaeshi: Namikiri always crit; the 6.4 potencies; Anabaseios gear', create: () => new SamuraiEW61() }],
  });
})(window.BLM);
