// Warrior, Endwalker at level 90, in two versions. Heavy Swing → Maim → Storm's Path or Storm's Eye (Surging
// Tempest, +10% damage, kept up to 60s), the Beast Gauge for Fell Cleave, Infuriate (two charges, +50 gauge and
// Nascent Chaos for Inner Chaos), Inner Release (60s: three free, guaranteed critical direct-hit Fell Cleaves, and
// Primal Rend Ready), Upheaval and Onslaught.
//  - 6.0–6.08: every weaponskill but Primal Rend used an Inner Release stack (so Inner Chaos inside it wasted one);
//    no Direct Hit bonus on guaranteed direct hits; Primal Rend didn't jump to the target.
//  - 6.1–6.58: only Fell Cleave and Decimate use the stacks; Primal Rend jumps; 6.2 gave guaranteed direct hits the
//    Direct Hit stat's bonus, and 6.2–6.4 raised the combo, Fell Cleave, Upheaval and Inner Chaos (the 6.4 values).
// Numbers are the game data at 6.08 and 6.58 and the Lodestone notes; gear is The Balance's set for each tier. ref: a
// scripted bot parses about 5,300 / 8,730 on these.
(function (B) {
  const ws = (o) => Object.assign({ kind: 'gcd', target: true, range: B.MELEE_RANGE, delay: 0.55, fx: 'gnbSlash' }, o);
  const ab = (o) => Object.assign({ kind: 'ogcd' }, o);
  const VERSIONS = {
    ew60: { label: 'Endwalker 6.0–6.08', history: 'EW 6.0–6.08', maim: [130, 280], path: [120, 400], fell: 460, chaos: 650, upheaval: 350,
      irAll: true, dhDet: false, prJump: false, tincture: 'str6', ref: 5620,
      stats: { hp: 85556, main: 2528, wd: 120, det: 2169, crit: 2206, dh: 400, speed: 400, ten: 982 },
      note: 'Level 90: every weaponskill spends an Inner Release stack as a guaranteed critical direct hit; Primal Rend, Inner Chaos, Surging Tempest; Asphodelos gear' },
    ew61: { label: 'Endwalker 6.1–6.58', history: 'EW 6.1–6.58', maim: [150, 300], path: [160, 440], fell: 520, chaos: 660, upheaval: 400,
      irAll: false, dhDet: true, prJump: true, tincture: 'str', ref: 9250,
      stats: { hp: 125000, main: 3330, wd: 132, det: 2182, crit: 2576, dh: 940, speed: 400, ten: 529 },
      note: 'Level 90: Inner Release stacks only on Fell Cleave and Decimate, Primal Rend jumps, guaranteed direct hits gain from Direct Hit (6.2), the 6.4 potencies; Anabaseios gear' },
  };

  function buildActions(V) {
    return {
      heavySwing: ws({ name: 'Heavy Swing', potency: 200, comboStart: true, comboNext: true, desc: 'Delivers an attack with a potency of 200.' }),
      maim: ws({ name: 'Maim', potency: V.maim[0], comboPotency: V.maim[1], comboFrom: 'heavySwing', comboNext: true, gauge: 10, fx: 'gnbSlash2', desc: `Delivers an attack with a potency of ${V.maim[0]}.\nCombo Action: Heavy Swing\nCombo Potency: ${V.maim[1]}\nCombo Bonus: Increases Beast Gauge by 10` }),
      stormsPath: ws({ name: 'Storm\'s Path', potency: V.path[0], comboPotency: V.path[1], comboFrom: 'maim', gauge: 20, fx: 'gnbBurst', desc: `Delivers an attack with a potency of ${V.path[0]}.\nCombo Action: Maim\nCombo Potency: ${V.path[1]}\nCombo Bonus: Restores own HP\nCombo Bonus: Increases Beast Gauge by 20` }),
      stormsEye: ws({ name: 'Storm\'s Eye', potency: V.path[0], comboPotency: V.path[1], comboFrom: 'maim', gauge: 10, tempest: true, fx: 'gnbBurst', desc: `Delivers an attack with a potency of ${V.path[0]}.\nCombo Action: Maim\nCombo Potency: ${V.path[1]}\nCombo Bonus: Grants Surging Tempest (damage dealt +10%), extending it by 30s up to 60s\nCombo Bonus: Increases Beast Gauge by 10` }),
      tomahawk: ws({ name: 'Tomahawk', potency: 150, range: 20, breaksCombo: true, delay: 0.7, fx: 'enpi', desc: 'Throws an axe, dealing damage with a potency of 150.\nAdditional Effect: Increased enmity' }),
      fellCleave: ws({ name: 'Fell Cleave', potency: V.fell, cost: 50, spends: true, fx: 'gnbDouble', desc: `Delivers an attack with a potency of ${V.fell}.\nBeast Gauge Cost: 50\nInner Release: no cost, and a guaranteed critical direct hit.` }),
      innerChaos: ws({ name: 'Inner Chaos', potency: V.chaos, cost: 50, chaos: true, fx: 'gnbDouble', desc: `Delivers an attack with a potency of ${V.chaos}.\nThis attack is guaranteed to be both a critical and a direct hit.\nBeast Gauge Cost: 50\nCan only be executed while under the effect of Nascent Chaos.\nFell Cleave changes to Inner Chaos under Nascent Chaos.` }),
      primalRend: ws({ name: 'Primal Rend', potency: 700, range: 20, aoe: 0.3, fx: 'gnbZone', desc: `Delivers an attack with a potency of 700 to target and all enemies nearby it, 70% less for the rest.\nThis attack is guaranteed to be both a critical and a direct hit.${V.prJump ? '\nRushes to the target.' : ''}\nCan only be executed while under the effect of Primal Rend Ready.` }),
      overpower: ws({ name: 'Overpower', potency: 110, comboStart: true, comboNext: true, target: false, pbaoe: 5, aoe: true, desc: 'Delivers an attack with a potency of 110 to all nearby enemies.' }),
      mythrilTempest: ws({ name: 'Mythril Tempest', potency: 100, comboPotency: 150, comboFrom: 'overpower', target: false, pbaoe: 5, aoe: true, gauge: 20, tempest: true, desc: 'Delivers an attack with a potency of 100 to all nearby enemies.\nCombo Action: Overpower\nCombo Potency: 150\nCombo Bonus: Surging Tempest +30s (up to 60s)\nCombo Bonus: Increases Beast Gauge by 20' }),
      decimate: ws({ name: 'Decimate', potency: 200, cost: 50, spends: true, target: false, pbaoe: 5, aoe: true, desc: 'Delivers an attack with a potency of 200 to all nearby enemies.\nBeast Gauge Cost: 50' }),
      chaoticCyclone: ws({ name: 'Chaotic Cyclone', potency: 320, cost: 50, chaos: true, target: false, pbaoe: 5, aoe: true, desc: 'Delivers a critical direct hit with a potency of 320 to all nearby enemies.\nBeast Gauge Cost: 50\nCan only be executed while under the effect of Nascent Chaos.' }),
      infuriate: ab({ name: 'Infuriate', recast: 60, charges: 2, desc: 'Increases Beast Gauge by 50.\nAdditional Effect: Grants Nascent Chaos\nDuration: 30s\nMaximum Charges: 2\nFell Cleave, Decimate, Inner Chaos and Chaotic Cyclone shorten its recast by 5s.' }),
      innerRelease: ab({ name: 'Inner Release', recast: 60, desc: `Grants 3 stacks of Inner Release: ${V.irAll ? 'each weaponskill but Primal Rend uses one and is a guaranteed critical direct hit; Beast Gauge actions cost nothing' : 'Fell Cleave and Decimate use one, cost no gauge and are guaranteed critical direct hits'}.\nDuration: 15s\nAdditional Effect: Surging Tempest +10s\nAdditional Effect: Grants Primal Rend Ready\nDuration: 30s` }),
      upheaval: ab({ name: 'Upheaval', recast: 30, cdGroup: 'upheaval', potency: V.upheaval, target: true, range: B.MELEE_RANGE, delay: 0.6, fx: 'gnbZone', desc: `Delivers an attack with a potency of ${V.upheaval}.\nShares a recast timer with Orogeny.` }),
      orogeny: ab({ name: 'Orogeny', recast: 30, cdGroup: 'upheaval', potency: 150, target: false, pbaoe: 5, aoe: true, delay: 0.6, fx: 'gnbBow', desc: 'Delivers an attack with a potency of 150 to all nearby enemies.\nShares a recast timer with Upheaval.' }),
      onslaught: ab({ name: 'Onslaught', recast: 30, charges: 3, potency: 150, target: true, range: 20, delay: 0.3, fx: 'gnbCont', desc: 'Rushes target and delivers an attack with a potency of 150.\nMaximum Charges: 3' }),
      defiance: ab({ name: 'Defiance', recast: V.irAll ? 10 : 3, desc: 'Significantly increases enmity generation.\nEffect ends upon reuse.' }),
      bloodwhetting: ab({ name: 'Bloodwhetting', recast: 25, desc: 'Reduces damage taken by 10% and heals with each weaponskill.\nDuration: 8s' }),
      thrillOfBattle: ab({ name: 'Thrill of Battle', recast: 90, desc: 'Increases maximum HP by 20% and restores the amount increased.\nDuration: 10s' }),
      vengeance: ab({ name: 'Vengeance', recast: 120, desc: 'Reduces damage taken by 30% and delivers an attack with a potency of 55 every time you suffer physical damage.\nDuration: 15s' }),
      holmgang: ab({ name: 'Holmgang', recast: 240, desc: 'Brace yourself for an enemy onslaught, preventing most attacks from reducing your HP to less than 1.\nDuration: 10s' }),
      equilibrium: ab({ name: 'Equilibrium', recast: 60, desc: 'Restores own HP.\nCure Potency: 1,200' }),
      shakeItOff: ab({ name: 'Shake It Off', recast: 90, desc: 'Creates a barrier around self and all nearby party members.\nDuration: 30s' }),
      ...B.ROLE_ACTIONS.tank,
      ...B.GENERAL_ACTIONS,
      tincture: B.tincture(V.tincture),
      auto: { name: 'Attack', kind: 'auto', fx: 'auto', desc: 'Auto-attack.' },
    };
  }

  const STATUSES = {
    surgingTempest: { name: 'Surging Tempest', self: true, icon: 'st_tempest' },
    innerRelease: { name: 'Inner Release', self: true, icon: 'st_ir' },
    primalRendReady: { name: 'Primal Rend Ready', self: true, icon: 'st_prr' },
    nascentChaos: { name: 'Nascent Chaos', self: true, icon: 'st_chaos' },
    defiance: { name: 'Defiance', self: true, icon: 'st_defiance' },
    bloodwhetting: { name: 'Bloodwhetting', self: true, icon: 'st_bw' },
    thrillOfBattle: { name: 'Thrill of Battle', self: true, icon: 'st_thrill' },
    vengeance: { name: 'Vengeance', self: true, icon: 'st_vengeance' },
    holmgang: { name: 'Holmgang', self: true, icon: 'st_holmgang' },
    shakeItOff: { name: 'Shake It Off', self: true, icon: 'st_sio' },
  };

  class WarriorEW {
    constructor(version) {
      const V = VERSIONS[version];
      this.V = V;
      this.name = 'Warrior';
      this.abbr = 'WAR';
      this.role = 'tank';
      this.level = 90;
      this.levelKey = 90;
      this.model = 'war-ew';
      this.actions = buildActions(V);
      this.statuses = STATUSES;
      this.stats = Object.assign({ mainStat: 'str', jobMod: 105, trait: 100, delay: 3.36 }, V.stats);
      this.speedName = 'Skill speed';
      this.tierHaste = 0;
      this.autoAttack = { potency: 90, delay: 3.36, range: B.MELEE_RANGE };
      this.selfStatusOrder = ['surgingTempest', 'innerRelease', 'primalRendReady', 'nascentChaos', 'defiance', 'medicated', 'rampart', 'bloodwhetting',
        'thrillOfBattle', 'vengeance', 'holmgang', 'shakeItOff', 'armsLength', 'sprint'];
      this.targetStatusOrder = ['reprisal'];
      this.defaultBars = [
        ['heavySwing', 'maim', 'stormsPath', 'stormsEye', 'fellCleave', 'primalRend', 'infuriate', 'innerRelease', 'upheaval', 'onslaught', 'tomahawk', 'tincture'],
        ['overpower', 'mythrilTempest', 'decimate', 'orogeny', 'defiance', 'rampart', 'bloodwhetting', 'thrillOfBattle', 'vengeance', 'holmgang', 'equilibrium', 'shakeItOff'],
        ['provoke', 'reprisal', 'shirk', 'lowBlow', 'interject', 'armsLength', 'sprint', null, null, null, null, null],
      ];
      this.actionGroups = [
        ['Warrior', ['heavySwing', 'maim', 'stormsPath', 'stormsEye', 'tomahawk', 'fellCleave', 'innerChaos', 'primalRend', 'overpower', 'mythrilTempest',
          'decimate', 'chaoticCyclone', 'infuriate', 'innerRelease', 'upheaval', 'orogeny', 'onslaught', 'defiance', 'bloodwhetting', 'thrillOfBattle',
          'vengeance', 'holmgang', 'equilibrium', 'shakeItOff']],
        ['Role Actions', ['rampart', 'lowBlow', 'provoke', 'interject', 'reprisal', 'armsLength', 'shirk']],
        ['General', ['sprint', 'tincture']],
      ];
      this.referenceDps = V.ref;
      this.referenceGcd = 2.5;
      this.startDistance = 3.2;
    }

    initGauge() { return { beast: 0 }; }

    // Fell Cleave and Decimate become Inner Chaos and Chaotic Cyclone under Nascent Chaos.
    resolveId(id, e) {
      if (id === 'fellCleave' && e.has('nascentChaos')) return 'innerChaos';
      if (id === 'decimate' && e.has('nascentChaos')) return 'chaoticCyclone';
      return id;
    }

    irStacks(e) { return e.has('innerRelease') ? (e.statuses.innerRelease.stacks || 0) : 0; }
    // Does this weaponskill use an Inner Release stack (and so cost nothing and crit)?
    usesIr(id, e) {
      if (!this.irStacks(e)) return false;
      if (this.V.irAll) return this.actions[id].kind === 'gcd' && id !== 'primalRend';
      return !!this.actions[id].spends;
    }

    check(id, e) {
      const a = this.actions[id], g = e.g;
      if (a.chaos && !e.has('nascentChaos')) return 'Unable to execute action. Nascent Chaos required.';
      if (id === 'primalRend' && !e.has('primalRendReady')) return 'Unable to execute action. Primal Rend Ready required.';
      if (a.cost && g.beast < a.cost && !(this.irStacks(e) && (this.V.irAll || a.spends))) return 'Not enough Beast Gauge.';
      return null;
    }

    snapshot(a, e) {
      const mult = e.has('surgingTempest') ? 1.10 : 1;
      const main = this.stats.main + (e.has('medicated') ? B.TINCTURES[this.V.tincture].cap : 0);
      return { mult, main };
    }

    gauge(e, n) { e.g.beast = Math.max(0, Math.min(100, e.g.beast + n)); }
    tempest(e, add) {
      const left = e.has('surgingTempest') ? e.statuses.surgingTempest.until - e.now : 0;
      e.addStatus('surgingTempest', Math.min(60, left + add));
    }

    resolve(id, e) {
      const a = this.actions[id], g = e.g;
      let potency = a.potency || 0, opts = {};
      if (a.comboFrom && e.lastComboHit) potency = a.comboPotency;
      const free = this.usesIr(id, e);
      if (free) {
        const s = e.statuses.innerRelease;
        s.stacks--;
        if (s.stacks <= 0) e.removeStatus('innerRelease'); else e.emit('statusStack', { key: 'innerRelease' });
        opts = { crit: true, dh: true, dhDet: this.V.dhDet };
      }
      if (a.cost && !(free || (this.V.irAll && e.has('innerRelease') && a.cost))) this.gauge(e, -a.cost);
      if (a.chaos || id === 'primalRend') opts = { crit: true, dh: true, dhDet: this.V.dhDet };
      if (a.chaos) e.removeStatus('nascentChaos');
      // Enhanced Infuriate: each gauge spender takes 5s off Infuriate.
      if (a.cost) { const c = e.cdOf('infuriate'); if (c && c.nextAt !== null) c.nextAt -= 5; }
      if (a.gauge && e.lastComboHit) this.gauge(e, a.gauge);
      if (a.tempest && e.lastComboHit) this.tempest(e, 30);

      switch (id) {
        case 'primalRend':
          e.removeStatus('primalRendReady');
          if (this.V.prJump) this.gap(e);
          break;
        case 'infuriate': this.gauge(e, 50); e.addStatus('nascentChaos', 30); break;
        case 'innerRelease':
          e.addStatus('innerRelease', 15, { stacks: 3 });
          e.addStatus('primalRendReady', 30);
          if (e.has('surgingTempest')) this.tempest(e, 10);
          break;
        case 'onslaught': this.gap(e); break;
        case 'defiance':
          if (e.has('defiance')) e.removeStatus('defiance'); else e.addStatus('defiance', 1e9, { permanent: true });
          break;
        case 'bloodwhetting': e.addStatus('bloodwhetting', 8); break;
        case 'thrillOfBattle': e.addStatus('thrillOfBattle', 10); break;
        case 'vengeance': e.addStatus('vengeance', 15); break;
        case 'holmgang': e.addStatus('holmgang', 10); break;
        case 'shakeItOff': e.addStatus('shakeItOff', 30); break;
        default:
          if (B.ROLE_EFFECTS[id]) B.ROLE_EFFECTS[id](e);
      }
      if (potency) e.queueHit(id, potency, this.snapshot(a, e), a.delay, null, opts);
    }

    gap(e) {
      const d = e.distToTarget() || 1;
      if (d > 2.6) {
        const from = { x: e.pos.x, z: e.pos.z };
        e.pos.x *= 2.4 / d; e.pos.z *= 2.4 / d;
        e.emit('teleport', { from, to: { x: e.pos.x, z: e.pos.z } });
      }
    }

    proc(id, e) {
      const a = this.actions[id];
      if (a.comboFrom && e.inCombo(a.comboFrom)) return true;
      if (id === 'fellCleave' || id === 'innerChaos') return e.g.beast >= 50 || this.irStacks(e) > 0 || e.has('nascentChaos');
      if (id === 'primalRend') return e.has('primalRendReady');
      return false;
    }

    mpRegen() { return B.BASE_REGEN; }
    speedInfo(e) { return `GCD ${e.gcdForSpeed(e.stats.speed).toFixed(2)} · Inner Release fits three Fell Cleaves`; }

    // ---------- the Beast Gauge ----------
    gaugeBuild(root) {
      root.innerHTML = `
<svg width="360" height="120" viewBox="0 0 360 120">
  <defs><linearGradient id="we-b" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#b8442a"/><stop offset="1" stop-color="#ffb04a"/></linearGradient></defs>
  <rect x="8" y="10" width="344" height="100" rx="14" fill="rgba(14,12,20,.86)" stroke="rgba(255,255,255,.22)"/>
  <text x="24" y="38" font-family="Noto Sans, sans-serif" font-size="11" font-weight="600" fill="#a9a3b4" letter-spacing="1">BEAST GAUGE</text>
  <text id="we-n" x="336" y="40" text-anchor="end" font-family="Saira Semi Condensed, sans-serif" font-size="20" font-weight="700" fill="#fff" stroke="#000" stroke-width="3" paint-order="stroke">0</text>
  <rect x="24" y="52" width="312" height="14" rx="7" fill="#1d1a2a" stroke="rgba(255,255,255,.2)"/>
  <rect id="we-bar" x="24" y="52" width="0" height="14" rx="7" fill="url(#we-b)"/>
  <line x1="180" y1="48" x2="180" y2="70" stroke="rgba(255,255,255,.5)"/>
  <text id="we-t" x="24" y="94" font-family="Noto Sans, sans-serif" font-size="12" font-weight="600" fill="#ffd98a" letter-spacing="1"></text>
</svg>`;
      const $ = (s) => root.querySelector(s);
      this.wg = { n: $('#we-n'), bar: $('#we-bar'), t: $('#we-t'), cache: {} };
    }

    gaugeUpdate(e) {
      const G = this.wg, c = G.cache, g = e.g;
      const put = (k, v, fn) => { if (c[k] !== v) { c[k] = v; fn(v); } };
      put('b', g.beast, v => { G.n.textContent = String(v); G.bar.setAttribute('width', String(312 * v / 100)); });
      const t = e.has('surgingTempest') ? Math.ceil(e.statuses.surgingTempest.until - e.now) : 0, ir = this.irStacks(e);
      put('t', `${t}|${ir}`, () => { G.t.textContent = `SURGING TEMPEST ${t ? t + 's' : '—'}${ir ? `  ·  INNER RELEASE ×${ir}` : ''}`; });
    }

    helpHtml(seq) {
      const V = this.V;
      const opener = V.irAll
        ? seq(['tomahawk', ['infuriate'], 'heavySwing', 'maim', ['tincture'], 'stormsEye', 'innerChaos', ['upheaval'], ['innerRelease'], 'primalRend', ['onslaught'], 'fellCleave', ['onslaught'], 'fellCleave', ['onslaught'], 'fellCleave', ['infuriate'], 'innerChaos', 'heavySwing', 'maim', 'stormsPath'])
        : seq(['tomahawk', ['infuriate'], 'heavySwing', 'maim', ['tincture'], 'stormsEye', ['innerRelease'], 'innerChaos', ['upheaval'], ['onslaught'], 'primalRend', ['infuriate'], 'innerChaos', ['onslaught'], 'fellCleave', ['onslaught'], 'fellCleave', 'fellCleave', 'heavySwing', 'maim', 'stormsPath']);
      return `
<h3>How it plays (${V.label})</h3>
<p>Level 90 Warrior. <b>Heavy Swing → Maim → Storm's Eye</b> keeps <b>Surging Tempest</b> up (+10% damage, 30s a time up to 60s); otherwise finish with <b>Storm's Path</b> (+20 Beast Gauge). Spend 50 gauge on <b>Fell Cleave</b> (${V.fell}). <b>Infuriate</b> (two charges) adds 50 and Nascent Chaos, which turns Fell Cleave into <b>Inner Chaos</b> (${V.chaos}, always a critical direct hit); every spender takes 5s off Infuriate.</p>
<p><b>Inner Release</b> (60s) gives three stacks and <b>Primal Rend Ready</b> (700, a critical direct hit). ${V.irAll ? 'In 6.0 every weaponskill but Primal Rend uses a stack and becomes a free critical direct hit, so fill it with Fell Cleaves and keep Inner Chaos and Infuriate out of it.' : 'From 6.1 only Fell Cleave and Decimate use the stacks (free, critical direct hits), so Inner Chaos can go inside it; from 6.2 these guaranteed direct hits also gain from your Direct Hit stat.'} <b>Upheaval</b> (${V.upheaval}) and <b>Onslaught</b> (three charges) go in the window.</p>
<h3>The opener (The Balance)</h3>
${opener}
<p style="color:#a9a3b4">${V.label} numbers: Heavy Swing 200, Maim ${V.maim[1]} and Storm's Path / Eye ${V.path[1]} in combo, Fell Cleave ${V.fell}, Inner Chaos ${V.chaos}, Primal Rend 700, Upheaval ${V.upheaval}, Onslaught 150, Tomahawk 150; auto-attacks 90 at 3.36s. AoE (Overpower 110, Mythril Tempest 150, Decimate 180, Chaotic Cyclone 300) are the era's values as remembered. Gear: The Balance's set for the tier (Strength ${V.stats.main.toLocaleString()}).</p>`;
    }
  }

  B.WarriorEW = WarriorEW;
  B.registerJob({
    id: 'war', name: 'Warrior', abbr: 'WAR', role: 'tank', classJob: 21,
    versions: ['ew61', 'ew60'].map(v => ({ id: v, label: VERSIONS[v].label, history: VERSIONS[v].history, note: VERSIONS[v].note, create: () => new WarriorEW(v) })),
  });
})(window.BLM);
