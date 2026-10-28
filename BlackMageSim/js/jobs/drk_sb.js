// Dark Knight, Stormblood at level 70, in three versions. Weaponskills on TP and everything else on 9,480 MP (12,000 ×
// Dark Knight's 79%, no Piety on tank gear) that doesn't come back by itself: Darkside (+20% damage, every hit) stops MP
// regeneration in combat. Hard Slash → Syphon Strike (+1,200 MP) → Souleater (+10 Blood); Dark Arts (2,400 MP, 10s)
// strengthens the next action it applies to: Carve and Spit 450 (+350, the best use), Souleater 440, Syphon Strike 390,
// Bloodspiller 540, Dark Passenger. Blood Weapon (40s, 15s) is 10% haste, and every physical hit under it (auto-attacks
// too) gives 480 MP and 3 Blood; Delirium (50 Blood) adds 8s to it and 2,400 MP. Bloodspiller (400) spends 50 Blood.
// Salted Earth is a 21s ground DoT, Plunge and Carve and Spit (60s; 1,200 MP without Dark Arts) oGCDs.
//  - 4.0–4.18: Delirium 120s; Dark Passenger 100 (240 with Dark Arts) every 30s. The 4.05+ numbers (Bloodspiller and
//    Souleater were 20 lower in 4.0–4.01).
//  - 4.2–4.25: Delirium 80s; The Blackest Night 7s.
//  - 4.3–4.58: Dark Arts also strengthens Power Slash (440 combo) and Plunge (340); Dark Passenger 140 (280) every 60s.
// Numbers are the game data at 4.11–4.58 (xivapi's datamining), the Lodestone notes and xivanalysis's 2019 Dark Knight
// resource model (MP and Blood gains); no Stormblood Dark Knight opener survives, so the one here is reconstructed.
// Gear: rough Deltascape / Sigmascape / Alphascape tank sets (pre-6.0 stats, the 4.58 Item.csv).
(function (B) {
  const EPS = 1e-6;
  const MAX_MP = 9480;
  // ref: a scripted bot parses about 3,970 / 3,370 / 2,840 in these three over 5 minutes.
  const VERSIONS = {
    sb43: { label: 'Stormblood 4.3–4.58', history: 'SB 4.3–4.58', delirium: 80, tbn: 7, da43: true, passenger: [140, 280, 60], grit: 1200, ref: 4210,
      stats: { hp: 76521, main: 2688, wd: 109, det: 1760, crit: 2239, dh: 738, speed: 846, ten: 1064 }, tincture: 'str3sb',
      gear: 'The Balance\'s 4.4 Paladin set with the Omega Claymore (Strength 2,688, 109 weapon damage)',
      note: 'Level 70: Dark Arts also on Power Slash and Plunge, Dark Passenger 140 every 60s, Delirium 80s; Alphascape gear' },
    sb42: { label: 'Stormblood 4.2–4.25', history: 'SB 4.2–4.25', delirium: 80, tbn: 7, da43: false, passenger: [100, 240, 30], grit: 1800, ref: 3570,
      stats: { hp: 65793, main: 2395, wd: 105, det: 1579, crit: 1568, dh: 738, speed: 1233, ten: 946 }, tincture: 'str2sb',
      gear: 'a rough Sigmascape Savage set (Strength 2,395, 105 weapon damage)',
      note: 'Level 70: Delirium every 80s, The Blackest Night 7s; Sigmascape gear' },
    sb40: { label: 'Stormblood 4.0–4.18', history: 'SB 4.0–4.18', delirium: 120, tbn: 5, da43: false, passenger: [100, 240, 30], grit: 1800, ref: 3010,
      stats: { hp: 52850, main: 2132, wd: 100, det: 1648, crit: 950, dh: 1222, speed: 699, ten: 1360 }, tincture: 'str1sb',
      gear: 'the 4.0/4.1 Warrior guide\'s 2.44 Genji set with the Genji Nagamaki (Strength 2,132, 100 weapon damage)',
      note: 'Level 70, the launch: the Blood Gauge into Bloodspiller and Delirium, Dark Arts, Blood Weapon for MP, The Blackest Night; Deltascape gear' },
  };
  const ws = (o) => Object.assign({ kind: 'gcd', target: true, range: B.MELEE_RANGE, delay: 0.55, fx: 'gnbSlash' }, o);
  const spell = (o) => Object.assign({ kind: 'gcd', magic: true, target: true, range: 15, delay: 0.7, breaksCombo: true, fx: 'gnbZone' }, o);
  const ab = (o) => Object.assign({ kind: 'ogcd' }, o);

  function buildActions(V) {
    const [dp, dpDa, dpRecast] = V.passenger;
    return {
      hardSlash: ws({ name: 'Hard Slash', potency: 150, tp: 60, comboStart: true, comboNext: true, desc: 'Delivers an attack with a potency of 150.' }),
      syphonStrike: ws({ name: 'Syphon Strike', potency: 100, comboPotency: 250, daPotency: 240, daComboPotency: 390, comboFrom: 'hardSlash', comboNext: true, tp: 60, mpGain: 1200, fx: 'gnbSlash2', desc: 'Delivers an attack with a potency of 100.\nCombo Action: Hard Slash\nCombo Potency: 250\nCombo Bonus: Restores 1,200 MP\nDark Arts Potency: 240\nDark Arts Combo Potency: 390' }),
      souleater: ws({ name: 'Souleater', potency: 100, comboPotency: 300, daPotency: 240, daComboPotency: 440, comboFrom: 'syphonStrike', tp: 50, blood: 10, fx: 'gnbBurst', desc: 'Delivers an attack with a potency of 100.\nCombo Action: Syphon Strike\nCombo Potency: 300\nCombo Bonus: Absorbs a portion of damage dealt as HP\nCombo Bonus: Increases Blood Gauge by 10\nDark Arts Potency: 240\nDark Arts Combo Potency: 440' }),
      spinningSlash: ws({ name: 'Spinning Slash', potency: 100, comboPotency: 220, comboFrom: 'hardSlash', comboNext: true, tp: 60, fx: 'gnbSlash2', desc: 'Delivers an attack with a potency of 100.\nCombo Action: Hard Slash\nCombo Potency: 220\nCombo Bonus: Increased enmity' }),
      powerSlash: ws(Object.assign({ name: 'Power Slash', potency: 100, comboPotency: 300, comboFrom: 'spinningSlash', tp: 60, fx: 'gnbBurst', desc: `Delivers an attack with a potency of 100.\nCombo Action: Spinning Slash\nCombo Potency: 300\nCombo Bonus: Reduces target's HP recovery via healing${V.da43 ? '\nDark Arts Potency: 240\nDark Arts Combo Potency: 440' : ''}` }, V.da43 ? { daPotency: 240, daComboPotency: 440 } : {})),
      bloodspiller: ws({ name: 'Bloodspiller', potency: 400, daPotency: 540, cost: 50, fx: 'gnbDouble', desc: 'Delivers an attack with a potency of 400.\nBlood Gauge Cost: 50\nDark Arts Potency: 540' }),
      quietus: ws({ name: 'Quietus', potency: 160, daPotency: 210, cost: 50, target: false, pbaoe: 5, aoe: true, fx: 'gnbBow', desc: 'Delivers an attack with a potency of 160 to all nearby enemies.\nAdditional Effect: Restores 480 MP for each enemy hit\nBlood Gauge Cost: 50\nDark Arts Potency: 210' }),
      unleash: spell({ name: 'Unleash', potency: 50, mp: 1080, target: false, pbaoe: 5, aoe: true, desc: 'Deals unaspected damage with a potency of 50 to all nearby enemies.\nAdditional Effect: Increased enmity' }),
      unmend: spell({ name: 'Unmend', potency: 150, mp: 480, desc: 'Deals unaspected damage with a potency of 150.\nAdditional Effect: Increased enmity' }),
      abyssalDrain: spell({ name: 'Abyssal Drain', potency: 120, mp: 1320, aoe: true, desc: 'Deals unaspected damage with a potency of 120 to target and all enemies nearby it.\nDark Arts Effect: Absorbs a portion of damage dealt as HP' }),
      // Off the GCD.
      darkside: ab({ name: 'Darkside', recast: 5, mp: 600, desc: 'Increases damage dealt by 20%.\nWhile in combat, MP does not regenerate.\nEffect ends upon reuse.' }),
      grit: ab({ name: 'Grit', recast: 2.5, mp: V.grit, desc: 'Reduces damage taken by 20% and damage dealt by 20% while increasing enmity.\nEffect ends upon reuse.' }),
      darkArts: ab({ name: 'Dark Arts', recast: 2, mp: 2400, desc: 'Strengthens the next Syphon Strike, Souleater, Bloodspiller, Quietus, Carve and Spit, Dark Passenger or Abyssal Drain' + (V.da43 ? ', Power Slash or Plunge' : '') + '.\nDuration: 10s' }),
      bloodWeapon: ab({ name: 'Blood Weapon', recast: 40, desc: 'Reduces weaponskill and spell recast time and auto-attack delay by 10%, and TP cost by 20%.\nAdditional Effect: Each physical attack restores 480 MP and adds 3 to the Blood Gauge\nDuration: 15s' }),
      delirium: ab({ name: 'Delirium', recast: V.delirium, cost: 50, desc: 'Restores 2,400 MP and extends Blood Weapon by 8s.\nBlood Gauge Cost: 50' }),
      saltedEarth: ab({ name: 'Salted Earth', recast: 45, target: true, range: 15, magic: true, dot: { potency: 75, duration: 21, aoe: true }, desc: 'Creates a patch of salted earth, dealing unaspected damage with a potency of 75 to any enemies who enter.\nDuration: 21s' }),
      plunge: ab(Object.assign({ name: 'Plunge', recast: 30, potency: 200, target: true, range: 20, delay: 0.4, fx: 'gnbCont', desc: `Delivers a jumping attack with a potency of 200.${V.da43 ? '\nDark Arts Potency: 340' : ''}` }, V.da43 ? { daPotency: 340 } : {})),
      carveAndSpit: ab({ name: 'Carve and Spit', recast: 60, potency: 100, daPotency: 450, target: true, range: B.MELEE_RANGE, delay: 0.6, fx: 'gnbDouble', desc: 'Delivers a threefold attack with a potency of 100.\nAdditional Effect: Restores 1,200 MP\nDark Arts Potency: 450 (no MP)' }),
      darkPassenger: ab({ name: 'Dark Passenger', recast: dpRecast, mp: 2400, potency: dp, daPotency: dpDa, magic: true, target: true, range: 10, aoe: true, delay: 0.6, fx: 'gnbBow', desc: `Deals unaspected damage with a potency of ${dp} to all enemies in a straight line before you.\nDark Arts Potency: ${dpDa}\nCan only be executed under Darkside.` }),
      theBlackestNight: ab({ name: 'The Blackest Night', recast: 15, mp: 2400, desc: `Creates a barrier that absorbs damage equal to 20% of maximum HP.\nDuration: ${V.tbn}s\nAdds 50 to the Blood Gauge if the barrier is fully absorbed.` }),
      shadowWall: ab({ name: 'Shadow Wall', recast: V.da43 ? 120 : 180, desc: 'Reduces damage taken by 30%.\nDuration: 10s' }),
      darkMind: ab({ name: 'Dark Mind', recast: 60, desc: 'Reduces magic vulnerability by 20%.\nDuration: 10s' }),
      livingDead: ab({ name: 'Living Dead', recast: 300, desc: 'Your HP cannot fall below 1 while under the effect.\nDuration: 10s' }),
      // Stormblood's tank role actions (none adds damage).
      rampart: ab({ name: 'Rampart', recast: 90, role: true, desc: 'Reduces damage taken by 20%.\nDuration: 20s' }),
      lowBlow: ab({ name: 'Low Blow', recast: 25, role: true, target: true, range: 3, desc: 'Stuns target.\nDuration: 5s' }),
      provoke: ab({ name: 'Provoke', recast: 40, role: true, target: true, range: 25, desc: 'Gesture threateningly, placing yourself at the top of a target\'s enmity list.' }),
      reprisal: ab({ name: 'Reprisal', recast: 60, role: true, target: true, range: 3, desc: 'Reduces target\'s damage dealt by 10%.\nDuration: 5s' }),
      interject: ab({ name: 'Interject', recast: 30, role: true, target: true, range: 3, desc: 'Interrupts the use of a target\'s action.' }),
      ...B.GENERAL_ACTIONS,
      tincture: B.tincture(V.tincture),
      auto: { name: 'Attack', kind: 'auto', fx: 'auto', desc: 'Auto-attack.' },
    };
  }

  const STATUSES = {
    darkside: { name: 'Darkside', self: true, icon: 'st_darkside' },
    grit: { name: 'Grit', self: true, icon: 'st_grit' },
    darkArts: { name: 'Dark Arts', self: true, icon: 'st_darkarts' },
    bloodWeapon: { name: 'Blood Weapon', self: true, icon: 'st_bloodweapon' },
    theBlackestNight: { name: 'Blackest Night', self: true, icon: 'st_tbn' },
    shadowWall: { name: 'Shadow Wall', self: true, icon: 'st_shadowwall' },
    darkMind: { name: 'Dark Mind', self: true, icon: 'st_darkmind' },
    livingDead: { name: 'Living Dead', self: true, icon: 'st_livingdead' },
    rampart: { name: 'Rampart', self: true, icon: 'st_rampart' },
    saltedEarth: { name: 'Salted Earth', self: false, icon: 'st_salted' },
  };

  class DarkKnightSB {
    constructor(version) {
      const V = VERSIONS[version];
      this.V = V;
      this.name = 'Dark Knight';
      this.abbr = 'DRK';
      this.role = 'tank';
      this.level = 70;
      this.levelKey = 'sb70';
      this.model = 'drk-sb';
      this.maxMp = MAX_MP;
      this.actions = buildActions(V);
      this.statuses = STATUSES;
      this.tp = { max: 1000, regen: 60 };
      this.comboTime = 10;
      // Dark Knight's Strength modifier is 105; Tenacity raises a tank's damage. The greatsword: 2.96 delay.
      this.stats = Object.assign({ mainStat: 'str', jobMod: 105, trait: 100, delay: 2.96 }, V.stats);
      this.speedName = 'Skill speed';
      this.tierHaste = 0;
      this.autoAttack = { potency: 110, delay: 2.96, range: B.MELEE_RANGE };
      this.selfStatusOrder = ['darkside', 'grit', 'darkArts', 'bloodWeapon', 'theBlackestNight', 'shadowWall', 'darkMind', 'livingDead', 'rampart', 'medicated', 'sprint'];
      this.targetStatusOrder = ['saltedEarth'];
      this.defaultBars = [
        ['hardSlash', 'syphonStrike', 'souleater', 'bloodspiller', 'darkArts', 'bloodWeapon', 'delirium', 'carveAndSpit', 'plunge', 'darkPassenger', 'saltedEarth', 'tincture'],
        ['spinningSlash', 'powerSlash', 'unmend', 'unleash', 'abyssalDrain', 'quietus', 'darkside', 'grit', 'theBlackestNight', 'shadowWall', 'darkMind', 'livingDead'],
        ['rampart', 'reprisal', 'lowBlow', 'provoke', 'interject', 'sprint', null, null, null, null, null, null],
      ];
      this.actionGroups = [
        ['Dark Knight', ['hardSlash', 'syphonStrike', 'souleater', 'spinningSlash', 'powerSlash', 'bloodspiller', 'quietus', 'unleash', 'unmend', 'abyssalDrain',
          'darkside', 'grit', 'darkArts', 'bloodWeapon', 'delirium', 'saltedEarth', 'plunge', 'carveAndSpit', 'darkPassenger', 'theBlackestNight',
          'shadowWall', 'darkMind', 'livingDead']],
        ['Role Actions', ['rampart', 'lowBlow', 'provoke', 'reprisal', 'interject']],
        ['General', ['sprint', 'tincture']],
      ];
      this.referenceDps = V.ref;
      this.referenceGcd = 2.43;
      this.startDistance = 3.2;
    }

    initGauge(e) {
      e.addStatus('darkside', 1e9, { permanent: true });
      return { blood: 0 };
    }

    // Blood Weapon: 10% faster weaponskills, spells and auto-attacks.
    haste(e) { return e.has('bloodWeapon') ? 10 : 0; }
    autoHaste(e) { return this.haste(e); }

    mpCost(id) { return this.actions[id].mp || 0; }

    check(id, e) {
      const a = this.actions[id];
      if (a.cost && e.g.blood < a.cost) return 'Not enough Blood.';
      if (id === 'darkPassenger' && !e.has('darkside')) return 'Unable to execute action. Darkside required.';
      if (id === 'darkArts' && e.has('darkArts')) return 'Dark Arts is already active.';
      return null;
    }

    snapshot(a, e) {
      let mult = 1;
      if (e.has('darkside')) mult *= 1.20;
      if (e.has('grit')) mult *= 0.80;
      const main = this.stats.main + (e.has('medicated') ? B.TINCTURES[this.V.tincture].cap : 0);
      return { mult, main };
    }

    blood(e, n) { e.g.blood = Math.min(100, e.g.blood + n); }
    giveMp(e, n) {
      const before = e.mp;
      e.mp = Math.min(e.maxMp, e.mp + n);
      if (e.mp > before) e.emit('mpGain', { amount: e.mp - before, source: 'lucid' });
    }

    resolve(id, e) {
      const a = this.actions[id], g = e.g;
      if (a.mp) e.mp -= a.mp;
      if (a.cost) g.blood -= a.cost;
      // Blood Weapon takes a fifth off weaponskill TP.
      if (a.tp && e.has('bloodWeapon')) e.tp = Math.min(this.tp.max, e.tp + a.tp * 0.2);
      const da = a.daPotency !== undefined && e.has('darkArts');
      if (da) e.removeStatus('darkArts');
      const snap = this.snapshot(a, e);
      const combo = !!a.comboFrom && e.lastComboHit;
      let potency = a.potency || 0;
      if (a.comboFrom) potency = combo ? (da ? a.daComboPotency : a.comboPotency) : (da ? a.daPotency : a.potency);
      else if (da) potency = a.daPotency;
      if (combo && a.mpGain) this.giveMp(e, a.mpGain);
      if (combo && a.blood) this.blood(e, a.blood);
      switch (id) {
        case 'darkside': case 'grit':
          if (e.has(id)) { e.removeStatus(id, true); return; }
          e.addStatus(id, 1e9, { permanent: true });
          return;
        case 'darkArts': e.addStatus('darkArts', 10); return;
        case 'bloodWeapon': e.addStatus('bloodWeapon', 15); return;
        case 'delirium':
          this.giveMp(e, 2400);
          if (e.has('bloodWeapon')) e.statuses.bloodWeapon.until += 8;
          return;
        case 'saltedEarth': e.addTStatus('saltedEarth', a.dot.duration, { snap, dot: { potency: a.dot.potency, id } }); return;
        case 'carveAndSpit': if (!da) this.giveMp(e, 1200); break;
        case 'quietus': this.giveMp(e, 480 * Math.max(1, e.targets || 1)); break;
        case 'plunge': this.gap(e); break;
        case 'theBlackestNight': e.addStatus('theBlackestNight', this.V.tbn); return;
        case 'shadowWall': e.addStatus('shadowWall', 10); return;
        case 'darkMind': e.addStatus('darkMind', 10); return;
        case 'livingDead': e.addStatus('livingDead', 10); return;
        case 'rampart': e.addStatus('rampart', 20); return;
        default:
          if (B.ROLE_EFFECTS[id]) { B.ROLE_EFFECTS[id](e); return; }
      }
      if (potency) e.queueHit(id, potency, snap, a.delay);
    }

    // Blood Weapon: every physical hit (auto-attacks included) gives 480 MP and 3 Blood.
    onHit(h, r, e) {
      if (!e.has('bloodWeapon')) return;
      const a = h.auto ? null : this.actions[h.id];
      if (a && a.magic) return;
      this.giveMp(e, 480);
      this.blood(e, 3);
    }
    // Salted Earth's ticks: 1 Blood each.
    onDotTick(key, e) { if (key === 'saltedEarth') this.blood(e, 1); }

    gap(e) {
      const d = e.distToTarget() || 1;
      if (d > 2.6) {
        const from = { x: e.pos.x, z: e.pos.z };
        e.pos.x *= 2.4 / d; e.pos.z *= 2.4 / d;
        e.emit('teleport', { from, to: { x: e.pos.x, z: e.pos.z } });
      }
    }

    proc(id, e) {
      const a = this.actions[id];
      if (a.comboFrom && e.inCombo(a.comboFrom)) return true;
      if (id === 'bloodspiller') return e.g.blood >= 50;
      if (id === 'darkArts') return e.mp >= 2400 && !e.has('darkArts');
      return false;
    }

    // Darkside stops MP regeneration in combat.
    mpRegen(e) { return e.has('darkside') && e.inCombat ? 0 : Math.round(e.maxMp * 0.02); }
    speedInfo(e) { return `GCD ${e.gcdForSpeed(e.stats.speed).toFixed(2)}, ${e.gcdForSpeed(e.stats.speed, 10).toFixed(2)} under Blood Weapon · ${e.maxMp.toLocaleString()} MP`; }

    // ---------- the Blood Gauge ----------
    gaugeBuild(root) {
      root.innerHTML = `
<svg width="360" height="100" viewBox="0 0 360 100">
  <rect x="8" y="10" width="344" height="80" rx="14" fill="rgba(14,12,20,.86)" stroke="rgba(255,255,255,.22)"/>
  <text id="dk-lbl" x="24" y="38" font-family="Noto Sans, sans-serif" font-size="11" font-weight="600" fill="#a9a3b4" letter-spacing="1">BLOOD GAUGE</text>
  <rect x="24" y="52" width="250" height="14" rx="7" fill="#2a2535" stroke="rgba(0,0,0,.8)"/>
  <rect id="dk-b" x="24" y="52" width="0" height="14" rx="7" fill="#c0283a"/>
  <line x1="149" y1="48" x2="149" y2="70" stroke="rgba(255,255,255,.35)"/>
  <text id="dk-t" x="336" y="66" text-anchor="end" font-family="Saira Semi Condensed, sans-serif" font-size="18" font-weight="700" fill="#fff" stroke="#000" stroke-width="3" paint-order="stroke">0</text>
</svg>`;
      const $ = (s) => root.querySelector(s);
      this.dg = { lbl: $('#dk-lbl'), b: $('#dk-b'), t: $('#dk-t'), cache: {} };
    }

    gaugeUpdate(e) {
      const G = this.dg, c = G.cache, g = e.g;
      const put = (k, v, fn) => { if (c[k] !== v) { c[k] = v; fn(v); } };
      put('b', g.blood, v => { G.b.setAttribute('width', String(250 * v / 100)); G.t.textContent = String(v); });
      const da = e.has('darkArts');
      put('l', da, v => { G.lbl.textContent = v ? 'BLOOD GAUGE · DARK ARTS READY' : 'BLOOD GAUGE'; G.lbl.setAttribute('fill', v ? '#ff8fa0' : '#a9a3b4'); });
    }

    helpHtml(seq) {
      const V = this.V;
      return `
<h3>How it plays (${V.label})</h3>
<p>Level 70 Dark Knight: weaponskills on TP, the rest on 9,480 MP that doesn't come back by itself while <b>Darkside</b> (+20% damage) is on. The combo <b>Hard Slash → Syphon Strike</b> (+1,200 MP) <b>→ Souleater</b> (+10 Blood) pays for <b>Dark Arts</b> (2,400 MP): it makes the next <b>Carve and Spit</b> 450 instead of 100 (the best use), or Souleater 440, Syphon Strike 390, Bloodspiller 540${V.da43 ? ', Power Slash 440, Plunge 340' : ''}, Dark Passenger ${V.passenger[1]}.</p>
<p><b>Blood Weapon</b> (40s) is 15s of 10% haste in which every physical hit, auto-attacks too, gives 480 MP and 3 Blood; <b>Delirium</b> (50 Blood, ${V.delirium}s) adds 8s to it and 2,400 MP. <b>Bloodspiller</b> (400) spends 50 Blood. <b>Salted Earth</b> (75 a tick for 21s), <b>Plunge</b> (200) and <b>Dark Passenger</b> (${V.passenger[0]}, ${V.passenger[2]}s) on cooldown. Grit (the tank stance) is −20% damage.</p>
<h3>An opener (reconstructed)</h3>
${seq(['hardSlash', ['bloodWeapon'], 'syphonStrike', ['saltedEarth'], 'souleater', ['darkArts'], ['carveAndSpit'], 'hardSlash', ['plunge'], 'syphonStrike', ['darkArts'], ['darkPassenger'], 'souleater', ['tincture'], 'bloodspiller', ['delirium'], 'hardSlash', 'syphonStrike', ['darkArts'], 'souleater', 'bloodspiller'])}
<p>Darkside and Dark Arts before the pull. No Stormblood Dark Knight opener survives in the archives; this one follows the version's rules and the period's priority (Dark Arts on Carve and Spit first, then Dark Passenger, Bloodspiller, Souleater).</p>
<p style="color:#a9a3b4">The ${V.da43 ? '4.3–4.58' : V.delirium === 80 ? '4.2–4.25' : '4.05–4.18'} numbers: Hard Slash 150, Syphon Strike combo 250 (390 with Dark Arts), Souleater combo 300 (440), Bloodspiller 400 (540), Carve and Spit 100 (450), Plunge 200${V.da43 ? ' (340)' : ''}, Dark Passenger ${V.passenger[0]} (${V.passenger[1]}), Salted Earth 75 × 21s. MP and Blood gains are xivanalysis's model; Salted Earth's Blood per tick is a guess. Gear: ${V.gear}, with the matching Infusion of Strength.</p>`;
    }
  }

  B.registerJob({
    id: 'drk', name: 'Dark Knight', abbr: 'DRK', role: 'tank', classJob: 32,
    versions: ['sb43', 'sb42', 'sb40'].map(v => ({ id: v, label: VERSIONS[v].label, history: VERSIONS[v].history, note: VERSIONS[v].note, create: () => new DarkKnightSB(v) })),
  });
})(window.BLM);
