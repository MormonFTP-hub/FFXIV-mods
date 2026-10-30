// Bard, Heavensward at level 60 on TP, in two versions. The Wanderer's Minuet (3.01's toggle) gives +30% damage but
// stops auto-attacks and puts a 1.5s cast on every weaponskill (the GCD stays 2.5s), so there's room for one oGCD a
// GCD; a Straighter Shot proc (20% on Heavy Shot) makes the next Straight Shot an instant critical hit. Venomous Bite and
// Windbite (18s) are refreshed with Iron Jaws, which takes your buffs at that moment; each bite tick has a 50% chance to
// reset Bloodletter (River of Blood). Empyreal Arrow is a weaponskill off the GCD (its own 15s recast and a 1.5s cast),
// the target for Barrage (three hits that can't crit). Raging Strikes (+20%, 120s), Hawk's Eye (+15% Dexterity, 90s),
// Blood for Blood (+10%, 80s) and Internal Release (+10% crit, 60s) as cross-class buffs, Invigorate for TP. Songs only
// matter to a solo Bard for Army's Paeon (+30 TP a tick, doubled by Battle Voice) at a cost to your own damage.
//  - 3.3–3.57: songs a 1.5s cast at −10%; Empyreal Arrow 230, Sidewinder up to 260, bites 40 / 50 a tick, Blunt Arrow
//    100, Flaming Arrow 40; Creator gear.
//  - 3.0: the Wanderer's Minuet is a 3s-cast GCD spell worth +20% (3.01 made it a +30% ability); Empyreal Arrow 240,
//    Sidewinder 150 / 250 / 350; launch gear (i170 Yasha law with the Hive Bow from Ravana Extreme, 65 weapon damage).
//  - 3.01–3.26: songs a 3s cast at −15%; Empyreal Arrow 220, Sidewinder up to 250, bites 35 / 45, Blunt Arrow 50,
//    Flaming Arrow 35, Battle Voice 300s; Midas gear.
// Heavensward's damage formula (hw60). Numbers are the 3.x tooltips (the FFXIV wiki's and Gamer Escape's revisions),
// the Lodestone notes and Bluegartr's 2015 "Bardmage 3.0" thread; gear stats from the 4.11 item data (Heavensward's
// bows before 4.0's raise). ref: a scripted bot parses about 2,710 / 2,020 on these.
//  - A Realm Reborn 2.0–2.57 (level 50, arr50): no Minuet, Iron Jaws, Empyreal Arrow or Sidewinder (3.0), so autos run
//    all fight and Barrage (90s) makes each one strike three times for 10s; Heavy Shot 60 TP, Straight Shot 70, the
//    bites 80 (35 / 45 a tick, re-applied by hand); Rain of Death a 180 TP weaponskill; River of Blood resets Bloodletter
//    on half of the bites' critical ticks (Gamer Escape's 2015 trait page; the Heavensward text drops "critical"). The
//    cross-class Internal Release and Blood for Blood at 2.1's 10% (2.0 had 20%). Ariyala's 2015 set with the Yoichi
//    Bow Zeta (xiv-sim's bard-bis: Dexterity 658, 52 weapon damage) and the X-Potion of Dexterity. A bot parses about 505.
(function (B) {
  const EPS = 1e-6;
  const MINUET_CAST = 1.5;
  const VERSIONS = {
    hw33: { label: 'Heavensward 3.3–3.57', history: 'HW 3.3–3.57', ea: 230, side: [100, 175, 260], vb: 40, wb: 50, blunt: 100, flame: 40, songCast: 1.5,
      songMult: 0.9, bvRecast: 180, potion: ['Supramax-Potion of Dexterity', 154], ref: 2870,
      stats: { hp: 28000, main: 1591, wd: 76, det: 812, crit: 1101, speed: 683 },
      gear: 'an Alexander: Creator / Augmented Shire / Proto Ultima mix with the Augmented Shire Longbow (Dexterity 1,591, 76 weapon damage)',
      note: 'Level 60 on TP: the Wanderer\'s Minuet (+30%, 1.5s weaponskill casts), Empyreal Arrow 230, Sidewinder 260, River of Blood, Barrage into Empyreal Arrow; Creator gear' },
    hw301: { label: 'Heavensward 3.01–3.26', history: 'HW 3.01–3.26', ea: 220, side: [100, 175, 250], vb: 35, wb: 45, blunt: 50, flame: 35, songCast: 3,
      songMult: 0.85, bvRecast: 300, potion: ['Max-Potion of Dexterity', 127], ref: 2140,
      stats: { hp: 24000, main: 1310, wd: 73, det: 742, crit: 1010, speed: 713 },
      gear: 'an Alexander: Midas Savage set with the Midan Metal Bow (Dexterity 1,310, 73 weapon damage)',
      note: 'Level 60 on TP: the Wanderer\'s Minuet toggle, Empyreal Arrow 220 and Iron Jaws only inside it, River of Blood resets, Barrage into Empyreal Arrow; Midas gear' },
    hw30: { label: 'Heavensward 3.0', history: 'HW 3.0', minuetGcd: true, minuetMult: 1.20, ea: 240, side: [150, 250, 350], vb: 35, wb: 45, blunt: 50, flame: 35, songCast: 3,
      songMult: 0.85, bvRecast: 300, potion: ['Draconian Potion of Dexterity', 105], ref: 1060,
      stats: { hp: 15500, main: 870, wd: 65, det: 420, crit: 625, speed: 498 },
      gear: 'launch gear (i170 Yasha law with the Hive Bow from Ravana Extreme: Dexterity about 870, 65 weapon damage)',
      note: 'Level 60 at launch: the Wanderer\'s Minuet a 3s-cast stance worth +20% (no autos, weaponskill casts), Empyreal Arrow 240, Sidewinder 150 / 250 / 350; launch gear' },
    arr20: { label: 'A Realm Reborn 2.0–2.57', history: 'ARR 2.0–2.57', arr: true, ea: 0, side: [0, 0, 0], vb: 35, wb: 45, blunt: 50, flame: 35, songCast: 3,
      songMult: 0.8, bvRecast: 300, potion: ['X-Potion of Dexterity', 84], ref: 535,
      stats: { hp: 9500, main: 658, wd: 52, det: 334, crit: 614, speed: 356, dh: 341 },
      gear: 'Ariyala\'s 2015 set with the Yoichi Bow Zeta (Dexterity 658, 52 weapon damage)',
      note: 'Level 50 on TP: Straight Shot, Heavy Shot and the two bites by hand, River of Blood on critical ticks, Barrage triples auto-attacks, Raging Strikes and Hawk\'s Eye; Final Coil gear' },
  };
  const ws = (o) => Object.assign({ kind: 'gcd', target: true, range: 25, delay: 0.6, fx: 'gnbShot', shot: true }, o);
  const ab = (o) => Object.assign({ kind: 'ogcd' }, o);
  const song = (name, V, desc) => ({ name, kind: 'gcd', cast: V.songCast, target: false, song: true, sound: 'paradox', desc: `${desc}\nWhile singing, your own damage is ${Math.round((1 - V.songMult) * 100)}% lower.\nCast: ${V.songCast}s. Ends upon reuse or another song.` });

  function buildActions(V) {
    return {
      heavyShot: ws({ name: 'Heavy Shot', potency: 150, tp: 50, desc: 'Delivers an attack with a potency of 150.\nAdditional Effect: 20% chance of Straighter Shot\nDuration: 10s' }),
      straightShot: ws({ name: 'Straight Shot', potency: 140, tp: 50, desc: 'Delivers an attack with a potency of 140.\nAdditional Effect: Increases critical hit rate by 10%\nDuration: 20s\nStraighter Shot Bonus: a guaranteed critical hit, with no cast under the Wanderer\'s Minuet' }),
      venomousBite: ws({ name: 'Venomous Bite', potency: 100, tp: 80, dot: { potency: V.vb, duration: 18 }, desc: `Delivers an attack with a potency of 100.\nAdditional Effect: Damage over time\nPotency: ${V.vb}\nDuration: 18s` }),
      windbite: ws({ name: 'Windbite', potency: 60, tp: 80, dot: { potency: V.wb, duration: 18 }, desc: `Deals wind damage with a potency of 60.\nAdditional Effect: Wind damage over time\nPotency: ${V.wb}\nDuration: 18s` }),
      ironJaws: ws({ name: 'Iron Jaws', potency: 100, tp: 60, minuet: true, desc: 'Delivers an attack with a potency of 100.\nAdditional Effect: Resets your Venomous Bite and Windbite on the target, with your current buffs\nCan only be executed while under the effect of the Wanderer\'s Minuet.' }),
      quickNock: ws({ name: 'Quick Nock', potency: 110, tp: 140, range: 12, aoe: true, desc: 'Delivers an attack with a potency of 110 to all enemies in a cone before you.' }),
      wideVolley: ws({ name: 'Wide Volley', potency: 110, tp: 160, aoe: true, desc: 'Delivers an attack with a potency of 110 to target and all enemies nearby it.' }),
      empyrealArrow: ab({ name: 'Empyreal Arrow', recast: 15, potency: V.ea, tp: 60, minuet: true, target: true, range: 25, delay: 0.6, lock: MINUET_CAST, fx: 'gnbShot',
        desc: `Delivers an attack with a potency of ${V.ea}.\nA weaponskill off the GCD: its own 15s recast and a ${MINUET_CAST}s cast.\nCan only be executed while under the effect of the Wanderer's Minuet.` }),
      bloodletter: ab({ name: 'Bloodletter', recast: 15, cdGroup: 'bloodletter', potency: 150, target: true, range: 25, delay: 0.5, fx: 'gnbShot', desc: 'Delivers an attack with a potency of 150.\nRiver of Blood: each tick of your Venomous Bite or Windbite has a 50% chance to reset its recast.\nShares a recast timer with Rain of Death.' }),
      rainOfDeath: ab({ name: 'Rain of Death', recast: 15, cdGroup: 'bloodletter', potency: 100, target: true, range: 25, aoe: true, delay: 0.6, desc: 'Deals damage with a potency of 100 to target and all enemies nearby it.\nShares a recast timer with Bloodletter.' }),
      sidewinder: ab({ name: 'Sidewinder', recast: 60, potency: V.side[0], target: true, range: 25, delay: 0.6, fx: 'gnbShot', desc: `Delivers an attack with a potency of ${V.side[0]}: ${V.side[1]} with one of your bites on the target, ${V.side[2]} with both.` }),
      miserysEnd: ab({ name: 'Misery\'s End', recast: 12, potency: 190, target: true, range: 25, delay: 0.5, desc: 'Delivers an attack with a potency of 190.\nCan only be executed when target\'s HP is below 20%.' }),
      bluntArrow: ab({ name: 'Blunt Arrow', recast: 30, potency: V.blunt, target: true, range: 25, delay: 0.5, desc: `Delivers an attack with a potency of ${V.blunt}.\nAdditional Effect: Silence\nDuration: 1s` }),
      repellingShot: ab({ name: 'Repelling Shot', recast: 30, potency: 80, target: true, range: 25, delay: 0.5, lock: 0.8, desc: 'Delivers an attack with a potency of 80.\nAdditional Effect: Jump 10 yalms back from current position.' }),
      flamingArrow: ab({ name: 'Flaming Arrow', recast: 60, target: true, range: 25, desc: `Sets a patch of ground alight, dealing fire damage with a potency of ${V.flame} to any enemies who enter.\nDuration: 30s` }),
      barrage: ab({ name: 'Barrage', recast: 90, desc: 'The next single-target weaponskill strikes three times; the extra strikes can\'t be critical hits.\nDuration: 10s' }),
      wanderersMinuet: ab({ name: 'the Wanderer\'s Minuet', recast: 15, desc: 'Increases damage dealt by 30%, but auto-attacks stop and weaponskills take a 1.5s cast.\nEffect ends upon reuse.' }),
      armysPaeon: song('Army\'s Paeon', V, 'Gradually restores TP of party members (you included): 30 a tick (60 under Battle Voice).'),
      magesBallad: song('Mage\'s Ballad', V, 'Gradually restores MP of party members.'),
      foeRequiem: song('Foe Requiem', V, 'Reduces enemies\' magic resistance by 10% (nothing for your physical damage).'),
      battleVoice: ab({ name: 'Battle Voice', recast: V.bvRecast, desc: 'Doubles the effect of your songs.\nDuration: 30s' }),
      ragingStrikes: ab({ name: 'Raging Strikes', recast: 120, desc: 'Increases damage dealt by 20%.\nDuration: 20s' }),
      hawksEye: ab({ name: 'Hawk\'s Eye', recast: 90, desc: 'Increases dexterity by 15%.\nAdditional Effect: Attacks cannot miss\nDuration: 20s' }),
      internalRelease: ab({ name: 'Internal Release', recast: 60, role: true, desc: 'Increases critical hit rate by 10%.\nDuration: 15s\n(Pugilist cross-class)' }),
      bloodForBlood: ab({ name: 'Blood for Blood', recast: 80, role: true, desc: 'Increases damage dealt by 10%, and damage taken by 25%.\nDuration: 20s\n(Lancer cross-class)' }),
      invigorate: ab({ name: 'Invigorate', recast: 120, role: true, desc: 'Instantly restores 400 TP.\n(Lancer cross-class)' }),
      ...B.GENERAL_ACTIONS,
      tincture: Object.assign({}, B.tincture('dex3sb'), { name: V.potion[0], dur: 15, desc: `Temporarily increases dexterity.\nDexterity +20% (Max ${V.potion[1]})\nDuration: 15s` }),
      auto: { name: 'Shot', kind: 'auto', fx: 'auto', desc: 'Auto-attack.' },
    };
  }

  const STATUSES = {
    wanderersMinuet: { name: 'the Wanderer\'s Minuet', self: true, icon: 'st_song' },
    straighterShot: { name: 'Straighter Shot', self: true, icon: 'st_straighter' },
    straightShot: { name: 'Straight Shot', self: true, icon: 'st_straight' },
    ragingStrikes: { name: 'Raging Strikes', self: true, icon: 'st_raging' },
    hawksEye: { name: 'Hawk\'s Eye', self: true, icon: 'st_hawk' },
    barrage: { name: 'Barrage', self: true, icon: 'st_barrage' },
    internalRelease: { name: 'Internal Release', self: true, icon: 'st_ir' },
    bloodForBlood: { name: 'Blood for Blood', self: true, icon: 'st_bfb' },
    armysPaeon: { name: 'Army\'s Paeon', self: true, icon: 'st_song' },
    magesBallad: { name: 'Mage\'s Ballad', self: true, icon: 'st_song' },
    foeRequiem: { name: 'Foe Requiem', self: true, icon: 'st_song' },
    battleVoice: { name: 'Battle Voice', self: true, icon: 'st_bv' },
    venomousBite: { name: 'Venomous Bite', self: false, icon: 'st_caustic' },
    windbite: { name: 'Windbite', self: false, icon: 'st_storm' },
    flamingArrow: { name: 'Flaming Arrow', self: false, icon: 'st_flame' },
    ...B.COMMON_STATUSES,
  };
  const SONGS = ['armysPaeon', 'magesBallad', 'foeRequiem'];

  class BardHW {
    constructor(version) {
      const V = VERSIONS[version];
      const self = this;
      this.V = V;
      this.name = 'Bard';
      this.abbr = 'BRD';
      this.role = 'ranged';
      this.level = 60;
      this.levelKey = 'hw60';
      this.model = 'brd-sb';
      this.actions = buildActions(V);
      this.statuses = STATUSES;
      // Army's Paeon adds 30 TP a tick (60 under Battle Voice).
      this.tp = { max: 1000, get regen() { return 60 + (self.paeon ? (self.voice ? 60 : 30) : 0); } };
      this.potionCap = V.potion[1];
      // Increased Action Damage II: +20%. No Direct Hit before 4.0.
      this.stats = Object.assign({ mainStat: 'dex', jobMod: 115, trait: 120, dh: 354, delay: 3.04 }, V.stats);
      this.speedName = 'Skill speed';
      this.tierHaste = 0;
      this.autoAttack = { potency: 100, delay: 3.04, range: 25 };
      this.selfStatusOrder = ['wanderersMinuet', 'straightShot', 'straighterShot', 'ragingStrikes', 'hawksEye', 'bloodForBlood', 'internalRelease', 'barrage',
        'armysPaeon', 'magesBallad', 'foeRequiem', 'battleVoice', 'medicated', 'sprint'];
      this.targetStatusOrder = ['venomousBite', 'windbite', 'flamingArrow'];
      this.defaultBars = [
        ['heavyShot', 'straightShot', 'venomousBite', 'windbite', 'ironJaws', 'empyrealArrow', 'bloodletter', 'sidewinder', 'barrage', 'ragingStrikes', 'hawksEye', 'wanderersMinuet'],
        ['bloodForBlood', 'internalRelease', 'invigorate', 'tincture', 'flamingArrow', 'bluntArrow', 'repellingShot', 'miserysEnd', 'armysPaeon', 'battleVoice', 'magesBallad', 'foeRequiem'],
        ['quickNock', 'wideVolley', 'rainOfDeath', 'sprint', null, null, null, null, null, null, null, null],
      ];
      this.actionGroups = [
        ['Bard', ['heavyShot', 'straightShot', 'venomousBite', 'windbite', 'ironJaws', 'quickNock', 'wideVolley', 'empyrealArrow', 'bloodletter',
          'rainOfDeath', 'sidewinder', 'miserysEnd', 'bluntArrow', 'repellingShot', 'flamingArrow', 'barrage', 'ragingStrikes', 'hawksEye',
          'wanderersMinuet', 'armysPaeon', 'magesBallad', 'foeRequiem', 'battleVoice']],
        ['Cross-class', ['internalRelease', 'bloodForBlood', 'invigorate']],
        ['General', ['sprint', 'tincture']],
      ];
      this.referenceDps = V.ref;
      this.referenceGcd = { hw33: 2.44, hw301: 2.43, hw30: 2.45, arr20: 2.48 }[version];
      if (V.minuetGcd) {
        this.actions.wanderersMinuet = Object.assign({}, this.actions.wanderersMinuet, { kind: 'gcd', cast: 3, recast: 2.5, sound: 'paradox',
          desc: 'Increases damage dealt by 20%, but auto-attacks stop and weaponskills take a 1.5s cast.\nCast: 3s. Effect ends upon reuse.' });
      }
      this.startDistance = 12;
      if (V.arr) {
        this.level = 50;
        this.levelKey = 'arr50';
        const A = this.actions;
        for (const k of ['ironJaws', 'empyrealArrow', 'sidewinder', 'wanderersMinuet']) delete A[k];
        A.heavyShot = Object.assign({}, A.heavyShot, { tp: 60 });
        A.straightShot = Object.assign({}, A.straightShot, { tp: 70, desc: 'Delivers an attack with a potency of 140.\nAdditional Effect: Increases critical hit rate by 10%\nDuration: 20s\nStraighter Shot Bonus: a guaranteed critical hit' });
        A.bloodletter = Object.assign({}, A.bloodletter, { cdGroup: undefined, desc: 'Delivers an attack with a potency of 150.\nRiver of Blood: each critical tick of your Venomous Bite or Windbite has a 50% chance to reset its recast.' });
        A.rainOfDeath = ws({ name: 'Rain of Death', potency: 100, tp: 180, aoe: true, desc: 'Delivers an attack with a potency of 100 to target and all enemies nearby it.\nAdditional Effect: Evasion −10%\nDuration: 20s' });
        A.barrage = Object.assign({}, A.barrage, { desc: 'Auto-attacks strike three times.\nDuration: 10s' });
        this.selfStatusOrder = this.selfStatusOrder.filter(k => k !== 'wanderersMinuet');
        this.defaultBars = [
          ['heavyShot', 'straightShot', 'venomousBite', 'windbite', 'bloodletter', 'barrage', 'ragingStrikes', 'hawksEye', 'bloodForBlood', 'internalRelease', 'invigorate', 'tincture'],
          ['flamingArrow', 'bluntArrow', 'repellingShot', 'miserysEnd', 'quickNock', 'wideVolley', 'rainOfDeath', 'armysPaeon', 'battleVoice', 'magesBallad', 'foeRequiem', 'sprint'],
          [null, null, null, null, null, null, null, null, null, null, null, null],
        ];
        this.actionGroups = this.actionGroups.map(([n, ids]) => [n, ids.filter(x => A[x])]);
      }
    }

    // A Realm Reborn's Barrage: each auto-attack strikes three times.
    autoStrikes(e) { return this.V.arr && e.has('barrage') ? 3 : 1; }

    initGauge(e) {
      this.paeon = false; this.voice = false;
      return { song: null };
    }

    minuet(e) { return e.has('wanderersMinuet'); }
    noAutos(e) { return this.minuet(e); }

    check(id, e) {
      const a = this.actions[id];
      if (a.minuet && !this.minuet(e)) return 'Unable to execute action. The Wanderer\'s Minuet required.';
      if (id === 'miserysEnd') return 'Unable to execute action. Target\'s HP must be below 20%.';
      return null;
    }

    // Under the Minuet weaponskills take a 1.5s cast; a Straighter Shot Straight Shot doesn't.
    castTime(id, e) {
      const a = this.actions[id];
      if (id === 'wanderersMinuet' && this.V.minuetGcd) return e.has('swiftcast') ? 0 : e.speedScale(3, 0);
      if (a.song) return e.has('swiftcast') ? 0 : e.speedScale(a.cast, 0);
      if (!a.shot || !this.minuet(e)) return 0;
      if (id === 'straightShot' && e.has('straighterShot')) return 0;
      return e.speedScale(MINUET_CAST, 0);
    }

    snapshot(a, e) {
      let mult = 1, critAdd = 0;
      let main = this.stats.main;
      if (this.minuet(e)) mult *= this.V.minuetMult || 1.30;
      if (e.g.song) mult *= this.V.songMult;
      if (e.has('ragingStrikes')) mult *= 1.20;
      if (e.has('bloodForBlood')) mult *= 1.10;
      if (e.has('straightShot')) critAdd += 0.10;
      if (e.has('internalRelease')) critAdd += 0.10;
      if (e.has('hawksEye')) main = Math.floor(main * 1.15);
      if (e.has('medicated')) main += this.potionCap;
      return { mult, main, critAdd };
    }

    applyDot(e, key, snap) {
      const a = this.actions[key];
      e.addTStatus(key, a.dot.duration, { snap, dot: { potency: a.dot.potency, id: key } });
    }
    // River of Blood: each bite tick has a 50% chance to reset Bloodletter.
    onDotTick(key, e, r) {
      if (this.V.arr && !(r && r.crit)) return;
      if ((key === 'venomousBite' || key === 'windbite') && Math.random() < 0.5) {
        const c = e.cds.bloodletter;
        if (c) { c.charges = c.max; c.nextAt = null; }
      }
    }

    // Barrage: three strikes; the two extra can't crit.
    strikes(e, id, potency, snap, a, after, opts) {
      const triple = !this.V.arr && e.has('barrage') && !a.aoe;
      if (triple) e.removeStatus('barrage');
      e.queueHit(id, potency, snap, a.delay, after, opts);
      if (triple) for (let k = 1; k < 3; k++) e.queueHit(id, potency, snap, a.delay + k * 0.15, null, { noCrit: true });
    }

    resolve(id, e) {
      const a = this.actions[id], g = e.g;
      if (id === 'wanderersMinuet' && this.V.minuetGcd) {
        if (this.minuet(e)) e.removeStatus('wanderersMinuet'); else e.addStatus('wanderersMinuet', 1e9, { permanent: true });
        return;
      }
      if (a.song) {
        const was = g.song;
        for (const k of SONGS) e.removeStatus(k, true);
        g.song = was === id ? null : id;
        if (g.song) e.addStatus(id, 1e9, { permanent: true });
        this.paeon = g.song === 'armysPaeon';
        return;
      }
      if (a.kind === 'gcd') {
        let crit = false;
        if (id === 'heavyShot' && Math.random() < 0.2) e.addStatus('straighterShot', 10);
        if (id === 'straightShot') {
          if (e.has('straighterShot')) { crit = true; e.removeStatus('straighterShot'); }
          e.addStatus('straightShot', 20);
        }
        const snap = this.snapshot(a, e);
        let after = a.dot ? () => this.applyDot(e, id, snap) : null;
        if (id === 'ironJaws') after = () => { for (const k of ['venomousBite', 'windbite']) if (e.tHas(k)) this.applyDot(e, k, snap); };
        this.strikes(e, id, a.potency, snap, a, after, { crit });
        return;
      }
      switch (id) {
        case 'empyrealArrow': this.strikes(e, id, a.potency, this.snapshot(a, e), a, null, {}); return;
        case 'sidewinder': {
          const n = (e.tHas('venomousBite') ? 1 : 0) + (e.tHas('windbite') ? 1 : 0);
          e.queueHit(id, this.V.side[n], this.snapshot(a, e), a.delay);
          return;
        }
        case 'flamingArrow': {
          const snap = this.snapshot(a, e);
          e.addTStatus('flamingArrow', 30, { snap, dot: { potency: this.V.flame, id } });
          return;
        }
        case 'wanderersMinuet':
          if (this.minuet(e)) e.removeStatus('wanderersMinuet'); else e.addStatus('wanderersMinuet', 1e9, { permanent: true });
          return;
        case 'repellingShot': {
          const d = e.distToTarget() || 1;
          const from = { x: e.pos.x, z: e.pos.z };
          e.pos.x += e.pos.x / d * 10; e.pos.z += e.pos.z / d * 10;
          e.emit('teleport', { from, to: { x: e.pos.x, z: e.pos.z } });
          break;
        }
        case 'barrage': e.addStatus('barrage', 10); return;
        case 'ragingStrikes': e.addStatus('ragingStrikes', 20); return;
        case 'hawksEye': e.addStatus('hawksEye', 20); return;
        case 'internalRelease': e.addStatus('internalRelease', 15); return;
        case 'bloodForBlood': e.addStatus('bloodForBlood', 20); return;
        case 'battleVoice': e.addStatus('battleVoice', 30); this.voice = true; return;
        case 'invigorate': B.ROLE_EFFECTS.invigorate(e); return;
        default:
          if (B.ROLE_EFFECTS[id]) { B.ROLE_EFFECTS[id](e); return; }
      }
      if (a.potency) e.queueHit(id, a.potency, this.snapshot(a, e), a.delay);
    }

    nextEvent(e) { return this.voice && e.statuses.battleVoice ? e.statuses.battleVoice.until : Infinity; }
    process(e) { if (this.voice && !e.has('battleVoice')) this.voice = false; }

    proc(id, e) {
      if (id === 'straightShot') return e.has('straighterShot');
      if (id === 'empyrealArrow' || id === 'ironJaws') return this.minuet(e);
      return false;
    }

    mpRegen() { return B.BASE_REGEN; }
    speedInfo(e) {
      if (this.V.arr) return `GCD ${e.gcdForSpeed(e.stats.speed).toFixed(2)} · A Realm Reborn's formula (no Direct Hit)`;
      return `GCD ${e.gcdForSpeed(e.stats.speed).toFixed(2)} · ${e.speedScale(MINUET_CAST, 0).toFixed(2)}s casts under the Minuet · Heavensward's formula (no Direct Hit)`;
    }

    gaugeBuild(root) {
      root.innerHTML = `
<svg width="360" height="80" viewBox="0 0 360 80">
  <rect x="8" y="10" width="344" height="60" rx="14" fill="rgba(14,12,20,.86)" stroke="rgba(255,255,255,.22)"/>
  <text id="bh-m" x="24" y="38" font-family="Noto Sans, sans-serif" font-size="12" font-weight="700" fill="#9ff0b0" letter-spacing="1"></text>
  <text id="bh-s" x="24" y="58" font-family="Noto Sans, sans-serif" font-size="11" font-weight="600" fill="#a9a3b4" letter-spacing="1"></text>
</svg>`;
      this.bh = { m: root.querySelector('#bh-m'), s: root.querySelector('#bh-s'), cache: {} };
    }
    gaugeUpdate(e) {
      const G = this.bh, c = G.cache;
      const m = this.V.arr ? (e.has('barrage') ? 'BARRAGE · AUTO-ATTACKS ×3' : '') : this.minuet(e) ? 'THE WANDERER\'S MINUET · +30%' : 'NO MINUET';
      if (c.m !== m) { c.m = m; G.m.textContent = m; }
      const s = e.g.song ? `SINGING: ${STATUSES[e.g.song].name.toUpperCase()}` : '';
      if (c.s !== s) { c.s = s; G.s.textContent = s; }
    }

    helpHtml(seq) {
      const V = this.V;
      if (V.arr) return `
<h3>How it plays (${V.label})</h3>
<p>Level 50 Bard on TP, before the Minuet: auto-attacks run all fight and every weaponskill is instant. Keep <b>Straight Shot</b> (+10% crit, 20s), <b>Windbite</b> (60 + 45 × 18s) and <b>Venomous Bite</b> (100 + 35 × 18s) up by hand and fill with <b>Heavy Shot</b> (150); a Straighter Shot proc (20% on Heavy Shot) makes the next Straight Shot a critical hit. When a bite ticks for a critical hit, there's a 50% chance <b>Bloodletter</b> (150) comes back at once (River of Blood).</p>
<p><b>Barrage</b> (90s) makes each auto-attack strike three times for 10s; line it up with <b>Raging Strikes</b> (+20%), <b>Hawk's Eye</b> (+15% Dexterity), <b>Blood for Blood</b> (+10%), <b>Internal Release</b> (+10% crit) and the potion. Flaming Arrow, Repelling Shot and Blunt Arrow fill the gaps. TP is the limit: Heavy Shot 60, Straight Shot 70, the bites 80 against +60 a tick, so <b>Invigorate</b> (+400) goes on cooldown. Songs cost you 20% damage; on a dummy, sing nothing.</p>
<h3>An opener (from xiv-sim's 2015 Bard priority)</h3>
${seq(['straightShot', ['ragingStrikes'], ['bloodForBlood'], 'windbite', ['internalRelease'], ['tincture'], 'venomousBite', ['barrage'], ['hawksEye'], 'heavyShot', ['bloodletter'], ['flamingArrow'], 'heavyShot', ['repellingShot'], ['bluntArrow'], 'heavyShot', 'heavyShot', 'straightShot', 'heavyShot', ['invigorate']])}
<p style="color:#a9a3b4">The 2.5x numbers: Heavy Shot 150 (60 TP), Straight Shot 140 (70), Venomous Bite 100 + 35 × 18s (80), Windbite 60 + 45 × 18s (80), Bloodletter 150, Repelling Shot 80, Blunt Arrow 50, Flaming Arrow 35 × 30s, Misery's End 190; auto-attacks 100 at 3.04s. ARR's formula here is a refit of the 2013–14 community formulas. Gear: ${V.gear}, with the ${V.potion[0]} (max ${V.potion[1]}).</p>`;
      return `
<h3>How it plays (${V.label})</h3>
<p>Level 60 Bard on TP. Turn on <b>the Wanderer's Minuet</b> and leave it on: +30% damage, but no auto-attacks and every weaponskill takes a 1.5s cast, so one oGCD fits per GCD. Keep <b>Straight Shot</b> (+10% crit, 20s), <b>Windbite</b> (${V.wb} a tick) and <b>Venomous Bite</b> (${V.vb}) up; <b>Iron Jaws</b> refreshes both bites with your current buffs, so use it under Raging Strikes. A Straighter Shot proc (20% on Heavy Shot) makes Straight Shot an instant critical hit. Each bite tick has a 50% chance to reset <b>Bloodletter</b> (150).</p>
<p><b>Empyreal Arrow</b> (${V.ea}) is a weaponskill off the GCD with its own 15s recast and a cast: put <b>Barrage</b> on it for three hits (the extra two can't crit). <b>Raging Strikes</b> (+20%), <b>Hawk's Eye</b> (+15% Dexterity), <b>Blood for Blood</b> (+10%) and <b>Internal Release</b> (+10% crit) line up for a burst; Sidewinder (up to ${V.side[2]}), Flaming Arrow, Blunt Arrow and Repelling Shot fill the gaps. TP runs low after about five minutes: Invigorate, or <b>Army's Paeon</b> (+30 TP a tick, at ${Math.round((1 - V.songMult) * 100)}% less damage while you sing).</p>
<h3>The opener (the FFXIV wiki's Heavensward Bard page)</h3>
${seq([['wanderersMinuet'], ['hawksEye'], ['bloodForBlood'], ['ragingStrikes'], ['empyrealArrow'], ['bloodletter'], 'straightShot', ['tincture'], 'windbite', ['internalRelease'], 'venomousBite', ['flamingArrow'], 'heavyShot', ['sidewinder'], 'heavyShot', ['barrage'], ['empyrealArrow'], ['bloodletter'], 'ironJaws', 'heavyShot', ['bloodletter'], ['bluntArrow'], 'straightShot', ['repellingShot'], 'heavyShot'])}
<p style="color:#a9a3b4">${V.label} numbers: Heavy Shot 150, Straight Shot 140, Venomous Bite 100 + ${V.vb} × 18s, Windbite 60 + ${V.wb} × 18s, Iron Jaws 100, Empyreal Arrow ${V.ea}, Bloodletter 150, Sidewinder ${V.side.join(' / ')}, Blunt Arrow ${V.blunt}, Repelling Shot 80, Flaming Arrow ${V.flame} × 30s; auto-attacks 100 at 3.04s outside the Minuet. Heavensward's formula. Gear: ${V.gear}, with the ${V.potion[0]} (max ${V.potion[1]}).</p>`;
    }
  }

  B.registerJob({
    id: 'brd', name: 'Bard', abbr: 'BRD', role: 'ranged', classJob: 23,
    versions: ['hw33', 'hw301', 'hw30', 'arr20'].map(v => ({ id: v, label: VERSIONS[v].label, history: VERSIONS[v].history, note: VERSIONS[v].note, create: () => new BardHW(v) })),
  });
})(window.BLM);
