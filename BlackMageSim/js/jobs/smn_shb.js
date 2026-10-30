// Summoner, Shadowbringers at level 80, in two versions. Ruin III (200, 2.5s), Bio III and Miasma III (30s) with
// Tri-disaster, Energy Drain (30s) for two Aetherflow spent on Fester (100 / 200 / 300 by your DoTs), and Ifrit-Egi
// fighting at your side: Burning Strike every 3s, Egi Assault (Crimson Cyclone) and Egi Assault II (Flaming Crush), two
// charges each on 30s, every one a stack of Further Ruin (up to four) for Ruin IV. The trance button cycles: Dreadwyrm
// Trance (15s: instant Ruin III, Deathflare 400, and a Tri-disaster reset) leaves two Dreadwyrm Aether for Summon
// Bahamut (20s: Wyrmwave 150 for every spell you cast, Enkindle Bahamut's Akh Morn 650 every 10s); the next press is
// Firebird Trance with Demi-Phoenix (20s: Fountain of Fire 250 into Brand of Purgatory 350, Scarlet Flame 150 a spell,
// Revelation 650). The egi steps away while a demi is out. Devotion (+5%, 180s) and Enkindle (Inferno, 120s).
//  - 5.0–5.08: Egi Assaults are oGCDs and weak (100); Tri-disaster gives Ruination (+20 to Ruins) instead of a hit;
//    trances on 60s; Ruin IV 260, the DoTs 40; Bahamut takes a moment to act. Eden's Gate gear.
//  - 5.1–5.58: Egi Assaults are instant GCDs (250 each); Tri-disaster hits for 150; trances on 55s; Ruin IV 300, the
//    DoTs 45; Inferno 300. Eden's Promise gear with the relic.
// Pets hit with about 82% of what you would (80% in 5.0, Akh Morning's pet formula). Numbers are the game data at
// 5.08, 5.1, 5.2, 5.3 and 5.58 (xivapi's datamining) and the Lodestone notes; the opener is Akh Morning's. ref: a
// scripted bot parses about 19,600 / 11,700 on these.
(function (B) {
  const EPS = 1e-6;
  const spell = (o) => Object.assign({ kind: 'gcd', target: true, range: 25, delay: 0.8, school: 'none', sound: 'ruin' }, o);
  const ab = (o) => Object.assign({ kind: 'ogcd' }, o);
  const pet = (o) => Object.assign({ kind: 'pet', pet: true, delay: 0.7 }, o);
  const VERSIONS = {
    shb51: { label: 'Shadowbringers 5.1–5.58', history: 'ShB 5.1–5.58', ruin4: 300, dot: 45, tri: 150, ruination: false, assault: 250, assaultGcd: true, trance: 55,
      inferno: 300, petK: 0.82, delayBahamut: false, tincture: 'int4', ref: 20790,
      stats: { hp: 128380, main: 5560, wd: 180, det: 2041, crit: 4077, dh: 3044, speed: 609 },
      gear: 'The Balance\'s 5.5 set with the relic (Eden\'s Promise: Intelligence 5,560, 180 magic damage)',
      note: 'Level 80: Egi Assaults on the GCD, Tri-disaster with a hit, 55s trances, Ruin IV 300; Dreadwyrm Trance, Bahamut and Phoenix in turn; Eden\'s Promise gear' },
    shb50: { label: 'Shadowbringers 5.0–5.08', history: 'ShB 5.0–5.08', ruin4: 260, dot: 40, tri: 0, ruination: true, assault: 100, assaultGcd: false, trance: 60,
      inferno: 200, petK: 0.80, delayBahamut: true, tincture: 'int2', ref: 12370,
      stats: { hp: 89218, main: 4193, wd: 164, det: 2158, crit: 3372, dh: 2877, speed: 380 },
      gear: 'an Eden\'s Gate set (Intelligence 4,193, 164 magic damage) with the Grade 2 Tincture',
      note: 'Level 80 at launch: Egi Assaults as oGCDs, Ruination from Tri-disaster, 60s trances, Ruin IV 260; Eden\'s Gate gear' },
  };

  function buildActions(V) {
    const assault = (name, n, petId) => (V.assaultGcd ? spell : ab)(Object.assign(V.assaultGcd ? { cd: 30 } : { recast: 30 }, { name, charges: 2, potency: 0, target: true, range: 25, petAction: petId, egiOnly: true,
      cdGroup: 'assault' + n, mp: 0, desc: `Orders Ifrit-Egi to use ${n === 1 ? 'Crimson Cyclone' : 'Flaming Crush'} (${V.assault}).\nAdditional Effect: Grants a stack of Further Ruin (up to 4)\nMaximum Charges: 2${V.assaultGcd ? '\nAn instant spell on the GCD.' : ''}` }));
    return {
      ruin3: spell({ name: 'Ruin III', potency: 200, cast: 2.5, mp: 200, ruin: true, orb: true, desc: 'Deals unaspected damage with a potency of 200.\nDreadwyrm Trance Bonus: Removes cast time.\n※Action changes to Fountain of Fire under Firebird Trance.' }),
      ruin2: spell({ name: 'Ruin II', potency: 160, mp: 400, ruin: true, orb: true, desc: 'Deals unaspected damage with a potency of 160.' }),
      ruin4: spell({ name: 'Ruin IV', potency: V.ruin4, mp: 200, ruin: true, orb: true, sound: 'xeno', desc: `Deals unaspected damage with a potency of ${V.ruin4}.\nCan only be executed while under the effect of Further Ruin.` }),
      bio3: spell({ name: 'Bio III', potency: 0, mp: 600, school: 'aether', dot: { potency: V.dot, duration: 30 }, sound: 'dot', desc: `Deals unaspected damage over time.\nPotency: ${V.dot}\nDuration: 30s` }),
      miasma3: spell({ name: 'Miasma III', potency: V.dot, cast: 2.5, mp: 500, school: 'aether', dot: { potency: V.dot, duration: 30 }, desc: `Deals unaspected damage with a potency of ${V.dot}.\nAdditional Effect: Unaspected damage over time\nPotency: ${V.dot}\nDuration: 30s` }),
      fountainOfFire: spell({ name: 'Fountain of Fire', potency: 250, mp: 400, phoenix: true, fx: 'slashFire', desc: 'Deals fire damage with a potency of 250.\nAdditional Effect: Hellish Conduit (Brand of Purgatory)\nDuration: 10s\nCan only be executed while in Firebird Trance.' }),
      brandOfPurgatory: spell({ name: 'Brand of Purgatory', potency: 350, mp: 400, aoe: true, phoenix: true, fx: 'slashFire', desc: 'Deals fire damage with a potency of 350 to target and all enemies nearby it.\nCan only be executed while in Firebird Trance under Hellish Conduit.' }),
      egiAssault: assault('Egi Assault', 1, 'crimsonCyclone'),
      egiAssault2: assault('Egi Assault II', 2, 'flamingCrush'),
      triDisaster: ab({ name: 'Tri-disaster', recast: 50, potency: V.tri, target: true, range: 25, delay: 0.7, desc: `${V.tri ? `Deals unaspected damage with a potency of ${V.tri}.\nAdditional Effect: ` : ''}Inflicts target with Bio III and Miasma III.${V.ruination ? '\nAdditional Effect: Ruination (Ruins +20 potency on the target)\nDuration: 30s' : ''}\nDreadwyrm Trance and Firebird Trance reset its recast.` }),
      energyDrain: ab({ name: 'Energy Drain', recast: 30, potency: 100, target: true, range: 25, delay: 0.6, iconOf: 'energyDrain2', desc: 'Deals unaspected damage with a potency of 100.\nAdditional Effect: Aetherflow II' }),
      fester: ab({ name: 'Fester', recast: 5, potency: 100, target: true, range: 25, delay: 0.6, flow: true, desc: 'Deals unaspected damage with a potency of 100: 200 with one of your Bio III or Miasma III on the target, 300 with both.\nAetherflow Gauge Cost: 1' }),
      dreadwyrmTrance: ab({ name: 'Dreadwyrm Trance', recast: V.trance, cdGroup: 'trance', desc: `Enters Dreadwyrm Trance: Ruin III is instant and Deathflare can be used.\nDuration: 15s\nAdditional Effect: Resets Tri-disaster\nWhen it ends: two Dreadwyrm Aether (Summon Bahamut)\n※Action changes to Firebird Trance after Demi-Bahamut.\nShares a ${V.trance}s recast with Firebird Trance.` }),
      firebirdTrance: ab({ name: 'Firebird Trance', recast: V.trance, cdGroup: 'trance', desc: 'Summons Demi-Phoenix and enters Firebird Trance: Ruin III becomes Fountain of Fire.\nDuration: 20s\nAdditional Effect: Resets Tri-disaster' }),
      deathflare: ab({ name: 'Deathflare', recast: 1, potency: 400, target: true, range: 25, aoe: true, delay: 0.8, fx: 'gnbZone', desc: 'Deals unaspected damage with a potency of 400 to target and all enemies nearby it.\nCan only be executed while in Dreadwyrm Trance; ends it.' }),
      summonBahamut: ab({ name: 'Summon Bahamut', recast: 1, desc: 'Summons Demi-Bahamut to fight by your side for 20s: Wyrmwave (150) for every spell you cast on the enemy.\nCan only be executed with two Dreadwyrm Aether.' }),
      enkindleBahamut: ab({ name: 'Enkindle Bahamut', recast: 10, cdGroup: 'enkindleDemi', target: true, range: 25, petAction: 'akhMorn', desc: 'Commands Demi-Bahamut to use Akh Morn (650).\n※Action changes to Enkindle Phoenix while Demi-Phoenix is out.' }),
      enkindlePhoenix: ab({ name: 'Enkindle Phoenix', recast: 10, cdGroup: 'enkindleDemi', target: true, range: 25, petAction: 'revelation', desc: 'Commands Demi-Phoenix to use Revelation (650).' }),
      enkindle: ab({ name: 'Enkindle', recast: 120, target: true, range: 25, petAction: 'inferno', egiOnly: true, desc: `Commands Ifrit-Egi to use Inferno: ${V.inferno} to target and all enemies nearby it, plus 20 a tick for 15s.` }),
      aetherpact: ab({ name: 'Aetherpact', recast: 180, desc: 'Orders your pet to use Devotion: increases damage dealt by 5% for you and nearby party members.\nDuration: 15s' }),
      swiftcast: ab({ name: 'Swiftcast', recast: 60, role: true, desc: 'Next spell is cast immediately.\nDuration: 10s' }),
      lucidDreaming: ab({ name: 'Lucid Dreaming', recast: 60, role: true, desc: 'Gradually restores MP.\nPotency: 50\nDuration: 21s' }),
      surecast: ab({ name: 'Surecast', recast: 120, role: true, desc: 'Spells can be cast without interruption.\nAdditional Effect: Nullifies most knockback and draw-in effects\nDuration: 6s' }),
      addle: ab({ name: 'Addle', recast: 90, role: true, target: true, range: 25, desc: 'Lowers target\'s intelligence and mind by 10%.\nDuration: 10s' }),
      ...B.GENERAL_ACTIONS,
      tincture: B.tincture(V.tincture),
      crimsonCyclone: pet({ name: 'Crimson Cyclone', potency: V.assault }),
      flamingCrush: pet({ name: 'Flaming Crush', potency: V.assault }),
      burningStrike: pet({ name: 'Burning Strike', potency: 80, delay: 0.5 }),
      inferno: pet({ name: 'Inferno', potency: V.inferno, aoe: true, dot: { potency: 20, duration: 15 } }),
      wyrmwave: pet({ name: 'Wyrmwave', potency: 150, demiHit: true }),
      akhMorn: pet({ name: 'Akh Morn', potency: 650, aoe: true, delay: 1.0, demiHit: true }),
      scarletFlame: pet({ name: 'Scarlet Flame', potency: 150, demiHit: true }),
      revelation: pet({ name: 'Revelation', potency: 650, aoe: true, delay: 1.0, demiHit: true }),
    };
  }

  const STATUSES = {
    dreadwyrmTrance: { name: 'Dreadwyrm Trance', self: true, icon: 'st_dreadwyrmTrance' },
    firebirdTrance: { name: 'Firebird Trance', self: true, icon: 'st_firebirdTrance' },
    furtherRuin: { name: 'Further Ruin', self: true, icon: 'st_furtherRuin' },
    hellishConduit: { name: 'Hellish Conduit', self: true, icon: 'st_hellishConduit' },
    devotion: { name: 'Devotion', self: true, icon: 'st_devotion' },
    bio3: { name: 'Bio III', self: false, icon: 'st_bio3' },
    miasma3: { name: 'Miasma III', self: false, icon: 'st_miasma3' },
    ruination: { name: 'Ruination', self: false, icon: 'st_ruination' },
    inferno: { name: 'Inferno', self: false, icon: 'st_inferno' },
    ...B.COMMON_STATUSES,
  };

  class SummonerShB {
    constructor(version) {
      const V = VERSIONS[version];
      this.V = V;
      this.name = 'Summoner';
      this.abbr = 'SMN';
      this.role = 'caster';
      this.level = 80;
      this.levelKey = 'shb80';
      this.model = 'smn-sb';
      this.maxMp = 10000;
      this.actions = buildActions(V);
      this.statuses = STATUSES;
      this.stats = Object.assign({ mainStat: 'int', jobMod: 115, trait: 130, delay: 3.12 }, V.stats);
      this.speedName = 'Spell speed';
      this.tierHaste = 0;
      this.selfStatusOrder = ['dreadwyrmTrance', 'firebirdTrance', 'furtherRuin', 'hellishConduit', 'devotion', 'swiftcast', 'medicated', 'lucidDreaming', 'surecast', 'sprint'];
      this.targetStatusOrder = ['bio3', 'miasma3', 'ruination', 'inferno', 'addle'];
      this.defaultBars = [
        ['ruin3', 'ruin4', 'bio3', 'miasma3', 'triDisaster', 'egiAssault', 'egiAssault2', 'dreadwyrmTrance', 'deathflare', 'summonBahamut', 'enkindleBahamut', 'energyDrain'],
        ['fester', 'enkindle', 'aetherpact', 'swiftcast', 'lucidDreaming', 'tincture', 'ruin2', 'brandOfPurgatory', 'addle', 'surecast', 'sprint', null],
        [null, null, null, null, null, null, null, null, null, null, null, null],
      ];
      this.actionGroups = [
        ['Summoner', ['ruin3', 'ruin2', 'ruin4', 'bio3', 'miasma3', 'triDisaster', 'fountainOfFire', 'brandOfPurgatory', 'egiAssault', 'egiAssault2', 'energyDrain',
          'fester', 'dreadwyrmTrance', 'firebirdTrance', 'deathflare', 'summonBahamut', 'enkindleBahamut', 'enkindlePhoenix', 'enkindle', 'aetherpact']],
        ['Role Actions', ['swiftcast', 'lucidDreaming', 'surecast', 'addle']],
        ['General', ['sprint', 'tincture']],
      ];
      this.referenceDps = V.ref;
      this.referenceGcd = 2.48;
      this.startDistance = 12;
    }

    initGauge(e) {
      if (e) e.pet = { kind: 'ifrit' };
      return { flow: 0, ruin: 0, next: 'dwt', trance: null, tranceUntil: 0, aether: 0, demi: null, demiUntil: 0, petNext: 0 };
    }

    trance(e) { return e.g.trance && e.g.tranceUntil > e.now + EPS ? e.g.trance : null; }
    demiOut(e) { return e.g.demi && e.g.demiUntil > e.now + EPS ? e.g.demi : null; }

    resolveId(id, e) {
      const t = this.trance(e);
      if (id === 'ruin3' && t === 'fbt') return e.has('hellishConduit') ? 'brandOfPurgatory' : 'fountainOfFire';
      if ((id === 'dreadwyrmTrance' || id === 'firebirdTrance')) return e.g.next === 'fbt' ? 'firebirdTrance' : 'dreadwyrmTrance';
      if (id === 'enkindleBahamut' || id === 'enkindlePhoenix') return this.demiOut(e) === 'phoenix' ? 'enkindlePhoenix' : 'enkindleBahamut';
      return id;
    }

    check(id, e) {
      const a = this.actions[id], g = e.g;
      if (id === 'ruin4' && g.ruin < 1) return 'Unable to execute action. Further Ruin required.';
      if (a.phoenix && this.trance(e) !== 'fbt') return 'Unable to execute action. Firebird Trance required.';
      if (id === 'brandOfPurgatory' && !e.has('hellishConduit')) return 'Unable to execute action. Hellish Conduit required.';
      if (a.egiOnly && this.demiOut(e)) return 'Unable to execute action while a demi-summon is out.';
      if (a.flow && g.flow < 1) return 'Unable to execute action. Aetherflow required.';
      if (id === 'deathflare' && this.trance(e) !== 'dwt') return 'Unable to execute action. Dreadwyrm Trance required.';
      if (id === 'summonBahamut' && (g.aether < 2 || this.demiOut(e))) return 'Unable to execute action. Two Dreadwyrm Aether required.';
      if (id === 'enkindleBahamut' && this.demiOut(e) !== 'bahamut') return 'Unable to execute action. Demi-Bahamut required.';
      if (id === 'enkindlePhoenix' && this.demiOut(e) !== 'phoenix') return 'Unable to execute action. Demi-Phoenix required.';
      if (id === 'dreadwyrmTrance' && (this.trance(e) || this.demiOut(e) || g.aether)) return 'Unable to execute action.';
      if (id === 'firebirdTrance' && (this.trance(e) || this.demiOut(e))) return 'Unable to execute action.';
      return null;
    }

    castTime(id, e) {
      const a = this.actions[id];
      if (!a.cast) return 0;
      if (e.has('swiftcast')) return 0;
      if (this.trance(e)) return 0;     // both trances take 2.5s off casts
      return e.speedScale(a.cast);
    }
    consumeInstant(id, e) { if (this.actions[id].cast && !this.trance(e) && e.has('swiftcast')) e.removeStatus('swiftcast'); }
    mpCost(id) { return this.actions[id].mp || 0; }
    mpRegen() { return 200; }
    lucidGain() { return 500; }

    snapshot(a, e) {
      const mult = e.has('devotion') ? 1.05 : 1;
      const main = this.stats.main + (e.has('medicated') ? B.TINCTURES[this.V.tincture].cap : 0);
      return { mult, main };
    }

    petAct(e, id) {
      const a = this.actions[id];
      e.emit('petUse', { id });
      const snap = this.snapshot(a, e);
      const after = a.dot ? () => e.addTStatus(id, a.dot.duration, { snap, dot: { potency: a.dot.potency * this.V.petK, id } }) : null;
      e.queueHit(id, a.potency * this.V.petK, snap, a.delay, after, a.demiHit ? { expires: e.g.demiUntil } : null);
    }

    applyDot(e, key, snap) {
      const a = this.actions[key];
      e.addTStatus(key, a.dot.duration, { snap: snap || this.snapshot(a, e), dot: { potency: a.dot.potency, id: key } });
    }

    endTrance(e) {
      const g = e.g;
      if (g.trance === 'dwt') g.aether = 2;
      e.removeStatus(g.trance === 'dwt' ? 'dreadwyrmTrance' : 'firebirdTrance', true);
      g.trance = null; g.tranceUntil = 0;
    }
    resetTri(e) { const c = e.cds.triDisaster; if (c) { c.charges = c.max; c.nextAt = null; } }

    resolve(id, e) {
      const a = this.actions[id], g = e.g;
      if (a.kind === 'gcd') {
        e.mp -= a.mp || 0;
        // The demi strikes once for every spell you cast on the enemy.
        const d = this.demiOut(e);
        if (d && a.target) this.petAct(e, d === 'bahamut' ? 'wyrmwave' : 'scarletFlame');
      }
      if (a.petAction) {
        this.petAct(e, a.petAction);
        if (id === 'egiAssault' || id === 'egiAssault2') { g.ruin = Math.min(4, g.ruin + 1); this.ruinStatus(e); }
        return;
      }
      if (a.flow) g.flow--;
      switch (id) {
        case 'ruin4': g.ruin--; this.ruinStatus(e); break;
        case 'fountainOfFire': e.addStatus('hellishConduit', 10); break;
        case 'brandOfPurgatory': e.removeStatus('hellishConduit'); break;
        case 'energyDrain': g.flow = 2; break;
        case 'fester': {
          const n = (e.tHas('bio3') ? 1 : 0) + (e.tHas('miasma3') ? 1 : 0);
          e.queueHit(id, [100, 200, 300][n], this.snapshot(a, e), a.delay);
          return;
        }
        case 'triDisaster': {
          const snap = this.snapshot(a, e);
          this.applyDot(e, 'bio3', snap); this.applyDot(e, 'miasma3', snap);
          if (this.V.ruination) e.addTStatus('ruination', 30);
          break;
        }
        case 'dreadwyrmTrance':
          g.trance = 'dwt'; g.tranceUntil = e.now + 15; g.next = 'fbt';
          e.addStatus('dreadwyrmTrance', 15); this.resetTri(e);
          return;
        case 'firebirdTrance':
          g.trance = 'fbt'; g.tranceUntil = e.now + 20; g.next = 'dwt';
          e.addStatus('firebirdTrance', 20); this.resetTri(e);
          g.demi = 'phoenix'; g.demiUntil = e.now + 20; e.pet = { kind: 'bahamut' };
          return;
        case 'deathflare': this.endTrance(e); break;
        case 'summonBahamut':
          g.aether = 0; g.demi = 'bahamut'; g.demiUntil = e.now + 20; e.pet = { kind: 'bahamut' };
          if (!this.V.delayBahamut) this.petAct(e, 'wyrmwave');
          return;
        case 'aetherpact': e.addStatus('devotion', 15); return;
        default:
          if (B.ROLE_EFFECTS[id]) { B.ROLE_EFFECTS[id](e); return; }
      }
      if (a.dot && !a.potency) { this.applyDot(e, id); return; }
      if (!a.potency) return;
      let potency = a.potency;
      if (a.ruin && e.tHas('ruination')) potency += 20;
      const snap = this.snapshot(a, e);
      const after = a.dot ? () => this.applyDot(e, id, snap) : null;
      e.queueHit(id, potency, snap, a.delay, after);
    }

    ruinStatus(e) {
      const g = e.g;
      if (g.ruin > 0) e.addStatus('furtherRuin', 1e9, { permanent: true, stacks: g.ruin }); else e.removeStatus('furtherRuin', true);
    }

    // The trance and the demi run out; Ifrit-Egi's Burning Strike every 3s while no demi is out.
    nextEvent(e) {
      const g = e.g;
      let t = Infinity;
      if (g.trance) t = Math.min(t, g.tranceUntil);
      if (g.demi) t = Math.min(t, g.demiUntil);
      if (e.inCombat && !this.demiOut(e)) t = Math.min(t, Math.max(e.now, g.petNext));
      return t;
    }
    process(e) {
      const g = e.g;
      if (g.trance && e.now >= g.tranceUntil - EPS) this.endTrance(e);
      if (g.demi && e.now >= g.demiUntil - EPS) { g.demi = null; g.demiUntil = 0; e.pet = { kind: 'ifrit' }; g.petNext = e.now + 1; }
      if (e.inCombat && !this.demiOut(e) && e.now >= g.petNext - EPS) { g.petNext = e.now + 3; this.petAct(e, 'burningStrike'); }
    }

    proc(id, e) {
      const g = e.g;
      if (id === 'ruin4') return g.ruin > 0;
      if (id === 'deathflare') return this.trance(e) === 'dwt';
      if (id === 'summonBahamut') return g.aether >= 2 && !this.demiOut(e);
      if (id === 'enkindleBahamut' || id === 'enkindlePhoenix') return !!this.demiOut(e);
      if (id === 'fester') return g.flow > 0;
      if (id === 'ruin3') return this.trance(e) === 'fbt';
      return false;
    }

    speedInfo(e) { return `GCD ${e.gcdForSpeed(e.stats.speed).toFixed(2)} · Ruin III ${e.speedScale(2.5).toFixed(2)}s cast, instant in a trance · ${e.maxMp.toLocaleString()} MP`; }

    gaugeBuild(root) {
      root.innerHTML = `
<svg width="360" height="130" viewBox="0 0 360 130">
  <rect x="8" y="10" width="344" height="110" rx="14" fill="rgba(14,12,20,.86)" stroke="rgba(255,255,255,.22)"/>
  <text id="ss-l" x="24" y="36" font-family="Noto Sans, sans-serif" font-size="11" font-weight="600" fill="#a9a3b4" letter-spacing="1">TRANCE</text>
  <text id="ss-t" x="336" y="38" text-anchor="end" font-family="Saira Semi Condensed, sans-serif" font-size="20" font-weight="700" fill="#fff" stroke="#000" stroke-width="3" paint-order="stroke"></text>
  <rect x="24" y="46" width="312" height="12" rx="6" fill="#1d1a2a" stroke="rgba(255,255,255,.2)"/>
  <rect id="ss-b" x="24" y="46" width="0" height="12" rx="6" fill="#b48aff"/>
  <text x="24" y="90" font-family="Noto Sans, sans-serif" font-size="11" font-weight="600" fill="#a9a3b4" letter-spacing="1">AETHERFLOW</text>
  ${[0, 1].map(k => `<circle id="ss-f${k}" cx="${126 + k * 22}" cy="86" r="7" fill="#2a2535" stroke="rgba(255,255,255,.3)"/>`).join('')}
  <text x="190" y="90" font-family="Noto Sans, sans-serif" font-size="11" font-weight="600" fill="#a9a3b4" letter-spacing="1">FURTHER RUIN</text>
  ${[0, 1, 2, 3].map(k => `<rect id="ss-r${k}" x="${290 + k * 13}" y="79" width="10" height="14" rx="2" fill="#2a2535" stroke="rgba(255,255,255,.3)"/>`).join('')}
</svg>`;
      const $ = (s) => root.querySelector(s);
      this.sg = { l: $('#ss-l'), t: $('#ss-t'), b: $('#ss-b'), f: [0, 1].map(k => $('#ss-f' + k)), r: [0, 1, 2, 3].map(k => $('#ss-r' + k)), cache: {} };
    }
    gaugeUpdate(e) {
      const G = this.sg, c = G.cache, g = e.g;
      const put = (k, v, fn) => { if (c[k] !== v) { c[k] = v; fn(v); } };
      const d = this.demiOut(e), t = this.trance(e);
      const label = d === 'bahamut' ? 'DEMI-BAHAMUT' : d === 'phoenix' ? 'FIREBIRD TRANCE · DEMI-PHOENIX' : t === 'dwt' ? 'DREADWYRM TRANCE' : g.aether ? 'DREADWYRM AETHER ×2' : `NEXT: ${g.next === 'fbt' ? 'FIREBIRD' : 'DREADWYRM'} TRANCE`;
      put('l', label, v => { G.l.textContent = v; });
      const left = d ? g.demiUntil - e.now : t ? g.tranceUntil - e.now : 0;
      put('t', Math.round(left * 10), () => { G.b.setAttribute('width', String(312 * Math.min(1, left / 20))); G.t.textContent = left > 0 ? left.toFixed(1) : ''; });
      for (let i = 0; i < 2; i++) put('f' + i, g.flow > i, v => G.f[i].setAttribute('fill', v ? '#d070ff' : '#2a2535'));
      for (let i = 0; i < 4; i++) put('r' + i, g.ruin > i, v => G.r[i].setAttribute('fill', v ? '#7fb8ff' : '#2a2535'));
    }

    helpHtml(seq) {
      const V = this.V;
      return `
<h3>How it plays (${V.label})</h3>
<p>Level 80 Summoner with Ifrit-Egi out. Keep <b>Bio III</b> and <b>Miasma III</b> (${V.dot} a tick) up with <b>Tri-disaster</b>${V.tri ? ` (${V.tri})` : ''}; <b>Energy Drain</b> (30s) gives two Aetherflow for <b>Fester</b> (300 with both DoTs). <b>Egi Assault</b> and <b>Egi Assault II</b> (${V.assault}, two charges each, ${V.assaultGcd ? 'instant GCDs' : 'oGCDs'}) each add a <b>Further Ruin</b> for <b>Ruin IV</b> (${V.ruin4}); save them for Bahamut.</p>
<p>The trance button (${V.trance}s) alternates: <b>Dreadwyrm Trance</b> (instant Ruin III for 15s, Deathflare 400, a Tri-disaster reset) leaves two Aether for <b>Summon Bahamut</b> (20s: Wyrmwave 150 with every spell you cast, Akh Morn 650 every 10s); then <b>Firebird Trance</b> brings <b>Demi-Phoenix</b> (Fountain of Fire 250 → Brand of Purgatory 350, Scarlet Flame 150 a spell, Revelation 650). Ifrit-Egi steps aside while a demi is out. <b>Devotion</b> (+5%) and <b>Enkindle</b> (Inferno ${V.inferno}) on cooldown.${V.ruination ? ' In 5.0 Tri-disaster also puts Ruination on the dummy: +20 to your Ruins for 30s.' : ''}</p>
<h3>The opener (Akh Morning)</h3>
${seq(['ruin3', 'egiAssault', ['energyDrain'], ['triDisaster'], 'egiAssault2', ['tincture'], 'egiAssault', ['aetherpact'], ['dreadwyrmTrance'], 'egiAssault2', ['lucidDreaming'], ['enkindle'], 'ruin3', ['fester'], ['triDisaster'], 'ruin3', ['deathflare'], ['summonBahamut'], 'ruin4', ['enkindleBahamut'], ['fester'], 'ruin4', 'ruin3', 'ruin3', 'ruin4', ['enkindleBahamut'], 'ruin3', 'ruin4', ['energyDrain'], ['swiftcast'], 'ruin3', ['fester']])}
<p>Ruin III hardcast at −2.5s.${V.assaultGcd ? '' : ' In 5.0–5.08 the Egi Assaults are weaves, not GCDs.'}</p>
<p style="color:#a9a3b4">${V.label} numbers: Ruin III 200, Ruin II 160, Ruin IV ${V.ruin4}, Bio III ${V.dot} × 30s, Miasma III ${V.dot} + ${V.dot} × 30s, Tri-disaster ${V.tri || 'no hit'}, Fester 100 / 200 / 300, Energy Drain 100, Deathflare 400, Wyrmwave and Scarlet Flame 150, Akh Morn and Revelation 650, Fountain of Fire 250, Brand of Purgatory 350, Crimson Cyclone and Flaming Crush ${V.assault}, Burning Strike 80, Inferno ${V.inferno} + 20 × 15s. Pets hit at about ${Math.round(V.petK * 100)}% of you. Gear: ${V.gear}.</p>`;
    }
  }

  B.registerJob({
    id: 'smn', name: 'Summoner', abbr: 'SMN', role: 'caster', classJob: 27,
    versions: ['shb51', 'shb50'].map(v => ({ id: v, label: VERSIONS[v].label, history: VERSIONS[v].history, note: VERSIONS[v].note, create: () => new SummonerShB(v) })),
  });
})(window.BLM);
