// Sage, Endwalker at level 90, in four versions. Dosis III (330, 1.5s) as filler; Eukrasia (a 1s GCD) turns the next
// Dosis into Eukrasian Dosis III, a 30s DoT; Phlegma III (two charges, instant, 6y) is the burst; Toxikon II spends
// Addersting; Pneuma (330, 120s) hits and heals. Kardia heals your partner as you deal damage; Addersgall (one every 20s)
// pays for the oGCD heals and gives MP back.
//  - 6.0–6.08: Phlegma III 510 on 45s; Soteria a single +50%; Addersting starts empty; Holos has no barrier.
//  - 6.1–6.18: Soteria four stacks at +70%; Addersting starts full (three Toxikons).
//  - 6.2–6.28: Holos adds a barrier; Phlegma III 600 (6.28); Abyssos gear.
//  - 6.3–6.58: Phlegma on 40s; your own Eukrasian Prognosis also grants Addersting; Eukrasian Dosis III 75 (6.4).
// Numbers are the game data at each patch (xivapi's datamining) and the Lodestone notes; gear is The Balance's set for
// each tier. ref: a scripted bot parses about 5,000 / 5,030 / 6,040 / 8,030 on these.
(function (B) {
  const spell = (o) => Object.assign({ kind: 'gcd', target: true, range: 25, delay: 0.8, school: 'aether', sound: 'paradox' }, o);
  const heal = (o) => Object.assign({ kind: 'gcd', potency: 0, school: 'aether', sound: 'paradox' }, o);
  const ab = (o) => Object.assign({ kind: 'ogcd' }, o);
  const GALL_TIME = 20;
  const VERSIONS = {
    ew60: { label: 'Endwalker 6.0–6.08', history: 'EW 6.0–6.08', phlegma: 510, phlegmaRecast: 45, edosis: 70, soteria: 'one', stingStart: 0, holosBarrier: false,
      tincture: 'mnd6', ref: 5290, stats: { hp: 70000, main: 2559, wd: 120, det: 1951, crit: 2277, dh: 904, speed: 656, piety: 390 },
      note: 'Level 90, the launch Sage: Phlegma III 510 on 45s, Soteria a single +50%, Addersting starts empty; Asphodelos gear' },
    ew61: { label: 'Endwalker 6.1–6.18', history: 'EW 6.1–6.18', phlegma: 510, phlegmaRecast: 45, edosis: 70, soteria: 'four', stingStart: 3, holosBarrier: false,
      tincture: 'mnd6', ref: 5340, stats: { hp: 70000, main: 2559, wd: 120, det: 1951, crit: 2277, dh: 904, speed: 656, piety: 390 },
      note: 'Level 90: Soteria four stacks at +70%, Addersting starts full; Asphodelos gear' },
    ew62: { label: 'Endwalker 6.2–6.28', history: 'EW 6.2–6.28', phlegma: 600, phlegmaRecast: 45, edosis: 70, soteria: 'four', stingStart: 3, holosBarrier: true,
      tincture: 'mnd7', ref: 6400, stats: { hp: 80000, main: 2928, wd: 126, det: 1859, crit: 2312, dh: 1012, speed: 827, piety: 390 },
      note: 'Level 90: Holos adds a barrier, Phlegma III 600 (6.28); Abyssos gear' },
    ew63: { label: 'Endwalker 6.3–6.58', history: 'EW 6.3–6.58', phlegma: 600, phlegmaRecast: 40, edosis: 75, soteria: 'four', stingStart: 3, holosBarrier: true,
      tincture: 'mnd', ref: 8510, stats: { hp: 90000, main: 3369, wd: 132, det: 2047, crit: 2502, dh: 1012, speed: 664, piety: 390 },
      note: 'Level 90: Phlegma on 40s, Addersting from your own Eukrasian Prognosis, Eukrasian Dosis III 75; Anabaseios gear' },
  };

  function buildActions(V) {
    return {
      dosis3: spell({ name: 'Dosis III', potency: 330, cast: 1.5, mp: 400, orb: true, desc: 'Deals unaspected damage with a potency of 330.\nAdditional Effect: Restores HP of Kardion partner\nUnder Eukrasia, Dosis III becomes Eukrasian Dosis III.' }),
      eukrasia: heal({ name: 'Eukrasia', recast: 1, target: false, desc: 'Grants Eukrasia: Dosis, Diagnosis and Prognosis become their Eukrasian versions.\nRecast: 1s' }),
      eukrasianDosis3: spell({ name: 'Eukrasian Dosis III', potency: 0, mp: 400, recast: 1.5, dot: { potency: V.edosis, duration: 30 }, sound: 'dot', desc: `Deals unaspected damage over time.\nPotency: ${V.edosis}\nDuration: 30s\nRecast: 1.5s` }),
      phlegma3: spell({ name: 'Phlegma III', potency: V.phlegma, mp: 400, range: 6, cd: V.phlegmaRecast, charges: 2, aoe: 0.5, fx: 'gnbZone', desc: `Deals unaspected damage with a potency of ${V.phlegma} to target and all enemies nearby it, 50% less for all remaining enemies.\nMaximum Charges: 2 (${V.phlegmaRecast}s)` }),
      toxikon2: spell({ name: 'Toxikon II', potency: 330, mp: 0, aoe: 0.5, sting: true, desc: 'Deals unaspected damage with a potency of 330 to target and all enemies nearby it, 50% less for the rest.\nAddersting Cost: 1' }),
      dyskrasia2: spell({ name: 'Dyskrasia II', potency: 170, mp: 400, target: false, pbaoe: 5, aoe: true, desc: 'Deals unaspected damage with a potency of 170 to all nearby enemies.' }),
      pneuma: spell({ name: 'Pneuma', potency: 330, cast: 1.5, mp: 700, cd: 120, aoe: 0.6, fx: 'gnbBurst', desc: 'Deals unaspected damage with a potency of 330 to all enemies in a straight line before you, 40% less for all remaining enemies.\nAdditional Effect: Restores own HP and the HP of all nearby party members\nCure Potency: 600' }),
      diagnosis: heal({ name: 'Diagnosis', cast: 1.5, mp: 400, desc: 'Restores target\'s HP.\nCure Potency: 450' }),
      prognosis: heal({ name: 'Prognosis', cast: 2, mp: 700, desc: 'Restores own HP and the HP of all party members within a radius of 15 yalms.\nCure Potency: 300' }),
      eukrasianDiagnosis: heal({ name: 'Eukrasian Diagnosis', mp: 900, recast: 1.5, desc: 'Restores target\'s HP and erects a barrier.\nCure Potency: 300\nBreaking the barrier grants Addersting.' }),
      eukrasianPrognosis: heal({ name: 'Eukrasian Prognosis', mp: 900, recast: 1.5, desc: 'Restores own HP and the HP of nearby party members and erects a barrier.\nCure Potency: 100' }),
      egeiro: heal({ name: 'Egeiro', cast: 8, mp: 2400, desc: 'Resurrects target to a weakened state.' }),
      kardia: ab({ name: 'Kardia', recast: 5, desc: 'Grants Kardion to a party member: your damage spells restore its HP (Cure Potency 170).' }),
      soteria: ab({ name: 'Soteria', recast: 90, desc: V.soteria === 'one' ? 'Increases the healing of Kardion by 50%.\nDuration: 15s' : 'Grants 4 stacks of Soteria, each increasing Kardion\'s healing by 70%.\nDuration: 15s' }),
      zoe: ab({ name: 'Zoe', recast: 90, desc: 'Increases the potency of the next healing spell by 50%.\nDuration: 30s' }),
      holos: ab({ name: 'Holos', recast: 120, desc: `Restores own HP and the HP of nearby party members and reduces damage taken by 10%${V.holosBarrier ? ', with a barrier equal to the HP restored' : ''}.\nCure Potency: 300\nDuration: 20s` }),
      panhaima: ab({ name: 'Panhaima', recast: 120, desc: 'Erects a five-stack barrier around self and nearby party members.\nDuration: 15s' }),
      haima: ab({ name: 'Haima', recast: 120, desc: 'Erects a five-stack barrier around target.\nDuration: 15s' }),
      krasis: ab({ name: 'Krasis', recast: 60, desc: 'Increases HP recovery via healing actions for a party member or self by 20%.\nDuration: 10s' }),
      rhizomata: ab({ name: 'Rhizomata', recast: 90, desc: 'Increases Addersgall by 1.' }),
      physis2: ab({ name: 'Physis II', recast: 60, desc: 'Gradually restores HP and increases HP recovery by 10% for nearby party members.\nDuration: 15s' }),
      kerachole: ab({ name: 'Kerachole', recast: 30, gall: true, desc: 'Reduces damage taken and grants regen to nearby party members.\nAddersgall Cost: 1' }),
      ixochole: ab({ name: 'Ixochole', recast: 30, gall: true, desc: 'Restores HP of nearby party members.\nCure Potency: 400\nAddersgall Cost: 1' }),
      taurochole: ab({ name: 'Taurochole', recast: 45, gall: true, desc: 'Restores target\'s HP and reduces damage taken by 10%.\nCure Potency: 700\nAddersgall Cost: 1' }),
      druochole: ab({ name: 'Druochole', recast: 1, gall: true, desc: 'Restores target\'s HP.\nCure Potency: 600\nAddersgall Cost: 1' }),
      icarus: ab({ name: 'Icarus', recast: 45, desc: 'Rush to a target\'s side.' }),
      swiftcast: ab({ name: 'Swiftcast', recast: 60, role: true, desc: 'Next spell is cast immediately.\nDuration: 10s' }),
      lucidDreaming: ab({ name: 'Lucid Dreaming', recast: 60, role: true, desc: 'Gradually restores MP.\nPotency: 55\nDuration: 21s' }),
      surecast: ab({ name: 'Surecast', recast: 120, role: true, desc: 'Spells can be cast without interruption.\nDuration: 6s' }),
      rescue: ab({ name: 'Rescue', recast: 120, role: true, desc: 'Instantly draws target party member to your side.' }),
      ...B.GENERAL_ACTIONS,
      tincture: B.tincture(V.tincture),
      auto: { name: 'Attack', kind: 'auto', fx: 'auto', desc: 'Auto-attack.' },
    };
  }

  const STATUSES = {
    eukrasia: { name: 'Eukrasia', self: true, icon: 'st_eukrasia' },
    kardia: { name: 'Kardia', self: true, icon: 'st_kardia' },
    soteria: { name: 'Soteria', self: true, icon: 'st_soteria' },
    zoe: { name: 'Zoe', self: true, icon: 'st_zoe' },
    swiftcast: { name: 'Swiftcast', self: true, icon: 'st_swiftcast' },
    lucidDreaming: { name: 'Lucid Dreaming', self: true, icon: 'st_lucid' },
    surecast: { name: 'Surecast', self: true, icon: 'st_surecast' },
    eukrasianDosis3: { name: 'Eukrasian Dosis III', self: false, icon: 'st_edosis' },
  };

  class SageEW {
    constructor(version) {
      const V = VERSIONS[version];
      this.V = V;
      this.name = 'Sage';
      this.abbr = 'SGE';
      this.role = 'healer';
      this.level = 90;
      this.levelKey = 90;
      this.model = 'sge-ew';
      this.maxMp = 10000;
      this.actions = buildActions(V);
      this.statuses = STATUSES;
      // Maim and Mend II: +30% to the healer's damage.
      this.stats = Object.assign({ mainStat: 'mnd', jobMod: 115, trait: 130, delay: 2.8 }, V.stats);
      this.speedName = 'Spell speed';
      this.tierHaste = 0;
      this.selfStatusOrder = ['eukrasia', 'kardia', 'swiftcast', 'medicated', 'lucidDreaming', 'soteria', 'zoe', 'surecast', 'sprint'];
      this.targetStatusOrder = ['eukrasianDosis3'];
      this.defaultBars = [
        ['dosis3', 'eukrasia', 'phlegma3', 'toxikon2', 'pneuma', 'dyskrasia2', 'lucidDreaming', 'swiftcast', 'tincture', 'kardia', 'soteria', 'rhizomata'],
        ['diagnosis', 'prognosis', 'eukrasianDiagnosis', 'eukrasianPrognosis', 'druochole', 'taurochole', 'ixochole', 'kerachole', 'physis2', 'holos', 'panhaima', 'haima'],
        ['zoe', 'krasis', 'icarus', 'egeiro', 'surecast', 'rescue', 'sprint', null, null, null, null, null],
      ];
      this.actionGroups = [
        ['Sage', ['dosis3', 'eukrasia', 'eukrasianDosis3', 'phlegma3', 'toxikon2', 'dyskrasia2', 'pneuma', 'diagnosis', 'prognosis', 'eukrasianDiagnosis',
          'eukrasianPrognosis', 'egeiro', 'kardia', 'soteria', 'zoe', 'holos', 'panhaima', 'haima', 'krasis', 'rhizomata', 'physis2', 'kerachole', 'ixochole',
          'taurochole', 'druochole', 'icarus']],
        ['Role Actions', ['swiftcast', 'lucidDreaming', 'surecast', 'rescue']],
        ['General', ['sprint', 'tincture']],
      ];
      this.referenceDps = V.ref;
      this.referenceGcd = 2.45;
      this.startDistance = 6;
    }

    initGauge(e) {
      e.addStatus('kardia', 1e9, { permanent: true });
      return { gall: 3, sting: this.V.stingStart, gallAt: null };
    }

    // Eukrasia turns Dosis III into Eukrasian Dosis III.
    resolveId(id, e) {
      if (id === 'dosis3' && e.has('eukrasia')) return 'eukrasianDosis3';
      return id;
    }

    check(id, e) {
      const a = this.actions[id], g = e.g;
      if (id === 'eukrasianDosis3' && !e.has('eukrasia')) return 'Unable to execute action. Eukrasia required.';
      if (id === 'eukrasia' && e.has('eukrasia')) return 'Unable to execute action.';
      if (a.sting && g.sting < 1) return 'Unable to execute action. No Addersting.';
      if (a.gall && g.gall < 1) return 'Unable to execute action. No Addersgall.';
      return null;
    }

    castTime(id, e) {
      const a = this.actions[id];
      if (!a.cast) return 0;
      if (e.has('swiftcast')) return 0;
      return e.speedScale(a.cast, 0);
    }
    consumeInstant(id, e) { if (this.actions[id].cast && e.has('swiftcast')) e.removeStatus('swiftcast'); }

    mpCost(id) { return this.actions[id].mp || 0; }
    mpRegen() { return 200 + Math.floor(150 * (this.stats.piety - 390) / 1900); }
    lucidGain() { return B.LUCID_REGEN; }

    snapshot(a, e) {
      const main = this.stats.main + (e.has('medicated') ? B.TINCTURES[this.V.tincture].cap : 0);
      return { mult: 1, main };
    }

    resolve(id, e) {
      const a = this.actions[id], g = e.g;
      if (a.kind === 'gcd') e.mp -= this.mpCost(id);
      if (a.sting) g.sting--;
      if (a.gall) { g.gall--; e.mp = Math.min(e.maxMp, e.mp + 700); }
      switch (id) {
        case 'eukrasia': e.addStatus('eukrasia', 1e9, { permanent: true }); break;
        case 'eukrasianDosis3': case 'eukrasianDiagnosis': case 'eukrasianPrognosis': e.removeStatus('eukrasia'); break;
        case 'soteria': e.addStatus('soteria', 15, this.V.soteria === 'four' ? { stacks: 4 } : {}); break;
        case 'zoe': e.addStatus('zoe', 30); break;
        case 'rhizomata': g.gall = Math.min(3, g.gall + 1); break;
        case 'kardia': e.addStatus('kardia', 1e9, { permanent: true }); break;
        case 'icarus': {
          const d = e.distToTarget() || 1;
          if (d > 2.6) { const from = { x: e.pos.x, z: e.pos.z }; e.pos.x *= 2.4 / d; e.pos.z *= 2.4 / d; e.emit('teleport', { from, to: { x: e.pos.x, z: e.pos.z } }); }
          break;
        }
        default:
          if (B.ROLE_EFFECTS[id]) B.ROLE_EFFECTS[id](e);
      }
      const snap = this.snapshot(a, e);
      if (a.dot) e.addTStatus(id, a.dot.duration, { snap, dot: { potency: a.dot.potency, id } });
      if (a.potency) e.queueHit(id, a.potency, snap, a.delay);
    }

    // Addersgall: one every 20s, up to three.
    nextEvent(e) {
      const g = e.g;
      if (!e.inCombat) return Infinity;
      if (g.gallAt === null) g.gallAt = e.now + GALL_TIME;
      return g.gallAt;
    }
    process(e) {
      const g = e.g;
      if (e.inCombat && g.gallAt !== null && e.now >= g.gallAt - 1e-6) { g.gallAt += GALL_TIME; g.gall = Math.min(3, g.gall + 1); }
    }

    proc(id, e) {
      if (id === 'dosis3') return e.has('eukrasia');
      if (id === 'toxikon2') return e.g.sting > 0;
      return false;
    }

    speedInfo(e) { return `GCD ${e.gcdForSpeed(e.stats.speed).toFixed(2)} · Dosis III ${e.speedScale(1.5).toFixed(2)}s cast · ${e.maxMp.toLocaleString()} MP`; }

    // ---------- the Addersgall gauge ----------
    gaugeBuild(root) {
      root.innerHTML = `
<svg width="360" height="120" viewBox="0 0 360 120">
  <rect x="8" y="10" width="344" height="100" rx="14" fill="rgba(14,12,20,.86)" stroke="rgba(255,255,255,.22)"/>
  <text x="24" y="36" font-family="Noto Sans, sans-serif" font-size="11" font-weight="600" fill="#a9a3b4" letter-spacing="1">ADDERSGALL</text>
  ${[0, 1, 2].map(k => `<path id="sg-g${k}" d="M0 -12 L9 0 L0 12 L-9 0 Z" transform="translate(${150 + k * 28} 32)" fill="#1d2a2a" stroke="rgba(255,255,255,.3)" stroke-width="1.5"/>`).join('')}
  <rect x="140" y="50" width="76" height="4" rx="2" fill="#1d1a2a"/><rect id="sg-t" x="140" y="50" width="0" height="4" rx="2" fill="#7fe0d0"/>
  <text x="24" y="86" font-family="Noto Sans, sans-serif" font-size="11" font-weight="600" fill="#a9a3b4" letter-spacing="1">ADDERSTING</text>
  ${[0, 1, 2].map(k => `<circle id="sg-s${k}" cx="${150 + k * 28}" cy="82" r="8" fill="#2a1d24" stroke="rgba(255,255,255,.3)" stroke-width="1.5"/>`).join('')}
  <text id="sg-e" x="336" y="86" text-anchor="end" font-family="Noto Sans, sans-serif" font-size="12" font-weight="600" fill="#9fe0ff"></text>
</svg>`;
      const $ = (s) => root.querySelector(s);
      this.sg = { g: [0, 1, 2].map(k => $('#sg-g' + k)), s: [0, 1, 2].map(k => $('#sg-s' + k)), t: $('#sg-t'), e: $('#sg-e'), cache: {} };
    }

    gaugeUpdate(e) {
      const G = this.sg, c = G.cache, g = e.g;
      const put = (k, v, fn) => { if (c[k] !== v) { c[k] = v; fn(v); } };
      for (let i = 0; i < 3; i++) put('g' + i, g.gall > i, v => G.g[i].setAttribute('fill', v ? '#7fe0d0' : '#1d2a2a'));
      for (let i = 0; i < 3; i++) put('s' + i, g.sting > i, v => G.s[i].setAttribute('fill', v ? '#e05a8a' : '#2a1d24'));
      const prog = e.inCombat && g.gallAt !== null && g.gall < 3 ? 1 - (g.gallAt - e.now) / GALL_TIME : 0;
      put('t', Math.round(prog * 40), () => G.t.setAttribute('width', String(76 * Math.max(0, Math.min(1, prog)))));
      put('e', e.has('eukrasia'), v => { G.e.textContent = v ? 'EUKRASIA' : ''; });
    }

    helpHtml(seq) {
      const V = this.V;
      return `
<h3>How it plays (${V.label})</h3>
<p>Level 90 Sage on a dummy. Fill with <b>Dosis III</b> (330, a 1.5s cast); keep <b>Eukrasian Dosis III</b> up (press <b>Eukrasia</b>, a 1s GCD, then Dosis: ${V.edosis} a tick for 30s). Spend <b>Phlegma III</b>'s two charges (${V.phlegma}, ${V.phlegmaRecast}s each, 6 yalms) at the two-minute marks and never let them overcap. <b>Toxikon II</b> spends Addersting${V.stingStart ? ' (three to start with)' : ' (none on a dummy: it comes from broken Eukrasian Diagnosis barriers)'}; it and <b>Pneuma</b> match Dosis III, so they're for moving or healing. Kardia heals your partner whenever you deal damage; Addersgall (one every 20s) pays for the oGCD heals and gives 700 MP back.</p>
<h3>The opener (The Balance)</h3>
${seq(['dosis3', ['tincture'], 'eukrasia', 'eukrasianDosis3', 'dosis3', 'dosis3', 'phlegma3', 'phlegma3', 'dosis3', 'dosis3'])}
<p>The tincture at −3s, Dosis III precast at −1.5s. Then E. Dosis every 30s, Dosis as filler, the third Phlegma about 60s in.</p>
<p style="color:#a9a3b4">${V.label} numbers: Dosis III 330, Eukrasian Dosis III ${V.edosis} × 30s, Phlegma III ${V.phlegma} (${V.phlegmaRecast}s, 2 charges), Toxikon II 330, Dyskrasia II 170, Pneuma 330, Maim and Mend II +30%. Gear: The Balance's set for the tier (Mind ${V.stats.main.toLocaleString()}).</p>`;
    }
  }

  B.registerJob({
    id: 'sge', name: 'Sage', abbr: 'SGE', role: 'healer', classJob: 40,
    versions: ['ew63', 'ew62', 'ew61', 'ew60'].map(v => ({ id: v, label: VERSIONS[v].label, history: VERSIONS[v].history, note: VERSIONS[v].note, create: () => new SageEW(v) })),
  });
})(window.BLM);
