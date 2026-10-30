// Dark Knight, Shadowbringers at level 80, in two versions. Hard Slash → Syphon Strike (MP) → Souleater (+20 Blood);
// 50 Blood for Bloodspiller (600) or Living Shadow (a simulacrum that attacks seven times over 24s); 3,000 MP for Edge
// of Shadow (500), which keeps Darkside (+10% damage, 30s a time up to 60s) up. Blood Weapon (60s) gives 10 Blood and
// 600 MP for each GCD that lands in its 10s; Delirium (90s) makes Bloodspiller free for 10s. Carve and Spit, Abyssal
// Drain, Plunge (two charges) and Salted Earth on cooldown. The Blackest Night (3,000 MP) grants Dark Arts, a free Edge,
// only when its barrier breaks, which a striking dummy never does.
//  - 5.0–5.08: Shadow Wall 10s and a single-target 5s Reprisal; Eden's Gate gear (The Balance's 5.05 set at 2.43).
//  - 5.1–5.58: Shadow Wall 15s, Reprisal on all nearby enemies for 10s; The Balance's 5.5x relic set at 2.41.
// No damage number changed from 5.0 to 5.58 (the game data at 17 patches and the Lodestone notes). Tank spells (Unmend,
// Unleash, Stalwart Soul) recast in a flat 2.50s: tank gear has no spell speed. Gear stats are the 5.58 Item.csv's.
// ref: a scripted bot parses about 13,010 / 8,530 on these.
(function (B) {
  const DARKSIDE = 1.10;
  // Living Shadow: 7 attacks of 300 (pet) potency, the first about 6s after it's summoned. The Balance counts each as
  // about 360 of your own potency; it takes your buffs except Darkside.
  const SHADOW = { hits: 7, potency: 300, scale: 1.2, first: 6, every: 2.5, dur: 24 };
  const VERSIONS = {
    shb51: { label: 'Shadowbringers 5.1–5.58', history: 'ShB 5.1–5.58', shadowWall: 15, reprisal: 10, tincture: 'str4', gcd: 2.41, ref: 13790,
      stats: { hp: 90000, main: 5526, wd: 134, det: 2600, crit: 4145, dh: 1280, speed: 1218, ten: 908 },
      gear: 'The Balance\'s 5.5x relic set at 2.41 (Strength 5,526, 134 weapon damage)',
      note: 'Level 80: Edge of Shadow for Darkside, Blood Weapon and Delirium into Bloodspillers, Living Shadow, The Blackest Night; Eden\'s Promise gear' },
    shb50: { label: 'Shadowbringers 5.0–5.08', history: 'ShB 5.0–5.08', shadowWall: 10, reprisal: 5, tincture: 'str2', gcd: 2.43, ref: 9040,
      stats: { hp: 78000, main: 4159, wd: 122, det: 2202, crit: 3682, dh: 1220, speed: 1022, ten: 1041 },
      gear: 'The Balance\'s 5.05 set at 2.43 (Strength 4,159, 122 weapon damage), with a Grade 2 Tincture',
      note: 'The launch Dark Knight: the 5.1 kit with a 10s Shadow Wall and a single-target Reprisal; Eden\'s Gate gear' },
  };
  const ws = (o) => Object.assign({ kind: 'gcd', target: true, range: B.MELEE_RANGE, delay: 0.55, fx: 'gnbSlash' }, o);
  const spell = (o) => Object.assign({ kind: 'gcd', target: true, range: 20, delay: 0.7, school: 'dark', fixedRecast: 2.5, fx: 'gnbBurst' }, o);
  const ab = (o) => Object.assign({ kind: 'ogcd' }, o);

  function buildActions(V) {
    return {
      hardSlash: ws({ name: 'Hard Slash', potency: 200, comboStart: true, comboNext: true, desc: 'Delivers an attack with a potency of 200.' }),
      syphonStrike: ws({ name: 'Syphon Strike', potency: 100, comboPotency: 300, comboFrom: 'hardSlash', comboNext: true, fx: 'gnbSlash2', desc: 'Delivers an attack with a potency of 100.\nCombo Action: Hard Slash\nCombo Potency: 300\nCombo Bonus: Restores MP' }),
      souleater: ws({ name: 'Souleater', potency: 100, comboPotency: 400, comboFrom: 'syphonStrike', fx: 'gnbBarrel', desc: 'Delivers an attack with a potency of 100.\nCombo Action: Syphon Strike\nCombo Potency: 400\nCombo Bonus: Restores own HP\nCure Potency: 300\nCombo Bonus: Increases Blood Gauge by 20' }),
      bloodspiller: ws({ name: 'Bloodspiller', potency: 600, cost: 50, delirium: 200, fx: 'gnbDouble', desc: 'Delivers an attack with a potency of 600.\nBlood Gauge Cost: 50' }),
      quietus: ws({ name: 'Quietus', potency: 210, cost: 50, delirium: 500, target: false, pbaoe: 5, aoe: true, desc: 'Delivers an attack with a potency of 210 to all nearby enemies.\nBlood Gauge Cost: 50' }),
      unleash: spell({ name: 'Unleash', potency: 150, comboStart: true, comboNext: true, target: false, pbaoe: 5, aoe: true, desc: 'Deals unaspected damage with a potency of 150 to all nearby enemies.' }),
      stalwartSoul: spell({ name: 'Stalwart Soul', potency: 100, comboPotency: 160, comboFrom: 'unleash', target: false, pbaoe: 5, aoe: true, desc: 'Deals unaspected damage with a potency of 100 to all nearby enemies.\nCombo Action: Unleash\nCombo Potency: 160\nCombo Bonus: Restores MP\nCombo Bonus: Increases Blood Gauge by 20' }),
      unmend: spell({ name: 'Unmend', potency: 150, desc: 'Deals unaspected damage with a potency of 150.\nAdditional Effect: Increased enmity' }),
      edgeOfShadow: ab({ name: 'Edge of Shadow', recast: 2, cdGroup: 'edge', mp: 3000, potency: 500, target: true, range: B.MELEE_RANGE, delay: 0.6, fx: 'gnbZone', desc: 'Deals unaspected damage with a potency of 500.\nAdditional Effect: Grants Darkside, increasing damage dealt by 10%\nDuration: 30s\nExtends Darkside duration by 30s to a maximum of 60s.\nShares a recast timer with Flood of Shadow.' }),
      floodOfShadow: ab({ name: 'Flood of Shadow', recast: 2, cdGroup: 'edge', mp: 3000, potency: 300, target: true, range: 10, aoe: true, delay: 0.6, fx: 'gnbBow', desc: 'Deals unaspected damage with a potency of 300 to all enemies in a straight line before you.\nAdditional Effect: Grants Darkside, increasing damage dealt by 10%\nDuration: 30s\nExtends Darkside duration by 30s to a maximum of 60s.\nShares a recast timer with Edge of Shadow.' }),
      bloodWeapon: ab({ name: 'Blood Weapon', recast: 60, desc: 'Increases Blood Gauge by 10 and restores MP upon landing weaponskills or spells.\nDuration: 10s' }),
      delirium: ab({ name: 'Delirium', recast: 90, desc: 'Allows the execution of Quietus and Bloodspiller without cost, restoring MP when landing either weaponskill.\nDuration: 10s' }),
      livingShadow: ab({ name: 'Living Shadow', recast: 120, cost: 50, desc: 'Conjure a simulacrum of your darkside to fight alongside you.\nSimulacrum Attack Potency: 300\nDuration: 24s\nBlood Gauge Cost: 50' }),
      carveAndSpit: ab({ name: 'Carve and Spit', recast: 60, potency: 450, target: true, range: B.MELEE_RANGE, delay: 0.6, fx: 'gnbDouble', desc: 'Delivers a threefold attack with a potency of 450.\nAdditional Effect: Restores MP' }),
      abyssalDrain: ab({ name: 'Abyssal Drain', recast: 60, potency: 200, target: true, range: 20, aoe: true, delay: 0.7, fx: 'gnbBurst', desc: 'Deals unaspected damage with a potency of 200 to target and all enemies nearby it.\nAdditional Effect: Restores own HP\nCure Potency: 200' }),
      plunge: ab({ name: 'Plunge', recast: 30, charges: 2, potency: 200, target: true, range: 20, delay: 0.3, fx: 'gnbCont', desc: 'Delivers a jumping attack with a potency of 200.\nMaximum Charges: 2\nCannot be executed while bound.' }),
      saltedEarth: ab({ name: 'Salted Earth', recast: 90, potency: 60, target: true, range: B.MELEE_RANGE, delay: 0.3, dot: { potency: 60, duration: 15 }, fx: 'gnbBow', desc: 'Creates a patch of salted earth, dealing unaspected damage with a potency of 60 to any enemies who enter.\nDuration: 15s' }),
      theBlackestNight: ab({ name: 'The Blackest Night', recast: 15, mp: 3000, desc: 'Creates a barrier around target that absorbs damage totaling 25% of target\'s maximum HP.\nDuration: 7s\nGrants Dark Arts when barrier is completely absorbed.\nDark Arts Effect: Consume Dark Arts instead of MP to execute Edge of Shadow or Flood of Shadow' }),
      grit: ab({ name: 'Grit', recast: 10, desc: 'Significantly increases enmity generation.\nEffect ends upon reuse.' }),
      shadowWall: ab({ name: 'Shadow Wall', recast: 120, desc: `Reduces damage taken by 30%.\nDuration: ${V.shadowWall}s` }),
      darkMind: ab({ name: 'Dark Mind', recast: 60, desc: 'Reduces magic vulnerability by 20%.\nDuration: 10s' }),
      livingDead: ab({ name: 'Living Dead', recast: 300, desc: 'Grants the effect of Living Dead. When HP is reduced to 0 while under the effect of Living Dead, instead of becoming KO\'d, your status will change to Walking Dead.\nLiving Dead Duration: 10s' }),
      darkMissionary: ab({ name: 'Dark Missionary', recast: 90, desc: 'Reduces magic damage taken by self and nearby party members by 10%.\nDuration: 15s' }),
      ...B.ROLE_ACTIONS.tank,
      reprisal: Object.assign({}, B.ROLE_ACTIONS.tank.reprisal, V.reprisal === 5 ? { desc: 'Reduces damage dealt by target by 10%.\nDuration: 5s' } : {}),
      ...B.GENERAL_ACTIONS,
      tincture: B.tincture(V.tincture),
      auto: { name: 'Attack', kind: 'auto', fx: 'auto', desc: 'Auto-attack.' },
    };
  }

  const STATUSES = {
    darkside: { name: 'Darkside', self: true, icon: 'st_darkside' },
    bloodWeapon: { name: 'Blood Weapon', self: true, icon: 'st_bw' },
    delirium: { name: 'Delirium', self: true, icon: 'st_delirium' },
    blackestNight: { name: 'Blackest Night', self: true, icon: 'st_tbn' },
    darkArts: { name: 'Dark Arts', self: true, icon: 'st_darkarts' },
    grit: { name: 'Grit', self: true, icon: 'st_grit' },
    shadowWall: { name: 'Shadow Wall', self: true, icon: 'st_wall' },
    darkMind: { name: 'Dark Mind', self: true, icon: 'st_darkmind' },
    livingDead: { name: 'Living Dead', self: true, icon: 'st_livingdead' },
    darkMissionary: { name: 'Dark Missionary', self: true, icon: 'st_missionary' },
    saltedEarth: { name: 'Salted Earth', self: false, icon: 'st_salted' },
  };

  class DarkKnightShB {
    constructor(version) {
      const V = VERSIONS[version];
      this.V = V;
      this.name = 'Dark Knight';
      this.abbr = 'DRK';
      this.role = 'tank';
      this.level = 80;
      this.levelKey = 'shb80';
      this.model = 'drk-shb';
      this.maxMp = 10000;
      this.actions = buildActions(V);
      this.statuses = STATUSES;
      this.stats = Object.assign({ mainStat: 'str', jobMod: 105, trait: 100, delay: 2.96 }, V.stats);
      this.speedName = 'Skill speed';
      this.tierHaste = 0;
      this.autoAttack = { potency: 110, delay: 2.96, range: B.MELEE_RANGE };
      this.selfStatusOrder = ['darkside', 'bloodWeapon', 'delirium', 'darkArts', 'blackestNight', 'grit', 'medicated', 'rampart', 'shadowWall',
        'darkMind', 'livingDead', 'darkMissionary', 'armsLength', 'sprint'];
      this.targetStatusOrder = ['saltedEarth', 'reprisal'];
      this.defaultBars = [
        ['hardSlash', 'syphonStrike', 'souleater', 'bloodspiller', 'edgeOfShadow', 'bloodWeapon', 'delirium', 'livingShadow', 'carveAndSpit', 'abyssalDrain', 'plunge', 'saltedEarth'],
        ['unmend', 'tincture', 'grit', 'theBlackestNight', 'rampart', 'shadowWall', 'darkMind', 'livingDead', 'darkMissionary', 'reprisal', 'provoke', 'shirk'],
        ['unleash', 'stalwartSoul', 'quietus', 'floodOfShadow', 'lowBlow', 'interject', 'armsLength', 'sprint', null, null, null, null],
      ];
      this.actionGroups = [
        ['Dark Knight', ['hardSlash', 'syphonStrike', 'souleater', 'bloodspiller', 'quietus', 'unleash', 'stalwartSoul', 'unmend', 'edgeOfShadow',
          'floodOfShadow', 'bloodWeapon', 'delirium', 'livingShadow', 'carveAndSpit', 'abyssalDrain', 'plunge', 'saltedEarth', 'theBlackestNight',
          'grit', 'shadowWall', 'darkMind', 'livingDead', 'darkMissionary']],
        ['Role Actions', ['rampart', 'lowBlow', 'provoke', 'interject', 'reprisal', 'armsLength', 'shirk']],
        ['General', ['sprint', 'tincture']],
      ];
      this.referenceDps = V.ref;
      this.referenceGcd = V.gcd;
      this.startDistance = 3.2;
    }

    initGauge() { return { blood: 0, shadowUntil: 0 }; }
    resolveId(id) { return id; }

    check(id, e) {
      const a = this.actions[id], g = e.g;
      if (a.cost && g.blood < a.cost && !(a.delirium && e.has('delirium'))) return 'Not enough Blood.';
      if (a.kind === 'ogcd' && a.mp && e.mp < a.mp && !(a.cdGroup === 'edge' && e.has('darkArts'))) return 'Not enough MP.';
      return null;
    }

    snapshot(a, e) {
      const mult = e.has('darkside') ? DARKSIDE : 1;
      const main = this.stats.main + (e.has('medicated') ? B.TINCTURES[this.V.tincture].cap : 0);
      return { mult, main };
    }

    blood(e, n) { e.g.blood = Math.max(0, Math.min(100, e.g.blood + n)); }
    gainMp(e, n) {
      const before = e.mp;
      e.mp = Math.min(e.maxMp, e.mp + n);
      if (e.mp > before) e.emit('mpGain', { amount: e.mp - before, source: 'tick' });
    }

    resolve(id, e) {
      const a = this.actions[id], g = e.g;
      let potency = a.potency || 0, dot = a.dot;
      if (a.comboFrom && e.lastComboHit) potency = a.comboPotency;
      if (a.cost) {
        if (a.delirium && e.has('delirium')) this.gainMp(e, a.delirium);
        else this.blood(e, -a.cost);
      }
      if (a.mp) {
        if (a.cdGroup === 'edge' && e.has('darkArts')) e.removeStatus('darkArts');
        else e.mp -= a.mp;
      }
      // Blood Weapon: each weaponskill or spell that lands.
      if (a.kind === 'gcd' && potency && e.has('bloodWeapon')) { this.blood(e, 10); this.gainMp(e, 600); }

      switch (id) {
        case 'syphonStrike': if (e.lastComboHit) this.gainMp(e, 600); break;
        case 'souleater': if (e.lastComboHit) this.blood(e, 20); break;
        case 'stalwartSoul': if (e.lastComboHit) { this.gainMp(e, 600); this.blood(e, 20); } break;
        case 'edgeOfShadow': case 'floodOfShadow': {
          const left = e.has('darkside') ? e.statuses.darkside.until - e.now : 0;
          e.addStatus('darkside', Math.min(60, left + 30));
          break;
        }
        // Both land about 0.6s after the button (the server's application delay), so a late weave fits five GCDs.
        case 'bloodWeapon': e.addStatus('bloodWeapon', 10.6); break;
        case 'delirium': e.addStatus('delirium', 10.6); break;
        case 'livingShadow': {
          g.shadowUntil = e.now + SHADOW.dur;
          const main = this.stats.main + (e.has('medicated') ? B.TINCTURES[this.V.tincture].cap : 0);
          for (let k = 0; k < SHADOW.hits; k++) e.queueHit('livingShadow', SHADOW.potency, { mult: SHADOW.scale, main }, SHADOW.first + k * SHADOW.every);
          break;
        }
        case 'carveAndSpit': this.gainMp(e, 600); break;
        case 'plunge': {
          const d = e.distToTarget() || 1;
          if (d > 2.6) {
            const from = { x: e.pos.x, z: e.pos.z };
            e.pos.x *= 2.4 / d; e.pos.z *= 2.4 / d;
            e.emit('teleport', { from, to: { x: e.pos.x, z: e.pos.z } });
          }
          break;
        }
        case 'theBlackestNight': e.addStatus('blackestNight', 7); break;
        case 'grit':
          if (e.has('grit')) e.removeStatus('grit'); else e.addStatus('grit', 1e9, { permanent: true });
          break;
        case 'shadowWall': e.addStatus('shadowWall', this.V.shadowWall); break;
        case 'darkMind': e.addStatus('darkMind', 10); break;
        case 'livingDead': e.addStatus('livingDead', 10); break;
        case 'darkMissionary': e.addStatus('darkMissionary', 15); break;
        case 'reprisal': e.addTStatus('reprisal', this.V.reprisal); break;
        default:
          if (B.ROLE_EFFECTS[id]) B.ROLE_EFFECTS[id](e);
      }

      if (potency) {
        const snap = this.snapshot(a, e);
        const after = dot ? () => e.addTStatus(id, dot.duration, { snap, dot: { potency: dot.potency, id } }) : null;
        e.queueHit(id, potency, snap, a.delay, after);
      }
    }

    proc(id, e) {
      const a = this.actions[id];
      if (a.comboFrom && e.inCombo(a.comboFrom)) return true;
      if (id === 'bloodspiller') return e.g.blood >= 50 || e.has('delirium');
      if (id === 'edgeOfShadow') return e.has('darkArts');
      return false;
    }

    mpRegen() { return B.BASE_REGEN; }
    speedInfo(e) { return `GCD ${e.gcdForSpeed(e.stats.speed).toFixed(2)} · Blood Weapon and Delirium fit ${Math.floor(10 / e.gcdForSpeed(e.stats.speed)) + 1} GCDs when used late`; }

    // ---------- the Blood Gauge ----------
    gaugeBuild(root) {
      root.innerHTML = `
<svg width="360" height="120" viewBox="0 0 360 120">
  <defs><linearGradient id="dk-b" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#6a0f24"/><stop offset="1" stop-color="#e2405a"/></linearGradient></defs>
  <rect x="8" y="10" width="344" height="100" rx="14" fill="rgba(14,12,20,.86)" stroke="rgba(255,255,255,.22)"/>
  <text x="24" y="38" font-family="Noto Sans, sans-serif" font-size="11" font-weight="600" fill="#a9a3b4" letter-spacing="1">BLOOD GAUGE</text>
  <text id="dk-n" x="336" y="40" text-anchor="end" font-family="Saira Semi Condensed, sans-serif" font-size="20" font-weight="700" fill="#fff" stroke="#000" stroke-width="3" paint-order="stroke">0</text>
  <rect x="24" y="52" width="312" height="14" rx="7" fill="#1d1a2a" stroke="rgba(255,255,255,.2)"/>
  <rect id="dk-bar" x="24" y="52" width="0" height="14" rx="7" fill="url(#dk-b)"/>
  <line x1="180" y1="48" x2="180" y2="70" stroke="rgba(255,255,255,.5)"/>
  <text id="dk-t" x="24" y="94" font-family="Noto Sans, sans-serif" font-size="12" font-weight="600" fill="#ffd98a" letter-spacing="1"></text>
</svg>`;
      const $ = (s) => root.querySelector(s);
      this.dg = { n: $('#dk-n'), bar: $('#dk-bar'), t: $('#dk-t'), cache: {} };
    }

    gaugeUpdate(e) {
      const G = this.dg, c = G.cache, g = e.g;
      const put = (k, v, fn) => { if (c[k] !== v) { c[k] = v; fn(v); } };
      put('b', g.blood, v => { G.n.textContent = String(v); G.bar.setAttribute('width', String(312 * v / 100)); });
      const ds = e.has('darkside') ? Math.ceil(e.statuses.darkside.until - e.now) : 0;
      const sh = g.shadowUntil > e.now ? Math.ceil(g.shadowUntil - e.now) : 0;
      put('t', `${ds}|${sh}`, () => { G.t.textContent = `DARKSIDE ${ds ? ds + 's' : '—'}${sh ? `  ·  LIVING SHADOW ${sh}s` : ''}`; });
    }

    helpHtml(seq) {
      const V = this.V;
      return `
<h3>How it plays (${V.label})</h3>
<p>Level 80 Dark Knight. <b>Hard Slash → Syphon Strike → Souleater</b>: Syphon Strike's combo restores 600 MP, Souleater's adds 20 Blood. Spend 3,000 MP on <b>Edge of Shadow</b> (500), which keeps <b>Darkside</b> up (+10% damage; each Edge adds 30s, up to 60s), and 50 Blood on <b>Bloodspiller</b> (600). Don't let MP or Blood overcap.</p>
<p><b>Blood Weapon</b> (60s) gives 10 Blood and 600 MP for every GCD that lands in its 10s, and <b>Delirium</b> (90s) makes Bloodspiller free (and restores 200 MP) for 10s. Weave both late in the GCD so five GCDs fit. Every two minutes, 50 Blood summons <b>Living Shadow</b>: about 6s later it attacks seven times (300 potency each, with your buffs but not Darkside). <b>Carve and Spit</b> (450, 600 MP), <b>Abyssal Drain</b> (200), both <b>Plunge</b> charges (200) and <b>Salted Earth</b> (60 a tick for 15s) go in the burst. <b>The Blackest Night</b> (3,000 MP) only gives Dark Arts (a free Edge) when a hit breaks its barrier, which the dummy never does.</p>
<h3>The opener (The Balance, 5.58 "4th GCD Delirium")</h3>
${seq(['bloodWeapon', 'hardSlash', ['edgeOfShadow'], 'syphonStrike', ['tincture'], 'souleater', ['livingShadow'], ['plunge'], 'hardSlash', ['saltedEarth'], ['delirium'], 'bloodspiller', ['edgeOfShadow'], ['carveAndSpit'], 'bloodspiller', ['edgeOfShadow'], ['plunge'], 'bloodspiller', ['edgeOfShadow'], ['abyssalDrain'], 'bloodspiller', ['edgeOfShadow'], 'bloodspiller', 'syphonStrike', 'souleater'])}
<p>Blood Weapon just before the pull. In a fight, The Balance also casts The Blackest Night before the pull for a free Edge once it breaks. After the opener: Blood Weapon, Delirium, Carve and Spit, Abyssal Drain, Salted Earth and Plunge on cooldown (hold the first Blood Weapon about three GCDs so it doesn't overcap), with about four Edges and three Bloodspillers saved for each minute's burst.${V.reprisal === 5 ? ' No 5.0x text of the opener survives, but the 5.0 guide describes the same plan.' : ''}</p>
<p style="color:#a9a3b4">The 5.0–5.58 numbers: Hard Slash 200, Syphon Strike 300 and Souleater 400 in combo, Bloodspiller 600, Quietus 210, Edge of Shadow 500, Flood of Shadow 300, Carve and Spit 450, Abyssal Drain 200, Plunge 200, Salted Earth 60 × 15s, Living Shadow 7 × 300, Unmend 150, Unleash 150, Stalwart Soul 160; auto-attacks 110 at 2.96s. The Balance counts each Living Shadow attack as about 360 of your own potency, which this uses. Gear: ${V.gear}, pre-6.0 stats from the 5.58 game data.</p>`;
    }
  }

  B.DarkKnightShB = DarkKnightShB;
  B.registerJob({
    id: 'drk', name: 'Dark Knight', abbr: 'DRK', role: 'tank', classJob: 32,
    versions: ['shb51', 'shb50'].map(v => ({ id: v, label: VERSIONS[v].label, history: VERSIONS[v].history, note: VERSIONS[v].note, create: () => new DarkKnightShB(v) })),
  });
})(window.BLM);
