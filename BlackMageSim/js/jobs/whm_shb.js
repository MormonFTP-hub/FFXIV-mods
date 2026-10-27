// White Mage, Shadowbringers 5.0–5.58 at level 80. Glare (300, a 2.5s cast) as filler, Dia (120 + 60 a tick for 30s),
// Assize (400, 45s, 500 MP), and the 5.0 Lily rework: a Lily every 30s in combat, up to three, spent on Afflatus Solace
// or Rapture, and three of those bloom the Blood Lily for Afflatus Misery (900). Presence of Mind is 20% haste for 15s
// on a 150s recast (no Sacred Sight yet); Thin Air makes every spell free for 12s. The single-target damage didn't
// change in Shadowbringers; 5.2 only flattened Misery's AoE falloff to 25%. Numbers are the 5.58 game data and the
// Lodestone notes; gear is a reconstruction of The Balance's "Comfy Mid-Piety Relic 2.34 / 912 Piety" set, pre-6.0
// stats from the 5.58 Item.csv.
(function (B) {
  const spell = (o) => Object.assign({ kind: 'gcd', target: true, range: 25, delay: 0.8, school: 'holy', sound: 'paradox' }, o);
  const heal = (o) => Object.assign({ kind: 'gcd', potency: 0, school: 'holy', sound: 'paradox' }, o);
  const ab = (o) => Object.assign({ kind: 'ogcd' }, o);
  const LILY_TIME = 30;

  const ACTIONS = {
    glare: spell({ name: 'Glare', potency: 300, cast: 2.5, mp: 400, orb: true, desc: 'Deals unaspected damage with a potency of 300.' }),
    dia: spell({ name: 'Dia', potency: 120, mp: 400, dot: { potency: 60, duration: 30 }, sound: 'dot', desc: 'Deals unaspected damage with a potency of 120.\nAdditional Effect: Unaspected damage over time\nPotency: 60\nDuration: 30s' }),
    afflatusMisery: spell({ name: 'Afflatus Misery', potency: 900, mp: 0, aoe: 0.75, blood: true, fx: 'gnbDouble', desc: 'Deals unaspected damage to target and all enemies nearby it with a potency of 900 for the first enemy, and 25% less for all remaining enemies.\nCan only be executed when the Blood Lily is in full bloom.' }),
    holy: spell({ name: 'Holy', potency: 140, cast: 2.5, mp: 600, target: false, pbaoe: 8, aoe: true, desc: 'Deals unaspected damage with a potency of 140 to all nearby enemies.\nAdditional Effect: Stun\nDuration: 4s' }),
    afflatusSolace: heal({ name: 'Afflatus Solace', lily: true, desc: 'Restores target\'s HP.\nCure Potency: 700\nAdditional Effect: Nourishes the Blood Lily\nHealing Gauge Cost: 1 Lily' }),
    afflatusRapture: heal({ name: 'Afflatus Rapture', lily: true, desc: 'Restores own HP and the HP of all nearby party members.\nCure Potency: 300\nAdditional Effect: Nourishes the Blood Lily\nHealing Gauge Cost: 1 Lily' }),
    cure: heal({ name: 'Cure', cast: 1.5, mp: 400, desc: 'Restores target\'s HP.\nCure Potency: 450\nAdditional Effect: 15% chance next Cure II will cost no MP\nDuration: 15s' }),
    cure2: heal({ name: 'Cure II', cast: 2, mp: 1000, desc: 'Restores target\'s HP.\nCure Potency: 700' }),
    cure3: heal({ name: 'Cure III', cast: 2, mp: 1500, desc: 'Restores HP of target and all party members nearby target.\nCure Potency: 550' }),
    medica: heal({ name: 'Medica', cast: 2.5, mp: 1000, desc: 'Restores own HP and the HP of all nearby party members.\nCure Potency: 300' }),
    medica2: heal({ name: 'Medica II', cast: 2.5, mp: 1300, desc: 'Restores own HP and the HP of all nearby party members.\nCure Potency: 200\nAdditional Effect: Regen\nCure Potency: 100\nDuration: 15s' }),
    regen: heal({ name: 'Regen', mp: 500, desc: 'Grants healing over time effect to target.\nCure Potency: 200\nDuration: 18s' }),
    raise: heal({ name: 'Raise', cast: 8, mp: 2400, desc: 'Resurrects target to a weakened state.' }),
    assize: ab({ name: 'Assize', recast: 45, potency: 400, target: false, pbaoe: 15, aoe: true, delay: 0.6, fx: 'gnbBow', desc: 'Deals unaspected damage with a potency of 400 to all nearby enemies.\nAdditional Effect: Restores own HP and the HP of nearby party members\nCure Potency: 400\nAdditional Effect: Restores 5% of maximum MP' }),
    presenceOfMind: ab({ name: 'Presence of Mind', recast: 150, desc: 'Reduces spell cast time and recast time, and auto-attack delay by 20%.\nDuration: 15s' }),
    thinAir: ab({ name: 'Thin Air', recast: 120, desc: 'Reduces MP cost of all spells by 100%.\nDuration: 12s' }),
    temperance: ab({ name: 'Temperance', recast: 120, desc: 'Increases healing magic potency by 20%, while reducing damage taken by self and all party members within a radius of 30 yalms by 10%.\nDuration: 20s' }),
    plenaryIndulgence: ab({ name: 'Plenary Indulgence', recast: 60, desc: 'Grants Confession to self and nearby party members.\nUpon receiving HP recovery via Medica, Medica II, Cure III, or Afflatus Rapture cast by self, Confession triggers an additional healing effect.\nDuration: 10s' }),
    tetragrammaton: ab({ name: 'Tetragrammaton', recast: 60, desc: 'Restores target\'s HP.\nCure Potency: 700' }),
    divineBenison: ab({ name: 'Divine Benison', recast: 30, desc: 'Creates a barrier around self or target party member that absorbs damage equivalent to a heal of 500 potency.\nDuration: 15s' }),
    asylum: ab({ name: 'Asylum', recast: 90, desc: 'Envelops a designated area in a veil of succor, granting healing over time to self and any party members who enter.\nCure Potency: 100\nDuration: 24s' }),
    benediction: ab({ name: 'Benediction', recast: 180, desc: 'Restores all of a target\'s HP.' }),
    fluidAura: ab({ name: 'Fluid Aura', recast: 30, target: true, range: 15, desc: 'Binds target.\nDuration: 6s' }),
    // The healer role actions of 5.x.
    swiftcast: ab({ name: 'Swiftcast', recast: 60, role: true, desc: 'Next spell is cast immediately.\nDuration: 10s' }),
    lucidDreaming: ab({ name: 'Lucid Dreaming', recast: 60, role: true, desc: 'Gradually restores own MP.\nPotency: 50\nDuration: 21s' }),
    surecast: ab({ name: 'Surecast', recast: 120, role: true, desc: 'Spells can be cast without interruption.\nAdditional Effect: Nullifies most knockback and draw-in effects\nDuration: 6s' }),
    rescue: ab({ name: 'Rescue', recast: 120, role: true, desc: 'Instantly draws target party member to your side.' }),
    esuna: heal({ name: 'Esuna', cast: 1, mp: 400, role: true, desc: 'Removes a single detrimental effect from target.' }),
    repose: spell({ name: 'Repose', potency: 0, cast: 2.5, mp: 600, role: true, desc: 'Afflicts target with Sleep.\nDuration: 30s' }),
    ...B.GENERAL_ACTIONS,
    tincture: B.tincture('mnd4'),
    auto: { name: 'Attack', kind: 'auto', fx: 'auto', desc: 'Auto-attack.' },
  };

  const STATUSES = {
    presenceOfMind: { name: 'Presence of Mind', self: true, icon: 'st_pom' },
    thinAir: { name: 'Thin Air', self: true, icon: 'st_thinair' },
    temperance: { name: 'Temperance', self: true, icon: 'st_temperance' },
    confession: { name: 'Confession', self: true, icon: 'st_confession' },
    swiftcast: { name: 'Swiftcast', self: true, icon: 'st_swiftcast' },
    lucidDreaming: { name: 'Lucid Dreaming', self: true, icon: 'st_lucid' },
    surecast: { name: 'Surecast', self: true, icon: 'st_surecast' },
    dia: { name: 'Dia', self: false, icon: 'st_dia' },
  };

  class WhiteMageShB {
    constructor() {
      this.name = 'White Mage';
      this.abbr = 'WHM';
      this.role = 'healer';
      this.level = 80;
      this.levelKey = 'shb80';
      this.model = 'whm-shb';
      this.maxMp = 10000;
      this.actions = ACTIONS;
      this.statuses = STATUSES;
      // Maim and Mend II: +30% to the healer's damage. Magic weapon damage 180 (item level 535).
      this.stats = { hp: 62000, main: 5560, mainStat: 'mnd', jobMod: 115, trait: 130, wd: 180, det: 1894, crit: 3324, dh: 2052, speed: 1929, piety: 912, delay: 3.44 };
      this.speedName = 'Spell speed';
      this.tierHaste = 0;
      this.selfStatusOrder = ['presenceOfMind', 'thinAir', 'swiftcast', 'medicated', 'lucidDreaming', 'temperance', 'confession', 'surecast', 'sprint'];
      this.targetStatusOrder = ['dia'];
      this.defaultBars = [
        ['glare', 'dia', 'afflatusMisery', 'afflatusSolace', 'afflatusRapture', 'assize', 'presenceOfMind', 'thinAir', 'lucidDreaming', 'swiftcast', 'tincture', 'holy'],
        ['cure', 'cure2', 'cure3', 'medica', 'medica2', 'regen', 'tetragrammaton', 'divineBenison', 'benediction', 'asylum', 'temperance', 'plenaryIndulgence'],
        ['raise', 'fluidAura', 'surecast', 'rescue', 'esuna', 'repose', 'sprint', null, null, null, null, null],
      ];
      this.actionGroups = [
        ['White Mage', ['glare', 'dia', 'afflatusMisery', 'holy', 'afflatusSolace', 'afflatusRapture', 'cure', 'cure2', 'cure3', 'medica', 'medica2', 'regen',
          'raise', 'assize', 'presenceOfMind', 'thinAir', 'temperance', 'plenaryIndulgence', 'tetragrammaton', 'divineBenison', 'asylum', 'benediction', 'fluidAura']],
        ['Role Actions', ['swiftcast', 'lucidDreaming', 'surecast', 'rescue', 'esuna', 'repose']],
        ['General', ['sprint', 'tincture']],
      ];
      this.referenceDps = 14730;     // a scripted 5.58 rotation on this gear parses about 13,890 on the dummy
      this.referenceGcd = 2.34;
      this.startDistance = 12;
    }

    initGauge() { return { lilies: 0, blood: 0, lilyAt: null }; }

    check(id, e) {
      const a = this.actions[id], g = e.g;
      if (a.blood && g.blood < 3) return 'Unable to execute action. The Blood Lily is not in full bloom.';
      if (a.lily && g.lilies < 1) return 'Unable to execute action. No Lilies.';
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

    mpCost(id, e) { return e.has('thinAir') ? 0 : (this.actions[id].mp || 0); }
    // 200 a tick plus Piety's share at level 80; Lucid Dreaming gives 500 a tick (50 potency).
    mpRegen() { return 200 + Math.floor(150 * (this.stats.piety - 340) / 3300); }
    lucidGain() { return 500; }

    snapshot(a, e) {
      const main = this.stats.main + (e.has('medicated') ? B.TINCTURES.mnd4.cap : 0);
      return { mult: 1, main };
    }

    resolve(id, e) {
      const a = this.actions[id], g = e.g;
      if (a.kind === 'gcd') e.mp -= this.mpCost(id, e);
      switch (id) {
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
        case 'presenceOfMind': e.addStatus('presenceOfMind', 15); break;
        case 'thinAir': e.addStatus('thinAir', 12); break;
        case 'temperance': e.addStatus('temperance', 20); break;
        case 'plenaryIndulgence': e.addStatus('confession', 10); break;
        default:
          if (B.ROLE_EFFECTS[id]) B.ROLE_EFFECTS[id](e);
      }
      if (a.potency) {
        const snap = this.snapshot(a, e);
        const after = a.dot ? () => e.addTStatus(id, a.dot.duration, { snap, dot: { potency: a.dot.potency, id } }) : null;
        e.queueHit(id, a.potency, snap, a.delay, after);
      }
    }

    // A Lily every 30s in combat, up to three.
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
  ${lily(50, 'ws-l0')}${lily(90, 'ws-l1')}${lily(130, 'ws-l2')}
  <rect x="34" y="104" width="112" height="5" rx="2.5" fill="#1d1a2a"/><rect id="ws-t" x="34" y="104" width="0" height="5" rx="2.5" fill="#bfe8ff"/>
  <text x="200" y="38" font-family="Noto Sans, sans-serif" font-size="11" font-weight="600" fill="#a9a3b4" letter-spacing="1">BLOOD LILY</text>
  ${[0, 1, 2].map(k => `<circle id="ws-b${k}" cx="${230 + k * 36}" cy="78" r="12" fill="#2a1d24" stroke="rgba(255,255,255,.3)" stroke-width="1.5"/>`).join('')}
</svg>`;
      const $ = (s) => root.querySelector(s);
      this.wg = { l: [0, 1, 2].map(k => $('#ws-l' + k)), b: [0, 1, 2].map(k => $('#ws-b' + k)), t: $('#ws-t'), cache: {} };
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
      return `
<h3>How it plays (Shadowbringers 5.0–5.58)</h3>
<p>Level 80 White Mage on a dummy. Fill with <b>Glare</b> (300, a 2.5s cast) and keep <b>Dia</b> up (120, then 60 a tick for 30s; refresh it in its last 3s). <b>Assize</b> (400, 45s) also gives back 500 MP. <b>Presence of Mind</b> (150s) makes casts and the GCD 20% faster for 15s; <b>Thin Air</b> (120s) makes every spell free for 12s, so cast Glares under it.</p>
<p>A <b>Lily</b> grows every 30s in combat, up to three. <b>Afflatus Solace</b> or <b>Rapture</b> spends one; three of them bloom the <b>Blood Lily</b> for <b>Afflatus Misery</b> (900). Three Lily heals and a Misery are four GCDs for 900 potency, against 1,200 for four Glares, so on a dummy the Lilies are a loss; use them to move or weave.</p>
<h3>The opener (The Balance, 5.58)</h3>
${seq(['glare', 'dia', ['assize'], ['presenceOfMind'], 'glare', 'glare', 'glare', 'glare', 'glare', 'glare', 'glare', 'glare', 'glare', 'glare', 'dia'])}
<p>The tincture at −3.5s and Glare hardcast at −2.5s. Then Glare, Dia when it's about to fall off, Assize on cooldown, Lucid Dreaming when the MP needs it.</p>
<p style="color:#a9a3b4">The 5.58 numbers: Glare 300, Dia 120 + 60 × 30s, Assize 400, Afflatus Misery 900 (25% less to other targets from 5.2; 5.0–5.11 stepped 10–50%), Holy 140, Maim and Mend II +30%. Gear: a reconstruction of The Balance's "Comfy Mid-Piety Relic" set at 2.34 (Mind 5,560, 180 magic damage, 912 Piety), pre-6.0 stats from the 5.58 game data, with a Grade 4 Tincture of Mind.</p>`;
    }
  }

  B.registerJob({
    id: 'whm', name: 'White Mage', abbr: 'WHM', role: 'healer', classJob: 24,
    versions: [{ id: 'shb50', label: 'Shadowbringers 5.0–5.58', history: 'ShB 5.0–5.58', note: 'Level 80: Glare and Dia, the Lily rework into Afflatus Misery, Presence of Mind on 150s, Thin Air for free spells, Assize', create: () => new WhiteMageShB() }],
  });
})(window.BLM);
