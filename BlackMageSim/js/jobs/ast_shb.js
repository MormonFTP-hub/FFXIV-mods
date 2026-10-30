// Astrologian, Shadowbringers at level 80, in two versions. Built on the Endwalker class (ast_ew.js) for Malefic,
// Combust III, Gravity, Earthly Star and Lightspeed, with Shadowbringers' cards: Draw (30s) one of six, Play it on
// yourself (as a healer the Bole, the Ewer and the Spire +6%, the Balance, the Arrow and the Spear +3%, 15s, one at a
// time) and its seal (Solar, Lunar or Celestial; the last three are kept) goes on the gauge. Redraw has three charges;
// Minor Arcana turns the held card into Lady of Crowns (+8% on you, from the Bole, Ewer or Spire) or Lord of Crowns
// (+4%) with no seal; Undraw throws it away. Divination at three seals is +4 / 5 / 6% for 1 / 2 / 3 kinds, 15s, 120s.
// Malefic IV 250 (1.5s), Combust III 60 × 30s, Gravity 140, Stellar Burst 100 / Explosion 150, Lightspeed 90s.
//  - 5.1–5.25: Sleeve Draw (180s) draws a card and two stacks: each Play, Minor Arcana or Undraw draws the next one;
//    Lightspeed also halves MP costs. Eden's Verse gear.
//  - 5.05–5.08: Malefic IV 240 and Combust III 45; otherwise as 5.1 (Sleeve Draw chains three cards, Lightspeed halves MP,
//    Divination 4 / 5 / 6% on 120s). Eden's Gate gear at 2.40 with a Grade 2 Tincture.
//  - 5.0–5.01: Sleeve Draw instead resets Draw and makes its recast 3s for two more Draws; Divination 2 / 4 / 6% on a 180s
//    recast; Gravity 130 with a 2.5s cast; Lightspeed 120s (10s shorter per Essential Dignity, which a dummy never
//    needs). Eden's Gate gear with 5.0's Tincture of Mind. The bot parses about 7,310 / 7,130 on these two.
//  - 5.3–5.58: Draw and Sleeve Draw restore 8% MP, Sleeve Draw gives a card with a seal you're missing, Lightspeed no
//    longer saves MP. Eden's Promise gear at 2.30.
// Numbers are the game data at 5.1–5.58 (xivapi's datamining) and the Lodestone notes; gear is The Balance's set for the
// tier (pre-6.0 stats). ref: a scripted bot parses about 12,460 / 9,550 on these over 5 minutes (MP runs low after that).
(function (B) {
  const EW = B.AstrologianEW;
  const ab = (o) => Object.assign({ kind: 'ogcd' }, o);
  const set = (A, id, o) => { A[id] = Object.assign({}, A[id], o); };
  const SIGN = { balance: 'solar', bole: 'solar', arrow: 'lunar', ewer: 'lunar', spear: 'celestial', spire: 'celestial' };
  const MINE = { bole: 1, ewer: 1, spire: 1 };
  const STATUS = { balance: 'ewBalance', bole: 'ewBole', arrow: 'ewArrow', ewer: 'ewEwer', spear: 'ewSpear', spire: 'ewSpire' };
  const base = { level: 80, malefic: 250, combust: 60, gravity: 140, lord: 0, macro: 0, divDur: 15, lsRecast: 90, lsCharges: 1, swift: 60 };
  const EDEN_GATE = { hp: 88356, main: 4193, wd: 164, det: 2712, crit: 1888, dh: 1915, speed: 1345, piety: 1269 };
  const VERSIONS = {
    shb505: Object.assign({}, base, { label: 'Shadowbringers 5.05–5.08', history: 'ShB 5.05–5.08', malefic: 240, combust: 45, lsMp: 0.5, drawMp: 0, sleeveSeal: false,
      tincture: 'mnd2', gcd: 2.40, ref: 7750, stats: EDEN_GATE,
      gear: 'an Eden\'s Gate Savage set at 2.40 (Mind 4,193, 164 magic damage)',
      note: 'Level 80: Malefic IV 240 and Combust III 45, Sleeve Draw chaining three cards, Divination 4/5/6% from three seals; Eden\'s Gate gear' }),
    shb50: Object.assign({}, base, { label: 'Shadowbringers 5.0–5.01', history: 'ShB 5.0–5.01', malefic: 240, combust: 45, gravity: 130, gravityCast: 2.5, lsMp: 0.5,
      lsRecast: 120, drawMp: 0, sleeveSeal: false, sleeveReset: true, divRecast: 180, divPct: [0, 0.02, 0.04, 0.06], tincture: 'mnd1', gcd: 2.40, ref: 7550, stats: EDEN_GATE,
      gear: 'an Eden\'s Gate Savage set at 2.40 (Mind 4,193, 164 magic damage)',
      note: 'Level 80 at launch: Sleeve Draw resets Draw for three quick cards, Divination 2/4/6% every 180s, Gravity a 2.5s cast, Lightspeed 120s; Eden\'s Gate gear' }),
    shb53: Object.assign({}, base, { label: 'Shadowbringers 5.3–5.58', history: 'ShB 5.3–5.58', lsMp: 1, drawMp: 800, sleeveSeal: true, tincture: 'mnd4', gcd: 2.30,
      ref: 13090, stats: { hp: 127960, main: 5544, wd: 180, det: 2016, crit: 3845, dh: 1220, speed: 2335, piety: 687 },
      gear: 'The Balance\'s 5.58 set with the relic at 2.30 (Mind 5,544, 180 magic damage)',
      note: 'Level 80, 5.3–5.58: Draw and Sleeve Draw restore 8% MP, Sleeve Draw gives a missing seal, Lightspeed no longer halves MP; Eden\'s Promise gear' }),
    shb51: Object.assign({}, base, { label: 'Shadowbringers 5.1–5.25', history: 'ShB 5.1–5.25', lsMp: 0.5, drawMp: 0, sleeveSeal: false, tincture: 'mnd3', gcd: 2.39,
      ref: 10030, stats: { hp: 107053, main: 4823, wd: 172, det: 2426, crit: 3581, dh: 1040, speed: 1422, piety: 1049 },
      gear: 'The Balance\'s 5.2 set (Eden\'s Verse Savage: Mind 4,823, 172 magic damage)',
      note: 'Level 80: Draw, Redraw (3 charges), Sleeve Draw, seals into Divination (4/5/6%), Minor Arcana into Lord or Lady of Crowns, Malefic IV and Combust III; Eden\'s Verse gear' }),
  };

  class AstrologianShB extends EW {
    constructor(version) {
      const V = VERSIONS[version];
      super(V);
      this.levelKey = 'shb80';
      this.V = Object.assign({}, this.V, { ls: { mp: V.lsMp } });
      const A = Object.assign({}, this.actions);
      for (const k of ['macrocosmos', 'microcosmos', 'astrodyne', 'exaltation', 'play']) delete A[k];
      set(A, 'fallMalefic', { name: 'Malefic IV', iconOf: 'malefic4', desc: `Deals unaspected damage with a potency of ${V.malefic}.` });
      set(A, 'gravity2', { name: 'Gravity', iconOf: 'gravity', mp: 600, cast: V.gravityCast || 1.5, desc: `Deals unaspected damage with a potency of ${V.gravity} to target and all enemies nearby it.` });
      set(A, 'stellarBurst', { potency: 100 });
      set(A, 'stellarExplosion', { potency: 150 });
      set(A, 'earthlyStar', { desc: 'Deploys an Earthly Star (here, at the dummy) and grants Earthly Dominance.\nStellar Detonation within 10s: Stellar Burst, 100 potency.\nAfter 10s it becomes Giant Dominance: Stellar Explosion, 150 potency.\nThe star detonates on its own after 20s.' });
      A.play = ab({ name: 'Play', recast: 1, cdGroup: 'play', desc: 'Plays the drawn arcanum (here, on yourself) and adds its seal.\n※Action changes to the card you hold.' });
      set(A, 'draw', { charges: undefined, desc: `Draws a card (arcanum) from your divining deck.${V.drawMp ? '\nAdditional Effect: Restores 8% of maximum MP' : ''}\nCannot be executed while holding a card.` });
      set(A, 'redraw', { recast: 30, charges: 3, desc: 'Draws a different card in place of the one you hold.\nMaximum Charges: 3' });
      A.undraw = ab({ name: 'Undraw', recast: 1, desc: 'Returns the drawn card to the deck.' });
      A.sleeveDraw = ab({ name: 'Sleeve Draw', recast: 180, desc: V.sleeveReset ? 'Resets the recast timer of Draw.\nAdditional Effect: Grants two Sleeve Draw stacks: while they last, Draw\'s recast is 3s.\nDuration: 30s' : V.sleeveSeal ? 'Draws a card with a seal you don\'t yet have.\nAdditional Effect: Restores 8% of maximum MP' : 'Draws a card.\nAdditional Effect: Grants two Sleeve Draw stacks: each Play, Minor Arcana or Undraw draws the next card.\nDuration: 30s' });
      set(A, 'minorArcana', { recast: 1, cdGroup: 'play', desc: 'Turns the held card into Lord of Crowns (from the Balance, the Arrow or the Spear: +4% on you, 8% on a melee) or Lady of Crowns (from the Bole, the Ewer or the Spire: +8% on you) and plays it, with no seal.\nDuration: 15s' });
      for (const k of ['lordOfCrowns', 'ladyOfCrowns']) delete A[k];
      const dp = (V.divPct || [0, 0.04, 0.05, 0.06]).map(x => Math.round(x * 100));
      set(A, 'divination', { recast: V.divRecast || 120, desc: `Increases damage dealt by yourself and nearby party members by ${dp[1]}% with one kind of seal, ${dp[2]}% with two, ${dp[3]}% with three.\nDuration: 15s\nCan only be executed with three seals.` });
      set(A, 'lightspeed', { desc: `Reduces cast times by 2.5 seconds${V.lsMp < 1 ? ' and MP costs by 50%' : ''}.\nDuration: 15s` });
      A.tincture = B.tincture(V.tincture);
      this.actions = A;
      this.statuses = Object.assign({}, this.statuses, {
        lordOfCrowns: { name: 'Lord of Crowns', self: true, icon: 'st_lordOfCrowns' },
        ladyOfCrowns: { name: 'Lady of Crowns', self: true, icon: 'st_ladyOfCrowns' },
        sleeveDraw: { name: 'Sleeve Draw', self: true, icon: 'st_sleeveDraw' },
      });
      this.selfStatusOrder = ['divination', 'ladyOfCrowns', 'lordOfCrowns', 'ewBole', 'ewEwer', 'ewSpire', 'ewBalance', 'ewArrow', 'ewSpear', 'sleeveDraw', 'lightspeed',
        'swiftcast', 'medicated', 'lucidDreaming', 'earthlyDominance', 'giantDominance', 'surecast', 'sprint'];
      this.defaultBars = [
        ['fallMalefic', 'combust3', 'draw', 'play', 'redraw', 'minorArcana', 'undraw', 'sleeveDraw', 'divination', 'earthlyStar', 'lightspeed', 'tincture'],
        ['gravity2', 'benefic', 'benefic2', 'aspectedBenefic', 'helios', 'aspectedHelios', 'essentialDignity', 'celestialIntersection', 'celestialOpposition',
          'collectiveUnconscious', 'lucidDreaming', 'swiftcast'],
        ['horoscope', 'neutralSect', 'synastry', 'surecast', 'rescue', 'esuna', 'repose', 'sprint', null, null, null, null],
      ];
      this.actionGroups = [
        ['Astrologian', ['fallMalefic', 'combust3', 'gravity2', 'earthlyStar', 'stellarDetonation', 'divination', 'lightspeed', 'draw', 'redraw', 'play',
          'balance', 'bole', 'arrow', 'ewer', 'spear', 'spire', 'minorArcana', 'undraw', 'sleeveDraw', 'benefic', 'benefic2', 'aspectedBenefic', 'helios',
          'aspectedHelios', 'essentialDignity', 'celestialIntersection', 'celestialOpposition', 'collectiveUnconscious', 'horoscope', 'neutralSect', 'synastry']],
        ['Role Actions', ['swiftcast', 'lucidDreaming', 'surecast', 'rescue', 'esuna', 'repose']],
        ['General', ['sprint', 'tincture']],
      ];
    }

    // The gauge reuses Endwalker's: g.signs holds the seals (the last three).
    initGauge() { return { card: null, signs: [], crown: null, star: null, sleeve: 0 }; }

    resolveId(id, e) {
      if (id === 'play' && e.g.card) return e.g.card;
      if (id === 'earthlyStar' && e.g.star) return 'stellarDetonation';
      return id;
    }

    check(id, e) {
      const a = this.actions[id], g = e.g;
      if (a.card && g.card !== id) return 'Unable to execute action. No card drawn.';
      switch (id) {
        case 'play': return 'Unable to execute action. No card drawn.';
        case 'draw': return g.card ? 'Unable to execute action while holding a card.' : null;
        case 'redraw': case 'minorArcana': case 'undraw': return g.card ? null : 'Unable to execute action. No card drawn.';
        case 'divination': return g.signs.length >= 3 ? null : 'Unable to execute action. Three seals required.';
        case 'stellarDetonation': return g.star ? null : 'Unable to execute action. Earthly Star required.';
      }
      return null;
    }

    haste() { return 0; }
    mpRegen() { return 200 + Math.floor(150 * (this.stats.piety - 340) / 3300); }
    lucidGain() { return 500; }
    mpCost(id, e) {
      const mp = this.actions[id].mp || 0;
      return mp && e.has('lightspeed') ? Math.round(mp * this.V.ls.mp) : mp;
    }

    snapshot(a, e) {
      let mult = 1;
      if (e.has('divination')) mult *= 1 + (e.statuses.divination.pct || 0.06);
      for (const [c, k] of Object.entries(STATUS)) if (e.has(k)) mult *= MINE[c] ? 1.06 : 1.03;
      if (e.has('ladyOfCrowns')) mult *= 1.08;
      if (e.has('lordOfCrowns')) mult *= 1.04;
      const main = this.stats.main + (e.has('medicated') ? B.TINCTURES[this.V.tincture].cap : 0);
      return { mult, main };
    }

    // One card or crown on you at a time.
    clearBuffs(e) { for (const k of [...Object.values(STATUS), 'lordOfCrowns', 'ladyOfCrowns']) e.removeStatus(k, true); }
    // 5.1–5.25: a Sleeve Draw stack draws the next card when the held one is used.
    nextFromSleeve(e) {
      const g = e.g;
      if (!this.V.sleeveReset && g.sleeve > 0 && e.has('sleeveDraw')) {
        g.sleeve--; g.card = this.drawCard(e);
        if (!g.sleeve) e.removeStatus('sleeveDraw');
      }
      e.emit('card', {});
    }

    resolve(id, e) {
      const a = this.actions[id], g = e.g, V = this.V;
      if (a.card) {
        this.clearBuffs(e);
        e.addStatus(STATUS[id], 15);
        if (e.inCombat) { g.signs.push(SIGN[id]); if (g.signs.length > 3) g.signs.shift(); }
        g.card = null;
        this.nextFromSleeve(e);
        return;
      }
      switch (id) {
        case 'draw':
          g.card = this.drawCard(e);
          if (V.drawMp) this.gainMp(e, V.drawMp);
          // 5.0: Sleeve Draw's stacks make Draw's recast 3s.
          if (V.sleeveReset && g.sleeve > 0 && e.has('sleeveDraw')) {
            g.sleeve--;
            if (e.cds.draw) e.cds.draw.nextAt = e.now + 3;
            if (!g.sleeve) e.removeStatus('sleeveDraw');
          }
          e.emit('card', {});
          return;
        case 'redraw': g.card = this.drawCard(e, null, g.card); e.emit('card', {}); return;
        case 'undraw': g.card = null; this.nextFromSleeve(e); return;
        case 'minorArcana':
          this.clearBuffs(e);
          e.addStatus(MINE[g.card] ? 'ladyOfCrowns' : 'lordOfCrowns', 15);
          g.card = null;
          this.nextFromSleeve(e);
          return;
        case 'sleeveDraw':
          if (V.sleeveReset) {
            const c = e.cds.draw;
            if (c) { c.charges = c.max; c.nextAt = null; }
            g.sleeve = 2; e.addStatus('sleeveDraw', 30);
            e.emit('card', {});
            return;
          }
          if (V.sleeveSeal) {
            const missing = Object.keys(SIGN).filter(c => !g.signs.includes(SIGN[c]));
            g.card = missing.length ? missing[Math.floor(Math.random() * missing.length)] : this.drawCard(e);
            this.gainMp(e, V.drawMp);
          } else {
            g.card = this.drawCard(e); g.sleeve = 2; e.addStatus('sleeveDraw', 30);
          }
          e.emit('card', {});
          return;
        case 'divination': {
          const n = new Set(g.signs).size;
          e.addStatus('divination', 15, { pct: (V.divPct || [0, 0.04, 0.05, 0.06])[n] });
          g.signs = []; e.emit('card', {});
          return;
        }
      }
      super.resolve(id, e);
    }

    drawCard(e, notSign, notCard) {
      const pool = Object.keys(SIGN).filter(c => c !== notCard);
      return pool[Math.floor(Math.random() * pool.length)];
    }

    proc(id, e) {
      const a = this.actions[id], g = e.g;
      if (a.card) return g.card === id;
      if (id === 'play' || id === 'minorArcana') return !!g.card;
      if (id === 'divination') return g.signs.length >= 3;
      if (id === 'stellarDetonation' || id === 'earthlyStar') return e.has('giantDominance');
      return false;
    }

    speedInfo(e) { return `GCD ${e.gcdForSpeed(e.stats.speed).toFixed(2)} · Malefic IV ${e.speedScale(1.5).toFixed(2)}s cast · ${e.maxMp.toLocaleString()} MP`; }

    helpHtml(seq) {
      const V = this.V;
      return `
<h3>How it plays (${V.label})</h3>
<p>Level 80 Astrologian. <b>Malefic IV</b> (${V.malefic}, 1.5s) is the filler and <b>Combust III</b> (${V.combust} a tick for 30s) the DoT. <b>Earthly Star</b> (60s) matures after 10s and goes off by itself at 20s (Stellar Explosion 150). <b>Lightspeed</b> (${V.lsRecast}s) makes casts 2.5s shorter for 15s${V.lsMp < 1 ? ' and halves MP costs' : ''}, so every GCD takes two weaves.</p>
<p><b>Draw</b> (30s${V.drawMp ? ', +8% MP' : ''}) and <b>Play</b> the card on yourself: the Bole, the Ewer and the Spire are +6% for a healer, the others +3%, one at a time. Each card played adds its seal (Solar: Balance/Bole, Lunar: Arrow/Ewer, Celestial: Spear/Spire); with three, <b>Divination</b> is +6% if all three kinds differ (5% for two, 4% for one). <b>Redraw</b> (three charges) a card whose seal you already have; <b>Minor Arcana</b> turns a card into Lady of Crowns (+8% on you) or Lord of Crowns (+4%), with no seal. ${V.sleeveReset ? '<b>Sleeve Draw</b> (180s) resets Draw and makes its recast 3s for two more Draws.' : V.sleeveSeal ? '<b>Sleeve Draw</b> (180s) gives a card with a seal you\'re missing.' : '<b>Sleeve Draw</b> (180s) draws a card and two stacks: each card you use draws the next.'}${V.divPct ? ` In ${V.label} Divination is ${V.divPct.slice(1).map(x => Math.round(x * 100) + '%').join(' / ')} for one / two / three kinds of seal, every ${V.divRecast}s.` : ''}</p>
<h3>The opener (The Balance)</h3>
${seq(['fallMalefic', ['lightspeed'], 'combust3', ['play'], ['draw'], 'fallMalefic', ['play'], ['sleeveDraw'], 'fallMalefic', ['play'], 'fallMalefic', ['divination'], 'fallMalefic'])}
<p>Draw at −30s, Earthly Star at −10s, the tincture at −3s, Malefic IV hardcast at −1.5s. Redraw any card that repeats a seal.</p>
<p style="color:#a9a3b4">${V.label} numbers: Malefic IV ${V.malefic}, Combust III ${V.combust} × 30s, Gravity ${V.gravity}, Stellar Burst 100 / Explosion 150, cards 6% / 3% on yourself, Lady of Crowns 8%, Lord of Crowns 4%, Divination 4 / 5 / 6%. MP: 200 + Piety's share a tick, Lucid Dreaming 500. Gear: ${V.gear}.</p>`;
    }
  }

  B.registerJob({
    id: 'ast', name: 'Astrologian', abbr: 'AST', role: 'healer', classJob: 33,
    versions: ['shb53', 'shb51', 'shb505', 'shb50'].map(v => ({ id: v, label: VERSIONS[v].label, history: VERSIONS[v].history, note: VERSIONS[v].note, create: () => new AstrologianShB(v) })),
  });
})(window.BLM);
