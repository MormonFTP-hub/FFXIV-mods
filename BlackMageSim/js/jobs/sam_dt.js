// Samurai, Dawntrail 7.05–7.57 at level 100. Built on the Endwalker 6.1 class (sam_ew61.js): Fugetsu and Fuka, the
// three Sen into Iaijutsu, Ogi Namikiri, Shoha, Kenki. Dawntrail made Tsubame-gaeshi an ordinary GCD: Tenka Goken and
// Midare Setsugekka (and their Tendo forms) each leave a 30s Tsubame-gaeshi Ready for their Kaeshi, and Higanbana has
// none. Meikyo Shisui (20s) also grants Tendo, which turns the next three- or two-Sen Iaijutsu into Tendo Setsugekka
// (1,100, a critical hit) or Tendo Goken, each with its own Kaeshi. Ikishoten readies Zanshin (940 for 50 Kenki) too;
// Senei is 800 on a 60s recast; Hakaze is Gyofu (240). The 7.5–7.57 numbers (Midare and Kaeshi: Setsugekka 680; 7.05
// had 640, Tendo Setsugekka 1,020 and Zanshin 820). Game data at 7.05, 7.1, 7.2, 7.3, 7.41 and 7.57 (xivapi's
// datamining) and the Lodestone notes; gear is The Balance's 7.4+ savage set at 2.14 with Fuka. ref: a scripted bot
// parses about 39,250 on this.
//  - 7.0–7.01: only Meikyo Shisui grants Tsubame-gaeshi Ready (30s), and Tsubame-gaeshi must come straight after an
//    Iaijutsu, so each Meikyo gives one Tendo Setsugekka → Tendo Kaeshi Setsugekka (1,020 each) and a plain Midare has no
//    Kaeshi. Higher combo numbers (Jinpu / Shifu 320, Gekko / Kasha 390, Yukikaze 360), Midare 700, Ogi Namikiri 900,
//    Zanshin 900, Senei 860, Guren 500, Kyuten 120, Gyoten 10s. 7.0's two-week 3.2s Tendo recast isn't modelled. No
//    Balance set survives for 7.0: an estimated launch set (Strength 4,354, 141 weapon damage) with a Grade 1 Gemdraught.
(function (B) {
  const EW = B.SamuraiEW61;
  const ws = (o) => Object.assign({ kind: 'gcd', target: true, range: 6, delay: 0.6, school: 'iai' }, o);
  const set = B.setAction;     // a version's change to an action (its description's numbers follow the potency)
  const KMAP = { tenkaGoken: 'kaeshiGoken', midareSetsugekka: 'kaeshiSetsugekka', tendoGoken: 'tendoKaeshiGoken', tendoSetsugekka: 'tendoKaeshiSetsugekka' };
  const KAESHI = { kaeshiGoken: 1, kaeshiSetsugekka: 1, tendoKaeshiGoken: 1, tendoKaeshiSetsugekka: 1 };
  const TENDO = { tendoGoken: 2, tendoSetsugekka: 3 };

  class SamuraiDT extends EW {
    constructor() {
      super();
      this.level = 100;
      this.levelKey = 100;
      this.model = 'sam-dt';
      const A = Object.assign({}, this.actions);
      delete A.kaeshiHiganbana;
      const pot = (id, potency, combo, extra) => set(A, id, Object.assign({ potency }, combo ? { comboPotency: combo } : {}, extra || {}));
      pot('hakaze', 240, 0, { name: 'Gyofu', desc: 'Delivers an attack with a potency of 240.\nAdditional Effect: Increases Kenki Gauge by 5' });
      pot('jinpu', 140, 300); pot('shifu', 140, 300); pot('gekko', 160, 370); pot('kasha', 160, 370); pot('yukikaze', 160, 340);
      for (const id of ['jinpu', 'shifu', 'yukikaze']) set(A, id, { desc: A[id].desc.replace('Combo Action: Hakaze', 'Combo Action: Gyofu') });
      set(A, 'enpi', { enhancedPotency: 270 });
      pot('higanbana', 200, 0, { dot: { potency: 50, duration: 60 } });
      pot('midareSetsugekka', 680); pot('tenkaGoken', 300);
      const kaeshi = { cd: undefined, charges: undefined, cdGroup: undefined };
      set(A, 'tsubameGaeshi', Object.assign({}, kaeshi, { desc: 'Repeats the Iaijutsu that granted Tsubame-gaeshi Ready (Tenka Goken, Midare Setsugekka or their Tendo forms).\nTsubame-gaeshi Ready lasts 30s; Higanbana can\'t be repeated.' }));
      set(A, 'kaeshiGoken', Object.assign({}, kaeshi, { potency: 300 }));
      set(A, 'kaeshiSetsugekka', Object.assign({}, kaeshi, { potency: 680, desc: 'Delivers a critical hit with a potency of 680.\nCan only be executed while under the effect of Tsubame-gaeshi Ready (Midare Setsugekka).' }));
      A.tendoGoken = ws({ name: 'Tendo Goken', potency: 410, cast: 1.3, aoe: true, fx: 'tenka', desc: 'Delivers an attack with a potency of 410 to all nearby enemies.\nCan only be executed under the effect of Tendo and two Sen.\nAdditional Effect: Grants Tsubame-gaeshi Ready\nDuration: 30s' });
      A.tendoSetsugekka = ws({ name: 'Tendo Setsugekka', potency: 1100, cast: 1.3, fx: 'midare', desc: 'Delivers a critical hit with a potency of 1,100.\nCan only be executed under the effect of Tendo and three Sen.\nAdditional Effect: Grants Tsubame-gaeshi Ready\nDuration: 30s' });
      A.tendoKaeshiGoken = ws({ name: 'Tendo Kaeshi Goken', potency: 410, aoe: true, fx: 'tenka', desc: 'Delivers an attack with a potency of 410 to all nearby enemies.\nCan only be executed after Tendo Goken.' });
      A.tendoKaeshiSetsugekka = ws({ name: 'Tendo Kaeshi Setsugekka', potency: 1100, fx: 'midare', desc: 'Delivers a critical hit with a potency of 1,100.\nCan only be executed after Tendo Setsugekka.' });
      pot('ogiNamikiri', 1000, 0, { aoe: [1, 0.6] }); pot('kaeshiNamikiri', 1000, 0, { aoe: [1, 0.6] });
      set(A, 'senei', { potency: 800, recast: 60, desc: 'Delivers an attack with a potency of 800.\nKenki Gauge Cost: 25\nShares a recast timer with Hissatsu: Guren.' });
      set(A, 'guren', { potency: 400, recast: 60 });
      set(A, 'shoha', { potency: 640, aoe: [1, 0.6], desc: 'Delivers an attack with a potency of 640 to the first enemy in a straight line, 40% less for the rest.\nCan only be executed at three Meditation stacks.' });
      set(A, 'kyuten', { potency: 100 });
      set(A, 'gyoten', { recast: 5 });
      set(A, 'meikyoShisui', { desc: 'Execute up to 3 weaponskill combos without meeting combo prerequisites.\nDuration: 20s\nAdditional Effect: Grants Tendo\nDuration: 30s' });
      set(A, 'ikishoten', { desc: 'Increases Kenki Gauge by 50.\nAdditional Effect: Grants Ogi Namikiri Ready and Zanshin Ready\nDuration: 30s\nCan only be executed while in combat.' });
      A.zanshin = { name: 'Zanshin', kind: 'ogcd', recast: 1, potency: 940, kenkiCost: 50, target: true, range: 8, aoe: [1, 0.6], delay: 0.6, fx: 'senei', desc: 'Delivers an attack with a potency of 940 to the first enemy in a cone, 40% less for the rest.\nKenki Gauge Cost: 50\nCan only be executed while under the effect of Zanshin Ready.' };
      A.tincture = B.tincture('strdt4');
      this.actions = A;
      this.tinctureKey = 'strdt4';
      this.statuses = Object.assign({}, this.statuses, {
        tendo: { name: 'Tendo', self: true, icon: 'st_meikyo' },
        zanshinReady: { name: 'Zanshin Ready', self: true, icon: 'st_meikyo' },
        tsubameReady: { name: 'Tsubame-gaeshi Ready', self: true, icon: 'st_meikyo' },
      });
      this.selfStatusOrder = ['fugetsu', 'fuka', 'meikyoShisui', 'tendo', 'tsubameReady', 'ogiNamikiriReady', 'zanshinReady', 'enhancedEnpi', 'meditate',
        'trueNorth', 'thirdEye', 'medicated', 'bloodbath', 'armsLength', 'sprint'];
      // The Balance's 7.4+ savage set (Grand Champion's Blade, 158 weapon damage), 2.14 with Fuka.
      this.stats = Object.assign({}, this.stats, { main: 6502, wd: 158, det: 2426, crit: 3605, dh: 1793, speed: 689, hp: 200000 });
      this.defaultBars = this.defaultBars.map(r => r.map(id => (id && A[id] ? id : null)));
      const row = this.defaultBars.find(r => r.includes(null));
      if (row) row[row.indexOf(null)] = 'zanshin';
      this.actionGroups = this.actionGroups.map(([n, ids]) => [n, n === 'Samurai'
        ? ids.filter(id => A[id]).concat(['tendoGoken', 'tendoSetsugekka', 'tendoKaeshiGoken', 'tendoKaeshiSetsugekka', 'zanshin'])
        : ids.filter(id => A[id])]);
      this.referenceDps = 41600;
      this.referenceGcd = 2.14;
    }

    resolveId(id, e) {
      const g = e.g;
      if (id === 'iaijutsu' && e.has('tendo')) {
        const n = this.senCount(e);
        if (n === 3) return 'tendoSetsugekka';
        if (n === 2) return 'tendoGoken';
      }
      if (id === 'tsubameGaeshi') return g.dtKaeshi && g.dtKaeshi.until > e.now ? g.dtKaeshi.id : 'tsubameGaeshi';
      return super.resolveId(id, e);
    }

    check(id, e) {
      const g = e.g;
      if (KAESHI[id]) return g.dtKaeshi && g.dtKaeshi.until > e.now && g.dtKaeshi.id === id ? null : 'Unable to execute action. Tsubame-gaeshi Ready required.';
      if (TENDO[id] && !(e.has('tendo') && this.senCount(e) === TENDO[id])) return 'Unable to execute action.';
      if (id === 'zanshin' && !e.has('zanshinReady')) return 'Unable to execute action. Zanshin Ready required.';
      return super.check(id, e);
    }

    weaponskill(id, e) {
      const a = this.actions[id], g = e.g;
      if (TENDO[id] || id === 'tendoKaeshiGoken' || id === 'tendoKaeshiSetsugekka') {
        if (TENDO[id]) {
          g.sen = { setsu: false, getsu: false, ka: false };
          g.meditation = Math.min(3, g.meditation + 1);
          e.emit('sen', {});
          e.removeStatus('tendo');
          g.dtKaeshi = { id: KMAP[id], until: e.now + 30 };
          e.addStatus('tsubameReady', 30);
        } else { g.dtKaeshi = null; e.removeStatus('tsubameReady'); }
        g.kaeshi = null; g.namikiri = false;
        const crit = id === 'tendoSetsugekka' || id === 'tendoKaeshiSetsugekka';
        e.queueHit(id, a.potency, this.snapshot({}, e), a.delay, null, crit ? { crit: true } : null);
        return;
      }
      if (KAESHI[id]) { g.dtKaeshi = null; e.removeStatus('tsubameReady'); }
      super.weaponskill(id, e);
      if (KMAP[id]) { g.dtKaeshi = { id: KMAP[id], until: e.now + 30 }; e.addStatus('tsubameReady', 30); }
    }

    ability(id, e) {
      switch (id) {
        case 'meikyoShisui': e.addStatus('meikyoShisui', 20, { stacks: 3 }); e.addStatus('tendo', 30); return;
        case 'ikishoten': this.addKenki(e, 50); e.addStatus('ogiNamikiriReady', 30); e.addStatus('zanshinReady', 30); return;
        case 'zanshin':
          this.addKenki(e, -50);
          e.removeStatus('zanshinReady');
          e.queueHit(id, this.actions.zanshin.potency, this.snapshot({}, e), this.actions.zanshin.delay);
          return;
      }
      super.ability(id, e);
    }

    proc(id, e) {
      if (id === 'tsubameGaeshi') return !!(e.g.dtKaeshi && e.g.dtKaeshi.until > e.now);
      if (id === 'zanshin') return e.has('zanshinReady') && e.g.kenki >= 50;
      return super.proc(id, e);
    }

    helpHtml(seq) {
      return `
<h3>How it plays (Dawntrail 7.05–7.57)</h3>
<p>Level 100 Samurai. Keep <b>Fugetsu</b> (+13% damage, Jinpu / Gekko) and <b>Fuka</b> (13% haste, Shifu / Kasha) up from <b>Gyofu</b> (240) and gather the three Sen: <b>Gekko</b> (rear) and <b>Kasha</b> (flank), 370 in combo (+50 from the right side), and <b>Yukikaze</b> (340). One Sen is <b>Higanbana</b> (200 + 50 × 60s), three <b>Midare Setsugekka</b> (680, a critical hit), which leaves 30s of <b>Tsubame-gaeshi Ready</b>: Tsubame-gaeshi is now a normal GCD that repeats it (Kaeshi: Setsugekka, 680).</p>
<p><b>Meikyo Shisui</b> (two charges, 20s) skips three combo steps and grants <b>Tendo</b>: the next three-Sen Iaijutsu is <b>Tendo Setsugekka</b> (1,100) and its Kaeshi another 1,100. <b>Ikishoten</b> (120s) gives 50 Kenki, <b>Ogi Namikiri</b> (1,000, then Kaeshi: Namikiri 1,000) and <b>Zanshin</b> (940 for 50 Kenki). Kenki also buys <b>Senei</b> (800, 60s) and <b>Shinten</b> (250); three Meditation for <b>Shoha</b> (640).</p>
<h3>The opener (The Balance)</h3>
${seq([['meikyoShisui'], ['trueNorth'], 'gekko', ['tincture'], 'kasha', ['ikishoten'], 'yukikaze', 'tendoSetsugekka', ['senei'], 'tendoKaeshiSetsugekka', ['meikyoShisui'], 'gekko', ['zanshin'], 'higanbana', 'ogiNamikiri', ['shoha'], 'kaeshiNamikiri', 'kasha', ['shinten'], 'gekko', ['gyoten'], 'hakaze', 'yukikaze', ['shinten'], 'tendoSetsugekka', 'tendoKaeshiSetsugekka'])}
<p>Meikyo Shisui at −14s and True North at −5s; a 2.14 GCD with Fuka.</p>
<p style="color:#a9a3b4">The 7.5–7.57 numbers: Gyofu 240, Jinpu / Shifu 300, Gekko / Kasha 370 (420 positional), Yukikaze 340, Higanbana 200 + 50 × 60s, Tenka Goken 300, Midare and Kaeshi: Setsugekka 680, Tendo Setsugekka and its Kaeshi 1,100, Ogi and Kaeshi: Namikiri 1,000, Zanshin 940, Senei 800, Shinten 250, Shoha 640; auto-attacks 90 at 2.64s. 7.05–7.4x had Midare 640, Tendo Setsugekka 1,020 (7.05–7.1x) and Zanshin 820–900. Gear: The Balance's 7.4+ savage set (Strength 6,502, 158 weapon damage), with a Grade 4 Gemdraught.</p>`;
    }
  }

  class SamuraiDT70 extends SamuraiDT {
    constructor() {
      super();
      const A = Object.assign({}, this.actions);
      const pot = (id, potency, combo, extra) => set(A, id, Object.assign({ potency }, combo ? { comboPotency: combo } : {}, extra || {}));
      pot('jinpu', 160, 320); pot('shifu', 160, 320); pot('gekko', 180, 390); pot('kasha', 180, 390); pot('yukikaze', 180, 360);
      pot('midareSetsugekka', 700);
      pot('kaeshiSetsugekka', 700, 0, { desc: 'Delivers a critical hit with a potency of 700.\nCan only be executed immediately after Midare Setsugekka under the effect of Tsubame-gaeshi Ready.' });
      pot('tendoGoken', 420, 0, { desc: A.tendoGoken.desc.replace('410', '420').replace('Additional Effect: Grants Tsubame-gaeshi Ready\nDuration: 30s', 'Tsubame-gaeshi Ready (from Meikyo Shisui) lets its Kaeshi follow.') });
      pot('tendoKaeshiGoken', 420, 0, { desc: A.tendoKaeshiGoken.desc.replace('410', '420') });
      pot('tendoSetsugekka', 1020, 0, { desc: 'Delivers a critical hit with a potency of 1,020.\nCan only be executed under the effect of Tendo and three Sen.\nTsubame-gaeshi Ready (from Meikyo Shisui) lets its Kaeshi follow.' });
      pot('tendoKaeshiSetsugekka', 1020, 0, { desc: 'Delivers a critical hit with a potency of 1,020.\nCan only be executed immediately after Tendo Setsugekka.' });
      pot('ogiNamikiri', 900, 0, { aoe: [1, 0.25] }); pot('kaeshiNamikiri', 900, 0, { aoe: [1, 0.25] });
      set(A, 'zanshin', { potency: 900, aoe: [1, 0.4], desc: A.zanshin.desc.replace('940', '900').replace('40% less', '60% less') });
      set(A, 'senei', { potency: 860, desc: A.senei.desc.replace('800', '860') });
      set(A, 'guren', { potency: 500, aoe: [1, 0.75] });
      set(A, 'kyuten', { potency: 120 });
      set(A, 'gyoten', { recast: 10 });
      set(A, 'shoha', { aoe: [1, 0.35], desc: A.shoha.desc.replace('40% less', '65% less') });
      set(A, 'meikyoShisui', { desc: 'Execute up to 3 weaponskill combos without meeting combo prerequisites.\nDuration: 20s\nAdditional Effect: Grants Tendo and Tsubame-gaeshi Ready\nDuration: 30s' });
      set(A, 'tsubameGaeshi', { desc: 'Repeats the Iaijutsu you just used (Tsubame-gaeshi Ready, from Meikyo Shisui, required).\nCan only be executed immediately following Iaijutsu.' });
      A.tincture = B.tincture('strdt1');
      this.actions = A;
      this.tinctureKey = 'strdt1';
      this.stats = Object.assign({}, this.stats, { main: 4354, wd: 141, det: 2308, crit: 2158, dh: 2222, speed: 582, hp: 129800 });
      this.referenceDps = 23800;     // a scripted bot parses about 22,400
      this.referenceGcd = 2.17;
    }

    ability(id, e) {
      super.ability(id, e);
      if (id === 'meikyoShisui') e.g.tsubame70 = e.now + 30;
    }

    // Only Meikyo Shisui's Tsubame-gaeshi Ready lets an Iaijutsu be repeated, and only by the very next GCD.
    weaponskill(id, e) {
      const g = e.g;
      const iai = !!(KMAP[id] || TENDO[id]);
      const ready = !!(g.tsubame70 && g.tsubame70 > e.now);
      const pending = g.dtKaeshi && g.dtKaeshi.until > e.now;
      super.weaponskill(id, e);
      if (iai) {
        if (ready) { g.tsubame70 = 0; g.dtKaeshi = { id: KMAP[id], until: e.now + 10 }; e.addStatus('tsubameReady', 10); }
        else { g.dtKaeshi = null; e.removeStatus('tsubameReady'); }
      } else if (!KAESHI[id] && pending) {
        g.dtKaeshi = null;
        if (!(g.tsubame70 > e.now)) e.removeStatus('tsubameReady');
      }
      if (!g.dtKaeshi && g.tsubame70 > e.now && !e.has('tsubameReady')) e.addStatus('tsubameReady', g.tsubame70 - e.now);
    }

    helpHtml(seq) {
      return super.helpHtml(seq).replace('<h3>How it plays (Dawntrail 7.05–7.57)</h3>', `<h3>How it plays (Dawntrail 7.0–7.01)</h3>
<p><b>Dawntrail 7.0–7.01:</b> Tsubame-gaeshi Ready comes only from <b>Meikyo Shisui</b> (30s, with Tendo), and Tsubame-gaeshi must be the very next GCD after the Iaijutsu. So each Meikyo gives one <b>Tendo Setsugekka → Tendo Kaeshi Setsugekka</b> (1,020 each), and an ordinary Midare Setsugekka (700) has no Kaeshi. The combo steps are higher (Jinpu / Shifu 320, Gekko / Kasha 390, Yukikaze 360); Ogi Namikiri and Zanshin 900, Senei 860, Gyoten 10s. Gear: an estimated launch set (Strength 4,354, 141 weapon damage) with a Grade 1 Gemdraught. The rest below is 7.05's.</p>`);
    }
  }

  B.registerJob({
    id: 'sam', name: 'Samurai', abbr: 'SAM', role: 'melee', classJob: 34,
    versions: [{ id: 'dt705', label: 'Dawntrail 7.05–7.57', history: 'DT 7.05–7.57', note: 'Level 100: Tsubame-gaeshi a GCD from Tsubame-gaeshi Ready, Meikyo Shisui into Tendo Setsugekka, Zanshin, Senei on 60s; the 7.5 numbers', create: () => new SamuraiDT() },
      { id: 'dt70', label: 'Dawntrail 7.0–7.01', history: 'DT 7.0–7.01', note: 'Level 100 at launch: only Meikyo Shisui readies Tsubame-gaeshi, so one Tendo Kaeshi Setsugekka per Meikyo; higher combo potencies; estimated launch gear', create: () => new SamuraiDT70() }],
  });
})(window.BLM);
