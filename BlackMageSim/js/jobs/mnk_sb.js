// Monk, Stormblood (patches 4.2–4.58) at level 70: forms (Opo-opo → Raptor → Coeurl), Greased Lightning (three
// stacks of +10% damage and 5% speed, kept up by Snap Punch and Demolish; Tornado Kick spends them), Twin Snakes,
// Dragon Kick's blunt debuff, Demolish's DoT, the Opo-opo Bootshine crit from the rear, Fists of Fire, Riddle of
// Fire (+30% damage, 15% slower GCD), Brotherhood (from 4.2 it counts your own weaponskills for chakra), Perfect
// Balance (60s from 4.2), Internal Release, chakra with The Forbidden Chakra, the Tackles and Riddle of Wind, all on TP.
// The numbers are the final 4.5 values (4.5 raised True Strike, Snap Punch, Twin Snakes, Demolish, Dragon Kick and
// Fists of Fire): the game data at 4.58 (xivapi's datamining) and the Lodestone notes.
(function (B) {
  const EPS = 1e-6;
  const GL_DUR = 16;
  const NEXT = { opoOpo: 'raptor', raptor: 'coeurl', coeurl: 'opoOpo' };
  const ws = (o) => Object.assign({ kind: 'gcd', target: true, range: B.MELEE_RANGE, delay: 0.45, fx: 'gnbSlash' }, o);
  const ab = (o) => Object.assign({ kind: 'ogcd' }, o);
  const ACTIONS = {
    bootshine: ws({ name: 'Bootshine', potency: 140, tp: 50, form: 'opoOpo', fx: 'slash', desc: 'Delivers an attack with a potency of 140.\nOpo-opo Form Bonus: Critical damage if executed from a target\'s rear\nAdditional Effect: Changes form to raptor\nDuration: 10s' }),
    dragonKick: ws({ name: 'Dragon Kick', potency: 120, positional: 'flank', posBonus: 20, tp: 50, form: 'opoOpo', fx: 'slash2', desc: 'Delivers an attack with a potency of 120.\n140 when executed from a target\'s flank.\nOpo-opo Form Bonus: Reduces target\'s blunt resistance by 10%\nDuration: 15s\nAdditional Effect: Changes form to raptor\nDuration: 10s' }),
    trueStrike: ws({ name: 'True Strike', potency: 160, positional: 'rear', posBonus: 20, tp: 50, form: 'raptor', needs: 'raptor', fx: 'slash', desc: 'Delivers an attack with a potency of 160.\n180 when executed from a target\'s rear.\nCan only be executed when in raptor form.\nAdditional Effect: Changes form to coeurl\nDuration: 10s' }),
    twinSnakes: ws({ name: 'Twin Snakes', potency: 110, positional: 'flank', posBonus: 20, tp: 50, form: 'raptor', needs: 'raptor', fx: 'slash2', desc: 'Delivers an attack with a potency of 110.\n130 when executed from a target\'s flank.\nAdditional Effect: Increases damage dealt by 10%\nDuration: 15s\nCan only be executed when in raptor form.\nAdditional Effect: Changes form to coeurl\nDuration: 10s' }),
    snapPunch: ws({ name: 'Snap Punch', potency: 150, positional: 'flank', posBonus: 20, tp: 40, form: 'coeurl', needs: 'coeurl', gl: true, fx: 'slashFire', desc: 'Delivers an attack with a potency of 150.\n170 when executed from a target\'s flank.\nAdditional Effect: Greased Lightning\nDuration: 16s\nCan only be executed when in coeurl form.\nAdditional Effect: Changes form to opo-opo\nDuration: 10s' }),
    demolish: ws({ name: 'Demolish', potency: 50, positional: 'rear', posBonus: 20, tp: 40, form: 'coeurl', needs: 'coeurl', gl: true, dot: { potency: 50, duration: 18 }, fx: 'slash3', desc: 'Delivers an attack with a potency of 50.\n70 when executed from a target\'s rear.\nAdditional Effect: Damage over time\nPotency: 50\nDuration: 18s\nAdditional Effect: Greased Lightning\nDuration: 16s\nCan only be executed when in coeurl form.\nAdditional Effect: Changes form to opo-opo\nDuration: 10s' }),
    armOfTheDestroyer: ws({ name: 'Arm of the Destroyer', potency: 50, tp: 130, form: 'opoOpo', target: false, pbaoe: 5, aoe: true, desc: 'Delivers an attack with a potency of 50 to all nearby enemies.\nOpo-opo Form Bonus: Silence\nAdditional Effect: Changes form to raptor\nDuration: 10s' }),
    oneIlmPunch: ws({ name: 'One Ilm Punch', potency: 120, tp: 120, form: 'raptor', needs: 'raptor', desc: 'Delivers an attack with a potency of 120.\nAdditional Effect: Stun\nDuration: 1s\nCan only be executed when in raptor form.\nAdditional Effect: Changes form to coeurl\nDuration: 10s' }),
    rockbreaker: ws({ name: 'Rockbreaker', potency: 130, tp: 120, form: 'coeurl', needs: 'coeurl', gl: true, range: 5, aoe: true, desc: 'Delivers an attack with a potency of 130 to all enemies in a cone before you.\nAdditional Effect: Greased Lightning\nDuration: 16s\nCan only be executed when in coeurl form.\nAdditional Effect: Changes form to opo-opo\nDuration: 10s' }),
    formShift: ws({ name: 'Form Shift', potency: 0, tp: 0, target: false, desc: 'Changes to the next form (opo-opo with no form).\nDuration: 10s' }),
    meditation: { name: 'Meditation', kind: 'gcd', recast: 1.2, desc: 'Opens a chakra (up to five).\nShares a recast timer with all weaponskills.\nMeditation changes to The Forbidden Chakra with five open.' },
    forbiddenChakra: ab({ name: 'The Forbidden Chakra', recast: 5, potency: 250, target: true, range: B.MELEE_RANGE, delay: 0.5, fx: 'shinten', desc: 'Delivers an attack with a potency of 250.\nCan only be executed with five chakra open.' }),
    tornadoKick: ab({ name: 'Tornado Kick', recast: 10, potency: 330, target: true, range: B.MELEE_RANGE, delay: 0.6, fx: 'senei', desc: 'Delivers an attack with a potency of 330.\nCan only be executed under Greased Lightning III; ends Greased Lightning.' }),
    steelPeak: ab({ name: 'Steel Peak', recast: 40, potency: 150, target: true, range: B.MELEE_RANGE, delay: 0.5, fx: 'shinten', desc: 'Delivers an attack with a potency of 150.' }),
    howlingFist: ab({ name: 'Howling Fist', recast: 60, potency: 210, target: true, range: 10, delay: 0.6, aoe: true, fx: 'senei', desc: 'Delivers an attack with a potency of 210 to all enemies in a straight line before you.' }),
    elixirField: ab({ name: 'Elixir Field', recast: 30, potency: 220, pbaoe: 5, aoe: true, delay: 0.6, fx: 'gnbBow', desc: 'Delivers an attack with a potency of 220 to all nearby enemies.' }),
    shoulderTackle: ab({ name: 'Shoulder Tackle', recast: 30, cdGroup: 'tackle', potency: 100, target: true, range: 20, delay: 0.3, fx: 'gnbCont', desc: 'Rushes target and delivers an attack with a potency of 100.\nAdditional Effect: Stun\nDuration: 2s\nShoulder Tackle changes to Fire, Wind or Earth Tackle with the matching Fists.' }),
    fireTackle: ab({ name: 'Fire Tackle', recast: 30, cdGroup: 'tackle', potency: 130, target: true, range: 20, delay: 0.3, fx: 'gnbCont', desc: 'Rushes target and delivers a fire-based attack with a potency of 130.\nCan only be executed under Fists of Fire.' }),
    windTackle: ab({ name: 'Wind Tackle', recast: 30, cdGroup: 'tackle', potency: 65, target: true, range: 20, delay: 0.3, fx: 'gnbCont', desc: 'Rushes target and delivers a wind-based attack with a potency of 65.\nAdditional Effect: Riddle of Wind (10s), allowing the execution of the Riddle of Wind attack\nCan only be executed under Fists of Wind.' }),
    earthTackle: ab({ name: 'Earth Tackle', recast: 30, cdGroup: 'tackle', potency: 100, target: true, range: 20, delay: 0.3, fx: 'gnbCont', desc: 'Rushes target and delivers an earth-based attack with a potency of 100.\nAdditional Effect: Knockback 10 yalms\nCan only be executed under Fists of Earth.' }),
    riddleOfWind: ab({ name: 'Riddle of Wind', recast: 1, potency: 65, target: true, range: B.MELEE_RANGE, delay: 0.4, fx: 'shinten', desc: 'Delivers an attack with a potency of 65.\nAdditional Effect: Greased Lightning\nDuration: 16s\nCan only be executed under Riddle of Wind.' }),
    internalRelease: ab({ name: 'Internal Release', recast: 60, desc: 'Increases critical hit rate by 30%.\nDuration: 15s' }),
    perfectBalance: ab({ name: 'Perfect Balance', recast: 60, desc: 'Allows execution of weaponskills which require a certain form, without being in that form.\nDuration: 10s' }),
    riddleOfFire: ab({ name: 'Riddle of Fire', recast: 90, desc: 'Increases damage dealt by 30% while increasing weaponskill recast time by 15%.\nDuration: 20s\nAdditional Effect: Grants Fists of Fire\nEffect ends upon execution of Fists of Wind or Fists of Earth.' }),
    brotherhood: ab({ name: 'Brotherhood', recast: 90, desc: 'Increases physical damage dealt by self and nearby party members by 5%.\nDuration: 15s\nAdditional Effect: 30% chance a chakra opens each time you or a party member uses a weaponskill' }),
    riddleOfEarth: ab({ name: 'Riddle of Earth', recast: 60, desc: 'Grants Fists of Earth and resets Greased Lightning to its full duration.\nAdditional Effect: Reduces damage taken by 10%\nDuration: 30s' }),
    fistsOfFire: ab({ name: 'Fists of Fire', recast: 3, cdGroup: 'fists', desc: 'Increases damage dealt by 6%.\nCannot be used with Fists of Earth or Fists of Wind.' }),
    fistsOfWind: ab({ name: 'Fists of Wind', recast: 3, cdGroup: 'fists', desc: 'Increases movement speed.\nCannot be used with Fists of Fire or Fists of Earth.' }),
    fistsOfEarth: ab({ name: 'Fists of Earth', recast: 3, cdGroup: 'fists', desc: 'Reduces damage taken by 10%.\nCannot be used with Fists of Fire or Fists of Wind.' }),
    mantra: ab({ name: 'Mantra', recast: 90, desc: 'Increases HP recovery via healing actions for self and nearby party members by 20%.\nDuration: 15s' }),
    purification: ab({ name: 'Purification', recast: 120, desc: 'Restores 300 TP and halves enmity.\nCan only be executed with five chakra open; spends them.' }),
    // The melee role actions of 4.5 (five could be slotted in Stormblood; these are the usual ones).
    // 150s until 4.5 (90s after): most of this version's run.
    trueNorth: ab({ name: 'True North', recast: 150, role: true, desc: 'Nullifies all action direction requirements.\nDuration: 15s' }),
    invigorate: ab({ name: 'Invigorate', recast: 120, role: true, desc: 'Instantly restores 400 TP.' }),
    feint: ab({ name: 'Feint', recast: 120, role: true, target: true, range: 10, desc: 'Lowers target\'s strength and dexterity by 10%.\nDuration: 10s' }),
    bloodbath: ab({ name: 'Bloodbath', recast: 90, role: true, desc: 'Converts a portion of physical damage dealt into HP.\nDuration: 20s' }),
    secondWind: ab({ name: 'Second Wind', recast: 120, role: true, desc: 'Instantly restores own HP.\nCure Potency: 500' }),
    legSweep: ab({ name: 'Leg Sweep', recast: 40, role: true, target: true, range: 3, desc: 'Stuns target.\nDuration: 3s' }),
    armsLength: ab({ name: 'Arm\'s Length', recast: 60, role: true, desc: 'Creates a barrier nullifying knockback and draw-in effects.\nDuration: 5s' }),
    ...B.GENERAL_ACTIONS,
    tincture: B.tincture('str3sb'),
    auto: { name: 'Attack', kind: 'auto', fx: 'auto', desc: 'Auto-attack.' },
  };

  const STATUSES = {
    opoOpo: { name: 'Opo-opo Form', self: true, icon: 'st_opo' },
    raptor: { name: 'Raptor Form', self: true, icon: 'st_raptor' },
    coeurl: { name: 'Coeurl Form', self: true, icon: 'st_coeurl' },
    perfectBalance: { name: 'Perfect Balance', self: true, icon: 'st_pb' },
    gl1: { name: 'Greased Lightning', self: true, icon: 'st_gl' },
    gl2: { name: 'Greased Lightning II', self: true, icon: 'st_gl' },
    gl3: { name: 'Greased Lightning III', self: true, icon: 'st_gl' },
    twinSnakes: { name: 'Twin Snakes', self: true, icon: 'st_twin' },
    internalRelease: { name: 'Internal Release', self: true, icon: 'st_ir' },
    riddleOfFire: { name: 'Riddle of Fire', self: true, icon: 'st_rof' },
    brotherhood: { name: 'Brotherhood', self: true, icon: 'st_bh' },
    riddleOfEarth: { name: 'Riddle of Earth', self: true, icon: 'st_roe' },
    riddleOfWind: { name: 'Riddle of Wind', self: true, icon: 'st_row' },
    fistsOfFire: { name: 'Fists of Fire', self: true, icon: 'st_fof' },
    fistsOfWind: { name: 'Fists of Wind', self: true, icon: 'st_fow' },
    fistsOfEarth: { name: 'Fists of Earth', self: true, icon: 'st_foe' },
    mantra: { name: 'Mantra', self: true, icon: 'st_mantra' },
    demolish: { name: 'Demolish', self: false, icon: 'st_demolish' },
    bluntResDown: { name: 'Blunt Resistance Down', self: false, icon: 'st_blunt' },
  };
  const FORMS = ['opoOpo', 'raptor', 'coeurl'];
  const GL_KEYS = ['gl1', 'gl2', 'gl3'];

  class MonkSB {
    constructor() {
      this.name = 'Monk';
      this.abbr = 'MNK';
      this.role = 'melee';
      this.level = 70;
      this.levelKey = 'sb70';
      this.model = 'mnk-sb';
      this.actions = ACTIONS;
      this.statuses = STATUSES;
      this.tp = { max: 1000, regen: 60 };
      // A rough 4.5 Alphascape set (the Omega Knuckles: 109 weapon damage, 2.56 delay in the 4.58 item data) at 2.42 base,
      // 2.05 with Greased Lightning III; level-70 stats. Monk's Strength modifier is 110.
      this.stats = { hp: 32000, main: 3280, mainStat: 'str', jobMod: 110, trait: 100, wd: 109, det: 1500, crit: 2700,
        dh: 2000, speed: 900, delay: 2.56 };
      this.speedName = 'Skill speed';
      this.tierHaste = 15;            // GCD tiers are quoted with Greased Lightning III
      this.autoAttack = { potency: 110, delay: 2.56, range: B.MELEE_RANGE };
      this.selfStatusOrder = ['gl3', 'gl2', 'gl1', 'opoOpo', 'raptor', 'coeurl', 'perfectBalance', 'twinSnakes', 'riddleOfFire', 'brotherhood',
        'internalRelease', 'fistsOfFire', 'fistsOfWind', 'fistsOfEarth', 'riddleOfEarth', 'riddleOfWind', 'trueNorth', 'medicated', 'mantra',
        'bloodbath', 'armsLength', 'sprint'];
      this.targetStatusOrder = ['demolish', 'bluntResDown', 'feint'];
      this.defaultBars = [
        ['bootshine', 'trueStrike', 'snapPunch', 'dragonKick', 'twinSnakes', 'demolish', 'formShift', 'tornadoKick', 'meditation', 'shoulderTackle', 'steelPeak', 'howlingFist'],
        ['internalRelease', 'perfectBalance', 'riddleOfFire', 'brotherhood', 'elixirField', 'fistsOfFire', 'fistsOfWind', 'riddleOfWind', 'trueNorth', 'tincture', 'invigorate', 'purification'],
        ['armOfTheDestroyer', 'oneIlmPunch', 'rockbreaker', 'riddleOfEarth', 'fistsOfEarth', 'mantra', 'feint', 'bloodbath', 'secondWind', 'legSweep', 'armsLength', 'sprint'],
      ];
      this.actionGroups = [
        ['Monk', ['bootshine', 'trueStrike', 'snapPunch', 'dragonKick', 'twinSnakes', 'demolish', 'armOfTheDestroyer', 'oneIlmPunch', 'rockbreaker',
          'formShift', 'meditation', 'forbiddenChakra', 'tornadoKick', 'steelPeak', 'howlingFist', 'elixirField', 'shoulderTackle', 'fireTackle',
          'windTackle', 'earthTackle', 'riddleOfWind', 'internalRelease', 'perfectBalance', 'riddleOfFire', 'brotherhood', 'riddleOfEarth',
          'fistsOfFire', 'fistsOfWind', 'fistsOfEarth', 'mantra', 'purification']],
        ['Role Actions', ['trueNorth', 'invigorate', 'feint', 'bloodbath', 'secondWind', 'legSweep', 'armsLength']],
        ['General', ['sprint', 'tincture']],
      ];
      // What the Heavensward version (mnk_hw.js) changes.
      this.glDur = GL_DUR;
      this.fofMult = 1.06;
      this.deepMeditation = true;           // chakra from critical weaponskills (4.0 on)
      this.tackles = true;                  // Tackle Mastery (4.0 on)
      this.referenceDps = 8250;     // a scripted 4.5 rotation parses about 7,800 on the dummy
      this.referenceGcd = 2.05;
      this.startDistance = 3.2;
    }

    initGauge(e) {
      e.addStatus('fistsOfFire', 1e9, { permanent: true });
      return { chakra: 0, gl: 0 };
    }

    form(e) { return FORMS.find(f => e.has(f)) || null; }
    gl(e) { return e.g.gl > 0 && e.has(GL_KEYS[e.g.gl - 1]) ? e.g.gl : 0; }

    // Meditation turns into The Forbidden Chakra at five chakra; Shoulder Tackle into the Fists' Tackle.
    resolveId(id, e) {
      if (id === 'meditation' && e.g.chakra >= 5 && e.inCombat) return 'forbiddenChakra';
      if (id === 'shoulderTackle' && this.tackles) {
        if (e.has('fistsOfFire')) return 'fireTackle';
        if (e.has('fistsOfWind')) return 'windTackle';
        if (e.has('fistsOfEarth')) return 'earthTackle';
      }
      return id;
    }

    check(id, e) {
      const a = this.actions[id], g = e.g;
      if (a.needs && !e.has(a.needs) && !e.has('perfectBalance')) return 'Unable to execute action. Form required.';
      if (id === 'tornadoKick' && this.gl(e) < 3) return 'Unable to execute action. Greased Lightning III required.';
      if ((id === 'forbiddenChakra' || id === 'purification') && g.chakra < 5) return 'Unable to execute action. Five chakra required.';
      if (id === 'meditation' && g.chakra >= 5) return 'Unable to execute action. Chakra already open.';
      if (id === 'riddleOfWind' && !e.has('riddleOfWind')) return 'Unable to execute action. Riddle of Wind required.';
      if (id === 'fireTackle' && !e.has('fistsOfFire')) return 'Unable to execute action.';
      if (id === 'windTackle' && !e.has('fistsOfWind')) return 'Unable to execute action.';
      if (id === 'earthTackle' && !e.has('fistsOfEarth')) return 'Unable to execute action.';
      return null;
    }

    // Greased Lightning: 5% faster per stack; Riddle of Fire: 15% slower weaponskills (taken as adding up).
    haste(e) { return 5 * this.gl(e) - (e.has('riddleOfFire') ? 15 : 0); }
    autoHaste(e) { return 5 * this.gl(e); }

    snapshot(a, e) {
      let mult = 1 + (this.glStep || 0.10) * this.gl(e), critAdd = 0;
      if (e.has('twinSnakes')) mult *= 1.10;
      if (e.has('fistsOfFire')) mult *= this.fofMult;
      if (e.has('riddleOfFire')) mult *= 1.30;
      if (e.has('brotherhood') && this.brotherhoodSelf !== false) mult *= 1.05;
      if (e.tHas('bluntResDown')) mult *= 1.10;
      if (e.has('internalRelease')) critAdd += 0.30;
      const main = this.stats.main + (e.has('medicated') ? B.TINCTURES[this.tinctureKey || 'str3sb'].cap : 0);
      return { mult, main, critAdd };
    }

    setForm(e, f) {
      for (const k of FORMS) if (k !== f) e.removeStatus(k, true);
      if (f) e.addStatus(f, 10);
    }
    addGl(e) {
      const g = e.g;
      const n = Math.min(3, this.gl(e) + 1);
      for (const k of GL_KEYS) e.removeStatus(k, true);
      g.gl = n;
      e.addStatus(GL_KEYS[n - 1], this.glDur);
    }
    openChakra(e) { if (e.g.chakra < 5) { e.g.chakra++; e.emit('chakra', {}); } }

    resolve(id, e) {
      if (this.actions[id].kind === 'gcd') this.weaponskill(id, e);
      else this.ability(id, e);
    }

    weaponskill(id, e) {
      const a = this.actions[id];
      if (id === 'meditation') { this.openChakra(e); return; }
      const form = this.form(e);
      if (id === 'formShift') { this.setForm(e, form ? NEXT[form] : 'opoOpo'); return; }
      const opo = form === 'opoOpo' || e.has('perfectBalance');
      let potency = a.potency;
      const pos = !!a.positional && e.positionalHit(a);
      if (pos) potency += a.posBonus;
      // Bootshine in opo-opo from the rear (or under True North) is a critical hit.
      const crit = id === 'bootshine' && opo && (e.has('trueNorth') || e.side() === 'rear');
      if (id === 'dragonKick' && opo) e.addTStatus('bluntResDown', 15);
      if (id === 'twinSnakes') e.addStatus('twinSnakes', 15);
      if (a.gl) this.addGl(e);
      this.setForm(e, NEXT[a.form]);
      const snap = this.snapshot(a, e);
      const after = a.dot ? () => e.addTStatus(id, a.dot.duration, { snap, dot: { potency: a.dot.potency, id } }) : null;
      // Chakra: Deep Meditation opens one 50% of the time a weaponskill crits; Brotherhood 30% of the time on any.
      const onResult = (r) => { if (this.deepMeditation && r.crit && Math.random() < 0.5) this.openChakra(e); };
      e.queueHit(id, potency, snap, a.delay, after, { positional: a.positional ? (pos ? 'hit' : 'miss') : null, crit, onResult });
      if (e.has('brotherhood') && this.brotherhoodSelf !== false && Math.random() < 0.3) this.openChakra(e);
    }

    ability(id, e) {
      const a = this.actions[id], g = e.g;
      switch (id) {
        case 'tornadoKick':
          for (const k of GL_KEYS) e.removeStatus(k, true);
          g.gl = 0;
          break;
        case 'forbiddenChakra': g.chakra = 0; e.emit('chakra', {}); break;
        case 'purification': g.chakra = 0; e.tp = Math.min(e.job.tp.max, e.tp + 300); return;
        case 'windTackle': e.addStatus('riddleOfWind', this.rowDur || 10); this.gap(e); break;
        case 'fireTackle': case 'earthTackle': case 'shoulderTackle': this.gap(e); break;
        case 'riddleOfWind': e.removeStatus('riddleOfWind'); if (this.rowGl !== false) this.addGl(e); break;
        case 'internalRelease': e.addStatus('internalRelease', 15); return;
        case 'perfectBalance': e.addStatus('perfectBalance', 10); return;
        case 'riddleOfFire': e.addStatus('riddleOfFire', 20); this.fists(e, 'fistsOfFire'); return;
        case 'brotherhood': e.addStatus('brotherhood', 15); return;
        case 'riddleOfEarth':
          this.fists(e, 'fistsOfEarth');
          e.addStatus('riddleOfEarth', 30);
          if (this.gl(e)) e.statuses[GL_KEYS[g.gl - 1]].until = e.now + this.glDur;
          return;
        case 'fistsOfFire': case 'fistsOfWind': case 'fistsOfEarth': this.fists(e, id); return;
        case 'mantra': e.addStatus('mantra', 15); return;
        case 'trueNorth': e.addStatus('trueNorth', 15); return;
        case 'invigorate': B.ROLE_EFFECTS.invigorate(e); return;
        default:
          if (B.ROLE_EFFECTS[id]) { B.ROLE_EFFECTS[id](e); return; }
      }
      if (a.potency) e.queueHit(id, a.potency, this.snapshot(a, e), a.delay);
    }

    fists(e, key) {
      for (const k of ['fistsOfFire', 'fistsOfWind', 'fistsOfEarth']) if (k !== key) e.removeStatus(k, true);
      if (key !== 'fistsOfFire') e.removeStatus('riddleOfFire');
      e.addStatus(key, 1e9, { permanent: true });
    }
    gap(e) {
      const d = e.distToTarget() || 1;
      if (d > 2.6) {
        const from = { x: e.pos.x, z: e.pos.z };
        e.pos.x *= 2.4 / d; e.pos.z *= 2.4 / d;
        e.emit('teleport', { from, to: { x: e.pos.x, z: e.pos.z } });
      }
    }

    // Greased Lightning running out drops all stacks.
    nextEvent(e) { const k = GL_KEYS[e.g.gl - 1]; return k && e.statuses[k] ? e.statuses[k].until : Infinity; }
    process(e) { if (e.g.gl && !this.gl(e)) e.g.gl = 0; }

    proc(id, e) {
      const f = this.form(e), pb = e.has('perfectBalance');
      const a = this.actions[id];
      if (a.needs) return pb || e.has(a.needs);
      if (id === 'bootshine') return f === 'opoOpo' && !pb;
      if (id === 'tornadoKick') return this.gl(e) >= 3;
      if (id === 'forbiddenChakra') return true;
      if (id === 'riddleOfWind') return e.has('riddleOfWind');
      return false;
    }

    mpRegen() { return B.BASE_REGEN; }
    speedInfo(e) { return `GCD ${e.gcdForSpeed(e.stats.speed).toFixed(2)} base · ${e.gcdForSpeed(e.stats.speed, 15).toFixed(2)} with Greased Lightning III`; }

    // ---------- forms, Greased Lightning and chakra ----------
    gaugeBuild(root) {
      const forms = [['opoOpo', 'OPO-OPO', '#d9862e'], ['raptor', 'RAPTOR', '#3fa0c4'], ['coeurl', 'COEURL', '#c44f3f']];
      root.innerHTML = `
<svg width="360" height="160" viewBox="0 0 360 160">
  <defs><radialGradient id="mk-ch" cx="50%" cy="40%" r="60%"><stop offset="0" stop-color="#fff6d0"/><stop offset="1" stop-color="#e09a2a"/></radialGradient>
  <filter id="mk-g" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="3" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter></defs>
  <rect x="8" y="10" width="344" height="140" rx="14" fill="rgba(14,12,20,.86)" stroke="rgba(255,255,255,.22)"/>
  ${forms.map(([k, l, c], i) => `<g id="mk-${k}" transform="translate(${70 + i * 110} 50)" opacity=".3"><rect x="-48" y="-18" width="96" height="30" rx="8" fill="${c}"/><text y="3" text-anchor="middle" font-family="Noto Sans, sans-serif" font-size="11" font-weight="700" fill="#fff" letter-spacing="1">${l}</text></g>`).join('')}
  <text x="24" y="98" font-family="Noto Sans, sans-serif" font-size="11" font-weight="600" fill="#a9a3b4" letter-spacing="1">GREASED LIGHTNING</text>
  ${[0, 1, 2].map(k => `<path id="mk-gl${k}" d="M2 -12 L-6 2 L0 2 L-2 12 L6 -2 L0 -2 Z" transform="translate(${40 + k * 26} 122) scale(1.3)" fill="#2a2535" stroke="rgba(0,0,0,.8)" stroke-width="1"/>`).join('')}
  <text x="190" y="98" font-family="Noto Sans, sans-serif" font-size="11" font-weight="600" fill="#a9a3b4" letter-spacing="1">CHAKRA</text>
  ${[0, 1, 2, 3, 4].map(k => `<circle id="mk-c${k}" cx="${200 + k * 28}" cy="122" r="9" fill="#2a2535" stroke="rgba(0,0,0,.8)" stroke-width="1.5"/>`).join('')}
</svg>`;
      const $ = (s) => root.querySelector(s);
      this.mg = { forms: Object.fromEntries(FORMS.map(k => [k, $('#mk-' + k)])), gl: [0, 1, 2].map(k => $('#mk-gl' + k)), ch: [0, 1, 2, 3, 4].map(k => $('#mk-c' + k)), cache: {} };
    }

    gaugeUpdate(e) {
      const G = this.mg, c = G.cache, g = e.g;
      const put = (k, v, fn) => { if (c[k] !== v) { c[k] = v; fn(v); } };
      const pb = e.has('perfectBalance'), f = this.form(e);
      for (const k of FORMS) put('f' + k, pb || f === k, v => G.forms[k].setAttribute('opacity', v ? '1' : '.3'));
      const n = this.gl(e);
      for (let i = 0; i < 3; i++) put('g' + i, n > i, v => { G.gl[i].setAttribute('fill', v ? '#7fd4ff' : '#2a2535'); G.gl[i].setAttribute('filter', v ? 'url(#mk-g)' : ''); });
      for (let i = 0; i < 5; i++) put('c' + i, g.chakra > i, v => { G.ch[i].setAttribute('fill', v ? 'url(#mk-ch)' : '#2a2535'); G.ch[i].setAttribute('filter', v ? 'url(#mk-g)' : ''); });
    }

    helpHtml(seq) {
      return `
<h3>How it plays (Stormblood 4.2–4.58)</h3>
<p>Level 70 Monk on TP. Weaponskills cycle three forms: <b>Opo-opo</b> (Bootshine, a guaranteed crit from the rear, or Dragon Kick, which puts a 10% blunt debuff on the dummy), <b>Raptor</b> (True Strike, or Twin Snakes for +10% damage), <b>Coeurl</b> (Snap Punch, or Demolish and its DoT). Snap Punch and Demolish add a stack of <b>Greased Lightning</b>: three stacks are +30% damage and 15% faster GCDs and auto-attacks for 16s, so never let it drop. Positionals: Dragon Kick, Twin Snakes and Snap Punch from the flank, True Strike and Demolish from the rear.</p>
<p><b>Tornado Kick</b> (330) spends Greased Lightning III, so use it inside <b>Perfect Balance</b> (any form for 10s, every 60s), where three coeurl hits build it straight back. <b>Riddle of Fire</b> is +30% damage but a 15% slower GCD (90s, with <b>Brotherhood</b>, +5%, which also opens chakra). <b>Internal Release</b> is +30% crit. <b>Meditation</b> opens chakra out of combat; with five, it becomes <b>The Forbidden Chakra</b> (250). Stay in <b>Fists of Fire</b> (+6%); Fire Tackle (130) every 30s. Weaponskills cost TP; Invigorate gives 400 and Purification (five chakra) 300.</p>
<h3>An opener for this version</h3>
${seq([['perfectBalance'], 'snapPunch', ['internalRelease'], ['tincture'], 'twinSnakes', ['brotherhood'], 'demolish', ['riddleOfFire'], 'snapPunch', ['tornadoKick'], 'snapPunch', 'dragonKick', ['forbiddenChakra'], 'trueStrike', ['fireTackle'], 'demolish', ['steelPeak'], 'bootshine', ['howlingFist'], 'trueStrike', ['elixirField'], 'snapPunch'])}
<p>Open five chakra with Meditation before the pull and Perfect Balance just before it. This follows the version's rules; it isn't copied from a published guide.</p>
<p style="color:#a9a3b4">The 4.5 numbers: Bootshine 140, True Strike 160 (180 rear), Snap Punch 150 (170 flank), Dragon Kick 120 (140 flank), Twin Snakes 110 (130 flank), Demolish 50 (70 rear) + 50 × 18s, Tornado Kick 330, The Forbidden Chakra 250, Steel Peak 150, Howling Fist 210, Elixir Field 220, Fire Tackle 130, Fists of Fire 6%. Greased Lightning's haste and Riddle of Fire's slowdown are taken as adding up. Auto-attacks 110 potency at 2.56s; gear approximate.</p>`;
    }
  }

  B.MonkSB = MonkSB;
  B.MNK_SB = { ACTIONS, STATUSES };

  B.MonkSB = MonkSB;
  B.registerJob({
    id: 'mnk', name: 'Monk', abbr: 'MNK', role: 'melee', classJob: 20,
    versions: [{ id: 'sb42', label: 'Stormblood 4.2–4.58', history: 'SB 4.2–4.58', note: 'Level 70. Forms and Greased Lightning III, Tornado Kick, Riddle of Fire, Brotherhood, Perfect Balance every 60s, chakra and The Forbidden Chakra, Fire Tackle', create: () => new MonkSB() }],
  });
})(window.BLM);
