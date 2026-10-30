// Evercold (8.0, January 2027) "Evolved Mode" previews of the four jobs Square Enix showed at the North American Fan Fest
// in April 2026: Paladin, White Mage, Dragoon and Bard. Evolved Mode trims each job to about 16 buttons, drops every
// party damage buff ("synergy"), and adds a Continuation button that turns into whichever follow-up oGCD is ready.
// The kits are as the developers' battle-system panel showed them, read from TPLemontFFXIV's breakdown of that footage
// ("All 4 Evolved Jobs shown at NA 2026 Fanfest Explained and Scrutinized", April 2026): every action, gauge and timer
// on its skill sheets.
//
// What isn't public, and is a stand-in here:
//  - Potencies. None were shown. Each action's number is set from the Dawntrail action it replaces (Fast Blade, Royal
//    Authority, Glare III, Raiden Thrust ...), and the job's whole table is then scaled so a scripted bot parses about
//    3% above the same job's Dawntrail 7.4 bot (the developers said Evolved Mode would be "slightly stronger").
//  - Level 110's stat constants: the sim uses level 100's with each job's 7.4 savage set.
//  - Paladin's counters: in the demo only tank busters triggered them. Here the dummy swings at you every 3s, so a
//    Surcoat always meets a hit; on a real boss you'd have to time it.
//  - White Mage's Sanctity: a GCD heal only counts on someone below full HP. The dummy can't hurt your party, so here
//    every heal in combat is assumed to land on someone hurt.
//
// Timings measured from the footage (the video runs at game speed: Dragoon's Dragonsbane timer read 0.7/10 ten video
// seconds apart, one charge up): every job's normal GCD is 2.50s, with no skill or spell speed on the developers' level
// 110 characters (the same base as today); Bard's Army's Paeon sequence runs on a 1.5s GCD; Thrum of the Godsbow is a
// 2.4s cast on a longer GCD (about 3s). Scripted bots parse about 24,900 (Paladin), 24,000 (White Mage), 37,500
// (Dragoon) and 30,900 (Bard) over 5 minutes.
(function (B) {
  const EPS = 1e-6;
  const ab = (o) => Object.assign({ kind: 'ogcd' }, o);
  // Each job's stand-in table, set from the Dawntrail actions, then scaled so a scripted bot parses about 3% above the
  // job's Dawntrail 7.4 bot (Paladin ~24,500, White Mage ~24,200, Dragoon ~36,900, Bard ~29,300), rounded to 10.
  const scaled = (T, k, keep) => Object.fromEntries(Object.entries(T).map(([key, v]) => [key, (keep || []).includes(key) ? v
    : Array.isArray(v) ? v.map(x => Math.round(x * k / 10) * 10) : Math.round(v * k / 10) * 10]));

  // A charge gauge: one charge every `period` seconds up to `max` (Defence, Honor, Dragonsbane, Performance, Lily).
  // It starts full; while it isn't full its timer runs, as the gauges in the footage show ("4.9 / 10").
  const charger = (max, period) => ({ n: max, max, period, next: null });
  const spend = (e, c, k) => { if (c.n >= c.max) c.next = e.now + c.period; c.n -= k; };
  const tickCharger = (e, c) => {
    while (c.next !== null && e.now >= c.next - EPS) { c.n++; c.next = c.n < c.max ? c.next + c.period : null; }
  };

  // ---------------------------------------------------------------- the shared base
  class Evolved {
    constructor(o) {
      Object.assign(this, { level: 100, levelKey: 100, tierHaste: 0, startDistance: 3.2, maxMp: 10000 }, o);
      this.k = 1;           // the calibration scale (see the header)
    }

    initGauge(e) {
      const g = { ch: {} };
      for (const c of this.chargerSpec) g.ch[c.key] = charger(c.max, c.period);
      if (this.initExtra) this.initExtra(g, e);
      return g;
    }

    nextEvent(e) {
      let t = Infinity;
      for (const c of Object.values(e.g.ch)) if (c.next !== null) t = Math.min(t, c.next);
      if (this.nextExtra) t = Math.min(t, this.nextExtra(e));
      return t;
    }
    process(e) {
      for (const c of Object.values(e.g.ch)) tickCharger(e, c);
      if (this.processExtra) this.processExtra(e);
    }

    mult() { return 1; }
    snapshot(a, e) {
      const main = this.stats.main + (e.has('medicated') ? B.TINCTURES[this.tinctureKey].cap : 0);
      return { mult: this.mult(e, a), main };
    }

    // Hit for `p` (scaled by the calibration).
    hit(e, id, p, opts, after, delay) {
      const a = this.actions[id];
      e.queueHit(id, Math.round(p * this.k), this.snapshot(a, e), delay != null ? delay : a.delay, after || null, opts || null);
    }
    dot(e, id, potency, dur) {
      const a = this.actions[id];
      e.addTStatus(id, dur, { snap: this.snapshot(a, e), dot: { potency: Math.round(potency * this.k), id } });
    }

    castTime(id, e) {
      const a = this.actions[id];
      if (!a.cast || e.has('swiftcast')) return 0;
      return e.speedScale(a.cast, 0);
    }
    consumeInstant(id, e) { if (this.actions[id].cast && e.has('swiftcast')) e.removeStatus('swiftcast'); }
    mpRegen() { return B.BASE_REGEN; }

    gapClose(e) {
      const d = e.distToTarget() || 1;
      if (d > 2.6) {
        const from = { x: e.pos.x, z: e.pos.z };
        e.pos.x *= 2.4 / d; e.pos.z *= 2.4 / d;
        e.emit('teleport', { from, to: { x: e.pos.x, z: e.pos.z } });
      }
    }

    speedInfo(e) { return `GCD ${e.gcdForSpeed(e.stats.speed).toFixed(2)} · Evercold preview: stand-in potencies`; }

    // ---------- the gauge: one row per charge gauge, then the job's own lines ----------
    gaugeBuild(root) {
      const rows = this.chargerSpec, lines = this.gaugeLines || [];
      const h = 30 + rows.length * 34 + lines.length * 20 + 10;
      root.innerHTML = `
<svg width="360" height="${h}" viewBox="0 0 360 ${h}">
  <rect x="8" y="8" width="344" height="${h - 16}" rx="14" fill="rgba(14,12,20,.86)" stroke="rgba(255,255,255,.22)"/>
  <text x="340" y="24" text-anchor="end" font-family="Noto Sans, sans-serif" font-size="9" font-weight="600" fill="#8a8494" letter-spacing="1">EVOLVED · PREVIEW</text>
  ${rows.map((c, i) => `
  <text x="22" y="${42 + i * 34}" font-family="Noto Sans, sans-serif" font-size="11" font-weight="600" fill="#a9a3b4" letter-spacing="1">${c.label.toUpperCase()}</text>
  <rect x="22" y="${47 + i * 34}" width="170" height="10" rx="5" fill="#241f30" stroke="rgba(0,0,0,.8)"/>
  <rect id="ev-b${i}" x="22" y="${47 + i * 34}" width="0" height="10" rx="5" fill="${c.color}"/>
  <text id="ev-t${i}" x="200" y="${56 + i * 34}" font-family="Saira Semi Condensed, sans-serif" font-size="12" fill="#ddd"></text>
  ${[...Array(c.max).keys()].map(k => `<circle id="ev-p${i}-${k}" cx="${266 + k * 22}" cy="${52 + i * 34}" r="7" fill="#241f30" stroke="${c.color}" stroke-width="1.5"/>`).join('')}`).join('')}
  ${lines.map((l, i) => `<text id="ev-l${i}" x="22" y="${42 + rows.length * 34 + i * 20}" font-family="Noto Sans, sans-serif" font-size="12" font-weight="600" fill="#e8dcb8" letter-spacing=".5"></text>`).join('')}
</svg>`;
      const $ = (s) => root.querySelector(s);
      this.eg = { b: rows.map((c, i) => $('#ev-b' + i)), t: rows.map((c, i) => $('#ev-t' + i)), p: rows.map((c, i) => [...Array(c.max).keys()].map(k => $(`#ev-p${i}-${k}`))),
        l: lines.map((x, i) => $('#ev-l' + i)), cache: {} };
    }
    gaugeUpdate(e) {
      const G = this.eg, c = G.cache, g = e.g;
      const put = (k, v, fn) => { if (c[k] !== v) { c[k] = v; fn(v); } };
      this.chargerSpec.forEach((s, i) => {
        const ch = g.ch[s.key];
        const prog = ch.next !== null ? Math.max(0, s.period - (ch.next - e.now)) : 0;
        put('b' + i, Math.round(prog * 10), () => { G.b[i].setAttribute('width', (170 * prog / s.period).toFixed(1)); G.t[i].textContent = `${prog.toFixed(1)} / ${s.period}`; });
        for (let k = 0; k < s.max; k++) put(`p${i}-${k}`, ch.n > k, v => G.p[i][k].setAttribute('fill', v ? s.color : '#241f30'));
      });
      (this.gaugeLines || []).forEach((fn, i) => put('l' + i, fn(e), v => { G.l[i].textContent = v; }));
    }
  }

  // ================================================================ Paladin
  const PLD = scaled({
    fastBlade: 220, riotBlade: [140, 330], divineAuthority: [140, 480], expiacion: 450, imperator: 400, confiteor: 500,
    bladeOfFaith: 300, bladeOfTruth: 400, bladeOfValor: 500, bladeOfHonor: 800, holySpirit: 350, satisfaction: 700,
    answeringStrike: 250, shieldLob: 100, intercession: 150,
  }, 1.21);
  const SWING = 3.0;       // the dummy's auto-attack, for the counters (see the header)
  const BLADES = ['bladeOfFaith', 'bladeOfTruth', 'bladeOfValor'];

  class PaladinEvolved extends Evolved {
    constructor() {
      const ws = (o) => Object.assign({ kind: 'gcd', target: true, range: B.MELEE_RANGE, delay: 0.55, fx: 'gnbSlash' }, o);
      super({ name: 'Paladin', abbr: 'PLD', role: 'tank', model: 'pld-dt', tinctureKey: 'strdt4' });
      this.actions = {
        fastBlade: ws({ name: 'Fast Blade', potency: PLD.fastBlade, comboStart: true, comboNext: true, desc: `Delivers an attack with a potency of ${PLD.fastBlade}.` }),
        riotBlade: ws({ name: 'Riot Blade', potency: PLD.riotBlade[0], comboPotency: PLD.riotBlade[1], comboFrom: 'fastBlade', comboNext: true, fx: 'gnbSlash2',
          desc: `Delivers an attack with a potency of ${PLD.riotBlade[0]}.\nCombo Action: Fast Blade\nCombo Potency: ${PLD.riotBlade[1]}` }),
        divineAuthority: ws({ name: 'Divine Authority', iconOf: 'royalAuthority', potency: PLD.divineAuthority[0], comboPotency: PLD.divineAuthority[1], comboFrom: 'riotBlade', fx: 'gnbBurst',
          desc: `Delivers an attack with a potency of ${PLD.divineAuthority[0]}.\nCombo Action: Riot Blade\nCombo Potency: ${PLD.divineAuthority[1]}\nCombo Bonus: Grants Expiacion Ready (Continuation)\nDuration: 30s` }),
        divineJustice: ws({ name: 'Divine Justice', iconOf: 'holySpirit', potency: PLD.holySpirit, cast: 1.5, range: 25, delay: 0.7, school: 'holy', fx: 'gnbZone',
          desc: `On an enemy: Holy Spirit, unaspected damage with a potency of ${PLD.holySpirit}.\nOn an ally: Clemency (a heal).\n※Becomes Confiteor (instant) under Divine Might.` }),
        confiteor: ws({ name: 'Confiteor', potency: PLD.confiteor, range: 25, aoe: 0.5, delay: 0.7, ready: 'divineMight', school: 'holy', fx: 'gnbZone',
          desc: `Deals unaspected damage to the target and all enemies nearby it with a potency of ${PLD.confiteor}, 50% less for the rest.\nCan only be executed under Divine Might (from Imperator).` }),
        bladeOfFaith: ws({ name: 'Blade of Faith', potency: PLD.bladeOfFaith, range: 25, aoe: 0.5, delay: 0.7, school: 'holy', fx: 'gnbZone', blade: 0,
          desc: `Deals unaspected damage to the target and all enemies nearby it with a potency of ${PLD.bladeOfFaith}.\nCan only be executed after Imperator. Becomes Blade of Truth.` }),
        bladeOfTruth: ws({ name: 'Blade of Truth', potency: PLD.bladeOfTruth, range: 25, aoe: 0.5, delay: 0.7, school: 'holy', fx: 'gnbZone', blade: 1,
          desc: `Deals unaspected damage to the target and all enemies nearby it with a potency of ${PLD.bladeOfTruth}.\nCombo Action: Blade of Faith. Becomes Blade of Valor.` }),
        bladeOfValor: ws({ name: 'Blade of Valor', potency: PLD.bladeOfValor, range: 25, aoe: 0.5, delay: 0.7, school: 'holy', fx: 'gnbZone', blade: 2,
          desc: `Deals unaspected damage to the target and all enemies nearby it with a potency of ${PLD.bladeOfValor}.\nCombo Action: Blade of Truth\nAdditional Effect: Grants Blade of Honor Ready (Continuation)` }),
        counter: ws({ name: 'Counteraction', iconOf: 'holySheltron', potency: 0, desc: 'Becomes Satisfaction or Answering Strike once a Surcoat has been struck.' }),
        satisfaction: ws({ name: 'Satisfaction', iconOf: 'supplication', potency: PLD.satisfaction, fx: 'gnbBurst',
          desc: `A counter: delivers an attack with a potency of ${PLD.satisfaction}.\nAdditional Effect: Regen on yourself\nCan only be executed after being struck under Surcoat of Satisfaction.` }),
        answeringStrike: ws({ name: 'Answering Strike', iconOf: 'atonement', potency: PLD.answeringStrike,
          desc: `A counter: delivers an attack with a potency of ${PLD.answeringStrike}.\nAdditional Effect: Regen on yourself\nCan only be executed after being struck under Surcoat of Answer.` }),
        shieldLob: ws({ name: 'Shield Lob', potency: PLD.shieldLob, range: 20, delay: 0.7, desc: `Throws your shield for ${PLD.shieldLob} potency.\n※Shield Bash (a stun) in melee range.` }),
        shieldBash: ws({ name: 'Shield Bash', potency: PLD.shieldLob, desc: `Delivers an attack with a potency of ${PLD.shieldLob}.\nAdditional Effect: Stun` }),
        imperator: ab({ name: 'Imperator', recast: 1, potency: PLD.imperator, target: true, range: 25, aoe: 0.5, delay: 0.7, fx: 'gnbZone',
          desc: `Deals unaspected damage to the target and all enemies nearby it with a potency of ${PLD.imperator}.\nHonor Cost: 1\nAdditional Effect: Grants Divine Might (Divine Justice becomes Confiteor)\nAdditional Effect: Readies Blade of Faith → Truth → Valor\n※Becomes the next Blade.` }),
        continuation: ab({ name: 'Continuation', iconOf: 'expiacion', recast: 1, desc: 'Becomes Expiacion after Divine Authority, or Blade of Honor after Blade of Valor.' }),
        expiacion: ab({ name: 'Expiacion', recast: 1, potency: PLD.expiacion, target: true, range: 5, aoe: 0.5, delay: 0.6, ready: 'expiacionReady', fx: 'gnbBurst',
          desc: `Deals unaspected damage with a potency of ${PLD.expiacion} to the target and all enemies nearby it.\nCan only be executed under Expiacion Ready.` }),
        bladeOfHonor: ab({ name: 'Blade of Honor', recast: 1, potency: PLD.bladeOfHonor, target: true, range: 25, aoe: 0.5, delay: 0.8, ready: 'bladeOfHonorReady', fx: 'gnbZone',
          desc: `Deals unaspected damage with a potency of ${PLD.bladeOfHonor} to the target and all enemies nearby it.\nCan only be executed under Blade of Honor Ready.` }),
        surcoat: ab({ name: 'Surcoat', iconOf: 'holySheltron', recast: 1,
          desc: 'Defence Cost: 1\nOn yourself: Surcoat of Satisfaction for 4s, then Surcoat of Answer for 4s (damage taken reduced).\nStruck under Satisfaction: Counteraction becomes Satisfaction. Under Answer: Answering Strike.\nOn an ally: the same mitigation for them.' }),
        intercession: ab({ name: 'Intercession', iconOf: 'intervene', recast: 30, potency: PLD.intercession, target: true, range: 20, delay: 0.5, fx: 'gnbCont',
          desc: `On an enemy: rush to it and deal ${PLD.intercession} potency.\nOn an ally: dash to them and Cover them for 5s.` }),
        passageOfArms: ab({ name: 'Passage of Arms', recast: 120, desc: 'Blocks attacks in a cone behind you.\n※Becomes Round Table, an AoE heal.' }),
        divineVeil: ab({ name: 'Divine Veil', recast: 90, desc: 'Restores the party\'s HP and shields them.' }),
        hallowedGround: ab({ name: 'Hallowed Ground', recast: 420, desc: 'Renders you impervious to most attacks.\nDuration: 10s' }),
        guardian: ab({ name: 'Guardian', recast: 120, desc: 'Reduces damage taken by 40%.\nDuration: 15s' }),
        ...B.ROLE_ACTIONS.tank,
        interject: ab({ name: 'Interject', recast: 30, role: true, target: true, range: 3, desc: 'Interrupts the use of a target\'s action.\nAdditional Effect: Stun\nDuration: 5s' }),     // Low Blow folded in
        provoke: ab({ name: 'Provoke', recast: 30, role: true, target: true, range: 25, desc: 'On an enemy: Provoke, with more enmity for a short while.\nOn an ally: Shirk.' }),
        ...B.GENERAL_ACTIONS,
        tincture: B.tincture('strdt4'),
        auto: { name: 'Attack', kind: 'auto', fx: 'auto', desc: 'Auto-attack.' },
      };
      delete this.actions.lowBlow; delete this.actions.shirk;
      this.statuses = {
        divineMight: { name: 'Divine Might', self: true, icon: 'st_divineMight' },
        bladeReady: { name: 'Blade of Faith Ready', self: true, icon: 'st_bladeOfFaithReady' },
        expiacionReady: { name: 'Expiacion Ready', self: true, icon: 'st_requiescat' },
        bladeOfHonorReady: { name: 'Blade of Honor Ready', self: true, icon: 'st_bladeOfHonorReady' },
        surcoatSatisfaction: { name: 'Surcoat of Satisfaction', self: true, icon: 'st_holySheltron' },
        surcoatAnswer: { name: 'Surcoat of Answer', self: true, icon: 'st_sheltron' },
        counterReady: { name: 'Counteraction Ready', self: true, icon: 'st_supplicationReady' },
        guardian: { name: 'Guardian', self: true, icon: 'st_guardian' },
        hallowedGround: { name: 'Hallowed Ground', self: true, icon: 'st_hallowedGround' },
        divineVeil: { name: 'Divine Veil', self: true, icon: 'st_divineVeil' },
        passageOfArms: { name: 'Passage of Arms', self: true, icon: 'st_passageOfArms' },
        ...B.COMMON_STATUSES,
      };
      this.chargerSpec = [{ key: 'defence', label: 'Defence', max: 2, period: 20, color: '#5aa8ff' }, { key: 'honor', label: 'Honor', max: 2, period: 40, color: '#ff5a4a' }];
      this.gaugeLines = [
        (e) => (e.inCombat && e.g.swingNext ? `Dummy swings in ${Math.max(0, e.g.swingNext - e.now).toFixed(1)}s` : 'Dummy swings every 3s in combat'),
        (e) => (e.has('surcoatSatisfaction') ? 'SURCOAT OF SATISFACTION' : e.has('surcoatAnswer') ? 'Surcoat of Answer' : e.g.counter ? `Counter ready: ${e.g.counter === 'satisfaction' ? 'Satisfaction' : 'Answering Strike'}` : ''),
      ];
      this.stats = { hp: 285000, main: 6450, mainStat: 'str', jobMod: 100, trait: 100, wd: 158, det: 3066, crit: 3595, dh: 1230, speed: 420, ten: 622, delay: 2.24 };
      this.speedName = 'Skill speed';
      this.autoAttack = { potency: 90, delay: 2.24, range: B.MELEE_RANGE };
      this.selfStatusOrder = ['divineMight', 'bladeReady', 'expiacionReady', 'bladeOfHonorReady', 'surcoatSatisfaction', 'surcoatAnswer', 'counterReady', 'medicated',
        'guardian', 'rampart', 'hallowedGround', 'divineVeil', 'passageOfArms', 'armsLength', 'sprint'];
      this.targetStatusOrder = ['reprisal'];
      this.defaultBars = [
        ['fastBlade', 'riotBlade', 'divineAuthority', 'imperator', 'divineJustice', 'continuation', 'counter', 'surcoat', 'intercession', 'shieldLob', 'tincture', 'provoke'],
        ['passageOfArms', 'divineVeil', 'hallowedGround', 'guardian', 'rampart', 'reprisal', 'interject', 'armsLength', 'sprint', null, null, null],
        [null, null, null, null, null, null, null, null, null, null, null, null],
      ];
      this.actionGroups = [
        ['Paladin (Evolved)', ['fastBlade', 'riotBlade', 'divineAuthority', 'imperator', 'bladeOfFaith', 'bladeOfTruth', 'bladeOfValor', 'divineJustice', 'confiteor', 'continuation',
          'expiacion', 'bladeOfHonor', 'surcoat', 'counter', 'satisfaction', 'answeringStrike', 'intercession', 'shieldLob', 'shieldBash', 'passageOfArms', 'divineVeil', 'hallowedGround', 'guardian']],
        ['Role Actions', ['rampart', 'reprisal', 'interject', 'provoke', 'armsLength']],
        ['General', ['sprint', 'tincture']],
      ];
      this.referenceDps = 26400;
      this.referenceGcd = 2.5;
    }

    initExtra(g) { g.blade = null; g.counter = null; g.answerAt = null; g.swingNext = null; }

    resolveId(id, e) {
      const g = e.g;
      if (id === 'imperator' && g.blade && g.blade.until > e.now) return BLADES[g.blade.step];
      if (id === 'divineJustice' && e.has('divineMight')) return 'confiteor';
      if (id === 'continuation') return e.has('bladeOfHonorReady') ? 'bladeOfHonor' : e.has('expiacionReady') ? 'expiacion' : id;
      if (id === 'counter' && g.counter && e.has('counterReady')) return g.counter;
      if (id === 'shieldLob' && e.distToTarget() - B.DUMMY_RADIUS <= B.MELEE_RANGE) return 'shieldBash';
      return id;
    }

    check(id, e) {
      const a = this.actions[id], g = e.g;
      if (a.ready && !e.has(a.ready)) return 'Unable to execute action.';
      if (a.blade !== undefined && !(g.blade && g.blade.step === a.blade && g.blade.until > e.now)) return 'Unable to execute action.';
      if (id === 'imperator' && g.ch.honor.n < 1) return 'Unable to execute action. Honor required.';
      if (id === 'surcoat' && g.ch.defence.n < 1) return 'Unable to execute action. Defence required.';
      if ((id === 'satisfaction' || id === 'answeringStrike') && !(g.counter === id && e.has('counterReady'))) return 'Unable to execute action.';
      if (id === 'counter' || id === 'continuation') return 'Unable to execute action.';
      return null;
    }

    castTime(id, e) { return id === 'divineJustice' ? super.castTime(id, e) : 0; }

    resolve(id, e) {
      const a = this.actions[id], g = e.g;
      switch (id) {
        case 'fastBlade': case 'riotBlade': case 'divineAuthority': {
          const combo = !!a.comboFrom && e.lastComboHit;
          this.hit(e, id, combo ? a.comboPotency : a.potency);
          if (id === 'divineAuthority' && combo) e.addStatus('expiacionReady', 30);
          return;
        }
        case 'imperator':
          spend(e, g.ch.honor, 1);
          e.addStatus('divineMight', 30);
          g.blade = { step: 0, until: e.now + 30 }; e.addStatus('bladeReady', 30);
          this.hit(e, id, a.potency, { aoe: [1, 0.5] });
          return;
        case 'bladeOfFaith': case 'bladeOfTruth': case 'bladeOfValor':
          if (a.blade < 2) { g.blade = { step: a.blade + 1, until: e.now + 30 }; e.addStatus('bladeReady', 30); }
          else { g.blade = null; e.removeStatus('bladeReady'); e.addStatus('bladeOfHonorReady', 30); }
          this.hit(e, id, a.potency);
          return;
        case 'confiteor': e.removeStatus('divineMight'); this.hit(e, id, a.potency); return;
        case 'expiacion': case 'bladeOfHonor': e.removeStatus(a.ready); this.hit(e, id, a.potency); return;
        case 'satisfaction': case 'answeringStrike': g.counter = null; e.removeStatus('counterReady'); this.hit(e, id, a.potency); return;
        case 'surcoat':
          spend(e, g.ch.defence, 1);
          e.removeStatus('surcoatAnswer', true);
          e.addStatus('surcoatSatisfaction', 4); g.answerAt = e.now + 4;
          return;
        case 'intercession': this.gapClose(e); this.hit(e, id, a.potency); return;
        case 'guardian': e.addStatus('guardian', 15); return;
        case 'hallowedGround': e.addStatus('hallowedGround', 10); return;
        case 'divineVeil': e.addStatus('divineVeil', 30); return;
        case 'passageOfArms': e.addStatus('passageOfArms', 5); return;
      }
      if (B.ROLE_EFFECTS[id]) { B.ROLE_EFFECTS[id](e); return; }
      if (a.potency) this.hit(e, id, a.potency);
    }

    // The dummy's swings: a hit under a Surcoat readies the counter.
    nextExtra(e) {
      const g = e.g, c = e.statuses.counterReady;
      return Math.min(g.swingNext || Infinity, g.answerAt || Infinity, g.counter && c ? c.until : Infinity);
    }
    processExtra(e) {
      const g = e.g;
      if (g.counter && !e.has('counterReady')) g.counter = null;     // an unused counter runs out
      if (g.answerAt && e.now >= g.answerAt - EPS) { g.answerAt = null; if (!g.counter) e.addStatus('surcoatAnswer', 4); }
      if (!e.inCombat) { g.swingNext = null; return; }
      if (!g.swingNext) g.swingNext = e.now + SWING;
      while (e.now >= g.swingNext - EPS) {
        g.swingNext += SWING;
        const kind = e.has('surcoatSatisfaction') ? 'satisfaction' : e.has('surcoatAnswer') ? 'answeringStrike' : null;
        if (kind) {
          g.counter = kind; e.addStatus('counterReady', 15);
          e.removeStatus('surcoatSatisfaction', true); e.removeStatus('surcoatAnswer', true); g.answerAt = null;
        }
      }
    }

    proc(id, e) {
      const a = this.actions[id], g = e.g;
      if (a.comboFrom && e.inCombo(a.comboFrom)) return true;
      if (id === 'imperator') return g.ch.honor.n > 0 || !!(g.blade && g.blade.until > e.now);
      if (id === 'divineJustice' || id === 'confiteor') return e.has('divineMight');
      if (id === 'continuation') return e.has('expiacionReady') || e.has('bladeOfHonorReady');
      if (id === 'counter') return !!g.counter && e.has('counterReady');
      if (id === 'surcoat') return g.ch.defence.n > 0;
      return false;
    }

    helpHtml(seq) {
      return `
<h3>How it plays (Evercold Evolved, a preview)</h3>
<p>The Evolved Paladin the developers showed: a <b>main tank</b> that counters. <b>Fast Blade → Riot Blade → Divine Authority</b> is the loop, and Divine Authority readies <b>Expiacion</b> on the <b>Continuation</b> button. The <b>Honor</b> gauge fills a charge every 40s (two at most): <b>Imperator</b> spends one for an AoE hit, <b>Divine Might</b> (Divine Justice becomes an instant <b>Confiteor</b>) and the <b>Blade of Faith → Truth → Valor</b> chain, which ends in <b>Blade of Honor</b> on Continuation. The Atonement combo, Goring Blade, Requiescat and Fight or Flight are gone.</p>
<p><b>Surcoat</b> (the new Sheltron) spends a <b>Defence</b> charge (one every 20s, two at most): 4s of Surcoat of Satisfaction, then 4s of Surcoat of Answer. Take a hit in the first and <b>Counteraction</b> becomes <b>Satisfaction</b>, a strong counter with a regen on you; in the second, the weaker <b>Answering Strike</b>. Here the dummy swings every 3s, so time Surcoat and spend the counter. <b>Intercession</b> rushes an enemy, or covers an ally for 5s; Divine Justice is Holy Spirit on an enemy and Clemency on an ally; Shield Lob is Shield Bash in melee range; Passage of Arms has a follow-up AoE heal, Round Table.</p>
<h3>A loop</h3>
${seq(['fastBlade', ['surcoat'], 'riotBlade', ['imperator'], 'divineAuthority', ['continuation'], 'confiteor', ['intercession'], 'bladeOfFaith', 'bladeOfTruth', 'bladeOfValor', ['continuation'], 'counter', 'fastBlade', 'riotBlade', 'divineAuthority', ['continuation']])}
<p style="color:#a9a3b4">A preview of Evercold (January 2027): the actions, gauges and timers are the Fan Fest footage's; every potency is a stand-in (Fast Blade ${PLD.fastBlade}, Divine Authority ${PLD.divineAuthority[1]}, Expiacion ${PLD.expiacion}, Imperator ${PLD.imperator}, Confiteor ${PLD.confiteor}, Blades ${PLD.bladeOfFaith} / ${PLD.bladeOfTruth} / ${PLD.bladeOfValor}, Blade of Honor ${PLD.bladeOfHonor}, Satisfaction ${PLD.satisfaction}, Answering Strike ${PLD.answeringStrike}, scaled to sit just above Dawntrail 7.4). The footage's GCD is 2.50s, as today's at that speed. Gear: The Balance's 7.4 set, at level 100's numbers.</p>`;
    }
  }

  // ================================================================ White Mage
  const WHM = scaled({ glare3: 330, highGlare: 360, holy: 150, sanctuary: [300, 350] }, 1.42);

  class WhiteMageEvolved extends Evolved {
    constructor() {
      const spell = (o) => Object.assign({ kind: 'gcd', target: true, range: 25, delay: 0.8, school: 'holy', sound: 'ruin' }, o);
      const heal = (o) => Object.assign({ kind: 'gcd', potency: 0, heal: true, sound: 'paradox' }, o);
      super({ name: 'White Mage', abbr: 'WHM', role: 'healer', model: 'whm-dt', tinctureKey: 'mnddt4', startDistance: 12 });
      this.actions = {
        glare3: spell({ name: 'Glare III', potency: WHM.glare3, mp: 400, comboStart: true, comboNext: true, orb: true,
          desc: `Deals unaspected damage with a potency of ${WHM.glare3}.\nInstant (no cast in Evolved Mode).\n※Becomes High Glare.` }),
        highGlare: spell({ name: 'High Glare', iconOf: 'glare4', potency: WHM.highGlare, mp: 400, comboFrom: 'glare3', orb: true,
          desc: `Deals unaspected damage with a potency of ${WHM.highGlare}.\nCombo Action: Glare III` }),
        holy: spell({ name: 'Holy', iconOf: 'holy3', potency: WHM.holy, mp: 400, target: false, pbaoe: 8, aoe: true, delay: 0.6,
          desc: `Deals unaspected damage with a potency of ${WHM.holy} to all nearby enemies (instant).\nAdditional Effect: Stun` }),
        holySanctuary: spell({ name: 'Holy Sanctuary', iconOf: 'afflatusMisery', potency: WHM.sanctuary[0], cast: 1.5, mp: 0, cd: 30, charges: 2, aoe: true, delay: 1.0, fx: 'gnbZone',
          desc: `Deals unaspected damage to the target and enemies nearby it with a potency of ${WHM.sanctuary[0]}, plus ${WHM.sanctuary[1]} for each Sanctity charge it spends (all of them, up to 3).\nRecast: 30s\nMaximum Charges: 2` }),
        highCure: heal({ name: 'High Cure', iconOf: 'cure2', cast: 1.5, mp: 1000, desc: 'Restores the target\'s HP.\nAdditional Effect: +1 Sanctity in combat, if the target is below full HP.\n※Afflatus Solace under Plenary Indulgence.' }),
        medica: heal({ name: 'Medica', iconOf: 'medica3', cast: 1.5, mp: 1000, desc: 'Restores your party\'s HP.\nAdditional Effect: +1 Sanctity in combat, if someone is below full HP.\n※Afflatus Rapture under Plenary Indulgence.' }),
        afflatusSolace: heal({ name: 'Afflatus Solace', mp: 0, ready: 'plenaryIndulgence', desc: 'Restores the target\'s HP, instantly, with a regen.\nAdditional Effect: +1 Sanctity\nCan only be executed under Plenary Indulgence.' }),
        afflatusRapture: heal({ name: 'Afflatus Rapture', mp: 0, ready: 'plenaryIndulgence', desc: 'Restores the party\'s HP, instantly, with a regen.\nAdditional Effect: +1 Sanctity\nCan only be executed under Plenary Indulgence.' }),
        esuna: heal({ name: 'Esuna', cast: 1, mp: 400, desc: 'Removes a detrimental effect.' }),
        plenaryIndulgence: ab({ name: 'Plenary Indulgence', recast: 1, desc: 'Lily Cost: 1\nReduces damage your party takes for 10s.\nAdditional Effect: High Cure becomes Afflatus Solace and Medica becomes Afflatus Rapture for one heal.' }),
        tetragrammaton: ab({ name: 'Tetragrammaton', recast: 60, charges: 2, desc: 'Restores the target\'s HP.' }),
        benediction: ab({ name: 'Benediction', recast: 180, desc: 'Restores all of the target\'s HP.' }),
        aquaveil: ab({ name: 'Aquaveil', recast: 60, desc: 'Reduces damage taken by target party member.\nAdditional Effect: Grants the target a barrier' }),     // Divine Benison folded in
        temperance: ab({ name: 'Temperance', recast: 120, desc: 'Reduces your party\'s damage taken and quickens their steps.\n※Becomes Divine Caress, a shield that heals when it breaks.' }),
        liturgyOfTheBell: ab({ name: 'Liturgy of the Bell', recast: 180, desc: 'Places a bell that heals the party when you take damage.' }),
        aetherialShift: ab({ name: 'Aetherial Shift', recast: 60, desc: 'Dash 15 yalms forward.' }),
        ...B.ROLE_ACTIONS.caster,
        swiftcast: ab({ name: 'Swiftcast', recast: 40, role: true, desc: 'Next spell is cast immediately.\nDuration: 10s' }),
        rescue: ab({ name: 'Rescue', recast: 120, role: true, desc: 'Draws a party member to your side.' }),
        ...B.GENERAL_ACTIONS,
        tincture: B.tincture('mnddt4'),
      };
      delete this.actions.addle;
      this.statuses = {
        plenaryIndulgence: { name: 'Plenary Indulgence', self: true, icon: 'st_confession' },
        temperance: { name: 'Temperance', self: true, icon: 'st_temperance' },
        aquaveil: { name: 'Aquaveil', self: true, icon: 'st_aquaveil' },
        ...B.COMMON_STATUSES,
      };
      this.chargerSpec = [{ key: 'lily', label: 'Lily', max: 3, period: 20, color: '#8fd8ff' }];
      this.gaugeLines = [(e) => `SANCTITY ${'◆'.repeat(e.g.sanctity)}${'◇'.repeat(3 - e.g.sanctity)}  (no Blood Lily)`];
      this.stats = { hp: 115000, main: 6515, mainStat: 'mnd', jobMod: 115, trait: 130, wd: 158, det: 2807, crit: 3401, dh: 1014, speed: 1143, piety: 588, delay: 3.44 };
      this.speedName = 'Spell speed';
      this.selfStatusOrder = ['plenaryIndulgence', 'temperance', 'swiftcast', 'medicated', 'lucidDreaming', 'aquaveil', 'surecast', 'sprint'];
      this.targetStatusOrder = [];
      this.defaultBars = [
        ['glare3', 'holySanctuary', 'holy', 'highCure', 'medica', 'plenaryIndulgence', 'tetragrammaton', 'benediction', 'aquaveil', 'temperance', 'liturgyOfTheBell', 'tincture'],
        ['aetherialShift', 'esuna', 'swiftcast', 'lucidDreaming', 'surecast', 'rescue', 'sprint', null, null, null, null, null],
        [null, null, null, null, null, null, null, null, null, null, null, null],
      ];
      this.actionGroups = [
        ['White Mage (Evolved)', ['glare3', 'highGlare', 'holy', 'holySanctuary', 'highCure', 'medica', 'afflatusSolace', 'afflatusRapture', 'plenaryIndulgence', 'tetragrammaton',
          'benediction', 'aquaveil', 'temperance', 'liturgyOfTheBell', 'aetherialShift', 'esuna']],
        ['Role Actions', ['swiftcast', 'lucidDreaming', 'surecast', 'rescue']],
        ['General', ['sprint', 'tincture']],
      ];
      this.referenceDps = 25900;
      this.referenceGcd = 2.5;
    }

    initExtra(g) { g.sanctity = 0; }
    mpRegen() { return 200 + Math.floor(150 * (this.stats.piety - 440) / 2780); }
    lucidGain() { return B.LUCID_REGEN; }
    mpCost(id) { return this.actions[id].mp || 0; }

    resolveId(id, e) {
      if (id === 'glare3' && e.inCombo('glare3')) return 'highGlare';
      if (e.has('plenaryIndulgence')) { if (id === 'highCure') return 'afflatusSolace'; if (id === 'medica') return 'afflatusRapture'; }
      return id;
    }

    check(id, e) {
      const a = this.actions[id];
      if (a.ready && !e.has(a.ready)) return 'Unable to execute action.';
      if (id === 'plenaryIndulgence' && e.g.ch.lily.n < 1) return 'Unable to execute action. Lily required.';
      if (a.mp && e.mp < a.mp) return 'Not enough MP.';
      return null;
    }

    resolve(id, e) {
      const a = this.actions[id], g = e.g;
      if (a.kind === 'gcd') e.mp -= a.mp || 0;
      if (a.heal) {
        // Assumed to land on someone below full HP while in combat (see the header).
        if (e.inCombat && id !== 'esuna') g.sanctity = Math.min(3, g.sanctity + 1);
        if (a.ready) e.removeStatus(a.ready);
        return;
      }
      switch (id) {
        case 'holySanctuary': {
          const n = g.sanctity; g.sanctity = 0;
          this.hit(e, id, WHM.sanctuary[0] + WHM.sanctuary[1] * n);
          return;
        }
        case 'plenaryIndulgence': spend(e, g.ch.lily, 1); e.addStatus('plenaryIndulgence', 10); return;
        case 'temperance': e.addStatus('temperance', 20); return;
        case 'aquaveil': e.addStatus('aquaveil', 8); return;
        case 'tetragrammaton': case 'benediction': case 'liturgyOfTheBell': case 'aetherialShift': case 'rescue': return;
      }
      if (B.ROLE_EFFECTS[id]) { B.ROLE_EFFECTS[id](e); return; }
      if (a.potency) this.hit(e, id, a.potency);
    }

    proc(id, e) {
      if (id === 'glare3' || id === 'highGlare') return e.inCombo('glare3');
      if (id === 'holySanctuary') return e.g.sanctity >= 3;
      if (id === 'highCure' || id === 'medica' || id === 'afflatusSolace' || id === 'afflatusRapture') return e.has('plenaryIndulgence');
      if (id === 'plenaryIndulgence') return e.g.ch.lily.n >= 3;
      return false;
    }

    helpHtml(seq) {
      return `
<h3>How it plays (Evercold Evolved, a preview)</h3>
<p>The Evolved White Mage the developers showed. <b>Glare III</b> no longer has a cast, and becomes <b>High Glare</b> for a two-step chain; <b>Holy</b> is instant too. Dia, Assize, Presence of Mind, Asylum and Cure III are gone, and Divine Benison is folded into Aquaveil.</p>
<p>The Blood Lily is replaced by <b>Sanctity</b>: every GCD heal (High Cure, Medica, Afflatus Solace, Afflatus Rapture) on someone below full HP in combat adds a charge, up to three, and <b>Holy Sanctuary</b> (1.5s cast, two charges on 30s) spends them all for a bigger hit, about Afflatus Misery's at three. Lilies still come every 20s, but you spend one on <b>Plenary Indulgence</b>: 10s of party mitigation, and your next High Cure or Medica becomes an instant Afflatus heal. On the dummy a heal is a GCD without damage, but with Sanctity it pays back: that's the design, healing that isn't a DPS loss.</p>
<h3>A loop</h3>
${seq([['tincture'], 'glare3', 'highGlare', 'holySanctuary', ['plenaryIndulgence'], 'afflatusRapture', 'glare3', 'highGlare', ['plenaryIndulgence'], 'afflatusRapture', 'glare3', 'highGlare', ['plenaryIndulgence'], 'afflatusRapture', 'holySanctuary', 'glare3', 'highGlare'])}
<p style="color:#a9a3b4">A preview of Evercold (January 2027): the actions, gauges and timers are the Fan Fest footage's; every potency is a stand-in (Glare III ${WHM.glare3}, High Glare ${WHM.highGlare}, Holy ${WHM.holy}, Holy Sanctuary ${WHM.sanctuary[0]} + ${WHM.sanctuary[1]} a Sanctity, scaled to sit just above Dawntrail 7.4). Here every heal in combat counts for Sanctity, as if it landed on someone hurt. The footage's GCD is 2.50s. Gear: The Balance's 7.4 set, at level 100's numbers.</p>`;
    }
  }

  // ================================================================ Dragoon
  const DRG = scaled({ raiden: 300, fang: 340, wheel: 380, heavens: 460, sinister: [480, 120], dexter: [480, 120], chaos: [640, 160], geirskogul: 320, nastrond: 320,
    vengeful: 350, stardiver: 600, crimson: 450, lifesblood: 500, soaring: 550, starcross: 800, shatter: 1000, heavensFall: 600, talon: 150, wyrmwind: 500 }, 1.32);
  const STAR = ['stardiver', 'crimsonPulse', 'lifesblood', 'soaringSpirit', 'starcross'];

  class DragoonEvolved extends Evolved {
    constructor() {
      const ws = (o) => Object.assign({ kind: 'gcd', target: true, range: B.MELEE_RANGE, delay: 0.5, fx: 'gnbFang' }, o);
      super({ name: 'Dragoon', abbr: 'DRG', role: 'melee', model: 'drg-dt', tinctureKey: 'strdt4' });
      const drive = (name, iconOf, P, side, extra) => ws(Object.assign({ name, iconOf, potency: P[0], side, posBonus: P[1], drive: true, fx: 'gnbFang3',
        desc: `Dragonsbane Cost: 1\nDelivers an attack with a potency of ${P[0]}.\n${P[0] + P[1]} from the target's ${side === 'rear' ? 'rear' : side + ' flank'}.` }, extra));
      this.actions = {
        raidenThrust: ws({ name: 'Raiden Thrust', potency: DRG.raiden, comboStart: true, comboNext: true, desc: `Delivers an attack with a potency of ${DRG.raiden}.\n※A four-step combo button.` }),
        highFangAndClaw: ws({ name: 'High Fang and Claw', iconOf: 'fangAndClaw', potency: DRG.fang, comboFrom: 'raidenThrust', comboNext: true, desc: `Combo Action: Raiden Thrust\nDelivers an attack with a potency of ${DRG.fang}.` }),
        highWheelingThrust: ws({ name: 'High Wheeling Thrust', iconOf: 'wheelingThrust', potency: DRG.wheel, comboFrom: 'highFangAndClaw', comboNext: true, desc: `Combo Action: High Fang and Claw\nDelivers an attack with a potency of ${DRG.wheel}.` }),
        heavensThrust: ws({ name: 'Heavens\' Thrust', potency: DRG.heavens, comboFrom: 'highWheelingThrust', fx: 'gnbBurst', desc: `Combo Action: High Wheeling Thrust\nDelivers an attack with a potency of ${DRG.heavens}.` }),
        sinisterDrive: drive('Sinister Drive', 'chaoticSpring', DRG.sinister, 'left', { desc: `Dragonsbane Cost: 1\nDelivers an attack with a potency of ${DRG.sinister[0]}; ${DRG.sinister[0] + DRG.sinister[1]} from the target's left flank.\nAdditional Effect: Readies Geirskogul (Continuation)` }),
        dexterDrive: drive('Dexter Drive', 'drakesbane', DRG.dexter, 'right', { desc: `Dragonsbane Cost: 1\nDelivers an attack with a potency of ${DRG.dexter[0]}; ${DRG.dexter[0] + DRG.dexter[1]} from the target's right flank.\nAdditional Effect: Readies Nastrond (Continuation)` }),
        wingedChaos: drive('Winged Chaos', 'dragonfireDive', DRG.chaos, 'rear', { desc: `Dragonsbane Cost: 1\nDelivers an attack with a potency of ${DRG.chaos[0]}; ${DRG.chaos[0] + DRG.chaos[1]} from the target's rear.\nAdditional Effect: +1 Wyrmwind\nCan only be executed after both Sinister Drive and Dexter Drive.` }),
        continuation: ab({ name: 'Continuation', iconOf: 'geirskogul', recast: 1, desc: 'Becomes Geirskogul after Sinister Drive, or Nastrond after Dexter Drive.' }),
        geirskogul: ab({ name: 'Geirskogul', recast: 1, potency: DRG.geirskogul, target: true, range: 15, aoe: true, delay: 0.6, ready: 'geirskogulReady', fx: 'gnbBow',
          desc: `Deals damage with a potency of ${DRG.geirskogul} to all enemies in a line.\nCan only be executed after Sinister Drive.` }),
        nastrond: ab({ name: 'Nastrond', recast: 1, potency: DRG.nastrond, target: true, range: 15, aoe: true, delay: 0.6, ready: 'nastrondReady', fx: 'gnbBow',
          desc: `Deals damage with a potency of ${DRG.nastrond} to all enemies in a line.\nCan only be executed after Dexter Drive.` }),
        vengefulJump: ab({ name: 'Vengeful Jump', iconOf: 'highJump', recast: 20, charges: 2, potency: DRG.vengeful, target: true, range: 20, delay: 0.8, lock: 0.8, fx: 'slash3',
          desc: `Jumps at the target (a gap closer) for ${DRG.vengeful} potency.\nAdditional Effect: Vengeful Surge: your next weaponskill ignores positional requirements and is a critical hit\nAdditional Effect: +1 Blood of the Dragon\nMaximum Charges: 2` }),
        stardiver: ws({ name: 'Stardiver', potency: DRG.stardiver, range: 20, aoe: 0.5, star: 0, delay: 0.9, fx: 'gnbZone',
          desc: `Blood of the Dragon Cost: 3\nDelivers a jumping attack with a potency of ${DRG.stardiver}.\nAdditional Effect: Readies Sky High\n※Becomes Crimson Pulse → Lifesblood → Soaring Spirit → Starcross.` }),
        crimsonPulse: ws({ name: 'Crimson Pulse', iconOf: 'riseOfTheDragon', potency: DRG.crimson, star: 1, desc: `Delivers an attack with a potency of ${DRG.crimson}.\nCombo Action: Stardiver` }),
        lifesblood: ws({ name: 'Lifesblood', iconOf: 'nastrond', potency: DRG.lifesblood, star: 2, desc: `Delivers an attack with a potency of ${DRG.lifesblood}.\nCombo Action: Crimson Pulse` }),
        soaringSpirit: ws({ name: 'Soaring Spirit', iconOf: 'wyrmwindThrust', potency: DRG.soaring, star: 3, desc: `Delivers an attack with a potency of ${DRG.soaring}.\nCombo Action: Lifesblood` }),
        starcross: ws({ name: 'Starcross', potency: DRG.starcross, range: 20, aoe: 0.5, star: 4, fx: 'gnbZone', desc: `Delivers an attack with a potency of ${DRG.starcross}.\nCombo Action: Soaring Spirit` }),
        skyHigh: ws({ name: 'Sky High', iconOf: 'dragonfireDive', potency: 0, range: 20, lock: 3.4, ready: 'skyHighReady',
          desc: `Leaps high into the air for about 3s, taking 90% less damage, then crashes down: Sky Shatter, ${DRG.shatter} potency to the target and enemies nearby.\nAdditional Effect: Readies Heavens' Fall\nCan only be executed after Stardiver.` }),
        skyShatter: { name: 'Sky Shatter', kind: 'hit', potency: DRG.shatter, aoe: 0.5, school: 'physical', delay: 0, fx: 'gnbZone' },
        heavensFall: ws({ name: 'Heavens\' Fall', iconOf: 'starcross', potency: DRG.heavensFall, aoe: 0.5, ready: 'heavensFallReady', fx: 'gnbBurst',
          desc: `Delivers an attack with a potency of ${DRG.heavensFall} to the target and enemies nearby.\nCan only be executed after Sky Shatter.` }),
        piercingTalon: ws({ name: 'Piercing Talon', potency: DRG.talon, range: 20, delay: 0.7, desc: `Delivers a ranged attack with a potency of ${DRG.talon}.\n※Becomes Wyrmwind Thrust while you hold Wyrmwind.` }),
        wyrmwindThrust: ws({ name: 'Wyrmwind Thrust', potency: DRG.wyrmwind, range: 15, aoe: 0.5, delay: 0.7, fx: 'gnbBow',
          desc: `Wyrmwind Cost: 1\nDelivers a ranged attack in a line with a potency of ${DRG.wyrmwind}, 50% less for the rest.` }),
        elusiveJump: ab({ name: 'Elusive Jump', recast: 30, desc: 'Executes a jump to a location 15 yalms behind you.' }),
        ...B.ROLE_ACTIONS.melee,
        ...B.GENERAL_ACTIONS,
        tincture: B.tincture('strdt4'),
        auto: { name: 'Attack', kind: 'auto', fx: 'auto', desc: 'Auto-attack.' },
      };
      delete this.actions.trueNorth;
      this.statuses = {
        vengefulSurge: { name: 'Vengeful Surge', self: true, icon: 'st_lifeSurge' },
        geirskogulReady: { name: 'Geirskogul Ready', self: true, icon: 'st_lifeOfTheDragon' },
        nastrondReady: { name: 'Nastrond Ready', self: true, icon: 'st_nastrondReady' },
        skyHighReady: { name: 'Sky High Ready', self: true, icon: 'st_dragonsFlight' },
        skyHigh: { name: 'Sky High', self: true, icon: 'st_dragonsFlight' },
        heavensFallReady: { name: 'Heavens\' Fall Ready', self: true, icon: 'st_starcrossReady' },
        ...B.COMMON_STATUSES,
      };
      this.chargerSpec = [{ key: 'bane', label: 'Dragonsbane', max: 3, period: 10, color: '#e070ff' }];
      this.gaugeLines = [
        (e) => `Sinister ${e.g.sinister ? '●' : '○'}   Dexter ${e.g.dexter ? '●' : '○'}   Wyrmwind ${e.g.wyrmwind}`,
        (e) => `Blood of the Dragon ${'●'.repeat(e.g.blood)}${'○'.repeat(3 - e.g.blood)}   Sky High ${e.has('skyHighReady') || e.has('heavensFallReady') ? '●' : '○'}`,
      ];
      this.stats = { hp: 227580, main: 6513, mainStat: 'str', jobMod: 115, trait: 100, wd: 158, det: 2506, crit: 3605, dh: 1982, speed: 420, delay: 2.8 };
      this.speedName = 'Skill speed';
      this.autoAttack = { potency: 90, delay: 2.8, range: B.MELEE_RANGE };
      this.selfStatusOrder = ['vengefulSurge', 'geirskogulReady', 'nastrondReady', 'skyHighReady', 'skyHigh', 'heavensFallReady', 'medicated', 'bloodbath', 'feint', 'armsLength', 'sprint'];
      this.targetStatusOrder = ['feint'];
      this.defaultBars = [
        ['raidenThrust', 'sinisterDrive', 'dexterDrive', 'wingedChaos', 'continuation', 'vengefulJump', 'stardiver', 'skyHigh', 'piercingTalon', 'elusiveJump', 'tincture', 'feint'],
        ['secondWind', 'bloodbath', 'legSweep', 'armsLength', 'sprint', null, null, null, null, null, null, null],
        [null, null, null, null, null, null, null, null, null, null, null, null],
      ];
      this.actionGroups = [
        ['Dragoon (Evolved)', ['raidenThrust', 'highFangAndClaw', 'highWheelingThrust', 'heavensThrust', 'sinisterDrive', 'dexterDrive', 'wingedChaos', 'continuation', 'geirskogul', 'nastrond',
          'vengefulJump', 'stardiver', 'crimsonPulse', 'lifesblood', 'soaringSpirit', 'starcross', 'skyHigh', 'heavensFall', 'piercingTalon', 'wyrmwindThrust', 'elusiveJump']],
        ['Role Actions', ['feint', 'bloodbath', 'secondWind', 'legSweep', 'armsLength']],
        ['General', ['sprint', 'tincture']],
      ];
      this.referenceDps = 39800;
      this.referenceGcd = 2.5;
    }

    initExtra(g) { g.sinister = false; g.dexter = false; g.wyrmwind = 0; g.blood = 0; g.star = null; }

    // Left and right flanks: the dummy faces -Z, so its left is -X.
    flank(e) { const s = e.side(); return s === 'flank' ? (e.pos.x < 0 ? 'left' : 'right') : s; }

    resolveId(id, e) {
      const g = e.g;
      if (id === 'raidenThrust') {
        if (e.inCombo('highWheelingThrust')) return 'heavensThrust';
        if (e.inCombo('highFangAndClaw')) return 'highWheelingThrust';
        if (e.inCombo('raidenThrust')) return 'highFangAndClaw';
      }
      if (id === 'stardiver' && g.star && g.star.until > e.now) return STAR[g.star.step];
      if (id === 'skyHigh' && e.has('heavensFallReady')) return 'heavensFall';
      if (id === 'piercingTalon' && g.wyrmwind > 0) return 'wyrmwindThrust';
      if (id === 'continuation') return e.has('geirskogulReady') ? 'geirskogul' : e.has('nastrondReady') ? 'nastrond' : id;
      return id;
    }

    check(id, e) {
      const a = this.actions[id], g = e.g;
      if (a.ready && !e.has(a.ready)) return 'Unable to execute action.';
      if (a.drive) {
        if (g.ch.bane.n < 1) return 'Unable to execute action. Dragonsbane required.';
        if (id === 'sinisterDrive' && g.sinister) return 'Unable to execute action. Use Dexter Drive and Winged Chaos first.';
        if (id === 'dexterDrive' && g.dexter) return 'Unable to execute action. Use Sinister Drive and Winged Chaos first.';
        if (id === 'wingedChaos' && !(g.sinister && g.dexter)) return 'Unable to execute action. Sinister Drive and Dexter Drive first.';
      }
      if (a.star !== undefined) {
        if (a.star === 0 && g.blood < 3) return 'Unable to execute action. Three Blood of the Dragon required.';
        if (a.star > 0 && !(g.star && g.star.step === a.star && g.star.until > e.now)) return 'Unable to execute action.';
      }
      if (id === 'wyrmwindThrust' && g.wyrmwind < 1) return 'Unable to execute action. Wyrmwind required.';
      if (id === 'continuation') return 'Unable to execute action.';
      return null;
    }

    resolve(id, e) {
      const a = this.actions[id], g = e.g;
      if (a.kind === 'gcd') {
        let p = a.comboFrom && e.lastComboHit ? a.potency : a.comboFrom ? Math.round(a.potency * 0.4) : a.potency;
        const opts = {};
        // Vengeful Surge: the next weaponskill ignores positionals and is a critical hit.
        const surge = e.has('vengefulSurge') && id !== 'skyHigh';
        if (surge) { e.removeStatus('vengefulSurge'); opts.crit = true; }
        if (a.drive) {
          spend(e, g.ch.bane, 1);
          const pos = surge || this.flank(e) === a.side;
          if (pos) p += a.posBonus;
          opts.positional = pos ? 'hit' : 'miss';
          if (id === 'sinisterDrive') { g.sinister = true; e.addStatus('geirskogulReady', 30); }
          if (id === 'dexterDrive') { g.dexter = true; e.addStatus('nastrondReady', 30); }
          if (id === 'wingedChaos') { g.sinister = false; g.dexter = false; g.wyrmwind = Math.min(3, g.wyrmwind + 1); }
        }
        if (a.star !== undefined) {
          if (a.star === 0) { g.blood = 0; e.addStatus('skyHighReady', 30); this.gapClose(e); }
          g.star = a.star < 4 ? { step: a.star + 1, until: e.now + 30 } : null;
        }
        if (id === 'skyHigh') {
          e.removeStatus('skyHighReady'); e.addStatus('skyHigh', 3.3);
          this.hit(e, 'skyShatter', DRG.shatter, null, () => e.addStatus('heavensFallReady', 30), 3.3);
          return;
        }
        if (id === 'heavensFall') e.removeStatus('heavensFallReady');
        if (id === 'wyrmwindThrust') g.wyrmwind--;
        if (p) this.hit(e, id, p, opts);
        return;
      }
      switch (id) {
        case 'geirskogul': case 'nastrond': e.removeStatus(a.ready); this.hit(e, id, a.potency); return;
        case 'vengefulJump':
          this.gapClose(e);
          g.blood = Math.min(3, g.blood + 1);
          e.addStatus('vengefulSurge', 15);
          this.hit(e, id, a.potency);
          return;
        case 'elusiveJump': {
          const d = e.distToTarget() || 1, from = { x: e.pos.x, z: e.pos.z };
          e.pos.x += e.pos.x / d * 15; e.pos.z += e.pos.z / d * 15;
          e.emit('teleport', { from, to: { x: e.pos.x, z: e.pos.z } });
          return;
        }
      }
      if (B.ROLE_EFFECTS[id]) B.ROLE_EFFECTS[id](e);
    }

    proc(id, e) {
      const a = this.actions[id], g = e.g;
      if (id === 'raidenThrust') return e.inCombo('raidenThrust') || e.inCombo('highFangAndClaw') || e.inCombo('highWheelingThrust');
      if (a.drive) return !this.check(id, e);
      if (id === 'continuation') return e.has('geirskogulReady') || e.has('nastrondReady');
      if (id === 'stardiver') return g.blood >= 3 || !!(g.star && g.star.until > e.now);
      if (id === 'skyHigh') return e.has('skyHighReady') || e.has('heavensFallReady');
      if (id === 'piercingTalon') return g.wyrmwind > 0;
      return false;
    }

    helpHtml(seq) {
      return `
<h3>How it plays (Evercold Evolved, a preview)</h3>
<p>The Evolved Dragoon the developers showed. <b>Raiden Thrust → High Fang and Claw → High Wheeling Thrust → Heavens' Thrust</b> is one button, four steps. The <b>Dragonsbane</b> gauge fills a charge every 10s (three at most) for the drives, and positionals are now left and right: <b>Sinister Drive</b> from the <b>left</b> flank readies <b>Geirskogul</b>, <b>Dexter Drive</b> from the <b>right</b> readies <b>Nastrond</b> (both on the <b>Continuation</b> button), and with both used, <b>Winged Chaos</b> from the <b>rear</b> hits hardest and stores a <b>Wyrmwind</b> charge for <b>Wyrmwind Thrust</b>, a ranged attack on the Piercing Talon button (for when you have to leave the boss).</p>
<p><b>Vengeful Jump</b> (two charges) is a gap closer that adds a <b>Blood of the Dragon</b>, and its <b>Vengeful Surge</b> makes your next weaponskill ignore positionals and crit (Life Surge folded in). At three Blood: <b>Stardiver → Crimson Pulse → Lifesblood → Soaring Spirit → Starcross</b>, and Stardiver readies <b>Sky High</b>: about 3s in the air with 90% less damage taken, then <b>Sky Shatter</b> on landing and <b>Heavens' Fall</b> after it. Lance Charge, Battle Litany, Life Surge and True North are gone. Stand on the dummy's left or right (it faces where you start).</p>
<h3>A loop</h3>
${seq(['raidenThrust', ['vengefulJump'], 'sinisterDrive', ['continuation'], 'highFangAndClaw', 'dexterDrive', ['continuation'], 'highWheelingThrust', 'wingedChaos', 'heavensThrust', ['vengefulJump'], 'raidenThrust', 'stardiver', 'skyHigh', 'heavensFall', 'crimsonPulse', 'lifesblood', 'soaringSpirit', 'starcross'])}
<p style="color:#a9a3b4">A preview of Evercold (January 2027): the actions, gauges and timers are the Fan Fest footage's; every potency is a stand-in (the combo ${DRG.raiden} / ${DRG.fang} / ${DRG.wheel} / ${DRG.heavens}, drives ${DRG.sinister[0]} (+${DRG.sinister[1]}), Winged Chaos ${DRG.chaos[0]} (+${DRG.chaos[1]}), Geirskogul and Nastrond ${DRG.geirskogul}, Vengeful Jump ${DRG.vengeful}, the Stardiver chain ${DRG.stardiver} / ${DRG.crimson} / ${DRG.lifesblood} / ${DRG.soaring} / ${DRG.starcross}, Sky Shatter ${DRG.shatter}, Heavens' Fall ${DRG.heavensFall}, scaled to sit just above Dawntrail 7.4). Vengeful Jump's 20s recast is a guess. The footage's GCD is 2.50s. Gear: The Balance's 7.4 set, at level 100's numbers.</p>`;
    }
  }

  // ================================================================ Bard
  const BRD = scaled({ sight: 220, meteoric: 280, empyreal: 340, volley: 250, pitch: 350, encore: 800, finale: 0.05,
    caustic: [150, 100], storm: [150, 100], sting: 400, hail: 220, barrage: 240, resonant: 500, rain: 200, apex: 450, blast: 600, thrum: 1000 }, 1.10, ['finale']);
  const SONGS = {
    magesBallad: { name: 'Mage\'s Ballad', seq: ['causticBite', 'stormBite'], flow: 'heartbreaksSting' },
    armysPaeon: { name: 'Army\'s Paeon', seq: ['harmoniousHail', 'reverberantBarrage', 'harmoniousHail', 'reverberantBarrage', 'resonantArrow'], flow: 'rainOfDeath', flows: 2 },
    wanderersMinuet: { name: 'the Wanderer\'s Minuet', seq: ['apexArrow', 'blastArrow', 'thrumOfTheGodsbow'], flow: 'hawksEye', flows: 1 },
  };

  class BardEvolved extends Evolved {
    constructor() {
      const ws = (o) => Object.assign({ kind: 'gcd', target: true, range: 25, delay: 0.6, fx: 'gnbShot' }, o);
      super({ name: 'Bard', abbr: 'BRD', role: 'ranged', model: 'brd-dt', tinctureKey: 'dexdt4', startDistance: 12 });
      const step = (name, iconOf, p, extra, txt) => ws(Object.assign({ name, iconOf, potency: p, songStep: true, desc: `Delivers an attack with a potency of ${p}.${txt || ''}` }, extra));
      this.actions = {
        starlightSight: ws({ name: 'Starlight Sight', iconOf: 'burstShot', potency: BRD.sight, comboStart: true, comboNext: true, desc: `Delivers an attack with a potency of ${BRD.sight}.\n※A three-step combo button.` }),
        meteoricArrow: ws({ name: 'Meteoric Arrow', iconOf: 'refulgentArrow', potency: BRD.meteoric, comboFrom: 'starlightSight', comboNext: true, desc: `Combo Action: Starlight Sight\nDelivers an attack with a potency of ${BRD.meteoric}.` }),
        empyrealArrow: ws({ name: 'Empyreal Arrow', potency: BRD.empyreal, comboFrom: 'meteoricArrow', desc: `Combo Action: Meteoric Arrow\nDelivers an attack with a potency of ${BRD.empyreal}.` }),
        songAttack: ws({ name: 'Song Attack', iconOf: 'apexArrow', potency: 0, desc: 'Becomes the next attack of the song you played (like Summoner\'s Gemshine).' }),
        causticBite: step('Caustic Bite', 'causticBite', BRD.caustic[0], {}, `\nAdditional Effect: Poison, ${BRD.caustic[1]} a tick for 5s\nWhen it ends: readies Heartbreak's Sting`),
        stormBite: step('Storm Bite', 'stormbite', BRD.storm[0], {}, `\nAdditional Effect: Wind damage, ${BRD.storm[1]} a tick for 5s\nWhen it ends: readies Heartbreak's Sting`),
        harmoniousHail: step('Harmonious Hail', 'ladonsbite', BRD.hail, { recast: 1.5 }, '\nRecast: 1.5s (Army\'s Paeon\'s quick sequence).'),
        reverberantBarrage: step('Reverberant Barrage', 'quickNock', BRD.barrage, { recast: 1.5 }, '\nRecast: 1.5s'),
        resonantArrow: step('Resonant Arrow', 'resonantArrow', BRD.resonant, { recast: 1.5, aoe: 0.5 }, '\nRecast: 1.5s'),
        apexArrow: step('Apex Arrow', 'apexArrow', BRD.apex, {}),
        blastArrow: step('Blast Arrow', 'blastArrow', BRD.blast, { aoe: 0.4 }),
        thrumOfTheGodsbow: step('Thrum of the Godsbow', 'wideVolley', BRD.thrum, { cast: 2.4, recast: 3.0, aoe: 0.4, fx: 'gnbZone' }, '\nCast: 2.4s, Recast: 3.0s'),
        wanderersVolley: ws({ name: 'Wanderer\'s Volley', iconOf: 'repellingShot', potency: BRD.volley, cd: 20, charges: 3,
          desc: `Delivers an attack with a potency of ${BRD.volley}, leaping the way you're moving.\nAdditional Effect: +1 Bardic Inspiration\nMaximum Charges: 3 (20s)` }),
        radiantEncore: ws({ name: 'Radiant Encore', potency: BRD.encore, aoe: 0.4, ready: 'radiantEncoreReady', fx: 'gnbZone',
          desc: `Delivers an attack with a potency of ${BRD.encore}.\nCan only be executed after Radiant Finale.` }),
        magesBallad: ab({ name: 'Mage\'s Ballad', recast: 1, song: 'magesBallad', desc: 'Performance Cost: 1\nA party regen.\nAdditional Effect: Readies Caustic Bite → Storm Bite on Song Attack.\nCan\'t be sung again until all three songs have been.' }),
        armysPaeon: ab({ name: 'Army\'s Paeon', recast: 1, song: 'armysPaeon', desc: 'Performance Cost: 1\nParty movement speed up.\nAdditional Effect: Readies a quick five-step sequence on Song Attack (1.5s GCDs) and two Rain of Death.\nCan\'t be sung again until all three songs have been.' }),
        wanderersMinuet: ab({ name: 'the Wanderer\'s Minuet', recast: 1, song: 'wanderersMinuet', desc: 'Performance Cost: 1\nA party shield.\nAdditional Effect: Readies Apex Arrow → Blast Arrow → Thrum of the Godsbow on Song Attack, and Hawk\'s Eye.\nCan\'t be sung again until all three songs have been.' }),
        songFlow: ab({ name: 'Song Ability', iconOf: 'rainOfDeath', recast: 1, desc: 'Becomes the song\'s oGCD (Heartbreak\'s Sting, Rain of Death or Hawk\'s Eye), like Summoner\'s Astral Flow.' }),
        heartbreaksSting: ab({ name: 'Heartbreak\'s Sting', iconOf: 'heartbreakShot', recast: 1, potency: BRD.sting, target: true, range: 25, delay: 0.6, fx: 'gnbShot',
          desc: `Delivers an attack with a potency of ${BRD.sting}.\nReadied each time a Mage's Ballad bite runs out.` }),
        rainOfDeath: ab({ name: 'Rain of Death', recast: 1, potency: BRD.rain, target: true, range: 25, aoe: true, delay: 0.6, desc: `Deals ${BRD.rain} potency to the target and enemies nearby.\nTwo uses under Army's Paeon.` }),
        hawksEye: ab({ name: 'Hawk\'s Eye', recast: 1, desc: 'Your next GCD is a critical direct hit.' }),
        radiantFinale: ab({ name: 'Radiant Finale', recast: 1, desc: `Increases your damage dealt by ${BRD.finale * 100}% (personal) for 20s.\nCan only be executed once all three songs have been sung.\nAdditional Effect: Readies Radiant Encore` }),
        pitchPerfect: ab({ name: 'Pitch Perfect', recast: 1, potency: BRD.pitch, target: true, range: 25, delay: 0.6, fx: 'gnbShot', desc: `Bardic Inspiration Cost: 2\nDelivers an attack with a potency of ${BRD.pitch}.` }),
        troubadour: ab({ name: 'Troubadour', recast: 90, desc: 'Reduces your party\'s damage taken.\nDuration: 15s' }),
        headGraze: ab({ name: 'Head Graze', recast: 30, role: true, target: true, range: 25, desc: 'Interrupts the target\'s action.' }),
        footGraze: ab({ name: 'Foot Graze', recast: 30, role: true, target: true, range: 25, desc: 'Binds the target.' }),
        armsLength: B.ROLE_ACTIONS.melee.armsLength,
        secondWind: B.ROLE_ACTIONS.melee.secondWind,
        peloton: ab({ name: 'Peloton', recast: 5, role: true, desc: 'Party movement speed up out of combat.' }),
        ...B.GENERAL_ACTIONS,
        tincture: B.tincture('dexdt4'),
        auto: { name: 'Shot', kind: 'auto', fx: 'auto', desc: 'Auto-attack.' },
      };
      this.statuses = {
        magesBallad: { name: 'Mage\'s Ballad', self: true, icon: 'st_magesBallad' },
        armysPaeon: { name: 'Army\'s Paeon', self: true, icon: 'st_armysPaeon' },
        wanderersMinuet: { name: 'the Wanderer\'s Minuet', self: true, icon: 'st_wanderersMinuet' },
        hawksEye: { name: 'Hawk\'s Eye', self: true, icon: 'st_hawksEye' },
        radiantFinale: { name: 'Radiant Finale', self: true, icon: 'st_radiantFinale' },
        radiantEncoreReady: { name: 'Radiant Encore Ready', self: true, icon: 'st_radiantEncoreReady' },
        troubadour: { name: 'Troubadour', self: true, icon: 'st_troubadour' },
        causticBite: { name: 'Caustic Bite', self: false, icon: 'st_causticBite' },
        stormBite: { name: 'Storm Bite', self: false, icon: 'st_stormbite' },
        ...B.COMMON_STATUSES,
      };
      this.chargerSpec = [{ key: 'perf', label: 'Performance', max: 3, period: 20, color: '#4a6aff' }];
      this.gaugeLines = [
        (e) => `Mage ${e.g.used.magesBallad ? '●' : '○'}  Army ${e.g.used.armysPaeon ? '●' : '○'}  Wanderer ${e.g.used.wanderersMinuet ? '●' : '○'}   Light ${e.g.light ? '●' : '○'}`,
        (e) => `Bardic Inspiration ${'◆'.repeat(e.g.bi)}${'◇'.repeat(Math.max(0, 2 - e.g.bi))}${e.g.song ? `   ${SONGS[e.g.song].name}: ${e.g.step < SONGS[e.g.song].seq.length ? SONGS[e.g.song].seq.length - e.g.step + ' left' : 'done'}` : ''}`,
      ];
      this.stats = { hp: 226488, main: 6513, mainStat: 'dex', jobMod: 115, trait: 120, wd: 158, det: 2509, crit: 3549, dh: 1981, speed: 474, delay: 3.04 };
      this.speedName = 'Skill speed';
      this.autoAttack = { potency: 90, delay: 3.04, range: 25 };
      this.selfStatusOrder = ['magesBallad', 'armysPaeon', 'wanderersMinuet', 'radiantFinale', 'radiantEncoreReady', 'hawksEye', 'medicated', 'troubadour', 'armsLength', 'sprint'];
      this.targetStatusOrder = ['causticBite', 'stormBite'];
      this.defaultBars = [
        ['starlightSight', 'songAttack', 'songFlow', 'magesBallad', 'armysPaeon', 'wanderersMinuet', 'radiantFinale', 'wanderersVolley', 'pitchPerfect', 'troubadour', 'tincture', 'headGraze'],
        ['footGraze', 'armsLength', 'secondWind', 'peloton', 'sprint', null, null, null, null, null, null, null],
        [null, null, null, null, null, null, null, null, null, null, null, null],
      ];
      this.actionGroups = [
        ['Bard (Evolved)', ['starlightSight', 'meteoricArrow', 'empyrealArrow', 'magesBallad', 'armysPaeon', 'wanderersMinuet', 'songAttack', 'causticBite', 'stormBite', 'harmoniousHail',
          'reverberantBarrage', 'resonantArrow', 'apexArrow', 'blastArrow', 'thrumOfTheGodsbow', 'songFlow', 'heartbreaksSting', 'rainOfDeath', 'hawksEye', 'radiantFinale', 'radiantEncore',
          'wanderersVolley', 'pitchPerfect', 'troubadour']],
        ['Role Actions', ['headGraze', 'footGraze', 'armsLength', 'secondWind', 'peloton']],
        ['General', ['sprint', 'tincture']],
      ];
      this.referenceDps = 32700;
      this.referenceGcd = 2.5;
    }

    initExtra(g) { g.song = null; g.step = 0; g.flows = 0; g.used = {}; g.light = false; g.bi = 0; g.biteEnds = []; }
    mult(e) { return e.has('radiantFinale') ? 1 + BRD.finale : 1; }

    resolveId(id, e) {
      const g = e.g;
      if (id === 'starlightSight') { if (e.inCombo('meteoricArrow')) return 'empyrealArrow'; if (e.inCombo('starlightSight')) return 'meteoricArrow'; }
      if (id === 'songAttack' && g.song && g.step < SONGS[g.song].seq.length) return SONGS[g.song].seq[g.step];
      if (id === 'songFlow' && g.flows > 0 && g.flowId) return g.flowId;
      if (id === 'radiantFinale' && e.has('radiantEncoreReady')) return 'radiantEncore';
      return id;
    }

    check(id, e) {
      const a = this.actions[id], g = e.g;
      if (a.ready && !e.has(a.ready)) return 'Unable to execute action.';
      if (a.song) {
        if (g.ch.perf.n < 1) return 'Unable to execute action. Performance required.';
        if (g.used[a.song]) return 'Unable to execute action. Sing the other songs first.';
      }
      if (a.songStep && !(g.song && SONGS[g.song].seq[g.step] === id)) return 'Unable to execute action.';
      if ((id === 'heartbreaksSting' || id === 'rainOfDeath' || id === 'hawksEye') && !(g.flowId === id && g.flows > 0)) return 'Unable to execute action.';
      if (id === 'radiantFinale' && !g.light) return 'Unable to execute action. Sing all three songs first.';
      if (id === 'pitchPerfect' && g.bi < 2) return 'Unable to execute action. Bardic Inspiration required.';
      if (id === 'songAttack' || id === 'songFlow') return 'Unable to execute action.';
      return null;
    }

    castTime(id, e) { return id === 'thrumOfTheGodsbow' ? super.castTime(id, e) : 0; }

    resolve(id, e) {
      const a = this.actions[id], g = e.g;
      if (a.song) {
        spend(e, g.ch.perf, 1);
        for (const k of Object.keys(SONGS)) e.removeStatus(k, true);
        e.addStatus(a.song, 30);
        g.song = a.song; g.step = 0;
        const S = SONGS[a.song];
        g.flowId = S.flow; g.flows = S.flows || 0;
        g.used[a.song] = true;
        if (Object.keys(g.used).length >= 3) { g.used = {}; g.light = true; }
        return;
      }
      if (a.kind === 'gcd') {
        const opts = {};
        if (e.has('hawksEye') && a.potency) { e.removeStatus('hawksEye'); opts.crit = true; opts.dh = true; opts.dhDet = true; }
        let p = a.comboFrom && !e.lastComboHit ? Math.round(a.potency * 0.4) : a.potency;
        if (a.songStep) {
          g.step++;
          if (id === 'causticBite' || id === 'stormBite') {
            const P = id === 'causticBite' ? BRD.caustic : BRD.storm;
            p = P[0];
            this.hit(e, id, p, opts, () => this.dot(e, id, P[1], 5));
            g.biteEnds.push(e.now + a.delay + 5);
            return;
          }
        }
        if (id === 'wanderersVolley') g.bi = Math.min(2, g.bi + 1);
        if (id === 'radiantEncore') e.removeStatus('radiantEncoreReady');
        if (p) this.hit(e, id, p, opts);
        return;
      }
      switch (id) {
        case 'heartbreaksSting': case 'rainOfDeath': g.flows--; this.hit(e, id, a.potency); return;
        case 'hawksEye': g.flows--; e.addStatus('hawksEye', 15); return;
        case 'radiantFinale': g.light = false; e.addStatus('radiantFinale', 20); e.addStatus('radiantEncoreReady', 30); return;
        case 'pitchPerfect': g.bi -= 2; this.hit(e, id, a.potency); return;
        case 'troubadour': e.addStatus('troubadour', 15); return;
        case 'headGraze': case 'footGraze': case 'peloton': return;
      }
      if (B.ROLE_EFFECTS[id]) B.ROLE_EFFECTS[id](e);
    }

    // Each Mage's Ballad bite readies a Heartbreak's Sting when it runs out.
    nextExtra(e) { return e.g.biteEnds.length ? Math.min(...e.g.biteEnds) : Infinity; }
    processExtra(e) {
      const g = e.g;
      const left = [];
      for (const t of g.biteEnds) {
        if (e.now >= t - EPS) { g.flowId = 'heartbreaksSting'; g.flows = (g.song === 'magesBallad' ? g.flows : 0) + 1; }
        else left.push(t);
      }
      g.biteEnds = left;
    }

    proc(id, e) {
      const a = this.actions[id], g = e.g;
      if (id === 'starlightSight') return e.inCombo('starlightSight') || e.inCombo('meteoricArrow');
      if (id === 'songAttack') return !!(g.song && g.step < SONGS[g.song].seq.length);
      if (id === 'songFlow') return g.flows > 0;
      if (a.song) return !this.check(id, e);
      if (id === 'radiantFinale') return g.light || e.has('radiantEncoreReady');
      if (id === 'pitchPerfect') return g.bi >= 2;
      return false;
    }

    helpHtml(seq) {
      return `
<h3>How it plays (Evercold Evolved, a preview)</h3>
<p>The Evolved Bard the developers showed. No more party damage buffs: each song is a party utility and unlocks its own attacks. A <b>Performance</b> charge comes every 20s (three at most), and each song costs one; sing all three, in any order, before any can be sung again. The song readies a sequence on the <b>Song Attack</b> button and an oGCD on <b>Song Ability</b> (much as Summoner's Gemshine and Astral Flow work):</p>
<p><b>Mage's Ballad</b> (party regen): <b>Caustic Bite → Storm Bite</b>, two short 5s DoTs, and each readies <b>Heartbreak's Sting</b> as it runs out. <b>Army's Paeon</b> (party movement speed): <b>Harmonious Hail → Reverberant Barrage → Harmonious Hail → Reverberant Barrage → Resonant Arrow</b> on a quick <b>1.5s</b> GCD, with two <b>Rain of Death</b>. <b>The Wanderer's Minuet</b> (party shield): <b>Apex Arrow → Blast Arrow → Thrum of the Godsbow</b> (a 2.4s cast on a 3s GCD), and <b>Hawk's Eye</b> makes the next GCD a critical direct hit. With all three sung, <b>Radiant Finale</b> is a personal damage buff that readies <b>Radiant Encore</b>.</p>
<p><b>Starlight Sight → Meteoric Arrow → Empyreal Arrow</b> is the filler combo. <b>Wanderer's Volley</b> (three charges) leaps the way you're moving and adds <b>Bardic Inspiration</b>; two buy <b>Pitch Perfect</b>.</p>
<h3>A loop</h3>
${seq(['starlightSight', ['wanderersMinuet'], 'apexArrow', ['hawksEye'], 'blastArrow', 'thrumOfTheGodsbow', ['armysPaeon'], 'harmoniousHail', ['rainOfDeath'], 'reverberantBarrage', ['rainOfDeath'], 'harmoniousHail', 'reverberantBarrage', 'resonantArrow', ['magesBallad'], 'causticBite', 'stormBite', ['heartbreaksSting'], ['radiantFinale'], 'radiantEncore', ['heartbreaksSting'], 'wanderersVolley', 'wanderersVolley', ['pitchPerfect'], 'meteoricArrow'])}
<p style="color:#a9a3b4">A preview of Evercold (January 2027): the actions, gauges and timers are the Fan Fest footage's (Army's Paeon's sequence measured at 1.5s a GCD, the rest 2.50s); every potency is a stand-in (the combo ${BRD.sight} / ${BRD.meteoric} / ${BRD.empyreal}, the bites ${BRD.caustic[0]} + ${BRD.caustic[1]} a tick, Heartbreak's Sting ${BRD.sting}, Harmonious Hail ${BRD.hail}, Reverberant Barrage ${BRD.barrage}, Resonant Arrow ${BRD.resonant}, Rain of Death ${BRD.rain}, Apex Arrow ${BRD.apex}, Blast Arrow ${BRD.blast}, Thrum ${BRD.thrum}, Radiant Encore ${BRD.encore}, Volley ${BRD.volley}, Pitch Perfect ${BRD.pitch}, Radiant Finale +${BRD.finale * 100}%, scaled to sit just above Dawntrail 7.4). Wanderer's Volley's 20s recharge and the 30s a song's attacks wait are guesses. Gear: The Balance's 7.4 set, at level 100's numbers.</p>`;
    }
  }

  const NOTE = 'Evercold preview (8.0, January 2027): the kit Square Enix showed at Fan Fest 2026, with stand-in potencies';
  B.registerJob({ id: 'pld', name: 'Paladin', abbr: 'PLD', role: 'tank', classJob: 19,
    versions: [{ id: 'ec80', label: 'Evercold Evolved (preview)', history: 'EC Evolved', note: NOTE + ': Imperator from Honor, Surcoat counters, Continuation into Expiacion and Blade of Honor', create: () => new PaladinEvolved() }] });
  B.registerJob({ id: 'whm', name: 'White Mage', abbr: 'WHM', role: 'healer', classJob: 24,
    versions: [{ id: 'ec80', label: 'Evercold Evolved (preview)', history: 'EC Evolved', note: NOTE + ': instant Glare III into High Glare, Sanctity from GCD heals into Holy Sanctuary, Plenary Indulgence for Afflatus heals', create: () => new WhiteMageEvolved() }] });
  B.registerJob({ id: 'drg', name: 'Dragoon', abbr: 'DRG', role: 'melee', classJob: 22,
    versions: [{ id: 'ec80', label: 'Evercold Evolved (preview)', history: 'EC Evolved', note: NOTE + ': left and right flank drives from Dragonsbane, Vengeful Jump into Stardiver and Sky High', create: () => new DragoonEvolved() }] });
  B.registerJob({ id: 'brd', name: 'Bard', abbr: 'BRD', role: 'ranged', classJob: 23,
    versions: [{ id: 'ec80', label: 'Evercold Evolved (preview)', history: 'EC Evolved', note: NOTE + ': three songs from Performance, each with its own attacks, Radiant Finale, Wanderer\'s Volley into Pitch Perfect', create: () => new BardEvolved() }] });
})(window.BLM);
