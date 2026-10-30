// Paladin, Stormblood 4.05–4.58 at level 70. Weaponskills on TP, spells on a small MP pool (7,080, with no Piety on
// tank gear; Divine Magic Mastery halves spell costs). Sword Oath (the damage stance) adds a 75-potency hit to every
// auto-attack and fills the Oath Gauge (+5 an auto, for Sheltron and Intervention); Shield Oath is −15% damage.
// Fast Blade → Riot Blade (combo restores MP) → Royal Authority (360) or Goring Blade (250 + 60 × 21s); Fight or Flight
// (+25% physical, 25s every 60s) for the weaponskill burst, Requiescat (350 at full MP; at 80% MP or more, +20% magic for
// 12s) for five Holy Spirits (380, a 1.5s cast on a 2.5s recast that Skill Speed doesn't touch). The two buffs don't
// mix: Fight or Flight is physical only, Requiescat magic only. Spirits Within (300) and Circle of Scorn (100 + 30 × 15s)
// in between. The 4.2–4.58 numbers (4.05–4.18 had Holy Spirit at 400 and Shield Swipe at 150; Shield Swipe needs a
// blocked attack, so a dummy never allows it). Numbers are the game data at 4.11–4.58 (xivapi's datamining) and the
// Lodestone notes; Riot Blade's MP (720) and Requiescat's fall-off with MP are estimates. Gear is The Balance's 4.4
// "Poorboye" set at 2.43, pre-6.0 stats from the 4.58 Item.csv.
(function (B) {
  const EPS = 1e-6;
  const MAX_MP = 7080;     // 12,000 × Paladin's 59%
  const ws = (o) => Object.assign({ kind: 'gcd', target: true, range: B.MELEE_RANGE, delay: 0.55, fx: 'gnbSlash' }, o);
  const ab = (o) => Object.assign({ kind: 'ogcd' }, o);
  const spell = (o) => Object.assign({ kind: 'gcd', magic: true, fixedRecast: 2.5, school: 'holy', sound: 'paradox' }, o);
  const ACTIONS = {
    fastBlade: ws({ name: 'Fast Blade', potency: 160, tp: 60, comboStart: true, comboNext: true, desc: 'Delivers an attack with a potency of 160.' }),
    savageBlade: ws({ name: 'Savage Blade', potency: 100, comboPotency: 210, comboFrom: 'fastBlade', comboNext: true, tp: 60, desc: 'Delivers an attack with a potency of 100.\nCombo Action: Fast Blade\nCombo Potency: 210\nCombo Bonus: Increased enmity' }),
    rageOfHalone: ws({ name: 'Rage of Halone', potency: 100, comboPotency: 270, comboFrom: 'savageBlade', tp: 60, fx: 'gnbBurst', desc: 'Delivers an attack with a potency of 100.\nCombo Action: Savage Blade\nCombo Potency: 270\nCombo Bonus: Reduces target\'s strength\nCombo Bonus: Increased enmity' }),
    riotBlade: ws({ name: 'Riot Blade', potency: 100, comboPotency: 240, comboFrom: 'fastBlade', comboNext: true, tp: 60, mpGain: 720, fx: 'gnbSlash2', desc: 'Delivers an attack with a potency of 100.\nCombo Action: Fast Blade\nCombo Potency: 240\nCombo Bonus: Restores MP\nCombo Bonus: Silence\nDuration: 1s' }),
    royalAuthority: ws({ name: 'Royal Authority', potency: 100, comboPotency: 360, comboFrom: 'riotBlade', tp: 60, fx: 'gnbBurst', desc: 'Delivers an attack with a potency of 100.\nCombo Action: Riot Blade\nCombo Potency: 360' }),
    goringBlade: ws({ name: 'Goring Blade', potency: 100, comboPotency: 250, comboFrom: 'riotBlade', tp: 50, dot: { potency: 60, duration: 21 }, fx: 'gnbDouble', desc: 'Delivers an attack with a potency of 100.\nCombo Action: Riot Blade\nCombo Potency: 250\nCombo Bonus: Damage over time\nPotency: 60\nDuration: 21s' }),
    totalEclipse: ws({ name: 'Total Eclipse', potency: 110, tp: 110, target: false, pbaoe: 5, aoe: true, breaksCombo: true, fx: 'gnbBow', desc: 'Delivers an attack with a potency of 110 to all nearby enemies.' }),
    shieldLob: ws({ name: 'Shield Lob', potency: 120, tp: 120, range: 15, breaksCombo: true, delay: 0.7, fx: 'enpi', desc: 'Delivers a ranged attack with a potency of 120.\nAdditional Effect: Increased enmity' }),
    shieldBash: ws({ name: 'Shield Bash', potency: 110, tp: 120, breaksCombo: true, desc: 'Delivers an attack with a potency of 110.\nAdditional Effect: Stun\nDuration: 6s' }),
    holySpirit: spell({ name: 'Holy Spirit', potency: 380, cast: 1.5, mp: 1440, target: true, range: 25, delay: 0.7, fx: 'gnbZone', desc: 'Deals unaspected damage with a potency of 380.\nShield Oath Bonus: Increases Oath Gauge by 20' }),
    clemency: spell({ name: 'Clemency', cast: 1.5, mp: 1440, desc: 'Restores target\'s HP.\nCure Potency: 1,200' }),
    swordOath: spell({ name: 'Sword Oath', mp: 600, magic: false, desc: 'Each auto-attack is followed by an extra attack with a potency of 75.\nOath Mastery: auto-attacks add 5 to the Oath Gauge.\nCannot be used with Shield Oath.' }),
    shieldOath: spell({ name: 'Shield Oath', mp: 600, magic: false, desc: 'Reduces damage taken by 20%, while reducing damage dealt by 15% and increasing enmity.\nCannot be used with Sword Oath.' }),
    // Off the GCD.
    fightOrFlight: ab({ name: 'Fight or Flight', recast: 60, desc: 'Increases physical damage dealt by 25%.\nDuration: 25s' }),
    requiescat: ab({ name: 'Requiescat', recast: 60, potency: 350, target: true, range: 3, delay: 0.6, fx: 'gnbBurst', desc: 'Delivers an attack with a potency of 350.\nPotency decreases as MP falls.\nAdditional Effect: If MP is 80% or more, increases magic damage dealt by 20%\nDuration: 12s' }),
    spiritsWithin: ab({ name: 'Spirits Within', recast: 30, potency: 300, target: true, range: B.MELEE_RANGE, delay: 0.6, fx: 'gnbCont', desc: 'Delivers an attack with a potency of 300.\nPotency decreases as HP falls.' }),
    circleOfScorn: ab({ name: 'Circle of Scorn', recast: 25, potency: 100, target: false, pbaoe: 5, aoe: true, dot: { potency: 30, duration: 15, aoe: true }, delay: 0.5, fx: 'gnbBow', desc: 'Delivers an attack with a potency of 100 to all nearby enemies.\nAdditional Effect: Damage over time\nPotency: 30\nDuration: 15s' }),
    shieldSwipe: ab({ name: 'Shield Swipe', recast: 15, potency: 100, target: true, range: B.MELEE_RANGE, desc: 'Delivers an attack with a potency of 100.\nCan only be executed immediately after blocking an attack.\nAdditional Effect: Pacification\nDuration: 6s' }),
    sheltron: ab({ name: 'Sheltron', recast: 5, oath: 50, desc: 'Block the next attack.\nOath Gauge Cost: 50' }),
    intervention: ab({ name: 'Intervention', recast: 10, oath: 50, desc: 'Reduces target party member\'s damage taken by 10%.\nOath Gauge Cost: 50' }),
    cover: ab({ name: 'Cover', recast: 120, desc: 'Take all damage intended for another party member.\nDuration: 12s' }),
    sentinel: ab({ name: 'Sentinel', recast: 150, desc: 'Reduces damage taken by 40%.\nDuration: 10s' }),
    bulwark: ab({ name: 'Bulwark', recast: 180, desc: 'Increases block rate to 100%.\nDuration: 15s' }),
    hallowedGround: ab({ name: 'Hallowed Ground', recast: 420, desc: 'Renders you impervious to most attacks.\nDuration: 10s' }),
    divineVeil: ab({ name: 'Divine Veil', recast: 120, desc: 'Upon HP recovery via healing magic, erects a barrier around you and nearby party members.\nDuration: 30s' }),
    passageOfArms: ab({ name: 'Passage of Arms', recast: 120, desc: 'Increases block rate to 100% and creates a designated area behind you in which party members take 15% less damage.\nDuration: 18s' }),
    // Stormblood's tank role actions (none adds damage).
    rampart: ab({ name: 'Rampart', recast: 90, role: true, desc: 'Reduces damage taken by 20%.\nDuration: 20s' }),
    lowBlow: ab({ name: 'Low Blow', recast: 25, role: true, target: true, range: 3, desc: 'Stuns target.\nDuration: 5s' }),
    provoke: ab({ name: 'Provoke', recast: 40, role: true, target: true, range: 25, desc: 'Gesture threateningly, placing yourself at the top of a target\'s enmity list.' }),
    convalescence: ab({ name: 'Convalescence', recast: 120, role: true, desc: 'Increases HP recovery via healing actions by 20%.\nDuration: 20s' }),
    anticipation: ab({ name: 'Anticipation', recast: 60, role: true, desc: 'Increases parry rate by 30%.\nDuration: 20s' }),
    reprisal: ab({ name: 'Reprisal', recast: 60, role: true, target: true, range: 3, desc: 'Reduces target\'s damage dealt by 10%.\nDuration: 5s' }),
    awareness: ab({ name: 'Awareness', recast: 120, role: true, desc: 'Nullifies the chance of suffering critical damage.\nDuration: 25s' }),
    interject: ab({ name: 'Interject', recast: 30, role: true, target: true, range: 3, desc: 'Interrupts the use of a target\'s action.' }),
    ultimatum: ab({ name: 'Ultimatum', recast: 90, role: true, desc: 'Draws aggression from nearby enemies.' }),
    shirk: ab({ name: 'Shirk', recast: 120, role: true, desc: 'Diverts 25% of enmity to a party member.' }),
    ...B.GENERAL_ACTIONS,
    tincture: B.tincture('str3sb'),
    auto: { name: 'Attack', kind: 'auto', fx: 'auto', desc: 'Auto-attack.' },
  };

  const STATUSES = {
    swordOath: { name: 'Sword Oath', self: true, icon: 'st_swordoath' },
    shieldOath: { name: 'Shield Oath', self: true, icon: 'st_shieldoath' },
    fightOrFlight: { name: 'Fight or Flight', self: true, icon: 'st_fof' },
    requiescat: { name: 'Requiescat', self: true, icon: 'st_req' },
    sentinel: { name: 'Sentinel', self: true, icon: 'st_sentinel' },
    bulwark: { name: 'Bulwark', self: true, icon: 'st_bulwark' },
    hallowedGround: { name: 'Hallowed Ground', self: true, icon: 'st_hg' },
    rampart: { name: 'Rampart', self: true, icon: 'st_rampart' },
    goringBlade: { name: 'Goring Blade', self: false, icon: 'st_goring' },
    circleOfScorn: { name: 'Circle of Scorn', self: false, icon: 'st_cos' },
  };

  class PaladinSB {
    constructor() {
      this.name = 'Paladin';
      this.abbr = 'PLD';
      this.role = 'tank';
      this.level = 70;
      this.levelKey = 'sb70';
      this.model = 'pld-sb';
      this.maxMp = MAX_MP;
      this.actions = ACTIONS;
      this.statuses = STATUSES;
      this.tp = { max: 1000, regen: 60 };
      this.comboTime = 10;
      // The Balance's 4.4 "Poorboye" set (Ariyala 17C5Q) at 2.43: the Omega Sword (109 weapon damage, 2.24 delay).
      // Paladin's Strength modifier is 100; Tenacity raises a tank's damage.
      this.stats = { hp: 76521, main: 2674, mainStat: 'str', jobMod: 100, trait: 100, wd: 109, det: 1653, crit: 2351, dh: 738,
        speed: 846, ten: 1064, delay: 2.24 };
      this.speedName = 'Skill speed';
      this.tierHaste = 0;
      this.autoAttack = { potency: 110, delay: 2.24, range: B.MELEE_RANGE };
      this.selfStatusOrder = ['swordOath', 'shieldOath', 'fightOrFlight', 'requiescat', 'sentinel', 'bulwark', 'hallowedGround', 'rampart', 'medicated', 'sprint'];
      this.targetStatusOrder = ['goringBlade', 'circleOfScorn'];
      this.defaultBars = [
        ['fastBlade', 'riotBlade', 'royalAuthority', 'goringBlade', 'holySpirit', 'fightOrFlight', 'requiescat', 'spiritsWithin', 'circleOfScorn', 'shieldLob', 'tincture', 'sprint'],
        ['savageBlade', 'rageOfHalone', 'totalEclipse', 'shieldBash', 'shieldSwipe', 'swordOath', 'shieldOath', 'sheltron', 'intervention', 'clemency', 'cover', 'passageOfArms'],
        ['sentinel', 'bulwark', 'hallowedGround', 'divineVeil', 'rampart', 'reprisal', 'convalescence', 'anticipation', 'awareness', 'lowBlow', 'provoke', 'interject'],
      ];
      this.actionGroups = [
        ['Paladin', ['fastBlade', 'savageBlade', 'rageOfHalone', 'riotBlade', 'royalAuthority', 'goringBlade', 'totalEclipse', 'shieldLob', 'shieldBash',
          'holySpirit', 'clemency', 'swordOath', 'shieldOath', 'fightOrFlight', 'requiescat', 'spiritsWithin', 'circleOfScorn', 'shieldSwipe', 'sheltron',
          'intervention', 'cover', 'sentinel', 'bulwark', 'hallowedGround', 'divineVeil', 'passageOfArms']],
        ['Role Actions', ['rampart', 'lowBlow', 'provoke', 'convalescence', 'anticipation', 'reprisal', 'awareness', 'interject', 'ultimatum', 'shirk']],
        ['General', ['sprint', 'tincture']],
      ];
      this.referenceDps = 4400;     // a scripted 4.5 rotation parses about 4,150 on the dummy
      this.referenceGcd = 2.43;
      this.startDistance = 3.2;
    }

    initGauge(e) {
      e.addStatus('swordOath', 1e9, { permanent: true });
      return { oath: 0 };
    }

    check(id, e) {
      const a = this.actions[id];
      if (id === 'shieldSwipe') return 'Unable to execute action. Requires a blocked attack.';
      if (a.oath && e.g.oath < a.oath) return 'Not enough Oath Gauge.';
      if (id === 'swordOath' && e.has('swordOath')) return 'Sword Oath is already active.';
      if (id === 'shieldOath' && e.has('shieldOath')) return 'Shield Oath is already active.';
      return null;
    }

    // Holy Spirit's 1.5s cast isn't shortened by Skill Speed.
    castTime(id) { return this.actions[id].cast || 0; }
    mpCost(id) { return this.actions[id].mp || 0; }

    snapshot(a, e) {
      let mult = 1;
      const magic = a && a.magic;
      if (e.has('shieldOath')) mult *= 0.85;
      if (!magic && e.has('fightOrFlight')) mult *= this.fofMult || 1.25;
      if (magic && e.has('requiescat')) mult *= 1.20;
      const main = this.stats.main + (e.has('medicated') ? (this.potionCap || B.TINCTURES.str3sb.cap) : 0);
      return { mult, main };
    }

    resolve(id, e) {
      const a = this.actions[id], g = e.g;
      if (a.mp) e.mp -= a.mp;
      if (a.oath) g.oath -= a.oath;
      if (a.kind === 'gcd' && !a.magic && a.potency) { this.weaponskill(id, e); return; }
      switch (id) {
        case 'holySpirit': e.queueHit(id, a.potency, this.snapshot(a, e), a.delay); return;
        case 'swordOath': case 'shieldOath':
          e.removeStatus(id === 'swordOath' ? 'shieldOath' : 'swordOath', true);
          e.addStatus(id, 1e9, { permanent: true });
          return;
        case 'fightOrFlight': e.addStatus('fightOrFlight', this.fofDur || 25); return;
        case 'requiescat': {
          const frac = e.mp / e.maxMp;
          if (frac >= 0.8 - EPS) e.addStatus('requiescat', 12);
          e.queueHit(id, Math.round(a.potency * Math.min(1, frac)), this.snapshot(a, e), a.delay);
          return;
        }
        case 'circleOfScorn': {
          const snap = this.snapshot(a, e);
          e.queueHit(id, a.potency, snap, a.delay, () => e.addTStatus('circleOfScorn', a.dot.duration, { snap, dot: { potency: a.dot.potency, id } }));
          return;
        }
        case 'sentinel': e.addStatus('sentinel', 10); return;
        case 'bulwark': e.addStatus('bulwark', 15); return;
        case 'hallowedGround': e.addStatus('hallowedGround', 10); return;
        case 'rampart': e.addStatus('rampart', 20); return;
        default:
          if (B.ROLE_EFFECTS[id]) { B.ROLE_EFFECTS[id](e); return; }
      }
      if (a.potency) e.queueHit(id, a.potency, this.snapshot(a, e), a.delay);
    }

    weaponskill(id, e) {
      const a = this.actions[id];
      const combo = !!a.comboFrom && e.lastComboHit;
      const potency = combo ? a.comboPotency : a.potency;
      const snap = this.snapshot(a, e);
      if (combo && a.mpGain) {
        const before = e.mp;
        e.mp = Math.min(e.maxMp, e.mp + a.mpGain);
        if (e.mp > before) e.emit('mpGain', { amount: e.mp - before, source: 'lucid' });
      }
      const after = a.dot && combo ? () => e.addTStatus(id, a.dot.duration, { snap, dot: { potency: a.dot.potency, id } }) : null;
      e.queueHit(id, potency, snap, a.delay, after);
    }

    // Sword Oath: each auto-attack is followed by a 75-potency hit, and adds 5 to the Oath Gauge.
    onHit(h, r, e) {
      if (!h.auto || h.oathHit || !e.has('swordOath')) return;
      e.g.oath = Math.min(100, e.g.oath + 5);
      e.queueHit('swordOath', 75, this.snapshot({ auto: true }, e), 0.15, null, { auto: true, oathHit: true });
    }

    proc(id, e) {
      const a = this.actions[id];
      if (a.comboFrom && e.inCombo(a.comboFrom)) return true;
      if (id === 'requiescat') return e.mp >= e.maxMp * 0.8;
      return false;
    }

    mpRegen(e) { return Math.round(e.maxMp * 0.02); }
    speedInfo(e) { return `GCD ${e.gcdForSpeed(e.stats.speed).toFixed(2)} · Holy Spirit a fixed 1.5s cast on 2.5s · ${e.maxMp.toLocaleString()} MP`; }

    // ---------- the Oath Gauge ----------
    gaugeBuild(root) {
      root.innerHTML = `
<svg width="360" height="100" viewBox="0 0 360 100">
  <rect x="8" y="10" width="344" height="80" rx="14" fill="rgba(14,12,20,.86)" stroke="rgba(255,255,255,.22)"/>
  <text id="pl-lbl" x="24" y="38" font-family="Noto Sans, sans-serif" font-size="11" font-weight="600" fill="#a9a3b4" letter-spacing="1">OATH GAUGE</text>
  <rect x="24" y="52" width="250" height="14" rx="7" fill="#2a2535" stroke="rgba(0,0,0,.8)"/>
  <rect id="pl-o" x="24" y="52" width="0" height="14" rx="7" fill="#7fb6ff"/>
  <line x1="149" y1="48" x2="149" y2="70" stroke="rgba(255,255,255,.35)"/>
  <text id="pl-t" x="336" y="66" text-anchor="end" font-family="Saira Semi Condensed, sans-serif" font-size="18" font-weight="700" fill="#fff" stroke="#000" stroke-width="3" paint-order="stroke">0</text>
</svg>`;
      const $ = (s) => root.querySelector(s);
      this.pg = { lbl: $('#pl-lbl'), o: $('#pl-o'), t: $('#pl-t'), cache: {} };
    }

    gaugeUpdate(e) {
      const G = this.pg, c = G.cache, g = e.g;
      const put = (k, v, fn) => { if (c[k] !== v) { c[k] = v; fn(v); } };
      put('o', g.oath, v => { G.o.setAttribute('width', String(250 * v / 100)); G.t.textContent = String(v); });
      const st = e.has('swordOath') ? 'OATH GAUGE · SWORD OATH' : e.has('shieldOath') ? 'OATH GAUGE · SHIELD OATH' : 'OATH GAUGE · NO OATH';
      put('l', st, v => { G.lbl.textContent = v; });
    }

    helpHtml(seq) {
      return `
<h3>How it plays (Stormblood 4.05–4.58)</h3>
<p>Level 70 Paladin: weaponskills on TP, spells on 7,080 MP. Stay in <b>Sword Oath</b>: every auto-attack is followed by a 75-potency hit (Shield Oath, the tank stance, is −15%). The combo is <b>Fast Blade → Riot Blade</b> (MP back) → <b>Royal Authority</b> (360), and every third combo <b>Goring Blade</b> (250 + 60 a tick for 21s) instead to keep its DoT up.</p>
<p>The two minute-long buffs take turns. <b>Fight or Flight</b> (+25% physical, 25s) covers about ten weaponskills, Spirits Within (300) and Circle of Scorn (100 + 30 × 15s). <b>Requiescat</b> (350 at full MP; at 80% MP or more, +20% magic for 12s) covers five <b>Holy Spirits</b> (380, a 1.5s cast that Skill Speed doesn't shorten), which spend most of the MP the Riot Blades gave back. Fight or Flight does nothing for Holy Spirit and Requiescat nothing for weaponskills, so don't overlap them.</p>
<h3>The opener (The Balance's 4.5 Fight or Flight opener)</h3>
${seq(['fastBlade', 'riotBlade', ['fightOrFlight'], 'goringBlade', ['circleOfScorn'], 'fastBlade', 'riotBlade', ['tincture'], 'royalAuthority', ['spiritsWithin'], 'fastBlade', 'riotBlade', 'royalAuthority', 'fastBlade', 'riotBlade', 'goringBlade', ['requiescat'], 'holySpirit', ['circleOfScorn'], 'holySpirit', 'holySpirit', 'holySpirit', 'holySpirit', 'fastBlade', 'riotBlade', ['spiritsWithin'], 'goringBlade'])}
<p>Sword Oath before the pull. The guide also fits Shield Swipe after the first Goring Blade (it needs a blocked attack, which a dummy never makes).</p>
<p style="color:#a9a3b4">The 4.2–4.58 numbers: Fast Blade 160, Riot Blade combo 240, Royal Authority combo 360, Goring Blade combo 250 + 60 × 21s, Savage Blade combo 210, Rage of Halone combo 270, Holy Spirit 380 (400 before 4.2), Requiescat 350, Spirits Within 300, Circle of Scorn 100 + 30 × 15s, Sword Oath 75 an auto-attack. Riot Blade's MP (720 here) isn't in the data, and how Requiescat falls with MP isn't published (here in proportion). Gear: The Balance's 4.4 2.43 set (Strength 2,674, Tenacity 1,064, 109 weapon damage) with the Grade 3 Infusion.</p>`;
    }
  }

  B.PaladinSB = PaladinSB;
  B.registerJob({
    id: 'pld', name: 'Paladin', abbr: 'PLD', role: 'tank', classJob: 19,
    versions: [{ id: 'sb405', label: 'Stormblood 4.05–4.58', history: 'SB 4.05–4.58', note: 'Level 70 on TP and a small MP pool: Sword Oath\'s extra hits, Royal Authority and Goring Blade, Fight or Flight for weaponskills, Requiescat for five Holy Spirits; the 4.2 numbers and Alphascape gear', create: () => new PaladinSB() }],
  });
})(window.BLM);
