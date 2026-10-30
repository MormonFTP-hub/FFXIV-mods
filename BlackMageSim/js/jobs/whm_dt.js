// White Mage, Dawntrail at level 100, in three versions:
//  - 7.0–7.05: Glare III 330, Afflatus Misery 1,320, Dia 75 (7.05), Holy III a 2.5s cast; Grade 2 Gemdraughts.
//  - 7.1–7.38: Holy and Holy III 1.5s casts, Glare III 340, Misery 1,360, Dia 85 (80 in 7.2, 85 in 7.3); Grade 3.
//  - 7.4–7.57: Glare III 350, Misery 1,400; duties start with three Lilies and the Blood Lily in bloom; Grade 4.
// The kit: Glare III (1.5s) as filler, Dia (a 30s DoT whose hit and ticks are the same potency), Presence of Mind (20%
// faster casts and three Sacred Sight stacks for Glare IV, 640), Assize, and the Lilies: one every 20s, and three
// Lily heals bloom the Blood Lily for Afflatus Misery. Thin Air makes the next MP spell free. Numbers are the game
// data per patch (xivapi), the Lodestone notes and the wiki; the gear is The Balance's set for each tier.
(function (B) {
  const spell = (o) => Object.assign({ kind: 'gcd', target: true, range: 25, delay: 0.8, school: 'holy', sound: 'paradox' }, o);
  const heal = (o) => Object.assign({ kind: 'gcd', potency: 0, school: 'holy', sound: 'paradox' }, o);
  const ab = (o) => Object.assign({ kind: 'ogcd' }, o);
  const LILY_TIME = 20;

  // Gear: The Balance's sets for each tier, food included, without the 5% party bonus. ref: a scripted bot parses about
  // 14,600 / 18,400 / 24,200 over 5 minutes on these.
  const VERSIONS = {
    dt70: { label: 'Dawntrail 7.0–7.05', history: 'DT 7.0–7.05', glare: 330, misery: 1320, dia: 75, holyCast: 2.5, startFull: false, tincture: 'mnddt2', ref: 15500,
      stats: { hp: 95000, main: 4778, wd: 146, det: 2787, crit: 3124, dh: 1212, speed: 528, piety: 626 },
      note: 'Level 100. Glare IV from Presence of Mind\'s Sacred Sight, Glare III 330, Misery 1,320, Dia 75, a 2.5s Holy III; Light-heavyweight gear' },
    dt71: { label: 'Dawntrail 7.1–7.38', history: 'DT 7.1–7.38', glare: 340, misery: 1360, dia: 85, holyCast: 1.5, startFull: false, tincture: 'mnddt3', ref: 19500,
      stats: { hp: 105000, main: 5646, wd: 152, det: 2510, crit: 3427, dh: 1230, speed: 704, piety: 718 },
      note: 'Level 100. Holy and Holy III 1.5s casts, Glare III 340, Misery 1,360, Dia 85; Cruiserweight gear' },
    dt74: { label: 'Dawntrail 7.4–7.57', history: 'DT 7.4–7.57', glare: 350, misery: 1400, dia: 85, holyCast: 1.5, startFull: true, tincture: 'mnddt4', ref: 25650,
      stats: { hp: 115000, main: 6515, wd: 158, det: 2807, crit: 3401, dh: 1014, speed: 1143, piety: 588 },
      note: 'Level 100. Glare III 350, Misery 1,400; duties start with three Lilies and the Blood Lily in bloom; Confession −10% damage taken; Heavyweight gear' },
  };

  function buildActions(V) {
    return {
      glare3: spell({ name: 'Glare III', potency: V.glare, cast: 1.5, mp: 400, orb: true, desc: `Deals unaspected damage with a potency of ${V.glare}.` }),
      glare4: spell({ name: 'Glare IV', potency: 640, mp: 0, aoe: 0.6, sight: true, fx: 'gnbZone', desc: 'Deals unaspected damage to target and all enemies nearby it with a potency of 640 for the first enemy, and 40% less for all remaining enemies.\nCan only be executed while under the effect of Sacred Sight.' }),
      dia: spell({ name: 'Dia', potency: V.dia, mp: 400, dot: { potency: V.dia, duration: 30 }, sound: 'dot', desc: `Deals unaspected damage with a potency of ${V.dia}.\nAdditional Effect: Unaspected damage over time\nPotency: ${V.dia}\nDuration: 30s` }),
      afflatusMisery: spell({ name: 'Afflatus Misery', potency: V.misery, mp: 0, aoe: 0.5, blood: true, fx: 'gnbDouble', desc: `Deals unaspected damage to target and all enemies nearby it with a potency of ${V.misery} for the first enemy, and 50% less for all remaining enemies.\nCan only be executed while the Blood Lily is in full bloom.` }),
      holy3: spell({ name: 'Holy III', potency: 150, cast: V.holyCast, mp: 400, target: false, pbaoe: 8, aoe: true, desc: 'Deals unaspected damage with a potency of 150 to all nearby enemies.\nAdditional Effect: Stun\nDuration: 4s' }),
      afflatusSolace: heal({ name: 'Afflatus Solace', lily: true, desc: 'Restores target\'s HP.\nCure Potency: 800\nLily Cost: 1\nAdditional Effect: Nourishes the Blood Lily' }),
      afflatusRapture: heal({ name: 'Afflatus Rapture', lily: true, desc: 'Restores own HP and the HP of all party members within a radius of 20 yalms.\nCure Potency: 400\nLily Cost: 1\nAdditional Effect: Nourishes the Blood Lily' }),
      medica3: heal({ name: 'Medica III', cast: 2, mp: 1000, desc: 'Restores own HP and the HP of all party members within a radius of 20 yalms.\nCure Potency: 250\nAdditional Effect: Regen\nCure Potency: 175\nDuration: 15s' }),
      cure2: heal({ name: 'Cure II', cast: 2, mp: 1000, desc: 'Restores target\'s HP.\nCure Potency: 800' }),
      cure3: heal({ name: 'Cure III', cast: 2, mp: 1500, desc: 'Restores HP of target and all party members nearby target.\nCure Potency: 600' }),
      regen: heal({ name: 'Regen', mp: 400, desc: 'Grants healing over time effect to target.\nCure Potency: 250\nDuration: 18s' }),
      assize: ab({ name: 'Assize', recast: 40, potency: 400, target: false, pbaoe: 15, aoe: true, delay: 0.6, fx: 'gnbBow', desc: 'Deals unaspected damage with a potency of 400 to all nearby enemies.\nAdditional Effect: Restores own HP and the HP of all nearby party members\nCure Potency: 400\nAdditional Effect: Restores 5% of maximum MP' }),
      presenceOfMind: ab({ name: 'Presence of Mind', recast: 120, desc: 'Reduces spell cast time and recast time, and auto-attack delay by 20%.\nDuration: 15s\nAdditional Effect: Grants 3 stacks of Sacred Sight\nDuration: 30s' }),
      thinAir: ab({ name: 'Thin Air', recast: 60, charges: 2, desc: 'Next action is executed without MP cost.\nDuration: 12s\nMaximum Charges: 2' }),
      temperance: ab({ name: 'Temperance', recast: 120, desc: 'Increases healing magic potency by 20%, while reducing damage taken by self and all party members within a radius of 50 yalms by 10%.\nDuration: 20s\nAdditional Effect: Grants Divine Grace\nDuration: 30s' }),
      divineCaress: ab({ name: 'Divine Caress', recast: 1, desc: 'Grants Divine Caress to self and all party members within a radius of 30 yalms, nullifying damage equal to a heal of 400 potency.\nCan only be executed while under the effect of Divine Grace.' }),
      plenaryIndulgence: ab({ name: 'Plenary Indulgence', recast: 60, desc: `Grants Confession to self and all party members within 20 yalms${V.startFull ? ', reducing damage taken by 10%' : ''}.\nDuration: 10s` }),
      tetragrammaton: ab({ name: 'Tetragrammaton', recast: 60, charges: 2, desc: 'Restores target\'s HP.\nCure Potency: 700\nMaximum Charges: 2' }),
      divineBenison: ab({ name: 'Divine Benison', recast: 30, charges: 2, desc: 'Creates a barrier around target that absorbs damage equivalent to a heal of 500 potency.\nDuration: 15s\nMaximum Charges: 2' }),
      asylum: ab({ name: 'Asylum', recast: 90, desc: 'Envelops a designated area in a veil of succor, granting healing over time.\nDuration: 24s' }),
      benediction: ab({ name: 'Benediction', recast: 180, desc: 'Restores all of a target\'s HP.' }),
      aquaveil: ab({ name: 'Aquaveil', recast: 60, desc: 'Reduces damage taken by a party member or self by 15%.\nDuration: 8s' }),
      liturgyOfTheBell: ab({ name: 'Liturgy of the Bell', recast: 180, desc: 'Places the Liturgic Bell at the specified location.\nDuration: 20s' }),
      aetherialShift: ab({ name: 'Aetherial Shift', recast: 60, desc: 'Dash 15 yalms forward.' }),
      // The healer role actions.
      swiftcast: ab({ name: 'Swiftcast', recast: 40, role: true, desc: 'Next spell is cast immediately.\nDuration: 10s' }),     // 40s: Enhanced Swiftcast
      lucidDreaming: ab({ name: 'Lucid Dreaming', recast: 60, role: true, desc: 'Gradually restores MP.\nPotency: 55\nDuration: 21s' }),
      surecast: ab({ name: 'Surecast', recast: 120, role: true, desc: 'Spells can be cast without interruption.\nDuration: 6s' }),
      rescue: ab({ name: 'Rescue', recast: 120, role: true, desc: 'Instantly draws target party member to your side.' }),
      esuna: heal({ name: 'Esuna', cast: 1, mp: 400, role: true, desc: 'Removes a single detrimental effect from target.' }),
      repose: spell({ name: 'Repose', potency: 0, cast: 2.5, mp: 600, role: true, desc: 'Puts target to sleep.\nDuration: 30s' }),
      ...B.GENERAL_ACTIONS,
      tincture: B.tincture(V.tincture),
      auto: { name: 'Attack', kind: 'auto', fx: 'auto', desc: 'Auto-attack.' },
    };
  }

  const STATUSES = {
    presenceOfMind: { name: 'Presence of Mind', self: true, icon: 'st_pom' },
    sacredSight: { name: 'Sacred Sight', self: true, icon: 'st_sight' },
    thinAir: { name: 'Thin Air', self: true, icon: 'st_thinair' },
    temperance: { name: 'Temperance', self: true, icon: 'st_temperance' },
    divineGrace: { name: 'Divine Grace', self: true, icon: 'st_grace' },
    confession: { name: 'Confession', self: true, icon: 'st_confession' },
    aquaveil: { name: 'Aquaveil', self: true, icon: 'st_aquaveil' },
    swiftcast: { name: 'Swiftcast', self: true, icon: 'st_swiftcast' },
    lucidDreaming: { name: 'Lucid Dreaming', self: true, icon: 'st_lucid' },
    surecast: { name: 'Surecast', self: true, icon: 'st_surecast' },
    dia: { name: 'Dia', self: false, icon: 'st_dia' },
  };

  class WhiteMageDT {
    constructor(version) {
      const V = VERSIONS[version];
      this.V = V;
      this.name = 'White Mage';
      this.abbr = 'WHM';
      this.role = 'healer';
      this.level = 100;
      this.levelKey = 100;
      this.model = 'whm-dt';
      this.maxMp = 10000;
      this.actions = buildActions(V);
      this.statuses = STATUSES;
      // Maim and Mend II: +30% to the healer's damage.
      this.stats = Object.assign({ mainStat: 'mnd', jobMod: 115, trait: 130, delay: 3.44 }, V.stats);
      this.speedName = 'Spell speed';
      this.tierHaste = 0;
      this.selfStatusOrder = ['presenceOfMind', 'sacredSight', 'thinAir', 'swiftcast', 'medicated', 'lucidDreaming', 'temperance', 'divineGrace',
        'confession', 'aquaveil', 'surecast', 'sprint'];
      this.targetStatusOrder = ['dia'];
      this.defaultBars = [
        ['glare3', 'dia', 'glare4', 'afflatusMisery', 'afflatusSolace', 'afflatusRapture', 'assize', 'presenceOfMind', 'thinAir', 'lucidDreaming', 'swiftcast', 'tincture'],
        ['holy3', 'medica3', 'cure2', 'cure3', 'regen', 'tetragrammaton', 'divineBenison', 'aquaveil', 'benediction', 'asylum', 'temperance', 'plenaryIndulgence'],
        ['liturgyOfTheBell', 'divineCaress', 'aetherialShift', 'surecast', 'rescue', 'esuna', 'repose', 'sprint', null, null, null, null],
      ];
      this.actionGroups = [
        ['White Mage', ['glare3', 'glare4', 'dia', 'afflatusMisery', 'holy3', 'afflatusSolace', 'afflatusRapture', 'medica3', 'cure2', 'cure3', 'regen',
          'assize', 'presenceOfMind', 'thinAir', 'temperance', 'divineCaress', 'plenaryIndulgence', 'tetragrammaton', 'divineBenison', 'asylum',
          'benediction', 'aquaveil', 'liturgyOfTheBell', 'aetherialShift']],
        ['Role Actions', ['swiftcast', 'lucidDreaming', 'surecast', 'rescue', 'esuna', 'repose']],
        ['General', ['sprint', 'tincture']],
      ];
      this.referenceDps = V.ref;
      this.referenceGcd = 2.48;
      this.startDistance = 12;
    }

    // 7.4 starts duties with three Lilies and the Blood Lily in bloom.
    initGauge() {
      const full = this.V.startFull;
      return { lilies: full ? 3 : 0, blood: full ? 3 : 0, lilyAt: null };
    }

    check(id, e) {
      const a = this.actions[id], g = e.g;
      if (a.sight && !e.has('sacredSight')) return 'Unable to execute action. Sacred Sight required.';
      if (a.blood && g.blood < 3) return 'Unable to execute action. The Blood Lily is not in full bloom.';
      if (a.lily && g.lilies < 1) return 'Unable to execute action. No Lilies.';
      if (id === 'divineCaress' && !e.has('divineGrace')) return 'Unable to execute action.';
      return null;
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
      return mp && e.has('thinAir') ? 0 : mp;
    }
    // 200 a tick plus Piety's share; Lucid Dreaming's 550 comes on the DoT tick.
    mpRegen() { return 200 + Math.floor(150 * (this.stats.piety - 440) / 2780); }
    lucidGain() { return B.LUCID_REGEN; }

    snapshot(a, e) {
      const main = this.stats.main + (e.has('medicated') ? B.TINCTURES[this.V.tincture].cap : 0);
      return { mult: 1, main };
    }

    resolve(id, e) {
      const a = this.actions[id], g = e.g;
      if (a.kind === 'gcd') {
        const cost = this.mpCost(id, e);
        if (cost > 0) e.mp -= cost;
        else if (a.mp && e.has('thinAir')) e.removeStatus('thinAir');
      }
      switch (id) {
        case 'glare4': {
          const s = e.statuses.sacredSight;
          s.stacks = (s.stacks || 1) - 1;
          if (s.stacks <= 0) e.removeStatus('sacredSight'); else e.emit('statusStack', { key: 'sacredSight' });
          break;
        }
        case 'afflatusMisery': g.blood = 0; e.emit('lilies', {}); break;
        case 'afflatusSolace': case 'afflatusRapture':
          g.lilies--; if (g.blood < 3) g.blood++;
          e.emit('lilies', {});
          break;
        case 'assize': {
          const before = e.mp;
          e.mp = Math.min(e.maxMp, e.mp + 500);
          if (e.mp > before) e.emit('mpGain', { amount: e.mp - before, source: 'manafont' });
          break;
        }
        case 'presenceOfMind': e.addStatus('presenceOfMind', 15); e.addStatus('sacredSight', 30, { stacks: 3 }); break;
        case 'thinAir': e.addStatus('thinAir', 12); break;
        case 'temperance': e.addStatus('temperance', 20); e.addStatus('divineGrace', 30); break;
        case 'divineCaress': e.removeStatus('divineGrace'); break;
        case 'plenaryIndulgence': e.addStatus('confession', 10); break;
        case 'aquaveil': e.addStatus('aquaveil', 8); break;
        case 'aetherialShift': {
          const from = { x: e.pos.x, z: e.pos.z };
          const d = Math.hypot(e.pos.x, e.pos.z) || 1;
          const step = Math.min(15, Math.max(0, d - 2.4));
          e.pos.x -= e.pos.x / d * step; e.pos.z -= e.pos.z / d * step;
          e.emit('teleport', { from, to: { x: e.pos.x, z: e.pos.z } });
          break;
        }
        default:
          if (B.ROLE_EFFECTS[id]) B.ROLE_EFFECTS[id](e);
      }
      if (a.potency) {
        const snap = this.snapshot(a, e);
        const after = a.dot ? () => e.addTStatus(id, a.dot.duration, { snap, dot: { potency: a.dot.potency, id } }) : null;
        e.queueHit(id, a.potency, snap, a.delay, after);
      }
    }

    // A Lily every 20s in combat, up to three.
    nextEvent(e) {
      const g = e.g;
      if (!e.inCombat) return Infinity;
      if (g.lilyAt === null) g.lilyAt = e.now + LILY_TIME;
      return g.lilyAt;
    }
    process(e) {
      const g = e.g;
      if (e.inCombat && g.lilyAt !== null && e.now >= g.lilyAt - 1e-6) {
        g.lilyAt += LILY_TIME;
        if (g.lilies < 3) { g.lilies++; e.emit('lilies', {}); }
      }
    }

    proc(id, e) {
      const a = this.actions[id], g = e.g;
      if (a.sight) return e.has('sacredSight');
      if (a.blood) return g.blood >= 3;
      return false;
    }

    speedInfo(e) { return `GCD ${e.gcdForSpeed(e.stats.speed).toFixed(2)} · ${e.gcdForSpeed(e.stats.speed, 20).toFixed(2)} under Presence of Mind · ${e.maxMp.toLocaleString()} MP`; }

    // ---------- the Healing Gauge: Lilies and the Blood Lily ----------
    gaugeBuild(root) {
      const lily = (x, id) => `<path id="${id}" d="M0 -16 C8 -8 8 6 0 14 C-8 6 -8 -8 0 -16 Z" transform="translate(${x} 78)" fill="#1d2a26" stroke="rgba(255,255,255,.3)" stroke-width="1.5"/>`;
      root.innerHTML = `
<svg width="360" height="130" viewBox="0 0 360 130">
  <rect x="8" y="10" width="344" height="110" rx="14" fill="rgba(14,12,20,.86)" stroke="rgba(255,255,255,.22)"/>
  <text x="24" y="38" font-family="Noto Sans, sans-serif" font-size="11" font-weight="600" fill="#a9a3b4" letter-spacing="1">LILIES</text>
  ${lily(50, 'wh-l0')}${lily(90, 'wh-l1')}${lily(130, 'wh-l2')}
  <rect x="34" y="104" width="112" height="5" rx="2.5" fill="#1d1a2a"/><rect id="wh-t" x="34" y="104" width="0" height="5" rx="2.5" fill="#bfe8ff"/>
  <text x="200" y="38" font-family="Noto Sans, sans-serif" font-size="11" font-weight="600" fill="#a9a3b4" letter-spacing="1">BLOOD LILY</text>
  ${[0, 1, 2].map(k => `<circle id="wh-b${k}" cx="${230 + k * 36}" cy="78" r="12" fill="#2a1d24" stroke="rgba(255,255,255,.3)" stroke-width="1.5"/>`).join('')}
</svg>`;
      const $ = (s) => root.querySelector(s);
      this.wg = { l: [0, 1, 2].map(k => $('#wh-l' + k)), b: [0, 1, 2].map(k => $('#wh-b' + k)), t: $('#wh-t'), cache: {} };
    }

    gaugeUpdate(e) {
      const G = this.wg, c = G.cache, g = e.g;
      const put = (k, v, fn) => { if (c[k] !== v) { c[k] = v; fn(v); } };
      for (let i = 0; i < 3; i++) put('l' + i, g.lilies > i, v => G.l[i].setAttribute('fill', v ? '#9fe0ff' : '#1d2a26'));
      for (let i = 0; i < 3; i++) put('b' + i, g.blood > i, v => G.b[i].setAttribute('fill', v ? (g.blood >= 3 ? '#ff4a6a' : '#c03a5a') : '#2a1d24'));
      const prog = e.inCombat && g.lilyAt !== null && g.lilies < 3 ? 1 - (g.lilyAt - e.now) / LILY_TIME : 0;
      put('t', Math.round(prog * 50), () => G.t.setAttribute('width', String(112 * Math.max(0, Math.min(1, prog)))));
    }

    helpHtml(seq) {
      const V = this.V;
      const opener = V.startFull
        ? seq(['glare3', 'dia', ['tincture'], 'glare3', 'glare3', ['presenceOfMind'], 'glare4', ['assize'], 'afflatusMisery', 'glare4', 'glare4', 'glare3', 'glare3', 'glare3', 'glare3', 'glare3', 'dia'])
        : seq(['glare3', 'dia', ['tincture'], 'glare3', 'glare3', ['presenceOfMind'], 'glare4', ['assize'], 'glare4', 'glare3', 'glare3', 'glare3', 'glare3', 'glare3', 'glare3', 'glare4', 'dia']);
      return `
<h3>How it plays (${V.label})</h3>
<p>Level 100 White Mage on a dummy. Fill with <b>Glare III</b> (${V.glare}, a 1.5s cast) and keep <b>Dia</b> up (${V.dia} on hit and ${V.dia} a tick for 30s). <b>Presence of Mind</b> (120s) makes casts and the GCD 20% faster for 15s and gives three <b>Sacred Sight</b> stacks: each turns into an instant <b>Glare IV</b> (640). <b>Assize</b> (400, 40s) also gives back 500 MP.</p>
<p>A <b>Lily</b> grows every 20s in combat, up to three. <b>Afflatus Solace</b> or <b>Rapture</b> spends one, and three of them bloom the <b>Blood Lily</b> for <b>Afflatus Misery</b> (${V.misery.toLocaleString()}). Three Lily heals and a Misery take four GCDs, the same as four Glare IIIs, so the Lilies cost nothing; spend six every two minutes for a Misery each minute.${V.startFull ? ' From 7.4 you start with three Lilies and the Blood Lily already in bloom.' : ''} <b>Thin Air</b> (2 charges) makes the next MP spell free; <b>Lucid Dreaming</b> covers the rest.</p>
<h3>The opener (The Balance)</h3>
${opener}
<p>Glare III about 2.3s before the pull. ${V.startFull ? 'In 7.4 the opening Misery is already there.' : 'In 7.0–7.3 there\'s no Misery in the opener: the Lilies start empty.'}</p>
<p style="color:#a9a3b4">${V.label} numbers: Glare III ${V.glare}, Glare IV 640, Dia ${V.dia} + ${V.dia} × 30s, Afflatus Misery ${V.misery.toLocaleString()}, Assize 400, Holy III 150 (${V.holyCast}s cast), Maim and Mend II +30%. Gear is The Balance's ${V.stats.main.toLocaleString()} Mind set for the tier (without the 5% party bonus), with its Gemdraught.</p>`;
    }
  }

  B.WhiteMageDT = WhiteMageDT;
  B.registerJob({
    id: 'whm', name: 'White Mage', abbr: 'WHM', role: 'healer', classJob: 24,
    versions: ['dt74', 'dt71', 'dt70'].map(v => ({ id: v, label: VERSIONS[v].label, history: VERSIONS[v].history, note: VERSIONS[v].note, create: () => new WhiteMageDT(v) })),
  });
})(window.BLM);
