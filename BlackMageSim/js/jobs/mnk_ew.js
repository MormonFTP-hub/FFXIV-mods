// Monk, Endwalker at level 90, in three versions. Forms (opo-opo → raptor → coeurl), Greased Lightning as a
// permanent 20% haste (a 1.94 GCD), Disciplined Fist (+15%) from Twin Snakes, Leaden Fist from Dragon Kick for a
// stronger Bootshine (always a crit in opo-opo form), Demolish's DoT, chakra from every critical weaponskill for The
// Forbidden Chakra. Perfect Balance (two charges) lets three weaponskills ignore forms and fills the Beast Chakra; the
// Masterful Blitz button then becomes Elixir Field (three the same: Lunar Nadi), Rising Phoenix (three different:
// Solar Nadi), Celestial Revolution (two kinds) or, with both Nadi, Phantom Rush. Riddle of Fire (+15%, 60s),
// Brotherhood (+5%, 120s, a chakra per weaponskill) and Riddle of Wind (faster autos).
//  - 6.0–6.08: Perfect Balance usable while holding Beast Chakra; Phantom Rush 1,150 from 6.08.
//  - 6.1–6.28: Perfect Balance can't be used while holding Beast Chakra.
//  - 6.3–6.58: Riddle of Earth reworked (defensive only).
// Numbers are the game data at each patch (xivapi's datamining) and the Lodestone notes; gear is The Balance's set for
// each tier. ref: a scripted bot parses about 7,800 / 9,530 / 11,760 on these.
(function (B) {
  const ws = (o) => Object.assign({ kind: 'gcd', target: true, range: B.MELEE_RANGE, delay: 0.5, fx: 'slash' }, o);
  const ab = (o) => Object.assign({ kind: 'ogcd' }, o);
  const FORM = { opo: 'opoOpo', raptor: 'raptor', coeurl: 'coeurl' };
  const NEXT = { opo: 'raptor', raptor: 'coeurl', coeurl: 'opo' };
  const VERSIONS = {
    ew60: { label: 'Endwalker 6.0–6.08', history: 'EW 6.0–6.08', pbLock: false, tincture: 'str6', ref: 8260,
      stats: { hp: 78000, main: 2552, wd: 120, det: 1546, crit: 2323, dh: 1127, speed: 766 },
      note: 'Level 90: Masterful Blitz with Beast Chakra and the Nadi, Phantom Rush 1,150, Perfect Balance usable while holding Beast Chakra; Asphodelos gear' },
    ew61: { label: 'Endwalker 6.1–6.28', history: 'EW 6.1–6.28', pbLock: true, tincture: 'str7', ref: 10100,
      stats: { hp: 90000, main: 2926, wd: 126, det: 1546, crit: 2490, dh: 1179, speed: 769 },
      note: 'Level 90: Perfect Balance can\'t be used while holding Beast Chakra; Abyssos gear' },
    ew63: { label: 'Endwalker 6.3–6.58', history: 'EW 6.3–6.58', pbLock: true, tincture: 'str', ref: 12470,
      stats: { hp: 100000, main: 3356, wd: 132, det: 1613, crit: 2647, dh: 1202, speed: 771 },
      note: 'Level 90: Riddle of Earth reworked into a 120s mitigation; Anabaseios gear' },
  };

  const ACTIONS = {
    bootshine: ws({ name: 'Bootshine', potency: 210, form: 'opo', desc: 'Delivers an attack with a potency of 210.\nLeaden Fist Potency: 310\nOpo-opo Form Bonus: An attack that is guaranteed to be a critical hit\nAdditional Effect: Changes form to raptor\nDuration: 30s' }),
    dragonKick: ws({ name: 'Dragon Kick', potency: 320, form: 'opo', fx: 'slash2', desc: 'Delivers an attack with a potency of 320.\nOpo-opo Form Bonus: Grants Leaden Fist\nDuration: 30s\nAdditional Effect: Changes form to raptor\nDuration: 30s' }),
    trueStrike: ws({ name: 'True Strike', potency: 300, form: 'raptor', needs: true, desc: 'Delivers an attack with a potency of 300.\nCan only be executed when in raptor form.\nAdditional Effect: Changes form to coeurl\nDuration: 30s' }),
    twinSnakes: ws({ name: 'Twin Snakes', potency: 280, form: 'raptor', needs: true, fx: 'slash2', desc: 'Delivers an attack with a potency of 280.\nAdditional Effect: Grants Disciplined Fist, increasing damage dealt by 15%\nDuration: 15s\nCan only be executed when in raptor form.\nAdditional Effect: Changes form to coeurl\nDuration: 30s' }),
    snapPunch: ws({ name: 'Snap Punch', potency: 250, form: 'coeurl', needs: true, positional: 'flank', posBonus: 60, fx: 'slashFire', desc: 'Delivers an attack with a potency of 250.\n310 when executed from a target\'s flank.\nCan only be executed when in coeurl form.\nAdditional Effect: Changes form to opo-opo\nDuration: 30s' }),
    demolish: ws({ name: 'Demolish', potency: 70, form: 'coeurl', needs: true, positional: 'rear', posBonus: 60, dot: { potency: 70, duration: 18 }, fx: 'slash3', desc: 'Delivers an attack with a potency of 70.\n130 when executed from a target\'s rear.\nAdditional Effect: Damage over time\nPotency: 70\nDuration: 18s\nCan only be executed when in coeurl form.\nAdditional Effect: Changes form to opo-opo\nDuration: 30s' }),
    shadowOfTheDestroyer: ws({ name: 'Shadow of the Destroyer', potency: 110, form: 'opo', target: false, pbaoe: 5, aoe: true, fx: 'slash3', desc: 'Delivers an attack with a potency of 110 to all nearby enemies.\nOpo-opo Form Bonus: An attack that is guaranteed to be a critical hit\nAdditional Effect: Changes form to raptor' }),
    fourPointFury: ws({ name: 'Four-point Fury', potency: 120, form: 'raptor', needs: true, target: false, pbaoe: 5, aoe: true, fx: 'slash3', desc: 'Delivers an attack with a potency of 120 to all nearby enemies.\nAdditional Effect: Grants Disciplined Fist\nCan only be executed when in raptor form.\nAdditional Effect: Changes form to coeurl' }),
    rockbreaker: ws({ name: 'Rockbreaker', potency: 130, form: 'coeurl', needs: true, target: false, pbaoe: 5, aoe: true, fx: 'slash3', desc: 'Delivers an attack with a potency of 130 to all nearby enemies.\nCan only be executed when in coeurl form.\nAdditional Effect: Changes form to opo-opo' }),
    sixSidedStar: ws({ name: 'Six-sided Star', potency: 550, recast: 5, fx: 'gnbDouble', desc: 'Delivers an attack with a potency of 550.\nAdditional Effect: Increases movement speed\nDuration: 5s\nThis weaponskill does not share a recast timer with any other actions; its recast (5s) stands in for the GCD.' }),
    formShift: ws({ name: 'Form Shift', potency: 0, target: false, desc: 'Grants Formless Fist, allowing the execution of a weaponskill that requires a form, with its bonus.\nDuration: 30s' }),
    meditation: ws({ name: 'Meditation', potency: 0, recast: 1, target: false, desc: 'Opens a chakra (all five when used out of combat).' }),
    masterfulBlitz: ws({ name: 'Masterful Blitz', potency: 0, target: false, desc: 'Performs an action determined by the Beast Chakra. Every Blitz grants Formless Fist.' }),
    elixirField: ws({ name: 'Elixir Field', potency: 600, aoe: 0.3, blitz: true, fx: 'gnbZone', desc: 'Delivers an attack with a potency of 600 to target and all enemies nearby it, 70% less for the rest.\nThree Beast Chakra of the same type. Opens Lunar Nadi.' }),
    celestialRevolution: ws({ name: 'Celestial Revolution', potency: 450, blitz: true, fx: 'gnbBurst', desc: 'Delivers an attack with a potency of 450.\nTwo types of Beast Chakra. Opens Lunar Nadi, or Solar if Lunar is already open.' }),
    risingPhoenix: ws({ name: 'Rising Phoenix', potency: 700, aoe: 0.3, blitz: true, fx: 'slashFire', desc: 'Delivers a fire attack with a potency of 700 to target and all enemies nearby it, 70% less for the rest.\nThree different types of Beast Chakra. Opens Solar Nadi.' }),
    phantomRush: ws({ name: 'Phantom Rush', potency: 1150, aoe: 0.5, blitz: true, fx: 'gnbDouble', desc: 'Delivers an attack with a potency of 1,150 to target and all enemies nearby it, 50% less for the rest (1,000 before 6.08).\nRequires both Lunar and Solar Nadi and three Beast Chakra. Consumes both Nadi.' }),
    forbiddenChakra: ab({ name: 'The Forbidden Chakra', recast: 1, cdGroup: 'chakra', potency: 340, chakra: 5, target: true, range: B.MELEE_RANGE, delay: 0.6, fx: 'gnbBurst', desc: 'Delivers an attack with a potency of 340.\nCan only be executed while in possession of five chakra.' }),
    enlightenment: ab({ name: 'Enlightenment', recast: 1, cdGroup: 'chakra', potency: 170, chakra: 5, target: true, range: 10, delay: 0.6, aoe: true, fx: 'gnbBow', desc: 'Delivers an attack with a potency of 170 to all enemies in a straight line before you.\nCan only be executed while in possession of five chakra.' }),
    perfectBalance: ab({ name: 'Perfect Balance', recast: 40, charges: 2, desc: 'Allows execution of weaponskills which require a certain form, without being in that form, and grants a Beast Chakra for each of three weaponskills.\nDuration: 20s\nMaximum Charges: 2\nCan only be executed in combat.' }),
    riddleOfFire: ab({ name: 'Riddle of Fire', recast: 60, desc: 'Increases damage dealt by 15%.\nDuration: 20s' }),
    brotherhood: ab({ name: 'Brotherhood', recast: 120, desc: 'Increases damage dealt by self and nearby party members by 5%.\nDuration: 15s\nAdditional Effect: Each of your weaponskills opens a chakra.' }),
    riddleOfWind: ab({ name: 'Riddle of Wind', recast: 90, desc: 'Reduces auto-attack delay by 50%.\nDuration: 15s' }),
    thunderclap: ab({ name: 'Thunderclap', recast: 30, charges: 3, target: true, range: 20, desc: 'Rush to a target or party member\'s side.\nMaximum Charges: 3' }),
    anatman: ab({ name: 'Anatman', recast: 60, desc: 'Extends the duration of Disciplined Fist and your form while channelled.' }),
    mantra: ab({ name: 'Mantra', recast: 90, desc: 'Increases HP recovery via healing actions for self and party members by 10%.\nDuration: 15s' }),
    riddleOfEarth: ab({ name: 'Riddle of Earth', recast: 120, desc: 'Reduces damage taken by 20%.\nDuration: 10s\nAdditional Effect: Earth\'s Reply (a heal over time) when you take damage.' }),
    ...B.ROLE_ACTIONS.melee,
    ...B.GENERAL_ACTIONS,
    auto: { name: 'Attack', kind: 'auto', fx: 'auto', desc: 'Auto-attack.' },
  };
  const BEAST = { opo: 'opo', raptor: 'raptor', coeurl: 'coeurl' };

  const STATUSES = {
    opoOpo: { name: 'Opo-opo Form', self: true, icon: 'st_opo' },
    raptor: { name: 'Raptor Form', self: true, icon: 'st_raptor' },
    coeurl: { name: 'Coeurl Form', self: true, icon: 'st_coeurl' },
    formlessFist: { name: 'Formless Fist', self: true, icon: 'st_formless' },
    perfectBalance: { name: 'Perfect Balance', self: true, icon: 'st_pb' },
    disciplinedFist: { name: 'Disciplined Fist', self: true, icon: 'st_df' },
    leadenFist: { name: 'Leaden Fist', self: true, icon: 'st_leaden' },
    riddleOfFire: { name: 'Riddle of Fire', self: true, icon: 'st_rof' },
    brotherhood: { name: 'Brotherhood', self: true, icon: 'st_bh' },
    riddleOfWind: { name: 'Riddle of Wind', self: true, icon: 'st_row' },
    riddleOfEarth: { name: 'Riddle of Earth', self: true, icon: 'st_roe' },
    mantra: { name: 'Mantra', self: true, icon: 'st_mantra' },
    demolish: { name: 'Demolish', self: false, icon: 'st_demolish' },
  };

  class MonkEW {
    constructor(version) {
      const V = VERSIONS[version];
      this.V = V;
      this.name = 'Monk';
      this.abbr = 'MNK';
      this.role = 'melee';
      this.level = 90;
      this.levelKey = 90;
      this.model = 'mnk-ew';
      this.actions = Object.assign({}, ACTIONS, { tincture: B.tincture(V.tincture) });
      if (version === 'ew60') this.actions.phantomRush = Object.assign({}, ACTIONS.phantomRush);
      this.statuses = STATUSES;
      this.stats = Object.assign({ mainStat: 'str', jobMod: 110, trait: 100, delay: 2.56 }, V.stats);
      this.speedName = 'Skill speed';
      this.tierHaste = 20;          // Greased Lightning is always on: GCDs are quoted with it (1.94)
      this.autoAttack = { potency: 90, delay: 2.56, range: B.MELEE_RANGE };
      this.selfStatusOrder = ['disciplinedFist', 'leadenFist', 'riddleOfFire', 'brotherhood', 'perfectBalance', 'formlessFist', 'opoOpo', 'raptor', 'coeurl',
        'riddleOfWind', 'medicated', 'riddleOfEarth', 'mantra', 'trueNorth', 'bloodbath', 'armsLength', 'sprint'];
      this.targetStatusOrder = ['demolish', 'feint'];
      this.defaultBars = [
        ['bootshine', 'dragonKick', 'trueStrike', 'twinSnakes', 'snapPunch', 'demolish', 'masterfulBlitz', 'perfectBalance', 'forbiddenChakra', 'riddleOfFire', 'brotherhood', 'riddleOfWind'],
        ['shadowOfTheDestroyer', 'fourPointFury', 'rockbreaker', 'enlightenment', 'sixSidedStar', 'formShift', 'meditation', 'thunderclap', 'trueNorth', 'tincture', 'anatman', 'riddleOfEarth'],
        ['mantra', 'feint', 'bloodbath', 'secondWind', 'legSweep', 'armsLength', 'sprint', null, null, null, null, null],
      ];
      this.actionGroups = [
        ['Monk', ['bootshine', 'dragonKick', 'trueStrike', 'twinSnakes', 'snapPunch', 'demolish', 'shadowOfTheDestroyer', 'fourPointFury', 'rockbreaker',
          'sixSidedStar', 'formShift', 'meditation', 'masterfulBlitz', 'elixirField', 'celestialRevolution', 'risingPhoenix', 'phantomRush', 'forbiddenChakra',
          'enlightenment', 'perfectBalance', 'riddleOfFire', 'brotherhood', 'riddleOfWind', 'thunderclap', 'anatman', 'mantra', 'riddleOfEarth']],
        ['Role Actions', ['trueNorth', 'secondWind', 'legSweep', 'bloodbath', 'feint', 'armsLength']],
        ['General', ['sprint', 'tincture']],
      ];
      this.referenceDps = V.ref;
      this.referenceGcd = 1.94;
      this.startDistance = 3.2;
    }

    initGauge(e) {
      e.addStatus('opoOpo', 30);
      return { chakra: 0, beast: [], lunar: false, solar: false };
    }

    haste() { return 20; }
    autoHaste(e) { return e.has('riddleOfWind') ? 60 : 20; }

    blitzFor(g) {
      if (g.beast.length < 3) return null;
      if (g.lunar && g.solar) return 'phantomRush';
      const kinds = new Set(g.beast).size;
      return kinds === 1 ? 'elixirField' : kinds === 3 ? 'risingPhoenix' : 'celestialRevolution';
    }
    resolveId(id, e) {
      if (id === 'masterfulBlitz') return this.blitzFor(e.g) || id;
      return id;
    }

    // Raptor and coeurl weaponskills need their form, Formless Fist or Perfect Balance.
    inForm(form, e) { return e.has(FORM[form]) || e.has('formlessFist') || e.has('perfectBalance'); }

    check(id, e) {
      const a = this.actions[id], g = e.g;
      if (id === 'masterfulBlitz') return 'Unable to execute action. Three Beast Chakra required.';
      if (a.blitz && this.blitzFor(g) !== id) return 'Unable to execute action.';
      if (a.needs && !this.inForm(a.form, e)) return `Unable to execute action. ${a.form === 'raptor' ? 'Raptor' : 'Coeurl'} form required.`;
      if (a.chakra && g.chakra < a.chakra) return 'Unable to execute action. Five chakra required.';
      if (id === 'perfectBalance') {
        if (!e.inCombat) return 'Unable to execute action while not in combat.';
        if (e.has('perfectBalance')) return 'Unable to execute action.';
        if (this.V.pbLock && g.beast.length) return 'Unable to execute action while holding Beast Chakra.';
      }
      return null;
    }

    snapshot(a, e) {
      let mult = 1;
      if (e.has('disciplinedFist')) mult *= 1.15;
      if (e.has('riddleOfFire')) mult *= 1.15;
      if (e.has('brotherhood')) mult *= 1.05;
      const main = this.stats.main + (e.has('medicated') ? B.TINCTURES[this.V.tincture].cap : 0);
      return { mult, main };
    }

    setForm(e, form) {
      for (const k of Object.values(FORM)) e.removeStatus(k, true);
      if (form) e.addStatus(FORM[form], 30);
    }
    addChakra(e, n) { e.g.chakra = Math.min(5, e.g.chakra + n); }

    resolve(id, e) {
      const a = this.actions[id], g = e.g;
      let potency = a.potency || 0;
      const opts = {};
      if (a.form) {
        // The form bonus: in that form, under Formless Fist, or under Perfect Balance.
        const bonus = e.has(FORM[a.form]) || e.has('formlessFist') || e.has('perfectBalance');
        const pb = e.has('perfectBalance');
        if (e.has('formlessFist') && !pb) e.removeStatus('formlessFist', true);
        if (pb) {
          g.beast.push(BEAST[a.form]);
          const s = e.statuses.perfectBalance;
          s.stacks = (s.stacks || 1) - 1;
          if (s.stacks <= 0) e.removeStatus('perfectBalance'); else e.emit('statusStack', { key: 'perfectBalance' });
        } else this.setForm(e, NEXT[a.form]);
        if ((id === 'bootshine' || id === 'shadowOfTheDestroyer') && bonus) opts.crit = true;
        if (id === 'bootshine' && e.has('leadenFist')) { potency = 310; e.removeStatus('leadenFist'); }
        if (id === 'dragonKick' && bonus) e.addStatus('leadenFist', 30);
        if (id === 'twinSnakes' || id === 'fourPointFury') e.addStatus('disciplinedFist', 15);
        if (a.positional) { const pos = e.positionalHit(a); if (pos) potency += a.posBonus; opts.positional = pos ? 'hit' : 'miss'; }
      }
      if (a.blitz) {
        if (id === 'elixirField') g.lunar = true;
        else if (id === 'risingPhoenix') g.solar = true;
        else if (id === 'celestialRevolution') { if (g.lunar) g.solar = true; else g.lunar = true; }
        else if (id === 'phantomRush') { g.lunar = false; g.solar = false; }
        g.beast = [];
        e.addStatus('formlessFist', 30);
      }
      if (a.kind === 'gcd' && potency) {
        // Every critical weaponskill opens a chakra; under Brotherhood every weaponskill does.
        const bh = e.has('brotherhood');
        opts.onResult = (r) => { if (r.crit || bh) this.addChakra(e, 1); };
      }
      if (a.chakra) g.chakra -= a.chakra;
      switch (id) {
        case 'formShift': e.addStatus('formlessFist', 30); break;
        case 'meditation': this.addChakra(e, e.inCombat ? 1 : 5); break;
        case 'perfectBalance': e.addStatus('perfectBalance', 20, { stacks: 3 }); break;
        case 'riddleOfFire': e.addStatus('riddleOfFire', 20); break;
        case 'brotherhood': e.addStatus('brotherhood', 15); break;
        case 'riddleOfWind': e.addStatus('riddleOfWind', 15); break;
        case 'riddleOfEarth': e.addStatus('riddleOfEarth', 10); break;
        case 'mantra': e.addStatus('mantra', 15); break;
        case 'thunderclap': {
          const d = e.distToTarget() || 1;
          if (d > 2.6) { const from = { x: e.pos.x, z: e.pos.z }; e.pos.x *= 2.4 / d; e.pos.z *= 2.4 / d; e.emit('teleport', { from, to: { x: e.pos.x, z: e.pos.z } }); }
          break;
        }
        default:
          if (B.ROLE_EFFECTS[id]) B.ROLE_EFFECTS[id](e);
      }
      if (potency) {
        const snap = this.snapshot(a, e);
        const after = a.dot ? () => e.addTStatus(id, a.dot.duration, { snap, dot: { potency: a.dot.potency, id } }) : null;
        e.queueHit(id, potency, snap, a.delay, after, opts);
      }
    }

    proc(id, e) {
      const a = this.actions[id], g = e.g;
      if (a.needs && (e.has(FORM[a.form]) || e.has('formlessFist') || e.has('perfectBalance'))) return true;
      if (a.form === 'opo' && (e.has('opoOpo') || e.has('formlessFist'))) return id !== 'shadowOfTheDestroyer';
      if (a.blitz) return this.blitzFor(g) === id;
      if (a.chakra) return g.chakra >= 5;
      return false;
    }

    mpRegen() { return B.BASE_REGEN; }
    speedInfo(e) { return `GCD ${e.gcdForSpeed(e.stats.speed, 20).toFixed(2)} with Greased Lightning`; }

    // ---------- the Master's Gauge: chakra, Beast Chakra and the Nadi ----------
    gaugeBuild(root) {
      root.innerHTML = `
<svg width="360" height="130" viewBox="0 0 360 130">
  <rect x="8" y="10" width="344" height="110" rx="14" fill="rgba(14,12,20,.86)" stroke="rgba(255,255,255,.22)"/>
  <text x="24" y="36" font-family="Noto Sans, sans-serif" font-size="11" font-weight="600" fill="#a9a3b4" letter-spacing="1">CHAKRA</text>
  ${[0, 1, 2, 3, 4].map(k => `<circle id="mk-c${k}" cx="${110 + k * 26}" cy="32" r="9" fill="#2a2535" stroke="rgba(0,0,0,.8)" stroke-width="1.5"/>`).join('')}
  <text x="24" y="72" font-family="Noto Sans, sans-serif" font-size="11" font-weight="600" fill="#a9a3b4" letter-spacing="1">BEAST CHAKRA</text>
  ${[0, 1, 2].map(k => `<rect id="mk-b${k}" x="${136 + k * 36}" y="56" width="26" height="26" rx="6" fill="#2a2535" stroke="rgba(0,0,0,.8)" stroke-width="1.5"/>`).join('')}
  <text x="24" y="106" font-family="Noto Sans, sans-serif" font-size="11" font-weight="600" fill="#a9a3b4" letter-spacing="1">NADI</text>
  <circle id="mk-lunar" cx="130" cy="102" r="9" fill="#2a2535" stroke="rgba(0,0,0,.8)" stroke-width="1.5"/>
  <circle id="mk-solar" cx="160" cy="102" r="9" fill="#2a2535" stroke="rgba(0,0,0,.8)" stroke-width="1.5"/>
  <text id="mk-blitz" x="336" y="106" text-anchor="end" font-family="Noto Sans, sans-serif" font-size="12" font-weight="600" fill="#ffd27a"></text>
</svg>`;
      const $ = (s) => root.querySelector(s);
      this.mg = { c: [0, 1, 2, 3, 4].map(k => $('#mk-c' + k)), b: [0, 1, 2].map(k => $('#mk-b' + k)), lunar: $('#mk-lunar'), solar: $('#mk-solar'), blitz: $('#mk-blitz'), cache: {} };
    }

    gaugeUpdate(e) {
      const G = this.mg, c = G.cache, g = e.g;
      const put = (k, v, fn) => { if (c[k] !== v) { c[k] = v; fn(v); } };
      const COL = { opo: '#e8a0c8', raptor: '#f0c060', coeurl: '#70c0e8' };
      for (let i = 0; i < 5; i++) put('c' + i, g.chakra > i, v => G.c[i].setAttribute('fill', v ? '#ffd27a' : '#2a2535'));
      for (let i = 0; i < 3; i++) put('b' + i, g.beast[i] || '', v => G.b[i].setAttribute('fill', v ? COL[v] : '#2a2535'));
      put('l', g.lunar, v => G.lunar.setAttribute('fill', v ? '#c8b8ff' : '#2a2535'));
      put('s', g.solar, v => G.solar.setAttribute('fill', v ? '#ff9a5a' : '#2a2535'));
      const b = this.blitzFor(g);
      put('bz', b || '', v => { G.blitz.textContent = v ? this.actions[v].name : ''; });
    }

    helpHtml(seq) {
      const V = this.V;
      return `
<h3>How it plays (${V.label})</h3>
<p>Level 90 Monk with Greased Lightning always on (a 1.94 GCD). Weaponskills go round the forms: opo-opo (<b>Dragon Kick</b> gives Leaden Fist, then <b>Bootshine</b> 310, always a crit in opo-opo form), raptor (<b>Twin Snakes</b> for Disciplined Fist, +15%; otherwise <b>True Strike</b>), coeurl (<b>Demolish</b> from the rear for its DoT, otherwise <b>Snap Punch</b> from the flank). Every critical weaponskill opens a chakra; at five, weave <b>The Forbidden Chakra</b> (340).</p>
<p><b>Perfect Balance</b> (two charges) lets three weaponskills ignore forms and fills the <b>Beast Chakra</b>: three the same make <b>Elixir Field</b> (Lunar Nadi), three different <b>Rising Phoenix</b> (Solar Nadi), and with both Nadi any three make <b>Phantom Rush</b> (1,150). Every Blitz gives Formless Fist. Line Perfect Balance up with <b>Riddle of Fire</b> (+15%, 60s); <b>Brotherhood</b> (+5%, 120s) opens a chakra with every weaponskill.${V.pbLock ? ' From 6.1 you can\'t press Perfect Balance while still holding Beast Chakra.' : ''}</p>
<h3>The opener (The Balance, Lunar–Solar)</h3>
${seq(['dragonKick', ['tincture'], 'trueStrike', ['riddleOfFire'], 'demolish', ['forbiddenChakra'], 'bootshine', ['brotherhood'], ['perfectBalance'], 'dragonKick', ['riddleOfWind'], 'bootshine', 'dragonKick', 'elixirField', 'bootshine', ['perfectBalance'], 'trueStrike', 'dragonKick', 'demolish', 'risingPhoenix'])}
<p>Before the pull: Meditation to five chakra, Form Shift, Thunderclap in.</p>
<p style="color:#a9a3b4">${V.label} numbers: Bootshine 210 (310 Leaden Fist), Dragon Kick 320, True Strike 300, Twin Snakes 280, Snap Punch 250 (310 flank), Demolish 70 (130 rear) + 70 × 18s, Six-sided Star 550, Elixir Field 600, Celestial Revolution 450, Rising Phoenix 700, Phantom Rush 1,150, The Forbidden Chakra 340; auto-attacks 90 at 2.56s (Greased Lightning −20%, Riddle of Wind taken as −50% on top). Gear: The Balance's set for the tier (Strength ${V.stats.main.toLocaleString()}).</p>`;
    }
  }

  B.MonkEW = MonkEW;
  B.registerJob({
    id: 'mnk', name: 'Monk', abbr: 'MNK', role: 'melee', classJob: 20,
    versions: ['ew63', 'ew61', 'ew60'].map(v => ({ id: v, label: VERSIONS[v].label, history: VERSIONS[v].history, note: VERSIONS[v].note, create: () => new MonkEW(v) })),
  });
})(window.BLM);
