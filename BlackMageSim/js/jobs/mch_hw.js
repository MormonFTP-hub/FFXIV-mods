// Machinist, Heavensward (patches 3.4–3.57) at level 60: before Heat. The Gauss Barrel is +30% damage, but while it's
// attached auto-attacks stop and every weaponskill needs a cast; Split Shot makes the next Slug Shot instant, Slug Shot
// the next Clean Shot, and Rapid Fire makes three weaponskills instant at a 1.5s recast. Reload loads five rounds
// (+20 potency each, and the Split / Slug procs become certain; from 3.4 they stay loaded until used), Quick Reload one
// and 30 TP. Hot Shot (+5% physical) and Lead Shot (a 30s DoT) stay up, Wildfire stores a quarter of 15s of damage,
// and the Rook Autoturret's Hypercharge doubles it and leaves the target taking 10% more physical damage. Archer and
// Lancer cross-class skills (Raging Strikes, Hawk's Eye, Blood for Blood, Invigorate). Everything on TP, Heavensward's
// damage formula (B.LEVELS.hw60). Numbers are the 3.5x tooltips (the FFXIV wiki's 2017 job page and Gamer Escape)
// after the 3.01, 3.07, 3.2 and 3.4 changes.
(function (B) {
  const EPS = 1e-6;
  const BARREL_CAST = 1.5;      // nothing says how long; an estimate
  const ws = (o) => Object.assign({ kind: 'gcd', target: true, range: 25, delay: 0.5, fx: 'gnbShot', shot: true, cast: BARREL_CAST }, o);
  const ab = (o) => Object.assign({ kind: 'ogcd' }, o);
  const ACTIONS = {
    splitShot: ws({ name: 'Split Shot', potency: 140, tp: 60, comboStart: true, comboNext: true, slugProc: true, desc: 'Delivers an attack with a potency of 140.\nAdditional Effect: 50% chance of increasing next Slug Shot potency by 80\nGauss Barrel Effect: Next Slug Shot will have no cast time\nDuration: 10s\nAmmunition Effect: 100% chance of increasing next Slug Shot potency' }),
    slugShot: ws({ name: 'Slug Shot', potency: 100, comboPotency: 180, comboFrom: 'splitShot', comboNext: true, tp: 60, cleanProc: true, desc: 'Delivers an attack with a potency of 100.\nSplit Shot Combo Potency: 180\nAdditional Effect: 50% chance of increasing next Clean Shot potency by 100\nGauss Barrel Effect: Next Clean Shot will have no cast time\nDuration: 10s\nAmmunition Effect: 100% chance of increasing next Clean Shot potency' }),
    cleanShot: ws({ name: 'Clean Shot', potency: 100, comboPotency: 200, comboFrom: 'slugShot', tp: 60, desc: 'Delivers an attack with a potency of 100.\nSlug Shot Combo Potency: 200' }),
    hotShot: ws({ name: 'Hot Shot', potency: 120, tp: 70, breaksCombo: true, desc: 'Delivers an attack with a potency of 120.\nAdditional Effect: Increases physical damage dealt by 5%\nDuration: 30s' }),
    leadShot: ws({ name: 'Lead Shot', potency: 40, tp: 70, breaksCombo: true, dot: { potency: 45, duration: 30 }, desc: 'Delivers an attack with a potency of 40.\nAdditional Effect: Damage over time\nPotency: 45\nDuration: 30s (Lodged Lead)' }),
    spreadShot: ws({ name: 'Spread Shot', potency: 100, tp: 130, range: 12, aoe: true, breaksCombo: true, desc: 'Delivers an attack with a potency of 100 to all enemies in a cone before you.' }),
    grenadoShot: ws({ name: 'Grenado Shot', potency: 120, tp: 160, aoe: true, breaksCombo: true, fx: 'gnbBurst', desc: 'Delivers an attack with a potency of 120 to target and all enemies nearby it.' }),
    reload: ab({ name: 'Reload', recast: 60, desc: 'Loads firearm with five rounds of special ammunition. One round is used each time a weaponskill is executed, increasing its potency by 20. Ammunition also makes Split Shot\'s and Slug Shot\'s additional effects certain.\nNo more than five rounds can be loaded.' }),
    quickReload: ab({ name: 'Quick Reload', recast: 15, desc: 'Loads one round of ammunition and restores 30 TP.' }),
    reassemble: ab({ name: 'Reassemble', recast: 60, desc: 'Guarantees that the next weaponskill is a critical hit.\nDuration: 20s' }),
    heartbreak: ab({ name: 'Heartbreak', recast: 30, potency: 180, target: true, range: 25, delay: 0.5, desc: 'Delivers an attack with a potency of 180.\nCan only be executed when target\'s HP is below 20%.' }),
    blank: ab({ name: 'Blank', recast: 30, potency: 100, target: true, range: 5, delay: 0.4, fx: 'gnbBurst', desc: 'Deals damage with a potency of 100.\nAdditional Effect: 15-yalm knockback' }),
    headGraze: ab({ name: 'Head Graze', recast: 25, cdGroup: 'graze', potency: 100, target: true, range: 25, delay: 0.5, desc: 'Delivers an attack with a potency of 100.\nAdditional Effect: Silence\nDuration: 2s\nShares a recast timer with Suppressive Fire.' }),
    suppressiveFire: ab({ name: 'Suppressive Fire', recast: 25, cdGroup: 'graze', potency: 100, target: true, range: 5, delay: 0.4, desc: 'Delivers an attack with a potency of 100.\nAdditional Effect: Stun\nDuration: 2s\nShares a recast timer with Head Graze.' }),
    legGraze: ab({ name: 'Leg Graze', recast: 20, cdGroup: 'legs', target: true, range: 25, desc: 'Inflicts Heavy +40% on target.\nDuration: 12s\nShares a recast timer with Foot Graze.' }),
    footGraze: ab({ name: 'Foot Graze', recast: 20, cdGroup: 'legs', target: true, range: 25, desc: 'Binds target.\nDuration: 12s\nShares a recast timer with Leg Graze.' }),
    wildfire: ab({ name: 'Wildfire', recast: 90, target: true, range: 25, desc: 'Covers target\'s body in a slow-burning pitch. For the next 15s, 25% of the damage you deal is stored, then dealt to the target when the effect ends (Enhanced Wildfire).\nTurret damage doesn\'t count.' }),
    rapidFire: ab({ name: 'Rapid Fire', recast: 90, desc: 'Reduces weaponskill recast to 1.5s.\nGauss Barrel Effect: Weaponskills have no cast time.\nEffect ends upon using 3 weaponskills.\nDuration: 15s' }),
    gaussBarrel: ab({ name: 'Gauss Barrel', recast: 15, desc: 'Equips your firearm with a gauss barrel, increasing damage dealt by 30%. While it\'s equipped, auto-attacks stop and all weaponskills require a cast.\nEffect ends upon reuse.' }),
    gaussRound: ab({ name: 'Gauss Round', recast: 20, potency: 200, target: true, range: 25, delay: 0.5, desc: 'Delivers an attack with a potency of 200.\nCan only be executed with the Gauss Barrel equipped.' }),
    ricochet: ab({ name: 'Ricochet', recast: 60, potency: 300, target: true, range: 25, delay: 0.5, fx: 'gnbBurst', desc: 'Delivers an attack with a potency of 100 to target, and 200 split evenly between it and all enemies nearby it.\nCan only be executed with the Gauss Barrel equipped.' }),
    rookAutoturret: ab({ name: 'Rook Autoturret', recast: 10, cdGroup: 'turret', desc: 'Deploys a single-target battle turret which auto-attacks its master\'s target with a potency of 80 every 3s.\nHypercharge: potency 160, and the target takes 10% more physical damage for 10s.\nShares a recast timer with Bishop Autoturret.' }),
    bishopAutoturret: ab({ name: 'Bishop Autoturret', recast: 10, cdGroup: 'turret', desc: 'Deploys an area of effect battle turret which attacks with a potency of 60 every 3s.\nHypercharge: potency 120, and targets take 10% more magic damage for 10s.\nShares a recast timer with Rook Autoturret.' }),
    turretRetrieval: ab({ name: 'Turret Retrieval', recast: 5, desc: 'Retrieves an autoturret from the battlefield.' }),
    hypercharge: ab({ name: 'Hypercharge', recast: 120, desc: 'Overcharges your autoturret, increasing its effectiveness.\nDuration: 20s\nCan only be executed while an autoturret is deployed.' }),
    dismantle: ab({ name: 'Dismantle', recast: 90, cdGroup: 'dismantle', target: true, range: 25, desc: 'Lowers target\'s physical damage dealt by 5%.\nDuration: 10s\nShares a recast timer with Rend Mind.' }),
    rendMind: ab({ name: 'Rend Mind', recast: 90, cdGroup: 'dismantle', target: true, range: 25, desc: 'Lowers target\'s magic damage dealt by 5%.\nDuration: 10s\nShares a recast timer with Dismantle.' }),
    // What the turret fires (not on your hotbars).
    volleyFire: { name: 'Volley Fire', kind: 'pet', pet: true, potency: 80, delay: 0.4, fx: 'gnbShot' },
    chargedVolleyFire: { name: 'Charged Volley Fire', kind: 'pet', pet: true, potency: 160, delay: 0.4, iconOf: 'volleyFire', fx: 'gnbBurst' },
    aetherMortar: { name: 'Aether Mortar', kind: 'pet', pet: true, potency: 60, delay: 0.6, aoe: true, iconOf: 'volleyFire', fx: 'gnbBurst' },
    chargedAetherMortar: { name: 'Charged Aether Mortar', kind: 'pet', pet: true, potency: 120, delay: 0.6, aoe: true, iconOf: 'volleyFire', fx: 'gnbBurst' },
    wildfireBurst: { name: 'Wildfire', kind: 'hit', iconOf: 'wildfire', fx: 'gnbZone' },
    // Cross-class skills (Archer and Lancer).
    ragingStrikes: ab({ name: 'Raging Strikes', recast: 180, role: true, desc: 'Increases damage dealt by 20%.\nDuration: 20s' }),
    hawksEye: ab({ name: 'Hawk\'s Eye', recast: 90, role: true, desc: 'Increases dexterity by 15%.\nAdditional Effect: Attacks cannot miss\nDuration: 20s' }),
    quellingStrikes: ab({ name: 'Quelling Strikes', recast: 120, role: true, desc: 'Reduces enmity generated by each attack.\nDuration: 15s' }),
    bloodForBlood: ab({ name: 'Blood for Blood', recast: 80, role: true, desc: 'Increases damage dealt by 10% while increasing damage taken.\nDuration: 20s' }),
    invigorate: ab({ name: 'Invigorate', recast: 120, role: true, desc: 'Instantly restores 400 TP.' }),
    keenFlurry: ab({ name: 'Keen Flurry', recast: 90, role: true, desc: 'Increases parry rate by 30%.\nDuration: 20s' }),
    feint: ws({ name: 'Feint', potency: 120, tp: 80, role: true, range: B.MELEE_RANGE, cast: 0, shot: false, breaksCombo: true, fx: 'slash', desc: 'Delivers an attack with a potency of 120.\nAdditional Effect: Slow +20%\nDuration: 10s' }),
    ...B.GENERAL_ACTIONS,
    tincture: Object.assign({}, B.tincture('dex3sb'), { name: 'Supramax-Potion of Dexterity', dur: 15, desc: 'This diluted brew temporarily increases dexterity.\nDexterity +20% (Max 154)\nDuration: 15s' }),
    auto: { name: 'Shot', kind: 'auto', fx: 'auto', desc: 'Auto-attack.' },
  };

  const STATUSES = {
    gaussBarrel: { name: 'Gauss Barrel', self: true, icon: 'st_barrel' },
    hotShot: { name: 'Hot Shot', self: true, icon: 'st_hot' },
    rapidFire: { name: 'Rapid Fire', self: true, icon: 'st_rapid' },
    reassembled: { name: 'Reassembled', self: true, icon: 'st_reassemble' },
    enhancedSlugShot: { name: 'Enhanced Slug Shot', self: true, icon: 'st_slug' },
    cleanerShot: { name: 'Cleaner Shot', self: true, icon: 'st_clean' },
    ammunition: { name: 'Ammunition Loaded', self: true, icon: 'st_ammo' },
    hypercharge: { name: 'Hypercharge', self: true, icon: 'st_hyper' },
    ragingStrikes: { name: 'Raging Strikes', self: true, icon: 'st_raging' },
    hawksEye: { name: 'Hawk\'s Eye', self: true, icon: 'st_hawk' },
    bloodForBlood: { name: 'Blood for Blood', self: true, icon: 'st_bfb' },
    quellingStrikes: { name: 'Quelling Strikes', self: true, icon: 'st_quelling' },
    keenFlurry: { name: 'Keen Flurry', self: true, icon: 'st_keen' },
    leadShot: { name: 'Lead Shot', self: false, icon: 'st_lead' },
    wildfire: { name: 'Wildfire', self: false, icon: 'st_wildfire' },
    vulnerabilityUp: { name: 'Vulnerability Up', self: false, icon: 'st_vuln' },
    dismantle: { name: 'Dismantle', self: false, icon: 'st_dismantle' },
  };

  class MachinistHW {
    constructor() {
      this.name = 'Machinist';
      this.abbr = 'MCH';
      this.role = 'ranged';
      this.level = 60;
      this.levelKey = 'hw60';
      this.model = 'mch-hw';
      this.actions = ACTIONS;
      this.statuses = STATUSES;
      this.tp = { max: 1000, regen: 60 };
      this.comboTime = 10;
      // A rough 3.5 Alexander Savage set (item level ~270, the Alexandrian Metal Cannon: 77 weapon damage, 2.64 delay),
      // Heavensward-era stats (today's item data is the 4.0 rescale). Increased Action Damage II: +20% to your actions
      // and the turret. No Direct Hit before 4.0.
      this.stats = { hp: 28000, main: 1560, mainStat: 'dex', jobMod: 115, trait: 120, wd: 77, det: 740, crit: 1150,
        dh: 354, speed: 542, delay: 2.64 };
      this.speedName = 'Skill speed';
      this.tierHaste = 0;
      this.autoAttack = { potency: 100, delay: 2.64, range: 25 };
      this.selfStatusOrder = ['gaussBarrel', 'hotShot', 'ragingStrikes', 'hawksEye', 'bloodForBlood', 'rapidFire', 'reassembled', 'enhancedSlugShot',
        'cleanerShot', 'ammunition', 'hypercharge', 'quellingStrikes', 'keenFlurry', 'medicated', 'sprint'];
      this.targetStatusOrder = ['wildfire', 'vulnerabilityUp', 'leadShot', 'dismantle'];
      this.defaultBars = [
        ['splitShot', 'slugShot', 'cleanShot', 'hotShot', 'leadShot', 'reload', 'quickReload', 'reassemble', 'gaussRound', 'ricochet', 'wildfire', 'rapidFire'],
        ['gaussBarrel', 'rookAutoturret', 'hypercharge', 'turretRetrieval', 'blank', 'headGraze', 'tincture', 'ragingStrikes', 'hawksEye', 'bloodForBlood', 'invigorate', 'bishopAutoturret'],
        ['spreadShot', 'grenadoShot', 'heartbreak', 'suppressiveFire', 'legGraze', 'footGraze', 'dismantle', 'rendMind', 'quellingStrikes', 'feint', 'keenFlurry', 'sprint'],
      ];
      this.actionGroups = [
        ['Machinist', ['splitShot', 'slugShot', 'cleanShot', 'hotShot', 'leadShot', 'spreadShot', 'grenadoShot', 'reload', 'quickReload', 'reassemble',
          'heartbreak', 'blank', 'headGraze', 'suppressiveFire', 'legGraze', 'footGraze', 'wildfire', 'rapidFire', 'gaussBarrel', 'gaussRound', 'ricochet',
          'rookAutoturret', 'bishopAutoturret', 'turretRetrieval', 'hypercharge', 'dismantle', 'rendMind']],
        ['Cross-class', ['ragingStrikes', 'hawksEye', 'quellingStrikes', 'bloodForBlood', 'invigorate', 'keenFlurry', 'feint']],
        ['General', ['sprint', 'tincture']],
      ];
      this.referenceDps = 2590;     // a scripted 3.5 rotation parses about 2,450 on the dummy
      this.referenceGcd = 2.43;
      this.startDistance = 12;
    }

    initGauge(e) {
      e.addStatus('gaussBarrel', 1e9, { permanent: true });
      return { ammo: 0, rapid: 0, instantSlug: 0, instantClean: 0, turret: null, turretNext: 0, wf: 0 };
    }

    barrel(e) { return e.has('gaussBarrel'); }
    noAutos(e) { return this.barrel(e); }

    check(id, e) {
      const g = e.g;
      if (id === 'hypercharge' && !g.turret) return 'Unable to execute action. Autoturret required.';
      if (id === 'turretRetrieval' && !g.turret) return 'Unable to execute action. Autoturret required.';
      if ((id === 'gaussRound' || id === 'ricochet') && !this.barrel(e)) return 'Unable to execute action. Gauss Barrel required.';
      if (id === 'heartbreak') return 'Unable to execute action. Target\'s HP must be below 20%.';
      if (id === 'reload' && g.ammo >= 5) return 'Unable to execute action. Ammunition is full.';
      return null;
    }

    // With the barrel on, weaponskills are cast, except Slug Shot after Split Shot, Clean Shot after Slug Shot, and
    // anything under Rapid Fire.
    castTime(id, e) {
      const a = this.actions[id], g = e.g;
      if (!a.shot || !this.barrel(e)) return 0;
      if (g.rapid > 0 && e.has('rapidFire')) return 0;
      if (id === 'slugShot' && g.instantSlug > e.now) return 0;
      if (id === 'cleanShot' && g.instantClean > e.now) return 0;
      return e.speedScale(a.cast, 0);
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
      let mult = 1;
      const pet = !!(a && a.pet);
      let main = this.stats.main;
      if (!pet) {
        if (this.barrel(e)) mult *= this.barrelMult || 1.30;
        if (e.has('hotShot')) mult *= 1.05;
        if (e.has('ragingStrikes')) mult *= 1.20;
        if (e.has('bloodForBlood')) mult *= 1.10;
        if (e.has('hawksEye')) main = Math.floor(main * 1.15);
        if (e.has('medicated')) main += this.potionCap || 154;
      }
      if (e.tHas('vulnerabilityUp')) mult *= this.vulnMult || 1.10;
      return { mult, main, critAdd: 0 };
    }

    resolve(id, e) {
      if (this.actions[id].kind === 'gcd') this.weaponskill(id, e);
      else this.ability(id, e);
    }

    weaponskill(id, e) {
      const a = this.actions[id], g = e.g;
      const combo = !!a.comboFrom && e.lastComboHit;
      let potency = a.comboFrom && combo ? a.comboPotency : a.potency;
      const ammo = !a.role && g.ammo > 0;
      if (ammo) { g.ammo--; potency += 20; if (!g.ammo) e.removeStatus('ammunition', true); }
      if (id === 'slugShot' && e.has('enhancedSlugShot')) { potency += 80; e.removeStatus('enhancedSlugShot'); }
      if (id === 'cleanShot' && e.has('cleanerShot')) { potency += 100; e.removeStatus('cleanerShot'); }
      if (id === 'slugShot') g.instantSlug = 0;
      if (id === 'cleanShot') g.instantClean = 0;
      if (a.slugProc) {
        if (ammo || Math.random() < 0.5) e.addStatus('enhancedSlugShot', 10);
        if (this.barrel(e)) g.instantSlug = e.now + 10;
      }
      if (a.cleanProc) {
        if (ammo || Math.random() < 0.5) e.addStatus('cleanerShot', 10);
        if (this.barrel(e)) g.instantClean = e.now + 10;
      }
      if (id === 'hotShot') e.addStatus('hotShot', 30);
      if (g.rapid > 0) { g.rapid--; if (!g.rapid) e.removeStatus('rapidFire'); }
      const crit = e.has('reassembled') && !a.role;
      if (crit) e.removeStatus('reassembled');
      const snap = this.snapshot(a, e);
      const after = a.dot ? () => e.addTStatus(id, a.dot.duration, { snap, dot: { potency: a.dot.potency, id } }) : null;
      e.queueHit(id, potency, snap, a.delay, after, { crit });
    }

    ability(id, e) {
      const a = this.actions[id], g = e.g;
      switch (id) {
        case 'reload': g.ammo = 5; e.addStatus('ammunition', 1e9, { permanent: true, stacks: 5 }); return;
        case 'quickReload':
          g.ammo = Math.min(5, g.ammo + 1);
          e.addStatus('ammunition', 1e9, { permanent: true, stacks: g.ammo });
          e.tp = Math.min(this.tp.max, e.tp + (this.qrTp || 30));
          return;
        case 'reassemble': e.addStatus('reassembled', 20); return;
        case 'rapidFire': g.rapid = 3; e.addStatus('rapidFire', 15); return;
        case 'wildfire': g.wf = 0; e.addTStatus('wildfire', 15); return;
        case 'hypercharge': e.addStatus('hypercharge', this.hcDur || 20); return;
        case 'gaussBarrel':
          if (this.barrel(e)) e.removeStatus('gaussBarrel');
          else e.addStatus('gaussBarrel', 1e9, { permanent: true });
          return;
        case 'rookAutoturret': case 'bishopAutoturret':
          g.turret = id === 'rookAutoturret' ? 'rook' : 'bishop';
          e.pet = { kind: 'rook' };
          g.turretNext = e.now + 1;
          return;
        case 'turretRetrieval': g.turret = null; e.pet = null; e.removeStatus('hypercharge'); return;
        case 'ricochet': {
          // 100 to the target, and 200 shared between it and everything nearby (300 in 3.0).
          const n = e.targets, share = (this.ricochetShare || 200) / n;
          e.queueHit(id, 100 + share, this.snapshot(a, e), a.delay, null, n > 1 ? { aoe: [1, share / (100 + share)] } : null);
          return;
        }
        case 'dismantle': e.addTStatus('dismantle', 10); return;
        case 'rendMind': case 'legGraze': case 'footGraze': return;
        case 'ragingStrikes': e.addStatus('ragingStrikes', 20); return;
        case 'hawksEye': e.addStatus('hawksEye', 20); return;
        case 'bloodForBlood': e.addStatus('bloodForBlood', 20); return;
        case 'quellingStrikes': e.addStatus('quellingStrikes', 15); return;
        case 'keenFlurry': e.addStatus('keenFlurry', 20); return;
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
      if (e.tStatuses.wildfire) t = Math.min(t, e.tStatuses.wildfire.until);
      return t;
    }

    process(e) {
      const g = e.g, now = e.now;
      // The turret fires every 3s; doubled under Hypercharge.
      if (g.turret && e.inCombat && now >= g.turretNext - EPS) {
        g.turretNext = now + 3;
        const hc = e.has('hypercharge');
        this.turretShot(e, g.turret === 'rook' ? (hc ? 'chargedVolleyFire' : 'volleyFire') : (hc ? 'chargedAetherMortar' : 'aetherMortar'));
      }
      const wf = e.tStatuses.wildfire;
      if (wf && now >= wf.until - EPS) {
        delete e.tStatuses.wildfire;
        e.emit('statusLose', { key: 'wildfire', self: false });
        const amount = Math.floor(g.wf * 0.25);
        g.wf = 0;
        if (amount > 0) e.emit('hit', { id: 'wildfireBurst', amount, crit: false, dh: false, dot: false, t: now });
      }
    }

    proc(id, e) {
      const g = e.g;
      if (id === 'slugShot') return e.has('enhancedSlugShot') || (this.barrel(e) && g.instantSlug > e.now);
      if (id === 'cleanShot') return e.has('cleanerShot') || (this.barrel(e) && g.instantClean > e.now);
      if (id === 'reload') return g.ammo === 0;
      return false;
    }

    mpRegen() { return B.BASE_REGEN; }
    speedInfo(e) { return `GCD ${e.gcdForSpeed(e.stats.speed).toFixed(2)} · Rapid Fire 1.50 · Gauss Barrel casts ${e.speedScale(BARREL_CAST, 0).toFixed(2)} · Heavensward's formula (no Direct Hit)`; }

    // ---------- Ammunition and the turret (Heavensward had no job gauge; this shows the rounds) ----------
    gaugeBuild(root) {
      root.innerHTML = `
<svg width="360" height="120" viewBox="0 0 360 120">
  <rect x="8" y="10" width="344" height="100" rx="14" fill="rgba(14,12,20,.86)" stroke="rgba(255,255,255,.22)"/>
  <text id="mh-lbl" x="24" y="38" font-family="Noto Sans, sans-serif" font-size="11" font-weight="600" fill="#a9a3b4" letter-spacing="1">GAUSS BARREL</text>
  <text x="24" y="84" font-family="Noto Sans, sans-serif" font-size="11" font-weight="600" fill="#a9a3b4" letter-spacing="1">AMMUNITION</text>
  ${[0, 1, 2, 3, 4].map(k => `<rect id="mh-a${k}" x="${120 + k * 20}" y="68" width="12" height="24" rx="3" fill="#2a2535" stroke="rgba(0,0,0,.8)"/>`).join('')}
  <text id="mh-tur" x="336" y="38" text-anchor="end" font-family="Noto Sans, sans-serif" font-size="11" font-weight="600" fill="#9fc4ff" letter-spacing="1"></text>
  <text id="mh-wf" x="336" y="86" text-anchor="end" font-family="Saira Semi Condensed, sans-serif" font-size="16" font-weight="700" fill="#ffb36b" stroke="#000" stroke-width="3" paint-order="stroke"></text>
</svg>`;
      const $ = (s) => root.querySelector(s);
      this.mg = { lbl: $('#mh-lbl'), ammo: [0, 1, 2, 3, 4].map(k => $('#mh-a' + k)), tur: $('#mh-tur'), wf: $('#mh-wf'), cache: {} };
    }

    gaugeUpdate(e) {
      const G = this.mg, c = G.cache, g = e.g;
      const put = (k, v, fn) => { if (c[k] !== v) { c[k] = v; fn(v); } };
      put('lbl', this.barrel(e), v => { G.lbl.textContent = v ? 'GAUSS BARREL · +30%' : 'BARREL OFF'; G.lbl.setAttribute('fill', v ? '#9fe0ff' : '#a9a3b4'); });
      for (let i = 0; i < 5; i++) put('a' + i, g.ammo > i, v => G.ammo[i].setAttribute('fill', v ? '#e8c86a' : '#2a2535'));
      put('t', (g.turret || '') + (e.has('hypercharge') ? '+' : ''), () => { G.tur.textContent = g.turret ? (g.turret === 'rook' ? 'ROOK' : 'BISHOP') + (e.has('hypercharge') ? ' · HYPERCHARGE' : '') : ''; });
      put('wf', e.tHas('wildfire') ? Math.floor(g.wf * 0.25) : -1, v => { G.wf.textContent = v >= 0 ? 'Wildfire ' + v.toLocaleString() : ''; });
    }

    helpHtml(seq) {
      return `
<h3>How it plays (Heavensward 3.4–3.57)</h3>
<p>Level 60 Machinist on TP, with the <b>Gauss Barrel</b> on: +30% damage, but no auto-attacks and every weaponskill has a cast. <b>Split Shot → Slug Shot → Clean Shot</b> is the combo; Split Shot makes the next Slug Shot instant (and 50% of the time +80), Slug Shot the next Clean Shot (+100). <b>Reload</b> (60s) loads five rounds and <b>Quick Reload</b> (15s) one plus 30 TP: each round is +20 potency and makes those bonuses certain, so they belong in the combo. Keep <b>Hot Shot</b> (+5% physical, 30s) and <b>Lead Shot</b> (40 + 45 × 30s) up; both are cast under the barrel.</p>
<p><b>Rapid Fire</b> makes three weaponskills instant at a 1.5s recast; <b>Wildfire</b> stores a quarter of your damage for 15s; <b>Reassemble</b> is a guaranteed crit; <b>Gauss Round</b> (200, 20s) and <b>Ricochet</b> (300 on one target, 60s) need the barrel. The <b>Rook Autoturret</b> fires 80 every 3s; <b>Hypercharge</b> doubles it for 20s and leaves the target taking 10% more physical damage. Raging Strikes (+20%), Hawk's Eye (+15% dexterity) and Blood for Blood are the cross-class burst.</p>
<h3>The 3.5 opener</h3>
${seq([['gaussBarrel'], ['hawksEye'], ['bloodForBlood'], ['ragingStrikes'], 'hotShot', ['hypercharge'], ['tincture'], 'leadShot', ['reload'], 'splitShot', ['wildfire'], 'slugShot', ['reassemble'], ['quickReload'], 'cleanShot', ['rapidFire'], ['gaussRound'], 'splitShot', ['ricochet'], 'slugShot', ['headGraze'], 'cleanShot', ['blank'], 'splitShot'])}
<p>From the FFXIV wiki's 3.5 Machinist page (2017); place the Rook Autoturret before the pull, since Hypercharge needs it.</p>
<p style="color:#a9a3b4">The 3.5 numbers: Split Shot 140 (+80 to Slug), Slug Shot combo 180 (+100 to Clean), Clean Shot combo 200, ammunition +20, Hot Shot 120, Lead Shot 40 + 45 × 30s, Gauss Round 200, Ricochet 100 + 200 shared, Head Graze 100, Blank 100, Volley Fire 80 (160 Hypercharged), Wildfire 25% over 15s. Heavensward's damage formula is the community fit (Dervy, 2015–16); gear is approximate (item level ~270). Not documented anywhere I found: how long the Gauss Barrel cast is (1.5s here), whether Wildfire counted DoT ticks (here it doesn't), and how the turret scaled (here it uses your stats and the +20% trait but none of your buffs). Blood for Blood's +10% is a guess.</p>`;
    }
  }

  B.MachinistHW = MachinistHW;
  B.registerJob({
    id: 'mch', name: 'Machinist', abbr: 'MCH', role: 'ranged', classJob: 31,
    versions: [{ id: 'hw34', label: 'Heavensward 3.4–3.57', history: 'HW 3.4–3.57', note: 'Level 60. The Gauss Barrel (+30%, weaponskills cast, no auto-attacks), five-round ammunition, Hot Shot and Lead Shot, Wildfire, Rapid Fire, Rook Autoturret with Hypercharge, on TP, with Heavensward\'s damage formula', create: () => new MachinistHW() }],
  });
})(window.BLM);
