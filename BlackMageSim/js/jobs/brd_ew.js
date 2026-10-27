// Bard, Endwalker 6.0–6.58 at level 90. The three songs are abilities (100 potency, 45s each, 120s recasts) and only one
// plays at a time; while one does, every 3s of its timer has an 80% chance of a Repertoire proc (+5 Soul Voice): the
// Wanderer's Minuet stacks Pitch Perfect (100 / 220 / 360), Mage's Ballad takes 7.5s off Bloodletter (three charges),
// Army's Paeon stacks 4% haste (and leaves Army's Muse for the next song). Each song leaves a Coda for Radiant Finale
// (+2 / 4 / 6%). Burst Shot (220), Caustic Bite and Stormbite (DoTs that Iron Jaws refreshes) each have a 35% chance of
// Straight Shot Ready for Refulgent Arrow (280; three hits under Barrage). Soul Voice goes to Apex Arrow (up to 500) and,
// at 80+, Blast Arrow (600). Raging Strikes (+15%), Battle Voice (+20% direct hit), Empyreal Arrow (a sure Repertoire),
// Sidewinder. The 6.58 numbers: 6.28 and 6.5 raised Empyreal Arrow (200 → 240) and 6.5 Sidewinder (300 → 320), the only
// damage changes in 6.x; 6.1 dropped Battle Voice's need for a song. Game data at 6.58, the Lodestone notes and The
// Balance; gear is The Balance's 6.5 relic set.
(function (B) {
  const EPS = 1e-6;
  const SONG_TIME = 45;
  const SONGS = { wanderersMinuet: 'wm', magesBallad: 'mb', armysPaeon: 'ap' };
  const MUSE = [0, 1, 2, 4, 12];
  const ws = (o) => Object.assign({ kind: 'gcd', target: true, range: 25, delay: 0.6, fx: 'gnbShot' }, o);
  const ab = (o) => Object.assign({ kind: 'ogcd' }, o);
  const song = (name, buff) => ab({ name, recast: 120, potency: 100, target: true, range: 25, delay: 0.6, song: true, fx: 'gnbZone',
    desc: `Deals unaspected damage with a potency of 100.\nAdditional Effect: Grants ${name} to self and all party members within 50 yalms, ${buff}\nDuration: 45s\nAdditional Effect: 80% chance of a Repertoire proc every 3s while singing\nAdditional Effect: Grants its Coda` });

  const ACTIONS = {
    burstShot: ws({ name: 'Burst Shot', potency: 220, ssr: true, desc: 'Delivers an attack with a potency of 220.\nAdditional Effect: 35% chance of becoming Straight Shot Ready\nDuration: 30s' }),
    refulgentArrow: ws({ name: 'Refulgent Arrow', potency: 280, ready: 'straightShotReady', single: true, fx: 'gnbBurst', desc: 'Delivers an attack with a potency of 280.\nCan only be executed when Straight Shot Ready.' }),
    causticBite: ws({ name: 'Caustic Bite', potency: 150, ssr: true, dot: { potency: 20, duration: 45 }, desc: 'Delivers an attack with a potency of 150.\nAdditional Effect: Poison\nPotency: 20\nDuration: 45s\nAdditional Effect: 35% chance of becoming Straight Shot Ready\nDuration: 30s' }),
    stormbite: ws({ name: 'Stormbite', potency: 100, ssr: true, dot: { potency: 25, duration: 45 }, desc: 'Deals wind damage with a potency of 100.\nAdditional Effect: Wind damage over time\nPotency: 25\nDuration: 45s\nAdditional Effect: 35% chance of becoming Straight Shot Ready\nDuration: 30s' }),
    ironJaws: ws({ name: 'Iron Jaws', potency: 100, ssr: true, desc: 'Delivers an attack with a potency of 100.\nAdditional Effect: If the target is suffering from a Caustic Bite or Stormbite effect inflicted by you, the effect timer is reset\nAdditional Effect: 35% chance of becoming Straight Shot Ready\nDuration: 30s' }),
    apexArrow: ws({ name: 'Apex Arrow', potency: 100, aoe: true, soul: true, fx: 'gnbDouble', desc: 'Delivers an attack with a potency of 100 to all enemies in a straight line before you.\nSoul Voice Gauge Cost: 20\nPotency increases up to 500 as Soul Voice Gauge exceeds minimum cost.\nAdditional Effect: Grants Blast Arrow Ready upon consuming at least 80 Soul Voice\nDuration: 10s' }),
    blastArrow: ws({ name: 'Blast Arrow', potency: 600, aoe: 0.4, ready: 'blastArrowReady', fx: 'gnbZone', desc: 'Delivers an attack to all enemies in a straight line before you with a potency of 600 for the first enemy, and 60% less for all remaining enemies.\nCan only be executed while under the effect of Blast Arrow Ready.' }),
    ladonsbite: ws({ name: 'Ladonsbite', potency: 130, aoe: true, range: 12, shadow: true, desc: 'Delivers an attack with a potency of 130 to all enemies in a cone before you.\nAdditional Effect: 35% chance of becoming Shadowbite Ready\nDuration: 30s' }),
    shadowbite: ws({ name: 'Shadowbite', potency: 170, aoe: true, ready: 'shadowbiteReady', desc: 'Delivers an attack with a potency of 170 to target and all enemies nearby it.\nBarrage Potency: 270\nCan only be executed when Shadowbite Ready.' }),
    wanderersMinuet: song('the Wanderer\'s Minuet', 'increasing critical hit rate by 2%'),
    magesBallad: song('Mage\'s Ballad', 'increasing damage dealt by 1%'),
    armysPaeon: song('Army\'s Paeon', 'increasing direct hit rate by 3%'),
    pitchPerfect: ab({ name: 'Pitch Perfect', recast: 1, target: true, range: 25, delay: 0.6, fx: 'gnbBurst', desc: 'Delivers an attack to the target. Potency varies with number of Repertoire stacks.\n1 Repertoire Stack: 100\n2 Repertoire Stacks: 220\n3 Repertoire Stacks: 360\nCan only be executed when the Wanderer\'s Minuet is active.' }),
    bloodletter: ab({ name: 'Bloodletter', recast: 15, charges: 3, cdGroup: 'bloodletter', potency: 110, target: true, range: 25, delay: 0.5, fx: 'gnbShot', desc: 'Delivers an attack with a potency of 110.\nMaximum Charges: 3\nShares a recast timer with Rain of Death.' }),
    rainOfDeath: ab({ name: 'Rain of Death', recast: 15, charges: 3, cdGroup: 'bloodletter', potency: 100, target: true, range: 25, aoe: true, delay: 0.5, desc: 'Delivers an attack with a potency of 100 to target and all enemies nearby it.\nMaximum Charges: 3\nShares a recast timer with Bloodletter.' }),
    empyrealArrow: ab({ name: 'Empyreal Arrow', recast: 15, potency: 240, target: true, range: 25, delay: 0.6, fx: 'gnbBurst', desc: 'Delivers an attack with a potency of 240.\nAdditional Effect: Guarantees a Repertoire proc of the song you\'re singing' }),
    sidewinder: ab({ name: 'Sidewinder', recast: 60, potency: 320, target: true, range: 25, delay: 0.6, fx: 'gnbDouble', desc: 'Delivers an attack with a potency of 320.' }),
    ragingStrikes: ab({ name: 'Raging Strikes', recast: 120, desc: 'Increases damage dealt by 15%.\nDuration: 20s' }),
    battleVoice: ab({ name: 'Battle Voice', recast: 120, desc: 'Increases direct hit rate of self and all nearby party members by 20%.\nDuration: 15s' }),
    radiantFinale: ab({ name: 'Radiant Finale', recast: 110, desc: 'Increases damage dealt by self and nearby party members.\nDuration: 15s\nEffectiveness is determined by the number of different Coda active in the Song Gauge.\n1 Coda: 2%\n2 Coda: 4%\n3 Coda: 6%' }),
    barrage: ab({ name: 'Barrage', recast: 120, desc: 'Triples the number of strikes for a single-target weaponskill. Additional effects added only once.\nDuration: 10s\nAdditional Effect: Increases the potency of Shadowbite to 270\nAdditional Effect: Grants Straight Shot Ready\nDuration: 30s' }),
    troubadour: ab({ name: 'Troubadour', recast: 120, desc: 'Reduces damage taken by self and nearby party members by 10%.\nDuration: 15s' }),
    naturesMinne: ab({ name: 'Nature\'s Minne', recast: 120, desc: 'Increases HP recovery via healing actions by 15% for self and nearby party members.\nDuration: 15s' }),
    wardensPaean: ab({ name: 'the Warden\'s Paean', recast: 45, desc: 'Removes one select detrimental effect from self or target party member.' }),
    repellingShot: ab({ name: 'Repelling Shot', recast: 30, desc: 'Jump 10 yalms away from current target.' }),
    legGraze: ab({ name: 'Leg Graze', recast: 30, role: true, target: true, range: 25, desc: 'Afflicts target with Heavy +40%.\nDuration: 10s' }),
    secondWind: ab({ name: 'Second Wind', recast: 120, role: true, desc: 'Instantly restores own HP.\nCure Potency: 500' }),
    footGraze: ab({ name: 'Foot Graze', recast: 30, role: true, target: true, range: 25, desc: 'Binds target.\nDuration: 10s' }),
    peloton: ab({ name: 'Peloton', recast: 5, role: true, desc: 'Increases movement speed of self and nearby party members.\nDuration: 30s\nHas no effect in battle.' }),
    headGraze: ab({ name: 'Head Graze', recast: 30, role: true, target: true, range: 25, desc: 'Interrupts the use of a target\'s action.' }),
    armsLength: ab({ name: 'Arm\'s Length', recast: 120, role: true, desc: 'Creates a barrier nullifying most knockback and draw-in effects.\nDuration: 6s' }),
    ...B.GENERAL_ACTIONS,
    tincture: B.tincture('dex8'),
    auto: { name: 'Shot', kind: 'auto', fx: 'auto', desc: 'Auto-attack.' },
  };

  const STATUSES = {
    wanderersMinuet: { name: 'the Wanderer\'s Minuet', self: true, icon: 'st_wm' },
    magesBallad: { name: 'Mage\'s Ballad', self: true, icon: 'st_mb' },
    armysPaeon: { name: 'Army\'s Paeon', self: true, icon: 'st_ap' },
    armysMuse: { name: 'Army\'s Muse', self: true, icon: 'st_muse' },
    armysEthos: { name: 'Army\'s Ethos', self: true, icon: 'st_ethos' },
    ragingStrikes: { name: 'Raging Strikes', self: true, icon: 'st_rs' },
    battleVoice: { name: 'Battle Voice', self: true, icon: 'st_bv' },
    radiantFinale: { name: 'Radiant Finale', self: true, icon: 'st_rf' },
    barrage: { name: 'Barrage', self: true, icon: 'st_barrage' },
    straightShotReady: { name: 'Straight Shot Ready', self: true, icon: 'st_ssr' },
    blastArrowReady: { name: 'Blast Arrow Ready', self: true, icon: 'st_blast' },
    shadowbiteReady: { name: 'Shadowbite Ready', self: true, icon: 'st_shadowbite' },
    troubadour: { name: 'Troubadour', self: true, icon: 'st_troubadour' },
    naturesMinne: { name: 'Nature\'s Minne', self: true, icon: 'st_minne' },
    peloton: { name: 'Peloton', self: true, icon: 'st_peloton' },
    causticBite: { name: 'Caustic Bite', self: false, icon: 'st_caustic' },
    stormbite: { name: 'Stormbite', self: false, icon: 'st_storm' },
  };

  class BardEW {
    constructor() {
      this.name = 'Bard';
      this.abbr = 'BRD';
      this.role = 'ranged';
      this.level = 90;
      this.levelKey = 90;
      this.model = 'brd-ew';
      this.actions = ACTIONS;
      this.statuses = STATUSES;
      this.comboTime = 30;
      // Increased Action Damage II: +20%.
      this.stats = { hp: 80000, main: 3379, mainStat: 'dex', jobMod: 115, trait: 120, wd: 132, det: 1885, crit: 2598, dh: 1344, speed: 479, delay: 3.04 };
      this.speedName = 'Skill speed';
      this.tierHaste = 0;
      this.autoAttack = { potency: 80, delay: 3.04, range: 25 };
      this.selfStatusOrder = ['wanderersMinuet', 'magesBallad', 'armysPaeon', 'armysMuse', 'armysEthos', 'ragingStrikes', 'battleVoice', 'radiantFinale', 'barrage',
        'straightShotReady', 'blastArrowReady', 'shadowbiteReady', 'troubadour', 'naturesMinne', 'medicated', 'peloton', 'armsLength', 'sprint'];
      this.targetStatusOrder = ['causticBite', 'stormbite'];
      this.defaultBars = [
        ['burstShot', 'refulgentArrow', 'causticBite', 'stormbite', 'ironJaws', 'apexArrow', 'blastArrow', 'wanderersMinuet', 'magesBallad', 'armysPaeon', 'pitchPerfect', 'bloodletter'],
        ['empyrealArrow', 'sidewinder', 'ragingStrikes', 'battleVoice', 'radiantFinale', 'barrage', 'tincture', 'troubadour', 'naturesMinne', 'wardensPaean', 'repellingShot', 'headGraze'],
        ['ladonsbite', 'shadowbite', 'rainOfDeath', 'secondWind', 'legGraze', 'footGraze', 'peloton', 'armsLength', 'sprint', null, null, null],
      ];
      this.actionGroups = [
        ['Bard', ['burstShot', 'refulgentArrow', 'causticBite', 'stormbite', 'ironJaws', 'apexArrow', 'blastArrow', 'ladonsbite', 'shadowbite', 'wanderersMinuet',
          'magesBallad', 'armysPaeon', 'pitchPerfect', 'bloodletter', 'rainOfDeath', 'empyrealArrow', 'sidewinder', 'ragingStrikes', 'battleVoice', 'radiantFinale',
          'barrage', 'troubadour', 'naturesMinne', 'wardensPaean', 'repellingShot']],
        ['Role Actions', ['legGraze', 'secondWind', 'footGraze', 'peloton', 'headGraze', 'armsLength']],
        ['General', ['sprint', 'tincture']],
      ];
      this.referenceDps = 11170;     // a scripted 6.5 rotation on this gear parses about 10,540 on the dummy
      this.referenceGcd = 2.48;
      this.startDistance = 12;
    }

    initGauge() { return { song: null, songUntil: 0, nextRoll: 0, rep: 0, soul: 0, coda: { wm: false, mb: false, ap: false } }; }

    // Army's Paeon: 4% per Repertoire stack; Army's Muse after it.
    haste(e) {
      const g = e.g;
      if (g.song === 'armysPaeon' && e.has('armysPaeon')) return 4 * g.rep;
      if (e.has('armysMuse')) return MUSE[e.statuses.armysMuse.stacks || 0];
      return 0;
    }
    autoHaste(e) { return this.haste(e); }

    check(id, e) {
      const a = this.actions[id], g = e.g;
      if (a.ready && !e.has(a.ready)) return 'Unable to execute action.';
      if (id === 'pitchPerfect' && (g.song !== 'wanderersMinuet' || !e.has('wanderersMinuet') || g.rep < 1)) return 'Unable to execute action. Repertoire required.';
      if (id === 'apexArrow' && g.soul < 20) return 'Not enough Soul Voice.';
      if (id === 'radiantFinale' && !(g.coda.wm || g.coda.mb || g.coda.ap)) return 'Unable to execute action. Coda required.';
      if (id === 'peloton' && e.inCombat) return 'Unable to execute action while in combat.';
      return null;
    }

    snapshot(a, e) {
      let mult = 1, critAdd = 0, dhAdd = 0;
      const g = e.g;
      if (e.has('ragingStrikes')) mult *= 1.15;
      if (e.has('magesBallad')) mult *= 1.01;
      if (e.has('radiantFinale')) mult *= 1 + g.finale;
      if (e.has('wanderersMinuet')) critAdd += 0.02;
      if (e.has('armysPaeon')) dhAdd += 0.03;
      if (e.has('battleVoice')) dhAdd += 0.20;
      const main = this.stats.main + (e.has('medicated') ? B.TINCTURES.dex8.cap : 0);
      return { mult, main, critAdd, dhAdd };
    }

    soul(e, n) { e.g.soul = Math.max(0, Math.min(100, e.g.soul + n)); }

    // A Repertoire proc of the current song.
    repertoire(e) {
      const g = e.g;
      if (!g.song || !e.has(g.song)) return;
      this.soul(e, 5);
      if (g.song === 'wanderersMinuet') g.rep = Math.min(3, g.rep + 1);
      else if (g.song === 'armysPaeon') g.rep = Math.min(4, g.rep + 1);
      else { const c = e.cd('bloodletter'); if (c.nextAt !== null) c.nextAt -= 7.5; }
      e.emit('repertoire', {});
    }

    endSong(e) {
      const g = e.g;
      if (g.song === 'armysPaeon' && g.rep > 0) g.museStacks = g.rep;
      if (g.song) e.removeStatus(g.song, true);
      g.song = null; g.rep = 0;
    }

    applyDot(e, key, snap) {
      const a = this.actions[key];
      e.addTStatus(key, a.dot.duration, { snap, dot: { potency: a.dot.potency, id: key } });
    }

    resolve(id, e) {
      const a = this.actions[id], g = e.g;
      if (a.kind === 'gcd') {
        let potency = a.potency;
        if (a.ready) e.removeStatus(a.ready);
        if (id === 'apexArrow') {
          potency = 5 * g.soul;
          if (g.soul >= 80) e.addStatus('blastArrowReady', 10);
          g.soul = 0;
        }
        if (a.ssr && Math.random() < 0.35) e.addStatus('straightShotReady', 30);
        if (a.shadow && Math.random() < 0.35) e.addStatus('shadowbiteReady', 30);
        const snap = this.snapshot(a, e);
        let after = a.dot ? () => this.applyDot(e, id, snap) : null;
        if (id === 'ironJaws') {
          after = () => { for (const k of ['causticBite', 'stormbite']) if (e.tHas(k)) this.applyDot(e, k, snap); };
        }
        // Barrage: three hits for Refulgent Arrow (or Burst Shot), 270 for Shadowbite.
        if (e.has('barrage') && (id === 'refulgentArrow' || id === 'burstShot' || id === 'shadowbite')) {
          e.removeStatus('barrage');
          if (id === 'shadowbite') { e.queueHit(id, 270, snap, a.delay); return; }
          for (let k = 0; k < 3; k++) e.queueHit(id, potency, snap, a.delay + 0.2 * k, k === 0 ? after : null);
          return;
        }
        e.queueHit(id, potency, snap, a.delay, after);
        return;
      }
      let potency = a.potency || 0;
      if (a.song) {
        const key = SONGS[id];
        const muse = g.song === 'armysPaeon' ? g.rep : (e.has('armysEthos') ? e.statuses.armysEthos.stacks || 0 : 0);
        this.endSong(e);
        e.removeStatus('armysEthos', true);
        if (muse > 0) e.addStatus('armysMuse', 10, { stacks: muse });
        g.song = id; g.songUntil = e.now + SONG_TIME; g.nextRoll = e.now + 3; g.rep = 0;
        g.coda[key] = true;
        e.addStatus(id, SONG_TIME);
      }
      switch (id) {
        case 'pitchPerfect': potency = [0, 100, 220, 360][g.rep]; g.rep = 0; break;
        case 'empyrealArrow': this.repertoire(e); break;
        case 'ragingStrikes': e.addStatus('ragingStrikes', 20); break;
        case 'battleVoice': e.addStatus('battleVoice', 15); break;
        case 'radiantFinale': {
          const n = (g.coda.wm ? 1 : 0) + (g.coda.mb ? 1 : 0) + (g.coda.ap ? 1 : 0);
          g.finale = [0, 0.02, 0.04, 0.06][n];
          g.coda = { wm: false, mb: false, ap: false };
          e.addStatus('radiantFinale', 15);
          break;
        }
        case 'barrage': e.addStatus('barrage', 10); e.addStatus('straightShotReady', 30); break;
        case 'troubadour': e.addStatus('troubadour', 15); break;
        case 'naturesMinne': e.addStatus('naturesMinne', 15); break;
        case 'peloton': e.addStatus('peloton', 30); break;
        default:
          if (B.ROLE_EFFECTS[id]) B.ROLE_EFFECTS[id](e);
      }
      if (potency) e.queueHit(id, potency, this.snapshot(a, e), a.delay);
    }

    // The song timer: a Repertoire roll every 3s (at 42 … 3s left), and the song ending.
    nextEvent(e) {
      const g = e.g;
      if (!g.song) return Infinity;
      return Math.min(g.nextRoll, g.songUntil);
    }
    process(e) {
      const g = e.g;
      if (!g.song) return;
      while (g.song && g.nextRoll <= e.now + EPS && g.nextRoll < g.songUntil - 1) {
        if (Math.random() < 0.8) this.repertoire(e);
        g.nextRoll += 3;
      }
      if (g.song && e.now >= g.songUntil - EPS) {
        // Army's Paeon running out with stacks leaves Army's Ethos for the next song.
        const stacks = g.song === 'armysPaeon' ? g.rep : 0;
        this.endSong(e);
        if (stacks > 0) e.addStatus('armysEthos', 30, { stacks });
      }
    }

    proc(id, e) {
      const a = this.actions[id], g = e.g;
      if (a.ready) return e.has(a.ready);
      if (id === 'pitchPerfect') return g.song === 'wanderersMinuet' && g.rep >= 3;
      if (id === 'apexArrow') return g.soul >= 80;
      return false;
    }

    mpRegen() { return B.BASE_REGEN; }
    speedInfo(e) { return `GCD ${e.gcdForSpeed(e.stats.speed).toFixed(2)} · ${e.gcdForSpeed(e.stats.speed, 16).toFixed(2)} with four Army's Paeon stacks`; }

    // ---------- the Song Gauge ----------
    gaugeBuild(root) {
      root.innerHTML = `
<svg width="360" height="150" viewBox="0 0 360 150">
  <defs><linearGradient id="bw-s" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#2a6a3a"/><stop offset="1" stop-color="#bfffa0"/></linearGradient></defs>
  <rect x="8" y="10" width="344" height="130" rx="14" fill="rgba(14,12,20,.86)" stroke="rgba(255,255,255,.22)"/>
  <text id="bw-n" x="24" y="34" font-family="Noto Sans, sans-serif" font-size="11" font-weight="600" fill="#a9a3b4" letter-spacing="1">SONG</text>
  <text id="bw-t" x="336" y="36" text-anchor="end" font-family="Saira Semi Condensed, sans-serif" font-size="18" font-weight="700" fill="#fff" stroke="#000" stroke-width="3" paint-order="stroke"></text>
  ${[0, 1, 2, 3].map(k => `<circle id="bw-r${k}" cx="${40 + k * 30}" cy="58" r="9" fill="#2a2535" stroke="rgba(0,0,0,.8)"/>`).join('')}
  <text x="190" y="62" font-family="Noto Sans, sans-serif" font-size="11" font-weight="600" fill="#a9a3b4" letter-spacing="1">CODA</text>
  ${['wm', 'mb', 'ap'].map((k, i) => `<rect id="bw-c${k}" x="${236 + i * 34}" y="48" width="26" height="18" rx="4" fill="#2a2535" stroke="rgba(0,0,0,.8)"/>`).join('')}
  <text x="24" y="96" font-family="Noto Sans, sans-serif" font-size="11" font-weight="600" fill="#a9a3b4" letter-spacing="1">SOUL VOICE</text>
  <rect x="24" y="104" width="250" height="12" rx="6" fill="#2a2535" stroke="rgba(0,0,0,.8)"/>
  <rect id="bw-sb" x="24" y="104" width="0" height="12" rx="6" fill="url(#bw-s)"/>
  <line x1="224" y1="100" x2="224" y2="120" stroke="rgba(255,255,255,.5)"/>
  <text id="bw-st" x="336" y="116" text-anchor="end" font-family="Saira Semi Condensed, sans-serif" font-size="18" font-weight="700" fill="#fff" stroke="#000" stroke-width="3" paint-order="stroke">0</text>
</svg>`;
      const $ = (s) => root.querySelector(s);
      this.bg = { n: $('#bw-n'), t: $('#bw-t'), r: [0, 1, 2, 3].map(k => $('#bw-r' + k)), c: { wm: $('#bw-cwm'), mb: $('#bw-cmb'), ap: $('#bw-cap') }, sb: $('#bw-sb'), st: $('#bw-st'), cache: {} };
    }

    gaugeUpdate(e) {
      const G = this.bg, c = G.cache, g = e.g;
      const put = (k, v, fn) => { if (c[k] !== v) { c[k] = v; fn(v); } };
      const names = { wanderersMinuet: 'THE WANDERER\'S MINUET', magesBallad: 'MAGE\'S BALLAD', armysPaeon: 'ARMY\'S PAEON' };
      const cols = { wanderersMinuet: '#9fd7ff', magesBallad: '#d7a6ff', armysPaeon: '#ffcf7a' };
      put('n', g.song || '', v => { G.n.textContent = v ? names[v] : 'SONG'; });
      put('t', g.song ? Math.ceil(g.songUntil - e.now) : 0, v => { G.t.textContent = v ? v + 's' : ''; });
      for (let i = 0; i < 4; i++) put('r' + i, `${g.song}|${g.rep > i}`, () => G.r[i].setAttribute('fill', g.rep > i ? cols[g.song] || '#fff' : '#2a2535'));
      for (const k of ['wm', 'mb', 'ap']) put('c' + k, g.coda[k], v => G.c[k].setAttribute('fill', v ? { wm: '#9fd7ff', mb: '#d7a6ff', ap: '#ffcf7a' }[k] : '#2a2535'));
      put('s', g.soul, v => { G.sb.setAttribute('width', String(250 * v / 100)); G.st.textContent = String(v); });
    }

    helpHtml(seq) {
      return `
<h3>How it plays (Endwalker 6.0–6.58)</h3>
<p>Level 90 Bard. Sing all three songs in turn, 45s each (120s recasts): <b>the Wanderer's Minuet</b>, <b>Mage's Ballad</b>, <b>Army's Paeon</b>. Every 3s of a song is an 80% chance of a Repertoire proc and 5 Soul Voice: in the Minuet a <b>Pitch Perfect</b> stack (360 at three), in the Ballad 7.5s off <b>Bloodletter</b> (110, three charges), in the Paeon 4% haste a stack, which then carries into the next song as Army's Muse. Each song leaves a Coda for <b>Radiant Finale</b> (+6% with all three).</p>
<p><b>Burst Shot</b> (220) is the filler; it, <b>Caustic Bite</b>, <b>Stormbite</b> and <b>Iron Jaws</b> each have a 35% chance of Straight Shot Ready for <b>Refulgent Arrow</b> (280). Keep both bites up and refresh them with Iron Jaws, which also re-snapshots them inside your buffs. Spend Soul Voice on <b>Apex Arrow</b> (5 × Soul Voice, up to 500); at 80 or more it opens <b>Blast Arrow</b> (600). In the two-minute window: <b>Raging Strikes</b> (+15%), <b>Battle Voice</b> (+20% direct hit), Radiant Finale, <b>Barrage</b> (a three-hit Refulgent), <b>Sidewinder</b> (320) and <b>Empyreal Arrow</b> (240, a sure Repertoire) on cooldown.</p>
<h3>The opener (The Balance)</h3>
${seq(['stormbite', ['wanderersMinuet'], ['ragingStrikes'], 'causticBite', ['empyrealArrow'], ['bloodletter'], 'burstShot', ['radiantFinale'], ['battleVoice'], 'burstShot', ['barrage'], 'refulgentArrow', ['sidewinder'], 'burstShot', 'burstShot', 'burstShot', ['empyrealArrow'], 'ironJaws', ['pitchPerfect']])}
<p>The tincture at −1.5s. Burst Shots become Refulgent Arrows whenever Straight Shot Ready comes up (don't Barrage while holding one). Then Mage's Ballad at about 43s, Army's Paeon at about 76s, and back to the Minuet.</p>
<p style="color:#a9a3b4">The 6.58 numbers: Burst Shot 220, Refulgent Arrow 280, Caustic Bite 150 + 20 × 45s, Stormbite 100 + 25 × 45s, Iron Jaws 100, Apex Arrow 100–500, Blast Arrow 600, songs 100, Pitch Perfect 100 / 220 / 360, Bloodletter 110, Empyreal Arrow 240, Sidewinder 320; Increased Action Damage II +20%; auto-attacks 80 at 3.04s. 6.0–6.25 had Empyreal Arrow 200 (230 from 6.28) and Sidewinder 300 (until 6.5). Gear: The Balance's 6.5 relic set at 2.48 (Dexterity 3,379, 132 weapon damage).</p>`;
    }
  }

  B.registerJob({
    id: 'brd', name: 'Bard', abbr: 'BRD', role: 'ranged', classJob: 23,
    versions: [{ id: 'ew60', label: 'Endwalker 6.0–6.58', history: 'EW 6.0–6.58', note: 'Level 90: songs as abilities with an 80% Repertoire roll every 3s, Pitch Perfect, Army\'s Muse, Radiant Finale, Apex and Blast Arrow, Iron Jaws; the 6.58 numbers and Anabaseios gear', create: () => new BardEW() }],
  });
})(window.BLM);
