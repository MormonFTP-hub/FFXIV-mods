// White Mage, Stormblood (4.0–4.58) at level 70, in four versions. The damage kit didn't change: Stone IV (250, 2.5s)
// as filler, two DoTs at once (Aero II, instant, 50 + 50 × 18s; Aero III, 2.5s, 50 + 40 × 24s, around the target),
// Holy, Assize (+10% MP), Presence of Mind (20% faster casts) and Thin Air (free spells); Cleric Stance is a role
// action (+5% for 15s, every 90s), and DoTs keep it if cast inside. The Healing Gauge holds up to three Lilies, from
// Cures that restore HP (none on a dummy at full HP): Asylum, Assize, Divine Benison or Tetragrammaton spend them all
// for 4 / 10 / 20% off their recast. What the versions change:
//  - 4.0–4.01: Cure gives a Lily half the time; Divine Benison needs one; Plenary Indulgence v1 (15s). i320 gear.
//  - 4.05–4.18: every Cure and Cure II gives a Lily; Plenary Indulgence reworked (Confession from Medicas, 60s). i340.
//  - 4.2–4.45: Divine Benison no longer needs a Lily; 4.4 Asylum acts at once. Alphascape gear.
//  - 4.5–4.58: Assize 400 on a 45s recast; Confession lasts 30s.
// Numbers are the game data at 4.11, 4.2, 4.5 and 4.58 (xivapi's datamining; none before 4.11), the 2017 job guide
// (Wayback) and the Lodestone notes; gear is each tier's healing set from the pre-6.0 item data. No Stormblood White Mage
// opener survives, so the one in the help is built from the version's rules. ref: a scripted bot parses about
// 2,730 / 3,120 / 4,450 / 4,720 (4.0, 4.05, 4.2, 4.5) over 5 minutes; Alphascape gear runs low on MP after that.
(function (B) {
  const FALLOFF = [1, 0.9, 0.8, 0.7, 0.6, 0.5];
  // Stormblood MP at level 70: 124% (White Mage's modifier) of 12,000 plus 6,000 × (Piety − 292) / 2,170.
  const maxMpFor = (piety) => Math.floor(1.24 * (6000 * (piety - 292) / 2170 + 12000));
  const GEAR = {
    i320: { hp: 22100, main: 2276, wd: 131, det: 1314, crit: 1419, dh: 364, speed: 1216, piety: 1265,
      name: 'an i320 set: Genta of Healing with Lakshmi\'s accessories and Susano\'s Cane (Mind 2,276, 131 magic damage)' },
    i340: { hp: 24700, main: 2519, wd: 135, det: 1303, crit: 1167, dh: 364, speed: 1517, piety: 1365,
      name: 'an i340 set: Genji of Healing (Deltascape Savage) with Augmented Lost Allagan pieces and the Genji Cane (Mind 2,519, 135 magic damage)' },
    i400: { hp: 33300, main: 3216, wd: 147, det: 1177, crit: 2271, dh: 364, speed: 1925, piety: 918,
      name: 'an i400 set: Omega of Healing (Alphascape Savage) with Augmented Scaevan pieces and the Omega Cane (Mind 3,216, 147 magic damage)' },
  };
  const VERSIONS = {
    sb45: { label: 'Stormblood 4.5–4.58', history: 'SB 4.5–4.58', gear: 'i400', assize: 400, assizeRecast: 45, lilyCure: 1, benisonLily: false, plenary: 60,
      confession: 30, tincture: 'mnd3sb', ref: 5010,
      note: 'Level 70: Assize 400 on 45s; Stone IV, Aero II and Aero III, Cleric Stance; Alphascape gear' },
    sb42: { label: 'Stormblood 4.2–4.45', history: 'SB 4.2–4.45', gear: 'i400', assize: 300, assizeRecast: 60, lilyCure: 1, benisonLily: false, plenary: 60,
      confession: 10, tincture: 'mnd3sb', ref: 4710,
      note: 'Level 70: as 4.05, Divine Benison without a Lily; 4.4 Asylum acts at once; Alphascape gear' },
    sb405: { label: 'Stormblood 4.05–4.18', history: 'SB 4.05–4.18', gear: 'i340', assize: 300, assizeRecast: 60, lilyCure: 1, benisonLily: true, plenary: 60,
      confession: 10, tincture: 'mnd1sb', ref: 3300,
      note: 'Level 70: Stone IV, Aero II and Aero III, Assize, Cleric Stance; every Cure gives a Lily; Plenary Indulgence rework; Deltascape gear' },
    sb40: { label: 'Stormblood 4.0–4.01', history: 'SB 4.0–4.01', gear: 'i320', assize: 300, assizeRecast: 60, lilyCure: 0.5, benisonLily: true, plenary: 15,
      confession: 30, tincture: 'mnd1sb', ref: 2890, early: true,
      note: 'Level 70, the launch: Stone IV, Aero II and Aero III, Assize on 60s, Cleric Stance as a role action; Lilies (50% from Cure) cut ability recasts; Plenary Indulgence v1' },
  };
  const LILY_USERS = { asylum: 1, assize: 1, divineBenison: 1, tetragrammaton: 1 };
  const LILY_CUT = [0, 0.04, 0.1, 0.2];

  const spell = (o) => Object.assign({ kind: 'gcd', target: true, range: 25, delay: 0.8, school: 'holy', sound: 'paradox' }, o);
  const heal = (o) => Object.assign({ kind: 'gcd', potency: 0, school: 'holy', sound: 'paradox' }, o);
  const ab = (o) => Object.assign({ kind: 'ogcd' }, o);

  function buildActions(V) {
    return {
      stone4: spell({ name: 'Stone IV', potency: 250, cast: 2.5, mp: 600, orb: true, desc: 'Deals earth damage with a potency of 250.' }),
      aero2: spell({ name: 'Aero II', potency: 50, mp: 600, dot: { potency: 50, duration: 18 }, sound: 'dot', school: 'wind',
        desc: 'Deals wind damage with a potency of 50.\nAdditional Effect: Wind damage over time\nPotency: 50\nDuration: 18s' }),
      aero3: spell({ name: 'Aero III', potency: 50, cast: 2.5, mp: 720, aoe: true, dot: { potency: 40, duration: 24, aoe: true }, school: 'wind',
        desc: 'Deals wind damage with a potency of 50 to target and all enemies nearby it.\nAdditional Effect: Wind damage over time\nPotency: 40\nDuration: 24s' }),
      holy: spell({ name: 'Holy', potency: 200, cast: 3, mp: 2400, target: false, pbaoe: 8, aoe: FALLOFF,
        desc: 'Deals unaspected damage with a potency of 200 to all nearby enemies, 10% less for each one after the first, down to 50%.\nAdditional Effect: Stun\nDuration: 4s' }),
      assize: ab({ name: 'Assize', recast: V.assizeRecast, potency: V.assize, target: false, pbaoe: 15, aoe: true, delay: 0.6, fx: 'gnbBow',
        desc: `Deals unaspected damage with a potency of ${V.assize} to all nearby enemies.\nAdditional Effect: Restores own HP and the HP of all nearby party members\nCure Potency: ${V.assize}\nAdditional Effect: Restores 10% of maximum MP` }),
      presenceOfMind: ab({ name: 'Presence of Mind', recast: 150, desc: 'Reduces spell cast time and recast time by 20%.\nDuration: 15s' }),
      thinAir: ab({ name: 'Thin Air', recast: 120, desc: 'Reduces MP cost of all actions to 0.\nDuration: 12s' }),
      cure: heal({ name: 'Cure', cast: 2, mp: 600, desc: `Restores target's HP.\nCure Potency: 450\nAdditional Effect: 15% chance next Cure II will cost no MP\nDuration: 15s\nSecret of the Lily: ${V.lilyCure < 1 ? 'a 50% chance to grant' : 'grants'} a Lily when it restores HP.` }),
      cure2: heal({ name: 'Cure II', cast: 2, mp: 1200, desc: 'Restores target\'s HP.\nCure Potency: 700\nSecret of the Lily: grants a Lily when it restores HP.' }),
      cure3: heal({ name: 'Cure III', cast: 2, mp: 2280, desc: 'Restores HP of target and all party members nearby target.\nCure Potency: 550' }),
      medica: heal({ name: 'Medica', cast: 2.5, mp: 1680, desc: 'Restores own HP and the HP of all nearby party members.\nCure Potency: 300' }),
      medica2: heal({ name: 'Medica II', cast: 3, mp: 2040, desc: 'Restores own HP and the HP of all nearby party members.\nCure Potency: 200\nAdditional Effect: Regen\nCure Potency: 50\nDuration: 30s' }),
      regen: heal({ name: 'Regen', mp: 840, desc: 'Grants healing over time effect to target.\nCure Potency: 150\nDuration: 21s' }),
      divineBenison: ab({ name: 'Divine Benison', recast: 30, lily: true, desc: `Creates a barrier around target that absorbs damage equal to 15% of their maximum HP.\nDuration: 15s${V.benisonLily ? '\nCan only be executed with a Lily. Consumes all Lilies, each one shortening the recast.' : ''}` }),
      tetragrammaton: ab({ name: 'Tetragrammaton', recast: 60, lily: true, desc: 'Restores target\'s HP.\nCure Potency: 700' }),
      asylum: ab({ name: 'Asylum', recast: 90, lily: true, desc: 'Envelops a designated area in a veil of succor, granting healing over time.\nCure Potency: 100\nDuration: 24s' }),
      benediction: ab({ name: 'Benediction', recast: 180, desc: 'Restores all of a target\'s HP.' }),
      plenaryIndulgence: ab({ name: 'Plenary Indulgence', recast: V.plenary, desc: V.early
        ? 'Party members healed by your Cure or Cure II have a 20% chance of Confession (up to 3 stacks, 30s). Plenary Indulgence heals for 400 / 500 / 600 by stacks.'
        : `Your Medica, Medica II and Cure III grant Confession (up to 3 stacks, ${V.confession}s). Plenary Indulgence heals for 150 / 300 / 450 by stacks.` }),
      fluidAura: ab({ name: 'Fluid Aura', recast: 30, target: true, range: 15, desc: 'Knocks the target back 15 yalms.\nAdditional Effect: Bind\nDuration: 6s' }),
      clericStance: ab({ name: 'Cleric Stance', recast: 90, role: true, desc: 'Increases attack magic potency by 5%.\nDuration: 15s' }),
      largesse: ab({ name: 'Largesse', recast: 90, role: true, desc: 'Increases healing magic potency by 20%.\nDuration: 20s' }),
      swiftcast: ab({ name: 'Swiftcast', recast: 60, role: true, desc: 'Next spell is cast immediately.\nDuration: 10s' }),
      lucidDreaming: ab({ name: 'Lucid Dreaming', recast: 120, role: true, desc: 'Reduces enmity by half.\nAdditional Effect: Refresh\nPotency: 80\nDuration: 21s' }),
      surecast: ab({ name: 'Surecast', recast: 30, role: true, desc: V.early ? 'Next spell is cast without interruption.\nAdditional Effect: Nullifies most knockback and draw-in effects\nDuration: 10s' : 'Spells can be cast without interruption.\nDuration: 5s' }),
      ...B.GENERAL_ACTIONS,
      tincture: B.tincture(V.tincture),
    };
  }

  const STATUSES = {
    aero2: { name: 'Aero II', self: false, icon: 'st_aero2' },
    aero3: { name: 'Aero III', self: false, icon: 'st_aero3' },
    clericStance: { name: 'Cleric Stance', self: true, icon: 'st_cleric' },
    presenceOfMind: { name: 'Presence of Mind', self: true, icon: 'st_pom' },
    thinAir: { name: 'Thin Air', self: true, icon: 'st_thinair' },
    freecure: { name: 'Freecure', self: true, icon: 'st_freecure' },
    largesse: { name: 'Largesse', self: true, icon: 'st_largesse' },
    ...B.COMMON_STATUSES,
  };

  class WhiteMageSB {
    constructor(version) {
      const V = VERSIONS[version];
      const G = GEAR[V.gear];
      this.V = V;
      this.name = 'White Mage';
      this.abbr = 'WHM';
      this.role = 'healer';
      this.level = 70;
      this.levelKey = 'sb70';
      this.model = 'whm-hw';
      this.maxMp = maxMpFor(G.piety);
      this.actions = buildActions(V);
      this.statuses = STATUSES;
      // Maim and Mend II: +30% to the healer's damage.
      this.stats = Object.assign({ mainStat: 'mnd', jobMod: 115, trait: 130, delay: 3.44 }, G);
      this.speedName = 'Spell speed';
      this.tierHaste = 0;
      this.selfStatusOrder = ['clericStance', 'presenceOfMind', 'thinAir', 'swiftcast', 'medicated', 'lucidDreaming', 'freecure', 'largesse', 'surecast', 'sprint'];
      this.targetStatusOrder = ['aero2', 'aero3'];
      this.defaultBars = [
        ['stone4', 'aero2', 'aero3', 'holy', 'assize', 'presenceOfMind', 'thinAir', 'clericStance', 'swiftcast', 'lucidDreaming', 'tincture', 'largesse'],
        ['cure', 'cure2', 'cure3', 'medica', 'medica2', 'regen', 'tetragrammaton', 'divineBenison', 'benediction', 'asylum', 'plenaryIndulgence', 'fluidAura'],
        ['surecast', 'sprint', null, null, null, null, null, null, null, null, null, null],
      ];
      this.actionGroups = [
        ['White Mage', ['stone4', 'aero2', 'aero3', 'holy', 'assize', 'presenceOfMind', 'thinAir', 'cure', 'cure2', 'cure3', 'medica', 'medica2', 'regen',
          'tetragrammaton', 'divineBenison', 'benediction', 'asylum', 'plenaryIndulgence', 'fluidAura']],
        ['Role Actions', ['clericStance', 'swiftcast', 'lucidDreaming', 'largesse', 'surecast']],
        ['General', ['sprint', 'tincture']],
      ];
      this.referenceDps = V.ref;
      this.referenceGcd = { i320: 2.37, i340: 2.32, i400: 2.26 }[V.gear];
      this.startDistance = 12;
    }

    initGauge() { return { lilies: 0 }; }
    resolveId(id) { return id; }

    check(id, e) {
      const a = this.actions[id];
      if (id === 'divineBenison' && this.V.benisonLily && e.g.lilies < 1) return 'Unable to execute action. Lily required.';
      return a ? null : 'Unable to execute action.';
    }

    haste(e) { return e.has('presenceOfMind') ? 20 : 0; }
    castTime(id, e) {
      const a = this.actions[id];
      if (!a.cast) return 0;
      if (e.has('swiftcast')) return 0;
      return e.speedScale(a.cast, this.haste(e));
    }
    consumeInstant(id, e) { if (this.actions[id].cast && e.has('swiftcast')) e.removeStatus('swiftcast'); }
    mpCost(id, e) {
      const mp = this.actions[id].mp || 0;
      if (!mp || e.has('thinAir')) return 0;
      if (id === 'cure2' && e.has('freecure')) return 0;
      return mp;
    }
    mpRegen() { return Math.round(this.maxMp * 0.02); }
    lucidGain() { return 960; }

    snapshot(a, e) {
      const mult = e.has('clericStance') ? 1.05 : 1;
      const main = this.stats.main + (e.has('medicated') ? B.TINCTURES[this.V.tincture].cap : 0);
      return { mult, main };
    }

    resolve(id, e) {
      const a = this.actions[id], g = e.g;
      if (a.kind === 'gcd') {
        const cost = this.mpCost(id, e);
        if (cost > 0) e.mp -= cost;
        if (id === 'cure2' && e.has('freecure')) e.removeStatus('freecure');
      }
      // Secret of the Lily: only a Cure that restores HP grants one, so none at full HP.
      if ((id === 'cure' || id === 'cure2') && e.hp < e.maxHp && g.lilies < 3 && Math.random() < (id === 'cure' ? this.V.lilyCure : 1)) g.lilies++;
      // Spending all Lilies takes 4 / 10 / 20% off that action's recast.
      if (LILY_USERS[id] && g.lilies > 0) {
        const c = e.cds[a.cdGroup || id];
        if (c && c.nextAt !== null) c.nextAt -= c.recast * LILY_CUT[g.lilies];
        g.lilies = 0;
      }
      switch (id) {
        case 'cure': if (Math.random() < 0.15) e.addStatus('freecure', 15); break;
        case 'assize': {
          const before = e.mp;
          e.mp = Math.min(e.maxMp, e.mp + Math.round(e.maxMp * 0.1));
          if (e.mp > before) e.emit('mpGain', { amount: e.mp - before, source: 'manafont' });
          break;
        }
        case 'presenceOfMind': e.addStatus('presenceOfMind', 15); break;
        case 'thinAir': e.addStatus('thinAir', 12); break;
        case 'clericStance': e.addStatus('clericStance', 15); break;
        case 'largesse': e.addStatus('largesse', 20); break;
        default:
          if (B.ROLE_EFFECTS[id]) B.ROLE_EFFECTS[id](e);
      }
      if (a.potency) {
        const snap = this.snapshot(a, e);
        const after = a.dot ? () => e.addTStatus(id, a.dot.duration, { snap: Object.assign({}, snap), dot: { potency: a.dot.potency, id } }) : null;
        e.queueHit(id, a.potency, snap, a.delay, after);
      }
    }

    proc(id, e) {
      if (LILY_USERS[id]) return e.g.lilies >= 3;
      if (id === 'cure2') return e.has('freecure');
      return false;
    }

    speedInfo(e) { return `GCD ${e.gcdForSpeed(e.stats.speed).toFixed(2)} · ${e.gcdForSpeed(e.stats.speed, 20).toFixed(2)} under Presence of Mind · ${e.maxMp.toLocaleString()} MP`; }

    // ---------- the Healing Gauge: three Lilies, and the two Aeros ----------
    gaugeBuild(root) {
      root.innerHTML = `
<svg width="360" height="110" viewBox="0 0 360 110">
  <rect x="8" y="10" width="344" height="90" rx="14" fill="rgba(14,12,20,.86)" stroke="rgba(255,255,255,.22)"/>
  <text x="24" y="34" font-family="Noto Sans, sans-serif" font-size="11" font-weight="600" fill="#a9a3b4" letter-spacing="1">HEALING GAUGE</text>
  ${[0, 1, 2].map(k => `<path id="wg-l${k}" d="M${44 + k * 36},44 l10,14 l-10,14 l-10,-14 z" fill="#2a2535" stroke="rgba(255,255,255,.35)"/>`).join('')}
  <text id="wg-a2" x="180" y="56" font-family="Noto Sans, sans-serif" font-size="12" font-weight="700" fill="#9fe0b8"></text>
  <text id="wg-a3" x="180" y="80" font-family="Noto Sans, sans-serif" font-size="12" font-weight="700" fill="#9fe0b8"></text>
</svg>`;
      const $ = (s) => root.querySelector(s);
      this.wg = { l: [0, 1, 2].map(k => $('#wg-l' + k)), a2: $('#wg-a2'), a3: $('#wg-a3'), cache: {} };
    }

    gaugeUpdate(e) {
      const G = this.wg, c = G.cache, g = e.g;
      const put = (k, v, fn) => { if (c[k] !== v) { c[k] = v; fn(v); } };
      for (let i = 0; i < 3; i++) put('l' + i, g.lilies > i, v => G.l[i].setAttribute('fill', v ? '#9fe0ff' : '#2a2535'));
      const left = (k) => { const s = e.tStatuses[k]; return s && s.until > e.now ? Math.ceil(s.until - e.now) : 0; };
      put('a2', left('aero2'), v => { G.a2.textContent = v ? `AERO II  ${v}s` : 'AERO II  —'; });
      put('a3', left('aero3'), v => { G.a3.textContent = v ? `AERO III  ${v}s` : 'AERO III  —'; });
    }

    helpHtml(seq) {
      const V = this.V;
      return `
<h3>How it plays (${V.label})</h3>
<p>Level 70 White Mage. <b>Stone IV</b> (250, 2.5s) is the filler; keep two DoTs up: <b>Aero II</b> (instant, 50 + 50 × 18s) and <b>Aero III</b> (2.5s, 50 + 40 × 24s, around the target). <b>Cleric Stance</b> (+5% for 15s, every 90s) is a role action now; DoTs keep the bonus they were cast with, so refresh both Aeros inside it. <b>Assize</b> (${V.assize}, ${V.assizeRecast}s) also restores 10% of your MP; <b>Presence of Mind</b> makes casts 20% faster for 15s and <b>Thin Air</b> makes spells free for 12s.</p>
<p>The Healing Gauge's Lilies come from Cures that actually heal (${V.lilyCure < 1 ? 'Cure half the time, Cure II always' : 'Cure and Cure II'}), so a dummy at full HP gives none; spent on Assize they would take up to 20% off its recast.${V.benisonLily ? ' Divine Benison needs a Lily.' : ''}</p>
<h3>An opener (built from the version's rules; none survives)</h3>
${seq(['aero3', 'aero2', ['presenceOfMind'], ['assize'], 'stone4', 'stone4', 'stone4', 'stone4', 'stone4', 'stone4', 'stone4', 'aero2', ['thinAir'], ['lucidDreaming'], 'stone4', 'stone4', 'stone4', ['swiftcast'], 'aero3'])}
<p>The tincture at about −5s and Cleric Stance at −3.5s, then Aero III hardcast from −2.5s so it lands at the pull.</p>
<p style="color:#a9a3b4">Stone IV 250, Aero II 50 + 50 × 18s, Aero III 50 + 40 × 24s, Holy 200 (3s), Assize ${V.assize}. MP: ${this.maxMp.toLocaleString()} (Stormblood's Piety formula), 2% a tick, Lucid Dreaming's Refresh 80. Gear: ${GEAR[V.gear].name}.</p>`;
    }
  }

  B.registerJob({
    id: 'whm', name: 'White Mage', abbr: 'WHM', role: 'healer', classJob: 24,
    versions: ['sb45', 'sb42', 'sb405', 'sb40'].map(v => ({ id: v, label: VERSIONS[v].label, history: VERSIONS[v].history, note: VERSIONS[v].note, create: () => new WhiteMageSB(v) })),
  });
})(window.BLM);
