// Bard, Shadowbringers at level 80, in two versions. Built on the Stormblood class (brd_sb.js) for the three songs on
// 80s recasts (30s each) and their Repertoire, Iron Jaws, Sidewinder by DoT count and the Song Gauge, without TP:
// Burst Shot (35% Straight Shot Ready, 10s) into Refulgent Arrow, Caustic Bite and Stormbite on 30s, Iron Jaws (35%
// Straight Shot Ready). Each tick of either DoT has a 40% chance of the song's Repertoire (Empyreal Arrow always gives
// one): Bloodletter back in Mage's Ballad, a 4% speed stack in Army's Paeon (leaving it with stacks gives Army's Muse),
// a Pitch Perfect stack in the Minuet (100 / 250 / 450). Every Repertoire adds 5 Soul Voice for Apex Arrow. Raging
// Strikes +10% and Barrage on 80s with the Minuet; Battle Voice only helps the party. Shadowbite is an oGCD sharing
// Sidewinder's recast.
//  - 5.0–5.08: no song buffs; Burst Shot 230; Caustic Bite 50 and Stormbite 60 a tick; Apex Arrow 5 a gauge point
//    (500 at 100); Sidewinder 100 / 175 / 260. Eden's Gate gear.
//  - 5.1–5.58: the songs buff you too (Mage's Ballad +1% damage, Army's Paeon +3% direct hit, the Minuet +2% crit);
//    Apex Arrow 6 a point (600); DoTs 40 / 50; Burst Shot 250 (5.4) and Sidewinder 100 / 200 / 350 (5.3); Eden's Promise.
// Numbers are the game data at 5.08 and 5.58 (xivapi's datamining) and the Lodestone notes; gear is The Balance's 5.5
// set (pre-6.0 stats) and an Eden's Gate set built from the item data. Songs don't take Bard's +20% trait
// (xivanalysis). ref: a scripted bot parses about 19,700 / 13,200 on these.
(function (B) {
  const SB = B.BardSB;
  const EPS = 1e-6;
  const ws = (o) => Object.assign({ kind: 'gcd', target: true, range: 25, delay: 0.6, fx: 'gnbShot' }, o);
  const ab = (o) => Object.assign({ kind: 'ogcd' }, o);
  const set = (A, id, o) => B.setAction(A, id, Object.assign({}, o, { tp: undefined }));
  const VERSIONS = {
    shb51: { label: 'Shadowbringers 5.1–5.58', history: 'ShB 5.1–5.58', burst: 250, caustic: 40, storm: 50, apexPer: 6, side: [100, 200, 350], songBuffs: true,
      tincture: 'dex4', ref: 20870, stats: { hp: 140689, main: 5560, wd: 134, det: 1993, crit: 4001, dh: 2907, speed: 711 },
      gear: 'The Balance\'s 5.5 set without the relic (Edenmorn, Eden\'s Promise Savage: Dexterity 5,560, 134 weapon damage)',
      note: 'Level 80: songs that buff you (+1% damage, +3% direct hit, +2% crit), Apex Arrow up to 600, Burst Shot 250, Sidewinder 100 / 200 / 350; Eden\'s Promise gear' },
    shb50: { label: 'Shadowbringers 5.0–5.08', history: 'ShB 5.0–5.08', burst: 230, caustic: 50, storm: 60, apexPer: 5, side: [100, 175, 260], songBuffs: false,
      tincture: 'dex2', ref: 14000, stats: { hp: 97550, main: 4193, wd: 122, det: 2305, crit: 2827, dh: 2939, speed: 717 },
      gear: 'an Eden\'s Gate set built from the item data (Dexterity 4,193, 122 weapon damage) with the Grade 2 Tincture',
      note: 'Level 80 at launch: no song buffs, Apex Arrow up to 500, DoTs 50 / 60 a tick, Sidewinder 100 / 175 / 260; Eden\'s Gate gear' },
  };

  class BardShB extends SB {
    constructor(version) {
      super();
      const V = VERSIONS[version];
      this.V = V;
      this.level = 80;
      this.levelKey = 'shb80';
      this.tp = null;
      this.maxMp = 10000;
      this.tinctureKey = V.tincture;
      const A = {};
      for (const [k, a] of Object.entries(this.actions)) A[k] = Object.assign({}, a, { tp: undefined });
      for (const k of ['heavyShot', 'straightShot', 'foeRequiem', 'invigorate']) delete A[k];
      A.burstShot = ws({ name: 'Burst Shot', potency: V.burst, desc: `Delivers an attack with a potency of ${V.burst}.\nAdditional Effect: 35% chance of Straight Shot Ready\nDuration: 10s` });
      set(A, 'refulgentArrow', { potency: 340, desc: 'Delivers an attack with a potency of 340.\nCan only be executed while under the effect of Straight Shot Ready.' });
      set(A, 'causticBite', { potency: 150, dot: { potency: V.caustic, duration: 30 }, desc: `Deals damage with a potency of 150.\nAdditional Effect: Poison\nPotency: ${V.caustic}\nDuration: 30s` });
      set(A, 'stormbite', { potency: 100, dot: { potency: V.storm, duration: 30 }, desc: `Deals wind damage with a potency of 100.\nAdditional Effect: Wind damage over time\nPotency: ${V.storm}\nDuration: 30s` });
      set(A, 'ironJaws', { desc: 'Deals damage with a potency of 100.\nAdditional Effect: If the target is suffering from a Caustic Bite or Stormbite effect inflicted by you, the effect timer is reset\nAdditional Effect: 35% chance of Straight Shot Ready' });
      A.apexArrow = ws({ name: 'Apex Arrow', potency: 0, range: 25, aoe: true, fx: 'gnbBurst', desc: `Delivers an attack to all enemies in a straight line before you with a potency of ${V.apexPer * 20} at 20 Soul Voice, up to ${V.apexPer * 100} at 100.\nSoul Voice Gauge Cost: all (at least 20)` });
      set(A, 'quickNock', { potency: 150, desc: 'Delivers an attack with a potency of 150 to all enemies in a cone before you.' });
      set(A, 'bloodletter', { potency: 150, desc: 'Delivers an attack with a potency of 150.\nShares a recast timer with Rain of Death.' });
      set(A, 'rainOfDeath', { potency: 130 });
      set(A, 'sidewinder', { cdGroup: 'sidewinder', desc: `Delivers an attack with a potency of ${V.side[0]}.\nPotency increases to ${V.side[1]} with one of your Caustic Bite or Stormbite on the target, and ${V.side[2]} with both.\nShares a recast timer with Shadowbite.` });
      A.shadowbite = ab({ name: 'Shadowbite', recast: 60, cdGroup: 'sidewinder', potency: 100, target: true, range: 25, aoe: true, delay: 0.6, fx: 'gnbShot', desc: 'Delivers an attack with a potency of 100 to target and all enemies nearby it: 160 with one of your DoTs on it, 220 with both.\nShares a recast timer with Sidewinder.' });
      set(A, 'pitchPerfect', { desc: 'Delivers an attack with a potency of 100 with one Repertoire, 250 with two, and 450 with three.\nCan only be executed while playing the Wanderer\'s Minuet.' });
      set(A, 'barrage', { desc: 'Triples the next single-target weaponskill.\nAdditional Effect: Grants Straight Shot Ready\nDuration: 10s' });
      set(A, 'battleVoice', { desc: 'Increases direct hit rate of nearby party members by 20% (not yourself).\nDuration: 20s\nCan only be executed while singing a song.' });
      set(A, 'troubadour', { recast: V.songBuffs ? 120 : 180, desc: 'Reduces damage taken by self and nearby party members by 10%.\nDuration: 15s' });
      set(A, 'naturesMinne', { recast: 90 });
      for (const k of ['magesBallad', 'armysPaeon', 'wanderersMinuet']) set(A, k, { desc: `Deals damage with a potency of 100.\nAdditional Effect: Grants ${A[k].name}${V.songBuffs ? `, increasing ${{ magesBallad: 'damage dealt', armysPaeon: 'direct hit rate', wanderersMinuet: 'critical hit rate' }[k]} of self and nearby party members by ${{ magesBallad: 1, armysPaeon: 3, wanderersMinuet: 2 }[k]}%` : ''}\nDuration: 30s\nRepertoire Effect: ${{ magesBallad: 'Resets the recast of Bloodletter and Rain of Death', armysPaeon: 'Reduces weaponskill cast and recast time by 4% per stack (up to 4); leaving the song with stacks grants Army\'s Muse', wanderersMinuet: 'Grants a stack for Pitch Perfect (up to 3)' }[k]}` });
      A.legGraze = ab({ name: 'Leg Graze', recast: 30, role: true, target: true, range: 25, desc: 'Inflicts Heavy on target.\nDuration: 10s' });
      A.armsLength = ab({ name: 'Arm\'s Length', recast: 120, role: true, desc: 'Creates a barrier nullifying knockback and draw-in effects.\nDuration: 6s' });
      A.tincture = B.tincture(V.tincture);
      this.actions = A;
      this.statuses = Object.assign({}, this.statuses, {
        straightShotReady: { name: 'Straight Shot Ready', self: true, icon: 'st_straighter' },
        armysMuse: { name: 'Army\'s Muse', self: true, icon: 'st_song' },
        armysEthos: { name: 'Army\'s Ethos', self: true, icon: 'st_song' },
      });
      this.selfStatusOrder = ['wanderersMinuet', 'magesBallad', 'armysPaeon', 'straightShotReady', 'ragingStrikes', 'barrage', 'armysMuse', 'armysEthos',
        'criticalUp', 'medicated', 'troubadour', 'naturesMinne', 'peloton', 'sprint'];
      this.stats = Object.assign({ mainStat: 'dex', jobMod: 115, trait: 120, delay: 3.04 }, V.stats);
      this.autoAttack = { potency: 100, delay: 3.04, range: 25 };
      this.defaultBars = [
        ['burstShot', 'refulgentArrow', 'causticBite', 'stormbite', 'ironJaws', 'apexArrow', 'empyrealArrow', 'bloodletter', 'sidewinder', 'pitchPerfect', 'ragingStrikes', 'barrage'],
        ['wanderersMinuet', 'magesBallad', 'armysPaeon', 'battleVoice', 'tincture', 'troubadour', 'naturesMinne', 'wardensPaean', 'repellingShot', 'secondWind', 'headGraze', 'legGraze'],
        ['quickNock', 'rainOfDeath', 'shadowbite', 'peloton', 'armsLength', 'sprint', null, null, null, null, null, null],
      ];
      this.actionGroups = [
        ['Bard', ['burstShot', 'refulgentArrow', 'causticBite', 'stormbite', 'ironJaws', 'apexArrow', 'quickNock', 'empyrealArrow', 'bloodletter',
          'rainOfDeath', 'sidewinder', 'shadowbite', 'pitchPerfect', 'ragingStrikes', 'barrage', 'wanderersMinuet', 'magesBallad', 'armysPaeon',
          'battleVoice', 'troubadour', 'naturesMinne', 'wardensPaean', 'repellingShot']],
        ['Role Actions', ['secondWind', 'headGraze', 'legGraze', 'armsLength', 'peloton']],
        ['General', ['sprint', 'tincture']],
      ];
      this.referenceDps = V.ref;
      this.referenceGcd = 2.46;
    }

    initGauge(e) { return Object.assign(super.initGauge(e), { sv: 0 }); }

    check(id, e) {
      if (id === 'refulgentArrow' && !e.has('straightShotReady')) return 'Unable to execute action. Straight Shot Ready required.';
      if (id === 'apexArrow' && e.g.sv < 20) return 'Unable to execute action. Not enough Soul Voice.';
      if (id === 'pitchPerfect' && (this.songOn(e) !== 'wanderersMinuet' || e.g.rep < 1)) return 'Unable to execute action. Repertoire required.';
      if (id === 'battleVoice' && !this.songOn(e)) return 'Unable to execute action. A song is required.';
      if (id === 'peloton' && e.inCombat) return 'Unable to execute action while in combat.';
      return null;
    }

    // Army's Paeon: 4% a Repertoire stack; Army's Muse after it: 1 / 2 / 4 / 12%.
    haste(e) { return (this.songOn(e) === 'armysPaeon' ? 4 * e.g.rep : 0) + (e.has('armysMuse') ? e.statuses.armysMuse.pct || 0 : 0); }
    autoHaste(e) { return this.haste(e); }

    snapshot(a, e) {
      let mult = 1, critAdd = 0, dhAdd = 0;
      if (e.has('ragingStrikes')) mult *= 1.10;
      const s = this.songOn(e);
      if (this.V.songBuffs) {
        if (s === 'magesBallad') mult *= 1.01;
        if (s === 'armysPaeon') dhAdd += 0.03;
        if (s === 'wanderersMinuet') critAdd += 0.02;
      }
      // The songs' own hits skip Increased Action Damage II.
      if (a && a.song) mult /= 1.2;
      const main = this.stats.main + (e.has('medicated') ? B.TINCTURES[this.V.tincture].cap : 0);
      return { mult, main, critAdd, dhAdd };
    }

    repertoire(e) {
      super.repertoire(e);
      if (this.songOn(e)) { e.g.sv = Math.min(100, e.g.sv + 5); e.emit('soulVoice', {}); }
    }
    // 40% of the time a tick of either DoT lands.
    onDotTick(key, e) { if ((key === 'causticBite' || key === 'stormbite') && Math.random() < 0.4) this.repertoire(e); }

    weaponskill(id, e) {
      const a = this.actions[id], g = e.g;
      let potency = a.potency;
      if ((id === 'burstShot' || id === 'ironJaws') && Math.random() < 0.35) e.addStatus('straightShotReady', 10);
      if (id === 'refulgentArrow') e.removeStatus('straightShotReady');
      if (id === 'apexArrow') { potency = this.V.apexPer * g.sv; g.sv = 0; e.emit('soulVoice', {}); }
      const snap = this.snapshot(a, e);
      let after = a.dot ? () => this.applyDot(e, id, snap) : null;
      if (id === 'ironJaws') after = () => { for (const k of ['causticBite', 'stormbite']) if (e.tHas(k)) this.applyDot(e, k, snap); };
      const hits = e.has('barrage') && !a.aoe ? 3 : 1;
      if (hits > 1) e.removeStatus('barrage');
      for (let k = 0; k < hits; k++) e.queueHit(id, potency, snap, a.delay + k * 0.15, k === 0 ? after : null);
    }

    ability(id, e) {
      const a = this.actions[id], g = e.g;
      if (a.song) {
        // Leaving Army's Paeon early with stacks gives Army's Muse (Ethos if it ran out).
        const from = this.songOn(e);
        const stacks = from === 'armysPaeon' ? g.rep : 0;
        const ethos = e.has('armysEthos') ? e.statuses.armysEthos.stacks || 0 : 0;
        const n = stacks || ethos;
        if (n && id !== 'armysPaeon') e.addStatus('armysMuse', 10, { pct: [0, 1, 2, 4, 12][n] });
        e.removeStatus('armysEthos', true);
      }
      switch (id) {
        case 'sidewinder': case 'shadowbite': {
          const n = (e.tHas('causticBite') ? 1 : 0) + (e.tHas('stormbite') ? 1 : 0);
          e.queueHit(id, (id === 'sidewinder' ? this.V.side : [100, 160, 220])[n], this.snapshot(a, e), a.delay);
          return;
        }
        case 'pitchPerfect': e.queueHit(id, [0, 100, 250, 450][g.rep], this.snapshot(a, e), a.delay); g.rep = 0; return;
        case 'barrage': e.addStatus('barrage', 10); e.addStatus('straightShotReady', 10); return;
        case 'troubadour': e.addStatus('troubadour', 15); return;
      }
      super.ability(id, e);
      // The Stormblood class gives every song a Critical Up; only 5.1+ has the Minuet's.
      if (a.song) e.removeStatus('criticalUp', true);
    }

    // Army's Paeon running out with stacks leaves Army's Ethos for the next song.
    process(e) {
      const g = e.g;
      if (g.song === 'armysPaeon' && e.now >= g.songUntil - EPS && g.rep) e.addStatus('armysEthos', 30, { stacks: g.rep });
      super.process(e);
    }

    proc(id, e) {
      if (id === 'refulgentArrow') return e.has('straightShotReady');
      if (id === 'apexArrow') return e.g.sv >= 80;
      return super.proc(id, e);
    }

    mpRegen() { return B.BASE_REGEN; }

    gaugeBuild(root) {
      super.gaugeBuild(root);
      root.querySelector('svg').insertAdjacentHTML('beforeend', '<text id="bd-sv" x="336" y="100" text-anchor="end" font-family="Noto Sans, sans-serif" font-size="12" font-weight="700" fill="#9fd8ff">SOUL VOICE 0</text>');
      this.bg.sv = root.querySelector('#bd-sv');
    }
    gaugeUpdate(e) {
      super.gaugeUpdate(e);
      const G = this.bg;
      if (G.cache.sv !== e.g.sv) { G.cache.sv = e.g.sv; G.sv.textContent = `SOUL VOICE ${e.g.sv}`; }
    }

    helpHtml(seq) {
      const V = this.V;
      return `
<h3>How it plays (${V.label})</h3>
<p>Level 80 Bard. Keep <b>Caustic Bite</b> (${V.caustic} a tick) and <b>Stormbite</b> (${V.storm}) up and refresh both with <b>Iron Jaws</b>, which takes your buffs at that moment. Fill with <b>Burst Shot</b> (${V.burst}); it and Iron Jaws have a 35% chance of Straight Shot Ready (10s) for <b>Refulgent Arrow</b> (340).</p>
<p>Rotate the songs (30s each, 80s recasts): the <b>Wanderer's Minuet</b>, <b>Mage's Ballad</b>, <b>Army's Paeon</b> (cut short when the Minuet is back). Each DoT tick has a 40% chance of the song's Repertoire, and <b>Empyreal Arrow</b> (230, 15s) always gives one: Pitch Perfect stacks in the Minuet (spend three for 450), Bloodletter back in Mage's Ballad, 4% speed stacks in Army's Paeon (Army's Muse after it). Every Repertoire adds 5 <b>Soul Voice</b>: <b>Apex Arrow</b> at 100 is ${V.apexPer * 100}.${V.songBuffs ? ' The songs also buff you: +1% damage, +3% direct hit, +2% crit.' : ''} <b>Raging Strikes</b> (+10%) and <b>Barrage</b> go with the Minuet; Sidewinder (up to ${V.side[2]}) on its 60s.</p>
<h3>The opener (The Balance, 2.46)</h3>
${seq(['stormbite', ['bloodletter'], ['ragingStrikes'], 'causticBite', ['wanderersMinuet'], ['battleVoice'], 'burstShot', ['empyrealArrow'], 'burstShot', 'burstShot', ['barrage'], 'refulgentArrow', ['sidewinder'], 'burstShot', ['bloodletter'], 'burstShot', 'ironJaws', ['pitchPerfect'], 'burstShot'])}
<p>The tincture at −1.5s. Burst Shot here stands for "Refulgent Arrow if Straight Shot Ready came up".</p>
<p style="color:#a9a3b4">${V.label} numbers: Burst Shot ${V.burst}, Refulgent Arrow 340, Caustic Bite 150 + ${V.caustic} × 30s, Stormbite 100 + ${V.storm} × 30s, Iron Jaws 100, Apex Arrow ${V.apexPer} per Soul Voice, Empyreal Arrow 230, Bloodletter 150, Sidewinder ${V.side.join(' / ')}, Shadowbite 100 / 160 / 220, Pitch Perfect 100 / 250 / 450, songs 100; auto-attacks 100 at 3.04s. Gear: ${V.gear}.</p>`;
    }
  }

  B.registerJob({
    id: 'brd', name: 'Bard', abbr: 'BRD', role: 'ranged', classJob: 23,
    versions: ['shb51', 'shb50'].map(v => ({ id: v, label: VERSIONS[v].label, history: VERSIONS[v].history, note: VERSIONS[v].note, create: () => new BardShB(v) })),
  });
})(window.BLM);
