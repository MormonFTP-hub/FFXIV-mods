// Monk, Dawntrail at level 100. Built on the Endwalker class (mnk_ew.js) for the forms, Greased Lightning (a permanent
// 20% haste), Perfect Balance, the Beast Chakra and the Nadi. Dawntrail took away Disciplined Fist, Leaden Fist and
// Demolish's DoT, and put three Fury counters on the gauge instead: Dragon Kick (with the opo-opo bonus) stores an
// Opo-opo's Fury for Leaping Opo (+200), Twin Snakes a Raptor's Fury for Rising Raptor (+200), Demolish two Coeurl's
// Fury for two Pouncing Coeurls (+150 each). So each form alternates its two weaponskills: an 18-GCD loop. The
// Blitzes are bigger (Elixir Burst, Rising Phoenix, Phantom Rush) and each grants Formless Fist; Riddle of Fire (+15%,
// 60s) readies Fire's Reply (1,400, a GCD that also grants Formless Fist) and Riddle of Wind readies Wind's Reply
// (1,040). Brotherhood (+5%, 20s) opens a chakra with every weaponskill and lets ten be open. Six-sided Star is 780 +
// 80 for each open chakra, which it spends. Anatman is gone.
//  - 7.01–7.57: the 7.3–7.57 numbers (Blitzes and Replies 35% less for the rest; 7.01–7.18 had Phantom Rush 1,400–1,500,
//    Wind's Reply 800–900, Fire's Reply 1,100–1,200, Enlightenment 200), Meditation locked at five chakra (7.1).
//    The Balance's 7.4 savage set at 1.94 (Strength 6,490, 158 weapon damage).
//  - 7.0: Twin Snakes 380 for two Raptor's Fury (+150 each, Rising Raptor 330), Demolish 340 for three Coeurl's Fury
//    (+100 each, Pouncing Coeurl 340), Dragon Kick's Fury in any form; Celestial Revolution 450, Phantom Rush 1,400,
//    Wind's Reply 800, Fire's Reply 1,100. No Balance set for 7.0: an estimated launch set (Strength 4,346).
// Numbers are the game data at 7.0, 7.01, 7.05, 7.2, 7.3 and 7.57 (xivapi's datamining) and the Lodestone notes.
// ref: a scripted bot parses about 37,900 and 19,200 on these.
(function (B) {
  const EW = B.MonkEW;
  const ws = (o) => Object.assign({ kind: 'gcd', target: true, range: B.MELEE_RANGE, delay: 0.5, fx: 'slash' }, o);
  const set = (A, id, o) => { A[id] = Object.assign({}, A[id], o); };
  const FORM = { opo: 'opoOpo', raptor: 'raptor', coeurl: 'coeurl' };
  const NEXT = { opo: 'raptor', raptor: 'coeurl', coeurl: 'opo' };

  // fury: [stacks granted (= the cap), bonus per stack]
  const VERSIONS = {
    dt701: { label: 'Dawntrail 7.01–7.57', history: 'DT 7.01–7.57', tincture: 'strdt4', ref: 40200, medLock: true, pbLock: true, dkAnyForm: false,
      fury: { opo: [1, 200], raptor: [1, 200], coeurl: [2, 150] }, twin: 420, raptorP: 340, demo: 360, pounce: 310,
      celestial: 600, phantom: 1500, elixir: 900, phoenix: 900, wind: 1040, fire: 1400, aoe: [1, 0.65], enlight: 160, aoeWs: [120, 140, 150],
      stats: { hp: 226628, main: 6490, wd: 158, det: 2426, crit: 3605, dh: 1523, speed: 959 },
      gear: 'The Balance\'s 7.4 savage set at 1.94 (Strength 6,490, 158 weapon damage), with a Grade 4 Gemdraught',
      note: 'Level 100: the Fury counters (Leaping Opo, Rising Raptor, Pouncing Coeurl), Elixir Burst and Phantom Rush 1,500, Fire\'s Reply and Wind\'s Reply, a 10-chakra Brotherhood; the 7.4 savage set' },
    dt70: { label: 'Dawntrail 7.0', history: 'DT 7.0', tincture: 'strdt1', ref: 20400, medLock: false, pbLock: true, dkAnyForm: true,
      fury: { opo: [1, 200], raptor: [2, 150], coeurl: [3, 100] }, twin: 380, raptorP: 330, demo: 340, pounce: 340,
      celestial: 450, phantom: 1400, elixir: 900, phoenix: 900, wind: 800, fire: 1100, aoe: [1, 0.5], aoeBlitz: [1, 0.3], enlight: 170, aoeWs: [110, 120, 130],
      stats: { hp: 129800, main: 4346, wd: 141, det: 2308, crit: 2158, dh: 2222, speed: 582 },
      gear: 'an estimated launch set (Strength 4,346, 141 weapon damage), with a Grade 1 Gemdraught',
      note: 'Level 100 at launch: Twin Snakes gives two Raptor\'s Fury and Demolish three Coeurl\'s Fury, Phantom Rush 1,400, smaller Replies; estimated launch gear' },
  };

  class MonkDT extends EW {
    constructor(v) {
      super('ew63');
      const V = this.V = Object.assign({}, VERSIONS[v]);
      this.level = 100;
      this.levelKey = 100;
      const A = Object.assign({}, this.actions);
      for (const k of ['bootshine', 'trueStrike', 'snapPunch', 'elixirField', 'anatman']) delete A[k];
      const blitzAoe = V.aoeBlitz || V.aoe, less = (x) => Math.round((1 - x[1]) * 100);
      A.leapingOpo = ws({ name: 'Leaping Opo', potency: 260, form: 'opo', desc: `Delivers an attack with a potency of 260.\nOpo-opo's Fury Potency: ${260 + V.fury.opo[1]}\nOpo-opo Form Bonus: Guarantees a critical hit\nAdditional Effect: Changes form to raptor\nDuration: 30s` });
      set(A, 'dragonKick', { desc: `Delivers an attack with a potency of 320.\n${V.dkAnyForm ? 'Additional Effect' : 'Opo-opo Form Bonus'}: Grants Opo-opo's Fury\nAdditional Effect: Changes form to raptor\nDuration: 30s` });
      A.risingRaptor = ws({ name: 'Rising Raptor', potency: V.raptorP, form: 'raptor', needs: true, desc: `Delivers an attack with a potency of ${V.raptorP}.\nRaptor's Fury Potency: ${V.raptorP + V.fury.raptor[1]}\nCan only be executed when in raptor form.\nAdditional Effect: Changes form to coeurl\nDuration: 30s` });
      set(A, 'twinSnakes', { potency: V.twin, desc: `Delivers an attack with a potency of ${V.twin}.\nAdditional Effect: Grants ${V.fury.raptor[0] > 1 ? V.fury.raptor[0] + ' stacks' : 'a stack'} of Raptor's Fury\nCan only be executed when in raptor form.\nAdditional Effect: Changes form to coeurl\nDuration: 30s` });
      A.pouncingCoeurl = ws({ name: 'Pouncing Coeurl', potency: V.pounce, form: 'coeurl', needs: true, positional: 'flank', posBonus: 60, fx: 'slashFire',
        desc: `Delivers an attack with a potency of ${V.pounce}.\n${V.pounce + 60} when executed from a target's flank.\nCoeurl's Fury Potency: ${V.pounce + V.fury.coeurl[1]}\nCan only be executed when in coeurl form.\nAdditional Effect: Changes form to opo-opo\nDuration: 30s` });
      set(A, 'demolish', { potency: V.demo, dot: undefined, desc: `Delivers an attack with a potency of ${V.demo}.\n${V.demo + 60} when executed from a target's rear.\nAdditional Effect: Grants ${V.fury.coeurl[0]} stacks of Coeurl's Fury\nCan only be executed when in coeurl form.\nAdditional Effect: Changes form to opo-opo\nDuration: 30s` });
      set(A, 'shadowOfTheDestroyer', { potency: V.aoeWs[0] });
      set(A, 'fourPointFury', { potency: V.aoeWs[1], desc: `Delivers an attack with a potency of ${V.aoeWs[1]} to all nearby enemies.\nCan only be executed when in raptor form.\nAdditional Effect: Changes form to coeurl` });
      set(A, 'rockbreaker', { potency: V.aoeWs[2] });
      set(A, 'sixSidedStar', { potency: 780, desc: 'Delivers an attack with a potency of 780, plus 80 for each open chakra.\nAll open chakra close upon execution.\nThis weaponskill does not share a recast timer with any other actions; its recast (5s) stands in for the GCD.' });
      set(A, 'meditation', { name: 'Forbidden Meditation', desc: `Opens a chakra (all five when used out of combat).${V.medLock ? '\nCan only be executed while less than five chakra are open.' : ''}` });
      A.elixirBurst = ws({ name: 'Elixir Burst', potency: V.elixir, aoe: blitzAoe, blitz: true, fx: 'gnbZone', desc: `Delivers an attack with a potency of ${V.elixir} to target and all enemies nearby it, ${less(blitzAoe)}% less for the rest.\nThree Beast Chakra of the same type. Opens Lunar Nadi.\nAdditional Effect: Grants Formless Fist` });
      set(A, 'celestialRevolution', { potency: V.celestial, desc: A.celestialRevolution.desc.replace('450', String(V.celestial)) });
      set(A, 'risingPhoenix', { potency: V.phoenix, aoe: blitzAoe, desc: `Delivers a fire attack with a potency of ${V.phoenix} to target and all enemies nearby it, ${less(blitzAoe)}% less for the rest.\nThree different types of Beast Chakra. Opens Solar Nadi.\nAdditional Effect: Grants Formless Fist` });
      set(A, 'phantomRush', { potency: V.phantom, aoe: V.aoe, desc: `Delivers an attack with a potency of ${V.phantom.toLocaleString()} to target and all enemies nearby it, ${less(V.aoe)}% less for the rest.\nRequires both Lunar and Solar Nadi and three Beast Chakra. Consumes both Nadi.` });
      set(A, 'forbiddenChakra', { potency: 400, desc: 'Delivers an attack with a potency of 400.\nCan only be executed while in possession of five chakra.' });
      set(A, 'enlightenment', { potency: V.enlight, desc: A.enlightenment.desc.replace('170', String(V.enlight)) });
      A.firesReply = ws({ name: 'Fire\'s Reply', potency: V.fire, aoe: V.aoe, range: 20, fx: 'slashFire',
        desc: `Delivers an attack with a potency of ${V.fire.toLocaleString()} to the target and ${less(V.aoe)}% less to all enemies nearby it.\nAdditional Effect: Grants Formless Fist\nCan only be executed while under the effect of Fire's Rumination.` });
      A.windsReply = ws({ name: 'Wind\'s Reply', potency: V.wind, aoe: V.aoe, range: 10, fx: 'gnbBow',
        desc: `Delivers an attack to all enemies in a straight line before you with a potency of ${V.wind.toLocaleString()} for the first enemy, ${less(V.aoe)}% less for the rest.\nCan only be executed while under the effect of Wind's Rumination.` });
      set(A, 'riddleOfFire', { desc: 'Increases damage dealt by 15%.\nDuration: 20s\nAdditional Effect: Grants Fire\'s Rumination\nDuration: 20s' });
      set(A, 'riddleOfWind', { desc: 'Reduces auto-attack delay by 50%.\nDuration: 15s\nAdditional Effect: Grants Wind\'s Rumination\nDuration: 15s' });
      set(A, 'brotherhood', { desc: 'Increases damage dealt by self and nearby party members by 5%.\nDuration: 20s\nAdditional Effect: Each of your weaponskills opens a chakra; up to ten can be open.' });
      A.tincture = B.tincture(V.tincture);
      this.actions = A;
      this.statuses = Object.assign({}, this.statuses, {
        firesRumination: { name: 'Fire\'s Rumination', self: true, icon: 'st_firesRumination' },
        windsRumination: { name: 'Wind\'s Rumination', self: true, icon: 'st_windsRumination' },
      });
      this.stats = Object.assign({}, this.stats, V.stats);
      this.selfStatusOrder = ['riddleOfFire', 'brotherhood', 'perfectBalance', 'formlessFist', 'opoOpo', 'raptor', 'coeurl', 'firesRumination', 'windsRumination',
        'riddleOfWind', 'medicated', 'riddleOfEarth', 'mantra', 'trueNorth', 'bloodbath', 'armsLength', 'sprint'];
      this.targetStatusOrder = ['feint'];
      this.defaultBars = [
        ['leapingOpo', 'dragonKick', 'risingRaptor', 'twinSnakes', 'pouncingCoeurl', 'demolish', 'masterfulBlitz', 'perfectBalance', 'forbiddenChakra', 'riddleOfFire', 'brotherhood', 'riddleOfWind'],
        ['firesReply', 'windsReply', 'shadowOfTheDestroyer', 'fourPointFury', 'rockbreaker', 'enlightenment', 'sixSidedStar', 'formShift', 'meditation', 'thunderclap', 'trueNorth', 'tincture'],
        ['riddleOfEarth', 'mantra', 'feint', 'bloodbath', 'secondWind', 'legSweep', 'armsLength', 'sprint', null, null, null, null],
      ];
      this.actionGroups = [
        ['Monk', ['leapingOpo', 'dragonKick', 'risingRaptor', 'twinSnakes', 'pouncingCoeurl', 'demolish', 'shadowOfTheDestroyer', 'fourPointFury', 'rockbreaker',
          'sixSidedStar', 'formShift', 'meditation', 'masterfulBlitz', 'elixirBurst', 'celestialRevolution', 'risingPhoenix', 'phantomRush', 'forbiddenChakra',
          'enlightenment', 'firesReply', 'windsReply', 'perfectBalance', 'riddleOfFire', 'brotherhood', 'riddleOfWind', 'thunderclap', 'mantra', 'riddleOfEarth']],
        ['Role Actions', ['trueNorth', 'secondWind', 'legSweep', 'bloodbath', 'feint', 'armsLength']],
        ['General', ['sprint', 'tincture']],
      ];
      this.referenceDps = V.ref;
      this.referenceGcd = 1.94;
    }

    initGauge(e) { return Object.assign(super.initGauge(e), { opoFury: 0, raptorFury: 0, coeurlFury: 0 }); }

    blitzFor(g) {
      const b = super.blitzFor(g);
      return b === 'elixirField' ? 'elixirBurst' : b;
    }

    check(id, e) {
      const g = e.g;
      if (id === 'firesReply' && !e.has('firesRumination')) return 'Unable to execute action. Fire\'s Rumination required.';
      if (id === 'windsReply' && !e.has('windsRumination')) return 'Unable to execute action. Wind\'s Rumination required.';
      if (id === 'meditation' && this.V.medLock && e.inCombat && g.chakra >= 5) return 'Unable to execute action. Five chakra are already open.';
      return super.check(id, e);
    }

    // Brotherhood lets ten chakra be open.
    addChakra(e, n) { e.g.chakra = Math.min(e.has('brotherhood') ? 10 : 5, e.g.chakra + n); }

    resolve(id, e) {
      const a = this.actions[id], g = e.g, V = this.V;
      let potency = a.potency || 0;
      const opts = {};
      if (a.form) {
        const bonus = e.has(FORM[a.form]) || e.has('formlessFist') || e.has('perfectBalance');
        const pb = e.has('perfectBalance');
        if (e.has('formlessFist') && !pb) e.removeStatus('formlessFist', true);
        if (pb) {
          g.beast.push(a.form);
          const s = e.statuses.perfectBalance;
          s.stacks = (s.stacks || 1) - 1;
          if (s.stacks <= 0) e.removeStatus('perfectBalance'); else e.emit('statusStack', { key: 'perfectBalance' });
        } else this.setForm(e, NEXT[a.form]);
        if ((id === 'leapingOpo' || id === 'shadowOfTheDestroyer') && bonus) opts.crit = true;
        // The Fury counters.
        if (id === 'leapingOpo' && g.opoFury) { potency += V.fury.opo[1]; g.opoFury = 0; }
        if (id === 'dragonKick' && (bonus || V.dkAnyForm)) g.opoFury = 1;
        if (id === 'risingRaptor' && g.raptorFury) { potency += V.fury.raptor[1]; g.raptorFury--; }
        if (id === 'twinSnakes') g.raptorFury = V.fury.raptor[0];
        if (id === 'pouncingCoeurl' && g.coeurlFury) { potency += V.fury.coeurl[1]; g.coeurlFury--; }
        if (id === 'demolish') g.coeurlFury = V.fury.coeurl[0];
        if (a.positional) { const pos = e.positionalHit(a); if (pos) potency += a.posBonus; opts.positional = pos ? 'hit' : 'miss'; }
      }
      if (a.blitz) {
        if (id === 'elixirBurst') g.lunar = true;
        else if (id === 'risingPhoenix') g.solar = true;
        else if (id === 'celestialRevolution') { if (g.lunar) g.solar = true; else g.lunar = true; }
        else if (id === 'phantomRush') { g.lunar = false; g.solar = false; }
        g.beast = [];
        e.addStatus('formlessFist', 30);
      }
      if (id === 'firesReply') { e.removeStatus('firesRumination'); e.addStatus('formlessFist', 30); }
      if (id === 'windsReply') e.removeStatus('windsRumination');
      if (id === 'sixSidedStar') { potency += 80 * g.chakra; g.chakra = 0; }
      if (a.kind === 'gcd' && potency) {
        const bh = e.has('brotherhood');
        opts.onResult = (r) => { if (r.crit || bh) this.addChakra(e, 1); };
      }
      if (a.chakra) g.chakra -= a.chakra;
      switch (id) {
        case 'formShift': e.addStatus('formlessFist', 30); break;
        case 'meditation': this.addChakra(e, e.inCombat ? 1 : 5); break;
        case 'perfectBalance': e.addStatus('perfectBalance', 20, { stacks: 3 }); break;
        case 'riddleOfFire': e.addStatus('riddleOfFire', 20); e.addStatus('firesRumination', 20); break;
        case 'brotherhood': e.addStatus('brotherhood', 20); break;
        case 'riddleOfWind': e.addStatus('riddleOfWind', 15); e.addStatus('windsRumination', 15); break;
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
      if (potency) e.queueHit(id, potency, this.snapshot(a, e), a.delay, null, opts);
    }

    proc(id, e) {
      const g = e.g;
      if (id === 'leapingOpo') return e.has('opoOpo') || e.has('formlessFist') || !!g.opoFury;
      if (id === 'risingRaptor') return !!g.raptorFury && this.inForm('raptor', e);
      if (id === 'pouncingCoeurl') return !!g.coeurlFury && this.inForm('coeurl', e);
      if (id === 'firesReply') return e.has('firesRumination');
      if (id === 'windsReply') return e.has('windsRumination');
      return super.proc(id, e);
    }

    speedInfo(e) { return `GCD ${e.gcdForSpeed(e.stats.speed, 20).toFixed(2)} with Greased Lightning`; }

    // The Master's Gauge, plus the three Fury counters and a count above five chakra.
    gaugeBuild(root) {
      super.gaugeBuild(root);
      const svg = root.querySelector('svg');
      svg.insertAdjacentHTML('beforeend', '<text id="mk-fury" x="336" y="36" text-anchor="end" font-family="Noto Sans, sans-serif" font-size="11" font-weight="600" fill="#a9a3b4" letter-spacing="1"></text>');
      this.mg.fury = root.querySelector('#mk-fury');
    }
    gaugeUpdate(e) {
      super.gaugeUpdate(e);
      const G = this.mg, c = G.cache, g = e.g;
      const t = `${g.chakra > 5 ? `+${g.chakra - 5}  ` : ''}FURY ${g.opoFury || 0}·${g.raptorFury || 0}·${g.coeurlFury || 0}`;
      if (c.fury !== t) { c.fury = t; G.fury.textContent = t; }
    }

    helpHtml(seq) {
      const V = this.V;
      return `
<h3>How it plays (${V.label})</h3>
<p>Level 100 Monk with Greased Lightning always on (a 1.94 GCD at this gear). Each form now alternates two weaponskills through the <b>Fury</b> counters: in opo-opo, <b>Dragon Kick</b> (320) stores an Opo-opo's Fury and <b>Leaping Opo</b> (${260 + V.fury.opo[1]} with it, always a crit in opo-opo form) spends it; in raptor, <b>Twin Snakes</b> (${V.twin}) stores ${V.fury.raptor[0] > 1 ? V.fury.raptor[0] + ' Raptor\'s Fury' : 'a Raptor\'s Fury'} for <b>Rising Raptor</b> (${V.raptorP + V.fury.raptor[1]}); in coeurl, <b>Demolish</b> (${V.demo + 60} from the rear) stores ${V.fury.coeurl[0]} Coeurl's Fury, each one a <b>Pouncing Coeurl</b> (${V.pounce + 60 + V.fury.coeurl[1]} from the flank). No buff or DoT to keep up any more. Every critical weaponskill opens a chakra: at five, <b>The Forbidden Chakra</b> (400).</p>
<p><b>Perfect Balance</b> (two charges) fills the Beast Chakra for a Blitz: <b>Elixir Burst</b> (${V.elixir}, Lunar), <b>Rising Phoenix</b> (${V.phoenix}, Solar) and, with both Nadi, <b>Phantom Rush</b> (${V.phantom.toLocaleString()}); every Blitz grants Formless Fist. <b>Riddle of Fire</b> (+15%, 60s) readies <b>Fire's Reply</b> (${V.fire.toLocaleString()}, also Formless Fist) and <b>Riddle of Wind</b> (90s) <b>Wind's Reply</b> (${V.wind.toLocaleString()}). <b>Brotherhood</b> (+5%, 20s, 120s) opens a chakra with every weaponskill and holds up to ten: two Forbidden Chakras a window.</p>
<h3>The opener (The Balance, Solar–Lunar with Dragon Kick)</h3>
${seq(['dragonKick', ['perfectBalance'], ['tincture'], 'twinSnakes', 'leapingOpo', 'demolish', ['brotherhood'], ['riddleOfFire'], 'risingPhoenix', ['forbiddenChakra'], ['riddleOfWind'], 'dragonKick', 'windsReply', 'firesReply', 'leapingOpo', ['perfectBalance'], 'dragonKick', 'leapingOpo', 'dragonKick', 'elixirBurst', 'leapingOpo', 'risingRaptor'])}
<p>Before the pull: Form Shift and Forbidden Meditation to five chakra.</p>
<p style="color:#a9a3b4">${V.label} numbers: Leaping Opo 260 (+${V.fury.opo[1]}), Dragon Kick 320, Rising Raptor ${V.raptorP} (+${V.fury.raptor[1]}), Twin Snakes ${V.twin}, Pouncing Coeurl ${V.pounce} (+60 flank, +${V.fury.coeurl[1]} a Fury), Demolish ${V.demo} (+60 rear), Elixir Burst ${V.elixir}, Celestial Revolution ${V.celestial}, Rising Phoenix ${V.phoenix}, Phantom Rush ${V.phantom.toLocaleString()}, Fire's Reply ${V.fire.toLocaleString()}, Wind's Reply ${V.wind.toLocaleString()}, The Forbidden Chakra 400, Enlightenment ${V.enlight}, Six-sided Star 780 + 80 a chakra; auto-attacks 90 at 2.56s. Gear: ${V.gear}.</p>`;
    }
  }

  B.registerJob({
    id: 'mnk', name: 'Monk', abbr: 'MNK', role: 'melee', classJob: 20,
    versions: ['dt701', 'dt70'].map(v => ({ id: v, label: VERSIONS[v].label, history: VERSIONS[v].history, note: VERSIONS[v].note, create: () => new MonkDT(v) })),
  });
})(window.BLM);
