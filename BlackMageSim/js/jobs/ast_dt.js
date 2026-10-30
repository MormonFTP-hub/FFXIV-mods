// Astrologian, Dawntrail at level 100, in three versions. Built on the Endwalker class (ast_ew.js) for Fall Malefic,
// Combust III, Gravity II, Earthly Star, Lightspeed and Macrocosmos, with Dawntrail's cards: Astral Draw and Umbral Draw
// take turns on one 55s recast, each restoring 2,000 MP and dealing a whole hand. Astral: the Balance (Play I), the
// Arrow (Play II), the Spire (Play III) and Lord of Crowns (Minor Arcana); Umbral: the Spear, the Bole, the Ewer and
// Lady of Crowns. On yourself (a healer) the Balance is +3% and the Spear +6% for 15s, and both can be on you at once;
// the other four cards don't add damage. Duties start with Astral's hand dealt and Umbral Draw ready. Divination is
// +6% for 20s and readies Oracle (860). Lightspeed has two charges on 60s. No Astrodyne, astrosigns or Redraw.
//  - 7.0: Lightspeed one charge on 90s, draws on 60s, Macrocosmos 250; otherwise as 7.01.
//  - 7.01: the three Plays and their cards share one 1s recast; Oracle full on every target; launch gear.
//  - 7.05–7.38: each Play on its own recast; 7.2 Gravity II 140 and Oracle 50% less for the rest; Cruiserweight gear.
//  - 7.4–7.57: the same kit (Collective Unconscious lasts longer); Heavyweight gear.
// Numbers are the game data at 7.01, 7.05, 7.2 and 7.57 (xivapi's datamining) and the Lodestone notes; gear is The
// Balance's (or the shared healer) set for each tier. ref: a scripted bot parses about 17,750 / 14,870 / 10,170 / 10,020 on these.
(function (B) {
  const EW = B.AstrologianEW;
  const ab = (o) => Object.assign({ kind: 'ogcd' }, o);
  const heal = (o) => Object.assign({ kind: 'gcd', potency: 0, school: 'astral', sound: 'paradox' }, o);
  const base = { level: 100, malefic: 270, combust: 70, lord: 400, macro: 270, divDur: 20, lsRecast: 60, lsCharges: 2, swift: 40, oracle: 860 };
  const VERSIONS = {
    dt74: Object.assign({}, base, { label: 'Dawntrail 7.4–7.57', history: 'DT 7.4–7.57', gravity: 140, oracleAoe: 0.5, sharedPlay: false, tincture: 'mnddt4', gcd: 2.43,
      ref: 18820, stats: { hp: 204485, main: 6496, wd: 158, det: 3340, crit: 3301, dh: 906, speed: 958, piety: 440 },
      gear: 'The Balance\'s 7.4 set at 2.43 (Mind 6,496, 158 magic damage)',
      note: 'Level 100: Astral and Umbral Draw, the Balance and the Spear on yourself, Divination into Oracle, Lightspeed with two charges; Heavyweight gear' }),
    dt705: Object.assign({}, base, { label: 'Dawntrail 7.05–7.38', history: 'DT 7.05–7.38', gravity: 140, oracleAoe: 0.5, sharedPlay: false, tincture: 'mnddt3', gcd: 2.46,
      ref: 15760, stats: { hp: 171375, main: 5643, wd: 152, det: 2510, crit: 3427, dh: 1230, speed: 704, piety: 718 },
      gear: 'The Balance\'s 7.2 set at 2.46 (Mind 5,643, 152 magic damage)',
      note: 'Level 100: the Plays on their own recasts, 7.2 Gravity II 140 and Oracle falloff; Cruiserweight gear' }),
    dt701: Object.assign({}, base, { label: 'Dawntrail 7.01', history: 'DT 7.01', gravity: 130, oracleAoe: true, sharedPlay: true, tincture: 'mnddt1', gcd: 2.42,
      ref: 10780, stats: { hp: 116412, main: 4342, wd: 141, det: 2212, crit: 2978, dh: 852, speed: 1054, piety: 564 },
      gear: 'the launch healer set at 2.42 (Mind 4,342, the 141 extreme-trial weapon)',
      note: 'Level 100, the new cards: Astral and Umbral Draw, the three Plays sharing one recast, Lightspeed with two charges; launch gear' }),
    dt70: Object.assign({}, base, { label: 'Dawntrail 7.0', history: 'DT 7.0', gravity: 130, oracleAoe: true, sharedPlay: true, tincture: 'mnddt1', gcd: 2.42,
      lsRecast: 90, lsCharges: 1, drawRecast: 60, macro: 250,
      ref: 10620, stats: { hp: 116412, main: 4342, wd: 141, det: 2212, crit: 2978, dh: 852, speed: 1054, piety: 564 },
      gear: 'the launch healer set at 2.42 (Mind 4,342, the 141 extreme-trial weapon)',
      note: 'The two-week launch: Lightspeed one charge on 90s, draws on 60s, Macrocosmos 250; the Plays share a recast; launch gear' }),
  };
  // Each card: its Play, which draw deals it, its status, and what it does for you.
  const CARDS = {
    balanceDt: { name: 'the Balance', play: 1, draw: 'astral', status: 'dtBalance', mult: 1.03, desc: 'Increases damage dealt by a party member by 6% (melee or tank), 3% for others.' },
    spearDt: { name: 'the Spear', play: 1, draw: 'umbral', status: 'dtSpear', mult: 1.06, desc: 'Increases damage dealt by a party member by 6% (ranged or healer), 3% for others.' },
    arrowDt: { name: 'the Arrow', play: 2, draw: 'astral', status: 'dtArrow', desc: 'Increases HP recovered by healing magic by 10%.' },
    boleDt: { name: 'the Bole', play: 2, draw: 'umbral', status: 'dtBole', desc: 'Reduces damage taken by 10%.' },
    spireDt: { name: 'the Spire', play: 3, draw: 'astral', status: 'dtSpire', desc: 'Grants a barrier that absorbs damage equal to a heal of 400 potency.' },
    ewerDt: { name: 'the Ewer', play: 3, draw: 'umbral', status: 'dtEwer', desc: 'Grants a regen of 200 potency.' },
  };
  const HAND = { astral: { 1: 'balanceDt', 2: 'arrowDt', 3: 'spireDt', crown: 'lord' }, umbral: { 1: 'spearDt', 2: 'boleDt', 3: 'ewerDt', crown: 'lady' } };

  class AstrologianDT extends EW {
    constructor(version) {
      const V = VERSIONS[version];
      super(V);
      this.model = 'ast-dt';
      const A = Object.assign({}, this.actions);
      for (const k of ['draw', 'redraw', 'play', 'astrodyne', 'balance', 'bole', 'arrow', 'ewer', 'spear', 'spire', 'aspectedHelios']) delete A[k];
      const cap = (s) => s[0].toUpperCase() + s.slice(1);
      A.astralDraw = ab({ name: 'Astral Draw', recast: V.drawRecast || 55, cdGroup: 'draw', desc: 'Draws the Balance, the Arrow, the Spire and Lord of Crowns.\nAdditional Effect: Restores 20% of maximum MP\nShares a recast timer with Umbral Draw.\n※Action changes to Umbral Draw after use.' });
      A.umbralDraw = ab({ name: 'Umbral Draw', recast: V.drawRecast || 55, cdGroup: 'draw', desc: 'Draws the Spear, the Bole, the Ewer and Lady of Crowns.\nAdditional Effect: Restores 20% of maximum MP\nShares a recast timer with Astral Draw.\n※Action changes to Astral Draw after use.' });
      for (const n of [1, 2, 3]) {
        A['play' + n] = ab({ name: 'Play ' + 'I'.repeat(n), recast: 1, cdGroup: V.sharedPlay ? 'play' : 'play' + n,
          desc: `Plays the card in slot ${'I'.repeat(n)} (here, on yourself).\n※Action changes to the card you hold.${V.sharedPlay ? '\nShares a recast timer with the other Plays.' : ''}` });
      }
      for (const [k, c] of Object.entries(CARDS)) {
        A[k] = ab({ name: cap(c.name), recast: 1, cdGroup: V.sharedPlay ? 'play' : 'play' + c.play, dtCard: k, desc: `${c.desc}\nDuration: 15s` });
      }
      A.minorArcana = ab({ name: 'Minor Arcana', recast: 1, iconOf: 'minorArcanaDt', desc: 'Plays the crown in your hand: Lord of Crowns (from Astral Draw) or Lady of Crowns (from Umbral Draw).\n※Action changes to the crown you hold.' });
      A.oracle = ab({ name: 'Oracle', recast: 1, potency: V.oracle, target: true, range: 25, aoe: V.oracleAoe, delay: 0.8, fx: 'gnbZone',
        desc: `Deals unaspected damage to target and all enemies nearby it with a potency of ${V.oracle}${V.oracleAoe === true ? '' : ' for the first enemy, and 50% less for all remaining enemies'}.\nCan only be executed while under the effect of Divining.` });
      A.divination = ab({ name: 'Divination', recast: 120, desc: 'Increases damage dealt by yourself and nearby party members by 6%.\nDuration: 20s\nAdditional Effect: Grants Divining (Oracle)\nDuration: 30s\n※Action changes to Oracle while under the effect of Divining.' });
      A.heliosConjunction = heal({ name: 'Helios Conjunction', cast: 1.5, mp: 700, desc: 'Restores own HP and the HP of all nearby party members.\nCure Potency: 250\nAdditional Effect: Regen\nCure Potency: 175\nDuration: 15s' });
      A.sunSign = ab({ name: 'Sun Sign', recast: 1, desc: 'Reduces damage taken by yourself and nearby party members by 10%.\nDuration: 15s\nCan only be executed while under the effect of Suntouched.' });
      if (version !== 'dt701') A.esuna = Object.assign({}, A.esuna, { cast: undefined });
      A.tincture = B.tincture(V.tincture);
      this.actions = A;
      this.statuses = Object.assign({}, this.statuses, {
        divining: { name: 'Divining', self: true, icon: 'st_divining' },
        suntouched: { name: 'Suntouched', self: true, icon: 'st_suntouched' },
        ...Object.fromEntries(Object.values(CARDS).map(c => [c.status, { name: cap(c.name), self: true, icon: 'st_' + c.status }])),
      });
      this.selfStatusOrder = ['divination', 'divining', 'dtBalance', 'dtSpear', 'lightspeed', 'swiftcast', 'medicated', 'lucidDreaming', 'dtArrow', 'dtBole',
        'dtSpire', 'dtEwer', 'earthlyDominance', 'giantDominance', 'macrocosmos', 'suntouched', 'surecast', 'sprint'];
      this.defaultBars = [
        ['fallMalefic', 'combust3', 'astralDraw', 'play1', 'play2', 'play3', 'minorArcana', 'divination', 'earthlyStar', 'lightspeed', 'lucidDreaming', 'tincture'],
        ['gravity2', 'macrocosmos', 'benefic', 'benefic2', 'aspectedBenefic', 'helios', 'heliosConjunction', 'essentialDignity', 'celestialIntersection',
          'celestialOpposition', 'collectiveUnconscious', 'swiftcast'],
        ['horoscope', 'neutralSect', 'sunSign', 'exaltation', 'synastry', 'microcosmos', 'surecast', 'rescue', 'esuna', 'repose', 'sprint', null],
      ];
      this.actionGroups = [
        ['Astrologian', ['fallMalefic', 'combust3', 'gravity2', 'macrocosmos', 'microcosmos', 'earthlyStar', 'stellarDetonation', 'divination', 'oracle',
          'lightspeed', 'astralDraw', 'umbralDraw', 'play1', 'play2', 'play3', ...Object.keys(CARDS), 'minorArcana', 'lordOfCrowns', 'ladyOfCrowns',
          'benefic', 'benefic2', 'aspectedBenefic', 'helios', 'heliosConjunction', 'essentialDignity', 'celestialIntersection', 'celestialOpposition',
          'collectiveUnconscious', 'horoscope', 'neutralSect', 'sunSign', 'exaltation', 'synastry']],
        ['Role Actions', ['swiftcast', 'lucidDreaming', 'surecast', 'rescue', 'esuna', 'repose']],
        ['General', ['sprint', 'tincture']],
      ];
    }

    // Duties start with Astral Draw's hand dealt and Umbral Draw next.
    initGauge() { return { hand: Object.assign({}, HAND.astral), next: 'umbral', star: null }; }

    resolveId(id, e) {
      const g = e.g;
      switch (id) {
        case 'astralDraw': case 'umbralDraw': return g.next === 'astral' ? 'astralDraw' : 'umbralDraw';
        case 'play1': case 'play2': case 'play3': return g.hand[id.slice(4)] || id;
        case 'minorArcana': return g.hand.crown === 'lord' ? 'lordOfCrowns' : g.hand.crown === 'lady' ? 'ladyOfCrowns' : id;
        case 'divination': return e.has('divining') ? 'oracle' : id;
        case 'neutralSect': return e.has('suntouched') ? 'sunSign' : id;
      }
      return super.resolveId(id, e);
    }

    check(id, e) {
      const a = this.actions[id], g = e.g;
      if (a.dtCard) return g.hand[CARDS[id].play] === id ? null : 'Unable to execute action. No card drawn.';
      switch (id) {
        case 'play1': case 'play2': case 'play3': case 'minorArcana': return 'Unable to execute action. No card drawn.';
        case 'astralDraw': return g.next === 'astral' ? null : 'Unable to execute action.';
        case 'umbralDraw': return g.next === 'umbral' ? null : 'Unable to execute action.';
        case 'lordOfCrowns': return g.hand.crown === 'lord' ? null : 'Unable to execute action.';
        case 'ladyOfCrowns': return g.hand.crown === 'lady' ? null : 'Unable to execute action.';
        case 'oracle': return e.has('divining') ? null : 'Unable to execute action. Divining required.';
        case 'sunSign': return e.has('suntouched') ? null : 'Unable to execute action.';
      }
      return super.check(id, e);
    }

    haste() { return 0; }

    snapshot(a, e) {
      let mult = 1;
      if (e.has('divination')) mult *= 1.06;
      for (const c of Object.values(CARDS)) if (c.mult && e.has(c.status)) mult *= c.mult;
      const main = this.stats.main + (e.has('medicated') ? B.TINCTURES[this.V.tincture].cap : 0);
      return { mult, main };
    }

    resolve(id, e) {
      const a = this.actions[id], g = e.g;
      if (a.dtCard) {
        g.hand[CARDS[id].play] = null;
        e.addStatus(CARDS[id].status, 15);
        e.emit('card', {});
        return;
      }
      switch (id) {
        case 'astralDraw': case 'umbralDraw': {
          const kind = id === 'astralDraw' ? 'astral' : 'umbral';
          g.hand = Object.assign({}, HAND[kind]);
          g.next = kind === 'astral' ? 'umbral' : 'astral';
          this.gainMp(e, 2000);
          e.emit('card', {});
          return;
        }
        case 'lordOfCrowns': case 'ladyOfCrowns':
          g.hand.crown = null; e.emit('card', {});
          if (a.potency) e.queueHit(id, a.potency, this.snapshot(a, e), a.delay);
          return;
        case 'divination': e.addStatus('divination', 20); e.addStatus('divining', 30); return;
        case 'oracle': e.removeStatus('divining'); break;
        case 'neutralSect': e.addStatus('suntouched', 30); return;
        case 'sunSign': e.removeStatus('suntouched'); return;
        default: return super.resolve(id, e);
      }
      if (a.potency) e.queueHit(id, a.potency, this.snapshot(a, e), a.delay);
    }

    proc(id, e) {
      const a = this.actions[id], g = e.g;
      if (a.dtCard) return g.hand[CARDS[id].play] === id;
      switch (id) {
        case 'play1': case 'play2': case 'play3': return !!g.hand[id.slice(4)];
        case 'minorArcana': case 'lordOfCrowns': case 'ladyOfCrowns': return !!g.hand.crown;
        case 'oracle': case 'divination': return e.has('divining');
        case 'sunSign': return e.has('suntouched');
      }
      if (id === 'stellarDetonation' || id === 'earthlyStar') return e.has('giantDominance');
      return false;
    }

    speedInfo(e) { return `GCD ${e.gcdForSpeed(e.stats.speed).toFixed(2)} · Fall Malefic ${e.speedScale(1.5).toFixed(2)}s cast · ${e.maxMp.toLocaleString()} MP`; }

    // ---------- the Arcana Gauge: the hand of four and the next draw ----------
    gaugeBuild(root) {
      root.innerHTML = `
<svg width="360" height="150" viewBox="0 0 360 150">
  <rect x="8" y="10" width="344" height="130" rx="14" fill="rgba(14,12,20,.86)" stroke="rgba(255,255,255,.22)"/>
  <text x="24" y="34" font-family="Noto Sans, sans-serif" font-size="11" font-weight="600" fill="#a9a3b4" letter-spacing="1">ARCANA</text>
  <text id="ad-n" x="336" y="34" text-anchor="end" font-family="Noto Sans, sans-serif" font-size="11" font-weight="700" fill="#a9a3b4" letter-spacing="1"></text>
  ${['I', 'II', 'III', 'CROWN'].map((l, k) => `<g transform="translate(${24 + k * 80} 44)"><rect width="68" height="78" rx="6" fill="#1d1a2a" stroke="rgba(255,255,255,.3)"/>
    <text x="34" y="16" text-anchor="middle" font-family="Noto Sans, sans-serif" font-size="9" font-weight="600" fill="#a9a3b4" letter-spacing="1">${l}</text>
    <text id="ad-c${k}" x="34" y="48" text-anchor="middle" font-family="Noto Sans, sans-serif" font-size="11" font-weight="700" fill="#ffd98a"></text></g>`).join('')}
</svg>`;
      const $ = (s) => root.querySelector(s);
      this.ad = { n: $('#ad-n'), c: [0, 1, 2, 3].map(k => $('#ad-c' + k)), cache: {} };
    }

    gaugeUpdate(e) {
      const G = this.ad, c = G.cache, g = e.g;
      const put = (k, v, fn) => { if (c[k] !== v) { c[k] = v; fn(v); } };
      put('n', g.next, v => { G.n.textContent = 'NEXT: ' + (v === 'astral' ? 'ASTRAL DRAW' : 'UMBRAL DRAW'); });
      for (const n of [1, 2, 3]) {
        put('c' + n, g.hand[n] || '', v => {
          G.c[n - 1].textContent = v ? CARDS[v].name.replace('the ', '').toUpperCase() : '';
          G.c[n - 1].setAttribute('fill', v && CARDS[v].draw === 'astral' ? '#ffd98a' : '#a8c8ff');
        });
      }
      put('cr', g.hand.crown || '', v => { G.c[3].textContent = v === 'lord' ? 'LORD' : v === 'lady' ? 'LADY' : ''; G.c[3].setAttribute('fill', v === 'lord' ? '#ff8a6a' : '#ffd0f0'); });
    }

    helpHtml(seq) {
      const V = this.V;
      return `
<h3>How it plays (${V.label})</h3>
<p>Level 100 Astrologian. <b>Fall Malefic</b> (270, 1.5s) is the filler and <b>Combust III</b> (70 a tick for 30s) the DoT. <b>Earthly Star</b> (60s) matures after 10s: <b>Stellar Detonation</b> then gives Stellar Explosion (310) instead of Stellar Burst (205), and it goes off by itself at 20s. <b>Divination</b> (+6% for 20s, 120s) readies <b>Oracle</b> (860${V.oracleAoe === true ? '' : ', 50% less for other enemies'}). <b>Lightspeed</b> (two charges, 60s) makes casts 2.5s shorter for 15s.</p>
<p><b>Astral Draw</b> and <b>Umbral Draw</b> take turns on one 55s recast, each dealing a whole hand and restoring 2,000 MP. Astral: <b>the Balance</b> (Play I: +3% on you as a healer, 6% on a melee), the Arrow, the Spire and <b>Lord of Crowns</b> (400 around you, on Minor Arcana). Umbral: <b>the Spear</b> (Play I: +6% on you), the Bole, the Ewer and Lady of Crowns. The Balance and the Spear can both be on you. Duties start with Astral's hand dealt and Umbral Draw ready; at one minute Astral Draw again and hold the Balance and Lord of Crowns for Divination at two.${V.sharedPlay ? ' In 7.01 the three Plays share one 1s recast.' : ''}</p>
<h3>The opener (The Balance)</h3>
${seq(['fallMalefic', ['tincture'], 'combust3', ['lightspeed'], 'fallMalefic', 'fallMalefic', ['divination'], ['play1'], 'fallMalefic', ['minorArcana'], ['umbralDraw'], 'fallMalefic', ['play1'], ['oracle'], 'fallMalefic', 'fallMalefic', 'fallMalefic', 'fallMalefic', 'fallMalefic', 'combust3', 'fallMalefic'])}
<p>Earthly Star at −4s (it explodes by itself about 16s in) and Fall Malefic hardcast at −2.1s; the tincture weaves right after it.</p>
<p style="color:#a9a3b4">${V.label} numbers: Fall Malefic 270, Combust III 70 × 30s, Gravity II ${V.gravity}, Stellar Burst 205 / Explosion 310, Lord of Crowns 400, Oracle 860, Macrocosmos 270. Gear: ${V.gear}.</p>`;
    }
  }

  B.registerJob({
    id: 'ast', name: 'Astrologian', abbr: 'AST', role: 'healer', classJob: 33,
    versions: ['dt74', 'dt705', 'dt701', 'dt70'].map(v => ({ id: v, label: VERSIONS[v].label, history: VERSIONS[v].history, note: VERSIONS[v].note, create: () => new AstrologianDT(v) })),
  });
})(window.BLM);
