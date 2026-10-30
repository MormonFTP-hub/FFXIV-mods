// Astrologian, Endwalker 6.2–6.58 at level 90 (and the base of the Dawntrail class in ast_dt.js). Fall Malefic (1.5s)
// as filler, Combust III (a 30s DoT with no hit), Gravity II, Earthly Star (Stellar Explosion 310 once it has matured
// for 10s, or by itself at 20s), Divination (+6% for 15s, 120s), Lightspeed (casts 2.5s shorter for 15s), Macrocosmos.
// The cards: Draw (two charges, 30s) gives one of six; Play puts it on yourself (a healer: the Bole, the Ewer and the
// Spire +6%, the Balance, the Arrow and the Spear +3%, 15s, one at a time) and adds its astrosign (Solar, Lunar or
// Celestial); Redraw (once per Draw) swaps it for one of another sign. Astrodyne at three signs: one kind gives Harmony
// of Spirit (MP), two add Harmony of Body (10% faster casts), three add Harmony of Mind (+5% damage), for 15s. Minor
// Arcana (60s, in combat) draws Lord of Crowns (250 around you) or Lady of Crowns (a heal), and becomes it (6.2).
// Numbers are the game data at 6.2–6.58 (xivapi's datamining) and the Lodestone notes; gear is The Balance's 6.4 set
// at 2.34. ref: a scripted bot parses about 6,240 on this.
//  - 6.0–6.18: Minor Arcana keeps its 60s button and the crown it draws waits for Crown Play; Redraw can hand back a card of
//    the same astrosign (any card but the one held). The Balance's 6.0 set at 2.32 (Mind 2,560, 120 magic damage).
(function (B) {
  const EPS = 1e-6;
  const spell = (o) => Object.assign({ kind: 'gcd', target: true, range: 25, delay: 0.8, school: 'astral', sound: 'paradox' }, o);
  const heal = (o) => Object.assign({ kind: 'gcd', potency: 0, school: 'astral', sound: 'paradox' }, o);
  const ab = (o) => Object.assign({ kind: 'ogcd' }, o);
  // The six Endwalker cards: their astrosign and whether a healer (the "ranged" role) gets the full 6%.
  const CARDS = {
    balance: { name: 'the Balance', sign: 'solar', mine: false, status: 'ewBalance' },
    bole: { name: 'the Bole', sign: 'solar', mine: true, status: 'ewBole' },
    arrow: { name: 'the Arrow', sign: 'lunar', mine: false, status: 'ewArrow' },
    ewer: { name: 'the Ewer', sign: 'lunar', mine: true, status: 'ewEwer' },
    spear: { name: 'the Spear', sign: 'celestial', mine: false, status: 'ewSpear' },
    spire: { name: 'the Spire', sign: 'celestial', mine: true, status: 'ewSpire' },
  };
  const VERSIONS = {
    ew62: { label: 'Endwalker 6.2–6.58', history: 'EW 6.2–6.58', level: 90, malefic: 250, combust: 55, gravity: 130, lord: 250, macro: 250,
      divDur: 15, lsRecast: 90, lsCharges: 1, swift: 60, tincture: 'mnd', gcd: 2.34, ref: 6620,
      stats: { hp: 77556, main: 3369, wd: 132, det: 2047, crit: 2409, dh: 472, speed: 1299, piety: 390 },
      gear: 'The Balance\'s 6.4 set at 2.34 (Mind 3,369, 132 magic damage)',
      note: 'Level 90: Draw and Play on yourself, astrosigns into Astrodyne, Redraw to a new sign, Minor Arcana into Lord of Crowns (6.2); Divination 15s' },
    ew60: { label: 'Endwalker 6.0–6.18', history: 'EW 6.0–6.18', level: 90, malefic: 250, combust: 55, gravity: 130, lord: 250, macro: 250,
      divDur: 15, lsRecast: 90, lsCharges: 1, swift: 60, crownPlay: true, redrawAnySign: true, tincture: 'mnd6', gcd: 2.32, ref: 4370,
      stats: { hp: 53548, main: 2560, wd: 120, det: 1951, crit: 1989, dh: 436, speed: 1412, piety: 390 },
      gear: 'The Balance\'s 6.0 set at 2.32 (Mind 2,560, 120 magic damage)',
      note: 'Level 90 at launch: Crown Play plays the crown Minor Arcana drew; Redraw can hand back the same astrosign; Asphodelos gear' },
  };

  function buildActions(V) {
    return {
      fallMalefic: spell({ name: 'Fall Malefic', potency: V.malefic, cast: 1.5, mp: 400, orb: true, desc: `Deals unaspected damage with a potency of ${V.malefic}.` }),
      combust3: spell({ name: 'Combust III', potency: 0, mp: 400, dot: { potency: V.combust, duration: 30 }, sound: 'dot', desc: `Deals unaspected damage over time.\nPotency: ${V.combust}\nDuration: 30s` }),
      gravity2: spell({ name: 'Gravity II', potency: V.gravity, cast: 1.5, mp: 400, aoe: true, delay: 1.0, desc: `Deals unaspected damage with a potency of ${V.gravity} to target and all enemies nearby it.` }),
      macrocosmos: spell({ name: 'Macrocosmos', potency: V.macro, mp: 600, cd: 180, target: false, pbaoe: 20, aoe: 0.6, fx: 'gnbZone',
        desc: `Deals unaspected damage with a potency of ${V.macro} to all enemies nearby you, 40% less for all but the first.\nAdditional Effect: Grants Macrocosmos (the damage you take is healed back when it ends or on Microcosmos)\nDuration: 15s\nRecast: 180s (not affected by spell speed)` }),
      microcosmos: ab({ name: 'Microcosmos', recast: 1, desc: 'Ends Macrocosmos and heals for 50% of the damage taken under it plus 200 potency.' }),
      earthlyStar: ab({ name: 'Earthly Star', recast: 60,
        desc: 'Deploys an Earthly Star (here, at the dummy) and grants Earthly Dominance.\nStellar Detonation within 10s: Stellar Burst, 205 potency to nearby enemies.\nAfter 10s it becomes Giant Dominance: Stellar Explosion, 310 potency.\nThe star detonates on its own after 20s.\nEarthly Star changes to Stellar Detonation while the star is out.' }),
      stellarDetonation: ab({ name: 'Stellar Detonation', recast: 3, desc: 'Detonates the Earthly Star: Stellar Burst (205) under Earthly Dominance, Stellar Explosion (310) under Giant Dominance.' }),
      stellarBurst: { name: 'Stellar Burst', kind: 'hit', potency: 205, aoe: true, school: 'astral', delay: 0.4, sound: 'paradox' },
      stellarExplosion: { name: 'Stellar Explosion', kind: 'hit', potency: 310, aoe: true, school: 'astral', delay: 0.4, big: true, sound: 'paradox' },
      divination: ab({ name: 'Divination', recast: 120, desc: `Increases damage dealt by yourself and nearby party members by 6%.\nDuration: ${V.divDur}s` }),
      lightspeed: ab({ name: 'Lightspeed', recast: V.lsRecast, charges: V.lsCharges > 1 ? V.lsCharges : undefined,
        desc: `Reduces cast times for spells by 2.5 seconds.\nDuration: 15s${V.lsCharges > 1 ? `\nMaximum Charges: ${V.lsCharges}` : ''}` }),
      minorArcana: ab({ name: 'Minor Arcana', recast: 60, desc: V.crownPlay ? 'Draws Lord of Crowns or Lady of Crowns; play it with Crown Play.\nCan only be executed while in combat.' : 'Draws Lord of Crowns or Lady of Crowns.\nCan only be executed while in combat.\n※Action changes to the crown you drew.' }),
      lordOfCrowns: ab({ name: 'Lord of Crowns', recast: 1, potency: V.lord, target: false, pbaoe: 20, aoe: true, delay: 0.6, fx: 'gnbBow', crown: 'lord',
        desc: `Deals unaspected damage with a potency of ${V.lord} to all nearby enemies.` }),
      ladyOfCrowns: ab({ name: 'Lady of Crowns', recast: 1, crown: 'lady', desc: 'Restores own HP and the HP of all nearby party members.\nCure Potency: 400' }),
      draw: ab({ name: 'Draw', recast: 30, charges: 2, desc: 'Draws a card (arcanum) from your divining deck.\nAdditional Effect: Restores 5% of maximum MP\nAdditional Effect: Grants Clarifying Draw (Redraw)\nMaximum Charges: 2\nCannot be executed while holding a card.' }),
      redraw: ab({ name: 'Redraw', recast: 1, desc: V.redrawAnySign ? 'Draws a different card from your deck (it can share the astrosign of the one you hold).\nCan only be executed while under the effect of Clarifying Draw.' : 'Draws a different card with an astrosign other than the one you hold.\nCan only be executed while under the effect of Clarifying Draw.' }),
      crownPlay: V.crownPlay ? ab({ name: 'Crown Play', recast: 1, desc: 'Plays the crown Minor Arcana drew: Lord of Crowns (damage to nearby enemies) or Lady of Crowns (a heal).\n※Action changes to the crown you hold.' }) : undefined,
      play: ab({ name: 'Play', recast: 1, desc: 'Plays the drawn arcanum (here, on yourself), adding its astrosign.\n※Action changes to the card you hold.' }),
      ...Object.fromEntries(Object.entries(CARDS).map(([k, c]) => [k, ab({ name: c.name[0].toUpperCase() + c.name.slice(1), recast: 1, cdGroup: 'play', card: k,
        desc: `Increases damage dealt by a party member by 3% (6% for ${c.mine ? 'a ranged DPS or healer' : 'a melee or tank'}).\nDuration: 15s\nAstrosign: ${c.sign[0].toUpperCase() + c.sign.slice(1)}` })])),
      astrodyne: ab({ name: 'Astrodyne', recast: 1, desc: 'Grants effects by the number of different astrosigns read:\n1: Harmony of Spirit (MP regeneration, potency 50)\n2: also Harmony of Body (10% shorter casts and recasts)\n3: also Harmony of Mind (+5% damage and healing)\nDuration: 15s\nCan only be executed with three astrosigns.' }),
      benefic: heal({ name: 'Benefic', cast: 1.5, mp: 400, desc: 'Restores target\'s HP.\nCure Potency: 500' }),
      benefic2: heal({ name: 'Benefic II', cast: 1.5, mp: 700, desc: 'Restores target\'s HP.\nCure Potency: 800' }),
      aspectedBenefic: heal({ name: 'Aspected Benefic', mp: 400, desc: 'Restores target\'s HP.\nCure Potency: 250\nAdditional Effect: Regen\nCure Potency: 250\nDuration: 15s' }),
      helios: heal({ name: 'Helios', cast: 1.5, mp: 700, desc: 'Restores own HP and the HP of all nearby party members.\nCure Potency: 400' }),
      aspectedHelios: heal({ name: 'Aspected Helios', cast: 1.5, mp: 800, desc: 'Restores own HP and the HP of all nearby party members.\nCure Potency: 250\nAdditional Effect: Regen\nCure Potency: 150\nDuration: 15s' }),
      essentialDignity: ab({ name: 'Essential Dignity', recast: 40, charges: 2, desc: 'Restores target\'s HP (400 to 1,100, more the lower the target\'s HP).\nMaximum Charges: 2' }),
      celestialIntersection: ab({ name: 'Celestial Intersection', recast: 30, charges: 2, desc: 'Restores target\'s HP (200) and grants a barrier (400).\nMaximum Charges: 2' }),
      celestialOpposition: ab({ name: 'Celestial Opposition', recast: 60, desc: 'Restores own HP and the HP of all nearby party members (200) and grants a regen (100, 15s).' }),
      collectiveUnconscious: ab({ name: 'Collective Unconscious', recast: 60, desc: 'Creates a celestial ring that reduces damage taken by 10% and grants a regen.' }),
      horoscope: ab({ name: 'Horoscope', recast: 60, desc: 'Reads your fortune: Helios or Aspected Helios upgrades the heal stored for when it ends.' }),
      neutralSect: ab({ name: 'Neutral Sect', recast: 120, desc: 'Increases healing magic potency by 20%; Aspected heals also add a barrier.\nDuration: 20s' }),
      exaltation: ab({ name: 'Exaltation', recast: 60, desc: 'Reduces damage taken by a party member by 10% and heals them (500) after 8s.' }),
      synastry: ab({ name: 'Synastry', recast: 120, desc: 'Your single-target heals also heal a party member for 40% of the amount.\nDuration: 20s' }),
      swiftcast: ab({ name: 'Swiftcast', recast: V.swift, role: true, desc: 'Next spell is cast immediately.\nDuration: 10s' }),     // 40s at level 100 (Enhanced Swiftcast)
      lucidDreaming: ab({ name: 'Lucid Dreaming', recast: 60, role: true, desc: 'Gradually restores MP.\nPotency: 55\nDuration: 21s' }),
      surecast: ab({ name: 'Surecast', recast: 120, role: true, desc: 'Spells can be cast without interruption.\nDuration: 6s' }),
      rescue: ab({ name: 'Rescue', recast: 120, role: true, desc: 'Instantly draws target party member to your side.' }),
      esuna: heal({ name: 'Esuna', cast: 1, mp: 400, role: true, desc: 'Removes a single detrimental effect from target.' }),
      repose: spell({ name: 'Repose', potency: 0, cast: 2.5, mp: 600, role: true, desc: 'Puts target to sleep.\nDuration: 30s' }),
      ...B.GENERAL_ACTIONS,
      tincture: B.tincture(V.tincture),
    };
  }

  const STATUSES = {
    divination: { name: 'Divination', self: true, icon: 'st_divination' },
    lightspeed: { name: 'Lightspeed', self: true, icon: 'st_lightspeed' },
    earthlyDominance: { name: 'Earthly Dominance', self: true, icon: 'st_star' },
    giantDominance: { name: 'Giant Dominance', self: true, icon: 'st_star' },
    clarifyingDraw: { name: 'Clarifying Draw', self: true, icon: 'st_clarifyingDraw' },
    harmonyOfSpirit: { name: 'Harmony of Spirit', self: true, icon: 'st_harmonyOfSpirit' },
    harmonyOfBody: { name: 'Harmony of Body', self: true, icon: 'st_harmonyOfBody' },
    harmonyOfMind: { name: 'Harmony of Mind', self: true, icon: 'st_harmonyOfMind' },
    macrocosmos: { name: 'Macrocosmos', self: true, icon: 'st_macrocosmos' },
    ...Object.fromEntries(Object.values(CARDS).map(c => [c.status, { name: c.name[0].toUpperCase() + c.name.slice(1), self: true, icon: 'st_' + c.status }])),
    combust3: { name: 'Combust III', self: false, icon: 'st_combust3' },
    ...B.COMMON_STATUSES,
  };

  class AstrologianEW {
    constructor(V) {
      V = typeof V === 'string' ? VERSIONS[V] : V;
      this.V = V;
      this.name = 'Astrologian';
      this.abbr = 'AST';
      this.role = 'healer';
      this.level = V.level;
      this.levelKey = V.level;
      this.model = 'ast-sb';
      this.maxMp = 10000;
      this.actions = buildActions(V);
      for (const k of Object.keys(this.actions)) if (!this.actions[k]) delete this.actions[k];
      this.statuses = STATUSES;
      this.cards = CARDS;
      // Maim and Mend II (+30%) at level 90 and 100.
      this.stats = Object.assign({ mainStat: 'mnd', jobMod: 115, trait: 130, delay: 3.2 }, V.stats);
      this.speedName = 'Spell speed';
      this.tierHaste = 0;
      this.selfStatusOrder = ['divination', 'harmonyOfMind', 'harmonyOfBody', 'harmonyOfSpirit', ...Object.values(CARDS).map(c => c.status), 'clarifyingDraw',
        'lightspeed', 'swiftcast', 'medicated', 'lucidDreaming', 'earthlyDominance', 'giantDominance', 'macrocosmos', 'surecast', 'sprint'];
      this.targetStatusOrder = ['combust3'];
      this.defaultBars = [
        ['fallMalefic', 'combust3', 'draw', 'play', 'redraw', 'astrodyne', 'minorArcana', 'divination', 'earthlyStar', 'lightspeed', 'lucidDreaming', 'tincture'],
        ['gravity2', 'macrocosmos', 'benefic', 'benefic2', 'aspectedBenefic', 'helios', 'aspectedHelios', 'essentialDignity', 'celestialIntersection',
          'celestialOpposition', 'collectiveUnconscious', 'swiftcast'],
        ['horoscope', 'neutralSect', 'exaltation', 'synastry', 'microcosmos', 'surecast', 'rescue', 'esuna', 'repose', 'sprint', V.crownPlay ? 'crownPlay' : null, null],
      ];
      this.actionGroups = [
        ['Astrologian', ['fallMalefic', 'combust3', 'gravity2', 'macrocosmos', 'microcosmos', 'earthlyStar', 'stellarDetonation', 'divination', 'lightspeed',
          'draw', 'redraw', 'play', ...Object.keys(CARDS), 'astrodyne', 'minorArcana', ...(V.crownPlay ? ['crownPlay'] : []), 'lordOfCrowns', 'ladyOfCrowns', 'benefic', 'benefic2',
          'aspectedBenefic', 'helios', 'aspectedHelios', 'essentialDignity', 'celestialIntersection', 'celestialOpposition', 'collectiveUnconscious',
          'horoscope', 'neutralSect', 'exaltation', 'synastry']],
        ['Role Actions', ['swiftcast', 'lucidDreaming', 'surecast', 'rescue', 'esuna', 'repose']],
        ['General', ['sprint', 'tincture']],
      ];
      this.referenceDps = V.ref;
      this.referenceGcd = V.gcd;
      this.startDistance = 12;
    }

    initGauge() { return { card: null, signs: [], crown: null, star: null }; }

    resolveId(id, e) {
      const g = e.g;
      if (id === 'play' && g.card) return g.card;
      if (id === (this.V.crownPlay ? 'crownPlay' : 'minorArcana') && g.crown) return g.crown === 'lord' ? 'lordOfCrowns' : 'ladyOfCrowns';
      if (id === 'earthlyStar' && g.star) return 'stellarDetonation';
      if (id === 'macrocosmos' && e.has('macrocosmos')) return 'microcosmos';
      return id;
    }

    check(id, e) {
      const a = this.actions[id], g = e.g;
      if (a.card && g.card !== id) return 'Unable to execute action. No card drawn.';
      if (a.crown && g.crown !== a.crown) return 'Unable to execute action.';
      switch (id) {
        case 'play': return 'Unable to execute action. No card drawn.';
        case 'crownPlay': return 'Unable to execute action. No crown drawn.';
        case 'draw': if (g.card) return 'Unable to execute action while holding a card.'; break;
        case 'redraw': if (!g.card || !e.has('clarifyingDraw')) return 'Unable to execute action.'; break;
        case 'astrodyne': if (g.signs.length < 3) return 'Unable to execute action. Three astrosigns required.'; break;
        case 'minorArcana': if (g.crown || !e.inCombat) return 'Unable to execute action.'; break;
        case 'stellarDetonation': if (!g.star) return 'Unable to execute action. Earthly Star required.'; break;
        case 'microcosmos': if (!e.has('macrocosmos')) return 'Unable to execute action.'; break;
      }
      return null;
    }

    haste(e) { return e.has('harmonyOfBody') ? 10 : 0; }

    castTime(id, e) {
      const a = this.actions[id];
      if (!a.cast) return 0;
      if (e.has('swiftcast')) return 0;
      const t = a.cast - (e.has('lightspeed') ? 2.5 : 0);
      return t <= 0 ? 0 : e.speedScale(t, this.haste(e));
    }
    consumeInstant(id, e) {
      const a = this.actions[id];
      if (a.cast && !(e.has('lightspeed') && a.cast <= 2.5) && e.has('swiftcast')) e.removeStatus('swiftcast');
    }

    // Harmony of Spirit adds a 50-potency refresh (500 a tick).
    mpRegen(e) {
      const base = this.level === 100 ? 200 + Math.floor(150 * (this.stats.piety - 440) / 2780) : 200 + Math.floor(150 * (this.stats.piety - 390) / 1900);
      return base + (e && e.has('harmonyOfSpirit') ? 500 : 0);
    }
    lucidGain() { return B.LUCID_REGEN; }

    snapshot(a, e) {
      let mult = 1;
      if (e.has('divination')) mult *= 1.06;
      if (e.has('harmonyOfMind')) mult *= 1.05;
      for (const c of Object.values(CARDS)) if (e.has(c.status)) mult *= c.mine ? 1.06 : 1.03;
      const main = this.stats.main + (e.has('medicated') ? B.TINCTURES[this.V.tincture].cap : 0);
      return { mult, main };
    }

    gainMp(e, n) {
      const before = e.mp;
      e.mp = Math.min(e.maxMp, e.mp + n);
      if (e.mp > before) e.emit('mpGain', { amount: e.mp - before, source: 'manafont' });
    }

    drawCard(e, notSign) {
      const pool = Object.keys(CARDS).filter(k => !notSign || CARDS[k].sign !== notSign);
      return pool[Math.floor(Math.random() * pool.length)];
    }

    resolve(id, e) {
      const a = this.actions[id], g = e.g;
      if (a.kind === 'gcd') e.mp -= a.mp || 0;
      if (a.card) {
        for (const c of Object.values(CARDS)) e.removeStatus(c.status, true);
        e.addStatus(CARDS[id].status, 15);
        if (e.inCombat && g.signs.length < 3) g.signs.push(CARDS[id].sign);
        g.card = null; e.removeStatus('clarifyingDraw', true);
        e.emit('card', {});
        return;
      }
      switch (id) {
        case 'draw': g.card = this.drawCard(e); e.addStatus('clarifyingDraw', 30); this.gainMp(e, 500); e.emit('card', {}); return;
        case 'redraw': g.card = this.V.redrawAnySign ? (() => { const p = Object.keys(CARDS).filter(k => k !== g.card); return p[Math.floor(Math.random() * p.length)]; })() : this.drawCard(e, CARDS[g.card].sign); e.removeStatus('clarifyingDraw'); e.emit('card', {}); return;
        case 'astrodyne': {
          const n = new Set(g.signs).size;
          e.addStatus('harmonyOfSpirit', 15);
          if (n >= 2) e.addStatus('harmonyOfBody', 15);
          if (n >= 3) e.addStatus('harmonyOfMind', 15);
          g.signs = []; e.emit('card', {});
          return;
        }
        case 'minorArcana': g.crown = Math.random() < 0.5 ? 'lord' : 'lady'; e.emit('card', {}); return;
        case 'lordOfCrowns': case 'ladyOfCrowns': g.crown = null; e.emit('card', {}); break;
        case 'divination': e.addStatus('divination', this.V.divDur); return;
        case 'lightspeed': e.addStatus('lightspeed', 15); return;
        case 'earthlyStar': g.star = { placed: e.now }; e.addStatus('earthlyDominance', 10); return;
        case 'stellarDetonation': this.detonate(e); return;
        case 'macrocosmos': e.addStatus('macrocosmos', 15); break;
        case 'microcosmos': e.removeStatus('macrocosmos'); return;
        default:
          if (B.ROLE_EFFECTS[id]) B.ROLE_EFFECTS[id](e);
      }
      if (a.dot) e.addTStatus(id, a.dot.duration, { snap: this.snapshot(a, e), dot: { potency: a.dot.potency, id } });
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
      return g.star ? g.star.placed + (e.now < g.star.placed + 10 - EPS ? 10 : 20) : Infinity;
    }
    process(e) {
      const g = e.g, now = e.now;
      if (g.star) {
        if (now >= g.star.placed + 20 - EPS) this.detonate(e);
        else if (now >= g.star.placed + 10 - EPS && !e.has('giantDominance')) {
          e.removeStatus('earthlyDominance', true);
          e.addStatus('giantDominance', g.star.placed + 20 - now);
        }
      }
    }

    proc(id, e) {
      const a = this.actions[id], g = e.g;
      if (a.card) return g.card === id;
      if (id === 'play') return !!g.card;
      if (id === 'astrodyne') return g.signs.length >= 3;
      if (id === 'minorArcana' || a.crown) return !!g.crown;
      if (id === 'stellarDetonation' || id === 'earthlyStar') return e.has('giantDominance');
      return false;
    }

    speedInfo(e) { return `GCD ${e.gcdForSpeed(e.stats.speed).toFixed(2)} · ${e.gcdForSpeed(e.stats.speed, 10).toFixed(2)} under Harmony of Body · ${e.maxMp.toLocaleString()} MP`; }

    // ---------- the Arcana Gauge: the card in hand, three astrosigns, the crown ----------
    gaugeBuild(root) {
      root.innerHTML = `
<svg width="360" height="150" viewBox="0 0 360 150">
  <rect x="8" y="10" width="344" height="130" rx="14" fill="rgba(14,12,20,.86)" stroke="rgba(255,255,255,.22)"/>
  <text x="24" y="34" font-family="Noto Sans, sans-serif" font-size="11" font-weight="600" fill="#a9a3b4" letter-spacing="1">ARCANA</text>
  <rect x="24" y="44" width="54" height="78" rx="6" fill="#1d1a2a" stroke="rgba(255,255,255,.3)"/>
  <text id="ag-c" x="51" y="88" text-anchor="middle" font-family="Noto Sans, sans-serif" font-size="11" font-weight="700" fill="#ffd98a"></text>
  <text x="100" y="56" font-family="Noto Sans, sans-serif" font-size="10" font-weight="600" fill="#a9a3b4" letter-spacing="1">ASTROSIGNS</text>
  ${[0, 1, 2].map(k => `<circle id="ag-s${k}" cx="${114 + k * 34}" cy="80" r="12" fill="#2a2535" stroke="rgba(255,255,255,.3)"/>`).join('')}
  <text x="236" y="56" font-family="Noto Sans, sans-serif" font-size="10" font-weight="600" fill="#a9a3b4" letter-spacing="1">CROWN</text>
  <text id="ag-k" x="236" y="86" font-family="Noto Sans, sans-serif" font-size="13" font-weight="700" fill="#fff"></text>
</svg>`;
      const $ = (s) => root.querySelector(s);
      this.ag = { c: $('#ag-c'), s: [0, 1, 2].map(k => $('#ag-s' + k)), k: $('#ag-k'), cache: {} };
    }

    gaugeUpdate(e) {
      const G = this.ag, c = G.cache, g = e.g;
      const put = (k, v, fn) => { if (c[k] !== v) { c[k] = v; fn(v); } };
      put('c', g.card || '', v => { G.c.textContent = v ? CARDS[v].name.replace('the ', '').toUpperCase() : ''; });
      const col = { solar: '#ffb84a', lunar: '#8ab8ff', celestial: '#c890ff' };
      for (let i = 0; i < 3; i++) put('s' + i, g.signs[i] || '', v => G.s[i].setAttribute('fill', v ? col[v] : '#2a2535'));
      put('k', g.crown || '', v => { G.k.textContent = v === 'lord' ? 'LORD' : v === 'lady' ? 'LADY' : ''; G.k.setAttribute('fill', v === 'lord' ? '#ff8a6a' : '#ffd0f0'); });
    }

    helpHtml(seq) {
      const V = this.V;
      return `
<h3>How it plays (${V.label})</h3>
<p>Level 90 Astrologian. <b>Fall Malefic</b> (${V.malefic}, 1.5s) is the filler and <b>Combust III</b> (${V.combust} a tick for 30s) the DoT. <b>Earthly Star</b> (60s) matures after 10s: <b>Stellar Detonation</b> then gives Stellar Explosion (310) instead of Stellar Burst (205), and it goes off by itself at 20s. <b>Divination</b> (+6% for ${V.divDur}s, 120s) is the burst; <b>Lightspeed</b> (90s) makes casts 2.5s shorter for 15s, so Fall Malefic is instant and every GCD takes two weaves.</p>
<p><b>Draw</b> (two charges, 30s, +5% MP) gives one card; <b>Play</b> puts it on you for 15s: as a healer the Bole, the Ewer and the Spire give +6%, the Balance, the Arrow and the Spear +3%, one at a time. Each card played in combat adds its astrosign (Balance/Bole Solar, Arrow/Ewer Lunar, Spear/Spire Celestial); <b>Redraw</b> (once per Draw) swaps your card for one of another sign. At three signs, <b>Astrodyne</b>: three different signs give Harmony of Mind (+5% damage) as well as Body (10% faster casts) and Spirit (MP). <b>Minor Arcana</b> (60s) draws Lord of Crowns (${V.lord} around you, held for Divination) or Lady of Crowns (a heal).</p>
<h3>The opener (The Balance)</h3>
${seq(['fallMalefic', ['lightspeed'], 'combust3', ['play'], ['draw'], 'fallMalefic', ['play'], ['draw'], 'fallMalefic', ['divination'], ['play'], 'fallMalefic', ['minorArcana'], ['astrodyne'], 'fallMalefic', ['lordOfCrowns'], 'fallMalefic', ['stellarDetonation'], 'fallMalefic'])}
<p>Draw at −30s, Earthly Star at −4s and the tincture at −3s; Fall Malefic hardcast at −1.5s. Redraw before a Play if the card would repeat a sign.</p>
<p style="color:#a9a3b4">${V.label} numbers: Fall Malefic ${V.malefic}, Combust III ${V.combust} × 30s, Gravity II ${V.gravity}, Stellar Burst 205 / Explosion 310, Lord of Crowns ${V.lord}, Macrocosmos ${V.macro}. Gear: ${V.gear}.</p>`;
    }
  }

  B.AstrologianEW = AstrologianEW;
  B.registerJob({
    id: 'ast', name: 'Astrologian', abbr: 'AST', role: 'healer', classJob: 33,
    versions: ['ew62', 'ew60'].map(v => ({ id: v, label: VERSIONS[v].label, history: VERSIONS[v].history, note: VERSIONS[v].note, create: () => new AstrologianEW(v) })),
  });
})(window.BLM);
