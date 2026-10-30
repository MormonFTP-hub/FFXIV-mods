// Astrologian, Heavensward before 3.4, in three versions. Built on the 3.4–3.57 class (ast_hw.js). Before 3.4 the
// Balance was +10% (15% Enhanced), a drawn card had to be used within 15s or it was lost, Redraw recast in 60s, and
// Celestial Opposition added 5s to buffs.
//  - 3.3–3.38: otherwise as 3.4. Midas gear and the Max-Potion of Mind.
//  - 3.2–3.26: Spread also recasts in 60s.
//  - 3.07–3.15: the button was Shuffle, which could give back the same card; Luminiferous Aether 15s; the Ewer's
//    Refresh 30. Gordias gear and the Draconian Potion of Mind.
//  - 3.05: also the Balance, the Bole and the Arrow last only 15s, and Celestial Opposition recasts in 150s.
//  - 3.0–3.01: and Royal Road worked the other way (an Arrow or Spear spreads the next card at half strength, an Ewer or
//    Spire doubles its time), the Ewer cut MP costs by 20% instead of refreshing, Lightspeed lasted 15s without saving
//    MP, Shuffle recast in 90s and Spread only worked in combat. The i190 gear before Savage.
// Numbers are the Lodestone notes for 3.05–3.4 and the FFXIV wiki's dated card and action revisions (the Ewer's 30 and
// 50 are wiki measurements). ref: scaled from the 3.5 bot by gear and the Balance (no bots of their own yet).
(function (B) {
  const EPS = 1e-6;
  const HW = B.AstrologianHW;
  const set = (A, id, o) => { A[id] = Object.assign({}, A[id], o); };
  const VERSIONS = {
    hw33: { label: 'Heavensward 3.3–3.38', history: 'HW 3.3–3.38', spread: 30, shuffle: false, la: 24, ewer: 442, potion: ['Max-Potion of Mind', 127], ref: 1280,
      stats: { main: 1260, wd: 111, det: 560, crit: 700, speed: 540, piety: 536 }, maxMp: 12670,
      gear: 'a rough Alexander: Midas Savage set (Mind 1,260, the Midan Metal Astrometer: 111 magic damage)',
      note: 'Level 60: the Balance 10%, cards held only 15s, a 60s Redraw, a 30s Spread; Midas gear' },
    hw32: { label: 'Heavensward 3.2–3.26', history: 'HW 3.2–3.26', spread: 60, shuffle: false, la: 24, ewer: 442, potion: ['Max-Potion of Mind', 127], ref: 1270,
      stats: { main: 1250, wd: 111, det: 560, crit: 700, speed: 540, piety: 536 }, maxMp: 12670,
      gear: 'a rough Alexander: Midas Savage set (Mind 1,250, the Midan Metal Astrometer: 111 magic damage)',
      note: 'Level 60: Redraw (no repeats) replaces Shuffle, Luminiferous Aether 24s; the Balance 10%, cards held 15s, a 60s Spread; Midas gear' },
    hw307: { label: 'Heavensward 3.07–3.15', history: 'HW 3.07–3.15', spread: 60, shuffle: true, la: 15, ewer: 265, potion: ['Draconian Potion of Mind', 105], ref: 990,
      stats: { main: 1030, wd: 105, det: 480, crit: 600, speed: 470, piety: 470 }, maxMp: 12240,
      gear: 'a rough Alexander: Gordias Savage set (Mind 1,030, the Gordian Astrometer: 105 magic damage)',
      note: 'Level 60: Shuffle (it can give back the same card), the Balance 10%, cards held 15s, Luminiferous Aether 15s; Gordias gear' },
    hw305: { label: 'Heavensward 3.05–3.05', history: 'HW 3.05–3.05', spread: 60, shuffle: true, la: 15, ewer: 265, potion: ['Draconian Potion of Mind', 105], ref: 970,
      cardDur: { balance: 15, bole: 15, arrow: 15 }, coRecast: 150,
      stats: { main: 1030, wd: 105, det: 480, crit: 600, speed: 470, piety: 470 }, maxMp: 12240,
      gear: 'a rough Alexander: Gordias Savage set (Mind 1,030, the Gordian Astrometer: 105 magic damage)',
      note: 'Level 60: the 3.05 card rework, but the Balance, the Bole and the Arrow last only 15s and Celestial Opposition recasts in 150s; Gordias gear' },
    hw30: { label: 'Heavensward 3.0–3.01', history: 'HW 3.0–3.01', spread: 60, shuffle: true, shuffleRecast: 90, la: 15, ewer: 0, ewerCost: true, potion: ['Draconian Potion of Mind', 105],
      ref: 860, cardDur: { balance: 15, bole: 15, arrow: 15, spear: 20, ewer: 20, spire: 20 }, coRecast: 150, lsDur: 15, spreadInCombat: true,
      roadMap: { balance: 'enhanced', bole: 'enhanced', arrow: 'expanded', spear: 'expanded', ewer: 'extended', spire: 'extended' },
      stats: { main: 950, wd: 100, det: 353, crit: 621, speed: 607, piety: 560 }, maxMp: 12819,
      gear: 'a Prototype Gordian set (i190) with the Hive Planisphere (Mind 950, 100 magic damage)',
      note: 'The launch: Balance/Bole/Arrow 15s, Royal Road on an Arrow or Spear spreads the next card, on an Ewer doubles its time; the Ewer cuts MP costs; Lightspeed 15s without the MP saving; Shuffle 90s' },
  };
  const ROAD_STATUS = { enhanced: 'enhancedRoyalRoad', extended: 'extendedRoyalRoad', expanded: 'expandedRoyalRoad' };

  class AstrologianHWEarly extends HW {
    constructor(version) {
      super();
      const V = VERSIONS[version];
      this.V = Object.assign({}, this.V, { label: V.label });
      this.EV = V;
      this.balanceMag = 0.10;
      this.cardHold = 15;
      this.coExt = 5;
      this.shuffle = V.shuffle;
      this.laDur = V.la;
      this.ewerMp = V.ewer;
      this.potionCap = V.potion[1];
      this.maxMp = V.maxMp;
      const A = Object.assign({}, this.actions);
      if (V.shuffle) set(A, 'redraw', { name: 'Shuffle', recast: V.shuffleRecast || 60, desc: 'Draws a new card in place of the one you hold. It can be the same card.' });
      else set(A, 'redraw', { recast: 60 });
      set(A, 'spread', { recast: V.spread });
      set(A, 'luminiferousAether', { desc: A.luminiferousAether.desc.replace('Duration: 24s', `Duration: ${V.la}s`) });
      set(A, 'celestialOpposition', { desc: A.celestialOpposition.desc.replace('by 10s', 'by 5s') });
      set(A, 'draw', { desc: A.draw.desc.replace('Duration: 30s', 'Duration: 15s (the card is lost if not used)') });
      for (const k of ['balance', 'spreadBalance']) set(A, k, { desc: A[k].desc.replace('20%', '10%') });
      for (const k of ['ewer', 'spreadEwer']) set(A, k, { desc: A[k].desc.replace('potency 50', `potency ${V.ewer === 442 ? 50 : 30}`) });
      A.tincture = Object.assign({}, A.tincture, { name: V.potion[0], desc: `This diluted brew temporarily increases mind.\nMind +20% (Max ${V.potion[1]})\nDuration: 15s` });
      if (V.coRecast) set(A, 'celestialOpposition', { recast: V.coRecast });
      if (V.ewerCost) for (const k of ['ewer', 'spreadEwer']) if (A[k]) set(A, k, { desc: 'Reduces spell MP cost by 20%.\nDuration: 20s' });
      if (V.lsDur) {
        this.V = Object.assign({}, this.V, { ls: Object.assign({}, this.V.ls, { mp: 1 }) });
        set(A, 'lightspeed', { desc: 'Reduces cast time by 2.5 seconds, while lowering all magic potency by 25%.\nDuration: 15s' });
      }
      this.actions = A;
      this.stats = Object.assign({}, this.stats, V.stats);
      this.referenceDps = V.ref;
    }

    check(id, e) {
      if (id === 'spread' && this.EV.spreadInCombat && !e.inCombat) return 'Unable to execute action outside combat.';
      return super.check ? super.check(id, e) : null;
    }

    // 3.0–3.01: the Ewer cuts spell MP by 20% (30% with Royal Road's enhancement).
    mpCost(id, e) {
      const mp = super.mpCost(id, e);
      if (this.EV.ewerCost && mp && e.has('theEwer')) return Math.round(mp * ((e.statuses.theEwer.mag || 1) > 1 ? 0.7 : 0.8));
      return mp;
    }

    // ...and gives no Refresh.
    mpRegen(e) {
      if (!this.EV.ewerCost) return super.mpRegen(e);
      return Math.round(this.maxMp * 0.02) + (e.has('luminiferousAether') ? 707 : 0);
    }

    // 3.05 and before: shorter card durations (Royal Road's extension doubles them).
    playCard(e, card) {
      const road = e.g.road;
      super.playCard(e, card);
      const d = this.EV.cardDur && this.EV.cardDur[card];
      const st = e.statuses['the' + card[0].toUpperCase() + card.slice(1)];
      if (d && st) st.until = e.now + d * (road === 'extended' ? 2 : 1);
    }

    ability(id, e) {
      const g = e.g, map = this.EV.roadMap;
      // 3.0–3.01: Royal Road's effect by the card returned was the other way round for the Arrow/Spear and Ewer/Spire.
      if (id === 'royalRoad' && map && g.card) {
        g.road = map[g.card];
        e.addStatus(ROAD_STATUS[g.road], 1e9, { permanent: true });
        this.discard(e);
        return;
      }
      super.ability(id, e);
      if (id === 'lightspeed' && this.EV.lsDur && e.statuses.lightspeed) e.statuses.lightspeed.until = e.now + this.EV.lsDur;
    }

    // A drawn card not used within 15s is lost, and Draw's recast starts then.
    nextEvent(e) {
      const t = super.nextEvent ? super.nextEvent(e) : Infinity;
      return e.g.card && e.g.cardUntil ? Math.min(t, e.g.cardUntil) : t;
    }
    process(e) {
      if (super.process) super.process(e);
      const g = e.g;
      if (g.card && g.cardUntil && e.now >= g.cardUntil - EPS) this.discard(e);
    }

    helpHtml(seq) {
      const V = this.EV;
      return super.helpHtml(seq).replace(/Heavensward 3\.4–3\.57/g, V.label).replace(/\+20% damage/g, '+10% damage') + `
<p style="color:#a9a3b4">What's different in ${V.label}: the Balance is +10% (15% with Royal Road), a drawn card must be used within 15s or it's lost, ${V.shuffle ? 'Shuffle (60s) can give back the card you hold' : 'Redraw recasts in 60s'}, Spread ${V.spread}s, Celestial Opposition adds 5s${V.shuffle ? ', Luminiferous Aether lasts 15s and the Ewer\'s Refresh is 30' : ''}. Gear is ${V.gear}, with the ${V.potion[0]} (max ${V.potion[1]}).</p>`;
    }
  }

  B.registerJob({
    id: 'ast', name: 'Astrologian', abbr: 'AST', role: 'healer', classJob: 33,
    versions: ['hw33', 'hw32', 'hw307', 'hw305', 'hw30'].map(v => ({ id: v, label: VERSIONS[v].label, history: VERSIONS[v].history, note: VERSIONS[v].note, create: () => new AstrologianHWEarly(v) })),
  });
})(window.BLM);
