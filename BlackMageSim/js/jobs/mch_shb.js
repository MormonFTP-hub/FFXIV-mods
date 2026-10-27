// Machinist, Shadowbringers at level 80 (the 5.0 rework), in two versions. The Heated Split → Slug → Clean Shot combo
// builds Heat (5 each) and, at its end, Battery (10); Drill (700, 20s) and Air Anchor (700, 40s, +20 Battery) sit outside
// the combo. Hypercharge (50 Heat) overheats the gun for 8s: five Heat Blasts on a flat 1.5s GCD, +20 potency each, and
// each takes 15s off both Gauss Round and Ricochet (150, three charges). Wildfire adds 200 for each weaponskill in its
// 10s (it can't crit or direct hit); Reassemble makes a weaponskill a critical direct hit; Barrel Stabilizer gives 50
// Heat. The Automaton Queen spends all Battery (50–100): Roller Dash, Arm Punches and Pile Bunker.
//  - 5.0–5.01: Heated shots 200 / 300 / 400, Heat Blast 200, Reassemble 60s, Tactician 180s; Eden's Gate gear.
//  - 5.05–5.58: Reassemble 55s; 5.1 raised the combo to 220 / 330 / 440 and Heat Blast to 220. The 5.58 numbers.
// Numbers are the game data at 5.01 and 5.58 and the Lodestone notes. The Queen's damage follows The Balance (230 potency
// per 10 Battery, at about 90% of yours). Gear stats are the 5.58 Item.csv's (pre-6.0). ref: a scripted bot parses
// about 20,180 / 12,840 on these.
(function (B) {
  const EPS = 1e-6;
  const OVERHEAT = 8, QUEEN = 0.9;
  const VERSIONS = {
    shb505: { label: 'Shadowbringers 5.05–5.58', history: 'ShB 5.05–5.58', split: 220, slug: 330, clean: 440, blast: 220, reassemble: 55, tactician: 120,
      tincture: 'dex4', gcd: 2.5, ref: 21390,
      stats: { hp: 62000, main: 5560, wd: 134, det: 3234, crit: 3779, dh: 2378, speed: 380 },
      gear: 'The Balance\'s 5.5 relic set at 2.50 (Dexterity 5,560, 134 weapon damage)',
      note: 'Level 80: the Heated combo, Drill and Air Anchor, Hypercharge into five Heat Blasts, Wildfire, the Automaton Queen; the 5.58 numbers and Eden\'s Promise gear' },
    shb50: { label: 'Shadowbringers 5.0–5.01', history: 'ShB 5.0–5.01', split: 200, slug: 300, clean: 400, blast: 200, reassemble: 60, tactician: 180,
      tincture: 'dex1', gcd: 2.48, ref: 13610,
      stats: { hp: 56000, main: 4193, wd: 122, det: 2781, crit: 3095, dh: 2335, speed: 578 },
      gear: 'an Eden\'s Gate set at 2.48, the slowest it allows (Dexterity 4,193, 122 weapon damage), with the Grade 1 Tincture',
      note: 'The launch rework: Heated shots 200 / 300 / 400, Heat Blast 200, Reassemble on 60s; Eden\'s Gate gear' },
  };
  const ws = (o) => Object.assign({ kind: 'gcd', target: true, range: 25, delay: 0.5, fx: 'gnbShot' }, o);
  const ab = (o) => Object.assign({ kind: 'ogcd' }, o);

  function buildActions(V) {
    return {
      heatedSplitShot: ws({ name: 'Heated Split Shot', potency: V.split, comboStart: true, comboNext: true, heat: 5, single: true, desc: `Delivers an attack with a potency of ${V.split}.\nAdditional Effect: Increases Heat Gauge by 5` }),
      heatedSlugShot: ws({ name: 'Heated Slug Shot', potency: 100, comboPotency: V.slug, comboFrom: 'heatedSplitShot', comboNext: true, heat: 5, single: true, desc: `Delivers an attack with a potency of 100.\nCombo Action: Heated Split Shot\nCombo Potency: ${V.slug}\nCombo Bonus: Increases Heat Gauge by 5` }),
      heatedCleanShot: ws({ name: 'Heated Clean Shot', potency: 100, comboPotency: V.clean, comboFrom: 'heatedSlugShot', heat: 5, battery: 10, single: true, desc: `Delivers an attack with a potency of 100.\nCombo Action: Heated Slug Shot\nCombo Potency: ${V.clean}\nCombo Bonus: Increases Heat Gauge by 5\nCombo Bonus: Increases Battery Gauge by 10` }),
      drill: ws({ name: 'Drill', potency: 700, cd: 20, cdScales: true, cdGroup: 'drill', single: true, fx: 'gnbBurst', desc: 'Delivers an attack with a potency of 700.\nShares a recast timer with Bioblaster.\nRecast time is affected by skill speed.' }),
      airAnchor: ws({ name: 'Air Anchor', potency: 700, cd: 40, cdScales: true, battery: 20, single: true, fx: 'gnbDouble', desc: 'Delivers an attack with a potency of 700.\nAdditional Effect: Increases Battery Gauge by 20\nRecast time is affected by skill speed.' }),
      heatBlast: ws({ name: 'Heat Blast', potency: V.blast, fixedRecast: 1.5, overheat: true, single: true, fx: 'gnbShot', desc: `Delivers an attack with a potency of ${V.blast}.\nAdditional Effect: Reduces the recast time of both Gauss Round and Ricochet by 15s\nCan only be executed when firearm is Overheated.\nRecast: 1.5s, not affected by skill speed.` }),
      autoCrossbow: ws({ name: 'Auto Crossbow', potency: 180, fixedRecast: 1.5, overheat: true, aoe: true, range: 12, desc: 'Delivers an attack with a potency of 180 to all enemies in a cone before you.\nCan only be executed when firearm is Overheated.' }),
      spreadShot: ws({ name: 'Spread Shot', potency: 180, heat: 5, breaksCombo: true, aoe: true, range: 12, desc: 'Delivers an attack with a potency of 180 to all enemies in a cone before you.\nAdditional Effect: Increases Heat Gauge by 5' }),
      bioblaster: ws({ name: 'Bioblaster', potency: 60, cd: 20, cdScales: true, cdGroup: 'drill', aoe: true, range: 12, dot: { potency: 60, duration: 15 }, desc: 'Delivers an attack with a potency of 60 to all enemies in a cone before you.\nAdditional Effect: Damage over time\nPotency: 60\nDuration: 15s\nShares a recast timer with Drill.' }),
      hypercharge2: ab({ name: 'Hypercharge', recast: 10, desc: 'Releases the energy building in your firearm, causing it to become Overheated, increasing the potency of single-target weaponskills by 20.\nDuration: 8s\nHeat Gauge Cost: 50' }),
      wildfire: ab({ name: 'Wildfire', recast: 120, target: true, range: 25, desc: 'Covers target\'s body in a slow-burning pitch. Action is changed to Detonator for the duration of the effect.\nDeals damage when time expires or upon executing Detonator.\nPotency is increased by 200 for each of your own weaponskills you land prior to the end of the effect.\nDuration: 10s\nIt can\'t be a critical or direct hit.' }),
      detonator: ab({ name: 'Detonator', recast: 1, desc: 'Ends the effect of Wildfire, dealing damage to the target.' }),
      reassemble: ab({ name: 'Reassemble', recast: V.reassemble, desc: 'Guarantees that next weaponskill is a critical direct hit.\nDuration: 5s\nThis action does not affect damage over time effects.' }),
      gaussRound: ab({ name: 'Gauss Round', recast: 30, charges: 3, potency: 150, target: true, range: 25, delay: 0.5, fx: 'gnbShot', desc: 'Delivers an attack with a potency of 150.\nMaximum Charges: 3' }),
      ricochet: ab({ name: 'Ricochet', recast: 30, charges: 3, potency: 150, target: true, range: 25, aoe: 0.5, delay: 0.5, fx: 'gnbBurst', desc: 'Deals damage to all nearby enemies with a potency of 150 for the first enemy, and 50% less for all remaining enemies.\nMaximum Charges: 3' }),
      barrelStabilizer: ab({ name: 'Barrel Stabilizer', recast: 120, desc: 'Increases Heat Gauge by 50.\nCan only be executed while in combat.' }),
      automatonQueen: ab({ name: 'Automaton Queen', recast: 6, desc: 'Deploys an Automaton Queen to fight at your side.\nBattery Gauge Cost: 50\nDuration increases as Battery Gauge exceeds minimum cost at time of deployment, up to a maximum of 20 seconds.\nConsumes Battery Gauge upon execution.' }),
      queenOverdrive: ab({ name: 'Queen Overdrive', recast: 15, desc: 'Orders the Automaton Queen to use Pile Bunker.\nPile Bunker Potency: 800\nPotency increases as Battery Gauge exceeds required cost at time of deployment.\nThe Automaton Queen shuts down after execution.' }),
      flamethrower: ab({ name: 'Flamethrower', recast: 60, desc: 'Delivers damage over time to all enemies in a cone before you.\nPotency: 100\nDuration: 10s\nEffect ends upon using another action or moving.' }),
      tactician: ab({ name: 'Tactician', recast: V.tactician, desc: 'Reduces damage taken by self and nearby party members by 10%.\nDuration: 15s' }),
      // What the Queen does (not on your hotbars).
      rollerDash: { name: 'Roller Dash', kind: 'pet', pet: true, potency: 300, delay: 0.3, fx: 'gnbCont' },
      armPunch: { name: 'Arm Punch', kind: 'pet', pet: true, potency: 150, delay: 0.3, fx: 'gnbSlash' },
      pileBunker: { name: 'Pile Bunker', kind: 'pet', pet: true, potency: 800, delay: 0.5, fx: 'gnbDouble', big: true },
      wildfireBurst: { name: 'Wildfire', kind: 'hit', iconOf: 'wildfire', fx: 'gnbZone' },
      // The physical ranged role actions of 5.x.
      legGraze: ab({ name: 'Leg Graze', recast: 30, role: true, target: true, range: 25, desc: 'Afflicts target with Heavy +40%.\nDuration: 10s' }),
      secondWind: ab({ name: 'Second Wind', recast: 120, role: true, desc: 'Instantly restores own HP.\nCure Potency: 500' }),
      footGraze: ab({ name: 'Foot Graze', recast: 30, role: true, target: true, range: 25, desc: 'Binds target.\nDuration: 10s' }),
      peloton: ab({ name: 'Peloton', recast: 5, role: true, desc: 'Increases movement speed of self and nearby party members.\nDuration: 30s\nHas no effect in battle.' }),
      headGraze: ab({ name: 'Head Graze', recast: 30, role: true, target: true, range: 25, desc: 'Interrupts the use of a target\'s action.' }),
      armsLength: ab({ name: 'Arm\'s Length', recast: 120, role: true, desc: 'Creates a barrier nullifying most knockback and draw-in effects.\nDuration: 6s' }),
      ...B.GENERAL_ACTIONS,
      tincture: B.tincture(V.tincture),
      auto: { name: 'Shot', kind: 'auto', fx: 'auto', desc: 'Auto-attack.' },
    };
  }

  const STATUSES = {
    reassembled: { name: 'Reassembled', self: true, icon: 'st_reassemble' },
    flamethrower: { name: 'Flamethrower', self: true, icon: 'st_flame' },
    tactician: { name: 'Tactician', self: true, icon: 'st_tactician' },
    peloton: { name: 'Peloton', self: true, icon: 'st_peloton' },
    wildfire: { name: 'Wildfire', self: false, icon: 'st_wildfire' },
    bioblaster: { name: 'Bioblaster', self: false, icon: 'st_bio' },
  };

  class MachinistShB {
    constructor(version) {
      const V = VERSIONS[version];
      this.V = V;
      this.name = 'Machinist';
      this.abbr = 'MCH';
      this.role = 'ranged';
      this.level = 80;
      this.levelKey = 'shb80';
      this.model = 'mch-shb';
      this.actions = buildActions(V);
      this.statuses = STATUSES;
      this.comboTime = 15;
      // Increased Action Damage II: +20%.
      this.stats = Object.assign({ mainStat: 'dex', jobMod: 115, trait: 120, delay: 2.64 }, V.stats);
      this.speedName = 'Skill speed';
      this.tierHaste = 0;
      this.autoAttack = { potency: 100, delay: 2.64, range: 25 };
      this.selfStatusOrder = ['reassembled', 'flamethrower', 'tactician', 'medicated', 'peloton', 'armsLength', 'sprint'];
      this.targetStatusOrder = ['wildfire', 'bioblaster'];
      this.defaultBars = [
        ['heatedSplitShot', 'heatedSlugShot', 'heatedCleanShot', 'drill', 'airAnchor', 'heatBlast', 'hypercharge2', 'gaussRound', 'ricochet', 'wildfire', 'reassemble', 'barrelStabilizer'],
        ['automatonQueen', 'queenOverdrive', 'tincture', 'tactician', 'flamethrower', 'headGraze', 'secondWind', 'legGraze', 'footGraze', 'peloton', 'armsLength', 'sprint'],
        ['spreadShot', 'autoCrossbow', 'bioblaster', null, null, null, null, null, null, null, null, null],
      ];
      this.actionGroups = [
        ['Machinist', ['heatedSplitShot', 'heatedSlugShot', 'heatedCleanShot', 'drill', 'airAnchor', 'heatBlast', 'spreadShot', 'autoCrossbow', 'bioblaster',
          'hypercharge2', 'wildfire', 'detonator', 'reassemble', 'gaussRound', 'ricochet', 'barrelStabilizer', 'automatonQueen', 'queenOverdrive', 'flamethrower', 'tactician']],
        ['Role Actions', ['legGraze', 'secondWind', 'footGraze', 'peloton', 'headGraze', 'armsLength']],
        ['General', ['sprint', 'tincture']],
      ];
      this.referenceDps = V.ref;
      this.referenceGcd = V.gcd;
      this.startDistance = 12;
    }

    initGauge() { return { heat: 0, battery: 0, overheatUntil: 0, wf: 0, wfSnap: null, queen: null, flameNext: 0 }; }

    overheated(e) { return e.g.overheatUntil > e.now + EPS; }

    resolveId(id, e) { return id === 'wildfire' && e.tHas('wildfire') ? 'detonator' : id; }

    check(id, e) {
      const a = this.actions[id], g = e.g;
      if (a.overheat && !this.overheated(e)) return 'Unable to execute action. Firearm is not Overheated.';
      if (id === 'hypercharge2' && (g.heat < 50 || this.overheated(e))) return 'Not enough Heat.';
      if (id === 'barrelStabilizer' && !e.inCombat) return 'Unable to execute action while not in combat.';
      if (id === 'automatonQueen' && (g.battery < 50 || g.queen)) return 'Not enough Battery.';
      if (id === 'queenOverdrive' && !g.queen) return 'Unable to execute action. Automaton Queen required.';
      if (id === 'detonator' && !e.tHas('wildfire')) return 'Unable to execute action.';
      if (id === 'peloton' && e.inCombat) return 'Unable to execute action while in combat.';
      return null;
    }

    snapshot(a, e) {
      const main = this.stats.main + (e.has('medicated') ? B.TINCTURES[this.V.tincture].cap : 0);
      return { mult: a && a.pet ? QUEEN : 1, main };
    }

    heat(e, n) { e.g.heat = Math.max(0, Math.min(100, e.g.heat + n)); }
    battery(e, n) { e.g.battery = Math.max(0, Math.min(100, e.g.battery + n)); }
    cut(e, id, sec) { const c = e.cd(id); if (c.nextAt !== null) c.nextAt -= sec; }

    resolve(id, e) {
      if (id !== 'flamethrower' && e.has('flamethrower')) e.removeStatus('flamethrower');
      if (this.actions[id].kind === 'gcd') this.weaponskill(id, e);
      else this.ability(id, e);
    }

    weaponskill(id, e) {
      const a = this.actions[id], g = e.g;
      const combo = !!a.comboFrom && e.lastComboHit;
      let potency = a.comboFrom && combo ? a.comboPotency : a.potency;
      if (a.single && this.overheated(e)) potency += 20;
      if (a.heat && (!a.comboFrom || combo)) this.heat(e, a.heat);
      if (a.battery && (!a.comboFrom || combo)) this.battery(e, a.battery);
      if (id === 'heatBlast') { this.cut(e, 'gaussRound', 15); this.cut(e, 'ricochet', 15); }
      if (e.tHas('wildfire')) g.wf++;
      const opts = {};
      if (e.has('reassembled')) { e.removeStatus('reassembled'); opts.crit = true; opts.dh = true; }
      const snap = this.snapshot(a, e);
      const after = a.dot ? () => e.addTStatus(id, a.dot.duration, { snap, dot: { potency: a.dot.potency, id } }) : null;
      e.queueHit(id, potency, snap, a.delay, after, opts);
    }

    ability(id, e) {
      const a = this.actions[id], g = e.g;
      switch (id) {
        case 'hypercharge2': this.heat(e, -50); g.overheatUntil = e.now + OVERHEAT; e.emit('overheat', {}); return;
        case 'wildfire':
          g.wf = 0;
          g.wfSnap = Object.assign(this.snapshot(a, e), { critAdd: -10, dhAdd: -10 });
          e.addTStatus('wildfire', 10);
          return;
        case 'detonator': this.burst(e); return;
        case 'reassemble': e.addStatus('reassembled', 5); return;
        case 'barrelStabilizer': this.heat(e, 50); return;
        case 'automatonQueen': {
          const b = g.battery, dur = b / 5;
          g.battery = 0;
          // Roller Dash, then an Arm Punch every 1.5s, then Pile Bunker as it runs out (80 per 10 Battery).
          const hits = [{ at: e.now + 2, id: 'rollerDash', potency: 300 }];
          for (let k = 0; k < b / 10 - 2; k++) hits.push({ at: e.now + 3.5 + 1.5 * k, id: 'armPunch', potency: 150 });
          hits.push({ at: e.now + dur - 0.5, id: 'pileBunker', potency: 8 * b });
          g.queen = { hits, bunker: 8 * b, until: e.now + dur };
          e.pet = { kind: 'queen' };
          return;
        }
        case 'queenOverdrive': {
          const q = g.queen;
          q.hits = q.hits.filter(h => h.id !== 'pileBunker' && h.at <= e.now + EPS);
          q.hits.push({ at: e.now + 0.5, id: 'pileBunker', potency: q.bunker });
          q.until = e.now + 0.6;
          return;
        }
        case 'flamethrower': e.addStatus('flamethrower', 10); g.flameNext = e.now + 1; return;
        case 'tactician': e.addStatus('tactician', 15); return;
        case 'peloton': e.addStatus('peloton', 30); return;
        default:
          if (B.ROLE_EFFECTS[id]) { B.ROLE_EFFECTS[id](e); return; }
      }
      if (a.potency) e.queueHit(id, a.potency, this.snapshot(a, e), a.delay);
    }

    // Wildfire goes off: 200 for each weaponskill landed under it, with the buffs it was put on with.
    burst(e) {
      const g = e.g;
      if (!e.tStatuses.wildfire) return;
      delete e.tStatuses.wildfire;
      e.emit('statusLose', { key: 'wildfire', self: false });
      if (g.wf > 0) e.queueHit('wildfireBurst', 200 * g.wf, g.wfSnap, 0.1);
      g.wf = 0;
    }

    nextEvent(e) {
      const g = e.g;
      let t = Infinity;
      if (g.overheatUntil > e.now) t = Math.min(t, g.overheatUntil);
      if (g.queen) t = Math.min(t, g.queen.hits.length ? g.queen.hits[0].at : g.queen.until);
      if (e.has('flamethrower')) t = Math.min(t, g.flameNext);
      if (e.tStatuses.wildfire) t = Math.min(t, e.tStatuses.wildfire.until);
      return t;
    }

    process(e) {
      const g = e.g, now = e.now;
      if (g.overheatUntil && now >= g.overheatUntil - EPS) g.overheatUntil = 0;
      // The Queen attacks with your buffs at the time, at about 90% of your damage.
      if (g.queen) {
        while (g.queen.hits.length && now >= g.queen.hits[0].at - EPS) {
          const h = g.queen.hits.shift();
          e.emit('petUse', { id: h.id });
          e.queueHit(h.id, h.potency, this.snapshot(this.actions[h.id], e), this.actions[h.id].delay);
        }
        if (!g.queen.hits.length && now >= g.queen.until - EPS) { g.queen = null; e.pet = null; }
      }
      if (e.has('flamethrower') && now >= g.flameNext - EPS) {
        g.flameNext += 1;
        e.queueHit('flamethrower', 100, this.snapshot(this.actions.flamethrower, e), 0.1);
      }
      const wf = e.tStatuses.wildfire;
      if (wf && now >= wf.until - EPS) this.burst(e);
    }
    frame(e) {
      if (e.moving && e.has('flamethrower')) e.removeStatus('flamethrower');
    }

    proc(id, e) {
      const a = this.actions[id], g = e.g;
      if (a.comboFrom && e.inCombo(a.comboFrom)) return true;
      if (a.overheat) return this.overheated(e);
      if (id === 'hypercharge2') return g.heat >= 50 && !this.overheated(e);
      if (id === 'automatonQueen') return g.battery >= 50 && !g.queen;
      return false;
    }

    mpRegen() { return B.BASE_REGEN; }
    speedInfo(e) { return `GCD ${e.gcdForSpeed(e.stats.speed).toFixed(2)} · Heat Blast 1.50 · Drill ${e.speedScale(20).toFixed(1)}s, Air Anchor ${e.speedScale(40).toFixed(1)}s`; }

    // ---------- Heat and Battery ----------
    gaugeBuild(root) {
      root.innerHTML = `
<svg width="360" height="140" viewBox="0 0 360 140">
  <defs><linearGradient id="ms-h" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#9a3a10"/><stop offset="1" stop-color="#ffb04a"/></linearGradient>
  <linearGradient id="ms-b" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#1a5a8a"/><stop offset="1" stop-color="#7fe0ff"/></linearGradient></defs>
  <rect x="8" y="10" width="344" height="120" rx="14" fill="rgba(14,12,20,.86)" stroke="rgba(255,255,255,.22)"/>
  <text id="ms-hl" x="24" y="34" font-family="Noto Sans, sans-serif" font-size="11" font-weight="600" fill="#a9a3b4" letter-spacing="1">HEAT</text>
  <rect x="24" y="42" width="250" height="12" rx="6" fill="#2a2535" stroke="rgba(0,0,0,.8)"/>
  <rect id="ms-hb" x="24" y="42" width="0" height="12" rx="6" fill="url(#ms-h)"/>
  <line x1="149" y1="38" x2="149" y2="58" stroke="rgba(255,255,255,.5)"/>
  <text id="ms-ht" x="336" y="54" text-anchor="end" font-family="Saira Semi Condensed, sans-serif" font-size="18" font-weight="700" fill="#fff" stroke="#000" stroke-width="3" paint-order="stroke">0</text>
  <text id="ms-bl" x="24" y="80" font-family="Noto Sans, sans-serif" font-size="11" font-weight="600" fill="#a9a3b4" letter-spacing="1">BATTERY</text>
  <rect x="24" y="88" width="250" height="12" rx="6" fill="#2a2535" stroke="rgba(0,0,0,.8)"/>
  <rect id="ms-bb" x="24" y="88" width="0" height="12" rx="6" fill="url(#ms-b)"/>
  <line x1="149" y1="84" x2="149" y2="104" stroke="rgba(255,255,255,.5)"/>
  <text id="ms-bt" x="336" y="100" text-anchor="end" font-family="Saira Semi Condensed, sans-serif" font-size="18" font-weight="700" fill="#fff" stroke="#000" stroke-width="3" paint-order="stroke">0</text>
  <text id="ms-s" x="24" y="122" font-family="Noto Sans, sans-serif" font-size="12" font-weight="600" fill="#ffd98a" letter-spacing="1"></text>
</svg>`;
      const $ = (s) => root.querySelector(s);
      this.mg = { hb: $('#ms-hb'), ht: $('#ms-ht'), bb: $('#ms-bb'), bt: $('#ms-bt'), s: $('#ms-s'), cache: {} };
    }

    gaugeUpdate(e) {
      const G = this.mg, c = G.cache, g = e.g;
      const put = (k, v, fn) => { if (c[k] !== v) { c[k] = v; fn(v); } };
      put('h', g.heat, v => { G.hb.setAttribute('width', String(250 * v / 100)); G.ht.textContent = String(v); });
      put('b', g.battery, v => { G.bb.setAttribute('width', String(250 * v / 100)); G.bt.textContent = String(v); });
      const oh = this.overheated(e) ? Math.ceil(g.overheatUntil - e.now) : 0;
      const q = g.queen ? Math.ceil(g.queen.until - e.now) : 0;
      put('s', `${oh}|${q}`, () => { G.s.textContent = [oh ? `OVERHEATED ${oh}s` : '', q ? `QUEEN ${q}s` : ''].filter(Boolean).join('  ·  '); });
    }

    helpHtml(seq) {
      const V = this.V;
      return `
<h3>How it plays (${V.label})</h3>
<p>Level 80 Machinist. <b>Heated Split Shot → Heated Slug Shot → Heated Clean Shot</b> (${V.split} / ${V.slug} / ${V.clean}) builds 5 Heat each and 10 Battery at the end. <b>Drill</b> (700, 20s) and <b>Air Anchor</b> (700, 40s, +20 Battery) don't break the combo; use them on cooldown, with <b>Reassemble</b> (${V.reassemble}s, a critical direct hit) on Drill.</p>
<p>At 50 Heat, <b>Hypercharge</b>: 8s of Overheat for five <b>Heat Blasts</b> (${V.blast} + 20, a flat 1.5s GCD), each taking 15s off <b>Gauss Round</b> and <b>Ricochet</b> (150, three charges each); weave one of those after every Heat Blast. Don't Hypercharge with Drill or Air Anchor under 8s from coming up. <b>Wildfire</b> (120s) adds 200 for every weaponskill in its 10s, so put it on the first Heat Blast for six. <b>Barrel Stabilizer</b> (120s) gives 50 Heat. At 50+ Battery, the <b>Automaton Queen</b> spends it all for 10–20s (about 80 Battery each minute).</p>
<h3>The opener (The Balance, "General Purpose")</h3>
${seq(['drill', ['gaussRound'], ['ricochet'], 'heatedSplitShot', ['barrelStabilizer'], 'heatedSlugShot', 'airAnchor', ['gaussRound'], ['ricochet'], 'heatedCleanShot', ['gaussRound'], ['hypercharge2'], 'heatBlast', ['wildfire'], 'heatBlast', ['ricochet'], 'heatBlast', ['gaussRound'], 'heatBlast', ['ricochet'], 'heatBlast', ['gaussRound'], 'drill', ['ricochet'], 'heatedSplitShot', 'heatedSlugShot', 'heatedCleanShot'])}
<p>Reassemble and the tincture before the pull. No Queen in the opener; summon her a GCD before the next burst.${V.reassemble === 60 ? ' No 5.0 opener text survives; this is the 5.5x one, which uses nothing that changed.' : ''}</p>
<p style="color:#a9a3b4">The ${V.reassemble === 60 ? '5.0–5.01' : '5.58'} numbers: Heated Split ${V.split}, Slug ${V.slug} and Clean ${V.clean} in combo, Drill 700, Air Anchor 700, Heat Blast ${V.blast} (+20 Overheated), Gauss Round and Ricochet 150, Wildfire 200 per weaponskill, Spread Shot 180, Auto Crossbow 180; the Queen: Roller Dash 300, Arm Punch 150, Pile Bunker 80 per 10 Battery, at about 90% (The Balance's totals; the punch timing is an estimate); Increased Action Damage II +20%; auto-attacks 100 at 2.64s. Gear: ${V.gear}, pre-6.0 stats from the 5.58 game data.</p>`;
    }
  }

  B.registerJob({
    id: 'mch', name: 'Machinist', abbr: 'MCH', role: 'ranged', classJob: 31,
    versions: ['shb505', 'shb50'].map(v => ({ id: v, label: VERSIONS[v].label, history: VERSIONS[v].history, note: VERSIONS[v].note, create: () => new MachinistShB(v) })),
  });
})(window.BLM);
