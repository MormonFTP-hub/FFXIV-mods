// Summoner, Stormblood (patches 4.1–4.58) at level 70: Ruin III, Bio III and Miasma III with Tri-disaster,
// Aetherflow spent on Fester into Aethertrail Attunement, a 16s Dreadwyrm Trance (+10% magic damage, instant Ruin III,
// Deathflare, a Tri-disaster reset), two Trances for Demi-Bahamut (20s of Wyrmwave on every action you use, and Akh
// Morn), and an egi that attacks on its own: Garuda-Egi (Wind Blade, Aerial Slash, Contagion) or Ifrit-Egi (Burning
// Strike, Crimson Cyclone, Flaming Crush). Every pet action has a 15% chance of Further Ruin, which turns Ruin II into
// Ruin IV and takes 10s off Enkindle. Numbers are the 4.58 game data (Action and ActionTransient, through xivapi's
// datamining at the 4.58 commit), checked against the wiki's pre-5.0 revisions and xivanalysis's Stormblood module.
(function (B) {
  const EPS = 1e-6;
  const MAX_MP = 13320;                 // level 70: 12,000 × Summoner's 111% MP modifier, no Piety gear
  const PET_PROC = 0.15;                // Further Ruin chance per pet action (Enhanced Ruin II)
  const FURTHER_RUIN = 30;              // its duration (not in the data we have; 30s as remembered)
  const TRANCE = 16, BAHAMUT = 20;
  const FALLOFF = [1, 0.9, 0.8, 0.7, 0.6, 0.5];
  const PET_CD = { aerialSlash: 30, crimsonCyclone: 40, flamingCrush: 30 };
  const EGI = {
    garuda: { basic: 'windBlade', basicDelay: 1.0, abilities: ['aerialSlash'], enkindle: 'aerialBlast', label: 'Garuda-Egi' },
    ifrit: { basic: 'burningStrike', basicDelay: 0.5, abilities: ['crimsonCyclone', 'flamingCrush'], enkindle: 'inferno', label: 'Ifrit-Egi' },
  };

  const spell = (o) => Object.assign({ kind: 'gcd', target: true, range: 25, delay: 0.8, school: 'none', sound: 'ruin' }, o);
  const ability = (o) => Object.assign({ kind: 'ogcd' }, o);
  const pet = (o) => Object.assign({ kind: 'pet', pet: true, delay: 0.6 }, o);
  const ACTIONS = {
    ruin3: spell({
      name: 'Ruin III', potency: 120, cast: 2.5, mp: 240, ruin: true, orb: true,
      desc: 'Deals unaspected damage with a potency of 120.\nDreadwyrm Trance Bonus: Removes cast time.',
    }),
    ruin2: spell({
      name: 'Ruin II', potency: 100, mp: 480, ruin: true, orb: true,
      desc: 'Deals unaspected damage with a potency of 100.\nRuin II changes to Ruin IV while under the effect of Further Ruin.',
    }),
    ruin4: spell({
      name: 'Ruin IV', potency: 200, mp: 240, ruin: true, orb: true, sound: 'xeno',
      desc: 'Deals unaspected damage with a potency of 200.\nCan only be executed while under the effect of Further Ruin.',
    }),
    bio3: spell({
      name: 'Bio III', potency: 0, mp: 720, school: 'aether', dot: { potency: 50, duration: 30 }, sound: 'dot',
      desc: 'Deals unaspected damage over time.\nPotency: 50\nDuration: 30s',
    }),
    miasma3: spell({
      name: 'Miasma III', potency: 50, cast: 2.5, mp: 600, school: 'aether', dot: { potency: 50, duration: 30 },
      desc: 'Deals unaspected damage with a potency of 50.\nAdditional Effect: Unaspected damage over time\nPotency: 50\nDuration: 30s',
    }),
    triBind: spell({
      name: 'Tri-bind', potency: 30, trancePotency: 70, cast: 2.5, mp: 1200, aoe: true,
      desc: 'Deals unaspected damage with a potency of 30 to target and all enemies nearby it.\nAdditional Effect: Bind\nDuration: 20s\nDreadwyrm Trance Bonus: Potency increased to 70. Bind effect removed. MP cost reduced.',
    }),
    physick: spell({ name: 'Physick', potency: 0, cast: 2.0, mp: 600, target: false, desc: 'Restores target\'s HP.\nCure Potency: 400' }),
    summon: spell({
      name: 'Summon', potency: 0, cast: 3.0, mp: 1200, target: false, egi: 'garuda',
      desc: 'Summons Garuda-Egi to fight by your side. Garuda-Egi casts Wind Blade every 3s and Aerial Slash when it can, and you can order Contagion.',
    }),
    summon3: spell({
      name: 'Summon III', potency: 0, cast: 3.0, mp: 1200, target: false, egi: 'ifrit',
      desc: 'Summons Ifrit-Egi to fight by your side. Ifrit-Egi uses Burning Strike every 3s, and Crimson Cyclone and Flaming Crush when it can.',
    }),
    triDisaster: ability({
      name: 'Tri-disaster', recast: 60, target: true, range: 25,
      desc: 'Inflicts target with Bio III and Miasma III.\nAdditional Effect: Ruination\nRuination Effect: Increases the potency of Ruin, Ruin II, Ruin III, and Ruin IV used on the target by 20\nDuration: 15s',
    }),
    aetherflow: ability({ name: 'Aetherflow', recast: 60, desc: 'Restores 10% of maximum MP.\nAdditional Effect: Aetherflow III\nCannot be executed while under the effect of Dreadwyrm Trance.' }),
    energyDrain: ability({
      name: 'Energy Drain', recast: 3, potency: 150, flow: true, target: true, range: 25, delay: 0.6, school: 'aether', sound: 'xeno',
      desc: 'Deals unaspected damage with a potency of 150.\nAdditional Effect: Absorbs a portion of damage dealt as HP, and restores MP\nAetherflow Gauge Cost: 1\nAdditional Effect: Aethertrail Attunement +1',
    }),
    fester: ability({
      name: 'Fester', recast: 5, potency: 0, perDot: 150, flow: true, target: true, range: 25, delay: 0.6, school: 'aether', sound: 'xeno',
      desc: 'Deals unaspected damage with a potency of 150 for each of your Bio or Miasma effects on the target (300 with both).\nAetherflow Gauge Cost: 1\nAdditional Effect: Aethertrail Attunement +1',
    }),
    painflare: ability({
      name: 'Painflare', recast: 5, potency: 180, flow: true, target: true, range: 25, aoe: true, delay: 0.7, school: 'aether', sound: 'xeno',
      desc: 'Deals unaspected damage with a potency of 180 to target and all enemies nearby it.\nAetherflow Gauge Cost: 1\nAdditional Effect: Aethertrail Attunement +1',
    }),
    bane: ability({
      name: 'Bane', recast: 10, flow: true, target: true, range: 25,
      desc: 'Spreads a target\'s Bio and Miasma effects to nearby enemies, with potency reduced by 20% for the second enemy, 40% for the third, 60% for the fourth and 80% for the rest.\nAdditional Effect: 15% chance that the duration of each spread effect is reset\nAetherflow Gauge Cost: 1\nAdditional Effect: Aethertrail Attunement +1',
    }),
    dreadwyrmTrance: ability({
      name: 'Dreadwyrm Trance', recast: 20,
      desc: 'Increases magic damage dealt by 10%. Also removes the cast time of Ruin III and enhances Tri-bind.\nDuration: 16s\nAdditional Effect: Resets Tri-disaster recast time\nAdditional Effect: Grants Dreadwyrm Aether when the effect ends\nCan only be executed while in possession of 3 stacks of Aethertrail Attunement.',
    }),
    deathflare: ability({
      name: 'Deathflare', recast: 15, potency: 400, target: true, range: 25, aoe: FALLOFF, delay: 1.0, school: 'bahamut', big: true, sound: 'akhmorn',
      desc: 'Deals unaspected damage to target and all enemies nearby it with a potency of 400 for the first enemy, 10% less for the second, 20% less for the third, 30% less for the fourth, 40% less for the fifth, and 50% less for all remaining enemies.\nDreadwyrm Trance effect ends upon use.\nCan only be executed while under the effect of Dreadwyrm Trance.',
    }),
    summonBahamut: ability({
      name: 'Summon Bahamut', recast: 30,
      desc: 'Summons Demi-Bahamut to fight by your side. Each time you use an action on a target, Demi-Bahamut will execute Wyrmwave on the same target.\nDuration: 20s\nDreadwyrm Aether Cost: 2\nCannot summon Demi-Bahamut unless a pet is already summoned. Current pet will leave the battlefield while Demi-Bahamut is present, and return once gone.',
    }),
    enkindleBahamut: ability({
      name: 'Enkindle Bahamut', recast: 13, target: true, range: 25,
      desc: 'Orders Demi-Bahamut to execute Akh Morn.\nAkh Morn Potency: 680 for the first enemy, 10% less for the second, 20% less for the third, 30% less for the fourth, 40% less for the fifth, and 50% less for all remaining enemies.',
    }),
    rouse: ability({ name: 'Rouse', recast: 60, desc: 'Increases damage and healing dealt by pet by 40%.\nDuration: 20s' }),
    enkindle: ability({
      name: 'Enkindle', recast: 180, target: true, range: 30,
      desc: 'Commands pet to use its signature attack: Aerial Blast (Garuda-Egi, 250 to all enemies near the target) or Inferno (Ifrit-Egi, 200 in a cone plus a fire DoT of 20 for 15s).\nEnhanced Enkindle: each Further Ruin shortens the recast by 10s.',
    }),
    aetherpact: ability({
      name: 'Aetherpact', recast: 120,
      desc: 'Orders pet to use Devotion: increases damage dealt by 2% and healing magic potency by 5%, and reduces damage taken by 2%, for party members near the pet.\nDuration: 15s',
    }),
    contagion: ability({
      name: 'Contagion', recast: 60, target: true, range: 25,
      desc: 'Orders Garuda-Egi to use Contagion: increases the target\'s magic damage taken by 10%.\nDuration: 15s',
    }),
    shadowFlare: ability({
      name: 'Shadow Flare', recast: 60, target: true, range: 25, school: 'none', dot: { potency: 50, duration: 15, aoe: true },
      desc: 'Creates a patch of dark miasma on the ground, dealing unaspected damage with a potency of 50 to any enemies who enter.\nDuration: 15s\nAdditional Effect: Slow +5%',
    }),
    // The caster role actions of 4.5 (five could be slotted in Stormblood; these are the usual ones).
    swiftcast: { name: 'Swiftcast', kind: 'ogcd', recast: 60, role: true, desc: 'Next spell is cast immediately.\nDuration: 10s' },
    lucidDreaming: { name: 'Lucid Dreaming', kind: 'ogcd', recast: 120, role: true, desc: 'Reduces enmity by half.\nAdditional Effect: Refresh\nPotency: 80\nDuration: 21s' },
    addle: { name: 'Addle', kind: 'ogcd', recast: 90, role: true, target: true, range: 25, desc: 'Lowers target\'s intelligence and mind by 10%.\nDuration: 10s' },
    surecast: { name: 'Surecast', kind: 'ogcd', recast: 30, role: true, desc: 'Spells can be cast without interruption.\nAdditional Effect: Nullifies most knockback and draw-in effects\nDuration: 5s' },
    ...B.GENERAL_ACTIONS,
    tincture: B.tincture('int3sb'),
    // What the pets do (not on your hotbars).
    windBlade: pet({ name: 'Wind Blade', potency: 110, school: 'aether', delay: 1.0, sound: 'wind' }),
    aerialSlash: pet({ name: 'Aerial Slash', potency: 90, school: 'aether', aoe: true, sound: 'wind' }),
    aerialBlast: pet({ name: 'Aerial Blast', potency: 250, school: 'aether', aoe: true, big: true, delay: 1.0, sound: 'wind' }),
    burningStrike: pet({ name: 'Burning Strike', potency: 135, school: 'fire', delay: 0.4, sound: 'fire' }),
    crimsonCyclone: pet({ name: 'Crimson Cyclone', potency: 110, school: 'fire', sound: 'fire' }),
    flamingCrush: pet({ name: 'Flaming Crush', potency: 110, school: 'fire', aoe: true, sound: 'fire' }),
    inferno: pet({ name: 'Inferno', potency: 200, school: 'fire', aoe: true, big: true, delay: 0.8, dot: { potency: 20, duration: 15, aoe: true }, sound: 'fire4' }),
    wyrmwave: pet({ name: 'Wyrmwave', potency: 150, school: 'bahamut', bahamut: true, delay: 0.9, sound: 'wyrm' }),
    akhMorn: pet({ name: 'Akh Morn', potency: 680, school: 'bahamut', bahamut: true, aoe: FALLOFF, big: true, delay: 1.2, sound: 'akhmorn' }),
  };

  const STATUSES = {
    dreadwyrmTrance: { name: 'Dreadwyrm Trance', self: true, icon: 'st_trance' },
    furtherRuin: { name: 'Further Ruin', self: true, icon: 'st_ruin' },
    rouse: { name: 'Rouse', self: true, icon: 'st_rouse' },
    devotion: { name: 'Devotion', self: true, icon: 'st_devotion' },
    bio3: { name: 'Bio III', self: false, icon: 'st_bio' },
    miasma3: { name: 'Miasma III', self: false, icon: 'st_miasma' },
    ruination: { name: 'Ruination', self: false, icon: 'st_ruination' },
    contagion: { name: 'Contagion', self: false, icon: 'st_contagion' },
    shadowFlare: { name: 'Shadow Flare', self: false, icon: 'st_shadowflare' },
    inferno: { name: 'Inferno', self: false, icon: 'st_inferno' },
  };

  class SummonerSB {
    constructor() {
      this.name = 'Summoner';
      this.abbr = 'SMN';
      this.role = 'caster';
      this.level = 70;
      this.levelKey = 'sb70';
      this.model = 'smn-sb';
      this.maxMp = MAX_MP;
      this.actions = ACTIONS;
      this.statuses = STATUSES;
      // A rough 4.5 crit set (Alphascape item level 400–405, the Omega Grimoire: 147 magic damage, 3.12 delay in the 4.58
      // game data) at the 2.46 GCD; level-70 stats. Maim and Mend II (+30%) covers the summoner and the pets.
      this.stats = { hp: 31000, main: 3300, mainStat: 'int', jobMod: 115, trait: 130, wd: 147, det: 1500, crit: 2500,
        dh: 1950, speed: 600, delay: 3.12 };
      this.speedName = 'Spell speed';
      this.selfStatusOrder = ['dreadwyrmTrance', 'furtherRuin', 'rouse', 'devotion', 'swiftcast', 'medicated', 'lucidDreaming', 'surecast', 'sprint'];
      this.targetStatusOrder = ['bio3', 'miasma3', 'ruination', 'contagion', 'shadowFlare', 'inferno', 'addle'];
      this.defaultBars = [
        ['ruin3', 'ruin2', 'bio3', 'miasma3', 'triDisaster', 'fester', 'energyDrain', 'aetherflow', 'dreadwyrmTrance', 'deathflare', 'summonBahamut', 'enkindleBahamut'],
        ['rouse', 'enkindle', 'contagion', 'aetherpact', 'swiftcast', 'lucidDreaming', 'tincture', 'addle', 'surecast', 'physick', 'summon', 'summon3'],
        ['painflare', 'bane', 'triBind', 'shadowFlare', 'sprint', null, null, null, null, null, null, null],
      ];
      this.actionGroups = [
        ['Summoner', ['ruin3', 'ruin2', 'ruin4', 'bio3', 'miasma3', 'triDisaster', 'aetherflow', 'energyDrain', 'fester', 'painflare', 'bane',
          'dreadwyrmTrance', 'deathflare', 'summonBahamut', 'enkindleBahamut', 'rouse', 'enkindle', 'aetherpact', 'contagion', 'shadowFlare',
          'triBind', 'physick', 'summon', 'summon3']],
        ['Role Actions', ['swiftcast', 'lucidDreaming', 'addle', 'surecast']],
        ['General', ['sprint', 'tincture']],
      ];
      // What the 4.0–4.06 version (smn_sb40.js) changes.
      this.cfg = { trance: TRANCE, instantRuin3: true, petProc: PET_PROC, devotion: 1.02 };
      this.referenceDps = 8000;     // a scripted 4.58 rotation at 2.46 parses about 7,600 on the dummy
      this.referenceGcd = 2.46;
      this.startDistance = 12;
    }

    initGauge(e) {
      e.pet = { kind: 'garuda' };
      return { egi: 'garuda', flow: 0, trail: 0, aether: 0, trance: false, bahamutUntil: 0, petNext: 0, petAbilAt: null, petCd: {} };
    }

    bahamutOut(e) { return e.g.bahamutUntil > e.now + EPS; }

    resolveId(id, e) { return id === 'ruin2' && e.has('furtherRuin') ? 'ruin4' : id; }

    check(id, e) {
      const a = this.actions[id], g = e.g;
      const egiOut = !!g.egi && !this.bahamutOut(e);
      if (id === 'ruin4' && !e.has('furtherRuin')) return 'Unable to execute action. Further Ruin required.';
      if (a.flow && g.flow < 1) return 'Unable to execute action. Aetherflow required.';
      switch (id) {
        case 'aetherflow': if (e.has('dreadwyrmTrance')) return 'Unable to execute action while under the effect of Dreadwyrm Trance.'; break;
        case 'dreadwyrmTrance':
          if (g.trail < 3) return 'Unable to execute action. Aethertrail Attunement required.';
          if (this.bahamutOut(e)) return 'Unable to execute action while Demi-Bahamut is summoned.';
          break;
        case 'deathflare': if (!e.has('dreadwyrmTrance')) return 'Unable to execute action. Dreadwyrm Trance required.'; break;
        case 'summonBahamut':
          if (g.aether < 2) return 'Unable to execute action. Dreadwyrm Aether required.';
          if (e.has('dreadwyrmTrance')) return 'Unable to execute action while under the effect of Dreadwyrm Trance.';
          if (!g.egi) return 'Unable to execute action. Pet required.';
          break;
        case 'enkindleBahamut': if (!this.bahamutOut(e)) return 'Unable to execute action. Demi-Bahamut required.'; break;
        case 'contagion': if (!egiOut || g.egi !== 'garuda') return 'Unable to execute action. Garuda-Egi required.'; break;
        case 'enkindle': case 'aetherpact': if (!egiOut) return 'Unable to execute action. Pet required.'; break;
        case 'rouse': if (!g.egi) return 'Unable to execute action. Pet required.'; break;
        case 'summon': case 'summon3': if (this.bahamutOut(e)) return 'Unable to execute action while Demi-Bahamut is summoned.'; break;
      }
      return null;
    }

    castTime(id, e) {
      const a = this.actions[id];
      if (!a.cast) return 0;
      if (id === 'ruin3' && this.cfg.instantRuin3 && e.has('dreadwyrmTrance')) return 0;
      if (e.has('swiftcast')) return 0;
      return e.speedScale(a.cast, 0);
    }

    consumeInstant(id, e) {
      const a = this.actions[id];
      if (!a.cast || (id === 'ruin3' && this.cfg.instantRuin3 && e.has('dreadwyrmTrance'))) return;
      if (e.has('swiftcast')) e.removeStatus('swiftcast');
    }

    mpCost(id, e) {
      const a = this.actions[id];
      if (id === 'triBind' && e.has('dreadwyrmTrance')) return Math.round(a.mp / 2);
      return a.mp || 0;
    }

    mpRegen(e) { return Math.round(MAX_MP * 0.02); }
    lucidGain() { return 960; }            // Refresh potency 80 at level 70

    // Your spells: Dreadwyrm Trance (+10% magic). Pets: Rouse (+40%). Both: Devotion (+2%), Contagion (+10% magic
    // taken). Whether Trance reached the pets isn't documented; here it doesn't.
    snapshot(a, e) {
      let mult = 1;
      const isPet = !!(a && a.pet);
      if (!isPet && e.has('dreadwyrmTrance')) mult *= 1.10;
      if (isPet && e.has('rouse')) mult *= 1.40;
      if (e.has('devotion')) mult *= this.cfg.devotion;
      if (e.tHas('contagion')) mult *= 1.10;
      const main = this.stats.main + (e.has('medicated') ? B.TINCTURES.int3sb.cap : 0);
      return { mult, main };
    }

    resolve(id, e) {
      const a = this.actions[id];
      if (a.kind === 'gcd') this.spell(id, e);
      else this.ability(id, e);
      // Demi-Bahamut answers every action you use on a target with Wyrmwave.
      if (a.target && this.bahamutOut(e)) this.petAct(e, 'wyrmwave');
    }

    applyDot(e, key) {
      const a = this.actions[key];
      e.addTStatus(key, a.dot.duration, { snap: this.snapshot(a, e), dot: { potency: a.dot.potency, id: key } });
    }

    spell(id, e) {
      const a = this.actions[id], g = e.g;
      e.mp = Math.max(0, e.mp - this.mpCost(id, e));
      let potency = a.potency;
      if (a.ruin && e.tHas('ruination')) potency += 20;
      if (id === 'ruin4') e.removeStatus('furtherRuin');
      if (id === 'triBind' && e.has('dreadwyrmTrance')) potency = a.trancePotency;
      if (id === 'bio3') this.applyDot(e, 'bio3');
      if (a.egi) {
        g.egi = a.egi;
        if (!this.bahamutOut(e)) { e.pet = { kind: a.egi }; g.petNext = e.now + 1; g.petAbilAt = null; }
        return;
      }
      if (potency) e.queueHit(id, potency, this.snapshot(a, e), a.delay, id === 'miasma3' ? () => this.applyDot(e, 'miasma3') : null);
    }

    ability(id, e) {
      const a = this.actions[id], g = e.g;
      if (a.flow) {
        g.flow--;
        g.trail = Math.min(3, g.trail + 1);
        e.emit('aether', {});
      }
      switch (id) {
        case 'triDisaster':
          this.applyDot(e, 'bio3'); this.applyDot(e, 'miasma3');
          e.addTStatus('ruination', 15);
          break;
        case 'aetherflow': {
          g.flow = 3 - g.trail;
          const before = e.mp;
          e.mp = Math.min(e.maxMp, e.mp + Math.round(e.maxMp * 0.1));
          e.emit('mpGain', { amount: e.mp - before, source: 'manafont' });
          e.emit('aether', {});
          break;
        }
        case 'energyDrain': {
          // The MP it gives back isn't in the data; 5% of max is about what it felt like.
          const before = e.mp;
          e.mp = Math.min(e.maxMp, e.mp + Math.round(e.maxMp * 0.05));
          if (e.mp > before) e.emit('mpGain', { amount: e.mp - before, source: 'lucid' });
          break;
        }
        case 'fester': {
          const n = (e.tHas('bio3') ? 1 : 0) + (e.tHas('miasma3') ? 1 : 0);
          if (n) e.queueHit(id, a.perDot * n, this.snapshot(a, e), a.delay);
          return;
        }
        case 'bane':
          // Spread Bio and Miasma to the rest of the pack, weaker on each further enemy.
          for (const k of ['bio3', 'miasma3']) {
            const st = e.tStatuses[k];
            if (st && st.until > e.now && e.targets > 1) { st.targets = e.targets; st.aoe = [1, 0.8, 0.6, 0.4, 0.2]; }
          }
          return;
        case 'dreadwyrmTrance': {
          g.trail = 0; g.trance = true;
          e.addStatus('dreadwyrmTrance', this.cfg.trance);
          const c = e.cds.triDisaster;
          if (c) { c.charges = c.max; c.nextAt = null; }
          e.emit('aether', {});
          return;
        }
        case 'deathflare': e.removeStatus('dreadwyrmTrance'); break;
        case 'summonBahamut':
          g.aether = 0;
          g.bahamutUntil = e.now + BAHAMUT;
          e.pet = { kind: 'bahamut' };
          e.emit('aether', {});
          return;
        case 'enkindleBahamut': this.petAct(e, 'akhMorn'); return;
        case 'rouse': e.addStatus('rouse', 20); return;
        case 'enkindle': this.petAct(e, EGI[g.egi].enkindle); return;
        case 'aetherpact': e.addStatus('devotion', 15); return;
        case 'contagion':
          e.addTStatus('contagion', 15);
          this.rollFurtherRuin(e);
          return;
        case 'shadowFlare': this.applyDot(e, 'shadowFlare'); return;
        default:
          if (B.ROLE_EFFECTS[id]) B.ROLE_EFFECTS[id](e);
      }
      if (a.potency) e.queueHit(id, a.potency, this.snapshot(a, e), a.delay);
    }

    // A pet action: what it throws (the scene draws it from the pet), its hit, and a chance at Further Ruin.
    // Demi-Bahamut's hits that land after it has left do nothing, as in the game.
    petAct(e, id) {
      const a = this.actions[id];
      e.emit('petUse', { id });
      const snap = this.snapshot(a, e);
      const after = a.dot ? () => e.addTStatus(id, a.dot.duration, { snap, dot: { potency: a.dot.potency, id } }) : null;
      e.queueHit(id, a.potency, snap, a.delay, after, a.bahamut ? { expires: e.g.bahamutUntil } : null);
      this.rollFurtherRuin(e);
    }

    rollFurtherRuin(e) {
      if (e.has('furtherRuin') || Math.random() >= this.cfg.petProc) return;
      e.addStatus('furtherRuin', FURTHER_RUIN);
      const c = e.cds.enkindle;                          // Enhanced Enkindle: 10s off its recast
      if (c && c.nextAt !== null) c.nextAt = Math.max(e.now, c.nextAt - 10);
    }

    // The egi's turn, Demi-Bahamut leaving, and Dreadwyrm Trance ending.
    nextEvent(e) {
      const g = e.g;
      let t = Infinity;
      if (g.bahamutUntil > e.now) t = Math.min(t, g.bahamutUntil);
      if (g.trance && e.statuses.dreadwyrmTrance) t = Math.min(t, e.statuses.dreadwyrmTrance.until);
      if (e.inCombat && g.egi && !this.bahamutOut(e)) {
        t = Math.min(t, Math.max(g.petNext, e.now));
        if (g.petAbilAt !== null) t = Math.min(t, g.petAbilAt);
      }
      return t;
    }

    process(e) {
      const g = e.g, now = e.now;
      if (g.trance && !e.has('dreadwyrmTrance')) {
        g.trance = false;
        g.aether = Math.min(2, g.aether + 1);
        e.emit('aether', {});
      }
      if (g.bahamutUntil && now >= g.bahamutUntil - EPS) {
        g.bahamutUntil = 0;
        e.pet = g.egi ? { kind: g.egi } : null;
        g.petNext = now + 1; g.petAbilAt = null;
      }
      if (!e.inCombat || !g.egi || this.bahamutOut(e)) return;
      const egi = EGI[g.egi];
      if (now >= g.petNext - EPS) {
        this.petAct(e, egi.basic);
        g.petNext = now + 3;
        // Its other attacks go between its basic ones when they're ready.
        if (g.petAbilAt === null && egi.abilities.some(x => (g.petCd[x] || 0) <= now + 1.5)) g.petAbilAt = now + 1.5;
      }
      if (g.petAbilAt !== null && now >= g.petAbilAt - EPS) {
        g.petAbilAt = null;
        const x = egi.abilities.find(k => (g.petCd[k] || 0) <= now + EPS);
        if (x) { g.petCd[x] = now + PET_CD[x]; this.petAct(e, x); }
      }
    }

    // Hotbar borders: Ruin IV, a full Aethertrail, Deathflare, Demi-Bahamut ready, Fester with both DoTs, Akh Morn.
    proc(id, e) {
      const g = e.g;
      switch (id) {
        case 'ruin4': return true;
        case 'dreadwyrmTrance': return g.trail >= 3 && !this.bahamutOut(e);
        case 'deathflare': return e.has('dreadwyrmTrance');
        case 'summonBahamut': return g.aether >= 2;
        case 'enkindleBahamut': return this.bahamutOut(e);
        case 'fester': return g.flow > 0 && e.tHas('bio3') && e.tHas('miasma3');
        default: return false;
      }
    }

    speedInfo(e) { return `GCD ${e.gcdForSpeed(e.stats.speed).toFixed(2)} · Ruin III ${e.speedScale(2.5).toFixed(2)}s cast · ${e.maxMp.toLocaleString()} MP`; }

    // ---------- the Aetherflow gauge ----------
    gaugeBuild(root) {
      root.innerHTML = `
<svg width="360" height="200" viewBox="0 0 360 200">
  <defs>
    <radialGradient id="sm-flow" cx="50%" cy="40%" r="60%"><stop offset="0" stop-color="#f6e9ff"/><stop offset="1" stop-color="#9a52e0"/></radialGradient>
    <radialGradient id="sm-trail" cx="50%" cy="40%" r="60%"><stop offset="0" stop-color="#e8fff8"/><stop offset="1" stop-color="#2fc4a0"/></radialGradient>
    <radialGradient id="sm-aether" cx="50%" cy="40%" r="60%"><stop offset="0" stop-color="#fff4d6"/><stop offset="1" stop-color="#d9962e"/></radialGradient>
    <linearGradient id="sm-bar" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#5a3fd6"/><stop offset="1" stop-color="#c8a8ff"/></linearGradient>
    <filter id="sm-g" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="3" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
  </defs>
  <rect x="8" y="10" width="344" height="178" rx="14" fill="rgba(14,12,20,.86)" stroke="rgba(255,255,255,.22)"/>
  <text x="24" y="38" font-family="Noto Sans, sans-serif" font-size="11" font-weight="600" fill="#a9a3b4" letter-spacing="1">AETHERFLOW</text>
  ${[0, 1, 2].map(k => `<g id="sm-slot${k}" transform="translate(${50 + k * 52} 72)"><circle r="19" fill="#1d1a2a" stroke="rgba(255,255,255,.25)" stroke-width="1.5"/><path d="M0 -10 L8 0 L0 10 L-8 0 Z" fill="#fff" opacity=".2"/></g>`).join('')}
  <text x="226" y="38" font-family="Noto Sans, sans-serif" font-size="11" font-weight="600" fill="#a9a3b4" letter-spacing="1">DREADWYRM AETHER</text>
  ${[0, 1].map(k => `<path id="sm-ae${k}" d="M0 -15 L11 0 L0 15 L-11 0 Z" transform="translate(${262 + k * 40} 72)" fill="#2a2535" stroke="rgba(0,0,0,.8)" stroke-width="1.5"/>`).join('')}
  <text id="sm-phase" x="24" y="128" font-family="Noto Sans, sans-serif" font-size="11" font-weight="600" fill="#a9a3b4" letter-spacing="1">PET</text>
  <rect x="24" y="140" width="312" height="14" rx="7" fill="#1d1a2a" stroke="rgba(255,255,255,.2)"/>
  <rect id="sm-bar" x="24" y="140" width="0" height="14" rx="7" fill="url(#sm-bar)"/>
  <text id="sm-time" x="336" y="128" text-anchor="end" font-family="Saira Semi Condensed, sans-serif" font-size="18" font-weight="700" fill="#fff" stroke="#000" stroke-width="3" paint-order="stroke"></text>
</svg>`;
      const $ = (s) => root.querySelector(s);
      this.sg = { slots: [0, 1, 2].map(k => $('#sm-slot' + k)), ae: [0, 1].map(k => $('#sm-ae' + k)), phase: $('#sm-phase'), bar: $('#sm-bar'), time: $('#sm-time'), cache: {} };
    }

    gaugeUpdate(e) {
      const G = this.sg, c = G.cache, g = e.g;
      const put = (k, v, fn) => { if (c[k] !== v) { c[k] = v; fn(v); } };
      for (let i = 0; i < 3; i++) {
        const v = i < g.trail ? 'trail' : i < g.trail + g.flow ? 'flow' : '';
        put('s' + i, v, w => {
          G.slots[i].querySelector('circle').setAttribute('fill', w === 'trail' ? 'url(#sm-trail)' : w === 'flow' ? 'url(#sm-flow)' : '#1d1a2a');
          G.slots[i].querySelector('path').setAttribute('opacity', w ? '.9' : '.2');
          G.slots[i].setAttribute('filter', w ? 'url(#sm-g)' : '');
        });
      }
      for (let i = 0; i < 2; i++) put('a' + i, g.aether > i, v => { G.ae[i].setAttribute('fill', v ? 'url(#sm-aether)' : '#2a2535'); G.ae[i].setAttribute('filter', v ? 'url(#sm-g)' : ''); });
      let label = (EGI[g.egi] || {}).label || 'NO PET', left = 0, total = 1;
      if (this.bahamutOut(e)) { label = 'DEMI-BAHAMUT'; left = g.bahamutUntil - e.now; total = BAHAMUT; }
      else if (e.has('dreadwyrmTrance')) { label = 'DREADWYRM TRANCE'; left = e.statuses.dreadwyrmTrance.until - e.now; total = this.cfg.trance; }
      put('ph', label.toUpperCase(), v => { G.phase.textContent = v; });
      put('bar', Math.round(left * 10), () => {
        G.bar.setAttribute('width', String(312 * Math.max(0, Math.min(1, left / total))));
        G.time.textContent = left > 0 ? left.toFixed(1) : '';
      });
    }

    helpHtml(seq) {
      return `
<h3>How it plays (Stormblood 4.1–4.58)</h3>
<p>Level 70 Summoner. Keep <b>Bio III</b> and <b>Miasma III</b> on the dummy (or refresh both at once with <b>Tri-disaster</b>, which also puts up Ruination: +20 potency on your Ruins for 15s), and fill with <b>Ruin III</b> (2.5s cast). <b>Ruin II</b> is instant, for weaving and moving.</p>
<p><b>Aetherflow</b> (60s) gives three stacks. Spend each on <b>Fester</b> (300 with both DoTs up), Energy Drain or Painflare; each fills a slot of <b>Aethertrail Attunement</b>. With three, <b>Dreadwyrm Trance</b> gives 16s of +10% magic damage, instant Ruin III and a fresh Tri-disaster; end it with <b>Deathflare</b> (400). Each Trance leaves a Dreadwyrm Aether, and two summon <b>Demi-Bahamut</b> for 20s: every action you use on the dummy, oGCDs included, makes it cast Wyrmwave (150), and <b>Enkindle Bahamut</b> (13s) is Akh Morn (680). Weave hard while it's out.</p>
<p>Your egi attacks on its own once you're in combat. <b>Garuda-Egi</b> casts Wind Blade (110) every 3s and Aerial Slash when it can, and you can order <b>Contagion</b> (+10% magic damage taken for 15s). <b>Ifrit-Egi</b> (Summon III) hits harder on its own with Burning Strike (135), Crimson Cyclone and Flaming Crush, but has no Contagion. Each pet action has a 15% chance of <b>Further Ruin</b>, which turns Ruin II into <b>Ruin IV</b> (200, instant) and takes 10s off Enkindle. <b>Rouse</b> is +40% pet damage for 20s, <b>Aetherpact</b> is Devotion (+2%).</p>
<h3>An opener for this version</h3>
${seq(['ruin3', ['triDisaster'], 'ruin2', ['aetherflow'], ['tincture'], 'ruin3', ['contagion'], ['rouse'], 'ruin3', ['enkindle'], ['fester'], 'ruin3', ['fester'], ['aetherpact'], 'ruin2', ['fester'], ['dreadwyrmTrance'], 'ruin3', ['triDisaster'], 'ruin3', 'ruin3', 'ruin3', 'ruin3', 'ruin3', ['deathflare']])}
<p>Ruin III goes off as the countdown ends; your egi starts as soon as you're in combat. The second Aetherflow's Trance gives the second Aether, then Demi-Bahamut: line its 20s up with Contagion and Devotion and fit two Akh Morns. This follows the version's rules; it isn't copied from a published guide.</p>
<p style="color:#a9a3b4">The 4.58 numbers: Ruin III 120, Ruin II 100, Ruin IV 200, Bio III 50 a tick and Miasma III 50 + 50 a tick for 30s, Fester 150 per DoT, Energy Drain 150, Painflare 180, Deathflare 400, Wyrmwave 150, Akh Morn 680, Wind Blade 110 every 3s, Aerial Slash 90, Aerial Blast 250, Burning Strike 135, Crimson Cyclone and Flaming Crush 110, Inferno 200 + 20 a tick. 13,320 MP. Pets use your stats here (the exact Stormblood pet formula isn't documented); Ifrit-Egi's separate auto-attack, Further Ruin's duration and Energy Drain's MP are left out or approximate.</p>`;
    }
  }

  B.SummonerSB = SummonerSB;
  B.SMN_SB = { ACTIONS };

  B.registerJob({
    id: 'smn', name: 'Summoner', abbr: 'SMN', role: 'caster', classJob: 27,
    versions: [{ id: 'sb41', label: 'Stormblood 4.1–4.58', history: 'SB 4.1–4.58', note: 'Level 70. Garuda-Egi or Ifrit-Egi, Bio III and Miasma III with Tri-disaster, Fester, a 16s Dreadwyrm Trance with instant Ruin III, Demi-Bahamut with Wyrmwave and Akh Morn, Further Ruin', create: () => new SummonerSB() }],
  });
})(window.BLM);
