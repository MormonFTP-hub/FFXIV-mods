// Ninja, Heavensward (patches 3.0–3.57) at level 60. Huton (+15% attack speed, 70s) has to stay up, kept going by
// Armor Crush; Shadow Fang and Mutilate are DoTs, Dancing Edge keeps slashing resistance down, and Kiss of the Viper
// (or Wasp) is a stance of +20% physical damage. Ten, Chi and Jin are off the GCD and share Ninjutsu's 20s recast: any
// other action between them, a repeated mudra or a fourth one makes Rabbit Medium. Suiton (or Hide) allows Trick
// Attack, Kassatsu resets Ninjutsu with a guaranteed crit, and Duality makes the next weaponskill hit twice but unable
// to crit. Everything runs on TP; Heavensward's damage formula (B.LEVELS.hw60). Numbers are the 3.5x tooltips (Gamer
// Escape's and the FFXIV wiki's pre-4.0 revisions) after the 3.1, 3.2 and 3.3 changes.
(function (B) {
  const EPS = 1e-6;
  const MUDRA_DUR = 5;
  const MUDRAS = ['ten', 'chi', 'jin'];
  const ws = (o) => Object.assign({ kind: 'gcd', target: true, range: B.MELEE_RANGE, delay: 0.5, fx: 'slash' }, o);
  const ab = (o) => Object.assign({ kind: 'ogcd' }, o);
  const mudra = (o) => ab(Object.assign({ cdGroup: 'ninjutsu', recast: 20, holdCd: true, lock: 0.5, mudra: true }, o));
  const jutsu = (o) => ab(Object.assign({ cdGroup: 'ninjutsu', recast: 20, lock: 0.8, jutsu: true, school: 'ninjutsu', delay: 0.6 }, o));
  const ACTIONS = {
    spinningEdge: ws({ name: 'Spinning Edge', potency: 150, tp: 50, comboStart: true, comboNext: true, desc: 'Delivers an attack with a potency of 150.' }),
    gustSlash: ws({ name: 'Gust Slash', potency: 100, comboPotency: 200, comboFrom: 'spinningEdge', comboNext: true, tp: 50, fx: 'slash2', desc: 'Delivers an attack with a potency of 100.\nCombo Action: Spinning Edge\nCombo Potency: 200' }),
    aeolianEdge: ws({ name: 'Aeolian Edge', potency: 100, comboPotency: 240, comboFrom: 'gustSlash', positional: 'rear', posBonus: 80, tp: 60, fx: 'slash3', desc: 'Delivers an attack with a potency of 100.\n180 when executed from a target\'s rear.\nCombo Action: Gust Slash\nCombo Potency: 240\nRear Combo Potency: 320' }),
    armorCrush: ws({ name: 'Armor Crush', potency: 100, comboPotency: 220, comboFrom: 'gustSlash', positional: 'flank', posBonus: 60, tp: 60, fx: 'slash3', desc: 'Delivers an attack with a potency of 100.\n160 when executed from a target\'s flank.\nCombo Action: Gust Slash\nCombo Potency: 220\nFlank Combo Potency: 280\nCombo Bonus: Extends Huton duration by 30s to a maximum of 70s' }),
    dancingEdge: ws({ name: 'Dancing Edge', potency: 100, comboPotency: 260, comboFrom: 'gustSlash', tp: 50, fx: 'slash3', desc: 'Delivers an attack with a potency of 100.\nCombo Action: Gust Slash\nCombo Potency: 260\nCombo Bonus: Reduces target\'s slashing resistance by 10%\nDuration: 20s\nCannot be stacked with Storm\'s Eye.' }),
    shadowFang: ws({ name: 'Shadow Fang', potency: 100, comboPotency: 200, comboFrom: 'spinningEdge', tp: 60, dot: { potency: 40, duration: 18 }, fx: 'slash2', desc: 'Delivers an attack with a potency of 100.\nCombo Action: Spinning Edge\nCombo Potency: 200\nCombo Bonus: Damage over time\nPotency: 40\nDuration: 18s' }),
    mutilate: ws({ name: 'Mutilate', potency: 60, tp: 70, breaksCombo: true, dot: { potency: 30, duration: 30 }, desc: 'Delivers an attack with a potency of 60.\nAdditional Effect: Damage over time\nPotency: 30\nDuration: 30s (Enhanced Mutilate)' }),
    deathBlossom: ws({ name: 'Death Blossom', potency: 110, tp: 100, target: false, pbaoe: 5, aoe: true, breaksCombo: true, fx: 'slash3', desc: 'Delivers an attack with a potency of 110 to all nearby enemies.' }),
    throwingDagger: ws({ name: 'Throwing Dagger', potency: 120, tp: 120, range: 15, breaksCombo: true, delay: 0.7, desc: 'Delivers a ranged attack with a potency of 120.\nAdditional Effect: Increased enmity' }),
    // Off the GCD.
    trickAttack: ab({ name: 'Trick Attack', potency: 240, positional: 'rear', posBonus: 160, recast: 60, cdGroup: 'trick', target: true, range: B.MELEE_RANGE, delay: 0.6, fx: 'slash3', desc: 'Delivers an attack with a potency of 240.\n400 when executed from a target\'s rear.\nRear Combo Bonus: Increases damage taken by target by 10%\nDuration: 10s\nCan only be executed while under the effect of Hidden or Suiton.\nShares a recast timer with Sneak Attack.' }),
    sneakAttack: ab({ name: 'Sneak Attack', potency: 300, positional: 'front', posBonus: 200, recast: 60, cdGroup: 'trick', target: true, range: B.MELEE_RANGE, delay: 0.6, fx: 'slash2', desc: 'Delivers an attack with a potency of 300.\n500 when executed in front of a target.\nAdditional Effect: Stun\nDuration: 4s\nCan only be executed while under the effect of Hidden or Suiton.\nShares a recast timer with Trick Attack.' }),
    mug: ab({ name: 'Mug', potency: 140, recast: 90, target: true, range: B.MELEE_RANGE, delay: 0.6, fx: 'slash', desc: 'Delivers an attack with a potency of 140.\nAdditional Effect: Steal an item from target' }),
    jugulate: ab({ name: 'Jugulate', potency: 80, recast: 30, target: true, range: B.MELEE_RANGE, delay: 0.6, fx: 'slash2', desc: 'Delivers an attack with a potency of 80.\nAdditional Effect: Silence\nDuration: 1s\nKiss of the Wasp Effect: Stun\nDuration: 2s' }),
    dreamWithinADream: ab({ name: 'Dream Within a Dream', potency: 100, recast: 90, target: true, range: B.MELEE_RANGE, delay: 0.6, fx: 'slash3', desc: 'Delivers a threefold attack, each hit with a potency of 100.' }),
    assassinate: ab({ name: 'Assassinate', potency: 200, recast: 40, target: true, range: B.MELEE_RANGE, delay: 0.6, fx: 'slash3', desc: 'Delivers an attack with a potency of 200.\nCan only be executed when target\'s HP is below 20%.' }),
    duality: ab({ name: 'Duality', recast: 90, desc: 'Doubles the number of non-critical strikes of the next single-target weaponskill. Combo bonuses and additional effects apply only once.\nDuration: 10s' }),
    kassatsu: ab({ name: 'Kassatsu', recast: 120, desc: 'Resets the Ninjutsu recast timer.\nAdditional Effect: The next Ninjutsu is a critical hit\nDuration: 15s' }),
    ten: mudra({ name: 'Ten', desc: 'Make the ritual mudra hand gesture for "heaven."\nDuration: 5s\nShares a recast timer with Ninjutsu, Chi and Jin.' }),
    chi: mudra({ name: 'Chi', desc: 'Make the ritual mudra hand gesture for "earth."\nDuration: 5s\nShares a recast timer with Ninjutsu, Ten and Jin.' }),
    jin: mudra({ name: 'Jin', desc: 'Make the ritual mudra hand gesture for "man."\nDuration: 5s\nShares a recast timer with Ninjutsu, Ten and Chi.' }),
    ninjutsu: jutsu({ name: 'Ninjutsu', desc: 'Executes a specific ninjutsu action coinciding with the combination of mudra made immediately beforehand.\nIf any other action is used before the mudra are combined and the ninjutsu executed, Ninjutsu fails into Rabbit Medium.\nRecast: 20s (starts when the Ninjutsu is executed, or when the mudra run out).' }),
    fumaShuriken: jutsu({ name: 'Fuma Shuriken', potency: 240, target: true, range: 15, fx: 'slash', desc: 'Delivers a ranged ninjutsu attack with a potency of 240.\nMudra: any one' }),
    katon: jutsu({ name: 'Katon', potency: 250, target: true, range: 15, aoe: true, fx: 'slashFire', desc: 'Delivers fire damage with a potency of 250 to target and all enemies nearby it.\nMudra: Chi→Ten or Jin→Ten' }),
    raiton: jutsu({ name: 'Raiton', potency: 360, target: true, range: 15, fx: 'gnbBurst', desc: 'Delivers lightning damage with a potency of 360.\nMudra: Ten→Chi or Jin→Chi' }),
    hyoton: jutsu({ name: 'Hyoton', potency: 140, target: true, range: 15, fx: 'slash2', desc: 'Delivers ice damage with a potency of 140.\nAdditional Effect: Bind\nDuration: 15s\nMudra: Ten→Jin or Chi→Jin' }),
    huton: jutsu({ name: 'Huton', desc: 'Increases attack speed by 15%.\nDuration: 70s\nMudra: Jin→Chi→Ten or Chi→Jin→Ten' }),
    doton: jutsu({ name: 'Doton', pbaoe: 5, dot: { potency: 40, duration: 24, aoe: true }, desc: 'Creates a patch of corrupted earth, dealing damage with a potency of 40 to any enemies who enter.\nDuration: 24s\nAdditional Effect: Heavy +40%\nMudra: Ten→Jin→Chi or Jin→Ten→Chi' }),
    suiton: jutsu({ name: 'Suiton', potency: 180, target: true, range: 15, fx: 'gnbSlash', desc: 'Delivers water damage with a potency of 180.\nAdditional Effect: Allows execution of actions which require the effect of Hidden, without being hidden\nDuration: 10s\nMudra: Ten→Chi→Jin or Chi→Ten→Jin' }),
    rabbitMedium: jutsu({ name: 'Rabbit Medium', desc: 'Thumpity thump thump, thumpity thump thump...' }),
    kissOfTheWasp: ab({ name: 'Kiss of the Wasp', recast: 5, cdGroup: 'kiss', desc: 'Increases physical damage dealt by 20% (Enhanced Kiss of the Wasp). Jugulate also stuns.\nCannot be used with Kiss of the Viper. Effect ends upon reuse.' }),
    kissOfTheViper: ab({ name: 'Kiss of the Viper', recast: 5, cdGroup: 'kiss', desc: 'Increases physical damage dealt by 20% (Enhanced Kiss of the Viper). Mug also absorbs 50% of its damage as HP.\nCannot be used with Kiss of the Wasp. Effect ends upon reuse.' }),
    hide: ab({ name: 'Hide', recast: 20, desc: 'Blend in with your surroundings, making it impossible for most enemies to see you.\nCannot be executed while in combat.' }),
    shukuchi: ab({ name: 'Shukuchi', recast: 60, desc: 'Move quickly to the specified location.' }),
    goad: ab({ name: 'Goad', recast: 180, desc: 'Refreshes TP of a party member.\nDuration: 30s\nCannot be used on yourself.' }),
    shadeShift: ab({ name: 'Shade Shift', recast: 120, desc: 'Create shadows that nullify damage up to 20% of maximum HP.\nDuration: 20s' }),
    shadewalker: ab({ name: 'Shadewalker', recast: 120, desc: 'Diverts 80% of enmity you generate to a party member.\nDuration: 15s' }),
    smokeScreen: ab({ name: 'Smoke Screen', recast: 180, desc: 'Reduces a party member\'s enmity.\nDuration: 20s' }),
    // Cross-class skills (Pugilist and Lancer).
    internalRelease: ab({ name: 'Internal Release', recast: 60, role: true, desc: 'Increases critical hit rate by 10%.\nDuration: 15s' }),
    bloodForBlood: ab({ name: 'Blood for Blood', recast: 80, role: true, desc: 'Increases damage dealt by 10% while increasing damage taken.\nDuration: 20s' }),
    invigorate: ab({ name: 'Invigorate', recast: 120, role: true, desc: 'Instantly restores 400 TP.' }),
    secondWind: ab({ name: 'Second Wind', recast: 120, role: true, desc: 'Instantly restores own HP.\nCure Potency: 450' }),
    featherfoot: ab({ name: 'Featherfoot', recast: 90, role: true, desc: 'Increases evasion by 12%.\nDuration: 10s' }),
    mantra: ab({ name: 'Mantra', recast: 120, role: true, desc: 'Increases HP recovery via healing magic by 10% for self and nearby party members.\nDuration: 15s' }),
    keenFlurry: ab({ name: 'Keen Flurry', recast: 90, role: true, desc: 'Increases parry rate by 30%.\nDuration: 20s' }),
    feint: ws({ name: 'Feint', potency: 120, tp: 80, role: true, breaksCombo: true, desc: 'Delivers an attack with a potency of 120.\nAdditional Effect: Slow +20%\nDuration: 10s' }),
    ...B.GENERAL_ACTIONS,
    tincture: Object.assign({}, B.tincture('dex3sb'), { name: 'Supramax-Potion of Dexterity', dur: 15, desc: 'This diluted brew temporarily increases dexterity.\nDexterity +20% (Max 154)\nDuration: 15s' }),
    auto: { name: 'Attack', kind: 'auto', fx: 'auto', desc: 'Auto-attack.' },
  };
  const JUTSU = ['fumaShuriken', 'katon', 'raiton', 'hyoton', 'huton', 'doton', 'suiton', 'rabbitMedium'];

  const STATUSES = {
    huton: { name: 'Huton', self: true, icon: 'st_huton' },
    suiton: { name: 'Suiton', self: true, icon: 'st_suiton' },
    hidden: { name: 'Hidden', self: true, icon: 'st_hidden' },
    mudra: { name: 'Mudra', self: true, icon: 'st_mudra' },
    kassatsu: { name: 'Kassatsu', self: true, icon: 'st_kassatsu' },
    duality: { name: 'Duality', self: true, icon: 'st_duality' },
    kissOfTheWasp: { name: 'Kiss of the Wasp', self: true, icon: 'st_wasp' },
    kissOfTheViper: { name: 'Kiss of the Viper', self: true, icon: 'st_viper' },
    internalRelease: { name: 'Internal Release', self: true, icon: 'st_ir' },
    bloodForBlood: { name: 'Blood for Blood', self: true, icon: 'st_bfb' },
    shadeShift: { name: 'Shade Shift', self: true, icon: 'st_shade' },
    shadewalker: { name: 'Shadewalker', self: true, icon: 'st_shadewalker' },
    featherfoot: { name: 'Featherfoot', self: true, icon: 'st_feather' },
    mantra: { name: 'Mantra', self: true, icon: 'st_mantra' },
    keenFlurry: { name: 'Keen Flurry', self: true, icon: 'st_keen' },
    shadowFang: { name: 'Shadow Fang', self: false, icon: 'st_shadowfang' },
    mutilate: { name: 'Mutilation', self: false, icon: 'st_mutilate' },
    dancingEdge: { name: 'Slashing Resistance Down', self: false, icon: 'st_slash' },
    trickAttack: { name: 'Vulnerability Up', self: false, icon: 'st_vuln' },
    doton: { name: 'Doton', self: false, icon: 'st_doton' },
  };

  // The Ninjutsu a run of mudras makes: the last mudra picks it, any repeat makes Rabbit Medium.
  function jutsuFor(seq) {
    if (!seq.length) return null;
    if (seq.length === 1) return 'fumaShuriken';
    if (new Set(seq).size !== seq.length) return 'rabbitMedium';
    const last = seq[seq.length - 1];
    if (seq.length === 2) return last === 'chi' ? 'raiton' : last === 'ten' ? 'katon' : 'hyoton';
    return last === 'ten' ? 'huton' : last === 'jin' ? 'suiton' : 'doton';
  }

  class NinjaHW {
    constructor() {
      this.name = 'Ninja';
      this.abbr = 'NIN';
      this.role = 'melee';
      this.level = 60;
      this.levelKey = 'hw60';
      this.model = 'nin-hw';
      this.actions = ACTIONS;
      this.statuses = STATUSES;
      this.tp = { max: 1000, regen: 60 };
      this.comboTime = 10;
      // A rough 3.5 Alexander Savage set (item level ~270, the Alexandrian Metal Daggers: 85 weapon damage, 2.56 delay),
      // Heavensward-era stats (today's item data is the 4.0 rescale). No Direct Hit before 4.0.
      this.stats = { hp: 32000, main: 1630, mainStat: 'dex', jobMod: 110, trait: 100, wd: 85, det: 760, crit: 1080,
        dh: 354, speed: 615, delay: 2.56 };
      this.speedName = 'Skill speed';
      this.tierHaste = 15;          // GCDs are quoted with Huton up: 615 skill speed is 2.40, 2.04 under Huton
      this.autoAttack = { potency: 100, delay: 2.56, range: B.MELEE_RANGE };
      this.selfStatusOrder = ['huton', 'kissOfTheViper', 'kissOfTheWasp', 'mudra', 'kassatsu', 'suiton', 'hidden', 'duality', 'internalRelease',
        'bloodForBlood', 'shadeShift', 'shadewalker', 'featherfoot', 'mantra', 'keenFlurry', 'medicated', 'sprint'];
      this.targetStatusOrder = ['trickAttack', 'dancingEdge', 'shadowFang', 'mutilate', 'doton'];
      this.defaultBars = [
        ['spinningEdge', 'gustSlash', 'aeolianEdge', 'armorCrush', 'dancingEdge', 'shadowFang', 'mutilate', 'ten', 'chi', 'jin', 'ninjutsu', 'trickAttack'],
        ['mug', 'jugulate', 'dreamWithinADream', 'duality', 'kassatsu', 'internalRelease', 'bloodForBlood', 'invigorate', 'tincture', 'kissOfTheViper', 'kissOfTheWasp', 'shadeShift'],
        ['deathBlossom', 'throwingDagger', 'sneakAttack', 'assassinate', 'hide', 'shukuchi', 'goad', 'shadewalker', 'smokeScreen', 'featherfoot', 'secondWind', 'sprint'],
      ];
      this.actionGroups = [
        ['Ninja', ['spinningEdge', 'gustSlash', 'aeolianEdge', 'armorCrush', 'dancingEdge', 'shadowFang', 'mutilate', 'deathBlossom', 'throwingDagger',
          'trickAttack', 'sneakAttack', 'mug', 'jugulate', 'dreamWithinADream', 'assassinate', 'duality', 'kassatsu', 'kissOfTheWasp', 'kissOfTheViper',
          'hide', 'shukuchi', 'goad', 'shadeShift', 'shadewalker', 'smokeScreen']],
        ['Ninjutsu', ['ten', 'chi', 'jin', 'ninjutsu']],
        ['Cross-class', ['internalRelease', 'bloodForBlood', 'invigorate', 'secondWind', 'featherfoot', 'mantra', 'keenFlurry', 'feint']],
        ['General', ['sprint', 'tincture']],
      ];
      this.referenceDps = 2730;     // a scripted 3.5 rotation parses about 2,580 on the dummy
      this.referenceGcd = 2.04;
      this.startDistance = 3.2;
    }

    initGauge(e) {
      e.addStatus('kissOfTheViper', 1e9, { permanent: true });
      return { mudras: [], mudraUntil: 0, broken: false };
    }

    haste(e) { return e.has('huton') ? 15 : 0; }
    autoHaste(e) { return this.haste(e); }

    // The Ninjutsu button turns into what the mudras made.
    resolveId(id, e) {
      if (id !== 'ninjutsu') return id;
      const g = e.g;
      if (!g.mudras.length) return id;
      return g.broken ? 'rabbitMedium' : jutsuFor(g.mudras);
    }

    check(id, e) {
      const a = this.actions[id];
      if (id === 'ninjutsu') return 'Unable to execute action. Mudra required.';
      if (a.jutsu && this.resolveId('ninjutsu', e) !== id) return 'Unable to execute action. Mudra required.';
      if ((id === 'trickAttack' || id === 'sneakAttack') && !e.has('suiton') && !e.has('hidden')) return 'Unable to execute action. Hidden or Suiton required.';
      if (id === 'hide' && e.inCombat) return 'Unable to execute action while in combat.';
      if (id === 'assassinate') return 'Unable to execute action. Target\'s HP must be below 20%.';
      if (id === 'goad') return 'Unable to execute action. Invalid target (party members only).';
      return null;
    }

    snapshot(a, e) {
      let mult = 1, critAdd = 0;
      const physical = !a || a.school !== 'ninjutsu';
      if (physical && (e.has('kissOfTheViper') || e.has('kissOfTheWasp'))) mult *= 1.20;
      if (physical && e.tHas('dancingEdge')) mult *= 1.10;
      if (e.tHas('trickAttack')) mult *= 1.10;
      if (e.has('bloodForBlood')) mult *= 1.10;
      if (e.has('internalRelease')) critAdd += 0.10;
      const main = this.stats.main + (e.has('medicated') ? (this.potionCap || 154) : 0);
      return { mult, main, critAdd };
    }

    resolve(id, e) {
      const a = this.actions[id], g = e.g;
      // Any other action before the Ninjutsu spoils the mudras.
      if (g.mudras.length && !a.mudra && !a.jutsu) g.broken = true;
      if (!a.mudra && !a.jutsu && id !== 'trickAttack' && id !== 'sneakAttack' && !KEEPS_HIDDEN[id]) e.removeStatus('hidden');
      if (a.mudra) this.mudra(id, e);
      else if (a.jutsu) this.ninjutsu(id, e);
      else if (a.kind === 'gcd') this.weaponskill(id, e);
      else this.ability(id, e);
    }

    mudra(id, e) {
      const g = e.g;
      if (g.mudras.length >= 3) g.broken = true;
      g.mudras.push(id);
      g.mudraUntil = e.now + MUDRA_DUR;
      e.addStatus('mudra', MUDRA_DUR, { stacks: Math.min(3, g.mudras.length) });
    }
    clearMudras(e) {
      const g = e.g;
      g.mudras = []; g.broken = false; g.mudraUntil = 0;
      e.removeStatus('mudra', true);
    }

    ninjutsu(id, e) {
      const a = this.actions[id];
      this.clearMudras(e);
      if (id === 'rabbitMedium') return;
      const crit = e.has('kassatsu');
      if (crit) e.removeStatus('kassatsu');
      const snap = this.snapshot(a, e);
      switch (id) {
        case 'huton': e.addStatus('huton', 70); return;
        case 'suiton': e.queueHit(id, a.potency, snap, a.delay, () => e.addStatus('suiton', 10), { crit }); return;
        case 'doton':
          if (e.distToTarget() - B.DUMMY_RADIUS > a.pbaoe) return;
          e.addTStatus('doton', a.dot.duration, { snap, dot: { potency: a.dot.potency, id } });
          return;
      }
      if (a.potency) e.queueHit(id, a.potency, snap, a.delay, null, { crit });
    }

    weaponskill(id, e) {
      const a = this.actions[id];
      const combo = !!a.comboFrom && e.lastComboHit;
      const pos = !!a.positional && e.positionalHit(a);
      const potency = (a.comboFrom && combo ? a.comboPotency : a.potency) + (pos ? a.posBonus : 0);
      const snap = this.snapshot(a, e);
      if (id === 'armorCrush' && combo && e.has('huton')) {
        const st = e.statuses.huton;
        st.until = Math.min(e.now + 70, st.until + 30);
      }
      if (id === 'dancingEdge' && combo) e.addTStatus('dancingEdge', 20);
      const dot = a.dot && (id !== 'shadowFang' || combo);
      const after = dot ? () => e.addTStatus(id, a.dot.duration, { snap, dot: { potency: a.dot.potency, id } }) : null;
      const opts = { positional: a.positional ? (pos ? 'hit' : 'miss') : null };
      // Duality: the next single-target weaponskill strikes twice, and can't crit.
      if (e.has('duality') && !a.aoe && !a.role) {
        e.removeStatus('duality');
        const ns = Object.assign({}, snap, { critAdd: -10 });
        e.queueHit(id, potency, ns, a.delay, after, opts);
        e.queueHit(id, potency, ns, a.delay + 0.25, null, opts);
        return;
      }
      e.queueHit(id, potency, snap, a.delay, after, opts);
    }

    ability(id, e) {
      const a = this.actions[id];
      switch (id) {
        case 'trickAttack': case 'sneakAttack': {
          const pos = e.positionalHit(a);
          e.removeStatus('suiton'); e.removeStatus('hidden');
          const after = id === 'trickAttack' && pos ? () => e.addTStatus('trickAttack', 10) : null;
          e.queueHit(id, a.potency + (pos ? a.posBonus : 0), this.snapshot(a, e), a.delay, after, { positional: pos ? 'hit' : 'miss' });
          return;
        }
        case 'dreamWithinADream': {
          const snap = this.snapshot(a, e);
          for (let k = 0; k < 3; k++) e.queueHit(id, a.potency, snap, a.delay + k * 0.3);
          return;
        }
        case 'kassatsu': {
          const c = e.cd('ten');
          c.charges = c.max; c.nextAt = null;
          e.addStatus('kassatsu', 15);
          return;
        }
        case 'duality': e.addStatus('duality', 10); return;
        case 'kissOfTheWasp': case 'kissOfTheViper': {
          const had = e.has(id);
          e.removeStatus('kissOfTheWasp', true); e.removeStatus('kissOfTheViper', true);
          if (!had) e.addStatus(id, 1e9, { permanent: true });
          return;
        }
        case 'hide': e.addStatus('hidden', 1e9, { permanent: true }); return;
        case 'shukuchi': this.gap(e); return;
        case 'shadeShift': e.addStatus('shadeShift', 20); return;
        case 'shadewalker': e.addStatus('shadewalker', 15); return;
        case 'internalRelease': e.addStatus('internalRelease', 15); return;
        case 'bloodForBlood': e.addStatus('bloodForBlood', 20); return;
        case 'featherfoot': e.addStatus('featherfoot', 10); return;
        case 'mantra': e.addStatus('mantra', 15); return;
        case 'keenFlurry': e.addStatus('keenFlurry', 20); return;
        default:
          if (B.ROLE_EFFECTS[id]) { B.ROLE_EFFECTS[id](e); return; }
      }
      if (a.potency) e.queueHit(id, a.potency, this.snapshot(a, e), a.delay);
    }

    gap(e) {
      const d = e.distToTarget() || 1;
      if (d > 2.6) {
        const from = { x: e.pos.x, z: e.pos.z };
        e.pos.x *= 2.4 / d; e.pos.z *= 2.4 / d;
        e.emit('teleport', { from, to: { x: e.pos.x, z: e.pos.z } });
      }
    }

    // Mudras left too long run out, and Ninjutsu's recast starts anyway.
    nextEvent(e) { return e.g.mudras.length ? e.g.mudraUntil : Infinity; }
    process(e) {
      if (e.g.mudras.length && e.now >= e.g.mudraUntil - EPS) {
        this.clearMudras(e);
        e.startCd('ten');
      }
    }

    proc(id, e) {
      const a = this.actions[id];
      if (a.comboFrom && e.inCombo(a.comboFrom)) return true;
      if (id === 'ninjutsu') return e.g.mudras.length > 0;
      if (id === 'trickAttack') return e.has('suiton') || e.has('hidden');
      return false;
    }

    mpRegen() { return B.BASE_REGEN; }
    speedInfo(e) { return `GCD ${e.gcdForSpeed(e.stats.speed).toFixed(2)}, ${e.gcdForSpeed(e.stats.speed, 15).toFixed(2)} under Huton · Heavensward's formula (no Direct Hit)`; }

    // ---------- Huton and mudras (Heavensward had no job gauge; this shows the buff timer and the hand signs) ----------
    gaugeBuild(root) {
      root.innerHTML = `
<svg width="360" height="120" viewBox="0 0 360 120">
  <rect x="8" y="10" width="344" height="100" rx="14" fill="rgba(14,12,20,.86)" stroke="rgba(255,255,255,.22)"/>
  <text x="24" y="36" font-family="Noto Sans, sans-serif" font-size="11" font-weight="600" fill="#a9a3b4" letter-spacing="1">HUTON</text>
  <rect x="24" y="44" width="250" height="12" rx="6" fill="#2a2535" stroke="rgba(0,0,0,.8)"/>
  <rect id="nn-h" x="24" y="44" width="0" height="12" rx="6" fill="#7fd7b0"/>
  <text id="nn-ht" x="336" y="56" text-anchor="end" font-family="Saira Semi Condensed, sans-serif" font-size="18" font-weight="700" fill="#fff" stroke="#000" stroke-width="3" paint-order="stroke"></text>
  ${[0, 1, 2].map(k => `<circle id="nn-m${k}" cx="${44 + k * 44}" cy="86" r="14" fill="#2a2535" stroke="rgba(0,0,0,.8)" stroke-width="1.5"/>
  <text id="nn-mt${k}" x="${44 + k * 44}" y="91" text-anchor="middle" font-family="Noto Sans, sans-serif" font-size="13" font-weight="700" fill="#fff"></text>`).join('')}
  <text id="nn-j" x="336" y="92" text-anchor="end" font-family="Noto Sans, sans-serif" font-size="14" font-weight="600" fill="#ffd27a"></text>
</svg>`;
      const $ = (s) => root.querySelector(s);
      this.ng = { h: $('#nn-h'), ht: $('#nn-ht'), m: [0, 1, 2].map(k => $('#nn-m' + k)), mt: [0, 1, 2].map(k => $('#nn-mt' + k)), j: $('#nn-j'), cache: {} };
    }

    gaugeUpdate(e) {
      const G = this.ng, c = G.cache;
      const put = (k, v, fn) => { if (c[k] !== v) { c[k] = v; fn(v); } };
      const h = e.has('huton') ? Math.max(0, e.statuses.huton.until - e.now) : 0;
      put('h', Math.round(h * 4), () => G.h.setAttribute('width', (250 * Math.min(1, h / 70)).toFixed(1)));
      put('ht', Math.ceil(h), v => { G.ht.textContent = v ? v + 's' : ''; G.h.setAttribute('fill', v > 0 && v < 15 ? '#ff8f6b' : '#7fd7b0'); });
      const seq = e.g.mudras;
      const label = { ten: '天', chi: '地', jin: '人' };
      const col = { ten: '#6fb6ff', chi: '#e8b85a', jin: '#e06a8f' };
      for (let i = 0; i < 3; i++) put('m' + i, seq[i] || '', v => { G.m[i].setAttribute('fill', v ? col[v] : '#2a2535'); G.mt[i].textContent = v ? label[v] : ''; });
      const j = seq.length ? this.actions[this.resolveId('ninjutsu', e)].name : '';
      put('j', j, v => { G.j.textContent = v; });
    }

    helpHtml(seq) {
      return `
<h3>How it plays (Heavensward 3.0–3.57)</h3>
<p>Level 60 Ninja on TP, in <b>Kiss of the Viper</b> (+20% physical damage; Kiss of the Wasp is the same 20%). Keep <b>Huton</b> up (+15% weaponskill and auto-attack speed, 70s): <b>Spinning Edge → Gust Slash → Armor Crush</b> (flank) adds 30s to it. <b>Dancing Edge</b> (the same combo's other finisher) keeps the dummy's slashing resistance down 10% for 20s; <b>Shadow Fang</b> (from Spinning Edge: 200 + 40 × 18s) and <b>Mutilate</b> (60 + 30 × 30s) are DoTs; otherwise finish with <b>Aeolian Edge</b> from the rear (320).</p>
<p><b>Ten, Chi and Jin</b> are off the GCD and share Ninjutsu's 20s recast. Weave two or three between weaponskills and press <b>Ninjutsu</b>: the last sign picks it (two signs ending in Chi: <b>Raiton</b> 360; ending in Ten: Katon; in Jin: Hyoton; three ending in Ten: <b>Huton</b>; in Jin: <b>Suiton</b>; in Chi: Doton). Any other action between them, or a repeated sign, makes Rabbit Medium. Suiton allows <b>Trick Attack</b> (400 from the rear, then +10% damage taken for 10s). Kassatsu resets Ninjutsu and makes the next one crit; Duality makes the next weaponskill hit twice (no crit), so pair it with Aeolian Edge.</p>
<h3>The 3.5 opener</h3>
${seq([['jin'], ['chi'], ['ten'], ['huton'], ['ten'], ['chi'], ['jin'], ['suiton'], 'spinningEdge', ['kassatsu'], ['internalRelease'], 'gustSlash', ['bloodForBlood'], ['tincture'], 'dancingEdge', ['jugulate'], 'spinningEdge', ['trickAttack'], 'shadowFang', ['ten'], ['chi'], ['raiton'], 'mutilate', ['dreamWithinADream'], 'spinningEdge', ['mug'], 'gustSlash', ['duality'], 'aeolianEdge'])}
<p>From the FFXIV wiki's 3.5 Ninja page: Huton more than 20s before the pull, so Ninjutsu is back for Suiton as you engage; Kassatsu brings it back again for a critical Raiton inside Trick Attack.</p>
<p style="color:#a9a3b4">The 3.5 numbers: Spinning Edge 150, Gust Slash combo 200, Aeolian Edge combo 240 (320 rear), Armor Crush combo 220 (280 flank), Dancing Edge combo 260, Shadow Fang combo 200 + 40 × 18s, Mutilate 60 + 30 × 30s, Trick Attack 240 (400 rear), Mug 140, Jugulate 80, Dream Within a Dream 3 × 100, Fuma Shuriken 240, Katon 250, Raiton 360, Suiton 180, Doton 40 × 24s. Heavensward's damage formula is the community fit (Dervy, 2015–16), not an official one; gear is approximate (item level ~270). Whether Kiss of the Viper and Dancing Edge also raised Ninjutsu damage isn't documented; here they don't (Ninjutsu wasn't physical). Mudra and Ninjutsu animation locks (0.5s and 0.8s here) are estimates.</p>`;
    }
  }
  // Abilities that don't break Hide (stances, buffs that don't attack).
  const KEEPS_HIDDEN = { hide: 1, kissOfTheWasp: 1, kissOfTheViper: 1, kassatsu: 1, duality: 1, internalRelease: 1, bloodForBlood: 1, invigorate: 1,
    tincture: 1, sprint: 1, shadeShift: 1, shadewalker: 1, featherfoot: 1, mantra: 1, keenFlurry: 1, secondWind: 1, smokeScreen: 1 };

  B.NinjaHW = NinjaHW;
  B.registerJob({
    id: 'nin', name: 'Ninja', abbr: 'NIN', role: 'melee', classJob: 30,
    versions: [{ id: 'hw30', label: 'Heavensward 3.0–3.57', history: 'HW 3.0–3.57', note: 'Level 60. Huton, Kiss of the Viper, Ten/Chi/Jin off the GCD with Rabbit Medium, Suiton into Trick Attack, Kassatsu Raiton, Duality, Shadow Fang and Mutilate, on TP, with Heavensward\'s damage formula', create: () => new NinjaHW() }],
  });
})(window.BLM);
