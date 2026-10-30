// White Mage, Heavensward (patches 3.0–3.57) at level 60. Healer gear had no Intelligence, so damage needs Cleric
// Stance: a toggle that swaps Mind into Intelligence (+10% attack magic, −20% healing). Stone III (210, 2.5s) is the
// filler, and the three Aeros are separate DoTs that all run at once: Aero (instant, 50 + 25 × 18s), Aero II (2.5s,
// 50 + 50 × 12s) and Aero III (a 3.0s cast on a 3.0s recast, 50 + 40 × 24s). Assize (90s) hits for 300 and returns
// 10% MP; Presence of Mind (150s) is 15s of 20% faster casts and GCD; Shroud of Saints (120s) is the MP button; Fluid
// Aura (150) knocks back. Swiftcast is the Thaumaturge cross-class. Heavensward's damage formula (B.LEVELS.hw60).
// Numbers are the official job guide's 3.57 tooltips (Wayback, June 2017) and the FFXIV wiki's Heavensward White Mage
// pages. The MP pool is fitted to archived 2016 Lodestone profiles (1.20 × (8,840 + 5.389 × (Piety − 218))). Gear:
// an Alexander: Creator set at 2.29 (the Alexandrian Metal Cane: 115 magic damage).
(function (B) {
  const spell = (o) => Object.assign({ kind: 'gcd', target: true, range: 25, delay: 0.8, school: 'earth', sound: 'ruin' }, o);
  const heal = (o) => Object.assign({ kind: 'gcd', potency: 0, sound: 'paradox' }, o);
  const ab = (o) => Object.assign({ kind: 'ogcd' }, o);
  const FALLOFF = [1, 0.9, 0.8, 0.7, 0.6, 0.5];
  const ACTIONS = {
    stone3: spell({ name: 'Stone III', potency: 210, cast: 2.5, mp: 530, orb: true, desc: 'Deals earth damage with a potency of 210.\nAdditional Effect: Heavy +20%\nDuration: 20s' }),
    stone2: spell({ name: 'Stone II', potency: 170, cast: 2.5, mp: 442, orb: true, desc: 'Deals earth damage with a potency of 170.' }),
    aero: spell({ name: 'Aero', potency: 50, mp: 354, dot: { potency: 25, duration: 18 }, school: 'wind', sound: 'wind', desc: 'Deals wind damage with a potency of 50.\nAdditional Effect: Wind damage over time\nPotency: 25\nDuration: 18s' }),
    aero2: spell({ name: 'Aero II', potency: 50, cast: 2.5, mp: 442, dot: { potency: 50, duration: 12 }, school: 'wind', sound: 'wind', desc: 'Deals wind damage with a potency of 50.\nAdditional Effect: Wind damage over time\nPotency: 50\nDuration: 12s' }),
    aero3: spell({ name: 'Aero III', potency: 50, cast: 3, recast: 3, mp: 707, aoe: true, dot: { potency: 40, duration: 24 }, school: 'wind', sound: 'wind', desc: 'Deals wind damage with a potency of 50 to target and all enemies nearby it.\nAdditional Effect: Wind damage over time\nPotency: 40\nDuration: 24s\nRecast: 3.0s' }),
    holy: spell({ name: 'Holy', potency: 200, cast: 3, mp: 1768, target: false, pbaoe: 8, aoe: FALLOFF, school: 'holy', desc: 'Deals unaspected damage to all nearby enemies with a potency of 200 for the first enemy, 10% less for the second, and so on to 50% less.\nAdditional Effect: Stun\nDuration: 4s' }),
    cure: heal({ name: 'Cure', cast: 1.5, mp: 354, desc: 'Restores target\'s HP.\nCure Potency: 400' }),
    cure2: heal({ name: 'Cure II', cast: 2, mp: 884, desc: 'Restores target\'s HP.\nCure Potency: 650' }),
    medica: heal({ name: 'Medica', cast: 2.5, mp: 1149, desc: 'Restores own HP and the HP of all nearby party members.\nCure Potency: 300' }),
    medica2: heal({ name: 'Medica II', cast: 2.5, mp: 1414, desc: 'Restores own HP and the HP of all nearby party members.\nCure Potency: 200\nAdditional Effect: Regen\nCure Potency: 50\nDuration: 30s' }),
    regen: heal({ name: 'Regen', mp: 619, desc: 'Grants healing over time effect to target.\nCure Potency: 150\nDuration: 21s' }),
    // Off the GCD.
    clericStance: ab({ name: 'Cleric Stance', recast: 5, desc: 'Swaps your Mind and Intelligence, increases attack magic potency by 10% and reduces healing magic potency by 20%.\nEffect ends upon reuse.' }),
    assize: ab({ name: 'Assize', recast: 90, potency: 300, target: false, pbaoe: 15, aoe: true, delay: 0.6, school: 'holy', fx: 'gnbBurst', desc: 'Deals unaspected damage with a potency of 300 to all nearby enemies.\nAdditional Effect: Restores own HP and the HP of all nearby party members\nCure Potency: 300\nAdditional Effect: Restores 10% of maximum MP' }),
    presenceOfMind: ab({ name: 'Presence of Mind', recast: 150, desc: 'Reduces spell cast time and recast time, and auto-attack delay by 20%.\nDuration: 15s' }),
    shroudOfSaints: ab({ name: 'Shroud of Saints', recast: 120, desc: 'Reduces enmity by half.\nAdditional Effect: Refresh\nPotency: 80\nDuration: 15s' }),
    fluidAura: ab({ name: 'Fluid Aura', recast: 30, potency: 150, target: true, range: 25, delay: 0.6, school: 'water', fx: 'gnbBow', desc: 'Deals water damage with a potency of 150.\nAdditional Effect: Knockback 15 yalms\nAdditional Effect: Bind\nDuration: 6s' }),
    divineSeal: ab({ name: 'Divine Seal', recast: 60, desc: 'Increases healing magic potency by 30%.\nDuration: 15s' }),
    tetragrammaton: ab({ name: 'Tetragrammaton', recast: 60, desc: 'Restores target\'s HP.\nCure Potency: 700' }),
    benediction: ab({ name: 'Benediction', recast: 300, desc: 'Restores all of a target\'s HP.' }),
    asylum: ab({ name: 'Asylum', recast: 90, desc: 'Envelops a designated area in a veil of succor, granting healing over time.\nDuration: 18s' }),
    // Thaumaturge cross-class.
    swiftcast: ab({ name: 'Swiftcast', recast: 60, role: true, desc: 'Next spell is cast immediately.\nDuration: 10s' }),
    surecast: ab({ name: 'Surecast', recast: 30, role: true, desc: 'The next spell is cast without interruption.\nDuration: 10s' }),
    ...B.GENERAL_ACTIONS,
    tincture: Object.assign({}, B.tincture('mnd3sb'), { name: 'Supramax-Potion of Mind', dur: 15, desc: 'This diluted brew temporarily increases mind.\nMind +20% (Max 154)\nDuration: 15s' }),
  };

  const STATUSES = {
    clericStance: { name: 'Cleric Stance', self: true, icon: 'st_cleric' },
    presenceOfMind: { name: 'Presence of Mind', self: true, icon: 'st_pom' },
    shroudOfSaints: { name: 'Shroud of Saints', self: true, icon: 'st_shroud' },
    divineSeal: { name: 'Divine Seal', self: true, icon: 'st_seal' },
    swiftcast: { name: 'Swiftcast', self: true, icon: 'st_swiftcast' },
    aero: { name: 'Aero', self: false, icon: 'st_aero' },
    aero2: { name: 'Aero II', self: false, icon: 'st_aero2' },
    aero3: { name: 'Aero III', self: false, icon: 'st_aero3' },
  };

  class WhiteMageHW {
    constructor() {
      this.name = 'White Mage';
      this.abbr = 'WHM';
      this.role = 'healer';
      this.level = 60;
      this.levelKey = 'hw60';
      this.model = 'whm-hw';
      this.maxMp = 12962;
      this.actions = ACTIONS;
      this.statuses = STATUSES;
      // An Alexander: Creator set at 2.29, Heavensward-era stats. main is Mind, which Cleric Stance makes your
      // Intelligence; without it you'd hit with about 250. Maim and Mend II: +30%. No Direct Hit before 4.0.
      this.stats = { hp: 19500, mainStat: 'mnd', main: 1598, int: 250, jobMod: 115, trait: 130, wd: 115, det: 576, crit: 1024, dh: 354, speed: 887, delay: 3.44 };
      this.speedName = 'Spell speed';
      this.tierHaste = 0;
      this.selfStatusOrder = ['clericStance', 'presenceOfMind', 'swiftcast', 'shroudOfSaints', 'divineSeal', 'medicated', 'surecast', 'sprint'];
      this.targetStatusOrder = ['aero3', 'aero2', 'aero'];
      this.defaultBars = [
        ['stone3', 'aero', 'aero2', 'aero3', 'clericStance', 'assize', 'presenceOfMind', 'swiftcast', 'shroudOfSaints', 'fluidAura', 'tincture', 'holy'],
        ['cure', 'cure2', 'medica', 'medica2', 'regen', 'tetragrammaton', 'benediction', 'asylum', 'divineSeal', 'stone2', 'surecast', 'sprint'],
        [null, null, null, null, null, null, null, null, null, null, null, null],
      ];
      this.actionGroups = [
        ['White Mage', ['stone2', 'stone3', 'aero', 'aero2', 'aero3', 'holy', 'cure', 'cure2', 'medica', 'medica2', 'regen', 'clericStance', 'assize',
          'presenceOfMind', 'shroudOfSaints', 'fluidAura', 'divineSeal', 'tetragrammaton', 'benediction', 'asylum']],
        ['Cross-class', ['swiftcast', 'surecast']],
        ['General', ['sprint', 'tincture']],
      ];
      this.referenceDps = 1400;     // a scripted 3.5 rotation parses about 1,300 over 5 minutes, running out of MP
      this.referenceGcd = 2.29;
      this.startDistance = 12;
    }

    initGauge() { return {}; }
    resolveId(id) { return id; }
    check() { return null; }

    haste(e) { return e.has('presenceOfMind') ? 20 : 0; }
    castTime(id, e) {
      const a = this.actions[id];
      if (!a.cast) return 0;
      if (e.has('swiftcast')) return 0;
      return e.speedScale(a.cast, this.haste(e));
    }
    consumeInstant(id, e) { if (this.actions[id].cast && e.has('swiftcast')) e.removeStatus('swiftcast'); }
    mpCost(id) { return this.actions[id].mp || 0; }
    // 2% of the pool a tick, plus Shroud of Saints' Refresh (80: 707 MP).
    mpRegen(e) { return Math.round(this.maxMp * 0.02) + (e.has('shroudOfSaints') ? (this.shroudMp || 707) : 0); }

    snapshot(a, e) {
      let mult = 1;
      if (e.has('clericStance')) mult *= 1.10;
      const mind = this.stats.main + (e.has('medicated') ? (this.potionCap || 154) : 0);
      return { mult, main: e.has('clericStance') ? mind : this.stats.int, critAdd: 0 };
    }

    resolve(id, e) {
      const a = this.actions[id];
      if (a.mp) e.mp -= a.mp;
      switch (id) {
        case 'clericStance':
          if (e.has('clericStance')) e.removeStatus('clericStance');
          else e.addStatus('clericStance', 1e9, { permanent: true });
          return;
        case 'presenceOfMind': e.addStatus('presenceOfMind', this.pomDur || 15); return;
        case 'shroudOfSaints': e.addStatus('shroudOfSaints', 15); return;
        case 'divineSeal': e.addStatus('divineSeal', 15); return;
        case 'assize': {
          const before = e.mp;
          e.mp = Math.min(e.maxMp, e.mp + Math.round(e.maxMp * 0.1));
          e.emit('mpGain', { amount: e.mp - before, source: 'lucid' });
          break;
        }
        default:
          if (B.ROLE_EFFECTS[id]) { B.ROLE_EFFECTS[id](e); return; }
      }
      if (!a.potency) return;
      const snap = this.snapshot(a, e);
      const after = a.dot ? () => e.addTStatus(id, a.dot.duration, { snap, dot: { potency: a.dot.potency, id } }) : null;
      e.queueHit(id, a.potency, snap, a.delay, after);
    }

    proc(id, e) {
      if (id === 'clericStance') return !e.has('clericStance');
      return false;
    }

    speedInfo(e) { return `GCD ${e.gcdForSpeed(e.stats.speed).toFixed(2)}, ${e.gcdForSpeed(e.stats.speed, 20).toFixed(2)} in Presence of Mind · ${e.maxMp.toLocaleString()} MP · Heavensward's formula (no Direct Hit)`; }

    // ---------- the three Aeros (Heavensward had no job gauge) ----------
    gaugeDots() { return ['aero3', 'aero2', 'aero']; }
    gaugeBuild(root) {
      root.innerHTML = `
<svg width="360" height="130" viewBox="0 0 360 130">
  <rect x="8" y="10" width="344" height="110" rx="14" fill="rgba(14,12,20,.86)" stroke="rgba(255,255,255,.22)"/>
  ${this.gaugeDots().map(k => this.actions[k].name.toUpperCase()).map((t, k) => `<text x="24" y="${42 + k * 28}" font-family="Noto Sans, sans-serif" font-size="11" font-weight="600" fill="#a9a3b4" letter-spacing="1">${t}</text>
  <rect x="96" y="${32 + k * 28}" width="200" height="12" rx="6" fill="#2a2535" stroke="rgba(0,0,0,.8)"/>
  <rect id="wa-${k}" x="96" y="${32 + k * 28}" width="0" height="12" rx="6" fill="#7fd7b0"/>`).join('')}
  <text id="wa-cs" x="336" y="42" text-anchor="end" font-family="Noto Sans, sans-serif" font-size="11" font-weight="600" fill="#ffd27a"></text>
</svg>`;
      const $ = (s) => root.querySelector(s);
      this.wg = { b: this.gaugeDots().map((x, k) => $('#wa-' + k)), cs: $('#wa-cs'), cache: {} };
    }

    gaugeUpdate(e) {
      const G = this.wg, c = G.cache;
      this.gaugeDots().forEach((k, i) => {
        const s = e.tStatuses[k], left = s ? Math.max(0, s.until - e.now) : 0, dur = this.actions[k].dot.duration;
        const v = Math.round(left * 4);
        if (c[k] !== v) { c[k] = v; G.b[i].setAttribute('width', (200 * Math.min(1, left / dur)).toFixed(1)); G.b[i].setAttribute('fill', left > 0 && left < 4 ? '#ff8f6b' : '#7fd7b0'); }
      });
      const cs = e.has('clericStance') ? 'CLERIC' : '';
      if (c.cs !== cs) { c.cs = cs; G.cs.textContent = cs; }
    }

    helpHtml(seq) {
      return `
<h3>How it plays (Heavensward 3.0–3.57)</h3>
<p>Level 60 White Mage on a dummy. Healer gear had no Intelligence, so damage needs <b>Cleric Stance</b>: it swaps your Mind into Intelligence (+10% attack magic, −20% healing). Fill with <b>Stone III</b> (210, 2.5s) and keep all three Aeros up at once: <b>Aero III</b> (50 + 40 × 24s, a 3.0s cast and GCD), <b>Aero II</b> (50 + 50 × 12s, 2.5s) and <b>Aero</b> (50 + 25 × 18s, instant, also for moving).</p>
<p><b>Assize</b> (90s) hits for 300 and gives back 10% MP; <b>Presence of Mind</b> (150s) makes casts and the GCD 20% faster for 15s; Swiftcast goes on Aero III. MP is the limit over a long fight: <b>Shroud of Saints</b> (120s) gives about 3,500 back.</p>
<h3>The opener (the FFXIV wiki's Heavensward White Mage rotations)</h3>
${seq([['clericStance'], 'aero3', ['presenceOfMind'], ['tincture'], 'aero', ['assize'], ['fluidAura'], 'aero2', 'stone3', 'stone3', 'stone3', 'stone3', 'stone3', 'aero2', 'aero', 'stone3', ['swiftcast'], 'aero3'])}
<p>Cleric Stance before the pull; refresh each Aero as it runs out.</p>
<p style="color:#a9a3b4">The 3.57 numbers: Stone III 210, Aero 50 + 25 × 18s, Aero II 50 + 50 × 12s, Aero III 50 + 40 × 24s, Holy 200, Assize 300, Fluid Aura 150, Cleric Stance +10%. Heavensward's formula is the community fit; the MP pool is fitted to 2016 profiles. Gear: an Alexander: Creator set (Mind 1,598, 115 magic damage) with the Supramax-Potion of Mind.</p>`;
    }
  }

  B.WhiteMageHW = WhiteMageHW;
  B.registerJob({
    id: 'whm', name: 'White Mage', abbr: 'WHM', role: 'healer', classJob: 24,
    versions: [{ id: 'hw30', label: 'Heavensward 3.0–3.57', history: 'HW 3.0–3.57', note: 'Level 60: Cleric Stance swaps Mind into Intelligence; Stone III and three Aeros at once, Assize, Presence of Mind; Creator gear', create: () => new WhiteMageHW() }],
  });
})(window.BLM);
