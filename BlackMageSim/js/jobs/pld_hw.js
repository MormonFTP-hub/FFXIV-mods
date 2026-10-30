// Paladin, Heavensward 3.2–3.57 at level 60. Built on the Stormblood class (pld_sb.js) for Sword Oath's extra hit
// after every auto-attack (75 potency since 3.4, weighted by weapon delay), Shield Oath's −15% (since 3.2), the
// combos, Spirits Within and Circle of Scorn, on TP. What Heavensward had instead: no Oath Gauge, Holy Spirit,
// Requiescat, Intervention or Total Eclipse (all 4.0); Fight or Flight +30% physical for 30s on a 90s recast; Royal
// Authority (350) and Rage of Halone come from Savage Blade (Fast Blade → Savage Blade → Royal Authority), Riot Blade
// (230, restores MP) leads to Goring Blade (240 + 50 × 24s); Marauder and Conjurer cross-class skills (Fracture, 100 +
// 20 × 18s). Heavensward's damage formula (B.LEVELS.hw60). From 3.2 tanks hit with an attack power that weighs Vitality
// as much as Strength; here that's folded into the main stat (about 1,400, as the Heavensward Warrior's). Numbers are
// the official job guide's 3.57 tooltips (Wayback, June 2017), the FFXIV wiki's Heavensward Paladin pages and the 3.2 /
// 3.4 patch notes; the opener is the wiki's short 3.x list. Gear: an Alexander: Creator set (the Alexandrian Metal
// Blade: 85 weapon damage, 2.24 delay) with the Supramax-Potion of Strength.
//  - 3.1–3.15 and 3.0–3.07: damage from plain Strength (the Vitality-weighted attack power came in 3.2); Fast Blade 70 TP,
//    Goring Blade 220 + 40 × 24s (60 TP until 3.1), Royal Authority 340; Sword Oath +50 to each auto-attack, not weighted by
//    weapon delay (here a 62-potency extra hit at the Gordian Blade's 2.16s, the same damage); Shield Oath −20%; swapping
//    oaths breaks the combo; Clemency a 3s cast. 3.0–3.07's Shield Swipe was a GCD after a block. Gordias Savage gear with
//    the Draconian Potion. ref: the 3.2 bot parses about 1,050 on both (TP runs out after a few minutes).
//  - A Realm Reborn 2.0–2.57 (level 50, arr50; no Paladin damage number changed in 2.x): no Goring Blade, Royal
//    Authority, Sheltron, Divine Veil or Clemency (3.0), so Fast Blade → Savage Blade → Rage of Halone (260) is the loop;
//    Riot Blade 200 for 100 TP (an MP combo only); Shield Bash 150 TP; Sentinel 180s; Sword Oath a 50-potency extra hit
//    per auto-attack through the weaponskill formula (Gamer Escape's 2013 "+50 to auto-attacks", which 3.4 says weapon
//    delay didn't scale); Shield Swipe needed a block, so it's left out. A 2015 Final Coil tank set with the Dreadwyrm
//    Blade (Strength 584, 58 weapon damage, 2.08 delay) and the X-Potion of Strength. No Invigorate: TP runs dry. A bot
//    parses about 390.
(function (B) {
  const SB = B.PaladinSB;
  const set = B.setAction;     // a version's change to an action (its description's numbers follow the potency)
  const ws = (o) => Object.assign({ kind: 'gcd', target: true, range: B.MELEE_RANGE, delay: 0.55, fx: 'gnbSlash' }, o);
  const ab = (o) => Object.assign({ kind: 'ogcd' }, o);

  const VERSIONS = {
    hw32: { label: 'Heavensward 3.2–3.57', history: 'HW 3.2–3.57', ref: 2000 },
    hw31: { label: 'Heavensward 3.1–3.15', history: 'HW 3.1–3.15', early: true, goringTp: 50, ref: 1110,
      note: 'Level 60 on TP, Strength-based: Sword Oath +50 on every auto-attack, Goring Blade 220 + 40, Royal Authority 340, oath swaps break combos; Gordias gear' },
    hw30: { label: 'Heavensward 3.0–3.07', history: 'HW 3.0–3.07', early: true, goringTp: 60, ref: 1110,
      note: 'Level 60 on TP, Strength-based: Sword Oath +50 on every auto-attack, Goring Blade 220 + 40 for 60 TP, Royal Authority 340; Shield Swipe a GCD after blocks; Gordias gear' },
    arr20: { label: 'A Realm Reborn 2.0–2.57', history: 'ARR 2.0–2.57', early: true, arr: true, goringTp: 60, ref: 415,
      note: 'Level 50 on TP: Sword Oath (+50 on every auto-attack), Fast Blade → Savage Blade → Rage of Halone, Fight or Flight +30% for 30s, Spirits Within, Circle of Scorn, Fracture; Final Coil gear' },
  };

  class PaladinHW extends SB {
    constructor(version) {
      super();
      const V = VERSIONS[version || 'hw32'];
      this.V = V;
      this.level = 60;
      this.levelKey = 'hw60';
      this.model = 'pld-hw';
      this.maxMp = 5000;
      this.fofMult = 1.30;
      this.fofDur = 30;
      this.potionCap = V.early ? 105 : 154;
      this.oathPotency = V.early ? 62 : 75;
      this.shieldOathMult = V.early ? 0.80 : 0.85;
      const A = Object.assign({}, this.actions);
      for (const k of ['holySpirit', 'requiescat', 'intervention', 'passageOfArms', 'totalEclipse', 'lowBlow', 'reprisal', 'interject', 'ultimatum',
        'shirk', 'anticipation']) delete A[k];
      set(A, 'fastBlade', { potency: 150, desc: 'Delivers an attack with a potency of 150.' });
      set(A, 'savageBlade', { comboPotency: 200, desc: 'Delivers an attack with a potency of 100.\nCombo Action: Fast Blade\nCombo Potency: 200\nCombo Bonus: Increased enmity' });
      set(A, 'riotBlade', { comboPotency: 230, desc: 'Delivers an attack with a potency of 100.\nCombo Action: Fast Blade\nCombo Potency: 230\nCombo Bonus: Restores MP' });
      set(A, 'royalAuthority', { comboPotency: 350, comboFrom: 'savageBlade', desc: 'Delivers an attack with a potency of 100.\nCombo Action: Savage Blade\nCombo Potency: 350' });
      set(A, 'rageOfHalone', { comboPotency: 260, desc: 'Delivers an attack with a potency of 100.\nCombo Action: Savage Blade\nCombo Potency: 260\nCombo Bonus: Reduces target\'s strength by 10%\nDuration: 20s' });
      set(A, 'goringBlade', { comboPotency: 240, dot: { potency: 50, duration: 24 }, desc: 'Delivers an attack with a potency of 100.\nCombo Action: Riot Blade\nCombo Potency: 240\nCombo Bonus: Damage over time\nPotency: 50\nDuration: 24s' });
      set(A, 'fightOrFlight', { recast: 90, desc: 'Increases physical damage dealt by 30%.\nDuration: 30s' });
      set(A, 'shieldSwipe', { potency: 150, desc: A.shieldSwipe.desc.replace('potency of 100', 'potency of 150') });
      set(A, 'sheltron', { oath: 0, recast: 60, desc: 'Block the next attack.\nDuration: 15s' });
      set(A, 'shieldBash', { desc: A.shieldBash.desc });
      set(A, 'clemency', { cast: 2, mp: 1061, desc: 'Restores target\'s HP.\nCure Potency: 1,200' });
      // 3.4's 75 is weighted by weapon delay (onHit); before 3.4 the +50 wasn't.
      set(A, 'swordOath', { mp: 0, desc: 'Each auto-attack is followed by an extra attack with a potency of 75.\nCannot be used with Shield Oath.' });
      set(A, 'shieldOath', { mp: 0, desc: 'Reduces damage taken by 20%, while reducing damage dealt by 15% and increasing enmity.\nCannot be used with Sword Oath.' });
      // Marauder and Conjurer cross-class skills.
      A.fracture = ws({ name: 'Fracture', potency: 100, tp: 80, breaksCombo: true, dot: { potency: 20, duration: 18 }, fx: 'gnbSlash2', desc: 'Delivers an attack with a potency of 100.\nAdditional Effect: Damage over time\nPotency: 20\nDuration: 18s\n(Marauder cross-class skill)' });
      A.foresight = ab({ name: 'Foresight', recast: 90, role: true, desc: 'Increases defense by 20%.\nDuration: 20s' });
      A.bloodbath = ab({ name: 'Bloodbath', recast: 90, role: true, desc: 'Converts 25% of physical damage dealt into HP.\nDuration: 15s' });
      A.tincture = Object.assign({}, B.tincture('str3sb'), { name: 'Supramax-Potion of Strength', dur: 15, desc: 'This diluted brew temporarily increases strength.\nStrength +20% (Max 154)\nDuration: 15s' });
      if (V.early) {
        set(A, 'fastBlade', { tp: 70 });
        set(A, 'royalAuthority', { comboPotency: 340, desc: A.royalAuthority.desc.replace('350', '340') });
        set(A, 'goringBlade', { comboPotency: 220, tp: V.goringTp, dot: { potency: 40, duration: 24 }, desc: 'Delivers an attack with a potency of 100.\nCombo Action: Riot Blade\nCombo Potency: 220\nCombo Bonus: Damage over time\nPotency: 40\nDuration: 24s' });
        set(A, 'swordOath', { desc: 'Increases the potency of auto-attacks by 50.\nUse breaks your weaponskill combo.\nCannot be used with Shield Oath.' });
        set(A, 'shieldOath', { desc: 'Reduces damage taken by 20%, while reducing damage dealt by 20% and increasing enmity.\nUse breaks your weaponskill combo.\nCannot be used with Sword Oath.' });
        set(A, 'clemency', { cast: 3 });
        set(A, 'divineVeil', { recast: 150 });
        set(A, 'sheltron', { recast: 30, desc: 'Block the next physical attack.\nDuration: 10s' });
        // 3.0–3.07: a weaponskill (on the GCD) after a block.
        if (version === 'hw30') set(A, 'shieldSwipe', { kind: 'gcd', recast: 2.5, potency: 210, desc: 'Delivers an attack with a potency of 210.\nCan only be executed immediately after blocking an attack.' });
        A.tincture = Object.assign({}, A.tincture, { name: 'Draconian Potion of Strength', desc: 'Temporarily increases strength.\nStrength +20% (Max 105)\nDuration: 15s' });
      }
      if (V.arr) {
        for (const k of ['goringBlade', 'royalAuthority', 'sheltron', 'divineVeil', 'clemency', 'shieldSwipe']) delete A[k];
        set(A, 'riotBlade', { comboPotency: 200, tp: 100, desc: 'Delivers an attack with a potency of 100.\nCombo Action: Fast Blade\nCombo Potency: 200\nCombo Bonus: Restores MP' });
        set(A, 'shieldBash', { tp: 150 });
        set(A, 'sentinel', { recast: 180 });
        set(A, 'swordOath', { mp: 266, desc: 'Increases the potency of auto-attacks by 50.\nUse breaks your weaponskill combo.\nCannot be used with Shield Oath.' });
        set(A, 'shieldOath', { mp: 266 });
        A.tincture = Object.assign({}, A.tincture, { name: 'X-Potion of Strength', desc: 'This diluted brew temporarily increases strength.\nStrength +20% (Max 84)\nDuration: 15s' });
      }
      this.actions = A;
      this.statuses = Object.assign({}, this.statuses, {
        fracture: { name: 'Fracture', self: false, icon: 'st_fracture' },
        foresight: { name: 'Foresight', self: true, icon: 'st_foresight' },
        bloodbath: { name: 'Bloodbath', self: true, icon: 'st_bloodbath' },
      });
      // An Alexander: Creator tank set, Heavensward-era stats; main is the Vitality-weighted attack power. No Direct Hit.
      this.stats = { hp: 31000, main: 1400, mainStat: 'str', jobMod: 100, trait: 100, wd: 85, det: 722, crit: 1129, dh: 354, speed: 559, delay: 2.24 };
      this.autoAttack = { potency: 100, delay: 2.24, range: B.MELEE_RANGE };
      // 3.0–3.15: an Alexander: Gordias Savage set (the Gordian Blade: 76 weapon damage, 2.16 delay), plain Strength.
      if (V.early) {
        this.stats = { hp: 19000, main: 1032, mainStat: 'str', jobMod: 100, trait: 100, wd: 76, det: 457, crit: 615, dh: 354, speed: 570, delay: 2.16 };
        this.autoAttack = { potency: 100, delay: 2.16, range: B.MELEE_RANGE };
      }
      if (V.arr) {
        this.level = 50;
        this.levelKey = 'arr50';
        this.maxMp = 2660;
        this.potionCap = 84;
        this.oathPotency = 50;
        this.stats = { hp: 9000, main: 584, mainStat: 'str', jobMod: 100, trait: 100, wd: 58, det: 312, crit: 525, dh: 341, speed: 376, delay: 2.08 };
        this.autoAttack = { potency: 100, delay: 2.08, range: B.MELEE_RANGE };
      }
      this.targetStatusOrder = ['goringBlade', 'circleOfScorn', 'fracture'];
      this.selfStatusOrder = ['swordOath', 'shieldOath', 'fightOrFlight', 'sentinel', 'bulwark', 'hallowedGround', 'rampart', 'foresight', 'bloodbath', 'medicated', 'sprint'];
      this.defaultBars = [
        ['fastBlade', 'savageBlade', 'royalAuthority', 'riotBlade', 'goringBlade', 'rageOfHalone', 'fightOrFlight', 'spiritsWithin', 'circleOfScorn', 'shieldLob', 'tincture', 'fracture'],
        ['swordOath', 'shieldOath', 'shieldBash', 'shieldSwipe', 'sheltron', 'clemency', 'cover', 'sentinel', 'bulwark', 'hallowedGround', 'divineVeil', 'sprint'],
        ['rampart', 'provoke', 'awareness', 'convalescence', 'foresight', 'bloodbath', null, null, null, null, null, null],
      ];
      this.actionGroups = [
        ['Paladin', ['fastBlade', 'savageBlade', 'rageOfHalone', 'riotBlade', 'royalAuthority', 'goringBlade', 'shieldLob', 'shieldBash', 'clemency', 'swordOath',
          'shieldOath', 'fightOrFlight', 'spiritsWithin', 'circleOfScorn', 'shieldSwipe', 'sheltron', 'cover', 'sentinel', 'bulwark', 'hallowedGround', 'divineVeil', 'rampart']],
        ['Cross-class', ['fracture', 'foresight', 'bloodbath', 'provoke', 'awareness', 'convalescence']],
        ['General', ['sprint', 'tincture']],
      ];
      this.referenceDps = V.ref;     // 3.2: a scripted 3.5 rotation parses about 1,890 on the dummy (TP runs low)
      this.referenceGcd = 2.42;
      if (V.arr) {
        this.defaultBars = this.defaultBars.map(r => r.map(x => (x && A[x] ? x : null)));
        this.actionGroups = this.actionGroups.map(([n, ids]) => [n, ids.filter(x => A[x])]);
        this.referenceGcd = 2.46;
      }
    }

    snapshot(a, e) {
      const s = super.snapshot(a, e);
      if (e.has('shieldOath') && this.shieldOathMult !== 0.85) s.mult *= this.shieldOathMult / 0.85;
      return s;
    }

    // Sword Oath's extra hit after each auto-attack (+50 before 3.4, here as a delay-weighted 62).
    onHit(h, r, e) {
      e.g.oath = 0;
      if (!h.auto || h.oathHit || !e.has('swordOath')) return;
      // A Realm Reborn: a flat 50 potency, which weapon delay didn't scale (a weaponskill-formula hit here).
      if (this.V.arr) { e.queueHit('swordOath', this.oathPotency, this.snapshot({}, e), 0.15, null, { oathHit: true }); return; }
      e.queueHit('swordOath', this.oathPotency, this.snapshot({ auto: true }, e), 0.15, null, { auto: true, oathHit: true });
    }

    resolve(id, e) {
      // Before 3.2 changing oaths broke the combo.
      if (this.V.early && (id === 'swordOath' || id === 'shieldOath')) e.combo = null;
      if (id === 'fracture') {
        const a = this.actions[id], snap = this.snapshot(a, e);
        e.queueHit(id, a.potency, snap, a.delay, () => e.addTStatus('fracture', a.dot.duration, { snap, dot: { potency: a.dot.potency, id } }));
        return;
      }
      if (id === 'foresight') { e.addStatus('foresight', 20); return; }
      if (id === 'bloodbath') { e.addStatus('bloodbath', 15); return; }
      super.resolve(id, e);
    }

    proc(id, e) {
      const a = this.actions[id];
      if (a.comboFrom && e.inCombo(a.comboFrom)) return true;
      return false;
    }

    speedInfo(e) { return `GCD ${e.gcdForSpeed(e.stats.speed).toFixed(2)} · ${this.V.arr ? 'A Realm Reborn' : 'Heavensward'}'s formula (no Direct Hit)`; }

    // ---------- Fight or Flight (Heavensward had no job gauge) ----------
    gaugeUpdate(e) {
      super.gaugeUpdate(e);
      const G = this.pg, c = G.cache;
      const left = e.has('fightOrFlight') ? Math.max(0, e.statuses.fightOrFlight.until - e.now) : 0;
      const k = Math.round(left * 4);
      if (c.fof !== k) {
        c.fof = k;
        G.o.setAttribute('width', (250 * Math.min(1, left / 30)).toFixed(1));
        G.t.textContent = left ? Math.ceil(left) + 's' : '';
      }
      const st = e.has('swordOath') ? 'FIGHT OR FLIGHT · SWORD OATH' : e.has('shieldOath') ? 'FIGHT OR FLIGHT · SHIELD OATH' : 'FIGHT OR FLIGHT';
      if (c.l2 !== st) { c.l2 = st; G.lbl.textContent = st; }
    }

    helpHtml(seq) {
      if (this.V.arr) return `
<h3>How it plays (${this.V.label})</h3>
<p>Level 50 Paladin on TP. Stay in <b>Sword Oath</b> (a GCD spell, so set it before the pull: changing oaths breaks your combo): it adds 50 potency to every auto-attack. The loop is <b>Fast Blade → Savage Blade → Rage of Halone</b> (260); Riot Blade (200, 100 TP) only gives MP back. <b>Fight or Flight</b> is +30% physical for 30s every 90s; <b>Spirits Within</b> (300, 30s) and <b>Circle of Scorn</b> (100 + 30 × 15s, 25s) go on cooldown, and Fracture (from Marauder, 100 + 20 × 18s) when TP allows. No Goring Blade or Royal Authority until Heavensward.</p>
<p>TP is the limit: 190 TP a combo against +60 a tick, and Paladin has no Invigorate, so after about two and a half minutes you wait on TP.</p>
<h3>An opener (constructed: no ARR Paladin guide survives)</h3>
${seq(['fastBlade', ['fightOrFlight'], 'savageBlade', ['tincture'], 'rageOfHalone', ['circleOfScorn'], 'fracture', ['spiritsWithin'], 'fastBlade', 'savageBlade', 'rageOfHalone', 'fastBlade', 'savageBlade', ['circleOfScorn'], 'rageOfHalone'])}
<p style="color:#a9a3b4">The numbers: Fast Blade 150 (70 TP), Savage Blade combo 200 (60), Rage of Halone combo 260 (60), Riot Blade combo 200 (100), Spirits Within 300, Circle of Scorn 100 + 30 × 15s, Fracture 100 + 20 × 18s (80), Shield Lob 120, Sword Oath +50 an auto-attack, Fight or Flight +30%, Shield Oath −20%. ARR's formula here is a refit of the 2013–14 community formulas. Gear: a 2015 Final Coil tank set with the Dreadwyrm Blade (Strength 584, 58 weapon damage, 2.08 delay) and the X-Potion of Strength (max 84).</p>`;
      return `
<h3>How it plays (${this.V.label})</h3>
<p>Level 60 Paladin on TP. Stay in <b>Sword Oath</b>: every auto-attack is followed by a 75-potency hit (Shield Oath, the tank stance, is −15% damage). Two combos: <b>Fast Blade → Riot Blade</b> (MP back) <b>→ Goring Blade</b> (240 + 50 a tick for 24s) whenever its DoT runs low, and <b>Fast Blade → Savage Blade → Royal Authority</b> (350) otherwise. <b>Fight or Flight</b> is +30% physical for 30s every 90s; <b>Spirits Within</b> (300, 30s) and <b>Circle of Scorn</b> (100 + 30 × 15s, 25s) go on cooldown. No Holy Spirit, Requiescat or Oath Gauge until 4.0.</p>
<h3>The opener (the FFXIV wiki's 3.x Paladin list)</h3>
${seq(['fastBlade', ['tincture'], 'riotBlade', ['fightOrFlight'], 'goringBlade', ['circleOfScorn'], ['spiritsWithin'], 'fastBlade', 'savageBlade', 'royalAuthority', 'fastBlade', 'savageBlade', 'royalAuthority', 'fastBlade', 'riotBlade', 'goringBlade'])}
<p>Sword Oath before the pull.</p>${this.V.early ? `<p><b>${this.V.label}:</b> damage comes from plain Strength (Vitality joined it in 3.2), Sword Oath adds 50 to each auto-attack whatever the weapon's delay, Goring Blade is 220 + 40 × 24s (${this.V.goringTp} TP), Royal Authority 340, Fast Blade 70 TP, Shield Oath −20%, and swapping oaths breaks your combo. Gear: an Alexander: Gordias Savage set (Strength 1,032, the Gordian Blade: 76 weapon damage, 2.16 delay) with the Draconian Potion of Strength (max 105). The 3.57 numbers below apply otherwise.</p>` : ''}
<p style="color:#a9a3b4">The 3.57 numbers: Fast Blade 150, Savage Blade combo 200, Royal Authority combo 350, Rage of Halone combo 260, Riot Blade combo 230, Goring Blade combo 240 + 50 × 24s, Spirits Within 300, Circle of Scorn 100 + 30 × 15s, Sword Oath 75 an auto-attack, Fight or Flight +30%. The tank attack power from 3.2 (Vitality as well as Strength) isn't published; the main stat here (1,400) is a rough stand-in. Heavensward's formula is the community fit. Gear: an Alexander: Creator set (85 weapon damage, 2.24 delay) with the Supramax-Potion of Strength.</p>`;
    }
  }

  B.registerJob({
    id: 'pld', name: 'Paladin', abbr: 'PLD', role: 'tank', classJob: 19,
    versions: [...['hw31', 'hw30', 'arr20'].map(v => ({ id: v, label: VERSIONS[v].label, history: VERSIONS[v].history, note: VERSIONS[v].note, create: () => new PaladinHW(v) })),
      { id: 'hw32', label: 'Heavensward 3.2–3.57', history: 'HW 3.2–3.57', note: 'Level 60 on TP: Sword Oath\'s extra hits, Royal Authority from Savage Blade, Goring Blade, Fight or Flight +30% for 30s; no Holy Spirit or Requiescat; Creator gear', create: () => new PaladinHW() }],
  });
})(window.BLM);
