// Dark Knight, Heavensward at level 60, in two versions. Built on the Stormblood class (drk_sb.js) for the combos,
// Dark Arts, Blood Weapon, Carve and Spit, Plunge, Salted Earth and Dark Passenger, on TP and a small MP pool (6,930:
// tank gear had no Piety). What Heavensward had instead: Darkside is +15% and drains about 265 MP a tick while natural
// regeneration goes on (net about −127), and ends when the MP runs out; Dark Arts costs 1,768 MP (Souleater 240 / 400
// in combo, Carve and Spit 450, Dark Passenger 250); Delirium is a combo weaponskill (Hard Slash → Syphon Strike →
// Delirium, 280, no MP cost) alternating with Souleater (260); Scourge (100 + 40 × 30s) is a DoT; Syphon Strike gives
// about 884 MP; Blood Weapon (60s) gives about 3.5% MP a physical hit. No Blood Gauge, Bloodspiller, Quietus or The
// Blackest Night (all 4.0). Heavensward's damage formula (B.LEVELS.hw60); from 3.2 tanks hit with an attack power that
// weighs Vitality too, folded here into the main stat.
//  - 3.26–3.57: Dark Arts recasts in 3s. Alexander: Creator gear.
//  - 3.0–3.25: Dark Arts recasts in 5s; Hard Slash cost 70 TP until 3.2. Alexander: Gordias gear.
// Numbers are the official job guide's 3.57 tooltips (Wayback, June 2017), the FFXIV wiki's Heavensward Dark Knight
// pages and 2015 forum tests for the MP gains and Darkside's drain.
(function (B) {
  const SB = B.DarkKnightSB;
  const EPS = 1e-6;
  const DS_DRAIN = 265;
  const set = (A, id, o) => { A[id] = Object.assign({}, A[id], o); };
  // ref: a scripted bot parses about 1,800 / 990 in these two over 5 minutes.
  const VERSIONS = {
    hw326: { label: 'Heavensward 3.26–3.57', history: 'HW 3.26–3.57', da: 3, potion: ['Supramax-Potion of Strength', 154], ref: 1910,
      stats: { hp: 31000, main: 1400, wd: 84, det: 753, crit: 1196, speed: 559, delay: 2.96 },
      gear: 'an Alexander: Creator tank set (84 weapon damage, 2.96 delay)',
      note: 'Level 60: Darkside +15% draining MP, Dark Arts every 3s for Souleater and Carve and Spit, Delirium as a combo, Scourge, Blood Weapon for MP; Creator gear' },
    hw30: { label: 'Heavensward 3.0–3.25', history: 'HW 3.0–3.25', da: 5, potion: ['Draconian Potion of Strength', 105], ref: 1050,
      stats: { hp: 24000, main: 1000, wd: 76, det: 488, crit: 564, speed: 497, delay: 2.96 },
      gear: 'an Alexander: Gordias tank set (76 weapon damage)',
      note: 'Level 60, the launch: Darkside, Grit, a 5s Dark Arts, Blood Weapon, Delirium as a combo weaponskill; Gordias gear' },
  };

  class DarkKnightHW extends SB {
    constructor(version) {
      super('sb40');
      const V = VERSIONS[version];
      this.HV = V;
      this.V = Object.assign({}, this.V, { label: V.label });
      this.level = 60;
      this.levelKey = 'hw60';
      this.model = 'drk-hw';
      this.maxMp = 6930;
      this.dsMult = 1.15;
      this.casMp = 693;
      this.potionCap = V.potion[1];
      const A = Object.assign({}, this.actions);
      for (const k of ['bloodspiller', 'quietus', 'delirium', 'theBlackestNight', 'powerSlash']) delete A[k];
      const ws = (o) => Object.assign({}, A.hardSlash, { comboStart: false, comboNext: false }, o);
      set(A, 'hardSlash', { tp: version === 'hw30' ? 70 : 60 });
      set(A, 'syphonStrike', { mpGain: 884, desc: 'Delivers an attack with a potency of 100.\nCombo Action: Hard Slash\nCombo Potency: 250\nCombo Bonus: Restores MP' });
      set(A, 'souleater', { comboPotency: 260, daPotency: 240, daComboPotency: 400, blood: 0, desc: 'Delivers an attack with a potency of 100.\nCombo Action: Syphon Strike\nCombo Potency: 260\nCombo Bonus: Absorbs a portion of damage dealt as HP\nDark Arts Potency: 240\nDark Arts Combo Potency: 400' });
      A.deliriumWs = ws({ name: 'Delirium', potency: 100, comboPotency: 280, comboFrom: 'syphonStrike', tp: 50, fx: 'gnbBurst', desc: 'Delivers an attack with a potency of 100.\nCombo Action: Syphon Strike\nCombo Potency: 280\nCombo Bonus: Reduces target\'s intelligence and mind by 10%\nDuration: 20s' });
      A.scourge = ws({ name: 'Scourge', potency: 100, tp: 60, breaksCombo: true, dot: { potency: 40, duration: 30 }, fx: 'gnbSlash2', desc: 'Delivers an attack with a potency of 100.\nAdditional Effect: Damage over time\nPotency: 40\nDuration: 30s (Enhanced Scourge)' });
      A.fracture = ws({ name: 'Fracture', potency: 100, tp: 80, breaksCombo: true, dot: { potency: 20, duration: 18 }, fx: 'gnbSlash2', desc: 'Delivers an attack with a potency of 100.\nAdditional Effect: Damage over time\nPotency: 20\nDuration: 18s\n(Marauder cross-class skill)' });
      set(A, 'spinningSlash', { comboNext: false });
      set(A, 'unmend', { mp: 354 });
      set(A, 'unleash', { mp: 796, potency: 100 });
      set(A, 'abyssalDrain', { mp: 972 });
      set(A, 'darkside', { mp: 442, desc: 'Increases damage dealt by 15%.\nDrains MP every 3s while active; ends when MP runs out.\nEffect ends upon reuse.' });
      set(A, 'grit', { mp: 1326 });
      set(A, 'darkArts', { mp: 1768, recast: V.da, desc: `Strengthens the next Souleater, Dark Passenger, Carve and Spit or Abyssal Drain.\nDuration: 10s\nRecast: ${V.da}s\nCan only be executed under Darkside.` });
      set(A, 'bloodWeapon', { recast: 60, desc: 'Reduces weaponskill recast time and auto-attack delay by 10%, and TP cost by 20%.\nAdditional Effect: Each physical attack restores MP\nDuration: 15s' });
      set(A, 'darkPassenger', { recast: 30, mp: 884, potency: 150, daPotency: 250, desc: 'Deals unaspected damage with a potency of 150 to all enemies in a straight line before you.\nDark Arts Potency: 250\nCan only be executed under Darkside.' });
      set(A, 'carveAndSpit', { desc: 'Delivers a threefold attack with a potency of 100.\nAdditional Effect: Restores MP\nDark Arts Potency: 450 (no MP)' });
      A.lowBlowHw = Object.assign({}, A.plunge, { name: 'Low Blow', recast: 25, potency: 100, range: B.MELEE_RANGE, fx: 'gnbCont', daPotency: undefined, desc: 'Delivers an attack with a potency of 100.\nAdditional Effect: Stun\nDuration: 5s' });
      set(A, 'shadowWall', { recast: 180 });
      A.tincture = Object.assign({}, B.tincture('str3sb'), { name: V.potion[0], dur: 15, desc: `This diluted brew temporarily increases strength.\nStrength +20% (Max ${V.potion[1]})\nDuration: 15s` });
      this.actions = A;
      this.statuses = Object.assign({}, this.statuses, {
        scourge: { name: 'Scourge', self: false, icon: 'st_scourge' },
        fracture: { name: 'Fracture', self: false, icon: 'st_fracture' },
      });
      this.stats = Object.assign({ mainStat: 'str', jobMod: 105, trait: 100, dh: 354 }, V.stats);
      this.autoAttack = { potency: 100, delay: 2.96, range: B.MELEE_RANGE };
      this.targetStatusOrder = ['scourge', 'saltedEarth', 'fracture'];
      this.defaultBars = [
        ['hardSlash', 'syphonStrike', 'souleater', 'deliriumWs', 'scourge', 'darkArts', 'bloodWeapon', 'carveAndSpit', 'plunge', 'darkPassenger', 'saltedEarth', 'tincture'],
        ['spinningSlash', 'unmend', 'unleash', 'abyssalDrain', 'lowBlowHw', 'darkside', 'grit', 'shadowWall', 'darkMind', 'livingDead', 'fracture', 'sprint'],
        ['rampart', 'provoke', null, null, null, null, null, null, null, null, null, null],
      ];
      this.actionGroups = [
        ['Dark Knight', ['hardSlash', 'syphonStrike', 'souleater', 'deliriumWs', 'spinningSlash', 'scourge', 'unleash', 'unmend', 'abyssalDrain', 'darkside',
          'grit', 'darkArts', 'bloodWeapon', 'saltedEarth', 'plunge', 'carveAndSpit', 'darkPassenger', 'lowBlowHw', 'shadowWall', 'darkMind', 'livingDead']],
        ['Cross-class', ['fracture', 'rampart', 'provoke']],
        ['General', ['sprint', 'tincture']],
      ];
      this.referenceDps = V.ref;
      this.referenceGcd = 2.42;
    }

    check(id, e) {
      if (id === 'darkArts' && !e.has('darkside')) return 'Unable to execute action. Darkside required.';
      return super.check(id, e);
    }

    resolve(id, e) {
      const a = this.actions[id];
      if (id === 'scourge' || id === 'fracture') {
        const snap = this.snapshot(a, e);
        e.queueHit(id, a.potency, snap, a.delay, () => e.addTStatus(id, a.dot.duration, { snap, dot: { potency: a.dot.potency, id } }));
        return;
      }
      super.resolve(id, e);
    }

    // Blood Weapon: about 3.5% of max MP for every physical hit (auto-attacks too); no Blood Gauge.
    onHit(h, r, e) {
      if (!e.has('bloodWeapon')) return;
      const a = h.auto ? null : this.actions[h.id];
      if (a && a.magic) return;
      this.giveMp(e, Math.round(e.maxMp * 0.035));
    }
    onDotTick() {}

    // Natural regeneration goes on under Darkside, but Darkside drains more; it ends when the MP runs out.
    mpRegen(e) {
      const r = Math.round(e.maxMp * 0.02) - (e.has('darkside') && e.inCombat ? DS_DRAIN : 0);
      return Math.max(r, -e.mp);
    }
    nextEvent(e) { return e.has('darkside') && e.mp <= 0 ? e.now : Infinity; }
    process(e) { if (e.has('darkside') && e.mp <= 0) e.removeStatus('darkside', true); }

    proc(id, e) {
      const a = this.actions[id];
      if (a.comboFrom && e.inCombo(a.comboFrom)) return true;
      if (id === 'darkArts') return e.mp >= 1768 + 1000 && !e.has('darkArts');
      return false;
    }

    speedInfo(e) { return `GCD ${e.gcdForSpeed(e.stats.speed).toFixed(2)}, ${e.gcdForSpeed(e.stats.speed, 10).toFixed(2)} under Blood Weapon · ${e.maxMp.toLocaleString()} MP · Heavensward's formula (no Direct Hit)`; }

    gaugeUpdate(e) {
      super.gaugeUpdate(e);
      const G = this.dg, c = G.cache;
      const ds = e.has('darkside') ? 'DARKSIDE' : 'NO DARKSIDE';
      const t = (e.has('darkArts') ? 'DARK ARTS READY · ' : '') + ds;
      if (c.hw !== t) { c.hw = t; G.lbl.textContent = t; G.b.setAttribute('width', '0'); G.t.textContent = ''; }
    }

    helpHtml(seq) {
      const V = this.HV;
      return `
<h3>How it plays (${V.label})</h3>
<p>Level 60 Dark Knight on TP and a small MP pool (6,930). <b>Darkside</b> is +15% damage but drains MP every tick faster than it comes back, and ends if you run out, so the rotation has to pay for it. <b>Hard Slash → Syphon Strike</b> (+884 MP) then <b>Souleater</b> (260) or <b>Delirium</b> (280, a combo weaponskill in Heavensward), alternating; keep <b>Scourge</b> (100 + 40 × 30s) up.</p>
<p><b>Dark Arts</b> (1,768 MP, ${V.da}s recast) strengthens the next Souleater (400 in combo), Carve and Spit (450, the best use) or Dark Passenger (250). <b>Blood Weapon</b> (60s) is 15s of 10% haste in which every physical hit gives MP back. Plunge, Salted Earth and Low Blow (100) go on cooldown. Grit (the tank stance) is −20%.</p>
<h3>The opener (the FFXIV wiki's Heavensward Dark Knight rotation)</h3>
${seq(['scourge', 'hardSlash', ['bloodWeapon'], 'syphonStrike', ['tincture'], 'deliriumWs', 'hardSlash', 'syphonStrike', ['darkArts'], 'souleater', ['darkArts'], ['carveAndSpit'], 'hardSlash', ['plunge'], 'syphonStrike', ['darkArts'], 'souleater', 'hardSlash', 'syphonStrike', 'deliriumWs', 'scourge'])}
<p>Darkside before the pull. The wiki's list is short; the loop is reconstructed from it and period forum guides.</p>
<p style="color:#a9a3b4">The 3.57 numbers: Hard Slash 150, Syphon Strike combo 250, Souleater combo 260 (400 with Dark Arts), Delirium combo 280, Scourge 100 + 40 × 30s, Carve and Spit 100 (450), Dark Passenger 150 (250), Plunge 200, Low Blow 100, Salted Earth 75 × 21s, Darkside +15%. Darkside's drain (265 a tick), Syphon Strike's MP (884) and Blood Weapon's (3.5% a hit) come from 2015 forum tests; the tank attack power after 3.2 isn't published. Gear: ${V.gear}, with the ${V.potion[0]}.</p>`;
    }
  }

  B.registerJob({
    id: 'drk', name: 'Dark Knight', abbr: 'DRK', role: 'tank', classJob: 32,
    versions: ['hw326', 'hw30'].map(v => ({ id: v, label: VERSIONS[v].label, history: VERSIONS[v].history, note: VERSIONS[v].note, create: () => new DarkKnightHW(v) })),
  });
})(window.BLM);
