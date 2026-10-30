// Monk, Shadowbringers at level 80, in four versions. Built on the Stormblood class (mnk_sb.js) for the forms, Greased
// Lightning, the Fists and the gauge, without TP. Dragon Kick in opo-opo form grants Leaden Fist (Bootshine's next hit
// is stronger); Six-sided Star (a 5s GCD), Four-point Fury, Enlightenment (the line version of The Forbidden Chakra),
// Anatman, two Shoulder Tackles; Elixir Field and Tornado Kick are oGCDs; Brotherhood (+5%) and Riddle of Fire on 90s.
//  - 5.0–5.01: Greased Lightning stacks (+10% damage and 5% speed each, three or four under Fists of Wind, kept by Snap
//    Punch and Demolish, dropped by Tornado Kick); Riddle of Fire +30% but 15% slower weaponskills; forms last 10s;
//    Perfect Balance 10s on 120s.
//  - 5.05–5.25: Riddle of Fire a clean +25%; forms 15s; Form Shift in coeurl form keeps Greased Lightning; Meditation
//    opens all five chakra out of combat.
//  - 5.3–5.35: Perfect Balance on 90s, so it lines up with Riddle of Fire and Brotherhood; Form Shift keeps Greased
//    Lightning in any form.
//  - 5.4–5.58: Greased Lightning is a permanent 20% haste; Perfect Balance six GCDs in 15s; Form Shift gives Formless
//    Fist; Tornado Kick 400 on 45s; the 5.4 potency pass.
// Numbers are the game data at each patch (xivapi's datamining), the Lodestone notes and xivanalysis; gear is pre-6.0
// (the 5.58 item data): Eden's Gate, Verse and Promise sets. ref: a scripted bot parses about 13,770 (5.0), 17,400
// (5.05 and 5.3: it gains nothing from 5.3's quicker Perfect Balance, so both share a ref) and 21,350 (5.4).
(function (B) {
  const SB = B.MonkSB;
  const EPS = 1e-6;
  const NEXT = { opoOpo: 'raptor', raptor: 'coeurl', coeurl: 'opoOpo' };
  const GLK = ['gl1', 'gl2', 'gl3', 'gl4'];
  const ws = (o) => Object.assign({ kind: 'gcd', target: true, range: B.MELEE_RANGE, delay: 0.45, fx: 'gnbSlash' }, o);
  const ab = (o) => Object.assign({ kind: 'ogcd' }, o);
  const set = (A, id, o) => B.setAction(A, id, Object.assign({}, o, { tp: undefined }));
  const early = { boot: 150, leaden: 300, dk: 180, ts: 220, twin: 150, snap: 210, demo: 70, demoDot: 65, pos: 20, aotd: [80, 110], fpf: 120, rb: 120,
    sss: 400, fc: 370, tk: 430, tkRecast: 10, ef: 200, rof: 1.30, rofSlow: 15, bhChakra: 0.3, pb: [10, 120, 0], deepMed: 0.7, gl: true, med: 1.2,
    roe: 60, formDur: 10, shiftGl: null, allChakra: false };
  const VERSIONS = {
    shb54: Object.assign({}, early, { label: 'Shadowbringers 5.4–5.58', history: 'ShB 5.4–5.58', boot: 200, leaden: 370, dk: 230, ts: 270, twin: 230, snap: 270,
      demo: 80, demoDot: 80, pos: 30, aotd: [110, 140], fpf: 140, rb: 150, sss: 540, fc: 340, tk: 400, tkRecast: 45, ef: 250, rof: 1.25, rofSlow: 0,
      bhChakra: 0.2, pb: [15, 90, 6], deepMed: 1.0, gl: false, med: 1.0, roe: 30, formDur: 15, formless: true, allChakra: true, tincture: 'str4', ref: 22630,
      gcd: 1.96, stats: { hp: 140891, main: 5542, wd: 134, det: 2194, crit: 4202, dh: 2414, speed: 802 },
      gear: 'The Balance\'s 5.4 set (Eden\'s Promise Savage with the Edenmorn knuckles: Strength 5,542, 134 weapon damage)',
      note: 'Level 80: Greased Lightning a permanent 20% haste, Perfect Balance six GCDs in 15s, Form Shift into Formless Fist, the 5.4 potency pass; Eden\'s Promise gear' }),
    shb53: Object.assign({}, early, { label: 'Shadowbringers 5.3–5.35', history: 'ShB 5.3–5.35', rof: 1.25, rofSlow: 0, pb: [10, 90, 0], formDur: 15,
      shiftGl: 'any', allChakra: true, tincture: 'str3', ref: 18430, gcd: 1.94,
      stats: { hp: 117222, main: 4805, wd: 128, det: 2041, crit: 3996, dh: 2116, speed: 1025 },
      gear: 'an Eden\'s Verse Savage set (Strength 4,805, 128 weapon damage)',
      note: 'Level 80: Greased Lightning IV under Fists of Wind, Perfect Balance on 90s with Riddle of Fire and Brotherhood; Eden\'s Verse gear' }),
    shb505: Object.assign({}, early, { label: 'Shadowbringers 5.05–5.25', history: 'ShB 5.05–5.25', rof: 1.25, rofSlow: 0, formDur: 15, shiftGl: 'coeurl',
      allChakra: true, tincture: 'str3', ref: 18430, gcd: 1.94,
      stats: { hp: 117222, main: 4805, wd: 128, det: 2041, crit: 3996, dh: 2116, speed: 1025 },
      gear: 'an Eden\'s Verse Savage set (Strength 4,805, 128 weapon damage)',
      note: 'Level 80: Riddle of Fire a clean +25%, 15s forms, Form Shift in coeurl form keeping Greased Lightning; Eden\'s Verse gear' }),
    shb50: Object.assign({}, early, { label: 'Shadowbringers 5.0–5.01', history: 'ShB 5.0–5.01', tincture: 'str2', ref: 14600, gcd: 1.94,
      stats: { hp: 97774, main: 4176, wd: 122, det: 1648, crit: 3387, dh: 2735, speed: 1017 },
      gear: 'an Eden\'s Gate set (Strength 4,176, 122 weapon damage) with the Grade 2 Tincture',
      note: 'The launch: Greased Lightning stacks, Riddle of Fire +30% with 15% slower weaponskills, 10s forms, Perfect Balance on 120s' }),
  };

  class MonkShB extends SB {
    constructor(version) {
      super();
      const V = VERSIONS[version];
      this.V = V;
      this.level = 80;
      this.levelKey = 'shb80';
      this.model = 'mnk-sb';
      this.tp = null;
      this.tinctureKey = V.tincture;
      this.tackles = false;
      this.fofMult = 1.10;
      this.glDur = 16;
      const A = {};
      for (const [k, a] of Object.entries(this.actions)) A[k] = Object.assign({}, a, { tp: undefined });
      for (const k of ['oneIlmPunch', 'steelPeak', 'howlingFist', 'internalRelease', 'purification', 'riddleOfWind', 'fireTackle', 'windTackle',
        'earthTackle', 'invigorate']) delete A[k];
      const p = V.pos;
      const lf = V.formDur;
      set(A, 'bootshine', { potency: V.boot, desc: `Delivers an attack with a potency of ${V.boot}.\nLeaden Fist Potency: ${V.leaden}\nOpo-opo Form Bonus: Critical damage if executed from a target's rear\nAdditional Effect: Changes form to raptor\nDuration: ${lf}s` });
      set(A, 'dragonKick', { potency: V.dk, posBonus: p, desc: `Delivers an attack with a potency of ${V.dk}.\n${V.dk + p} when executed from a target's flank.\nOpo-opo Form Bonus: Grants Leaden Fist\nDuration: 30s\nAdditional Effect: Changes form to raptor\nDuration: ${lf}s` });
      set(A, 'trueStrike', { potency: V.ts, posBonus: p, desc: `Delivers an attack with a potency of ${V.ts}.\n${V.ts + p} when executed from a target's rear.\nCan only be executed when in raptor form.\nAdditional Effect: Changes form to coeurl\nDuration: ${lf}s` });
      set(A, 'twinSnakes', { potency: V.twin, posBonus: p, desc: `Delivers an attack with a potency of ${V.twin}.\n${V.twin + p} when executed from a target's flank.\nAdditional Effect: Increases damage dealt by 10%\nDuration: 15s\nCan only be executed when in raptor form.\nAdditional Effect: Changes form to coeurl\nDuration: ${lf}s` });
      set(A, 'snapPunch', { potency: V.snap, posBonus: p, gl: V.gl, desc: `Delivers an attack with a potency of ${V.snap}.\n${V.snap + p} when executed from a target's flank.${V.gl ? '\nAdditional Effect: Greased Lightning\nDuration: 16s' : ''}\nCan only be executed when in coeurl form.\nAdditional Effect: Changes form to opo-opo\nDuration: ${lf}s` });
      set(A, 'demolish', { potency: V.demo, posBonus: p, gl: V.gl, dot: { potency: V.demoDot, duration: 18 }, desc: `Delivers an attack with a potency of ${V.demo}.\n${V.demo + p} when executed from a target's rear.\nAdditional Effect: Damage over time\nPotency: ${V.demoDot}\nDuration: 18s${V.gl ? '\nAdditional Effect: Greased Lightning' : ''}\nCan only be executed when in coeurl form.\nAdditional Effect: Changes form to opo-opo\nDuration: ${lf}s` });
      set(A, 'armOfTheDestroyer', { potency: V.aotd[0], desc: `Delivers an attack with a potency of ${V.aotd[0]} to all nearby enemies (${V.aotd[1]} in opo-opo form).\nAdditional Effect: Changes form to raptor` });
      set(A, 'rockbreaker', { potency: V.rb, gl: V.gl, target: false, pbaoe: 5, desc: `Delivers an attack with a potency of ${V.rb} to all nearby enemies.${V.gl ? '\nAdditional Effect: Greased Lightning' : ''}\nCan only be executed when in coeurl form.\nAdditional Effect: Changes form to opo-opo` });
      A.fourPointFury = ws({ name: 'Four-point Fury', potency: V.fpf, form: 'raptor', needs: 'raptor', target: false, pbaoe: 5, aoe: true, desc: `Delivers an attack with a potency of ${V.fpf} to all nearby enemies.\nAdditional Effect: Extends Twin Snakes by 10s (up to 15s)\nCan only be executed when in raptor form.\nAdditional Effect: Changes form to coeurl` });
      A.sixSidedStar = ws({ name: 'Six-sided Star', potency: V.sss, recast: 5, fx: 'gnbDouble', desc: `Delivers an attack with a potency of ${V.sss}.${V.gl ? '\nAdditional Effect: Extends Greased Lightning to its full duration' : ''}\nRecast: 5s (the GCD it starts)` });
      set(A, 'formShift', { desc: V.formless ? 'Grants Formless Fist: the next weaponskill counts as any form.\nDuration: 15s' : `Changes to the next form (opo-opo with no form).${V.shiftGl ? `\nAdditional Effect: Extends Greased Lightning${V.shiftGl === 'coeurl' ? ' (in coeurl form)' : ''}` : ''}\nDuration: ${lf}s` });
      set(A, 'meditation', { recast: V.med, desc: `Opens a chakra (up to five)${V.allChakra ? '; all five out of combat' : ''}.\nShares a recast timer with all weaponskills.\nMeditation changes to The Forbidden Chakra with five open.` });
      set(A, 'forbiddenChakra', { recast: 1, cdGroup: 'chakra', potency: V.fc, desc: `Delivers an attack with a potency of ${V.fc}.\nCan only be executed with five chakra open.` });
      A.enlightenment = ab({ name: 'Enlightenment', recast: 1, cdGroup: 'chakra', potency: 220, target: true, range: 10, aoe: true, delay: 0.6, fx: 'senei', desc: 'Delivers an attack with a potency of 220 to all enemies in a straight line before you.\nCan only be executed with five chakra open.' });
      set(A, 'tornadoKick', { potency: V.tk, recast: V.tkRecast, desc: `Delivers an attack with a potency of ${V.tk}.${V.gl ? '\nCan only be executed at the maximum Greased Lightning; ends it.' : ''}` });
      set(A, 'elixirField', { potency: V.ef, desc: `Delivers an attack with a potency of ${V.ef} to all nearby enemies.` });
      set(A, 'shoulderTackle', { charges: 2, desc: 'Rushes target and delivers an attack with a potency of 100.\nMaximum Charges: 2' });
      set(A, 'perfectBalance', { recast: V.pb[1], desc: V.pb[2] ? `Grants ${V.pb[2]} stacks of Perfect Balance: weaponskills ignore their form requirements.\nDuration: ${V.pb[0]}s` : `Allows execution of weaponskills which require a certain form, without being in that form.\nDuration: ${V.pb[0]}s` });
      set(A, 'riddleOfFire', { desc: `Increases damage dealt by ${Math.round((V.rof - 1) * 100)}%${V.rofSlow ? ' while increasing weaponskill recast time by 15%' : ''}.\nDuration: 20s` });
      set(A, 'brotherhood', { desc: `Increases physical damage dealt by self and nearby party members by 5%.\nDuration: 15s\nAdditional Effect: ${V.bhChakra * 100}% chance a chakra opens each time you or a party member uses a weaponskill` });
      set(A, 'riddleOfEarth', { recast: V.roe, charges: V.gl ? undefined : 3, desc: V.gl ? 'Reduces damage taken and extends Greased Lightning to its full duration.\nDuration: 10s' : 'Grants three stacks of Riddle of Earth, reducing damage taken by 10%.\nMaximum Charges: 3' });
      set(A, 'fistsOfFire', { desc: 'Increases damage dealt by 10%.\nCannot be used with Fists of Earth or Fists of Wind.' });
      set(A, 'fistsOfWind', { desc: `Increases movement speed.${V.gl ? '\nAllows Greased Lightning IV.' : ''}\nCannot be used with Fists of Fire or Fists of Earth.` });
      A.anatman = ab({ name: 'Anatman', recast: 60, desc: V.gl ? 'Channels to restore Greased Lightning: here it fills the stacks to the maximum and its full duration.' : 'Extends Twin Snakes and your form to their full durations.' });
      set(A, 'trueNorth', { recast: 45, charges: 2, desc: 'Nullifies all action direction requirements.\nDuration: 10s\nMaximum Charges: 2' });
      A.tincture = B.tincture(V.tincture);
      this.actions = A;
      this.statuses = Object.assign({}, this.statuses, {
        gl4: { name: 'Greased Lightning IV', self: true, icon: 'st_gl' },
        leadenFist: { name: 'Leaden Fist', self: true, icon: 'st_leaden' },
        formlessFist: { name: 'Formless Fist', self: true, icon: 'st_formless' },
        anatman: { name: 'Anatman', self: true, icon: 'st_roe' },
      });
      this.selfStatusOrder = ['gl4', 'gl3', 'gl2', 'gl1', 'opoOpo', 'raptor', 'coeurl', 'formlessFist', 'perfectBalance', 'leadenFist', 'twinSnakes', 'riddleOfFire',
        'brotherhood', 'fistsOfFire', 'fistsOfWind', 'fistsOfEarth', 'riddleOfEarth', 'trueNorth', 'medicated', 'mantra', 'bloodbath', 'armsLength', 'sprint'];
      this.targetStatusOrder = ['demolish', 'feint'];
      this.stats = Object.assign({ mainStat: 'str', jobMod: 110, trait: 100, delay: 2.56 }, V.stats);
      this.tierHaste = V.gl ? 20 : 20;
      this.autoAttack = { potency: 110, delay: 2.56, range: B.MELEE_RANGE };
      this.defaultBars = [
        ['bootshine', 'trueStrike', 'snapPunch', 'dragonKick', 'twinSnakes', 'demolish', 'sixSidedStar', 'formShift', 'meditation', 'tornadoKick', 'elixirField', 'shoulderTackle'],
        ['perfectBalance', 'riddleOfFire', 'brotherhood', 'anatman', 'fistsOfFire', 'fistsOfWind', 'enlightenment', 'trueNorth', 'tincture', 'riddleOfEarth', 'mantra', 'fistsOfEarth'],
        ['armOfTheDestroyer', 'fourPointFury', 'rockbreaker', 'feint', 'bloodbath', 'secondWind', 'legSweep', 'armsLength', 'sprint', null, null, null],
      ];
      this.actionGroups = [
        ['Monk', ['bootshine', 'trueStrike', 'snapPunch', 'dragonKick', 'twinSnakes', 'demolish', 'armOfTheDestroyer', 'fourPointFury', 'rockbreaker',
          'sixSidedStar', 'formShift', 'meditation', 'forbiddenChakra', 'enlightenment', 'tornadoKick', 'elixirField', 'shoulderTackle', 'perfectBalance',
          'riddleOfFire', 'brotherhood', 'anatman', 'riddleOfEarth', 'fistsOfFire', 'fistsOfWind', 'fistsOfEarth', 'mantra']],
        ['Role Actions', ['trueNorth', 'feint', 'bloodbath', 'secondWind', 'legSweep', 'armsLength']],
        ['General', ['sprint', 'tincture']],
      ];
      this.referenceDps = V.ref;
      this.referenceGcd = V.gcd;
    }

    gl(e) { return this.V.gl && e.g.gl > 0 && e.has(GLK[e.g.gl - 1]) ? e.g.gl : 0; }
    glMax(e) { return e.has('fistsOfWind') ? 4 : 3; }
    addGl(e) {
      if (!this.V.gl) return;
      const g = e.g, n = Math.min(this.glMax(e), this.gl(e) + 1);
      for (const k of GLK) e.removeStatus(k, true);
      g.gl = n;
      e.addStatus(GLK[n - 1], this.glDur);
    }
    refreshGl(e) { if (this.gl(e)) e.statuses[GLK[e.g.gl - 1]].until = e.now + this.glDur; }
    dropGl(e) { for (const k of GLK) e.removeStatus(k, true); e.g.gl = 0; }

    resolveId(id, e) {
      if (id === 'meditation' && e.g.chakra >= 5 && e.inCombat) return 'forbiddenChakra';
      return id;
    }

    check(id, e) {
      const a = this.actions[id], g = e.g;
      if (a.needs && !e.has(a.needs) && !e.has('perfectBalance') && !e.has('formlessFist')) return 'Unable to execute action. Form required.';
      if (id === 'tornadoKick' && this.V.gl && this.gl(e) < this.glMax(e)) return 'Unable to execute action. Maximum Greased Lightning required.';
      if ((id === 'forbiddenChakra' || id === 'enlightenment') && g.chakra < 5) return 'Unable to execute action. Five chakra required.';
      if (id === 'meditation' && g.chakra >= 5) return 'Unable to execute action. Chakra already open.';
      return null;
    }

    // Greased Lightning: 5% a stack (5.4: a permanent 20%); 5.0's Riddle of Fire slows weaponskills 15%.
    haste(e) { return (this.V.gl ? 5 * this.gl(e) : 20) - (this.V.rofSlow && e.has('riddleOfFire') ? this.V.rofSlow : 0); }
    autoHaste(e) { return this.V.gl ? 5 * this.gl(e) : 20; }

    snapshot(a, e) {
      let mult = 1 + 0.10 * this.gl(e);
      if (e.has('twinSnakes')) mult *= 1.10;
      if (e.has('fistsOfFire')) mult *= this.fofMult;
      if (e.has('riddleOfFire')) mult *= this.V.rof;
      if (e.has('brotherhood')) mult *= 1.05;
      const main = this.stats.main + (e.has('medicated') ? B.TINCTURES[this.V.tincture].cap : 0);
      return { mult, main, critAdd: 0 };
    }

    setForm(e, f) {
      for (const k of ['opoOpo', 'raptor', 'coeurl']) if (k !== f) e.removeStatus(k, true);
      if (f) e.addStatus(f, this.V.formDur);
    }

    weaponskill(id, e) {
      const a = this.actions[id], g = e.g, V = this.V;
      if (id === 'meditation') {
        if (V.allChakra && !e.inCombat) { g.chakra = 5; e.emit('chakra', {}); } else this.openChakra(e);
        return;
      }
      const form = this.form(e);
      if (id === 'formShift') {
        if (V.formless) { e.addStatus('formlessFist', 15); return; }
        if (V.shiftGl === 'any' || (V.shiftGl === 'coeurl' && form === 'coeurl')) this.refreshGl(e);
        this.setForm(e, form ? NEXT[form] : 'opoOpo');
        return;
      }
      const pb = e.has('perfectBalance'), formless = e.has('formlessFist');
      const opo = form === 'opoOpo' || pb || formless;
      let potency = a.potency;
      const pos = !!a.positional && e.positionalHit(a);
      if (pos) potency += a.posBonus;
      if (id === 'bootshine' && e.has('leadenFist')) { potency = V.leaden; e.removeStatus('leadenFist'); }
      if (id === 'armOfTheDestroyer' && opo) potency = V.aotd[1];
      const crit = id === 'bootshine' && opo && (e.has('trueNorth') || e.side() === 'rear');
      if (id === 'dragonKick' && opo) e.addStatus('leadenFist', 30);
      if (id === 'twinSnakes') e.addStatus('twinSnakes', 15);
      if (id === 'fourPointFury' && e.has('twinSnakes')) e.statuses.twinSnakes.until = Math.min(e.now + 15, e.statuses.twinSnakes.until + 10);
      if (id === 'sixSidedStar') this.refreshGl(e);
      if (a.gl) this.addGl(e);
      if (formless) e.removeStatus('formlessFist');
      if (a.form) this.setForm(e, NEXT[a.form]);
      // 5.4: Perfect Balance is six weaponskills.
      if (pb && V.pb[2]) {
        const s = e.statuses.perfectBalance;
        s.stacks = (s.stacks || V.pb[2]) - 1;
        if (s.stacks <= 0) e.removeStatus('perfectBalance'); else e.emit('statusStack', { key: 'perfectBalance' });
      }
      const snap = this.snapshot(a, e);
      const after = a.dot ? () => e.addTStatus(id, a.dot.duration, { snap, dot: { potency: a.dot.potency, id } }) : null;
      // Chakra: Deep Meditation opens one on a critical weaponskill; Brotherhood on any weaponskill.
      const onResult = (r) => { if (r.crit && Math.random() < V.deepMed) this.openChakra(e); };
      e.queueHit(id, potency, snap, a.delay, after, { positional: a.positional ? (pos ? 'hit' : 'miss') : null, crit, onResult });
      if (e.has('brotherhood') && Math.random() < V.bhChakra) this.openChakra(e);
    }

    ability(id, e) {
      const a = this.actions[id], g = e.g, V = this.V;
      switch (id) {
        case 'tornadoKick': if (V.gl) this.dropGl(e); break;
        case 'forbiddenChakra': case 'enlightenment': g.chakra = 0; e.emit('chakra', {}); break;
        case 'shoulderTackle': this.gap(e); break;
        case 'perfectBalance': e.addStatus('perfectBalance', V.pb[0], V.pb[2] ? { stacks: V.pb[2] } : undefined); return;
        case 'riddleOfFire': e.addStatus('riddleOfFire', 20); return;
        case 'brotherhood': e.addStatus('brotherhood', 15); return;
        case 'riddleOfEarth': e.addStatus('riddleOfEarth', 10); this.refreshGl(e); return;
        case 'anatman':
          if (V.gl) { while (this.gl(e) < this.glMax(e)) this.addGl(e); this.refreshGl(e); }
          else {
            if (e.has('twinSnakes')) e.statuses.twinSnakes.until = e.now + 15;
            const f = this.form(e); if (f) this.setForm(e, f);
          }
          return;
        case 'fistsOfFire': case 'fistsOfWind': case 'fistsOfEarth': this.fists(e, id); return;
        case 'mantra': e.addStatus('mantra', 15); return;
        case 'trueNorth': e.addStatus('trueNorth', 10); return;
        default:
          if (B.ROLE_EFFECTS[id]) { B.ROLE_EFFECTS[id](e); return; }
      }
      if (a.potency) e.queueHit(id, a.potency, this.snapshot(a, e), a.delay);
    }

    // Fists of Fire / Wind / Earth swap; Greased Lightning IV falls back to III without Fists of Wind.
    fists(e, key) {
      for (const k of ['fistsOfFire', 'fistsOfWind', 'fistsOfEarth']) if (k !== key) e.removeStatus(k, true);
      e.addStatus(key, 1e9, { permanent: true });
      if (this.gl(e) === 4 && key !== 'fistsOfWind') {
        const until = e.statuses.gl4.until;
        this.dropGl(e); e.g.gl = 3; e.addStatus('gl3', until - e.now);
      }
    }

    nextEvent(e) { const k = GLK[e.g.gl - 1]; return k && e.statuses[k] ? e.statuses[k].until : Infinity; }
    process(e) { if (e.g.gl && !this.gl(e)) e.g.gl = 0; }

    proc(id, e) {
      const f = this.form(e), pb = e.has('perfectBalance') || e.has('formlessFist');
      const a = this.actions[id];
      if (a.needs) return pb || e.has(a.needs);
      if (id === 'bootshine') return e.has('leadenFist') || (f === 'opoOpo' && !pb);
      if (id === 'tornadoKick') return !this.V.gl || this.gl(e) >= this.glMax(e);
      if (id === 'forbiddenChakra' || id === 'enlightenment') return e.g.chakra >= 5;
      return false;
    }

    speedInfo(e) {
      return this.V.gl ? `GCD ${e.gcdForSpeed(e.stats.speed).toFixed(2)} base · ${e.gcdForSpeed(e.stats.speed, 15).toFixed(2)} at Greased Lightning III · ${e.gcdForSpeed(e.stats.speed, 20).toFixed(2)} at IV`
        : `GCD ${e.gcdForSpeed(e.stats.speed, 20).toFixed(2)} with Greased Lightning's 20%`;
    }

    gaugeUpdate(e) {
      super.gaugeUpdate(e);
      // The fourth stack (Fists of Wind) shows as a brighter third bolt.
      const G = this.mg;
      if (G && G.gl[2]) G.gl[2].setAttribute('fill', this.gl(e) >= 4 ? '#ffffff' : this.gl(e) >= 3 ? '#7fd4ff' : '#2a2535');
    }

    helpHtml(seq) {
      const V = this.V;
      const op = V.formless
        ? [['shoulderTackle'], 'dragonKick', ['tincture'], 'twinSnakes', ['riddleOfFire'], 'demolish', ['forbiddenChakra'], 'bootshine', ['perfectBalance'], 'dragonKick', ['brotherhood'], 'bootshine', ['elixirField'], 'dragonKick', ['tornadoKick'], 'bootshine', ['shoulderTackle'], 'dragonKick', 'bootshine', 'dragonKick', 'twinSnakes', 'demolish']
        : V.rofSlow
          ? [['shoulderTackle'], 'demolish', ['anatman'], 'dragonKick', ['tincture'], 'twinSnakes', ['riddleOfFire'], 'demolish', ['brotherhood'], ['forbiddenChakra'], 'bootshine', ['elixirField'], 'twinSnakes', ['fistsOfWind'], 'snapPunch', ['shoulderTackle'], 'dragonKick', ['perfectBalance'], 'bootshine', 'dragonKick', 'bootshine', 'dragonKick', 'demolish', 'bootshine']
          : [['shoulderTackle'], 'demolish', ['perfectBalance'], 'snapPunch', 'snapPunch', ['tincture'], 'twinSnakes', ['fistsOfWind'], ['riddleOfFire'], 'demolish', ['brotherhood'], ['forbiddenChakra'], 'dragonKick', ['elixirField'], 'dragonKick', ['shoulderTackle'], 'trueStrike', 'snapPunch', 'bootshine', 'twinSnakes', 'snapPunch'];
      return `
<h3>How it plays (${V.label})</h3>
<p>Level 80 Monk. Weaponskills cycle three forms for ${V.formDur}s each: <b>Opo-opo</b> (Bootshine, a critical hit from the rear, or <b>Dragon Kick</b>, which grants <b>Leaden Fist</b> so the next Bootshine is ${V.leaden}), <b>Raptor</b> (True Strike, or Twin Snakes for +10% for 15s), <b>Coeurl</b> (Snap Punch, or Demolish and its DoT). The loop settles into Dragon Kick / Bootshine alternating, True Strike / Twin Snakes alternating and two Snap Punches per Demolish. Positionals: Dragon Kick, Twin Snakes and Snap Punch from the flank, True Strike and Demolish from the rear (+${V.pos}).</p>
<p>${V.gl ? `Snap Punch and Demolish keep up <b>Greased Lightning</b>: +10% damage and 5% speed a stack for 16s, three stacks (four under <b>Fists of Wind</b>, which you switch to once you have three). Six-sided Star (${V.sss}, a 5s GCD) and Riddle of Earth extend it; <b>Tornado Kick</b> (${V.tk}) spends every stack, so it's for the end of a fight.` : `Greased Lightning is now a permanent 20% haste. <b>Form Shift</b> gives Formless Fist (any form next); <b>Perfect Balance</b> is six weaponskills in 15s; <b>Tornado Kick</b> (${V.tk}) is on a ${V.tkRecast}s recast.`} <b>Riddle of Fire</b> (+${Math.round((V.rof - 1) * 100)}%${V.rofSlow ? ', but weaponskills 15% slower' : ''}, 90s) and <b>Brotherhood</b> (+5%, 90s) go together with Perfect Balance (${V.pb[1]}s), Elixir Field (${V.ef}) and two Shoulder Tackles. Chakra open on critical weaponskills (${Math.round(V.deepMed * 100)}%) and under Brotherhood; five buy <b>The Forbidden Chakra</b> (${V.fc}). Stay in Fists of Fire (+10%) unless you're holding Greased Lightning IV.</p>
<h3>The opener (${V.formless ? 'The Balance' : 'Aya Liz\'s Shadowbringers write-up'})</h3>
${seq(op)}
<p>Meditation to five chakra before the pull${V.formless ? '' : ' and Fists of Fire on'}.</p>
<p style="color:#a9a3b4">${V.label} numbers: Bootshine ${V.boot} (Leaden Fist ${V.leaden}), Dragon Kick ${V.dk}, True Strike ${V.ts}, Twin Snakes ${V.twin}, Snap Punch ${V.snap}, Demolish ${V.demo} + ${V.demoDot} × 18s (positionals +${V.pos}), Six-sided Star ${V.sss}, The Forbidden Chakra ${V.fc}, Enlightenment 220, Tornado Kick ${V.tk}, Elixir Field ${V.ef}, Shoulder Tackle 100; auto-attacks 110 at 2.56s. Gear: ${V.gear}.</p>`;
    }
  }

  B.registerJob({
    id: 'mnk', name: 'Monk', abbr: 'MNK', role: 'melee', classJob: 20,
    versions: ['shb54', 'shb53', 'shb505', 'shb50'].map(v => ({ id: v, label: VERSIONS[v].label, history: VERSIONS[v].history, note: VERSIONS[v].note, create: () => new MonkShB(v) })),
  });
})(window.BLM);
