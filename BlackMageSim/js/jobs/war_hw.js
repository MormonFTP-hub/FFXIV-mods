// Warrior, Heavensward (patches 3.0–3.57) at level 60: the "Deliverance Warrior". In Deliverance (+5% damage)
// weaponskills build Abandon (+2% crit a stack); five make you Uncontrollable, and Fell Cleave (500) spends them.
// Defiance (the tank stance, −25% damage) builds Wrath instead, for Inner Beast and Unchained. Maim (+20% damage)
// and Storm's Eye (−10% slashing resistance) have to stay up, Berserk is +50% for 20s and then 5s of Pacification,
// Infuriate gives five stacks at once, and everything runs on TP. Heavensward's own damage formula (B.LEVELS.hw60).
// Numbers are the 3.5x tooltips (Gamer Escape's and the FFXIV wiki's pre-4.0 page revisions); no Warrior potency
// changed between 3.1 and 3.57.
(function (B) {
  const EPS = 1e-6;
  const STACK_DUR = 30;
  const ws = (o) => Object.assign({ kind: 'gcd', target: true, range: B.MELEE_RANGE, delay: 0.55, fx: 'gnbSlash' }, o);
  const ab = (o) => Object.assign({ kind: 'ogcd' }, o);
  const ACTIONS = {
    heavySwing: ws({ name: 'Heavy Swing', potency: 150, tp: 70, comboStart: true, comboNext: true, desc: 'Delivers an attack with a potency of 150.' }),
    skullSunder: ws({ name: 'Skull Sunder', potency: 100, comboPotency: 200, comboFrom: 'heavySwing', comboNext: true, tp: 60, stack: true, desc: 'Delivers an attack with a potency of 100.\nCombo Action: Heavy Swing\nCombo Potency: 200\nAdditional Effect: Increased enmity\nAdditional Effect: Wrath / Abandon +1' }),
    butchersBlock: ws({ name: 'Butcher\'s Block', potency: 100, comboPotency: 280, comboFrom: 'skullSunder', tp: 60, stack: true, fx: 'gnbBurst', desc: 'Delivers an attack with a potency of 100.\nCombo Action: Skull Sunder\nCombo Potency: 280\nAdditional Effect: Increased enmity\nAdditional Effect: Wrath / Abandon +1' }),
    maim: ws({ name: 'Maim', potency: 100, comboPotency: 190, comboFrom: 'heavySwing', comboNext: true, tp: 60, stack: true, fx: 'gnbSlash2', desc: 'Delivers an attack with a potency of 100.\nCombo Action: Heavy Swing\nCombo Potency: 190\nCombo Bonus: Increases damage dealt by 20%\nDuration: 24s\nAdditional Effect: Wrath / Abandon +1' }),
    stormsPath: ws({ name: 'Storm\'s Path', potency: 100, comboPotency: 250, comboFrom: 'maim', tp: 60, stack: true, fx: 'gnbBurst', desc: 'Delivers an attack with a potency of 100.\nCombo Action: Maim\nCombo Potency: 250\nCombo Bonus: Absorbs 50% of damage dealt as HP, and reduces target\'s damage dealt by 10%\nDuration: 20s\nAdditional Effect: Wrath / Abandon +1' }),
    stormsEye: ws({ name: 'Storm\'s Eye', potency: 100, comboPotency: 270, comboFrom: 'maim', tp: 60, stack: true, fx: 'gnbBurst', desc: 'Delivers an attack with a potency of 100.\nCombo Action: Maim\nCombo Potency: 270\nCombo Bonus: Reduces target\'s slashing resistance by 10%\nDuration: 20s\nAdditional Effect: Wrath / Abandon +1' }),
    overpower: ws({ name: 'Overpower', potency: 120, tp: 130, range: 6, aoe: true, desc: 'Delivers an attack with a potency of 120 to all enemies in a cone before you.' }),
    tomahawk: ws({ name: 'Tomahawk', potency: 130, tp: 120, range: 15, breaksCombo: true, delay: 0.7, fx: 'enpi', desc: 'Throws an axe, dealing damage with a potency of 130.\nAdditional Effect: Increased enmity' }),
    fracture: ws({ name: 'Fracture', potency: 100, tp: 80, dot: { potency: 20, duration: 30 }, desc: 'Delivers an attack with a potency of 100.\nAdditional Effect: Damage over time\nPotency: 20\nDuration: 30s' }),
    fellCleave: ws({ name: 'Fell Cleave', potency: 500, tp: 0, fx: 'gnbDouble', desc: 'Delivers an attack with a potency of 500.\nCan only be executed when Uncontrollable. Abandon effect ends upon use.' }),
    decimate: ws({ name: 'Decimate', potency: 280, tp: 0, target: false, pbaoe: 5, aoe: true, fx: 'gnbBow', desc: 'Delivers an attack with a potency of 280 to all nearby enemies.\nCan only be executed when Uncontrollable. Abandon effect ends upon use.' }),
    innerBeast: ws({ name: 'Inner Beast', potency: 300, tp: 0, ignoresDefiance: true, fx: 'gnbDouble', desc: 'Delivers an attack with a potency of 300.\nAdditional Effect: Absorbs 100% of damage dealt as HP\nAdditional Effect: Reduces damage taken by 20%\nDuration: 6s\nIgnores the damage penalty from Defiance.\nCan only be executed when Infuriated. Wrath effect ends upon use.' }),
    steelCyclone: ws({ name: 'Steel Cyclone', potency: 200, tp: 0, target: false, pbaoe: 5, aoe: true, ignoresDefiance: true, fx: 'gnbBow', desc: 'Delivers an attack with a potency of 200 to all nearby enemies.\nIgnores the damage penalty from Defiance.\nCan only be executed when Infuriated. Wrath effect ends upon use.' }),
    brutalSwing: ab({ name: 'Brutal Swing', recast: 20, potency: 100, target: true, range: B.MELEE_RANGE, delay: 0.5, fx: 'gnbCont', desc: 'Delivers an attack with a potency of 100.\nAdditional Effect: Stun\nDuration: 5s' }),
    berserk: ab({ name: 'Berserk', recast: 90, desc: 'Increases attack power by 50%.\nDuration: 20s\nAdditional Effect: Pacification after the effect ends\nDuration: 5s\nAdditional Effect: Wrath / Abandon +1' }),
    deliverance: ab({ name: 'Deliverance', recast: 10, cdGroup: 'stance', desc: 'Increases damage dealt by 5%. Weaponskills build Abandon (+2% critical hit rate per stack); five make you Uncontrollable.\nCannot be used with Defiance; switching converts Wrath into Abandon.' }),
    defiance: ab({ name: 'Defiance', recast: 10, cdGroup: 'stance', desc: 'Increases maximum HP by 25% and enmity, while reducing damage dealt by 25%. Weaponskills build Wrath; five make you Infuriated.\nCannot be used with Deliverance; switching converts Abandon into Wrath.' }),
    infuriate: ab({ name: 'Infuriate', recast: 60, desc: 'Grants five stacks of Wrath (Defiance) or Abandon (Deliverance).' }),
    unchained: ab({ name: 'Unchained', recast: 120, desc: 'Nullifies the damage penalty from Defiance.\nDuration: 20s\nCan only be executed when Infuriated. Wrath effect ends upon use.' }),
    equilibrium: ab({ name: 'Equilibrium', recast: 60, desc: 'Defiance: restores own HP (cure potency 1,200).\nDeliverance: restores 200 TP.' }),
    rawIntuition: ab({ name: 'Raw Intuition', recast: 90, desc: 'Parries all frontal attacks; attacks from the flank or rear are critical hits.\nDuration: 20s\nAdditional Effect: Wrath / Abandon +1' }),
    vengeance: ab({ name: 'Vengeance', recast: 120, desc: 'Reduces damage taken by 30% and delivers a counter (potency 50) when hit.\nDuration: 15s\nAdditional Effect: Wrath / Abandon +1' }),
    holmgang: ab({ name: 'Holmgang', recast: 180, desc: 'Your HP cannot fall below 1.\nDuration: 6s' }),
    thrillOfBattle: ab({ name: 'Thrill of Battle', recast: 120, desc: 'Increases maximum HP by 20%.\nDuration: 20s' }),
    foresight: ab({ name: 'Foresight', recast: 90, desc: 'Increases defense by 20%.\nDuration: 20s' }),
    bloodbath: ab({ name: 'Bloodbath', recast: 90, desc: 'Converts 25% of physical damage dealt into HP.\nDuration: 30s' }),
    // Cross-class skills (Gladiator and Pugilist).
    internalRelease: ab({ name: 'Internal Release', recast: 60, role: true, desc: 'Increases critical hit rate by 10%.\nDuration: 15s' }),
    provoke: ab({ name: 'Provoke', recast: 40, role: true, target: true, range: 25, desc: 'Gesture threateningly, placing yourself at the top of a target\'s enmity list.' }),
    awareness: ab({ name: 'Awareness', recast: 120, role: true, desc: 'Nullifies the chance of suffering critical damage.\nDuration: 25s' }),
    convalescence: ab({ name: 'Convalescence', recast: 120, role: true, desc: 'Increases HP recovery via healing magic by 20%.\nDuration: 20s' }),
    flash: { name: 'Flash', kind: 'gcd', role: true, recast: 2.5, desc: 'Blinds nearby enemies and increases enmity.' },
    secondWind: ab({ name: 'Second Wind', recast: 120, role: true, desc: 'Instantly restores own HP.' }),
    ...B.GENERAL_ACTIONS,
    tincture: B.tincture('str'),
    auto: { name: 'Attack', kind: 'auto', fx: 'auto', desc: 'Auto-attack.' },
  };
  ACTIONS.tincture = Object.assign({}, ACTIONS.tincture, { name: 'Supramax-Potion of Strength', dur: 15, desc: 'This diluted brew temporarily increases strength.\nStrength +20% (Max 154)\nDuration: 15s' });

  const STATUSES = {
    deliverance: { name: 'Deliverance', self: true, icon: 'st_deliverance' },
    defiance: { name: 'Defiance', self: true, icon: 'st_defiance' },
    abandon: { name: 'Abandon', self: true, icon: 'st_abandon' },
    uncontrollable: { name: 'Uncontrollable', self: true, icon: 'st_uncontrollable' },
    wrath: { name: 'Wrath', self: true, icon: 'st_wrath' },
    infuriated: { name: 'Infuriated', self: true, icon: 'st_infuriated' },
    maim: { name: 'Maim', self: true, icon: 'st_maim' },
    berserk: { name: 'Berserk', self: true, icon: 'st_berserk' },
    pacification: { name: 'Pacification', self: true, icon: 'st_pacify' },
    unchained: { name: 'Unchained', self: true, icon: 'st_unchained' },
    rawIntuition: { name: 'Raw Intuition', self: true, icon: 'st_ri' },
    vengeance: { name: 'Vengeance', self: true, icon: 'st_vengeance' },
    holmgang: { name: 'Holmgang', self: true, icon: 'st_holmgang' },
    thrillOfBattle: { name: 'Thrill of Battle', self: true, icon: 'st_thrill' },
    foresight: { name: 'Foresight', self: true, icon: 'st_foresight' },
    bloodbath: { name: 'Bloodbath', self: true, icon: 'st_bloodbath' },
    internalRelease: { name: 'Internal Release', self: true, icon: 'st_ir' },
    slashingResDown: { name: 'Slashing Resistance Down', self: false, icon: 'st_slash' },
    fracture: { name: 'Fracture', self: false, icon: 'st_fracture' },
  };

  class WarriorHW {
    constructor() {
      this.name = 'Warrior';
      this.abbr = 'WAR';
      this.role = 'tank';
      this.level = 60;
      this.levelKey = 'hw60';
      this.model = 'war-hw';
      this.actions = ACTIONS;
      this.statuses = STATUSES;
      this.tp = { max: 1000, regen: 60 };
      this.comboTime = 10;
      // A rough 3.5 Alexander Savage set (item level ~270, the Alexandrian Metal Axe: 85 weapon damage, 3.36 delay),
      // Heavensward-era stats (today's item data is the 4.0 rescale).
      // Heavensward had no Direct Hit.
      this.stats = { hp: 50000, main: 1450, mainStat: 'str', jobMod: 105, trait: 100, wd: 85, det: 650, crit: 1050,
        dh: 354, speed: 550, delay: 3.36 };
      this.speedName = 'Skill speed';
      this.tierHaste = 0;
      this.autoAttack = { potency: 100, delay: 3.36, range: B.MELEE_RANGE };
      this.selfStatusOrder = ['deliverance', 'defiance', 'uncontrollable', 'abandon', 'infuriated', 'wrath', 'maim', 'berserk', 'pacification',
        'unchained', 'internalRelease', 'rawIntuition', 'vengeance', 'holmgang', 'thrillOfBattle', 'foresight', 'bloodbath', 'medicated', 'sprint'];
      this.targetStatusOrder = ['slashingResDown', 'fracture'];
      this.defaultBars = [
        ['heavySwing', 'skullSunder', 'butchersBlock', 'maim', 'stormsPath', 'stormsEye', 'fellCleave', 'innerBeast', 'fracture', 'tomahawk', 'brutalSwing', 'berserk'],
        ['infuriate', 'deliverance', 'defiance', 'unchained', 'equilibrium', 'rawIntuition', 'vengeance', 'internalRelease', 'tincture', 'bloodbath', 'thrillOfBattle', 'foresight'],
        ['overpower', 'decimate', 'steelCyclone', 'holmgang', 'provoke', 'awareness', 'convalescence', 'flash', 'secondWind', 'sprint', null, null],
      ];
      this.actionGroups = [
        ['Warrior', ['heavySwing', 'skullSunder', 'butchersBlock', 'maim', 'stormsPath', 'stormsEye', 'overpower', 'tomahawk', 'fracture', 'fellCleave',
          'decimate', 'innerBeast', 'steelCyclone', 'brutalSwing', 'berserk', 'deliverance', 'defiance', 'infuriate', 'unchained', 'equilibrium',
          'rawIntuition', 'vengeance', 'holmgang', 'thrillOfBattle', 'foresight', 'bloodbath']],
        ['Cross-class', ['internalRelease', 'provoke', 'awareness', 'convalescence', 'flash', 'secondWind']],
        ['General', ['sprint', 'tincture']],
      ];
      this.referenceDps = 2110;     // a scripted 3.5 Deliverance rotation parses about 2,000 on the dummy
      this.referenceGcd = 2.42;
      this.startDistance = 3.2;
    }

    initGauge(e) {
      e.addStatus('deliverance', 1e9, { permanent: true });
      return { stacks: 0, stackUntil: 0 };
    }

    stance(e) { return e.has('deliverance') ? 'deliverance' : e.has('defiance') ? 'defiance' : null; }
    stacks(e) { return e.g.stackUntil > e.now + EPS ? e.g.stacks : 0; }
    full(e) { return this.stacks(e) >= 5; }

    // Wrath (Defiance) or Abandon (Deliverance): +1 a stack, 30s refreshed by each, five at most.
    addStacks(e, n) {
      const g = e.g, st = this.stance(e);
      if (!st) return;
      g.stacks = Math.min(5, this.stacks(e) + n);
      g.stackUntil = e.now + STACK_DUR;
      this.showStacks(e);
    }
    clearStacks(e) { e.g.stacks = 0; e.g.stackUntil = 0; this.showStacks(e); }
    showStacks(e) {
      for (const k of ['abandon', 'uncontrollable', 'wrath', 'infuriated']) e.removeStatus(k, true);
      const n = this.stacks(e), st = this.stance(e);
      if (!n || !st) return;
      const dur = e.g.stackUntil - e.now;
      if (st === 'deliverance') e.addStatus(n >= 5 ? 'uncontrollable' : 'abandon', dur, { stacks: n });
      else e.addStatus(n >= 5 ? 'infuriated' : 'wrath', dur, { stacks: n });
    }

    check(id, e) {
      const st = this.stance(e);
      if (this.actions[id].kind === 'gcd' && e.has('pacification') && !this.actions[id].role) return 'Unable to execute action while pacified.';
      if ((id === 'fellCleave' || id === 'decimate') && (st !== 'deliverance' || !this.full(e))) return 'Unable to execute action. Uncontrollable required.';
      if ((id === 'innerBeast' || id === 'steelCyclone' || id === 'unchained') && (st !== 'defiance' || !this.full(e))) return 'Unable to execute action. Infuriated required.';
      if ((id === 'infuriate') && !st) return 'Unable to execute action. Defiance or Deliverance required.';
      return null;
    }

    snapshot(a, e) {
      let mult = 1, critAdd = 0;
      const st = this.stance(e);
      if (st === 'deliverance') { mult *= 1.05; critAdd += 0.02 * this.stacks(e); }
      if (st === 'defiance' && this.wrathCrit) critAdd += 0.02 * this.stacks(e);     // A Realm Reborn: Wrath was +2% crit a stack
      if (st === 'defiance' && !e.has('unchained') && !(a && a.ignoresDefiance)) mult *= 0.75;
      if (e.has('maim')) mult *= 1.20;
      if (e.has('berserk')) mult *= 1.50;
      if (e.tHas('slashingResDown')) mult *= 1.10;
      if (e.has('internalRelease')) critAdd += 0.10;
      const main = this.stats.main + (e.has('medicated') ? (this.potionCap || 154) : 0);
      return { mult, main, critAdd };
    }

    resolve(id, e) {
      if (this.actions[id].kind === 'gcd') this.weaponskill(id, e);
      else this.ability(id, e);
    }

    weaponskill(id, e) {
      const a = this.actions[id];
      if (a.role) return;
      const combo = !!a.comboFrom && e.lastComboHit;
      const potency = a.comboFrom && combo ? a.comboPotency : a.potency;
      const snap = this.snapshot(a, e);
      if (id === 'fellCleave' || id === 'decimate' || id === 'innerBeast' || id === 'steelCyclone') this.clearStacks(e);
      if (a.stack) this.addStacks(e, 1);
      if (id === 'maim' && combo) e.addStatus('maim', 24);
      if (id === 'stormsEye' && combo) e.addTStatus('slashingResDown', this.stormsEyeDur || 20);
      const after = a.dot ? () => e.addTStatus(id, a.dot.duration, { snap, dot: { potency: a.dot.potency, id } }) : null;
      e.queueHit(id, potency, snap, a.delay, after);
    }

    ability(id, e) {
      const a = this.actions[id], g = e.g;
      switch (id) {
        case 'berserk': e.addStatus('berserk', 20); g.pacifyAt = e.now + 20; this.addStacks(e, 1); return;
        case 'infuriate': this.addStacks(e, 5); return;
        case 'deliverance': case 'defiance': {
          // Switching stance turns the stacks into the other kind.
          const n = this.stacks(e), left = g.stackUntil;
          e.removeStatus(id === 'deliverance' ? 'defiance' : 'deliverance', true);
          e.addStatus(id, 1e9, { permanent: true });
          g.stacks = n; g.stackUntil = left;
          this.showStacks(e);
          return;
        }
        case 'unchained': this.clearStacks(e); e.addStatus('unchained', 20); return;
        case 'equilibrium': if (this.stance(e) === 'deliverance') e.tp = Math.min(e.job.tp.max, e.tp + 200); return;
        case 'rawIntuition': e.addStatus('rawIntuition', 20); this.addStacks(e, 1); return;
        case 'vengeance': e.addStatus('vengeance', 15); this.addStacks(e, 1); return;
        case 'holmgang': e.addStatus('holmgang', 6); return;
        case 'thrillOfBattle': e.addStatus('thrillOfBattle', 20); return;
        case 'foresight': e.addStatus('foresight', 20); return;
        case 'bloodbath': e.addStatus('bloodbath', 30); return;
        case 'internalRelease': e.addStatus('internalRelease', 15); return;
        default:
          if (B.ROLE_EFFECTS[id]) { B.ROLE_EFFECTS[id](e); return; }
      }
      if (a.potency) e.queueHit(id, a.potency, this.snapshot(a, e), a.delay);
    }

    // Berserk ends into 5s of Pacification; stacks run out after 30s.
    nextEvent(e) {
      const g = e.g;
      let t = Infinity;
      if (g.pacifyAt) t = Math.min(t, g.pacifyAt);
      if (g.stacks && g.stackUntil > e.now) t = Math.min(t, g.stackUntil);
      return t;
    }
    process(e) {
      const g = e.g;
      if (g.pacifyAt && e.now >= g.pacifyAt - EPS) { g.pacifyAt = 0; e.addStatus('pacification', 5); }
      if (g.stacks && e.now >= g.stackUntil - EPS) this.clearStacks(e);
    }

    proc(id, e) {
      const a = this.actions[id];
      if (a.comboFrom && e.inCombo(a.comboFrom)) return true;
      if (id === 'fellCleave') return this.stance(e) === 'deliverance' && this.full(e);
      if (id === 'innerBeast') return this.stance(e) === 'defiance' && this.full(e);
      return false;
    }

    mpRegen() { return B.BASE_REGEN; }
    speedInfo(e) { return `GCD ${e.gcdForSpeed(e.stats.speed).toFixed(2)} · Heavensward's formula (no Direct Hit)`; }

    // ---------- Wrath / Abandon ----------
    gaugeBuild(root) {
      root.innerHTML = `
<svg width="360" height="120" viewBox="0 0 360 120">
  <rect x="8" y="10" width="344" height="100" rx="14" fill="rgba(14,12,20,.86)" stroke="rgba(255,255,255,.22)"/>
  <text id="wr-lbl" x="24" y="38" font-family="Noto Sans, sans-serif" font-size="11" font-weight="600" fill="#a9a3b4" letter-spacing="1">ABANDON</text>
  <text id="wr-t" x="336" y="40" text-anchor="end" font-family="Saira Semi Condensed, sans-serif" font-size="18" font-weight="700" fill="#fff" stroke="#000" stroke-width="3" paint-order="stroke"></text>
  ${[0, 1, 2, 3, 4].map(k => `<path id="wr-s${k}" d="M0 -16 L12 0 L0 16 L-12 0 Z" transform="translate(${60 + k * 60} 74)" fill="#2a2535" stroke="rgba(0,0,0,.8)" stroke-width="1.5"/>`).join('')}
</svg>`;
      const $ = (s) => root.querySelector(s);
      this.wg = { lbl: $('#wr-lbl'), t: $('#wr-t'), s: [0, 1, 2, 3, 4].map(k => $('#wr-s' + k)), cache: {} };
    }

    gaugeUpdate(e) {
      const G = this.wg, c = G.cache;
      const put = (k, v, fn) => { if (c[k] !== v) { c[k] = v; fn(v); } };
      const st = this.stance(e), n = this.stacks(e);
      put('l', st || '', v => { G.lbl.textContent = v === 'defiance' ? 'WRATH (DEFIANCE)' : v === 'deliverance' ? 'ABANDON (DELIVERANCE)' : 'NO STANCE'; });
      const col = st === 'defiance' ? '#e0602a' : '#d02a3a';
      for (let i = 0; i < 5; i++) put('s' + i, (n > i ? 1 : 0) + st, v => G.s[i].setAttribute('fill', n > i ? col : '#2a2535'));
      put('t', n ? Math.ceil(e.g.stackUntil - e.now) : 0, v => { G.t.textContent = v ? v + 's' : ''; });
    }

    helpHtml(seq) {
      return `
<h3>How it plays (Heavensward 3.0–3.57)</h3>
<p>Level 60 Warrior on TP, in <b>Deliverance</b> for damage (+5%). Skull Sunder, Butcher's Block, Maim, Storm's Path and Storm's Eye each add a stack of <b>Abandon</b> (+2% crit, 30s); at five you're Uncontrollable, and <b>Fell Cleave</b> (500) spends them. <b>Infuriate</b> (60s) gives all five at once; Berserk, Raw Intuition and Vengeance add one each. Defiance (the tank stance) is −25% damage and builds Wrath instead, for Inner Beast and Unchained; switching keeps your stacks.</p>
<p>Keep <b>Maim</b> up (Heavy Swing → Maim: +20% damage, 24s) and <b>Storm's Eye</b> on the dummy (Heavy Swing → Maim → Storm's Eye: +10% slashing taken, 20s); fill with Heavy Swing → Skull Sunder → Butcher's Block for stacks. <b>Berserk</b> is +50% for 20s, then 5s of Pacification (no weaponskills): fit three Fell Cleaves in it. Equilibrium gives 200 TP in Deliverance. Combos have a 10s window.</p>
<h3>The 3.5 opener</h3>
${seq(['heavySwing', ['brutalSwing'], 'maim', ['internalRelease'], 'stormsEye', ['tincture'], 'heavySwing', ['berserk'], 'fellCleave', ['infuriate'], 'fellCleave', ['vengeance'], 'maim', 'stormsEye', 'heavySwing', 'maim', ['brutalSwing'], 'stormsEye', 'fellCleave'])}
<p>From the FFXIV wiki's 3.5 Warrior page: Deliverance and Infuriate a minute before the pull, Raw Intuition about 30s later to refresh Abandon, so you pull Uncontrollable.</p>
<p style="color:#a9a3b4">The 3.5 numbers: Heavy Swing 150, Skull Sunder combo 200, Butcher's Block combo 280, Maim combo 190 (+20%), Storm's Path combo 250, Storm's Eye combo 270, Fell Cleave 500, Inner Beast 300, Fracture 100 + 20 × 30s, Brutal Swing 100. Heavensward's damage formula is the community fit (Dervy, 2015–16), not an official one; gear is approximate (item level ~270), with the 3.4 Supramax-Potion of Strength.</p>`;
    }
  }

  B.WarriorHW = WarriorHW;
  B.registerJob({
    id: 'war', name: 'Warrior', abbr: 'WAR', role: 'tank', classJob: 21,
    versions: [{ id: 'hw30', label: 'Heavensward 3.0–3.57', history: 'HW 3.0–3.57', note: 'Level 60. Deliverance and Abandon, Fell Cleave, Infuriate, Berserk with Pacification, Maim and Storm\'s Eye, on TP, with Heavensward\'s damage formula', create: () => new WarriorHW() }],
  });
})(window.BLM);
