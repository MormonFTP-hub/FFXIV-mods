// Bard, Stormblood (patches 4.06–4.58) at level 70: Caustic Bite and Stormbite kept up with Iron Jaws, Heavy Shot's
// Straighter Shot proc into Refulgent Arrow, Straight Shot's crit buff (30s from 4.06), Barrage (80s from 4.06), and
// the three songs on their 80s recasts. While a song plays, a critical tick of your DoTs (and every Empyreal Arrow)
// triggers its Repertoire: in Mage's Ballad, Bloodletter comes back; in Army's Paeon, a stack of 4% speed (up to
// four); in the Wanderer's Minuet, a Pitch Perfect stack (up to three). Weaponskills cost TP. No Bard numbers changed
// from 4.06 to 4.58; these are the game data at 4.11–4.58 (xivapi's datamining) and the Lodestone notes.
(function (B) {
  const EPS = 1e-6;
  const SONGS = { magesBallad: 'Mage\'s Ballad', armysPaeon: 'Army\'s Paeon', wanderersMinuet: 'the Wanderer\'s Minuet' };
  const ws = (o) => Object.assign({ kind: 'gcd', target: true, range: 25, delay: 0.6, fx: 'gnbShot' }, o);
  const ab = (o) => Object.assign({ kind: 'ogcd' }, o);
  const song = (name) => ab({ name, recast: 80, potency: 100, target: true, range: 25, delay: 0.5, song: true, fx: 'gnbShot' });
  const ACTIONS = {
    heavyShot: ws({ name: 'Heavy Shot', potency: 150, tp: 50, desc: 'Delivers an attack with a potency of 150.\nAdditional Effect: 20% chance of Straighter Shot\nDuration: 10s' }),
    straightShot: ws({ name: 'Straight Shot', potency: 140, tp: 50, desc: 'Delivers an attack with a potency of 140.\nAdditional Effect: Increases critical hit rate by 10%\nDuration: 30s\nStraighter Shot Bonus: Guaranteed critical hit' }),
    causticBite: ws({ name: 'Caustic Bite', potency: 120, tp: 60, dot: { potency: 45, duration: 30 }, fx: 'gnbShot', desc: 'Deals damage with a potency of 120.\nAdditional Effect: Poison\nPotency: 45\nDuration: 30s' }),
    stormbite: ws({ name: 'Stormbite', potency: 120, tp: 60, dot: { potency: 55, duration: 30 }, fx: 'gnbShot', desc: 'Deals wind damage with a potency of 120.\nAdditional Effect: Wind damage over time\nPotency: 55\nDuration: 30s' }),
    ironJaws: ws({ name: 'Iron Jaws', potency: 100, tp: 50, desc: 'Deals damage with a potency of 100.\nAdditional Effect: If the target is suffering from a Caustic Bite or Stormbite effect inflicted by you, the effect timer is reset' }),
    refulgentArrow: ws({ name: 'Refulgent Arrow', potency: 300, tp: 0, desc: 'Delivers an attack with a potency of 300.\nCan only be executed while under the effect of Straighter Shot.' }),
    quickNock: ws({ name: 'Quick Nock', potency: 110, tp: 120, range: 12, aoe: true, desc: 'Delivers an attack with a potency of 110 to all enemies in a cone before you.' }),
    empyrealArrow: ab({ name: 'Empyreal Arrow', recast: 15, potency: 230, tp: 50, target: true, range: 25, delay: 0.6, fx: 'gnbShot', desc: 'Delivers an attack with a potency of 230.\nEnhanced Empyreal Arrow: triggers the Repertoire effect of the song you\'re playing.\nWeaponskill with its own 15s recast (doesn\'t trigger the GCD).' }),
    bloodletter: ab({ name: 'Bloodletter', recast: 15, cdGroup: 'bloodletter', potency: 130, target: true, range: 25, delay: 0.5, fx: 'gnbShot', desc: 'Delivers an attack with a potency of 130.\nShares a recast timer with Rain of Death.' }),
    rainOfDeath: ab({ name: 'Rain of Death', recast: 15, cdGroup: 'bloodletter', potency: 100, target: true, range: 25, aoe: true, delay: 0.6, desc: 'Deals damage with a potency of 100 to target and all enemies nearby it.\nShares a recast timer with Bloodletter.' }),
    sidewinder: ab({ name: 'Sidewinder', recast: 60, potency: 100, target: true, range: 25, delay: 0.6, fx: 'gnbShot', desc: 'Delivers an attack with a potency of 100.\nPotency increases to 175 when target is afflicted with Caustic Bite or Stormbite, and 260 when afflicted with both.' }),
    pitchPerfect: ab({ name: 'Pitch Perfect', recast: 3, target: true, range: 25, delay: 0.5, fx: 'gnbShot', desc: 'Delivers an attack with a potency of 100 with one Repertoire, 240 with two, and 420 with three.\nCan only be executed while playing the Wanderer\'s Minuet.' }),
    // A song sung over the fight: +3% damage taken while it lasts, draining 1,680 MP a tick (natural regen is 189), so a
    // full 9,480 MP bar holds it about 23s. Cast before the pull and again once MP is back (the 4.x Bard guide).
    foeRequiem: { name: 'Foe Requiem', kind: 'gcd', cast: 1.5, target: false, pbaoe: 20, sound: 'paradox', desc: 'Increases damage taken by nearby enemies by 3%.\nMP is drained while singing. Effect ends when MP runs out or upon reuse.' },
    ragingStrikes: ab({ name: 'Raging Strikes', recast: 80, desc: 'Increases damage dealt by 10%.\nDuration: 20s' }),
    barrage: ab({ name: 'Barrage', recast: 80, desc: 'The next single-target weaponskill strikes three times.\nAdditional effects apply only once.\nDuration: 10s' }),
    magesBallad: song('Mage\'s Ballad'), armysPaeon: song('Army\'s Paeon'), wanderersMinuet: song('the Wanderer\'s Minuet'),
    battleVoice: ab({ name: 'Battle Voice', recast: 180, desc: 'Increases direct hit rate of self and nearby party members by 15%.\nDuration: 20s\nCan only be executed while singing a song.' }),
    troubadour: ab({ name: 'Troubadour', recast: 180, desc: 'Grants an effect based on the song being sung: Mage\'s Ballad +15% max HP, Army\'s Paeon −10% physical damage taken, the Wanderer\'s Minuet −10% magic damage taken.\nDuration: 30s' }),
    naturesMinne: ab({ name: 'Nature\'s Minne', recast: 45, desc: 'Increases HP recovery via healing actions for a party member or self by 20%.\nDuration: 15s' }),
    wardensPaean: ab({ name: 'the Warden\'s Paean', recast: 45, desc: 'Removes one select detrimental effect from self or target party member, or protects against the next one.\nDuration: 30s' }),
    repellingShot: ab({ name: 'Repelling Shot', recast: 30, lock: 0.8, desc: 'Jump 10 yalms back from current position.\nCannot be executed while bound.' }),
    // The ranged physical role actions of 4.x (five could be slotted; these are the useful ones on a dummy).
    invigorate: ab({ name: 'Invigorate', recast: 120, role: true, desc: 'Instantly restores 400 TP.' }),
    secondWind: ab({ name: 'Second Wind', recast: 120, role: true, desc: 'Instantly restores own HP.\nCure Potency: 500' }),
    headGraze: ab({ name: 'Head Graze', recast: 30, role: true, target: true, range: 25, desc: 'Interrupts the use of an action.' }),
    peloton: ab({ name: 'Peloton', recast: 5, role: true, desc: 'Increases movement speed of self and nearby party members.\nDuration: 30s\nCan only be executed out of combat.' }),
    ...B.GENERAL_ACTIONS,
    tincture: B.tincture('dex3sb'),
    auto: { name: 'Shot', kind: 'auto', fx: 'auto', desc: 'Auto-attack.' },
  };

  const STATUSES = {
    foeRequiem: { name: 'Foe Requiem', self: true, icon: 'st_foe' },
    straighterShot: { name: 'Straighter Shot', self: true, icon: 'st_straighter' },
    straightShot: { name: 'Straight Shot', self: true, icon: 'st_straight' },
    ragingStrikes: { name: 'Raging Strikes', self: true, icon: 'st_raging' },
    barrage: { name: 'Barrage', self: true, icon: 'st_barrage' },
    magesBallad: { name: 'Mage\'s Ballad', self: true, icon: 'st_song' },
    armysPaeon: { name: 'Army\'s Paeon', self: true, icon: 'st_song' },
    wanderersMinuet: { name: 'the Wanderer\'s Minuet', self: true, icon: 'st_song' },
    criticalUp: { name: 'Critical Up', self: true, icon: 'st_crit' },
    battleVoice: { name: 'Battle Voice', self: true, icon: 'st_bv' },
    troubadour: { name: 'Troubadour', self: true, icon: 'st_troub' },
    naturesMinne: { name: 'Nature\'s Minne', self: true, icon: 'st_minne' },
    peloton: { name: 'Peloton', self: true, icon: 'st_peloton' },
    causticBite: { name: 'Caustic Bite', self: false, icon: 'st_caustic' },
    stormbite: { name: 'Stormbite', self: false, icon: 'st_storm' },
  };

  class BardSB {
    constructor() {
      this.name = 'Bard';
      this.abbr = 'BRD';
      this.role = 'ranged';
      this.level = 70;
      this.levelKey = 'sb70';
      this.model = 'brd-sb';
      this.actions = ACTIONS;
      this.statuses = STATUSES;
      this.tp = { max: 1000, regen: 60 };
      // A rough 4.5 Alphascape set (the Omega Bow: 109 weapon damage, 3.04 delay in the 4.58 item data); level-70 stats.
      // Increased Action Damage II: +20%.
      this.stats = { hp: 30000, main: 3280, mainStat: 'dex', jobMod: 115, trait: 120, wd: 109, det: 1550, crit: 2700,
        dh: 2200, speed: 800, delay: 3.04 };
      this.speedName = 'Skill speed';
      this.tierHaste = 0;
      this.autoAttack = { potency: 110, delay: 3.04, range: 25 };
      this.selfStatusOrder = ['wanderersMinuet', 'magesBallad', 'armysPaeon', 'straightShot', 'straighterShot', 'ragingStrikes', 'barrage',
        'battleVoice', 'criticalUp', 'medicated', 'troubadour', 'naturesMinne', 'peloton', 'sprint'];
      this.targetStatusOrder = ['causticBite', 'stormbite'];
      this.maxMp = 9480;     // 12,000 × Bard's 79%
      this.defaultBars = [
        ['heavyShot', 'straightShot', 'causticBite', 'stormbite', 'ironJaws', 'refulgentArrow', 'empyrealArrow', 'bloodletter', 'sidewinder', 'pitchPerfect', 'ragingStrikes', 'barrage'],
        ['wanderersMinuet', 'magesBallad', 'armysPaeon', 'battleVoice', 'tincture', 'invigorate', 'troubadour', 'naturesMinne', 'wardensPaean', 'repellingShot', 'secondWind', 'headGraze'],
        ['quickNock', 'rainOfDeath', 'peloton', 'sprint', 'foeRequiem', null, null, null, null, null, null, null],
      ];
      this.actionGroups = [
        ['Bard', ['heavyShot', 'straightShot', 'causticBite', 'stormbite', 'ironJaws', 'refulgentArrow', 'quickNock', 'empyrealArrow', 'bloodletter',
          'rainOfDeath', 'sidewinder', 'pitchPerfect', 'ragingStrikes', 'barrage', 'wanderersMinuet', 'magesBallad', 'armysPaeon', 'battleVoice',
          'troubadour', 'naturesMinne', 'wardensPaean', 'repellingShot', 'foeRequiem']],
        ['Role Actions', ['invigorate', 'secondWind', 'headGraze', 'peloton']],
        ['General', ['sprint', 'tincture']],
      ];
      this.referenceDps = 7500;     // a scripted 4.5 rotation parses about 7,050 on the dummy
      this.referenceGcd = 2.43;
      this.startDistance = 12;
    }

    initGauge() { return { song: null, songUntil: 0, rep: 0 }; }

    songOn(e) { return e.g.song && e.g.songUntil > e.now + EPS ? e.g.song : null; }

    check(id, e) {
      if (id === 'refulgentArrow' && !e.has('straighterShot')) return 'Unable to execute action. Straighter Shot required.';
      if (id === 'pitchPerfect' && (this.songOn(e) !== 'wanderersMinuet' || e.g.rep < 1)) return 'Unable to execute action. Repertoire required.';
      if (id === 'battleVoice' && !this.songOn(e)) return 'Unable to execute action. A song is required.';
      if (id === 'peloton' && e.inCombat) return 'Unable to execute action while in combat.';
      return null;
    }

    // Army's Paeon: 4% faster per Repertoire stack.
    haste(e) { return this.songOn(e) === 'armysPaeon' ? 4 * e.g.rep : 0; }
    autoHaste(e) { return this.haste(e); }

    snapshot(a, e) {
      let mult = 1, critAdd = 0, dhAdd = 0;
      if (e.has('ragingStrikes')) mult *= 1.10;
      if (e.has('foeRequiem')) mult *= 1.03;
      if (e.has('straightShot')) critAdd += 0.10;
      if (this.songOn(e)) critAdd += 0.02;            // the song's party Critical Up
      if (e.has('battleVoice')) dhAdd += 0.15;
      const main = this.stats.main + (e.has('medicated') ? B.TINCTURES[this.tinctureKey || 'dex3sb'].cap : 0);
      return { mult, main, critAdd, dhAdd };
    }

    // A song's Repertoire: Bloodletter back (Mage's Ballad), a speed stack (Army's Paeon), a Pitch Perfect stack (Minuet).
    repertoire(e) {
      const g = e.g, s = this.songOn(e);
      if (s === 'magesBallad') { const c = e.cds.bloodletter; if (c) { c.charges = c.max; c.nextAt = null; } }
      else if (s === 'armysPaeon') g.rep = Math.min(4, g.rep + 1);
      else if (s === 'wanderersMinuet') g.rep = Math.min(3, g.rep + 1);
      if (s) e.emit('repertoire', {});
    }
    onDotTick(key, e, r) { if ((key === 'causticBite' || key === 'stormbite') && r && r.crit) this.repertoire(e); }

    resolve(id, e) {
      if (id === 'foeRequiem') {
        if (e.has('foeRequiem')) e.removeStatus('foeRequiem');
        else e.addStatus('foeRequiem', 1e9, { permanent: true });
        return;
      }
      if (this.actions[id].kind === 'gcd') this.weaponskill(id, e);
      else this.ability(id, e);
    }

    applyDot(e, key, snap) {
      const a = this.actions[key];
      e.addTStatus(key, a.dot.duration, { snap, dot: { potency: a.dot.potency, id: key } });
    }

    weaponskill(id, e) {
      const a = this.actions[id];
      let crit = false;
      if (id === 'heavyShot' && Math.random() < 0.2) e.addStatus('straighterShot', 10);
      if (id === 'straightShot') {
        if (e.has('straighterShot')) { crit = true; e.removeStatus('straighterShot'); }
        e.addStatus('straightShot', this.ssDur || 30);
      }
      if (id === 'refulgentArrow') e.removeStatus('straighterShot');
      const snap = this.snapshot(a, e);
      let after = null;
      if (a.dot) after = () => this.applyDot(e, id, snap);
      if (id === 'ironJaws') {
        // Resets both of your DoTs on the target, taking the buffs you have now.
        after = () => { for (const k of ['causticBite', 'stormbite']) if (e.tHas(k)) this.applyDot(e, k, snap); };
      }
      // Barrage: a single-target weaponskill strikes three times; its other effects apply once.
      const hits = e.has('barrage') && !a.aoe ? 3 : 1;
      if (hits > 1) e.removeStatus('barrage');
      for (let k = 0; k < hits; k++) e.queueHit(id, a.potency, snap, a.delay + k * 0.15, k === 0 ? after : null, { crit });
    }

    ability(id, e) {
      const a = this.actions[id], g = e.g;
      let potency = a.potency || 0;
      if (a.song) {
        // A new song replaces the old one; its Repertoire stacks go with it.
        for (const k of Object.keys(SONGS)) e.removeStatus(k, true);
        g.song = id; g.songUntil = e.now + 30; g.rep = 0;
        e.addStatus(id, 30);
        e.addStatus('criticalUp', 30);
      }
      switch (id) {
        case 'empyrealArrow': {
          const snap = this.snapshot(a, e);
          const hits = e.has('barrage') ? 3 : 1;
          if (hits > 1) e.removeStatus('barrage');
          for (let k = 0; k < hits; k++) e.queueHit(id, potency, snap, a.delay + k * 0.15);
          this.repertoire(e);
          return;
        }
        case 'sidewinder': {
          const n = (e.tHas('causticBite') ? 1 : 0) + (e.tHas('stormbite') ? 1 : 0);
          potency = [100, 175, 260][n];
          break;
        }
        case 'pitchPerfect': potency = [0, 100, 240, 420][g.rep]; g.rep = 0; break;
        case 'ragingStrikes': e.addStatus('ragingStrikes', 20); return;
        case 'barrage': e.addStatus('barrage', 10); return;
        case 'battleVoice': e.addStatus('battleVoice', 20); return;
        case 'troubadour': e.addStatus('troubadour', 30); return;
        case 'naturesMinne': e.addStatus('naturesMinne', 15); return;
        case 'peloton': e.addStatus('peloton', 30); return;
        case 'invigorate': B.ROLE_EFFECTS.invigorate(e); return;
        case 'repellingShot': {
          const d = e.distToTarget() || 1;
          const from = { x: e.pos.x, z: e.pos.z };
          e.pos.x += e.pos.x / d * 10; e.pos.z += e.pos.z / d * 10;
          e.emit('teleport', { from, to: { x: e.pos.x, z: e.pos.z } });
          return;
        }
        default:
          if (!a.song && B.ROLE_EFFECTS[id]) { B.ROLE_EFFECTS[id](e); return; }
      }
      if (potency) e.queueHit(id, potency, this.snapshot(a, e), a.delay);
    }

    // A song running out takes its Repertoire with it.
    nextEvent(e) {
      if (e.has('foeRequiem') && e.mp <= 0) return e.now;
      return e.g.song ? e.g.songUntil : Infinity;
    }
    process(e) {
      const g = e.g;
      if (e.has('foeRequiem') && e.mp <= 0) e.removeStatus('foeRequiem');
      if (g.song && e.now >= g.songUntil - EPS) { g.song = null; g.rep = 0; e.removeStatus('criticalUp', true); }
    }

    proc(id, e) {
      if (id === 'refulgentArrow') return e.has('straighterShot');
      if (id === 'straightShot') return e.has('straighterShot');
      if (id === 'pitchPerfect') return this.songOn(e) === 'wanderersMinuet' && e.g.rep >= 3;
      if (id === 'bloodletter') return this.songOn(e) === 'magesBallad';
      return false;
    }

    // 2% of the pool a tick; Foe Requiem drains 1,680.
    mpRegen(e) { return Math.max(Math.round(this.maxMp * 0.02) - (e.has('foeRequiem') ? 1680 : 0), -e.mp); }
    speedInfo(e) { return `GCD ${e.gcdForSpeed(e.stats.speed).toFixed(2)} · ${e.gcdForSpeed(e.stats.speed, 16).toFixed(2)} at four Army's Paeon stacks`; }

    // ---------- the Song Gauge ----------
    gaugeBuild(root) {
      root.innerHTML = `
<svg width="360" height="140" viewBox="0 0 360 140">
  <defs><linearGradient id="bd-song" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#2f7a4a"/><stop offset="1" stop-color="#9ff0b0"/></linearGradient>
  <radialGradient id="bd-rep" cx="50%" cy="40%" r="60%"><stop offset="0" stop-color="#fff6d0"/><stop offset="1" stop-color="#e0b02a"/></radialGradient></defs>
  <rect x="8" y="10" width="344" height="120" rx="14" fill="rgba(14,12,20,.86)" stroke="rgba(255,255,255,.22)"/>
  <text id="bd-name" x="24" y="38" font-family="Noto Sans, sans-serif" font-size="11" font-weight="600" fill="#a9a3b4" letter-spacing="1">SONG</text>
  <text id="bd-t" x="336" y="40" text-anchor="end" font-family="Saira Semi Condensed, sans-serif" font-size="20" font-weight="700" fill="#fff" stroke="#000" stroke-width="3" paint-order="stroke"></text>
  <rect x="24" y="52" width="312" height="14" rx="7" fill="#1d1a2a" stroke="rgba(255,255,255,.2)"/>
  <rect id="bd-bar" x="24" y="52" width="0" height="14" rx="7" fill="url(#bd-song)"/>
  <text x="24" y="100" font-family="Noto Sans, sans-serif" font-size="11" font-weight="600" fill="#a9a3b4" letter-spacing="1">REPERTOIRE</text>
  ${[0, 1, 2, 3].map(k => `<path id="bd-r${k}" d="M0 -10 L8 0 L0 10 L-8 0 Z" transform="translate(${130 + k * 28} 96)" fill="#2a2535" stroke="rgba(0,0,0,.8)" stroke-width="1.5"/>`).join('')}
</svg>`;
      const $ = (s) => root.querySelector(s);
      this.bg = { name: $('#bd-name'), t: $('#bd-t'), bar: $('#bd-bar'), rep: [0, 1, 2, 3].map(k => $('#bd-r' + k)), cache: {} };
    }

    gaugeUpdate(e) {
      const G = this.bg, c = G.cache, g = e.g;
      const put = (k, v, fn) => { if (c[k] !== v) { c[k] = v; fn(v); } };
      const s = this.songOn(e), left = s ? g.songUntil - e.now : 0;
      put('s', s || '', v => { G.name.textContent = v ? SONGS[v].toUpperCase() : 'NO SONG'; });
      put('t', Math.round(left * 10), () => { G.bar.setAttribute('width', String(312 * Math.min(1, left / 30))); G.t.textContent = left > 0 ? left.toFixed(1) : ''; });
      const max = s === 'armysPaeon' ? 4 : s === 'wanderersMinuet' ? 3 : 0;
      for (let i = 0; i < 4; i++) put('r' + i, (i < max ? 1 : 0) + (g.rep > i ? 1 : 0), v => {
        G.rep[i].setAttribute('fill', v === 2 ? 'url(#bd-rep)' : '#2a2535');
        G.rep[i].setAttribute('opacity', v ? '1' : '.25');
      });
    }

    helpHtml(seq) {
      return `
<h3>How it plays (Stormblood 4.06–4.58)</h3>
<p>Level 70 Bard on TP. Keep <b>Caustic Bite</b> (45 a tick) and <b>Stormbite</b> (55 a tick) on the dummy for 30s each and refresh both at once with <b>Iron Jaws</b>, which also takes the buffs you have at that moment. Keep <b>Straight Shot</b>'s +10% crit up (30s). Fill with <b>Heavy Shot</b>: 20% of the time it grants Straighter Shot, for <b>Refulgent Arrow</b> (300).</p>
<p>Rotate the three songs (30s each, 80s recasts): the <b>Wanderer's Minuet</b>, <b>Mage's Ballad</b>, <b>Army's Paeon</b>. Each critical DoT tick, and every <b>Empyreal Arrow</b> (230, its own 15s recast), triggers the song's Repertoire: Pitch Perfect stacks in the Minuet (spend three for 420), a reset Bloodletter in the Ballad, and 4% speed per stack in the Paeon (up to 16%). <b>Raging Strikes</b> (+10%) and <b>Barrage</b> (the next single-target weaponskill hits three times; Refulgent Arrow is the best use) share an 80s rhythm; <b>Battle Voice</b> (+15% direct hit) needs a song. Weaponskills cost TP; Invigorate gives 400.</p>
<h3>An opener for this version</h3>
${seq(['straightShot', ['wanderersMinuet'], ['ragingStrikes'], 'stormbite', ['empyrealArrow'], ['bloodletter'], 'causticBite', ['battleVoice'], ['sidewinder'], 'heavyShot', ['tincture'], 'heavyShot', ['barrage'], 'refulgentArrow', ['pitchPerfect'], 'heavyShot', 'heavyShot', 'ironJaws'])}
<p>Barrage waits for a Straighter Shot. This follows the version's rules; it isn't copied from a published guide.</p>
<p style="color:#a9a3b4">The 4.06–4.58 numbers: Heavy Shot 150, Straight Shot 140, Caustic Bite 120 + 45 × 30s, Stormbite 120 + 55 × 30s, Iron Jaws 100, Refulgent Arrow 300, Empyreal Arrow 230, Bloodletter 130, Sidewinder 100 / 175 / 260, Pitch Perfect 100 / 240 / 420, songs 100. Battle Voice is taken to include you; Repertoire procs on every critical DoT tick (Stormblood had no roll). Auto-attacks 110 potency at 3.04s; gear approximate.</p>`;
    }
  }

  B.BardSB = BardSB;
  B.registerJob({
    id: 'brd', name: 'Bard', abbr: 'BRD', role: 'ranged', classJob: 23,
    versions: [{ id: 'sb406', label: 'Stormblood 4.06–4.58', history: 'SB 4.06–4.58', note: 'Level 70. Caustic Bite and Stormbite with Iron Jaws, Straighter Shot into Refulgent Arrow, the three songs and their Repertoire, Barrage, Pitch Perfect', create: () => new BardSB() }],
  });
})(window.BLM);
