// Astrologian, Stormblood (4.0–4.58) at level 70, in five versions. The Stormblood card game: Draw a card, then play
// it on yourself (the Balance +10% damage, the Spear +10% crit, the Arrow 10% haste, the Ewer MP), turn it into a
// Royal Road buff for the next card (Enhanced ×1.5, Extended ×2 duration, Expanded AoE at half), keep it in the
// Spread, or turn it into Lord of Crowns (300) or Lady of Crowns with Minor Arcana; Sleeve Draw fills all of that at
// once. Damage is Malefic III, Combust II, Earthly Star and Lord of Crowns, with Cleric Stance.
//  - 4.0–4.01: the Balance is +20% damage (Enhanced 30%), and the Spear has no crit: it cuts the recast of abilities
//    used under it by 20% (20s). Undraw recasts in 5s; no Empty Road or Undraw Spread yet (both 4.05). Numbers from
//    2017's job guide (Wayback) and the 4.05 patch notes. ref: scaled from the 4.05 bot by the bigger Balance.
//  - 4.05–4.18: the Spear lasts 20s, Malefic has a 2.5s cast, Lightspeed costs 25% potency (150s).
//  - 4.2–4.25: the Spear lasts 30s.
//  - 4.3–4.36: Malefic 1.5s casts, Aspected Helios 2.5s, Lightspeed −50% MP with no potency cost (120s).
//  - 4.4–4.58: Minor Arcana and Lord / Lady of Crowns recast 1s (was 5s).
// Numbers are the game data at 4.11, 4.2, 4.25, 4.38 and 4.58 (xivapi's datamining; there's none before 4.11), and
// the wiki's patch histories. The tincture is the one of the time: the ungraded Infusion (max 137) to 4.18, Grade 2
// (165) in 4.2–4.38, Grade 3 (225) from 4.4.
(function (B) {
  const EPS = 1e-6;
  // Stormblood MP at level 70: 124% (Astrologian's modifier) of 12,000 plus 6,000 × (Piety − 292) / 2,170. Healers
  // wore Piety, which was the only way to more MP: regen is a share of the pool.
  const maxMpFor = (piety) => Math.floor(1.24 * (6000 * (piety - 292) / 2170 + 12000));
  const FALLOFF = [1, 0.9, 0.8, 0.7, 0.6, 0.5];
  const CARDS = ['balance', 'bole', 'arrow', 'spear', 'ewer', 'spire'];
  const CARD = {
    balance: { status: 'theBalance', road: 'enhanced', name: 'the Balance' },
    bole: { status: 'theBole', road: 'enhanced', name: 'the Bole' },
    arrow: { status: 'theArrow', road: 'extended', name: 'the Arrow' },
    spear: { status: 'theSpear', road: 'extended', name: 'the Spear' },
    ewer: { status: 'theEwer', road: 'expanded', name: 'the Ewer' },
    spire: { status: 'theSpire', road: 'expanded', name: 'the Spire' },
  };
  const ROAD_STATUS = { enhanced: 'enhancedRoyalRoad', extended: 'extendedRoyalRoad', expanded: 'expandedRoyalRoad' };
  const cap = (s) => s[0].toUpperCase() + s.slice(1);

  // Gear: rough sets for each tier (Deltascape item level 340, Sigmascape 370, Alphascape 400), level-70 stats; weapon
  // magic damage 134 / 140 / 146 from the 4.58 item data.
  const GEAR = {
    i340: { hp: 26000, main: 2500, wd: 134, det: 1150, crit: 1900, dh: 1250, speed: 650, piety: 900 },
    i370: { hp: 28500, main: 2900, wd: 140, det: 1300, crit: 2200, dh: 1450, speed: 750, piety: 1000 },
    i400: { hp: 31000, main: 3300, wd: 146, det: 1500, crit: 2500, dh: 1650, speed: 850, piety: 1100 },
  };
  // ref: a scripted bot (Lucid on cooldown, Lightspeed for MP, cards on itself) parses about 2,650 / 3,300 / 3,800 / 4,650
  // in these four over 5 minutes; the first two are MP-limited, as healers were before 4.3's Lightspeed.
  const VERSIONS = {
    sb40: { label: 'Stormblood 4.0–4.01', history: 'SB 4.0–4.01', spear: 20, malefic: 2.5, aspHelios: 3, ls: { mp: 0.75, potency: 0.75, recast: 150 }, arcana: 5, gear: 'i340', ref: 2900,
      early: true, balance: 0.20, tincture: 'mnd1sb',
      note: 'Level 70, the launch: the Balance +20%, the Spear cuts ability recasts by 20% (no crit), Undraw 5s, no Empty Road or Undraw Spread' },
    sb405: { label: 'Stormblood 4.05–4.18', history: 'SB 4.05–4.18', spear: 20, malefic: 2.5, aspHelios: 3, ls: { mp: 0.75, potency: 0.75, recast: 150 }, arcana: 5, gear: 'i340', ref: 2810, tincture: 'mnd1sb',
      note: 'Level 70. The Stormblood card game: Balance 10%, the Spear 20s, Royal Road, Spread, Minor Arcana and Sleeve Draw. 2.5s Malefic, Lightspeed costs 25% potency' },
    sb42: { label: 'Stormblood 4.2–4.25', history: 'SB 4.2–4.25', spear: 30, malefic: 2.5, aspHelios: 3, ls: { mp: 0.75, potency: 0.75, recast: 150 }, arcana: 5, gear: 'i370', ref: 3460, tincture: 'mnd2sb',
      note: 'Level 70. As 4.05 with the Spear lasting 30s; Sigmascape gear' },
    sb43: { label: 'Stormblood 4.3–4.36', history: 'SB 4.3–4.36', spear: 30, malefic: 1.5, aspHelios: 2.5, ls: { mp: 0.5, potency: 1, recast: 120 }, arcana: 5, gear: 'i370', ref: 4020, tincture: 'mnd2sb',
      note: 'Level 70. 1.5s Malefic casts, Lightspeed −50% MP with no damage cost (120s)' },
    sb44: { label: 'Stormblood 4.4–4.58', history: 'SB 4.4–4.58', spear: 30, malefic: 1.5, aspHelios: 2.5, ls: { mp: 0.5, potency: 1, recast: 120 }, arcana: 1, gear: 'i400', ref: 4900, tincture: 'mnd3sb',
      note: 'Level 70. Minor Arcana and Lord of Crowns on 1s recasts; Alphascape gear' },
  };

  const spell = (o) => Object.assign({ kind: 'gcd', target: true, range: 25, delay: 0.8, school: 'astral', sound: 'ruin' }, o);
  const heal = (o) => Object.assign({ kind: 'gcd', potency: 0, school: 'astral', sound: 'paradox' }, o);
  const ab = (o) => Object.assign({ kind: 'ogcd' }, o);

  function buildActions(V) {
    const A = {
      malefic3: spell({ name: 'Malefic III', potency: 220, cast: V.malefic, mp: 600, orb: true, desc: 'Deals unaspected damage with a potency of 220.' }),
      combust2: spell({
        name: 'Combust II', potency: 0, mp: 600, dot: { potency: 50, duration: 30 }, sound: 'dot',
        desc: 'Deals unaspected damage over time.\nPotency: 50\nDuration: 30s',
      }),
      gravity: spell({
        name: 'Gravity', potency: 200, cast: 3, mp: 1920, aoe: FALLOFF, delay: 1.0,
        desc: 'Deals unaspected damage to target and all enemies nearby it with a potency of 200 for the first enemy, 10% less for the second, 20% less for the third, 30% less for the fourth, 40% less for the fifth, and 50% less for all remaining enemies.',
      }),
      benefic: heal({ name: 'Benefic', cast: 2, mp: 480, desc: 'Restores target\'s HP.\nCure Potency: 400' }),
      benefic2: heal({ name: 'Benefic II', cast: 2, mp: 1080, desc: 'Restores target\'s HP.\nCure Potency: 650' }),
      aspectedBenefic: heal({ name: 'Aspected Benefic', mp: 1440, desc: 'Restores target\'s HP.\nCure Potency: 200\nDiurnal Sect Effect: Regen (140, 18s). Nocturnal Sect Effect: a barrier.' }),
      helios: heal({ name: 'Helios', cast: 2.5, mp: 1440, desc: 'Restores own HP and the HP of all nearby party members.\nCure Potency: 300' }),
      aspectedHelios: heal({ name: 'Aspected Helios', cast: V.aspHelios, mp: 1800, desc: 'Restores own HP and the HP of all nearby party members.\nCure Potency: 200\nDiurnal Sect Effect: Regen (40, 30s). Nocturnal Sect Effect: a barrier.' }),
      earthlyStar: ab({
        name: 'Earthly Star', recast: 60,
        desc: 'Deploys an Earthly Star (here, at the dummy) and grants Earthly Dominance.\nStellar Detonation within 10s: Stellar Burst, 150 potency to nearby enemies.\nAfter 10s it becomes Giant Dominance: Stellar Explosion, 200 potency to nearby enemies.\nThe star detonates on its own after 20s.\nEarthly Star changes to Stellar Detonation while the star is out.',
      }),
      stellarDetonation: ab({ name: 'Stellar Detonation', recast: 5, desc: 'Detonates the Earthly Star: Stellar Burst (150) under Earthly Dominance, Stellar Explosion (200) under Giant Dominance.' }),
      stellarBurst: { name: 'Stellar Burst', kind: 'hit', potency: 150, aoe: true, school: 'astral', delay: 0.4, sound: 'paradox' },
      stellarExplosion: { name: 'Stellar Explosion', kind: 'hit', potency: 200, aoe: true, school: 'astral', delay: 0.4, big: true, sound: 'paradox' },
      draw: ab({ name: 'Draw', recast: 30, holdCd: true, desc: 'Draws a card (arcanum) from your divining deck.\nDuration: 30s\nRecast timer begins once the card is used or its effect ends.\nDraw changes to the card you drew; play it on yourself.' }),
      redraw: ab({ name: 'Redraw', recast: 30, desc: 'Draws a different card in place of the one you hold.' }),
      undraw: ab({ name: 'Undraw', recast: V.early ? 5 : 3, desc: 'Returns the drawn card to the deck.' }),
      royalRoad: ab({ name: 'Royal Road', recast: 15, desc: 'Returns the drawn card to the deck and enhances the next card played:\nthe Balance or the Bole: Enhanced Royal Road, 150% effect\nthe Arrow or the Spear: Extended Royal Road, double duration\nthe Ewer or the Spire: Expanded Royal Road, an AoE version at half effect' + (V.early ? '' : '\nRoyal Road changes to Empty Road while a road effect is stored.') }),
      emptyRoad: ab({ name: 'Empty Road', recast: 3, desc: 'Removes the stored Royal Road effect.' }),
      spread: ab({ name: 'Spread', recast: 30, holdCd: true, desc: 'Places the drawn card in the Spread, where it keeps indefinitely.\nRecast timer begins once the spread card is used or returned.\nSpread changes to the spread card; play it on yourself.' }),
      undrawSpread: ab({ name: 'Undraw Spread', recast: 3, desc: 'Returns the spread card to the deck.' }),
      minorArcana: ab({ name: 'Minor Arcana', recast: V.arcana, holdCd: true, desc: `Turns the drawn card into Lord of Crowns or Lady of Crowns.\nRecast timer (${V.arcana}s) begins once that card is played.\nMinor Arcana changes to the card it turned into.` }),
      lordOfCrowns: ab({ name: 'Lord of Crowns', recast: V.arcana, cdGroup: 'crown', potency: 300, target: true, range: 25, delay: 0.6, school: 'astral', sound: 'xeno', desc: 'Deals unaspected damage with a potency of 300.' }),
      ladyOfCrowns: ab({ name: 'Lady of Crowns', recast: V.arcana, cdGroup: 'crown', desc: 'Restores own HP and the HP of all nearby party members.\nCure Potency: 500' }),
      sleeveDraw: ab({ name: 'Sleeve Draw', recast: 120, desc: 'Executes Draw, Royal Road, Spread and Minor Arcana in succession, without replacing a card you already hold in any of them.' }),
      timeDilation: ab({ name: 'Time Dilation', recast: 90, desc: 'Extends the duration of your card effect on the target by 15s.' }),
      celestialOpposition: ab({ name: 'Celestial Opposition', recast: 120, desc: 'Stuns nearby enemies.\nDuration: 4s\nAdditional Effect: Extends the duration of beneficial effects on self and nearby party members by 10s.' }),
      essentialDignity: ab({ name: 'Essential Dignity', recast: 40, desc: 'Restores target\'s HP.\nCure Potency: 400 (more the lower the target\'s HP)' }),
      synastry: ab({ name: 'Synastry', recast: 90, desc: 'Each time you cast a single-target healing spell on yourself or a party member, the party member under the effect of Synastry is also healed by 40% of the HP restored.\nDuration: 20s' }),
      collectiveUnconscious: ab({ name: 'Collective Unconscious', recast: 90, desc: 'Creates a celestial ring around the caster.\nDiurnal Sect Effect: Regen. Nocturnal Sect Effect: reduces damage taken by 10%.\nCan only be executed while under the effect of Diurnal Sect or Nocturnal Sect.' }),
      lightspeed: ab({
        name: 'Lightspeed', recast: V.ls.recast,
        desc: V.ls.potency < 1
          ? 'Reduces spell MP cost by 25% and cast time by 2.5 seconds, while lowering attack magic potency by 25%.\nDuration: 10s'
          : 'Reduces spell MP cost by 50% and cast time by 2.5 seconds.\nDuration: 10s',
      }),
      diurnalSect: ab({ name: 'Diurnal Sect', recast: 5, cdGroup: 'sect', desc: 'Adds Regen to Aspected spells and increases healing magic potency by 10%. Effect cannot be removed while in combat.' }),
      nocturnalSect: ab({ name: 'Nocturnal Sect', recast: 5, cdGroup: 'sect', desc: 'Adds a barrier to Aspected spells and increases healing magic potency by 15%. Effect cannot be removed while in combat.' }),
      // The healer role actions of 4.x (five could be slotted in Stormblood; these are the usual ones).
      clericStance: ab({ name: 'Cleric Stance', recast: 90, role: true, desc: 'Increases attack magic potency by 5%.\nDuration: 15s' }),
      largesse: ab({ name: 'Largesse', recast: 90, role: true, desc: 'Increases healing magic potency by 20%.\nDuration: 20s' }),
      swiftcast: ab({ name: 'Swiftcast', recast: 60, role: true, desc: 'Next spell is cast immediately.\nDuration: 10s' }),
      lucidDreaming: ab({ name: 'Lucid Dreaming', recast: 120, role: true, desc: 'Reduces enmity by half.\nAdditional Effect: Refresh\nPotency: 80\nDuration: 21s' }),
      surecast: ab({ name: 'Surecast', recast: 30, role: true, desc: 'Spells can be cast without interruption.\nDuration: 5s' }),
      ...B.GENERAL_ACTIONS,
      tincture: B.tincture(V.tincture),
    };
    // Empty Road and Undraw Spread came in 4.05.
    if (V.early) { delete A.emptyRoad; delete A.undrawSpread; }
    const effect = {
      balance: `Increases damage dealt by ${Math.round((V.balance || 0.10) * 100)}%.\nDuration: 30s`,
      bole: 'Reduces damage taken by 20%.\nDuration: 30s',
      arrow: 'Reduces weaponskill and spell cast time and recast time, and auto-attack delay by 10%.\nDuration: 30s',
      spear: V.early ? `Reduces ability recast time by 20%.\nDuration: ${V.spear}s` : `Increases critical hit rate by 10%.\nDuration: ${V.spear}s`,
      ewer: 'Grants Refresh (potency 50).\nDuration: 15s',
      spire: 'Grants TP regeneration.\nDuration: 15s',
    };
    // Each card from Draw, and again from the Spread (same card, same art).
    for (const c of CARDS) {
      A[c] = ab({ name: cap(CARD[c].name), recast: 1, cdGroup: 'card', card: c, desc: effect[c] + '\nPlayed on yourself here.' });
      A['spread' + cap(c)] = ab({ name: cap(CARD[c].name), recast: 1, cdGroup: 'card', card: c, fromSpread: true, iconOf: c, desc: effect[c] + '\nPlayed from the Spread.' });
    }
    return A;
  }

  const STATUSES = {
    theBalance: { name: 'The Balance', self: true, icon: 'st_balance' },
    theBole: { name: 'The Bole', self: true, icon: 'st_bole' },
    theArrow: { name: 'The Arrow', self: true, icon: 'st_arrow' },
    theSpear: { name: 'The Spear', self: true, icon: 'st_spear' },
    theEwer: { name: 'The Ewer', self: true, icon: 'st_ewer' },
    theSpire: { name: 'The Spire', self: true, icon: 'st_spire' },
    enhancedRoyalRoad: { name: 'Enhanced Royal Road', self: true, icon: 'st_road' },
    extendedRoyalRoad: { name: 'Extended Royal Road', self: true, icon: 'st_road' },
    expandedRoyalRoad: { name: 'Expanded Royal Road', self: true, icon: 'st_road' },
    lightspeed: { name: 'Lightspeed', self: true, icon: 'st_lightspeed' },
    clericStance: { name: 'Cleric Stance', self: true, icon: 'st_cleric' },
    earthlyDominance: { name: 'Earthly Dominance', self: true, icon: 'st_star' },
    giantDominance: { name: 'Giant Dominance', self: true, icon: 'st_star' },
    diurnalSect: { name: 'Diurnal Sect', self: true, icon: 'st_sect' },
    nocturnalSect: { name: 'Nocturnal Sect', self: true, icon: 'st_sect' },
    largesse: { name: 'Largesse', self: true, icon: 'st_largesse' },
    combust2: { name: 'Combust II', self: false, icon: 'st_combust' },
  };

  class AstrologianSB {
    constructor(version) {
      const V = VERSIONS[version];
      this.V = V;
      this.name = 'Astrologian';
      this.abbr = 'AST';
      this.role = 'healer';
      this.level = 70;
      this.levelKey = 'sb70';
      this.model = 'ast-sb';
      this.maxMp = maxMpFor(GEAR[V.gear].piety);
      this.actions = buildActions(V);
      this.statuses = STATUSES;
      // Magick and Mend II: +30% to the healer's damage.
      this.stats = Object.assign({ mainStat: 'mnd', jobMod: 115, trait: 130, delay: 3.2 }, GEAR[V.gear]);
      this.speedName = 'Spell speed';
      this.selfStatusOrder = ['theBalance', 'theSpear', 'theArrow', 'theEwer', 'theBole', 'theSpire', 'enhancedRoyalRoad',
        'extendedRoyalRoad', 'expandedRoyalRoad', 'clericStance', 'lightspeed', 'swiftcast', 'earthlyDominance', 'giantDominance',
        'medicated', 'lucidDreaming', 'largesse', 'diurnalSect', 'nocturnalSect', 'surecast', 'sprint'];
      this.targetStatusOrder = ['combust2'];
      this.defaultBars = [
        ['malefic3', 'combust2', 'draw', 'royalRoad', 'spread', 'minorArcana', 'redraw', 'undraw', 'earthlyStar', 'sleeveDraw', 'clericStance', 'lightspeed'],
        ['gravity', 'swiftcast', 'lucidDreaming', 'tincture', 'timeDilation', 'celestialOpposition', 'essentialDignity', 'benefic2', 'aspectedBenefic', 'helios', 'aspectedHelios', 'diurnalSect'],
        ['undrawSpread', 'nocturnalSect', 'benefic', 'synastry', 'collectiveUnconscious', 'largesse', 'surecast', 'sprint', null, null, null, null],
      ];
      this.actionGroups = [
        ['Astrologian', ['malefic3', 'combust2', 'gravity', 'earthlyStar', 'stellarDetonation', 'draw', 'redraw', 'undraw', 'royalRoad', 'emptyRoad',
          'spread', 'undrawSpread', 'minorArcana', 'lordOfCrowns', 'ladyOfCrowns', 'sleeveDraw', 'timeDilation', 'celestialOpposition',
          'lightspeed', 'benefic', 'benefic2', 'aspectedBenefic', 'helios', 'aspectedHelios', 'essentialDignity', 'synastry',
          'collectiveUnconscious', 'diurnalSect', 'nocturnalSect']],
        ['Role Actions', ['clericStance', 'swiftcast', 'lucidDreaming', 'largesse', 'surecast']],
        ['General', ['sprint', 'tincture']],
      ];
      if (V.early) {
        const gone = (x) => x === 'emptyRoad' || x === 'undrawSpread';
        this.defaultBars = this.defaultBars.map(r => r.map(x => (gone(x) ? null : x)));
        this.actionGroups = this.actionGroups.map(([n, ids]) => [n, ids.filter(x => !gone(x))]);
      }
      this.referenceDps = V.ref;
      this.referenceGcd = 2.45;
      this.startDistance = 12;
    }

    initGauge() { return { card: null, cardUntil: 0, spread: null, road: null, arcana: null, star: null }; }

    // Buttons that turn into what you hold: Draw into the drawn card, Spread into the spread card, Royal Road into
    // Empty Road, Minor Arcana into Lord or Lady of Crowns, Earthly Star into Stellar Detonation.
    resolveId(id, e) {
      const g = e.g;
      if (id === 'draw' && g.card) return g.card;
      if (id === 'spread' && g.spread) return 'spread' + cap(g.spread);
      if (id === 'royalRoad' && g.road && !this.V.early) return 'emptyRoad';
      if (id === 'minorArcana' && g.arcana) return g.arcana === 'lord' ? 'lordOfCrowns' : 'ladyOfCrowns';
      if (id === 'earthlyStar' && g.star) return 'stellarDetonation';
      return id;
    }

    check(id, e) {
      const a = this.actions[id], g = e.g;
      const needCard = ['redraw', 'undraw', 'royalRoad', 'minorArcana'].includes(id) || (id === 'spread' && !g.spread);
      if (needCard && !g.card) return 'Unable to execute action. No card drawn.';
      if (a.card && !a.fromSpread && g.card !== a.card) return 'Unable to execute action.';
      if (a.fromSpread && g.spread !== a.card) return 'Unable to execute action.';
      if (id === 'royalRoad' && g.road) return 'Unable to execute action. Royal Road already in effect.';
      if (id === 'emptyRoad' && !g.road) return 'Unable to execute action.';
      if (id === 'undrawSpread' && !g.spread) return 'Unable to execute action. No card in the Spread.';
      if (id === 'minorArcana' && g.arcana) return 'Unable to execute action.';
      if ((id === 'lordOfCrowns' && g.arcana !== 'lord') || (id === 'ladyOfCrowns' && g.arcana !== 'lady')) return 'Unable to execute action.';
      if (id === 'stellarDetonation' && !g.star) return 'Unable to execute action. Earthly Star required.';
      if (id === 'collectiveUnconscious' && !e.has('diurnalSect') && !e.has('nocturnalSect')) return 'Unable to execute action. Sect required.';
      return null;
    }

    haste(e) { return e.has('theArrow') ? 10 * (e.statuses.theArrow.mag || 1) : 0; }

    castTime(id, e) {
      const a = this.actions[id];
      if (!a.cast) return 0;
      if (e.has('swiftcast')) return 0;
      const base = e.has('lightspeed') ? Math.max(0, a.cast - 2.5) : a.cast;
      return base > 0 ? e.speedScale(base, this.haste(e)) : 0;
    }

    consumeInstant(id, e) {
      const a = this.actions[id];
      if (!a.cast) return;
      if (e.has('lightspeed') && a.cast <= 2.5) return;      // Lightspeed made it instant; Swiftcast stays
      if (e.has('swiftcast')) e.removeStatus('swiftcast');
    }

    mpCost(id, e) {
      const a = this.actions[id];
      if (!a.mp) return 0;
      return e.has('lightspeed') ? Math.round(a.mp * this.V.ls.mp) : a.mp;
    }
    mpRegen(e) {
      // The Ewer's Refresh (potency 50) ticks with natural regen here.
      const ewer = e.has('theEwer') ? Math.round(600 * (e.statuses.theEwer.mag || 1)) : 0;
      return Math.round(this.maxMp * 0.02) + ewer;
    }
    lucidGain() { return 960; }

    snapshot(a, e) {
      let mult = 1, critAdd = 0;
      if (e.has('theBalance')) mult *= 1 + (this.V.balance || 0.10) * (e.statuses.theBalance.mag || 1);
      if (e.has('theSpear') && !this.V.early) critAdd += 0.10 * (e.statuses.theSpear.mag || 1);
      if (e.has('clericStance')) mult *= 1.05;
      if (e.has('lightspeed')) mult *= this.V.ls.potency;
      const main = this.stats.main + (e.has('medicated') ? B.TINCTURES[this.V.tincture].cap : 0);
      return { mult, main, critAdd };
    }

    // 4.0–4.01's Spear: abilities whose recast starts under it recast 20% faster (the Expanded Spear is half that).
    recastScale(id, e) {
      if (!this.V.early || !e.has('theSpear') || this.actions[id].kind !== 'ogcd') return 1;
      return 1 - 0.2 * (e.statuses.theSpear.mag || 1);
    }

    resolve(id, e) {
      const a = this.actions[id];
      if (a.kind === 'gcd') this.spell(id, e);
      else this.ability(id, e);
    }

    spell(id, e) {
      const a = this.actions[id];
      e.mp -= this.mpCost(id, e);
      if (a.dot) e.addTStatus(id, a.dot.duration, { snap: this.snapshot(a, e), dot: { potency: a.dot.potency, id } });
      if (a.potency) e.queueHit(id, a.potency, this.snapshot(a, e), a.delay);
    }

    discard(e) { const g = e.g; g.card = null; g.cardUntil = 0; e.startCd('draw'); e.emit('card', {}); }
    randomCard(not) { const pool = CARDS.filter(c => c !== not); return pool[Math.floor(Math.random() * pool.length)]; }

    playCard(e, card) {
      const g = e.g, C = CARD[card];
      let mag = 1, dur = card === 'spear' ? this.V.spear : card === 'ewer' || card === 'spire' ? 15 : 30;
      if (g.road === 'enhanced') mag = 1.5;
      else if (g.road === 'extended') dur *= 2;
      else if (g.road === 'expanded') mag = 0.5;
      if (g.road) { e.removeStatus(ROAD_STATUS[g.road], true); g.road = null; }
      e.addStatus(C.status, dur, { mag });
      e.emit('card', {});
    }

    ability(id, e) {
      const a = this.actions[id], g = e.g;
      if (a.card) {
        this.playCard(e, a.card);
        if (a.fromSpread) { g.spread = null; e.startCd('spread'); } else this.discard(e);
        return;
      }
      switch (id) {
        case 'draw': g.card = this.randomCard(); g.cardUntil = e.now + (this.cardHold || 30); e.emit('card', {}); return;
        case 'redraw': g.card = this.randomCard(this.shuffle ? undefined : g.card); e.emit('card', {}); return;     // Shuffle (to 3.15) could give the same card
        case 'undraw': this.discard(e); return;
        case 'royalRoad':
          g.road = CARD[g.card].road;
          e.addStatus(ROAD_STATUS[g.road], 1e9, { permanent: true });
          this.discard(e);
          return;
        case 'emptyRoad': e.removeStatus(ROAD_STATUS[g.road]); g.road = null; return;
        case 'spread': g.spread = g.card; g.card = null; g.cardUntil = 0; e.startCd('draw'); e.emit('card', {}); return;
        case 'undrawSpread': g.spread = null; e.startCd('spread'); e.emit('card', {}); return;
        case 'minorArcana': g.arcana = Math.random() < 0.5 ? 'lord' : 'lady'; this.discard(e); return;
        case 'lordOfCrowns': case 'ladyOfCrowns': g.arcana = null; e.startCd('minorArcana'); e.emit('card', {}); break;
        case 'sleeveDraw':
          // Fill Royal Road, the Spread and Minor Arcana without replacing anything held, then draw.
          if (!g.road) { g.road = CARD[this.randomCard()].road; e.addStatus(ROAD_STATUS[g.road], 1e9, { permanent: true }); }
          if (!g.spread) g.spread = this.randomCard();
          if (!g.arcana) g.arcana = Math.random() < 0.5 ? 'lord' : 'lady';
          if (!g.card) { g.card = this.randomCard(); g.cardUntil = e.now + (this.cardHold || 30); }
          for (const k of ['draw', 'spread', 'minorArcana']) { const c = e.cds[k]; if (c) { c.charges = c.max; c.nextAt = null; } }
          e.emit('card', {});
          return;
        case 'timeDilation': {
          const k = CARDS.map(c => CARD[c].status).filter(s => e.has(s)).sort((x, y) => e.statuses[y].until - e.statuses[x].until)[0];
          if (k) e.statuses[k].until += 15;
          return;
        }
        case 'celestialOpposition':
          for (const [k, s] of Object.entries(e.statuses)) if (!s.permanent && s.until > e.now && k !== 'medicated') s.until += this.coExt || 10;
          return;
        case 'earthlyStar':
          g.star = { placed: e.now };
          e.addStatus('earthlyDominance', 10);
          return;
        case 'stellarDetonation': this.detonate(e); return;
        case 'lightspeed': e.addStatus('lightspeed', 10); return;
        case 'clericStance': e.addStatus('clericStance', 15); return;
        case 'largesse': e.addStatus('largesse', 20); return;
        case 'diurnalSect': e.removeStatus('nocturnalSect', true); e.addStatus('diurnalSect', 1e9, { permanent: true }); return;
        case 'nocturnalSect': e.removeStatus('diurnalSect', true); e.addStatus('nocturnalSect', 1e9, { permanent: true }); return;
        default:
          if (B.ROLE_EFFECTS[id]) B.ROLE_EFFECTS[id](e);
      }
      if (a.potency) e.queueHit(id, a.potency, this.snapshot(a, e), a.delay);
    }

    // Earthly Star: a Stellar Burst before it matures (10s), a Stellar Explosion after; it goes off by itself at 20s.
    detonate(e) {
      const g = e.g;
      if (!g.star) return;
      const giant = e.now >= g.star.placed + 10 - EPS;
      g.star = null;
      e.removeStatus('earthlyDominance', true); e.removeStatus('giantDominance', true);
      const id = giant ? 'stellarExplosion' : 'stellarBurst';
      e.queueHit(id, this.actions[id].potency, this.snapshot(this.actions[id], e), this.actions[id].delay);
      e.emit('star', { giant });
    }

    nextEvent(e) {
      const g = e.g;
      let t = Infinity;
      if (g.card) t = Math.min(t, g.cardUntil);
      if (g.star) t = Math.min(t, g.star.placed + (e.now < g.star.placed + 10 ? 10 : 20));
      return t;
    }

    process(e) {
      const g = e.g, now = e.now;
      if (g.card && now >= g.cardUntil - EPS) this.discard(e);
      if (g.star) {
        if (now >= g.star.placed + 20 - EPS) this.detonate(e);
        else if (now >= g.star.placed + 10 - EPS && !e.has('giantDominance')) {
          e.removeStatus('earthlyDominance', true);
          e.addStatus('giantDominance', g.star.placed + 20 - now);
        }
      }
    }

    // Hotbar borders: a card in hand or in the Spread, Lord of Crowns, a mature Earthly Star.
    proc(id, e) {
      const a = this.actions[id];
      if (a.card) return true;
      if (id === 'lordOfCrowns') return true;
      if (id === 'stellarDetonation') return e.has('giantDominance');
      return false;
    }

    speedInfo(e) { return `GCD ${e.gcdForSpeed(e.stats.speed).toFixed(2)} · Malefic III ${e.speedScale(this.V.malefic).toFixed(2)}s cast · ${e.maxMp.toLocaleString()} MP`; }

    // ---------- the card gauge: hand, Spread, Royal Road, Minor Arcana ----------
    gaugeBuild(root) {
      const slot = (x, label, id) => `<g transform="translate(${x} 0)">
    <text x="0" y="40" text-anchor="middle" font-family="Noto Sans, sans-serif" font-size="10" font-weight="600" fill="#a9a3b4" letter-spacing="1">${label}</text>
    <rect id="${id}-card" x="-24" y="52" width="48" height="70" rx="6" fill="#1d1a2a" stroke="rgba(255,255,255,.25)" stroke-width="1.5"/>
    <text id="${id}-txt" x="0" y="92" text-anchor="middle" font-family="Cinzel, serif" font-size="11" font-weight="700" fill="#fff" stroke="#000" stroke-width="2.5" paint-order="stroke"></text>
  </g>`;
      root.innerHTML = `
<svg width="360" height="170" viewBox="0 0 360 170">
  <rect x="8" y="10" width="344" height="150" rx="14" fill="rgba(14,12,20,.86)" stroke="rgba(255,255,255,.22)"/>
  ${slot(62, 'DRAWN', 'as-hand')}${slot(142, 'SPREAD', 'as-spread')}${slot(222, 'ROYAL ROAD', 'as-road')}${slot(302, 'ARCANA', 'as-arc')}
  <rect x="38" y="132" width="48" height="5" rx="2.5" fill="#1d1a2a"/><rect id="as-time" x="38" y="132" width="0" height="5" rx="2.5" fill="#e8c86a"/>
</svg>`;
      const $ = (s) => root.querySelector(s);
      this.ag = { cache: {}, time: $('#as-time') };
      for (const k of ['hand', 'spread', 'road', 'arc']) this.ag[k] = { card: $(`#as-${k}-card`), txt: $(`#as-${k}-txt`) };
    }

    gaugeUpdate(e) {
      const G = this.ag, c = G.cache, g = e.g;
      const put = (k, v, fn) => { if (c[k] !== v) { c[k] = v; fn(v); } };
      const COLOR = { balance: '#d9862e', bole: '#5aa04a', arrow: '#3f8fd6', spear: '#2f5fc4', ewer: '#3fb0c4', spire: '#c4a83f',
        enhanced: '#d9862e', extended: '#3f8fd6', expanded: '#3fb0c4', lord: '#b0342e', lady: '#d97fb0' };
      const show = (k, val, label) => put(k, val || '', v => {
        G[k].card.setAttribute('fill', v ? COLOR[v] : '#1d1a2a');
        G[k].card.setAttribute('stroke', v ? '#fff3c4' : 'rgba(255,255,255,.25)');
        G[k].txt.textContent = v ? label : '';
      });
      show('hand', g.card, g.card ? cap(g.card) : '');
      show('spread', g.spread, g.spread ? cap(g.spread) : '');
      show('road', g.road, g.road ? cap(g.road) : '');
      show('arc', g.arcana, g.arcana === 'lord' ? 'Lord' : 'Lady');
      put('t', g.card ? Math.round((g.cardUntil - e.now) * 4) : 0, () => G.time.setAttribute('width', String(g.card ? 48 * Math.max(0, (g.cardUntil - e.now) / 30) : 0)));
    }

    helpHtml(seq) {
      const V = this.V;
      return `
<h3>How it plays (${V.label})</h3>
<p>Level 70 Astrologian on a dummy, so the job is damage and cards. Keep <b>Combust II</b> up (50 a tick for 30s) and fill with <b>Malefic III</b> (220, ${V.malefic}s cast). <b>Earthly Star</b> (60s) goes on the dummy; detonate it after 10s, when it has become Giant Dominance, for a 200-potency Stellar Explosion (150 if you're early); it goes off by itself at 20s. <b>Cleric Stance</b> is +5% for 15s every 90s.</p>
<p><b>Draw</b> (30s, counted from when the card is used) changes into the card you drew; press it to play the card on yourself. The Balance is +${Math.round((V.balance || 0.10) * 100)}% damage for 30s, the Spear ${V.early ? `cuts the recast of abilities you use under it by 20% for ${V.spear}s (no crit until 4.05)` : `+10% crit for ${V.spear}s`}, the Arrow 10% faster casts and GCD, the Ewer MP. The Bole and the Spire do nothing for damage, so turn them into something else: <b>Royal Road</b> spends the card to enhance the next one (Balance and Bole: 150%, Arrow and Spear: double length, Ewer and Spire: AoE at half), <b>Minor Arcana</b> turns it into Lord of Crowns (300 damage) or Lady of Crowns, and <b>Spread</b> keeps a card for later (the Spread button then plays it). <b>Sleeve Draw</b> (120s) fills all of them at once. <b>Time Dilation</b> adds 15s to your card, <b>Celestial Opposition</b> 10s to all your buffs.</p>
<p>${V.ls.potency < 1 ? '<b>Lightspeed</b> takes 2.5s off casts and 25% off MP for 10s, but also 25% off your damage: it\'s for moving, not for damage.' : '<b>Lightspeed</b> takes 2.5s off casts (Malefic is instant) and halves MP for 10s, with no damage penalty since 4.3.'} Minor Arcana and Lord of Crowns are on ${V.arcana}s recasts.</p>
<h3>An opener for this version</h3>
${seq(['malefic3', ['clericStance'], ['draw'], 'combust2', ['balance'], ['tincture'], 'malefic3', ['earthlyStar'], 'malefic3', ['sleeveDraw'], ['balance'], 'malefic3', ['minorArcana'], ['lordOfCrowns'], 'malefic3', ['stellarDetonation'], 'malefic3', 'malefic3'])}
<p>Draw before the pull and hold the Balance (or Spread it); cards drawn mid-fight that aren't the Balance or Spear go to Royal Road or Minor Arcana. The opener above assumes the draws went your way: play what you get. This follows the version's rules; it isn't copied from a published guide.</p>
<p style="color:#a9a3b4">${V.early ? 'Numbers are 2017\'s job guide and the 4.05 patch notes (no game data before 4.11). What\'s different in 4.0–4.01: the Balance +20% (Enhanced 30%), the Spear a 20% ability-recast cut instead of crit, Undraw 5s, and no Empty Road or Undraw Spread, so a stored Royal Road stays until a card uses it and a Spread card can only leave by being played.' : 'Numbers are the game data for this patch.'} Cards are drawn at random, 1 in 6 each, and Minor Arcana is Lord or Lady at even odds, which isn't in the data. The Ewer's Refresh is counted as 600 MP a tick. Gear stats are approximate.</p>`;
    }
  }

  B.AstrologianSB = AstrologianSB;
  B.registerJob({
    id: 'ast', name: 'Astrologian', abbr: 'AST', role: 'healer', classJob: 33,
    versions: ['sb44', 'sb43', 'sb42', 'sb405', 'sb40'].map(v => ({ id: v, label: VERSIONS[v].label, history: VERSIONS[v].history, note: VERSIONS[v].note, create: () => new AstrologianSB(v) })),
  });
})(window.BLM);
