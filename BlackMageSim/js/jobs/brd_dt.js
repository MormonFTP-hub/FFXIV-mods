// Bard, Dawntrail 7.0–7.57 at level 100. Built on the Endwalker class (brd_ew.js): the three songs with Repertoire, Soul
// Voice into Apex and Blast Arrow, the DoTs and Iron Jaws, Raging Strikes, Battle Voice and Radiant Finale. Dawntrail
// made the songs deal no damage (and need combat), renamed Straight Shot Ready to Hawk's Eye (also from Iron Jaws and
// Ladonsbite, spent by Refulgent Arrow or Shadowbite), made Barrage its own status for one triple Refulgent Arrow (no
// Hawk's Eye, no Burst Shot) that also readies Resonant Arrow (640), and gave Radiant Finale (20s now, like Battle
// Voice) Radiant Encore, stronger with more Coda (700 / 800 / 1,100). Bloodletter became Heartbreak Shot (180), Pitch
// Perfect hits around the target, Empyreal Arrow is 260, Sidewinder 400, Apex Arrow 7 × Soul Voice and Blast Arrow 700.
// The 7.4–7.57 numbers; game data at 7.0, 7.1, 7.2, 7.3, 7.41 and 7.57 (xivapi's datamining) and the Lodestone notes;
// gear is The Balance's 7.4+ savage set. ref: a scripted bot parses about 29,300 on this.
(function (B) {
  const EW = B.BardEW;
  const ws = (o) => Object.assign({ kind: 'gcd', target: true, range: 25, delay: 0.6, fx: 'gnbShot' }, o);
  const set = B.setAction;     // a version's change to an action (its description's numbers follow the potency)
  const ENCORE = [0, 700, 800, 1100];

  class BardDT extends EW {
    constructor() {
      super();
      this.level = 100;
      this.levelKey = 100;
      this.model = 'brd-dt';
      const A = Object.assign({}, this.actions);
      for (const k of ['wanderersMinuet', 'magesBallad', 'armysPaeon']) {
        set(A, k, { potency: 0, target: false, desc: A[k].desc.replace('Deals unaspected damage with a potency of 100.\nAdditional Effect: Grants', 'Grants').replace(/\nAdditional Effect: Gr.*$/, '') + '\nCan only be executed while in combat.' });
      }
      set(A, 'magesBallad', { desc: A.magesBallad.desc + '\nRepertoire Effect: Reduces the recast time of Heartbreak Shot and Rain of Death by 7.5s' });
      set(A, 'refulgentArrow', { ready: undefined, desc: 'Delivers an attack with a potency of 280.\nCan only be executed while under the effect of Hawk\'s Eye or Barrage.\nBarrage: strikes three times.' });
      set(A, 'burstShot', { hawk: true, ssr: undefined, desc: 'Delivers an attack with a potency of 220.\nAdditional Effect: 35% chance of granting Hawk\'s Eye\nDuration: 30s' });
      set(A, 'causticBite', { hawk: true, ssr: undefined });
      set(A, 'stormbite', { hawk: true, ssr: undefined });
      set(A, 'ironJaws', { hawk: true, ssr: undefined });
      set(A, 'ladonsbite', { potency: 140, hawk: true, shadow: undefined, desc: 'Delivers an attack with a potency of 140 to all enemies in a cone before you.\nAdditional Effect: 35% chance of granting Hawk\'s Eye\nDuration: 30s' });
      set(A, 'shadowbite', { potency: 200, ready: undefined, desc: 'Delivers an attack with a potency of 200 to target and all enemies nearby it.\nBarrage Potency: 300\nCan only be executed while under the effect of Hawk\'s Eye or Barrage.' });
      set(A, 'apexArrow', { desc: 'Delivers an attack with a potency of 140 to all enemies in a straight line before you.\nSoul Voice Gauge Cost: 20\nPotency increases up to 700 as Soul Voice Gauge exceeds minimum cost.\nAdditional Effect: Grants Blast Arrow Ready at 80 Soul Voice or more\nDuration: 10s' });
      set(A, 'blastArrow', { potency: 700, aoe: 0.5, desc: 'Delivers an attack to all enemies in a straight line before you with a potency of 700 for the first enemy, and 50% less for all remaining enemies.\nCan only be executed while under the effect of Blast Arrow Ready.' });
      A.heartbreakShot = Object.assign({}, A.bloodletter, { name: 'Heartbreak Shot', potency: 180, desc: 'Delivers an attack with a potency of 180.\nMaximum Charges: 3\nShares a recast timer with Rain of Death.' });
      delete A.bloodletter;
      set(A, 'pitchPerfect', { aoe: 0.5, desc: 'Delivers an attack to the target and all enemies nearby it. Potency varies with number of Repertoire stacks, 50% less for all remaining enemies.\n1 Repertoire: 100\n2 Repertoire: 220\n3 Repertoire: 360\nCan only be executed while singing the Wanderer\'s Minuet.' });
      set(A, 'empyrealArrow', { potency: 260, desc: 'Delivers an attack with a potency of 260.\nAdditional Effect: Grants a Repertoire proc of the song being sung' });
      set(A, 'sidewinder', { potency: 400, desc: 'Delivers an attack with a potency of 400.' });
      set(A, 'battleVoice', { desc: 'Increases direct hit rate of self and all nearby party members by 20%.\nDuration: 20s' });
      set(A, 'radiantFinale', { desc: 'Increases damage dealt by self and nearby party members by 2% / 4% / 6% for one / two / three different Coda.\nDuration: 20s\nAdditional Effect: Grants Radiant Encore Ready\nDuration: 30s' });
      set(A, 'barrage', { desc: 'Grants Barrage: the next Refulgent Arrow strikes three times, or Shadowbite gains potency (300).\nDuration: 10s\nAdditional Effect: Grants Resonant Arrow Ready\nDuration: 30s' });
      set(A, 'troubadour', { recast: 90, desc: 'Reduces damage taken by self and nearby party members by 15%.\nDuration: 15s' });
      A.resonantArrow = ws({ name: 'Resonant Arrow', potency: 640, aoe: 0.5, ready: 'resonantArrowReady', fx: 'gnbZone', desc: 'Delivers an attack with a potency of 640 to target and all enemies nearby it, 50% less for all remaining enemies.\nCan only be executed while under the effect of Resonant Arrow Ready.' });
      A.radiantEncore = ws({ name: 'Radiant Encore', potency: 1100, aoe: 0.5, ready: 'radiantEncoreReady', fx: 'gnbDouble', desc: 'Delivers an attack to the target and all enemies nearby it, 50% less for all remaining enemies. Potency varies with the number of Coda the preceding Radiant Finale used.\n1 Coda: 700\n2 Coda: 800\n3 Coda: 1,100\nCan only be executed while under the effect of Radiant Encore Ready.' });
      A.tincture = B.tincture('dexdt4');
      this.actions = A;
      this.statuses = Object.assign({}, this.statuses, {
        hawksEye: { name: 'Hawk\'s Eye', self: true, icon: 'st_ssr' },
        resonantArrowReady: { name: 'Resonant Arrow Ready', self: true, icon: 'st_ssr' },
        radiantEncoreReady: { name: 'Radiant Encore Ready', self: true, icon: 'st_ssr' },
      });
      this.selfStatusOrder = ['wanderersMinuet', 'magesBallad', 'armysPaeon', 'armysMuse', 'armysEthos', 'ragingStrikes', 'battleVoice', 'radiantFinale', 'barrage',
        'hawksEye', 'blastArrowReady', 'resonantArrowReady', 'radiantEncoreReady', 'troubadour', 'naturesMinne', 'medicated', 'peloton', 'armsLength', 'sprint'];
      this.stats = { hp: 226488, main: 6513, mainStat: 'dex', jobMod: 115, trait: 120, wd: 158, det: 2509, crit: 3549, dh: 1981, speed: 474, delay: 3.04 };
      this.defaultBars = [
        ['burstShot', 'refulgentArrow', 'causticBite', 'stormbite', 'ironJaws', 'apexArrow', 'blastArrow', 'resonantArrow', 'radiantEncore', 'wanderersMinuet', 'magesBallad', 'armysPaeon'],
        ['pitchPerfect', 'heartbreakShot', 'empyrealArrow', 'sidewinder', 'ragingStrikes', 'battleVoice', 'radiantFinale', 'barrage', 'tincture', 'troubadour', 'naturesMinne', 'wardensPaean'],
        ['ladonsbite', 'shadowbite', 'rainOfDeath', 'repellingShot', 'headGraze', 'secondWind', 'legGraze', 'footGraze', 'peloton', 'armsLength', 'sprint', null],
      ];
      this.actionGroups = [
        ['Bard', ['burstShot', 'refulgentArrow', 'causticBite', 'stormbite', 'ironJaws', 'apexArrow', 'blastArrow', 'resonantArrow', 'radiantEncore', 'ladonsbite',
          'shadowbite', 'wanderersMinuet', 'magesBallad', 'armysPaeon', 'pitchPerfect', 'heartbreakShot', 'rainOfDeath', 'empyrealArrow', 'sidewinder',
          'ragingStrikes', 'battleVoice', 'radiantFinale', 'barrage', 'troubadour', 'naturesMinne', 'wardensPaean', 'repellingShot']],
        ['Role Actions', ['legGraze', 'secondWind', 'footGraze', 'peloton', 'headGraze', 'armsLength']],
        ['General', ['sprint', 'tincture']],
      ];
      this.referenceDps = 31060;
      this.referenceGcd = 2.49;
    }

    check(id, e) {
      const a = this.actions[id];
      if (a.song && !e.inCombat) return 'Unable to execute action while not in combat.';
      if ((id === 'refulgentArrow' || id === 'shadowbite') && !e.has('hawksEye') && !e.has('barrage')) return 'Unable to execute action. Hawk\'s Eye or Barrage required.';
      return super.check(id, e);
    }

    // As Endwalker's, with Mage's Ballad cutting Heartbreak Shot.
    repertoire(e) {
      const g = e.g;
      if (!g.song || !e.has(g.song)) return;
      this.soul(e, 5);
      if (g.song === 'wanderersMinuet') g.rep = Math.min(3, g.rep + 1);
      else if (g.song === 'armysPaeon') g.rep = Math.min(4, g.rep + 1);
      else { const c = e.cd('heartbreakShot'); if (c.nextAt !== null) c.nextAt -= 7.5; }
      e.emit('repertoire', {});
    }

    snapshot(a, e) {
      const s = super.snapshot(a, e);
      s.main = this.stats.main + (e.has('medicated') ? B.TINCTURES.dexdt4.cap : 0);
      return s;
    }

    resolve(id, e) {
      const a = this.actions[id], g = e.g;
      if (a.kind === 'gcd') {
        // Barrage is spent before Hawk's Eye.
        if (id === 'refulgentArrow' || id === 'shadowbite') {
          const barrage = e.has('barrage');
          e.removeStatus(barrage ? 'barrage' : 'hawksEye');
          const snap = this.snapshot(a, e);
          if (id === 'shadowbite') e.queueHit(id, barrage ? 300 : a.potency, snap, a.delay);
          else for (let k = 0; k < (barrage ? 3 : 1); k++) e.queueHit(id, a.potency, snap, a.delay + 0.2 * k);
          return;
        }
        let potency = a.potency;
        if (a.ready) e.removeStatus(a.ready);
        if (id === 'radiantEncore') potency = ENCORE[g.encore || 1];
        if (id === 'apexArrow') {
          potency = 7 * g.soul;
          if (g.soul >= 80) e.addStatus('blastArrowReady', 10);
          g.soul = 0;
        }
        if (a.hawk && Math.random() < 0.35) e.addStatus('hawksEye', 30);
        const snap = this.snapshot(a, e);
        let after = a.dot ? () => this.applyDot(e, id, snap) : null;
        if (id === 'ironJaws') after = () => { for (const k of ['causticBite', 'stormbite']) if (e.tHas(k)) this.applyDot(e, k, snap); };
        e.queueHit(id, potency, snap, a.delay, after);
        return;
      }
      switch (id) {
        case 'battleVoice': e.addStatus('battleVoice', 20); return;
        case 'radiantFinale': {
          const n = (g.coda.wm ? 1 : 0) + (g.coda.mb ? 1 : 0) + (g.coda.ap ? 1 : 0);
          g.finale = [0, 0.02, 0.04, 0.06][n];
          g.encore = n;
          g.coda = { wm: false, mb: false, ap: false };
          e.addStatus('radiantFinale', 20);
          e.addStatus('radiantEncoreReady', 30);
          return;
        }
        case 'barrage': e.addStatus('barrage', 10); e.addStatus('resonantArrowReady', 30); return;
      }
      super.resolve(id, e);
    }

    proc(id, e) {
      if (id === 'refulgentArrow' || id === 'shadowbite') return e.has('hawksEye') || e.has('barrage');
      return super.proc(id, e);
    }

    speedInfo(e) { return `GCD ${e.gcdForSpeed(e.stats.speed).toFixed(2)} · ${e.gcdForSpeed(e.stats.speed, 16).toFixed(2)} with four Army's Paeon stacks`; }

    helpHtml(seq) {
      return `
<h3>How it plays (Dawntrail 7.0–7.57)</h3>
<p>Level 100 Bard. Keep <b>Caustic Bite</b> and <b>Stormbite</b> up (refresh both with <b>Iron Jaws</b>), and fill with <b>Burst Shot</b> (220). Each of those has a 35% chance of <b>Hawk's Eye</b> for <b>Refulgent Arrow</b> (280). The songs (45s each, 120s recasts, in combat only, no damage now) give a Repertoire proc 80% of the time every 3s (+5 Soul Voice): the Wanderer's Minuet stacks <b>Pitch Perfect</b> (100 / 220 / 360), Mage's Ballad takes 7.5s off <b>Heartbreak Shot</b> (180, three charges), Army's Paeon stacks haste. Spend Soul Voice on <b>Apex Arrow</b> (7 × Soul Voice, up to 700) and at 80+ <b>Blast Arrow</b> (700).</p>
<p>Every two minutes: <b>Raging Strikes</b> (+15%), <b>Battle Voice</b> (+20% direct hit) and <b>Radiant Finale</b> (+2/4/6% by Coda, 20s) into <b>Radiant Encore</b> (700 / 800 / 1,100); <b>Barrage</b> for one triple Refulgent Arrow, which also readies <b>Resonant Arrow</b> (640). <b>Empyreal Arrow</b> (260, a sure Repertoire) and <b>Sidewinder</b> (400) on cooldown.</p>
<h3>The opener (The Balance, "Adjusted Standard", 2.48)</h3>
${seq([['heartbreakShot'], 'stormbite', ['wanderersMinuet'], ['empyrealArrow'], 'causticBite', ['tincture'], ['battleVoice'], 'burstShot', ['radiantFinale'], ['ragingStrikes'], 'burstShot', ['barrage'], 'refulgentArrow', ['sidewinder'], 'radiantEncore', 'resonantArrow', ['empyrealArrow'], 'refulgentArrow', 'burstShot', 'ironJaws', 'burstShot', ['pitchPerfect']])}
<p>Heartbreak Shot at the pull puts you in combat so the song can start. Radiant Finale with one Coda in the opener is intended; any Burst Shot may be a Refulgent Arrow and vice versa, except Barrage's.</p>
<p style="color:#a9a3b4">The 7.4–7.57 numbers: Burst Shot 220, Refulgent Arrow 280, Caustic Bite 150 + 20 × 45s, Stormbite 100 + 25 × 45s, Iron Jaws 100, Apex Arrow 140–700, Blast Arrow 700, Resonant Arrow 640, Radiant Encore 700 / 800 / 1,100, Pitch Perfect 100 / 220 / 360, Heartbreak Shot 180, Empyreal Arrow 260, Sidewinder 400; auto-attacks 80 at 3.04s. Before 7.4: Apex Arrow 6 × Soul Voice, Blast Arrow 600 and Radiant Encore 600 / 700 / 1,000 (500 / 600 / 900 before 7.3); Resonant Arrow 600 before 7.3. Gear: The Balance's 7.4+ savage set (Dexterity 6,513, 158 weapon damage, 2.49), with a Grade 4 Gemdraught.</p>`;
    }
  }

  B.registerJob({
    id: 'brd', name: 'Bard', abbr: 'BRD', role: 'ranged', classJob: 23,
    versions: [{ id: 'dt70', label: 'Dawntrail 7.0–7.57', history: 'DT 7.0–7.57', note: 'Level 100: Hawk\'s Eye, songs without damage, Barrage into Resonant Arrow, Radiant Finale into Radiant Encore, Heartbreak Shot; the 7.4 numbers', create: () => new BardDT() }],
  });
})(window.BLM);
