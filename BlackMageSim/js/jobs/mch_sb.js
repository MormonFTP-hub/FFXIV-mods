// Machinist, Stormblood (patches 4.06–4.58) at level 70: the Split → Slug → Clean combo (Heated versions at 50 Heat),
// its procs (Enhanced Slug Shot, Cleaner Shot; ammunition makes them certain and adds 30 potency), Gauss Barrel's
// Heat Gauge (5 a weaponskill; at 100, Overheated: +20% for 10s, then the barrel comes off for 10s), Cooldown,
// Barrel Stabilizer and Flamethrower for Heat, Hot Shot (+10%), Wildfire (a quarter of your damage over 10s, dealt at
// the end), Rapid Fire, Reassemble, Gauss Round, Ricochet, and the Rook Autoturret with Hypercharge and Rook Overdrive.
// Everything on TP. Numbers are the final 4.5 values (4.5 raised the ammunition bonus, Hot Shot, Gauss Round and
// Ricochet): the game data at 4.58 (xivapi's datamining) and the Lodestone notes.
(function (B) {
  const EPS = 1e-6;
  const FALLOFF = [1, 0.9, 0.8, 0.7, 0.6, 0.5];
  const ws = (o) => Object.assign({ kind: 'gcd', target: true, range: 25, delay: 0.5, fx: 'gnbShot', shot: true }, o);
  const ab = (o) => Object.assign({ kind: 'ogcd' }, o);
  const ACTIONS = {
    splitShot: ws({ name: 'Split Shot', potency: 160, tp: 50, comboStart: true, comboNext: true, slugProc: true, desc: 'Delivers an attack with a potency of 160.\nAdditional Effect: 50% chance next Slug Shot will be enhanced (+100)\nDuration: 10s\nAmmunition Bonus: +30 potency, and the enhancement is certain\nGauss Barrel Bonus: Heat +5' }),
    slugShot: ws({ name: 'Slug Shot', potency: 100, comboPotency: 200, comboFrom: 'splitShot', comboNext: true, tp: 50, cleanProc: true, desc: 'Delivers an attack with a potency of 100.\nCombo Action: Split Shot\nCombo Potency: 200\nEnhanced Slug Shot: +100\nAdditional Effect: 50% chance next Clean Shot will be enhanced (+140)\nDuration: 10s\nAmmunition Bonus: +30 potency, and the enhancement is certain\nGauss Barrel Bonus: Heat +5' }),
    cleanShot: ws({ name: 'Clean Shot', potency: 100, comboPotency: 240, comboFrom: 'slugShot', tp: 50, desc: 'Delivers an attack with a potency of 100.\nCombo Action: Slug Shot\nCombo Potency: 240\nCleaner Shot: +140\nAmmunition Bonus: +30 potency\nGauss Barrel Bonus: Heat +5' }),
    heatedSplitShot: ws({ name: 'Heated Split Shot', potency: 190, tp: 50, comboStart: true, comboNext: true, slugProc: true, combo: 'splitShot', comboAs: 'splitShot', desc: 'Delivers an attack with a potency of 190.\nAdditional Effect: 50% chance next Heated Slug Shot will be enhanced (+130)\nAmmunition Bonus: +30 potency, and the enhancement is certain\nReplaces Split Shot at 50 Heat or more.' }),
    heatedSlugShot: ws({ name: 'Heated Slug Shot', potency: 100, comboPotency: 230, comboFrom: 'splitShot', comboNext: true, tp: 50, cleanProc: true, combo: 'slugShot', comboAs: 'slugShot', slugBonus: 130, desc: 'Delivers an attack with a potency of 100.\nCombo Action: Split Shot or Heated Split Shot\nCombo Potency: 230\nEnhanced Slug Shot: +130\nAdditional Effect: 50% chance next Heated Clean Shot will be enhanced (+170)\nAmmunition Bonus: +30 potency, and the enhancement is certain\nReplaces Slug Shot at 50 Heat or more.' }),
    heatedCleanShot: ws({ name: 'Heated Clean Shot', potency: 100, comboPotency: 270, comboFrom: 'slugShot', tp: 50, combo: 'cleanShot', cleanBonus: 170, desc: 'Delivers an attack with a potency of 100.\nCombo Action: Slug Shot or Heated Slug Shot\nCombo Potency: 270\nCleaner Shot: +170\nAmmunition Bonus: +30 potency\nReplaces Clean Shot at 50 Heat or more.' }),
    hotShot: ws({ name: 'Hot Shot', potency: 120, tp: 60, breaksCombo: true, desc: 'Delivers an attack with a potency of 120.\nAdditional Effect: Increases damage dealt by 10%\nDuration: 60s\nAmmunition Bonus: +30 potency\nGauss Barrel Bonus: Heat +5' }),
    cooldown: ws({ name: 'Cooldown', potency: 150, heatPotency: 230, tp: 60, desc: 'Delivers an attack with a potency of 150 (230 at 50 Heat or more).\nGauss Barrel Bonus: Heat −25\nAmmunition Bonus: +30 potency' }),
    spreadShot: ws({ name: 'Spread Shot', potency: 80, tp: 120, range: 12, aoe: true, desc: 'Delivers an attack with a potency of 80 to all enemies in a cone before you.\nAmmunition Bonus: +30 potency\nGauss Barrel Bonus: Heat +5' }),
    reload: ab({ name: 'Reload', recast: 30, desc: 'Loads three rounds of ammunition.' }),
    quickReload: ab({ name: 'Quick Reload', recast: 15, desc: 'Loads one round of ammunition (up to three).' }),
    reassemble: ab({ name: 'Reassemble', recast: 60, desc: 'Guarantees that the next weaponskill is a critical hit.\nDuration: 20s' }),
    gaussRound: ab({ name: 'Gauss Round', recast: 15, potency: 210, target: true, range: 25, delay: 0.5, fx: 'gnbShot', desc: 'Delivers an attack with a potency of 210.' }),
    ricochet: ab({ name: 'Ricochet', recast: 60, potency: 320, target: true, range: 25, delay: 0.5, aoe: FALLOFF, fx: 'gnbBurst', desc: 'Delivers an attack with a potency of 320 to target and all enemies nearby it, 10% less for each further enemy down to 50% less.' }),
    wildfire: ab({ name: 'Wildfire', recast: 60, target: true, range: 25, desc: 'Covers target\'s body in a slow-burning pyretic. While active, 25% of the damage you deal is stored, then dealt to the target when the effect ends.\nDuration: 10s\nTurret damage doesn\'t count.' }),
    rapidFire: ab({ name: 'Rapid Fire', recast: 60, desc: 'The next three weaponskills have a 1.5s recast.\nDuration: 15s' }),
    hypercharge: ab({ name: 'Hypercharge', recast: 120, desc: 'Your Rook Autoturret fires Charged Volley Fire (120), and its hits leave the target taking 5% more damage for 10s.\nDuration: 20s\nCan only be executed while the turret is deployed.' }),
    gaussBarrel: ab({ name: 'Gauss Barrel', recast: 2, desc: 'Attaches the Gauss Barrel: weaponskill damage +5% and weaponskills build Heat. At 100 Heat: Overheated (+20%) for 10s, then the barrel comes off and can\'t be attached for 10s.\nPress again to remove it.' }),
    barrelStabilizer: ab({ name: 'Barrel Stabilizer', recast: 60, desc: 'Sets Heat to 50.\nCan only be executed in combat with the Gauss Barrel attached and not Overheated.' }),
    flamethrower: ab({ name: 'Flamethrower', recast: 60, desc: 'Channels a cone of flame: 60 potency every second for 10s.\nGauss Barrel Bonus: Heat +20 over the channel\nEnds if you act or move.' }),
    rookAutoturret: ab({ name: 'Rook Autoturret', recast: 10, desc: 'Deploys a single-target turret that fires Volley Fire (80) every 3s.\nPress again to retrieve it.' }),
    rookOverdrive: ab({ name: 'Rook Overdrive', recast: 120, target: true, range: 25, desc: 'Orders the Rook Autoturret to fire Rook Overload (800); the turret then shuts down for 30s.' }),
    // What the turret fires (not on your hotbars).
    volleyFire: { name: 'Volley Fire', kind: 'pet', pet: true, potency: 80, delay: 0.4, fx: 'gnbShot' },
    chargedVolleyFire: { name: 'Charged Volley Fire', kind: 'pet', pet: true, potency: 120, delay: 0.4, iconOf: 'volleyFire', fx: 'gnbBurst' },
    rookOverload: { name: 'Rook Overload', kind: 'pet', pet: true, potency: 800, delay: 0.8, fx: 'gnbDouble', big: true },
    wildfireBurst: { name: 'Wildfire', kind: 'hit', iconOf: 'wildfire', fx: 'gnbZone' },
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
    hotShot: { name: 'Hot Shot', self: true, icon: 'st_hot' },
    hypercharge: { name: 'Hypercharge', self: true, icon: 'st_hyper' },
    enhancedSlugShot: { name: 'Enhanced Slug Shot', self: true, icon: 'st_slug' },
    cleanerShot: { name: 'Cleaner Shot', self: true, icon: 'st_clean' },
    reassembled: { name: 'Reassembled', self: true, icon: 'st_reassemble' },
    rapidFire: { name: 'Rapid Fire', self: true, icon: 'st_rapid' },
    gaussBarrel: { name: 'Gauss Barrel', self: true, icon: 'st_barrel' },
    flamethrower: { name: 'Flamethrower', self: true, icon: 'st_flame' },
    ammunition: { name: 'Ammunition Loaded', self: true, icon: 'st_ammo' },
    peloton: { name: 'Peloton', self: true, icon: 'st_peloton' },
    wildfire: { name: 'Wildfire', self: false, icon: 'st_wildfire' },
    vulnerabilityUp: { name: 'Vulnerability Up', self: false, icon: 'st_vuln' },
  };

  class MachinistSB {
    constructor() {
      this.name = 'Machinist';
      this.abbr = 'MCH';
      this.role = 'ranged';
      this.level = 70;
      this.levelKey = 'sb70';
      this.model = 'mch-sb';
      this.actions = ACTIONS;
      this.statuses = STATUSES;
      this.tp = { max: 1000, regen: 60 };
      this.comboTime = 15;
      // A rough 4.5 Alphascape set (Omegafire: 109 weapon damage, 2.64 delay in the 4.58 item data); level-70 stats.
      // Increased Action Damage II: +20% to your actions and the turret.
      this.stats = { hp: 30000, main: 3280, mainStat: 'dex', jobMod: 115, trait: 120, wd: 109, det: 1550, crit: 2600,
        dh: 2250, speed: 800, delay: 2.64 };
      this.speedName = 'Skill speed';
      this.tierHaste = 0;
      this.autoAttack = { potency: 110, delay: 2.64, range: 25 };
      this.selfStatusOrder = ['gaussBarrel', 'hotShot', 'rapidFire', 'reassembled', 'enhancedSlugShot', 'cleanerShot', 'ammunition', 'flamethrower',
        'medicated', 'peloton', 'sprint'];
      this.targetStatusOrder = ['wildfire', 'vulnerabilityUp'];
      this.defaultBars = [
        ['splitShot', 'slugShot', 'cleanShot', 'hotShot', 'cooldown', 'reload', 'quickReload', 'reassemble', 'gaussRound', 'ricochet', 'wildfire', 'rapidFire'],
        ['gaussBarrel', 'barrelStabilizer', 'flamethrower', 'rookAutoturret', 'hypercharge', 'rookOverdrive', 'tincture', 'invigorate', 'headGraze', 'secondWind', 'peloton', 'spreadShot'],
        ['sprint', null, null, null, null, null, null, null, null, null, null, null],
      ];
      this.actionGroups = [
        ['Machinist', ['splitShot', 'slugShot', 'cleanShot', 'heatedSplitShot', 'heatedSlugShot', 'heatedCleanShot', 'hotShot', 'cooldown',
          'spreadShot', 'reload', 'quickReload', 'reassemble', 'gaussRound', 'ricochet', 'wildfire', 'rapidFire', 'hypercharge', 'gaussBarrel',
          'barrelStabilizer', 'flamethrower', 'rookAutoturret', 'rookOverdrive']],
        ['Role Actions', ['invigorate', 'secondWind', 'headGraze', 'peloton']],
        ['General', ['sprint', 'tincture']],
      ];
      this.referenceDps = 9000;     // a scripted 4.5 rotation parses about 8,500 on the dummy
      this.referenceGcd = 2.43;
      this.startDistance = 12;
    }

    initGauge(e) {
      e.addStatus('gaussBarrel', 1e9, { permanent: true });
      return { heat: 0, ammo: 0, overheatUntil: 0, barrelLockUntil: 0, rapid: 0, turret: false, turretNext: 0, turretLockUntil: 0, wf: 0, flameNext: 0 };
    }

    barrel(e) { return e.has('gaussBarrel'); }
    overheated(e) { return e.g.overheatUntil > e.now + EPS; }

    // The combo buttons turn into their Heated versions at 50 Heat.
    resolveId(id, e) {
      if (e.g.heat >= 50 || this.overheated(e)) {
        if (id === 'splitShot') return 'heatedSplitShot';
        if (id === 'slugShot') return 'heatedSlugShot';
        if (id === 'cleanShot') return 'heatedCleanShot';
      }
      return id;
    }

    check(id, e) {
      const g = e.g;
      if (id === 'hypercharge' && !g.turret) return 'Unable to execute action. Autoturret required.';
      if (id === 'rookOverdrive' && !g.turret) return 'Unable to execute action. Autoturret required.';
      if (id === 'rookAutoturret' && !g.turret && g.turretLockUntil > e.now) return 'Unable to execute action. Turret Reset.';
      if (id === 'barrelStabilizer' && (!this.barrel(e) || this.overheated(e) || !e.inCombat)) return 'Unable to execute action.';
      if (id === 'gaussBarrel' && !this.barrel(e) && g.barrelLockUntil > e.now) return 'Unable to execute action. The barrel is cooling.';
      if (id === 'quickReload' && g.ammo >= 3) return 'Unable to execute action. Ammunition is full.';
      if (id === 'reload' && g.ammo >= 3) return 'Unable to execute action. Ammunition is full.';
      if (id === 'peloton' && e.inCombat) return 'Unable to execute action while in combat.';
      return null;
    }

    // Rapid Fire: the next three weaponskills recast in about 1.5s.
    haste(e) {
      if (e.g.rapid > 0 && e.has('rapidFire')) {
        const base = e.gcdForSpeed(e.stats.speed);
        return Math.floor(100 * (1 - 1.5 / base));
      }
      return 0;
    }

    snapshot(a, e) {
      let mult = 1, critAdd = 0;
      const pet = !!(a && a.pet);
      if (!pet) {
        if (e.has('hotShot')) mult *= 1.10;
        if (this.barrel(e) && a && a.shot) mult *= 1.05;
        if (this.overheated(e)) mult *= 1.20;
      }
      if (e.tHas('vulnerabilityUp')) mult *= 1.05;
      const main = this.stats.main + (e.has('medicated') ? B.TINCTURES.dex3sb.cap : 0);
      return { mult, main, critAdd };
    }

    addHeat(e, n) {
      const g = e.g;
      if (!this.barrel(e) || this.overheated(e)) return;
      g.heat = Math.max(0, Math.min(100, g.heat + n));
      if (g.heat >= 100) {
        g.overheatUntil = e.now + 10;
        e.emit('overheat', {});
      }
    }

    resolve(id, e) {
      // Flamethrower is a channel: anything else ends it.
      if (id !== 'flamethrower' && e.has('flamethrower')) e.removeStatus('flamethrower');
      if (this.actions[id].kind === 'gcd') this.weaponskill(id, e);
      else this.ability(id, e);
    }

    weaponskill(id, e) {
      const a = this.actions[id], g = e.g;
      const combo = !!a.comboFrom && e.lastComboHit;
      let potency = a.comboFrom && combo ? a.comboPotency : a.potency;
      if (id === 'cooldown' && (g.heat >= 50 || this.overheated(e))) potency = a.heatPotency;
      const ammo = g.ammo > 0;
      if (ammo) { g.ammo--; potency += 30; if (!g.ammo) e.removeStatus('ammunition', true); }
      const kind = a.combo || id;
      if (kind === 'slugShot' && e.has('enhancedSlugShot')) { potency += a.slugBonus || 100; e.removeStatus('enhancedSlugShot'); }
      if (kind === 'cleanShot' && e.has('cleanerShot')) { potency += a.cleanBonus || 140; e.removeStatus('cleanerShot'); }
      if (a.slugProc && (ammo || Math.random() < 0.5)) e.addStatus('enhancedSlugShot', 10);
      if (a.cleanProc && (ammo || Math.random() < 0.5)) e.addStatus('cleanerShot', 10);
      if (id === 'hotShot') e.addStatus('hotShot', 60);
      if (id === 'cooldown') this.addHeat(e, -25);
      else if (!ammo) this.addHeat(e, 5);
      if (g.rapid > 0) { g.rapid--; if (!g.rapid) e.removeStatus('rapidFire'); }
      const crit = e.has('reassembled');
      if (crit) e.removeStatus('reassembled');
      e.queueHit(id, potency, this.snapshot(a, e), a.delay, null, { crit });
    }

    ability(id, e) {
      const a = this.actions[id], g = e.g;
      switch (id) {
        case 'reload': g.ammo = 3; e.addStatus('ammunition', 1e9, { permanent: true }); return;
        case 'quickReload': g.ammo = Math.min(3, g.ammo + 1); e.addStatus('ammunition', 1e9, { permanent: true }); return;
        case 'reassemble': e.addStatus('reassembled', 20); return;
        case 'rapidFire': g.rapid = 3; e.addStatus('rapidFire', 15); return;
        case 'wildfire': g.wf = 0; e.addTStatus('wildfire', 10); return;
        case 'hypercharge': e.addStatus('hypercharge', 20); return;
        case 'gaussBarrel':
          if (this.barrel(e)) { e.removeStatus('gaussBarrel'); g.heat = 0; }
          else e.addStatus('gaussBarrel', 1e9, { permanent: true });
          return;
        case 'barrelStabilizer': g.heat = 50; return;
        case 'flamethrower': e.addStatus('flamethrower', 10); g.flameNext = e.now + 1; return;
        case 'rookAutoturret':
          if (g.turret) { g.turret = false; e.pet = null; }
          else { g.turret = true; e.pet = { kind: 'rook' }; g.turretNext = e.now + 1; }
          return;
        case 'rookOverdrive':
          this.turretShot(e, 'rookOverload');
          g.turret = false; g.turretLockUntil = e.now + 30;
          e.pet = null;
          return;
        case 'invigorate': B.ROLE_EFFECTS.invigorate(e); return;
        case 'peloton': e.addStatus('peloton', 30); return;
        default:
          if (B.ROLE_EFFECTS[id]) { B.ROLE_EFFECTS[id](e); return; }
      }
      if (a.potency) e.queueHit(id, a.potency, this.snapshot(a, e), a.delay);
    }

    turretShot(e, id) {
      const a = this.actions[id];
      e.emit('petUse', { id });
      e.queueHit(id, a.potency, this.snapshot(a, e), a.delay, id === 'chargedVolleyFire' ? () => e.addTStatus('vulnerabilityUp', 10) : null);
    }

    // Wildfire keeps a quarter of what you deal while it's on (not the turret's).
    onHit(h, r, e) {
      const a = this.actions[h.id];
      if (h.id === 'wildfireBurst' || (a && a.pet)) return;
      if (e.tHas('wildfire')) e.g.wf += r.amount;
    }

    nextEvent(e) {
      const g = e.g;
      let t = Infinity;
      if (g.turret && e.inCombat) t = Math.min(t, Math.max(e.now, g.turretNext));
      if (g.overheatUntil > e.now) t = Math.min(t, g.overheatUntil);
      if (e.has('flamethrower')) t = Math.min(t, g.flameNext);
      if (e.tStatuses.wildfire) t = Math.min(t, e.tStatuses.wildfire.until);
      return t;
    }

    process(e) {
      const g = e.g, now = e.now;
      // The turret: Volley Fire every 3s, Charged Volley Fire under Hypercharge.
      if (g.turret && e.inCombat && now >= g.turretNext - EPS) {
        g.turretNext = now + 3;
        this.turretShot(e, e.has('hypercharge') ? 'chargedVolleyFire' : 'volleyFire');
      }
      // Overheat ends: the barrel comes off for 10s and Heat empties.
      if (g.overheatUntil && now >= g.overheatUntil - EPS) {
        g.overheatUntil = 0; g.heat = 0;
        e.removeStatus('gaussBarrel');
        g.barrelLockUntil = now + 10;
      }
      // Flamethrower: 60 potency a second while channelled, Heat +2 a tick.
      if (e.has('flamethrower') && now >= g.flameNext - EPS) {
        g.flameNext += 1;
        e.queueHit('flamethrower', 60, this.snapshot(this.actions.flamethrower, e), 0.1);
        this.addHeat(e, 2);
      }
      // Wildfire goes off.
      const wf = e.tStatuses.wildfire;
      if (wf && now >= wf.until - EPS) {
        delete e.tStatuses.wildfire;
        e.emit('statusLose', { key: 'wildfire', self: false });
        const amount = Math.floor(g.wf * 0.25);
        g.wf = 0;
        if (amount > 0) e.emit('hit', { id: 'wildfireBurst', amount, crit: false, dh: false, dot: false, t: now });
      }
    }
    frame(e) {
      if (e.moving && e.has('flamethrower')) e.removeStatus('flamethrower');
    }

    proc(id, e) {
      const g = e.g;
      if (id === 'heatedSlugShot' || id === 'slugShot') return e.has('enhancedSlugShot');
      if (id === 'heatedCleanShot' || id === 'cleanShot') return e.has('cleanerShot');
      if (id === 'cooldown') return g.heat >= 80 && !this.overheated(e);
      if (id === 'reload') return g.ammo === 0;
      return false;
    }

    mpRegen() { return B.BASE_REGEN; }
    speedInfo(e) { return `GCD ${e.gcdForSpeed(e.stats.speed).toFixed(2)} · Rapid Fire 1.50`; }

    // ---------- Heat Gauge and ammunition ----------
    gaugeBuild(root) {
      root.innerHTML = `
<svg width="360" height="150" viewBox="0 0 360 150">
  <defs><linearGradient id="mc-heat" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#3a6fd6"/><stop offset=".5" stop-color="#e0a02a"/><stop offset="1" stop-color="#ff4a2a"/></linearGradient></defs>
  <rect x="8" y="10" width="344" height="130" rx="14" fill="rgba(14,12,20,.86)" stroke="rgba(255,255,255,.22)"/>
  <text id="mc-lbl" x="24" y="38" font-family="Noto Sans, sans-serif" font-size="11" font-weight="600" fill="#a9a3b4" letter-spacing="1">HEAT</text>
  <text id="mc-n" x="336" y="40" text-anchor="end" font-family="Saira Semi Condensed, sans-serif" font-size="20" font-weight="700" fill="#fff" stroke="#000" stroke-width="3" paint-order="stroke">0</text>
  <rect x="24" y="52" width="312" height="16" rx="8" fill="#1d1a2a" stroke="rgba(255,255,255,.2)"/>
  <rect id="mc-bar" x="24" y="52" width="0" height="16" rx="8" fill="url(#mc-heat)"/>
  <line x1="180" y1="48" x2="180" y2="72" stroke="rgba(255,255,255,.5)"/>
  <text x="24" y="104" font-family="Noto Sans, sans-serif" font-size="11" font-weight="600" fill="#a9a3b4" letter-spacing="1">AMMUNITION</text>
  ${[0, 1, 2].map(k => `<rect id="mc-a${k}" x="${130 + k * 22}" y="90" width="12" height="22" rx="3" fill="#2a2535" stroke="rgba(0,0,0,.8)"/>`).join('')}
  <text id="mc-tur" x="336" y="106" text-anchor="end" font-family="Noto Sans, sans-serif" font-size="11" font-weight="600" fill="#9fc4ff" letter-spacing="1"></text>
</svg>`;
      const $ = (s) => root.querySelector(s);
      this.mg = { lbl: $('#mc-lbl'), n: $('#mc-n'), bar: $('#mc-bar'), ammo: [0, 1, 2].map(k => $('#mc-a' + k)), tur: $('#mc-tur'), cache: {} };
    }

    gaugeUpdate(e) {
      const G = this.mg, c = G.cache, g = e.g;
      const put = (k, v, fn) => { if (c[k] !== v) { c[k] = v; fn(v); } };
      const oh = this.overheated(e);
      put('lbl', oh ? 'OVERHEATED' : this.barrel(e) ? 'HEAT' : g.barrelLockUntil > e.now ? 'BARREL COOLING' : 'HEAT (BARREL OFF)', v => { G.lbl.textContent = v; });
      const shown = oh ? Math.round((g.overheatUntil - e.now) * 10) : g.heat;
      put('h', shown + (oh ? 'o' : ''), () => {
        G.bar.setAttribute('width', String(312 * (oh ? (g.overheatUntil - e.now) / 10 : g.heat / 100)));
        G.n.textContent = oh ? (g.overheatUntil - e.now).toFixed(1) : String(g.heat);
      });
      for (let i = 0; i < 3; i++) put('a' + i, g.ammo > i, v => G.ammo[i].setAttribute('fill', v ? '#e8c86a' : '#2a2535'));
      put('t', g.turret ? (e.has('hypercharge') ? 'ROOK · HYPERCHARGE' : 'ROOK') : g.turretLockUntil > e.now ? 'TURRET RESET' : '', v => { G.tur.textContent = v; });
    }

    helpHtml(seq) {
      return `
<h3>How it plays (Stormblood 4.06–4.58)</h3>
<p>Level 70 Machinist on TP. The combo is <b>Split Shot → Slug Shot → Clean Shot</b>; Split Shot has a 50% chance to enhance the next Slug Shot (+100), Slug Shot to enhance the next Clean Shot (+140). <b>Reload</b> (30s) loads three rounds and <b>Quick Reload</b> (15s) one: each round adds 30 potency and makes the enhancement certain, so load them into Split and Slug.</p>
<p>With the <b>Gauss Barrel</b> on (+5%), every weaponskill without ammunition adds 5 Heat. From 50 Heat the combo turns into the Heated shots (190, 230, 270). At 100 you're <b>Overheated</b>: +20% for 10s, then the barrel comes off for 10s and Heat empties. <b>Cooldown</b> (230 at 50 Heat) takes 25 away, <b>Barrel Stabilizer</b> sets it to 50, <b>Flamethrower</b> (a 10s channel, 60 a second) adds 20. Put the Overheat inside <b>Wildfire</b>, which stores a quarter of your damage for 10s and deals it at the end. <b>Hot Shot</b> is +10% for 60s, <b>Rapid Fire</b> three 1.5s GCDs, <b>Reassemble</b> a guaranteed crit. The <b>Rook Autoturret</b> fires every 3s; <b>Hypercharge</b> makes it fire 120 and leave 5% vulnerability, and <b>Rook Overdrive</b> ends it with an 800-potency shot.</p>
<h3>An opener for this version</h3>
${seq(['hotShot', ['hypercharge'], ['barrelStabilizer'], 'heatedSplitShot', ['gaussRound'], ['tincture'], 'heatedSlugShot', ['wildfire'], ['rapidFire'], 'heatedCleanShot', ['reassemble'], 'heatedSplitShot', ['ricochet'], 'heatedSlugShot', ['quickReload'], 'heatedCleanShot', 'heatedSplitShot', 'cooldown', ['rookOverdrive']])}
<p>Before the pull: Gauss Barrel on, Reload, Rook Autoturret. The Heated shots appear on the Split, Slug and Clean Shot buttons at 50 Heat. This follows the version's rules; it isn't copied from a published guide.</p>
<p style="color:#a9a3b4">The 4.5 numbers: Split Shot 160, Slug Shot combo 200 (+100), Clean Shot combo 240 (+140), Heated 190 / 230 (+130) / 270 (+170), ammunition +30, Hot Shot 120 (+10%), Cooldown 150 / 230, Gauss Round 210, Ricochet 320, Volley Fire 80, Charged Volley Fire 120, Rook Overload 800, Flamethrower 60 a second, Overheat +20%. Ammunition shots are taken to add no Heat; the turret uses your stats and isn't affected by your buffs. Auto-attacks 110 potency at 2.64s; gear approximate.</p>`;
    }
  }

  B.registerJob({
    id: 'mch', name: 'Machinist', abbr: 'MCH', role: 'ranged', classJob: 31,
    versions: [{ id: 'sb406', label: 'Stormblood 4.06–4.58', history: 'SB 4.06–4.58', note: 'Level 70. Heat and Overheat with the Gauss Barrel, ammunition, the Heated combo, Wildfire, Rapid Fire, Flamethrower, the Rook Autoturret with Hypercharge and Overdrive', create: () => new MachinistSB() }],
  });
})(window.BLM);
